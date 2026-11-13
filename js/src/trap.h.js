/* NetHack 5.0	trap.h	$NHDT-Date: 1670316586 2022/12/06 08:49:46 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.31 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2016. */
/* NetHack may be freely redistributed.  See license for details. */

/* note for 3.1.0 and later: no longer manipulated by 'makedefs' */

export const struct_vlaunchinfo = union("struct_vlaunchinfo", {
    v_launch_otyp: short, /* type of object to be triggered */
    v_launch2: "struct_nhcoord", /* secondary launch point (for boulders) */
    v_conjoined: uchar, /* conjoined pit locations */
    v_tnote: short, /* boards: 12 notes        */
});

export const struct_trap = struct("struct_trap", {
    ntrap: ptr_to("struct_trap"),
    tx: coordxy, ty: coordxy,
    dst: "struct_d_level", /* destination for portals/holes/trapdoors */
    launch: "struct_nhcoord",

    ttyp: Bitfield(5),
    tseen: Bitfield(1),
    once: Bitfield(1),
    madeby_u: Bitfield(1), /* So monsters may take offence when you trap
                            * them.  Recognizing who made the trap isn't
                            * completely unreasonable; everybody has
                            * their own style.  This flag is also needed
                            * when you untrap a monster.  It would be too
                            * easy to make a monster peaceful if you could
                            * set a trap for it and then untrap it. */
    vl: "struct_vlaunchinfo",
});

/* reasons for statue animation */
export const ANIMATE_NORMAL = 0;
export const ANIMATE_SHATTER = 1;
export const ANIMATE_SPELL = 2;

/* reasons for animate_statue's failure */
export const AS_OK = 0;
export const AS_NO_MON = 1;
export const AS_MON_IS_UNIQUE = 2;

/* Note: if adding/removing a trap, adjust trap_engravings[] in mklev.c */

/* unconditional traps */

    export const ALL_TRAPS = -1; /* mon_knows_traps(), mon_learns_traps() */
    export const NO_TRAP = 0;
    export const ARROW_TRAP = 1;
    export const DART_TRAP = 2;
    export const ROCKTRAP = 3;
    export const SQKY_BOARD = 4;
    export const BEAR_TRAP = 5;
    export const LANDMINE = 6;
    export const ROLLING_BOULDER_TRAP = 7;
    export const SLP_GAS_TRAP = 8;
    export const RUST_TRAP = 9;
    export const FIRE_TRAP = 10;
    export const PIT = 11;
    export const SPIKED_PIT = 12;
    export const HOLE = 13;
    export const TRAPDOOR = 14;
    export const TELEP_TRAP = 15;
    export const LEVEL_TELEP = 16;
    export const MAGIC_PORTAL = 17;
    export const WEB = 18;
    export const STATUE_TRAP = 19;
    export const MAGIC_TRAP = 20;
    export const ANTI_MAGIC = 21;
    export const POLY_TRAP = 22;
    export const VIBRATING_SQUARE = 23; /* not a trap but shown/remembered as if one
                            * once it has been discovered */

    /* trapped door and trapped chest aren't traps on the map, but they
       might be shown/remembered as such after trap detection until hero
       comes in view of them and sees the feature or object;
       key-using or door-busting monsters who survive a door trap learn
       to avoid other such doors [not implemented] */
    export const TRAPPED_DOOR = 24; /* part of door; not present on map as a trap */
    export const TRAPPED_CHEST = 25; /* part of object; not on map */

    export const TRAPNUM = 26;

/* some trap-related function return results */

    export const Trap_Effect_Finished = 0;
    export const Trap_Is_Gone = 0;
    export const Trap_Caught_Mon = 1;
    export const Trap_Killed_Mon = 2;
    export const Trap_Moved_Mon = 3; /* new location, or new level */

/* return codes from immune_to_trap() */

    export const TRAP_NOT_IMMUNE = 0;
    export const TRAP_CLEARLY_IMMUNE = 1;
    export const TRAP_HIDDEN_IMMUNE = 2;

import { coordxy } from "./global.h.js";
import { short, uchar } from "../rt/ctypes.js";
import { Bitfield, ptr_to, struct, union } from "../rt/struct.js";
