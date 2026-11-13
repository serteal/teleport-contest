/* NetHack 5.0	vault.c	$NHDT-Date: 1737622664 2025/01/23 00:57:44 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.113 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

export function newegd(mtmp) { /* void */
    if (!mtmp.mextra)
        mtmp.mextra = newmextra();
    if (!EGD(mtmp)) {
        ((mtmp).mextra.egd) = view_of(struct_egd, addr_of(alloc(sizeof(struct_egd))));
        memset(addr_of(EGD(mtmp)), 0, sizeof(struct_egd));
        EGD(mtmp).parentmid = mtmp.m_id;
    }
}

export function free_egd(mtmp) { /* void */
    if (mtmp.mextra && EGD(mtmp)) {
        free(addr_of(EGD(mtmp)));
        ((mtmp).mextra.egd) = null;
    }
    mtmp.isgd = 0;
}

/* try to remove the temporary corridor (from vault to rest of map) being
   maintained by guard 'grd'; if guard is still in it, removal will fail,
   to be tried again later */
function clear_fcorr(grd, forceshow) { /* boolean */
    let fcx, fcy, fcbeg;
    let mtmp;
    let sawcorridor = FALSE,
            silently = program_state.stopprint ? TRUE : FALSE;
    let egrd = EGD(grd);
    let trap;
    let lev;

    if (!on_level(egrd.gdlevel, u.uz))
        return TRUE;

    /* note: guard remains on 'fmon' list (alive or dead, at off-map
       coordinate <0,0>), until temporary corridor from vault back to
       civilization has been removed */
    while ((fcbeg = egrd.fcbeg) < egrd.fcend) {
        fcx = egrd.fakecorr[fcbeg].fx;
        fcy = egrd.fakecorr[fcbeg].fy;
        if ((DEADMONSTER(grd) || !in_fcorridor(grd, u.ux, u.uy))
            && egrd.gddone)
            forceshow = TRUE;
        if ((u_at(fcx, fcy) && !DEADMONSTER(grd))
            || (!forceshow && couldsee(fcx, fcy))
            || (Punished() && !carried(uball) && uball.ox == fcx
                && uball.oy == fcy))
            return FALSE;

        if ((mtmp = m_at(fcx, fcy)) != null) {
            if (mtmp.isgd) {
                return FALSE;
            } else {
                if (mtmp.mtame)
                    yelp(mtmp);
                if (!rloc(mtmp, RLOC_MSG))
                    m_into_limbo(mtmp);
            }
        }
        lev = levl()[fcx][fcy];
        if (lev.typ == CORR && cansee(fcx, fcy))
            sawcorridor = TRUE;
        lev.typ = egrd.fakecorr[fcbeg].ftyp;
        lev.flags = egrd.fakecorr[fcbeg].flags;
        if (IS_STWALL(lev.typ)) {
            /* destroy any trap here (pit dug by you, hole dug via
               wand while levitating or by monster, bear trap or land
               mine via object, spun web) when spot reverts to stone */
            if ((trap = t_at(fcx, fcy)) != null)
                deltrap(trap);
            /* undo scroll/wand/spell of light affecting this spot */
            if (lev.typ == STONE)
                blackout(fcx, fcy);
        }
        del_engr_at(fcx, fcy);
        map_location(fcx, fcy, 1); /* bypass vision */
        recalc_block_point(fcx, fcy);
        gv.vision_full_recalc = 1;
        egrd.fcbeg++;
    }
    if (sawcorridor && !silently)
        pline_The(_("corridor disappears."));
    /* only give encased message if hero is still alive (might get here
       via paygd() -> mongone() -> grddead() when game is over;
       died: no message, quit: message) */
    if (IS_OBSTRUCTED(levl()[u.ux][u.uy].typ) && (Upolyd() ? u.mh : u.uhp) > 0
        && !silently)
        You(_("are encased in rock."));
    return TRUE;
}

/* as a temporary corridor is removed, set stone locations and adjacent
   spots to unlit; if player used scroll/wand/spell of light while inside
   the corridor, we don't want the light to reappear if/when a new tunnel
   goes through the same area */
function blackout(x, y) { /* void */
    let lev;
    let i, j;

    for (i = x - 1; i <= x + 1; ++i)
        for (j = y - 1; j <= y + 1; ++j) {
            if (!isok(i, j))
                continue;
            lev = levl()[i][j];
            /* [possible bug: when (i != x || j != y), perhaps we ought
               to check whether the spot on the far side is lit instead
               of doing a blanket blackout of adjacent locations] */
            if (lev.typ == STONE)
                lev.lit = lev.waslit = 0;
            /* mark <i,j> as not having been seen from <x,y> */
            unset_seenv(lev, x, y, i, j);
        }
}

function restfakecorr(grd) { /* void */
    /* it seems you left the corridor - let the guard disappear */
    if (clear_fcorr(grd, FALSE)) {
        grd.isgd = 0; /* dmonsfree() should delete this mon */
        mongone(grd);
    }
}

/* move guard--dead to alive--to <0,0> until temporary corridor is removed */
function parkguard(grd) { /* void */
    /* either guard is dead or will now be treated as if so;
       monster traversal loops should skip it */
    if (grd == svc.context.polearm.hitmon)
        svc.context.polearm.hitmon = null;
    if (grd.mx) {
        remove_monster(grd.mx, grd.my);
        newsym(grd.mx, grd.my);
    }
    if (m_at(0, 0) != grd)
        place_monster(grd, 0, 0);
    /* [grd->mx,my just got set to 0,0 by place_monster(), so this
       just sets EGD(grd)->ogx,ogy to 0,0 too; is that what we want?] */
    EGD(grd).ogx = grd.mx;
    EGD(grd).ogy = grd.my;
}

/* called in mon.c */
export function grddead(grd) { /* boolean */
    let dispose = clear_fcorr(grd, TRUE);

    if (!dispose) {
        /* destroy guard's gold; drop any other inventory */
        relobj(grd, 0, FALSE);
        grd.mhp = 0;
        parkguard(grd);
        dispose = clear_fcorr(grd, TRUE);
    }
    if (dispose)
        grd.isgd = 0; /* for dmonsfree() */
    return dispose;
}

function in_fcorridor(grd, x, y) { /* boolean */
    let fci;
    let egrd = EGD(grd);

    for (fci = egrd.fcbeg; fci < egrd.fcend; fci++)
        if (x == egrd.fakecorr[fci].fx && y == egrd.fakecorr[fci].fy)
            return TRUE;
    return FALSE;
}

