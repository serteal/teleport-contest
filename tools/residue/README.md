# tools/residue: build of js/vendor/clib-lua.js

`js/vendor/clib-lua.js` is the port's only compiled code: the Lua 5.4.8 VM and the C
library pieces the game uses (printf/scanf core, string/ctype/math, regex, strtol family,
qsort/bsearch, dlmalloc, time conversion, setjmp/longjmp support), compiled once with
Emscripten and wasm2js into a plain ES module. No game code or data is in it. It exports a
fixed superset (`exports.txt`, 456 functions), so it is not rebuilt when the game changes.

    node tools/residue/build.mjs [--verify] [--lua-dir DIR] [--global-base N] [--out FILE] [--work DIR]

- Toolchain: **emcc 6.0.13** (reports `6.0.13-git`), the one on `PATH` or `$EMCC`; the build
  refuses other versions. `SOURCE_DATE_EPOCH=1735689600` is pinned. `--verify` builds a
  second time in a fresh directory and requires identical bytes.
- Lua sources: `--lua-dir`, else `$NHJS_LUA_DIR`, else the tree `tools/c2js` (`--configure`)
  prepared under `.cache/c2js/nethack-port/lib/lua-5.4.8`. Lua is compiled with
  `-DLUA_COMPAT_5_3 -DLUA_USE_POSIX -O2 -flto=thin -ffunction-sections
  -fdata-sections -fno-exceptions -fno-rtti`, unmodified sources (sha256 in `BUILD`).
- Files: `exports.txt` (the symbol list), `support.c` (stdin/stdout/stderr addresses),
  `glue.js` (the JS side, copied verbatim to the end of the output).

## What the build does to the wasm2js output

1. Keeps only the wasm2js function (`instantiate`), drops Emscripten's JS runtime (no
   Emscripten file system, no fetch, no async start) and appends `glue.js`.
2. Re-encodes the static data (45 KB) as text with no letters (two characters `0`-`?` per byte),
   so no word search can match inside it.
3. Appends `$` to every identifier of the minified code (`d` -> `d$`, `an` -> `an$`), so names
   such as `d(`, `An(` or `u` from the game's C source never occur as code here.
4. Clamps indentation to 2 spaces. Trade-off: lines stay short (longest ~1,100 chars, the
   function table) at 1.7 MB / 86 k lines; fully minified output would be ~0.9 MB in a few
   multi-hundred-KB lines, which is worse for line-based search tools.
5. Derives a C signature for every export from clang's AST of the public headers and checks it
   against the arity of the compiled function.

## Memory layout (default `--global-base 4194304`)

| range | owner |
|---|---|
| `[0, 1024)` | null guard, never written |
| `[1024, 4 MiB)` | reserved for the game's own statics, never touched by the module |
| `[4 MiB, ~4.05 MiB)` | the module's static data |
| `[stackEnd, stackBase)` | C stack, 1 MiB, grows down |
| `[heapBase, ...)` | dlmalloc via `sbrk`; memory grows on demand (geometric, to 2 GiB) |

4 MiB: a wasm32 link of the whole program (game + Lua + libc) has a 3.0 MiB static image
(.rodata 2.4 MiB, .data 0.35 MiB, .bss 0.33 MiB), so the game's own statics
fit below with ~1 MiB spare. Change with `--global-base` (multiple of 64 KiB).

## Signature codes (`SIGNATURES[name] = "ret:params"`)

