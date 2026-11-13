// lib/emit.mjs: one C file -> one JS unit module (js/src/<file>.js, js/win/tty/<file>.js, ...).
//
// The Emitter prints a module line for line with its C file (line N of the JS is line N of the
// C); lib/layout.mjs then collapses blank runs and keeps the line map. Function definitions
// are printed by FunctionPrinter (lib/printer.mjs: sugar, else fallback); file-scope data
// definitions become heap-resident objects; prototypes, directives and inactive #if regions
// become blank lines; comments stay. The imports follow the last line: one statement per
// module, names sorted (Module collects them).

import path from "node:path";
import fs from "node:fs";
import vm from "node:vm";
import { FunctionPrinter, RT, pad } from "./printer.mjs";
import { Types } from "./types.mjs";
import { Source, countNL } from "./text.mjs";
import { Macros } from "./macros.mjs";
import { RuleLog, Unclaimed, NoSplice, Unsupported } from "./rules.mjs";
import { rangeIn, siteRangeIn, posIn, fileCtx } from "./loc.mjs";
import { recordLines } from "./headers.mjs";
import { unitModule, unitOfPath } from "./units.mjs";
import { LINE_BREAK } from "./layout.mjs";

// functions of the C library (rt/libc.js); anything else not defined in src/ is the platform layer
const LIBC = new Set(Object.keys(await import("../../../js/rt/libc.js")));
// integer type names that are never aliased by a typedef conversion (rt/ctypes.js or C's own)
const BUILTIN_INT_NAME = new RegExp("^(int|unsigned|long|short|char|float|double|bool|ulong|ushort|schar|uchar|" +
  "size_t|ssize_t|time_t|off_t|intptr_t|uintptr_t|u?int(8|16|32|64)_t)$");

/** The emitted module declaring the C library's records/typedefs the game uses by value. */
export const LIBC_MOD = "libc/records.js";

/** Collects the imports of one emitted module. */
export class Module {
  constructor(em, rel) {
    this.em = em;
    this.rel = rel;              // "src/monmove.js" or "src/monst.h.js"
    this.imports = new Map();    // local name -> module rel path
    this.opaque = new Map();     // opaque record class name -> its binding (after the imports)
  }
  add(name, rel) {
    if (rel === this.rel) return name;
    const had = this.imports.get(name);
    if (had && had !== rel) throw new Unsupported(`import clash for ${name}: ${had} vs ${rel}`);
    this.imports.set(name, rel);
    return name;
  }
  rt(name) { return this.add(name, `rt/${RT[name]}.js`); }
  importFunction(name) {
    const f = this.em.index.functions[name];
    if (!f) {
      // not defined in C we emit: the C library (rt/libc.js), the Lua API (rt/lua.js; both the
      // residue), or the platform/host layer (rt/port.js)
      const lib = this.em.index.protos[name]?.lib;
      return this.add(
        name,
        LIBC.has(name) || lib === "libc" ? "rt/libc.js" : lib === "lua" ? "rt/lua.js" : "rt/port.js",
      );
    }
    return this.add(name, unitModule(f.file));
  }
  importGlobal(name) {
    const g = this.em.index.globals[name];
    if (!g) throw new Unsupported("unknown global " + name);
    return this.add(name, unitModule(g.file));
  }
  importEnum(name) {
    const file = this.em.enumFile(name);
    if (file === this.em.tu.files[0] && this.rel === this.em.mod.rel) return name;
    return this.add(name, this.em.moduleRelForFile(file));
  }
  importMacro(name, def) {
    if (def.local) return name;
    const rel = this.em.moduleRelForFile(def.header);
    return this.add(name, def.kind === "const" ? rel : rel.replace(/\.js$/, ".macros.js"));
  }
  importRecord(cls, file) { return this.add(cls, this.em.moduleRelForFile(file)); }
  snapshot() { return [new Map(this.imports), new Map(this.opaque)]; }
  restore(s) { this.imports = s[0]; this.opaque = s[1]; }

  /** The import block (relative to this module's directory). */
  importBlock() {
    const lines = [];
    const from = path.posix.dirname(this.rel);
    // (header modules first, as when they lived in include/: module evaluation order follows it)
    const key = (rel) => (/\.h(\.macros)?\.js$/.test(rel) ? "0" : "1") + rel;
    const items = [...this.imports.entries()]
      .filter(([, rel]) => rel !== this.rel)
      .sort((a, b) => (key(a[1]) < key(b[1]) ? -1 : key(a[1]) > key(b[1]) ? 1 : a[0] < b[0] ? -1 : 1));
    // one import per module (modules in the order above, names sorted)
    const byModule = new Map();
    for (const [name, rel] of items) {
      if (!byModule.has(rel)) byModule.set(rel, []);
      byModule.get(rel).push(name);
    }
    for (const [rel, names] of byModule) {
      let p = path.posix.relative(from, rel);
      if (!p.startsWith(".")) p = "./" + p;
      lines.push(importStatement(names, p));
    }
    for (const k of [...this.opaque.keys()].sort()) lines.push(this.opaque.get(k));
    if (this.fileConst) lines.push(`const __FILE__ = "${this.fileConst}";`);
    return lines.join("\n");
  }
}

