#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { projectRoot } from "./c2js/c2js.config.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const runnerPath = join(projectRoot, "frozen/ps_test_runner.mjs");
const preloadPath = join(projectRoot, "tools/sandbox/preload.mjs");
const defaultSessionsDir = join(projectRoot, "sessions");

function resolveSessionFiles(targets) {
  const files = [];
  for (const target of targets) {
    const path = target.startsWith("/") ? target : join(projectRoot, target);
    if (!existsSync(path)) throw new Error(`Not found: ${target}`);
    const st = statSync(path);
    if (st.isFile() && path.endsWith(".session.json")) {
      files.push(path);
    } else if (st.isDirectory()) {
      for (const entry of readdirSync(path)) {
        const child = join(path, entry);
        if (entry.endsWith(".session.json") && statSync(child).isFile())
          files.push(child);
      }
    }
  }
  return [...new Set(files)].sort();
}

function permissionArgs(sessionPath) {
  const root = realpathSync(projectRoot);
  const session = realpathSync(sessionPath);
  return [
    "--permission",
    `--allow-fs-read=${root}`,
    `--allow-fs-read=${session}`,
    "--import",
    preloadPath,
  ];
}

const maxWorkerOutput = 64 * 1024 * 1024;

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function runSession(sessionPath, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        ...permissionArgs(sessionPath),
        runnerPath,
        `--worker-session=${sessionPath}`,
      ],
      {
        cwd: projectRoot,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let outputTooLarge = false;
    let timedOut = false;
    let closed = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!closed) child.kill("SIGKILL");
      }, 1000).unref();
    }, timeoutMs);
    timer.unref();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > maxWorkerOutput) {
        outputTooLarge = true;
        child.kill("SIGTERM");
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > maxWorkerOutput) {
        outputTooLarge = true;
        child.kill("SIGTERM");
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        session: basename(sessionPath),
        passed: false,
        metrics: {
          rngCalls: { matched: 0, total: 0 },
          screens: { matched: 0, total: 0 },
        },
        error: error.message,
      });
    });
    child.on("close", (status) => {
      closed = true;
      clearTimeout(timer);
      if (outputTooLarge) {
        resolve({
          session: basename(sessionPath),
          passed: false,
          metrics: {
            rngCalls: { matched: 0, total: 0 },
            screens: { matched: 0, total: 0 },
          },
          error: `worker output exceeded ${maxWorkerOutput} bytes`,
        });
        return;
      }
      if (timedOut || (status ?? 0) !== 0) {
        resolve({
          session: basename(sessionPath),
          passed: false,
          metrics: {
            rngCalls: { matched: 0, total: 0 },
            screens: { matched: 0, total: 0 },
          },
          error: timedOut
            ? `worker timed out after ${timeoutMs}ms`
            : (stderr || "").trim() || `exit ${status}`,
        });
        return;
      }

      const marker = "__RESULT_ONE__";
      const idx = stdout.lastIndexOf(marker);
      if (idx < 0) {
        resolve({
          session: basename(sessionPath),
          passed: false,
          metrics: {
            rngCalls: { matched: 0, total: 0 },
            screens: { matched: 0, total: 0 },
          },
          error: "worker output missing __RESULT_ONE__ marker",
        });
        return;
      }
      resolve(JSON.parse(stdout.slice(idx + marker.length).trim()));
    });
  });
}

async function runPool(items, jobs, worker, onResult) {
  const results = new Array(items.length);
  let next = 0;
  async function runNext() {
    while (next < items.length) {
      const index = next++;
      const result = await worker(items[index], index);
      results[index] = result;
      onResult?.(result, index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(jobs, items.length) }, () => runNext()),
  );
  return results;
}

function maybeWriteAdvisory(bundle) {
  try {
    const advisory = join(projectRoot, ".cache/session-results.strict.json");
    mkdirSync(dirname(advisory), { recursive: true });
    writeFileSync(advisory, JSON.stringify(bundle, null, 2));
  } catch (error) {
    process.stderr.write(
      `(could not write strict advisory cache: ${error.message})\n`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: node ${scriptPath} [session-file-or-dir ...]`);
    return;
  }

  const targets = args.length ? args : [defaultSessionsDir];
  const sessionFiles = resolveSessionFiles(targets);
  if (!sessionFiles.length) throw new Error("No session files found.");

  const timeoutMs = parsePositiveInt(
    process.env.SESSION_REPLAY_TIMEOUT_MS,
    45000,
  );
  const jobs = parsePositiveInt(process.env.SESSION_REPLAY_JOBS, 1);
  const results = await runPool(
    sessionFiles,
    jobs,
    (sessionFile) => runSession(sessionFile, timeoutMs),
    (result) => {
      const r = result.metrics?.rngCalls || {};
      const s = result.metrics?.screens || {};
      const status = result.passed ? "PASS" : "FAIL";
      process.stderr.write(
        `  ${status}: ${result.session} (RNG ${r.matched}/${r.total}, Screen ${s.matched}/${s.total})\n`,
      );
    },
  );

  const passed = results.filter((result) => result.passed).length;
  process.stderr.write(`  ${passed}/${results.length} passing\n`);

  const bundle = {
    timestamp: new Date().toISOString(),
    commit: "unknown",
    sandbox: {
      nodePermission: true,
      preload: "tools/sandbox/preload.mjs",
      wasmPoisoned: true,
      fetchPoisoned: true,
    },
    results,
  };

  maybeWriteAdvisory(bundle);
  console.log("__RESULTS_JSON__");
  console.log(JSON.stringify(bundle));
}

main().catch((error) => {
  console.error("Fatal:", error.message);
  process.exit(1);
});
