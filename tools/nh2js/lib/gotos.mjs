// lib/gotos.mjs: structured lowering of goto (total over C's local gotos).
//
// Readable forms, used when the labels of a block allow them:
//   forward  goto L; ... L: s    ->   L: { ... break L; ... } s
//            (the labeled block opens at the first statement of L's block that contains a goto)
//   backward L: s; ... goto L;   ->   L: for (;;) { s; ... continue L; ... break; }
// The label line is reused for the `}` / `L: for (;;) {`, so line numbers do not move.
//
// Everything else (a label reached from both sides, regions that overlap, regions crossing the
// case labels of a switch, gotos into a nested block, loop or branch) uses a dispatcher over
// the function's `$goto` variable (the name of the label being jumped to, or null):
//   - the innermost block B holding the label and all its gotos becomes
//         $goto_L: for (;;) { switch ($goto) { default: ...; case "L": $goto = null; s ... } break; }
//     (a switch body is its own dispatcher: `switch ($goto || (c))`, the label is a case of it);
//   - `goto L;` becomes `{ $goto = "L"; continue $goto_L; }`;
//   - every block between B and a nested label jumps to the statement holding it
//     (`switch ($goto) { default: ... case "L": ... }`), and the statements on the way are
//     entered through their conditions: `if ($goto || (c))`, `while ($goto || (c))`, ...;
//   - break/continue that the new loop or switch would capture are retargeted to a label put
//     on the statement they meant (`$out_L`).

import { Unsupported } from "./rules.mjs";

const LOOPS = new Set(["WhileStmt", "DoStmt", "ForStmt"]);
const TRANSPARENT = new Set(["CaseStmt", "DefaultStmt", "LabelStmt", "AttributedStmt"]);

export function lowerGotos(P, fd) {
  const gotos = [], labels = new Map(), setjmps = [];
  const walk = (n, chain) => {
    if (!n || typeof n !== "object") return;
    if (n.k === "GotoStmt") gotos.push({ n, chain: chain.slice() });
    if (n.k === "CallExpr" && SETJMP.has(n.callee)) setjmps.push({ n, chain: chain.slice() });
    if (n.k === "LabelStmt") labels.set(n.name, { name: n.name, n, chain: chain.slice() });
    chain.push(n);
    for (const c of n.c || []) walk(c, chain);
    if (n.decls) for (const d of n.decls) walk(d.init, chain);
    chain.pop();
  };
  walk(fd.body, []);
  if (!gotos.length && !labels.size && !setjmps.length) return;
  P.forceVar = true;
  const byLabel = new Map();
  for (const g of gotos) {
    if (!labels.has(g.n.name)) throw new Unsupported("goto to unknown label");
    if (!byLabel.has(g.n.name)) byLabel.set(g.n.name, []);
    byLabel.get(g.n.name).push(g);
  }
  // setjmp: a label at the statement holding the call, jumped to from a catch around the rest
  // of the function (see "setjmp" below)
  setjmps.forEach((sj, i) => {
    let k = sj.chain.length - 1;
    while (k > 0 && sj.chain[k - 1].k !== "CompoundStmt") k--;
    if (k <= 0) throw new Unsupported("setjmp outside a block statement");
    for (let j = k + 1; j < sj.chain.length; j++) {
      const m = sj.chain[j], parent = sj.chain[j - 1];
      if (LOOPS.has(parent.k) && !(parent.k === "DoStmt" ? false : parent.c.indexOf(m) === parent.c.length - 1))
        throw new Unsupported("setjmp in a loop condition");
    }
    const name = `setjmp${i ? i + 1 : ""}`;
    const S = sj.chain[k];
    const sfx = i ? String(i + 1) : "";
    sj.n._setjmp = { jb: `$jb${sfx}`, jv: `$jv${sfx}` };
    labels.set(name, { name, n: S, chain: sj.chain.slice(0, k), setjmp: sj.n._setjmp });
    byLabel.set(name, [{ n: { k: "<longjmp>" }, chain: [fd.body], longjmp: true }]);
  });
  const G = new Lowering(P);
  // per label: its dispatcher block (innermost block holding the label and every goto to it)
  const blocks = new Map(); // block -> {B, chain, own: [label]}
  for (const [name, L] of labels) {
    const gs = byLabel.get(name) || [];
    if (!gs.length) { P.labels.set(name, { kind: "unused", js: name }); continue; }
    L.gotos = gs;
    let bi = -1;
    for (let i = L.chain.length - 1; i >= 0; i--) {
      const n = L.chain[i];
      if (n.k === "CompoundStmt" && gs.every((g) => g.chain.includes(n))) { bi = i; break; }
    }
    if (bi < 0) throw new Unsupported(`goto ${name}: no common block`);
    L.B = L.chain[bi];
    L.bi = bi;
    L.direct = bi === L.chain.length - 1;
    L.k = L.B.c.indexOf(L.chain[bi + 1] || L.n);
    // (a longjmp may come from anywhere after the setjmp: to the end of the block)
    L.gk = gs.map((g) => {
      if (g.longjmp) return L.B.c.length - 1;
      const at = g.chain.indexOf(L.B);
      return L.B.c.indexOf(g.chain[at + 1] || g.n);
    });
    if (!blocks.has(L.B)) blocks.set(L.B, { B: L.B, chain: L.chain.slice(0, bi), own: [] });
    blocks.get(L.B).own.push(L);
  }
  // labels passing through a block on the way down from their dispatcher
  const passing = new Map(); // block -> [label]
  for (const L of labels.values()) {
    if (!L.B || L.direct) continue;
    for (let i = L.bi + 1; i < L.chain.length; i++) {
      const n = L.chain[i];
      if (n.k !== "CompoundStmt") continue;
      if (!passing.has(n)) passing.set(n, []);
      passing.get(n).push(L);
      if (!blocks.has(n)) blocks.set(n, { B: n, chain: L.chain.slice(0, i), own: [] });
    }
  }
  for (const info of blocks.values()) {
    info.passing = passing.get(info.B) || [];
    info.switchOf = G.switchOf(info);
    if (!info.passing.length && info.own.every((L) => L.direct && !L.setjmp) && G.simple(info)) continue;
    G.dispatch(info);
  }
  for (const L of labels.values()) if (L.B && !L.direct) G.path(L);
  G.finish();
}

