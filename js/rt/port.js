// rt/port.js: platform functions called by emitted code that have no C definition to emit.
//
// They are the host callbacks of the game driver (declared in sys/c2js/nhjs_tty_api.c)
// and the data-file installer; each forwards to the host (machine.libc(name, args)), which
// implements them in js/host (host/boot.js).

import { libc_function } from "./heap.js";
export { longjmp } from "./setjmp.js";

function port(name) { return libc_function(name); }

// installs the game data files (js/dat) into the file system
export const nhjs_install_data_files = port("nhjs_install_data_files");
// host callbacks of sys/c2js/nhjs_tty_api.c
export const nhjs_js_boundary = port("nhjs_js_boundary");
export const nhjs_js_capture = port("nhjs_js_capture");
export const nhjs_js_key = port("nhjs_js_key");
