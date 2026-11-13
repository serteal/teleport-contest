/* NetHack 5.0	display.h	$NHDT-Date: 1725653008 2024/09/06 20:03:28 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.106 $ */
/* Copyright (c) Dean Luick, with acknowledgements to Kevin Darcy */
/* and Dave Cohrs, 1990.                                          */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * vobj_at()
 *
 * Returns the head of the list of objects that the player can see
 * at location (x,y).  [Vestige of unimplemented invisible objects.]
 */
export function vobj_at(x, y) { return (svl.level.objects[x][y]); }

/*
 * sensemon()
 *
 * Returns true if the hero can sense the given monster.  This includes
 * monsters that are hiding or mimicking other monsters.
 *
 * [5.0] Note: the map doesn't display any monsters when hero is swallowed
 * (or display non-adjacent, non-submerged ones when hero is underwater),
 * so treat those situations as blocking telepathy, detection, and warning
 * even though conceptually they shouldn't do so.
 *
 * [5.0 also] The macros whose name begins with an underscore have been
 * converted to functions in order to have compilers generate smaller code.
 * The retained underscore versions are still used in display.c but should
 * only be used in other situations if the function calls actually produce
 * noticeably slower processing.
 */
export function _tp_sensemon(mon) { return (/* The hero can always sense a monster IF:        */
     /* 1. the monster has a brain to sense            */
     ((!mindless(mon.data))
     /* AND     2a. hero is blind and telepathic       */
      && ((Blind() && Blind_telepat())
          /* OR 2b. hero is using a telepathy inducing */
          /*        object and in range                */
          || (Unblind_telepat()
              && (mdistu(mon) <= u.unblind_telepat_range))) ? 1 : 0)); }

/* organized to perform cheaper tests first;
   is_pool() vs is_pool_or_lava(): hero who is underwater can see adjacent
   lava, but presumably any monster there is on top so not sensed */
export function _sensemon(mon) { return (   ((!u.uswallow || mon == u.ustuck)
     && (!Underwater() || (mdistu(mon) <= 2 && is_pool(mon.mx, mon.my)))
     && (Detect_monsters() || ((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range)))) || MATCH_WARN_OF_MON(mon)) ? 1 : 0)   ); }

/*
 * mon_warning() is used to warn of any dangerous monsters in your
 * vicinity, and a glyph representing the warning level is displayed.
 */
export function _mon_warning(mon) { return (Warning() && !mon.mpeaceful && (mdistu(mon) < 100)
     && (Math.trunc(mon.m_lev / 4) >= svc.context.warnlevel) ? 1 : 0); }

/*
 * mon_visible()
 *
 * Returns true if the hero can see the monster.  It is assumed that the
 * hero can physically see the location of the monster.  The function
 * vobj_at() returns a pointer to an object that the hero can see there.
 * Infravision is not taken into account.
 *
 * Note:  not reliable for concealed mimics.  They don't have
 * 'mon->mundetected' set even when mimicking objects or furniture.
 * [Fixing this with a pair of mon->m_ap_type checks here (via either
 * 'typ!=object && typ!=furniture' or 'typ==nothing || typ==monster')
 * will require reviewing every instance of mon_visible(), canseemon(),
 * canspotmon(), is_safemon() and perhaps others.  Fixing it by setting
 * mon->mundetected when concealed would be better but also require
 * reviewing all those instances and also existing mundetected instances.]
 */

export function _mon_visible(mon) { return (/* The hero can see the monster IF the monster                     */
     ((!mon.minvis || See_invisible())  /*     1. is not invisible        */
     && !mon.mundetected ? 1 : 0)); }

/*
 * see_with_infrared()
 *
 * This function is true if the player can see a monster using infravision.
 * The caller must check for invisibility (invisible monsters are also
 * invisible to infravision), because this is usually called from within
 * canseemon() or canspotmon() which already check that.
 */
export function _see_with_infrared(mon) { return (!Blind() && Infravision() && infravisible(mon.data)
     && couldsee(mon.mx, mon.my) ? 1 : 0); }

/*
 * canseemon()
 *
 * This is the globally used canseemon().  It is not called within the display
 * routines.  Like mon_visible(), but it checks to see if the hero sees the
 * location instead of assuming it.  (And also considers worms.)
 */
export function _canseemon(mon) { return ((mon.wormno ? worm_known(mon)
                  : (cansee(mon.mx, mon.my) || (((!Blind() && Infravision()) && infravisible(mon.data)) && couldsee(mon.mx, mon.my))))
     && ((!mon.minvis || See_invisible()) && !mon.mundetected) ? 1 : 0); }