/**
 * `import { a, b } from "p";` on one line when it fits in IMPORT_WIDTH columns, else the names
 * wrapped at that width, four spaces in, between `import {` and `} from "p";`.
 */
export const IMPORT_WIDTH = 100;
export function importStatement(names, p) {
  const one = `import { ${names.join(", ")} } from "${p}";`;
  if (one.length <= IMPORT_WIDTH) return one;
  const lines = ["import {"];
  let cur = "";
  for (const n of names) {
    const add = cur ? `${cur} ${n},` : `    ${n},`;
    if (cur && add.length > IMPORT_WIDTH) { lines.push(cur); cur = `    ${n},`; } else cur = add;
  }
  if (cur) lines.push(cur);
  lines.push(`} from "${p}";`);
  return lines.join("\n");
}

export class Emitter {
  constructor(tu, index, opts = {}) {
    this.tu = tu;
    this.index = index;
    this.types = new Types(tu.types);
    this.opts = opts;
    this.checked = !!opts.checked;
    this.log = new RuleLog();
    this.macros = opts.macros || new Macros(this);
    this.macros.em = this;
    this.sources = new Map();
    this.src = this.sourceOf(0);
    this.taken = new Set(Object.keys(RT));
    this.mod = new Module(this, unitModule(tu.file));
    this.headerMods = opts.headerMods || new Map();
    this.records = opts.records || new Map(); // class name -> {rec, file}
    this.libc = opts.libc || { records: new Map(), typedefs: new Map() };
    this.report = { file: tu.file, functions: [] };
    this.enumOf = new Map();
    for (const e of tu.enums) {
      // an enum whose constants come from several files (X-macro tables: the first constant in
      // sndprocs.h, the rest from seffects.h) lives in the file holding most of them, so the
      // previous + 1 chain stays inside one module (no import cycle)
      const home = enumHome(e);
      for (const c of e.consts) this.enumOf.set(c.name, home || c.file || e.file);
    }
    this.ModuleClass = Module;
    this.recFile = new Map(tu.records.map((r) => [r.name, r.file]));
  }

  /** Macros (as the TU ends) that expand to nothing: name -> function-like? */
  emptyMacros() {
    if (!this._empty) {
      this._empty = new Map();
      for (const m of this.tu.macroByName.values()) if (m.body === "") this._empty.set(m.name, !!m.fn);
    }
    return this._empty;
  }

