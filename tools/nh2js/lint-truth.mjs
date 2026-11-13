#!/usr/bin/env node
// lint-truth.mjs <js-dir|file ...>: C truth values returned bare.
//
// Every emitted function is a C function (or a C macro), and none returns a C truth value as a
// JS boolean: a `return` whose expression is, at its top level, a comparison, a !, or && / ||
// (outside the test of a ?:) must have been converted to 0/1 by the rewriter (+(a < b),
// (x ? 1 : 0)). Prints each offending site; exit status 1 if there is one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// the code of a JS text with comments blanked and string/template contents replaced by spaces
function codeOnly(t) {
  let o = "";
  for (let i = 0; i < t.length; i++) {
    const c = t[i], d = t[i + 1];
    if (c === "/" && d === "/") { while (i < t.length && t[i] !== "\n") { o += " "; i++; } o += t[i] ?? ""; continue; }
    if (c === "/" && d === "*") {
      o += "  ";
      i += 2;
      while (i < t.length && !(t[i] === "*" && t[i + 1] === "/")) { o += t[i] === "\n" ? "\n" : " "; i++; }
      o += "  ";
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      o += c; i++;
      while (i < t.length && t[i] !== c) { if (t[i] === "\\") { o += " "; i++; } o += t[i] === "\n" ? "\n" : " "; i++; }
      o += c; continue;
    }
    o += c;
  }
  return o;
}

const OPS = /===|!==|==|!=|<=|>=|&&|\|\||(?<![<>=\-])[<>](?![<>=])/;

// is the expression e (code only) a bare truth value at its top level?
export function bareTruth(e) {
  e = e.trim();
  while (e.startsWith("(") && closes(e)) e = e.slice(1, -1).trim();
  if (/^\+/.test(e)) return false;                 // +(...) / +!x: converted
  // split on a top-level ?: : only the branches are values
  const q = topLevel(e, "?");
  if (q >= 0) {
    const rest = e.slice(q + 1), c = topLevel(rest, ":");
    return c >= 0 && (bareTruth(rest.slice(0, c)) || bareTruth(rest.slice(c + 1)));
  }
  if (/^!(?!=)/.test(e)) return true;
  const flat = depth0(e);
  // a top-level comma: only the last operand is the value
  const k = flat.lastIndexOf(",");
  if (k >= 0) return bareTruth(e.slice(k + 1));
  return OPS.test(flat.replace(/=>/g, "  "));
}
function closes(e) {
  let d = 0;
  for (let i = 0; i < e.length; i++) {
    if ("([{".includes(e[i])) d++;
    else if (")]}".includes(e[i])) {
      d--;
      if (d === 0 && i < e.length - 1) return false;
    }
  }
  return true;
}
function depth0(e) {
  let d = 0,
    o = "";
  for (const c of e) {
    if ("([{".includes(c)) {
      d++;
      o += " ";
      continue;
    }
    if (")]}".includes(c)) {
      d--;
      o += " ";
      continue;
    }
    o += d ? " " : c;
  }
  return o;
}
function topLevel(e, ch) { const f = depth0(e); return f.indexOf(ch); }

export function lintText(text) {
  const code = codeOnly(text), out = [];
  for (const m of code.matchAll(/\breturn\b/g)) {
    let i = m.index + 6, d = 0;
    const s = i;
    for (; i < code.length; i++) {
      const c = code[i];
      if ("([{".includes(c)) d++;
      else if (")]}".includes(c)) { if (d === 0) break; d--; }
      else if (c === ";" && d === 0) break;
    }
    const e = code.slice(s, i);
    if (e.trim() && bareTruth(e))
      out.push({
        line: code.slice(0, m.index).split("\n").length,
        text: text
          .slice(m.index, i + 1)
          .replace(/\s+/g, " ")
          .slice(0, 160),
      });
  }
  return out;
}

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isFile()) { if (/\.js$/.test(p)) out.push(p); return out; }
  for (const e of fs.readdirSync(p)) walk(path.join(p, e), out);
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let n = 0;
  for (const a of process.argv.slice(2))
    for (const f of walk(a))
      for (const x of lintText(fs.readFileSync(f, "latin1"))) {
        n++;
        console.log(`${f}:${x.line}: ${x.text}`);
      }
  console.log(`${n} bare truth-value returns`);
  process.exit(n ? 1 : 0);
}
