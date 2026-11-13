// host/libc.js - the C library functions the port writes in JS.
//
// Most of the C library comes from the vendored residue (js/vendor), called
// with JS values through clib.call().  The functions here are the ones the
// residue does not have, or must not be used for:
//
//   qsort       the reference comparator call order (host/qsort.js): comparators are JS functions
//   regcomp, regexec, regfree   the reference regex dialect (host/regex.js) for REG_EXTENDED
//   regerror    the reference message texts (host/regerror.js); also as nhjs_regerror
//   sscanf      the residue's, with %d / %lld numbers out of range saturated (see sscanf below)
//   creat       open(path, O_CREAT|O_WRONLY|O_TRUNC, mode), as musl defines it
//   getlogin    getenv("LOGNAME") (musl)
//   getpwuid, getpwnam   no password database: NULL, errno ENOENT (Emscripten)
//   signal      remembers handlers; no signal is ever delivered
//   fork, execv, execl, waitpid, setuid, setgid   -1 with the errno Emscripten sets
//   popen, pclose   no subprocess is run: NULL / -1, errno ENOSYS
//   isatty      stdin, stdout and stderr are pipes: 0 for fd 0, 1, 2 (errno ENOTSUP);
//               other descriptors: their device
//   file_exists unixunix.c of upstream's tip (SYSCF GDBPATH checks): stat(path) == 0
//   exit        ends the game at once (host/endgame.js); stdio is not flushed
//   abort, __assert_fail   end the game with an error
//
// createHostLibc(clib, opts) -> { name: function(...args) } taking the values
// emitted code passes (addresses as numbers; functions for function pointers).

import { qsort as jsQsort } from "./qsort.js";
import { regerror as jsRegerror } from "./regerror.js";
import { GameExit, GameAbort } from "./endgame.js";
import { O, E } from "./vfs.js";
import { compile as compileRegex, matches } from "./regex.js";

// <regex.h> of the residue (musl): regcomp flags and regexec's no-match code
const REG_EXTENDED = 1, REG_NOSUB = 8, REG_NOMATCH = 1;
const REGEX_MARK = 0x5845_5243; // "CREX": a regex_t compiled by host/regex.js

// sscanf formats whose conversions are all width-less %d, %lld (%lli) or %c
const SIGNED_DECIMAL_SCANF = /^(?:[^%]|%%|%(?:lld|lli|d|c))*$/;
const LLONG_MAX_TEXT = "9223372036854775807", LLONG_MIN_DIGITS = "9223372036854775808";
/** The input bytes with every [+-]digits run beyond the long long range replaced by the limit
 *  (same sign), or null when there is none. */
function clampDecimalRuns(s) {
  const out = [];
  let changed = false;
  const digit = (c) => c >= 48 && c <= 57;
  for (let i = 0; i < s.length; ) {
    const signed = s[i] === 45 || s[i] === 43;
    const j = signed ? i + 1 : i;
    if (j < s.length && digit(s[j])) {
      let k = j;
      while (k < s.length && digit(s[k])) k++;
      let z = j;
      while (z < k - 1 && s[z] === 48) z++;
      const lim = s[i] === 45 ? LLONG_MIN_DIGITS : LLONG_MAX_TEXT;
      const n = k - z;
      const text = String.fromCharCode(...s.subarray(z, k));
      if (n > 19 || (n === 19 && text > lim)) {
        for (let q = i; q < j; q++) out.push(s[q]);
        for (const ch of lim) out.push(ch.charCodeAt(0));
        changed = true;
      } else for (let q = i; q < k; q++) out.push(s[q]);
      i = k;
      continue;
    }
    out.push(s[i]);
    i++;
  }
  return changed ? Uint8Array.from(out) : null;
}

