/* NetHack 5.0	trap.c	$NHDT-Date: 1741926700 2025/03/13 20:31:40 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.621 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2013. */
/* NetHack may be freely redistributed.  See license for details. */

 /* from zap.c */

const a_your = static_array("a_your", ptr_to(char), 2, [ _("a"), _("your") ]);
const A_Your = static_array("A_Your", ptr_to(char), 2, [ _("A"), _("Your") ]);
const tower_of_flame = init_string(static_array("tower_of_flame", char, sizeof_string("tower of flame")), _("tower of flame"), true);
const A_gush_of_water_hits = static_var("A_gush_of_water_hits", ptr_to(char), _("A gush of water hits"));
const blindgas = static_array("blindgas", ptr_to(char), 6, [ _("humid"),   _("odorless"),
                                         _("pungent"), _("chilling"),
                                         _("acrid"),   _("biting") ]);

/* called when you're hit by fire (dofiretrap,buzz,zapyourself,explode);
   returns TRUE if hit on torso */
export function burnarmor(victim) { /* boolean */
    const $frame = stack_frame(); try {
    let item;
    let buf = stack_array(char, BUFSZ);
    let mat_idx, oldspe;
    let hitting_u;

    if (!victim)
        return 0;
    hitting_u = +(victim == gy.youmonst);

    /* burning damage may dry wet towel */
    item = hitting_u ? carrying(TOWEL) : m_carrying(victim, TOWEL);
    while (item) {
        if (is_wet_towel(item)) { /* True => (item->spe > 0) */
            oldspe = item.spe;
            dry_a_towel(item, rn2(oldspe + 1), TRUE);
            if (item.spe != oldspe)
                break; /* stop once one towel has been affected */
        }
        item = item.nobj;
    }

    while (1) {
        switch (rn2(5)) {
        case 0:
            item = hitting_u ? uarmh : which_armor(victim, W_ARMH);
            if (item) {
                mat_idx = objects[item.otyp].oc_material;
                sprintf(buf, _("%s %s"), materialnm[mat_idx], helm_simple_name(item))
;
            }
            if (!burn_dmg(item, item ? buf : _("helmet")))
                continue;
            break;
        case 1:
            item = hitting_u ? uarmc : which_armor(victim, W_ARMC);
            if (item) {
                burn_dmg(item, cloak_simple_name(item));
                return TRUE;
            }
            item = hitting_u ? uarm : which_armor(victim, W_ARM);
            if (item) {
                erode_obj(item, xname(item), ERODE_BURN, EF_GREASE);
                return TRUE;
            }
            item = hitting_u ? uarmu : which_armor(victim, W_ARMU);
            if (item)
                burn_dmg(item, _("shirt"));
            return TRUE;
        case 2:
            item = hitting_u ? uarms : which_armor(victim, W_ARMS);
            if (!burn_dmg(item, _("wooden shield")))
                continue;
            break;
        case 3:
            item = hitting_u ? uarmg : which_armor(victim, W_ARMG);
            if (!burn_dmg(item, _("gloves")))
                continue;
            break;
        case 4:
            item = hitting_u ? uarmf : which_armor(victim, W_ARMF);
            if (!burn_dmg(item, _("boots")))
                continue;
            break;
        }
        break; /* Out of while loop */
    }

    return FALSE;
    } finally { stack_pop($frame); }
}
export function burn_dmg(obj, descr) { return erode_obj(obj, descr, ERODE_BURN, EF_GREASE); }

/* Generic erode-item function.
 * "ostr", if non-null, is an alternate string to print instead of the
 *   object's name.
 * "type" is an ERODE_* value for the erosion type
 * "flags" is an or-ed list of EF_* flags
 *
 * Returns an erosion return value (ER_*)
 */
export function erode_obj(
    otmp,
    ostr,
    type,
    ef_flags) { /* int */
    const $frame = stack_frame(); try {
    let action = static_array("erode_obj.action", ptr_to(char), null, [ _("smoulder"), _("rust"), _("rot"), _("corrode"), _("crack") ]),
        msg = static_array("erode_obj.msg", ptr_to(char), null, [ _("burnt"), _("rusted"), _("rotten"), _("corroded"), _("cracked") ]),
        bythe = static_array("erode_obj.bythe", ptr_to(char), null, [ _("heat"), _("oxidation"), _("decay"), _("corrosion"),
                           _("impact") ]);
 /* this could use improvement... */
    let vulnerable = FALSE, is_primary = TRUE,
            check_grease = (ef_flags & EF_GREASE) ? TRUE : FALSE,
            print = (ef_flags & EF_VERBOSE) ? TRUE : FALSE,
            crackers = FALSE,
            uvictim, vismon, visobj;
    let erosion, cost_type;
    let victim;

    if (!otmp)
        return ER_NOTHING;

    victim = carried(otmp) ? gy.youmonst
             : mcarried(otmp) ? otmp.v.v_ocarry
               : null;
    uvictim = +(victim == gy.youmonst);
    vismon = (victim && (victim != gy.youmonst) && canseemon(victim) ? 1 : 0);
    /* Is gb.bhitpos correct here? Ugh. */
    visobj = (!victim && cansee(gb.bhitpos.x, gb.bhitpos.y)
              && (!is_pool(gb.bhitpos.x, gb.bhitpos.y)
                  || (next2u(gb.bhitpos.x,gb.bhitpos.y) && Underwater())) ? 1 : 0);

    switch (type) {
    case ERODE_BURN:
        if (uvictim && inventory_resistance_check(AD_FIRE))
            return ER_NOTHING;
        vulnerable = is_flammable(otmp);
        check_grease = FALSE;
        cost_type = COST_BURN;
        break;
    case ERODE_RUST:
        vulnerable = is_rustprone(otmp);
        cost_type = COST_RUST;
        break;
    case ERODE_ROT:
        vulnerable = is_rottable(otmp);
        check_grease = FALSE;
        is_primary = FALSE;
        cost_type = COST_ROT;
        break;
    case ERODE_CORRODE:
        if (uvictim && inventory_resistance_check(AD_ACID))
            return ER_NOTHING;
        vulnerable = is_corrodeable(otmp);
        is_primary = FALSE;
        cost_type = COST_CORRODE;
        break;
    case ERODE_CRACK: /* crystal armor */
        vulnerable = is_crackable(otmp);
        is_primary = TRUE;
        crackers = TRUE;
        cost_type = COST_CRACK;
        break;
    default:
        impossible(_("Invalid erosion type in erode_obj"));
        return ER_NOTHING;
    }
    erosion = is_primary ? otmp.oeroded : otmp.oeroded2;

    if (!ostr)
        ostr = cxname(otmp);
    /* 'visobj' messages insert "the"; probably ought to switch to the() */
    if (visobj && !(uvictim || vismon) && !strncmpi(ostr, _("the "), 4))
        ostr += 4;

    if (check_grease && otmp.greased) {
        grease_protect(otmp, ostr, victim);
        return ER_GREASED;
    } else if (!erosion_matters(otmp)) {
        return ER_NOTHING;
    } else if (!vulnerable || (otmp.oerodeproof && otmp.rknown)) {
        if (flags.verbose && print && (uvictim || vismon))
            pline(_("%s %s %s not affected by %s."),
                  uvictim ? _("Your") : s_suffix(Monnam(victim)),
                  ostr, vtense(ostr, _("are")), bythe[type]);
        return ER_NOTHING;
    } else if (otmp.oerodeproof || (otmp.blessed && !rnl(4))) {
        if (flags.verbose && (print || otmp.oerodeproof)
            && (uvictim || vismon || visobj))
            pline(_("Somehow, %s %s %s not affected by the %s."),
                  uvictim ? _("your")
                  : !vismon ? _("the") /* visobj */
                    : s_suffix(mon_nam(victim)),
                  ostr, vtense(ostr, _("are")), bythe[type]);
        /* We assume here that if the object is protected because it
         * is blessed, it still shows some minor signs of wear, and
         * the hero can distinguish this from an object that is
         * actually proof against damage.
         */
        if (otmp.oerodeproof) {
            otmp.rknown = TRUE;
            if (victim == gy.youmonst)
                update_inventory();
        }

        return ER_NOTHING;
    } else if (erosion < MAX_ERODE) {
        let adverb = (erosion + 1 == MAX_ERODE) ? _(" completely")
                             : erosion ? _(" further")
                               : _("");

        if (uvictim || vismon || visobj)
            pline(_("%s %s %s%s!"),
                  uvictim ? _("Your")
                  : !vismon ? _("The") /* visobj */
                    : s_suffix(Monnam(victim)),
                  ostr, vtense(ostr, action[type]), adverb);

        if (ef_flags & EF_PAY)
            costly_alteration(otmp, cost_type);

        if (is_primary)
            otmp.oeroded++;
        else
            otmp.oeroded2++;

        if (victim == gy.youmonst)
            update_inventory();

        return ER_DAMAGED;
    } else if (ef_flags & EF_DESTROY) {
        otmp.in_use = 1; /* in case of hangup during message w/ --More-- */
        if (uvictim || vismon || visobj) {
            let actbuf = stack_array(char, BUFSZ);

            if (!crackers)
                sprintf(actbuf, _("%s away"), vtense(ostr, action[type]));
            else
                sprintf(actbuf, _("shatters"));
            pline(_("%s %s %s!"),
                  uvictim ? _("Your")
                  : !vismon ? _("The") /* visobj */
                    : s_suffix(Monnam(victim)),
                  ostr, actbuf);
        }
        if (ef_flags & EF_PAY)
            costly_alteration(otmp, cost_type);

        if (otmp.owornmask) {
            /* unwear otmp before deleting it */
            if (carried(otmp)) {
                /* otmp remains in hero's invent; if we get here because
                   it is being burned up by lava, we don't need to worry
                   about unwearing levitation boots and having that
                   trigger float_down to then fall in again; if such
                   were being worn, they wouldn't be in the lava now */
                remove_worn_item(otmp, TRUE); /* calls Cloak_off(),&c */
            } else if (mcarried(otmp)) {
                /* results in otmp->where==OBJ_FREE; delobj() doesn't care */
                extract_from_minvent(otmp.v.v_ocarry, otmp, TRUE, FALSE);
            } else { /* worn but not in hero invent or monster minvent ? */
                impossible(
            _("erode_obj(%d): destroying strangely worn item [%d, 0x%08llx: %s]"),
                           type,
                           otmp.where, otmp.owornmask, simpleonames(otmp));
                otmp.owornmask = 0; /* otherwise a second complaint (about
                                       * deleting a worn item) will ensue */
            }
        }
        delobj(otmp);
        return ER_DESTROYED;
    } else {
        if (flags.verbose && print) {
            if (uvictim)
                Your(_("%s %s completely %s."),
                     ostr, vtense(ostr, Blind() ? _("feel") : _("look")), msg[type]);
            else if (vismon || visobj)
                pline(_("%s %s %s completely %s."),
                      !vismon ? _("The") : s_suffix(Monnam(victim)),
                      ostr, vtense(ostr, _("look")), msg[type]);
        }
        return ER_NOTHING;
    }
    } finally { stack_pop($frame); }
}

/* Protect an item from erosion with grease. Returns TRUE if the grease
 * wears off.
 */
export function grease_protect(
    otmp,
    ostr,
    victim) { /* boolean */
    let txt = init_string(static_array("grease_protect.txt", char, sizeof_string("protected by the layer of grease!")), _("protected by the layer of grease!"), true);
    let vismon = (victim && (victim != gy.youmonst) && canseemon(victim) ? 1 : 0);

    if (ostr) {
        if (victim == gy.youmonst)
            Your(_("%s %s %s"), ostr, vtense(ostr, _("are")), txt);
        else if (vismon)
            pline(_("%s's %s %s %s"), Monnam(victim),
                  ostr, vtense(ostr, _("are")), txt);
    } else if (victim == gy.youmonst || vismon) {
        pline(_("%s %s"), Yobjnam2(otmp, _("are")), txt);
    }
    if (!rn2(2)) {
        otmp.greased = 0;
        if (carried(otmp)) {
            pline_The(_("grease dissolves."));
            update_inventory();
        }
        return TRUE;
    }
    return FALSE;
}

/* create a "living" statue at x,y */
function mk_trap_statue(x, y) { /* void */
    let mtmp;
    let otmp, statue;
    let mptr;
    let trycount = 10;

    do { /* avoid ultimately hostile co-aligned unicorn */
        mptr = mons[rndmonnum_adj(3, 6)];
    } while (--trycount > 0 && is_unicorn(mptr)
             && sgn(u.ualign.type) == sgn(mptr.maligntyp));
    statue = mkcorpstat(STATUE, null, mptr, x, y,
                        CORPSTAT_NONE);
    mtmp = makemon(mons[statue.corpsenm], 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG);
    if (!mtmp)
        return; /* should never happen */
    while (mtmp.minvent) {
        otmp = mtmp.minvent;
        otmp.owornmask = 0;
        obj_extract_self(otmp);
        add_to_container(statue, otmp);
    }
    statue.owt = unsigned(weight(statue));
    mongone(mtmp);
}

/* find "bottom" level of specified dungeon, stopping at quest locate */
function dng_bottom(lev) { /* int */
    let bottom = dunlevs_in_dungeon(lev);

    /* when in the upper half of the quest, don't fall past the
       middle "quest locate" level if hero hasn't been there yet */
    if (In_quest(lev)) {
        let qlocate_depth = qlocate_level().dlevel;

        /* deepest reached < qlocate implies current < qlocate */
        if ((elt(svd.dungeons, (lev).dnum).dunlev_ureached) < qlocate_depth)
            bottom = qlocate_depth; /* early cut-off */
    } else if (In_hell(lev)) {
        /* if the invocation hasn't been performed yet, the vibrating square
           level is effectively the bottom of Gehennom; the sanctum level is
           out of reach until after the invocation */
        if (!u.uevent.invoked)
            bottom -= 1;
    }
    return bottom;
}

/* destination dlevel for holes or trapdoors */
function hole_destination(dst) { /* void */
    let bottom = dng_bottom(u.uz);

    dst.dnum = u.uz.dnum;
    dst.dlevel = dunlev(u.uz);
    while (dst.dlevel < bottom) {
        dst.dlevel++;
        if (rn2(4))
            break;
    }
}

export function maketrap(x, y, typ) { /* struct trap * */
    let zero_vl = static_struct("maketrap.zero_vl", struct_vlaunchinfo);
    let oldplace, was_ice, clear_flags;
    let ttmp;
    let lev = levl()[x][y];

    if (typ == TRAPPED_DOOR || typ == TRAPPED_CHEST)
        return null;

    if ((ttmp = t_at(x, y)) != null) {
        if (undestroyable_trap(ttmp.ttyp))
            return null;
        oldplace = TRUE;
        if (u.utrap && u_at(x, y)
            && ((u.utraptype == TT_BEARTRAP && typ != BEAR_TRAP)
                || (u.utraptype == TT_WEB && typ != WEB)
                || (u.utraptype == TT_PIT && !is_pit(typ))
                || (u.utraptype == TT_LAVA && !is_lava(x, y))))
            reset_utrap(FALSE);
        /* old <tx,ty> remain valid */
    } else if (!(iflags.debug_overwrite_stairs || !(((lev.typ) == LADDER) || ((lev.typ) == STAIRS))) /* stairs */
               || is_pool_or_lava(x, y)
               || (IS_FURNITURE(lev.typ) && (typ != PIT && typ != HOLE))
               || (lev.typ == DRAWBRIDGE_UP && typ == MAGIC_PORTAL)
               || (IS_AIR(lev.typ) && typ != MAGIC_PORTAL)
               || (typ == LEVEL_TELEP && single_level_branch(u.uz))) {
        /* no trap on top of furniture (caller usually screens the
           location to inhibit this, but wizard mode wishing doesn't)
           and no level teleporter in branch with only one level */
        return null;
    } else {
        oldplace = FALSE;
        ttmp = newtrap();
        memset(addr_of(ttmp), 0, sizeof(struct_trap));
        ttmp.ntrap = null;
        ttmp.tx = x;
        ttmp.ty = y;
    }
    /* [re-]initialize all fields except ntrap (handled below) and <tx,ty> */
    struct_assign(ttmp.vl, zero_vl);
    ttmp.launch.x = ttmp.launch.y = -1; /* force error if used before set */
    ttmp.dst.dnum = ttmp.dst.dlevel = -1;
    ttmp.madeby_u = 0;
    ttmp.once = 0;
    ttmp.tseen = unhideable_trap(typ);
    ttmp.ttyp = unsigned(typ);

    switch (typ) {
    case SQKY_BOARD:
        ttmp.vl.v_tnote = choose_trapnote(ttmp);
        break;
    case STATUE_TRAP: /* create a "living" statue */
        mk_trap_statue(x, y);
        break;
    case ROLLING_BOULDER_TRAP: /* boulder will roll towards trigger */
        mkroll_launch(ttmp, x, y, BOULDER, 1);
        break;
    case PIT:
    case SPIKED_PIT:
        ttmp.vl.v_conjoined = 0;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case HOLE:
    case TRAPDOOR:
        if (is_hole(typ))
            hole_destination(ttmp.dst);
        if (chars[in_rooms(x, y, SHOPBASE)]
            && (is_hole(typ) || IS_DOOR(lev.typ) || IS_WALL(lev.typ)))
            add_damage(x, y, /* schedule repair */
                       ((IS_DOOR(lev.typ) || IS_WALL(lev.typ))
                        && !svc.context.mon_moving) ? SHOP_HOLE_COST : 0);

        clear_flags = TRUE; /* assume lev->flags needs to be reset */
        /* DRAWBRIDGE_UP passes the IS_ROOM() test so check it first;
           it also needs to retain lev->drawbridgemask */
        if (lev.typ == DRAWBRIDGE_UP) {
            /* bridge is closed and we're putting a hole or pit at the span
               spot; this trap will be deleted if/when the bridge is opened;
               terrain becomes room floor even if it was moat, lava, or ice */
            clear_flags = FALSE; /* keep lev->drawbridgemask */
            was_ice = +((lev.flags & DB_UNDER) == DB_ICE);
            lev.flags &= ~DB_UNDER;
            lev.flags |= DB_FLOOR;
            if (was_ice) {
                /* subset of set_levltyp() after changing ice to floor;
                   frozen corpses resume rotting, no more ice to melt away */
                obj_ice_effects(x, y, TRUE);
                spot_stop_timers(x, y, MELT_ICE_AWAY);
            }
        } else if (IS_ROOM(lev.typ)) {
            set_levltyp(x, y, ROOM);

        /*
         * some cases which can happen when digging
         * down while phasing thru solid areas
         */
        } else if (lev.typ == STONE || lev.typ == SCORR) {
            set_levltyp(x, y, CORR);
        } else if (IS_WALL(lev.typ) || lev.typ == SDOOR) {
            set_levltyp(x, y, svl.level.flags.is_maze_lev ? ROOM
                                     : svl.level.flags.is_cavernous_lev ? CORR
                                       : DOOR);
        }
        if (clear_flags)
            lev.flags = 0; /* set_levltyp doesn't take care of this [yet?] */

        unearth_objs(x, y);
        recalc_block_point(x, y);
        break;
    case TELEP_TRAP:
        if (isok(gl.launchplace.x, gl.launchplace.y)) {
            ttmp.launch.x = gx.xstart + gl.launchplace.x;
            ttmp.launch.y = gy.ystart + gl.launchplace.y;
            if (ttmp.launch.x == x && ttmp.launch.y == y) {
                impossible(_("making fixed-dest tele trap pointing to itself"));
            }
        }
        break;
    }

    if (!oldplace) {
        ttmp.ntrap = gf.ftrap;
        gf.ftrap = ttmp;
    } else {
        /* oldplace;
           it shouldn't be possible to override a sokoban pit or hole
           with some other trap, but we'll check just to be safe */
        if (Sokoban())
            maybe_finish_sokoban();
    }
    return ttmp;
}

/* limit the destination of a hole or trapdoor to the furthest level you
   should be able to fall to */
export function clamp_hole_destination(dlev) { /* d_level * */
    let bottom = dng_bottom(dlev);

    dlev.dlevel = min(dlev.dlevel, bottom);
    return dlev;
}

export function fall_through(
    td,
    ftflags) { /* void */
    const $frame = stack_frame(); try {
    let dtmp = stack_struct(struct_d_level);
    let msgbuf = stack_array(char, BUFSZ);
    let dont_fall = 0;
    let newlevel;
    let t = null;
    let controlled_flight = FALSE;

    /* we'll fall even while levitating in Sokoban; otherwise, if we
       won't fall and won't be told that we aren't falling, give up now */
    if (Blind() && Levitation() && !Sokoban())
        return;

    newlevel = dunlev(u.uz); /* current level */
    newlevel++;

    if (td) {
        t = t_at(u.ux, u.uy);
        feeltrap(t);
        if (!Sokoban() && !(ftflags & TOOKPLUNGE)) {
            if (t.ttyp == TRAPDOOR)
                pline(_("A trap door opens up under you!"));
            else
                pline(_("There's a gaping hole under you!"));
        }
    } else
        pline_The(_("%s opens up under you!"), surface(u.ux, u.uy));

    if (Sokoban() && Can_fall_thru(u.uz)) {
        ; /* KMH -- You can't escape the Sokoban level traps */
    } else if (Levitation() || u.ustuck
             || (!Can_fall_thru(u.uz) && !levl()[u.ux][u.uy].candig)
             || ((Flying() || is_clinger(gy.youmonst.data)
                  || (ceiling_hider(gy.youmonst.data) && u.uundetected))
                 && !(ftflags & TOOKPLUNGE))) {
        dont_fall = _("don't fall in.");
    } else if (gy.youmonst.data.msize >= MZ_HUGE) {
        dont_fall = _("don't fit through.");
    } else if (!next_to_u()) {
        dont_fall = _("are jerked back by your pet!");
    }
    if (dont_fall) {
        You1(dont_fall);
        /* hero didn't fall through, but any objects here might */
        impact_drop(null, u.ux, u.uy, 0);
        if (!td) {
            display_nhwindow()(WIN_MESSAGE, FALSE);
            pline_The(_("opening under you closes up."));
        }
        return;
    }
    if ((Flying() || is_clinger(gy.youmonst.data))
        && (ftflags & TOOKPLUNGE) && td && t) {
        if (Flying())
            controlled_flight = TRUE;
        You(_("%s down %s!"),
            Flying() ? _("swoop") : _("deliberately drop"),
            (t.ttyp == TRAPDOOR)
                ? _("through the trap door")
                : _("into the gaping hole"));
    }

    if (chars[u.ushops])
        shopdig(1);
    if (Is_stronghold(u.uz)) {
        find_hell(dtmp);
    } else {
        let dist;

        if (t) {
            assign_level(dtmp, t.dst);
            /* don't fall beyond the bottom, in case this came from a bones
               file with different dungeon size  */
            clamp_hole_destination(dtmp);
        } else {
            dtmp.dnum = u.uz.dnum;
            dtmp.dlevel = newlevel;
        }
        dist = depth(dtmp) - depth(u.uz);
        if (dist > 1)
            You(_("%s down a %s%sshaft!"),
                controlled_flight ? _("fly") : _("fall"),
                dist > 3 ? _("very ") : _(""),
                dist > 2 ? _("deep ") : _(""));
    }
    if (!td)
        sprintf(msgbuf, _("The hole in the %s above you closes up."), ceiling(u.ux, u.uy))
;

    schedule_goto(dtmp, !Flying() ? UTOTYPE_FALLING : UTOTYPE_NONE, 0,
                  !td ? msgbuf : 0);
    } finally { stack_pop($frame); }
}

/*
 * Animate the given statue.  May have been via shatter attempt, trap,
 * or stone to flesh spell.  Return a monster if successfully animated.
 * If the monster is animated, the object is deleted.  If fail_reason
 * is non-null, then fill in the reason for failure (or success).
 *
 * The cause of animation is:
 *
 *      ANIMATE_NORMAL  - hero "finds" the monster
 *      ANIMATE_SHATTER - hero tries to destroy the statue
 *      ANIMATE_SPELL   - stone to flesh spell hits the statue
 *
 * Perhaps x, y is not needed if we can use get_obj_location() to find
 * the statue's location... ???
 *
 * Sequencing matters:
 *      create monster; if it fails, give up with statue intact;
 *      give "statue comes to life" message;
 *      if statue belongs to shop, have shk give "you owe" message;
 *      transfer statue contents to monster (after stolen_value());
 *      delete statue.
 *      [This ordering means that if the statue ends up wearing a cloak of
 *       invisibility or a mummy wrapping, the visibility checks might be
 *       wrong, but to avoid that we'd have to clone the statue contents
 *       first in order to give them to the monster before checking their
 *       shop status--it's not worth the hassle.]
 */
export function animate_statue(
    statue,
    x,
    y,
    cause,
    fail_reason) { /* struct monst * */
    const $frame = stack_frame(); try {
    let historic_statue_is_gone = init_string(static_array("animate_statue.historic_statue_is_gone", char, sizeof_string("that the historic statue is now gone")), _("that the historic statue is now gone"), true);

    let mnum = stack_var(int, statue.corpsenm);
    let mptr = mons[mnum[0]];
    let mon = null, shkp;
    let item;
    let cc = stack_struct(struct_nhcoord);
    let historic = +(Role_if(PM_ARCHEOLOGIST)
                        && (statue.spe & CORPSTAT_HISTORIC) != 0),
            golem_xform = FALSE, use_saved_traits;
    let comes_to_life;
    let statuename = stack_array(char, BUFSZ), tmpbuf = stack_array(char, BUFSZ);

    if (cant_revive(mnum, TRUE, statue)) {
        /* mnum has changed; we won't be animating this statue as itself */
        if (mnum[0] != PM_DOPPELGANGER)
            mptr = mons[mnum[0]];
        use_saved_traits = FALSE;
    } else if (is_golem(mptr) && cause == ANIMATE_SPELL) {
        /* statue of any golem hit by stone-to-flesh becomes flesh golem */
        golem_xform = +(mptr != mons[PM_FLESH_GOLEM]);
        mnum[0] = PM_FLESH_GOLEM;
        mptr = mons[PM_FLESH_GOLEM];
        use_saved_traits = (has_omonst(statue) && !golem_xform ? 1 : 0);
    } else {
        use_saved_traits = has_omonst(statue);
    }

    if (use_saved_traits) {
        /* restore a petrified monster */
        cc.x = x, cc.y = y;
        mon = montraits(statue, cc, +(cause == ANIMATE_SPELL));
        if (mon && mon.mtame && !mon.isminion)
            wary_dog(mon, TRUE);
    } else {
        let sgend = (statue.spe & CORPSTAT_GENDER);
        let mmflags = (NO_MINVENT | MM_NOMSG
                        | ((sgend == CORPSTAT_MALE) ? MM_MALE : 0)
                        | ((sgend == CORPSTAT_FEMALE) ? MM_FEMALE : 0));

        /* statues of unique monsters from bones or wishing end
           up here (cant_revive() sets mnum to be doppelganger;
           mptr reflects the original form for use by newcham()) */
        if ((mnum[0] == PM_DOPPELGANGER && mptr != mons[PM_DOPPELGANGER])
            /* block quest guards from other roles */
            || (mptr.msound == MS_GUARDIAN
                && quest_info(MS_GUARDIAN) != mnum[0])) {
            mmflags = or64(mmflags, MM_NOCOUNTBIRTH | MM_ADJACENTOK);
            mon = makemon(mons[PM_DOPPELGANGER], x, y, mmflags);
            /* if hero has protection from shape changers, cham field will
               be NON_PM; otherwise, set form to match the statue */
            if (mon && ismnum(mon.cham))
                newcham(mon, mptr, NO_NC_FLAGS);
        } else {
            if (cause == ANIMATE_SPELL)
                mmflags = or64(mmflags, MM_ADJACENTOK);
            mon = makemon(mptr, x, y, mmflags);
        }
    }

    if (!mon) {
        if (fail_reason)
            fail_reason[0] = unique_corpstat(mons[statue.corpsenm])
                               ? AS_MON_IS_UNIQUE
                               : AS_NO_MON;
        return null;
    }

    /* if statue has been named, give same name to the monster */
    if (has_oname(statue) && !unique_corpstat(mon.data))
        mon = christen_monst(mon, ONAME(statue));
    /* mimic statue becomes seen mimic; other hiders won't be hidden */
    if (M_AP_TYPE(mon))
        seemimic(mon);
    else
        mon.mundetected = FALSE;
    mon.msleeping = 0;
    if (cause == ANIMATE_NORMAL || cause == ANIMATE_SHATTER) {
        /* trap always releases hostile monster */
        mon.mtame = 0; /* (might be petrified pet tossed onto trap) */
        mon.mpeaceful = 0;
        set_malign(mon);
    }

    comes_to_life = !canspotmon(mon) ? _("disappears")
                    : golem_xform ? _("turns into flesh")
                      : (nonliving(mon.data) || is_vampshifter(mon))
                        ? _("moves")
                        : _("comes to life");
    if (u_at(x, y) || cause == ANIMATE_SPELL) {
        /* "the|your|Manlobbi's statue [of a wombat]" */
        shkp = shop_keeper(chars[in_rooms(mon.mx, mon.my, SHOPBASE)]);
        sprintf(statuename, _("%s%s"), shk_your(tmpbuf, statue), (cause == ANIMATE_SPELL
                 /* avoid "of a shopkeeper" if it's Manlobbi himself
                    (if carried, it can't be unpaid--hence won't be
                    described as "Manlobbi's statue"--because there
                    wasn't any living shk when statue was picked up) */
                 && (mon != shkp || carried(statue)))
                   ? xname(statue)
                   : _("statue"))
;
        pline(_("%s %s!"), upstart(statuename), comes_to_life);
    } else if (Hallucination()) { /* They don't know it's a statue */
        pline_The(_("%s suddenly seems more animated."), rndmonnam(0));
    } else if (cause == ANIMATE_SHATTER) {
        if (cansee(x, y))
            sprintf(statuename, _("%s%s"), shk_your(tmpbuf, statue), xname(statue));
        else
            strcpy(statuename, _("a statue"))
;
        pline(_("Instead of shattering, %s suddenly %s!"), statuename,
              comes_to_life);
    } else { /* cause == ANIMATE_NORMAL */
        set_msg_xy(x, y);
        You(_("find %s posing as a statue."),
            canspotmon(mon) ? a_monnam(mon) : something());
        if (!canspotmon(mon) && Blind())
            map_invisible(x, y);
        stop_occupation();
    }

    /* if this isn't caused by a monster using a wand of striking,
       there might be consequences for the hero */
    if (!svc.context.mon_moving) {
        /* if statue is owned by a shop, hero will have to pay for it;
           stolen_value gives a message (about debt or use of credit)
           which refers to "it" so needs to follow a message describing
           the object ("the statue comes to life" one above) */
        if (cause != ANIMATE_NORMAL && costly_spot(x, y)
            && (carried(statue) ? statue.unpaid : !statue.no_charge)
            && (shkp = shop_keeper(chars[in_rooms(x, y, SHOPBASE)])) != null
            /* avoid charging for Manlobbi's statue of Manlobbi
               if stone-to-flesh is used on petrified shopkeep */
            && mon != shkp)
            stolen_value(statue, x, y, shkp.mpeaceful,
                                FALSE);

        if (historic) {
            You_feel(_("guilty %s."), historic_statue_is_gone);
            adjalign(-1);
        }
    } else {
        if (historic && cansee(x, y))
            You_feel(_("regret %s."), historic_statue_is_gone);
        /* no alignment penalty */
    }

    /* transfer any statue contents to monster's inventory */
    while ((item = statue.cobj) != null) {
        obj_extract_self(item);
        mpickobj(mon, item);
    }
    m_dowear(mon, TRUE);
    /* in case statue is wielded and hero zaps stone-to-flesh at self */
    if (statue.owornmask)
        remove_worn_item(statue, TRUE);
    /* statue no longer exists */
    delobj(statue);

    /* avoid hiding under nothing */
    if (u_at(x, y) && Upolyd() && hides_under(gy.youmonst.data)
        && !OBJ_AT(x, y))
        u.uundetected = 0;

    if (fail_reason)
        fail_reason[0] = AS_OK;
    return mon;
    } finally { stack_pop($frame); }
}

/*
 * You've either stepped onto a statue trap's location or you've triggered a
 * statue trap by searching next to it or by trying to break it with a wand
 * or pick-axe.
 */
export function activate_statue_trap(
    trap,
    x,
    y,
    shatter) { /* struct monst * */
    const $frame = stack_frame(); try {
    let mtmp = null;
    let otmp = sobj_at(STATUE, x, y);
    let fail_reason = stack_var(int);

    /*
     * Try to animate the first valid statue.  Stop the loop when we
     * actually create something or the failure cause is not because
     * the mon was unique.
     */
    deltrap(trap);
    while (otmp) {
        mtmp = animate_statue(otmp, x, y,
                              shatter ? ANIMATE_SHATTER : ANIMATE_NORMAL,
                              fail_reason);
        if (mtmp || fail_reason[0] != AS_MON_IS_UNIQUE)
            break;

        otmp = nxtobj(otmp, STATUE, TRUE);
    }

    feel_newsym(x, y);
    return mtmp;
    } finally { stack_pop($frame); }
}

