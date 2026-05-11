#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSession } from "../frozen/session_loader.mjs";
import { runSegment } from "../js/jsmain.js";
import {
  canonicalizeTerminalScreen,
  normalizeTerminalVariants,
} from "../js/terminal-canonical.js";
import { projectRoot } from "./c2js/c2js.config.mjs";

const scriptPath = fileURLToPath(import.meta.url);

function usage() {
  return `Usage: node ${scriptPath} [--json] [--limit N] <session-file-or-dir ...>

Find the first strict raw screen mismatch and print token-level context.`;
}

function normalizeScreenRaw(screen) {
  return canonicalizeTerminalScreen(normalizeTerminalVariants(screen));
}

function visibleChar(ch) {
  if (ch === "\n") return "\\n";
  if (ch === "\x0e") return "SO";
  if (ch === "\x0f") return "SI";
  if (ch === "\x1b") return "ESC";
  const code = ch.charCodeAt(0);
  if (code < 32 || code === 127)
    return `\\x${code.toString(16).padStart(2, "0")}`;
  return ch;
}

function tokenizeRaw(screen) {
  const s = normalizeScreenRaw(screen);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const start = i;
    const ch = s[i];
    if (ch === "\x1b" && s[i + 1] === "[") {
      i += 2;
      while (i < s.length) {
        const code = s.charCodeAt(i);
        i++;
        if (code >= 0x40 && code <= 0x7e) break;
      }
      const raw = s.slice(start, i);
      tokens.push({ kind: "csi", raw, text: raw.replace("\x1b", "ESC") });
      continue;
    }
    if (ch === "\n") {
      i++;
      tokens.push({ kind: "nl", raw: ch, text: "\\n" });
      continue;
    }
    if (ch === "\x0e" || ch === "\x0f") {
      i++;
      tokens.push({
        kind: ch === "\x0e" ? "so" : "si",
        raw: ch,
        text: visibleChar(ch),
      });
      continue;
    }
    let text = "";
    while (
      i < s.length &&
      s[i] !== "\x1b" &&
      s[i] !== "\n" &&
      s[i] !== "\x0e" &&
      s[i] !== "\x0f"
    ) {
      text += s[i++];
    }
    tokens.push({ kind: "text", raw: text, text });
  }
  return tokens;
}

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

function flattenCanonicalScreens(segments) {
  const screens = [];
  for (const segment of segments) {
    for (const step of segment.steps || []) {
      if (step.screen) screens.push(step.screen);
    }
  }
  return screens;
}

function replayInputFor(segment) {
  return {
    seed: segment.seed,
    datetime: segment.datetime,
    nethackrc: segment.nethackrc,
    moves: segment.moves,
  };
}

function createStorageHandle() {
  const storage = new Map();
  return {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
    get length() {
      return storage.size;
    },
    key(index) {
      let n = 0;
      for (const key of storage.keys()) {
        if (n === index) return key;
        n++;
      }
      return null;
    },
  };
}

function firstTokenMismatch(cScreen, jsScreen) {
  const cTokens = tokenizeRaw(cScreen);
  const jsTokens = tokenizeRaw(jsScreen);
  const total = Math.max(cTokens.length, jsTokens.length);
  for (let index = 0; index < total; index++) {
    const c = cTokens[index] || null;
    const js = jsTokens[index] || null;
    if (c?.raw === js?.raw) continue;
    const from = Math.max(0, index - 5);
    const to = Math.min(total, index + 6);
    return {
      index,
      c,
      js,
      context: {
        c: cTokens.slice(from, to),
        js: jsTokens.slice(from, to),
      },
    };
  }
  return null;
}

async function checkSession(sessionPath) {
  const data = JSON.parse(readFileSync(sessionPath, "utf8"));
  const segments = normalizeSession(data).segments;
  const storage = createStorageHandle();
  const jsScreens = [];
  for (const segment of segments) {
    const game = await runSegment({ ...replayInputFor(segment), storage });
    jsScreens.push(...(game?.getScreens?.() || []));
  }
  const cScreens = flattenCanonicalScreens(segments);
  const total = Math.min(cScreens.length, jsScreens.length);
  for (let screenIndex = 0; screenIndex < total; screenIndex++) {
    const cRaw = normalizeScreenRaw(cScreens[screenIndex]);
    const jsRaw = normalizeScreenRaw(jsScreens[screenIndex]);
    if (cRaw === jsRaw) continue;
    return {
      session: basename(sessionPath),
      path: sessionPath,
      screenIndex,
      counts: { c: cScreens.length, js: jsScreens.length },
      cPrefix: cRaw.slice(0, 240),
      jsPrefix: jsRaw.slice(0, 240),
      token: firstTokenMismatch(cScreens[screenIndex], jsScreens[screenIndex]),
    };
  }
  if (cScreens.length !== jsScreens.length) {
    return {
      session: basename(sessionPath),
      path: sessionPath,
      screenIndex: total,
      counts: { c: cScreens.length, js: jsScreens.length },
      cPrefix: normalizeScreenRaw(cScreens[total] || "").slice(0, 240),
      jsPrefix: normalizeScreenRaw(jsScreens[total] || "").slice(0, 240),
      token: null,
    };
  }
  return null;
}

function parseArgs(argv) {
  const opts = { json: false, limit: 1, targets: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") opts.help = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--limit") opts.limit = Number(argv[++i] || 1);
    else if (arg.startsWith("--limit="))
      opts.limit = Number(arg.slice("--limit=".length));
    else opts.targets.push(arg);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.targets.length) {
    console.log(usage());
    return;
  }
  const files = resolveSessionFiles(opts.targets);
  const mismatches = [];
  for (const file of files) {
    const mismatch = await checkSession(file);
    if (mismatch) {
      mismatches.push(mismatch);
      if (mismatches.length >= opts.limit) break;
    }
  }
  const result = {
    checked: files.length,
    mismatches: mismatches.length,
    first: mismatches[0] || null,
    samples: mismatches,
  };
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (!mismatches.length) {
    console.log(`No raw screen mismatches in ${files.length} session(s).`);
  } else {
    for (const mismatch of mismatches) {
      console.log(`${mismatch.session} screen ${mismatch.screenIndex}`);
      console.log(
        `  C screens ${mismatch.counts.c}, JS screens ${mismatch.counts.js}`,
      );
      console.log(`  C prefix : ${JSON.stringify(mismatch.cPrefix)}`);
      console.log(`  JS prefix: ${JSON.stringify(mismatch.jsPrefix)}`);
      if (mismatch.token) {
        console.log(`  first token mismatch #${mismatch.token.index}`);
        console.log(`    C : ${JSON.stringify(mismatch.token.c)}`);
        console.log(`    JS: ${JSON.stringify(mismatch.token.js)}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(`raw-screen-diff: ${error.message}`);
  process.exit(1);
});
