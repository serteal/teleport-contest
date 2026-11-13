#!/usr/bin/env node
// tools/residue/build.mjs: build js/vendor/clib-lua.js, the vendored C runtime of the port.
//
// The module contains only third-party code: the Lua 5.4.8 VM and standard libraries, and the
// Emscripten C library (musl libc, dlmalloc, compiler-rt), compiled to plain JS with wasm2js,
// plus tools/residue/support.c (stdin/stdout/stderr addresses) and the JS glue in glue.js.
// It exports the fixed symbol list in exports.txt, so game-code changes never require a rebuild.
//
//   node tools/residue/build.mjs [--lua-dir DIR] [--global-base N] [--out FILE] [--work DIR]
//                                [--verify]
//
//   --lua-dir      lua-5.4.8 tree (default: $NHJS_LUA_DIR, else the tree tools/c2js
//                  (--configure) prepared under .cache/c2js/nethack-port/lib/lua-5.4.8)
//   --global-base  address of the module's static data (default 4194304 = 4 MiB); everything
//                  below it except the null guard [0, 1024) is left to the game's own statics
//   --out          output module (default js/vendor/clib-lua.js)
//   --work         scratch directory (default .cache/residue)
//   --verify       build a second time in a fresh scratch directory and require identical bytes
//
// Requires emcc EMCC_VERSION (checked): the one on PATH, or $EMCC.  SOURCE_DATE_EPOCH is
// pinned; the output is byte-identical across builds.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");

export const EMCC_VERSION = "6.0.13";
const SOURCE_DATE_EPOCH = "1735689600"; // 2025-01-01T00:00:00Z, any fixed value
const LUA_RELEASE = "5.4.8";

// Lua is compiled with the defines of its own Makefile (LUA_COMPAT_5_3) and NetHack's POSIX
// build (LUA_USE_POSIX), and these optimisation flags.
export const LUA_DEFINES = ["-DLUA_COMPAT_5_3", "-DLUA_USE_POSIX"];
const COMPILE_FLAGS = [
  "-O2", "-flto=thin",
  "-ffunction-sections", "-fdata-sections", "-fno-exceptions", "-fno-rtti",
  "-Wno-unused-command-line-argument",
];
const LUA_SOURCES = [
  // CORE_O and LIB_O of lua-5.4.8/src/Makefile (lua.c and luac.c are the stand-alone programs)
  "lapi", "lcode", "lctype", "ldebug", "ldo", "ldump", "lfunc", "lgc", "llex", "lmem", "lobject",
  "lopcodes", "lparser", "lstate", "lstring", "ltable", "ltm", "lundump", "lvm", "lzio",
  "lauxlib", "lbaselib", "lcorolib", "ldblib", "liolib", "lmathlib", "loadlib", "loslib",
  "lstrlib", "ltablib", "lutf8lib", "linit",
];
const STACK_SIZE = 1 << 20; // the C stack: 1 MiB (-sSTACK_SIZE=1MB)
const INITIAL_MEMORY = 16 << 20;

function linkFlags(globalBase, exports) {
  return [
    "-O2", "-flto=thin", "-g0", "--minify=0",
    "-sWASM=0", "-sENVIRONMENT=web", "-sMODULARIZE=1", "-sEXPORT_ES6=1",
    "-sDYNAMIC_EXECUTION=0", "-sASSERTIONS=0", "-sFILESYSTEM=0",
    "-sDISABLE_EXCEPTION_CATCHING=1", "-sSUPPORT_LONGJMP=emscripten",
    "-sALLOW_MEMORY_GROWTH=1", "-sALLOW_TABLE_GROWTH=1",
    `-sGLOBAL_BASE=${globalBase}`, `-sSTACK_SIZE=${STACK_SIZE}`, `-sINITIAL_MEMORY=${INITIAL_MEMORY}`,
    "-sEXIT_RUNTIME=0", "-sINVOKE_RUN=0", "--no-entry", "-sERROR_ON_UNDEFINED_SYMBOLS=1",
    `-sEXPORTED_FUNCTIONS=${exports.map((s) => "_" + s).join(",")}`,
    "-sEXPORTED_RUNTIME_METHODS=stackSave,stackRestore,stackAlloc",
    "-Wl,--gc-sections",
  ];
}

// ---- small helpers ---------------------------------------------------------------------------

function fail(msg) {
  console.error("residue: " + msg);
  process.exit(1);
}