/*
 * canspotmon(mon)
 *
 * This function checks whether you can either see a monster or sense it by
 * telepathy, and is what you usually call for monsters about which nothing is
 * known.
 */
export function canspotmon(mon) { return (canseemon(mon) || sensemon(mon) ? 1 : 0); }

/* knowninvisible(mon)
 * This one checks to see if you know a monster is both there and invisible.
 * 1) If you can see the monster and have see invisible, it is assumed the
 * monster is transparent, but visible in some manner.  (Earlier versions of
 * Nethack were really inconsistent on this.)
 * 2) If you can't see the monster, but can see its location and you have
 * telepathy that works when you can see, you can tell that there is a
 * creature in an apparently empty spot.
 * Infravision is not relevant; we assume that invisible monsters are also
 * invisible to infravision.
 * [5.0: the macro definition erroneously started with 'mtmp->minvis' for
 * over 20 years.  The one place it's used called it as knowninvisible(mtmp)
 * so worked by coincidence when there was no argument expansion involved
 * on the first line.]
 */
export function _knowninvisible(mon) { return (mon.minvis
     && ((cansee(mon.mx, mon.my)
          && (See_invisible() || Detect_monsters()))
         || (!Blind() && (HTelepat() & ~INTRINSIC)
             && mdistu(mon) <= (BOLT_LIM * BOLT_LIM))) ? 1 : 0); }

/*
 * is_safemon(mon)
 *
 * A special case check used in attack() and domove().  Placing the
 * definition here is convenient.  No longer limited to pets.
 */
export function _is_safemon(mon) { return (flags.safe_dog && mon.mpeaceful && (((mon.wormno ? worm_known(mon) : (cansee(mon.mx, mon.my) || (((!Blind() && Infravision()) && infravisible(mon.data)) && couldsee(mon.mx, mon.my)))) && ((!mon.minvis || See_invisible()) && !mon.mundetected)) || (((!u.uswallow || ((mon) == u.ustuck)) && (!Underwater() || ((mdistu(mon) <= 2) && is_pool((mon).mx, (mon).my)))) && ((Detect_monsters() || ((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range))))) || MATCH_WARN_OF_MON(mon))))
     && !Confusion() && !Hallucination() && !Stunned() ? 1 : 0); }

/*
 * canseeself()
 * senseself()
 * canspotself()
 *
 * This returns true if the hero can see her/himself.
 *
 * Sensing yourself by touch is treated as seeing yourself, even if
 * unable to see.  So when blind, being invisible won't affect your
 * self-perception, and when swallowed, the enclosing monster touches.
 */
export function canseeself() { return (Blind() || u.uswallow || (!Invisible() && !u.uundetected) ? 1 : 0); }
export function senseself() { return (Unblind_telepat() || Detect_monsters() ? 1 : 0); }
export function canspotself() { return (canseeself() || senseself() ? 1 : 0); }

/*
 * random_monster()
 * random_object()
 *
 * Respectively return a random monster or object.
 * random_object() won't return STRANGE_OBJECT or the generic objects.
 * -/+ FIRST_OBJECT is used to skip it and them.
 */
export function random_monster(rng) { return rng(NUMMONS); }
export function random_object(rng) { return (rng(NUM_OBJECTS - FIRST_OBJECT) + FIRST_OBJECT); }

/*
 * what_obj()
 * what_mon()
 *
 * If hallucinating, choose a random object/monster, otherwise, use the one
 * given. Use the given rng to handle hallucination.
 */

export function what_mon(mon, rng) { return (Hallucination() ? random_monster(rng) : mon); }

/*
 * newsym_rn2
 *
 * An appropriate random number generator for use with newsym(), when
 * randomness is needed there. This is currently hardcoded as
 * rn2_on_display_rng, but is futureproofed for cases where we might
 * want to prevent display-random objects entering the character's
 * memory (this isn't important at present but may be if we need
 * reproducible gameplay for some reason).
 */
export const newsym_rn2 = rn2_on_display_rng;

/*
 * covers_objects()
 * covers_traps()
 *
 * These routines are true if what is really at the given location will
 * "cover" any objects or traps that might be there.
 */
export function covers_objects(xx, yy) { return ((is_pool(xx, yy) && !Underwater()) || (levl()[xx][yy].typ == LAVAPOOL)
      || (levl()[xx][yy].typ == LAVAWALL) ? 1 : 0); }

export function covers_traps(xx, yy) { return covers_objects(xx, yy); }

/*
 * display_self()
 *
 * Display the hero.  It is assumed that all checks necessary to determine
 * _if_ the hero can be seen have already been done.
 */

