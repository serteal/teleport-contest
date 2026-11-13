// Preparing the NetHack sources for tools/nh2js.
//
// The tree is always rebuilt from pristine sources: a copy of nethack-c/upstream, then
// nethack-c/patches, then the port patches (tools/c2js/patches) and the 64-bit `long` rewrite
// (long64.mjs).  Nothing is applied twice, so the C needs no record of what was applied.

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applyPatches } from "./apply-patches.mjs";
import { cacheRoot, nethackPatches, patchDir, preparedSourceDir, upstreamDir } from "./c2js.config.mjs";
import { applyLong64 } from "./long64.mjs";
import { writeManifest } from "./manifest.mjs";
import { portPatches } from "./patches/index.mjs";
import { run } from "./run.mjs";

/** Replaces the tree at `root` by a copy of nethack-c/upstream. */
function copyUpstream(root) {
  if (!existsSync(join(upstreamDir, "include/patchlevel.h"))) {
    throw new Error("nethack-c/upstream is missing; run git submodule update --init nethack-c/upstream");
  }
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  run("rsync", ["-a", "--exclude=.git", `${upstreamDir}/`, `${root}/`]);
}

/** Applies nethack-c/patches to the tree at `root` (a repository of its own while they apply). */
function applyNethackPatches(root) {
  run("git", ["init", "-q"], { cwd: root });
  for (const name of nethackPatches) {
    run("git", ["apply", "--recount", join(patchDir, name)], { cwd: root });
  }
  rmSync(join(root, ".git"), { recursive: true, force: true });
}

/** Prepares the source tree from pristine sources (see the top of this file). */
export function prepareSource() {
  mkdirSync(cacheRoot, { recursive: true });
  copyUpstream(preparedSourceDir);
  applyNethackPatches(preparedSourceDir);
  applyPatches(preparedSourceDir, portPatches);
  const stats = applyLong64(preparedSourceDir);
  console.log(`long64: ${JSON.stringify(stats)}`);
  const hackSources = writeManifest(preparedSourceDir);
  console.log(`prepared ${preparedSourceDir}`);
  console.log(`found ${hackSources.length} core C sources`);
}
