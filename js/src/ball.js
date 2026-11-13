/* NetHack 5.0	ball.c	$NHDT-Date: 1596498150 2020/08/03 23:42:30 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.51 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) David Cohrs, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/* Ball & Chain
 * =============================================================*/

const bcrestriction = static_var("bcrestriction", int, 0);

export function ballrelease(showmsg) { /* void */
    if (carried(uball) && !welded(uball)) {
        if (showmsg)
            pline(_("Startled, you drop the iron ball."));
        if (uwep == uball)
            setuwep(null);
        if (uswapwep == uball)
            setuswapwep(null);
        if (uquiver == uball)
            setuqwep(null);
        /* [this used to test 'if (uwep != uball)' but that always passes
           after the setuwep() above] */
        freeinv(uball); /* remove from inventory but don't place on floor */
        encumber_msg();
    }
}

/* ball&chain might hit hero when falling through a trap door */
export function ballfall() { /* void */
    let gets_hit;

    if (!uball || (uball && carried(uball) && welded(uball)))
        return;

    gets_hit = (((uball.ox != u.ux) || (uball.oy != u.uy))
                && ((uwep == uball) ? FALSE : boolean(rn2(5))) ? 1 : 0);
    ballrelease(TRUE);
    if (gets_hit) {
        let dmg = rn1(7, 25);

        pline_The(_("iron ball falls on your %s."), body_part(HEAD));
        if (uarmh) {
            if (hard_helmet(uarmh)) {
                pline(_("Fortunately, you are wearing a hard helmet."));
                dmg = 3;
            } else if (flags.verbose)
                pline(_("%s does not protect you."), Yname2(uarmh));
        }
        losehp(Maybe_Half_Phys(dmg), _("crunched in the head by an iron ball"),
               NO_KILLER_PREFIX);
    }
}

/*
 *  To make this work, we have to mess with the hero's mind.  The rules for
 *  ball&chain are:
 *
 *      1. If the hero can see them, fine.
 *      2. If the hero can't see either, it isn't seen.
 *      3. If either is felt it is seen.
 *      4. If either is felt and moved, it disappears.
 *
 *  If the hero can see, then when a move is done, the ball and chain are
 *  first picked up, the positions under them are corrected, then they
 *  are moved after the hero moves.  Not too bad.
 *
 *  If the hero is blind, then she can "feel" the ball and/or chain at any
 *  time.  However, when the hero moves, the felt ball and/or chain become
 *  unfelt and whatever was felt "under" the ball&chain appears.  Pretty
 *  nifty, but it requires that the ball&chain "remember" what was under
 *  them --- i.e. they pick-up glyphs when they are felt and drop them when
 *  moved (and felt).  When swallowed, the ball&chain are pulled completely
 *  off of the dungeon, but are still on the object chain.  They are placed
 *  under the hero when she is expelled.
 */

/*
 * from you.h
 *      int u.bglyph            glyph under the ball
 *      int u.cglyph            glyph under the chain
 *      int u.bc_felt           mask for ball/chain being felt
 *      #define BC_BALL  0x01   bit mask in u.bc_felt for ball
 *      #define BC_CHAIN 0x02   bit mask in u.bc_felt for chain
 *      int u.bc_order          ball & chain order
 *
 * u.bc_felt is also manipulated in display.c and read.c, the others only
 * in this file.  None of these variables are valid unless the player is
 * Blind.
 */

/* values for u.bc_order */
export const BCPOS_DIFFER = 0;
export const BCPOS_CHAIN = 1;
export const BCPOS_BALL = 2;

/*
 *  Place the ball & chain under the hero.  Make sure that the ball & chain
 *  variables are set (actually only needed when blind, but what the heck).
 *  It is assumed that when this is called, the ball and chain are NOT
 *  attached to the object list.
 *
 *  Should not be called while swallowed except on waterlevel.
 */
function placebc_core() { /* void */
    if (!uchain || !uball) {
        impossible(_("Where are your ball and chain?"));
        return;
    }

    flooreffects(uchain, u.ux, u.uy, _("")); /* chain might rust */

    if (carried(uball)) { /* the ball is carried */
        u.bc_order = BCPOS_DIFFER;
    } else {
        /* ball might rust -- already checked when carried */
        flooreffects(uball, u.ux, u.uy, _(""));
        place_object(uball, u.ux, u.uy);
        u.bc_order = BCPOS_CHAIN;
    }

    place_object(uchain, u.ux, u.uy);

    u.bglyph = u.cglyph = levl()[u.ux][u.uy].glyph; /* pick up glyph */

    newsym(u.ux, u.uy);
    bcrestriction[0] = 0;
}

