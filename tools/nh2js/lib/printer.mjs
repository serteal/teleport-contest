// lib/printer.mjs: C function bodies -> JS, printed line for line with the C.
//
// FunctionPrinter prints one function (or a macro body, a static initializer): bookkeeping of
// the rules it applies (claims), source splicing, dispatch, locals, statements, declarations
// and the function's header and frame. NODE_PRINTERS holds the printer of each Clang node
// kind (literals, names, casts, operators, calls, members, sizeof, statements), with their
// helpers next to them.
//
// In "sugar" mode a node whose JS form is the C text itself (an identity rule) is printed by
// splicing: the node's source text with each child's span replaced by the child's JS.
// Comments, spacing and line breaks inside the node survive. A node whose span cannot be
// spliced (it comes from inside a macro definition, or its children overlap) is synthesized
// from its children instead. Macro invocations that can be kept as calls are printed as
// `NAME(args)` with the same-named JS function emitted into the header module; others are
// expanded in place.
//
// "fallback" mode synthesizes every node (all macros expanded), keeping only statement
// positions and the comments between statements. It is the totality net: any function the
// sugar rules cannot claim completely is printed this way.

import path from "node:path";
import { posIn, rangeIn, siteRangeIn, exactInvocations, argInstanceOf, fileCtx, bodyCtx } from "./loc.mjs";
import { Source, countNL, cLiteralToJs, jsStringBody } from "./text.mjs";
import { Unclaimed, NoSplice, Unsupported } from "./rules.mjs";
import { Range } from "./range.mjs";
import { recordLines } from "./headers.mjs";
import { recordClassName } from "./emit.mjs";
import { EXACT64_VARS, EXACT64_RETURNS, EXACT64_PARAMS } from "./exact64.mjs";
import { lowerGotos } from "./gotos.mjs";
import { LINE_BREAK } from "./layout.mjs";

const JS_RESERVED = new Set((
  "break case catch class const continue debugger default delete do else enum export extends false finally for " +
  "function if import in instanceof new null return super switch this throw true try typeof var void while with " +
  "yield let static implements interface package private protected public await arguments eval undefined NaN " +
  "Infinity Math Number String Object Array Error JSON").split(" "));

// rt names used by emitted code: module of each
export const RT = {
  chars: "heap", uchars: "heap", stack_frame: "heap", stack_pop: "heap", memcpy: "heap",
  _: "strings",
  ord: "ctypes", idiv: "ctypes", sizeof: "ctypes", sizeof_string: "ctypes",
  char: "ctypes", schar: "ctypes", uchar: "ctypes", short: "ctypes", ushort: "ctypes", int: "ctypes",
  unsigned: "ctypes", long: "ctypes", ulong: "ctypes", float: "ctypes", double: "ctypes", bool: "ctypes",
  uint64_t: "ctypes", int64_t: "ctypes",
  view_of: "struct", addr_of: "struct", struct_assign: "struct", ptr_add: "struct", ptr_diff: "struct",
  offsetof: "struct", ptr_to: "struct", array_of: "struct", void_t: "struct", ref_to: "struct",
  ref_of: "struct", elt: "struct", struct_copy: "struct", fnptr_t: "struct", sizeof_member: "struct",
  ref_add: "struct", record_or_opaque: "struct",
  struct: "struct", union: "struct", Bitfield: "struct", bits_of: "struct",
  stack_var: "locals", stack_array: "locals", stack_struct: "locals", static_var: "locals",
  static_array: "locals", static_struct: "locals", init_list: "locals", init_string: "locals",
  static_sizeof: "locals",
  and64: "int64", or64: "int64", xor64: "int64", not64: "int64", shl64: "int64", shr64: "int64",
  and64u: "int64", or64u: "int64", xor64u: "int64", not64u: "int64", shr64u: "int64", u64: "int64", i64: "int64",
  va_start: "varargs", va_arg: "varargs", va_end: "varargs",
  chk: "checked", global_ref: "globals", setjmp_caught: "setjmp", fn_from_index: "fnptr", fn_index: "fnptr",
  SIZE: "cmacros",
};

// the exact 64-bit integer types: their values are BigInts
const BIG_TN = new Set(["uint64_t", "int64_t", "uint_fast64_t", "int_fast64_t", "uint_least64_t", "int_least64_t"]);

// an array of structs / of arrays decaying to a pointer (JS: the Array's first element)
export const isListDecay = (P, n) =>
  n && n.k === "ImplicitCastExpr" && n.ck === "ArrayToPointerDecay" && P.T.repr(n.c[0].t) === "list";

export class FunctionPrinter {
  /**
   * em: the file emitter (tu, types, index, sources, imports, rule log, macro registry)
   * fd: the FunctionDecl
   */
  constructor(em, fd, mode) {
    this.em = em;
    this.tu = em.tu;
    this.T = em.types;
    this.fd = fd;
    this.mode = mode; // "sugar" | "fallback"
    this.ctx = fileCtx(0);
    this.claims = [];
    this.locals = new Map(); // decl id -> {name, js, kind: "plain"|"stack"|"static"|..., t}
    this.needsFrame = false;
    this.paramMap = null; // when printing a macro body: pu -> param name
    this.labels = new Map(); // label name -> lowering
    this.range = new Range(this.T);
    this.switchDepth = 0;
    this.loopDepth = 0;
  }

  // ---- bookkeeping -----------------------------------------------------------------------
  claim(id, n) {
    this.claims.push([id, this.siteOf(n)]);
  }
  siteOf(n) {
    const p = n && n.b ? (posIn(n.b, this.ctx) ?? siteRangeIn(n, fileCtx(0), this.tu.invById)?.[0]) : null;
    return p == null ? null : `${this.tu.file}:${this.em.src.line(p) + 1}`;
  }
  need(name) {
    return this.mod.rt(name);
  }
  ident(name) {
    if (JS_RESERVED.has(name) || this.em.taken.has(name)) {
      this.claimed("edit.reserved-name");
      return name + "_";
    }
    return name;
  }
  claimed(id) {
    this.claims.push([id, null]);
  }

  // ---- source text ------------------------------------------------------------------------
  source(ctx) {
    return ctx.kind === "file" ? this.em.sourceOf(ctx.f) : this.em.defSourceOf(ctx);
  }

  /** Splice: node text in ctx with each kid's span replaced by its JS. Throws NoSplice. */
  src(n, ctx, kids) {
    if (this.mode !== "sugar") throw new NoSplice();
    const r = rangeIn(n, ctx);
    if (!r) throw new NoSplice();
    const S = this.source(ctx);
    const parts = [];
    for (const [k, js] of kids) {
      if (!k) continue;
      const kr = rangeIn(k, ctx);
      if (!kr || kr[0] < r[0] || kr[1] > r[1]) throw new NoSplice();
      let e = kr[1];
      // a statement printed as a complete block ({ ... }) swallows the source's own ';'
      if (k._eatSemi) {
        const m = /^[ \t]*;/.exec(S.text.slice(e, r[1]));
        if (m) e += m[0].length;
      }
      parts.push([kr[0], e, js]);
    }
    parts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    // a binary operator must be written between its operands (else the ranges are not what
    // they seem, e.g. inside a macro argument)
    if (n.op && parts.length === 2 && (n.k === "BinaryOperator" || n.k === "CompoundAssignOperator")) {
      const gap = S.clean(parts[0][1], parts[1][0]).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
      if (!gap.includes(n.op)) throw new NoSplice();
    }
    let out = "",
      cur = r[0];
    for (const [s, e, js] of parts) {
      if (s < cur) throw new NoSplice();
      out += this.between(S, cur, s) + js;
      cur = e;
    }
    out += this.between(S, cur, r[1]);
    return out;
  }

  /** Source text between spliced children, without invocations of macros that expand to nothing. */
  between(S, a, b) {
    const t = S.clean(a, b);
    if (!/[A-Za-z_]/.test(t)) return t;
    const empty = this.em.emptyMacros();
    let out = "",
      i = a;
    const re = /[A-Za-z_]\w*/g;
    re.lastIndex = a;
    let m;
    while ((m = re.exec(S.text)) && m.index < b) {
      if (!S.isCode(m.index) || !empty.has(m[0])) continue;
      let e = m.index + m[0].length;
      if (empty.get(m[0])) {
        let j = e;
        while (j < b && /\s/.test(S.text[j])) j++;
        if (S.text[j] === "(") {
          let d = 0;
          for (; j < b; j++) {
            if (S.text[j] === "(") d++;
            else if (S.text[j] === ")" && --d === 0) {
              j++;
              break;
            }
          }
          e = j;
        }
      }
      out += S.clean(i, m.index);
      this.claim("macro.expand", null);
      i = e;
      re.lastIndex = e;
    }
    return out + S.clean(i, b);
  }

  /** Splice if possible, else synthesize. */
  form(n, ctx, kids, synth) {
    if (this.mode === "sugar") {
      try {
        return this.src(n, ctx, kids);
      } catch (e) {
        if (!(e instanceof NoSplice)) throw e;
      }
    }
    return synth();
  }

  /** Text of node n spliced verbatim (for tokens that are valid JS as written), else null. */
  rawText(n, ctx) {
    if (this.mode !== "sugar") return null;
    const r = rangeIn(n, ctx);
    if (!r) return null;
    return this.source(ctx).clean(r[0], r[1]);
  }

  // ---- main dispatch ------------------------------------------------------------------------
  js(n, ctx = this.ctx, use = "value") {
    if (n == null) return "";
    if (this.paramNodes && this.paramNodes.has(n)) {
      this.claim("id.var", n);
      return this.paramNodes.get(n);
    }
    if (this.paramMap && ctx.kind === "body" && !isListDecay(this, n)) {
      const pu = argInstanceOf(n, ctx.x);
      if (pu !== null && this.paramMap.has(pu)) {
        this.claim("id.var", n);
        return this.paramMap.get(pu);
      }
    }
    if (this.mode === "sugar" && n.k !== "ImplicitCastExpr" && use !== "lvalue" && use !== "addr") {
      const m = this.em.macros.trySite(this, n, ctx, use);
      if (m !== null) return m;
    }
    const h = NODE_PRINTERS[n.k];
    if (!h) throw new Unclaimed(n.k);
    return h.call(this, n, ctx, use);
  }

  kid(n, i) {
    return n.c[i];
  }
  strip(n) {
    while (n && (n.k === "ImplicitCastExpr" || n.k === "ParenExpr")) n = n.c[0];
    return n;
  }
  stripImp(n) {
    while (n && n.k === "ImplicitCastExpr") n = n.c[0];
    return n;
  }
  ty(n) {
    return n.t;
  }