  // ---- files and sources -----------------------------------------------------------------
  filePath(fi) { return path.resolve(path.join(this.tu.srcDir, "src"), this.tu.files[fi]); }
  fileName(fi) { return typeof fi === "string" ? fi : this.tu.files[fi]; }
  fileIndexOf(name) {
    if (name === this.tu.files[0] || name.endsWith("/src/" + this.tu.file)) return 0;
    return this.tu.files.indexOf(name);
  }
  isProjectFile(name) { return /^\.\.\/include\//.test(name) || this.fileIndexOf(name) === 0; }
  sourceOf(fi) {
    let s = this.sources.get(fi);
    if (!s) {
      const name = this.tu.files[fi];
      if (!name || name.startsWith("<")) throw new NoSplice(); // <builtin>, <command line>
      const text = fs.readFileSync(this.filePath(fi), "latin1");
      s = new Source(text, this.tu.skipped.filter((r) => (r.f ?? 0) === fi));
      this.sources.set(fi, s);
    }
    return s;
  }
  defSourceOf(ctx) {
    const key = "def:" + ctx.f;
    let s = this.sources.get(key);
    if (!s) {
      // the text of #define bodies: code (not directives); line continuations become newlines
      const base = this.sourceOf(ctx.f);
      s = new Source(base.text, [], { noDirectives: true });
      const clean0 = s.clean.bind(s), cc0 = s.cleanCode.bind(s);
      s.clean = (a, b) => clean0(a, b).replace(/\\\n/g, "\n");
      s.cleanCode = (a, b, drop) => cc0(a, b, (i) => s.text[i] !== "\\" && drop(i)).replace(/\\\n/g, "\n");
      this.sources.set(key, s);
    }
    return s;
  }
  defLine(name, fi) {
    const want = fi === 0 ? null : this.tu.files[fi];
    const m = this.tu.macros.filter(
      (d) => d.name === name && (want ? d.file === want : this.fileIndexOf(d.file) === 0),
    );
    // the last definition; a header defining it again identically (hack.h MAX_BMASK) defines
    // it at the first of those, ahead of every use
    let d = m[m.length - 1];
    if (d && want) d = m.find((x) => x.body === d.body && x.fn === d.fn && String(x.params) === String(d.params)) || d;
    return d ? this.sourceOf(fi).line(d.off) : -1;
  }

  /** js/ module path for a C or header file name ("../include/monst.h" -> "include/monst.js"). */
  moduleRelForFile(file) {
    const b = path.basename(file);
    if (b.endsWith(".h")) return `src/${b.replace(/\.h$/, ".h.js")}`;
    if (this.fileIndexOf(file) === 0) return this.mod.rel;
    return unitModule(unitOfPath(this.tu.srcDir, file) || b);
  }
  /** A file-scope declaration of `name` in this file with a written array extent, if any. */
  fileDecl(name) {
    if (!this._fileDecls) {
      this._fileDecls = new Map();
      for (const d of this.tu.decls)
        if (d.k === "Var" && d.ext && d.ext[0] && !this._fileDecls.has(d.name)) this._fileDecls.set(d.name, d);
    }
    return this._fileDecls.get(name);
  }
  /**
   * A NetHack typedef of a scalar (coordxy, xint16, boolean, aligntyp...) named where the C
   * spells it: `export const coordxy = short;` at the typedef's line of its header module
   * (registered like a constant macro), imported from there. null when not applicable.
   */
  typedefAlias(tn, tid, mod) {
    if (!tn) return null;
    const t = this.types.get(tid);
    if (!t || !["int", "bool", "flt"].includes(t.k) || t.big || t.enum) return null;
    if (RT[tn] || BUILTIN_INT_NAME.test(tn)) return null;
    const td = (this.tu.typedefs || []).find((x) => x.name === tn);
    if (!td || !/^\.\.\/include\//.test(td.file)) return null;
    const key = `typedef:${tn}`;
    if (!this.macros.defs.has(key)) {
      const conv = this.types.typeName(tid);
      this.macros.defs.set(key, {
        name: tn,
        key,
        localFile: null,
        header: td.file,
        defFile: this.tu.files.indexOf(td.file),
        params: [],
        kind: "const",
        body: conv,
        sites: 0,
        local: false,
        line: td.line - 1,
        imports: new Map([[conv, `rt/${RT[conv] || "ctypes"}.js`]]),
      });
    }
    const d = this.macros.defs.get(key);
    d.sites++;
    return mod.importMacro(tn, d);
  }
  noteLibcRecord(r) {
    const cls = recordClassName(r);
    if (this.libc.records.has(cls)) return;
    this.libc.records.set(cls, { r, em: this });
    // records it holds by value are needed for its layout
    for (const f of r.fields) {
      let t = this.types.get(f.t);
      while (t.k === "arr") t = this.types.get(t.of);
      if (t.k === "rec") { const n = this.tu.recByName.get(t.rec); if (n) this.noteLibcRecord(n); }
    }
  }
  /** A C library typedef of an array type (jmp_buf), named where the C spells it, or null. */
  libcArrayTypedef(tn, tid, mod) {
    if (!tn || !this.types.isArr(tid)) return null;
    const td = (this.tu.typedefs || []).find((t) => t.name === tn);
    if (!td || this.isProjectFile(td.file)) return null;
    if (!this.libc.typedefs.has(tn)) {
      this.libc.typedefs.set(tn, { td, em: this });
      let t = this.types.get(td.t);
      while (t.k === "arr") t = this.types.get(t.of);
      if (t.k === "rec") { const n = this.tu.recByName.get(t.rec); if (n) this.noteLibcRecord(n); }
    }
    return mod.add(tn, LIBC_MOD);
  }
  opaqueName(rec) { return recordClassName({ name: rec, tag: rec }); }
  enumFile(name) {
    const f = this.enumOf.get(name);
    if (!f) throw new Unsupported("enum constant without enum " + name);
    return f;
  }
  moduleForHeader(fi, fallbackMod) {
    if (fi === 0) return this.mod;
    const rel = this.moduleRelForFile(this.tu.files[fi]);
    let m = this.headerMods.get(rel);
    if (!m) { m = new Module(this, rel); this.headerMods.set(rel, m); }
    m.em = this;
    return m;
  }
  recordClass(rec, mod = this.mod) {
    const r = this.tu.recByName.get(rec);
    const cls = recordClassName(r || { name: rec, tag: rec });
    if (!r) {
      // a struct the program only points to (lua_State, FILE): an opaque record of that name,
      // bound once per module after the imports
      mod.opaque.set(cls, `const ${cls} = ${mod.rt("record_or_opaque")}("${cls}");`);
      return cls;
    }
    if (!this.isProjectFile(r.file) && this.fileIndexOf(r.file) !== 0) {
      // a C library record used by value or by field (struct tm, struct stat, ...)
      this.noteLibcRecord(r);
      return mod.add(cls, LIBC_MOD);
    }
    if (!this.records.has(cls)) this.records.set(cls, { rec, file: r.file });
    if (r.file === this.tu.files[0]) return cls;
    return mod.importRecord(cls, r.file);
  }

  // ---- the module ---------------------------------------------------------------------------
  emit() {
    const tu = this.tu, S = this.src, T = S.text;
    // top-level items (group decls sharing a range: `int a, b;`)
    const items = [];
    for (const d of tu.decls) {
      const r = rangeIn(d, fileCtx(0)) || siteRangeIn(d, fileCtx(0), tu.invById);
      if (!r) continue;
      const last = items[items.length - 1];
      if (last && r[0] < last.e) { last.decls.push(d); last.e = Math.max(last.e, r[1]); continue; }
      items.push({ s: r[0], e: r[1], decls: [d] });
    }
    // functions defined in a header (expanded from its macros): after the module's own lines
    const fromHeaders = tu.decls.filter(
      (d) =>
        ((d.k === "Function" && d.body) || (d.k === "Var" && d.init)) &&
        !rangeIn(d, fileCtx(0)) &&
        !siteRangeIn(d, fileCtx(0), tu.invById),
    );
    let out = "", cur = 0;
    for (const it of items) {
      if (it.s < cur) continue;
      out += this.gap(cur, it.s);
      const text = this.topItem(it);
      out += pad(text, countNL(T.slice(it.s, it.e)));
      cur = it.e;
    }
    out += this.gap(cur, T.length);
    // (header-defined functions first: they may use local macros too)
    const tail = this.headerFunctions(fromHeaders) + this.tableFunctions();
    // local macros used by functions: their definitions go on their #define lines
    out = this.placeLocalMacros(out);
    const lines = out.split("\n");
    const want = T.split("\n").length;
    if (lines.length !== want) throw new Error(`${tu.file}: line count ${lines.length} != ${want}`);
    const imports = this.mod.importBlock();
    return out.replace(/\n*$/, "\n") + (imports ? "\n" + imports + "\n" : "") + tail;
  }

  /** The header all the elements of an initializer list come from (another file than ctx's), or -1. */
  tableHeader(list, ctx) {
    let fi = -1;
    for (const k of list.c) {
      if (!k || k.k === "ImplicitValueInitExpr") continue;
      if (siteRangeIn(k, ctx, this.tu.invById)) return -1;
      let L = k.b;
      for (let g = 0; L && L.f === undefined && g < 64; g++) L = L.up;
      if (!L || L.f === ctx.f || (fi >= 0 && L.f !== fi)) return -1;
      fi = L.f;
    }
    return fi;
  }

  /** Records of tables from included headers: `function mons_init_records() { return [...]; }`. */
  tableFunctions() {
    // print each table's records (in its header's context), with their header ranges
    const tabs = (this.tables || []).map((t) => {
      const ctx = fileCtx(t.fi), P = t.P, saved = P.ctx;
      P.ctx = ctx;
      P.wrapRows = true;
      const rows = t.kids.map((k) => {
        const s = this.strip(k);
        return {
          r: siteRangeIn(k, ctx, this.tu.invById),
          text: s.k === "InitListExpr" ? P.initList(s, ctx) : P.js(k, ctx),
        };
      });
      P.commitClaims();
      P.ctx = saved;
      P.wrapRows = false;
      return { ...t, rows };
    });
    // the header's comments and line breaks between rows, one row per record (or pair of records)
    const layout = (fi, rows) => {
      const S = this.sourceOf(fi);
      let body = "", cur = -1;
      for (const { r, text } of rows) {
        if (r) { body += cur < 0 ? "" : S.cleanCode(cur, r[0], () => true).replace(/,/g, ""); cur = r[1]; }
        const ind = r ? /^[ \t]*/.exec(S.text.slice(S.ls[S.line(r[0])], r[0]))[0] : "    ";
        body += (body.endsWith("\n") || !body ? ind : "") + text + ",";
      }
      return body;
    };
    let out = "";
    const done = new Set(), used = new Set();
    for (const t of tabs) {
      if (done.has(t)) continue;
      const hname = path.basename(this.tu.files[t.fi]);
      // tables built from the same header lines (objects.c: obj_descr_init[] and obj_init[] both
      // from objects.h): one row per header entry holding both records, as the header has them
      const same = tabs.filter(
        (u) =>
          !done.has(u) &&
          u.fi === t.fi &&
          u.rows.length === t.rows.length &&
          u.rows.every((x, i) => x.r && t.rows[i].r && x.r[0] === t.rows[i].r[0] && x.r[1] === t.rows[i].r[1]),
      );
      if (same.length > 1) {
        let fn = `${hname.replace(/\.h$/, "").replace(/\W/g, "_")}_h_records`;
        for (let k = 2; used.has(fn); k++) fn = `${hname.replace(/\.h$/, "").replace(/\W/g, "_")}_h_records${k}`;
        used.add(fn);
        same.forEach((u, i) => {
          done.add(u);
          out += `\n// the records of ${u.var}[]: column ${i} of ${fn}()\n` +
            `function ${u.fn}() { return ${fn}().map((row) => row[${i}]); }\n`;
        });
        const rows = t.rows.map((x, i) => ({ r: x.r, text: `[${same.map((u) => u.rows[i].text).join(", ")}]` }));
        const columns = same.map((u) => `${u.var}[i]`).join(", ");
        out += `\n// one row per entry of ${hname}: [${columns}], laid out like it\n` +
          `function ${fn}() {\n    return [\n${layout(t.fi, rows)}\n    ];\n}\n`;
        continue;
      }
      done.add(t);
      out += `\n// the records of ${t.var}[] from ${hname}, laid out like it\n` +
        `function ${t.fn}() {\n    return [\n${layout(t.fi, t.rows)}\n    ];\n}\n`;
    }
    return out;
  }

  strip(n) { while (n && (n.k === "ImplicitCastExpr" || n.k === "ParenExpr")) n = n.c[0]; return n; }

  /** Functions a header defines through macros (sfmacros.h), one line per header line. */
  headerFunctions(fds) {
    if (!fds.length) return "";
    const byFile = new Map();
    for (const fd of fds) {
      const L = fd.l || fd.b;
      let f = L;
      for (let g = 0; f && f.f === undefined && g < 64; g++) f = f.up;
      const fi = f ? f.f : -1;
      if (fi < 0) continue;
      if (!byFile.has(fi)) byFile.set(fi, []);
      byFile.get(fi).push(fd);
    }
    let out = "";
    for (const [fi, list] of byFile) {
      const S = this.sourceOf(fi), ctx = fileCtx(fi);
      const lines = new Map();
      for (const fd of list) {
        // (data keeps its lines: a table reads like the header's)
        let text;
        if (fd.k === "Var") {
          try { text = this.fileVar(fd, ctx); }
          catch (e) {
            if (!(e instanceof Unsupported || e instanceof Unclaimed || e instanceof NoSplice)) throw e;
            this.report.unsupportedData = (this.report.unsupportedData || []).concat([`${fd.name}: ${e.message}`]);
            text = `/* ${fd.name}: data not emitted (${e.message}) */`;
          }
        } else text = this.emitFunction(fd, ctx).replace(/\n+/g, " ");
        const r = siteRangeIn(fd, ctx, this.tu.invById);
        const ln = r ? S.line(r[0]) : -1;
        lines.set(ln, lines.has(ln) ? lines.get(ln) + (fd.k === "Function" ? LINE_BREAK : " ") + text : text);
      }
      out += `\n// defined by ${path.basename(this.tu.files[fi])} (included above; at the line shown)\n`;
      for (const ln of [...lines.keys()].sort((a, b) => a - b))
        out += `// ${path.basename(this.tu.files[fi])}:${ln + 1}\n${lines.get(ln)}\n`;
    }
    return out;
  }

  /** Text between top-level items: comments kept, directives (#include too) blank. */
  gap(s, e) {
    const S = this.src, T = S.text;
    let out = "", i = s;
    while (i < e) {
      if (S.mask[i] === 3 && !S.dead[i]) {
        let j = i;
        while (j < e && S.mask[j] === 3) j++;
        out += "\n".repeat(countNL(T.slice(i, j)));
        i = j;
        continue;
      }
      let j = i;
      while (j < e && !(S.mask[j] === 3 && !S.dead[j])) j++;
      // code tokens between top-level items are macros that expand to nothing or to a pragma
      // (DISABLE_WARNING_..., ';' after them): not JS, dropped
      out += S.cleanCode(i, j, () => true);
      i = j;
    }
    return out;
  }

  /** Line spans [a, b] (a < b) inside which nothing can be inserted: multi-line data items and statements. */
  busySpans() {
    if (this._busy) return this._busy;
    const S = this.src, out = [];
    const ctx = fileCtx(0);
    const CONTROL = new Set([
      "CompoundStmt",
      "IfStmt",
      "WhileStmt",
      "ForStmt",
      "DoStmt",
      "SwitchStmt",
      "CaseStmt",
      "DefaultStmt",
      "LabelStmt",
      "AttributedStmt",
    ]);
    const span = (n) => {
      const r = rangeIn(n, ctx) || siteRangeIn(n, ctx, this.tu.invById);
      if (r) {
        const a = S.line(r[0]),
          b = S.line(Math.max(r[0], r[1] - 1));
        if (b > a) out.push([a, b]);
      }
    };
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "CompoundStmt") {
        for (const c of n.c || []) {
          if (c && !CONTROL.has(c.k)) span(c);
          walk(c);
        }
        return;
      }
      for (const c of n.c || []) walk(c);
    };
    for (const d of this.tu.decls) {
      if (d.k === "Function") { if (d.body) walk(d.body); }
      else span(d);
    }
    return (this._busy = out);
  }