export function findgd() { /* struct monst * */
    let mtmp, mprev;

    /* this might find a guard parked at <0,0> since it'll be on fmon list */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (mtmp.isgd && on_level(EGD(mtmp).gdlevel, u.uz)) {
            if (!mtmp.mx && !EGD(mtmp).gddone)
                mtmp.mhp = mtmp.mhpmax;
            return mtmp;
        }
    }
    /* if not on fmon, look for a guard waiting to migrate to this level */
    for (mprev = ref_of(gm, "migrating_mons"); (mtmp = mprev[0]) != null;
         mprev = ref_of(mtmp, "nmon")) {
        if (mtmp.isgd && on_level(EGD(mtmp).gdlevel, u.uz)) {
            /* take out of migrating_mons and place at <0,0>;
               simplified mon_arrive(); avoid that because it would
               send mtmp into limbo if no regular map spot is available */
            mprev[0] = mtmp.nmon;
            mtmp.nmon = fmon();
            svl.level.monlist = mtmp;
            mon_track_clear(mtmp);
            mtmp.mux = u.ux, mtmp.muy = u.uy;
            mtmp.mx = mtmp.my = 0; /* not on map (note: mx is already 0) */
            parkguard(mtmp);
            return mtmp;
        }
    }
    return null;
}

export function vault_summon_gd() { /* void */
    if (vault_occupied(u.urooms) && !findgd())
        u.uinvault = (VAULT_GUARD_TIME - 1);
}

export function vault_occupied(array) { /* char */
    let ptr;

    for (ptr = array; chars[ptr]; ptr++)
        if (elt(svr.rooms, chars[ptr] - ROOMOFFSET).rtype == VAULT)
            return chars[ptr];
    return ord('\0');
}

/* hero has teleported out of vault while a guard is active */
export function uleftvault(grd) { /* void */
    /* only called if caller has checked vault_occupied() and findgd() */
    if (!grd || !grd.isgd || DEADMONSTER(grd)) {
        impossible(_("escaping vault without guard?"));
        return;
    }
    /* if carrying gold and arriving anywhere other than next to the guard,
       set the guard loose */
    if ((money_cnt(gi.invent) || hidden_gold(TRUE))
        && um_dist(grd.mx, grd.my, 1)) {
        if (grd.mpeaceful) {
            if (canspotmon(grd)) /* see or sense via telepathy */
                pline(_("%s becomes irate."), Monnam(grd));
            grd.mpeaceful = 0; /* bypass setmangry() */
        }
        /* if arriving outside guard's temporary corridor, give the
           guard an extra move to deliver message(s) and to teleport
           out of and remove that corridor */
        if (!in_fcorridor(grd, u.ux, u.uy))
            gd_move(grd);
    }
}

function find_guard_dest(guard, rx, ry) { /* boolean */
    var x, y, dd, lx, ly;

    for (dd = 2; (dd < ROWNO || dd < COLNO); dd++) {
        incr_radius: { for (y = u.uy - dd; y <= u.uy + dd; y++) {
            if (y < 0 || y > ROWNO - 1)
                continue;
            for (x = u.ux - dd; x <= u.ux + dd; x++) {
                if (y != u.uy - dd && y != u.uy + dd && x != u.ux - dd)
                    x = u.ux + dd;
                if (x < 1 || x > COLNO - 1)
                    continue;
                if (guard && ((x == guard.mx && y == guard.my)
                              || (guard.isgd && in_fcorridor(guard, x, y))))
                    continue;
                if (levl()[x][y].typ == CORR) {
                    lx = (x < u.ux) ? x + 1 : (x > u.ux) ? x - 1 : x;
                    ly = (y < u.uy) ? y + 1 : (y > u.uy) ? y - 1 : y;
                    if (levl()[lx][ly].typ != STONE && levl()[lx][ly].typ != CORR)
                        break incr_radius;;
                    rx[0] = x;
                    ry[0] = y;
                    return TRUE;
                }
            }
        }
 }
        ;
    }
    impossible(_("Not a single corridor on this level?"));
    tele();
    return FALSE;
}

