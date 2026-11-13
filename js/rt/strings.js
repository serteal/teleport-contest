// rt/strings.js: string literals and C strings.
//
// A C string is an address in the heap (char * is a number). A string literal used as a
// pointer is written `_("Elbereth")`: the text stays inline at the use site (greppable,
// readable) and `_` returns the address of a NUL-terminated copy, interned once per distinct
// text in the literal arena (so it is never part of the C heap and never freed). Literals hold
// bytes 0-255 (latin1), as in the C source.

import { arena_alloc, uchars, on_attach, machine, rt_journal } from "./heap.js";

const interned = new Map(); // text -> address
const inArena = new Set();  // texts whose copy is in the rt arena (vs one found by machine.findLiteral)
const literalAt = new Map(); // address -> text, for every interned literal (immutable bytes)
// A new memory image (a new engine instance): arena copies keep their addresses (module-level
// data may hold them) and get their bytes again; copies found by machine.findLiteral are
// looked up again. Memory growth keeps everything.
on_attach(({ grown }) => {
  if (grown) return;
  for (const s of [...interned.keys()]) {
    if (inArena.has(s)) put_string(interned.get(s), s);
    else { literalAt.delete(interned.get(s)); interned.delete(s); }
  }
});

/** Address of the string literal s (bytes 0-255; a character above 255 is an emitter bug). */
export function _(s) {
  let a = interned.get(s);
  if (a !== undefined) return a;
  if (machine.findLiteral) {
    // an existing copy in the memory image (read-only data, never written or snapshotted)
    a = machine.findLiteral(s);
    if (a) { interned.set(s, a); literalAt.set(a, s); rt_journal(() => { interned.delete(s); literalAt.delete(a); }); return a; }
  }
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 255) throw new Error(`rt: literal with a character above 255: ${JSON.stringify(s)}`);
  a = arena_alloc(s.length + 1, 1);
  put_string(a, s);
  interned.set(s, a);
  inArena.add(s);
  literalAt.set(a, s);
  rt_journal(() => { interned.delete(s); inArena.delete(s); literalAt.delete(a); });
  return a;
}

/** The text of the string literal at address a, or undefined when a is not a literal's start. */
export function literal_text(a) { return literalAt.get(a); }

/** JS string of the C string at address a (for host code, messages and debugging). */
export function js_string(a, max = 1 << 20) {
  let s = "";
  for (let i = 0; i < max; i++) {
    const c = uchars[a + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s;
}

/** Copy JS string s into the heap at address a (NUL-terminated). */
export function put_string(a, s) {
  for (let i = 0; i < s.length; i++) uchars[a + i] = s.charCodeAt(i);
  uchars[a + s.length] = 0;
  return a;
}
