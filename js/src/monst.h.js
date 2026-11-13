/* NetHack 5.0	monst.h	$NHDT-Date: 1738640524 2025/02/03 19:42:04 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.67 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2016. */
/* NetHack may be freely redistributed.  See license for details. */

/* start with incomplete types in case these aren't defined yet;
   basic pointers to them don't need to know their details */

/* The weapon_check flag is used two ways:
 * 1) When calling mon_wield_item, is 2-6 depending on what is desired.
 * 2) Between calls to mon_wield_item, is 0 or 1 depending on whether or not
 *    the weapon is known by the monster to be cursed (so it shouldn't bother
 *    trying for another weapon).
 * I originally planned to also use 0 if the monster already had its best
 * weapon, to avoid the overhead of a call to mon_wield_item, but it turns out
 * that there are enough situations which might make a monster change its
 * weapon that this is impractical.  --KAA
 */

    export const NO_WEAPON_WANTED = 0;
    export const NEED_WEAPON = 1;
    export const NEED_RANGED_WEAPON = 2;
    export const NEED_HTH_WEAPON = 3;
    export const NEED_PICK_AXE = 4;
    export const NEED_AXE = 5;
    export const NEED_PICK_OR_AXE = 6;

/* The following flags are used for the second argument to display_minventory
 * in invent.c:
 *
 * PICK_NONE, PICK_ONE, PICK_ANY (wintype.h)  0, 1, 2
 * MINV_NOLET  If set, don't display inventory letters on monster's inventory.
 * MINV_ALL    If set, display all items in monster's inventory, otherwise
 *             just display wielded weapons and worn items.
 */
export const MINV_PICKMASK = 0x03;
export const MINV_NOLET = 0x04;
export const MINV_ALL = 0x08;

/* monster appearance types */

    export const M_AP_NOTHING = 0; /* mappearance unused--monster appears as itself */
    export const M_AP_FURNITURE = 1; /* stairs, a door, an altar, etc. */
    export const M_AP_OBJECT = 2; /* an object */
    export const M_AP_MONSTER = 3; /* a monster; mostly used for cloned Wizard */

export const MON_FLOOR = 0x00;
export const MON_OFFMAP = 0x01;
export const MON_DETACH = 0x02;
export const MON_MIGRATING = 0x04;
export const MON_LIMBO = 0x08;
export const MON_BUBBLEMOVE = 0x10;
export const MON_ENDGAME_FREE = 0x20;
export const MON_ENDGAME_MIGR = 0x40;
export const MON_OBLITERATE = 0x80;
export const MON_STILL_ARRIVING = 0x100;

export const M_AP_TYPMASK = 0x7;
export const M_AP_F_DKNOWN = 0x8;

    export const M_SEEN_NOTHING = 0x0000;
    export const M_SEEN_MAGR = 0x0001; /* Antimagic, AD_MAGM */
    export const M_SEEN_FIRE = 0x0002; /* Fire_resistance, AD_FIRE */
    export const M_SEEN_COLD = 0x0004; /* Cold_resistance, AD_COLD */
    export const M_SEEN_SLEEP = 0x0008; /* Sleep_resistance, AD_SLEE */
    export const M_SEEN_DISINT = 0x0010; /* Disint_resistance, AD_DISN */
    export const M_SEEN_ELEC = 0x0020; /* Shock_resistance, AD_ELEC */
    export const M_SEEN_POISON = 0x0040; /* AD_DRST */
    export const M_SEEN_ACID = 0x0080; /* Acid_resistance, AD_ACID */
    export const M_SEEN_REFL = 0x0100; /* reflection, no corresponding AD_foo */

