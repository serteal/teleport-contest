/* NetHack 5.0	rm.h	$NHDT-Date: 1745114235 2025/04/19 17:57:15 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.120 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * The dungeon presentation graphics code and data structures were rewritten
 * and generalized for NetHack's release 2 by Eric S. Raymond (eric@snark)
 * building on Don G Kneller's MS-DOS implementation. See drawing.c for
 * the code that permits the user to set the contents of the symbol structure.
 *
 * The door representation was changed by
 * Ari Huttunen(ahuttune@niksula.hut.fi).
 */

/*
 * TLCORNER     TDWALL          TRCORNER
 * +-           -+-             -+
 * |             |               |
 *
 * TRWALL       CROSSWALL       TLWALL          HWALL
 * |             |               |
 * +-           -+-             -+              ---
 * |             |               |
 *
 * BLCORNER     TUWALL          BRCORNER        VWALL
 * |             |               |              |
 * +-           -+-             -+              |
 */

/*
 * Level location types, values for 'level.locations[x][y].typ'.
 *
 * These are different from display symbols and while there is
 * similarity between the cmap subset of those, there isn't any
 * one-to-one correspondence between the two encodings.  For instance,
 * the DOOR type has multiple symbols (closed|open|gone); so does the
 * STAIRS type (down|up).  Conversely, DRAWBRIDGE_UP represents the
 * location of the projected span if the drawbridge were down but
 * there is no symbol for that; it is displayed as water, ice, lava, or
 * floor depending on what is at that spot when the bridge is 'closed'.
 *
 * [Some debugging code in src/display.c defines array type_names[]
 * which contains an entry for each of these, so needs to be kept in
 * sync if any new types are added or existing ones renumbered.  The
 * #terrain command also has a menu choice to display each map spot by
 * a letter derived from these numeric values and another choice to
 * display a legend showing the letter-to-type correspondence.  If any
 * types are added, removed, or reordered, that needs to be updated to
 * keep in synch.]
 */

    export const STONE = 0;
    export const VWALL = 1;
    export const HWALL = 2;
    export const TLCORNER = 3;
    export const TRCORNER = 4;
    export const BLCORNER = 5;
    export const BRCORNER = 6;
    export const CROSSWALL = 7; /* For pretty mazes and special levels */
    export const TUWALL = 8;
    export const TDWALL = 9;
    export const TLWALL = 10;
    export const TRWALL = 11;
    export const DBWALL = 12;
    export const TREE = 13; /* KMH */
    export const SDOOR = 14;
    export const SCORR = 15;
    export const POOL = 16;
    export const MOAT = 17; /* pool that doesn't boil, adjust messages */
    export const WATER = 18;
    export const DRAWBRIDGE_UP = 19;
    export const LAVAPOOL = 20;
    export const LAVAWALL = 21;
    export const IRONBARS = 22; /* KMH */
    export const DOOR = 23;
    export const CORR = 24;
    export const ROOM = 25;
    export const STAIRS = 26;
    export const LADDER = 27;
    export const FOUNTAIN = 28;
    export const THRONE = 29;
    export const SINK = 30;
    export const GRAVE = 31;
    export const ALTAR = 32;
    export const ICE = 33;
    export const DRAWBRIDGE_DOWN = 34;
    export const AIR = 35;
    export const CLOUD = 36;

    export const MAX_TYPE = 37;
    /* for special levels */
    export const MATCH_WALL = 38;

    /* these aren't levl[][].typ values, they're additional indices
       into terrain_descr[] for status feedback */
    export const xFLOOR = 39;
    export const xGROUND = 40;
    export const xOPENDOOR = 41;
    export const xSHUTDOOR = 42;
    export const xSWAMP = 43;
    export const xSUBMERGED = 44;
    export const xSEA = 45;
    export const xWATERWALL = 46;

    export const INVALID_TYPE = 127;

/*
 * The structure describing a coordinate position.
 * Before adding fields, remember that this will significantly affect
 * the size of temporary files and save files.
 *
 * Also remember that the run-length encoding for some ports in save.c
 * must be updated to consider the field.
 */
