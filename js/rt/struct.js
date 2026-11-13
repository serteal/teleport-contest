// rt/struct.js: struct/union layouts and typed views over the heap.
//
// A struct is declared in its header module like the C header, one field per line:
//
//     export const coord = struct("coord", {
//         x: coordxy,
//         y: coordxy,
//     });
//
// Offsets, sizes and bitfield positions are computed here, at load time, with the wasm32 C
// layout rules (natural alignment, Itanium bitfield packing), so no position-derived number is
// written anywhere in js/. check_layouts compares them with the compiler's (tools/nh2js/layouts.mjs).
//
// A pointer to a struct is a *view*: an object of the struct's class whose fields are
// accessors over the heap (`mtmp.data.mlet`). Views are canonical per (struct, address), so C
// pointer equality is JS `==`, and the null pointer is `null`.

import { u32, chars, uchars, i16, u16, i32, f32, f64, load_i64, load_u64, store_i64, load_u64n, load_i64n, store_64n, memcpy, stack_alloc, epoch } from "./heap.js";
import * as heap from "./heap.js";
import { fn_from_index, fn_index } from "./fnptr.js";

const records = new Map();

// ---- type descriptors -------------------------------------------------------------------

/** `void`, for `void *` (a plain address, like `char *`). */
export const void_t = { kind: "void", size: 1, align: 1 };

/** Pointer to T (T: a type descriptor or a struct name). */
export function ptr(to) { return { kind: "ptr", to, size: 4, align: 4 }; }

/** Array of n T (n: a load-time expression from the header, e.g. PL_NSIZ). */
export function array(of, n) {
  // one descriptor per (element type, extent): emitted code builds `array_of(char, BUFSZ)` on
  // every call of a function with a local array
  let m = arrays.get(of);
  if (!m) arrays.set(of, (m = new Map()));
  let d = m.get(n);
  if (!d) m.set(n, (d = new ArrayType(of, n)));
  return d;
}
// one class for every array descriptor (monomorphic `t.size` in decay/stack_array); the element
// type may be a record laid out later, so size/align are computed on first use
class ArrayType {
  constructor(of, n) { this.kind = "array"; this.of = of; this.n = n; this._size = -1; this._align = -1; }
  get size() {
    const s = this._size;
    if (s >= 0) return s;
    const z = this.n * resolve(this.of).size;
    if (z > 0) this._size = z; // 0: an opaque record that may still get its members
    return z;
  }
  get align() { const s = this._align; return s >= 0 ? s : (this._align = resolve(this.of).align); }
}
const arrays = new Map();

/** Bit-field of an integer type: `unsigned mpeaceful : 1` is bits(unsigned, 1). */
export function bits(of, width) { return { kind: "bits", of, width }; }

/** NetHack's Bitfield(x, n) macro: an unsigned bit-field. */
export function Bitfield(width) { return { kind: "bits", of: UNSIGNED, width }; }
const UNSIGNED = { kind: "u32", size: 4, align: 4, scalar: true };

/** Pointer to a function (the signature is kept for calls through compiled code). */
export function fnptr(ret, ...params) { return { kind: "fnptr", ret, params, size: 4, align: 4 }; }

function resolve(t) {
  if (typeof t === "string") {
    // a struct never declared in JS (opaque to the game code) still gets canonical views
    return records.get(t) || record(t, {}, false);
  }
  return t;
}

/**
 * Declare a struct. Returns its view class (also the type descriptor). Declaring a name again
 * returns the existing class (a block-scope struct is declared each time its function runs; its
 * name is qualified with the function, so one name is one C type); a record first seen as opaque
 * (named by a pointer type before its declaration) gets its fields.
 */
export function struct(name, fields) { return declare(name, fields, false); }

/** Declare a union. */
export function union(name, fields) { return declare(name, fields, true); }