  placeLocalMacros(out) {
    const lines = out.split("\n");
    for (const d of this.macros.defs.values()) {
      if (!d.local || d.localFile !== this.tu.file || d.placed) continue;
      let ln = d.line;
      // a #define in the middle of an initializer or statement goes before it
      for (const [a, b] of this.busySpans()) if (ln > a && ln <= b) ln = a;
      // a #define inside a function body is visible to the end of the file in C: it goes at
      // module level, after the function's closing line
      const fn = (this.fnLines || []).find(([a, b]) => ln > a && ln < b);
      if (fn) { lines[fn[1]] += LINE_BREAK + oneLine(macroJs(d)); d.placed = this.tu.file; continue; }
      const text = macroJs(d);
      if (ln < 0 || ln >= lines.length) continue;
      const span = countNL(text);
      if (ln !== d.line) {
        lines[ln] = oneLine(text) + " " + lines[ln].replace(/^\s*/, "");
        d.placed = this.tu.file;
        continue;
      }
      lines[ln] = text.split("\n")[0];
      for (let k = 1; k <= span && ln + k < lines.length; k++) lines[ln + k] = text.split("\n")[k];
      d.placed = this.tu.file;
    }
    return lines.join("\n");
  }

  topItem(it) {
    const d = it.decls[0];
    if (d.k === "Function") {
      const defs = it.decls.filter((x) => x.k === "Function" && x.body);
      if (!defs.length) return ""; // prototype
      (this.fnLines ||= []).push([this.src.line(it.s), this.src.line(it.e)]);
      // one macro invocation may define several functions (SF_X(uint8_t, bitfield) defines
      // sfo_bitfield and sfi_bitfield): all of them, on the invocation's lines
      return defs.map((x) => this.emitFunction(x)).join(LINE_BREAK);
    }
    if (it.decls.some((x) => x.k === "Record" || x.k === "Enum")) return this.localType(it);
    if (d.k === "Var") return this.fileVars(it);
    if (d.k === "Typedef") return "";
    return "";
  }

