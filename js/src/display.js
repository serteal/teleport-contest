/* NetHack 5.0	display.c	$NHDT-Date: 1777000050 2026/04/23 19:07:30 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.263 $ */
/* Copyright (c) Dean Luick, with acknowledgements to Kevin Darcy */
/* and Dave Cohrs, 1990.                                          */
/* NetHack may be freely redistributed.  See license for details. */

/*
 *                      THE NEW DISPLAY CODE
 *
 * The old display code has been broken up into three parts: vision, display,
 * and drawing.  Vision decides what locations can and cannot be physically
 * seen by the hero.  Display decides _what_ is displayed at a given location.
 * Drawing decides _how_ to draw a monster, fountain, sword, etc.
 *
 * The display system uses information from the vision system to decide
 * what to draw at a given location.  The routines for the vision system
 * can be found in vision.c and vision.h.  The routines for display can
 * be found in this file (display.c) and display.h.  The drawing routines
 * are part of the window port.  See doc/window.txt for the drawing
 * interface.
 *
 * The display system deals with an abstraction called a glyph.  Anything
 * that could possibly be displayed has a unique glyph identifier.
 *
 * What is seen on the screen is a combination of what the hero remembers
 * and what the hero currently sees.  Objects and dungeon features (walls
 * doors, etc) are remembered when out of sight.  Monsters and temporary
 * effects are not remembered.  Each location on the level has an
 * associated glyph.  This is the hero's _memory_ of what he or she has
 * seen there before.
 *
 * Display rules:
 *
 *      If the location is in sight, display in order:
 *              visible (or sensed) monsters
 *              visible objects
 *              known traps
 *              background
 *
 *      If the location is out of sight, display in order:
 *              sensed monsters (via telepathy or persistent detection)
 *              warning (partly-sensed monster shown as an abstraction)
 *              memory
 *
 *      "Remembered, unseen monster" is handled like an object rather
 *      than a monster, and stays displayed whether or not it is in sight.
 *      It is removed when a visible or sensed or warned-of monster gets
 *      shown at its location or when searching or fighting reveals that
 *      no monster is there.
 *
 *
 * Here is a list of the major routines in this file to be used externally:
 *
 * newsym
 *
 * Possibly update the screen location (x,y).  This is the workhorse routine.
 * It is always correct --- where correct means following the in-sight/out-
 * of-sight rules.  **Most of the code should use this routine.**  This
 * routine updates the map and displays monsters.
 *
 *
 * map_background
 * map_object
 * map_trap or map_engraving
 * map_invisible
 * unmap_object
 *
 * If you absolutely must override the in-sight/out-of-sight rules, there
 * are two possibilities.  First, you can mess with vision to force the
 * location in sight then use newsym(), or you can  use the map_* routines.
 * The first has not been tried [no need] and the second is used in the
 * detect routines --- detect object, magic mapping, etc.  The map_*
 * routines *change* what the hero remembers.  All changes made by these
 * routines will be sticky --- they will survive screen redraws.  Do *not*
 * use these for things that only temporarily change the screen.  These
 * routines are also used directly by newsym().  unmap_object is used to
 * clear a remembered object when/if detection reveals it isn't there.
 *
 *
 * show_glyph
 *
 * This is direct (no processing in between) buffered access to the screen.
 * Temporary screen effects are run through this and its companion,
 * flush_screen().  There is yet a lower level routine, print_glyph(),
 * but this is unbuffered and graphic dependent (i.e. it must be surrounded
 * by graphic set-up and tear-down routines).  Do not use print_glyph().
 *
 *
 * see_monsters
 * see_objects
 * see_traps
 *
 * These are only used when something affects all of the monsters or
 * objects or traps.  For objects and traps, the only thing is hallucination.
 * For monsters, there are hallucination and changing from/to blindness, etc.
 *
 *
 * tmp_at
 *
 * This is a useful interface for displaying temporary items on the screen.
 * Its interface is different than previously, so look at it carefully.
 *
 *
 *
 * Parts of the rm structure that are used:
 *
 *      typ     - What is really there.
 *      glyph   - What the hero remembers.  This will never be a monster.
 *                Monsters "float" above this.
 *      lit     - True if the position is lit.  An optimization for
 *                lit/unlit rooms.
 *      waslit  - True if the position was *remembered* as lit.
 *      seenv   - A vector of bits representing the directions from which the
 *                hero has seen this position.  The vector's primary use is
 *                determining how walls are seen.  E.g. a wall sometimes looks
 *                like stone on one side, but is seen as wall from the other.
 *                Other uses are for unmapping detected objects and felt
 *                locations, where we need to know if the hero has ever
 *                seen the location.
 *      flags   - Additional information for the typ field.  Different for
 *                each typ.
 *      horizontal - Indicates whether the wall or door is horizontal or
 *                vertical.
 */

/*#define WA_VERBOSE*/ /* give (x,y) locations for all "bad" spots */

export function _glyph_at(x, y) { return gg.gbuf[y][x].glyphinfo.glyph; }

/*
 *      See display.h for descriptions of tp_sensemon() through
 *      is_safemon().  Some of these were generating an awful lot of
 *      code "behind the curtain", particularly canspotmon() (which is
 *      still a macro but one that now expands to a pair of function
 *      calls rather than to a ton of special case checks).  Return
 *      values are all int 0 or 1, not boolean.
 *
 *      They're still implemented as macros within this file.
 */
export function tp_sensemon(mon) { /* int */
    return _tp_sensemon(mon);
}

export function sensemon(mon) { /* int */
    return _sensemon(mon);
}

export function mon_warning(mon) { /* int */
    return _mon_warning(mon);
}

export function mon_visible(mon) { /* int */
    return _mon_visible(mon);
}

export function see_with_infrared(mon) { /* int */
    return _see_with_infrared(mon);
}

export function canseemon(mon) { /* int */
    return _canseemon(mon);
}

export function knowninvisible(mon) { /* int */
    return _knowninvisible(mon);
}
/* #define knowninvisible() isn't useful here */

export function is_safemon(mon) { /* int */
    return _is_safemon(mon);
}
/* #define is_safemon() isn't useful here */

/*
 *      End of former macro-only vision related (mostly) routines
 *      converted to functions.
 */

/*
 * magic_map_background()
 *
 * This function is similar to map_background (see below) except we pay
 * attention to and correct unexplored, lit ROOM and CORR spots.
 */
export function magic_map_background(x, y, show) { /* void */
    let glyph = back_to_glyph(x, y); /* assumes hero can see x,y */
    let lev = levl()[x][y];

    /*
     * Correct for out of sight lit corridors and rooms that the hero
     * doesn't remember as lit.
     */
    if (!cansee(x, y) && !lev.waslit) {
        /* Floor spaces are dark if unlit.  Corridors are dark if unlit. */
        if (lev.typ == ROOM && glyph == cmap_to_glyph(S_room))
            glyph = (flags.dark_room && iflags.wc_color)
                        ? cmap_to_glyph(DARKROOMSYM())
                        : GLYPH_NOTHING;
        else if (lev.typ == CORR && glyph == cmap_to_glyph(S_litcorr))
            glyph = cmap_to_glyph(S_corr);
    }
    if (svl.level.flags.hero_memory
        && (glyph_is_unexplored(lev.glyph) || glyph_is_cmap(lev.glyph)))
        lev.glyph = glyph;
    if (show)
        show_glyph(x, y, glyph);

    update_lastseentyp(x, y);
}

/*
 * The routines map_background(), map_object(), and map_trap() could just
 * as easily be:
 *
 *      map_glyph(x,y,glyph,show)
 *
 * Which is called with the xx_to_glyph() in the call.  Then I can get
 * rid of 3 routines that don't do very much anyway.  And then stop
 * having to create fake objects and traps.  However, I am reluctant to
 * make this change.
 */

/*
 * map_background()
 *
 * Make the real background part of our map.  This routine assumes that
 * the hero can physically see the location.  Update the screen if directed.
 */
export function map_background(x, y, show) { /* void */
    let glyph = back_to_glyph(x, y);

    if (svl.level.flags.hero_memory)
        levl()[x][y].glyph = glyph;
    if (show)
        show_glyph(x, y, glyph);
}

/*
 * map_trap()
 *
 * Map the trap and print it out if directed.  This routine assumes that the
 * hero can physically see the location.
 */
export function map_trap(trap, show) { /* void */
    let x = trap.tx, y = trap.ty;
    let glyph = trap_to_glyph(trap);

    if (svl.level.flags.hero_memory)
        levl()[x][y].glyph = glyph;
    if (show)
        show_glyph(x, y, glyph);
}

/*
 * map_engraving()
 *
 * Map the engraving and print it out if directed.
 */
export function map_engraving(ep, show) { /* void */
    let x = ep.engr_x, y = ep.engr_y;
    let glyph = engraving_to_glyph(ep);

    if (svl.level.flags.hero_memory)
        levl()[x][y].glyph = glyph;
    if (show)
        show_glyph(x, y, glyph);
}

/*
 * map_object()
 *
 * Map the given object.  This routine assumes that the hero can physically
 * see the location of the object.  Update the screen if directed.
 * [Note: feel_location() -> map_location() -> map_object() contradicts
 * the claim here that the hero can see obj's <ox,oy>.]
 */
export function map_object(obj, show) { /* void */
    let x = obj.ox, y = obj.oy;
    let glyph = obj_to_glyph(obj, newsym_rn2);

    /* if this object is already displayed as a generic object, it might
       become a specific one now */
    if (glyph_is_generic_object(glyph) && cansee(x, y) && !Hallucination()) {
        /* these 'r' and 'neardist' calculations match distant_name(objnam.c)
           and see_nearby_objects(below); we assume that this is a lone
           object or a pile-top, not something below the top of a pile */
        let r = (u.xray_range > 2) ? u.xray_range : 2,

            neardist = (r * r) * 2 - r; /* same as r*r + r*(r-1) */

        if (distu(x, y) <= neardist) {
            observe_object(obj);
            glyph = obj_to_glyph(obj, newsym_rn2);
        }
    }

    if (svl.level.flags.hero_memory) {
        /* MRKR: While hallucinating, statues are seen as random monsters */
        /*       but remembered as random objects.                        */

        if (Hallucination() && obj.otyp == STATUE) {
            levl()[x][y].glyph = random_obj_to_glyph(newsym_rn2);
        } else {
            levl()[x][y].glyph = glyph;
        }
    }
    if (show)
        show_glyph(x, y, glyph);
}

/*
 * map_invisible()
 *
 * Make the hero remember that a square contains an invisible monster.
 * This is a special case in that the square will continue to be displayed
 * this way even when the hero is close enough to see it.  To get rid of
 * this and display the square's actual contents, use unmap_object() followed
 * by newsym() if necessary.
 */
export function map_invisible(x, y) { /* void */
    if (x != u.ux || y != u.uy) { /* don't display I at hero's location */
        if (svl.level.flags.hero_memory)
            levl()[x][y].glyph = GLYPH_INVISIBLE;
        show_glyph(x, y, GLYPH_INVISIBLE);
    }
}

export function unmap_invisible(x, y) { /* boolean */
    if (isok(x,y) && glyph_is_invisible(levl()[x][y].glyph)) {
        unmap_object(x, y);
        newsym(x, y);
        return TRUE;
    }
    return FALSE;
}

/*
 * unmap_object()
 *
 * Remove something from the map when the hero realizes it's not there
 * anymore.  Replace it with background or known trap, but not with
 * any other remembered object.  If this is used for detection, a full
 * screen update is imminent anyway; if this is used to get rid of an
 * invisible monster notation, we might have to call newsym().
 */
export function unmap_object(x, y) { /* void */
    let trap;
    let ep;

    if (!svl.level.flags.hero_memory)
        return;

    if ((trap = t_at(x, y)) != null && trap.tseen && !covers_traps(x, y)) {
        map_trap(trap, 0);
    } else if (levl()[x][y].seenv) {
        let lev = levl()[x][y];

        if (spot_shows_engravings(x, y)
            && (ep = engr_at(x, y)) != null && !covers_traps(x, y)) {
            if (cansee(x, y))
                ep.erevealed = 1;
            map_engraving(ep, 0);
        } else {
            map_background(x, y, 0);
        }

        /* turn remembered dark room squares dark */
        if (!lev.waslit && lev.glyph == cmap_to_glyph(S_room)
            && lev.typ == ROOM)
            lev.glyph = cmap_to_glyph(S_stone);
    } else {
        levl()[x][y].glyph = cmap_to_glyph(S_stone); /* default val */
    }
}

/*
 * map_location()
 *
 * Make whatever at this location show up.  This is only for non-living
 * things.  This will not handle feeling invisible objects correctly.
 *
 * Internal to display.c, this is a #define for speed.
 */
export function _map_location(x, y, show) { do {
        let obj;
        let trap;
        let ml_ep;
        let _ml_reg;

        if ((obj = vobj_at(x, y)) && !covers_objects(x, y)) {
            map_object(obj, show);
        } else if ((trap = t_at(x, y))
                    && trap.tseen && !covers_traps(x, y)) {
            map_trap(trap, show);
        } else if (spot_shows_engravings(x, y)
                 && (ml_ep = engr_at(x, y)) != null
                 && ml_ep.erevealed
                 && !covers_traps(x, y)) {
            map_engraving(ml_ep, show);
        } else {
            map_background(x, y, show);
        }

        update_lastseentyp(x, y);
        if (show && !Blind() && (_ml_reg = visible_region_at(x, y)) != null)
            show_region(_ml_reg, x, y);
    } while (0) }

export function map_location(x, y, show) { /* void */
    _map_location(x, y, show);
}

/* display something on monster layer; may need to fixup object layer */
function show_mon_or_warn(x, y, monglyph) { /* void */
    let o;

    /* "remembered, unseen monster" is tracked by object layer so if we're
       putting something on monster layer at same spot, stop remembering
       that; if an object is in view there, start remembering it instead */
    if (glyph_is_invisible(levl()[x][y].glyph)) {
        unmap_object(x, y);
        if (cansee(x, y) && (o = vobj_at(x, y)) != null)
            map_object(o, FALSE);
    }

    show_glyph(x, y, monglyph);
}

export const DETECTED = 2;
export const PHYSICALLY_SEEN = 1;

/*
 * display_monster()
 *
 * Note that this is *not* a map_XXXX() function!  Monsters sort of float
 * above everything.
 *
 * Yuck.  Display body parts by recognizing that the display position is
 * not the same as the monster position.  Currently the only body part is
 * a worm tail.
 *
 */
function display_monster(
    x, y,
    mon,
    sightflags,

    worm_tail) { /* void */ /* mon is actually a worm tail */
    const $frame = stack_frame(); try {
    let mon_mimic = +(M_AP_TYPE(mon) != M_AP_NOTHING);
    let sensed = (mon_mimic && (Protection_from_shape_changers()
                                || (((!u.uswallow || ((mon) == u.ustuck)) && (!Underwater() || ((mdistu(mon) <= 2) && is_pool((mon).mx, (mon).my)))) && ((Detect_monsters() || ((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range))))) || MATCH_WARN_OF_MON(mon)))) ? 1 : 0),
        mgendercode = mon.female ? FEMALE : MALE;

    /*
     * We must do the mimic check first.  If the mimic is mimicking something,
     * and the location is in sight, we have to change the hero's memory
     * so that when the position is out of sight, the hero remembers what
     * the mimic was mimicking.
     */
    if (mon_mimic && (sightflags == PHYSICALLY_SEEN)) {
        switch (M_AP_TYPE(mon)) {
        default:
            impossible(_("display_monster:  bad m_ap_type value [ = %d ]"),
                       mon.m_ap_type);
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case M_AP_NOTHING:
            show_glyph(x, y, mon_to_glyph(mon, newsym_rn2));
            break;

        case M_AP_FURNITURE: {
            /*
             * This is a poor man's version of map_background().  I can't
             * use map_background() because we are overriding what is in
             * the 'typ' field.  Maybe have map_background()'s parameters
             * be (x,y,glyph) instead of just (x,y).
             *
             * mappearance is currently set to an S_ index value in
             * makemon.c.
             */
            let sym = int(mon.mappearance), glyph = cmap_to_glyph(sym);

            levl()[x][y].glyph = glyph;
            if (!sensed) {
                show_glyph(x, y, glyph);
                /* override real topology with mimic's fake one */
                chars[svl.lastseentyp[x] + y] = cmap_to_type(sym);
            }
            break;
        }

        case M_AP_OBJECT: {
            /* Make a fake object to send to map_object(). */
            let obj = stack_struct(struct_obj);

            struct_assign(obj, cg.zeroobj);
            obj.ox = x;
            obj.oy = y;
            obj.otyp = short(mon.mappearance);
            /* might be mimicking a corpse or statue */
            obj.corpsenm = has_mcorpsenm(mon) ? MCORPSENM(mon) : PM_TENGU;
            map_object(obj, +!sensed);
            break;
        }

        case M_AP_MONSTER: {
            let mndx = (Hallucination() ? random_monster(rn2_on_display_rng) : int(mon.mappearance));

            show_glyph(x, y, monnum_to_glyph(mndx, mgendercode));
            break;
        } /* case M_AP_MONSTER */
        } /* switch M_AP_TYPE() */
    }

    /* If mimic is unsuccessfully mimicking something, display the monster. */
    if (!mon_mimic || sensed) {
        let num;

        /* [ALI] Only use detected glyphs when monster wouldn't be
         * visible by any other means.
         *
         * There are no glyphs for "detected pets" so we have to
         * decide whether to display such things as detected or as tame.
         * If both are being highlighted in the same way, it doesn't
         * matter, but if not, showing them as pets is preferrable.
         */
        if (mon.mtame && !Hallucination()) {
            if (worm_tail)
                num = petnum_to_glyph(PM_LONG_WORM_TAIL, mgendercode);
            else
                num = pet_to_glyph(mon, rn2_on_display_rng);
        } else if (sightflags == DETECTED) {
            if (worm_tail)
                num = detected_monnum_to_glyph(what_mon(PM_LONG_WORM_TAIL,
                                                        rn2_on_display_rng),
                                               mgendercode);
            else
                num = detected_mon_to_glyph(mon, rn2_on_display_rng);
        } else {
            if (worm_tail)
                num = monnum_to_glyph(what_mon(PM_LONG_WORM_TAIL,
                                               rn2_on_display_rng),
                                      mgendercode);
            else
                num = mon_to_glyph(mon, rn2_on_display_rng);
        }
        show_mon_or_warn(x, y, num);
        mon.meverseen = 1;
    }
    } finally { stack_pop($frame); }
}

