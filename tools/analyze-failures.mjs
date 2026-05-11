#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSession } from "../frozen/session_loader.mjs";
import {
  COLS_80,
  ROWS_24,
  decodeScreen,
  diffCell,
  renderCell,
} from "../frozen/screen-decode.mjs";
import { runSegment } from "../js/jsmain.js";
import {
  canonicalizeTerminalScreen,
  normalizeTerminalVariants,
} from "../js/terminal-canonical.js";
import { projectRoot } from "./c2js/c2js.config.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultSessionsDir = join(projectRoot, "sessions");

function usage() {
  return `Usage: node ${scriptPath} [--json] [--limit=N] [session-file-or-dir ...]`;
}

function isRngCall(entry) {
  return (
    typeof entry === "string" && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry)
  );
}

function normalizeRng(entry) {
  return String(entry || "")
    .replace(/\s*@\s.*$/, "")
    .replace(/^\d+\s+/, "")
    .trim();
}

function extractRngCalls(rngArray) {
  return (rngArray || []).filter(isRngCall).map(normalizeRng);
}

function preDecode(s) {
  return canonicalizeTerminalScreen(normalizeTerminalVariants(s));
}

function cursorEqual(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a[0] === b[0] &&
    a[1] === b[1] &&
    (a[2] ?? 1) === (b[2] ?? 1)
  );
}

function cellState(cell) {
  return {
    ch: cell.ch,
    rendered: renderCell(cell),
    color: cell.color,
    attr: cell.attr,
    decgfx: cell.decgfx,
  };
}

function renderedLine(grid, row) {
  return grid[row].map(renderCell).join("").replace(/ +$/, "");
}

function colorLine(grid, row) {
  return grid[row]
    .map((cell) => {
      if (renderCell(cell) !== " ") return String(cell.color).slice(-1);
      return cell.color === 8 && !cell.attr
        ? " "
        : String(cell.color).slice(-1);
    })
    .join("")
    .replace(/ +$/, "");
}

function attrLine(grid, row) {
  return grid[row]
    .map((cell) => {
      if (renderCell(cell) === " " && !cell.attr) return " ";
      if (!cell.attr) return ".";
      return cell.attr.toString(16);
    })
    .join("")
    .replace(/ +$/, "");
}

function rawLine(screen, row) {
  return String(screen || "").split("\n")[row] || "";
}

function summarizeScreenDiff(cScreen, jsScreen, cCursor, jsCursor) {
  const cGrid = decodeScreen(preDecode(cScreen));
  const jsGrid = decodeScreen(preDecode(jsScreen));
  const counts = {
    char: 0,
    color: 0,
    attr: 0,
    decgfx: 0,
    cell: 0,
    cursor: cursorEqual(cCursor, jsCursor) ? 0 : 1,
  };
  const rows = new Set();
  let first = null;

  for (let row = 0; row < ROWS_24; row++) {
    for (let col = 0; col < COLS_80; col++) {
      const c = cGrid[row][col];
      const j = jsGrid[row][col];
      const diff = diffCell(j, c);
      if (!diff) continue;
      rows.add(row);
      counts.cell++;
      if (renderCell(c) !== renderCell(j)) counts.char++;
      else {
        if (c.color !== j.color) counts.color++;
        if (c.attr !== j.attr) counts.attr++;
        if (c.decgfx !== j.decgfx) counts.decgfx++;
      }
      first ??= { row, col, kind: diff, c: cellState(c), js: cellState(j) };
    }
  }

  const rowList = [...rows].sort((a, b) => a - b);
  const detailRows = [
    ...new Set(
      [first?.row, ...rowList.slice(0, 3), 0, 22, 23].filter(
        (row) => row !== undefined && row >= 0 && row < ROWS_24,
      ),
    ),
  ];

  return {
    counts,
    first,
    rows: rowList,
    cursors: { c: cCursor || null, js: jsCursor || null },
    samples: detailRows.map((row) => ({
      row,
      cText: renderedLine(cGrid, row),
      jsText: renderedLine(jsGrid, row),
      cColor: colorLine(cGrid, row),
      jsColor: colorLine(jsGrid, row),
      cAttr: attrLine(cGrid, row),
      jsAttr: attrLine(jsGrid, row),
      cRaw: rawLine(cScreen, row),
      jsRaw: rawLine(jsScreen, row),
    })),
  };
}

function visualScreensEqual(cScreen, jsScreen) {
  return summarizeScreenDiff(cScreen, jsScreen, null, null).counts.cell === 0;
}

function resolveSessionFiles(targets) {
  const files = [];
  for (const target of targets) {
    const path = target.startsWith("/") ? target : join(projectRoot, target);
    if (!existsSync(path)) throw new Error(`Not found: ${target}`);
    const st = statSync(path);
    if (st.isFile() && path.endsWith(".session.json")) {
      files.push(path);
    } else if (st.isDirectory()) {
      for (const entry of readdirSync(path)) {
        const child = join(path, entry);
        if (entry.endsWith(".session.json") && statSync(child).isFile())
          files.push(child);
      }
    }
  }
  return [...new Set(files)].sort();
}

