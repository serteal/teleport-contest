/* NetHack 5.0	teleport.c	$NHDT-Date: 1769342601 2026/01/25 04:03:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.239 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/* does monster block others from teleporting? */
function m_blocks_teleporting(mtmp) { /* boolean */
    if (is_dlord(mtmp.data) || is_dprince(mtmp.data))
        return TRUE;
    return FALSE;
}

/* teleporting is prevented on this level for this monster? */
export function noteleport_level(mon) { /* boolean */
    /* demon court in Gehennom prevent others from teleporting */
    if (In_hell(u.uz) && !(is_dlord(mon.data) || is_dprince(mon.data)))
        if (get_iter_mons(m_blocks_teleporting))
            return TRUE;

    /* natural no-teleport level; covetous monsters can bypass these */
    if (svl.level.flags.noteleport && !is_covetous(mon.data))
        return TRUE;

    /* wand of stasis prevents teleportation while the effect is active
       (even for covetous monsters) */
    if (svl.level.flags.stasis_until >= svm.moves)
        return TRUE;

    return FALSE;
}

/* this is an approximation of onscary() that doesn't use any 'struct monst'
   fields aside from 'monst->data'; used primarily for new monster creation
   and monster teleport destination, not for ordinary monster movement */
function goodpos_onscary(
    x, y,
    mptr) { /* boolean */
    /* onscary() checks Angels and lawful minions; this oversimplifies */
    if (mptr.mlet == S_HUMAN || mptr.mlet == S_ANGEL
        || is_rider(mptr) || unique_corpstat(mptr))
        return FALSE;
    /* onscary() checks for vampshifted vampire bats/fog clouds/wolves too */
    if (IS_ALTAR(levl()[x][y].typ) && mptr.mlet == S_VAMPIRE)
        return TRUE;
    /* scare monster scroll doesn't have any of the below restrictions,
       being its own source of power */
    if (sobj_at(SCR_SCARE_MONSTER, x, y))
        return TRUE;
    /* engraved Elbereth doesn't work in Gehennom or the end-game */
    if (Inhell() || In_endgame(u.uz))
        return FALSE;
    /* creatures who don't (or can't) fear a written Elbereth and weren't
       caught by the minions check */
    if (mptr == mons[PM_MINOTAUR] || !haseyes(mptr))
        return FALSE;
    return sengr_at(_("Elbereth"), x, y, TRUE) ? TRUE : FALSE;
}

/*
 * Is (x,y) a good position of mtmp?  If mtmp is NULL, then is (x,y) good
 * for an object?
 *
 * This function will only look at mtmp->mdat, so makemon, mplayer, etc can
 * call it to generate new monster positions with fake monster structures.
 */
export function goodpos(
    x, y,
    mtmp,
    gpflags) { /* boolean */
    let mdat = null;
    let ignorewater = +((gpflags & MM_IGNOREWATER) != 0),
            ignorelava = +((gpflags & MM_IGNORELAVA) != 0),
            checkscary = +((gpflags & GP_CHECKSCARY) != 0),
            allow_u = +((gpflags & GP_ALLOW_U) != 0),
            avoid_monpos = +((gpflags & GP_AVOID_MONPOS) != 0);

    if (!isok(x, y))
        return FALSE;

    /* in many cases, we're trying to create a new monster, which
     * can't go on top of the player or any existing monster.
     * however, occasionally we are relocating engravings or objects,
     * which could be co-located and thus get restricted a bit too much.
     * oh well.
     */
    if (!allow_u) {
        if (u_at(x, y) && mtmp != gy.youmonst
            && (mtmp != u.ustuck || !u.uswallow)
            && (!u.usteed || mtmp != u.usteed))
            return FALSE;
    }

    if (MON_AT(x, y) && avoid_monpos)
        return FALSE;

    if (mtmp) {
        let mtmp2 = m_at(x, y);

        /* Be careful with long worms.  A monster may be placed back in
         * its own location.  Normally, if m_at() returns the same monster
         * that we're trying to place, the monster is being placed in its
         * own location.  However, that is not correct for worm segments,
         * because all the segments of the worm return the same m_at().
         * Actually we overdo the check a little bit--a worm can't be placed
         * in its own location, period.  If we just checked for mtmp->mx
         * != x || mtmp->my != y, we'd miss the case where we're called
         * to place the worm segment and the worm's head is at x,y.
         */
        if (mtmp2 && (mtmp2 != mtmp || mtmp.wormno))
            return FALSE;

        mdat = mtmp.data;
        if (is_pool(x, y) && !ignorewater) {
            /* [what about Breathless?] */
            if (mtmp == gy.youmonst)
                return ((Swimming() || Amphibious()
                        || (!Is_waterlevel(u.uz)
                            && !is_waterwall(x, y)
                            /* water on the Plane of Water has no surface
                               so there's no way to be on or above that */
                            && (Levitation() || Flying() || Wwalking())) ? 1 : 0));
            else
                return (is_swimmer(mdat)
                        || (!Is_waterlevel(u.uz)
                            && !is_waterwall(x, y)
                            && m_in_air(mtmp)) ? 1 : 0);
        } else if (mdat.mlet == S_EEL && rn2(13) && !ignorewater) {
            return FALSE;
        } else if (is_lava(x, y) && !ignorelava) {
            /* 3.6.3: floating eye can levitate over lava but it avoids
               that due the effect of the heat causing it to dry out */
            if (mdat == mons[PM_FLOATING_EYE])
                return FALSE;
            else if (mtmp == gy.youmonst)
                return (Levitation() || Flying()
                        || (Fire_resistance() && Wwalking() && uarmf
                            && uarmf.oerodeproof)
                        || (Upolyd() && likes_lava(gy.youmonst.data)) ? 1 : 0);
            else
                return (m_in_air(mtmp) || likes_lava(mdat) ? 1 : 0);
        }
        if (passes_walls(mdat) && may_passwall(x, y))
            return TRUE;
        if (amorphous(mdat) && closed_door(x, y))
            return TRUE;
        /* avoid onscary() if caller has specified that restriction */
        if (checkscary && (mtmp.m_id ? onscary(x, y, mtmp)
                                      : goodpos_onscary(x, y, mdat)))
            return FALSE;
    }
    if (!accessible(x, y)) {
        if (!(is_pool(x, y) && ignorewater)
            && !(is_lava(x, y) && ignorelava))
            return FALSE;
    }
    /* skip boulder locations for most creatures */
    if (sobj_at(BOULDER, x, y) && (!mdat || !throws_rocks(mdat)))
        return FALSE;
    /* pretend GP_AVOID_MONPOS == monster creation */
    if (avoid_monpos && is_exclusion_zone(LR_MONGEN, x, y))
        return FALSE;

    return TRUE;
}

/*
 * "entity next to"
 *
 * Attempt to find a good place for the given monster type in the closest
 * position to (xx,yy).  Do so in successive square rings around (xx,yy).
 * If there is more than one valid position in the ring, choose one randomly.
 * Return TRUE and the position chosen when successful, FALSE otherwise.
 */
export function enexto(
    cc,
    xx, yy,
    mdat) { /* boolean */
    return (enexto_core(cc, xx, yy, mdat, GP_CHECKSCARY)
            || enexto_core(cc, xx, yy, mdat, NO_MM_FLAGS) ? 1 : 0);
}

export function enexto_gpflags(
    cc,
    xx, yy,
    mdat,
    entflags) { /* boolean */
    return (enexto_core(cc, xx, yy, mdat, or64(GP_CHECKSCARY, entflags))
            || enexto_core(cc, xx, yy, mdat, entflags) ? 1 : 0);
}

export function enexto_core(
    cc,
    xx, yy,
    mdat,

    entflags) { /* boolean */ /* flags for goodpos() */
    const $frame = stack_frame(); try {
    let candy = stack_array(struct_nhcoord, ROWNO * (COLNO - 1)); /* enough room for every location */
    let i, nearcandyct, allcandyct;
    let fakemon = stack_struct(struct_monst); /* dummy monster */
    let allow_xx_yy = (+((entflags & GP_ALLOW_XY) != 0));
    /* note: GP_ALLOW_XY isn't used by goodpos(); old enext_core() used to
       mask it off to hide it from goodpos but that isn't required and we
       want to keep it in case the debugpline4() gets called */

    if (!mdat) {
        debugpline0(_("enexto() called with null mdat"), __FILE__);
        /* default to player's original monster type */
        mdat = mons[u.umonster];
    }
    struct_assign(fakemon, cg.zeromonst);
    set_mon_data(fakemon, mdat); /* set up for goodpos() */

    /* gather candidate coordinates within 3 steps, those 1 step away in
       random order first, then those 2 steps away in random order, then 3;
       this will usually find a good spot without scanning the whole map */
    nearcandyct = collect_coords(candy[0], xx, yy, 3, CC_NO_FLAGS,
                                 null);
    for (i = 0; i < nearcandyct; ++i) {
        struct_assign(cc, candy[i]);
        if (goodpos(cc.x, cc.y, fakemon, entflags))
            return TRUE;
    }

    /* didn't find a spot; gather coordinates for the whole map except
       for <xx,yy> itself, ordered in expanding distance from <xx,yy>
       (subsets of equal distance grouped together with order randomized) */
    allcandyct = collect_coords(candy[0], xx, yy, 0, CC_NO_FLAGS,
                                null);
    /* skip first 'nearcandyct' spots, they have already been rejected;
       they will occur in different random order but same overall total */
    for (i = nearcandyct; i < allcandyct; ++i) {
        struct_assign(cc, candy[i]);
        if (goodpos(cc.x, cc.y, fakemon, entflags))
            return TRUE;
    }

    /* still didn't find a spot; maybe try <xx,yy> itself */
    cc.x = xx, cc.y = yy; /* final value for 'cc' in case we return False */
    if (allow_xx_yy && goodpos(cc.x, cc.y, fakemon, entflags))
        return TRUE;

    /* failed to find any acceptable spot */
    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("enexto(\"%s\",%d,%d,0x%08llx) failed"), mdat.pmnames[NEUTRAL], xx, yy, entflags); iflags.last_msg = save_plnmsg; } } while (0)

;
    return FALSE;
    } finally { stack_pop($frame); }
}

/* #else (#ifdef NEW_ENEXTO): not in this build */

/*
 * Check for restricted areas present in some special levels.  (This might
 * need to be augmented to allow deliberate passage in wizard mode, but
 * only for explicitly chosen destinations.)
 */
function tele_jump_ok(x1, y1, x2, y2) { /* boolean */
    if (!isok(x2, y2))
        return FALSE;
    if (svd.dndest.nlx > 0) {
        /* if inside a restricted region, can't teleport outside */
        if (within_bounded_area(x1, y1, svd.dndest.nlx, svd.dndest.nly,
                                svd.dndest.nhx, svd.dndest.nhy)
            && !within_bounded_area(x2, y2, svd.dndest.nlx, svd.dndest.nly,
                                    svd.dndest.nhx, svd.dndest.nhy))
            return FALSE;
        /* and if outside, can't teleport inside */
        if (!within_bounded_area(x1, y1, svd.dndest.nlx, svd.dndest.nly,
                                 svd.dndest.nhx, svd.dndest.nhy)
            && within_bounded_area(x2, y2, svd.dndest.nlx, svd.dndest.nly,
                                   svd.dndest.nhx, svd.dndest.nhy))
            return FALSE;
    }
    if (svu.updest.nlx > 0) { /* ditto */
        if (within_bounded_area(x1, y1, svu.updest.nlx, svu.updest.nly,
                                svu.updest.nhx, svu.updest.nhy)
            && !within_bounded_area(x2, y2, svu.updest.nlx, svu.updest.nly,
                                    svu.updest.nhx, svu.updest.nhy))
            return FALSE;
        if (!within_bounded_area(x1, y1, svu.updest.nlx, svu.updest.nly,
                                 svu.updest.nhx, svu.updest.nhy)
            && within_bounded_area(x2, y2, svu.updest.nlx, svu.updest.nly,
                                   svu.updest.nhx, svu.updest.nhy))
            return FALSE;
    }
    return TRUE;
}