export function invault() { /* void */
    const $frame = stack_frame(); try {
    let guard;
    let otmp;
    let spotted;
    let trycount, vaultroom = vault_occupied(u.urooms);
    let vgdeathcount;

    if (!vaultroom) {
        u.uinvault = 0;
        return;
    }
    /* after a couple of guards don't come back from their trips to
       the vault, future guards become more reluctant to turn up (even
       if summoned via whistle) */
    vgdeathcount = svm.mvitals[PM_GUARD].died;
    if (vgdeathcount < 2 ||
        (vgdeathcount < 50 && !rn2(vgdeathcount * vgdeathcount)))
        ++u.uinvault;
    if (u.uinvault < VAULT_GUARD_TIME
        || (u.uinvault % Math.trunc(VAULT_GUARD_TIME / 2)) != 0)
        return;

    guard = findgd();
    if (!guard) {
        /* if time ok and no guard now. */
        let buf = stack_array(char, BUFSZ);
        let x, y, gdx, gdy, typ;
        let rx = stack_var(coordxy), ry = stack_var(coordxy);
        let umoney;

        /* first find the goal for the guard */
        if (!find_guard_dest(null, rx, ry))
            return;
        gdx = rx[0], gdy = ry[0];
        vaultroom -= ROOMOFFSET;

        /* next find a good place for a door in the wall */
        x = u.ux;
        y = u.uy;
        if (levl()[x][y].typ != ROOM) { /* player dug a door and is in it */
            if (levl()[x + 1][y].typ == ROOM) {
                x = x + 1;
            } else if (levl()[x][y + 1].typ == ROOM) {
                y = y + 1;
            } else if (levl()[x - 1][y].typ == ROOM) {
                x = x - 1;
            } else if (elt(levl()[x], y - 1).typ == ROOM) {
                y = y - 1;
            } else if (levl()[x + 1][y + 1].typ == ROOM) {
                x = x + 1;
                y = y + 1;
            } else if (elt(levl()[x - 1], y - 1).typ == ROOM) {
                x = x - 1;
                y = y - 1;
            } else if (elt(levl()[x + 1], y - 1).typ == ROOM) {
                x = x + 1;
                y = y - 1;
            } else if (levl()[x - 1][y + 1].typ == ROOM) {
                x = x - 1;
                y = y + 1;
            }
        }
        while (levl()[x][y].typ == ROOM) {
            let dx, dy;

            dx = (gdx > x) ? 1 : (gdx < x) ? -1 : 0;
            dy = (gdy > y) ? 1 : (gdy < y) ? -1 : 0;
            if (abs(gdx - x) >= abs(gdy - y))
                x += dx;
            else
                y += dy;
        }
        if (u_at(x, y)) {
            if (levl()[x + 1][y].typ == HWALL || levl()[x + 1][y].typ == DOOR)
                x = x + 1;
            else if (levl()[x - 1][y].typ == HWALL
                     || levl()[x - 1][y].typ == DOOR)
                x = x - 1;
            else if (levl()[x][y + 1].typ == VWALL
                     || levl()[x][y + 1].typ == DOOR)
                y = y + 1;
            else if (elt(levl()[x], y - 1).typ == VWALL
                     || elt(levl()[x], y - 1).typ == DOOR)
                y = y - 1;
            else
                return;
        }

        /* make something interesting happen */
        if (!(guard = makemon(mons[PM_GUARD], x, y, MM_EGD | MM_NOMSG)))
            return;
        guard.isgd = 1;
        guard.mpeaceful = 1;
        set_malign(guard);
        EGD(guard).gddone = 0;
        EGD(guard).ogx = x;
        EGD(guard).ogy = y;
        assign_level((EGD(guard).gdlevel), u.uz);
        EGD(guard).vroom = vaultroom;
        EGD(guard).warncnt = 0;

        /* ensure the guard doesn't respawn again next turn if killed
           immediately */
        ++u.uinvault;

        reset_faint(); /* if fainted - wake up */
        /* if there are any boulders in the guard's way, destroy them;
           perhaps the guard knows a touch equivalent of force bolt;
           otherwise the hero wouldn't be able to push one to follow the
           guard out of the vault because that guard would be in its way */
        if ((otmp = sobj_at(BOULDER, guard.mx, guard.my)) != null) {
            let func;
            let bname = simpleonames(otmp);
            let bcnt = 0;

            do {
                ++bcnt;
                fracture_rock(otmp);
                otmp = sobj_at(BOULDER, guard.mx, guard.my);
            } while (otmp);
            /* You_hear() will handle Deaf/!Deaf */
            func = !Blind() ? You_see : You_hear;
            func(_("%s shatter."),
                    (bcnt == 1) ? an(bname) : makeplural(bname));
        }
        spotted = canspotmon(guard);
        if (spotted) {
            pline(_("Suddenly one of the Vault's %s enters!"),
                  makeplural(pmname(guard.data, Mgender(guard))));
            newsym(guard.mx, guard.my);
        } else {
            pline(_("Someone else has entered the Vault."));
            /* make sure that hero who can't see the guard knows where the
               wall is breeched, otherwise we couldn't follow the guard out;
               the breech isn't necessarily adjacent to the hero */
            map_invisible(guard.mx, guard.my);
        }

        if (u.uswallow) {
            /* can't interrogate hero, don't interrogate engulfer */
            if (!Deaf()) {
                   ;
                verbalize(_("What's going on here?"));
            }
            if (!spotted)
                pline_The(_("other presence vanishes."));
            mongone(guard);
            return;
        }
        if (U_AP_TYPE() == M_AP_OBJECT || u.uundetected) {
            if (U_AP_TYPE() == M_AP_OBJECT
                && gy.youmonst.mappearance != GOLD_PIECE)
                if (!Deaf()) {
                       ;
                    verbalize(_("Hey!  Who left that %s in here?"),
                              mimic_obj_name(gy.youmonst));
                }
            /* You're mimicking some object or you're hidden. */
            pline(_("Puzzled, %s turns around and leaves."), mhe(guard));
            mongone(guard);
            return;
        }
        if (Strangled() || is_silent(gy.youmonst.data) || gm.multi < 0) {
            /* [we ought to record whether this message has already
               been given in order to vary it upon repeat visits, but
               discarding the monster and its egd data renders that hard] */
            if (Deaf()) {
                pline(_("%s huffs and turns to leave."), noit_Monnam(guard));
            } else {
                   ;
                verbalize(_("I'll be back when you're ready to speak to me!"));
            }
            mongone(guard);
            return;
        }

        stop_occupation(); /* if occupied, stop it *now* */
        if (gm.multi > 0) {
            nomul(0);
            unmul(0);
        }
        chars[buf + 0] = ord('\0');
        trycount = 5;
        do {
            getlin(Deaf() ? _("You are required to supply your name. -")
                        : _("\"Hello stranger, who are you?\" -"), buf);
            mungspaces(buf);
        } while (!chars[buf + 0] && --trycount > 0);

        if (u.ualign.type == A_LAWFUL
            /* ignore trailing text, in case player includes rank */
            && strncmpi(buf, svp.plname, int(strlen(svp.plname))) != 0) {
            adjalign(-1); /* Liar! */
        }

        if (!strncmpi((buf), _(("Croesus")), -1) || !strncmpi((buf), _(("Kroisos")), -1)
            || !strncmpi((buf), _(("Creosote")), -1)) { /* Discworld */
            if (!svm.mvitals[PM_CROESUS].died) {
                if (Deaf()) {
                    if (!Blind())
                        pline(_("%s waves goodbye."), noit_Monnam(guard));
                } else {
                       ;
                    verbalize(
                         _("Oh, yes, of course.  Sorry to have disturbed you."));
                }
                mongone(guard);
            } else {
                setmangry(guard, FALSE);
                if (Deaf()) {
                   if (!Blind())
                        pline(_("%s mouths something and looks very angry!"),
                              noit_Monnam(guard));
                } else {
                      ;
                   verbalize(
                           _("Back from the dead, are you?  I'll remedy that!"));
                }
                /* don't want guard to waste next turn wielding a weapon */
                if (!MON_WEP(guard)) {
                    guard.weapon_check = NEED_HTH_WEAPON;
                    mon_wield_item(guard);
                }
            }
            return;
        }
        if (Deaf()) {
            pline(_("%s doesn't %srecognize you."), noit_Monnam(guard),
                    Blind() ? _("") : _("appear to "));
        } else {
               ;
            verbalize(_("I don't know you."));
        }
        umoney = money_cnt(gi.invent);
        if (!umoney && !hidden_gold(TRUE)) {
            if (Deaf()) {
                pline(_("%s stomps%s."), noit_Monnam(guard),
                      Blind() ? _("") : _(" and beckons"));
            } else {
                   ;
                verbalize(_("Please follow me."));
            }
        } else {
            if (!umoney) {
                if (Deaf()) {
                    if (!Blind())
                        pline(_("%s glares at you%s."), noit_Monnam(guard),
                              gi.invent ? _("r stuff") : _(""));
                } else {
                      ;
                   verbalize(_("You have hidden gold."));
                }
            }
            if (Deaf()) {
                if (!Blind())
                    pline(
                       _("%s holds out %s palm and beckons with %s other hand."),
                          noit_Monnam(guard), noit_mhis(guard),
                          noit_mhis(guard));
            } else {
                   ;
                verbalize(
                    _("Most likely all your gold was stolen from this vault."));
                   ;
                verbalize(_("Please drop that gold and follow me."));
            }
            EGD(guard).dropgoldcnt++;
        }
        EGD(guard).gdx = gdx;
        EGD(guard).gdy = gdy;
        EGD(guard).fcbeg = 0;
        EGD(guard).fakecorr[0].fx = x;
        EGD(guard).fakecorr[0].fy = y;
        typ = levl()[x][y].typ;
        if (!IS_WALL(typ)) {
            /* guard arriving at non-wall implies a door; vault wall was
               dug into an empty doorway (which could subsequently have
               been plugged with an intact door by use of locking magic) */
            let vlt = EGD(guard).vroom;
            let lowx = svr.rooms[vlt].lx, hix = svr.rooms[vlt].hx;
            let lowy = svr.rooms[vlt].ly, hiy = svr.rooms[vlt].hy;

            if (x == lowx - 1 && y == lowy - 1)
                typ = TLCORNER;
            else if (x == hix + 1 && y == lowy - 1)
                typ = TRCORNER;
            else if (x == lowx - 1 && y == hiy + 1)
                typ = BLCORNER;
            else if (x == hix + 1 && y == hiy + 1)
                typ = BRCORNER;
            else if (y == lowy - 1 || y == hiy + 1)
                typ = HWALL;
            else if (x == lowx - 1 || x == hix + 1)
                typ = VWALL;

            /* we lack access to the original wall_info bit mask for this
               former wall location so recreate it */
            levl()[x][y].typ = typ; /* wall; will be changed to door below */
            levl()[x][y].flags = 0; /* will be reset too via doormask */
            xy_set_wall_state(x, y); /* set WA_MASK bits in .wall_info */
        }
        EGD(guard).fakecorr[0].ftyp = typ;
        EGD(guard).fakecorr[0].flags = levl()[x][y].flags;
        /* guard's entry point where confrontation with hero takes place */
        spot_stop_timers(x, y, MELT_ICE_AWAY);
        levl()[x][y].typ = DOOR;
        levl()[x][y].flags = D_NODOOR;
        unblock_point(x, y); /* empty doorway doesn't block light */
        EGD(guard).fcend = 1;
        EGD(guard).warncnt = 1;
    }
    } finally { stack_pop($frame); }
}

