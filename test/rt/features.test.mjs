// Runtime features used by the emitted code (node --test): local arrays from initializers,
// static_sizeof, idempotent block-scope records, scalar-pointer arithmetic, exact 64-bit
// objects (uint64_t / int64_t), setjmp/longjmp.
import test from "node:test";
import assert from "node:assert/strict";
import { attach_heap, stack_frame, stack_pop, stack_alloc, machine } from "../../js/rt/heap.js";
import * as C from "../../js/rt/ctypes.js";
import { struct, union, ptr_to, array_of, view_of, ref_to, ref_add, cell_array, addr_of } from "../../js/rt/struct.js";
import { _, js_string } from "../../js/rt/strings.js";
import { stack_array, stack_var, static_array, static_var, static_struct, static_sizeof } from "../../js/rt/locals.js";
import { longjmp, setjmp_caught, LongJmp } from "../../js/rt/setjmp.js";
import { longjmp as portLongjmp } from "../../js/rt/port.js";

attach_heap(new ArrayBuffer(16 << 20), { arena: [1024, 1 << 20], stackTop: 8 << 20 });

test("stack_array(t, null, init): extent and contents from the initializer", () => {
  const sp = stack_frame();
  const mth = stack_array(ptr_to(C.char), null, [_("Jan"), _("Feb"), _("Mar")]);
  assert.equal(mth.length, 3);
  assert.equal(js_string(mth[1]), "Feb");
  const xy = struct("t_xy", { x: C.short, y: C.short });
  const pts = stack_array(xy, null, [[1, 2], [3, 4]]);
  assert.equal(pts[1].y, 4);
  const some = stack_array(C.int, 4, [7, 8]); // missing trailing elements are zero
  assert.deepEqual([...some], [7, 8, 0, 0]);
  const rows = stack_array(array_of(C.char, 4), null, [[65, 66], [67]]);
  assert.equal(js_string(rows[0]), "AB");
  assert.throws(() => stack_array(C.int, null), /extent/);
  stack_pop(sp);
});

test("static_sizeof: size from the symbol, else from the runtime's allocation", () => {
  const wrpsym = static_array("t.wrpsym", C.char, null, [1, 2, 3, 4, 5]);
  assert.equal(typeof wrpsym, "number");
  assert.equal(static_sizeof("t.wrpsym"), 5);
  static_array("t.longs", C.long, 3);
  assert.equal(static_sizeof("t.longs"), 24);
  const prev = machine.symbolSize;
  machine.symbolSize = (k) => (k === "t.compiled" ? 77 : 0);
  assert.equal(static_sizeof("t.compiled"), 77);
  machine.symbolSize = prev;
  assert.throws(() => static_sizeof("t.nope"), /not declared/);
});

test("static_struct(key, cls, init) fills a runtime-owned struct", () => {
  const pair = struct("t_pair2", { a: C.int, b: C.long });
  const v = static_struct("t.pair2", pair, [3, 2 ** 40]);
  assert.equal(v.a, 3);
  assert.equal(v.b, 2 ** 40);
});

test("declaring a record name again returns the same class; members must agree", () => {
  const a = struct("abil_to_adtyp.struct_abil2adtyp_tag", { abil: ptr_to(C.long), adtyp: C.int });
  const b = struct("abil_to_adtyp.struct_abil2adtyp_tag", { abil: ptr_to(C.long), adtyp: C.int });
  assert.equal(a, b);
  const p = stack_alloc(a.size);
  assert.equal(view_of(a, p), view_of(b, p)); // canonical across calls
  assert.throws(() => struct("abil_to_adtyp.struct_abil2adtyp_tag", { x: C.int }), /different members/);
  assert.throws(() => union("abil_to_adtyp.struct_abil2adtyp_tag", { abil: ptr_to(C.long), adtyp: C.int }), /different members/);
  // a record named before its declaration (pointer to an opaque struct) gets its fields
  const o = ptr_to("t_later");
  assert.equal(o.to, "t_later");
  const later = struct("t_later", { q: C.int });
  assert.equal(later.size, 4);
});

test("ref_add: scalar-pointer arithmetic of either sign; subarray on element proxies", () => {
  const sp = stack_frame();
  const xs = stack_array(C.short, 5, [10, 11, 12, 13, 14]);
  const p = ref_add(xs, 3);
  assert.equal(p[0], 13);
  assert.equal(ref_add(p, -2)[0], 11);
  assert.equal(ref_add(p, 0), p);
  assert.equal(ref_add(null, 0), null);
  const strs = stack_array(ptr_to(C.char), null, [_("a"), _("b"), _("c")]);
  const argv = ref_add(strs, 1);
  assert.equal(js_string(argv[0]), "b");
  assert.equal(js_string(ref_add(argv, -1)[0]), "a");
  assert.equal(js_string(strs.subarray(2)[0]), "c");
  const longs = stack_array(C.long, 3, [1, 2 ** 40, 3]);
  assert.equal(ref_add(longs, 1)[0], 2 ** 40);
  assert.equal(addr_of(ref_add(longs, 2)), addr_of(longs) + 16);
  const n = stack_var(C.int, 9);
  assert.equal(ref_add(ref_add(n, 1), -1)[0], 9);
  stack_pop(sp);
});

