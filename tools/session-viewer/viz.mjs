// viz.mjs — PS Visualizer main controller.
//
// Loads a session, drives the JS port to compute screens/cursors/rng for
// every step, and renders:
//   - two timelines (canon + js) summarizing PRNG calls per step
//   - a 24×80 map showing the JS port's screen for the current step,
//     with diff overlay vs the canonical screen
//   - cursor / message-line / rng detail
//
// All work happens up-front after loading; scrubbing is pure DOM update.

import { decodeScreen, renderCell, colorToCss, diffCell, ROWS_24, COLS_80 } from '../../frozen/screen-decode.mjs';

const $ = (sel) => document.querySelector(sel);
const status = (msg, cls = '') => {
    const el = $('#status');
    el.textContent = msg;
    el.className = cls;
};

// --- Hash state -----------------------------------------------------------
// Persist UI state in location.hash (#session=NAME&step=N) so a refresh
// or a copy-paste link lands on the same session and step. The session
// part matches a substring of the dropdown's display name (so the user
// can write "#session=4500" and it picks up "seed4500-knight-...").
function readHash() {
    const out = {};
    const h = (location.hash || '').replace(/^#/, '');
    if (!h) return out;
    for (const part of h.split('&')) {
        const eq = part.indexOf('=');
        if (eq < 0) continue;
        const k = decodeURIComponent(part.slice(0, eq));
        const v = decodeURIComponent(part.slice(eq + 1));
        out[k] = v;
    }
    return out;
}
let _suppressHashWrite = false;
function writeHash({ session, step, view }) {
    if (_suppressHashWrite) return;
    const parts = [];
    if (session) parts.push(`session=${encodeURIComponent(session)}`);
    if (typeof step === 'number') parts.push(`step=${step}`);
    if (view && view !== 'js') parts.push(`view=${view}`);
    const next = '#' + parts.join('&');
    if (next !== location.hash) {
        // Use replaceState so we don't pollute history with every step click.
        history.replaceState(null, '', next || ' ');
    }
}

// View modes:
//   canon — show the canonical screen as it was recorded (no overlay)
//   js    — show the JS port's screen, highlighting cells where canon differs
//   diff  — overlay both: show whichever side is informative, color the diff
const VIEW_MODES = ['canon', 'js', 'diff'];
let CURRENT_VIEW = 'js';
function setView(v, { rerender = true } = {}) {
    if (!VIEW_MODES.includes(v)) return;
    CURRENT_VIEW = v;
    document.querySelectorAll('#view-modes button').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === v);
    });
    writeHash({ session: currentSessionShort(), step: currentStep(), view: v });
    if (rerender && CURRENT_ALIGNED) render(currentStep());
}
function currentStep() {
    const ro = document.querySelector('#step-readout');
    return ro ? parseInt(ro.dataset.step || '0', 10) : 0;
}
function currentSessionShort() {
    return CURRENT?.name?.replace(/\.session\.json$/, '') || null;
}

// --- Session list -------------------------------------------------------
async function listSessions() {
    // Try a manifest.json first (zero filesystem listing on a static server).
    // Fall back to a hardcoded list if absent. Either way, the file picker
    // is also wired so the user can load any session.json.
    try {
        const r = await fetch('../../sessions/manifest.json', { cache: 'no-store' });
        if (r.ok) return await r.json();
    } catch {}
    try {
        const r = await fetch('../../sessions/', { cache: 'no-store' });
        if (r.ok) {
            const html = await r.text();
            const matches = [...html.matchAll(/href="([^"?]*\.session\.json)"/g)]
                .map((m) => decodeURIComponent(m[1]))
                .filter((n) => !n.startsWith('/') && !n.includes('/'));
            if (matches.length) return matches;
        }
    } catch {}
    return [];
}

// Optional advisory: a session-results bundle written by whatever local
// runner the user has (the maud-side `scripts/pes-report.mjs`, or the
// contest-side equivalent). Lives at `.cache/session-results.json`,
// which is gitignored. If present we surface pass/fail in the picker.
async function loadResultsAdvisory() {
    for (const url of ['/.cache/session-results.json', '../../.cache/session-results.json']) {
        try {
            const r = await fetch(url, { cache: 'no-store' });
            if (!r.ok) continue;
            const bundle = await r.json();
            const map = new Map();
            for (const s of (bundle.results || bundle.sessions || [])) {
                // Tolerate three bundle shapes:
                //   - maud pes-report: { session, metrics: { rngCalls, screens } }
                //   - judge:           { name,    rng, screen }
                //   - contest ps:      { sessionFile, prng, screen }
                const name = s.session || s.sessionFile || s.name;
                if (!name) continue;
                const rng    = s.metrics?.rngCalls || s.rng || s.prng;
                const screen = s.metrics?.screens || s.screen;
                map.set(name.split('/').pop(), { passed: s.passed, rng, screen });
            }
            return map;
        } catch {}
    }
    return null;
}

