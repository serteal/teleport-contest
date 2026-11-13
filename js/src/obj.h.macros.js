export function greatest_erosion(otmp) { return (otmp.oeroded > otmp.oeroded2 ? otmp.oeroded
                                             : otmp.oeroded2); }

export function newobj() { return view_of(struct_obj, addr_of(alloc(sizeof(struct_obj)))); }

/***
 **     oextra referencing and testing macros
 */

export function ONAME(o) { return o.oextra.oname; }
export function OMONST(o) { return o.oextra.omonst; }
export function OMAILCMD(o) { return o.oextra.omailcmd; }
export function OMID(o) { return o.oextra.omid; }

export function has_oname(o) { return (o.oextra && ONAME(o) ? 1 : 0); }
export function has_omonst(o) { return (o.oextra && OMONST(o) ? 1 : 0); }
export function has_omailcmd(o) { return (o.oextra && OMAILCMD(o) ? 1 : 0); }
export function has_omid(o) { return (o.oextra && OMID(o) ? 1 : 0); }

/* Weapons and weapon-tools */
/* KMH -- now based on skill categories.  Formerly:
 *      #define is_sword(otmp)  (otmp->oclass == WEAPON_CLASS && \
 *                       objects[otmp->otyp].oc_wepcat == WEP_SWORD)
 *      #define is_blade(otmp)  (otmp->oclass == WEAPON_CLASS && \
 *                       (objects[otmp->otyp].oc_wepcat == WEP_BLADE || \
 *                        objects[otmp->otyp].oc_wepcat == WEP_SWORD))
 *      #define is_weptool(o)   ((o)->oclass == TOOL_CLASS && \
 *                       objects[(o)->otyp].oc_weptool)
 *      #define is_multigen(otyp) (otyp <= SHURIKEN)
 *      #define is_poisonable(otyp) (otyp <= BEC_DE_CORBIN)
 */
export function is_blade(otmp) { return +(otmp.oclass == WEAPON_CLASS
     && objects[otmp.otyp].oc_subtyp >= P_DAGGER
     && objects[otmp.otyp].oc_subtyp <= P_SABER); }

export function is_axe(otmp) { return +((otmp.oclass == WEAPON_CLASS || otmp.oclass == TOOL_CLASS)
     && objects[otmp.otyp].oc_subtyp == P_AXE); }

export function is_pick(otmp) { return +((otmp.oclass == WEAPON_CLASS || otmp.oclass == TOOL_CLASS)
     && objects[otmp.otyp].oc_subtyp == P_PICK_AXE); }

export function is_sword(otmp) { return +(otmp.oclass == WEAPON_CLASS
     && objects[otmp.otyp].oc_subtyp >= P_SHORT_SWORD
     && objects[otmp.otyp].oc_subtyp <= P_SABER); }

/* Snickersnee is not a polearm, but can hit from distance */
export function is_pole(otmp) { return ((otmp.oclass == WEAPON_CLASS || otmp.oclass == TOOL_CLASS)
     && (objects[otmp.otyp].oc_subtyp == P_POLEARMS
         || objects[otmp.otyp].oc_subtyp == P_LANCE
         || is_art(otmp, ART_SNICKERSNEE)) ? 1 : 0); }

export function is_spear(otmp) { return +(otmp.oclass == WEAPON_CLASS && objects[otmp.otyp].oc_subtyp == P_SPEAR); }

export function is_launcher(otmp) { return +(otmp.oclass == WEAPON_CLASS && objects[otmp.otyp].oc_subtyp >= P_BOW
     && objects[otmp.otyp].oc_subtyp <= P_CROSSBOW); }

export function is_ammo(otmp) { return +((otmp.oclass == WEAPON_CLASS || otmp.oclass == GEM_CLASS)
     && objects[otmp.otyp].oc_subtyp >= -P_CROSSBOW
     && objects[otmp.otyp].oc_subtyp <= -P_BOW); }

export function matching_launcher(a, l) { return (l && objects[a.otyp].oc_subtyp == -objects[l.otyp].oc_subtyp ? 1 : 0); }

export function ammo_and_launcher(a, l) { return (is_ammo(a) && matching_launcher(a, l) ? 1 : 0); }
export function is_missile(otmp) { return +((otmp.oclass == WEAPON_CLASS || otmp.oclass == TOOL_CLASS)
     && objects[otmp.otyp].oc_subtyp >= -P_BOOMERANG
     && objects[otmp.otyp].oc_subtyp <= -P_DART); }

