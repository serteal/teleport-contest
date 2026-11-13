// host/game.js - one game, with the interface the scorer and the browser use
// (js/jsmain.js exports it as NethackGame):
//
//   const game = new Game({ seed, datetime, nethackrc, moves, storage, rngLog, interactive });
//   game.attachDisplay(display)      // interactive play shown on a display (optional)
//   await game.start();              // runs the whole segment (or, interactive, up to the first key)
//   game.getScreens(), getCursors(), getRngLog(), getAnimationFramesByStep()
//   game.pushKey(code, queued)       // interactive: one more key (and the keys typed after it)
//   game.shownScreen()               // interactive: what the player sees now
//
// One machine (host/boot.js) per process; every game starts from its pristine state, so
// segments and successive browser games are independent.  The game's modules come from an
// entry module (see setGameEntry, js/host/entry.js): the game's C driver
// (sys/c2js/nhjs_tty_api.c, emitted) and dataFiles() (the game data, js/dat).

import { createMachine } from "./boot.js";
import { CaptureLog, splitRngLog, renderCapturedScreen } from "./capture.js";
import { MachineSnapshot } from "./snapshot.js";
import { RNG_LOG_PATH, playerNameFromRc } from "./env.js";
import { isGameEnd } from "./endgame.js";
import { utf8Bytes } from "./utf8.js";
import { isFile } from "./vfs.js";
import { restorePersistentVfs, snapshotPersistentVfs, storageForInput } from "../persistence.js";

let entryImporter = null;
let machinePromise = null;

/** How to import the game's entry module (call before the first game). */
export function setGameEntry(importer) {
  entryImporter = importer;
  machinePromise = null;
}

/** The process's machine, created and loaded on first use. */
export function loadMachine() {
  if (!machinePromise) {
    if (!entryImporter) throw new Error("game: no entry module (setGameEntry)");
    machinePromise = (async () => {
      const m = createMachine();
      await m.load(entryImporter);
      return m;
    })();
  }
  return machinePromise;
}

// The game playing on each display (interactive play: js/allmain.js finds it by the display).
const gamesOnDisplays = new WeakMap();

/** The game attached to `display` that has started, or undefined. */
export function gameOnDisplay(display) {
  return display ? gamesOnDisplays.get(display) : undefined;
}

// type-ahead: boundaries are snapshotted only over the last keys of a run (see atBoundary)
const TYPE_AHEAD_SNAPSHOT_KEYS = 16;

export class Game {
  constructor(opts = {}) {
    this._seed = opts.seed ?? 0;
    this._datetime = opts.datetime || "";
    this._nethackrc = opts.nethackrc || "";
    // `_storage` is also the name index.html assigns its storage to
    this._storage = storageForInput(opts);
    this._interactive = !!opts.interactive;
    this._keepRngLog = !!opts.rngLog;
    this._display = null;
    this._log = new CaptureLog(opts.moves || "");
    this._rngLog = [];
    this._stderr = [];
    this._ended = false;
    this._endReason = null;
    // files every start installs again (game data, sysconf, .nethackrc, the RNG log): not persisted
    this._persistSkip = new Set();
    this._machine = null;
    this._hooks = null;
    this._snapshot = null;
    this._vfs = null;
    this._finished = false;
    // interactive: the snapshot was taken at a command boundary (not before main()), and it
    // was just restored: the game is about to reach that boundary again
    this._snapshotAtBoundary = false;
    this._resuming = false;
    // type-ahead (see pushKey): keys already run whose screens have not been shown yet
    this._ahead = [];
    this._shown = null;
    this._watch = null;
  }

  /** Play interactively, showing the game on `display` (a js/game_display.js GameDisplay). */
  attachDisplay(display) {
    this._display = display;
  }

  // index.html and frozen/playability_runner.mjs attach their display by assigning this property
  set _pendingDisplay(display) {
    this.attachDisplay(display);
  }
  get _pendingDisplay() {
    return this._display;
  }