function move_gold(gold, vroom) { /* void */
    let nx, ny;

    remove_object(gold);
    newsym(gold.ox, gold.oy);
    nx = svr.rooms[vroom].lx + rn2(2);
    ny = svr.rooms[vroom].ly + rn2(2);
    place_object(gold, nx, ny);
    stackobj(gold);
    newsym(nx, ny);
}

function wallify_vault(grd) { /* void */
    let typ;
    let x, y;
    let vlt = EGD(grd).vroom;
    let tmp_viz;
    let lox = svr.rooms[vlt].lx - 1, hix = svr.rooms[vlt].hx + 1,
          loy = svr.rooms[vlt].ly - 1, hiy = svr.rooms[vlt].hy + 1;
    let mon;
    let gold, rocks;
    let trap;
    let fixed = FALSE;
    let movedgold = FALSE;

    for (x = lox; x <= hix; x++)
        for (y = loy; y <= hiy; y++) {
            /* if not on the room boundary, skip ahead */
            if (x != lox && x != hix && y != loy && y != hiy)
                continue;

            if ((!IS_WALL(levl()[x][y].typ) || g_at(x, y)
                 || sobj_at(ROCK, x, y) || sobj_at(BOULDER, x, y))
                && !in_fcorridor(grd, x, y)) {
                if ((mon = m_at(x, y)) != null && mon != grd) {
                    if (mon.mtame)
                        yelp(mon);
                    if (!rloc(mon, RLOC_MSG))
                        m_into_limbo(mon);
                }
                /* move gold at wall locations into the vault */
                if ((gold = g_at(x, y)) != null) {
                    move_gold(gold, EGD(grd).vroom);
                    movedgold = TRUE;
                }
                /* destroy rocks and boulders (subsume them into the walls);
                   other objects present stay intact and become embedded */
                while ((rocks = sobj_at(ROCK, x, y)) != null) {
                    obj_extract_self(rocks);
                    obfree(rocks, null);
                }
                while ((rocks = sobj_at(BOULDER, x, y)) != null) {
                    obj_extract_self(rocks);
                    obfree(rocks, null);
                }
                if ((trap = t_at(x, y)) != null)
                    deltrap(trap);

                if (x == lox)
                    typ = (y == loy) ? TLCORNER
                          : (y == hiy) ? BLCORNER
                            : VWALL;
                else if (x == hix)
                    typ = (y == loy) ? TRCORNER
                          : (y == hiy) ? BRCORNER
                            : VWALL;
                else /* not left or right side, must be top or bottom */
                    typ = HWALL;

                levl()[x][y].typ = typ;
                levl()[x][y].flags = 0;
                xy_set_wall_state(x, y); /* set WA_MASK bits in .wall_info */
                del_engr_at(x, y);
                /*
                 * hack: player knows walls are restored because of the
                 * message, below, so show this on the screen.
                 */
                tmp_viz = char(uchars[gv.viz_array[y] + x]);
                uchars[gv.viz_array[y] + x] = IN_SIGHT | COULD_SEE;
                newsym(x, y);
                uchars[gv.viz_array[y] + x] = uchar(tmp_viz);
                block_point(x, y);
                fixed = TRUE;
            }
        }

    if (movedgold || fixed) {
        if (in_fcorridor(grd, grd.mx, grd.my) || cansee(grd.mx, grd.my))
            pline(_("%s whispers an incantation."), noit_Monnam(grd));
        else
            You_hear(_("a distant chant."));
        if (movedgold)
            pline(_("A mysterious force moves the gold into the vault."));
        if (fixed)
            pline_The(_("damaged vault's walls are magically restored!"));
    }
}

