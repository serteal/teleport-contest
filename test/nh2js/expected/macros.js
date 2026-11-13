/* macros.c: which macro invocations stay calls */

export function macro_sites(a, b) { /* int */
    let r = max(a, b);           /* kept: pure arguments */
    let s = twice(a + 1);        /* kept: pure argument used twice */
    let t = (rn2(10) + (rn2(3)));     /* expanded: impure argument and impure body */
    let u = rn1(b, 2);           /* kept */

    return r + s + t + u + NORMAL_SPEED;
}

import { NORMAL_SPEED } from "./fixture.h.js";
import { max, rn1, twice } from "./fixture.h.macros.js";
import { rn2 } from "./rng.js";