function keep_saddle_with_steedcorpse(
    steed_mid,
    objchn,
    saddle) { /* boolean */
    const $frame = stack_frame(); try {
    if (!saddle)
        return FALSE;
    while (objchn) {
        if (objchn.otyp == CORPSE && has_omonst(objchn)) {
            let mtmp = OMONST(objchn);

            if (mtmp.m_id == steed_mid) {
                /* move saddle */
                let x = stack_var(coordxy), y = stack_var(coordxy);
                if (get_obj_location(objchn, x, y, 0)) {
                    obj_extract_self(saddle);
                    place_object(saddle, x[0], y[0]);
                    stackobj(saddle);
                }
                return TRUE;
            }
        }
        if (Has_contents(objchn)
            && keep_saddle_with_steedcorpse(steed_mid, objchn.cobj, saddle))
            return TRUE;
        objchn = objchn.nobj;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* monster or you go through and possibly destroy a web.
   return TRUE if could go through. */
function mu_maybe_destroy_web(
    mtmp,
    domsg,
    trap) { /* boolean */
    let isyou = +(mtmp == gy.youmonst);
    let mptr = mtmp.data;

    if (amorphous(mptr) || is_whirly(mptr) || flaming(mptr)
        || unsolid(mptr) || mptr == mons[PM_GELATINOUS_CUBE]) {
        let x = trap.tx;
        let y = trap.ty;

        if (flaming(mptr) || acidic(mptr)) {
            if (domsg) {
                if (isyou)
                    You(_("%s %s spider web!"),
                        flaming(mptr) ? _("burn") : _("dissolve"),
                        a_your[trap.madeby_u]);
                else
                    pline_mon(mtmp,
                          _("%s %s %s spider web!"), Monnam(mtmp),
                          flaming(mptr) ? _("burns") : _("dissolves"),
                          a_your[trap.madeby_u]);
            }
            deltrap(trap);
            newsym(x, y);
            return TRUE;
        }
        if (domsg) {
            if (isyou) {
                You(_("flow through %s spider web."), a_your[trap.madeby_u]);
            } else {
                pline_mon(mtmp,
                      _("%s flows through %s spider web."), Monnam(mtmp),
                      a_your[trap.madeby_u]);
                seetrap(trap);
            }
        }
        return TRUE;
    }
    return FALSE;
}

/* make a single arrow/dart/rock for a trap to shoot or drop */
function t_missile(otyp, trap) { /* struct obj * */
    let otmp = mksobj(otyp, TRUE, FALSE);

    otmp.quan = 1;
    otmp.owt = unsigned(weight(otmp));
    otmp.otrapped = 0;
    otmp.ox = trap.tx, otmp.oy = trap.ty;
    return otmp;
}

export function set_utrap(tim, typ) { /* void */
    /* if we get here through reset_utrap(), the caller of that might
       have already set u.utrap to 0 so this check won't be sufficient
       in that situation; caller will need to set context.botl itself */
    if (+!u.utrap ^ +!tim)
        disp.botl = TRUE;

    u.utrap = tim;
    u.utraptype = tim ? typ : TT_NONE;

    float_vs_flight(); /* maybe block Lev and/or Fly */
}

export function reset_utrap(msg) { /* void */
    let was_Lev = +(Levitation() != 0), was_Fly = +(Flying() != 0);

    set_utrap(0, 0);

    if (msg) {
        if (!was_Lev && Levitation())
            float_up();
        if (!was_Fly && Flying())
            You(_("can fly."));
    }
}

/* is trap type ttyp triggered by touching the floor? */
function floor_trigger(ttyp) { /* boolean */
    switch (ttyp) {
    case ARROW_TRAP:
    case DART_TRAP:
    case ROCKTRAP:
    case SQKY_BOARD:
    case BEAR_TRAP:
    case LANDMINE:
    case ROLLING_BOULDER_TRAP:
    case SLP_GAS_TRAP:
    case RUST_TRAP:
    case FIRE_TRAP:
    case PIT:
    case SPIKED_PIT:
    case HOLE:
    case TRAPDOOR:
        return TRUE;
    default:
        return FALSE;
    }
}

/* return TRUE if monster mtmp is up in the air, considering trap flags */
function check_in_air(mtmp, trflags) { /* boolean */
    let is_you = +(mtmp == gy.youmonst),
            plunged = +((trflags & (TOOKPLUNGE | VIASITTING)) != 0);

    return ((trflags & HURTLING) != 0
            || (is_you ? Levitation() : is_floater(mtmp.data))
            || ((is_you ? Flying() : is_flyer(mtmp.data)) && !plunged) ? 1 : 0);
}

/* return TRUE if mtmp is wearing shoes made of iron (iron/kicking) */
export function wearing_iron_shoes(mtmp) { /* boolean */
    let armf = which_armor(mtmp, W_ARMF);
    return (armf && objects[armf.otyp].oc_material == IRON ? 1 : 0);
}

/* is trap ttmp harmless to monster mtmp? */
export function m_harmless_trap(mtmp, ttmp) { /* boolean */
    let mdat = mtmp.data;

    /* this handles most of the traps, but those are still included
       in the switch case below for completeness */
    if (!Sokoban() && floor_trigger(ttmp.ttyp) && check_in_air(mtmp, 0))
        return TRUE;

    switch (ttmp.ttyp) {
    case ARROW_TRAP:
        break;
    case DART_TRAP:
        break;
    case ROCKTRAP:
        break;
    case SQKY_BOARD:
        break;
    case BEAR_TRAP:
        if (mdat.msize <= MZ_SMALL || amorphous(mdat)
            || is_whirly(mdat) || unsolid(mdat))
            return TRUE;
        break;
    case LANDMINE:
        break;
    case ROLLING_BOULDER_TRAP:
        break;
    case SLP_GAS_TRAP:
        if (resists_sleep(mtmp) || defended(mtmp, AD_SLEE))
            return TRUE;
        break;
    case RUST_TRAP:
        if (mdat != mons[PM_IRON_GOLEM])
            return TRUE;
        break;
    case FIRE_TRAP:
        if (resists_fire(mtmp) || defended(mtmp, AD_FIRE))
            return TRUE;
        break;
    case PIT:
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case SPIKED_PIT:
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case HOLE:
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case TRAPDOOR:
        if (is_clinger(mdat) && !Sokoban())
            return TRUE;
        break;
    case TELEP_TRAP:
        break;
    case LEVEL_TELEP:
        break;
    case MAGIC_PORTAL:
        break;
    case WEB:
        if (amorphous(mdat) || webmaker(mdat)
            || is_whirly(mdat) || unsolid(mdat))
            return TRUE;
        break;
    case STATUE_TRAP:
        return TRUE;
    case MAGIC_TRAP:
        return TRUE; /* usually */
    case ANTI_MAGIC:
        if (resists_magm(mtmp) || defended(mtmp, AD_MAGM))
            return TRUE;
        break;
    case POLY_TRAP:
        break;
    case VIBRATING_SQUARE:
        return TRUE;
    default:
        impossible(_("m_harmless_trap: unknown trap %i"), ttmp.ttyp);
        break;
    }

    return FALSE;
}

function trapeffect_arrow_trap(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    let otmp = stack_var(ptr_to(struct_obj));
    let dam;

    if (mtmp == gy.youmonst) {
        if (trap.once && trap.tseen && !rn2(15)) {
             ;
            You_hear(_("a loud click!"));
            deltrap(trap);
            newsym(u.ux, u.uy);
            return Trap_Is_Gone;
        }
        trap.once = 1;
        seetrap(trap);
        pline(_("An arrow shoots out at you!"));
        otmp[0] = t_missile(ARROW, trap);
        dam = dmgval(otmp[0], gy.youmonst);
        if (u.usteed && !rn2(2) && steedintrap(trap, otmp[0])) {
            ; /* nothing */
        } else if (thitu(8, Maybe_Half_Phys(dam), otmp, _("arrow"))) {
            if (otmp[0])
                obfree(otmp[0], null);
        } else {
            place_object(otmp[0], u.ux, u.uy);
            if (!Blind())
                observe_object(otmp[0]);
            stackobj(otmp[0]);
            newsym(u.ux, u.uy);
        }
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let see_it = cansee(mtmp.mx, mtmp.my);
        let trapkilled = FALSE;

        if (trap.once && trap.tseen && !rn2(15)) {
            if (in_sight && see_it)
                pline_mon(mtmp,
                      _("%s triggers a trap but nothing happens."),
                      Monnam(mtmp));
            deltrap(trap);
            newsym(mtmp.mx, mtmp.my);
            return Trap_Is_Gone;
        }
        trap.once = 1;
        otmp[0] = t_missile(ARROW, trap);
        if (in_sight)
            seetrap(trap);
        if (thitm(8, mtmp, otmp[0], 0, FALSE))
            trapkilled = TRUE;

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

function trapeffect_dart_trap(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    let otmp = stack_var(ptr_to(struct_obj));
    let dam;

    if (mtmp == gy.youmonst) {
        let oldumort = u.umortality;

        if (trap.once && trap.tseen && !rn2(15)) {
             ;
            You_hear(_("a soft click."));
            deltrap(trap);
            newsym(u.ux, u.uy);
            return Trap_Is_Gone;
        }
        trap.once = 1;
        seetrap(trap);
        pline(_("A little dart shoots out at you!"));
        otmp[0] = t_missile(DART, trap);
        if (!rn2(6))
            otmp[0].otrapped = 1;
        dam = dmgval(otmp[0], gy.youmonst);
        if (u.usteed && !rn2(2) && steedintrap(trap, otmp[0])) {
            ; /* nothing */
        } else if (thitu(7, Maybe_Half_Phys(dam), otmp, _("little dart"))) {
            if (otmp[0]) {
                if (otmp[0].otrapped)
                    poisoned(_("dart"), A_CON, _("little dart"),
                             /* if damage triggered life-saving,
                                poison is limited to attrib loss */
                             (u.umortality > oldumort) ? 0 : 10, TRUE);
                obfree(otmp[0], null);
            }
        } else {
            place_object(otmp[0], u.ux, u.uy);
            if (!Blind())
                observe_object(otmp[0]);
            stackobj(otmp[0]);
            newsym(u.ux, u.uy);
        }
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let see_it = cansee(mtmp.mx, mtmp.my);
        let trapkilled = FALSE;

        if (trap.once && trap.tseen && !rn2(15)) {
            if (in_sight && see_it)
                pline_mon(mtmp,
                      _("%s triggers a trap but nothing happens."),
                      Monnam(mtmp));
            deltrap(trap);
            newsym(mtmp.mx, mtmp.my);
            return Trap_Is_Gone;
        }
        trap.once = 1;
        otmp[0] = t_missile(DART, trap);
        if (!rn2(6))
            otmp[0].otrapped = 1;
        if (in_sight)
            seetrap(trap);
        if (thitm(7, mtmp, otmp[0], 0, FALSE))
            trapkilled = TRUE;

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

function trapeffect_rocktrap(
    mtmp,
    trap,
    trflags) { /* int */
    let otmp;
    let harmless = FALSE;

    if (mtmp == gy.youmonst) {
        if (trap.once && trap.tseen && !rn2(15)) {
            pline(_("A trap door in %s opens, but nothing falls out!"),
                  the(ceiling(u.ux, u.uy)));
            deltrap(trap);
            newsym(u.ux, u.uy);
        } else {
            let dmg = d(2, 6); /* should be std ROCK dmg? */

            trap.once = 1;
            feeltrap(trap);
            otmp = t_missile(ROCK, trap);
            place_object(otmp, u.ux, u.uy);

            pline(_("A trap door in %s opens and %s falls on your %s!"),
                  the(ceiling(u.ux, u.uy)), an(xname(otmp)), body_part(HEAD));
            if (uarmh) {
                /* normally passes_rocks() would protect against a falling
                   rock, but not when wearing a helmet */
                if (passes_rocks(gy.youmonst.data)) {
                    pline(_("Unfortunately, you are wearing %s."),
                          an(helm_simple_name(uarmh))); /* helm or hat */
                    dmg = 2;
                } else if (hard_helmet(uarmh)) {
                    pline(_("Fortunately, you are wearing a hard helmet."));
                    dmg = 2;
                } else if (flags.verbose) {
                    pline(_("%s does not protect you."), Yname2(uarmh));
                }
            } else if (passes_rocks(gy.youmonst.data)) {
                pline(_("It passes harmlessly through you."));
                harmless = TRUE;
            }
            if (!Blind())
                observe_object(otmp);
            stackobj(otmp);
            newsym(u.ux, u.uy); /* map the rock */

            if (!harmless) {
                losehp(Maybe_Half_Phys(dmg), _("falling rock"), KILLED_BY_AN);
                exercise(A_STR, FALSE);
            }
        }
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let see_it = cansee(mtmp.mx, mtmp.my);
        let trapkilled = FALSE;

        if (trap.once && trap.tseen && !rn2(15)) {
            if (in_sight && see_it)
                pline_mon(mtmp,
                      _("A trap door above %s opens, but nothing falls out!"),
                      mon_nam(mtmp));
            deltrap(trap);
            newsym(mtmp.mx, mtmp.my);
            return Trap_Is_Gone;
        }
        trap.once = 1;
        otmp = t_missile(ROCK, trap);
        if (in_sight)
            seetrap(trap);
        if (thitm(0, mtmp, otmp, d(2, 6), FALSE))
            trapkilled = TRUE;

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
}

function trapeffect_sqky_board(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    let tsnds = stack_array(unsigned, null, [
        se_squeak_C, se_squeak_D_flat, se_squeak_D,
        se_squeak_E_flat, se_squeak_E, se_squeak_F,
        se_squeak_F_sharp, se_squeak_G, se_squeak_G_sharp,
        se_squeak_A, se_squeak_B_flat, se_squeak_B,
    ]);
    let forcetrap = ((trflags & FORCETRAP) != 0
                         || (trflags & FAILEDUNTRAP) != 0
                         || (Flying() && (trflags & VIASITTING) != 0) ? 1 : 0);

    if (mtmp == gy.youmonst) {
        if ((Levitation() || Flying()) && !forcetrap) {
            if (!Blind()) {
                seetrap(trap);
                if (Hallucination())
                    You(_("notice a crease in the linoleum."));
                else
                    You(_("notice a loose board below you."));
            }
        } else {
            seetrap(trap);
            if (IndexOk(trap.vl.v_tnote, tsnds)) {
                 ;
            }
            pline(_("A board beneath you %s%s%s."),
                  Deaf() ? _("vibrates") : _("squeaks "),
                  Deaf() ? _("") : trapnote(trap, FALSE),
                  Deaf() ? _("") : _(" loudly"));
            wake_nearby(FALSE);
        }
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);

        if (m_in_air(mtmp))
            return Trap_Effect_Finished;
        /* stepped on a squeaky board */
        if (in_sight) {
            if (!Deaf()) {
                if (IndexOk(trap.vl.v_tnote, tsnds)) {
                     ;
                }
                pline_mon(mtmp,
                      _("A board beneath %s squeaks %s loudly."),
                      mon_nam(mtmp), trapnote(trap, FALSE));
                seetrap(trap);
            } else if (!mindless(mtmp.data)) {
                pline_mon(mtmp,
                      _("%s stops momentarily and appears to cringe."),
                      Monnam(mtmp));
            }
        } else {
            /* same near/far threshold as mzapmsg() */
            let range = couldsee(mtmp.mx, mtmp.my) /* 9 or 5 */
                ? (BOLT_LIM + 1) : (BOLT_LIM - 3);

            if (IndexOk(trap.vl.v_tnote, tsnds)) {
                                   ;
            }
            You_hear(_("%s squeak %s."), trapnote(trap, FALSE),
                     (mdistu(mtmp) <= range * range)
                        ? _("nearby") : _("in the distance"));
        }
        /* wake up nearby monsters */
        wake_nearto(mtmp.mx, mtmp.my, 40);
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

function trapeffect_bear_trap(
    mtmp,
    trap,
    trflags) { /* int */
    let is_you = +(mtmp == gy.youmonst),
            forcetrap = ((trflags & FORCETRAP) != 0
                         || (trflags & FAILEDUNTRAP) != 0
                         || (is_you && (trflags & VIASITTING) != 0) ? 1 : 0);

    if (is_you) {
        let dmg = d(2, 4);

        if ((Levitation() || Flying()) && !forcetrap)
            return Trap_Effect_Finished;
        feeltrap(trap);
        if (amorphous(gy.youmonst.data) || is_whirly(gy.youmonst.data)
            || unsolid(gy.youmonst.data)) {
            pline(_("%s bear trap closes harmlessly through you."),
                  A_Your[trap.madeby_u]);
            return Trap_Effect_Finished;
        }
        if (!u.usteed && gy.youmonst.data.msize <= MZ_SMALL) {
            pline(_("%s bear trap closes harmlessly over you."),
                  A_Your[trap.madeby_u]);
            return Trap_Effect_Finished;
        }
        set_utrap(unsigned(rn1(4, 4)), TT_BEARTRAP);
        if (u.usteed) {
            pline(_("%s bear trap closes on %s %s!"), A_Your[trap.madeby_u],
                  s_suffix(mon_nam(u.usteed)), mbodypart(u.usteed, FOOT));
            if (thitm(0, u.usteed, null, dmg, FALSE))
                reset_utrap(TRUE); /* steed died, hero not trapped */
        } else {
            pline(_("%s bear trap closes on your %s!"), A_Your[trap.madeby_u],
                  body_part(FOOT));
            if (u.umonnum == PM_OWLBEAR || u.umonnum == PM_BUGBEAR)
                You(_("howl in anger!"));
            if (wearing_iron_shoes(mtmp))
                pline(_("%s protects your leg."), Yname2(uarmf));
            else {
                set_wounded_legs(rn2(2) ? RIGHT_SIDE : LEFT_SIDE, rn1(10, 10));
                losehp(Maybe_Half_Phys(dmg), _("bear trap"), KILLED_BY_AN);
            }
        }
        exercise(A_DEX, FALSE);
    } else {
        let mptr = mtmp.data;
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let trapkilled = FALSE;

        if (mptr.msize > MZ_SMALL && !amorphous(mptr) && !m_in_air(mtmp)
            && !is_whirly(mptr) && !unsolid(mptr)) {
            mtmp.mtrapped = 1;
            if (in_sight) {
                pline_mon(mtmp,
                      _("%s is caught in %s bear trap!"), Monnam(mtmp),
                      a_your[trap.madeby_u]);
                seetrap(trap);
            } else {
                if (mptr == mons[PM_OWLBEAR]
                    || mptr == mons[PM_BUGBEAR]) {
                     ;
                    You_hear(_("the roaring of an angry bear!"));
                }
            }
        } else if (forcetrap) {
            if (in_sight) {
                pline_mon(mtmp,
                      _("%s evades %s bear trap!"), Monnam(mtmp),
                      a_your[trap.madeby_u]);
                seetrap(trap);
            }
        }
        if (mtmp.mtrapped && !wearing_iron_shoes(mtmp))
            trapkilled = thitm(0, mtmp, null, d(2, 4), FALSE);

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
}

function trapeffect_slp_gas_trap(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        seetrap(trap);
        if (Sleep_resistance() || breathless(gy.youmonst.data)) {
            You(_("are enveloped in a cloud of gas!"));
            monstseesu(M_SEEN_SLEEP);
        } else {
            pline(_("A cloud of gas puts you to sleep!"));
            fall_asleep(-rnd(25), TRUE);
            monstunseesu(M_SEEN_SLEEP);
        }
        steedintrap(trap, null);
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);

        if (!resists_sleep(mtmp) && !breathless(mtmp.data)
            && !helpless(mtmp)) {
            if (sleep_monst(mtmp, rnd(25), -1) && in_sight) {
                pline_mon(mtmp,
                          _("%s suddenly falls asleep!"), Monnam(mtmp));
                seetrap(trap);
            }
        }
    }
    return Trap_Effect_Finished;
}

function trapeffect_rust_trap(
    mtmp,
    trap,
    trflags) { /* int */
    let $goto = null;
    var otmp, nextobj;

    if (mtmp == gy.youmonst) {
        seetrap(trap);

        /* Unlike monsters, traps cannot aim their rust attacks at
         * you, so instead of looping through and taking either the
         * first rustable one or the body, we take whatever we get,
         * even if it is not rustable.
         */
        $goto_uglovecheck: for (;;) { switch ($goto || (rn2(5))) {
        case 0:
            pline(_("%s you on the %s!"), A_gush_of_water_hits[0], body_part(HEAD));
            water_damage(uarmh, helm_simple_name(uarmh), TRUE);
            break;
        case 1:
            pline(_("%s your left %s!"), A_gush_of_water_hits[0], body_part(ARM));
            if (water_damage(uarms, _("shield"), TRUE) != ER_NOTHING)
                break;
            if (u.twoweap || (uwep && bimanual(uwep)))
                water_damage(u.twoweap ? uswapwep : uwep, 0, TRUE);
 case "uglovecheck": $goto = null;
            water_damage(uarmg, gloves_simple_name(uarmg), TRUE);
            break;
        case 2:
            pline(_("%s your right %s!"), A_gush_of_water_hits[0], body_part(ARM));
            water_damage(uwep, 0, TRUE);
            { $goto = "uglovecheck"; continue $goto_uglovecheck; }
        default:
            pline(_("%s you!"), A_gush_of_water_hits[0]);
            /* note: exclude primary and secondary weapons from splashing
               because cases 1 and 2 target them [via water_damage()] */
            for (otmp = gi.invent; otmp; otmp = nextobj) {
                nextobj = otmp.nobj;
                if (otmp.lamplit && otmp != uwep
                    && (otmp != uswapwep || !u.twoweap))
                    splash_lit(otmp);
            }
            if (uarmc)
                water_damage(uarmc, cloak_simple_name(uarmc), TRUE);
            else if (uarm)
                water_damage(uarm, suit_simple_name(uarm), TRUE);
            else if (uarmu)
                water_damage(uarmu, _("shirt"), TRUE);
        } break; }
        update_inventory();

        if (u.umonnum == PM_IRON_GOLEM) {
            var dam = u.mhmax;

            You(_("are covered with rust!"));
            losehp(Maybe_Half_Phys(dam), _("rusting away"), KILLED_BY);
        } else if (u.umonnum == PM_GREMLIN && rn2(3)) {
            split_mon(gy.youmonst, null);
        }
    } else {
        var in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        var trapkilled = FALSE;
        var mptr = mtmp.data;
        var target;

        if (in_sight)
            seetrap(trap);
        $goto_mglovecheck: for (;;) { switch ($goto || (rn2(5))) {
        case 0:
            if (in_sight)
                pline_mon(mtmp,
                      _("%s %s on the %s!"), A_gush_of_water_hits[0],
                      mon_nam(mtmp), mbodypart(mtmp, HEAD));
            target = which_armor(mtmp, W_ARMH);
            water_damage(target, helm_simple_name(target), TRUE);
            break;
        case 1:
            if (in_sight)
                pline_mon(mtmp,
                      _("%s %s's left %s!"), A_gush_of_water_hits[0],
                      mon_nam(mtmp), mbodypart(mtmp, ARM));
            target = which_armor(mtmp, W_ARMS);
            if (water_damage(target, _("shield"), TRUE) != ER_NOTHING)
                break;
            target = MON_WEP(mtmp);
            if (target && bimanual(target))
                water_damage(target, 0, TRUE);
 case "mglovecheck": $goto = null;
            target = which_armor(mtmp, W_ARMG);
            water_damage(target, gloves_simple_name(target), TRUE);
            break;
        case 2:
            if (in_sight)
                pline_mon(mtmp,
                      _("%s %s's right %s!"), A_gush_of_water_hits[0],
                      mon_nam(mtmp), mbodypart(mtmp, ARM));
            water_damage(MON_WEP(mtmp), 0, TRUE);
            { $goto = "mglovecheck"; continue $goto_mglovecheck; }
        default:
            if (in_sight)
                pline(_("%s %s!"), A_gush_of_water_hits[0], mon_nam(mtmp));
            for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
                if (otmp.lamplit
                    /* exclude weapon(s) because cases 1 and 2 do them */
                    && (otmp.owornmask & (W_WEP | W_SWAPWEP)) == 0)
                    splash_lit(otmp);
            if ((target = which_armor(mtmp, W_ARMC)) != null)
                water_damage(target, cloak_simple_name(target),
                                    TRUE);
            else if ((target = which_armor(mtmp, W_ARM)) != null)
                water_damage(target, suit_simple_name(target),
                                    TRUE);
            else if ((target = which_armor(mtmp, W_ARMU)) != null)
                water_damage(target, _("shirt"), TRUE);
        } break; }

        if (completelyrusts(mptr)) {
            if (in_sight)
                pline_mon(mtmp, _("%s %s to pieces!"), Monnam(mtmp),
                      !mlifesaver(mtmp) ? _("falls") : _("starts to fall"));
            monkilled(mtmp, 0, AD_RUST);
            if (DEADMONSTER(mtmp))
                trapkilled = TRUE;
        } else if (mptr == mons[PM_GREMLIN] && rn2(3)) {
            split_mon(mtmp, null);
        }

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
}

function trapeffect_fire_trap(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        seetrap(trap);
        dofiretrap(null);
    } else {
        let tx = trap.tx, ty = trap.ty;
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let see_it = cansee(tx, ty);
        let trapkilled = FALSE;
        let mptr = mtmp.data;
        let orig_dmg = d(2, 4);

        if (in_sight)
            pline_mon(mtmp,
                 _("A %s erupts from the %s under %s!"), tower_of_flame,
                  surface(mtmp.mx, mtmp.my), mon_nam(mtmp));
        else if (see_it) { /* evidently `mtmp' is invisible */
            set_msg_xy(mtmp.mx, mtmp.my);
            You_see(_("a %s erupt from the %s!"), tower_of_flame,
                    surface(mtmp.mx, mtmp.my));
        }
        if (resists_fire(mtmp)) {
            if (in_sight) {
                shieldeff(mtmp.mx, mtmp.my);
                pline(_("%s is uninjured."), Monnam(mtmp));
            }
        } else {
            let num = orig_dmg, alt;
            let immolate = FALSE;

            /* paper burns very fast, assume straw is tightly packed
               and burns a bit slower
               (note: this is inconsistent with mattackm()'s AD_FIRE
               damage where completelyburns() includes straw golem) */
            switch (monsndx(mptr)) {
            case PM_PAPER_GOLEM:
                immolate = TRUE;
                alt = mtmp.mhpmax;
                break;
            case PM_STRAW_GOLEM:
                alt = Math.trunc(mtmp.mhpmax / 2);
                break;
            case PM_WOOD_GOLEM:
                alt = Math.trunc(mtmp.mhpmax / 4);
                break;
            case PM_LEATHER_GOLEM:
                alt = Math.trunc(mtmp.mhpmax / 8);
                break;
            default:
                alt = 0;
                break;
            }
            if (alt > num)
                num = alt;

            if (thitm(0, mtmp, null, num, immolate))
                trapkilled = TRUE;
            else {
                mtmp.mhpmax -= rn2(num + 1);
                if (mtmp.mhp > mtmp.mhpmax)
                    mtmp.mhp = mtmp.mhpmax;
            }
        }
        if (burnarmor(mtmp) || rn2(3)) {
            let xtradmg = destroy_items(mtmp, AD_FIRE, orig_dmg);
            ignite_items(mtmp.minvent);
            if (!DEADMONSTER(mtmp)) {
                mtmp.mhp -= xtradmg;
                if (DEADMONSTER(mtmp)) { /* NOW it's dead */
                    monkilled(mtmp, _(""), AD_FIRE);
                    trapkilled = TRUE;
                }
            }
        }
        if (burn_floor_objects(tx, ty, see_it, FALSE)
            && !see_it && distu(tx, ty) <= 3 * 3)
            You(_("smell smoke."));
        if (is_ice(tx, ty))
            melt_ice(tx, ty, 0);
        if (DEADMONSTER(mtmp))
            trapkilled = TRUE;
        if (see_it && t_at(tx, ty))
            seetrap(t_at(tx, ty));

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
}

function trapeffect_pit(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    let ttype = trap.ttyp;
    /* relevant_spikes is initially always true for spiked pits, but
       set to false if the spikes are found to not be relevant */
    let relevant_spikes = +(ttype == SPIKED_PIT);

    if (mtmp == gy.youmonst) {
        let plunged = +((trflags & TOOKPLUNGE) != 0);
        let viasitting = +((trflags & VIASITTING) != 0);
        let conj_pit = conjoined_pits(trap, t_at(u.ux0, u.uy0), TRUE);
        let adj_pit = adj_nonconjoined_pit(trap);
        let already_known = trap.tseen ? TRUE : FALSE;
        let deliberate = FALSE;
        let steed_article = ARTICLE_THE;

        /* suppress article in various steed messages when using its
           name (which won't occur when hallucinating) */
        if (u.usteed && has_mgivenname(u.usteed) && !Hallucination())
            steed_article = ARTICLE_NONE;

        /* KMH -- You can't escape the Sokoban level traps */
        if (!Sokoban() && (Levitation() || (Flying() && !plunged && !viasitting)))
            return Trap_Effect_Finished;
        feeltrap(trap);
        if (!Sokoban() && is_clinger(gy.youmonst.data) && !plunged) {
            if (already_known) {
                You_see(_("%s %spit below you."), a_your[trap.madeby_u],
                        ttype == SPIKED_PIT ? _("spiked ") : _(""));
            } else {
                pline(_("%s pit %sopens up under you!"), A_Your[trap.madeby_u],
                      ttype == SPIKED_PIT ? _("full of spikes ") : _(""));
                You(_("don't fall in!"));
            }
            return Trap_Effect_Finished;
        }
        if (!Sokoban()) {
            let verbbuf = stack_array(char, BUFSZ);

            chars[verbbuf] = ord('\0');
            if (u.usteed) {
                if ((trflags & RECURSIVETRAP) != 0)
                    sprintf(verbbuf, _("and %s fall"), x_monnam(u.usteed, steed_article, 0,
                                     SUPPRESS_SADDLE, FALSE));
                else
                    sprintf(verbbuf, _("lead %s"), x_monnam(u.usteed, steed_article, _("poor"),
                                     SUPPRESS_SADDLE, FALSE))

;
            } else if (iflags.menu_requested && already_known) {
                You(_("carefully %s into the pit."),
                    u_locomotion(_("lower yourself")));
                deliberate = TRUE;
            } else if (conj_pit) {
                You(_("move into an adjacent pit."));
            } else if (adj_pit) {
                You(_("stumble over debris%s."),
                    !rn2(5) ? _(" between the pits") : _(""));
            } else {
                strcpy(verbbuf, !plunged ? _("fall") : (Flying() ? _("dive") : _("plunge")))
;
            }
            if (chars[verbbuf])
                You(_("%s into %s pit!"), verbbuf, a_your[trap.madeby_u]);
        }
        /* wumpus reference */
        if (Role_if(PM_RANGER) && !trap.madeby_u && !trap.once
            && In_quest(u.uz) && Is_qlocate(u.uz)) {
            pline(_("Fortunately it has a bottom after all..."));
            trap.once = 1;
        } else if (u.umonnum == PM_PIT_VIPER || u.umonnum == PM_PIT_FIEND) {
            pline(_("How pitiful.  Isn't that the pits?"));
        }
        if (relevant_spikes && wearing_iron_shoes(mtmp)) {
            pline(_("%s protects you from the sharp iron spikes."), Yname2(uarmf));
            relevant_spikes = FALSE;
        } else if (relevant_spikes) {
            let predicament = _("on a set of sharp iron spikes");

            if (u.usteed) {
                pline(_("%s %s %s!"),
                      upstart(x_monnam(u.usteed, steed_article, _("poor"),
                                       SUPPRESS_SADDLE, FALSE)),
                      conj_pit ? _("steps") : _("lands"), predicament);
            } else
                You(_("%s %s!"), conj_pit ? _("step") : _("land"), predicament);
        }
        /* FIXME:
         * if hero gets killed here, setting u.utrap in advance will
         * show "you were trapped in a pit" during disclosure's display
         * of enlightenment, but hero is dying *before* becoming trapped.
         */
        set_utrap(unsigned(rn1(6, 2)), TT_PIT);
        if (!steedintrap(trap, null)) {
            if (relevant_spikes) {
                let oldumort = u.umortality;

                losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(conj_pit ? 4 : adj_pit ? 6 : 10)) + 1) / 2))) : (rnd(conj_pit ? 4 : adj_pit ? 6 : 10))),
                       /* note: these don't need locomotion() handling;
                          if fatal while poly'd and Unchanging, the
                          death reason will be overridden with
                          "killed while stuck in creature form" */
                       plunged
                       ? _("deliberately plunged into a pit of iron spikes")
                       : (conj_pit || deliberate)
                         ? _("stepped into a pit of iron spikes")
                         : adj_pit
                           ? _("stumbled into a pit of iron spikes")
                           : _("fell into a pit of iron spikes"),
                       NO_KILLER_PREFIX);
                if (!rn2(6))
                    poisoned(_("spikes"), A_STR,
                             (conj_pit || adj_pit || deliberate)
                             ? _("stepping on poison spikes")
                             : _("fall onto poison spikes"),
                             /* if damage triggered life-saving,
                                poison is limited to attrib loss */
                             (u.umortality > oldumort) ? 0 : 8, FALSE);
            } else {
                /* plunging flyers take spike damage but not pit damage */
                if (!conj_pit && !deliberate
                    && !(plunged && (Flying() || is_clinger(gy.youmonst.data))))
                    losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(adj_pit ? 3 : 6)) + 1) / 2))) : (rnd(adj_pit ? 3 : 6))),
                           plunged ? _("deliberately plunged into a pit")
                           : _("fell into a pit"),
                           NO_KILLER_PREFIX);
            }
            if (Punished() && !carried(uball)) {
                unplacebc();
                ballfall();
                placebc();
            }
            if (!conj_pit)
                selftouch(_("Falling, you"));
            gv.vision_full_recalc = 1; /* vision limits change */
            exercise(A_STR, FALSE);
            exercise(A_DEX, FALSE);
        }
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let trapkilled = FALSE;
        let forcetrap = +((trflags & FORCETRAP) != 0);
        let inescapable = (forcetrap || (Sokoban() && !trap.madeby_u) ? 1 : 0);
        let mptr = mtmp.data;
        let fallverb;

        fallverb = _("falls");
        if (!grounded(mptr) || (mtmp.wormno && count_wsegs(mtmp) > 5)) {
            if (forcetrap && !Sokoban()) {
                /* openfallingtrap; not inescapable here */
                if (in_sight) {
                    seetrap(trap);
                    pline_mon(mtmp,
                             _("%s doesn't fall into the pit."), Monnam(mtmp));
                }
                return Trap_Effect_Finished;
            }
            if (!inescapable)
                return Trap_Effect_Finished; /* avoids trap */
            fallverb = _("is dragged"); /* sokoban pit */
        }
        if (!passes_walls(mptr))
            mtmp.mtrapped = 1;
        if (in_sight) {
            pline_mon(mtmp,
                     _("%s %s into %s pit!"), Monnam(mtmp), fallverb,
                     a_your[trap.madeby_u]);
            if (mptr == mons[PM_PIT_VIPER]
                || mptr == mons[PM_PIT_FIEND])
                pline(_("How pitiful.  Isn't that the pits?"));
            seetrap(trap);
        }
        mselftouch(mtmp, _("Falling, "), FALSE);
        if (wearing_iron_shoes(mtmp)) relevant_spikes = FALSE;
        if (DEADMONSTER(mtmp) || thitm(0, mtmp, null,
                                       rnd(relevant_spikes ? 10 : 6), FALSE))
            trapkilled = TRUE;

        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