export function createHostLibc(clib, opts = {}) {
  const signals = opts.signals ?? new Map();
  const setErrno = (v) => {
    clib.HEAP32[clib.fn.__errno_location() >> 2] = v;
  };
  const fail = (errno) => {
    setErrno(errno);
    return -1;
  };
  const cstring = (p) => clib.readString(p);
  const cbytes = (p) => {
    const H = clib.HEAPU8;
    let e = p;
    while (H[e]) e++;
    return H.slice(p, e);
  };
  const regexCache = new Map(); // pattern text -> compile() result
  const compiled = (bytes) => {
    const key = String.fromCharCode(...bytes);
    let r = regexCache.get(key);
    if (!r) regexCache.set(key, (r = compileRegex(bytes)));
    return r;
  };
  return {
    qsort(base, nel, width, cmp) {
      jsQsort(clib, base, nel, width, cmp);
    },
    // regcomp/regexec/regfree: the reference regex dialect (host/regex.js) for the extended REs
    // NetHack compiles; other flags (not used by the game) stay with the residue's musl.
    // The regex_t (musl's layout, 32 bytes) holds re_nsub, a malloc'd copy of the pattern in
    // __opaque and a marker in __padding[0]: all state is in the heap, so snapshots and game
    // resets keep it; compiled patterns are cached by text.
    regcomp(preg, pattern, cflags) {
      if ((cflags & ~(REG_EXTENDED | REG_NOSUB)) || !(cflags & REG_EXTENDED)) return clib.call("regcomp", preg, pattern, cflags);
      const H = clib.HEAPU32;
      const bytes = cbytes(pattern);
      const r = compiled(bytes);
      if (r.err) {
        H.fill(0, preg >> 2, (preg >> 2) + 3);
        return r.err;
      }
      const copy = clib.fn.malloc(bytes.length + 1);
      clib.HEAPU8.set(bytes, copy);
      clib.HEAPU8[copy + bytes.length] = 0;
      H[preg >> 2] = r.nsub;
      H[(preg >> 2) + 1] = copy;
      H[(preg >> 2) + 2] = REGEX_MARK;
      return 0;
    },
    regexec(preg, string, nmatch, pmatch, eflags) {
      const H = clib.HEAPU32;
      if (H[(preg >> 2) + 2] !== REGEX_MARK) return clib.call("regexec", preg, string, nmatch, pmatch, eflags);
      return matches(compiled(cbytes(H[(preg >> 2) + 1])).nfa, cbytes(string)) ? 0 : REG_NOMATCH;
    },
    regfree(preg) {
      const H = clib.HEAPU32;
      if (H[(preg >> 2) + 2] === REGEX_MARK) {
        clib.fn.free(H[(preg >> 2) + 1]);
        H.fill(0, preg >> 2, (preg >> 2) + 3);
      } else if (H[(preg >> 2) + 1]) clib.call("regfree", preg);
    },
    // sscanf: %d / %lld are converted as by strtoimax(), which saturates at LLONG_MIN/LLONG_MAX
    // before the value is stored; musl wraps.  For the formats made of width-less %d %lld %c and
    // literal text (bribe()'s "%lld", #levelchange's "%d%c", ...), an input number beyond the
    // 64-bit range is replaced by the limit it saturates to; other formats go unchanged.
    sscanf(str, fmt, ...ptrs) {
      if (SIGNED_DECIMAL_SCANF.test(cstring(fmt))) {
        const clamped = clampDecimalRuns(cbytes(str));
        if (clamped) {
          const sp = clib.stackSave();
          try {
            const copy = clib.stackAlloc(clamped.length + 1);
            clib.HEAPU8.set(clamped, copy);
            clib.HEAPU8[copy + clamped.length] = 0;
            return clib.call("sscanf", copy, fmt, ...ptrs);
          } finally {
            clib.stackRestore(sp);
          }
        }
      }
      return clib.call("sscanf", str, fmt, ...ptrs);
    },
    regerror(errcode, preg, buf, size) {
      return jsRegerror(clib, errcode, preg, buf, size);
    },
    nhjs_regerror(errcode, preg, buf, size) {
      return jsRegerror(clib, errcode, preg, buf, size);
    },
    creat(path, mode) {
      return clib.call("open", path, O.CREAT | O.WRONLY | O.TRUNC, mode);
    },
    getlogin() {
      return clib.call("getenv", "LOGNAME");
    },
    getpwuid() {
      setErrno(E.ENOENT);
      return 0;
    },
    getpwnam() {
      setErrno(E.ENOENT);
      return 0;
    },
    signal(sig, handler) {
      const old = signals.get(sig) ?? 0;
      signals.set(sig, handler);
      return old;
    },
    // musl/Emscripten __sigaction: a table of the 20 bytes of struct sigaction per signal
    sigaction(sig, act, oact) {
      if (sig >>> 0 >= 65) return fail(E.EINVAL);
      const key = "sigaction:" + sig;
      if (oact) clib.HEAPU8.set(signals.get(key) ?? new Uint8Array(20), oact);
      if (act) signals.set(key, clib.HEAPU8.slice(act, act + 20));
      return 0;
    },
    isatty(fd) {
      if (fd >= 0 && fd <= 2) {
        setErrno(E.ENOTSUP);
        return 0;
      }
      const stream = opts.vfs?.()?.streams[fd];
      if (!stream) {
        setErrno(E.EBADF);
        return 0;
      }
      if (stream.tty) return 1;
      setErrno(E.ENOTTY);
      return 0;
    },
    popen() {
      setErrno(E.ENOSYS);
      return 0;
    },
    pclose: () => fail(E.ENOSYS),
    file_exists(path) {
      const sp = clib.stackSave();
      try {
        return clib.call("stat", path, clib.stackAlloc(128)) === 0 ? 1 : 0;
      } finally {
        clib.stackRestore(sp);
      }
    },
    fork: () => fail(E.ENOSYS),
    execv: () => fail(E.ENOEXEC),
    execl: () => fail(E.ENOEXEC),
    waitpid: () => fail(E.E2BIG), // Emscripten's wait4 stub returns -1, read as errno 1
    setuid: () => fail(E.EPERM),
    setgid: () => fail(E.EPERM),
    exit(status) {
      throw new GameExit(status);
    },
    abort() {
      throw new GameAbort();
    },
    __assert_fail(expr, file, line, func) {
      throw new GameAbort(`Assertion failed: ${cstring(expr)} (${cstring(file)}: ${cstring(func)}: ${line})`);
    },
  };
}
