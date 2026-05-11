#!/usr/bin/env node
// ps_test_runner.mjs — Contest scoring runner for the Teleport coding
// challenge. Compares your JS NetHack 5.0 port against recorded C
// sessions on two channels:
//
//   P (PRNG)  — every PRNG call must match C's recorded sequence exactly
//   S (Screen) — terminal output at each input boundary must match
//
// Sessions are produced by the contest-minimal recorder build, which
// emits PRNG calls + screen frames only — no event_log markers, no
// midlog wrappers, no debug tracing. Scoring stays correspondingly
// simple.
//
// Usage:
//   node ps_test_runner.mjs                  # all .session.json under sessions/
//   node ps_test_runner.mjs <file-or-dir>... # explicit targets
//
// Output:
//   stderr — per-session PASS/FAIL line, then "N/M passing" summary
//   stdout — __RESULTS_JSON__\n{...} machine-readable bundle

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { execSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { decodeScreen, diffCell, ROWS_24, COLS_80 } from './screen-decode.mjs';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DEFAULT_SESSIONS_DIR = join(PROJECT_ROOT, 'sessions');

// Recorder sessions contain only PRNG calls — no event_log markers, no
// midlog wrappers — so the filter is just "is this a PRNG call line?"
function isRngCall(entry) {
    return typeof entry === 'string' && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(entry);
}

function extractRngCalls(rngArray) {
    return (rngArray || []).filter(isRngCall);
}

// Strip caller annotations and JS index prefix so plain "rn2(N)=M"
// comparisons work regardless of how richly the source was annotated.
function normalizeRng(entry) {
    return entry.replace(/\s*@\s.*$/, '').replace(/^\d+\s+/, '').trim();
}

// Lines on the startup copyright/version screen that vary by build
// (timestamps, build numbers, etc.) and would unfairly punish
// contestants for not pinning their version banner to the recorder
// build's exact timestamp. Replaced with a sentinel on both sides
// before comparison.
const STARTUP_VARIANT_LINES = [
    // Match any "Version X.Y.Z..." line — covers patched ("built Sun May  3 ..."),
    // recorder ("last build May 03 ..."), legacy ("Work-in-progress, built ..."),
    // and contestant-port banners ("Teleport JS (experiment ...)" etc).
    /Version\s+\d+\.\d+\.\d+[^\n]*/,
];

// Normalize visible screen text: strip control sequences with no
// visible effect (trailing SI/SO at line ends, leading SI when already
// in ASCII state); collapse build-variant version banner lines.
// Canonicalize SGR (color/attribute) escape sequences. Equivalent
// state transitions can be encoded different ways ("ESC[27m ESC[39m"
// vs "ESC[0m" both reset to default); this rewrites every transition
// to a single minimal canonical form.
function canonSGR(s) {
    const ESC = '\x1b';
    let out = '';
    let fg = 39, bold = false, inverse = false, underline = false;
    let i = 0;
    while (i < s.length) {
        if (s[i] === ESC && s[i + 1] === '[') {
            let j = i;
            let tfg = fg, tbold = bold, tinv = inverse, tul = underline;
            let isSGR = true;
            while (isSGR && s[j] === ESC && s[j + 1] === '[') {
                let k = j + 2;
                const numStart = k;
                while (k < s.length && (s[k] === ';' || (s[k] >= '0' && s[k] <= '9'))) k++;
                if (k >= s.length || s[k] !== 'm') { isSGR = false; break; }
                const params = s.slice(numStart, k).split(';').map(p => p === '' ? 0 : parseInt(p, 10));
                for (const p of params) {
                    if (p === 0) { tfg = 39; tbold = false; tinv = false; tul = false; }
                    else if (p === 1) tbold = true;
                    else if (p === 22) tbold = false;
                    else if (p === 4) tul = true;
                    else if (p === 24) tul = false;
                    else if (p === 7) tinv = true;
                    else if (p === 27) tinv = false;
                    else if ((p >= 30 && p <= 37) || p === 39) tfg = p;
                    else if (p >= 90 && p <= 97) tfg = p;
                }
                j = k + 1;
            }
            if (j > i) {
                if (tfg === 39 && !tbold && !tinv && !tul) {
                    if (fg !== 39 || bold || inverse || underline) out += ESC + '[0m';
                } else {
                    const parts = [];
                    const needReset = (!tbold && bold) || (!tinv && inverse) || (!tul && underline);
                    if (needReset) {
                        parts.push(0);
                        if (tbold) parts.push(1);
                        if (tinv) parts.push(7);
                        if (tul) parts.push(4);
                        if (tfg !== 39) parts.push(tfg);
                    } else {
                        if (tbold && !bold) parts.push(1);
                        if (tinv && !inverse) parts.push(7);
                        if (tul && !underline) parts.push(4);
                        if (tfg !== fg) parts.push(tfg);
                    }
                    if (parts.length) out += ESC + '[' + parts.join(';') + 'm';
                }
                fg = tfg; bold = tbold; inverse = tinv; underline = tul;
                i = j;
                continue;
            }
        }
        out += s[i];
        i++;
    }
    return out;
}

// VT100 alternate-charset (DEC line drawing) → Unicode mapping.
// C-side recordings emit `\x0e<dec-chars>\x0f`; JS contestants
// typically render the Unicode glyphs directly. Both forms render
// identically on a terminal — comparator translates DEC spans to
// Unicode so either representation passes.
const DEC_TO_UNICODE = {
    '`': '\u25c6', a: '\u2592', f: '\u00b0', g: '\u00b1',
    j: '\u2518', k: '\u2510', l: '\u250c', m: '\u2514', n: '\u253c',
    q: '\u2500', t: '\u251c', u: '\u2524', v: '\u2534', w: '\u252c',
    x: '\u2502', y: '\u2264', z: '\u2265', '|': '\u2260',
    o: '\u23ba', s: '\u23bd', '{': '\u03c0', '~': '\u00b7',
};
function translateDecSpans(s) {
    // Walk char-by-char, tracking whether we're in DEC mode (\x0e..\x0f).
    // Inside DEC mode, translate raw chars; preserve ANSI escapes
    // (\x1b[...] and \x0e/\x0f themselves) untouched.
    let out = '';
    let dec = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\x0e') { dec = true; continue; }
        if (ch === '\x0f') { dec = false; continue; }
        if (ch === '\x1b' && s[i + 1] === '[') {
            // Copy whole CSI sequence verbatim — terminator is in 0x40..0x7e.
            const start = i;
            i += 2;
            while (i < s.length) {
                const c = s.charCodeAt(i);
                if (c >= 0x40 && c <= 0x7e) break;
                i++;
            }
            out += s.slice(start, i + 1);
            continue;
        }
        out += dec ? (DEC_TO_UNICODE[ch] || ch) : ch;
    }
    return out;
}