  // ---- declarations of locals ---------------------------------------------------------------
  analyzeLocals(fd) {
    const addrTaken = new Set();
    const walk = (n, parent) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "UnaryOperator" && n.op === "&") {
        const t = this.strip(n.c[0]);
        if (t && t.k === "DeclRefExpr" && (t.dk === "local" || t.dk === "param")) addrTaken.add(t.ref);
      }
      for (const c of n.c || []) walk(c, n);
      if (n.decls)
        for (const d of n.decls) {
          if (d.init) walk(d.init, n);
          for (const e of d.ext || []) walk(e, n);
        }
    };
    walk(fd.body);
    const declOf = (d, isParam) => {
      const t = d.t,
        T = this.T;
      let kind = "plain";
      if (!isParam && d.staticLocal) kind = "static";
      else if (T.isArr(t)) kind = "array";
      else if (T.isRec(t)) kind = "struct";
      else if (addrTaken.has(d.id)) kind = "stack";
      const info = { name: d.name, js: this.ident(d.name), kind, t, d, isParam };
      // a full-range 64-bit seed (lib/exact64.mjs): BigInt like uint64_t
      if (this.T.is64(t) && (EXACT64_VARS[this.fd.name] || []).includes(d.name)) {
        info.big = true;
        this.claim("edit.exact64", d);
      }
      if (kind === "stack" || kind === "array" || kind === "struct") {
        if (!(kind === "struct" && isParam)) this.needsFrame = true;
      }
      if (isParam && kind === "struct") info.kind = "struct-param";
      this.locals.set(d.id, info);
      return info;
    };
    for (const p of fd.params) declOf(p, true);
    const walkDecls = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "DeclStmt")
        for (const d of n.decls)
          if (d.k === "Var") {
            declOf(d, false);
            if (d.init) walkDecls(d.init);
          }
      for (const c of n.c || []) walkDecls(c);
    };
    walkDecls(fd.body);
    // struct pointers used as iterators (p++, p--, p += n): `p = &a[i]` may point one past the
    // end of the array (C allows it), so their &a[i] is computed from the first element
    const iters = new Set();
    const isLocalRef = (m) => {
      m = this.strip(m);
      return m && m.k === "DeclRefExpr" && (m.dk === "local" || m.dk === "param") ? m.ref : null;
    };
    const findIters = (n) => {
      if (!n || typeof n !== "object") return;
      if (
        (n.k === "UnaryOperator" && (n.op === "++" || n.op === "--")) ||
        (n.k === "CompoundAssignOperator" && (n.op === "+=" || n.op === "-="))
      ) {
        const r = isLocalRef(n.c[0]);
        if (r !== null && this.T.repr(n.c[0].t) === "view") iters.add(r);
      }
      for (const c of n.c || []) findIters(c);
      if (n.decls) for (const d of n.decls) findIters(d.init);
    };
    findIters(fd.body);
    const isElemAddr = (m) => {
      m = this.strip(m);
      return m && m.k === "UnaryOperator" && m.op === "&" && this.strip(m.c[0])?.k === "ArraySubscriptExpr" ? m : null;
    };
    const mark = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "BinaryOperator" && n.op === "=" && iters.has(isLocalRef(n.c[0]))) {
        const a = isElemAddr(n.c[1]);
        if (a) a._fromFirst = true;
      }
      if (n.decls)
        for (const d of n.decls) {
          if (d.k === "Var" && iters.has(d.id) && d.init) {
            const a = isElemAddr(d.init);
            if (a) a._fromFirst = true;
          }
          mark(d.init);
        }
      for (const c of n.c || []) mark(c);
    };
    if (iters.size) mark(fd.body);
  }

  localOf(ref) {
    return this.locals.get(ref);
  }

  /** JS type expression for a type id (for stack_var, sizeof, casts). */
  typeExpr(tid, extNodes, ctx) {
    const T = this.T,
      t = T.get(tid);
    switch (t.k) {
      case "int":
      case "bool":
      case "flt":
        return this.need(T.typeName(tid));
      case "rec":
        return this.em.recordClass(t.rec, this.mod);
      case "ptr": {
        const p = T.get(t.to);
        if (p.k === "void") return `${this.need("ptr_to")}(${this.need("void_t")})`;
        if (p.k === "fn") return this.need("fnptr_t");
        // pointer to a struct JS never declares (FILE, lua_State): named lazily, opaque
        if (p.k === "rec" && !this.tu.recByName.get(p.rec))
          return `${this.need("ptr_to")}("${this.em.opaqueName(p.rec)}")`;
        return `${this.need("ptr_to")}(${this.typeExpr(t.to, extNodes, ctx)})`;
      }
      case "arr": {
        const [first, ...rest] = extNodes || [];
        const n = first ? this.js(first, ctx) : t.n >= 0 ? this.constText(t.n) : "0";
        return `${this.need("array_of")}(${this.typeExpr(t.of, rest, ctx)}, ${n})`;
      }
      default:
        throw new Unsupported("type " + t.k);
    }
  }

  // numbers that are not written in the C (array extents known only from the compiler) are
  // not allowed in js/ (they would be position-derived); refuse rather than inline them
  constText(v) {
    throw new Unsupported(`numeric extent ${v} without a source expression (${this.fd.name})`);
  }

  // ---- exact 64-bit (uint64_t / int64_t) expressions are BigInt --------------------------------
  /** text of node n (printed as `text`) as a BigInt for a BigInt destination. */
  toBig(n, text, signed) {
    if (this.isBig(n)) return text;
    const s = this.strip(n);
    this.claim("edit.op64", n);
    if (s && s.k === "IntegerLiteral" && (signed || BigInt(s.v) >= 0n)) return bigLiteral(this, s, this.ctx);
    return `${this.need(signed ? "i64" : "u64")}(${text})`;
  }

  isBig(n) {
    if (!n || !this.T.is64(n.t)) return false;
    if (this.T.get(n.t).big || BIG_TN.has(n.tn)) return true;
    switch (n.k) {
      case "DeclRefExpr":
        return !!this.localOf(n.ref)?.big;
      case "CallExpr":
        return EXACT64_RETURNS.has(n.callee);
      case "ParenExpr":
      case "UnaryOperator":
        return this.isBig(n.c[0]);
      case "ImplicitCastExpr":
      case "CStyleCastExpr":
        if (n.ck === "LValueToRValue" || n.ck === "NoOp") return this.isBig(n.c[0]);
        return BIG_TN.has(n.twn) || false;
      case "BinaryOperator":
      case "CompoundAssignOperator":
        if (BOOL_OPS.has(n.op)) return false;
        return this.isBig(n.c[0]) || (n.op !== "<<" && n.op !== ">>" && this.isBig(n.c[1]));
      case "ConditionalOperator":
        return this.isBig(n.c[1]) || this.isBig(n.c[2]);
      default:
        return false;
    }
  }

  // ---- arrays: initializer tables and written extents ------------------------------------------
  tableSpread(n, ctx, cs) {
    const S = this.source(ctx),
      inv = this.tu.invById;
    const r = rangeIn(n, ctx);
    if (!r || S.text[r[0]] !== "{") return null;
    const fileOf = (k) => {
      let L = k.b;
      for (let g = 0; L && L.f === undefined && g < 64; g++) L = L.up;
      return L ? L.f : -1;
    };
    const runs = [];
    let cur = null;
    for (const k of cs) {
      if (!k || k.k === "ImplicitValueInitExpr") return null;
      const here = siteRangeIn(k, ctx, inv);
      if (here) {
        cur = null;
        continue;
      }
      const f = fileOf(k);
      if (f < 0 || f === ctx.f) return null;
      if (!cur || cur.fi !== f) runs.push((cur = { fi: f, kids: [] }));
      cur.kids.push(k);
    }
    if (!runs.length) return null;
    // splice: elements of this file as usual, each run at its #include line
    const parts = [];
    let ri = 0,
      prevEnd = r[0] + 1;
    const flush = (before) => {
      const run = runs[ri++];
      const fn = `${this.tableVar}_records${ri > 1 ? ri : ""}`;
      (this.em.tables ||= []).push({ fn, var: this.tableVar, fi: run.fi, kids: run.kids, P: this });
      const m = /#\s*include[^\n]*/.exec(S.text.slice(prevEnd, before));
      const at = m ? prevEnd + m.index : prevEnd;
      parts.push([at, at, `...${fn}(),`]);
    };
    let inRun = false;
    for (const k of cs) {
      const here = siteRangeIn(k, ctx, inv);
      if (!here) {
        inRun = true;
        continue;
      }
      if (inRun) {
        flush(here[0]);
        inRun = false;
      }
      const s = this.strip(k);
      parts.push([here[0], here[1], s.k === "InitListExpr" ? this.initList(s, ctx) : this.js(k, ctx)]);
      prevEnd = here[1];
    }
    if (inRun) flush(r[1] - 1);
    let out = "[",
      at = r[0] + 1;
    for (const [s0, e0, js] of parts) {
      out += this.between(S, at, s0) + js;
      at = e0;
    }
    out += this.between(S, at, r[1] - 1) + "]";
    this.claim("id.init-list", n);
    return out;
  }

  /** The written extents (outermost first) of the array an expression names, or null. */
  extentsOf(e) {
    e = this.strip(e);
    if (!e) return null;
    if (e.k === "DeclRefExpr") {
      const L = this.localOf(e.ref);
      if (L) return L.d?.ext || null;
      if (e.dk === "global" || e.dk === "extern-local") return this.em.fileDecl(e.name)?.ext || e.ext || null;
      return null;
    }
    if (e.k === "ArraySubscriptExpr") {
      const b = e.c[0];
      const ext = b.k === "ImplicitCastExpr" && b.ck === "ArrayToPointerDecay" ? this.extentsOf(b.c[0]) : null;
      return ext && ext.length > 1 ? ext.slice(1) : null;
    }
    return null;
  }

  // ---- statements ------------------------------------------------------------------------------
  // expression used as a statement (and statement printing with line padding)
  stmt(n, ctx, opts = {}) {
    if (!n) return "";
    const t = this.stmtInner(n, ctx, opts);
    // labels/loops added by goto lowering on a statement that is not directly in a block
    return opts.inBlock ? t : wrapPrePost(n, t);
  }

  stmtInner(n, ctx, opts) {
    if (STMT_KINDS.has(n.k)) {
      if (n.k === "CompoundStmt" && opts.switchBody) {
        this.claim("id.compound", n);
        return this.block(n, ctx, n.c, { ...opts, inBlock: false });
      }
      return this.js(n, ctx);
    }
    // an expression statement: the ';' is outside the expression's range
    this.claim("id.expr-stmt", n);
    const E = this.js(n, ctx, "discard");
    return E;
  }

  /** A statement list: splice the gaps (comments, blank lines) from the source between statements. */
  block(n, ctx, kids, opts = {}) {
    const S = this.source(ctx);
    const r = this.mode === "sugar" || ctx.kind === "file" ? rangeIn(n, ctx) : null;
    const flat = () =>
      `{ ${kids.map((k) => (k._pre || "") + this.stmtWithSemi(k, ctx, opts) + (k._post || "")).join(" ")} }`;
    if (!r) return flat();
    // group children by their site range in ctx (statements produced by one macro invocation
    // share the invocation's site)
    const groups = [];
    for (const k of kids) {
      const sr = siteRangeIn(k, ctx, this.tu.invById);
      if (!sr || sr[0] < r[0] || sr[1] > r[1]) return flat();
      const last = groups[groups.length - 1];
      if (last && sr[0] < last.e) {
        last.kids.push(k);
        last.e = Math.max(last.e, sr[1]);
        last.macro = true;
      } else groups.push({ s: sr[0], e: sr[1], kids: [k], macro: !rangeIn(k, ctx) });
    }
    let out = "",
      cur = r[0];
    // between statements only ';' is code; other tokens are macros that expanded to nothing
    const gapText = (a, b, first) =>
      S.cleanCode(a, b, (i) => S.text[i] !== ";" && !(first && i === r[0]) && S.text[i] !== "}" && S.text[i] !== "{");
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (g.s < cur) return flat();
      out += gapText(cur, g.s, gi === 0);
      let text,
        end = g.e;
      const k0 = g.kids[0],
        kl = g.kids[g.kids.length - 1];
      if (g.macro) {
        this.claim("macro.expand-stmts", k0);
        text = g.kids
          .map((k) => this.stmtWithSemi(k, ctx, opts))
          .join(" ")
          .replace(/;\s*$/, "");
      } else if (this.mode === "sugar") {
        text =
          k0.k === "DeclStmt" ? this.declStmt(k0, ctx, false, opts) : this.stmt(k0, ctx, { ...opts, inBlock: true });
      } else {
        // fallback: synthesized statement on its first line
        text = this.stmtWithSemi(k0, ctx, opts);
        if (!STMT_KINDS.has(k0.k)) {
          const m = /^[ \t]*;/.exec(S.text.slice(g.e, r[1]));
          if (m) end = g.e + m[0].length;
        }
      }
      if (k0._pre) text = k0._pre + text;
      if (kl._post) {
        // after the statement's own ';'
        if (end === g.e) {
          const m = /^[ \t]*;/.exec(S.text.slice(g.e, r[1]));
          if (m) {
            text += m[0];
            end = g.e + m[0].length;
          }
        }
        if (!/[;}]\s*$/.test(text)) text += ";";
        text += kl._post;
      } else if (kl._eatSemi && end === g.e) {
        const m = /^[ \t]*;/.exec(S.text.slice(g.e, r[1]));
        if (m) end = g.e + m[0].length;
      }
      out += pad(text, countNL(S.text.slice(g.s, end)));
      cur = end;
    }
    out += gapText(cur, r[1], false);
    // braces spelled inside a macro (VA_DECL ... { / VA_END() ... }) are not in the text
    if (n.k === "CompoundStmt") {
      if (S.text[r[0]] !== "{") out = "{ " + out;
      if (S.text[r[1] - 1] !== "}") out = out.replace(/(\s*)$/, " }$1");
    }
    return out;
  }

  // statement text for an element of a block whose site range is [g.s, g.e) in ctx
  stmtWithSemiInPlace(k, ctx, opts, g) {
    if (k.k === "DeclStmt") return this.declStmt(k, ctx, false, opts);
    return this.stmt(k, ctx, opts);
  }

  // statement text including its ';' (for synthesized blocks)
  stmtWithSemi(k, ctx, opts) {
    const t = k.k === "DeclStmt" ? this.declStmt(k, ctx, false, opts) : this.stmt(k, ctx, { ...opts, inBlock: true });
    if (STMT_KINDS.has(k.k)) return t;
    return t + ";";
  }

  // ---- declarations ----------------------------------------------------------------------------
  declStmt(n, ctx, inFor, opts = {}) {
    const T = this.T;
    const vars = n.decls.filter((d) => d.k === "Var");
    const others = n.decls.filter((d) => d.k !== "Var");
    const local = others.some((d) => d.k === "Record" || d.k === "Enum") ? this.localTypeLines(n, ctx, others) : null;
    if (!vars.length) {
      this.claim("decl.drop", n);
      return local ? local.text("") : "";
    }
    const S = this.source(ctx);
    const parts = [];
    for (const d of vars) {
      if (d.sc === "extern") {
        this.claim("decl.drop", n);
        continue;
      }
      const L = this.locals.get(d.id);
      const name = L.js;
      let text,
        alloc = null,
        initText = null;
      if (L.kind === "static") text = this.staticLocal(d, L, ctx);
      else if (L.kind === "stack") {
        this.claim("decl.stack-var", n);
        const ty = L.big
          ? this.need(T.signed(d.t) ? "int64_t" : "uint64_t")
          : this.em.typedefAlias(d.tn, d.t, this.mod) || this.typeExpr(d.t, d.ext, ctx);
        const iv = d.init
          ? L.big
            ? this.toBig(d.init, this.js(d.init, ctx), T.signed(d.t))
            : this.js(d.init, ctx)
          : null;
        text = `${name} = ${this.need("stack_var")}(${ty}${iv !== null ? ", " + iv : ""})`;
        alloc = `${this.need("stack_var")}(${ty})`;
        initText = iv !== null ? `${name}[0] = ${iv}` : null;
      } else if (L.kind === "array") {
        this.claim("decl.stack-array", n);
        const at = T.get(d.t);
        const ext = d.ext || [];
        const elem = this.typeExpr(at.of, ext.slice(1), ctx);
        let count;
        const si0 = d.init ? this.strip(d.init) : null;
        if (ext[0]) count = this.js(ext[0], ctx);
        else if (si0 && (si0.k === "StringLiteral" || si0.k === "InitListExpr")) count = null;
        else throw new Unsupported("array local without extent");
        if (d.init) {
          const si = si0;
          if (si.k === "StringLiteral") {
            this.claim("decl.string-init", n);
            const lit = this.js(si, ctx);
            const sa = `${this.need("stack_array")}(${elem}, ${count ?? `${this.need("sizeof_string")}(${lit})`})`;
            text = `${name} = ${this.need("init_string")}(${sa}, ${this.need("_")}(${lit}))`;
            alloc = sa;
            initText = `${this.need("init_string")}(${name}, ${this.need("_")}(${lit}))`;
          } else if (si.k === "InitListExpr") {
            this.claim("decl.init-list", n);
            // (an extent the initializer gives: stack_array counts the list)
            const list = this.initList(si, ctx);
            text =
              count === null
                ? `${name} = ${this.need("stack_array")}(${elem}, null, ${list})`
                : `${name} = ${this.need("init_list")}(${this.need("stack_array")}(${elem}, ${count}), ${list})`;
            alloc =
              count === null
                ? `${this.need("stack_array")}(${elem}, null, ${list})`
                : `${this.need("stack_array")}(${elem}, ${count})`;
            initText = `${this.need("init_list")}(${name}, ${list})`;
          } else throw new Unsupported("array initializer " + si.k);
        } else {
          text = `${name} = ${this.need("stack_array")}(${elem}, ${count})`;
          alloc = `${this.need("stack_array")}(${elem}, ${count})`;
          initText = null;
        }
      } else if (L.kind === "struct") {
        this.claim("decl.stack-struct", n);
        const cls = this.typeExpr(d.t, null, ctx);
        alloc = `${this.need("stack_struct")}(${cls})`;
        initText = null;
        if (d.init) {
          const si = this.strip(d.init);
          if (si.k === "InitListExpr") {
            this.claim("decl.init-list", n);
            const list = this.initList(si, ctx);
            text = `${name} = ${this.need("init_list")}(${alloc}, ${list})`;
            initText = `${this.need("init_list")}(${name}, ${list})`;
          } else {
            this.claim("edit.struct-assign", n);
            const v = this.js(d.init, ctx);
            text = `${name} = ${this.need("struct_assign")}(${alloc}, ${v})`;
            initText = `${this.need("struct_assign")}(${name}, ${v})`;
          }
        } else text = `${name} = ${alloc}`;
      } else {
        this.claim("decl.let", n);
        text = d.init
          ? `${name} = ${L.big ? this.toBig(d.init, this.js(d.init, ctx), T.signed(d.t)) : this.js(d.init, ctx)}`
          : name;
      }
      // a goto may jump into this block past the declaration (dispatcher): C storage exists for the
      // whole function, so the memory is allocated when the function starts, initialised here
      // a static local there: its (idempotent) declaration runs at function start, so a goto past
      // it still finds the storage (steal.c's `how` table)
      // (not one of a type declared in the function: that type exists only from its line)
      const usesLocalType =
        this.localTypeNames &&
        [...this.localTypeNames].some((c) => new RegExp(`\\b${c.replace(/\$/g, "\\$")}\\b`).test(text));
      if (L.kind === "static" && this.gotoVars?.has("$goto") && !usesLocalType) {
        this.claim("decl.hoisted-static", n);
        (this.hoisted ||= []).push(text.replace(/\s*\n\s*/g, " "));
        continue;
      }
      if (alloc && this.gotoVars?.has("$goto")) {
        this.claim("decl.hoisted-alloc", n);
        (this.hoisted ||= []).push(`${name} = ${alloc}`);
        if (initText === null) continue;
        // (the variable is declared once, at the top: here only its initialisation)
        parts.push([d, initText, true]);
        continue;
      }
      parts.push([d, text, false]);
    }
    if (!parts.length) return "";
    // separators: keep line breaks between declarators; declarations are `kw a = .., b = ..;`,
    // initialisations of hoisted variables are statements of their own
    const kw = opts.switchBody || this.forceVar ? "var" : "let";
    if (opts.switchBody) this.claim("decl.switch-var", n);
    let out = "",
      open = false;
    for (let i = 0; i < parts.length; i++) {
      let ws = "";
      if (i) {
        const prev = parts[i - 1][0],
          cur = parts[i][0];
        const pe = posIn(prev.e, ctx),
          cb = posIn(cur.l, ctx);
        ws = " ";
        if (pe !== null && cb !== null && cb > pe) {
          const gap = S.text.slice(pe, cb);
          const nl = countNL(gap);
          if (nl) ws = "\n".repeat(nl) + (/\n([ \t]*)[^\n]*$/.exec(gap)?.[1] ?? "");
        }
      }
      const [, t, isExpr] = parts[i];
      if (isExpr) {
        if (open) {
          out += ";";
          open = false;
        }
        out += ws + t + ";";
      } else if (open) out += "," + ws + t;
      else {
        out += ws + `${kw} ` + t;
        open = true;
      }
    }
    if (open) out += ";";
    const text = out;
    if (local) return local.text(text, posIn(parts[0][0].l, ctx));
    return text;
  }

  /**
   * struct/union/enum types declared in a block (`struct tporttypes { ... } tports[] = ...`):
   * each on its own lines, as a function-local record class or constants. Returns text(varText,
   * varPos) giving the declaration's lines with the variables put on the line of the first one.
   */
  localTypeLines(n, ctx, others) {
    if (ctx.kind !== "file" || ctx.f !== 0) throw new Unsupported("local type declaration in a macro");
    const S = this.source(ctx);
    const r = rangeIn(n, ctx);
    if (!r) throw new NoSplice();
    const first = S.line(r[0]),
      last = S.line(Math.max(r[0], r[1] - 1));
    const lines = new Map();
    const srcLines = S.text.split("\n");
    const put = (ln, t) =>
      lines.set(ln, lines.has(ln) ? lines.get(ln) + " " + t : /^[ \t]*/.exec(srcLines[ln] || "")[0] + t);
    const inDecl = this.tu.records.filter((x) => x.b && x.b.f === 0 && x.e && x.b.o >= r[0] && x.e.o <= r[1]);
    for (const d of others) {
      if (d.k === "Record") {
        if (!d.complete) {
          this.claim("decl.drop", n);
          continue;
        }
        const rec = inDecl.find((x) => x.name === d.rec);
        if (!rec) throw new Unsupported("local record " + d.rec);
        // printed inline by the outer one
        if (inDecl.some((y) => y !== rec && rec.b.o >= y.b.o && rec.e.o <= y.e.o)) continue;
        const saved = this.localTypes;
        this.localTypes = true;
        (this.localTypeNames ||= new Set()).add(recordClassName(rec));
        try {
          for (const [ln, t] of recordLines(
            rec,
            inDecl,
            this,
            S,
            null,
            false,
            null,
            `${this.fd.name}.${recordClassName(rec)}`,
          ))
            put(ln, t);
        } finally {
          this.localTypes = saved;
        }
        this.claim("decl.local-type", n);
      } else if (d.k === "Enum") {
        const p = posIn(d.b, ctx);
        const e = this.tu.enums.find((x) => x.b && posIn(x.b, ctx) === p);
        if (!e) throw new Unsupported("local enum " + d.name);
        e.consts.forEach((c, i) => {
          const val = c.explicit && c.init ? this.js(c.init, ctx) : i ? `${e.consts[i - 1].name} + 1` : "0";
          put(c.line - 1, `const ${c.name} = ${val};`);
        });
        this.claim("decl.local-type", n);
      } else this.claim("decl.drop", n);
    }
    return {
      text: (varText, varPos) => {
        // the variables (possibly several lines: an initializer table) start on their line
        const vl = varText ? Math.max(first, varPos == null ? last : S.line(varPos)) : last + 1;
        const out = [];
        for (let ln = first; ln < vl && ln <= last; ln++) out.push(lines.get(ln) ?? "");
        if (varText) out.push(lines.has(vl) ? lines.get(vl) + " " + varText : varText);
        return out.join("\n").replace(/^\s+/, "");
      },
    };
  }

  staticLocal(d, L, ctx) {
    this.claim("decl.static-local", d);
    const T = this.T,
      key = `${this.fd.name}.${d.name}`;
    if (T.isArr(d.t)) {
      const at = T.get(d.t),
        ext = d.ext || [];
      const si = d.init ? this.strip(d.init) : null;
      let count;
      if (ext[0]) count = this.js(ext[0], ctx);
      else if (si && si.k === "StringLiteral") count = `${this.need("sizeof_string")}(${this.js(si, ctx)})`;
      else if (si && si.k === "InitListExpr") count = "null";
      else throw new Unsupported("static array without extent");
      if (si && si.k === "InitListExpr") {
        // static_array fills it from the list (once, for a runtime-owned static)
        const head = `${L.js} = ${this.need("static_array")}("${key}", ${this.typeExpr(at.of, ext.slice(1), ctx)}`;
        return `${head}, ${count}, ${this.initList(si, ctx)})`;
      }
      const base = `${this.need("static_array")}("${key}", ${this.typeExpr(at.of, ext.slice(1), ctx)}, ${count})`;
      if (si) {
        if (si.k === "StringLiteral")
          return `${L.js} = ${this.need("init_string")}(${base}, ${this.need("_")}(${this.js(si, ctx)}), true)`;
        throw new Unsupported("static array init");
      }
      return `${L.js} = ${base}`;
    }
    if (T.isRec(d.t)) {
      const base = `${this.need("static_struct")}("${key}", ${this.typeExpr(d.t, null, ctx)})`;
      if (d.init) {
        const head = `${L.js} = ${this.need("static_struct")}("${key}", ${this.typeExpr(d.t, null, ctx)}`;
        return `${head}, ${this.initList(this.strip(d.init), ctx)})`;
      }
      return `${L.js} = ${base}`;
    }
    L.scalar = true;
    const head = `${L.js} = ${this.need("static_var")}("${key}", ${this.typeExpr(d.t, d.ext, ctx)}`;
    return `${head}${d.init ? ", " + this.js(d.init, ctx) : ""})`;
  }

  initList(n, ctx) {
    // arrays: positional values `[a, b]`; structs/unions: named-field records `{ f: a, g: b }`
    // (fields in declaration order, unnamed bit-fields skipped as C does). Fillers are zero (the
    // memory is zeroed), trailing ones are dropped. Spliced from the C text when its braces are
    // written and it has no designators, so the line breaks and comments of a table survive.
    const T = this.T;
    const cs = n.c.slice();
    while (cs.length && (!cs[cs.length - 1] || cs[cs.length - 1].k === "ImplicitValueInitExpr")) cs.pop();
    let names = null;
    if (T.isRec(n.t)) {
      const r = this.tu.recByName.get(T.recName(n.t));
      if (!r) throw new Unsupported("initializer of an undeclared record");
      if (r.union) names = [n.ufield || (r.fields[0] && r.fields[0].name)];
      else names = r.fields.filter((f) => !(f.bits !== undefined && !f.name)).map((f) => f.name);
      if (names.some((x) => !x) || cs.length > names.length)
        throw new Unsupported("initializer of a record with anonymous members");
    }
    const items = [],
      kids = [];
    cs.forEach((c, i) => {
      const key = names ? `${names[i]}: ` : "";
      if (!c || c.k === "ImplicitValueInitExpr") {
        if (!names) items.push("0");
        kids.push(null);
        return;
      }
      const s = this.strip(c);
      const t = key + (s.k === "InitListExpr" ? this.initList(s, ctx) : this.js(c, ctx));
      items.push(t);
      kids.push([s.k === "InitListExpr" ? s : c, t]);
    });
    const [open, close] = names ? ["{ ", " }"] : ["[", "]"];
    // a file-scope table some of whose elements come from an included header (mons_init[] =
    // { #include "monsters.h" <terminator> }): those elements are a function after the imports,
    // laid out like the header, spread where the #include is
    if (
      (!names && this.tableVar && ctx.kind === "file" && this.em.tables !== undefined) ||
      (!names && this.tableVar && ctx.kind === "file")
    ) {
      const t = this.tableSpread(n, ctx, cs);
      if (t !== null) return t;
    }
    if (this.mode === "sugar" && !kids.includes(null)) {
      const r = rangeIn(n, ctx),
        S = this.source(ctx);
      if (r && S.text[r[0]] === "{" && S.text[r[1] - 1] === "}") {
        // splice: each element's text replaced by its JS, only commas, braces, comments and line
        // breaks between them (no designator `.f =`, no rest of a macro around an element: then
        // the element's whole invocation is its span, else synthesize)
        for (const spanOf of [(k) => rangeIn(k, ctx), (k) => siteRangeIn(k, ctx, this.tu.invById)]) {
          const spans = kids.map(([k]) => spanOf(k));
          if (spans.some((x) => !x)) continue;
          let ok = true,
            cur = r[0] + 1;
          for (const [a, b] of spans) {
            if (a < cur || b > r[1] - 1) {
              ok = false;
              break;
            }
            if (!/^[\s,]*$/.test(S.clean(cur, a).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))) {
              ok = false;
              break;
            }
            cur = b;
          }
          if (ok && !/^[\s,]*$/.test(S.clean(cur, r[1] - 1).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))) ok = false;
          if (!ok) continue;
          let t = "",
            at = r[0] + 1;
          spans.forEach(([a, b], i) => {
            t += S.clean(at, a) + kids[i][1];
            at = b;
          });
          t += S.clean(at, r[1] - 1);
          this.claim(names ? "id.init-record" : "id.init-list", n);
          return names ? `{${t}}` : `[${t}]`;
        }
      }
    }
    this.claim(names ? "id.init-record" : "id.init-list", n);
    // synthesized (from a macro: MON(...), A(...)): keep the line breaks of the invocation
    const S = this.source(ctx),
      srcLines = (this._srcLines ||= new Map());
    let lines = srcLines.get(S);
    if (!lines) srcLines.set(S, (lines = S.text.split("\n")));
    // (a record a macro builds: fields it sets to zero are left out, the memory is zeroed; an
    // array's trailing zero elements likewise: NO_ATTK fillers)
    const isZero = (t) => /^(0|null|\{\}|\[\])$/.test(t.trim()) || /^\{\s*\}$/.test(t);
    let last = kids.length - 1;
    if (!names) while (last >= 0 && kids[last] && isZero(kids[last][1])) last--;
    let joined = "",
      prev = -1;
    kids.forEach((k, i) => {
      if (!k || i > last) return;
      if (names && isZero(k[1].slice(k[1].indexOf(":") + 1))) return;
      const r = rangeIn(k[0], ctx) || siteRangeIn(k[0], ctx, this.tu.invById);
      const ln = r ? S.line(r[0]) : prev;
      // (table rows: a long row is wrapped at a field, so a search for one field prints a short line)
      const tail = joined.length - joined.lastIndexOf("\n") - 1;
      if (joined)
        joined +=
          prev >= 0 && ln > prev
            ? ",\n" + /^[ \t]*/.exec(lines[ln] || "")[0]
            : this.wrapRows && tail + k[1].length > 96 && !/\n/.test(k[1])
              ? ",\n        "
              : ", ";
      joined += k[1];
      if (ln >= 0) prev = Math.max(prev, ln);
    });
    if (!names) {
      joined = items.length === kids.filter(Boolean).length ? joined : items.join(", ");
    }
    return names ? (joined ? `{ ${joined} }` : "{}") : `[${joined}]`;
  }

  // ---- whole functions: header, body, frame, claims --------------------------------------------
  child(ctx, paramMap, mod) {
    const P = new FunctionPrinter(this.em, this.fd, "sugar");
    P.ctx = ctx;
    P.paramMap = paramMap;
    P.mod = mod;
    P.locals = new Map();
    return P;
  }

  commitClaims() {
    const fn = this.fd && this.fd.body ? this.fd.name : null;
    for (const [id, site] of this.claims) this.em.log.add(id, site, fn);
    this.claims = [];
  }

  functionText() {
    const fd = this.fd,
      em = this.em,
      S = this.source(this.ctx),
      T = S.text;
    this.analyzeLocals(fd);
    lowerGotos(this, fd);
    if (this.forceVar) this.renameShadowed(fd);
    const ctx = this.ctx;
    const fr = rangeIn(fd, ctx) || siteRangeIn(fd, ctx, this.tu.invById),
      br = rangeIn(fd.body, ctx),
      nl = posIn(fd.l, ctx);
    if (!fr) throw new NoSplice();
    const params = [];
    for (const p of fd.params) {
      const L = this.locals.get(p.id);
      params.push(L.kind === "stack" ? `${L.js}$` : L.js);
    }
    if (!br || nl === null || this.mode === "fallback") return this.plainFunctionText(fr, params);
    // header: [export ]function name(params) { /* ret */
    const head = T.slice(fr[0], br[0]);
    const ret = S.clean(fr[0], nl)
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, " ")
      .replace(/\b(staticfn|static|extern|inline|NEARDATA|ATTRNORETURN|NORETURN)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const exp = fd.static ? "" : "export ";
    const beforeName = T.slice(fr[0], nl);
    let out = `${exp}function ${fd.name}(`;

    this.claim("fn.header", fd);
    if (fd.va) this.claim("fn.variadic", fd);
    // keep line breaks inside the parameter list: each name stays on its line
    const paren = head.indexOf("(", nl - fr[0]);
    let close = -1;
    for (let i = br[0] - 1; i > fr[0]; i--)
      if (T[i] === ")" && S.isCode(i)) {
        close = i - fr[0];
        break;
      }
    let at = fr[0] + paren + 1;
    fd.params.forEach((p, i) => {
      const pl = posIn(p.l, ctx);
      const gap = pl !== null && pl >= at ? T.slice(at, pl) : "";
      const nlc = countNL(gap);
      const lineStart = T.lastIndexOf("\n", pl - 1) + 1;
      out +=
        (i ? "," : "") +
        (nlc ? "\n".repeat(nlc) + /^[ \t]*/.exec(T.slice(lineStart, pl))[0] : i ? " " : "") +
        params[i];
      if (pl !== null) at = pl;
    });
    if (fd.va) out += (fd.params.length ? ", " : "") + "...args";
    out += "\n".repeat(Math.max(0, countNL(T.slice(at, fr[0] + close)))) + ")";
    // the body's `{` on the line of the name; after it the C return type and any comment written
    // between ) and {; the lines the C spends on the return type and the brace follow (blank)
    const between = S.clean(fr[0] + close + 1, br[0]);
    const body = this.bodyText(ctx);
    if (body.startsWith("{") && !/\S/.test(between.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))) {
      const note = [ret ? `/* ${ret} */` : "", between.replace(/\s+/g, " ").trim()].filter(Boolean).join(" ");
      out += " {" + (note ? " " + note : "") + "\n".repeat(countNL(beforeName) + countNL(between)) + body.slice(1);
    } else out += (ret ? ` /* ${ret} */` : "") + "\n".repeat(countNL(beforeName)) + between + body;
    const want = countNL(T.slice(fr[0], fr[1]));
    if (countNL(out) !== want) out = pad(out, want);
    if (countNL(out) !== want) throw new NoSplice();
    return out;
  }

  /**
   * The function in the plain dialect (fallback mode, or a header/body the C spells through
   * macros, like panic VA_DECL(...) { ... VA_END(); }): a synthesized header on the first line,
   * the body printed from the AST, the same line span.
   */
  plainFunctionText(fr, params) {
    const fd = this.fd,
      ctx = this.ctx,
      S = this.source(ctx),
      T = S.text;
    const bs = rangeIn(fd.body, ctx) || siteRangeIn(fd.body, ctx, this.tu.invById);
    const ret = this.T.get(fd.ret).s;
    this.claim("fn.header", fd);
    if (fd.va) this.claim("fn.variadic", fd);
    const rest = fd.va ? (params.length ? ", " : "") + "...args" : "";
    let out = `${fd.static ? "" : "export "}function ${fd.name}(${params.join(", ")}${rest}) `;
    const nls = bs ? "\n".repeat(countNL(T.slice(fr[0], bs[0]))) : "";
    const body = this.bodyText(ctx);
    // `{` on the header line, then the C return type
    if (body.startsWith("{")) out += `{ /* ${ret} */` + nls + body.slice(1);
    else out += `/* ${ret} */ ` + nls + body;
    const want = countNL(T.slice(fr[0], fr[1]));
    out = pad(out, want);
    if (countNL(out) !== want) throw new NoSplice();
    return out;
  }

  // The code a function body starts with (stack frame, boxed parameters, goto state) is on lines
  // of its own after the `{` (LINE_BREAK: a line break lib/layout.mjs makes, outside the C line
  // count), four spaces in; `} finally { stack_pop($frame); }` on the line before the last `}`.
  bodyText(ctx) {
    const fd = this.fd;
    let body = this.js(fd.body, ctx);
    const lead = [];
    const boxed = [...this.locals.values()].filter((L) => L.isParam && L.kind === "stack");
    const frame = this.needsFrame || boxed.length;
    if (frame) {
      this.claim("fn.frame", fd);
      lead.push(`const $frame = ${this.need("stack_frame")}(); try {`);
      for (const L of boxed) {
        this.claim("decl.param-boxed", fd);
        lead.push(`const ${L.js} = ${this.need("stack_var")}(${this.typeExpr(L.t, null, ctx)}, ${L.js}$);`);
      }
    }
    if (this.gotoVars)
      lead.push(
        `let ${[...this.gotoVars].map(([v, init]) => `${v} = ${init}`).join(", ")};` +
          (this.hoisted ? ` var ${this.hoisted.join(", ")};` : ""),
      );
    if (lead.length) body = body.replace(/^\{/, "{" + lead.map((l) => LINE_BREAK + "    " + l).join(""));
    if (frame) {
      const fin = `} finally { ${this.need("stack_pop")}($frame); }`;
      const m = /\n([ \t]*)\}(\s*)$/.exec(body);
      body = m
        ? body.slice(0, m.index) + `\n${m[1]}    ${fin}${LINE_BREAK}${m[1]}}${m[2]}`
        : body.replace(/\}(\s*)$/, `${fin} }$1`);
    }
    return body;
  }

  /**
   * In a function whose locals are `var` (gotos: one scope for the whole function), a block local
   * that shadows a local or parameter of an enclosing block would be the same variable: it gets
   * its own name (`x$2`). Sibling blocks reusing a name are fine (their lifetimes do not overlap).
   */
  renameShadowed(fd) {
    const live = new Map(); // name -> declarations in enclosing scopes
    for (const p of fd.params) live.set(p.name, 1);
    const used = new Set([...this.locals.values()].map((L) => L.js));
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "CompoundStmt" || n.k === "ForStmt") {
        const declared = [];
        const scan = (m) => {
          if (!m || m.k !== "DeclStmt") return;
          for (const d of m.decls)
            if (d.k === "Var") {
              if (live.get(d.name)) {
                const L = this.locals.get(d.id);
                if (L) {
                  let k = 2;
                  while (used.has(`${d.name}$${k}`)) k++;
                  L.js = `${d.name}$${k}`;
                  used.add(L.js);
                  this.claim("decl.shadow-rename", fd);
                }
              }
              declared.push(d.name);
              live.set(d.name, (live.get(d.name) || 0) + 1);
            }
        };
        const kids = n.k === "ForStmt" ? [n.c[0]] : n.c;
        for (const c of kids) {
          scan(c);
          walk(c);
        }
        if (n.k === "ForStmt") for (const c of n.c.slice(1)) walk(c);
        for (const x of declared) live.set(x, live.get(x) - 1);
        return;
      }
      for (const c of n.c || []) walk(c);
    };
    walk(fd.body);
  }
}


