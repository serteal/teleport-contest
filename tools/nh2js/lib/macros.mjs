// lib/macros.mjs: keep macro invocations as calls to same-named JS functions.
//
// A macro invocation is kept (`NAME(args)`) when the JS function call provably behaves like the
// C expansion at this site:
//   - one AST node is exactly the whole expansion, and each argument is substituted as whole
//     AST nodes (no token pasting / stringizing / syntax fragments / type arguments)
//   - every argument is evaluated at least once unconditionally, and an argument evaluated more
//     than once has no side effects; an argument with side effects is evaluated exactly once and
//     the rest of the body has none (JS evaluates arguments before the body)
//   - the body refers to no local variable of the site and contains no control flow
//   - the value is not used as an lvalue (those expand in place)
//   - the JS body printed from this site is the same as at every other site (type-dependent
//     macros keep only the first body; differing sites expand)
// Everything else expands in place (rule macro.expand). The kept body is printed by splicing
// the #define text, so the JS function reads like the macro.

import { exactInvocations, argInstanceOf, argLevelAny, paramUseOffset, posIn, bodyCtx } from "./loc.mjs";
import { Unclaimed, NoSplice, Unsupported } from "./rules.mjs";
import { jsStringBody } from "./text.mjs";
import { builtinMacroOf, isListDecay } from "./printer.mjs";

const LIBC_EXPORTS = new Set(Object.keys(await import("../../../js/rt/libc.js")));
// JS keywords and reserved names a macro parameter cannot be called (it gets a trailing "_")
const JS_KEYWORD = new RegExp("^(var|let|const|new|delete|class|function|this|in|of|do|if|for|while|switch|case|" +
  "default|return|typeof|void|with|yield|await|enum|export|import|super|null|true|false|static|eval|arguments)$");

function findFileLiteral(P, n) {
  let out = null;
  const walk = (m) => {
    if (!m || typeof m !== "object" || out) return;
    if (m.k === "StringLiteral" && m.b && builtinMacroOf(P, m) === "__FILE__") {
      out = m;
      return;
    }
    for (const c of m.c || []) walk(c);
  };
  walk(n);
  return out;
}

// macros never kept as calls (runtime-level or syntax-level)
const NEVER = new Set(["FALLTHROUGH", "nhUse", "UNUSED", "va_start", "va_end", "va_arg", "va_copy",
  "offsetof", "NULL", "__func__", "FDECL", "NDECL", "VDECL", "NONNULL", "NONNULLARG1", "NONNULLPTRS",
  "staticfn", "NEARDATA", "PRINTF_F", "ATTRNORETURN", "NORETURN", "SIZE", "Sprintf",
  "nh_snprintf", "Vsprintf", "Vsnprintf", "Strcpy", "Strcat"]);

export class Macros {
  constructor(em) {
    this.em = em;
    this.defs = new Map();      // name -> {name, header, params, kind, body, sites, local}
    this.conflicts = new Map(); // name -> count of sites whose body differed
    this.rejected = new Map();  // reason -> count
    this.rejectedBy = new Map(); // "NAME: reason" -> count
  }

  reject(why, name) {
    this.rejected.set(why, (this.rejected.get(why) || 0) + 1);
    if (name) { const k = `${name}: ${why}`; this.rejectedBy.set(k, (this.rejectedBy.get(k) || 0) + 1); }
    return null;
  }

  // the Macros object is shared by every TU's emitter (this.em is the TU being emitted); a
  // site is always resolved in the printer's own TU (header modules are printed after the last
  // TU, from whichever TU declared each item: invocation ids and file indices are per TU)
  trySite(P, n, ctx, use) {
    const em0 = this.em;
    this.em = P.em;
    try { return this.trySiteIn(P, n, ctx, use); } finally { this.em = em0; }
  }