function trapeffect_hole(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        if (!Can_fall_thru(u.uz)) {
            seetrap(trap); /* normally done in fall_through */
            impossible(_("dotrap: %ss cannot exist on this level."),
                       trapname(trap.ttyp, TRUE));
            return Trap_Effect_Finished; /* don't activate it after all */
        }
        fall_through(TRUE, (trflags & TOOKPLUNGE));
    } else {
        let tt = trap.ttyp;
        let mptr = mtmp.data;
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let forcetrap = +((trflags & FORCETRAP) != 0);
        let inescapable = (forcetrap || (Sokoban() && !trap.madeby_u) ? 1 : 0);

        if (!Can_fall_thru(u.uz)) {
            impossible(_("mintrap: %ss cannot exist on this level."),
                       trapname(tt, TRUE));
            return Trap_Effect_Finished; /* don't activate it after all */
        }
        if (!grounded(mptr) || (mtmp.wormno && count_wsegs(mtmp) > 5)
            || mptr.msize >= MZ_HUGE) {
            if (forcetrap && !Sokoban()) {
                /* openfallingtrap; not inescapable here */
                if (in_sight) {
                    seetrap(trap);
                    if (tt == TRAPDOOR)
                        pline_mon(mtmp,
                            _("A trap door opens, but %s doesn't fall through."),
                              mon_nam(mtmp));
                    else /* (tt == HOLE) */
                        pline_mon(mtmp,
                                 _("%s doesn't fall through the hole."),
                                 Monnam(mtmp));
                }
                return Trap_Effect_Finished; /* inescapable = FALSE; */
            }
            if (inescapable) { /* sokoban hole */
                if (in_sight) {
                    pline_mon(mtmp,
                             _("%s seems to be yanked down!"), Monnam(mtmp));
                    seetrap(trap);
                }
            } else
                return Trap_Effect_Finished;
        }
        return trapeffect_level_telep(mtmp, trap, trflags);
    }
    return Trap_Effect_Finished;
}

function trapeffect_telep_trap(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        seetrap(trap);
        tele_trap(trap);
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);

        mtele_trap(mtmp, trap, in_sight);
        return Trap_Moved_Mon;
    }
    return Trap_Effect_Finished;
}

function trapeffect_level_telep(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        seetrap(trap);
        level_tele_trap(trap, trflags);
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let forcetrap = +((trflags & FORCETRAP) != 0);

        return mlevel_tele_trap(mtmp, trap, forcetrap, in_sight);
    }
    return Trap_Effect_Finished;
}

function trapeffect_web(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    if (mtmp == gy.youmonst) {
        let webmsgok = +((trflags & NOWEBMSG) == 0);
        let forcetrap = +((trflags & FORCETRAP) != 0
                             || (trflags & FAILEDUNTRAP) != 0);
        let viasitting = +((trflags & VIASITTING) != 0);
        let steed_article = ARTICLE_THE;

        /* suppress article in various steed messages when using its
           name (which won't occur when hallucinating) */
        if (u.usteed && has_mgivenname(u.usteed) && !Hallucination())
            steed_article = ARTICLE_NONE;

        feeltrap(trap);
        if (mu_maybe_destroy_web(gy.youmonst, webmsgok, trap))
            return Trap_Effect_Finished;
        if (webmaker(gy.youmonst.data)) {
            if (webmsgok)
                pline(trap.madeby_u ? _("You take a walk on your web.")
                      : _("There is a spider web here."));
            return Trap_Effect_Finished;
        }
        if (webmsgok) {
            let verbbuf = stack_array(char, BUFSZ);

            if (forcetrap || viasitting) {
                strcpy(verbbuf, _("are caught by"));
            } else if (u.usteed) {
                sprintf(verbbuf, _("lead %s into"), x_monnam(u.usteed, steed_article, _("poor"),
                                 SUPPRESS_SADDLE, FALSE))
;
            } else {
                sprintf(verbbuf, _("%s into"), u_locomotion(_("stumble")));
            }
            You(_("%s %s spider web!"), verbbuf, a_your[trap.madeby_u]);
        }

        /* time will be adjusted below */
        set_utrap(1, TT_WEB);

        /* Time stuck in the web depends on your/steed's strength. */
        {
            let tim, str = ACURR(A_STR);

            /* If mounted, the steed gets trapped.  Use mintrap
             * to do all the work.  If mtrapped is set as a result,
             * unset it and set utrap instead.  In the case of a
             * strongmonst and mintrap said it's trapped, use a
             * short but non-zero trap time.  Otherwise, monsters
             * have no specific strength, so use player strength.
             * This gets skipped for webmsgok, which implies that
             * the steed isn't a factor.
             */
            if (u.usteed && webmsgok) {
                /* mtmp location might not be up to date */
                u.usteed.mx = u.ux;
                u.usteed.my = u.uy;

                /* mintrap currently does not return Trap_Killed_Mon
                   (mon died) for webs */
                if (mintrap(u.usteed, trflags) != Trap_Effect_Finished) {
                    u.usteed.mtrapped = 0;
                    if (strongmonst(u.usteed.data))
                        str = 17;
                } else {
                    reset_utrap(FALSE);
                    return Trap_Effect_Finished;
                }

                webmsgok = FALSE; /* mintrap printed the messages */
            }
            if (str <= 3)
                tim = rn1(6, 6);
            else if (str < 6)
                tim = rn1(6, 4);
            else if (str < 9)
                tim = rn1(4, 4);
            else if (str < 12)
                tim = rn1(4, 2);
            else if (str < 15)
                tim = rn1(2, 2);
            else if (str < 18)
                tim = rnd(2);
            else if (str < 69)
                tim = 1;
            else {
                tim = 0;
                if (webmsgok)
                    You(_("tear through %s web!"), a_your[trap.madeby_u]);
                deltrap(trap);
                newsym(u.ux, u.uy); /* get rid of trap symbol */
            }
            set_utrap(unsigned(tim), TT_WEB);
        }
    } else {
        /* Monster in a web. */
        let tear_web;
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let forcetrap = +((trflags & FORCETRAP) != 0);
        let mptr = mtmp.data;

        if (webmaker(mptr))
            return Trap_Effect_Finished;
        if (mu_maybe_destroy_web(mtmp, in_sight, trap))
            return Trap_Effect_Finished;
        tear_web = FALSE;
        switch (monsndx(mptr)) {
        case PM_OWLBEAR: /* Eric Backus */
        case PM_BUGBEAR:
            if (!in_sight) {
                 ;
                You_hear(_("the roaring of a confused bear!"));
                mtmp.mtrapped = 1;
                break;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        default:
            if (mptr.mlet == S_GIANT
                /* exclude baby dragons and relatively short worms */
                || (mptr.mlet == S_DRAGON && extra_nasty(mptr))
                || (mtmp.wormno && count_wsegs(mtmp) > 5)) {
                tear_web = TRUE;
            } else if (in_sight) {
                pline_mon(mtmp,
                      _("%s is caught in %s spider web."), Monnam(mtmp),
                      a_your[trap.madeby_u]);
                seetrap(trap);
            }
            mtmp.mtrapped = tear_web ? 0 : 1;
            break;
            /* this list is fairly arbitrary; it deliberately
               excludes wumpus & giant/ettin zombies/mummies */
        case PM_TITANOTHERE:
        case PM_BALUCHITHERIUM:
        case PM_PURPLE_WORM:
        case PM_JABBERWOCK:
        case PM_IRON_GOLEM:
        case PM_BALROG:
        case PM_KRAKEN:
        case PM_MASTODON:
        case PM_ORION:
        case PM_NORN:
        case PM_CYCLOPS:
        case PM_LORD_SURTUR:
            tear_web = TRUE;
            break;
        }
        if (tear_web) {
            if (in_sight)
                pline_mon(mtmp,
                     _("%s tears through %s spider web!"), Monnam(mtmp),
                      a_your[trap.madeby_u]);
            deltrap(trap);
            newsym(mtmp.mx, mtmp.my);
        } else if (forcetrap && !mtmp.mtrapped) {
            if (in_sight) {
                pline_mon(mtmp,
                      _("%s avoids %s spider web!"), Monnam(mtmp),
                      a_your[trap.madeby_u]);
                seetrap(trap);
            }
        }
        return mtmp.mtrapped ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

function trapeffect_statue_trap(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        activate_statue_trap(trap, u.ux, u.uy, FALSE);
    } else {
        /* monsters don't trigger statue traps */
    }
    return Trap_Effect_Finished;
}

function trapeffect_magic_trap(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        seetrap(trap);
        if (!rn2(30)) {
            deltrap(trap);
            newsym(u.ux, u.uy); /* update position */
            You(_("are caught in a magical explosion!"));
            losehp(rnd(10), _("magical explosion"), KILLED_BY_AN);
            Your(_("body absorbs some of the magical energy!"));
            u.uen = (u.uenmax += 2);
            if (u.uenmax > u.uenpeak)
                u.uenpeak = u.uenmax;
            return Trap_Effect_Finished;
        } else {
            domagictrap();
        }
        steedintrap(trap, null);
    } else {
        /* A magic trap.  Monsters usually immune. */
        if (!rn2(21))
            return trapeffect_fire_trap(mtmp, trap, trflags);
    }
    return Trap_Effect_Finished;
}

function trapeffect_anti_magic(
    mtmp,
    trap,
    trflags) { /* int */
    if (wearing_iron_shoes(mtmp)) {
        let shoes = which_armor(mtmp, W_ARMF);
        /* iron shoes protect against antimagic traps only if
           positively enchanted; the trap drains the enchantment
           rather than the wearer */
        if (shoes.spe > 0) {
            /* no message if a monster does this, it isn't visible enough */
            if (mtmp == gy.youmonst) {
                seetrap(trap);
                pline(_("A lethargic aura surrounds %s."), yname(shoes));
                costly_alteration(shoes, COST_DECHNT);
            }
            shoes.spe -= 1;
            update_inventory();
            return Trap_Effect_Finished;
        }
    }

    if (mtmp == gy.youmonst) {
        let drain, halfd;
        let exclaim_it = FALSE;

        seetrap(trap);
        if (Antimagic()) {
            let otmp;
            let dmgval2 = rnd(4), hp = Upolyd() ? u.mh : u.uhp;

            /* Half_XXX_damage has opposite its usual effect (approx)
               but isn't cumulative if hero has more than one */
            if (Half_physical_damage() || Half_spell_damage())
                dmgval2 += rnd(4);
            /* give Magicbane wielder dose of own medicine */
            if (u_wield_art(ART_MAGICBANE))
                dmgval2 += rnd(4);
            /* having an artifact--other than own quest one--which
               confers magic resistance simply by being carried
               also increases the effect */
            for (otmp = gi.invent; otmp; otmp = otmp.nobj)
                if (otmp.oartifact && !is_quest_artifact(otmp)
                    && defends_when_carried(AD_MAGM, otmp))
                    break;
            if (otmp)
                dmgval2 += rnd(4);
            if (Passes_walls())
                dmgval2 = Math.trunc((dmgval2 + 3) / 4);

            You_feel((dmgval2 >= hp) ? _("unbearably torpid!")
                     : (dmgval2 >= Math.trunc(hp / 4)) ? _("very lethargic.")
                       : _("sluggish."));
            /* opposite of magical explosion */
            losehp(dmgval2, _("anti-magic implosion"), KILLED_BY_AN);
        }

        /* if the drain amount is more than hero's maximum energy then up
           to half of the amount comes directly out of maximum, the rest
           comes out of current energy; drain_en() lowers the current
           amount and when doing so it will take even more from maximum
           if the new current value would drop below zero */
        drain = d(2, 6); /* 2d6 => 2..12 */
        halfd = rnd(Math.trunc(drain / 2)); /* 1..drain/2 (round down) */
        if (u.uenmax > drain) { /* [was u.uenmax > halfd] */
            /* note: since 'halfd' is no more than half, 'drain -= halfd'
               is at least as big, so drain_en() is never asked to remove
               less from current than what we're removing from maximum;
               however, it might do that anyway (via its throttle check) so
               it needs to make sure uen doesn't end up exceeding uenmax */
            u.uenmax -= halfd; /* drain_en() will set context.botl */
            drain -= halfd;
            exclaim_it = TRUE;
        }
        drain_en(drain, exclaim_it);
    } else {
        let trapkilled = FALSE;
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let see_it = cansee(mtmp.mx, mtmp.my);
        let mptr = mtmp.data;

        /* similar to hero's case, more or less */
        if (!resists_magm(mtmp)) { /* lose spell energy */
            if (!mtmp.mcan && (attacktype(mptr, AT_MAGC)
                                || attacktype(mptr, AT_BREA))) {
                mtmp.mspec_used += d(2, 6);
                if (in_sight) {
                    seetrap(trap);
                    pline_mon(mtmp, _("%s seems lethargic."),
                              Monnam(mtmp));
                }
            }
        } else { /* take some damage */
            let otmp;
            let dmgval2 = rnd(4);

            if ((otmp = MON_WEP(mtmp)) != null
                && is_art(otmp, ART_MAGICBANE))
                dmgval2 += rnd(4);
            for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
                if (otmp.oartifact
                    && defends_when_carried(AD_MAGM, otmp))
                    break;
            if (otmp)
                dmgval2 += rnd(4);
            if (passes_walls(mptr))
                dmgval2 = Math.trunc((dmgval2 + 3) / 4);

            if (in_sight)
                seetrap(trap);
            mtmp.mhp -= dmgval2;
            if (DEADMONSTER(mtmp))
                monkilled(mtmp,
                          in_sight
                          ? _("compression from an anti-magic field")
                          : 0,
                          -AD_MAGM);
            if (DEADMONSTER(mtmp))
                trapkilled = TRUE;
            if (see_it)
                newsym(trap.tx, trap.ty);
        }
        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
}

function trapeffect_poly_trap(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    if (mtmp == gy.youmonst) {
        let viasitting = +((trflags & VIASITTING) != 0);
        let steed_article = ARTICLE_THE;
        let verbbuf = stack_array(char, BUFSZ);

        /* suppress article in various steed messages when using its
           name (which won't occur when hallucinating) */
        if (u.usteed && has_mgivenname(u.usteed) && !Hallucination())
            steed_article = ARTICLE_NONE;

        seetrap(trap);
        if (viasitting)
            strcpy(verbbuf, _("trigger")); /* follows "You sit down." */
        else if (u.usteed)
            sprintf(verbbuf, _("lead %s onto"), x_monnam(u.usteed, steed_article, 0,
                             SUPPRESS_SADDLE, FALSE));
        else
            sprintf(verbbuf, _("%s onto"), u_locomotion(_("step")))
;
        You(_("%s a polymorph trap!"), verbbuf);
        if (wearing_iron_shoes(mtmp)) {
            deltrap(trap);
            pline(_("%s warps strangely."), Yname2(uarmf));
            poly_obj(
                uarmf, uarmf.otyp == IRON_SHOES ? KICKING_BOOTS : IRON_SHOES);
            update_inventory();
            if (uarmf)
                prinv(0, uarmf, 0);
        } else if (Antimagic() || Unchanging()) {
            shieldeff(u.ux, u.uy);
            You_feel(_("momentarily different."));
            /* Trap did nothing; don't remove it --KAA */
        } else {
            steedintrap(trap, null);
            deltrap(trap);      /* delete trap before polymorph */
            newsym(u.ux, u.uy); /* get rid of trap symbol */
            You_feel(_("a change coming over you."));
            polyself(POLY_NOFLAGS);
        }
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);

        if (wearing_iron_shoes(mtmp)) {
            /* remove and readd the shoes to forcibly unwear them */
            let shoes = which_armor(mtmp, W_ARMF);
            extract_from_minvent(mtmp, shoes, TRUE, TRUE);
            if (mpickobj(mtmp, shoes)) {
                impossible(_("re-equipping iron shoes destroyed them?"));
                return Trap_Effect_Finished;
            }
            shoes = poly_obj(
                shoes, shoes.otyp == IRON_SHOES ? KICKING_BOOTS : IRON_SHOES);
            /* now equip them again */
            if (shoes) {
                mtmp.misc_worn_check = or64(mtmp.misc_worn_check, W_ARMF);
                shoes.owornmask = W_ARMF;
                update_mon_extrinsics(mtmp, shoes, TRUE, TRUE);
            }
        } else if (resists_magm(mtmp)) {
            shieldeff_mon(mtmp);
        } else if (!resist(mtmp, WAND_CLASS, 0, NOTELL)) {
            newcham(mtmp, null, NC_SHOW_MSG);
            if (in_sight)
                seetrap(trap);
        }
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

function trapeffect_landmine(
    mtmp,
    trap,
    trflags) { /* int */
    let damage = rnd(16);
    /* iron shoes protect against much of the damage from the
       explosion, but you still take some damage (and wound legs)
       because they can't fully block the blast */
    if (wearing_iron_shoes(mtmp))
        damage = Math.trunc((damage + 3) / 4);

    if (mtmp == gy.youmonst) {
        let already_seen = trap.tseen;
        let forcetrap = +((trflags & FORCETRAP) != 0
                             || (trflags & FAILEDUNTRAP) != 0);
        let forcebungle = +((trflags & FORCEBUNGLE) != 0);
        let steed_mid = 0;
        let saddle = null;

        if ((Levitation() || Flying()) && !forcetrap) {
            if (!already_seen && rn2(3))
                return Trap_Effect_Finished;
            feeltrap(trap);
            pline(_("%s %s in a pile of soil below you."),
                  already_seen ? _("There is") : _("You discover"),
                  trap.madeby_u ? _("the trigger of your mine") : _("a trigger"));
            if (already_seen && rn2(3))
                return Trap_Effect_Finished;
             ;
            pline(_("KAABLAMM!!!  %s %s%s off!"),
                  forcebungle ? _("Your inept attempt sets")
                  : _("The air currents set"),
                  already_seen ? a_your[trap.madeby_u] : _(""),
                  already_seen ? _(" land mine") : _("it"));
        } else {
            /* prevent landmine from killing steed, throwing you to
             * the ground, and then that same landmine affecting you
             * again because it hasn't been deleted yet
             */
            let recursive_mine = static_var("trapeffect_landmine.recursive_mine", schar, FALSE);

            if (recursive_mine[0])
                return Trap_Effect_Finished;
            feeltrap(trap);
            pline(_("KAABLAMM!!!  You triggered %s land mine!"),
                  a_your[trap.madeby_u]);
            if (u.usteed)
                steed_mid = u.usteed.m_id;
            recursive_mine[0] = TRUE;
            steedintrap(trap, null);
            recursive_mine[0] = FALSE;
            saddle = sobj_at(SADDLE, u.ux, u.uy);
            set_wounded_legs(LEFT_SIDE, rn1(35, 41));
            set_wounded_legs(RIGHT_SIDE, rn1(35, 41));
            exercise(A_DEX, FALSE);
        }
        /* add a pit before calling losehp so bones won't keep the landmine;
           blow_up_landmine() will remove pit afterwards if inappropriate */
        trap.ttyp = PIT;
        trap.madeby_u = FALSE;
        losehp(Maybe_Half_Phys(damage), _("land mine"), KILLED_BY_AN);
        blow_up_landmine(trap);
        if (steed_mid && saddle && !u.usteed)
            keep_saddle_with_steedcorpse(steed_mid, fobj(), saddle);
        newsym(u.ux, u.uy); /* update trap symbol */
        /* fall recursively into the pit... */
        if ((trap = t_at(u.ux, u.uy)) != null)
            dotrap(trap, RECURSIVETRAP);
        fill_pit(u.ux, u.uy);
    } else {
        let trapkilled = FALSE;
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let tx = trap.tx, ty = trap.ty;

        /* heavier monsters are more likely to set off a land mine; on the
           other hand, any mon lighter than the trigger weight is immune */

        if (rn2(int(unsigned(mtmp.data.cwt + 1))) < MINE_TRIGGER_WT)
            return Trap_Effect_Finished;
        if (m_in_air(mtmp)) {
            let already_seen = trap.tseen;

            if (in_sight && !already_seen) {
                pline_mon(mtmp,
                     _("A trigger appears in a pile of soil below %s."),
                      mon_nam(mtmp));
                seetrap(trap);
            }
            if (rn2(3))
                return Trap_Effect_Finished;
            if (in_sight) {
                newsym(mtmp.mx, mtmp.my);
                pline_The(_("air currents set %s off!"),
                          already_seen ? _("a land mine") : _("it"));
            }
        } else if (in_sight) {
            newsym(mtmp.mx, mtmp.my);
            pline_mon(mtmp,
                  _("%s%s triggers %s land mine!"),
                  !Deaf() ? _("KAABLAMM!!!  ") : _(""), Monnam(mtmp),
                  a_your[trap.madeby_u]);
        }
        if (!in_sight && !Deaf())
            pline(_("Kaablamm!  %s an explosion in the distance!"),
                  _("You hear"));  /* Deaf-aware */
        blow_up_landmine(trap);
        /* explosion might have destroyed a drawbridge; don't
           dish out more damage if monster is already dead */
        if (DEADMONSTER(mtmp)
            || thitm(0, mtmp, null, damage, FALSE)) {
            trapkilled = TRUE;
        } else {
            /* monsters recursively fall into new pit */
            if (mintrap(mtmp, unsigned(trflags | FORCETRAP)) == Trap_Killed_Mon)
                trapkilled = TRUE;
        }
        /* a boulder may fill the new pit, crushing monster */
        fill_pit(tx, ty); /* thitm may have already destroyed the trap */
        if (DEADMONSTER(mtmp))
            trapkilled = TRUE;
        if (unconscious()) {
            gm.multi = -1;
            gn.nomovemsg = _("The explosion awakens you!");
        }
        return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
            ? Trap_Caught_Mon : Trap_Effect_Finished;
    }
    return Trap_Effect_Finished;
}
export const MINE_TRIGGER_WT = Math.trunc(WT_ELF / 2);

function trapeffect_rolling_boulder_trap(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        let style = ROLL | (trap.tseen ? LAUNCH_KNOWN : 0);

        feeltrap(trap);
        pline(_("%sYou trigger a rolling boulder trap!"),
              !Deaf() ? _("Click!  ") : _(""));
        if (!launch_obj(BOULDER, trap.launch.x, trap.launch.y,
                        trap.vl.v_launch2.x, trap.vl.v_launch2.y, style)) {
            /* if this is a known trap, the player may have known there wasn't
               a lined up boulder, so use a shorter message to avoid --More--
               spam */
            if (style & LAUNCH_KNOWN)
                pline(_("No boulder was released."));
            else
                pline(_("Fortunately for you, no boulder was released."));
        }
    } else {
        if (!m_in_air(mtmp)) {
            let in_sight = (mtmp == u.usteed
                                || (cansee(mtmp.mx, mtmp.my)
                                    && canspotmon(mtmp)) ? 1 : 0);
            let style = ROLL | (in_sight ? 0 : LAUNCH_UNSEEN);
            let trapkilled = FALSE;

            newsym(mtmp.mx, mtmp.my);
            if (in_sight)
                pline_mon(mtmp, _("%s%s triggers %s."),
                      !Deaf() ? _("Click!  ") : _(""), Monnam(mtmp),
                      trap.tseen ? _("a rolling boulder trap") : something());
            if (launch_obj(BOULDER, trap.launch.x, trap.launch.y,
                           trap.vl.v_launch2.x, trap.vl.v_launch2.y, style)) {
                if (in_sight)
                    trap.tseen = TRUE;
                if (DEADMONSTER(mtmp))
                    trapkilled = TRUE;
            }
            return trapkilled ? Trap_Killed_Mon : mtmp.mtrapped
                ? Trap_Caught_Mon : Trap_Effect_Finished;
        }
    }
    return Trap_Effect_Finished;
}

function trapeffect_magic_portal(
    mtmp,
    trap,
    trflags) { /* int */
    if (mtmp == gy.youmonst) {
        feeltrap(trap);
        domagicportal(trap);
    } else {
        return trapeffect_level_telep(mtmp, trap, trflags);
    }
    return Trap_Effect_Finished;
}

function trapeffect_vibrating_square(
    mtmp,
    trap,
    trflags) { /* int */
    const $frame = stack_frame(); try {
    if (mtmp == gy.youmonst) {
        feeltrap(trap);
        /* messages handled elsewhere; the trap symbol is merely to mark the
           square for future reference */
    } else {
        let in_sight = (canseemon(mtmp) || (mtmp == u.usteed) ? 1 : 0);
        let see_it = cansee(mtmp.mx, mtmp.my);

        if (see_it && !Blind()) {
            seetrap(trap); /* before messages */
            if (in_sight) {
                let buf = stack_array(char, BUFSZ), p, monnm = mon_nam(mtmp);

                if (nolimbs(mtmp.data) || m_in_air(mtmp)) {
                    /* just "beneath <mon>" */
                    strcpy(buf, monnm);
                } else {
                    strcpy(buf, s_suffix(monnm));
                    p = eos(strcat(buf, _(" ")));
                    strcpy(p, makeplural(mbodypart(mtmp, FOOT)));
                    /* avoid "beneath 'rear paws'" or 'rear hooves' */
                    strsubst(p, _("rear "), _(""));
                }
                You_see(_("a strange vibration beneath %s."), buf);
            } else {
                /* notice something (hearing uses a larger threshold
                   for 'nearby') */
                You_see(_("the ground vibrate %s."),
                        (mdistu(mtmp) <= 2 * 2)
                           ? _("nearby") : _("in the distance"));
            }
        }
    }
    return Trap_Effect_Finished;
    } finally { stack_pop($frame); }
}

/*
 * for PR#259 - paranoid_confirm:trap
 *
 * Will a monster suffer any adverse effects from a certain trap?
 * Note: does NOT mean "will a monster trigger a trap in the first place",
 * though if it won't that does imply that they'll not suffer adverse effects.
 * For example, an elf is considered immune to sleeping gas traps even though
 * they'll set the trap off.
 * Return value:
 *  TRAP_NOT_IMMUNE = not immune at the moment;
 *  TRAP_CLEARLY_IMMUNE = obviously immune (if player is polymorphed, assume
 *    they know which traps they are immune to in their current form);
 *  TRAP_HIDDEN_IMMUNE = immune but in non-obvious way such as an unidentified
 *    item or hidden intrinsic providing a resistance; the player should still
 *    be warned of this trap, while monsters implicitly know they're immune.
 */
export function immune_to_trap(mon, ttype) { /* int */
    let pm;
    let obj;
    let is_you;

    if (!mon) {
        impossible(_("immune_to_trap: null monster"));
        return TRAP_NOT_IMMUNE;
    }
    pm = mon.data;
    is_you = +(mon == gy.youmonst);

    switch (ttype) {
    case ARROW_TRAP:
    case DART_TRAP:
    case ROCKTRAP:
        /* can hit anything; even noncorporeal monsters might get a blessed
           projectile */
        return TRAP_NOT_IMMUNE;
    case BEAR_TRAP:
        if (pm.msize <= MZ_SMALL
            || amorphous(pm) || is_whirly(pm) || unsolid(pm))
            return TRAP_CLEARLY_IMMUNE;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case SQKY_BOARD:
    case LANDMINE:
    case ROLLING_BOULDER_TRAP:
    case HOLE:
    case TRAPDOOR:
    case PIT:
    case SPIKED_PIT:
        /* ground-based traps, which can be evaded by levitation, flying, or
           hanging to the ceiling */
        if (Sokoban() && (is_pit(ttype) || is_hole(ttype)))
            return TRAP_NOT_IMMUNE;
        if (In_sokoban(u.uz) && ttype == ROLLING_BOULDER_TRAP)
            return TRAP_CLEARLY_IMMUNE; /* not dangerous in Sokoban */
        if (is_floater(pm) || is_flyer(pm)
            || (is_clinger(pm) && has_ceiling(u.uz)))
            return TRAP_CLEARLY_IMMUNE;
        else if (is_you && (Levitation() || Flying()))
            return TRAP_CLEARLY_IMMUNE;
        return TRAP_NOT_IMMUNE;
    case SLP_GAS_TRAP:
        if (breathless(pm))
            return TRAP_CLEARLY_IMMUNE;
        else if (!is_you && resists_sleep(mon))
            return TRAP_CLEARLY_IMMUNE;
        else if (is_you && Sleep_resistance())
            return TRAP_HIDDEN_IMMUNE;
        return TRAP_NOT_IMMUNE;
    case LEVEL_TELEP:
    case TELEP_TRAP:
        /* consider unintended teleporting to be an adverse effect; if in
           the endgame or carrying the Amulet, the teleport trap won't work
           anyway, so anything hitting it is immune. */
        if (In_endgame(u.uz) || mon_has_amulet(mon))
            return TRAP_CLEARLY_IMMUNE;
        return TRAP_NOT_IMMUNE;
    case POLY_TRAP:
        if (resists_magm(mon))
            /* covers Antimagic for player */
            return (is_you ? TRAP_HIDDEN_IMMUNE : TRAP_CLEARLY_IMMUNE);
        return TRAP_NOT_IMMUNE;
    case STATUE_TRAP:
        /* no effect on monsters, only affects players; only trap detection
           can let player know that this is a statue trap there ahead of time;
           in the rare case this happens, do consider it an adverse effect */
        if (!is_you)
            return TRAP_CLEARLY_IMMUNE;
        return TRAP_NOT_IMMUNE;
    case WEB:
        /* most of this code is lifted from mu_maybe_destroy_web */
        if (webmaker(pm) || amorphous(pm) || is_whirly(pm) || flaming(pm)
            || unsolid(pm) || pm == mons[PM_GELATINOUS_CUBE])
            return TRAP_CLEARLY_IMMUNE;
        return TRAP_NOT_IMMUNE;
    case ANTI_MAGIC:
        /* doesn't hurt any non-magic-resistant monster with no magic */
        if (is_you) {
            if (Antimagic())
                return TRAP_NOT_IMMUNE;
            else if (u.uenmax == 0)
                /* player won't lose HP and can't lose more Pw */
                return TRAP_HIDDEN_IMMUNE;

        /* following conditional lifted from mintrap ANTI_MAGIC logic */
        } else if (!resists_magm(mon)
                   && (mon.mcan || (!attacktype(pm, AT_MAGC)
                                     && !attacktype(pm, AT_BREA)))) {
            return TRAP_CLEARLY_IMMUNE;
        }
        return TRAP_NOT_IMMUNE;
    case RUST_TRAP:
        /* harmful if wearing anything rustable or if mon is an iron golem */
        if (pm == mons[PM_IRON_GOLEM])
            return TRAP_NOT_IMMUNE;

        for (obj = is_you ? gi.invent : mon.minvent; obj; obj = obj.nobj) {
            /* rust traps can currently hit only worn armor and weapons */
            if (is_rustprone(obj) && obj.owornmask) {
                if (is_you && (obj == uquiver
                               || (obj == uswapwep && !u.twoweap)))
                    continue;
                return TRAP_NOT_IMMUNE;
            }
        }
        return TRAP_CLEARLY_IMMUNE;
    case MAGIC_TRAP:
        /* for player, any number of bad effects;
           for monsters, only replicates fire trap, so fall through */
        if (is_you)
            return TRAP_NOT_IMMUNE;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case FIRE_TRAP: /* can always destroy items being carried */
        /* harmful if not resistant or if carrying anything that could burn */
        if (is_you ? !Fire_resistance() : !resists_fire(mon))
            return TRAP_NOT_IMMUNE;

        for (obj = is_you ? gi.invent : mon.minvent; obj; obj = obj.nobj) {
            if (obj.oclass == SCROLL_CLASS || obj.oclass == POTION_CLASS
                || obj.oclass == SPBOOK_CLASS
                || (obj.owornmask && is_flammable(obj))) {
                if ((obj.otyp == SCR_FIRE || obj.otyp == SPE_FIREBALL)
                    /* mon knows scroll of fire or spellbook of fireball
                       won't be affected; hero knows iff this one has been
                       seen and its type has been discovered */
                    && (!is_you
                        || (obj.dknown && objects[obj.otyp].oc_name_known)))
                    continue;
                return TRAP_NOT_IMMUNE;
            }
        }
        return (is_you ? TRAP_HIDDEN_IMMUNE : TRAP_CLEARLY_IMMUNE);
    case MAGIC_PORTAL:
        /* never hurts anything, but player is considered non-immune so they
           can be asked about entering it */
        if (!is_you)
            return TRAP_CLEARLY_IMMUNE;
        return TRAP_NOT_IMMUNE;
    case VIBRATING_SQUARE:
        /* no adverse effects */
        return TRAP_CLEARLY_IMMUNE;
    default:
        impossible(_("immune_to_trap: bad ttype %u"), ttype);
        break;
    }
    return TRAP_NOT_IMMUNE;
}

function trapeffect_selector(
    mtmp,
    trap,
    trflags) { /* int */
    switch (trap.ttyp) {
    case ARROW_TRAP:
        return trapeffect_arrow_trap(mtmp, trap, trflags);
    case DART_TRAP:
        return trapeffect_dart_trap(mtmp, trap, trflags);
    case ROCKTRAP:
        return trapeffect_rocktrap(mtmp, trap, trflags);
    case SQKY_BOARD:
        return trapeffect_sqky_board(mtmp, trap, trflags);
    case BEAR_TRAP:
        return trapeffect_bear_trap(mtmp, trap, trflags);
    case SLP_GAS_TRAP:
        return trapeffect_slp_gas_trap(mtmp, trap, trflags);
    case RUST_TRAP:
        return trapeffect_rust_trap(mtmp, trap, trflags);
    case FIRE_TRAP:
        return trapeffect_fire_trap(mtmp, trap, trflags);
    case PIT:
    case SPIKED_PIT:
        return trapeffect_pit(mtmp, trap, trflags);
    case HOLE:
    case TRAPDOOR:
        return trapeffect_hole(mtmp, trap, trflags);
    case LEVEL_TELEP:
        return trapeffect_level_telep(mtmp, trap, trflags);
    case MAGIC_PORTAL:
        return trapeffect_magic_portal(mtmp, trap, trflags);
    case TELEP_TRAP:
        return trapeffect_telep_trap(mtmp, trap, trflags);
    case WEB:
        return trapeffect_web(mtmp, trap, trflags);
    case STATUE_TRAP:
        return trapeffect_statue_trap(mtmp, trap, trflags);
    case MAGIC_TRAP:
        return trapeffect_magic_trap(mtmp, trap, trflags);
    case ANTI_MAGIC:
        return trapeffect_anti_magic(mtmp, trap, trflags);
    case LANDMINE:
        return trapeffect_landmine(mtmp, trap, trflags);
    case POLY_TRAP:
        return trapeffect_poly_trap(mtmp, trap, trflags);
    case ROLLING_BOULDER_TRAP:
        return trapeffect_rolling_boulder_trap(mtmp, trap, trflags);
    case VIBRATING_SQUARE:
        return trapeffect_vibrating_square(mtmp, trap, trflags);
    default:
        impossible(_("%s encountered a strange trap of type %d."),
                   (mtmp == gy.youmonst) ? _("You") : _("Some monster"),
                   trap.ttyp);
    }
    return Trap_Effect_Finished;
}

export function dotrap(trap, trflags) { /* void */
    let ttype = trap.ttyp;
    let already_seen = trap.tseen,
            forcetrap = +((trflags & FORCETRAP) != 0
                         || (trflags & FAILEDUNTRAP) != 0),
            forcebungle = +((trflags & FORCEBUNGLE) != 0),
            plunged = +((trflags & TOOKPLUNGE) != 0),
            conj_pit = conjoined_pits(trap, t_at(u.ux0, u.uy0), TRUE),
            adj_pit = adj_nonconjoined_pit(trap);

    nomul(0);

    if (fixed_tele_trap(trap)) {
        trflags = unsigned(trflags | FORCETRAP);
        forcetrap = TRUE;
    }

    /* KMH -- You can't escape the Sokoban level traps */
    if (Sokoban() && (is_pit(ttype) || is_hole(ttype))) {
        /* The "air currents" message is still appropriate -- even when
         * the hero isn't flying or levitating -- because it conveys the
         * reason why the player cannot escape the trap with a dexterity
         * check, clinging to the ceiling, etc.
         */
        pline(_("Air currents pull you down into %s %s!"),
              a_your[trap.madeby_u],
              trapname(ttype, TRUE)); /* do force "pit" while hallucinating */
        /* then proceed to normal trap effect */
    } else if (!forcetrap) {
        if (floor_trigger(ttype) && check_in_air(gy.youmonst, trflags)) {
            if (already_seen) {
                You(_("%s over %s %s."), u_locomotion(_("step")),
                    (ttype == ARROW_TRAP && !trap.madeby_u)
                    ? _("an") : a_your[trap.madeby_u],
                    trapname(ttype, FALSE));
            }
            return;
        }
        if (already_seen && !Fumbling() && !undestroyable_trap(ttype)
            && ttype != ANTI_MAGIC && !forcebungle && !plunged
            && !conj_pit && !adj_pit
            && (!rn2(5) || (is_pit(ttype) && is_clinger(gy.youmonst.data)))) {
                You(_("escape %s %s."), (ttype == ARROW_TRAP && !trap.madeby_u)
                                     ? _("an")
                                     : a_your[trap.madeby_u],
                trapname(ttype, FALSE));
            return;
        }
    }

    if (u.usteed)
        mon_learns_traps(u.usteed, ttype);
    mons_see_trap(trap);

    /*
     * Note:
     *  Most references to trap types here don't use trapname() for
     *  hallucination.  This could be considered to be a bug but doing
     *  that would hide the actual trap situation from the player which
     *  would be somewhat harsh for what's usually a minor impairment.
     */

    trapeffect_selector(gy.youmonst, trap, trflags);
}

function trapnote(trap, noprefix) { /* char * */
    let tnnames = static_array("trapnote.tnnames", ptr_to(char), null, [
        _("C note"),  _("D flat"), _("D note"),  _("E flat"),
        _("E note"),  _("F note"), _("F sharp"), _("G note"),
        _("G sharp"), _("A note"), _("B flat"),  _("B note"),
    ]);
    let tnbuf = static_array("trapnote.tnbuf", char, 12); /* result buffer */
    let tn;

    chars[tnbuf + 0] = ord('\0');
    tn = tnnames[trap.vl.v_tnote];
    if (!noprefix)
        just_an(tnbuf, tn);
    return strcat(tnbuf, tn);
}

/* choose a note not used by any trap on current level,
   ignoring ttmp; if all are in use, pick a random one */
function choose_trapnote(ttmp) { /* int */
    const $frame = stack_frame(); try {
    let tavail = stack_array(int, 12), tpick = stack_array(int, 12), tcnt = 0, k;
    let t;

    for (k = 0; k < 12; ++k)
        tavail[k] = tpick[k] = 0;
    for (t = gf.ftrap; t; t = t.ntrap)
        if (t.ttyp == SQKY_BOARD && t != ttmp)
            tavail[t.vl.v_tnote] = 1;
    /* now populate tpick[] with the available indices */
    for (k = 0; k < 12; ++k)
        if (tavail[k] == 0)
            tpick[tcnt++] = k;
    /* choose an unused note; if all are in use, pick a random one */
    return ((tcnt > 0) ? tpick[rn2(tcnt)] : rn2(12));
    } finally { stack_pop($frame); }
}

function steedintrap(trap, otmp) { /* int */
    let steed = u.usteed;
    let tt;
    let trapkilled, steedhit;

    if (!steed || !trap)
        return Trap_Effect_Finished;
    tt = trap.ttyp;
    steed.mx = u.ux;
    steed.my = u.uy;
    trapkilled = steedhit = FALSE;

    switch (tt) {
    case ARROW_TRAP:
        if (!otmp) {
            impossible(_("steed hit by non-existent arrow?"));
            return Trap_Effect_Finished;
        }
        trapkilled = thitm(8, steed, otmp, 0, FALSE);
        steedhit = TRUE;
        break;
    case DART_TRAP:
        if (!otmp) {
            impossible(_("steed hit by non-existent dart?"));
            return Trap_Effect_Finished;
        }
        trapkilled = thitm(7, steed, otmp, 0, FALSE);
        steedhit = TRUE;
        break;
    case SLP_GAS_TRAP:
        if (!resists_sleep(steed) && !breathless(steed.data)
            && !helpless(steed)) {
            if (sleep_monst(steed, rnd(25), -1))
                /* no in_sight check here; you can feel it even if blind */
                pline(_("%s suddenly falls asleep!"), Monnam(steed));
        }
        steedhit = TRUE;
        break;
    case LANDMINE:
        trapkilled = thitm(0, steed, null, rnd(16), FALSE);
        steedhit = TRUE;
        break;
    case PIT:
    case SPIKED_PIT:
        trapkilled = (DEADMONSTER(steed)
                      || thitm(0, steed, null,
                               rnd((tt == PIT) ? 6 : 10), FALSE) ? 1 : 0);
        steedhit = TRUE;
        break;
    case POLY_TRAP:
        if (!resists_magm(steed) && !resist(steed, WAND_CLASS, 0, NOTELL)) {
            /* newcham() will probably end up calling poly_steed() */
            newcham(steed, null, NC_SHOW_MSG);
        }
        steedhit = TRUE;
        break;
    default:
        break;
    }

    if (trapkilled) {
        dismount_steed(DISMOUNT_POLY);
        return Trap_Killed_Mon;
    }
    return steedhit ? 1 : 0;
}

/* some actions common to both player and monsters for triggered landmine */
export function blow_up_landmine(trap) { /* void */
    const $frame = stack_frame(); try {
    let x = trap.tx, y = trap.ty, dbx = stack_var(coordxy), dby = stack_var(coordxy);
    let lev = levl()[x][y];
    let old_typ, typ;

    old_typ = lev.typ;
    scatter(x, y, 4,
                   MAY_DESTROY | MAY_HIT | MAY_FRACTURE | VIS_EFFECTS,
                   null);
    del_engr_at(x, y);
    wake_nearto(x, y, 400);
    if (IS_DOOR(lev.typ))
        lev.flags = D_BROKEN;
    /* destroy drawbridge if present */
    if (lev.typ == DRAWBRIDGE_DOWN || is_drawbridge_wall(x, y) >= 0) {
        dbx[0] = x, dby[0] = y;
        /* if under the portcullis, the bridge is adjacent */
        if (find_drawbridge(dbx, dby))
            destroy_drawbridge(dbx[0], dby[0]);
    }
    trap = t_at(x, y); /* expected to be null after destruction */
    /* or could be null if scatter blew up oil which melted ice */
    /* convert landmine into pit */
    if (trap) {
        if (Is_waterlevel(u.uz) || Is_airlevel(u.uz)) {
            /* no pits here */
            deltrap(trap);
        } else {
            /* fill pit with water, if applicable */
            typ = fillholetyp(x, y, FALSE);
            if (typ != ROOM) {
                lev.typ = typ;
                liquid_flow(x, y, typ, trap,
                            cansee(x, y) ? _("The hole fills with %s!")
                                         : 0);
            } else {
                trap.ttyp = PIT;       /* explosion creates a pit */
                trap.madeby_u = FALSE; /* resulting pit isn't yours */
                seetrap(trap);          /* and it isn't concealed */
            }
        }
    }
    fill_pit(x, y);
    maybe_dunk_boulders(x, y);
    recalc_block_point(x, y);
    spot_checks(x, y, old_typ);
    } finally { stack_pop($frame); }
}

function launch_drop_spot(obj, x, y) { /* void */
    if (!obj) {
        gl.launchplace.obj = null;
        gl.launchplace.x = 0;
        gl.launchplace.y = 0;
    } else {
        gl.launchplace.obj = obj;
        gl.launchplace.x = x;
        gl.launchplace.y = y;
    }
}

export function launch_in_progress() { /* boolean */
    if (gl.launchplace.obj)
        return TRUE;
    return FALSE;
}

export function force_launch_placement() { /* void */
    if (gl.launchplace.obj) {
        gl.launchplace.obj.otrapped = 0;
        place_object(gl.launchplace.obj, gl.launchplace.x, gl.launchplace.y);
    }
}

/*
 * Move obj from (x1,y1) to (x2,y2)
 *
 * Return 0 if no object was launched.
 *        1 if an object was launched and placed somewhere.
 *        2 if an object was launched, but used up.
 */
export function launch_obj(
    otyp,
    x1, y1,
    x2, y2,
    style) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var singleobj = stack_var(ptr_to(struct_obj)), dest = stack_struct(struct_d_level);
    var mtmp;
    var otmp, otmp2;
    var dx, dy;
    var x, y;

    var used_up = FALSE, otherside = FALSE;
    var dist, tmp, delaycnt = 0;

    otmp = sobj_at(otyp, x1, y1);
    /* Try the other side too, for rolling boulder traps */
    if (!otmp && otyp == BOULDER) {
        otherside = TRUE;
        otmp = sobj_at(otyp, x2, y2);
    }
    if (!otmp)
        return 0;
    if (otherside) { /* swap 'em */
        var tx, ty;

        tx = x1;
        ty = y1;
        x1 = x2;
        y1 = y2;
        x2 = tx;
        y2 = ty;
    }

    if (otmp.quan == 1) {
        obj_extract_self(otmp);
        maybe_unhide_at(otmp.ox, otmp.oy);
        singleobj[0] = otmp;
        otmp = null;
    } else {
        singleobj[0] = splitobj(otmp, 1);
        obj_extract_self(singleobj[0]);
    }
    newsym(x1, y1);
    /* in case you're using a pick-axe to chop the boulder that's being
       launched (perhaps a monster triggered it), destroy context so that
       the next dig attempt never thinks that you're resuming
       the previous effort */
    if ((otyp == BOULDER || otyp == STATUE)
        && singleobj[0].ox == svc.context.digging.pos.x
        && singleobj[0].oy == svc.context.digging.pos.y)
        memset(addr_of(svc.context.digging), 0,
                      sizeof(struct_dig_info));

    dist = distmin(x1, y1, x2, y2);
    x = gb.bhitpos.x = x1;
    y = gb.bhitpos.y = y1;
    dx = sgn(x2 - x1);
    dy = sgn(y2 - y1);
    $goto_roll: for (;;) { switch ($goto || (style)) {
    case ROLL | LAUNCH_UNSEEN:
        if (otyp == BOULDER) {
            if (cansee(x1, y1)) {
                You_see(_("%s start to roll."), an(xname(singleobj[0])));
            } else if (Hallucination()) {
                 ;
                You_hear(_("someone bowling."));
            } else {
                 ;
                You_hear(_("rumbling %s."), (distu(x1, y1) <= 4 * 4) ? _("nearby")
                                           : _("in the distance"));
            }
        }
        style &= ~LAUNCH_UNSEEN;
        { $goto = "roll"; continue $goto_roll; }
    case ROLL | LAUNCH_KNOWN:
        /* use otrapped as a flag to ohitmon */
        singleobj[0].otrapped = 1;
        style &= ~LAUNCH_KNOWN;
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case "roll": case ROLL:
 $goto = null;
        delaycnt = 2;
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    default:
        if (!delaycnt)
            delaycnt = 1;
        if (!cansee(x, y))
            curs_on_u();
        tmp_at(DISP_FLASH, obj_to_glyph(singleobj[0], rn2_on_display_rng));
        tmp_at(x, y);
    } break; }
    /* Mark a spot to place object in bones files to prevent
     * loss of object. Use the starting spot to ensure that
     * a rolling boulder will still launch, which it wouldn't
     * do if left midstream. Unfortunately we can't use the
     * target resting spot, because there are some things/situations
     * that would prevent it from ever getting there (bars), and we
     * can't tell that yet.
     */
    launch_drop_spot(singleobj[0], x, y);

    /* Set the object in motion */
    while (dist-- > 0 && !used_up) {
        var t;

        tmp_at(x, y);
        tmp = delaycnt;

        /* dstage@u.washington.edu -- Delay only if hero sees it */
        if (cansee(x, y))
            while (tmp-- > 0)
                nh_delay_output()();

        /*
         * TEMPORARY?  github issue #1490 by BartekCupial reports a
         * segfault when boulder rolls out of bounds.  That should be
         * impossible because trap creation validates the path that
         * the boulder will traverse.
         *
         * The suggested fix increments bhitpos, verifies with isok(),
         * then undoes the increment if not ok.  This is simpler.
         */
        if (!isok(gb.bhitpos.x + dx, gb.bhitpos.y + dy)) {
            x2 = x, y2 = y; /* use current spot for final boulder placement */
            break;
        }
        /*
         * end TEMPORARY?
         */

        x = (gb.bhitpos.x += dx);
        y = (gb.bhitpos.y += dy);

        if ((mtmp = m_at(x, y)) != null) {
            if (otyp == BOULDER && throws_rocks(mtmp.data)) {
                if (rn2(3)) {
                    if (cansee(x, y))
                        pline_mon(mtmp, _("%s snatches the boulder."),
                                  Monnam(mtmp));
                    singleobj[0].otrapped = 0;
                    mpickobj(mtmp, singleobj[0]);
                    used_up = TRUE;
                    launch_drop_spot(null, 0, 0);
                    break;
                }
            }
            if (ohitmon(mtmp, singleobj[0], (style == ROLL) ? -1 : dist,
                        FALSE)) {
                used_up = TRUE;
                launch_drop_spot(null, 0, 0);
                break;
            }
        } else if (u_at(x, y)) {
            var dam = dmgval(singleobj[0], gy.youmonst);

            if (gm.multi)
                nomul(0);
            if (thitu(9 + singleobj[0].spe, Maybe_Half_Phys(dam),
                      singleobj, 0))
                stop_occupation();
        }
        if (style == ROLL) {
            if (down_gate(x, y) != -1) {
                if (ship_object(singleobj[0], x, y, FALSE)) {
                    used_up = TRUE;
                    launch_drop_spot(null, 0, 0);
                    break;
                }
            }
            if ((t = t_at(x, y)) != null
                && otyp == BOULDER) {
                var newlev = 0;

                switch (t.ttyp) {
                case LANDMINE:
                    if (rn2(10) > 2) {
                        if (cansee(x, y))
                            set_msg_xy(x, y);
                        pline(_("KAABLAMM!!!%s"),
                              cansee(x, y)
                               ? _("  The rolling boulder triggers a land mine.")
                               : _(""));
                        deltrap(t);
                        del_engr_at(x, y);
                        place_object(singleobj[0], x, y);
                        singleobj[0].otrapped = 0;
                        fracture_rock(singleobj[0]);
                        scatter(x, y, 4,
                                       MAY_DESTROY | MAY_HIT | MAY_FRACTURE
                                           | VIS_EFFECTS,
                                       null);
                        if (cansee(x, y))
                            newsym(x, y);
                        used_up = TRUE;
                        launch_drop_spot(null, 0, 0);
                    }
                    break;
                case LEVEL_TELEP:
                    /* 20% chance of picking current level; 100% chance for
                       that if in single-level branch (Knox) or in endgame */
                    newlev = random_teleport_level();
                    /* if trap doesn't work, skip "disappears" message */
                    if (newlev == depth(u.uz))
                        break;
                    /* FALLTHROUGH */;
                    /*FALLTHRU*/
                case TELEP_TRAP:
                    if (cansee(x, y))
                        pline_xy(x, y,
                                 _("Suddenly the rolling boulder disappears!"));
                    else if (!Deaf())
                        You_hear(_("a rumbling stop abruptly."));
                    singleobj[0].otrapped = 0;
                    if (t.ttyp == TELEP_TRAP) {
                        rloco(singleobj[0]);
                    } else {
                        add_to_migration(singleobj[0]);
                        get_level(dest, newlev);
                        singleobj[0].ox = dest.dnum;
                        singleobj[0].oy = dest.dlevel;
                        singleobj[0].owornmask = MIGR_RANDOM;
                    }
                    seetrap(t);
                    used_up = TRUE;
                    launch_drop_spot(null, 0, 0);
                    break;
                case PIT:
                case SPIKED_PIT:
                case HOLE:
                case TRAPDOOR:
                    /* the boulder won't be used up if there is a
                       monster in the trap; stop rolling anyway */
                    x2 = x, y2 = y; /* stops here */
                    if (flooreffects(singleobj[0], x2, y2, _("fall"))) {
                        used_up = TRUE;
                        launch_drop_spot(null, 0, 0);
                    }
                    dist = -1; /* stop rolling immediately */
                    break;
                default:
                    break;
                }

                if (used_up || dist == -1)
                    break; /* from 'while' loop */
            }
            if (flooreffects(singleobj[0], x, y, _("fall"))) {
                used_up = TRUE;
                launch_drop_spot(null, 0, 0);
                break;
            }
            if (otyp == BOULDER && (otmp2 = sobj_at(BOULDER, x, y)) != null) {
                var bmsg = _(" as one boulder sets another in motion");
                var fx = x + dx, fy = y + dy;

                if (!isok(fx, fy) || !dist || IS_OBSTRUCTED(levl()[fx][fy].typ))
                    bmsg = _(" as one boulder hits another");

                 ;
                You_hear(_("a loud crash%s!"), cansee(x, y) ? bmsg : _(""));
                obj_extract_self(otmp2);
                /* pass off the otrapped flag to the next boulder */
                otmp2.otrapped = singleobj[0].otrapped;
                singleobj[0].otrapped = 0;
                place_object(singleobj[0], x, y);
                singleobj[0] = otmp2;
                otmp2 = null;
                wake_nearto(x, y, 10 * 10);
            }
        }
        if (otyp == BOULDER && closed_door(x, y)) {
            if (cansee(x, y)) {
                set_msg_xy(x, y);
                pline_The(_("boulder crashes through a door."));
            }
            levl()[x][y].flags = D_BROKEN;
            if (dist)
                recalc_block_point(x, y);
        }

        /* if about to hit something, do so now */
        if (dist > 0 && isok(x + dx, y + dy)) {
            var fx = x + dx, fy = y + dy;
            var typ = uchar(levl()[fx][fy].typ);

            if (typ == IRONBARS) {
                x2 = x, y2 = y; /* object stops here */
                if (hits_bars(singleobj, x2, y2, fx, fy, +!rn2(20), 0)) {
                    if (!singleobj[0]) {
                        used_up = TRUE;
                        launch_drop_spot(null, 0, 0);
                    }
                    break;
                }
            } else if (IS_STWALL(typ) || IS_TREE(typ)) {
                x2 = x, y2 = y; /* object stops here */
                if (!Deaf())
                    pline(_("Thump!"));
                wake_nearto(x2, y2, 16);
                break;
            }
        }
    } /* while dist > 0 */
    tmp_at(DISP_END, 0);
    launch_drop_spot(null, 0, 0);
    if (!used_up) {
        singleobj[0].otrapped = 0;
        place_object(singleobj[0], x2, y2);
        newsym(x2, y2);
        return 1;
    }
    return 2;
    } finally { stack_pop($frame); }
}

