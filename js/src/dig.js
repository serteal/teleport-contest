/* NetHack 5.0	dig.c	$NHDT-Date: 1740629713 2025/02/26 20:15:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.227 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/* Indices returned by dig_typ() */

    const DIGTYP_UNDIGGABLE = 0;
    const DIGTYP_ROCK = DIGTYP_UNDIGGABLE + 1;
    const DIGTYP_STATUE = DIGTYP_ROCK + 1;
    const DIGTYP_BOULDER = DIGTYP_STATUE + 1;
    const DIGTYP_DOOR = DIGTYP_BOULDER + 1;
    const DIGTYP_TREE = DIGTYP_DOOR + 1;

function rm_waslit() { /* boolean */
    let x, y;

    if (levl()[u.ux][u.uy].typ == ROOM && levl()[u.ux][u.uy].waslit)
        return TRUE;
    for (x = u.ux - 2; x < u.ux + 3; x++)
        for (y = u.uy - 1; y < u.uy + 2; y++)
            if (isok(x, y) && levl()[x][y].waslit)
                return TRUE;
    return FALSE;
}

/* Change level topology.  Messes with vision tables and ignores things like
 * boulders in the name of a nice effect.  Vision will get fixed up again
 * immediately after the effect is complete.
 */
function mkcavepos(x, y, dist, waslit, rockit) { /* void */
    let lev;

    if (!isok(x, y))
        return;
    lev = levl()[x][y];

    if (rockit) {
        let mtmp;

        if (IS_OBSTRUCTED(lev.typ))
            return;
        if (t_at(x, y))
            return;                   /* don't cover the portal */
        if ((mtmp = m_at(x, y)) != null) /* make sure crucial monsters survive */
            if (!passes_walls(mtmp.data))
                rloc(mtmp, RLOC_NOMSG);
    } else if (lev.typ == ROOM)
        return;

    unblock_point(x, y); /* make sure vision knows this location is open */

    /* fake out saved state */
    lev.seenv = 0;
    lev.flags = 0;
    if (dist < 3)
        lev.lit = (rockit ? FALSE : TRUE);
    if (waslit)
        lev.waslit = (rockit ? FALSE : TRUE);
    lev.horizontal = FALSE;
    /* short-circuit vision recalc */
    uchars[gv.viz_array[y] + x] = (dist < 3) ? (IN_SIGHT | COULD_SEE) : COULD_SEE;
    lev.typ = (rockit ? STONE : ROOM); /* flags set via doormask above */
    if (dist >= 3)
        impossible(_("mkcavepos called with dist %d"), dist);
    feel_newsym(x, y);
}

function mkcavearea(rockit) { /* void */
    let dist;
    let xmin = u.ux, xmax = u.ux;
    let ymin = u.uy, ymax = u.uy;
    let i;
    let waslit = rm_waslit();

    if (rockit) {
         ;
        pline(_("Crash!  The ceiling collapses around you!"));
    } else {
        pline(_("A mysterious force %s cave around you!"),
              (levl()[u.ux][u.uy].typ == CORR) ? _("creates a") : _("extends the"));
    }
    display_nhwindow()(WIN_MESSAGE, TRUE);

    for (dist = 1; dist <= 2; dist++) {
        xmin--;
        xmax++;

        /* top and bottom */
        if (dist < 2) { /* the area is wider that it is high */
            ymin--;
            ymax++;
            for (i = xmin + 1; i < xmax; i++) {
                mkcavepos(i, ymin, dist, waslit, rockit);
                mkcavepos(i, ymax, dist, waslit, rockit);
            }
        }

        /* left and right */
        for (i = ymin; i <= ymax; i++) {
            mkcavepos(xmin, i, dist, waslit, rockit);
            mkcavepos(xmax, i, dist, waslit, rockit);
        }

        flush_screen(1); /* make sure the new glyphs shows up */
        nh_delay_output()();
    }

    if (!rockit && levl()[u.ux][u.uy].typ == CORR) {
        levl()[u.ux][u.uy].typ = ROOM; /* flags for CORR already 0 */
        if (waslit)
            levl()[u.ux][u.uy].waslit = TRUE;
        newsym(u.ux, u.uy); /* in case player is invisible */
    }

    gv.vision_full_recalc = 1; /* everything changed */
}

/* called when attempting to break a statue or boulder with a pick */
function pick_can_reach(pick, x, y) { /* boolean */
    let t = t_at(x, y);
    /* tseen: pit only affects item positioning when it is known */
    let target_in_pit = (t && is_pit(t.ttyp) && t.tseen ? 1 : 0);

    /* if hero is in a pit, pick can only reach if the statue is too and
       the two pits are conjoined or the statue isn't and pick is two-handed;
       this applies to hero in pit trying to reach an adjcacent boulder too */
    if (u.utrap && u.utraptype == TT_PIT) {
        if (target_in_pit)
            return conjoined_pits(t, t_at(u.ux, u.uy), FALSE);
        return bimanual(pick);
    }

    /* when hero isn't in a pit, a mattock or flying hero w/ pick can reach
       whether or not the statue is in a pit */
    if (bimanual(pick) || Flying())
        return TRUE;
    /* one-handed pick-axe can reach if statue isn't in a pit */
    if (!target_in_pit)
        return TRUE;

    return FALSE;
}

/* When digging into location <x,y>, what are you actually digging into? */
export function dig_typ(otmp, x, y) { /* int */
    let ltyp;

    if (!isok(x, y) || !otmp || (!is_pick(otmp) && !is_axe(otmp)))
        return DIGTYP_UNDIGGABLE;

    ltyp = levl()[x][y].typ;
    if (is_axe(otmp))
        return closed_door(x, y) ? DIGTYP_DOOR
               : IS_TREE(ltyp) ? DIGTYP_TREE /* axe vs tree */
                 : DIGTYP_UNDIGGABLE;
    /*assert(is_pick(otmp));*/
    return (sobj_at(STATUE, x, y) && pick_can_reach(otmp, x, y))
           ? DIGTYP_STATUE
           : (sobj_at(BOULDER, x, y) && pick_can_reach(otmp, x, y))
             ? DIGTYP_BOULDER
             : closed_door(x, y) ? DIGTYP_DOOR
               : IS_TREE(ltyp) ? DIGTYP_UNDIGGABLE /* pick vs tree */
                 : (IS_OBSTRUCTED(ltyp)
                    && (!svl.level.flags.arboreal || IS_WALL(ltyp)))
                   ? DIGTYP_ROCK
                   : DIGTYP_UNDIGGABLE;
}

export function is_digging() { /* boolean */
    if (go.occupation == dig) {
        return TRUE;
    }
    return FALSE;
}

export function BY_YOU() { return gy.youmonst; }
export function BY_OBJECT() { return null; }

export function dig_check(madeby, x, y) { /* enum digcheck_result */
    let ttmp = t_at(x, y);

    if (On_stairs(x, y)) {
        let stway = stairway_at(x, y);
        if (stway.isladder) {
            return DIGCHECK_FAIL_ONLADDER;
        } else {
            return DIGCHECK_FAIL_ONSTAIRS;
        }
    } else if (IS_THRONE(levl()[x][y].typ) && madeby != BY_OBJECT()) {
        return DIGCHECK_FAIL_THRONE;
    } else if (IS_ALTAR(levl()[x][y].typ)
               && (madeby != BY_OBJECT()
                   || (altarmask_at(x, y) & AM_SANCTUM) != 0)) {
        return DIGCHECK_FAIL_ALTAR;
    } else if (Is_airlevel(u.uz)) {
        return DIGCHECK_FAIL_AIRLEVEL;
    } else if (Is_waterlevel(u.uz)) {
        return DIGCHECK_FAIL_WATERLEVEL;
    } else if ((IS_OBSTRUCTED(levl()[x][y].typ) && levl()[x][y].typ != SDOOR
                && (levl()[x][y].flags & W_NONDIGGABLE) != 0)) {
        return DIGCHECK_FAIL_TOOHARD;
    } else if (ttmp && undestroyable_trap(ttmp.ttyp)) {
        return DIGCHECK_FAIL_UNDESTROYABLETRAP;
    } else if (!Can_dig_down(u.uz) && !levl()[x][y].candig) {
        if (ttmp) {
            if (!is_hole(ttmp.ttyp) && !is_pit(ttmp.ttyp))
                return DIGCHECK_PASSED_DESTROY_TRAP;
            else
                return DIGCHECK_FAIL_CANTDIG;
        } else {
            return DIGCHECK_PASSED_PITONLY;
        }
    } else if (sobj_at(BOULDER, x, y)) {
        return DIGCHECK_FAIL_BOULDER;
    } else if (madeby == BY_OBJECT()
               /* the block against existing traps is mainly to
                  prevent broken wands from turning holes into pits */
               && (ttmp || is_pool_or_lava(x, y))) {
        /* digging by player handles pools separately */
        return DIGCHECK_FAIL_OBJ_POOL_OR_TRAP;
    }
    return DIGCHECK_PASSED;
}

export function digcheck_fail_message(digresult, madeby,
                      x, y) { /* void */
    let verb = (madeby == BY_YOU() && uwep && is_axe(uwep)) ? _("chop") : _("dig in");

    if (digresult < DIGCHECK_FAILED)
        return;

    switch (digresult) {
    case DIGCHECK_FAIL_AIRLEVEL:
        You(_("cannot %s thin air."), verb);
        break;
    case DIGCHECK_FAIL_ALTAR:
        pline_The(_("altar is too hard to break apart."));
        break;
    case DIGCHECK_FAIL_BOULDER:
        There(_("isn't enough room to %s here."), verb);
        break;
    case DIGCHECK_FAIL_ONLADDER:
        pline_The(_("ladder resists your effort."));
        break;
    case DIGCHECK_FAIL_ONSTAIRS:
        pline_The(_("stairs are too hard to %s."), verb);
        break;
    case DIGCHECK_FAIL_THRONE:
        pline_The(_("throne is too hard to break apart."));
        break;
    case DIGCHECK_FAIL_CANTDIG:
    case DIGCHECK_FAIL_TOOHARD:
    case DIGCHECK_FAIL_UNDESTROYABLETRAP:
        pline_The(_("%s here is too hard to %s."), surface(x, y), verb);
        break;
    case DIGCHECK_FAIL_WATERLEVEL:
        pline_The(_("%s splashes and subsides."), hliquid(_("water")));
        break;
    case DIGCHECK_FAIL_OBJ_POOL_OR_TRAP:
    case DIGCHECK_PASSED:
    case DIGCHECK_PASSED_PITONLY:
    case DIGCHECK_PASSED_DESTROY_TRAP:
        break;
    }
}

