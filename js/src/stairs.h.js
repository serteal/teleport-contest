/* NetHack 5.0	stairs.h	$NHDT-Date: 1685863327 2023/06/04 07:22:07 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.47 $ */
/* Copyright (c) 2024 by Pasi Kallinen */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_stairway = struct("struct_stairway", { /* basic stairway identifier */
    sx: coordxy, sy: coordxy, /* x / y location of the stair */
    tolev: "struct_d_level", /* where does it go */
    up: boolean, /* up or down? */
    isladder: boolean, /* ladder or stairway? */
    u_traversed: boolean, /* hero has traversed this stair */
    next: ptr_to("struct_stairway"),
});

import { boolean, coordxy } from "./global.h.js";
import { ptr_to, struct } from "../rt/struct.js";
