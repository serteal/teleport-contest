// lib/units.mjs: the C translation units of the game and where their JS goes.
//
// The list is tools/c2js's source-manifest.json next to the prepared tree (hackSources =
// src/*.c, portSources = the port files): every unit a native build of the port links.
// A unit is named by its path relative to the prepared tree's src/ (the compile directory):
//   "allmain.c"               src/allmain.c          -> js/src/allmain.js
//   "../win/tty/wintty.c"     win/tty/wintty.c       -> js/win/tty/wintty.js
//   "../sys/c2js/nhjs_host.c" tools/c2js/host/*.c    -> js/sys/c2js/nhjs_host.js
//                             (our host C, laid out as if it were NetHack's sys/c2js port)
// Per-unit flags (unitArgs): unixmain.c is compiled with -Dmain=nhjs_unix_main, tclib.c without
// the Lua include directory.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
export const hostDir = path.join(repoRoot, "tools/c2js/host");
const HOST_PREFIX = "../sys/c2js/";

/** All units of the prepared tree srcDir (the source manifest when present, else src/*.c). */
export function allUnits(srcDir) {
  const manifest = path.join(path.dirname(path.resolve(srcDir)), "source-manifest.json");
  const src = fs.readdirSync(path.join(srcDir, "src")).filter((f) => f.endsWith(".c")).sort();
  if (!fs.existsSync(manifest)) return src;
  const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
  const out = new Set(m.hackSources || src);
  for (const p of m.portSources || []) {
    const b = path.basename(p);
    if (p.startsWith("src/")) out.add(p.slice(4));
    else if (p.startsWith("tools/c2js/host/")) out.add(HOST_PREFIX + b);
    else out.add("../" + p);
  }
  return [...out].sort((a, b) =>
    unitTree(a) < unitTree(b) ? -1 : unitTree(a) > unitTree(b) ? 1 : a < b ? -1 : a > b ? 1 : 0,
  );
}

/** "src", "win", "sys", "host": the tree a unit belongs to (for reports). */
export function unitTree(key) {
  if (key.startsWith(HOST_PREFIX)) return "host";
  if (key.startsWith("../")) return key.split("/")[1];
  return "src";
}

/** The C file of a unit (absolute). */
export function unitPath(srcDir, key) {
  if (key.startsWith(HOST_PREFIX)) return path.join(hostDir, key.slice(HOST_PREFIX.length));
  return path.resolve(srcDir, "src", key);
}

/** Extra compiler arguments of a unit (beyond the common NetHack ones). */
export function unitArgs(key) {
  if (key === "../sys/unix/unixmain.c") return { add: ["-Dmain=nhjs_unix_main"], drop: [] };
  // tclib.c is compiled without the Lua include directory and LUA_USE_POSIX
  if (key === "../sys/share/tclib.c") return { add: [], drop: ["-I../lib/lua-5.4.8/src", "-DLUA_USE_POSIX"] };
  return { add: [], drop: [] };
}

/** js/ module path of a unit ("src/allmain.js", "win/tty/wintty.js", "sys/c2js/nhjs_host.js"). */
export function unitModule(key) {
  return path.posix.normalize(`src/${key}`).replace(/\.c$/, ".js");
}

/** The unit key of a C file name as the front end reports it (main file paths), or null. */
export function unitOfPath(srcDir, p) {
  const abs = path.resolve(srcDir, "src", p);
  if (abs.startsWith(hostDir + path.sep)) return HOST_PREFIX + path.basename(abs);
  const rel = path.relative(path.join(srcDir, "src"), abs);
  return rel.endsWith(".c") ? rel.split(path.sep).join("/") : null;
}