function dig() { /* int */
    const $frame = stack_frame(); try {
    var lev;
    var dpx = svc.context.digging.pos.x, dpy = svc.context.digging.pos.y;
    var ispick = (uwep && is_pick(uwep) ? 1 : 0);
    var verb = (!uwep || is_pick(uwep)) ? _("dig into") : _("chop through");
    var dcresult = DIGCHECK_PASSED;

    lev = levl()[dpx][dpy];
    /* perhaps a nymph stole your pick-axe while you were busy digging */
    /* or perhaps you teleported away */
    if (u.uswallow || !uwep || (!ispick && !is_axe(uwep))
        || !on_level(svc.context.digging.level, u.uz)
        || (svc.context.digging.down ? (dpx != u.ux || dpy != u.uy)
                                  : !next2u(dpx, dpy)))
        return 0;

    if (svc.context.digging.down) {
        dcresult = dig_check(BY_YOU(), u.ux, u.uy);
        if (dcresult >= DIGCHECK_FAILED) {
            digcheck_fail_message(dcresult, BY_YOU(), u.ux, u.uy);
            return 0;
        }
    } else { /* !svc.context.digging.down */
        if (IS_TREE(lev.typ) && !may_dig(dpx, dpy)
            && dig_typ(uwep, dpx, dpy) == DIGTYP_TREE) {
            pline(_("This tree seems to be petrified."));
            return 0;
        }
        if (IS_OBSTRUCTED(lev.typ) && !may_dig(dpx, dpy)
            && dig_typ(uwep, dpx, dpy) == DIGTYP_ROCK) {
            pline(_("This %s is too hard to %s."),
                  is_db_wall(dpx, dpy) ? _("drawbridge") : _("wall"), verb);
            return 0;
        }
    }
    if (Fumbling() && !rn2(3)) {
        switch (rn2(3)) {
        case 0:
            if (!welded(uwep)) {
                You(_("fumble and drop %s."), yname(uwep));
                dropx(uwep);
            } else {
                if (u.usteed)
                    pline(_("%s and %s %s!"), Yobjnam2(uwep, _("bounce")),
                          otense(uwep, _("hit")), mon_nam(u.usteed));
                else
                    pline(_("Ouch!  %s and %s you!"), Yobjnam2(uwep, _("bounce")),
                          otense(uwep, _("hit")));
                set_wounded_legs(RIGHT_SIDE, 5 + rnd(5));
            }
            break;
        case 1:
            ;
            pline(_("Bang!  You hit with the broad side of %s!"),
                  the(xname(uwep)));
            wake_nearby(FALSE);
            break;
        default:
            Your(_("swing misses its mark."));
            break;
        }
        return 0;
    }

    svc.context.digging.effort +=
        10 + rn2(5) + abon() + uwep.spe - greatest_erosion(uwep) + u.udaminc;
    if (Race_if(PM_DWARF))
        svc.context.digging.effort *= 2;
    if (svc.context.digging.down) {
        var ttmp = t_at(dpx, dpy);

        if (svc.context.digging.effort > 250
            || (ttmp && ttmp.ttyp == HOLE)) {
            dighole(FALSE, FALSE, null);
            memset(addr_of(svc.context.digging), 0,
                          sizeof(struct_dig_info));
            return 0; /* done with digging */
        }

        if (svc.context.digging.effort <= 50
            || (ttmp && (ttmp.ttyp == TRAPDOOR || is_pit(ttmp.ttyp)))) {
            return 1;
        } else if (ttmp && (ttmp.ttyp == LANDMINE
                            || (ttmp.ttyp == BEAR_TRAP && !u.utrap))) {
            /* digging onto a set object trap triggers it;
               hero should have used #untrap first */
            dotrap(ttmp, FORCETRAP);
            /* restart completely from scratch if we resume digging */
            memset(addr_of(svc.context.digging), 0,
                          sizeof(struct_dig_info));
            return 0;
        } else if (ttmp && ttmp.ttyp == BEAR_TRAP && u.utrap) {
            if (rnl(7) > (Fumbling() ? 1 : 4)) {
                var kbuf = stack_array(char, BUFSZ);
                var dmg = dmgval(uwep, gy.youmonst) + dbon();

                if (dmg < 1)
                    dmg = 1;
                else if (uarmf)
                    dmg = Math.trunc((dmg + 1) / 2);
                You(_("hit yourself in the %s."), body_part(FOOT));
                sprintf(kbuf, _("chopping off %s own %s"), uhis(), body_part(FOOT))
;
                losehp(Maybe_Half_Phys(dmg), kbuf, KILLED_BY);
            } else {
                You(_("destroy the bear trap with %s."),
                    yobjnam(uwep, 0));
                deltrap(ttmp);
                reset_utrap(TRUE); /* release from trap, maybe Lev or Fly */
            }
            /* we haven't made any progress toward a pit yet */
            svc.context.digging.effort = 0;
            return 0;
        } else if (ttmp && dcresult == DIGCHECK_PASSED_DESTROY_TRAP) {
            var ttmpname = trapname(ttmp.ttyp, FALSE);

            if (ispick)
                You(_("destroy %s with %s."),
                    ttmp.tseen ? the(ttmpname) : an(ttmpname),
                    yobjnam(uwep, 0));
            deltrap(ttmp);
            /* we haven't made any progress toward a pit yet */
            svc.context.digging.effort = 0;
            return 0;
        }

        if (IS_ALTAR(lev.typ)) {
            altar_wrath(dpx, dpy);
            angry_priest();
        }

        /* make pit at <u.ux,u.uy> */
        if (dighole(TRUE, FALSE, null)) {
            svc.context.digging.level.dnum = 0;
            svc.context.digging.level.dlevel = -1;
        }
        return 0;
    }

    if (svc.context.digging.effort > 100) {
        var digbuf = stack_array(char, BUFSZ);
        var digtxt, dmgtxt = 0;
        var obj, bobj;
        var shopedge = chars[in_rooms(dpx, dpy, SHOPBASE)];
        var digtyp = dig_typ(uwep, dpx, dpy);

        cleanup: { if (digtyp == DIGTYP_STATUE
            && (obj = sobj_at(STATUE, dpx, dpy)) != null) {
            if (break_statue(obj))
                digtxt = _("The statue shatters.");
            else
                /* it was a statue trap; break_statue()
                   printed a message and updated the screen */
                digtxt = 0;
        } else if (digtyp == DIGTYP_BOULDER
                   && (obj = sobj_at(BOULDER, dpx, dpy)) != null) {
            fracture_rock(obj);
            /*[5.0: this probably isn't necessary anymore]*/
            if ((bobj = sobj_at(BOULDER, dpx, dpy)) != null) {
                /* another boulder here, restack it to the top */
                obj_extract_self(bobj);
                place_object(bobj, dpx, dpy);
            }
            digtxt = _("The boulder falls apart.");
        } else if (lev.typ == STONE || lev.typ == SCORR
                   || IS_TREE(lev.typ)) {
            if (Is_earthlevel(u.uz)) {
                if (uwep.blessed && !rn2(3)) {
                    mkcavearea(FALSE);
                    break cleanup;
                } else if ((uwep.cursed && !rn2(4))
                           || (!uwep.blessed && !rn2(6))) {
                    mkcavearea(TRUE);
                    break cleanup;
                }
            }
            if (digtyp == DIGTYP_TREE) {
                digtxt = _("You cut down the tree.");
                lev.typ = ROOM, lev.flags = 0;
                if (!rn2(5))
                    rnd_treefruit_at(dpx, dpy);
                if (Race_if(PM_ELF) || Role_if(PM_RANGER))
                    adjalign(-1);
            } else {
                digtxt = _("You succeed in cutting away some rock.");
                lev.typ = CORR, lev.flags = 0;
            }
        } else if (IS_WALL(lev.typ)) {
            if (shopedge) {
                add_damage(dpx, dpy, SHOP_WALL_DMG());
                dmgtxt = _("damage");
            }
            if (svl.level.flags.is_maze_lev) {
                lev.typ = ROOM, lev.flags = 0;
            } else if (svl.level.flags.is_cavernous_lev
                       && !in_town(dpx, dpy)) {
                lev.typ = CORR, lev.flags = 0;
            } else {
                lev.typ = DOOR, lev.flags = D_NODOOR;
            }
            digtxt = _("You make an opening in the wall.");
        } else if (lev.typ == SDOOR) {
            cvt_sdoor_to_door(lev); /* ->typ = DOOR */
            digtxt = _("You break through a secret door!");
            if (!(lev.flags & D_TRAPPED))
                lev.flags = D_BROKEN;
        } else if (closed_door(dpx, dpy)) {
            sprintf(digbuf, _("You break through the door with your %s."), simpleonames(uwep))
;
            digtxt = digbuf;
            if (shopedge) {
                add_damage(dpx, dpy, SHOP_DOOR_COST);
                dmgtxt = _("break");
            }
            if (!(lev.flags & D_TRAPPED))
                lev.flags = D_BROKEN;
        } else
            return 0; /* statue or boulder got taken */

        if (!does_block(dpx, dpy, levl()[dpx][dpy]))
            unblock_point(dpx, dpy); /* vision:  can see through */
        feel_newsym(dpx, dpy);
        if (digtxt && !svc.context.digging.quiet)
            pline1(digtxt); /* after newsym */
        if (dmgtxt)
            pay_for_damage(dmgtxt, FALSE);

        if (Is_earthlevel(u.uz) && !rn2(3)) {
            var mndx = rn2(2) ? PM_EARTH_ELEMENTAL : PM_XORN;

            if (makemon(mons[mndx], dpx, dpy, MM_NOMSG))
                pline_The(_("debris from your digging comes to life!"));
        }
        if (IS_DOOR(lev.typ) && (lev.flags & D_TRAPPED)) {
            lev.flags = D_NODOOR;
            b_trapped(_("door"), NO_PART);
            recalc_block_point(dpx, dpy);
            newsym(dpx, dpy);
        }
 }
        svc.context.digging.lastdigtime = svm.moves;
        svc.context.digging.quiet = FALSE;
        svc.context.digging.level.dnum = 0;
        svc.context.digging.level.dlevel = -1;
        return 0;
    } else { /* not enough effort has been spent yet */
        var d_target = static_array("dig.d_target", ptr_to(char), 6, [ _(""),        _("rock"), _("statue"),
                                                 _("boulder"), _("door"), _("tree") ]);
        var dig_target = dig_typ(uwep, dpx, dpy);

        if (IS_WALL(lev.typ) || dig_target == DIGTYP_DOOR) {
            if (chars[in_rooms(dpx, dpy, SHOPBASE)]) {
                pline(_("This %s seems too hard to %s."),
                      IS_DOOR(lev.typ) ? _("door") : _("wall"), verb);
                return 0;
            }
        } else if (dig_target == DIGTYP_UNDIGGABLE
                   || (dig_target == DIGTYP_ROCK && !IS_OBSTRUCTED(lev.typ)))
            return 0; /* statue or boulder got taken */

        if (!gd.did_dig_msg) {
            You(_("hit the %s with all your might."), d_target[dig_target]);
            wake_nearby(FALSE);
            gd.did_dig_msg = TRUE;
        }
    }
    return 1;
    } finally { stack_pop($frame); }
}