function teleok(x, y, trapok) { /* boolean */
    if (!trapok) {
        /* allow teleportation onto vibrating square, it's not a real trap;
           also allow pits and holes if levitating or flying */
        let trap = t_at(x, y);

        if (!trap)
            trapok = TRUE;
        else if (trap.ttyp == VIBRATING_SQUARE)
            trapok = TRUE;
        else if ((is_pit(trap.ttyp) || is_hole(trap.ttyp))
                 && (Levitation() || Flying()))
            trapok = TRUE;

        if (!trapok)
            return FALSE;
    }
    if (!goodpos(x, y, gy.youmonst, 0))
        return FALSE;
    if (!tele_jump_ok(u.ux, u.uy, x, y))
        return FALSE;
    if (!in_out_region(x, y))
        return FALSE;
    return TRUE;
}

export function teleds(nux, nuy, teleds_flags) { /* void */
    const $frame = stack_frame(); try {
    let was_swallowed;
    let ball_active, ball_still_in_range = FALSE,
            allow_drag = +((teleds_flags & TELEDS_ALLOW_DRAG) != 0),
            is_teleport = +((teleds_flags & TELEDS_TELEPORT) != 0);
    let vault_guard = vault_occupied(u.urooms) ? findgd() : null;

    if (u.utraptype == TT_BURIEDBALL) {
        /* unearth it */
        buried_ball_to_punishment();
    }
    ball_active = +(Punished() && uball.where != OBJ_FREE);
    if (!ball_active
        || near_capacity() > SLT_ENCUMBER
        || distmin(u.ux, u.uy, nux, nuy) > 1)
        allow_drag = FALSE;

    /* If they have to move the ball, then drag if allow_drag is true;
     * otherwise they are teleporting, so unplacebc().
     * If they don't have to move the ball, then always "drag" whether or
     * not allow_drag is true, because we are calling that function, not
     * to drag, but to move the chain.  *However*, there are some dumb
     * special cases:
     *    0                          0
     *   _X  move east       ----->  X_
     *    @                           @
     * These are permissible if teleporting, but not if dragging.  As a
     * result, drag_ball() needs to know about allow_drag and might end
     * up dragging the ball anyway.  Also, drag_ball() might find that
     * dragging the ball is completely impossible (ball in range but there's
     * rock in the way), in which case it teleports the ball on its own.
     */
    if (ball_active) {
        if (!carried(uball) && distmin(nux, nuy, uball.ox, uball.oy) <= 2)
            ball_still_in_range = TRUE; /* don't have to move the ball */
        else if (!allow_drag)
            unplacebc(); /* have to move the ball */
    }
    reset_utrap(FALSE);
    was_swallowed = u.uswallow; /* set_ustuck(Null) clears uswallow */
    set_ustuck(null);
    u.ux0 = u.ux;
    u.uy0 = u.uy;

    if (!hideunder(gy.youmonst) && gy.youmonst.data.mlet == S_MIMIC) {
        /* mimics stop being unnoticed */
        gy.youmonst.m_ap_type = M_AP_NOTHING;
    }

    if (was_swallowed) {
        if (Punished()) { /* ball&chain are off map while swallowed */
            ball_active = TRUE; /* to put chain and non-carried ball on map */
            ball_still_in_range = allow_drag = FALSE; /* (redundant) */
        }
        docrt();
    }
    if (ball_active && (ball_still_in_range || allow_drag)) {
        let bc_control = stack_var(int);
        let ballx = stack_var(coordxy), bally = stack_var(coordxy), chainx = stack_var(coordxy), chainy = stack_var(coordxy);
        let cause_delay = stack_var(boolean);

        if (drag_ball(nux, nuy, bc_control, ballx, bally, chainx,
                      chainy, addr_of(cause_delay), allow_drag))
            move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
        else {
            /* dragging fails if hero is encumbered beyond 'burdened' */
            /* uball might've been cleared via drag_ball -> spoteffects ->
               dotrap -> magic trap unpunishment */
            ball_active = +(Punished() && uball.where != OBJ_FREE);
            if (ball_active)
                unplacebc(); /* to match placebc() below */
        }
    }

    /* must set u.ux, u.uy after drag_ball(), which may need to know
       the old position if allow_drag is true... */
    u_on_newpos(nux, nuy); /* set u.<x,y>, usteed-><mx,my>; cliparound() */
    fill_pit(u.ux0, u.uy0);
    if (ball_active && uchain && uchain.where == OBJ_FREE)
        placebc(); /* put back the ball&chain if they were taken off map */
    update_player_regions();
    /*
     *  Make sure the hero disappears from the old location.  This will
     *  not happen if she is teleported within sight of her previous
     *  location.  Force a full vision recalculation because the hero
     *  is now in a new location.
     */
    newsym(u.ux0, u.uy0);
    see_monsters();
    gv.vision_full_recalc = 1;
    nomul(0);
    notice_mon_off();
    vision_recalc(0); /* vision before effects */

    /* this used to take place sooner, but if a --More-- prompt was issued
       then the old map display was shown instead of the new one */
    if (is_teleport && flags.verbose)
        You(_("materialize in %s location!"),
            (nux == u.ux0 && nuy == u.uy0) ? _("the same") : _("a different"));
    /* if terrain type changes, levitation or flying might become blocked
       or unblocked; might issue message, so do this after map+vision has
       been updated for new location instead of right after u_on_newpos() */
    if (levl()[u.ux][u.uy].typ != levl()[u.ux0][u.uy0].typ)
        switch_terrain();
    /* sequencing issue:  we want guard's alarm, if any, to occur before
       room entry message, if any, so need to check for vault exit prior
       to spoteffects; but spoteffects() sets up new value for u.urooms
       and vault code depends upon that value, so we need to fake it */
    if (vault_guard) {
        let save_urooms = stack_array(char, 5); /* [sizeof u.urooms] */

        strcpy(save_urooms, u.urooms);
        strcpy(u.urooms, in_rooms(u.ux, u.uy, VAULT));
        /* if hero has left vault, make guard notice */
        if (!vault_occupied(u.urooms))
            uleftvault(vault_guard);
        strcpy(u.urooms, save_urooms); /* reset prior to spoteffects() */
    }
    /* possible shop entry message comes after guard's shrill whistle */
    spoteffects(TRUE);
    invocation_message();
    notice_mon_on();
    notice_all_mons(TRUE);
    return;
    } finally { stack_pop($frame); }
}

/* make a list of coordinates in expanding distance from <cx,cy>;
   return value is number of coordinates inserted into ccc[]  */
export function collect_coords(
    ccc,
    cx, cy,
    maxradius,

    cc_flags,

    filter) { /* int */ /* if Null, no filtering */
    const $frame = stack_frame(); try {
    let x, y, lox, hix, loy, hiy;
    let radius, rowrange, colrange, k, n = 0;
    let cc = stack_struct(struct_nhcoord), passcc = null;
    let newpass, passend,

            include_cxcy = +((cc_flags & CC_INCL_CENTER) != 0),

            scramble = +((cc_flags & CC_UNSHUFFLED) == 0),

            ring_pairs = (scramble && (cc_flags & CC_RING_PAIRS) != 0 ? 1 : 0),

            skip_mons = +((cc_flags & CC_SKIP_MONS) != 0),

            skip_inaccessible = +((cc_flags & CC_SKIP_INACCS) != 0);
    let result = 0;

    rowrange = (cy < Math.trunc(ROWNO / 2)) ? (ROWNO - 1 - cy) : cy;
    colrange = (cx < Math.trunc(COLNO / 2)) ? (COLNO - 1 - cx) : cx;
    k = max(rowrange, colrange);
    /* if no radius limit has been specified, cover the whole map */
    if (!maxradius)
        maxradius = k;
    else
        maxradius = min(maxradius, k);
    /*
     * We operate on an expanding radius around the center, optionally
     * starting with the center spot itself, and shuffle the edges of
     * each expanding square or "ring".  (So all 1's are shuffled at
     * end of the pass for radius==1, then all 2's at end of radius==2,
     * and so on.  Shuffling of each ring doesn't encroach on any of
     * the others except when ring_pairs mode is specified.)
     *
     * Diagram of first three rings (four if 'include_cxcy' is specified)
     *   rings       unshuffled output      sample shuffled output (varies)
     *  3333333     25 26  .  .  .  . 31     33 29  .  .  .  . 44
     *  3222223     32  9 10 11 12 13 33     35 22 16 14 24 13 40
     *  3211123     34 14  1  2  3 15  .     38 20  2  8  3 15  .
     *  3210123     .  16  4  0  5 17  .     .  11  1  0  6  9  .
     *  3211123     .  18  6  7  8 19 39     .  19  5  7  4 12 25
     *  3222223     40 20 21 22 23 24 41     43 10 21 17 23 18 27
     *  3333333     42  .  .  .  . 47 48     37  .  .  .  . 30 36
     * . == entry not shown to reduce clutter when viewing inner portion.
     *
     * The digits under 'rings' are ring number, which is also distmin
     * from center, indicating the order in which sets of spots are
     * evaluated.  Output gets collected in expanding rings.  For the
     * two output grids, the number shown represents the position in the
     * returned list of coordinates.  When shuffling while ring_pairs is
     * specified, the 1's and 2's will be mixed together, the 3's and
     * (unshown) 4's will be mixed together, and so forth.
     *
     * If caller processes the output list in order, the closest viable
     * spot will be chosen.  If a completely random spot is preferred,
     * the list can be requested to be unscrambled and then the caller
     * can shuffle it, overriding the collection rings.  A filter function
     * could be used to skip everything after the first acceptable spot.
     * 'ring_pairs' mode allows for choosing a very close spot that isn't
     * immediately adjacent to the center point, useful for emergency
     * teleport to not always end up at the closest possible spot.
     *
     * TODO:
     *  Redo filter interface to have caller pass in a context cookie
     *  that can be passed through to filter so that it could have access
     *  to more info than just <x,y>.  Also add a way to stop collecting
     *  when an optimal value is found, without checking and skipping the
     *  rest of the map.
     */
    for (radius = include_cxcy ? 0 : 1; radius <= maxradius; ++radius) {
        if (!ring_pairs) {
            newpass = passend = TRUE;
        } else {
            /* 0 (if include_cxcy) and maxradius override odd/even */
            newpass = +((radius % 2) != 0 || radius == 0); /* odd */
            passend = +((radius % 2) == 0 || radius == maxradius); /* even */
        }
        if (newpass || !passcc) { /* !passcc is redundant but used to fend
                                   * off analyzers thinking use of passcc
                                   * below might occur while still Null */
            passcc = ccc; /* start of output entries for current radius (or
                           * first half of radius pair depending on flags) */
            n = 0; /* number of entries for passcc; used for shuffling */
        }
        lox = cx - radius, hix = cx + radius;
        loy = cy - radius, hiy = cy + radius;
        for (y = max(loy, 0); y <= hiy; ++y) {
            if (y > ROWNO - 1)
                break; /* done with collection for current radius */
            for (x = max(lox, 1); x <= hix; ++x) { /* column 0 is not used */
                if (x > COLNO - 1)
                    break; /* advance to next 'y' */
                if (x != lox && x != hix && y != loy && y != hiy)
                    continue; /* not any edge of ring/square */
                if ((skip_mons && m_at(x, y))
                    /* note: !ACCESSIBLE() would reject water and lava;
                       !ZAP_POS() accepts them; caller needs to handle such */
                    || (skip_inaccessible && !ZAP_POS(levl()[x][y].typ)))
                    continue; /* quick filters */
                if (filter && !filter(x, y))
                    continue;
                cc.x = x, cc.y = y;
                struct_assign((ccc = ptr_add(ccc, 1), ptr_add(ccc, -1)), cc);
                ++n;
                ++result;
            }
        }
        if (scramble && passend) {
            /* shuffle entries gathered for current radius (or pair) */
            while (n > 1) {
                k = rn2(n); /* 0..n-1 */
                if (k) { /* swap [k] with [0] when k is 1..n-1 */
                    struct_assign(cc, ptr_add(passcc, 0));
                    struct_assign(ptr_add(passcc, 0), ptr_add(passcc, k));
                    struct_assign(ptr_add(passcc, k), cc);
                }
                passcc = ptr_add(passcc, 1); /* passcc[0] has reached its final place    */
                --n;      /* and become exempt from further shuffling */
            }
        }
    } /* radius loop */
    debugpline4(_("collect_coords(,%d,%d,%d,,)=%d"), cx, cy, maxradius, result, __FILE__);
    return result;
    } finally { stack_pop($frame); }
}

