// rt/libc.js: the C library as seen by emitted code.
//
// String, memory and <ctype.h> functions are written here in JS over the heap (exact C
// semantics, byte for byte). Formatted I/O, stdio, malloc/free, qsort and the like are the
// *residue*: compiled C (musl) that never changes, vendored as js/vendor/clib-lua.js. Emitted
// code just calls `sprintf(...)`.

import { uchars, chars, u32, on_attach, machine, libc_function, stack_alloc, memcpy as rawcpy, memmove as rawmove, memset as rawset, memcmp as rawcmp } from "./heap.js";
import { view, record_or_opaque, addr } from "./struct.js";
import { fn_sentinel } from "./fnptr.js";
import { literal_text, js_string } from "./strings.js";

/**
 * A residue function: forwarded to the compiled C library (installed by the host as
 * machine.libc(name, args)). A host may return raw C values; `ret` names the record a pointer
 * result points to, so the caller gets a view either way (as for every struct pointer in JS).
 */
function residue(name, ret) {
  const c = libc_function(name);
  if (!ret) return c;
  const f = function (...args) { const r = c(...args); return typeof r === "number" ? view(record_or_opaque(ret), r) : r; };
  Object.defineProperty(f, "name", { value: name });
  return f;
}

// ---- <string.h> ---------------------------------------------------------------------------
export function strlen(s) { let n = 0; while (uchars[s + n]) n++; return n; }
export function strcpy(d, s) { let i = 0; for (;; i++) { const c = uchars[s + i]; uchars[d + i] = c; if (!c) break; } return d; }
export function strncpy(d, s, n) {
  let i = 0;
  for (; i < n && uchars[s + i]; i++) uchars[d + i] = uchars[s + i];
  for (; i < n; i++) uchars[d + i] = 0;
  return d;
}
export function strcat(d, s) { strcpy(d + strlen(d), s); return d; }
export function strncat(d, s, n) {
  let e = d + strlen(d), i = 0;
  for (; i < n && uchars[s + i]; i++) uchars[e + i] = uchars[s + i];
  uchars[e + i] = 0;
  return d;
}
export function strcmp(a, b) {
  for (let i = 0; ; i++) {
    const x = uchars[a + i], y = uchars[b + i];
    if (x !== y || !x) return x - y;
  }
}
export function strncmp(a, b, n) {
  for (let i = 0; i < n; i++) {
    const x = uchars[a + i], y = uchars[b + i];
    if (x !== y || !x) return x - y;
  }
  return 0;
}
export function strchr(s, c) {
  c &= 255;
  for (let i = 0; ; i++) { const x = uchars[s + i]; if (x === c) return s + i; if (!x) return 0; }
}
export function strrchr(s, c) {
  c &= 255;
  let r = 0;
  for (let i = 0; ; i++) { const x = uchars[s + i]; if (x === c) r = s + i; if (!x) return r; }
}
export function strstr(h, n) {
  const nl = strlen(n);
  if (!nl) return h;
  for (let i = 0; uchars[h + i]; i++) if (strncmp(h + i, n, nl) === 0) return h + i;
  return 0;
}
export function memcpy(d, s, n) { return rawcpy(d, s, n); }
export function memmove(d, s, n) { return rawmove(d, s, n); }
export function memset(d, c, n) { return rawset(d, c, n); }
export function memcmp(a, b, n) { return rawcmp(a, b, n); }
export function memchr(s, c, n) { c &= 255; for (let i = 0; i < n; i++) if (uchars[s + i] === c) return s + i; return 0; }