  trySiteIn(P, n, ctx, use) {
    if (!PURE_FNS)
      PURE_FNS = new Set(
        Object.entries(this.em.index.functions)
          .filter(([, f]) => f.pure)
          .map(([k]) => k),
      );
    const xs = exactInvocations(n);
    if (process.env.NH2JS_DEBUG_CTX && ctx.f == process.env.NH2JS_DEBUG_CTX && n.k === "IntegerLiteral")
      console.error(
        "TS",
        n.v,
        xs.map((x) => this.em.tu.invById.get(x)?.name),
        JSON.stringify(n.b).slice(0, 300),
      );
    if (!xs.length) return null;
    const inv = this.em.tu.invById;
    if (process.env.NH2JS_DEBUG_MACRO) {
      const names = xs.map((id) => inv.get(id)?.name);
      if (names.includes(process.env.NH2JS_DEBUG_MACRO))
        console.error(
          "trySite",
          names,
          JSON.stringify(ctx),
          xs.map((id) => [posIn(inv.get(id)?.b, ctx), posIn(inv.get(id)?.e, ctx)]),
        );
    }
    // the outermost invocation whose call text is written in ctx
    let x = null;
    for (const id of xs) {
      const v = inv.get(id);
      if (v && !v.builtin && posIn(v.b, ctx) !== null && posIn(v.e, ctx) !== null) x = id;
    }
    // not written in ctx: an invocation inside a macro body that is being expanded in place.
    // Keep its name anyway (the call is synthesized from its arguments).
    let hidden = false;
    if (x === null) {
      // only invocations inside the context (never the macro whose body is being printed, or
      // one enclosing it)
      const lim = ctx.kind === "body" && xs.includes(ctx.x) ? xs.indexOf(ctx.x) : xs.length;
      for (let i = 0; i < lim; i++) { const v = inv.get(xs[i]); if (v && !v.builtin) x = xs[i]; }
      if (x === null) return null;
      hidden = true;
    }
    const v = inv.get(x);
    if (v.name === "SIZE" && v.fn) return this.sizeMacro(P, n, ctx, x);
    if (v.name === "assert" && v.fn && !this.em.isProjectFile(v.dfile)) return this.assertMacro(P, n, ctx, x);
    // a C library integer constant (SIGINT, EOF, INT_MAX, O_RDONLY): its name, from rt/libc.js
    const lit = P.stripImp(n);
    const cval = n.cv ?? (lit && lit.k === "IntegerLiteral" ? lit.v : undefined);
    if (
      !v.fn &&
      v.name !== "NULL" &&
      /\/sysroot\/|\/lib\/clang\/[0-9]+\/include\//.test(v.dfile) &&
      cval !== undefined &&
      /^[A-Z_][A-Z0-9_]*$/.test(v.name) &&
      use !== "lvalue"
    ) {
      (this.libcConsts ||= new Map()).set(v.name, cval);
      // (named once rt/libc.js exports it: report.libcConsts lists every one wanted)
      if (!LIBC_EXPORTS.has(v.name)) return this.reject("libc-constant-not-exported", v.name);
      P.claim("macro.const", n);
      return P.mod.add(v.name, "rt/libc.js");
    }
    // <signal.h> SIG_IGN / SIG_DFL / SIG_ERR (function pointers made from integers): by name
    if (!v.fn && /^SIG_(IGN|DFL|ERR)$/.test(v.name) && /\/sysroot\//.test(v.dfile) && LIBC_EXPORTS.has(v.name)) {
      P.claim("macro.const", n);
      (this.libcConsts ||= new Map()).set(v.name, "(function pointer)");
      return P.mod.add(v.name, "rt/libc.js");
    }
    if (v.name === "Snprintf" && v.fn) { const t = this.snprintfMacro(P, n, ctx, x, v); if (t !== null) return t; }
    // a macro named like a function (local #define tp_sensemon after the function): expand
    if (this.em.index.functions[v.name] && this.em.fileIndexOf(v.dfile) === 0)
      return this.reject("shadows-function", v.name);
    if (NEVER.has(v.name)) return this.reject("never-list", v && v.name);
    if (!this.em.isProjectFile(v.dfile)) return this.reject("system-header", v && v.name);
    const defFile = this.em.fileIndexOf(v.dfile);
    if (defFile < 0) return this.reject("no-def-file", v && v.name);
    try {
      return v.fn
        ? this.functionLike(P, n, ctx, use, x, v, defFile, hidden)
        : this.objectLike(P, n, ctx, use, x, v, defFile);
    } catch (e) {
      if (e instanceof Unclaimed || e instanceof NoSplice || e instanceof Unsupported)
        return this.reject("body:" + (e.message || e.constructor.name).slice(0, 40), v.name);
      throw e;
    }
  }

