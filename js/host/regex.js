// host/regex.js - regcomp()/regexec() in the regex dialect of the reference C library.
//
// NetHack compiles the patterns of MENUCOLOR, MSGTYPE and AUTOPICKUP_EXCEPTION options with
// regcomp(REG_EXTENDED | REG_NOSUB) and only asks regexec() whether a string matches
// (sys/share/posixregex.c).  The reference dialect is TRE built with BSD_COMPATIBILITY and
// without REG_ENHANCED, in the "C" locale (the game never calls setlocale), where every byte
// is one character.  musl's regex is also TRE-based
// but another dialect: it reads \w \d \s \b \< \> and \1 as GNU extensions, accepts "a**",
// "^*", "a||b" and an empty pattern, rejects "[[:<:]]", "[[.a.]]", "a{,2}" and a literal "{".
// Users see the difference in which menu lines get colours, which messages are hidden and
// which objects are picked up, and in the error text of a pattern that does not compile.
//
// This module is that dialect, for those flags: parse() follows TRE's tre_parse(),
// tre_parse_bracket() and tre_parse_bound() step for step (same explicit parse stack, so the
// same error code for every malformed pattern), and the automaton is built and run the way
// tre_compile() and tre_tnfa_run_parallel() do it (see "TNFA" below: TRE's handling of
// assertions on empty paths is its own, and decides some matches).
//
//   compile(bytes)          -> { err } (a <regex.h> error code, see host/regerror.js) or { nsub, nfa }
//   matches(nfa, bytes)     -> boolean (regexec(..., 0, NULL, 0) == 0)
//
// The parser and matcher follow TRE, which is distributed under this licence:
//
//   Copyright (c) 2001-2009 Ville Laurikari <vl@iki.fi>
//   All rights reserved.
//
//   Redistribution and use in source and binary forms, with or without
//   modification, are permitted provided that the following conditions
//   are met:
//
//     1. Redistributions of source code must retain the above copyright
//        notice, this list of conditions and the following disclaimer.
//
//     2. Redistributions in binary form must reproduce the above copyright
//        notice, this list of conditions and the following disclaimer in the
//        documentation and/or other materials provided with the distribution.
//
//   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS
//   ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
//   LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
//   A PARTICULAR PURPOSE ARE DISCLAIMED.  IN NO EVENT SHALL THE COPYRIGHT
//   HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
//   SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
//   LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
//   DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
//   THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
//   (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
//   OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

// <regex.h> error codes of the dialect (1-13 have the same values as musl's)
export const REG_NOMATCH = 1, REG_ECOLLATE = 3, REG_ECTYPE = 4, REG_EESCAPE = 5, REG_EBRACK = 7,
  REG_EPAREN = 8, REG_EBRACE = 9, REG_BADBR = 10, REG_ERANGE = 11, REG_ESPACE = 12, REG_BADRPT = 13,
  REG_EMPTY = 14, REG_BADMAX = 18;

const RE_DUP_MAX = 255;
const INT_MAX = 2147483647;
const SUBMATCH_ID_INVISIBLE_START = 0x40000000;

// "C" locale character classes of the dialect's wctype()/iswctype() (bytes 0-255; nothing above
// 127 is in any class but "rune" covers 0-127)
const range = (lo, hi) => { const s = []; for (let c = lo; c <= hi; c++) s.push(c); return s; };
const chars = (t) => Array.from(t, (ch) => ch.charCodeAt(0));
const DIGIT = range(48, 57), UPPER = range(65, 90), LOWER = range(97, 122);
const PUNCT = [...range(33, 47), ...range(58, 64), ...range(91, 96), ...range(123, 126)];
const CLASSES = new Map(Object.entries({
  alnum: [...DIGIT, ...UPPER, ...LOWER],
  alpha: [...UPPER, ...LOWER],
  blank: [9, 32],
  cntrl: [...range(0, 31), 127],
  digit: DIGIT,
  graph: range(33, 126),
  ideogram: [],
  lower: LOWER,
  phonogram: [],
  print: range(32, 126),
  punct: PUNCT,
  rune: range(0, 127),
  space: [...range(9, 13), 32],
  special: [],
  upper: UPPER,
  xdigit: [...DIGIT, ...chars("ABCDEFabcdef")],
}));
const WORD = new Uint8Array(256); // IS_WORD_CHAR: '_' or iswalnum
for (const c of [...CLASSES.get("alnum"), 95]) WORD[c] = 1;

