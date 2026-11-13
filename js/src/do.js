/* NetHack 5.0	do.c	$NHDT-Date: 1774269965 2026/03/23 04:46:05 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.404 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

/* Contains code for 'd', 'D' (drop), '>', '<' (up, down) */

    /* static boolean badspot(coordxy,coordxy); */

/* the #drop command: drop one inventory item */
export function dodrop() { /* int */
    let result;

    if (chars[u.ushops])
        sellobj_state(SELL_DELIBERATE);
    result = drop(getobj(_("drop"), any_obj_ok,
                         GETOBJ_PROMPT | GETOBJ_ALLOWCNT));
    if (chars[u.ushops])
        sellobj_state(SELL_NORMAL);
    if (result)
        reset_occupations();

    return result;
}

/* Called when a boulder is dropped, thrown, or pushed.  If it ends up
 * in a pool, it either fills the pool up or sinks away.  In either case,
 * it's gone for good...  If the destination is not a pool, returns FALSE.
 */
export function boulder_hits_pool(
    otmp,
    rx, ry,
    pushing) { /* boolean */ /* for a boulder, whether or not it is being pushed */
    const $frame = stack_frame(); try {
    if (!otmp || otmp.otyp != BOULDER) {
        impossible(_("Not a boulder?"));
    } else if (is_pool_or_lava(rx, ry)) {
        let lava = is_lava(rx, ry), fills_up;
        let what = waterbody_name(rx, ry);
        let ltyp = levl()[rx][ry].typ;
        let chance = rn2(10); /* water: 90%; lava: 10% */
        let mtmp;

        /* chance for boulder to fill pool:  Plane of Water==0%,
           lava 10%, wall of water==50%, other water==90% */
        fills_up = Is_waterlevel(u.uz) ? FALSE
                   : IS_WATERWALL(ltyp) ? +(chance < 5)
                     : lava ? +(chance == 0) : +(chance != 0);

        if (fills_up) {
            let ttmp = t_at(rx, ry);

            if (ltyp == DRAWBRIDGE_UP) {
                levl()[rx][ry].flags &= ~DB_UNDER; /* clear lava */
                levl()[rx][ry].flags |= DB_FLOOR;
            } else {
                levl()[rx][ry].typ = ROOM, levl()[rx][ry].flags = 0;
                recalc_block_point(rx, ry);
            }
            /* 5.0: normally DEADMONSTER() is used when traversing the fmon
               list--dead monsters usually aren't still at specific map
               locations; however, if ice melts causing a giant to drown,
               that giant would still be on the map when it drops inventory;
               if it was carrying a boulder which now fills the pool, 'mtmp'
               will be dead here; killing it again would yield impossible
               "dmonsfree: N removed doesn't match N+1 pending" when other
               monsters have finished their current turn */
            if ((mtmp = m_at(rx, ry)) != null && !DEADMONSTER(mtmp)
                && !m_in_air(mtmp))
                mondied(mtmp);

            if (ttmp)
                delfloortrap(ttmp);
            bury_objs(rx, ry);

            newsym(rx, ry);
            if (pushing) {
                let whobuf = stack_array(char, BUFSZ);

                strcpy(whobuf, _("you"));
                if (u.usteed)
                    strcpy(whobuf, y_monnam(u.usteed));
                pline(_("%s %s %s into the %s."), upstart(whobuf),
                      vtense(whobuf, _("push")), the(xname(otmp)), what);
                if (flags.verbose && !Blind())
                    pline(_("Now you can cross it!"));
                /* no splashing in this case */
            }
        }
        if (!fills_up || !pushing) { /* splashing occurs */
            if (!u.uinwater) {
                if (pushing ? !Blind() : cansee(rx, ry)) {
                    There(_("is a large splash as %s %s the %s."),
                          the(xname(otmp)), fills_up ? _("fills") : _("falls into"),
                          what);
                } else if (!Deaf()) {
                    if (lava) {
                         ;
                    } else {
                         ;
                    }
                    You_hear(_("a%s splash."), lava ? _(" sizzling") : _(""));
                }
                wake_nearto(rx, ry, 40);
            }

            if (fills_up && u.uinwater && distu(rx, ry) == 0) {
                set_uinwater(0); /* u.uinwater = 0 */
                docrt();
                gv.vision_full_recalc = 1;
                You(_("find yourself on dry land again!"));
            } else if (lava && next2u(rx, ry)) {
                let dmg;

                You(_("are hit by molten %s%c"),
                    hliquid(_("lava")), Fire_resistance() ? ord('.') : ord('!'));
                burn_away_slime();
                dmg = d((Fire_resistance() ? 1 : 3), 6);
                losehp(Maybe_Half_Phys(dmg), /* lava damage */
                       _("molten lava"), KILLED_BY);
            } else if (!fills_up && flags.verbose
                       && (pushing ? !Blind() : cansee(rx, ry))) {
                pline(_("It sinks without a trace!"));
            }
        }

        /* boulder is now gone */
        if (pushing)
            useupf(otmp, otmp.quan);
        else
            obfree(otmp, null);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* Used for objects which sometimes do special things when dropped; must be
 * called with the object not in any chain.  Returns TRUE if the object goes
 * away.
 */
export function flooreffects(
    obj,
    x, y,
    verb) { /* boolean */ /* "fall", "drop", "land", &c */
    const $frame = stack_frame(); try {
    var t;
    var mtmp;
    var otmp = stack_var(ptr_to(struct_obj));
    var save_bhitpos = stack_struct(struct_nhcoord);
    var tseen;
    var ttyp = NO_TRAP, res = FALSE;

    if (obj.where != OBJ_FREE)
        panic(_("flooreffects: obj not free"));

    /* make sure things like water_damage() have no pointers to follow */
    obj.nobj = obj.v.v_nexthere = null;
    /* erode_obj() (called from water_damage() or lava_damage()) needs
       bhitpos, but that was screwing up wand zapping that called us from
       rloco(), so we now restore bhitpos before we return */
    struct_assign(save_bhitpos, gb.bhitpos);
    gb.bhitpos.x = x, gb.bhitpos.y = y;

    if (obj.otyp == BOULDER && boulder_hits_pool(obj, x, y, FALSE)) {
        res = TRUE;
    } else if (obj.otyp == BOULDER && (t = t_at(x, y)) != null
               && (is_pit(t.ttyp) || is_hole(t.ttyp))) {
        ttyp = t.ttyp;
        tseen = t.tseen ? TRUE : FALSE;
        deletedwithboulder: { if (((mtmp = m_at(x, y)) && mtmp.mtrapped)
            || (u.utrap && u_at(x,y))) {
            if (chars[verb] && (cansee(x, y) || distu(x, y) == 0))
                pline(_("%s boulder %s into the pit%s."),
                      Blind() ? _("A") : _("The"),
                      vtense(0, verb),
                      mtmp ? _("") : _(" with you"));
            if (mtmp) {
                if (!passes_walls(mtmp.data) && !throws_rocks(mtmp.data)) {
                    /* dieroll was rnd(20); 1: maximum chance to hit
                       since trapped target is a sitting duck */
                    var damage, dieroll = 1;

                    /* As of 3.6.2: this was calling hmon() unconditionally
                       so always credited/blamed the hero but the boulder
                       might have been thrown by a giant or launched by
                       a rolling boulder trap triggered by a monster or
                       dropped by a scroll of earth read by a monster */
                    if (svc.context.mon_moving) {
                        /* normally we'd use ohitmon() but it can call
                           drop_throw() which calls flooreffects() */
                        damage = dmgval(obj, mtmp);
                        mtmp.mhp -= damage;
                        if (DEADMONSTER(mtmp)) {
                            if (canspotmon(mtmp))
                                pline(_("%s is %s!"), Monnam(mtmp),
                                      (nonliving(mtmp.data)
                                       || is_vampshifter(mtmp))
                                      ? _("destroyed") : _("killed"));
                            mondied(mtmp);
                        }
                    } else {
                        hmon(mtmp, obj, HMON_THROWN, dieroll);
                    }
                    if (!DEADMONSTER(mtmp) && !is_whirly(mtmp.data))
                        res = FALSE; /* still alive, boulder still intact */
                    (res);
                }
                mtmp.mtrapped = 0;
            } else {
                if (!Passes_walls() && !throws_rocks(gy.youmonst.data)) {
                    losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(15)) + 1) / 2))) : (rnd(15))),
                           _("squished under a boulder"), NO_KILLER_PREFIX);
                    break deletedwithboulder;
                } else
                    reset_utrap(TRUE);
            }
        }
        if (chars[verb]) {
            if (Blind() && u_at(x, y)) {
                 ;
                You_hear(_("a CRASH! beneath you."));
            } else if (!Blind() && cansee(x, y)) {
                pline_The(_("boulder %s%s."),
                          (ttyp == TRAPDOOR && !tseen) ? _("triggers and ") : _(""),
                          (ttyp == TRAPDOOR) ? _("plugs a trap door")
                          : (ttyp == HOLE) ? _("plugs a hole")
                            : _("fills a pit"));
            } else {
                 ;
                You_hear(_("a boulder %s."), verb);
            }
        }
        /*
         * Note:  trap might have gone away via ((hmon -> killed -> xkilled)
         *  || mondied) -> mondead -> m_detach -> fill_pit.
         */
 }
        /* creating a pit in ice results in that ice being turned into
           floor so we shouldn't need any special ice handing here */
        if ((t = t_at(x, y)) != null) {
            delfloortrap(t);
            if (u.utrap && u_at(x, y))
                reset_utrap(FALSE);
        }
        useupf(obj, 1);
        bury_objs(x, y);
        newsym(x, y);
        res = TRUE;
    } else if (is_lava(x, y)) {
        res = lava_damage(obj, x, y);
    } else if (is_pool(x, y)) {
        /* Reasonably bulky objects (arbitrary) splash when dropped.
         * If you're floating above the water even small things make
         * noise.  Stuff dropped near fountains always misses */
        if ((Blind() || (Levitation() || Flying())) && !Deaf() && u_at(x, y)) {
            if (!Underwater()) {
                if (weight(obj) > WT_SPLASH_THRESHOLD) {
                    pline(_("Splash!"));
                } else if (Levitation() || Flying()) {
                    pline(_("Plop!"));
                }
            }
            map_background(x, y, 0);
            newsym(x, y);
        }
        res = +(water_damage(obj, 0, FALSE) == ER_DESTROYED);
    } else if (u_at(x, y) && (t = t_at(x, y)) != null
               && (uteetering_at_seen_pit(t) || uescaped_shaft(t))) {
        if (is_pit(t.ttyp)) {
            if (Blind() && !Deaf()) {
                 ;
                You_hear(_("%s tumble downwards."), the(xname(obj)));
            } else {
                pline(_("%s into %s pit."), Tobjnam(obj, _("tumble")),
                      the_your()[t.madeby_u]);
            }
        } else if (ship_object(obj, x, y, FALSE)) {
            /* ship_object will print an appropriate "the item falls
             * through the hole" message, so no need to do it here. */
            res = TRUE;
        }
    } else if (obj.globby) {
        var globbyobj = stack_var(ptr_to(struct_obj), obj);  /* allow obj to be nonnull arg */

        /* Globby things like puddings might stick together */
        while (globbyobj[0]
               && (otmp[0] = obj_nexto_xy(globbyobj[0], x, y, TRUE)) != null) {
            pudding_merge_message(globbyobj[0], otmp[0]);
            /* intentionally not getting the melded object; obj_meld may set
             * obj to null. */
            obj_meld(globbyobj, otmp);
        }
        res = (+!globbyobj[0]);
    } else if (svc.context.mon_moving && IS_ALTAR(levl()[x][y].typ)
               && cansee(x,y)) {
        doaltarobj(obj);
    } else if (obj.oclass == POTION_CLASS && svl.level.flags.temperature > 0
               && (levl()[x][y].typ == ROOM || levl()[x][y].typ == CORR)) {
        /* Potions are sometimes destroyed when landing on very hot
           ground. The basic odds are 50% for nonblessed potions and
           30% for blessed potions; if you have handled the object
           (i.e. it is or was yours), these odds are adjusted by Luck
           (each Luck point affects them by 2%). Artifact potions
           would not be affected, if any existed.

           Oil is not affected because its boiling point (and flash
           point) are higher than that of water. For example, whale
           oil, one of the substances traditionally used in oil lamps,
           can survive over 100 degrees Centigrade more heat than
           water can.*/
        if (cansee(x,y)) {
            /* unconditional "ground" is safe as this only runs for
               room and corridor tiles */
            pline(_("%s up as %s the hot ground."), Tobjnam(obj, _("heat")),
                  is_plural(obj) ? _("they hit") : _("it hits"));
        }

        var survival_chance = obj.blessed ? 70 : 50;
        if (obj.invlet)
            survival_chance += Luck() * 2;
        if (obj.otyp == POT_OIL)
            survival_chance = 100;

        if (!obj_resists(obj, survival_chance, 100)) {
            if (cansee(x,y)) {
                pline(_("%s from the heat!"),
                      is_plural(obj) ? _("They shatter") : _("It shatters"));
            } else {
                You_hear(_("a shattering noise."));
            }
            breakobj(obj, x, y, FALSE, FALSE);
            res = TRUE;
        }
    }

    struct_assign(gb.bhitpos, save_bhitpos);
    return res;
    } finally { stack_pop($frame); }
}

