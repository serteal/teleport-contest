#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative, resolve } from "node:path";
import { forbiddenRuntimeImports, projectRoot } from "./c2js/c2js.config.mjs";

const checkedRoots = ["js"];
const jsExtensions = new Set([".js", ".mjs", ".cjs"]);
const errors = [];

function walk(dir, files = []) {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

function extname(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const files = checkedRoots.flatMap((root) => walk(join(projectRoot, root)));
for (const file of files) {
  const rel = relative(projectRoot, file);
  if (rel.endsWith(".wasm")) {
    errors.push(`${rel}: wasm artifacts are not allowed`);
    continue;
  }
  if (!jsExtensions.has(extname(file))) continue;

  const text = stripComments(readFileSync(file, "utf8"));
  for (const spec of forbiddenRuntimeImports) {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const importRe = new RegExp(
      `\\bfrom\\s*['"]${escaped}['"]|\\bimport\\s*\\(\\s*['"]${escaped}['"]\\s*\\)`,
    );
    if (importRe.test(text)) {
      errors.push(`${rel}: forbidden runtime import ${spec}`);
    }
  }
  for (const match of text.matchAll(
    /\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  )) {
    const spec = match[1] || match[2];
    if (!spec.startsWith(".")) continue;
    const target = normalize(
      relative(projectRoot, resolve(dirname(file), spec)),
    );
    const allowed =
      target.startsWith(`js/`) ||
      target.startsWith(`frozen/`) ||
      target.startsWith(`nethack-c/upstream/`);
    if (!allowed) {
      errors.push(
        `${rel}: relative import escapes submitted runtime surface (${spec})`,
      );
    }
  }
  if (/\brequire\s*\(/.test(text)) {
    errors.push(`${rel}: require() is not allowed in submitted runtime code`);
  }
  if (/\beval\s*\(/.test(text)) {
    errors.push(`${rel}: eval() is not allowed in submitted runtime code`);
  }
  if (/\bnew\s+Function\b|\bFunction\s*\(/.test(text)) {
    errors.push(
      `${rel}: Function constructor is not allowed in submitted runtime code`,
    );
  }
  if (/\bprocess\s*\./.test(text)) {
    errors.push(
      `${rel}: process.* host access is not allowed in submitted runtime code`,
    );
  }
}

if (errors.length) {
  console.error("Submission constraint check failed:");
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `Submission constraint check passed (${files.length} files scanned).`,
);