// =========================================================================================
// Node printers: NODE_PRINTERS[kind](n, ctx, use) prints a node of that Clang kind. It is
// called with `this` bound to the FunctionPrinter (FunctionPrinter.js dispatches here); the
// helpers below take the printer as their first parameter, P.
// =========================================================================================
const NODE_PRINTERS = {};

// a null pointer constant, possibly parenthesised and cast between pointer types: ((FILE *) 0)
const isNullConst = (P, n) => {
  for (let s = n, guard = 0; s && guard < 16; guard++) {
    if ((s.k === "ImplicitCastExpr" || s.k === "CStyleCastExpr") && s.ck === "NullToPointer") return true;
    if (s.k === "CStyleCastExpr" && s.ck === "IntegralToPointer") {
      const v = P.strip(s.c[0]);
      return !!v && v.k === "IntegerLiteral" && v.v === "0";
    }
    const cast = s.k === "ImplicitCastExpr" || s.k === "CStyleCastExpr";
    if (s.k === "ParenExpr" || (cast && (s.ck === "BitCast" || s.ck === "NoOp" || s.ck === "LValueToRValue"))) {
      s = s.c[0];
      continue;
    }
    return false;
  }
  return false;
};

// ---- literals ---------------------------------------------------------------------------
/** An integer literal as an exact BigInt literal (its written spelling when there is one). */
function bigLiteral(P, n, ctx) {
  const raw = P.rawText(n, ctx);
  if (raw !== null && /^(0[xX][0-9a-fA-F]+|[1-9]\d*|0)[uUlL]*$/.test(raw)) return raw.replace(/[uUlL]+$/, "") + "n";
  return BigInt(n.v).toString() + "n";
}
NODE_PRINTERS.IntegerLiteral = function (n, ctx) {
  // __LINE__ is never written into js/ (a position): 0. Its only users pass it on to messages
  // of conditions that do not happen (Strlen_ of a 32767-byte string, nh_snprintf's #if 0 report)
  if (n.b && builtinMacroOf(this, n) === "__LINE__") { this.claim("edit.line-number", n); return "0"; }
  const raw = this.rawText(n, ctx);
  if (raw !== null && /^(0[xX][0-9a-fA-F]+|[1-9]\d*|0)$/.test(raw)) { this.claim("id.int-literal", n); return raw; }
  this.claim("edit.int-suffix", n);
  const v = BigInt(n.v);
  if (v > 2n ** 53n || v < -(2n ** 53n)) {
    // a 64-bit value a Number cannot hold exactly (LLONG_MAX sentinels): the nearest Number,
    // logged for audit (BigInt contexts print an exact BigInt literal instead)
    this.claim("edit.int-literal-inexact", n);
    return raw !== null && /^0[xX]/.test(raw) ? raw.replace(/[uUlL]+$/, "") : String(v);
  }
  if (raw !== null && /^0[xX]/.test(raw)) return raw.replace(/[uUlL]+$/, "");
  if (raw !== null && /^0[0-7]+[uUlL]*$/.test(raw)) return "0o" + raw.replace(/[uUlL]+$/, "").slice(1);
  if (raw !== null && /^\d+[uUlL]+$/.test(raw)) return raw.replace(/[uUlL]+$/, "");
  return String(v);
};