/* obj is an object dropped on an altar */
export function doaltarobj(obj) { /* void */
    if (Blind())
        return;

    if (obj.oclass != COIN_CLASS) {
        /* KMH, conduct */
        if (!svc.context.mon_moving && !u.uconduct.gnostic++)
            livelog_printf(LL_CONDUCT,
                           _("eschewed atheism, by dropping %s on an altar"),
                           doname(obj));
    } else {
        /* coins don't have bless/curse status */
        obj.blessed = obj.cursed = 0;
    }

    if (obj.blessed || obj.cursed) {
        There(_("is %s flash as %s %s the altar."),
              an(hcolor(obj.blessed ? NH_AMBER() : NH_BLACK())), doname(obj),
              otense(obj, _("hit")));
        if (!Hallucination())
            obj.bknown = 1; /* ok to bypass set_bknown() */
    } else {
        pline(_("%s %s on the altar."), Doname2(obj), otense(obj, _("land")));
        if (obj.oclass != COIN_CLASS)
            obj.bknown = 1; /* ok to bypass set_bknown() */
    }
}

/* If obj is neither formally identified nor informally called something
 * already, prompt the player to call its object type. */
export function trycall(obj) { /* void */
    if (!objects[obj.otyp].oc_name_known && !objects[obj.otyp].oc_uname)
        docall(obj);
}

/* Transforms the sink at the player's position into
   a fountain, throne, altar or grave. */
export function polymorph_sink() { /* void */
    let sym = S_sink;
    let sinklooted;
    let algn;

    if (levl()[u.ux][u.uy].typ != SINK)
        return;

    sinklooted = +(levl()[u.ux][u.uy].flags != 0);
    /* svl.level.flags.nsinks--; // set_levltyp() will update this */
    levl()[u.ux][u.uy].flags = 0;
    switch (rn2(4)) {
    default:
    case 0:
        sym = S_fountain;
        set_levltyp(u.ux, u.uy, FOUNTAIN); /* updates level.flags.nfountains */
        levl()[u.ux][u.uy].horizontal = 0;
        if (sinklooted) levl()[u.ux][u.uy].flags |= F_LOOTED
;
        break;
    case 1:
        sym = S_throne;
        set_levltyp(u.ux, u.uy, THRONE);
        if (sinklooted)
            levl()[u.ux][u.uy].flags = T_LOOTED;
        break;
    case 2:
        sym = S_altar;
        set_levltyp(u.ux, u.uy, ALTAR);
        /* 3.6.3: this used to pass 'rn2(A_LAWFUL + 2) - 1' to
           Align2amask() but that evaluates its argument more than once */
        algn = rn2(3) - 1; /* -1 (A_Cha) or 0 (A_Neu) or +1 (A_Law) */
        levl()[u.ux][u.uy].flags = ((Inhell() && rn2(3)) ? AM_NONE
                                      : Align2amask(algn));
        break;
    case 3:
        sym = S_room;
        set_levltyp(u.ux, u.uy, ROOM);
        make_grave(u.ux, u.uy, 0);
        if (levl()[u.ux][u.uy].typ == GRAVE)
            sym = S_grave;
        break;
    }
    /* give message even if blind; we know we're not levitating,
       so can feel the outcome even if we can't directly see it */
    if (levl()[u.ux][u.uy].typ != ROOM)
        pline_The(_("sink transforms into %s!"), an(defsyms[sym].explanation));
    else
        pline_The(_("sink vanishes."));
    newsym(u.ux, u.uy);
}

/* Teleports the sink at the player's position;
   return True if sink teleported. */
function teleport_sink() { /* boolean */
    let cx, cy;
    let alreadylooted;
    let trycnt = 0;

    do {
        cx = 1 + rnd((COLNO - 1) - 2); /* 2..COLNO-2 */
        cy = 1 + rn2(ROWNO - 2);       /* 1..ROWNO-2 */

        if (levl()[cx][cy].typ == ROOM
            && !t_at(cx, cy) && !engr_at(cx, cy)
            && (!cansee(cx, cy) || distu(cx, cy) > 3 * 3)) {
            /* this ends up having set_levltyp() count all sinks and
               fountains on the level twice but that is not a problem */
            alreadylooted = levl()[u.ux][u.uy].flags;
            /* remove old sink */
            set_levltyp(u.ux, u.uy, ROOM); /* was SINK so updates nsinks */
            levl()[u.ux][u.uy].flags = 0;
            newsym(u.ux, u.uy);
            /* create sink at new position */
            set_levltyp(cx, cy, SINK); /* now SINK so also updates nsinks */
            levl()[cx][cy].flags = alreadylooted ? 1 : 0;
            newsym(cx, cy);
            return TRUE;
        }
    } while (++trycnt < 200);

    return FALSE;
}

/* obj is a ring being dropped over a kitchen sink */
function dosinkring(obj) { /* void */
    let $goto = null;
    var otmp, otmp2;
    var ideed = TRUE;
    var nosink = FALSE;

    You(_("drop %s down the drain."), doname(obj));
    obj.in_use = TRUE;  /* block free identification via interrupt */
    $goto_giveback: for (;;) { switch ($goto || (obj.otyp)) { /* effects that can be noticed without eyes */
    case RIN_SEARCHING:
        You(_("thought %s got lost in the sink, but there it is!"), yname(obj));
        { $goto = "giveback"; continue $goto_giveback; }
    case RIN_SLOW_DIGESTION:
        pline_The(_("ring is regurgitated!"));
 case "giveback": $goto = null;
        obj.in_use = FALSE;
        dropx(obj);
        trycall(obj);
        return;
    case RIN_LEVITATION:
        pline_The(_("sink quivers upward for a moment."));
        break;
    case RIN_POISON_RESISTANCE:
        You(_("smell rotten %s."), makeplural(fruitname(FALSE)));
        break;
    case RIN_AGGRAVATE_MONSTER:
        pline(_("Several %s buzz angrily around the sink."),
              Hallucination() ? makeplural(rndmonnam(0)) : _("flies"));
        break;
    case RIN_SHOCK_RESISTANCE:
        pline(_("Static electricity surrounds the sink."));
        break;
    case RIN_CONFLICT:
        ;
        You_hear(_("loud noises coming from the drain."));
        break;
    case RIN_SUSTAIN_ABILITY: /* KMH */
        pline_The(_("%s flow seems fixed."), hliquid(_("water")));
        break;
    case RIN_GAIN_STRENGTH:
        pline_The(_("%s flow seems %ser now."),
                  hliquid(_("water")),
                  (obj.spe < 0) ? _("weak") : _("strong"));
        break;
    case RIN_GAIN_CONSTITUTION:
        pline_The(_("%s flow seems %ser now."),
                  hliquid(_("water")),
                  (obj.spe < 0) ? _("less") : _("great"));
        break;
    case RIN_INCREASE_ACCURACY: /* KMH */
        pline_The(_("%s flow %s the drain."),
                  hliquid(_("water")),
                  (obj.spe < 0) ? _("misses") : _("hits"));
        break;
    case RIN_INCREASE_DAMAGE:
        pline_The(_("water's force seems %ser now."),
                  (obj.spe < 0) ? _("small") : _("great"));
        break;
    case RIN_HUNGER:
        ideed = FALSE;
        for (otmp = svl.level.objects[u.ux][u.uy]; otmp; otmp = otmp2) {
            otmp2 = otmp.v.v_nexthere;
            if (otmp != uball && otmp != uchain
                && !obj_resists(otmp, 1, 99)) {
                if (!Blind()) {
                    pline(_("Suddenly, %s %s from the sink!"), doname(otmp),
                          otense(otmp, _("vanish")));
                    ideed = TRUE;
                }
                delobj(otmp);
            }
        }
        break;
    case MEAT_RING:
        /* Not the same as aggravate monster; besides, it's obvious. */
        pline(_("Several flies buzz around the sink."));
        break;
    case RIN_TELEPORTATION:
        nosink = teleport_sink();
        /* give message even if blind; we know we're not levitating,
           so can feel the outcome even if we can't directly see it */
        pline_The(_("sink %svanishes."), nosink ? _("") : _("momentarily "));
        ideed = FALSE;
        break;
    case RIN_POLYMORPH:
        polymorph_sink();
        nosink = TRUE;
        /* for S_room case, same message as for teleportation is given */
        ideed = +(levl()[u.ux][u.uy].typ != ROOM);
        break;
    default:
        ideed = FALSE;
        break;
    } break; }
    if (!Blind() && !ideed) {
        ideed = TRUE;
        switch (obj.otyp) { /* effects that need eyes */
        case RIN_ADORNMENT:
            pline_The(_("faucets flash brightly for a moment."));
            break;
        case RIN_REGENERATION:
            pline_The(_("sink looks as good as new."));
            break;
        case RIN_INVISIBILITY:
            You(_("don't see anything happen to the sink."));
            break;
        case RIN_FREE_ACTION:
            You_see(_("the ring slide right down the drain!"));
            break;
        case RIN_SEE_INVISIBLE:
            You_see(_("some %s in the sink."),
                    Hallucination() ? _("oxygen molecules") : _("air"));
            break;
        case RIN_STEALTH:
            pline_The(_("sink seems to blend into the floor for a moment."));
            break;
        case RIN_FIRE_RESISTANCE:
            pline_The(_("hot %s faucet flashes brightly for a moment."),
                      hliquid(_("water")));
            break;
        case RIN_COLD_RESISTANCE:
            pline_The(_("cold %s faucet flashes brightly for a moment."),
                      hliquid(_("water")));
            break;
        case RIN_PROTECTION_FROM_SHAPE_CHAN:
            pline_The(_("sink looks nothing like a fountain."));
            break;
        case RIN_PROTECTION:
            pline_The(_("sink glows %s for a moment."),
                      hcolor((obj.spe < 0) ? NH_BLACK() : NH_SILVER()));
            break;
        case RIN_WARNING:
            pline_The(_("sink glows %s for a moment."), hcolor(NH_WHITE()));
            break;
        case RIN_TELEPORT_CONTROL:
            pline_The(_("sink looks like it is being beamed aboard somewhere."));
            break;
        case RIN_POLYMORPH_CONTROL:
            pline_The(
                  _("sink momentarily looks like a regularly erupting geyser."));
            break;
        default:
            break;
        }
    }
    if (ideed) {
        trycall(obj);
    } else if (!nosink) {
         ;
        You_hear(_("the ring bouncing down the drainpipe."));
    }
    if (!rn2(20) && !nosink) {
        pline_The(_("sink backs up, leaving %s."), doname(obj));
        obj.in_use = FALSE;
        dropx(obj);
    } else if (!rn2(5)) {
        freeinv(obj);
        obj.in_use = FALSE;
        obj.ox = u.ux;
        obj.oy = u.uy;
        add_to_buried(obj);
    } else
        useup(obj);
}

/* some common tests when trying to drop or throw items */
export function canletgo(obj, word) { /* boolean */
    if (obj.owornmask & (W_ARMOR | W_ACCESSORY)) {
        if (chars[word])
            Norep(_("You cannot %s %s you are wearing."), word, something());
        return FALSE;
    }
    if (obj == uwep && welded(uwep)) {
        /* no weldmsg(), so uwep->bknown might become set silently
           if word is "" */
        if (chars[word]) {
            let hand = body_part(HAND);

            if (bimanual(uwep))
                hand = makeplural(hand);
            Norep(_("You cannot %s %s welded to your %s."), word, something(),
                  hand);
        }
        return FALSE;
    }
    if (obj.otyp == LOADSTONE && obj.cursed) {
        /* getobj() kludge sets corpsenm to user's specified count
           when refusing to split a stack of cursed loadstones */
        if (chars[word]) {
            /* getobj() ignores a count for throwing since that is
               implicitly forced to be 1; replicate its kludge... */
            if (!strcmp(word, _("throw")) && obj.quan > 1)
                obj.corpsenm = 1;
            pline(_("For some reason, you cannot %s%s the stone%s!"), word,
                  obj.corpsenm ? _(" any of") : _(""), plur(obj.quan));
        }
        obj.corpsenm = 0; /* reset */
        set_bknown(obj, 1);
        return FALSE;
    }
    if (obj.otyp == LEASH && obj.corpsenm != 0) {
        if (chars[word])
            pline_The(_("leash is tied around your %s."), body_part(HAND));
        return FALSE;
    }
    if (obj.owornmask & W_SADDLE) {
        if (chars[word])
            You(_("cannot %s %s you are sitting on."), word, something());
        return FALSE;
    }
    return TRUE;
}

