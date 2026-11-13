/* NetHack 5.0	skills.h	$NHDT-Date: 1596498559 2020/08/03 23:49:19 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.16 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985-1999. */
/*-Copyright (c) Pasi Kallinen, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

/* Much of this code was taken from you.h.  It is now
 * in a separate file so it can be included in objects.c.
 */

    /* Code to denote that no skill is applicable */
    export const P_NONE = 0;

/* Weapon Skills -- Stephen White
 * Order matters and are used in macros.
 * Positive values denote hand-to-hand weapons or launchers.
 * Negative values denote ammunition or missiles.
 * Update weapon.c if you amend any skills.
 * Also used for oc_subtyp.
 */
    export const P_DAGGER = 1;
    export const P_KNIFE = 2;
    export const P_AXE = 3;
    export const P_PICK_AXE = 4;
    export const P_SHORT_SWORD = 5;
    export const P_BROAD_SWORD = 6;
    export const P_LONG_SWORD = 7;
    export const P_TWO_HANDED_SWORD = 8;
    export const P_SABER = 9; /* Curved sword, includes scimitar */
    export const P_CLUB = 10; /* Heavy-shafted bludgeon */
    export const P_MACE = 11;
    export const P_MORNING_STAR = 12; /* Spiked bludgeon */
    export const P_FLAIL = 13; /* Two pieces hinged or chained together */
    export const P_HAMMER = 14; /* Heavy head on the end */
    export const P_QUARTERSTAFF = 15; /* Long-shafted bludgeon */
    export const P_POLEARMS = 16; /* attack two or three steps away */
    export const P_SPEAR = 17; /* includes javelin */
    export const P_TRIDENT = 18;
    export const P_LANCE = 19;
    export const P_BOW = 20; /* launchers */
    export const P_SLING = 21;
    export const P_CROSSBOW = 22;
    export const P_DART = 23; /* hand-thrown missiles */
    export const P_SHURIKEN = 24;
    export const P_BOOMERANG = 25;
    export const P_WHIP = 26; /* flexible, one-handed */
    export const P_UNICORN_HORN = 27; /* last weapon, two-handed */

    /* Spell Skills added by Larry Stewart-Zerba */
    export const P_ATTACK_SPELL = 28;
    export const P_HEALING_SPELL = 29;
    export const P_DIVINATION_SPELL = 30;
    export const P_ENCHANTMENT_SPELL = 31;
    export const P_CLERIC_SPELL = 32;
    export const P_ESCAPE_SPELL = 33;
    export const P_MATTER_SPELL = 34;

    /* Other types of combat */
    export const P_BARE_HANDED_COMBAT = 35; /* actually weaponless; gloves are ok */
    export const P_TWO_WEAPON_COMBAT = 36; /* pair of weapons, one in each hand */
    export const P_RIDING = 37; /* How well you control your steed */

    export const P_NUM_SKILLS = 38;

export const P_MARTIAL_ARTS = P_BARE_HANDED_COMBAT;

export const P_FIRST_WEAPON = P_DAGGER;
export const P_LAST_WEAPON = P_UNICORN_HORN;

export const P_FIRST_SPELL = P_ATTACK_SPELL;
export const P_LAST_SPELL = P_MATTER_SPELL;

export const P_LAST_H_TO_H = P_RIDING;
export const P_FIRST_H_TO_H = P_BARE_HANDED_COMBAT;

/*
 * These are the standard weapon skill levels.  It is important that
 * the lowest "valid" skill be 1.  The code calculates the
 * previous amount to practice by calling  practice_needed_to_advance()
 * with the current skill-1.  To work out for the UNSKILLED case,
 * a value of 0 needed.
 */

    export const P_ISRESTRICTED = 0; /* unskilled and can't be advanced */
    export const P_UNSKILLED = 1; /* unskilled so far but can be advanced */
    /* Skill levels Basic/Advanced/Expert had long been used by
       Heroes of Might and Magic (tm) and its sequels... */
    export const P_BASIC = 2;
    export const P_SKILLED = 3;
    export const P_EXPERT = 4;
    /* when the skill system was adopted into nethack, levels beyond expert
       were unnamed and just used numbers.  Devteam coined them Master and
       Grand Master.  Sometime after that, Heroes of Might and Magic IV (tm)
       was released and had two more levels which use these same names. */
    export const P_MASTER = 5; /* Unarmed combat/martial arts only */
    export const P_GRAND_MASTER = 6; /* ditto */

/* The hero's skill in various weapons. */
export const struct_skills = struct("struct_skills", {
    skill: xint16,
    max_skill: xint16,
    advance: ushort,
});

export const P_SKILL_LIMIT = 60;

/* Initial skill matrix structure; used in u_init.c and weapon.c */
export const struct_def_skill = struct("struct_def_skill", {
    skill: xint16,
    skmax: xint16,
});

import { xint16 } from "./global.h.js";
import { ushort } from "../rt/ctypes.js";
import { struct } from "../rt/struct.js";
