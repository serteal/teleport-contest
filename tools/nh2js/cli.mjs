#!/usr/bin/env node
// nh2js: C -> JS source rewriter for NetHack (see tools/nh2js/README.md).
//
//   node tools/nh2js/cli.mjs <file.c ...|all> [--src <prepared-src>] [--prepare] [--out js/]
//        [--headers] [--report r.json] [--manifest m.json] [--sites s.json] [--checked]
//        [--fallback] [--stats]
//
//   --src      configured, patched, long64 NetHack tree (has src/ and include/); default:
//              .cache/nh2js/c2js/nethack-port, prepared by tools/c2js (--prepare: redo it)
//   --out      output root (js/): writes the unit modules (src/<file>.js, win/tty/<file>.js, ...),
//              and with --headers the header modules src/<h>.h.js and src/<h>.h.macros.js
//   --report   JSON report: per-function mode (sugar/fallback/none + reasons), rule instances
//   --manifest where the manifest goes (default .cache/nh2js/manifest.json)
//   --sites    every rule instance as [file, line, function] (for the rule audit)
//   --checked  emit the checked build (runtime assertions for every range assumption)
//   --fallback print every function in the plain dialect
//   --stats    print line statistics (identical / token-edit / structural)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadTU, cacheDir, repoRoot, SOURCE_DATE_EPOCH } from "./frontend.mjs";
import { buildIndex, cFiles, indexPath } from "./lib/index.mjs";
import { Emitter } from "./lib/emit.mjs";
import { RuleLog } from "./lib/rules.mjs";
import { emitHeaders, emitLibc } from "./lib/headers.mjs";
import { emitDat } from "./lib/dat.mjs";
import { lineStats } from "./lib/stats.mjs";
import { layout, skippedBlocks, encodeMap } from "./lib/layout.mjs";
import { unitModule } from "./lib/units.mjs";

const USAGE = "usage: cli.mjs <file.c ...|all> --src <prepared-src> [--out js/] [--report r.json] " +
  "[--checked] [--headers] [--stats]";

/** The command line: positional files, `--name value` options and `--flag` switches. */
function parseArgs(argv) {
  const valued = new Set(["--src", "--out", "--report", "--manifest", "--sites"]);
  return {
    files: argv.filter((a, i) => !a.startsWith("--") && !valued.has(argv[i - 1])),
    opt: (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; },
    flag: (k) => argv.includes(k),
  };
}

/**
 * The default source: the tree tools/c2js prepares (patches, port transforms, long64, buffer
 * sizes), configured into nh2js's own cache with the build date pinned (SOURCE_DATE_EPOCH), so
 * the emitted text does not depend on when it was emitted. `force` re-runs the preparation.
 */
function preparedTree(force) {
  const cache = path.join(repoRoot, ".cache/nh2js/c2js");
  const tree = path.join(cache, "nethack-port");
  if (!force && fs.existsSync(path.join(tree, "include/date.h"))) return tree;
  if (force) fs.rmSync(tree, { recursive: true, force: true });
  const env = { ...process.env, NHJS_CACHE: cache, SOURCE_DATE_EPOCH };
  const lua = path.join(repoRoot, ".cache/c2js/nethack-port/lib/lua-5.4.8");
  if (!env.NHJS_LUA_DIR && fs.existsSync(path.join(lua, "src/lua.h"))) env.NHJS_LUA_DIR = lua;
  console.error(`nh2js: preparing the source tree in ${tree} (tools/c2js --configure)`);
  const r = spawnSync(process.execPath, [path.join(repoRoot, "tools/c2js/build-engine.mjs"), "--configure"],
    { cwd: repoRoot, env, encoding: "utf8" });
  if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  return tree;
}

/** Emit each C unit (one module per file); fills `run.tus`, `run.report`, `run.lineMaps`. */
function emitUnits(run) {
  const { args, srcDir, out, index, log, report, shared } = run;
  for (const f of run.list) {
    let tu;
    try { tu = loadTU(srcDir, f); } catch (e) {
      report.files.push({ file: f, error: String(e.message).slice(0, 300) });
      console.error(`${f}: front end failed`);
      continue;
    }
    const em = new Emitter(tu, index, {
      checked: args.flag("--checked"), fallback: args.flag("--fallback"), headerMods: shared.headerMods,
      records: shared.records, macros: shared.macros, libc: shared.libc,
    });
    shared.macros = em.macros;
    let text;
    try { text = em.emit(); } catch (e) {
      report.files.push({ file: f, error: String(e.stack).slice(0, 600) });
      console.error(`${f}: ${e.message}`);
      continue;
    }
    log.merge(em.log);
    run.tus.push({ tu, em });
    const fr = em.report;
    const counts = { sugar: 0, fallback: 0, none: 0 };
    for (const fn of fr.functions) counts[fn.mode]++;
    fr.counts = counts;
    report.files.push(fr);
    if (args.flag("--stats")) {
      const st = lineStats(tu.text, text);
      fr.lines = st;
      for (const k of Object.keys(run.emStats)) run.emStats[k] += st[k];
    }
    // the module as written: blank runs collapsed (lib/layout.mjs); the line map goes to the manifest
    const blocks = skippedBlocks(tu.text, tu.skipped.filter((r) => (r.f ?? 0) === 0));
    const laid = layout(text, { cLines: tu.text.split("\n").length, blocks });
    run.lineMaps[unitModule(f)] = encodeMap(laid.map);
    if (out) {
      const p = path.join(out, unitModule(f));
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, laid.text, "latin1");
    }
    console.error(`${f}: ${counts.sugar} sugar, ${counts.fallback} fallback, ${counts.none} not emitted`);
  }
}

