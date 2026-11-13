// Rewriter tests (node --test): golden output per fixture, syntax of everything emitted, rule
// coverage, and a differential test of the emitted JS against the same C compiled natively.
//   UPDATE_GOLDEN=1 node --test test/nh2js/   regenerates test/nh2js/expected/
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const tree = path.join(here, "tree");
const cli = path.join(repo, "tools/nh2js/cli.mjs");
const files = fs.readdirSync(path.join(tree, "src")).filter((f) => f.endsWith(".c")).sort();

const out = fs.mkdtempSync(path.join(os.tmpdir(), "nh2js-test-"));
fs.symlinkSync(path.join(repo, "js/rt"), path.join(out, "rt"));
const reportPath = path.join(out, "report.json");
const emit = spawnSync(process.execPath, [cli, ...files, "--src", tree, "--out", out, "--headers", "--report", reportPath, "--manifest", path.join(out, "manifest.json")], { encoding: "utf8" });
const report = emit.status === 0 ? JSON.parse(fs.readFileSync(reportPath, "utf8")) : null;

// the same fixtures in the plain dialect only (--fallback: every function printed from the AST),
// and a second sugar emission for the determinism check
const outFb = fs.mkdtempSync(path.join(os.tmpdir(), "nh2js-test-fb-"));
fs.symlinkSync(path.join(repo, "js/rt"), path.join(outFb, "rt"));
const emitFb = spawnSync(process.execPath, [cli, ...files, "--src", tree, "--out", outFb, "--headers", "--fallback", "--report", path.join(outFb, "report.json"), "--manifest", path.join(outFb, "manifest.json")], { encoding: "utf8" });
const out2 = fs.mkdtempSync(path.join(os.tmpdir(), "nh2js-test-2-"));
const emit2 = spawnSync(process.execPath, [cli, ...files, "--src", tree, "--out", out2, "--headers", "--report", path.join(out2, "report.json"), "--manifest", path.join(out2, "manifest.json")], { encoding: "utf8" });

test("emission is deterministic (emit twice -> identical files)", () => {
  assert.equal(emit2.status, 0, emit2.stderr);
  for (const d of ["src", "include"]) if (fs.existsSync(path.join(out, d))) for (const f of fs.readdirSync(path.join(out, d)))
    assert.equal(fs.readFileSync(path.join(out2, d, f), "latin1"), fs.readFileSync(path.join(out, d, f), "latin1"), `${d}/${f}`);
});

test("the fallback (plain dialect) emits every fixture function", () => {
  assert.equal(emitFb.status, 0, emitFb.stderr);
  const r = JSON.parse(fs.readFileSync(path.join(outFb, "report.json"), "utf8"));
  for (const f of r.files) for (const fn of f.functions) assert.equal(fn.mode, "fallback", `${f.file} ${fn.name}: ${fn.reasons.join("; ")}`);
  assert.ok(r.rules["fallback.function"].count > 0);
  for (const f of files) {
    const r2 = spawnSync(process.execPath, ["--check", path.join(outFb, "src", f.replace(/\.c$/, ".js"))], { encoding: "utf8" });
    assert.equal(r2.status, 0, r2.stderr);
  }
});

test("the rewriter runs on the fixtures", () => {
  assert.equal(emit.status, 0, emit.stderr);
  for (const f of report.files) {
    assert.ok(!f.error, `${f.file}: ${f.error}`);
    for (const fn of f.functions) assert.equal(fn.mode, "sugar", `${f.file} ${fn.name}: ${fn.reasons.join("; ")}`);
  }
});

test("emitted modules match the golden files (with a line map to the C)", async () => {
  const { decodeMap } = await import(pathToFileURL(path.join(repo, "tools/nh2js/lib/layout.mjs")).href);
  const maps = JSON.parse(fs.readFileSync(path.join(out, "manifest.json"), "utf8")).lineMaps;
  for (const f of files) {
    const js = fs.readFileSync(path.join(out, "src", f.replace(/\.c$/, ".js")), "latin1");
    const c = fs.readFileSync(path.join(tree, "src", f), "latin1").split("\n");
    // each mapped line: C lines in order; a C line that is only a comment is the JS line
    const map = decodeMap(maps["src/" + f.replace(/\.c$/, ".js")], js.split("\n").length);
    let last = -1;
    js.split("\n").forEach((l, j) => {
      const ci = map[j];
      if (ci < 0) return;
      assert.ok(ci > last && ci < c.length, `${f}:${j + 1}: C line ${ci + 1}`);
      last = ci;
      if (/^\s*\/\*.*\*\/\s*$/.test(c[ci]) && l.trim()) assert.equal(l.trim(), c[ci].trim(), `${f}:${j + 1}`);
    });
    const golden = path.join(here, "expected", f.replace(/\.c$/, ".js"));
    if (process.env.UPDATE_GOLDEN || !fs.existsSync(golden)) fs.writeFileSync(golden, js, "latin1");
    assert.equal(js, fs.readFileSync(golden, "latin1"), `${f}: differs from ${golden}`);
  }
});

test("every emitted module is valid JS", () => {
  const all = [];
  for (const d of ["src", "include"]) if (fs.existsSync(path.join(out, d))) for (const f of fs.readdirSync(path.join(out, d))) all.push(path.join(out, d, f));
  for (const d of ["src", "include"]) {
    const dir = path.join(repo, "js", d);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) all.push(path.join(dir, f));
  }
  for (const f of all) {
    const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
    assert.equal(r.status, 0, `${f}: ${r.stderr}`);
  }
});