  localType(it) {
    // struct/union/enum declared in the .c file: declarations on the same lines; variables the
    // same declaration defines (`static const struct {...} tintxts[] = {...};`) after them
    const S = this.src;
    const first = S.line(it.s), last = S.line(it.e - 1);
    const lines = new Map();
    const srcLines = S.text.split("\n");
    const put = (ln, t) => {
      if (ln < first || ln > last) return;
      lines.set(ln, lines.has(ln) ? lines.get(ln) + " " + t : /^[ \t]*/.exec(srcLines[ln] || "")[0] + t);
    };
    const P = new FunctionPrinter(this, { name: "<types>", params: [], body: null }, "sugar");
    P.mod = this.mod;
    P.localTypes = true;
    const all = this.tu.records.filter((r) => r.b && r.b.f === 0);
    const vars = [];
    for (const d of it.decls) {
      if (d.k === "Record" && d.complete) {
        const r = this.tu.recByName.get(d.rec);
        if (!r || !r.b || r.b.f !== 0) continue;
        if (all.some((y) => y !== r && y.b.o <= r.b.o && y.e.o >= r.e.o)) continue; // nested: printed by the outer one
        try {
          const cls = recordClassName(r);
          // (anonymous records are named per file: __anonN is only unique within one TU)
          const rtName = /^__anon|^struct___anon/.test(cls) ? `${path.basename(this.tu.file, ".c")}.${cls}` : cls;
          for (const [ln, t] of recordLines(r, all, P, S, null, false, null, rtName)) put(ln, t);
          this.localRecords = (this.localRecords || new Set()).add(cls);
        } catch (e) {
          if (!(e instanceof Unsupported || e instanceof Unclaimed || e instanceof NoSplice)) throw e;
          this.report.unsupportedData = (this.report.unsupportedData || []).concat([`struct ${d.rec}: ${e.message}`]);
        }
      } else if (d.k === "Enum") {
        const e = this.tu.enums.find(
          (x) => x.name === d.name && x.file === this.tu.files[0] && (!x.b || !d.b || x.b.o === d.b.o),
        );
        if (!e) continue;
        e.consts.forEach((c, i) => {
          const val = c.explicit && c.init ? P.js(c.init, P.ctx) : i ? `${e.consts[i - 1].name} + 1` : "0";
          put(c.line - 1, `const ${c.name} = ${val};`);
        });
      } else if (d.k === "Var") vars.push(d);
    }
    P.commitClaims();
    let varText = "", varLine = last + 1;
    if (vars.length) {
      varText = this.fileVars({ decls: vars });
      const p = posIn(vars[0].l, fileCtx(0));
      varLine = p === null ? last : Math.max(first, S.line(p));
    }
    const out = [];
    for (let ln = first; ln < varLine && ln <= last; ln++) out.push(lines.get(ln) ?? "");
    if (varText) out.push(lines.has(varLine) ? lines.get(varLine) + " " + varText.replace(/^\s+/, "") : varText);
    return out.join("\n");
  }

