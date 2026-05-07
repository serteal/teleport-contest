#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { normalizeSession } from '../frozen/session_loader.mjs';
import { projectRoot } from './c2js/c2js.config.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const recordScript = join(projectRoot, 'scripts/record-session.mjs');
const checkScript = join(projectRoot, 'tools/check-traces.mjs');

function usage() {
  return `Usage: node ${scriptPath} --mode competition|paranoid [--out DIR] <session.session.json>

Records progressively shorter C prefixes and finds the shortest prefix that
still fails the selected checker. Currently minimizes the first segment only.`;
}

function parseArgs(argv) {
  const opts = {
    mode: 'paranoid',
    outDir: join(projectRoot, '.cache/minimized-trace'),
    session: '',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = () => {
      const eq = arg.indexOf('=');
      if (eq >= 0) return arg.slice(eq + 1);
      return argv[++i] || '';
    };
    if (arg === '-h' || arg === '--help') opts.help = true;
    else if (arg === '--mode' || arg.startsWith('--mode=')) opts.mode = value();
    else if (arg === '--out' || arg.startsWith('--out=')) {
      const raw = value();
      opts.outDir = raw.startsWith('/') ? raw : join(projectRoot, raw);
    } else if (arg.startsWith('--')) {
      throw new Error(`Unknown option: ${arg}`);
    } else {
      opts.session = arg.startsWith('/') ? arg : join(projectRoot, arg);
    }
  }
  if (!['competition', 'paranoid'].includes(opts.mode)) {
    throw new Error(`--mode must be competition or paranoid, got ${opts.mode}`);
  }
  return opts;
}

function writeCandidate(base, movesLength, outDir) {
  const session = structuredClone(base);
  session.segments[0].moves = session.segments[0].moves.slice(0, movesLength);
  session.segments[0].steps = [];
  delete session.segments[0].animation_frames;
  for (let i = 1; i < session.segments.length; i++) {
    session.segments[i].moves = '';
    session.segments[i].steps = [];
    delete session.segments[i].animation_frames;
  }
  const input = join(outDir, `candidate-${String(movesLength).padStart(5, '0')}.input.session.json`);
  const output = join(outDir, `candidate-${String(movesLength).padStart(5, '0')}.session.json`);
  writeFileSync(input, `${JSON.stringify(session, null, 2)}\n`);
  return { input, output };
}

function record(input, output) {
  const child = spawnSync(process.execPath, [recordScript, input, output], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(`record failed for ${basename(input)}\n${child.stderr || child.stdout}`);
  }
}

function check(output, mode) {
  const child = spawnSync(process.execPath, [checkScript, '--mode', mode, '--json', '--allow-fail', output], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (child.status !== 0) throw new Error(`check failed for ${basename(output)}\n${child.stderr || child.stdout}`);
  const data = JSON.parse((child.stdout || '').trim());
  return {
    failed: data.summary.passed !== data.summary.total,
    result: data.results?.[0] || null,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.session) {
    console.log(usage());
    return;
  }
  if (!existsSync(opts.session)) throw new Error(`Not found: ${opts.session}`);
  rmSync(opts.outDir, { recursive: true, force: true });
  mkdirSync(opts.outDir, { recursive: true });

  const base = normalizeSession(JSON.parse(readFileSync(opts.session, 'utf8')));
  if (!base.segments.length) throw new Error('session has no segments');
  const max = base.segments[0].moves.length;
  if (base.segments.length > 1) {
    console.error('[warn] minimizing first segment only; later segments are emptied');
  }

  const cache = new Map();
  const failsAt = length => {
    if (cache.has(length)) return cache.get(length);
    const paths = writeCandidate(base, length, opts.outDir);
    record(paths.input, paths.output);
    const result = check(paths.output, opts.mode);
    cache.set(length, { ...result, output: paths.output });
    console.error(`[${length}/${max}] ${result.failed ? 'FAIL' : 'PASS'} ${result.result?.classification || ''}`);
    return cache.get(length);
  };

  if (!failsAt(max).failed) {
    console.log(JSON.stringify({ minimized: false, reason: 'full trace passes', max }, null, 2));
    return;
  }

  let lo = 0;
  let hi = max;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (failsAt(mid).failed) hi = mid;
    else lo = mid;
  }
  const minimized = failsAt(hi);
  const summary = {
    minimized: true,
    mode: opts.mode,
    originalMoves: max,
    minimizedMoves: hi,
    output: minimized.output,
    classification: minimized.result?.classification || null,
    result: minimized.result,
  };
  writeFileSync(join(opts.outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(error => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