  // SIZE(arr) on a JS Array / typed array: the hand-written rt SIZE (arr.length)
  sizeMacro(P, n, ctx, x) {
    let inst = null;
    const walk = (m) => {
      if (!m || inst) return;
      if (argInstanceOf(m, x) !== null) {
        inst = m;
        return;
      }
      for (const c of m.c || []) walk(c);
    };
    walk(n);
    if (!inst) return this.reject("SIZE-arg");
    const r = P.T.repr(inst.t);
    if (r !== "list" && r !== "ref") return this.reject("SIZE-of-" + r);
    P.claim("macro.call", n);
    return `${P.need("SIZE")}(${P.js(inst, ctx)})`;
  }

  // <assert.h> assert(e): a call of rt/libc.js assert(e) (aborts like __assert_fail when e is
  // false; the message text, file and line only go to stderr)
  assertMacro(P, n, ctx, x) {
    let inst = null;
    const walk = (m) => {
      if (!m || inst) return;
      if (argInstanceOf(m, x) !== null) { inst = m; return; }
      for (const c of m.c || []) walk(c);
    };
    walk(n);
    if (!inst) return this.reject("assert-arg");
    P.claim("macro.call", n);
    return `${P.mod.add("assert", "rt/libc.js")}(${P.js(inst, ctx, "bool")})`;
  }

  // hacklib.h Snprintf(str, size, ...) = nh_snprintf(__func__, __LINE__, str, size, __VA_ARGS__):
  // kept as a call. nh_snprintf does not use func/line (UNUSED; the report is #if 0), so the JS
  // Snprintf passes its own name and 0 rather than a line number of the site.
  snprintfMacro(P, n, ctx, x, v) {
    let call = null;
    const walk = (m) => {
      if (!m || call) return;
      if (m.k === "CallExpr" && m.callee === "nh_snprintf") {
        call = m;
        return;
      }
      for (const c of m.c || []) walk(c);
    };
    walk(n);
    if (!call) return null;
    const args = call.c.slice(3).map((a) => P.js(a, ctx));
    const defFile = this.em.fileIndexOf(v.dfile);
    const sk = this.key("Snprintf", defFile);
    if (!this.defs.has(sk)) {
      this.defs.set(sk, {
        name: "Snprintf",
        key: sk,
        localFile: defFile === 0 ? this.em.tu.file : null,
        header: v.dfile,
        defFile,
        params: ["str", "size", "...args"],
        kind: "fn",
        body: `nh_snprintf(_("Snprintf"), 0, str, size, ...args)`,
        sites: 0,
        local: defFile === 0,
        line: this.em.defLine("Snprintf", defFile),
        imports: new Map([
          ["nh_snprintf", "src/hacklib.js"],
          ["_", "rt/strings.js"],
        ]),
      });
    }
    if (defFile === 0) {
      P.mod.importFunction("nh_snprintf");
      P.need("_");
    } // (a file's own Snprintf: its module imports them)
    this.defs.get(sk).sites++;
    P.claim("macro.call", n);
    return `${P.mod.importMacro("Snprintf", this.defs.get(sk))}(${args.join(", ")})`;
  }

