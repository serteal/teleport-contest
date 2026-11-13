// lib/headers.mjs: one NetHack header -> its header modules, printed line for line with the
// header, then laid out by lib/layout.mjs.
//
// Each header include/<h>.h gives two modules:
//   js/src/<h>.h.js         structs/unions (one field per line), enum constants, constant
//                           macros. Imports only other header modules and rt/, so it is always
//                           fully evaluated before any unit module reads it.
//   js/src/<h>.h.macros.js  function-like and expression macros as same-named functions.
//                           May import unit modules (macro bodies call game functions).
// As printed, line N of both modules is line N of the header. A comment of the header goes to
// one of them: with its code, or with the code that follows it. emitLibc() writes
// js/libc/records.js, the C library's records and typedefs the game uses by value.

import fs from "node:fs";
import path from "node:path";
import { Source, countNL } from "./text.mjs";
import { fileCtx, siteIn } from "./loc.mjs";
import { FunctionPrinter } from "./printer.mjs";
import { Module, recordClassName, macroJs, enumHome, LIBC_MOD } from "./emit.mjs";
import { Unclaimed, NoSplice, Unsupported } from "./rules.mjs";
import { layout } from "./layout.mjs";

// header modules live next to the code, named like the header: js/src/hack.h.js (structs,
// enums, constants) and js/src/hack.h.macros.js (macros), so a search of js/src for a
// definition finds it
export function typesRel(file) { return `src/${path.basename(file).replace(/\.h$/, ".h.js")}`; }
export function macrosRel(file) { return `src/${path.basename(file).replace(/\.h$/, ".h.macros.js")}`; }