export const MTSZ = 4; export const MAX_NUM_WORMS = 32; export const STRAT_APPEARMSG = 0x80000000; export const STRAT_ARRIVE = 0x40000000; export const STRAT_WAITFORU = 0x20000000; export const STRAT_CLOSE = 0x10000000; export const STRAT_WAITMASK = (STRAT_CLOSE | STRAT_WAITFORU); export const STRAT_HEAL = 0x08000000; export const STRAT_GROUND = 0x04000000; export const STRAT_MONSTR = 0x02000000; export const STRAT_PLAYER = 0x01000000; export const STRAT_NONE = 0x00000000; export const STRAT_STRATMASK = 0x0f000000; export const STRAT_GOAL = 0x000000ff; export const struct_monst = struct("struct_monst", {
    nmon: ptr_to("struct_monst"),
    data: ptr_to("struct_permonst"),
    m_id: unsigned,
    mnum: short, /* permanent monster index number */
    cham: short, /* if shapeshifter, orig mons[] idx goes here */
    movement: short, /* movement points (derived from permonst definition
                           * and added effects */
    m_lev: uchar, /* adjusted difficulty level of monster */
    malign: aligntyp, /* alignment of this monster, relative to the
                           * player (positive = good to kill) */
    mx: coordxy, my: coordxy,
    mux: coordxy, muy: coordxy, /* where the monster thinks you are */

    /* mtrack[0..2] is used to keep extra data when migrating the monster */
    mtrack: array_of("struct_nhcoord", MTSZ), /* monster track */
    mhp: int, mhpmax: int,
    mappearance: unsigned, /* for undetected mimics and the wiz */
    m_ap_type: uchar, /* what mappearance is describing, m_ap_types */

    mtame: schar, /* level of tameness, implies peaceful */
    mintrinsics: ushort, /* low 8 correspond to mresists */
    mextrinsics: ushort, /* low 8 correspond to mresists */
    seen_resistance: ulong, /* M_SEEN_x; saw you resist an effect */
    mspec_used: int, /* monster's special ability attack timeout */

    female: Bitfield(1), /* is female */
    minvis: Bitfield(1), /* currently invisible */
    invis_blkd: Bitfield(1), /* invisibility blocked */
    perminvis: Bitfield(1), /* intrinsic minvis value */
    mcan: Bitfield(1), /* has been cancelled */
    mburied: Bitfield(1), /* has been buried */
    mundetected: Bitfield(1), /* not seen in present hiding place;
                               * implies one of M1_CONCEAL or M1_HIDE,
                               * but not mimic (that is, snake, spider,
                               * trapper, piercer, eel) */
    mcansee: Bitfield(1), /* cansee 1, temp.blinded 0, blind 0 */

    mspeed: Bitfield(2), /* current speed */
    permspeed: Bitfield(2), /* intrinsic mspeed value */
    mrevived: Bitfield(1), /* has been revived from the dead */
    mcloned: Bitfield(1), /* has been cloned from another */
    mavenge: Bitfield(1), /* did something to deserve retaliation */
    mflee: Bitfield(1), /* fleeing */

    mfleetim: Bitfield(7), /* timeout for mflee */
    msleeping: Bitfield(1), /* asleep until woken */

    mblinded: Bitfield(7), /* cansee 0, temp.blinded n, blind 0 */
    mstun: Bitfield(1), /* stunned (off balance) */

    mfrozen: Bitfield(7),
    mcanmove: Bitfield(1), /* paralysis, similar to mblinded */

    mconf: Bitfield(1), /* confused */
    mpeaceful: Bitfield(1), /* does not attack unprovoked */
    mtrapped: Bitfield(1), /* trapped in a pit, web or bear trap */
    mleashed: Bitfield(1), /* monster is on a leash */
    isshk: Bitfield(1), /* is shopkeeper */
    isminion: Bitfield(1), /* is a minion */
    isgd: Bitfield(1), /* is guard */
    ispriest: Bitfield(1), /* is an aligned priest or high priest */

    iswiz: Bitfield(1), /* is the Wizard of Yendor */

    wormno: Bitfield(5), /* at most 31 worms on any level */
    mtemplit: Bitfield(1), /* temporarily seen; only valid during bhit() */
    meverseen: Bitfield(1), /* mon has been seen at some point */

    mspotted: Bitfield(1), /* mon is currently seen by hero */
    mwandexp: Bitfield(1), /* mon has experience with wands */
    mgenmklev: Bitfield(1), /* made by the level generation */
    /* 5 spare bits */

    mstrategy: ulong, /* for monsters with mflag3: current strategy */

    /* mstrategy unused 0x00ffff00L */

    mgoal: "struct_nhcoord", /* monster strategy, target location */
    mtrapseen: long, /* bitmap of traps we've been trapped in */
    mlstmv: long, /* for catching up with lost time */
    mstate: long, /* debugging info on monsters stored here */
    migflags: long, /* migrating flags */
    mspare1: long,
    minvent: ptr_to("struct_obj"), /* mon's inventory */
    mw: ptr_to("struct_obj"), /* mon's weapon */
    misc_worn_check: long, /* mon's wornmask */
    weapon_check: xint16, /* flag for whether to try switching weapons */

    meating: int, /* monster is eating timeout */
    mextra: ptr_to("struct_mextra"), /* point to mextra struct */
});

/* these are in mspeed */
export const MSLOW = 1;
export const MFAST = 2;

import { aligntyp } from "./align.h.js";
import { coordxy, xint16 } from "./global.h.js";
import { int, long, schar, short, uchar, ulong, unsigned, ushort } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