// Character names of [[.name.]] / [[=name=]] (FreeBSD regex/cname.h, which TRE searches
// first under BSD_COMPATIBILITY), in the table's order: tre_search_cnames() is a binary
// search over it, entry 0 being an empty sentinel.
const CNAMES = [
  ["", -1], ["ACK", 6], ["BEL", 7], ["BS", 8], ["CAN", 24], ["CR", 13], ["DC1", 17], ["DC2", 18], ["DC3", 19],
  ["DC4", 20], ["DEL", 127], ["DLE", 16], ["EM", 25], ["ENQ", 5], ["EOT", 4], ["ESC", 27], ["ETB", 23], ["ETX", 3],
  ["FF", 12], ["FS", 28], ["GS", 29], ["HT", 9], ["IS1", 31], ["IS2", 30], ["IS3", 29], ["IS4", 28], ["LF", 10],
  ["NAK", 21], ["NUL", 0], ["RS", 30], ["SI", 15], ["SO", 14], ["SOH", 1], ["STX", 2], ["SUB", 26], ["SYN", 22],
  ["US", 31], ["VT", 11], ["alert", 7], ["ampersand", 38], ["apostrophe", 39], ["asterisk", 42], ["backslash", 92],
  ["backspace", 8], ["carriage-return", 13], ["circumflex", 94], ["circumflex-accent", 94], ["colon", 58],
  ["comma", 44], ["commercial-at", 64], ["dollar-sign", 36], ["eight", 56], ["equals-sign", 61],
  ["exclamation-mark", 33], ["five", 53], ["form-feed", 12], ["four", 52], ["full-stop", 46], ["grave-accent", 96],
  ["greater-than-sign", 62], ["hyphen", 45], ["hyphen-minus", 45], ["left-brace", 123], ["left-curly-bracket", 123],
  ["left-parenthesis", 40], ["left-square-bracket", 91], ["less-than-sign", 60], ["low-line", 95], ["newline", 10],
  ["nine", 57], ["number-sign", 35], ["one", 49], ["percent-sign", 37], ["period", 46], ["plus-sign", 43],
  ["question-mark", 63], ["quotation-mark", 34], ["reverse-solidus", 92], ["right-brace", 125],
  ["right-curly-bracket", 125], ["right-parenthesis", 41], ["right-square-bracket", 93], ["semicolon", 59],
  ["seven", 55], ["six", 54], ["slash", 47], ["solidus", 47], ["space", 32], ["tab", 9], ["three", 51], ["tilde", 126],
  ["two", 50], ["underscore", 95], ["vertical-line", 124], ["zero", 48],
].map(([n, c]) => [chars(n), c]);

function searchCnames(re, start, len) {
  let low = 0, high = CNAMES.length - 1;
  while (low <= high) {
    const cur = (low + high) >>> 1;
    const name = CNAMES[cur][0];
    let cmp = 0;
    for (let i = 0; i < len; i++) { // wcsncmp(name, cnames[cur].name, len)
      const a = re[start + i], b = name[i] ?? 0;
      if (a !== b) { cmp = a - b; break; }
      if (!b) break;
    }
    if (cmp === 0 && name.length === len) return CNAMES[cur][1];
    if (cmp > 0) low = cur + 1;
    else high = cur - 1;
  }
  return -1;
}

// ---- AST ---------------------------------------------------------------------------------
// { t: "set", set: Uint8Array(256) } one character of a set; { t: "assert", a } BOL EOL BOW EOW;
// { t: "empty" }; { t: "cat" | "union", l, r }; { t: "iter", x, min, max (-1: unbounded) }.
// sub: TRE's submatch_id (-1 for a plain literal; needed for the "raw assertion" checks).
const lit = (set) => ({ t: "set", set, sub: -1 });
function single(c) { const s = new Uint8Array(256); s[c] = 1; return lit(s); }
const isRawAssertion = (n) => n.t === "assert" && n.sub < 0;