export function seetrap(trap) { /* void */
    if (!trap.tseen) {
        trap.tseen = 1;
        newsym(trap.tx, trap.ty);
    }
}

/* like seetrap() but overrides vision */
export function feeltrap(trap) { /* void */
    trap.tseen = 1;
    map_trap(trap, 1);
    /* in case it's beneath something, redisplay the something */
    newsym(trap.tx, trap.ty);
}

/* try to find a random coordinate where launching a rolling boulder
   could work. return TRUE if found, with coordinate in cc. */
function find_random_launch_coord(ttmp, cc) { /* boolean */
    const $frame = stack_frame(); try {
    let tmp;
    let success = FALSE;
    let bcc = init_list(stack_struct(struct_nhcoord), {});
    let distance;
    let mindist = 4;
    let trycount = 0;
    let dx, dy;
    let x, y;

    if (!ttmp || !cc || Sokoban())
        return FALSE;

    x = ttmp.tx;
    y = ttmp.ty;

    bcc.x = ttmp.tx + gl.launchplace.x;
    bcc.y = ttmp.ty + gl.launchplace.y;
    if (isok(bcc.x, bcc.y) && linedup(ttmp.tx, ttmp.ty, bcc.x, bcc.y, 1)) {
        cc.x = bcc.x;
        cc.y = bcc.y;
        return TRUE;
    }

    if (ttmp.ttyp == ROLLING_BOULDER_TRAP)
        mindist = 2;
    distance = rn1(5, 4); /* 4..8 away */
    tmp = rn2(N_DIRS); /* randomly pick a direction to try first */
    while (distance >= mindist) {
        dx = chars[xdir + tmp];
        dy = chars[ydir + tmp];
        cc.x = x;
        cc.y = y;
        /* Prevent boulder from being placed on water */
        if (ttmp.ttyp == ROLLING_BOULDER_TRAP
            && is_pool_or_lava(x + distance * dx, y + distance * dy))
            success = FALSE;
        else
            success = isclearpath(cc, distance, dx, dy);
        if (ttmp.ttyp == ROLLING_BOULDER_TRAP) {
            let success_otherway;

            bcc.x = x;
            bcc.y = y;
            success_otherway = isclearpath(bcc, distance, -dx, -dy);
            if (!success_otherway)
                success = FALSE;
        }
        if (success)
            break;
        if (++tmp > 7)
            tmp = 0;
        if ((++trycount % 8) == 0)
            --distance;
    }
    return success;
    } finally { stack_pop($frame); }
}

function mkroll_launch(
    ttmp,
    x,
    y,
    otyp,
    ocount) { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let cc = init_list(stack_struct(struct_nhcoord), {});
    let success = FALSE;

    success = find_random_launch_coord(ttmp, cc);

    if (!success) {
        /* create the trap without any ammo, launch pt at trap location */
        cc.x = x;
        cc.y = y;
    } else {
        otmp = mksobj(otyp, TRUE, FALSE);
        otmp.quan = ocount;
        otmp.owt = unsigned(weight(otmp));
        place_object(otmp, cc.x, cc.y);
        stackobj(otmp);
    }
    ttmp.launch.x = cc.x;
    ttmp.launch.y = cc.y;
    if (ttmp.ttyp == ROLLING_BOULDER_TRAP) {
        ttmp.vl.v_launch2.x = x - (cc.x - x);
        ttmp.vl.v_launch2.y = y - (cc.y - y);
    } else
        ttmp.vl.v_launch_otyp = otyp;
    newsym(ttmp.launch.x, ttmp.launch.y);
    return 1;
    } finally { stack_pop($frame); }
}

function isclearpath(
    cc,
    distance,
    dx,
    dy) { /* boolean */
    let t;
    let typ;
    let x, y;

    x = cc.x;
    y = cc.y;
    while (distance-- > 0) {
        x += dx;
        y += dy;
        if (!isok(x, y))
            return FALSE;
        typ = uchar(levl()[x][y].typ);
        if (!ZAP_POS(typ) || closed_door(x, y))
            return FALSE;
        if ((t = t_at(x, y)) != null
            && (is_pit(t.ttyp) || is_hole(t.ttyp) || is_xport(t.ttyp)))
            return FALSE;
    }
    cc.x = x;
    cc.y = y;
    return TRUE;
}

/* can monster escape from a pit easily */
function m_easy_escape_pit(mtmp) { /* boolean */
    return +(mtmp.data == mons[PM_PIT_FIEND]
            || mtmp.data.msize >= MZ_HUGE);
}

export function mintrap(mtmp, mintrapflags) { /* int */
    let trap = t_at(mtmp.mx, mtmp.my);
    let mptr = mtmp.data;
    let trap_result = Trap_Effect_Finished;

    if (!trap) {
        mtmp.mtrapped = 0;      /* perhaps teleported? */
    } else if (mtmp.mtrapped) { /* is currently in the trap */
        if (!trap.tseen && cansee(mtmp.mx, mtmp.my) && canseemon(mtmp)
            && (is_pit(trap.ttyp) || trap.ttyp == BEAR_TRAP
                || trap.ttyp == HOLE
                || trap.ttyp == WEB)) {
            /* If you come upon an obviously trapped monster, then
               you must be able to see the trap it's in too. */
            seetrap(trap);
        }

        if (!rn2(40) || (is_pit(trap.ttyp) && m_easy_escape_pit(mtmp))) {
            if (sobj_at(BOULDER, mtmp.mx, mtmp.my)
                && is_pit(trap.ttyp)) {
                if (!rn2(2)) {
                    mtmp.mtrapped = 0;
                    if (canseemon(mtmp))
                        pline_mon(mtmp, _("%s pulls free..."),
                                 Monnam(mtmp));
                    fill_pit(mtmp.mx, mtmp.my);
                }
            } else {
                if (canseemon(mtmp)) {
                    set_msg_xy(mtmp.mx, mtmp.my);
                    if (is_pit(trap.ttyp))
                        pline(_("%s climbs %sout of the pit."), Monnam(mtmp),
                              m_easy_escape_pit(mtmp) ? _("easily ") : _(""));
                    else if (trap.ttyp == BEAR_TRAP || trap.ttyp == WEB)
                        pline(_("%s pulls free of the %s."), Monnam(mtmp),
                              trapname(trap.ttyp, FALSE));
                }
                mtmp.mtrapped = 0;
            }
        } else if (metallivorous(mptr)) {
            if (trap.ttyp == BEAR_TRAP) {
                if (canseemon(mtmp))
                    pline_mon(mtmp, _("%s eats a bear trap!"),
                              Monnam(mtmp));
                deltrap(trap);
                mtmp.meating = 5;
                mtmp.mtrapped = 0;
            } else if (trap.ttyp == SPIKED_PIT) {
                if (canseemon(mtmp))
                    pline_mon(mtmp, _("%s munches on some spikes!"),
                              Monnam(mtmp));
                trap.ttyp = PIT;
                mtmp.meating = 5;
            }
        }
        trap_result = mtmp.mtrapped ? Trap_Caught_Mon : Trap_Effect_Finished;
    } else {
        let tt = trap.ttyp;
        let forcetrap = +((mintrapflags & FORCETRAP) != 0);
        let forcebungle = +((mintrapflags & FORCEBUNGLE) != 0);
        /* monster has seen such a trap before */
        let already_seen = (mon_knows_traps(mtmp, tt)
                                || (tt == HOLE && !mindless(mptr)) ? 1 : 0);

        if (fixed_tele_trap(trap)) {
            mintrapflags = unsigned(mintrapflags | FORCETRAP);
            forcetrap = TRUE;
        }

        if (mtmp == u.usteed) {
            ; /* true when called from dotrap, inescapable is not an option */
        } else if (Sokoban() && (is_pit(tt) || is_hole(tt))
                   && !trap.madeby_u) {
            ; /* nothing here, the trap effects will handle messaging */
        } else if (!forcetrap) {
            if (floor_trigger(tt) && check_in_air(mtmp, mintrapflags)) {
                return Trap_Effect_Finished;
            }
            if (already_seen && rn2(4) && !forcebungle)
                return Trap_Effect_Finished;
        }

        mon_learns_traps(mtmp, tt);
        mons_see_trap(trap);

        /* Monster is aggravated by being trapped by you.
           Recognizing who made the trap isn't completely
           unreasonable; everybody has their own style. */
        if (trap.madeby_u && rnl(5))
            setmangry(mtmp, FALSE);

        trap_result = trapeffect_selector(mtmp, trap, mintrapflags);

        /* mtmp can't stay hiding under an object if trapped in non-pit
           (mtmp hiding under object at armed bear trap location, hero
           zaps wand of locking or spell of wizard lock at spot triggering
           the trap and trapping mtmp there) */
        if (!DEADMONSTER(mtmp) && mtmp.mtrapped) {
            let alreadyspotted = canspotmon(mtmp);

            maybe_unhide_at(mtmp.mx, mtmp.my);
            if (!alreadyspotted && canseemon(mtmp))
                pline_mon(mtmp, _("%s appears."), Amonnam(mtmp));
        }
    }
    return trap_result;
}

/* Combine cockatrice checks into single functions to avoid repeating code. */
export function instapetrify(str) { /* void */
    if (Stone_resistance())
        return;
    if (poly_when_stoned(gy.youmonst.data) && polymon(PM_STONE_GOLEM))
        return;
    urgent_pline(_("You turn to stone..."));
    svk.killer.format = KILLED_BY;
    if (str != svk.killer.name)
        strcpy(svk.killer.name, str ? str : _(""));
    done(STONING);
}

export function minstapetrify(mon, byplayer) { /* void */
    if (resists_ston(mon))
        return;
    if (poly_when_stoned(mon.data)) {
        mon_to_stone(mon);
        return;
    }
    if (!vamp_stone(mon))
        return;

    /* give a "<mon> is slowing down" message and also remove
       intrinsic speed (comparable to similar effect on the hero) */
    mon_adjust_speed(mon, -3, null);

    if (cansee(mon.mx, mon.my))
        pline_mon(mon, _("%s turns to stone."), Monnam(mon));
    if (byplayer) {
        gs.stoned = TRUE;
        xkilled(mon, XKILL_NOMSG);
    } else
        monstone(mon);
}

export function selftouch(arg) { /* void */
    const $frame = stack_frame(); try {
    let kbuf = stack_array(char, BUFSZ);
    let corpse_pmname;

    if (uwep && uwep.otyp == CORPSE && touch_petrifies(mons[uwep.corpsenm])
        && !Stone_resistance()) {
        corpse_pmname = obj_pmname(uwep);
        pline(_("%s touch the %s corpse."), arg, corpse_pmname);
        sprintf(kbuf, _("%s corpse"), an(corpse_pmname));
        instapetrify(kbuf);
        /* life-saved; unwield the corpse if we can't handle it */
        if (!uarmg && !Stone_resistance())
            uwepgone();
    }
    /* Or your secondary weapon, if wielded [hypothetical; we don't
       allow two-weapon combat when either weapon is a corpse] */
    if (u.twoweap && uswapwep && uswapwep.otyp == CORPSE
        && touch_petrifies(mons[uswapwep.corpsenm]) && !Stone_resistance()) {
        corpse_pmname = obj_pmname(uswapwep);
        pline(_("%s touch the %s corpse."), arg, corpse_pmname);
        sprintf(kbuf, _("%s corpse"), an(corpse_pmname));
        instapetrify(kbuf);
        /* life-saved; unwield the corpse */
        if (!uarmg && !Stone_resistance())
            uswapwepgone();
    }
    } finally { stack_pop($frame); }
}

