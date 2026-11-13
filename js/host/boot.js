// host/boot.js - the machine the game runs on: one heap, the C library, the
// file system, and the game's JS code bound to them.
//
//   const machine = createMachine(options);
//   await machine.load(() => import("./entry.js"));   // the game's modules, once
//   machine.newGame({ datetime })                      // per game: reset, clock, file system
//
// Layout of the one ArrayBuffer (js/vendor/clib-lua.js, `clib.layout`):
//   [0, nullGuard)            never written (NULL)
//   [nullGuard, globalBase)   the game's statics and string literals (rt/heap.js arena)
//   [globalBase, ...)         the C library's data, the C stack, then malloc's heap
// Nothing here is a baked address: the boundaries come from the residue and
// the game's statics are sized by the emitted declarations at load.
//
// The game's JS (emitted modules + js/rt) reaches the machine through
// rt/heap.js `machine`: the stack pointer is the C library's, malloc/free are
// dlmalloc's, and `machine.libc(name, args)` calls host/libc.js or the
// residue (see libcDispatch).  Function pointers are indices in the residue's
// function table, so the Lua VM can call the game's lua_CFunctions and allocator.
//
// A game starts from the "pristine" snapshot taken right after the modules
// were loaded (statics initialised, nothing run): several games can be
// played one after the other in one machine (runSegment per segment, the
// browser's new game), each from an identical start.

import { createClib, printfSlots } from "../vendor/clib-lua.js";
import { Vfs } from "./vfs.js";
import { createSyscalls } from "./syscalls.js";
import { BASE_ENVIRONMENT } from "./env.js";
import * as T from "./time.js";
import { GameExit, GameAbort } from "./endgame.js";
import { createHostLibc } from "./libc.js";
import * as rtHeap from "../rt/heap.js";
import * as rtFn from "../rt/fnptr.js";
import { addr_of } from "../rt/struct.js";
import { literal_text } from "../rt/strings.js";

/**
 * options:
 *   stdout(bytes), stderr(bytes)   what the game writes to fd 1 / fd 2 (default: dropped)
 */
export function createMachine(options = {}) {
  const m = { vfs: new Vfs(), clock: T.clocksFor(""), signals: new Map(), pristine: null, entry: null };
  const clib = createMachineClib(m, options);
  m.clib = clib;
  attachRuntime(clib);
  installFunctionTable(clib);

  // the host callbacks of the game's C driver (sys/c2js/nhjs_tty_api.c) and the installer of
  // the game data files (js/dat), bound to the running game: m.current, set by host/game.js
  m.current = null;
  const game = () => {
    if (!m.current) throw new Error("boot: no game is running");
    return m.current;
  };
  const host = createHostLibc(clib, { signals: m.signals, vfs: () => m.vfs });
  host.nhjs_js_key = (index) => game().key(index);
  host.nhjs_js_capture = (anim, seq, animId, cx, cy, screen) =>
    game().capture(anim, seq, animId, cx, cy, typeof screen === "string" ? screen : clib.readString(screen));
  host.nhjs_js_boundary = (where) => game().boundary(where);
  host.nhjs_install_data_files = () => game().installData();
  const lookup = libcDispatch(clib, host);
  rtHeap.machine.libc = Object.assign((name, args) => lookup(name)(args), { lookup });

  /** Import the game's modules (once); `importer` returns the entry module's namespace. */
  m.load = async (importer) => {
    if (m.entry) return m.entry;
    m.entry = await importer();
    m.pristine = pristineImage(clib);
    return m.entry;
  };

  /** Reset to the pristine state and set up one game: a fresh file system and the session's clock. Returns the Vfs. */
  m.newGame = ({ datetime }) => {
    if (!m.pristine) throw new Error("boot: load() the game first");
    restorePristine(clib, m.pristine);
    m.clock = T.clocksFor(datetime);
    m.vfs = new Vfs({ now: m.clock.now });
    m.signals.clear();
    return m.vfs;
  };

  m.cstring = (p) => clib.readString(p);
  return m;
}

// ---- the C library ------------------------------------------------------------------------

