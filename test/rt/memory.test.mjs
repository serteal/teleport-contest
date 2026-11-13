// Runtime memory-model tests (node --test): arena placement, re-attach to a new memory image,
// memory growth, runtime-owned statics and their initialisers, global scalars.
import test from "node:test";
import assert from "node:assert/strict";
import { attach_heap, regrow_heap, arena_range, arena_used, uchars, machine, epoch } from "../../js/rt/heap.js";
import * as heap from "../../js/rt/heap.js";
import * as C from "../../js/rt/ctypes.js";
import { struct, array_of, view_of } from "../../js/rt/struct.js";
import { _, js_string } from "../../js/rt/strings.js";
import { static_var, static_array, static_struct, init_list, init_string, is_owned_static } from "../../js/rt/locals.js";
import { global_scalar, global_ref } from "../../js/rt/globals.js";

const LOW = [1024, 1 << 20]; // as in host/boot.js: the residue's reserved low region
const opts = { arena: LOW, stackTop: 4 << 20 };
attach_heap(new ArrayBuffer(8 << 20), opts);

test("the arena is the explicit region and allocations stay inside it", () => {
  assert.deepEqual(arena_range(), LOW);
  const a = _("Elbereth");
  assert.ok(a >= LOW[0] && a < LOW[1]);
  assert.ok(arena_used() > 0);
});

test("the arena cannot move once used (module-level data holds its addresses)", () => {
  assert.throws(() => attach_heap(new ArrayBuffer(8 << 20), { arena: [2 << 20, 3 << 20] }), /arena moved/);
  attach_heap(new ArrayBuffer(8 << 20), opts); // same region: fine
});

test("a new memory image keeps literal addresses and rewrites their bytes", () => {
  const a = _("you feel lucky");
  attach_heap(new ArrayBuffer(8 << 20), opts);
  assert.equal(_("you feel lucky"), a);
  assert.equal(js_string(a), "you feel lucky");
});

test("runtime-owned statics get their initialiser, again after re-attach", () => {
  const p = static_var("t.msg", C.int, 7);
  const tab = static_array("t.tab", C.short, null, [1, 2, 3]);
  const s = static_var("t.str", C.int); // no initialiser: zero
  assert.equal(p[0], 7); assert.equal(tab[2], 3); assert.equal(s[0], 0);
  p[0] = 9; tab[2] = 30;
  assert.equal(static_var("t.msg", C.int, 7)[0], 9); // same object, initialiser not re-run per call
  attach_heap(new ArrayBuffer(8 << 20), opts);
  assert.equal(p[0], 7); assert.equal(tab[2], 3);
  assert.ok(is_owned_static(p.byteOffset));
});

test("init_list / init_string with once=true initialise an owned static exactly once per image", () => {
  const rec = struct("t_pair", { a: C.int, b: C.int });
  const v = init_list(static_struct("t.pair", rec), [4, 5], true);
  assert.equal(v.b, 5);
  v.b = 50;
  init_list(static_struct("t.pair", rec), [4, 5], true);
  assert.equal(v.b, 50);
  const buf = init_string(static_array("t.vowel", C.char, 8), _("aeiouwy"), true);
  assert.equal(js_string(buf), "aeiouwy");
  uchars[buf] = 65;
  attach_heap(new ArrayBuffer(8 << 20), opts);
  assert.equal(v.b, 5);
  assert.equal(js_string(buf), "aeiouwy");
});

test("statics found through machine.symbol are never initialised by the runtime", () => {
  const prev = machine.symbol;
  const H = new ArrayBuffer(8 << 20);
  attach_heap(H, { ...opts, symbol: (k) => (k === "t.compiled" ? 2 << 20 : 0) });
  new Int32Array(H)[(2 << 20) >> 2] = 123; // the existing image's data
  const c = static_var("t.compiled", C.int, 5);
  assert.equal(c[0], 123);
  assert.equal(is_owned_static(2 << 20), false);
  machine.symbol = prev;
});

test("memory growth keeps arena, literals and statics; views rebind", () => {
  const a = _("grow me"), s = static_var("t.g", C.int, 11);
  const rec = struct("t_one", { x: C.int });
  const v = view_of(rec, 3 << 20);
  v.x = 42;
  const e = epoch;
  const big = new ArrayBuffer(16 << 20);
  new Uint8Array(big).set(new Uint8Array(heap.buffer)); // what a wasm2js grow does
  regrow_heap(big);
  assert.ok(epoch > e);
  assert.equal(heap.buffer, big);
  assert.equal(_("grow me"), a);
  assert.equal(js_string(a), "grow me");
  assert.equal(s[0], 11);
  assert.equal(v.x, 42);
  assert.throws(() => regrow_heap(new ArrayBuffer(1 << 20)), /smaller/);
});

test("global scalars get storage of their own size", () => {
  const r1 = global_scalar("t_moves", C.long);
  const r2 = global_scalar("t_flag", C.char);
  globalThis.t_moves = 2 ** 40 + 1;
  globalThis.t_flag = 200;
  assert.equal(globalThis.t_moves, 2 ** 40 + 1);
  assert.equal(globalThis.t_flag, -56);
  assert.ok(r2.byteOffset >= r1.byteOffset + 8); // the long's 8 bytes are its own
  assert.equal(global_ref("t_moves"), r1);
});

test("a literal with a character above 255 is rejected", () => {
  assert.throws(() => _("caf€"), /above 255/);
});

test("rt_state_save/restore rewinds statics and literals created after the mark (in-place heap restore)", async () => {
  const { rt_state_save, rt_state_restore } = await import("../../js/rt/heap.js");
  const image = () => new Uint8Array(heap.buffer).slice(); // the host's heap image
  const put = (img) => new Uint8Array(heap.buffer).set(img);
  const img0 = image(), m = rt_state_save();
  const used0 = arena_used();
  const n = static_var("late.n", C.int, 5);
  const lit = _("first used after the mark");
  n[0] = 99;
  assert.equal(n[0], 99);
  put(img0); rt_state_restore(m); // rewind: as if the code above never ran
  assert.equal(arena_used(), used0);
  const n2 = static_var("late.n", C.int, 5);
  assert.equal(n2[0], 5); // initialiser ran again
  assert.equal(n2.byteOffset, n.byteOffset); // same allocation order -> same address
  assert.equal(_("first used after the mark"), lit);
  assert.equal(js_string(lit), "first used after the mark");
});

test("a static array of scalar rows follows the memory it was declared against", async () => {
  const tab = static_array("t.rows", array_of(C.short, 2), null, [[1, 2], [3, 4]]);
  assert.equal(tab[1][0], 3);
  const a = tab._a;
  attach_heap(new ArrayBuffer(8 << 20), opts); // a new image: owned initialiser re-runs
  assert.equal(tab[1][1], 4);
  new Int16Array(heap.buffer)[(a + 4) >> 1] = 33;
  assert.equal(tab[1][0], 33); // the row reads the new buffer
  const big = new ArrayBuffer(16 << 20); new Uint8Array(big).set(new Uint8Array(heap.buffer));
  regrow_heap(big);
  new Int16Array(heap.buffer)[(a + 6) >> 1] = 44;
  assert.equal(tab[1][1], 44);
});
