/* NetHack 5.0	align.h	$NHDT-Date: 1604269810 2020/11/01 22:30:10 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.15 $ */
/* Copyright (c) Mike Stephenson, Izchak Miller  1991.            */
/* NetHack may be freely redistributed.  See license for details. */

export const aligntyp = schar; /* basic alignment type */

export const struct_align = struct("struct_align", { /* alignment & record */
    type: aligntyp,
    record: int,
    abuse: unsigned,
});

export const A_NONE = (-128);

export const A_CHAOTIC = (-1);
export const A_NEUTRAL = 0;
export const A_LAWFUL = 1;

/* align masks */
export const AM_NONE = 0x00;
export const AM_CHAOTIC = 0x01;
export const AM_NEUTRAL = 0x02;
export const AM_LAWFUL = 0x04;
export const AM_MASK = 0x07;

/* Some altars are considered shrines, add a flag for that
   for the altarmask field of struct rm. */
export const AM_SHRINE = 0x08;
/* High altar on Astral plane or Moloch's sanctum */
export const AM_SANCTUM = 0x10;

/* special level flags, gone by the time the level has been loaded */
export const AM_SPLEV_CO = 0x20;
export const AM_SPLEV_NONCO = 0x40;
export const AM_SPLEV_RANDOM = 0x80;

export const MSA_NONE = 0;

/* alignment change reasons for uchangealign(attrib.c) */

    export const A_CG_CONVERT = 0; /* permanently converted */
    export const A_CG_HELM_ON = 1; /* donned helm of opposite alignment */
    export const A_CG_HELM_OFF = 2; /* doffed helm of opposite alignment */

import { int, schar, unsigned } from "../rt/ctypes.js";
import { struct } from "../rt/struct.js";