// ---- <ctype.h> (C locale) -----------------------------------------------------------------
export function isupper(c) { return c >= 65 && c <= 90 ? 1 : 0; }
export function islower(c) { return c >= 97 && c <= 122 ? 1 : 0; }
export function isalpha(c) { return isupper(c) || islower(c) ? 1 : 0; }
export function isdigit(c) { return c >= 48 && c <= 57 ? 1 : 0; }
export function isalnum(c) { return isalpha(c) || isdigit(c) ? 1 : 0; }
export function isspace(c) { return c === 32 || (c >= 9 && c <= 13) ? 1 : 0; }
/** musl's static inline behind the isspace() macro */
export const __isspace = isspace;
export function isprint(c) { return c >= 32 && c < 127 ? 1 : 0; }
export function ispunct(c) { return isprint(c) && !isalnum(c) && c !== 32 ? 1 : 0; }
function isxdigit(c) { return isdigit(c) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102) ? 1 : 0; }
export function tolower(c) { return isupper(c) ? c + 32 : c; }
export function toupper(c) { return islower(c) ? c - 32 : c; }

// ---- <stdlib.h> ---------------------------------------------------------------------------
export function abs(x) { return x < 0 ? -x | 0 : x; }
export function labs(x) { return x < 0 ? -x : x; }
// atoi and atoll are (int)strtol(s, NULL, 10) and strtoll(s, NULL, 10) with a 64-bit long, so a
// value beyond the 64-bit range saturates (atoi: LONG_MAX -> -1, LONG_MIN -> 0 after the cast)
// instead of wrapping; within it, atoi keeps the low 32 bits.
function decimalRun(s) { // -> [index of the first digit, index after the digits, negative]
  let i = 0, neg = false;
  while (isspace(uchars[s + i])) i++;
  if (uchars[s + i] === 45) { neg = true; i++; } else if (uchars[s + i] === 43) i++;
  const start = i;
  while (isdigit(uchars[s + i])) i++;
  return [start, i, neg];
}
function bigDecimal(s, start, end) { let b = 0n; for (let k = start; k < end; k++) b = b * 10n + BigInt(uchars[s + k] - 48); return b; }
const LLONG_MAX_N = 9223372036854775807n;
export function atoi(s) {
  const [start, end, neg] = decimalRun(s);
  let v = 0;
  for (let k = start; k < end; k++) v = (v * 10 + uchars[s + k] - 48) | 0;
  if (end - start >= 19 && bigDecimal(s, start, end) > (neg ? LLONG_MAX_N + 1n : LLONG_MAX_N)) return neg ? 0 : -1;
  return neg ? -v | 0 : v;
}
/** atoll -> a Number (long long, exact below 2^53) */
export function atoll(s) {
  const [start, end, neg] = decimalRun(s);
  if (end - start < 16) { let v = 0; for (let k = start; k < end; k++) v = v * 10 + uchars[s + k] - 48; return neg && v ? -v : v; }
  let b = bigDecimal(s, start, end);
  if (neg) b = -b;
  return Number(b > LLONG_MAX_N ? LLONG_MAX_N : b < -LLONG_MAX_N - 1n ? -LLONG_MAX_N - 1n : b);
}

// ---- residue: formatted output, stdio, allocation, sorting, environment -------------------
const residue_sprintf = residue("sprintf");
const residue_snprintf = residue("snprintf");
const residue_fprintf = residue("fprintf");