export function is_weptool(o) { return +(o.oclass == TOOL_CLASS && objects[o.otyp].oc_subtyp != P_NONE); }

        /* towel is not a weptool:  spe isn't an enchantment, cursed towel
           doesn't weld to hand, and twoweapon won't work with one */
export function is_blunt_weapon(o) { return +((o.oclass == WEAPON_CLASS || is_weptool(o))
     && ((objects[o.otyp].oc_dir & WHACK) != 0)); }

export function is_wet_towel(o) { return +(o.otyp == TOWEL && o.spe > 0); }
export function bimanual(otmp) { return ((otmp.oclass == WEAPON_CLASS || otmp.oclass == TOOL_CLASS)
     && objects[otmp.otyp].oc_big ? 1 : 0); }

export function is_multigen(otmp) { return +(otmp.oclass == WEAPON_CLASS
     && objects[otmp.otyp].oc_subtyp >= -P_SHURIKEN
     && objects[otmp.otyp].oc_subtyp <= -P_BOW); }

export function is_poisonable(otmp) { return ((otmp.oclass == WEAPON_CLASS
      && objects[otmp.otyp].oc_subtyp >= -P_SHURIKEN
      && objects[otmp.otyp].oc_subtyp <= -P_BOW)
     || permapoisoned(otmp) ? 1 : 0); }

export function uslinging() { return (uwep && objects[uwep.otyp].oc_subtyp == P_SLING ? 1 : 0); }
/* 'is_quest_artifact()' only applies to the current role's artifact */
export function any_quest_artifact(o) { return +(o.oartifact >= ART_ORB_OF_DETECTION); }
/* 'missile' aspect is up to the caller and does not imply is_missile();
   rings might be launched as missiles when being scattered by an explosion */
export function stone_missile(o) { return +((objects[o.otyp].oc_material == GEMSTONE
             || (objects[o.otyp].oc_material == MINERAL))
         && o.oclass != RING_CLASS); }

/* Armor */
export function is_shield(otmp) { return +(otmp.oclass == ARMOR_CLASS
     && objects[otmp.otyp].oc_subtyp == ARM_SHIELD); }

export function is_helmet(otmp) { return +(otmp.oclass == ARMOR_CLASS && objects[otmp.otyp].oc_subtyp == ARM_HELM); }

export function is_boots(otmp) { return +(otmp.oclass == ARMOR_CLASS
     && objects[otmp.otyp].oc_subtyp == ARM_BOOTS); }

export function is_gloves(otmp) { return +(otmp.oclass == ARMOR_CLASS
     && objects[otmp.otyp].oc_subtyp == ARM_GLOVES); }

export function is_cloak(otmp) { return +(otmp.oclass == ARMOR_CLASS
     && objects[otmp.otyp].oc_subtyp == ARM_CLOAK); }

export function is_shirt(otmp) { return +(otmp.oclass == ARMOR_CLASS
     && objects[otmp.otyp].oc_subtyp == ARM_SHIRT); }

export function is_suit(otmp) { return +(otmp.oclass == ARMOR_CLASS && objects[otmp.otyp].oc_subtyp == ARM_SUIT); }

export function is_elven_armor(otmp) { return +(otmp.otyp == ELVEN_LEATHER_HELM
     || otmp.otyp == ELVEN_MITHRIL_COAT || otmp.otyp == ELVEN_CLOAK
     || otmp.otyp == ELVEN_SHIELD || otmp.otyp == ELVEN_BOOTS); }

export function stale_egg(egg) { return +((svm.moves - egg.age) > (2 * MAX_EGG_HATCH_TIME)); }

export function ofood(o) { return +(o.otyp == CORPSE || o.otyp == EGG || o.otyp == TIN); }
    /* note: sometimes eggs and tins have special corpsenm values that
       shouldn't be used as an index into mons[]                       */
export function polyfood(obj) { return (ofood(obj) && obj.corpsenm >= LOW_PM
     && (pm_to_cham(obj.corpsenm) != NON_PM
         || dmgtype(mons[obj.corpsenm], AD_POLY)) ? 1 : 0); }

export function mlevelgain(obj) { return +(ofood(obj) && obj.corpsenm == PM_WRAITH); }
export function mhealup(obj) { return +(ofood(obj) && obj.corpsenm == PM_NURSE); }
export function Is_pudding(o) { return +(o.otyp == GLOB_OF_GRAY_OOZE || o.otyp == GLOB_OF_BROWN_PUDDING
     || o.otyp == GLOB_OF_GREEN_SLIME || o.otyp == GLOB_OF_BLACK_PUDDING); }

