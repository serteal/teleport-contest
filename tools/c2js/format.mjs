#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { generatedDir, projectRoot } from "./c2js.config.mjs";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage:
  node tools/c2js/format.mjs [generated-module ...]

Formats generated ES modules using the pinned local Prettier dependency.`);
  process.exit(0);
}

function resolvePath(path) {
  return path.startsWith("/") ? path : join(projectRoot, path);
}

function defaultTargets() {
  if (!existsSync(generatedDir)) return [];
  return readdirSync(generatedDir)
    .filter((entry) => entry.endsWith(".mjs"))
    .map((entry) => join(generatedDir, entry))
    .filter((path) => statSync(path).isFile());
}

const targets = process.argv.slice(2).map(resolvePath);
const files = targets.length ? targets : defaultTargets();
if (!files.length) {
  console.log("no generated modules to format");
  process.exit(0);
}

const prettierBin = join(projectRoot, "node_modules/.bin/prettier");
if (!existsSync(prettierBin)) {
  throw new Error("local prettier is missing; run npm install first");
}

const prettierArgs = [
  "--write",
  "--print-width=120",
  "--tab-width=2",
  "--single-quote",
  "--trailing-comma=all",
  "--bracket-spacing=true",
  "--semi=true",
  ...files,
];

const result = spawnSync(prettierBin, prettierArgs, {
  cwd: projectRoot,
  stdio: "inherit",
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  `formatted ${files.map((file) => relative(projectRoot, file)).join(", ")}`,
);
