#!/usr/bin/env node
// Command line of the C preparation: the NetHack source tree that tools/nh2js turns into js/.

import {
  cacheRoot, nethackPatches, patchDir, preparedSourceDir, projectRoot, upstreamDir,
} from "./c2js.config.mjs";
import { configureSource } from "./configure.mjs";
import { prepareSource } from "./prepare.mjs";

const usage = `Usage:
  node tools/c2js/build-engine.mjs --prepare-source
  node tools/c2js/build-engine.mjs --configure
  node tools/c2js/build-engine.mjs --print-config

--prepare-source  copies nethack-c/upstream into the cache and applies nethack-c/patches, the
                  port patches (tools/c2js/patches) and the 64-bit long rewrite (long64.mjs)
--configure       prepares the tree as above, then generates NetHack's headers and data files
                  and the record sizes of wizard-mode #stats (struct-sizes.mjs)
--print-config    shows the paths in use (see c2js.config.mjs for the environment variables)`;

function printConfig() {
  const config = { projectRoot, upstreamDir, patchDir, cacheRoot, preparedSourceDir, nethackPatches };
  console.log(JSON.stringify(config, null, 2));
}

const commands = {
  "--prepare-source": prepareSource,
  "--configure": configureSource,
  "--print-config": printConfig,
};

const command = commands[process.argv[2]];
if (!command) {
  console.log(usage);
} else {
  try {
    command();
  } catch (error) {
    console.error(`c2js: ${error.message}`);
    process.exit(1);
  }
}