/* Containers */
export function carried(o) { return +(o.where == OBJ_INVENT); }
export function mcarried(o) { return +(o.where == OBJ_MINVENT); }
export function Has_contents(o) { return (/* (Is_container(o) || (o)->otyp == STATUE) && */
     +(o.cobj != null)); }

export function Is_container(o) { return +(o.otyp >= LARGE_BOX && o.otyp <= BAG_OF_TRICKS); }
export function Is_box(o) { return +(o.otyp == LARGE_BOX || o.otyp == CHEST); }
export function Is_mbag(o) { return +(o.otyp == BAG_OF_HOLDING || o.otyp == BAG_OF_TRICKS); }
export function SchroedingersBox(o) { return +(o.otyp == LARGE_BOX && o.spe == 1); }
/* usually waterproof; random chance to be subjected to leakage if cursed;
   excludes statues, which aren't vulnerable to water even when cursed */
export function Waterproof_container(o) { return +(o.otyp == OILSKIN_SACK || o.otyp == ICE_BOX || Is_box(o)); }

/* dragon gear */
export function Is_dragon_scales(obj) { return +(obj.otyp >= GRAY_DRAGON_SCALES && obj.otyp <= YELLOW_DRAGON_SCALES); }

export function Is_dragon_mail(obj) { return +(obj.otyp >= GRAY_DRAGON_SCALE_MAIL
     && obj.otyp <= YELLOW_DRAGON_SCALE_MAIL); }

export function Is_dragon_armor(obj) { return +(Is_dragon_scales(obj) || Is_dragon_mail(obj)); }
export function Dragon_scales_to_pm(obj) { return elt(mons, PM_GRAY_DRAGON + obj.otyp - GRAY_DRAGON_SCALES); }

export function Dragon_mail_to_pm(obj) { return elt(mons, PM_GRAY_DRAGON + obj.otyp - GRAY_DRAGON_SCALE_MAIL); }

/* Elven gear */
export function is_elven_weapon(otmp) { return +(otmp.otyp == ELVEN_ARROW || otmp.otyp == ELVEN_SPEAR
     || otmp.otyp == ELVEN_DAGGER || otmp.otyp == ELVEN_SHORT_SWORD
     || otmp.otyp == ELVEN_BROADSWORD || otmp.otyp == ELVEN_BOW); }

/* Orcish gear */

/* Dwarvish gear */

/* Gnomish gear */

/* Light sources */
export function Is_candle(otmp) { return +(otmp.otyp == TALLOW_CANDLE || otmp.otyp == WAX_CANDLE); }

/* age field of this is relative age rather than absolute; does not include
   magic lamp */
export function age_is_relative(otmp) { return +(otmp.otyp == BRASS_LANTERN || otmp.otyp == OIL_LAMP
     || otmp.otyp == CANDELABRUM_OF_INVOCATION
     || otmp.otyp == TALLOW_CANDLE || otmp.otyp == WAX_CANDLE
     || otmp.otyp == POT_OIL); }

/* object can be ignited; magic lamp used to excluded here too but all
   usage of this macro ended up testing
     (ignitable(obj) || obj->otyp == MAGIC_LAMP)
   so include it; brass lantern can be lit but not by fire */
export function ignitable(otmp) { return +(otmp.otyp == BRASS_LANTERN || otmp.otyp == OIL_LAMP
     || (otmp.otyp == MAGIC_LAMP && otmp.spe > 0)
     || otmp.otyp == CANDELABRUM_OF_INVOCATION
     || otmp.otyp == TALLOW_CANDLE || otmp.otyp == WAX_CANDLE
     || otmp.otyp == POT_OIL); }

/* things that can be read */

/* special stones */
export function is_graystone(obj) { return +(obj.otyp == LUCKSTONE || obj.otyp == LOADSTONE
     || obj.otyp == FLINT || obj.otyp == TOUCHSTONE); }

/* misc helpers, simple enough to be macros */
export function is_flimsy(otmp) { return +(objects[otmp.otyp].oc_material <= LEATHER
     || otmp.otyp == RUBBER_HOSE); }

export function is_plural(o) { return +(o.quan != 1
     /* "the Eyes of the Overworld" are plural, but
        "a pair of lenses named the Eyes of the Overworld" is not */
     || (o.oartifact == ART_EYES_OF_THE_OVERWORLD
         && !undiscovered_artifact(ART_EYES_OF_THE_OVERWORLD))); }