class ParseError { constructor(code) { this.code = code; } }
const fail = (code) => { throw new ParseError(code); };

/** tre_parse_bound(): `re[ctx.i]` follows the '{'. Returns REG_NOMATCH (the '{' is a
 *  literal), or { min, max, end } (end: index after the bound), or throws. */
function parseBound(re, ctx) {
  let r = ctx.i;
  const end = re.length;
  const parseInt = () => {
    let num = 0, overflow = false;
    const s = r;
    while (r < end && re[r] >= 48 && re[r] <= 57) {
      if (!overflow) { num = num * 10 + re[r] - 48; if (num > INT_MAX) overflow = true; }
      r++;
    }
    if (r === s) return -1;
    return overflow ? INT_MAX : num;
  };
  if (r >= end) return REG_NOMATCH;
  let min;
  if (re[r] >= 48 && re[r] <= 57) min = parseInt();
  else return REG_NOMATCH;
  let max = min;
  if (r < end && re[r] === 44 /* , */) {
    if (min < 0) min = 0;
    r++;
    max = parseInt();
  }
  if (max >= 0 && min > max) fail(REG_BADBR);
  if (min > RE_DUP_MAX || max > RE_DUP_MAX) fail(REG_BADMAX);
  if (r >= end) fail(REG_EBRACE);
  if (r === ctx.i) fail(REG_BADBR);
  if (re[r] !== 125 /* } */) fail(REG_BADBR);
  r++;
  if (r < end && (re[r] === 63 /* ? */ || re[r] === 42 /* * */ || re[r] === 43 /* + */)) fail(REG_BADRPT);
  return { min, max, end: r };
}

/** tre_parse_bracket(): `re[ctx.i]` follows the '['. */
function parseBracket(re, ctx) {
  const end = re.length;
  let p = ctx.i;
  // [[:<:]] and [[:>:]]
  if (end - p >= 6 && re[p] === 91 && re[p + 1] === 58 && (re[p + 2] === 60 || re[p + 2] === 62) &&
      re[p + 3] === 58 && re[p + 4] === 93 && re[p + 5] === 93) {
    ctx.i = p + 6;
    return { t: "assert", a: re[p + 2] === 60 ? "BOW" : "EOW", sub: -1 };
  }
  let negate = false;
  if (re[p] === 94 /* ^ */) { negate = true; p++; }
  const first = p;
  const items = new BracketItems();
  for (; p < end; p++) {
    const ch = re[p];
    if (ch === 45 /* - */) {
      if (p === first) { items.single(45); continue; }
      if (items.range > 0) { items.single(45); continue; }
      if (p + 1 >= end) fail(REG_EBRACK);
      if (re[p + 1] === 93) { items.single(45); continue; }
      if (items.range < 0) fail(REG_ERANGE);
      items.range = 1;
      continue;
    }
    if (ch === 91 /* [ */) {
      if (p + 1 >= end) fail(REG_EBRACK);
      const kind = re[p + 1];
      if (kind === 46 /* . */) p = collatingSymbol(re, p + 2, items);
      else if (kind === 61 /* = */ || kind === 58 /* : */) p = classOrEquivalence(re, p + 2, kind, items);
      else items.single(91);
      continue;
    }
    if (ch === 93 /* ] */) {
      if (p === first) { items.single(93); continue; }
      ctx.i = p + 1;
      return lit(items.toSet(negate));
    }
    items.single(ch);
  }
  fail(REG_EBRACK);
}

// The items of a bracket expression as tre_parse_bracket() collects them: characters, ranges
// and classes, with the character that may still start a range.
class BracketItems {
  constructor() {
    this.items = []; // [kind, a, b]: "c" char, "r" range, "k" class (array of chars)
    this.range = -1; // -1 unset, 0 begin range set (`min`), +1 end range expected
    this.min = 0;
  }

  add(item) {
    if (this.items.length >= 1024) fail(REG_ESPACE);
    this.items.push(item);
  }

  // process_single_character
  single(c) {
    if (this.range > 0) {
      if (this.min > c) fail(REG_ERANGE); // __collate_range_cmp in the C locale
      this.add(["r", this.min, c]);
      this.range = -1;
    } else {
      if (this.range === 0) this.add(["c", this.min]);
      this.min = c;
      this.range = 0;
    }
  }