/** The header modules, js/libc/records.js and (for `all`) the game data js/dat/. */
function emitHeadersAndData(run) {
  const { args, srcDir, out, log, report, shared } = run;
  if (args.flag("--headers") && out && run.tus.length) {
    const hrep = emitHeaders(run.tus, shared, out, log);
    const lm = emitLibc(shared, out, log);
    if (lm) hrep.modules.push(lm);
    report.headers = hrep;
  }
  if (out && run.all) {
    report.dat = emitDat(srcDir, out);
    console.error(`dat: ${report.dat} data files`);
  }
}

/**
 * The manifest for loaders and tools (emitted modules, header modules, functions not emitted,
 * load order, line maps) and, for `all`, js/modules.js.
 */
function writeManifest(run) {
  const { args, srcDir, out, report, tus } = run;
  const notEmitted = [];
  for (const f of report.files) for (const fn of f.functions || []) if (fn.mode === "none") notEmitted.push(fn.name);
  const headerModules = report.headers?.modules || [];
  const typeModules = headerModules.filter((m) => !m.endsWith(".macros.js"));
  const unitModules = tus.map(({ tu }) => unitModule(tu.file));
  const manifest = {
    modules: unitModules,
    headers: typeModules,
    notEmitted,
    // evaluate in this order: the types layer (header modules, libc/records.js) before any module
    // whose top-level code reads it (js/modules.js imports them first)
    loadOrder: [
      ...[...typeModules].sort(),
      ...unitModules,
      ...headerModules.filter((m) => m.endsWith(".macros.js")).sort(),
      ...(report.dat ? ["dat/index.js"] : []),
    ],
    index: indexPath(srcDir),
    // where each line of an emitted unit module comes from (lib/layout.mjs encodeMap)
    lineMaps: run.lineMaps,
    functions: Object.fromEntries(report.files.filter((f) => f.functions)
      .map((f) => [unitModule(f.file), f.functions.map((fn) => fn.name)])),
  };
  // js/modules.js: every emitted module as a side-effect import, in load order (the game has
  // no manifest: importing this file evaluates the types layer first)
  if (run.all) {
    const body = ["// js/modules.js: the emitted game, in evaluation order (types layer first). " +
      "Emitted by tools/nh2js.", ""].concat(manifest.loadOrder.map((m) => `import "./${m}";`));
    fs.writeFileSync(path.join(out, "modules.js"), body.join("\n") + "\n", "latin1");
  }
  // (a development artifact: kept out of js/)
  const mpath = args.opt("--manifest", path.join(cacheDir, "manifest.json"));
  fs.mkdirSync(path.dirname(mpath), { recursive: true });
  fs.writeFileSync(mpath, JSON.stringify(manifest, null, 1));
}

/** The JSON report (--report), the rule sites (--sites) and the line statistics (--stats). */
function writeReport(run) {
  const { args, log, report, shared } = run;
  const macros = shared.macros;
  if (macros) {
    for (const [k, d] of macros.defs) report.macros[k] = { header: d.header, kind: d.kind, sites: d.sites };
    report.rejected = Object.fromEntries(macros.rejected);
    report.rejectedBy = Object.fromEntries([...macros.rejectedBy].sort((a, b) => b[1] - a[1]));
    report.macroConflicts = Object.fromEntries(macros.conflicts);
    report.variantBodies = Object.fromEntries(macros.variantBodies || []);
    // C library constants kept by name (rt/libc.js must export them): name -> value
    report.libcConsts = Object.fromEntries([...(macros.libcConsts || [])].sort());
  }
  report.rules = log.toJSON();
  if (args.flag("--stats")) report.lineStats = run.emStats;
  if (args.opt("--report")) fs.writeFileSync(args.opt("--report"), JSON.stringify(report, null, 1));
  // --sites f.json: every rule instance as [file, line, function] (uncapped; for the rule audit)
  if (args.opt("--sites")) fs.writeFileSync(args.opt("--sites"), JSON.stringify(log.allSites()));
  if (args.flag("--stats")) console.error("lines:", JSON.stringify(run.emStats));
}

function main(argv) {
  const args = parseArgs(argv);
  const srcDir = args.opt("--src") || preparedTree(args.flag("--prepare"));
  if (!srcDir || !args.files.length) {
    console.error(USAGE);
    process.exit(2);
  }
  const all = args.files.includes("all");
  const run = {
    args,
    srcDir,
    all,
    out: args.opt("--out"),
    list: all ? cFiles(srcDir) : args.files,
    index: buildIndex(srcDir),
    log: new RuleLog(),
    report: { files: [], macros: {}, rejected: {} },
    shared: {
      headerMods: new Map(),
      records: new Map(),
      macros: null,
      libc: { records: new Map(), typedefs: new Map() },
    },
    tus: [],
    lineMaps: {}, // module -> line map runs [jsLine, cLine, count] (0-based)
    emStats: { identical: 0, token: 0, structural: 0, blank: 0, total: 0 },
  };
  emitUnits(run);
  emitHeadersAndData(run);
  if (run.out) writeManifest(run);
  writeReport(run);
}

main(process.argv.slice(2));
