// Paths and settings of the C preparation (tools/c2js).
//
// Environment variables (unset or empty means "use the default"):
//   NHJS_CACHE    cache root holding the prepared source tree (default <repo>/.cache/c2js)
//   NHJS_LUA_DIR  a lua-5.4.8 source tree to use instead of `make fetch-lua`
//
// `node tools/c2js/build-engine.mjs --print-config` shows the effective values.

import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The value of environment variable `name`, or null when it is unset or blank. */
export function envValue(name) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export const projectRoot = resolve(here, "../..");
export const upstreamDir = join(projectRoot, "nethack-c/upstream");
export const patchDir = join(projectRoot, "nethack-c/patches");
export const cacheRoot = resolve(envValue("NHJS_CACHE") ?? join(projectRoot, ".cache/c2js"));
export const preparedSourceDir = join(cacheRoot, "nethack-port");

// nethack-c/patches, applied in this order before the port patches (tools/c2js/patches)
export const nethackPatches = [
  "001-deterministic-runtime.patch",
  "002-deterministic-qsort.patch",
  "003-rng-log-core.patch",
  "004-rng-log-lua-context.patch",
  "005-rng-display-logging.patch",
  "006-nomux-capture.patch",
];

// modules the emitted game must not import (tools/check-submission.mjs)
export const forbiddenRuntimeImports = [
  "fs", "node:fs",
  "child_process", "node:child_process",
  "worker_threads", "node:worker_threads",
  "cluster", "node:cluster",
  "net", "node:net",
  "http", "node:http",
  "https", "node:https",
  "tls", "node:tls",
  "dgram", "node:dgram",
  "dns", "node:dns",
  "wasi", "node:wasi",
  "module", "node:module",
];