export function pair_of(o) { return +(o.otyp == LENSES || is_gloves(o) || is_boots(o)); }

export function unpolyable(o) { return +(o.otyp == WAN_POLYMORPH
                       || o.otyp == SPE_POLYMORPH
                       || o.otyp == POT_POLYMORPH
                       || o.otyp == AMULET_OF_UNCHANGING); }

/* achievement tracking; 3.6.x did this differently */
export function is_mines_prize(o) { return +(o.o_id == svc.context.achieveo.mines_prize_oid); }
export function is_soko_prize(o) { return +(o.o_id == svc.context.achieveo.soko_prize_oid); }

/* is_art() is now a function in artifact.c */
/* #define is_art(o,art) ((o) && (o)->oartifact == (art)) */

export function u_wield_art(art) { return is_art(uwep, art); }

/* mummy wrappings are more versatile sizewise than other cloaks */
export function WrappingAllowed(mptr) { return +(humanoid(mptr) && mptr.msize >= MZ_SMALL && mptr.msize <= MZ_HUGE
     && !noncorporeal(mptr) && mptr.mlet != S_CENTAUR
     && mptr != mons[PM_WINGED_GARGOYLE] && mptr != mons[PM_MARILITH]); }

import { ART_EYES_OF_THE_OVERWORLD, ART_ORB_OF_DETECTION, ART_SNICKERSNEE } from "./artilist.h.js";
import {
    ARMOR_CLASS, GEM_CLASS, RING_CLASS, S_CENTAUR, TOOL_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { AD_POLY } from "./monattk.h.js";
import { humanoid, noncorporeal } from "./mondata.h.macros.js";
import { MZ_HUGE, MZ_SMALL } from "./monflag.h.js";
import {
    LOW_PM, NON_PM, PM_GRAY_DRAGON, PM_MARILITH, PM_NURSE, PM_WINGED_GARGOYLE, PM_WRAITH,
} from "./monsters.h.js";
import { MAX_EGG_HATCH_TIME, OBJ_INVENT, OBJ_MINVENT, struct_obj } from "./obj.h.js";
import {
    ARM_BOOTS, ARM_CLOAK, ARM_GLOVES, ARM_HELM, ARM_SHIELD, ARM_SHIRT, ARM_SUIT, GEMSTONE, LEATHER,
    MINERAL, WHACK,
} from "./objclass.h.js";
import {
    AMULET_OF_UNCHANGING, BAG_OF_HOLDING, BAG_OF_TRICKS, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION,
    CHEST, CORPSE, EGG, ELVEN_ARROW, ELVEN_BOOTS, ELVEN_BOW, ELVEN_BROADSWORD, ELVEN_CLOAK,
    ELVEN_DAGGER, ELVEN_LEATHER_HELM, ELVEN_MITHRIL_COAT, ELVEN_SHIELD, ELVEN_SHORT_SWORD,
    ELVEN_SPEAR, FLINT, GLOB_OF_BLACK_PUDDING, GLOB_OF_BROWN_PUDDING, GLOB_OF_GRAY_OOZE,
    GLOB_OF_GREEN_SLIME, GRAY_DRAGON_SCALES, GRAY_DRAGON_SCALE_MAIL, ICE_BOX, LARGE_BOX, LENSES,
    LOADSTONE, LUCKSTONE, MAGIC_LAMP, OILSKIN_SACK, OIL_LAMP, POT_OIL, POT_POLYMORPH, RUBBER_HOSE,
    SPE_POLYMORPH, TALLOW_CANDLE, TIN, TOUCHSTONE, TOWEL, WAN_POLYMORPH, WAX_CANDLE,
    YELLOW_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL,
} from "./objects.h.js";
import {
    P_AXE, P_BOOMERANG, P_BOW, P_CROSSBOW, P_DAGGER, P_DART, P_LANCE, P_NONE, P_PICK_AXE,
    P_POLEARMS, P_SABER, P_SHORT_SWORD, P_SHURIKEN, P_SLING, P_SPEAR,
} from "./skills.h.js";
import { sizeof } from "../rt/ctypes.js";
import { addr_of, elt, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { is_art, permapoisoned, undiscovered_artifact } from "./artifact.js";
import { svc, svm } from "./decl.js";
import { pm_to_cham } from "./mon.js";
import { dmgtype } from "./mondata.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