export const struct_rm = struct("struct_rm", {
    glyph: int, /* what the hero thinks is there */
    typ: schar, /* what is really there  [why is this signed?] */
    seenv: uchar, /* seen vector */
    flags: Bitfield(5), /* extra information for typ */
    horizontal: Bitfield(1), /* wall/door/etc is horiz. (more typ info) */
    lit: Bitfield(1), /* speed hack for lit rooms */
    waslit: Bitfield(1), /* remember if a location was lit */

    roomno: Bitfield(6), /* room # for special rooms */
    edge: Bitfield(1), /* marks boundaries for special rooms*/
    candig: Bitfield(1), /* Exception to Can_dig_down; was a trapdoor */
});

/*
 * rm flags field overloads:
 *
 *         +-------------+-------------+------------+------------+------------+
 *         |   bit5      |     bit4    |    bit3    |    bit2    |     bit1   |
 *         |   0x10      |      0x8    |     0x4    |     0x2    |      0x1   |
 *         +-------------+-------------+------------+------------+------------+
 * wall    |W_NONPASSWALL|W_NONDIGGABLE| W_MASK     | W_MASK     | W_MASK     |
 * door    |D_TRAPPED    | D_LOCKED    | D_CLOSED   | D_ISOPEN   | D_BROKEN   |
 *         |D_WARNED     |             |            |            |            |
 * sdoor   |D_TRAPPED    | D_LOCKED    | W_MASK     | W_MASK     | W_MASK     |
 * drawbr. |DB_FLOOR     | DB_ICE      | DB_LAVA    | DB_DIR     | DB_DIR     |
 * sink    |             |             | S_LRING    | S_LDWASHER | S_LPUDDING |
 * tree    |             |             |            | TREE_SWARM | TREE_LOOTED|
 * throne  |             |             |            |            | T_LOOTED   |
 * fountain|             |             |            | F_WARNED   | F_LOOTED   |
 * ladder  |             |             |            | LA_DOWN    | LA_UP      |
 * pool    |ICED_MOAT    | ICED_POOL   |            |            |            |
 * grave   |             |             |            |            | emptygrave |
 * altar   |AM_SANCTUM   | AM_SHRINE   | AM_MASK    | AM_MASK    | AM_MASK    |
 *         |             |             |            |            |            |
 *         +-------------+-------------+------------+------------+------------+
 *
 *
 * If these get changed or expanded, make sure wizard-mode wishing becomes
 * aware of the new usage
 *
 *      Note:  secret doors (SDOOR) want to use both rm.doormask and
 *      rm.wall_info but those both overload rm.flags.  SDOOR only
 *      has 2 states (closed or locked).  However, it can't specify
 *      D_CLOSED due to that conflicting with WM_MASK (below).  When
 *      a secret door is revealed, the door gets set to D_CLOSED iff
 *      it isn't set to D_LOCKED (see cvt_sdoor_to_door() in detect.c).
 *
 *      D_LOCKED conflicts with W_NONDIGGABLE but the latter is not
 *      expected to be used on door locations.
 *      D_TRAPPED conflicts with W_NONPASSWALL.
 *      D_SECRET would not fit within struct rm's 5-bit 'flags' field.
 */

/* candig is used for floor trap locations so is available for overload
   on walls, doors, secret doors, and furniture */

/*
 * The 5 possible states of doors.
 * For historical reasons they are numbered as mask bits rather than 0..4.
 * The trapped flag is OR'd onto the state and only valid if that state
 * is closed or locked.
 * The no-door state allows egress when moving diagonally, others do not.
 */
export const D_NODOOR = 0x00;
export const D_BROKEN = 0x01;
export const D_ISOPEN = 0x02;
export const D_CLOSED = 0x04;
export const D_LOCKED = 0x08;

export const D_TRAPPED = 0x10;
export const D_SECRET = 0x20;

/*
 * Thrones should only be looted once.
 */
export const T_LOOTED = 1;

/*
 * Trees have more than one kick result.
 */
export const TREE_LOOTED = 1;
export const TREE_SWARM = 2;

/*
 * Fountains have limits, and special warnings.
 */
export const F_LOOTED = 1;
export const F_WARNED = 2;