function furniture_handled(x, y, madeby_u) { /* boolean */
    const $frame = stack_frame(); try {
    let lev = levl()[x][y];

    if (IS_FOUNTAIN(lev.typ)) {
        dogushforth(FALSE);
        levl()[x][y].flags |= F_WARNED; /* force dryup */
        dryup(x, y, madeby_u);
    } else if (IS_SINK(lev.typ)) {
        breaksink(x, y);
    } else if (lev.typ == DRAWBRIDGE_DOWN
               || (is_drawbridge_wall(x, y) >= 0)) {
        let bx = stack_var(coordxy, x), by = stack_var(coordxy, y);

        /* if under the portcullis, the bridge is adjacent */
        find_drawbridge(bx, by);
        destroy_drawbridge(bx[0], by[0]);
    } else {
        return FALSE;
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/* When will hole be finished? Very rough indication used by shopkeeper. */
export function holetime() { /* int */
    if (go.occupation != dig || !chars[u.ushops])
        return -1;
    return Math.trunc((250 - svc.context.digging.effort) / 20);
}

/* Return typ of liquid to fill a hole with, or ROOM, if no liquid nearby */
export function fillholetyp(x, y,
            fill_if_any) { /* schar */ /* force filling if it exists at all */
    let x1, y1;
    let lo_x = max(1, x - 1), hi_x = min(x + 1, COLNO - 1),
            lo_y = max(0, y - 1), hi_y = min(y + 1, ROWNO - 1);
    let pool_cnt = 0, moat_cnt = 0, lava_cnt = 0;

    for (x1 = lo_x; x1 <= hi_x; x1++)
        for (y1 = lo_y; y1 <= hi_y; y1++)
            if (is_moat(x1, y1))
                moat_cnt++;
            else if (is_pool(x1, y1))
                /* This must come after is_moat since moats are pools
                 * but not vice-versa. */
                pool_cnt++;
            else if (is_lava(x1, y1))
                lava_cnt++;

    if (!fill_if_any)
        pool_cnt = Math.trunc(pool_cnt / 3); /* not as much liquid as the others */

    if ((lava_cnt > moat_cnt + pool_cnt && rn2(lava_cnt + 1))
        || (lava_cnt && fill_if_any))
        return LAVAPOOL;
    else if ((moat_cnt > 0 && rn2(moat_cnt + 1)) || (moat_cnt && fill_if_any))
        return MOAT;
    else if ((pool_cnt > 0 && rn2(pool_cnt + 1)) || (pool_cnt && fill_if_any))
        return POOL;
    else
        return ROOM;
}

export function digactualhole(x, y, madeby, ttyp) { /* void */
    const $frame = stack_frame(); try {
    let oldobjs, newobjs;
    let ttmp;
    let surface_type, tname, in_thru;
    let furniture = stack_array(char, BUFSZ);
    let lev = levl()[x][y];
    let mtmp = m_at(x, y); /* may be madeby */
    let madeby_u = +(madeby == BY_YOU()), madeby_obj = +(madeby == BY_OBJECT()),

            heros_fault = (madeby_u || madeby_obj ? 1 : 0);
    let shopdoor, at_u = u_at(x, y), wont_fall = (Levitation() || Flying() ? 1 : 0);
    let old_typ, old_aligntyp = A_NONE;

    if (at_u && u.utrap) {
        if (u.utraptype == TT_BURIEDBALL)
            buried_ball_to_punishment();
        else if (u.utraptype == TT_INFLOOR)
            reset_utrap(FALSE);
    }

    if (furniture_handled(x, y, madeby_u))
        return;

    if (ttyp != PIT && (!Can_dig_down(u.uz) && !lev.candig)) {
        impossible(_("digactualhole: can't dig %s on this level."),
                   trapname(ttyp, TRUE));
        ttyp = PIT;
    }

    /* maketrap() might change terrain type but we deliver messages after
       that, so prepare in advance */
    old_typ = lev.typ;
    chars[furniture + 0] = ord('\0');
    if (IS_FURNITURE(lev.typ)) {
        /* should mirror the word used by surface() for normal floor */
        surface_type = (IS_ROOM(lev.typ) && !Is_earthlevel(u.uz)
                         ? _("floor") : _("ground"));
        if (IS_ALTAR(lev.typ)) {
            old_aligntyp = Amask2align(levl()[x][y].flags & AM_MASK);
            strcpy(furniture, align_str(old_aligntyp));
            strcat(furniture, _(" "));
        }
        strcat(furniture, surface(x, y));
    } else {
        surface_type = surface(x, y);
    }
    shopdoor = (IS_DOOR(lev.typ) && chars[in_rooms(x, y, SHOPBASE)] ? 1 : 0);
    oldobjs = svl.level.objects[x][y];

    ttmp = maketrap(x, y, ttyp);
    if (!ttmp)
        return;
    newobjs = svl.level.objects[x][y];
    ttmp.madeby_u = unsigned(heros_fault);
    ttmp.tseen = 0;
    if (cansee(x, y))
        seetrap(ttmp);
    else if (madeby_u)
        feeltrap(ttmp);

    tname = trapname(ttyp, TRUE);
    in_thru = (ttyp == HOLE ? _("through") : _("in"));
    if (madeby_u) {
        if (x != u.ux || y != u.uy)
            You(_("dig an adjacent %s."), tname);
        else
            You(_("dig %s %s the %s."), an(tname), in_thru, surface_type);
    } else if (!madeby_obj && canseemon(madeby)) {
        pline(_("%s digs %s %s the %s."), Monnam(madeby), an(tname), in_thru,
              surface_type);
    } else if (cansee(x, y) && flags.verbose) {
        if (IS_STWALL(old_typ))
            pline_The(_("%s crumbles into %s."), surface_type, an(tname));
        else
            pline(_("%s appears in the %s."), An(tname), surface_type);
    }
    if (IS_FURNITURE(old_typ) && cansee(x, y))
        pline_The(_("%s falls into the %s!"), furniture, tname);
    /* wrath should immediately follow altar destruction message */
    if (heros_fault && old_typ == ALTAR)
        desecrate_altar(FALSE, old_aligntyp);

    /* now deal with actual post-trap creation effects */
    if (ttyp == PIT) {
        if (shopdoor && heros_fault)
            pay_for_damage(_("ruin"), FALSE);
        else
            add_damage(x, y, heros_fault ? SHOP_PIT_COST : 0);
        if (madeby_u)
            wake_nearby(FALSE);
        /* in case we're digging down while encased in solid rock
           which is blocking levitation or flight */
        switch_terrain();
        if (Levitation() || Flying())
            wont_fall = TRUE;

        if (at_u) {
            if (!wont_fall) {
                set_utrap(unsigned(rn1(4, 2)), TT_PIT);
                gv.vision_full_recalc = 1; /* vision limits change */
            } else
                reset_utrap(TRUE);
            if (oldobjs != newobjs) /* something unearthed */
                pickup(1);   /* detects pit */
        } else if (mtmp) {
            if (is_flyer(mtmp.data) || is_floater(mtmp.data)) {
                if (canseemon(mtmp))
                    pline(_("%s %s over the pit."), Monnam(mtmp),
                          is_flyer(mtmp.data) ? _("flies") : _("floats"));
            } else if (mtmp != madeby)
                mintrap(mtmp, NO_TRAP_FLAGS);
        }
    } else { /* was TRAPDOOR now a HOLE*/
        if (at_u) {
            /* in case we're digging down while encased in solid rock
               which is blocking levitation or flight */
            switch_terrain();
            if (Levitation() || Flying())
                wont_fall = TRUE;

            /* check for leashed pet that can't fall right now */
            if (!u.ustuck && !wont_fall && !next_to_u()) {
                You(_("are jerked back by your pet!"));
                wont_fall = TRUE;
            }

            /* Floor objects get a chance of falling down.  The case where
             * the hero does NOT fall down is treated here.  The case
             * where the hero does fall down is treated in goto_level().
             */
            if (u.ustuck || wont_fall) {
                if (newobjs)
                    impact_drop(null, x, y, 0);
                if (oldobjs != newobjs)
                    pickup(1);
                if (shopdoor && heros_fault)
                    pay_for_damage(_("ruin"), FALSE);
            } else {
                let newlevel = stack_struct(struct_d_level);

                if (chars[u.ushops] && heros_fault)
                    shopdig(1); /* shk might snatch pack */
                else /* handle any earlier hero-caused damage */
                    pay_for_damage(_("dig into"), TRUE);
                You(_("fall through..."));
                /* Earlier checks must ensure that the destination
                 * level exists and is in the present dungeon.
                 */
                newlevel.dnum = u.uz.dnum;
                newlevel.dlevel = u.uz.dlevel + 1;
                goto_level(newlevel, FALSE, TRUE, FALSE);
                /* messages for arriving in special rooms */
                spoteffects(FALSE);
            }
        } else {
            if (shopdoor && heros_fault)
                pay_for_damage(_("ruin"), FALSE);
            if (newobjs)
                impact_drop(null, x, y, 0);
            if (mtmp) {
                /*[don't we need special sokoban handling here?]*/
                if (!grounded(mtmp.data)
                    || (mtmp.wormno && count_wsegs(mtmp) > 5)
                    || mtmp.data.msize >= MZ_HUGE)
                    return;
                if (mtmp == u.ustuck) /* probably a vortex */
                    return;           /* temporary? kludge */

                if (teleport_pet(mtmp, FALSE)) {
                    let tolevel = stack_struct(struct_d_level);

                    if (Is_stronghold(u.uz)) {
                        assign_level(tolevel, svd.dungeon_topology.d_valley_level);
                    } else if (Is_botlevel(u.uz)) {
                        if (canseemon(mtmp))
                            pline(_("%s avoids the trap."), Monnam(mtmp));
                        return;
                    } else {
                        get_level(tolevel, depth(u.uz) + 1);
                    }
                    if (mtmp.isshk)
                        make_angry_shk(mtmp, 0, 0);
                    migrate_to_level(mtmp, ledger_no(tolevel),
                                     MIGR_RANDOM, null);
                }
            }
        }
    }
    } finally { stack_pop($frame); }
}

/*
 * Called from dighole(); also from do_break_wand() in apply.c
 * and do_earthquake() in music.c.
 */
export function liquid_flow(
    x, y,
    typ,
    ttmp,
    fillmsg) { /* void */
    let objchain;
    let mon;
    let u_spot = u_at(x, y);

    /* caller should have changed levl[x][y].typ to POOL, MOAT, or LAVA */
    if (!is_pool_or_lava(x, y)) {
        if (iflags.sanity_check) {
            impossible(_("Insane liquid_flow(%d,%d,%s,%s)."), x, y,
                       ttmp ? trapname(ttmp.ttyp, TRUE) : _("no trap"),
                       fillmsg ? fillmsg : _("no mesg"));
        }
        return;
    }

    if (ttmp)
        delfloortrap(ttmp); /* will untrap monster if one is here */
    /* if any objects were frozen here, they're released now */
    obj_ice_effects(x, y, TRUE);
    unearth_objs(x, y);

    if (fillmsg)
        pline(fillmsg, hliquid(typ == LAVAPOOL ? _("lava") : _("water")));
    /* handle object damage before hero damage; affects potential bones */
    if ((objchain = svl.level.objects[x][y]) != null) {
        if (typ == LAVAPOOL)
            fire_damage_chain(objchain, TRUE, TRUE, x, y);
        else
            water_damage_chain(objchain, TRUE);
    }
    /* damage to the hero */
    if (u_spot) {
        pooleffects(FALSE);
    } else if ((mon = m_at(x, y)) != null) {
        minliquid(mon);
    }
}

/* return TRUE if digging succeeded, FALSE otherwise */
export function dighole(pit_only, by_magic, cc) { /* boolean */
    const $frame = stack_frame(); try {
    let ttmp;
    let lev;
    let boulder_here;
    let typ, old_typ;
    let dig_x, dig_y;
    let nohole, retval = FALSE;
    let dig_check_result;

    if (!cc) {
        dig_x = u.ux;
        dig_y = u.uy;
    } else {
        dig_x = cc.x;
        dig_y = cc.y;
        if (!isok(dig_x, dig_y))
            return FALSE;
    }

    ttmp = t_at(dig_x, dig_y);
    lev = levl()[dig_x][dig_y];
    dig_check_result = dig_check(BY_YOU(), dig_x, dig_y);
    /* nohole = (!Can_dig_down(&u.uz) && !lev->candig); */
    nohole = +(dig_check_result == DIGCHECK_FAIL_CANTDIG
                  || dig_check_result == DIGCHECK_FAIL_TOOHARD);
    old_typ = lev.typ;

    if ((ttmp && (undestroyable_trap(ttmp.ttyp) || nohole))
        || (IS_OBSTRUCTED(old_typ) && old_typ != SDOOR
            && (lev.flags & W_NONDIGGABLE) != 0)) {
        pline_The(_("%s %shere is too hard to dig in."), surface(dig_x, dig_y),
                  (dig_x != u.ux || dig_y != u.uy) ? _("t") : _(""));
    } else if (ttmp && is_magical_trap(ttmp.ttyp)) {
        explode(dig_x, dig_y, 0, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL);
        deltrap(ttmp);
        newsym(dig_x, dig_y);
    } else if (is_pool_or_lava(dig_x, dig_y)) {
        pline_The(_("%s sloshes furiously for a moment, then subsides."),
                  hliquid(is_lava(dig_x, dig_y) ? _("lava") : _("water")));
        wake_nearby(FALSE); /* splashing */
    } else if (old_typ == DRAWBRIDGE_DOWN
               || (is_drawbridge_wall(dig_x, dig_y) >= 0)) {
        /* drawbridge_down is the platform crossing the moat when the
           bridge is extended; drawbridge_wall is the open "doorway" or
           closed "door" where the portcullis/mechanism is located */
        if (pit_only) {
            pline_The(_("drawbridge seems too hard to dig through."));
        } else {
            let x = stack_var(coordxy, dig_x), y = stack_var(coordxy, dig_y);
            /* if under the portcullis, the bridge is adjacent */
            find_drawbridge(x, y);
            destroy_drawbridge(x[0], y[0]);
            retval = TRUE;
        }
    } else if ((boulder_here = sobj_at(BOULDER, dig_x, dig_y)) != null) {
        if (ttmp && is_pit(ttmp.ttyp)
            && rn2(2)) {
            pline_The(_("boulder settles into the %spit."),
                      (dig_x != u.ux || dig_y != u.uy) ? _("adjacent ") : _(""));
            ttmp.ttyp = PIT; /* crush spikes */
        } else {
            /*
             * digging makes a hole, but the boulder immediately
             * fills it.  Final outcome:  no hole, no boulder.
             */
             ;
            pline(_("KADOOM!  The boulder falls in!"));
            wake_nearby(FALSE);
            delfloortrap(ttmp);
        }
        delobj(boulder_here);
    } else if (IS_GRAVE(old_typ)) {
        digactualhole(dig_x, dig_y, BY_YOU(), PIT);
        dig_up_grave(cc);
        retval = TRUE;
    } else if (old_typ == DRAWBRIDGE_UP) {
        /* must be floor or ice, other cases handled above */
        /* dig "pit" and let fluid flow in (if possible) */
        typ = fillholetyp(dig_x, dig_y, FALSE);

        if (typ == ROOM) {
            /*
             * We can't dig a hole here since that will destroy
             * the drawbridge.  The following is a cop-out. --dlc
             */
            pline_The(_("%s %shere is too hard to dig in."),
                      surface(dig_x, dig_y),
                      (dig_x != u.ux || dig_y != u.uy) ? _("t") : _(""));
        } else {
            lev.flags &= ~DB_UNDER;
            lev.flags |= (typ == LAVAPOOL) ? DB_LAVA : DB_MOAT;
            liquid_flow(dig_x, dig_y, typ, ttmp,
                        _("As you dig, the hole fills with %s!"));
            retval = TRUE;
        }

    /* the following two are here for the wand of digging */
    } else if (IS_THRONE(old_typ)) {
        pline_The(_("throne is too hard to break apart."));
    } else if (IS_ALTAR(old_typ)) {
        pline_The(_("altar is too hard to break apart."));
    } else {
        typ = fillholetyp(dig_x, dig_y, FALSE);

        lev.flags = 0;
        if (typ != ROOM) {
            if (!furniture_handled(dig_x, dig_y, TRUE)) {
                lev.typ = typ;
                liquid_flow(dig_x, dig_y, typ, ttmp,
                            _("As you dig, the hole fills with %s!"));
            }
            retval = TRUE;
        } else {
            /* magical digging disarms settable traps */
            if (by_magic && ttmp
                && (ttmp.ttyp == LANDMINE || ttmp.ttyp == BEAR_TRAP)) {
                let otyp = (ttmp.ttyp == LANDMINE) ? LAND_MINE : BEARTRAP;

                /* convert trap into buried object (deletes trap) */
                cnv_trap_obj(otyp, 1, ttmp, TRUE);
            }

            /* finally we get to make a hole */
            if (nohole || pit_only
                || dig_check_result == DIGCHECK_PASSED_DESTROY_TRAP
                || dig_check_result == DIGCHECK_PASSED_PITONLY)
                digactualhole(dig_x, dig_y, BY_YOU(), PIT);
            else
                digactualhole(dig_x, dig_y, BY_YOU(), HOLE);
            retval = TRUE;
        }
    }
    spot_checks(dig_x, dig_y, old_typ);
    return retval;
    } finally { stack_pop($frame); }
}

function dig_up_grave(cc) { /* void */
    let otmp;
    let what_happens;
    let dig_x, dig_y;

    if (!cc) {
        dig_x = u.ux;
        dig_y = u.uy;
    } else {
        dig_x = cc.x;
        dig_y = cc.y;
        if (!isok(dig_x, dig_y))
            return;
    }

    /* Grave-robbing is frowned upon... */
    exercise(A_WIS, FALSE);
    if (Role_if(PM_ARCHEOLOGIST)) {
        adjalign(-sgn(u.ualign.type) * 3);
        You_feel(_("like a despicable grave-robber!"));
    } else if (Role_if(PM_SAMURAI)) {
        adjalign(-sgn(u.ualign.type));
        You(_("disturb the honorable dead!"));
    } else if (u.ualign.type == A_LAWFUL) {
        if (u.ualign.record > -10)
            adjalign(-1);
        You(_("have violated the sanctity of this grave!"));
    }

    /* -1: force default case for empty grave */
    what_happens = levl()[dig_x][dig_y].flags ? -1 : rn2(5);
    switch (what_happens) {
    case 0:
    case 1:
        You(_("unearth a corpse."));
        if ((otmp = mk_tt_object(CORPSE, dig_x, dig_y)) != null)
            otmp.age -= (TAINT_AGE + 1); /* this is an *OLD* corpse */
        break;
    case 2:
        if (!Blind())
            pline(_("%s!"), Hallucination() ? _("Dude!  The living dead")
                                       : _("The grave's owner is very upset"));
        makemon(mkclass(S_ZOMBIE, 0), dig_x, dig_y, MM_NOMSG);
        break;
    case 3:
        if (!Blind())
            pline(_("%s!"), Hallucination() ? _("I want my mummy")
                                       : _("You've disturbed a tomb"));
        makemon(mkclass(S_MUMMY, 0), dig_x, dig_y, MM_NOMSG);
        break;
    default:
        /* No corpse */
        pline_The(_("grave is unoccupied.  Strange..."));
        break;
    }
    levl()[dig_x][dig_y].typ = ROOM;
    levl()[dig_x][dig_y].flags = 0; /* clear 'flags' */
    levl()[dig_x][dig_y].horizontal = 0; /* clear 'horizontal' */
    del_engr_at(dig_x, dig_y);
    newsym(dig_x, dig_y);
    return;
}

export function use_pick_axe(obj) { /* int */
    const $frame = stack_frame(); try {
    let verb;
    let dsp, dirsyms = stack_array(char, 12), qbuf = stack_array(char, BUFSZ);
    let ispick;
    let rx, ry, downok, res = ECMD_OK;
    let dir;

    /* Check tool */
    if (obj != uwep) {
        if (wield_tool(obj, _("swing"))) {
            /* we're now wielding it. next turn, apply to dig. */
            cmdq_add_ec(CQ_CANNED, doapply);
            cmdq_add_key(CQ_CANNED, obj.invlet);
            return ECMD_TIME;
        }
        return ECMD_OK;
    }
    ispick = is_pick(obj);
    verb = ispick ? _("dig") : _("chop");

    if (u.utrap && u.utraptype == TT_WEB) {
        pline(_("%s you can't %s while entangled in a web."),
              /* res==0 => no prior message;
                 res==1 => just got "You now wield a pick-axe." message */
              !res ? _("Unfortunately,") : _("But"), verb);
        return res;
    }

    /* construct list of directions to show player for likely choices */
    downok = +!!can_reach_floor(FALSE);
    dsp = dirsyms;
    for (dir = 0; dir < N_DIRS_Z; dir++) {
        let dirch = cmd_from_dir(dir, MV_WALK);

        /* filter out useless directions */
        if (u.uswallow) {
            ; /* all directions are viable when swallowed */
        } else if (movecmd(dirch, MV_WALK)) {
            /* normal direction, within plane of the level map */
            if (!dxdy_moveok())
                continue; /* handle NODIAG */
            rx = u.ux + u.dx;
            ry = u.uy + u.dy;
            if (!isok(rx, ry) || dig_typ(obj, rx, ry) == DIGTYP_UNDIGGABLE)
                continue;
        } else {
            /* up or down; we used to always include down, so that
               there would always be at least one choice shown, but
               it shouldn't be a likely candidate when floating high
               above the floor; include up instead in that situation
               (as a silly candidate rather than a likely one...) */
            if (+(u.dz > 0) ^ downok)
                continue;
        }
        /* include this direction */
        chars[dsp++] = dirch;
    }
    chars[dsp] = 0;
    sprintf(qbuf, _("In what direction do you want to %s? [%s]"), verb, dirsyms);
    if (!getdir(qbuf))
        return (res|ECMD_CANCEL);

    return use_pick_axe2(obj);
    } finally { stack_pop($frame); }
}

/* MRKR: use_pick_axe() is split in two to allow autodig to bypass */
/*       the "In what direction do you want to dig?" query.        */
/*       use_pick_axe2() uses the existing u.dx, u.dy and u.dz    */
export function use_pick_axe2(obj) { /* int */
    const $frame = stack_frame(); try {
    let rx, ry;
    let lev;
    let trap, trap_with_u;
    let dig_target;
    let ispick = is_pick(obj);
    let verbing = ispick ? _("digging") : _("chopping");

    if (u.uswallow && do_attack(u.ustuck)) {
        ; /* return 1 */
    } else if (Underwater()) {
        pline(_("Turbulence torpedoes your %s attempts."), verbing);
    } else if (u.dz < 0) {
        if (Levitation())
            You(_("don't have enough leverage."));
        else
            You_cant(_("reach the %s."), ceiling(u.ux, u.uy));
    } else if (!u.dx && !u.dy && !u.dz) {
        let buf = stack_array(char, BUFSZ);
        let dam;

        dam = rnd(2) + dbon() + obj.spe;
        if (dam <= 0)
            dam = 1;
        You(_("hit yourself with %s."), yname(uwep));
        sprintf(buf, _("%s own %s"), uhis(), OBJ_NAME(objects[obj.otyp]));
        losehp(Maybe_Half_Phys(dam), buf, KILLED_BY);
        disp.botl = TRUE;
        return ECMD_TIME;
    } else if (u.dz == 0) {
        confdir(FALSE);
        rx = u.ux + u.dx;
        ry = u.uy + u.dy;
        if (!isok(rx, ry)) {
             ;
            pline(_("Clash!"));
            return ECMD_TIME;
        }
        lev = levl()[rx][ry];
        if (MON_AT(rx, ry) && do_attack(m_at(rx, ry)))
            return ECMD_TIME;
        dig_target = dig_typ(obj, rx, ry);
        if (dig_target == DIGTYP_UNDIGGABLE) {
            let boulder;

            /* ACCESSIBLE or POOL */
            trap = t_at(rx, ry);
            if (trap && trap.ttyp == WEB) {
                if (!trap.tseen) {
                    seetrap(trap);
                    There(_("is a spider web there!"));
                }
                pline(_("%s entangled in the web."), Yobjnam2(obj, _("become")));
                /* you ought to be able to let go; tough luck */
                /* (maybe `move_into_trap()' would be better) */
                nomul(-d(2, 2));
                gm.multi_reason = _("stuck in a spider web");
                gn.nomovemsg = _("You pull free.");
            } else if (lev.typ == IRONBARS) {
                pline(_("Clang!"));
                wake_nearby(FALSE);
            } else if (IS_WATERWALL(lev.typ)) {
                pline(_("Splash!"));
            } else if (lev.typ == LAVAWALL) {
                pline(_("Splash!"));
                fire_damage(uwep, FALSE, rx, ry);
            } else if (IS_TREE(lev.typ)) {
                You(_("need an axe to cut down a tree."));
            } else if (IS_OBSTRUCTED(lev.typ)) {
                You(_("need a pick to dig rock."));
            } else if ((boulder = sobj_at(BOULDER, rx, ry)) != null
                       || sobj_at(STATUE, rx, ry)) {
                /* if both boulders and statues are present, the topmost
                   boulder will be shown on the map so treat it as target */
                let what = boulder ? _("boulder") : _("statue");

                if (!ispick) {
                    let vibrate = +!rn2(3);

                    pline(_("Sparks fly as you whack the %s.%s"), what,
                          vibrate ? _("  The axe-handle vibrates violently!")
                                  : _(""));
                    if (vibrate)
                        losehp(Maybe_Half_Phys(2), _("axing a hard object"),
                               KILLED_BY);
                    wake_nearby(FALSE);
                } else {
                    /* using a pick but dig_target is DIGTYPE_UNDIGGABLE
                       and there is at least one boulder or statue or both
                       present; pick_can_reach() returned false */
                    You_cant(_("reach the %s."), what);
                }
            } else if (u.utrap && u.utraptype == TT_PIT && trap
                       && (trap_with_u = t_at(u.ux, u.uy))
                       && is_pit(trap.ttyp)
                       && !conjoined_pits(trap, trap_with_u, FALSE)) {
                let idx = xytodir(u.dx, u.dy);

                if (idx != DIR_ERR) {
                    let adjidx = DIR_180(idx);

                    trap_with_u.vl.v_conjoined |= (1 << idx);
                    trap.vl.v_conjoined |= (1 << adjidx);
                    You(_("clear some debris from between the pits."));
                }
            } else if (u.utrap && u.utraptype == TT_PIT
                       && (trap_with_u = t_at(u.ux, u.uy)) != null) {
                You(_("swing %s, but the rubble has no place to go."),
                    yobjnam(obj, 0));
            } else {
                You(_("swing %s through thin air."), yobjnam(obj, 0));
            }
        } else {
            let d_action = static_array("use_pick_axe2.d_action", ptr_to(char), 6, [ _("swinging"), _("digging"),
                                                     _("chipping the statue"),
                                                     _("hitting the boulder"),
                                                     _("chopping at the door"),
                                                     _("cutting the tree") ]);

            gd.did_dig_msg = FALSE;
            svc.context.digging.quiet = FALSE;
            if (svc.context.digging.pos.x != rx
                || svc.context.digging.pos.y != ry
                || !on_level(svc.context.digging.level, u.uz)
                || svc.context.digging.down) {
                if (flags.autodig && dig_target == DIGTYP_ROCK
                    && !svc.context.digging.down
                    && u_at(svc.context.digging.pos.x,
                            svc.context.digging.pos.y)
                    && (svm.moves <= svc.context.digging.lastdigtime + 2
                        && svm.moves >= svc.context.digging.lastdigtime)) {
                    /* avoid messages if repeated autodigging */
                    gd.did_dig_msg = TRUE;
                    svc.context.digging.quiet = TRUE;
                }
                svc.context.digging.down = svc.context.digging.chew = FALSE;
                svc.context.digging.warned = FALSE;
                svc.context.digging.pos.x = rx;
                svc.context.digging.pos.y = ry;
                assign_level(svc.context.digging.level, u.uz);
                svc.context.digging.effort = 0;
                if (!svc.context.digging.quiet)
                    You(_("start %s."), d_action[dig_target]);
            } else {
                You(_("%s %s."), svc.context.digging.chew ? _("begin") : _("continue"),
                    d_action[dig_target]);
                svc.context.digging.chew = FALSE;
            }
            set_occupation(dig, verbing, 0);
        }
    } else if (Is_airlevel(u.uz) || Is_waterlevel(u.uz)) {
        /* it must be air -- water checked above */
        You(_("swing %s through thin air."), yobjnam(obj, 0));
    } else if (!can_reach_floor(FALSE)) {
        cant_reach_floor(u.ux, u.uy, FALSE, FALSE, FALSE);
    } else if (is_pool_or_lava(u.ux, u.uy)) {
        /* Monsters which swim also happen not to be able to dig */
        You(_("cannot stay under%s long enough."),
            is_pool(u.ux, u.uy) ? _("water") : _(" the lava"));
    } else if ((trap = t_at(u.ux, u.uy)) != null
               && (uteetering_at_seen_pit(trap) || uescaped_shaft(trap))) {
        dotrap(trap, FORCEBUNGLE);
        /* might escape trap and still be teetering at brink */
        if (!u.utrap)
            cant_reach_floor(u.ux, u.uy, FALSE, TRUE, FALSE);
    } else if (!ispick
               /* can only dig down with an axe when doing so will
                  trigger or disarm a trap here */
               && (!trap || (trap.ttyp != LANDMINE
                             && trap.ttyp != BEAR_TRAP))) {
        pline(_("%s merely scratches the %s."), Yobjnam2(obj, 0),
              surface(u.ux, u.uy));
        u_wipe_engr(3);
    } else {
        if (svc.context.digging.pos.x != u.ux
            || svc.context.digging.pos.y != u.uy
            || !on_level(svc.context.digging.level, u.uz)
            || !svc.context.digging.down) {
            svc.context.digging.chew = FALSE;
            svc.context.digging.down = TRUE;
            svc.context.digging.warned = FALSE;
            svc.context.digging.pos.x = u.ux;
            svc.context.digging.pos.y = u.uy;
            assign_level(svc.context.digging.level, u.uz);
            svc.context.digging.effort = 0;
            You(_("start %s downward."), verbing);
            if (chars[u.ushops]) {
                shopdig(0);
                add_damage(u.ux, u.uy, SHOP_PIT_COST);
            }
        } else
            You(_("continue %s downward."), verbing);
        gd.did_dig_msg = FALSE;
        set_occupation(dig, verbing, 0);
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

function watchman_canseeu(mtmp) { /* boolean */
    if (is_watch(mtmp.data) && mtmp.mcansee && m_canseeu(mtmp)
        && mtmp.mpeaceful)
        return TRUE;
    return FALSE;
}

/*
 * Town Watchmen frown on damage to the town walls, trees or fountains.
 * It's OK to dig holes in the ground, however.
 * If mtmp is assumed to be a watchman, a watchman is found if mtmp == 0
 * zap == TRUE if wand/spell of digging, FALSE otherwise (chewing)
 */
export function watch_dig(mtmp, x, y, zap) { /* void */
    let lev = levl()[x][y];

    if (in_town(x, y)
        && (closed_door(x, y) || lev.typ == SDOOR || IS_WALL(lev.typ)
            || IS_FOUNTAIN(lev.typ) || IS_TREE(lev.typ))) {
        if (!mtmp)
            mtmp = get_iter_mons(watchman_canseeu);

        if (mtmp) {
               ;
            if (zap || svc.context.digging.warned) {
                verbalize(_("Halt, vandal!  You're under arrest!"));
                angry_guards(+!!Deaf());
            } else {
                let str;

                if (IS_DOOR(lev.typ))
                    str = _("door");
                else if (IS_TREE(lev.typ))
                    str = _("tree");
                else if (IS_OBSTRUCTED(lev.typ))
                    str = _("wall");
                else
                    str = _("fountain");
                verbalize(_("Hey, stop damaging that %s!"), str);
                svc.context.digging.warned = TRUE;
            }
            if (is_digging())
                stop_occupation();
        }
    }
}

/* Return TRUE if monster died, FALSE otherwise.  Called from m_move(). */
export function mdig_tunnel(mtmp) { /* boolean */
    let here;
    let sawit, seeit, trapped;
    let pile = rnd(12);

    here = levl()[mtmp.mx][mtmp.my];
    if (here.typ == SDOOR)
        cvt_sdoor_to_door(here); /* ->typ = DOOR */

    /* Eats away door if present & closed or locked */
    if (closed_door(mtmp.mx, mtmp.my)) {
        if (chars[in_rooms(mtmp.mx, mtmp.my, SHOPBASE)])
            add_damage(mtmp.mx, mtmp.my, 0);
        /* sawit: closed door location is more visible than an open one */
        sawit = canseemon(mtmp); /* before door state change and unblock_pt */
        trapped = (here.flags & D_TRAPPED) ? TRUE : FALSE;
        here.flags = trapped ? D_NODOOR : D_BROKEN;
        recalc_block_point(mtmp.mx, mtmp.my); /* vision */
        newsym(mtmp.mx, mtmp.my);
        if (trapped) {
            seeit = canseemon(mtmp);
            if (mb_trapped(mtmp, (sawit || seeit ? 1 : 0))) { /* mtmp is killed */
                newsym(mtmp.mx, mtmp.my);
                return TRUE;
            }
        } else {
            if (flags.verbose) {
                if (!Unaware() && !rn2(3)) /* not too often.. */
                    draft_message(TRUE); /* "You feel an unexpected draft." */
            }
        }
        return FALSE;
    } else if (here.typ == SCORR) {
        here.typ = CORR, here.flags = 0;
        unblock_point(mtmp.mx, mtmp.my);
        newsym(mtmp.mx, mtmp.my);
        draft_message(FALSE); /* "You feel a draft." */
        return FALSE;
    } else if (!IS_OBSTRUCTED(here.typ) && !IS_TREE(here.typ)) { /* no dig */
        return FALSE;
    }

    /* Only rock, trees, and walls fall through to this point. */
    if ((here.flags & W_NONDIGGABLE) != 0) {
        impossible(_("mdig_tunnel:  %s at (%d,%d) is undiggable"),
                   (IS_WALL(here.typ) ? _("wall")
                    : IS_TREE(here.typ) ? _("tree") : _("stone")),
                   mtmp.mx, mtmp.my);
        return FALSE; /* still alive */
    }

    if (IS_WALL(here.typ)) {
        /* KMH -- Okay on arboreal levels (room walls are still stone) */
        if (flags.verbose && !rn2(5)) {
             ;
            You_hear(_("crashing rock."));
        }
        if (chars[in_rooms(mtmp.mx, mtmp.my, SHOPBASE)])
            add_damage(mtmp.mx, mtmp.my, 0);
        if (svl.level.flags.is_maze_lev) {
            here.typ = ROOM, here.flags = 0;
        } else if (svl.level.flags.is_cavernous_lev
                   && !in_town(mtmp.mx, mtmp.my)) {
            here.typ = CORR, here.flags = 0;
        } else {
            here.typ = DOOR, here.flags = D_NODOOR;
        }
    } else if (IS_TREE(here.typ)) {
        here.typ = ROOM, here.flags = 0;
        if (pile && pile < 5)
            rnd_treefruit_at(mtmp.mx, mtmp.my);
    } else {
        here.typ = CORR, here.flags = 0;
        if (pile && pile < 5)
            mksobj_at((pile == 1) ? BOULDER : ROCK, mtmp.mx, mtmp.my,
                             TRUE, FALSE);
    }
    newsym(mtmp.mx, mtmp.my);
    if (!sobj_at(BOULDER, mtmp.mx, mtmp.my))
        unblock_point(mtmp.mx, mtmp.my); /* vision */

    return FALSE;
}

export const STRIDENT = 4;

/* draft refers to air currents, but can be a pun on "draft" as conscription
   for military service (probably not a good pun if it has to be explained) */
export function draft_message(unexpected) { /* void */
    /*
     * [Bug or TODO?  Have caller pass coordinates and use the travel
     * mechanism to determine whether there is a path between
     * destroyed door (or exposed secret corridor) and hero's location.
     * When there is no such path, no draft should be felt.]
     */

    if (unexpected) {
        if (!Hallucination())
            You_feel(_("an unexpected draft."));
        else
            /* U.S. classification system uses 1-A for eligible to serve
               and 4-F for ineligible due to physical or mental defect;
               some intermediate values exist but are rarely seen */
            You_feel(_("like you are %s."),
                     (ACURR(A_STR) < 6 || ACURR(A_DEX) < 6
                      || ACURR(A_CON) < 6 || ACURR(A_CHA) < 6
                      || ACURR(A_INT) < 6 || ACURR(A_WIS) < 6) ? _("4-F")
                                                               : _("1-A"));
    } else {
        if (!Hallucination()) {
            You_feel(_("a draft."));
        } else {
            /* "marching" is deliberately ambiguous; it might mean drills
                after entering military service or mean engaging in protests */
            let draft_reaction = static_array("draft_message.draft_reaction", ptr_to(char), null, [
                _("enlisting"), _("marching"), _("protesting"), _("fleeing"),
            ]);
            let dridx;

            /* Lawful: 0..1, Neutral: 1..2, Chaotic: 2..3 */
            dridx = rn1(2, 1 - sgn(u.ualign.type));
            if (u.ualign.record < STRIDENT)
                /* L: +(0..2), N: +(-1..1), C: +(-2..0); all: 0..3 */
                dridx += rn1(3, sgn(u.ualign.type) - 1);
            You_feel(_("like %s."), draft_reaction[dridx]);
        }
    }
}

/* digging via wand zap or spell cast */
export function zap_dig() { /* void */
    const $frame = stack_frame(); try {
    let room;
    let mtmp;
    let otmp;
    let trap_with_u = null;
    let zx, zy, flow_x = -1, flow_y = -1;
    let diridx = 8, digdepth;
    let shopdoor, shopwall, maze_dig, pitdig = FALSE, pitflow = FALSE;

    /*
     * Original effect (approximately):
     * from CORR: dig until we pierce a wall
     * from ROOM: pierce wall and dig until we reach
     * an ACCESSIBLE place.
     * Currently: dig for digdepth positions;
     * also down on request of Lennart Augustsson.
     * 3.6.0: from a PIT: dig one adjacent pit.
     */

    if (u.uswallow) {
        mtmp = u.ustuck;

        if (!is_whirly(mtmp.data)) {
            if (digests(mtmp.data))
                You(_("pierce %s %s wall!"), s_suffix(mon_nam(mtmp)),
                    mbodypart(mtmp, STOMACH));
            if (unique_corpstat(mtmp.data))
                mtmp.mhp = Math.trunc((mtmp.mhp + 1) / 2);
            else
                mtmp.mhp = 1; /* almost dead */
            expels(mtmp, mtmp.data, +!digests(mtmp.data));
        }
        return;
    } /* swallowed */

    if (u.dz) {
        if (!Is_airlevel(u.uz) && !Is_waterlevel(u.uz) && !Underwater()) {
            if (u.dz < 0 || On_stairs(u.ux, u.uy)) {
                let dmg;
                if (On_stairs(u.ux, u.uy)) {
                    let stway = stairway_at(u.ux, u.uy);
                    pline_The(_("beam bounces off the %s and hits the %s."),
                              stway.isladder ? _("ladder") : _("stairs"),
                              ceiling(u.ux, u.uy));
                }
                You(_("loosen a rock from the %s."), ceiling(u.ux, u.uy));
                pline(_("It falls on your %s!"), body_part(HEAD));
                dmg = rnd(hard_helmet(uarmh) ? 2 : 6);
                losehp(Maybe_Half_Phys(dmg), _("falling rock"), KILLED_BY_AN);
                otmp = mksobj_at(ROCK, u.ux, u.uy, FALSE, FALSE);
                if (otmp) {
                    xname(otmp); /* set dknown, maybe bknown */
                    stackobj(otmp);
                }
                newsym(u.ux, u.uy);
            } else {
                watch_dig(null, u.ux, u.uy, TRUE);
                dighole(FALSE, TRUE, null);
            }
        }
        return;
    } /* up or down */

    /* normal case: digging across the level */
    shopdoor = shopwall = FALSE;
    maze_dig = (svl.level.flags.is_maze_lev && !Is_earthlevel(u.uz) ? 1 : 0);
    zx = u.ux + u.dx;
    zy = u.uy + u.dy;
    if (u.utrap && u.utraptype == TT_PIT
        && (trap_with_u = t_at(u.ux, u.uy))) {
        pitdig = TRUE;
        diridx = xytodir(u.dx, u.dy);
    }
    digdepth = rn1(18, 8);
    tmp_at(DISP_BEAM, cmap_to_glyph(S_digbeam));
    while (--digdepth >= 0) {
        if (!isok(zx, zy))
            break;
        room = levl()[zx][zy];
        tmp_at(zx, zy);
        nh_delay_output()(); /* wait a little bit */

        if (pitdig) { /* we are already in a pit if this is true */
            let cc = stack_struct(struct_nhcoord);
            let adjpit = t_at(zx, zy);

            if (diridx != DIR_ERR
                && !conjoined_pits(adjpit, trap_with_u, FALSE)) {
                digdepth = 0; /* limited to the adjacent location only */
                (digdepth);
                if (!(adjpit && is_pit(adjpit.ttyp))) {
                    let buf = stack_array(char, BUFSZ);

                    cc.x = zx;
                    cc.y = zy;
                    if (!adj_pit_checks(cc, buf)) {
                        if (chars[buf + 0])
                            pline1(buf);
                    } else {
                        /* this can also result in a pool at zx,zy */
                        dighole(TRUE, TRUE, cc);
                        adjpit = t_at(zx, zy);
                    }
                }
                if (adjpit && is_pit(adjpit.ttyp)) {
                    let adjidx = DIR_180(diridx);

                    trap_with_u.vl.v_conjoined |= (1 << diridx);
                    adjpit.vl.v_conjoined |= (1 << adjidx);
                    flow_x = zx;
                    flow_y = zy;
                    pitflow = TRUE;
                }
                if (is_pool(zx, zy) || is_lava(zx, zy)) {
                    flow_x = zx - u.dx;
                    flow_y = zy - u.dy;
                    pitflow = TRUE;
                }
                break;
            }
        } else if (closed_door(zx, zy) || room.typ == SDOOR) {
            if (chars[in_rooms(zx, zy, SHOPBASE)]) {
                add_damage(zx, zy, SHOP_DOOR_COST);
                shopdoor = TRUE;
            }
            if (room.typ == SDOOR)
                room.typ = DOOR; /* doormask set below */
            else if (cansee(zx, zy))
                pline_The(_("door is razed!"));
            watch_dig(null, zx, zy, TRUE);
            room.flags = D_NODOOR;
            recalc_block_point(zx, zy); /* vision */
            digdepth -= 2;
            if (maze_dig)
                break;
        } else if (maze_dig) {
            if (IS_WALL(room.typ)) {
                if (!(room.flags & W_NONDIGGABLE)) {
                    if (chars[in_rooms(zx, zy, SHOPBASE)]) {
                        add_damage(zx, zy, SHOP_WALL_COST);
                        shopwall = TRUE;
                    }
                    room.typ = ROOM, room.flags = 0;
                    unblock_point(zx, zy); /* vision */
                } else if (!Blind())
                    pline_The(_("wall glows then fades."));
                break;
            } else if (IS_TREE(room.typ)) { /* check trees before stone */
                if (!(room.flags & W_NONDIGGABLE)) {
                    room.typ = ROOM, room.flags = 0;
                    unblock_point(zx, zy); /* vision */
                } else if (!Blind())
                    pline_The(_("tree shudders but is unharmed."));
                break;
            } else if (room.typ == STONE || room.typ == SCORR) {
                if (!(room.flags & W_NONDIGGABLE)) {
                    room.typ = CORR, room.flags = 0;
                    unblock_point(zx, zy); /* vision */
                } else if (!Blind())
                    pline_The(_("rock glows then fades."));
                break;
            }
        } else if (IS_OBSTRUCTED(room.typ)) {
            if (!may_dig(zx, zy))
                break;
            if (IS_WALL(room.typ) || room.typ == SDOOR) {
                if (chars[in_rooms(zx, zy, SHOPBASE)]) {
                    add_damage(zx, zy, SHOP_WALL_COST);
                    shopwall = TRUE;
                }
                watch_dig(null, zx, zy, TRUE);
                if (svl.level.flags.is_cavernous_lev && !in_town(zx, zy)) {
                    room.typ = CORR, room.flags = 0;
                } else {
                    room.typ = DOOR, room.flags = D_NODOOR;
                }
                digdepth -= 2;
            } else if (IS_TREE(room.typ)) {
                room.typ = ROOM, room.flags = 0;
                digdepth -= 2;
            } else { /* IS_OBSTRUCTED but not IS_WALL or SDOOR */
                room.typ = CORR, room.flags = 0;
                digdepth--;
            }
            unblock_point(zx, zy); /* vision */
        }
        zx += u.dx;
        zy += u.dy;
    }                    /* while */
    tmp_at(DISP_END, 0); /* closing call */

    if (pitflow && isok(flow_x, flow_y)) {
        let ttmp = t_at(flow_x, flow_y);

        if (ttmp && is_pit(ttmp.ttyp)) {
            let filltyp = fillholetyp(ttmp.tx, ttmp.ty, TRUE);

            if (filltyp != ROOM)
                pit_flow(ttmp, filltyp);
        }
    }

    if (shopdoor || shopwall)
        pay_for_damage(shopdoor ? _("destroy") : _("dig into"), FALSE);
    return;
    } finally { stack_pop($frame); }
}

/*
 * This checks what is on the surface above the
 * location where an adjacent pit might be created if
 * you're zapping a wand of digging laterally while
 * down in the pit.
 */
function adj_pit_checks(cc, msg) { /* int */
    let ltyp;
    let room;
    let foundation_msg = _("The foundation is too hard to dig through from this angle.");

    if (!cc)
        return FALSE;
    if (!isok(cc.x, cc.y))
        return FALSE;
    chars[msg] = ord('\0');
    room = levl()[cc.x][cc.y];
    ltyp = room.typ, room.flags = 0;

    if (is_pool(cc.x, cc.y) || is_lava(cc.x, cc.y)) {
        /* this is handled by the caller after we return FALSE */
        return FALSE;
    } else if (closed_door(cc.x, cc.y) || room.typ == SDOOR) {
        /* We reject this here because dighole() isn't
           prepared to deal with this case */
        strcpy(msg, foundation_msg);
        return FALSE;
    } else if (IS_WALL(ltyp)) {
        /* if (room->wall_info & W_NONDIGGABLE) */
        strcpy(msg, foundation_msg);
        return FALSE;
    } else if (IS_TREE(ltyp)) { /* check trees before stone */
        /* if (room->wall_info & W_NONDIGGABLE) */
        strcpy(msg, _("The tree's roots glow then fade."));
        return FALSE;
    } else if (ltyp == STONE || ltyp == SCORR) {
        if (room.flags & W_NONDIGGABLE) {
            strcpy(msg, _("The rock glows then fades."));
            return FALSE;
        }
    } else if (ltyp == IRONBARS) {
        /* "set of iron bars" */
        strcpy(msg, _("The bars go much deeper than your pit."));
        return FALSE;
    } else if (IS_SINK(ltyp)) {
        strcpy(msg, _("A tangled mass of plumbing remains below the sink."));
        return FALSE;
    } else if (On_ladder(cc.x, cc.y)) {
        strcpy(msg, _("The ladder is unaffected."));
        return FALSE;
    } else {
        let supporting = 0;

        if (IS_FOUNTAIN(ltyp))
            supporting = _("fountain");
        else if (IS_THRONE(ltyp))
            supporting = _("throne");
        else if (IS_ALTAR(ltyp))
            supporting = _("altar");
        else if (On_stairs(cc.x, cc.y))
            /* staircase up or down. On_ladder handled above. */
            supporting = _("stairs");
        else if (ltyp == DRAWBRIDGE_DOWN   /* "lowered drawbridge" */
                 || ltyp == DBWALL)        /* "raised drawbridge" */
            supporting = _("drawbridge");

        if (supporting) {
            sprintf(msg, _("The %s supporting structures remain intact."), s_suffix(supporting))
;
            return FALSE;
        }
    }
    return TRUE;
}

/*
 * Ensure that all conjoined pits fill up.
 */
function pit_flow(trap, filltyp) { /* void */
    const $frame = stack_frame(); try {
    /*
     * FIXME?
     *  liquid_flow() -> pooleffects() -> {drown(),lava_effects()}
     *  might kill the hero; the game will end and if that leaves bones,
     *  remaining conjoined pits will be left unprocessed.
     */
    if (trap && filltyp != ROOM && is_pit(trap.ttyp)) {
        let t = stack_struct(struct_trap);
        let idx;

        struct_assign(t, trap);
        levl()[t.tx][t.ty].typ = filltyp, levl()[t.tx][t.ty].flags = 0;
        liquid_flow(t.tx, t.ty, filltyp, trap,
                    u_at(t.tx, t.ty)
                        ? _("Suddenly %s flows in from the adjacent pit!")
                        : 0);
        for (idx = 0; idx < N_DIRS; ++idx) {
            if (t.vl.v_conjoined & (1 << idx)) {
                let x, y;
                let t2;

                x = t.tx + chars[xdir + idx];
                y = t.ty + chars[ydir + idx];
                t2 = t_at(x, y);

                /* recursion */
                pit_flow(t2, filltyp);
            }
        }
    }
    } finally { stack_pop($frame); }
}

export function buried_ball(cc) { /* struct obj * */
    let odist, bdist = COLNO;
    let otmp, ball = null;

    /* FIXME:
     *  This is just approximate; if multiple buried balls meet the
     *  criterium (within 2 steps of tethered hero's present location)
     *  it will find an arbitrary one rather than the one which used
     *  to be uball.  Once 3.6.{0,1} save file compatibility is broken,
     *  we should add svc.context.buriedball_oid and then we can find the
     *  actual former uball, which might be extra heavy or christened
     *  or not the one buried directly underneath the target spot.
     *
     *  [Why does this search within a radius of two when trapmove()
     *  only lets hero get one step away from the buried ball?]
     */

    /* u.utrap might have already been cleared, in which case the value
       of u.utraptype is no longer meaningful; if u.utrap is still set
       then u.utraptype needs to be for buried ball */
    if (!u.utrap || u.utraptype == TT_BURIEDBALL) {
        for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp.nobj) {
            if (otmp.otyp != HEAVY_IRON_BALL)
                continue;
            /* if found at the target spot, we're done */
            if (otmp.ox == cc.x && otmp.oy == cc.y)
                return otmp;
            /* find nearest within allowable vicinity: +/-2
             *  4 5 8
             *  1 2 5
             *  0 1 4
             */
            odist = dist2(otmp.ox, otmp.oy, cc.x, cc.y);
            if (odist <= 8 && (!ball || odist < bdist)) {
                /* remember nearest buried ball but keep checking others */
                ball = otmp;
                bdist = odist;
            }
        }
    }
    if (ball) {
        /* found, but not at < cc->x, cc->y > */
        cc.x = ball.ox;
        cc.y = ball.oy;
    }
    return ball;
}

export function buried_ball_to_punishment() { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);
    let ball;

    cc.x = u.ux;
    cc.y = u.uy;
    ball = buried_ball(cc);
    if (ball) {
        obj_extract_self(ball);

        punish(ball); /* use ball as flag for unearthed buried ball */
        reset_utrap(FALSE);
        del_engr_at(cc.x, cc.y);
        newsym(cc.x, cc.y);
    }
    } finally { stack_pop($frame); }
}

export function buried_ball_to_freedom() { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);
    let ball;

    cc.x = u.ux;
    cc.y = u.uy;
    ball = buried_ball(cc);
    if (ball) {
        obj_extract_self(ball);

        place_object(ball, cc.x, cc.y);
        stackobj(ball);
        reset_utrap(TRUE);
        del_engr_at(cc.x, cc.y);
        newsym(cc.x, cc.y);
    }
    } finally { stack_pop($frame); }
}

/* move objects from fobj/nexthere lists to buriedobjlist, keeping position
   information */
export function bury_an_obj(otmp, dealloced) { /* struct obj * */
    let otmp2;
    let under_ice;

    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("bury_an_obj: %s"), xname(otmp)); iflags.last_msg = save_plnmsg; } } while (0);
    if (dealloced)
        chars[dealloced] = FALSE;
    if (otmp == uball) {
        unpunish();
        set_utrap(unsigned(rn1(50, 20)), TT_BURIEDBALL);
        pline_The(_("iron ball gets buried!"));
    }
    /* after unpunish(), or might get deallocated chain */
    otmp2 = otmp.v.v_nexthere;
    /*
     * obj_resists(,0,0) prevents Rider corpses from being buried.
     * It also prevents The Amulet and invocation tools from being
     * buried.  Since they can't be confined to bags and statues,
     * it makes sense that they can't be buried either, even though
     * the real reason there (direct accessibility when carried) is
     * completely different.
     */
    if (otmp == uchain || obj_resists(otmp, 0, 0))
        return otmp2;

    if (otmp.otyp == LEASH && otmp.corpsenm != 0)
        o_unleash(otmp);

    if (otmp.lamplit && otmp.otyp != POT_OIL)
        end_burn(otmp, TRUE);

    obj_extract_self(otmp);

    under_ice = is_ice(otmp.ox, otmp.oy);
    if ((otmp.otyp == ROCK && !under_ice) || otmp.otyp == BOULDER) {
        /* merges into burying material; boulder removal is for #wizbury */
        if (dealloced)
            chars[dealloced] = TRUE;
        obfree(otmp, null);
        return otmp2;
    }
    /*
     * Start a rot on organic material.  Not corpses -- they
     * are already handled.
     */
    if (otmp.otyp == CORPSE) {
        ; /* should cancel timer if under_ice */
    } else if ((under_ice ? (otmp.oclass == POTION_CLASS) : is_organic(otmp))
               && !obj_resists(otmp, 5, 95)) {
        start_timer((under_ice ? 0 : 250) + rnd(250),
                           TIMER_OBJECT, ROT_ORGANIC, obj_to_any(otmp));
    }
    add_to_buried(otmp);
    return  otmp2;
}