function resultGlyph(s) {
    if (!s) return '·';
    if (s.passed) return '✓';
    return '✗';
}
function resultTitle(s, name) {
    if (!s) return `${name} — no recorded result`;
    const fmt = (x) => x ? `${x.matched}/${x.total}` : '?';
    const status = s.passed ? 'pass' : 'fail';
    return `${name} — ${status} · RNG ${fmt(s.rng)} · Screen ${fmt(s.screen)}`;
}

const select = $('#session-select');
Promise.all([listSessions(), loadResultsAdvisory()]).then(([names, statusMap]) => {
    for (const n of names) {
        const opt = document.createElement('option');
        opt.value = '../../sessions/' + n;
        const status = statusMap?.get(n);
        opt.textContent = `${resultGlyph(status)}  ${n}`;
        if (status) {
            opt.title = resultTitle(status, n);
            opt.dataset.result = status.passed ? 'pass' : 'fail';
        }
        select.appendChild(opt);
    }
    if (!names.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '(no manifest — use file picker)';
        opt.disabled = true;
        select.appendChild(opt);
    }
    // After the dropdown is populated, honor #session=… from the URL.
    const hash = readHash();
    if (hash.session) {
        const opt = [...select.options].find((o) =>
            o.textContent.includes(hash.session));
        if (opt) {
            select.value = opt.value;
            loadFromUrl(opt.value);
        }
    }
});

// React to hash changes from back/forward or manual edits.
window.addEventListener('hashchange', () => {
    const h = readHash();
    if (h.session) {
        const opt = [...select.options].find((o) =>
            o.textContent.includes(h.session));
        if (opt && opt.value !== select.value) {
            select.value = opt.value;
            loadFromUrl(opt.value);
            return;
        }
    }
    if (h.view && h.view !== CURRENT_VIEW && VIEW_MODES.includes(h.view)) {
        setView(h.view, { rerender: false });
    }
    if (CURRENT_ALIGNED && h.step != null) {
        const total = totalSteps();
        const step = Math.max(0, Math.min(total - 1, parseInt(h.step, 10) || 0));
        render(step);
    }
});

select.addEventListener('change', () => {
    if (select.value) loadFromUrl(select.value);
    // Drop focus so the dropdown doesn't eat arrow-key navigation.
    select.blur();
});
$('#session-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    select.value = '';
    await loadAndCompute(JSON.parse(text), f.name);
});

// --- Loading + compute --------------------------------------------------
let CURRENT = null;  // { sessionData, name, segments: [...] }

async function loadFromUrl(url) {
    status(`loading ${url} …`);
    try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        await loadAndCompute(data, url.split('/').pop());
    } catch (err) {
        status(`failed to load: ${err.message}`, 'error');
    }
}

async function loadAndCompute(sessionData, name) {
    status(`running JS port on ${name} …`);
    // Default JS port lives at ../../js/jsmain.js (the contest skeleton).
    // Override via ?js=<url> for ad-hoc testing against a different port.
    const jsUrl = new URLSearchParams(location.search).get('js') || '../../js/jsmain.js';
    let runSegment;
    try {
        const mod = await import(jsUrl);
        runSegment = mod.runSegment;
    } catch (err) {
        status(`could not import ${jsUrl}: ${err.message}`, 'error');
        return;
    }

    const segments = [];
    let prevGame = null;
    // The same NethackGame instance is reused across segments, so its
    // getScreens()/getCursors()/getRngSlices() return CUMULATIVE arrays.
    // We track an offset so each segment reads only its own slice.
    let priorCaptureCount = 0;
    for (let s = 0; s < sessionData.segments.length; s++) {
        const seg = sessionData.segments[s];
        const input = {
            seed: seg.seed,
            datetime: seg.datetime,
            nethackrc: seg.nethackrc,
            moves: seg.moves,
        };
        let game;
        try {
            game = await runSegment(input, prevGame);
        } catch (err) {
            status(`seg ${s}: JS port threw: ${err.message}`, 'error');
            return;
        }
        const allJsScreens = game.getScreens?.() || [];
        const allJsCursors = game.getCursors?.() || [];
        const allJsRngSlices = game.getRngSlices?.()
            || sliceRng(game.getRngLog?.() || [], allJsScreens.length);
        const stepsOut = [];
        for (let i = 0; i < seg.steps.length; i++) {
            const canonStep = seg.steps[i];
            const j = priorCaptureCount + i;
            stepsOut.push({
                key: canonStep.key,
                canonScreen: canonStep.screen || '',
                canonCursor: canonStep.cursor || [0, 0, 1],
                canonRng: canonStep.rng || [],
                jsScreen: allJsScreens[j] || '',
                jsCursor: allJsCursors[j] || [0, 0, 1],
                jsRng: allJsRngSlices[j] || [],
            });
        }
        segments.push({ seg, steps: stepsOut });
        priorCaptureCount = allJsScreens.length;
        prevGame = game;
    }

    CURRENT = { sessionData, name, segments };
    classifyScreenDiffs();
    initUI();
    status(buildStatusSummary(name), 'ok');
}