function declare(name, fields, isUnion) {
  const old = records.get(name);
  if (!old) return record(name, fields, isUnion);
  const a = Object.keys(old.fields), b = Object.keys(fields);
  if (!a.length && b.length) {
    if (old.laidOut && old.pagesUsed) throw new Error(`rt: ${name} declared after views of it (as an opaque record) were made`);
    old.fields = fields; old.isUnion = isUnion; old.laidOut = false; old.pages = null;
    Object.defineProperty(old, "size", { get() { layout(old); return old._size; }, configurable: true });
    Object.defineProperty(old, "align", { get() { layout(old); return old._align; }, configurable: true });
    const pending = old.pending || [];
    old.pending = null;
    for (const f of pending) f();
    return old;
  }
  if (a.length !== b.length || a.some((k, i) => k !== b[i]) || old.isUnion !== isUnion) throw new Error(`rt: ${name} declared twice with different members`);
  return old;
}

function record(name, fields, isUnion) {
  class View {
    // _m: the member caches of the record and array fields (see accessor)
    constructor(a) { this._a = a; this._m = View.members > 0 ? new Array(View.members).fill(undefined) : null; }
    valueOf() { return this._a; }
  }
  Object.defineProperty(View, "name", { value: name });
  View.kind = "record";
  View.isUnion = isUnion;
  View.fields = fields;
  View.pages = null;
  View.shift = 0;
  View.laidOut = false;
  View.members = 0;
  Object.defineProperty(View, "size", { get() { layout(View); return fix(View, "size", View._size); }, configurable: true });
  Object.defineProperty(View, "align", { get() { layout(View); return fix(View, "align", View._align); }, configurable: true });
  records.set(name, View);
  return View;
}

// replace a lazy getter by the computed value (once laid out, sizes never change)
function fix(cls, k, v) { if (cls.laidOut && v !== undefined) Object.defineProperty(cls, k, { value: v, configurable: true }); return v; }

// ---- views ------------------------------------------------------------------------------

/** Canonical view of the struct `cls` at address `a` (null for address 0). */
export function view(cls, a) {
  if (a === 0) return null;
  let pages = cls.pages;
  if (pages === null) { layout(cls); pages = cls.pages; }
  const pg = a >>> 16;
  let page = pages[pg];
  if (page === undefined) { page = pages[pg] = new Array(65536 >>> cls.shift).fill(undefined); cls.pagesUsed = true; }
  const i = (a & 65535) >>> cls.shift;
  let v = page[i];
  if (v === undefined) { v = new cls(a); page[i] = v; }
  return v;
}

/** Address of anything pointer-like: views, typed refs, numbers; null is 0. */
export function addr(p) {
  if (p === null || p === undefined) return 0;
  if (typeof p === "number") return p;
  if (p._a !== undefined) return p._a;
  if (p.byteOffset !== undefined) return p.byteOffset;
  throw new Error("rt: not a pointer");
}

/** Struct assignment `*dst = *src` (also `a = b` for struct values). */
export function assign(dst, src) { memcpy(dst._a, src._a, dst.constructor.size); return dst; }

/** p + n for a struct pointer. */
export function ptr_add(p, n) { return view(p.constructor, p._a + n * p.constructor.size); }

/** p - q for struct pointers (element count). */
export function ptr_diff(p, q) { return (p._a - q._a) / p.constructor.size; }

/** offsetof(struct, field). */
export function offsetof(cls, field) { layout(cls); return cls.offsets[field]; }

// ---- layout (wasm32 C rules) -------------------------------------------------------------

function sizeAlign(t) {
  t = resolve(t);
  if (t.kind === "record") { layout(t); return [t._size, t._align]; }
  return [t.size, t.align];
}