export function mselftouch(
    mon,
    arg,
    byplayer) { /* void */
    let mwep = MON_WEP(mon);

    if (mwep && mwep.otyp == CORPSE && touch_petrifies(mons[mwep.corpsenm])
        && !resists_ston(mon)) {
        if (cansee(mon.mx, mon.my)) {
            pline_mon(mon, _("%s%s touches %s."), arg ? arg : _(""),
                  arg ? mon_nam(mon) : Monnam(mon),
                  corpse_xname(mwep, 0, CXN_PFX_THE));
        }
        minstapetrify(mon, byplayer);
        /* if life-saved, might not be able to continue wielding */
        if (!DEADMONSTER(mon)
            && !which_armor(mon, W_ARMG) && !resists_ston(mon))
            mwepgone(mon);
    }
}

/* start levitating */
export function float_up() { /* void */
    const $frame = stack_frame(); try {
    disp.botl = TRUE;
    if (u.utrap) {
        if (u.utraptype == TT_PIT) {
            reset_utrap(FALSE);
            You(_("float up, out of the %s!"), trapname(PIT, FALSE));
            gv.vision_full_recalc = 1; /* vision limits change */
            fill_pit(u.ux, u.uy);
        } else if (u.utraptype == TT_LAVA /* molten lava */
                   || u.utraptype == TT_INFLOOR) { /* solidified lava */
            Your(_("body pulls upward, but your %s are still stuck."),
                 makeplural(body_part(LEG)));
        } else if (u.utraptype == TT_BURIEDBALL) { /* tethered */
            let cc = stack_struct(struct_nhcoord);

            cc.x = u.ux, cc.y = u.uy;
            /* caveat: this finds the first buried iron ball within
               one step of the specified location, not necessarily the
               buried [former] uball at the original anchor point */
            buried_ball(cc);
            /* being chained to the floor blocks levitation from floating
               above that floor but not from enhancing carrying capacity */
            You(_("feel lighter, but your %s is still chained to the %s."),
                body_part(LEG),
                IS_ROOM(levl()[cc.x][cc.y].typ) ? _("floor") : _("ground"));
        } else if (u.utraptype == WEB) {
            You(_("float up slightly, but you are still stuck in the %s."),
                trapname(WEB, FALSE));
        } else { /* bear trap */
            You(_("float up slightly, but your %s is still stuck."),
                body_part(LEG));
        }
        /* when still trapped, float_vs_flight() below will block levitation */
    } else if (u.uinwater) {
        spoteffects(TRUE);
    } else if (u.uswallow) {
        /* FIXME: this isn't correct for trapper/lurker above */
        if (is_animal(u.ustuck.data))
            You(_("float away from the %s."), surface(u.ux, u.uy));
        else
            You(_("spiral up into %s."), mon_nam(u.ustuck));
    } else if (Hallucination()) {
        pline(_("Up, up, and awaaaay!  You're walking on air!"));
    } else if (Is_airlevel(u.uz)) {
        You(_("gain control over your movements."));
    } else {
        You(_("start to float in the air!"));
    }
    if (u.usteed && !is_floater(u.usteed.data)
        && !is_flyer(u.usteed.data)) {
        if (Lev_at_will()) {
            pline(_("%s magically floats up!"), Monnam(u.usteed));
        } else {
            You(_("cannot stay on %s."), mon_nam(u.usteed));
            dismount_steed(DISMOUNT_GENERIC);
        }
    }
    if (Flying())
        You(_("are no longer able to control your flight."));
    float_vs_flight(); /* set BFlying, also BLevitation if still trapped */
    /* levitation gives maximum carrying capacity, so encumbrance
       state might be reduced */
    encumber_msg();
    return;
    } finally { stack_pop($frame); }
}

/* a boulder fills a pit or a hole at x,y */
export function fill_pit(x, y) { /* void */
    let otmp;
    let t;

    if ((t = t_at(x, y)) != null && (is_pit(t.ttyp) || is_hole(t.ttyp))
        && (otmp = sobj_at(BOULDER, x, y)) != null) {
        obj_extract_self(otmp);
        flooreffects(otmp, x, y, _("settle"));
    }
}

/* stop levitating */
export function float_down(
    hmask,
    emask) { /* int */ /* might cancel timeout */
    const $frame = stack_frame(); try {
    let trap = null;
    let current_dungeon_level = stack_struct(struct_d_level);
    let no_msg = FALSE;

    u.uprops[LEVITATION].intrinsic = and64(u.uprops[LEVITATION].intrinsic, not64(hmask));
    u.uprops[LEVITATION].extrinsic = and64(u.uprops[LEVITATION].extrinsic, not64(emask));
    if (Levitation())
        return 0; /* maybe another ring/potion/boots */
    if (BLevitation()) {
        /* if blocked by terrain, we haven't actually been levitating so
           we don't give any end-of-levitation feedback or side-effects,
           but if blocking is solely due to being trapped in/on floor,
           do give some feedback but skip other float_down() effects */
        let trapped = +(BLevitation() == I_SPECIAL);

        float_vs_flight();
        if (trapped && u.utrap) /* u.utrap => paranoia */
            You(_("are no longer trying to float up from the %s."),
                (u.utraptype == TT_BEARTRAP) ? _("trap's jaws")
                  : (u.utraptype == TT_WEB) ? _("web")
                      : (u.utraptype == TT_BURIEDBALL) ? _("chain")
                          : (u.utraptype == TT_LAVA) ? _("lava")
                              : _("ground")); /* TT_INFLOOR */
        encumber_msg(); /* carrying capacity might have changed */
        return 0;
    }
    disp.botl = TRUE;
    nomul(0); /* stop running or resting */
    if (BFlying()) {
        /* controlled flight no longer overridden by levitation */
        float_vs_flight(); /* clears BFlying & I_SPECIAL
                            * unless hero is stuck in floor */
        if (Flying()) {
            You(_("have stopped levitating and are now flying."));
            encumber_msg(); /* carrying capacity might have changed */
            return 1;
        }
    }
    if (u.uswallow) {
        You(_("float down, but you are still %s."),
            digests(u.ustuck.data) ? _("swallowed") : _("engulfed"));
        encumber_msg();
        return 1;
    }

    if (Punished() && !carried(uball) && !m_at(uball.ox, uball.oy)
        && (is_pool(uball.ox, uball.oy)
            || ((trap = t_at(uball.ox, uball.oy))
                && (is_pit(trap.ttyp) || is_hole(trap.ttyp))))) {
        u.ux0 = u.ux;
        u.uy0 = u.uy;
        u.ux = uball.ox;
        u.uy = uball.oy;
        movobj(uchain, uball.ox, uball.oy);
        newsym(u.ux0, u.uy0);
        gv.vision_full_recalc = 1; /* in case the hero moved. */
    }
    /* check for falling into pool - added by GAN 10/20/86 */
    if (!Flying()) {
        if (!u.uswallow && u.ustuck) {
            if (sticks(gy.youmonst.data))
                You(_("aren't able to maintain your hold on %s."),
                    mon_nam(u.ustuck));
            else
                pline(_("Startled, %s can no longer hold you!"),
                      mon_nam(u.ustuck));
            set_ustuck(null);
        }
        /* kludge alert:
         * drown() and lava_effects() print various messages almost
         * every time they're called which conflict with the "fall
         * into" message below.  Thus, we want to avoid printing
         * confusing, duplicate or out-of-order messages.
         * Use knowledge of the two routines as a hack -- this
         * should really be handled differently -dlc
         */
        if (is_pool(u.ux, u.uy) && !Wwalking() && !Swimming() && !u.uinwater)
            no_msg = drown();

        if (is_lava(u.ux, u.uy) && !iflags.in_lava_effects) {
            lava_effects();
            no_msg = TRUE;
        }
    }
    if (!trap) {
        trap = t_at(u.ux, u.uy);
        if (Is_airlevel(u.uz)) {
            You(_("begin to tumble in place."));
        } else if (Is_waterlevel(u.uz) && !no_msg) {
            You_feel(_("heavier."));
        /* u.uinwater msgs already in spoteffects()/drown() */
        } else if (!u.uinwater && !no_msg) {
            if (!(emask & W_SADDLE)) {
                if (Sokoban() && trap) {
                    /* Justification elsewhere for Sokoban traps is based
                     * on air currents.  This is consistent with that.
                     * The unexpected additional force of the air currents
                     * once levitation ceases knocks you off your feet.
                     */
                    if (Hallucination())
                        pline(_("Bummer!  You've crashed."));
                    else
                        You(_("fall over."));
                    losehp(rnd(2), _("dangerous winds"), KILLED_BY);
                    if (u.usteed)
                        dismount_steed(DISMOUNT_FELL);
                    selftouch(_("As you fall, you"));
                } else if (u.usteed && (is_floater(u.usteed.data)
                                        || is_flyer(u.usteed.data))) {
                    You(_("settle more firmly in the saddle."));
                } else if (Hallucination()) {
                    pline(_("Bummer!  You've %s."),
                          is_pool(u.ux, u.uy)
                             ? _("splashed down")
                             : _("hit the ground"));
                } else {
                    You(_("float gently to the %s."), surface(u.ux, u.uy));
                }
            }
        }
    }

    /* levitation gives maximum carrying capacity, so having it end
       potentially triggers greater encumbrance; do this after
       'come down' messages, before trap activation or autopickup */
    encumber_msg();

    /* can't rely on u.uz0 for detecting trap door-induced level change;
       it gets changed to reflect the new level before we can check it */
    assign_level(current_dungeon_level, u.uz);
    if (trap) {
        switch (trap.ttyp) {
        case STATUE_TRAP:
            break;
        case HOLE:
        case TRAPDOOR:
            if (!Can_fall_thru(u.uz) || u.ustuck)
                break;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        default:
            if (!u.utrap) /* not already in the trap */
                dotrap(trap, NO_TRAP_FLAGS);
        }
    }
    if (!Is_airlevel(u.uz) && !Is_waterlevel(u.uz) && !u.uswallow
        /* falling through trap door calls goto_level,
           and goto_level does its own pickup() call */
        && on_level(u.uz, current_dungeon_level))
        pickup(1);
    return 1;
    } finally { stack_pop($frame); }
}

/* shared code for climbing out of a pit */
export function climb_pit() { /* void */
    let pitname;

    if (!u.utrap || u.utraptype != TT_PIT)
        return;

    pitname = trapname(PIT, FALSE);
    if (Passes_walls()) {
        /* marked as trapped so they can pick things up */
        You(_("ascend from the %s."), pitname);
        reset_utrap(FALSE);
        fill_pit(u.ux, u.uy);
        gv.vision_full_recalc = 1; /* vision limits change */
    } else if (!rn2(2) && sobj_at(BOULDER, u.ux, u.uy)) {
        Your(_("%s gets stuck in a crevice."), body_part(LEG));
        display_nhwindow()(WIN_MESSAGE, FALSE);
        clear_nhwindow()(WIN_MESSAGE);
        You(_("free your %s."), body_part(LEG));
    } else if ((Flying() || is_clinger(gy.youmonst.data)) && !Sokoban()) {
        /* eg fell in pit, then poly'd to a flying monster;
           or used '>' to deliberately enter it */
        You(_("%s from the %s."), u_locomotion(_("climb")), pitname);
        reset_utrap(FALSE);
        fill_pit(u.ux, u.uy);
        gv.vision_full_recalc = 1; /* vision limits change */
    } else if (!(--u.utrap) || m_easy_escape_pit(gy.youmonst)) {
        reset_utrap(FALSE);
        You(_("%s to the edge of the %s."),
            (Sokoban() && Levitation())
                ? _("struggle against the air currents and float")
                : u.usteed ? _("ride") : _("crawl"),
            pitname);
        fill_pit(u.ux, u.uy);
        gv.vision_full_recalc = 1; /* vision limits change */
    } else if (u.dz || flags.verbose) {
        /* these should use 'pitname' rather than "pit" for hallucination
           but that would nullify Norep (this message can be repeated
           many times without further user intervention by using a run
           attempt to keep retrying to escape from the pit) */
        if (u.usteed)
            Norep(_("%s is still in a pit."), YMonnam(u.usteed));
        else
            Norep((Hallucination() && !rn2(5))
                      ? _("You've fallen, and you can't get up.")
                      : _("You are still in a pit."));
    }
}

function dofiretrap(
    box) { /* void */ /* null for floor trap */
    let see_it = +!Blind();
    let orig_dmg, num, alt;
    orig_dmg = num = d(2, 4);

    /* Bug: for box case, the equivalent of burn_floor_objects() ought
     * to be done upon its contents.
     */

    if ((box && !carried(box)) ? is_pool(box.ox, box.oy) : Underwater()) {
        pline(_("A cascade of steamy bubbles erupts from %s!"),
              the(box ? xname(box) : surface(u.ux, u.uy)));
        if (Fire_resistance())
            You(_("are uninjured."));
        else
            losehp(rnd(3), _("boiling water"), KILLED_BY);
        return;
    }
    pline(_("A %s %s from %s!"), tower_of_flame, box ? _("bursts") : _("erupts"),
          the(box ? xname(box) : surface(u.ux, u.uy)));
    if (Fire_resistance()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_FIRE);
        num = rn2(2);
    } else if (Upolyd()) {
        switch (u.umonnum) {
        case PM_PAPER_GOLEM:
            alt = u.mhmax;
            break;
        case PM_STRAW_GOLEM:
            alt = Math.trunc(u.mhmax / 2);
            break;
        case PM_WOOD_GOLEM:
            alt = Math.trunc(u.mhmax / 4);
            break;
        case PM_LEATHER_GOLEM:
            alt = Math.trunc(u.mhmax / 8);
            break;
        default:
            alt = 0;
            break;
        }
        if (alt > num)
            num = alt;
        if (u.mhmax > mons[u.umonnum].mlevel)
            u.mhmax -= rn2(min(u.mhmax, num + 1)), disp.botl = TRUE;
        if (u.mh > u.mhmax)
            u.mh = u.mhmax, disp.botl = TRUE;
        monstunseesu(M_SEEN_FIRE);
    } else {
        let uhpmin = minuhpmax(1), olduhpmax = u.uhpmax;

        num = d(2, 4);
        if (u.uhpmax > uhpmin) {
            u.uhpmax -= rn2(min(u.uhpmax, num + 1)), disp.botl = TRUE;
        } /* note: no 'else' here */
        if (u.uhpmax < uhpmin) {
            setuhpmax(min(olduhpmax, uhpmin), FALSE); /* sets disp.botl */
            if (!Drain_resistance())
                losexp(0); /* never fatal when 'drainer' is Null */
        }
        if (u.uhp > u.uhpmax)
            u.uhp = u.uhpmax, disp.botl = TRUE;
        monstunseesu(M_SEEN_FIRE);
    }
    if (!num)
        You(_("are uninjured."));
    else
        losehp(num, tower_of_flame, KILLED_BY_AN); /* fire damage */
    burn_away_slime();

    if (burnarmor(gy.youmonst) || rn2(3)) {
        destroy_items(gy.youmonst, AD_FIRE, orig_dmg);
        ignite_items(gi.invent);
    }
    if (!box && burn_floor_objects(u.ux, u.uy, see_it, TRUE) && !see_it)
        You(_("smell paper burning."));
    if (is_ice(u.ux, u.uy))
        melt_ice(u.ux, u.uy, 0);
}

function domagictrap() { /* void */
    const $frame = stack_frame(); try {
    let fate = rnd(20);

    /* What happened to the poor sucker? */

    if (fate < 10) {
        /* Most of the time, it creates some monsters. */
        let cnt = rnd(4);

        /* blindness effects */
        if (!resists_blnd(gy.youmonst)) {
            You(_("are momentarily blinded by a flash of light!"));
            make_blinded(rn1(5, 10), FALSE);
            if (!Blind())
                Your1(vision_clears());
        } else if (!Blind()) {
            You_see(_("a flash of light!"));
        }

        /* deafness effects */
        if (!Deaf()) {
             ;
            You_hear(_("a deafening roar!"));
            incr_itimeout(ref_of(u.uprops[DEAF], "intrinsic"), rn1(20, 30));
            disp.botl = TRUE;
        } else {
            /* magic vibrations still hit you */
            You_feel(_("rankled."));
            incr_itimeout(ref_of(u.uprops[DEAF], "intrinsic"), rn1(5, 15));
            disp.botl = TRUE;
        }
        while (cnt--)
            makemon(null, u.ux, u.uy, NO_MM_FLAGS);
        /* roar: wake monsters in vicinity, after placing trap-created ones */
        wake_nearto(u.ux, u.uy, 7 * 7);
        /* [flash: should probably also hit nearby gremlins with light] */
    } else {
        switch (fate) {
        case 10:
            /* sometimes nothing happens */
            break;
        case 11: /* toggle intrinsic invisibility */
            ;
            You_hear(_("a low hum."));
            if (!Invis()) {
                if (!Blind())
                    self_invis_message();
            } else if (!EInvis() && !pm_invisible(gy.youmonst.data)) {
                if (!Blind()) {
                    if (!See_invisible())
                        You(_("can see yourself again!"));
                    else
                        You_cant(_("see through yourself anymore."));
                }
            } else {
                /* If we're invisible from another source */
                You_feel(_("a little more %s now."),
                         HInvis() ? _("obvious") : _("hidden"));
            }
            u.uprops[INVIS].intrinsic = HInvis() ? 0 : or64(HInvis(), FROMOUTSIDE);
            newsym(u.ux, u.uy);
            break;
        case 12: /* a flash of fire */
            dofiretrap(null);
            break;

        /* odd feelings */
        case 13:
            pline(_("A shiver runs up and down your %s!"), body_part(SPINE));
            break;
        case 14:
            You_hear(Hallucination() ? _("the moon howling at you.")
                                   : _("distant howling."));
            break;
        case 15:
            if (on_level(u.uz, svd.dungeon_topology.d_qstart_level))
                You_feel(
                    _("%slike the prodigal son."),
                    (flags.female || (Upolyd() && is_neuter(gy.youmonst.data)))
                        ? _("oddly ")
                        : _(""));
            else
                You(_("suddenly yearn for %s."),
                    Hallucination()
                        ? _("Cleveland")
                        : (In_quest(u.uz) || at_dgn_entrance(_("The Quest")))
                              ? _("your nearby homeland")
                              : _("your distant homeland"));
            break;
        case 16:
            Your(_("pack shakes violently!"));
            break;
        case 17:
            You(Hallucination() ? _("smell hamburgers.") : _("smell charred flesh."));
            break;
        case 18:
            You_feel(_("tired."));
            break;

        /* very occasionally something nice happens. */
        case 19: { /* tame nearby monsters */
            let i, j;
            let mtmp;

            adjattrib(A_CHA, 1, FALSE);
            for (i = -1; i <= 1; i++)
                for (j = -1; j <= 1; j++) {
                    if (!isok(u.ux + i, u.uy + j))
                        continue;
                    mtmp = m_at(u.ux + i, u.uy + j);
                    if (mtmp)
                        tamedog(mtmp, null, TRUE);
                }
            break;
        }
        case 20: { /* uncurse stuff */
            let pseudo = stack_struct(struct_obj);
            let save_conf = HConfusion();

            struct_assign(pseudo, cg.zeroobj); /* force 'uncursed' and zero out oextra */
            /* used to be SCR_REMOVE_CURSE but that could cause seffects()
               to have hero discover scroll of remove curse */
            pseudo.otyp = SPE_REMOVE_CURSE;
            pseudo.oclass = SPBOOK_CLASS;
            u.uprops[CONFUSION].intrinsic = 0;
            seffects(pseudo);
            u.uprops[CONFUSION].intrinsic = save_conf;
            break;
        }
        default:
            break;
        }
    }
    } finally { stack_pop($frame); }
}

/* Set an item on fire.  Return whether the object was destroyed. */
export function fire_damage(
    obj,
    force,
    x, y) { /* boolean */ /* where to place contents of burned up container */
    let chance;
    let otmp, ncobj;
    let in_sight = +(!Blind() && couldsee(x, y)); /* Don't care if it's lit */
    let dindx;

    /* object might light in a controlled manner */
    if (catch_lit(obj))
        return FALSE;

    if (Is_container(obj) || obj.otyp == STATUE) {
        switch (obj.otyp) {
        case STATUE:
        case ICE_BOX:
            return FALSE; /* Immune */
        case CHEST:
            chance = 40;
            break;
        case LARGE_BOX:
            chance = 30;
            break;
        default:
            chance = 20;
            break;
        }
        if ((!force && (Luck() + 5) > rn2(chance))
            /* note: containers aren't subject to erosion so are never
               marked fireproof/corrodeproof/&c */
            /*|| (is_flammable(obj) && obj->oerodeproof)*/
            ) {
            return FALSE;
        }
        /* Container is burnt up - dump contents out */
        if (in_sight)
            pline(_("%s catches fire and burns."), Yname2(obj));
        if (Has_contents(obj)) {
            if (in_sight)
                pline(_("Its contents fall out."));
            for (otmp = obj.cobj; otmp; otmp = ncobj) {
                ncobj = otmp.nobj;
                obj_extract_self(otmp);
                if (!flooreffects(otmp, x, y, _("")))
                    place_object(otmp, x, y);
            }
        }
        setnotworn(obj);
        delobj(obj);
        return TRUE;
    } else if (!force && (Luck() + 5) > rn2(20)) {
        /*  chance per item of sustaining damage:
          *     max luck (Luck==13):    10%
          *     avg luck (Luck==0):     75%
          *     awful luck (Luck<-4):  100%
          */
        return FALSE;
    } else if (obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS) {
        if (obj.otyp == SCR_FIRE || obj.otyp == SPE_FIREBALL)
            return FALSE;
        if (obj.otyp == SPE_BOOK_OF_THE_DEAD) {
            if (in_sight)
                pline(_("Smoke rises from %s."), the(xname(obj)));
            return FALSE;
        }
        dindx = (obj.oclass == SCROLL_CLASS) ? 3 : 4;
        if (in_sight)
            pline(_("%s %s."), Yname2(obj),
                  destroy_strings[dindx][+(obj.quan > 1)]);
        setnotworn(obj);
        delobj(obj);
        return TRUE;
    } else if (obj.oclass == POTION_CLASS) {
        dindx = (obj.otyp != POT_OIL) ? 1 : 2;
        if (in_sight)
            pline(_("%s %s."), Yname2(obj),
                  destroy_strings[dindx][+(obj.quan > 1)]);
        setnotworn(obj);
        delobj(obj);
        return TRUE;
    } else if (erode_obj(obj, 0, ERODE_BURN, EF_DESTROY)
               == ER_DESTROYED) {
        return TRUE;
    }
    return FALSE;
}

/*
 * Apply fire_damage() to an entire chain.
 *
 * Return number of objects destroyed. --ALI
 */
export function fire_damage_chain(
    chain,
    force,
    here,
    x, y) { /* int */
    let obj, nobj;
    let num = 0;

    /* erode_obj() relies on bhitpos if target objects aren't carried by
       the hero or a monster, to check visibility controlling feedback */
    gb.bhitpos.x = x, gb.bhitpos.y = y;

    for (obj = chain; obj; obj = nobj) {
        nobj = here ? obj.v.v_nexthere : obj.nobj;
        if (fire_damage(obj, force, x, y))
            ++num;
    }

    if (num && (Blind() && !couldsee(x, y)))
        You(_("smell smoke."));
    return num;
}

/* obj has been thrown or dropped into lava; damage is worse than mere fire */
export function lava_damage(obj, x, y) { /* boolean */
    let otyp = obj.otyp, ocls = obj.oclass;

    /* the Amulet, invocation items, and Rider corpses are never destroyed
       (let Book of the Dead fall through to fire_damage() to get feedback) */
    if (obj_resists(obj, 0, 0) && otyp != SPE_BOOK_OF_THE_DEAD)
        return FALSE;
    /* destroy liquid (venom), wax, veggy, flesh, paper (except for scrolls
       and books--let fire damage deal with them), cloth, leather, wood, bone
       unless it's inherently or explicitly fireproof or contains something;
       note: potions are glass so fall through to fire_damage() and boil */
    if (objects[otyp].oc_material < DRAGON_HIDE
        && ocls != SCROLL_CLASS && ocls != SPBOOK_CLASS
        && objects[otyp].oc_oprop != FIRE_RES
        && otyp != WAN_FIRE && otyp != FIRE_HORN
        /* assumes oerodeproof isn't overloaded for some other purpose on
           non-eroding items */
        && !obj.oerodeproof
        /* fire_damage() knows how to deal with containers and contents */
        && !Has_contents(obj)) {
        if (cansee(x, y)) {
            /* this feedback is pretty clunky and can become very verbose
               when former contents of a burned container get here via
               flooreffects() */
            if (obj == gt.thrownobj || obj == gk.kickedobj)
                pline(_("%s %s up!"), is_plural(obj) ? _("They") : _("It"),
                      otense(obj, _("burn")));
            else
                You_see(_("%s hit lava and burn up!"), doname(obj));
        }
        if (carried(obj)) { /* shouldn't happen */
            remove_worn_item(obj, TRUE);
            useupall(obj);
        } else
            delobj(obj);
        return TRUE;
    }
    return fire_damage(obj, TRUE, x, y);
}

export function acid_damage(obj) { /* void */
    /* Scrolls but not spellbooks can be erased by acid. */
    let victim;
    let vismon;

    if (!obj)
        return;

    victim = carried(obj) ? gy.youmonst : mcarried(obj) ? obj.v.v_ocarry : null;
    vismon = (victim && (victim != gy.youmonst) && canseemon(victim) ? 1 : 0);

    if (victim == gy.youmonst && inventory_resistance_check(AD_ACID))
        return;

    if (obj.greased) {
        grease_protect(obj, 0, victim);
    } else if (obj.oclass == SCROLL_CLASS && obj.otyp != SCR_BLANK_PAPER) {
        if (obj.otyp != SCR_BLANK_PAPER

            && obj.otyp != SCR_MAIL

            ) {
            if (!Blind()) {
                if (victim == gy.youmonst)
                    Your(_("%s."), aobjnam(obj, _("fade")));
                else if (vismon)
                    pline(_("%s %s."), s_suffix(Monnam(victim)),
                          aobjnam(obj, _("fade")));
            }
        }
        obj.otyp = SCR_BLANK_PAPER;
        obj.spe = 0;
        obj.dknown = 0;
    } else
        erode_obj(obj, 0, ERODE_CORRODE, EF_GREASE | EF_VERBOSE);
}

function pot_acid_damage(
    obj,
    in_invent,
    described) { /* void */
    let bufp;
    let one, exploded;

    one = +(obj.quan == 1);
    exploded = FALSE;

    if (Blind() && !in_invent)
        obj.dknown = 0;
    if (ga.acid_ctx.ctx_valid)
        exploded = +((obj.dknown ? ga.acid_ctx.dkn_boom
                                 : ga.acid_ctx.unk_boom) > 0);
    if (described) {
        /* just gave "The grease washes off your potion of acid."
            or "...your <color> potion." (or just "...your potion.");
            don't re-describe potion here; if we used "It explodes!"
            then "it" might be misconstrued as applying to "grease" */
        pline_The(_("potion%s %s!"),
                    plur(obj.quan), otense(obj, _("explode")));
    } else {
        /* First message is
            * "a [potion|<color> potion|potion of acid] explodes"
            * depending on obj->dknown (potion has been seen) and
            * objects[POT_ACID].oc_name_known (fully discovered),
            * or "some {plural version} explode" when relevant.
            * Second and subsequent messages for same chain and
            * matching dknown status are
            * "another [potion|<color> &c] explodes" or plural
            * variant.
            */
        bufp = simpleonames(obj);
        pline(_("%s%s %s!"), /* "A potion explodes!" */
                !exploded ? (one ? _("A ") : _("Some "))
                        : (one ? _("Another ") : _("More ")),
            bufp, vtense(bufp, _("explode")));
    }
    if (ga.acid_ctx.ctx_valid) {
        if (obj.dknown)
            ga.acid_ctx.dkn_boom++;
        else
            ga.acid_ctx.unk_boom++;
    }
    setnotworn(obj);
    delobj(obj);
    if (in_invent)
        update_inventory();
}

/* Get an object wet and damage it appropriately.
   Returns an erosion return value (ER_*). */
export function water_damage(
    obj,
    ostr,
    force) { /* int */ /* if True, skip luck-based protection check */
    const $frame = stack_frame(); try {
    let in_invent = (obj && carried(obj) ? 1 : 0), described = FALSE;

    if (!obj)
        return ER_NOTHING;

    if (splash_lit(obj))
        return ER_DAMAGED;

    if (!ostr)
        ostr = cxname(obj);

    if (obj.otyp == CAN_OF_GREASE && obj.spe > 0) {
        return ER_NOTHING;
    } else if (obj.otyp == TOWEL && obj.spe < 7) {
        /* a negative change induces a reverse increment, adding abs(change);
           spe starts 0..6, arg passed to rnd() is 1..7, change is -7..-1,
           final spe is 1..7 and always greater than its starting value */
        wet_a_towel(obj, -rnd(7 - obj.spe), TRUE);
        return ER_NOTHING;
    } else if (obj.greased) {
        if (!rn2(2)) {
            obj.greased = 0;
            if (in_invent) {
                pline_The(_("grease on %s washes off."), yname(obj));
                described = TRUE; /* used to modify potion feedback */
                update_inventory();
            }
            /* ungreased potions of acid will always be destroyed by water */
            if (obj.otyp == POT_ACID) {
                pot_acid_damage(obj, in_invent, described);
                return ER_DESTROYED;
            }
        }
        return ER_GREASED;
    } else if (Is_container(obj)
               && (!Waterproof_container(obj) || (obj.cursed && !rn2(3)))) {
        if (in_invent) {
            pline(_("Some %s gets into your %s!"), hliquid(_("water")), ostr);
            gm.mentioned_water = +!Hallucination();
        }
        water_damage_chain(obj.cobj, FALSE);
        return ER_DAMAGED; /* contents were damaged */
    } else if (Waterproof_container(obj)) {
        if (in_invent && !Blind() && !Underwater()) {
            pline_The(_("%s cannot get into your %s."), hliquid(_("water")), ostr);
            gm.mentioned_water = +!Hallucination();
            makeknown(obj.otyp); /* if an oilskin sack, discover it; doesn't
                                   * matter for chest, large box, ice box */
        }
        /* not actually damaged, but because we /didn't/ get the "water
           gets into!" message, the player now has more information and
           thus we need to waste any potion they may have used (also,
           flavourwise the water is now on the floor) */
        return ER_DAMAGED;
    } else if (!force && (Luck() + 5) > rn2(20)) {
        /*  chance per item of sustaining damage:
            *   max luck:               10%
            *   avg luck (Luck==0):     75%
            *   awful luck (Luck<-4):  100%
            */
        return ER_NOTHING;
    } else if (obj.oclass == SCROLL_CLASS) {
        if (obj.otyp == SCR_BLANK_PAPER

            || obj.otyp == SCR_MAIL

           ) return 0;
        if (in_invent)
            Your(_("%s %s."), ostr, vtense(ostr, _("fade")));

        obj.otyp = SCR_BLANK_PAPER;
        obj.dknown = 0;
        obj.spe = 0;
        if (in_invent)
            update_inventory();
        return ER_DAMAGED;
    } else if (obj.oclass == SPBOOK_CLASS) {
        let otyp = obj.otyp;

        if (otyp == SPE_BOOK_OF_THE_DEAD) {
            let ox = stack_var(coordxy, 0), oy = stack_var(coordxy, 0);

            /* note: The Book of the Dead can't be contained or buried */
            if (get_obj_location(obj, ox, oy, CONTAINED_TOO | BURIED_TOO))
                obj.ox = ox[0], obj.oy = oy[0];
            if (isok(ox[0], oy[0]) && cansee(ox[0], oy[0]))
                pline(_("Steam rises from %s."), the(xname(obj)));
            return 0;
        } else if (otyp == SPE_BLANK_PAPER) {
            return 0;
        }
        if (in_invent)
            Your(_("%s %s."), ostr, vtense(ostr, _("fade")));

        obj.otyp = SPE_BLANK_PAPER;
        /* same re-init as over-reading or polymorph; matters if it gets
           polymorphed into non-blank; doesn't matter if eventually written
           on since that replaces it with new book and studied count of 0 */
        if (obj.usecount)
            obj.usecount = rn2(obj.usecount);
        obj.dknown = 0;
        /* blanking a novel is more involved than blanking a spellbook */
        if (otyp == SPE_NOVEL) /* old type */
            blank_novel(obj);
        if (in_invent)
            update_inventory();
        return ER_DAMAGED;
    } else if (obj.oclass == POTION_CLASS) {
        if (obj.otyp == POT_ACID) {
            pot_acid_damage(obj, in_invent, described);
            return ER_DESTROYED;
        } else if (obj.oeroded) {
            if (in_invent)
                Your(_("%s %s further."), ostr, vtense(ostr, _("dilute")));

            obj.otyp = POT_WATER;
            obj.dknown = 0;
            obj.blessed = obj.cursed = 0;
            obj.oeroded = 0;
            if (in_invent)
                update_inventory();
            return ER_DAMAGED;
        } else if (obj.otyp != POT_WATER) {
            if (in_invent)
                Your(_("%s %s."), ostr, vtense(ostr, _("dilute")));

            obj.oeroded++;
            if (in_invent)
                update_inventory();
            return ER_DAMAGED;
        }
    } else {
        return erode_obj(obj, ostr, ERODE_RUST, EF_NONE);
    }
    return ER_NOTHING;
    } finally { stack_pop($frame); }
}

