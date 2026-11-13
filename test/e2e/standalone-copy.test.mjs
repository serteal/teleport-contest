// The game needs nothing outside js/ and frozen/: copy them to a temporary directory, then
// score public sessions there with the frozen scorer's worker in a child process. Nothing is
// written into the repository.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const SESSIONS = ["seed8000-tourist-starter", "seed0013-friday13-save-then-fullmoon-restore"];

test("a copy of js/ and frozen/ alone scores sessions", () => {
  const dir = mkdtempSync(join(tmpdir(), "nhjs-copy-"));
  try {
    cpSync(join(REPO, "js"), join(dir, "js"), { recursive: true });
    cpSync(join(REPO, "frozen"), join(dir, "frozen"), { recursive: true });
    cpSync(join(REPO, "package.json"), join(dir, "package.json"));
    symlinkSync(join(REPO, "sessions"), join(dir, "sessions"));
    for (const name of SESSIONS) {
      const r = spawnSync(process.execPath, [join(dir, "frozen", "ps_test_runner.mjs"), join(dir, "sessions", `${name}.session.json`)], {
        cwd: dir,
        encoding: "utf8",
        timeout: 600000,
      });
      assert.match(r.stderr, new RegExp(`PASS: ${name}`), r.stderr.slice(-2000));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
