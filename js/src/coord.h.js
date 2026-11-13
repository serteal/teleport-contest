/* NetHack 5.0	coord.h	$NHDT-Date: 1596498531 2020/08/03 23:48:51 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.11 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Kenneth Lorber, Kensington, Maryland, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_nhcoord = struct("struct_nhcoord", {
    x: coordxy, y: coordxy,
});

import { coordxy } from "./global.h.js";
import { struct } from "../rt/struct.js";