/*
 * display_warning()
 *
 * This is also *not* a map_XXXX() function!  Monster warnings float
 * above everything just like monsters do, but only if the monster
 * is not showing.
 *
 * Do not call for worm tails.
 */
function display_warning(mon) { /* void */
    let x = mon.mx, y = mon.my;
    let glyph;

    if ((((Warning() && !(mon).mpeaceful) && (mdistu(mon) < 100)) && ((Math.trunc(((mon).m_lev / 4))) >= svc.context.warnlevel))) {
        let wl = Hallucination() ? rn2_on_display_rng(WARNCOUNT - 1) + 1
                               : warning_of(mon);

        glyph = warning_to_glyph(wl);
    } else if (MATCH_WARN_OF_MON(mon)) {
        glyph = mon_to_glyph(mon, rn2_on_display_rng);
    } else {
        impossible(_("display_warning did not match warning type?"));
        return;
    }
    show_mon_or_warn(x, y, glyph);
}

export function warning_of(mon) { /* int */
    let wl = 0, tmp = 0;

    if ((((Warning() && !(mon).mpeaceful) && (mdistu(mon) < 100)) && ((Math.trunc(((mon).m_lev / 4))) >= svc.context.warnlevel))) {
        tmp = Math.trunc(mon.m_lev / 4);    /* match display.h */
        wl = (tmp > WARNCOUNT - 1) ? WARNCOUNT - 1 : tmp;
    }
    return wl;
}

/* used by newsym() to decide whether to show a monster or a visible gas
   cloud region when both are at the same spot; caller deals with region */
function mon_overrides_region(
    mon,
    mx, my) { /* boolean */ /* won't match mon->mx,my if long worm's tail */
    let r;

    /* this is redundant because newsym() doesn't call us when swallowed */
    if (u.uswallow && (!mon || mon != u.ustuck))
        return FALSE;

    if (mon) {
        /* when not a worm tail, show mon if sensed rather than seen */
        if (mx == mon.mx && my == mon.my
            && ((((!u.uswallow || ((mon) == u.ustuck)) && (!Underwater() || ((mdistu(mon) <= 2) && is_pool((mon).mx, (mon).my)))) && ((Detect_monsters() || ((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range))))) || MATCH_WARN_OF_MON(mon))) || (((Warning() && !(mon).mpeaceful) && (mdistu(mon) < 100)) && ((Math.trunc(((mon).m_lev / 4))) >= svc.context.warnlevel))))
            return TRUE;

        /* even if worm tail;
           check whether the spot is adjacent and 'mon' would be visible
           there if the gas cloud wasn't interfering with normal vision;
           _mon_visible() handles mon->mundetected; don't need to check
           infravision when monster is adjacent */
        r = (u.xray_range > 1) ? u.xray_range : 1;
        if (!Blind() && _mon_visible(mon)
            && M_AP_TYPE(mon) != M_AP_FURNITURE
            && M_AP_TYPE(mon) != M_AP_OBJECT
            && distu(mx, my) <= r * (r + 1))
            return TRUE;
    }

    /* if not overriding region for current mon, propagate "remembered,
       unseen monster" */
    return glyph_is_invisible(levl()[mx][my].glyph) ? TRUE : FALSE;
}

export function _suppress_map_output() { return (gi.in_mklev || program_state.saving || program_state.restoring
     || program_state.done_hup ? 1 : 0); }

/* map or status window might not be ready for output during level creation
   or game restoration (something like u.usteed which affects display of
   the hero and also a status condition might not be set up yet) */
export function suppress_map_output() { /* boolean */
    return _suppress_map_output();
}

/*
 * feel_newsym()
 *
 * When hero knows what happened to location, even when blind.
 */
export function feel_newsym(x, y) { /* void */
    if (Blind())
        feel_location(x, y);
    else
        newsym(x, y);
}

/*
 * feel_location()
 *
 * Feel the given location.  This assumes that the hero is blind and that
 * the given position is either the hero's or one of the eight squares
 * adjacent to the hero (except for a boulder push).
 * If an invisible monster has gone away, that will be discovered.  If an
 * invisible monster has appeared, this will _not_ be discovered since
 * searching only finds one monster per turn so we must check that separately.
 */
export function feel_location(x, y) { /* void */
    let lev;
    let boulder;
    let mon;
    let ep;

    /* replicate safeguards used by newsym(); might not be required here */
    if (_suppress_map_output())
        return;
    if (!isok(x, y))
        return;
    lev = levl()[x][y];
    /* If hero's memory of an invisible monster is accurate, we want to keep
     * him from detecting the same monster over and over again on each turn.
     * We must return (so we don't erase the monster).  (We must also, in the
     * search function, be sure to skip over previously detected 'I's.)
     */
    if (glyph_is_invisible(lev.glyph) && m_at(x, y))
        return;

    /* The hero can't feel non pool locations while under water
       except for lava and ice. */
    if (Underwater() && !Is_waterlevel(u.uz)
        && !is_pool_or_lava(x, y) && !is_ice(x, y))
        return;

    /* Set the seen vector as if the hero had seen it.
       It doesn't matter if the hero is levitating or not. */
    set_seenv(lev, u.ux, u.uy, x, y);

    if (!can_reach_floor(FALSE)) {
        /*
         * Levitation Rules.  It is assumed that the hero can feel the state
         * of the walls around herself and can tell if she is in a corridor,
         * room, or doorway.  Boulders are felt because they are large enough.
         * Anything else is unknown because the hero can't reach the ground.
         * This makes things difficult.
         *
         * Check (and display) in order:
         *
         *      + Stone, walls, and closed doors.
         *      + Boulders.  [see a boulder before a doorway]
         *      + doors.
         *      + Room/water positions
         *      + Everything else (hallways!)
         */
        if (IS_OBSTRUCTED(lev.typ)
            || (IS_DOOR(lev.typ)
                && (lev.flags & (D_LOCKED | D_CLOSED)))) {
            map_background(x, y, 1);
        } else if ((boulder = sobj_at(BOULDER, x, y)) != null) {
            map_object(boulder, 1);
        } else if (IS_DOOR(lev.typ)) {
            map_background(x, y, 1);
        } else if (IS_ROOM(lev.typ) || IS_POOL(lev.typ)) {
            let do_room_glyph;

            /*
             * An open room or water location.  Normally we wouldn't touch
             * this, but we have to get rid of remembered boulder symbols.
             * This will only occur in rare occasions when the hero goes
             * blind and doesn't find a boulder where expected (something
             * came along and picked it up).  We know that there is not a
             * boulder at this location.  Show fountains, pools, etc.
             * underneath if already seen.  Otherwise, show the appropriate
             * floor symbol.
             *
             * Similarly, if the hero digs a hole in a wall or feels a
             * location that used to contain an unseen monster.  In these
             * cases, there's no reason to assume anything was underneath,
             * so just show the appropriate floor symbol.  If something was
             * embedded in the wall, the glyph will probably already
             * reflect that.  Don't change the symbol in this case.
             *
             * This isn't quite correct.  If the boulder was on top of some
             * other objects they should be seen once the boulder is removed.
             * However, we have no way of knowing that what is there now
             * was there then.  So we let the hero have a lapse of memory.
             * We could also just display what is currently on the top of the
             * object stack (if anything).
             */
            do_room_glyph = FALSE;
            if (lev.glyph == objnum_to_glyph(BOULDER)
                || glyph_is_invisible(lev.glyph)) {
                if (lev.typ != ROOM && lev.seenv)
                    map_background(x, y, 1);
                else
                    do_room_glyph = TRUE;
            } else if (lev.glyph >= cmap_to_glyph(S_stone)
                       && lev.glyph < cmap_to_glyph(S_darkroom)) {
                do_room_glyph = TRUE;
            }
            if (do_room_glyph) {
                lev.glyph = (flags.dark_room && iflags.wc_color
                              && !Is_rogue_level(u.uz))
                                 ? cmap_to_glyph(S_darkroom)
                                 : (lev.waslit ? cmap_to_glyph(S_room)
                                                : cmap_to_glyph(S_stone));
                show_glyph(x, y, lev.glyph);
            }
        } else {
            /* We feel it (I think hallways are the only things left). */
            map_background(x, y, 1);
            /* Corridors are never felt as lit (unless remembered that way) */
            /* (lit_corridor only).                                         */
            if (lev.typ == CORR && lev.glyph == cmap_to_glyph(S_litcorr)
                && !lev.waslit)
                show_glyph(x, y, lev.glyph = cmap_to_glyph(S_corr));
            else if (lev.typ == ROOM && flags.dark_room && iflags.wc_color
                     && lev.glyph == cmap_to_glyph(S_room))
                show_glyph(x, y, lev.glyph = cmap_to_glyph(S_darkroom));
        }
    } else {
        if ((ep = engr_at(x, y)) != null && engr_can_be_felt(ep))
            ep.erevealed = 1;

        _map_location(x, y, 1);

        if (Punished()) {
            /*
             * A ball or chain is only felt if it is first on the object
             * location list.  Otherwise, we need to clear the felt bit ---
             * something has been dropped on the ball/chain.  If the bit is
             * not cleared, then when the ball/chain is moved it will drop
             * the wrong glyph.
             *
             * Note: during unpunish() we can be called by delobj() when
             * destroying uchain while uball hasn't been cleared yet (so
             * Punished will still yield True but uchain might not be part
             * of the floor list anymore).
             */
            if (uchain && uchain.where == OBJ_FLOOR
                && uchain.ox == x && uchain.oy == y
                && svl.level.objects[x][y] == uchain)
                u.bc_felt |= BC_CHAIN;
            else
                u.bc_felt &= ~BC_CHAIN; /* do not feel the chain */

            if (uball && uball.where == OBJ_FLOOR
                && uball.ox == x && uball.oy == y
                && svl.level.objects[x][y] == uball)
                u.bc_felt |= BC_BALL;
            else
                u.bc_felt &= ~BC_BALL; /* do not feel the ball */
        }

        /* Floor spaces are dark if unlit.  Corridors are dark if unlit. */
        if (lev.typ == ROOM && lev.glyph == cmap_to_glyph(S_room)
            && (!lev.waslit || (flags.dark_room && iflags.wc_color)))
            show_glyph(x, y, lev.glyph = cmap_to_glyph(
                                 flags.dark_room ? S_darkroom : S_stone));
        else if (lev.typ == CORR && lev.glyph == cmap_to_glyph(S_litcorr)
                 && !lev.waslit)
            show_glyph(x, y, lev.glyph = cmap_to_glyph(S_corr));
    }
    /* draw monster on top if we can sense it */
    if (!u_at(x, y) && (mon = m_at(x, y)) != null && (((!u.uswallow || ((mon) == u.ustuck)) && (!Underwater() || ((mdistu(mon) <= 2) && is_pool((mon).mx, (mon).my)))) && ((Detect_monsters() || ((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range))))) || MATCH_WARN_OF_MON(mon))))
        display_monster(x, y, mon,
                        (((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range)))) || MATCH_WARN_OF_MON(mon))
                            ? PHYSICALLY_SEEN
                            : DETECTED,
                        (((mon) && ((x != (mon).mx) || (y != (mon).my))) ? 1 : 0));
}

/*
 * newsym()
 *
 * Possibly put a new glyph at the given location.
 */
export function newsym(x, y) { /* void */
    let $goto = null;
    var lev;
    var ep;
    var mon;
    var see_it;
    var worm_tail;

    /* don't try to produce map output when level is in a state of flux */
    if (_suppress_map_output())
        return;
    /* should never happen; same error handling as u_on_newpos() */
    if (!isok(x, y)) {
        var errfunc;

        errfunc = (x < 0 || y < 0 || x > COLNO - 1 || y > ROWNO - 1) ? panic
                  : impossible; /* misuse of column 0 is less severe */
        errfunc(_("newsym: attempting screen update for <%d,%d>"), x, y);
        return;
    }

    /* only permit updating the hero when swallowed */
    if (u.uswallow) {
        if (u_at(x, y))
            show_glyph(u.ux, u.uy, ((u.usteed && ((!u.usteed.minvis || See_invisible()) && !u.usteed.mundetected)) ? ridden_mon_to_glyph(u.usteed, rn2_on_display_rng) : ((U_AP_TYPE() == M_AP_NOTHING) ? hero_glyph() : ((U_AP_TYPE() == M_AP_FURNITURE) ? cmap_to_glyph(int(gy.youmonst.mappearance)) : ((U_AP_TYPE() == M_AP_OBJECT) ? objnum_to_glyph(int(gy.youmonst.mappearance)) : monnum_to_glyph(int(gy.youmonst.mappearance), Ugender()))))));
        return;
    }
    if (Underwater() && !Is_waterlevel(u.uz)) {
        /* when underwater, don't do anything unless <x,y> is an
           adjacent water or lava or ice position */
        if (!(is_pool_or_lava(x, y) || is_ice(x, y)) || !next2u(x, y))
            return;
    }
    lev = levl()[x][y];

    /* Can physically see the location. */
    if (cansee(x, y)) {
        var reg = visible_region_at(x, y);
        /*
         * Don't use templit here:  E.g.
         *
         *      lev->waslit = !!(lev->lit || templit(x,y));
         *
         * Otherwise we have the "light pool" problem, where non-permanently
         * lit areas just out of sight stay remembered as lit.  They should
         * re-darken.
         *
         * Perhaps ALL areas should revert to their "unlit" look when
         * out of sight.
         */
        lev.waslit = +(lev.lit != 0); /* remember lit condition */

        mon = m_at(x, y);
        worm_tail = (((mon) && ((x != (mon).mx) || (y != (mon).my))) ? 1 : 0);

        if ((ep = engr_at(x, y)) != null)
            ep.erevealed = 1; /* even when covered by objects or a monster */
        /*
         * Normal region shown only on accessible positions, but
         * poison clouds and steam clouds also shown above lava,
         * pools and moats.
         * However, sensed monsters (via detection or telepathy or
         * warning) take precedence over all regions.
         * Adjacent monsters also take precedence if they would be
         * seen when there's no gas region.
         *
         * FIXME:
         *  The adjacency checking [in mon_overrides_region()] works
         *  when the hero is outside the region and the monster is
         *  inside, and when they're both inside, but not when the
         *  hero is inside and monster outside (because 'reg' will be
         *  Null for mon's <x,y>).  Checking whether hero is inside
         *  a region for every newsym() seems excessive.  The hero is
         *  usually blind when in a gas cloud so the problem is less
         *  noticeable then it might otherwise be.
         */
        if (reg && (ACCESSIBLE(lev.typ)
                    || (reg.visible && is_pool_or_lava(x, y)))) {
            if (!mon_overrides_region(mon, x, y)) {
                show_region(reg, x, y);
                return;
            }
        }

        if (u_at(x, y)) {
            var see_self = canspotself();

            /* update map information for <u.ux,u.uy> (remembered topology
               and object/known trap/terrain glyph) but only display it if
               hero can't see him/herself, then show self if appropriate */
            _map_location(x, y, +!see_self);
            if (see_self)
                show_glyph(u.ux, u.uy, ((u.usteed && ((!u.usteed.minvis || See_invisible()) && !u.usteed.mundetected)) ? ridden_mon_to_glyph(u.usteed, rn2_on_display_rng) : ((U_AP_TYPE() == M_AP_NOTHING) ? hero_glyph() : ((U_AP_TYPE() == M_AP_FURNITURE) ? cmap_to_glyph(int(gy.youmonst.mappearance)) : ((U_AP_TYPE() == M_AP_OBJECT) ? objnum_to_glyph(int(gy.youmonst.mappearance)) : monnum_to_glyph(int(gy.youmonst.mappearance), Ugender()))))));
        } else {
            var show = FALSE;

            see_it = (mon && (((!mon.minvis || See_invisible()) && !mon.mundetected)
                             || (!worm_tail && (((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range))))
                                                || MATCH_WARN_OF_MON(mon)))) ? 1 : 0);
            if (mon && (see_it || (!worm_tail && Detect_monsters()))) {
                if (mon.mtrapped) {
                    var trap = t_at(x, y);
                    var tt = trap ? trap.ttyp : NO_TRAP;

                    /* if monster is in a physical trap, you see trap too */
                    if (tt == BEAR_TRAP || is_pit(tt) || tt == WEB)
                        trap.tseen = 1;
                }
                _map_location(x, y, show); /* map under the monster */
                /* also gets rid of any invisibility glyph */
                display_monster(x, y, mon,
                                see_it ? PHYSICALLY_SEEN : DETECTED,
                                worm_tail);
            } else if (mon && (((Warning() && !(mon).mpeaceful) && (mdistu(mon) < 100)) && ((Math.trunc(((mon).m_lev / 4))) >= svc.context.warnlevel)) && !worm_tail) {
                display_warning(mon);
            } else if (glyph_is_invisible(lev.glyph)) {
                map_invisible(x, y);
            } else {
                _map_location(x, y, 1); /* map the location */
            }
        }

    /* Can't see the location. */
    } else {
        $goto_show_mem: for (;;) { switch ($goto) { default: case "show_mem": if (!$goto && (u_at(x, y))) {
            feel_location(u.ux, u.uy); /* forces an update */

            if (canspotself())
                show_glyph(u.ux, u.uy, ((u.usteed && ((!u.usteed.minvis || See_invisible()) && !u.usteed.mundetected)) ? ridden_mon_to_glyph(u.usteed, rn2_on_display_rng) : ((U_AP_TYPE() == M_AP_NOTHING) ? hero_glyph() : ((U_AP_TYPE() == M_AP_FURNITURE) ? cmap_to_glyph(int(gy.youmonst.mappearance)) : ((U_AP_TYPE() == M_AP_OBJECT) ? objnum_to_glyph(int(gy.youmonst.mappearance)) : monnum_to_glyph(int(gy.youmonst.mappearance), Ugender()))))));
        } else if (!$goto && ((mon = m_at(x, y)) != null
                   && ((see_it = (((!mindless(mon.data)) && ((Blind() && Blind_telepat()) || (Unblind_telepat() && (mdistu(mon) <= u.unblind_telepat_range)))) || MATCH_WARN_OF_MON(mon)
                                  || ((((!Blind() && Infravision()) && infravisible(mon.data)) && couldsee(mon.mx, mon.my))
                                      && ((!mon.minvis || See_invisible()) && !mon.mundetected)) ? 1 : 0)) != 0
                       || (Detect_monsters() && !((mon) && ((x != (mon).mx) || (y != (mon).my))))))) {
            /* Seen or sensed monsters are printed every time.
               This also gets rid of any invisibility glyph. */
            display_monster(x, y, mon, see_it ? 0 : DETECTED,
                            ((mon) && ((x != (mon).mx) || (y != (mon).my))) ? TRUE : FALSE);
        } else if (!$goto && (mon && (((Warning() && !(mon).mpeaceful) && (mdistu(mon) < 100)) && ((Math.trunc(((mon).m_lev / 4))) >= svc.context.warnlevel)) && !((mon) && ((x != (mon).mx) || (y != (mon).my))))) {
            display_warning(mon);

        /*
         * If the location is remembered as being both dark (waslit is false)
         * and lit (glyph is a lit room or lit corridor) then it was either:
         *
         *      (1) A dark location that the hero could see through night
         *          vision.
         *      (2) Darkened while out of the hero's sight.  This can happen
         *          when cursed scroll of light is read.
         *
         * In either case, we have to manually correct the hero's memory to
         * match waslit.  Deciding when to change waslit is non-trivial.
         *
         *  Note:  If flags.lit_corridor is set, then corridors act like room
         *         squares.  That is, they light up if in night vision range.
         *         If flags.lit_corridor is not set, then corridors will
         *         remain dark unless lit by a light spell and may darken
         *         again, as discussed above.
         *
         * These checks and changes must be here and not in back_to_glyph().
         * They are dependent on the position being out of sight.
         */
        } else if (!$goto && (Is_rogue_level(u.uz))) {
            if (lev.glyph == cmap_to_glyph(S_litcorr) && lev.typ == CORR)
                show_glyph(x, y, lev.glyph = cmap_to_glyph(S_corr));
            else if (lev.glyph == cmap_to_glyph(S_room) && lev.typ == ROOM
                     && !lev.waslit)
                show_glyph(x, y, lev.glyph = cmap_to_glyph(S_stone));
            else
                { $goto = "show_mem"; continue $goto_show_mem; };
        } else if (!$goto && (!lev.waslit || (flags.dark_room && iflags.wc_color))) {
            if (lev.glyph == cmap_to_glyph(S_litcorr) && lev.typ == CORR)
                show_glyph(x, y, lev.glyph = cmap_to_glyph(S_corr));
            else if (lev.glyph == cmap_to_glyph(S_room) && lev.typ == ROOM)
                show_glyph(x, y, lev.glyph = cmap_to_glyph(DARKROOMSYM()));
            else
                { $goto = "show_mem"; continue $goto_show_mem; };
        } else {
 $goto = null;
            show_glyph(x, y, lev.glyph);
        } } break; }
    }
}