export function display_self() { return show_glyph(u.ux, u.uy, ((u.usteed && mon_visible(u.usteed)) ? ridden_mon_to_glyph(u.usteed, rn2_on_display_rng) : ((U_AP_TYPE() == M_AP_NOTHING)
        ? hero_glyph()
        : (U_AP_TYPE() == M_AP_FURNITURE)
          ? cmap_to_glyph(int(gy.youmonst.mappearance))
          : (U_AP_TYPE() == M_AP_OBJECT)
            ? objnum_to_glyph(int(gy.youmonst.mappearance))
            /* else U_AP_TYPE == M_AP_MONSTER */
            : monnum_to_glyph(int(gy.youmonst.mappearance), Ugender())))); }

export function warning_to_glyph(mwarnlev) { return (mwarnlev + GLYPH_WARNING_OFF); }
export function mon_to_glyph(mon, rng) { return ((Hallucination() ? random_monster(rng) : monsndx(mon.data))
     + ((mon.female == 0) ?  GLYPH_MON_MALE_OFF : GLYPH_MON_FEM_OFF)); }

export function detected_mon_to_glyph(mon, rng) { return ((Hallucination() ? random_monster(rng) : monsndx(mon.data))
     + ((mon.female == 0) ?  GLYPH_DETECT_MALE_OFF : GLYPH_DETECT_FEM_OFF)); }

export function ridden_mon_to_glyph(mon, rng) { return ((Hallucination() ? random_monster(rng) : monsndx(mon.data))
     + ((mon.female == 0) ?  GLYPH_RIDDEN_MALE_OFF : GLYPH_RIDDEN_FEM_OFF)); }

export function pet_to_glyph(mon, rng) { return ((Hallucination() ? random_monster(rng) : monsndx(mon.data))
     + ((mon.female == 0) ? GLYPH_PET_MALE_OFF : GLYPH_PET_FEM_OFF)); }

/* treat unaligned as the default instead of explicitly checking for it;
   altar alignment uses 3 bits with 4 defined values and 4 unused ones */
export function altar_to_glyph(amsk) { return (((amsk & AM_SANCTUM) == AM_SANCTUM)
      ? (GLYPH_ALTAR_OFF + altar_other)
      : ((amsk & AM_MASK) == AM_LAWFUL)
         ? (GLYPH_ALTAR_OFF + altar_lawful)
         : ((amsk & AM_MASK) == AM_NEUTRAL)
            ? (GLYPH_ALTAR_OFF + altar_neutral)
            : ((amsk & AM_MASK) == AM_CHAOTIC)
               ? (GLYPH_ALTAR_OFF + altar_chaotic)
               /* (((amsk) & AM_MASK) == AM_UNALIGNED) */
               : (GLYPH_ALTAR_OFF + altar_unaligned)); }

/* not used, nor is it correct
#define zap_to_glyph(zaptype, cmap_idx) \
    ((((cmap_idx) - S_vbeam) + 1) + GLYPH_ZAP_OFF)
*/

/* EXPL_FIERY is the default explosion type */
export function explosion_to_glyph(expltyp, idx) { return (idx - S_expl_tl
     + ((expltyp == EXPL_FROSTY) ? GLYPH_EXPLODE_FROSTY_OFF
        : (expltyp == EXPL_MAGICAL) ? GLYPH_EXPLODE_MAGICAL_OFF
          : (expltyp == EXPL_WET) ? GLYPH_EXPLODE_WET_OFF
           : (expltyp == EXPL_MUDDY) ? GLYPH_EXPLODE_MUDDY_OFF
             : (expltyp == EXPL_NOXIOUS) ? GLYPH_EXPLODE_NOXIOUS_OFF
               : GLYPH_EXPLODE_FIERY_OFF)); }

/* cmap_walls_to_glyph(): return the glyph number for specified wall
   symbol; result varies by dungeon branch */
export function cmap_walls_to_glyph(cmap_idx) { return (cmap_idx - S_vwall
     + (In_mines(u.uz) ? GLYPH_CMAP_MINES_OFF
        : In_hell(u.uz) ? GLYPH_CMAP_GEH_OFF
          : Is_knox(u.uz) ? GLYPH_CMAP_KNOX_OFF
            : In_sokoban(u.uz) ? GLYPH_CMAP_SOKO_OFF
              : GLYPH_CMAP_MAIN_OFF)); }

/* cmap_D0walls_to_glyph(): simpler version of cmap_walls_to_glyph()
   which returns the glyph that would be used in the main dungeon,
   regardless of hero's current location */

export function cmap_a_to_glyph(cmap_idx) { return ((cmap_idx - S_ndoor) + GLYPH_CMAP_A_OFF); }

export function cmap_b_to_glyph(cmap_idx) { return ((cmap_idx - S_grave) + GLYPH_CMAP_B_OFF); }

