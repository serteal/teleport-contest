// rt/globals.js: global scalars (`uwep`, `multi`, ...).
//
// A C global scalar lives in the heap like everything else. In JS it is an accessor property of
// globalThis named like the C variable, so code reads and assigns it exactly as in C
// (`uwep = obj;`, `if (uwep)`). The defining module declares it once with global_scalar().

import { cell, pointerReader, addr, type_of } from "./struct.js";
import * as heap from "./heap.js";
const resolve_kind = (t) => type_of(t).kind;
import { global_addr, init_owned } from "./locals.js";

const refs = new Map();

/**
 * Declare the global scalar `name` of type t (defined by the C file of the calling module), with
 * its C initial value: written when the runtime owns the object (rt/locals.js), and again for
 * every new memory image.
 */
export function global_scalar(name, t, init) {
  const a = global_addr(name, t.size, t.align);
  const r = refs.get(name) || cell(t, a);
  if (init !== undefined) init_owned(a, () => { r[0] = init; });
  refs.set(name, r);
  // direct typed-array access for the common kinds: `r[0]` is an element accessor, which V8 runs
  // ~40x slower than a named getter (measured: 85 ns vs 2 ns per read)
  const k = resolve_kind(t), a2 = a >> 2;
  const desc = k === "i32" ? { get() { return heap.i32[a2]; }, set(v) { heap.i32[a2] = v; } }
    : k === "u32" ? { get() { return heap.u32[a2]; }, set(v) { heap.u32[a2] = v; } }
    : k === "i8" ? { get() { return heap.chars[a]; }, set(v) { heap.chars[a] = v; } }
    : k === "u8" ? { get() { return heap.uchars[a]; }, set(v) { heap.uchars[a] = v; } }
    : k === "ptr" ? (() => { const rd = pointerReader(t); return { get() { return rd(heap.u32[a2]); }, set(v) { heap.u32[a2] = addr(v); } }; })()
    : { get() { return r[0]; }, set(v) { r[0] = v; } };
  Object.defineProperty(globalThis, name, { ...desc, configurable: true });
  return r;
}

/**
 * &name for a global scalar. Module order is not guaranteed (a table in worn.c holds &uarm before
 * decl.js runs), so with its type t the cell is created here; global_scalar then reuses it.
 */
export function global_ref(name, t) {
  let r = refs.get(name);
  if (!r) {
    if (!t) throw new Error("rt: global scalar not declared: " + name);
    r = cell(t, global_addr(name, t.size, t.align));
    refs.set(name, r);
  }
  return r;
}