/*
 * shieldeff()
 *
 * Put magic shield pyrotechnics at the given location.  This *could* be
 * pulled into a platform dependent routine for fancier graphics if desired.
 */
export function shieldeff(x, y) { /* void */
    let i;

    if (!flags.sparkle)
        return;
    if (cansee(x, y)) { /* Don't see anything if can't see the location */
        for (i = 0; i < SHIELD_COUNT; i++) {
            show_glyph(x, y, cmap_to_glyph(shield_static[i]));
            flush_screen(1); /* make sure the glyph shows up */
            nh_delay_output()();
        }
        newsym(x, y); /* restore the old information */
    }
}

function tether_glyph(x, y) { /* int */
    let tdx, tdy;
    tdx = u.ux - x;
    tdy = u.uy - y;
    return zapdir_to_glyph(sgn(tdx),sgn(tdy), 2);
}

/*
 * tmp_at()
 *
 * Temporarily place glyphs on the screen.  Do not call nh_delay_output().  It
 * is up to the caller to decide if it wants to wait [presently, everyone
 * but explode() wants to delay].
 *
 * Call:
 *      (DISP_BEAM,    glyph)   open, initialize glyph
 *      (DISP_FLASH,   glyph)   open, initialize glyph
 *      (DISP_ALWAYS,  glyph)   open, initialize glyph
 *      (DISP_CHANGE,  glyph)   change glyph
 *      (DISP_END,     0)       close & clean up (2nd argument doesn't matter)
 *      (DISP_FREEMEM, 0)       only used to prevent memory leak during exit)
 *      (x, y)                  display the glyph at the location
 *
 * DISP_BEAM   - Display the given glyph at each location, but do not erase
 *               any until the close call.
 * DISP_ALL    - Same as DISP_BEAM except glyph is shown at the specified
 *               spot even when that spot can't be seen.
 * DISP_TETHER - Display a tether glyph at each location, and the tethered
 *               object at the farthest location, but do not erase any
 *               until the return trip or close.
 * DISP_FLASH  - Display the given glyph at each location, but erase the
 *               previous location's glyph.
 * DISP_ALWAYS - Like DISP_FLASH, but vision is not taken into account.
 */

export const TMP_AT_MAX_GLYPHS = (COLNO * 2);

 const struct_tmp_glyph = struct("struct_tmp_glyph", {
    saved: array_of("struct_nhcoord", TMP_AT_MAX_GLYPHS),
    sidx: int,
    style: int,
    glyph: int,
    prev: ptr_to("struct_tmp_glyph"),
}); const tgfirst = static_struct("tgfirst", struct_tmp_glyph);

export function tmp_at(x, y) { /* void */
    let tglyph = static_var("tmp_at.tglyph", ptr_to(struct_tmp_glyph), null);
    let tmp;

    switch (x) {
    case DISP_BEAM:
    case DISP_ALL:
    case DISP_TETHER:
    case DISP_FLASH:
    case DISP_ALWAYS:
        if (!tglyph[0])
            tmp = tgfirst;
        else /* nested effect; we need dynamic memory */
            tmp = view_of(struct_tmp_glyph, addr_of(alloc(sizeof(struct_tmp_glyph))));
        tmp.prev = tglyph[0];
        tglyph[0] = tmp;
        tglyph[0].sidx = 0;
        tglyph[0].style = x;
        tglyph[0].glyph = y;
        flush_screen(0); /* flush buffered glyphs */
        return;

    case DISP_FREEMEM: /* in case game ends with tmp_at() in progress */
        while (tglyph[0]) {
            tmp = tglyph[0].prev;
            if (tglyph[0] != tgfirst)
                free(addr_of(tglyph[0]));
            tglyph[0] = tmp;
        }
        return;

    default:
        break;
    }

    if (!tglyph[0]) {
        panic(_("tmp_at: tglyph not initialized"));
    } else {
        switch (x) {
        case DISP_CHANGE:
            tglyph[0].glyph = y;
            break;

        case DISP_END:
            if (tglyph[0].style == DISP_BEAM || tglyph[0].style == DISP_ALL) {
                let i;

                /* Erase (reset) from source to end */
                for (i = 0; i < tglyph[0].sidx; i++)
                    newsym(tglyph[0].saved[i].x, tglyph[0].saved[i].y);
            } else if (tglyph[0].style == DISP_TETHER) {
                let i;

                if (y == BACKTRACK && tglyph[0].sidx > 1) {
                    /* backtrack */
                    for (i = tglyph[0].sidx - 1; i > 0; i--) {
                        newsym(tglyph[0].saved[i].x, tglyph[0].saved[i].y);
                        show_glyph(tglyph[0].saved[i - 1].x,
                                   tglyph[0].saved[i - 1].y, tglyph[0].glyph);
                        flush_screen(0); /* make sure it shows up */
                        nh_delay_output()();
                    }
                    tglyph[0].sidx = 1;
                }
                for (i = 0; i < tglyph[0].sidx; i++)
                    newsym(tglyph[0].saved[i].x, tglyph[0].saved[i].y);
            } else {              /* DISP_FLASH or DISP_ALWAYS */
                if (tglyph[0].sidx) /* been called at least once */
                    newsym(tglyph[0].saved[0].x, tglyph[0].saved[0].y);
            }
            /* tglyph->sidx = 0; -- about to be freed, so not necessary */
            tmp = tglyph[0].prev;
            if (tglyph[0] != tgfirst)
                free(addr_of(tglyph[0]));
            tglyph[0] = tmp;
            break;

        default: /* do it */
            if (!isok(x, y))
                break;
            if (tglyph[0].style == DISP_BEAM || tglyph[0].style == DISP_ALL) {
                if (tglyph[0].style != DISP_ALL && !cansee(x, y))
                    break;
                if (tglyph[0].sidx >= TMP_AT_MAX_GLYPHS)
                    break; /* too many locations */
                /* save pos for later erasing */
                tglyph[0].saved[tglyph[0].sidx].x = x;
                tglyph[0].saved[tglyph[0].sidx].y = y;
                tglyph[0].sidx += 1;
            } else if (tglyph[0].style == DISP_TETHER) {
                if (tglyph[0].sidx >= TMP_AT_MAX_GLYPHS)
                    break; /* too many locations */
                if (tglyph[0].sidx) {
                    let px, py;

                    px = elt(tglyph[0].saved, tglyph[0].sidx - 1).x;
                    py = elt(tglyph[0].saved, tglyph[0].sidx - 1).y;
                    show_glyph(px, py, tether_glyph(px, py));
                }
                /* save pos for later use or erasure */
                tglyph[0].saved[tglyph[0].sidx].x = x;
                tglyph[0].saved[tglyph[0].sidx].y = y;
                tglyph[0].sidx += 1;
            } else { /* DISP_FLASH/ALWAYS */
                if (tglyph[0]
                        .sidx) { /* not first call, so reset previous pos */
                    newsym(tglyph[0].saved[0].x, tglyph[0].saved[0].y);
                    tglyph[0].sidx = 0; /* display is presently up to date */
                }
                if (!cansee(x, y) && tglyph[0].style != DISP_ALWAYS)
                    break;
                tglyph[0].saved[0].x = x;
                tglyph[0].saved[0].y = y;
                tglyph[0].sidx = 1;
            }

            show_glyph(x, y, tglyph[0].glyph); /* show it */
            flush_screen(0);                 /* make sure it shows up */
            break;
        } /* end switch */
    }
}

/*
 * flash_glyph_at(x, y, glyph, repeatcount)
 *
 * Briefly flash between the passed glyph and the glyph that's
 * meant to be at the location.
 */
export function flash_glyph_at(x, y, tg, rpt) { /* void */
    const $frame = stack_frame(); try {
    let i, glyph = stack_array(int, 2);

    rpt *= 2; /* two loop iterations per 'count' */
    glyph[0] = tg;
    glyph[1] = svl.level.flags.hero_memory ? levl()[x][y].glyph
                                             : back_to_glyph(x, y);
    /* even iteration count (guaranteed) ends with glyph[1] showing;
       caller might want to override that, but no newsym() calls here
       in case caller has tinkered with location visibility */
    for (i = 0; i < rpt; i++) {
        show_glyph(x, y, glyph[i % 2]);
        flush_screen(1);
        nh_delay_output()();
    }
    } finally { stack_pop($frame); }
}

/*
 * swallowed()
 *
 * The hero is swallowed.  Show a special graphics sequence for this.  This
 * bypasses all of the display routines and messes with buffered screen
 * directly.  This method works because both vision and display check for
 * being swallowed.
 */
export function swallowed(first) { /* void */
    let lastx = static_var("swallowed.lastx", short), lasty = static_var("swallowed.lasty", short); /* last swallowed position */
    let swallower, left_ok, rght_ok;

    if (first) {
        cls();
        bot();
    } else {
        let x, y;

        /* Clear old location */
        for (y = lasty[0] - 1; y <= lasty[0] + 1; y++)
            for (x = lastx[0] - 1; x <= lastx[0] + 1; x++)
                if (isok(x, y))
                    show_glyph(x, y, GLYPH_UNEXPLORED);
    }

    swallower = monsndx(u.ustuck.data);
    /* assume isok(u.ux,u.uy) */
    left_ok = isok(u.ux - 1, u.uy);
    rght_ok = isok(u.ux + 1, u.uy);
    /*
     *  Display the hero surrounded by the monster's stomach.
     */
    if (isok(u.ux, u.uy - 1)) {
        if (left_ok)
            show_glyph(u.ux - 1, u.uy - 1,
                       swallow_to_glyph(swallower, S_sw_tl));
        show_glyph(u.ux, u.uy - 1, swallow_to_glyph(swallower, S_sw_tc));
        if (rght_ok)
            show_glyph(u.ux + 1, u.uy - 1,
                       swallow_to_glyph(swallower, S_sw_tr));
    }

    if (left_ok)
        show_glyph(u.ux - 1, u.uy, swallow_to_glyph(swallower, S_sw_ml));
    show_glyph(u.ux, u.uy, ((u.usteed && ((!u.usteed.minvis || See_invisible()) && !u.usteed.mundetected)) ? ridden_mon_to_glyph(u.usteed, rn2_on_display_rng) : ((U_AP_TYPE() == M_AP_NOTHING) ? hero_glyph() : ((U_AP_TYPE() == M_AP_FURNITURE) ? cmap_to_glyph(int(gy.youmonst.mappearance)) : ((U_AP_TYPE() == M_AP_OBJECT) ? objnum_to_glyph(int(gy.youmonst.mappearance)) : monnum_to_glyph(int(gy.youmonst.mappearance), Ugender()))))));
    if (rght_ok)
        show_glyph(u.ux + 1, u.uy, swallow_to_glyph(swallower, S_sw_mr));

    if (isok(u.ux, u.uy + 1)) {
        if (left_ok)
            show_glyph(u.ux - 1, u.uy + 1,
                       swallow_to_glyph(swallower, S_sw_bl));
        show_glyph(u.ux, u.uy + 1, swallow_to_glyph(swallower, S_sw_bc));
        if (rght_ok)
            show_glyph(u.ux + 1, u.uy + 1,
                       swallow_to_glyph(swallower, S_sw_br));
    }

    /* Update the swallowed position. */
    lastx[0] = u.ux;
    lasty[0] = u.uy;
}

/*
 * under_water()
 *
 * Similar to swallowed() in operation.  Shows hero when underwater
 * except when in water level.  Special routines exist for that.
 */
export function under_water(mode) { /* void */
    let lastx = static_var("under_water.lastx", short), lasty = static_var("under_water.lasty", short);
    let dela = static_var("under_water.dela", schar);
    let x, y;

    /* swallowing has a higher precedence than under water */
    if (Is_waterlevel(u.uz) || u.uswallow)
        return;

    /* full update */
    if (mode == 1 || dela[0]) {
        cls();
        dela[0] = FALSE;

    /* delayed full update */
    } else if (mode == 2) {
        dela[0] = TRUE;
        return;

    /* limited update */
    } else {
        for (y = lasty[0] - 1; y <= lasty[0] + 1; y++)
            for (x = lastx[0] - 1; x <= lastx[0] + 1; x++)
                if (isok(x, y))
                    show_glyph(x, y, GLYPH_UNEXPLORED);
    }

    /*
     * TODO?  Should this honor Xray radius rather than force radius 1?
     */

    for (x = u.ux - 1; x <= u.ux + 1; x++)
        for (y = u.uy - 1; y <= u.uy + 1; y++)
            if (isok(x, y) && (is_pool_or_lava(x, y) || is_ice(x, y))) {
                if (Blind() && !u_at(x, y))
                    show_glyph(x, y, GLYPH_UNEXPLORED);
                else
                    newsym(x, y);
            }
    lastx[0] = u.ux;
    lasty[0] = u.uy;
}

/*
 *      under_ground()
 *
 *      Very restricted display.  You can only see yourself.
 */
export function under_ground(mode) { /* void */
    let dela = static_var("under_ground.dela", schar);

    /* swallowing has a higher precedence than under ground */
    if (u.uswallow)
        return;

    /* full update */
    if (mode == 1 || dela[0]) {
        cls();
        dela[0] = FALSE;

    /* delayed full update */
    } else if (mode == 2) {
        dela[0] = TRUE;
        return;

    /* limited update */
    } else {
        newsym(u.ux, u.uy);
    }
}

/* ======================================================================== */

/*
 * Loop through all of the monsters and update them.  Called when:
 *      + going blind & telepathic
 *      + regaining sight & telepathic
 *      + getting and losing infravision
 *      + hallucinating
 *      + doing a full screen redraw
 *      + see invisible times out or a ring of see invisible is taken off
 *        or intrinsic see invisible is stolen by a gremlin
 *      + when a potion of see invisible is quaffed or a ring of see
 *        invisible is put on
 *      + gaining telepathy when blind [givit() in eat.c, pleased() in pray.c]
 *      + losing telepathy while blind [xkilled() in mon.c, attrcurse() in
 *        sit.c]
 */
