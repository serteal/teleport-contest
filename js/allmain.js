// allmain.js - the browser's move loop (index.html, frozen/playability_runner).
//
// Scoring enters through js/jsmain.js runSegment().  In the browser the
// engine (js/src) runs the real moveloop_core(); this
// loop only waits for a key and hands it to the engine, which resumes
// from its last command-boundary snapshot, or shows what it already ran
// for keys that were typed ahead (see jsmain.js, host/game.js pushKey).

import { game } from "./gstate.js";
import { KEY_BINDINGS } from "./terminal.js";
import { continueInteractiveGame, gameOnDisplay } from "./jsmain.js";

function programState() {
  game.program_state = game.program_state || {};
  return game.program_state;
}

export async function newgame() {
  programState().gameover = false;
}

export async function moveloop_core() {
  const display = game?.nhDisplay;
  if (!display) return;
  const engine = gameOnDisplay(display);
  if (!engine) {
    display.putstr?.(0, 0, "No game has been started on this display.");
    programState().gameover = false;
    return;
  }
  if (!engine.ended) {
    const key = await display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
    continueInteractiveGame(display, key);
  }
  programState().gameover = engine.ended;
}

export async function moveloop() {
  for (;;) {
    await moveloop_core();
    if (game.program_state?.gameover) break;
  }
}
