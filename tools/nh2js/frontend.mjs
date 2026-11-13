// frontend.mjs: run the libclang front end (clang/nh2js-ast) on one C file and load its facts.
//
// The C is parsed for wasm32-unknown-emscripten (the layout js/rt implements), from the
// patched and long64-transformed source, with the port's defines, plus -DRNGLOG_IN_RND_C
// (rn2() etc. are plain calls, not the logging macros) and -D_FORTIFY_SOURCE=0 (strcpy etc.
// are plain functions).
//
// Tools: an LLVM install with libclang-cpp (LLVM_PREFIX, else `llvm-config --prefix`, else the
// package manager's llvm) and the Emscripten sysroot (EMSYSROOT, else `em-config CACHE`/sysroot).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unitPath, unitArgs, hostDir } from "./lib/units.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../..");
export const cacheDir = path.join(repoRoot, ".cache/nh2js");
/** The fixed build date (__DATE__, the prepared tree's date.h): emitted text never depends on the day. */
export const SOURCE_DATE_EPOCH = "1767225600";

/** First line of a command's output, or "" when it is not available. */
function probe(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim().split("\n")[0] : "";
}

let llvmPrefix = null;
/** The LLVM install the front end is built against and parses with. */
export function llvm() {
  llvmPrefix ??= process.env.LLVM_PREFIX || process.env.LLVM || probe("llvm-config", ["--prefix"]) ||
    probe("brew", ["--prefix", "llvm"]);
  if (!llvmPrefix || !fs.existsSync(path.join(llvmPrefix, "bin/clang"))) {
    throw new Error("nh2js: no LLVM found; set LLVM_PREFIX to an LLVM install with libclang-cpp " +
      "(the directory holding bin/clang and lib/libclang-cpp)");
  }
  return llvmPrefix;
}

let emSysroot = null;
/** The Emscripten sysroot the C is parsed against (its headers define the wasm32 C library). */
function sysroot() {
  if (!emSysroot) {
    const cache = process.env.EMSYSROOT ? "" : probe("em-config", ["CACHE"]);
    emSysroot = process.env.EMSYSROOT || (cache && path.join(cache, "sysroot"));
  }
  if (!emSysroot || !fs.existsSync(path.join(emSysroot, "include"))) {
    throw new Error("nh2js: no Emscripten sysroot found; set EMSYSROOT (`em-config CACHE`/sysroot) " +
      "or put em-config on PATH");
  }
  return emSysroot;
}

export const nethackDefines = [
  "-DLUA_USE_POSIX", "-DANSI_DEFAULT", "-DNHJS_PORT",
  "-DNO_TERMCAP_HEADERS", "-DNO_TIMED_DELAY", "-DNOTPARMDECL",
  '-DPORT_ID="MacOS"', "-DRNGLOG_IN_RND_C", "-D_FORTIFY_SOURCE=0",
];

function resourceDir() {
  const r = spawnSync(path.join(llvm(), "bin/clang"), ["-print-resource-dir"], { encoding: "utf8" });
  return r.stdout.trim();
}

export function clangArgs() {
  return [
    "-target", "wasm32-unknown-emscripten", `--sysroot=${sysroot()}`,
    "-Xclang", "-iwithsysroot/include/fakesdl", "-Xclang", "-iwithsysroot/include/compat",
    "-resource-dir", resourceDir(),
    "-I../include", "-I../lib/lua-5.4.8/src", ...nethackDefines, "-O0", "-fsyntax-only",
  ];
}

function tool() {
  const bin = path.join(cacheDir, "nh2js-ast");
  const src = path.join(here, "clang/nh2js-ast.cpp");
  if (!fs.existsSync(bin) || fs.statSync(bin).mtimeMs < fs.statSync(src).mtimeMs) {
    const r = spawnSync(path.join(here, "clang/build.sh"), [], {
      encoding: "utf8",
      env: { ...process.env, OUT: bin, LLVM_PREFIX: llvm() },
    });
    if (r.status !== 0) throw new Error("building nh2js-ast failed:\n" + r.stderr + r.stdout);
  }
  return bin;
}