// Walk every step once and classify its screen diff into three independent
// bits: charDiff (any cell where the rendered glyph differs), attrDiff
// (matching glyph, different color/attr) and cursorDiff (cursor coords
// disagree). The timeline screen-strip stacks these into colored bands.
function classifyScreenDiffs() {
    for (const seg of CURRENT.segments) {
        for (const st of seg.steps) {
            const c = decodeScreen(st.canonScreen);
            const j = decodeScreen(st.jsScreen);
            let charDiff = false, attrDiff = false;
            for (let r = 0; r < ROWS_24 && !(charDiff && attrDiff); r++) {
                for (let col = 0; col < COLS_80; col++) {
                    const d = diffCell(c[r][col], j[r][col]);
                    if (d === 'ch')   { charDiff = true; }
                    else if (d === 'attr') { attrDiff = true; }
                    if (charDiff && attrDiff) break;
                }
            }
            const cursorDiff = !(st.canonCursor && st.jsCursor &&
                st.canonCursor[0] === st.jsCursor[0] &&
                st.canonCursor[1] === st.jsCursor[1]);
            st._diff = { char: charDiff, attr: attrDiff, cursor: cursorDiff };
        }
    }
}

function buildStatusSummary(name) {
    let prngMatch = 0, prngTotal = 0;
    let screenMatch = 0, screenTotal = 0;
    for (const s of CURRENT.segments) {
        for (const st of s.steps) {
            const ap = filterPrng(st.canonRng), bp = filterPrng(st.jsRng);
            const m = Math.min(ap.length, bp.length);
            for (let i = 0; i < m; i++) if (callKey(ap[i]) === callKey(bp[i])) prngMatch++;
            prngTotal += Math.max(ap.length, bp.length);
            screenTotal++;
            // Use the cell-level visual diff (same one the timeline strip
            // and map render with). This matches what the user SEES; the
            // contest comparator does strict canonicalized-SGR string
            // equality, which can flag visually-identical screens that
            // differ only in encoding.
            const d = st._diff;
            if (d && !d.char && !d.attr && !d.cursor) screenMatch++;
        }
    }
    return `${name} — ${totalSteps()} steps · `
        + `PRNG ${prngMatch}/${prngTotal}`
        + ` · screens ${screenMatch}/${screenTotal}`;
}

function sliceRng(log, n) {
    // Naive even split. Used only when getRngSlices isn't implemented.
    const out = [];
    const each = Math.ceil(log.length / Math.max(1, n));
    for (let i = 0; i < n; i++) out.push(log.slice(i * each, (i + 1) * each));
    return out;
}

function totalSteps() {
    return CURRENT.segments.reduce((n, s) => n + s.steps.length, 0);
}
function totalRngCalls() {
    let n = 0;
    for (const s of CURRENT.segments)
        for (const st of s.steps)
            n += (st.canonRng?.length || 0);
    return n;
}

// --- Flat indexing across segments --------------------------------------
function flatStep(idx) {
    let acc = 0;
    for (const s of CURRENT.segments) {
        if (idx < acc + s.steps.length)
            return { seg: s, step: s.steps[idx - acc], segIdx: CURRENT.segments.indexOf(s), stepInSeg: idx - acc };
        acc += s.steps.length;
    }
    return null;
}

// --- UI initialization --------------------------------------------------
function initUI() {
    buildFlatAligned();
    syncCanvasSize();
    installResizeHandler();
    installKeyboardNav();
    wireTimelineClicks();
    wireViewModeButtons();
    // Honor #view=NAME from the URL (default 'js').
    const hash = readHash();
    if (hash.view && VIEW_MODES.includes(hash.view)) {
        setView(hash.view, { rerender: false });
    } else {
        setView('js', { rerender: false });
    }
    // Honor #step=N from the URL on first render; otherwise start at 0.
    const total = totalSteps();
    const initialStep = hash.step != null
        ? Math.max(0, Math.min(total - 1, parseInt(hash.step, 10) || 0))
        : 0;
    render(initialStep);
}

let _viewButtonsInstalled = false;
function wireViewModeButtons() {
    if (_viewButtonsInstalled) return;
    _viewButtonsInstalled = true;
    document.querySelectorAll('#view-modes button').forEach((btn) => {
        btn.addEventListener('click', () => {
            setView(btn.dataset.view);
            // Don't keep keyboard focus on the button — arrow keys belong
            // to the timeline.
            btn.blur();
        });
    });
}

// --- Aligned per-call flat list -----------------------------------------
// CURRENT_ALIGNED:
//   calls: [{ canon: string|null, js: string|null }, ...]   one per slot
//   stepRanges: [{ start, end, segIdx, stepInSeg }]         per step boundary
//   stepBoundaries: indices in `calls` where each step starts
let CURRENT_ALIGNED = null;