function gd_mv_monaway(grd, nx, ny) { /* void */
    let mtmp = m_at(nx, ny);

    if (mtmp && mtmp != grd) {
        if (!Deaf()) {
               ;
            verbalize(_("Out of my way, scum!"));
        }
        if (!rloc(mtmp, RLOC_ERR | RLOC_MSG) || MON_AT(nx, ny))
            m_into_limbo(mtmp);
        recalc_block_point(nx, ny);
    }
}

/* have guard pick gold off the floor, possibly moving to the gold's
   position before message and back to his current spot after */
function gd_pick_corridor_gold(grd, goldx, goldy) { /* void */
    const $frame = stack_frame(); try {
    let gold;
    let newcc = stack_struct(struct_nhcoord), bestcc = stack_struct(struct_nhcoord);
    let gdelta, newdelta, bestdelta, tryct,
        guardx = grd.mx, guardy = grd.my;
    let under_u = u_at(goldx, goldy),
            see_it = cansee(goldx, goldy);

    if (under_u) {
        /* Grab the gold from between the hero's feet.
           If guard is two or more steps away; bring him closer first. */
        gold = g_at(goldx, goldy);
        if (!gold) {
            impossible(_("vault guard: no gold at hero's feet?"));
            return;
        }
        gdelta = dist2(coordxy((guardx)), coordxy((guardy)), u.ux, u.uy);
        if (gdelta > 2 && see_it) { /* skip if player won't see it */
            bestdelta = gdelta;
            bestcc.x = coordxy(guardx), bestcc.y = coordxy(guardy);
            tryct = 9;
            do {
                /* pick an available spot nearest the hero and also try
                   to find the one meeting that criterium which is nearest
                   the guard's current location */
                if (enexto(newcc, goldx, goldy, grd.data)) {
                    if ((newdelta = distu(newcc.x, newcc.y)) < bestdelta
                        || (newdelta == bestdelta
                            && dist2(newcc.x, newcc.y, guardx, guardy)
                               < dist2(bestcc.x, bestcc.y, guardx, guardy))) {
                        bestdelta = newdelta;
                        struct_assign(bestcc, newcc);
                    }
                }
            } while (--tryct >= 0);

            if (bestdelta < gdelta) {
                remove_monster(guardx, guardy);
                newsym(guardx, guardy);
                place_monster(grd, bestcc.x, bestcc.y);
                newsym(grd.mx, grd.my);
            }
        }
        obj_extract_self(gold);
        add_to_minv(grd, gold);
        newsym(goldx, goldy);

    /* guard is already at gold's location */
    } else if (goldx == guardx && goldy == guardy) {
        mpickgold(grd); /* does a newsym */

    /* gold is at some third spot, neither guard's nor hero's */
    } else {
        /* just for insurance... */
        gd_mv_monaway(grd, goldx, goldy); /* make room for guard */
        if (see_it) { /* skip if player won't see the message */
            remove_monster(grd.mx, grd.my);
            newsym(grd.mx, grd.my);
            place_monster(grd, goldx, goldy); /* sets <grd->mx, grd->my> */
        }
        mpickgold(grd); /* does a newsym */
    }

    if (see_it) { /* cansee(goldx, goldy) */
        pline(_("%s%s picks up the gold%s."), Some_Monnam(grd),
              (grd.mpeaceful && EGD(grd).warncnt > 5)
                 ? _(" calms down and") : _(""),
              under_u ? _(" from beneath you") : _(""));
    }

    /* if guard was moved to get the gold, move him back */
    if (grd.mx != guardx || grd.my != guardy) {
        remove_monster(grd.mx, grd.my);
        newsym(grd.mx, grd.my);
        place_monster(grd, guardx, guardy);
        newsym(guardx, guardy);
    }
    return;
    } finally { stack_pop($frame); }
}

/* return 1: guard moved, -2: died  */
function gd_move_cleanup(
    grd,
    semi_dead,
    disappear_msg_seen) { /* int */
    let x, y;
    let see_guard;

    /*
     * The following is a kludge.  We need to keep the guard around in
     * order to be able to make the fake corridor disappear as the
     * player moves out of it, but we also need the guard out of the
     * way.  We send the guard to never-never land.  We set ogx ogy to
     * mx my in order to avoid a check at the top of this function.
     * At the end of the process, the guard is killed in restfakecorr().
     */
    x = grd.mx, y = grd.my;
    see_guard = canspotmon(grd);
    parkguard(grd); /* move to <0,0> */
    wallify_vault(grd);
    restfakecorr(grd);
    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("gd_move_cleanup: %scleanup%s"), grd.isgd ? _("") : _("final "), grd.isgd ? _(" attempt") : _("")); iflags.last_msg = save_plnmsg; } } while (0)

;
    if (!semi_dead && (in_fcorridor(grd, u.ux, u.uy) || cansee(x, y))) {
        if (!disappear_msg_seen && see_guard)
            pline(_("Suddenly, %s disappears."), noit_mon_nam(grd));
        return 1;
    }
    return -2;
}

function gd_letknow(grd) { /* void */
    if (!cansee(grd.mx, grd.my) || !mon_visible(grd))
        You_hear(_("%s."),
                    m_carrying(grd, TIN_WHISTLE)
                        ? _("the shrill sound of a guard's whistle")
                        : _("angry shouting"));
    else
        You(um_dist(grd.mx, grd.my, 2)
                ? _("see %s approaching.")
                : _("are confronted by %s."),
            /* "an angry guard" */
            x_monnam(grd, ARTICLE_A, _("angry"), 0, FALSE));
}

/*
 * return  1: guard moved,  0: guard didn't,  -1: let m_move do it,  -2: died
 */
