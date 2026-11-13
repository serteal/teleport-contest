// lib/types.mjs: classify front-end types into JS representations.
//
// Representations:
//   num   integers, floats, enums, _Bool (JS Number; comparisons may yield JS booleans)
//   addr  char / unsigned char / void pointers and arrays of 1-byte scalars (heap address)
//   view  struct/union pointers and struct values (canonical view object or null)
//   ref   pointers to other scalars and to pointers (typed array or element proxy, or null)
//   fn    function pointers (the JS function or null)
//   list  arrays of structs or of arrays (JS Array of views / of rows)

export class Types {
  constructor(types) { this.t = types; }
  get(id) { return this.t[id]; }
  kind(id) { return this.t[id].k; }
  isInt(id) { const k = this.t[id].k; return k === "int" || k === "bool"; }
  isFloat(id) { return this.t[id].k === "flt"; }
  isPtr(id) { return this.t[id].k === "ptr"; }
  isArr(id) { return this.t[id].k === "arr"; }
  isRec(id) { return this.t[id].k === "rec"; }
  isVoid(id) { return this.t[id].k === "void"; }
  pointee(id) { return this.t[id].to; }
  elem(id) { return this.t[id].of; }
  size(id) {
    const t = this.t[id];
    if (t.k === "ptr" || t.k === "fn") return 4;
    return t.size ?? 0;
  }
  signed(id) { return !!this.t[id].signed; }
  is64(id) { return this.isInt(id) && this.size(id) === 8; }
  isUnsigned32(id) { return this.isInt(id) && !this.signed(id) && this.size(id) === 4 && this.t[id].k !== "bool"; }
  isFnPtr(id) { return this.isPtr(id) && this.kind(this.pointee(id)) === "fn"; }
  isByte(id) { const t = this.t[id]; return (t.k === "int" || t.k === "bool") && t.size === 1; }

  /** Representation of a value of type id (arrays: their decayed value). */
  repr(id) {
    const t = this.t[id];
    switch (t.k) {
      case "int": case "bool": case "flt": return "num";
      case "rec": return "view";
      case "fn": return "fn";
      case "ptr": {
        const p = this.t[t.to];
        if (p.k === "rec") return "view";
        if (p.k === "fn") return "fn";
        if (p.k === "void" || ((p.k === "int" || p.k === "bool") && p.size === 1)) return "addr";
        return "ref";
      }
      case "arr": {
        const e = this.t[t.of];
        if (e.k === "rec" || e.k === "arr") return "list";
        if ((e.k === "int" || e.k === "bool") && e.size === 1) return "addr";
        return "ref";
      }
      default: return "other";
    }
  }

  /** [lo, hi] of an integer type. */
  intRange(id) {
    const t = this.t[id];
    if (t.k === "bool") return [0, 1];
    const bits = (t.size || 4) * 8;
    if (t.signed) return [-(2 ** (bits - 1)), 2 ** (bits - 1) - 1];
    return [0, 2 ** bits - 1];
  }

  /** rt/ctypes conversion-function name for an integer type ("int", "uchar", "long", ...). */
  convName(id) {
    const t = this.t[id];
    if (t.k === "bool") return "bool";
    if (t.big) return t.signed ? "i64" : "u64";
    if (t.k === "flt") return t.size === 4 ? "float" : "double";
    const s = t.s.replace(/^(const|volatile) /g, "");
    if (s === "char") return "char";
    const sz = t.size, sg = t.signed;
    if (sz === 1) return sg ? "schar" : "uchar";
    if (sz === 2) return sg ? "short" : "ushort";
    if (sz === 4) return sg ? "int" : "unsigned";
    return sg ? "long" : "ulong";
  }

  /** rt type descriptor name of a scalar type (layouts, stack_var, refs): BigInt types by name. */
  typeName(id) {
    const t = this.t[id];
    if (t.big) return t.signed ? "int64_t" : "uint64_t";
    return this.convName(id);
  }

  /** Name of the record (struct/union) of a record type or pointer-to-record type. */
  recName(id) {
    let t = this.t[id];
    if (t.k === "ptr") t = this.t[t.to];
    if (t.k === "arr") t = this.t[t.of];
    return t.k === "rec" ? t.rec : null;
  }
}