/*
 * doors are even worse :-) The special warning has a side effect
 * of instantly trapping the door, and if it was defined as trapped,
 * the guards consider that you have already been warned!
 */
export const D_WARNED = 16;

/*
 * Sinks have 3 different types of loot that shouldn't be abused
 */
export const S_LPUDDING = 1;
export const S_LDWASHER = 2;
export const S_LRING = 4;

/*
 * The four directions for a DrawBridge.
 */
export const DB_NORTH = 0;
export const DB_SOUTH = 1;
export const DB_EAST = 2;
export const DB_WEST = 3;
export const DB_DIR = 3;

/*
 * What's under a drawbridge.
 */
export const DB_MOAT = 0;
export const DB_LAVA = 4;
export const DB_ICE = 8;
export const DB_FLOOR = 16;
export const DB_UNDER = 28;

/*
 * Wall information.  Nondiggable also applies to iron bars.
 */
export const WM_MASK = 0x07;
export const W_NONDIGGABLE = 0x08;
export const W_NONPASSWALL = 0x10;

/*
 * Ladders (in Vlad's tower) may be up or down.
 */
export const LA_UP = 1;
export const LA_DOWN = 2;

/*
 * Room areas may be iced pools
 */
export const ICED_POOL = 8;
export const ICED_MOAT = 16;

/* light states for terrain replacements, for set_levltyp_lit */
export const SET_LIT_RANDOM = -1;
export const SET_LIT_NOCHANGE = -2;

/*
 * Add wall angle viewing by defining "modes" for each wall type.  Each
 * mode describes which parts of a wall are finished (seen as wall)
 * and which are unfinished (seen as rock).
 *
 * We use the bottom 3 bits of the flags field for the mode.  This comes
 * in conflict with secret doors, but we avoid problems because until
 * a secret door becomes discovered, we know what sdoor's bottom three
 * bits are.
 *
 * The following should cover all of the cases.
 *
 *      type    mode                            Examples: R=rock, F=finished
 *      -----   ----                            ----------------------------
 *      WALL:   0 none                          hwall, mode 1
 *              1 left/top (1/2 rock)                   RRR
 *              2 right/bottom (1/2 rock)               ---
 *                                                      FFF
 *
 *      CORNER: 0 none                          trcorn, mode 2
 *              1 outer (3/4 rock)                      FFF
 *              2 inner (1/4 rock)                      F+-
 *                                                      F|R
 *
 *      TWALL:  0 none                          tlwall, mode 3
 *              1 long edge (1/2 rock)                  F|F
 *              2 bottom left (on a tdwall)             -+F
 *              3 bottom right (on a tdwall)            R|F
 *
 *      CRWALL: 0 none                          crwall, mode 5
 *              1 top left (1/4 rock)                   R|F
 *              2 top right (1/4 rock)                  -+-
 *              3 bottom left (1/4 rock)                F|R
 *              4 bottom right (1/4 rock)
 *              5 top left & bottom right (1/2 rock)
 *              6 bottom left & top right (1/2 rock)
 */

export const WM_W_LEFT = 1;
export const WM_W_RIGHT = 2;
export const WM_W_TOP = WM_W_LEFT;
export const WM_W_BOTTOM = WM_W_RIGHT;

export const WM_C_OUTER = 1;
export const WM_C_INNER = 2;

export const WM_T_LONG = 1;
export const WM_T_BL = 2;
export const WM_T_BR = 3;

export const WM_X_TL = 1;
export const WM_X_TR = 2;
export const WM_X_BL = 3;
export const WM_X_BR = 4;
export const WM_X_TLBR = 5;
export const WM_X_BLTR = 6;

/*
 * Seen vector values.  The seen vector is an array of 8 bits, one for each
 * octant around a given center x:
 *
 *              0 1 2
 *              7 x 3
 *              6 5 4
 *
 * In the case of walls, a single wall square can be viewed from 8 possible
 * directions.  If we know the type of wall and the directions from which
 * it has been seen, then we can determine what it looks like to the hero.
 */