function unplacebc_core() { /* void */
    if (u.uswallow) {
        if (Is_waterlevel(u.uz)) {
            /* we need to proceed with the removal from the floor
             * so that movebubbles() processing will disregard it as
             * intended. Ignore all the vision stuff.
             */
            if (!carried(uball))
                obj_extract_self(uball);
            obj_extract_self(uchain);
        }
        /* ball&chain not unplaced while swallowed */
        return;
    }

    if (!carried(uball)) {
        obj_extract_self(uball);
        if (Blind() && (u.bc_felt & BC_BALL)) /* drop glyph */
            levl()[uball.ox][uball.oy].glyph = u.bglyph;
        maybe_unhide_at(uball.ox, uball.oy);
        newsym(uball.ox, uball.oy);
    }
    obj_extract_self(uchain);
    if (Blind() && (u.bc_felt & BC_CHAIN)) /* drop glyph */
        levl()[uchain.ox][uchain.oy].glyph = u.cglyph;
    maybe_unhide_at(uchain.ox, uchain.oy);

    newsym(uchain.ox, uchain.oy);
    u.bc_felt = 0; /* feel nothing */
}

function check_restriction(restriction) { /* boolean */
    let ret = FALSE;

    if (!bcrestriction[0] || (restriction == override_restriction))
        ret = TRUE;
    else
        ret = (bcrestriction[0] == restriction) ? TRUE : FALSE;
    return ret;
}

export function placebc() { /* void */
    if (!check_restriction(0)) {
        return;
    }
    if (uchain && uchain.where != OBJ_FREE) {
        impossible(_("bc already placed?"));
        return;
    }
    placebc_core();
}

export function unplacebc() { /* void */
    if (bcrestriction[0]) {
        impossible(_("unplacebc denied, restriction in place"));
        return;
    }
    unplacebc_core();
}

export function unplacebc_and_covet_placebc() { /* int */
    let restriction = 0;

    if (bcrestriction[0]) {
        impossible(_("unplacebc_and_covet_placebc denied, already restricted"));
    } else {
        restriction = bcrestriction[0] = rnd(400);
        unplacebc_core();
    }
    return restriction;
}

export function lift_covet_and_placebc(pin) { /* void */
    if (!check_restriction(pin)) {
        return;
    }
    if (uchain && uchain.where != OBJ_FREE) {
        impossible(_("bc already placed?"));
        return;
    }
    placebc_core();
}

/* #else (#ifndef BREADCRUMBS): not in this build */

/*
 *  Return the stacking of the hero's ball & chain.  This assumes that the
 *  hero is being punished.
 */
function bc_order() { /* int */
    let obj;

    if (uchain.ox != uball.ox || uchain.oy != uball.oy || carried(uball)
        || u.uswallow)
        return BCPOS_DIFFER;

    for (obj = svl.level.objects[uball.ox][uball.oy]; obj;
         obj = obj.v.v_nexthere) {
        if (obj == uchain)
            return BCPOS_CHAIN;
        if (obj == uball)
            return BCPOS_BALL;
    }
    impossible(_("bc_order:  ball&chain not in same location!"));
    return BCPOS_DIFFER;
}

/*
 *  set_bc()
 *
 *  The hero is either about to go blind or already blind and just punished.
 *  Set up the ball and chain variables so that the ball and chain are "felt".
 */
export function set_bc(already_blind) { /* void */
    let ball_on_floor = +!carried(uball);

    u.bc_order = bc_order(); /* get the order */
    u.bc_felt = ball_on_floor ? BC_BALL | BC_CHAIN : BC_CHAIN; /* felt */

    if (already_blind || u.uswallow) {
        u.cglyph = u.bglyph = levl()[u.ux][u.uy].glyph;
        return;
    }

    /*
     *  Since we can still see, remove the ball&chain and get the glyph that
     *  would be beneath them.  Then put the ball&chain back.  This is pretty
     *  disgusting, but it will work.
     */
    remove_object(uchain);
    if (ball_on_floor)
        remove_object(uball);

    newsym(uchain.ox, uchain.oy);
    u.cglyph = levl()[uchain.ox][uchain.oy].glyph;

    if (u.bc_order == BCPOS_DIFFER) { /* different locations */
        place_object(uchain, uchain.ox, uchain.oy);
        newsym(uchain.ox, uchain.oy);
        if (ball_on_floor) {
            newsym(uball.ox, uball.oy); /* see under ball */
            u.bglyph = levl()[uball.ox][uball.oy].glyph;
            place_object(uball, uball.ox, uball.oy);
            newsym(uball.ox, uball.oy); /* restore ball */
        }
    } else {
        u.bglyph = u.cglyph;
        if (u.bc_order == BCPOS_CHAIN) {
            place_object(uball, uball.ox, uball.oy);
            place_object(uchain, uchain.ox, uchain.oy);
        } else {
            place_object(uchain, uchain.ox, uchain.oy);
            place_object(uball, uball.ox, uball.oy);
        }
        newsym(uball.ox, uball.oy);
    }
}