test("uint64_t / int64_t objects read and write as exact BigInt", () => {
  const isaac = struct("t_isaac64_ctx", { n: C.unsigned, r: array_of(C.uint64_t, 4), a: C.uint64_t, b: C.int64_t });
  assert.equal(isaac.size, 8 + 32 + 16);
  const v = view_of(isaac, stack_alloc(isaac.size));
  v.a = 0xFFFFFFFFFFFFFFFFn;
  assert.equal(v.a, 0xFFFFFFFFFFFFFFFFn);
  v.b = -1n; assert.equal(v.b, -1n);
  v.b = 0x8000000000000000n; assert.equal(v.b, -(2n ** 63n));
  v.r[3] = 2n ** 63n + 5n;
  assert.equal(v.r[3], 2n ** 63n + 5n);
  assert.equal(typeof v.r[0], "bigint");
  const m = v.r;
  assert.equal((m[3] ^ (m[3] >> 5n)) & 1n, ((2n ** 63n + 5n) ^ ((2n ** 63n + 5n) >> 5n)) & 1n);
  v.a = 7; assert.equal(v.a, 7n); // a Number is converted
  assert.equal(C.uint64_t(-1), 2n ** 64n - 1n);
  assert.equal(C.int64_t(2n ** 64n - 1n), -1n);
  assert.equal(C.uint64_t.size, 8);
  const s = static_var("t.seed", C.uint64_t, 2n ** 64n - 1n);
  assert.equal(s[0], 2n ** 64n - 1n);
  const r = ref_to(C.uint64_t, addr_of(v) + 12); // misaligned: element proxy
  r[0] = 3n; assert.equal(r[0], 3n);
  const sv = stack_var(C.int64_t, -5n);
  assert.equal(sv[0], -5n);
  const tab = static_array("t.u64tab", C.uint64_t, null, [1n, 2n ** 60n]);
  assert.equal(tab[1], 2n ** 60n);
});

test("setjmp/longjmp: a longjmp reaches the setjmp of its own buffer only", () => {
  const sp = stack_frame();
  const jb = stack_alloc(64), other = stack_alloc(64);
  const run = (target, v) => {
    try { longjmp(target, v); } catch (e) { return setjmp_caught(e, jb); }
  };
  assert.equal(run(jb, 3), 3);
  assert.equal(run(jb, 0), 1); // longjmp(env, 0) makes setjmp return 1
  assert.throws(() => run(other, 2), (e) => e instanceof LongJmp && e.env === other);
  assert.throws(() => setjmp_caught(new Error("boom"), jb), /boom/);
  assert.throws(() => setjmp_caught(new LongJmp(jb, 1), null), LongJmp); // setjmp not run yet
  assert.equal(portLongjmp, longjmp);
  stack_pop(sp);
});

test("setjmp/longjmp through a host-installed longjmp protocol", () => {
  class Foreign {}
  let threw = 0, val = 0;
  machine.longjmp = (a, v) => { threw = a; val = v; throw new Foreign(); };
  machine.catch_longjmp = (e, a) => (e instanceof Foreign && threw === a ? (threw = 0, val) : undefined);
  const jb = stack_alloc(64);
  try {
    let got;
    try { longjmp(jb, 5); } catch (e) { got = setjmp_caught(e, jb); }
    assert.equal(got, 5);
    assert.equal(threw, 0);
    assert.throws(() => { try { longjmp(jb + 64, 1); } catch (e) { setjmp_caught(e, jb); } }, Foreign);
  } finally { machine.longjmp = null; machine.catch_longjmp = null; }
});

test("residue results: a raw pointer result becomes a view of its record", async () => {
  const { fopen, strlen } = await import("../../js/rt/libc.js");
  const prev = machine.libc;
  machine.libc = (name, args) => (name === "fopen" ? 4096 : 0);
  try {
    const fp = fopen(_("/x"), _("w"));
    assert.equal(fp._a, 4096);
    assert.equal(fp.constructor.name, "struct__IO_FILE");
    assert.ok(fp == 4096); // loose == compares the address (emitted code uses ==)
  } finally { machine.libc = prev; }
  assert.equal(strlen(_("abc")), 3);
});

test("function pointers that are integer casts (SIG_IGN, SIG_ERR) round-trip and compare", async () => {
  const { fn_sentinel, fn_index, fn_from_index } = await import("../../js/rt/fnptr.js");
  const ign = fn_from_index(1), err = fn_sentinel(-1);
  assert.equal(fn_from_index(1), ign);
  assert.equal(fn_index(ign), 1);
  assert.equal(fn_index(err), 4294967295);
  assert.throws(() => err(2), /non-function pointer -1/);
});

