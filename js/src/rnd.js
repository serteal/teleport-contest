/* NetHack 5.0	rnd.c	$NHDT-Date: 1596498205 2020/08/03 23:43:25 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.30 $ */
/*      Copyright (c) 2004 by Robert Patrick Rankin               */
/* NetHack may be freely redistributed.  See license for details. */

/* Suppress rng logging macros inside this file -- we define the real
   functions here, and add logging directly in each function body.
   Internal calls (e.g. rnz calling rn2) inherit the outer caller's
   context because the macros don't fire inside rnd.c. */

/*
 * PRNG call logging infrastructure.
 * When NETHACK_RNGLOG is set, every rn2/rnd/rnl/d/rne/rnz call is logged
 * with: call#, function(args) = result @ caller_func(file:line)
 *
 * The caller_func, file:line come from rng_log_set_caller(), invoked
 * by the macros in hack.h before calling the real function.
 *
 * Caller context propagation: the context is NOT cleared after logging.
 * This means internal rn2 calls from wrapper functions (rnz, rne, rnl)
 * inherit the ORIGINAL caller's file:line annotation.  For example,
 * if start_corpse_timeout at mkobj.c:1409 calls rnz(25), the internal
 * rn2(1000), rn2(4), rn2(2) calls all log with "@ mkobj.c:1409".
 * The wrapper result (rnz, rne, rnl) also logs with the same annotation.
 *
 * Context is overwritten by the next macro expansion (each external call
 * sets fresh context), so there is no stale-context problem.
 */
const rng_logfile = static_var("rng_logfile", ptr_to("struct__IO_FILE"), null);
const rng_log_disp = static_var("rng_log_disp", schar, FALSE);
const rng_call_count = static_var("rng_call_count", int, 0);
const rng_caller_file = static_var("rng_caller_file", ptr_to(char), 0);
const rng_caller_line = static_var("rng_caller_line", int, 0);
const rng_caller_func = static_var("rng_caller_func", ptr_to(char), 0);

export function rng_log_init() { /* void */
    let logpath = getenv(_("NETHACK_RNGLOG"));
    let disp = getenv(_("NETHACK_RNGLOG_DISP"));

    if (logpath && chars[logpath]) {
        rng_logfile[0] = fopen(logpath, _("w"));
        if (rng_logfile[0])
            setvbuf(rng_logfile[0], 0, _IOLBF, 0); /* line-buffered */
    }
    rng_log_disp[0] = (disp && chars[disp] && chars[disp] != ord('0')) ? TRUE : FALSE;
}

export function rng_log_enabled() { /* boolean */
    return rng_logfile[0] ? TRUE : FALSE;
}

export function rng_log_set_caller(file, line, func) { /* void */
    rng_caller_file[0] = file;
    rng_caller_line[0] = line;
    rng_caller_func[0] = func;
}

export function rng_log_get_call_count() { /* int */
    return rng_call_count[0];
}

function rng_log_write(func, args, result) { /* void */
    if (!rng_logfile[0])
        return;
    rng_call_count[0]++;
    if (rng_caller_file[0]) {
        if (rng_caller_func[0]) {
            fprintf(rng_logfile[0], _("%d %s(%s) = %d @ %s(%s:%d)\n"),
                    rng_call_count[0], func, args, result,
                    rng_caller_func[0], rng_caller_file[0], rng_caller_line[0]);
        } else {
            fprintf(rng_logfile[0], _("%d %s(%s) = %d @ %s:%d\n"),
                    rng_call_count[0], func, args, result,
                    rng_caller_file[0], rng_caller_line[0]);
        }
        /* Do NOT clear rng_caller_file here -- let internal calls from
           wrapper functions (rnz, rne, rnl) inherit the same context. */
    } else {
        fprintf(rng_logfile[0], _("%d %s(%s) = %d\n"),
                rng_call_count[0], func, args, result);
    }
}

const struct_rnglist_t = struct("struct_rnglist_t", {
    fn: fnptr_t,
    init: boolean,
    rng_state: "struct_isaac64_ctx",
});

const CORE = 0; const DISP = 1;

const rnglist = static_array("rnglist", struct_rnglist_t, null, [
    { fn: rn2, init: FALSE, rng_state: { n: 0 } },                      /* CORE */
    { fn: rn2_on_display_rng, init: FALSE, rng_state: { n: 0 } },       /* DISP */
]);

