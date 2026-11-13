// Running the external tools of the C preparation (clang, make, rsync, git), found on PATH.

import { spawnSync } from "node:child_process";
import { projectRoot } from "./c2js.config.mjs";

/**
 * Runs `cmd args` (in options.cwd, default the repository root) and returns its stdout when
 * options.capture is set; output goes to the terminal otherwise.  Throws when the command is
 * missing or fails.
 */
export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd ?? projectRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error?.code === "ENOENT") {
    throw new Error(`\`${cmd}\` was not found on PATH; tools/c2js needs it to prepare the sources`);
  }
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || result.error?.message || "";
    throw new Error(`${cmd} ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`);
  }
  return result.stdout ?? "";
}