test("named-field initializers: structs, nested records, unions, char arrays, positional arrays of records", async () => {
  const { static_entries } = await import("../../js/rt/locals.js");
  const attk = struct("t_attack", { aatyp: C.uchar, adtyp: C.uchar, damn: C.uchar, damd: C.uchar });
  const art = struct("t_artifact", { otyp: C.short, name: ptr_to(C.char), tag: array_of(C.char, 8), attk: "t_attack", spfx: C.unsigned, fn: ptr_to(C.int) });
  const u = union("t_anyu", { a_int: C.int, a_long: C.long });
  const tab = static_array("t.artilist", art, null, [
    { otyp: 3, name: _("Excalibur"), tag: "excal", attk: { aatyp: 0, adtyp: 2, damn: 5, damd: 10 }, spfx: 0x80000001 },
    { otyp: 0 },
  ]);
  assert.equal(tab[0].otyp, 3);
  assert.equal(js_string(tab[0].name), "Excalibur");
  assert.equal(js_string(tab[0].tag), "excal");
  assert.equal(tab[0].attk.damd, 10);
  assert.equal(tab[0].spfx, 0x80000001);
  assert.equal(tab[1].name, 0);
  assert.throws(() => static_array("t.bad", art, null, [{ nope: 1 }]), /no field nope/);
  assert.throws(() => static_array("t.bad2", art, null, [{ tag: "much too long" }]), /longer/);
  const uv = static_struct("t.anyu", u, { a_int: 7 });
  assert.equal(uv.a_int, 7);
  const sp = stack_frame();
  const local = stack_array(art, null, [{ otyp: 9, tag: "x" }]);
  assert.equal(local[0].otyp, 9);
  stack_pop(sp);
  const keys = static_entries().map((e) => e.key);
  assert.ok(keys.includes("t.artilist") && keys.includes("t.anyu"));
  const e = static_entries().find((x) => x.key === "t.artilist");
  assert.equal(e.size, 2 * art.size);
});

test("libc: assert, strtoull (exact BigInt), constants, SIG_*", async () => {
  const L = await import("../../js/rt/libc.js");
  const { fn_index } = await import("../../js/rt/fnptr.js");
  assert.equal(L.strtoull(_("18446744073709551615"), null, 10), 18446744073709551615n);
  assert.equal(L.strtoull(_("  42xyz"), null, 10), 42n);
  const errno = stack_alloc(16), prevLibc = machine.libc;
  machine.libc = (name) => { assert.equal(name, "__errno_location"); return errno; };
  assert.equal(L.strtoull(_("99999999999999999999"), null, 10), 0xFFFFFFFFFFFFFFFFn);
  machine.libc = prevLibc;
  assert.equal(L.strtoull(_("-1"), null, 10), 0xFFFFFFFFFFFFFFFFn);
  assert.equal(L.strtoull(_("0x1F"), null, 0), 31n);
  const sp = stack_frame();
  const endp = ref_to(ptr_to(C.char), stack_alloc(4));
  const s = _("123 rest");
  L.strtoull(s, endp, 10);
  assert.equal(endp[0], s + 3);
  stack_pop(sp);
  assert.equal(L.SIGINT, 2); assert.equal(L.EOF, -1); assert.equal(L.O_CREAT, 64);
  assert.equal(L.SIG_DFL, null); assert.equal(fn_index(L.SIG_IGN), 4294967294); assert.equal(fn_index(L.SIG_ERR), 4294967295);
  const prev = machine.libc; let aborted = 0;
  machine.libc = (n) => { if (n === "abort") aborted++; };
  try { L.assert(1); assert.equal(aborted, 0); L.assert(0); assert.equal(aborted, 1); } finally { machine.libc = prev; }
});

test("global_ref before the defining module declares the global", async () => {
  const { global_ref, global_scalar } = await import("../../js/rt/globals.js");
  const r = global_ref("t_uarm", ptr_to("t_artifact"));
  const g = global_scalar("t_uarm", ptr_to("t_artifact"));
  assert.equal(r, g);
  assert.throws(() => global_ref("t_never"), /not declared/);
});

test("checked build records the site with each failure", async () => {
  const { chk, failures } = await import("../../js/rt/checked.js");
  chk.i32(2 ** 31, "hack.c:12");
  chk.fits(300, -128, 127, "mon.c:5");
  assert.equal(failures.get("i32 hack.c:12"), 1);
  assert.equal(failures.get("fits[-128,127] mon.c:5"), 1);
});

test("elt: out-of-range struct array element is the view at the C address", async () => {
  const { elt } = await import("../../js/rt/struct.js");
  const d = struct("t_dgn", { ledger_start: C.int, depth_start: C.int });
  const tab = static_array("t.dungeons", d, 4);
  assert.equal(elt(tab, 2), tab[2]);
  const m1 = elt(tab, -1);
  assert.equal(m1._a, tab._a - d.size);
  assert.equal(elt(tab, -1), m1); // canonical
});

test("checked build: failing sites keep their offending values", async () => {
  const { chk, failures, samples } = await import("../../js/rt/checked.js");
  failures.clear(); samples.clear();
  chk.idx([1, 2], 5, "x.c:f"); chk.idx([1, 2], 5, "x.c:f"); chk.idx([1, 2], -1, "x.c:f"); chk.idx([1, 2], 1, "x.c:f");
  assert.equal(failures.get("idx x.c:f"), 3);
  assert.deepEqual(samples.get("idx x.c:f"), ["5", "-1"]);
});
