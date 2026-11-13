/* NetHack 5.0	youprop.h	$NHDT-Date: 1725653018 2024/09/06 20:03:38 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.45 $ */
/* Copyright (c) 1989 Mike Threepoint                             */
/* NetHack may be freely redistributed.  See license for details. */

/* KMH, intrinsics patch.
 * Reorganized and rewritten for >32-bit properties.
 * HXxx refers to intrinsic bitfields while in human form.
 * EXxx refers to extrinsic bitfields from worn objects.
 * BXxx refers to the cause of the property being blocked.
 * Xxx refers to any source, including polymorph forms.
 * [Post-3.4.3: HXxx now includes a FROMFORM bit to handle
 * intrinsic conferred by being polymorphed.]
 */

/*** Resistances to troubles ***/
/* With intrinsics and extrinsics */
export function HFire_resistance() { return u.uprops[FIRE_RES].intrinsic; }
export function EFire_resistance() { return u.uprops[FIRE_RES].extrinsic; }
export function Fire_resistance() { return (HFire_resistance() || EFire_resistance() ? 1 : 0); }

export function HCold_resistance() { return u.uprops[COLD_RES].intrinsic; }
export function ECold_resistance() { return u.uprops[COLD_RES].extrinsic; }
export function Cold_resistance() { return (HCold_resistance() || ECold_resistance() ? 1 : 0); }

export function HSleep_resistance() { return u.uprops[SLEEP_RES].intrinsic; }
export function ESleep_resistance() { return u.uprops[SLEEP_RES].extrinsic; }
export function Sleep_resistance() { return (HSleep_resistance() || ESleep_resistance() ? 1 : 0); }

export function HDisint_resistance() { return u.uprops[DISINT_RES].intrinsic; }
export function EDisint_resistance() { return u.uprops[DISINT_RES].extrinsic; }
export function Disint_resistance() { return (HDisint_resistance() || EDisint_resistance() ? 1 : 0); }

export function HShock_resistance() { return u.uprops[SHOCK_RES].intrinsic; }
export function EShock_resistance() { return u.uprops[SHOCK_RES].extrinsic; }
export function Shock_resistance() { return (HShock_resistance() || EShock_resistance() ? 1 : 0); }

export function HPoison_resistance() { return u.uprops[POISON_RES].intrinsic; }
export function EPoison_resistance() { return u.uprops[POISON_RES].extrinsic; }
export function Poison_resistance() { return (HPoison_resistance() || EPoison_resistance() ? 1 : 0); }

export function HDrain_resistance() { return u.uprops[DRAIN_RES].intrinsic; }
export function EDrain_resistance() { return u.uprops[DRAIN_RES].extrinsic; }
export function Drain_resistance() { return (HDrain_resistance() || EDrain_resistance() ? 1 : 0); }

/* Hxxx due to FROMFORM only */
export function HAntimagic() { return u.uprops[ANTIMAGIC].intrinsic; }
export function EAntimagic() { return u.uprops[ANTIMAGIC].extrinsic; }
export function Antimagic() { return (HAntimagic() || EAntimagic() ? 1 : 0); }

export function HAcid_resistance() { return u.uprops[ACID_RES].intrinsic; }
export function EAcid_resistance() { return u.uprops[ACID_RES].extrinsic; }
export function Acid_resistance() { return (HAcid_resistance() || EAcid_resistance() ? 1 : 0); }

export function HStone_resistance() { return u.uprops[STONE_RES].intrinsic; }
export function EStone_resistance() { return u.uprops[STONE_RES].extrinsic; }
export function Stone_resistance() { return (HStone_resistance() || EStone_resistance() ? 1 : 0); }

export function HSick_resistance() { return u.uprops[SICK_RES].intrinsic; }
export function ESick_resistance() { return u.uprops[SICK_RES].extrinsic; }
export function Sick_resistance() { return (HSick_resistance() || ESick_resistance()
                         || defended(gy.youmonst, AD_DISE) ? 1 : 0); }

/* Intrinsics only */
export function Invulnerable() { return u.uprops[INVULNERABLE].intrinsic; }

/*** Troubles ***/
/* Pseudo-property */
export function Punished() { return +(uball != null); }

/* Many are implemented solely as timeouts (we use just intrinsic) */
export function HStun() { return u.uprops[STUNNED].intrinsic; }
export function Stunned() { return HStun(); }

