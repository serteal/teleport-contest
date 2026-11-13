// lib/stats.mjs: how close the emitted JS is to the C, line by line.
//   identical   the JS line is byte-identical to the C line
//   token       same line after normalising known token edits (-> to ., casts, literals)
//   structural  anything else (declarations, synthesized code, wrapped expressions)
//   blank       C line is blank/comment-only or became blank (directives, prototypes)

// a C cast to a scalar or struct pointer type: "(const struct obj *) "
const C_CAST = new RegExp("\\(\\s*(?:const\\s+)?(?:struct\\s+\\w+|unsigned|int|long|short|char|schar|uchar|boolean|" +
  "coordxy|xint8|genericptr_t|void)\\s*\\**\\s*\\)\\s*", "g");

const norm = (s) =>
  s
    .replace(/->/g, ".")
    .replace(/\b(\d+)[uUlL]+\b/g, "$1")
    .replace(
      C_CAST,
      "",
    )
    .replace(
      /\b(?:int|long|short|char|unsigned|boolean|coordxy|schar|uchar|xint8|struct \w+|const|register)\s+\**\s*(?=\w)/g,
      "let ",
    )
    .replace(/'(\\?.)'/g, "ord('$1')")
    .replace(/\s+/g, " ")
    .trim();

export function lineStats(cText, jsText) {
  const c = cText.split("\n"), j = jsText.split("\n");
  const st = { identical: 0, token: 0, structural: 0, blank: 0, total: c.length };
  for (let i = 0; i < c.length; i++) {
    const a = c[i], b = j[i] ?? "";
    if (/^\s*$/.test(a) || /^\s*(\/\*.*\*\/|\/\/.*|\*.*|\/\*.*)\s*$/.test(a) && a === b) { st.blank++; continue; }
    if (a === b) { st.identical++; continue; }
    if (/^\s*$/.test(b)) { st.blank++; continue; }
    if (norm(a) === norm(b.replace(/\bord\(("|')(.*?)\1\)/g, "ord('$2')").replace(/_\(("[^"]*")\)/g, "$1"))) st.token++;
    else st.structural++;
  }
  return st;
}