  fileVars(it) {
    const parts = [];
    for (const d of it.decls) {
      if (d.k !== "Var") continue;
      if (d.sc === "extern" || d.isDef === 0) continue;
      try { parts.push(this.fileVar(d)); }
      catch (e) {
        if (!(e instanceof Unsupported || e instanceof Unclaimed || e instanceof NoSplice)) throw e;
        this.report.unsupportedData = (this.report.unsupportedData || []).concat([`${d.name}: ${e.message}`]);
        (this.missingData ||= new Set()).add(d.name);
        parts.push(`/* ${d.name}: file-scope data not emitted (${e.message}) */`);
      }
      parts[parts.length - 1] = [d, parts[parts.length - 1]];
    }
    // each variable starts on its own line (`a[] = {...},\n b[] = {...};` keeps its layout)
    let out = "", line = -1;
    for (const [d, t] of parts) {
      const p = posIn(d.l, fileCtx(0));
      const ln = p === null ? -1 : this.src.line(p);
      if (line < 0) {
        // (from the item's first line: the type may be written on lines before the name)
        const lead = it.s !== undefined && ln >= 0 ? Math.max(0, ln - this.src.line(it.s)) : 0;
        out = "\n".repeat(lead) + t; line = (ln < 0 ? 0 : ln) + countNL(t); continue;
      }
      if (ln > line) { out += "\n".repeat(ln - line) + t; line = ln + countNL(t); }
      else { out += " " + t; line += countNL(t); }
    }
    return out;
  }