/* [try to] teleport hero to a safe spot */
export function safe_teleds(teleds_flags) { /* boolean */
    const $frame = stack_frame(); try {
    let nux, nuy;
    let cc_flags;
    let candy = stack_array(struct_nhcoord, ROWNO * (COLNO - 1)), backupspot = stack_struct(struct_nhcoord);
    let tcnt, candycount;

    /*
     * This used to try random locations up to 400 times, with first 200
     * tries disallowing trap locations and remaining 200 accepting such.
     * On levels without many accessible locations (either due to being
     * mostly stone or high monster population) it could fail to find a
     * spot.
     *
     * Now it tries completely randomly only 40 times, all disallowing
     * traps, then resorts to checking the entire map, near hero's spot
     * first then expanding out from there.  If no non-trap spot is found,
     * first trap spot is used.
     */
    for (tcnt = 0; tcnt < 40; ++tcnt) {
        nux = rnd(COLNO - 1);
        nuy = rn2(ROWNO);
        if (teleok(nux, nuy, FALSE)) {
            teleds(nux, nuy, teleds_flags);
            return TRUE;
        }
    }

    /* get a shuffled list of candidate locations, starting with spots
       1 or 2 steps from hero, then 3 or 4 steps, then 5 or 6, on up */
    cc_flags = CC_RING_PAIRS | CC_SKIP_MONS;
    if (!Passes_walls())
        cc_flags = unsigned(cc_flags | CC_SKIP_INACCS);
    candycount = collect_coords(candy[0], u.ux, u.uy, 0, cc_flags,
                                null);
    backupspot.x = backupspot.y = 0;
    /* skip trap locations via teleok(,,FALSE) but remember first
       encountered trap spot that is acceptable to teleok(,,TRUE) */
    for (tcnt = 0; tcnt < candycount; ++tcnt) {
        nux = candy[tcnt].x, nuy = candy[tcnt].y;
        if (teleok(nux, nuy, FALSE)) {
            teleds(nux, nuy, teleds_flags);
            return TRUE;
        }
        if (!backupspot.x && t_at(nux, nuy) && teleok(nux, nuy, TRUE))
            backupspot.x = nux, backupspot.y = nuy;
    }
    /* no non-trap spot found; if we skipped a viable trap spot, use it */
    if (backupspot.x) {
        teleds(backupspot.x, backupspot.y, teleds_flags);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

function vault_tele() { /* void */
    const $frame = stack_frame(); try {
    let croom = search_special(VAULT);
    let c = stack_struct(struct_nhcoord);

    if (croom && somexyspace(croom, c) && teleok(c.x, c.y, FALSE)) {
        teleds(c.x, c.y, TELEDS_TELEPORT);
        return;
    }
    tele();
    } finally { stack_pop($frame); }
}

export function teleport_pet(mtmp, force_it) { /* boolean */
    let $goto = null;
    var otmp;

    if (mtmp == u.usteed)
        return FALSE;

    if (mtmp.mleashed) {
        otmp = get_mleash(mtmp);
        $goto_release_it: for (;;) { switch ($goto) { default: if (!otmp) {
            impossible(_("%s is leashed, without a leash."), Monnam(mtmp));
            { $goto = "release_it"; continue $goto_release_it; }
        }
        case "release_it": if (!$goto && (otmp.cursed && !force_it)) {
            yelp(mtmp);
            return FALSE;
        } else {
            switch ($goto) { default: Your(_("leash goes slack."));
 case "release_it": $goto = null;
            m_unleash(mtmp, FALSE); }
            return TRUE;
        } } break; }
    }
    return TRUE;
}

/* teleport to random pet, if valid location next to it */
export function tele_to_rnd_pet() { /* void */
    let mtmp, pet = null;
    let cnt = 0;

    if (noteleport_level(gy.youmonst)) {
        impossible(_("%s"), _("attempt to teleport hero to be near a pet" +
                         " on no-teleport level"));
        return;
    }

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
        if (!DEADMONSTER(mtmp) && mtmp.mtame && !mon_offmap(mtmp)) {
            cnt++;
            if (!rn2(cnt))
                pet = mtmp;
        }
    if (pet && !m_next2u(pet)) {
        let tx = pet.mx + rn2(3) - 1,
                ty = pet.my + rn2(3) - 1;

        if (isok(tx, ty) && teleok(tx, ty, FALSE))
            teleds(tx, ty, TELEDS_TELEPORT);
    }
}

/* teleport the hero via some method other than scroll of teleport */
export function tele() { /* void */
    scrolltele(null);
}

/* teleport the hero; usually discover scroll of teleportation if via scroll */
export function scrolltele(scroll) { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);

    /* Disable teleportation in stronghold && Vlad's Tower */
    if (noteleport_level(gy.youmonst) && !wizard()) {
        pline(_("A mysterious force prevents you from teleporting!"));
        if (scroll)
            learnscroll(scroll); /* this is obviously a teleport scroll */
        return;
    }

    /* don't show trap if "Sorry..." */
    if (!Blinded())
        make_blinded(0, FALSE);

    if ((u.uhave.amulet || On_W_tower_level(u.uz)) && !rn2(3)) {
        You_feel(_("disoriented for a moment."));
        /* don't discover the scroll [at least not yet for wizard override];
           disorientation doesn't reveal that this is a teleport attempt */
        if (!wizard() || y_n(_("Override?")) != ord('y'))
            return;
    }
    if (((Teleport_control() || (scroll && scroll.blessed)) && !Stunned())
        || wizard()) {
        if (unconscious()) {
            pline(_("Being unconscious, you cannot control your teleport."));
        } else {
            let whobuf = stack_array(char, BUFSZ);

            strcpy(whobuf, _("you"));
            if (u.usteed)
                sprintf(eos(whobuf), _(" and %s"), mon_nam(u.usteed));
            pline(_("Where do %s want to be teleported?"), whobuf);
            if (scroll)
                learnscroll(scroll);
            cc.x = u.ux;
            cc.y = u.uy;
            if (isok(iflags.travelcc.x, iflags.travelcc.y)) {
                /* The player showed some interest in traveling here;
                 * pre-suggest this coordinate. */
                struct_assign(cc, iflags.travelcc);
            }
            if (getpos(cc, TRUE, _("the desired position")) < 0)
                return; /* abort */
            /* possible extensions: introduce a small error if
               magic power is low; allow transfer to solid rock */
            if (teleok(cc.x, cc.y, FALSE)) {
                /* for scroll, discover it regardless of destination */
                teleds(cc.x, cc.y, TELEDS_TELEPORT);
                if (u_at(iflags.travelcc.x, iflags.travelcc.y))
                    iflags.travelcc.x = iflags.travelcc.y = 0;
                return;
            }
            pline(_("Sorry..."));
        }
    }

    /* we used to suppress discovery if hero teleported to a nearby
       spot which was already within view, but now there is always a
       "materialize" message regardless of how far you teleported so
       discovery of scroll type is unconditional */
    if (scroll)
        learnscroll(scroll);

    safe_teleds(TELEDS_TELEPORT);
    } finally { stack_pop($frame); }
}

/* the #teleport command; 'm ^T' == choose among several teleport modes */
export function dotelecmd() { /* int */
    const $frame = stack_frame(); try {
    let save_HTele, save_ETele;
    let res, added, hidden;
    let ignore_restrictions = FALSE;
/* also defined in spell.c */

    /* normal mode; ignore 'm' prefix if it was given */
    if (!wizard())
        return dotele(FALSE) ? ECMD_TIME : ECMD_OK;

    added = hidden = NOOP_SPELL;
    save_HTele = HTeleportation(), save_ETele = ETeleportation();
    if (!iflags.menu_requested) {
        ignore_restrictions = TRUE;
    } else {
        const struct_tporttypes = struct("dotelecmd.struct_tporttypes", {
            menulet: char,
            menudesc: ptr_to(char),
        }); let tports = static_array("dotelecmd.tports", struct_tporttypes, null, [
            /*
             * Potential combinations:
             *  1) attempt ^T without intrinsic, not know spell;
             *  2) via intrinsic, not know spell, obey restrictions;
             *  3) via intrinsic, not know spell, ignore restrictions;
             *  4) via intrinsic, know spell, obey restrictions;
             *  5) via intrinsic, know spell, ignore restrictions;
             *  6) via spell, not have intrinsic, obey restrictions;
             *  7) via spell, not have intrinsic, ignore restrictions;
             *  8) force, obey other restrictions;
             *  9) force, ignore restrictions.
             * We only support the 1st (t), 2nd (n), 6th (s), and 9th (w).
             *
             * This ignores the fact that there is an experience level
             * (or poly-form) requirement which might make normal ^T fail.
             */
            { menulet: ord('n'), menudesc: _("normal ^T on demand; no spell, obey restrictions") },
            { menulet: ord('s'), menudesc: _("via spellcast; no intrinsic teleport") },
            { menulet: ord('t'), menudesc: _("try ^T without having it; no spell") },
            { menulet: ord('w'), menudesc: _("debug mode; ignore restrictions") }, /* trad wizard mode */
        ]);
        let picks = stack_var(ptr_to(struct_mi), null);
        let any = stack_struct(struct_any);
        let win;
        let i, tmode, clr = NO_COLOR;

        win = create_nhwindow()(NHW_MENU);
        start_menu()(win, MENU_BEHAVE_STANDARD);
        struct_assign(any, cg.zeroany);
        for (i = 0; i < SIZE(tports); ++i) {
            any.a_int = (tports[i].menulet);
            add_menu(win, nul_glyphinfo, any, char(any.a_int), 0,
                     ATR_NONE, clr, tports[i].menudesc,
                     (tports[i].menulet == ord('w')) ? MENU_ITEMFLAGS_SELECTED
                                                : MENU_ITEMFLAGS_NONE);
        }
        end_menu()(win, _("Which way do you want to teleport?"));
        i = select_menu(win, PICK_ONE, picks);
        destroy_nhwindow()(win);
        if (i > 0) {
            tmode = ptr_add(picks[0], 0).item.a_int;
            /* if we got 2, use the one which wasn't preselected */
            if (i > 1 && tmode == ord('w'))
                tmode = ptr_add(picks[0], 1).item.a_int;
            free(addr_of(picks[0]));
        } else if (i == 0) {
            /* preselected one was explicitly chosen and got toggled off */
            tmode = ord('w');
        } else { /* ESC */
            return ECMD_OK;
        }
        switch (tmode) {
        case ord('n'):
            u.uprops[TELEPORT].intrinsic = or64(u.uprops[TELEPORT].intrinsic, I_SPECIAL); /* confer intrinsic teleportation */
            hidden = tport_spell(HIDE_SPELL); /* hide teleport-away */
            break;
        case ord('s'):
            u.uprops[TELEPORT].intrinsic = u.uprops[TELEPORT].extrinsic = 0; /* suppress intrinsic */
            added = tport_spell(ADD_SPELL); /* add teleport-away */
            break;
        case ord('t'):
            u.uprops[TELEPORT].intrinsic = u.uprops[TELEPORT].extrinsic = 0; /* suppress intrinsic */
            hidden = tport_spell(HIDE_SPELL); /* hide teleport-away */
            break;
        case ord('w'):
            ignore_restrictions = TRUE;
            break;
        }
    }

    /* if dotele() can be fatal, final disclosure might lie about
       intrinsic teleportation; we should be able to live with that
       since the menu finagling is only applicable in wizard mode */
    res = dotele(ignore_restrictions);

    u.uprops[TELEPORT].intrinsic = save_HTele;
    u.uprops[TELEPORT].extrinsic = save_ETele;
    if (added != NOOP_SPELL || hidden != NOOP_SPELL)
        /* can't both be non-NOOP so addition will yield the non-NOOP one */
        tport_spell(added + hidden - NOOP_SPELL);

    return res ? ECMD_TIME : ECMD_OK;
    } finally { stack_pop($frame); }
}
export const NOOP_SPELL = 0;
export const HIDE_SPELL = 1;
export const ADD_SPELL = 2;

export function dotele(
    break_the_rules) { /* int */ /* True: wizard mode ^T */
    let trap;
    let cantdoit;
    let trap_once = FALSE;

    trap = t_at(u.ux, u.uy);
    if (trap && !trap.tseen)
        trap = null;

    if (trap) {
        if (trap.ttyp == LEVEL_TELEP && trap.tseen) {
            if (y_n(_("There is a level teleporter here. Trigger it?")) == ord('y')) {
                level_tele_trap(trap, FORCETRAP);
                /* deliberate jumping will always take time even if it doesn't
                 * work */
                return 1;
            } else
                trap = null; /* continue with normal horizontal teleport */
        } else if (trap.ttyp == TELEP_TRAP) {
            trap_once = trap.once; /* trap may get deleted, save this */
            if (trap.once) {
                pline(_("This is a vault teleport, usable once only."));
                if (y_n(_("Jump in?")) == ord('n')) {
                    trap = null;
                } else {
                    deltrap(trap);
                    newsym(u.ux, u.uy);
                }
            }
            if (trap)
                You(_("%s onto the teleportation trap."), u_locomotion(_("jump")));
        } else
            trap = null;
    }
    if (!trap && !break_the_rules) {
        let castit = FALSE;
        let energy = 0;

        if (!Teleportation() || (u.ulevel < (Role_if(PM_WIZARD) ? 8 : 12)
                               && !can_teleport(gy.youmonst.data))) {
            /* Try to use teleport away spell. */
            let knownsp = known_spell(SPE_TELEPORT_AWAY);

            /* casting isn't inhibited by being Stunned (...it ought to be) */
            castit = +(knownsp >= spe_Fresh && !Confusion());
            if (!castit && !break_the_rules) {
                You(_("%s."), (!Teleportation() ? ((knownsp != spe_Unknown)
                                              ? _("can't cast that spell")
                                              : _("don't know that spell"))
                            : _("are not able to teleport at will")));
                return 0;
            }
        }

        cantdoit = 0;
        /* 3.6.2: the magic numbers for hunger, strength, and energy
           have been changed to match the ones used in spelleffects().
           Also, failing these tests used to return 1 and use a move
           even though casting failure due to these reasons doesn't.
           [Note: this spellev() is different from the one in spell.c
           but they both yield the same result.] */

        energy = 5 * spellev(SPE_TELEPORT_AWAY);

        /* #if 0: not in this build */

        if (u.uhunger <= 10) {
            cantdoit = _("are too weak from hunger");
        } else if (ACURR(A_STR) < 4) {
            cantdoit = _("lack the strength");
        } else if (energy > u.uen) {
            cantdoit = _("lack the energy");
        }
        if (cantdoit) {
            You(_("%s %s."), cantdoit,
                castit ? _("for a teleport spell") : _("to teleport"));
            return 0;
        } else if (check_capacity(
                       _("Your concentration falters from carrying so much."))) {
            return 1; /* this failure in spelleffects() also uses the move */
        }

        if (castit) {
            /* energy cost is deducted in spelleffects() */
            exercise(A_WIS, TRUE);
            if ((spelleffects(SPE_TELEPORT_AWAY, TRUE, FALSE) & ECMD_TIME))
                return 1;
            else if (!break_the_rules)
                return 0;
        } else {
            /* bypassing spelleffects(); apply energy cost directly */
            u.uen -= energy;
            disp.botl = TRUE;
        }
    }

    if (next_to_u()) {
        if (trap && trap_once) {
            vault_tele();
        } else if (trap && isok(trap.launch.x, trap.launch.y)) {
            teleds(trap.launch.x, trap.launch.y, TELEDS_TELEPORT);
        } else {
            iflags.travelcc.x = iflags.travelcc.y = 0;
            tele();
        }
        next_to_u();
    } else {
        You(_("%s"), shudder_for_moment());
        return 0;
    }
    if (!trap)
        morehungry(100);
    return 1;
}
export function spellev(spell_otyp) { return (objects[spell_otyp].oc_oc2); }

export function level_tele() { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var get_there_from = init_string(static_array("level_tele.get_there_from", char, sizeof_string("get there from %s.")), _("get there from %s."), true), newlevel = stack_struct(struct_d_level), buf = stack_array(char, BUFSZ), qbuf = stack_array(char, BUFSZ), destlev = stack_var(schar), destdnum = stack_var(xint16), lsav = stack_struct(struct_d_level);

    var newlev;

    var escape_by_flying = 0; /* when surviving dest of -N */

    var force_dest = FALSE;

    if (iflags.debug_fuzzer) {
        do {
            newlevel.dnum = rn2(svn.n_dgns);
        } while (newlevel.dnum == astral_level().dnum
                 || svd.dungeons[newlevel.dnum].flags.unconnected
                 || !svd.dungeons[newlevel.dnum].num_dunlevs);
        newlevel.dlevel = 1 + rn2(dunlevs_in_dungeon(newlevel));
        assign_level(u.ucamefrom, u.uz);
        schedule_goto(newlevel, UTOTYPE_NONE, 0, 0);
        return;
    }
    if ((u.uhave.amulet || In_endgame(u.uz) || In_sokoban(u.uz))
        && !wizard()) {
        You_feel(_("very disoriented for a moment."));
        return;
    }
    $goto_random_levtport: for (;;) { switch ($goto) { default: case "random_levtport": if (!$goto && ((Teleport_control() && !Stunned()) || wizard())) {
        var trycnt = 0;

        strcpy(qbuf, _("To what level do you want to teleport?"));
        do {
            $goto_levTport_menu: for (;;) { switch ($goto) { default: if (iflags.menu_requested) {
                /* wizard mode 'm ^V' skips prompting on first pass
                   (note: level Tport via menu won't have any second pass) */
                iflags.menu_requested = FALSE;
                if (wizard())
                    { $goto = "levTport_menu"; continue $goto_levTport_menu; };
            }
            if (++trycnt == 2) {
                if (wizard())
                    strcat(qbuf, _(" [type a number, name, or ? for a menu]"));
                else
                    strcat(qbuf, _(" [type a number or name]"));
            }
            chars[buf] = ord('\0'); /* EDIT_GETLIN: if we're on second or later pass,
                            the previous input was invalid so don't use it
                            as getlin()'s preloaded default answer */
            getlin(qbuf, buf);
            if (!strcmp(buf, _("*"))) {
                { $goto = "random_levtport"; continue $goto_random_levtport; }
            } else if (Confusion() && rnl(5)) {
                pline(_("Oops..."));
                { $goto = "random_levtport"; continue $goto_random_levtport; }
            } else if (!strcmp(buf, _("\x1b"))) { /* cancelled */
                return;
            }
            case "levTport_menu": if ($goto || (wizard() && !strcmp(buf, _("?")))) {
                switch ($goto) { default:

 case "levTport_menu": $goto = null;
                destlev[0] = 0; }
                destdnum[0] = 0;
                newlev = print_dungeon(TRUE, addr_of(destlev), destdnum);
                if (!newlev)
                    return;

                newlevel.dnum = destdnum[0];
                newlevel.dlevel = destlev[0];
                if (In_endgame(newlevel) && !In_endgame(u.uz)) {
                    var amu;

                    if (!u.uhave.amulet
                        && (amu = mksobj(AMULET_OF_YENDOR, TRUE, FALSE))
                               != null) {
                        /* ordinarily we'd use hold_another_object()
                           for something like this, but we don't want
                           fumbling or already full pack to interfere */
                        amu = addinv(amu);
                        prinv(_("Endgame prerequisite:"), amu, 0);
                    }
                }
                force_dest = TRUE;
            } else if ((newlev = lev_by_name(buf)) == 0)
                newlev = atoi(buf); } break; }
        } while (!newlev && !digit(chars[buf + 0])
                 && (chars[buf + 0] != ord('-') || !digit(chars[buf + 1])) && trycnt < 10);

        /* no dungeon escape via this route */
        if (newlev == 0) {
            if (trycnt >= 10)
                { $goto = "random_levtport"; continue $goto_random_levtport; };
            if (ynq(_("Go to Nowhere.  Are you sure?")) != ord('y'))
                return;
            You(_("%s in agony as your body begins to warp..."),
                is_silent(gy.youmonst.data) ? _("writhe") : _("scream"));
            display_nhwindow()(WIN_MESSAGE, FALSE);
            You(_("cease to exist."));
            if (gi.invent)
                Your(_("possessions land on the %s with a thud."),
                     surface(u.ux, u.uy));
            svk.killer.format = NO_KILLER_PREFIX;
            strcpy(svk.killer.name, _("committed suicide"));
            done(DIED);
            pline(_("An energized cloud of dust begins to coalesce."));
            Your(_("body rematerializes%s."),
                 gi.invent ? _(", and you gather up all your possessions") : _(""));
            return;
        }

        /* if in Knox and the requested level > 0, stay put.
         * we let negative values requests fall into the "heaven" loop.
         */
        if (single_level_branch(u.uz) && newlev > 0 && !force_dest) {
            You1(shudder_for_moment());
            return;
        }
        /* if in Quest, the player sees "Home 1", etc., on the status
         * line, instead of the logical depth of the level.  controlled
         * level teleport request is likely to be relativized to the
         * status line, and consequently it should be incremented to
         * the value of the logical depth of the target level.
         *
         * we let negative values requests fall into the "heaven" handling.
         */
        if (In_quest(u.uz) && newlev > 0)
            newlev = newlev + svd.dungeons[u.uz.dnum].depth_start - 1;
    } else { /* involuntary level tele */
 $goto = null;
        newlev = random_teleport_level();
        if (newlev == depth(u.uz)) {
            You1(shudder_for_moment());
            return;
        }
    }

    if (u.utrap && u.utraptype == TT_BURIEDBALL)
        buried_ball_to_punishment();

    if (!next_to_u() && !force_dest) {
        You1(shudder_for_moment());
        return;
    }
    if (In_endgame(u.uz)) { /* must already be wizard */
        var llimit = dunlevs_in_dungeon(u.uz);

        if (newlev >= 0 || newlev <= -llimit) {
            You_cant(get_there_from, _("here"));
            return;
        }
        newlevel.dnum = u.uz.dnum;
        newlevel.dlevel = llimit + newlev;
        schedule_goto(newlevel, UTOTYPE_NONE, 0, 0);
        return;
    }

    chars[svk.killer.name + 0] = 0; /* still alive, so far... */

    if (iflags.debug_fuzzer && newlev < 0)
        { $goto = "random_levtport"; continue $goto_random_levtport; }; } break; }
    if (newlev < 0 && !force_dest) {
        if (chars[u.ushops0]) {
            /* take unpaid inventory items off of shop bills */
            gi.in_mklev = TRUE; /* suppress map update */
            u_left_shop(u.ushops0, TRUE);
            /* you're now effectively out of the shop */
            chars[u.ushops0] = chars[u.ushops] = ord('\0');
            gi.in_mklev = FALSE;
        }
        if (newlev <= -10) {
            You(_("arrive in heaven."));
                  ;
            verbalize(_("Thou art early, but we'll admit thee."));
            svk.killer.format = NO_KILLER_PREFIX;
            strcpy(svk.killer.name, _("went to heaven prematurely"));
        } else if (newlev == -9) {
            You_feel(_("deliriously happy."));
            pline(_("(In fact, you're on Cloud 9!)"));
            display_nhwindow()(WIN_MESSAGE, FALSE);
        } else
            You(_("are now high above the clouds..."));

        if (chars[svk.killer.name + 0]) {
            ; /* arrival in heaven is pending */
        } else if (Levitation()) {
            escape_by_flying = _("float gently down to earth");
        } else if (Flying()) {
            escape_by_flying = _("fly down to the ground");
        } else {
            pline(_("Unfortunately, you don't know how to fly."));
            You(_("plummet a few thousand feet to your death."));
            sprintf(svk.killer.name, _("teleported out of the dungeon and fell to %s death"), uhis())

;
            svk.killer.format = NO_KILLER_PREFIX;
        }
    }

    if (chars[svk.killer.name + 0]) { /* the chosen destination was not survivable */
        /* set specific death location; this also suppresses bones */
        struct_assign(lsav, u.uz);   /* save current level; see below */
        u.uz.dnum = 0; /* main dungeon */
        u.uz.dlevel = (newlev <= -10) ? -10 : 0; /* heaven or surface */
        done(DIED);
        /* can only get here via life-saving (or declining to die in
           explore|debug mode); the hero has now left the dungeon... */
        escape_by_flying = _("find yourself back on the surface");
        struct_assign(u.uz, lsav); /* restore u.uz so escape code works */
    }

    /* calls done(ESCAPED) if newlevel==0 */
    if (escape_by_flying) {
        You(_("%s."), escape_by_flying);
        /* [dlevel used to be set to 1, but it doesn't make sense to
            teleport out of the dungeon and float or fly down to the
            surface but then actually arrive back inside the dungeon] */
        newlevel.dnum = 0;   /* specify main dungeon */
        newlevel.dlevel = 0; /* escape the dungeon */
    } else if (force_dest) {
        /* wizard mode menu; no further validation needed */
        ;
    } else if (u.uz.dnum == medusa_level().dnum
               && newlev >= svd.dungeons[u.uz.dnum].depth_start
                                + dunlevs_in_dungeon(u.uz)) {
        find_hell(newlevel);
    } else {
        /* FIXME: we should avoid using hard-coded knowledge of
           which branches don't connect to anything deeper;
           mainly used to distinguish "can't get there from here"
           vs "from anywhere" rather than to control destination */
        var qbranch = In_quest(u.uz) ? svd.dungeon_topology.d_qstart_level
                          : In_mines(u.uz) ? svd.dungeon_topology.d_mineend_level
                            : svd.dungeon_topology.d_sanctum_level;
        var deepest = svd.dungeons[qbranch.dnum].depth_start
                      + dunlevs_in_dungeon(qbranch) - 1;

        /* if invocation did not yet occur, teleporting into
         * the last level of Gehennom is forbidden.
         */
        if (!wizard() && Inhell() && !u.uevent.invoked && newlev >= deepest) {
            newlev = deepest - 1;
            pline(_("Sorry..."));
        }
        /* no teleporting out of quest dungeon */
        if (In_quest(u.uz) && newlev < depth(svd.dungeon_topology.d_qstart_level))
            newlev = depth(svd.dungeon_topology.d_qstart_level);
        /* the player thinks of levels purely in logical terms, so
         * we must translate newlev to a number relative to the
         * current dungeon.
         */
        get_level(newlevel, newlev);

        if (on_level(newlevel, u.uz) && newlev != depth(u.uz)) {
            You_cant(get_there_from,
                     (newlev > deepest) ? _("anywhere") : _("here"));
            return;
        }
    }

    schedule_goto(newlevel, UTOTYPE_NONE, 0,
                  flags.verbose ? _("You materialize on a different level!")
                                : 0);
    /* #if 0: not in this build */
    } finally { stack_pop($frame); }
}