export function see_monsters() { /* void */
    let mon;
    let new_warn_obj_cnt = 0;

    if (gd.defer_see_monsters)
        return;

    /* steed and unseen engulfer/holder/holdee are recognized via touch
       even if they aren't going to be rendered; other monsters
       may get flagged as having been seen by display_monster() if it's
       called by newsym() */
    if (u.usteed)
        u.usteed.meverseen = 1;
    if (u.ustuck)
        u.ustuck.meverseen = 1;

    /* loop through level.monsters (aka fmon) */
    for (mon = fmon(); mon; mon = mon.nmon) {
        if (DEADMONSTER(mon))
            continue;
        if ((mon.mstate & MON_STILL_ARRIVING) != 0)
            continue;
        newsym(mon.mx, mon.my);
        if (mon.wormno)
            see_wsegs(mon);
        if (Warn_of_mon()
            && (svc.context.warntype.obj & mon.data.mflags2) != 0)
            new_warn_obj_cnt++;
    }

    /*
     * Make Sting glow blue or stop glowing if required.
     */
    if (new_warn_obj_cnt != gw.warn_obj_cnt) {
        Sting_effects(new_warn_obj_cnt);
        gw.warn_obj_cnt = new_warn_obj_cnt;
    }

    /* when mounted, hero's location gets caught by monster loop */
    if (!u.usteed)
        newsym(u.ux, u.uy);
}

function mimic_light_blocking(mtmp) { /* void */
    if (mtmp.minvis && is_lightblocker_mappear(mtmp)) {
        if (See_invisible())
            block_point(mtmp.mx, mtmp.my);
        else
            unblock_point(mtmp.mx, mtmp.my);
    }
}

/*
 * Block/unblock light depending on what a mimic is mimicking and if it's
 * invisible or not.  Should be called only when the state of See_invisible
 * changes.
 */
export function set_mimic_blocking() { /* void */
    iter_mons(mimic_light_blocking);
}

/*
 * Loop through all of the object *locations* and update them.  Called when
 *      + hallucinating.
 */
export function see_objects() { /* void */
    let obj;

    for (obj = fobj(); obj; obj = obj.nobj)
        if (vobj_at(obj.ox, obj.oy) == obj)
            newsym(obj.ox, obj.oy);

    /* Qt's "paper doll" subset of persistent inventory shows map tiles
       for objects which aren't on the floor so not handled by above loop;
       inventory which includes glyphs should also be affected, so do this
       for all interfaces in case any feature that for persistent inventory */
    update_inventory();
}

/* mark the top object of nearby stacks as having been seen, and if
   that object was being displayed as generic, redisplay it as specific */
export function see_nearby_objects() { /* void */
    let obj;
    let glyph;
    let ix, iy, x = u.ux, y = u.uy;
    /* these 'r' and 'neardist' calculations match distant_name(objnam.c) */
    let r = (u.xray_range > 2) ? u.xray_range : 2,

        neardist = (r * r) * 2 - r; /* same as r*r + r*(r-1) */

    /* [note: this could be optimized to avoid the distu() calculations] */
    for (iy = y - r; iy <= y + r; ++iy)
        for (ix = x - r; ix <= x + r; ++ix) {
            if (!isok(ix, iy))
                continue;
            /* skip if no object or the object has already been marked as
               having been seen up close */
            if ((obj = vobj_at(ix, iy)) == null || obj.dknown)
                continue;
            /* skip if the spot can't be seen or is too far (diagonal) */
            if (!cansee(ix, iy) || distu(ix, iy) > neardist)
                continue;

            observe_object(obj);
            /* operate on remembered glyph rather than current one */
            glyph = levl()[ix][iy].glyph;
            if (glyph_is_generic_object(glyph))
                newsym_force(ix, iy);
        }
}

/*
 * Update hallucinated traps.
 */
export function see_traps() { /* void */
    let trap;
    let glyph;

    for (trap = gf.ftrap; trap; trap = trap.ntrap) {
        glyph = _glyph_at(trap.tx, trap.ty);
        if (glyph_is_trap(glyph))
            newsym(trap.tx, trap.ty);
    }
}

/*  glyph, ttychar, framecolor,
    { glyphflags, { NO_COLOR, sym.symidx },
    customcolor, color256idx, tileidx, u } */
const no_ginfo = static_struct("no_ginfo", struct_glyphinfo, {
    glyph: NO_GLYPH, ttychar: ord(' '), framecolor: NO_COLOR,
    gm: { glyphflags: MG_BADXY, sym: { color: NO_COLOR, symidx: 0 },
    customcolor: 0,
    color256idx: 0, tileidx: 0

      , u: null
    }
});

/* Note that the 'glyph' argument is not used in the expansion
 * of this !UNBUFFERED_GLYPHINFO (default) variation, but is
 * a requirement for the UNBUFFERED_GLYPHINFO variation */

/* glyph, ttychar, framecolor, { glyphflags, { sym.symidx }, nhcolor,
                     tileidx, 0} */
export const nul_glyphinfo = static_struct("nul_glyphinfo", struct_glyphinfo, {
    glyph: NO_GLYPH, ttychar: ord(' '), framecolor: NO_COLOR,
        gm: {  /* glyph_map */
            glyphflags: MG_UNEXPL,
            sym: { color: NO_COLOR, symidx: SYM_UNEXPLORED + SYM_OFF_X },
              customcolor: 0,
              color256idx: 0, tileidx: 0

               , u: null
        }
});

export const glyphmap = static_array("glyphmap", struct_glyph_map_entry, MAX_GLYPH, [
    { glyphflags: 0, sym: { color: NO_COLOR, symidx: 0 },
      customcolor: 0,
      color256idx: 0, tileidx: 0

       , u: null
    }
]);

/*
 * Put the cursor on the hero.  Flush all accumulated glyphs before doing it.
 */
export function curs_on_u() { /* void */
    flush_screen(1); /* Flush waiting glyphs & put cursor on hero */
}

/* the #redraw command */
export function doredraw() { /* int */
    docrt();
    return ECMD_OK;
}

/* the main refresh-the-screen routine */
export function docrt() { /* void */
    docrt_flags(docrtRecalc);
}

/* docrt() with finer control */
export function docrt_flags(refresh_flags) { /* void */
    var x, y;
    var lev;
    var maponly = +((refresh_flags & docrtMapOnly) != 0),
            redrawonly = +((refresh_flags & docrtRefresh) != 0),
            nocls = +((refresh_flags & docrtNocls) != 0);

    if (!u.ux || program_state.in_docrt)
        return; /* display isn't ready yet */

    program_state.in_docrt = TRUE;

    post_map: { if (redrawonly) {
        redraw_map(FALSE);
        break post_map;
    }
    if (u.uswallow) {
        swallowed(1);
        break post_map;
    }
    if (Underwater() && !Is_waterlevel(u.uz)) {
        under_water(1);
        break post_map;
    }
    if (u.uburied) { /* [not implemented] */
        under_ground(1);
        break post_map;
    }

    /* shut down vision */
    vision_recalc(2);

    /*
     * This routine assumes that cls() does the following:
     *      + fills the physical screen with the symbol for rock
     *      + clears the glyph buffer
     */
    if (!nocls)
        cls();

    /* display memory */
    for (x = 1; x < COLNO; x++) {
        lev = ptr_add(levl()[x][0], 0);
        for (y = 0; y < ROWNO; y++, lev = ptr_add(lev, 1))
            show_glyph(x, y, lev.glyph);
    }

    /* see what is to be seen */
    vision_recalc(0);

    /* overlay with monsters */
    see_monsters();
 }

    if (!maponly) {
        /* perm_invent */
        update_inventory();
        /* status */
        disp.botlx = TRUE; /* force a redraw of the bottom lines */
        /* note: caller needs to call bot() to actually redraw status */
    }
    program_state.in_docrt = FALSE;
}

/* for panning beyond a clipped region; resend the current map data to
   the interface rather than use docrt()'s regeneration of that data */
export function redraw_map(cursor_on_u) { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let glyph;
    let bkglyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);

    /*
     * Not sure whether this is actually necessary; save and restore did
     * used to get much too involved with each dungeon level as it was
     * read and written.
     *
     * !u.ux: display isn't ready yet; (restoring || !on_level()): was part
     * of cliparound() but interface shouldn't access this much internals
     */
    if (!u.ux || suppress_map_output() || !on_level(u.uz0, u.uz))
        return;

    /*
     * This yields sensible clipping when #terrain+getpos is in
     * progress and the screen displays something other than what
     * the map would currently be showing.
     */
    for (y = 0; y < ROWNO; ++y)
        for (x = 1; x < COLNO; ++x) {
            glyph = _glyph_at(x, y); /* not levl[x][y].glyph */
            get_bkglyph_and_framecolor(x, y, ref_of(bkglyphinfo, "glyph"),
                                       ref_of(bkglyphinfo, "framecolor"));
            print_glyph()(WIN_MAP, x, y,
                        ((((((x) < 0) || ((y) < 0)) || ((x) >= COLNO)) || ((y) >= ROWNO)) ? no_ginfo : gg.gbuf[(y)][(x)].glyphinfo), bkglyphinfo);
        }
    flush_screen(cursor_on_u);

    (glyph);
    } finally { stack_pop($frame); }
}

/*
 * =======================================================
 */
export function reglyph_darkroom() { /* void */
    let x, y;

    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            let lev = levl()[x][y];

            if (!flags.dark_room) {
                if (lev.glyph == cmap_to_glyph(S_corr)
                    && lev.waslit)
                    lev.glyph = cmap_to_glyph(S_litcorr);
            } else {
                if (lev.glyph == cmap_to_glyph(S_litcorr)
                    && !cansee(x, y))
                    lev.glyph = cmap_to_glyph(S_corr);
            }

            if (!flags.dark_room || !iflags.wc_color
                || Is_rogue_level(u.uz)) {
                if (lev.glyph == cmap_to_glyph(S_darkroom))
                    lev.glyph = lev.waslit ? cmap_to_glyph(S_room)
                                             : GLYPH_NOTHING;
            } else {
                if (lev.glyph == cmap_to_glyph(S_room) && lev.seenv
                    && lev.waslit && !cansee(x, y))
                    lev.glyph = cmap_to_glyph(S_darkroom);
                else if (lev.glyph == GLYPH_NOTHING
                         && lev.typ == ROOM && lev.seenv && !cansee(x, y))
                    lev.glyph = cmap_to_glyph(S_darkroom);
            }
        }
    if (flags.dark_room && iflags.wc_color)
        uchars[gs.showsyms + S_darkroom] = uchars[gs.showsyms + S_room];
    else
        uchars[gs.showsyms + S_darkroom] = uchars[gs.showsyms + (SYM_NOTHING + SYM_OFF_X)];
}

/* ======================================================================== */
/* Glyph Buffering (3rd screen) =========================================== */

/* FIXME: This is a dirty hack, because newsym() doesn't distinguish
 * between object piles and single objects, it doesn't mark the location
 * for update. */
export function newsym_force(x, y) { /* void */
    newsym(x, y);
    gg.gbuf[y][x].gnew = 1;
    if (gg.gbuf_start[y] > x)
        gg.gbuf_start[y] = x;
    if (gg.gbuf_stop[y] < x)
        gg.gbuf_stop[y] = x;
}

/*
 * Store the glyph in the 3rd screen for later flushing.
 */