function buildFlatAligned() {
    const calls = [];
    const stepRanges = [];
    let acc = 0;
    for (let s = 0; s < CURRENT.segments.length; s++) {
        const seg = CURRENT.segments[s];
        for (let i = 0; i < seg.steps.length; i++) {
            const st = seg.steps[i];
            const ap = filterPrng(st.canonRng);
            const bp = filterPrng(st.jsRng);
            const max = Math.max(ap.length, bp.length);
            for (let k = 0; k < max; k++) {
                calls.push({ canon: ap[k] ?? null, js: bp[k] ?? null });
            }
            stepRanges.push({
                start: acc, end: acc + max,
                segIdx: s, stepInSeg: i,
                callCount: max,
            });
            acc += max;
        }
    }
    CURRENT_ALIGNED = { calls, stepRanges };
    computeStepWidths();
}

// Non-uniform x-axis: each step's width is sqrt(calls+1)-scaled, then
// capped at MAX_STEP_FRACTION of the total. Caps redistribute their
// trimmed area proportionally to non-capped steps. The cap ensures one
// pathological step (e.g. seed8000's chargen with ~3000 PRNG calls)
// doesn't crowd out all the other steps; sqrt keeps a "denser steps
// look denser" signal under the cap.
const MAX_STEP_FRACTION = 0.25;
function computeStepWidths() {
    const ranges = CURRENT_ALIGNED.stepRanges;
    let widths = ranges.map((sr) => Math.sqrt(sr.callCount + 1));
    let sum = widths.reduce((a, b) => a + b, 0) || 1;
    widths = widths.map((w) => w / sum);
    // Iterative cap + redistribute.
    for (let pass = 0; pass < 20; pass++) {
        let overage = 0;
        const capped = new Array(widths.length).fill(false);
        for (let i = 0; i < widths.length; i++) {
            if (widths[i] > MAX_STEP_FRACTION) {
                overage += widths[i] - MAX_STEP_FRACTION;
                widths[i] = MAX_STEP_FRACTION;
                capped[i] = true;
            }
        }
        if (overage <= 1e-9) break;
        const uncappedSum = widths.reduce((a, w, i) => a + (capped[i] ? 0 : w), 0);
        if (uncappedSum <= 0) break;
        for (let i = 0; i < widths.length; i++) {
            if (!capped[i]) widths[i] += (widths[i] / uncappedSum) * overage;
        }
    }
    // Cumulative fractions → pixel positions resolved at draw time.
    let cum = 0;
    for (let i = 0; i < ranges.length; i++) {
        ranges[i].xFrac0 = cum;
        cum += widths[i];
        ranges[i].xFrac1 = cum;
    }
}

function filterPrng(rng) {
    const out = [];
    for (const e of rng || []) {
        if (typeof e !== 'string') continue;
        if (e[0] === '<' || e[0] === '>' || e[0] === '^') continue;
        out.push(e);
    }
    return out;
}

// --- Timeline rendering -------------------------------------------------
//
// Each canvas pixel-column maps to a contiguous range of PRNG call slots:
//
//   slot_lo = floor(x       * N / W)
//   slot_hi = floor((x + 1) * N / W)
//
// where N = CURRENT_ALIGNED.calls.length and W = canvas pixel width.
// When N ≤ W, each slot gets ⌈W/N⌉ pixels; when N > W, each pixel
// aggregates up to N/W consecutive slots.
//
// For each pixel/range we draw two stacked bars (canon-row + js-row),
// at the SAME x — so a divergence at slot k shows up at the same x in
// both rows. Bar height = log2 of the bound (e.g. rn2(100) → log2(101)),
// color = per-slot match status (green=match, red=value diff,
// orange=canon-only, blue=js-only).

// Resolve the parchment-theme CSS custom properties so JS-side canvas
// drawing matches the DOM theme. Falls back to literals if the variable
// hasn't been parsed yet (e.g. test environments without the stylesheet).
const _root = (typeof document !== 'undefined') ? getComputedStyle(document.documentElement) : null;
const cssVar = (name, fallback) => {
    const v = _root?.getPropertyValue(name)?.trim();
    return v || fallback;
};
const COLOR_MATCH      = cssVar('--tl-match',      '#6b5a40');
const COLOR_DIFF       = cssVar('--tl-diff',       '#c0392b');
const COLOR_CANON_ONLY = cssVar('--tl-canon-only', '#b8651b');   // canon has a call, js doesn't
const COLOR_JS_ONLY    = cssVar('--tl-js-only',    '#7b3fa3');   // js has a call, canon doesn't
const COLOR_DIFF_CHAR   = cssVar('--diff-char',   '#c0392b');
const COLOR_DIFF_ATTR   = cssVar('--diff-attr',   '#b8860b');
const COLOR_DIFF_CURSOR = cssVar('--diff-cursor', '#2563eb');
const COLOR_BG_OK      = cssVar('--tl-step-ok',   'rgba(196, 168, 130, 0.18)');
const COLOR_BG_DIFF    = cssVar('--tl-step-diff', 'rgba(192, 57, 43, 0.10)');
const COLOR_INACTIVE   = cssVar('--tl-inactive',  'rgba(0, 0, 0, 0.05)');  // bar slot when this side has no call
const COLOR_GRID       = cssVar('--tl-grid',      'rgba(0, 0, 0, 0.10)');
const COLOR_SEGDIV     = cssVar('--tl-segdiv',    'rgba(0, 0, 0, 0.30)');