export function bury_objs(x, y) { /* void */
    let otmp, otmp2;
    let shkp;
    let loss = 0;
    let costly;

    costly = ((shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)]))
              && costly_spot(x, y) ? 1 : 0);

    if (svl.level.objects[x][y] != null) {
        debugpline2(_("bury_objs: at <%d,%d>"), x, y, __FILE__);
    }
    for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp2) {
        if (costly && !svc.context.mon_moving) {
            loss += stolen_value(otmp, x, y, shkp.mpeaceful, TRUE);
            if (otmp.oclass != COIN_CLASS)
                otmp.no_charge = 1;
        }
        otmp2 = bury_an_obj(otmp, 0);
    }

    /* don't expect any engravings here, but just in case */
    del_engr_at(x, y);
    newsym(x, y);
    maybe_unhide_at(x, y);

    if (costly && loss) {
        You(_("owe %s %lld %s for burying merchandise."), shkname(shkp), loss,
            currency(loss));
    }
}

/* move objects from buriedobjlist to fobj/nexthere lists; if caller
   converts terrain from ice to something, it should call obj_ice_effects() */
export function unearth_objs(x, y) { /* void */
    const $frame = stack_frame(); try {
    let otmp, otmp2, bball;
    let cc = stack_struct(struct_nhcoord);

    debugpline2(_("unearth_objs: at <%d,%d>"), x, y, __FILE__);
    cc.x = x;
    cc.y = y;
    bball = buried_ball(cc);
    for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp2) {
        otmp2 = otmp.nobj;
        if (otmp.ox == x && otmp.oy == y) {
            if (bball && otmp == bball
                && u.utrap && u.utraptype == TT_BURIEDBALL) {
                buried_ball_to_punishment();
            } else {
                obj_extract_self(otmp);
                if (otmp.timed)
                    stop_timer(ROT_ORGANIC, obj_to_any(otmp));
                place_object(otmp, x, y);
                stackobj(otmp);
            }
        }
    }
    del_engr_at(x, y);
    newsym(x, y);
    } finally { stack_pop($frame); }
}

