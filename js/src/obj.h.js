/* NetHack 5.0	obj.h	$NHDT-Date: 1718999845 2024/06/21 19:57:25 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.116 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/* #define obj obj_nh *//* uncomment for SCO UNIX, which has a conflicting
                          * typedef for "obj" in <sys/types.h> */

/* start with incomplete types in case these aren't defined yet;
   basic pointers to them don't need to know their details */

export const struct_vptrs = union("struct_vptrs", {
    v_nexthere: ptr_to("struct_obj"), /* floor location lists */
    v_ocontainer: ptr_to("struct_obj"), /* point back to container */
    v_ocarry: ptr_to("struct_monst"), /* point back to carrying monst */
});

/****
 ***    oextra -- collection of all object extensions
 **     (see the note at the bottom of this file before adding oextra fields)
 */
export const struct_oextra = struct("struct_oextra", {
    oname: ptr_to(char), /* ptr to name of object */
    omonst: ptr_to("struct_monst"), /* ptr to attached monst struct */
    omailcmd: ptr_to(char), /* response_cmd for mail delivery */
    omid: unsigned, /* for corpse: m_id of corpse's ghost; overloaded
                           * for glob: owt at time added to shop's bill */
});

export const SPE_LIM = 99; export const OBJ_FREE = 0; export const OBJ_FLOOR = 1; export const OBJ_CONTAINED = 2; export const OBJ_INVENT = 3; export const OBJ_MINVENT = 4; export const OBJ_MIGRATING = 5; export const OBJ_BURIED = 6; export const OBJ_ONBILL = 7; export const OBJ_LUAFREE = 8; export const OBJ_DELETED = 9; export const NOBJ_STATES = 10; export const MAX_ERODE = 3; export const struct_obj = struct("struct_obj", {
    nobj: ptr_to("struct_obj"),
    v: "struct_vptrs",

    cobj: ptr_to("struct_obj"), /* contents list for containers */
    o_id: unsigned,
    ox: coordxy, oy: coordxy,
    otyp: short, /* object class number */
    owt: unsigned,
    quan: long, /* number of items */

    spe: schar, /* quality of weapon, weptool, armor, or some rings (+ or -);
                * number of charges for wand or charged tool ( >= -1 );
                * number of candles attached to candelabrum (0..7);
                * magic lamp (1 iff djinni inside => lamp is lightable);
                * oil lamp, tallow/wax candle (1 for no apparent reason?);
                * marks spinach tins (1 iff corpsenm==NON_PM);
                * marks tin variety (various: homemade, stir fried, &c);
                * eggs laid by you (1), eggs upgraded with royal jelly (2);
                * Schroedinger's Box (1) or royal coffers for a court (2);
                * named fruit index;
                * candy bar wrapper index;
                * scroll of scare monster (when uncursed: never picked up==0,
                *   has been picked up==1, turns to dust if picked up again;
                *   when blessed|cursed: flag not checked, set, or cleared);
                * scroll of mail (normal==0, bones or wishing==1, written==2);
                * splash of venom (normal==0, wishing==1);
                * gender for corpses, statues, and figurines (0..3,
                *   CORPSTAT_GENDER),
                * historic flag for statues (4, CORPSTAT_HISTORIC) */
    oclass: char, /* object class */
    invlet: char, /* designation in inventory */
    oartifact: char, /* artifact array index */

    where: xint8, /* where the object thinks it is */

    /* note: OBJ_xxx values are used in obj_state_names[] in mkobj.c
       so adding, removing, or renumbering these needs to change that too */

    timed: xint16, /* # of fuses (timers) attached to this obj */

    /* Bitfields currently require 5 bytes minimum */
    cursed: Bitfield(1), /* uncursed when neither cursed nor blessed */
    blessed: Bitfield(1),
    unpaid: Bitfield(1), /* owned by shop; valid for objects in hero's
                             * inventory or inside containers there; also,
                             * used for items on the floor only on the shop
                             * boundary (including "free spot") or if moved
                             * from there to inside by wall repairs */
    no_charge: Bitfield(1), /* if shk shouldn't charge for this; valid for
                             * items on shop floor or in containers there;
                             * implicit for items at any other location
                             * unless carried and explicitly flagged unpaid */
    recharged: Bitfield(3), /* number of times it's been recharged */

    lamplit: Bitfield(1), /* a light-source -- can be lit */

    known: Bitfield(1), /* exact nature known (for instance, charge count
                             * or enchantment); many items have this preset if
                             * they lack anything interesting to discover */
    dknown: Bitfield(1), /* description known (item seen "up close");
                             * some types of items always have dknown set;
                             * use observe_object to set to TRUE so that the
                             * discoveries list is still correct */
    bknown: Bitfield(1), /* BUC (blessed/uncursed/cursed) known */
    rknown: Bitfield(1), /* rustproofing status known */
    cknown: Bitfield(1), /* for containers (including statues): the contents
                          * are known; also applicable to tins; also applies
                          * to horn of plenty but only for empty/non-empty */
    lknown: Bitfield(1), /* locked/unlocked status is known; assigned for bags
                          * and for horn of plenty (when tipping) even though
                          * they have no locks */
    tknown: Bitfield(1), /* trap status known for chests */
    nomerge: Bitfield(1), /* set temporarily to prevent merging */

    oeroded: Bitfield(2), /* rusted/burnt weapon/armor */
    oeroded2: Bitfield(2), /* corroded/rotted weapon/armor */

    oerodeproof: Bitfield(1), /* erodeproof weapon/armor */
    olocked: Bitfield(1), /* object is locked */
    obroken: Bitfield(1), /* lock has been broken */

    otrapped: Bitfield(1), /* container is trapped */
/* or accidental tripped rolling boulder trap */

    globby: Bitfield(1), /* combines with like types on adjacent squares */
    greased: Bitfield(1), /* covered with grease */
    in_use: Bitfield(1), /* for magic items before useup items */
    bypass: Bitfield(1), /* mark this as an object to be skipped by bhito() */
    pickup_prev: Bitfield(1), /* was picked up previously */
    ghostly: Bitfield(1), /* it just got placed into a bones file */
    how_lost: Bitfield(3), /* stolen by mon or thrown, dropped by hero, etc */

    named_how: Bitfield(1), /* source of name per TODO in resetobjs() */

    /* not implemented */
    /* effect known for wands zapped or rings worn when
                          * not seen yet after being picked up while blind
                          * [maybe for remaining stack of used potion too] */
    /* 5 free bits */

    /* 6 free bits */

    corpsenm: int, /* type of corpse is mons[corpsenm] */

    usecount: int, /* overloaded for various things that tally */

    oeaten: unsigned, /* nutrition left in food, if partly eaten */
    age: long, /* creation date */
    owornmask: long, /* bit mask indicating which equipment slot(s) an
                            * item is worn in [by hero or by monster; could
                            * indicate more than one bit: attached iron ball
                            * that's also wielded];
                            * overloaded for the destination of migrating
                            * objects (which can't be worn at same time) */
    lua_ref_cnt: unsigned, /* # of lua script references for this object */
    omigr_from_dnum: xint16, /* where obj is migrating from */
    omigr_from_dlevel: xint16, /* where obj is migrating from */
    oextra: ptr_to("struct_oextra"), /* pointer to oextra struct */
});