function layout(cls) {
  if (cls.laidOut) return;
  cls.laidOut = true;
  const offsets = {}, info = {};
  let bit = 0, maxAlign = 1, size = 0;
  for (const [name, t0] of Object.entries(cls.fields)) {
    const t = typeof t0 === "string" ? resolve(t0) : t0;
    if (t.kind === "bits") {
      const [usz, ual] = sizeAlign(t.of);
      const ubits = usz * 8;
      let at = cls.isUnion ? 0 : bit;
      if (t.width === 0) { bit = Math.ceil(at / (ual * 8)) * ual * 8; continue; }
      if (Math.floor(at / ubits) !== Math.floor((at + t.width - 1) / ubits)) at = Math.ceil(at / ubits) * ubits;
      offsets[name] = at >> 3;
      info[name] = { t, bitoff: at, unit: Math.floor(at / ubits) * usz, shift: at % ubits, usz };
      maxAlign = Math.max(maxAlign, ual);
      if (cls.isUnion) size = Math.max(size, Math.ceil(t.width / 8));
      else bit = at + t.width;
      continue;
    }
    const [fs, fa] = sizeAlign(t);
    maxAlign = Math.max(maxAlign, fa);
    if (cls.isUnion) { offsets[name] = 0; size = Math.max(size, fs); info[name] = { t, off: 0 }; continue; }
    let off = Math.ceil(bit / 8);
    off = Math.ceil(off / fa) * fa;
    offsets[name] = off;
    info[name] = { t, off };
    bit = (off + fs) * 8;
  }
  if (!cls.isUnion) size = Math.ceil(bit / 8);
  size = Math.ceil(size / maxAlign) * maxAlign;
  cls._size = size;
  cls._align = maxAlign;
  // from now on plain data properties (no getter call per `cls.size` in ptr_add, decay, ...)
  Object.defineProperty(cls, "size", { value: size, configurable: true });
  Object.defineProperty(cls, "align", { value: maxAlign, configurable: true });
  cls.offsets = offsets;
  cls.info = info;
  cls.shift = Math.min(3, Math.log2(maxAlign) | 0);
  cls.pages = new Array(65536).fill(undefined);
  cls.members = 0;
  for (const [name, f] of Object.entries(info)) defineField(cls, name, f);
}

function defineField(cls, name, f) {
  const desc = accessor(f.t, f.off, f, name, cls);
  Object.defineProperty(cls.prototype, name, desc);
}

// getter/setter pair for a field of type t at offset o (or a bit-field described by f)
function accessor(t, o, f, name, owner) {
  if (t.kind === "bits") {
    const w = t.width, sh = f.shift, u = f.unit, signed = /^i/.test(resolve(t.of).kind);
    const mask = w === 32 ? 0xffffffff : (1 << w) - 1;
    if (f.usz === 4) {
      return {
        get() { const x = u32[(this._a + u) >> 2] >>> sh; return signed ? (x << (32 - w)) >> (32 - w) : (x & mask) >>> 0; },
        set(v) { const k = (this._a + u) >> 2; u32[k] = (u32[k] & ~(mask << sh)) | ((v & mask) << sh); },
      };
    }
    if (f.usz === 2) {
      return {
        get() { const x = u16[(this._a + u) >> 1] >>> sh; return signed ? (x << (32 - w)) >> (32 - w) : x & mask; },
        set(v) { const k = (this._a + u) >> 1; u16[k] = (u16[k] & ~(mask << sh)) | ((v & mask) << sh); },
      };
    }
    return {
      get() { const x = uchars[this._a + u] >>> sh; return signed ? (x << (32 - w)) >> (32 - w) : x & mask; },
      set(v) { const k = this._a + u; uchars[k] = (uchars[k] & ~(mask << sh)) | ((v & mask) << sh); },
    };
  }
  t = resolve(t);
  switch (t.kind) {
    case "i8": return { get() { return chars[this._a + o]; }, set(v) { chars[this._a + o] = v; } };
    case "u8": return { get() { return uchars[this._a + o]; }, set(v) { uchars[this._a + o] = v; } };
    case "bool": return { get() { return uchars[this._a + o]; }, set(v) { uchars[this._a + o] = v ? 1 : 0; } };
    case "i16": return { get() { return i16[(this._a + o) >> 1]; }, set(v) { i16[(this._a + o) >> 1] = v; } };
    case "u16": return { get() { return u16[(this._a + o) >> 1]; }, set(v) { u16[(this._a + o) >> 1] = v; } };
    case "i32": return { get() { return i32[(this._a + o) >> 2]; }, set(v) { i32[(this._a + o) >> 2] = v; } };
    case "u32": return { get() { return u32[(this._a + o) >> 2]; }, set(v) { u32[(this._a + o) >> 2] = v; } };
    case "i64": return { get() { return load_i64(this._a + o); }, set(v) { store_i64(this._a + o, v); } };
    case "u64": return { get() { return load_u64(this._a + o); }, set(v) { store_i64(this._a + o, v); } };
    case "u64n": return { get() { return load_u64n(this._a + o); }, set(v) { store_64n(this._a + o, v); } };
    case "i64n": return { get() { return load_i64n(this._a + o); }, set(v) { store_64n(this._a + o, v); } };
    case "f32": return { get() { return f32[(this._a + o) >> 2]; }, set(v) { f32[(this._a + o) >> 2] = v; } };
    case "f64": return { get() { return f64[(this._a + o) >> 3]; }, set(v) { f64[(this._a + o) >> 3] = v; } };
    case "ptr": {
      const rd = pointerReader(t);
      return { get() { return rd(u32[(this._a + o) >> 2]); }, set(v) { u32[(this._a + o) >> 2] = addr(v); } };
    }
    case "fnptr":
      return { get() { return fn_from_index(u32[(this._a + o) >> 2], t); }, set(v) { u32[(this._a + o) >> 2] = fn_index(v); } };
    case "record": {
      // a member struct's view is canonical and its address never changes: kept on the parent
      // view after the first access (`svl.level.objects`, `otmp.v.v_nexthere` in hot loops), in
      // slot k of its member caches (an array made with the view, so that every view of a struct
      // has the same shape whichever members are read first)
      const cls = t, k = owner.members++;
      return {
        get() { const m = this._m; let v = m[k]; if (v === undefined) v = m[k] = view(cls, this._a + o); return v; },
        set(v) { memcpy(this._a + o, v._a, cls.size); },
      };
    }
    case "array": {
      // decayed arrays are cached on the (canonical) view, in slot k; typed arrays are tied to one
      // heap (slot k + 1: the heap epoch they were made for)
      const live = arrayIsHeapBound(t), k = owner.members;
      owner.members += live ? 2 : 1;
      return {
        get() {
          const m = this._m;
          let a = m[k];
          if (a === undefined || (live && m[k + 1] !== heap.epoch)) {
            a = m[k] = decay(t, this._a + o);
            if (live) m[k + 1] = heap.epoch;
          }
          return a;
        },
      };
    }
    default: throw new Error(`rt: field ${name}: unsupported type ${t.kind}`);
  }
}

