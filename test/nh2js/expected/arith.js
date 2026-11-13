/* arith.c: integer semantics (differential-tested against native C) */

export function divmod(a, b) { /* int */
    if (b == 0)
        return 0;
    return Math.trunc(a / b) * 7 + a % b;
}

export function uwrap(a, b) { /* unsigned */
    let u = unsigned(a);
    u = unsigned(u - unsigned(b));
    u = unsigned(Math.imul(u, 2654435761));
    return u >>> 3;
}

export function narrow(a, b) { /* int */
    let c = uchar(a);
    let s = schar((a + b));
    let flag = +((a & 0x100) != 0);
    let h = short((a * 1000));
    c = uchar(c + b);
    return c + s * 3 + flag + h;
}

export function bits64(a, b) { /* long long */
    let m = shl64(a, 20);
    let f = or64(m, W_ARMOR);
    f = and64(f, ~W_ARM);
    if (f & 0x80000000)
        f = xor64(f, 1);
    return f + shr64(m, 3) + b;
}

export function logic(a, b) { /* int */
    let r = +((a > b) && (b > 0));
    let s = (a || b ? 1 : 0);
    return r * 10 + s + +!a + (a < b ? 1 : 2);
}

export function loops(a, b) { /* int */
    let i, t = 0;

    for (i = 0; i < (a & 15); i++) {
        if (i == b % 7)
            continue;
        t += i * max(i, 3);
        if (t > 1000)
            break;
    }
    while (t > 50)
        t -= 17;
    do {
        t++;
    } while (t % 5);
    return t;
}

export function gotos(a, b) { /* int */
    var r = 0;

    done: { neg: { if (a < 0)
        break neg;;
    if (b < 0) {
        r = 1;
        break done;
    }
    r = 2;
 retry: for (;;) {
    r += 3;
    if (r < 20 && (a & 1))
        continue retry;; break; }
    break done;
 }
    r = -1;
 }
    return r + a % 3;
}

export function into_branch(a, b) { /* int */
    let $goto = null;
    var r = 0;

    $goto_shared: for (;;) { switch ($goto || (a & 3)) {
    case 0:
        r = 10;
        if (b & 1)
            { $goto = "shared"; continue $goto_shared; };
        break;
    case 1:
        r = 20;
        break;
    case "shared": default:
        if (!$goto && (b > 100)) {
            r = 30;
        } else {
 $goto = null;
            r += 5;
        }
        break;
    } break; }
    return r;
}

/* goto shapes the readable forms cannot express: a label reached from both sides, a goto
   into a loop body, a goto across case labels (lowered to the $goto dispatcher) */
export function gotomix(a, b) { /* int */
    let $goto = null;
    var r = 0, i = 0;

    $goto_again: for (;;) { switch ($goto) { default: if (a & 1)
        { $goto = "inside"; continue $goto_again; };
 case "again": $goto = null;
    r += 2;
    if (r > 40)
        { $goto = "out"; continue $goto_again; };
    case "inside": for ($goto || (i = 0); $goto || (i < (b & 7)); i++) {
        switch ($goto) { default: r += i;
 case "inside": $goto = null;
        r ^= 5; }
        if (r & 16)
            { $goto = "again"; continue $goto_again; };
    }
    $goto_shared: for (;;) { switch ($goto || (a & 3)) {
    case 0:
        if (b & 2)
            { $goto = "shared"; continue $goto_shared; };
        r += 100;
        break;
    case 1:
        r -= 3;
 case "shared": $goto = null;
        r *= 2;
        break;
    default:
        break;
    } break; }
 case "out": $goto = null;
    return r + i; } break; }
}

/* lspo_map's shape: a backward goto's region ends in the statement that also jumps forward
   past it; the forward break must leave the loop too */
export function gotoloop(a, b) { /* int */
    var r = 0, tries = 0;

 redo: for (;;) {
    r += 1;
    skip: { if (a & 1)
        break skip;;
    if (r < 5) {
        if (b & 1) {
            tries++;
            if (tries < 3)
                continue redo;;
            break skip;
        }
    }
 }
    return r * 10 + tries; break; }
}

/* a comparison / ! / !! as an index of an array of arrays */
export function boolidx(a, b) { /* int */
    let t = static_array("boolidx.t", array_of(int, 2), 2, [ [ 1, 2 ], [ 3, 4 ] ]);

    return t[+(a > b)][+!!(a & 1)] + t[+!b][+(a < 0)];
}

/* an array of structs passed to a macro (the JS array itself) */
const struct_pv = struct("struct_pv", { v: int, });
export function arrmacro(a, b) { /* int */
    const $frame = stack_frame(); try {
    let tab = init_list(stack_array(struct_pv, 3), [ { v: 5 }, { v: 6 }, { v: 7 } ]);

    return PICK(tab, unsigned(a) % 7).v + SIZE(tab) * b;
    } finally { stack_pop($frame); }
}

/* unsigned ^ / & / | results with bit 31 set */
export function ubits(a, b) { /* int */
    let x = unsigned(unsigned(a) ^ unsigned((~b)));
    let y = unsigned(unsigned(a) | 0x80000000);
    let z = unsigned(unsigned(a) & unsigned(b));

    z = unsigned(z & 0xFFFF0000);
    return (x % 11 + y % 13 + z % 17);
}

/* a goto into a block past a local array (storage must exist) */
export function gotoarr(a, b) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var buf = stack_array(char, 8);
    $goto_inside: for (;;) { switch ($goto) { default: if (a & 1)
        { $goto = "inside"; continue $goto_inside; };
    case "inside": {
        switch ($goto) { default:

        chars[buf + 1] = 1;
 case "inside": $goto = null;
        chars[buf + 2] = (b & 7); }
        return chars[buf + 2] + 1;
    } } break; }
    } finally { stack_pop($frame); }
}

/* an address-taken local with an initializer in a function the goto dispatcher handles
   (its storage is allocated at function start; the initializer runs at its line) */
function addto(p, v) { /* void */
    p[0] += v;
}

export function gotoinit(a, b) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var pid = stack_var(int);
    var r = 0;

    $goto_inner: for (;;) { switch ($goto) { default: if (a & 1)
        { $goto = "inner"; continue $goto_inner; };
    r = 5;
    case "inner": {
 $goto = null;
        r += 1;
    } } break; }
    {
        pid[0] = 7;

        addto(pid, b & 15);
        r += pid[0];
    }
    return r;
    } finally { stack_pop($frame); }
}

import { W_ARM, W_ARMOR } from "./fixture.h.js";
import { PICK, max } from "./fixture.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, schar, short, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, or64, shl64, shr64, xor64 } from "../rt/int64.js";
import { init_list, stack_array, stack_var, static_array } from "../rt/locals.js";
import { array_of, struct } from "../rt/struct.js";