  // a class ends the range that may have begun before it
  closeRange() {
    if (this.range > 0) fail(REG_ERANGE);
    if (this.range === 0) this.add(["c", this.min]);
    this.range = -1;
  }

  toSet(negate) {
    if (this.range === 0) this.add(["c", this.min]);
    const set = new Uint8Array(256);
    for (const [k, a, b] of this.items) {
      if (k === "c") set[a] = 1;
      else if (k === "r") set.fill(1, a, b + 1);
      else for (const c of a) set[c] = 1;
    }
    if (negate) for (let c = 0; c < 256; c++) set[c] ^= 1;
    return set;
  }
}

// [.name.] (p: the name): one character.  Returns the index of the closing ']'.
function collatingSymbol(re, p, items) {
  const end = re.length;
  const start = p;
  for (;; p++) {
    if (p >= end) fail(REG_ECOLLATE);
    if (re[p] !== 46) continue;
    if (p + 1 >= end) fail(REG_ECOLLATE);
    if (re[p + 1] !== 93) continue;
    if (p === start) fail(REG_ECOLLATE);
    let c = searchCnames(re, start, p - start);
    if (c === -1) {
      // __collate_equiv_value() of the C locale: only single characters exist
      if (p - start !== 1) fail(REG_ECOLLATE);
      c = re[start];
    }
    items.single(c);
    return p + 1;
  }
}

// [=x=] or [:name:] (kind '=' or ':'; p: the name).  Returns the index of the closing ']'.
function classOrEquivalence(re, p, kind, items) {
  items.closeRange();
  const end = re.length;
  const start = p;
  const err = kind === 61 ? REG_ECOLLATE : REG_ECTYPE;
  for (;; p++) {
    if (p >= end) fail(err);
    if (re[p] !== kind) continue;
    if (p + 1 >= end) fail(err);
    if (re[p + 1] !== 93) continue;
    if (p === start) fail(err);
    if (kind === 58) {
      const name = String.fromCharCode(...re.subarray(start, start + Math.min(p - start, 63)));
      const cls = CLASSES.get(name);
      if (!cls) fail(REG_ECTYPE);
      items.add(["k", cls]);
    } else if (p - start === 1) {
      items.add(["c", re[start]]); // its own equivalence class
    } else {
      const c = searchCnames(re, start, p - start);
      if (c === -1) fail(REG_ECOLLATE);
      items.single(c);
    }
    return p + 1;
  }
}

// tre_parse() stack symbols
const PARSE_RE = 0, PARSE_ATOM = 1, PARSE_MARK_FOR_SUBMATCH = 2, PARSE_BRANCH = 3, PARSE_PIECE = 4,
  PARSE_CATENATION = 5, PARSE_POST_CATENATION = 6, PARSE_UNION = 7, PARSE_POST_UNION = 8, PARSE_POSTFIX = 9;

/** tre_parse() for cflags REG_EXTENDED: AST, or throws ParseError. */
function parse(re) {
  if (re.length <= 0) fail(REG_EMPTY);
  return new TreParser(re).run();
}

// tre_parse()'s explicit stack machine; `i` is the position in the pattern, `result` the
// last subtree built.
class TreParser {
  constructor(re) {
    this.re = re;
    this.end = re.length;
    this.i = 0;
    this.stack = [];
    this.result = null;
    this.depth = 0;
    this.submatchId = 0;
    this.invisible = SUBMATCH_ID_INVISIBLE_START;
  }