/** Facts for srcDir/src/<file>: {main, decls, protos, records, enums, types, invs, macros, skipped, files, text}. */
export function loadTU(srcDir, file) {
  // file: a unit key (lib/units.mjs): "allmain.c", "../win/tty/wintty.c", "../sys/c2js/nhjs_host.c"
  const cwd = path.join(srcDir, "src");
  const cpath = unitPath(srcDir, file);
  const text = fs.readFileSync(cpath, "latin1");
  const ua = unitArgs(file);
  // __FILE__ as the compile sees it (no local paths in js/): "dig.c" for src/, "../win/tty/wintty.c"
  // for the port files (both compiled from src/ with relative paths), "../sys/c2js/nhjs_host.c"
  // for our host C (clang applies the longest matching prefix)
  const root = path.resolve(srcDir);
  const prefixMap = [
    `-fmacro-prefix-map=${root}/src/=`,
    `-fmacro-prefix-map=${root}/=../`,
    `-fmacro-prefix-map=${hostDir}/=../sys/c2js/`,
  ];
  const args = [...clangArgs().filter((a) => !ua.drop.includes(a)), ...ua.add, ...prefixMap];
  const bin = tool();
  const key = createHash("sha1").update(text).update(JSON.stringify(args)).update(fs.readFileSync(bin))
    .update(includeStamp(srcDir)).update("epoch=" + SOURCE_DATE_EPOCH).digest("hex").slice(0, 16);
  const base = file.replace(/^(\.\.\/)+/, "").replace(/\//g, "_");
  const cached = path.join(cacheDir, "ast", `${base}.${key}.json`);
  let raw;
  if (fs.existsSync(cached)) raw = fs.readFileSync(cached, "utf8");
  else {
    const arg =
      cpath.startsWith(cwd + path.sep) || (file.startsWith("../") && !file.startsWith("../sys/c2js/")) ? file : cpath;
    // __DATE__/__TIME__ pinned (clang honours SOURCE_DATE_EPOCH), the prepared tree's epoch: the
    // facts, and so js/, never depend on when they were extracted
    const r = spawnSync(bin, [arg, "--", ...args], {
      cwd,
      encoding: "utf8",
      maxBuffer: 1 << 30,
      env: { ...process.env, SOURCE_DATE_EPOCH: SOURCE_DATE_EPOCH },
    });
    if (r.status !== 0 || !r.stdout.startsWith("{"))
      throw new Error(`nh2js-ast ${file} failed: ${r.stderr.slice(0, 2000)}`);
    raw = r.stdout;
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    for (const old of fs.readdirSync(path.dirname(cached)))
      if (old.startsWith(base + ".") && old.split(".").length === base.split(".").length + 2)
        fs.rmSync(path.join(path.dirname(cached), old));
    fs.writeFileSync(cached, raw);
  }
  const tu = JSON.parse(raw);
  tu.file = file;
  tu.text = text;
  tu.srcDir = srcDir;
  // file index of the main file (index 0) and of headers by basename
  tu.fileNames = tu.files.map((f) => path.basename(f));
  tu.invById = new Map(tu.invs.map((v) => [v.x, v]));
  tu.typeById = tu.types;
  tu.recByName = new Map(tu.records.map((r) => [r.name, r]));
  tu.macroByName = new Map();
  for (const m of tu.macros) tu.macroByName.set(m.name, m); // last definition wins (as the TU ends)
  return tu;
}

let stampCache = new Map();
function includeStamp(srcDir) {
  if (stampCache.has(srcDir)) return stampCache.get(srcDir);
  const h = createHash("sha1");
  const inc = path.join(srcDir, "include");
  for (const f of fs.readdirSync(inc).sort()) h.update(f).update(fs.readFileSync(path.join(inc, f)));
  const s = h.digest("hex");
  stampCache.set(srcDir, s);
  return s;
}
