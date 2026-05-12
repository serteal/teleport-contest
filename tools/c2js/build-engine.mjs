#!/usr/bin/env node
import {
  cacheRoot,
  deterministicPatches,
  generatedDir,
  hostDir,
  jsOnlyEngineFlags,
  jsOnlyProbeFlags,
  patchDir,
  preparedSourceDir,
  projectRoot,
  upstreamDir,
} from "./c2js.config.mjs";
import {
  compileCore,
  compileLua,
  compilePortObjects,
  compileSmoke,
} from "./compile.mjs";
import { configureSource, prepareSource } from "./prepare.mjs";
import { linkEngine, updateGenerated } from "./link.mjs";
import { runProbe } from "./verify.mjs";

function usage() {
  console.log(`Usage:
  node tools/c2js/build-engine.mjs --probe
  node tools/c2js/build-engine.mjs --prepare-source
  node tools/c2js/build-engine.mjs --configure
  node tools/c2js/build-engine.mjs --compile-smoke
  node tools/c2js/build-engine.mjs --compile-core
  node tools/c2js/build-engine.mjs --compile-lua
  node tools/c2js/build-engine.mjs --compile-port
  node tools/c2js/build-engine.mjs --link-engine
  node tools/c2js/build-engine.mjs --update-generated
  node tools/c2js/build-engine.mjs --print-config

This script is the CLI dispatcher for the reproducible plain-JS C-to-JS
engine pipeline. Source transforms, compilation, linking, and verification live
in focused sibling modules under tools/c2js/.`);
}

function printConfig() {
  console.log(
    JSON.stringify(
      {
        projectRoot,
        upstreamDir,
        patchDir,
        cacheRoot,
        preparedSourceDir,
        generatedDir,
        hostDir,
        deterministicPatches,
        jsOnlyProbeFlags,
        jsOnlyEngineFlags,
      },
      null,
      2,
    ),
  );
}

const args = new Set(process.argv.slice(2));
try {
  if (args.has("--probe")) runProbe();
  else if (args.has("--prepare-source")) prepareSource();
  else if (args.has("--configure")) configureSource();
  else if (args.has("--compile-smoke")) compileSmoke();
  else if (args.has("--compile-core")) compileCore();
  else if (args.has("--compile-lua")) compileLua();
  else if (args.has("--compile-port")) compilePortObjects();
  else if (args.has("--link-engine")) linkEngine();
  else if (args.has("--update-generated")) updateGenerated();
  else if (args.has("--print-config")) printConfig();
  else usage();
} catch (error) {
  console.error(`c2js: ${error.message}`);
  process.exit(1);
}
