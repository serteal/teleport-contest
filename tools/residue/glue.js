// ---- JS side of the module (tools/residue/glue.js, copied in verbatim by build.mjs) ----------
//
// createClib(options) -> instance.  Synchronous; no files, network, workers or timers.
// The instance owns one linear memory (an ArrayBuffer that is replaced when memory grows).

const PAGE = 65536;
const ENOSYS = 52; // errno value for "function not implemented"

/** Thrown by the C library's longjmp; only the residue's own setjmp points catch it. */
const LONGJMP = Object.freeze({ toString: () => "C longjmp" });

/** Thrown by exit()/_Exit() when no options.exit hook is given. */
export class ClibExit extends Error {
  constructor(status) {
    super("exit(" + status + ")");
    this.status = status;
  }
}

/** True for the exception the C library uses to unwind a longjmp through JS frames. */
export function isLongjmp(e) {
  return e === LONGJMP;
}

function toI64Parts(v) {
  const b = BigInt.asUintN(64, typeof v === "bigint" ? v : BigInt(Math.trunc(Number(v))));
  return [Number(b & 0xffffffffn) | 0, Number(b >> 32n) | 0];
}

function fromI64Parts(lo, hi, unsigned) {
  return unsigned ? (lo >>> 0) + (hi >>> 0) * 4294967296 : (lo >>> 0) + (hi | 0) * 4294967296;
}

