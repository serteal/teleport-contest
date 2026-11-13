// lib/layout.mjs: the final layout of an emitted module.
//
// The printer emits every module line for line with its C file (line N of the JS is line N of
// the C; the rules that place local macros, tables and comments rely on it). This pass then
// lays the text out as it is written to js/:
//   - LINE_BREAK marks become line breaks
//   - no trailing whitespace
//   - runs of blank lines become one blank line (none at the start of the file, after a line
//     opening a block or before a line closing one); a skipped
//     preprocessor block of MARK_LINES lines or more that left only blank lines becomes one
//     comment line naming its directive (`/* #ifdef TTY_PERM_INVENT: not in this build */`)
// Lines inside a template literal, a string continued with `\` or a block comment are never
// changed. The result carries the line map: for each output line, the C line (0-based) it was
// printed from, or -1 (lines after the C text: imports, header-defined functions, tables).

export const MARK_LINES = 10;

/**
 * A line break the printer writes where the C has none (U+2028: a line terminator to the JS
 * parser, not a "\n" to the line-for-line rules): this pass makes it a newline. The first of
 * the lines it splits keeps the C line in the map.
 */
export const LINE_BREAK = "\u2028";

/**
 * State at the start of each line: 0 code, 1 inside a block comment, 2 inside a template
 * literal, 3 inside a string continued with `\` + newline. (Emitted modules have no regular
 * expression literals.)
 */
export function lineStates(text) {
  const out = [0];
  let st = 0;            // 0 code, 1 block comment, 2 template, 3 '/" string, 4 line comment
  let q = "";            // quote of the open string
  const tmpl = [];       // template nesting: brace depth of each open `${`
  let depth = 0;         // brace depth inside the innermost `${ }`
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "\n") {
      if (st === 4) st = 0;
      out.push(st === 3 ? 3 : st === 2 ? 2 : st === 1 ? 1 : 0);
      continue;
    }
    switch (st) {
      case 0:
        if (c === "/" && text[i + 1] === "*") { st = 1; i++; }
        else if (c === "/" && text[i + 1] === "/") st = 4;
        else if (c === '"' || c === "'") { st = 3; q = c; }
        else if (c === "`") { st = 2; }
        else if (tmpl.length && c === "{") depth++;
        else if (tmpl.length && c === "}") { if (depth === 0) { depth = tmpl.pop(); st = 2; } else depth--; }
        break;
      case 1: if (c === "*" && text[i + 1] === "/") { st = 0; i++; } break;
      case 2:
        if (c === "\\") i++;
        else if (c === "`") st = 0;
        else if (c === "$" && text[i + 1] === "{") { tmpl.push(depth); depth = 0; st = 0; i++; }
        break;
      case 3:
        if (c === "\\") { if (text[i + 1] === "\n") { i++; out.push(3); } else i++; }
        else if (c === q) st = 0;
        break;
      case 4: break;
    }
  }
  return out;
}

