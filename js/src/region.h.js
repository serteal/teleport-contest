/* NetHack 5.0	region.h	$NHDT-Date: 1596498557 2020/08/03 23:49:17 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.15 $ */
/* Copyright (c) 1996 by Jean-Christophe Collet                   */
/* NetHack may be freely redistributed.  See license for details. */

/* generic callback function */

/*
 * player_flags
 */
export const REG_HERO_INSIDE = 0x01;
export const REG_NOT_HEROS = 0x02;

/*
 * Note: if you change the size/type of any of the fields below,
 *       or add any/remove any fields, you must update the
 *       bwrite() calls in save_regions(), and the
 *       mread() calls in rest_regions() in src/region.c
 *       to reflect the changes.
 */

export const MONST_INC = 5; export const NhRegion = struct("NhRegion", {
    bounding_box: "struct_nhrect", /* Bounding box of the region */
    rects: ptr_to("struct_nhrect"), /* Rectangles composing the region */
    nrects: short, /* Number of rectangles  */
    attach_2_u: boolean, /* Region attached to player ? */
    attach_2_m: unsigned, /* Region attached to monster ? */
    /*struct obj *attach_2_o;*//* Region attached to object ? UNUSED YET */
    enter_msg: ptr_to(char), /* Message when entering */
    leave_msg: ptr_to(char), /* Message when leaving */
    ttl: long, /* Time to live. -1 is forever */
    expire_f: short, /* Function to call when region's ttl expire */
    can_enter_f: short, /* Function to call to check whether the player
                            * can, or can not, enter the region */
    enter_f: short, /* Function to call when the player enters*/
    can_leave_f: short, /* Function to call to check whether the player
                            * can, or can not, leave the region */
    leave_f: short, /* Function to call when the player leaves */
    inside_f: short, /* Function to call every turn if player's inside */
    player_flags: unsigned, /* (see above) */
    monsters: ptr_to(unsigned), /* Monsters currently inside this region */
    n_monst: short, /* Number of monsters inside this region */
    max_monst: short, /* Maximum number of monsters that can be
                            * listed without having to grow the array */

    /* Should probably do the same thing about objects */

    visible: boolean, /* Is the region visible? */
    glyph: int, /* Which glyph to use if visible */
    arg: "struct_any", /* Optional user argument (Ex: strength of
                            * force field, damage of a fire zone, ...*/
});

import { boolean } from "./global.h.js";
import { char, int, long, short, unsigned } from "../rt/ctypes.js";
import { ptr_to, struct } from "../rt/struct.js";