export function show_glyph(x, y, glyph) { /* void */
    const $frame = stack_frame(); try {
    let glyphinfo = stack_struct(struct_glyphinfo);

    let show_glyph_change = FALSE;
    let oldglyph;

    /* don't process map glyphs when saving, restoring, or in_mklev */
    if (_suppress_map_output())
        return;

    //if (glyph == 3972 || glyph == 3988)
    //    __debugbreak();
    /*
     * Check for bad positions and glyphs.
     */
    if (!isok(x, y)) {
        let text = _("");
        let offset = -1;

        /* column 0 is invalid, but it's often used as a flag, so ignore it */
        if (x == 0)
            return;

        /*
         *  This assumes an ordering of the offsets.  See display.h for
         *  the definition.
         */
        if (glyph < 0 || glyph >= MAX_GLYPH) {
            /* invalid location and also invalid glyph */
            text = _("invalid");
        } else if (int(offset = (glyph - GLYPH_NOTHING_OFF)) >= 0) {
            text = _("nothing");
        } else if (int(offset = (glyph - GLYPH_UNEXPLORED_OFF)) >= 0) {
            text = _("unexplored");
        } else if (int(offset = (glyph - GLYPH_STATUE_FEM_PILETOP_OFF)) >= 0) {
            text = _("statue of a female monster at top of a pile");
        } else if (int(offset = (glyph - GLYPH_STATUE_MALE_PILETOP_OFF)) >= 0) {
            text = _("statue of a male monster at top of a pile");
        } else if (int(offset = (glyph - GLYPH_BODY_PILETOP_OFF)) >= 0) {
            text = _("body at top of a pile");
        } else if (int(offset = (glyph - GLYPH_OBJ_PILETOP_OFF)) >= 0) {
            text = (glyph_is_piletop_generic_obj(glyph)
                    ? _("generic object at top of a pile")
                    : _("object at top of a pile"));
        } else if (int(offset = (glyph - GLYPH_STATUE_FEM_OFF)) >= 0) {
            text = _("statue of female monster");
        } else if (int(offset = (glyph - GLYPH_STATUE_MALE_OFF)) >= 0) {
            text = _("statue of male monster");
        } else if (int(offset = (glyph - GLYPH_WARNING_OFF)) >= 0) {
            /* warn flash */
            text = _("warning explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_FROSTY_OFF)) >= 0) {
            text = _("frosty explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_FIERY_OFF)) >= 0) {
            text = _("fiery explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_MAGICAL_OFF)) >= 0) {
            text = _("magical explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_WET_OFF)) >= 0) {
            text = _("wet explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_MUDDY_OFF)) >= 0) {
            text = _("muddy explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_NOXIOUS_OFF)) >= 0) {
            text = _("noxious explosion");
        } else if (int(offset = (glyph - GLYPH_EXPLODE_DARK_OFF)) >= 0) {
            text = _("dark explosion");
        } else if (int(offset = (glyph - GLYPH_SWALLOW_OFF)) >= 0) {
            text = _("swallow");
        } else if (int(offset = (glyph - GLYPH_CMAP_C_OFF)) >= 0) {
            text = _("cmap C");
        } else if (int(offset = (glyph - GLYPH_ZAP_OFF)) >= 0) {
            text = _("zap");
        } else if (int(offset = (glyph - GLYPH_CMAP_B_OFF)) >= 0) {
            text = _("cmap B");
        } else if (int(offset = (glyph - GLYPH_ALTAR_OFF)) >= 0) {
            text = _("altar");
        } else if (int(offset = (glyph - GLYPH_CMAP_A_OFF)) >= 0) {
            text = _("cmap A");
        } else if (int(offset = (glyph - GLYPH_CMAP_SOKO_OFF)) >= 0) {
            text = _("sokoban dungeon walls");
        } else if (int(offset = (glyph - GLYPH_CMAP_KNOX_OFF)) >= 0) {
            text = _("knox dungeon walls");
        } else if (int(offset = (glyph - GLYPH_CMAP_GEH_OFF)) >= 0) {
            text = _("gehennom dungeon walls");
        } else if (int(offset = (glyph - GLYPH_CMAP_MINES_OFF)) >= 0) {
            text = _("gnomish mines dungeon walls");
        } else if (int(offset = (glyph - GLYPH_CMAP_MAIN_OFF)) >= 0) {
            text = _("main dungeon walls");
        } else if (int(offset = (glyph - GLYPH_CMAP_STONE_OFF)) >= 0) {
            text = _("stone");
        } else if (int(offset = (glyph - GLYPH_OBJ_OFF)) >= 0) {
            text = (glyph_is_normal_generic_obj(glyph)
                    ? _("generic object")
                    : _("object"));
        } else if (int(offset = (glyph - GLYPH_RIDDEN_FEM_OFF)) >= 0) {
            text = _("ridden female monster");
        } else if (int(offset = (glyph - GLYPH_RIDDEN_MALE_OFF)) >= 0) {
            text = _("ridden male monster");
        } else if (int(offset = (glyph - GLYPH_BODY_OFF)) >= 0) {
            text = _("body");
        } else if (int(offset = (glyph - GLYPH_DETECT_FEM_OFF)) >= 0) {
            text = _("detected female monster");
        } else if (int(offset = (glyph - GLYPH_DETECT_MALE_OFF)) >= 0) {
            text = _("detected male monster");
        } else if (int(offset = (glyph - GLYPH_INVIS_OFF)) >= 0) {
            text = _("invisible monster");
        } else if (int(offset = (glyph - GLYPH_PET_FEM_OFF)) >= 0) {
            text = _("female pet");
        } else if (int(offset = (glyph - GLYPH_PET_MALE_OFF)) >= 0) {
            text = _("male pet");
        } else if (int(offset = (glyph - GLYPH_MON_FEM_OFF)) >= 0) {
            text = _("female monster");
        } else if ((offset = (glyph - GLYPH_MON_MALE_OFF)) >= 0) {
            text = _("male monster");
        }
        impossible(_("show_glyph:  bad pos <%d,%d> with glyph %d [%s %d]."),
                   x, y, glyph, text, offset);
        return;
    } else if (glyph < 0 || glyph >= MAX_GLYPH) {
        /* valid location but invalid glyph */
        impossible(_("show_glyph:  bad glyph %d [max %d] at <%d,%d>."),
                   glyph, MAX_GLYPH, x, y);
        return;
    }

    /* without UNBUFFERED_GLYPHINFO defined the glyphinfo values are buffered
       alongside the glyphs themselves for better performance, increased
       buffer size */
    map_glyphinfo(x, y, glyph, 0, glyphinfo);

    oldglyph = gg.gbuf[y][x].glyphinfo.glyph;

    if (a11y.glyph_updates && !a11y.mon_notices_blocked
        && !program_state.in_docrt && !program_state.gameover
        && !program_state.in_getlev && !program_state.stopprint
        && !_suppress_map_output()
        && (oldglyph != glyph || gg.gbuf[y][x].gnew)) {
        let c = glyph_to_cmap(glyph);

        if ((glyph_is_nothing(oldglyph) || glyph_is_unexplored(oldglyph)
             || is_cmap_furniture(c))
            && !is_cmap_wall(c) && !is_cmap_room(c)) {
            if ((a11y.mon_notices && glyph_is_monster(glyph))
                || glyph_is_monster(oldglyph)
                || u_at(x, y)) {
                ; /* nothing */
            } else {
                show_glyph_change = TRUE;
            }
        }
    }

    if (gg.gbuf[y][x].glyphinfo.glyph != glyph

        /* flags might change (single object vs pile, monster tamed or pet
           gone feral), color might change (altar's alignment converted by
           invisible hero), but ttychar normally won't change unless the
           glyph does too (changing boulder symbol would be an exception,
           but that triggers full redraw so doesn't matter here); still,
           be thorough and check everything */
        || gg.gbuf[y][x].glyphinfo.ttychar != glyphinfo.ttychar
        || gg.gbuf[y][x].glyphinfo.gm.customcolor != glyphinfo.gm.customcolor
        || gg.gbuf[y][x].glyphinfo.gm.glyphflags != glyphinfo.gm.glyphflags
        || gg.gbuf[y][x].glyphinfo.gm.sym.color != glyphinfo.gm.sym.color
        || gg.gbuf[y][x].glyphinfo.gm.tileidx != glyphinfo.gm.tileidx

        || iflags.use_background_glyph) {
        gg.gbuf[y][x].glyphinfo.glyph = glyph;
        gg.gbuf[y][x].gnew = 1;

        gg.gbuf[y][x].glyphinfo.glyph = glyphinfo.glyph;
        gg.gbuf[y][x].glyphinfo.ttychar = glyphinfo.ttychar;
        struct_assign(gg.gbuf[y][x].glyphinfo.gm, glyphinfo.gm);

        if (gg.gbuf_start[y] > x)
            gg.gbuf_start[y] = x;
        if (gg.gbuf_stop[y] < x)
            gg.gbuf_stop[y] = x;
    }

    if (show_glyph_change) {
        let buf = stack_array(char, BUFSZ);
        let cc = stack_struct(struct_nhcoord);
        let sym = 0;
        let firstmatch = stack_var(ptr_to(char), 0);
        let tmp_accessiblemsg = a11y.accessiblemsg;

        a11y.accessiblemsg = TRUE;
        cc.x = x, cc.y = y;
        do_screen_description(struct_copy(cc), TRUE, sym, buf, firstmatch, null);
        pline_xy(x, y, _("%s."), firstmatch[0]);
        a11y.accessiblemsg = tmp_accessiblemsg;
    }
    } finally { stack_pop($frame); }
}

/*
 * Reset the changed glyph borders so that none of the 3rd screen has
 * changed.
 */
export function reset_glyph_bbox() { {
        let i;

        for (i = 0; i < ROWNO; i++) {
            gg.gbuf_start[i] = COLNO - 1;
            gg.gbuf_stop[i] = 0;
        }
    } }

const nul_gbuf = static_struct("nul_gbuf", gbuf_entry, {
    gnew: 0,                                 /* gnew */
    glyphinfo: { glyph: GLYPH_UNEXPLORED, ttychar: ord(' '), framecolor: NO_COLOR,
       /* glyphinfo.glyph, glyphinfo.ttychar */
        /* glyphinfo.gm */
        gm: { glyphflags: MG_UNEXPL, sym: { color: NO_COLOR, symidx: 0 },
          customcolor: 0,
          color256idx: 0, tileidx: 0

            , u: null
        }
    }
});

/*
 * Turn the 3rd screen into UNEXPLORED that needs to be refreshed.
 */
export function clear_glyph_buffer() { /* void */
    let x, y;
    let gptr = ptr_add(gg.gbuf[0][0], 0);
    let giptr = gptr.glyphinfo;

    nul_gbuf.gnew = (giptr.ttychar != nul_gbuf.glyphinfo.ttychar
                     || giptr.gm.sym.color != nul_gbuf.glyphinfo.gm.sym.color
                     || giptr.gm.glyphflags
                        != nul_gbuf.glyphinfo.gm.glyphflags
                     || giptr.gm.customcolor
                        != nul_gbuf.glyphinfo.gm.customcolor
                     || giptr.gm.tileidx != nul_gbuf.glyphinfo.gm.tileidx)

                         ? 1 : 0;
    for (y = 0; y < ROWNO; y++) {
        gptr = ptr_add(gg.gbuf[y][0], 0);
        for (x = COLNO; x; x--) {
            struct_assign((gptr = ptr_add(gptr, 1), ptr_add(gptr, -1)), nul_gbuf);
        }
        gg.gbuf_start[y] = 1;
        gg.gbuf_stop[y] = COLNO - 1;
    }
}

/* used by tty after menu or text popup has temporarily overwritten the map
   and it has been erased so shows spaces, not necessarily S_unexplored */
export function row_refresh(start, stop, y) { /* void */
    const $frame = stack_frame(); try {
    let x;
    let glyph;
    let force;
    let gptr = gg.gbuf[0][0];
    let bkglyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);
    let giptr = gptr.glyphinfo;

    force = (giptr.ttychar != nul_gbuf.glyphinfo.ttychar
                 || giptr.gm.sym.color != nul_gbuf.glyphinfo.gm.sym.color
                 || giptr.gm.glyphflags != nul_gbuf.glyphinfo.gm.glyphflags
                 || giptr.gm.customcolor != nul_gbuf.glyphinfo.gm.customcolor
                 || giptr.gm.tileidx != nul_gbuf.glyphinfo.gm.tileidx)

                 ? 1 : 0;
    for (x = start; x <= stop; x++) {
        gptr = gg.gbuf[y][x];
        glyph = gptr.glyphinfo.glyph;
        get_bkglyph_and_framecolor(x, y, ref_of(bkglyphinfo, "glyph"),
                                   ref_of(bkglyphinfo, "framecolor"));
        if (force || glyph != GLYPH_UNEXPLORED
            || bkglyphinfo.framecolor != NO_COLOR) {
            print_glyph()(WIN_MAP, x, y,
                        ((((((x) < 0) || ((y) < 0)) || ((x) >= COLNO)) || ((y) >= ROWNO)) ? no_ginfo : gg.gbuf[(y)][(x)].glyphinfo), bkglyphinfo);
        }
    }
    } finally { stack_pop($frame); }
}

export function cls() { /* void */
    let in_cls = static_var("cls.in_cls", schar, 0);

    if (in_cls[0])
        return;
    in_cls[0] = TRUE;
    display_nhwindow()(WIN_MESSAGE, FALSE); /* flush messages */
    disp.botlx = TRUE;                 /* force update of botl window */
    clear_nhwindow()(WIN_MAP);              /* clear physical screen */

    clear_glyph_buffer(); /* force gbuf[][].glyph to unexplored */
    in_cls[0] = FALSE;
}

/*
 * Synch the third screen with the display.
 */
export function flush_screen(cursor_on_u) { /* void */
    const $frame = stack_frame(); try {
    /* Prevent infinite loops on errors:
     *      flush_screen->print_glyph->impossible->pline->flush_screen
     */
    let flushing = static_var("flush_screen.flushing", int, 0);
    let delay_flushing = static_var("flush_screen.delay_flushing", int, 0);
    let x, y;
    let bkglyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);
    let bkglyph = stack_var(int);

    /* 5.0: don't update map, status, or perm_invent during save/restore */
    if (_suppress_map_output())
        return;

    if (cursor_on_u == -1)
        delay_flushing[0] = +!delay_flushing[0];
    if (delay_flushing[0])
        return;
    if (flushing[0])
        return; /* if already flushing then return */
    flushing[0] = 1;

    if (program_state.done_hup)
        return;

    /* get this done now, before we place the cursor on the hero */
    if (disp.botl || disp.botlx)
        bot();
    else if (disp.time_botl)
        timebot();

    for (y = 0; y < ROWNO; y++) {
        let gptr = ptr_add(gg.gbuf[y][0], x = gg.gbuf_start[y]);

        for (; x <= gg.gbuf_stop[y]; gptr = ptr_add(gptr, 1), x++) {
            get_bkglyph_and_framecolor(x, y, bkglyph,
                                       ref_of(bkglyphinfo, "framecolor"));
            if (gptr.gnew
                || (gw.wsettings.map_frame_color != NO_COLOR
                    && bkglyphinfo.framecolor != NO_COLOR)) {
                /* map_glyphinfo() won't touch framecolor */
                map_glyphinfo(x, y, bkglyph[0], 0, bkglyphinfo);
                print_glyph()(WIN_MAP, x, y,
                            ((((((x) < 0) || ((y) < 0)) || ((x) >= COLNO)) || ((y) >= ROWNO)) ? no_ginfo : gg.gbuf[(y)][(x)].glyphinfo),
                            bkglyphinfo);
                gptr.gnew = 0;
            }
        }
    }
    reset_glyph_bbox();

    /* after map update, before display_nhwindow(WIN_MAP) */
    if (cursor_on_u)
        curs()(WIN_MAP, u.ux, u.uy); /* move cursor to the hero */

    display_nhwindow()(WIN_MAP, FALSE);
    flushing[0] = 0;
    } finally { stack_pop($frame); }
}

/* ======================================================================== */

/*
 * back_to_glyph()
 *
 * Use the information in the rm structure at the given position to create
 * a glyph of a background.
 *
 * I had to add a field in the rm structure (horizontal) so that we knew
 * if open doors and secret doors were horizontal or vertical.  Previously,
 * the screen symbol had the horizontal/vertical information set at
 * level generation time.
 *
 * I used the 'ladder' field (really doormask) for deciding if stairwells
 * were up or down.  I didn't want to check the upstairs and dnstairs
 * variables.
 */
export function back_to_glyph(x, y) { /* int */
    let idx, bypass_glyph = NO_GLYPH;
    let ptr = (levl()[x][y]);
    let sway;

    switch (ptr.typ) {
    case SCORR:
    case STONE:
        idx = svl.level.flags.arboreal ? S_tree : S_stone;
        break;
    case ROOM:
        idx = S_room;
        break;
    case CORR:
        idx = (ptr.waslit || flags.lit_corridor) ? S_litcorr : S_corr;
        break;
    case SDOOR:
        if (ptr.candig) {
            idx = S_tree;
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case HWALL:
    case VWALL:
    case TLCORNER:
    case TRCORNER:
    case BLCORNER:
    case BRCORNER:
    case CROSSWALL:
    case TUWALL:
    case TDWALL:
    case TLWALL:
    case TRWALL:
        idx = ptr.seenv ? wall_angle(ptr) : S_stone;
        break;
    case DOOR:
        if (ptr.flags) {
            if (ptr.flags & D_BROKEN)
                idx = S_ndoor;
            else if (ptr.flags & D_ISOPEN)
                idx = ptr.horizontal ? S_hodoor : S_vodoor;
            else /* else is closed */
                idx = ptr.horizontal ? S_hcdoor : S_vcdoor;
        } else
            idx = S_ndoor;
        break;
    case IRONBARS:
        idx = S_bars;
        break;
    case TREE:
        idx = S_tree;
        break;
    case POOL:
    case MOAT:
        idx = S_pool;
        break;
    case STAIRS:
        sway = stairway_at(x, y);
        if (known_branch_stairs(sway))
            idx = (ptr.flags & LA_DOWN) ? S_brdnstair : S_brupstair;
        else
            idx = (ptr.flags & LA_DOWN) ? S_dnstair : S_upstair;
        break;
    case LADDER:
        sway = stairway_at(x, y);
        if (known_branch_stairs(sway))
            idx = (ptr.flags & LA_DOWN) ? S_brdnladder : S_brupladder;
        else
            idx = (ptr.flags & LA_DOWN) ? S_dnladder : S_upladder;
        break;
    case FOUNTAIN:
        idx = S_fountain;
        break;
    case SINK:
        idx = S_sink;
        break;
    case ALTAR:
        idx = S_altar;  /* not really used */
        bypass_glyph = altar_to_glyph(ptr.flags);
        break;
    case GRAVE:
        idx = S_grave;
        break;
    case THRONE:
        idx = S_throne;
        break;
    case LAVAPOOL:
        idx = S_lava;
        break;
    case LAVAWALL:
        idx = S_lavawall;
        break;
    case ICE:
        idx = S_ice;
        break;
    case AIR:
        idx = S_air;
        break;
    case CLOUD:
        idx = S_cloud;
        break;
    case WATER:
        idx = S_water;
        break;
    case DBWALL:
        idx = ptr.horizontal ? S_hcdbridge : S_vcdbridge;
        break;
    case DRAWBRIDGE_UP:
        switch (ptr.flags & DB_UNDER) {
        case DB_MOAT:
            idx = S_pool;
            break;
        case DB_LAVA:
            idx = S_lava;
            break;
        case DB_ICE:
            idx = S_ice;
            break;
        case DB_FLOOR:
            idx = S_room;
            break;
        default:
            impossible(_("Strange db-under: %d"),
                       ptr.flags & DB_UNDER);
            idx = S_room; /* something is better than nothing */
            break;
        }
        break;
    case DRAWBRIDGE_DOWN:
        idx = ptr.horizontal ? S_hodbridge : S_vodbridge;
        break;
    default:
        impossible(_("back_to_glyph:  unknown level type [ = %d ]"), ptr.typ);
        idx = S_room;
        break;
    }

    return (bypass_glyph != NO_GLYPH) ? bypass_glyph : cmap_to_glyph(idx);
}

/*
 * swallow_to_glyph()
 *
 * Convert a monster number and a swallow location into the correct glyph.
 * If you don't want a patchwork monster while hallucinating, decide on
 * a random monster in swallowed() and don't use what_mon() here.
 */
function swallow_to_glyph(mnum, loc) { /* int */
    let m_3 = what_mon(mnum, rn2_on_display_rng) << 3;

    if (loc < S_sw_tl || S_sw_br < loc) {
        impossible(_("swallow_to_glyph: bad swallow location"));
        loc = S_sw_br;
    }
    return (m_3 | (loc - S_sw_tl)) + GLYPH_SWALLOW_OFF;
}

/*
 * zapdir_to_glyph()
 *
 * Change the given zap direction and beam type into a glyph.  Each beam
 * type has four glyphs, one for each of the symbols below.  The order of
 * the zap symbols [0-3] as defined in defsym.h are:
 *
 *      |  S_vbeam      ( 0, 1) or ( 0,-1)
 *      -  S_hbeam      ( 1, 0) or (-1, 0)
 *      \  S_lslant     ( 1, 1) or (-1,-1)
 *      /  S_rslant     (-1, 1) or ( 1,-1)
 */
export function zapdir_to_glyph(dx, dy, beam_type) { /* int */
    if (beam_type >= NUM_ZAP) {
        impossible(_("zapdir_to_glyph:  illegal beam type"));
        beam_type = 0;
    }
    dx = (dx == dy) ? 2 : (dx && dy) ? 3 : dx ? 1 : 0;

    return ((beam_type << 2) | dx) + GLYPH_ZAP_OFF;
}

/*
 * Utility routine for dowhatis() used to find out the glyph displayed at
 * the location.  This isn't necessarily the same as the glyph in the levl
 * structure, so we must check the "third screen".
 */
export function glyph_at(x, y) { /* int */
    if (x < 0 || y < 0 || x >= COLNO || y >= ROWNO)
        return cmap_to_glyph(S_room); /* XXX */
    return gg.gbuf[y][x].glyphinfo.glyph; /* _glyph_at(x,y) */
}

/*
 * Get the glyph for the background so that it can potentially
 * be merged into graphical window ports to improve the appearance
 * of stuff on dark room squares and the plane of air etc.
 * [This should be using background as recorded for #overview rather
 * than current data from the map.]
 *
 * Also get the frame color to use for highlighting the map location
 * for some purpose.
 *
 */

function get_bkglyph_and_framecolor(
    x, y,
    bkglyph,
    framecolor) { /* void */
    let idx, tmp_bkglyph = GLYPH_UNEXPLORED;
    let lev = levl()[x][y];

    if (iflags.use_background_glyph && lev.seenv != 0
        && (gg.gbuf[y][x].glyphinfo.glyph != GLYPH_UNEXPLORED)) {
        switch (lev.typ) {
        case SCORR:
        case STONE:
            idx = svl.level.flags.arboreal ? S_tree : S_stone;
            break;
        case ROOM:
           idx = S_room;
           break;
        case CORR:
           idx = (lev.waslit || flags.lit_corridor) ? S_litcorr : S_corr;
           break;
        case ICE:
           idx = S_ice;
           break;
        case AIR:
           idx = S_air;
           break;
        case CLOUD:
           idx = S_cloud;
           break;
        case POOL:
        case MOAT:
           idx = S_pool;
           break;
        case WATER:
           idx = S_water;
           break;
        case LAVAPOOL:
           idx = S_lava;
           break;
        case LAVAWALL:
            idx = S_lavawall;
            break;
        default:
           idx = S_room;
           break;
        }

        if (!cansee(x, y) && (!lev.waslit || flags.dark_room)) {
            /* Floor spaces and corridors are dark if unlit. */
            if (lev.typ == CORR && idx == S_litcorr)
                idx = S_corr;
            else if (idx == S_room)
                idx = (flags.dark_room && iflags.wc_color)
                         ? DARKROOMSYM() : S_stone;
        }
        if (idx != S_room)
            tmp_bkglyph = cmap_to_glyph(idx);
    }
    bkglyph[0] = tmp_bkglyph;

    if (iflags.bgcolors
        && gw.wsettings.map_frame_color != NO_COLOR && mapxy_valid(x, y))
        framecolor[0] = gw.wsettings.map_frame_color;
    else
        framecolor[0] = NO_COLOR;
}

export function HAS_ROGUE_IBM_GRAPHICS() { return +(gc.currentgraphics == ROGUESET && SYMHANDLING(H_IBM)); }

/* masks for per-level variances kept in gg.glyphmap_perlevel_flags */
export const GMAP_SET = 0x0001;
export const GMAP_ROGUELEVEL = 0x0002;

export function map_glyphinfo(
    x, y,
    glyph,
    mgflags,
    glyphinfo) { /* void */
    let offset;
    let is_you = +(u_at(x, y)
                      /* verify hero or steed (not something underneath
                         when hero is invisible without see invisible,
                         or a temporary display effect like an explosion);
                         this is only approximate, because hero might be
                         mimicking an object (after eating mimic corpse or
                         if polyd into mimic) or furniture (only if polyd) */
                      && glyph_is_monster(glyph));
    let gmap = glyphmap[glyph];

    struct_assign(glyphinfo.gm, gmap); /* glyphflags, sym.symidx, sym.color, tileidx */
    /*
     * Only hero tinkering permitted on-the-fly (who).
     * Unique glyphs in glyphmap[] determine everything else (what).
     *
     * (Note: if hero is invisible without see invisible, he/she usually
     * can't see himself/herself.  This applies to accessibility hacks
     * as well as to regular display.)
     */
    if (is_you) {
        if (!iflags.wc_color || Upolyd() || glyph != hero_glyph()) {
            ; /* color tweak not needed (!use_color) or not wanted (poly'd
                 or riding--which uses steed's color, not hero's) */
        } else if (HAS_ROGUE_IBM_GRAPHICS()
                   && gs.symset[gc.currentgraphics].nocolor == 0) {
            /* actually player should be yellow-on-gray if in corridor */
            glyphinfo.gm.sym.color = CLR_YELLOW;
        } else if (flags.showrace) {
            /* for showrace, non-human hero is displayed by the symbol of
               corresponding type of monster rather than by '@' (handled
               by newsym()); we change the color to same as human hero */
            glyphinfo.gm.sym.color = HI_DOMESTIC;
        }
        /* accessibility
          This unchanging display character for hero was requested by
          a blind player to enhance screen reader use.
          Turn on override symbol if caller hasn't specified NOOVERRIDE. */
        if (sysopt.accessibility == 1 && !(mgflags & MG_FLAG_NOOVERRIDE)) {
            offset = SYM_HERO_OVERRIDE + SYM_OFF_X;
            if ((gg.glyphmap_perlevel_flags & GMAP_ROGUELEVEL)
                    ? uchars[go.ov_rogue_syms + offset]
                    : uchars[go.ov_primary_syms + offset])
                glyphinfo.gm.sym.symidx = offset;
        }
        glyphinfo.gm.glyphflags |= MG_HERO;
    }
    if (sysopt.accessibility == 1
        && (mgflags & MG_FLAG_NOOVERRIDE) && glyph_is_pet(glyph)) {
        /* one more accessibility kludge;
           turn off override symbol if caller has specified NOOVERRIDE */
        glyphinfo.gm.sym.symidx = mons[glyph_to_mon(glyph)].mlet + SYM_OFF_M;
    }
    glyphinfo.ttychar = uchars[gs.showsyms + glyphinfo.gm.sym.symidx];
    glyphinfo.glyph = glyph;
}

/*
 *  This must be the same order as used for buzz() in zap.c.
 *  The zap_color_ and altar_color_ enums are in decl.h.
 */
export const zapcolors = static_array("zapcolors", int, NUM_ZAP, [
    zap_color_missile,    zap_color_fire,  zap_color_frost,
    zap_color_sleep,      zap_color_death, zap_color_lightning,
    zap_color_poison_gas, zap_color_acid,
]);
export const altarcolors = static_array("altarcolors", int, null, [
    altar_color_unaligned, altar_color_chaotic, altar_color_neutral,
    altar_color_lawful, altar_color_other
]);
export const explodecolors = static_array("explodecolors", int, EXPL_MAX, [
    explode_color_dark,   explode_color_noxious, explode_color_muddy,
    explode_color_wet,    explode_color_magical, explode_color_fiery,
    explode_color_frosty,
]);

/* main_walls, mines_walls, gehennom_walls, knox_walls, sokoban_walls */
export const wallcolors = static_array("wallcolors", int, sokoban_walls + 1, [
    /* default init value is to match defsym[S_vwall + n].color (CLR_GRAY) */
    CLR_GRAY, CLR_GRAY, CLR_GRAY, CLR_GRAY, CLR_GRAY,
    /* CLR_GRAY, CLR_BROWN, CLR_RED, CLR_GRAY, CLR_BRIGHT_BLUE, */
]);

function cmap_to_roguecolor(cmap) { /* int */
    let color = NO_COLOR;

    if (gs.symset[gc.currentgraphics].nocolor)
        return NO_COLOR;

    if (cmap >= S_vwall && cmap <= S_hcdoor)
        color = CLR_BROWN;
    else if (cmap >= S_arrow_trap && cmap <= S_polymorph_trap)
        color = CLR_MAGENTA;
    else if (cmap == S_corr || cmap == S_litcorr)
        color = CLR_GRAY;
    else if (cmap >= S_room && cmap <= S_water
                && cmap != S_darkroom)
        color = CLR_GREEN;
    else
        color = NO_COLOR;

    return color;
}

/*
   reset_glyphmap(trigger)

   The glyphmap likely needs to be re-calculated for the following triggers:

   gm_levelchange    called when the player has gone to a new level.

   gm_symchange      called if someone has interactively altered the symbols
                     for the game, most likely at the options menu.

   gm_optionchange   The game settings have been toggled and some of them
                     are configured to trigger a reset_glyphmap()

   gm_accessibility_change  One of the accessibility flags has changed.

*/

export function reset_glyphmap(trigger) { /* void */
    let glyph;
    let offset;
    let color = NO_COLOR;

    /* condense multiple tests in macro version down to single */
    let has_rogue_ibm_graphics = HAS_ROGUE_IBM_GRAPHICS(),
            has_rogue_color = (has_rogue_ibm_graphics
                               && gs.symset[gc.currentgraphics].nocolor == 0 ? 1 : 0);
    if (trigger == gm_levelchange)
        gg.glyphmap_perlevel_flags = 0;

    if (!gg.glyphmap_perlevel_flags) {
        /*
         *    GMAP_SET                0x00000001
         *    GMAP_ROGUELEVEL         0x00000002
         */
        gg.glyphmap_perlevel_flags = or64(gg.glyphmap_perlevel_flags, GMAP_SET);

        if (Is_rogue_level(u.uz)) {
            gg.glyphmap_perlevel_flags = or64(gg.glyphmap_perlevel_flags, GMAP_ROGUELEVEL);
        }
    }

    for (glyph = 0; glyph < MAX_GLYPH; ++glyph) {
        let gmap = glyphmap[glyph];

        gmap.glyphflags = 0;
        /*
         *  Map the glyph to a character and color.
         *
         *  Warning:  For speed, this makes an assumption on the order of
         *            offsets.  The order is set in display.h.
         */
        if (int(offset = (glyph - GLYPH_NOTHING_OFF)) >= 0) {
            gmap.sym.symidx = SYM_NOTHING + SYM_OFF_X;
            color = NO_COLOR;
            gmap.glyphflags |= MG_NOTHING;
        } else if (int(offset = (glyph - GLYPH_UNEXPLORED_OFF)) >= 0) {
            gmap.sym.symidx = SYM_UNEXPLORED + SYM_OFF_X;
            color = NO_COLOR;
            gmap.glyphflags |= MG_UNEXPL;
        } else if (int(offset = (glyph - GLYPH_STATUE_FEM_PILETOP_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = CLR_RED;
            else
                color = (iflags.wc_color ? objects[STATUE].oc_color : NO_COLOR);
            gmap.glyphflags |= (MG_STATUE | MG_FEMALE | MG_OBJPILE);
        } else if (int(offset = (glyph - GLYPH_STATUE_MALE_PILETOP_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = CLR_RED;
            else
                color = (iflags.wc_color ? objects[STATUE].oc_color : NO_COLOR);
            gmap.glyphflags |= (MG_STATUE | MG_MALE | MG_OBJPILE);
        } else if (int(offset = (glyph - GLYPH_BODY_PILETOP_OFF)) >= 0) {
            gmap.sym.symidx = objects[CORPSE].oc_class + SYM_OFF_O;
            if (has_rogue_color)
                color = CLR_RED;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            gmap.glyphflags |= (MG_CORPSE | MG_OBJPILE);
        } else if (int(offset = (glyph - GLYPH_OBJ_PILETOP_OFF)) >= 0) {
            gmap.sym.symidx = objects[offset].oc_class + SYM_OFF_O;
            if (offset == BOULDER)
                gmap.sym.symidx = SYM_BOULDER + SYM_OFF_X;
            if (has_rogue_color) {
                switch (objects[offset].oc_class) {
                case COIN_CLASS:
                    color = CLR_YELLOW;
                    break;
                case FOOD_CLASS:
                    color = CLR_RED;
                    break;
                default:
                    color = CLR_BRIGHT_BLUE;
                    break;
                }
            } else
                color = (iflags.wc_color ? objects[offset].oc_color : NO_COLOR);
            gmap.glyphflags |= MG_OBJPILE;
        } else if (int(offset = (glyph - GLYPH_STATUE_FEM_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = CLR_RED;
            else
                color = (iflags.wc_color ? objects[STATUE].oc_color : NO_COLOR);
            gmap.glyphflags |= (MG_STATUE | MG_FEMALE);
        } else if (int(offset = (glyph - GLYPH_STATUE_MALE_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = CLR_RED;
            else
                color = (iflags.wc_color ? objects[STATUE].oc_color : NO_COLOR);
            gmap.glyphflags |= (MG_STATUE | MG_MALE);
        } else if (int(offset = (glyph - GLYPH_WARNING_OFF))
                   >= 0) { /* warn flash */
            gmap.sym.symidx = offset + SYM_OFF_W;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? def_warnsyms[offset].color : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_FROSTY_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_frosty] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_FIERY_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_fiery] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_MAGICAL_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_magical] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_WET_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_wet] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_MUDDY_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_muddy] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_NOXIOUS_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_noxious] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_EXPLODE_DARK_OFF)) >= 0) {
            gmap.sym.symidx = S_expl_tl + offset + SYM_OFF_P;
            color = (iflags.wc_color ? explodecolors[expl_dark] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_SWALLOW_OFF)) >= 0) {
            /* see swallow_to_glyph() in display.c */
            gmap.sym.symidx = (S_sw_tl + (offset & 0x7)) + SYM_OFF_P;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset >> 3].mcolor : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_C_OFF)) >= 0) {
            gmap.sym.symidx = S_digbeam + offset + SYM_OFF_P;
            if (has_rogue_color)
                color = cmap_to_roguecolor(S_digbeam + offset);
            else
                color = (iflags.wc_color ? defsyms[S_digbeam + offset].color : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_ZAP_OFF)) >= 0) {
            /* see zapdir_to_glyph() in display.c */
            gmap.sym.symidx = (S_vbeam + (offset & 0x3)) + SYM_OFF_P;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? zapcolors[(offset >> 2)] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_B_OFF)) >= 0) {
            let cmap = S_grave + offset;
            let sym = uchars[gs.showsyms + (cmap + SYM_OFF_P)];

            gmap.sym.symidx = cmap + SYM_OFF_P;
            color = (iflags.wc_color ? defsyms[cmap].color : NO_COLOR);
            if (!iflags.wc_color) {
                let spec_cmap = 0;

                /* try to provide a visible difference between water and lava
                   if they use the same symbol and color is disabled;
                   similar for floor and ice, for fountain vs sink, and for
                   corridor engravings (CMAP_A below) */
                switch (cmap) {
                case S_lava:
                case S_lavawall:
                    if (sym == uchars[gs.showsyms + (S_pool + SYM_OFF_P)]
                        || sym == uchars[gs.showsyms + (S_water + SYM_OFF_P)])
                        spec_cmap = MG_BW_LAVA;
                    break;
                case S_ice:
                    if (sym == uchars[gs.showsyms + (S_room + SYM_OFF_P)]
                        || sym == uchars[gs.showsyms + (S_darkroom + SYM_OFF_P)])
                        spec_cmap = MG_BW_ICE;
                    break;
                case S_sink:
                    if (sym == uchars[gs.showsyms + (S_fountain + SYM_OFF_P)])
                        spec_cmap = MG_BW_SINK;
                    break;
                }
                gmap.glyphflags |= spec_cmap;
            } else if (has_rogue_color) {
                color = cmap_to_roguecolor(cmap);
            }
        } else if (int(offset = (glyph - GLYPH_ALTAR_OFF)) >= 0) {
            /* unaligned, chaotic, neutral, lawful, other altar */
            gmap.sym.symidx = S_altar + SYM_OFF_P;
            if (has_rogue_color)
                color = cmap_to_roguecolor(S_altar);
            else
                color = (iflags.wc_color ? altarcolors[offset] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_A_OFF)) >= 0) {
            let sym, cmap = S_ndoor + offset;

            gmap.sym.symidx = cmap + SYM_OFF_P;
            color = (iflags.wc_color ? defsyms[cmap].color : NO_COLOR);
            sym = uchars[gs.showsyms + gmap.sym.symidx];
            /*
             *   Some specialty color mappings not hardcoded in data init
             */
            if (has_rogue_color) {
                color = cmap_to_roguecolor(cmap);
            /* provide a visible difference if normal and lit corridor
               use the same symbol */
            } else if (cmap == S_litcorr
                       && sym == uchars[gs.showsyms + (S_corr + SYM_OFF_P)]) {
                color = CLR_WHITE;
            /* likewise for corridor and engraving-in-corridor */
            } else if (cmap == S_engrcorr
                       && (sym == uchars[gs.showsyms + (S_corr + SYM_OFF_P)]
                           || sym == uchars[gs.showsyms + (S_litcorr + SYM_OFF_P)])) {
                gmap.glyphflags |= MG_BW_ENGR;
            }
        } else if (int(offset = (glyph - GLYPH_CMAP_SOKO_OFF)) >= 0) {
            gmap.sym.symidx = S_vwall + offset + SYM_OFF_P;
            color = (iflags.wc_color ? wallcolors[sokoban_walls] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_KNOX_OFF)) >= 0) {
            gmap.sym.symidx = S_vwall + offset + SYM_OFF_P;
            color = (iflags.wc_color ? wallcolors[knox_walls] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_GEH_OFF)) >= 0) {
            gmap.sym.symidx = S_vwall + offset + SYM_OFF_P;
            color = (iflags.wc_color ? wallcolors[gehennom_walls] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_MINES_OFF)) >= 0) {
            gmap.sym.symidx = S_vwall + offset + SYM_OFF_P;
            color = (iflags.wc_color ? wallcolors[mines_walls] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_MAIN_OFF)) >= 0) {
            gmap.sym.symidx = S_vwall + offset + SYM_OFF_P;
            if (has_rogue_color)
                color = cmap_to_roguecolor(S_vwall + offset);
            else
                color = (iflags.wc_color ? wallcolors[main_walls] : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_CMAP_STONE_OFF)) >= 0) {
            gmap.sym.symidx = SYM_OFF_P;
            color = (iflags.wc_color ? defsyms[S_stone].color : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_OBJ_OFF)) >= 0) {
            gmap.sym.symidx = objects[offset].oc_class + SYM_OFF_O;
            if (offset == BOULDER)
                gmap.sym.symidx = SYM_BOULDER + SYM_OFF_X;
            if (has_rogue_color) {
                switch (objects[offset].oc_class) {
                case COIN_CLASS:
                    color = CLR_YELLOW;
                    break;
                case FOOD_CLASS:
                    color = CLR_RED;
                    break;
                default:
                    color = CLR_BRIGHT_BLUE;
                    break;
                }
            } else
                color = (iflags.wc_color ? objects[offset].oc_color : NO_COLOR);
        } else if (int(offset = (glyph - GLYPH_RIDDEN_FEM_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                /* This currently implies that the hero is here -- monsters */
                /* don't ride (yet...).  Should we set it to yellow like in */
                /* the monster case below?  There is no equivalent in rogue.
                 */
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            gmap.glyphflags |= (MG_RIDDEN | MG_FEMALE);
        } else if (int(offset = (glyph - GLYPH_RIDDEN_MALE_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            gmap.glyphflags |= (MG_RIDDEN | MG_MALE);
        } else if (int(offset = (glyph - GLYPH_BODY_OFF)) >= 0) {
            gmap.sym.symidx = objects[CORPSE].oc_class + SYM_OFF_O;
            if (has_rogue_color)
                color = CLR_RED;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            gmap.glyphflags |= MG_CORPSE;
        } else if (int(offset = (glyph - GLYPH_DETECT_FEM_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            /* Disabled for now; anyone want to get reverse video to work? */
            /* is_reverse = TRUE; */
            gmap.glyphflags |= (MG_DETECT | MG_FEMALE);
        } else if (int(offset = (glyph - GLYPH_DETECT_MALE_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            /* Disabled for now; anyone want to get reverse video to work? */
            /* is_reverse = TRUE; */
            gmap.glyphflags |= (MG_DETECT | MG_MALE);
        } else if (int(offset = (glyph - GLYPH_INVIS_OFF)) >= 0) {
            gmap.sym.symidx = SYM_INVISIBLE + SYM_OFF_X;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = NO_COLOR;
            gmap.glyphflags |= MG_INVIS;
        } else if (int(offset = (glyph - GLYPH_PET_FEM_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            gmap.glyphflags |= (MG_PET | MG_FEMALE);
        } else if (int(offset = (glyph - GLYPH_PET_MALE_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color)
                color = NO_COLOR;
            else
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            gmap.glyphflags |= (MG_PET | MG_MALE);
        } else if (int(offset = (glyph - GLYPH_MON_FEM_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color) {
                color = NO_COLOR;
            } else {
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            }
            gmap.glyphflags |= MG_FEMALE;
        } else if ((offset = (glyph - GLYPH_MON_MALE_OFF)) >= 0) {
            gmap.sym.symidx = mons[offset].mlet + SYM_OFF_M;
            if (has_rogue_color) {
                color = CLR_YELLOW;
            } else {
                color = (iflags.wc_color ? mons[offset].mcolor : NO_COLOR);
            }
            gmap.glyphflags |= MG_MALE;
        }
        /* This was requested by a blind player to enhance screen reader use
         */
        if (sysopt.accessibility == 1 && (gmap.glyphflags & MG_PET) != 0) {
            let pet_override = ((gg.glyphmap_perlevel_flags & GMAP_ROGUELEVEL)
                         ? uchars[go.ov_rogue_syms + (SYM_PET_OVERRIDE + SYM_OFF_X)]
                         : uchars[go.ov_primary_syms + (SYM_PET_OVERRIDE + SYM_OFF_X)]);

            if (uchars[gs.showsyms + pet_override] != ord(' '))
                gmap.sym.symidx = SYM_PET_OVERRIDE + SYM_OFF_X;
        }
        /* Turn off color if no color defined, or rogue level w/o PC graphics.
         */
        if ((!has_color(color)
             || ((gg.glyphmap_perlevel_flags & GMAP_ROGUELEVEL)
                 && !has_rogue_color)) || !iflags.wc_color)
            color = NO_COLOR;
        gmap.sym.color = color;
    }
    gg.glyph_reset_timestamp = svm.moves;
}

/* ------------------------------------------------------------------------ */
/* Wall Angle ------------------------------------------------------------- */

/* #ifdef WA_VERBOSE: not in this build */

/*
 * Return 'which' if position is implies an unfinished exterior.  Return
 * zero otherwise.  Unfinished implies outer area is rock or a corridor.
 *
 * Things that are ambiguous: lava
 */
function check_pos(x, y, which) { /* int */
    let type;

    if (!isok(x, y))
        return which;
    type = levl()[x][y].typ;
    /* Everything below POOL, excluding TREE */
    if (IS_STWALL(type) || type == CORR || type == SCORR || IS_SDOOR(type))
        return which;
    return 0;
}

/* Return TRUE if more than one is non-zero. */
/*ARGSUSED*/
/* #ifdef WA_VERBOSE: not in this build */

/* Return the wall mode for a T wall. */
function set_twall(

          x0, y0,

          x1, y1,
          x2, y2,
          x3, y3) { /* int */
    let wmode, is_1, is_2, is_3;

    is_1 = check_pos(x1, y1, WM_T_LONG);
    is_2 = check_pos(x2, y2, WM_T_BL);
    is_3 = check_pos(x3, y3, WM_T_BR);
    if (((((is_1) && ((is_2) | (is_3))) || ((is_2) && ((is_1) | (is_3)))) || ((is_3) && ((is_1) | (is_2))))) {
        wmode = 0;
    } else {
        wmode = is_1 + is_2 + is_3;
    }
    return wmode;
}

/* Return wall mode for a horizontal or vertical wall. */
function set_wall(x, y, horiz) { /* int */
    let wmode, is_1, is_2;

    if (horiz) {
        is_1 = check_pos(x, y - 1, WM_W_TOP);
        is_2 = check_pos(x, y + 1, WM_W_BOTTOM);
    } else {
        is_1 = check_pos(x - 1, y, WM_W_LEFT);
        is_2 = check_pos(x + 1, y, WM_W_RIGHT);
    }
    if (((((is_1) && ((is_2) | (0))) || ((is_2) && ((is_1) | (0)))) || ((0) && ((is_1) | (is_2))))) {
        wmode = 0;
    } else {
        wmode = is_1 + is_2;
    }
    return wmode;
}

/* Return a wall mode for a corner wall. (x4,y4) is the "inner" position. */
function set_corn(
    x1, y1,
    x2, y2,
    x3, y3,
    x4, y4) { /* int */
    let wmode, is_1, is_2, is_3, is_4;

    is_1 = check_pos(x1, y1, 1);
    is_2 = check_pos(x2, y2, 1);
    is_3 = check_pos(x3, y3, 1);
    is_4 = check_pos(x4, y4, 1); /* inner location */

    /*
     * All 4 should not be true.  So if the inner location is rock,
     * use it.  If all of the outer 3 are true, use outer.  We currently
     * can't cover the case where only part of the outer is rock, so
     * we just say that all the walls are finished (if not overridden
     * by the inner section).
     */
    if (is_4) {
        wmode = WM_C_INNER;
    } else if (is_1 && is_2 && is_3)
        wmode = WM_C_OUTER;
    else
        wmode = 0; /* finished walls on all sides */

    return wmode;
}

/* Return mode for a crosswall. */
function set_crosswall(x, y) { /* int */
    let wmode, is_1, is_2, is_3, is_4;

    is_1 = check_pos(x - 1, y - 1, 1);
    is_2 = check_pos(x + 1, y - 1, 1);
    is_3 = check_pos(x + 1, y + 1, 1);
    is_4 = check_pos(x - 1, y + 1, 1);

    wmode = is_1 + is_2 + is_3 + is_4;
    if (wmode > 1) {
        if (is_1 && is_3 && (is_2 + is_4 == 0)) {
            wmode = WM_X_TLBR;
        } else if (is_2 && is_4 && (is_1 + is_3 == 0)) {
            wmode = WM_X_BLTR;
        } else {
            wmode = 0;
        }
    } else if (is_1)
        wmode = WM_X_TL;
    else if (is_2)
        wmode = WM_X_TR;
    else if (is_3)
        wmode = WM_X_BR;
    else if (is_4)
        wmode = WM_X_BL;

    return wmode;
}

/* called for every <x,y> by set_wall_state() and for specific <x,y> during
   vault wall repair */
export function xy_set_wall_state(x, y) { /* void */
    let wmode;
    let lev = levl()[x][y];

    switch (lev.typ) {
    case SDOOR:
        wmode = set_wall(x, y, lev.horizontal);
        break;
    case VWALL:
        wmode = set_wall(x, y, 0);
        break;
    case HWALL:
        wmode = set_wall(x, y, 1);
        break;
    case TDWALL:
        wmode = set_twall(x, y, x, y - 1, x - 1, y + 1, x + 1, y + 1);
        break;
    case TUWALL:
        wmode = set_twall(x, y, x, y + 1, x + 1, y - 1, x - 1, y - 1);
        break;
    case TLWALL:
        wmode = set_twall(x, y, x + 1, y, x - 1, y - 1, x - 1, y + 1);
        break;
    case TRWALL:
        wmode = set_twall(x, y, x - 1, y, x + 1, y + 1, x + 1, y - 1);
        break;
    case TLCORNER:
        wmode = set_corn(x - 1, y - 1, x, y - 1, x - 1, y, x + 1, y + 1);
        break;
    case TRCORNER:
        wmode = set_corn(x, y - 1, x + 1, y - 1, x + 1, y, x - 1, y + 1);
        break;
    case BLCORNER:
        wmode = set_corn(x, y + 1, x - 1, y + 1, x - 1, y, x + 1, y - 1);
        break;
    case BRCORNER:
        wmode = set_corn(x + 1, y, x + 1, y + 1, x, y + 1, x - 1, y - 1);
        break;
    case CROSSWALL:
        wmode = set_crosswall(x, y);
        break;

    default:
        wmode = -1; /* don't set wall info */
        break;
    }

    if (wmode >= 0)
        lev.flags = unsigned((lev.flags & ~WM_MASK) | wmode);
}

/* Called from mklev.  Scan the level and set the wall modes. */
export function set_wall_state() { /* void */
    let x, y;

    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            xy_set_wall_state(x, y);

/* #ifdef WA_VERBOSE: not in this build */
}

/* ------------------------------------------------------------------------ */
/* This matrix is used here and in vision.c. */
export const seenv_matrix = static_array("seenv_matrix", array_of(uchar, 3), 3, [
    [ SV2, SV1,   SV0 ],
    [ SV3, SVALL, SV7 ],
    [ SV4, SV5,   SV6 ]
]);

/* negative: -1, zero: 0, positive +1; same as sgn() function (hacklib.c) */
export function sign(z) { return (z < 0 ? -1 : +(z != 0)); }

/* Set the seen vector of lev as if seen from (x0,y0) to (x,y). */
function set_seenv(
    lev,
    x0, y0,
    x, y) { /* void */ /* to */
    let dx = x - x0, dy = y0 - y;

    lev.seenv |= uchars[seenv_matrix[sign(dy) + 1] + (sign(dx) + 1)];
}

/* Called by blackout(vault.c) when vault guard removes temporary corridor,
   turning spot <x0,y0> back into stone; <x1,y1> is an adjacent spot. */
export function unset_seenv(
    lev,
    x0, y0,
    x1, y1) { /* void */ /* to; abs(x1-x0)==1 && abs(y0-y1)==1 */
    let dx = x1 - x0, dy = y0 - y1;

    lev.seenv &= ~uchars[seenv_matrix[dy + 1] + (dx + 1)];
}

/* ------------------------------------------------------------------------ */

/* T wall types, one for each row in wall_matrix[][]. */
export const T_d = 0;
export const T_l = 1;
export const T_u = 2;
export const T_r = 3;

/*
 * These are the column names of wall_matrix[][].  They are the "results"
 * of a tdwall pattern match.  All T walls are rotated so they become
 * a tdwall.  Then we do a single pattern match, but return the
 * correct result for the original wall by using different rows for
 * each of the wall types.
 */
export const T_stone = 0;
export const T_tlcorn = 1;
export const T_trcorn = 2;
export const T_hwall = 3;
export const T_tdwall = 4;

const wall_matrix = static_array("wall_matrix", array_of(int, 5), 4, [
    [ S_stone, S_tlcorn, S_trcorn, S_hwall, S_tdwall ], /* tdwall */
    [ S_stone, S_trcorn, S_brcorn, S_vwall, S_tlwall ], /* tlwall */
    [ S_stone, S_brcorn, S_blcorn, S_hwall, S_tuwall ], /* tuwall */
    [ S_stone, S_blcorn, S_tlcorn, S_vwall, S_trwall ], /* trwall */
]);

/* Cross wall types, one for each "solid" quarter.  Rows of cross_matrix[][].
 */
export const C_bl = 0;
export const C_tl = 1;
export const C_tr = 2;
export const C_br = 3;

/*
 * These are the column names for cross_matrix[][].  They express results
 * in C_br (bottom right) terms.  All crosswalls with a single solid
 * quarter are rotated so the solid section is at the bottom right.
 * We pattern match on that, but return the correct result depending
 * on which row we're looking at.
 */
export const C_trcorn = 0;
export const C_brcorn = 1;
export const C_blcorn = 2;
export const C_tlwall = 3;
export const C_tuwall = 4;
export const C_crwall = 5;

const cross_matrix = static_array("cross_matrix", array_of(int, 6), 4, [
    [ S_brcorn, S_blcorn, S_tlcorn, S_tuwall, S_trwall, S_crwall ],
    [ S_blcorn, S_tlcorn, S_trcorn, S_trwall, S_tdwall, S_crwall ],
    [ S_tlcorn, S_trcorn, S_brcorn, S_tdwall, S_tlwall, S_crwall ],
    [ S_trcorn, S_brcorn, S_blcorn, S_tlwall, S_tuwall, S_crwall ],
]);

/* Print out a T wall warning and all interesting info. */
function t_warn(lev) { /* void */
    let warn_str = init_string(static_array("t_warn.warn_str", char, sizeof_string("wall_angle: %s: case %d: seenv = 0x%x")), _("wall_angle: %s: case %d: seenv = 0x%x"), true);
    let wname;

    /* 5.0: non-T_wall cases added after shop repair (via breaching a wall,
       using locking magic to put a door there, then unlocking the door;
       D_CLOSED carried over to the wall) triggered warning for "unknown" */
    switch (lev.typ) {
    case TUWALL:
        wname = _("tuwall");
        break;
    case TLWALL:
        wname = _("tlwall");
        break;
    case TRWALL:
        wname = _("trwall");
        break;
    case TDWALL:
        wname = _("tdwall");
        break;
    case VWALL:
        wname = _("vwall");
        break;
    case HWALL:
        wname = _("hwall");
        break;
    case TLCORNER:
        wname = _("tlcorner");
        break;
    case TRCORNER:
        wname = _("trcorner");
        break;
    case BLCORNER:
        wname = _("blcorner");
        break;
    case BRCORNER:
        wname = _("brcorner");
        break;
    default:
        wname = _("unknown");
        break;
    }
    impossible(warn_str, wname, lev.flags & WM_MASK,
               lev.seenv);
}

/*
 * Return the correct graphics character index using wall type, wall mode,
 * and the seen vector.  It is expected that seenv is non zero.
 *
 * All T-wall vectors are rotated to be TDWALL.  All single crosswall
 * blocks are rotated to bottom right.  All double crosswall are rotated
 * to W_X_BLTR.  All results are converted back.
 *
 * The only way to understand this is to take out pen and paper and
 * draw diagrams.  See rm.h for more details on the wall modes and
 * seen vector (SV).
 */
function wall_angle(lev) { /* int */
    let $goto = null;
    var seenv = lev.seenv & 0xff;
    var row;
    var col, idx;

    $goto_do_twall: for (;;) { switch ($goto || (lev.typ)) {
    case TUWALL:
        row = wall_matrix[T_u];
        seenv = unsigned(seenv >>> 4 | unsigned(seenv << 4)) & 0xff; /* rotate to tdwall */
        { $goto = "do_twall"; continue $goto_do_twall; }
    case TLWALL:
        row = wall_matrix[T_l];
        seenv = unsigned(seenv >>> 2 | unsigned(seenv << 6)) & 0xff; /* rotate to tdwall */
        { $goto = "do_twall"; continue $goto_do_twall; }
    case TRWALL:
        row = wall_matrix[T_r];
        seenv = unsigned(seenv >>> 6 | unsigned(seenv << 2)) & 0xff; /* rotate to tdwall */
        { $goto = "do_twall"; continue $goto_do_twall; }
    case TDWALL:
        row = wall_matrix[T_d];
 case "do_twall": $goto = null;
        switch (lev.flags & WM_MASK) {
        case 0:
            if (seenv == SV4) {
                col = T_tlcorn;
            } else if (seenv == SV6) {
                col = T_trcorn;
            } else if (seenv & (SV3 | SV5 | SV7)
                       || ((seenv & SV4) && (seenv & SV6))) {
                col = T_tdwall;
            } else if (seenv & (SV0 | SV1 | SV2)) {
                col = (seenv & (SV4 | SV6) ? T_tdwall : T_hwall);
            } else {
                t_warn(lev);
                col = T_stone;
            }
            break;
        case WM_T_LONG:
            if (seenv & (SV3 | SV4) && !(seenv & (SV5 | SV6 | SV7))) {
                col = T_tlcorn;
            } else if (seenv & (SV6 | SV7) && !(seenv & (SV3 | SV4 | SV5))) {
                col = T_trcorn;
            } else if ((seenv & SV5)
                       || ((seenv & (SV3 | SV4)) && (seenv & (SV6 | SV7)))) {
                col = T_tdwall;
            } else {
                /* only SV0|SV1|SV2 */
                if (!only(seenv, SV0 | SV1 | SV2))
                    t_warn(lev);
                col = T_stone;
            }
            break;
        case WM_T_BL:
            if (only(seenv, SV4 | SV5))
                col = T_tlcorn;
            else if ((seenv & (SV0 | SV1 | SV2 | SV7))
                     && !(seenv & (SV3 | SV4 | SV5)))
                col = T_hwall;
            else if (only(seenv, SV6))
                col = T_stone;
            else
                col = T_tdwall;
            break;
        case WM_T_BR:
            if (only(seenv, SV5 | SV6))
                col = T_trcorn;
            else if ((seenv & (SV0 | SV1 | SV2 | SV3))
                     && !(seenv & (SV5 | SV6 | SV7)))
                col = T_hwall;
            else if (only(seenv, SV4))
                col = T_stone;
            else
                col = T_tdwall;

            break;
        default:
            impossible(_("wall_angle: unknown T wall mode %d"),
                       lev.flags & WM_MASK);
            col = T_stone;
            break;
        }
        idx = row[col];
        break;

    case SDOOR:
        if (lev.candig) {
            idx = S_tree;
            break;
        }
        if (lev.horizontal)
            { $goto = "horiz"; continue $goto_do_twall; };
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case VWALL:
        switch (lev.flags & WM_MASK) {
        case 0:
            idx = seenv ? S_vwall : S_stone;
            break;
        case 1:
            idx = seenv & (SV1 | SV2 | SV3 | SV4 | SV5) ? S_vwall : S_stone;
            break;
        case 2:
            idx = seenv & (SV0 | SV1 | SV5 | SV6 | SV7) ? S_vwall : S_stone;
            break;
        default:
            impossible(_("wall_angle: unknown vwall mode %d"),
                       lev.flags & WM_MASK);
            idx = S_stone;
            break;
        }
        break;

    case "horiz": case HWALL:
 $goto = null;
        switch (lev.flags & WM_MASK) {
        case 0:
            idx = seenv ? S_hwall : S_stone;
            break;
        case 1:
            idx = seenv & (SV3 | SV4 | SV5 | SV6 | SV7) ? S_hwall : S_stone;
            break;
        case 2:
            idx = seenv & (SV0 | SV1 | SV2 | SV3 | SV7) ? S_hwall : S_stone;
            break;
        default:
            impossible(_("wall_angle: unknown hwall mode %d"),
                       lev.flags & WM_MASK);
            idx = S_stone;
            break;
        }
        break;

    case TLCORNER:
        switch (((lev).flags & WM_MASK)) { case 0: idx = S_tlcorn; break; case WM_C_OUTER: idx = ((seenv & (SV3 | SV4 | SV5)) ? S_tlcorn : S_stone); break; case WM_C_INNER: idx = ((seenv & unsigned(~(SV4))) ? S_tlcorn : S_stone); break; default: impossible(_("wall_angle: unknown %s mode %d"), _("tlcorn"), ((lev).flags & WM_MASK)); idx = S_stone; break; };
        break;
    case TRCORNER:
        switch (((lev).flags & WM_MASK)) { case 0: idx = S_trcorn; break; case WM_C_OUTER: idx = ((seenv & (SV5 | SV6 | SV7)) ? S_trcorn : S_stone); break; case WM_C_INNER: idx = ((seenv & unsigned(~(SV6))) ? S_trcorn : S_stone); break; default: impossible(_("wall_angle: unknown %s mode %d"), _("trcorn"), ((lev).flags & WM_MASK)); idx = S_stone; break; };
        break;
    case BLCORNER:
        switch (((lev).flags & WM_MASK)) { case 0: idx = S_blcorn; break; case WM_C_OUTER: idx = ((seenv & (SV1 | SV2 | SV3)) ? S_blcorn : S_stone); break; case WM_C_INNER: idx = ((seenv & unsigned(~(SV2))) ? S_blcorn : S_stone); break; default: impossible(_("wall_angle: unknown %s mode %d"), _("blcorn"), ((lev).flags & WM_MASK)); idx = S_stone; break; };
        break;
    case BRCORNER:
        switch (((lev).flags & WM_MASK)) { case 0: idx = S_brcorn; break; case WM_C_OUTER: idx = ((seenv & (SV7 | SV0 | SV1)) ? S_brcorn : S_stone); break; case WM_C_INNER: idx = ((seenv & unsigned(~(SV0))) ? S_brcorn : S_stone); break; default: impossible(_("wall_angle: unknown %s mode %d"), _("brcorn"), ((lev).flags & WM_MASK)); idx = S_stone; break; };
        break;

    case CROSSWALL:
        $goto_do_crwall: for (;;) { switch ($goto || (lev.flags & WM_MASK)) {
        case 0:
            if (seenv == SV0)
                idx = S_brcorn;
            else if (seenv == SV2)
                idx = S_blcorn;
            else if (seenv == SV4)
                idx = S_tlcorn;
            else if (seenv == SV6)
                idx = S_trcorn;
            else if (!(seenv & unsigned(~(SV0 | SV1 | SV2)))
                     && (seenv & SV1 || seenv == (SV0 | SV2)))
                idx = S_tuwall;
            else if (!(seenv & unsigned(~(SV2 | SV3 | SV4)))
                     && (seenv & SV3 || seenv == (SV2 | SV4)))
                idx = S_trwall;
            else if (!(seenv & unsigned(~(SV4 | SV5 | SV6)))
                     && (seenv & SV5 || seenv == (SV4 | SV6)))
                idx = S_tdwall;
            else if (!(seenv & unsigned(~(SV0 | SV6 | SV7)))
                     && (seenv & SV7 || seenv == (SV0 | SV6)))
                idx = S_tlwall;
            else
                idx = S_crwall;
            break;

        case WM_X_TL:
            row = cross_matrix[C_tl];
            seenv = unsigned(seenv >>> 4 | unsigned(seenv << 4)) & 0xff;
            { $goto = "do_crwall"; continue $goto_do_crwall; }
        case WM_X_TR:
            row = cross_matrix[C_tr];
            seenv = unsigned(seenv >>> 6 | unsigned(seenv << 2)) & 0xff;
            { $goto = "do_crwall"; continue $goto_do_crwall; }
        case WM_X_BL:
            row = cross_matrix[C_bl];
            seenv = unsigned(seenv >>> 2 | unsigned(seenv << 6)) & 0xff;
            { $goto = "do_crwall"; continue $goto_do_crwall; }
        case WM_X_BR:
            row = cross_matrix[C_br];
 case "do_crwall": $goto = null;
            if (seenv == SV4) {
                idx = S_stone;
            } else {
                seenv = unsigned(seenv & unsigned(~SV4)); /* strip SV4 */
                if (seenv == SV0) {
                    col = C_brcorn;
                } else if (seenv & (SV2 | SV3)) {
                    if (seenv & (SV5 | SV6 | SV7))
                        col = C_crwall;
                    else if (seenv & (SV0 | SV1))
                        col = C_tuwall;
                    else
                        col = C_blcorn;
                } else if (seenv & (SV5 | SV6)) {
                    if (seenv & (SV1 | SV2 | SV3))
                        col = C_crwall;
                    else if (seenv & (SV0 | SV7))
                        col = C_tlwall;
                    else
                        col = C_trcorn;
                } else if (seenv & SV1) {
                    col = seenv & SV7 ? C_crwall : C_tuwall;
                } else if (seenv & SV7) {
                    col = seenv & SV1 ? C_crwall : C_tlwall;
                } else {
                    impossible(_("wall_angle: bottom of crwall check"));
                    col = C_crwall;
                }

                idx = row[col];
            }
            break;

        case WM_X_TLBR:
            if (only(seenv, SV1 | SV2 | SV3))
                idx = S_blcorn;
            else if (only(seenv, SV5 | SV6 | SV7))
                idx = S_trcorn;
            else if (only(seenv, SV0 | SV4))
                idx = S_stone;
            else
                idx = S_crwall;
            break;

        case WM_X_BLTR:
            if (only(seenv, SV0 | SV1 | SV7))
                idx = S_brcorn;
            else if (only(seenv, SV3 | SV4 | SV5))
                idx = S_tlcorn;
            else if (only(seenv, SV2 | SV6))
                idx = S_stone;
            else
                idx = S_crwall;
            break;

        default:
            impossible(_("wall_angle: unknown crosswall mode"));
            idx = S_stone;
            break;
        } break; }
        break;

    default:
        impossible(_("wall_angle: unexpected wall type %d"), lev.typ);
        idx = S_stone;
    } break; }
    return idx;
}
export function only(sv, bits) { return ((sv & bits) && !(sv & unsigned(~bits)) ? 1 : 0); }

/*
 * c++ 20 has problems with some of the display.h macros because
 * comparisons and bit-fiddling and math between different enums
 * is deprecated.
 * Create function versions of some of the macros used in some
 * NetHack c++ source files (Qt) for use there.
 */
export function fn_cmap_to_glyph(cmap) { /* int */
    return cmap_to_glyph(cmap);
}

/* for 'onefile' processing where end of this file isn't necessarily the
   end of the source code seen by the compiler (there are lots of other
   macros defined above...) */

/*display.c*/

import {
    CLR_BRIGHT_BLUE, CLR_BROWN, CLR_GRAY, CLR_GREEN, CLR_MAGENTA, CLR_RED, CLR_WHITE, CLR_YELLOW,
    HI_DOMESTIC, NO_COLOR,
} from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    COIN_CLASS, FOOD_CLASS, S_air, S_altar, S_arrow_trap, S_bars, S_blcorn, S_brcorn, S_brdnladder,
    S_brdnstair, S_brupladder, S_brupstair, S_cloud, S_corr, S_crwall, S_darkroom, S_digbeam,
    S_dnladder, S_dnstair, S_engrcorr, S_expl_tl, S_fountain, S_grave, S_hcdbridge, S_hcdoor,
    S_hodbridge, S_hodoor, S_hwall, S_ice, S_lava, S_lavawall, S_litcorr, S_ndoor, S_polymorph_trap,
    S_pool, S_room, S_sink, S_stone, S_sw_bc, S_sw_bl, S_sw_br, S_sw_ml, S_sw_mr, S_sw_tc, S_sw_tl,
    S_sw_tr, S_tdwall, S_throne, S_tlcorn, S_tlwall, S_trcorn, S_tree, S_trwall, S_tuwall,
    S_upladder, S_upstair, S_vbeam, S_vcdbridge, S_vcdoor, S_vodbridge, S_vodoor, S_vwall, S_water,
} from "./defsym.h.js";
import {
    BACKTRACK, DISP_ALL, DISP_ALWAYS, DISP_BEAM, DISP_CHANGE, DISP_END, DISP_FLASH, DISP_FREEMEM,
    DISP_TETHER, EXPL_MAX, GLYPH_ALTAR_OFF, GLYPH_BODY_OFF, GLYPH_BODY_PILETOP_OFF,
    GLYPH_CMAP_A_OFF, GLYPH_CMAP_B_OFF, GLYPH_CMAP_C_OFF, GLYPH_CMAP_GEH_OFF, GLYPH_CMAP_KNOX_OFF,
    GLYPH_CMAP_MAIN_OFF, GLYPH_CMAP_MINES_OFF, GLYPH_CMAP_SOKO_OFF, GLYPH_CMAP_STONE_OFF,
    GLYPH_DETECT_FEM_OFF, GLYPH_DETECT_MALE_OFF, GLYPH_EXPLODE_DARK_OFF, GLYPH_EXPLODE_FIERY_OFF,
    GLYPH_EXPLODE_FROSTY_OFF, GLYPH_EXPLODE_MAGICAL_OFF, GLYPH_EXPLODE_MUDDY_OFF,
    GLYPH_EXPLODE_NOXIOUS_OFF, GLYPH_EXPLODE_WET_OFF, GLYPH_INVISIBLE, GLYPH_INVIS_OFF,
    GLYPH_MON_FEM_OFF, GLYPH_MON_MALE_OFF, GLYPH_NOTHING, GLYPH_NOTHING_OFF, GLYPH_OBJ_OFF,
    GLYPH_OBJ_PILETOP_OFF, GLYPH_PET_FEM_OFF, GLYPH_PET_MALE_OFF, GLYPH_RIDDEN_FEM_OFF,
    GLYPH_RIDDEN_MALE_OFF, GLYPH_STATUE_FEM_OFF, GLYPH_STATUE_FEM_PILETOP_OFF,
    GLYPH_STATUE_MALE_OFF, GLYPH_STATUE_MALE_PILETOP_OFF, GLYPH_SWALLOW_OFF, GLYPH_UNEXPLORED,
    GLYPH_UNEXPLORED_OFF, GLYPH_WARNING_OFF, GLYPH_ZAP_OFF, MAX_GLYPH, MG_BADXY, MG_BW_ENGR,
    MG_BW_ICE, MG_BW_LAVA, MG_BW_SINK, MG_CORPSE, MG_DETECT, MG_FEMALE, MG_FLAG_NOOVERRIDE, MG_HERO,
    MG_INVIS, MG_MALE, MG_NOTHING, MG_OBJPILE, MG_PET, MG_RIDDEN, MG_STATUE, MG_UNEXPL, NO_GLYPH,
    NUM_ZAP, SHIELD_COUNT, altar_color_chaotic, altar_color_lawful, altar_color_neutral,
    altar_color_other, altar_color_unaligned, docrtMapOnly, docrtNocls, docrtRecalc, docrtRefresh,
    expl_dark, expl_fiery, expl_frosty, expl_magical, expl_muddy, expl_noxious, expl_wet,
    explode_color_dark, explode_color_fiery, explode_color_frosty, explode_color_magical,
    explode_color_muddy, explode_color_noxious, explode_color_wet, gbuf_entry, gehennom_walls,
    gm_levelchange, knox_walls, main_walls, mines_walls, sokoban_walls, zap_color_acid,
    zap_color_death, zap_color_fire, zap_color_frost, zap_color_lightning, zap_color_missile,
    zap_color_poison_gas, zap_color_sleep,
} from "./display.h.js";
import {
    _canseemon, _is_safemon, _knowninvisible, _mon_visible, _mon_warning, _see_with_infrared,
    _sensemon, _tp_sensemon, altar_to_glyph, canspotself, cmap_to_glyph, covers_objects,
    covers_traps, detected_mon_to_glyph, detected_monnum_to_glyph, engraving_to_glyph,
    glyph_is_cmap, glyph_is_generic_object, glyph_is_invisible, glyph_is_monster,
    glyph_is_normal_generic_obj, glyph_is_nothing, glyph_is_pet, glyph_is_piletop_generic_obj,
    glyph_is_trap, glyph_is_unexplored, glyph_to_mon, hero_glyph, mon_to_glyph, monnum_to_glyph,
    newsym_rn2, obj_to_glyph, objnum_to_glyph, pet_to_glyph, petnum_to_glyph, random_monster,
    random_obj_to_glyph, ridden_mon_to_glyph, trap_to_glyph, vobj_at, warning_to_glyph, what_mon,
} from "./display.h.macros.js";
import { Is_rogue_level, Is_waterlevel } from "./dungeon.h.macros.js";
import { spot_shows_engravings } from "./engrave.h.macros.js";
import { BUFSZ, COLNO, FALSE, ROWNO, TRUE } from "./global.h.js";
import { ECMD_OK, SYM_OFF_M, SYM_OFF_O, SYM_OFF_P, SYM_OFF_W, SYM_OFF_X } from "./hack.h.js";
import { MATCH_WARN_OF_MON, distu, mdistu } from "./hack.h.macros.js";
import { MCORPSENM, has_mcorpsenm } from "./mextra.h.macros.js";
import { infravisible, mindless, monsndx } from "./mondata.h.macros.js";
import { FEMALE, MALE } from "./monflag.h.js";
import {
    MON_STILL_ARRIVING, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT,
} from "./monst.h.js";
import { DEADMONSTER, M_AP_TYPE, U_AP_TYPE, is_lightblocker_mappear } from "./monst.h.macros.js";
import { PM_LONG_WORM_TAIL, PM_TENGU } from "./monsters.h.js";
import { OBJ_FLOOR, struct_obj } from "./obj.h.js";
import { BOULDER, CORPSE, STATUE } from "./objects.h.js";
import {
    AIR, ALTAR, BLCORNER, BRCORNER, CLOUD, CORR, CROSSWALL, DBWALL, DB_FLOOR, DB_ICE, DB_LAVA,
    DB_MOAT, DB_UNDER, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED,
    FOUNTAIN, GRAVE, HWALL, ICE, IRONBARS, LADDER, LAVAPOOL, LAVAWALL, LA_DOWN, MOAT, POOL, ROOM,
    SCORR, SDOOR, SINK, STAIRS, STONE, SV0, SV1, SV2, SV3, SV4, SV5, SV6, SV7, SVALL, TDWALL,
    THRONE, TLCORNER, TLWALL, TRCORNER, TREE, TRWALL, TUWALL, VWALL, WATER, WM_C_INNER, WM_C_OUTER,
    WM_MASK, WM_T_BL, WM_T_BR, WM_T_LONG, WM_W_BOTTOM, WM_W_LEFT, WM_W_RIGHT, WM_W_TOP, WM_X_BL,
    WM_X_BLTR, WM_X_BR, WM_X_TL, WM_X_TLBR, WM_X_TR,
} from "./rm.h.js";
import {
    ACCESSIBLE, IS_DOOR, IS_OBSTRUCTED, IS_POOL, IS_ROOM, IS_SDOOR, IS_STWALL, fmon, fobj, levl,
    m_at,
} from "./rm.h.macros.js";
import {
    H_IBM, ROGUESET, SYM_BOULDER, SYM_HERO_OVERRIDE, SYM_INVISIBLE, SYM_NOTHING, SYM_PET_OVERRIDE,
    SYM_UNEXPLORED, WARNCOUNT,
} from "./sym.h.js";
import {
    DARKROOMSYM, SYMHANDLING, is_cmap_furniture, is_cmap_room, is_cmap_wall,
} from "./sym.h.macros.js";
import { BEAR_TRAP, NO_TRAP, WEB } from "./trap.h.js";
import { is_pit } from "./trap.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import {
    clear_nhwindow, curs, display_nhwindow, nh_delay_output, print_glyph,
} from "./winprocs.h.macros.js";
import { struct_glyph_map_entry, struct_glyphinfo } from "./wintype.h.js";
import { BC_BALL, BC_CHAIN } from "./you.h.js";
import { Ugender, Upolyd, next2u, u_at } from "./you.h.macros.js";
import {
    Blind, Blind_telepat, Detect_monsters, Hallucination, Infravision,
    Protection_from_shape_changers, Punished, See_invisible, Unblind_telepat, Underwater,
    Warn_of_mon, Warning,
} from "./youprop.h.macros.js";
import {
    char, int, ord, schar, short, sizeof, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import { free } from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_to, ref_of, struct, struct_assign, struct_copy, view_of,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { Sting_effects } from "./artifact.js";
import { bot, timebot } from "./botl.js";
import { isok } from "./cmd.js";
import { is_ice, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    a11y, cg, disp, flags, gc, gd, gf, gg, gi, go, gs, gw, gy, iflags, program_state, shield_static,
    svc, svl, svm, u,
} from "./decl.js";
import { def_warnsyms, defsyms } from "./drawing.js";
import { on_level, update_lastseentyp } from "./dungeon.js";
import { panic } from "./end.js";
import { can_reach_floor, engr_at, engr_can_be_felt } from "./engrave.js";
import { mapxy_valid } from "./getpos.js";
import { glyph_to_cmap } from "./glyphs.js";
import { sgn } from "./hacklib.js";
import { sobj_at, update_inventory } from "./invent.js";
import { cmap_to_type } from "./mkroom.js";
import { iter_mons } from "./mon.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import { do_screen_description } from "./pager.js";
import { impossible, pline_xy } from "./pline.js";
import { show_region, visible_region_at } from "./region.js";
import { rn2_on_display_rng } from "./rnd.js";
import { known_branch_stairs, stairway_at } from "./stairs.js";
import { sysopt } from "./sys.js";
import { t_at } from "./trap.js";
import { block_point, unblock_point, vision_recalc } from "./vision.js";
import { has_color } from "./windows.js";
import { see_wsegs } from "./worm.js";