NODE_PRINTERS.CharacterLiteral = function (n, ctx) {
  this.claim("edit.char-literal", n);
  this.need("ord");
  const raw = this.rawText(n, ctx);
  if (raw !== null && /^'.*'$/s.test(raw)) return `ord(${cLiteralToJs(raw)})`;
  return `ord("${jsStringBody([n.v & 255])}")`;
};

NODE_PRINTERS.FloatingLiteral = function (n, ctx) {
  this.claim("id.float-literal", n);
  const raw = this.rawText(n, ctx);
  if (raw !== null && /^[\d.eE+-]+$/.test(raw)) return raw;
  if (raw !== null) return raw.replace(/[fFlL]$/, "");
  return String(n.v);
};

/** Name of the builtin macro (__FILE__, __LINE__, ...) whose whole expansion n is, or null. */
export function builtinMacroOf(P, n) {
  for (const x of exactInvocations(n)) { const v = P.tu.invById.get(x); if (v && v.builtin) return v.name; }
  // spelled by a builtin and passed on as a macro argument (showdebug(__FILE__))
  let L = n.b;
  for (let g = 0; L && L.f === undefined && g < 32; g++) {
    if (L.a === 1) { L = L.sp; continue; }
    const v = P.tu.invById.get(L.x);
    return v && v.builtin && L.s ? v.name : null;
  }
  return null;
}