function drop(obj) { /* int */
    const $frame = stack_frame(); try {
    if (!obj)
        return ECMD_FAIL;
    if (!canletgo(obj, _("drop")))
        return ECMD_FAIL;
    if (obj.otyp == CORPSE && better_not_try_to_drop_that(obj))
        return ECMD_FAIL;
    if (obj == uwep) {
        if (welded(uwep)) {
            weldmsg(obj);
            return ECMD_FAIL;
        }
        setuwep(null);
    }
    if (obj == uquiver) {
        setuqwep(null);
    }
    if (obj == uswapwep) {
        setuswapwep(null);
    }

    if (u.uswallow) {
        /* barrier between you and the floor */
        if (flags.verbose) {
            let onam_p, mnam_p, monbuf = stack_array(char, BUFSZ);

            mnam_p = mon_nam(u.ustuck);
            /* doname can call s_suffix, reusing its buffer */
            if (digests(u.ustuck.data)) {
                sprintf(monbuf, _("%s %s"), s_suffix(mnam_p), mbodypart(u.ustuck, STOMACH))
;
                mnam_p = monbuf;
            }
            onam_p = is_unpaid(obj) ? yobjnam(obj, 0) : doname(obj);

            You(_("drop %s into %s."), onam_p, mnam_p);
        }
    } else {
        if ((obj.oclass == RING_CLASS || obj.otyp == MEAT_RING)
            && IS_SINK(levl()[u.ux][u.uy].typ)) {
            dosinkring(obj);
            return ECMD_TIME;
        }
        if (!can_reach_floor(TRUE)) {
            /* we might be levitating due to #invoke Heart of Ahriman;
               if so, levitation would end during call to freeinv()
               and we want hitfloor() to happen before float_down() */
            let levhack = finesse_ahriman(obj);

            if (levhack)
                u.uprops[LEVITATION].extrinsic = W_ART; /* other than W_ARTI */
            if (flags.verbose)
                You(_("drop %s."), doname(obj));
            freeinv(obj);
            hitfloor(obj, TRUE);
            if (levhack)
                float_down(I_SPECIAL | TIMEOUT, W_ARTI | W_ART);
            return ECMD_TIME;
        }
        if (!IS_ALTAR(levl()[u.ux][u.uy].typ) && flags.verbose)
            You(_("drop %s."), doname(obj));
    }
    obj.how_lost = LOST_DROPPED;
    dropx(obj);
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* dropx - take dropped item out of inventory;
   called in several places - may produce output
   (eg ship_object() and dropy() -> sellobj() both produce output) */
export function dropx(obj) { /* void */
    freeinv(obj);
    if (!u.uswallow) {
        if (ship_object(obj, u.ux, u.uy, FALSE))
            return;
        if (IS_ALTAR(levl()[u.ux][u.uy].typ))
            doaltarobj(obj); /* set bknown */
    }
    dropy(obj);
}

/* dropy - put dropped object at destination; called from lots of places */
export function dropy(obj) { /* void */
    dropz(obj, FALSE);
}

/* dropz - really put dropped object at its destination... */
export function dropz(obj, with_impact) { /* void */
    if (obj == uwep)
        setuwep(null);
    if (obj == uquiver)
        setuqwep(null);
    if (obj == uswapwep)
        setuswapwep(null);

    if (u.uswallow) {
        /* hero has dropped an item while inside an engulfer */
        if (obj != uball) { /* mon doesn't pick up ball */
            /* moving shop item into engulfer's inventory treated as theft */
            if (is_unpaid(obj))
                stolen_value(obj, u.ux, u.uy, TRUE, FALSE);
            /* add to engulfer's inventory if not immediately eaten */
            if (!engulfer_digests_food(obj))
                mpickobj(u.ustuck, obj);
        }
    } else {
        if (flooreffects(obj, u.ux, u.uy, _("drop")))
            return;
        place_object(obj, u.ux, u.uy);
        if (with_impact)
            container_impact_dmg(obj, u.ux, u.uy);
        impact_disturbs_zombies(obj, with_impact);
        if (obj == uball)
            drop_ball(u.ux, u.uy);
        else if (svl.level.flags.has_shop)
            sellobj(obj, u.ux, u.uy);
        stackobj(obj);
        if (Blind() && Levitation())
            map_object(obj, 0);
        newsym(u.ux, u.uy); /* remap location under self */
    }
    encumber_msg();
}

/* when swallowed, move dropped object from OBJ_FREE to u.ustuck's inventory;
   for purple worm, immediately eat any corpse, glob, or special meat item
   from object polymorph; return True if object is used up, False otherwise */
function engulfer_digests_food(obj) { /* boolean */
    /* animal swallower (purple worn) eats any
       corpse, glob, or meat <item> but not other types of food */
    if (digests(u.ustuck.data)
        && (obj.otyp == CORPSE || obj.globby
            || obj.otyp == MEATBALL || obj.otyp == ENORMOUS_MEATBALL
            || obj.otyp == MEAT_RING || obj.otyp == MEAT_STICK)) {
        let could_petrify = FALSE,
                could_poly = FALSE, could_slime = FALSE,
                could_grow = FALSE, could_heal = FALSE;

        if (obj.otyp == CORPSE) {
            could_petrify = touch_petrifies(mons[obj.corpsenm]);
            could_poly = polyfood(obj);
            could_grow = +(obj.corpsenm == PM_WRAITH);
            could_heal = +(obj.corpsenm == PM_NURSE);
        } else if (obj.otyp == GLOB_OF_GREEN_SLIME) {
            could_slime = TRUE;
        }
        /* see or feel the effect */
        pline(_("%s instantly digested!"), Tobjnam(obj, _("are")));

        if (could_poly || could_slime) {
            newcham(u.ustuck, could_slime ? mons[PM_GREEN_SLIME] : null,
                           could_slime ? NC_SHOW_MSG : NO_NC_FLAGS);
        } else if (could_petrify) {
            minstapetrify(u.ustuck, TRUE);
        } else if (could_grow) {
            grow_up(u.ustuck, null);
        } else if (could_heal) {
            healmon(u.ustuck, u.ustuck.mhpmax, 0);
            /* False: don't realize that sight is cured from inside */
            mcureblindness(u.ustuck, FALSE);
        }
        delobj(obj); /* always used up */
        return TRUE;
    }
    return FALSE;
}

/* things that must change when not held; recurse into containers.
   Called for both player and monsters */
export function obj_no_longer_held(obj) { /* void */
    if (!obj) {
        return;
    } else if (Has_contents(obj)) {
        let contents;

        for (contents = obj.cobj; contents; contents = contents.nobj)
            obj_no_longer_held(contents);
    }
    switch (obj.otyp) {
    case CRYSKNIFE:
        /* Normal crysknife reverts to worm tooth when not held by hero
         * or monster; fixed crysknife has only 10% chance of reverting.
         * When a stack of the latter is involved, it could be worthwhile
         * to give each individual crysknife its own separate 10% chance,
         * but we aren't in any position to handle stack splitting here.
         */
        if (!obj.oerodeproof || !rn2(10)) {
            /* if monsters aren't moving, assume player is responsible */
            if (!svc.context.mon_moving && !program_state.gameover)
                costly_alteration(obj, COST_DEGRD);
            obj.otyp = WORM_TOOTH;
            obj.oerodeproof = 0;
        }
        break;
    }
}

/* the #droptype command: drop several things */
export function doddrop() { /* int */
    let result = ECMD_OK;

    if (!gi.invent) {
        You(_("have nothing to drop."));
        return ECMD_OK;
    }
    add_valid_menu_class(0); /* clear any classes already there */
    if (chars[u.ushops])
        sellobj_state(SELL_DELIBERATE);
    if (flags.menu_style != MENU_TRADITIONAL
        || (result = ggetobj(_("drop"), drop, 0, FALSE, null)) < -1)
        result = menu_drop(result);
    if (chars[u.ushops])
        sellobj_state(SELL_NORMAL);
    if (result)
        reset_occupations();

    return result;
}

function better_not_try_to_drop_that(otmp) { /* boolean */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    /* u_safe_from_fatal_corpse() with st_all checks for gloves and stoning
     *  resistance before bothering to prompt you.
     */
    if (otmp.otyp == CORPSE && !u_safe_from_fatal_corpse(otmp, st_all)) {
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("Drop the %s corpse without %s protection on?"), obj_pmname(otmp), body_part(HAND))

;
        return +(paranoid_ynq(TRUE, buf, FALSE) != ord('y'));
    }
    return FALSE;
    } finally { stack_pop($frame); }
}
function menudrop_split(otmp, cnt) { /* int */
    if (cnt && cnt < otmp.quan) {
        if (welded(otmp)) {
            ; /* don't split */
        } else if (otmp.otyp == LOADSTONE && otmp.cursed) {
            /* same kludge as getobj(), for canletgo()'s use */
            otmp.corpsenm = int(cnt); /* don't split */
        } else {
            otmp = splitobj(otmp, cnt);
        }
    }
    return drop(otmp);
}

/* Drop things from the hero's inventory, using a menu. */
function menu_drop(retry) { /* int */
    const $frame = stack_frame(); try {
    var n, i, n_dropped = 0;
    var otmp, otmp2;
    var pick_list = stack_var(ptr_to(struct_mi));
    var all_categories = TRUE, drop_everything = FALSE, autopick = FALSE;
    var drop_justpicked = FALSE;
    var justpicked_quan = 0;

    drop_done: { if (retry) {
        all_categories = +(retry == -2);
    } else if (flags.menu_style == MENU_FULL) {
        all_categories = FALSE;
        n = query_category(_("Drop what type of items?"), gi.invent,
                           (UNPAID_TYPES | ALL_TYPES | CHOOSE_ALL
                            | BUC_BLESSED | BUC_CURSED | BUC_UNCURSED
                            | BUC_UNKNOWN | JUSTPICKED | INCLUDE_VENOM),
                           pick_list, PICK_ANY);
            /* when paranoid_confirm:A is set, 'A' by itself implies
               'A'+'a' which will be followed by a confirmation prompt;
               when that option isn't set, 'A' by itself is rejected
               by query_categorry() and result here will be n==0 */
        if (!n)
            break drop_done;; /* no non-autopick category filters specified */

        for (i = 0; i < n; i++) {
            if (ptr_add(pick_list[0], i).item.a_int == ALL_TYPES_SELECTED) {
                all_categories = TRUE;
            } else if (ptr_add(pick_list[0], i).item.a_int == ord('A')) {
                drop_everything = autopick = TRUE;
            } else if (ptr_add(pick_list[0], i).item.a_int == ord('P')) {
                justpicked_quan = max(0, ptr_add(pick_list[0], i).count);
                drop_justpicked = TRUE;
                drop_everything = FALSE;
                add_valid_menu_class(ptr_add(pick_list[0], i).item.a_int);
            } else {
                add_valid_menu_class(ptr_add(pick_list[0], i).item.a_int);
                drop_everything = FALSE;
            }
        }
        free(addr_of(pick_list[0]));
    } else if (flags.menu_style == MENU_COMBINATION) {
        var ggoresults = stack_var(unsigned, 0);

        all_categories = FALSE;
        /* Gather valid classes via traditional NetHack method */
        i = ggetobj(_("drop"), drop, 0, TRUE, ggoresults);
        if (i == -2)
            all_categories = TRUE;
        if ((ggoresults[0] & ALL_FINISHED) != 0) {
            n_dropped = i;
            break drop_done;
        }
    }

    if (autopick) {
        /*
         * Dropping a burning potion of oil while levitating can cause
         * an explosion which might destroy some of hero's inventory,
         * so the old code
         *      for (otmp = gi.invent; otmp; otmp = otmp2) {
         *          otmp2 = otmp->nobj;
         *          n_dropped += drop(otmp);
         *      }
         * was unreliable and could lead to an "object lost" panic.
         *
         * Use the bypass bit to mark items already processed (hence
         * not droppable) and rescan inventory until no unbypassed
         * items remain.
         *
         * FIXME?  if something explodes, or even breaks, we probably
         * ought to halt the traversal or perhaps ask player whether
         * to halt it.
         */
        bypass_objlist(gi.invent, FALSE); /* clear bypass bit for invent */
        while ((otmp = nxt_unbypassed_obj(gi.invent)) != null) {
            if (drop_everything || all_categories || allow_category(otmp))
                n_dropped += ((drop(otmp) & ECMD_TIME) != 0) ? 1 : 0;
        }
        /* we might not have dropped everything (worn armor, welded weapon,
           cursed loadstones), so reset any remaining inventory to normal */
        bypass_objlist(gi.invent, FALSE);
    } else if (drop_justpicked && count_justpicked(gi.invent) == 1) {
        /* drop the just picked item automatically, if only one stack */
        otmp = find_justpicked(gi.invent);
        if (otmp)
            n_dropped += ((menudrop_split(otmp, justpicked_quan)
                           & ECMD_TIME) != 0) ? 1 : 0;
    } else {
        /* should coordinate with perm invent, maybe not show worn items */
        n = query_objlist(_("What would you like to drop?"), ref_of(gi, "invent"),
                          (USE_INVLET | INVORDER_SORT | INCLUDE_VENOM),
                          pick_list, PICK_ANY,
                          all_categories ? allow_all : allow_category);
        if (n > 0) {
            /*
             * picklist[] contains a set of pointers into inventory, but
             * as soon as something gets dropped, they might become stale
             * (see the autopick code above for an explanation).
             * Just checking to see whether one is still in the gi.invent
             * chain is not sufficient validation since destroyed items
             * will be freed and items we've split here might have already
             * reused that memory and put the same pointer value back into
             * gi.invent.  Ditto for using invlet to validate.  So we start
             * by setting bypass on all of gi.invent, then check each pointer
             * to verify that it is in gi.invent and has that bit set.
             */
            bypass_objlist(gi.invent, TRUE);
            for (i = 0; i < n; i++) {
                otmp = ptr_add(pick_list[0], i).item.a_obj;
                for (otmp2 = gi.invent; otmp2; otmp2 = otmp2.nobj)
                    if (otmp2 == otmp)
                        break;
                if (!otmp2 || !otmp2.bypass)
                    continue;
                /* found next selected invent item */
                n_dropped += ((menudrop_split(otmp, ptr_add(pick_list[0], i).count)
                               & ECMD_TIME) != 0) ? 1 : 0;
            }
            bypass_objlist(gi.invent, FALSE); /* reset gi.invent to normal */
            free(addr_of(pick_list[0]));
        }
    }
 }
    return (n_dropped ? ECMD_TIME : ECMD_OK);
    } finally { stack_pop($frame); }
}

