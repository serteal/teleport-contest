// The record sizes shown by wizard-mode #stats.
//
// #stats reports sizeof of NetHack's records as a 64-bit build lays them out (64-bit long and
// pointers), not as the wasm32 layout the game itself uses.  They are measured with the host
// clang (-m64) on the prepared headers and written to include/nhjs_struct_sizes.h as
// NHJS_SIZEOF_<name>; the sizeof expressions of the #stats code then read NHJS_SIZEOF(<name>).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheRoot } from "./c2js.config.mjs";
import { run } from "./run.mjs";

// [name, C type]
const measuredTypes = [
  ["struct_obj", "struct obj"],
  ["struct_oextra", "struct oextra"],
  ["struct_monst", "struct monst"],
  ["struct_mextra", "struct mextra"],
  ["struct_egd", "struct egd"],
  ["struct_epri", "struct epri"],
  ["struct_eshk", "struct eshk"],
  ["struct_emin", "struct emin"],
  ["struct_edog", "struct edog"],
  ["struct_ebones", "struct ebones"],
  ["struct_wseg", "struct wseg"],
  ["struct_trap", "struct trap"],
  ["struct_damage", "struct damage"],
  ["struct_kinfo", "struct kinfo"],
  ["struct_cemetery", "struct cemetery"],
  ["struct_engr", "struct engr"],
  ["mapseen", "mapseen"],
  ["light_source", "light_source"],
  ["timer_element", "timer_element"],
  ["NhRegion", "NhRegion"],
  ["NhRect", "NhRect"],
];

// [file, [[sizeof expression, replacement]...]]: the sizeof expressions of the #stats code
const statsSites = [
  ["src/wizcmds.c", [
    ["sizeof (struct obj)", "NHJS_SIZEOF(struct_obj)"],
    ["sizeof (struct oextra)", "NHJS_SIZEOF(struct_oextra)"],
    ["sizeof (struct monst)", "NHJS_SIZEOF(struct_monst)"],
    ["sizeof (struct mextra)", "NHJS_SIZEOF(struct_mextra)"],
    ["sizeof (struct egd)", "NHJS_SIZEOF(struct_egd)"],
    ["sizeof (struct epri)", "NHJS_SIZEOF(struct_epri)"],
    ["sizeof (struct eshk)", "NHJS_SIZEOF(struct_eshk)"],
    ["sizeof (struct emin)", "NHJS_SIZEOF(struct_emin)"],
    ["sizeof (struct edog)", "NHJS_SIZEOF(struct_edog)"],
    ["sizeof (struct ebones)", "NHJS_SIZEOF(struct_ebones)"],
    ["sizeof *tt", "NHJS_SIZEOF(struct_trap)"],
    ["sizeof (struct trap)", "NHJS_SIZEOF(struct_trap)"],
    ["sizeof *sd", "NHJS_SIZEOF(struct_damage)"],
    ["sizeof (struct damage)", "NHJS_SIZEOF(struct_damage)"],
    ["sizeof *k;", "NHJS_SIZEOF(struct_kinfo);"],
    ["sizeof (struct kinfo)", "NHJS_SIZEOF(struct_kinfo)"],
    ["sizeof *bi", "NHJS_SIZEOF(struct_cemetery)"],
    ["sizeof (struct cemetery)", "NHJS_SIZEOF(struct_cemetery)"],
  ]],
  ["src/dungeon.c", [
    ["sizeof *mptr", "NHJS_SIZEOF(mapseen)"],
    ["sizeof *ce", "NHJS_SIZEOF(struct_cemetery)"],
    ["(long long) sizeof (mapseen)", "(long long) NHJS_SIZEOF(mapseen)"],
    ["(long long) sizeof (struct cemetery)", "(long long) NHJS_SIZEOF(struct_cemetery)"],
  ]],
  ["src/light.c", [
    ["(long long) sizeof (light_source)", "(long long) NHJS_SIZEOF(light_source)"],
    ["(long long) sizeof *ls", "(long long) NHJS_SIZEOF(light_source)"],
  ]],
  ["src/timeout.c", [
    ["(long long) sizeof (timer_element)", "(long long) NHJS_SIZEOF(timer_element)"],
    ["(long long) sizeof *te", "(long long) NHJS_SIZEOF(timer_element)"],
  ]],
  ["src/region.c", [
    ["(long long) sizeof (NhRegion)", "(long long) NHJS_SIZEOF(NhRegion)"],
    ["(long long) sizeof (NhRect)", "(long long) NHJS_SIZEOF(NhRect)"],
  ]],
  ["src/engrave.c", [
    ["(long long) sizeof (struct engr)", "(long long) NHJS_SIZEOF(struct_engr)"],
    ["(long long) sizeof *ep", "(long long) NHJS_SIZEOF(struct_engr)"],
  ]],
  ["src/worm.c", [
    ["count_wsegs(worm) * sizeof (struct wseg)", "count_wsegs(worm) * NHJS_SIZEOF(struct_wseg)"],
  ]],
];

