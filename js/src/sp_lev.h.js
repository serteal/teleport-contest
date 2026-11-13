/* NetHack 5.0	sp_lev.h	$NHDT-Date: 1622361649 2021/05/30 08:00:49 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.47 $ */
/* Copyright (c) 1989 by Jean-Christophe Collet                   */
/* NetHack may be freely redistributed.  See license for details. */

/* wall directions */
export const W_RANDOM = -1;
export const W_NORTH = 1;
export const W_SOUTH = 2;
export const W_EAST = 4;
export const W_WEST = 8;
export const W_ANY = (W_NORTH | W_SOUTH | W_EAST | W_WEST);

/* MAP limits */

export const MAP_Y_LIM = 21;

/* Per level flags */

/* different level layout initializers */

    export const LVLINIT_NONE = 0;
    export const LVLINIT_SOLIDFILL = LVLINIT_NONE + 1;
    export const LVLINIT_MAZEGRID = LVLINIT_SOLIDFILL + 1;
    export const LVLINIT_MAZE = LVLINIT_MAZEGRID + 1;
    export const LVLINIT_MINES = LVLINIT_MAZE + 1;
    export const LVLINIT_ROGUE = LVLINIT_MINES + 1;
    export const LVLINIT_SWAMP = LVLINIT_ROGUE + 1;

/* max. nested depth of subrooms */
export const MAX_NESTED_ROOMS = 5;

/* When creating objects, we need to know whether
 * it's a container and/or contents.
 */
export const SP_OBJ_CONTENT = 0x1;
export const SP_OBJ_CONTAINER = 0x2;

/* SPO_FILTER types */

/* gradient filter types */
export const SEL_GRADIENT_RADIAL = 0;
export const SEL_GRADIENT_SQUARE = 1;

export const SP_COORD_IS_RANDOM = 0x01000000;
/* Humidity flags for get_location() and friends, used with
 * SP_COORD_PACK_RANDOM() */
export const DRY = 0x01;
export const WET = 0x02;
export const HOT = 0x04;
export const SOLID = 0x08;
export const ANY_LOC = 0x10;
export const NO_LOC_WARN = 0x20;
export const SPACELOC = 0x40;

/* has_invent flags */
export const NO_INVENT = 0;
export const CUSTOM_INVENT = 0x01;
export const DEFAULT_INVENT = 0x02;

export const struct_sp_coder = struct("struct_sp_coder", {
    premapped: int,
    solidify: boolean,
    croom: ptr_to("struct_mkroom"),
    room_stack: int,
    tmproomlist: array_of(ptr_to("struct_mkroom"), MAX_NESTED_ROOMS + 1),
    failed_room: array_of(schar, MAX_NESTED_ROOMS + 1),
    n_subroom: int,
    lvl_is_joined: boolean,
    check_inaccessibles: boolean,
    allow_flips: int,
});

/*
 * Structures manipulated by the special levels loader & compiler
 */

export const getloc_flags_t = unsigned;
export const unpacked_coord = struct("unpacked_coord", {
    is_random: xint16,
    getloc_flags: getloc_flags_t,
    x: int, y: int,
});

export const lev_init = struct("lev_init", {
    init_style: xint16, /* one of LVLINIT_foo */
    flags: long,
    filling: schar,
    init_present: boolean, padding: boolean,
    fg: char, bg: char,
    smoothed: boolean, joined: boolean,
    lit: xint16, walled: xint16,
    icedpools: boolean,
    corrwid: int, wallthick: int,
    rm_deadends: boolean,
});

export const room_door = struct("room_door", {
    wall: xint16, pos: xint16, secret: xint16, mask: xint16,
});

export const spltrap = struct("spltrap", {
    coord: long,
    x: coordxy, y: coordxy,
    type: xint16,
    spider_on_web: boolean,
    seen: boolean,
    novictim: boolean,
});

export const monster = struct("monster", {
    name: "struct_str_or_len", appear_as: "struct_str_or_len",
    id: short,
    sp_amask: unsigned, /* splev amask */
    coord: long,
    x: coordxy, y: coordxy,
    class: xint16, appear: xint16,
    peaceful: schar, asleep: schar,
    female: short, invis: short, cancelled: short, revived: short, avenge: short, fleeing: short, blinded: short,
        paralyzed: short, stunned: short, confused: short, waiting: short,
    m_lev_adj: short,
    seentraps: long,
    has_invent: short,
    mm_flags: mmflags_nht, /* makemon flags */
});

export const object = struct("object", {
    name: "struct_str_or_len",
    corpsenm: int,
    id: short, spe: short,
    coord: long,
    x: coordxy, y: coordxy,
    class: xint16, containment: xint16,
    curse_state: schar,
    quan: int,
    buried: short,
    lit: short,
    eroded: short, locked: short, trapped: short, tknown: short, recharged: short, invis: short, greased: short, broken: short,
          achievement: short,
});

export const altar = struct("altar", {
    coord: long,
    x: coordxy, y: coordxy,
    sp_amask: unsigned, /* splev amask */
    shrine: xint16,
});

export const region = struct("region", {
    x1: coordxy, y1: coordxy, x2: coordxy, y2: coordxy,
    rtype: xint16, rlit: xint16, rirreg: xint16,
});

export const terrain = struct("terrain", {
    ter: xint16, tlit: xint16,
});

export const corridor = struct("corridor", {
    src: struct("corridor.src", {
        room: xint16,
        wall: xint16,
        door: xint16,
    }), dest: "corridor.src",
});

export const struct__room = struct("struct__room", {
    name: "struct_str_or_len",
    parent: "struct_str_or_len",
    x: coordxy, y: coordxy,
    w: xint16, h: xint16,
    xalign: xint16, yalign: xint16,
    rtype: xint16, chance: xint16, rlit: xint16, needfill: xint16,
    joined: boolean,
});

export const struct_mapfragment = struct("struct_mapfragment", {
    wid: int, hei: int,
    data: ptr_to(char),
});

import { boolean, coordxy, xint16 } from "./global.h.js";
import { mmflags_nht } from "./hack.h.js";
import { char, int, long, schar, short, unsigned } from "../rt/ctypes.js";
import { array_of, ptr_to, struct } from "../rt/struct.js";