export function water_damage_chain(
    obj,
    here) { /* void */
    const $frame = stack_frame(); try {
    let otmp;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let save_bhitpos = stack_struct(struct_nhcoord);

    if (!obj)
        return;

    /* initialize acid context: so far, neither seen (dknown) potions of
       acid nor unseen have exploded during this water damage sequence */
    ga.acid_ctx.dkn_boom = ga.acid_ctx.unk_boom = 0;
    ga.acid_ctx.ctx_valid = TRUE;
    /* we don't want to permanently overwrite bhitpos below, since we can get
       here from scenarios where it was in use up the call stack (e.g. thrown
       item hurtling the levitating hero into a wall of water) */
    struct_assign(save_bhitpos, gb.bhitpos);
    /* erode_obj() relies on bhitpos if target objects aren't carried by
       the hero or a monster, to check visibility controlling feedback */
    if (get_obj_location(obj, x, y, CONTAINED_TOO))
        gb.bhitpos.x = x[0], gb.bhitpos.y = y[0];

    for (; obj; obj = otmp) {
        otmp = here ? obj.v.v_nexthere : obj.nobj;
        water_damage(obj, 0, FALSE);
    }

    /* reset acid context and bhitpos */
    ga.acid_ctx.dkn_boom = ga.acid_ctx.unk_boom = 0;
    ga.acid_ctx.ctx_valid = FALSE;
    struct_assign(gb.bhitpos, save_bhitpos);
    } finally { stack_pop($frame); }
}

/*
 * This function is potentially expensive - rolling
 * inventory list multiple times.  Luckily it's seldom needed.
 * Returns TRUE if disrobing made player unencumbered enough to
 * crawl out of the current predicament.
 */
function emergency_disrobe(lostsome) { /* boolean */
    let invc = inv_cnt(TRUE);

    while (near_capacity() > (Punished() ? UNENCUMBERED : SLT_ENCUMBER)) {
        let obj, nextobj, otmp = null;
        let i;

        /* Pick a random object */
        if (invc > 0) {
            i = rn2(invc);
            for (obj = gi.invent; obj; obj = nextobj) {
                nextobj = obj.nobj;
                /*
                 * Undroppables are: body armor, boots, gloves,
                 * amulets, and rings because of the time and effort
                 * in removing them + loadstone and other cursed stuff
                 * for obvious reasons.  Also, any item in the midst
                 * of being taken off or stolen.
                 */
                if (!((obj.otyp == LOADSTONE && obj.cursed) || obj == uamul
                      || obj == uleft || obj == uright || obj == ublindf
                      || obj == uarm || obj == uarmc || obj == uarmg
                      || obj == uarmf || obj == uarmu
                      || (obj.cursed && (obj == uarmh || obj == uarms))
                      || welded(obj)
                      || obj.o_id == gs.stealoid || obj.in_use))
                    otmp = obj;
                /* reached the mark and found some stuff to drop? */
                if (--i < 0 && otmp)
                    break;

                /* else continue */
            }
        }
        if (!otmp)
            return FALSE; /* nothing to drop! */
        if (otmp.owornmask)
            remove_worn_item(otmp, FALSE);
        chars[lostsome] = TRUE;
        dropx(otmp);
        invc--;
    }
    return TRUE;
}

/* pick a random goodpos() next to x,y for monster mtmp.
   mtmp could be &gy.youmonst, uses then crawl_destination().
   returns TRUE if any good position found, with the coord in x,y */
export function rnd_nextto_goodpos(x, y, mtmp) { /* boolean */
    const $frame = stack_frame(); try {
    let i, j;
    let is_u = +(mtmp == gy.youmonst);
    let nx, ny, k, dirs = stack_array(short, N_DIRS);

    for (i = 0; i < N_DIRS; ++i)
        dirs[i] = i;
    for (i = N_DIRS; i > 0; --i) {
        j = rn2(i);
        k = dirs[j];
        dirs[j] = dirs[i - 1];
        dirs[i - 1] = k;
    }
    for (i = 0; i < N_DIRS; ++i) {
        nx = x[0] + chars[xdir + (dirs[i])];
        ny = y[0] + chars[ydir + (dirs[i])];
        /* crawl_destination and goodpos both include an isok() check */
        if (is_u ? crawl_destination(nx, ny) : goodpos(nx, ny, mtmp, 0)) {
            x[0] = nx;
            y[0] = ny;
            return TRUE;
        }
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* print a message about being back on the ground after leaving a pool */
export function back_on_ground(rescued) { /* void */
    const $frame = stack_frame(); try {
    let preposit = (Levitation() || Flying()) ? _("over") : _("on"),
               surf = surface(u.ux, u.uy), you_are_back;
    let icebuf = stack_array(char, QBUFSZ);

    if (is_ice(u.ux, u.uy)) {
        /* "on ice" */
        surf = ice_descr(u.ux, u.uy, icebuf);
    } else if (!strncmpi((surf), _(("floor")), -1) || !strncmpi((surf), _(("ground")), -1)) {
        /* "on solid ground" */
        surf = _("solid ground");
    } else if (!strncmpi((surf), _(("bridge")), -1) || !strncmpi((surf), _(("altar")), -1)
               || !strncmpi((surf), _(("headstone")), -1)) {
        /* "on a bridge" */
        surf = an(surf);
    } else if (!strncmpi((surf), _(("stairs")), -1) || !strncmpi((surf), _(("lava")), -1)
               || !strncmpi((surf), _(("bottom")), -1)) {
        /* "on the stairs" */
        surf = the(surf);
    } else { /* "cloud", "air", "air bubble", "wall", "fountain", "doorway" */
        /* "in a cloud", "in the air" */
        surf = !strcmp(surf, _("air")) ? the(surf) : an(surf);
        preposit = _("in");
    }
    if (rescued) {
        you_are_back = _("You find yourself");
    } else {
        you_are_back = flags.verbose ? _("You are back") : _("Back");
    }
    pline(_("%s %s %s."), you_are_back, preposit, surf);
    iflags.last_msg = PLNMSG_BACK_ON_GROUND;
    } finally { stack_pop($frame); }
}

/* life-saving or divine rescue has attempted to get the hero out of hostile
   terrain and put hero in an unexpected spot or failed due to overfull level
   and just prevented death so "back on solid ground" may be inappropriate */
export function rescued_from_terrain(how) { /* void */
    let find_yourself = init_string(static_array("rescued_from_terrain.find_yourself", char, sizeof_string("find yourself")), _("find yourself"), true);
    let lev = levl()[u.ux][u.uy];
    let mesggiven = FALSE;

    switch (how) {
    case DROWNING:
        if (is_pool(u.ux, u.uy)) {
            You(_("%s %s of %s."), find_yourself,
                (Is_waterlevel(u.uz) || IS_WATERWALL(lev.typ))
                  ? _("in the midst") : _("on top"),
                hliquid(_("water")));
            mesggiven = TRUE;
        } else if (IS_AIR(lev.typ)) {
            You(_("%s in %s."), find_yourself,
                Is_waterlevel(u.uz) ? _("an air bubble") : _("mid air"));
            mesggiven = TRUE;
        }
        break;
    case BURNING: /* moved onto lava without fire resistance */
    case DISSOLVED: /* sunk into lava while fire resistant */
        if (is_pool(u.ux, u.uy)) {
            You(_("%s %s %s."), find_yourself,
                u.uinwater ? _("in") : _("on"), hliquid(_("water")));
            mesggiven = TRUE;
        } else if (is_lava(u.ux, u.uy)) {
            You(_("%s on top of %s."), find_yourself, hliquid(_("molten lava")));
            mesggiven = TRUE;
        }
        break;
    default:
        break;
    }
    if (!mesggiven)
        back_on_ground(TRUE);

    iflags.last_msg = PLNMSG_BACK_ON_GROUND; /* for describe_decor() */
    /* feedback just disclosed this */
    update_lastseentyp(u.ux, u.uy);
    iflags.prev_decor = chars[svl.lastseentyp[u.ux] + u.uy];
}

/* return TRUE iff player relocated */
export function drown() { /* boolean */
    const $frame = stack_frame(); try {
    let pool_of_water;
    let inpool_ok = FALSE;
    let i;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let is_solid = is_waterwall(u.ux, u.uy);

    feel_newsym(u.ux, u.uy); /* in case Blind, map the water here */
    /* happily wading in the same contiguous pool */
    if (u.uinwater && is_pool(u.ux - u.dx, u.uy - u.dy)
        && (Swimming() || Amphibious() || Breathless())) {
        /* water effects on objects every now and then */
        if (!rn2(5))
            inpool_ok = TRUE;
        else
            return FALSE;
    }

    if (!u.uinwater) {
        You(_("%s into the %s%c"), is_solid ? _("plunge") : _("fall"),
            waterbody_name(u.ux, u.uy),
            (Amphibious() || Swimming() || Breathless()) ? ord('.') : ord('!'));
        if (!Swimming() && !is_solid)
            You(_("sink like %s."), Hallucination() ? _("the Titanic") : _("a rock"));
    }

    water_damage_chain(gi.invent, FALSE);

    if (u.umonnum == PM_GREMLIN && rn2(3)) {
        split_mon(gy.youmonst, null);
    } else if (u.umonnum == PM_IRON_GOLEM) {
        You(_("rust!"));
        i = ((Half_physical_damage()) ? (Math.trunc((((d(2, 6)) + 1) / 2))) : (d(2, 6)));
        if (u.mhmax > i)
            u.mhmax -= i;
        losehp(i, _("rusting away"), KILLED_BY);
    }
    if (inpool_ok)
        return FALSE;

    if ((i = number_leashed()) > 0) {
        pline_The(_("leash%s slip%s loose."), (i > 1) ? _("es") : _(""),
                  (i > 1) ? _("") : _("s"));
        unleash_all();
    }

    if (Amphibious() || Breathless() || Swimming()) {
        if (Amphibious() || Breathless()) {
            if (flags.verbose)
                pline(_("But you aren't drowning."));
            if (!Is_waterlevel(u.uz)) {
                if (Hallucination())
                    Your(_("keel hits the bottom."));
                else
                    You(_("touch bottom."));
            }
        }
        if (Punished()) {
            unplacebc();
            placebc();
        }
        vision_recalc(2); /* unsee old position */
        set_uinwater(1); /* u.uinwater = 1 */
        under_water(1);
        gv.vision_full_recalc = 1;
        return FALSE;
    }
    if ((Teleportation() || can_teleport(gy.youmonst.data)) && !Unaware()
        && (Teleport_control() || rn2(3) < Luck() + 2)) {
        You(_("attempt a teleport spell.")); /* utcsri!carroll */
        if (!noteleport_level(gy.youmonst)) {
            dotele(FALSE);
            if (!is_pool(u.ux, u.uy))
                return TRUE;
        } else
            pline_The(_("attempted teleport spell fails."));
    }
    if (u.usteed) {
        dismount_steed(DISMOUNT_GENERIC);
        if (!is_pool(u.ux, u.uy))
            return TRUE;
    }
    /* if sleeping, wake up now so that we don't crawl out of water
       while still asleep; we can't do that the same way that waking
       due to combat is handled; note unmul() clears u.usleep */
    if (u.usleep)
        unmul(_("Suddenly you wake up!"));
    /* being doused will revive from fainting */
    if (is_fainted())
        reset_faint();

    x[0] = u.ux, y[0] = u.uy;
    /* have to be able to move in order to crawl */
    if (gm.multi >= 0 && gy.youmonst.data.mmove
        && rnd_nextto_goodpos(x, y, gy.youmonst)) {
        let lost = stack_var(boolean, FALSE);
        /* time to do some strip-tease... */
        let succ = Is_waterlevel(u.uz) ? TRUE : emergency_disrobe(addr_of(lost));

        You(_("try to crawl out of the %s."), hliquid(_("water")));
        if (lost[0])
            You(_("dump some of your gear to lose weight..."));
        if (succ) {
            pline(_("Pheew!  That was close."));
            teleds(x[0], y[0], TELEDS_ALLOW_DRAG);
            return TRUE;
        }
        /* still too much weight */
        pline(_("But in vain."));
    }
    set_uinwater(1); /* u.uinwater = 1 */
    urgent_pline(_("You drown."));
    /* first pass is survivable by using up an amulet of life-saving or by
       answering no to "Die?" in explore|wizard mode; second pass can only
       be survivable via the latter */
    for (i = 0; i < 2; i++) {
        /* killer format and name are reconstructed every iteration
           because lifesaving resets them */
        pool_of_water = waterbody_name(u.ux, u.uy);
        svk.killer.format = KILLED_BY_AN;
        /* avoid "drowned in [a] water" */
        if (!strcmp(pool_of_water, _("water")))
            pool_of_water = _("deep water"), svk.killer.format = KILLED_BY;
        /* avoid "drowned in _a_ limitless water" on Plane of Water */
        else if (!strcmp(pool_of_water, _("limitless water")))
            svk.killer.format = KILLED_BY;
        strcpy(svk.killer.name, pool_of_water);
        done(DROWNING);
        /* oops, we're still alive.  better get out of the water. */
        if (safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT))
            break; /* successful life-save */
        /* nowhere safe to land; repeat drowning loop... */
        pline(_("You're still drowning."));
    }

    if (u.uinwater)
        set_uinwater(0); /* u.uinwater = 0 */
    rescued_from_terrain(DROWNING);
    return TRUE;
    } finally { stack_pop($frame); }
}

export function drain_en(n, max_already_drained) { /* void */
    let mesg;
    let punct = max_already_drained ? ord('!') : ord('.');

    /*
     * FIXME?
     *  u.uenmax should probably have a higher minimum than 0;
     *  perhaps u.ulevel or (u.ulevel + 1) / 2
     */
    if (u.uenmax < 1) {
        /* energy is completely gone */
        if (u.uen || u.uenmax) { /* paranoia */
            u.uen = u.uenmax = 0;
            disp.botl = TRUE;
        }
        mesg = _("momentarily lethargic");
    } else {
        /* throttle further loss a bit when there's not much left to lose */
        if (n > Math.trunc((u.uen + u.uenmax) / 3))
            n = rnd(n);

        mesg = _("your magical energy drain away");
        if (n > u.uen)
            punct = ord('!');

        u.uen -= n;
        if (u.uen < 0) {
            u.uenmax -= rnd(-u.uen);
            if (u.uenmax < 0)
                u.uenmax = 0;
            u.uen = 0;
        } else if (u.uen > u.uenmax) {
            /* uen might be greater than uenmax if caller reduced uenmax
               and then we throttled the loss being applied to current */
            u.uen = u.uenmax;
        }
        disp.botl = TRUE;
    }
    /* after manipulating u.uen,uenmax and setting context.botl, so
       that You_feel() -> pline() will update status before the message */
    You_feel(_("%s%c"), mesg, punct);
}

/* the #untrap command - disarm a trap */
export function dountrap() { /* int */
    if (!could_untrap(TRUE, FALSE))
        return ECMD_OK;

    return untrap(FALSE, 0, 0, null) ? ECMD_TIME : ECMD_OK;
}

/* preliminary checks for dountrap(); also used for autounlock */
export function could_untrap(verbosely, check_floor) { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    chars[buf + 0] = ord('\0');
    if (near_capacity() >= HVY_ENCUMBER) {
        strcpy(buf, _("You're too strained to do that."));
    } else if ((nohands(gy.youmonst.data) && !webmaker(gy.youmonst.data))
               || !gy.youmonst.data.mmove) {
        strcpy(buf, _("And just how do you expect to do that?"));
    } else if (u.ustuck && sticks(gy.youmonst.data)) {
        sprintf(buf, _("You'll have to let go of %s first."), mon_nam(u.ustuck));
    } else if (u.ustuck || (welded(uwep) && bimanual(uwep))) {
        sprintf(buf, _("Your %s seem to be too busy for that."), makeplural(body_part(HAND)))
;
    } else if (check_floor && !can_reach_floor(FALSE)) {
        /* only checked here for autounlock of chest/box and that will
           be !verbosely so precise details of the message don't matter */
        sprintf(buf, _("You can't reach the %s."), surface(u.ux, u.uy));
    }
    if (chars[buf + 0]) {
        if (verbosely)
            pline(_("%s"), buf);
        return 0;
    }
    return 1;
    } finally { stack_pop($frame); }
}

/* Probability of disabling a trap.  Helge Hafting;
   Returns 0 for success, non-0 for failure. */
function untrap_prob(
    ttmp) { /* int */ /* must not be Null */
    let chance = 3;

    /* non-spiders are less adept at dealing with webs */
    if (ttmp.ttyp == WEB) {
        /* this assumes that all fiery artifacts are blades; no need to
           make it more complicated unless/until that changes */
        let wep = (uwep && is_blade(uwep)) ? uwep
                          : (uswapwep && u.twoweap && is_blade(uswapwep))
                            ? uswapwep : null;

        /* FIXME? Forcefight of adjacent web works with bare-handed and
           martial arts but #untrap of same resorts to !webmaker() chance */
        if (wep && !m_at(ttmp.tx, ttmp.ty)) {
            /* primary or secondary weapon is a blade (which includes
               daggers but not axes or bladed polearms) */
            if (u_wield_art(ART_STING) || attacks(AD_FIRE, wep))
                chance = 1;
            /* else chance stays 3 */
        } else if (!webmaker(gy.youmonst.data)) {
            chance = 7; /* 5.0: used to be 30 */
        }
    }
    if (Confusion() || Hallucination())
        chance++;
    if (Blind())
        chance++;
    if (Stunned())
        chance += 2;
    if (Fumbling())
        chance *= 2;
    /* Your own traps are better known than others. */
    if (ttmp.madeby_u)
        chance--;
    if (Role_if(PM_RANGER) && ttmp.ttyp == BEAR_TRAP && chance <= 3)
        return 0; /* always succeeds */
    if (Role_if(PM_ROGUE)) {
        if (rn2(2 * MAXULEV) < u.ulevel)
            chance--;
        if (u.uhave.questart && chance > 1)
            chance--;
    } else if (Role_if(PM_RANGER) && chance > 1)
        chance--;
    if (chance < 1)
        chance = 1;
    return rn2(chance);
}

/* Replace trap with object(s).  Helge Hafting */
export function cnv_trap_obj(
    otyp,
    cnt,
    ttmp,
    bury_it) { /* void */
    let otmp = mksobj(otyp, TRUE, FALSE);
    let mtmp;

    otmp.quan = cnt;
    otmp.owt = unsigned(weight(otmp));
    /* Only dart traps are capable of being poisonous */
    if (otyp != DART)
        otmp.otrapped = 0;
    place_object(otmp, ttmp.tx, ttmp.ty);
    if (bury_it) {
        /* magical digging first disarms this trap, then will unearth it */
        bury_an_obj(otmp, 0);
    } else {
        /* Sell your own traps only... */
        if (ttmp.madeby_u)
            sellobj(otmp, ttmp.tx, ttmp.ty);
        stackobj(otmp);
    }
    newsym(ttmp.tx, ttmp.ty);
    if (u.utrap && (((ttmp.tx) == u.ux) && ((ttmp.ty) == u.uy)))
        reset_utrap(TRUE);
    if (((mtmp = m_at(ttmp.tx, ttmp.ty)) != null) && mtmp.mtrapped)
        mtmp.mtrapped = 0;
    deltrap(ttmp);
}

/* whether moving to a trap location is moving "into" the trap or "onto" it */
export function into_vs_onto(traptype) { /* boolean */
    switch (traptype) {
    case BEAR_TRAP:
    case PIT:
    case SPIKED_PIT:
    case HOLE:
    case TELEP_TRAP:
    case LEVEL_TELEP:
    case MAGIC_PORTAL:
    case WEB:
        return TRUE;
    }
    return FALSE;
}

/* while attempting to disarm an adjacent trap, we've fallen into it */
function move_into_trap(ttmp) { /* void */
    const $frame = stack_frame(); try {
    let bc = stack_var(int, 0);
    let x = ttmp.tx, y = ttmp.ty, bx = stack_var(coordxy), by = stack_var(coordxy), cx = stack_var(coordxy), cy = stack_var(coordxy);
    let unused = stack_var(boolean);

    bx[0] = by[0] = cx[0] = cy[0] = 0; /* lint suppression */
    /* we know there's no monster in the way and we're not trapped, but
       need to make sure the move is not diagonally into or out of a
       doorway; the sgn() calls are redundant since ttmp is adjacent */
    if (test_move(u.ux, u.uy, sgn(x - u.ux), sgn(y - u.uy), TEST_MOVE)
        && (!Punished()
            || drag_ball(x, y, bc, bx, by, cx, cy, addr_of(unused), TRUE))) {
        /* move hero and update map */
        u.ux0 = u.ux, u.uy0 = u.uy;
        /* set u.ux,u.uy and u.usteed->mx,my plus handle CLIPPING */
        u_on_newpos(x, y);
        u.umoved = TRUE;
        newsym(u.ux0, u.uy0);
        vision_recalc(1);
        check_leash(u.ux0, u.uy0);
        if (Punished())
            move_bc(0, bc[0], bx[0], by[0], cx[0], cy[0]);
        /* marking the trap unseen forces dotrap() to treat it like a new
           discovery and prevents pickup() -> look_here() -> check_here()
           from giving a redundant "there is a <trap> here" message when
           there are objects covering this trap */
        ttmp.tseen = 0; /* hack for check_here() */
        /* trigger the trap */
        iflags.failing_untrap++; /* spoteffects() -> dotrap(,FAILEDUNTRAP) */
        spoteffects(TRUE); /* pickup() + dotrap() */
        iflags.failing_untrap--;
        /* this should no longer be necessary; before the failing_untrap
           hack, Flying hero would not trigger an unseen bear trap and
           setting it not-yet-seen above resulted in leaving it hidden */
        if ((ttmp = t_at(u.ux, u.uy)) != null)
            ttmp.tseen = 1;
        exercise(A_WIS, FALSE);
    } else {
        /* caller has just printed "Whoops..." so if hero is prevented from
           moving, a followup message is needed */
        pline(_("Fortunately, you don't move %s it."),
              into_vs_onto(ttmp.ttyp) ? _("into") : _("onto"));
    }
    } finally { stack_pop($frame); }
}

/* 0: doesn't even try; 1: tries and fails; 2: succeeds */
function try_disarm(
    ttmp,
    force_failure) { /* int */
    let mtmp = m_at(ttmp.tx, ttmp.ty);
    let ttype = ttmp.ttyp;
    let under_u = +(!u.dx && !u.dy);
    let holdingtrap = +(ttype == BEAR_TRAP || ttype == WEB);

    /* Test for monster first, monsters are displayed instead of trap. */
    if (mtmp && (!mtmp.mtrapped || !holdingtrap)) {
        pline(_("%s is in the way."), Monnam(mtmp));
        return 0;
    }
    /* We might be forced to move onto the trap's location. */
    if (sobj_at(BOULDER, ttmp.tx, ttmp.ty) && !Passes_walls() && !under_u) {
        There(_("is a boulder in your way."));
        return 0;
    }
    /* duplicate tight-space checks from test_move */
    if (u.dx && u.dy && bad_rock(gy.youmonst.data, u.ux, ttmp.ty)
        && bad_rock(gy.youmonst.data, ttmp.tx, u.uy)) {
        if ((gi.invent && (inv_weight() + weight_cap() > WT_TOOMUCH_DIAGONAL))
            || bigmonst(gy.youmonst.data)) {
            /* don't allow untrap if they can't get thru to it */
            You(_("are unable to reach the %s!"), trapname(ttype, FALSE));
            return 0;
        }
    }
    /* untrappable traps are located on the ground. */
    if (!can_reach_floor(under_u)) {
        if (u.usteed && P_SKILL(P_RIDING) < P_BASIC)
            rider_cant_reach();
        else
            You(_("are unable to reach the %s!"), trapname(ttype, FALSE));
        return 0;
    }

    /* Will our hero succeed? */
    if (force_failure || untrap_prob(ttmp)) {
        if (rnl(5)) {
            pline(_("Whoops..."));
            if (mtmp) { /* must be a trap that holds monsters */
                if (ttype == BEAR_TRAP) {
                    if (mtmp.mtame)
                        abuse_dog(mtmp);
                    mtmp.mhp -= rnd(4);
                    if (DEADMONSTER(mtmp))
                        killed(mtmp);
                } else if (ttype == WEB) {
                    let ttmp2 = t_at(u.ux, u.uy);

                    if (!webmaker(gy.youmonst.data)
                        /* don't always try to spread the web */
                        && !rn2(3)
                        /* is there already a trap at hero's spot?
                           if so, don't clobber it with spreading web */
                        && (ttmp2
                            ? (ttmp2.ttyp == WEB)
                            /* make a new web to trap hero in */
                            : (ttmp2 = maketrap(u.ux, u.uy, WEB)) != null)) {
                        pline_The(_("web sticks to you.  You're caught too!"));
                        dotrap(ttmp2, NOWEBMSG);
                        if (u.usteed && u.utrap) {
                            /* you, not steed, are trapped */
                            dismount_steed(DISMOUNT_FELL);
                        }
                    }
                    if (mtmp.mtrapped)
                        pline(_("%s remains entangled."), Monnam(mtmp));
                }
            } else if (under_u) {
                /* [don't need the iflags.failing_untrap hack here] */
                dotrap(ttmp, FAILEDUNTRAP);
            } else {
                move_into_trap(ttmp);
            }
        } else {
            pline(_("%s %s is difficult to %s."),
                  ttmp.madeby_u ? _("Your") : under_u ? _("This") : _("That"),
                  trapname(ttype, FALSE),
                  (ttype == WEB) ? _("remove") : _("disarm"));
        }
        return 1;
    }
    return 2;
}

function reward_untrap(ttmp, mtmp) { /* void */
    if (!ttmp.madeby_u) {
        if (rnl(10) < 8 && !mtmp.mpeaceful && !helpless(mtmp)
            && !mtmp.mfrozen && !mindless(mtmp.data)
            && !unique_corpstat(mtmp.data)
            && mtmp.data.mlet != S_HUMAN) {
            mtmp.mpeaceful = 1;
            set_malign(mtmp); /* reset alignment */
            pline(_("%s is grateful."), Monnam(mtmp));
        }
        /* Helping someone out of a trap is a nice thing to do.
           A lawful may be rewarded, but not too often.  */
        if (!rn2(3) && !rnl(8) && u.ualign.type == A_LAWFUL) {
            adjalign(1);
            You_feel(_("that you did the right thing."));
        }
    }
}

/* Help a monster out of a bear trap or web, or if no monster is
   present, disarm a bear trap or destroy a web.  Helge Hafting */
function disarm_holdingtrap(ttmp) { /* int */
    let mtmp;
    let which = the_your()[ttmp.madeby_u];
    let fails = try_disarm(ttmp, FALSE);

    if (fails < 2)
        return fails;

    /* ok, disarm it. */

    /* untrap the monster, if any.
       There's no need for a cockatrice test, only the trap is touched */
    if ((mtmp = m_at(ttmp.tx, ttmp.ty)) != null) {
        mtmp.mtrapped = 0;
        You(_("extract %s from %s %s."), mon_nam(mtmp),
            which, (ttmp.ttyp == BEAR_TRAP) ? _("bear trap") : _("web"));
        reward_untrap(ttmp, mtmp);
    } else if (ttmp.ttyp == BEAR_TRAP) {
        You(_("disarm %s bear trap."), which);
        cnv_trap_obj(BEARTRAP, 1, ttmp, FALSE);
    } else if (ttmp.ttyp == WEB) {
        let wep = (uwep && is_blade(uwep)) ? uwep
                          : (uswapwep && u.twoweap && is_blade(uswapwep))
                            ? uswapwep : null;

        if (wep && wep.oartifact
            && (u_wield_art(ART_STING) || attacks(AD_FIRE, wep)))
            pline(_("%s %s through %s web!"), bare_artifactname(uwep),
                  u_wield_art(ART_STING) ? _("cuts") : _("burns"), which);
        else if (wep)
            You(_("cut through %s web."), which);
        else
            You(_("succeed in removing %s web."), which);
        deltrap(ttmp);
    }
    newsym(u.ux + u.dx, u.uy + u.dy);
    return 1;
}

function disarm_landmine(ttmp) { /* int */ /* Helge Hafting */
    let fails = try_disarm(ttmp, FALSE);

    if (fails < 2)
        return fails;
    You(_("disarm %s land mine."), the_your()[ttmp.madeby_u]);
    cnv_trap_obj(LAND_MINE, 1, ttmp, FALSE);
    return 1;
}

/* getobj callback for object to disarm a squeaky board with */
function unsqueak_ok(obj) { /* int */
    if (!obj)
        return GETOBJ_EXCLUDE;

    if (obj.otyp == CAN_OF_GREASE)
        return GETOBJ_SUGGEST;

    if (obj.otyp == POT_OIL && obj.dknown
        && objects[POT_OIL].oc_name_known)
        return GETOBJ_SUGGEST;

    /* downplay all other potions, including unidentified oil
     * Potential extension: if oil is known, skip this and exclude all other
     * potions. */
    if (obj.oclass == POTION_CLASS)
        return GETOBJ_DOWNPLAY;

    return GETOBJ_EXCLUDE;
}

/* it may not make much sense to use grease on floor boards, but so what? */
function disarm_squeaky_board(ttmp) { /* int */
    let obj;
    let bad_tool;
    let fails;

    obj = getobj(_("untrap with"), unsqueak_ok, GETOBJ_PROMPT);
    if (!obj)
        return 0;

    bad_tool = (obj.cursed
                || ((obj.otyp != POT_OIL || obj.lamplit)
                    && (obj.otyp != CAN_OF_GREASE || !obj.spe)) ? 1 : 0);
    fails = try_disarm(ttmp, bad_tool);
    if (fails < 2)
        return fails;

    /* successfully used oil or grease to fix squeaky board */
    if (obj.otyp == CAN_OF_GREASE) {
        consume_obj_charge(obj, TRUE);
    } else {
        useup(obj); /* oil */
        makeknown(POT_OIL);
    }
    You(_("repair the squeaky board.")); /* no madeby_u */
    deltrap(ttmp);
    newsym(u.ux + u.dx, u.uy + u.dy);
    more_experienced(1, 5);
    newexplevel();
    return 1;
}

/* removes traps that shoot arrows, darts, etc. */
function disarm_shooting_trap(ttmp, otyp) { /* int */
    let fails = try_disarm(ttmp, FALSE);

    if (fails < 2)
        return fails;
    You(_("disarm %s trap."), the_your()[ttmp.madeby_u]);
    cnv_trap_obj(otyp, 50 - rnl(50), ttmp, FALSE);
    return 1;
}

/* trying to #untrap a monster from a pit; is the weight too heavy? */
function try_lift(
    mtmp,
    ttmp,
    xtra_wt,
    stuff) { /* int */ /* False: monster w/o minvent; True: w/ minvent */
    if (calc_capacity(xtra_wt) >= HVY_ENCUMBER) {
        pline(_("%s is %s for you to lift."), Monnam(mtmp),
              stuff ? _("carrying too much") : _("too heavy"));
        if (!ttmp.madeby_u && !mtmp.mpeaceful && mtmp.mcanmove
            && !mindless(mtmp.data) && mtmp.data.mlet != S_HUMAN
            && rnl(10) < 3) {
            mtmp.mpeaceful = 1;
            set_malign(mtmp); /* reset alignment */
            pline(_("%s thinks it was nice of you to try."), Monnam(mtmp));
        }
        return 0;
    }
    return 1;
}

/* Help trapped monster (out of a (spiked) pit) */
function help_monster_out(
    mtmp,
    ttmp) { /* int */
    const $frame = stack_frame(); try {
    let xtra_wt;
    let otmp;
    let uprob;

    /*
     * This works when levitating too -- consistent with the ability
     * to hit monsters while levitating.
     *
     * Should perhaps check that our hero has arms/hands at the
     * moment.  Helping can also be done by engulfing...
     *
     * Test the monster first - monsters are displayed before traps.
     */
    if (!mtmp.mtrapped) {
        pline(_("%s isn't trapped."), Monnam(mtmp));
        return 0;
    }
    /* Do you have the necessary capacity to lift anything? */
    if (check_capacity(0))
        return 1;

    /* Will our hero succeed? */
    if ((uprob = untrap_prob(ttmp)) != 0 && !helpless(mtmp)) {
        You(_("try to reach out your %s, but %s backs away skeptically."),
            makeplural(body_part(ARM)), mon_nam(mtmp));
        return 1;
    }

    /* is it a cockatrice?... */
    if (touch_petrifies(mtmp.data) && !uarmg && !Stone_resistance()) {
        let mtmp_pmname = mon_pmname(mtmp);

        You(_("grab the trapped %s using your bare %s."),
            mtmp_pmname, makeplural(body_part(HAND)));

        if (poly_when_stoned(gy.youmonst.data) && polymon(PM_STONE_GOLEM)) {
            display_nhwindow()(WIN_MESSAGE, FALSE);
        } else {
            let kbuf = stack_array(char, BUFSZ);

            sprintf(kbuf, _("trying to help %s out of a pit"), an(mtmp_pmname));
            instapetrify(kbuf);
            return 1;
        }
    }
    /* need to do cockatrice check first if sleeping or paralyzed */
    if (uprob) {
        You(_("try to grab %s, but cannot get a firm grasp."), mon_nam(mtmp));
        if (mtmp.msleeping) {
            mtmp.msleeping = 0;
            pline(_("%s awakens."), Monnam(mtmp));
        }
        return 1;
    }

    You(_("reach out your %s and grab %s."), makeplural(body_part(ARM)),
        mon_nam(mtmp));

    if (mtmp.msleeping) {
        mtmp.msleeping = 0;
        pline(_("%s awakens."), Monnam(mtmp));
    } else if (mtmp.mfrozen && !rn2(mtmp.mfrozen)) {
        /* After such manhandling, perhaps the effect wears off */
        mtmp.mcanmove = 1;
        mtmp.mfrozen = 0;
        pline(_("%s stirs."), Monnam(mtmp));
    }

    /* is the monster too heavy? */
    xtra_wt = int(mtmp.data.cwt);
    if (!try_lift(mtmp, ttmp, xtra_wt, FALSE))
        return 1;

    /* monster without its inventory isn't too heavy; if it carries
       anything, include that minvent weight and check again */
    if (mtmp.minvent) {
        for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
            xtra_wt = int(xtra_wt + otmp.owt);
        if (!try_lift(mtmp, ttmp, xtra_wt, TRUE))
            return 1;
    }

    You(_("pull %s out of the pit."), mon_nam(mtmp));
    mtmp.mtrapped = 0;
    reward_untrap(ttmp, mtmp);
    fill_pit(mtmp.mx, mtmp.my);
    return 1;
    } finally { stack_pop($frame); }
}

function disarm_box(box, force, confused) { /* void */
    if (box.otrapped) {
        let ch = ACURR(A_DEX) + u.ulevel;

        if (Role_if(PM_ROGUE))
            ch *= 2;
        if (!force && (confused || Fumbling()
                       || rnd(75 + Math.trunc(level_difficulty() / 2)) > ch)) {
            chest_trap(box, FINGER, TRUE);
            /* 'box' might be gone now */
        } else {
            You(_("disarm it!"));
            box.otrapped = 0;
            box.tknown = 1;
            more_experienced(8, 0);
            newexplevel();
        }
        exercise(A_DEX, TRUE);
    } else {
        pline(_("That %s was not trapped."), xname(box));
        box.tknown = 0;
    }
}

/* check a particular container for a trap and optionally disarm it */
function untrap_box(
    box,
    force,
    confused) { /* void */
    if ((box.otrapped
         && (force || (!confused && rn2(MAXULEV + 1 - u.ulevel) < 10)))
        || box.tknown
        || (!force && confused && !rn2(3))) {
        if (!(box.tknown && box.dknown))
            You(_("find a trap on %s!"), the(xname(box)));
        else
            pline(_("There's a trap on %s."), the(xname(box)));
        box.tknown = 1;
        observe_object(box);
        if (!confused)
            exercise(A_WIS, TRUE);

        if (ynq(_("Disarm it?")) == ord('y'))
            disarm_box(box, force, confused);
    } else {
        You(_("find no traps on %s."), the(xname(box)));
    }
}

/* hero is able to attempt untrap, so do so */
export function untrap(
    force,
    rx, ry,
    container) { /* int */
    const $frame = stack_frame(); try {
    let otmp;
    let x, y;
    let ch;
    let ttmp;
    let mtmp;
    let trapdescr;
    let here, useplural, deal_with_floor_trap,
            confused = (Confusion() || Hallucination() ? 1 : 0),
            trap_skipped = FALSE, autounlock_door = FALSE;
    let boxcnt = 0;
    let the_trap = stack_array(char, BUFSZ), qbuf = stack_array(char, QBUFSZ);

    /* 'force' is true for #invoke; if carrying MKoT, make it be true
       for #untrap or autounlock */
    if (!force && has_magic_key(gy.youmonst))
        force = TRUE;

    if (!rx && !container) {
        /* usual case */
        if (!getdir(0))
            return 0;
        x = u.ux + u.dx;
        y = u.uy + u.dy;
    } else {
        /* autounlock's untrap; skip most prompting */
        if (container) {
            untrap_box(container, force, confused);
            return 1;
        }
        /* levl[rx][ry] is a locked or trapped door */
        x = rx, y = ry;
        autounlock_door = TRUE;
    }
    if (!isok(x, y)) {
        pline_The(_("perils lurking there are beyond your grasp."));
        return 0;
    }

    ttmp = t_at(x, y);
    if (ttmp && !ttmp.tseen)
        ttmp = null;
    trapdescr = ttmp ? trapname(ttmp.ttyp, FALSE) : 0;
    here = u_at(x, y); /* !u.dx && !u.dy */

    if (here) /* are there are one or more containers here? */
        for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere)
            if (Is_box(otmp)) {
                if (++boxcnt > 1)
                    break;
            }

    deal_with_floor_trap = can_reach_floor(FALSE);
    if (autounlock_door) {
        ; /* skip a bunch */
    } else if (!deal_with_floor_trap) {
        chars[the_trap] = ord('\0');
        if (ttmp)
            strcat(the_trap, an(trapdescr));
        if (ttmp && boxcnt)
            strcat(the_trap, _(" and "));
        if (boxcnt)
            strcat(the_trap, (boxcnt == 1) ? _("a container") : _("containers"));
        useplural = ((ttmp && boxcnt > 0) || boxcnt > 1 ? 1 : 0);
        /* note: boxcnt and useplural will always be 0 for !here case */
        if (ttmp || boxcnt)
            There(_("%s %s %s but you can't reach %s%s."),
                  useplural ? _("are") : _("is"), the_trap, here ? _("here") : _("there"),
                  useplural ? _("them") : _("it"),
                  u.usteed ? _(" while mounted") : _(""));
        trap_skipped = +(ttmp != null);
    } else { /* deal_with_floor_trap */
        if (ttmp) {
            strcpy(the_trap, the(trapdescr));
            if (boxcnt) {
                if (is_pit(ttmp.ttyp)) {
                    You_cant(_("do much about %s%s."), the_trap,
                             u.utrap ? _(" that you're stuck in")
                                     : _(" while standing on the edge of it"));
                    trap_skipped = TRUE;
                    deal_with_floor_trap = FALSE;
                } else {
                    Snprintf(qbuf, sizeof(array_of(char, QBUFSZ)), _("There %s and %s here.  %s %s?"), (boxcnt == 1) ? _("is a container")
                                           : _("are containers"), an(trapdescr), (ttmp.ttyp == WEB) ? _("Remove")
                                                 : _("Disarm"), the_trap)

;
                    switch (ynq(qbuf)) {
                    case ord('q'):
                        return 0;
                    case ord('n'):
                        trap_skipped = TRUE;
                        deal_with_floor_trap = FALSE;
                        break;
                    }
                }
            }
            if (deal_with_floor_trap) {
                if (u.utrap) {
                    You(_("cannot deal with %s while trapped%s!"), the_trap,
                        u_at(x, y) ? _(" in it") : _(""));
                    return 1;
                }
                if ((mtmp = m_at(x, y)) != null
                    && (M_AP_TYPE(mtmp) == M_AP_FURNITURE
                        || M_AP_TYPE(mtmp) == M_AP_OBJECT)) {
                    stumble_onto_mimic(mtmp);
                    return 1;
                }
                switch (ttmp.ttyp) {
                case BEAR_TRAP:
                case WEB:
                    return disarm_holdingtrap(ttmp);
                case LANDMINE:
                    return disarm_landmine(ttmp);
                case SQKY_BOARD:
                    return disarm_squeaky_board(ttmp);
                case DART_TRAP:
                    return disarm_shooting_trap(ttmp, DART);
                case ARROW_TRAP:
                    return disarm_shooting_trap(ttmp, ARROW);
                case PIT:
                case SPIKED_PIT:
                    if (here) {
                        You(_("are already on the edge of the pit."));
                        return 0;
                    }
                    if (!mtmp) {
                        pline(_("Try filling the pit instead."));
                        return 0;
                    }
                    return help_monster_out(mtmp, ttmp);
                default:
                    You(_("cannot disable %s trap."), !here ? _("that") : _("this"));
                    return 0;
                }
            }
        } /* end if */

        if (boxcnt) {
            /* 5.0: this used to allow searching for traps on multiple
               containers on the same move and needed to keep track of
               whether any had been found but not attempted to untrap;
               now at most one per move may be checked and we only
               continue on to door handling if they are all declined */
            for (otmp = svl.level.objects[x][y]; otmp; otmp = otmp.v.v_nexthere) {
                if (!Is_box(otmp))
                    continue;
                if (otmp.tknown && otmp.dknown)
                    safe_qbuf(qbuf, _("Disarm this "), 0,
                                     otmp, xname, ansimpleoname, _("a box"));
                else
                    safe_qbuf(qbuf, _("There is "),
                                     _(" here.  Check it for traps?"), otmp,
                                     doname, ansimpleoname, _("a box"));
                switch (ynq(qbuf)) {
                    case ord('q'):
                        return 0;
                    case ord('y'):
                        if (otmp.tknown && otmp.dknown)
                            disarm_box(otmp, force, confused);
                        else
                            untrap_box(otmp, force, confused);
                        return 1; /* even for 'no' at "Disarm it?" prompt */
                    }
                    /* 'n' => continue to next box */
            }
            There(_("are no other chests or boxes here."));
        }

        if (stumble_on_door_mimic(x, y))
            return 1;
    } /* deal_with_floor_trap */

    /*
     * Doors can be manipulated even while levitating/unskilled riding.
     *
     * Ordinarily there won't be a closed or locked door at the same
     * location as a floor trap or a container.  However, there could
     * be a container at a closed/locked door spot if it was dropped
     * there by a monster or poly'd hero with Passes_walls capability,
     * and poly'd hero could move onto that spot and attempt #untrap
     * in direction '.' or '>'.  We'll get here for that situation if
     * player declines to check all containers for traps.
     *
     * The usual situation is #untrap toward an adjacent closed door.
     * No floor trap would be present and any containers would be
     * ignored because they're only checked when direction is '.'/'>'.
     */
    if (!IS_DOOR(levl()[x][y].typ)) {
        if (!trap_skipped)
            You(_("know of no traps there."));
        return 0;
    }

    switch (levl()[x][y].flags) {
    case D_NODOOR:
        You(_("%s no door there."), Blind() ? _("feel") : _("see"));
        return 0;
    case D_ISOPEN:
        pline(_("This door is safely open."));
        return 0;
    case D_BROKEN:
        pline(_("This door is broken."));
        return 0;
    }

    if (((levl()[x][y].flags & D_TRAPPED) != 0
         && (force || (!confused && rn2(MAXULEV - u.ulevel + 11) < 10)))
        || (!force && confused && !rn2(3))) {
        You(_("find a trap on the door!"));
        exercise(A_WIS, TRUE);
        if (ynq(_("Disarm it?")) != ord('y'))
            return 1;
        if (levl()[x][y].flags & D_TRAPPED) {
            ch = 15 + (Role_if(PM_ROGUE) ? u.ulevel * 3 : u.ulevel);
            exercise(A_DEX, TRUE);
            if (!force && (confused || Fumbling()
                           || rnd(75 + Math.trunc(level_difficulty() / 2)) > ch)) {
                You(_("set it off!"));
                b_trapped(_("door"), FINGER);
                levl()[x][y].flags = D_NODOOR;
                unblock_point(x, y);
                newsym(x, y);
                /* (probably ought to charge for this damage...) */
                if (chars[in_rooms(x, y, SHOPBASE)])
                    add_damage(x, y, 0);
            } else {
                You(_("disarm it!"));
                levl()[x][y].flags &= ~D_TRAPPED;
                more_experienced(8, 0);
                newexplevel();
            }
        } else
            pline(_("This door was not trapped."));
        return 1;
    } else {
        You(_("find no traps on the door."));
        return 1;
    }
    } finally { stack_pop($frame); }
}

