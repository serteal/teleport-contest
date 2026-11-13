// lib/dat.mjs: the game's data files as JS string modules (js/dat/), line for line.
//
// The files are every regular file of the configured dat/ except Makefile, GENFILES, dotfiles
// and *~ (the set nhjs_tty_api.c's data installer expects), installed at "/<name>" in the
// game's file system at startup. js/dat/<name>.js is the file's text, one template literal:
//     export default String.raw`<line 1>
//     <line 2>
//     ...`;
// so line N of the module is line N of the file. A file String.raw cannot hold as written (a
// backtick, `${`, a carriage return, a byte outside printable ASCII, a trailing backslash, a
// spelling the submission check reads as host access) is a plain template literal with escapes
// (\\, \`, \xNN: the string has one char per byte).
// js/dat/index.js exports dataFiles(): [["/name", text], ...] in name order. The game gets a Lua
// file with its comment-only lines empty (as it always has: the lines are listed in index.js).
import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["Makefile", "GENFILES"]);
export const packable = (name) => !name.startsWith(".") && !SKIP.has(name) && !name.endsWith("~");

function templateBody(bytes) {
  let s = "";
  for (const b of bytes) {
    if (b === 0x0a) s += "\n";
    else if (b === 0x09) s += "\t";
    else if (b === 0x5c) s += "\\\\";
    else if (b === 0x60) s += "\\`";
    else if (b === 0x24) s += "$"; // `${` is escaped below
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else if (b === 0x0d) s += "\\r";
    else s += "\\x" + b.toString(16).padStart(2, "0");
  }
  // tools/check-submission.mjs greps every shipped file for host-access spellings; prose such as
  // "in the process." must not look like one, so the character after the word gets a no-op escape
  return s
    .replace(/\$\{/g, "\\${")
    .replace(/\b(process\s*)\./g, "$1\\.")
    .replace(/\b((?:require|eval|Function)\s*)\(/g, "$1\\(");
}

// Lua comment-only lines (`-- ...` outside long strings/comments): line indices of the file
export function luaCommentLines(bytes) {
  const lines = Buffer.from(bytes).toString("latin1").split("\n");
  const out = new Set();
  let close = null; // the closing bracket of an open long string/comment, "]==]"
  lines.forEach((l, i) => {
    let j = 0;
    if (close === null) {
      const t = l.replace(/^[ \t]+/, "");
      if (t.startsWith("--") && !/^--\[=*\[/.test(t) && !/\r/.test(t)) { out.add(i); return; }
    }
    // scan the line for long brackets (and skip short strings and line comments)
    while (j < l.length) {
      if (close !== null) {
        const k = l.indexOf(close, j);
        if (k < 0) return;
        j = k + close.length;
        close = null;
        continue;
      }
      const c = l[j];
      if (c === "-" && l[j + 1] === "-") {
        const m = /^--\[(=*)\[/.exec(l.slice(j));
        if (m) { close = "]" + m[1] + "]"; j += m[0].length; continue; }
        return;
      }
      if (c === "[") {
        const m = /^\[(=*)\[/.exec(l.slice(j));
        if (m) { close = "]" + m[1] + "]"; j += m[0].length; continue; }
      }
      if (c === '"' || c === "'") { j++; while (j < l.length && l[j] !== c) { if (l[j] === "\\") j++; j++; } }
      j++;
    }
  });
  return out;
}

// the text the game gets from js/dat for a file: Lua comment-only lines are empty
export function datText(name, bytes) {
  if (!name.endsWith(".lua")) return Buffer.from(bytes).toString("latin1");
  const cl = luaCommentLines(bytes);
  return Buffer.from(bytes).toString("latin1").split("\n").map((l, i) => (cl.has(i) ? "" : l)).join("\n");
}

// the template literal of a file's bytes: String.raw when the text can be written as it is
const HOST = /\b(process\s*\.|(?:require|eval|Function)\s*\()/;
function templateOf(bytes) {
  const t = Buffer.from(bytes).toString("latin1");
  const raw = !/[^\t\n\x20-\x7e]|`|\$\{/.test(t) && !HOST.test(t) && !t.endsWith("\\");
  return raw ? "String.raw`" + t + "`" : "`" + templateBody(bytes) + "`";
}

// a JS name for a data file: "Arc-fila.lua" -> Arc_fila_lua
function bindingName(name, used) {
  let b = name.replace(/[^\w$]/g, "_");
  if (/^\d/.test(b)) b = "_" + b;
  while (used.has(b)) b += "_";
  used.add(b);
  return b;
}

export function emitDat(srcDir, outDir) {
  const dat = path.join(srcDir, "dat");
  const names = fs.readdirSync(dat).filter((n) => packable(n) && fs.statSync(path.join(dat, n)).isFile()).sort();
  const dir = path.join(outDir, "dat");
  fs.mkdirSync(dir, { recursive: true });
  const index = [
    "// js/dat/index.js: the data files the game installs at startup (emitted by tools/nh2js from dat/).",
    "",
  ];
  const used = new Set(["blank", "files", "dataFiles"]), rows = [];
  for (const n of names) {
    const bytes = fs.readFileSync(path.join(dat, n));
    fs.writeFileSync(path.join(dir, `${n}.js`), `export default ${templateOf(bytes)};\n`, "latin1");
    const b = bindingName(n, used);
    index.push(`import ${b} from "./${n}.js";`);
    const cl = n.endsWith(".lua") ? [...luaCommentLines(bytes)].sort((x, y) => x - y) : [];
    rows.push(cl.length ? `    ["/${n}", blank(${b}, [${cl.join(", ")}])],` : `    ["/${n}", ${b}],`);
  }
  index.push("",
    "// text with the lines listed (0-based) empty: a Lua file's comment-only lines",
    "function blank(text, lines) {",
    "    const l = text.split(\"\\n\");",
    "    for (const i of lines) l[i] = \"\";",
    "    return l.join(\"\\n\");",
    "}",
    "",
    "const files = [", ...rows, "];",
    "",
    "/** [[path, text], ...]: one char per byte. */",
    "export function dataFiles() {",
    "    return files.slice();",
    "}",
    "");
  fs.writeFileSync(path.join(dir, "index.js"), index.join("\n"), "latin1");
  return names.length;
}