// the Emscripten compiler driver
const EMCC = process.env.EMCC || "emcc";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 30, ...opts });
  if (r.error?.code === "ENOENT") fail(`${cmd} not found (put it on PATH${cmd === EMCC ? " or set EMCC" : ""})`);
  if (r.status !== 0) fail(`${cmd} ${args.slice(0, 6).join(" ")} ... failed:\n${r.stderr || r.stdout}`);
  return r.stdout;
}

function runAsync(cmd, args, opts) {
  return new Promise((ok, ko) => {
    const p = spawn(cmd, args, { ...opts, stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.stdout.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? ok() : ko(new Error(`${cmd} ${args.join(" ")}\n${err}`))));
  });
}

async function parallel(jobs, n) {
  const queue = [...jobs];
  await Promise.all(Array.from({ length: n }, async () => {
    while (queue.length) await queue.shift()();
  }));
}

const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function parseArgs(argv) {
  const a = { verify: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--verify") a.verify = true;
    else if (["--lua-dir", "--global-base", "--out", "--work"].includes(k)) a[k.slice(2)] = argv[++i];
    else fail("unknown argument " + k);
  }
  return a;
}

export function readExportList(file = join(here, "exports.txt")) {
  const names = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const s = line.replace(/#.*/, "").trim();
    if (s) names.push(s);
  }
  if (new Set(names).size !== names.length) fail("duplicate symbol in exports.txt");
  return names;
}

// ---- C signatures (from clang's AST of the public headers) -----------------------------------
// Code per value: v void, i int-like (32-bit, signed), u unsigned 32-bit, p pointer, j/J signed/
// unsigned 64-bit integer, f float, d double, V va_list, "." variadic tail (one pointer to the
// argument buffer).  A struct-returning function gets "S" as result and a leading "p" parameter
// (the caller-supplied result buffer, wasm32 C ABI).

const HEADERS = [
  "string.h", "strings.h", "ctype.h", "stdlib.h", "stdio.h", "math.h", "regex.h", "fnmatch.h",
  "time.h", "sys/time.h", "unistd.h", "fcntl.h", "sys/stat.h", "dirent.h", "inttypes.h", "errno.h",
  "malloc.h", "emscripten/stack.h", "lua.h", "lauxlib.h", "lualib.h",
];
// Not declared in a public header.
const MANUAL_SIGNATURES = {
  setThrew: "v:ii",
  emscripten_longjmp: "v:pi",
  clib_stdstream: "p:i",
  iprintf: "i:p.",
  siprintf: "i:pp.",
  fiprintf: "i:pp.",
  vfiprintf: "i:ppV",
};

function classify(type, typedefs, depth = 0) {
  const sugared = type.qualType;
  let t = (type.desugaredQualType ?? type.qualType).replace(/\b(const|volatile|restrict|__restrict)\b/g, " ").replace(/\s+/g, " ").trim();
  return classifyText(t, typedefs, sugared, depth);
}

