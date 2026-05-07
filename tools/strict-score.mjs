#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './c2js/c2js.config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const runnerPath = join(projectRoot, 'frozen/ps_test_runner.mjs');
const preloadPath = join(projectRoot, 'tools/sandbox/preload.mjs');
const defaultSessionsDir = join(projectRoot, 'sessions');

function resolveSessionFiles(targets) {
  const files = [];
  for (const target of targets) {
    const path = target.startsWith('/') ? target : join(projectRoot, target);
    if (!existsSync(path)) throw new Error(`Not found: ${target}`);
    const st = statSync(path);
    if (st.isFile() && path.endsWith('.session.json')) {
      files.push(path);
    } else if (st.isDirectory()) {
      for (const entry of readdirSync(path)) {
        const child = join(path, entry);
        if (entry.endsWith('.session.json') && statSync(child).isFile()) files.push(child);
      }
    }
  }
  return [...new Set(files)].sort();
}

function permissionArgs(sessionPath) {
  const root = realpathSync(projectRoot);
  const session = realpathSync(sessionPath);
  return [
    '--permission',
    `--allow-fs-read=${root}`,
    `--allow-fs-read=${session}`,
    '--import',
    preloadPath,
  ];
}

function runSession(sessionPath, timeoutMs) {
  const child = spawnSync(process.execPath, [
    ...permissionArgs(sessionPath),
    runnerPath,
    `--worker-session=${sessionPath}`,
  ], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
  });

  if (child.error || (child.status ?? 0) !== 0) {
    return {
      session: basename(sessionPath),
      passed: false,
      metrics: { rngCalls: { matched: 0, total: 0 }, screens: { matched: 0, total: 0 } },
      error: child.error?.message || (child.stderr || '').trim() || `exit ${child.status}`,
    };
  }

  const marker = '__RESULT_ONE__';
  const idx = (child.stdout || '').lastIndexOf(marker);
  if (idx < 0) {
    return {
      session: basename(sessionPath),
      passed: false,
      metrics: { rngCalls: { matched: 0, total: 0 }, screens: { matched: 0, total: 0 } },
      error: 'worker output missing __RESULT_ONE__ marker',
    };
  }
  return JSON.parse(child.stdout.slice(idx + marker.length).trim());
}

function maybeWriteAdvisory(bundle) {
  try {
    const advisory = join(projectRoot, '.cache/session-results.strict.json');
    mkdirSync(dirname(advisory), { recursive: true });
    writeFileSync(advisory, JSON.stringify(bundle, null, 2));
  } catch (error) {
    process.stderr.write(`(could not write strict advisory cache: ${error.message})\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node ${scriptPath} [session-file-or-dir ...]`);
    return;
  }

  const targets = args.length ? args : [defaultSessionsDir];
  const sessionFiles = resolveSessionFiles(targets);
  if (!sessionFiles.length) throw new Error('No session files found.');

  const timeoutMs = Number(process.env.SESSION_REPLAY_TIMEOUT_MS || 45000);
  const results = [];
  for (const sessionFile of sessionFiles) {
    const result = runSession(sessionFile, timeoutMs);
    results.push(result);
    const r = result.metrics?.rngCalls || {};
    const s = result.metrics?.screens || {};
    const status = result.passed ? 'PASS' : 'FAIL';
    process.stderr.write(
      `  ${status}: ${result.session} (RNG ${r.matched}/${r.total}, Screen ${s.matched}/${s.total})\n`
    );
  }

  const passed = results.filter(result => result.passed).length;
  process.stderr.write(`  ${passed}/${results.length} passing\n`);

  const bundle = {
    timestamp: new Date().toISOString(),
    commit: 'unknown',
    sandbox: {
      nodePermission: true,
      preload: 'tools/sandbox/preload.mjs',
      wasmPoisoned: true,
      fetchPoisoned: true,
    },
    results,
  };

  maybeWriteAdvisory(bundle);
  console.log('__RESULTS_JSON__');
  console.log(JSON.stringify(bundle));
}

main().catch(error => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