export function domagicportal(ttmp) { /* void */
    const $frame = stack_frame(); try {
    let target_level = stack_struct(struct_d_level);
    let totype;
    let stunmsg = 0;

    if (u.utrap && u.utraptype == TT_BURIEDBALL)
        buried_ball_to_punishment();

    if (!next_to_u()) {
        You1(shudder_for_moment());
        return;
    }

    /* if landed from another portal, do nothing */
    /* problem: level teleport landing escapes the check */
    if (!on_level(u.uz, u.uz0))
        return;

    You(_("activated a magic portal!"));

    /* prevent the poor shnook, whose amulet was stolen while in
     * the endgame, from accidently triggering the portal to the
     * next level, and thus losing the game
     */
    if (In_endgame(u.uz) && !u.uhave.amulet) {
        You_feel(_("dizzy for a moment, but nothing happens..."));
        return;
    }

    struct_assign(target_level, ttmp.dst);

    /* coming back from tutorial doesn't trigger stunning */
    if (In_tutorial(u.uz) && !In_tutorial(target_level)) {
        /* returning to normal play => arrive on level 1 stairs */
        totype = UTOTYPE_ATSTAIRS;
        stunmsg = _("Resuming regular play.");
    } else {
        totype = UTOTYPE_PORTAL;
        stunmsg = !Stunned() ? _("You feel slightly dizzy.")
                            : _("You feel dizzier.");
        make_stunned((HStun() & TIMEOUT) + 3, FALSE);
    }

    schedule_goto(target_level, totype, stunmsg, 0);
    } finally { stack_pop($frame); }
}

