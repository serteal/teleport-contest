// rt/checked.js: assertions of the checked build.
//
// The checked build of the emitted code wraps every place where the rewriter relied on a value
// range instead of emitting a wrap (signed narrowing, 64-bit bit operations used as truth
// values, ...). Running the sessions with it finds the places where that assumption is wrong.

export const failures = new Map();
/** up to 4 distinct offending values per failing site (for reports) */
export const samples = new Map();

function fail(kind, v, site) {
  const k = site ? `${kind} ${site}` : `${kind}`;
  failures.set(k, (failures.get(k) || 0) + 1);
  let s = samples.get(k);
  if (!s) samples.set(k, (s = []));
  if (s.length < 4 && !s.includes(String(v))) s.push(String(v));
  if (globalThis.process?.env?.NH_CHECKED_THROW) throw new Error(`checked: ${kind} ${v}`);
}

export const chk = {
  /** value v must lie in [lo, hi] (a narrowing the rewriter assumed exact) */
  fits(v, lo, hi, site) { if (!(v >= lo && v <= hi)) fail(`fits[${lo},${hi}]`, v, site); return v; },
  /** a 64-bit & used for its truth value: operands must fit in 32 bits */
  bool64(r, a, b, site) {
    if (!(a >= -2147483648 && a < 4294967296 && b >= -2147483648 && b < 4294967296)) fail("bool64", `${a},${b}`, site);
    return r;
  },
  /** an int32 result that JS computed exactly */
  i32(v, site) { if (!(v >= -2147483648 && v <= 2147483647)) fail("i32", v, site); return v; },
  /** a[i] of an array of structs emitted as a plain index: i must be in [0, a.length) (where it
      is not, C reads the memory there and the subscript form needs elt()) */
  idx(a, i, site) { if (!(i >= 0 && i < a.length)) fail("idx", i, site); return a[i]; },
  /** a 64-bit integer that must stay exact as a double */
  i53(v, site) { if (!Number.isSafeInteger(v)) fail("i53", v, site); return v; },
};