export function cmap_c_to_glyph(cmap_idx) { return ((cmap_idx - S_digbeam) + GLYPH_CMAP_C_OFF); }

export function cmap_to_glyph(cmap_idx) { return ( (cmap_idx == S_stone)   ? GLYPH_CMAP_STONE_OFF
    : (cmap_idx <= S_trwall)  ? cmap_walls_to_glyph(cmap_idx)
    : (cmap_idx <  S_altar)   ? cmap_a_to_glyph(cmap_idx)
    : (cmap_idx == S_altar)   ? altar_to_glyph(AM_NEUTRAL)
    : (cmap_idx <  S_arrow_trap + MAXTCHARS) ? cmap_b_to_glyph(cmap_idx)
    : (cmap_idx <= S_goodpos) ? cmap_c_to_glyph(cmap_idx)
      : NO_GLYPH ); }

export function trap_to_glyph(trap) { return cmap_to_glyph(trap_to_defsym(trap.ttyp)); }

export function engraving_to_glyph(ep) { return cmap_to_glyph(engraving_to_defsym(ep)); }

/* Not affected by hallucination.  Gives a generic body for CORPSE */
/* MRKR: ...and the generic statue */
export function objnum_to_glyph(onum) { return (onum + GLYPH_OBJ_OFF); }
export function monnum_to_glyph(mnum, gnd) { return (mnum + ((gnd == MALE) ? GLYPH_MON_MALE_OFF
                                     : GLYPH_MON_FEM_OFF)); }

export function detected_monnum_to_glyph(mnum, gnd) { return (mnum + ((gnd == MALE) ? GLYPH_DETECT_MALE_OFF
                                     : GLYPH_DETECT_FEM_OFF)); }

export function petnum_to_glyph(mnum, gnd) { return (mnum + ((gnd == MALE) ? GLYPH_PET_MALE_OFF
                                     : GLYPH_PET_FEM_OFF)); }

/* The hero's glyph when seen as a monster.
 */
export function hero_glyph() { return monnum_to_glyph((Upolyd() || !flags.showrace) ? u.umonnum : gu.urace.mnum,
                    Ugender()); }

/*
 * Change the given glyph into its given type.  Note:
 *      1) Pets, detected, and ridden monsters are animals and are converted
 *         to the proper monster number.
 *      2) Bodies are all mapped into the generic CORPSE object
 *      3) If handed a glyph out of range for the type, these functions
 *         will return NO_GLYPH (see exception below)
 *      4) glyph_to_swallow() does not return a showsyms[] index, but an
 *         offset from the first swallow symbol.  If handed something
 *         out of range, it will return zero (for lack of anything better
 *         to return).
 */

export function glyph_to_trap(glyph) { return (glyph_is_trap(glyph)
        ? defsym_to_trap((glyph - GLYPH_TRAP_OFF) + S_arrow_trap)
        : NO_GLYPH); }

export function glyph_is_cmap_main(glyph) { return +(glyph >= GLYPH_CMAP_MAIN_OFF
     && glyph < (((S_trwall - S_vwall) +1) + GLYPH_CMAP_MAIN_OFF)); }

export function glyph_is_cmap_mines(glyph) { return +(glyph >= GLYPH_CMAP_MINES_OFF
     && glyph < (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_MINES_OFF)); }

export function glyph_is_cmap_gehennom(glyph) { return +(glyph >= GLYPH_CMAP_GEH_OFF
     && glyph < (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_GEH_OFF)); }

export function glyph_is_cmap_knox(glyph) { return +(glyph >= GLYPH_CMAP_KNOX_OFF
     && glyph < (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_KNOX_OFF)); }

export function glyph_is_cmap_sokoban(glyph) { return +(glyph >= GLYPH_CMAP_SOKO_OFF
     && glyph < (((S_trwall - S_vwall) + 1) + GLYPH_CMAP_SOKO_OFF)); }

export function glyph_is_cmap_a(glyph) { return +(glyph >= GLYPH_CMAP_A_OFF
     && glyph < (((S_brdnladder - S_ndoor) + 1) + GLYPH_CMAP_A_OFF)); }

export function glyph_is_cmap_altar(glyph) { return +(glyph >= GLYPH_ALTAR_OFF && glyph < (5 + GLYPH_ALTAR_OFF)); }

export function glyph_is_cmap_b(glyph) { return +(glyph >= GLYPH_CMAP_B_OFF
     && (glyph < ((S_arrow_trap + MAXTCHARS - S_grave) + GLYPH_CMAP_B_OFF))); }

export function glyph_is_cmap_zap(glyph) { return +(glyph >= GLYPH_ZAP_OFF && glyph < ((NUM_ZAP << 2) + GLYPH_ZAP_OFF)); }

