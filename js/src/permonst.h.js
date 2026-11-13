/* NetHack 5.0	permonst.h	$NHDT-Date: 1725653014 2024/09/06 20:03:34 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.26 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Kenneth Lorber, Kensington, Maryland, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

        /* "not a monster" */
        /* first monster in mons */
        /* leave statue instead of corpse;
                                   * there are two lower values assigned
                                   * in end.c so that (x == LEAVESTATUE)
                                   * will test FALSE in bones.c:
                                   *  (NON_PM - 2) for no corpse
                                   *  (NON_PM - 3) for no corpse, no grave */

        /* [normal] < ~ < [special] */
                /* mons[SPECIAL_PM] through mons[NUMMONS-1], inclusive, are
                   never generated randomly and cannot be polymorphed into */

/*     This structure covers all attack forms.
 *     aatyp is the gross attack type (eg. claw, bite, breath, ...)
 *     adtyp is the damage type (eg. physical, fire, cold, spell, ...)
 *     damn is the number of hit dice of damage from the attack.
 *     damd is the number of sides on each die.
 *
 *     Some attacks can do no points of damage.  Additionally, some can
 *     have special effects *and* do damage as well.  If damn and damd
 *     are set, they may have a special meaning.  For example, if set
 *     for a blinding attack, they determine the amount of time blinded.
 */

export const struct_attack = struct("struct_attack", {
    aatyp: uchar,
    adtyp: uchar, damn: uchar, damd: uchar,
});

/*     Max # of attacks for any given monster.
 */

export const NATTK = 6;

export const struct_permonst = struct("struct_permonst", {
    pmnames: array_of(ptr_to(char), NUM_MGENDERS),
    pmidx: int, /* mons array index aka PM_ identifier */
    mlet: char, /* symbol */
    mlevel: schar, /* base monster level */
        mmove: schar, /* move speed */
        ac: schar, /* (base) armor class */
        mr: schar, /* (base) magic resistance */
    maligntyp: aligntyp, /* basic monster alignment */
    geno: ushort, /* creation/geno mask value */
    mattk: array_of("struct_attack", NATTK), /* attacks matrix */
    cwt: unsigned, /* weight of corpse */
    cnutrit: ushort, /* its nutritional value */
    msound: uchar, /* noise it makes (6 bits) */
    msize: uchar, /* physical size (3 bits) */
    mresists: uchar, /* resistances */
    mconveys: uchar, /* conveyed by eating */
    mflags1: ulong, /* boolean bitflags */
        mflags2: ulong, /* more boolean bitflags */
    mflags3: ushort, /* yet more boolean bitflags */
    difficulty: uchar, /* toughness (formerly from  makedefs -m) */
    mcolor: uchar, /* color to use */
});

export const NORMAL_SPEED = 12;

/* the master list of
                                                    * monster types */

import { aligntyp } from "./align.h.js";
import { NUM_MGENDERS } from "./monflag.h.js";
import { char, int, schar, uchar, ulong, unsigned, ushort } from "../rt/ctypes.js";
import { array_of, ptr_to, struct } from "../rt/struct.js";