export function tele_trap(trap) { /* void */
    const $frame = stack_frame(); try {
    /* a fixed-destination teleport trap could theoretically place hero onto a
     * second teleport trap; prevent the recursive call from spoteffects() from
     * triggering the trap at the destination */
    let in_tele_trap = static_var("tele_trap.in_tele_trap", schar, FALSE);
    if (in_tele_trap[0])
        return;

    in_tele_trap[0] = TRUE;
    if (In_endgame(u.uz) || Antimagic() || noteleport_level(gy.youmonst)) {
        if (Antimagic())
            shieldeff(u.ux, u.uy);
        You_feel(_("a wrenching sensation."));
    } else if (!next_to_u()) {
        You1(shudder_for_moment());
    } else if (trap.once) {
        deltrap(trap);
        newsym(u.ux, u.uy); /* get rid of trap symbol */
        vault_tele();
    } else if (isok(trap.launch.x, trap.launch.y)) {
        let cc = stack_struct(struct_nhcoord);
        let mtmp = m_at(trap.launch.x, trap.launch.y);

        settrack();
        if (mtmp) {
            if (!enexto(cc, mtmp.mx, mtmp.my, mtmp.data)) {
                /* could not find some other place to put mtmp; the level must
                 * be nearly or completely full */
                You1(shudder_for_moment());
            }
            else {
                rloc_to(mtmp, cc.x, cc.y);
                mtmp = null; /* no longer a monster at dest */
            }
        }
        if (!mtmp) {
            teleds(trap.launch.x, trap.launch.y, TELEDS_TELEPORT);
        }
    } else
        tele();

    in_tele_trap[0] = FALSE;
    } finally { stack_pop($frame); }
}

export function level_tele_trap(trap, trflags) { /* void */
    const $frame = stack_frame(); try {
    let verbbuf = stack_array(char, BUFSZ);
    let intentional = FALSE;

    if ((trflags & (VIASITTING | FORCETRAP)) != 0) {
        strcpy(verbbuf, _("trigger")); /* follows "You sit down." */
        intentional = TRUE;
    } else
        sprintf(verbbuf, _("%s onto"), u_locomotion(_("step")));
    You(_("%s a level teleport trap!"), verbbuf);

    if (Antimagic() && !intentional) {
        shieldeff(u.ux, u.uy);
    }
    if ((Antimagic() && !intentional) || In_endgame(u.uz)) {
        You_feel(_("a wrenching sensation."));
        return;
    }
    deltrap(trap);
    newsym(u.ux, u.uy); /* get rid of trap symbol */
    level_tele();

    if (Hallucination() || Teleport_control())
        You(_("briefly feel %s."), Hallucination() ? _("oriented") : _("centered"));
    else
        You_feel(_("%sdisoriented."), Confusion() ? _("even more ") : _(""));
    /* magic portal traversal causes brief Stun; for level teleport, use
       confusion instead, and only when hero lacks control; do this after
       processing the level teleportation attempt because being confused
       can affect the outcome ("Oops" result) */
    if (!Teleport_control())
        make_confused((HConfusion() & TIMEOUT) + 3, FALSE);
    } finally { stack_pop($frame); }
}

/* check whether monster can arrive at location <x,y> via Tport (or fall) */
function rloc_pos_ok(
    x, y,
    mtmp) { /* boolean */
    let xx, yy;

    if (!goodpos(x, y, mtmp, GP_CHECKSCARY))
        return FALSE;
    /*
     * Check for restricted areas present in some special levels.
     *
     * `xx' is current column; if 0, then `yy' will contain flag bits
     * rather than row:  bit #0 set => moving upwards; bit #1 set =>
     * inside the Wizard's tower.
     */
    xx = mtmp.mx;
    yy = mtmp.my;
    if (!xx) {
        /* no current location (migrating monster arrival) */
        if (svd.dndest.nlx && On_W_tower_level(u.uz))
            return (+((yy & 2) != 0)
                    /* inside xor not within */
                    ^ +!within_bounded_area(x, y,
                                           svd.dndest.nlx, svd.dndest.nly,
                                           svd.dndest.nhx, svd.dndest.nhy));
        if (svu.updest.lx && (yy & 1) != 0) /* moving up */
            return +(within_bounded_area(x, y,
                                        svu.updest.lx, svu.updest.ly,
                                        svu.updest.hx, svu.updest.hy)
                    && (!svu.updest.nlx
                        || !within_bounded_area(x, y,
                                            svu.updest.nlx, svu.updest.nly,
                                            svu.updest.nhx, svu.updest.nhy)));
        if (svd.dndest.lx && (yy & 1) == 0) /* moving down */
            return +(within_bounded_area(x, y,
                                        svd.dndest.lx, svd.dndest.ly,
                                        svd.dndest.hx, svd.dndest.hy)
                    && (!svd.dndest.nlx
                        || !within_bounded_area(x, y,
                                            svd.dndest.nlx, svd.dndest.nly,
                                            svd.dndest.nhx, svd.dndest.nhy)));
    } else {
        /* [try to] prevent a shopkeeper or temple priest from being
           sent out of his room (caller might resort to goodpos() if
           we report failure here, so this isn't full prevention) */
        if (mtmp.isshk && inhishop(mtmp)) {
            if (levl()[x][y].roomno != uchar((ESHK(mtmp).shoproom)))
                return FALSE;
        } else if (mtmp.ispriest && inhistemple(mtmp)) {
            if (levl()[x][y].roomno !=  uchar((EPRI(mtmp).shroom)))
                return FALSE;
        }
        /* current location is <xx,yy> */
        if (!tele_jump_ok(xx, yy, x, y))
            return FALSE;
    }
    /* <x,y> is ok */
    return TRUE;
}