/*
 *  move_bc()
 *
 *  Move the ball and chain.  This is called twice for every move.  The first
 *  time to pick up the ball and chain before the move, the second time to
 *  place the ball and chain after the move.  If the ball is carried, this
 *  function should never have BC_BALL as part of its control.
 *
 *  Should not be called while swallowed.
 */
export function move_bc(before, control, ballx, bally,
        chainx, chainy) { /* void */
    if (Blind()) {
        /*
         *  The hero is blind.  Time to work hard.  The ball and chain that
         *  are attached to the hero are very special.  The hero knows that
         *  they are attached, so when they move, the hero knows that they
         *  aren't at the last position remembered.  This is complicated
         *  by the fact that the hero can "feel" the surrounding locations
         *  at any time, hence, making one or both of them show up again.
         *  So, we have to keep track of which is felt at any one time and
         *  act accordingly.
         */
        if (!before) {
            if ((control & BC_CHAIN) && (control & BC_BALL)) {
                /*
                 *  Both ball and chain moved.  If felt, drop glyph.
                 */
                if (u.bc_felt & BC_BALL)
                    levl()[uball.ox][uball.oy].glyph = u.bglyph;
                if (u.bc_felt & BC_CHAIN)
                    levl()[uchain.ox][uchain.oy].glyph = u.cglyph;
                u.bc_felt = 0;

                /* Pick up glyph at new location. */
                u.bglyph = levl()[ballx][bally].glyph;
                u.cglyph = levl()[chainx][chainy].glyph;

                movobj(uball, ballx, bally);
                movobj(uchain, chainx, chainy);
            } else if (control & BC_BALL) {
                if (u.bc_felt & BC_BALL) {
                    if (u.bc_order == BCPOS_DIFFER) { /* ball by itself */
                        levl()[uball.ox][uball.oy].glyph = u.bglyph;
                    } else if (u.bc_order == BCPOS_BALL) {
                        if (u.bc_felt & BC_CHAIN) { /* know chain is there */
                            map_object(uchain, 0);
                        } else {
                            levl()[uball.ox][uball.oy].glyph = u.bglyph;
                        }
                    }
                    u.bc_felt &= ~BC_BALL; /* no longer feel the ball */
                }

                /* Pick up glyph at new position. */
                u.bglyph = (ballx != chainx || bally != chainy)
                               ? levl()[ballx][bally].glyph
                               : u.cglyph;

                movobj(uball, ballx, bally);
            } else if (control & BC_CHAIN) {
                if (u.bc_felt & BC_CHAIN) {
                    if (u.bc_order == BCPOS_DIFFER) {
                        levl()[uchain.ox][uchain.oy].glyph = u.cglyph;
                    } else if (u.bc_order == BCPOS_CHAIN) {
                        if (u.bc_felt & BC_BALL) {
                            map_object(uball, 0);
                        } else {
                            levl()[uchain.ox][uchain.oy].glyph = u.cglyph;
                        }
                    }
                    u.bc_felt &= ~BC_CHAIN;
                }
                /* Pick up glyph at new position. */
                u.cglyph = (ballx != chainx || bally != chainy)
                               ? levl()[chainx][chainy].glyph
                               : u.bglyph;

                movobj(uchain, chainx, chainy);
            }

            u.bc_order = bc_order(); /* reset the order */
        }
    } else {
        /*
         *  The hero is not blind.  To make this work correctly, we need to
         *  pick up the ball and chain before the hero moves, then put them
         *  in their new positions after the hero moves.
         */
        if (before) {
            if (!control) {
                /*
                 * Neither ball nor chain is moving, so remember which was
                 * on top until !before.  Use the variable u.bc_order
                 * since it is only valid when blind.
                 */
                u.bc_order = bc_order();
            }

            remove_object(uchain);
            maybe_unhide_at(uchain.ox, uchain.oy);
            newsym(uchain.ox, uchain.oy);
            if (!carried(uball)) {
                remove_object(uball);
                maybe_unhide_at(uball.ox, uball.oy);
                newsym(uball.ox, uball.oy);
            }
        } else {
            let on_floor = +!carried(uball);

            if ((control & BC_CHAIN)
                || (!control && u.bc_order == BCPOS_CHAIN)) {
                /* If the chain moved or nothing moved & chain on top. */
                if (on_floor)
                    place_object(uball, ballx, bally);
                place_object(uchain, chainx, chainy); /* chain on top */
            } else {
                place_object(uchain, chainx, chainy);
                if (on_floor)
                    place_object(uball, ballx, bally);
                /* ball on top */
            }
            newsym(chainx, chainy);
            if (on_floor)
                newsym(ballx, bally);
        }
    }
}

