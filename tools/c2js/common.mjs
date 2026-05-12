import { spawnSync } from "node:child_process";
import { projectRoot } from "./c2js.config.mjs";

export const nethackPortDefines = [
  "-DANSI_DEFAULT",
  "-DNH_C2JS_TTY_CAPTURE",
  "-DNH_C2JS_MACOS_MESSAGES",
  "-DNH_C2JS_RECORDER_PLATFORM",
  "-DNO_TERMCAP_HEADERS",
  "-DNO_TIMED_DELAY",
  "-DNOTPARMDECL",
  '-DPORT_ID="MacOS"',
];

export function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: options.cwd || projectRoot,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || "";
    throw new Error(
      `${cmd} ${args.join(" ")} failed${detail ? `\n${detail}` : ""}`,
    );
  }
  return result.stdout || "";
}

export function ensureToolchain() {
  run("emcc", ["-v"], { capture: true });
  run("clang", ["--version"], { capture: true });
}

export function forbiddenRuntimeHooks(text) {
  return [
    [
      /(\bfrom\s*['"]node:fs['"]|\bimport\s*\(\s*['"]node:fs['"]\s*\))/,
      "node:fs import",
    ],
    [
      /(\bfrom\s*['"]child_process['"]|\bimport\s*\(\s*['"]child_process['"]\s*\))/,
      "child_process import",
    ],
    [
      /(\bfrom\s*['"]worker_threads['"]|\bimport\s*\(\s*['"]worker_threads['"]\s*\))/,
      "worker_threads import",
    ],
    [/\brequire\s*\(/, "require()"],
    [/\beval\s*\(/, "eval()"],
    [/\bnew\s+Function\b|\bFunction\s*\(/, "Function constructor"],
  ]
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label);
}