export function HConfusion() { return u.uprops[CONFUSION].intrinsic; }
export function Confusion() { return HConfusion(); }

/* Blindness is more complex than other properties */
export function HBlinded() { return u.uprops[BLINDED].intrinsic; }
export function EBlinded() { return u.uprops[BLINDED].extrinsic; }
        /* wearing the Eyes of the Overworld overrides blindness */
export function BBlinded() { return u.uprops[BLINDED].blocked; }
        /* non-blindfold: timed effect | u.uroleplay.blind | !haseyes() */
export function Blinded() { return (HBlinded() && !BBlinded() ? 1 : 0); }
export function BlindedTimeout() { return (HBlinded() & TIMEOUT); }
export function PermaBlind() { return +((HBlinded() & FROMOUTSIDE) != 0); }
        /* worn blindfold (or towel; lenses don't set [BLINDED].extrinsic) */
export function Blindfolded() { return EBlinded(); }
export function Blindfolded_only() { return (Blindfolded() && !Blinded() ? 1 : 0); }
        /* '#define Blind (Blinded || Blindfolded)' would work, but only
           because BBlinded (conferred by artifact lenses) and Blindfolded
           are mutually exclusive; explicitly applying !BBlinded to both
           internal and external blindness should be more robust in case
           of future changes */
export function Blind() { return ((HBlinded() || EBlinded()) && !BBlinded() ? 1 : 0); }

/*
 * Maladies
 */
export function Sick() { return u.uprops[SICK].intrinsic; }
export function Stoned() { return u.uprops[STONED].intrinsic; }
export function Strangled() { return u.uprops[STRANGLED].intrinsic; }
export function Vomiting() { return u.uprops[VOMITING].intrinsic; }
export function Glib() { return u.uprops[GLIB].intrinsic; }
export function Slimed() { return u.uprops[SLIMED].intrinsic; }

/* Hallucination is solely a timeout */
export function HHallucination() { return u.uprops[HALLUC].intrinsic; }
export function HHalluc_resistance() { return u.uprops[HALLUC_RES].intrinsic; }
export function EHalluc_resistance() { return u.uprops[HALLUC_RES].extrinsic; }
export function Halluc_resistance() { return (HHalluc_resistance() || EHalluc_resistance() ? 1 : 0); }
export function Hallucination() { return (HHallucination() && !Halluc_resistance() ? 1 : 0); }

/* Timeout, plus a worn mask */
export function HDeaf() { return u.uprops[DEAF].intrinsic; }
export function EDeaf() { return u.uprops[DEAF].extrinsic; }
export function Deaf() { return (HDeaf() || EDeaf() || u.uroleplay.deaf ? 1 : 0); }

export function HFumbling() { return u.uprops[FUMBLING].intrinsic; }
export function EFumbling() { return u.uprops[FUMBLING].extrinsic; }
export function Fumbling() { return (HFumbling() || EFumbling() ? 1 : 0); }

/* HWounded_legs indicates whether wounded leg(s) condition exists and
   holds the timeout for recovery; EWounded_legs uses the worn-ring bits
   to track left vs right vs both and is meaningless when HWounded_legs
   is zero except when timeout has just decremented that to 0 and calls
   heal_legs(); both values apply to steed rather than to hero when riding */
export function HWounded_legs() { return u.uprops[WOUNDED_LEGS].intrinsic; }
export function EWounded_legs() { return u.uprops[WOUNDED_LEGS].extrinsic; }
export function Wounded_legs() { return (HWounded_legs() || EWounded_legs() ? 1 : 0); }

/* Sleepy: prone to falling asleep periodically; not necessarily asleep now */
export function HSleepy() { return u.uprops[SLEEPY].intrinsic; }
export function ESleepy() { return u.uprops[SLEEPY].extrinsic; }
export function Sleepy() { return (HSleepy() || ESleepy() ? 1 : 0); }

export function HHunger() { return u.uprops[HUNGER].intrinsic; }
export function EHunger() { return u.uprops[HUNGER].extrinsic; }
export function Hunger() { return (HHunger() || EHunger() ? 1 : 0); }

/*** Vision and senses ***/
export function HSee_invisible() { return u.uprops[SEE_INVIS].intrinsic; }
export function ESee_invisible() { return u.uprops[SEE_INVIS].extrinsic; }
export function See_invisible() { return (HSee_invisible() || ESee_invisible() ? 1 : 0); }