export const SV0 = (0x01);
export const SV1 = (0x02);
export const SV2 = (0x04);
export const SV3 = (0x08);
export const SV4 = (0x10);
export const SV5 = (0x20);
export const SV6 = (0x40);
export const SV7 = (0x80);
export const SVALL = (0xFF);

/* horizontal applies to walls, doors (including sdoor); also to iron bars
   even though they don't have separate symbols for horizontal and vertical */

export const struct_damage = struct("struct_damage", {
    next: ptr_to("struct_damage"),
    when: long, cost: long,
    place: "struct_nhcoord",
    typ: schar, /* from struct rm */
    flags: uchar, /* also from struct rm; an unsigned 5-bit field there */
});

/* for bones levels:  identify the dead character, who might have died on
   an existing bones level; if so, most recent victim will be first in list */
export const struct_cemetery = struct("struct_cemetery", {
    next: ptr_to("struct_cemetery"), /* next struct is previous dead character... */
    /* "svp.plname" + "-ROLe" + "-RACe" + "-GENder" + "-ALIgnment" + \0 */
    who: array_of(char, PL_NSIZ + 4 * (1 + 3) + 1),
    /* death reason, same as in score/log file */
    how: array_of(char, 100 + 1), /* [DTHSZ+1] */
    /* date+time in string of digits rather than binary */
    when: array_of(char, 4 + 2 + 2 + 2 + 2 + 2 + 1), /* "YYYYMMDDhhmmss\0" */
    /* final resting place spot */
    frpx: coordxy, frpy: coordxy,
    bonesknown: boolean,
});

export const struct_levelflags = struct("struct_levelflags", {
    nfountains: uchar, /* number of fountains on level */
    nsinks: uchar, /* number of sinks on the level */
    /* Several flags that give hints about what's on the level */
    has_shop: Bitfield(1),
    has_vault: Bitfield(1),
    has_zoo: Bitfield(1),
    has_court: Bitfield(1),
    has_morgue: Bitfield(1),
    has_beehive: Bitfield(1),
    has_barracks: Bitfield(1),
    has_temple: Bitfield(1),

    has_swamp: Bitfield(1),
    noteleport: Bitfield(1),
    hardfloor: Bitfield(1),
    nommap: Bitfield(1),
    hero_memory: Bitfield(1), /* hero has memory */
    shortsighted: Bitfield(1), /* monsters are shortsighted */
    graveyard: Bitfield(1), /* has_morgue, but remains set */
    sokoban_rules: Bitfield(1), /* fill pits and holes w/ boulders */

    is_maze_lev: Bitfield(1),
    is_cavernous_lev: Bitfield(1),
    arboreal: Bitfield(1), /* Trees replace rock */
    has_town: Bitfield(1), /* level contains a town */
    wizard_bones: Bitfield(1), /* set if level came from a bones file
                                * which was created in wizard mode (or
                                * normal mode descendant of such) */
    corrmaze: Bitfield(1), /* Whether corridors are used for the maze
                                * rather than ROOM */
    rndmongen: Bitfield(1), /* random monster generation allowed? */
    deathdrops: Bitfield(1), /* monsters may drop corpses/death drops */

    noautosearch: Bitfield(1), /* automatic searching disabled */
    fumaroles: Bitfield(1), /* lava emits poison gas at random */
    stormy: Bitfield(1), /* clouds create lightning bolts at random */

    temperature: schar, /* +1 == hot, -1 == cold */
    stasis_until: long, /* wand of stasis effect lasts until when? */
});

export const dlevel_t = struct("dlevel_t", {
    locations: array_of(array_of("struct_rm", ROWNO), COLNO),
    objects: array_of(array_of(ptr_to("struct_obj"), ROWNO), COLNO),
    monsters: array_of(array_of(ptr_to("struct_monst"), ROWNO), COLNO),
    objlist: ptr_to("struct_obj"),
    buriedobjlist: ptr_to("struct_obj"),
    monlist: ptr_to("struct_monst"),
    damagelist: ptr_to("struct_damage"),
    bonesinfo: ptr_to("struct_cemetery"),
    flags: "struct_levelflags",
});

import { COLNO, PL_NSIZ, ROWNO, boolean, coordxy } from "./global.h.js";
import { char, int, long, schar, uchar } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
