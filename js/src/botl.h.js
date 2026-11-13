/* NetHack 5.0  botl.h  $NHDT-Date: 1694893330 2023/09/16 19:42:10 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.37 $ */
/* Copyright (c) Michael Allison, 2003                            */
/* NetHack may be freely redistributed.  See license for details. */

/* Note: this comment is about the pre-VIA_WINDOWPORT two line status
 * which is still available but has not added a bunch of conditional
 * extra status conditions (Grab, InLava, Held, Zzz and many others)
 * or the new fields Weapon, Armor, and Terrain.
 *
 * MAXCO must hold longest uncompressed status line, and must be larger
 * than COLNO
 *
 * longest practical second status line at the moment is
Astral Plane \GXXXXNNNN:123456 HP:1234(1234) Pw:1234(1234) AC:-127
 Xp:30/123456789 T:123456  Stone Slime Strngl FoodPois TermIll
 Satiated Overloaded Blind Deaf Stun Conf Hallu Lev Ride
 * -- or about 185 characters.  '$' gets encoded even when it
 * could be used as-is.  The first five status conditions are fatal
 * so it's rare to have more than one at a time.
 *
 * When the full line is wider than the map, the basic status line
 * formatting will move less important fields to the end, so if/when
 * truncation is necessary, it will chop off the least significant
 * information.
 */

export const MAXCO = 200;

/* limit of the player's name in the status window */
export const BOTL_NSIZ = 16;

export const struct_condmap = struct("struct_condmap", {
    id: ptr_to(char),
    bitmask: ulong,
});

    export const BL_CHARACTERISTICS = -3; /* alias for BL_STR..BL_CH */
    export const BL_RESET = -2; /* Force everything to redisplay */
    export const BL_FLUSH = -1; /* Finished cycling through bot fields */
    /*
     * Note: status_sanity_check() in wintty.c has strings for the rest
     * of these, so if any get renumbered or more get added, be sure to
     * keep those in sync.
     */
    export const BL_TITLE = 0;
    export const BL_STR = BL_TITLE + 1; export const BL_DX = BL_STR + 1; export const BL_CO = BL_DX + 1; export const BL_IN = BL_CO + 1; export const BL_WI = BL_IN + 1; export const BL_CH = BL_WI + 1; /*  1.. 6 */
    export const BL_ALIGN = BL_CH + 1; export const BL_SCORE = BL_ALIGN + 1; export const BL_CAP = BL_SCORE + 1; export const BL_GOLD = BL_CAP + 1; /*  7..10 */
    export const BL_ENE = BL_GOLD + 1; export const BL_ENEMAX = BL_ENE + 1; export const BL_XP = BL_ENEMAX + 1; export const BL_AC = BL_XP + 1; export const BL_HD = BL_AC + 1; /* 11..15 */
    export const BL_TIME = BL_HD + 1; export const BL_HUNGER = BL_TIME + 1; export const BL_HP = BL_HUNGER + 1; export const BL_HPMAX = BL_HP + 1; /* 16..19 */
    export const BL_LEVELDESC = BL_HPMAX + 1; export const BL_EXP = BL_LEVELDESC + 1; export const BL_CONDITION = BL_EXP + 1; /* 20..22 */
    export const BL_WEAPON = BL_CONDITION + 1; export const BL_ARMOR = BL_WEAPON + 1; export const BL_TERRAIN = BL_ARMOR + 1; /* 23..25 */
    export const BL_VERS = BL_TERRAIN + 1; /*   26   */
    export const MAXBLSTATS = BL_VERS + 1; /* [27] */

    export const NO_LTEQGT = -1;
    export const EQ_VALUE = NO_LTEQGT + 1; export const LT_VALUE = EQ_VALUE + 1; export const LE_VALUE = LT_VALUE + 1;
    export const GE_VALUE = LE_VALUE + 1; export const GT_VALUE = GE_VALUE + 1; export const TXT_VALUE = GT_VALUE + 1;

    export const bl_bareh = 0; /* deprecated -- bl_weapon encompasses this */
    export const bl_blind = bl_bareh + 1;
    export const bl_busy = bl_blind + 1;
    export const bl_conf = bl_busy + 1;
    export const bl_deaf = bl_conf + 1;
    export const bl_elf_iron = bl_deaf + 1;
    export const bl_fly = bl_elf_iron + 1;
    export const bl_foodpois = bl_fly + 1;
    export const bl_glowhands = bl_foodpois + 1;
    export const bl_grab = bl_glowhands + 1;
    export const bl_hallu = bl_grab + 1;
    export const bl_held = bl_hallu + 1;
    export const bl_icy = bl_held + 1; /* bl_terrain encompasses this */
    export const bl_inlava = bl_icy + 1;
    export const bl_lev = bl_inlava + 1;
    export const bl_parlyz = bl_lev + 1;
    export const bl_ride = bl_parlyz + 1;
    export const bl_sleeping = bl_ride + 1;
    export const bl_slime = bl_sleeping + 1;
    export const bl_slippery = bl_slime + 1;
    export const bl_stone = bl_slippery + 1;
    export const bl_strngl = bl_stone + 1;
    export const bl_stun = bl_strngl + 1;
    export const bl_submerged = bl_stun + 1; /* bl_terrain encompasses this */
    export const bl_termill = bl_submerged + 1;
    export const bl_tethered = bl_termill + 1;
    export const bl_trapped = bl_tethered + 1;
    export const bl_unconsc = bl_trapped + 1;
    export const bl_woundedl = bl_unconsc + 1;
    export const bl_holding = bl_woundedl + 1;

    export const CONDITION_COUNT = bl_holding + 1;