export function HTelepat() { return u.uprops[TELEPAT].intrinsic; }
export function ETelepat() { return u.uprops[TELEPAT].extrinsic; }
export function Blind_telepat() { return (HTelepat() || ETelepat() ? 1 : 0); }
export function Unblind_telepat() { return ETelepat(); }

export function HBlnd_resist() { return u.uprops[BLND_RES].intrinsic; }
export function EBlnd_resist() { return u.uprops[BLND_RES].extrinsic; }
export function Blnd_resist() { return (HBlnd_resist() || EBlnd_resist() ? 1 : 0); }

export function HWarning() { return u.uprops[WARNING].intrinsic; }
export function EWarning() { return u.uprops[WARNING].extrinsic; }
export function Warning() { return (HWarning() || EWarning() ? 1 : 0); }

/* Warning for a specific type of monster */
export function HWarn_of_mon() { return u.uprops[WARN_OF_MON].intrinsic; }
export function EWarn_of_mon() { return u.uprops[WARN_OF_MON].extrinsic; }
export function Warn_of_mon() { return (HWarn_of_mon() || EWarn_of_mon() ? 1 : 0); }

export function HUndead_warning() { return u.uprops[WARN_UNDEAD].intrinsic; }
export function Undead_warning() { return HUndead_warning(); }

export function HSearching() { return u.uprops[SEARCHING].intrinsic; }
export function ESearching() { return u.uprops[SEARCHING].extrinsic; }
export function Searching() { return (HSearching() || ESearching() ? 1 : 0); }

export function HClairvoyant() { return u.uprops[CLAIRVOYANT].intrinsic; }
export function EClairvoyant() { return u.uprops[CLAIRVOYANT].extrinsic; }
export function BClairvoyant() { return u.uprops[CLAIRVOYANT].blocked; }
export function Clairvoyant() { return ((HClairvoyant() || EClairvoyant()) && !BClairvoyant() ? 1 : 0); }

export function HInfravision() { return u.uprops[INFRAVISION].intrinsic; }
export function EInfravision() { return u.uprops[INFRAVISION].extrinsic; }
export function Infravision() { return (HInfravision() || EInfravision() ? 1 : 0); }

export function HDetect_monsters() { return u.uprops[DETECT_MONSTERS].intrinsic; }
export function EDetect_monsters() { return u.uprops[DETECT_MONSTERS].extrinsic; }
export function Detect_monsters() { return (HDetect_monsters() || EDetect_monsters() ? 1 : 0); }

/*** Appearance and behavior ***/
export function Adornment() { return u.uprops[ADORNED].extrinsic; }

export function HInvis() { return u.uprops[INVIS].intrinsic; }
export function EInvis() { return u.uprops[INVIS].extrinsic; }
export function BInvis() { return u.uprops[INVIS].blocked; }
export function Invis() { return ((HInvis() || EInvis()) && !BInvis() ? 1 : 0); }
export function Invisible() { return (Invis() && !See_invisible() ? 1 : 0); }
/* Note: invisibility also hides inventory and steed */

export function HDisplaced() { return u.uprops[DISPLACED].intrinsic; }
export function EDisplaced() { return u.uprops[DISPLACED].extrinsic; }
export function Displaced() { return (HDisplaced() || EDisplaced() ? 1 : 0); }

export function HStealth() { return u.uprops[STEALTH].intrinsic; }
export function EStealth() { return u.uprops[STEALTH].extrinsic; }
/* BStealth has FROMOUTSIDE set if mounted on non-flying steed */
export function BStealth() { return u.uprops[STEALTH].blocked; }
export function Stealth() { return ((HStealth() || EStealth()) && !BStealth() ? 1 : 0); }

export function HAggravate_monster() { return u.uprops[AGGRAVATE_MONSTER].intrinsic; }
export function EAggravate_monster() { return u.uprops[AGGRAVATE_MONSTER].extrinsic; }
export function Aggravate_monster() { return (HAggravate_monster() || EAggravate_monster() ? 1 : 0); }

export function HConflict() { return u.uprops[CONFLICT].intrinsic; }
export function EConflict() { return u.uprops[CONFLICT].extrinsic; }
export function Conflict() { return (HConflict() || EConflict() ? 1 : 0); }