// Simple formats in JS. NetHack formats most of its text (and two lines per RNG call for the
// RNG log) with plain %d/%s/%c; parsing and formatting those through the residue's vfprintf
// costs more than the game logic around them. A format qualifies when every conversion is
// %d %i %u %c %s %p or %% with no flags, width, precision or length; anything else, and any
// argument that is not a plain number (or a NULL %s), goes to the residue unchanged. Output
// is byte for byte musl's for these conversions, except %p, which prints "0x" and the hex
// digits ("0x0" for NULL; musl prints NULL as "0").
const D = 1, U = 2, C = 3, S = 4, P = 5;
const plans = new Map();      // format text -> plan, or null (not simple)
// A literal's address is reused by another text when the host rolls the runtime back to an
// earlier state (rt_state_restore: a new game from the pristine image), so the plan is looked up
// by the literal's text, which literal_text gives without reading the heap.
function planFor(fmt) {
  const text = literal_text(fmt) ?? js_string(fmt);
  let p = plans.get(text);
  if (p === undefined) plans.set(text, (p = makePlan(text)));
  return p;
}
function makePlan(t) {
  const out = []; // pieces: string (literal bytes) or conversion code
  let lit = "";
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch !== "%") { lit += ch; continue; }
    const k = t[++i];
    if (k === "%") { lit += "%"; continue; }
    const code = k === "d" || k === "i" ? D : k === "u" ? U : k === "c" ? C : k === "s" ? S : k === "p" ? P : 0;
    if (!code) return null;
    if (lit) { out.push(lit); lit = ""; }
    out.push(code);
  }
  if (lit) out.push(lit);
  return out;
}
let tmp = "";
// format into the JS string `tmp` (bytes 0-255); false: not handled here. `dst`: the output
// buffer (0 for a stream): a %s source inside the output range is left to the residue (musl
// reads it while writing, `sprintf(buf, "x%s", buf)`)
let srcLo = 0, srcHi = 0;
function formatJS(plan, args, k) {
  srcLo = 0x7fffffff; srcHi = -1;
  let r = "";
  for (let i = 0; i < plan.length; i++) {
    const piece = plan[i];
    if (typeof piece === "string") { r += piece; continue; }
    let v = args[k++];
    if (typeof v === "boolean") v = v ? 1 : 0;
    else if (typeof v !== "number") return false;
    if (piece === D) r += (v | 0);
    else if (piece === U) r += (v >>> 0);
    else if (piece === C) r += String.fromCharCode(v & 255);
    else if (piece === P) r += "0x" + (v >>> 0).toString(16);
    else {
      if (v === 0) return false; // "(null)": the residue's business
      let j = v;
      for (; ; j++) { const c = uchars[j]; if (!c) break; r += String.fromCharCode(c); }
      if (v < srcLo) srcLo = v;
      if (j > srcHi) srcHi = j;
    }
  }
  if (k !== args.length) return false; // extra arguments: leave the call as it was
  tmp = r;
  return true;
}
// does [d, d + n] meet a %s source of the last formatJS?
function overlaps(d, n) { return srcHi >= d && srcLo <= d + n; }
function putJS(d, n) { // copy tmp (n bytes max incl. NUL) to d
  const s = tmp, m = Math.min(s.length, n - 1);
  for (let i = 0; i < m; i++) uchars[d + i] = s.charCodeAt(i);
  uchars[d + m] = 0;
}
export function sprintf(buf, fmt, ...args) {
  if (typeof buf === "number" && typeof fmt === "number" && buf) {
    const p = planFor(fmt);
    if (p && formatJS(p, args, 0) && !overlaps(buf, tmp.length)) { putJS(buf, tmp.length + 1); return tmp.length; }
  }
  return residue_sprintf(buf, fmt, ...args);
}
export function snprintf(buf, n, fmt, ...args) {
  if (typeof buf === "number" && typeof fmt === "number" && typeof n === "number" && buf && n >= 0) {
    const p = planFor(fmt);
    if (p && formatJS(p, args, 0) && (n === 0 || !overlaps(buf, Math.min(tmp.length, n - 1)))) { if (n > 0) putJS(buf, n); return tmp.length; }
  }
  return residue_snprintf(buf, n, fmt, ...args);
}
// fprintf stays in the residue: musl's vfprintf writes a line in pieces (the text before the
// newline is copied into the FILE buffer, the newline flushes); a JS fwrite of the whole line
// would go straight to the file - same output, but different (dead) FILE buffer bytes in the heap.
export const fprintf = residue_fprintf;
export const vsnprintf = residue("vsnprintf");
export const vsprintf = residue("vsprintf");
export const printf = residue("printf");
export const fopen = residue("fopen", "struct__IO_FILE");
export const fclose = residue("fclose");
export const fputc = residue("fputc");
export const fputs = residue("fputs");
export const fflush = residue("fflush");
export const setvbuf = residue("setvbuf");
export const read = residue("read");
export const write = residue("write");
export const getenv = residue("getenv");
export const malloc = residue("malloc");
export const calloc = residue("calloc");
export const realloc = residue("realloc");
export const free = residue("free");
export const qsort = residue("qsort");
export const strtol = residue("strtol");
export const atol = residue("atol");
export const time = residue("time");
export const exit = residue("exit");
export const __assert_fail = residue("__assert_fail");
// stdio, files and directories
export const fdopen = residue("fdopen", "struct__IO_FILE");
export const fgets = residue("fgets");
export const fgetc = residue("fgetc");
export const fread = residue("fread");
export const fwrite = residue("fwrite");
export const fseek = residue("fseek");
export const ftell = residue("ftell");
export const rewind = residue("rewind");
export const clearerr = residue("clearerr");
export const ferror = residue("ferror");
export const fscanf = residue("fscanf");
export const sscanf = residue("sscanf");
export const setbuf = residue("setbuf");
export const getchar = residue("getchar");
export const putchar = residue("putchar");
export const puts = residue("puts");
export const vprintf = residue("vprintf");
export const perror = residue("perror");
export const open = residue("open");
export const close = residue("close");
export const creat = residue("creat");
export const lseek = residue("lseek");
export const fcntl = residue("fcntl");
export const access = residue("access");
export const stat = residue("stat");
export const unlink = residue("unlink");
export const rename = residue("rename");
export const mkdir = residue("mkdir");
export const chdir = residue("chdir");
export const chmod = residue("chmod");
export const umask = residue("umask");
export const getcwd = residue("getcwd");
export const opendir = residue("opendir", "struct___dirstream");
export const readdir = residue("readdir", "struct_dirent");
export const closedir = residue("closedir");
// errors, numbers, time
export const __errno_location = residue("__errno_location");
export const strerror = residue("strerror");
export const strtoll = residue("strtoll");
export const difftime = residue("difftime");
export const mktime = residue("mktime");
export const sleep = residue("sleep");
// regular expressions
export const regcomp = residue("regcomp");
export const regexec = residue("regexec");
export const regfree = residue("regfree");
// process, users, signals, environment
export const abort = residue("abort");
export const signal = residue("signal");
export const sigaction = residue("sigaction");
export const fork = residue("fork");
export const execl = residue("execl");
export const execv = residue("execv");
export const waitpid = residue("waitpid");
export const getpid = residue("getpid");
export const getuid = residue("getuid");
export const getgid = residue("getgid");
export const setuid = residue("setuid");
export const setgid = residue("setgid");
export const getlogin = residue("getlogin");
export const getpwuid = residue("getpwuid", "struct_passwd");
export const getpwnam = residue("getpwnam", "struct_passwd");
export const setenv = residue("setenv");
export const unsetenv = residue("unsetenv");
// <setjmp.h>
export { longjmp } from "./setjmp.js";