function classifyText(t, typedefs, sugared = t, depth = 0) {
  t = t.replace(/\b(const|volatile|restrict|__restrict)\b/g, " ").replace(/\s+/g, " ").trim();
  if (/\b(va_list|__isoc_va_list|__builtin_va_list)\b/.test(sugared) && !/\*/.test(sugared)) return "V";
  if (/^(struct|union) /.test(t) && !/[*[]/.test(t)) return "S";
  if (/[*[(]/.test(t)) return "p";
  if (typedefs.has(t)) {
    if (depth > 20) fail("typedef loop at " + t);
    return classifyText(typedefs.get(t), typedefs, typedefs.get(t), depth + 1);
  }
  if (t === "__size_t") return "u"; // clang's predefined sugar for size_t
  if (t === "__ptrdiff_t" || t === "__signed_size_t") return "i";
  if (t === "void") return "v";
  if (t === "double") return "d";
  if (t === "float") return "f";
  if (t === "long double") return "L";
  if (/^(signed )?long long( int)?$/.test(t)) return "j";
  if (/^unsigned long long( int)?$/.test(t)) return "J";
  if (/^unsigned( (char|short|int|long))?( int)?$/.test(t)) return "u";
  if (/^(signed )?(char|short|int|long|_Bool)( int)?$/.test(t) || /^enum /.test(t)) return "i";
  fail("cannot classify C type '" + t + "'");
}

function returnTypeText(fnType) {
  // strip the trailing balanced parameter list
  let depth = 0;
  for (let i = fnType.length - 1; i >= 0; i--) {
    if (fnType[i] === ")") depth++;
    else if (fnType[i] === "(" && --depth === 0) return fnType.slice(0, i).trim();
  }
  fail("bad function type " + fnType);
}

function extractSignatures(names, astText) {
  const ast = JSON.parse(astText);
  const typedefs = new Map();
  const decls = new Map();
  for (const d of ast.inner ?? []) {
    if (d.kind === "TypedefDecl" && d.name) typedefs.set(d.name, d.type.desugaredQualType ?? d.type.qualType);
    if (d.kind === "FunctionDecl" && d.name && !decls.has(d.name)) decls.set(d.name, d);
  }
  const sigs = {};
  for (const name of names) {
    if (MANUAL_SIGNATURES[name]) { sigs[name] = MANUAL_SIGNATURES[name]; continue; }
    const d = decls.get(name);
    if (!d) fail("no prototype for exported symbol " + name + " (add it to MANUAL_SIGNATURES)");
    const params = (d.inner ?? []).filter((n) => n.kind === "ParmVarDecl").map((p) => classify(p.type, typedefs));
    const fnType = d.type.qualType;
    let ret = classifyText(returnTypeText(fnType), typedefs);
    if (params.includes("L") || ret === "L") fail(name + ": long double in signature is not supported");
    if (ret === "S") params.unshift("p");
    sigs[name] = ret + ":" + params.join("") + (/\.\.\.\)$/.test(fnType) ? "." : "");
  }
  return sigs;
}

function wasmArity(sig) {
  const p = sig.split(":")[1];
  let n = 0;
  for (const c of p) n += c === "j" || c === "J" ? 2 : 1;
  return n;
}

// ---- wasm2js output post-processing ----------------------------------------------------------

const SEGMENT = /^\s+([\w$]+)\(([\w$]+), (\d+(?:e\d+)?), "([A-Za-z0-9+/=]*)"\);$/;

function extractAsm(linked) {
  const lines = linked.split("\n");
  const a = lines.findIndex((l) => l.trim() === "// EMSCRIPTEN_START_ASM");
  const b = lines.findIndex((l) => l.trim() === "// EMSCRIPTEN_END_ASM");
  if (a < 0 || b < a) fail("wasm2js block not found in the link output");
  const asm = lines.slice(a + 1, b);
  if (!/^function instantiate\(\w+\) \{$/.test(asm[0])) fail("unexpected wasm2js prologue: " + asm[0]);

  // data segments: the one function made only of decoder calls
  const first = asm.findIndex((l, i) => SEGMENT.test(l) && /^  function \w+\(\w*\) \{$/.test(asm[i - 1]));
  if (first < 0) fail("data segment initialiser not found");
  let last = first;
  while (SEGMENT.test(asm[last + 1])) last++;
  if (asm[last + 1] !== "  }") fail("data segment initialiser has unexpected shape");
  const segments = [];
  let target = null;
  for (let i = first; i <= last; i++) {
    const m = asm[i].match(SEGMENT);
    target ??= m[2];
    if (m[2] !== target) fail("data segments target two arrays");
    segments.push([Number(m[3]), Buffer.from(m[4], "base64")]);
  }
  asm.splice(first, last - first + 1, `    loadImage(${target});`);

  // namespaces and import names
  const text = asm.join("\n");
  const envVar = text.match(/var ([\w$]+) = [\w$]+\.env;/)?.[1];
  const wasiVar = text.match(/var ([\w$]+) = [\w$]+\.wasi_snapshot_preview1;/)?.[1];
  if (!envVar) fail("import namespace not found");
  const esc = (s) => s.replace(/\$/g, "\\$");
  const importsOf = (ns) => [...text.matchAll(new RegExp(`var [\\w$]+ = ${esc(ns)}\\.(\\w+);`, "g"))].map((m) => m[1]);
  const imports = importsOf(envVar);
  const wasiImports = wasiVar ? importsOf(wasiVar) : [];

  // exports: "name: ident," lines of the returned object, and arity of each ident
  const arity = new Map();
  for (const m of text.matchAll(/^function ([\w$]+)\(([^)]*)\) \{$/gm)) arity.set(m[1], m[2].trim() ? m[2].split(",").length : 0);
  const exportsAt = asm.findIndex((l) => l === "    return {");
  const exported = new Map();
  for (let i = exportsAt + 1; i < asm.length && asm[i] !== "    };"; i++) {
    const m = asm[i].match(/^      ([\w$]+): ([\w$]+),?$/);
    if (m) exported.set(m[1], m[2]);
  }
  return { asm, segments, imports, wasiImports, exported, arity };
}

// Data image: contiguous byte runs, each line 64 bytes written as two characters per byte from
// the set "0".."9" ":" ";" "<" "=" ">" "?" (char code 48 + nibble), so the text has no letters
// and cannot match a word search.
function encodeImage(segments) {
  segments.sort((x, y) => x[0] - y[0]);
  const runs = [];
  for (const [addr, bytes] of segments) {
    const prev = runs[runs.length - 1];
    if (prev && addr - (prev[0] + prev[1].length) <= 32 && addr >= prev[0] + prev[1].length) {
      prev[1] = Buffer.concat([prev[1], Buffer.alloc(addr - (prev[0] + prev[1].length)), bytes]);
    } else runs.push([addr, bytes]);
  }
  const out = [];
  let total = 0;
  for (const [addr, bytes] of runs) {
    out.push(`  ${addr},`);
    total += bytes.length;
    for (let i = 0; i < bytes.length; i += 64) {
      let s = "";
      for (const b of bytes.subarray(i, i + 64)) s += String.fromCharCode(48 + (b >> 4), 48 + (b & 15));
      out.push(`  "${s}",`);
    }
  }
  return { lines: out, total, runs: runs.length };
}

// The minified code uses short names (a, d, u, an, gl, ...) that also exist in the game's C
// source, so a text search for a game function such as d( or An( would land here.  Every
// identifier of the compiled code gets a "$" suffix; C identifiers never contain "$".
const JS_NAMES = new Set(("break case catch const continue default delete do else false finally for function if in " +
  "instanceof let new null of return switch this throw true try typeof var void while arguments undefined Infinity " +
  "NaN Math Object Error ArrayBuffer Int8Array Int16Array Int32Array Uint8Array Uint16Array Uint32Array " +
  "Float32Array Float64Array instantiate loadImage memory grow value buffer get set length").split(" "));

function suffixIdentifiers(src, keep) {
  const tokens = new Set(src.match(/[A-Za-z_$][\w$]*/g));
  let out = "", i = 0, renamed = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
    } else if (c === "/" && src[i + 1] === "/") {
      const j = src.indexOf("\n", i);
      out += src.slice(i, j < 0 ? n : j);
      i = j < 0 ? n : j;
    } else if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w$]/.test(src[j])) j++;
      const id = src.slice(i, j);
      const prop = i > 0 && src[i - 1] === ".";
      if (prop || keep.has(id) || JS_NAMES.has(id)) out += id;
      else {
        if (tokens.has(id + "$")) fail("rename collision: " + id + "$");
        out += id + "$";
        renamed++;
      }
      i = j;
    } else if (/[0-9]/.test(c)) {
      let j = i + 1;
      while (j < n && /[\w.]/.test(src[j])) j++; // numbers such as 423e4, 1.5, 0x10
      out += src.slice(i, j);
      i = j;
    } else {
      out += c;
      i++;
    }
  }
  return { text: out, renamed };
}