export function emitHeaders(tus, shared, outDir, log) {
  const rep = { modules: [], problems: [] };
  // collect items per header file
  const per = new Map(); // header name -> {records: Map, enums: [], consts: [], macros: [], tu}
  const get = (file, tu) => {
    let h = per.get(file);
    if (!h) per.set(file, (h = { file, tu, records: new Map(), enumConsts: new Map(), macros: [] }));
    return h;
  };
  for (const { tu, em } of tus) {
    for (const r of tu.records) {
      if (!/^\.\.\/include\//.test(r.file)) continue;
      const h = get(r.file, tu);
      if (!h.records.has(r.name)) h.records.set(r.name, { r, tu, em });
    }
    for (const e of tu.enums) {
      const home = enumHome(e);
      const firstHomeLine = home ? e.consts.find((c) => c.file === home).line : 0;
      let lastHomeLine = null;
      e.consts.forEach((c, i) => {
        const file = home || c.file;
        if (!/^\.\.\/include\//.test(file)) return;
        const h = get(file, tu);
        // a constant from another file joins the home file next to the home constant before it
        // (or the first one), so references to earlier constants stay backward
        if (home && c.file === home) lastHomeLine = c.line;
        const cc = home && c.file !== home ? { ...c, file, line: lastHomeLine ?? firstHomeLine } : c;
        if (!h.enumConsts.has(c.name))
          h.enumConsts.set(c.name, { c: cc, prev: i ? e.consts[i - 1].name : null, tu, em, enumFile: e.file });
      });
    }
  }
  for (const d of shared.macros.defs.values()) {
    if (d.local) continue;
    const owner = tus.find((t) => t.tu.files.includes(d.header));
    if (!owner) continue;
    get(d.header, owner.tu).macros.push(d);
  }
  // enum constants of every file (a header's constants may come from another TU's view)
  const enumOf = new Map();
  for (const { em } of tus) for (const [k, v] of em.enumOf) if (!enumOf.has(k)) enumOf.set(k, v);
  for (const { em } of tus) em.enumOf = enumOf;
  for (const [file, h] of per) {
    const tu = h.tu, fi = tu.files.indexOf(file);
    const em = tus.find((t) => t.tu === tu).em;
    const S = new Source(fs.readFileSync(em.filePath(fi), "latin1"));
    const nLines = S.text.split("\n").length;
    const srcLines = S.text.split("\n");
    indentOf = (i) => /^[ \t]*/.exec(srcLines[i] || "")[0];
    const T = { lines: new Array(nLines).fill(""), mod: new Module(em, typesRel(file)) };
    const M = { lines: new Array(nLines).fill(""), mod: new Module(em, macrosRel(file)) };
    const printers = new Map();
    const printerFor = (iem) => {
      let p = printers.get(iem);
      if (!p) {
        p = new FunctionPrinter(iem, { name: "<header>", params: [], body: null }, "sugar");
        p.ctx = fileCtx(iem.tu.files.indexOf(file));
        p.mod = T.mod;
        printers.set(iem, p);
      }
      return p;
    };
    const P = printerFor(em);
    // records (top-level only; nested ones inline)
    const recs = [...h.records.values()].filter(({ r, tu: rtu }) => r.b && r.b.f === rtu.files.indexOf(file));
    const inside = (a, b) => a.b.o >= b.b.o && a.e.o <= b.e.o && a !== b;
    const top = recs.filter((x) => !recs.some((y) => inside(x.r, y.r)));
    for (const { r, em: rem } of top) {
      try {
        recordLines(r, recs.map((x) => x.r), printerFor(rem), S, T.lines, false, null);
        // named structs declared inside this one (struct itp inside struct shclass): their own
        // declaration, on the closing line of the outer one
        const last = S.line(r.e.o - 1);
        for (const { r: n, em: nem } of recs) {
          if (n === r || !n.tag || !inside(n, r)) continue;
          const lines = recordLines(n, recs.map((x) => x.r), printerFor(nem), S, null, false, null);
          put(T.lines, last, lines.map(([, t]) => t.trim()).join(" "));
        }
      }
      catch (e) { if (!isRewriteError(e)) throw e; rep.problems.push(`${file}: struct ${r.name}: ${e.message}`); }
    }
    // enum constants
    for (const { c, prev, em: cem } of h.enumConsts.values()) {
      const P = printerFor(cem);
      if (!c.b || c.b.f === undefined) {
        // constant produced by a macro (X-macro tables): place it at its expansion line
      }
      const line = c.line - 1;
      let val;
      try {
        if (c.explicit && c.init) val = P.js(c.init, P.ctx);
        else val = prev ? `${P.mod.importEnum(prev)} + 1` : "0";
      } catch (e) {
        if (!isRewriteError(e)) throw e;
        rep.problems.push(`${file}: enum ${c.name}: ${e.message}`);
        continue;
      }
      put(T.lines, line, `export const ${c.name} = ${val};`);
    }
    h.out = { T, M, S, top, P };
    for (const p of printers.values()) p.commitClaims();
  }
  // macros registered while printing the headers above are included (their header may have
  // had nothing else)
  for (const d of shared.macros.defs.values()) {
    if (d.local) continue;
    let h = per.get(d.header);
    if (!h) {
      const owner = tus.find((t) => t.tu.files.includes(d.header));
      if (!owner) continue;
      h = get(d.header, owner.tu);
      const fi = owner.tu.files.indexOf(d.header);
      const S = new Source(fs.readFileSync(owner.em.filePath(fi), "latin1"));
      const n = S.text.split("\n").length;
      const P = new FunctionPrinter(owner.em, { name: "<header>", params: [], body: null }, "sugar");
      P.ctx = fileCtx(fi);
      P.mod = new Module(owner.em, typesRel(d.header));
      h.out = {
        T: { lines: new Array(n).fill(""), mod: P.mod },
        M: { lines: new Array(n).fill(""), mod: new Module(owner.em, macrosRel(d.header)) },
        S,
        top: [],
        P,
      };
    }
    if (!h.macros.includes(d)) h.macros.push(d);
  }
  for (const [file, h] of per) {
    if (!h.out) continue;
    const { T, M, S, top, P } = h.out;
    // macros (a constant #define inside a struct body is placed before the struct, in source
    // order: the struct's fields may use it, struct monst's mtrack[MTSZ])
    const spans = top.map(({ r }) => [S.line(r.b.o), S.line(r.e.o - 1)]);
    const before = new Map(); // struct start line -> constants
    for (const d of h.macros) {
      let line = d.line;
      if (d.kind === "const") {
        const sp = spans.find(([a0, a1]) => line >= a0 && line <= a1);
        if (sp) {
          if (!before.has(sp[0])) before.set(sp[0], []);
          before.get(sp[0]).push(d);
          for (const [n, rel] of d.imports || []) T.mod.imports.set(n, rel);
          continue;
        }
      }
      const text = macroJs(d);
      const target = d.kind === "const" ? T : M;
      const parts = text.split("\n");
      for (let k = 0; k < parts.length; k++) put(target.lines, line + k, parts[k]);
      for (const [n, rel] of d.imports || []) target.mod.imports.set(n, rel);
    }
    for (const [a0, ds] of before) {
      const text = ds.sort((x, y) => x.line - y.line).map((d) => macroJs(d).replace(/\n\s*/g, " ")).join(" ");
      const cur = T.lines[a0] || "";
      const ind = /^[ \t]*/.exec(cur)[0];
      T.lines[a0] = cur ? ind + text + " " + cur.slice(ind.length) : (indentOf ? indentOf(a0) : "") + text;
    }
    // a comment line of the header goes to the module with the code that follows it (types first)
    const has = (X) => /\S/.test(X.lines.join("\n"));
    const owner = commentOwners(T.lines, M.lines, has(T), has(M));
    for (const X of [T, M]) {
      // comments of the header on lines we did not otherwise use, so the module reads like it
      if (!has(X)) continue;
      const text = withComments(S, X.lines, (i) => owner[i] === (X === T ? 0 : 1));
      const imports = X.mod.importBlock();
      const outPath = path.join(outDir, X.mod.rel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(
        outPath,
        layout(text.replace(/\n*$/, "\n") + (imports ? "\n" + imports + "\n" : "")).text,
        "latin1",
      );
      rep.modules.push(X.mod.rel);
    }
    P.commitClaims();
  }
  return rep;
}

/**
 * js/libc/records.js: the C library's records (struct tm, struct stat, ...) and array typedefs
 * (jmp_buf) the game uses by value, declared from the C library headers like the game's own.
 */
export function emitLibc(shared, outDir, log) {
  const L = shared.libc;
  if (!L || (!L.records.size && !L.typedefs.size)) return null;
  const any = [...L.records.values(), ...L.typedefs.values()][0].em;
  const mod = new Module(any, LIBC_MOD);
  const lines = [
    "// C library records and array typedefs used by the game, declared from the C library",
    "// headers the game is parsed against (wasm32-emscripten sysroot).",
  ];
  const printer = (em, file) => {
    const P = new FunctionPrinter(em, { name: "<libc>", params: [], body: null }, "sugar");
    P.ctx = fileCtx(em.tu.files.indexOf(file));
    P.mod = mod;
    return P;
  };
  const anon = (r) => !r.tag && !r.typedef;
  // fields, with anonymous records inline (their names are only unique within one TU)
  const body = (P, r, cls) => {
    const out = [];
    for (const f of r.fields) {
      if (!f.name) continue;
      const ft = P.T.get(f.t);
      const n = ft.k === "rec" ? P.tu.recByName.get(ft.rec) : null;
      if (n && anon(n))
        out.push(
          `${f.name}: ${P.need(n.union ? "union" : "struct")}("${cls}.${f.name}", ` +
            `{ ${body(P, n, `${cls}.${f.name}`).join(" ")} }),`,
        );
      else out.push(`${f.name}: ${fieldType(P, f)},`);
    }
    return out;
  };
  // (printing a record may name more typedefs and records: until nothing new)
  const recText = new Map(), tdText = new Map();
  for (let more = true; more;) {
    more = false;
    for (const [cls, { r, em }] of [...L.records]) {
      if (recText.has(cls) || anon(r)) continue;
      more = true;
      const P = printer(em, r.file);
      const t = [
        `// ${path.basename(r.file)}`,
        `export const ${cls} = ${P.need(r.union ? "union" : "struct")}("${cls}", {`,
      ];
      for (const f of body(P, r, cls)) t.push("    " + f);
      t.push("});");
      recText.set(cls, t);
      P.commitClaims();
    }
    for (const [tn, { td, em }] of [...L.typedefs]) {
      if (tdText.has(tn)) continue;
      more = true;
      const P = printer(em, td.file);
      tdText.set(tn, [`// ${path.basename(td.file)}`, `export const ${tn} = ${typeOf(P, td.t, td.ext || [])};`]);
      P.commitClaims();
    }
  }
  // array typedefs first: records name them as values (records name records by string); a
  // typedef naming another typedef comes after it
  const tds = [...tdText.keys()].sort();
  const order = [];
  const visit = (tn) => {
    if (order.includes(tn)) return;
    for (const o of tds) if (o !== tn && new RegExp(`\\b${o}\\b`).test(tdText.get(tn)[1])) visit(o);
    order.push(tn);
  };
  for (const tn of tds) visit(tn);
  for (const tn of order) lines.push(...tdText.get(tn));
  for (const cls of [...recText.keys()].sort()) lines.push(...recText.get(cls));
  const imports = mod.importBlock();
  const out = path.join(outDir, LIBC_MOD);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join("\n") + "\n" + (imports ? imports + "\n" : ""), "latin1");
  return LIBC_MOD;
}

function isRewriteError(e) { return e instanceof Unclaimed || e instanceof NoSplice || e instanceof Unsupported; }

let indentOf = null;
function put(lines, i, text) {
  if (i < 0 || i >= lines.length) return;
  lines[i] = lines[i] ? lines[i] + " " + text : (indentOf ? indentOf(i) : "") + text;
}

// for each line without code in either module: 0 (types module) or 1 (macros module), the
// module with code on the next line that has code (else on the last one before)
function commentOwners(tl, ml, hasT, hasM) {
  const n = Math.max(tl.length, ml.length), out = new Array(n).fill(0);
  if (!hasT || !hasM) return out.fill(hasT ? 0 : 1);
  let next = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (tl[i] || ml[i]) next = tl[i] ? 0 : 1;
    out[i] = next;
  }
  let prev = 0;
  for (let i = 0; i < n; i++) {
    if (tl[i] || ml[i]) prev = tl[i] ? 0 : 1;
    else if (out[i] < 0) out[i] = prev;
  }
  return out;
}

// keep comment-only lines (those mine(i) gives this module) and trailing comments of the
// header next to the code we put there
function withComments(S, lines, mine = () => true) {
  const out = [];
  const src = S.text.split("\n");
  let off = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = src[i] ?? "";
    let comment = "";
    for (let j = 0; j < L.length; j++) if (S.mask[off + j] === 1) comment += L[j];
    off += L.length + 1;
    const code = lines[i];
    if (code && comment) out.push(code + " " + comment.trim());
    else if (code) out.push(code);
    else out.push(comment && mine(i) ? (L.match(/^\s*/)[0] + comment.trim()) : "");
  }
  return out.join("\n");
}