// The vendored C library on the machine's file system and clock, in New York local time.
function createMachineClib(m, options) {
  let clib = null;
  const mem = {
    get HEAP8() { return clib.HEAP8; },
    get HEAPU8() { return clib.HEAPU8; },
    get HEAP16() { return clib.HEAP16; },
    get HEAP32() { return clib.HEAP32; },
    get HEAPU32() { return clib.HEAPU32; },
  };
  clib = createClib({
    long64: true,
    sys: createSyscalls(() => m.vfs, mem),
    now: () => m.clock.now(),
    monotonic: () => m.clock.monotonic(),
    localtime: T.localtime,
    mktime: T.mktime,
    tz: T.tz,
    env: BASE_ENVIRONMENT,
    exit: (status) => {
      throw new GameExit(status);
    },
    abort: () => {
      throw new GameAbort();
    },
    stdout: options.stdout,
    stderr: options.stderr,
  });
  return clib;
}

// js/rt on the C library's memory: stack, allocator, the statics arena and the stdio streams.
function attachRuntime(clib) {
  const L = clib.layout;
  const heapOpts = {
    getSP: () => clib.stackSave(),
    setSP: (sp) => clib.stackRestore(sp),
    malloc: (n) => clib.fn.malloc(n),
    free: (p) => clib.fn.free(p),
    // the game's statics and string literals: the region the C library reserves for them
    arena: [L.nullGuard, L.globalBase],
  };
  // `FILE *stdin` & co.: rt reads the C library's stream pointers from variables
  const streams = clib.fn.malloc(12);
  clib.HEAPU32[streams >> 2] = clib.stdin;
  clib.HEAPU32[(streams >> 2) + 1] = clib.stdout;
  clib.HEAPU32[(streams >> 2) + 2] = clib.stderr;
  const streamVar = { stdin: streams, stdout: streams + 4, stderr: streams + 8 };
  rtHeap.machine.libc_data = (name) => streamVar[name] ?? 0;
  rtHeap.attach_heap(clib.buffer, heapOpts);
  clib.onGrow((buffer) => {
    if (typeof rtHeap.regrow_heap === "function") rtHeap.regrow_heap(buffer);
    else throw new Error("boot: memory grew but rt/heap.js cannot rebind its views (regrow_heap)");
  });
}

// The C library assumes the wasm C ABI's 16-byte stack alignment (clang folds `sp + 16 + 8`
// into `(sp + 16) | 8`); emitted frames keep only 8, so realign before entering the residue.
function withAlignedStack(clib, f) {
  const sp = clib.stackSave();
  if (!(sp & 15)) return f();
  clib.stackRestore(sp & -16);
  try {
    return f();
  } finally {
    clib.stackRestore(sp);
  }
}

// Function pointers: indices in the C library's table, for JS functions and C ones alike.
function installFunctionTable(clib) {
  const toIndex = new Map();
  const fromIndex = new Map();
  const toRaw = (r) => (r === undefined || r === null ? 0 : typeof r === "boolean" ? +r : typeof r === "object" ? addrOf(r) : r);
  rtFn.set_fn_backend({
    get(i) {
      let f = fromIndex.get(i);
      if (f) return f;
      const target = clib.getFunction(i);
      if (!target) return null;
      // a C library function (the Lua VM's): callable from JS with JS values
      f = (...args) => withAlignedStack(clib, () => target(...args.map(addrOf)));
      fromIndex.set(i, f);
      toIndex.set(f, i);
      return f;
    },
    index(f) {
      let i = toIndex.get(f);
      if (i !== undefined) return i;
      // called by the C library with raw values: addresses arrive as numbers
      i = clib.addFunction((...raw) => toRaw(f(...raw)));
      toIndex.set(f, i);
      fromIndex.set(i, f);
      return i;
    },
  });
}

function addrOf(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return addr_of(v);
}

