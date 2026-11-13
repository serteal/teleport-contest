// Configuring the prepared NetHack sources: what tools/nh2js needs beyond the patched C.
//
// The NetHack build generates headers (onames.h, pm.h, date.h) and data files (rumors, data,
// engrave, epitaph, oracles, bogusmon).  Lua's sources are not part of upstream; they come from
// NHJS_LUA_DIR, from the copy kept in the cache by an earlier configure, or from
// `make fetch-lua`.  Last, the record sizes shown by wizard-mode #stats are measured
// (struct-sizes.mjs).

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { cacheRoot, envValue, preparedSourceDir } from "./c2js.config.mjs";
import { prepareSource } from "./prepare.mjs";
import { run } from "./run.mjs";
import { applyStructSizes } from "./struct-sizes.mjs";

const luaTree = "lib/lua-5.4.8";
const keptLua = join(cacheRoot, "lua-5.4.8");

// make targets, from src/ and from dat/
const generatedHeaders = [
  "../src/config.h-t",
  "../src/hack.h-t",
  "../include/onames.h",
  "../include/pm.h",
  "../include/date.h",
];
const headerFlags = ["CC=clang", "CFLAGS=-g -I../include", "SYSCFLAGS=-DLUA_USE_POSIX"];
const dataFiles = ["rumors", "data", "engrave", "epitaph", "oracles", "bogusmon"];

const hasLua = (dir) => dir !== null && existsSync(join(dir, "src/lua.h"));

function copyLua(from, to) {
  mkdirSync(to, { recursive: true });
  run("rsync", ["-a", "--exclude=*.o", "--exclude=*.a", `${from}/`, `${to}/`]);
}

/** Puts the Lua sources into the tree at `root`; fetches them only when there is no copy. */
function ensureLuaSource(root) {
  const luaDir = join(root, luaTree);
  const copy = [envValue("NHJS_LUA_DIR"), keptLua].find(hasLua);
  if (copy) copyLua(copy, luaDir);
  else run("make", ["fetch-lua"], { cwd: root });
  if (!hasLua(keptLua)) copyLua(luaDir, keptLua);
}

/** Runs the NetHack build steps that generate headers and data files in the tree at `root`. */
function generateBuildFiles(root) {
  run("sh", ["sys/unix/setup.sh", "sys/unix/hints/linux-minimal"], { cwd: root });
  ensureLuaSource(root);
  run("make", ["-C", "src", ...generatedHeaders, ...headerFlags], { cwd: root });
  run("make", ["-C", "dat", ...dataFiles], { cwd: root });
}

/** Prepares the source tree from pristine sources, then configures it. */
export function configureSource() {
  run("clang", ["--version"], { capture: true });
  prepareSource();
  generateBuildFiles(preparedSourceDir);
  applyStructSizes(preparedSourceDir);
  console.log(`configured ${preparedSourceDir}`);
}