/*** Transportation ***/
export function HJumping() { return u.uprops[JUMPING].intrinsic; }
export function EJumping() { return u.uprops[JUMPING].extrinsic; }
export function Jumping() { return (HJumping() || EJumping() ? 1 : 0); }

export function HTeleportation() { return u.uprops[TELEPORT].intrinsic; }
export function ETeleportation() { return u.uprops[TELEPORT].extrinsic; }
export function Teleportation() { return (HTeleportation() || ETeleportation() ? 1 : 0); }

export function HTeleport_control() { return u.uprops[TELEPORT_CONTROL].intrinsic; }
export function ETeleport_control() { return u.uprops[TELEPORT_CONTROL].extrinsic; }
export function Teleport_control() { return (HTeleport_control() || ETeleport_control() ? 1 : 0); }

/* HLevitation has I_SPECIAL set if levitating due to blessed potion
   which allows player to use the '>' command to end levitation early */
export function HLevitation() { return u.uprops[LEVITATION].intrinsic; }
export function ELevitation() { return u.uprops[LEVITATION].extrinsic; }
/* BLevitation has I_SPECIAL set if trapped in the floor,
   FROMOUTSIDE set if inside solid rock (or in water on Plane of Water) */
export function BLevitation() { return u.uprops[LEVITATION].blocked; }
export function Levitation() { return ((HLevitation() || ELevitation()) && !BLevitation() ? 1 : 0); }
/* Can't touch surface, can't go under water; overrides all others */
export function Lev_at_will() { return +(((HLevitation() & I_SPECIAL) != 0 || (ELevitation() & W_ARTI) != 0)
     && (HLevitation() & ~(I_SPECIAL | TIMEOUT)) == 0
     && (ELevitation() & ~W_ARTI) == 0); }

/* Flying is overridden by Levitation */
export function HFlying() { return u.uprops[FLYING].intrinsic; }
export function EFlying() { return u.uprops[FLYING].extrinsic; }
/* BFlying has I_SPECIAL set if levitating or trapped in the floor or both,
   FROMOUTSIDE set if inside solid rock (or in water on Plane of Water) */
export function BFlying() { return u.uprops[FLYING].blocked; }
export function Flying() { return ((HFlying() || EFlying() || (u.usteed && is_flyer(u.usteed.data)))
     && !BFlying() ? 1 : 0); }

/* May touch surface; does not override any others */

export function HWwalking() { return u.uprops[WWALKING].intrinsic; }
export function EWwalking() { return u.uprops[WWALKING].extrinsic; }
export function Wwalking() { return ((HWwalking() || EWwalking()) && !Is_waterlevel(u.uz) ? 1 : 0); }
/* Don't get wet, can't go under water; overrides others except levitation */
/* Wwalking is meaningless on water level */

export function HSwimming() { return u.uprops[SWIMMING].intrinsic; }
export function ESwimming() { return u.uprops[SWIMMING].extrinsic; }
export function Swimming() { return (HSwimming() || ESwimming() || (u.usteed && is_swimmer(u.usteed.data)) ? 1 : 0); }

/* Get wet, don't go under water unless if amphibious */

export function HMagical_breathing() { return u.uprops[MAGICAL_BREATHING].intrinsic; }
export function EMagical_breathing() { return u.uprops[MAGICAL_BREATHING].extrinsic; }
export function Amphibious() { return (HMagical_breathing() || EMagical_breathing() || amphibious(gy.youmonst.data) ? 1 : 0); }

/* Get wet, may go under surface */

export function Breathless() { return (HMagical_breathing() || EMagical_breathing() || breathless(gy.youmonst.data) ? 1 : 0); }

export function Underwater() { return u.uinwater; }
/* Note that Underwater and u.uinwater are both used in code.
   The latter form is for later implementation of other in-water
   states, like swimming, wading, etc. */

export function HPasses_walls() { return u.uprops[PASSES_WALLS].intrinsic; }
export function EPasses_walls() { return u.uprops[PASSES_WALLS].extrinsic; }
export function Passes_walls() { return (HPasses_walls() || EPasses_walls() ? 1 : 0); }

/*** Physical attributes ***/
export function HSlow_digestion() { return u.uprops[SLOW_DIGESTION].intrinsic; }
export function ESlow_digestion() { return u.uprops[SLOW_DIGESTION].extrinsic; }
export function Slow_digestion() { return (HSlow_digestion() || ESlow_digestion() ? 1 : 0); }

