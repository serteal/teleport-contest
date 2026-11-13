/* rng.c: a deterministic rn2 for the differential test */

const rngstate = static_var("rngstate", unsigned, 12345);

export function rn2(x) { /* int */
    rngstate[0] = unsigned(unsigned(Math.imul(rngstate[0], 1103515245)) + 12345);
    return int(((rngstate[0] >>> 8) % unsigned(x)));
}

import { int, unsigned } from "../rt/ctypes.js";
import { static_var } from "../rt/locals.js";