function callBound(call) {
    if (!call) return 1;
    const m = /^\w+\((\d+)/.exec(call);
    return m ? parseInt(m[1], 10) : 1;
}
function callHeight(call) {
    return Math.log2(Math.max(2, callBound(call) + 1));
}
// Compare ONLY the call + result, not the optional `@ source.c:line`
// annotation. The C recorder emits "rn2(N)=V @ fn(file:line)"; the JS
// port may emit just "rn2(N)=V" or include its own annotation. Either
// is fine — what matters for parity is the call name, bound, and
// drawn value.
function callKey(call) {
    if (!call) return null;
    const at = call.indexOf(' @ ');
    return at < 0 ? call : call.slice(0, at);
}
function callStatus(c) {
    if (c.canon && c.js)  return callKey(c.canon) === callKey(c.js) ? 'match' : 'diff';
    if (c.canon && !c.js) return 'canon_only';
    if (c.js && !c.canon) return 'js_only';
    return 'empty';
}
function colorForStatus(status, side) {
    switch (status) {
        case 'match':      return COLOR_MATCH;
        case 'diff':       return COLOR_DIFF;
        case 'canon_only': return side === 'js' ? COLOR_INACTIVE : COLOR_CANON_ONLY;
        case 'js_only':    return side === 'js' ? COLOR_JS_ONLY : COLOR_INACTIVE;
    }
    return COLOR_INACTIVE;
}

// Single-canvas layout. All three rows share the same x mapping so they
// align perfectly. Labels are drawn into the canvas itself.
const ROW_LABEL_W = 56;       // left gutter for labels
const ROW_CANON_Y0 = 0;
const ROW_CANON_H = 54;
const ROW_GAP = 2;
const ROW_JS_Y0  = ROW_CANON_Y0 + ROW_CANON_H + ROW_GAP;
const ROW_JS_H   = 54;
const ROW_SCREEN_Y0 = ROW_JS_Y0 + ROW_JS_H + ROW_GAP;
const ROW_SCREEN_H  = 14;     // 3-way stack works at ~4-5px per band
const TIMELINE_H    = ROW_SCREEN_Y0 + ROW_SCREEN_H;

function fracToX(frac) {
    const cv = $('#timeline');
    const dataX0 = ROW_LABEL_W;
    const dataW  = cv.width - ROW_LABEL_W;
    return dataX0 + Math.round(frac * dataW);
}

function drawTimelines() {
    const cv = $('#timeline');
    const W = cv.width;
    const H = cv.height;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const calls = CURRENT_ALIGNED.calls;
    const ranges = CURRENT_ALIGNED.stepRanges;
    const dataX0 = ROW_LABEL_W;
    const dataW  = W - ROW_LABEL_W;
    const maxBound = calls.reduce((m, c) => Math.max(m, callBound(c.canon), callBound(c.js)), 1);
    const maxHeight = Math.log2(Math.max(2, maxBound + 1));

    const drawBar = (y0, h, x, w, height01, color) => {
        const barH = Math.max(2, Math.round((h - 4) * height01));
        ctx.fillStyle = color;
        ctx.fillRect(x, y0 + h - barH, Math.max(1, w), barH);
    };

    // Background row tints — very faint dark wash on the parchment canvas
    // to delineate rows without drawing borders.
    ctx.fillStyle = 'rgba(0,0,0,0.025)';
    ctx.fillRect(dataX0, ROW_CANON_Y0, dataW, ROW_CANON_H);
    ctx.fillRect(dataX0, ROW_JS_Y0,    dataW, ROW_JS_H);

    // Render each step into its own pixel range. Within a step, calls
    // are spread evenly across [x0, x1); when there are more calls than
    // pixels we aggregate, and when there are more pixels than calls
    // each call gets ⌈stepW / callCount⌉ pixels of width.
    for (const sr of ranges) {
        const x0 = fracToX(sr.xFrac0);
        const x1 = Math.max(x0 + 1, fracToX(sr.xFrac1));
        const stepW = x1 - x0;
        const callsHere = sr.callCount;

        // Step background: green-tint if every call matches, red-tint if any diff.
        let stepHasDiff = false;
        for (let k = sr.start; k < sr.end; k++) {
            if (callStatus(calls[k]) !== 'match') { stepHasDiff = true; break; }
        }
        const bg = stepHasDiff ? COLOR_BG_DIFF : COLOR_BG_OK;
        ctx.fillStyle = bg;
        ctx.fillRect(x0, ROW_CANON_Y0, stepW, ROW_CANON_H);
        ctx.fillRect(x0, ROW_JS_Y0,    stepW, ROW_JS_H);

        if (callsHere === 0) continue;

        // For each pixel column inside this step, aggregate the calls
        // it covers.
        for (let xi = 0; xi < stepW; xi++) {
            const x = x0 + xi;
            const callLo = sr.start + Math.floor((xi * callsHere) / stepW);
            const callHi = Math.max(callLo + 1, sr.start + Math.floor(((xi + 1) * callsHere) / stepW));
            let canonH = 0, jsH = 0;
            let canonStatus = null, jsStatus = null;
            for (let k = callLo; k < callHi && k < sr.end; k++) {
                const c = calls[k];
                canonH = Math.max(canonH, callHeight(c.canon));
                jsH    = Math.max(jsH,    callHeight(c.js));
                const st = callStatus(c);
                if (st === 'match') {
                    canonStatus = canonStatus || 'match';
                    jsStatus    = jsStatus    || 'match';
                } else if (st === 'diff') {
                    canonStatus = 'diff'; jsStatus = 'diff';
                } else if (st === 'canon_only') {
                    canonStatus = 'canon_only';
                    if (!jsStatus) jsStatus = 'canon_only';
                } else if (st === 'js_only') {
                    jsStatus = 'js_only';
                    if (!canonStatus) canonStatus = 'js_only';
                }
            }
            if (canonH > 0) drawBar(ROW_CANON_Y0, ROW_CANON_H, x, 1, canonH / maxHeight, colorForStatus(canonStatus, 'canon'));
            if (jsH > 0)    drawBar(ROW_JS_Y0,    ROW_JS_H,    x, 1, jsH    / maxHeight, colorForStatus(jsStatus,    'js'));
        }
    }

    // Step boundaries — faint verticals across canon + js rows.
    ctx.strokeStyle = COLOR_GRID;
    ctx.lineWidth = 1;
    for (let i = 1; i < ranges.length; i++) {
        const x = fracToX(ranges[i].xFrac0) + 0.5;
        ctx.beginPath();
        ctx.moveTo(x, ROW_CANON_Y0);
        ctx.lineTo(x, ROW_JS_Y0 + ROW_JS_H);
        ctx.stroke();
    }
    // Segment boundaries — a bold dark-brown bar spanning the full
    // timeline. Multi-game / save+restore sessions read at a glance.
    ctx.fillStyle = '#3a2818';
    let prevSeg = -1;
    for (const sr of ranges) {
        if (sr.segIdx !== prevSeg && sr.xFrac0 > 0) {
            const x = fracToX(sr.xFrac0);
            ctx.fillRect(x - 2, ROW_CANON_Y0, 4, ROW_SCREEN_Y0 + ROW_SCREEN_H);
        }
        prevSeg = sr.segIdx;
    }

    // Screen-match strip. Each step gets a column subdivided into one band
    // per active diff type (char / attr / cursor), in that vertical order.
    // Steps with no diff fill the strip with the muted "match" color so the
    // user gets a quiet baseline that the colored bands stand out against.
    for (const sr of ranges) {
        const x0 = fracToX(sr.xFrac0);
        const x1 = Math.max(x0 + 1, fracToX(sr.xFrac1));
        const w = x1 - x0;
        const seg = CURRENT.segments[sr.segIdx];
        const st = seg.steps[sr.stepInSeg];
        const d = st._diff || { char: false, attr: false, cursor: false };
        const bands = [];
        if (d.char)   bands.push(COLOR_DIFF_CHAR);
        if (d.attr)   bands.push(COLOR_DIFF_ATTR);
        if (d.cursor) bands.push(COLOR_DIFF_CURSOR);
        if (bands.length === 0) {
            ctx.fillStyle = COLOR_MATCH;
            ctx.fillRect(x0, ROW_SCREEN_Y0, w, ROW_SCREEN_H);
        } else {
            const bandH = ROW_SCREEN_H / bands.length;
            for (let i = 0; i < bands.length; i++) {
                ctx.fillStyle = bands[i];
                const y = ROW_SCREEN_Y0 + Math.round(i * bandH);
                const yEnd = ROW_SCREEN_Y0 + Math.round((i + 1) * bandH);
                ctx.fillRect(x0, y, w, yEnd - y);
            }
        }
    }

    // (Row labels live as DOM elements over the gutter — see #timeline-wrap
    // .row-labels in index.html — so they stay sharp regardless of how the
    // canvas is CSS-scaled.)
}

// Match canvas internal width to its display width so per-pixel timeline
// detail isn't blurred by CSS scaling. Re-runs on resize.
function syncCanvasSize() {
    const cv = $('#timeline');
    const desired = Math.max(400, Math.floor(cv.clientWidth || cv.offsetWidth));
    if (cv.width !== desired) cv.width = desired;
}
let _resizeObs = null;
function installResizeHandler() {
    if (_resizeObs) return;
    _resizeObs = new ResizeObserver(() => {
        syncCanvasSize();
        if (CURRENT_ALIGNED) {
            // Re-render with new pixel width.
            const step = parseInt($('#step-readout').dataset.step || '0', 10);
            render(step);
        }
    });
    _resizeObs.observe($('#timeline'));
}

function drawStepCursor(stepIdx) {
    if (!CURRENT_ALIGNED) return;
    const sr = CURRENT_ALIGNED.stepRanges[stepIdx];
    if (!sr) return;
    const cv = $('#timeline');
    const x0 = fracToX(sr.xFrac0);
    const x1 = Math.max(x0 + 2, fracToX(sr.xFrac1));
    const ctx = cv.getContext('2d');
    ctx.save();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
    ctx.fillRect(x0, 0, x1 - x0, TIMELINE_H);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.95)';
    ctx.fillRect(x0, 0, 2, TIMELINE_H);
    ctx.fillRect(x1 - 2, 0, 2, TIMELINE_H);
    ctx.restore();
}