test("the rules the fixtures are about were used, and logged with sites", () => {
  const R = report.rules;
  for (const id of ["edit.arrow", "edit.int-div", "edit.unsigned-wrap", "edit.cast-int", "goto.forward", "goto.backward",
    "goto.reentry", "decl.stack-var", "decl.stack-array", "decl.stack-struct", "edit.struct-assign", "edit.deref-byte",
    "edit.deref-ref", "macro.call", "macro.const", "edit.char-literal", "edit.op64", "edit.bool-value"]) {
    assert.ok(R[id] && R[id].count > 0, `rule ${id} unused`);
    assert.ok(R[id].sites.length > 0, `rule ${id} has no sites`);
  }
  assert.ok(report.rejected["impure-arg-with-impure-body"] >= 1, "rn1(10, rn2(3)) must expand");
  const ms = fs.readFileSync(path.join(out, "src/macros.js"), "latin1");
  assert.match(ms, /let r = max\(a, b\);/);
  assert.match(ms, /let s = twice\(a \+ 1\);/);
  assert.match(ms, /let t = \(+rn2\(10\) \+ \(rn2\(3\)\)\)+;/);
  assert.match(ms, /let u = rn1\(b, 2\);/);
});

test("no fixture function returns a bare JS boolean (lint-truth)", async () => {
  const { lintText } = await import(pathToFileURL(path.join(repo, "tools/nh2js/lint-truth.mjs")).href);
  for (const f of files) {
    const js = fs.readFileSync(path.join(out, "src", f.replace(/\.c$/, ".js")), "latin1");
    assert.deepEqual(lintText(js), [], f);
  }
  // and the lint does catch one
  assert.equal(lintText("function f(a, b) { return a < b; }").length, 1);
  assert.equal(lintText("function f(a, b) { return +(a < b); }").length, 0);
});

// ---- differential: the same functions compiled natively, on the same inputs -----------------
const FNS = ["divmod", "uwrap", "narrow", "bits64", "logic", "loops", "gotos", "into_branch", "gotomix", "gotoloop", "boolidx", "arrmacro", "ubits", "gotoarr", "gotoinit", "use_out", "strings", "structs", "truthret", "truthstore", "truthfmt", "truthparen", "truthcomma"];
// full-range inputs where the C is defined for all ints; 15-bit inputs where it does signed arithmetic
const SMALL = new Set(["arrmacro", "divmod", "narrow", "use_out", "structs", "strings", "loops", "truthparen"]);
const N = 4000;

for (const [label, dir] of [["sugar", out], ["fallback", outFb]])
test(`emitted JS (${label}) computes what the native C computes`, async (t) => {
  const clang = fs.existsSync("/usr/bin/clang") ? "/usr/bin/clang" : "clang";
  const driver = path.join(out, "driver.c");
  fs.writeFileSync(driver, `#include <stdio.h>
#include "${path.join(tree, "src/rng.c")}"
#include "${path.join(tree, "src/arith.c")}"
#include "${path.join(tree, "src/ptrs.c")}"
#include "${path.join(tree, "src/truth.c")}"
int main(void) {
  unsigned s = 1;
  for (int i = 0; i < ${N}; i++) {
    int a, b;
    s = s * 1664525u + 1013904223u; a = (int) s >> (i % 24);
    s = s * 1664525u + 1013904223u; b = (int) s >> (i % 28);
${FNS.map((f) => SMALL.has(f) ? `    printf("%lld\\n", (long long) ${f}(a >> 16, b >> 16));` : `    printf("%lld\\n", (long long) ${f}(a, b));`).join("\n")}
  }
  return 0;
}
`);
  const exe = path.join(out, "driver");
  const cc = spawnSync(clang, ["-O0", "-w", `-I${path.join(tree, "include")}`, driver, "-o", exe], { encoding: "utf8" });
  if (cc.status !== 0) { t.skip("no native compiler: " + cc.stderr.slice(0, 200)); return; }
  const native = spawnSync(exe, [], { encoding: "utf8", maxBuffer: 1 << 26 }).stdout.trim().split("\n");
  // the runtime on its own heap, rn2 from the same LCG
  const heap = await import(pathToFileURL(path.join(repo, "js/rt/heap.js")).href);
  heap.attach_heap(new ArrayBuffer(16 << 20), { stackTop: 8 << 20 });
  // sprintf("%d...") of the C library (the residue): formats each argument as JS would print it,
  // so a JS boolean argument shows as "true" and differs from the C
  heap.machine.libc = (name, args) => {
    if (name !== "sprintf") throw new Error("unexpected residue call " + name);
    let fmt = "", p = args[1];
    while (heap.uchars[p]) fmt += String.fromCharCode(heap.uchars[p++]);
    let k = 2;
    const text = fmt.replace(/%d/g, () => String(args[k++]));
    for (let i = 0; i < text.length; i++) heap.uchars[args[0] + i] = text.charCodeAt(i);
    heap.uchars[args[0] + text.length] = 0;
    return text.length;
  };
  const A = await import(pathToFileURL(path.join(dir, "src/arith.js")).href);
  const P = await import(pathToFileURL(path.join(dir, "src/ptrs.js")).href);
  const TR = await import(pathToFileURL(path.join(dir, "src/truth.js")).href);
  const fns = { ...A, ...P, ...TR };
  let s = 1, k = 0, bad = 0;
  for (let i = 0; i < N; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const a = (s | 0) >> (i % 24);
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0; const b = (s | 0) >> (i % 28);
    for (const f of FNS) {
      const want = native[k++];
      // (a C int result is a JS number: a JS boolean here is a bug)
      const got = SMALL.has(f) ? fns[f](a >> 16, b >> 16) : fns[f](a, b);
      if (typeof got !== "number" || String(got) !== want) { bad++; if (bad < 10) console.log(`${f}(${a}, ${b}) JS=${got} C=${want}`); }
    }
  }
  assert.equal(bad, 0, `${bad} of ${k} results differ`);
});