/* return TRUE if the caller needs to place the ball and chain down again */
export function drag_ball(x, y, bc_control,
          ballx, bally, chainx, chainy,
          cause_delay, allow_drag) { /* boolean */
    var t = null;
    var already_in_rock;

    /*
     * Should not be called while swallowed.  Should be called before
     * movement, because we might want to move the ball or chain to the
     * hero's old position.
     *
     * It is called if we are moving.  It is also called if we are
     * teleporting *if* the ball doesn't move and we thus must drag the
     * chain.  It is not called for ordinary teleportation.
     *
     * 'allow_drag' is only used in the ugly special case where teleporting
     * must drag the chain, while an identical-looking movement must drag
     * both the ball and chain.
     */

    ballx[0] = uball.ox;
    bally[0] = uball.oy;
    chainx[0] = uchain.ox;
    chainy[0] = uchain.oy;
    bc_control[0] = 0;
    chars[cause_delay] = FALSE;

    if (dist2(x, y, uchain.ox, uchain.oy) <= 2) { /* nothing moved */
        move_bc(1, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
        return TRUE;
    }

    /* only need to move the chain? */
    drag: { if (carried(uball) || distmin(x, y, uball.ox, uball.oy) <= 2) {
        var oldchainx = uchain.ox, oldchainy = uchain.oy;

        bc_control[0] = BC_CHAIN;
        move_bc(1, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
        if (carried(uball)) {
            /* move chain only if necessary */
            if (distmin(x, y, uchain.ox, uchain.oy) > 1) {
                chainx[0] = u.ux;
                chainy[0] = u.uy;
            }
            return TRUE;
        }

    /*
     * Don't ever move the chain into solid rock.  If we have to, then
     * instead undo the move_bc() and jump to the drag ball code.  Note
     * that this also means the "cannot carry and drag" message will not
     * appear, since unless we moved at least two squares there is no
     * possibility of the chain position being in solid rock.
     */

        if (IS_CHAIN_ROCK(u.ux, u.uy) || IS_CHAIN_ROCK(chainx[0], chainy[0])
            || IS_CHAIN_ROCK(uball.ox, uball.oy))
            already_in_rock = TRUE;
        else
            already_in_rock = FALSE;

        switch (dist2(x, y, uball.ox, uball.oy)) {
        /* two spaces diagonal from ball, move chain in-between */
        case 8:
            chainx[0] = Math.trunc((uball.ox + x) / 2);
            chainy[0] = Math.trunc((uball.oy + y) / 2);
            if (IS_CHAIN_ROCK(chainx[0], chainy[0]) && !already_in_rock)
                do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
            break;

        /* player is distance 2/1 from ball; move chain to one of the
         * two spaces between
         *   @
         *   __
         *    0
         */
        case 5: {
            var tempx, tempy, tempx2, tempy2;

            /* find position closest to current position of chain;
               no effect if current position is already OK */
            if (abs(x - uball.ox) == 1) {
                tempx = x;
                tempx2 = uball.ox;
                tempy = tempy2 = Math.trunc((uball.oy + y) / 2);
            } else {
                tempx = tempx2 = Math.trunc((uball.ox + x) / 2);
                tempy = y;
                tempy2 = uball.oy;
            }
            if (IS_CHAIN_ROCK(tempx, tempy) && !IS_CHAIN_ROCK(tempx2, tempy2)
                && !already_in_rock) {
                if (allow_drag) {
                    /* Avoid pathological case *if* not teleporting:
                     *   0                          0_
                     *   _X  move northeast  ----->  X@
                     *    @
                     */
                    if (dist2(u.ux, u.uy, uball.ox, uball.oy) == 5
                        && dist2(x, y, tempx, tempy) == 1)
                        do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
                    /* Avoid pathological case *if* not teleporting:
                     *    0                          0
                     *   _X  move east       ----->  X_
                     *    @                           @
                     */
                    if (dist2(u.ux, u.uy, uball.ox, uball.oy) == 4
                        && dist2(x, y, tempx, tempy) == 2)
                        do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
                }
                chainx[0] = tempx2;
                chainy[0] = tempy2;
            } else if (!IS_CHAIN_ROCK(tempx, tempy)
                       && IS_CHAIN_ROCK(tempx2, tempy2) && !already_in_rock) {
                if (allow_drag) {
                    if (dist2(u.ux, u.uy, uball.ox, uball.oy) == 5
                        && dist2(x, y, tempx2, tempy2) == 1)
                        do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
                    if (dist2(u.ux, u.uy, uball.ox, uball.oy) == 4
                        && dist2(x, y, tempx2, tempy2) == 2)
                        do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
                }
                chainx[0] = tempx;
                chainy[0] = tempy;
            } else if (IS_CHAIN_ROCK(tempx, tempy)
                       && IS_CHAIN_ROCK(tempx2, tempy2) && !already_in_rock) {
                do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
            } else if (dist2(tempx, tempy, uchain.ox, uchain.oy)
                           < dist2(tempx2, tempy2, uchain.ox, uchain.oy)
                       || ((dist2(tempx, tempy, uchain.ox, uchain.oy)
                            == dist2(tempx2, tempy2, uchain.ox, uchain.oy))
                           && rn2(2))) {
                chainx[0] = tempx;
                chainy[0] = tempy;
            } else {
                chainx[0] = tempx2;
                chainy[0] = tempy2;
            }
            break;
        }

        /* ball is two spaces horizontal or vertical from player; move*/
        /* chain in-between *unless* current chain position is OK */
        case 4:
            if (((distmin(x, y, uchain.ox, uchain.oy) <= 1) && (distmin(uchain.ox, uchain.oy, uball.ox, uball.oy) <= 1)))
                break;
            chainx[0] = Math.trunc((x + uball.ox) / 2);
            chainy[0] = Math.trunc((y + uball.oy) / 2);
            if (IS_CHAIN_ROCK(chainx[0], chainy[0]) && !already_in_rock)
                do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
            break;

        /* ball is one space diagonal from player.  Check for the
         * following special case:
         *   @
         *    _    moving southwest becomes  @_
         *   0                                0
         * (This will also catch teleporting that happens to resemble
         * this case, but oh well.)  Otherwise fall through.
         */
        case 2:
            if (dist2(x, y, uball.ox, uball.oy) == 2
                && dist2(x, y, uchain.ox, uchain.oy) == 4) {
                if (uchain.oy == y)
                    chainx[0] = uball.ox;
                else
                    chainy[0] = uball.oy;
                if (IS_CHAIN_ROCK(chainx[0], chainy[0]) && !already_in_rock)
                    do { chainx[0] = oldchainx; chainy[0] = oldchainy; move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]); break drag; } while (0);
                break;
            }
            /* FALLTHROUGH */;
        /* FALLTHRU */
        case 1:
        case 0:
            /* do nothing if possible */
            if (((distmin(x, y, uchain.ox, uchain.oy) <= 1) && (distmin(uchain.ox, uchain.oy, uball.ox, uball.oy) <= 1)))
                break;
            /* otherwise try to drag chain to player's old position */
            if (((distmin(x, y, u.ux, u.uy) <= 1) && (distmin(u.ux, u.uy, uball.ox, uball.oy) <= 1))) {
                chainx[0] = u.ux;
                chainy[0] = u.uy;
                break;
            }
            /* otherwise use player's new position (they must have
               teleported, for this to happen) */
            chainx[0] = x;
            chainy[0] = y;
            break;

        default:
            impossible(_("bad chain movement"));
            break;
        }

        return TRUE;
    }
 }

    if (near_capacity() > SLT_ENCUMBER && dist2(x, y, u.ux, u.uy) <= 2) {
        You(_("cannot %sdrag the heavy iron ball."),
            gi.invent ? _("carry all that and also ") : _(""));
        nomul(0);
        return FALSE;
    }

    if ((is_pool(uchain.ox, uchain.oy)
         /* water not mere continuation of previous water */
         && (levl()[uchain.ox][uchain.oy].typ == POOL
             || !is_pool(uball.ox, uball.oy)
             || levl()[uball.ox][uball.oy].typ == POOL))
        || ((t = t_at(uchain.ox, uchain.oy))
            && (is_pit(t.ttyp) || is_hole(t.ttyp)))) {
        if (Levitation()) {
            You_feel(_("a tug from the iron ball."));
            if (t)
                t.tseen = 1;
        } else {
            var victim;

            You(_("are jerked back by the iron ball!"));
            if ((victim = m_at(uchain.ox, uchain.oy)) != null) {
                var tmp;
                var dieroll = rnd(20);

                tmp = -2 + Luck() + find_mac(victim);
                tmp += omon_adj(victim, uball, TRUE);

                if (tmp >= dieroll)
                    hmon(victim, uball, HMON_DRAGGED, dieroll);
                else
                    miss(xname(uball), victim);
            } /* now check again in case mon died */
            if (!m_at(uchain.ox, uchain.oy)) {
                u.ux = uchain.ox;
                u.uy = uchain.oy;
                newsym(u.ux0, u.uy0);
            }
            nomul(0);

            bc_control[0] = BC_BALL;
            move_bc(1, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
            ballx[0] = uchain.ox;
            bally[0] = uchain.oy;
            move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
            spoteffects(TRUE);
            return FALSE;
        }
    }

    bc_control[0] = BC_BALL | BC_CHAIN;

    move_bc(1, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);
    if (dist2(x, y, u.ux, u.uy) > 2) {
        /* Awful case: we're still in range of the ball, so we thought we
         * could only move the chain, but it turned out that the target
         * square for the chain was rock, so we had to drag it instead.
         * But we can't drag it either, because we teleported and are more
         * than one square from our old position.  Revert to the teleport
         * behavior.
         */
        ballx[0] = chainx[0] = x;
        bally[0] = chainy[0] = y;
    } else {
        var newchainx = u.ux, newchainy = u.uy;

        /*
         * Generally, chain moves to hero's previous location and ball
         * moves to chain's previous location, except that we try to
         * keep the chain directly between the hero and the ball.  But,
         * take the simple approach if the hero's previous location or
         * the potential between location is inaccessible.
         */
        if (dist2(x, y, uchain.ox, uchain.oy) == 4
            && !IS_CHAIN_ROCK(newchainx, newchainy)) {
            newchainx = Math.trunc((x + uchain.ox) / 2);
            newchainy = Math.trunc((y + uchain.oy) / 2);
            if (IS_CHAIN_ROCK(newchainx, newchainy)) {
                /* don't let chain move to inaccessible location */
                newchainx = u.ux;
                newchainy = u.uy;
            }
        }

        ballx[0] = uchain.ox;
        bally[0] = uchain.oy;
        chainx[0] = newchainx;
        chainy[0] = newchainy;
    }

    chars[cause_delay] = TRUE;
    return TRUE;
}
export function IS_CHAIN_ROCK(x, y) { return (IS_OBSTRUCTED(levl()[x][y].typ) || (IS_DOOR(levl()[x][y].typ) && (levl()[x][y].flags & (D_CLOSED | D_LOCKED))) ? 1 : 0); }

/*
 *  drop_ball()
 *
 *  The punished hero drops or throws her iron ball.  If the hero is
 *  blind, we must reset the order and glyph.  Check for side effects.
 *  This routine expects the ball to be already placed.
 *
 *  Should not be called while swallowed.
 */
export function drop_ball(x, y) { /* void */
    if (Blind()) {
        /* get the order */
        u.bc_order = bc_order();
        /* pick up glyph */
        u.bglyph = u.bc_order ? u.cglyph : levl()[x][y].glyph;
    }

    if (x != u.ux || y != u.uy) {
        let pullmsg = init_string(static_array("drop_ball.pullmsg", char, sizeof_string("The ball pulls you out of the ")), _("The ball pulls you out of the "), true);
        let t;
        let side;

        if (u.utrap
            && u.utraptype != TT_INFLOOR && u.utraptype != TT_BURIEDBALL) {
            switch (u.utraptype) {
            case TT_PIT:
                pline(_("%s%s!"), pullmsg, _("pit"));
                break;
            case TT_WEB:
                pline(_("%s%s!"), pullmsg, _("web"));
                 ;
                pline_The(_("web is destroyed!"));
                deltrap(t_at(u.ux, u.uy));
                break;
            case TT_LAVA:
                pline(_("%s%s!"), pullmsg, hliquid(_("lava")));
                break;
            case TT_BEARTRAP:
                side = rn2(3) ? LEFT_SIDE : RIGHT_SIDE;
                pline(_("%s%s!"), pullmsg, _("bear trap"));
                set_wounded_legs(side, rn1(1000, 500));
                if (!u.usteed) {
                    Your(_("%s %s is severely damaged."),
                         (side == LEFT_SIDE) ? _("left") : _("right"),
                         body_part(LEG));
                    losehp(Maybe_Half_Phys(2),
                           _("leg damage from being pulled out of a bear trap"),
                           KILLED_BY);
                }
                break;
            }
            reset_utrap(TRUE);
            fill_pit(u.ux, u.uy);
        }

        u.ux0 = u.ux;
        u.uy0 = u.uy;
        if (!Levitation() && !MON_AT(x, y) && !u.utrap
            && (is_pool(x, y)
                || ((t = t_at(x, y))
                    && (is_pit(t.ttyp)
                        || is_hole(t.ttyp))))) {
            u.ux = x;
            u.uy = y;
        } else {
            u.ux = x - u.dx;
            u.uy = y - u.dy;
        }
        gv.vision_full_recalc = 1; /* hero has moved, recalc vision later */

        if (Blind()) {
            /* drop glyph under the chain */
            if (u.bc_felt & BC_CHAIN)
                levl()[uchain.ox][uchain.oy].glyph = u.cglyph;
            u.bc_felt = 0; /* feel nothing */
            /* pick up new glyph */
            u.cglyph = u.bc_order ? u.bglyph : levl()[u.ux][u.uy].glyph;
        }
        movobj(uchain, u.ux, u.uy); /* has a newsym */
        if (Blind()) {
            u.bc_order = bc_order();
        }
        newsym(u.ux0, u.uy0); /* clean up old position */
        if (u.ux0 != u.ux || u.uy0 != u.uy) {
            spoteffects(TRUE);
        }
    }
}

/* ball&chain cause hero to randomly lose stuff from inventory */
function litter() { /* void */
    let otmp, nextobj = null;
    let capacity = weight_cap();

    for (otmp = gi.invent; otmp; otmp = nextobj) {
        nextobj = otmp.nobj;
        if (otmp != uball && rnd(capacity) <= int(otmp.owt)) {
            if (canletgo(otmp, _(""))) {
                You(_("drop %s and %s %s down the stairs with you."),
                    yname(otmp), (otmp.quan == 1) ? _("it") : _("they"),
                    otense(otmp, _("fall")));
                setnotworn(otmp);
                freeinv(otmp);
                hitfloor(otmp, FALSE);
            }
        }
    }
}

export function drag_down() { /* void */
    let forward;
    let dragchance = 3;

    /*
     *  Assume that the ball falls forward if:
     *
     *  a) the character is wielding it, or
     *  b) the character has both hands available to hold it (i.e. is
     *     not wielding any weapon), or
     *  c) (perhaps) it falls forward out of his non-weapon hand
     */
    forward = +(carried(uball) && (uwep == uball || !uwep || !rn2(3)));

    if (carried(uball) && !welded(uball))
        You(_("lose your grip on the iron ball."));

    cls();  /* previous level is still displayed although you
               went down the stairs. Avoids bug C343-20 */

    if (forward) {
        if (rn2(6)) {
            pline_The(_("iron ball drags you downstairs!"));
            losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(6)) + 1) / 2))) : (rnd(6))),
                   _("dragged downstairs by an iron ball"), NO_KILLER_PREFIX);
            litter();
        }
    } else {
        if (rn2(2)) {
             ;
            pline_The(_("iron ball smacks into you!"));
            losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(20)) + 1) / 2))) : (rnd(20))), _("iron ball collision"),
                   KILLED_BY_AN);
            exercise(A_STR, FALSE);
            dragchance = uchar(dragchance - 2);
        }
        if (dragchance >= rnd(6)) {
            pline_The(_("iron ball drags you downstairs!"));
            losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(3)) + 1) / 2))) : (rnd(3))),
                   _("dragged downstairs by an iron ball"), NO_KILLER_PREFIX);
            exercise(A_STR, FALSE);
            litter();
        }
    }
}

