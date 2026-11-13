// host/entry.js - the game's modules as the host loads them.
//
// Imported dynamically by host/game.js after the heap is attached, so the emitted modules'
// top-level declarations and static initialisers run on the machine's memory. js/modules.js
// (emitted by tools/nh2js) evaluates the whole game in order, types layer first. This module
// exposes the game's C driver (sys/c2js/nhjs_tty_api.c, emitted as js/sys/c2js/nhjs_tty_api.js)
// and the game data (js/dat). The driver's host callbacks and the data installer are host
// functions (host/boot.js).

import "../modules.js";

export {
  nhjs_session_init,
  nhjs_install_data,
  nhjs_install_files,
  nhjs_session_run,
} from "../sys/c2js/nhjs_tty_api.js";
export { dataFiles } from "../dat/index.js";