// ---- <stdio.h> streams: `FILE *const stdout` etc. are data of the residue ------------------
// Live bindings set whenever memory is attached, from the residue's own pointer variables
// (machine.libc_data(name) -> address of the variable; else machine.symbol).
export let stdin = null, stdout = null, stderr = null;
on_attach(({ grown }) => {
  if (grown) return;
  const at = machine.libc_data || machine.symbol;
  if (!at) return;
  const get = (n) => { const a = at(n); return a ? view(record_or_opaque("struct__IO_FILE"), u32[a >> 2]) : null; };
  stdin = get("stdin"); stdout = get("stdout"); stderr = get("stderr");
});
// (also as globals, like C global scalars, for code that names them without an import)
for (const [n, g] of [["stdin", () => stdin], ["stdout", () => stdout], ["stderr", () => stderr]]) Object.defineProperty(globalThis, n, { get: g, configurable: true });

// ---- <assert.h>: assert(cond) kept as a call (the text/file/line only reached stderr in C)
export function assert(c) { if (!c) abort(); }

// ---- strtoull: exact (BigInt). Only used on NETHACK_SEED, a full-range 64-bit value. C rules:
// leading white space, optional sign (negation wraps modulo 2^64), base 0/8/10/16 prefixes,
// stops at the first non-digit, *endp = first unparsed character, overflow -> ULLONG_MAX and errno = ERANGE.
export function strtoull(s, endp, base) {
  let i = 0;
  while (isspace(uchars[s + i])) i++;
  let neg = false;
  if (uchars[s + i] === 45 || uchars[s + i] === 43) { neg = uchars[s + i] === 45; i++; }
  if ((base === 0 || base === 16) && uchars[s + i] === 48 && (uchars[s + i + 1] | 32) === 120 && isxdigit(uchars[s + i + 2])) { base = 16; i += 2; }
  else if (base === 0) base = uchars[s + i] === 48 ? 8 : 10;
  const B = BigInt(base);
  let v = 0n, any = false, over = false;
  for (;; i++) {
    const c = uchars[s + i];
    const d = c >= 48 && c <= 57 ? c - 48 : (c | 32) >= 97 && (c | 32) <= 122 ? (c | 32) - 87 : 99;
    if (d >= base) break;
    v = v * B + BigInt(d); any = true;
    if (v > 0xFFFFFFFFFFFFFFFFn) over = true;
  }
  if (endp) { const e = any ? s + i : s; if (typeof endp === "number") { /* char ** as an address */ new DataView(uchars.buffer).setUint32(endp, e, true); } else endp[0] = e; }
  if (over) { u32[__errno_location() >> 2] = ERANGE; return 0xFFFFFFFFFFFFFFFFn; }
  return BigInt.asUintN(64, neg ? -v : v);
}

