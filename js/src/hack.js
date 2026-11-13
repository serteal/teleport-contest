/* NetHack 5.0	hack.c	$NHDT-Date: 1763708572 2025/11/20 23:02:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.494 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

/* #define DEBUG */ /* uncomment for debugging */

export function IS_SHOP(x) { return +(elt(svr.rooms, x).rtype >= SHOPBASE); }

/* XXX: if more sources of water walking than just boots are added,
   cause_known(insight.c) should be externified and used for this */
export function Known_wwalking() { return (uarmf && uarmf.otyp == WATER_WALKING_BOOTS
     && objects[WATER_WALKING_BOOTS].oc_name_known
     && !u.usteed ? 1 : 0); }

export function Known_lwalking() { return (Known_wwalking() && Fire_resistance()
     && uarmf.oerodeproof && uarmf.rknown ? 1 : 0); }

/* mode values for findtravelpath() */
export const TRAVP_TRAVEL = 0;
export const TRAVP_GUESS = 1;
export const TRAVP_VALID = 2;

export function uint_to_any(ui) { /* anything * */
    struct_assign(gt.tmp_anything, cg.zeroany);
    gt.tmp_anything.a_uint = ui;
    return gt.tmp_anything;
}

export function long_to_any(lng) { /* anything * */
    struct_assign(gt.tmp_anything, cg.zeroany);
    gt.tmp_anything.a_long = lng;
    return gt.tmp_anything;
}

export function monst_to_any(mtmp) { /* anything * */
    struct_assign(gt.tmp_anything, cg.zeroany);
    gt.tmp_anything.a_monst = mtmp;
    return gt.tmp_anything;
}

export function obj_to_any(obj) { /* anything * */
    struct_assign(gt.tmp_anything, cg.zeroany);
    gt.tmp_anything.a_obj = obj;
    return gt.tmp_anything;
}

export function revive_nasty(x, y, msg) { /* boolean */
    const $frame = stack_frame(); try {
    let otmp = null, otmp2 = null;
    let mtmp;
    let cc = stack_struct(struct_nhcoord);
    let revived = FALSE;

    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp2) {
        otmp2 = otmp.v.v_nexthere;
        if (otmp.otyp == CORPSE
            && (is_rider(mons[otmp.corpsenm])
                || otmp.corpsenm == PM_WIZARD_OF_YENDOR)) {
            /* move any living monster already at that location */
            if ((mtmp = m_at(x, y)) && enexto(cc, x, y, mtmp.data))
                rloc_to(mtmp, cc.x, cc.y);
            if (msg)
                Norep(_("%s"), msg);
            revived = revive_corpse(otmp);
        }
    }

    /* this location might not be safe, if not, move revived monster */
    if (revived) {
        mtmp = m_at(x, y);
        if (mtmp && !goodpos(x, y, mtmp, 0)
            && enexto(cc, x, y, mtmp.data)) {
            rloc_to(mtmp, cc.x, cc.y);
        }
        /* else impossible? */
    }

    return revived;
    } finally { stack_pop($frame); }
}

export function squeezeablylightinvent() { return +(!gi.invent
    || inv_weight() <= (WT_SQUEEZABLE_INV * -1)); }

/* can hero move onto a spot containing one or more boulders?
   used for m<dir> and travel and during boulder push failure */
function could_move_onto_boulder(sx, sy) { /* boolean */
    /* can if able to phaze through rock (must be poly'd, so not riding) */
    if (Passes_walls())
        return TRUE;
    /* can't when riding */
    if (u.usteed)
        return FALSE;
    /* can if a giant, unless doing so allows hero to pass into a
       diagonal squeeze at the same time */
    if (throws_rocks(gy.youmonst.data))
        return +(!u.dx || !u.dy || !(IS_OBSTRUCTED(levl()[u.ux][sy].typ)
                                    && IS_OBSTRUCTED(levl()[sx][u.uy].typ)));
    /* can if tiny (implies carrying very little else couldn't move at all) */
    if (verysmall(gy.youmonst.data))
        return TRUE;
    /* can squeeze to spot if carrying extremely little, otherwise can't */
    return squeezeablylightinvent();
}

function dopush(
    sx,
    sy,
    rx,
    ry,
    otmp,
    costly) { /* void */
    let shkp;

    {
        let what;
        let givemesg, easypush;
        /* give boulder pushing feedback if this is a different
           boulder than the last one pushed or if it's been at
           least 2 turns since we last pushed this boulder;
           unlike with Norep(), intervening messages don't cause
           it to repeat, only doing something else in the meantime */
        if (otmp.o_id != gb.bldrpush_oid) {
            gb.bldrpushtime = svm.moves + 1;
            gb.bldrpush_oid = otmp.o_id;
        }
        givemesg = +(svm.moves > gb.bldrpushtime + 2
                    || svm.moves < gb.bldrpushtime);
        what = givemesg ? the(xname(otmp)) : 0;
        if (!u.usteed) {
            easypush = throws_rocks(gy.youmonst.data);
            if (givemesg)
                pline(_("With %s effort you move %s."),
                      easypush ? _("little") : _("great"), what);
            if (!easypush)
                exercise(A_STR, TRUE);
        } else {
            if (givemesg)
                pline(_("%s moves %s."), YMonnam(u.usteed), what);
        }
        gb.bldrpushtime = svm.moves;
    }

    /* Move the boulder *after* the message. */
    if (glyph_is_invisible(levl()[rx][ry].glyph))
        unmap_object(rx, ry);
    otmp.corpsenm = 0;
    movobj(otmp, rx, ry); /* does newsym(rx,ry) */
    if (Blind()) {
        feel_location(rx, ry);
        feel_location(sx, sy);
    } else {
        newsym(sx, sy);
    }
    /* maybe adjust bill if boulder was pushed across shop boundary;
       normally otmp->unpaid would not apply because otmp isn't in
       hero's inventory, but addtobill() sets it and subfrombill()
       clears it */
    if (costly && !costly_spot(rx, ry)) {
        /* pushing from inside shop to its boundary (or free spot) */
        addtobill(otmp, FALSE, FALSE, FALSE);
    } else if (!costly && costly_spot(rx, ry) && otmp.unpaid
               && ((shkp = shop_keeper(chars[in_rooms(rx, ry, SHOPBASE)]))
                   != null)
               && onshopbill(otmp, shkp, TRUE)) {
        /* this can happen if hero pushes boulder from farther inside
           shop into shop's free spot (which will add it to the bill),
           then teleports or Passes_walls to doorway (without exiting
           the shop), and then pushes the boulder from the free spot
           back into the shop; it's contingent upon the shopkeeper not
           "muttering an incantation" to fracture the boulder while it
           is unpaid at the free spot */
        subfrombill(otmp, shkp);
    } else if (otmp.unpaid
               && (shkp = find_objowner(otmp, sx, sy)) != null
               && !strchr(in_rooms(rx, ry, SHOPBASE),
                          ESHK(shkp).shoproom)) {
        /* once the boulder is fully out of the shop, so that it's
         * impossible to change your mind and push it back in without
         * leaving and triggering Kops, switch it to stolen_value */
        stolen_value(otmp, sx, sy, TRUE, FALSE);
    }
}

function cannot_push_msg(otmp, sx, sy) { /* void */
    let what;

    what = the(xname(otmp));
    if (u.usteed)
        pline(_("%s tries to move %s, but cannot."),
              YMonnam(u.usteed), what);
    else
        You(_("try to move %s, but in vain."), what);
    if (Blind())
        feel_location(sx, sy);
}

function cannot_push(otmp, sx, sy) { /* int */
    if (throws_rocks(gy.youmonst.data)) {
        let canpickup = (+(!Sokoban()
                         /* similar exception as in can_lift():
                            when poly'd into a giant, you can
                            pick up a boulder if you have a free
                            slot or into the overflow ('#') slot
                            unless already carrying at least one */
                        && (inv_cnt(FALSE) < invlet_basic
                               || !carrying(BOULDER)))),
            willpickup = (canpickup
                          && (flags.pickup && !svc.context.nopick)
                          && autopick_testobj(otmp, TRUE) ? 1 : 0);

        if (u.usteed && P_SKILL(P_RIDING) < P_BASIC) {
            You(_("aren't skilled enough to %s %s from %s."),
                willpickup ? _("pick up") : _("push aside"),
                the(xname(otmp)), y_monnam(u.usteed));
        } else {
            /*
             * will pick up:  you easily pick it up
             * can but won't: you maneuver over it and could pick it up
             * can't pick up: you maneuver over it (possibly followed
             *     by feedback from failed auto-pickup attempt)
             */
            pline(_("However, you %s%s."),
                  willpickup ? _("easily pick it up")
                             : _("maneuver over it"),
                  (canpickup && !willpickup)
                             ? _(" and could pick it up")
                             : _(""));
            /* similar to dropping everything and squeezing onto
               a Sokoban boulder's spot, moving to same breaks the
               Sokoban rules because on next step you could go
               past it without pushing it to plug a pit or hole */
            sokoban_guilt();
        }
        return 0;
    }

    if (could_move_onto_boulder(sx, sy)) {
        pline(
           _("However, you can squeeze yourself into a small opening."));
        sokoban_guilt();
        return 0;
    } else {
        return -1;
    }
}

function rock_disappear_msg(otmp) { /* void */
    if (u.usteed)
        pline(_("%s pushes %s and suddenly it disappears!"),
                YMonnam(u.usteed), the(xname(otmp)));
    else
        You(_("push %s and suddenly it disappears!"),
            the(xname(otmp)));
}

function moverock_done(sx, sy) { /* void */
    let otmp;
    for (otmp = svl.level.objects[sx][sy]; otmp; otmp = otmp.v.v_nexthere)
        if (otmp.otyp == BOULDER)
            otmp.corpsenm = 0; /* resume normal xname() for this obj */
}

function moverock() { /* int */
    let sx, sy;
    let ret;

    sx = u.ux + u.dx, sy = u.uy + u.dy; /* boulder starting position */
    ret = moverock_core(sx, sy);
    moverock_done(sx, sy);
    return ret;
}

function moverock_core(sx, sy) { /* int */
    const $frame = stack_frame(); try {
    let rx, ry;
    let otmp;
    let ttmp;
    let mtmp;
    let costly, firstboulder = TRUE;

    while ((otmp = sobj_at(BOULDER, sx, sy)) != null) {
        if (Blind() && glyph_to_obj(glyph_at(sx, sy)) != BOULDER) {
            pline(_("That feels like a boulder."));
            map_object(otmp, TRUE);
            nomul(0);
            return -1;
        }

        /* when otmp->next_boulder is 1, xname() will format it as
           "next boulder" instead of just "boulder"; affects
           boulder_hits_pool()'s messages as well as messages below */
        otmp.corpsenm = firstboulder ? 0 : 1;
        /* FIXME?  'firstboulder' should be reset to True if this boulder
           isn't the first and the previous one is named differently from
           this one.  Probably not worth bothering with... */
        firstboulder = FALSE;

        /* make sure that this boulder is visible as the top object */
        if (otmp != svl.level.objects[sx][sy])
            movobj(otmp, sx, sy);

        rx = u.ux + 2 * u.dx; /* boulder destination position */
        ry = u.uy + 2 * u.dy;
        nomul(0);

        /* using m<dir> towards an adjacent boulder steps over/onto it if
           poly'd into a giant or squeezes under/beside it if small/light
           enough but is a no-op in other circumstances unless move attempt
           reveals an unseen boulder or lack of remembered, unseen monster */
        if (svc.context.nopick) {
            let oldglyph = glyph_at(sx, sy); /* before feel_location() */
            let res;

            feel_location(sx, sy); /* same for all 3 if/else-if/else cases */
            if (throws_rocks(gy.youmonst.data)) {
                /* player has used 'm<dir>' to move, so step to boulder's
                   spot without pushing it; hero is poly'd into a giant,
                   so exotic forms of locomotion are out, but might be
                   levitating (ring, potion, spell) or flying (amulet) */
                You(_("%s over a boulder here."), u_locomotion(_("step")));
                /* ["over" seems weird on air level but what else to say?] */
                sokoban_guilt();
                res = 0; /* move to <sx,sy> */
            } else if (could_move_onto_boulder(sx, sy)) {
                You(_("squeeze yourself %s the boulder."),
                    Flying() ? _("over") : _("against"));
                sokoban_guilt();
                res = 0; /* move to <sx,sy> */
            } else {
                There(_("is a boulder in your way."));
                /* use a move if hero learns something; see test_move() for
                   how/why 'context.door_opened' is being dragged into this */
                if (glyph_at(sx, sy) != oldglyph)
                    svc.context.door_opened = svc.context.move = TRUE;
                res = -1; /* don't move to <sx,sy>, so no soko guilt */
            }
            return res;
        }
        if (Levitation() || Is_airlevel(u.uz)) {
            /* FIXME?  behavior in an air bubble on the water level should
               be similar to being on the air level; both cases probably
               ought to let push attempt proceed when flying (which implies
               not levitating) */
            if (Blind())
                feel_location(sx, sy);
            You(_("don't have enough leverage to push %s."), the(xname(otmp)));
            /* Give them a chance to climb over it? */
            return -1;
        }
        if (verysmall(gy.youmonst.data) && !u.usteed) {
            if (Blind())
                feel_location(sx, sy);
            pline(_("You're too small to push that %s."), xname(otmp));
            return cannot_push(otmp, sx, sy);
        }
        if (isok(rx, ry) && !IS_OBSTRUCTED(levl()[rx][ry].typ)
            && levl()[rx][ry].typ != IRONBARS
            && (!IS_DOOR(levl()[rx][ry].typ) || !(u.dx && u.dy)
                || doorless_door(rx, ry)) && !sobj_at(BOULDER, rx, ry)) {
            ttmp = t_at(rx, ry);
            mtmp = m_at(rx, ry);
            costly = (costly_spot(sx, sy)
                      && shop_keeper(chars[in_rooms(sx, sy, SHOPBASE)]) ? 1 : 0);

            /* KMH -- Sokoban doesn't let you push boulders diagonally */
            if (Sokoban() && u.dx && u.dy) {
                if (Blind())
                    feel_location(sx, sy);
                pline(_("%s won't roll diagonally on this %s."),
                      The(xname(otmp)), surface(sx, sy));
                return cannot_push(otmp, sx, sy);
            }

            if (revive_nasty(rx, ry,
                             _("You sense movement on the other side."))) {
                return -1;
            }

            if (mtmp && !noncorporeal(mtmp.data)
                && (!mtmp.mtrapped || !(ttmp && is_pit(ttmp.ttyp)))) {
                let deliver_part1 = FALSE;

                if (Blind())
                    feel_location(sx, sy);
                if (canspotmon(mtmp)) {
                    pline(_("There's %s on the other side."), a_monnam(mtmp));
                    deliver_part1 = TRUE;
                } else {
                     ;
                    You_hear(_("a monster behind %s."), the(xname(otmp)));
                    if (!Deaf())
                        deliver_part1 = TRUE;
                    map_invisible(rx, ry);
                }
                if (flags.verbose) {
                    let you_or_steed = stack_array(char, BUFSZ);

                    strcpy(you_or_steed, u.usteed ? y_monnam(u.usteed) : _("you"))
;
                    pline(_("%s%s cannot move %s."),
                          deliver_part1 ? _("Perhaps that's why ") : _(""),
                          deliver_part1 ? you_or_steed
                                        : upstart(you_or_steed),
                          deliver_part1 ? _("it") : the(xname(otmp)));
                }
                return cannot_push(otmp, sx, sy);
            }

            if (closed_door(rx, ry)) {
                cannot_push_msg(otmp, sx, sy);
                return cannot_push(otmp, sx, sy);
            }

            /* at this point the boulder should be able to move (though
               potentially into something like a trap, pool, or lava) */

            /* rumbling disturbs buried zombies */
            disturb_buried_zombies(sx, sy);

            if (ttmp) {
                let newlev = 0; /* lint suppression */
                let dest = stack_struct(struct_d_level);

                /* if a trap operates on the boulder, don't attempt
                   to move any others at this location; return -1
                   if another boulder is in hero's way, or 0 if he
                   should advance to the vacated boulder position */
                switch (ttmp.ttyp) {
                case LANDMINE:
                    if (rn2(10)) {
                        obj_extract_self(otmp);
                        place_object(otmp, rx, ry);
                        newsym(sx, sy);
                        pline(_("%s!  %s %s land mine."),
                              /* "kablam" is a variation of "ka-boom" or
                                 "kablooey", rather cartoonish descriptions
                                 of the sound of an explosion, but give it
                                 even when deaf if hero sees the explosion */
                              (!Deaf() || !Blind()) ? _("KAABLAMM!!")
                              /* use an alternate exclamation when feeling
                                 the floor/ground/whatever shake (or maybe
                                 a weak shockwave if levitating or flying) */
                                                : _("Gadzooks"),
                              Tobjnam(otmp, _("trigger")),
                              ttmp.madeby_u ? _("your") : _("a"));
                        blow_up_landmine(ttmp);
                        /* if the boulder remains, it should fill the pit */
                        fill_pit(u.ux, u.uy);
                        if (cansee(rx, ry))
                            newsym(rx, ry);
                        return sobj_at(BOULDER, sx, sy) ? -1 : 0;
                    }
                    break;
                case SPIKED_PIT:
                case PIT:
                    obj_extract_self(otmp);
                    /* vision kludge to get messages right;
                       the pit will temporarily be seen even
                       if this is one among multiple boulders */
                    if (!Blind())
                        uchars[gv.viz_array[ry] + rx] |= IN_SIGHT;
                    if (!flooreffects(otmp, rx, ry, _("fall"))) {
                        place_object(otmp, rx, ry);
                    }
                    if (mtmp && !Blind())
                        newsym(rx, ry);
                    return sobj_at(BOULDER, sx, sy) ? -1 : 0;
                case HOLE:
                case TRAPDOOR:
                    ;
                    if (Blind())
                        pline(_("Kerplunk!  You no longer feel %s."),
                              the(xname(otmp)));
                    else
                        pline(_("%s%s and %s a %s in the %s!"),
                              Tobjnam(otmp, (ttmp.ttyp == TRAPDOOR)
                                                ? _("trigger")
                                                : _("fall")),
                              (ttmp.ttyp == TRAPDOOR) ? _("") : _(" into"),
                              otense(otmp, _("plug")),
                              (ttmp.ttyp == TRAPDOOR) ? _("trap door") : _("hole"),
                              surface(rx, ry));
                    deltrap(ttmp);
                    useupf(otmp, 1);
                    bury_objs(rx, ry);
                    levl()[rx][ry].flags &= ~W_NONDIGGABLE;
                    levl()[rx][ry].candig = 1;
                    if (cansee(rx, ry))
                        newsym(rx, ry);
                    return sobj_at(BOULDER, sx, sy) ? -1 : 0;
                case LEVEL_TELEP:
                    /* 20% chance of picking current level; 100% chance for
                       that if in single-level branch (Knox) or in endgame */
                    newlev = random_teleport_level();
                    /* if trap doesn't work, skip "disappears" message */
                    if (newlev == depth(u.uz)) {
                        dopush(sx, sy, rx, ry, otmp, costly);
                        continue;
                    }
                    /* FALLTHROUGH */;
                    /*FALLTHRU*/
                case TELEP_TRAP:
                    rock_disappear_msg(otmp);
                    otmp.corpsenm = 0; /* reset before moving it */
                    if (ttmp.ttyp == TELEP_TRAP) {
                        rloco(otmp);
                    } else {
                        if (costly)
                            stolen_value(otmp, rx, ry, +!ttmp.tseen, FALSE);
                        obj_extract_self(otmp);
                        add_to_migration(otmp);
                        get_level(dest, newlev);
                        otmp.ox = dest.dnum;
                        otmp.oy = dest.dlevel;
                        otmp.owornmask = MIGR_RANDOM;
                    }
                    seetrap(ttmp);
                    return sobj_at(BOULDER, sx, sy) ? -1 : 0;
                case ROLLING_BOULDER_TRAP:
                {
                    let tox = rx;
                    let toy = ry;
                    /* the boulder continues until it reaches one of
                       the trap's launch spots or hits a wall / out-of-bounds */
                    while (isok(tox + u.dx, toy + u.dy)) {
                        tox += u.dx;
                        toy += u.dy;
                        if (tox == ttmp.launch.x && toy == ttmp.launch.y)
                            break;
                        if (tox == ttmp.vl.v_launch2.x && toy == ttmp.vl.v_launch2.y)
                            break;
                    }
                    pline(_("%s away from you!"),
                          Tobjnam(otmp, _("suddenly roll")));
                    feeltrap(ttmp);
                    launch_obj(BOULDER, sx, sy, tox, toy, ROLL | LAUNCH_KNOWN);
                    return sobj_at(BOULDER, sx, sy) ? -1 : 0;
                }
                default:
                    break; /* boulder not affected by this trap */
                }
            }

            if (boulder_hits_pool(otmp, rx, ry, TRUE))
                continue;

            /*
             * Re-link at top of fobj chain so that pile order is preserved
             * when level is restored.
             */
            if (otmp != fobj()) {
                remove_object(otmp);
                place_object(otmp, otmp.ox, otmp.oy);
            }
            dopush(sx, sy, rx, ry, otmp, costly);
        } else {
            cannot_push_msg(otmp, sx, sy);
            return cannot_push(otmp, sx, sy);
        }
    }
    return 0;
    } finally { stack_pop($frame); }
}

/*
 *  still_chewing()
 *
 *  Chew on a wall, door, or boulder.  [What about statues?]
 *  Returns TRUE if still eating, FALSE when done.
 */