/* for magic unlocking; returns true if targeted monster (which might
   be hero) gets untrapped; the trap remains intact */
export function openholdingtrap(
    mon,
    noticed) { /* boolean */ /* set to true iff hero notices the effect; * otherwise left with its previous value intact */
    const $frame = stack_frame(); try {
    let t, tdummy = stack_struct(struct_trap);
    let buf = stack_array(char, BUFSZ), whichbuf = stack_array(char, 20);
    let trapdescr = 0, which = 0;
    let ishero = +(mon == gy.youmonst);

    if (!mon)
        return FALSE;
    if (mon == u.usteed)
        ishero = TRUE;

    t = t_at(ishero ? u.ux : mon.mx, ishero ? u.uy : mon.my);

    if (ishero && u.utrap) { /* all u.utraptype values are holding traps */
        /* there might not be any trap at hero's spot for tt_buriedball;
           conversely, there might be an unrelated trap at that spot */
        if (!t) {
            t = tdummy;
            memset(addr_of(t), 0, sizeof(struct_trap)), t.ntrap = null;
            /* fallback 't' is now nonNull, t->tseen and t->madeby_u are 0 */
        }
        which = the_your()[(!t || !t.tseen || !t.madeby_u) ? 0 : 1];

        switch (u.utraptype) {
        case TT_LAVA:
            trapdescr = _("molten lava");
            break;
        case TT_INFLOOR:
            /* solidified lava, so not "floor" even if within a room */
            trapdescr = _("ground");
            break;
        case TT_BURIEDBALL:
            trapdescr = _("your anchor");
            which = _("");
            break;
        case TT_BEARTRAP:
        case TT_PIT:
        case TT_WEB:
            trapdescr = defsyms[(u.utraptype == TT_WEB) ? S_web
                                : (u.utraptype == TT_PIT) ? S_pit
                                  : S_bear_trap].explanation;
            break;
        default:
            /* lint suppression in case 't' is unexpectedly Null
               or u.utraptype has new value we don't know about yet */
            trapdescr = _("trap");
            break;
        }
    } else {
        /* if no trap here or it's not a holding trap, we're done */
        if (!t || (t.ttyp != BEAR_TRAP && t.ttyp != WEB))
            return FALSE;
        trapdescr = trapname(t.ttyp, FALSE);
    }
    assert(t != null);
    if (!which)
        which = t.tseen ? the_your()[t.madeby_u]
                         : strchr(vowels, chars[trapdescr]) ? _("an") : _("a");
    assert(which != 0);
    if (chars[which])
        which = strcat(strcpy(whichbuf, which), _(" "));

    if (ishero) {
        if (!u.utrap)
            return FALSE;
        chars[noticed] = TRUE;
        if (!u.usteed)
            strcpy(buf, _("You are"));
        else if (u.utraptype == TT_BURIEDBALL)
            sprintf(buf, _("You and %s are"), y_monnam(u.usteed));
        else
            sprintf(buf, _("%s is"), noit_Monnam(u.usteed));
        /* give release message before untrap in case it triggers a message */
        pline(_("%s released from %s%s."), buf, which, trapdescr);
        /* might float up if Levitation is being unblocked */
        gv.vision_full_recalc = 1; /* vision limits can change (pit escape) */
        reset_utrap(TRUE);
        if (gv.vision_full_recalc)
            vision_recalc(0);
    } else {
        if (!mon.mtrapped)
            return FALSE;
        mon.mtrapped = 0;
        if (canspotmon(mon)) {
            chars[noticed] = TRUE;
            pline(_("%s is released from %s%s."), Monnam(mon), which,
                  trapdescr);
        } else if (cansee(t.tx, t.ty) && t.tseen) {
            chars[noticed] = TRUE;
            if (t.ttyp == WEB)
                pline(_("%s is released from %s%s."), Something(), which,
                      trapdescr);
            else /* BEAR_TRAP */
                pline(_("%s%s opens."), upstart(strcpy(buf, which)), trapdescr);
        }
        /* might pacify monster if adjacent */
        if (rn2(2) && m_next2u(mon))
            reward_untrap(t, mon);
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/* for magic locking; returns true if targeted monster (which might
   be hero) gets hit by a trap (might avoid actually becoming trapped) */
export function closeholdingtrap(
    mon,
    noticed) { /* boolean */ /* set to true iff hero notices the effect; * otherwise left with its previous value intact */
    let t;
    let dotrapflags;
    let ishero = +(mon == gy.youmonst), result;

    if (!mon)
        return FALSE;
    if (mon == u.usteed)
        ishero = TRUE;
    t = t_at(ishero ? u.ux : mon.mx, ishero ? u.uy : mon.my);
    /* if no trap here or it's not a holding trap, we're done */
    if (!t || (t.ttyp != BEAR_TRAP && t.ttyp != WEB))
        return FALSE;

    if (ishero) {
        if (u.utrap)
            return FALSE; /* already trapped */
        chars[noticed] = TRUE;
        dotrapflags = FORCETRAP;
        /* dotrap calls mintrap when mounted hero encounters a web */
        if (u.usteed)
            dotrapflags = unsigned(dotrapflags | NOWEBMSG);
        dotrap(t, unsigned(dotrapflags | FORCETRAP));
        result = +(u.utrap != 0);
    } else {
        if (mon.mtrapped)
            return FALSE; /* already trapped */
        /* you notice it if you see the trap close/tremble/whatever
           or if you sense the monster who becomes trapped */
        chars[noticed] = (cansee(t.tx, t.ty) || canspotmon(mon) ? 1 : 0);
        result = +(mintrap(mon, FORCETRAP) != Trap_Effect_Finished);
    }
    return result;
}

/* for magic unlocking; returns true if targeted monster (which might
   be hero) gets hit by a trap (target might avoid its effect) */
export function openfallingtrap(
    mon,
    trapdoor_only,
    noticed) { /* boolean */ /* set to true iff hero notices the effect; */
                     /* otherwise left with its previous value intact */
    let t;
    let ishero = +(mon == gy.youmonst), result;

    if (!mon)
        return FALSE;
    if (mon == u.usteed)
        ishero = TRUE;
    t = t_at(ishero ? u.ux : mon.mx, ishero ? u.uy : mon.my);
    /* if no trap here or it's not a falling trap, we're done
       (note: falling rock traps have a trapdoor in the ceiling) */
    if (!t || ((t.ttyp != TRAPDOOR && t.ttyp != ROCKTRAP)
               && (trapdoor_only || (t.ttyp != HOLE && !is_pit(t.ttyp)))))
        return FALSE;

    if (ishero) {
        if (u.utrap)
            return FALSE; /* already trapped */
        chars[noticed] = TRUE;
        dotrap(t, FORCETRAP);
        result = +(u.utrap != 0);
    } else {
        if (mon.mtrapped)
            return FALSE; /* already trapped */
        /* you notice it if you see the trap close/tremble/whatever
           or if you sense the monster who becomes trapped */
        chars[noticed] = (cansee(t.tx, t.ty) || canspotmon(mon) ? 1 : 0);
        /* monster will be angered; mintrap doesn't handle that */
        wakeup(mon, TRUE);
        result = +(mintrap(mon, FORCETRAP) != Trap_Effect_Finished);
        /* mon might now be on the migrating monsters list */
    }
    return result;
}

/* only called when the player is doing something to the chest directly;
   returns True if chest is destroyed, False if it remains in play */
export function chest_trap(
    obj,
    bodypart,
    disarm) { /* boolean */
    const $frame = stack_frame(); try {
    let otmp = obj, otmp2;
    let buf = stack_array(char, 80);
    let msg;
    let cc = stack_struct(struct_nhcoord);

    if (get_obj_location(obj, ref_of(cc, "x"), ref_of(cc, "y"), 0)) /* might be carried */
        obj.ox = cc.x, obj.oy = cc.y;

    otmp.tknown = 0;   /* for xname(); will be set to 1 below */
    otmp.otrapped = 0; /* trap is one-shot; clear flag first in case
                         * chest kills you and ends up in bones file */
    You(disarm ? _("set it off!") : _("trigger a trap!"));
    display_nhwindow()(WIN_MESSAGE, FALSE);
    if (Luck() > -13 && rn2(13 + Luck()) > 7) { /* saved by luck */
        /* trap went off, but good luck prevents damage */
        switch (rn2(13)) {
        case 12:
        case 11:
            msg = _("explosive charge is a dud");
            break;
        case 10:
        case 9:
            msg = _("electric charge is grounded");
            break;
        case 8:
        case 7:
            msg = _("flame fizzles out");
            break;
        case 6:
        case 5:
        case 4:
            msg = _("poisoned needle misses");
            break;
        case 3:
        case 2:
        case 1:
        case 0:
            msg = _("gas cloud blows away");
            break;
        default:
            impossible(_("chest disarm bug"));
            msg = 0;
            break;
        }
        if (msg)
            pline(_("But luckily the %s!"), msg);
    } else {
        switch (rn2(20) ? ((Luck() >= 13) ? 0 : rn2(13 - Luck())) : rn2(26)) {
        case 25:
        case 24:
        case 23:
        case 22:
        case 21: {
            let shkp = null;
            let loss = 0;
            let costly, insider, chestgone;
            let ox = obj.ox, oy = obj.oy;

            /* the obj location need not be that of player */
            costly = (costly_spot(ox, oy)
                      && (shkp = shop_keeper(chars[in_rooms(ox, oy, SHOPBASE)]))
                             != null ? 1 : 0);
            insider = (chars[u.ushops] && inside_shop(u.ux, u.uy)
                       && chars[in_rooms(ox, oy, SHOPBASE)] == chars[u.ushops] ? 1 : 0);

            pline(_("%s!"), Tobjnam(obj, _("explode")));
            sprintf(buf, _("exploding %s"), xname(obj));

            if (costly)
                loss += stolen_value(obj, ox, oy, shkp.mpeaceful,
                                     TRUE);
            delete_contents(obj);
            /*
             * Note:  the explosion is taking place at the chest's
             * location, not necessarily at the hero's.  (Simplest
             * case: kicking it from one step away and getting the
             * chest_trap() outcome.)
             */
            /* unpunish() in advance if either ball or chain (or both)
               is going to be destroyed */
            if (Punished() && ((uchain.ox == ox && uchain.oy == oy)
                             || (uball.where == OBJ_FLOOR
                                 && uball.ox == ox && uball.oy == oy)))
                unpunish();
            /* destroy everything at the spot (the Amulet, the
               invocation tools, and Rider corpses will remain intact);
               usually the chest will be destroyed along with the stuff at
               this spot, but not if it is being carried */
            chestgone = FALSE;
            for (otmp = svl.level.objects[ox][oy]; otmp; otmp = otmp2) {
                otmp2 = otmp.v.v_nexthere;
                if (costly)
                    loss += stolen_value(otmp, otmp.ox, otmp.oy,
                                         shkp.mpeaceful, TRUE);
                if (otmp == obj)
                    chestgone = TRUE;
                delobj(otmp);
            }
            wake_nearby(FALSE);
            losehp(((Half_physical_damage()) ? (Math.trunc((((d(6, 6)) + 1) / 2))) : (d(6, 6))), buf, KILLED_BY_AN);
            exercise(A_STR, FALSE);
            if (costly && loss) {
                if (insider) {
                    You(_("owe %lld %s for objects destroyed."), loss,
                        currency(loss));
                } else {
                    You(_("caused %lld %s worth of damage!"), loss,
                        currency(loss));
                    make_angry_shk(shkp, ox, oy);
                }
            }
            if (chestgone)
                return TRUE;
            break; /* set tknown and return False */
        } /* case 21 */
        case 20:
        case 19:
        case 18:
        case 17:
            pline(_("A cloud of noxious gas billows from %s."), the(xname(obj)));
            if (rn2(3))
                poisoned(_("gas cloud"), A_STR, _("cloud of poison gas"), 15,
                         FALSE);
            else
                create_gas_cloud(obj.ox, obj.oy, 1, 8);
            exercise(A_CON, FALSE);
            break;
        case 16:
        case 15:
        case 14:
        case 13:
            You_feel(_("a needle prick your %s."), body_part(bodypart));
            poisoned(_("needle"), A_CON, _("poisoned needle"), 10, FALSE);
            exercise(A_CON, FALSE);
            break;
        case 12:
        case 11:
        case 10:
        case 9:
            dofiretrap(obj);
            break;
        case 8:
        case 7:
        case 6: {
            let dmg = d(4, 4), orig_dmg = dmg;

            You(_("are jolted by a surge of electricity!"));
            if (Shock_resistance()) {
                shieldeff(u.ux, u.uy);
                You(_("don't seem to be affected."));
                monstseesu(M_SEEN_ELEC);
                dmg = 0;
            } else {
                monstunseesu(M_SEEN_ELEC);
            }
            destroy_items(gy.youmonst, AD_ELEC, orig_dmg);
            if (dmg)
                losehp(dmg, _("electric shock"), KILLED_BY_AN);
            break;
        } /* case 6 */
        case 5:
        case 4:
        case 3:
            if (!Free_action()) {
                pline(_("Suddenly you are frozen in place!"));
                nomul(-d(5, 6));
                gm.multi_reason = _("frozen by a trap");
                exercise(A_DEX, FALSE);
                gn.nomovemsg = You_can_move_again();
            } else
                You(_("momentarily stiffen."));
            break;
        case 2:
        case 1:
        case 0:
            pline(_("A cloud of %s gas billows from %s."),
                  Blind() ? ROLL_FROM(blindgas) : rndcolor(),
                  the(xname(obj)));
            if (!Stunned()) {
                if (Hallucination())
                    pline(_("What a groovy feeling!"));
                else
                    You(_("%s%s..."), stagger(gy.youmonst.data, _("stagger")),
                        Halluc_resistance() ? _("")
                                          : Blind() ? _(" and get dizzy")
                                                  : _(" and your vision blurs"));
            }
            make_stunned((HStun() & TIMEOUT) + rn1(7, 16), FALSE);
            make_hallucinated(
                (HHallucination() & TIMEOUT) + rn1(5, 16), FALSE, 0);
            break;
        default:
            impossible(_("bad chest trap"));
            break;
        }
        bot(); /* to get immediate botl re-display */
    }

    obj.tknown = 1; /* hero knows chest is no longer trapped */
    return FALSE;
    } finally { stack_pop($frame); }
}

export function t_at(x, y) { /* struct trap * */
    let trap = gf.ftrap;

    while (trap) {
        if (trap.tx == x && trap.ty == y)
            return trap;
        trap = trap.ntrap;
    }
    return null;
}

/* return number of traps of type ttyp on this level */
export function count_traps(ttyp) { /* int */
    let ret = 0;
    let trap = gf.ftrap;

    while (trap) {
        if (trap.ttyp == ttyp)
            ret++;
        trap = trap.ntrap;
    }

    return ret;
}

export function deltrap(trap) { /* void */
    let ttmp;

    clear_conjoined_pits(trap);
    if (trap == gf.ftrap) {
        gf.ftrap = gf.ftrap.ntrap;
    } else {
        for (ttmp = gf.ftrap; ttmp; ttmp = ttmp.ntrap)
            if (ttmp.ntrap == trap)
                break;
        if (!ttmp)
            panic(_("deltrap: no preceding trap!"));
        ttmp.ntrap = trap.ntrap;
    }
    if (Sokoban() && (trap.ttyp == PIT || trap.ttyp == HOLE))
        maybe_finish_sokoban();
    dealloc_trap(trap);
}

export function conjoined_pits(
    trap2,
    trap1,
    u_entering_trap2) { /* boolean */
    let dx, dy;
    let diridx, adjidx;

    if (!trap1 || !trap2)
        return FALSE;
    if (!isok(trap2.tx, trap2.ty) || !isok(trap1.tx, trap1.ty)
        || !is_pit(trap2.ttyp)
        || !is_pit(trap1.ttyp)
        || (u_entering_trap2 && !(u.utrap && u.utraptype == TT_PIT)))
        return FALSE;
    dx = sgn(trap2.tx - trap1.tx);
    dy = sgn(trap2.ty - trap1.ty);
    diridx = xytodir(dx, dy);
    if (diridx != DIR_ERR) {
        adjidx = DIR_180(diridx);
        if ((trap1.vl.v_conjoined & (1 << diridx))
            && (trap2.vl.v_conjoined & (1 << adjidx)))
            return TRUE;
    }
    return FALSE;
}

function clear_conjoined_pits(trap) { /* void */
    let diridx, adjidx;
    let x, y;
    let t;

    if (trap && is_pit(trap.ttyp)) {
        for (diridx = 0; diridx < N_DIRS; ++diridx) {
            if (trap.vl.v_conjoined & (1 << diridx)) {
                x = trap.tx + chars[xdir + diridx];
                y = trap.ty + chars[ydir + diridx];
                if (isok(x, y)
                    && (t = t_at(x, y)) != null
                    && is_pit(t.ttyp)) {
                    adjidx = DIR_180(diridx);
                    t.vl.v_conjoined &= ~(1 << adjidx);
                }
                trap.vl.v_conjoined &= ~(1 << diridx);
            }
        }
    }
}

function adj_nonconjoined_pit(adjtrap) { /* boolean */
    let trap_with_u = t_at(u.ux0, u.uy0);

    if (trap_with_u && adjtrap && u.utrap && u.utraptype == TT_PIT
        && is_pit(trap_with_u.ttyp) && is_pit(adjtrap.ttyp)) {
        if (xytodir(u.dx, u.dy) != DIR_ERR)
            return TRUE;
    }
    return FALSE;
}

/* #if 0: not in this build */

/*
 * Returns TRUE if you escaped a pit and are standing on the precipice.
 */
export function uteetering_at_seen_pit(trap) { /* boolean */
    return (trap && is_pit(trap.ttyp) && trap.tseen
            && (((trap.tx) == u.ux) && ((trap.ty) == u.uy))
            && !(u.utrap && u.utraptype == TT_PIT) ? 1 : 0);
}

/*
 * Returns TRUE if you didn't fall through a hole or didn't
 * release a trap door
 */
export function uescaped_shaft(trap) { /* boolean */
    return (trap && is_hole(trap.ttyp) && trap.tseen
            && (((trap.tx) == u.ux) && ((trap.ty) == u.uy)) ? 1 : 0);
}

/* Destroy a trap that emanates from the floor. */
export function delfloortrap(ttmp) { /* boolean */
    /* some of these are arbitrary -dlc */
    if (ttmp && ((ttmp.ttyp == SQKY_BOARD) || (ttmp.ttyp == BEAR_TRAP)
                 || (ttmp.ttyp == LANDMINE) || (ttmp.ttyp == FIRE_TRAP)
                 || is_pit(ttmp.ttyp)
                 || is_hole(ttmp.ttyp)
                 || (ttmp.ttyp == TELEP_TRAP) || (ttmp.ttyp == LEVEL_TELEP)
                 || (ttmp.ttyp == WEB) || (ttmp.ttyp == MAGIC_TRAP)
                 || (ttmp.ttyp == ANTI_MAGIC))) {
        let mtmp;

        if ((((ttmp.tx) == u.ux) && ((ttmp.ty) == u.uy))) {
            if (u.utraptype != TT_BURIEDBALL)
                reset_utrap(TRUE);
        } else if ((mtmp = m_at(ttmp.tx, ttmp.ty)) != null) {
            mtmp.mtrapped = 0;
        }
        deltrap(ttmp);
        return TRUE;
    }
    return FALSE;
}

/* used for doors (also tins).  can be used for anything else that opens. */
export function b_trapped(item, bodypart) { /* void */
    let lvl = level_difficulty(),
        dmg = rnd(5 + (lvl < 5 ? lvl : 2 + Math.trunc(lvl / 2)));

     ;
    pline(_("KABOOM!!  %s was booby-trapped!"), The(item));
    wake_nearby(FALSE);
    losehp(Maybe_Half_Phys(dmg), _("explosion"), KILLED_BY_AN);
    exercise(A_STR, FALSE);
    if (bodypart != NO_PART)
        exercise(A_CON, FALSE);
    make_stunned((HStun() & TIMEOUT) + dmg, TRUE);
}

/* Monster is hit by trap. */
function thitm(
    tlev,
    mon,
    obj,
    d_override,
    nocorpse) { /* boolean */ /* True: a trap is completely burning up the target */
    let strike;
    let trapkilled = FALSE;

    if (d_override)
        strike = 1;
    else if (obj)
        strike = +(find_mac(mon) + tlev + obj.spe <= rnd(20));
    else
        strike = +(find_mac(mon) + tlev <= rnd(20));

    /* Actually more accurate than thitu, which doesn't take
     * obj->spe into account.
     */
    if (!strike) {
        if (obj && cansee(mon.mx, mon.my))
            pline_mon(mon, _("%s is almost hit by %s!"),
                      Monnam(mon), doname(obj));
    } else {
        let dam = 1;
        let harmless = (obj && stone_missile(obj)
                            && passes_rocks(mon.data) ? 1 : 0);

        if (obj && cansee(mon.mx, mon.my))
            pline_mon(mon, _("%s is hit by %s%s"),
                      Monnam(mon), doname(obj),
                      harmless ? _(" but is not harmed.") : _("!"));
        if (d_override) {
            dam = d_override;
        } else if (obj) {
            dam = dmgval(obj, mon);
            if (dam < 1)
                dam = 1;
        }
        if (!harmless) {
            mon.mhp -= dam;
            if (mon.mhp <= 0) {
                let xx = mon.mx, yy = mon.my;

                monkilled(mon, _(""), nocorpse ? -AD_RBRE : AD_PHYS);
                if (DEADMONSTER(mon)) {
                    newsym(xx, yy);
                    trapkilled = TRUE;
                }
            }
        } else {
            strike = 0; /* harmless; don't use up the missile */
        }
    }
    if (obj && (!strike || d_override)) {
        place_object(obj, mon.mx, mon.my);
        stackobj(obj);
    } else if (obj)
        dealloc_obj(obj);

    return trapkilled;
}

export function unconscious() { /* boolean */
    if (gm.multi >= 0)
        return FALSE;

    return (u.usleep
            || (gn.nomovemsg
                && (!strncmp(gn.nomovemsg, _("You awake"), 9)
                    || !strncmp(gn.nomovemsg, _("You regain con"), 14)
                    || !strncmp(gn.nomovemsg, _("You are consci"), 14))) ? 1 : 0);
}

const lava_killer = init_string(static_array("lava_killer", char, sizeof_string("molten lava")), _("molten lava"), true);

/* hero enters pool of molten lava; returns True if hero is killed and
   then life-saved (with teleport to safe spot), False for other survival;
   no return at all if hero dies and isn't life-saved */
export function lava_effects() { /* boolean */
    var obj, obj2, nextobj;
    var usurvive, boil_away;
    var protect_oid = 0;
    var burncount = 0, burnmesgcount = 0;
    var dmg = d(6, 6); /* only applicable for water walking */

    if (iflags.in_lava_effects) {
        debugpline0(_("Skipping recursive lava_effects()."), __FILE__);
        return FALSE;
    }
    feel_newsym(u.ux, u.uy); /* in case Blind, map the lava here */
    burn_away_slime();
    if (likes_lava(gy.youmonst.data))
        return FALSE;

    usurvive = (Fire_resistance() || (Wwalking() && dmg < u.uhp) ? 1 : 0);
    /*
     * A timely interrupt might manage to salvage your life
     * but not your gear.  For scrolls and potions this
     * will destroy whole stacks, where fire resistant hero
     * survivor only loses partial stacks via destroy_items().
     *
     * Flag items to be destroyed before any messages so
     * that player causing hangup at --More-- won't get an
     * emergency save file created before item destruction.
     */
    if (!usurvive) {
        for (obj = gi.invent; obj; obj = nextobj) {
            nextobj = obj.nobj;
            if (obj.in_use) { /* remove_worn_item() sets in_use */
                /* one item can be protected from burning up [accommodates
                   steal(AMULET_OF_FLYING) -> remove_worn_item() -> fall
                   into lava (which happens before item is transferred
                   from invent to thief->minvent)]; item will still be in
                   inventory when we return to caller or save bones (or
                   perform hangup save if that occurs) */
                if (!protect_oid) {
                    protect_oid = obj.o_id;
                    obj.in_use = 0;
                } else {
                    impossible(
                     _("lava_effects: '%s' (#%u) is already in use; so is #%u."),
                               simpleonames(obj), obj.o_id, protect_oid);
                }
                continue;
            }
            /* set obj->in_use for items which will be destroyed below */
            if ((is_organic(obj) || obj.oclass == POTION_CLASS)
                && !obj.oerodeproof
                && objects[obj.otyp].oc_oprop != FIRE_RES
                && obj.otyp != SCR_FIRE && obj.otyp != SPE_FIREBALL
                && !obj_resists(obj, 0, 0)) /* for invocation items */
                obj.in_use = 1;
        }
    }

    /* Check whether we should burn away boots *first* so we know whether to
     * make the player sink into the lava. Assumption: water walking only
     * comes from boots.
     * (5.0: that assumption is no longer true, but having boots be the first
     * thing to come into contact with lava makes sense.)
     */
    if (uarmf && (uarmf.in_use
                  || (is_organic(uarmf) && !uarmf.oerodeproof))) {
        obj = uarmf;
        pline(_("%s into flame!"), Yobjnam2(obj, _("burst")));
        ++burnmesgcount;
        iflags.in_lava_effects++; /* (see above) */
        Boots_off();
        if (obj.o_id != protect_oid)
            useup(obj);
        iflags.in_lava_effects--;
        ++burncount;
    }

    burn_stuff: { if (!Fire_resistance()) {
        if (Wwalking()) {
            pline_The(_("%s here burns you!"), hliquid(_("lava")));
            if (usurvive) {
                losehp(dmg, lava_killer, KILLED_BY); /* lava damage */
                break burn_stuff;
            }
        } else
            You(_("fall into the %s!"), waterbody_name(u.ux, u.uy));

        usurvive = (Lifesaved() || discover() ? 1 : 0);
        if (wizard())
            usurvive = TRUE;

        /* prevent remove_worn_item() -> Boots_off(WATER_WALKING_BOOTS) ->
           spoteffects() -> lava_effects() recursion which would
           successfully delete (via useupall) the no-longer-worn boots;
           once recursive call returned, we would try to delete them again
           here in the outer call (and access stale memory, probably panic) */
        iflags.in_lava_effects++;

        for (obj = gi.invent; obj; obj = obj2) {
            obj2 = obj.nobj;
            if (obj.o_id == protect_oid) {
                /* skip protected item; caller expects to retain access */
                obj.in_use = 1; /* was cleared when setting protect_oid */
            } else if (obj.otyp == SPE_BOOK_OF_THE_DEAD) {
                if (usurvive && !Blind())
                    pline(_("%s glows a strange %s, but remains intact."),
                          The(xname(obj)), hcolor(_("dark red")));
            } else if (obj.in_use) {
                if (obj.owornmask) {
                    if (usurvive) {
                        pline(_("%s into flame!"), Yobjnam2(obj, _("burst")));
                        ++burnmesgcount;
                    }
                    remove_worn_item(obj, TRUE);
                }
                useupall(obj);
                ++burncount;
            }
        }
        if (usurvive && burncount > burnmesgcount)
            pline(_("%s item%s in your inventory %s been destroyed."),
                  (burnmesgcount > 0)
                    ? ((burncount - burnmesgcount == 1) ? _("Another") : _("Other"))
                    : ((burncount == 1) ? _("An") : _("Some")),
                  plur(burncount - burnmesgcount),
                  (burncount - burnmesgcount == 1) ? _("has") : _("have"));

        /* s/he died... */
        boil_away = +(u.umonnum == PM_WATER_ELEMENTAL
                     || u.umonnum == PM_STEAM_VORTEX
                     || u.umonnum == PM_FOG_CLOUD);
        /* burn to death; if hero is life-saved on the first pass, try
           to teleport to safety; if that fails, burn all over again */
        for (burncount = 0; burncount < 2; ++burncount) {
            u.uhp = -1;
            /* killer format and name are reconstructed every iteration
               because lifesaving resets them */
            svk.killer.format = KILLED_BY;
            strcpy(svk.killer.name, lava_killer);
            urgent_pline(_("You %s..."), boil_away ? _("boil away")
                                                : _("burn to a crisp"));
            done(BURNING);
            if (safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT))
                break; /* successful life-save */
            /* nowhere safe to land; repeat burning loop */
            pline(_("You're still burning."));
        }

        iflags.in_lava_effects--;

        if (burncount == 2) {
            /* life-saved twice (second time must have been due to declining
               to die in wizard|explore mode) and failed to be teleported
               to safety both times; moveloop() will just drop the hero into
               the lava again on next move so take countermeasures to give
               the player--or the debug fuzzer--a chance to try something
               else instead of just immediately burning up all over again */
            if (!Fire_resistance())
                set_itimeout(ref_of(u.uprops[FIRE_RES], "intrinsic"), 5);
            if (!Wwalking())
                set_itimeout(ref_of(u.uprops[WWALKING], "intrinsic"), 5);
            break burn_stuff;
        }
        rescued_from_terrain(BURNING);

        /* normally done via safe_teleds() -> teleds() -> spoteffects() but
           spoteffects() was no-op when called with nonzero in_lava_effects */
        spoteffects(FALSE); /* suppress auto-pickup for this landing... */

        return TRUE;
    } else if (!Wwalking() && (!u.utrap || u.utraptype != TT_LAVA)) {
        boil_away = +!Fire_resistance();
        /* if not fire resistant, sink_into_lava() will quickly be fatal;
           hero needs to escape immediately */
        set_utrap(unsigned((rn1(4, 4) + ((boil_away ? 2
                                                      : rn1(4, 12)) << 8))),
                  TT_LAVA);
        You(_("sink into the %s%s!"), waterbody_name(u.ux, u.uy),
            !boil_away ? _(", but it only burns slightly")
                       : _(" and are about to be immolated"));
        if (Fire_resistance())
            monstseesu(M_SEEN_FIRE);
        else
            monstunseesu(M_SEEN_FIRE);
        if (u.uhp > 1)
            losehp(!boil_away ? 1 : Math.trunc(u.uhp / 2), lava_killer,
                   KILLED_BY); /* lava damage */
    }
 }
     destroy_items(gy.youmonst, AD_FIRE, dmg);
    ignite_items(gi.invent);
    return FALSE;
}

/* called each turn when trapped in lava */
export function sink_into_lava() { /* void */
    let sink_deeper = init_string(static_array("sink_into_lava.sink_deeper", char, sizeof_string("You sink deeper into the lava.")), _("You sink deeper into the lava."), true);

    if (!u.utrap || u.utraptype != TT_LAVA) {
        ; /* do nothing; this usually won't happen but could after
           * polymorphing from a flier into a ceiling hider and then hiding;
           * allmain() only checks whether the hero is at a lava location,
           * not whether he or she is currently sinking */
    } else if (!is_lava(u.ux, u.uy)) {
        reset_utrap(FALSE); /* this shouldn't happen either */
    } else if (!u.uinvulnerable) {
        /* ordinarily we'd have to be fire resistant to survive long
           enough to become stuck in lava, but it can happen without
           resistance if water walking boots allow survival and then
           get burned up; u.utrap time will be quite short in that case */
        if (!Fire_resistance())
            u.uhp = Math.trunc((u.uhp + 2) / 3);

        u.utrap -= (1 << 8);
        if (u.utrap < (1 << 8)) {
            svk.killer.format = KILLED_BY;
            strcpy(svk.killer.name, _("molten lava"));
            urgent_pline(_("You sink below the surface and die."));
            burn_away_slime(); /* add insult to injury? */
            done(DISSOLVED);
            /* can only get here via life-saving; try to get away from lava */
            reset_utrap(TRUE);
            /* levitation or flight have become unblocked, otherwise Tport */
            if (!Levitation() && !Flying())
                safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT);
        } else if (!u.umoved) {
            /* can't fully turn into slime while in lava, but might not
               have it be burned away until you've come awfully close */
            if (Slimed() && rnd(10 - 1) >= (Slimed() & TIMEOUT)) {
                pline(sink_deeper);
                burn_away_slime();
            } else {
                Norep(sink_deeper);
            }
            u.utrap += unsigned(rnd(4));
        }
    }
}

/* called when something has been done (breaking a boulder, for instance)
   which entails a luck penalty if performed on a sokoban level */
export function sokoban_guilt() { /* void */
    if (Sokoban()) {
        u.uconduct.sokocheat++;
        change_luck(-1);
        /*
         * TODO:
         *  Issue some feedback so that player can learn that whatever
         *  he/she just did is a naughty thing to do in sokoban and
         *  should probably be avoided in future....
         *
         *  Caveat:  doing this might introduce message sequencing
         *  issues, depending upon feedback during the various actions
         *  which trigger Sokoban luck penalties.
         */
    }
}

/* called when a trap has been deleted or had its ttyp replaced */
function maybe_finish_sokoban() { /* void */
    let t;

    if (Sokoban() && !gi.in_mklev) {
        /* scan all remaining traps, ignoring any created by the hero;
           if this level has no more pits or holes, the current sokoban
           puzzle has been solved */
        for (t = gf.ftrap; t; t = t.ntrap) {
            if (t.madeby_u)
                continue;
            if (t.ttyp == PIT || t.ttyp == HOLE)
                break;
        }
        if (!t) {
            /* for livelog to report the sokoban depth in the way that
               players tend to think about it: 1 for entry level, 4 for top */
            let sokonum = svd.dungeons[u.uz.dnum].entry_lev - u.uz.dlevel + 1;

            /* we've passed the last trap without finding a pit or hole;
               clear the sokoban_rules flag so that luck penalties for
               things like breaking boulders or jumping will no longer
               be given, and restrictions on diagonal moves are lifted */
            svl.level.flags.sokoban_rules = 0; /* clear svl.level.flags.sokoban_rules */
            /*
             * TODO: give some feedback about solving the sokoban puzzle
             * (perhaps say "congratulations" in Japanese?).
             */

            /* log the completion event regardless of whether or not
               any normal in-game feedback has just been given */
            livelog_printf(LL_MINORAC | LL_DUMP,
                           _("completed %d%s Sokoban level"),
                           sokonum, ordin(sokonum));
        }
    }
}

/* Return the string name of the trap type passed in, unless the player is
   hallucinating, in which case return a random or hallucinatory trap name. */
export function trapname(
    ttyp,
    override) { /* const char * */ /* if True, ignore Hallucination */
    let halu_trapnames = static_array("trapname.halu_trapnames", ptr_to(char), null, [
        /* riffs on actual nethack traps */
        _("bottomless pit"), _("polymorphism trap"), _("devil teleporter"),
        _("falling boulder trap"), _("anti-anti-magic field"), _("weeping gas trap"),
        _("queasy board"), _("electrified web"), _("owlbear trap"), _("sand mine"),
        _("vacillating triangle"),
        /* some traps found in nethack variants */
        _("death trap"), _("disintegration trap"), _("ice trap"), _("monochrome trap"),
        /* plausible real-life traps */
        _("axeblade trap"), _("pool of boiling oil"), _("pool of quicksand"),
        _("field of caltrops"), _("buzzsaw trap"), _("spiked floor"), _("revolving wall"),
        _("uneven floor"), _("finger trap"), _("jack-in-a-box"), _("yellow snow"),
        _("booby trap"), _("rat trap"), _("poisoned nail"), _("snare"), _("whirlpool"),
        _("trip wire"), _("roach motel (tm)"),
        /* sci-fi */
        _("negative space"), _("tensor field"), _("singularity"), _("imperial fleet"),
        _("black hole"), _("thermal detonator"), _("event horizon"),
        _("entoptic phenomenon"),
        /* miscellaneous suggestions */
        _("sweet-smelling gas vent"), _("phone booth"), _("exploding runes"),
        _("never-ending elevator"), _("slime pit"), _("warp zone"), _("illusory floor"),
        _("pile of poo"), _("honey trap"), _("tourist trap"),
        _("banana peel"), _("garden rake"), _("whoopie cushion"), _("box and stick trap"),
        _("fly trap"), _("legal trap"), _("pit of snakes"), _("pollywog trap"),
        _("slippery slope"), _("thirst trap"), _("suntrap"),
    ]);
    let roletrap = static_array("trapname.roletrap", char, 33); /* [17 + 5 + 1] should suffice */

    if (Hallucination() && !override) {
        let total_names = TRAPNUM + SIZE(halu_trapnames),
            nameidx = rn2_on_display_rng(total_names + 1);

        if (nameidx == total_names) {
            let fem = Upolyd() ? u.mfemale : flags.female;

            /* inspired by "tourist trap" */
            copynchars(roletrap,
                       rn2(3) ? ((fem && gu.urole.name.f) ? gu.urole.name.f
                                                          : gu.urole.name.m)
                              : rank_of(u.ulevel, Role_switch(), fem),
                       (sizeof(array_of(char, 33)) - sizeof_string(" trap")));
            strcat(roletrap, _(" trap"));
            return lcase(roletrap);
        } else if (nameidx >= TRAPNUM) {
            nameidx -= TRAPNUM;
            return halu_trapnames[nameidx];
        } /* else use an actual trap type */
        if (nameidx != NO_TRAP)
            ttyp = nameidx;
    }
    return elt(defsyms, trap_to_defsym(ttyp)).explanation;
}

/* Ignite ignitable items (limited to light sources) in the given object
   chain, due to some external source of fire.  The object chain should
   be somewhere exposed, like someone's open inventory or the floor. */
export function ignite_items(objchn) { /* void */
    let obj, nextobj;
    let bynexthere = (objchn && objchn.where == OBJ_FLOOR ? 1 : 0);

    for (obj = objchn; obj; obj = bynexthere ? obj.v.v_nexthere : nextobj) {
        nextobj = obj.nobj;
        /* ignitable items like lamps and candles will catch fire */
        if (!obj.lamplit && !obj.in_use)
            catch_lit(obj);
    }
}

export function trap_ice_effects(x, y, ice_is_melting) { /* void */
    let ttmp = t_at(x, y);

    if (ttmp && ice_is_melting) {
        let mtmp;

        if (((mtmp = m_at(x, y)) != null) && mtmp.mtrapped)
            mtmp.mtrapped = 0;
        if (ttmp.ttyp == LANDMINE || ttmp.ttyp == BEAR_TRAP) {
            /* landmine or bear trap set on top of the ice falls
               into the water */
            let otyp = (ttmp.ttyp == LANDMINE) ? LAND_MINE : BEARTRAP;
            cnv_trap_obj(otyp, 1, ttmp, TRUE);
        } else {
            if (!undestroyable_trap(ttmp.ttyp))
                deltrap(ttmp);
        }
    }
}

/* sanity check traps */
export function trap_sanity_check() { /* void */
    let ttmp = gf.ftrap;

    while (ttmp) {
        if (!isok(ttmp.tx, ttmp.ty))
            impossible(_("trap sanity: location (%i,%i)"), ttmp.tx, ttmp.ty);
        if (ttmp.ttyp <= NO_TRAP || ttmp.ttyp >= TRAPNUM)
            impossible(_("trap sanity: type (%i)"), ttmp.ttyp);
        ttmp = ttmp.ntrap;
    }
}

/*trap.c*/

import { A_LAWFUL } from "./align.h.js";
import { ART_MAGICBANE, ART_STING } from "./artilist.h.js";
import { A_CHA, A_CON, A_DEX, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_dig_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    Something, You_can_move_again, something, the_your, vision_clears,
} from "./decl.h.macros.js";
import {
    POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_DRAGON, S_GIANT, S_HUMAN, S_bear_trap, S_pit, S_web,
    WAND_CLASS,
} from "./defsym.h.js";
import { DISP_END, DISP_FLASH } from "./display.h.js";
import { canspotmon, obj_to_glyph } from "./display.h.macros.js";
import { MIGR_RANDOM, struct_d_level } from "./dungeon.h.js";
import {
    In_endgame, In_sokoban, Is_airlevel, Is_qlocate, Is_stronghold, Is_waterlevel,
} from "./dungeon.h.macros.js";
import { PLNMSG_BACK_ON_GROUND } from "./flag.h.js";
import { discover, wizard } from "./flag.h.macros.js";
import {
    BUFSZ, FALSE, LL_DUMP, LL_MINORAC, MAXULEV, QBUFSZ, TRUE, boolean, coordxy,
} from "./global.h.js";
import {
    ARM, ARTICLE_NONE, ARTICLE_THE, BOLT_LIM, BURNING, CORPSTAT_FEMALE, CORPSTAT_GENDER,
    CORPSTAT_HISTORIC, CORPSTAT_MALE, CORPSTAT_NONE, COST_BURN, COST_CORRODE, COST_CRACK,
    COST_DECHNT, COST_ROT, COST_RUST, CXN_PFX_THE, DIR_ERR, DISMOUNT_FELL, DISMOUNT_GENERIC,
    DISMOUNT_POLY, DISSOLVED, DROWNING, ECMD_OK, ECMD_TIME, FAILEDUNTRAP, FINGER, FOOT, FORCEBUNGLE,
    FORCETRAP, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_PROMPT, GETOBJ_SUGGEST, HAND, HEAD, HURTLING,
    HVY_ENCUMBER, KILLED_BY, KILLED_BY_AN, LAUNCH_KNOWN, LAUNCH_UNSEEN, LEG, MAY_DESTROY,
    MAY_FRACTURE, MAY_HIT, MM_ADJACENTOK, MM_FEMALE, MM_MALE, MM_NOCOUNTBIRTH, MM_NOMSG,
    NC_SHOW_MSG, NOTELL, NOWEBMSG, NO_KILLER_PREFIX, NO_MINVENT, NO_MM_FLAGS, NO_NC_FLAGS, NO_PART,
    NO_TRAP_FLAGS, N_DIRS, POLY_NOFLAGS, RECURSIVETRAP, ROLL, SHOP_HOLE_COST, SLT_ENCUMBER, SPINE,
    STONING, SUPPRESS_SADDLE, TELEDS_ALLOW_DRAG, TELEDS_TELEPORT, TEST_MOVE, TOOKPLUNGE,
    UNENCUMBERED, VIASITTING, VIS_EFFECTS, XKILL_NOMSG,
} from "./hack.h.js";
import {
    DIR_180, IndexOk, Maybe_Half_Phys, ROLL_FROM, You1, Your1, distu, makeknown, mdistu, min, plur,
    qlocate_level, rn1, ynq,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { debugpline0 } from "./lint.h.macros.js";
import { has_mgivenname } from "./mextra.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    AD_ACID, AD_ELEC, AD_FIRE, AD_MAGM, AD_PHYS, AD_RBRE, AD_RUST, AD_SLEE, AT_BREA, AT_MAGC,
} from "./monattk.h.js";
import {
    acidic, amorphous, bigmonst, breathless, can_teleport, ceiling_hider, completelyrusts, digests,
    extra_nasty, flaming, grounded, hides_under, is_animal, is_clinger, is_floater, is_flyer,
    is_golem, is_neuter, is_unicorn, is_whirly, likes_lava, metallivorous, mindless, monsndx,
    nohands, nolimbs, nonliving, passes_rocks, passes_walls, pm_invisible, strongmonst,
    throws_rocks, touch_petrifies, unique_corpstat, unsolid, webmaker,
} from "./mondata.h.macros.js";
import { MS_GUARDIAN, MZ_HUGE, MZ_SMALL } from "./monflag.h.js";
import { M_AP_FURNITURE, M_AP_OBJECT, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_SLEEP } from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, M_AP_TYPE, helpless, is_vampshifter, ismnum, resists_fire, resists_sleep,
    resists_ston,
} from "./monst.h.macros.js";
import {
    PM_ARCHEOLOGIST, PM_BALROG, PM_BALUCHITHERIUM, PM_BUGBEAR, PM_CYCLOPS, PM_DOPPELGANGER,
    PM_FLESH_GOLEM, PM_FOG_CLOUD, PM_GELATINOUS_CUBE, PM_GREMLIN, PM_IRON_GOLEM, PM_JABBERWOCK,
    PM_KRAKEN, PM_LEATHER_GOLEM, PM_LORD_SURTUR, PM_MASTODON, PM_NORN, PM_ORION, PM_OWLBEAR,
    PM_PAPER_GOLEM, PM_PIT_FIEND, PM_PIT_VIPER, PM_PURPLE_WORM, PM_RANGER, PM_ROGUE,
    PM_STEAM_VORTEX, PM_STONE_GOLEM, PM_STRAW_GOLEM, PM_TITANOTHERE, PM_WATER_ELEMENTAL,
    PM_WOOD_GOLEM,
} from "./monsters.h.js";
import {
    BURIED_TOO, CONTAINED_TOO, EF_DESTROY, EF_GREASE, EF_NONE, EF_PAY, EF_VERBOSE, ERODE_BURN,
    ERODE_CORRODE, ERODE_CRACK, ERODE_ROT, ERODE_RUST, ER_DAMAGED, ER_DESTROYED, ER_GREASED,
    ER_NOTHING, MAX_ERODE, OBJ_FLOOR, struct_obj,
} from "./obj.h.js";
import {
    Has_contents, Is_box, Is_container, OMONST, ONAME, Waterproof_container, bimanual, carried,
    has_omonst, has_oname, is_blade, is_plural, is_wet_towel, mcarried, stone_missile, u_wield_art,
} from "./obj.h.macros.js";
import { DRAGON_HIDE, IRON } from "./objclass.h.js";
import { is_corrodeable, is_crackable, is_organic, is_rustprone } from "./objclass.h.macros.js";
import {
    ARROW, BEARTRAP, BOULDER, CAN_OF_GREASE, CHEST, CORPSE, DART, FIRE_HORN, ICE_BOX, IRON_SHOES,
    KICKING_BOOTS, LAND_MINE, LARGE_BOX, LOADSTONE, POT_ACID, POT_OIL, POT_WATER, ROCK, SADDLE,
    SCR_BLANK_PAPER, SCR_FIRE, SCR_MAIL, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL,
    SPE_NOVEL, SPE_REMOVE_CURSE, STATUE, TOWEL, WAN_FIRE,
} from "./objects.h.js";
import {
    CONFUSION, DEAF, FIRE_RES, FROMOUTSIDE, INVIS, I_SPECIAL, LEFT_SIDE, LEVITATION, RIGHT_SIDE,
    TIMEOUT, WWALKING, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SADDLE, W_SWAPWEP,
    W_WEP,
} from "./prop.h.js";
import {
    CORR, DB_FLOOR, DB_ICE, DB_UNDER, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_ISOPEN,
    D_NODOOR, D_TRAPPED, IRONBARS, LADDER, ROOM, SCORR, SDOOR, STAIRS, STONE,
} from "./rm.h.js";
import {
    IS_AIR, IS_DOOR, IS_FURNITURE, IS_OBSTRUCTED, IS_ROOM, IS_STWALL, IS_TREE, IS_WALL,
    IS_WATERWALL, OBJ_AT, Sokoban, ZAP_POS, fobj, levl, m_at, trap_to_defsym,
} from "./rm.h.macros.js";
import {
    se_squeak_A, se_squeak_B, se_squeak_B_flat, se_squeak_C, se_squeak_D, se_squeak_D_flat,
    se_squeak_E, se_squeak_E_flat, se_squeak_F, se_squeak_F_sharp, se_squeak_G, se_squeak_G_sharp,
} from "./seffects.h.js";
import { P_BASIC, P_RIDING } from "./skills.h.js";
import { P_SKILL } from "./skills.h.macros.js";
import { MELT_ICE_AWAY } from "./timeout.h.js";
import {
    ANIMATE_NORMAL, ANIMATE_SHATTER, ANIMATE_SPELL, ANTI_MAGIC, ARROW_TRAP, AS_MON_IS_UNIQUE,
    AS_NO_MON, AS_OK, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL,
    MAGIC_TRAP, NO_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP,
    SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, TRAPNUM, TRAPPED_CHEST, TRAPPED_DOOR,
    TRAP_CLEARLY_IMMUNE, TRAP_HIDDEN_IMMUNE, TRAP_NOT_IMMUNE, Trap_Caught_Mon, Trap_Effect_Finished,
    Trap_Is_Gone, Trap_Killed_Mon, Trap_Moved_Mon, VIBRATING_SQUARE, WEB, struct_trap,
    struct_vlaunchinfo,
} from "./trap.h.js";
import {
    dealloc_trap, fixed_tele_trap, is_hole, is_pit, is_xport, newtrap, undestroyable_trap,
    unhideable_trap,
} from "./trap.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { WT_ELF, WT_TOOMUCH_DIAGONAL } from "./weight.h.js";
import { clear_nhwindow, display_nhwindow, nh_delay_output } from "./winprocs.h.macros.js";
import {
    TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_NONE, TT_PIT, TT_WEB, UTOTYPE_FALLING,
    UTOTYPE_NONE,
} from "./you.h.js";
import { Luck, Role_if, Role_switch, Upolyd, m_next2u, next2u, u_at } from "./you.h.macros.js";
import {
    Amphibious, Antimagic, BFlying, BLevitation, Blind, Breathless, Confusion, Deaf,
    Drain_resistance, EInvis, Fire_resistance, Flying, Free_action, Fumbling, HConfusion,
    HHallucination, HInvis, HStun, Half_physical_damage, Half_spell_damage, Halluc_resistance,
    Hallucination, Invis, Lev_at_will, Levitation, Lifesaved, Passes_walls, Punished, See_invisible,
    Shock_resistance, Sleep_resistance, Slimed, Stone_resistance, Stunned, Swimming,
    Teleport_control, Teleportation, Unaware, Unchanging, Underwater, Wwalking,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, ord, schar, short, sizeof, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, not64, or64 } from "../rt/int64.js";
