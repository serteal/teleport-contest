// Whole-tree checks of REPO/js against the prepared source (node --test): skipped when the
// prepared tree (.cache/nh2js/c2js) is absent.
//  - the line map (emission manifest, lib/layout.mjs): every emitted unit module has one, its
//    C lines increase down the module
//  - baked numbers (tools/nh2js/lint-numbers.mjs): numbers on an emitted line that its C line
//    does not write. None may come from a position (__LINE__ in nh_snprintf/assert calls);
//    the rest (macro bodies expanded at the site, written extents) stay under a budget.
//  - js/dat matches dat/ byte for byte.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = path.join(repo, ".cache/nh2js/c2js/nethack-port");
const have = fs.existsSync(path.join(src, "src/allmain.c")) && fs.existsSync(path.join(repo, "js/src/allmain.js"));
const units = have ? (await import(pathToFileURL(path.join(repo, "tools/nh2js/lib/units.mjs")).href)) : null;

const manifestPath = path.join(repo, ".cache/nh2js/manifest.json");
test("every emitted unit has a line map to its C file", { skip: (!have || !fs.existsSync(manifestPath)) && "no prepared tree or manifest" }, async () => {
  const { decodeMap } = await import(pathToFileURL(path.join(repo, "tools/nh2js/lib/layout.mjs")).href);
  const maps = JSON.parse(fs.readFileSync(manifestPath, "utf8")).lineMaps || {};
  const bad = [];
  for (const u of units.allUnits(src)) {
    const C = fs.readFileSync(units.unitPath(src, u), "latin1").split("\n");
    const p = path.join(repo, "js", units.unitModule(u));
    if (!fs.existsSync(p)) { bad.push(`${u}: not emitted`); continue; }
    const J = fs.readFileSync(p, "latin1").split("\n");
    if (!maps[units.unitModule(u)]) { bad.push(`${u}: no line map`); continue; }
    const map = decodeMap(maps[units.unitModule(u)], J.length);
    let last = -1;
    map.forEach((c, j) => {
      if (c < 0) return;
      if (c <= last || c >= C.length) bad.push(`${u}: JS line ${j + 1} -> C line ${c + 1}`);
      last = c;
    });
  }
  assert.deepEqual(bad.slice(0, 20), []);
});

test("no position-derived numbers; baked numbers under budget", { skip: !have && "no prepared tree" }, async () => {
  const { lint } = await import(pathToFileURL(path.join(repo, "tools/nh2js/lint-numbers.mjs")).href);
  const f = lint();
  const positional = f.filter((x) => /nh_snprintf\(|__assert_fail|FITSu?int_\(|Strlen_\(/.test(x.js));
  assert.deepEqual(positional.slice(0, 10), []);
  assert.ok(f.length <= 450, `${f.length} baked numbers (budget 450)`);
});

// (a Lua file's comment-only lines are empty in the string: their text is a JS comment)
test("js/dat is dat/ byte for byte (Lua comment-only lines empty)", { skip: !have && "no prepared tree" }, async () => {
  const { dataFiles } = await import(pathToFileURL(path.join(repo, "js/dat/index.js")).href);
  const { packable, datText } = await import(pathToFileURL(path.join(repo, "tools/nh2js/lib/dat.mjs")).href);
  const names = fs.readdirSync(path.join(src, "dat")).filter((n) => packable(n) && fs.statSync(path.join(src, "dat", n)).isFile()).sort();
  const js = new Map(dataFiles());
  assert.equal(js.size, names.length);
  for (const n of names) {
    const b = fs.readFileSync(path.join(src, "dat", n));
    const t = js.get("/" + n), want = datText(n, b);
    assert.equal(t.length, want.length, n);
    if (t !== want) assert.fail(`${n} differs`);
    if (!n.endsWith(".lua")) for (let i = 0; i < b.length; i++) if (t.charCodeAt(i) !== b[i]) assert.fail(`${n} byte ${i}`);
    // line for line with the file
    assert.equal(fs.readFileSync(path.join(repo, "js/dat", n + ".js"), "latin1").split("\n").length >= b.toString("latin1").split("\n").length, true, n);
  }
});

// a local the goto dispatcher allocates at function start (`var x = stack_var(T)` on
// the frame line) must never be declared again in that function (`var x = x[0] = 0` rebinds it)
test("hoisted locals are declared once per function", { skip: !have && "no prepared tree" }, () => {
  const bad = [];
  for (const u of units.allUnits(src)) {
    const p = path.join(repo, "js", units.unitModule(u));
    if (!fs.existsSync(p)) continue;
    const lines = fs.readFileSync(p, "latin1").split("\n");
    let hoisted = null;
    lines.forEach((l, i) => {
      if (/^(export )?function\b/.test(l)) hoisted = null;
      const m = /let \$goto = null[^;]*; var ([^;]*);/.exec(l);
      if (m) { hoisted = new Set(m[1].split(/,\s*(?=[\w$]+ = )/).map((x) => x.split("=")[0].trim())); return; }
      if (!hoisted) return;
      for (const d of l.matchAll(/\b(?:var|let|const)\s+([\w$]+)/g)) if (hoisted.has(d[1])) bad.push(`${units.unitModule(u)}:${i + 1}: ${d[1]}`);
      for (const d of l.matchAll(/\bvar\s+([\w$]+)\s*=\s*\1\[0\]/g)) bad.push(`${units.unitModule(u)}:${i + 1}: ${d[1]} (self)`);
    });
  }
  assert.deepEqual(bad.slice(0, 20), []);
});

// a C truth value (comparison, !, && / ||) is returned as 0/1, never as a JS boolean
test("no function returns a bare JS boolean (C truth values are 0/1)", { skip: !have && "no prepared tree" }, async () => {
  const { lintText } = await import(pathToFileURL(path.join(repo, "tools/nh2js/lint-truth.mjs")).href);
  const bad = [];
  for (const u of units.allUnits(src)) {
    const p = path.join(repo, "js", units.unitModule(u));
    if (!fs.existsSync(p)) continue;
    for (const x of lintText(fs.readFileSync(p, "latin1"))) bad.push(`${units.unitModule(u)}:${x.line}: ${x.text}`);
  }
  for (const f of fs.readdirSync(path.join(repo, "js/src")).filter((f) => /\.h\.macros\.js$/.test(f)))
    for (const x of lintText(fs.readFileSync(path.join(repo, "js/src", f), "latin1"))) bad.push(`src/${f}:${x.line}: ${x.text}`);
  assert.deepEqual(bad.slice(0, 20), []);
});