export function HHalf_spell_damage() { return u.uprops[HALF_SPDAM].intrinsic; }
export function EHalf_spell_damage() { return u.uprops[HALF_SPDAM].extrinsic; }
export function Half_spell_damage() { return (HHalf_spell_damage() || EHalf_spell_damage() ? 1 : 0); }

/*
 * Physical damage
 *
 * Damage is NOT physical damage if (in order of priority):
 * 1. it already qualifies for some other special category
 *    for which a special resistance already exists in the game
 *    including: cold, fire, shock, acid, and magic.
 *    Note that fire is extended to include all non-acid forms of
 *    burning, even boiling water since that is already dealt with
 *    by fire resistance, and in most or all cases is caused by fire.
 * 2. it doesn't leave a mark. Marks include destruction of, or
 *    damage to, an internal organ (including the brain),
 *    lacerations, bruises, crushed body parts, bleeding.
 *
 * The following were evaluated and determined _NOT_ to be
 * susceptible to Half_physical_damage protection:
 *   Being caught in a fireball                      [fire damage]
 *   Sitting in lava                                 [lava damage]
 *   Thrown potion (acid)                            [acid damage]
 *   Splattered burning oil from thrown potion       [fire damage]
 *   Mixing water and acid                           [acid damage]
 *   Molten lava (entering or being splashed)        [lava damage]
 *   boiling water from a sink                       [fire damage]
 *   Fire traps                                      [fire damage]
 *   Scrolls of fire (confused and otherwise)        [fire damage]
 *   Alchemical explosion                            [not physical]
 *   System shock                                    [shock damage]
 *   Bag of holding explosion                        [magical]
 *   Being undead-turned by your god                 [magical]
 *   Level-drain                                     [magical]
 *   Magical explosion of a magic trap               [magical]
 *   Sitting on a throne with a bad effect           [magical]
 *   Contaminated water from a sink                  [poison/sickness]
 *   Contact-poisoned spellbooks                     [poison/sickness]
 *   Eating acidic/poisonous/mildly-old corpses      [poison/sickness]
 *   Eating a poisoned weapon while polyselfed       [poison/sickness]
 *   Engulfing a zombie or mummy (AT_ENGL in hmonas) [poison/sickness]
 *   Quaffed potions of sickness, lit oil, acid      [poison/sickness]
 *   Pyrolisks' fiery gaze                           [fire damage]
 *   Any passive attack                              [most don't qualify]
 */

export function HHalf_physical_damage() { return u.uprops[HALF_PHDAM].intrinsic; }
export function EHalf_physical_damage() { return u.uprops[HALF_PHDAM].extrinsic; }
export function Half_physical_damage() { return (HHalf_physical_damage() || EHalf_physical_damage() ? 1 : 0); }

export function HRegeneration() { return u.uprops[REGENERATION].intrinsic; }
export function ERegeneration() { return u.uprops[REGENERATION].extrinsic; }
export function Regeneration() { return (HRegeneration() || ERegeneration() ? 1 : 0); }

export function HEnergy_regeneration() { return u.uprops[ENERGY_REGENERATION].intrinsic; }
export function EEnergy_regeneration() { return u.uprops[ENERGY_REGENERATION].extrinsic; }
export function Energy_regeneration() { return (HEnergy_regeneration() || EEnergy_regeneration() ? 1 : 0); }

export function HProtection() { return u.uprops[PROTECTION].intrinsic; }
export function EProtection() { return u.uprops[PROTECTION].extrinsic; }
export function Protection() { return (HProtection() || EProtection() ? 1 : 0); }

export function HProtection_from_shape_changers() { return u.uprops[PROT_FROM_SHAPE_CHANGERS].intrinsic; }

export function EProtection_from_shape_changers() { return u.uprops[PROT_FROM_SHAPE_CHANGERS].extrinsic; }

export function Protection_from_shape_changers() { return (HProtection_from_shape_changers() || EProtection_from_shape_changers() ? 1 : 0); }

export function HPolymorph() { return u.uprops[POLYMORPH].intrinsic; }
export function EPolymorph() { return u.uprops[POLYMORPH].extrinsic; }
export function Polymorph() { return (HPolymorph() || EPolymorph() ? 1 : 0); }

