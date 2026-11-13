// The contest's own constraint check (tools/check-submission.mjs) must pass on the shipped tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("../..", import.meta.url));

test("submission constraint check passes", () => {
  const r = spawnSync(process.execPath, ["tools/check-submission.mjs"], { cwd: REPO, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