export function glyph_is_cmap_c(glyph) { return +(glyph >= GLYPH_CMAP_C_OFF
     && glyph < (((S_goodpos - S_digbeam) + 1) + GLYPH_CMAP_C_OFF)); }

export function glyph_is_swallow(glyph) { return +(glyph >= GLYPH_SWALLOW_OFF
     && glyph < ((NUMMONS << 3) + GLYPH_SWALLOW_OFF)); }

export function glyph_is_explosion(glyph) { return +(glyph >= GLYPH_EXPLODE_OFF
     && glyph < (MAXEXPCHARS + GLYPH_EXPLODE_FROSTY_OFF)); }

export function glyph_is_cmap(glyph) { return +(glyph >= GLYPH_CMAP_STONE_OFF
     && glyph < (GLYPH_CMAP_C_OFF + ((S_goodpos - S_digbeam) + 1))); }

export function glyph_to_swallow(glyph) { return (glyph_is_swallow(glyph) ? ((glyph - GLYPH_SWALLOW_OFF) & 0x7) : 0); }

export function glyph_to_explosion(glyph) { return (glyph_is_explosion(glyph) ? ((glyph - GLYPH_EXPLODE_OFF) % (S_expl_br - S_expl_tl + 1)) : 0); }

export function glyph_to_warning(glyph) { return (glyph_is_warning(glyph) ? (glyph - GLYPH_WARNING_OFF) : 0); }

/*
 * Return true if the given glyph is what we want.  Note that bodies are
 * considered objects.
 */
export function glyph_is_normal_male_monster(glyph) { return +(glyph >= GLYPH_MON_MALE_OFF
     && glyph < (GLYPH_MON_MALE_OFF + NUMMONS)); }

export function glyph_is_normal_female_monster(glyph) { return +(glyph >= GLYPH_MON_FEM_OFF && glyph < (GLYPH_MON_FEM_OFF + NUMMONS)); }

export function glyph_is_normal_monster(glyph) { return +(glyph_is_normal_male_monster(glyph)
     || glyph_is_normal_female_monster(glyph)); }

export function glyph_is_female_pet(glyph) { return +(glyph >= GLYPH_PET_FEM_OFF && glyph < (GLYPH_PET_FEM_OFF + NUMMONS)); }

export function glyph_is_male_pet(glyph) { return +(glyph >= GLYPH_PET_MALE_OFF
     && glyph < (GLYPH_PET_MALE_OFF + NUMMONS)); }

export function glyph_is_pet(glyph) { return +(glyph_is_male_pet(glyph) || glyph_is_female_pet(glyph)); }

export function glyph_is_ridden_female_monster(glyph) { return +(glyph >= GLYPH_RIDDEN_FEM_OFF
     && glyph < (GLYPH_RIDDEN_FEM_OFF + NUMMONS)); }

export function glyph_is_ridden_male_monster(glyph) { return +(glyph >= GLYPH_RIDDEN_MALE_OFF
     && glyph < (GLYPH_RIDDEN_MALE_OFF + NUMMONS)); }

export function glyph_is_ridden_monster(glyph) { return +(glyph_is_ridden_male_monster(glyph)
     || glyph_is_ridden_female_monster(glyph)); }

export function glyph_is_detected_female_monster(glyph) { return +(glyph >= GLYPH_DETECT_FEM_OFF
     && glyph < (GLYPH_DETECT_FEM_OFF + NUMMONS)); }

export function glyph_is_detected_male_monster(glyph) { return +(glyph >= GLYPH_DETECT_MALE_OFF
     && glyph < (GLYPH_DETECT_MALE_OFF + NUMMONS)); }

export function glyph_is_detected_monster(glyph) { return +(glyph_is_detected_male_monster(glyph)
        || glyph_is_detected_female_monster(glyph)); }

export function glyph_is_monster(glyph) { return +(glyph_is_normal_monster(glyph) || glyph_is_pet(glyph)
     || glyph_is_ridden_monster(glyph) || glyph_is_detected_monster(glyph)); }

export function glyph_is_invisible(glyph) { return +(glyph == GLYPH_INVISIBLE); }