/*
 * rloc_to()
 *
 * Pulls a monster from its current position and places a monster at
 * a new x and y.  If oldx is 0, then the monster was not in the
 * levels.monsters array.  However, if oldx is 0, oldy may still have
 * a value because mtmp is a migrating_mon.  Worm tails are always
 * placed randomly around the head of the worm.
 */
function rloc_to_core(
    mtmp,
    x, y,
    rlocflags) { /* void */
    let oldx = mtmp.mx, oldy = mtmp.my;
    let resident_shk = (mtmp.isshk && inhishop(mtmp) ? 1 : 0);
    let preventmsg = +((rlocflags & RLOC_NOMSG) != 0);
    let vanishmsg = +((rlocflags & RLOC_MSG) != 0);
    let appearmsg = +((mtmp.mstrategy & STRAT_APPEARMSG) != 0);
    let domsg = (!gi.in_mklev && (vanishmsg || appearmsg) && !preventmsg ? 1 : 0);
    let telemsg = FALSE;

    if (x == mtmp.mx && y == mtmp.my && m_at(x, y) == mtmp)
        return; /* that was easy */

    if (oldx) { /* "pick up" monster */
        if (domsg && canspotmon(mtmp)) {
            if (couldsee(x, y) || sensemon(mtmp)) {
                telemsg = TRUE;
            } else {
                pline(_("%s vanishes!"), Monnam(mtmp));
            }
            /* avoid "It suddenly appears!" for a STRAT_APPEARMSG monster
               that has just teleported away if we won't see it after this
               vanishing (the regular appears message will be given if we
               do see it) */
            appearmsg = FALSE;
        }

        if (mtmp.wormno) {
            remove_worm(mtmp);
        } else {
            remove_monster(oldx, oldy);
            newsym(oldx, oldy); /* update old location */
        }
    }

    mon_track_clear(mtmp);
    place_monster(mtmp, x, y); /* put monster down */
    update_monster_region(mtmp);

    if (mtmp.wormno) /* now put down tail */
        place_worm_tail_randomly(mtmp, x, y);

    if (u.ustuck == mtmp) {
        if (u.uswallow) {
            u_on_newpos(mtmp.mx, mtmp.my);
            check_special_room(FALSE);
            docrt();
        } else if (!m_next2u(mtmp)) {
           unstuck(mtmp);
        }
    }

    maybe_unhide_at(x, y);
    newsym(x, y);      /* update new location */
    set_apparxy(mtmp); /* orient monster */
    if (domsg && (canspotmon(mtmp) || appearmsg || mtmp == u.ustuck)) {
        let du = distu(x, y), olddu;
        let next = (du <= 2) ? _(" next to you") : 0,
                   nearu = (du <= BOLT_LIM * BOLT_LIM) ? _(" close by") : 0;

        set_msg_xy(x, y);
        mtmp.mstrategy = and64u(mtmp.mstrategy, not64u(STRAT_APPEARMSG)); /* one chance only */
        if (mtmp == u.ustuck && !u_at(u.ux0, u.uy0)) {
            You(_("and %s teleport together."), mon_nam(mtmp));
        } else if (telemsg && (couldsee(x, y) || sensemon(mtmp))) {
            pline(_("%s vanishes and reappears%s."),
                  Monnam(mtmp),
                  next ? next
                  : nearu ? nearu
                    : ((olddu = distu(oldx, oldy)) == du) ? _("")
                      : (du < olddu) ? _(" closer to you")
                        : _(" farther away"));
        } else {
            pline(_("%s %s%s%s!"),
                  appearmsg ? Amonnam(mtmp) : Monnam(mtmp),
                  appearmsg ? _("suddenly ") : _(""),
                  !Blind() ? _("appears") : _("arrives"),
                  next ? next : nearu ? nearu : _(""));
        }
        /* wand discovery only happens if a messaage is delivered (bug?);
           if spell or q.mechanic attack or artifact #invoke for banish
           then current_wand will be Null */
        if (gc.current_wand && gc.current_wand.otyp == WAN_TELEPORTATION)
            makeknown(WAN_TELEPORTATION);
    }

    /* shopkeepers will only teleport if you zap them with a wand of
       teleportation or if they've been transformed into a jumpy monster;
       the latter only happens if you've attacked them with polymorph
       [FIXME? or they've been hit by a genetic engineer, which won't
       necessarily be due to Conflict by hero] */
    if (resident_shk && !inhishop(mtmp))
        make_angry_shk(mtmp, oldx, oldy);

    /* if a monster carrying shop goods teleports out of the shop, blame
       it on the hero; chance of an unpaid item is vanishingly small, but
       no_charge is easily possible and needs to be cleared if not in shop;
       a for-sale item is ordinary here--shk won't notice it leaving; if
       mtmp teleports from one shop into another, no_charge status sticks
       and an item on the first shk's bill stays there */
    if (mtmp.minvent && !costly_spot(x, y)) {
        let otmp;
        let shkp = find_objowner(mtmp.minvent, oldx, oldy);
        let peaceful = (!shkp || shkp.mpeaceful ? 1 : 0);

        for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj) {
            if (otmp.no_charge)
                otmp.no_charge = 0;
            else if (shkp && onshopbill(otmp, shkp, TRUE))
                stolen_value(otmp, oldx, oldy, peaceful, FALSE);
        }
    }

    /* if hero is busy, maybe stop occupation */
    if (go.occupation)
        dochugw(mtmp, FALSE);

    /* trapped monster teleported away */
    if (mtmp.mtrapped && !mtmp.wormno)
        mintrap(mtmp, NO_TRAP_FLAGS);
}

export function rloc_to(mtmp, x, y) { /* void */
    rloc_to_core(mtmp, x, y, RLOC_NOMSG);
}

export function rloc_to_flag(
    mtmp,
    x, y,
    rlocflags) { /* void */
    rloc_to_core(mtmp, x, y, rlocflags);
}

function stairway_find_forwiz(isladder, up) { /* stairway * */
    let stway = gs.stairs;

    while (stway && !(stway.isladder == isladder
                      && stway.up == up && stway.tolev.dnum == u.uz.dnum))
        stway = stway.next;
    return stway;
}

/* place a monster at a random location, typically due to teleport;
   return TRUE if successful, FALSE if not; rlocflags is RLOC_foo flags */
export function rloc(
    mtmp,
    rlocflags) { /* boolean */
    const $frame = stack_frame(); try {
    var cc = stack_struct(struct_nhcoord), backupcc = stack_struct(struct_nhcoord), candy = stack_array(struct_nhcoord, ROWNO * (COLNO - 1)); /* room for entire map */
    var cc_flags;
    var x, y;
    var trycount, i, j, candycount;

    if (mtmp == u.usteed) {
        tele();
        return TRUE;
    }

    found_xy: { if (mtmp.iswiz && mtmp.mx) { /* Wizard, not just arriving */
        var stway;

        if (!In_W_tower(u.ux, u.uy, u.uz)) {
            stway = stairway_find_forwiz(FALSE, TRUE);
        } else if (!stairway_find_forwiz(TRUE, FALSE)) { /* bottom of tower */
            stway = stairway_find_forwiz(TRUE, TRUE);
        } else {
            stway = stairway_find_forwiz(TRUE, FALSE);
        }

        x = stway ? stway.sx : 0;
        y = stway ? stway.sy : 0;

        /* if the wiz teleports away to heal, try the up staircase,
           to block the player's escaping before he's healed
           (deliberately use `goodpos' rather than `rloc_pos_ok' here) */
        if (goodpos(x, y, mtmp, NO_MM_FLAGS))
            break found_xy;;
    }

    /* wizard-mode player can choose destination by setting 'montelecontrol'
       option; ignored if/when this is arrival of a migrating monster */
    if (iflags.mon_telecontrol && mtmp.mx) {
        cc.x = mtmp.mx, cc.y = mtmp.my;
        if (control_mon_tele(mtmp, cc, rlocflags, TRUE)) {
            x = cc.x, y = cc.y;
            break found_xy;
        }
    }

    /* this used to try randomly 1000 times, then fallback to left-to-right
       top-to-bottom exhaustive check; now that the exhaustive check uses
       randomized order, reduce the number of random attempts to 50;
       on levels with lots of available space, random can find a spot more
       quickly but might fail to find one no matter how many tries it makes */
    for (trycount = 0; trycount < 50; ++trycount) {
        x = rnd(COLNO - 1); /* 1..COLNO-1 */
        y = rn2(ROWNO); /* 0..ROWNO-1 */
        if (rloc_pos_ok(x, y, mtmp)) /* rejects 'onscary' */
            break found_xy;;
    }

    /* try harder to find a good place; gather a list of all candidate
       locations (every accessible unoccupied spot except for hero's;
       goodpos() will reject that), then shuffle them ourselves instead
       of having collect_coords() do it (which would be in rings centered
       around arbitrary <COLNO/2,ROWNO/2>) */
    cc_flags = CC_INCL_CENTER | CC_UNSHUFFLED | CC_SKIP_MONS;
    if (!passes_walls(mtmp.data))
        cc_flags = unsigned(cc_flags | CC_SKIP_INACCS);
    candycount = collect_coords(candy[0], Math.trunc(COLNO / 2), Math.trunc(ROWNO / 2), 0, cc_flags,
                                null);
    backupcc.x = backupcc.y = 0;
    for (i = 0; i < candycount; ++i) {
        if ((j = rn2(candycount - i)) > 0) {
            struct_assign(cc, candy[i]);
            struct_assign(candy[i], candy[i + j]);
            struct_assign(candy[i + j], cc);
        }
        x = candy[i].x, y = candy[i].y;
        if (rloc_pos_ok(x, y, mtmp))
            break found_xy;;
        if (!backupcc.x && goodpos(x, y, mtmp, NO_MM_FLAGS))
            backupcc.x = x, backupcc.y = y;
    }

    /* we didn't find any spot acceptable to rloc_pos_ok() which avoids
       'onscary' and honors teleport regions, but if we did find a spot
       that was acceptable to goodpos() (which ignores 'onscary' and
       teleport regions) we'll use that; otherwise give up */
    if (!backupcc.x) {
        /* level either full of monsters or somehow faulty */
        if ((rlocflags & RLOC_ERR) != 0)
            impossible(_("rloc(): couldn't relocate monster"));
        return FALSE;
    }
    x = backupcc.x, y = backupcc.y;
    /*goto found_xy;*/
 }
    rloc_to_core(mtmp, x, y, rlocflags);
    return TRUE;
    } finally { stack_pop($frame); }
}

