# js/vendor

`clib-lua.js` is vendored third-party runtime, machine-generated: the Lua 5.4.8 virtual machine
and standard libraries, and C library support from Emscripten (musl libc, dlmalloc,
compiler-rt), compiled to plain JavaScript (no WebAssembly) by Emscripten 6.0.13 and wasm2js.
It contains no game logic. Do not edit it; rebuild it with

    node tools/residue/build.mjs --verify

(see `tools/residue/README.md` for the toolchain pin, memory layout and calling rules).

    import { createClib } from "./vendor/clib-lua.js";
    const c = createClib({ now: () => Date.UTC(2026, 0, 1), long64: true });
    const s = c.format("%s has %ld points", "you", 1234);
    const L = c.fn.luaL_newstate();

## Licences

**Lua 5.4.8** — Copyright (C) 1994-2025 Lua.org, PUC-Rio.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software
and associated documentation files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**musl libc** — Copyright © 2005-2020 Rich Felker, et al. Released under the MIT licence (same
terms as above). **Emscripten** (its libc additions and runtime support) — Copyright 2010-2026
the Emscripten authors, MIT licence / University of Illinois/NCSA Open Source Licence.
**compiler-rt** — LLVM project, Apache License 2.0 with LLVM Exceptions.
**dlmalloc** — Doug Lea, released to the public domain
(http://creativecommons.org/publicdomain/zero/1.0/).