function u_stuck_cannot_go(updn) { /* boolean */
    if (u.ustuck) {
        if (u.uswallow || !sticks(gy.youmonst.data)) {
            You(_("are %s, and cannot go %s."),
                !u.uswallow ? _("being held")
                : digests(u.ustuck.data) ? _("swallowed")
                : _("engulfed"), updn);
            return TRUE;
        } else {
            let mtmp = u.ustuck;

            set_ustuck(null);
            You(_("release %s."), mon_nam(mtmp));
        }
    }
    return FALSE;
}

/* the #down command */
export function dodown() { /* int */
    const $frame = stack_frame(); try {
    let trap = null;
    let stway;
    let stairs_down, ladder_down;

    set_move_cmd(DIR_DOWN, 0);

    if (u_rooted())
        return ECMD_TIME;

    if (stucksteed(TRUE)) {
        return ECMD_OK;
    }

    stairs_down = ladder_down = FALSE;
    if ((stway = stairway_at(u.ux, u.uy)) != null && !stway.up) {
        stairs_down = +!stway.isladder;
        ladder_down = +!stairs_down;
    }

    /* Levitation might be blocked, but player can still use '>' to
       turn off controlled levitation */
    if (HLevitation() || ELevitation()) {
        if ((HLevitation() & I_SPECIAL) || (ELevitation() & W_ARTI)) {
            /* end controlled levitation */
            if (ELevitation() & W_ARTI) {
                let obj;

                for (obj = gi.invent; obj; obj = obj.nobj) {
                    if (obj.oartifact
                        && artifact_has_invprop(obj, LEVITATION)) {
                        if (obj.age < svm.moves)
                            obj.age = svm.moves;
                        obj.age += rnz(100);
                    }
                }
            }
            if (float_down(I_SPECIAL | TIMEOUT, W_ARTI)) {
                return ECMD_TIME; /* came down, so moved */
            } else if (!HLevitation() && !ELevitation()) {
                Your(_("latent levitation ceases."));
                return ECMD_TIME; /* did something, effectively moved */
            }
        }
        if (BLevitation()) {
            ; /* weren't actually floating after all */
        } else if (Blind()) {
            /* glyph_to_cmap() is a macro which expands its argument many
               times; use this to do part of its work just once */
            let glyph_at_uxuy = levl()[u.ux][u.uy].glyph;

            /* Avoid alerting player to an unknown stair or ladder.
             * Changes the message for a covered, known staircase
             * too; staircase knowledge is not stored anywhere.
             */
            if (stairs_down)
                stairs_down = +(glyph_to_cmap(glyph_at_uxuy) == S_dnstair);
            else if (ladder_down)
                ladder_down = +(glyph_to_cmap(glyph_at_uxuy) == S_dnladder);
        }
        if (Is_airlevel(u.uz))
            You(_("are floating in the %s."), surface(u.ux, u.uy));
        else if (Is_waterlevel(u.uz))
            You(_("are floating in %s."),
                is_pool(u.ux, u.uy) ? _("the water") : _("a bubble of air"));
        else
            floating_above(stairs_down ? _("stairs")
                           : ladder_down ? _("ladder")
                             : surface(u.ux, u.uy));
        return ECMD_OK; /* didn't move */
    }

    if (Upolyd() && ceiling_hider(mons[u.umonnum]) && u.uundetected) {
        u.uundetected = 0;
        if (Flying()) { /* lurker above */
            You(_("fly out of hiding."));
        } else { /* piercer */
            You(_("drop to the %s."), surface(u.ux, u.uy));
            if (is_pool_or_lava(u.ux, u.uy)) {
                pooleffects(FALSE);
            } else {
                pickup(1);
                if ((trap = t_at(u.ux, u.uy)) != null)
                    dotrap(trap, TOOKPLUNGE);
            }
        }
        return ECMD_TIME; /* came out of hiding; need '>' again to go down */
    }

    if (u_stuck_cannot_go(_("down")))
        return ECMD_TIME;

    if (!stairs_down && !ladder_down) {
        trap = t_at(u.ux, u.uy);
        if (trap && (uteetering_at_seen_pit(trap) || uescaped_shaft(trap))) {
            dotrap(trap, TOOKPLUNGE);
            return ECMD_TIME;
        } else if (!trap || !is_hole(trap.ttyp)
                   || !Can_fall_thru(u.uz) || !trap.tseen) {
            if (flags.autodig && !svc.context.nopick
                && uwep && is_pick(uwep)) {
                return use_pick_axe2(uwep);
            } else {
                You_cant(_("go down here%s."),
                         (trap && trap.ttyp == VIBRATING_SQUARE) ? _(" yet")
                                                                  : _(""));
                return ECMD_OK;
            }
        }
    }
    if (on_level(svd.dungeon_topology.d_valley_level, u.uz) && !u.uevent.gehennom_entered) {
        You(_("are standing at the gate to Gehennom."));
        pline(_("Unspeakable cruelty and harm lurk down there."));
        if (y_n(_("Are you sure you want to enter?")) != ord('y'))
            return ECMD_OK;
        pline(_("So be it."));
        u.uevent.gehennom_entered = 1; /* don't ask again */
    }

    if (!next_to_u()) {
        You(_("are held back by your pet!"));
        return ECMD_OK;
    }

    if (trap) {
        let down_or_thru = trap.ttyp == HOLE ? _("down") : _("through");
        let actn = u_locomotion(_("jump"));

        if (gy.youmonst.data.msize >= MZ_HUGE) {
            let qbuf = stack_array(char, QBUFSZ);

            You(_("don't fit %s easily."), down_or_thru);
            sprintf(qbuf, _("Try to squeeze %s?"), down_or_thru);
            if (y_n(qbuf) == ord('y')) {
                if (!rn2(3)) {
                    actn = _("manage to squeeze");
                    losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(4)) + 1) / 2))) : (rnd(4))),
                           _("contusion from a small passage"), KILLED_BY);
                } else {
                    You(_("were unable to fit %s."), down_or_thru);
                    return ECMD_OK;
                }
            } else {
                return ECMD_OK;
            }
        }
        You(_("%s %s the %s."), actn, down_or_thru,
            trap.ttyp == HOLE ? _("hole") : _("trap door"));
    }
    if (trap && Is_stronghold(u.uz)) {
        goto_hell(FALSE, TRUE);
    } else if (trap && trap.dst.dlevel != -1) {
        let tdst = stack_struct(struct_d_level);
        assign_level(tdst, trap.dst);
        clamp_hole_destination(tdst);
        goto_level(tdst, FALSE, FALSE, FALSE);
    } else {
        ga.at_ladder = (+(levl()[u.ux][u.uy].typ == LADDER));
        next_level(+!trap);
        ga.at_ladder = FALSE;
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* the #up command - move up a staircase */
export function doup() { /* int */
    let stway = stairway_at(u.ux,u.uy);

    set_move_cmd(DIR_UP, 0);

    if (u_rooted())
        return ECMD_TIME;

    /* "up" to get out of a pit... */
    if (u.utrap && u.utraptype == TT_PIT) {
        climb_pit();
        return ECMD_TIME;
    }

    if (!stway || (stway && !stway.up)) {
        You_cant(_("go up here."));
        return ECMD_OK;
    }
    if (stucksteed(TRUE)) {
        return ECMD_OK;
    }

    if (u_stuck_cannot_go(_("up")))
        return ECMD_TIME;

    if (near_capacity() > SLT_ENCUMBER) {
        /* No levitation check; inv_weight() already allows for it */
        Your(_("load is too heavy to climb the %s."),
             levl()[u.ux][u.uy].typ == STAIRS ? _("stairs") : _("ladder"));
        return ECMD_TIME;
    }
    if (ledger_no(u.uz) == 1) {
        if (iflags.debug_fuzzer)
            return ECMD_OK;
        if (y_n(_("Beware, there will be no return!  Still climb?")) != ord('y'))
            return ECMD_OK;
    }
    if (!next_to_u()) {
        You(_("are held back by your pet!"));
        return ECMD_OK;
    }
    ga.at_ladder = (+(levl()[u.ux][u.uy].typ == LADDER));
    prev_level(TRUE);
    ga.at_ladder = FALSE;
    return ECMD_TIME;
}

/* check that we can write out the current level */
function currentlevel_rewrite() { /* NHFILE * */
    const $frame = stack_frame(); try {
    let nhfp;
    let whynot = stack_array(char, BUFSZ);

    /* since level change might be a bit slow, flush any buffered screen
     *  output (like "you fall through a trap door") */
    mark_synch()();

    nhfp = create_levelfile(ledger_no(u.uz), whynot);
    if (!nhfp) {
        /*
         * This is not quite impossible: e.g., we may have
         * exceeded our quota. If that is the case then we
         * cannot leave this level, and cannot save either.
         * Another possibility is that the directory was not
         * writable.
         */
        pline1(whynot);
        return null;
    }

    return nhfp;
    } finally { stack_pop($frame); }
}

export function save_currentstate() { /* void */
    let nhfp;

    program_state.in_checkpoint++;
    if (flags.ins_chkpt) {
        /* write out just-attained level, with pets and everything */
        nhfp = currentlevel_rewrite();
        if (!nhfp)
            return;
        if (nhfp.structlevel)
            bufon(nhfp.fd);
        nhfp.mode = WRITING;
        savelev(nhfp,ledger_no(u.uz));
        close_nhfile(nhfp);
    }

    /* write out non-level state */
    savestateinlock();
    program_state.in_checkpoint--;
}

/*
static boolean
badspot(coordxy x, coordxy y)
{
    return (boolean) ((levl[x][y].typ != ROOM
                       && levl[x][y].typ != AIR
                       && levl[x][y].typ != CORR)
                      || MON_AT(x, y));
}
*/

/* when arriving on a level, if hero and a monster are trying to share same
   spot, move one; extracted from goto_level(); also used by wiz_makemap() */
export function u_collide_m(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);

    if (!mtmp || mtmp == u.usteed || mtmp != m_at(u.ux, u.uy)) {
        impossible(_("level arrival collision: %s?"),
                   !mtmp ? _("no monster")
                     : (mtmp == u.usteed) ? _("steed is on map")
                       : _("monster not co-located"));
        return;
    }

    /* There's a monster at your target destination; it might be one
       which accompanied you--see mon_arrive(dogmove.c)--or perhaps
       it was already here.  Randomly move you to an adjacent spot
       or else the monster to any nearby location.  Prior to 3.3.0
       the latter was done unconditionally. */
    if (!rn2(2) && enexto(cc, u.ux, u.uy, gy.youmonst.data)
        && next2u(cc.x, cc.y))
        u_on_newpos(cc.x, cc.y); /*[maybe give message here?]*/
    else
        mnexto(mtmp, RLOC_NOMSG);

    if ((mtmp = m_at(u.ux, u.uy)) != null) {
        /* there was an unconditional impossible("mnexto failed")
           here, but it's not impossible and we're prepared to cope
           with the situation, so only say something when debugging */
        if (wizard())
            pline(_("(monster in hero's way)"));
        if (!rloc(mtmp, RLOC_NOMSG) || (mtmp = m_at(u.ux, u.uy)) != null)
            /* no room to move it; send it away, to return later */
            m_into_limbo(mtmp);
    }
    } finally { stack_pop($frame); }
}

function familiar_level_msg() { /* void */
    const $frame = stack_frame(); try {
    let fam_msgs = static_array("familiar_level_msg.fam_msgs", ptr_to(char), 4, [
        _("You have a sense of deja vu."),
        _("You feel like you've been here before."),
        _("This place %s familiar..."), 0 /* no message */
    ]);
    let halu_fam_msgs = static_array("familiar_level_msg.halu_fam_msgs", ptr_to(char), 4, [
        _("Whoa!  Everything %s different."),
        _("You are surrounded by twisty little passages, all alike."),
        _("Gee, this %s like uncle Conan's place..."), 0 /* no message */
    ]);
    let mesg;
    let buf = stack_array(char, BUFSZ);
    let which = rn2(4);

    if (Hallucination())
        mesg = halu_fam_msgs[which];
    else
        mesg = fam_msgs[which];
    if (mesg && strchr(mesg, ord('%'))) {
        sprintf(buf, mesg, !Blind() ? _("looks") : _("seems"));

        mesg = buf;
    }
    if (mesg)
        pline1(mesg);
    } finally { stack_pop($frame); }
}

