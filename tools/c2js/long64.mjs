// long64.mjs - make NetHack's C `long` 64 bits wide in the wasm32 build.
//
// The game's `long` is 64 bits (seeds, ubirthday arithmetic, overflow and sizeof (long) all
// show it), while wasm32 makes `long` 32 bits.  Rather than patching every place where the
// width shows, the prepared NetHack sources are rewritten so that `long` reads `long long`.
// The rewrite is token aware:
//   - comments and character literals are left alone;
//   - in string literals only printf/scanf length modifiers change
//     (%ld -> %lld, %lu -> %llu, ...);
//   - `long long` and `long double` are kept as they are;
//   - integer suffixes L/UL/LU become LL/ULL/LLU;
//   - LONG_MAX / LONG_MIN / ULONG_MAX become the LLONG_ forms;
//   - libc helpers that return `long` are renamed to their `long long`
//     siblings (atol -> atoll, strtol -> strtoll, strtoul -> strtoull,
//     labs -> llabs);
//   - #include / #error / #pragma lines are copied verbatim.
// Three spots need more than token substitution and are fixed up after:
//   - integer.h's `typedef ... ulong` would collide with sys/types.h's
//     `ulong` once it names a 64-bit type, so sys/types.h is included
//     first with its ulong renamed;
//   - the save-file field macros paste the type name into function names
//     (SF_A(long) -> sfo_long); a two-token type needs the keyword form
//     SF_C(long, long), which also wants a norm_ptrs_long() hook.

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const libcRenames = new Map([
  ["atol", "atoll"],
  ["strtol", "strtoll"],
  ["strtoul", "strtoull"],
  ["labs", "llabs"],
]);

function fixFormat(text, stats) {
  return text.replace(
    /%([-+ #0']*)(\*|\d+)?(\.(\*|\d+))?l(?!l)([diouxXn])/g,
    (match, flags = "", width = "", precision = "", _p, conv) => {
      stats.fmt++;
      return `%${flags}${width}${precision}ll${conv}`;
    },
  );
}

function tokenize(src) {
  const toks = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "*") {
      const j = src.indexOf("*/", i + 2);
      const e = j < 0 ? n : j + 2;
      toks.push(["o", src.slice(i, e)]);
      i = e;
    } else if (c === "/" && d === "/") {
      let j = src.indexOf("\n", i);
      if (j < 0) j = n;
      toks.push(["o", src.slice(i, j)]);
      i = j;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) {
        if (src[j] === "\\") j++;
        j++;
      }
      toks.push([c === '"' ? "s" : "o", src.slice(i, j + 1)]);
      i = j + 1;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /\w/.test(src[j])) j++;
      toks.push(["i", src.slice(i, j)]);
      i = j;
    } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(d || ""))) {
      let j = i + 1;
      while (
        j < n &&
        (/[\w.]/.test(src[j]) ||
          ((src[j] === "+" || src[j] === "-") &&
            /[eEpP]/.test(src[j - 1]) &&
            !/^0[xX]/.test(src.slice(i, j))))
      )
        j++;
      toks.push(["n", src.slice(i, j)]);
      i = j;
    } else {
      toks.push(["p", c]);
      i++;
    }
  }
  return toks;
}

export function long64Transform(src, stats) {
  const toks = tokenize(src);
  const significant = [];
  for (let k = 0; k < toks.length; k++) {
    const [type, text] = toks[k];
    if (type !== "o" && !(type === "p" && /\s/.test(text))) significant.push(k);
  }
  const prevOf = new Map();
  const nextOf = new Map();
  for (let k = 0; k < significant.length; k++) {
    prevOf.set(significant[k], significant[k - 1]);
    nextOf.set(significant[k], significant[k + 1]);
  }

  let out = "";
  let verbatimLine = false;
  let lineState = "start"; // start | hash | body
  for (let k = 0; k < toks.length; k++) {
    const [type, text] = toks[k];
    if (type === "p" && text === "\n") {
      verbatimLine = false;
      lineState = "start";
      out += text;
      continue;
    }
    if (
      type === "i" &&
      lineState === "hash" &&
      (text === "include" || text === "error" || text === "pragma")
    )
      verbatimLine = true;
    if (type === "p" && text === "#" && lineState === "start") lineState = "hash";
    else if (!(type === "p" && /\s/.test(text)) && type !== "o") lineState = "body";
    if (verbatimLine) {
      out += text;
      continue;
    }
    if (type === "i" && text === "long") {
      const prev = toks[prevOf.get(k)];
      const next = toks[nextOf.get(k)];
      if (
        (prev && prev[1] === "long") ||
        (next && (next[1] === "long" || next[1] === "double"))
      ) {
        out += text;
      } else {
        out += "long long";
        stats.long++;
      }
    } else if (type === "i" && /^(U?LONG_MAX|LONG_MIN)$/.test(text)) {
      out += text.replace("LONG", "LLONG");
      stats.limits++;
    } else if (type === "i" && libcRenames.has(text)) {
      const next = toks[nextOf.get(k)];
      if (next && next[1] === "(") {
        out += libcRenames.get(text);
        stats.libc++;
      } else {
        out += text;
      }
    } else if (
      type === "n" &&
      /^(0[xX][0-9a-fA-F]+|\d+)([uU][lL]|[lL][uU]?)$/.test(text)
    ) {
      out += text.replace(/[lL]/, "LL");
      stats.suffix++;
    } else if (type === "s") {
      out += fixFormat(text, stats);
    } else {
      out += text;
    }
  }
  return out;
}

function fixups(rel, text) {
  if (rel === "include/integer.h") {
    const typedef = "typedef unsigned long long ulong;";
    text = text.replace(typedef, [
      "#define ulong nh_sys_ulong /* long64: keep sys/types.h ulong out of the way */",
      "#include <sys/types.h>",
      "#undef ulong",
      typedef,
    ].join("\n"));
  }
  if (rel === "include/sfmacros.h" || rel === "include/sfprocs.h") {
    // `long` was rewritten inside the macro arguments; use the keyword form
    text = text
      .replace(/\bSF_A\(long long\)/g, "SF_C(long, long)")
      .replace(/\bSF_PROTO\(long long\);/g, "SF_PROTO_C(long, long);")
      .replace(/\bSF_ENTRY\(long long\);/g, "SF_ENTRY_C(long, long);");
  }
  if (rel === "src/sfbase.c") {
    text += [
      "",
      "/* long64: SF_C(long, long) serializes `long long` through the",
      "   keyword form, which calls a pointer-normalization hook. */",
      "void norm_ptrs_long(long long *d_long);",
      "void",
      "norm_ptrs_long(long long *d_long)",
      "{",
      "    (void) d_long;",
      "}",
      "",
    ].join("\n");
  }
  return text;
}

function sourceFiles(root, dir) {
  const full = join(root, dir);
  return readdirSync(full)
    .filter((name) => /\.[ch]$/.test(name))
    .filter((name) => statSync(join(full, name)).isFile())
    .map((name) => `${dir}/${name}`);
}

export const long64Dirs = ["include", "src", "win/tty", "sys/share", "sys/unix"];

export function applyLong64(root) {
  const stats = { files: 0, long: 0, suffix: 0, fmt: 0, limits: 0, libc: 0 };
  for (const dir of long64Dirs) {
    for (const rel of sourceFiles(root, dir)) {
      const path = join(root, rel);
      const before = readFileSync(path, "utf8");
      const after = fixups(rel, long64Transform(before, stats));
      if (after !== before) {
        writeFileSync(path, after);
        stats.files++;
      }
    }
  }
  return stats;
}