function replayInputFor(segment) {
  return {
    seed: segment.seed,
    datetime: segment.datetime,
    nethackrc: segment.nethackrc,
    moves: segment.moves,
  };
}

function createStorageHandle() {
  const storage = new Map();
  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
    get length() {
      return storage.size;
    },
    key(index) {
      let n = 0;
      for (const key of storage.keys()) {
        if (n === index) return key;
        n++;
      }
      return null;
    },
  };
}

function flattenCanonical(segments) {
  const rng = [];
  const screens = [];
  const cursors = [];
  const screenSteps = [];
  const rngSteps = [];

  segments.forEach((seg, segmentIndex) => {
    (seg.steps || []).forEach((step, stepIndex) => {
      const calls = extractRngCalls(step.rng);
      for (const call of calls) {
        rngSteps.push({ segmentIndex, stepIndex, screenIndex: screens.length });
        rng.push(call);
      }
      if (step.screen) {
        screens.push(step.screen);
        cursors.push(step.cursor || [0, 0, 1]);
        screenSteps.push({
          segmentIndex,
          stepIndex,
          key: step.key ?? seg.moves?.[stepIndex] ?? null,
        });
      }
    });
  });

  return { rng, screens, cursors, screenSteps, rngSteps };
}

function firstRngMismatch(cRng, jsRng, rngSteps) {
  const total = cRng.length;
  let matched = 0;
  for (let i = 0; i < total; i++) {
    if (cRng[i] === normalizeRng(jsRng[i])) {
      matched++;
      continue;
    }
    return {
      matched,
      total,
      first: {
        index: i,
        c: cRng[i] || null,
        js: normalizeRng(jsRng[i]) || null,
        step: rngSteps[i] || null,
      },
    };
  }
  return {
    matched,
    total,
    first:
      jsRng.length > total
        ? {
            index: total,
            c: null,
            js: normalizeRng(jsRng[total]),
            step: rngSteps[total] || null,
          }
        : null,
  };
}

function screenMetrics(cScreens, jsScreens) {
  const total = cScreens.length;
  let matched = 0;
  for (let i = 0; i < total; i++) {
    if (visualScreensEqual(cScreens[i] || "", jsScreens[i] || "")) matched++;
  }
  return { matched, total };
}

function firstScreenMismatch(c, jsScreens, jsCursors) {
  for (let i = 0; i < c.screens.length; i++) {
    const cScreen = c.screens[i] || "";
    const jsScreen = jsScreens[i] || "";
    const screenDiff = summarizeScreenDiff(
      cScreen,
      jsScreen,
      c.cursors[i],
      jsCursors[i],
    );
    if (screenDiff.counts.cell || screenDiff.counts.cursor) {
      return {
        index: i,
        step: c.screenSteps[i] || null,
        diff: screenDiff,
      };
    }
  }
  if (jsScreens.length > c.screens.length) {
    return {
      index: c.screens.length,
      step: null,
      diff: {
        counts: { char: 0, color: 0, attr: 0, decgfx: 0, cell: 0, cursor: 0 },
        first: null,
        rows: [],
        cursors: { c: null, js: jsCursors[c.screens.length] || null },
        samples: [],
        extraJsScreen: true,
      },
    };
  }
  return null;
}

function classify(result) {
  if (result.error) return "runtime-error";
  if (result.rng.first) return "rng-divergence";
  const first = result.screen.first;
  if (!first) return "pass";
  const counts = first.diff.counts;
  if (counts.cell === 0 && counts.cursor) return "cursor-only";
  if (
    counts.char === 0 &&
    counts.decgfx === 0 &&
    counts.color > 0 &&
    counts.attr === 0
  ) {
    return "screen-color-only";
  }
  if (
    counts.char === 0 &&
    counts.decgfx === 0 &&
    counts.attr > 0 &&
    counts.color === 0
  ) {
    return "screen-attr-only";
  }
  if (
    counts.char === 0 &&
    counts.decgfx === 0 &&
    (counts.color > 0 || counts.attr > 0)
  ) {
    return "screen-style-only";
  }
  if (counts.char > 0) return "screen-char";
  return "screen-other";
}

async function analyzeSession(sessionPath) {
  const data = JSON.parse(readFileSync(sessionPath, "utf8"));
  const segments = normalizeSession(data).segments;
  const c = flattenCanonical(segments);

  const storage = createStorageHandle();
  const jsRng = [];
  const jsScreens = [];
  const jsCursors = [];
  let error = null;
  try {
    for (const segment of segments) {
      const game = await runSegment({ ...replayInputFor(segment), storage });
      jsRng.push(
        ...(game?.getRngLog?.() || []).map(normalizeRng).filter(isRngCall),
      );
      jsScreens.push(...(game?.getScreens?.() || []));
      jsCursors.push(...(game?.getCursors?.() || []));
    }
  } catch (caught) {
    error = caught?.message || String(caught);
  }

  const result = {
    session: basename(sessionPath),
    path: sessionPath,
    error,
    rng: firstRngMismatch(c.rng, jsRng, c.rngSteps),
    screen: {
      metrics: screenMetrics(c.screens, jsScreens),
      counts: { c: c.screens.length, js: jsScreens.length },
      first: firstScreenMismatch(c, jsScreens, jsCursors),
    },
  };
  result.classification = classify(result);
  result.passed =
    !error &&
    !result.rng.first &&
    result.rng.matched === result.rng.total &&
    result.screen.metrics.matched === result.screen.metrics.total;
  return result;
}