  fileVar(d, ctx = null) {
    const P = new FunctionPrinter(this, { name: d.name, params: [], body: null }, "sugar");
    P.mod = this.mod;
    if (ctx) P.ctx = ctx;
    const T = this.types, exp = d.sc === "static" ? "" : "export ";
    // a static whose name another file also defines statically: "file.c/name" (rt keys statics
    // by this string)
    const key =
      d.sc === "static" && (this.index.staticFiles?.[d.name]?.length || 0) > 1
        ? `${path.basename(this.tu.file)}/${d.name}`
        : d.name;
    let text;
    if (T.isArr(d.t)) {
      const at = T.get(d.t);
      const ext = d.ext || [];
      const si = d.init ? P.strip(d.init) : null;
      let count;
      if (ext[0]) count = P.js(ext[0], P.ctx);
      else if (si && si.k === "InitListExpr") count = "null";
      else if (si && si.k === "StringLiteral") count = `${P.need("sizeof_string")}(${P.js(si, P.ctx)})`;
      else {
        // an array typedef of the C library (static jmp_buf nhjs_jmp): its element and extent
        const td = this.libcArrayTypedef(d.tn, d.t, this.mod);
        if (!td) throw new Unsupported("file-scope array without written extent");
        P.commitClaims();
        return `${exp}const ${P.ident(d.name)} = ${P.need("static_array")}("${key}", ${td}.of, ${td}.n);`;
      }
      const elem = P.typeExpr(at.of, ext.slice(1), P.ctx);
      P.tableVar = d.name; // (records from an included header: P.initList puts them in a function)
      if (si && si.k === "InitListExpr") {
        text = `${P.need("static_array")}("${key}", ${elem}, ${count}, ${P.initList(si, P.ctx)})`;
      } else if (si && si.k === "StringLiteral") {
        const initString = P.need("init_string");
        const array = `${P.need("static_array")}("${key}", ${elem}, ${count})`;
        text = `${initString}(${array}, ${P.need("_")}(${P.js(si, P.ctx)}), true)`;
      } else text = `${P.need("static_array")}("${key}", ${elem}, ${count})`;
    } else if (T.isRec(d.t)) {
      const si = d.init ? P.strip(d.init) : null;
      if (si && si.k !== "InitListExpr") throw new Unsupported("file-scope struct initialised from " + si.k);
      const head = `${P.need("static_struct")}("${key}", ${P.typeExpr(d.t, null, P.ctx)}`;
      text = `${head}${si ? ", " + P.initList(si, P.ctx) : ""})`;
    } else if (d.sc === "static") {
      const head = `${P.need("static_var")}("${key}", ${P.typeExpr(d.t, d.ext, P.ctx)}`;
      text = `${head}${d.init ? ", " + P.js(d.init, P.ctx) : ""})`;
    } else {
      // a global scalar: a heap-backed accessor of globalThis named like the C variable
      const init = d.init ? ", " + P.js(d.init, P.ctx) : "";
      P.commitClaims();
      return `${this.mod.add("global_scalar", "rt/globals.js")}("${d.name}", ${P.typeExpr(d.t, d.ext, P.ctx)}${init});`;
    }
    P.commitClaims();
    this.log.add("decl.static-local", `${this.tu.file}:${this.src.line(posIn(d.l, P.ctx) ?? 0) + 1}`);
    return `${exp}const ${P.ident(d.name)} = ${text};`;
  }

