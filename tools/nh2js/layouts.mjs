#!/usr/bin/env node
// layouts.mjs --src <prepared-src> <out.json> [file.c ...]: the compiler's wasm32 record layouts
// keyed by JS class name ({size, fields: [{name, bitoff}]}), to check js/ struct declarations
// against (rt/struct.js check_layouts returns the differences).
import fs from "node:fs";
import { loadTU } from "./frontend.mjs";
import { cFiles } from "./lib/index.mjs";
import { recordClassName } from "./lib/emit.mjs";
const argv = process.argv.slice(2);
const src = argv[argv.indexOf("--src") + 1];
const rest = argv.filter((a, i) => a !== "--src" && argv[i - 1] !== "--src");
const [out, ...files] = rest;
const recs = {};
for (const f of files.length ? files : cFiles(src)) {
  const tu = loadTU(src, f);
  for (const r of tu.records) {
    const cls = recordClassName(r);
    if (recs[cls] || /^__anon/.test(cls)) continue;
    recs[cls] = {
      size: r.size,
      fields: r.fields.filter((x) => x.name).map((x) => ({ name: x.name, bitoff: x.bitoff })),
    };
  }
}
fs.writeFileSync(out, JSON.stringify(recs));
console.log("layouts:", Object.keys(recs).length, "records");
