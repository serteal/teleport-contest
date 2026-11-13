// host/capture.js - the channels a segment produces: screens, cursors and animation
// frames per step, plus the RNG log.
//
// The game's tty code builds the terminal image itself (win/tty/termcap.c
// NOMUX capture) and hands it over at every input boundary ("input": the
// game is about to read a key) and at every animation step ("anim").  This
// module turns those into the scored channels and keeps the bookkeeping
// that interactive play rewinds (see host/snapshot.js).

import { utf8Bytes } from "./utf8.js";

// The bytes the game reads for one UTF-16 unit of `moves`: a key below 0x100 is one byte
// (Latin-1), with CR turned into LF as a tty would.  Anything above has no single-byte form
// and is sent as UTF-8; a lone surrogate becomes U+FFFD.
function keyBytes(unit) {
  if (unit === 13) return [10];
  if (unit < 0x100) return [unit];
  return utf8Bytes(String.fromCharCode(unit));
}

/** Lines of the RNG log file as they are compared ("rn2(12)=5"). */
export function splitRngLog(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\)\s+=\s+/g, ")="))
    .filter(Boolean);
}

/**
 * A screen is blank, and not kept, only when each of the first 24 lines holds
 * nothing but spaces.  A screen of attribute or charset codes around spaces is
 * kept and compared like any other.
 */
function isBlankCapturedScreen(screen) {
  return String(screen || "")
    .split("\n")
    .slice(0, 24)
    .every((line) => /^ *$/.test(line));
}

// runs of 5 or more spaces as cursor-forward sequences; no trailing empty lines
function canonicalizeCapturedScreen(screen) {
  const lines = String(screen || "")
    .split("\n")
    .map((line) => line.replace(/ {5,}/g, (spaces) => `\x1b[${spaces.length}C`));
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

/**
 * Keys, screens, cursors and animation frames of one segment.
 * The first moves.length + 1 input boundaries are kept; blank screens are
 * dropped, but animation frames are indexed by step.
 */
export class CaptureLog {
  constructor(moves = "") {
    this.keys = [];
    this.units = 0;
    for (let i = 0; i < moves.length; i++) this.appendUnit(moves.charCodeAt(i));
    this.screens = [];
    this.cursors = [];
    this.screenSteps = [];
    this.inputSteps = 0;
    this.animationFrames = [];
  }

  appendUnit(unit) {
    for (const byte of keyBytes(unit)) this.keys.push(byte);
    this.units++;
  }

  /** Byte `index` of the input, or -1 when it has not been typed yet. */
  key(index) {
    return index < this.keys.length ? this.keys[index] : -1;
  }

  capture(anim, seq, animId, cx, cy, rawScreen) {
    const screen = canonicalizeCapturedScreen(rawScreen);
    const cursor = [cx, cy, 1];
    if (anim) {
      this.animationFrames.push({ screen, cursor, seq, anim: animId });
      return;
    }
    const step = this.inputSteps++;
    if (isBlankCapturedScreen(rawScreen)) return;
    this.screens.push(screen);
    this.cursors.push(cursor);
    this.screenSteps.push(step);
  }

  mark() {
    return { screens: this.screens.length, inputSteps: this.inputSteps, anims: this.animationFrames.length };
  }

  rewind(m) {
    this.screens.length = m.screens;
    this.cursors.length = m.screens;
    this.screenSteps.length = m.screens;
    this.inputSteps = m.inputSteps;
    this.animationFrames.length = m.anims;
  }

  stepLimit() {
    return this.units + 1;
  }

  /** How many of the screens so far are kept once `units` keys have been typed. */
  keptScreens(units = this.units) {
    const limit = units + 1;
    let n = this.screens.length;
    while (n > 0 && this.screenSteps[n - 1] >= limit) n--;
    return n;
  }

  getScreens() {
    const n = this.keptScreens();
    return n === this.screens.length ? this.screens : this.screens.slice(0, n);
  }

  /** What a player sees once `units` keys have been typed: the last kept screen, or null. */
  shownAt(units = this.units) {
    const n = this.keptScreens(units);
    return n ? { screen: this.screens[n - 1], cursor: this.cursors[n - 1] } : null;
  }

  /** Forget every key after the first `units` (and their bytes, `bytes` in all). */
  dropKeysAfter(units, bytes) {
    this.keys.length = bytes;
    this.units = units;
  }

  getCursors() {
    return this.cursors.slice(0, this.getScreens().length);
  }

  getAnimationFramesByStep() {
    const steps = Math.min(this.inputSteps, this.stepLimit());
    const grouped = Array.from({ length: steps }, () => []);
    for (const frame of this.animationFrames) {
      const i = Number.isInteger(frame.seq) && frame.seq >= 0 ? frame.seq : 0;
      if (i < grouped.length) grouped[i].push({ screen: frame.screen, cursor: frame.cursor });
    }
    return grouped;
  }
}

const ROWS = 24;
const COLS = 80;
const DEFAULT_COLOR = 8;
const DEC_TO_UNICODE = {
  "`": "◆", a: "▒", f: "°", g: "±", j: "┘", k: "┐", l: "┌", m: "└", n: "┼", q: "─", t: "├",
  u: "┤", v: "┴", w: "┬", x: "│", y: "≤", z: "≥", "|": "≠", o: "⎺", s: "⎽", "{": "π", "~": "·",
};

function applySgr(params, state) {
  const parts = params === "" ? ["0"] : String(params).split(";");
  for (const part of parts) {
    const code = Number(part || 0);
    if (code === 0) {
      state.color = DEFAULT_COLOR;
      state.attr = 0;
    } else if (code === 1) state.attr |= 2;
    else if (code === 4) state.attr |= 4;
    else if (code === 7) state.attr |= 1;
    else if (code === 22) state.attr &= ~2;
    else if (code === 24) state.attr &= ~4;
    else if (code === 27) state.attr &= ~1;
    else if (code === 39) state.color = DEFAULT_COLOR;
    else if (code >= 30 && code <= 37) state.color = code - 30;
    else if (code >= 90 && code <= 97) state.color = code - 90 + 8;
  }
}

/** Paint a captured screen on a GameDisplay (browser and playability check). */
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
    if (ch === "\x0e" || ch === "\x0f") {
      decgfx = ch === "\x0e";
      i++;
      continue;
    }
    if (ch === "\x1b" && text[i + 1] === "[") {
      let j = i + 2;
      while (j < text.length && /[0-9;?]/.test(text[j])) j++;
      const params = text.slice(i + 2, j);
      const final = text[j];
      i = j + 1;
      if (final === "C") col += Number(params) || 1;
      else if (final === "m") applySgr(params, state);
      continue;
    }
    if (row >= 0 && row < ROWS && col >= 0 && col < COLS)
      display.setCell?.(col, row, decgfx ? DEC_TO_UNICODE[ch] || ch : ch, state.color, state.attr);
    col++;
    i++;
  }
  display.cursSet?.(cursor?.[2] ?? 1);
  display.setCursor?.(cursor?.[0] ?? 0, cursor?.[1] ?? 0);
}