export function bc_sanity_check() { /* void */
    let otyp, freeball, freechain;
    let onam;

    if (Punished() && (!uball || !uchain)) {
        impossible(_("Punished without %s%s%s?"),
                   !uball ? _("iron ball") : _(""),
                   (!uball && !uchain) ? _(" and ") : _(""),
                   !uchain ? _("attached chain") : _(""));
    } else if (!Punished() && (uball || uchain)) {
        impossible(_("Attached %s%s%s without being Punished?"),
                   uchain ? _("chain") : _(""),
                   (uchain && uball) ? _(" and ") : _(""),
                   uball ? _("iron ball") : _(""));
    }
    /* ball is free when swallowed, when changing levels or during air bubble
       management on Plane of Water (both of which start and end in between
       sanity checking cycles, so shouldn't be relevant), other times? */
    freechain = +(!uchain || uchain.where == OBJ_FREE);
    freeball = (!uball || uball.where == OBJ_FREE
                /* lie to simplify the testing logic */
                || (freechain && uball.where == OBJ_INVENT) ? 1 : 0);
    if (uball && (uball.otyp != HEAVY_IRON_BALL
                  || (uball.where != OBJ_FLOOR
                      && uball.where != OBJ_INVENT
                      && uball.where != OBJ_FREE)
                  || (freeball ^ freechain)
                  || (uball.owornmask & W_BALL) == 0
                  || (uball.owornmask & ~(W_BALL | W_WEAPONS)) != 0)) {
        otyp = uball.otyp;
        onam = safe_typename(otyp);
        impossible(_("uball: type %d (%s), where %d, wornmask=0x%08llx"),
                   otyp, onam, uball.where, uball.owornmask);
    }
    /* similar check to ball except can't be in inventory */
    if (uchain && (uchain.otyp != IRON_CHAIN
                   || (uchain.where != OBJ_FLOOR
                       && uchain.where != OBJ_FREE)
                   || (freechain ^ freeball)
                   /* [could simplify this to owornmask != W_CHAIN] */
                   || (uchain.owornmask & W_CHAIN) == 0
                   || (uchain.owornmask & ~W_CHAIN) != 0)) {
        otyp = uchain.otyp;
        onam = safe_typename(otyp);
        impossible(_("uchain: type %d (%s), where %d, wornmask=0x%08llx"),
                   otyp, onam, uchain.where, uchain.owornmask);
    }
    if (uball && uchain && !(freeball && freechain)) {
        let bx, by, cx, cy, bdx, bdy, cdx, cdy;

        /* non-free chain should be under or next to the hero;
           non-free ball should be on or next to the chain or else carried */
        cx = uchain.ox, cy = uchain.oy;
        cdx = cx - u.ux, cdy = cy - u.uy;
        cdx = abs(cdx), cdy = abs(cdy);
        if (uball.where == OBJ_INVENT) /* carried(uball) */
            bx = u.ux, by = u.uy; /* get_obj_location() */
        else
            bx = uball.ox, by = uball.oy;
        bdx = bx - cx, bdy = by - cy;
        bdx = abs(bdx), bdy = abs(bdy);
        if (cdx > 1 || cdy > 1 || bdx > 1 || bdy > 1)
            impossible(
                     _("b&c distance: you@<%d,%d>, chain@<%d,%d>, ball@<%d,%d>"),
                       u.ux, u.uy, cx, cy, bx, by);
    }
    /* [check bc_order too?] */
}

