/* NetHack 5.0	mkroom.h	$NHDT-Date: 1725653011 2024/09/06 20:03:31 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.33 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2016. */
/* NetHack may be freely redistributed.  See license for details. */

/* mkroom.h - types and structures for room and shop initialization */

export const struct_mkroom = struct("struct_mkroom", {
    lx: coordxy, hx: coordxy, ly: coordxy, hy: coordxy, /* usually coordxy, but hx may be -1 */
    rtype: schar, /* type of room (zoo, throne, etc...) */
    orig_rtype: schar, /* same as rtype, but not zeroed later */
    rlit: schar, /* is the room lit ? */
    needfill: schar, /* sp_lev: does the room need filling? */
    needjoining: boolean, /* sp_lev: should the room connect to others? */
    doorct: schar, /* door count */
    fdoor: int, /* index for the first door of the room */
    nsubrooms: schar, /* number of subrooms */
    irregular: boolean, /* true if room is non-rectangular */
    roomnoidx: schar,
    sbrooms: array_of(ptr_to("struct_mkroom"), MAX_SUBROOMS), /* Subrooms pointers */
    resident: ptr_to("struct_monst"), /* priest/shopkeeper/guard for this room */
});

export const D_SHOP = 1; export const struct_shclass = struct("struct_shclass", {
    name: ptr_to(char), /* name of the shop type */
    annotation: ptr_to(char), /* simpler name for #overview; Null if same */
    symb: char, /* this identifies the shop type */
    prob: int, /* the shop type probability in % */
    shdist: schar, /* object placement type */

        /* probability of an item type */
        /* item type: if >=0 a class, if < 0 a specific item */
    iprobs: array_of("struct_itp", 9),
    shknms: ptr_to(ptr_to(char)), /* list of shopkeeper names for this type */
}); export const struct_itp = struct("struct_itp", { iprob: int, itype: int, });

/* the normal rooms on the current level are described in svr.rooms[0..n] for
 * some n<MAXNROFROOMS
 * the vault, if any, is described by svr.rooms[n+1]
 * the next svr.rooms entry has hx -1 as a flag
 * there is at most one non-vault special room on a level
 */

/* values for rtype in the room definition structure */

    export const OROOM = 0; /* ordinary room */
    export const THEMEROOM = 1; /* like OROOM, but never converted to special room */
    export const COURT = 2; /* contains a throne */
    export const SWAMP = 3; /* contains pools */
    export const VAULT = 4; /* detached room usually reached via teleport trap */
    export const BEEHIVE = 5; /* contains killer bees and royal jelly */
    export const MORGUE = 6; /* contains corpses, undead and graves */
    export const BARRACKS = 7; /* contains soldiers and their gear */
    export const ZOO = 8; /* floor covered with treasure and monsters */
    export const DELPHI = 9; /* contains Oracle and peripherals */
    export const TEMPLE = 10; /* contains a shrine (altar attended by priest[ess]) */
    export const LEPREHALL = 11; /* leprechaun hall (Tom Proudfoot) */
    export const COCKNEST = 12; /* cockatrice nest (Tom Proudfoot) */
    export const ANTHOLE = 13; /* ants (Tom Proudfoot) */
    export const SHOPBASE = 14; /* everything above this is a shop */
    export const ARMORSHOP = 15; /* specific shop defines for level compiler */
    export const SCROLLSHOP = 16;
    export const POTIONSHOP = 17;
    export const WEAPONSHOP = 18;
    export const FOODSHOP = 19;
    export const RINGSHOP = 20;
    export const WANDSHOP = 21;
    export const TOOLSHOP = 22;
    export const BOOKSHOP = 23;
    export const FODDERSHOP = 24; /* health food store */
    export const CANDLESHOP = 25;

/* Special type for search_special() */
export const ANY_TYPE = (-1);
export const ANY_SHOP = (-2);

export const NO_ROOM = 0;
export const SHARED = 1;
export const SHARED_PLUS = 2;

export const ROOMOFFSET = 3;

/* Values for needfill */
export const FILL_NONE = 0;
export const FILL_NORMAL = 1;

import { MAX_SUBROOMS, boolean, coordxy } from "./global.h.js";
import { char, int, schar } from "../rt/ctypes.js";
import { array_of, ptr_to, struct } from "../rt/struct.js";