function arrayIsHeapBound(t) {
  const of = resolve(t.of);
  if (of.kind === "record") return false;
  if (of.kind === "array") return arrayIsHeapBound(of);
  return !(of.scalar && of.size === 1);
}

/**
 * cell(T, a): a long-lived reference to one object of scalar or pointer type T at address a
 * (statics, global scalars): `c[0]` reads and writes it through the current heap, so it stays
 * valid when a new engine instance replaces the buffer.
 */
export function cell(t, a) {
  t = resolve(t);
  switch (t.kind) {
    case "i32": return new CellI32(t, a);
    case "u32": return new CellU32(t, a);
    case "i16": return new CellI16(t, a);
    case "i8": return new CellI8(t, a);
    case "u8": return new CellU8(t, a);
    case "ptr": return new CellPtr(t, a);
    default: return new Cell(t, a);
  }
}
// Cells are read in hot loops (`idx < glyphid_cache_size[0]`). An accessor on the element key "0"
// is only fast when the object's prototype chain has exactly one such accessor: so every cell kind
// is a standalone class (no `extends`), marked with `isCell` for ref_add.
class Cell {
  constructor(t, a) { this.t = t; this._a = a; this.isCell = true; }
  get 0() { return readAt(this.t, this._a); }
  set 0(v) { writeAt(this.t, this._a, v); }
  get byteOffset() { return this._a; }
}
class CellI32 { constructor(t, a) { this.t = t; this._a = a; this.isCell = true; } get 0() { return i32[this._a >> 2]; } set 0(v) { i32[this._a >> 2] = v; } get byteOffset() { return this._a; } }
class CellU32 { constructor(t, a) { this.t = t; this._a = a; this.isCell = true; } get 0() { return u32[this._a >> 2]; } set 0(v) { u32[this._a >> 2] = v; } get byteOffset() { return this._a; } }
class CellI16 { constructor(t, a) { this.t = t; this._a = a; this.isCell = true; } get 0() { return i16[this._a >> 1]; } set 0(v) { i16[this._a >> 1] = v; } get byteOffset() { return this._a; } }
class CellI8 { constructor(t, a) { this.t = t; this._a = a; this.isCell = true; } get 0() { return chars[this._a]; } set 0(v) { chars[this._a] = v; } get byteOffset() { return this._a; } }
class CellU8 { constructor(t, a) { this.t = t; this._a = a; this.isCell = true; } get 0() { return uchars[this._a]; } set 0(v) { uchars[this._a] = v; } get byteOffset() { return this._a; } }
class CellPtr {
  constructor(t, a) { this.t = t; this._a = a; this.isCell = true; this.rd = pointerReader(t); }
  get 0() { return this.rd(u32[this._a >> 2]); }
  set 0(v) { u32[this._a >> 2] = addr(v); }
  get byteOffset() { return this._a; }
}