export function goto_level(
    newlevel,
    at_stairs,
    falling,
    portal) { /* void */ /* True if arriving via magic portal */
    const $frame = stack_frame(); try {
    let l_idx, save_mode;
    let nhfp;
    let new_ledger;
    let cant_go_back, great_effort,
            up = +(depth(newlevel) < depth(u.uz)),
            newdungeon = +(u.uz.dnum != newlevel.dnum),
            leaving_tutorial = FALSE,
            was_in_W_tower = In_W_tower(u.ux, u.uy, u.uz),
            familiar = FALSE,
            new_ = FALSE; /* made a new level? */
    let mtmp;
    let whynot = stack_array(char, BUFSZ);
    let dist = depth(newlevel) - depth(u.uz);
    let do_fall_dmg = FALSE;
    let prev_temperature = svl.level.flags.temperature;

    if (dunlev(newlevel) > dunlevs_in_dungeon(newlevel))
        newlevel.dlevel = dunlevs_in_dungeon(newlevel);
    if (newdungeon) {
        if (In_endgame(newlevel)) { /* 1st Endgame Level !!! */
            if (!u.uhave.amulet)
                return;  /* must have the Amulet */
            if (!wizard()) /* wizard ^V can bypass Earth level */
                assign_level(newlevel, svd.dungeon_topology.d_earth_level); /* (redundant) */
        } else if (In_tutorial(newlevel)) {
            tutorial(TRUE); /* entering tutorial */
        } else if (In_tutorial(u.uz)) {
            tutorial(FALSE); /* leaving tutorial */
            up = FALSE; /* re-enter level 1 as if starting new game */
            leaving_tutorial = TRUE;
        }
    }
    new_ledger = ledger_no(newlevel);
    if (new_ledger <= 0)
        done(ESCAPED); /* in fact < 0 is impossible */

    /* If you have the amulet and are trying to get out of Gehennom,
     * going up a set of stairs sometimes does some very strange things!
     * Biased against law and towards chaos.  (The chance to be sent
     * down multiple levels when attempting to go up are significantly
     * less than the corresponding comment in older versions indicated
     * due to overlooking the effect of the call to assign_rnd_lvl().)
     *
     * Odds for making it to the next level up, or of being sent down:
     *  "up"    L      N      C
     *   +1   75.0   75.0   75.0
     *    0    6.25   8.33  12.5
     *   -1   11.46  12.50  12.5
     *   -2    5.21   4.17   0.0
     *   -3    2.08   0.0    0.0
     *
     * 5.0.0: the chance for the "mysterious force" to kick in goes down
     * as it kicks in, starting at 25% per climb attempt and dropping off
     * gradually but substantially.  The drop off is greater when hero is
     * sent down farther so benefits lawfuls more than chaotics this time.
     */
    if (Inhell() && up && u.uhave.amulet && !newdungeon && !portal
        && (dunlev(u.uz) < dunlevs_in_dungeon(u.uz) - 3)) {
        if (!rn2(4 + svc.context.mysteryforce)) {
            let odds = 3 + u.ualign.type,
                diff = (odds <= 1) ? 0 : rn2(odds); /* paranoia */

            if (diff != 0) {
                assign_rnd_level(newlevel, u.uz, diff);
                /* assign_rnd_level() may have used a value less than diff */
                diff = newlevel.dlevel - u.uz.dlevel; /* actual descent */
                /* if inside the tower, stay inside */
                if (was_in_W_tower && !On_W_tower_level(newlevel))
                    diff = 0;
            }
            if (diff == 0)
                assign_level(newlevel, u.uz);

            pline(_("A mysterious force momentarily surrounds you..."));
            /* each time it kicks in, the chance of doing so again may drop;
               that drops faster, on average, when being sent down farther so
               while the impact is reduced for everybody compared to earlier
               versions, it is reduced least for chaotics, most for lawfuls */
            svc.context.mysteryforce += rn2(diff + 2); /* L:0-4,N:0-3,C:0-2 */

            if (on_level(newlevel, u.uz)) {
                safe_teleds(TELEDS_NO_FLAGS);
                next_to_u();
                return;
            }
            new_ledger = ledger_no(newlevel);
            at_stairs = ga.at_ladder = FALSE;
        }
    }

    /* Prevent the player from going past the first quest level unless
     * (s)he has been given the go-ahead by the leader.
     */
    if (on_level(u.uz, svd.dungeon_topology.d_qstart_level) && !newdungeon && !ok_to_quest()) {
        pline(_("A mysterious force prevents you from descending."));
        return;
    }

    if (on_level(newlevel, u.uz))
        return; /* this can happen */

    if (gl.luacore && nhcb_counts[NHCB_LVL_LEAVE]) {
        lua_getglobal(view_of(struct_lua_State, gl.luacore), _("nh_callback_run"));
        lua_pushstring(view_of(struct_lua_State, gl.luacore), nhcb_name[NHCB_LVL_LEAVE]);
        nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 1, 0, _("goto_level"), NHLpa_panic);
        lua_settop(view_of(struct_lua_State, gl.luacore), 0);
    }

    /* tethered movement makes level change while trapped feasible */
    if (u.utrap && u.utraptype == TT_BURIEDBALL)
        buried_ball_to_punishment(); /* (before we save/leave old level) */

    nhfp = currentlevel_rewrite();
    if (!nhfp)
        return;

    /* discard context which applies to the level we're leaving;
       for lock-picking, container may be carried, in which case we
       keep context; if on the floor, it's about to be saved+freed and
       maybe_reset_pick() needs to do its carried() check before that */
    maybe_reset_pick(null);
    reset_trapset(); /* even if to-be-armed trap obj is accompanying hero */
    iflags.travelcc.x = iflags.travelcc.y = 0; /* travel destination cache */
    svc.context.polearm.hitmon = null; /* polearm target */
    /* digging context is level-aware and can actually be resumed if
       hero returns to the previous level without any intervening dig */

    if (falling) /* assuming this is only trap door or hole */
        impact_drop(null, u.ux, u.uy, newlevel.dlevel);

    check_special_room(TRUE); /* probably was a trap door */
    if (Punished())
        unplacebc();
    reset_utrap(FALSE); /* needed in level_tele */
    fill_pit(u.ux, u.uy);
    set_ustuck(null); /* clear u.ustuck and u.uswallow */
    set_uinwater(0); /* u.uinwater = 0 */
    u.uundetected = 0; /* not hidden, even if means are available */
    if (!iflags.nofollowers)
        keepdogs(FALSE);
    recalc_mapseen(); /* recalculate map overview before we leave the level */
    /*
     *  We no longer see anything on the level.  Make sure that this
     *  follows u.uswallow set to null since uswallow overrides all
     *  normal vision.
     */
    vision_recalc(2);

    /*
     * Save the level we're leaving.  If we're entering the endgame,
     * we can get rid of all existing levels because they cannot be
     * reached any more.  We still need to use savelev()'s cleanup
     * for the level being left, to recover dynamic memory in use and
     * to avoid dangling timers and light sources.
     */
    cant_go_back = ((newdungeon && In_endgame(newlevel)) || leaving_tutorial ? 1 : 0);
    if (!cant_go_back) {
        update_mlstmv(); /* current monsters are becoming inactive */
        if (nhfp.structlevel)
            bufon(nhfp.fd);       /* use buffered output */
    } else {
        free_luathemes(leaving_tutorial ? tut_themes : most_themes);
    }
    save_mode = nhfp.mode;
    nhfp.mode = cant_go_back ? FREEING : (WRITING | FREEING);
    savelev(nhfp, ledger_no(u.uz));
    nhfp.mode = save_mode;
    close_nhfile(nhfp);
    if (cant_go_back) {
        /* discard unreachable levels; keep #0 */
        for (l_idx = maxledgerno(); l_idx > 0; --l_idx)
            if (!leaving_tutorial || ledger_to_dnum(l_idx) == tutorial_dnum())
                delete_levelfile(l_idx);
        /* mark #overview data for all dungeon branches as uninteresting */
        for (l_idx = 0; l_idx < svn.n_dgns; ++l_idx)
            if (!leaving_tutorial || l_idx == tutorial_dnum())
                remdun_mapseen(l_idx);
        /* get rid of mons & objs scheduled to migrate to discarded levels */
        discard_migrations();
    }

    if (Is_rogue_level(newlevel) || Is_rogue_level(u.uz))
        assign_graphics(Is_rogue_level(newlevel) ? ROGUESET : PRIMARYSET);
    check_gold_symbol();
    /* record this level transition as a potential seen branch unless using
     * some non-standard means of transportation (level teleport).
     */
    if ((at_stairs || falling || portal) && (u.uz.dnum != newlevel.dnum))
        recbranch_mapseen(u.uz, newlevel);
    assign_level(u.uz0, u.uz);
    assign_level(u.uz, newlevel);
    assign_level(u.utolev, newlevel);
    u.utotype = UTOTYPE_NONE;
    if (!builds_up(u.uz)) { /* usual case */
        if (dunlev(u.uz) > dunlev_reached(u.uz))
            (svd.dungeons[(u.uz).dnum].dunlev_ureached) = dunlev(u.uz);
    } else {
        if (dunlev_reached(u.uz) == 0
            || dunlev(u.uz) < dunlev_reached(u.uz))
            (svd.dungeons[(u.uz).dnum].dunlev_ureached) = dunlev(u.uz);
    }

    stairway_free_all();
    /* set default level change destination areas */
    /* the special level code may override these */
    memset(addr_of(svu.updest), 0, sizeof(struct_dest_area));
    memset(addr_of(svd.dndest), 0, sizeof(struct_dest_area));

    if (!(svl.level_info[new_ledger].flags & LFILE_EXISTS)) {
        /* entering this level for first time; make it now */
        if (svl.level_info[new_ledger].flags & VISITED) {
            impossible(_("goto_level: returning to discarded level?"));
            svl.level_info[new_ledger].flags &= ~VISITED;
        }
        mklev();
        new_ = TRUE; /* made the level */
        familiar = bones_include_name(svp.plname);
    } else {
        /* returning to previously visited level; reload it */
        nhfp = open_levelfile(new_ledger, whynot);
        if (tricked_fileremoved(nhfp, whynot)) {
            /* we'll reach here if running in wizard mode */
            error(_("Cannot continue this game."));
        }
        reseed_random(rn2);
        reseed_random(rn2_on_display_rng);
        getlev(nhfp, svh.hackpid, new_ledger);
        close_nhfile(nhfp);
        oinit(); /* reassign level dependent obj probabilities */
    }
    reglyph_darkroom();
    set_uinwater(0); /* u.uinwater = 0 */
    /* do this prior to level-change pline messages */
    vision_reset();         /* clear old level's line-of-sight */
    gv.vision_full_recalc = 0; /* don't let that reenable vision yet */
    flush_screen(-1);       /* ensure all map flushes are postponed */

    if (portal && !In_endgame(u.uz)) {
        /* find the portal on the new level */
        let ttrap;

        for (ttrap = gf.ftrap; ttrap; ttrap = ttrap.ntrap)
            if (ttrap.ttyp == MAGIC_PORTAL)
                break;

        if (!ttrap) {
            if (u.uevent.qexpelled
                && (Is_qstart(u.uz0) || Is_qstart(u.uz))) {
                /* we're coming back from or going into the quest home level,
                   after already getting expelled once. The portal back
                   doesn't exist anymore - see expulsion(). */
                u_on_rndspot(0);
            } else {
                if (!iflags.debug_fuzzer)
                    impossible(_("goto_level: no corresponding portal!"));
                u_on_rndspot(0);
            }
        } else {
            seetrap(ttrap);
            u_on_newpos(ttrap.tx, ttrap.ty);
        }
    } else if (at_stairs && !In_endgame(u.uz)) {
        if (up) {
            let stway = stairway_find_from(u.uz0, ga.at_ladder);
            if (stway) {
                u_on_newpos(stway.sx, stway.sy);
                stway.u_traversed = TRUE;
            } else if (newdungeon)
                u_on_sstairs(1);
            else
                u_on_dnstairs();
            /* you climb up the {stairs|ladder};
               fly up the stairs; fly up along the ladder */
            great_effort = +(Punished() && !Levitation());
            if (flags.verbose || great_effort)
                pline(_("%s %s up%s the %s."),
                      great_effort ? _("With great effort, you") : _("You"),
                      u_locomotion(_("climb")),
                      (Flying() && ga.at_ladder) ? _(" along") : _(""),
                      ga.at_ladder ? _("ladder") : _("stairs"));
        } else { /* down */
            let stway = stairway_find_from(u.uz0, ga.at_ladder);
            if (stway) {
                u_on_newpos(stway.sx, stway.sy);
                stway.u_traversed = TRUE;
            } else if (newdungeon)
                u_on_sstairs(0);
            else
                u_on_upstairs();
            if (!u.dz) {
                ; /* stayed on same level? (no transit effects) */
            } else if (Flying()) {
                if (flags.verbose)
                    You(_("fly down %s."),
                        ga.at_ladder ? _("along the ladder") : _("the stairs"));
            } else if (near_capacity() > UNENCUMBERED
                       || Punished() || Fumbling()) {
                You(_("fall down the %s."), ga.at_ladder ? _("ladder") : _("stairs"));
                if (Punished()) {
                    drag_down();
                    if (!welded(uball))
                        ballrelease(FALSE);
                }
                /* falling off steed has its own losehp() call */
                if (u.usteed)
                    dismount_steed(DISMOUNT_FELL);
                else
                    losehp(((Half_physical_damage()) ? (Math.trunc((((rnd(3)) + 1) / 2))) : (rnd(3))),
                           ga.at_ladder ? _("falling off a ladder")
                                     : _("tumbling down a flight of stairs"),
                           KILLED_BY);
                selftouch(_("Falling, you"));
            } else { /* ordinary descent */
                if (flags.verbose)
                    You(_("%s."), ga.at_ladder ? _("climb down the ladder")
                                         : _("descend the stairs"));
            }
        }
    } else { /* trap door or level_tele or In_endgame */
        u_on_rndspot((up ? 1 : 0) | (was_in_W_tower ? 2 : 0));
        if (falling) {
            if (Punished() && !welded(uball))
                ballfall();
            selftouch(_("Falling, you"));
            do_fall_dmg = TRUE;
        }
    }

    if (Punished())
        placebc();
    obj_delivery(FALSE);
    losedogs();
    kill_genocided_monsters(); /* for those wiped out while in limbo */
    /*
     * Expire all timers that have gone off while away.  Must be
     * after migrating monsters and objects are delivered
     * (losedogs and obj_delivery).
     */
    run_timers();

    /* hero might be arriving at a spot containing a monster;
       if so, move one or the other to another location */
    if ((mtmp = m_at(u.ux, u.uy)) != null)
        u_collide_m(mtmp);

    /* initial movement of bubbles just before vision_recalc */
    if (Is_waterlevel(u.uz) || Is_airlevel(u.uz))
        movebubbles();
    else if (svl.level.flags.fumaroles)
        fumaroles();

    /* Reset the screen. */
    vision_reset(); /* reset the blockages */
    reset_glyphmap(gm_levelchange);
    notice_mon_off(); /* not noticing monsters yet! */
    docrt(); /* does a full vision recalc */
    flush_screen(-1);

    /*
     *  Move all plines beyond the screen reset.
     */

    /* deferred arrival message for level teleport looks odd if given
       after the various messages below, so give it before them;
       [it might have already been delivered via docrt() -> see_monsters()
       -> Sting_effects() -> maybe_lvltport_feedback(), in which case
       'dfr_post_msg' has already been reset to Null];
       if 'dfr_post_msg' is "you materialize on a different level" then
       maybe_lvltport_feedback() will deliver it now and then free it */
    if (gd.dfr_post_msg)
        maybe_lvltport_feedback(); /* potentially called by Sting_effects() */

    /* special levels can have a custom arrival message */
    deliver_splev_message();

    /* Check whether we just entered Gehennom. */
    if (!In_hell(u.uz0) && Inhell()) {
        if (Is_valley(u.uz)) {
            You(_("arrive at the Valley of the Dead..."));
            pline_The(_("odor of burnt flesh and decay pervades the air."));

             ;
            You_hear(_("groans and moans everywhere."));
        }

        record_achievement(ACH_HELL); /* reached Gehennom */
    }
    /* in case we've managed to bypass the Valley's stairway down */
    if (Inhell() && !Is_valley(u.uz))
        u.uevent.gehennom_entered = 1;

    if (familiar)
        familiar_level_msg();

    /* special location arrival messages/events */
    if (In_endgame(u.uz)) {
        if (newdungeon)
            record_achievement(ACH_ENDG); /* reached endgame */
        if (new_ && on_level(u.uz, svd.dungeon_topology.d_astral_level)) {
            final_level(); /* guardian angel,&c */
            record_achievement(ACH_ASTR); /* reached Astral level */
        } else if (newdungeon && u.uhave.amulet) {
            resurrect(); /* force confrontation with Wizard */
        }
    } else if (In_quest(u.uz)) {
        onquest(); /* might be reaching locate|goal level */
    } else if (Is_knox(u.uz)) {
        /* alarm stops working once Croesus has died */
        if (new_ || !svm.mvitals[PM_CROESUS].died) {
            You(_("have penetrated a high security area!"));
             ;
            pline(_("An alarm sounds!"));
            for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
                if (DEADMONSTER(mtmp))
                    continue;
                mtmp.msleeping = 0;
            }
        }
    } else if (In_mines(u.uz)) {
        if (newdungeon)
            record_achievement(ACH_MINE);
    } else if (In_sokoban(u.uz)) {
        if (newdungeon)
            record_achievement(ACH_SOKO);
    } else {
        if (new_ && Is_rogue_level(u.uz)) {
            You(_("enter what seems to be an older, more primitive world."));
        } else if (new_ && Is_bigroom(u.uz)) {
            record_achievement(ACH_BGRM);
        }
        /* main dungeon message from your quest leader */
        if (!In_quest(u.uz0) && at_dgn_entrance(_("The Quest"))
            && !(u.uevent.qcompleted || u.uevent.qexpelled
                 || svq.quest_status.leader_is_dead)) {
            /* [TODO: copy of same TODO below; if an achievement for
               receiving quest call from leader gets added, that should
               come after logging new level entry] */
            if (!u.uevent.qcalled) {
                u.uevent.qcalled = 1;
                /* main "leader needs help" message */
                com_pager(_("quest_portal"));
            } else { /* reminder message */
                com_pager(Role_if(PM_ROGUE) ? _("quest_portal_demand")
                                            : _("quest_portal_again"));
            }
        }
    }

    temperature_change_msg(prev_temperature);

    /* this was originally done earlier; moved here to be logged after
       any achievement related to entering a dungeon branch
       [TODO: if an achievement for receiving quest call from leader
       gets added, that should come after this rather than take place
       where the message is delivered above] */
    if (new_) {
        let dloc = stack_array(char, QBUFSZ);
        /* Astral is excluded as a major event here because entry to it
           is already one such due to that being an achievement;
           for the quest, listing the start, locate, and goal levels would
           seem reasonable but all quest levels are included for simplicity--
           level 2 (or 3 if hero level teleports after obtaining permission
           to enter) is useful to show since it indicates that hero has
           actually entered the quest rather than just received permission
           to do so, and listing the goal level could be used to figure out
           whether level 5 is the end or there's another level (ESP reveals
           the same thing, but is part of normal game play as opposed to
           #chronicle leaking information that hero hasn't discovered yet) */
        let major = ((In_endgame(u.uz) && !Is_astralevel(u.uz))
                         || In_quest(u.uz) ? 1 : 0);

        describe_level(dloc, 2);
        livelog_printf(major ? LL_ACHIEVE : LL_DEBUG, _("entered %s"), dloc);

        if (Role_if(PM_TOURIST)) {
            more_experienced(level_difficulty(), 0);
            newexplevel();
        }
    }

    assign_level(u.uz0, u.uz); /* reset u.uz0 */

    save_currentstate();

    notice_mon_on();
    notice_all_mons(TRUE);

    print_level_annotation();
    /* give room entrance message, if any */
    check_special_room(FALSE);
    /* deliver objects traveling with player */
    obj_delivery(TRUE);

    /* assume this will always return TRUE when changing level */
    in_out_region(u.ux, u.uy);
    /* shop repair is normally done when shopkeepers move, but we may
       need to catch up for lost time here; do this before maybe dying
       so bones map will include it */
    if (!new_)
        fix_shop_damage();

    /* fall damage? */
    if (do_fall_dmg) {
        let dmg = d(max(dist, 1), 6);

        dmg = Maybe_Half_Phys(dmg);
        losehp(dmg, _("falling down a mine shaft"), KILLED_BY);
    }

    pickup(1);
    return;
    } finally { stack_pop($frame); }
}