export function still_chewing(x, y) { /* int */
    let lev = levl()[x][y];
    let boulder = sobj_at(BOULDER, x, y);
    let digtxt = 0, dmgtxt = 0;

    if (svc.context.digging.down) /* not continuing prev dig (w/ pick-axe) */
        memset(addr_of(svc.context.digging), 0,
                      sizeof(struct_dig_info));

    if (!boulder
        && ((IS_OBSTRUCTED(lev.typ) && !may_dig(x, y))
            /* may_dig() checks W_NONDIGGABLE but doesn't handle iron bars */
            || (lev.typ == IRONBARS && (lev.flags & W_NONDIGGABLE)))) {
        You(_("hurt your teeth on the %s."),
            (lev.typ == IRONBARS)
                ? _("bars")
                : IS_TREE(lev.typ)
                    ? _("tree")
                    : _("hard stone"));
        nomul(0);
        return 1;
    } else if (lev.typ == IRONBARS
               && metallivorous(gy.youmonst.data) && u.uhunger > 1500) {
        /* finishing eating via 'morehungry()' doesn't handle choking */
        You(_("are too full to eat the bars."));
        nomul(0);
        return 1;
    } else if (!svc.context.digging.chew
               || svc.context.digging.pos.x != x
               || svc.context.digging.pos.y != y
               || !on_level(svc.context.digging.level, u.uz)) {
        svc.context.digging.down = FALSE;
        svc.context.digging.chew = TRUE;
        svc.context.digging.warned = FALSE;
        svc.context.digging.pos.x = x;
        svc.context.digging.pos.y = y;
        assign_level(svc.context.digging.level, u.uz);
        /* solid rock takes more work & time to dig through */
        svc.context.digging.effort =
            (IS_OBSTRUCTED(lev.typ) && !IS_TREE(lev.typ) ? 30 : 60) + u.udaminc;
        You(_("start chewing %s %s."),
            (boulder || IS_TREE(lev.typ) || lev.typ == IRONBARS)
                ? _("on a")
                : _("a hole in the"),
            boulder
                ? _("boulder")
                : IS_TREE(lev.typ)
                    ? _("tree")
                    : IS_OBSTRUCTED(lev.typ)
                        ? _("rock")
                        : (lev.typ == IRONBARS)
                            ? _("bar")
                            : _("door"));
        watch_dig(null, x, y, FALSE);
        return 1;
    } else if ((svc.context.digging.effort += (30 + u.udaminc)) <= 100) {
        if (flags.verbose)
            You(_("%s chewing on the %s."),
                svc.context.digging.chew ? _("continue") : _("begin"),
                boulder
                    ? _("boulder")
                    : IS_TREE(lev.typ)
                        ? _("tree")
                        : IS_OBSTRUCTED(lev.typ)
                            ? _("rock")
                            : (lev.typ == IRONBARS)
                                ? _("bars")
                                : _("door"));
        svc.context.digging.chew = TRUE;
        watch_dig(null, x, y, FALSE);
        return 1;
    }

    /* Okay, you've chewed through something */
    if (!u.uconduct.food++)
        livelog_printf(LL_CONDUCT,
                       _("ate for the first time, by chewing through %s"),
                       boulder ? _("a boulder")
                       : IS_TREE(lev.typ) ? _("a tree")
                         : IS_OBSTRUCTED(lev.typ) ? _("rock")
                           : (lev.typ == IRONBARS) ? _("iron bars")
                             : _("a door"));
    u.uhunger += rnd(20);

    if (boulder) {
        delobj(boulder);         /* boulder goes bye-bye */
        You(_("eat the boulder.")); /* yum */

        /*
         *  The location could still block because of
         *      1. More than one boulder
         *      2. Boulder stuck in a wall/stone/door.
         *
         *  [perhaps use does_block() below (from vision.c)]
         */
        if (IS_OBSTRUCTED(lev.typ) || closed_door(x, y)
            || sobj_at(BOULDER, x, y)) {
            block_point(x, y); /* delobj will unblock the point */
            /* reset dig state */
            memset(addr_of(svc.context.digging), 0,
                          sizeof(struct_dig_info));
            return 1;
        }
    } else if (IS_WALL(lev.typ)) {
        if (chars[in_rooms(x, y, SHOPBASE)]) {
            add_damage(x, y, SHOP_WALL_DMG());
            dmgtxt = _("damage");
        }
        digtxt = _("chew a hole in the wall.");
        if (svl.level.flags.is_maze_lev) {
            lev.typ = ROOM;
        } else if (svl.level.flags.is_cavernous_lev && !in_town(x, y)) {
            lev.typ = CORR;
        } else {
            lev.typ = DOOR;
            lev.flags = D_NODOOR;
        }
    } else if (IS_TREE(lev.typ)) {
        digtxt = _("chew through the tree.");
        lev.typ = ROOM;
    } else if (lev.typ == IRONBARS) {
        if (metallivorous(gy.youmonst.data)) { /* should always be True here */
            /* arbitrary amount; unlike proper eating, nutrition is
               bestowed in a lump sum at the end */
            let nut = int((objects[HEAVY_IRON_BALL].oc_weight));

            /* lesshungry() requires that victual be set up, so skip it;
               morehungry() of a negative amount will increase nutrition
               without any possibility of choking to death on the meal;
               updates hunger state and requests status update if changed */
            morehungry(-nut);
        }
        digtxt = u_at(x, y)
                 ? _("devour the iron bars.")
                 : _("eat through the bars.");
        dissolve_bars(x, y);
    } else if (lev.typ == SDOOR) {
        if (lev.flags & D_TRAPPED) {
            lev.flags = D_NODOOR;
            b_trapped(_("secret door"), NO_PART);
        } else {
            digtxt = _("chew through the secret door.");
            lev.flags = D_BROKEN;
        }
        lev.typ = DOOR;
    } else if (IS_DOOR(lev.typ)) {
        if (chars[in_rooms(x, y, SHOPBASE)]) {
            add_damage(x, y, SHOP_DOOR_COST);
            dmgtxt = _("break");
        }
        if (lev.flags & D_TRAPPED) {
            lev.flags = D_NODOOR;
            b_trapped(_("door"), NO_PART);
        } else {
            digtxt = _("chew through the door.");
            lev.flags = D_BROKEN;
        }
    } else { /* STONE or SCORR */
        digtxt = _("chew a passage through the rock.");
        lev.typ = CORR;
    }

    recalc_block_point(x, y); /* vision */
    newsym(x, y);
    if (digtxt)
        You1(digtxt); /* after newsym */
    if (dmgtxt)
        pay_for_damage(dmgtxt, FALSE);
    memset(addr_of(svc.context.digging), 0,
                  sizeof(struct_dig_info));
    return 0;
}

export function movobj(obj, ox, oy) { /* void */
    /* optimize by leaving on the fobj chain? */
    remove_object(obj);
    maybe_unhide_at(obj.ox, obj.oy);
    newsym(obj.ox, obj.oy);
    place_object(obj, ox, oy);
    newsym(ox, oy);
}

function dosinkfall() { /* void */
    let fell_on_sink = init_string(static_array("dosinkfall.fell_on_sink", char, sizeof_string("fell onto a sink")), _("fell onto a sink"), true);
    let obj;
    let dmg;
    let lev_boots = (uarmf && uarmf.otyp == LEVITATION_BOOTS ? 1 : 0),
            innate_lev = +((HLevitation() & (FROMOUTSIDE | FROMFORM)) != 0),

            blockd_lev = +(BLevitation() == I_SPECIAL),
            ufall = +(!innate_lev && !blockd_lev
                     && !(HFlying() || EFlying())); /* BFlying */

    if (!ufall) {
        You((innate_lev || blockd_lev) ? _("wobble unsteadily for a moment.")
                                       : _("gain control of your flight."));
    } else {
        let save_ELev = ELevitation(), save_HLev = HLevitation();

        /* fake removal of levitation in advance so that final
           disclosure will be right in case this turns out to
           be fatal; fortunately the fact that rings and boots
           are really still worn has no effect on bones data */
        u.uprops[LEVITATION].extrinsic = u.uprops[LEVITATION].intrinsic = 0;
        You(_("crash to the floor!"));
        dmg = (rn2(8) + (25 - ACURR(A_CON)));
        losehp(Maybe_Half_Phys(dmg), fell_on_sink, NO_KILLER_PREFIX);
        exercise(A_DEX, FALSE);
        selftouch(_("Falling, you"));
        for (obj = svl.level.objects[u.ux][u.uy]; obj; obj = obj.v.v_nexthere)
            if (obj.oclass == WEAPON_CLASS || is_weptool(obj)) {
                You(_("fell on %s."), doname(obj));
                losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(3)) + 1) / 2))) : (rnd(3))), fell_on_sink,
                       NO_KILLER_PREFIX);
                exercise(A_CON, FALSE);
            }
        u.uprops[LEVITATION].extrinsic = save_ELev;
        u.uprops[LEVITATION].intrinsic = save_HLev;
    }

    /*
     * Interrupt multi-turn putting on/taking off of armor (in which
     * case we reached the sink due to being teleported while busy;
     * in 3.4.3, Boots_on()/Boots_off() [called via (*afternmv)() when
     * 'multi' reaches 0] triggered a crash if we were donning/doffing
     * levitation boots [because the Boots_off() below causes 'uarmf'
     * to be null by the time 'afternmv' gets called]).
     *
     * Interrupt donning/doffing if we fall onto the sink, or if the
     * code below is going to remove levitation boots even when we
     * haven't fallen (innate floating or flying becoming unblocked).
     */
    if (ufall || lev_boots) {
        stop_donning(lev_boots ? uarmf : null);
        /* recalculate in case uarmf just got set to null */
        lev_boots = (uarmf && uarmf.otyp == LEVITATION_BOOTS ? 1 : 0);
    }

    /* remove worn levitation items */
    u.uprops[LEVITATION].extrinsic = and64(u.uprops[LEVITATION].extrinsic, ~W_ARTI);
    u.uprops[LEVITATION].intrinsic = and64(u.uprops[LEVITATION].intrinsic, ~(I_SPECIAL | TIMEOUT));
    u.uprops[LEVITATION].intrinsic++;
    if (uleft && uleft.otyp == RIN_LEVITATION) {
        obj = uleft;
        Ring_off(obj);
        off_msg(obj);
    }
    if (uright && uright.otyp == RIN_LEVITATION) {
        obj = uright;
        Ring_off(obj);
        off_msg(obj);
    }
    if (lev_boots) {
        obj = uarmf;
        Boots_off();
        off_msg(obj);
    }
    u.uprops[LEVITATION].intrinsic--;
    /* probably moot; we're either still levitating or went
       through float_down(), but make sure BFlying is up to date */
    float_vs_flight();
}

/* intended to be called only on ROCKs or TREEs */
export function may_dig(x, y) { /* boolean */
    let lev = levl()[x][y];

    return (+!((IS_STWALL(lev.typ) || IS_TREE(lev.typ))
                       && (lev.flags & W_NONDIGGABLE)));
}

export function may_passwall(x, y) { /* boolean */
    return (+!(IS_STWALL(levl()[x][y].typ)
                       && (levl()[x][y].flags & W_NONPASSWALL)));
}

export function bad_rock(mdat, x, y) { /* boolean */
    return ((Sokoban() && sobj_at(BOULDER, x, y))
                      || (IS_OBSTRUCTED(levl()[x][y].typ)
                          && (!tunnels(mdat) || needspick(mdat)
                              || !may_dig(x, y))
                          && !(passes_walls(mdat) && may_passwall(x, y))) ? 1 : 0);
}

/* caller has already decided that it's a tight diagonal; check whether a
   monster--who might be the hero--can fit through, and if not then return
   the reason why:  1: can't fit, 2: possessions won't fit, 3: sokoban
   returns 0 if we can squeeze through */
export function cant_squeeze_thru(mon) { /* int */
    let amt;
    let ptr = mon.data;

    if ((mon == gy.youmonst) ? Passes_walls() : passes_walls(ptr))
        return 0;

    /* too big? */
    if (bigmonst(ptr)
        && !(amorphous(ptr) || is_whirly(ptr) || noncorporeal(ptr)
             || slithy(ptr) || can_fog(mon)))
        return 1;

    /* lugging too much junk? */
    amt = (mon == gy.youmonst) ? inv_weight() + weight_cap()
                               : curr_mon_load(mon);
    if (amt > WT_TOOMUCH_DIAGONAL)
        return 2;

    /* Sokoban restriction applies to hero only */
    if (mon == gy.youmonst && Sokoban())
        return 3;

    /* can squeeze through */
    return 0;
}

export function invocation_pos(x, y) { /* boolean */
    return (Invocation_lev(u.uz)
                      && x == svi.inv_pos.x && y == svi.inv_pos.y ? 1 : 0);
}

/* return TRUE if (ux+dx,uy+dy) is an OK place to move;
   mode is one of DO_MOVE, TEST_MOVE, TEST_TRAV, or TEST_TRAP */
export function test_move(
    ux, uy,
    dx, dy,
    mode) { /* boolean */
    const $frame = stack_frame(); try {
    let $goto = null; var buf = stack_array(char, BUFSZ);
    var x = ux + dx;
    var y = uy + dy;
    var tmpr;
    var ust;

    svc.context.door_opened = FALSE;

    if (!isok(x, y))
        return FALSE;

    tmpr = levl()[x][y];

    /*
     *  Check for physical obstacles.  First, the place we are going.
     */
    if (IS_OBSTRUCTED(tmpr.typ) || tmpr.typ == IRONBARS) {
        if (Blind() && mode == DO_MOVE)
            feel_location(x, y);
        if (Passes_walls() && may_passwall(x, y)) {
            ; /* do nothing */
        } else if (Underwater()) {
            /* note: if water_friction() changes direction due to
               turbulence, new target destination will always be water,
               so we won't get here, hence don't need to worry about
               "there" being somewhere the player isn't sure of */
            if (mode == DO_MOVE)
                There(_("is an obstacle there."));
            return FALSE;
        } else if (tmpr.typ == IRONBARS) {
            if (mode == DO_MOVE
                && (dmgtype(gy.youmonst.data, AD_RUST)
                    || dmgtype(gy.youmonst.data, AD_CORR)
                    || metallivorous(gy.youmonst.data))
                && still_chewing(x, y)) {
                return FALSE;
            }
            if (!(Passes_walls() || passes_bars(gy.youmonst.data))) {
                if (mode == DO_MOVE && flags.mention_walls)
                    You(_("cannot pass through the bars."));
                return FALSE;
            }
        } else if (tunnels(gy.youmonst.data)
                   && !needspick(gy.youmonst.data)) {
            /* Eat the rock. */
            if (mode == DO_MOVE && still_chewing(x, y))
                return FALSE;
        } else if (flags.autodig && !svc.context.run && !svc.context.nopick
                   && uwep && is_pick(uwep)) {
            /* MRKR: Automatic digging when wielding the appropriate tool */
            if (mode == DO_MOVE)
                use_pick_axe2(uwep);
            return FALSE;
        } else {
            if (mode == DO_MOVE) {
                if (is_db_wall(x, y)) {
                    pline(_("That drawbridge is up!"));
                } else if (Passes_walls() && !may_passwall(x, y)
                           && In_sokoban(u.uz)) {
                    /* soko restriction stays even after puzzle is solved */
                    pline_The(_("Sokoban walls resist your ability."));
                } else if (flags.mention_walls) {
                    var glyph = back_to_glyph(x, y),
                        sym = glyph_is_cmap(glyph) ? glyph_to_cmap(glyph)
                                                   : -1;

                    if (sym == S_stone)
                        strcpy(buf, _("solid stone"));
                    else if (sym >= 0)
                        strcpy(buf, an(defsyms[sym].explanation));
                    else
                        sprintf(buf, _("impossible [background glyph=%d]"), glyph)
;
                    pline_dir(xytodir(dx, dy), _("It's %s."), buf);
                }
            }
            return FALSE;
        }
    } else if (IS_DOOR(tmpr.typ)) {
        $goto_testdiag: for (;;) { switch ($goto) { default: case "testdiag": if (!$goto && (closed_door(x, y))) {
            if (Blind() && mode == DO_MOVE)
                feel_location(x, y);
            if (Passes_walls()) {
                ; /* do nothing */
            } else if (can_ooze(gy.youmonst)) {
                if (mode == DO_MOVE)
                    You(_("ooze under the door."));
            } else if (Underwater()) {
                if (mode == DO_MOVE)
                    pline(_("There is an obstacle there."));
                return FALSE;
            } else if (tunnels(gy.youmonst.data)
                       && !needspick(gy.youmonst.data)) {
                /* Eat the door. */
                if (mode == DO_MOVE && still_chewing(x, y))
                    return FALSE;
            } else {
                if (mode == DO_MOVE) {
                    if (amorphous(gy.youmonst.data))
                        You(_("try to ooze under the door," +
                            " but can't squeeze your possessions through."));
                    if (flags.autoopen && !svc.context.run
                        && !Confusion() && !Stunned() && !Fumbling()) {
                        var tmp = doopen_indir(x, y);
                        /* if 'autounlock' includes Kick, we might have a
                           kick at the door queued up after doopen_indir() */
                        var cq = cmdq_peek(CQ_CANNED);

                        if (tmp == ECMD_OK && cq && cq.typ == CMDQ_EXTCMD
                            && cq.ec_entry == ext_func_tab_from_func(dokick))
                            /* door hasn't been opened, but fake it so that
                               canned kick will be executed as next command */
                            svc.context.door_opened = TRUE;
                        else
                            svc.context.door_opened = +!closed_door(x, y);
                        svc.context.move = +(ux != u.ux || uy != u.uy);
                    } else if (x == ux || y == uy) {
                        if (Blind() || Stunned() || ACURR(A_DEX) < 10
                            || Fumbling()) {
                            if (u.usteed) {
                                You_cant(_("lead %s through that closed door."),
                                         y_monnam(u.usteed));
                            } else {
                                pline(_("Ouch!  You bump into a door."));
                                exercise(A_DEX, FALSE);
                            }
                            /* use current move; needed for the "ouch" case
                               but done for steed case too for consistency;
                               we haven't opened a door but we're going to
                               return False and without having 'door_opened'
                               set, 'move' would get reset by caller */
                            svc.context.door_opened = svc.context.move = TRUE;
                            /* since we've just lied about successfully
                               moving, we need to manually stop running */
                            nomul(0);
                        } else
                            pline(_("That door is closed."));
                    }
                } else if (mode == TEST_TRAV || mode == TEST_TRAP)
                    { $goto = "testdiag"; continue $goto_testdiag; };
                return FALSE;
            }
        } else {
 $goto = null;
            if (dx && dy && !Passes_walls()
                && (!doorless_door(x, y) || block_door(x, y))) {
                /* Diagonal moves into a door are not allowed. */
                if (mode == DO_MOVE) {
                    if (Blind())
                        feel_location(x, y);
                    if (Underwater() || flags.mention_walls)
                        You_cant(_("move diagonally into an intact doorway."));
                }
                return FALSE;
            }
        } } break; }
    }
    if (dx && dy && bad_rock(gy.youmonst.data, ux, y)
        && bad_rock(gy.youmonst.data, x, uy)) {
        /* Move at a diagonal. */
        switch (cant_squeeze_thru(gy.youmonst)) {
        case 3:
            if (mode == DO_MOVE)
                You(_("cannot pass that way."));
            return FALSE;
        case 2:
            if (mode == DO_MOVE)
                You(_("are carrying too much to get through."));
            return FALSE;
        case 1:
            if (mode == DO_MOVE)
                Your(_("body is too large to fit through."));
            return FALSE;
        default:
            break; /* can squeeze through */
        }
    } else if (dx && dy && worm_cross(ux, uy, x, y)) {
        /* consecutive long worm segments are at <ux,y> and <x,uy> */
        if (mode == DO_MOVE)
            pline(_("%s is in your way."), YMonnam(m_at(ux, y)));
        return FALSE;
    }
    /* Pick travel path that does not require crossing a trap.
     * Avoid water and lava using the usual running rules.
     * (but not u.ux/u.uy because findtravelpath walks toward u.ux/u.uy) */
    if (svc.context.run == 8 && (mode != DO_MOVE) && !u_at(x, y)) {
        var t = t_at(x, y);

        if (t && t.tseen && t.ttyp != VIBRATING_SQUARE)
            return +(mode == TEST_TRAP);

        /* FIXME: should be using lastseentyp[x][y] rather than seen vector
         */
        if ((levl()[x][y].seenv && is_pool_or_lava(x, y)) /* known pool/lava */
            && ((IS_WATERWALL(levl()[x][y].typ) /* never enter wall of liquid */
                 || levl()[x][y].typ == LAVAWALL)
                /* don't enter pool or lava (must be one of the two to
                   get here) unless flying or levitating or have known
                   water-walking for pool or known lava-walking and
                   already be on/over lava for lava */
                || !(Levitation() || Flying()
                     || (is_pool(x, y) ? Known_wwalking()
                         : (Known_lwalking() && is_lava(u.ux, u.uy))))))
            return +(mode == TEST_TRAP);
    }

    if (mode == TEST_TRAP)
        return FALSE; /* do not move through traps */

    ust = levl()[ux][uy];

    /* Now see if other things block our way . . */
    if (dx && dy && !Passes_walls() && IS_DOOR(ust.typ)
        && (!doorless_door(ux, uy) || block_entry(x, y))) {
        /* Can't move at a diagonal out of a doorway with door. */
        if (mode == DO_MOVE && flags.mention_walls)
            You_cant(_("move diagonally out of an intact doorway."));
        return FALSE;
    }

    if (sobj_at(BOULDER, x, y) && (Sokoban() || !Passes_walls())) {
        if (mode != TEST_TRAV && svc.context.run >= 2
            && !(Blind() || Hallucination()) && !could_move_onto_boulder(x, y)) {
            if (mode == DO_MOVE && flags.mention_walls)
                pline_dir(xytodir(dx,dy), _("A boulder blocks your path."));
            return FALSE;
        }
        if (mode == DO_MOVE) {
            /* tunneling monsters will chew before pushing */
            if (tunnels(gy.youmonst.data) && !needspick(gy.youmonst.data)
                && !Sokoban()) {
                if (still_chewing(x, y))
                    return FALSE;
            } else if (moverock() < 0)
                return FALSE;
        } else if (mode == TEST_TRAV) {
            var obj;

            /* never travel through boulders in Sokoban */
            if (Sokoban())
                return FALSE;

            /* don't pick two boulders in a row, unless there's a way thru */
            if (sobj_at(BOULDER, ux, uy) && !Sokoban()) {
                if (!Passes_walls()
                    && !could_move_onto_boulder(ux, uy)
                    && !(tunnels(gy.youmonst.data)
                         && !needspick(gy.youmonst.data))
                    && !carrying(PICK_AXE) && !carrying(DWARVISH_MATTOCK)
                    && !((obj = carrying(WAN_DIGGING))
                         && !objects[obj.otyp].oc_name_known))
                    return FALSE;
            }
        }
        /* assume you'll be able to push it when you get there... */
    }

    /* OK, it is a legal place to move. */
    return TRUE;
    } finally { stack_pop($frame); }
}