// Click + drag handler; installed once at module load and re-resolves
// state (CURRENT_ALIGNED, totalSteps()) per-event. Earlier we registered
// it inside wireTimelineClicks() per session-load, which piled up stale
// listeners that clamped using the previous session's step count.
let _clickHandlerInstalled = false;
function wireTimelineClicks() {
    if (_clickHandlerInstalled) return;
    _clickHandlerInstalled = true;
    const cv = $('#timeline');
    const onClick = (ev) => {
        if (!CURRENT_ALIGNED) return;
        const rect = cv.getBoundingClientRect();
        const cssToCanvas = cv.width / rect.width;
        const cx = (ev.clientX - rect.left) * cssToCanvas;
        const dataX0 = ROW_LABEL_W;
        const dataW  = cv.width - ROW_LABEL_W;
        const frac = Math.max(0, Math.min(1, (cx - dataX0) / dataW));
        let step = 0;
        for (let i = 0; i < CURRENT_ALIGNED.stepRanges.length; i++) {
            const sr = CURRENT_ALIGNED.stepRanges[i];
            if (frac < sr.xFrac1) { step = i; break; }
            step = i;
        }
        step = Math.max(0, Math.min(totalSteps() - 1, step));
        render(step);
    };
    cv.addEventListener('mousedown', (ev) => {
        onClick(ev);
        const move = (e) => onClick(e);
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    });
}

