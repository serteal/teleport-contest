// host/env.js - the process environment of a game.
//
// The C library starts with BASE_ENVIRONMENT; the game's C driver
// (sys/c2js/nhjs_tty_api.c nhjs_session_init) then sets the session's
// variables ($HOME, the RNG log, the seed, the fixed datetime, ...) itself.
// The player name it passes with `-u` comes from the rc (playerNameFromRc).

/** Path of the RNG log the game writes (NETHACK_RNGLOG, set by the C driver). */
export const RNG_LOG_PATH = "/rng.log";

/** Variables the C library starts with (Emscripten's defaults; LANG as under Node). */
export const BASE_ENVIRONMENT = Object.freeze({
  USER: "web_user",
  LOGNAME: "web_user",
  PATH: "/",
  PWD: "/",
  HOME: "/home/web_user",
  LANG: "C.UTF-8",
  _: "./this.program",
});

/** The player name of `nethack -u <name>`: the first `name:` of an OPTIONS= line of the rc, or "". */
export function playerNameFromRc(nethackrc) {
  for (const rawLine of String(nethackrc || "").split("\n")) {
    const line = rawLine.trim();
    const upper = line.toUpperCase();
    if (!(upper.startsWith("OPTIONS=") || upper.startsWith("OPTIONS ="))) continue;
    for (const opt of line.slice(line.indexOf("=") + 1).split(",")) {
      const t = opt.trim();
      if (t.toLowerCase().startsWith("name:")) return t.slice("name:".length).trim();
    }
  }
  return "";
}