  objectLike(P, n, ctx, use, x, v, defFile) {
    const bodyPrinter = this.bodyPrinter(P, x, defFile, new Map());
    const s = P.stripImp(n);
    let kind;
    if (n.cv !== undefined || ["IntegerLiteral", "CharacterLiteral", "FloatingLiteral", "StringLiteral"].includes(s.k))
      kind = "const";
    else if (s.k === "DeclRefExpr" && s.dk === "function") kind = "alias";
    else if (s.k === "DeclRefExpr" && s.dk === "enum") kind = "const";
    else kind = "value";
    if (kind === "value" && !refersOnlyToGlobals(P, n)) return this.reject("refers-to-locals", v && v.name);
    if (kind === "value" && hasControlFlow(n)) return this.reject("control-flow", v && v.name);
    if (kind === "const" && s.k === "StringLiteral" && use !== "value") { /* fine */ }
    const body = bodyPrinter.js(n, bodyPrinter.ctx, kind === "alias" ? "callee" : "value");
    if (bodyPrinter.usesFile) return this.reject("uses-file", v && v.name);
    // a constant that only renames a constant of another header (objects.h `#define P PIERCE`):
    // the target's name, so header modules do not import each other in a cycle
    if (kind === "const" && /^[A-Za-z_]\w*$/.test(body) && body !== v.name && defFile !== 0) {
      const rel = bodyPrinter.mod.imports.get(body);
      if (rel && rel !== this.em.moduleRelForFile(this.em.fileName(defFile))) {
        P.claim("macro.expand", n);
        this.reject("renames-other-header-constant", v.name);
        return P.mod.add(body, rel);
      }
    }
    if (!this.register(v.name, defFile, [], kind, body, bodyPrinter, P)) return this.reject("variant", v && v.name);
    const name = P.mod.importMacro(v.name, this.defs.get(this.key(v.name, defFile)));
    if (kind === "const") { P.claim("macro.const", n); return name; }
    if (kind === "alias") { P.claim("macro.alias", n); return name; }
    P.claim("macro.value", n);
    return `${name}()`;
  }

