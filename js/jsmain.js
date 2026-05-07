// jsmain.js - contest runner backed by the generated plain-JS NetHack core.

import createCoreModule from "./generated/nethack-core.mjs";
import {
  restorePersistentFs,
  snapshotPersistentFs,
  storageForGame,
} from "./persistence.js";
const ROWS = 24;
const COLS = 80;
const DEFAULT_COLOR = 8;
const DEC_TO_UNICODE = {
  "`": "\u25c6",
  a: "\u2592",
  f: "\u00b0",
  g: "\u00b1",
  j: "\u2518",
  k: "\u2510",
  l: "\u250c",
  m: "\u2514",
  n: "\u253c",
  q: "\u2500",
  t: "\u251c",
  u: "\u2524",
  v: "\u2534",
  w: "\u252c",
  x: "\u2502",
  y: "\u2264",
  z: "\u2265",
  "|": "\u2260",
  o: "\u23ba",
  s: "\u23bd",
  "{": "\u03c0",
  "~": "\u00b7",
};

function splitRngLog(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\)\s+=\s+/g, ")="))
    .filter(Boolean);
}

function previousArray(prevGame, getter, field) {
  if (!prevGame) return [];
  if (Array.isArray(prevGame[field])) return [...prevGame[field]];
  const value = prevGame[getter]?.();
  return Array.isArray(value) ? [...value] : [];
}

function isBlankCapturedScreen(screen) {
  return (
    String(screen || "")
      .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
      .replace(/[\x0e\x0f]/g, "")
      .trim() === ""
  );
}

function canonicalizeCapturedScreen(screen) {
  const lines = String(screen || "")
    .split("\n")
    .map((line) =>
      line.replace(/ {5,}/g, (spaces) => `\x1b[${spaces.length}C`),
    );
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

function applySgr(params, state) {
  const parts = params === "" ? ["0"] : String(params).split(";");
  for (const part of parts) {
    const code = Number(part || 0);
    if (code === 0) {
      state.color = DEFAULT_COLOR;
      state.attr = 0;
    } else if (code === 1) {
      state.attr |= 2;
    } else if (code === 4) {
      state.attr |= 4;
    } else if (code === 7) {
      state.attr |= 1;
    } else if (code === 22) {
      state.attr &= ~2;
    } else if (code === 24) {
      state.attr &= ~4;
    } else if (code === 27) {
      state.attr &= ~1;
    } else if (code === 39) {
      state.color = DEFAULT_COLOR;
    } else if (code >= 30 && code <= 37) {
      state.color = code - 30;
    } else if (code >= 90 && code <= 97) {
      state.color = code - 90 + 8;
    }
  }
}

export function renderCapturedScreen(display, screen, cursor = [0, 0, 1]) {
  if (!display) return;
  display.clearScreen?.();

  let row = 0;
  let col = 0;
  let decgfx = false;
  const state = { color: DEFAULT_COLOR, attr: 0 };
  const text = String(screen || "");

  for (let i = 0; i < text.length; ) {
    const ch = text[i];
    if (ch === "\n") {
      row++;
      col = 0;
      i++;
      continue;
    }
    if (ch === "\x0e") {
      decgfx = true;
      i++;
      continue;
    }
    if (ch === "\x0f") {
      decgfx = false;
      i++;
      continue;
    }
    if (ch === "\x1b" && text[i + 1] === "[") {
      let j = i + 2;
      while (j < text.length && /[0-9;?]/.test(text[j])) j++;
      const params = text.slice(i + 2, j);
      const final = text[j];
      i = j + 1;
      if (final === "C") {
        col += Number(params) || 1;
      } else if (final === "m") {
        applySgr(params, state);
      }
      continue;
    }

    if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
      display.setCell?.(
        col,
        row,
        decgfx ? DEC_TO_UNICODE[ch] || ch : ch,
        state.color,
        state.attr,
      );
    }
    col++;
    i++;
  }

  display.cursSet?.(cursor?.[2] ?? 1);
  display.setCursor?.(cursor?.[0] ?? 0, cursor?.[1] ?? 0);
}

export function initializeInteractiveGame(display, game) {
  attachInteractiveDisplay(game, display);
}

function renderLatestCapturedScreen(game, display) {
  const screens = game?.getScreens?.() || [];
  const cursors = game?.getCursors?.() || [];
  if (!screens.length) return;
  renderCapturedScreen(
    display,
    screens[screens.length - 1],
    cursors[cursors.length - 1],
  );
}

function attachInteractiveDisplay(game, display) {
  if (!display) return;
  display._nhjsInteractive = {
    seed: game._seed,
    datetime: game._datetime,
    nethackrc: game._nethackrc,
    moves: game._moves || "",
    game,
  };
  renderLatestCapturedScreen(game, display);
}