/*ball.c*/

import { A_STR } from "./attrib.h.js";
import { Is_waterlevel } from "./dungeon.h.macros.js";
import { FALSE, TRUE, boolean } from "./global.h.js";
import {
    HEAD, HMON_DRAGGED, KILLED_BY, KILLED_BY_AN, LEG, NO_KILLER_PREFIX, SLT_ENCUMBER,
    override_restriction,
} from "./hack.h.js";
import { Maybe_Half_Phys, rn1 } from "./hack.h.macros.js";
import { OBJ_FLOOR, OBJ_FREE, OBJ_INVENT } from "./obj.h.js";
import { carried } from "./obj.h.macros.js";
import { HEAVY_IRON_BALL, IRON_CHAIN } from "./objects.h.js";
import { LEFT_SIDE, RIGHT_SIDE, W_BALL, W_CHAIN, W_WEAPONS } from "./prop.h.js";
import { D_CLOSED, D_LOCKED, POOL } from "./rm.h.js";
import { IS_DOOR, IS_OBSTRUCTED, MON_AT, levl, m_at } from "./rm.h.macros.js";
import { is_hole, is_pit } from "./trap.h.macros.js";
import {
    BC_BALL, BC_CHAIN, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB,
} from "./you.h.js";
import { Luck } from "./you.h.macros.js";
import { Blind, Half_physical_damage, Levitation, Punished } from "./youprop.h.macros.js";
import { char, int, sizeof_string, uchar } from "../rt/ctypes.js";
import { chars } from "../rt/heap.js";
import { abs } from "../rt/libc.js";
import { init_string, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { exercise } from "./attrib.js";
import { is_pool } from "./dbridge.js";
import { flags, gi, gv, svl, u } from "./decl.js";
import { cls, map_object, newsym } from "./display.js";
import { canletgo, flooreffects, set_wounded_legs } from "./do.js";
import { hliquid } from "./do_name.js";
import { hard_helmet } from "./do_wear.js";
import { hitfloor, omon_adj } from "./dothrow.js";
import { losehp, movobj, near_capacity, nomul, spoteffects, weight_cap } from "./hack.js";
import { dist2, distmin } from "./hacklib.js";
import { freeinv } from "./invent.js";
import { obj_extract_self, place_object, remove_object } from "./mkobj.js";
import { maybe_unhide_at } from "./mon.js";
import { Yname2, otense, safe_typename, xname, yname } from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import { You, You_feel, Your, impossible, pline, pline_The } from "./pline.js";
import { body_part } from "./polyself.js";
import { rn2, rnd } from "./rnd.js";
import { deltrap, fill_pit, reset_utrap, t_at } from "./trap.js";
import { hmon } from "./uhitm.js";
import { setuqwep, setuswapwep, setuwep, welded } from "./wield.js";
import { find_mac, setnotworn } from "./worn.js";
import { miss } from "./zap.js";