  functionLike(P, n, ctx, use, x, v, defFile, hidden) {
    // argument instances inside the expansion
    const insts = [];
    let partial = false;
    const walk = (m, conditional, parent) => {
      if (!m || typeof m !== "object" || partial) return;
      // (an array argument decayed in the body: the array itself is the argument, the body
      // decays it where C does)
      if (isListDecay(P, m) && argInstanceOf(m.c[0], x) !== null) { walk(m.c[0], conditional, m); return; }
      // a string literal argument decays at the call site (`strcmpi(buf, "it")` is
      // strcmpi(buf, _("it")) at every site; the body then reads the same for pointers)
      if (m.k === "ImplicitCastExpr" && m.ck === "ArrayToPointerDecay") {
        let inner = m.c[0];
        while (inner && inner.k === "ParenExpr" && argInstanceOf(inner, x) === null) inner = inner.c[0];
        const pu = inner ? argInstanceOf(inner, x) : null;
        if (pu !== null && P.strip(inner)?.k === "StringLiteral") {
          insts.push({ node: m, pu, conditional, decay: true, offNode: inner, lit: P.strip(inner) });
          return;
        }
      }
      const pu = argInstanceOf(m, x);
      if (pu !== null) { insts.push({ node: m, pu, conditional }); return; }
      // a node may start/end exactly where an argument starts/ends (e.g. `otmp->oclass` from
      // the body `otmp->oclass`), but never strictly inside one (`a + b` substituted in `x * 2`)
      const lb = argLevelAny(m.b, x), le = argLevelAny(m.e, x);
      if ((lb && !lb.s) || (le && !le.s)) { partial = true; return; }
      const kids = m.c || [];
      for (let i = 0; i < kids.length; i++) {
        let cond = conditional;
        if (m.k === "ConditionalOperator" && i > 0) cond = true;
        if (m.k === "BinaryOperator" && (m.op === "&&" || m.op === "||") && i === 1) cond = true;
        if (
          (m.k === "IfStmt" && i > 0) ||
          m.k === "WhileStmt" ||
          m.k === "ForStmt" ||
          m.k === "DoStmt" ||
          m.k === "SwitchStmt"
        )
          cond = true;
        walk(kids[i], cond, m);
      }
      if (m.decls) for (const d of m.decls) walk(d.init, conditional, m);
    };
    walk(n, false, null);
    if (partial) return this.reject("partial-argument", v && v.name);
    // an argument assigned to, incremented or address-taken in the body (mz_move(x, y, d) does
    // --(y)): the caller's variable changes in C, a JS parameter would not
    if (assignsArgument(n, x)) return this.reject("argument-is-lvalue", v && v.name);
    const def = this.em.sourceOf(defFile).text;
    const params = v.params;
    const byParam = new Map();
    for (const it of insts) {
      const off = paramUseOffset(it.offNode || it.node, x);
      const m = /^[A-Za-z_]\w*/.exec(def.slice(off, off + 64));
      if (!m) return this.reject("param-spelling", v && v.name);
      const k = params.indexOf(m[0]);
      if (k < 0) return this.reject("param-spelling", v && v.name);
      it.k = k;
      if (!byParam.has(k)) byParam.set(k, []);
      byParam.get(k).push(it);
    }
    if (!v.args || v.args.length !== params.length) return this.reject("arg-count", v && v.name);
    for (let k = 0; k < params.length; k++)
      if (!byParam.has(k)) return this.reject("unused-or-type-param", v && v.name);
    // evaluation-safety
    let impureArgs = 0;
    for (const [k, list] of byParam) {
      const arg = list[0].node;
      const sideEffects = !pureExpr(arg);
      const anyUnconditional = list.some((it) => !it.conditional);
      if (sideEffects) {
        impureArgs++;
        if (list.length !== 1 || list[0].conditional)
          return this.reject("impure-arg-multi-or-conditional", v && v.name);
      } else if (!anyUnconditional && mayTrap(arg)) return this.reject("conditional-trapping-arg", v && v.name);
    }
    if (impureArgs && !bodyPure(n, insts)) return this.reject("impure-arg-with-impure-body", v && v.name);
    if (impureArgs > 1) {
      const order = [...byParam.entries()].filter(([, l]) => !pureExpr(l[0].node)).map(([k]) => k);
      for (let i = 1; i < order.length; i++)
        if (order[i] < order[i - 1]) return this.reject("impure-arg-order", v && v.name);
    }
    if (!refersOnlyToGlobals(P, n, insts)) return this.reject("refers-to-locals", v && v.name);
    if (hasControlFlow(n, insts)) return this.reject("control-flow", v && v.name);
    // body text (args -> parameter names)
    const jsParams = params.map((p) =>
      JS_KEYWORD.test(p)
        ? p + "_"
        : p,
    );
    const paramMap = new Map(insts.filter((it) => !it.decay).map((it) => [it.pu, jsParams[it.k]]));
    const bodyPrinter = this.bodyPrinter(P, x, defFile, paramMap);
    // (the parentheses the body writes around the parameter stay)
    bodyPrinter.paramNodes = new Map(
      insts
        .filter((it) => it.decay)
        .map((it) => [it.node, it.node.c[0]?.k === "ParenExpr" ? `(${jsParams[it.k]})` : jsParams[it.k]]),
    );
    if (bodyDecls(n).size) {
      bodyPrinter.analyzeLocals({ params: [], body: n });
      if ([...bodyPrinter.locals.values()].some((L) => L.kind !== "plain"))
        return this.reject("body-local-in-memory", v && v.name);
      bodyPrinter.needsFrame = false;
    }
    const isStmt = STMT.has(n.k);
    const body = isStmt ? bodyPrinter.stmt(n, bodyPrinter.ctx) : bodyPrinter.js(n, bodyPrinter.ctx, "value");
    const kind = isStmt ? "stmt" : "fn";
    // a body using __FILE__ gets the site's as a last argument (the module constant)
    const usesFile = !!bodyPrinter.usesFile;
    if (usesFile) {
      jsParams.push("__FILE__");
      const lit = findFileLiteral(P, n);
      if (!lit) return this.reject("file-literal", v && v.name);
      P.mod.fileConst = jsStringBody(lit.bytes);
    }
    if (!this.register(v.name, defFile, jsParams, kind, body, bodyPrinter, P))
      return this.reject("variant", v && v.name);
    if (hidden) {
      const args = params.map((_, k) => {
        const it0 = byParam.get(k)[0];
        return it0.decay ? `${P.need("_")}(${P.js(it0.lit, ctx, "value")})` : P.js(it0.node, ctx, "value");
      });
      if (usesFile) args.push("__FILE__");
      const name = P.mod.importMacro(v.name, this.defs.get(this.key(v.name, defFile)));
      P.claim("macro.call", n);
      return `${name}(${args.join(", ")})`;
    }
    // call text: the invocation as written, each argument replaced by its JS
    const S = P.source(ctx);
    const b = posIn(v.b, ctx), e = posIn(v.e, ctx);
    let out = "", cur = b;
    for (let k = 0; k < params.length; k++) {
      const a = v.args[k];
      if (!a) return this.reject("empty-arg", v && v.name);
      const ab = posIn(a.b, ctx), ae = posIn(a.e, ctx);
      if (ab === null || ae === null || ab < cur || ae > e) return this.reject("arg-position", v && v.name);
      const it0 = byParam.get(k)[0];
      const js = it0.decay ? `${P.need("_")}(${P.js(it0.lit, ctx, "value")})` : P.js(it0.node, ctx, "value");
      out += S.clean(cur, ab) + js;
      cur = ae;
    }
    out += S.clean(cur, e);
    if (usesFile) out = out.replace(/\)(\s*)$/, ", __FILE__)$1");
    const name = P.mod.importMacro(v.name, this.defs.get(this.key(v.name, defFile)));
    if (name !== v.name) out = name + out.slice(v.name.length);
    P.claim("macro.call", n);
    return out;
  }

  bodyPrinter(P, x, defFile, paramMap) {
    // imports of the body go to a scratch module; register() files them with the definition
    const scratch = defFile === 0 ? P.mod : new this.em.ModuleClass(this.em, "src/<scratch>.h.js");
    const bp = P.child(bodyCtx(x, defFile), paramMap, scratch);
    return bp;
  }

  // (a header macro is keyed by its header: NOW is 1 in botl.h and 128 in another header)
  key(name, defFile) { return defFile === 0 ? `${this.em.tu.file}:${name}` : `${this.em.fileName(defFile)}:${name}`; }

  register(name0, defFile, params, kind, body, bodyPrinter, P) {
    // macros local to a C file are distinct per file
    const name = this.key(name0, defFile);
    const d = this.defs.get(name);
    if (d) {
      d.sites++;
      if (d.body !== body || d.kind !== kind) {
        this.conflicts.set(name, (this.conflicts.get(name) || 0) + 1);
        if (!this.variantBodies) this.variantBodies = new Map();
        if (!this.variantBodies.has(name)) this.variantBodies.set(name, [d.body, body]);
        return false;
      }
      return true;
    }
    const header = this.em.fileName(defFile);
    this.defs.set(name, {
      name: name0,
      key: name,
      localFile: defFile === 0 ? this.em.tu.file : null,
      header,
      defFile,
      params,
      kind,
      body,
      sites: 1,
      local: defFile === 0,
      line: this.em.defLine(name0, defFile),
      imports: defFile === 0 ? null : bodyPrinter.mod.imports,
    });
    bodyPrinter.commitClaims();
    return true;
  }
}