/** A long-lived array of scalars/pointers at a (statics): element access through the current heap. */
export function cell_array(t, a, n) { return elementProxy(resolve(t), a, n); }

/** How a pointer of type t is represented, as a function from address to JS value. */
const readers = new WeakMap();
export function pointerReader(t) {
  let r = readers.get(t);
  if (!r) readers.set(t, (r = makePointerReader(t)));
  return r;
}
function makePointerReader(t) {
  const to = resolve(t.to);
  if (to.kind === "record") return (a) => view(to, a);
  if (to.kind === "fnptr") return (a) => (a === 0 ? null : ref(t.to, a));
  if (to.kind === "void" || (to.scalar && to.size === 1)) return (a) => a;
  return (a) => (a === 0 ? null : ref(to, a));
}

/** Value of an array-typed lvalue at address a: what the C array decays to. */
export function decay(t, a) {
  const of = resolve(t.of);
  // arrays of structs / of arrays are JS Arrays (indexable like the C), carrying their address
  if (of.kind === "record") {
    const out = new Array(t.n);
    for (let i = 0; i < t.n; i++) out[i] = view(of, a + i * of.size);
    out._a = a;
    out._t = t;
    return out;
  }
  if (of.kind === "array") {
    const out = new Array(t.n);
    for (let i = 0; i < t.n; i++) out[i] = decay(of, a + i * of.size);
    out._a = a;
    out._t = t;
    return out;
  }
  if (of.scalar && of.size === 1) return a; // char arrays are addresses (strings)
  return ref(of, a, t.n);
}

// ---- typed refs: pointers to non-char scalars, to pointers and to functions --------------

/**
 * ref(T, a): the JS value of a `T *` pointing at address a, for T other than char and struct.
 * Integer/float pointees give a typed array starting at a (`*p` is p[0], `p[i]` works); pointer
 * and 64-bit pointees give an indexable proxy with the same behaviour.
 */
export function ref(t, a, n) {
  t = resolve(t);
  if (a === 0) return null;
  switch (t.kind) {
    case "i16": return new Int16Array(i16.buffer, a, n ?? (i16.buffer.byteLength - a) >> 1);
    case "u16": return new Uint16Array(u16.buffer, a, n ?? (u16.buffer.byteLength - a) >> 1);
    case "i32": return new Int32Array(i32.buffer, a, n ?? (i32.buffer.byteLength - a) >> 2);
    case "u32": return new Uint32Array(u32.buffer, a, n ?? (u32.buffer.byteLength - a) >> 2);
    case "f32": return new Float32Array(f32.buffer, a, n ?? (f32.buffer.byteLength - a) >> 2);
    case "f64": return new Float64Array(f64.buffer, a, n ?? (f64.buffer.byteLength - a) >> 3);
    case "i8": return new Int8Array(chars.buffer, a, n ?? chars.buffer.byteLength - a);
    case "u8": case "bool": return new Uint8Array(uchars.buffer, a, n ?? uchars.buffer.byteLength - a);
    case "u64n": if (!(a & 7)) return new BigUint64Array(u32.buffer, a, n ?? (u32.buffer.byteLength - a) >> 3); return elementProxy(t, a, n);
    case "i64n": if (!(a & 7)) return new BigInt64Array(u32.buffer, a, n ?? (u32.buffer.byteLength - a) >> 3); return elementProxy(t, a, n);
    default: return elementProxy(t, a, n);
  }
}

const proxyHandler = {
  get(target, key) {
    if (typeof key === "string") {
      const i = +key;
      if (i === i) return target.get(i);
    }
    return target[key];
  },
  set(target, key, v) {
    const i = +key;
    if (i === i) { target.set(i, v); return true; }
    target[key] = v;
    return true;
  },
};

