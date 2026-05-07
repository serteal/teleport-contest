#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeSession } from '../frozen/session_loader.mjs';
import {
  COLS_80,
  ROWS_24,
  decodeScreen,
  diffCell,
  renderCell,
} from '../frozen/screen-decode.mjs';
import { runSegment } from '../js/jsmain.js';
import { projectRoot } from './c2js/c2js.config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const strictScorePath = join(projectRoot, 'tools/strict-score.mjs');
const preloadPath = join(projectRoot, 'tools/sandbox/preload.mjs');
const defaultSessionsDir = join(projectRoot, 'sessions');
const startupVariantLines = [/Version\s+\d+\.\d+\.\d+[^\n]*/];

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
  return typeof entry === 'string' && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry);
}

function isDisplayRngCall(entry) {
  return typeof entry === 'string' && /^~drn2\(/.test(entry);
}

function normalizeRng(entry) {
  return String(entry || '').replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
}

function normalizeScreenRaw(screen) {
  let cur = String(screen || '');
  for (const re of startupVariantLines) cur = cur.replace(re, '<<VERSION_BANNER>>');
  return cur.replace(/^\d{2}:\d{2}:\d{2}\.$/gm, '<time>.');
}

function preDecode(screen) {
  return normalizeScreenRaw(screen);
}

function cursorEqual(a, b) {
  return Array.isArray(a) && Array.isArray(b)
    && a[0] === b[0] && a[1] === b[1] && (a[2] ?? 1) === (b[2] ?? 1);
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
  return grid[row].map(renderCell).join('').replace(/ +$/, '');
}

function rawLine(screen, row) {
  return String(screen || '').split('\n')[row] || '';
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
  const detailRows = [...new Set([first?.row, ...rowList.slice(0, 3), 0, 22, 23]
    .filter(row => row !== undefined && row >= 0 && row < ROWS_24))];
  return {
    counts,
    first,
    rows: rowList,
    cursors: { c: cCursor || null, js: jsCursor || null },
    samples: detailRows.map(row => ({
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
    const path = target.startsWith('/') ? target : join(projectRoot, target);
    if (!existsSync(path)) throw new Error(`Not found: ${target}`);
    const st = statSync(path);
    if (st.isFile() && path.endsWith('.session.json')) {
      files.push(path);
    } else if (st.isDirectory()) {
      for (const entry of readdirSync(path)) {
        const child = join(path, entry);
        if (entry.endsWith('.session.json') && statSync(child).isFile()) files.push(child);
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

function flattenCanonical(segments) {
  const coreRng = [];
  const displayRng = [];
  const allRng = [];
  const rngSteps = [];
  const screens = [];
  const cursors = [];
  const screenSteps = [];
  const animations = [];

  segments.forEach((segment, segmentIndex) => {
    (segment.steps || []).forEach((step, stepIndex) => {
      for (const raw of step.rng || []) {
        const entry = normalizeRng(raw);
        if (isCoreRngCall(entry)) {
          coreRng.push(entry);
          allRng.push(entry);
          rngSteps.push({ segmentIndex, stepIndex, channel: 'core' });
        } else if (isDisplayRngCall(entry)) {
          displayRng.push(entry);
          allRng.push(entry);
          rngSteps.push({ segmentIndex, stepIndex, channel: 'display' });
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
    });
    for (const frame of segment.animation_frames || []) {
      animations.push({
        segmentIndex,
        screen: frame.screen || '',
        cursor: frame.cursor || [0, 0, 1],
        seq: frame.seq ?? null,
        anim: frame.anim ?? null,
      });
    }
  });

  return { coreRng, displayRng, allRng, rngSteps, screens, cursors, screenSteps, animations };
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
      first: { index: i, c: c[i] ?? null, js: js[i] ?? null, step: steps[i] || null },
    };
  }
  const exact = c.length === js.length;
  return {
    matched,
    cTotal: c.length,
    jsTotal: js.length,
    exact,
    first: exact ? null : {
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
    const cScreen = c.screens[i] || '';
    const jsScreen = jsScreens[i] || '';
    const cCursor = c.cursors[i] || [0, 0, 1];
    const jsCursor = jsCursors[i] || [0, 0, 1];
    const diff = summarizeScreenDiff(cScreen, jsScreen, cCursor, jsCursor);
    if (diff.counts.cell === 0) visualMatched++;
    else firstVisual ??= { index: i, step: c.screenSteps[i] || null, diff };

    if (normalizeScreenRaw(cScreen) === normalizeScreenRaw(jsScreen)) rawMatched++;
    else if (!firstRaw) {
      firstRaw = {
        index: i,
        step: c.screenSteps[i] || null,
        cPrefix: normalizeScreenRaw(cScreen).slice(0, 240),
        jsPrefix: normalizeScreenRaw(jsScreen).slice(0, 240),
      };
    }

    if (cursorEqual(cCursor, jsCursor)) cursorMatched++;
    else firstCursor ??= { index: i, step: c.screenSteps[i] || null, c: cCursor, js: jsCursor };
  }

  const countExact = c.screens.length === jsScreens.length;
  const countMismatch = countExact ? null : {
    c: c.screens.length,
    js: jsScreens.length,
    firstExtraIndex: min,
    extraSide: c.screens.length > jsScreens.length ? 'c' : 'js',
  };

  return {
    counts: { c: c.screens.length, js: jsScreens.length },
    visual: { matched: visualMatched, total: c.screens.length, exact: countExact && visualMatched === c.screens.length, first: firstVisual },
    raw: { matched: rawMatched, total: c.screens.length, exact: countExact && rawMatched === c.screens.length, first: firstRaw },
    cursor: { matched: cursorMatched, total: c.cursors.length, exact: countExact && cursorMatched === c.cursors.length, first: firstCursor },
    countMismatch,
  };
}

function compareAnimations(cAnimations, jsAnimations) {
  const js = Array.isArray(jsAnimations) ? jsAnimations : [];
  return {
    cTotal: cAnimations.length,
    jsTotal: js.length,
    exact: cAnimations.length === js.length,
    first: cAnimations.length === js.length ? null : {
      index: Math.min(cAnimations.length, js.length),
      c: cAnimations[Math.min(cAnimations.length, js.length)] || null,
      js: js[Math.min(cAnimations.length, js.length)] || null,
    },
  };
}

function classifyParanoid(result) {
  if (result.error) return 'runtime-error';
  if (!result.coreRng.exact) return 'core-rng';
  if (!result.displayRng.exact) return 'display-rng';
  if (!result.allRng.exact) return 'all-rng';
  if (result.screen.countMismatch) return 'screen-count';
  if (!result.screen.visual.exact) return 'screen-visual';
  if (!result.screen.cursor.exact) return 'cursor';
  if (!result.screen.raw.exact) return 'raw-screen';
  if (!result.animations.exact) return 'animation';
  return 'pass';
}

async function runParanoidSession(sessionPath) {
  const data = JSON.parse(readFileSync(sessionPath, 'utf8'));
  const segments = normalizeSession(data).segments;
  const c = flattenCanonical(segments);

  let game = null;
  let error = null;
  try {
    for (const segment of segments) game = await runSegment(replayInputFor(segment), game);
  } catch (caught) {
    error = caught?.message || String(caught);
  }

  const jsAllRng = (game?.getRngLog?.() || []).map(normalizeRng)
    .filter(entry => isCoreRngCall(entry) || isDisplayRngCall(entry));
  const jsCoreRng = jsAllRng.filter(isCoreRngCall);
  const jsDisplayRng = jsAllRng.filter(isDisplayRngCall);
  const jsScreens = game?.getScreens?.() || [];
  const jsCursors = game?.getCursors?.() || [];
  const jsAnimations = game?.getAnimationFrames?.() || [];

  const result = {
    session: basename(sessionPath),
    path: sessionPath,
    error,
    coreRng: compareSequence(c.coreRng, jsCoreRng, c.rngSteps.filter(step => step.channel === 'core')),
    displayRng: compareSequence(c.displayRng, jsDisplayRng, c.rngSteps.filter(step => step.channel === 'display')),
    allRng: compareSequence(c.allRng, jsAllRng, c.rngSteps),
    screen: compareScreens(c, jsScreens, jsCursors),
    animations: compareAnimations(c.animations, jsAnimations),
  };
  result.classification = classifyParanoid(result);
  result.passed = result.classification === 'pass';
  return result;
}

function permissionArgs(sessionPath) {
  const root = realpathSync(projectRoot);
  const session = realpathSync(sessionPath);
  return [
    '--permission',
    `--allow-fs-read=${root}`,
    `--allow-fs-read=${session}`,
    '--import',
    preloadPath,
  ];
}

function runParanoidWorker(sessionPath, timeoutMs) {
  const child = spawnSync(process.execPath, [
    ...permissionArgs(sessionPath),
    scriptPath,
    `--worker-paranoid=${sessionPath}`,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (child.error || (child.status ?? 0) !== 0) {
    return {
      session: basename(sessionPath),
      passed: false,
      classification: 'runtime-error',
      error: child.error?.message || (child.stderr || '').trim() || `exit ${child.status}`,
    };
  }

  const marker = '__PARANOID_RESULT__';
  const idx = (child.stdout || '').lastIndexOf(marker);
  if (idx < 0) {
    return {
      session: basename(sessionPath),
      passed: false,
      classification: 'runtime-error',
      error: 'worker output missing __PARANOID_RESULT__ marker',
    };
  }
  return JSON.parse(child.stdout.slice(idx + marker.length).trim());
}

function summarize(results) {
  const byClass = new Map();
  for (const result of results) {
    byClass.set(result.classification, (byClass.get(result.classification) || 0) + 1);
  }
  return {
    total: results.length,
    passed: results.filter(result => result.passed).length,
    byClass: Object.fromEntries([...byClass.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
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
    passed: results.filter(result => result.passed).length,
    byClass: {
      fail: results.filter(result => !result.passed).length,
      pass: results.filter(result => result.passed).length,
    },
    totals,
  };
}

function printParanoidResult(result) {
  const status = result.passed ? 'PASS' : 'FAIL';
  console.log(`${status}: ${result.session} (${result.classification})`);
  if (result.error) {
    console.log(`  error: ${result.error}`);
    return;
  }
  console.log(`  core rng: ${result.coreRng.matched}/${result.coreRng.cTotal} C, ${result.coreRng.jsTotal} JS`);
  console.log(`  display rng: ${result.displayRng.matched}/${result.displayRng.cTotal} C, ${result.displayRng.jsTotal} JS`);
  console.log(`  screens visual/raw/cursor: ${result.screen.visual.matched}/${result.screen.visual.total}, ${result.screen.raw.matched}/${result.screen.raw.total}, ${result.screen.cursor.matched}/${result.screen.cursor.total} (C ${result.screen.counts.c}, JS ${result.screen.counts.js})`);
  console.log(`  animations: C ${result.animations.cTotal}, JS ${result.animations.jsTotal}`);
  const first = result.coreRng.first || result.displayRng.first || result.allRng.first;
  if (first) console.log(`  first rng mismatch #${first.index}: C ${first.c ?? '<missing>'} | JS ${first.js ?? '<missing>'}`);
  if (result.screen.countMismatch) console.log(`  screen count mismatch: C ${result.screen.countMismatch.c}, JS ${result.screen.countMismatch.js}`);
  if (result.screen.visual.first) {
    const firstScreen = result.screen.visual.first;
    console.log(`  first visual mismatch #${firstScreen.index}: cells=${firstScreen.diff.counts.cell}, cursor=${firstScreen.diff.counts.cursor}`);
    if (firstScreen.step) console.log(`    at segment ${firstScreen.step.segmentIndex}, step ${firstScreen.step.stepIndex}, key ${JSON.stringify(firstScreen.step.key)}`);
    if (firstScreen.diff.first) {
      const loc = firstScreen.diff.first;
      console.log(`    first cell r${loc.row} c${loc.col}: C ${JSON.stringify(loc.c)} | JS ${JSON.stringify(loc.js)}`);
    }
  }
  if (result.screen.cursor.first) {
    const cur = result.screen.cursor.first;
    console.log(`  first cursor mismatch #${cur.index}: C ${JSON.stringify(cur.c)} | JS ${JSON.stringify(cur.js)}`);
  }
  if (result.screen.raw.first) {
    const raw = result.screen.raw.first;
    console.log(`  first raw screen mismatch #${raw.index}`);
    console.log(`    C prefix : ${JSON.stringify(raw.cPrefix)}`);
    console.log(`    JS prefix: ${JSON.stringify(raw.jsPrefix)}`);
  }
}

function runCompetition(targets, opts) {
  const child = spawnSync(process.execPath, [strictScorePath, ...targets], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (!opts.json) {
    if (child.stderr) process.stderr.write(child.stderr);
    if (child.stdout && child.stdout.trim()) process.stdout.write(child.stdout);
  }
  if (child.error || (child.status ?? 0) !== 0) {
    throw new Error(child.error?.message || (child.stderr || '').trim() || `strict scorer exit ${child.status}`);
  }
  const marker = '__RESULTS_JSON__';
  const idx = (child.stdout || '').lastIndexOf(marker);
  if (idx < 0) throw new Error('strict scorer output missing __RESULTS_JSON__ marker');
  const bundle = JSON.parse(child.stdout.slice(idx + marker.length).trim());
  bundle.mode = 'competition';
  bundle.summary = summarizeCompetition(bundle.results);
  writeAdvisory(bundle, 'trace-check.competition.json');
  if (opts.json) console.log(JSON.stringify(bundle));
  return bundle;
}

function writeAdvisory(bundle, name) {
  const path = join(projectRoot, '.cache', name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(bundle, null, 2));
}

function runParanoid(targets, opts) {
  const sessionFiles = resolveSessionFiles(targets);
  const timeoutMs = Number(process.env.SESSION_REPLAY_TIMEOUT_MS || 45000);
  const results = [];
  for (const sessionFile of sessionFiles) {
    const result = runParanoidWorker(sessionFile, timeoutMs);
    results.push(result);
    if (!opts.json) printParanoidResult(result);
  }
  const bundle = {
    timestamp: new Date().toISOString(),
    mode: 'paranoid',
    sandbox: {
      nodePermission: true,
      preload: 'tools/sandbox/preload.mjs',
      wasmPoisoned: true,
      fetchPoisoned: true,
    },
    summary: summarize(results),
    results,
  };
  writeAdvisory(bundle, 'trace-check.paranoid.json');
  if (!opts.json) {
    console.log(`Summary: ${bundle.summary.passed}/${bundle.summary.total} passing`);
    for (const [name, count] of Object.entries(bundle.summary.byClass)) console.log(`  ${name}: ${count}`);
  } else {
    console.log(JSON.stringify(bundle));
  }
  return bundle;
}

function parseArgs(argv) {
  const opts = { mode: '', json: false, allowFail: false, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--json') opts.json = true;
    else if (arg === '--allow-fail') opts.allowFail = true;
    else if (arg === '--mode') opts.mode = argv[++i] || '';
    else if (arg.startsWith('--mode=')) opts.mode = arg.slice('--mode='.length);
    else if (arg.startsWith('--worker-paranoid=')) opts.workerParanoid = arg.slice('--worker-paranoid='.length);
    else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    else opts.targets.push(arg);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.workerParanoid) {
    const result = await runParanoidSession(opts.workerParanoid);
    console.log('__PARANOID_RESULT__');
    console.log(JSON.stringify(result));
    return;
  }
  if (opts.help || !opts.mode) {
    console.log(usage());
    return;
  }
  if (!opts.targets.length) opts.targets.push(defaultSessionsDir);
  if (!['competition', 'paranoid'].includes(opts.mode)) {
    throw new Error(`Unknown mode ${opts.mode}; expected competition or paranoid`);
  }
  const bundle = opts.mode === 'competition'
    ? runCompetition(opts.targets, opts)
    : runParanoid(opts.targets, opts);
  if (!opts.allowFail && bundle.summary.passed !== bundle.summary.total) process.exitCode = 1;
}

main().catch(error => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