export function gd_move(grd) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var buf = stack_array(char, BUFSZ);
    var x, y, nx, ny, m, n, ex, ey;
    var dx, dy, ggx = 0, ggy = 0, fci;
    var typ;
    var crm;
    var fcp;
    var egrd = EGD(grd);
    var umoney = 0;
    var goldincorridor = FALSE, u_in_vault = FALSE, grd_in_vault = FALSE,
            semi_dead = DEADMONSTER(grd),
            u_carry_gold = FALSE, newspot = FALSE;

    if (!on_level(egrd.gdlevel, u.uz))
        return -1;

    if (semi_dead || !grd.mx || egrd.gddone) {
        egrd.gddone = 1;
        return gd_move_cleanup(grd, semi_dead, FALSE);
    }
    do { if (showdebug(_(__FILE__))) { var save_plnmsg = iflags.last_msg; pline(_("gd_move: %s guard"), grd.mpeaceful ? _("peaceful") : _("hostile")); iflags.last_msg = save_plnmsg; } } while (0);

    u_in_vault = vault_occupied(u.urooms) ? TRUE : FALSE;
    grd_in_vault = chars[in_rooms(grd.mx, grd.my, VAULT)] ? TRUE : FALSE;
    if (!u_in_vault && !grd_in_vault)
        wallify_vault(grd);

    if (!grd.mpeaceful) {
        if (!u_in_vault
            && (grd_in_vault || (in_fcorridor(grd, grd.mx, grd.my)
                                 && !in_fcorridor(grd, u.ux, u.uy)))) {
            rloc(grd, RLOC_MSG);
            wallify_vault(grd);
            if (!in_fcorridor(grd, grd.mx, grd.my))
                clear_fcorr(grd, TRUE);
            gd_letknow(grd);
            return -1;
        }
        if (!in_fcorridor(grd, grd.mx, grd.my))
            clear_fcorr(grd, TRUE);
        return -1;
    }
    if (abs(egrd.ogx - grd.mx) > 1 || abs(egrd.ogy - grd.my) > 1)
        return -1; /* teleported guard - treat as monster */

    if (egrd.witness) {
        if (!Deaf()) {
               ;
            verbalize(_("How dare you %s that gold, scoundrel!"),
                      (egrd.witness & GD_EATGOLD) ? _("consume") : _("destroy"));
        }
        egrd.witness = 0;
        grd.mpeaceful = 0;
        return -1;
    }

    umoney = money_cnt(gi.invent);
    u_carry_gold = +(umoney > 0 || hidden_gold(TRUE) > 0);
    if (egrd.fcend == 1) {
        if (u_in_vault && (u_carry_gold || um_dist(grd.mx, grd.my, 1))) {
            if (egrd.warncnt == 3 && !Deaf()) {
                sprintf(buf, _("%sfollow me!"), u_carry_gold ? (!umoney ? _("drop that hidden gold and ")
                                                : _("drop that gold and "))
                                     : _(""))
;
                   ;
                if (egrd.dropgoldcnt || !u_carry_gold)
                    verbalize(_("I repeat, %s"), buf);
                else
                    verbalize(_("%s"), upstart(buf));
                if (u_carry_gold)
                    egrd.dropgoldcnt++;
            }
            if (egrd.warncnt == 7) {
                m = grd.mx;
                n = grd.my;
                if (!Deaf()) {
                       ;
                    verbalize(_("You've been warned, knave!"));
                }
                grd.mpeaceful = 0;
                mnexto(grd, RLOC_NOMSG);
                levl()[m][n].typ = egrd.fakecorr[0].ftyp;
                levl()[m][n].flags = egrd.fakecorr[0].flags;
                recalc_block_point(m, n);
                del_engr_at(m, n);
                newsym(m, n);
                return -1;
            }
            /* not fair to get mad when (s)he's fainted or paralyzed */
            if (!is_fainted() && gm.multi >= 0)
                egrd.warncnt++;
            return 0;
        }

        if (!u_in_vault) {
            if (u_carry_gold) { /* player teleported */
                m = grd.mx;
                n = grd.my;
                rloc(grd, RLOC_MSG);
                levl()[m][n].typ = egrd.fakecorr[0].ftyp;
                levl()[m][n].flags = egrd.fakecorr[0].flags;
                recalc_block_point(m, n); /* guard corridor goes away */
                del_engr_at(m, n);
                newsym(m, n);
                grd.mpeaceful = 0;
                gd_letknow(grd);
                return -1;
            } else {
                if (!Deaf()) {
                       ;
                    verbalize(_("Well, begone."));
                }
                egrd.gddone = 1;
                return gd_move_cleanup(grd, semi_dead, FALSE);
            }
        }
    }

    if (egrd.fcend > 1) {
        if (egrd.fcend > 2 && in_fcorridor(grd, grd.mx, grd.my)
            && !egrd.gddone && !in_fcorridor(grd, u.ux, u.uy)
            && (levl()[egrd.fakecorr[0].fx][egrd.fakecorr[0].fy].typ
                == egrd.fakecorr[0].ftyp)) {
            pline(_("%s, confused, disappears."), noit_Monnam(grd));
            return gd_move_cleanup(grd, semi_dead, TRUE);
        }
        if (u_carry_gold && (in_fcorridor(grd, u.ux, u.uy)
                             /* cover a 'blind' spot */
                             || (egrd.fcend > 1 && u_in_vault))) {
            if (!grd.mx) {
                restfakecorr(grd);
                return -2;
            }
            if (egrd.warncnt < 6) {
                egrd.warncnt = 6;
                if (Deaf()) {
                    if (!Blind())
                        pline(_("%s holds out %s palm demandingly!"),
                              noit_Monnam(grd), noit_mhis(grd));
                } else {
                       ;
                    verbalize(_("Drop all your gold, scoundrel!"));
                }
                return 0;
            } else {
                if (Deaf()) {
                    if (!Blind())
                        pline(_("%s rubs %s hands with enraged delight!"),
                              noit_Monnam(grd), noit_mhis(grd));
                } else {
                       ;
                    verbalize(_("So be it, rogue!"));
                }
                grd.mpeaceful = 0;
                return -1;
            }
        }
    }
    m = n = 0;
    for (fci = egrd.fcbeg; fci < egrd.fcend; fci++)
        if (g_at(egrd.fakecorr[fci].fx, egrd.fakecorr[fci].fy)) {
            m = egrd.fakecorr[fci].fx;
            n = egrd.fakecorr[fci].fy;
            goldincorridor = TRUE;
            break;
        }
    /* new gold can appear if it was embedded in stone and hero kicks it
       (on even via wish and drop) so don't assume hero has been warned */
    if (goldincorridor && !egrd.gddone) {
        gd_pick_corridor_gold(grd, m, n);
        if (!grd.mpeaceful)
            return -1;
        egrd.warncnt = 5;
        return 0;
    }
    if (um_dist(grd.mx, grd.my, 1) || egrd.gddone) {
        if (!egrd.gddone && !rn2(10) && !Deaf() && !u.uswallow
            && !(u.ustuck && !sticks(gy.youmonst.data))) {
               ;
            verbalize(_("Move along!"));
        }
        restfakecorr(grd);
        return 0; /* didn't move */
    }
    x = grd.mx;
    y = grd.my;

    $goto_nextpos: for (;;) { switch ($goto) { default: if (u_in_vault)
        { $goto = "nextpos"; continue $goto_nextpos; };

    /* look around (hor & vert only) for accessible places */
    for (nx = x - 1; nx <= x + 1; nx++)
        for (ny = y - 1; ny <= y + 1; ny++) {
            nextnxy: { if ((nx == x || ny == y) && (nx != x || ny != y)
                && isok(nx, ny)) {
                crm = levl()[nx][ny];
                typ = uchar(crm.typ);
                if (!IS_STWALL(typ) && !IS_POOL(typ)) {
                    if (in_fcorridor(grd, nx, ny))
                        break nextnxy;;

                    if (chars[in_rooms(nx, ny, VAULT)])
                        continue;

                    /* seems we found a good place to leave him alone */
                    egrd.gddone = 1;
                    if (ACCESSIBLE(typ))
                        { $goto = "newpos"; continue $goto_nextpos; };
                    crm.typ = (typ == SCORR) ? CORR : DOOR;
                    if (crm.typ == DOOR)
                        crm.flags = D_NODOOR;
                    else
                        crm.flags = 0;
                    del_engr_at(nx, ny);
                    { $goto = "proceed"; continue $goto_nextpos; }
                }
            }
 }
            ;
        }
 case "nextpos": $goto = null;
    nx = x;
    ny = y;
    ggx = egrd.gdx;
    ggy = egrd.gdy;
    dx = (ggx > x) ? 1 : (ggx < x) ? -1 : 0;
    dy = (ggy > y) ? 1 : (ggy < y) ? -1 : 0;
    if (abs(ggx - x) >= abs(ggy - y))
        nx += dx;
    else
        ny += dy;

    while ((typ = uchar((crm = levl()[nx][ny]).typ)) != STONE) {
        ex = nx + nx - x;
        ey = ny + ny - y;
        /* in view of the above we must have IS_WALL(typ) or typ == POOL */
        /* must be a wall here */
        if (isok(ex, ey) && IS_ROOM(levl()[ex][ey].typ)) {
            crm.typ = DOOR;
            crm.flags = D_NODOOR;
            del_engr_at(ex, ey);
            { $goto = "proceed"; continue $goto_nextpos; }
        }
        if (dy && nx != x) {
            nx = x;
            ny = y + dy;
            continue;
        }
        if (dx && ny != y) {
            ny = y;
            nx = x + dx;
            dy = 0;
            continue;
        }
        /* I don't like this, but ... */
        if (IS_ROOM(typ)) {
            crm.typ = DOOR;
            crm.flags = D_NODOOR;
            del_engr_at(ex, ey);
            { $goto = "proceed"; continue $goto_nextpos; }
        }
        break;
    }
    crm.typ = CORR;
    crm.flags = 0;
 case "proceed": $goto = null;
    newspot = TRUE;
    unblock_point(nx, ny); /* doesn't block light */
    if (cansee(nx, ny))
        newsym(nx, ny);

    if ((nx != ggx || ny != ggy) || (grd.mx != ggx || grd.my != ggy)) {
        fcp = (egrd.fakecorr[egrd.fcend]);
        /* fakecorr overflow does not occur because egrd->fakecorr[]
           is too small, but it has occurred when the same <x,y> are
           put into it repeatedly for some as yet unexplained reason */
        if (egrd.fcend++ == FCSIZ)
            panic(_("fakecorr overflow"));
        fcp.fx = nx;
        fcp.fy = ny;
        fcp.ftyp = schar(typ);
        fcp.flags = crm.flags;
    } else if (!egrd.gddone) {
        /* We're stuck, so try to find a new destination. */
        if (!find_guard_dest(grd, ref_of(egrd, "gdx"), ref_of(egrd, "gdy"))
            || (egrd.gdx == ggx && egrd.gdy == ggy)) {
            pline(_("%s, confused, disappears."), Monnam(grd));
            return gd_move_cleanup(grd, semi_dead, TRUE);
        } else
            { $goto = "nextpos"; continue $goto_nextpos; };
    }
 case "newpos": $goto = null;
    gd_mv_monaway(grd, nx, ny); } break; }
    if (egrd.gddone)
        return gd_move_cleanup(grd, semi_dead, FALSE);
    egrd.ogx = grd.mx; /* update old positions */
    egrd.ogy = grd.my;
    remove_monster(grd.mx, grd.my);
    place_monster(grd, nx, ny);
    if (newspot && g_at(nx, ny)) {
        /* if there's gold already here (most likely from mineralize()),
           pick it up now so that guard doesn't later think hero dropped
           it and give an inappropriate message */
        mpickgold(grd);
        if (canspotmon(grd))
            pline(_("%s picks up some gold."), Monnam(grd));
    } else
        newsym(grd.mx, grd.my);
    restfakecorr(grd);
    return 1;
    } finally { stack_pop($frame); }
}