/* final NUMMONS is legal array index because of trailing fencepost entry */
export function glyph_to_mon(glyph) { return (glyph_is_normal_female_monster(glyph)
         ? (glyph - GLYPH_MON_FEM_OFF)
         : glyph_is_normal_male_monster(glyph)
           ? (glyph - GLYPH_MON_MALE_OFF)
           : glyph_is_female_pet(glyph)
             ? (glyph - GLYPH_PET_FEM_OFF)
             : glyph_is_male_pet(glyph)
               ? (glyph - GLYPH_PET_MALE_OFF)
               : glyph_is_detected_female_monster(glyph)
                 ? (glyph - GLYPH_DETECT_FEM_OFF)
                 : glyph_is_detected_male_monster(glyph)
                   ? (glyph - GLYPH_DETECT_MALE_OFF)
                   : glyph_is_ridden_female_monster(glyph)
                     ? (glyph - GLYPH_RIDDEN_FEM_OFF)
                     : glyph_is_ridden_male_monster(glyph)
                       ? (glyph - GLYPH_RIDDEN_MALE_OFF)
                       : NUMMONS); }

/* boulder hides pile except when on top of another boulder;
   the otg_otmp assignment might occur multiple times in the same
   expression but there will always be sequence points in between */
export function obj_is_piletop(obj) { return +(obj.where == OBJ_FLOOR
     && ((go.otg_otmp = svl.level.objects[obj.ox][obj.oy].v.v_nexthere)
         != null)
     && (obj.otyp != BOULDER || go.otg_otmp.otyp == BOULDER)); }

/* used to hide info such as potion and gem color when not seen yet;
   stones and rock are excluded for gem class; LAST_SPELL includes blank
   spellbook but excludes novel and the Book of the Dead */
export function obj_is_generic(obj) { return +(!obj.dknown
     && (obj.oclass == POTION_CLASS
         || (obj.otyp >= FIRST_REAL_GEM
             && (obj.otyp <= LAST_GLASS_GEM))
         || (obj.otyp >= FIRST_SPELL
             && (obj.otyp <= LAST_SPELL)))); }

export function glyph_is_body_piletop(glyph) { return +((glyph >= GLYPH_BODY_PILETOP_OFF)
     && (glyph < (GLYPH_BODY_PILETOP_OFF + NUMMONS))); }

export function glyph_is_body(glyph) { return +(((glyph >= GLYPH_BODY_OFF) && (glyph < (GLYPH_BODY_OFF + NUMMONS)))
     || glyph_is_body_piletop(glyph)); }

export function glyph_is_fem_statue_piletop(glyph) { return +((glyph >= GLYPH_STATUE_FEM_PILETOP_OFF)
      && (glyph < (GLYPH_STATUE_FEM_PILETOP_OFF + NUMMONS))); }

export function glyph_is_male_statue_piletop(glyph) { return +((glyph >= GLYPH_STATUE_MALE_PILETOP_OFF)
         && (glyph < (GLYPH_STATUE_MALE_PILETOP_OFF + NUMMONS))); }

export function glyph_is_fem_statue(glyph) { return +(((glyph >= GLYPH_STATUE_FEM_OFF)
      && (glyph < (GLYPH_STATUE_FEM_OFF + NUMMONS)))
     || glyph_is_fem_statue_piletop(glyph)); }

export function glyph_is_male_statue(glyph) { return +(((glyph >= GLYPH_STATUE_MALE_OFF)
      && (glyph < (GLYPH_STATUE_MALE_OFF + NUMMONS)))
     || glyph_is_male_statue_piletop(glyph)); }

export function glyph_is_statue(glyph) { return +(glyph_is_male_statue(glyph) || glyph_is_fem_statue(glyph)); }

/* generic objects are after strange object (GLYPH_OBJ_OFF) and before
   other objects (GLYPH_OBJ_OFF + FIRST_OBJECT) */
export function glyph_is_normal_generic_obj(glyph) { return +(glyph > GLYPH_OBJ_OFF && glyph < GLYPH_OBJ_OFF + FIRST_OBJECT - 1); }

export function glyph_is_piletop_generic_obj(glyph) { return +(glyph > GLYPH_OBJ_PILETOP_OFF
     && glyph < GLYPH_OBJ_PILETOP_OFF + FIRST_OBJECT - 1); }

export function glyph_is_generic_object(glyph) { return +(glyph_is_normal_generic_obj(glyph)
     || glyph_is_piletop_generic_obj(glyph)); }

export function glyph_is_normal_piletop_obj(glyph) { return +(glyph == GLYPH_OBJ_PILETOP_OFF
     || (glyph > GLYPH_OBJ_PILETOP_OFF + FIRST_OBJECT - 1
         && glyph < (GLYPH_OBJ_PILETOP_OFF + NUM_OBJECTS))); }

export function glyph_is_normal_object(glyph) { return +(glyph == GLYPH_OBJ_OFF
     || (glyph >= GLYPH_OBJ_OFF + FIRST_OBJECT - 1
         && glyph < (GLYPH_OBJ_OFF + NUM_OBJECTS))
     || glyph_is_normal_piletop_obj(glyph)); }