// ---- integer constants of the C library headers, with the values of the residue's ABI
// (wasm32 emscripten sysroot); names as in C
export const BUFSIZ = 1024, EOF = -1, _IOLBF = 1, SEEK_SET = 0, SEEK_CUR = 1, SEEK_END = 2; // <stdio.h>
export const EXIT_SUCCESS = 0, EXIT_FAILURE = 1;                                          // <stdlib.h>
export const ENOENT = 44, ERANGE = 68;                                                     // <errno.h>
export const F_OK = 0;                                                                     // <unistd.h>
export const O_RDONLY = 0, O_RDWR = 2, O_CREAT = 64, F_SETLK = 13, F_UNLCK = 2, F_WRLCK = 1; // <fcntl.h>
export const PATH_MAX = 4096, INT_MAX = 2147483647;                                        // <limits.h>
export const LLONG_MAX = 9223372036854775807; // a Number (long long is a Number: 2^63 after rounding)
export const SIGHUP = 1, SIGINT = 2, SIGQUIT = 3, SIGXCPU = 24, SIGWINCH = 28;             // <signal.h>
export const REG_EXTENDED = 1, REG_NOSUB = 8, REG_NOMATCH = 1, REG_BADPAT = 2, REG_ECOLLATE = 3, // <regex.h>
  REG_ECTYPE = 4, REG_EESCAPE = 5, REG_ESUBREG = 6, REG_EBRACK = 7, REG_EPAREN = 8, REG_EBRACE = 9,
  REG_BADBR = 10, REG_ERANGE = 11, REG_ESPACE = 12, REG_BADRPT = 13;
// signal handler values that are integer casts: (void (*)(int)) 0, -2, -1
// (emscripten sysroot signal.h: SIG_IGN is -2 "since 1 is a valid function address")
export const SIG_DFL = null, SIG_IGN = fn_sentinel(-2), SIG_ERR = fn_sentinel(-1);