// Keyboard navigation lives at module scope — registered once at load
// so re-loading a session with a different step count doesn't pile up
// stale listeners that clamp using an old total.
let _keyHandlerInstalled = false;
function installKeyboardNav() {
    if (_keyHandlerInstalled) return;
    _keyHandlerInstalled = true;
    document.addEventListener('keydown', (ev) => {
        if (!CURRENT_ALIGNED) return;
        if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
        const total = totalSteps();   // resolved fresh per keypress
        let cur = parseInt($('#step-readout').dataset.step || '0', 10);
        const stride = ev.shiftKey ? 10 : 1;
        if (ev.key === 'ArrowLeft')  cur = Math.max(0, cur - stride);
        else if (ev.key === 'ArrowRight') cur = Math.min(total - 1, cur + stride);
        else return;
        ev.preventDefault();
        render(cur);
    });
}

// --- Map render ---------------------------------------------------------
function render(stepIdx) {
    const total = totalSteps();
    if (!CURRENT || stepIdx < 0 || stepIdx >= total) return;
    const where = flatStep(stepIdx);
    if (!where) return;
    const readout = $('#step-readout');
    // The hint segment stays together as one nowrap unit so it can't
    // break "←/→" away from "to navigate" when the chrome is narrow.
    readout.innerHTML =
        `step ${stepIdx + 1} / ${total}  (seg ${where.segIdx})  · `
        + `<span class="nowrap">←/→ to navigate</span>`;
    readout.dataset.step = String(stepIdx);
    writeHash({ session: currentSessionShort(), step: stepIdx, view: CURRENT_VIEW });
    // Re-render timelines (clears the previous cursor highlight) then draw
    // the new step cursor on top.
    drawTimelines();
    drawStepCursor(stepIdx);

    const st = where.step;
    const canon = decodeScreen(st.canonScreen);
    const js = decodeScreen(st.jsScreen);

    const grid = $('#map-grid');
    grid.innerHTML = '';
    const [ccx, ccy] = st.canonCursor;
    const [jcx, jcy] = st.jsCursor;
    for (let r = 0; r < ROWS_24; r++) {
        const row = document.createElement('span');
        row.className = 'map-row';
        for (let c = 0; c < COLS_80; c++) {
            const jc = js[r][c];
            const cc = canon[r][c];
            const d = diffCell(cc, jc);
            const jsRender = renderCell(jc);
            const canonRender = renderCell(cc);
            const span = document.createElement('span');
            span.className = 'map-cell';

            // Choose which side to draw and whether to overlay the diff.
            // canon mode: canonical recording, with diff overlay so you
            //             can see WHERE the JS port diverges
            // js mode:    pure JS port, also with diff overlay
            // diff mode:  overlay — show whichever side is informative
            let cell, text, mark = null;
            if (CURRENT_VIEW === 'canon') {
                cell = cc; text = canonRender;
                if (d === 'ch')   mark = 'ch';
                else if (d === 'attr') mark = 'attr';
            } else if (CURRENT_VIEW === 'js') {
                cell = jc; text = jsRender;
                if (d === 'ch')   mark = 'ch';
                else if (d === 'attr') mark = 'attr';
            } else {
                // diff overlay (the original behavior): for char-diffs where
                // JS rendered whitespace, surface the CANON char so the user
                // can see what's missing.
                const showCanon = (d === 'ch' && (jsRender === ' ' || jsRender === ''));
                cell = showCanon ? cc : jc;
                text = showCanon ? canonRender : jsRender;
                if (d === 'ch')   mark = 'ch';
                else if (d === 'attr') mark = 'attr';
            }

            span.textContent = text || ' ';
            span.style.color = colorToCss(cell.color);
            if (cell.attr & 2) span.style.fontWeight = 'bold';
            if (cell.attr & 1) {
                span.style.background = colorToCss(cell.color);
                span.style.color = '#000';
            }
            if (mark === 'ch') {
                span.classList.add('ch-diff');
                span.title = `expected '${canonRender}', js produced '${jsRender}'`;
            } else if (mark === 'attr') {
                span.classList.add('attr-diff');
                span.title = `attr/color differs: canon=${cc.color}/${cc.attr} js=${jc.color}/${jc.attr}`;
            }

            // Cursor highlight. In every mode we anchor on the side
            // being drawn but also mark the OTHER side's cursor when it
            // differs, so the user can see the JS divergence even while
            // looking at canon.
            const isCanonCursor = (c === ccx && r === ccy);
            const isJsCursor    = (c === jcx && r === jcy);
            if (CURRENT_VIEW === 'canon') {
                if (isCanonCursor) span.classList.add('cursor-canon');
                if (isJsCursor && !isCanonCursor) {
                    span.classList.add('cursor-js');
                    span.classList.add('cursor-diff');
                }
            } else if (CURRENT_VIEW === 'js') {
                if (isJsCursor) span.classList.add('cursor-js');
                if (isCanonCursor && !isJsCursor) {
                    span.classList.add('cursor-canon');
                    span.classList.add('cursor-diff');
                }
            } else {
                if (isCanonCursor && !isJsCursor) span.classList.add('cursor-canon');
                if (isJsCursor && !isCanonCursor) span.classList.add('cursor-js');
                if (isCanonCursor !== isJsCursor) span.classList.add('cursor-diff');
            }
            row.appendChild(span);
        }
        grid.appendChild(row);
    }

    // step key
    const k = st.key == null ? '∅ (initial)' : keyName(st.key);
    $('#step-key').textContent = `step ${stepIdx + 1}  key: ${k}`;

    // cursor detail
    const cursorOk = ccx === jcx && ccy === jcy;
    $('#cursor-detail').innerHTML =
        `canon = [${ccx}, ${ccy}]<br>js&nbsp;&nbsp;&nbsp;= [${jcx}, ${jcy}]` +
        (cursorOk ? '' : '<br><span class="rng-line diff">cursor mismatch</span>');

    // rng detail
    renderRngDetail(st.canonRng, st.jsRng);

    // message line (row 0 plain text, no escapes)
    $('#msg-detail').textContent = (canon[0].map(renderCell).join('').trimEnd() || '(empty)')
        + (canon[0].map(renderCell).join('') === js[0].map(renderCell).join('') ? '' : '\n  js: ' + (js[0].map(renderCell).join('').trimEnd() || '(empty)'));
}