export function glyph_is_object(glyph) { return +(glyph_is_normal_object(glyph) || glyph_is_generic_object(glyph)
     || glyph_is_statue(glyph) || glyph_is_body(glyph)); }

/* briefly used for Qt's "paper doll" inventory which shows map tiles for
   equipped objects; those vary like floor items during hallucination now
   so this isn't used anywhere [note: out of date since generic objs added] */

/* final NUM_OBJECTS is legal array idx because of trailing fencepost entry */
export function glyph_to_obj(glyph) { return (glyph_is_body(glyph) ? CORPSE
     : glyph_is_statue(glyph) ? STATUE
       : glyph_is_generic_object(glyph)
         ? (glyph - (glyph_is_piletop_generic_obj(glyph)
                       ? GLYPH_OBJ_PILETOP_OFF
                       : GLYPH_OBJ_OFF))
         : glyph_is_normal_object(glyph)
           ? (glyph - (glyph_is_normal_piletop_obj(glyph)
                         ? GLYPH_OBJ_PILETOP_OFF
                         : GLYPH_OBJ_OFF))
           : NUM_OBJECTS); }

export function glyph_to_body_corpsenm(glyph) { return (glyph_is_body_piletop(glyph)
       ? (glyph - GLYPH_BODY_PILETOP_OFF)
       : (glyph - GLYPH_BODY_OFF)); }

export function glyph_to_statue_corpsenm(glyph) { return (glyph_is_fem_statue_piletop(glyph)
       ? (glyph - GLYPH_STATUE_FEM_PILETOP_OFF)
       : glyph_is_male_statue_piletop(glyph)
           ? (glyph - GLYPH_STATUE_MALE_PILETOP_OFF)
           : glyph_is_fem_statue(glyph)
               ? (glyph - GLYPH_STATUE_FEM_OFF)
               : glyph_is_male_statue(glyph)
                   ? (glyph - GLYPH_STATUE_MALE_OFF)
                   : NO_GLYPH); }

/* This has the unfortunate side effect of needing a global variable
   to store a result. 'otg_temp' is defined and declared in decl.{ch}.  */
export function random_obj_to_glyph(rng) { return ((int(go.otg_temp = random_object(rng)) == CORPSE)
         ? (random_monster(rng) + GLYPH_BODY_OFF)
         : (go.otg_temp + GLYPH_OBJ_OFF)); }

export function corpse_to_glyph(obj) { return (obj.corpsenm
          + (obj_is_piletop(obj) ? GLYPH_BODY_PILETOP_OFF : GLYPH_BODY_OFF)); }

export function generic_obj_to_glyph(obj) { return (obj.oclass
            + (obj_is_piletop(obj) ? GLYPH_OBJ_PILETOP_OFF : GLYPH_OBJ_OFF)); }

export function normal_obj_to_glyph(obj) { return (obj.otyp
            + (obj_is_piletop(obj) ? GLYPH_OBJ_PILETOP_OFF : GLYPH_OBJ_OFF)); }

/* MRKR: Statues now have glyphs corresponding to the monster they    */
/*       represent and look like monsters when you are hallucinating. */

export function statue_to_glyph(obj, rng) { return (Hallucination()
     ? (random_monster(rng)
        + ((!rng(2)) ? GLYPH_MON_MALE_OFF : GLYPH_MON_FEM_OFF))
     : (obj.corpsenm
        + (((obj.spe & CORPSTAT_GENDER) == CORPSTAT_FEMALE)
           ? (obj_is_piletop(obj)
              ? GLYPH_STATUE_FEM_PILETOP_OFF
              : GLYPH_STATUE_FEM_OFF)
           : (obj_is_piletop(obj)
              ? GLYPH_STATUE_MALE_PILETOP_OFF
              : GLYPH_STATUE_MALE_OFF)))); }

export function obj_to_glyph(obj, rng) { return ((obj.otyp == STATUE) ? statue_to_glyph(obj, rng)
     : Hallucination() ? random_obj_to_glyph(rng)
       : (obj.otyp == CORPSE) ? corpse_to_glyph(obj)
         : obj_is_generic(obj) ? generic_obj_to_glyph(obj)
           : normal_obj_to_glyph(obj)); }

export function glyph_is_trap(glyph) { return +(glyph >= GLYPH_TRAP_OFF
     && glyph < (GLYPH_TRAP_OFF + MAXTCHARS)); }

export function glyph_is_warning(glyph) { return +(glyph >= GLYPH_WARNING_OFF
     && glyph < (GLYPH_WARNING_OFF + WARNCOUNT)); }

export function glyph_is_unexplored(glyph) { return +(glyph == GLYPH_UNEXPLORED); }
export function glyph_is_nothing(glyph) { return +(glyph == GLYPH_NOTHING); }

