// host/endgame.js - how a game ends.
//
// NetHack ends the program with exit() (after "Goodbye", a save, #quit,
// death), abort() or by returning from main().  In the port each of these
// throws out of the game code to the segment driver, which keeps every
// screen captured until then.  The C library's stdio buffers are not
// flushed; the game closes the files it cares about itself.

/** exit(status) or a return from main(). */
export class GameExit extends Error {
  constructor(status) {
    super(`exit(${status})`);
    this.name = "ExitStatus"; // host/game.js checks it
    this.status = status;
  }
}

/** abort() */
export class GameAbort extends Error {
  constructor(message = "abort") {
    super(message);
    this.name = "GameAbort";
  }
}

/** True for the exceptions that end a game normally (not a port bug). */
export function isGameEnd(e) {
  return e instanceof GameExit || e instanceof GameAbort;
}