class Elements {
  constructor(t, a, n) { this.t = t; this._a = a; this.length = n; this.size = t.size; }
  get(i) { return readAt(this.t, this._a + i * this.size); }
  set(i, v) { writeAt(this.t, this._a + i * this.size, v); }
  get byteOffset() { return this._a; }
  /** `p + i` (i >= 0), like a typed array's subarray(i) */
  subarray(i) { return elementProxy(this.t, this._a + i * this.size, this.length === undefined ? undefined : this.length - i); }
}

// pointer elements (`struct obj *objects[COLNO][ROWNO]`, `char *names[]`): the pointer reader is
// looked up once per array, not per element access
class PtrElements {
  constructor(t, a, n) { this.t = t; this._a = a; this.length = n; this.size = 4; this.rd = pointerReader(t); }
  get(i) { return this.rd(u32[(this._a + i * 4) >> 2]); }
  set(i, v) { u32[(this._a + i * 4) >> 2] = addr(v); }
  get byteOffset() { return this._a; }
  subarray(i) { return elementProxy(this.t, this._a + i * 4, this.length === undefined ? undefined : this.length - i); }
}

function elementProxy(t, a, n) { return new Proxy(t.kind === "ptr" ? new PtrElements(t, a, n) : new Elements(t, a, n), proxyHandler); }

/** Read a value of type t stored at address a (generic, used by refs and marshalling). */
function readAt(t, a) {
  t = resolve(t);
  switch (t.kind) {
    case "i8": return chars[a];
    case "u8": case "bool": return uchars[a];
    case "i16": return i16[a >> 1];
    case "u16": return u16[a >> 1];
    case "i32": return i32[a >> 2];
    case "u32": return u32[a >> 2];
    case "i64": return load_i64(a);
    case "u64": return load_u64(a);
    case "u64n": return load_u64n(a);
    case "i64n": return load_i64n(a);
    case "f32": return f32[a >> 2];
    case "f64": return f64[a >> 3];
    case "ptr": return pointerReader(t)(u32[a >> 2]);
    case "fnptr": return fn_from_index(u32[a >> 2], t);
    case "record": return view(t, a);
    case "array": return decay(t, a);
    default: throw new Error("rt: readAt " + t.kind);
  }
}

/** Store a value of type t at address a. */
export function writeAt(t, a, v) {
  t = resolve(t);
  switch (t.kind) {
    case "i8": chars[a] = v; return;
    case "u8": uchars[a] = v; return;
    case "bool": uchars[a] = v ? 1 : 0; return;
    case "i16": i16[a >> 1] = v; return;
    case "u16": u16[a >> 1] = v; return;
    case "i32": i32[a >> 2] = v; return;
    case "u32": u32[a >> 2] = v; return;
    case "i64": case "u64": store_i64(a, v); return;
    case "i64n": case "u64n": store_64n(a, v); return;
    case "f32": f32[a >> 2] = v; return;
    case "f64": f64[a >> 3] = v; return;
    case "ptr": u32[a >> 2] = addr(v); return;
    case "fnptr": u32[a >> 2] = fn_index(v); return;
    case "record": memcpy(a, v._a, t.size); return;
    default: throw new Error("rt: writeAt " + t.kind);
  }
}

/**
 * `r + n` for a typed ref r (a pointer to a non-char scalar, a pointer or a function pointer):
 * the ref of the same kind at addr(r) + n * sizeof(*r). n may be negative (a typed array's own
 * subarray() cannot go backwards).
 */
export function ref_add(r, n) {
  if (r === null || r === undefined) { if (n === 0) return null; throw new Error("rt: ref_add on a null pointer"); }
  if (n === 0) return r;
  if (r.isCell) return ref(r.t, r._a + n * resolve(r.t).size);
  const t = refElementType(r);
  return ref(t, addr(r) + n * resolve(t).size);
}
function refElementType(r) {
  if (r.t) return r.t; // element proxy (Elements)
  switch (r.constructor) {
    case Int8Array: return I8; case Uint8Array: return U8; case Int16Array: return I16; case Uint16Array: return U16;
    case Int32Array: return I32; case Uint32Array: return U32; case Float32Array: return F32; case Float64Array: return F64;
    case BigInt64Array: return I64N; case BigUint64Array: return U64N;
  }
  throw new Error("rt: ref_add on a value that is not a typed ref");
}
const I8 = { kind: "i8", size: 1, align: 1, scalar: true }, U8 = { kind: "u8", size: 1, align: 1, scalar: true };
const I16 = { kind: "i16", size: 2, align: 2, scalar: true }, U16 = { kind: "u16", size: 2, align: 2, scalar: true };
const I32 = { kind: "i32", size: 4, align: 4, scalar: true }, U32 = { kind: "u32", size: 4, align: 4, scalar: true };
const F32 = { kind: "f32", size: 4, align: 4, scalar: true }, F64 = { kind: "f64", size: 8, align: 8, scalar: true };
const I64N = { kind: "i64n", size: 8, align: 8, scalar: true }, U64N = { kind: "u64n", size: 8, align: 8, scalar: true };