// Pre-decode normalization: rewrite recording-variant lines (build banner,
// wall-clock timestamps) so they don't surface as char diffs. These are
// out-of-game cosmetic differences the comparator deliberately tolerates
// regardless of bit-exactness elsewhere.
function preDecode(s) {
    let cur = String(s);
    for (const re of STARTUP_VARIANT_LINES) {
        cur = cur.replace(re, '<<VERSION_BANNER>>');
    }
    cur = cur.replace(/^\d{2}:\d{2}:\d{2}\.$/gm, '<time>.');
    return cur;
}

// Decode-then-compare: render both sides to a 24×80 cell grid (the same
// way the Session Viewer does) and check cell-by-cell equality. Picks
// up bit-different SGR encodings as equal when the rendered pixels are
// the same — and ignores attr/color differences on glyphless spaces
// (where they produce no visible pixels).
function screensVisuallyEqual(a, b) {
    const ga = decodeScreen(preDecode(a));
    const gb = decodeScreen(preDecode(b));
    for (let r = 0; r < ROWS_24; r++) {
        for (let c = 0; c < COLS_80; c++) {
            if (diffCell(ga[r][c], gb[r][c])) return false;
        }
    }
    return true;
}

function normalizeScreen(s) {
    let cur = String(s);
    for (const re of STARTUP_VARIANT_LINES) {
        cur = cur.replace(re, '<<VERSION_BANNER>>');
    }
    cur = cur.replace(/^\d{2}:\d{2}:\d{2}\.$/gm, '<time>.');
    cur = canonSGR(cur);
    cur = cur.replace(/\x1b\[(\d+)C/g, (_, n) => ' '.repeat(parseInt(n, 10)));
    // Translate DEC charset spans (\x0e..\x0f) to Unicode. Must run BEFORE
    // the SI/SO commutation loop below, which would move SI/SO past content
    // and make state-machine translation impossible.
    cur = translateDecSpans(cur);
    // After translation there should be no \x0e/\x0f left, but defensively
    // run the original commutation cleanup in case translateDecSpans left
    // any unbalanced markers (e.g. \x0e at end of string).
    cur = cur.replace(/[\x0e\x0f]+$/gm, '');
    cur = cur.replace(/\x0f((?:\x1b\[[0-9;]*[a-zA-Z])*)$/gm, '$1');
    cur = cur.replace(/^\x0f( +\x0e)/gm, '$1');
    let prev;
    do {
        prev = cur;
        cur = cur.replace(/(\x1b\[[0-9;]*[a-zA-Z])\x0f/g, '\x0f$1');
        cur = cur.replace(/\x0e(\x1b\[[0-9;]*[a-zA-Z])/g, '$1\x0e');
        cur = cur.replace(/( +)\x0f/g, '\x0f$1');
        cur = cur.replace(/\x0e( +)/g, '$1\x0e');
        cur = cur.replace(/\x0e\x0f/g, '');
        cur = cur.replace(/\x0f\x0e/g, '');
    } while (cur !== prev);
    return cur;
}

// Build the replay input the judge passes to the contestant — just
// what's needed to launch and play the segment, never the recorded
// answers. Stripping `steps` here is the cheat-prevention boundary:
// the contestant cannot echo back recorded screens/cursors because
// they never see them.
function replayInputFor(segment) {
    return {
        seed: segment.seed,
        datetime: segment.datetime,
        nethackrc: segment.nethackrc,
        moves: segment.moves,
    };
}

// Run one full session: normalize, loop segments, call the
// contestant's runSegment(input) for each. Each call returns a
// self-contained per-segment game; we concatenate per-segment outputs
// harness-side and compare to what C recorded. Cross-segment state
// (save files, bones, record) flows through `input.storage`, a
// Web-Storage-shaped Map shared across all segments of the session.
async function runSession(sessionPath) {
    const sessionData = JSON.parse(readFileSync(sessionPath, 'utf8'));
    const { normalizeSession } = await import('./session_loader.mjs');
    const { runSegment } = await import(join(PROJECT_ROOT, 'js/jsmain.js'));

    // session_loader normalizes any legacy shape into clean v5 segments
    // ({seed, datetime, nethackrc, moves, steps}).
    const segments = normalizeSession(sessionData).segments;

    // Flatten C-side RNG + screens across all segments (judge totals).
    const cRng = [];
    const cScreens = [];
    // Per-step canonical animation frames, flat across segments,
    // indexed identically to cScreens.  Used for the SUPPLEMENTAL
    // animFrames metric (not folded into pass/fail).
    const cAnimByStep = [];
    for (const seg of segments) {
        for (const step of seg.steps || []) {
            cRng.push(...extractRngCalls(step.rng));
            if (step.screen) cScreens.push(step.screen);
            cAnimByStep.push(Array.isArray(step.animation_frames)
                ? step.animation_frames
                : []);
        }
    }

    // One shared Web-Storage-shaped Map per session.
    const storage = new Map();
    const storageHandle = {
        getItem(k) { return storage.has(k) ? storage.get(k) : null; },
        setItem(k, v) { storage.set(k, String(v)); },
        removeItem(k) { storage.delete(k); },
        get length() { return storage.size; },
        key(i) {
            let n = 0;
            for (const k of storage.keys()) { if (n === i) return k; n++; }
            return null;
        },
    };

    // Per-segment outputs accumulated harness-side.
    let jsRng = [];
    let jsScreens = [];
    let jsAnimByStep = [];
    let jsCursors = [];
    let lastGame = null;
    let jsError = null;
    try {
        for (const seg of segments) {
            const input = { ...replayInputFor(seg), storage: storageHandle };
            const segGame = await runSegment(input);
            const segRng = (segGame.getRngLog?.() || []).map(e =>
                typeof e === 'string' ? e.replace(/^\d+\s+/, '') : String(e)
            ).filter(isRngCall);
            jsRng.push(...segRng);
            jsScreens.push(...(segGame.getScreens?.() || []));
            jsCursors.push(...(segGame.getCursors?.() || []));
            if (typeof segGame.getAnimationFramesByStep === 'function') {
                jsAnimByStep.push(...segGame.getAnimationFramesByStep());
            }
            lastGame = segGame;
        }
    } catch (e) {
        jsError = e.message;
    }
    const game = lastGame;

    const rngTotal = cRng.length;
    let rngMatched = 0;
    for (let i = 0; i < rngTotal; i++) {
        if (normalizeRng(cRng[i] || '') === normalizeRng(jsRng[i] || '')) rngMatched++;
    }

    const screenTotal = cScreens.length;
    let screenMatched = 0;
    for (let i = 0; i < screenTotal; i++) {
        if (screensVisuallyEqual(jsScreens[i] || '', cScreens[i] || '')) screenMatched++;
    }

    // SUPPLEMENTAL: per-step animation frames.  Same comparator as the
    // boundary screens; total = canonical frame count; matched =
    // positional cell-equal frames.  Does NOT influence `passed`.
    let animMatched = 0;
    let animTotal = 0;
    const animLimit = Math.min(cAnimByStep.length, screenTotal);
    for (let i = 0; i < animLimit; i++) {
        const cFrames = cAnimByStep[i] || [];
        const jFrames = jsAnimByStep[i] || [];
        animTotal += cFrames.length;
        for (let f = 0; f < cFrames.length; f++) {
            const jf = jFrames[f];
            if (jf && screensVisuallyEqual(jf.screen || '', cFrames[f].screen || '')) {
                animMatched++;
            }
        }
    }

    return {
        session: basename(sessionPath),
        passed: !jsError && rngMatched === rngTotal && screenMatched === screenTotal,
        metrics: {
            rngCalls: { matched: rngMatched, total: rngTotal },
            screens: { matched: screenMatched, total: screenTotal },
            // Supplemental — never combined with rngCalls/screens for ranking.
            animFrames: { matched: animMatched, total: animTotal },
        },
        error: jsError,
    };
}

function resolveSessionFiles(targets) {
    const files = [];
    for (const t of targets) {
        const path = t.startsWith('/') ? t : join(PROJECT_ROOT, t);
        if (!existsSync(path)) {
            throw new Error(`Not found: ${t}`);
        }
        const st = statSync(path);
        if (st.isFile() && path.endsWith('.session.json')) {
            files.push(path);
        } else if (st.isDirectory()) {
            for (const f of readdirSync(path)) {
                if (f.endsWith('.session.json')) files.push(join(path, f));
            }
        }
    }
    return [...new Set(files)].sort();
}

async function main() {
    const args = process.argv.slice(2);

    const workerArg = args.find(a => a.startsWith('--worker-session='));
    if (workerArg) {
        const result = await runSession(workerArg.slice('--worker-session='.length));
        console.log('__RESULT_ONE__');
        console.log(JSON.stringify(result));
        return;
    }

    const targets = args.filter(a => !a.startsWith('--'));
    if (targets.length === 0) targets.push(DEFAULT_SESSIONS_DIR);
    const sessionFiles = resolveSessionFiles(targets);

    if (sessionFiles.length === 0) {
        console.error('No session files found.');
        process.exit(1);
    }

    const timeoutMs = Number(process.env.SESSION_REPLAY_TIMEOUT_MS || 45000);
    const results = [];
    for (const sf of sessionFiles) {
        const child = spawnSync(process.execPath, [SCRIPT_PATH, `--worker-session=${sf}`], {
            cwd: PROJECT_ROOT,
            encoding: 'utf8',
            timeout: timeoutMs,
            maxBuffer: 64 * 1024 * 1024,
        });

        let result;
        if (child.error || (child.status ?? 0) !== 0) {
            const err = child.error?.message || (child.stderr || '').trim() || `exit ${child.status}`;
            result = {
                session: basename(sf),
                passed: false,
                metrics: { rngCalls: { matched: 0, total: 0 }, screens: { matched: 0, total: 0 }, animFrames: { matched: 0, total: 0 } },
                error: err,
            };
        } else {
            const out = child.stdout || '';
            const idx = out.lastIndexOf('__RESULT_ONE__');
            if (idx < 0) {
                result = {
                    session: basename(sf),
                    passed: false,
                    metrics: { rngCalls: { matched: 0, total: 0 }, screens: { matched: 0, total: 0 }, animFrames: { matched: 0, total: 0 } },
                    error: 'worker output missing __RESULT_ONE__ marker',
                };
            } else {
                result = JSON.parse(out.slice(idx + '__RESULT_ONE__'.length).trim());
            }
        }
        results.push(result);

        const r = result.metrics?.rngCalls || {};
        const s = result.metrics?.screens || {};
        const status = result.passed ? 'PASS' : 'FAIL';
        process.stderr.write(
            `  ${status}: ${result.session} (RNG ${r.matched}/${r.total}, Screen ${s.matched}/${s.total})\n`
        );
    }

    const passed = results.filter(r => r.passed).length;
    process.stderr.write(`  ${passed}/${results.length} passing\n`);

    let commit = 'unknown';
    try {
        commit = execSync('git rev-parse --short HEAD', { cwd: PROJECT_ROOT }).toString().trim();
    } catch (_) { /* not a git checkout */ }

    const bundle = { timestamp: new Date().toISOString(), commit, results };
    console.log('__RESULTS_JSON__');
    console.log(JSON.stringify(bundle));

    // Also write a known advisory copy so the Session Viewer (and other
    // tools) can show pass/fail without re-running. `.cache/` is the
    // standard "transient artifact" location and should be gitignored.
    try {
        const advisory = join(PROJECT_ROOT, '.cache', 'session-results.json');
        mkdirSync(dirname(advisory), { recursive: true });
        writeFileSync(advisory, JSON.stringify(bundle, null, 2));
    } catch (e) {
        process.stderr.write(`(could not write .cache/session-results.json: ${e.message})\n`);
    }
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