export function recordLines(r, all, P, S, lines, inline, ownerName, rtName) {
  const T = P.T;
  const cls = inline ? ownerName : recordClassName(r);
  const kw = r.union ? "union" : "struct";
  const first = S.line(r.b.o), last = S.line(r.e.o - 1);
  const exp = P.localTypes ? "" : "export ";
  const head = inline ? `${P.need(kw)}("${cls}", {` : `${exp}const ${cls} = ${P.need(kw)}("${rtName || cls}", {`;
  const out = [];
  const seenNested = new Map();
  out.push([first, head]);
  for (const f of r.fields) {
    const fe = f.e ? (f.e.o !== undefined ? f.e.o : siteIn(f.e, P.ctx, true, P.tu.invById)) : null;
    const fl = S.line((fe ?? r.b.o + 1) - 1);
    // an anonymous record declared in place (possibly an array of them: `struct {...} map[N]`)
    let et = T.get(f.t), depth = 0;
    while (et.k === "arr") { et = T.get(et.of); depth++; }
    const nested =
      et.k === "rec"
        ? all.find((x) => x.name === et.rec && !x.tag && x.b && x.b.o >= r.b.o && x.e.o <= r.e.o && x !== r)
        : null;
    if (nested && f.name && seenNested.has(nested)) {
      // a second declarator of the same inline record (`struct {...} src, dest;`): the same class
      out.push([
        fl,
        `${f.name}: ${depth ? `${P.need("array_of")}(`.repeat(depth) : ""}"${seenNested.get(nested)}"${(f.ext || [])
          .slice(0, depth)
          .reverse()
          .map((e) => `, ${P.js(e, P.ctx)})`)
          .join("")},`,
      ]);
      continue;
    }
    if (nested && f.name) {
      const base = `${rtName || cls}.${f.name}`;
      seenNested.set(nested, base);
      const ext = f.ext || [];
      if (depth && ext.length < depth) throw new Unsupported("array of an inline record without written extent");
      const inner = recordLines(nested, all, P, S, null, true, base);
      const open = `${f.name}: ` + `${P.need("array_of")}(`.repeat(depth);
      const close = ext.slice(0, depth).reverse().map((e) => `, ${P.js(e, P.ctx)})`).join("");
      out.push(
        ...inner.map(([ln, t], i, arr) => [
          ln,
          (i === 0 ? open : "") + (i === arr.length - 1 && depth ? t.replace(/\),$/, ")" + close + ",") : t),
        ]),
      );
      continue;
    }
    if (!f.name) {
      if (nested) throw new Unsupported("anonymous member struct/union");
      continue; // unnamed bit-field padding: the layout rule handles the gap
    }
    out.push([fl, `${f.name}: ${fieldType(P, f)},`]);
  }
  out.push([last, inline ? "})," : "});"]);
  if (lines) for (const [ln, t] of out) put(lines, ln, t);
  return out;
}