function whichrng(fn) { /* int */
    let i;

    for (i = 0; i < SIZE(rnglist); ++i)
        if (rnglist[i].fn == fn)
            return i;
    return -1;
}

export function init_isaac64(seed, fn) { /* void */
    const $frame = stack_frame(); try {
    let new_rng_state = stack_array(uchar, sizeof(ulong));
    let i;
    let rngindx = whichrng(fn);

    if (rngindx < 0)
        panic(_("Bad rng function passed to init_isaac64()."));

    for (i = 0; i < sizeof(ulong); i++) {
        uchars[new_rng_state + i] = uchar((seed & 0xFFn));
        seed >>= 8n;
    }
    isaac64_init(rnglist[rngindx].rng_state, new_rng_state,
                 sizeof(ulong));
    } finally { stack_pop($frame); }
}

function RND(x) { /* int */
    return int((isaac64_next_uint64(rnglist[CORE].rng_state) % u64(x)));
}

/* 0 <= rn2(x) < x, but on a different sequence from the "main" rn2;
   used in cases where the answer doesn't affect gameplay and we don't
   want to give users easy control over the main RNG sequence. */
export function rn2_on_display_rng(x) { /* int */
    let result = int((isaac64_next_uint64(rnglist[DISP].rng_state) % u64(x)));

    if (rng_logfile[0] && rng_log_disp[0]) {
        rng_call_count[0]++;
        fprintf(rng_logfile[0], _("%d ~drn2(%d) = %d"), rng_call_count[0], x, result);
        if (rng_caller_file[0]) {
            if (rng_caller_func[0]) {
                fprintf(rng_logfile[0], _(" @ %s(%s:%d)"),
                        rng_caller_func[0], rng_caller_file[0], rng_caller_line[0]);
            } else {
                fprintf(rng_logfile[0], _(" @ %s:%d"),
                        rng_caller_file[0], rng_caller_line[0]);
            }
        }
        fputc(ord('\n'), rng_logfile[0]);
    }
    return result;
}

/* #else (#ifdef USE_ISAAC64): not in this build */

/* 0 <= rn2(x) < x */
export function rn2(x) { /* int */
    const $frame = stack_frame(); try {
    let result;

    result = RND(x);
    if (rng_logfile[0]) {
        let buf = stack_array(char, 32);
        snprintf(buf, sizeof(array_of(char, 32)), _("%d"), x);
        rng_log_write(_("rn2"), buf, result);
    }
    return result;
    } finally { stack_pop($frame); }
}

/* 0 <= rnl(x) < x; sometimes subtracting Luck;
   good luck approaches 0, bad luck approaches (x-1) */
export function rnl(x) { /* int */
    const $frame = stack_frame(); try {
    let i, adjustment;
    /* Internal rn2 call inherits caller context from the rnl macro --
       no save/clear needed. */

    adjustment = Luck();
    if (x <= 15) {
        /* for small ranges, use Luck/3 (rounded away from 0);
           also guard against architecture-specific differences
           of integer division involving negative values */
        adjustment = Math.trunc((abs(adjustment) + 1) / 3) * sgn(adjustment);
        /*
         *       11..13 ->  4
         *        8..10 ->  3
         *        5.. 7 ->  2
         *        2.. 4 ->  1
         *       -1,0,1 ->  0 (no adjustment)
         *       -4..-2 -> -1
         *       -7..-5 -> -2
         *      -10..-8 -> -3
         *      -13..-11-> -4
         */
    }

    i = RND(x);
    if (adjustment && rn2(37 + abs(adjustment))) {
        i -= adjustment;
        if (i < 0)
            i = 0;
        else if (i >= x)
            i = x - 1;
    }
    if (rng_logfile[0]) {
        let buf = stack_array(char, 32);
        snprintf(buf, sizeof(array_of(char, 32)), _("%d"), x);
        rng_log_write(_("rnl"), buf, i);
    }
    return i;
    } finally { stack_pop($frame); }
}

/* 1 <= rnd(x) <= x */
export function rnd(x) { /* int */
    const $frame = stack_frame(); try {
    let result;

    result = RND(x) + 1;
    if (rng_logfile[0]) {
        let buf = stack_array(char, 32);
        snprintf(buf, sizeof(array_of(char, 32)), _("%d"), x);
        rng_log_write(_("rnd"), buf, result);
    }
    return result;
    } finally { stack_pop($frame); }
}