NODE_PRINTERS.StringLiteral = function (n, ctx) {
  // __FILE__: the module's own constant (`const __FILE__ = "dig.c";` after the imports), or in
  // a macro body the parameter the kept call passes it as
  if (n.b && builtinMacroOf(this, n) === "__FILE__") {
    this.claim("edit.file-name", n);
    if (this.paramMap && ctx.kind === "body") { this.usesFile = true; return "__FILE__"; }
    this.mod.fileConst = jsStringBody(n.bytes);
    return "__FILE__";
  }
  // the JS text of the literal itself (a JS string); the decay rule wraps it in _()
  const raw = this.rawText(n, ctx);
  if (raw !== null && n.toks === 1 && /^"/.test(raw)) { return cLiteralToJs(raw); }
  if (raw !== null && n.toks > 1) {
    // adjacent literals "a" "b" (possibly macro-spelled): join with +, keep the line breaks
    const S = this.source(ctx), r = rangeIn(n, ctx);
    const pieces = [];
    let ok = true;
    for (const tl of n.tl) {
      const p = posIn(tl, ctx);
      if (p === null || S.text[p] !== '"') { ok = false; break; }
      let j = p + 1;
      while (j < r[1] && S.text[j] !== '"') { if (S.text[j] === "\\") j++; j++; }
      pieces.push([p, j + 1]);
    }
    if (ok) {
      this.claim("edit.string-concat", n);
      let out = "";
      for (let i = 0; i < pieces.length; i++) {
        if (i) out += S.clean(pieces[i - 1][1], pieces[i][0]).replace(/^(\s*)/, " +$1");
        out += cLiteralToJs(S.text.slice(pieces[i][0], pieces[i][1]));
      }
      return out;
    }
  }
  if (n.toks > 1) this.claim("edit.string-concat", n);
  return `"${jsStringBody(n.bytes)}"`;
};

NODE_PRINTERS.PredefinedExpr = function (n, ctx) {
  this.claim("edit.func-name", n);
  this.need("_");
  // (in a kept macro's body: the macro's name, the same at every site)
  if (this.paramMap && ctx && ctx.kind === "body") return `_("${this.tu.invById.get(ctx.x)?.name ?? this.fd.name}")`;
  return `_("${this.fd.name}")`;
};

// ---- names ------------------------------------------------------------------------------
NODE_PRINTERS.DeclRefExpr = function (n, ctx, use) {
  switch (n.dk) {
    case "param": case "local": {
      const L = this.localOf(n.ref);
      if (!L) throw new Unsupported("unknown local " + n.name);
      if (L.kind === "stack" || (L.kind === "static" && L.scalar)) {
        if (use === "addr") { this.claim("edit.addr-stack", n); return L.js; }
        this.claim("edit.stack-var", n);
        return `${L.js}[0]`;
      }
      this.claim("id.var", n);
      return L.js;
    }
    case "static-local": {
      const L = this.localOf(n.ref);
      if (!L) throw new Unsupported("unknown static local " + n.name);
      if (L.scalar) {
        if (use === "addr") { this.claim("edit.addr-stack", n); return L.js; }
        this.claim("edit.stack-var", n);
        return `${L.js}[0]`;
      }
      this.claim("id.var", n);
      return L.js;
    }
    case "extern-local": // a block-scope `extern T x;`: the global itself
    case "global": {
      const T = this.T, vt = n.vt;
      const g = this.em.index.globals[n.name];
      const fileStatic = n.static || (g && g.static && g.file === this.tu.file);
      if (fileStatic && this.em.missingData && this.em.missingData.has(n.name))
        throw new Unsupported(`uses file-scope data ${n.name} that was not emitted`);
      if (T.isRec(vt) || T.isArr(vt)) {
        this.claim("id.global", n);
        return fileStatic ? this.ident(n.name) : g ? this.mod.importGlobal(n.name) : this.mod.add(n.name, "rt/libc.js");
      }
      if (fileStatic) {
        // file-scope static scalar: a heap ref of this module
        if (use === "addr") { this.claim("edit.addr-stack", n); return this.ident(n.name); }
        this.claim("edit.stack-var", n);
        return `${this.ident(n.name)}[0]`;
      }
      const name = n.name;
      // a C library global (stdin, stdout, stderr, errno's storage...): from rt/libc.js
      if (!g && !fileStatic) {
        this.claim("id.global", n);
        return use === "addr" ? `${this.need("global_ref")}("${n.name}")` : this.mod.add(name, "rt/libc.js");
      }
      // scalar globals are heap-backed accessors (rt/globals.js): read and assign them as in C
      // (with its type: a file-scope initializer may take the address before the defining module ran)
      if (use === "addr") {
        this.claim("edit.addr-stack", n);
        return `${this.need("global_ref")}("${n.name}", ${this.typeExpr(vt, null, ctx)})`;
      }
      this.claim("id.global", n);
      return name;
    }
    case "function": this.claim("id.function", n); return this.mod.importFunction(n.name);
    case "enum": this.claim("id.enum", n); return this.mod.importEnum(n.name);
    default: throw new Unsupported("declref " + n.dk);
  }
};

// ---- casts ------------------------------------------------------------------------------
NODE_PRINTERS.ImplicitCastExpr = function (n, ctx, use) {
  const c = n.c[0], T = this.T;
  n._use = use;
  switch (n.ck) {
    case "PointerToBoolean":
    case "IntegralToBoolean": {
      // conversion to C bool: the operand's truth; as a value it is 0/1 (a comparison converts
      // itself; an int already 0/1 by its range stays as it is)
      if (asCondition(use)) {
        this.claim("cast.transparent", n);
        return this.js(c, ctx, "bool");
      }
      if (isBoolValued(this, c)) {
        this.claim("cast.transparent", n);
        return this.js(c, ctx, use);
      }
      if (n.ck === "IntegralToBoolean" && T.isInt(c.t) && !this.isBig(c)) {
        const [lo, hi] = this.range.of(c);
        if (lo >= 0 && hi <= 1) {
          this.claim("cast.transparent", n);
          return this.js(c, ctx, "value");
        }
      }
      this.claim("edit.bool-value", n);
      return truthToInt(this.js(c, ctx, "bool"));
    }
    case "LValueToRValue":
    case "NoOp":
    case "ToVoid":
    case "FunctionToPointerDecay":
    case "BuiltinFnToFnPtr":
    case "IntegralToFloating":
    case "FloatingCast":
      this.claim("cast.transparent", n);
      return this.js(c, ctx, use === "lvalue" ? "lvalue" : "value");
    case "ArrayToPointerDecay": {
      const s = this.strip(c);
      if (s.k === "StringLiteral") {
        this.claim("edit.string-literal", n);
        return `${this.need("_")}(${this.js(c, ctx)})`;
      }
      const r = T.repr(c.t);
      if (r === "list" && T.isRec(T.elem(c.t))) {
        this.claim("edit.decay-struct-array", n);
        return `${this.js(c, ctx)}[0]`;
      }
      this.claim("cast.transparent", n);
      return this.js(c, ctx);
    }
    case "NullToPointer": {
      const r = T.repr(n.t);
      if (r === "addr") {
        this.claim("edit.null-addr", n);
        return "0";
      }
      this.claim("edit.null", n);
      return "null";
    }
    case "IntegralCast":
      return conversion(this, n, c, ctx, false);
    case "FloatingToIntegral":
      this.claim("edit.cast-float-to-int", n);
      return `${this.need(T.convName(n.t))}(${this.js(c, ctx)})`;
    case "BitCast":
      return pointerCast(this, n, c, ctx);
    default:
      throw new Unclaimed("ImplicitCastExpr:" + n.ck);
  }
};

function conversion(P, n, c, ctx, explicit, inner) {
  const T = P.T;
  const text = inner ?? P.js(c, ctx);
  const from = c.t, to = n.t;
  const bc = P.isBig(c),
    bn = P.isBig(n) || (explicit && (BIG_TN.has(n.twn) || !!(n.tw !== undefined && T.get(n.tw).big)));
  // a written integer literal converted to an exact 64-bit type: a BigInt literal
  const lit = P.strip(c);
  if (bn && !bc && lit && lit.k === "IntegerLiteral" && (T.signed(to) || BigInt(lit.v) >= 0n)) {
    P.claim("edit.op64", n);
    return bigLiteral(P, lit, ctx);
  }
  if (bc || bn) {
    if (bc && bn) { P.claim("cast.transparent", n); return text; }
    P.claim("edit.op64", n);
    if (bn) return `${P.need(T.signed(to) ? "i64" : "u64")}(${text})`;
    return `${P.need(T.convName(to))}(${text})`;
  }
  if (!T.isInt(to)) { P.claim("cast.transparent", n); return text; }
  // 64-bit <-> 64-bit sign change: the same bits; as an operand of a bit operation (helpers
  // work on the bit pattern) or for a nonnegative value it changes nothing in JS
  if (T.is64(to) && T.isInt(from) && (T.is64(from) || T.signed(from) || T.size(from) < 8)) {
    const [rl] = P.range.of(c);
    if (n._use === "bits" || rl >= 0) { P.claim("cast.transparent", n); return text; }
  }
  const [lo, hi] = T.intRange(to);
  const [rlo, rhi] = P.range.of(c);
  const fits = rlo >= lo && rhi <= hi;
  const fromSigned = T.isInt(from) && T.signed(from);
  const toSigned = T.signed(to);
  // policy: explicit casts and conversions involving unsigned types
  // wrap when the value may not fit; signed -> narrower signed is assumed in range (as signed
  // overflow), asserted by the checked build.
  const mustWrap = !fits && (explicit || !toSigned || !fromSigned || T.get(to).k === "bool");
  if (!mustWrap) {
    if (!fits && P.em.checked) {
      P.claim("edit.narrow", n);
      return `${P.need("chk")}.fits(${text}, ${lo}, ${hi}, "${P.siteOf(n)}")`;
    }
    P.claim(explicit ? "edit.cast-drop" : "cast.transparent", n);
    return text;
  }
  P.claim(explicit ? "edit.cast-int" : "edit.narrow", n);
  // (an explicit cast to a NetHack typedef keeps its name: coordxy(x))
  const alias = explicit ? P.em.typedefAlias(n.twn, to, P.mod) : null;
  const conv = alias || P.need(T.convName(to));
  // the same conversion applied twice gives the same value: unsigned(unsigned(x)) is unsigned(x)
  if (!alias && IDEMPOTENT.has(conv) && isCallOf(text, conv)) return text.trim();
  return `${conv}(${text})`;
}
// rt/ctypes.js integer conversions: f(f(x)) === f(x)
const IDEMPOTENT = new Set(["char", "schar", "uchar", "short", "ushort", "int", "unsigned", "long", "ulong"]);
// text is one call of fn spanning all of it: fn(...)
function isCallOf(text, fn) {
  const t = text.trim();
  return t.startsWith(fn + "(") && isWrapped(t.slice(fn.length));
}

function pointerCast(P, n, c, ctx) {
  const T = P.T;
  const from = T.repr(c.t), to = T.repr(n.t);
  const text = P.js(c, ctx);
  if (
    from === to &&
    (from !== "view" || T.recName(c.t) === T.recName(n.t)) &&
    (from !== "ref" || sameRefKind(T, c.t, n.t))
  ) {
    P.claim("cast.transparent", n);
    return text;
  }
  if (isNullConst(P, c)) { P.claim("edit.null", n); return "null"; }
  if (to === "view") {
    P.claim("edit.cast-view", n);
    const head = `${P.need("view_of")}(${P.em.recordClass(T.recName(n.t), P.mod)}`;
    return `${head}, ${from === "addr" ? text : `${P.need("addr_of")}(${text})`})`;
  }
  if (to === "addr") { P.claim("edit.cast-addr", n); return from === "addr" ? text : `${P.need("addr_of")}(${text})`; }
  if (to === "ref") {
    P.claim("edit.cast-ref", n);
    const head = `${P.need("ref_to")}(${P.typeExpr(T.pointee(n.t), null, ctx)}`;
    return `${head}, ${from === "addr" ? text : `${P.need("addr_of")}(${text})`})`;
  }
  throw new Unsupported(`pointer cast ${from} -> ${to}`);
}

function sameRefKind(T, a, b) {
  const pa = T.get(T.pointee(a)), pb = T.get(T.pointee(b));
  return pa.k === pb.k && pa.size === pb.size && pa.signed === pb.signed;
}

NODE_PRINTERS.CStyleCastExpr = function (n, ctx, use) {
  const c = n.c[0], T = this.T;
  const inner = () => this.js(c, ctx, n.ck === "ToVoid" ? "discard" : "value");
  const strip = (text) => text;
  switch (n.ck) {
    case "ToVoid":
      this.claim("edit.cast-void", n);
      return use === "discard" ? inner() : `void ${parenthesize(inner())}`;
    case "NoOp":
    case "LValueToRValue":
    case "IntegralToFloating":
    case "FloatingCast":
      // (uint64_t) 0x9E3779B97F4A7C13ULL: the same C type, but the BigInt domain in JS
      if (
        n.ck === "NoOp" &&
        T.isInt(n.t) &&
        (this.isBig(n) || (n.tw !== undefined && T.get(n.tw).big)) &&
        !this.isBig(c)
      )
        return this.toBig(c, inner(), T.signed(n.t));
      this.claim("edit.cast-drop", n);
      return parenthesize(inner());
    case "NullToPointer": {
      if (T.repr(n.t) === "addr") {
        this.claim("edit.null-addr", n);
        return "0";
      }
      this.claim("edit.null", n);
      return "null";
    }
    case "IntegralCast": {
      const text = conversion(this, n, c, ctx, true, parenthesize(inner()));
      return text;
    }
    case "IntegralToBoolean":
      this.claim("edit.cast-int", n);
      return `${this.need("bool")}(${inner()})`;
    case "FloatingToIntegral":
      this.claim("edit.cast-float-to-int", n);
      return `${this.need(T.convName(n.t))}(${inner()})`;
    case "BitCast":
      return parenthesize(pointerCast(this, n, c, ctx));
    case "IntegralToPointer": {
      if (this.strip(c).k === "IntegerLiteral" && this.strip(c).v === "0") {
        if (T.repr(n.t) === "addr") {
          this.claim("edit.null-addr", n);
          return "0";
        }
        this.claim("edit.null", n);
        return "null";
      }
      return intToPointer(this, n, c, ctx);
    }
    case "PointerToIntegral": {
      // the address as an integer (views, refs and functions give theirs)
      const r = T.repr(c.t);
      const a =
        r === "addr"
          ? inner()
          : r === "fn"
            ? `${this.need("fn_index")}(${inner()})`
            : `${this.need("addr_of")}(${inner()})`;
      this.claim("edit.cast-ptr-to-int", n);
      const [lo, hi] = T.intRange(n.t);
      return lo <= 0 && hi >= 4294967295 ? a : `${this.need(T.convName(n.t))}(${a})`;
    }
    default:
      throw new Unclaimed("CStyleCastExpr:" + n.ck);
  }
};

// (T *) n for a nonzero integer n (SIG_IGN, sentinel pointers like (struct bill_x *) -1000): the
// pointer with that address, read the way a pointer loaded from memory would be (unsigned)
function intToPointer(P, n, c, ctx) {
  const T = P.T, r = T.repr(n.t);
  const [lo, hi] = P.range.of(c);
  let a = P.js(c, ctx);
  if (!(lo >= 0 && hi <= 4294967295)) a = `${P.need("unsigned")}(${a})`;
  P.claim("edit.cast-int-to-ptr", n);
  if (r === "addr") return a;
  if (r === "view") return `${P.need("view_of")}(${P.em.recordClass(T.recName(n.t), P.mod)}, ${a})`;
  if (r === "ref") return `${P.need("ref_to")}(${P.typeExpr(T.pointee(n.t), null, ctx)}, ${a})`;
  if (r === "fn") return `${P.need("fn_from_index")}(${a})`;
  throw new Unsupported("integer to pointer cast to " + r);
}

function parenthesize(s) {
  const t = s.trim();
  if (/^[\w.$]+$/.test(t) || /^[\w.$]+\(.*\)$/s.test(t) && balancedCall(t)) return s;
  if (/^\(.*\)$/s.test(t) && balancedOuter(t)) return s;
  return `(${s})`;
}
function balancedOuter(t) {
  let d = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "(") d++; else if (t[i] === ")") { d--; if (d === 0 && i < t.length - 1) return false; }
  }
  return d === 0;
}
function balancedCall(t) {
  const i = t.indexOf("(");
  return balancedOuter(t.slice(i));
}

// ---- operators ----------------------------------------------------------------------------
NODE_PRINTERS.VAArgExpr = function (n, ctx) {
  this.claim("fn.variadic", n);
  return `${this.need("va_arg")}(${this.js(n.c[0], ctx)})`;
};

NODE_PRINTERS.ConstantExpr = function (n, ctx, use) {
  this.claim("cast.transparent", n);
  return this.js(n.c[0], ctx, use);
};

// a brace initializer of a scalar (`coord *garr = DUMMY;` with DUMMY `{ 0 }`): its one value
NODE_PRINTERS.InitListExpr = function (n, ctx, use) {
  if (this.T.isArr(n.t) || this.T.isRec(n.t)) return this.initList(n, ctx);
  this.claim("id.init-list", n);
  const c = n.c.find((x) => x && x.k !== "ImplicitValueInitExpr");
  if (c) return this.js(c, ctx, use);
  const r = this.T.repr(n.t);
  return r === "num" || r === "addr" ? "0" : "null";
};