// The #stats functions: the same sizeof expressions elsewhere size real allocations.
const statsFunctions = [
  "size_obj", "size_monst", "count_obj", "obj_chain", "mon_invent_chain", "contained_stats",
  "mon_chain", "misc_stats", "wiz_show_stats", "overview_stats", "light_stats", "timer_stats",
  "region_stats", "engr_stats", "size_wseg",
];
const statsFunctionStart = new RegExp(`^(${statsFunctions.join("|")})\\(`);

/** The probe program: prints one #define per measured type. */
function probeSource(root) {
  // struct wseg is private to worm.c
  const wseg = readFileSync(join(root, "src/worm.c"), "utf8").match(/^struct wseg \{[\s\S]*?^\};/m)[0];
  const prints = measuredTypes.map(
    ([name, type]) => `    printf("#define NHJS_SIZEOF_${name} %zu\\n", sizeof (${type}));`,
  );
  return [
    '#include "hack.h"',
    "#include <stdio.h>",
    "",
    wseg,
    "",
    "int",
    "main(void)",
    "{",
    ...prints,
    "    return 0;",
    "}",
    "",
  ].join("\n");
}

/** Measures the record sizes and writes include/nhjs_struct_sizes.h into the tree at `root`. */
function writeSizesHeader(root) {
  const probeDir = join(cacheRoot, "struct-sizes");
  const source = join(probeDir, "sizes.c");
  const binary = join(probeDir, "sizes");
  mkdirSync(probeDir, { recursive: true });
  writeFileSync(source, probeSource(root));
  run("clang", ["-m64", `-I${join(root, "include")}`, "-DNOTPARMDECL", "-w", "-o", binary, source]);
  const defines = run(binary, [], { capture: true });
  const header = [
    "/* generated by tools/c2js/struct-sizes.mjs: the record sizes of a 64-bit build",
    "   (64-bit long and pointers), shown by wizard-mode #stats */",
    "#ifndef NHJS_STRUCT_SIZES_H",
    "#define NHJS_STRUCT_SIZES_H",
    `${defines}#define NHJS_SIZEOF(name) ((size_t) NHJS_SIZEOF_##name)`,
    "#endif",
    "",
  ];
  writeFileSync(join(root, "include/nhjs_struct_sizes.h"), header.join("\n"));
}

/** `text` with the sizeof expressions of its #stats functions replaced (`edits`). */
function replaceStatsSizes(text, edits, file) {
  const lines = text.split("\n");
  let inStats = false;
  let hits = 0;
  for (let i = 0; i < lines.length; i++) {
    if (statsFunctionStart.test(lines[i])) inStats = true;
    else if (/^[A-Za-z_]\w*\(/.test(lines[i])) inStats = false;
    if (!inStats) continue;
    for (const [from, to] of edits) {
      if (!lines[i].includes(from)) continue;
      lines[i] = lines[i].split(from).join(to);
      hits++;
    }
  }
  if (!hits) throw new Error(`#stats sizes: no sizeof expression found in ${file}`);
  return lines.join("\n").replace(/#include "hack.h"[^\n]*\n/, (m) => `${m}#include "nhjs_struct_sizes.h"\n`);
}

/** Makes wizard-mode #stats of the configured tree at `root` show 64-bit record sizes. */
export function applyStructSizes(root) {
  writeSizesHeader(root);
  for (const [file, edits] of statsSites) {
    const path = join(root, file);
    writeFileSync(path, replaceStatsSizes(readFileSync(path, "utf8"), edits, file));
  }
}
