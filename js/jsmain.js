// jsmain.js - the game's entry points:
//
//   runSegment(input)                          one segment, run to its end (the scorer)
//   NethackGame                                the game class (host/game.js Game), which
//                                              index.html and frozen/playability_runner.mjs
//                                              start on a display
//   continueInteractiveGame(display, keyCode)  one key of interactive play (js/allmain.js)
//
// The game is the readable JS emitted from the NetHack C sources (js/src, js/win, js/sys,
// js/dat) running on js/rt over the vendored C library (js/vendor), driven by js/host.
import { Game, setGameEntry, gameOnDisplay } from "./host/game.js";

setGameEntry(() => import("./host/entry.js"));

/** The game class used by runSegment and the interactive page. */
export const NethackGame = Game;

export { gameOnDisplay };

export async function runSegment(input) {
  const game = new NethackGame(input);
  await game.start();
  return game;
}

// The keys typed but not read yet, in order (js/terminal.js's queue, read only).
function queuedKeys(display) {
  const queue = display?.terminal?._inputQueue;
  return Array.isArray(queue) ? queue : [];
}

// One key from the browser or the playability check, with the keys already
// typed after it (type-ahead, see host/game.js pushKey).  Returns false once
// the game has ended.
export function continueInteractiveGame(display, keyCode) {
  const game = gameOnDisplay(display);
  if (!game || !game.pushKey(keyCode, queuedKeys(display))) return false;
  game.paintDisplay();
  return true;
}