import { assert, memset, sprintf, strcat, strchr, strcmp, strcpy, strncmp } from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_struct,
    static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, elt, ptr_to, ref_of, struct_assign } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import {
    catch_lit, check_leash, maybe_dunk_boulders, next_to_u, number_leashed, splash_lit, unleash_all,
} from "./apply.js";
import { attacks, defends_when_carried, has_magic_key, is_art } from "./artifact.js";
import {
    adjalign, adjattrib, change_luck, exercise, minuhpmax, poisoned, setuhpmax,
} from "./attrib.js";
import { ballfall, drag_ball, move_bc, placebc, unplacebc } from "./ball.js";
import { bot, rank_of } from "./botl.js";
import { getdir, isok, xytodir } from "./cmd.js";
import {
    destroy_drawbridge, find_drawbridge, is_drawbridge_wall, is_ice, is_lava, is_pool,
    is_pool_or_lava, is_waterwall,
} from "./dbridge.js";
import {
    cg, disp, flags, ga, gb, gf, gi, gk, gl, gm, gn, gs, gt, gu, gv, gx, gy, iflags, materialnm,
    svc, svd, svk, svl, u, vowels, xdir, ydir,
} from "./decl.js";
import { buried_ball, bury_an_obj, fillholetyp, liquid_flow, unearth_objs } from "./dig.js";
import {
    canseemon, curs_on_u, feel_newsym, map_invisible, map_trap, newsym, shieldeff, tmp_at,
    under_water,
} from "./display.js";
import { dropx, flooreffects, schedule_goto, set_wounded_legs } from "./do.js";
import {
    Amonnam, Monnam, YMonnam, a_monnam, christen_monst, hcolor, hliquid, mon_nam, mon_pmname,
    noit_Monnam, obj_pmname, rndcolor, rndmonnam, x_monnam, y_monnam,
} from "./do_name.js";
import { Boots_off, hard_helmet } from "./do_wear.js";
import { abuse_dog, tamedog, wary_dog } from "./dog.js";
import { down_gate, impact_drop, ship_object } from "./dokick.js";
import { defsyms } from "./drawing.js";
import {
    Can_fall_thru, In_hell, In_quest, assign_level, at_dgn_entrance, ceiling, depth, dunlev,
    dunlevs_in_dungeon, find_hell, get_level, has_ceiling, level_difficulty, on_level,
    single_level_branch, surface, u_on_newpos, update_lastseentyp,
} from "./dungeon.js";
import { is_fainted, reset_faint } from "./eat.js";
import { done, panic } from "./end.js";
import { can_reach_floor, del_engr_at } from "./engrave.js";
import { losexp, more_experienced, newexplevel } from "./exper.js";
import { scatter } from "./explode.js";
import {
    bad_rock, calc_capacity, check_capacity, crawl_destination, in_rooms, inv_cnt, inv_weight,
    losehp, movobj, near_capacity, nomul, set_uinwater, spot_checks, spoteffects, test_move,
    u_locomotion, unmul, weight_cap,
} from "./hack.js";
import {
    copynchars, distmin, eos, lcase, ordin, s_suffix, sgn, strncmpi, strsubst, upstart,
} from "./hacklib.js";
import {
    carrying, consume_obj_charge, currency, delobj, getobj, nxtobj, prinv, sobj_at, stackobj,
    update_inventory, useup, useupall,
} from "./invent.js";
import { stumble_on_door_mimic } from "./lock.js";
import { makemon, set_malign } from "./makemon.js";
import { sleep_monst } from "./mhitm.js";
import { set_levltyp } from "./mkmaze.js";
import {
    add_to_container, add_to_migration, costly_alteration, dealloc_obj, is_flammable, is_rottable,
    mkcorpstat, mksobj, obj_extract_self, obj_ice_effects, place_object, rndmonnum_adj, splitobj,
    weight,
} from "./mkobj.js";
import {
    killed, m_in_air, maybe_unhide_at, mlifesaver, mon_to_stone, mongone, monkilled, monstone,
    newcham, seemimic, set_ustuck, setmangry, shieldeff_mon, vamp_stone, wake_nearby, wake_nearto,
    wakeup, xkilled,
} from "./mon.js";
import {
    attacktype, defended, mon_knows_traps, mon_learns_traps, mons_see_trap, monstseesu,
    monstunseesu, poly_when_stoned, resists_blnd, resists_magm, stagger, sticks,
} from "./mondata.js";
import { closed_door } from "./monmove.js";
import { mons } from "./monst.js";
import { hits_bars, linedup, m_carrying, ohitmon, thitu } from "./mthrowu.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    The, Tobjnam, Yname2, Yobjnam2, an, ansimpleoname, aobjnam, bare_artifactname,
    cloak_simple_name, corpse_xname, cxname, doname, erosion_matters, gloves_simple_name,
    helm_simple_name, just_an, makeplural, otense, safe_qbuf, simpleonames, suit_simple_name, the,
    vtense, xname, yname,
} from "./objnam.js";
import { ice_descr, waterbody_name } from "./pager.js";
import { encumber_msg, pickup } from "./pickup.js";
import {
    Norep, There, You, You_cant, You_feel, You_hear, You_see, Your, impossible, livelog_printf,
    pline, pline_The, pline_mon, pline_xy, set_msg_xy, urgent_pline,
} from "./pline.js";
import { body_part, float_vs_flight, mbodypart, polymon, polyself } from "./polyself.js";
import {
    incr_itimeout, make_blinded, make_hallucinated, make_stunned, self_invis_message, set_itimeout,
    split_mon,
} from "./potion.js";
import { is_quest_artifact, quest_info } from "./questpgr.js";
import { cant_revive, seffects, unpunish } from "./read.js";
import { create_gas_cloud } from "./region.js";
import { d, rn2, rn2_on_display_rng, rnd, rnl } from "./rnd.js";
import {
    add_damage, costly_spot, delete_contents, inside_shop, make_angry_shk, obfree, sellobj,
    shk_your, shop_keeper, shopdig, stolen_value,
} from "./shk.js";
import { mpickobj, remove_worn_item } from "./steal.js";
import { dismount_steed, rider_cant_reach } from "./steed.js";
import {
    domagicportal, dotele, goodpos, level_tele_trap, mlevel_tele_trap, mtele_trap, noteleport_level,
    random_teleport_level, rloco, safe_teleds, tele_trap, teleds,
} from "./teleport.js";
import { burn_away_slime, fall_asleep, spot_stop_timers } from "./timeout.js";
import { stumble_onto_mimic } from "./uhitm.js";
import { recalc_block_point, unblock_point, vision_recalc } from "./vision.js";
import { dmgval, dry_a_towel, mwepgone, wet_a_towel } from "./weapon.js";
import { uswapwepgone, uwepgone, welded } from "./wield.js";
import { mon_has_amulet } from "./wizard.js";
import { count_wsegs } from "./worm.js";
import {
    extract_from_minvent, find_mac, m_dowear, mon_adjust_speed, setnotworn, update_mon_extrinsics,
    which_armor,
} from "./worn.js";
import {
    blank_novel, burn_floor_objects, destroy_items, destroy_strings, fracture_rock,
    get_obj_location, inventory_resistance_check, melt_ice, montraits, obj_resists, poly_obj,
    resist,
} from "./zap.js";
const __FILE__ = "trap.c";