// ---- the build -------------------------------------------------------------------------------

async function buildOnce({ luaDir, globalBase, out, work }) {
  rmSync(work, { recursive: true, force: true });
  const srcDir = join(work, "src");
  const objDir = join(work, "obj");
  mkdirSync(srcDir, { recursive: true });
  mkdirSync(objDir, { recursive: true });

  // sources: copy to a fixed relative layout so no absolute path can reach the output
  const luaFiles = readdirSync(join(luaDir, "src")).filter((f) => /\.[ch]$/.test(f)).sort();
  for (const f of luaFiles) cpSync(join(luaDir, "src", f), join(srcDir, f));
  cpSync(join(here, "support.c"), join(srcDir, "support.c"));
  const luaHash = sha256(luaFiles.filter((f) => f.endsWith(".h") || LUA_SOURCES.includes(f.slice(0, -2)))
    .map((f) => f + "\0" + readFileSync(join(srcDir, f), "latin1")).join("\0"));

  const env = { ...process.env, SOURCE_DATE_EPOCH, ZERO_AR_DATE: "1" };
  const units = [...LUA_SOURCES, "support"];
  await parallel(units.map((u) => () => runAsync(EMCC, [...COMPILE_FLAGS, ...LUA_DEFINES,
    `-ffile-prefix-map=${srcDir}=.`, "-c", `${u}.c`, "-o", join(objDir, `${u}.o`)], { cwd: srcDir, env })),
  Math.max(2, Math.min(cpus().length, 12)));

  const names = readExportList();
  const linked = join(work, "link.mjs");
  run(EMCC, [...units.map((u) => join(objDir, `${u}.o`)), ...linkFlags(globalBase, names), "-o", linked], { cwd: work, env });

  // signatures
  writeFileSync(join(srcDir, "headers.c"), "#define _GNU_SOURCE\n" + HEADERS.map((h) => `#include ${h.startsWith("l") ? `"${h}"` : `<${h}>`}\n`).join(""));
  const ast = run(EMCC, [...LUA_DEFINES, "-fsyntax-only", "-Xclang", "-ast-dump=json", "headers.c"], { cwd: srcDir, env });
  const sigs = extractSignatures(names, ast);

  // public Lua API completeness
  const api = new Set();
  for (const h of ["lua.h", "lauxlib.h", "lualib.h"]) {
    const text = readFileSync(join(srcDir, h), "utf8").replace(/\n(?=\s)/g, " ");
    for (const m of text.matchAll(/^(?:LUA_API|LUALIB_API|LUAMOD_API)\b[^;]*?\(?\s*\*?\s*\(?(lua[A-Za-z0-9_]*)\)?\s*\(/gm)) {
      if (/^lua[A-Za-z]*_[a-z]/.test(m[1])) api.add(m[1]); // not lua_Integer & co. (types)
    }
  }
  const missingApi = [...api].filter((n) => !names.includes(n));
  if (missingApi.length) fail("exports.txt lacks public Lua API functions: " + missingApi.join(" "));

  const asmParts = extractAsm(readFileSync(linked, "utf8"));
  const missing = names.filter((n) => !asmParts.exported.has(n));
  if (missing.length) fail("not exported by the link: " + missing.join(" "));
  for (const n of names) {
    const got = asmParts.arity.get(asmParts.exported.get(n));
    if (got !== undefined && got !== wasmArity(sigs[n])) fail(`${n}: signature ${sigs[n]} has ${wasmArity(sigs[n])} wasm parameters, module has ${got}`);
  }
  for (const n of ["memory", "__indirect_function_table", "__wasm_call_ctors", "_emscripten_stack_restore",
    "_emscripten_stack_alloc", "_emscripten_tempret_set", "__get_temp_ret", "setThrew"]) {
    if (!asmParts.exported.has(n) && n !== "memory" && n !== "__indirect_function_table") fail("runtime export missing: " + n);
  }
  const lowest = Math.min(...asmParts.segments.map((s) => s[0]));
  if (lowest < globalBase) fail(`data below GLOBAL_BASE at ${lowest}`);

  const image = encodeImage(asmParts.segments);
  const emccVersion = run(EMCC, ["--version"]).split("\n")[0];
  const glue = readFileSync(join(here, "glue.js"), "utf8");
  const body = asmParts.asm
    .filter((l) => !/^\/\/ EMSCRIPTEN_(START|END)_FUNCS$/.test(l.trim()))
    .map((l) => l.replace(/^\s+/, (ws) => " ".repeat(Math.min(ws.length, 2))))
    .join("\n");
  const keep = new Set([...asmParts.exported.keys(), ...asmParts.imports, ...asmParts.wasiImports]);
  const { text: renamedBody, renamed } = suffixIdentifiers(body, keep);
  const build = {
    emcc: emccVersion.replace(/^emcc \([^)]*\) /, ""),
    lua: LUA_RELEASE,
    luaDefines: LUA_DEFINES.join(" "),
    luaSourcesSha256: luaHash,
    globalBase,
    stackSize: STACK_SIZE,
    initialMemory: INITIAL_MEMORY,
  };
  const sigLines = Object.keys(sigs).sort().map((n) => `  ${n}: "${sigs[n]}",`);
  const text = [
    "// clib-lua.js: vendored third-party runtime, machine-generated by tools/residue/build.mjs.",
    "// Do not edit; rebuild with `node tools/residue/build.mjs` (see js/vendor/README.md).",
    "//",
    "// Contents: the Lua " + LUA_RELEASE + " virtual machine and standard libraries (MIT licence,",
    "// Lua.org, PUC-Rio) and C library support from Emscripten " + EMCC_VERSION + " (musl libc, dlmalloc,",
    "// compiler-rt; MIT-style licences), compiled to JavaScript by wasm2js.  Not game logic.",
    "//",
    "// Lua flags: " + LUA_DEFINES.join(" ") + ", " + COMPILE_FLAGS.slice(0, 2).join(" ") + ".  emcc: " + build.emcc,
    "// Usage: import { createClib } from \"./clib-lua.js\"; const c = createClib({ now: () => ms });",
    "//        c.call(\"snprintf\", buf, n, \"%d %s\", 42, \"x\"); c.fn.lua_newstate(...);  (glue at the end)",
    "",
    "export const BUILD = Object.freeze(" + JSON.stringify(build) + ");",
    "",
    "// Imports the compiled code needs (provided by createClib below).",
    "const IMPORTS = " + JSON.stringify(asmParts.imports.filter((n) => !asmParts.wasiImports.includes(n))) + ";",
    "const WASI_IMPORTS = " + JSON.stringify(asmParts.wasiImports) + ";",
    "",
    "// ---- compiled code (wasm2js) ---------------------------------------------------------------",
    "",
    renamedBody,
    "",
    "// C signatures of the exported functions (codes: see tools/residue/README.md).",
    "export const SIGNATURES = Object.freeze({",
    ...sigLines,
    "});",
    "",
    glue.trimEnd(),
    "",
    "// ---- static data image (" + image.total + " bytes, " + image.runs + " runs) ---------------------------------",
    "// A number starts a run at that address; each string holds bytes as two characters",
    "// 48 + high nibble, 48 + low nibble.",
    "",
    "function loadImage(u8) {",
    "  let at = 0;",
    "  for (const x of IMAGE) {",
    "    if (typeof x === \"number\") { at = x; continue; }",
    "    for (let k = 0; k < x.length; k += 2) u8[at++] = ((x.charCodeAt(k) - 48) << 4) | (x.charCodeAt(k + 1) - 48);",
    "  }",
    "}",
    "",
    "const IMAGE = [",
    ...image.lines,
    "];",
    "",
  ].join("\n");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  writeFileSync(join(work, "signatures.json"), JSON.stringify(sigs, null, 1));
  return { text, sigs, imports: asmParts.imports, image, build };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const version = run(EMCC, ["--version"]).split("\n")[0];
  if (!version.includes(" " + EMCC_VERSION)) fail(`emcc ${EMCC_VERSION} required, found: ${version}`);
  const luaDir = resolve(a["lua-dir"] ?? process.env.NHJS_LUA_DIR ?? join(repo, ".cache/c2js/nethack-port/lib/lua-5.4.8"));
  const luaH = join(luaDir, "src/lua.h");
  if (!existsSync(luaH)) fail("Lua sources not found at " + luaDir + " (use --lua-dir or NHJS_LUA_DIR)");
  if (!/#define LUA_VERSION_RELEASE\s+"8"/.test(readFileSync(luaH, "utf8"))) fail("Lua " + LUA_RELEASE + " required");
  const globalBase = Number(a["global-base"] ?? 4194304);
  if (!(globalBase >= 65536 && globalBase % 65536 === 0)) fail("--global-base must be a multiple of 65536");
  const out = resolve(a.out ?? join(repo, "js/vendor/clib-lua.js"));
  const work = resolve(a.work ?? join(repo, ".cache/residue"));

  const t0 = Date.now();
  const r = await buildOnce({ luaDir, globalBase, out, work: join(work, "a") });
  const bytes = Buffer.byteLength(r.text);
  const lines = r.text.split("\n").length - 1;
  const longest = Math.max(...r.text.split("\n").map((l) => l.length));
  console.log(`wrote ${out}: ${bytes} bytes, ${lines} lines, longest line ${longest}, sha256 ${sha256(r.text)}`);
  console.log(`  ${Object.keys(r.sigs).length} exported functions, imports: ${r.imports.join(" ")}`);
  console.log(`  data image ${r.image.total} bytes in ${r.image.runs} runs; built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (a.verify) {
    const second = join(work, "verify.js");
    const r2 = await buildOnce({ luaDir, globalBase, out: second, work: join(work, "b") });
    if (r2.text !== r.text) fail(`second build differs: ${sha256(r.text)} vs ${sha256(r2.text)}`);
    console.log(`  verified: second build in a fresh directory is byte-identical (sha256 ${sha256(r2.text)})`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