function bigFromI64Parts(lo, hi, unsigned) {
  const b = (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
  return unsigned ? b : BigInt.asIntN(64, b);
}

// Days from 1970-01-01 to y-m-d (proleptic Gregorian), month 0-based; out-of-range month and
// day values carry over as in mktime.  (setUTCFullYear has no two-digit-year mapping.)
function daysFromCivil(y, m, d) {
  const t = new Date(0);
  t.setUTCFullYear(y, m, d);
  return Math.round(t.getTime() / 86400000);
}

/** Broken-down UTC time of t (seconds since the epoch). */
export function utcFields(t) {
  const days = Math.floor(t / 86400);
  const rem = t - days * 86400;
  const date = new Date(days * 86400000);
  const year = date.getUTCFullYear();
  return {
    sec: rem % 60, min: Math.floor(rem / 60) % 60, hour: Math.floor(rem / 3600),
    mday: date.getUTCDate(), mon: date.getUTCMonth(), year: year - 1900,
    wday: date.getUTCDay(), yday: days - daysFromCivil(year, 0, 1),
    isdst: 0, gmtoff: 0, zone: "UTC",
  };
}

/** Seconds since the epoch of broken-down UTC fields (out-of-range fields normalise). */
export function utcSeconds(f) {
  return daysFromCivil(f.year + 1900, f.mon, f.mday) * 86400 + f.hour * 3600 + f.min * 60 + f.sec;
}

// ---- format-string driven varargs ------------------------------------------------------------
// wasm32 C ABI: a variadic call passes a pointer to a buffer holding the promoted arguments in
// order, each at its natural alignment: int/long/pointer/char/short -> 4 bytes (4-aligned),
// long long/intmax_t -> 8 bytes (8-aligned), float/double -> double, 8 bytes (8-aligned).
// A va_list is that same pointer (char *).  Slot kinds below: "i" i32, "j" i64, "d" double.

/** Slot kinds consumed by a printf format (musl conversions; %m and %% take none). */
export function printfSlots(fmt, long64 = false) {
  const slots = [];
  let out = "", i = 0, changed = false;
  while (i < fmt.length) {
    const c = fmt[i];
    if (c !== "%") { out += c; i++; continue; }
    const start = i++;
    if (fmt[i] === "%") { out += "%%"; i++; continue; }
    if (/^\d+\$/.test(fmt.slice(i))) throw new Error("clib: positional printf arguments are not supported");
    while ("-+ #0'".includes(fmt[i])) i++;
    if (fmt[i] === "*") { slots.push("i"); i++; } else while (fmt[i] >= "0" && fmt[i] <= "9") i++;
    if (fmt[i] === ".") {
      i++;
      if (fmt[i] === "*") { slots.push("i"); i++; } else while (fmt[i] >= "0" && fmt[i] <= "9") i++;
    }
    let len = "";
    while ("hlLqjzt".includes(fmt[i]) && i < fmt.length) len += fmt[i++];
    const conv = fmt[i++];
    let spec = fmt.slice(start, i);
    if ("diouxXcb".includes(conv)) {
      if (len === "l" && long64 && conv !== "c") { spec = spec.replace(/l(?=[diouxXb]$)/, "ll"); changed = true; len = "ll"; }
      slots.push(len === "ll" || len === "j" || len === "q" || len === "L" ? "j" : "i");
    } else if ("eEfFgGaA".includes(conv)) {
      if (len === "L") throw new Error("clib: long double printf arguments are not supported");
      slots.push("d");
    } else if (conv === "s" || conv === "p") {
      slots.push(conv === "s" ? "s" : "i");
    } else if (conv === "n") {
      if (len === "l" && long64) { spec = spec.replace(/l(?=n$)/, "ll"); changed = true; }
      slots.push("i");
    } else if (conv === "m") {
      // no argument
    } else {
      throw new Error("clib: unsupported printf conversion %" + len + (conv ?? ""));
    }
    out += spec;
  }
  return { slots, fmt: changed ? out : null };
}

/** Slot kinds consumed by a scanf format: every stored conversion takes one pointer. */
export function scanfSlots(fmt, long64 = false) {
  const slots = [];
  let out = "", i = 0, changed = false;
  while (i < fmt.length) {
    const c = fmt[i];
    if (c !== "%") { out += c; i++; continue; }
    const start = i++;
    if (fmt[i] === "%") { out += "%%"; i++; continue; }
    let suppress = false;
    if (fmt[i] === "*") { suppress = true; i++; }
    while (fmt[i] >= "0" && fmt[i] <= "9") i++;
    let len = "";
    while ("hlLqjztm".includes(fmt[i]) && i < fmt.length) len += fmt[i++];
    const conv = fmt[i++];
    if (conv === "[") {
      if (fmt[i] === "^") i++;
      if (fmt[i] === "]") i++;
      while (i < fmt.length && fmt[i] !== "]") i++;
      i++;
    }
    let spec = fmt.slice(start, i);
    if (len === "l" && long64 && "diouxXn".includes(conv)) { spec = spec.replace(/l(?=[diouxXn]$)/, "ll"); changed = true; }
    if (!suppress && conv !== undefined) slots.push("i");
    out += spec;
  }
  return { slots, fmt: changed ? out : null };
}

/** Slot kinds consumed by a Lua format (lua_pushfstring, luaL_error): %d %c %U int, %I
 *  lua_Integer (64-bit), %f lua_Number (double), %s %p pointers, %% none. */
export function luaSlots(fmt) {
  const slots = [];
  for (let i = 0; i < fmt.length; i++) {
    if (fmt[i] !== "%") continue;
    const c = fmt[++i];
    if (c === "%") continue;
    if (c === "d" || c === "c" || c === "U") slots.push("i");
    else if (c === "I") slots.push("j");
    else if (c === "f") slots.push("d");
    else if (c === "s") slots.push("s");
    else if (c === "p") slots.push("i");
    else throw new Error("clib: invalid Lua format conversion %" + c);
  }
  return { slots, fmt: null };
}

// Format kind and format-parameter index of the variadic/va_list functions.
const FORMATS = {
  printf: ["printf", 0], vprintf: ["printf", 0], iprintf: ["printf", 0],
  fprintf: ["printf", 1], vfprintf: ["printf", 1], fiprintf: ["printf", 1], vfiprintf: ["printf", 1],
  dprintf: ["printf", 1], vdprintf: ["printf", 1],
  sprintf: ["printf", 1], vsprintf: ["printf", 1], siprintf: ["printf", 1],
  asprintf: ["printf", 1], vasprintf: ["printf", 1],
  snprintf: ["printf", 2], vsnprintf: ["printf", 2],
  scanf: ["scanf", 0], vscanf: ["scanf", 0], fscanf: ["scanf", 1], vfscanf: ["scanf", 1],
  sscanf: ["scanf", 1], vsscanf: ["scanf", 1],
  lua_pushfstring: ["lua", 1], lua_pushvfstring: ["lua", 1], luaL_error: ["lua", 1],
};

/** Create one instance of the C library + Lua VM.
 *
 * options (all optional):
 *   now()            wall clock in ms since the epoch for time()/clock_gettime (default: 0,
 *                    a fixed clock, so runs are reproducible unless the host supplies one)
 *   monotonic()      monotonic clock in ms (default: now)
 *   localtime(t)     broken-down local time of t seconds: {sec,min,hour,mday,mon,year,wday,
 *                    yday,isdst,gmtoff,zone} (default: UTC, utcFields)
 *   mktime(fields)   inverse of localtime; fields.isdst < 0 means unknown (default: UTC)
 *   tz               {timezone (seconds west of UTC), daylight, std, dst} for tzset
 *                    (default: UTC, no DST)
 *   env              {NAME: value} environment for getenv (read once, at creation)
 *   stdout(bytes), stderr(bytes)   Uint8Array chunks written to fd 1 / fd 2 (default: dropped)
 *   stdin(max)       Uint8Array (or null at end of input) read from fd 0 (default: end of input)
 *   sys              {importName(...rawArgs)} implementations of the file-system imports
 *                    (__syscall_openat, fd_read, fd_write for fd > 2, fd_seek, fd_close, ...);
 *                    each receives the raw wasm arguments; missing ones fail with ENOSYS
 *   exit(status)     called by exit()/_Exit() (default: throw ClibExit)
 *   abort()          called by abort() (default: throw Error("abort"))
 *   long64           treat printf/scanf "%ld"-style conversions as 64-bit in call()/format()
 *                    (the format text is rewritten to "%lld" in a stack copy)
 */
export function createClib(options = {}) {
  const o = options;
  const now = o.now ?? (() => 0);
  const monotonic = o.monotonic ?? now;
  const sys = o.sys ?? {};
  let X = null;
  const api = {};
  const growHooks = [];

  function refresh() {
    const buf = X.memory.buffer;
    api.buffer = buf;
    api.HEAP8 = new Int8Array(buf);
    api.HEAPU8 = new Uint8Array(buf);
    api.HEAP16 = new Int16Array(buf);
    api.HEAPU16 = new Uint16Array(buf);
    api.HEAP32 = new Int32Array(buf);
    api.HEAPU32 = new Uint32Array(buf);
    api.HEAPF32 = new Float32Array(buf);
    api.HEAPF64 = new Float64Array(buf);
  }

  function setTempRet(hi) { X._emscripten_tempret_set(hi | 0); }
  function retI64(v) { const [lo, hi] = toI64Parts(v); setTempRet(hi); return lo; }
  function writeI64(p, v) { const [lo, hi] = toI64Parts(v); api.HEAP32[p >> 2] = lo; api.HEAP32[(p >> 2) + 1] = hi; }

  function writeTm(tm, f) {
    const H = api.HEAP32, b = tm >> 2;
    H[b] = f.sec; H[b + 1] = f.min; H[b + 2] = f.hour; H[b + 3] = f.mday; H[b + 4] = f.mon;
    H[b + 5] = f.year; H[b + 6] = f.wday; H[b + 7] = f.yday; H[b + 8] = f.isdst; H[b + 9] = f.gmtoff ?? 0;
  }
  function readTm(tm) {
    const H = api.HEAP32, b = tm >> 2;
    return { sec: H[b], min: H[b + 1], hour: H[b + 2], mday: H[b + 3], mon: H[b + 4], year: H[b + 5],
      wday: H[b + 6], yday: H[b + 7], isdst: H[b + 8] };
  }
  const localtime = o.localtime ?? utcFields;
  const mktime = o.mktime ?? utcSeconds;

  function grow(requested) {
    requested >>>= 0;
    const old = api.HEAPU8.length;
    const max = 2147483648 - PAGE;
    if (requested > max) return 0;
    for (let cut = 1; cut <= 4; cut *= 2) {
      let size = Math.min(Math.max(requested, old + Math.min(old * (1 + 0.2 / cut) - old, 100663296)), max);
      size = Math.ceil(size / PAGE) * PAGE;
      if (X.memory.grow((size - old) / PAGE) >= 0) {
        refresh();
        for (const f of growHooks) f(api.buffer, old);
        return 1;
      }
    }
    return 0;
  }

  const out = { 1: o.stdout, 2: o.stderr };
  function fdWrite(fd, iov, iovcnt, pnum) {
    if (fd !== 1 && fd !== 2) return sys.fd_write ? sys.fd_write(fd, iov, iovcnt, pnum) : 8;
    let n = 0;
    for (let k = 0; k < iovcnt; k++) {
      const p = api.HEAPU32[(iov >> 2) + 2 * k], len = api.HEAPU32[(iov >> 2) + 2 * k + 1];
      if (len && out[fd]) out[fd](api.HEAPU8.slice(p, p + len));
      n += len;
    }
    api.HEAPU32[pnum >> 2] = n;
    return 0;
  }
  function fdRead(fd, iov, iovcnt, pnum) {
    if (fd !== 0) return sys.fd_read ? sys.fd_read(fd, iov, iovcnt, pnum) : 8;
    let n = 0;
    for (let k = 0; k < iovcnt; k++) {
      const p = api.HEAPU32[(iov >> 2) + 2 * k], len = api.HEAPU32[(iov >> 2) + 2 * k + 1];
      const chunk = o.stdin ? o.stdin(len) : null;
      if (!chunk || !chunk.length) break;
      api.HEAPU8.set(chunk.subarray(0, len), p);
      n += Math.min(chunk.length, len);
      if (chunk.length < len) break;
    }
    api.HEAPU32[pnum >> 2] = n;
    return 0;
  }

  const env = o.env ?? {};
  const envStrings = Object.keys(env).map((k) => k + "=" + env[k]);

  const imp = {
    exit: (s) => { if (o.exit) o.exit(s); throw new ClibExit(s); },
    proc_exit: (s) => { if (o.exit) o.exit(s); throw new ClibExit(s); },
    _abort_js: () => { if (o.abort) o.abort(); throw new Error("abort"); },
    _emscripten_throw_longjmp: () => { throw LONGJMP; },
    _emscripten_runtime_keepalive_clear: () => {},
    _emscripten_system: (cmd) => (cmd ? -ENOSYS : 0),
    _setitimer_js: () => ENOSYS,
    __call_sighandler: (fp, sig) => X.__indirect_function_table.get(fp)(sig),
    emscripten_resize_heap: grow,
    emscripten_date_now: () => now(),
    emscripten_get_now: () => monotonic(),
    clock_time_get: (id, plo, phi, ptime) => {
      if (id < 0 || id > 3) return 28;
      writeI64(ptime, Math.round((id === 0 ? now() : monotonic()) * 1e6));
      return 0;
    },
    _tzset_js: (timezone, daylight, stdName, dstName) => {
      const tz = o.tz ?? { timezone: 0, daylight: 0, std: "UTC", dst: "UTC" };
      api.HEAP32[timezone >> 2] = tz.timezone;
      api.HEAP32[daylight >> 2] = tz.daylight;
      api.writeString(tz.std.slice(0, 16), stdName);
      api.writeString(tz.dst.slice(0, 16), dstName);
    },
    _localtime_js: (lo, hi, tm) => { const f = localtime(fromI64Parts(lo, hi)); if (!f) return 1; writeTm(tm, f); return 0; },
    _gmtime_js: (lo, hi, tm) => { writeTm(tm, utcFields(fromI64Parts(lo, hi))); return 0; },
    _mktime_js: (tm) => {
      const t = mktime(readTm(tm));
      if (t === -1 || !Number.isFinite(t)) return retI64(-1);
      writeTm(tm, localtime(t));
      return retI64(t);
    },
    _timegm_js: (tm) => { const t = utcSeconds(readTm(tm)); writeTm(tm, utcFields(t)); return retI64(t); },
    environ_sizes_get: (pcount, psize) => {
      api.HEAPU32[pcount >> 2] = envStrings.length;
      api.HEAPU32[psize >> 2] = envStrings.reduce((n, s) => n + s.length + 1, 0);
      return 0;
    },
    environ_get: (penv, pbuf) => {
      let at = pbuf;
      envStrings.forEach((s, k) => { api.HEAPU32[(penv >> 2) + k] = at; api.writeString(s, at); at += s.length + 1; });
      return 0;
    },
    fd_write: fdWrite,
    fd_read: fdRead,
    fd_close: (fd) => (fd <= 2 ? 0 : sys.fd_close ? sys.fd_close(fd) : 8),
    fd_seek: (fd, lo, hi, whence, pnew) => (sys.fd_seek ? sys.fd_seek(fd, lo, hi, whence, pnew) : fd <= 2 ? 70 : 8),
    fd_fdstat_get: (fd, p) => {
      if (sys.fd_fdstat_get) return sys.fd_fdstat_get(fd, p);
      if (fd > 2) return 8;
      api.HEAPU8.fill(0, p, p + 24);
      api.HEAPU8[p] = 2; // character device
      return 0;
    },
  };
  for (const name of IMPORTS) {
    if (imp[name]) continue;
    if (name.startsWith("invoke_")) {
      // a call made by compiled code inside setjmp: a longjmp lands here and resumes C
      imp[name] = (index, ...args) => {
        const sp = X.emscripten_stack_get_current();
        try {
          return X.__indirect_function_table.get(index)(...args);
        } catch (e) {
          X._emscripten_stack_restore(sp);
          if (e !== LONGJMP) throw e;
          X.setThrew(1, 0);
          return 0;
        }
      };
    } else if (name.startsWith("__syscall_")) {
      imp[name] = (...args) => (sys[name] ? sys[name](...args) : -ENOSYS);
    } else {
      imp[name] = (...args) => (sys[name] ? sys[name](...args) : ENOSYS);
    }
  }
  const wasi = {};
  for (const name of WASI_IMPORTS) wasi[name] = imp[name];

  X = instantiate({ env: imp, wasi_snapshot_preview1: wasi });
  refresh();

  // ---- strings (bytes are chars 0-255: no text decoding, exact round trip) ------------------
  api.readString = (p, max = Infinity) => {
    let s = "";
    const H = api.HEAPU8;
    for (let k = 0; k < max && H[p + k]; k++) s += String.fromCharCode(H[p + k]);
    return s;
  };
  api.writeString = (s, p) => {
    const H = api.HEAPU8;
    for (let k = 0; k < s.length; k++) H[p + k] = s.charCodeAt(k);
    H[p + s.length] = 0;
    return p;
  };
  api.newString = (s) => api.writeString(s, X.malloc(s.length + 1));
  api.stackString = (s) => api.writeString(s, X._emscripten_stack_alloc(s.length + 1));

  // ---- stack (the C stack of the module; grows down from layout.stackBase) ------------------
  api.stackSave = () => X.emscripten_stack_get_current();
  api.stackRestore = (sp) => X._emscripten_stack_restore(sp);
  api.stackAlloc = (n) => X._emscripten_stack_alloc(n);
  api.sbrk = (n) => X.sbrk(n);
  api.onGrow = (f) => { growHooks.push(f); };

  // ---- snapshots ---------------------------------------------------------------------------
  // All mutable C state is in memory below the sbrk top (malloc never trims, so sbrk(0) is
  // the high-water mark) plus the stack pointer.  restore() rewrites [0, top), zeroes what was
  // allocated since (malloc assumes fresh sbrk memory is zero) and resets the stack pointer.
  // Memory never shrinks; functions added to the table stay.
  api.snapshot = () => {
    const top = X.sbrk(0);
    return { top, sp: X.emscripten_stack_get_current(), bytes: api.HEAPU8.slice(0, top) };
  };
  api.restore = (s) => {
    const now = X.sbrk(0);
    api.HEAPU8.set(s.bytes);
    if (now > s.top) api.HEAPU8.fill(0, s.top, now);
    X._emscripten_stack_restore(s.sp);
  };

  // ---- function table ----------------------------------------------------------------------
  // The table holds plain JS functions (wasm2js), so any JS function can be stored and called
  // by compiled code through a C function pointer.  Arguments arrive as the wasm values: i32 as
  // signed numbers, i64 as two i32 (low, high), doubles as numbers.  A JS function stored here
  // must not return a 64-bit value.
  const table = X.__indirect_function_table;
  const freeSlots = [];
  api.table = table;
  api.addFunction = (f) => {
    if (freeSlots.length) { const k = freeSlots.pop(); table.set(k, f); return k; }
    const k = table.length;
    table.grow(1);
    table.set(k, f);
    return k;
  };
  api.removeFunction = (k) => { table.set(k, null); freeSlots.push(k); };
  api.getFunction = (k) => table.get(k);
  api.callFunction = (k, ...args) => table.get(k)(...args);

  // ---- calls with C types ------------------------------------------------------------------
  api.fn = X;
  api.signatures = SIGNATURES;
  api.long64 = !!o.long64;

  function slotsFor(name, args, fmtIndex, kind) {
    const fmtArg = args[fmtIndex];
    const text = typeof fmtArg === "string" ? fmtArg : api.readString(fmtArg);
    if (kind === "printf") return printfSlots(text, api.long64);
    if (kind === "scanf") return scanfSlots(text, api.long64);
    return luaSlots(text);
  }

  /** Lay out a va_list for `slots` on the stack (call inside a stackSave/stackRestore pair).
   *  Values: Number or BigInt for "i"/"j", Number for "d", Number (address) or JS string
   *  (copied to the stack) for "s"; a one-character string is accepted for %c. */
  api.vaList = (slots, values) => {
    const strs = values.map((v, k) => (slots[k] === "s" && typeof v === "string" ? api.stackString(v) : null));
    let size = 0;
    for (const s of slots) size = (s === "i" || s === "s" ? (size + 3) & ~3 : (size + 7) & ~7) + (s === "i" || s === "s" ? 4 : 8);
    const base = X._emscripten_stack_alloc(Math.max(size, 8));
    let at = base;
    slots.forEach((s, k) => {
      let v = strs[k] ?? values[k];
      if (s === "i" || s === "s") {
        at = (at + 3) & ~3;
        if (typeof v === "string") v = v.charCodeAt(0);
        api.HEAP32[at >> 2] = typeof v === "bigint" ? Number(BigInt.asIntN(32, v)) : v | 0;
        at += 4;
      } else {
        at = (at + 7) & ~7;
        if (s === "d") api.HEAPF64[at >> 3] = Number(v);
        else writeI64(at, v ?? 0);
        at += 8;
      }
    });
    return base;
  };

  function call(name, args, big) {
    const sig = SIGNATURES[name];
    const f = X[name];
    if (!sig || !f) throw new Error("clib: no function " + name);
    const [ret, params] = sig.split(":");
    const sp = X.emscripten_stack_get_current();
    try {
      const raw = [];
      const fixed = params.replace(".", "").length;
      for (let k = 0; k < params.length; k++) {
        const t = params[k];
        if (t === ".") {
          const rest = args.slice(fixed);
          const fmt = FORMATS[name];
          const slots = fmt ? slotsFor(name, args, fmt[1], fmt[0]) : { slots: rest.map(() => "i"), fmt: null };
          if (slots.slots.length > rest.length) throw new Error("clib: " + name + ": format needs " + slots.slots.length + " arguments, got " + rest.length);
          if (slots.fmt !== null) raw[fmt[1]] = api.stackString(slots.fmt);
          raw.push(api.vaList(slots.slots, rest));
          break;
        }
        let v = args[k];
        if (t === "V") {
          if (typeof v === "number") { raw.push(v); continue; }
          const rest = Array.isArray(v) ? v : v && typeof v.rest === "function" ? v.rest() : [...v];
          const fmt = FORMATS[name];
          const slots = slotsFor(name, args, fmt[1], fmt[0]);
          if (slots.fmt !== null) raw[fmt[1]] = api.stackString(slots.fmt);
          raw.push(api.vaList(slots.slots, rest));
        } else if (t === "j" || t === "J") {
          raw.push(...toI64Parts(v ?? 0));
        } else if (t === "d" || t === "f") {
          raw.push(Number(v));
        } else if (typeof v === "string" && t === "p") {
          raw.push(api.stackString(v));
        } else {
          raw.push(typeof v === "bigint" ? Number(BigInt.asIntN(32, v)) : v ?? 0);
        }
      }
      const r = f(...raw);
      if (ret === "j" || ret === "J") {
        const hi = X.__get_temp_ret();
        return big ? bigFromI64Parts(r, hi, ret === "J") : fromI64Parts(r, hi, ret === "J");
      }
      if (ret === "u") return r >>> 0;
      return r;
    } finally {
      X._emscripten_stack_restore(sp);
    }
  }
  /** Call C function `name` with JS values; 64-bit results as Number (exact below 2^53). */
  api.call = (name, ...args) => call(name, args, false);
  /** Same as call, 64-bit results as BigInt. */
  api.call64 = (name, ...args) => call(name, args, true);
  /** printf-format JS values into a JS string (vsnprintf into a stack buffer). */
  api.format = (fmt, ...args) => {
    const sp = X.emscripten_stack_get_current();
    try {
      const f = typeof fmt === "string" ? api.stackString(fmt) : fmt;
      const n = call("snprintf", [0, 0, f, ...args], false);
      if (n < 0) throw new Error("clib: snprintf failed");
      const buf = X._emscripten_stack_alloc(n + 1);
      call("snprintf", [buf, n + 1, f, ...args], false);
      return api.readString(buf);
    } finally {
      X._emscripten_stack_restore(sp);
    }
  };

  const heapBase = X.sbrk(0); // before the constructors allocate
  X.__wasm_call_ctors();
  api.layout = {
    nullGuard: 1024,                       // [0, 1024): never written by the module
    globalBase: BUILD.globalBase,          // [nullGuard, globalBase): reserved, never touched
    stackBase: X.emscripten_stack_get_base(),   // the C stack grows down from here ...
    stackEnd: X.emscripten_stack_get_end(),     // ... to here
    heapBase,                              // malloc/sbrk memory starts here
  };
  api.stdin = X.clib_stdstream(0);
  api.stdout = X.clib_stdstream(1);
  api.stderr = X.clib_stdstream(2);
  api.isLongjmp = isLongjmp;
  return api;
}

export default createClib;