/* give a message when entering a Gehennom level other than the Valley;
   also given if restoring a game in that situation */
export function hellish_smoke_mesg() { /* void */
    if (svl.level.flags.temperature)
        pline(_("It is %s here."),
              svl.level.flags.temperature > 0 ? _("hot") : _("cold"));

    if (In_hell(u.uz) && svl.level.flags.temperature > 0)
        You(_("%s smoke..."),
              olfaction(gy.youmonst.data) ? _("smell") : _("sense"));
}

/* give a message when the level temperature is different from previous */
function temperature_change_msg(prev_temperature) { /* void */
    if (prev_temperature != svl.level.flags.temperature) {
        if (svl.level.flags.temperature)
            hellish_smoke_mesg();
        else if (prev_temperature > 0)
            pline_The(_("heat %s gone."),
                      In_hell(u.uz0)
                      ? _("and smoke are") : _("is"));
        else if (prev_temperature < 0)
            You(_("are out of the cold."));
    }
}

/* usually called from goto_level(); might be called from Sting_effects() */
export function maybe_lvltport_feedback() { /* void */
    if (gd.dfr_post_msg
        && !strncmpi(gd.dfr_post_msg, _("You materialize"), 15)) {
        /* "You materialize on a different level." */
        pline(_("%s"), gd.dfr_post_msg);
        free(gd.dfr_post_msg), gd.dfr_post_msg = 0;
    }
}

function final_level() { /* void */
    /* reset monster hostility relative to player */
    iter_mons(reset_hostility);

    /* create some player-monsters */
    create_mplayers(rn1(4, 3), TRUE);

    /* create a guardian angel next to player, if worthy */
    gain_guardian_angel();
}

/* change levels at the end of this turn, after monsters finish moving */
export function schedule_goto(
    tolev,
    utotype_flags,
    pre_msg, post_msg) { /* void */
    /* UTOTYPE_DEFERRED is used, so UTOTYPE_NONE can trigger deferred_goto() */
    u.utotype = uchar(utotype_flags | UTOTYPE_DEFERRED);
    /* destination level */
    assign_level(u.utolev, tolev);

    if (pre_msg)
        gd.dfr_pre_msg = dupstr(pre_msg);
    if (post_msg)
        gd.dfr_post_msg = dupstr(post_msg);
}

/* handle something like portal ejection */
export function deferred_goto() { /* void */
    const $frame = stack_frame(); try {
    if (!on_level(u.uz, u.utolev)) {
        let dest = stack_struct(struct_d_level), oldlev = stack_struct(struct_d_level);
        let typmask = u.utotype; /* save it; goto_level zeroes u.utotype */

        assign_level(dest, u.utolev);
        assign_level(oldlev, u.uz);
        if (gd.dfr_pre_msg)
            pline1(gd.dfr_pre_msg);
        goto_level(dest, +!!(typmask & UTOTYPE_ATSTAIRS),
                   +!!(typmask & UTOTYPE_FALLING),
                   +!!(typmask & UTOTYPE_PORTAL));
        if (typmask & UTOTYPE_RMPORTAL) { /* remove portal */
            let t = t_at(u.ux, u.uy);

            if (t) {
                deltrap(t);
                newsym(u.ux, u.uy);
            }
        }
        if (gd.dfr_post_msg && !on_level(u.uz, oldlev))
            pline1(gd.dfr_post_msg);
    }
    u.utotype = UTOTYPE_NONE; /* our caller keys off of this */
    if (gd.dfr_pre_msg)
        free(gd.dfr_pre_msg), gd.dfr_pre_msg = 0;
    if (gd.dfr_post_msg)
        free(gd.dfr_post_msg), gd.dfr_post_msg = 0;
    } finally { stack_pop($frame); }
}

/*
 * Return TRUE if we created a monster for the corpse.  If successful, the
 * corpse is gone.
 */
