// lib/index.mjs: program-wide facts gathered from every C file (which file defines each
// function and global, all prototypes) so a module knows where to import names from.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadTU, cacheDir } from "../frontend.mjs";
import { allUnits, unitPath } from "./units.mjs";

/** Where the index of a source tree is cached (one per tree). */
export function indexPath(srcDir) {
  return path.join(
    cacheDir,
    `index-${createHash("sha1").update(path.resolve(srcDir)).digest("hex").slice(0, 12)}.json`,
  );
}

/** Every C unit of the game (src/*.c and the port files), see lib/units.mjs. */
export function cFiles(srcDir) { return allUnits(srcDir); }

/** {functions: name -> file, globals: name -> {file, static}, protos: name -> proto} */
export function buildIndex(srcDir, files = cFiles(srcDir), { quiet = true } = {}) {
  const stampFile = indexPath(srcDir);
  // (the facts depend on the front end and the sources: key on both)
  const h = createHash("sha1").update(JSON.stringify(files) + srcDir);
  const bin = path.join(cacheDir, "nh2js-ast");
  if (fs.existsSync(bin)) h.update(fs.readFileSync(bin));
  h.update(fs.readFileSync(new URL(import.meta.url)));
  for (const f of files) {
    try {
      const st = fs.statSync(unitPath(srcDir, f));
      h.update(`${f}:${st.size}:${st.mtimeMs}`);
    } catch {
      h.update(f);
    }
  }
  const key = h.digest("hex");
  if (fs.existsSync(stampFile)) {
    const j = JSON.parse(fs.readFileSync(stampFile, "utf8"));
    if (j.key === key) return j;
  }
  const functions = {}, globals = {}, protos = {}, failed = [], staticFiles = {};
  const effect = new Map(); // name -> {writes, indirect, calls:Set}
  for (const f of files) {
    let tu;
    try { tu = loadTU(srcDir, f); } catch (e) { failed.push([f, String(e.message).slice(0, 200)]); continue; }
    if (!quiet) process.stderr.write(".");
    for (const d of tu.decls) {
      if (d.k === "Function" && d.body) {
        if (!functions[d.name]) functions[d.name] = { file: f, static: d.static };
        effects(d, effect);
      }
      if (d.k === "Var" && d.fileScope && d.isDef) {
        const t = tu.types[d.t];
        const desc = typeDesc(tu, d.t);
        if (!globals[d.name]) globals[d.name] = { file: f, static: d.sc === "static", type: desc };
        // (a static name defined by several files: each its own object)
        if (d.sc === "static") (staticFiles[d.name] ||= []).includes(f) || staticFiles[d.name].push(f);
      }
    }
    for (const p of tu.protos) {
      if (!protos[p.name])
        protos[p.name] = {
          name: p.name,
          type: tu.types[p.t],
          pn: p.pn,
          ptn: p.ptn,
          retn: p.retn,
          fmt: p.fmt,
          fa: p.fa,
          sig: sigOf(tu, p.t),
          lib: libOf(p.file),
        };
    }
  }
  // pure functions (no store outside their own locals, no indirect call, only pure callees):
  // a macro argument calling one may be evaluated once instead of several times (glyph_at)
  const pure = new Set();
  for (const [n, e] of effect) if (!e.writes && !e.indirect) pure.add(n);
  for (let changed = true; changed;) {
    changed = false;
    for (const n of [...pure])
      for (const c of effect.get(n).calls)
        if (!pure.has(c) && !(!effect.has(c) && PURE_LIBC.has(c))) {
          pure.delete(n);
          changed = true;
          break;
        }
  }
  for (const n of pure) if (functions[n]) functions[n].pure = 1;
  const out = { key, functions, globals, protos, failed, staticFiles };
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(stampFile, JSON.stringify(out));
  return out;
}