function fieldType(P, f) {
  const T = P.T;
  const td = P.em.libcArrayTypedef(f.tn, f.t, P.mod);
  if (td) return td;
  if (f.bits === undefined) { const a = P.em.typedefAlias(f.tn, f.t, P.mod); if (a) return a; }
  if (f.bits !== undefined) {
    const w = f.bw ? P.js(f.bw, P.ctx) : String(f.bits);
    const base = T.get(f.t);
    if (base.k === "int" && base.size === 4 && !base.signed) return `${P.need("Bitfield")}(${w})`;
    return `${P.need("bits_of")}(${P.need(T.convName(f.t))}, ${w})`;
  }
  return typeOf(P, f.t, f.ext || []);
}

function typeOf(P, tid, ext) {
  const T = P.T, t = T.get(tid);
  switch (t.k) {
    case "int": case "bool": case "flt": return P.need(T.typeName(tid));
    case "rec": {
      const r = P.tu.recByName.get(t.rec);
      // a C library record held by value (regex_t in struct nhregex): declared in libc/records.js
      if (r && !P.em.isProjectFile(r.file) && P.em.fileIndexOf(r.file) !== 0 && P.mod.rel !== LIBC_MOD) {
        P.em.noteLibcRecord(r);
        return P.mod.add(recordClassName(r), LIBC_MOD);
      }
      return `"${recordClassName(r || { tag: t.rec })}"`;
    }
    case "ptr": {
      const p = T.get(t.to);
      if (p.k === "fn") return P.need("fnptr_t");
      if (p.k === "void") return `${P.need("ptr_to")}(${P.need("void_t")})`;
      return `${P.need("ptr_to")}(${typeOf(P, t.to, ext)})`;
    }
    case "arr": {
      const [first, ...rest] = ext;
      if (!first) throw new Unsupported("array field without written extent");
      return `${P.need("array_of")}(${typeOf(P, t.of, rest)}, ${P.js(first, P.ctx)})`;
    }
    case "fn": return P.need("fnptr_t");
    default: throw new Unsupported("field type " + t.k);
  }
}