export function revive_corpse(corpse) { /* boolean */
    const $frame = stack_frame(); try {
    let mtmp, mcarry;
    let is_uwep, chewed;
    let where;
    let cname = stack_array(char, BUFSZ);
    let container = null;
    let container_where = stack_var(int, 0);
    let montype;
    let is_zomb;
    let corpsex = stack_var(coordxy), corpsey = stack_var(coordxy);

    where = corpse.where;
    montype = corpse.corpsenm;
    /* treat buried auto-reviver (troll, Rider?) like a zombie
       so that it can dig itself out of the ground if it revives */
    is_zomb = +(mons[montype].mlet == S_ZOMBIE
               || (where == OBJ_BURIED && is_reviver(mons[montype])));
    is_uwep = +(corpse == uwep);
    chewed = +(corpse.oeaten != 0);
    strcpy(cname, corpse_xname(corpse,
                               chewed ? _("bite-covered") : 0,
                               CXN_SINGULAR));
    mcarry = (where == OBJ_MINVENT) ? corpse.v.v_ocarry : null;
    /* mcarry is NULL for (where == OBJ_BURIED and OBJ_CONTAINED) now */

    get_obj_location(corpse, corpsex, corpsey,
                            CONTAINED_TOO | BURIED_TOO);

    if (where == OBJ_CONTAINED) {
        let mtmp2;

        container = corpse.v.v_ocontainer;
        mtmp2 = get_container_location(container, container_where,
                                       null);
        /* container_where is outermost container's location even if nested */
        if (container_where[0] == OBJ_MINVENT && mtmp2)
            mcarry = mtmp2;
    }
    mtmp = revive(corpse, FALSE); /* corpse is gone if successful */

    if (mtmp) {
        switch (where) {
        case OBJ_INVENT:
            if (is_uwep)
                pline_The(_("%s writhes out of your grasp!"), cname);
            else
                You_feel(_("squirming in your backpack!"));
            break;

        case OBJ_FLOOR:
            if (cansee(corpsex[0], corpsey[0]) || canseemon(mtmp)) {
                let effect = _("");

                if (mtmp.data == mons[PM_DEATH])
                    effect = _(" in a whirl of spectral skulls");
                else if (mtmp.data == mons[PM_PESTILENCE])
                    effect = _(" in a churning pillar of flies");
                else if (mtmp.data == mons[PM_FAMINE])
                    effect = _(" in a ring of withered crops");

                if (canseemon(mtmp)) {
                    pline(_("%s rises from the dead%s!"),
                          chewed ? Adjmonnam(mtmp, _("bite-covered"))
                                 : Monnam(mtmp),
                          effect);
                } else {
                    pline(_("%s disappears%s!"), The(cname), effect);
                }
            }
            break;

        case OBJ_MINVENT: /* probably a nymph's */
            if (cansee(mtmp.mx, mtmp.my)) {
                if (mcarry && canseemon(mcarry))
                    pline(_("Startled, %s drops %s as it %s!"),
                          mon_nam(mcarry), an(cname),
                          canspotmon(mtmp) ? _("revives") : _("disappears"));
                else if (canspotmon(mtmp))
                    pline(_("%s suddenly appears!"),
                          chewed ? Adjmonnam(mtmp, _("bite-covered"))
                                 : Monnam(mtmp));
            }
            break;
        case OBJ_CONTAINED: {
            let sackname = stack_array(char, BUFSZ);
            /* Could use x_monnam(..., AUGMENT_IT) but that'd say "someone"
               for humanoid monsters, which seems like a distinction the hero
               doesn't have knowledge to make here. */
            let mnam = canspotmon(mtmp) ? Amonnam(mtmp) : Something();

            if (!container) {
                impossible(_("reviving corpse from non-existent container"));
            } else if (mcarry && canseemon(mcarry)) {
                pline(_("%s writhes out of %s!"), mnam, yname(container));
            } else if (container_where[0] == OBJ_INVENT) {
                strcpy(sackname, an(xname(container)));
                pline(_("%s %s out of %s in your pack!"), mnam,
                      locomotion(mtmp.data, _("writhes")), sackname);
            } else if (container_where[0] == OBJ_FLOOR
                       && cansee(corpsex[0], corpsey[0])) {
                strcpy(sackname, an(xname(container)));
                pline(_("%s escapes from %s!"), mnam, sackname);
            }
            break;
        }
        case OBJ_BURIED:
            if (is_zomb) {
                maketrap(mtmp.mx, mtmp.my, PIT);
                if (cansee(mtmp.mx, mtmp.my)) {
                    let ttmp;

                    ttmp = t_at(mtmp.mx, mtmp.my);
                    if (ttmp)
                        ttmp.tseen = TRUE;
                    pline(_("%s claws itself out of the ground!"),
                          canspotmon(mtmp) ? Amonnam(mtmp) : Something());
                    newsym(mtmp.mx, mtmp.my);
                } else if (mdistu(mtmp) < 5*5) {
                     ;
                    You_hear(_("scratching noises."));
                }
                fill_pit(mtmp.mx, mtmp.my);
                break;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        default:
            /* we should be able to handle the other cases... */
            impossible(_("revive_corpse: lost corpse @ %d"), where);
            break;
        }
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* Revive the corpse via a timeout. */
/*ARGSUSED*/
export function revive_mon(arg, timeout) { /* void */
    const $frame = stack_frame(); try {
    let body = arg.a_obj;
    let mptr = mons[body.corpsenm];
    let mtmp;
    let x = stack_var(coordxy), y = stack_var(coordxy);

    /* corpse will revive somewhere else if there is a monster in the way;
       Riders get a chance to try to bump the obstacle out of their way */
    if (is_displacer(mptr) && body.where == OBJ_FLOOR
        && get_obj_location(body, x, y, 0) && (mtmp = m_at(x[0], y[0])) != null &&
        svl.level.flags.stasis_until < svm.moves) {
        let notice_it = canseemon(mtmp); /* before rloc() */
        let monname = Monnam(mtmp);

        if (rloc(mtmp, RLOC_NOMSG)) {
            if (notice_it && !canseemon(mtmp))
                pline(_("%s vanishes."), monname);
            else if (!notice_it && canseemon(mtmp))
                pline(_("%s appears."), Monnam(mtmp)); /* not pre-rloc monname */
            else if (notice_it && dist2(mtmp.mx, mtmp.my, x[0], y[0]) > 2)
                pline(_("%s teleports."), monname); /* saw it and still see it */
        }
    }

    /* if we succeed, the corpse is gone */
    if (!revive_corpse(body)) {
        let when;
        let action;

        if (is_rider(mptr) && rn2(99)) { /* Rider usually tries again */
            action = REVIVE_MON;
            when = rider_revival_time(body, TRUE);
        } else { /* rot this corpse away */
            if (!obj_has_timer(body, ROT_CORPSE))
                You_feel(_("%sless hassled."), is_rider(mptr) ? _("much ") : _(""));
            action = ROT_CORPSE;
            when = d(5, 50) - (svm.moves - body.age);
            if (when < 1)
                when = 1;
        }
        if (!obj_has_timer(body, action))
            start_timer(when, TIMER_OBJECT, action, arg);
    }
    } finally { stack_pop($frame); }
}

/* Timeout callback. Revive the corpse as a zombie. */
export function zombify_mon(arg, timeout) { /* void */
    let body = arg.a_obj;
    let zmon = zombie_form(mons[body.corpsenm]);

    if (zmon != NON_PM && !(svm.mvitals[zmon].mvflags & G_GENOD)) {
        if (has_omid(body))
            free_omid(body);
        if (has_omonst(body))
            free_omonst(body);

        set_corpsenm(body, zmon);
        revive_mon(arg, timeout);
    } else {
        rot_corpse(arg, timeout);
    }
}

/* return TRUE if hero properties are dangerous to hero */
function danger_uprops() { /* boolean */
    return (Stoned() || Slimed() || Strangled() || Sick() ? 1 : 0);
}

export function cmd_safety_prevention(ucverb, cmddesc,
                      act, flagcounter) { /* boolean */
    const $frame = stack_frame(); try {
    if (flags.safe_wait && !iflags.menu_requested && !gm.multi) {
        let buf = stack_array(char, QBUFSZ);

        chars[buf + 0] = ord('\0');
        if (iflags.cmdassist || !(flagcounter[0])++)
            sprintf(buf, _("  Use '%s' prefix to force %s."), visctrl(cmd_from_func(do_reqmenu)), cmddesc)
;

        if (monster_nearby()) {
            Norep(_("%s%s"), act, buf);
            return TRUE;
        } else if (danger_uprops()) {
            Norep(_("%s doesn't feel like a good idea right now."), ucverb);
            return TRUE;
        }
    }
    flagcounter[0] = 0;
    return FALSE;
    } finally { stack_pop($frame); }
}

/* '.' command: do nothing == rest; also the
   ' ' command iff 'rest_on_space' option is On */
export function donull() { /* int */
    if (cmd_safety_prevention(_("Waiting"), _("a no-op (to rest)"),
                          _("Are you waiting to get hit?"),
                          ref_of(gd, "did_nothing_flag")))
        return ECMD_OK;
    return ECMD_TIME; /* Do nothing, but let other things happen */
}

function wipeoff() { /* int */
    let udelta = u.ucreamed;
    let ldelta = BlindedTimeout();

    if (udelta > 4)
        udelta = 4;
    u.ucreamed -= udelta; /*u.ucreamed -= min(u.ucreamed,4);*/
    if (ldelta > 4)
        ldelta = 4;
    incr_itimeout(ref_of(u.uprops[BLINDED], "intrinsic"), -ldelta); /*HBlinded -= min(BlindedTimeout,4L);*/

    if (!HBlinded()) {
        pline(_("You've got the glop off."));
        u.ucreamed = 0;
        if (!gulp_blnd_check()) {
            set_itimeout(ref_of(u.uprops[BLINDED], "intrinsic"), 1);
            make_blinded(0, TRUE);
        }
        return 0;
    } else if (!u.ucreamed) {
        Your(_("%s feels clean now."), body_part(FACE));
        return 0;
    }
    return 1; /* still busy */
}

/* the #wipe command - wipe off your face */
export function dowipe() { /* int */
    if (u.ucreamed) {
        let buf = static_array("dowipe.buf", char, 39);

        sprintf(buf, _("wiping off your %s"), body_part(FACE));
        set_occupation(wipeoff, buf, 0);
        /* Not totally correct; what if they change back after now
         * but before they're finished wiping?
         */
        return ECMD_TIME;
    }
    Your(_("%s is already clean."), body_part(FACE));
    return ECMD_TIME;
}

/* common wounded legs feedback */
export function legs_in_no_shape(for_what,
                 by_steed) { /* void */
    if (by_steed && u.usteed) {
        pline(_("%s is in no shape for %s."), Monnam(u.usteed), for_what);
    } else {
        let wl = (EWounded_legs() & BOTH_SIDES);
        let bp = body_part(LEG);

        if (wl == BOTH_SIDES)
            bp = makeplural(bp);
        Your(_("%s%s %s in no shape for %s."),
             (wl == LEFT_SIDE) ? _("left ") : (wl == RIGHT_SIDE) ? _("right ") : _(""),
             bp, (wl == BOTH_SIDES) ? _("are") : _("is"), for_what);
    }
}

export function set_wounded_legs(side, timex) { /* void */
    /* KMH -- STEED
     * If you are riding, your steed gets the wounded legs instead.
     * You still call this function, but don't lose hp.
     * Caller is also responsible for adjusting messages.
     */
    disp.botl = TRUE;
    if (!Wounded_legs())
        (chars[u.atemp.a + A_DEX])--;

    if (!Wounded_legs() || (HWounded_legs() & TIMEOUT) < timex)
        set_itimeout(ref_of(u.uprops[WOUNDED_LEGS], "intrinsic"), timex);
    /* the leg being wounded and its timeout might differ from one
       attack to the next, but we don't track the legs separately;
       5.0: both legs will ultimately heal together; this used to use
       direct assignment instead of bitwise-OR so getting wounded in
       one leg mysteriously healed the other */
    u.uprops[WOUNDED_LEGS].extrinsic = or64(u.uprops[WOUNDED_LEGS].extrinsic, side);
    encumber_msg();
}

export function heal_legs(
    how) { /* void */ /* 0: ordinary, 1: dismounting steed, 2: limbs turn to stone */
    if (Wounded_legs()) {
        disp.botl = TRUE;
        if (ATEMP(A_DEX) < 0)
            (chars[u.atemp.a + A_DEX])++;

        /* when mounted, wounded legs applies to the steed;
           during petrification countdown, "your limbs turn to stone"
           before the final stages and that calls us (how==2) to cure
           wounded legs, but we want to suppress the feel better message */
        if (!u.usteed && how != 2) {
            let legs = body_part(LEG);

            if ((EWounded_legs() & BOTH_SIDES) == BOTH_SIDES)
                legs = makeplural(legs);
            /* this used to say "somewhat better" but that was
               misleading since legs are being fully healed */
            Your(_("%s %s better."), legs, vtense(legs, _("feel")));
        }

        u.uprops[WOUNDED_LEGS].intrinsic = u.uprops[WOUNDED_LEGS].extrinsic = 0;

        /* Wounded_legs reduces carrying capacity, so we want
           an encumbrance check when they're healed.  However,
           while dismounting, first steed's legs get healed,
           then hero is dropped to floor and a new encumbrance
           check is made [in dismount_steed()].  So don't give
           encumbrance feedback during the dismount stage
           because it could seem to be shown out of order and
           it might be immediately contradicted [able to carry
           more when steed becomes healthy, then possible floor
           feedback, then able to carry less when back on foot]. */
        if (how == 0)
            encumber_msg();
    }
}

/*do.c*/

import { AM_NONE } from "./align.h.js";
import { Align2amask } from "./align.h.macros.js";
import { A_DEX } from "./attrib.h.js";
import { ATEMP } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    NH_AMBER, NH_BLACK, NH_SILVER, NH_WHITE, Something, something, the_your,
} from "./decl.h.macros.js";
import {
    COIN_CLASS, POTION_CLASS, RING_CLASS, S_ZOMBIE, S_altar, S_dnladder, S_dnstair, S_fountain,
    S_grave, S_room, S_sink, S_throne,
} from "./defsym.h.js";
import { gm_levelchange } from "./display.h.js";
import { canspotmon } from "./display.h.macros.js";
import { LFILE_EXISTS, VISITED, struct_d_level, struct_dest_area } from "./dungeon.h.js";
import {
    In_endgame, In_sokoban, In_tutorial, Inhell, Is_airlevel, Is_astralevel, Is_bigroom, Is_knox,
    Is_qstart, Is_rogue_level, Is_stronghold, Is_valley, Is_waterlevel,
} from "./dungeon.h.macros.js";
import { notice_mon_off, notice_mon_on, wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, LL_ACHIEVE, LL_CONDUCT, LL_DEBUG, NHLpa_panic, QBUFSZ, ROWNO, TRUE,
    coordxy,
} from "./global.h.js";
import {
    ALL_FINISHED, ALL_TYPES, ALL_TYPES_SELECTED, BUC_BLESSED, BUC_CURSED, BUC_UNCURSED, BUC_UNKNOWN,
    CHOOSE_ALL, COST_DEGRD, CXN_SINGULAR, DIR_DOWN, DIR_UP, DISMOUNT_FELL, ECMD_FAIL, ECMD_OK,
    ECMD_TIME, ESCAPED, FACE, FREEING, GETOBJ_ALLOWCNT, GETOBJ_PROMPT, HAND, HMON_THROWN,
    INCLUDE_VENOM, INVORDER_SORT, JUSTPICKED, KILLED_BY, LEG, MENU_COMBINATION, MENU_FULL,
    MENU_TRADITIONAL, NC_SHOW_MSG, NHCB_LVL_LEAVE, NO_KILLER_PREFIX, NO_NC_FLAGS, RLOC_NOMSG,
    SELL_DELIBERATE, SELL_NORMAL, SLT_ENCUMBER, STOMACH, TELEDS_NO_FLAGS, TOOKPLUNGE, UNENCUMBERED,
    UNPAID_TYPES, USE_INVLET, WRITING, most_themes, st_all, tut_themes,
} from "./hack.h.js";
import {
    Maybe_Half_Phys, distu, dunlev_reached, max, mdistu, pline1, plur, rn1, tutorial_dnum, y_n,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    ceiling_hider, digests, is_displacer, is_reviver, is_rider, is_whirly, nonliving, passes_walls,
    throws_rocks, touch_petrifies,
} from "./mondata.h.macros.js";
import { G_GENOD, MZ_HUGE } from "./monflag.h.js";
import { DEADMONSTER, is_vampshifter } from "./monst.h.macros.js";
import {
    NON_PM, PM_CROESUS, PM_DEATH, PM_FAMINE, PM_GREEN_SLIME, PM_NURSE, PM_PESTILENCE, PM_ROGUE,
    PM_TOURIST, PM_WRAITH,
} from "./monsters.h.js";
import {
    BURIED_TOO, CONTAINED_TOO, ER_DESTROYED, LOST_DROPPED, OBJ_BURIED, OBJ_CONTAINED, OBJ_FLOOR,
    OBJ_FREE, OBJ_INVENT, OBJ_MINVENT, struct_obj,
} from "./obj.h.js";
import {
    Has_contents, bimanual, has_omid, has_omonst, is_pick, is_plural, polyfood,
} from "./obj.h.macros.js";
import {
    BOULDER, CORPSE, CRYSKNIFE, ENORMOUS_MEATBALL, GLOB_OF_GREEN_SLIME, LEASH, LOADSTONE, MEATBALL,
    MEAT_RING, MEAT_STICK, POT_OIL, RIN_ADORNMENT, RIN_AGGRAVATE_MONSTER, RIN_COLD_RESISTANCE,
    RIN_CONFLICT, RIN_FIRE_RESISTANCE, RIN_FREE_ACTION, RIN_GAIN_CONSTITUTION, RIN_GAIN_STRENGTH,
    RIN_HUNGER, RIN_INCREASE_ACCURACY, RIN_INCREASE_DAMAGE, RIN_INVISIBILITY, RIN_LEVITATION,
    RIN_POISON_RESISTANCE, RIN_POLYMORPH, RIN_POLYMORPH_CONTROL, RIN_PROTECTION,
    RIN_PROTECTION_FROM_SHAPE_CHAN, RIN_REGENERATION, RIN_SEARCHING, RIN_SEE_INVISIBLE,
    RIN_SHOCK_RESISTANCE, RIN_SLOW_DIGESTION, RIN_STEALTH, RIN_SUSTAIN_ABILITY, RIN_TELEPORTATION,
    RIN_TELEPORT_CONTROL, RIN_WARNING, WORM_TOOTH,
} from "./objects.h.js";
import {
    BLINDED, BOTH_SIDES, I_SPECIAL, LEFT_SIDE, LEVITATION, RIGHT_SIDE, TIMEOUT, WOUNDED_LEGS,
    W_ACCESSORY, W_ARMOR, W_ART, W_ARTI, W_SADDLE,
} from "./prop.h.js";
import {
    ALTAR, CORR, DB_FLOOR, DB_UNDER, DRAWBRIDGE_UP, FOUNTAIN, F_LOOTED, GRAVE, LADDER, ROOM, SINK,
    STAIRS, THRONE, T_LOOTED,
} from "./rm.h.js";
import { IS_ALTAR, IS_SINK, IS_WATERWALL, fmon, levl, m_at } from "./rm.h.macros.js";
import { PRIMARYSET, ROGUESET } from "./sym.h.js";
import { REVIVE_MON, ROT_CORPSE, TIMER_OBJECT } from "./timeout.h.js";
import { HOLE, MAGIC_PORTAL, NO_TRAP, PIT, TRAPDOOR, VIBRATING_SQUARE } from "./trap.h.js";
import { is_hole, is_pit } from "./trap.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { WT_SPLASH_THRESHOLD } from "./weight.h.js";
import { mark_synch } from "./winprocs.h.macros.js";
import { PICK_ANY, struct_mi } from "./wintype.h.js";
import {
    ACH_ASTR, ACH_BGRM, ACH_ENDG, ACH_HELL, ACH_MINE, ACH_SOKO, TT_BURIEDBALL, TT_PIT,
    UTOTYPE_ATSTAIRS, UTOTYPE_DEFERRED, UTOTYPE_FALLING, UTOTYPE_NONE, UTOTYPE_PORTAL,
    UTOTYPE_RMPORTAL,
} from "./you.h.js";
import { Luck, Role_if, Upolyd, next2u, u_at } from "./you.h.macros.js";
import {
    BLevitation, Blind, BlindedTimeout, Deaf, ELevitation, EWounded_legs, Fire_resistance, Flying,
    Fumbling, HBlinded, HLevitation, HWounded_legs, Half_physical_damage, Hallucination, Levitation,
    Passes_walls, Punished, Sick, Slimed, Stoned, Strangled, Underwater, Wounded_legs,
} from "./youprop.h.macros.js";
import { char, int, ord, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import { free, memset, sprintf, strchr, strcmp, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { lua_getglobal, lua_pushstring, lua_settop } from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, record_or_opaque, ref_of, struct_assign, view_of,
} from "../rt/struct.js";
import { dupstr } from "./alloc.js";
import { next_to_u, reset_trapset } from "./apply.js";
import { artifact_has_invprop, finesse_ahriman } from "./artifact.js";
import { ballfall, ballrelease, drag_down, drop_ball, placebc, unplacebc } from "./ball.js";
import { bones_include_name } from "./bones.js";
import { check_gold_symbol, describe_level } from "./botl.js";
import {
    cmd_from_func, do_reqmenu, paranoid_ynq, reset_occupations, set_move_cmd, set_occupation,
} from "./cmd.js";
import { is_lava, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    disp, flags, ga, gb, gd, gf, gi, gl, gm, gv, gy, iflags, nhcb_counts, nhcb_name, program_state,
    svc, svd, svh, svl, svm, svn, svp, svq, svu, u,
} from "./decl.js";
import { buried_ball_to_punishment, bury_objs, rot_corpse, use_pick_axe2 } from "./dig.js";
import {
    canseemon, docrt, flush_screen, map_background, map_object, newsym, reglyph_darkroom,
    reset_glyphmap,
} from "./display.js";
import {
    Adjmonnam, Amonnam, Monnam, docall, hcolor, hliquid, mon_nam, obj_pmname, rndmonnam, y_monnam,
} from "./do_name.js";
import { discard_migrations, keepdogs, losedogs, update_mlstmv } from "./dog.js";
import { container_impact_dmg, impact_drop, obj_delivery, ship_object } from "./dokick.js";
import { breakobj, hitfloor } from "./dothrow.js";
import { defsyms } from "./drawing.js";
import {
    Can_fall_thru, In_W_tower, In_hell, In_mines, In_quest, On_W_tower_level, assign_level,
    assign_rnd_level, at_dgn_entrance, builds_up, depth, dunlev, dunlevs_in_dungeon, goto_hell,
    ledger_no, ledger_to_dnum, level_difficulty, maxledgerno, next_level, on_level, prev_level,
    print_level_annotation, recalc_mapseen, recbranch_mapseen, remdun_mapseen, surface, u_on_newpos,
    u_on_rndspot,
} from "./dungeon.js";
import { done, panic } from "./end.js";
import { can_reach_floor, engr_at, make_grave } from "./engrave.js";
import { more_experienced, newexplevel } from "./exper.js";
import { close_nhfile, create_levelfile, delete_levelfile, open_levelfile } from "./files.js";
import { floating_above } from "./fountain.js";
import { glyph_to_cmap } from "./glyphs.js";
import {
    check_special_room, impact_disturbs_zombies, losehp, monster_nearby, near_capacity,
    notice_all_mons, pooleffects, set_uinwater, u_locomotion, u_rooted,
} from "./hack.js";
import { dist2, s_suffix, strncmpi, upstart, visctrl } from "./hacklib.js";
import { record_achievement } from "./insight.js";
import { any_obj_ok, delobj, freeinv, getobj, ggetobj, stackobj, useup, useupf } from "./invent.js";
import { maybe_reset_pick } from "./lock.js";
import { grow_up } from "./makemon.js";
import { gulp_blnd_check } from "./mhitu.js";
import { gain_guardian_angel } from "./minion.js";
import { free_luathemes, mklev } from "./mklev.js";
import { fumaroles, movebubbles, set_levltyp } from "./mkmaze.js";
import {
    add_to_buried, costly_alteration, free_omid, free_omonst, obj_meld, obj_nexto_xy, place_object,
    pudding_merge_message, rider_revival_time, set_bknown, set_corpsenm, splitobj, weight,
} from "./mkobj.js";
import {
    healmon, iter_mons, kill_genocided_monsters, m_in_air, m_into_limbo, mnexto, mondied, newcham,
    set_ustuck, wake_nearto, zombie_form,
} from "./mon.js";
import { locomotion, olfaction, sticks } from "./mondata.js";
import { mons } from "./monst.js";
import { create_mplayers } from "./mplayer.js";
import { mcureblindness } from "./muse.js";
import { nhl_pcall_handle, tutorial } from "./nhlua.js";
import { oinit } from "./o_init.js";
import { objects } from "./objects.js";
import {
    Doname2, The, Tobjnam, an, corpse_xname, doname, fruitname, makeplural, otense, the, vtense,
    xname, yname, yobjnam,
} from "./objnam.js";
import { waterbody_name } from "./pager.js";
import {
    add_valid_menu_class, allow_all, allow_category, count_justpicked, encumber_msg,
    find_justpicked, pickup, query_category, query_objlist, u_safe_from_fatal_corpse,
} from "./pickup.js";
import {
    Norep, There, You, You_cant, You_feel, You_hear, You_see, Your, impossible, livelog_printf,
    pline, pline_The,
} from "./pline.js";
import { body_part, mbodypart } from "./polyself.js";
import { incr_itimeout, make_blinded, set_itimeout } from "./potion.js";
import { reset_hostility } from "./priest.js";
import { ok_to_quest, onquest } from "./quest.js";
import { com_pager, deliver_splev_message } from "./questpgr.js";
import { in_out_region } from "./region.js";
import { getlev } from "./restore.js";
import { d, reseed_random, rn2, rn2_on_display_rng, rnd, rnz } from "./rnd.js";
import { savelev, savestateinlock, tricked_fileremoved } from "./save.js";
import { bufon } from "./sfstruct.js";
import { fix_shop_damage, is_unpaid, obfree, sellobj, sellobj_state, stolen_value } from "./shk.js";
import {
    stairway_at, stairway_find_from, stairway_free_all, u_on_dnstairs, u_on_sstairs, u_on_upstairs,
} from "./stairs.js";
import { mpickobj } from "./steal.js";
import { dismount_steed, stucksteed } from "./steed.js";
import { assign_graphics } from "./symbols.js";
import { enexto, rloc, safe_teleds } from "./teleport.js";
import { burn_away_slime, obj_has_timer, run_timers, start_timer } from "./timeout.js";
import {
    clamp_hole_destination, climb_pit, delfloortrap, deltrap, dotrap, fill_pit, float_down,
    lava_damage, maketrap, minstapetrify, reset_utrap, seetrap, selftouch, t_at, uescaped_shaft,
    uteetering_at_seen_pit, water_damage,
} from "./trap.js";
import { hmon } from "./uhitm.js";
import { recalc_block_point, vision_recalc, vision_reset } from "./vision.js";
import { dmgval } from "./weapon.js";
import { setuqwep, setuswapwep, setuwep, welded, weldmsg } from "./wield.js";
import { resurrect } from "./wizard.js";
import { bypass_objlist, nxt_unbypassed_obj } from "./worn.js";
import { get_container_location, get_obj_location, obj_resists, revive } from "./zap.js";
import { error } from "../sys/c2js/nhjs_host.js";
const struct_lua_State = record_or_opaque("struct_lua_State");