/* Eggs and other food */
export const MAX_EGG_HATCH_TIME = 200;

export const MAX_OIL_IN_FLASK = 400;

/* Flags for get_obj_location(). */
export const CONTAINED_TOO = 0x1;
export const BURIED_TOO = 0x2;

/* object erosion types */
export const ERODE_NONE = -1;
export const ERODE_BURN = 0;
export const ERODE_RUST = 1;
export const ERODE_ROT = 2;
export const ERODE_CORRODE = 3;
export const ERODE_CRACK = 4;

/* erosion flags for erode_obj() */
export const EF_NONE = 0;
export const EF_GREASE = 0x1;
export const EF_DESTROY = 0x2;
export const EF_VERBOSE = 0x4;
export const EF_PAY = 0x8;

/* erosion return values for erode_obj(), water_damage() */
export const ER_NOTHING = 0;
export const ER_GREASED = 1;
export const ER_DAMAGED = 2;
export const ER_DESTROYED = 3;

/* propeller method for potionhit() */
export const POTHIT_HERO_BASH = 0;
export const POTHIT_HERO_THROW = 1;
export const POTHIT_MONST_THROW = 2;
export const POTHIT_OTHER_THROW = 3;

/* tracking how an item left your inventory via how_lost field */
export const LOST_NONE = 0;
export const LOST_THROWN = 1;
export const LOST_DROPPED = 2;
export const LOST_STOLEN = 3;

export const LOST_EXPLODING = 4;

/* tracking how a name got acquired by an object in named_how field */

/*
 *  Notes for adding new oextra structures:
 *
 *       1. Add the structure definition and any required macros in an
 *          appropriate header file that precedes this one.
 *       2. Add a pointer to your new struct to oextra struct in this file.
 *       3. Add a referencing macro to this file after the newobj macro above
 *          (see ONAME, OMONST, OMAILCMD, or OMIN for examples).
 *       4. Add a testing macro after the set of referencing macros
 *          (see has_oname(), has_omonst(), has_omailcmd(), and has_omin(),
 *          for examples).
 *       5. If your new field isn't a pointer and requires a non-zero value
 *          on initialization, add code to init_oextra() in src/mkobj.c.
 *       6. Create newXX(otmp) function and possibly free_XX(otmp) function
 *          in an appropriate new or existing source file and add a prototype
 *          for it to include/extern.h.  The majority of these are currently
 *          located in mkobj.c for convenience.
 *
 *          void newXX(struct obj *);
 *          void free_XX(struct obj *);
 *
 *          void
 *          newxx(otmp)
 *          struct obj *otmp;
 *          {
 *              if (!otmp->oextra)
 *                  otmp->oextra = newoextra();
 *              if (!XX(otmp)) {
 *                  XX(otmp) = (struct XX *) alloc(sizeof (struct xx));
 *                  (void) memset((genericptr_t) XX(otmp),
 *                                0, sizeof (struct xx));
 *              }
 *         }
 *
 *       7. Adjust size_obj() in src/cmd.c appropriately.
 *       8. Adjust dealloc_oextra() in src/mkobj.c to clean up
 *          properly during obj deallocation.
 *       9. Adjust copy_oextra() in src/mkobj.c to make duplicate
 *          copies of your struct or data onto another obj struct.
 *      10. Adjust restobj() in src/restore.c to deal with your
 *          struct or data during a restore.
 *      11. Adjust saveobj() in src/save.c to deal with your
 *          struct or data during a save.
 */

import { coordxy, xint16, xint8 } from "./global.h.js";
import { char, int, long, schar, short, unsigned } from "../rt/ctypes.js";
import { Bitfield, ptr_to, struct, union } from "../rt/struct.js";
