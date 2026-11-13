/* NetHack 5.0	spell.h	$NHDT-Date: 1646838388 2022/03/09 15:06:28 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.14 $ */
/* Copyright 1986, M. Stephenson                                  */
/* NetHack may be freely redistributed.  See license for details. */

export const NO_SPELL = 0;
export const UNKNOWN_SPELL = (-1);

/* spellbook re-use control; used when reading and when polymorphing */
export const MAX_SPELL_STUDY = 3;

export const struct_spell = struct("struct_spell", {
    sp_id: short, /* spell id (== object.otyp) */
    sp_lev: xint16, /* power level */
    sp_know: int, /* knowledge of spell */
});

    export const spe_Forgotten = -1; /* known but no longer castable */
    export const spe_Unknown = 0; /* not yet known */
    export const spe_Fresh = 1; /* castable if various casting criteria are met */
    export const spe_GoingStale = 2; /* still castable but nearly forgotten */

/* levels of memory destruction with a scroll of amnesia */

export const ALL_SPELLS = 0x2;

import { xint16 } from "./global.h.js";
import { int, short } from "../rt/ctypes.js";
import { struct } from "../rt/struct.js";