/** Which library declares a function: "libc" (the C library headers), "lua", or "port". */
function libOf(file) {
  if (!file) return "port";
  if (/(^|\/)lib\/lua-[\d.]+\/src\//.test(file)) return "lua";
  if (/^\.\.\/include\/|^\.\.\/(win|sys)\/|tools\/c2js\/host\//.test(file) || !file.startsWith("/")) return "port";
  return "libc";
}

const PURE_LIBC = new Set([
  "strlen",
  "strcmp",
  "strncmp",
  "strchr",
  "strrchr",
  "strstr",
  "memcmp",
  "abs",
  "labs",
  "isdigit",
  "isalpha",
  "isalnum",
  "isupper",
  "islower",
  "isspace",
  "ispunct",
  "isprint",
  "toupper",
  "tolower",
  "atoi",
  "atol",
]);

/** What a function body does that a macro argument evaluated once instead of twice could see. */
function effects(d, effect) {
  const e = effect.get(d.name) || { writes: false, indirect: false, calls: new Set() };
  effect.set(d.name, e);
  const isLocal = (m) => {
    while (m && (m.k === "ParenExpr" || m.k === "ImplicitCastExpr")) m = m.c[0];
    return m && m.k === "DeclRefExpr" && (m.dk === "local" || m.dk === "param");
  };
  const walk = (n) => {
    if (!n || typeof n !== "object") return;
    if (
      (n.k === "BinaryOperator" && n.op === "=") ||
      n.k === "CompoundAssignOperator" ||
      (n.k === "UnaryOperator" && (n.op === "++" || n.op === "--"))
    )
      if (!isLocal(n.c[0])) e.writes = true;
    if (n.k === "CallExpr") { if (n.callee) e.calls.add(n.callee); else e.indirect = true; }
    if (n.k === "DeclRefExpr" && n.dk === "static-local") e.writes = true; // (state: be conservative)
    for (const c of n.c || []) walk(c);
    if (n.decls) for (const x of n.decls) { if (x.staticLocal) e.writes = true; walk(x.init); }
  };
  walk(d.body);
}

export function typeDesc(tu, id) { return descOf(tu, id, 0); }

function descOf(tu, id, depth) {
  const T = tu.types, t = T[id];
  const d = { k: t.k, s: t.s };
  if (t.size !== undefined) d.size = t.size;
  if (t.signed !== undefined) d.signed = t.signed;
  if (t.k === "rec") { d.rec = t.rec; d.cls = className(tu, t.rec); }
  if (t.k === "ptr" && depth < 4) d.to = descOf(tu, t.to, depth + 1);
  if (t.k === "arr" && depth < 4) { d.of = descOf(tu, t.of, depth + 1); d.n = t.n; }
  if (t.k === "fn" && depth < 4) {
    d.ret = descOf(tu, t.ret, depth + 1);
    d.params = t.params.map((p) => descOf(tu, p, depth + 1));
    d.va = t.va;
  }
  return d;
}

function className(tu, rec) {
  const r = tu.records.find((x) => x.name === rec);
  if (!r) return `struct_${rec}`;
  if (r.tag) return `struct_${r.tag}`.replace(/^struct_(__anon)/, "$1");
  if (r.typedef) return r.typedef;
  return `struct_${rec}`;
}

// portable signature: {ret, params: [..], va} with each type as {k, size, signed, rec, to}
export function sigOf(tu, tid) {
  const T = tu.types;
  const desc = (id, depth = 0) => {
    const t = T[id];
    const d = { k: t.k, s: t.s };
    if (t.size !== undefined) d.size = t.size;
    if (t.signed !== undefined) d.signed = t.signed;
    if (t.k === "rec") { d.rec = t.rec; d.cls = className(tu, t.rec); }
    if (t.k === "ptr" && depth < 3) d.to = desc(t.to, depth + 1);
    if (t.k === "arr" && depth < 3) { d.of = desc(t.of, depth + 1); d.n = t.n; }
    if (t.k === "fn" && depth < 3) {
      d.ret = desc(t.ret, depth + 1);
      d.params = t.params.map((p) => desc(p, depth + 1));
      d.va = t.va;
    }
    return d;
  };
  const t = T[tid];
  if (t.k !== "fn") return null;
  return { ret: desc(t.ret), params: t.params.map((p) => desc(p)), va: t.va };
}