/* Boolean condition bits for the condition mask */

/* clang-format off */
export const BL_MASK_BAREH = 0x00000001;
export const BL_MASK_BLIND = 0x00000002;
export const BL_MASK_BUSY = 0x00000004;
export const BL_MASK_CONF = 0x00000008;
export const BL_MASK_DEAF = 0x00000010;
export const BL_MASK_ELF_IRON = 0x00000020;
export const BL_MASK_FLY = 0x00000040;
export const BL_MASK_FOODPOIS = 0x00000080;
export const BL_MASK_GLOWHANDS = 0x00000100;
export const BL_MASK_GRAB = 0x00000200;
export const BL_MASK_HALLU = 0x00000400;
export const BL_MASK_HELD = 0x00000800;
export const BL_MASK_ICY = 0x00001000;
export const BL_MASK_INLAVA = 0x00002000;
export const BL_MASK_LEV = 0x00004000;
export const BL_MASK_PARLYZ = 0x00008000;
export const BL_MASK_RIDE = 0x00010000;
export const BL_MASK_SLEEPING = 0x00020000;
export const BL_MASK_SLIME = 0x00040000;
export const BL_MASK_SLIPPERY = 0x00080000;
export const BL_MASK_STONE = 0x00100000;
export const BL_MASK_STRNGL = 0x00200000;
export const BL_MASK_STUN = 0x00400000;
export const BL_MASK_SUBMERGED = 0x00800000;
export const BL_MASK_TERMILL = 0x01000000;
export const BL_MASK_TETHERED = 0x02000000;
export const BL_MASK_TRAPPED = 0x04000000;
export const BL_MASK_UNCONSC = 0x08000000;
export const BL_MASK_WOUNDEDL = 0x10000000;
export const BL_MASK_HOLDING = 0x20000000;

/* clang-format on */

export const struct_conditions_t = struct("struct_conditions_t", {
    ranking: int,
    mask: long,
    c: unsigned,
    text: array_of(ptr_to(char), 3),
});

export const struct_condtests_t = struct("struct_condtests_t", {
    c: unsigned,
    useroption: ptr_to(char),
    opt: unsigned,
    enabled: boolean,
    choice: boolean,
    test: boolean,
});

export const BEFORE = 0;
export const NOW = 1;

/* #ifdef STATUS_HILITES */
/* hilite status field behavior - coloridx values */

                                /* or any CLR_ index (0 - 15) */

export const BL_TH_NONE = 0;
export const BL_TH_VAL_PERCENTAGE = 100;
export const BL_TH_VAL_ABSOLUTE = 101;
export const BL_TH_UPDOWN = 102;
export const BL_TH_CONDITION = 103;
export const BL_TH_TEXTMATCH = 104;
export const BL_TH_ALWAYS_HILITE = 105;
export const BL_TH_CRITICALHP = 106;

export const HL_ATTCLR_BOLD = CLR_MAX + 2;
export const HL_ATTCLR_DIM = CLR_MAX + 3;
export const HL_ATTCLR_ITALIC = CLR_MAX + 4;
export const HL_ATTCLR_ULINE = CLR_MAX + 5;
export const HL_ATTCLR_BLINK = CLR_MAX + 6;
export const HL_ATTCLR_INVERSE = CLR_MAX + 7;
export const BL_ATTCLR_MAX = CLR_MAX + 8;

    export const HL_UNDEF = 0x00;
    export const HL_NONE = 0x01;
    export const HL_BOLD = 0x02;
    export const HL_DIM = 0x04;
    export const HL_ITALIC = 0x08;
    export const HL_ULINE = 0x10;
    export const HL_BLINK = 0x20;
    export const HL_INVERSE = 0x40;

export const MAXVALWIDTH = 80;

export const struct_hilite_s = struct("struct_hilite_s", {
    fld: int,
    set: boolean,
    anytype: unsigned,
    value: "struct_any",
    behavior: int,
    textmatch: array_of(char, MAXVALWIDTH),
    rel: int,
    coloridx: int,
    next: ptr_to("struct_hilite_s"),
});

/*
 * Note: If you add/change/remove fields in istat_s, you need to
 * update the initialization of the istat_s struct blstats[][]
 * array in instance_globals_b (decl.c).
 */
export const struct_istat_s = struct("struct_istat_s", {
    fldname: ptr_to(char),
    fldfmt: ptr_to(char),
    time: long, /* moves when this field hilite times out */
    chg: boolean, /* need to recalc time? */
    percent_matters: boolean,
    percent_value: short,
    anytype: unsigned,
    a: "struct_any", rawval: "struct_any",
    val: ptr_to(char),
    valwidth: int,
    idxmax: int,
    fld: int,

    hilite_rule: ptr_to("struct_hilite_s"), /* the entry, if any, in 'thresholds'
                                   * list that currently applies        */
    thresholds: ptr_to("struct_hilite_s"),
});

/* in botl.c */

import { CLR_MAX } from "./color.h.js";
import { boolean } from "./global.h.js";
import { char, int, long, short, ulong, unsigned } from "../rt/ctypes.js";
import { array_of, ptr_to, struct } from "../rt/struct.js";