/*
 * Find a path from the destination (u.tx,u.ty) back to (u.ux,u.uy).
 * A shortest path is returned.  If guess is TRUE, consider various
 * inaccessible locations as valid intermediate path points.
 * Returns TRUE if a path was found.
 * gt.travelmap keeps track of map locations we've moved through
 * this travel session. It will be cleared once the travel stops.
 */
function findtravelpath(mode) { /* boolean */
    const $frame = stack_frame(); try {
    if (!gt.travelmap)
        gt.travelmap = selection_new();
    /* if travel to adjacent, reachable location, use normal movement rules */
    if ((mode == TRAVP_TRAVEL || mode == TRAVP_VALID) && svc.context.travel1
        /* was '&& distmin(u.ux, u.uy, u.tx, u.ty) == 1' */
        && next2u(u.tx, u.ty) /* one step away */
        /* handle restricted diagonals */
        && crawl_destination(u.tx, u.ty)) {
        end_running(FALSE);
        if (test_move(u.ux, u.uy, u.tx - u.ux, u.ty - u.uy, TEST_MOVE)) {
            if (mode == TRAVP_TRAVEL) {
                u.dx = u.tx - u.ux;
                u.dy = u.ty - u.uy;
                nomul(0);
                iflags.travelcc.x = iflags.travelcc.y = 0;
            }
            return TRUE;
        }
        if (mode == TRAVP_TRAVEL)
            svc.context.run = 8;
    }
    found: { if (u.tx != u.ux || u.ty != u.uy) {
        var travel = stack_array(array_of(short, ROWNO), COLNO);
        var travelstepx = stack_array(array_of(short, COLNO * ROWNO), 2);
        var travelstepy = stack_array(array_of(short, COLNO * ROWNO), 2);
        var tx, ty, ux, uy;
        var n = 1;      /* max offset in travelsteps */
        var set = 0;    /* two sets current and previous */
        var radius = 1; /* search radius */
        var i;

        /* If guessing, first find an "obvious" goal location.  The obvious
         * goal is the position the player knows of, or might figure out
         * (couldsee) that is closest to the target on a straight path.
         */
        if (mode == TRAVP_GUESS || mode == TRAVP_VALID) {
            tx = u.ux;
            ty = u.uy;
            ux = u.tx;
            uy = u.ty;
        } else {
            tx = u.tx;
            ty = u.ty;
            ux = u.ux;
            uy = u.uy;
        }

 noguess: for (;;) {
        memset(addr_of(travel), 0, sizeof(array_of(array_of(short, ROWNO), COLNO)));
        travelstepx[0][0] = tx;
        travelstepy[0][0] = ty;

        while (n != 0) {
            var nn = 0;

            for (i = 0; i < n; i++) {
                var dir;
                var x = travelstepx[set][i];
                var y = travelstepy[set][i];
                /* no diagonal movement for grid bugs */
                var dirmax = NODIAG(u.umonnum) ? 4 : N_DIRS;
                var alreadyrepeated = FALSE;

                for (dir = 0; dir < dirmax; ++dir) {
                    var nx = x + chars[xdir + (chars[dirs_ord + dir])];
                    var ny = y + chars[ydir + (chars[dirs_ord + dir])];

                    /*
                     * When guessing and trying to travel as close as possible
                     * to an unreachable target space, don't include spaces
                     * that would never be picked as a guessed target in the
                     * travel matrix describing hero-reachable spaces.
                     * This stops travel from getting confused and moving
                     * the hero back and forth in certain degenerate
                     * configurations of sight-blocking obstacles, e.g.
                     *
                     *  T         1. Dig this out and carry enough to not be
                     *   ####       able to squeeze through diagonal gaps.
                     *   #--.---    Stand at @ and target travel at space T.
                     *    @.....
                     *    |.....
                     *
                     *  T         2. couldsee() marks spaces marked a and x
                     *   ####       as eligible guess spaces to move the hero
                     *   a--.---    towards.  Space a is closest to T, so it
                     *    @xxxxx    gets chosen.  Travel system moves @ right
                     *    |xxxxx    to travel to space a.
                     *
                     *  T         3. couldsee() marks spaces marked b, c and x
                     *   ####       as eligible guess spaces to move the hero
                     *   a--c---    towards.  Since findtravelpath() is called
                     *    b@xxxx    repeatedly during travel, it doesn't
                     *    |xxxxx    remember that it wanted to go to space a,
                     *              so in comparing spaces b and c, b is
                     *              chosen, since it seems like the closest
                     *              eligible space to T. Travel system moves @
                     *              left to go to space b.
                     *
                     *            4. Go to 2.
                     *
                     * By limiting the travel matrix here, space a in the
                     * example above is never included in it, preventing
                     * the cycle.
                     */
                    if (!isok(nx, ny)
                        || ((mode == TRAVP_GUESS) && !couldsee(nx, ny)))
                        continue;
                    if ((!Passes_walls() && !can_ooze(gy.youmonst)
                         && closed_door(x, y))
                        || (sobj_at(BOULDER, x, y)
                            && !could_move_onto_boulder(x, y))
                        || test_move(x, y, nx - x, ny - y, TEST_TRAP)) {
                        /* closed doors and boulders usually cause a delay,
                           so prefer another path; however, giants and tiny
                           creatures can use m<dir> to move onto a boulder's
                           spot without pushing, so allow boulders for them */
                        if (travel[x][y] > radius - 3) {
                            if (!alreadyrepeated) {
                                travelstepx[1 - set][nn] = x;
                                travelstepy[1 - set][nn] = y;
                                /* don't change travel matrix! */
                                nn++;
                                alreadyrepeated = TRUE;
                            }
                            continue;
                        }
                    }
                    if (test_move(x, y, nx - x, ny - y, TEST_TRAV)
                        && (levl()[nx][ny].seenv
                            || (!Blind() && couldsee(nx, ny)))) {
                        if (nx == ux && ny == uy) {
                            if (mode == TRAVP_TRAVEL || mode == TRAVP_VALID) {
                                var visited = selection_getpoint(x, y, gt.travelmap);

                                u.dx = x - ux;
                                u.dy = y - uy;
                                if (mode == TRAVP_TRAVEL
                                    && ((x == u.tx && y == u.ty)
                                        || visited)) {
                                    nomul(0);
                                    /* reset run so domove run checks work */
                                    svc.context.run = 8;
                                    if (visited)
                                        You(_("stop, unsure which way to go."));
                                    else
                                        iflags.travelcc.x
                                        = iflags.travelcc.y = 0;
                                }
                                selection_setpoint(u.ux, u.uy,
                                                   gt.travelmap, 1);
                                return TRUE;
                            }
                        } else if (!travel[nx][ny]) {
                            travelstepx[1 - set][nn] = nx;
                            travelstepy[1 - set][nn] = ny;
                            travel[nx][ny] = radius;
                            nn++;
                        }
                    }
                }
            }

            if (iflags.trav_debug) {
                /* Use of warning glyph is arbitrary. It stands out. */
                tmp_at(DISP_ALL, warning_to_glyph(1));
                for (i = 0; i < nn; ++i) {
                    tmp_at(travelstepx[1 - set][i], travelstepy[1 - set][i]);
                }
                nh_delay_output()();
                if (flags.runmode == RUN_CRAWL) {
                    nh_delay_output()();
                    nh_delay_output()();
                }
                tmp_at(DISP_END, 0);
            }

            n = nn;
            set = 1 - set;
            radius++;
        }

        /* if guessing, find best location in travel matrix and go there */
        if (mode == TRAVP_GUESS) {
            var px = tx, py = ty; /* pick location */
            var dist, nxtdist, d2, nd2;
            var ctrav, ptrav = COLNO*ROWNO;

            dist = distmin(ux, uy, tx, ty);
            d2 = dist2(ux, uy, tx, ty);
            for (tx = 1; tx < COLNO; ++tx)
                for (ty = 0; ty < ROWNO; ++ty)
                    if (couldsee(tx, ty) && (ctrav = travel[tx][ty]) > 0) {
                        nxtdist = distmin(ux, uy, tx, ty);
                        if (nxtdist == dist && ctrav < ptrav) {
                            nd2 = dist2(ux, uy, tx, ty);
                            if (nd2 < d2) {
                                /* prefer non-zigzag path */
                                px = tx;
                                py = ty;
                                d2 = nd2;
                                ptrav = ctrav;
                            }
                        } else if (nxtdist < dist) {
                            px = tx;
                            py = ty;
                            dist = nxtdist;
                            d2 = dist2(ux, uy, tx, ty);
                            ptrav = ctrav;
                        }
                    }

            if (u_at(px, py)) {
                /* no guesses, just go in the general direction */
                u.dx = sgn(u.tx - u.ux);
                u.dy = sgn(u.ty - u.uy);
                if (test_move(u.ux, u.uy, u.dx, u.dy, TEST_MOVE)) {
                    selection_setpoint(u.ux, u.uy, gt.travelmap, 1);
                    return TRUE;
                }
                break found;
            }

            if (iflags.trav_debug) {
                /* Use of warning glyph is arbitrary. It stands out. */
                tmp_at(DISP_ALL, warning_to_glyph(2));
                tmp_at(px, py);
                nh_delay_output()();
                if (flags.runmode == RUN_CRAWL) {
                    nh_delay_output()();
                    nh_delay_output()();
                    nh_delay_output()();
                    nh_delay_output()();
                }
                tmp_at(DISP_END, 0);
            }

            tx = px;
            ty = py;
            ux = u.ux;
            uy = u.uy;
            set = 0;
            n = radius = 1;
            mode = TRAVP_TRAVEL;
            continue noguess;
        } break; }
        return FALSE;
    }
 }
    u.dx = 0;
    u.dy = 0;
    nomul(0);
    return FALSE;
    } finally { stack_pop($frame); }
}

export function is_valid_travelpt(x, y) { /* boolean */
    let tx = u.tx;
    let ty = u.ty;
    let ret;
    let glyph = glyph_at(x,y);

    if (u_at(x, y))
        return TRUE;
    if (isok(x,y) && glyph_is_cmap(glyph) && S_stone == glyph_to_cmap(glyph)
        && !levl()[x][y].seenv)
        return FALSE;
    u.tx = x;
    u.ty = y;
    ret = findtravelpath(TRAVP_VALID);
    u.tx = tx;
    u.ty = ty;
    return ret;
}

/* try to escape being stuck in a trapped state by walking out of it;
   return true iff moving should continue to intended destination
   (all failures and most successful escapes leave hero at original spot) */
function trapmove(
    x, y,
    desttrap) { /* boolean */ /* nonnull if another trap at <x,y> */
    const $frame = stack_frame(); try {
    let $goto = null; var cc = stack_struct(struct_nhcoord);
    var anchored = FALSE;
    var predicament, culprit;
    var steedname = !u.usteed ? 0 : y_monnam(u.usteed);

    if (!u.utrap)
        return TRUE; /* sanity check */

    /*
     * Note: caller should call reset_utrap() when we set u.utrap to 0.
     */

    $goto_wriggle_free: for (;;) { switch ($goto || (u.utraptype)) {
    case TT_BEARTRAP:
        if (flags.verbose) {
            predicament = _("caught in a bear trap");
            if (u.usteed)
                Norep(_("%s is %s."), upstart(steedname), predicament);
            else
                Norep(_("You are %s."), predicament);
        }
        /* [why does diagonal movement give quickest escape?] */
        if ((u.dx && u.dy) || !rn2(5))
            u.utrap--;
        if (!u.utrap)
            { $goto = "wriggle_free"; continue $goto_wriggle_free; };
        break;
    case TT_PIT:
        if (desttrap && desttrap.tseen
            && is_pit(desttrap.ttyp))
            return TRUE; /* move into adjacent pit */
        /* try to escape; position stays same regardless of success */
        climb_pit();
        break;
    case TT_WEB:
        if (u_wield_art(ART_STING)) {
            /* escape trap but don't move and don't destroy it */
            u.utrap = 0; /* caller will call reset_utrap() */
            pline(_("Sting cuts through the web!"));
            break;
        }
        if (--u.utrap) {
            if (flags.verbose) {
                predicament = _("stuck to the web");
                if (u.usteed)
                    Norep(_("%s is %s."), upstart(steedname), predicament);
                else
                    Norep(_("You are %s."), predicament);
            }
        } else {
            if (u.usteed)
                pline(_("%s breaks out of the web."), upstart(steedname));
            else
                You(_("disentangle yourself."));
        }
        break;
    case TT_LAVA:
        if (flags.verbose) {
            predicament = _("stuck in the lava");
            if (u.usteed)
                Norep(_("%s is %s."), upstart(steedname), predicament);
            else
                Norep(_("You are %s."), predicament);
        }
        if (!is_lava(x, y)) {
            u.utrap--;
            if ((u.utrap & 0xff) == 0) {
                u.utrap = 0;
                if (u.usteed)
                    You(_("lead %s to the edge of the %s."), steedname,
                        hliquid(_("lava")));
                else
                    You(_("pull yourself to the edge of the %s."),
                        hliquid(_("lava")));
            }
        }
        u.umoved = TRUE;
        break;
    case TT_INFLOOR:
    case TT_BURIEDBALL:
        anchored = +(u.utraptype == TT_BURIEDBALL);
        if (anchored) {
            cc.x = u.ux, cc.y = u.uy;
            /* can move normally within radius 1 of buried ball */
            if (buried_ball(cc) && dist2(x, y, cc.x, cc.y) <= 2) {
                /* ugly hack: we need to issue some message here
                   in case "you are chained to the buried ball"
                   was the most recent message given, otherwise
                   our next attempt to move out of tether range
                   after this successful move would have its
                   can't-do-that message suppressed by Norep */
                if (flags.verbose)
                    Norep(_("You move within the chain's reach."));
                return TRUE;
            }
        }
        case "wriggle_free": if (!$goto && (--u.utrap)) {
            if (flags.verbose) {
                if (anchored) {
                    predicament = _("chained to the");
                    culprit = _("buried ball");
                } else {
                    predicament = _("stuck in the");
                    culprit = surface(u.ux, u.uy);
                }
                if (u.usteed) {
                    if (anchored)
                        Norep(_("You and %s are %s %s."), steedname, predicament,
                              culprit);
                    else
                        Norep(_("%s is %s %s."), upstart(steedname), predicament,
                              culprit);
                } else
                    Norep(_("You are %s %s."), predicament, culprit);
            }
        } else {
 $goto = null;
            if (u.usteed)
                pline(_("%s finally %s free."), upstart(steedname),
                      !anchored ? _("lurches") : _("wrenches the ball"));
            else
                You(_("finally %s free."),
                    !anchored ? _("wriggle") : _("wrench the ball"));
            if (anchored)
                buried_ball_to_punishment();
        }
        break;
    case TT_NONE:
        impossible(_("trapmove: trapped in nothing?"));
        break;
    default:
        impossible(_("trapmove: stuck in unknown trap? (%d)"),
                   int(u.utraptype));
        break;
    } break; }
    return FALSE;
    } finally { stack_pop($frame); }
}

export function u_rooted() { /* boolean */
    if (!gy.youmonst.data.mmove) {
        You(_("are rooted %s."),
            Levitation() || Is_airlevel(u.uz) || Is_waterlevel(u.uz)
                ? _("in place")
                : _("to the ground"));
        nomul(0);
        return TRUE;
    }
    return FALSE;
}

export function notice_mon(mtmp) { /* void */
    if (a11y.mon_notices && !a11y.mon_notices_blocked) {
        let spot = (canspotmon(mtmp)
            && !(is_hider(mtmp.data)
                 && (mtmp.mundetected
                     || M_AP_TYPE(mtmp) == M_AP_FURNITURE
                     || M_AP_TYPE(mtmp) == M_AP_OBJECT)) ? 1 : 0);

        if (spot && !mtmp.mspotted && !DEADMONSTER(mtmp)) {
            mtmp.mspotted = TRUE;
            set_msg_xy(mtmp.mx, mtmp.my);
            You(_("%s %s."), canseemon(mtmp) ? _("see") : _("notice"),
                x_monnam(mtmp,
                     mtmp.mtame ? ARTICLE_YOUR
                     : (!has_mgivenname(mtmp)
                        && !type_is_pname(mtmp.data)) ? ARTICLE_A
                     : ARTICLE_NONE,
                     (mtmp.mpeaceful && !mtmp.mtame) ? _("peaceful") : 0,
                     has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0, FALSE));
        } else if (!spot) {
            mtmp.mspotted = FALSE;
        }
    }
}

function notice_mons_cmp(ptr1, ptr2) { /* int QSORTCALLBACK */
    let m1 = ref_to(ptr_to(struct_monst), ptr1)[0],
        m2 = ref_to(ptr_to(struct_monst), ptr2)[0];

    return (distu(m1.mx, m1.my) - distu(m2.mx, m2.my));
}

export function notice_all_mons(reset) { /* void */
    if (a11y.mon_notices && !a11y.mon_notices_blocked) {
        let mtmp;
        let arr = null;
        let j, i = 0, cnt = 0;

        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp))
                continue;
            if (canspotmon(mtmp))
                cnt++;
            else if (reset)
                mtmp.mspotted = FALSE;
        }
        if (!cnt)
            return;

        arr = ref_to(ptr_to(struct_monst), addr_of(alloc(unsigned(Math.imul(unsigned(cnt), sizeof(ptr_to(struct_monst)))))));

        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp))
                continue;
            if (!canspotmon(mtmp))
                mtmp.mspotted = FALSE;
            else if (i < cnt)
                arr[i++] = mtmp;
        }

        if (i) {
            qsort(addr_of(arr), unsigned(i), sizeof(ptr_to(struct_monst)),
                  notice_mons_cmp);

            for (j = 0; j < i; j++)
                notice_mon(arr[j]);
        }

        free(addr_of(arr));
    }
}

/* maybe disturb buried zombies when an object is dropped or thrown nearby */
export function impact_disturbs_zombies(obj, violent) { /* void */
    /* if object won't make a noticeable impact, let buried zombies rest */
    if (obj.owt < (violent ? 10 : 100) || is_flimsy(obj))
        return;

    disturb_buried_zombies(obj.ox, obj.oy);
}

/* reduce zombification timeout of buried zombies around px, py */
export function disturb_buried_zombies(x, y) { /* void */
    let otmp;
    let t;

    for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp.nobj) {
        if (otmp.otyp == CORPSE && otmp.timed
            && otmp.ox >= x - 1 && otmp.ox <= x + 1
            && otmp.oy >= y - 1 && otmp.oy <= y + 1
            && (t = peek_timer(ZOMBIFY_MON, obj_to_any(otmp))) > 0) {
            t = stop_timer(ZOMBIFY_MON, obj_to_any(otmp));
            start_timer(max(1, Math.trunc(t*2/3)), TIMER_OBJECT,
                               ZOMBIFY_MON, obj_to_any(otmp));
        }
    }
}

/* return an appropriate locomotion word for hero */
export function u_locomotion(def) { /* const char * */
    let capitalize = +(chars[def] == highc(chars[def]));

    /* regular locomotion() takes a monster type rather than a specific
       monster, so can't tell whether it is operating on hero;
       its is_flyer() and is_floater() tests wouldn't work on hero except
       when hero is polymorphed and not wearing an amulet of flying
       or boots/ring/spell of levitation */
    return Levitation() ? (capitalize ? _("Float") : _("float"))
           : Flying() ? (capitalize ? _("Fly") : _("fly"))
             : locomotion(gy.youmonst.data, def);
}

/* Return a simplified floor solid/liquid state based on hero's state */
function u_simple_floortyp(x, y) { /* schar */
    let u_in_air = (Levitation() || Flying() || !grounded(gy.youmonst.data) ? 1 : 0);

    if (is_waterwall(x, y))
        return WATER; /* wall of water, fly/lev does not matter */
    if (levl()[x][y].typ == LAVAWALL)
        return LAVAWALL; /* wall of lava, fly/lev does not matter */
    if (!u_in_air) {
        if (is_pool(x, y))
            return POOL;
        if (is_lava(x, y))
            return LAVAPOOL;
    }
    return ROOM;
}

/* maybe show a helpful gameplay tip? returns True if tip gets shown */
export function handle_tip(tip) { /* boolean */
    if (!flags.tips)
        return FALSE;

    if (tip >= 0 && tip < NUM_TIPS && !(svc.context.tips & (1 << tip))) {
        svc.context.tips = or64u(svc.context.tips, (1 << tip));
        /* the "Tip:" prefix is a hint to use of OPTIONS=!tips to suppress */
        switch (tip) {
        case TIP_ENHANCE:
            pline(_("(Tip: use the #enhance command to advance them.)"));
            break;
        case TIP_SWIM:
            pline(_("(Tip: use '%s' prefix to step in if you really want to.)"),
                  visctrl(cmd_from_func(do_reqmenu)));
            break;
        case TIP_UNTRAP_MON:
            pline(_("(Tip: perhaps #untrap would help?)"));
            break;
        case TIP_GETPOS:
            l_nhcore_call(NHCORE_GETPOS_TIP);
            break;
        default:
            impossible(_("Unknown tip in handle_tip(%i)"), tip);
            break;
        }
        return TRUE;
    }
    return FALSE;
}

