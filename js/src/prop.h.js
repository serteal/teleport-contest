/* NetHack 5.0	prop.h	$NHDT-Date: 1702274027 2023/12/11 05:53:47 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.24 $ */
/* Copyright (c) 1989 Mike Threepoint                             */
/* NetHack may be freely redistributed.  See license for details. */

/*** What the properties are ***
 *
 * note:  propertynames[] array in timeout.c has string values for these.
 *        Property #0 is not used.
 */
/* Resistances to troubles */

    export const FIRE_RES = 1;
    export const COLD_RES = 2;
    export const SLEEP_RES = 3;
    export const DISINT_RES = 4;
    export const SHOCK_RES = 5;
    export const POISON_RES = 6;
    export const ACID_RES = 7;
    export const STONE_RES = 8;

    export const DRAIN_RES = 9;
    export const SICK_RES = 10;
    export const INVULNERABLE = 11;
    export const ANTIMAGIC = 12;
    /* Troubles */
    export const STUNNED = 13;
    export const CONFUSION = 14;
    export const BLINDED = 15;
    export const DEAF = 16;
    export const SICK = 17;
    export const STONED = 18;
    export const STRANGLED = 19;
    export const VOMITING = 20;
    export const GLIB = 21;
    export const SLIMED = 22;
    export const HALLUC = 23;
    export const HALLUC_RES = 24;
    export const FUMBLING = 25;
    export const WOUNDED_LEGS = 26;
    export const SLEEPY = 27;
    export const HUNGER = 28;
    /* Vision and senses */
    export const SEE_INVIS = 29;
    export const TELEPAT = 30;
    export const WARNING = 31;
    export const WARN_OF_MON = 32;
    export const WARN_UNDEAD = 33;
    export const SEARCHING = 34;
    export const CLAIRVOYANT = 35;
    export const INFRAVISION = 36;
    export const DETECT_MONSTERS = 37;
    export const BLND_RES = 38;
    /* Appearance and behavior */
    export const ADORNED = 39;
    export const INVIS = 40;
    export const DISPLACED = 41;
    export const STEALTH = 42;
    export const AGGRAVATE_MONSTER = 43;
    export const CONFLICT = 44;
    /* Transportation */
    export const JUMPING = 45;
    export const TELEPORT = 46;
    export const TELEPORT_CONTROL = 47;
    export const LEVITATION = 48;
    export const FLYING = 49;
    export const WWALKING = 50;
    export const SWIMMING = 51;
    export const MAGICAL_BREATHING = 52;
    export const PASSES_WALLS = 53;
    /* Physical attributes */
    export const SLOW_DIGESTION = 54;
    export const HALF_SPDAM = 55;
    export const HALF_PHDAM = 56;
    export const REGENERATION = 57;
    export const ENERGY_REGENERATION = 58;
    export const PROTECTION = 59;
    export const PROT_FROM_SHAPE_CHANGERS = 60;
    export const POLYMORPH = 61;
    export const POLYMORPH_CONTROL = 62;
    export const UNCHANGING = 63;
    export const FAST = 64;
    export const REFLECTING = 65;
    export const FREE_ACTION = 66;
    export const FIXED_ABIL = 67;
    export const LIFESAVED = 68;
    export const LAST_PROP = LIFESAVED;

/*** Where the properties come from ***/
/* Definitions were moved here from obj.h and you.h */
export const W_ARM = 0x00000001; export const W_ARMC = 0x00000002; export const W_ARMH = 0x00000004; export const W_ARMS = 0x00000008; export const W_ARMG = 0x00000010; export const W_ARMF = 0x00000020; export const W_ARMU = 0x00000040; export const W_ARMOR = (W_ARM | W_ARMC | W_ARMH | W_ARMS | W_ARMG | W_ARMF | W_ARMU); export const W_WEP = 0x00000100; export const W_QUIVER = 0x00000200; export const W_SWAPWEP = 0x00000400; export const W_WEAPONS = (W_WEP | W_SWAPWEP | W_QUIVER); export const W_ART = 0x00001000; export const W_ARTI = 0x00002000; export const W_AMUL = 0x00010000; export const W_RINGL = 0x00020000; export const W_RINGR = 0x00040000; export const W_RING = (W_RINGL | W_RINGR); export const W_TOOL = 0x00080000; export const W_ACCESSORY = (W_RING | W_AMUL | W_TOOL); export const W_SADDLE = 0x00100000; export const W_BALL = 0x00200000; export const W_CHAIN = 0x00400000; export const TIMEOUT = 0x00ffffff; export const FROMEXPER = 0x01000000; export const FROMRACE = 0x02000000; export const FROMOUTSIDE = 0x04000000; export const INTRINSIC = (FROMOUTSIDE | FROMRACE | FROMEXPER); export const FROMFORM = 0x10000000; export const I_SPECIAL = 0x20000000; export const struct_prop = struct("struct_prop", {
    /*** Properties conveyed by objects ***/
    extrinsic: long,
/* Armor */

/* Weapons and artifacts */

/* Amulets, rings, tools, and other items */

    /* historical note: originally in slash'em, 'worn' saddle stayed in
       hero's inventory; in nethack, it's kept in the steed's inventory */

    /*** Property is blocked by an object ***/
    blocked: long, /* Same assignments as extrinsic */

    /*** Timeouts, permanent properties, and other flags ***/
    intrinsic: long,
/* Timed properties */

/* Permanent properties */

/* Control flags */
});

/*** Definitions for backwards compatibility ***/
export const LEFT_RING = W_RINGL;
export const RIGHT_RING = W_RINGR;
export const LEFT_SIDE = LEFT_RING;
export const RIGHT_SIDE = RIGHT_RING;
export const BOTH_SIDES = (LEFT_SIDE | RIGHT_SIDE);
export const WORN_ARMOR = W_ARM;
export const WORN_CLOAK = W_ARMC;
export const WORN_HELMET = W_ARMH;
export const WORN_SHIELD = W_ARMS;
export const WORN_GLOVES = W_ARMG;
export const WORN_BOOTS = W_ARMF;
export const WORN_AMUL = W_AMUL;
export const WORN_BLINDF = W_TOOL;
export const WORN_SHIRT = W_ARMU;

import { long } from "../rt/ctypes.js";
import { struct } from "../rt/struct.js";
