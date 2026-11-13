// Runtime unit tests (node --test): heap, struct layouts and views, bitfields, strings,
// stack frames, integer conversions and 64-bit helpers.
import test from "node:test";
import assert from "node:assert/strict";
import { attach_heap, chars, uchars, stack_frame, stack_pop, stack_alloc, load_i64, store_i64 } from "../../js/rt/heap.js";
import * as C from "../../js/rt/ctypes.js";
import { struct, union, ptr_to, array_of, Bitfield, bits_of, view_of, addr_of, struct_assign, ptr_add, ptr_diff, offsetof, ref_of, ref_to, fnptr_t } from "../../js/rt/struct.js";
import { _, js_string, put_string } from "../../js/rt/strings.js";
import { stack_var, stack_array, stack_struct, static_var, static_array, init_list, init_string } from "../../js/rt/locals.js";
import { and64, or64, xor64, not64, not64u, shl64, shr64, and64u, u64, i64 } from "../../js/rt/int64.js";
import { fn_index, fn_from_index } from "../../js/rt/fnptr.js";

attach_heap(new ArrayBuffer(16 << 20), { stackTop: 8 << 20 });

// layouts mirror wasm32 C rules
const s_coord = struct("t_coord", { x: C.short, y: C.short });
const s_mixed = struct("t_mixed", {
  c: C.char,
  i: C.int,
  s: C.short,
  l: C.long,          // 64-bit, 8-aligned
  p: ptr_to("t_mixed"),
  cc: "t_coord",
  arr: array_of(C.int, 3),
  name: array_of(C.char, 5),
  f1: Bitfield(1),
  f3: Bitfield(3),
  f30: Bitfield(30),  // does not fit in the first unit: starts a new one
  sb: bits_of(C.int, 4),
});
const u_any = union("t_any", { a_int: C.int, a_long: C.long, a_ptr: ptr_to(C.char) });

test("struct layout follows wasm32 rules", () => {
  assert.equal(s_coord.size, 4);
  assert.equal(offsetof(s_mixed, "i"), 4);
  assert.equal(offsetof(s_mixed, "s"), 8);
  assert.equal(offsetof(s_mixed, "l"), 16);
  assert.equal(offsetof(s_mixed, "p"), 24);
  assert.equal(offsetof(s_mixed, "cc"), 28);
  assert.equal(offsetof(s_mixed, "arr"), 32);
  assert.equal(offsetof(s_mixed, "name"), 44);
  assert.equal(u_any.size, 8);
  assert.equal(s_mixed.size % 8, 0);
});

test("views are canonical; fields read and write the heap with C conversions", () => {
  const a = stack_alloc(s_mixed.size);
  const v = view_of(s_mixed, a);
  assert.equal(v, view_of(s_mixed, a)); // pointer equality is ==
  assert.equal(view_of(s_mixed, 0), null);
  v.c = 200; assert.equal(v.c, -56);   // char conversion on store
  v.i = 2 ** 32 + 5; assert.equal(v.i, 5);
  v.l = -(2 ** 40) - 3; assert.equal(v.l, -(2 ** 40) - 3);
  v.p = v; assert.equal(v.p, v);
  v.cc.x = -7; assert.equal(v.cc.x, -7); assert.equal(v.cc, view_of(s_coord, a + 28));
  v.arr[2] = 9; assert.equal(v.arr[2], 9); assert.equal(v.arr.length, 3);
  assert.equal(typeof v.name, "number"); // char arrays are addresses
  put_string(v.name, "abcd"); assert.equal(js_string(v.name), "abcd");
  assert.equal(addr_of(v), a);
});

test("bit-fields pack like clang and truncate on store", () => {
  const v = view_of(s_mixed, stack_alloc(s_mixed.size));
  v.f1 = 3; assert.equal(v.f1, 1);
  v.f3 = 13; assert.equal(v.f3, 5);
  v.f30 = 2 ** 30 + 7; assert.equal(v.f30, 7);
  v.sb = 15; assert.equal(v.sb, -1); // signed bit-field
  assert.equal(v.f1, 1); assert.equal(v.f3, 5); // neighbours untouched
});

test("struct assignment, pointer arithmetic and refs", () => {
  const base = stack_alloc(s_coord.size * 4);
  const p0 = view_of(s_coord, base), p2 = ptr_add(p0, 2);
  p0.x = 11; p0.y = 22;
  struct_assign(p2, p0);
  assert.equal(p2.x, 11); assert.equal(p2.y, 22);
  assert.equal(ptr_diff(p2, p0), 2);
  assert.ok(p2 > p0); // relational comparison through valueOf (addresses)
  const r = ref_of(p0, "y");
  r[0] = 5; assert.equal(p0.y, 5);
  const ip = ref_to(C.int, stack_alloc(8));
  ip[0] = -1; ip[1] = 7; assert.equal(ip[1], 7);
});

