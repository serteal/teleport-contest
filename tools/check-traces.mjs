#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
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
const strictScorePath = join(projectRoot, "tools/strict-score.mjs");
const preloadPath = join(projectRoot, "tools/sandbox/preload.mjs");
const defaultSessionsDir = join(projectRoot, "sessions");

function usage() {
  return `Usage: node ${scriptPath} --mode competition|paranoid [options] [session-file-or-dir ...]

Modes:
  competition  Run the same sandboxed scorer used by GitHub Actions.
  paranoid     Run a stricter sandboxed checker for local bit-exact work.

Options:
  --json        Print only machine-readable JSON.
  --allow-fail  Exit 0 even when one or more sessions fail.
  -h, --help    Show this help`;
}

function isCoreRngCall(entry) {
  return (
    typeof entry === "string" && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry)
  );
}

function isDisplayRngCall(entry) {
  return typeof entry === "string" && /^~drn2\(/.test(entry);
}

function normalizeRng(entry) {
  return String(entry || "")
    .replace(/\s*@\s.*$/, "")
    .replace(/^\d+\s+/, "")
    .trim();
}

function normalizeScreenRaw(screen) {
  return canonicalizeTerminalScreen(normalizeTerminalVariants(screen));
}

function preDecode(screen) {
  return normalizeScreenRaw(screen);
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

function rawLine(screen, row) {
  return String(screen || "").split("\n")[row] || "";
}

function visibleChar(ch) {
  if (ch === "\x1b") return "ESC";
  if (ch === "\x0e") return "SO";
  if (ch === "\x0f") return "SI";
  if (ch === "\n") return "\\n";
  if (ch === "\r") return "\\r";
  if (ch < " ") return `^${String.fromCharCode(ch.charCodeAt(0) + 64)}`;
  return ch;
}

function tokenizeRaw(screen) {
  const s = normalizeScreenRaw(screen);
  const tokens = [];
  for (let i = 0; i < s.length; ) {
    const ch = s[i];
    if (ch === "\x1b" && s[i + 1] === "[") {
      const start = i;
      i += 2;
      while (i < s.length) {
        const c = s.charCodeAt(i);
        if (c >= 0x40 && c <= 0x7e) {
          i++;
          break;
        }
        i++;
      }
      const raw = s.slice(start, i);
      tokens.push({ kind: "csi", raw, text: raw.replace("\x1b", "ESC") });
      continue;
    }
    if (ch === "\n") {
      tokens.push({ kind: "nl", raw: ch, text: "\\n" });
      i++;
      continue;
    }
    if (ch === "\x0e" || ch === "\x0f") {
      tokens.push({
        kind: ch === "\x0e" ? "so" : "si",
        raw: ch,
        text: visibleChar(ch),
      });
      i++;
      continue;
    }
    const start = i;
    while (
      i < s.length &&
      s[i] !== "\x1b" &&
      s[i] !== "\n" &&
      s[i] !== "\x0e" &&
      s[i] !== "\x0f"
    ) {
      i++;
    }
    const raw = s.slice(start, i);
    tokens.push({ kind: "text", raw, text: raw });
  }
  return tokens;
}

function firstTokenMismatch(cScreen, jsScreen, radius = 4) {
  const c = tokenizeRaw(cScreen);
  const js = tokenizeRaw(jsScreen);
  const max = Math.max(c.length, js.length);
  for (let i = 0; i < max; i++) {
    if (c[i]?.raw === js[i]?.raw) continue;
    return {
      index: i,
      c: c[i] || null,
      js: js[i] || null,
      cContext: c.slice(Math.max(0, i - radius), i + radius + 1),
      jsContext: js.slice(Math.max(0, i - radius), i + radius + 1),
    };
  }
  return null;
}

function classifyScreenSurface(screen) {
  const raw = String(screen || "");
  const plain = normalizeScreenRaw(raw)
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/[\x0e\x0f]/g, "");
  const labels = [];
  const checks = [
    ["more", /--More--/],
    ["menu", /\(end\)|\(\d+ of \d+\)|Pick an object|What do you want to/],
    ["inventory", /Inventory:|You are carrying|Things that are here/],
    [
      "help",
      /Help|Long description|What do you want to look up|Specify what\?/,
    ],
    [
      "extended-command",
      /Extended command|#(?:conduct|vanquished|overview|enhance|pray|chat|ride|jump|loot|force|untrap)/,
    ],
    [
      "prompt",
      /\[[ynq]\]|Where do you want|What do you want|In what direction|Call|Name|Really/,
    ],
    ["getpos", /Move the cursor|Pick a location|Where do you want/],
    [
      "disclosure",
      /Vanquished creatures|Conduct|Final Attributes|Goodbye|possessions identified/,
    ],
    ["topten", /Top Ten|No points|You made the top ten/],
    ["death", /You die|Killed by|Do you want your possessions identified/],
    ["status", /Dlvl:|HP:|Pw:|AC:|Xp:|Exp:|T:/],
    ["hallucination", /hallucin|far out|psychedelic|trippy|freaked/],
    ["shop", /shop|zorkmid|unpaid|For you,/],
  ];
  for (const [label, pattern] of checks) {
    if (pattern.test(plain)) labels.push(label);
  }
  if (raw.includes("\x0e") || raw.includes("\x0f")) labels.push("dec-charset");
  if (/\x1b\[[0-9;]*m/.test(raw)) labels.push("sgr");
  if (/\x1b\[\d+C/.test(raw)) labels.push("rle-spaces");
  return [...new Set(labels)].sort();
}

function screenSummary(screen, cursor) {
  const grid = decodeScreen(preDecode(screen));
  return {
    labels: classifyScreenSurface(screen),
    cursor: cursor || null,
    message: renderedLine(grid, 0),
    status1: renderedLine(grid, 22),
    status2: renderedLine(grid, 23),
  };
}

function screenWindow(c, jsScreens, jsCursors, index) {
  const out = {};
  for (const [name, offset] of [
    ["prev", -1],
    ["current", 0],
    ["next", 1],
  ]) {
    const i = index + offset;
    if (i < 0 || i >= c.screens.length) continue;
    out[name] = {
      index: i,
      c: screenSummary(c.screens[i] || "", c.cursors[i] || [0, 0, 1]),
      js: screenSummary(jsScreens[i] || "", jsCursors[i] || [0, 0, 1]),
    };
  }
  return out;
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
  let first = null;
  const rows = new Set();

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
    surfaces: {
      c: classifyScreenSurface(cScreen),
      js: classifyScreenSurface(jsScreen),
    },
    firstToken: firstTokenMismatch(cScreen, jsScreen),
    samples: detailRows.map((row) => ({
      row,
      cText: renderedLine(cGrid, row),
      jsText: renderedLine(jsGrid, row),
      cRaw: rawLine(cScreen, row),
      jsRaw: rawLine(jsScreen, row),
    })),
  };
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
  const coreRng = [];
  const displayRng = [];
  const allRng = [];
  const rngSteps = [];
  const screens = [];
  const cursors = [];
  const screenSteps = [];
  const animations = [];
  let animationsRecorded = false;

  segments.forEach((segment, segmentIndex) => {
    (segment.steps || []).forEach((step, stepIndex) => {
      for (const raw of step.rng || []) {
        const entry = normalizeRng(raw);
        if (isCoreRngCall(entry)) {
          coreRng.push(entry);
          allRng.push(entry);
          rngSteps.push({ segmentIndex, stepIndex, channel: "core" });
        } else if (isDisplayRngCall(entry)) {
          displayRng.push(entry);
          allRng.push(entry);
          rngSteps.push({ segmentIndex, stepIndex, channel: "display" });
        }
      }
      if (step.screen) {
        screens.push(step.screen);
        cursors.push(step.cursor || [0, 0, 1]);
        screenSteps.push({
          segmentIndex,
          stepIndex,
          key: step.key ?? segment.moves?.[stepIndex] ?? null,
        });
      }
      if (Object.hasOwn(step, "animation_frames")) {
        animationsRecorded = true;
      }
      for (const frame of step.animation_frames || []) {
        animations.push({
          segmentIndex,
          stepIndex,
          screen: frame.screen || "",
          cursor: frame.cursor || [0, 0, 1],
          seq: frame.seq ?? null,
          anim: frame.anim ?? null,
        });
      }
    });
  });

  return {
    coreRng,
    displayRng,
    allRng,
    rngSteps,
    screens,
    cursors,
    screenSteps,
    animations,
    animationsRecorded,
  };
}

function compareSequence(c, js, steps = []) {
  const min = Math.min(c.length, js.length);
  let matched = 0;
  for (let i = 0; i < min; i++) {
    if (c[i] === js[i]) {
      matched++;
      continue;
    }
    return {
      matched,
      cTotal: c.length,
      jsTotal: js.length,
      exact: false,
      first: {
        index: i,
        c: c[i] ?? null,
        js: js[i] ?? null,
        step: steps[i] || null,
      },
    };
  }
  const exact = c.length === js.length;
  return {
    matched,
    cTotal: c.length,
    jsTotal: js.length,
    exact,
    first: exact
      ? null
      : {
          index: min,
          c: c[min] ?? null,
          js: js[min] ?? null,
          step: steps[min] || null,
        },
  };
}

function compareScreens(c, jsScreens, jsCursors) {
  const min = Math.min(c.screens.length, jsScreens.length);
  let visualMatched = 0;
  let rawMatched = 0;
  let cursorMatched = 0;
  let firstVisual = null;
  let firstRaw = null;
  let firstCursor = null;

  for (let i = 0; i < min; i++) {
    const cScreen = c.screens[i] || "";
    const jsScreen = jsScreens[i] || "";
    const cCursor = c.cursors[i] || [0, 0, 1];
    const jsCursor = jsCursors[i] || [0, 0, 1];
    const diff = summarizeScreenDiff(cScreen, jsScreen, cCursor, jsCursor);
    if (diff.counts.cell === 0) visualMatched++;
    else
      firstVisual ??= {
        index: i,
        step: c.screenSteps[i] || null,
        diff: {
          ...diff,
          window: screenWindow(c, jsScreens, jsCursors, i),
        },
      };

    if (normalizeScreenRaw(cScreen) === normalizeScreenRaw(jsScreen))
      rawMatched++;
    else if (!firstRaw) {
      firstRaw = {
        index: i,
        step: c.screenSteps[i] || null,
        cPrefix: normalizeScreenRaw(cScreen).slice(0, 240),
        jsPrefix: normalizeScreenRaw(jsScreen).slice(0, 240),
        token: firstTokenMismatch(cScreen, jsScreen),
      };
    }

    if (cursorEqual(cCursor, jsCursor)) cursorMatched++;
    else
      firstCursor ??= {
        index: i,
        step: c.screenSteps[i] || null,
        c: cCursor,
        js: jsCursor,
      };
  }

  const countExact = c.screens.length === jsScreens.length;
  const countMismatch = countExact
    ? null
    : {
        c: c.screens.length,
        js: jsScreens.length,
        firstExtraIndex: min,
        extraSide: c.screens.length > jsScreens.length ? "c" : "js",
      };

  return {
    counts: { c: c.screens.length, js: jsScreens.length },
    visual: {
      matched: visualMatched,
      total: c.screens.length,
      exact: countExact && visualMatched === c.screens.length,
      first: firstVisual,
    },
    raw: {
      matched: rawMatched,
      total: c.screens.length,
      exact: countExact && rawMatched === c.screens.length,
      first: firstRaw,
    },
    cursor: {
      matched: cursorMatched,
      total: c.cursors.length,
      exact: countExact && cursorMatched === c.cursors.length,
      first: firstCursor,
    },
    countMismatch,
  };
}

function emptyAnimationComparison(cAnimations, jsAnimations, extra = {}) {
  const js = Array.isArray(jsAnimations) ? jsAnimations : [];
  return {
    ...extra,
    counts: { c: cAnimations.length, js: js.length },
    visual: {
      matched: cAnimations.length,
      total: cAnimations.length,
      exact: true,
      first: null,
    },
    raw: {
      matched: cAnimations.length,
      total: cAnimations.length,
      exact: true,
      first: null,
    },
    cursor: {
      matched: cAnimations.length,
      total: cAnimations.length,
      exact: true,
      first: null,
    },
    metadata: {
      matched: cAnimations.length,
      total: cAnimations.length,
      exact: true,
      first: null,
    },
    stepCounts: {
      matched: cAnimations.length,
      total: cAnimations.length,
      exact: true,
      first: null,
    },
    countMismatch: null,
  };
}

function animationStepKey(frame) {
  return `${frame.segmentIndex ?? 0}:${frame.stepIndex ?? 0}`;
}

function compareAnimationStepCounts(cAnimations, jsAnimations) {
  const cCounts = new Map();
  const jsCounts = new Map();
  for (const frame of cAnimations) {
    const key = animationStepKey(frame);
    cCounts.set(key, (cCounts.get(key) || 0) + 1);
  }
  for (const frame of jsAnimations) {
    const key = animationStepKey(frame);
    jsCounts.set(key, (jsCounts.get(key) || 0) + 1);
  }
  const keys = [...new Set([...cCounts.keys(), ...jsCounts.keys()])].sort(
    (a, b) => {
      const [as, ai] = a.split(":").map(Number);
      const [bs, bi] = b.split(":").map(Number);
      return as - bs || ai - bi;
    },
  );
  let matched = 0;
  for (const key of keys) {
    const c = cCounts.get(key) || 0;
    const js = jsCounts.get(key) || 0;
    if (c === js) {
      matched++;
      continue;
    }
    const [segmentIndex, stepIndex] = key.split(":").map(Number);
    return {
      matched,
      total: keys.length,
      exact: false,
      first: { segmentIndex, stepIndex, c, js },
    };
  }
  return {
    matched,
    total: keys.length,
    exact: true,
    first: null,
  };
}

function compareAnimations(cAnimations, jsAnimations, recorded = true) {
  const js = Array.isArray(jsAnimations) ? jsAnimations : [];
  if (!recorded) {
    return emptyAnimationComparison(cAnimations, js, {
      recorded: false,
      skipped: true,
      skipReason: "C trace has no animation_frames field",
    });
  }
  const min = Math.min(cAnimations.length, js.length);
  let visualMatched = 0;
  let rawMatched = 0;
  let cursorMatched = 0;
  let metadataMatched = 0;
  let firstVisual = null;
  let firstRaw = null;
  let firstCursor = null;
  let firstMetadata = null;

  for (let i = 0; i < min; i++) {
    const cFrame = cAnimations[i] || {};
    const jsFrame = js[i] || {};
    const cScreen = cFrame.screen || "";
    const jsScreen = jsFrame.screen || "";
    const cCursor = cFrame.cursor || [0, 0, 1];
    const jsCursor = jsFrame.cursor || [0, 0, 1];
    const diff = summarizeScreenDiff(cScreen, jsScreen, cCursor, jsCursor);

    if (diff.counts.cell === 0) visualMatched++;
    else
      firstVisual ??= {
        index: i,
        c: {
          segmentIndex: cFrame.segmentIndex ?? null,
          seq: cFrame.seq ?? null,
          anim: cFrame.anim ?? null,
        },
        js: { seq: jsFrame.seq ?? null, anim: jsFrame.anim ?? null },
        diff,
      };

    if (normalizeScreenRaw(cScreen) === normalizeScreenRaw(jsScreen))
      rawMatched++;
    else
      firstRaw ??= {
        index: i,
        cPrefix: normalizeScreenRaw(cScreen).slice(0, 240),
        jsPrefix: normalizeScreenRaw(jsScreen).slice(0, 240),
        token: firstTokenMismatch(cScreen, jsScreen),
      };

    if (cursorEqual(cCursor, jsCursor)) cursorMatched++;
    else
      firstCursor ??= {
        index: i,
        c: cCursor,
        js: jsCursor,
      };

    if (
      (cFrame.seq ?? null) === (jsFrame.seq ?? null) &&
      (cFrame.anim ?? null) === (jsFrame.anim ?? null)
    ) {
      metadataMatched++;
    } else {
      firstMetadata ??= {
        index: i,
        c: { seq: cFrame.seq ?? null, anim: cFrame.anim ?? null },
        js: { seq: jsFrame.seq ?? null, anim: jsFrame.anim ?? null },
      };
    }
  }

  const countExact = cAnimations.length === js.length;
  return {
    recorded: true,
    skipped: false,
    counts: { c: cAnimations.length, js: js.length },
    visual: {
      matched: visualMatched,
      total: cAnimations.length,
      exact: countExact && visualMatched === cAnimations.length,
      first: firstVisual,
    },
    raw: {
      matched: rawMatched,
      total: cAnimations.length,
      exact: countExact && rawMatched === cAnimations.length,
      first: firstRaw,
    },
    cursor: {
      matched: cursorMatched,
      total: cAnimations.length,
      exact: countExact && cursorMatched === cAnimations.length,
      first: firstCursor,
    },
    metadata: {
      matched: metadataMatched,
      total: cAnimations.length,
      exact: countExact && metadataMatched === cAnimations.length,
      first: firstMetadata,
    },
    stepCounts: compareAnimationStepCounts(cAnimations, js),
    countMismatch: countExact
      ? null
      : {
          c: cAnimations.length,
          js: js.length,
          firstExtraIndex: min,
          extraSide: cAnimations.length > js.length ? "c" : "js",
        },
  };
}

function classifyParanoid(result) {
  if (result.error) return "runtime-error";
  if (!result.coreRng.exact) return "core-rng";
  if (!result.displayRng.exact) return "display-rng";
  if (!result.allRng.exact) return "all-rng";
  if (result.screen.countMismatch) return "screen-count";
  if (!result.screen.visual.exact) return "screen-visual";
  if (!result.screen.cursor.exact) return "cursor";
  if (!result.screen.raw.exact) return "raw-screen";
  if (
    result.animations.countMismatch ||
    !result.animations.stepCounts.exact ||
    !result.animations.visual.exact ||
    !result.animations.cursor.exact ||
    !result.animations.raw.exact ||
    !result.animations.metadata.exact
  )
    return "animation";
  return "pass";
}

async function runParanoidSession(sessionPath) {
  const data = JSON.parse(readFileSync(sessionPath, "utf8"));
  const segments = normalizeSession(data).segments;
  const c = flattenCanonical(segments);

  const storage = createStorageHandle();
  const jsAllRng = [];
  const jsScreens = [];
  const jsCursors = [];
  const jsAnimations = [];
  let error = null;
  try {
    for (const [segmentIndex, segment] of segments.entries()) {
      const game = await runSegment({ ...replayInputFor(segment), storage });
      jsAllRng.push(
        ...(game?.getRngLog?.() || [])
          .map(normalizeRng)
          .filter((entry) => isCoreRngCall(entry) || isDisplayRngCall(entry)),
      );
      jsScreens.push(...(game?.getScreens?.() || []));
      jsCursors.push(...(game?.getCursors?.() || []));
      const byStep = game?.getAnimationFramesByStep?.() || [];
      for (const [stepIndex, frames] of byStep.entries()) {
        for (const frame of frames || []) {
          jsAnimations.push({
            segmentIndex,
            stepIndex,
            screen: frame.screen || "",
            cursor: frame.cursor || [0, 0, 1],
            seq: frame.seq ?? null,
            anim: frame.anim ?? null,
          });
        }
      }
    }
  } catch (caught) {
    error = caught?.message || String(caught);
  }

  const jsCoreRng = jsAllRng.filter(isCoreRngCall);
  const jsDisplayRng = jsAllRng.filter(isDisplayRngCall);
  const cHasDisplayRng = c.displayRng.length > 0;
  const comparableJsAllRng = cHasDisplayRng ? jsAllRng : jsCoreRng;

  const result = {
    session: basename(sessionPath),
    path: sessionPath,
    error,
    coreRng: compareSequence(
      c.coreRng,
      jsCoreRng,
      c.rngSteps.filter((step) => step.channel === "core"),
    ),
    displayRng: cHasDisplayRng
      ? compareSequence(
          c.displayRng,
          jsDisplayRng,
          c.rngSteps.filter((step) => step.channel === "display"),
        )
      : {
          matched: 0,
          cTotal: 0,
          jsTotal: jsDisplayRng.length,
          exact: true,
          first: null,
          skipped: true,
        },
    allRng: compareSequence(c.allRng, comparableJsAllRng, c.rngSteps),
    screen: compareScreens(c, jsScreens, jsCursors),
    animations: compareAnimations(
      c.animations,
      jsAnimations,
      c.animationsRecorded,
    ),
  };
  result.classification = classifyParanoid(result);
  result.passed = result.classification === "pass";
  return result;
}

function permissionArgs(sessionPath) {
  const root = realpathSync(projectRoot);
  const session = realpathSync(sessionPath);
  return [
    "--permission",
    `--allow-fs-read=${root}`,
    `--allow-fs-read=${session}`,
    "--import",
    preloadPath,
  ];
}

const maxWorkerOutput = 64 * 1024 * 1024;

function outputTail(text, limit = 1200) {
  const trimmed = String(text || "").trim();
  if (trimmed.length <= limit) return trimmed;
  return trimmed.slice(-limit);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function runParanoidWorker(sessionPath, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        ...permissionArgs(sessionPath),
        scriptPath,
        `--worker-paranoid=${sessionPath}`,
      ],
      {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let outputTooLarge = false;
    let timedOut = false;
    let closed = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!closed) child.kill("SIGKILL");
      }, 1000).unref();
    }, timeoutMs);
    timer.unref();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > maxWorkerOutput) {
        outputTooLarge = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > maxWorkerOutput) {
        outputTooLarge = true;
        child.kill("SIGTERM");
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        session: basename(sessionPath),
        passed: false,
        classification: "runtime-error",
        error: error.message,
      });
    });
    child.on("close", (status, signal) => {
      closed = true;
      clearTimeout(timer);
      if (outputTooLarge) {
        resolve({
          session: basename(sessionPath),
          passed: false,
          classification: "runtime-error",
          error: `worker output exceeded ${maxWorkerOutput} bytes`,
        });
        return;
      }
      if (timedOut || (status ?? 0) !== 0) {
        const detail = outputTail(stderr || stdout);
        resolve({
          session: basename(sessionPath),
          passed: false,
          classification: "runtime-error",
          error: timedOut
            ? `worker timed out after ${timeoutMs}ms`
            : detail || `exit ${status}${signal ? ` signal ${signal}` : ""}`,
        });
        return;
      }

      const marker = "__PARANOID_RESULT__";
      const idx = stdout.lastIndexOf(marker);
      if (idx < 0) {
        const stderrTail = outputTail(stderr);
        const stdoutTail = outputTail(stdout);
        resolve({
          session: basename(sessionPath),
          passed: false,
          classification: "runtime-error",
          error: [
            "worker output missing __PARANOID_RESULT__ marker",
            stderrTail ? `stderr tail: ${stderrTail}` : "",
            stdoutTail ? `stdout tail: ${stdoutTail}` : "",
          ]
            .filter(Boolean)
            .join("; "),
        });
        return;
      }
      try {
        resolve(JSON.parse(stdout.slice(idx + marker.length).trim()));
      } catch (error) {
        resolve({
          session: basename(sessionPath),
          passed: false,
          classification: "runtime-error",
          error: `worker JSON parse failed: ${error.message}`,
        });
      }
    });
  });
}