function renderRngDetail(canonRng, jsRng) {
    const out = $('#rng-detail');
    out.innerHTML = '';
    const ap = canonRng.filter((e) => typeof e === 'string' && e[0] !== '<' && e[0] !== '>' && e[0] !== '^');
    const bp = jsRng.filter((e) => typeof e === 'string' && e[0] !== '<' && e[0] !== '>' && e[0] !== '^');
    if (!ap.length && !bp.length) {
        out.textContent = '(no PRNG calls)';
        return;
    }
    const max = Math.max(ap.length, bp.length);
    for (let i = 0; i < max; i++) {
        const a = ap[i];
        const b = bp[i];
        const line = document.createElement('span');
        line.className = 'rng-line';
        const aKey = callKey(a);
        const bKey = callKey(b);
        if (a && b && aKey === bKey) {
            line.classList.add('match');
            // Show the short form; full annotation lives in the title attr.
            line.textContent = `${i.toString().padStart(3, ' ')}  ${aKey}`;
            line.title = `canon: ${a}\njs:    ${b}`;
        } else if (a && !b) {
            line.classList.add('missing');
            line.textContent = `${i.toString().padStart(3, ' ')}  canon: ${a}`;
        } else if (b && !a) {
            line.classList.add('extra');
            line.textContent = `${i.toString().padStart(3, ' ')}  js:    ${b}`;
        } else {
            line.classList.add('diff');
            line.textContent = `${i.toString().padStart(3, ' ')}  canon: ${a}\n     js:    ${b}`;
        }
        out.appendChild(line);
    }
}

function keyName(k) {
    if (k == null) return '∅';
    const code = k.charCodeAt(0);
    if (code === 13) return 'CR';
    if (code === 10) return 'LF';
    if (code === 27) return 'ESC';
    if (code === 32) return 'SPC';
    if (code === 127) return 'DEL';
    if (code < 32) return `^${String.fromCharCode(code + 64)}`;
    return JSON.stringify(k);
}