  run() {
    const stack = this.stack;
    stack.push(this.submatchId++, PARSE_MARK_FOR_SUBMATCH);
    stack.push(PARSE_RE);
    while (stack.length) {
      switch (stack.pop()) {
        case PARSE_RE:
          stack.push(PARSE_UNION, PARSE_BRANCH);
          break;
        case PARSE_BRANCH:
          stack.push(PARSE_CATENATION, PARSE_PIECE);
          break;
        case PARSE_PIECE:
          stack.push(PARSE_POSTFIX, PARSE_ATOM);
          break;
        case PARSE_CATENATION:
          this.catenation();
          break;
        case PARSE_POST_CATENATION:
          this.result = { t: "cat", l: stack.pop(), r: this.result, sub: -1 };
          break;
        case PARSE_UNION:
          this.union();
          break;
        case PARSE_POST_UNION: {
          const tree = stack.pop();
          const pipe = stack.pop();
          if (pipe === this.i - 1) fail(REG_EMPTY);
          this.result = { t: "union", l: tree, r: this.result, sub: -1 };
          break;
        }
        case PARSE_POSTFIX:
          this.postfix();
          break;
        case PARSE_ATOM:
          this.atom();
          break;
        case PARSE_MARK_FOR_SUBMATCH: {
          const id = stack.pop();
          if (this.result.sub >= 0 && this.result.sub < SUBMATCH_ID_INVISIBLE_START) {
            this.result = { t: "cat", l: { t: "empty", sub: -1 }, r: this.result, sub: -1 };
          }
          this.result.sub = id;
          break;
        }
      }
    }
    if (this.depth > 0) fail(REG_EPAREN);
    return { ast: this.result, nsub: this.submatchId - 1 };
  }

  catenation() {
    if (this.i >= this.end) return;
    const c = this.re[this.i];
    if (c === 124 /* | */) return;
    if (c === 41 /* ) */ && this.depth > 0) {
      this.depth--;
      return;
    }
    this.stack.push(this.result, PARSE_POST_CATENATION, PARSE_CATENATION, PARSE_PIECE);
  }

  union() {
    if (this.i >= this.end) return;
    if (this.re[this.i] === 124) {
      this.stack.push(PARSE_UNION, this.i, this.result, PARSE_POST_UNION, PARSE_BRANCH);
      this.i++;
    } else if (this.re[this.i] === 41) this.i++;
  }

  // *, +, ? or a bound after a piece
  postfix() {
    const re = this.re;
    if (this.i >= this.end) return;
    const c = re[this.i];
    if (c === 43 || c === 63 || c === 42) {
      if (isRawAssertion(this.result)) fail(REG_BADRPT);
      const min = c === 43 ? 1 : 0, max = c === 63 ? 1 : -1;
      if (this.i + 1 < this.end) {
        const n = re[this.i + 1];
        if (n === 63 || n === 42 || n === 43) fail(REG_BADRPT);
      }
      this.i++;
      this.result = { t: "iter", x: this.result, min, max, sub: this.invisible++ };
    } else if (c === 123 /* { */) {
      const raw = isRawAssertion(this.result);
      this.i++;
      const b = parseBound(re, this);
      if (b === REG_NOMATCH) {
        this.i--;
        return;
      }
      this.result = { t: "iter", x: this.result, min: b.min, max: b.max, sub: this.invisible++ };
      this.i = b.end;
      if (raw) fail(REG_BADRPT);
    }
  }

  atom() {
    const re = this.re;
    if (this.i >= this.end) return this.literal();
    const c = re[this.i];
    if (c === 40 /* ( */) {
      this.i++;
      this.stack.push(this.submatchId++, PARSE_MARK_FOR_SUBMATCH, PARSE_RE);
      this.depth++;
    } else if (c === 41 && this.depth > 0) {
      this.result = { t: "empty", sub: -1 };
    } else if (c === 91 /* [ */) {
      this.i++;
      this.result = parseBracket(re, this);
    } else if (c === 92 /* \ */) {
      if (this.i + 1 >= this.end) fail(REG_EESCAPE);
      // not REG_ENHANCED: a backslash makes any character literal (no \w, \1, ...)
      this.i++;
      this.result = single(re[this.i]);
      this.i++;
    } else if (c === 46 /* . */) {
      const s = new Uint8Array(256).fill(1);
      s[0] = 0;
      this.result = lit(s);
      this.i++;
    } else if (c === 94 /* ^ */ || c === 36 /* $ */) {
      this.result = { t: "assert", a: c === 94 ? "BOL" : "EOL", sub: -1 };
      this.i++;
    } else this.literal();
  }

