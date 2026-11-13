// rt/locals.js: C objects that must live in memory.
//
// A local whose address is taken (`foo(&x)`), a local array (`char buf[BUFSZ]`) or a local
// struct (`coord cc`) is allocated in the current stack frame, so compiled code and JS see the
// same bytes. A function with such locals opens a frame on its first line and closes it on
// its last:   { const $frame = stack_frame(); try { ... } finally { stack_pop($frame); } }
//
// Representations (same as for pointers, see rt/struct.js):
//   stack_var(int)        an Int32Array of length 1: read and write it as x[0]; `&x` is x
//   stack_array(char, n)  an address (char arrays are strings)
//   stack_array(int, n)   an Int32Array of length n
//   stack_struct(coord)   a view
// Static locals and file-scope data use static_var/static_array/static_struct with the same
// representations, resolved once by name (they are global objects).

import { stack_alloc, arena_alloc, machine, uchars, on_attach, rt_journal, heap_is_stable } from "./heap.js";
import * as heapNS from "./heap.js";
import { ref, view, decay, array, writeAt, cell, cell_array, addr, type_of, offsetof, when_declared } from "./struct.js";

function sizeOf(t) { return t.size; }

/** Address-taken scalar local (optionally initialised): use as x[0]. */
export function stack_var(t, init) {
  const a = stack_alloc(sizeOf(t), t.align);
  const r = ref(t, a, 1);
  if (init !== undefined) r[0] = init;
  return r;
}

/**
 * Local array T[n] (zeroed); with `init` (a positional initializer list, nested for rows and
 * structs) it is filled like `T a[] = {...}`, and n may be null (the extent is init.length).
 */
export function stack_array(t, n, init) {
  if (n == null) {
    if (!init) throw new Error("rt: stack_array without an extent or an initializer");
    n = init.length;
  }
  const at = array(t, n);
  const a = stack_alloc(at.size, at.align);
  const v = decay(at, a);
  if (init) fill(v, init);
  return v;
}

/** Local struct value. */
export function stack_struct(cls) {
  const a = stack_alloc(cls.size, cls.align);
  return view(cls, a);
}

// ---- statics ----------------------------------------------------------------------------
//
// A static resolves to an existing object of the memory image when the host can name one
// (machine.symbol), else it is allocated once in the arena and *owned* by the runtime: its
// initializer is written here, and written again whenever a new memory image is attached
// (a fresh C image has its .data initialised). The game's host names none, so every static is
// runtime-owned there; ownership is still tracked per object.

const statics = new Map();   // key -> address
const sizes = new Map();     // key -> byte size (for static_sizeof)
const owned = new Map();     // address -> re-initialiser (or null: zero-initialised)

function staticAddr(key, size, align) {
  let a = statics.get(key);
  if (a === undefined) {
    a = machine.symbol ? machine.symbol(key) : 0;
    if (!a) {
      a = arena_alloc(Math.max(size, 1), align);
      uchars.fill(0, a, a + size);
      owned.set(a, null);
      rt_journal(() => owned.delete(a));
    }
    statics.set(key, a);
    sizes.set(key, size);
    rt_journal(() => { statics.delete(key); sizes.delete(key); });
  }
  return a;
}

/**
 * sizeof of a static/global whose extent is implicit (`static const char wrpsym[] = {...}`; a
 * char array is an address in JS and does not know its length): its byte size, from
 * machine.symbolSize when the host knows the object, else the size the runtime allocated.
 */
export function static_sizeof(key) {
  const n = machine.symbolSize ? machine.symbolSize(key) : 0;
  if (n) return n;
  if (sizes.has(key)) return sizes.get(key);
  throw new Error(`rt: static_sizeof(${key}): not declared`);
}

