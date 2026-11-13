// C library functions whose results follow the reference C library rather than the residue's
// musl.  Expected results:
//   regex-reference.json   regcomp(REG_EXTENDED | REG_NOSUB) codes, regexec() results, regerror() texts
//   atoi-reference.json    atoi / atoll of out-of-range and ordinary inputs
//   sscanf-reference.json  sscanf with the game's signed formats ("%lld", "%d%c")
// Calls go through js/rt/libc.js as emitted code makes them, on a machine of js/host/boot.js.
//   node --test test/host/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createMachine } from "../../js/host/boot.js";
import { uchars } from "../../js/rt/heap.js";
import { _ } from "../../js/rt/strings.js";
import * as libc from "../../js/rt/libc.js";
import { compile, matches } from "../../js/host/regex.js";
import { regerrorText } from "../../js/host/regerror.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
const m = createMachine({});
const latin1 = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));
function cstr(bytes) {
  const p = m.clib.fn.malloc(bytes.length + 1);
  uchars.set(bytes, p);
  uchars[p + bytes.length] = 0;
  return p;
}
const hexBytes = (h) => Uint8Array.from(Buffer.from(h, "hex"));

test("regex: regcomp codes and regexec results of the reference dialect (host/regex.js)", () => {
  const { subjects, cases } = fixture("regex-reference.json");
  const subs = subjects.map(latin1);
  for (const [pattern, code, bits] of cases) {
    const r = compile(latin1(pattern));
    assert.equal(r.err, code, `regcomp ${JSON.stringify(pattern)}`);
    if (code) continue;
    const got = subs.map((s) => (matches(r.nfa, s) ? "1" : "0")).join("");
    assert.equal(got, bits, `regexec ${JSON.stringify(pattern)}`);
  }
});

test("regex: through rt/libc.js regcomp/regexec/regfree, as posixregex.c calls them", () => {
  const REG_EXTENDED = 1, REG_NOSUB = 8;
  const preg = m.clib.fn.malloc(32);
  const check = (pattern, subject, want) => {
    assert.equal(libc.regcomp(preg, _(pattern), REG_EXTENDED | REG_NOSUB), 0, pattern);
    assert.equal(libc.regexec(preg, _(subject), 0, 0, 0), want ? 0 : libc.REG_NOMATCH, `${pattern} ~ ${subject}`);
    libc.regfree(preg);
  };
  check("\\bcursed\\b", "bcursedb", true); // no GNU escapes: \b is a literal b
  check("\\bcursed\\b", "a cursed dagger", false);
  check("[[:<:]]cursed[[:>:]]", "an uncursed dagger", false);
  check("[[:<:]]cursed[[:>:]]", "a cursed dagger", true);
  check("a{,2}", "a{,2}", true); // a '{' not followed by a number is literal
  check("x([[:<:]])?", "x", false); // TRE: the empty path keeps the group's assertion
  // errors: the dialect's codes; the regex_t is left empty, so regfree() of a failed regcomp is harmless
  for (const [pattern, code] of [["", 14], ["a||b", 14], ["a**", 13], ["a{256}", 18], ["a{1", 9], ["[[:foo:]]", 4], ["(", 8]]) {
    m.clib.HEAPU8.fill(0xaa, preg, preg + 32);
    assert.equal(libc.regcomp(preg, _(pattern), REG_EXTENDED | REG_NOSUB), code, pattern);
    libc.regfree(preg);
  }
  // other flags (not used by the game) stay with the residue
  assert.equal(libc.regcomp(preg, _("\\w+"), REG_EXTENDED | 2), 0);
  assert.equal(libc.regexec(preg, _("--ab--"), 0, 0, 0), 0);
  libc.regfree(preg);
});

test("regerror: the text of every code regcomp can return", () => {
  for (const [code, text] of fixture("regex-reference.json").messages) assert.equal(regerrorText(code), text, String(code));
});

test("atoi, atoll: saturation beyond the 64-bit range", () => {
  for (const [h, ai, all] of fixture("atoi-reference.json").cases) {
    const p = cstr(hexBytes(h));
    assert.equal(libc.atoi(p), ai, `atoi ${h}`);
    assert.equal(libc.atoll(p), Number(BigInt(all)), `atoll ${h}`);
    m.clib.fn.free(p);
  }
});

test("sscanf: %d / %lld saturate (bribe(), #levelchange)", () => {
  const bufs = [m.clib.fn.malloc(16), m.clib.fn.malloc(16)];
  const size = { i: 4, l: 8, c: 2 };
  for (const [fmt, h, ret, out, kinds] of fixture("sscanf-reference.json").cases) {
    for (const b of bufs) uchars.fill(0xaa, b, b + 16);
    const s = cstr(hexBytes(h));
    assert.equal(libc.sscanf(s, _(fmt), ...bufs.slice(0, kinds.length)), ret, `${fmt} ${h}`);
    kinds.forEach((k, i) => assert.equal(Buffer.from(uchars.subarray(bufs[i], bufs[i] + size[k])).toString("hex"), out[i], `${fmt} ${h} arg ${i}`));
    m.clib.fn.free(s);
  }
});

test("sprintf: %p prints \"0x\" and the hex digits (\"0x0\" for NULL)", () => {
  const b = m.clib.fn.malloc(64);
  for (const [v, want] of [[0, "0x0"], [1024, "0x400"], [0x12345678, "0x12345678"]]) {
    assert.equal(libc.sprintf(b, _("%p"), v), want.length);
    assert.equal(m.cstring(b), want);
    assert.equal(libc.snprintf(b, 0, _("%p"), v), want.length);
  }
});

test("printf: a long long held as 2^63 (LLONG_MAX as a Number) prints as LLONG_MAX in signed conversions", async () => {
  const { va_start } = await import("../../js/rt/varargs.js");
  const b = m.clib.fn.malloc(128);
  libc.sprintf(b, _("Invalid %s: %lld."), _("term_cols"), 2 ** 63);
  assert.equal(m.cstring(b), "Invalid term_cols: 9223372036854775807."); // atoll's LLONG_MAX
  libc.vsnprintf(b, 128, _("%d %lld %llu %llx"), va_start([5, 2 ** 63, 2 ** 63, 2 ** 63]));
  assert.equal(m.cstring(b), "5 9223372036854775807 9223372036854775808 8000000000000000");
});