/* Is it dangerous for hero to move to x,y due to water or lava? */
function swim_move_danger(x, y) { /* boolean */
    let newtyp = u_simple_floortyp(x, y);
    let liquid_wall = +(IS_WATERWALL(newtyp) || newtyp == LAVAWALL);

    if (Underwater() && (is_pool(x,y) || IS_WATERWALL(newtyp)))
        return FALSE;

    if ((newtyp != u_simple_floortyp(u.ux, u.uy))
        && !Stunned() && !Confusion() && levl()[x][y].seenv
        && (is_pool(x, y) || is_lava(x, y) || liquid_wall)) {
        /* FIXME: This can be exploited to identify ring of fire resistance
         * if the player is wearing it unidentified and has identified
         * fireproof boots of water walking and is walking over lava. However,
         * this is such a marginal case that it may not be worth fixing. */
        if ((is_pool(x, y) && !Known_wwalking())
            /* is_lava(ux,uy): don't move onto/over lava with known
               lava-walking because it isn't completely safe, but do
               continue to move over lava if already doing so */
            || (is_lava(x, y) && !Known_lwalking() && !is_lava(u.ux, u.uy))
            || liquid_wall) {
            if (svc.context.nopick) {
                /* moving with m-prefix */
                svc.context.tips = or64u(svc.context.tips, (1 << TIP_SWIM));
                return FALSE;
            } else if (ParanoidSwim() || liquid_wall) {
                You(_("avoid %s into the %s."),
                    ing_suffix(u_locomotion(_("step"))),
                    waterbody_name(x, y));
                handle_tip(TIP_SWIM);
                return TRUE;
            }
        }
    }
    return FALSE;
}

/* moving with 'm' prefix, bump into a monster? */
function domove_bump_mon(mtmp, glyph) { /* boolean */
    /* If they used a 'm' command, trying to move onto a monster
     * prints the below message and wastes a turn.  The exception is
     * if the monster is unseen and the player doesn't remember an
     * invisible monster--then, we fall through to do_attack() and
     * attack_check(), which still wastes a turn, but prints a
     * different message and makes the player remember the monster.
     */
    if (svc.context.nopick && !svc.context.travel
        && (canspotmon(mtmp) || glyph_is_invisible(glyph)
            || glyph_is_warning(glyph))) {
        if (M_AP_TYPE(mtmp) && !Protection_from_shape_changers()
            && !sensemon(mtmp))
            stumble_onto_mimic(mtmp);
        else if (mtmp.mpeaceful && !Hallucination())
            /* m_monnam(): "dog" or "Fido", no "invisible dog" or "it" */
            pline(_("Pardon me, %s."), m_monnam(mtmp));
        else
            You(_("move right into %s."), mon_nam(mtmp));
        return TRUE;
    }
    return FALSE;
}

/* hero is moving, do we maybe attack a monster at (x,y)?
   returns TRUE if hero movement is used up.
   sets displaceu, if hero and monster could swap places instead.
*/
function domove_attackmon_at(
    mtmp,
    x, y,
    displaceu) { /* boolean */
    /* assert(mtmp != NULL) */
    /* only attack if we know it's there
     * or if we used the 'F' command to fight blindly
     * or if it hides_under, in which case we call do_attack() to print
     * the Wait! message.
     * This is different from ceiling hiders, who aren't handled in
     * do_attack().
     */
    if (svc.context.forcefight || !mtmp.mundetected || sensemon(mtmp)
        || ((hides_under(mtmp.data) || mtmp.data.mlet == S_EEL)
            && !is_safemon(mtmp))) {
        /* target monster might decide to switch places with you... */
        chars[displaceu] = (mtmp.data == mons[PM_DISPLACER_BEAST] && !rn2(2)
                      && mtmp.mux == u.ux0 && mtmp.muy == u.uy0
                      && !helpless(mtmp)
                      && !mtmp.meating && !mtmp.mtrapped
                      && !u.utrap && !u.ustuck && !u.usteed
                      && !(u.dx && u.dy
                           && (NODIAG(u.umonnum)
                               || (bad_rock(mtmp.data, x, u.uy0)
                                   && bad_rock(mtmp.data, u.ux0, y))
                               || (bad_rock(gy.youmonst.data, u.ux0, y)
                                   && bad_rock(gy.youmonst.data, x, u.uy0))))
                      && goodpos(u.ux0, u.uy0, mtmp, GP_ALLOW_U) ? 1 : 0);
        /* if not displacing, try to attack; note that it might evade;
           also, we don't attack tame or peaceful when safemon() */
        if (!chars[displaceu]) {
            if (do_attack(mtmp))
                return TRUE;
        }
    }
    return FALSE;
}