/*
 * The organic material has rotted away while buried.  As an expansion,
 * we could add partial damage.  A damage count is kept in the object
 * and every time we are called we increment the count and reschedule another
 * timeout.  Eventually the object rots away.
 *
 * This is used by buried objects other than corpses.  When a container rots
 * away, any contents become newly buried objects.
 */
/* ARGSUSED */
export function rot_organic(arg, timeout) { /* void */
    let obj = arg.a_obj;

    while (Has_contents(obj)) {
        /* We don't need to place contained object on the floor
           first, but we do need to update its map coordinates. */
        obj.cobj.ox = obj.ox, obj.cobj.oy = obj.oy;
        /* Everything which can be held in a container can also be
           buried, so bury_an_obj's use of obj_extract_self insures
           that Has_contents(obj) will eventually become false. */
        bury_an_obj(obj.cobj, 0);
    }
    obj_extract_self(obj);
    obfree(obj, null);
}

/*
 * Called when a corpse has rotted completely away.
 */
export function rot_corpse(arg, timeout) { /* void */
    let x = 0, y = 0;
    let obj = arg.a_obj;
    let on_floor = +(obj.where == OBJ_FLOOR),
            in_invent = +(obj.where == OBJ_INVENT);

    if (on_floor) {
        x = obj.ox;
        y = obj.oy;
    } else if (in_invent) {
        if (flags.verbose) {
            let cname = corpse_xname(obj, 0, CXN_NO_PFX);

            Your(_("%s%s %s away%c"), obj == uwep ? _("wielded ") : _(""), cname,
                 otense(obj, _("rot")), obj == uwep ? ord('!') : ord('.'));
        }
        if (obj.owornmask) {
            remove_worn_item(obj, TRUE);
            stop_occupation();
        }
    } else if (obj.where == OBJ_MINVENT) {
        if (obj.owornmask && obj == MON_WEP(obj.v.v_ocarry))
            setmnotwielded(obj.v.v_ocarry, obj); /* clears owornmask */
    } else if (obj.where == OBJ_MIGRATING) {
        /* clear destination flag so that obfree()'s check for
           freeing a worn object doesn't get a false hit */
        obj.owornmask = 0;
    }
    rot_organic(arg, timeout);
    if (on_floor) {
        let mtmp = m_at(x, y);

        /* a hiding monster may be exposed */
        if (mtmp && !OBJ_AT(x, y) && mtmp.mundetected
            && hides_under(mtmp.data)) {
            mtmp.mundetected = 0;
        } else if (u_at(x, y)
                   && u.uundetected && hides_under(gy.youmonst.data))
            hideunder(gy.youmonst);
        newsym(x, y);
    } else if (in_invent)
        update_inventory();
}

