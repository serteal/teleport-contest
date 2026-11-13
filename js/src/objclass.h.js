/* NetHack 5.0	objclass.h	$NHDT-Date: 1596498553 2020/08/03 23:49:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.22 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/* [misnamed] definition of a type of object; many objects are composites
   (liquid potion inside glass bottle, metal arrowhead on wooden shaft)
   and object definitions only specify one type on a best-fit basis */

    export const NO_MATERIAL = 0;
    export const LIQUID = 1; /* currently only for venom */
    export const WAX = 2;
    export const VEGGY = 3; /* foodstuffs */
    export const FLESH = 4; /*   ditto    */
    export const PAPER = 5;
    export const CLOTH = 6;
    export const LEATHER = 7;
    export const WOOD = 8;
    export const BONE = 9;
    export const DRAGON_HIDE = 10; /* not leather! */
    export const IRON = 11; /* Fe - includes steel */
    export const METAL = 12; /* Sn, &c. */
    export const COPPER = 13; /* Cu - includes brass */
    export const SILVER = 14; /* Ag */
    export const GOLD = 15; /* Au */
    export const PLATINUM = 16; /* Pt */
    export const MITHRIL = 17;
    export const PLASTIC = 18;
    export const GLASS = 19;
    export const GEMSTONE = 20;
    export const MINERAL = 21;

    export const ARM_SUIT = 0;
    export const ARM_SHIELD = 1; /* needed for special wear function */
    export const ARM_HELM = 2;
    export const ARM_GLOVES = 3;
    export const ARM_BOOTS = 4;
    export const ARM_CLOAK = 5;
    export const ARM_SHIRT = 6;

export const NODIR = 1; export const IMMEDIATE = 2; export const RAY = 3; export const PIERCE = 1; export const SLASH = 2; export const WHACK = 4; export const struct_objclass = struct("struct_objclass", {
    oc_name_idx: short, /* index of actual name */
    oc_descr_idx: short, /* description when name unknown */
    oc_uname: ptr_to(char), /* called by user */
    oc_name_known: Bitfield(1), /* discovered */
    oc_merge: Bitfield(1), /* merge otherwise equal objects */
    oc_uses_known: Bitfield(1), /* obj->known affects full description;
                                     * otherwise, obj->dknown and obj->bknown
                                     * tell all, and obj->known should always
                                     * be set for proper merging behavior. */
    oc_encountered: Bitfield(1), /* hero has observed such an item at least
                                       once (perhaps without naming it) */
    oc_magic: Bitfield(1), /* inherently magical object */
    oc_charged: Bitfield(1), /* may have +n or (n) charges */
    oc_unique: Bitfield(1), /* special one-of-a-kind object */
    oc_nowish: Bitfield(1), /* cannot wish for this object */

    oc_big: Bitfield(1),

    oc_tough: Bitfield(1), /* hard gems/rings */

    oc_spare1: Bitfield(6), /* padding to align oc_dir + oc_material;
                                     * can be cannibalized for other use;
                                     * aka 6 free bits */

    oc_dir: Bitfield(3),
    /* oc_dir: zap style for wands and spells */

    /* overloaded oc_dir: strike mode bit mask for weapons and weptools */

    oc_material: Bitfield(5), /* one of obj_material_types */

    oc_subtyp: schar,

    oc_oprop: uchar, /* property (invis, &c.) conveyed */
    oc_class: char, /* object class (enum obj_class_types) */
    oc_delay: schar, /* delay when using such an object */
    oc_color: uchar, /* color of the object */

    oc_prob: short, /* probability, used in mkobj() */
    oc_weight: unsigned, /* encumbrance (1 cn = 0.1 lb.) */
    oc_cost: short, /* base cost in shops */
    /* Check the AD&D rules!  The FIRST is small monster damage. */
    /* for weapons, and tools, rocks, and gems useful as weapons */
    oc_wsdam: schar, oc_wldam: schar, /* max small/large monster damage */
    oc_oc1: schar, oc_oc2: schar,

    oc_nutrition: ushort, /* food value */

    oc_sell_minseen: ulong,
    oc_sell_maxseen: ulong,
    oc_buy_minseen: ulong,
    oc_buy_maxseen: ulong,
});

export const struct_class_sym = struct("struct_class_sym", {
    sym: char,
    name: ptr_to(char),
    explain: ptr_to(char),
});

export const struct_objdescr = struct("struct_objdescr", {
    oc_name: ptr_to(char), /* actual name */
    oc_descr: ptr_to(char), /* description when name unknown */
});

/*
 * All objects have a class. Make sure that all classes have a corresponding
 * symbol below.
 */

    /* used for generating random objects */

/* Default characters for object classes */

/* for mkobj() use ONLY! odd '-SPBOOK_CLASS' is in case of unsigned enums */
export const SPBOOK_no_NOVEL = (0 - SPBOOK_CLASS);

export const BURNING_OIL = (MAXOCLASSES + 1);
export const MON_EXPLODE = (MAXOCLASSES + 2);
export const TRAP_EXPLODE = (MAXOCLASSES + 3);

        /* default class symbols */
/* current class symbols */

export const struct_fruit = struct("struct_fruit", {
    fname: array_of(char, PL_FSIZ),
    fid: int,
    nextf: ptr_to("struct_fruit"),
});

    export const NUM_REAL_GEMS = (LAST_REAL_GEM - FIRST_REAL_GEM + 1);
    export const NUM_GLASS_GEMS = (LAST_GLASS_GEM - FIRST_GLASS_GEM + 1);
    /* LAST_SPELL is SPE_BLANK_PAPER, guaranteeing that spl_book[] will
       have at least one unused slot at end to be used as a terminator */
    export const MAXSPELL = (LAST_SPELL - FIRST_SPELL + 1);

import { MAXOCLASSES, SPBOOK_CLASS } from "./defsym.h.js";
import { PL_FSIZ } from "./global.h.js";
import {
    FIRST_GLASS_GEM, FIRST_REAL_GEM, FIRST_SPELL, LAST_GLASS_GEM, LAST_REAL_GEM, LAST_SPELL,
} from "./objects.h.js";
import { char, int, schar, short, uchar, ulong, unsigned, ushort } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
