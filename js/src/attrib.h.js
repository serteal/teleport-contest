/* NetHack 5.0	attrib.h	$NHDT-Date: 1596498527 2020/08/03 23:48:47 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.12 $ */
/* Copyright 1988, Mike Stephenson                                */
/* NetHack may be freely redistributed.  See license for details. */

/*      attrib.h - Header file for character class processing. */

    export const A_STR = 0;
    export const A_INT = A_STR + 1;
    export const A_WIS = A_INT + 1;
    export const A_DEX = A_WIS + 1;
    export const A_CON = A_DEX + 1;
    export const A_CHA = A_CON + 1;

    export const A_MAX = A_CHA + 1; /* used in rn2() selection of attrib */

export const struct_attribs = struct("struct_attribs", {
    a: array_of(schar, A_MAX),
});

import { schar } from "../rt/ctypes.js";
import { array_of, struct } from "../rt/struct.js";