  literal() {
    const re = this.re;
    if (this.i >= this.end) fail(this.depth > 0 ? REG_EPAREN : REG_EMPTY);
    const c = re[this.i];
    if (c === 124 /* | */) fail(REG_EMPTY);
    if (c === 123 /* { */) {
      this.i++;
      const b = parseBound(re, this);
      if (b !== REG_NOMATCH) fail(REG_BADRPT);
      this.i--;
    } else if (c === 42 || c === 43 || c === 63) fail(REG_BADRPT);
    this.result = single(re[this.i]);
    this.i++;
  }
}

// ---- TNFA ----------------------------------------------------------------------------------
// tre_compile() after the parse, without tags (REG_NOSUB, no minimal repetition, no
// backreferences): bounded repetitions are expanded into copies (tre_expand_ast), a final
// dummy literal is appended, and nullable/firstpos/lastpos are computed with TRE's rules
// (tre_compute_npfl, tre_match_empty, tre_set_union), assertions riding on the positions.
// Two of those rules are not textbook and decide some matches: the assertions of an empty
// path are those of ONE path (a union takes its left branch when it is nullable, an
// iteration goes through its argument), and tre_set_union() adds them to the entries of its
// first set only.  So "x([[:<:]])?" cannot match "x" at the end of the string.
// The states of the automaton are the positions; a transition reads the character of its
// source position and checks the assertions of both ends after it (tre_make_trans).
const A_BOL = 1, A_EOL = 2, A_BOW = 4, A_EOW = 8;
const ASSERT_BIT = { BOL: A_BOL, EOL: A_EOL, BOW: A_BOW, EOW: A_EOW };
const MAX_POSITIONS = 1 << 22;

function expand(n, budget) {
  switch (n.t) {
    case "set": if (++budget.n > MAX_POSITIONS) fail(REG_ESPACE); return { t: "set", set: n.set };
    case "assert": return { t: "assert", a: n.a };
    case "empty": return { t: "empty" };
    case "cat": case "union": return { t: n.t, l: expand(n.l, budget), r: expand(n.r, budget) };
    case "iter": {
      const { x, min, max } = n;
      if (min === 0 && max === 0) return { t: "empty" };
      if (!(min > 1 || max > 1)) return { t: "iter", x: expand(x, budget), min, max };
      let seq1 = null, seq2 = null;
      for (let j = 0; j < min; j++) { const copy = expand(x, budget); seq1 = seq1 ? { t: "cat", l: seq1, r: copy } : copy; }
      if (max === -1) seq2 = { t: "iter", x: expand(x, budget), min: 0, max: -1 };
      else for (let j = min; j < max; j++) {
        const copy = expand(x, budget);
        seq2 = seq2 ? { t: "cat", l: copy, r: seq2 } : copy;
        seq2 = { t: "union", l: { t: "empty" }, r: seq2 };
      }
      return seq1 === null ? seq2 : seq2 === null ? seq1 : { t: "cat", l: seq1, r: seq2 };
    }
  }
  throw new Error("regex: bad node " + n.t);
}

// assertions on the empty path through a nullable node (tre_match_empty)
function matchEmpty(n) {
  switch (n.t) {
    case "assert": return ASSERT_BIT[n.a];
    case "empty": case "set": return 0;
    case "union": return n.l.nullable ? matchEmpty(n.l) : n.r.nullable ? matchEmpty(n.r) : 0;
    case "cat": return matchEmpty(n.l) | matchEmpty(n.r);
    case "iter": return n.x.nullable ? matchEmpty(n.x) : 0;
  }
  return 0;
}

// set entries: { p: position, a: assertions }; tre_set_union(set1, set2, assertions)
const setUnion = (s1, s2, a) => [...(a ? s1.map((e) => ({ p: e.p, a: e.a | a })) : s1), ...s2];