function compactSample(sample) {
  return {
    row: sample.row,
    cText: sample.cText,
    jsText: sample.jsText,
    cColor: sample.cColor,
    jsColor: sample.jsColor,
    cAttr: sample.cAttr,
    jsAttr: sample.jsAttr,
  };
}

function printResult(result, limitRows) {
  const status = result.passed ? "PASS" : "FAIL";
  const rng = result.rng;
  const screen = result.screen.metrics;
  console.log(`${status} ${result.session}`);
  console.log(`  class: ${result.classification}`);
  console.log(`  rng: ${rng.matched}/${rng.total}`);
  console.log(
    `  screen: ${screen.matched}/${screen.total} (c=${result.screen.counts.c}, js=${result.screen.counts.js})`,
  );
  if (result.error) console.log(`  error: ${result.error}`);
  if (rng.first) {
    console.log(
      `  first rng mismatch #${rng.first.index}: C ${rng.first.c ?? "<missing>"} | JS ${rng.first.js ?? "<missing>"}`,
    );
    if (rng.first.step) {
      console.log(
        `    at segment ${rng.first.step.segmentIndex}, step ${rng.first.step.stepIndex}, screen ${rng.first.step.screenIndex}`,
      );
    }
  }
  if (result.screen.first) {
    const first = result.screen.first;
    const counts = first.diff.counts;
    console.log(
      `  first screen mismatch #${first.index}: cells=${counts.cell}, char=${counts.char}, color=${counts.color}, attr=${counts.attr}, decgfx=${counts.decgfx}, cursor=${counts.cursor}`,
    );
    if (first.step) {
      console.log(
        `    at segment ${first.step.segmentIndex}, step ${first.step.stepIndex}, key ${JSON.stringify(first.step.key)}`,
      );
    }
    if (first.diff.first) {
      const loc = first.diff.first;
      console.log(
        `    first cell r${loc.row} c${loc.col}: C ${JSON.stringify(loc.c)} | JS ${JSON.stringify(loc.js)}`,
      );
    }
    console.log(
      `    cursor: C ${JSON.stringify(first.diff.cursors.c)} | JS ${JSON.stringify(first.diff.cursors.js)}`,
    );
    for (const sample of first.diff.samples
      .slice(0, limitRows)
      .map(compactSample)) {
      console.log(`    row ${sample.row} C : ${JSON.stringify(sample.cText)}`);
      console.log(`    row ${sample.row} JS: ${JSON.stringify(sample.jsText)}`);
      if (sample.cColor !== sample.jsColor) {
        console.log(
          `    row ${sample.row} Cc: ${JSON.stringify(sample.cColor)}`,
        );
        console.log(
          `    row ${sample.row} Jc: ${JSON.stringify(sample.jsColor)}`,
        );
      }
      if (sample.cAttr !== sample.jsAttr) {
        console.log(
          `    row ${sample.row} Ca: ${JSON.stringify(sample.cAttr)}`,
        );
        console.log(
          `    row ${sample.row} Ja: ${JSON.stringify(sample.jsAttr)}`,
        );
      }
    }
  }
}

function summarize(results) {
  const byClass = new Map();
  for (const result of results) {
    byClass.set(
      result.classification,
      (byClass.get(result.classification) || 0) + 1,
    );
  }
  return {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    byClass: Object.fromEntries(
      [...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    ),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage());
    return;
  }

  const json = args.includes("--json");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limitRows = Math.max(
    1,
    Number(limitArg?.slice("--limit=".length) || 5),
  );
  const targets = args.filter((arg) => !arg.startsWith("--"));
  if (!targets.length) targets.push(defaultSessionsDir);

  const sessionFiles = resolveSessionFiles(targets);
  const results = [];
  for (const file of sessionFiles) {
    const result = await analyzeSession(file);
    results.push(result);
    if (!json) {
      printResult(result, limitRows);
      console.log("");
    }
  }

  const bundle = {
    timestamp: new Date().toISOString(),
    summary: summarize(results),
    results,
  };

  try {
    const advisory = join(projectRoot, ".cache/session-analysis.json");
    mkdirSync(dirname(advisory), { recursive: true });
    writeFileSync(advisory, JSON.stringify(bundle, null, 2));
  } catch (error) {
    process.stderr.write(
      `(could not write analysis cache: ${error.message})\n`,
    );
  }

  if (json) {
    console.log(JSON.stringify(bundle));
  } else {
    console.log(
      `Summary: ${bundle.summary.passed}/${bundle.summary.total} passing`,
    );
    for (const [name, count] of Object.entries(bundle.summary.byClass)) {
      console.log(`  ${name}: ${count}`);
    }
  }
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
