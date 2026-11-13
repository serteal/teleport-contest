/* NetHack 5.0	timeout.h	$NHDT-Date: 1705087443 2024/01/12 19:24:03 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.23 $ */
/* Copyright 1994, Dean Luick                                     */
/* NetHack may be freely redistributed.  See license for details. */

/* generic timeout function */

/* kind of timer */

    export const TIMER_NONE = 0;
    export const TIMER_LEVEL = 1; /* event specific to level [melting ice] */
    export const TIMER_GLOBAL = 2; /* event follows current play [not used] */
    export const TIMER_OBJECT = 3; /* event follows an object [various] */
    export const TIMER_MONSTER = 4; /* event follows a monster [not used] */
    export const NUM_TIMER_KINDS = TIMER_MONSTER + 1; /* 5 */

/* save/restore timer ranges */
export const RANGE_LEVEL = 0;
export const RANGE_GLOBAL = 1;

/*
 * Timeout functions.  Add an enum here, then put it in the table
 * in timeout.c.  "One more level of indirection will fix everything."
 * Also add it to timerstr[] in nhl_get_timertype(nhlua.c); the entries
 * there match these but are spelled differently.
 *
 * Note:  if any are inserted, removed, or reordered then EDITLEVEL
 * needs to be incremented because timeout indices get written into save
 * and bones files if any timers are present while saving.  (Adding new
 * ones at the end isn't restricted this way since new indices won't be
 * present in old data.)
 */

    export const ROT_ORGANIC = 0; /* for buried organics */
    export const ROT_CORPSE = ROT_ORGANIC + 1;
    export const REVIVE_MON = ROT_CORPSE + 1;
    export const ZOMBIFY_MON = REVIVE_MON + 1;
    export const BURN_OBJECT = ZOMBIFY_MON + 1;
    export const HATCH_EGG = BURN_OBJECT + 1;
    export const FIG_TRANSFORM = HATCH_EGG + 1;
    export const SHRINK_GLOB = FIG_TRANSFORM + 1;
    export const MELT_ICE_AWAY = SHRINK_GLOB + 1;

    export const NUM_TIME_FUNCS = MELT_ICE_AWAY + 1;

/* used in timeout.c */
export const struct_fe = struct("struct_fe", {
    next: ptr_to("struct_fe"), /* next item in chain */
    timeout: long, /* when we time out */
    tid: ulong, /* timer ID */
    kind: short, /* kind of use */
    func_index: short, /* what to call when we time out */
    arg: "struct_any", /* pointer to timeout argument */
    needs_fixup: Bitfield(1), /* does arg need to be patched? */
});

import { long, short, ulong } from "../rt/ctypes.js";
import { Bitfield, ptr_to, struct } from "../rt/struct.js";