/* force-fight iron bars with your weapon? */
function domove_fight_ironbars(x, y) { /* boolean */
    const $frame = stack_frame(); try {
    if (svc.context.forcefight && levl()[x][y].typ == IRONBARS && uwep) {
        let obj = stack_var(ptr_to(struct_obj), uwep);
        let breakflags = (BRK_BY_HERO | BRK_FROM_INV | BRK_MELEE);

        if (breaktest(obj[0])) {
            if (obj[0].quan > 1)
                obj[0] = splitobj(obj[0], 1);
            else
                setuwep(null);
            freeinv(obj[0]);
            breakflags = unsigned(breakflags | BRK_KNOWN2BREAK);
        } else {
            breakflags = unsigned(breakflags | BRK_KNOWN2NOTBREAK);
        }

        hit_bars(obj, u.ux, u.uy, x, y, breakflags);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* force-fight a spider web with your weapon */
function domove_fight_web(x, y) { /* boolean */
    const $frame = stack_frame(); try {
    let trap = t_at(x, y);

    if (svc.context.forcefight && trap && trap.ttyp == WEB && trap.tseen) {
        let wtype = uwep_skill_type(),

            wskill_minus_2 = max(P_SKILL(wtype), P_UNSKILLED) - 2,

            roll = rn2(uwep ? 20 : (45 - 5 * wskill_minus_2));

        if (uwep && (u_wield_art(ART_STING)
                     || (uwep.oartifact && attacks(AD_FIRE, uwep)))) {
            /* guaranteed success */
            pline(_("%s %s through the web!"), bare_artifactname(uwep),
                  u_wield_art(ART_STING) ? _("cuts") : _("burns"));

        /* is_blade() includes daggers (which are classified as PIERCE)
           but doesn't include axes and slashing polearms */
        } else if (uwep && !is_blade(uwep)
                   && (!u.twoweap || !is_blade(uswapwep))) {
            let uwepstr = 0, scndstr = 0, uwepbuf = stack_array(char, BUFSZ), scndbuf = stack_array(char, BUFSZ);
            let onewep;

            /* when dual wielding, second weapon will only be mentioned
               if it has a different type description from primary */
            strcpy(uwepbuf, weapon_descr(uwep));
            strcpy(scndbuf, u.twoweap ? weapon_descr(uswapwep) : _(""));
            onewep = +(!chars[scndbuf] || !strcmp(uwepbuf, scndbuf));
            if (!strncmpi((uwepbuf), _(("armor")), -1) || !strncmpi((uwepbuf), _(("food")), -1)
                || !strncmpi((uwepbuf), _(("venom")), -1)) { /* as-is */
                /* non-weapon item wielded, of a type where an() would
                   result in weird phrasing; dual wield not possible */
                uwepstr = uwepbuf;
            } else if (uwep.quan == 1 /* singular */
                       /* unless secondary is suppressed due to same type */
                       && !(u.twoweap && onewep)) {
                uwepstr = an(uwepbuf);
            } else { /* plural */
                uwepstr = makeplural(uwepbuf);
            }
            if (!onewep) {
                assert(uswapwep != null);
                scndstr = (uswapwep.quan == 1) ? an(scndbuf)
                                                 : makeplural(scndbuf);
            }
            You_cant(_("cut a web with %s%s%s!"), uwepstr,
                     !onewep ? _(" or ") : _(""), !onewep ? scndstr : _(""));
            return TRUE;

        /* weapon is ok; check whether hit is successful */
        } else if (roll > (acurrstr() - 2 /* 1..19 */
                           /* for weaponless, 'roll' was adjusted above */
                           + (uwep ? uwep.spe + wskill_minus_2 : 0))) {
            /* TODO: add failures, maybe make an occupation? */
            You(_("%s ineffectually at some of the strands."),
                uwep ? _("hack") : _("thrash"));
            return TRUE;

        /* hit has succeeded */
        } else {
            You(_("%s through the web."), uwep ? _("cut") : _("punch"));
            /* doesn't break "never hit with a wielded weapon" conduct */
            use_skill(wtype, 1);
        }

        deltrap(trap);
        newsym(x, y);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* maybe swap places with a pet? returns TRUE if swapped places */
function domove_swap_with_pet(
    mtmp,
    x, y) { /* boolean */
    const $frame = stack_frame(); try {
    let trap;
    /* if it turns out we can't actually move */
    let didnt_move = FALSE;
    let u_with_boulder = +(sobj_at(BOULDER, u.ux, u.uy) != null);

    /* seemimic/newsym should be done before moving hero, otherwise
       the display code will draw the hero here before we possibly
       cancel the swap below (we can ignore steed mx,my here) */
    u.ux = u.ux0, u.uy = u.uy0;
    mtmp.mundetected = 0;
    if (M_AP_TYPE(mtmp))
        seemimic(mtmp);
    u.ux = mtmp.mx, u.uy = mtmp.my; /* resume swapping positions */

    trap = mtmp.mtrapped ? t_at(mtmp.mx, mtmp.my) : null;
    if (!trap)
        mtmp.mtrapped = 0;

    if (mtmp.mtrapped && is_pit(trap.ttyp)
        && sobj_at(BOULDER, trap.tx, trap.ty)) {
        /* can't swap places with pet pinned in a pit by a boulder */
        didnt_move = TRUE;
    } else if (u.ux0 != x && u.uy0 != y && NODIAG(ptr_diff(mtmp.data, mons[0]))) {
        /* can't swap places when pet can't move to your spot */
        You(_("stop.  %s can't move diagonally."), YMonnam(mtmp));
        didnt_move = TRUE;
    } else if (u_with_boulder
               && !(verysmall(mtmp.data)
                    && (!mtmp.minvent || curr_mon_load(mtmp) <= 600))) {
        /* can't swap places when pet won't fit there with the boulder */
        You(_("stop.  %s won't fit into the same spot that you're at."),
            YMonnam(mtmp));
        didnt_move = TRUE;
    } else if (u.ux0 != x && u.uy0 != y && bad_rock(mtmp.data, x, u.uy0)
               && bad_rock(mtmp.data, u.ux0, y)
               && (bigmonst(mtmp.data) || (curr_mon_load(mtmp) > 600))) {
        /* can't swap places when pet won't fit thru the opening */
        You(_("stop.  %s won't fit through."), YMonnam(mtmp));
        didnt_move = TRUE;
    } else if (mtmp.mpeaceful && mtmp.mtrapped) {
        /* all mtame are also mpeaceful, so this affects pets too */
        assert(trap != null); /* implied by mtrapped */
        let what = trapname(trap.ttyp, FALSE), which = _("that ");
        let anbuf = stack_array(char, 10);

        if (!trap.tseen) {
            feeltrap(trap); /* show on map once mtmp is out of the way */
            which = just_an(anbuf, what); /* "a " or "an " */
        }
        You(_("stop.  %s can't move out of %s%s."), YMonnam(mtmp), which, what);
        handle_tip(TIP_UNTRAP_MON);
        didnt_move = TRUE;
    } else if (mtmp.mpeaceful
               && (!goodpos(u.ux0, u.uy0, mtmp, 0)
                   || t_at(u.ux0, u.uy0) != null
                   || mundisplaceable(mtmp))) {
        /* displacing peaceful into unsafe or trapped space, or trying to
           displace quest leader, Oracle, shk, priest, or vault guard */
        You(_("stop.  %s doesn't want to swap places."), YMonnam(mtmp));
        didnt_move = TRUE;
    } else {
        mtmp.mtrapped = 0;
        remove_monster(x, y);
        place_monster(mtmp, u.ux0, u.uy0);
        newsym(x, y);
        newsym(u.ux0, u.uy0);

        You(_("%s %s."), mtmp.mpeaceful ? _("swap places with") : _("frighten"),
            x_monnam(mtmp,
                     mtmp.mtame ? ARTICLE_YOUR
                     : (!has_mgivenname(mtmp)
                        && !type_is_pname(mtmp.data)) ? ARTICLE_THE
                     : ARTICLE_NONE,
                     (mtmp.mpeaceful && !mtmp.mtame) ? _("peaceful") : 0,
                     has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0, FALSE));

        /* check for displacing it into pools and traps */
        switch (minliquid(mtmp) ? Trap_Killed_Mon
                : mintrap(mtmp, NO_TRAP_FLAGS)) {
        case Trap_Effect_Finished:
            break;
        case Trap_Caught_Mon: /* trapped */
        case Trap_Moved_Mon: /* changed levels */
            /* there's already been a trap message, reinforce it */
            abuse_dog(mtmp);
            adjalign(-3);
            break;
        case Trap_Killed_Mon:
            /* drowned or died...
             * you killed your pet by direct action, so get experience
             * and possibly penalties;
             * we want the level gain message, if it happens, to occur
             * before the guilt message below
             */
            {
                /* minliquid() and mintrap() call mondead() rather than
                   killed() so we duplicate some of the latter here */
                let tmp, mndx;

                if (!u.uconduct.killer++)
                    livelog_printf(LL_CONDUCT, _("killed for the first time"));
                mndx = monsndx(mtmp.data);
                tmp = experience(mtmp, (svm.mvitals[mndx].died));
                more_experienced(tmp, 0);
                newexplevel(); /* will decide if you go up */
            }
            /* That's no way to treat a pet!  Your god gets angry.
             *
             * [This has always been pretty iffy.  Why does your
             * patron deity care at all, let alone enough to get mad?]
             */
            if (rn2(4)) {
                You_feel(_("guilty about losing your pet like this."));
                u.ugangr++;
                adjalign(-15);
            }
            break;
        default:
            impossible(_("that's strange, unknown mintrap result!"));
            break;
        }
    }
    return +!didnt_move;
    } finally { stack_pop($frame); }
}

/* force-fight (x,y) which doesn't have anything to fight */
function domove_fight_empty(x, y) { /* boolean */
    const $frame = stack_frame(); try {
    var unknown_obstacle = init_string(static_array("domove_fight_empty.unknown_obstacle", char, sizeof_string("an unknown obstacle")), _("an unknown obstacle"), true);
    var off_edge = +!isok(x, y);
    var glyph = !off_edge ? glyph_at(x, y) : GLYPH_UNEXPLORED;

    if (off_edge)
        x = 0, y = 1; /* for forcefight against the edge of the map; make
                       * sure 'bad' coordinates are within array bounds in
                       * case a bounds check gets overlooked; avoid <0,0>
                       * because m_at() might find a vault guard there */

    /* specifying 'F' with no monster wastes a turn */
    if (svc.context.forcefight
        /* remembered an 'I' && didn't use a move command */
        || (glyph_is_invisible(glyph) && !m_at(x, y)
            && !svc.context.nopick)) {
        var boulder = null;
        var explo = (Upolyd() && attacktype(gy.youmonst.data, AT_EXPL) ? 1 : 0),
                solid = (off_edge || (!accessible(x, y)
                                      || IS_FURNITURE(levl()[x][y].typ)) ? 1 : 0);
        var buf = stack_array(char, BUFSZ);

        futile: { if (off_edge) {
            /* treat as if solid rock, even on planes' levels */
            strcpy(buf, unknown_obstacle);
            break futile;
        }

        if (!Underwater()) {
            boulder = sobj_at(BOULDER, x, y);
            /* if a statue is displayed at the target location,
               player is attempting to attack it [and boulder
               handling below is suitable for handling that] */
            if (glyph_is_statue(glyph)
                || (Hallucination() && glyph_is_monster(glyph)))
                boulder = sobj_at(STATUE, x, y);

            /* force fight at boulder/statue or wall/door while wielding
               pick:  start digging to break the boulder or wall */
            if (svc.context.forcefight
                /* can we dig? */
                && uwep && dig_typ(uwep, x, y)
                /* should we dig? */
                && !glyph_is_invisible(glyph) && !glyph_is_monster(glyph)) {
                use_pick_axe2(uwep);
                return TRUE;
            }
        }

        /* about to become known empty -- remove 'I' if present */
        unmap_object(x, y);
        if (boulder)
            map_object(boulder, TRUE);
        newsym(x, y);
        glyph = glyph_at(x, y); /* might have just changed */
        (glyph);

        if (boulder) {
            strcpy(buf, ansimpleoname(boulder));
        } else if (Underwater() && !is_pool(x, y)) {
            /* Underwater, targeting non-water; the map just shows blank
               because you don't see remembered terrain while underwater;
               although the hero can attack an adjacent monster this way,
               assume he can't reach out far enough to distinguish terrain */
            sprintf(buf, _("%s"), (Is_waterlevel(u.uz) && levl()[x][y].typ == AIR)
                         ? _("an air bubble")
                         : _("nothing"))
;
        } else if (solid) {
            /* glyph might indicate unseen terrain if hero is blind;
               unlike searching, this won't reveal what that terrain is;
               5.0: used to say "solid rock" for STONE, but that made it be
               different from unmapped walls outside of rooms (and was wrong
               on arboreal levels) */
            if (levl()[x][y].seenv || IS_STWALL(levl()[x][y].typ)
                || levl()[x][y].typ == SDOOR || levl()[x][y].typ == SCORR) {
                glyph = back_to_glyph(x, y);
                strcpy(buf, the(defsyms[glyph_to_cmap(glyph)].explanation));
            } else {
                strcpy(buf, unknown_obstacle);
            }
            /* note: 'solid' is misleadingly named and catches pools
               of water and lava as well as rock and walls;
               5.0: furniture too */
        } else {
            strcpy(buf, _("thin air"));
        }
 }
        You(_("%s%s %s."),
            !(boulder || solid) ? _("") : !explo ? _("harmlessly ") : _("futilely "),
            explo ? _("explode at") : _("attack"), buf);

        nomul(0);
        if (explo) {
            var attk = attacktype_fordmg(gy.youmonst.data, AT_EXPL, AD_ANY);

            /* no monster has been attacked so we have bypassed explum() */
            wake_nearto(u.ux, u.uy, 7 * 7); /* same radius as explum() */
            if (attk)
                explum(null, attk);
            u.mh = -1; /* dead in the current form */
            rehumanize();
        }
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* does the plane of air disturb movement? */
function air_turbulence() { /* boolean */
    if (Is_airlevel(u.uz) && rn2(4) && !Levitation() && !Flying()) {
        switch (rn2(3)) {
        case 0:
            You(_("tumble in place."));
            exercise(A_DEX, FALSE);
            break;
        case 1:
            You_cant(_("control your movements very well."));
            break;
        case 2:
            pline(_("It's hard to walk in thin air."));
            exercise(A_DEX, TRUE);
            break;
        }
        return TRUE;
    }
    return FALSE;
}

/* does water disturb the movement? */
function water_turbulence(x, y) { /* boolean */
    if (u.uinwater) {
        let wtcap;
        let wtmod = (Swimming() ? MOD_ENCUMBER : SLT_ENCUMBER);

        water_friction();
        if (!u.dx && !u.dy) {
            nomul(0);
            return TRUE;
        }
        x[0] = u.ux + u.dx;
        y[0] = u.uy + u.dy;

        /* are we trying to move out of water while carrying too much? */
        if (isok(x[0], y[0]) && !is_pool(x[0], y[0]) && !Is_waterlevel(u.uz)
            && (wtcap = near_capacity()) > wtmod) {
            /* when escaping from drowning you need to be unencumbered
               in order to crawl out of water, but when not drowning,
               doing so while encumbered is feasible; if in an aquatic
               form, stressed or less is allowed; otherwise (magical
               breathing), only burdened is allowed */
            You(_("are carrying too much to climb out of the water."));
            nomul(0);
            return TRUE;
        }
    }
    return FALSE;
}

function slippery_ice_fumbling() { /* void */
    let recharged = (!Levitation() && is_ice(u.ux, u.uy) ? 1 : 0);
    let iceskater = u.usteed ? u.usteed : gy.youmonst;

    if (recharged) {
        if ((uarmf && objdescr_is(uarmf, _("snow boots")))
            || resists_cold(iceskater) || Flying()
            || is_floater(iceskater.data) || is_clinger(iceskater.data)
            || is_whirly(iceskater.data)) {
            recharged = FALSE;
        } else if (!rn2(Cold_resistance() ? 3 : 2)) {
            u.uprops[FUMBLING].intrinsic = or64(u.uprops[FUMBLING].intrinsic, FROMOUTSIDE);
            u.uprops[FUMBLING].intrinsic = and64(u.uprops[FUMBLING].intrinsic, ~TIMEOUT);
            u.uprops[FUMBLING].intrinsic += 1; /* slip on next move */
        }
    }
    if (!recharged && (HFumbling() & FROMOUTSIDE))
        u.uprops[FUMBLING].intrinsic = and64(u.uprops[FUMBLING].intrinsic, ~FROMOUTSIDE);
}

export function u_maybe_impaired() { /* boolean */
    return (Stunned() || (Confusion() && !rn2(5)) ? 1 : 0);
}

/* change movement dir if impaired. return TRUE if can't move */
function impaired_movement(x, y) { /* boolean */
    if (u_maybe_impaired()) {
        let tries = 0;

        do {
            if (tries++ > 50) {
                nomul(0);
                return TRUE;
            }
            confdir(TRUE);
            x[0] = u.ux + u.dx;
            y[0] = u.uy + u.dy;
        } while (!isok(x[0], y[0]) || bad_rock(gy.youmonst.data, x[0], y[0]));
    }
    return FALSE;
}

function avoid_moving_on_trap(x, y, msg) { /* boolean */
    let trap;

    if ((trap = t_at(x, y)) && trap.tseen
        /* the vibrating square is implemented as a trap but treated as if
           it were a type of terrain */
        && trap.ttyp != VIBRATING_SQUARE) {
        if (msg && flags.mention_walls) {
            set_msg_xy(x, y);
            You(_("stop in front of %s."),
                an(trapname(trap.ttyp, FALSE)));
        }
        return TRUE;
    }
    return FALSE;
}

function avoid_moving_on_liquid(
    x, y,
    msg) { /* boolean */
    let in_air = (Levitation() || Flying() ? 1 : 0);

    /* don't stop if you're not on a transition between terrain types... */
    if ((levl()[x][y].typ == levl()[u.ux][u.uy].typ
         /* or you are using shift-dir running and the transition isn't
            dangerous... */
         || (svc.context.run < 2 && (!is_lava(x, y) || in_air))
         || svc.context.travel)
        /* and you know you won't fall in */
        && (in_air || Known_lwalking() || (is_pool(x, y) && Known_wwalking()))
        && !(IS_WATERWALL(levl()[x][y].typ) || levl()[x][y].typ == LAVAWALL)) {
        /* XXX: should send 'is_clinger(gy.youmonst.data)' here once clinging
           polyforms are allowed to move over water */
        return FALSE; /* liquid is safe to traverse */
    } else if (is_pool_or_lava(x, y) && levl()[x][y].seenv) {
        if (msg && flags.mention_walls) {
            set_msg_xy(x, y);
            You(_("stop at the edge of the %s."),
                hliquid(is_pool(x,y) ? _("water") : _("lava")));
        }
        return TRUE;
    }
    return FALSE;
}

/* when running/rushing, avoid stepping on a known trap or pool of liquid.
   returns TRUE if avoided. */
function avoid_running_into_trap_or_liquid(x, y) { /* boolean */
    let would_stop = +(svc.context.run >= 2);
    if (!svc.context.run)
        return FALSE;

    if (avoid_moving_on_trap(x,y, would_stop)
        || (Blind() && avoid_moving_on_liquid(x,y, would_stop))) {
        nomul(0);
        if (would_stop)
            svc.context.move = 0;
        return would_stop;
    }
    return FALSE;
}

/* if paranoid_confirm:Trap is enabled, check whether the next step forward
   needs player confirmation due to visible region or discovered trap;
   result: True => stop moving, False => proceed */
function avoid_trap_andor_region(x, y) { /* boolean */
    const $frame = stack_frame(); try {
    let qbuf = stack_array(char, QBUFSZ);
    let newreg, oldreg;
    let trap = null;

    /* treat entering a visible gas cloud region like entering a trap;
       there could be a known trap as well as a region at the target spot;
       if so, ask about entring the region first; even though this could
       lead to two consecutive confirmation prompts, the situation seems
       to be too uncommon to warrant a separate case with combined
       trap+region confirmation */
    if (ParanoidTrap() && !Blind() && !Stunned() && !Confusion() && !Hallucination()
        /* skip if player used 'm' prefix or is moving recklessly */
        && (!svc.context.nopick || svc.context.run)
        /* check for region(s) */
        && (newreg = visible_region_at(x, y)) != null
        && ((oldreg = visible_region_at(u.ux, u.uy)) == null
            /* if moving from one region into another, only ask for
               confirmation if the one potentially being entered inflicts
               damage (poison gas) and the one being exited doesn't (vapor) */
            || (reg_damg(newreg) > 0 && reg_damg(oldreg) == 0))
        /* check whether attempted move will be viable */
        && test_move(u.ux, u.uy, u.dx, u.dy, TEST_MOVE)
        /* we don't override confirmation for poison resistance since the
           region also hinders hero's vision even if/when no damage is done */
    ) {
        Snprintf(qbuf, sizeof(array_of(char, QBUFSZ)), _("%s into that %s cloud?"), u_locomotion(_("step")), (reg_damg(newreg) > 0) ? _("poison gas") : _("vapor"))

;
        if (!paranoid_query(ParanoidConfirm(), upstart(qbuf))) {
            nomul(0);
            svc.context.move = 0;
            return TRUE;
        }
    }

    /* maybe ask player for confirmation before walking into known trap */
    if (ParanoidTrap() && !Stunned() && !Confusion()
        /* skip if player used 'm' prefix or is moving recklessly */
        && (!svc.context.nopick || svc.context.run)
        /* check for discovered trap */
        && (trap = t_at(x, y)) != null && trap.tseen
        /* check whether attempted move will be viable */
        && test_move(u.ux, u.uy, u.dx, u.dy, TEST_MOVE)
        /* override confirmation if the trap is harmless to the hero */
        && (immune_to_trap(gy.youmonst, trap.ttyp) != TRAP_CLEARLY_IMMUNE
            /* Hallucination: all traps still show as ^, but the
               hero can't tell what they are, so treat as dangerous */
            || Hallucination())) {
        let traptype = (Hallucination() ? rnd(TRAPNUM - 1) : trap.ttyp);
        let into = into_vs_onto(traptype);

        Snprintf(qbuf, sizeof(array_of(char, QBUFSZ)), _("Really %s %s that %s?"), u_locomotion(_("step")), into ? _("into") : _("onto"), elt(defsyms, trap_to_defsym(traptype)).explanation)

;
        /* handled like paranoid_confirm:pray; when paranoid_confirm:trap
           isn't set, don't ask at all but if it is set (checked above),
           ask via y/n if parnoid_confirm:confirm isn't also set or via
           yes/no if it is */
        if (!paranoid_query(ParanoidConfirm(), qbuf)) {
            nomul(0);
            svc.context.move = 0;
            return TRUE;
        }
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* trying to move out-of-bounds? */
function move_out_of_bounds(x, y) { /* boolean */
    if (!isok(x, y)) {
        if (svc.context.forcefight)
            return domove_fight_empty(x, y);

        if (flags.mention_walls) {
            let dx = u.dx, dy = u.dy;

            if (dx && dy) { /* diagonal */
                /* only as far as possible diagonally if in very
                   corner; otherwise just report whichever of the
                   cardinal directions has reached its limit */
                if (isok(x, u.uy))
                    dx = 0;
                else if (isok(u.ux, y))
                    dy = 0;
            }
            You(_("have already gone as far %s as possible."),
                directionname(xytodir(dx, dy)));
        }
        nomul(0);
        svc.context.move = 0;
        return TRUE;
    }
    return FALSE;
}

/* carrying too much to be able to move? */
function carrying_too_much() { /* boolean */
    let wtcap;

    if (((wtcap = near_capacity()) >= OVERLOADED
         || (wtcap > SLT_ENCUMBER
             && (Upolyd() ? (u.mh < 5 && u.mh != u.mhmax)
                        : (u.uhp < 10 && u.uhp != u.uhpmax))))
        && !Is_airlevel(u.uz)) {
        if (wtcap < OVERLOADED) {
            You(_("don't have enough stamina to move."));
            exercise(A_CON, FALSE);
        } else
            You(_("collapse under your load."));
        nomul(0);
        return TRUE;
    }
    return FALSE;
}

/* try to pull free from sticking monster, or you release a monster
   you're sticking to. returns TRUE if you lose your movement. */
function escape_from_sticky_mon(x, y) { /* boolean */
    if (u.ustuck && (x != u.ustuck.mx || y != u.ustuck.my)) {
        let mtmp;

        if (!m_next2u(u.ustuck)) {
            /* perhaps it fled (or was teleported or ... ) */
            set_ustuck(null);
        } else if (sticks(gy.youmonst.data)) {
            /* When polymorphed into a sticking monster,
             * u.ustuck means it's stuck to you, not you to it.
             */
            mtmp = u.ustuck;
            set_ustuck(null);
            You(_("release %s."), y_monnam(mtmp));
        } else {
            /* If holder is asleep or paralyzed:
             *      37.5% chance of getting away,
             *      12.5% chance of waking/releasing it;
             * otherwise:
             *       7.5% chance of getting away.
             * [strength ought to be a factor]
             * If holder is tame and there is no conflict,
             * guaranteed escape.
             */
            switch (rn2(!u.ustuck.mcanmove ? 8 : 40)) {
            case 3:
                if (!u.ustuck.mcanmove) {
                    /* it's free to move on next turn */
                    u.ustuck.mfrozen = 1;
                    u.ustuck.msleeping = 0;
                }
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            default:
                if (Conflict() || u.ustuck.mconf || !u.ustuck.mtame) {
                    You(_("cannot escape from %s!"), y_monnam(u.ustuck));
                    nomul(0);
                    return TRUE;
                }
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case 0:
            case 1:
            case 2:
                mtmp = u.ustuck;
                set_ustuck(null);
                You(_("pull free from %s."), y_monnam(mtmp));
                break;
            }
        }
    }
    return FALSE;
}

export function domove() { /* void */
        let ux1 = u.ux, uy1 = u.uy;

        gd.domove_succeeded = 0;
        domove_core();
        /* gd.domove_succeeded is available to make assessments now */
        if ((gd.domove_succeeded & (DOMOVE_RUSH | DOMOVE_WALK)) != 0) {
            maybe_smudge_engr(ux1, uy1, u.ux, u.uy);
            maybe_adjust_hero_bubble();
        }
        gd.domove_attempting = 0;

        gk.kickedloc.x = 0, gk.kickedloc.y = 0;
}

function domove_core() { /* void */
    const $frame = stack_frame(); try {
    let mtmp;
    let tmpr;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let glyph;
    let chainx = stack_var(coordxy, 0), chainy = stack_var(coordxy, 0),
            ballx = stack_var(coordxy, 0), bally = stack_var(coordxy, 0);       /* ball&chain new positions */
    let bc_control = stack_var(int, 0);                 /* control for ball&chain */
    let cause_delay = stack_var(boolean, FALSE),
            displaceu = stack_var(boolean, FALSE);          /* involuntary swap */

    if (svc.context.travel) {
        if (!findtravelpath(TRAVP_TRAVEL))
            findtravelpath(TRAVP_GUESS);
        svc.context.travel1 = 0;
    }

    if (carrying_too_much())
        return;

    if (u.uswallow) {
        u.dx = u.dy = 0;
        x[0] = u.ustuck.mx, y[0] = u.ustuck.my;
        u_on_newpos(x[0], y[0]); /* set u.ux,uy and handle CLIPPING */
        mtmp = u.ustuck;
    } else {
        if (air_turbulence())
            return;

        /* check slippery ice */
        slippery_ice_fumbling();

        x[0] = u.ux + u.dx;
        y[0] = u.uy + u.dy;
        if (impaired_movement(x, y))
            return;

        /* turbulence might alter your actual destination */
        if (water_turbulence(x, y))
            return;

        if (move_out_of_bounds(x[0], y[0]))
            return;

        if (avoid_running_into_trap_or_liquid(x[0], y[0]))
            return;

        if (escape_from_sticky_mon(x[0], y[0]))
            return;

        mtmp = m_at(x[0], y[0]);
        if (mtmp && !is_safemon(mtmp)) {
            /* Don't attack if you're running, and can see it */
            /* It's fine to displace pets, though */
            /* We should never get here if forcefight */
            if (svc.context.run && ((!Blind() && mon_visible(mtmp)
                                 && ((M_AP_TYPE(mtmp) != M_AP_FURNITURE
                                      && M_AP_TYPE(mtmp) != M_AP_OBJECT)
                                     || Protection_from_shape_changers()))
                                || sensemon(mtmp))) {
                nomul(0);
                svc.context.move = 0;
                return;
            }
        }
    }

    u.ux0 = u.ux;
    u.uy0 = u.uy;
    gb.bhitpos.x = x[0];
    gb.bhitpos.y = y[0];
    tmpr = levl()[x[0]][y[0]];
    glyph = glyph_at(x[0], y[0]);

    if (mtmp) {
        /* don't stop travel when displacing pets; if the
           displace fails for some reason, do_attack() in uhitm.c
           will stop travel rather than domove */
        if (!is_safemon(mtmp) || svc.context.forcefight)
            nomul(0);

        if (domove_bump_mon(mtmp, glyph))
            return;

        /* attack monster */
        if (domove_attackmon_at(mtmp, x[0], y[0], addr_of(displaceu)))
            return;
    }

    if (!displaceu[0]) {
        if (domove_fight_ironbars(x[0], y[0]))
            return;

        if (domove_fight_web(x[0], y[0]))
            return;

        if (domove_fight_empty(x[0], y[0]))
            return;

        unmap_invisible(x[0], y[0]);
        /* not attacking an animal, so we try to move */
        if ((u.dx || u.dy) && u.usteed && stucksteed(FALSE)) {
            nomul(0);
            return;
        }

        if (u_rooted())
            return;

        /* handling for paranoid_confirm:Trap which doubles as
           paranoid_confirm:Region */
        if (ParanoidTrap()) {
            if (avoid_trap_andor_region(x[0], y[0]))
                return;
        }

        if (u.utrap) { /* when u.utrap is True, displaceu is False */
            let moved = trapmove(x[0], y[0], null);

            if (!u.utrap) {
                disp.botl = TRUE;
                reset_utrap(TRUE); /* might resume levitation or flight */
            }
            /* might not have escaped, or did escape but remain in the same
               spot */
            if (!moved)
                return;
        }

        if (!test_move(u.ux, u.uy, x[0] - u.ux, y[0] - u.uy, DO_MOVE)) {
            if (!svc.context.door_opened) {
                svc.context.move = 0;
                nomul(0);
            }
            return;
        }

        /* Is it dangerous to swim in water or lava? */
        if (swim_move_danger(x[0], y[0])) {
            svc.context.move = 0;
            nomul(0);
            return;
        }
    } /* !dislacedu */

    /* Move ball and chain.  */
    if (Punished())
        if (!drag_ball(x[0], y[0], bc_control, ballx, bally, chainx, chainy,
                       addr_of(cause_delay), TRUE))
            return;

    /* Check regions entering/leaving */
    if (!in_out_region(x[0], y[0]))
        return;

    mtmp = m_at(x[0], y[0]);
    /* mtmp can be null at this point */

    /* tentatively move the hero plus steed; leave CLIPPING til later */
    u.ux += u.dx;
    u.uy += u.dy;

    m_postmove_effect(gy.youmonst);

    if (u.usteed) {
        u.usteed.mx = u.ux;
        u.usteed.my = u.uy;
        /* [if move attempt ends up being blocked, should training count?] */
        exercise_steed(); /* train riding skill */
    }

    if (mtmp) {
        if (displaceu[0]) {
            let noticed_it = (canspotmon(mtmp)
                                  || glyph_is_invisible(glyph)
                                  || glyph_is_warning(glyph) ? 1 : 0);

            remove_monster(u.ux, u.uy);
            place_monster(mtmp, u.ux0, u.uy0);
            newsym(u.ux, u.uy);
            newsym(u.ux0, u.uy0);
            /* monst still knows where hero is */
            mtmp.mux = u.ux, mtmp.muy = u.uy;

            pline(_("%s swaps places with you..."),
                  !noticed_it ? Something() : YMonnam(mtmp));
            if (!canspotmon(mtmp))
                map_invisible(u.ux0, u.uy0);
            /* monster chose to swap places; hero doesn't get any credit
               or blame if something bad happens to it */
            svc.context.mon_moving = 1;
            if (!minliquid(mtmp))
                mintrap(mtmp, NO_TRAP_FLAGS);
            svc.context.mon_moving = 0;

        /*
         * If safepet at destination then move the pet to the hero's
         * previous location using the same conditions as in do_attack().
         * there are special extenuating circumstances:
         * (1) if the pet dies then your god angers,
         * (2) if the pet gets trapped then your god may disapprove.
         *
         * Ceiling-hiding pets are skipped by this section of code, to
         * be caught by the normal falling-monster code.
         */
        } else if (is_safemon(mtmp)
                   && !(is_hider(mtmp.data) && mtmp.mundetected)) {
            if (!domove_swap_with_pet(mtmp, x[0], y[0])) {
                u.ux = u.ux0, u.uy = u.uy0; /* didn't move after all */
                /* could skip this since we're about to call u_on_newpos() */
                if (u.usteed)
                    u.usteed.mx = u.ux, u.usteed.my = u.uy;
            }
        }
    }  /* mtmp != NULL */

    /* tentative move above didn't handle CLIPPING, in case there was a
       monster in the way and the move attempt ended up being blocked;
       do a full re-position now, possibly back to where hero started */
    u_on_newpos(u.ux, u.uy);

    reset_occupations();
    if (svc.context.run) {
        if (svc.context.run < 8)
            if (IS_DOOR(tmpr.typ) || IS_OBSTRUCTED(tmpr.typ)
                || IS_FURNITURE(tmpr.typ))
                nomul(0);
    }

    /* your tread on the ground may disturb the slumber of nearby zombies */
    if (!Levitation() && !Flying() && !Stealth()
        && gy.youmonst.data.cwt >= Math.trunc(WT_ELF / 2))
        disturb_buried_zombies(u.ux, u.uy);

    if (hides_under(gy.youmonst.data) || gy.youmonst.data.mlet == S_EEL
        || u.dx || u.dy)
        hideunder(gy.youmonst);

    /*
     * Mimics (or whatever) become noticeable if they move and are
     * imitating something that doesn't move.  We could extend this
     * to non-moving monsters...
     */
    if ((u.dx || u.dy) && (U_AP_TYPE() == M_AP_OBJECT
                           || U_AP_TYPE() == M_AP_FURNITURE))
        gy.youmonst.m_ap_type = M_AP_NOTHING;

    check_leash(u.ux0, u.uy0);

    if (u.ux0 != u.ux || u.uy0 != u.uy) {
        /* let caller know so that an evaluation may take place */
        gd.domove_succeeded = or64(gd.domove_succeeded, (gd.domove_attempting & (DOMOVE_RUSH | DOMOVE_WALK)))
;
        u.umoved = TRUE;
        /* Clean old position -- vision_recalc() will print our new one. */
        newsym(u.ux0, u.uy0);
        /* Since the hero has moved, adjust what can be seen/unseen. */
        vision_recalc(1); /* Do the work now in the recover time. */
        invocation_message();
    }

    if (Punished()) /* put back ball and chain */
        move_bc(0, bc_control[0], ballx[0], bally[0], chainx[0], chainy[0]);

    if (u.umoved)
        spoteffects(TRUE);

    /* delay next move because of ball dragging */
    /* must come after we finished picking up, in spoteffects() */
    if (cause_delay[0]) {
        nomul(-2);
        gm.multi_reason = _("dragging an iron ball");
        gn.nomovemsg = _("");
    }

    runmode_delay_output();
    } finally { stack_pop($frame); }
}

/* delay output based on value of runmode,
   if hero is running or doing a multi-turn action */
export function runmode_delay_output() { /* void */
    if ((svc.context.run || gm.multi) && flags.runmode != RUN_TPORT) {
        /* for tport mode, don't display anything until we've stopped;
           for normal (leap) mode, update display every 7th step
           (relative to turn counter; ought to be to start of running);
           for walk and crawl (visual debugging) modes, update the
           display after every step */
        if (flags.runmode != RUN_LEAP || !(svm.moves % 7)) {
            /* moveloop() suppresses time_botl when running */
            disp.time_botl = flags.time;
            curs_on_u();
            nh_delay_output()();
            if (flags.runmode == RUN_CRAWL) {
                nh_delay_output()();
                nh_delay_output()();
                nh_delay_output()();
                nh_delay_output()();
            }
        }
    }
}

function maybe_smudge_engr(x1, y1, x2, y2) { /* void */
    let ep;

    if (can_reach_floor(TRUE)) {
        if ((ep = engr_at(x1, y1)) && ep.engr_type != HEADSTONE)
            wipe_engr_at(x1, y1, rnd(5), FALSE);
        if ((x2 != x1 || y2 != y1)
                && (ep = engr_at(x2, y2)) && ep.engr_type != HEADSTONE)
            wipe_engr_at(x2, y2, rnd(5), FALSE);
    }
}

/* HP loss or passing out from overexerting yourself */
export function overexert_hp() { /* void */
    let hp = (!Upolyd() ? ref_of(u, "uhp") : ref_of(u, "mh"));

    if (hp[0] > 1) {
        hp[0] -= 1;
        disp.botl = TRUE;
    } else {
        You(_("pass out from exertion!"));
        exercise(A_CON, FALSE);
        fall_asleep(-10, FALSE);
    }
}

/* combat increases metabolism */
export function overexertion() { /* boolean */
    /* this used to be part of domove() when moving to a monster's
       position, but is now called by do_attack() so that it doesn't
       execute if you decline to attack a peaceful monster */
    gethungry();
    if ((svm.moves % 3) != 0 && near_capacity() >= HVY_ENCUMBER) {
        overexert_hp();
    }
    return (+(gm.multi < 0)); /* might have fainted (forced to sleep) */
}

export function invocation_message() { /* void */
    const $frame = stack_frame(); try {
    /* a special clue-msg when on the Invocation position */
    if (invocation_pos(u.ux, u.uy) && !On_stairs(u.ux, u.uy)) {
        let buf = stack_array(char, BUFSZ);
        let otmp = carrying(CANDELABRUM_OF_INVOCATION);

        nomul(0); /* stop running or travelling */
        if (u.usteed)
            sprintf(buf, _("beneath %s"), y_monnam(u.usteed));
        else if (Levitation() || Flying())
            strcpy(buf, _("beneath you"));
        else
            sprintf(buf, _("under your %s"), makeplural(body_part(FOOT)));

        You_feel(_("a strange vibration %s."), buf);
        u.uevent.uvibrated = 1;
        if (otmp && otmp.spe == 7 && otmp.lamplit)
            pline(_("%s %s!"), The(xname(otmp)),
                  Blind() ? _("throbs palpably") : _("glows with a strange light"));
    }
    } finally { stack_pop($frame); }
}

/* for status: set up iflags.terrain_typ, an index into terrain_descrp[];
   some types need fixing up  */
export function classify_terrain() { /* void */
    let lev = levl()[u.ux][u.uy];
    let typ = chars[svl.lastseentyp[u.ux] + u.uy]; /* lev->typ */

    /*
     * If the terrain under the hero is different now from what it
     * was on the previous check, bring iflags.terrain_typ up to date
     * and request a status update.  Unless hero is running--then the
     * update request will be suppressed.
     */

    if (Underwater()) {
        typ = xSUBMERGED;
    } else {
        switch (typ) {
        case STONE:
            if (svl.level.flags.arboreal)
                typ = TREE;
            break;
        case CORR:
        case ROOM:
            /* this matches surface() but 'floor' is odd in many places */
            typ = !Is_earthlevel(u.uz) ? xFLOOR : xGROUND;
            break;
        case DOOR:
            /* defaults to "doorway" (door-less or broken) */
            if ((lev.flags & D_ISOPEN) != 0)
                typ = xOPENDOOR;
            else if ((lev.flags & (D_CLOSED | D_LOCKED | D_TRAPPED)) != 0)
                typ = xSHUTDOOR;
            break;
        case DRAWBRIDGE_UP:
            /* ICE, MOAT, LAVA, or 'STONE' (which ought to be 'room') */
            typ = db_under_typ(lev.flags);
            if (typ == STONE || typ == ROOM)
                typ = xGROUND;
            break;
        case MOAT:
            /* moat and swamp handling match waterbody_name()'s result */
            if (Is_medusa_level(u.uz))
                typ = xSEA;
            else if (Is_juiblex_level(u.uz))
                typ = xSWAMP;
            break;
        case WATER:
            if (!Is_waterlevel(u.uz))
                typ = xWATERWALL;
            break;
        /* #if 0: not in this build */

        default:
            break;
        }
    }

    if (typ != iflags.terrain_typ) {
        /* terrain at hero's spot is different */
        iflags.terrain_typ = typ;
        /* request a status update unless hero is running */
        if (flags.terrainstatus && !svc.context.run)
            disp.botl = TRUE;
    }
}

/* moving onto different terrain;
   might be going into solid rock, inhibiting levitation or flight,
   or coming back out of such, reinstating levitation/flying */
export function switch_terrain() { /* void */
    let lev = levl()[u.ux][u.uy];
    let blocklev = (IS_OBSTRUCTED(lev.typ) || closed_door(u.ux, u.uy)
                        || IS_WATERWALL(lev.typ)
                        || lev.typ == LAVAWALL ? 1 : 0),
            was_levitating = +!!Levitation(), was_flying = +!!Flying();

    if (blocklev) {
        /* called from spoteffects(), stop levitating but skip float_down() */
        if (Levitation())
            You_cant(_("levitate in here."));
        u.uprops[LEVITATION].blocked = or64(u.uprops[LEVITATION].blocked, FROMOUTSIDE);
    } else if (BLevitation()) {
        u.uprops[LEVITATION].blocked = and64(u.uprops[LEVITATION].blocked, ~FROMOUTSIDE);
        /* we're probably levitating now; if not, we must be chained
           to a buried iron ball so get float_up() feedback for that */
        if (Levitation() || BLevitation())
            float_up();
    }
    /* the same terrain that blocks levitation also blocks flight */
    if (blocklev) {
        if (Flying())
            You_cant(_("fly in here."));
        u.uprops[FLYING].blocked = or64(u.uprops[FLYING].blocked, FROMOUTSIDE);
    } else if (BFlying()) {
        u.uprops[FLYING].blocked = and64(u.uprops[FLYING].blocked, ~FROMOUTSIDE);
        float_vs_flight(); /* maybe toggle (BFlying & I_SPECIAL) */
        /* [minor bug: we don't know whether this is beginning flight or
           resuming it; that could be tracked so that this message could
           be adjusted to "resume flying", but isn't worth the effort...] */
        if (Flying())
            You(_("start flying."));
    }
    if ((+!!Levitation() ^ was_levitating) || (+!!Flying() ^ was_flying))
        disp.botl = TRUE; /* update Lev/Fly status condition */

    if (flags.terrainstatus)
        classify_terrain();
}

/* set or clear u.uinwater */
export function set_uinwater(in_out) { /* void */
    if (in_out != u.uinwater) {
        u.uinwater = in_out ? 1 : 0;
        switch_terrain();
    }
}

/* extracted from spoteffects; called by spoteffects to check for entering or
   leaving a pool of water/lava, and by moveloop to check for staying on one;
   returns true to skip rest of spoteffects */
export function pooleffects(
    newspot) { /* boolean */ /* true if called by spoteffects */
    /* check for leaving water */
    if (u.uinwater) {
        let still_inwater = FALSE; /* assume we're getting out */

        if (!is_pool(u.ux, u.uy)) {
            if (Is_waterlevel(u.uz)) {
                You(_("pop into an air bubble."));
                iflags.last_msg = PLNMSG_BACK_ON_GROUND;
            } else if (is_lava(u.ux, u.uy)) {
                You(_("leave the %s..."), hliquid(_("water"))); /* oops! */
            } else {
                back_on_ground(FALSE);
            }
        } else if (Is_waterlevel(u.uz)) {
            still_inwater = TRUE;
        } else if (Levitation()) {
            You(_("pop out of the %s like a cork!"), hliquid(_("water")));
        } else if (Flying()) {
            You(_("fly out of the %s."), hliquid(_("water")));
        } else if (Wwalking()) {
            You(_("slowly rise above the surface."));
        } else {
            still_inwater = TRUE;
        }
        if (!still_inwater) {
            let was_underwater = (Underwater() && !Is_waterlevel(u.uz) ? 1 : 0);

            set_uinwater(0); /* u.uinwater = 0; leave the water */
            if (was_underwater) { /* restore vision */
                docrt();
                gv.vision_full_recalc = 1;
            }
        }
    }

    /* check for entering water or lava */
    if (!u.ustuck && !Levitation() && !Flying() && is_pool_or_lava(u.ux, u.uy)) {
        if (u.usteed && !grounded(u.usteed.data)) {
            /* floating or clinging steed keeps hero safe (is_flyer() test
               is redundant; it can't be true since Flying yielded false) */
            return FALSE;
        } else if (u.usteed) {
            /* steed enters pool */
            dismount_steed(Underwater() ? DISMOUNT_FELL : DISMOUNT_GENERIC);
            /* dismount_steed() -> float_down() -> pickup()
               (float_down doesn't do autopickup on Air or Water) */
            if (Is_airlevel(u.uz) || Is_waterlevel(u.uz))
                return FALSE;
            /* even if we actually end up at same location, float_down()
               has already done trap and pickup actions of spoteffects() */
            if (newspot)
                check_special_room(FALSE); /* spoteffects */
            return TRUE;
        }
        /* not mounted */

        /* if hiding on ceiling then don't automatically enter pool */
        if (Upolyd() && ceiling_hider(mons[u.umonnum]) && u.uundetected)
            return FALSE;

        /* drown(),lava_effects() return true if hero changes
           location while surviving the problem */
        if (is_lava(u.ux, u.uy)) {
            if (lava_effects())
                return TRUE;
        } else if ((!Wwalking() || is_waterwall(u.ux,u.uy))
                   && (newspot || !u.uinwater
                       || !(Swimming() || Amphibious() || Breathless()))) {
            if (drown())
                return TRUE;
        }
    }
    return FALSE;
}

export function spoteffects(pick) { /* void */
    var inspoteffects = static_var("spoteffects.inspoteffects", int, 0);
    var spotloc = static_struct("spoteffects.spotloc", struct_nhcoord);
    var spotterrain = static_var("spoteffects.spotterrain", int);
    var spottrap = static_var("spoteffects.spottrap", ptr_to(struct_trap), null);
    var spottraptyp = static_var("spoteffects.spottraptyp", unsigned, NO_TRAP);

    var mtmp;
    var trap = t_at(u.ux, u.uy);
    var trapflag = iflags.failing_untrap ? FAILEDUNTRAP : 0;

    /* prevent recursion from affecting the hero all over again
       [hero poly'd to iron golem enters water here, drown() inflicts
       damage that triggers rehumanize() which calls spoteffects()...] */
    if (inspoteffects[0] && u_at(spotloc.x, spotloc.y)
        /* except when reason is transformed terrain (ice -> water) */
        && spotterrain[0] == levl()[u.ux][u.uy].typ
        /* or transformed trap (land mine -> pit) */
        && (!spottrap[0] || !trap || trap.ttyp == spottraptyp[0]))
        return;
    /* when float_down() puts hero into lava and she teleports out,
       defer spoteffects() until after "you are back on solid <surface>" */
    if (iflags.in_lava_effects)
        return;

    ++inspoteffects[0];
    spotterrain[0] = levl()[u.ux][u.uy].typ;
    spotloc.x = u.ux, spotloc.y = u.uy;

    /* moving onto different terrain might cause Lev or Fly to toggle;
      level change sets <ux0,uy0> to <ux,uy>, so this spotterrain
      check always fails then, but it also sets iflags.terrain_typ */
    if (spotterrain[0] != levl()[u.ux0][u.uy0].typ
        || iflags.terrain_typ == MAX_TYPE)
        switch_terrain();

    spotdone: { if (pooleffects(TRUE))
        break spotdone;;

    check_special_room(FALSE);
    if (IS_SINK(levl()[u.ux][u.uy].typ) && Levitation())
        dosinkfall();
    if (!gi.in_steed_dismounting) { /* if dismounting, check again later */
        var pit;

        /* if levitation is due to time out at the end of this
           turn, allowing it to do so could give the perception
           that a trap here is being triggered twice, so adjust
           the timeout to prevent that */
        if (trap && (HLevitation() & TIMEOUT) == 1
            && !(ELevitation() || (HLevitation() & ~(I_SPECIAL | TIMEOUT)))) {
            if (rn2(2)) { /* defer timeout */
                incr_itimeout(ref_of(u.uprops[LEVITATION], "intrinsic"), 1);
            } else { /* timeout early */
                if (float_down(I_SPECIAL | TIMEOUT, 0)) {
                    /* levitation has ended; we've already triggered
                       any trap and [usually] performed autopickup */
                    trap = null;
                    pick = FALSE;
                }
            }
        }
        /*
         * If not a pit, pickup before triggering trap.
         * If pit, trigger trap before pickup.
         */
        pit = (trap && is_pit(trap.ttyp) ? 1 : 0);
        if (pick && !pit)
            pickup(1);

        if (trap) {
            /*
             * dotrap on a fire trap calls melt_ice() which triggers
             * spoteffects() (again) which can trigger the same fire
             * trap (again).  Use static spottrap to prevent that.
             * We track spottraptyp because some traps morph (landmine
             * to pit) and any new trap type should get triggered.
             */
            if (!spottrap[0] || spottraptyp[0] != trap.ttyp) {
                spottrap[0] = trap;
                spottraptyp[0] = trap.ttyp;
                dotrap(trap, unsigned(trapflag)); /* fall into arrow trap, etc. */
                spottrap[0] = null;
                spottraptyp[0] = NO_TRAP;
            }
        }
        if (pick && pit)
            pickup(1);
    }
    /* Warning alerts you to ice danger */
    if (Warning() && is_ice(u.ux, u.uy)) {
        var icewarnings = static_array("spoteffects.icewarnings", ptr_to(char), null, [
            _("The ice seems very soft and slushy."),
            _("You feel the ice shift beneath you!"),
            _("The ice, is gonna BREAK!"), /* The Dead Zone */
        ]);
        var time_left = spot_time_left(u.ux, u.uy, MELT_ICE_AWAY);

        if (time_left && time_left < 15)
            pline(_("%s"), icewarnings[(time_left < 5) ? 2
                                    : (time_left < 10) ? 1
                                      : 0]);
    }

    if ((mtmp = m_at(u.ux, u.uy)) != null && !u.uswallow) {
        mtmp.mundetected = mtmp.msleeping = 0;
        switch (mtmp.data.mlet) {
        case S_PIERCER:
            pline(_("%s suddenly drops from the %s!"), Amonnam(mtmp),
                  ceiling(u.ux, u.uy));
            if (mtmp.mtame) { /* jumps to greet you, not attack */
                ;
            } else if (hard_helmet(uarmh)) {
                pline(_("Its blow glances off your %s."),
                      helm_simple_name(uarmh));
            } else if (u.uac + 3 <= rnd(20)) {
                You(_("are almost hit by %s!"),
                    x_monnam(mtmp, ARTICLE_A, _("falling"), 0, TRUE));
            } else {
                var dmg;

                You(_("are hit by %s!"),
                    x_monnam(mtmp, ARTICLE_A, _("falling"), 0, TRUE));
                dmg = d(4, 6);
                if (Half_physical_damage())
                    dmg = Math.trunc((dmg + 1) / 2);
                mdamageu(mtmp, dmg);
            }
            break;
        default: /* monster surprises you. */
            if (mtmp.mtame)
                pline(_("%s jumps near you from the %s."), Amonnam(mtmp),
                      ceiling(u.ux, u.uy));
            else if (mtmp.mpeaceful) {
                You(_("surprise %s!"),
                    Blind() && !sensemon(mtmp) ? something() : a_monnam(mtmp));
                mtmp.mpeaceful = 0;
            } else
                pline(_("%s attacks you by surprise!"), Amonnam(mtmp));
            break;
        }
        mnexto(mtmp, RLOC_NOMSG); /* have to move the monster */
    }
 }
    if (!--inspoteffects[0]) {
        spotterrain[0] = STONE; /* 0 */
        spotloc.x = spotloc.y = 0;
    }
    return;
}

/* returns first matching monster */
function monstinroom(mdat, roomno) { /* struct monst * */
    let mtmp;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (mtmp.data == mdat
            && strchr(in_rooms(mtmp.mx, mtmp.my, 0), roomno + ROOMOFFSET))
            return mtmp;
    }
    return null;
}

/* check whether room contains a particular type of furniture */
function furniture_present(furniture, roomno) { /* boolean */
    let x, y, lx, ly, hx, hy;
    let sroom = svr.rooms[roomno];

    ly = sroom.ly, hy = sroom.hy;
    lx = sroom.lx; hx = sroom.hx;
    /* the inside_room() check handles irregularly shaped rooms */
    for (y = ly; y <= hy; ++y)
        for (x = lx; x <= hx; ++x)
            if (levl()[x][y].typ == furniture && inside_room(sroom, x, y))
                return TRUE;
    return FALSE;
}

export function in_rooms(x, y, typewanted) { /* char * */
    let buf = static_array("in_rooms.buf", char, 5);
    let rno = 0, ptr = buf + 4;
    let typefound, min_x, min_y, max_x, max_y_offset, step;
    let lev;

    switch (rno = levl()[x][y].roomno) {
    case NO_ROOM:
        return ptr;
    case SHARED:
        step = 2;
        break;
    case SHARED_PLUS:
        step = 1;
        break;
    default: /* i.e. a regular room # */
        if (((!typewanted || ((typefound = elt(svr.rooms, (rno - ROOMOFFSET)).rtype) == typewanted)) || ((typewanted == SHOPBASE) && (typefound > SHOPBASE))))
            chars[(--ptr)] = rno;
        return ptr;
    }

    min_x = x - 1;
    max_x = x + 1;
    if (x < 1)
        min_x += step;
    else if (x >= COLNO)
        max_x -= step;

    min_y = y - 1;
    max_y_offset = 2;
    if (min_y < 0) {
        min_y += step;
        max_y_offset -= step;
    } else if ((min_y + max_y_offset) >= ROWNO)
        max_y_offset -= step;

    for (x = min_x; x <= max_x; x += step) {
        lev = levl()[x][min_y];
        y = 0;
        if ((rno = ptr_add(lev, y).roomno) >= ROOMOFFSET && !strchr(ptr, rno)
            && ((!typewanted || ((typefound = elt(svr.rooms, (rno - ROOMOFFSET)).rtype) == typewanted)) || ((typewanted == SHOPBASE) && (typefound > SHOPBASE))))
            chars[(--ptr)] = rno;
        y += step;
        if (y > max_y_offset)
            continue;
        if ((rno = ptr_add(lev, y).roomno) >= ROOMOFFSET && !strchr(ptr, rno)
            && ((!typewanted || ((typefound = elt(svr.rooms, (rno - ROOMOFFSET)).rtype) == typewanted)) || ((typewanted == SHOPBASE) && (typefound > SHOPBASE))))
            chars[(--ptr)] = rno;
        y += step;
        if (y > max_y_offset)
            continue;
        if ((rno = ptr_add(lev, y).roomno) >= ROOMOFFSET && !strchr(ptr, rno)
            && ((!typewanted || ((typefound = elt(svr.rooms, (rno - ROOMOFFSET)).rtype) == typewanted)) || ((typewanted == SHOPBASE) && (typefound > SHOPBASE))))
            chars[(--ptr)] = rno;
    }
    return ptr;
}

/* is (x,y) in a town? */
export function in_town(x, y) { /* boolean */
    let sroom;
    let has_subrooms = FALSE;

    if (!svl.level.flags.has_town)
        return FALSE;

    /*
     * See if (x,y) is in a room with subrooms, if so, assume it's the
     * town.  If there are no subrooms, the whole level is in town.
     */
    for (sroom = ptr_add(svr.rooms[0], 0); sroom.hx > 0; sroom = ptr_add(sroom, 1)) {
        if (sroom.nsubrooms > 0) {
            has_subrooms = TRUE;
            if (inside_room(sroom, x, y))
                return TRUE;
        }
    }

    return +!has_subrooms;
}

function move_update(newlev) { /* void */
    let c, ptr1, ptr2, ptr3, ptr4;

    strcpy(u.urooms0, u.urooms);
    strcpy(u.ushops0, u.ushops);
    if (newlev) {
        memset(u.urooms, ord('\0'), sizeof_member(u, "urooms"));
        memset(u.uentered, ord('\0'), sizeof_member(u, "uentered"));
        memset(u.ushops, ord('\0'), sizeof_member(u, "ushops"));
        memset(u.ushops_entered, ord('\0'), sizeof_member(u, "ushops_entered"));
        strcpy(u.ushops_left, u.ushops0);
        return;
    }
    strcpy(u.urooms, in_rooms(u.ux, u.uy, 0));

    for (ptr1 = u.urooms, ptr2 = u.uentered,
         ptr3 = u.ushops, ptr4 = u.ushops_entered; chars[ptr1]; ptr1++) {
        c = chars[ptr1];
        if (!strchr(u.urooms0, c))
            chars[ptr2++] = c;
        if (IS_SHOP(c - ROOMOFFSET)) {
            chars[ptr3++] = c;
            if (!strchr(u.ushops0, c))
                chars[ptr4++] = c;
        }
    }
    chars[ptr2] = ord('\0'), chars[ptr3] = ord('\0'), chars[ptr4] = ord('\0');

    /* filter u.ushops0 -> u.ushops_left */
    for (ptr1 = u.ushops0, ptr2 = u.ushops_left; chars[ptr1]; ptr1++)
        if (!strchr(u.ushops, chars[ptr1]))
            chars[ptr2++] = chars[ptr1];
    chars[ptr2] = ord('\0');
}

/* possibly deliver a one-time room entry message */
export function check_special_room(newlev) { /* void */
    let mtmp;
    let ptr;

    move_update(newlev);

    if (chars[u.ushops0])
        u_left_shop(u.ushops_left, newlev);

    /*
     * Check for attaining 'entered Mine Town' achievement.
     * Most of the Mine Town variations have the town in one large room
     * containing a bunch of subrooms; we check for entering that large
     * room.  However, two of the variations cover the whole level rather
     * than include a room with subrooms.  We need to check for town entry
     * before the possible early return for not having entered a room in
     * case we have arrived in the town but have not entered any room.
     *
     * TODO: change the minetn variants which don't include any town
     * boundary to have such.
     */
    if (svl.level.flags.has_town && !svc.context.achieveo.minetn_reached
        && In_mines(u.uz) && in_town(u.ux, u.uy)) {
        record_achievement(ACH_TOWN);
        svc.context.achieveo.minetn_reached = TRUE;
    }

    if (!chars[u.uentered] && !chars[u.ushops_entered]) /* implied by newlev */
        return; /* no entrance messages necessary */

    /* Did we just enter a shop? */
    if (chars[u.ushops_entered])
        u_entered_shop(u.ushops_entered);

    for (ptr = u.uentered + 0; chars[ptr]; ptr++) {
        let roomno = chars[ptr] - ROOMOFFSET, rt = svr.rooms[roomno].rtype;
        let msg_given = TRUE;

        /* Did we just enter some other special room? */
        /* vault.c insists that a vault remain a VAULT,
         * and temples should remain TEMPLEs,
         * but everything else gives a message only the first time */
        switch (rt) {
        case ZOO:
            pline(_("Welcome to David's treasure zoo!"));
            break;
        case SWAMP:
            pline(_("It %s rather %s down here."), Blind() ? _("feels") : _("looks"),
                  Blind() ? _("humid") : _("muddy"));
            break;
        case COURT:
            You(_("enter an opulent%s room!"),
                /* the throne room in Sam quest home level lacks a throne */
                !furniture_present(THRONE, roomno) ? _("") : _(" throne"));
            break;
        case LEPREHALL:
            You(_("enter a leprechaun hall!"));
            break;
        case MORGUE:
            if (midnight()) {
                let run = u_locomotion(_("Run"));

                pline(_("%s away!  %s away!"), run, run);
            } else
                You(_("have an uncanny feeling..."));
            break;
        case BEEHIVE:
            You(_("enter a giant beehive!"));
            break;
        case COCKNEST:
            You(_("enter a disgusting nest!"));
            break;
        case ANTHOLE:
            You(_("enter an anthole!"));
            break;
        case BARRACKS:
            if (monstinroom(mons[PM_SOLDIER], roomno)
                || monstinroom(mons[PM_SERGEANT], roomno)
                || monstinroom(mons[PM_LIEUTENANT], roomno)
                || monstinroom(mons[PM_CAPTAIN], roomno))
                You(_("enter a military barracks!"));
            else
                You(_("enter an abandoned barracks."));
            break;
        case DELPHI: {
            let oracle = monstinroom(mons[PM_ORACLE], roomno);

            if (oracle) {
                   ;
                if (!oracle.mpeaceful)
                    verbalize(_("You're in Delphi, %s."), svp.plname);
                else
                    verbalize(_("%s, %s, welcome to Delphi!"),
                              Hello(null), svp.plname);
            } else
                msg_given = FALSE;
            break;
        }
        case TEMPLE:
            intemple(roomno + ROOMOFFSET);
            /* FALLTHROUGH */;
        /*FALLTHRU*/
        default:
            msg_given = +(rt == TEMPLE || rt >= SHOPBASE);
            rt = 0;
            break;
        }
        if (msg_given)
            room_discovered(roomno);

        if (rt != 0) {
            svr.rooms[roomno].rtype = OROOM;
            if (!search_special(rt)) {
                /* No more room of that type */
                switch (rt) {
                case COURT:
                    svl.level.flags.has_court = 0;
                    break;
                case SWAMP:
                    svl.level.flags.has_swamp = 0;
                    break;
                case MORGUE:
                    svl.level.flags.has_morgue = 0;
                    break;
                case ZOO:
                    svl.level.flags.has_zoo = 0;
                    break;
                case BARRACKS:
                    svl.level.flags.has_barracks = 0;
                    break;
                case TEMPLE:
                    svl.level.flags.has_temple = 0;
                    break;
                case BEEHIVE:
                    svl.level.flags.has_beehive = 0;
                    break;
                }
            }
            if (rt == COURT || rt == SWAMP || rt == MORGUE || rt == ZOO)
                for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
                    if (DEADMONSTER(mtmp))
                        continue;
                    if (!isok(mtmp.mx,mtmp.my)
                        || roomno != (levl()[mtmp.mx][mtmp.my].roomno))
                        continue;
                    if (!Stealth() && !rn2(3)) {
                        wake_msg(mtmp, FALSE);
                        mtmp.msleeping = 0;
                    }
                }
        }
    }
    return;
}

/* returns
   1 = cannot pickup, time taken
   0 = cannot pickup, no time taken
  -1 = do normal pickup
  -2 = loot the monster */
function pickup_checks() { /* int */
    let traphere;

    /* uswallow case added by GAN 01/29/87 */
    if (u.uswallow) {
        if (!u.ustuck.minvent) {
            if (digests(u.ustuck.data)) {
                You(_("pick up %s tongue."), s_suffix(mon_nam(u.ustuck)));
                pline(_("But it's kind of slimy, so you drop it."));
            } else
                You(_("don't %s anything in here to pick up."),
                    Blind() ? _("feel") : _("see"));
            return 1;
        } else {
            return -2; /* loot the monster inventory */
        }
    }
    if (is_pool(u.ux, u.uy)) {
        if (Wwalking() || is_floater(gy.youmonst.data)
            || is_clinger(gy.youmonst.data) || (Flying() && !Breathless())) {
            You(_("cannot dive into the %s to pick things up."),
                hliquid(_("water")));
            return 0;
        } else if (!Underwater()) {
            You_cant(_("even see the bottom, let alone pick up %s."), something());
            return 0;
        }
    }
    if (is_lava(u.ux, u.uy)) {
        if (Wwalking() || is_floater(gy.youmonst.data)
            || is_clinger(gy.youmonst.data) || (Flying() && !Breathless())) {
            You_cant(_("reach the bottom to pick things up."));
            return 0;
        } else if (!likes_lava(gy.youmonst.data)) {
            You(_("would burn to a crisp trying to pick things up."));
            return 0;
        }
    }
    if (!OBJ_AT(u.ux, u.uy)) {
        let lev = levl()[u.ux][u.uy];

        if (IS_THRONE(lev.typ))
            pline(_("It must weigh%s a ton!"), lev.flags ? _(" almost") : _(""));
        else if (IS_SINK(lev.typ))
            pline_The(_("plumbing connects it to the floor."));
        else if (IS_GRAVE(lev.typ))
            You(_("don't need a gravestone.  Yet."));
        else if (IS_FOUNTAIN(lev.typ))
            You(_("could drink the %s..."), hliquid(_("water")));
        else if (IS_DOOR(lev.typ) && (lev.flags & D_ISOPEN))
            pline(_("It won't come off the hinges."));
        else if (IS_ALTAR(lev.typ))
            pline(_("Moving the altar would be a very bad idea."));
        else if (lev.typ == STAIRS)
            pline_The(_("stairs are solidly affixed."));
        else
            There(_("is nothing here to pick up."));
        return 0;
    }
    traphere = t_at(u.ux, u.uy);
    if (!can_reach_floor((traphere && is_pit(traphere.ttyp) ? 1 : 0))) {
        /* if there's a hole here, any objects here clearly aren't at
           the bottom so only check for pits */
        if (traphere && uteetering_at_seen_pit(traphere)) {
            You(_("cannot reach the bottom of the pit."));
        } else if (u.usteed && P_SKILL(P_RIDING) < P_BASIC) {
            rider_cant_reach();
        } else if (Blind()) {
            You(_("cannot reach anything here."));
        } else {
            let surf = surface(u.ux, u.uy);

            if (traphere) {
                if (traphere.ttyp == HOLE)
                    surf = _("edge of the hole");
                else if (traphere.ttyp == TRAPDOOR)
                    surf = _("trap door");
            }
            You(_("cannot reach the %s."), surf);
        }
        return 0;
    }
    return -1; /* can do normal pickup */
}

/* the #pickup command */
export function dopickup() { /* int */
    const $frame = stack_frame(); try {
    let count, tmpcount = stack_var(int), ret;

    count = int(gc.command_count);
    gm.multi = 0; /* always reset */

    if ((ret = pickup_checks()) >= 0) {
        return ret ? ECMD_TIME : ECMD_OK;
    } else if (ret == -2) {
        tmpcount[0] = -count;
        return loot_mon(u.ustuck, tmpcount, 0) ? ECMD_TIME
                                                            : ECMD_OK;
    } /* else ret == -1 */

    return pickup(-count) ? ECMD_TIME : ECMD_OK;
    } finally { stack_pop($frame); }
}

/* stop running if we see something interesting next to us */
/* turn around a corner if that is the only way we can proceed */
/* do not turn left or right twice */
export function lookaround() { /* void */
    let $goto = null;
    var x, y;
    var i, x0 = 0, y0 = 0, m0 = 1, i0 = 9;
    var corrct = 0, noturn = 0;
    var mtmp;

    /* Grid bugs stop if trying to move diagonal, even if blind.  Maybe */
    /* they polymorphed while in the middle of a long move. */
    if (NODIAG(u.umonnum) && u.dx && u.dy) {
        You(_("cannot move diagonally."));
        nomul(0);
        return;
    }

    if (Blind() || svc.context.run == 0)
        return;
    $goto_stop: for (;;) { switch ($goto) { default: case "stop": for ($goto || (x = u.ux - 1); $goto || (x <= u.ux + 1); x++)
        $out_bcorr: for ($goto || (y = u.uy - 1); $goto || (y <= u.uy + 1); y++) {
            $goto_bcorr: for (;;) { switch ($goto) { default: var infront = +(x == u.ux + u.dx && y == u.uy + u.dy);

            /* ignore out of bounds, and our own location */
            if (!isok(x, y) || u_at(x, y))
                continue $out_bcorr;
            /* (grid bugs) ignore diagonals */
            if (NODIAG(u.umonnum) && x != u.ux && y != u.uy)
                continue $out_bcorr;

            /* can we see a monster there? */
            if ((mtmp = m_at(x, y)) != null
                && M_AP_TYPE(mtmp) != M_AP_FURNITURE
                && M_AP_TYPE(mtmp) != M_AP_OBJECT
                && mon_visible(mtmp)) {
                /* running movement and not a hostile monster */
                /* OR it blocks our move direction and we're not traveling */
                if ((svc.context.run != 1 && !is_safemon(mtmp))
                    || (infront && !svc.context.travel)) {
                    if (flags.mention_walls)
                        pline_xy(x, y, _("%s blocks your path."),
                                 upstart(a_monnam(mtmp)));
                    { $goto = "stop"; continue $goto_stop; }
                }
            }

            /* stone is never interesting */
            if (levl()[x][y].typ == STONE)
                continue $out_bcorr;
            /* ignore the square we're moving away from */
            if (x == u.ux - u.dx && y == u.uy - u.dy)
                continue $out_bcorr;

            /* stop for traps, sometimes */
            if (avoid_moving_on_trap(x, y,
                                     (infront && svc.context.run > 1 ? 1 : 0))) {
                if (svc.context.run == 1)
                    { $goto = "bcorr"; continue $goto_bcorr; }; /* if you must */
                if (infront)
                    { $goto = "stop"; continue $goto_stop; };
            }

            /* more uninteresting terrain */
            case "bcorr": if (!$goto && (IS_OBSTRUCTED(levl()[x][y].typ) || levl()[x][y].typ == ROOM
                || IS_AIR(levl()[x][y].typ) || levl()[x][y].typ == ICE)) {
                continue $out_bcorr;
            } else if (!$goto && (closed_door(x, y) || (mtmp && is_door_mappear(mtmp)))) {
                /* a closed door? */
                /* ignore if diagonal */
                if (x != u.ux && y != u.uy)
                    continue $out_bcorr;
                if (svc.context.run != 1 && !svc.context.travel) {
                    if (flags.mention_walls) {
                        set_msg_xy(x, y);
                        You(_("stop in front of the door."));
                    }
                    { $goto = "stop"; continue $goto_stop; }
                }
                /* orthogonal to a closed door, consider it a corridor */
                { $goto = "bcorr"; continue $goto_bcorr; }
            } else if ($goto || (levl()[x][y].typ == CORR)) {
                /* corridor */
 $goto = null;
                if (levl()[u.ux][u.uy].typ != ROOM) {
                    /* running or traveling */
                    if (svc.context.run == 1 || svc.context.run == 3
                        || svc.context.run == 8) {
                        /* distance from x,y to location we're moving to */
                        i = dist2(x, y, u.ux + u.dx, u.uy + u.dy);
                        /* ignore if not on or directly adjacent to it */
                        if (i > 2)
                            continue $out_bcorr;
                        /* x,y is (adjacent to) the location we're moving to;
                           if we've seen one corridor, and x,y is not directly
                           orthogonally next to it, mark noturn */
                        if (corrct == 1 && dist2(x, y, x0, y0) != 1)
                            noturn = 1;
                        /* if previous x,y was diagonal, now x,y is
                           orthogonal (or this is first time we're here) */
                        if (i < i0) {
                            i0 = i;
                            x0 = x;
                            y0 = y;
                            m0 = mtmp ? 1 : 0;
                        }
                    }
                    corrct++;
                }
                continue $out_bcorr;
            } else if (is_pool_or_lava(x, y)) {
                if (infront && avoid_moving_on_liquid(x, y, TRUE))
                    { $goto = "stop"; continue $goto_stop; };
                continue $out_bcorr;
            } else { /* e.g. objects or trap or stairs */
                if (svc.context.run == 1)
                    { $goto = "bcorr"; continue $goto_bcorr; };
                if (svc.context.run == 8)
                    continue $out_bcorr;
                if (mtmp)
                    continue $out_bcorr; /* d */
                if (((x == u.ux - u.dx) && (y != u.uy + u.dy))
                    || ((y == u.uy - u.dy) && (x != u.ux + u.dx)))
                    continue $out_bcorr;
            }
 case "stop": $goto = null;
            nomul(0); } break; }
            return;
        } /* end for loops */

    if (corrct > 1 && svc.context.run == 2) {
        if (flags.mention_walls)
            pline_The(_("corridor widens here."));
        { $goto = "stop"; continue $goto_stop; }
    } } break; }
    if ((svc.context.run == 1 || svc.context.run == 3 || svc.context.run == 8)
        && !noturn && !m0 && i0
        && (corrct == 1 || (corrct == 2 && i0 == 1))) {
        /* make sure that we do not turn too far */
        if (i0 == 2) {
            if (u.dx == y0 - u.uy && u.dy == u.ux - x0)
                i = 2; /* straight turn right */
            else
                i = -2; /* straight turn left */
        } else if (u.dx && u.dy) {
            if ((u.dx == u.dy && y0 == u.uy) || (u.dx != u.dy && y0 != u.uy))
                i = -1; /* half turn left */
            else
                i = 1; /* half turn right */
        } else {
            if ((x0 - u.ux == y0 - u.uy && !u.dy)
                || (x0 - u.ux != y0 - u.uy && u.dy))
                i = 1; /* half turn right */
            else
                i = -1; /* half turn left */
        }

        i += u.last_str_turn;
        if (i <= 2 && i >= -2) {
            u.last_str_turn = i;
            u.dx = x0 - u.ux;
            u.dy = y0 - u.uy;
        }
    }
}

/* check for a doorway which lacks its door (NODOOR or BROKEN) */
export function doorless_door(x, y) { /* boolean */
    let lev_p = levl()[x][y];

    if (!IS_DOOR(lev_p.typ))
        return FALSE;
    /* all rogue level doors are doorless but disallow diagonal access, so
       we treat them as if their non-existent doors were actually present */
    if (Is_rogue_level(u.uz))
        return FALSE;
    return +!(lev_p.flags & ~(D_NODOOR | D_BROKEN));
}

/* used by drown() to check whether hero can crawl from water to <x,y>;
   also used by findtravelpath() when destination is one step away */
export function crawl_destination(x, y) { /* boolean */
    /* is location ok in general? */
    if (!goodpos(x, y, gy.youmonst, 0))
        return FALSE;

    /* orthogonal movement is unrestricted when destination is ok */
    if (x == u.ux || y == u.uy)
        return TRUE;

    /* diagonal movement has some restrictions */
    if (NODIAG(u.umonnum))
        return FALSE; /* poly'd into a grid bug... */
    if (Passes_walls())
        return TRUE; /* or a xorn... */
    /* pool could be next to a door, conceivably even inside a shop */
    if (IS_DOOR(levl()[x][y].typ) && (!doorless_door(x, y) || block_door(x, y)))
        return FALSE;
    /* finally, are we trying to squeeze through a too-narrow gap? */
    return +!(bad_rock(gy.youmonst.data, u.ux, y)
             && bad_rock(gy.youmonst.data, x, u.uy)
             && cant_squeeze_thru(gy.youmonst));
}

/* something like lookaround, but we are not running */
/* react only to monsters that might hit us */
export function monster_nearby() { /* int */
    let x, y;
    let mtmp;

    /* Also see the similar check in dochugw() in monmove.c */
    for (x = u.ux - 1; x <= u.ux + 1; x++)
        for (y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y) || u_at(x, y))
                continue;
            if ((mtmp = m_at(x, y)) != null
                && M_AP_TYPE(mtmp) != M_AP_FURNITURE
                && M_AP_TYPE(mtmp) != M_AP_OBJECT
                && (Hallucination()
                    || (!mtmp.mpeaceful && !noattacks(mtmp.data)))
                && (!is_hider(mtmp.data) || !mtmp.mundetected)
                && !helpless(mtmp)
                && !onscary(u.ux, u.uy, mtmp) && canspotmon(mtmp))
                return 1;
        }
    return 0;
}

export function end_running(and_travel) { /* void */
    /* moveloop() suppresses time_botl when context.run is non-zero; when
       running stops, update 'time' even if other botl status is unchanged */
    if (svc.context.run) {
        svc.context.run = 0;
        if (flags.time)
            disp.time_botl = TRUE;
        /* classify_terrain() suppresses setting disp.botl when
           running; after that, it can no longer compare current terrain
           against iflaga.terrain_typ to detect a change, so recompute */
        if (flags.terrainstatus) {
            iflags.terrain_typ = MAX_TYPE; /* "none of the above" value */
            classify_terrain();
        }
    }

    /* 'context.mv' isn't travel but callers who want to end travel
       all clear it too */
    if (and_travel)
        svc.context.travel = svc.context.travel1 = svc.context.mv = 0;
    if (gt.travelmap) {
        selection_free(gt.travelmap, TRUE);
        gt.travelmap = null;
    }
    /* cancel multi */
    if (gm.multi > 0)
        gm.multi = 0;
}

export function nomul(nval) { /* void */
    if (gm.multi < nval)
        return;              /* This is a bug fix by ab@unido */
    disp.botl |= +(gm.multi >= 0);
    u.uinvulnerable = FALSE; /* Kludge to avoid ctrl-C bug -dlc */
    u.usleep = 0;
    gm.multi = nval;
    if (nval == 0)
        gm.multi_reason = 0, chars[gm.multireasonbuf + 0] = ord('\0');
    end_running(TRUE);
    cmdq_clear(CQ_CANNED);
}

/* called when a non-movement, multi-turn action has completed */
export function unmul(msg_override) { /* void */
    disp.botl = TRUE;
    gm.multi = 0; /* caller will usually have done this already */
    if (msg_override)
        gn.nomovemsg = msg_override;
    else if (!gn.nomovemsg)
        gn.nomovemsg = You_can_move_again();
    if (chars[gn.nomovemsg]) {
        pline(_("%s"), gn.nomovemsg);
        /* follow "you survived that attempt on your life" with a message
           about current form if it's not the default; primarily for
           life-saving while turning into green slime but is also a reminder
           if life-saved while poly'd and Unchanging (explore or wizard mode
           declining to die since can't be both Unchanging and Lifesaved) */
        if (Upolyd() && !strncmpi(gn.nomovemsg, _("You survived that "), 18))
            You(_("are %s."),
                an(pmname(mons[u.umonnum], Ugender()))); /* (ignore Hallu) */
    }
    gn.nomovemsg = 0;
    u.usleep = 0;
    gm.multi_reason = 0, chars[gm.multireasonbuf + 0] = ord('\0');

    if (ga.afternmv) {
        let f = ga.afternmv;

        /* clear afternmv before calling it (to override the
           encumbrance hack for levitation--see weight_cap()) */
        ga.afternmv = null;
        f();
    }
}

function maybe_wail() { /* void */
    let powers = static_array("maybe_wail.powers", short, null, [ TELEPORT, SEE_INVIS, POISON_RES, COLD_RES,
                              SHOCK_RES, FIRE_RES, SLEEP_RES, DISINT_RES,
                              TELEPORT_CONTROL, STEALTH, FAST, INVIS ]);

    if (svm.moves <= gw.wailmsg + 50)
        return;

    gw.wailmsg = svm.moves;
    if (Role_if(PM_WIZARD) || Race_if(PM_ELF) || Role_if(PM_VALKYRIE)) {
        let who;
        let i, powercnt;

        who = (Role_if(PM_WIZARD) || Role_if(PM_VALKYRIE)) ? gu.urole.name.m
                                                           : _("Elf");
        if (u.uhp == 1) {
            pline(_("%s is about to die."), who);
        } else {
            for (i = 0, powercnt = 0; i < SIZE(powers); ++i)
                if (u.uprops[powers[i]].intrinsic & INTRINSIC)
                    ++powercnt;

            pline((powercnt >= 4) ? _("%s, all your powers will be lost...")
                                  : _("%s, your life force is running out."),
                  who);
        }
    } else {
         ;
        You_hear(u.uhp == 1 ? _("the wailing of the Banshee...")
                            : _("the howling of the CwnAnnwn..."));
    }
}

/* show a message how much damage you received */
export function showdamage(dmg) { /* void */
    if (!iflags.showdamage || !dmg)
        return;

    pline(_("[HP %i, %i left]"), -dmg, Upolyd() ? u.mh : u.uhp);
}

export function losehp(n, knam, k_format) { /* void */
    disp.botl = TRUE; /* u.uhp or u.mh is changing */
    end_running(TRUE);
    if (Upolyd()) {
        u.mh -= n;
        showdamage(n);
        if (u.mhmax < u.mh)
            u.mhmax = u.mh;
        if (u.mh < 1)
            rehumanize();
        else if (n > 0 && u.mh * 10 < u.mhmax && Unchanging())
            maybe_wail();
        return;
    }

    u.uhp -= n;
    showdamage(n);
    if (u.uhp > u.uhpmax)
        u.uhpmax = u.uhp; /* perhaps n was negative */
    if (u.uhp < 1) {
        svk.killer.format = k_format;
        if (svk.killer.name != knam) /* the thing that killed you */
            strcpy(svk.killer.name, knam ? knam : _(""));
        urgent_pline(_("You die..."));
        done(DIED);
    } else if (n > 0 && u.uhp * 10 < u.uhpmax) {
        maybe_wail();
    }
}

export function weight_cap() { /* int */
    let carrcap, save_ELev = ELevitation(), save_BLev = BLevitation();

    /* boots take multiple turns to wear but any properties they
       confer are enabled at the start rather than the end; that
       causes message sequencing issues for boots of levitation
       so defer their encumbrance benefit until they're fully worn */
    if (ga.afternmv == Boots_on && (ELevitation() & W_ARMF) != 0) {
        u.uprops[LEVITATION].extrinsic = and64(u.uprops[LEVITATION].extrinsic, ~W_ARMF);
        float_vs_flight(); /* in case Levitation is blocking Flying */
    }
    /* levitation is blocked by being trapped in the floor, but it still
       functions enough in that situation to enhance carrying capacity */
    u.uprops[LEVITATION].blocked = and64(u.uprops[LEVITATION].blocked, ~I_SPECIAL);

    carrcap = (WT_WEIGHTCAP_STRCON * (ACURRSTR() + ACURR(A_CON)))
               + WT_WEIGHTCAP_SPARE;
    if (Upolyd()) {
        /* consistent with can_carry() in mon.c */
        if (gy.youmonst.data.mlet == S_NYMPH)
            carrcap = MAX_CARR_CAP;
        else if (!gy.youmonst.data.cwt)
            carrcap = Math.trunc((carrcap * gy.youmonst.data.msize) / MZ_HUMAN);
        else if (!strongmonst(gy.youmonst.data)
                 || (strongmonst(gy.youmonst.data)
                     && (gy.youmonst.data.cwt > WT_HUMAN)))
            carrcap = Math.trunc(carrcap * gy.youmonst.data.cwt / WT_HUMAN);
    }

    if (Levitation() || Is_airlevel(u.uz) /* pugh@cornell */
        || (u.usteed && strongmonst(u.usteed.data))) {
        carrcap = MAX_CARR_CAP;
    } else {
        if (carrcap > MAX_CARR_CAP)
            carrcap = MAX_CARR_CAP;
        if (!Flying()) {
            if (EWounded_legs() & LEFT_SIDE)
                carrcap -= WT_WOUNDEDLEG_REDUCT;
            if (EWounded_legs() & RIGHT_SIDE)
                carrcap -= WT_WOUNDEDLEG_REDUCT;
        }
    }

    if (ELevitation() != save_ELev || BLevitation() != save_BLev) {
        u.uprops[LEVITATION].extrinsic = save_ELev;
        u.uprops[LEVITATION].blocked = save_BLev;
        float_vs_flight();
    }

    return int(max(carrcap, 1)); /* never return 0 */
}

/* returns how far beyond the normal capacity the player is currently. */
/* inv_weight() is negative if the player is below normal capacity. */
export function inv_weight() { /* int */
    let otmp = gi.invent;
    let wt = 0;

    while (otmp) {
        if (otmp.oclass == COIN_CLASS)
            wt += int(Math.trunc((otmp.quan + 50) / 100));
        else if (otmp.otyp != BOULDER || !throws_rocks(gy.youmonst.data))
            wt = int(wt + otmp.owt);
        otmp = otmp.nobj;
    }
    gw.wc = weight_cap();
    return (wt - gw.wc);
}

/*
 * Returns 0 if below normal capacity, or the number of "capacity units"
 * over the normal capacity the player is loaded.  Max is 5.
 */
export function calc_capacity(xtra_wt) { /* int */
    let cap, wt = inv_weight() + xtra_wt;

    if (wt <= 0)
        return UNENCUMBERED;
    if (gw.wc <= 1)
        return OVERLOADED;
    cap = Math.trunc(wt * 2 / gw.wc) + 1;
    return min(cap, OVERLOADED);
}

export function near_capacity() { /* int */
    return calc_capacity(0);
}

export function max_capacity() { /* int */
    let wt = inv_weight();

    return (wt - (2 * gw.wc));
}

export function check_capacity(str) { /* boolean */
    if (near_capacity() >= EXT_ENCUMBER) {
        if (str)
            pline1(str);
        else
            You_cant(_("do that while carrying so much stuff."));
        return 1;
    }
    return 0;
}

const struct_weight_table_entry = struct("struct_weight_table_entry", {
    wtyp: unsigned,
    nm: ptr_to(char),
    wt: int, idx: int,
    unique: boolean,
});

const weightlist = static_var("weightlist", ptr_to(struct_weight_table_entry));

export function dump_weights() { /* void */
    const $frame = stack_frame(); try {
    let i, cnt = 0, nmwidth = 49, mcount = NUMMONS, ocount = NUM_OBJECTS;
    let nmbuf = stack_array(char, BUFSZ), nmbufbase = stack_array(char, BUFSZ);
    let num_entries = unsigned((mcount + ocount));

    weightlist[0] = view_of(struct_weight_table_entry, addr_of(alloc(unsigned(Math.imul(sizeof(struct_weight_table_entry), num_entries)))))
;
    decl_globals_init();
    init_objects();
    for (i = 0; i < mcount; ++i) {
        if (i != PM_LONG_WORM_TAIL) {
            let cm;

            ptr_add(weightlist[0], cnt).wt = int((mons[i].cwt));
            ptr_add(weightlist[0], cnt).idx = i;
            ptr_add(weightlist[0], cnt).wtyp = 1;
            ptr_add(weightlist[0], cnt).unique = +((mons[i].geno & G_UNIQ) != 0);
            Snprintf(nmbuf, sizeof(array_of(char, BUFSZ)), _("%07u"), ptr_add(weightlist[0], cnt).wt);
            cm = CapitalMon(mons[i].pmnames[NEUTRAL]);
            Snprintf(nmbuf + 7, sizeof(array_of(char, BUFSZ)) - 7, _("%s%s"), _("the body of "), cm                     ? the(mons[i].pmnames[NEUTRAL])
                     : ptr_add(weightlist[0], cnt).unique ? mons[i].pmnames[NEUTRAL]
                                              : an(mons[i].pmnames[NEUTRAL]))
;
            ptr_add(weightlist[0], cnt).nm = dupstr(nmbuf);
            cnt++;
        }
    }
    for (i = 0; i < ocount; ++i) {
        let oc_name = (i == SLIME_MOLD) ? _("slime mold")
                              : obj_descr[i].oc_name;
        let wt = int((objects[i].oc_weight));

        if (wt && oc_name) {
            ptr_add(weightlist[0], cnt).idx = i;
            ptr_add(weightlist[0], cnt).wt = wt;
            ptr_add(weightlist[0], cnt).wtyp = 2;
            ptr_add(weightlist[0], cnt).unique = +(objects[i].oc_unique != 0);
            objects[i].oc_name_known = 1;
            strcpy(nmbufbase, simple_typename(i));
            Snprintf(nmbuf, sizeof(array_of(char, BUFSZ)), _("%07u%s"), wt, (ptr_add(weightlist[0], cnt).unique) ? the(nmbufbase)
                                              : an(nmbufbase))
;
            ptr_add(weightlist[0], cnt).nm = dupstr(nmbuf);
            cnt++;
        }
    }
    nh_deterministic_qsort((addr_of(weightlist[0])), unsigned((cnt)), (sizeof(struct_weight_table_entry)), (cmp_weights))
;
    raw_printf(_("int all_weights[] = {"));
    for (i = 0; i < cnt; ++i) {
        if (ptr_add(weightlist[0], i).nm) {
            raw_printf(_("    %7u%s /* %*s */"), ptr_add(weightlist[0], i).wt,
                       (i == cnt - 1) ? _(" ") : _(","), -nmwidth,
                       ptr_add(weightlist[0], i).nm + 7);
            free((ptr_add(weightlist[0], i).nm)), ptr_add(weightlist[0], i).nm = 0;
        }
    }
    raw_print()(_("};"));
    raw_print()(_(""));
    free(addr_of(weightlist[0]));
    freedynamicdata();
    } finally { stack_pop($frame); }
}

function cmp_weights(p1, p2) { /* int QSORTCALLBACK */
    let i1 = view_of(struct_weight_table_entry, p1),
                              i2 = view_of(struct_weight_table_entry, p2);

   /* return (i1->wt - i2->wt); */
    return strcmp(i1.nm, i2.nm);
}

export function inv_cnt(incl_gold) { /* int */
    let otmp = gi.invent;
    let ct = 0;

    while (otmp) {
        if (incl_gold || otmp.invlet != GOLD_SYM)
            ct++;
        otmp = otmp.nobj;
    }
    return ct;
}

/* Counts the money in an object chain. */
/* Intended use is for your or some monster's inventory, */
/* now that u.gold/m.gold is gone.*/
/* Counting money in a container might be possible too. */
export function money_cnt(otmp) { /* long long */
    while (otmp) {
        if (otmp.oclass == COIN_CLASS)
            return otmp.quan;
        otmp = otmp.nobj;
    }
    return 0;
}

export function spot_checks(x, y, old_typ) { /* void */
    let new_typ = levl()[x][y].typ;
    let db_ice_now = FALSE;

    switch (old_typ) {
    case DRAWBRIDGE_UP:
        db_ice_now = +((levl()[x][y].flags & DB_UNDER) == DB_ICE);
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ICE:
        if ((new_typ != old_typ)
            || (old_typ == DRAWBRIDGE_UP && !db_ice_now)) {
            /* make sure there's no MELT_ICE_AWAY timer */
            if (spot_time_left(x, y, MELT_ICE_AWAY)) {
                spot_stop_timers(x, y, MELT_ICE_AWAY);
            }
            /* adjust things affected by the ice */
            obj_ice_effects(x, y, FALSE);
        }
        break;
    }
}

/* calculate x/y, rounding as appropriate */
export function rounddiv(x, y) { /* int */
    let r, m;
    let divsgn = 1;

    if (y == 0)
        panic(_("division by zero in rounddiv"));
    else if (y < 0) {
        divsgn = -divsgn;
        y = -y;
    }
    if (x < 0) {
        divsgn = -divsgn;
        x = -x;
    }
    r = int(Math.trunc(x / y));
    m = x % y;
    if (2 * m >= y)
        r++;

    return divsgn * r;
}

/*hack.c*/

import { ART_STING } from "./artilist.h.js";
import { A_CON, A_DEX, A_STR } from "./attrib.h.js";
import { ACURR, ACURRSTR } from "./attrib.h.macros.js";
import {
    NUM_TIPS, TIP_ENHANCE, TIP_GETPOS, TIP_SWIM, TIP_UNTRAP_MON, struct_dig_info,
} from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { DOMOVE_RUSH, DOMOVE_WALK } from "./decl.h.js";
import { Something, You_can_move_again, something } from "./decl.h.macros.js";
import {
    COIN_CLASS, GOLD_SYM, S_EEL, S_NYMPH, S_PIERCER, S_stone, WEAPON_CLASS,
} from "./defsym.h.js";
import { DISP_ALL, DISP_END, GLYPH_UNEXPLORED } from "./display.h.js";
import {
    canspotmon, glyph_is_cmap, glyph_is_invisible, glyph_is_monster, glyph_is_statue,
    glyph_is_warning, glyph_to_obj, warning_to_glyph,
} from "./display.h.macros.js";
import { MIGR_RANDOM, struct_d_level } from "./dungeon.h.js";
import {
    In_sokoban, Is_airlevel, Is_earthlevel, Is_juiblex_level, Is_medusa_level, Is_rogue_level,
    Is_waterlevel,
} from "./dungeon.h.macros.js";
import { HEADSTONE } from "./engrave.h.js";
import { PLNMSG_BACK_ON_GROUND, RUN_CRAWL, RUN_LEAP, RUN_TPORT } from "./flag.h.js";
import { ParanoidConfirm, ParanoidSwim, ParanoidTrap } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, LL_CONDUCT, QBUFSZ, ROWNO, TRUE, boolean, coordxy,
} from "./global.h.js";
import {
    ARTICLE_A, ARTICLE_NONE, ARTICLE_THE, ARTICLE_YOUR, BRK_BY_HERO, BRK_FROM_INV, BRK_KNOWN2BREAK,
    BRK_KNOWN2NOTBREAK, BRK_MELEE, CMDQ_EXTCMD, CQ_CANNED, DIED, DISMOUNT_FELL, DISMOUNT_GENERIC,
    DO_MOVE, ECMD_OK, ECMD_TIME, EXT_ENCUMBER, FAILEDUNTRAP, FOOT, GP_ALLOW_U, HVY_ENCUMBER,
    LAUNCH_KNOWN, MOD_ENCUMBER, NHCORE_GETPOS_TIP, NO_KILLER_PREFIX, NO_PART, NO_TRAP_FLAGS, N_DIRS,
    OVERLOADED, RLOC_NOMSG, ROLL, SHOP_DOOR_COST, SLT_ENCUMBER, SUPPRESS_SADDLE, TEST_MOVE,
    TEST_TRAP, TEST_TRAV, UNENCUMBERED, invlet_basic,
} from "./hack.h.js";
import {
    Maybe_Half_Phys, NODIAG, SHOP_WALL_DMG, You1, distu, max, min, pline1, qsort,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { ESHK, has_mgivenname } from "./mextra.h.macros.js";
import {
    ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, COURT, DELPHI, LEPREHALL, MORGUE, NO_ROOM, OROOM,
    ROOMOFFSET, SHARED, SHARED_PLUS, SHOPBASE, SWAMP, TEMPLE, ZOO,
} from "./mkroom.h.js";
import { AD_ANY, AD_CORR, AD_FIRE, AD_RUST, AT_EXPL } from "./monattk.h.js";
import {
    amorphous, bigmonst, ceiling_hider, digests, grounded, hides_under, is_clinger, is_floater,
    is_hider, is_rider, is_whirly, likes_lava, metallivorous, monsndx, needspick, noncorporeal,
    passes_walls, slithy, strongmonst, throws_rocks, tunnels, type_is_pname, verysmall,
} from "./mondata.h.macros.js";
import { G_UNIQ, MZ_HUMAN, NEUTRAL } from "./monflag.h.js";
import { M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT, struct_monst } from "./monst.h.js";
import {
    DEADMONSTER, M_AP_TYPE, U_AP_TYPE, helpless, is_door_mappear, mundisplaceable, resists_cold,
} from "./monst.h.macros.js";
import {
    NUMMONS, PM_CAPTAIN, PM_DISPLACER_BEAST, PM_ELF, PM_LIEUTENANT, PM_LONG_WORM_TAIL, PM_ORACLE,
    PM_SERGEANT, PM_SOLDIER, PM_VALKYRIE, PM_WIZARD, PM_WIZARD_OF_YENDOR,
} from "./monsters.h.js";
import { struct_obj } from "./obj.h.js";
import { is_blade, is_flimsy, is_pick, is_weptool, u_wield_art } from "./obj.h.macros.js";
import {
    BOULDER, CANDELABRUM_OF_INVOCATION, CORPSE, DWARVISH_MATTOCK, HEAVY_IRON_BALL, LEVITATION_BOOTS,
    NUM_OBJECTS, PICK_AXE, RIN_LEVITATION, SLIME_MOLD, STATUE, WAN_DIGGING, WATER_WALKING_BOOTS,
} from "./objects.h.js";
import {
    COLD_RES, DISINT_RES, FAST, FIRE_RES, FLYING, FROMFORM, FROMOUTSIDE, FUMBLING, INTRINSIC, INVIS,
    I_SPECIAL, LEFT_SIDE, LEVITATION, POISON_RES, RIGHT_SIDE, SEE_INVIS, SHOCK_RES, SLEEP_RES,
    STEALTH, TELEPORT, TELEPORT_CONTROL, TIMEOUT, W_ARMF, W_ARTI,
} from "./prop.h.js";
import {
    AIR, CORR, DB_ICE, DB_UNDER, DOOR, DRAWBRIDGE_UP, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED,
    D_NODOOR, D_TRAPPED, ICE, IRONBARS, LAVAPOOL, LAVAWALL, MAX_TYPE, MOAT, POOL, ROOM, SCORR,
    SDOOR, STAIRS, STONE, THRONE, TREE, WATER, W_NONDIGGABLE, W_NONPASSWALL, xFLOOR, xGROUND,
    xOPENDOOR, xSEA, xSHUTDOOR, xSUBMERGED, xSWAMP, xWATERWALL,
} from "./rm.h.js";
import {
    IS_AIR, IS_ALTAR, IS_DOOR, IS_FOUNTAIN, IS_FURNITURE, IS_GRAVE, IS_OBSTRUCTED, IS_SINK,
    IS_STWALL, IS_THRONE, IS_TREE, IS_WALL, IS_WATERWALL, OBJ_AT, Sokoban, fmon, fobj, levl, m_at,
    remove_monster, trap_to_defsym,
} from "./rm.h.macros.js";
import { P_BASIC, P_RIDING, P_UNSKILLED } from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import { MELT_ICE_AWAY, TIMER_OBJECT, ZOMBIFY_MON } from "./timeout.h.js";
import {
    HOLE, LANDMINE, LEVEL_TELEP, NO_TRAP, PIT, ROLLING_BOULDER_TRAP, SPIKED_PIT, TELEP_TRAP,
    TRAPDOOR, TRAPNUM, TRAP_CLEARLY_IMMUNE, Trap_Caught_Mon, Trap_Effect_Finished, Trap_Killed_Mon,
    Trap_Moved_Mon, VIBRATING_SQUARE, WEB, struct_trap,
} from "./trap.h.js";
import { is_pit } from "./trap.h.macros.js";
import { IN_SIGHT } from "./vision.h.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import {
    MAX_CARR_CAP, WT_ELF, WT_HUMAN, WT_SQUEEZABLE_INV, WT_TOOMUCH_DIAGONAL, WT_WEIGHTCAP_SPARE,
    WT_WEIGHTCAP_STRCON, WT_WOUNDEDLEG_REDUCT,
} from "./weight.h.js";
import { nh_delay_output, raw_print } from "./winprocs.h.macros.js";
import {
    ACH_TOWN, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_NONE, TT_PIT, TT_WEB,
} from "./you.h.js";
import { Race_if, Role_if, Ugender, Upolyd, m_next2u, next2u, u_at } from "./you.h.macros.js";
import {
    Amphibious, BFlying, BLevitation, Blind, Breathless, Cold_resistance, Conflict, Confusion, Deaf,
    EFlying, ELevitation, EWounded_legs, Fire_resistance, Flying, Fumbling, HFlying, HFumbling,
    HLevitation, Half_physical_damage, Hallucination, Levitation, Passes_walls,
    Protection_from_shape_changers, Punished, Stealth, Stunned, Swimming, Unchanging, Underwater,
    Warning, Wwalking,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, short, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64, or64, or64u } from "../rt/int64.js";
import { assert, free, memset, sprintf, strchr, strcmp, strcpy } from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_diff, ptr_to, ref_of, ref_to, sizeof_member, struct,
    struct_assign, view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { check_leash } from "./apply.js";
import { attacks } from "./artifact.js";
import { acurrstr, adjalign, exercise } from "./attrib.js";
import { drag_ball, move_bc } from "./ball.js";
import { midnight } from "./calendar.js";
import {
    cmd_from_func, cmdq_clear, cmdq_peek, confdir, directionname, do_reqmenu,
    ext_func_tab_from_func, isok, paranoid_query, reset_occupations, xytodir,
} from "./cmd.js";
import {
    db_under_typ, is_db_wall, is_ice, is_lava, is_pool, is_pool_or_lava, is_waterwall,
} from "./dbridge.js";
import {
    a11y, cg, decl_globals_init, dirs_ord, disp, flags, ga, gb, gc, gd, gi, gk, gm, gn, gt, gu, gv,
    gw, gy, iflags, svc, svi, svk, svl, svm, svp, svr, u, xdir, ydir,
} from "./decl.js";
import {
    buried_ball, buried_ball_to_punishment, bury_objs, dig_typ, use_pick_axe2, watch_dig,
} from "./dig.js";
import {
    back_to_glyph, canseemon, curs_on_u, docrt, feel_location, glyph_at, is_safemon, map_invisible,
    map_object, mon_visible, newsym, sensemon, tmp_at, unmap_invisible, unmap_object,
} from "./display.js";
import { boulder_hits_pool, flooreffects, revive_corpse } from "./do.js";
import {
    Amonnam, YMonnam, a_monnam, hliquid, m_monnam, mon_nam, pmname, x_monnam, y_monnam,
} from "./do_name.js";
import { Boots_off, Boots_on, Ring_off, hard_helmet, off_msg, stop_donning } from "./do_wear.js";
import { abuse_dog } from "./dog.js";
import { dokick } from "./dokick.js";
import { breaktest } from "./dothrow.js";
import { defsyms } from "./drawing.js";
import {
    In_mines, Invocation_lev, assign_level, ceiling, depth, get_level, on_level, room_discovered,
    surface, u_on_newpos,
} from "./dungeon.js";
import { gethungry, morehungry } from "./eat.js";
import { done, panic } from "./end.js";
import { can_reach_floor, engr_at, wipe_engr_at } from "./engrave.js";
import { experience, more_experienced, newexplevel } from "./exper.js";
import { glyph_to_cmap } from "./glyphs.js";
import {
    dist2, distmin, highc, ing_suffix, nh_deterministic_qsort, s_suffix, sgn, strncmpi, upstart,
    visctrl,
} from "./hacklib.js";
import { record_achievement } from "./insight.js";
import { carrying, delobj, freeinv, sobj_at, useupf } from "./invent.js";
import { doopen_indir } from "./lock.js";
import { mdamageu } from "./mhitu.js";
import { maybe_adjust_hero_bubble, water_friction } from "./mkmaze.js";
import {
    add_to_migration, obj_extract_self, obj_ice_effects, place_object, remove_object, splitobj,
} from "./mkobj.js";
import { inside_room, search_special } from "./mkroom.js";
import {
    curr_mon_load, hideunder, maybe_unhide_at, minliquid, mnexto, seemimic, set_ustuck, wake_msg,
    wake_nearto,
} from "./mon.js";
import {
    attacktype, attacktype_fordmg, dmgtype, locomotion, noattacks, passes_bars, sticks,
} from "./mondata.js";
import {
    accessible, can_fog, can_ooze, closed_door, dissolve_bars, m_postmove_effect, onscary,
} from "./monmove.js";
import { mons } from "./monst.js";
import { hit_bars } from "./mthrowu.js";
import { l_nhcore_call } from "./nhlua.js";
import { init_objects, objdescr_is } from "./o_init.js";
import { obj_descr, objects } from "./objects.js";
import {
    The, Tobjnam, an, ansimpleoname, bare_artifactname, doname, helm_simple_name, just_an,
    makeplural, otense, simple_typename, the, xname,
} from "./objnam.js";
import { waterbody_name } from "./pager.js";
import { autopick_testobj, loot_mon, pickup } from "./pickup.js";
import {
    Norep, There, You, You_cant, You_feel, You_hear, Your, impossible, livelog_printf, pline,
    pline_The, pline_dir, pline_xy, raw_printf, set_msg_xy, urgent_pline, verbalize,
} from "./pline.js";
import { body_part, float_vs_flight, rehumanize } from "./polyself.js";
import { incr_itimeout } from "./potion.js";
import { intemple } from "./priest.js";
import { in_out_region, reg_damg, visible_region_at } from "./region.js";
import { d, rn2, rnd } from "./rnd.js";
import { Hello } from "./role.js";
import { CapitalMon } from "./rumors.js";
import { freedynamicdata } from "./save.js";
import { selection_free, selection_getpoint, selection_new, selection_setpoint } from "./selvar.js";
import {
    add_damage, addtobill, block_door, block_entry, costly_spot, find_objowner, onshopbill,
    pay_for_damage, shop_keeper, stolen_value, subfrombill, u_entered_shop, u_left_shop,
} from "./shk.js";
import { On_stairs } from "./stairs.js";
import {
    dismount_steed, exercise_steed, place_monster, rider_cant_reach, stucksteed,
} from "./steed.js";
import { enexto, goodpos, random_teleport_level, rloc_to, rloco } from "./teleport.js";
import {
    fall_asleep, peek_timer, spot_stop_timers, spot_time_left, start_timer, stop_timer,
} from "./timeout.js";
import {
    b_trapped, back_on_ground, blow_up_landmine, climb_pit, deltrap, dotrap, drown, feeltrap,
    fill_pit, float_down, float_up, immune_to_trap, into_vs_onto, launch_obj, lava_effects, mintrap,
    reset_utrap, seetrap, selftouch, sokoban_guilt, t_at, trapname, uteetering_at_seen_pit,
} from "./trap.js";
import { do_attack, explum, stumble_onto_mimic } from "./uhitm.js";
import { block_point, recalc_block_point, vision_recalc } from "./vision.js";
import { use_skill, uwep_skill_type, weapon_descr } from "./weapon.js";
import { setuwep } from "./wield.js";
import { worm_cross } from "./worm.js";