/* #if 0: not in this build */

/* the #wizbury command - bury everything at your loc and around */
export function wiz_debug_cmd_bury() { /* int */
    let otmp;
    let x, y, before = 0, after = 0, diff;

    for (x = u.ux - 1; x <= u.ux + 1; x++)
        for (y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y))
                continue;
            for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere)
                ++before;

            bury_objs(x, y);

            for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere)
                ++after;
        }

    diff = before - after;
    if (before == 0)
        /* there was nothing here */
        pline(_("No objects here or adjacent to bury."));
    else if (diff == 0)
        /* before and after will be the same if only unburiable objects are
           present (The Amulet, invocation items, Rider corpses, uchain when
           uball doesn't get buried: carried or floor beyond burial range) */
        pline(_("No objects buried."));
    else
        /* usual case; if uball got buried, uchain went away and won't be
           counted as buried */
        pline(_("%d object%s buried."), diff, plur(diff));
    return ECMD_OK;
}

/* for 'onefile' testing, leave STRIDENT defined so that the other instance
   of it in pray.c will trigger a complaint if someone changes its value */
/*#undef STRIDENT*/

/*dig.c*/

import { AM_MASK, AM_SANCTUM, A_LAWFUL, A_NONE } from "./align.h.js";
import { Amask2align } from "./align.h.macros.js";
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_dig_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { COIN_CLASS, POTION_CLASS, S_MUMMY, S_ZOMBIE, S_digbeam } from "./defsym.h.js";
import { DISP_BEAM, DISP_END, EXPL_MAGICAL } from "./display.h.js";
import { cmap_to_glyph } from "./display.h.macros.js";
import { MIGR_RANDOM, struct_d_level } from "./dungeon.h.js";
import { Is_airlevel, Is_earthlevel, Is_stronghold, Is_waterlevel } from "./dungeon.h.macros.js";
import { BUFSZ, COLNO, FALSE, ROWNO, TRUE, coordxy } from "./global.h.js";
import {
    CQ_CANNED, CXN_NO_PFX, DIGCHECK_FAILED, DIGCHECK_FAIL_AIRLEVEL, DIGCHECK_FAIL_ALTAR,
    DIGCHECK_FAIL_BOULDER, DIGCHECK_FAIL_CANTDIG, DIGCHECK_FAIL_OBJ_POOL_OR_TRAP,
    DIGCHECK_FAIL_ONLADDER, DIGCHECK_FAIL_ONSTAIRS, DIGCHECK_FAIL_THRONE, DIGCHECK_FAIL_TOOHARD,
    DIGCHECK_FAIL_UNDESTROYABLETRAP, DIGCHECK_FAIL_WATERLEVEL, DIGCHECK_PASSED,
    DIGCHECK_PASSED_DESTROY_TRAP, DIGCHECK_PASSED_PITONLY, DIR_ERR, ECMD_CANCEL, ECMD_OK, ECMD_TIME,
    FOOT, FORCEBUNGLE, FORCETRAP, HEAD, KILLED_BY, KILLED_BY_AN, MM_NOMSG, MV_WALK, NO_PART,
    NO_TRAP_FLAGS, N_DIRS, N_DIRS_Z, RLOC_NOMSG, SHOP_DOOR_COST, SHOP_PIT_COST, SHOP_WALL_COST,
    STOMACH, TAINT_AGE,
} from "./hack.h.js";
import {
    DIR_180, Maybe_Half_Phys, SHOP_WALL_DMG, max, min, pline1, plur, rn1,
} from "./hack.h.macros.js";
import { debugpline2, showdebug } from "./lint.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    digests, grounded, hides_under, is_floater, is_flyer, is_watch, is_whirly, passes_walls,
    unique_corpstat,
} from "./mondata.h.macros.js";
import { MZ_HUGE } from "./monflag.h.js";
import { MON_WEP } from "./monst.h.macros.js";
import {
    PM_ARCHEOLOGIST, PM_DWARF, PM_EARTH_ELEMENTAL, PM_ELF, PM_RANGER, PM_SAMURAI, PM_XORN,
} from "./monsters.h.js";
import { OBJ_FLOOR, OBJ_INVENT, OBJ_MIGRATING, OBJ_MINVENT } from "./obj.h.js";
import { Has_contents, bimanual, greatest_erosion, is_axe, is_pick } from "./obj.h.macros.js";
import { TRAP_EXPLODE } from "./objclass.h.js";
import { OBJ_NAME, is_organic } from "./objclass.h.macros.js";
import {
    BEARTRAP, BOULDER, CORPSE, HEAVY_IRON_BALL, LAND_MINE, LEASH, POT_OIL, ROCK, STATUE,
} from "./objects.h.js";
import { RIGHT_SIDE } from "./prop.h.js";
import {
    ALTAR, CORR, DBWALL, DB_LAVA, DB_MOAT, DB_UNDER, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN,
    D_NODOOR, D_TRAPPED, F_WARNED, IRONBARS, LAVAPOOL, LAVAWALL, MOAT, POOL, ROOM, SCORR, SDOOR,
    STONE, W_NONDIGGABLE,
} from "./rm.h.js";
import {
    IS_ALTAR, IS_DOOR, IS_FOUNTAIN, IS_FURNITURE, IS_GRAVE, IS_OBSTRUCTED, IS_ROOM, IS_SINK,
    IS_STWALL, IS_THRONE, IS_TREE, IS_WALL, IS_WATERWALL, MON_AT, OBJ_AT, levl, m_at,
} from "./rm.h.macros.js";
import { ROT_ORGANIC, TIMER_OBJECT } from "./timeout.h.js";
import { BEAR_TRAP, HOLE, LANDMINE, PIT, TRAPDOOR, WEB, struct_trap } from "./trap.h.js";
import { is_hole, is_magical_trap, is_pit, undestroyable_trap } from "./trap.h.macros.js";
import { COULD_SEE, IN_SIGHT } from "./vision.h.js";
import { cansee, m_canseeu } from "./vision.h.macros.js";
import { display_nhwindow, nh_delay_output } from "./winprocs.h.macros.js";
import { TT_BURIEDBALL, TT_INFLOOR, TT_PIT, TT_WEB } from "./you.h.js";
import { Race_if, Role_if, next2u, u_at, uhis } from "./you.h.macros.js";
import {
    Blind, Deaf, Flying, Fumbling, Hallucination, Levitation, Unaware, Underwater,
} from "./youprop.h.macros.js";
import { char, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { memset, sprintf, strcat, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, struct_assign } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { doapply, next_to_u, o_unleash } from "./apply.js";
import { adjalign, exercise } from "./attrib.js";
import {
    cmd_from_dir, cmdq_add_ec, cmdq_add_key, confdir, dxdy_moveok, getdir, isok, movecmd,
    set_occupation, xytodir,
} from "./cmd.js";
import {
    destroy_drawbridge, find_drawbridge, is_db_wall, is_drawbridge_wall, is_ice, is_lava, is_moat,
    is_pool, is_pool_or_lava,
} from "./dbridge.js";
import {
    disp, flags, gd, gm, gn, go, gv, gy, iflags, svc, svd, svl, svm, u, xdir, ydir,
} from "./decl.js";
import { cvt_sdoor_to_door } from "./detect.js";
import { canseemon, feel_newsym, flush_screen, newsym, tmp_at } from "./display.js";
import { dropx, goto_level, set_wounded_legs } from "./do.js";
import { Monnam, hliquid, mon_nam } from "./do_name.js";
import { hard_helmet } from "./do_wear.js";
import { migrate_to_level } from "./dog.js";
import { impact_drop } from "./dokick.js";
import {
    Can_dig_down, Is_botlevel, assign_level, ceiling, depth, get_level, ledger_no, on_level,
    surface,
} from "./dungeon.js";
import { can_reach_floor, cant_reach_floor, del_engr_at, u_wipe_engr } from "./engrave.js";
import { explode } from "./explode.js";
import { breaksink, dogushforth, dryup } from "./fountain.js";
import {
    in_rooms, in_town, losehp, may_dig, nomul, obj_to_any, pooleffects, spot_checks, spoteffects,
    switch_terrain,
} from "./hack.js";
import { dist2, s_suffix, sgn } from "./hacklib.js";
import { align_str } from "./insight.js";
import { currency, delobj, sobj_at, stackobj, update_inventory } from "./invent.js";
import { makemon, mkclass } from "./makemon.js";
import { expels } from "./mhitu.js";
import {
    add_to_buried, mk_tt_object, mksobj_at, obj_extract_self, obj_ice_effects, place_object,
    rnd_treefruit_at,
} from "./mkobj.js";
import {
    angry_guards, get_iter_mons, hideunder, maybe_unhide_at, minliquid, wake_nearby,
} from "./mon.js";
import { closed_door, mb_trapped } from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import {
    An, Yobjnam2, an, corpse_xname, otense, simpleonames, the, xname, yname, yobjnam,
} from "./objnam.js";
import { pickup } from "./pickup.js";
import {
    There, You, You_cant, You_feel, You_hear, Your, impossible, pline, pline_The, verbalize,
} from "./pline.js";
import { body_part, mbodypart } from "./polyself.js";
import { altar_wrath, altarmask_at, desecrate_altar } from "./pray.js";
import { angry_priest } from "./priest.js";
import { punish, unpunish } from "./read.js";
import { d, rn2, rnd, rnl } from "./rnd.js";
import {
    add_damage, costly_spot, make_angry_shk, obfree, pay_for_damage, shop_keeper, shopdig,
    stolen_value,
} from "./shk.js";
import { shkname } from "./shknam.js";
import { On_ladder, On_stairs, stairway_at } from "./stairs.js";
import { remove_worn_item } from "./steal.js";
import { rloc, teleport_pet } from "./teleport.js";
import { end_burn, start_timer, stop_timer } from "./timeout.js";
import {
    b_trapped, cnv_trap_obj, conjoined_pits, delfloortrap, deltrap, dotrap, feeltrap, fire_damage,
    fire_damage_chain, maketrap, mintrap, reset_utrap, seetrap, set_utrap, t_at, trapname,
    uescaped_shaft, uteetering_at_seen_pit, water_damage_chain,
} from "./trap.js";
import { do_attack } from "./uhitm.js";
import { does_block, recalc_block_point, unblock_point } from "./vision.js";
import { abon, dbon, dmgval, setmnotwielded } from "./weapon.js";
import { welded, wield_tool } from "./wield.js";
import { count_wsegs } from "./worm.js";
import { break_statue, fracture_rock, obj_resists } from "./zap.js";
const __FILE__ = "dig.c";
