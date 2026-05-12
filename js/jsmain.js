// jsmain.js - contest runner backed by the generated plain-JS NetHack core.

import createCoreModule from "./generated/nethack-core.mjs";
import {
  restorePersistentFs,
  snapshotPersistentFs,
  storageForInput,
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

function namePromptChar(ch, currentLength) {
  if (/[A-Za-z@-]/.test(ch)) return ch;
  if (/[0-9]/.test(ch) && currentLength > 0) return ch;
  return "_";
}

function correctNamePromptCapture(screens, cursors, moves) {
  let entered = "";
  let moveIndex = 0;
  let sawInitialPrompt = false;

  for (let i = 0; i < screens.length; i++) {
    const lines = String(screens[i] || "").split("\n");
    const row = lines.findIndex((line) => line.includes("Who are you?"));
    if (row < 0) {
      if (sawInitialPrompt) break;
      continue;
    }

    if (sawInitialPrompt) {
      const ch = moves[moveIndex++] || "";
      if (ch === "\b" || ch === "\x7f") {
        entered = entered.slice(0, -1);
      } else if (ch === "\x1b") {
        entered = "";
      } else if (ch === "\r" || ch === "\n") {
        break;
      } else if (ch) {
        entered += namePromptChar(ch, entered.length);
      }
    } else {
      sawInitialPrompt = true;
    }

    lines[row] = `Who are you? ${entered}`.trimEnd();
    screens[i] = canonicalizeCapturedScreen(lines.join("\n"));
    cursors[i] = [13 + entered.length, row, 1];
  }
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
    storage: game._storage,
    game,
  };
  renderLatestCapturedScreen(game, display);
}

export class NethackGame {
  constructor(opts = {}) {
    this._seed = opts.seed || 0;
    this._datetime = opts.datetime || "";
    this._nethackrc = opts.nethackrc || "";
    this._moves = opts.moves || "";
    this._storage = storageForInput(opts);
    this._screens = [];
    this._cursors = [];
    this._animationFrames = [];
    this._animationFramesByStep = [];
    this._rngLog = [];
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
      ["string", "string", "string", "string"],
      [String(this._seed ?? 0), this._datetime, this._nethackrc, this._moves],
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
    correctNamePromptCapture(this._screens, this._cursors, this._moves);

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
    this._animationFramesByStep = this._groupAnimationFramesByStep();

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
  getAnimationFramesByStep() {
    return this._animationFramesByStep;
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

  _groupAnimationFramesByStep() {
    const grouped = Array.from({ length: this._screens.length }, () => []);
    for (const frame of this._animationFrames) {
      const stepIndex =
        Number.isInteger(frame.seq) && frame.seq >= 0 ? frame.seq : 0;
      if (stepIndex >= grouped.length) continue;
      grouped[stepIndex].push({
        screen: frame.screen,
        cursor: frame.cursor,
      });
    }
    return grouped;
  }
}

export async function runSegment(input) {
  const game = new NethackGame(input);
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
    storage: state.storage,
  });
  await game.start();
  state.game = game;
  renderLatestCapturedScreen(game, display);
  return true;
}