export function rnd_on_display_rng(x) { /* int */
    return rn2_on_display_rng(x) + 1;
}

/* d(N,X) == NdX == dX+dX+...+dX N times; n <= d(n,x) <= (n*x) */
export function d(n, x) { /* int */
    const $frame = stack_frame(); try {
    let tmp = n;
    let orig_n = n;

    while (n--)
        tmp += RND(x);
    if (rng_logfile[0]) {
        let buf = stack_array(char, 64);
        snprintf(buf, sizeof(array_of(char, 64)), _("%d,%d"), orig_n, x);
        rng_log_write(_("d"), buf, tmp);
    }
    return tmp; /* Alea iacta est. -- J.C. */
    } finally { stack_pop($frame); }
}

/* 1 <= rne(x) <= max(u.ulevel/3,5) */
export function rne(x) { /* int */
    const $frame = stack_frame(); try {
    let tmp, utmp;
    /* Internal rn2 calls inherit caller context from the rne macro --
       no save/clear needed. */

    utmp = (u.ulevel < 15) ? 5 : Math.trunc(u.ulevel / 3);
    tmp = 1;
    while (tmp < utmp && !rn2(x))
        tmp++;
    if (rng_logfile[0]) {
        let buf = stack_array(char, 32);
        snprintf(buf, sizeof(array_of(char, 32)), _("%d"), x);
        rng_log_write(_("rne"), buf, tmp);
    }
    return tmp;

    /* was:
     *  tmp = 1;
     *  while (!rn2(x))
     *    tmp++;
     *  return min(tmp, (u.ulevel < 15) ? 5 : u.ulevel / 3);
     * which is clearer but less efficient and stands a vanishingly
     * small chance of overflowing tmp
     */
    } finally { stack_pop($frame); }
}

/* rnz: everyone's favorite! */
export function rnz(i) { /* int */
    const $frame = stack_frame(); try {
    let x = i;
    let tmp = 1000;
    /* Internal rn2/rne calls inherit caller context from the rnz macro --
       no save/clear needed. */

    tmp += rn2(1000);
    tmp *= rne(4);
    if (rn2(2)) {
        x *= tmp;
        x = Math.trunc(x / 1000);
    } else {
        x *= 1000;
        x = Math.trunc(x / tmp);
    }
    if (rng_logfile[0]) {
        let buf = stack_array(char, 32);
        snprintf(buf, sizeof(array_of(char, 32)), _("%d"), i);
        rng_log_write(_("rnz"), buf, int(x));
    }
    return int(x);
    } finally { stack_pop($frame); }
}

/* Sets the seed for the random number generator */

function set_random(seed,
           fn) { /* void */
    init_isaac64(seed, fn);
}

/* #else (#ifdef USE_ISAAC64): not in this build */

/* An appropriate version of this must always be provided in
   port-specific code somewhere. It returns a number suitable
   as seed for the random number generator */

/*
 * Initializes the random number generator.
 * Only call once.
 */
export function init_random(fn) { /* void */
    set_random(sys_random_seed(), fn);
}

/* Reshuffles the random number generator. */
export function reseed_random(fn) { /* void */
   /* only reseed if we are certain that the seed generation is unguessable
    * by the players. */
    if (has_strong_rngseed)
        init_random(fn);
}

/* randomize the given list of numbers  0 <= i < count */
export function shuffle_int_array(indices, count) { /* void */
    let i, iswap, temp;

    for (i = count - 1; i > 0; i--) {
        if ((iswap = rn2(i + 1)) == i)
            continue;
        temp = indices[i];
        indices[i] = indices[iswap];
        indices[iswap] = temp;
    }
}

/*rnd.c*/

import { FALSE, TRUE, boolean } from "./global.h.js";
import { Luck } from "./you.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof, uchar, ulong } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { u64 } from "../rt/int64.js";
import { _IOLBF, abs, fopen, fprintf, fputc, getenv, setvbuf, snprintf } from "../rt/libc.js";
import { stack_array, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, fnptr_t, ptr_to, struct } from "../rt/struct.js";
import { u } from "./decl.js";
import { panic } from "./end.js";
import { sgn } from "./hacklib.js";
import { isaac64_init, isaac64_next_uint64 } from "./isaac64.js";
import { sys_random_seed } from "../sys/unix/unixmain.js";