class Lowering {
  constructor(P) {
    this.P = P;
    this.marks = new Map();
    this.outN = 0;
  }
  mark(n) {
    let m = this.marks.get(n);
    if (!m)
      this.marks.set(
        n,
        (m = {
          opens: [],
          cases: [],
          self: [],
          out: [],
          selfCloses: [],
          closes: [],
          then: new Set(),
          else: new Set(),
          loop: false,
          sw: false,
        }),
      );
    return m;
  }

  /** The switch statement whose body this block is, or null. */
  switchOf(info) {
    const p = info.chain[info.chain.length - 1];
    return p && p.k === "SwitchStmt" && p.c[p.c.length - 1] === info.B ? p : null;
  }

  // ---- readable forms ------------------------------------------------------------------
  simple(info) {
    const { B } = info;
    const regions = [];
    for (const L of info.own) {
      const fw = L.gk.every((i) => i < L.k),
        bw = L.gk.every((i) => i >= L.k);
      // (a forward block's `}` is written at the label, after statement k-1: its end is k - 0.5)
      if (fw) regions.push({ L, kind: "forward", s: Math.min(...L.gk), e: L.k - 0.5 });
      else if (bw) regions.push({ L, kind: "backward", s: L.k, e: Math.max(...L.gk) });
      else return false;
    }
    // widen until the regions nest: forward starts move up, backward ends move down
    for (let changed = true, guard = 0; changed && guard < 100; guard++) {
      changed = false;
      for (const a of regions)
        for (const b of regions) {
          if (a === b || !(a.s < b.s && b.s <= a.e && a.e < b.e)) continue;
          if (a.kind === "forward" && b.kind === "forward") {
            b.s = a.s;
            changed = true;
          } else if (a.kind === "backward") {
            a.e = Math.ceil(b.e);
            changed = true;
          } else return false; // a forward block holding the start of a loop that outlives it
        }
    }
    for (const a of regions) for (const b of regions) if (a !== b && a.s < b.s && b.s <= a.e && a.e < b.e) return false;
    // a labeled block or loop cannot contain the case labels of the switch it is in
    if (info.switchOf)
      for (const r of regions)
        for (let i = r.s + (r.kind === "backward" ? 1 : 0); i <= r.e; i++) if (isCase(B.c[i])) return false;
    for (const r of regions) {
      const { L } = r;
      if (r.kind === "forward") {
        this.P.labels.set(L.name, { kind: "forward", js: L.name });
        this.mark(B.c[r.s]).opens.push({ order: -r.e, text: `${L.name}: { ` });
      } else {
        this.P.labels.set(L.name, { kind: "backward", js: L.name });
        this.mark(B.c[r.e]).closes.push(" break; }");
        for (let k = r.s; k <= r.e; k++) this.retarget(B.c[k], info, { loop: true, sw: false, region: L.name });
      }
    }
    return true;
  }

