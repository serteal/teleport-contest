// source-manifest.json: the C files of the game, next to the prepared tree.
//
// tools/nh2js reads it (lib/units.mjs) to know which files to emit: hackSources are NetHack's
// core sources (HACKCSRC of sys/unix/Makefile.src), portSources the window port, the Unix
// files the game uses and the port's own host C.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { nethackPatches } from "./c2js.config.mjs";
import { portPatches } from "./patches/index.mjs";

const portSources = [
  "src/date.c",
  "src/cfgfiles.c",
  "sys/share/posixregex.c",
  "sys/unix/unixmain.c",
  "sys/share/tclib.c",
  "win/tty/getline.c",
  "win/tty/termcap.c",
  "win/tty/topl.c",
  "win/tty/wintty.c",
  "tools/c2js/host/nhjs_host.c",
  "tools/c2js/host/nhjs_tty_api.c",
];

/** The core C sources listed by HACKCSRC in sys/unix/Makefile.src. */
export function extractHackSources(makefileText) {
  const match = makefileText.match(/HACKCSRC\s*=\s*([\s\S]*?)\n\s*# all operating-system-dependent/);
  if (!match) throw new Error("Could not locate HACKCSRC in Makefile.src");
  return match[1]
    .replace(/\\/g, " ")
    .split(/\s+/)
    .filter((name) => name.endsWith(".c"));
}

/** Writes source-manifest.json beside the prepared tree `root`; returns the core sources. */
export function writeManifest(root) {
  const hackSources = extractHackSources(readFileSync(join(root, "sys/unix/Makefile.src"), "utf8"));
  const manifest = {
    upstream: "nethack-c/upstream",
    patches: nethackPatches,
    portPatches: portPatches.flatMap(({ file, patches }) => patches.map(({ why }) => `${file}: ${why}`)),
    hackSources,
    portSources,
  };
  writeFileSync(join(dirname(root), "source-manifest.json"), JSON.stringify(manifest, null, 2));
  return hackSources;
}