export class NethackGame {
  constructor(opts = {}, prevGame = null) {
    this._seed = opts.seed || 0;
    this._datetime = opts.datetime || "";
    this._nethackrc = opts.nethackrc || "";
    this._moves = opts.moves || "";
    this._storage = storageForGame(prevGame);
    this._screens = previousArray(prevGame, "getScreens", "_screens");
    this._cursors = previousArray(prevGame, "getCursors", "_cursors");
    this._animationFrames = previousArray(
      prevGame,
      "getAnimationFrames",
      "_animationFrames",
    );
    this._rngLog = previousArray(prevGame, "getRngLog", "_rngLog");
    this._stderr = [];
  }

  async start() {
    const mod = await createCoreModule({
      print() {},
      printErr: (line) => this._stderr.push(String(line)),
    });
    this._module = mod;
    restorePersistentFs(mod.FS, this._storage);

    mod.ccall(
      "nhjs_session_init",
      null,
      ["number", "string", "string", "string"],
      [this._seed, this._datetime, this._nethackrc, this._moves],
    );

    const maxIterations = Math.max(10000, this._moves.length * 64);
    try {
      mod.ccall("nhjs_session_run", "number", ["number"], [maxIterations]);
    } catch (error) {
      const message = String(error?.message || error || "");
      if (!message.includes("exit(0)")) throw error;
    }

    const screenCount = mod.ccall("nhjs_get_screen_count", "number", [], []);
    const finalCursor = [
      mod.ccall("nhjs_get_cursor_col", "number", [], []),
      mod.ccall("nhjs_get_cursor_row", "number", [], []),
      1,
    ];
    const hasFrameCursors =
      typeof mod._nhjs_get_screen_cursor_col === "function" &&
      typeof mod._nhjs_get_screen_cursor_row === "function";
    for (let i = 0; i < screenCount; i++) {
      const screen = canonicalizeCapturedScreen(
        mod.ccall("nhjs_get_screen", "string", ["number"], [i]),
      );
      if (isBlankCapturedScreen(screen)) continue;
      this._screens.push(screen);
      this._cursors.push(
        hasFrameCursors
          ? [
              mod.ccall(
                "nhjs_get_screen_cursor_col",
                "number",
                ["number"],
                [i],
              ),
              mod.ccall(
                "nhjs_get_screen_cursor_row",
                "number",
                ["number"],
                [i],
              ),
              1,
            ]
          : finalCursor,
      );
    }

    const animationCount =
      typeof mod._nhjs_get_animation_count === "function"
        ? mod.ccall("nhjs_get_animation_count", "number", [], [])
        : 0;
    const hasAnimationCursors =
      typeof mod._nhjs_get_animation_cursor_col === "function" &&
      typeof mod._nhjs_get_animation_cursor_row === "function";
    const hasAnimationIds =
      typeof mod._nhjs_get_animation_seq === "function" &&
      typeof mod._nhjs_get_animation_id === "function";
    for (let i = 0; i < animationCount; i++) {
      this._animationFrames.push({
        screen: canonicalizeCapturedScreen(
          mod.ccall("nhjs_get_animation_screen", "string", ["number"], [i]),
        ),
        cursor: hasAnimationCursors
          ? [
              mod.ccall(
                "nhjs_get_animation_cursor_col",
                "number",
                ["number"],
                [i],
              ),
              mod.ccall(
                "nhjs_get_animation_cursor_row",
                "number",
                ["number"],
                [i],
              ),
              1,
            ]
          : finalCursor,
        seq: hasAnimationIds
          ? mod.ccall("nhjs_get_animation_seq", "number", ["number"], [i])
          : null,
        anim: hasAnimationIds
          ? mod.ccall("nhjs_get_animation_id", "number", ["number"], [i])
          : null,
      });
    }

    try {
      this._rngLog.push(
        ...splitRngLog(mod.FS.readFile("/rng.log", { encoding: "utf8" })),
      );
    } catch {
      // A session can terminate before RNG logging is initialized.
    }
    snapshotPersistentFs(mod.FS, this._storage);
    if (this._pendingDisplay)
      attachInteractiveDisplay(this, this._pendingDisplay);
  }

  getScreens() {
    return this._screens;
  }
  getCursors() {
    return this._cursors;
  }
  getAnimationFrames() {
    return this._animationFrames;
  }
  getRngLog() {
    return this._rngLog;
  }
  getRngSlices() {
    return [];
  }
  getStderr() {
    return this._stderr;
  }
  getStorage() {
    return this._storage;
  }
}

export async function runSegment(input, prevGame = null) {
  const game = new NethackGame(input, prevGame);
  await game.start();
  return game;
}

export async function continueInteractiveGame(display, keyCode) {
  const state = display?._nhjsInteractive;
  if (!state) return false;
  state.moves += String.fromCharCode(keyCode);
  const game = new NethackGame({
    seed: state.seed,
    datetime: state.datetime,
    nethackrc: state.nethackrc,
    moves: state.moves,
  });
  await game.start();
  state.game = game;
  renderLatestCapturedScreen(game, display);
  return true;
}