// ---- compare computed layouts with the compiler's ----------------------------------------

/**
 * Check every declared struct against the compiler's layouts ({name: {size, fields: [{name,
 * bitoff, bits?}]}}). Returns a list of human-readable differences (empty when consistent).
 */
export function check_layouts(compiler) {
  const bad = [];
  for (const [name, cls] of records) {
    const c = compiler[name];
    if (!c || !Object.keys(cls.fields).length) continue; // opaque in JS: never accessed
    layout(cls);
    if (cls._size !== c.size) bad.push(`${name}: size ${cls._size} != ${c.size}`);
    for (const f of c.fields) {
      const i = cls.info[f.name];
      if (!i) { if (f.name) bad.push(`${name}.${f.name}: missing`); continue; }
      const mine = i.bitoff !== undefined ? i.bitoff : i.off * 8;
      if (mine !== f.bitoff) bad.push(`${name}.${f.name}: bit offset ${mine} != ${f.bitoff}`);
    }
  }
  return bad;
}

// ---- names used by emitted code ------------------------------------------------------------
// (spelled so they cannot collide with C identifiers: ptr, array, addr, view are common there)

/** Any function pointer (a table index in memory, the JS function in code). */
export const fnptr_t = { kind: "fnptr", size: 4, align: 4 };

/** &p->f for a scalar field f: a ref to that field (`*ref` is ref[0]). */
export function ref_of(v, field) {
  const cls = v.constructor;
  layout(cls);
  const i = cls.info[field];
  if (!i || i.off === undefined) throw new Error(`rt: ref_of ${cls.name}.${field}`);
  const t = resolve(i.t);
  if (t.scalar && t.size === 1) return v._a + i.off;
  return ref(t.kind === "ptr" || t.kind === "fnptr" ? t : t, v._a + i.off, 1);
}

/** A struct passed by value: a copy in the current stack frame. */
export function struct_copy(v) {
  const cls = v.constructor;
  const a = stack_alloc(cls.size, cls.align);
  memcpy(a, v._a, cls.size);
  return view(cls, a);
}

export { view as view_of, addr as addr_of, assign as struct_assign, ptr as ptr_to, array as array_of, bits as bits_of, ref as ref_to };

/**
 * a[i] for an array of structs (a JS Array carrying `_a`/`_t`) when i may lie outside [0, n): C
 * reads the memory at a + i * sizeof(T) whatever it is, so an out-of-range element is the view at
 * that address (in range: the array's own canonical element).
 */
export function elt(a, i) {
  const v = a[i];
  if (v !== undefined) return v;
  const of = resolve(a._t.of);
  return view(of, a._a + i * of.size);
}

/** The record class named `name`, or an opaque one (no fields) if JS never declared it. */
export function record_or_opaque(name) { return resolve(name); }

/**
 * Run f once record cls has its members: now, or when its declaration is evaluated (a static
 * initialised at module load may name a record whose header module has not run yet).
 */
export function when_declared(cls, f) {
  if (Object.keys(cls.fields).length) { f(); return; }
  (cls.pending ||= []).push(f);
}

/** The type descriptor of t (resolving a record name). */
export function type_of(t) { return resolve(t); }

/** sizeof s.f (s a view): the size of member f from the struct layout. */
export function sizeof_member(v, field) {
  const cls = v.constructor;
  layout(cls);
  const i = cls.info[field];
  if (!i || i.off === undefined) throw new Error(`rt: sizeof_member ${cls.name}.${field}`);
  return resolve(i.t).size;
}