  async start() {
    if (this._display) this._interactive = true;
    const m = await loadMachine();
    this._machine = m;
    this._vfs = m.newGame({ datetime: this._datetime });
    this._hooks = this._machineHooks();
    m.current = this._hooks;
    this._installSession();
    if (this._interactive) {
      this._snapshot = new MachineSnapshot();
      this._takeSnapshot();
    }
    this._run();
    if (!this._interactive || this._ended) this._finishSegment();
    if (this._display) {
      gamesOnDisplays.set(this._display, this);
      this.paintDisplay();
    }
  }

  // what the machine calls back while this game runs (host/boot.js `current`)
  _machineHooks() {
    const log = this._log;
    const vfs = this._vfs;
    const entry = this._machine.entry;
    const fileMode = 0o666 & ~vfs.umask; // as fopen(path, "wb") creates them
    return {
      key: (i) => {
        if (this._watch !== null && i >= this._watch.next) this._noteKeyRequest(i);
        return log.key(i);
      },
      capture: (anim, seq, animId, cx, cy, screen) => log.capture(anim, seq, animId, cx, cy, screen),
      boundary: this._interactive ? () => this._atBoundary() : () => {},
      installData: () => {
        for (const [path, data] of entry.dataFiles()) vfs.writeFile(path, data, fileMode);
      },
    };
  }

  // The session's parameters, the game data and the playground (the C driver), then the
  // files earlier segments left.
  _installSession() {
    const m = this._machine;
    const entry = m.entry;
    const clib = m.clib;
    const vfs = this._vfs;
    const cString = (text) => {
      const bytes = utf8Bytes(text);
      const p = clib.fn.malloc(bytes.length + 1);
      clib.HEAPU8.set(bytes, p);
      clib.HEAPU8[p + bytes.length] = 0;
      return p;
    };
    const name = playerNameFromRc(this._nethackrc);
    entry.nhjs_session_init(cString(this._seed), cString(this._datetime), cString(this._nethackrc), cString(name));
    entry.nhjs_install_data();
    for (const [path] of vfs.walk("/")) this._persistSkip.add(path);
    entry.nhjs_install_files();
    // A player sees the whole screen: no 6,144-byte capture buffer (win/tty/termcap.c).
    if (this._interactive) clib.call("setenv", "NHJS_UNBOUNDED_CAPTURE", "1", 1);
    // Nor does a player need the RNG log (NETHACK_RNGLOG, one line per random number): a game
    // shown on a display does not write it unless asked to (opts.rngLog).
    if (this._display && !this._keepRngLog) clib.call("unsetenv", "NETHACK_RNGLOG");
    restorePersistentVfs(vfs, this._storage);
    for (const path of ["/sysconf", RNG_LOG_PATH]) this._persistSkip.add(path);
    for (const [path, node] of vfs.walk("/")) {
      if (path.endsWith("/.nethackrc") && isFile(node.mode)) this._persistSkip.add(path);
    }
  }

  _atBoundary() {
    // a replay from the snapshot first reaches the very boundary it was taken at: same state
    if (this._resuming) {
      this._resuming = false;
      return;
    }
    // type-ahead: a boundary with many typed keys still to go is passed by, a later one is kept
    // (the snapshot only has to be at some boundary of the keys run: replay works from any)
    const w = this._watch;
    if (w !== null && w.ends.length - w.views.length > TYPE_AHEAD_SNAPSHOT_KEYS) return;
    this._takeSnapshot(true);
  }

  _takeSnapshot(atBoundary = false) {
    this._snapshotAtBoundary = atBoundary;
    const log = this._log;
    this._snapshot.take(this._machine, { log: { save: () => log.mark(), restore: (s) => log.rewind(s) } });
  }

  _run() {
    if (this._ended) return;
    const m = this._machine;
    const sp = m.clib.stackSave();
    m.current = this._hooks;
    try {
      m.entry.nhjs_session_run();
    } catch (error) {
      m.clib.stackRestore(sp);
      // exit(), abort(), panic and error() end the game; the screens captured so far stand
      this._ended = true;
      this._endReason = String(error?.message || error);
      if (error?.name !== "ExitStatus") this._stderr.push(this._endReason + (isGameEnd(error) ? "" : "\n" + error?.stack));
    }
  }