/** The preprocessor blocks of a C text skipped by the build: [{ first, last, label }] (0-based lines). */
export function skippedBlocks(cText, skipped) {
  const lines = cText.split("\n");
  const ls = [0];
  for (let i = 0; i < cText.length; i++) if (cText.charCodeAt(i) === 10) ls.push(i + 1);
  const lineOf = (o) => {
    let lo = 0,
      hi = ls.length - 1;
    while (lo < hi) {
      const m = (lo + hi + 1) >> 1;
      if (ls[m] <= o) lo = m;
      else hi = m - 1;
    }
    return lo;
  };
  // the opening directive of each #else/#elif line (for its label)
  const open = new Map(), stack = [];
  const dir = (l) => l.replace(/\/\*.*?\*\/|\/\/.*$|\/\*.*$/g, "").replace(/\s+/g, " ").trim();
  lines.forEach((l, i) => {
    const m = /^\s*#\s*(if|ifdef|ifndef|elif|else|endif)\b/.exec(l);
    if (!m) return;
    if (m[1].startsWith("if")) stack.push(dir(l));
    else if (m[1] === "endif") stack.pop();
    else open.set(i, stack[stack.length - 1]);
  });
  const out = [];
  for (const r of skipped) {
    const first = lineOf(r.b), last = lineOf(Math.max(r.b, r.e - 1));
    let label = dir(lines[first] || "").replace(/^#\s*/, "#");
    if (!/^#(if|elif|else)/.test(label)) continue;
    if (/^#(else|elif)/.test(label) && open.get(first)) label = `${label} (${open.get(first)})`;
    out.push({ first, last, label: label.replace(/\*\//g, "* /") });
  }
  return out;
}

/**
 * Lay out a module printed line for line with cText. blocks: skippedBlocks() of the C file
 * (or []). Returns { text, map }.
 */
export function layout(text, { cLines = 0, blocks = [] } = {}) {
  const src = [];
  text
    .split("\n")
    .forEach((t, i) => t.split(LINE_BREAK).forEach((p, k) => src.push({ t: p, c: !k && i < cLines ? i : -1 })));
  const states = lineStates(src.map((l) => l.t).join("\n"));
  let lines = src.map((l, i) => ({ ...l, st: states[i] }));
  // no trailing whitespace (unless the line ends inside a template literal or string)
  lines.forEach((l, i) => {
    const next = states[i + 1] ?? 0;
    if (next !== 2 && next !== 3) l.t = l.t.replace(/[ \t]+$/, "");
  });
  lines = markSkipped(lines, blocks);
  lines = collapseBlank(lines);
  return { text: lines.map((l) => l.t).join("\n"), map: lines.map((l) => l.c) };
}

const isBlank = (l) => l.st === 0 && /^[ \t]*$/.test(l.t);

/** A skipped block that left only blank lines: one comment line at its directive's line. */
function markSkipped(lines, blocks) {
  const byFirst = new Map();
  for (const b of blocks) if (b.last - b.first + 1 >= MARK_LINES) byFirst.set(b.first, b);
  if (!byFirst.size) return lines;
  const at = new Map(lines.map((l, i) => [l.c, i]).filter(([c]) => c >= 0));
  for (const b of byFirst.values()) {
    const i0 = at.get(b.first), i1 = at.get(b.last);
    if (i0 === undefined || i1 === undefined || i1 - i0 !== b.last - b.first) continue; // (lines split inside)
    let all = true;
    for (let i = i0; i <= i1 && all; i++) all = isBlank(lines[i]);
    if (!all) continue;
    // indented like the code that follows
    let k = i1 + 1;
    while (k < lines.length && isBlank(lines[k])) k++;
    const ind = k < lines.length && lines[k].st === 0 ? /^[ \t]*/.exec(lines[k].t)[0] : "";
    lines[i0] = { ...lines[i0], t: `${ind}/* ${b.label}: not in this build */` };
  }
  return lines;
}

// a line opening a block (code ends with `{`, a comment may follow) / closing one
const opens = (l) => l.st === 0 && /\{[ \t]*(\/\*.*\*\/[ \t]*|\/\/.*)?$/.test(l.t);
const closes = (l) => l.st === 0 && /^[ \t]*\}/.test(l.t);

/**
 * At most one blank line in a row, none after a line opening a block or before one closing it;
 * none at the start; one final newline.
 */
function collapseBlank(lines) {
  const out = [];
  for (const l of lines) {
    if (isBlank(l)) {
      const prev = out[out.length - 1];
      if (!prev || isBlank(prev) || opens(prev)) continue;
      out.push({ ...l, t: "" });
    } else {
      if (closes(l)) while (out.length && isBlank(out[out.length - 1])) out.pop();
      out.push(l);
    }
  }
  while (out.length > 1 && isBlank(out[out.length - 1]) && isBlank(out[out.length - 2])) out.pop();
  return out;
}

/** The line map as runs [jsLine, cLine, count] (0-based; lines without a C line left out). */
export function encodeMap(map) {
  const runs = [];
  map.forEach((c, j) => {
    if (c < 0) return;
    const r = runs[runs.length - 1];
    if (r && r[0] + r[2] === j && r[1] + r[2] === c) r[2]++;
    else runs.push([j, c, 1]);
  });
  return runs;
}

/** JS line (0-based) -> C line (0-based) or -1, from encodeMap() runs. */
export function decodeMap(runs, n) {
  const map = new Array(n).fill(-1);
  for (const [j, c, k] of runs) for (let i = 0; i < k; i++) map[j + i] = c + i;
  return map;
}