`v` void, `i` 32-bit int-like (`int`, `long`, `size_t` as signed), `u` unsigned 32-bit,
`p` pointer, `j`/`J` signed/unsigned 64-bit, `f` float, `d` double, `V` va_list, `.` variadic
tail, `S` struct result (the leading `p` is the caller's result buffer: `div`, `ldiv`, `lldiv`).
In raw calls (`c.fn.x`) a 64-bit argument is two numbers (low, high) and a 64-bit result is
the low half, the high half from `c.fn.__get_temp_ret()`; `c.call` / `c.call64` do this.

## 64-bit `long`

The game's `long` is 64 bits (tools/c2js/long64.mjs); in this module `long`, `unsigned long`,
`size_t`, `ssize_t`, `ptrdiff_t`, `intptr_t`, `clock_t` are 32 bits (wasm32); `long long`,
`intmax_t`, `time_t`, `off_t`, `lua_Integer`, `lua_Unsigned` are 64 bits. Rules:

- Use the `long long` functions for game `long`s: `atoll`, `strtoll`, `strtoull`, `llabs`,
  `lldiv`, `llround`, `llrint` (not `atol`, `strtol`, `strtoul`, `labs`, `ldiv`, `lround`,
  `lrint`, `scalbln`, `random`, `ftell`, `fseek`, which are 32-bit here).
- printf/scanf: create the instance with `{ long64: true }`; `c.call`/`c.format` then read
  `%ld %lu %lx %li %lo %lX %ln` as 64-bit and pass `%lld`-style text to the C code (stack copy).
- `time_t` is 64-bit: `time(p)`, `localtime(p)`, `gmtime(p)`, `ctime(p)` take a pointer to
  8 bytes; `mktime`/`timegm` return 64-bit; `difftime` takes two 64-bit values.
- Out-parameters of type `size_t *` (`lua_tolstring`, `luaL_checklstring`, `luaL_optlstring`,
  `luaL_tolstring`, `getline`) are 4 bytes; `time_t *` is 8 bytes.
- `size_t` arguments/results are 32-bit (`malloc`, `memcpy`, `strlen`, `snprintf`'s `n`, ...).
- Exports with such types (101): `memcpy memmove memset memcmp memchr strncpy strncat strncmp
  strxfrm bcmp bcopy bzero strncasecmp strerror_r stpncpy strnlen strndup memmem memccpy strlcat
  strlcpy memrchr atol atoll strtol strtoul strtoll strtoull malloc calloc realloc aligned_alloc
  bsearch qsort labs llabs ldiv lldiv posix_memalign random memalign reallocarray qsort_r fseek
  ftell fread fwrite snprintf vsnprintf setvbuf fmemopen getdelim getline llrint llround lrint
  lround scalbln regexec regerror clock time difftime mktime strftime gmtime localtime ctime
  gmtime_r localtime_r ctime_r timegm lseek read write getcwd sbrk imaxabs strtoimax strtoumax
  lua_tointegerx lua_rawlen lua_pushinteger lua_pushlstring lua_geti lua_rawgeti
  lua_newuserdatauv lua_seti lua_rawseti lua_callk lua_pcallk lua_yieldk luaL_checkversion_
  luaL_checkinteger luaL_optinteger luaL_loadbufferx luaL_len luaL_prepbuffsize luaL_addlstring
  luaL_pushresultsize luaL_buffinitsize` (exact types: `SIGNATURES`).

## Varargs (wasm32 C ABI)

A variadic function takes one extra last argument: a pointer to a buffer holding the promoted
arguments in order, each at its natural alignment: `int`/`long`/pointer/`char`/`short` 4 bytes
(4-aligned); `long long`/`intmax_t` 8 bytes (8-aligned); `float`/`double` as double, 8 bytes
(8-aligned). A `va_list` is that same pointer. `long double` is not supported. `c.vaList(slots,
values)` lays one out on the stack; `c.call` builds it from the format string for the printf
family, the scanf family (every stored conversion is one pointer) and Lua's
`lua_pushfstring`/`lua_pushvfstring`/`luaL_error` (`%d %c %U` int, `%I` 64-bit, `%f` double,
`%s %p` pointer); other variadics (`open`, `fcntl`) take 32-bit values. For `v*` functions the
va_list argument may be an array of values, an object with `rest()` (js/rt/varargs.js
`VaList`), or a raw pointer.