export function HPolymorph_control() { return u.uprops[POLYMORPH_CONTROL].intrinsic; }
export function EPolymorph_control() { return u.uprops[POLYMORPH_CONTROL].extrinsic; }
export function Polymorph_control() { return (HPolymorph_control() || EPolymorph_control() ? 1 : 0); }

export function HUnchanging() { return u.uprops[UNCHANGING].intrinsic; }
export function EUnchanging() { return u.uprops[UNCHANGING].extrinsic; }
export function Unchanging() { return (HUnchanging() || EUnchanging() ? 1 : 0); }

export function HFast() { return u.uprops[FAST].intrinsic; }
export function EFast() { return u.uprops[FAST].extrinsic; }
export function Fast() { return (HFast() || EFast() ? 1 : 0); }
export function Very_fast() { return ((HFast() & ~INTRINSIC) || EFast() ? 1 : 0); }

export function HReflecting() { return u.uprops[REFLECTING].intrinsic; }
export function EReflecting() { return u.uprops[REFLECTING].extrinsic; }
export function Reflecting() { return (HReflecting() || EReflecting() ? 1 : 0); }

export function Free_action() { return u.uprops[FREE_ACTION].extrinsic; }

export function Fixed_abil() { return u.uprops[FIXED_ABIL].extrinsic; }

export function Lifesaved() { return u.uprops[LIFESAVED].extrinsic; }

/*
 * Some pseudo-properties.
 */

/* the code will needs lots of updating to use this so leave it commented
#define Riding (u.usteed != NULL)
*/

/* unconscious() includes u.usleep but not is_fainted(); the multi test is
   redundant but allows the function calls to be skipped most of the time */
export function Unaware() { return (gm.multi < 0 && (unconscious() || is_fainted()) ? 1 : 0); }

export function Hate_silver() { return (u.ulycn >= LOW_PM || hates_silver(gy.youmonst.data) ? 1 : 0); }

/* _The_Hitchhikers_Guide_to_the_Galaxy_ on uses for 'towel': "wrap it round
   your head to ward off noxious fumes" [we require it to be damp or wet] */
export function Half_gas_damage() { return (ublindf && ublindf.otyp == TOWEL && ublindf.spe > 0 ? 1 : 0); }

import { Is_waterlevel } from "./dungeon.h.macros.js";
import { AD_DISE } from "./monattk.h.js";
import { amphibious, breathless, is_flyer, is_swimmer } from "./mondata.h.macros.js";
import { LOW_PM } from "./monsters.h.js";
import { TOWEL } from "./objects.h.js";
import {
    ACID_RES, ADORNED, AGGRAVATE_MONSTER, ANTIMAGIC, BLINDED, BLND_RES, CLAIRVOYANT, COLD_RES,
    CONFLICT, CONFUSION, DEAF, DETECT_MONSTERS, DISINT_RES, DISPLACED, DRAIN_RES,
    ENERGY_REGENERATION, FAST, FIRE_RES, FIXED_ABIL, FLYING, FREE_ACTION, FROMOUTSIDE, FUMBLING,
    GLIB, HALF_PHDAM, HALF_SPDAM, HALLUC, HALLUC_RES, HUNGER, INFRAVISION, INTRINSIC, INVIS,
    INVULNERABLE, I_SPECIAL, JUMPING, LEVITATION, LIFESAVED, MAGICAL_BREATHING, PASSES_WALLS,
    POISON_RES, POLYMORPH, POLYMORPH_CONTROL, PROTECTION, PROT_FROM_SHAPE_CHANGERS, REFLECTING,
    REGENERATION, SEARCHING, SEE_INVIS, SHOCK_RES, SICK, SICK_RES, SLEEPY, SLEEP_RES, SLIMED,
    SLOW_DIGESTION, STEALTH, STONED, STONE_RES, STRANGLED, STUNNED, SWIMMING, TELEPAT, TELEPORT,
    TELEPORT_CONTROL, TIMEOUT, UNCHANGING, VOMITING, WARNING, WARN_OF_MON, WARN_UNDEAD,
    WOUNDED_LEGS, WWALKING, W_ARTI,
} from "./prop.h.js";
import { gm, gy, u } from "./decl.js";
import { is_fainted } from "./eat.js";
import { defended, hates_silver } from "./mondata.js";
import { unconscious } from "./trap.js";