  // ---- dispatchers -----------------------------------------------------------------------
  dispatch(info) {
    const { B } = info;
    const own = info.own,
      anyOwn = own.length > 0;
    const name = anyOwn ? own[0].name : info.passing[0].name;
    const loop = `$goto_${name}`;
    for (const L of own) {
      this.P.labels.set(L.name, { kind: "dispatch", js: L.name });
      for (const g of L.gotos) if (!g.longjmp) g.n._gotoText = `{ $goto = "${L.name}"; continue ${loop}; }`;
    }
    const sjs = own.filter((L) => L.setjmp);
    for (const L of sjs) {
      // the statement is the label: `$goto = null;` before it, the value reset after it (a
      // nested one gets them from path())
      if (!L.direct) continue;
      this.mark(L.n).self.push("$goto = null; ");
      this.mark(L.n).selfCloses.push(` ${L.setjmp.jv} = 0;`);
      (this.P.gotoVars ||= new Map()).set(L.setjmp.jv, "0");
      this.P.gotoVars.set(L.setjmp.jb, "null");
    }
    // a longjmp to the buffer re-enters the dispatcher at the setjmp statement with its value
    if (sjs.length > 1) throw new Unsupported("two setjmp calls in one function");
    const catcher = sjs.length
      ? ` catch ($e) { ${sjs[0].setjmp.jv} = ${this.P.need("setjmp_caught")}($e, ${sjs[0].setjmp.jb}); ` +
        `$goto = "${sjs[0].name}"; continue ${loop}; }`
      : "";
    for (const L of [...own, ...info.passing]) {
      const k = own.includes(L) ? L.k : B.c.indexOf(L.chain[L.chain.indexOf(B) + 1] || L.n);
      if (k < 0) throw new Unsupported(`goto ${L.name}: path`);
      this.mark(B.c[k]).cases.push(`case "${L.name}": `);
    }
    (this.P.gotoVars ||= new Map()).set("$goto", "null");
    const SW = info.switchOf;
    if (SW) {
      // the switch is the dispatcher: `switch ($goto || (c))`, a loop around it for own gotos
      this.mark(SW).sw = true;
      if (anyOwn) {
        this.mark(SW).self.push(`${loop}: for (;;) { `);
        this.mark(SW).selfCloses.push(" break; }");
        // (break still means the switch; continue would mean the new loop)
        this.retarget(
          SW.c[SW.c.length - 1],
          { chain: info.chain.slice(0, -1) },
          { loop: true, sw: false, inSwitch: true, region: name },
        );
      }
      return;
    }
    // a block entered only on the way to labels in its first statement needs no switch
    if (!anyOwn && info.passing.every((L) => B.c.indexOf(L.chain[L.chain.indexOf(B) + 1] || L.n) === 0)) {
      for (const L of info.passing) {
        const m = this.mark(B.c[0]);
        m.cases = m.cases.filter((c) => c !== `case "${L.name}": `);
      }
      return;
    }
    let r0 = info.passing.length ? 0 : Infinity,
      r1 = -1;
    for (const L of own)
      for (const i of [L.k, ...L.gk]) {
        r0 = Math.min(r0, i);
        r1 = Math.max(r1, i);
      }
    for (const L of info.passing) {
      const k = B.c.indexOf(L.chain[L.chain.indexOf(B) + 1] || L.n);
      r1 = Math.max(r1, k);
    }
    const m0 = this.mark(B.c[r0]),
      m1 = this.mark(B.c[r1]);
    m0.opens.push({
      order: 1e9,
      text: `${anyOwn ? `${loop}: for (;;) { ${catcher ? "try { " : ""}` : ""}switch ($goto) { default: `,
    });
    m1.closes.push(anyOwn ? ` } ${catcher ? "break; }" + catcher + " }" : "break; }"}` : " }");
    for (let k = r0; k <= r1; k++) this.retarget(B.c[k], info, { loop: anyOwn, sw: true, region: name });
  }

  /** Conditions on the way from the dispatcher block down to a nested label. */
  path(L) {
    if (L.setjmp) {
      this.mark(L.n).self.push("$goto = null; ");
      this.mark(L.n).selfCloses.push(` ${L.setjmp.jv} = 0;`);
      (this.P.gotoVars ||= new Map()).set(L.setjmp.jv, "0");
      this.P.gotoVars.set(L.setjmp.jb, "null");
    }
    const path = L.chain.slice(L.bi + 1).concat([L.n]);
    for (let k = 0; k < path.length - 1; k++) {
      const n = path[k],
        next = path[k + 1];
      if (n.k === "IfStmt") {
        if (next === n.c[1]) this.mark(n).then.add(L.name);
        else if (next === n.c[2]) this.mark(n).else.add(L.name);
        else throw new Unsupported(`goto ${L.name} into an if condition`);
      } else if (n.k === "SwitchStmt") this.mark(n).sw = true;
      else if (n.k === "WhileStmt" && next === n.c[n.c.length - 1]) this.mark(n).loop = true;
      else if (n.k === "ForStmt" && next === n.c[4]) {
        if (n.c[0] && n.c[0].k === "DeclStmt") throw new Unsupported(`goto ${L.name} into a for with a declaration`);
        this.mark(n).loop = true;
      } else if (n.k === "DoStmt" || n.k === "CompoundStmt" || TRANSPARENT.has(n.k)) {
        if (n.k === "LabelStmt" && this.P.labels.get(n.name)?.kind === "dispatch")
          throw new Unsupported(`goto ${L.name} through label ${n.name}`);
      } else throw new Unsupported(`goto ${L.name} into a ${n.k}`);
    }
  }

  /**
   * break/continue inside `region` (a child of info.B, or a switch body) that a new loop
   * (captures both) or switch (captures break) would bind: label what they meant.
   */
  retarget(n, info, cap) {
    const walk = (m, inLoop, inSwitch) => {
      if (!m || typeof m !== "object") return;
      if (m.k === "BreakStmt" && !inLoop && !inSwitch && (cap.loop || cap.sw))
        m._jumpLabel = this.outLabel(info, false, cap.region);
      if (m.k === "ContinueStmt" && !inLoop && cap.loop) m._jumpLabel = this.outLabel(info, true, cap.region);
      const loop = inLoop || LOOPS.has(m.k);
      const sw = inSwitch || m.k === "SwitchStmt";
      for (const c of m.c || []) walk(c, loop, sw);
    };
    walk(n, false, !!cap.inSwitch);
  }

  outLabel(info, isContinue, region) {
    for (let i = info.chain.length - 1; i >= 0; i--) {
      const n = info.chain[i];
      if (LOOPS.has(n.k) || (!isContinue && n.k === "SwitchStmt")) {
        const m = this.mark(n);
        if (!m.outName) {
          m.outName = `$out_${region}`;
          m.out.push(`${m.outName}: `);
        }
        return m.outName;
      }
    }
    throw new Unsupported("break/continue with no enclosing target");
  }

  finish() {
    for (const [n, m] of this.marks) {
      m.opens.sort((a, b) => a.order - b.order);
      const pre = m.opens.map((o) => o.text).join("") + m.cases.join("") + m.self.join("") + m.out.join("");
      if (pre) n._pre = pre + (n._pre || "");
      if (m.closes.length || m.selfCloses.length) n._post = (n._post || "") + m.selfCloses.join("") + m.closes.join("");
      if (m.then.size || m.else.size) {
        const T = [...m.then],
          E = [...m.else];
        n._condWrap = !E.length
          ? (c) => `$goto || (${c})`
          : !T.length
            ? (c) => `!$goto && (${c})`
            : (c) => `$goto ? ${T.map((x) => `$goto === "${x}"`).join(" || ")} : (${c})`;
      } else if (m.sw || m.loop) n._condWrap = (c) => `$goto || (${c})`;
      if (m.loop && n.k === "ForStmt") n._initWrap = (t) => (t ? `$goto || (${t})` : "");
    }
  }
}

// ---- setjmp ---------------------------------------------------------------------------------
//
// setjmp returning twice: the statement holding `setjmp(env)` is a label of the function body's
// dispatcher, whose loop body is in a try; a longjmp to the buffer (an exception) is caught,
// its value stored, and the dispatcher re-entered at that statement (through the conditions
// on the way, like a goto into a block):
//   $goto_setjmp: for (;;) { try { switch ($goto) { default: ... case "setjmp": $goto = null;
//       if (($jb = env, $jv)) S; $jv = 0; ...rest... } break; }
//     catch ($e) { $jv = setjmp_caught($e, $jb); $goto = "setjmp"; continue $goto_setjmp; } }
// setjmp_caught returns the longjmp value, or rethrows anything else (also when $jb is still
// null: the setjmp has not run yet).
const SETJMP = new Set(["setjmp", "_setjmp", "sigsetjmp", "__builtin_setjmp"]);

function isCase(n) { return n && (n.k === "CaseStmt" || n.k === "DefaultStmt"); }