  emitFunction(fd, ctx = null) {
    const reasons = [];
    // --fallback forces the plain dialect everywhere (tests run the fixtures both ways)
    for (const mode of this.opts.fallback ? ["fallback"] : ["sugar", "fallback"]) {
      const snapM = this.mod.snapshot();
      const snapDefs = new Map(this.macros.defs);
      try {
        const P = new FunctionPrinter(this, fd, mode);
        P.mod = this.mod;
        if (ctx) P.ctx = ctx;
        const text = P.functionText();
        // the strict whitelist is about meaning; this is about syntax: an emitted function must parse
        try { vm.compileFunction(text.replace(/^export /, "") + `\nreturn ${fd.name};`, [], {}); }
        catch (e) { throw new Unsupported(`emitted JS does not parse: ${String(e.message).slice(0, 80)}`); }
        P.commitClaims();
        if (mode === "fallback")
          this.log.add(
            "fallback.function",
            `${this.tu.file}:${this.src.line(posIn(fd.l, fileCtx(0)) ?? posIn(fd.b, fileCtx(0)) ?? 0) + 1}`,
            fd.name,
          );
        this.report.functions.push({ name: fd.name, mode, reasons });
        return text;
      } catch (e) {
        if (!(e instanceof Unclaimed || e instanceof NoSplice || e instanceof Unsupported)) throw e;
        reasons.push(`${mode}: ${e.constructor.name} ${e.message}`);
        this.mod.restore(snapM);
        this.macros.defs = snapDefs;
      }
    }
    this.report.functions.push({ name: fd.name, mode: "none", reasons });
    return `${fd.static ? "" : "export "}function ${fd.name}() { throw new Error("nh2js: ${fd.name} not emitted"); }`;
  }
}

export function recordClassName(r) {
  if (r.tag) return `struct_${r.tag}`.replace(/^struct_(__anon)/, "$1");
  if (r.typedef) return r.typedef;
  return `struct_${r.name}`;
}

/** A macro's JS on one line: each line break of the C definition and the spaces around it become one space. */
export function oneLine(text) { return text.replace(/[ \t]*\n[ \t]*/g, " "); }

export function macroJs(d) {
  const params = d.params.join(", ");
  if (d.kind === "const") return `export const ${d.name} = ${d.body};`;
  if (d.kind === "alias") return `export const ${d.name} = ${d.body};`;
  if (d.kind === "value") return `export function ${d.name}() { return ${d.body}; }`;
  if (d.kind === "stmt") return `export function ${d.name}(${params}) { ${d.body} }`;
  return `export function ${d.name}(${params}) { return ${d.body}; }`;
}

/** The file an enum's constants are emitted into (majority of their expansion files). */
export function enumHome(e) {
  const count = new Map();
  for (const c of e.consts) count.set(c.file, (count.get(c.file) || 0) + 1);
  if (count.size <= 1) return null;
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