  _readRngLog() {
    const log = this._vfs?.readFile(RNG_LOG_PATH);
    return log ? splitRngLog(new TextDecoder().decode(log)) : [];
  }

  _finishSegment() {
    this._rngLog = this._readRngLog();
    this._finished = true;
    snapshotPersistentVfs(this._vfs, this._storage, this._persistSkip);
  }

  /**
   * Interactive input: one key code (a UTF-16 unit, as the browser terminal delivers it).
   *
   * A key rewinds the game to its last command boundary (host/snapshot.js) and runs it
   * again with the key appended, so the keys of an unfinished command are processed again
   * for every new one.  Type-ahead: when `queued` holds keys already typed after this one,
   * the game runs once over all of them instead, and notes what the player would see after
   * each key (the screen when the game asks for the byte after it, or when it ends).  The
   * next pushKey calls, which bring those same keys, only show the noted screens in turn.
   * Keys after the one that ends the game are not run.
   */
  pushKey(keyCode, queued = []) {
    if (this._ahead.length) {
      const next = this._ahead.shift();
      if (next.code === keyCode) {
        this._shown = this._ahead.length ? next : null;
        return true;
      }
      // not the key that was queued (the queue was cleared): the keys run ahead stand
      this._ahead.length = 0;
      this._shown = null;
    }
    if (!this._machine || this._ended) return false;
    const log = this._log;
    const firstUnit = log.units;
    const keys = [keyCode, ...queued];
    const ends = [];
    for (const code of keys) {
      log.appendUnit(code);
      ends.push(log.keys.length);
    }
    const views = [];
    if (ends.length > 1) this._watch = { next: ends[0], ends, views, firstUnit };
    this._snapshot.restore(this._machine);
    this._resuming = this._snapshotAtBoundary;
    this._run();
    this._resuming = false;
    this._watch = null;
    if (this._ended) {
      // the key that ended the game is the last one run
      log.dropKeysAfter(firstUnit + views.length + 1, ends[views.length]);
      views.push(log.shownAt());
      this._finishSegment();
    }
    if (views.length > 1) {
      this._ahead = views.map((view, k) => ({ code: keys[k], view }));
      this._shown = this._ahead.shift();
    }
    return true;
  }

  // type-ahead: the game asks for byte `index`, so the keys ending at or before it are done
  _noteKeyRequest(index) {
    const w = this._watch;
    while (w.views.length < w.ends.length && index >= w.ends[w.views.length]) {
      w.views.push(this._log.shownAt(w.firstUnit + w.views.length + 1));
    }
    w.next = w.views.length < w.ends.length ? w.ends[w.views.length] : Infinity;
  }

  /** What the player sees: { screen, cursor } of the last screen shown, or null. */
  shownScreen() {
    return this._shown ? this._shown.view : this._log.shownAt();
  }

  /** Paint what the player sees on the attached display. */
  paintDisplay() {
    const shown = this.shownScreen();
    if (shown && this._display) renderCapturedScreen(this._display, shown.screen, shown.cursor);
  }

  /** The game has ended (with type-ahead: by the keys shown so far; only the last key run can end it). */
  get ended() {
    return this._shown ? false : this._ended;
  }
  getScreens() {
    return this._log.getScreens();
  }
  getCursors() {
    return this._log.getCursors();
  }
  getAnimationFramesByStep() {
    return this._log.getAnimationFramesByStep();
  }
  /** every RNG call so far (an unfinished interactive game reads its log file now) */
  getRngLog() {
    return this._finished ? this._rngLog : this._readRngLog();
  }
  /** RNG calls per step: none (the RNG log is per segment); tools/session-viewer asks for them */
  getRngSlices() {
    return [];
  }
  getStderr() {
    return this._stderr;
  }
  /** the game's file system (tests, diagnostics) */
  get vfs() {
    return this._vfs ?? null;
  }
}