function makeTnfa(ast) {
  const tree = { t: "cat", l: expand(ast, { n: 0 }), r: { t: "set", set: null } }; // + final dummy
  const sets = []; // position -> character set (null: the final position)
  const trans = []; // position -> [target, assertions, ...]
  const makeTrans = (p1s, p2s) => {
    for (const e1 of p1s) {
      let prev = -1;
      for (const e2 of p2s) {
        if (e2.p === prev) continue;
        prev = e2.p;
        trans[e1.p].push(e2.p, e1.a | e2.a);
      }
    }
  };
  // tre_compute_npfl (children first), then the transitions of tre_ast_to_tnfa
  const npfl = (n) => {
    switch (n.t) {
      case "set": {
        const p = sets.length;
        sets.push(n.set); trans.push([]);
        n.nullable = false; n.first = [{ p, a: 0 }]; n.last = n.first;
        return;
      }
      case "assert": case "empty": n.nullable = true; n.first = []; n.last = []; return;
      case "union":
        npfl(n.l); npfl(n.r);
        n.nullable = n.l.nullable || n.r.nullable;
        n.first = setUnion(n.l.first, n.r.first, 0);
        n.last = setUnion(n.l.last, n.r.last, 0);
        return;
      case "cat":
        npfl(n.l); npfl(n.r);
        n.nullable = n.l.nullable && n.r.nullable;
        n.first = n.l.nullable ? setUnion(n.r.first, n.l.first, matchEmpty(n.l)) : n.l.first;
        n.last = n.r.nullable ? setUnion(n.l.last, n.r.last, matchEmpty(n.r)) : n.r.last;
        makeTrans(n.l.last, n.r.first);
        return;
      case "iter":
        npfl(n.x);
        if (n.min === 0 || n.x.nullable) {
          n.nullable = true;
          n.last = n.x.nullable ? setUnion(n.x.last, n.x.last, matchEmpty(n.x)) : n.x.last;
        } else {
          n.nullable = false;
          n.last = n.x.last;
        }
        n.first = n.x.first;
        if (n.max === -1) makeTrans(n.x.last, n.x.first);
        return;
    }
  };
  npfl(tree);
  return {
    sets,
    trans: trans.map((t) => Int32Array.from(t)),
    initial: Int32Array.from(tree.first.flatMap((e) => [e.p, e.a])),
    final: tree.last[0].p,
  };
}

/** regcomp(REG_EXTENDED | REG_NOSUB) of the pattern bytes: { err } or { nsub, nfa }. */
export function compile(bytes) {
  try {
    const { ast, nsub } = parse(bytes);
    return { err: 0, nsub, nfa: makeTnfa(ast) };
  } catch (e) {
    if (e instanceof ParseError) return { err: e.code };
    throw e;
  }
}

/** regexec(nfa, s, 0, NULL, 0) == 0: tre_tnfa_run_parallel() without tags (s: bytes, no NUL). */
export function matches(nfa, s) {
  const { sets, trans, initial, final } = nfa;
  const n = sets.length, len = s.length;
  const work = (nfa.work ??= { reach: new Int32Array(n), next: new Int32Array(n), seen: new Int32Array(n) });
  const seen = work.seen.fill(-1);
  let reach = work.reach, next = work.next, nr = 0;
  // CHECK_ASSERTIONS() is true when an assertion fails; here: do they all hold at pos?
  const holds = (a, pos, prev, nxt) =>
    !((a & A_BOL && pos > 0) || (a & A_EOL && nxt !== 0) ||
      (a & A_BOW && (WORD[prev] || !WORD[nxt])) || (a & A_EOW && (!WORD[prev] || WORD[nxt])));
  for (let pos = 0; ; ) {
    const prev = pos > 0 ? s[pos - 1] : 0, nxt = pos < len ? s[pos] : 0;
    for (let i = 0; i < initial.length; i += 2) {
      const q = initial[i];
      if (seen[q] === pos || (initial[i + 1] && !holds(initial[i + 1], pos, prev, nxt))) continue;
      if (q === final) return true;
      seen[q] = pos;
      reach[nr++] = q;
    }
    if (pos >= len) return false;
    const c = s[pos++];
    const nxt2 = pos < len ? s[pos] : 0;
    let nn = 0;
    for (let i = 0; i < nr; i++) {
      const q = reach[i];
      if (!sets[q][c]) continue;
      const t = trans[q];
      for (let k = 0; k < t.length; k += 2) {
        const to = t[k];
        if (seen[to] === pos || (t[k + 1] && !holds(t[k + 1], pos, c, nxt2))) continue;
        if (to === final) return true;
        seen[to] = pos;
        next[nn++] = to;
      }
    }
    [reach, next] = [next, reach];
    nr = nn;
  }
}