async function runPool(items, jobs, worker, onResult) {
  const results = new Array(items.length);
  let next = 0;
  async function runNext() {
    while (next < items.length) {
      const index = next++;
      const result = await worker(items[index], index);
      results[index] = result;
      onResult?.(result, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(jobs, items.length) }, () => runNext()),
  );
  return results;
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

function summarizeCompetition(results) {
  const totals = {
    rng: { matched: 0, total: 0 },
    screen: { matched: 0, total: 0 },
  };
  for (const result of results) {
    totals.rng.matched += result.metrics?.rngCalls?.matched || 0;
    totals.rng.total += result.metrics?.rngCalls?.total || 0;
    totals.screen.matched += result.metrics?.screens?.matched || 0;
    totals.screen.total += result.metrics?.screens?.total || 0;
  }
  return {
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    byClass: {
      fail: results.filter((result) => !result.passed).length,
      pass: results.filter((result) => result.passed).length,
    },
    totals,
  };
}

function printParanoidResult(result) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`${status}: ${result.session} (${result.classification})`);
  if (result.error) {
    console.log(`  error: ${result.error}`);
    return;
  }
  console.log(
    `  core rng: ${result.coreRng.matched}/${result.coreRng.cTotal} C, ${result.coreRng.jsTotal} JS`,
  );
  console.log(
    `  display rng: ${result.displayRng.matched}/${result.displayRng.cTotal} C, ${result.displayRng.jsTotal} JS`,
  );
  console.log(
    `  screens visual/raw/cursor: ${result.screen.visual.matched}/${result.screen.visual.total}, ${result.screen.raw.matched}/${result.screen.raw.total}, ${result.screen.cursor.matched}/${result.screen.cursor.total} (C ${result.screen.counts.c}, JS ${result.screen.counts.js})`,
  );
  if (result.animations.skipped) {
    console.log(
      `  animations: skipped (${result.animations.skipReason}; JS ${result.animations.counts.js})`,
    );
  } else {
    console.log(
      `  animations visual/raw/cursor/meta/steps: ${result.animations.visual.matched}/${result.animations.visual.total}, ${result.animations.raw.matched}/${result.animations.raw.total}, ${result.animations.cursor.matched}/${result.animations.cursor.total}, ${result.animations.metadata.matched}/${result.animations.metadata.total}, ${result.animations.stepCounts.matched}/${result.animations.stepCounts.total} (C ${result.animations.counts.c}, JS ${result.animations.counts.js})`,
    );
  }
  const first =
    result.coreRng.first || result.displayRng.first || result.allRng.first;
  if (first)
    console.log(
      `  first rng mismatch #${first.index}: C ${first.c ?? "<missing>"} | JS ${first.js ?? "<missing>"}`,
    );
  if (result.screen.countMismatch)
    console.log(
      `  screen count mismatch: C ${result.screen.countMismatch.c}, JS ${result.screen.countMismatch.js}`,
    );
  if (result.screen.visual.first) {
    const firstScreen = result.screen.visual.first;
    console.log(
      `  first visual mismatch #${firstScreen.index}: cells=${firstScreen.diff.counts.cell}, cursor=${firstScreen.diff.counts.cursor}`,
    );
    if (firstScreen.step)
      console.log(
        `    at segment ${firstScreen.step.segmentIndex}, step ${firstScreen.step.stepIndex}, key ${JSON.stringify(firstScreen.step.key)}`,
      );
    console.log(
      `    surfaces: C ${firstScreen.diff.surfaces.c.join(",") || "<none>"} | JS ${firstScreen.diff.surfaces.js.join(",") || "<none>"}`,
    );
    if (firstScreen.diff.first) {
      const loc = firstScreen.diff.first;
      console.log(
        `    first cell r${loc.row} c${loc.col}: C ${JSON.stringify(loc.c)} | JS ${JSON.stringify(loc.js)}`,
      );
    }
    for (const sample of firstScreen.diff.samples.slice(0, 4)) {
      console.log(`    row ${sample.row} C : ${JSON.stringify(sample.cText)}`);
      console.log(`    row ${sample.row} JS: ${JSON.stringify(sample.jsText)}`);
    }
    const current = firstScreen.diff.window?.current;
    if (current) {
      console.log(`    message C : ${JSON.stringify(current.c.message)}`);
      console.log(`    message JS: ${JSON.stringify(current.js.message)}`);
      console.log(
        `    status C  : ${JSON.stringify(`${current.c.status1} | ${current.c.status2}`)}`,
      );
      console.log(
        `    status JS : ${JSON.stringify(`${current.js.status1} | ${current.js.status2}`)}`,
      );
    }
  }
  if (result.screen.cursor.first) {
    const cur = result.screen.cursor.first;
    console.log(
      `  first cursor mismatch #${cur.index}: C ${JSON.stringify(cur.c)} | JS ${JSON.stringify(cur.js)}`,
    );
  }
  if (result.screen.raw.first) {
    const raw = result.screen.raw.first;
    console.log(`  first raw screen mismatch #${raw.index}`);
    console.log(`    C prefix : ${JSON.stringify(raw.cPrefix)}`);
    console.log(`    JS prefix: ${JSON.stringify(raw.jsPrefix)}`);
    if (raw.token) {
      console.log(
        `    first token #${raw.token.index}: C ${JSON.stringify(raw.token.c)} | JS ${JSON.stringify(raw.token.js)}`,
      );
    }
  }
  if (result.animations.countMismatch) {
    console.log(
      `  animation count mismatch: C ${result.animations.countMismatch.c}, JS ${result.animations.countMismatch.js}`,
    );
  }
  if (result.animations.stepCounts?.first) {
    const step = result.animations.stepCounts.first;
    console.log(
      `  first animation step-count mismatch: segment ${step.segmentIndex}, step ${step.stepIndex}, C ${step.c}, JS ${step.js}`,
    );
  }
  if (result.animations.visual.first) {
    const firstAnimation = result.animations.visual.first;
    console.log(
      `  first animation visual mismatch #${firstAnimation.index}: cells=${firstAnimation.diff.counts.cell}, cursor=${firstAnimation.diff.counts.cursor}`,
    );
    console.log(
      `    metadata C ${JSON.stringify(firstAnimation.c)} | JS ${JSON.stringify(firstAnimation.js)}`,
    );
    if (firstAnimation.diff.first) {
      const loc = firstAnimation.diff.first;
      console.log(
        `    first cell r${loc.row} c${loc.col}: C ${JSON.stringify(loc.c)} | JS ${JSON.stringify(loc.js)}`,
      );
    }
    for (const sample of firstAnimation.diff.samples.slice(0, 4)) {
      console.log(`    row ${sample.row} C : ${JSON.stringify(sample.cText)}`);
      console.log(`    row ${sample.row} JS: ${JSON.stringify(sample.jsText)}`);
    }
  }
  if (result.animations.cursor.first) {
    const cur = result.animations.cursor.first;
    console.log(
      `  first animation cursor mismatch #${cur.index}: C ${JSON.stringify(cur.c)} | JS ${JSON.stringify(cur.js)}`,
    );
  }
  if (result.animations.raw.first) {
    const raw = result.animations.raw.first;
    console.log(`  first animation raw mismatch #${raw.index}`);
    console.log(`    C prefix : ${JSON.stringify(raw.cPrefix)}`);
    console.log(`    JS prefix: ${JSON.stringify(raw.jsPrefix)}`);
    if (raw.token) {
      console.log(
        `    first token #${raw.token.index}: C ${JSON.stringify(raw.token.c)} | JS ${JSON.stringify(raw.token.js)}`,
      );
    }
  }
  if (result.animations.metadata.first) {
    const meta = result.animations.metadata.first;
    console.log(
      `  first animation metadata mismatch #${meta.index}: C ${JSON.stringify(meta.c)} | JS ${JSON.stringify(meta.js)}`,
    );
  }
}

