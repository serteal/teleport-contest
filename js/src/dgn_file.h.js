/* NetHack 5.0	dgn_file.h	$NHDT-Date: 1596498533 2020/08/03 23:48:53 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.10 $ */
/* Copyright (c) 1989 by M. Stephenson                            */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Structures manipulated by the dungeon loader & compiler
 */

export const struct_couple = struct("struct_couple", {
    base: short, rand: short,
});

export const struct_tmpdungeon = struct("struct_tmpdungeon", {
    name: ptr_to(char), protoname: ptr_to(char),
    lev: "struct_couple",
    flags: int, chance: int, levels: int, branches: int,
        entry_lev: int, /* entry level for this dungeon */
    boneschar: char,
    align: int,
});

export const struct_tmplevel = struct("struct_tmplevel", {
    name: ptr_to(char),
    chainlvl: ptr_to(char),
    lev: "struct_couple",
    chance: int, rndlevs: int, chain: int, flags: int,
    boneschar: char,
});

export const struct_tmpbranch = struct("struct_tmpbranch", {
    name: ptr_to(char), /* destination dungeon name */
    lev: "struct_couple",
    chain: int, /* index into tmplevel array (chained branch)*/
    type: int, /* branch type (see below) */
    up: int, /* branch is up or down */
});

/*
 *    Values for type in tmpbranch structure.
 */
export const TBR_STAIR = 0;
export const TBR_NO_UP = 1;
export const TBR_NO_DOWN = 2;
export const TBR_PORTAL = 3;

/*
 *    Flags that map into the dungeon flags bitfields.
 */
export const TOWN = 0x01;
export const HELLISH = 0x02;
export const MAZELIKE = 0x04;
export const ROGUELIKE = 0x08;
export const UNCONNECTED = 0x10;

export const D_ALIGN_NONE = 0;
export const D_ALIGN_CHAOTIC = (AM_CHAOTIC << 4);
export const D_ALIGN_NEUTRAL = (AM_NEUTRAL << 4);
export const D_ALIGN_LAWFUL = (AM_LAWFUL << 4);

export const D_ALIGN_MASK = 0x70;

/*
 *    Max number of prototype levels and branches.
 */
export const LEV_LIMIT = 50;
export const BRANCH_LIMIT = 32;

import { AM_CHAOTIC, AM_LAWFUL, AM_NEUTRAL } from "./align.h.js";
import { char, int, short } from "../rt/ctypes.js";
import { ptr_to, struct } from "../rt/struct.js";