test("unions overlay their members", () => {
  const v = view_of(u_any, stack_alloc(u_any.size));
  v.a_long = 2 ** 33 + 1;
  assert.equal(v.a_int, 1);
});

test("string literals are interned addresses", () => {
  const a = _("Elbereth"), b = _("Elbereth");
  assert.equal(a, b);
  assert.equal(js_string(a), "Elbereth");
  assert.equal(uchars[a + 8], 0);
  assert.equal(C.ord("E"), 69);
  assert.equal(C.sizeof_string("abc"), 4);
});

test("stack frames release memory-resident locals", () => {
  const sp = stack_frame();
  const x = stack_var(C.int, 41);
  x[0]++;
  assert.equal(x[0], 42);
  const buf = stack_array(C.char, 16);
  assert.equal(typeof buf, "number");
  init_string(buf, _("hi"));
  assert.equal(js_string(buf), "hi");
  const cs = stack_array(s_coord, 3);
  assert.equal(cs.length, 3);
  assert.equal(cs[1], view_of(s_coord, addr_of(cs) + 4));
  const cc = init_list(stack_struct(s_coord), [3, 4]);
  assert.equal(cc.y, 4);
  stack_pop(sp);
  assert.equal(stack_frame(), sp);
});

test("statics are allocated once", () => {
  const a = static_var("f.counter", C.int, 3);
  a[0]++;
  assert.equal(static_var("f.counter", C.int, 3)[0], 4);
  const arr = static_array("f.tab", C.short, null, [1, 2, 3]);
  assert.equal(arr.length, 3);
});

test("C conversions", () => {
  assert.equal(C.schar(255), -1);
  assert.equal(C.uchar(-1), 255);
  assert.equal(C.short(40000), -25536);
  assert.equal(C.unsigned(-1), 4294967295);
  assert.equal(C.int(2 ** 31), -(2 ** 31));
  assert.equal(C.int(-3.7), -3);
  assert.equal(C.uchar(true), 1);
  assert.equal(C.idiv(-7, 2), -3);
  assert.equal(C.int(123n), 123);
  assert.equal(C.unsigned(-1n), 4294967295);
});

test("64-bit bit operations on Numbers", () => {
  const big = 2 ** 40 + 5;
  assert.equal(and64(big, 2 ** 40 + 1), 2 ** 40 + 1);
  assert.equal(or64(2 ** 32, 1), 2 ** 32 + 1);
  assert.equal(xor64(-1, 0), -1);
  assert.equal(not64(0), -1);
  assert.equal(shl64(1, 40), 2 ** 40);
  assert.equal(shr64(-(2 ** 40), 4), -(2 ** 36));
  assert.equal(and64u(0x80000000, 0xffffffff), 0x80000000);
  assert.equal(0x80000000 & 0x80000000, -2147483648); // why the helpers exist
});

test("uint64_t arithmetic is exact (BigInt)", () => {
  const x = u64(2n ** 64n - 1n);
  assert.equal(x % u64(7), 1n);
  assert.equal(u64(-1), 2n ** 64n - 1n);
  assert.equal(i64(2n ** 63n), -(2n ** 63n));
  assert.equal(C.int(x % u64(1000)), 615);
});

test("64-bit heap loads/stores", () => {
  const a = stack_alloc(8);
  store_i64(a, -5); assert.equal(load_i64(a), -5);
  store_i64(a, 2 ** 52 + 3); assert.equal(load_i64(a), 2 ** 52 + 3);
});

test("function pointers round-trip through the table", () => {
  function eatfood() { return 1; }
  const i = fn_index(eatfood);
  assert.ok(i > 0);
  assert.equal(fn_from_index(i), eatfood);
  assert.equal(fn_index(null), 0);
  assert.equal(fn_from_index(0), null);
  assert.equal(fnptr_t.size, 4);
});

test("char heap views", () => {
  const a = stack_alloc(4);
  chars[a] = 200;
  assert.equal(chars[a], -56);
  assert.equal(uchars[a], 200);
});

test("x &= ~mask on unsigned 64-bit values keeps every bit (not64u is exact)", () => {
  const STRAT_WAITFORU = 0x20000000, STRAT_APPEARMSG = 0x80000000;
  const m = 0xA0000005;
  const r = and64u(m, not64u(or64(STRAT_WAITFORU, STRAT_APPEARMSG)));
  assert.equal(r, 5);
  assert.equal(and64u(2 ** 40 + 0x80000001, not64u(0x80000000)), 2 ** 40 + 1);
});

test("stack allocations keep the stack pointer 16-byte aligned (C ABI)", () => {
  const sp = stack_frame();
  stack_alloc(4096 + 8, 8);
  assert.equal(stack_frame() % 16, 0);
  stack_alloc(3, 1);
  assert.equal(stack_frame() % 16, 0);
  stack_pop(sp);
});
