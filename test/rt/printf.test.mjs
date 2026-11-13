// rt/libc.js formats simple printf formats (%d %i %u %c %s %%) in JS and leaves everything else
// to the residue (musl). Each case runs both ways on one real heap (js/vendor C library) and the
// bytes written and the return values must be identical.
import test from "node:test";
import assert from "node:assert/strict";
import { createClib } from "../../js/vendor/clib-lua.js";
import { attach_heap, machine, uchars } from "../../js/rt/heap.js";
import { _, js_string } from "../../js/rt/strings.js";
import { sprintf, snprintf } from "../../js/rt/libc.js";

const captured = [];
const clib = createClib({ long64: true, stdout: (b) => captured.push(Array.from(b)) });
const L = clib.layout;
attach_heap(clib.buffer, {
  getSP: () => clib.stackSave(), setSP: (sp) => clib.stackRestore(sp),
  malloc: (n) => clib.fn.malloc(n), free: (p) => clib.fn.free(p), arena: [L.nullGuard, L.globalBase],
});
const calls = [];
machine.libc = (name, args) => { calls.push(name); return clib.call(name, ...args); };

const A = clib.fn.malloc(512), B = clib.fn.malloc(512);
const bytes = (p, n) => Array.from(uchars.subarray(p, p + n));
const str = clib.fn.malloc(64);
for (let i = 0; i < 6; i++) uchars[str + i] = "kitten".charCodeAt(i);
uchars[str + 6] = 0;

const cases = [
  ["%d", [0]], ["%d", [-2147483648]], ["%d", [2147483647]], ["%i items", [-7]], ["%u", [-1]],
  ["%c%c", [65, 0]], ["[%s]", [str]], ["%d %s(%s) = %d @ %s:%d\n", [12, str, str, 3, str, 99]],
  ["100%% sure", []], ["", []], ["%d", [true]],
  // residue cases: flags, width, precision, length, NULL %s
  ["%5d|%-3d|%03d", [7, 8, 9]], ["%.2s", [str]], ["%ld", [123456789]], ["%x", [255]], ["%s", [0]],
];

test("sprintf: JS formatting is byte-identical to the residue", () => {
  for (const [f, args] of cases) {
    const fmt = _(f);
    uchars.fill(0xaa, A, A + 512); uchars.fill(0xaa, B, B + 512);
    const r1 = sprintf(A, fmt, ...args);
    const r2 = clib.call("sprintf", B, fmt, ...args.map((v) => (typeof v === "boolean" ? +v : v)));
    assert.equal(r1, r2, f);
    assert.deepEqual(bytes(A, 80), bytes(B, 80), f);
  }
});

test("sprintf: simple formats do not reach the residue, others do", () => {
  calls.length = 0;
  sprintf(A, _("%d-%s"), 5, str);
  assert.deepEqual(calls, []);
  sprintf(A, _("%5d"), 5);
  sprintf(A, _("%s"), 0);
  assert.deepEqual(calls, ["sprintf", "sprintf"]);
});

test("sprintf: a %s source inside the output goes to the residue (musl's overlap behaviour)", () => {
  uchars.fill(0xaa, A, A + 64); uchars.fill(0xaa, B, B + 64);
  for (let i = 0; i < 4; i++) uchars[A + i] = "abcd".charCodeAt(i);
  uchars[A + 4] = 0;
  for (let i = 0; i < 5; i++) uchars[B + i] = uchars[A + i];
  calls.length = 0;
  const r1 = sprintf(A, _("xy%s"), A);
  const r2 = clib.call("sprintf", B, _("xy%s"), B);
  assert.deepEqual(calls, ["sprintf"]);
  assert.equal(r1, r2);
  assert.deepEqual(bytes(A, 12), bytes(B, 12));
  // `Sprintf(buf, "%s", buf)`-like call with an unrelated buffer stays in JS
  calls.length = 0;
  sprintf(B, _("%s!"), str);
  assert.deepEqual(calls, []);
});

test("snprintf: truncation and the full-length result match the residue", () => {
  for (const n of [1, 2, 5, 6, 7, 100]) {
    uchars.fill(0xaa, A, A + 64); uchars.fill(0xaa, B, B + 64);
    const r1 = snprintf(A, n, _("%s=%d"), str, 42);
    const r2 = clib.call("snprintf", B, n, _("%s=%d"), str, 42);
    assert.equal(r1, r2, String(n));
    assert.deepEqual(bytes(A, 16), bytes(B, 16), String(n));
  }
});

test("format text is read once per literal address", () => {
  const f = _("%d scrolls");
  sprintf(A, f, 3);
  assert.equal(js_string(A), "3 scrolls");
  // a non-literal format buffer is read each time (its bytes may change)
  for (let i = 0; i < 3; i++) uchars[B + i] = "%d!".charCodeAt(i);
  uchars[B + 3] = 0;
  sprintf(A, B, 1);
  assert.equal(js_string(A), "1!");
  uchars[B + 2] = "?".charCodeAt(0);
  sprintf(A, B, 2);
  assert.equal(js_string(A), "2?");
});

test("a literal address reused after rt_state_restore gets the new text's plan", async () => {
  const { rt_state_save, rt_state_restore } = await import("../../js/rt/heap.js");
  const st = rt_state_save();
  const f1 = _("%cachieveX=%s");
  sprintf(A, f1, 9, str);
  assert.equal(js_string(A), "\tachieveX=kitten");
  rt_state_restore(st);
  const f2 = _("You %s in %s");
  assert.equal(f2, f1); // the arena hands the address out again
  sprintf(A, f2, str, str);
  assert.equal(js_string(A), "You kitten in kitten");
});

test("strtoull overflow: ULLONG_MAX and errno ERANGE, like the residue", async () => {
  const L = await import("../../js/rt/libc.js");
  const errp = clib.fn.__errno_location();
  const s = _("99999999999999999999999");
  uchars.fill(0, errp, errp + 4);
  const c = BigInt.asUintN(64, BigInt(clib.call("strtoull", s, 0, 10)));
  const ec = new DataView(uchars.buffer).getInt32(errp, true);
  uchars.fill(0, errp, errp + 4);
  const j = L.strtoull(s, null, 10);
  const ej = new DataView(uchars.buffer).getInt32(errp, true);
  assert.equal(j, 0xFFFFFFFFFFFFFFFFn);
  assert.equal(ej, ec);
  assert.equal(ej, L.ERANGE);
});