const boundStatics = [];
function heapBoundRows(at) {
  let of = at.of;
  while (of && of.kind === "array") { const inner = of.of; if (inner.kind !== "array") return !(inner.kind === "record" || (inner.scalar && inner.size === 1)) && typeof inner !== "string"; of = inner; }
  return false;
}
function rebindRows(v, at, a) {
  const of = at.of;
  for (let i = 0; i < v.length; i++) {
    const r = decay(of, a + i * of.size);
    if (Array.isArray(r)) rebindRows(v[i], of, a + i * of.size); else v[i] = r;
  }
}
on_attach(() => { for (const [v, at, a] of boundStatics) rebindRows(v, at, a); });

on_attach(({ grown }) => {
  if (grown) return;
  for (const [a, reinit] of owned) if (reinit) reinit(); // new image: arena bytes are zero again
});

/** Run (and remember for new memory images) the initialiser w of the runtime-owned object at a. */
export function init_owned(a, w) {
  if (!owned.has(a) || owned.get(a)) return;
  w();
  setInit(a, w);
}
function setInit(a, w) { owned.set(a, w); rt_journal(() => { if (owned.has(a)) owned.set(a, null); }); }

/**
 * What rt allocated and owns: [{ key, addr, size }] for every static and global it created, in
 * allocation order (for tests and diagnostics).
 */
export function static_entries() {
  const out = [];
  for (const [key, a] of statics) if (owned.has(a)) out.push({ key, addr: a, size: sizes.get(key) });
  return out;
}

/** Is the static at address a owned by the runtime (not found through machine.symbol)? */
export function is_owned_static(a) { return owned.has(typeof a === "number" ? a : addr(a)); }

// on a stable heap: a length-1 typed array for integer/float kinds (pointers keep their cell: they
// read as views)
function fastCell(t, a) {
  const T = type_of(t), B = heapNS.buffer;
  switch (T.kind) {
    case "i32": return new Int32Array(B, a, 1);
    case "u32": return new Uint32Array(B, a, 1);
    case "i16": return new Int16Array(B, a, 1);
    case "u16": return new Uint16Array(B, a, 1);
    case "i8": return new Int8Array(B, a, 1);
    case "u8": return new Uint8Array(B, a, 1);
    case "f64": return (a & 7) ? cell(t, a) : new Float64Array(B, a, 1);
    default: return cell(t, a);
  }
}

/** Static scalar (file scope or `static` local) named key ("fn.var" for locals): use as x[0]. */
export function static_var(key, t, init) {
  let r = staticValues.get(key);
  if (r !== undefined) return r;
  const a = staticAddr(key, sizeOf(t), t.align);
  r = heap_is_stable() ? fastCell(t, a) : cell(t, a);
  if (init !== undefined && owned.has(a)) {
    const w = () => writeAt(t, a, init);
    w();
    setInit(a, w);
  }
  staticValues.set(key, r);
  rt_journal(() => staticValues.delete(key));
  return r;
}

const staticValues = new Map();

/** Static array (n may be null: the extent comes from the initializer or the symbol). */
export function static_array(key, t, n, init) {
  let v = staticValues.get(key);
  if (v === undefined) {
    if (n == null) n = init ? init.length : machine.symbolSize ? machine.symbolSize(key) / t.size : 0;
    if (!n) throw new Error(`rt: static array ${key} has no extent`);
    const at = array(t, n);
    const a = staticAddr(key, at.size, at.align);
    // scalar elements: a heap-independent element view (a typed array would pin one buffer)
    const el = typeof t === "string" ? null : t;
    v = el && el.kind !== "record" && el.kind !== "array" && !(el.scalar && el.size === 1) ? cell_array(t, a, n) : decay(at, a);
    // rows of an array of scalar arrays are typed arrays over one buffer: rebuild them in place
    // (the outer Array keeps its identity) whenever the buffer changes
    if (Array.isArray(v) && heapBoundRows(at)) boundStatics.push([v, at, a]);
    if (init !== undefined && owned.has(a)) {
      const arr = v, w = () => fill(arr, init);
      w();
      setInit(a, w);
    }
    staticValues.set(key, v);
    rt_journal(() => staticValues.delete(key));
  }
  return v;
}

