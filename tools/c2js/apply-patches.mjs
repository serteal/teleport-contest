// Applies the port patches (tools/c2js/patches) to a pristine source tree.
//
// An edit replaces `find` (a string, or a RegExp for text too long to quote) by `replace`.
// `find` must occur exactly `count` times (default 1); otherwise the sources are not the ones
// the patch was written for, and preparation stops with the file and the patch's `why`.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function occurrences(text, find) {
  if (typeof find === "string") return text.split(find).length - 1;
  return [...text.matchAll(new RegExp(find.source, `${find.flags.replace("g", "")}g`))].length;
}

function replaceAll(text, find, replace) {
  if (typeof find === "string") return text.split(find).join(replace);
  return text.replace(new RegExp(find.source, `${find.flags.replace("g", "")}g`), () => replace);
}

/** `text` with the edits of one patch made; `where` names the file in errors. */
export function applyEdits(text, { why, edits }, where) {
  for (const { find, replace, count = 1 } of edits) {
    const found = occurrences(text, find);
    if (found !== count) {
      const shown = String(find).split("\n")[0];
      throw new Error(
        `${where}: patch "${why}" expects ${count} occurrence(s) of "${shown}", found ${found}`,
      );
    }
    text = replaceAll(text, find, replace);
  }
  return text;
}

/** Applies every patch of `patchFiles` to the tree at `root`. */
export function applyPatches(root, patchFiles) {
  for (const { file, patches } of patchFiles) {
    const path = join(root, file);
    let text = readFileSync(path, "utf8");
    for (const patch of patches) text = applyEdits(text, patch, file);
    writeFileSync(path, text);
  }
}