function runCompetition(targets, opts) {
  const child = spawnSync(process.execPath, [strictScorePath, ...targets], {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (!opts.json) {
    if (child.stderr) process.stderr.write(child.stderr);
    if (child.stdout && child.stdout.trim()) process.stdout.write(child.stdout);
  }
  if (child.error || (child.status ?? 0) !== 0) {
    throw new Error(
      child.error?.message ||
        (child.stderr || "").trim() ||
        `strict scorer exit ${child.status}`,
    );
  }
  const marker = "__RESULTS_JSON__";
  const idx = (child.stdout || "").lastIndexOf(marker);
  if (idx < 0)
    throw new Error("strict scorer output missing __RESULTS_JSON__ marker");
  const bundle = JSON.parse(child.stdout.slice(idx + marker.length).trim());
  bundle.mode = "competition";
  bundle.summary = summarizeCompetition(bundle.results);
  writeAdvisory(bundle, "trace-check.competition.json");
  if (opts.json) console.log(JSON.stringify(bundle));
  return bundle;
}

function writeAdvisory(bundle, name) {
  const path = join(projectRoot, ".cache", name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(bundle, null, 2));
}

async function runParanoid(targets, opts) {
  const sessionFiles = resolveSessionFiles(targets);
  const timeoutMs = parsePositiveInt(
    process.env.SESSION_REPLAY_TIMEOUT_MS,
    45000,
  );
  const jobs = parsePositiveInt(process.env.SESSION_REPLAY_JOBS, 1);
  const results = await runPool(
    sessionFiles,
    jobs,
    (sessionFile) => runParanoidWorker(sessionFile, timeoutMs),
    (result) => {
      if (!opts.json) printParanoidResult(result);
    },
  );
  if (!opts.json && jobs > 1) {
    console.log(`Workers: ${jobs}, timeout: ${timeoutMs}ms per session`);
  } else if (!opts.json) {
    console.log(`Timeout: ${timeoutMs}ms per session`);
  }
  const bundle = {
    timestamp: new Date().toISOString(),
    mode: "paranoid",
    sandbox: {
      nodePermission: true,
      preload: "tools/sandbox/preload.mjs",
      wasmPoisoned: true,
      fetchPoisoned: true,
    },
    summary: summarize(results),
    results,
  };
  writeAdvisory(bundle, "trace-check.paranoid.json");
  if (!opts.json) {
    console.log(
      `Summary: ${bundle.summary.passed}/${bundle.summary.total} passing`,
    );
    for (const [name, count] of Object.entries(bundle.summary.byClass))
      console.log(`  ${name}: ${count}`);
  } else {
    console.log(JSON.stringify(bundle));
  }
  return bundle;
}

function parseArgs(argv) {
  const opts = { mode: "", json: false, allowFail: false, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--allow-fail") opts.allowFail = true;
    else if (arg === "--mode") opts.mode = argv[++i] || "";
    else if (arg.startsWith("--mode=")) opts.mode = arg.slice("--mode=".length);
    else if (arg.startsWith("--worker-paranoid="))
      opts.workerParanoid = arg.slice("--worker-paranoid=".length);
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`);
    else opts.targets.push(arg);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.workerParanoid) {
    const result = await runParanoidSession(opts.workerParanoid);
    console.log("__PARANOID_RESULT__");
    console.log(JSON.stringify(result));
    return;
  }
  if (opts.help || !opts.mode) {
    console.log(usage());
    return;
  }
  if (!opts.targets.length) opts.targets.push(defaultSessionsDir);
  if (!["competition", "paranoid"].includes(opts.mode)) {
    throw new Error(
      `Unknown mode ${opts.mode}; expected competition or paranoid`,
    );
  }
  const bundle =
    opts.mode === "competition"
      ? runCompetition(opts.targets, opts)
      : await runParanoid(opts.targets, opts);
  if (!opts.allowFail && bundle.summary.passed !== bundle.summary.total)
    process.exitCode = 1;
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