/* let wizard-mode player choose a teleporting monster's destination */
export function control_mon_tele(
    mon,
    cc_p,
    rlocflags,
    via_rloc) { /* boolean */
    const $frame = stack_frame(); try {
    let tcbuf = stack_array(char, BUFSZ);

    if (!isok(cc_p.x, cc_p.y)) {
        cc_p.x = mon.mx, cc_p.y = mon.my;
        if (!isok(cc_p.x, cc_p.y))
            cc_p.x = u.ux, cc_p.y = u.uy;
    }

    if (!wizard() || !iflags.mon_telecontrol)
        return FALSE;

    pline(_("Teleport %s @ <%d,%d> where?"),
          noit_mon_nam(mon), mon.mx, mon.my);
    /* getpos '?' will show "Move the cursor to <where to teleport Foo>:" */
    sprintf(tcbuf, _("where to teleport %s"), noit_mon_nam(mon));
    if (getpos(cc_p, FALSE, tcbuf) >= 0 && !(((cc_p.x) == u.ux) && ((cc_p.y) == u.uy))) {
        if (via_rloc
              ? rloc_pos_ok(cc_p.x, cc_p.y, mon)
              : goodpos(cc_p.x, cc_p.y, mon, rlocflags))
            return TRUE;
        if (!iflags.debug_fuzzer) {
            sprintf(tcbuf, _("<%d,%d> is not considered viable; force anyway?"), mon.mx, mon.my)
;
            if (y_n(tcbuf) == ord('y'))
                return TRUE;
        }
    }
    pline(_("%s destination."), via_rloc ? _("Picking random") : _("Using derived"));
    return FALSE;
    } finally { stack_pop($frame); }
}

function mvault_tele(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let croom = search_special(VAULT);
    let c = stack_struct(struct_nhcoord);

    if (croom && somexyspace(croom, c) && goodpos(c.x, c.y, mtmp, 0)) {
        rloc_to(mtmp, c.x, c.y);
        return;
    }
    rloc(mtmp, RLOC_NONE);
    } finally { stack_pop($frame); }
}

export function tele_restrict(mon) { /* boolean */
    if (noteleport_level(mon)) {
        if (canseemon(mon))
            pline(_("A mysterious force prevents %s from teleporting!"),
                  mon_nam(mon));
        return TRUE;
    }
    return FALSE;
}

export function mtele_trap(mtmp, trap, in_sight) { /* void */
    let monname;

    /* don't print feedback here: a monster stepping on a trap and not
       teleporting from it isn't visible */
    if (noteleport_level(mtmp))
        return;

    if (teleport_pet(mtmp, FALSE)) {
        /* save name with pre-movement visibility */
        monname = Monnam(mtmp);

        /* Note: don't remove the trap if a vault.  Other-
         * wise the monster will be stuck there, since
         * the guard isn't going to come for it...
         */
        if (trap.once)
            mvault_tele(mtmp);
        else if (isok(trap.launch.x, trap.launch.y)) {
            /* monster teleporting onto hero's or another monster's spot does
             * not work the same as hero teleporting onto monster's spot where
             * the incoming monster displaces the resident to the nearest
             * possible space - instead it just doesn't work. */
            if (!(m_at(trap.launch.x, trap.launch.y)
                  || (((trap.launch.x) == u.ux) && ((trap.launch.y) == u.uy)))) {
                rloc_to_core(mtmp, trap.launch.x, trap.launch.y,
                             RLOC_MSG);
            }
        } else
            rloc(mtmp, RLOC_NONE);

        if (in_sight) {
            if (canseemon(mtmp))
                pline(_("%s seems disoriented."), monname);
            else
                pline(_("%s suddenly disappears!"), monname);
            seetrap(trap);
        }
    }
}

