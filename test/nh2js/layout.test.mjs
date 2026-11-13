// Layout rules of emitted modules (node --test): lib/layout.mjs and the import statements.
import test from "node:test";
import assert from "node:assert/strict";
import { layout, lineStates, skippedBlocks, encodeMap, decodeMap, LINE_BREAK, MARK_LINES } from "../../tools/nh2js/lib/layout.mjs";
import { importStatement, IMPORT_WIDTH } from "../../tools/nh2js/lib/emit.mjs";

test("blank runs: at most one, none at the start, after { or before }", () => {
  const src = ["", "", "a();", "", "", "", "b();", "function f() {", "", "    c();", "", "}", "", ""].join("\n");
  const { text, map } = layout(src, { cLines: 14 });
  assert.equal(text, ["a();", "", "b();", "function f() {", "    c();", "}", ""].join("\n"));
  assert.deepEqual(map, [2, 3, 6, 7, 9, 11, 12]);
});

test("lines inside template literals, continued strings and block comments are kept", () => {
  const src = ["x = `a  ", "", "", "b`;  ", "/* c  ", "", "", "d */", "y = \"e\\", "", "f\";"].join("\n");
  const { text } = layout(src);
  assert.equal(text, ["x = `a  ", "", "", "b`;", "/* c", "", "", "d */", "y = \"e\\", "", "f\";"].join("\n"));
  assert.deepEqual(lineStates("a `b\n${c}\nd` e\n/* x\n*/"), [0, 2, 2, 0, 1]);
});

test("trailing whitespace is dropped", () => {
  assert.equal(layout("a();   \n// b \t\n").text, "a();\n// b\n");
});

test("LINE_BREAK becomes a line break; the first piece keeps the C line", () => {
  const { text, map } = layout(`f() {${LINE_BREAK}    g();\n}\n`, { cLines: 3 });
  assert.equal(text, "f() {\n    g();\n}\n");
  assert.deepEqual(map, [0, -1, 1, 2]);
});

test("a skipped preprocessor block that left only blank lines is one comment", () => {
  const n = MARK_LINES + 2;
  const c = ["int a;", "#ifdef FOO", ...new Array(n - 2).fill("int x;"), "#endif", "int b;"];
  const cText = c.join("\n");
  const b = cText.indexOf("#ifdef"), e = cText.indexOf("#endif") + 6;
  const blocks = skippedBlocks(cText, [{ b, e }]);
  assert.deepEqual(blocks, [{ first: 1, last: n, label: "#ifdef FOO" }]);
  const js = ["let a;", ...new Array(n).fill(""), "let b;"].join("\n");
  assert.equal(layout(js, { cLines: c.length, blocks }).text, "let a;\n/* #ifdef FOO: not in this build */\n\nlet b;");
  // an #else branch names its #if
  const c2 = ["#if A", "x", "#else", ...new Array(n).fill("y"), "#endif"].join("\n");
  const b2 = c2.indexOf("#else");
  assert.equal(skippedBlocks(c2, [{ b: b2, e: c2.length }])[0].label, "#else (#if A)");
  // a short block: just blank lines
  assert.equal(layout("a\n\n\nb", { cLines: 4, blocks: [{ first: 1, last: 2, label: "#if 0" }] }).text, "a\n\nb");
});

test("line map runs round-trip", () => {
  const map = [0, 1, 2, -1, 5, 6, -1, -1, 9];
  assert.deepEqual(encodeMap(map), [[0, 0, 3], [4, 5, 2], [8, 9, 1]]);
  assert.deepEqual(decodeMap(encodeMap(map), map.length), map);
});

test("one import statement per module, wrapped at the width", () => {
  assert.equal(importStatement(["a", "b"], "./x.js"), 'import { a, b } from "./x.js";');
  const names = Array.from({ length: 40 }, (_, i) => `name_${i}`);
  const s = importStatement(names, "./x.js");
  const lines = s.split("\n");
  assert.equal(lines[0], "import {");
  assert.equal(lines[lines.length - 1], '} from "./x.js";');
  for (const l of lines) assert.ok(l.length <= IMPORT_WIDTH, l);
  assert.deepEqual(lines.slice(1, -1).join(" ").split(/,\s*/).filter(Boolean).map((x) => x.trim()), names);
});