const STMT = new Set(["DoStmt", "IfStmt", "CompoundStmt", "WhileStmt", "ForStmt", "SwitchStmt"]);

function touchesArg(L, x) { return L && L.a === 1 && L.up && L.up.x === x; }

// (a call of a function the index found pure counts as pure: glyph_at(x, y))
let PURE_FNS = null;
function pureExpr(n) {
  if (!n || typeof n !== "object") return true;
  if (n.k === "CallExpr" && !(n.callee && PURE_FNS && PURE_FNS.has(n.callee))) return false;
  if (n.k === "CompoundAssignOperator") return false;
  if (n.k === "BinaryOperator" && n.op === "=") return false;
  if (n.k === "UnaryOperator" && (n.op === "++" || n.op === "--")) return false;
  for (const c of n.c || []) if (!pureExpr(c)) return false;
  return true;
}

function mayTrap(n) {
  if (!n || typeof n !== "object") return false;
  if (n.k === "MemberExpr" && n.arrow) return true;
  if (n.k === "UnaryOperator" && n.op === "*") return true;
  if (n.k === "ArraySubscriptExpr") return true;
  for (const c of n.c || []) if (mayTrap(c)) return true;
  return false;
}

function bodyPure(n, insts) {
  const skip = new Set(insts.map((i) => i.node));
  const walk = (m) => {
    if (!m || typeof m !== "object" || skip.has(m)) return true;
    if (m.k === "CallExpr" || m.k === "CompoundAssignOperator") return false;
    if (m.k === "BinaryOperator" && m.op === "=") return false;
    if (m.k === "UnaryOperator" && (m.op === "++" || m.op === "--")) return false;
    for (const c of m.c || []) if (!walk(c)) return false;
    return true;
  };
  return walk(n);
}

