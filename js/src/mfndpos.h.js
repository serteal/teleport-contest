/* NetHack 5.0	mfndpos.h	$NHDT-Date: 1596498546 2020/08/03 23:49:06 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.14 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2005. */
/* NetHack may be freely redistributed.  See license for details. */

/* clang-format off */
export const ALLOW_MDISP = 0x00001000;
export const ALLOW_TRAPS = 0x00020000;
export const ALLOW_U = 0x00040000;
export const ALLOW_M = 0x00080000;
export const ALLOW_TM = 0x00100000;
export const ALLOW_ALL = (ALLOW_U | ALLOW_M | ALLOW_TM | ALLOW_TRAPS);
export const NOTONL = 0x00200000;
export const OPENDOOR = 0x00400000;
export const UNLOCKDOOR = 0x00800000;
export const BUSTDOOR = 0x01000000;
export const ALLOW_ROCK = 0x02000000;
export const ALLOW_WALL = 0x04000000;
export const ALLOW_DIG = 0x08000000;
export const ALLOW_BARS = 0x10000000;
export const ALLOW_SANCT = 0x20000000;
export const ALLOW_SSM = 0x40000000;

export const NOGARLIC = 0x80000000;

/* clang-format on */

export const struct_mfndposdata = struct("struct_mfndposdata", {
    cnt: int,
    poss: array_of("struct_nhcoord", 9),
    info: array_of(long, 9),
});

import { int, long } from "../rt/ctypes.js";
import { array_of, struct } from "../rt/struct.js";
