/* NetHack 5.0	monattk.h	$NHDT-Date: 1596498548 2020/08/03 23:49:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.13 $ */
/* NetHack may be freely redistributed.  See license for details. */
/* Copyright 1988, M. Stephenson */

/*      Add new attack types below - ordering affects experience (exper.c).
 *      Attacks > AT_BUTT are worth extra experience.
 */
export const AT_ANY = (-1);
export const AT_NONE = 0;
export const AT_CLAW = 1;
export const AT_BITE = 2;
export const AT_KICK = 3;
export const AT_BUTT = 4;
export const AT_TUCH = 5;
export const AT_STNG = 6;
export const AT_HUGS = 7;
export const AT_SPIT = 10;
export const AT_ENGL = 11;
export const AT_BREA = 12;
export const AT_EXPL = 13;
export const AT_BOOM = 14;
export const AT_GAZE = 15;
export const AT_TENT = 16;

export const AT_WEAP = 254;
export const AT_MAGC = 255;

/*      Add new damage types below.
 *
 *      Note that 1-10 correspond to the types of attack used in buzz().
 *      Please don't disturb the order unless you rewrite the buzz() code.
 */
export const AD_ANY = (-1);
export const AD_PHYS = 0;
export const AD_MAGM = 1;
export const AD_FIRE = 2;
export const AD_COLD = 3;
export const AD_SLEE = 4;
export const AD_DISN = 5;
export const AD_ELEC = 6;
export const AD_DRST = 7;
export const AD_ACID = 8;

export const AD_SPC2 = 10;
export const AD_BLND = 11;
export const AD_STUN = 12;
export const AD_SLOW = 13;
export const AD_PLYS = 14;
export const AD_DRLI = 15;
export const AD_DREN = 16;
export const AD_LEGS = 17;
export const AD_STON = 18;
export const AD_STCK = 19;
export const AD_SGLD = 20;
export const AD_SITM = 21;
export const AD_SEDU = 22;
export const AD_TLPT = 23;
export const AD_RUST = 24;
export const AD_CONF = 25;
export const AD_DGST = 26;
export const AD_HEAL = 27;
export const AD_WRAP = 28;
export const AD_WERE = 29;
export const AD_DRDX = 30;
export const AD_DRCO = 31;
export const AD_DRIN = 32;
export const AD_DISE = 33;
export const AD_DCAY = 34;
export const AD_SSEX = 35;
export const AD_HALU = 36;
export const AD_DETH = 37;
export const AD_PEST = 38;
export const AD_FAMN = 39;
export const AD_SLIM = 40;
export const AD_ENCH = 41;
export const AD_CORR = 42;
export const AD_POLY = 43;

export const AD_CLRC = 240;
export const AD_SPEL = 241;
export const AD_RBRE = 242;

export const AD_SAMU = 252;
export const AD_CURS = 253;

export const struct_mhitm_data = struct("struct_mhitm_data", {
    damage: int,
    hitflags: int, /* M_ATTK_DEF_DIED | M_ATTK_AGR_DIED | ... */
    done: boolean,
    permdmg: boolean,
    specialdmg: int,
    dieroll: int,
});

/*
 *  Monster-to-monster attacks.  When a monster attacks another (mattackm),
 *  any or all of the following can be returned.  See mattackm() for more
 *  details.
 */
export const M_ATTK_MISS = 0x0;
export const M_ATTK_HIT = 0x1;
export const M_ATTK_DEF_DIED = 0x2;
export const M_ATTK_AGR_DIED = 0x4;
export const M_ATTK_AGR_DONE = 0x8;

import { boolean } from "./global.h.js";
import { int } from "../rt/ctypes.js";
import { struct } from "../rt/struct.js";