// (locals the macro body declares itself are fine: they become locals of the JS function)
function bodyDecls(n) {
  const ids = new Set();
  const walk = (m) => {
    if (!m || typeof m !== "object") return;
    if (m.decls) for (const d of m.decls) { if (d.k === "Var") ids.add(d.id); walk(d.init); }
    for (const c of m.c || []) walk(c);
  };
  walk(n);
  return ids;
}

function refersOnlyToGlobals(P, n, insts = []) {
  const skip = new Set(insts.map((i) => i.node));
  const own = bodyDecls(n);
  const walk = (m) => {
    if (!m || typeof m !== "object" || skip.has(m)) return true;
    if (m.k === "DeclRefExpr" && (m.dk === "local" || m.dk === "param" || m.dk === "static-local") && !own.has(m.ref))
      return false;
    for (const c of m.c || []) if (!walk(c)) return false;
    if (m.decls)
      for (const d of m.decls)
        if (d.k !== "Var" || d.sc === "static" || d.staticLocal || (d.init && !walk(d.init))) return false;
    return true;
  };
  return walk(n);
}

function hasControlFlow(n, insts = []) {
  const skip = new Set(insts.map((i) => i.node));
  const walk = (m, inLoop) => {
    if (!m || typeof m !== "object" || skip.has(m)) return false;
    if (m.k === "ReturnStmt" || m.k === "GotoStmt" || m.k === "LabelStmt") return true;
    if ((m.k === "BreakStmt" || m.k === "ContinueStmt") && !inLoop) return true;
    const loop = inLoop || m.k === "DoStmt" || m.k === "WhileStmt" || m.k === "ForStmt" || m.k === "SwitchStmt";
    for (const c of m.c || []) if (walk(c, loop)) return true;
    return false;
  };
  return walk(n, false);
}

function assignsArgument(n, x) {
  const isInst = (m) => {
    while (m && (m.k === "ParenExpr" || m.k === "ImplicitCastExpr")) {
      if (argInstanceOf(m, x) !== null) return true;
      m = m.c[0];
    }
    return m && argInstanceOf(m, x) !== null;
  };
  const walk = (m) => {
    if (!m || typeof m !== "object") return false;
    if ((m.k === "BinaryOperator" && m.op === "=") || m.k === "CompoundAssignOperator") if (isInst(m.c[0])) return true;
    if (m.k === "UnaryOperator" && (m.op === "++" || m.op === "--" || m.op === "&") && isInst(m.c[0])) return true;
    for (const c of m.c || []) if (walk(c)) return true;
    return false;
  };
  return walk(n);
}
