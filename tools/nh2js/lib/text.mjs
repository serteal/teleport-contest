// lib/text.mjs: C source text helpers (comment/directive masks, gap cleaning, literals).

/** mask[i]: 0 code, 1 comment, 2 string/char literal, 3 preprocessor directive. */
export function maskOf(text, noDirectives = false) {
  const n = text.length, m = new Uint8Array(n);
  let i = 0, bol = true;
  while (i < n) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "*") {
      const e = text.indexOf("*/", i + 2), end = e < 0 ? n : e + 2;
      m.fill(1, i, end); i = end; continue;
    }
    if (c === "/" && text[i + 1] === "/") {
      let e = text.indexOf("\n", i); if (e < 0) e = n;
      m.fill(1, i, e); i = e; continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && text[j] !== c) { if (text[j] === "\\") j++; if (text[j] === "\n") break; j++; }
      m.fill(2, i, Math.min(n, j + 1)); i = j + 1; bol = false; continue;
    }
    if (c === "#" && bol && !noDirectives) {
      let j = i;
      for (;;) {
        let e = text.indexOf("\n", j); if (e < 0) e = n;
        const seg = text.slice(j, e), oc = seg.lastIndexOf("/*");
        if (oc >= 0 && seg.indexOf("*/", oc) < 0) {
          const ce = text.indexOf("*/", j + oc);
          e = text.indexOf("\n", ce < 0 ? n : ce); if (e < 0) e = n;
        }
        if (text[e - 1] === "\\") { j = e + 1; continue; }
        m.fill(3, i, e); i = e; break;
      }
      continue;
    }
    if (c === "\n") bol = true; else if (c !== " " && c !== "\t") bol = false;
    i++;
  }
  return m;
}

export function lineStarts(text) {
  const ls = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) ls.push(i + 1);
  return ls;
}

export function lineOf(ls, off) {
  let lo = 0, hi = ls.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ls[mid] <= off) lo = mid; else hi = mid - 1; }
  return lo;
}

export const countNL = (s) => {
  let k = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 10) k++;
  return k;
};

/** Replace every non-newline character in s by nothing (keep the line count). */
export const blankLines = (s) => "\n".repeat(countNL(s));

/**
 * A source file prepared for splicing: text, mask, skipped (inactive #if) ranges.
 * clean(s, e) returns text[s, e) with directive lines and inactive regions reduced to their
 * newlines (comments and whitespace kept).
 */
export class Source {
  constructor(text, skipped = [], opts = {}) {
    this.text = text;
    this.mask = maskOf(text, !!opts.noDirectives);
    this.dead = new Uint8Array(text.length);
    for (const r of skipped) this.dead.fill(1, r.b, Math.min(text.length, r.e));
    this.ls = lineStarts(text);
  }
  clean(s, e) {
    const t = this.text, m = this.mask, d = this.dead;
    let out = "", run = s;
    for (let i = s; i < e; i++) {
      if (m[i] === 3 || d[i]) {
        if (run < i) out += t.slice(run, i);
        // drop the character, keep newlines
        if (t.charCodeAt(i) === 10) out += "\n";
        run = i + 1;
      }
    }
    if (run < e) out += t.slice(run, e);
    return out;
  }
  /** clean() that also drops code characters for which drop(i) is true (comments kept). */
  cleanCode(s, e, drop) {
    const t = this.clean(s, e);
    if (t.length !== e - s) {
      // directives removed: fall back to a char-by-char pass
      let out = "";
      for (let i = s; i < e; i++) {
        const c = this.text[i];
        if (c === "\n") { out += c; continue; }
        if (this.mask[i] === 3 || this.dead[i]) continue;
        if (this.mask[i] === 0 && !/\s/.test(c) && drop(i)) continue;
        out += c;
      }
      return out;
    }
    let out = "";
    for (let i = s; i < e; i++) {
      const c = this.text[i];
      if (this.mask[i] === 0 && !/\s/.test(c) && drop(i)) continue;
      out += c;
    }
    return out;
  }
  line(off) { return lineOf(this.ls, off); }
  isCode(i) { return this.mask[i] === 0 && !this.dead[i]; }
}

/** Identifier-ish tokens in code (not comments/strings) of text[s, e). */
export function codeTokens(src, s, e) {
  const out = [];
  const re = /[A-Za-z_]\w*|\d[\w.]*|\S/g;
  re.lastIndex = s;
  let m;
  while ((m = re.exec(src.text)) && m.index < e) {
    if (!src.isCode(m.index)) continue;
    out.push({ s: m.index, e: m.index + m[0].length, t: m[0] });
  }
  return out;
}

// ---- literals ---------------------------------------------------------------------------

/** JS string-literal body for a byte array (double-quoted, ASCII-only, escapes as needed). */
export function jsStringBody(bytes) {
  let s = "";
  for (const b of bytes) {
    if (b === 0x22) s += '\\"';
    else if (b === 0x5c) s += "\\\\";
    else if (b === 0x0a) s += "\\n";
    else if (b === 0x09) s += "\\t";
    else if (b === 0x0d) s += "\\r";
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += "\\x" + b.toString(16).padStart(2, "0");
  }
  return s;
}

/**
 * Convert one C string/char literal token to a JS literal token with the same bytes, keeping
 * the spelling when it is already valid JS (only octal escapes and non-ASCII bytes change).
 */
export function cLiteralToJs(tok) {
  const q = tok[0];
  let out = q;
  for (let i = 1; i < tok.length - 1; i++) {
    const c = tok[i];
    if (c === "\\") {
      const d = tok[i + 1];
      if (/[0-7]/.test(d)) {
        let j = i + 1, v = 0, k = 0;
        while (k < 3 && /[0-7]/.test(tok[j])) { v = v * 8 + (tok.charCodeAt(j) - 48); j++; k++; }
        // "\0" not followed by a digit is valid JS; everything else becomes \xNN
        if (v === 0 && k === 1 && !/[0-9]/.test(tok[j])) out += "\\0";
        else out += "\\x" + v.toString(16).padStart(2, "0");
        i = j - 1;
        continue;
      }
      if (d === "e") { out += "\\x1b"; i++; continue; }
      if (d === "a") { out += "\\x07"; i++; continue; }
      if (d === "?") { out += "?"; i++; continue; }
      if (d === "x") {
        let j = i + 2, h = "";
        while (/[0-9a-fA-F]/.test(tok[j])) h += tok[j++];
        const v = parseInt(h, 16) & 255;
        out += "\\x" + v.toString(16).padStart(2, "0");
        i = j - 1;
        continue;
      }
      out += c + d; i++;
      continue;
    }
    const code = c.charCodeAt(0);
    if (code >= 0x80) { out += "\\x" + code.toString(16).padStart(2, "0"); continue; }
    out += c;
  }
  return out + q;
}
