/* ptrs.c: memory-resident data (structs, out-parameters, strings) */

const counter = static_var("counter", int, 0);

function outparams(a, quot, small) { /* void */
    quot[0] = Math.trunc(a / 3);
    small[0] = coordxy(a);
}

export function use_out(a, b) { /* int */
    const $frame = stack_frame(); try {
    let q = stack_var(int);
    let s = stack_var(coordxy);

    outparams(a + b, q, s);
    counter[0]++;
    return q[0] * 100 + s[0];
    } finally { stack_pop($frame); }
}

export function strings(a, b) { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let p = buf;
    let n = 0;

    chars[buf + 2] = ord('z');
    while (n < (a & 7)) {
        chars[p++] = ord('a') + n;
        n++;
    }
    chars[p] = ord('\0');
    for (p = buf; chars[p]; p++)
        if (chars[p] == ord('c'))
            chars[p] = ord('C');
    return chars[buf + 0] + chars[buf + 2] * 3 + (p - buf) + b;
    } finally { stack_pop($frame); }
}

export function structs(a, b) { /* int */
    const $frame = stack_frame(); try {
    let t = stack_struct(struct_thing), u = stack_struct(struct_thing);
    let tp = t;

    tp.size = a;
    tp.x = coordxy(b);
    tp.counts[2] = a + b;
    tp.lit = 1;
    tp.kind = unsigned(a);
    tp.next = u;
    struct_assign(u, t);
    u.size += 1;
    return tp.next.size + u.counts[2] + u.kind + (is_big(tp) ? 100 : 0) + u.lit;
    } finally { stack_pop($frame); }
}

import { BUFSZ, coordxy, struct_thing } from "./fixture.h.js";
import { is_big } from "./fixture.h.macros.js";
import { char, int, ord, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { stack_array, stack_struct, stack_var, static_var } from "../rt/locals.js";
import { struct_assign } from "../rt/struct.js";
