// lib/range.mjs: conservative value ranges of integer expressions.
//
// Used to decide where a C conversion or unsigned operation can change a value (and so needs
// an explicit wrap in JS) and where it provably cannot. Ranges are [lo, hi] Numbers; anything
// not understood gets the full range of its type.

export class Range {
  constructor(T) { this.T = T; }

  full(t) {
    const T = this.T;
    if (!T.isInt(t)) return [-Infinity, Infinity];
    return T.intRange(t);
  }

  of(n) {
    if (!n) return [-Infinity, Infinity];
    const T = this.T;
    if (n.cv !== undefined) { const v = Number(n.cv); return [v, v]; }
    switch (n.k) {
      case "IntegerLiteral": { const v = Number(n.v); return [v, v]; }
      case "CharacterLiteral": return [n.v, n.v];
      case "ParenExpr": return this.of(n.c[0]);
      case "ImplicitCastExpr": case "CStyleCastExpr": {
        const c = n.c[0];
        if (!T.isInt(n.t)) return [-Infinity, Infinity];
        if (n.ck === "LValueToRValue") return this.lvalue(c);
        if (n.ck === "IntegralCast" || n.ck === "NoOp") {
          const r = this.of(c), f = this.full(n.t);
          return r[0] >= f[0] && r[1] <= f[1] ? r : f;
        }
        return this.full(n.t);
      }
      case "UnaryOperator": {
        const [lo, hi] = this.of(n.c[0]);
        if (n.op === "!") return [0, 1];
        if (n.op === "-") return [-hi, -lo];
        if (n.op === "+") return [lo, hi];
        if (n.op === "~") return T.signed(n.t) ? [-hi - 1, -lo - 1] : this.full(n.t);
        return this.full(n.t);
      }
      case "BinaryOperator": return this.binop(n);
      case "ConditionalOperator": {
        const a = this.of(n.c[1]), b = this.of(n.c[2]);
        return [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
      }
      default: return this.full(n.t);
    }
  }

  lvalue(n) {
    const T = this.T;
    if (n.k === "MemberExpr" && n.bits !== undefined) {
      const signed = T.signed(n.t);
      return signed ? [-(2 ** (n.bits - 1)), 2 ** (n.bits - 1) - 1] : [0, 2 ** n.bits - 1];
    }
    if (n.k === "ParenExpr") return this.lvalue(n.c[0]);
    return this.full(n.t);
  }

  binop(n) {
    const op = n.op, [a, b] = n.c;
    if (["==", "!=", "<", ">", "<=", ">=", "&&", "||"].includes(op)) return [0, 1];
    if (op === "," || op === "=") return this.of(b);
    if (op === "-" && this.T.isPtr(a.t) && this.T.isPtr(b.t)) return this.full(n.t);
    const [al, ah] = this.of(a), [bl, bh] = this.of(b);
    switch (op) {
      case "+": return [al + bl, ah + bh];
      case "-": return [al - bh, ah - bl];
      case "*": {
        const p = [al * bl, al * bh, ah * bl, ah * bh].map((x) => (Number.isNaN(x) ? 0 : x));
        return [Math.min(...p), Math.max(...p)];
      }
      case "/": {
        if (bl > 0 || bh < 0) { const m = Math.max(Math.abs(al), Math.abs(ah)); return al >= 0 ? [0, m] : [-m, m]; }
        return this.full(n.t);
      }
      case "%": {
        if (bl === bh && bl !== 0) { const m = Math.abs(bl) - 1; return al >= 0 ? [0, m] : [-m, m]; }
        if (bl > 0) { const m = bh - 1; return al >= 0 ? [0, m] : [-m, m]; }
        return this.full(n.t);
      }
      case "&": {
        if (al >= 0 && bl >= 0) return [0, Math.min(ah, bh)];
        if (al >= 0) return [0, ah];
        if (bl >= 0) return [0, bh];
        return this.full(n.t);
      }
      case "|": case "^": {
        if (al >= 0 && bl >= 0 && ah < 2 ** 52 && bh < 2 ** 52)
          return [0, 2 ** Math.ceil(Math.log2(Math.max(ah, bh) + 1)) - 1];
        return this.full(n.t);
      }
      case "<<": {
        if (al >= 0 && bl >= 0 && bh < 52) return [al * 2 ** bl, ah * 2 ** bh];
        return this.full(n.t);
      }
      case ">>": {
        if (al >= 0 && bl >= 0) return [Math.floor(al / 2 ** bh), Math.floor(ah / 2 ** bl)];
        return this.full(n.t);
      }
      default: return this.full(n.t);
    }
  }
}