import { AM_CHAOTIC, AM_LAWFUL, AM_MASK, AM_NEUTRAL, AM_SANCTUM } from "./align.h.js";
import {
    POTION_CLASS, S_altar, S_arrow_trap, S_brdnladder, S_digbeam, S_expl_br, S_expl_tl, S_goodpos,
    S_grave, S_ndoor, S_stone, S_trwall, S_vwall,
} from "./defsym.h.js";
import {
    EXPL_FROSTY, EXPL_MAGICAL, EXPL_MUDDY, EXPL_NOXIOUS, EXPL_WET, GLYPH_ALTAR_OFF, GLYPH_BODY_OFF,
    GLYPH_BODY_PILETOP_OFF, GLYPH_CMAP_A_OFF, GLYPH_CMAP_B_OFF, GLYPH_CMAP_C_OFF,
    GLYPH_CMAP_GEH_OFF, GLYPH_CMAP_KNOX_OFF, GLYPH_CMAP_MAIN_OFF, GLYPH_CMAP_MINES_OFF,
    GLYPH_CMAP_SOKO_OFF, GLYPH_CMAP_STONE_OFF, GLYPH_DETECT_FEM_OFF, GLYPH_DETECT_MALE_OFF,
    GLYPH_EXPLODE_FIERY_OFF, GLYPH_EXPLODE_FROSTY_OFF, GLYPH_EXPLODE_MAGICAL_OFF,
    GLYPH_EXPLODE_MUDDY_OFF, GLYPH_EXPLODE_NOXIOUS_OFF, GLYPH_EXPLODE_OFF, GLYPH_EXPLODE_WET_OFF,
    GLYPH_INVISIBLE, GLYPH_MON_FEM_OFF, GLYPH_MON_MALE_OFF, GLYPH_NOTHING, GLYPH_OBJ_OFF,
    GLYPH_OBJ_PILETOP_OFF, GLYPH_PET_FEM_OFF, GLYPH_PET_MALE_OFF, GLYPH_RIDDEN_FEM_OFF,
    GLYPH_RIDDEN_MALE_OFF, GLYPH_STATUE_FEM_OFF, GLYPH_STATUE_FEM_PILETOP_OFF,
    GLYPH_STATUE_MALE_OFF, GLYPH_STATUE_MALE_PILETOP_OFF, GLYPH_SWALLOW_OFF, GLYPH_TRAP_OFF,
    GLYPH_UNEXPLORED, GLYPH_WARNING_OFF, GLYPH_ZAP_OFF, NO_GLYPH, NUM_ZAP, altar_chaotic,
    altar_lawful, altar_neutral, altar_other, altar_unaligned,
} from "./display.h.js";
import { In_sokoban, Is_knox } from "./dungeon.h.macros.js";
import { engraving_to_defsym } from "./engrave.h.macros.js";
import { BOLT_LIM, CORPSTAT_FEMALE, CORPSTAT_GENDER } from "./hack.h.js";
import { MATCH_WARN_OF_MON, mdistu } from "./hack.h.macros.js";
import { infravisible, mindless, monsndx } from "./mondata.h.macros.js";
import { MALE } from "./monflag.h.js";
import { M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT } from "./monst.h.js";
import { U_AP_TYPE } from "./monst.h.macros.js";
import { NUMMONS } from "./monsters.h.js";
import { OBJ_FLOOR } from "./obj.h.js";
import {
    BOULDER, CORPSE, FIRST_OBJECT, FIRST_REAL_GEM, FIRST_SPELL, LAST_GLASS_GEM, LAST_SPELL,
    NUM_OBJECTS, STATUE,
} from "./objects.h.js";
import { INTRINSIC } from "./prop.h.js";
import { LAVAPOOL, LAVAWALL } from "./rm.h.js";
import { defsym_to_trap, levl, trap_to_defsym } from "./rm.h.macros.js";
import { MAXEXPCHARS, MAXTCHARS, WARNCOUNT } from "./sym.h.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { Ugender, Upolyd } from "./you.h.macros.js";
import {
    Blind, Blind_telepat, Confusion, Detect_monsters, HTelepat, Hallucination, Infravision,
    Invisible, See_invisible, Stunned, Unblind_telepat, Underwater, Warning,
} from "./youprop.h.macros.js";
import { int } from "../rt/ctypes.js";
import { is_pool } from "./dbridge.js";
import { flags, go, gu, gy, svc, svl, u } from "./decl.js";
import { canseemon, mon_visible, sensemon, show_glyph } from "./display.js";
import { In_hell, In_mines } from "./dungeon.js";
import { rn2_on_display_rng } from "./rnd.js";
import { worm_known } from "./worm.js";
