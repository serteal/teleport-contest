// rt/fnptr.js: function pointers.
//
// In the heap a function pointer is an index into the function table (as in C compiled for
// wasm32). In JS it is the function itself: reading a function pointer gives the canonical JS
// function for that index, so `if (occupation == eatfood)` and `(*occupation)()` read like the C.
//
// The host installs the table backend (host/boot.js: the vendored C library's function table, so
// the Lua VM can call game functions); without one, a plain array grows as JS functions have
// their address taken.

let backend = {
  // index -> JS callable (or null)
  get(i) { return table[i] ?? fn_sentinel(i); },
  // JS callable -> index
  index(f) {
    let i = table.indexOf(f);
    if (i < 0) { i = table.length; table.push(f); }
    return i;
  },
};
const table = [null]; // the default backend

/** Install the function-table backend (host/boot.js). */
export function set_fn_backend(b) { backend = b; }

// A function-pointer value that is not a function: SIG_IGN / SIG_ERR ((void (*)(int)) 1, -1) and
// other integer casts. It is a canonical JS function per value (== compares like C) that throws if
// called, and converts back to the same integer.
const sentinels = new Map();
/** The canonical JS value of the non-function function pointer i. */
export function fn_sentinel(i) {
  i >>>= 0;
  let f = sentinels.get(i);
  if (!f) {
    f = function () { throw new Error(`rt: call through the non-function pointer ${i | 0}`); };
    f.fnIndex = i;
    sentinels.set(i, f);
  }
  return f;
}

/** Function stored at table index i (null for 0). */
export function fn_from_index(i, sig) { return i === 0 ? null : backend.get(i, sig); }

/** Table index of function f (0 for null). */
export function fn_index(f) { return f == null ? 0 : f.fnIndex !== undefined ? f.fnIndex : backend.index(f); }
