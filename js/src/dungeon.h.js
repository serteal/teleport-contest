/* NetHack 5.0	dungeon.h	$NHDT-Date: 1685863327 2023/06/04 07:22:07 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.47 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_d_level = struct("struct_d_level", { /* basic dungeon level element */
    dnum: xint16, /* dungeon number */
    dlevel: xint16, /* level number */
});

export const struct_d_flags = struct("struct_d_flags", { /* dungeon/level type flags */
    town: Bitfield(1), /* is this a town? (levels only) */
    hellish: Bitfield(1), /* is this part of hell? */
    maze_like: Bitfield(1), /* is this a maze? */
    rogue_like: Bitfield(1), /* is this an old-fashioned presentation? */
    align: Bitfield(3), /* dungeon alignment. */
    unconnected: Bitfield(1), /* dungeon not connected to any branch */
});

export const struct_s_level = struct("struct_s_level", { /* special dungeon level element */
    next: ptr_to("struct_s_level"),
    dlevel: "struct_d_level", /* dungeon & level numbers */
    proto: array_of(char, 15), /* name of prototype file (eg. "tower") */
    boneid: char, /* character to id level in bones files */
    rndlevs: uchar, /* no. of randomly available similar levels */
    flags: "struct_d_flags", /* type flags */
});

/* level region types */

    export const LR_DOWNSTAIR = 0;
    export const LR_UPSTAIR = LR_DOWNSTAIR + 1;
    export const LR_PORTAL = LR_UPSTAIR + 1;
    export const LR_BRANCH = LR_PORTAL + 1;
    export const LR_TELE = LR_BRANCH + 1;
    export const LR_UPTELE = LR_TELE + 1;
    export const LR_DOWNTELE = LR_UPTELE + 1;
    export const LR_MONGEN = LR_DOWNTELE + 1;

export const struct_dest_area = struct("struct_dest_area", { /* non-stairway level change identifier */
    lx: coordxy, ly: coordxy, /* "lower" left corner (near [0,0]) */
    hx: coordxy, hy: coordxy, /* "upper" right corner (near [COLNO,ROWNO]) */
    nlx: coordxy, nly: coordxy, /* outline of invalid area */
    nhx: coordxy, nhy: coordxy, /* opposite corner of invalid area */
});

/* teleportation exclusion zones in the level */
export const struct_exclusion_zone = struct("struct_exclusion_zone", {
    zonetype: xint16, /* level_region_types */
    lx: coordxy, ly: coordxy,
    hx: coordxy, hy: coordxy,
    next: ptr_to("struct_exclusion_zone"),
});

export const struct_dungeon = struct("struct_dungeon", { /* basic dungeon identifier */
    dname: array_of(char, 24), /* name of the dungeon (eg. "Hell") */
    proto: array_of(char, 15), /* name of prototype file (eg. "tower") */
    fill_lvl: array_of(char, 15), /* name of "fill" level protype file */
    themerms: array_of(char, 15), /* lua file name containing themed rooms */
    boneid: char, /* character to id dungeon in bones files */
    flags: "struct_d_flags", /* dungeon flags */
    entry_lev: xint16, /* entry level */
    num_dunlevs: xint16, /* number of levels in this dungeon */
    dunlev_ureached: xint16, /* how deep you have been in this dungeon */
    ledger_start: int, /* the starting depth in "real" terms */
        depth_start: int, /* the starting depth in "logical" terms */
});

/*
 * A branch structure defines the connection between two dungeons.  They
 * will be ordered by the dungeon number/level number of 'end1'.  Ties
 * are resolved by 'end2'.  'Type' uses 'end1' arbitrarily as the primary
 * point.
 */
export const struct_branch = struct("struct_branch", {
    next: ptr_to("struct_branch"), /* next in the branch chain */
    id: int, /* branch identifier */
    type: int, /* type of branch */
    end1: "struct_d_level", /* "primary" end point */
    end2: "struct_d_level", /* other end point */
    end1_up: boolean, /* does end1 go up? */
});

/* branch types */
export const BR_STAIR = 0;
export const BR_NO_END1 = 1;

export const BR_NO_END2 = 2;

export const BR_PORTAL = 3;

/* monster and object migration codes */