NODE_PRINTERS.ParenExpr = function (n, ctx, use) {
  this.claim("id.paren", n);
  const A = this.js(n.c[0], ctx, use);
  const text = this.form(n, ctx, [[n.c[0], A]], () => `(${A})`);
  if (text === `(${A})`) {
    // parentheses the JS does not need: around an expression it already parenthesizes, ((x));
    // around an expression whose value is discarded, (x += 1); (not a comma or ?: expression:
    // it may be a branch of a ?:), a name, a member or a call, (mon) or (f(x)),
    // unless a name character is written right before them (return(x)); around +(a < b) unless
    // a + or - is (a+(+(b)))
    if (isWrapped(A) || (use === "discard" && !loose(A, true))) return A;
    const before = charBefore(this, n, ctx);
    if (
      before !== null &&
      !/[\w$]/.test(before) &&
      (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/.test(A) ||
        (/^[A-Za-z_$][\w$.]*\(/.test(A) && isWrapped(A.slice(A.indexOf("(")))))
    )
      return A;
    if (A.startsWith("+(") && isWrapped(A.slice(1)) && before !== null && before !== "+" && before !== "-") return A;
  }
  return text;
};
// the source character right before n's text in ctx (null: not known)
function charBefore(P, n, ctx) {
  const r = rangeIn(n, ctx);
  if (!r || P.mode !== "sugar") return null;
  return P.source(ctx).text[r[0] - 1] ?? "";
}

NODE_PRINTERS.UnaryOperator = function (n, ctx, use) {
  const T = this.T, c = n.c[0], op = n.op;
  if (op === "&") return addressOf(this, n, c, ctx);
  if (op === "*") return deref(this, n, c, ctx, use);
  if (op === "++" || op === "--") {
    const r = T.repr(c.t);
    if (r === "view" || r === "ref") {
      const A = this.js(c, ctx, "lvalue");
      const d = op === "++" ? 1 : -1;
      const add = (k) =>
        r === "view"
          ? `${this.need("ptr_add")}(${A}, ${k})`
          : k > 0 && use === "discard"
            ? `${A}.subarray(${k})`
            : `${this.need("ref_add")}(${A}, ${k})`;
      this.claim(r === "view" ? "edit.ptr-add-view" : "edit.ptr-add-ref", n);
      if (use === "discard" || !n.post) return use === "discard" ? `${A} = ${add(d)}` : `(${A} = ${add(d)})`;
      // p++ as a value: step, then the previous pointer (p is re-read: it must be a plain lvalue)
      if (!isPureLvalue(this, c)) throw new Unsupported("pointer ++/-- of an impure lvalue used as a value");
      return `(${A} = ${add(d)}, ${add(-d)})`;
    }
    this.claim("id.incdec", n);
    const A = this.js(c, ctx, "lvalue");
    const text = this.form(n, ctx, [[c, A]], () => (n.post ? `${A}${op}` : `${op}${A}`));
    // the JS value of x++ / --x is not re-converted to x's type: assert in the checked build
    if (use !== "discard" && this.em.checked && T.isInt(c.t)) {
      const [lo, hi] = T.intRange(c.t);
      return `${this.need("chk")}.fits(${text}, ${lo}, ${hi})`;
    }
    return text;
  }
  // !, -, +, ~
  const A = this.js(c, ctx, op === "!" ? "bool" : use === "bits" ? "bits" : "value");
  if (op === "~" && T.is64(n.t) && !this.isBig(n)) {
    const [l, h] = this.range.of(c);
    // ~x of an int32-range value is exact in JS (the 64-bit two's complement as a Number); for an
    // unsigned type that pattern is only meaningful to the bit helpers, so only in bit context
    if (l >= -(2 ** 31) && h < 2 ** 31 && (T.signed(n.t) || use === "bits")) {
      this.claim("id.unop", n);
      return this.form(n, ctx, [[c, A]], () => `~${A}`);
    }
    this.claim("edit.op64", n);
    return `${this.need(T.signed(n.t) ? "not64" : "not64u")}(${A})`;
  }
  const text = this.form(n, ctx, [[c, A]], () =>
    A.startsWith(op) && (op === "+" || op === "-") ? `${op} ${A}` : `${op}${A}`,
  );
  if (op === "!" && !asCondition(use)) { this.claim("edit.bool-value", n); return boolToInt(text, true); }
  if ((op === "~" || op === "-") && this.isBig(n) && !T.signed(n.t)) {
    this.claim("edit.op64", n);
    return `${this.need("u64")}(${text})`;
  }
  if ((op === "~" || op === "-") && T.isUnsigned32(n.t)) {
    this.claim("edit.unsigned-wrap", n);
    return `${this.need("unsigned")}(${text})`;
  }
  this.claim("id.unop", n);
  return text;
};

function addressOf(P, n, c, ctx) {
  const T = P.T, s = P.strip(c);
  if (T.isRec(c.t) && !(s && s.k === "ArraySubscriptExpr")) {
    P.claim("edit.addr-view", n);
    return P.js(c, ctx, "addr");
  }
  if (T.get(c.t).k === "fn") { P.claim("edit.addr-function", n); return P.js(c, ctx); }
  if (s.k === "DeclRefExpr") {
    const text = P.js(c, ctx, "addr");
    if (T.isArr(c.t)) { P.claim("edit.addr-view", n); return text; }
    if (T.isByte(c.t)) return `${P.need("addr_of")}(${text})`;
    return text;
  }
  if (s.k === "ArraySubscriptExpr") {
    const base = s.c[0], idx = s.c[1];
    const br = T.repr(base.t);
    const B = P.js(base, ctx), I = P.js(idx, ctx);
    if (T.isRec(s.t)) {
      // &a[N] one past the end of a struct array (a loop bound) is not an element of the JS
      // Array: compute it from the first element
      const dec = base.k === "ImplicitCastExpr" && base.ck === "ArrayToPointerDecay" ? base.c[0] : null;
      const ext = dec && T.isArr(dec.t) ? T.get(dec.t).n : -1;
      const iv =
        idx.cv !== undefined ? Number(idx.cv) : P.strip(idx)?.k === "IntegerLiteral" ? Number(P.strip(idx).v) : null;
      if (dec && ((ext >= 0 && iv !== null && iv >= ext) || n._fromFirst)) {
        P.claim("edit.ptr-add-view", n);
        return `${P.need("ptr_add")}(${P.js(dec, ctx)}[0], ${I})`;
      }
      P.claim("edit.addr-view", n);
      return P.js(c, ctx);
    }
    if (br === "addr") { P.claim("edit.addr-byte-elem", n); return `${B} + ${parenthesize(I)}`; }
    if (br === "ref") { P.claim("edit.addr-ref-elem", n); return `${B}.subarray(${I})`; }
    throw new Unsupported("address of element of " + br);
  }
  if (s.k === "MemberExpr") {
    if (T.isArr(s.t)) { P.claim("edit.addr-view", n); return P.js(c, ctx); }
    const base = s.c[0];
    const B = P.js(base, ctx);
    P.claim("edit.addr-field", n);
    const field = s.name;
    if (T.isByte(s.t)) return `${P.need("addr_of")}(${P.need("ref_of")}(${B}, "${field}"))`;
    return `${P.need("ref_of")}(${B}, "${field}")`;
  }
  if (s.k === "UnaryOperator" && s.op === "*") { P.claim("edit.addr-view", n); return P.js(s.c[0], ctx); }
  throw new Unsupported("address of " + s.k);
}

function deref(P, n, c, ctx, use) {
  const T = P.T, r = T.repr(c.t);
  const A = P.js(c, ctx);
  if (r === "view") { P.claim("edit.deref-view", n); return A; }
  if (r === "fn") { P.claim("edit.deref-fn", n); return A; }
  if (r === "addr") {
    P.claim("edit.deref-byte", n);
    const p = T.get(T.pointee(c.t));
    if (p.k === "void") throw new Unsupported("deref void*");
    return `${P.need(p.signed ? "chars" : "uchars")}[${A}]`;
  }
  if (r === "ref") { P.claim("edit.deref-ref", n); return `${parenthesize(A)}[0]`; }
  throw new Unsupported("deref " + r);
}

const BOOL_OPS = new Set(["==", "!=", "<", ">", "<=", ">=", "&&", "||"]);

// C comparisons, ! and logical operators yield the int 0 or 1; their JS values are true/false
// (or, for && / || of ints, an operand). Where the value can be observed as a number (stored,
// passed, returned, indexed, switched on, operated on) it is made 0/1; it stays bare only when a
// condition consumes it (if/while/for/?: test, operand of ! && ||) or it is discarded.
const asCondition = (use) => use === "bool" || use === "discard";
// +(a < b): the JS boolean as 0/1
function boolToInt(text, unaryNot = false) {
  const t = text.trim();
  return (unaryNot && /^!/.test(t)) || isWrapped(t) ? `+${t}` : `+(${t})`;
}
// x ? 1 : 0: a truth value of any JS value (an int, a pointer, x && y of ints) as 0/1 (x in
// parentheses only if it has an operator binding looser than ?:)
function truthToInt(text) {
  const t = text.trim();
  return `(${isWrapped(t) || !loose(t) ? t : `(${t})`} ? 1 : 0)`;
}
// does t have, outside parentheses, brackets, strings and comments, an operator binding as
// loosely as ?: or looser (?:, assignment, comma, =>)? (assign: assignments do not count)
function loose(t, assign = false) {
  let d = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"' || c === "'" || c === "`") {
      for (i++; i < t.length && t[i] !== c; i++) if (t[i] === "\\") i++;
      continue;
    }
    if (c === "/" && t[i + 1] === "*") {
      const e = t.indexOf("*/", i + 2);
      if (e < 0) return true;
      i = e + 1;
      continue;
    }
    if (c === "/" && t[i + 1] === "/") return true;
    if (c === "(" || c === "[" || c === "{") d++;
    else if (c === ")" || c === "]" || c === "}") d--;
    else if (d === 0) {
      if (c === "?" || c === ":" || c === ",") return true;
      if (c === "=") {
        if (t[i + 1] === "=") { i += t[i + 2] === "=" ? 2 : 1; continue; }   // == ===
        if (t[i - 1] === "=" || t[i - 1] === "!") continue;                // (== != tails)
        if ((t[i - 1] === "<" || t[i - 1] === ">") && t[i - 2] !== "<" && t[i - 2] !== ">") continue; // <= >=
        if (assign && t[i + 1] !== ">") continue;                           // = op=
        return true;                                                       // = op= =>
      }
      if (/[A-Za-z_$]/.test(c) && !/[\w$]/.test(t[i - 1] || "")) {
        const w = /^[A-Za-z_$][\w$]*/.exec(t.slice(i))[0];
        if (w === "yield" || w === "async" || w === "function") return true;
        i += w.length - 1;
      }
    }
  }
  return false;
}
function isWrapped(t) {
  if (!t.startsWith("(") || !t.endsWith(")")) return false;
  let d = 0, q = null;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === "\\") i++; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "(") d++;
    else if (c === ")") { d--; if (d === 0 && i < t.length - 1) return false; }
  }
  return d === 0;
}

NODE_PRINTERS.BinaryOperator = function (n, ctx, use) {
  const T = this.T, op = n.op, [a, b] = n.c;
  if (op === "=") return assignment(this, n, a, b, ctx, use);
  if (op === ",") {
    this.claim("id.comma", n);
    const A = this.js(a, ctx, "discard"), B = this.js(b, ctx, use);
    return this.form(n, ctx, [[a, A], [b, B]], () => `(${A}, ${B})`);
  }
  if (op === "&&" || op === "||") {
    const A = this.js(a, ctx, "bool"), B = this.js(b, ctx, "bool");
    const text = this.form(n, ctx, [[a, A], [b, B]], () => `(${A} ${op} ${B})`);
    if (asCondition(use)) { this.claim("id.binop", n); return text; }
    this.claim("edit.bool-value", n);
    return isBoolValued(this, a) && isBoolValued(this, b) ? boolToInt(text) : truthToInt(text);
  }
  const ra = T.repr(a.t), rb = T.repr(b.t);
  // pointer arithmetic / comparison
  if (ra !== "num" || rb !== "num") {
    const t = pointerBinop(this, n, a, b, ctx, ra, rb);
    if (!BOOL_OPS.has(op) || asCondition(use)) return t;
    this.claim("edit.bool-value", n);
    return boolToInt(t);
  }
  const zero = (x) =>
    x.cv === "0" ||
    (this.strip(x) && this.strip(x).cv === "0") ||
    (this.strip(x)?.k === "IntegerLiteral" && this.strip(x).v === "0");
  const truth = (op === "==" || op === "!=") ? (zero(b) ? "a" : zero(a) ? "b" : null) : null;
  const bitop = T.is64(n.t) && /^(&|\||\^)$/.test(op);
  const A = this.js(a, ctx, truth === "a" ? "bool" : bitop ? "bits" : "value"),
    B = this.js(b, ctx, truth === "b" ? "bool" : bitop ? "bits" : "value");
  const plain = () => this.form(n, ctx, [[a, A], [b, B]], () => `(${A} ${op} ${B})`);
  if (BOOL_OPS.has(op)) {
    if (asCondition(use)) { this.claim("id.binop", n); return plain(); }
    this.claim("edit.bool-value", n);
    return boolToInt(plain());
  }
  const isFloat = T.isFloat(n.t);
  if (this.isBig(n)) {
    // BigInt arithmetic: exact; / truncates; + - * << wrap to 64 bits. A shift count is not
    // converted to the shifted type in C: make it a BigInt
    this.claim("edit.op64", n);
    if (!/^(<<|>>)$/.test(op) && !BOOL_OPS.has(op) && (!this.isBig(a) || !this.isBig(b))) {
      // an operand not converted to the BigInt type in the AST (a seed variable of the
      // exact64 list meeting an `unsigned long long` constant)
      const A2 = this.toBig(a, A, T.signed(n.t)), B2 = this.toBig(b, B, T.signed(n.t));
      const t = this.form(n, ctx, [[a, A2], [b, B2]], () => `(${A2} ${op} ${B2})`);
      if (/^(\+|-|\*)$/.test(op)) return `${this.need(T.signed(n.t) ? "i64" : "u64")}(${t})`;
      return t;
    }
    if ((op === "<<" || op === ">>") && !this.isBig(b)) {
      const sb = this.strip(b);
      const B2 = sb && sb.k === "IntegerLiteral" ? bigLiteral(this, sb, ctx) : `BigInt(${B})`;
      const t = this.form(n, ctx, [[a, A], [b, B2]], () => `(${A} ${op} ${B2})`);
      return op === "<<" ? `${this.need(T.signed(n.t) ? "i64" : "u64")}(${t})` : t;
    }
    const t = plain();
    if (/^(\+|-|\*|<<)$/.test(op)) return `${this.need(T.signed(n.t) ? "i64" : "u64")}(${t})`;
    return t;
  }
  if (op === "/" && !isFloat) { this.claim("edit.int-div", n); return `Math.trunc(${plain()})`; }
  if (T.is64(n.t) && /^(&|\||\^|<<|>>)$/.test(op)) {
    const [la, ha] = this.range.of(a), [lb, hb] = this.range.of(b);
    const i32 = (l, h) => l >= -(2 ** 31) && h < 2 ** 31;
    if (op !== "<<" && op !== ">>" && i32(la, ha) && i32(lb, hb)) { this.claim("id.binop", n); return plain(); }
    // x & m with 0 <= m < 2^31 only keeps bits JS's 32-bit & sees exactly
    if (op === "&" && ((la >= 0 && ha < 2 ** 31) || (lb >= 0 && hb < 2 ** 31))) {
      this.claim("id.binop", n);
      return plain();
    }
    if ((use === "bool") && (op === "&")) {
      this.claim("edit.bool-context-64", n);
      const t = plain();
      return this.em.checked ? `${this.need("chk")}.bool64(${t}, ${A}, ${B})` : t;
    }
    if (op === ">>" && i32(la, ha)) { this.claim("id.binop", n); return plain(); }
    this.claim("edit.op64", n);
    const u = !T.signed(n.t);
    const fn =
      { "&": "and64", "|": "or64", "^": "xor64", "<<": "shl64", ">>": "shr64" }[op] + (u && op !== "<<" ? "u" : "");
    return `${this.need(fn)}(${A}, ${B})`;
  }
  if (op === ">>" && T.isInt(n.t) && !T.signed(n.t) && T.size(n.t) === 4) {
    this.claim("edit.ushr", n);
    const t = this.form(n, ctx, [[a, A], [b, B]], () => `(${A} >> ${B})`);
    // the operator after the left operand (A itself may contain >>)
    const at = t.indexOf(A) + A.length;
    return t.slice(0, at) + t.slice(at).replace(/>>(?!>)/, ">>>");
  }
  if (op === "*" && T.isUnsigned32(n.t)) {
    // the product may exceed 2^53: only Math.imul gives the exact low 32 bits
    const [lo, hi] = this.range.binop(n);
    if (lo < 0 || hi > 4294967295) {
      this.claim("edit.unsigned-wrap", n);
      return `${this.need("unsigned")}(Math.imul(${A}, ${B}))`;
    }
  }
  const text = plain();
  if (T.isUnsigned32(n.t) && /^(\+|-|\*|<<|&|\||\^)$/.test(op)) {
    const [lo, hi] = this.range.binop(n);
    // (JS & | ^ << give a signed int32: bit 31 set reads negative, so they wrap unless the result
    // is below 2^31)
    if (lo < 0 || hi > 4294967295 || (/^(<<|&|\||\^)$/.test(op) && hi >= 2147483648)) {
      if (use === "bool" && /^[&|^]$/.test(op)) { this.claim("id.binop", n); return text; }
      this.claim("edit.unsigned-wrap", n);
      return `${this.need("unsigned")}(${text})`;
    }
  }
  this.claim("id.binop", n);
  // checked build: signed arithmetic the C assumes does not overflow (int: 32 bits; long: the
  // value must stay an exact double)
  if (this.em.checked && /^(\+|-|\*)$/.test(op) && T.isInt(n.t) && T.signed(n.t)) {
    const [lo, hi] = this.range.binop(n);
    if (T.size(n.t) <= 4 && (lo < -(2 ** 31) || hi > 2 ** 31 - 1))
      return `${this.need("chk")}.i32(${text}, "${this.siteOf(n)}")`;
    if (T.size(n.t) === 8 && (lo < -(2 ** 53) || hi > 2 ** 53))
      return `${this.need("chk")}.i53(${text}, "${this.siteOf(n)}")`;
  }
  return text;
};