/* Routine when dying or quitting with a vault guard around */
export function paygd(silently) { /* void */
    const $frame = stack_frame(); try {
    var grd = findgd();
    var umoney = money_cnt(gi.invent);
    var coins, nextcoins;
    var gdx, gdy;
    var buf = stack_array(char, BUFSZ);

    if (!umoney || !grd)
        return;

    remove_guard: { if (u.uinvault) {
        if (!silently)
            Your(_("%lld %s goes into the Magic Memory Vault."),
                 umoney, currency(umoney));
        gdx = u.ux;
        gdy = u.uy;
    } else {
        if (grd.mpeaceful) /* peaceful guard has no "right" to your gold */
            break remove_guard;;

        mnexto(grd, RLOC_NOMSG);
        if (!silently)
            pline(_("%s remits your gold to the vault."), Monnam(grd));
        gdx = svr.rooms[EGD(grd).vroom].lx + rn2(2);
        gdy = svr.rooms[EGD(grd).vroom].ly + rn2(2);
        sprintf(buf, _("To Croesus: here's the gold recovered from %s the %s."), svp.plname, pmname(mons[u.umonster], flags.female ? FEMALE : MALE))

;
        make_grave(gdx, gdy, buf);
    }
    for (coins = gi.invent; coins; coins = nextcoins) {
        nextcoins = coins.nobj;
        if (objects[coins.otyp].oc_class == COIN_CLASS) {
            freeinv(coins);
            place_object(coins, gdx, gdy);
            stackobj(coins);
        }
    }
 }
    mongone(grd);
    return;
    } finally { stack_pop($frame); }
}

