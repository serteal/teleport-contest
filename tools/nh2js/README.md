# nh2js: NetHack C -> readable JS that mirrors the C

    node --stack-size=8000 tools/nh2js/cli.mjs all --out js --headers [--src <prepared tree>] [--prepare] \
         [--report r.json] [--manifest m.json] [--sites s.json] [--checked] [--fallback] [--stats]
    node tools/nh2js/lint-numbers.mjs          # numbers on emitted lines their C line does not write
    node tools/nh2js/lint-truth.mjs js/src     # C truth values returned as bare JS booleans

`all` = every unit of the game (tools/c2js source-manifest.json): src/, win/tty, sys/share,
sys/unix, the port's host C (tools/c2js/host -> js/sys/c2js), plus js/libc/records.js, js/dat/
and js/modules.js. Without `--src` the tree is prepared by tools/c2js `--configure` into
.cache/nh2js/c2js (build date pinned). `--checked` adds range assertions (dev only),
`--fallback` prints every function in the plain dialect (tests), `--sites` writes every rule
instance (rule audit). To check a change to the rewriter, emit into a directory outside the
repository (`--out /some/dir/js --manifest /some/dir/manifest.json`) and diff it against `js/`.

`--src` is a configured, patched, long64 NetHack tree as tools/c2js prepares it
(`node tools/c2js/build-engine.mjs --configure`).

Output:
- one unit module per C file: `js/src/<f>.js`, `js/win/tty/<f>.js`, `js/sys/{share,unix,c2js}/<f>.js`;
- per NetHack header `include/<h>.h`, with `--headers`: `js/src/<h>.h.js` (structs, enums,
  constants) and `js/src/<h>.h.macros.js` (function-like macros as functions); a comment of the
  header goes to the one with the code it is on or before;
- `js/libc/records.js` (the C library's records and typedefs the game uses by value),
  `js/dat/<name>.js` + `js/dat/index.js` (the game's data files, one template literal each),
  `js/modules.js` (every module as an import, in evaluation order: the types layer first).

How a module is made: the rules print it line for line with its C file (line N of the JS is
line N of the C, which the placement of local macros, tables and comments relies on); then
`lib/layout.mjs` lays it out as written: a line break the printer adds (`LINE_BREAK`, e.g. the
code a function body starts with) becomes a real one, trailing whitespace goes, runs of blank
lines become one blank line (none at the start of the file, after a line opening a block or
before one closing it), and a skipped `#if` block of 10+ lines becomes one
`/* #ifdef X: not in this build */` line. Template literals, `\`-continued strings and block
comments are never changed. So an emitted module is shorter than its C file; the manifest's
`lineMaps` give, per unit module, the C line of each JS line (runs `[jsLine, cLine, count]`,
0-based; `lib/layout.mjs` decodeMap). Imports follow the code: one statement per module, names
sorted.

Tools: the front end needs an LLVM install with libclang-cpp and the Emscripten sysroot.
- LLVM: `LLVM_PREFIX` (the directory with `bin/clang` and `lib/libclang-cpp`), else the prefix
  `llvm-config --prefix` reports, else the package manager's `llvm`; an error names
  `LLVM_PREFIX` when none is found.
- Sysroot: `EMSYSROOT`, else `$(em-config CACHE)/sysroot`; an error names `EMSYSROOT` when none
  is found.

Pieces:
- `clang/nh2js-ast.cpp`: the front end (LibTooling; `clang/build.sh`, built on demand into
  `.cache/nh2js/`). Parses for wasm32 (Emscripten sysroot, the port's defines,
  `-DRNGLOG_IN_RND_C -D_FORTIFY_SOURCE=0`) and dumps types, layouts, enums,
  typedefs, macros, macro invocations and macro-aware node locations as JSON (cached per content).
- `frontend.mjs`: finds the tools, runs the front end, caches the JSON.
- `lib/printer.mjs`: `FunctionPrinter` and `NODE_PRINTERS`, one printer per Clang node kind;
  identity rules splice the C text, others synthesize. Every node must be claimed by a rule
  listed in `lib/rules.mjs`, else the function falls back to the plain AST printer; a function
  neither can print is reported (`mode: none`).
- `lib/macros.mjs`: which macro invocations stay calls (see the rules at the top of the file).
- `lib/gotos.mjs`: goto lowering (labeled blocks, labeled loops, re-enterable regions).
- `lib/range.mjs`: value ranges deciding where integer wraps are needed.
- `lib/emit.mjs`, `lib/headers.mjs`: module layout, imports, header modules.
- `lib/layout.mjs`: the final layout of a module and its line map.
- `lib/dat.mjs`: js/dat/ (each data file one template literal; index.js installs them).
- `lib/index.mjs`: program-wide facts (which file defines each function/global; prototypes).
- `lib/units.mjs`: the C units of the game and the module path of each.
- `layouts.mjs`: the compiler's record layouts, to check `js/` struct declarations against.

The report (`--report`) has, per function, the mode and the reasons for any fallback, and per
rule the number of instances and up to 25 sites (`rules`), plus macro decisions (`macros`,
`rejected`, `rejectedBy`, `macroConflicts`). Rarely used rules are the ones to audit.

Tests: `node --test test/nh2js/`.