// An argument of emitted code as the C library takes it: addresses and function indices as
// numbers; strings and va_lists stay as they are (clib.call lays them out).
function cArg(v) {
  if (typeof v === "number") return v;
  if (v === null || v === undefined) return 0;
  if (typeof v === "function") return rtFn.fn_index(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object" && typeof v.rest !== "function" && !Array.isArray(v)) return addrOf(v);
  if (Array.isArray(v) && v._a !== undefined) return v._a;
  return v;
}

// ---- the C library for emitted code: machine.libc(name, args) ----------------------------

// format-string parameter of the residue's variadic printf family (stdio.h)
const PRINTF = { printf: 0, sprintf: 1, fprintf: 1, snprintf: 2 };
// variadic functions whose extra arguments are ints (no format string): lua_gc(L, what, ...)
const INT_VARARGS = new Set(["lua_gc"]);

/**
 * name -> what emitted code calls for it (rt/heap.js libc_function looks each name up once):
 * the host function of host/libc.js, else the residue's, with the stack pointer 16-byte
 * aligned for the C code and printf's out-of-range long longs clamped.
 */
function libcDispatch(clib, host) {
  const bound = new Map();
  return (name) => {
    let f = bound.get(name);
    if (f) return f;
    const e = libcEntry(clib, host, name);
    const clamp = FORMAT_ARG[name] !== undefined;
    f = (args) => {
      if (clamp) args = clampLongLongs(name, args);
      const sp = clib.stackSave();
      if (!(sp & 15)) return e(args);
      clib.stackRestore(sp & -16);
      try {
        return e(args);
      } finally {
        clib.stackRestore(sp);
      }
    };
    bound.set(name, f);
    return f;
  };
}

// The call of one name: the host function, the printf family with cached format layouts, a
// direct call for signatures of plain 32-bit values, int varargs, or clib.call (64-bit values,
// varargs laid out from the format string).
function libcEntry(clib, host, name) {
  const h = host[name];
  if (h) return (args) => h(...args.map((v) => (typeof v === "function" && name === "qsort" ? v : cArg(v))));
  const sig = clib.signatures[name];
  if (PRINTF[name] !== undefined) return printfEntry(clib, name, PRINTF[name]);
  if (sig && /^[piudv]:[piud]*$/.test(sig)) return directEntry(clib, name, sig);
  if (INT_VARARGS.has(name) && sig && /^[piud]:[piud]*\.$/.test(sig)) return intVarargsEntry(clib, name, sig);
  return (args) => clib.call(name, ...args.map(cArg));
}

// The printf family: the varargs layout of a format text is parsed once (clib.call parses it
// at every call); `%ld` is 64-bit (long64), the rewritten text is copied to the stack.
const formatLayouts = new Map(); // format text -> printfSlots()
const literalLayouts = new Map(); // string literal text -> printfSlots()
function printfEntry(clib, name, fi) {
  const raw = clib.fn[name];
  return (args) => {
    for (let k = 0; k <= fi; k++) if (typeof args[k] === "string") return clib.call(name, ...args.map(cArg));
    const fmtAddr = cArg(args[fi]);
    // a string literal never changes: its layout is found by its text without reading memory
    const literal = literal_text(fmtAddr);
    let c = literal !== undefined ? literalLayouts.get(literal) : undefined;
    if (!c) {
      const text = clib.readString(fmtAddr);
      c = formatLayouts.get(text);
      if (!c) formatLayouts.set(text, (c = printfSlots(text, true)));
      if (literal !== undefined) literalLayouts.set(literal, c);
    }
    const rest = args.length > fi + 1 ? args.slice(fi + 1).map(cArg) : [];
    if (rest.length < c.slots.length) return clib.call(name, ...args.map(cArg));
    const fixed = new Array(fi + 1);
    for (let k = 0; k < fi; k++) fixed[k] = cArg(args[k]);
    const sp = clib.stackSave();
    try {
      fixed[fi] = c.fmt === null ? fmtAddr : clib.stackString(c.fmt);
      return raw(...fixed, clib.vaList(c.slots, rest));
    } finally {
      clib.stackRestore(sp);
    }
  };
}

// A signature of plain 32-bit values: the raw function, unless an argument is a JS string.
function directEntry(clib, name, sig) {
  const raw = clib.fn[name];
  const unsigned = sig[0] === "u";
  const n = sig.length - 2;
  return (args) => {
    const a = new Array(n);
    for (let k = 0; k < n; k++) {
      const v = args[k];
      if (typeof v === "string") return clib.call(name, ...args.map(cArg));
      a[k] = cArg(v);
    }
    const r = raw(...a);
    return unsigned ? r >>> 0 : r;
  };
}

// Varargs without a format: each one an int, as clib.call lays them out.
function intVarargsEntry(clib, name, sig) {
  const raw = clib.fn[name];
  const n = sig.length - 3;
  return (args) => {
    const a = new Array(n + 1);
    for (let k = 0; k < args.length; k++) {
      const v = args[k];
      if (typeof v === "string" || typeof v === "bigint") return clib.call(name, ...args.map(cArg));
      if (k < n) a[k] = cArg(v);
    }
    for (let k = args.length; k < n; k++) a[k] = 0;
    const rest = args.length > n ? args.slice(n).map(cArg) : [];
    const sp = clib.stackSave();
    try {
      a[n] = clib.vaList(rest.map(() => "i"), rest);
      const r = raw(...a);
      return sig[0] === "u" ? r >>> 0 : r;
    } finally {
      clib.stackRestore(sp);
    }
  };
}

// ---- printf of long longs beyond the Number range -----------------------------------------

// A long long is a Number in the port, so LLONG_MAX (what atoll and sscanf saturate to, the
// experience cap, ...) is held as 2^63; the C library would read that as LLONG_MIN.  For the
// printf family, an argument >= 2^63 of a signed 64-bit conversion (%lld, %ld: long is 64-bit)
// is passed as LLONG_MAX.  (Format parsing only when such an argument is present.)
const FORMAT_ARG = { printf: 0, vprintf: 0, sprintf: 1, vsprintf: 1, fprintf: 1, vfprintf: 1, snprintf: 2, vsnprintf: 2 };
const TWO_63 = 2 ** 63;

function clampLongLongs(name, args) {
  const fi = FORMAT_ARG[name];
  const variadic = name[0] !== "v";
  if (variadic && !hasLongLongOverflow(args, fi + 1)) return args;
  const values = variadic ? args.slice(fi + 1) : args[fi + 1] && typeof args[fi + 1].rest === "function" ? args[fi + 1].rest() : null;
  if (!values || !values.some((v) => typeof v === "number" && v >= TWO_63)) return args;
  const fmt = args[fi];
  const text = typeof fmt === "string" ? fmt : cText(addrOf(fmt));
  const fixed = values.slice();
  for (const k of signedLongLongSlots(text)) if (typeof fixed[k] === "number" && fixed[k] >= TWO_63) fixed[k] = 9223372036854775807n;
  return variadic ? [...args.slice(0, fi + 1), ...fixed] : [...args.slice(0, fi + 1), fixed, ...args.slice(fi + 2)];
}

function hasLongLongOverflow(args, from) {
  for (let k = from; k < args.length; k++) if (typeof args[k] === "number" && args[k] >= TWO_63) return true;
  return false;
}

// slot indices (as clib's printfSlots counts them) of the signed 64-bit conversions of fmt
function signedLongLongSlots(fmt) {
  const out = [];
  let slot = 0;
  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== "%") continue;
    i++;
    if (fmt[i] === "%") continue;
    while ("-+ #0'".includes(fmt[i])) i++;
    if (fmt[i] === "*") { slot++; i++; } else while (fmt[i] >= "0" && fmt[i] <= "9") i++;
    if (fmt[i] === ".") { i++; if (fmt[i] === "*") { slot++; i++; } else while (fmt[i] >= "0" && fmt[i] <= "9") i++; }
    let len = "";
    while (i < fmt.length && "hlLqjzt".includes(fmt[i])) len += fmt[i++];
    const conv = fmt[i];
    if (conv === "m") continue;
    if ((conv === "d" || conv === "i") && (len === "l" || len === "ll" || len === "j" || len === "q")) out.push(slot);
    slot++;
  }
  return out;
}

function cText(p) {
  const u = rtHeap.uchars;
  let s = "";
  for (let i = p; u[i]; i++) s += String.fromCharCode(u[i]);
  return s;
}

// ---- the pristine image -------------------------------------------------------------------

function pristineImage(clib) {
  const top = clib.sbrk(0);
  return {
    top,
    sp: clib.stackSave(),
    bytes: clib.HEAPU8.slice(0, top),
    rt: typeof rtHeap.rt_state_save === "function" ? rtHeap.rt_state_save() : null,
  };
}

function restorePristine(clib, p) {
  const now = clib.sbrk(0);
  clib.HEAPU8.set(p.bytes);
  if (now > p.top) clib.HEAPU8.fill(0, p.top, now);
  clib.stackRestore(p.sp);
  if (p.rt) rtHeap.rt_state_restore(p.rt);
}
