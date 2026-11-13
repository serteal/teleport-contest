// Emitted-tree hygiene (node --test): nothing under js/ emitted by tools/nh2js may contain an
// absolute path of the machine it was emitted on (a home or temporary directory, the user's
// name).  The game's own $HOME (NHJS_HOME of sys/c2js/nhjs_tty_api.c, which the game shows in
// its options help) is a constant of the game, not a local path.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const TREES = ["src", "include", "win", "sys", "libc", "dat"];

function files() {
  const out = [];
  const walk = (d) => {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else out.push(p);
    }
  };
  for (const t of TREES) if (fs.existsSync(path.join(repo, "js", t))) walk(path.join(repo, "js", t));
  return out;
}

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// the game's $HOME, as the emitted driver declares it
function gameHome() {
  const driver = fs.readFileSync(path.join(repo, "js/sys/c2js/nhjs_tty_api.js"), "latin1");
  const m = /^export const NHJS_HOME = "([^"]+)";$/m.exec(driver);
  assert.ok(m, "NHJS_HOME is declared in js/sys/c2js/nhjs_tty_api.js");
  return new RegExp(escape(m[1]), "g");
}

test("emitted modules contain no absolute local paths", () => {
  const home = gameHome();
  const local = [
    /\/(?:Users|home)\/[^/\s"'`]+\//, // a home directory
    /\/private\/(?:tmp|var)\/|\/var\/folders\//, // temporary directories (game data may name /tmp)
    new RegExp(escape(os.tmpdir()) + "/"),
    /\/opt\/[^/\s"'`]+\//, // installed toolchains
    new RegExp(escape(os.homedir()) + "/"),
    new RegExp(`\\b${escape(os.userInfo().username)}\\b`),
  ];
  const hits = [];
  for (const f of files()) {
    const t = fs.readFileSync(f, "latin1").replace(home, "$HOME");
    for (const re of local) {
      const m = re.exec(t);
      if (m) hits.push(`${path.relative(repo, f)}: ${re} at ${t.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, " ")}`);
    }
  }
  assert.deepEqual(hits.slice(0, 20), []);
});