// expression whose JS value is already a boolean (so && / || of two of them is too)
function isBoolValued(P, n) {
  const s = P.strip(n);
  if (!s) return false;
  if (s.k === "BinaryOperator" && BOOL_OPS.has(s.op))
    return s.op !== "&&" && s.op !== "||" ? true : isBoolValued(P, s.c[0]) && isBoolValued(P, s.c[1]);
  if (s.k === "UnaryOperator" && s.op === "!") return true;
  return false;
}

function pointerBinop(P, n, a, b, ctx, ra, rb) {
  const T = P.T, op = n.op;
  const A = P.js(a, ctx), B = P.js(b, ctx);
  const plain = () => P.form(n, ctx, [[a, A], [b, B]], () => `(${A} ${op} ${B})`);
  if (BOOL_OPS.has(op)) {
    if (ra === "ref" || rb === "ref") {
      if (isNullConst(P, a) || isNullConst(P, b)) { P.claim("id.binop", n); return plain(); }
      P.claim("edit.ptr-cmp-ref", n);
      return `(${P.need("addr_of")}(${A}) ${op} ${P.need("addr_of")}(${B}))`;
    }
    P.claim("id.binop", n);
    return plain();
  }
  if (ra === "addr" && (rb === "num" || rb === "addr")) { P.claim("id.binop", n); return plain(); }
  if (ra === "num" && rb === "addr" && op === "+") { P.claim("id.binop", n); return plain(); }
  if (ra === "view" && rb === "num" && (op === "+" || op === "-")) {
    P.claim("edit.ptr-add-view", n);
    return `${P.need("ptr_add")}(${A}, ${op === "-" ? "-" : ""}${parenthesize(B)})`;
  }
  if (ra === "view" && rb === "view" && op === "-") {
    P.claim("edit.ptr-diff-view", n);
    return `${P.need("ptr_diff")}(${A}, ${B})`;
  }
  if (ra === "ref" && rb === "num" && op === "+") { P.claim("edit.ptr-add-ref", n); return `${A}.subarray(${B})`; }
  if (ra === "ref" && rb === "num" && op === "-") {
    P.claim("edit.ptr-add-ref", n);
    return `${P.need("ref_add")}(${A}, -${parenthesize(B)})`;
  }
  if (ra === "ref" && rb === "ref" && op === "-") {
    // element count between two scalar pointers
    P.claim("edit.ptr-diff-ref", n);
    const diff = `(${P.need("addr_of")}(${A}) - ${P.need("addr_of")}(${B}))`;
    return `${diff} / ${P.need("sizeof")}(${P.typeExpr(T.pointee(a.t), null, ctx)})`;
  }
  throw new Unsupported(`pointer arithmetic ${ra} ${op} ${rb}`);
}

function assignment(P, n, a, b, ctx, use) {
  const T = P.T;
  if (T.isRec(a.t)) {
    P.claim("edit.struct-assign", n);
    return `${P.need("struct_assign")}(${P.js(a, ctx, "lvalue")}, ${P.js(b, ctx)})`;
  }
  const A = P.js(a, ctx, "lvalue");
  let B = P.js(b, ctx);
  if (P.isBig(a) && T.isInt(b.t)) B = P.toBig(b, B, T.signed(a.t));
  const text = P.form(n, ctx, [[a, A], [b, B]], () => `${A} = ${B}`);
  if (use !== "discard" && T.isInt(a.t) && !P.isBig(a)) {
    const [lo, hi] = T.intRange(a.t), [rl, rh] = P.range.of(b);
    if (rl < lo || rh > hi) { P.claim("edit.assign-value-narrow", n); return `${P.need(T.convName(a.t))}(${text})`; }
  }
  P.claim("id.assign", n);
  return use === "discard" || use === "value" ? text : text;
}

NODE_PRINTERS.CompoundAssignOperator = function (n, ctx, use) {
  const T = this.T, [a, b] = n.c, op = n.op, bop = op.slice(0, -1);
  const ra = T.repr(a.t);
  const bits64 = T.is64(n.crt) && /^(&|\||\^)$/.test(bop);
  const A = this.js(a, ctx, "lvalue"), B = this.js(b, ctx, bits64 ? "bits" : "value");
  const plain = () => this.form(n, ctx, [[a, A], [b, B]], () => `${A} ${op} ${B}`);
  if (ra === "view" || ra === "ref") {
    if (op !== "+=" && op !== "-=") throw new Unsupported("pointer compound " + op);
    if (use !== "discard") throw new Unsupported("pointer += as value");
    if (ra === "view") {
      this.claim("edit.ptr-add-view", n);
      return `${A} = ${this.need("ptr_add")}(${A}, ${op === "-=" ? "-" : ""}${parenthesize(B)})`;
    }
    if (op === "-=") throw new Unsupported("ref -=");
    this.claim("edit.ptr-add-ref", n); return `${A} = ${A}.subarray(${B})`;
  }
  if (ra === "addr") { this.claim("id.compound-assign", n); return plain(); }
  const lhsPure = isPureLvalue(this, a);
  if (this.isBig(a)) {
    // BigInt: exact; + - * << wrap to 64 bits; a shift count becomes a BigInt
    this.claim("edit.op64-assign", n);
    let B2 = /^(<<|>>)$/.test(bop) ? B : this.toBig(b, B, T.signed(a.t));
    if ((bop === "<<" || bop === ">>") && !this.isBig(b)) {
      const sb = this.strip(b);
      B2 = sb && sb.k === "IntegerLiteral" ? bigLiteral(this, sb, ctx) : `BigInt(${B})`;
    }
    if (/^(\+|-|\*|<<)$/.test(bop)) {
      if (!lhsPure) throw new Unsupported("64-bit compound assignment with impure lvalue");
      return `${A} = ${this.need(T.signed(a.t) ? "i64" : "u64")}(${A} ${bop} ${parenthesize(B2)})`;
    }
    return this.form(n, ctx, [[a, A], [b, B2]], () => `${A} ${op} ${B2}`);
  }
  const comp = n.crt; // computation result type
  const isFloat = T.isFloat(comp);
  // the stored value is the computation result converted to the lvalue type
  const local = isLocalLvalue(this, a);
  if (bop === "/" && !isFloat) {
    if (!lhsPure) throw new Unsupported("x /= y with impure lvalue");
    this.claim("edit.int-div-assign", n);
    let v = `Math.trunc(${A} / ${parenthesize(B)})`;
    if (local && T.size(a.t) < 4 && T.isInt(a.t)) v = `${this.need(T.convName(a.t))}(${v})`;
    return `${A} = ${v}`;
  }
  if (T.is64(comp) && /^(&|\||\^|<<|>>)$/.test(bop)) {
    const [la, ha] = this.range.of(a), [lb, hb] = this.range.of(b);
    const i32 = (l, h) => l >= -(2 ** 31) && h < 2 ** 31;
    if (bop !== "<<" && i32(la, ha) && i32(lb, hb)) { this.claim("id.compound-assign", n); return plain(); }
    if (!lhsPure) throw new Unsupported("64-bit compound bit op with impure lvalue");
    this.claim("edit.op64-assign", n);
    const u = !T.signed(comp);
    const fn =
      { "&": "and64", "|": "or64", "^": "xor64", "<<": "shl64", ">>": "shr64" }[bop] + (u && bop !== "<<" ? "u" : "");
    return `${A} = ${this.need(fn)}(${A}, ${B})`;
  }
  if (bop === ">>" && T.isInt(comp) && !T.signed(comp) && T.size(comp) === 4) {
    if (!lhsPure) throw new Unsupported(">>= unsigned impure");
    this.claim("edit.ushr", n);
    return `${A} = ${A} >>> ${parenthesize(B)}`;
  }
  // wrap needed for locals (heap stores truncate by themselves) of narrow/unsigned types
  if (local && T.isInt(a.t)) {
    const unsignedDst = !T.signed(a.t);
    const needWrap =
      (unsignedDst && /^(\+|-|\*|<<|\||\^)$/.test(bop)) ||
      (T.isUnsigned32(comp) &&
        bop !== "%" &&
        (bop !== "&" || (this.range.of(b)[1] >= 2147483648 && this.range.of(a)[1] >= 2147483648)));
    if (needWrap) {
      if (!lhsPure) throw new Unsupported("unsigned compound with impure lvalue");
      this.claim("edit.unsigned-wrap", n);
      if (bop === "*") return `${A} = ${this.need(T.convName(a.t))}(Math.imul(${A}, ${B}))`;
      return `${A} = ${this.need(T.convName(a.t))}(${A} ${bop} ${parenthesize(B)})`;
    }
  }
  this.claim("id.compound-assign", n);
  return plain();
};

function isPureLvalue(P, n) {
  n = P.strip(n);
  if (!n) return false;
  if (n.k === "DeclRefExpr") return true;
  if (n.k === "MemberExpr") return isPureLvalue(P, n.c[0]);
  if (n.k === "ArraySubscriptExpr") return isPureLvalue(P, n.c[0]) && isPureExpr(P, n.c[1]);
  if (n.k === "UnaryOperator" && n.op === "*") return isPureLvalue(P, n.c[0]);
  return false;
}
export function isPureExpr(P, n) {
  if (!n) return true;
  if (n.k === "CallExpr" || n.k === "CompoundAssignOperator") return false;
  if (n.k === "BinaryOperator" && n.op === "=") return false;
  if (n.k === "UnaryOperator" && (n.op === "++" || n.op === "--")) return false;
  for (const c of n.c || []) if (!isPureExpr(P, c)) return false;
  return true;
}
function isLocalLvalue(P, n) {
  n = P.strip(n);
  return n && n.k === "DeclRefExpr" && (n.dk === "local" || n.dk === "param") && (P.localOf(n.ref)?.kind === "plain");
}

NODE_PRINTERS.ConditionalOperator = function (n, ctx, use) {
  this.claim("id.cond", n);
  const [c, a, b] = n.c;
  const C = this.js(c, ctx, "bool");
  let A = this.js(a, ctx, use), B = this.js(b, ctx, use);
  if (this.isBig(n) && this.T.isInt(n.t)) {
    A = this.toBig(a, A, this.T.signed(n.t));
    B = this.toBig(b, B, this.T.signed(n.t));
  }
  return this.form(n, ctx, [[c, C], [a, A], [b, B]], () => `(${C} ? ${A} : ${B})`);
};

NODE_PRINTERS.CallExpr = function (n, ctx) {
  const T = this.T;
  const [callee, ...args] = n.c;
  // va_start(ap, last) / va_end(ap): the rest parameter is the argument list
  if (n.callee === "__builtin_va_start") {
    this.claim("fn.variadic", n);
    return `${this.js(args[0], ctx, "lvalue")} = ${this.need("va_start")}(args)`;
  }
  if (n.callee === "__builtin_va_end") {
    this.claim("fn.variadic", n);
    return `${this.need("va_end")}(${this.js(args[0], ctx)})`;
  }
  if (n._setjmp) {
    // (lib/gotos.mjs lowerSetjmp): remember the buffer, the value is the one longjmp passed
    this.claim("fn.setjmp", n);
    return `(${n._setjmp.jb} = ${this.js(args[0], ctx)}, ${n._setjmp.jv})`;
  }
  const C = this.js(callee, ctx, "callee");
  const bigParams = EXACT64_PARAMS[n.callee] || [];
  const A = args.map((x, i) => {
    if (T.isRec(x.t)) { this.claim("edit.struct-arg", n); return `${this.need("struct_copy")}(${this.js(x, ctx)})`; }
    if (bigParams.includes(i)) return this.toBig(x, this.js(x, ctx), false);
    // a seed passed on to a 64-bit parameter (lua_pushinteger(L, (lua_Integer) seed)) stays exact
    let sx = x;
    while (
      sx &&
      (sx.k === "ImplicitCastExpr" ||
        sx.k === "ParenExpr" ||
        (sx.k === "CStyleCastExpr" && (sx.ck === "IntegralCast" || sx.ck === "NoOp")))
    )
      sx = sx.c[0];
    if (T.is64(x.t) && sx !== x && this.isBig(sx) && !this.isBig(x)) {
      this.claim("edit.op64", x);
      return `${this.need(T.signed(x.t) ? "i64" : "u64")}(${this.js(sx, ctx)})`;
    }
    return this.js(x, ctx);
  });
  this.claim("id.call", n);
  return this.form(n, ctx, [[callee, C], ...args.map((x, i) => [x, A[i]])], () => `${C}(${A.join(", ")})`);
};

NODE_PRINTERS.ArraySubscriptExpr = function (n, ctx, use) {
  const T = this.T, [base0, idx] = n.c;
  // a[i] on an array: the base is the decayed array; index the array value directly
  const dec = base0.k === "ImplicitCastExpr" && base0.ck === "ArrayToPointerDecay" ? base0.c[0] : null;
  const base = dec && T.repr(dec.t) !== "addr" ? dec : base0;
  if (dec && base === dec) this.claim("cast.transparent", base0);
  const br = base === dec ? T.repr(dec.t) : T.repr(base.t);
  const B = this.js(base, ctx), I = this.js(idx, ctx);
  if (br === "addr") {
    this.claim("edit.byte-subscript", n);
    const p = T.get(n.t);
    return `${this.need(p.signed ? "chars" : "uchars")}[${B} + ${parenthesize(I)}]`;
  }
  // (a JS Array indexed by true/false is a property lookup, not [1]/[0]: the index as a number)
  if (br === "list" && T.isRec(n.t) && use !== "lvalue" && !this.isBig(idx)) {
    // an element of an array of structs at an index written so that it can leave [0, n) in a way
    // C code relies on (C reads the memory there; svd.dungeons[-1] in ledger_no): rt elt() gives
    // the view at that address. Elsewhere a[i]; the checked build asserts it is in range.
    const why = eltIndexForm(this, idx);
    if (why) {
      this.claim("edit.struct-elt", n);
      if (process.env.NH2JS_ELT_STATS) console.error("ELT", why, this.siteName?.(n) ?? "", this.fd.name);
      return `${this.need("elt")}(${B}, ${I})`;
    }
    if (this.em.checked) {
      this.claim("edit.struct-elt", n);
      return `${this.need("chk")}.idx(${B}, ${I}, "${this.tu.file}:${this.fd.name}")`;
    }
  }
  if (br === "list") {
    this.claim("id.subscript", n);
    return this.form(
      n,
      ctx,
      [
        [base, B],
        [idx, I],
      ],
      () => `${B}[${I}]`,
    );
  }
  if (br === "view") {
    if (!T.isPtr(base.t)) throw new Unsupported("subscript of view");
    this.claim("edit.view-subscript", n);
    return `${this.need("ptr_add")}(${B}, ${I})`;
  }
  this.claim("id.subscript", n);
  return this.form(n, ctx, [[base, B], [idx, I]], () => `${B}[${I}]`);
};