/*
 * amount of gold in carried containers
 *
 * even_if_unknown:
 *   True:  all gold
 *   False: limit to known contents
 */
export function hidden_gold(even_if_unknown) { /* long long */
    let value = 0;
    let obj;

    for (obj = gi.invent; obj; obj = obj.nobj)
        if (Has_contents(obj) && (obj.cknown || even_if_unknown))
            value += contained_gold(obj, even_if_unknown);
    /* unknown gold stuck inside statues may cause some consternation... */

    return value;
}

/* prevent "You hear footsteps.." when inappropriate */
export function gd_sound() { /* boolean */
    return +!(vault_occupied(u.urooms) || findgd());
}

export function vault_gd_watching(activity) { /* void */
    let guard = findgd();

    if (guard && guard.mx && guard.mcansee && m_canseeu(guard)) {
        if (activity == GD_EATGOLD || activity == GD_DESTROYGOLD)
            EGD(guard).witness = activity;
    }
}

/*vault.c*/

import { A_LAWFUL } from "./align.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { COIN_CLASS } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { BUFSZ, COLNO, FALSE, ROWNO, TRUE, coordxy } from "./global.h.js";
import {
    ARTICLE_A, MM_EGD, MM_NOMSG, RLOC_ERR, RLOC_MSG, RLOC_NOMSG, VAULT_GUARD_TIME,
} from "./hack.h.js";
import { distu } from "./hack.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import { FCSIZ, GD_DESTROYGOLD, GD_EATGOLD, struct_egd } from "./mextra.h.js";
import { EGD } from "./mextra.h.macros.js";
import { ROOMOFFSET, VAULT } from "./mkroom.h.js";
import { is_silent } from "./mondata.h.macros.js";
import { FEMALE, MALE } from "./monflag.h.js";
import { M_AP_OBJECT, NEED_HTH_WEAPON } from "./monst.h.js";
import { DEADMONSTER, MON_WEP, U_AP_TYPE } from "./monst.h.macros.js";
import { PM_CROESUS, PM_GUARD } from "./monsters.h.js";
import { Has_contents, carried } from "./obj.h.macros.js";
import { BOULDER, GOLD_PIECE, ROCK, TIN_WHISTLE } from "./objects.h.js";
import {
    BLCORNER, BRCORNER, CORR, DOOR, D_NODOOR, HWALL, ROOM, SCORR, STONE, TLCORNER, TRCORNER, VWALL,
} from "./rm.h.js";
import {
    ACCESSIBLE, IS_OBSTRUCTED, IS_POOL, IS_ROOM, IS_STWALL, IS_WALL, MON_AT, fmon, levl, m_at,
    remove_monster,
} from "./rm.h.macros.js";
import { MELT_ICE_AWAY } from "./timeout.h.js";
import { COULD_SEE, IN_SIGHT } from "./vision.h.js";
import { cansee, couldsee, m_canseeu } from "./vision.h.macros.js";
import { Upolyd, mhe, noit_mhis, u_at } from "./you.h.macros.js";
import { Blind, Deaf, Punished, Strangled } from "./youprop.h.macros.js";
import { char, int, ord, schar, sizeof, uchar } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { abs, free, memset, sprintf, strlen } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, elt, ref_of, struct_assign, view_of } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc } from "./alloc.js";
import { um_dist } from "./apply.js";
import { adjalign } from "./attrib.js";
import { isok } from "./cmd.js";
import {
    flags, gi, gm, gv, gy, iflags, program_state, svc, svl, svm, svp, svr, u,
} from "./decl.js";
import {
    map_invisible, map_location, mon_visible, newsym, unset_seenv, xy_set_wall_state,
} from "./display.js";
import {
    Mgender, Monnam, Some_Monnam, noit_Monnam, noit_mon_nam, pmname, x_monnam,
} from "./do_name.js";
import { assign_level, on_level } from "./dungeon.js";
import { is_fainted, reset_faint } from "./eat.js";
import { panic } from "./end.js";
import { del_engr_at, make_grave } from "./engrave.js";
import { in_rooms, money_cnt, nomul, unmul } from "./hack.js";
import { dist2, mungspaces, strncmpi, upstart } from "./hacklib.js";
import { currency, freeinv, g_at, sobj_at, stackobj } from "./invent.js";
import { makemon, newmextra, set_malign } from "./makemon.js";
import { add_to_minv, obj_extract_self, place_object, remove_object } from "./mkobj.js";
import { m_into_limbo, mnexto, mongone, mpickgold, setmangry } from "./mon.js";
import { sticks } from "./mondata.js";
import { mon_track_clear } from "./monmove.js";
import { mons } from "./monst.js";
import { m_carrying } from "./mthrowu.js";
import { objects } from "./objects.js";
import { an, makeplural, mimic_obj_name, simpleonames } from "./objnam.js";
import { You, You_hear, You_see, Your, impossible, pline, pline_The, verbalize } from "./pline.js";
import { rn2 } from "./rnd.js";
import { contained_gold, obfree } from "./shk.js";
import { yelp } from "./sounds.js";
import { relobj } from "./steal.js";
import { place_monster } from "./steed.js";
import { enexto, rloc, tele } from "./teleport.js";
import { spot_stop_timers } from "./timeout.js";
import { deltrap, t_at } from "./trap.js";
import { block_point, recalc_block_point, unblock_point } from "./vision.js";
import { mon_wield_item } from "./weapon.js";
import { getlin } from "./windows.js";
import { fracture_rock } from "./zap.js";
const __FILE__ = "vault.c";