/* return Trap_Effect_Finished if still on level, Trap_Moved_Mon if not */
export function mlevel_tele_trap(
    mtmp,
    trap,
    force_it,
    in_sight) { /* int */
    const $frame = stack_frame(); try {
    let tt = (trap ? trap.ttyp : NO_TRAP);

    if (mtmp == u.ustuck) /* probably a vortex */
        return Trap_Effect_Finished; /* temporary? kludge */
    if (teleport_pet(mtmp, force_it)) {
        let tolevel = stack_struct(struct_d_level);
        let migrate_typ = MIGR_RANDOM;

        if (is_hole(tt)) {
            if (Is_stronghold(u.uz)) {
                assign_level(tolevel, svd.dungeon_topology.d_valley_level);
            } else if (Is_botlevel(u.uz)) {
                if (in_sight && trap.tseen)
                    pline_mon(mtmp, _("%s avoids the %s."),
                              Monnam(mtmp),
                             (tt == HOLE) ? _("hole") : _("trap"));
                return Trap_Effect_Finished;
            } else {
                assign_level(tolevel, trap.dst);
                clamp_hole_destination(tolevel);
            }
        } else if (tt == MAGIC_PORTAL) {
            if (In_endgame(u.uz) && (mon_has_amulet(mtmp)
                                      || is_home_elemental(mtmp.data)
                                      || rn2(7))) {
                if (in_sight && mtmp.data.mlet != S_ELEMENTAL) {
                    pline_mon(mtmp,
                              _("%s seems to shimmer for a moment."),
                              Monnam(mtmp));
                    seetrap(trap);
                }
                return Trap_Effect_Finished;
            } else {
                assign_level(tolevel, trap.dst);
                migrate_typ = MIGR_PORTAL;
            }
        } else if (tt == LEVEL_TELEP || tt == NO_TRAP) {
            let nlev;

            if (mon_has_amulet(mtmp) || In_endgame(u.uz)
                /* NO_TRAP is used when forcing a monster off the level;
                   onscary(0,0,) is true for the Wizard, Riders, lawful
                   minions, Angels of any alignment, shopkeeper or priest
                   currently inside his or her own special room */
                || (tt == NO_TRAP && onscary(0, 0, mtmp))) {
                if (in_sight)
                    pline_mon(mtmp,
                             _("%s seems very disoriented for a moment."),
                             Monnam(mtmp));
                return Trap_Effect_Finished;
            }
            if (tt == NO_TRAP) {
                /* creature is being forced off the level to make room;
                   it will try to return to this level (at a random spot
                   rather than its current one) if the level is left by
                   the hero and then revisited */
                assign_level(tolevel, u.uz);
            } else {
                nlev = random_teleport_level();
                if (nlev == depth(u.uz)) {
                    if (in_sight)
                        pline_mon(mtmp, _("%s shudders for a moment."),
                                  Monnam(mtmp));
                    return Trap_Effect_Finished;
                }
                get_level(tolevel, nlev);
            }
        } else {
            impossible(_("mlevel_tele_trap: unexpected trap type (%d)"), tt);
            return Trap_Effect_Finished;
        }

        if (in_sight) {
            pline_mon(mtmp, _("Suddenly, %s %s."), mon_nam(mtmp),
                     (tt == HOLE) ? _("falls into a hole")
                   : (tt == TRAPDOOR) ? _("falls through a trap door")
                   : _("disappears out of sight"));
            if (trap)
                seetrap(trap);
        }
        if (is_xport(tt) && !control_teleport(mtmp.data))
            mtmp.mconf = 1;
        migrate_to_level(mtmp, ledger_no(tolevel), migrate_typ, null);
        return Trap_Moved_Mon; /* no longer on this level */
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

/* place object randomly, returns False if it's gone (eg broken) */
export function rloco(obj) { /* boolean */
    let tx, ty, otx, oty;
    let restricted_fall;
    let try_limit = 4000;

    if (obj.otyp == CORPSE && is_rider(mons[obj.corpsenm])) {
        if (revive_corpse(obj))
            return FALSE;
    }

    obj_extract_self(obj);
    otx = obj.ox;
    oty = obj.oy;
    restricted_fall = (otx == 0 && svd.dndest.lx ? 1 : 0);
    do {
        tx = rn1(COLNO - 3, 2);
        ty = rn2(ROWNO);
        if (!--try_limit)
            break;
    } while (!goodpos(tx, ty, null, 0)
             || (restricted_fall
                 && (!within_bounded_area(tx, ty,
                                          svd.dndest.lx, svd.dndest.ly,
                                          svd.dndest.hx, svd.dndest.hy)
                     || (svd.dndest.nlx
                         && within_bounded_area(tx, ty,
                                            svd.dndest.nlx, svd.dndest.nly,
                                            svd.dndest.nhx, svd.dndest.nhy))))
             /* on the Wizard Tower levels, objects inside should
                stay inside and objects outside should stay outside */
             || (svd.dndest.nlx && On_W_tower_level(u.uz)
                 && within_bounded_area(tx, ty,
                                        svd.dndest.nlx, svd.dndest.nly,
                                        svd.dndest.nhx, svd.dndest.nhy)
                    != within_bounded_area(otx, oty,
                                           svd.dndest.nlx, svd.dndest.nly,
                                           svd.dndest.nhx, svd.dndest.nhy)));

    if (flooreffects(obj, tx, ty, _("fall"))) {
        /* update old location (if any) since flooreffects() couldn't;
           unblock_point() for boulder handled by obj_extract_self() */
        if (!(otx == 0 && oty == 0))
            newsym(otx, oty);
        return FALSE;
    } else if (otx == 0 && oty == 0) {
        ; /* fell through a trap door; no update of old loc needed */
    } else {
        let shkp = find_objowner(obj, otx, oty);
        let objinshop = (shkp && costly_spot(otx, oty) ? 1 : 0),
                onboundary = (shkp && costly_adjacent(shkp, otx, oty) ? 1 : 0);

        /*
         * If object starts inside shop or is unpaid and on shop boundary:
         * if hero is outside the shop, treat this as theft;
         * otherwise, if it arrives inside same shop, remove it from bill;
         * otherwise, if it arrives on the boundary, add it to bill;
         * if it arrives outside the shop, treat this as a theft.
         * Billing routines deal with obj->no_charge.
         */
        if (objinshop || (obj.unpaid && onboundary)) {
            let h = chars[in_rooms(u.ux, u.uy, SHOPBASE)],
                 oo = chars[in_rooms(otx, oty, 0)];
            let hinshop = (h && strchr(in_rooms(shkp.mx, shkp.my, 0), h) ? 1 : 0);

            if (hinshop && costly_spot(tx, ty)
                /* verify that it's the same shop */
                && oo && strchr(in_rooms(tx, ty, 0), oo)) {
                if (obj.unpaid)
                    subfrombill(obj, shkp);
            } else if (hinshop && costly_adjacent(shkp, tx, ty)
                       && oo && strchr(in_rooms(tx, ty, 0), oo)) {
                if (!obj.unpaid)
                    addtobill(obj, FALSE, FALSE, FALSE);
            } else {
                stolen_value(obj, otx, oty, FALSE, FALSE);
            }
        }

        newsym(otx, oty); /* update old location */
    }
    place_object(obj, tx, ty);
    /* note: block_point() for boulder handled by place_object() */
    newsym(tx, ty);
    return TRUE;
}

/* Returns an absolute depth */
export function random_teleport_level() { /* int */
    let nlev, max_depth, min_depth, cur_depth = depth(u.uz);

    /* [the endgame case can only occur in wizard mode] */
    if (!rn2(5) || single_level_branch(u.uz) || In_endgame(u.uz))
        return cur_depth;

    /* What I really want to do is as follows:
     * -- If in a dungeon that goes down, the new level is to be restricted
     *    to [top of parent, bottom of current dungeon]
     * -- If in a dungeon that goes up, the new level is to be restricted
     *    to [top of current dungeon, bottom of parent]
     * -- If in a quest dungeon or similar dungeon entered by portals,
     *    the new level is to be restricted to [top of current dungeon,
     *    bottom of current dungeon]
     * The current behavior is not as sophisticated as that ideal, but is
     * still better what we used to do, which was like this for players
     * but different for monsters for no obvious reason.  Currently, we
     * must explicitly check for special dungeons.  We check for Knox
     * above; endgame is handled in the caller due to its different
     * message ("disoriented").
     * --KAA
     * 3.4.2: explicitly handle quest here too, to fix the problem of
     * monsters sometimes level teleporting out of it into main dungeon.
     * Also prevent monsters reaching the Sanctum prior to invocation.
     */
    if (In_quest(u.uz)) {
        let bottom = dunlevs_in_dungeon(u.uz),
            qlocate_depth = qlocate_level().dlevel;

        /* if hero hasn't reached the middle locate level yet,
           no one can randomly teleport past it */
        if (dunlev_reached(u.uz) < qlocate_depth)
            bottom = qlocate_depth;
        min_depth = svd.dungeons[u.uz.dnum].depth_start;
        max_depth = bottom + (svd.dungeons[u.uz.dnum].depth_start - 1);
    } else {
        min_depth = 1;
        max_depth = dunlevs_in_dungeon(u.uz)
                    + (svd.dungeons[u.uz.dnum].depth_start - 1);
        /* can't reach Sanctum if the invocation hasn't been performed */
        if (Inhell() && !u.uevent.invoked)
            max_depth -= 1;
    }

    /* Get a random value relative to the current dungeon */
    /* Range is 1 to current+3, current not counting */
    nlev = rn2(cur_depth + 3 - min_depth) + min_depth;
    if (nlev >= cur_depth)
        nlev++;

    if (nlev > max_depth) {
        nlev = max_depth;
        /* teleport up if already on bottom */
        if (Is_botlevel(u.uz))
            nlev -= rnd(3);
    }
    if (nlev < min_depth) {
        nlev = min_depth;
        if (nlev == cur_depth) {
            nlev += rnd(3);
            if (nlev > max_depth)
                nlev = max_depth;
        }
    }
    return nlev;
}

/* you teleport a monster (via wand, spell, or poly'd q.mechanic attack);
   return false iff the attempt fails */
export function u_teleport_mon(
    mtmp,
    give_feedback) { /* boolean */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);

    if (svl.level.flags.stasis_until >= svm.moves) {
        if (give_feedback)
            pline(_("A mysterious force prevents you teleporting %s!"),
                  mon_nam(mtmp));
        return FALSE;
    } else if (mtmp.ispriest && chars[in_rooms(mtmp.mx, mtmp.my, TEMPLE)]) {
        if (give_feedback)
            pline(_("%s resists your magic!"), Monnam(mtmp));
        return FALSE;
    } else if (engulfing_u(mtmp) && noteleport_level(mtmp)) {
        if (give_feedback)
            You(_("are no longer inside %s!"), mon_nam(mtmp));
        unstuck(mtmp);
        if (!rloc(mtmp, RLOC_MSG))
            m_into_limbo(mtmp);
    } else if ((is_rider(mtmp.data) || control_teleport(mtmp.data))
               && rn2(13) && enexto(cc, u.ux, u.uy, mtmp.data)) {
        rloc_to(mtmp, cc.x, cc.y);
    } else {
        if (!rloc(mtmp, RLOC_MSG))
            return FALSE;
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/*teleport.c*/

import { A_STR, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { shudder_for_moment } from "./decl.h.macros.js";
import { S_ANGEL, S_EEL, S_ELEMENTAL, S_HUMAN, S_MIMIC, S_VAMPIRE } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { LR_MONGEN, MIGR_PORTAL, MIGR_RANDOM, struct_d_level } from "./dungeon.h.js";
import {
    In_endgame, In_sokoban, In_tutorial, Inhell, Is_stronghold, Is_waterlevel, within_bounded_area,
} from "./dungeon.h.macros.js";
import { notice_mon_off, notice_mon_on, wizard } from "./flag.h.macros.js";
import { BUFSZ, COLNO, FALSE, ROWNO, TRUE, boolean, coordxy, xint16 } from "./global.h.js";
import {
    BOLT_LIM, CC_INCL_CENTER, CC_NO_FLAGS, CC_RING_PAIRS, CC_SKIP_INACCS, CC_SKIP_MONS,
    CC_UNSHUFFLED, DIED, ECMD_OK, ECMD_TIME, FORCETRAP, GP_ALLOW_U, GP_ALLOW_XY, GP_AVOID_MONPOS,
    GP_CHECKSCARY, MM_IGNORELAVA, MM_IGNOREWATER, NO_KILLER_PREFIX, NO_MM_FLAGS, NO_TRAP_FLAGS,
    RLOC_ERR, RLOC_MSG, RLOC_NOMSG, RLOC_NONE, SLT_ENCUMBER, TELEDS_ALLOW_DRAG, TELEDS_TELEPORT,
    VIASITTING,
} from "./hack.h.js";
import {
    You1, astral_level, distu, dunlev_reached, makeknown, max, medusa_level, min, qlocate_level,
    rn1, y_n, ynq,
} from "./hack.h.macros.js";
import { debugpline0, debugpline4, showdebug } from "./lint.h.macros.js";
import { EPRI, ESHK } from "./mextra.h.macros.js";
import { SHOPBASE, TEMPLE, VAULT } from "./mkroom.h.js";
import {
    amorphous, can_teleport, control_teleport, haseyes, is_covetous, is_dlord, is_dprince, is_rider,
    is_silent, is_swimmer, likes_lava, passes_walls, throws_rocks, unique_corpstat,
} from "./mondata.h.macros.js";
import { NEUTRAL } from "./monflag.h.js";
import { M_AP_NOTHING, STRAT_APPEARMSG, struct_monst } from "./monst.h.js";
import { DEADMONSTER, engulfing_u, mon_offmap } from "./monst.h.macros.js";
import { PM_FLOATING_EYE, PM_MINOTAUR, PM_WIZARD } from "./monsters.h.js";
import { OBJ_FREE } from "./obj.h.js";
import { carried } from "./obj.h.macros.js";
import {
    AMULET_OF_YENDOR, BOULDER, CORPSE, SCR_SCARE_MONSTER, SPE_TELEPORT_AWAY, WAN_TELEPORTATION,
} from "./objects.h.js";
import { I_SPECIAL, TELEPORT, TIMEOUT } from "./prop.h.js";
import { IS_ALTAR, MON_AT, ZAP_POS, fmon, levl, m_at, remove_monster } from "./rm.h.macros.js";
import { spe_Fresh, spe_Unknown } from "./spell.h.js";
import {
    HOLE, LEVEL_TELEP, MAGIC_PORTAL, NO_TRAP, TELEP_TRAP, TRAPDOOR, Trap_Effect_Finished,
    Trap_Moved_Mon, VIBRATING_SQUARE,
} from "./trap.h.js";
import { is_hole, is_pit, is_xport } from "./trap.h.macros.js";
import { couldsee } from "./vision.h.macros.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU,
    PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { TT_BURIEDBALL, UTOTYPE_ATSTAIRS, UTOTYPE_NONE, UTOTYPE_PORTAL } from "./you.h.js";
import { Role_if, Upolyd, m_next2u, u_at, uhis } from "./you.h.macros.js";
import {
    Amphibious, Antimagic, Blind, Blinded, Confusion, ETeleportation, Fire_resistance, Flying,
    HConfusion, HStun, HTeleportation, Hallucination, Levitation, Passes_walls, Punished, Stunned,
    Swimming, Teleport_control, Teleportation, Wwalking,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u, not64u, or64 } from "../rt/int64.js";
import { atoi, free, sprintf, strcat, strchr, strcmp, strcpy } from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_add, ptr_to, struct, struct_assign } from "../rt/struct.js";
import { get_mleash, m_unleash, next_to_u } from "./apply.js";
import { exercise } from "./attrib.js";
import { drag_ball, move_bc, placebc, unplacebc } from "./ball.js";
import { isok } from "./cmd.js";
import { is_lava, is_pool, is_waterwall } from "./dbridge.js";
import {
    cg, disp, flags, gc, gi, go, gs, gv, gy, iflags, svd, svk, svl, svm, svn, svu, u,
} from "./decl.js";
import { buried_ball_to_punishment } from "./dig.js";
import {
    canseemon, docrt, newsym, nul_glyphinfo, see_monsters, sensemon, shieldeff,
} from "./display.js";
import { flooreffects, revive_corpse, schedule_goto } from "./do.js";
import { Amonnam, Monnam, mon_nam, noit_mon_nam } from "./do_name.js";
import { migrate_to_level } from "./dog.js";
import {
    In_W_tower, In_hell, In_mines, In_quest, Is_botlevel, On_W_tower_level, assign_level, depth,
    dunlevs_in_dungeon, find_hell, get_level, ledger_no, lev_by_name, on_level, print_dungeon,
    single_level_branch, surface, u_on_newpos,
} from "./dungeon.js";
import { morehungry } from "./eat.js";
import { done } from "./end.js";
import { sengr_at } from "./engrave.js";
import { getpos } from "./getpos.js";
import {
    check_capacity, check_special_room, in_rooms, invocation_message, may_passwall, near_capacity,
    nomul, notice_all_mons, spoteffects, switch_terrain, u_locomotion,
} from "./hack.js";
import { digit, distmin, eos } from "./hacklib.js";
import { addinv, prinv, sobj_at } from "./invent.js";
import { is_home_elemental } from "./makemon.js";
import { is_exclusion_zone } from "./mkmaze.js";
import { mksobj, obj_extract_self, place_object } from "./mkobj.js";
import { search_special, somexyspace } from "./mkroom.js";
import {
    get_iter_mons, hideunder, m_in_air, m_into_limbo, maybe_unhide_at, set_ustuck, unstuck,
} from "./mon.js";
import { set_mon_data } from "./mondata.js";
import {
    accessible, closed_door, dochugw, mon_track_clear, onscary, set_apparxy,
} from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    You, You_cant, You_feel, Your, impossible, pline, pline_mon, set_msg_xy, verbalize,
} from "./pline.js";
import { make_blinded, make_confused, make_stunned } from "./potion.js";
import { inhistemple } from "./priest.js";
import { learnscroll } from "./read.js";
import { in_out_region, update_monster_region, update_player_regions } from "./region.js";
import { rn2, rnd, rnl } from "./rnd.js";
import {
    addtobill, costly_adjacent, costly_spot, find_objowner, inhishop, make_angry_shk, onshopbill,
    stolen_value, subfrombill, u_left_shop,
} from "./shk.js";
import { yelp } from "./sounds.js";
import { known_spell, spelleffects, tport_spell } from "./spell.js";
import { place_monster } from "./steed.js";
import { settrack } from "./track.js";
import {
    clamp_hole_destination, deltrap, fill_pit, mintrap, reset_utrap, seetrap, t_at, unconscious,
} from "./trap.js";
import { findgd, uleftvault, vault_occupied } from "./vault.js";
import { vision_recalc } from "./vision.js";
import { add_menu, getlin, select_menu } from "./windows.js";
import { mon_has_amulet } from "./wizard.js";
import { place_worm_tail_randomly, remove_worm } from "./worm.js";
const __FILE__ = "teleport.c";