export const MIGR_NOWHERE = (-1);
export const MIGR_RANDOM = 0;
export const MIGR_APPROX_XY = 1;
export const MIGR_EXACT_XY = 2;
export const MIGR_STAIRS_UP = 3;
export const MIGR_STAIRS_DOWN = 4;
export const MIGR_LADDER_UP = 5;
export const MIGR_LADDER_DOWN = 6;
export const MIGR_SSTAIRS = 7;
export const MIGR_PORTAL = 8;
export const MIGR_WITH_HERO = 9;
export const MIGR_NOBREAK = 1024;
export const MIGR_NOSCATTER = 2048;
export const MIGR_TO_SPECIES = 4096;
export const MIGR_LEFTOVERS = 8192;
/* level information (saved via ledger number) */

export const VISITED = 0x01; export const LFILE_EXISTS = 0x04; export const struct_linfo = struct("struct_linfo", {
    flags: uchar,

/* 0x02 was FORGOTTEN, when amnesia made you forget maps */

        /* Note:  VISITED and LFILE_EXISTS are currently almost always
         * set at the same time.  However, they _mean_ different things.
         */
});

/* types and structures for dungeon map recording
 *
 * It is designed to eliminate the need for an external notes file for some
 * mundane dungeon elements.  "Where was the last altar I passed?" etc...
 * Presumably the character can remember this sort of thing even if, months
 * later in real time picking up an old save game, I can't.
 *
 * To be consistent, one can assume that this map is in the player's mind and
 * has no physical correspondence (eliminating illiteracy/blind/hands/hands
 * free concerns).  Therefore, this map is not exhaustive nor detailed ("some
 * fountains").  This makes it also subject to player conditions (amnesia).
 */

/* what the player knows about a single dungeon level */
/* initialized in mklev() */
export const struct_mapseen_feat = struct("struct_mapseen_feat", {
    /* feature knowledge that must be calculated from levl array */
    nfount: Bitfield(2),
    nsink: Bitfield(2),
    naltar: Bitfield(2),
    nthrone: Bitfield(2),

    ngrave: Bitfield(2),
    ntree: Bitfield(2),
    water: Bitfield(2),
    lava: Bitfield(2),

    ice: Bitfield(2),
    /* calculated from rooms array */
    nshop: Bitfield(2),
    ntemple: Bitfield(2),
    /* altar alignment; MSA_NONE if there is more than one and
       they aren't all the same */
    msalign: Bitfield(2),

    shoptype: Bitfield(5),
});
export const struct_mapseen_flags = struct("struct_mapseen_flags", {
    notreachable: Bitfield(1), /* can't get back to this level */
    forgot: Bitfield(1), /* player has forgotten about this level */
    knownbones: Bitfield(1), /* player aware of bones */
    oracle: Bitfield(1),
    sokosolved: Bitfield(1),
    bigroom: Bitfield(1),
    castle: Bitfield(1),
    castletune: Bitfield(1), /* add tune hint to castle annotation */

    valley: Bitfield(1),
    msanctum: Bitfield(1),
    ludios: Bitfield(1),
    roguelevel: Bitfield(1),
    /* quest annotations: quest_summons is for main dungeon level
       with entry portal and is reset once quest has been finished;
       questing is for quest home (level 1) */
    quest_summons: Bitfield(1), /* heard summons from leader */
    questing: Bitfield(1), /* quest leader has unlocked quest stairs */
    /* "gateway to sanctum" */
    vibrating_square: Bitfield(1), /* found vibrating square 'trap';
                                    * flag cleared once the msanctum
                                    * annotation has been added (on
                                    * the next dungeon level; temple
                                    * entered or high altar mapped) */
    spare1: Bitfield(1), /* not used */
});

export const struct_mapseen_rooms = struct("struct_mapseen_rooms", {
    seen: Bitfield(1),
    untended: Bitfield(1), /* flag for shop without shk */
});

export const struct_mapseen = struct("struct_mapseen", {
    next: ptr_to("struct_mapseen"), /* next map in the chain */
    br: ptr_to("struct_branch"), /* knows about branch via taking it in goto_level */
    lev: "struct_d_level", /* corresponding dungeon level */
    feat: "struct_mapseen_feat",
    flags: "struct_mapseen_flags",
    /* custom naming */
    custom: ptr_to(char),
    custom_lth: unsigned,
    msrooms: array_of("struct_mapseen_rooms", (MAXNROFROOMS + 1) * 2), /* same size as svr.rooms[] */
    /* dead heroes; might not have graves or ghosts */
    final_resting_place: ptr_to("struct_cemetery"), /* same as level.bonesinfo */
});

import { MAXNROFROOMS, boolean, coordxy, xint16 } from "./global.h.js";
import { char, int, uchar, unsigned } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
