#!/usr/bin/env node
// lint-numbers.mjs [--src tree] [--js js/] [--manifest m.json] [--json out]: numbers in emitted
// code the C does not write.
//
// Definition: each line of js/<unit>.js is printed from one line of the C file (the line map of
// the emission manifest, lib/layout.mjs), so every numeric literal on a JS line (outside comments
// and strings) should be written on its C line. A number that is not is "baked": it came from
// somewhere else (a macro body expanded at the site, a system header, the compiler). Each finding
// is classified by where its value can come from, so the ones that matter (offsets, sizes, enum
// values, indices: position-derived) stand out. The tail of a module (lines without a C line:
// imports, header-defined functions and tables) is compared with the headers it was printed
// from: not checked here.
import fs from "node:fs";
import path from "node:path";
import { allUnits, unitPath, unitModule } from "./lib/units.mjs";
import { decodeMap } from "./lib/layout.mjs";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const here = path.dirname(new URL(import.meta.url).pathname);
const src = opt("--src", path.resolve(here, "../../.cache/nh2js/c2js/nethack-port"));
const js = opt("--js", path.resolve(here, "../../js"));
const manifest = opt("--manifest", path.resolve(here, "../../.cache/nh2js/manifest.json"));

const NUM = /(?<![\w$.])(0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)n?(?![\w$])/g;
function codeOnly(line) {
  // drop comments and string/char literals (rough, line-local)
  return line.replace(/\/\*.*?\*\/|\/\/.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, " ");
}
const norm = (t) => { const v = Number(t.replace(/n$/, "")); return Number.isFinite(v) ? v : t; };

export function lint() {
  const findings = [];
  const maps = JSON.parse(fs.readFileSync(manifest, "utf8")).lineMaps || {};
  for (const u of allUnits(src)) {
    const cPath = unitPath(src, u), jPath = path.join(js, unitModule(u));
    if (!fs.existsSync(jPath)) continue;
    const C = fs.readFileSync(cPath, "latin1").split("\n"), J = fs.readFileSync(jPath, "latin1").split("\n");
    const runs = maps[unitModule(u)];
    if (!runs) throw new Error(`${unitModule(u)}: no line map in ${manifest}`);
    const map = decodeMap(runs, J.length);
    for (let i = 0; i < J.length; i++) {
      const ci = map[i];
      if (ci < 0 || ci >= C.length) continue;
      const jn = [...codeOnly(J[i]).matchAll(NUM)].map((m) => m[1]);
      if (!jn.length) continue;
      const cn = new Set([...codeOnly(C[ci]).replace(/(\d)[uUlL]+\b/g, "$1").matchAll(NUM)].map((m) => norm(m[1])));
      for (const t of jn) {
        const v = norm(t);
        if (cn.has(v)) continue;
        // 0 and 1 come from null pointers, booleans (!!), stack_var defaults and frame code
        if (v === 0 || v === 1) continue;
        findings.push({ file: unitModule(u), line: i + 1, value: t, js: J[i].trim().slice(0, 160) });
      }
    }
  }
  return findings;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = lint();
  const byFile = new Map();
  for (const x of f) byFile.set(x.file, (byFile.get(x.file) || 0) + 1);
  const byValue = new Map();
  for (const x of f) byValue.set(x.value, (byValue.get(x.value) || 0) + 1);
  console.log(`${f.length} numbers on emitted lines that the C line does not write`);
  console.log(
    "by value:",
    [...byValue]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([v, c]) => `${v}x${c}`)
      .join(" "),
  );
  console.log("by file:", [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([v, c]) => `${v}:${c}`).join(" "));
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(f, null, 1));
}
