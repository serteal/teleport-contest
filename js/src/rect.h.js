/* NetHack 5.0	rect.h	$NHDT-Date: 1596498557 2020/08/03 23:49:17 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.9 $ */
/* Copyright (c) 1990 by Jean-Christophe Collet                   */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_nhrect = struct("struct_nhrect", {
    lx: coordxy, ly: coordxy,
    hx: coordxy, hy: coordxy,
});

import { coordxy } from "./global.h.js";
import { struct } from "../rt/struct.js";
