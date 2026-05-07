// Browser compatibility loop for index.html.
//
// Scoring enters through js/jsmain.js:runSegment().  The old hand-written
// skeleton move loop has been removed; browser play delegates each key to the
// generated C-to-JS engine by replaying the accumulated move string.

import { game } from './gstate.js';
import { KEY_BINDINGS } from './terminal.js';
import { continueInteractiveGame } from './jsmain.js';

export async function newgame() {
  game.program_state = game.program_state || {};
  game.program_state.gameover = false;
}

export async function moveloop_core() {
  const display = game?.nhDisplay;
  if (!display) return;

  if (!display._nhjsInteractive) {
    display.putstr?.(0, 0, 'Interactive C-to-JS engine is not attached yet.');
    game.program_state = game.program_state || {};
    game.program_state.gameover = false;
    return;
  }

  const key = await display.readKey({ bindings: KEY_BINDINGS.VI_KEYS });
  await continueInteractiveGame(display, key);
  game.program_state = game.program_state || {};
  game.program_state.gameover = false;
}

export async function moveloop() {
  for (;;) {
    await moveloop_core();
    if (game.program_state?.gameover) break;
  }
}
