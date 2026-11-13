/* truth.c: C truth values (comparisons, !, && / ||, conversions to bool) are the ints 0 and 1
   wherever they are observed as numbers */

/* returned, then switched on (steal() -> switch in uhitm.c) */
function gives_up(n) { /* int */
    return +!(n % 5 + 2 > 3);
}

/* returned, then used as an index (glow_strength() -> glow_verbs[]) */
function strength(count) { /* int */
    return (count > 12) ? 3 : (count > 4) ? 2 : +(count > 0);
}

/* passed as a bool parameter, then used as an index (coord_desc -> dxdy_to_dist_descr) */
function dirname_of(dx, fulldir) { /* int */
    let names = static_array("dirname_of.names", array_of(int, 2), 2, [ [ 10, 20 ], [ 30, 40 ] ]);

    return names[+(dx > 0)][fulldir];
}

function same(x, y) { /* int */
    return +(x == y);
}

export function truthret(a, b) { /* int */
    let glow = static_array("truthret.glow", int, 4, [ 1, 2, 3, 4 ]);
    let r = 0;

    switch (gives_up(a & 31)) {
    case 0:
        r += 1;
        break;
    case 1:
        r += 2;
        break;
    default:
        r += 100;
        break;
    }
    r += glow[strength(b & 15)] * 10;
    r += dirname_of(a & 3, +((b & 3) == 1)) * 100;
    switch (same(a & 1, b & 1)) {
    case 1:
        r += 5000;
        break;
    }
    return r;
}

export function truthstore(a, b) { /* int */
    let tab = static_array("truthstore.tab", int, 2, [ 7, 9 ]);
    let lt = +(a < b), either = ((a & 2) || (b & 4) ? 1 : 0), both = ((a & 8) && (b & 16) ? 1 : 0);
    let bb = (a & 4 ? 1 : 0), bp = +((b & 3) != 0);
    let r = 0;

    switch (lt) {
    case 1:
        r += 1;
        break;
    }
    r += tab[either] + tab[both] * 10;   /* || / && of ints: 0 or 1, not an operand */
    r += either * 100 + both * 1000;
    r += tab[bb] * 10000 + tab[bp] * 100000;
    lt = +!b;
    r += tab[lt];
    return r;
}

/* a truth value as a printf argument */
export function truthfmt(a, b) { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, 32);
    let n = sprintf(buf, _("%d%d%d"), +(a > b), +!b, ((a & 1) || (b & 1) ? 1 : 0));

    return n * 1000 + chars[buf + 0] * 100 + chars[buf + 1] * 10 + chars[buf + 2];
    } finally { stack_pop($frame); }
}

/* parentheses and casts the JS needs only once: ((x)), (+(a < b)) after a + or not, a cast of
   a cast to the same type, (void) on a statement */
const truthsink = static_var("truthsink", int);

function bump(v) { /* int */
    truthsink[0] += v;
    return truthsink[0];
}

export function truthparen(a, b) { /* int */
    let m = unsigned(Math.imul(unsigned(a), unsigned(b)));
    let r = a+(+(b > 3));
    let z = a > 0 ? b & 1 : 0;

    truthsink[0] = 0;
    bump(a & 255);
    truthsink[0] += b & 15;
    r -= +(a > b);
    r += -(+(a < b)) + +((a & 3) == 1);
    r += (m >>> 28) + z * 7 + truthsink[0];
    return r;
}

/* a parenthesized comma expression as a branch of a discarded ?: keeps its parentheses */
export function truthcomma(a, b) { /* int */
    let x = 0, y = 0;

    a > b ? (x = 1, y = 2) : (x = 3, y = 4);
    (b > 0 ? (x += 5, y += 6) : (x += 7, y += 8));
    return x * 10 + y;
}

import { char, int, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { sprintf } from "../rt/libc.js";
import { stack_array, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of } from "../rt/struct.js";