NODE_PRINTERS.MemberExpr = function (n, ctx, use) {
  const base = n.c[0];
  const B = this.js(base, ctx);
  const name = n.name;
  // a field of a C library record reached through a pointer the library returned (readdir's
  // struct dirent): the record is declared in libc/records.js so the view has its fields
  noteLibcRecordOf(this, n.arrow ? this.T.get(base.t).to : base.t);
  if (this.mode === "sugar") {
    const r = rangeIn(n, ctx), br = rangeIn(base, ctx);
    const ml = n.ml ? posIn(n.ml, ctx) : null;
    if (r && br && ml !== null && br[1] <= ml && /\.|->/.test(this.source(ctx).clean(br[1], ml))) {
      const S = this.source(ctx);
      const between = S.clean(br[1], ml);
      const memberTok = S.text.slice(ml, ml + name.length);
      if (memberTok === name && r[1] === ml + name.length) {
        this.claim(n.arrow ? "edit.arrow" : "id.member", n);
        return B + between.replace("->", ".") + name;
      }
      this.claim("edit.member-macro", n);
      return B + between.replace("->", ".") + name;
    }
  }
  this.claim(n.arrow ? "edit.arrow" : "id.member", n);
  return `${B}.${name}`;
};

// the index forms of a struct-array subscript reached through elt(): a negative constant or unary
// minus; k subtracted from (or a negative k added to) something that is not a loop counter; a
// field of a level/coordinate record reached through a pointer parameter (d_level dnum/dlevel:
// -1 is its "no level" value, ledger_no(&tolevel))
function eltIndexForm(P, idx) {
  const s = P.strip(idx);
  if (!s) return null;
  const cval = (x) => {
    const t = P.strip(x);
    if (!t) return null;
    if (t.cv !== undefined) return Number(t.cv);
    if (t.k === "IntegerLiteral") return Number(t.v);
    return null;
  };
  if (s.cv !== undefined && Number(s.cv) < 0) return "negative-constant";
  if (s.k === "UnaryOperator" && s.op === "-") return "unary-minus";
  if (s.k === "BinaryOperator" && (s.op === "-" || s.op === "+")) {
    const k = cval(s.c[1]);
    if (k !== null && ((s.op === "-" && k > 0) || (s.op === "+" && k < 0)) && !isLoopCounter(P, s.c[0]))
      return "minus-k";
  }
  if (s.k === "MemberExpr" && s.arrow && /^(dnum|dlevel)$/.test(s.name)) {
    const b = P.strip(s.c[0]);
    if (b && b.k === "DeclRefExpr" && b.dk === "param") return "level-param";
  }
  return null;
}

// a variable some for loop of this function counts with (init or increment of the loop)
function isLoopCounter(P, x) {
  const s = P.strip(x);
  if (!s || s.k !== "DeclRefExpr") return false;
  if (!P._loopVars) {
    P._loopVars = new Set();
    const refsIn = (n, out) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "DeclRefExpr") out.add(n.ref);
      for (const c of n.c || []) refsIn(c, out);
    };
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (n.k === "ForStmt") { refsIn(n.c[0], P._loopVars); refsIn(n.c[3], P._loopVars); }
      for (const c of n.c || []) walk(c);
    };
    walk(P.fd.body);
  }
  return P._loopVars.has(s.ref);
}

function noteLibcRecordOf(P, tid) {
  if (tid === undefined || tid === null) return;
  const t = P.T.get(tid);
  if (!t || t.k !== "rec") return;
  const r = P.em.tu.recByName.get(t.rec);
  if (r && !P.em.isProjectFile(r.file) && P.em.fileIndexOf(r.file) !== 0) P.em.noteLibcRecord(r);
}

NODE_PRINTERS.UnaryExprOrTypeTraitExpr = function (n, ctx) {
  this.claim("edit.sizeof", n);
  if (n.trait !== "sizeof") throw new Unsupported("alignof");
  if (n.at !== undefined) return `${this.need("sizeof")}(${this.typeExpr(n.at, null, ctx)})`;
  const e = this.strip(n.c[0]);
  if (e && e.k === "StringLiteral") return `${this.need("sizeof_string")}(${this.js(e, ctx)})`;
  // sizeof of a declared array: its declared extent expressions
  if (e && this.T.isArr(e.t)) {
    const ext = this.extentsOf(e);
    if (ext && ext[0]) return `${this.need("sizeof")}(${this.typeExpr(e.t, ext, ctx)})`;
  }
  if (e && e.k === "MemberExpr" && this.T.isArr(e.t)) {
    // sizeof p->arr: the member's size from the struct layout
    return `${this.need("sizeof_member")}(${this.js(e.c[0], ctx)}, "${e.name}")`;
  }
  if (this.T.isArr(n.c[0].t)) {
    const L = e && e.k === "DeclRefExpr" ? this.localOf(e.ref) : null;
    const si = L?.d?.init ? this.strip(L.d.init) : null;
    // char s[] = "text": the literal's size
    if (si && si.k === "StringLiteral") return `${this.need("sizeof_string")}(${this.js(si, ctx)})`;
    // a static array whose extent the initializer gives: its allocated size
    const qual = (name) =>
      (this.em.index.staticFiles?.[name]?.length || 0) > 1 && this.em.index.staticFiles[name].includes(this.tu.file)
        ? `${path.basename(this.tu.file)}/${name}`
        : name;
    const key =
      e && e.k === "DeclRefExpr"
        ? L
          ? L.kind === "static"
            ? `${this.fd.name}.${e.name}`
            : null
          : e.dk === "global" || e.dk === "extern-local"
            ? qual(e.name)
            : null
        : null;
    if (key) return `${this.need("static_sizeof")}("${key}")`;
    const r = this.T.repr(n.c[0].t);
    if (r === "list" || r === "ref") {
      const length = `${this.js(n.c[0], ctx)}.length`;
      return `(${length} * ${this.need("sizeof")}(${this.typeExpr(this.T.elem(n.c[0].t), null, ctx)}))`;
    }
    throw new Unsupported(
      `sizeof array expression without extent (${e?.k} ${e?.name ?? ""} ${e?.dk ?? ""}) at ${this.siteOf(n)}`,
    );
  }
  return `${this.need("sizeof")}(${this.typeExpr(n.c[0].t, null, ctx)})`;
};



NODE_PRINTERS.OffsetOfExpr = function (n, ctx) {
  this.claim("edit.offsetof", n);
  if (n.comps.length !== 1 || !n.comps[0]) throw new Unsupported("offsetof path");
  return `${this.need("offsetof")}(${this.typeExpr(n.at, null, ctx)}, "${n.comps[0]}")`;
};

// ---- statements ---------------------------------------------------------------------------
NODE_PRINTERS.CompoundStmt = function (n, ctx) {
  this.claim("id.compound", n);
  return this.block(n, ctx, n.c);
};

NODE_PRINTERS.NullStmt = function (n, ctx) { this.claim("id.stmt", n); return this.rawText(n, ctx) ?? ";"; };

NODE_PRINTERS.ReturnStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  const e = n.c[0];
  if (!e) return this.form(n, ctx, [], () => "return;");
  let E = this.js(e, ctx);
  if (EXACT64_RETURNS.has(this.fd.name) && this.T.isInt(e.t)) E = this.toBig(e, E, false);
  let t = this.form(n, ctx, [[e, E]], () => `return ${E};`);
  // `return` at the end of a line would return undefined (ASI): open a parenthesis there
  if (/^return[ \t]*(\/\*[^\n]*?\*\/[ \t]*)?\n/.test(t)) {
    this.claim("edit.return-paren", n);
    t = t.replace(/^return/, "return (");
    t = /;\s*$/.test(t) ? t.replace(/;(\s*)$/, ");$1") : t + ")";
  }
  return t;
};

NODE_PRINTERS.BreakStmt = function (n, ctx) {
  if (n._jumpLabel) {
    this.claim("goto.reentry", n);
    return this.form(n, ctx, [], () => "break;").replace(/^break/, `break ${n._jumpLabel}`);
  }
  this.claim("id.stmt", n); return this.form(n, ctx, [], () => "break;");
};
NODE_PRINTERS.ContinueStmt = function (n, ctx) {
  if (n._jumpLabel) {
    this.claim("goto.reentry", n);
    return this.form(n, ctx, [], () => "continue;").replace(/^continue/, `continue ${n._jumpLabel}`);
  }
  this.claim("id.stmt", n); return this.form(n, ctx, [], () => "continue;");
};

NODE_PRINTERS.IfStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  // children: [init?, cond, then, else?] in clang's order; with no init/var: cond, then, else
  const [cond, th, el] = n.c;
  let C = this.js(cond, ctx, "bool");
  if (n._condWrap) { this.claim("goto.reentry", n); C = n._condWrap(C); }
  const A = this.stmt(th, ctx), B = el ? this.stmt(el, ctx) : null;
  return this.form(n, ctx, [[cond, C], [th, A], ...(el ? [[el, B]] : [])],
    () => `if (${C}) ${semi(th, A)}${el ? ` else ${semi(el, B)}` : ""}`);
};

NODE_PRINTERS.WhileStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  const [cond, body] = n.c.slice(-2);
  let C = this.js(cond, ctx, "bool");
  if (n._condWrap) { this.claim("goto.reentry", n); C = n._condWrap(C); }
  this.loopDepth++;
  const B = this.stmt(body, ctx);
  this.loopDepth--;
  return this.form(n, ctx, [[cond, C], [body, B]], () => `while (${C}) ${semi(body, B)}`);
};

NODE_PRINTERS.DoStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  const [body, cond] = n.c;
  this.loopDepth++;
  const B = this.stmt(body, ctx);
  this.loopDepth--;
  const C = this.js(cond, ctx, "bool");
  return this.form(n, ctx, [[body, B], [cond, C]], () => `do ${semi(body, B)} while (${C})`);
};

NODE_PRINTERS.ForStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  // clang ForStmt children: init, condVar, cond, inc, body
  const [init, , cond, inc, body] = n.c;
  let I = init ? (init.k === "DeclStmt" ? this.declStmt(init, ctx, true) : this.js(init, ctx, "discard")) : "";
  let C = cond ? this.js(cond, ctx, "bool") : "";
  if (n._initWrap) { this.claim("goto.reentry", n); I = n._initWrap(I); C = n._condWrap(C || "true"); }
  const N = inc ? this.js(inc, ctx, "discard") : "";
  this.loopDepth++;
  const B = this.stmt(body, ctx);
  this.loopDepth--;
  const kids = [[init, I], [cond, C], [inc, N], [body, B]].filter(([k]) => k);
  return this.form(
    n,
    ctx,
    kids,
    () => `for (${init && init.k === "DeclStmt" ? I : I + ";"} ${C}; ${N}) ${semi(body, B)}`,
  );
};

NODE_PRINTERS.SwitchStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  const [cond, body] = n.c.slice(-2);
  const sc = this.strip(cond);
  let C = this.js(cond, ctx);
  if (n._condWrap) { this.claim("goto.reentry", n); C = n._condWrap(C); }
  this.switchDepth++;
  const B = this.stmt(body, ctx, { switchBody: true });
  this.switchDepth--;
  return this.form(n, ctx, [[cond, C], [body, B]], () => `switch (${C}) ${B}`);
};

NODE_PRINTERS.CaseStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  // children: lhs, (rhs for GNU ranges), sub
  if (n.c.length === 3 && n.c[1]) throw new Unsupported("case range");
  const lhs = n.c[0], sub = n.c[n.c.length - 1];
  const L = this.js(lhs, ctx), S = this.stmt(sub, ctx);
  return this.form(n, ctx, [[lhs, L], [sub, S]], () => `case ${L}: ${semi(sub, S)}`);
};

NODE_PRINTERS.DefaultStmt = function (n, ctx) {
  this.claim("id.stmt", n);
  const sub = n.c[0];
  const S = this.stmt(sub, ctx);
  return this.form(n, ctx, [[sub, S]], () => `default: ${semi(sub, S)}`);
};

NODE_PRINTERS.DeclStmt = function (n, ctx) { return this.declStmt(n, ctx, false); };

NODE_PRINTERS.AttributedStmt = function (n, ctx) {
  // FALLTHROUGH; -> /* FALLTHROUGH */;
  const sub = n.c[n.c.length - 1];
  if (sub && sub.k === "NullStmt") { this.claim("edit.fallthrough", n); return "/* FALLTHROUGH */;"; }
  this.claim("id.stmt", n);
  return this.stmt(sub, ctx);
};

NODE_PRINTERS.LabelStmt = function (n, ctx) {
  const L = this.labels.get(n.name);
  if (!L) throw new Unsupported("label " + n.name);
  const sub = n.c[0];
  const S = this.stmt(sub, ctx);
  // the label line closes the labeled block (forward), opens the loop (backward), or is the
  // dispatcher's case for it (the case label itself is put before the statement holding it)
  let head;
  if (L.kind === "forward") { this.claim("goto.forward", n); head = "}"; }
  else if (L.kind === "backward") { this.claim("goto.backward", n); head = `${L.js}: for (;;) {`; }
  else if (L.kind === "dispatch") { this.claim("goto.dispatch", n); head = "$goto = null;"; }
  else { this.claim("goto.unused-label", n); head = ""; }
  const r = rangeIn(n, ctx), sr = rangeIn(sub, ctx);
  if (this.mode === "sugar" && r && sr) {
    const gap = this.source(ctx).clean(r[0], sr[0]).replace(/^\s*\w+\s*:/, (m) => m.replace(/\w+\s*:/, head));
    return gap + S;
  }
  return head ? `${head} ${S}` : S;
};

NODE_PRINTERS.GotoStmt = function (n, ctx) {
  const L = this.labels.get(n.name);
  if (!L) throw new Unsupported("goto " + n.name);
  n._eatSemi = true;
  if (n._gotoText) { this.claim("goto.dispatch", n); return n._gotoText; }
  this.claim(L.kind === "forward" ? "goto.forward" : "goto.backward", n);
  return L.kind === "forward" ? `break ${L.js};` : `continue ${L.js};`;
};


// _pre/_post of a statement that is not directly in a block (the sub-statement of a case label)
function wrapPrePost(k, t) {
  if (!k || (!k._pre && !k._post)) return t;
  if (k._post && !/[;}]\s*$/.test(t)) t += ";";
  if (k._post) k._eatSemi = true;
  return (k._pre || "") + t + (k._post || "");
}

function semi(k, t) { return k && !STMT_KINDS.has(k.k) ? t + ";" : t; }

const STMT_KINDS = new Set(["CompoundStmt", "IfStmt", "WhileStmt", "DoStmt", "ForStmt", "SwitchStmt", "CaseStmt",
  "DefaultStmt", "ReturnStmt", "BreakStmt", "ContinueStmt", "NullStmt", "DeclStmt", "LabelStmt", "GotoStmt",
  "AttributedStmt"]);




/** keep a statement's line count: pad with newlines, or flatten if it grew */
export function pad(text, want) {
  let have = countNL(text);
  if (have > want) {
    text = text.replace(/\/\/([^\n]*)\n/g, "/*$1*/\n").replace(/\n\s*/g, (m) => (have-- > want ? " " : m));
    have = countNL(text);
  }
  return have < want ? text + "\n".repeat(want - have) : text;
}

// ---- declarations -------------------------------------------------------------------------