/** Static struct (init: a positional initializer list, written only if the runtime owns it). */
export function static_struct(key, cls, init) {
  const a = staticAddr(key, cls.size, cls.align);
  const v = view(cls, a);
  if (init !== undefined && owned.has(a) && !owned.get(a)) {
    const w = () => fill(v, init);
    w();
    setInit(a, w);
  }
  return v;
}

/** Address of a global of `size` bytes by its C name (extern data defined in another C file). */
export function global_addr(name, size = 4, align = 4) { return staticAddr(name, size, align); }

// ---- initializers ------------------------------------------------------------------------

/** Fill a memory-resident array/struct from a positional initializer list; returns it. */
// once=true marks the initializer of a static: it runs only for a runtime-owned static (an
// object found through machine.symbol already holds its data), and is re-applied when a new
// memory image is attached.
export function init_list(obj, values, once) {
  if (!once) { fill(obj, values); return obj; }
  const a = addr(obj);
  if (!owned.has(a) || owned.get(a)) return obj;
  const w = () => fill(obj, values);
  w();
  setInit(a, w);
  return obj;
}

/**
 * Fill memory-resident obj from a C initializer: positional lists `[...]` for arrays (and
 * structs), named-field objects `{ field: value }` for structs and unions
 * (fields not named stay zero; an unknown name throws), a JS string for a char array (bytes,
 * NUL, rest zero). t: obj's type when obj is an address (char arrays) or a typed array.
 */
function fill(obj, values, t) {
  if (typeof obj === "number") { // char/uchar/boolean array (an address)
    const n = t && t.kind === "array" ? t.n : Infinity;
    if (typeof values === "string") {
      if (values.length > n) throw new Error(`rt: string initializer longer than char[${n}]`);
      for (let i = 0; i < values.length; i++) uchars[obj + i] = values.charCodeAt(i);
      if (values.length < n) uchars[obj + values.length] = 0;
      return;
    }
    values.forEach((v, i) => { uchars[obj + i] = v; });
    return;
  }
  if (Array.isArray(obj)) {
    const et = obj._t ? obj._t.of : null;
    values.forEach((v, i) => { if (v !== null && typeof v === "object" && !isValue(v) || typeof v === "string") fill(obj[i], v, et && type_of(et)); else obj[i] = v; });
    return;
  }
  if (ArrayBuffer.isView(obj) || obj.get) { values.forEach((v, i) => { obj[i] = v; }); return; }
  const cls = obj.constructor;
  if (!Object.keys(cls.fields).length) { when_declared(cls, () => fill(obj, values, t)); return; } // header not evaluated yet
  if (Array.isArray(values)) { // positional struct initializer
    const names = Object.keys(cls.fields);
    values.forEach((v, i) => setField(obj, cls, names[i], v));
    return;
  }
  for (const k of Object.keys(values)) {
    if (!(k in cls.fields)) throw new Error(`rt: ${cls.name} has no field ${k} (initializer)`);
    setField(obj, cls, k, values[k]);
  }
}
// a value assigned as is (a view: struct copy; a typed ref / proxy: a pointer value)
function isValue(v) { return v._a !== undefined && !Array.isArray(v) || ArrayBuffer.isView(v) || typeof v.get === "function"; }
function setField(obj, cls, k, v) {
  if (v !== null && typeof v === "object" && !isValue(v) || typeof v === "string") {
    offsetof(cls, k); // lays the record out
    fill(obj[k], v, type_of(cls.info[k].t));
  } else obj[k] = v;
}

/** char buf[N] = "text": copy the literal (address s) into the array at address a. */
export function init_string(a, s, once) {
  if (a === null || typeof a !== "number") throw new Error("rt: init_string needs an array address");
  const bytes = [];
  for (let i = 0; uchars[s + i]; i++) bytes.push(uchars[s + i]);
  const copy = () => { for (let i = 0; i < bytes.length; i++) uchars[a + i] = bytes[i]; uchars[a + bytes.length] = 0; };
  if (!once) { copy(); return a; }
  if (!owned.has(a) || owned.get(a)) return a;
  copy();
  setInit(a, copy);
  return a;
}
