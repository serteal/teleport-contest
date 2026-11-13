/* NetHack 5.0	monmove.c	$NHDT-Date: 1737392015 2025/01/20 08:53:35 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.266 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

/* a11y: give a message when monster moved */
function msg_mon_movement(mtmp, omx, omy) { /* void */
    if (a11y.mon_movement && canspotmon(mtmp) && mtmp.mspotted) {
        let nix = mtmp.mx, niy = mtmp.my;
        let n2u = next2u(nix, niy),
            close = +(!n2u && (distu(nix, niy) <= (BOLT_LIM * BOLT_LIM))),
            closer = +(!n2u && (distu(nix, niy) <= distu(omx, omy)));

        pline_xy(nix, niy, _("%s %s%s."), Monnam(mtmp),
                 vtense(0, locomotion(mtmp.data, _("move"))),
                 n2u ? _(" next to you")
                 : (close && closer) ? _(" closer")
                 : (close && !closer) ? _(" further away")
                 : _(" in the distance"));
    }
}

/* monster has triggered trapped door lock or was present when it got
   triggered remotely (at door spot, door hit by zap);
   returns True if mtmp dies */
export function mb_trapped(mtmp, canseeit) { /* boolean */
    if (flags.verbose) {
        if (canseeit && !Unaware())
            pline_mon(mtmp, _("KABOOM!!  You see a door explode."));
        else if (!Deaf())
            You_hear(_("a %s explosion."),
                     (mdistu(mtmp) > 7 * 7) ? _("distant") : _("nearby"));
    }
    wake_nearto(mtmp.mx, mtmp.my, 7 * 7);
    mtmp.mstun = 1;
    mtmp.mhp -= rnd(15);
    if (DEADMONSTER(mtmp)) {
        mondied(mtmp);
        if (DEADMONSTER(mtmp))
            return TRUE;
        /* will get here if lifesaved */
    }
    mon_learns_traps(mtmp, TRAPPED_DOOR);
    return FALSE;
}

/* push coordinate x,y to mtrack, making monster remember where it was */
export function mon_track_add(mtmp, x, y) { /* void */
    let j;

    for (j = MTSZ - 1; j > 0; j--)
        struct_assign(mtmp.mtrack[j], mtmp.mtrack[j - 1]);
    mtmp.mtrack[0].x = x;
    mtmp.mtrack[0].y = y;
}

export function mon_track_clear(mtmp) { /* void */
    memset(addr_of(mtmp.mtrack[0]), 0, sizeof_member(mtmp, "mtrack"));
}

/* check whether a monster is carrying a locking/unlocking tool */
export function monhaskey(
    mon,
    for_unlocking) { /* boolean */ /* true => credit card ok, false => not ok */
    if (for_unlocking && m_carrying(mon, CREDIT_CARD))
        return TRUE;
    return (m_carrying(mon, SKELETON_KEY) || m_carrying(mon, LOCK_PICK) ? 1 : 0);
}

export function mon_yells(mon, shout) { /* void */
    if (Deaf()) {
        if (canspotmon(mon))
            /* Sidenote on "A watchman angrily waves her arms!"
             * Female being called watchman is correct (career name).
             */
            pline_mon(mon, _("%s angrily %s %s %s!"),
                Amonnam(mon),
                nolimbs(mon.data) ? _("shakes") : _("waves"),
                mhis(mon),
                nolimbs(mon.data) ? mbodypart(mon, HEAD)
                                   : makeplural(mbodypart(mon, ARM)));
    } else {
        if (canspotmon(mon)) {
            pline_mon(mon, _("%s yells:"), Amonnam(mon));
        } else {
            /* Soundeffect(se_someone_yells, 75); */
            You_hear(_("someone yell:"));
        }
           ;
        verbalize1(shout);
    }
}

/* can monster mtmp break boulders? */
export function m_can_break_boulder(mtmp) { /* boolean */
    return (is_rider(mtmp.data)
            || (!mtmp.mspec_used
                && (mtmp.isshk || mtmp.ispriest
                    || (mtmp.data.msound == MS_LEADER))) ? 1 : 0);
}

/* monster mtmp breaks boulder at x,y */
export function m_break_boulder(mtmp, x, y) { /* void */
    let otmp;

    if (m_can_break_boulder(mtmp) && ((otmp = sobj_at(BOULDER, x, y)) != null)) {
        if (!is_rider(mtmp.data)) {
            if (!Deaf() && (mdistu(mtmp) < 4*4)) {
                if (canspotmon(mtmp))
                    set_msg_xy(mtmp.mx, mtmp.my);
                pline(_("%s mutters %s."),
                      Monnam(mtmp),
                      mtmp.ispriest ? _("a prayer") : _("an incantation"));
            }
            mtmp.mspec_used += rn1(20, 10);
        }
        if (cansee(x, y)) {
            set_msg_xy(x, y);
            pline_The(_("boulder falls apart."));
        }

        /* boulders pushed onto shop's boundary or free spot are cases where
           an item not in hero's inventory can have its unpaid flag set;
           if the boulder isn't already on the bill, don't charge for it */
        if (otmp.unpaid) {
            /* remove original from bill + add cloned copy to used-up bill */
            bill_dummy_object(otmp);
        }
        /* fracturing keeps otmp, changing its otyp from BOULDER to ROCK */
        fracture_rock(otmp);
    }
}

function watch_on_duty(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let x = stack_var(coordxy), y = stack_var(coordxy);

    if (mtmp.mpeaceful && in_town(u.ux + u.dx, u.uy + u.dy)
        && mtmp.mcansee && m_canseeu(mtmp) && !rn2(3)) {
        if (picking_lock(x, y) && IS_DOOR(levl()[x[0]][y[0]].typ)
            && (levl()[x[0]][y[0]].flags & D_LOCKED)) {
            if (couldsee(mtmp.mx, mtmp.my)) {
                if (levl()[x[0]][y[0]].flags & D_WARNED) {
                    mon_yells(mtmp, _("Halt, thief!  You're under arrest!"));
                    angry_guards(+!!Deaf());
                } else {
                    mon_yells(mtmp, _("Hey, stop picking that lock!"));
                    levl()[x[0]][y[0]].flags |= D_WARNED;
                }
                stop_occupation();
            }
        } else if (is_digging()) {
            /* chewing, wand/spell of digging are checked elsewhere */
            watch_dig(mtmp, svc.context.digging.pos.x,
                      svc.context.digging.pos.y, FALSE);
        }
    }
    } finally { stack_pop($frame); }
}

/* move a monster; if a threat to busy hero, stop doing whatever it is */
export function dochugw(
    mtmp,
    chug) { /* int */ /* True: monster is moving; * False: monster was just created or has teleported * so perform stop-what-you're-doing-if-close-enough- * to-be-a-threat check but don't move mtmp */
    let x = mtmp.mx, y = mtmp.my; /* 'mtmp's location before dochug() */
    /* skip canspotmon() if occupation is Null */
    let already_saw_mon = (chug && go.occupation) ? canspotmon(mtmp) : 0;
    let rd = chug ? dochug(mtmp) : 0;

    /*
     * A similar check is in monster_nearby() in hack.c.
     * [The two checks have a lot of differences and chances are high
     * that some of those are unintentional.]
     */

    /* check whether hero notices monster and stops current activity */
    if (go.occupation && !rd
        /* monster is hostile and can attack (or hallu distorts knowledge) */
        && (Hallucination() || (!mtmp.mpeaceful && !noattacks(mtmp.data)))
        /* it's close enough to be a threat */
        && mdistu(mtmp) <= (BOLT_LIM + 1) * (BOLT_LIM + 1)
        /* and either couldn't see it before, or it was too far away */
        && (!already_saw_mon || !couldsee(x, y)
            || distu(x, y) > (BOLT_LIM + 1) * (BOLT_LIM + 1))
        /* can see it now, or sense it and would normally see it */
        && canspotmon(mtmp) && couldsee(mtmp.mx, mtmp.my)
        /* monster isn't paralyzed or afraid (scare monster/Elbereth) */
        && mtmp.mcanmove && !onscary(u.ux, u.uy, mtmp))
        stop_occupation();

    return rd;
}

export function onscary(x, y, mtmp) { /* boolean */
    let ep;
    /* <0,0> is used by musical scaring;
     * it doesn't care about scrolls or engravings or dungeon branch */
    let auditory_scare = +(x == 0 && y == 0),
            magical_scare = +!auditory_scare;

    /* creatures who are directly resistant to any type of scaring:
     * Rodney, lawful minions, Angels, the Riders */
    if (mtmp.iswiz || is_lminion(mtmp) || mtmp.data == mons[PM_ANGEL]
        || is_rider(mtmp.data))
        return FALSE;

    /* creatures who are directly resistant to magical scaring
     * based on the mere presence of something at a location:
     * humans etc.
     * uniques have ascended their base monster instincts */
    if (magical_scare
        && (mtmp.data.mlet == S_HUMAN || unique_corpstat(mtmp.data)))
        return FALSE;

    /* creatues who resist scaring under particular circumstances:
     * shopkeepers inside their own shop
     * priests inside their own temple */
    if ((mtmp.isshk && inhishop(mtmp))
        || (mtmp.ispriest && inhistemple(mtmp)))
        return FALSE;

    if (auditory_scare)
        return TRUE;

    /* should this still be true for defiled/molochian altars? */
    if (IS_ALTAR(levl()[x][y].typ)
        && (mtmp.data.mlet == S_VAMPIRE || is_vampshifter(mtmp)))
        return TRUE;

    /* the scare monster scroll doesn't have any of the below
     * restrictions, being its own source of power */
    if (sobj_at(SCR_SCARE_MONSTER, x, y))
        return TRUE;

    /*
     * Creatures who don't (or can't) fear a written Elbereth:
     * all the above plus shopkeepers (even if poly'd into non-human),
     * vault guards (also even if poly'd), blind or peaceful monsters,
     * humans and elves, and minotaurs.
     *
     * If the player isn't actually on the square OR the player's image
     * isn't displaced to the square, no protection is being granted.
     *
     * Elbereth doesn't work in Gehennom, the Elemental Planes, or the
     * Astral Plane; the influence of the Valar only reaches so far.
     */
    return ((ep = sengr_at(_("Elbereth"), x, y, TRUE)) != null
            && (u_at(x, y)
                || (Displaced() && mtmp.mux == x && mtmp.muy == y)
                || (ep.guardobjects && vobj_at(x, y)))
            && !(mtmp.isshk || mtmp.isgd || !mtmp.mcansee
                 || mtmp.mpeaceful
                 || mtmp.data == mons[PM_MINOTAUR]
                 || Inhell() || In_endgame(u.uz)) ? 1 : 0);
}

/* regenerate lost hit points */
export function mon_regen(mon, digest_meal) { /* void */
    if (svm.moves % 20 == 0 || regenerates(mon.data))
        healmon(mon, 1, 0);
    if (mon.mspec_used)
        mon.mspec_used--;
    if (digest_meal) {
        if (mon.meating) {
            mon.meating--;
            if (mon.meating <= 0)
                finish_meating(mon);
        }
    }
}

/*
 * Possibly awaken the given monster.  Return a 1 if the monster has been
 * jolted awake.
 */
function disturb(mtmp) { /* int */
    /*
     * + Ettins are hard to surprise.
     * + Nymphs, jabberwocks, and leprechauns do not easily wake up.
     *
     * Wake up if:
     *  in direct LOS                                           AND
     *  within 10 squares                                       AND
     *  not stealthy or (mon is an ettin and 9/10)              AND
     *  (mon is not a nymph, jabberwock, or leprechaun) or 1/50 AND
     *  Aggravate or mon is (dog or human) or
     *      (1/7 and mon is not mimicking furniture or object)
     */
    if (couldsee(mtmp.mx, mtmp.my) && mdistu(mtmp) <= 100
        && (!Stealth() || (mtmp.data == mons[PM_ETTIN] && rn2(10)))
        && (!(mtmp.data.mlet == S_NYMPH
              || mtmp.data == mons[PM_JABBERWOCK]

              || mtmp.data.mlet == S_LEPRECHAUN) || !rn2(50))
        && (Aggravate_monster()
            || (mtmp.data.mlet == S_DOG || mtmp.data.mlet == S_HUMAN)
            || (!rn2(7) && M_AP_TYPE(mtmp) != M_AP_FURNITURE
                && M_AP_TYPE(mtmp) != M_AP_OBJECT))) {
        wake_msg(mtmp, +!mtmp.mpeaceful);
        mtmp.msleeping = 0;
        return 1;
    }
    return 0;
}

/* ungrab/expel held/swallowed hero */
function release_hero(mon) { /* void */
    if (mon == u.ustuck) {
        if (u.uswallow) {
            expels(mon, mon.data, TRUE);
        } else if (!sticks(gy.youmonst.data)) {
            unstuck(mon); /* let go */
            You(_("get released!"));
        }
    }
}

export function find_pmmonst(pm) { /* struct monst * */
    let mtmp = null;

    if ((svm.mvitals[pm].mvflags & G_GENOD) == 0)
        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp))
                continue;
            if (mtmp.data == mons[pm])
                break;
        }

    return mtmp;
}

/* killer bee 'mon' is on a spot containing lump of royal jelly 'obj' and
   will eat it if there is no queen bee on the level; return 1: mon died,
   0: mon ate jelly and lived; -1: mon didn't eat jelly to use its move */
export function bee_eat_jelly(mon, obj) { /* int */
    let m_delay;
    let mtmp = find_pmmonst(PM_QUEEN_BEE);

    /* if there's no queen on the level, eat the royal jelly and become one */
    if (!mtmp) {
        m_delay = obj.blessed ? 3 : !obj.cursed ? 5 : 7;
        if (obj.quan > 1)
            obj = splitobj(obj, 1);
        if (canseemon(mon))
            pline_mon(mon, _("%s eats %s."), Monnam(mon), an(xname(obj)));
        delobj(obj);

        if (mon.m_lev < mons[PM_QUEEN_BEE].mlevel - 1)
            mon.m_lev = uchar((mons[PM_QUEEN_BEE].mlevel - 1));
        /* there should be delay after eating, but that's too much
           hassle; transform immediately, then have a short delay */
        grow_up(mon, null);

        if (DEADMONSTER(mon))
            return 1; /* dead; apparently queen bees have been genocided */
        mon.mfrozen = unsigned(m_delay), mon.mcanmove = 0;
        return 0; /* bee used its move */
    }
    return -1; /* a queen is already present; ordinary bee hasn't moved yet */
}

/* gelatinous cube eats something from its inventory */
function gelcube_digests(mtmp) { /* int */
    let otmp = mtmp.minvent;

    if (mtmp.meating || !mtmp.minvent)
        return -1;

    while (otmp) {
        if (is_organic(otmp) && !otmp.oartifact
            && !is_mines_prize(otmp) && !is_soko_prize(otmp))
            break;
        otmp = otmp.nobj;
    }

    if (!otmp)
        return -1;

    mtmp.meating = eaten_stat(mtmp.meating, otmp);
    extract_from_minvent(mtmp, otmp, TRUE, TRUE);
    m_consume_obj(mtmp, otmp);
    return 0; /* used a move */
}

/* FIXME: gremlins don't flee from monsters wielding Sunsword or wearing
   gold dragon scales/mail, nor from gold dragons, only from the hero */
export function flees_light(mon) { return (mon.data == mons[PM_GREMLIN]
     && ((uwep && uwep.lamplit && artifact_light(uwep))
         || (uarm && uarm.lamplit && artifact_light(uarm)))
     /* not applicable if mon can't see or hero isn't in line of sight */
     && mon.mcansee && couldsee(mon.mx, mon.my) ? 1 : 0); }

/* monster begins fleeing for the specified time, 0 means untimed flee
 * if first, only adds fleetime if monster isn't already fleeing
 * if fleemsg, prints a message about new flight, otherwise, caller should */
export function monflee(
    mtmp,
    fleetime,
    first,
    fleemsg) { /* void */
    /* shouldn't happen; maybe warrants impossible()? */
    if (DEADMONSTER(mtmp))
        return;

    if (mtmp == u.ustuck)
        release_hero(mtmp); /* expels/unstuck */

    if (!first || !mtmp.mflee) {
        /* don't lose untimed scare */
        if (!fleetime)
            mtmp.mfleetim = 0;
        else if (!mtmp.mflee || mtmp.mfleetim) {
            fleetime += mtmp.mfleetim;
            /* ensure monster flees long enough to visibly stop fighting */
            if (fleetime == 1)
                fleetime++;
            mtmp.mfleetim = unsigned(min(fleetime, 127));
        }
        if (!mtmp.mflee && fleemsg && canseemon(mtmp)
            && M_AP_TYPE(mtmp) != M_AP_FURNITURE
            && M_AP_TYPE(mtmp) != M_AP_OBJECT) {
            /* unfortunately we can't distinguish between temporary
               sleep and temporary paralysis, so both conditions
               receive the same alternate message */
            if (!mtmp.mcanmove || !mtmp.data.mmove) {
                pline_mon(mtmp, _("%s seems to flinch."),
                          Adjmonnam(mtmp, _("immobile")));
            } else if (flees_light(mtmp)) {
                if (Unaware()) {
                    /* tell the player even if the hero is unconscious */
                    pline_mon(mtmp, _("%s is frightened."), Monnam(mtmp));
                } else if (rn2(10) || Deaf()) {
                    /* via flees_light(), will always be either via uwep
                       (Sunsword) or uarm (gold dragon scales/mail) or both;
                       TODO? check for both and describe the one which is
                       emitting light with a bigger radius */
                    let lsrc = (uwep && artifact_light(uwep))
                                       ? bare_artifactname(uwep)
                                       : (uarm && artifact_light(uarm))
                                         ? yname(uarm)
                                         : _("[its imagination?]");

                    pline_mon(mtmp, _("%s flees from the painful light of %s."),
                          Monnam(mtmp), lsrc);
                } else {
                       ;
                    verbalize(_("Bright light!"));
                }
            } else {
                pline_mon(mtmp, _("%s turns to flee."), Monnam(mtmp));
            }
        }

        if (mtmp.data == mons[PM_VROCK] && !mtmp.mspec_used) {
            mtmp.mspec_used = 75 + rn2(25);
            create_gas_cloud(mtmp.mx, mtmp.my, 5, 8);
        }

        mtmp.mflee = 1;
    }
    /* ignore recently-stepped spaces when made to flee */
    mon_track_clear(mtmp);
}

function distfleeck(
    mtmp,
    inrange, nearby, scared) { /* void */ /* output */
    let seescaryx, seescaryy;
    let sawscary = FALSE, bravegremlin = +(rn2(5) == 0);

    inrange[0] = +(dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy)
                <= (BOLT_LIM * BOLT_LIM));
    nearby[0] = (inrange[0] && monnear(mtmp, mtmp.mux, mtmp.muy) ? 1 : 0);

    /* Note: if your image is displaced, the monster sees the Elbereth
     * at your displaced position, thus never attacking your displaced
     * position, but possibly attacking you by accident.  If you are
     * invisible, it sees the Elbereth at your real position, thus never
     * running into you by accident but possibly attacking the spot
     * where it guesses you are.
     */
    if (!mtmp.mcansee || (Invis() && !perceives(mtmp.data))) {
        seescaryx = mtmp.mux;
        seescaryy = mtmp.muy;
    } else {
        seescaryx = u.ux;
        seescaryy = u.uy;
    }

    sawscary = onscary(seescaryx, seescaryy, mtmp);
    if (nearby[0] && (sawscary
                    || (flees_light(mtmp) && !bravegremlin)
                    || (!mtmp.mpeaceful && in_your_sanctuary(mtmp, 0, 0)))) {
        scared[0] = 1;
        monflee(mtmp, rnd(rn2(7) ? 10 : 100), TRUE, TRUE);
    } else
        scared[0] = 0;
}

/* perform a special one-time action for a monster; returns -1 if nothing
   special happened, 0 if monster uses up its turn, 1 if monster is killed */
function m_arrival(mon) { /* int */
    mon.mstrategy = and64u(mon.mstrategy, ~STRAT_ARRIVE); /* always reset */

    return -1;
}

/* a mind flayer unleashes a mind blast  */
function mind_blast(mtmp) { /* void */
    let m2, nmon = null;

    if (canseemon(mtmp))
        pline_mon(mtmp, _("%s concentrates."), Monnam(mtmp));
    if (mdistu(mtmp) > BOLT_LIM * BOLT_LIM) {
        You(_("sense a faint wave of psychic energy."));
        return;
    }
    pline(_("A wave of psychic energy pours over you!"));
    if (mtmp.mpeaceful
        && (!Conflict() || resist_conflict(mtmp))) {
        pline(_("It feels quite soothing."));
    } else if (!u.uinvulnerable) {
        let dmg;
        let m_sen = sensemon(mtmp);

        if (m_sen || (Blind_telepat() && rn2(2)) || !rn2(10)) {
            /* hiding monsters are brought out of hiding when hit by
                a psychic blast, so do the same for hiding poly'd hero */
            if (u.uundetected) {
                u.uundetected = 0;
                newsym(u.ux, u.uy);
            } else if (U_AP_TYPE() != M_AP_NOTHING
                        /* hero has no way to hide as monster but
                            check for that theoretical case anyway */
                        && U_AP_TYPE() != M_AP_MONSTER) {
                gy.youmonst.m_ap_type = M_AP_NOTHING;
                gy.youmonst.mappearance = 0;
                newsym(u.ux, u.uy);
            }
            pline(_("It locks on to your %s!"),
                    m_sen ? _("telepathy")
                    : Blind_telepat() ? _("latent telepathy")
                    : _("mind")); /* note: hero is never mindless */
            dmg = rnd(15);
            if (Half_spell_damage())
                dmg = Math.trunc((dmg + 1) / 2);
            losehp(dmg, _("psychic blast"), KILLED_BY_AN);
        }
    }
    for (m2 = fmon(); m2; m2 = nmon) {
        nmon = m2.nmon;
        if (DEADMONSTER(m2))
            continue;
        if (m2.mpeaceful == mtmp.mpeaceful)
            continue;
        if (mindless(m2.data))
            continue;
        if (m2 == mtmp)
            continue;
        if ((telepathic(m2.data) && (rn2(2) || m2.mblinded)) || !rn2(10)) {
            /* wake it up first, to bring hidden monster out of hiding */
            wakeup(m2, FALSE);
            if (cansee(m2.mx, m2.my))
                pline(_("It locks on to %s."), mon_nam(m2));
            m2.mhp -= rnd(15);
            if (DEADMONSTER(m2))
                monkilled(m2, _(""), AD_DRIN);
        }
    }
}

/* called every turn for each living monster on the map, and the hero;
   caller makes sure that we're not called for DEADMONSTER() */
export function m_everyturn_effect(mtmp) { /* void */
    let is_u = (mtmp == gy.youmonst) ? TRUE : FALSE;
    let x = is_u ? u.ux : mtmp.mx,
            y = is_u ? u.uy : mtmp.my;

    if (mtmp.data == mons[PM_FOG_CLOUD]) {
        /* don't leave a vapor cloud if some other gas cloud is already
           present, or when flowing under closed doors so that visibility
           changes aren't mixed with messages about doing such */
        if (!closed_door(x, y) && !visible_region_at(x, y))
            create_gas_cloud(x, y, 1, 0); /* harmless vapor */
    }
}

/* do whatever effects monster has after moving.
   called for both monsters and polyed hero.
   for hero, called after location changes,
   to prevent spam messages for hero getting enveloped in a cloud.
   for monsters, called before location changes,
   because monsters don't have "previous location" field */
export function m_postmove_effect(mtmp) { /* void */
    let is_u = (mtmp == gy.youmonst) ? TRUE : FALSE;
    let x = is_u ? u.ux0 : mtmp.mx,
            y = is_u ? u.uy0 : mtmp.my;

    /* Hezrous create clouds of stench. This does not cost a move. */
    if (mtmp.data == mons[PM_HEZROU]) /* stench */
        create_gas_cloud(x, y, 1, 8);
    else if (mtmp.data == mons[PM_STEAM_VORTEX] && !mtmp.mcan)
        create_gas_cloud(x, y, 1, 0); /* harmless vapor */
}

/* returns 1 if monster died moving, 0 otherwise */
/* The whole dochugw/m_move/distfleeck/mfndpos section is serious spaghetti
 * code. --KAA
 */
export function dochug(mtmp) { /* int */
    const $frame = stack_frame(); try {
    let mdat;
    let status = MMOVE_NOTHING;
    let inrange = stack_var(int), nearby = stack_var(int), scared = stack_var(int), res;
    let otmp;
    let panicattk = FALSE;

    /*
     * PHASE ONE: Pre-movement adjustments
     */

    mdat = mtmp.data;

    if (mtmp.mstrategy & STRAT_ARRIVE) {
        res = m_arrival(mtmp);
        if (res >= 0)
            return res;
    }
    /* check for waitmask status change */
    if ((mtmp.mstrategy & STRAT_WAITFORU)
        && (m_canseeu(mtmp) || mtmp.mhp < mtmp.mhpmax))
        mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITFORU);

    /* update quest status flags */
    quest_stat_check(mtmp);

    if (!mtmp.mcanmove || (mtmp.mstrategy & STRAT_WAITMASK)) {
        if (Hallucination())
            newsym(mtmp.mx, mtmp.my);
        if (mtmp.mcanmove && (mtmp.mstrategy & STRAT_CLOSE)
            && !mtmp.msleeping && monnear(mtmp, u.ux, u.uy))
            quest_talk(mtmp); /* give the leaders a chance to speak */
        return 0;             /* other frozen monsters can't do anything */
    }

    /* there is a chance we will wake it */
    if (mtmp.msleeping && !disturb(mtmp)) {
        if (Hallucination())
            newsym(mtmp.mx, mtmp.my);
        return 0;
    }

    /* not frozen or sleeping: wipe out texts written in the dust */
    wipe_engr_at(mtmp.mx, mtmp.my, 1, FALSE);

    /* confused monsters get unconfused with small probability */
    if (mtmp.mconf && !rn2(50))
        mtmp.mconf = 0;

    /* stunned monsters get un-stunned with larger probability */
    if (mtmp.mstun && !rn2(10))
        mtmp.mstun = 0;

    /* Some monsters teleport. Teleportation costs a turn. */
    if (mtmp.mflee && !rn2(40) && can_teleport(mdat) && !mtmp.iswiz
        && !noteleport_level(mtmp)) {
        if (rloc(mtmp, RLOC_MSG))
            leppie_stash(mtmp);
        return 0;
    }

    /* some monsters have special abilities */
    m_respond(mtmp);
    if (DEADMONSTER(mtmp))
        return 1; /* m_respond gaze can kill medusa */

    /* fleeing monsters might regain courage */
    if (mtmp.mflee && !mtmp.mfleetim && mtmp.mhp == mtmp.mhpmax
        && !rn2(25))
        mtmp.mflee = 0;

    /* Cease conflict-induced swallow/grab if conflict has ended. Releasing
       the hero in this way uses up the monster's turn. */
    if (mtmp == u.ustuck && mtmp.mpeaceful && !mtmp.mconf && !Conflict()) {
        release_hero(mtmp);
        return 0;
    }

    /*
     * PHASE TWO: Special Movements and Actions
     */

    /* The monster decides where it thinks you are. This call to set_apparxy()
       must be done after you move and before the monster does. The
       set_apparxy() call in m_move() doesn't suffice since the variables
       inrange, etc. all depend on stuff set by set_apparxy().
     */
    set_apparxy(mtmp);

    /* Monsters that want to acquire things may teleport, so do it before
       inrange is set. This costs a turn only if mstate is set.  */
    if (is_covetous(mdat)) {
        tactics(mtmp);
        /* tactics -> mnexto -> deal_with_overcrowding */
        if (mtmp.mstate)
            return 0;
        set_apparxy(mtmp);
    }

    /* check distance and scariness of attacks */
    distfleeck(mtmp, inrange, nearby, scared);

    /* search for and potentially use defensive or miscellaneous items. */
    if (find_defensive(mtmp, FALSE)) {
        if (use_defensive(mtmp) != 0)
            return 1;
    } else if (find_misc(mtmp)) {
        if (use_misc(mtmp) != 0)
            return 1;
    }

    /* Demonic Blackmail! */
    if (nearby[0] && mdat.msound == MS_BRIBE && mtmp.mpeaceful && !mtmp.mtame
        && !u.uswallow) {
        if (mtmp.mux != u.ux || mtmp.muy != u.uy) {
            pline(_("%s whispers at thin air."),
                  cansee(mtmp.mux, mtmp.muy) ? Monnam(mtmp) : _("It"));

            if (is_demon(gy.youmonst.data)) {
                /* "Good hunting, brother" */
                if (!tele_restrict(mtmp))
                    rloc(mtmp, RLOC_MSG);
            } else {
                mtmp.minvis = mtmp.perminvis = 0;
                /* Why?  For the same reason in real demon talk */
                if (canseemon(mtmp))
                    set_msg_xy(mtmp.mx, mtmp.my);
                pline(_("%s gets angry!"), Amonnam(mtmp));
                mtmp.mpeaceful = 0;
                set_malign(mtmp);
                /* since no way is an image going to pay it off */
            }
        } else if (demon_talk(mtmp))
            return 1; /* you paid it off */
    }

    /* the watch will look around and see if you are up to no good :-) */
    if (is_watch(mdat)) {
        watch_on_duty(mtmp);
    /* mind flayers can make psychic attacks! */
    } else if (is_mind_flayer(mdat) && !rn2(20)) {
        mind_blast(mtmp);
        set_apparxy(mtmp);
        distfleeck(mtmp, inrange, nearby, scared);
    }

    /* If monster is nearby you, and has to wield a weapon, do so.  This
     * costs the monster a move, of course.
     */
    if ((!mtmp.mpeaceful || Conflict()) && inrange[0]
        && dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy) <= 8
        && attacktype(mdat, AT_WEAP)) {
        let mw_tmp;

        /* The scared check is necessary.  Otherwise a monster that is
         * one square near the player but fleeing into a wall would keep
         * switching between pick-axe and weapon.  If monster is stuck
         * in a trap, prefer ranged weapon (wielding is done in thrwmu).
         * This may cost the monster an attack, but keeps the monster
         * from switching back and forth if carrying both.
         */
        mw_tmp = MON_WEP(mtmp);
        if (!(scared[0] && mw_tmp && is_pick(mw_tmp))
            && mtmp.weapon_check == NEED_WEAPON
            && !(mtmp.mtrapped && !nearby[0] && select_rwep(mtmp))) {
            mtmp.weapon_check = NEED_HTH_WEAPON;
            if (mon_wield_item(mtmp) != 0)
                return 0;
        }
    }

    /*
     * PHASE THREE: Now the actual movement phase
     */

    /* A killer bee may eat honey in order to turn into a queen bee,
       costing it a move. */
    if (mdat == mons[PM_KILLER_BEE]
        /* could be smarter and deliberately move to royal jelly, but
           then we'd need to scan the level for queen bee in advance;
           avoid that overhead and rely on serendipity... */
        && (otmp = sobj_at(LUMP_OF_ROYAL_JELLY, mtmp.mx, mtmp.my)) != null
        && (res = bee_eat_jelly(mtmp, otmp)) >= 0)
        return res;

    if (mdat == mons[PM_GELATINOUS_CUBE]
        && (res = gelcube_digests(mtmp)) >= 0)
        return res;

    /* A monster that passes the following checks has the opportunity
       to move. Movement itself is handled by the m_move() function. */
    if (!nearby[0] || mtmp.mflee || scared[0] || mtmp.mconf || mtmp.mstun
        || (mtmp.minvis && !rn2(3))
        || (mdat.mlet == S_LEPRECHAUN && !findgold(gi.invent)
            && (findgold(mtmp.minvent) || rn2(2)))
        || (is_wanderer(mdat) && !rn2(4)) || (Conflict() && !mtmp.iswiz)
        || (!mtmp.mcansee && !rn2(4)) || mtmp.mpeaceful) {
        /* Possibly cast an undirected spell if not attacking you */
        /* note that most of the time castmu() will pick a directed
           spell and do nothing, so the monster moves normally */
        /* arbitrary distance restriction to keep monster far away
           from you from having cast dozens of sticks-to-snakes
           or similar spells by the time you reach it */
        if (!mtmp.mspec_used
            && dist2(mtmp.mx, mtmp.my, u.ux, u.uy) <= 49) {
            let a;

            for (a = ptr_add(mdat.mattk[0], 0); a < ptr_add(mdat.mattk[0], NATTK); a = ptr_add(a, 1)) {
                if (a.aatyp == AT_MAGC
                    && (a.adtyp == AD_SPEL || a.adtyp == AD_CLRC)) {
                    if ((castmu(mtmp, a, FALSE, FALSE) & M_ATTK_HIT)) {
                        status = MMOVE_DONE; /* bypass m_move() */
                        break;
                    }
                }
            }
        }

        if (!status)
            status = m_move(mtmp, 0);
        if (mon_offmap(mtmp))
            return 1;
        if (status != MMOVE_DIED)
            distfleeck(mtmp, inrange, nearby, scared); /* recalc */

        switch (status) { /* for pets, cases 0 and 3 are equivalent */
        case MMOVE_NOMOVES:
            if (scared[0])
                panicattk = TRUE;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case MMOVE_NOTHING: /* no movement, but it can still attack you */
        case MMOVE_DONE: /* absolutely no movement */
            /* vault guard might have vanished */
            if (mtmp.isgd && (DEADMONSTER(mtmp) || mtmp.mx == 0))
                return 1; /* behave as if it died */
            /* During hallucination, monster appearance should
             * still change - even if it doesn't move.
             */
            if (Hallucination())
                newsym(mtmp.mx, mtmp.my);
            break;
        case MMOVE_MOVED: /* monster moved */
            /* if confused grabber has wandered off, let go */
            if (mtmp == u.ustuck && !m_next2u(mtmp))
                unstuck(mtmp);
            if (grounded(mdat))
                disturb_buried_zombies(mtmp.mx, mtmp.my);
            /* Maybe it stepped on a trap and fell asleep... */
            if (helpless(mtmp))
                return 0;
            /* Monsters can move and then shoot on same turn;
               our hero can't.  Is that fair? */
            if (!nearby[0]
                && (ranged_attk_available(mtmp)
                            || attacktype(mdat, AT_WEAP)
                            || find_offensive(mtmp)))
                break;
            /* a monster that's digesting you can move at the
             * same time -dlc
             */
            if (engulfing_u(mtmp))
                return mattacku(mtmp);
            return 0;
        case MMOVE_DIED: /* monster died */
            return 1;
        }
    }

    /*
     * PHASE FOUR: Standard Attacks
     */

    /* Now, attack the player if possible - one attack set per monst */
    if (status != MMOVE_DONE && (!mtmp.mpeaceful
                                 || (Conflict() && !resist_conflict(mtmp)))) {
        if (((inrange[0] && !scared[0]) || panicattk) && !noattacks(mdat)
            /* [is this hp check really needed?] */
            && (Upolyd() ? u.mh : u.uhp) > 0) {
            if (mattacku(mtmp))
                return 1; /* monster died (e.g. exploded) */
        }
        if (mtmp.wormno) {
            if (wormhitu(mtmp))
                return 1; /* worm died (poly'd hero passive counter-attack) */
        }
    }
    /* special speeches for quest monsters */
    if (!helpless(mtmp) && nearby[0])
        quest_talk(mtmp);
    /* extra emotional attack for vile monsters */
    if (inrange[0] && mtmp.data.msound == MS_CUSS && !mtmp.mpeaceful
        && couldsee(mtmp.mx, mtmp.my) && !mtmp.minvis && !rn2(5))
        cuss(mtmp);

    /* note: can't get here when monster is dead, so this always returns 0 */
    return +(status == MMOVE_DIED);
    } finally { stack_pop($frame); }
}

const practical = static_array("practical", char, null, [ WEAPON_CLASS, ARMOR_CLASS,
                                           GEM_CLASS, FOOD_CLASS, 0 ]);
const magical = static_array("magical", char, null, [ AMULET_CLASS, POTION_CLASS,
                                         SCROLL_CLASS, WAND_CLASS,
                                         RING_CLASS,   SPBOOK_CLASS, 0 ]);

/* monster mtmp would love to take object otmp? */
export function mon_would_take_item(mtmp, otmp) { /* boolean */
    let pctload = Math.trunc((curr_mon_load(mtmp) * 100) / max_mon_load(mtmp));

    if (otmp == uball || otmp == uchain)
        return FALSE;
    if (mtmp.mtame && otmp.cursed)
        return FALSE; /* note: will get overridden if mtmp will eat otmp */
    if (is_unicorn(mtmp.data) && objects[otmp.otyp].oc_material != GEMSTONE)
        return FALSE;
    if (!mindless(mtmp.data) && !is_animal(mtmp.data) && pctload < 75
        && searches_for_item(mtmp, otmp))
        return TRUE;
    if (likes_gold(mtmp.data) && otmp.otyp == GOLD_PIECE && pctload < 95)
        return TRUE;
    if (likes_gems(mtmp.data) && otmp.oclass == GEM_CLASS
        && objects[otmp.otyp].oc_material != MINERAL && pctload < 85)
        return TRUE;
    if (likes_objs(mtmp.data) && strchr(practical, otmp.oclass)
        && pctload < 75)
        return TRUE;
    if (likes_magic(mtmp.data) && strchr(magical, otmp.oclass)
        && pctload < 85)
        return TRUE;
    if (throws_rocks(mtmp.data) && otmp.otyp == BOULDER
        && pctload < 50 && !Sokoban())
        return TRUE;
    if (mtmp.data == mons[PM_GELATINOUS_CUBE]
        && otmp.oclass != ROCK_CLASS && otmp.oclass != BALL_CLASS
        && !(otmp.otyp == CORPSE && touch_petrifies(mons[otmp.corpsenm])))
        return TRUE;

    return FALSE;
}

/* monster mtmp would love to consume object otmp, without picking it up */
export function mon_would_consume_item(mtmp, otmp) { /* boolean */
    let ftyp;

    if (otmp.otyp == CORPSE && !touch_petrifies(mons[otmp.corpsenm])
        && corpse_eater(mtmp.data))
        return TRUE;

    if (mtmp.mtame && has_edog(mtmp) /* has_edog(): not guardian angel */
        && (ftyp = dogfood(mtmp, otmp)) < MANFOOD
        && (ftyp < ACCFOOD || EDOG(mtmp).hungrytime <= svm.moves))
        return TRUE;

    return FALSE;
}

export function itsstuck(mtmp) { /* boolean */
    if (sticks(gy.youmonst.data) && mtmp == u.ustuck && !u.uswallow) {
        pline_mon(mtmp, _("%s cannot escape from you!"), Monnam(mtmp));
        return TRUE;
    }
    return FALSE;
}

/*
 * should_displace()
 *
 * Displacement of another monster is a last resort and only
 * used on approach. If there are better ways to get to target,
 * those should be used instead. This function does that evaluation.
 */
export function should_displace(
    mtmp,
    data,
    ggx,
    ggy) { /* boolean */
    let shortest_with_displacing = -1;
    let shortest_without_displacing = -1;
    let count_without_displacing = 0;
    let i, nx, ny;
    let ndist;

    for (i = 0; i < data.cnt; i++) {
        nx = data.poss[i].x;
        ny = data.poss[i].y;
        ndist = dist2(nx, ny, ggx, ggy);
        if (MON_AT(nx, ny) && (data.info[i] & ALLOW_MDISP) && !(data.info[i] & ALLOW_M)
            && !undesirable_disp(mtmp, nx, ny)) {
            if (shortest_with_displacing == -1
                || (ndist < shortest_with_displacing))
                shortest_with_displacing = ndist;
        } else {
            if ((shortest_without_displacing == -1)
                || (ndist < shortest_without_displacing))
                shortest_without_displacing = ndist;
            count_without_displacing++;
        }
    }
    if (shortest_with_displacing > -1
        && (shortest_with_displacing < shortest_without_displacing
            || !count_without_displacing))
        return TRUE;
    return FALSE;
}

/* have monster wield a pick-axe if it wants to dig and it has one;
   return True if it spends this move wielding one, False otherwise */
export function m_digweapon_check(
    mtmp,
    nix, niy) { /* boolean */
    let can_tunnel = FALSE;
    let mw_tmp = MON_WEP(mtmp);

    if (!Is_rogue_level(u.uz))
        can_tunnel = tunnels(mtmp.data);

    if (can_tunnel && needspick(mtmp.data) && !mwelded(mw_tmp)
        && (may_dig(nix, niy) || closed_door(nix, niy))) {
        /* may_dig() is either IS_STWALL or IS_TREE */
        if (closed_door(nix, niy)) {
            if (!mw_tmp || !is_pick(mw_tmp) || !is_axe(mw_tmp))
                mtmp.weapon_check = NEED_PICK_OR_AXE;
        } else if (IS_TREE(levl()[nix][niy].typ)) {
            if (!mw_tmp || !is_axe(mw_tmp))
                mtmp.weapon_check = NEED_AXE;
        } else if (IS_STWALL(levl()[nix][niy].typ)) {
            if (!mw_tmp || !is_pick(mw_tmp))
                mtmp.weapon_check = NEED_PICK_AXE;
        }
        if (mtmp.weapon_check >= NEED_PICK_AXE && mon_wield_item(mtmp))
            return TRUE;
    }
    return FALSE;
}

/* does leprechaun want to avoid the hero? */
function leppie_avoidance(mtmp) { /* boolean */
    let lepgold, ygold;

    if (mtmp.data == mons[PM_LEPRECHAUN]
        && ((lepgold = findgold(mtmp.minvent))
            && (lepgold.quan
                > ((ygold = findgold(gi.invent)) ? ygold.quan : 0))))
        return TRUE;

    return FALSE;
}

/* unseen leprechaun with gold might stash it */
function leppie_stash(mtmp) { /* void */
    let gold;

    if (mtmp.data == mons[PM_LEPRECHAUN]
        && !DEADMONSTER(mtmp)
        && !m_canseeu(mtmp)
        && !chars[in_rooms(mtmp.mx, mtmp.my, SHOPBASE)]
        && levl()[mtmp.mx][mtmp.my].typ == ROOM
        && !t_at(mtmp.mx, mtmp.my)
        && rn2(4)
        && (gold = findgold(mtmp.minvent)) != null) {
        mdrop_obj(mtmp, gold, FALSE);
        gold = g_at(mtmp.mx, mtmp.my);
        if (gold)
            bury_an_obj(gold, 0);
    }
}

/* does monster want to avoid you?
 *  returns the original value of appr if not.
 *  returns -1 if so.
 *  returns -2 if monster wants to adhere to a particular range,
 *             which may actually be further away,
 *             and sets *pdistmin and *pdistmax to describe that range
 */
function m_balks_at_approaching(oldappr, mtmp, pdistmin,
                       pdistmax) { /* int */
    let mwep = MON_WEP(mtmp);
    let x = mtmp.mx, y = mtmp.my, ux = mtmp.mux, uy = mtmp.muy;
    let edist = dist2(x, y, ux, uy);
    let arw;

    if (pdistmin)
        pdistmin[0] = 0;
    if (pdistmax)
        pdistmax[0] = 0;

    /* peaceful, far away, or can't see you */
    if (mtmp.mpeaceful || (edist >= 5 * 5) || !m_canseeu(mtmp))
        return oldappr;

    /* has ammo+launcher */
    if (m_has_launcher_and_ammo(mtmp))
        return -1;

    /* is using a polearm and in range */
    if (MON_WEP(mtmp) && is_pole(MON_WEP(mtmp))
        && edist <= MON_POLE_DIST)
        return -1;

    /* is using a throw-and-return weapon; provide min and max preferred range
     */
    if (mwep && (arw = autoreturn_weapon(mwep)) != null) {
        if (pdistmin)
            pdistmin[0] = 2 * 2;
        if (pdistmax)
            pdistmax[0] = arw.range;
        return -2;
    }

    /* can attack from distance, and hp loss or attack not used */
    if (ranged_attk_available(mtmp)
        && ((mtmp.mhp < Math.trunc((mtmp.mhpmax+1) / 3))
            || !mtmp.mspec_used))
        return -1;

    return oldappr; /* leaves appr unchanged */
}

function holds_up_web(x, y) { /* boolean */
    let sway;

    if (!isok(x, y)
        || IS_OBSTRUCTED(levl()[x][y].typ)
        || ((levl()[x][y].typ == STAIRS || levl()[x][y].typ == LADDER)
            && (sway = stairway_at(x, y)) != null && sway.up)
        || levl()[x][y].typ == IRONBARS)
        return TRUE;

    return FALSE;
}

/* returns the number of walls in the four cardinal directions that could
   hold up a web */
function count_webbing_walls(x, y) { /* int */
    return (holds_up_web(x, y - 1) + holds_up_web(x + 1, y)
            + holds_up_web(x, y + 1) + holds_up_web(x - 1, y));
}

/* reject webs which interfere with solving Sokoban */
function soko_allow_web(mon) { /* boolean */
    let stway;

    /* for a non-Sokoban level or a solved Sokoban level, no restriction */
    if (!Sokoban())
        return TRUE;
    /* not-yet-solved Sokoban level:  allow web only when spinner can see
       the stairs up [we really want 'is in same chamber as stairs up'] */
    stway = stairway_find_dir(TRUE); /* stairs up */
    if (stway && m_cansee(mon, stway.sx, stway.sy))
        return TRUE;
    return FALSE;
}

/* monster might spin a web */
function maybe_spin_web(mtmp) { /* void */
    const $frame = stack_frame(); try {
    if (webmaker(mtmp.data)
        && !helpless(mtmp) && !mtmp.mspec_used
        && !t_at(mtmp.mx, mtmp.my) && soko_allow_web(mtmp)) {
        let trap;
        let prob = ((((mtmp.data == mons[PM_GIANT_SPIDER]) ? 15 : 5)
                     * (count_webbing_walls(mtmp.mx, mtmp.my) + 1))
                    - (3 * count_traps(WEB)));

        if (rn2(1000) < prob
            && (trap = maketrap(mtmp.mx, mtmp.my, WEB)) != null) {
            mtmp.mspec_used = d(4, 4); /* 4..16 */
            if (cansee(mtmp.mx, mtmp.my)) {
                let mbuf = stack_array(char, BUFSZ);

                strcpy(mbuf, canspotmon(mtmp) ? y_monnam(mtmp) : something());
                pline_mon(mtmp, _("%s spins a web."), upstart(mbuf));
                trap.tseen = 1;
            }
            if (chars[in_rooms(mtmp.mx, mtmp.my, SHOPBASE)])
                add_damage(mtmp.mx, mtmp.my, 0);
        }
    }
    } finally { stack_pop($frame); }
}

/* monster avoids a location nx, ny, if hero kicked that location */
export function m_avoid_kicked_loc(mtmp, nx, ny) { /* boolean */
    if ((mtmp.mpeaceful || mtmp.mtame)
        && mtmp.mcansee
        && !mtmp.mconf && !mtmp.mstun
        && !Conflict()
        && isok(gk.kickedloc.x, gk.kickedloc.y)
        && nx == gk.kickedloc.x && ny == gk.kickedloc.y
        && next2u(nx, ny))
        return TRUE;
    return FALSE;
}

/* monster avoids a location nx, ny, if we're in sokoban, and
   there's a boulder between the location and hero */
export function m_avoid_soko_push_loc(mtmp, nx, ny) { /* boolean */
    if (Sokoban()
        && (mtmp.mpeaceful || mtmp.mtame)
        && !mtmp.mconf && !mtmp.mstun
        && !Conflict()
        && (dist2(nx, ny, u.ux, u.uy) == 4)
        && sobj_at(BOULDER, nx + sgn(u.ux - nx), ny + sgn(u.uy - ny)))
        return TRUE;
    return FALSE;
}

/* max distmin() distance for monster to look for items */
export const SQSRCHRADIUS = 5;

/* monster looks for items it wants nearby */
function m_search_items(
    mtmp,
    ggx, ggy,
    mmoved,
    appr) { /* boolean */
    var minr = SQSRCHRADIUS; /* not too far away */
    var otmp;
    var xx, yy;
    var hmx, hmy, lmx, lmy;
    var ttmp;
    var omx = mtmp.mx, omy = mtmp.my;
    var ptr = mtmp.data;
    var mtoo;
    var costly;

    /* cut down the search radius if it thinks character is closer. */
    if (distmin(mtmp.mux, mtmp.muy, omx, omy) < SQSRCHRADIUS
        && !mtmp.mpeaceful)
        minr--;
    /* guards shouldn't get too distracted */
    if (!mtmp.mpeaceful && is_mercenary(ptr))
        minr = 1;

    /* in shop, usually skip */
    finish_search: { if (chars[in_rooms(omx, omy, SHOPBASE)] && (rn2(25) || mtmp.isshk))
        break finish_search;;

    /* distmin() gives a rectangular area */
    hmx = min(COLNO - 1, omx + minr);
    hmy = min(ROWNO - 1, omy + minr);
    lmx = max(1, omx - minr);
    lmy = max(0, omy - minr);

    for (xx = lmx; xx <= hmx; xx++) {
        for (yy = lmy; yy <= hmy; yy++) {
            /* no object here */
            if (!OBJ_AT(xx, yy))
                continue;
            /* found an object closer already */
            if (minr < distmin(omx, omy, xx, yy))
                continue;
            /* the mfndpos() test for whether to allow a move to a
               water location accepts flyers, but they can't reach
               underwater objects, so being able to move to a spot
               is insufficient for deciding whether to do so */
            if (!could_reach_item(mtmp, xx, yy))
                continue;
            /* hiders avoid hero's line of sight */
            if (hides_under(ptr) && cansee(xx, yy))
                continue;
            /* don't get stuck circling around object that's
               underneath an immobile or hidden monster;
               paralysis victims excluded */
            if ((mtoo = m_at(xx, yy)) != null
                && (helpless(mtoo) || mtoo.mundetected
                    || (mtoo.mappearance && !mtoo.iswiz)
                    || !mtoo.data.mmove))
                continue;
            /* Don't get stuck circling an Elbereth */
            if (onscary(xx, yy, mtmp))
                continue;
            /* ignore obj if there's a trap and monster knows it */
            if ((ttmp = t_at(xx, yy)) != null
                && mon_knows_traps(mtmp, ttmp.ttyp)) {
                if (ggx[0] == xx && ggy[0] == yy) {
                    ggx[0] = mtmp.mux;
                    ggy[0] = mtmp.muy;
                }
                continue;
            }
            /* avoid getting stuck on eg. items in niches */
            if (!m_cansee(mtmp, xx, yy))
                continue;

            costly = costly_spot(xx, yy);

            /* look through the items on this location */
            for (otmp = svl.level.objects[xx][yy];
                 otmp; otmp = otmp.v.v_nexthere) {
                /* monsters may pick rocks up, but won't go out of their way
                   to grab them; this might hamper sling wielders, but it cuts
                   down on move overhead by filtering out most common item */
                if (otmp.otyp == ROCK)
                    continue;
                /* avoid special items; once hero picks them up, they'll
                   cease being special */
                if (is_mines_prize(otmp) || is_soko_prize(otmp))
                    continue;
                /* skip shop merchandise */
                if (costly && !otmp.no_charge)
                    continue;

                if (((mon_would_take_item(mtmp, otmp)
                      && (can_carry(mtmp, otmp) > 0))
                     || mon_would_consume_item(mtmp, otmp))
                    && can_touch_safely(mtmp, otmp)) {
                    minr = distmin(omx, omy, xx, yy);
                    ggx[0] = otmp.ox;
                    ggy[0] = otmp.oy;
                    if (ggx[0] == omx && ggy[0] == omy) {
                        mmoved[0] = MMOVE_DONE; /* actually unnecessary */
                        return TRUE;
                    }
                    /* found an item of interest; skip the rest of the pile */
                    break;
                }
            }
        }
    }
 }
    if (minr < SQSRCHRADIUS && appr[0] == -1) {
        if (distmin(omx, omy, mtmp.mux, mtmp.muy) <= 3) {
            ggx[0] = mtmp.mux;
            ggy[0] = mtmp.muy;
        } else
            appr[0] = 1;
    }
    return FALSE;
}

function postmov(
    mtmp,
    ptr,
    omx, omy,
    mmoved,
    seenflgs,
    can_tunnel,
    can_unlock,
    can_open) { /* int */
    let nix, niy;
    let etmp, trapret;
    let canseeit = cansee(mtmp.mx, mtmp.my),
            didseeit = canseeit;

    notice_mon(mtmp);

    if (mmoved == MMOVE_MOVED) {
        nix = mtmp.mx, niy = mtmp.my;
        /* sequencing issue:  when monster movement decides that a
           monster can move to a door location, it moves the monster
           there before dealing with the door rather than after;
           so a vampire/bat that is going to shift to fog cloud and
           pass under the door is already there but transformation
           into fog form--and its message, when in sight--has not
           happened yet; we have to move monster back to previous
           location before performing the vamp_shift() to make the
           message happen at right time, then back to the door again
           [if we did the shift sooner, before moving the monster,
           we would need to duplicate it in dog_move()...] */
        if (is_vampshifter(mtmp) && !amorphous(mtmp.data)
            && IS_DOOR(levl()[nix][niy].typ)
            && ((levl()[nix][niy].flags & (D_LOCKED | D_CLOSED)) != 0)
            && can_fog(mtmp)) {
            /* note: remove_monster()+place_monster is not right for
               long worms but they won't reach here */
            if (seenflgs) {
                remove_monster(nix, niy);
                place_monster(mtmp, omx, omy);
                newsym(nix, niy), newsym(omx, omy);
            }
            if (vamp_shift(mtmp, mons[PM_FOG_CLOUD],
                           ((seenflgs & 1) != 0) ? TRUE : FALSE)) {
                ptr = mtmp.data; /* update cached value */
                (ptr);
            }
            if (seenflgs) {
                remove_monster(omx, omy);
                place_monster(mtmp, nix, niy);
                newsym(omx, omy), newsym(nix, niy);
            }
        }

        newsym(omx, omy); /* update the old position */
        trapret = mintrap(mtmp, NO_TRAP_FLAGS);
        if (trapret == Trap_Killed_Mon || trapret == Trap_Moved_Mon) {
            if (mtmp.mx)
                newsym(mtmp.mx, mtmp.my);
            return MMOVE_DIED; /* it died */
        } else if (mon_offmap(mtmp)) {
            return MMOVE_DONE;
        }
        ptr = mtmp.data; /* in case mintrap() caused polymorph */

        /* open a door, or crash through it, if 'mtmp' can */
        if (IS_DOOR(levl()[mtmp.mx][mtmp.my].typ)
            && !passes_walls(ptr) /* doesn't need to open doors */
            && !can_tunnel) {     /* taken care of below */
            let here = levl()[mtmp.mx][mtmp.my];
            let btrapped = +((here.flags & D_TRAPPED) != 0);

    /* used after monster 'who' has been moved to closed door spot 'where'
       which will now be changed to door state 'what' with map update */

            /* if mon has MKoT, disarm door trap; no message given */
            if (btrapped && has_magic_key(mtmp)) {
                /* BUG: this lets a vampire or blob or a doorbuster
                   holding the Key disarm the trap even though it isn't
                   using that Key when squeezing under or smashing the
                   door.  Not significant enough to worry about; perhaps
                   the Key's magic is more powerful for monsters? */
                here.flags &= ~D_TRAPPED;
                btrapped = FALSE;
            }
            if ((here.flags & (D_LOCKED | D_CLOSED)) != 0
                && amorphous(ptr)) {
                if (flags.verbose && canseemon(mtmp))
                    pline_mon(mtmp, _("%s %s under the door."), YMonnam(mtmp),
                              (ptr == mons[PM_FOG_CLOUD]
                               || ptr.mlet == S_LIGHT) ? _("flows") : _("oozes"));
            } else if ((here.flags & D_LOCKED) != 0 && can_unlock) {
                /* like the vampshift hack, there are sequencing
                   issues when the monster is moved to the door's spot
                   first then door handling plus feedback comes after */

                do { (here).flags = (!btrapped ? D_ISOPEN : D_NODOOR); newsym((mtmp).mx, (mtmp).my); recalc_block_point((mtmp).mx, (mtmp).my); vision_recalc(0); canseeit = ((didseeit || cansee((mtmp).mx, (mtmp).my)) ? 1 : 0); } while (0);
                if (btrapped) {
                    if (mb_trapped(mtmp, canseeit))
                        return MMOVE_DIED;
                } else {
                     ;
                    if (flags.verbose) {
                        if (canseeit && canspotmon(mtmp)) {
                            pline_mon(mtmp, _("%s unlocks and opens a door."),
                                  Monnam(mtmp));
                        } else if (canseeit) {
                            You_see(_("a door unlock and open."));
                        } else if (!Deaf()) {
                            You_hear(_("a door unlock and open."));
                        }
                    }
                }
            } else if (here.flags == D_CLOSED && can_open) {
                do { (here).flags = (!btrapped ? D_ISOPEN : D_NODOOR); newsym((mtmp).mx, (mtmp).my); recalc_block_point((mtmp).mx, (mtmp).my); vision_recalc(0); canseeit = ((didseeit || cansee((mtmp).mx, (mtmp).my)) ? 1 : 0); } while (0);
                if (btrapped) {
                    if (mb_trapped(mtmp, canseeit))
                        return MMOVE_DIED;
                } else {
                     ;
                    if (flags.verbose) {
                        if (canseeit && canspotmon(mtmp)) {
                            pline_mon(mtmp, _("%s opens a door."), Monnam(mtmp));
                        } else if (canseeit) {
                            You_see(_("a door open."));
                        } else if (!Deaf()) {
                            You_hear(_("a door open."));
                        }
                    }
                }
            } else if ((here.flags & (D_LOCKED | D_CLOSED)) != 0) {
                /* mfndpos guarantees this must be a doorbuster */
                let mask;

                mask = ((btrapped
                         || ((here.flags & D_LOCKED) != 0 && !rn2(2)))
                        ? D_NODOOR
                        : D_BROKEN);
                do { (here).flags = (mask); newsym((mtmp).mx, (mtmp).my); recalc_block_point((mtmp).mx, (mtmp).my); vision_recalc(0); canseeit = ((didseeit || cansee((mtmp).mx, (mtmp).my)) ? 1 : 0); } while (0);
                if (btrapped) {
                    if (mb_trapped(mtmp, canseeit))
                        return MMOVE_DIED;
                } else {
                     ;
                    if (flags.verbose) {
                        if (canseeit && canspotmon(mtmp)) {
                            pline_mon(mtmp, _("%s smashes down a door."),
                                      Monnam(mtmp));
                        } else if (canseeit) {
                            You_see(_("a door crash open."));
                        } else if (!Deaf()) {
                            You_hear(_("a door crash open."));
                        }
                    }
                }
                /* if it's a shop door, schedule repair */
                if (chars[in_rooms(mtmp.mx, mtmp.my, SHOPBASE)])
                    add_damage(mtmp.mx, mtmp.my, 0);
            }
        } else if (levl()[mtmp.mx][mtmp.my].typ == IRONBARS) {
            /* 3.6.2: was using may_dig() but that doesn't handle bars;
               AD_RUST catches rust monsters but metallivorous() is
                   needed for xorns and rock moles */
            if (!(levl()[mtmp.mx][mtmp.my].flags & W_NONDIGGABLE)
                && (dmgtype(ptr, AD_RUST) || dmgtype(ptr, AD_CORR)
                    || metallivorous(ptr))) {
                if (canseemon(mtmp))
                    pline_mon(mtmp, _("%s eats through the iron bars."),
                              Monnam(mtmp));
                dissolve_bars(mtmp.mx, mtmp.my);
                return MMOVE_DONE;
            } else if (flags.verbose && canseemon(mtmp))
                Norep(_("%s %s %s the iron bars."), Monnam(mtmp),
                      /* pluralization fakes verb conjugation */
                      makeplural(locomotion(ptr, _("pass"))),
                      passes_walls(ptr) ? _("through") : _("between"));
        } /* doors and bars */

        /* possibly dig */
        if (can_tunnel && may_dig(mtmp.mx, mtmp.my)
            && mdig_tunnel(mtmp))
            return MMOVE_DIED; /* mon died (position already updated) */

        /* set also in domove(), hack.c */
        if (engulfing_u(mtmp) && (mtmp.mx != omx || mtmp.my != omy)) {
            /* If the monster moved, then update */
            u.ux0 = u.ux;
            u.uy0 = u.uy;
            u_on_newpos(mtmp.mx, mtmp.my);
            swallowed(0);
        } else {
            newsym(mtmp.mx, mtmp.my);
        }
    } /* mmoved==MMOVE_MOVED */

    if (mmoved == MMOVE_MOVED || mmoved == MMOVE_DONE) {
        if (OBJ_AT(mtmp.mx, mtmp.my) && mtmp.mcanmove) {
            /* Maybe a rock mole just ate some metal object */
            if (metallivorous(ptr)) {
                if (meatmetal(mtmp) == 2)
                    return MMOVE_DIED; /* it died */
            }

            /* Maybe a cube ate just about anything */
            if (ptr == mons[PM_GELATINOUS_CUBE]) {
                if ((etmp = meatobj(mtmp)) >= 2)
                    return etmp; /* it died or got forced off the level */
            }
            /* Maybe a purple worm ate a corpse */
            if (corpse_eater(ptr)) {
                if ((etmp = meatcorpse(mtmp)) >= 2)
                    return etmp; /* it died or got forced off the level */
            }

            if (mpickstuff(mtmp))
                mmoved = MMOVE_DONE;

            if (mtmp.minvis) {
                newsym(mtmp.mx, mtmp.my);
                if (mtmp.wormno)
                    see_wsegs(mtmp);
            }
        }

        maybe_spin_web(mtmp);

        if (hides_under(ptr) || ptr.mlet == S_EEL) {
            /* Always set--or reset--mundetected if it's already hidden
               (just in case the object it was hiding under went away);
               usually set mundetected unless monster can't move. */
            if (mtmp.mundetected || (!helpless(mtmp) && rn2(5)))
                hideunder(mtmp);
            newsym(mtmp.mx, mtmp.my);
        }
        if (mtmp.isshk) {
            after_shk_move(mtmp);
        }
    }
    return mmoved;
}

/* Handles the movement of a standard monster.
 * Return values:
 * 0: did not move, but can still attack and do other stuff;
 * 1: moved, possibly can attack;
 * 2: monster died;
 * 3: did not move, and can't do anything else either.
 */
export function m_move(mtmp, after) { /* int */
    const $frame = stack_frame(); try {
    var appr = stack_var(int);
    var ggx = stack_var(coordxy), ggy = stack_var(coordxy), nix, niy;
    var chcnt;
    var can_tunnel = 0;
    var can_open = 0, can_unlock = 0;
    var getitems = FALSE;
    var avoid = FALSE;
    var better_with_displacing = FALSE;
    var seenflgs;
    var ptr;
    var chi, mmoved = stack_var(int, MMOVE_NOTHING),
        preferredrange_min = stack_var(int, 0), preferredrange_max = stack_var(int, 0);
    var mfp = stack_struct(struct_mfndposdata);
    var flag;
    var omx = mtmp.mx, omy = mtmp.my;

    if (mtmp.mtrapped) {
        var i = mintrap(mtmp, NO_TRAP_FLAGS);

        if (i == Trap_Killed_Mon) {
            newsym(mtmp.mx, mtmp.my);
            return MMOVE_DIED;
        } /* it died */
        if (i == Trap_Caught_Mon)
            return MMOVE_NOTHING; /* still in trap, so didn't move */
    }
    ptr = mtmp.data; /* mintrap() can change mtmp->data -dlc */

    if (mtmp.meating) {
        mtmp.meating--;
        if (mtmp.meating <= 0)
            finish_meating(mtmp);
        return MMOVE_DONE; /* still eating */
    }
    if (hides_under(ptr) && OBJ_AT(mtmp.mx, mtmp.my)
        && can_hide_under_obj(svl.level.objects[mtmp.mx][mtmp.my])
        && rn2(10))
        return MMOVE_NOTHING; /* do not leave hiding place */

    /* set up pre-move visibility flags */
    seenflgs = (canseemon(mtmp) ? 1 : 0) | (canspotmon(mtmp) ? 2 : 0);

    /* Where does 'mtmp' think you are?  Not necessary if m_move() called
       from this file, but needed for other calls of m_move(). */
    set_apparxy(mtmp); /* set mtmp->mux, mtmp->muy */

    if (!Is_rogue_level(u.uz))
        can_tunnel = tunnels(ptr);
    can_open = +!(nohands(ptr) || verysmall(ptr));
    can_unlock = ((can_open && monhaskey(mtmp, TRUE))
                  || mtmp.iswiz || is_rider(ptr) ? 1 : 0);
    /* doorbuster = is_giant(ptr); */
    not_special: { if (mtmp.wormno)
        break not_special;;
    /* my dog gets special treatment */
    if (mtmp.mtame) {
        return postmov(mtmp, ptr, omx, omy, dog_move(mtmp, after),
                       seenflgs, can_tunnel, can_unlock, can_open);
    }

    /* and the acquisitive monsters get special treatment */
    if (is_covetous(ptr)) { /* [should this include
                             *  '&& mtmp->mstrategy != STRAT_NONE'?] */
        var covetousattack;
        var tx = mtmp.mgoal.x,
                ty = mtmp.mgoal.y;
        var intruder = isok(tx, ty) ? m_at(tx, ty) : null;
        /*
         * if there's a monster on the object or in possession of it,
         * attack it.
         */
        if (intruder && intruder != mtmp
            /* 5.0: this used to use 'dist2() < 2' which meant that intended
               attack was disallowed if they were adjacent diagonally */
            && dist2(mtmp.mx, mtmp.my, tx, ty) <= 2) {
            gb.bhitpos.x = tx, gb.bhitpos.y = ty;
            gn.notonhead = +(intruder.mx != tx || intruder.my != ty);
            covetousattack = mattackm(mtmp, intruder);
            /* 5.0: this used to erroneously use '== 2' (M_ATTK_DEF_DIED) */
            if (covetousattack & M_ATTK_AGR_DIED)
                return MMOVE_DIED;
            mmoved[0] = MMOVE_MOVED;
            return postmov(mtmp, ptr, omx, omy, mmoved[0],
                           seenflgs, can_tunnel, can_unlock, can_open);
        }
        /* otherwise continue with normal AI routine */
    }

    /* likewise for shopkeeper, guard, or priest */
    if (mtmp.isshk || mtmp.isgd || mtmp.ispriest) {
        var xm = mtmp.isshk ? shk_move(mtmp)
                 : mtmp.isgd ? gd_move(mtmp)
                   : pri_move(mtmp);

        switch (xm) {
        case -2:
            return MMOVE_DIED;
        case -1:
            mmoved[0] = MMOVE_NOTHING; /* shk follow hero outside shop */
            break;
        default:
            impossible(_("unknown shk/gd/pri_move return value (%d)"), xm);
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 0:
        case 1:
            return postmov(mtmp, ptr, omx, omy,
                           (xm != 1) ? MMOVE_NOTHING : MMOVE_MOVED,
                           seenflgs, can_tunnel, can_unlock, can_open);
        }
    }

    if (ptr == mons[PM_MAIL_DAEMON]) {
        if (!Deaf() && canseemon(mtmp)) {
               ;
            verbalize(_("I'm late!"));
        }
        mongone(mtmp);
        return MMOVE_DIED;
    }

    /* teleport if that lies in our nature */
    if (ptr == mons[PM_TENGU] && !rn2(5) && !mtmp.mcan
        && !tele_restrict(mtmp)) {
        if (mtmp.mhp < 7 || mtmp.mpeaceful || rn2(2))
            rloc(mtmp, RLOC_MSG);
        else
            mnexto(mtmp, RLOC_MSG);
        return postmov(mtmp, ptr, omx, omy, MMOVE_MOVED,
                       seenflgs, can_tunnel, can_unlock, can_open);
    }
 }
    if (u.uswallow && !mtmp.mflee && u.ustuck != mtmp)
        return MMOVE_MOVED;
    omx = mtmp.mx;
    omy = mtmp.my;
    ggx[0] = mtmp.mux;
    ggy[0] = mtmp.muy;
    appr[0] = mtmp.mflee ? -1 : 1;
    if (mtmp.mconf || engulfing_u(mtmp)) {
        appr[0] = 0;
    } else {
        var should_see = (couldsee(omx, omy)
                              && (levl()[ggx[0]][ggy[0]].lit || !levl()[omx][omy].lit)
                              && (dist2(omx, omy, ggx[0], ggy[0]) <= 36) ? 1 : 0);

        if (!mtmp.mcansee
            || (should_see && Invis() && !perceives(ptr) && rn2(11))
            || is_obj_mappear(gy.youmonst, STRANGE_OBJECT) || u.uundetected
            || (is_obj_mappear(gy.youmonst, GOLD_PIECE) && !likes_gold(ptr))
            || (mtmp.mpeaceful && !mtmp.isshk) /* allow shks to follow */
            || ((monsndx(ptr) == PM_STALKER || ptr.mlet == S_BAT
                 || ptr.mlet == S_LIGHT) && !rn2(3)))
            appr[0] = 0;

        if (appr[0] == 1 && leppie_avoidance(mtmp))
            appr[0] = -1;

        /* hostiles with ranged weapon or attack try to stay away */
        appr[0] = m_balks_at_approaching(appr[0], mtmp, preferredrange_min, preferredrange_max);

        if (!should_see && can_track(ptr)) {
            var cp;

            cp = gettrack(omx, omy);
            if (cp) {
                ggx[0] = cp.x;
                ggy[0] = cp.y;
            }
        }
    }

    if ((!mtmp.mpeaceful || !rn2(10)) && (!Is_rogue_level(u.uz))) {
        var in_line = (lined_up(mtmp)
             && (distmin(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy)
                 <= (throws_rocks(gy.youmonst.data) ? 20
                                                    : (Math.trunc(ACURRSTR() / 2) + 1))) ? 1 : 0);

        if (appr[0] != 1 || !in_line) {
            /* Monsters in combat won't pick stuff up, avoiding the
             * situation where you toss arrows at it and it has nothing
             * better to do than pick the arrows up.
             */
            getitems = TRUE;
        }
    }

    if (getitems && m_search_items(mtmp, ggx, ggy, mmoved, appr))
        return postmov(mtmp, ptr, omx, omy, mmoved[0],
                       seenflgs, can_tunnel, can_unlock, can_open);

    /* don't tunnel if hostile and close enough to prefer a weapon */
    if (can_tunnel && needspick(ptr)
        && ((!mtmp.mpeaceful || Conflict())
            && dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy) <= 8))
        can_tunnel = FALSE;

    nix = omx;
    niy = omy;
    flag = mon_allowflags(mtmp);
    {
        var i, j, nx, ny, nearer;
        var jcnt, cnt;
        var ndist, nidist;
        var mtrk;

        cnt = mfndpos(mtmp, mfp, flag);
        if (cnt == 0 && !is_unicorn(mtmp.data)) {
            if (find_defensive(mtmp, TRUE) && use_defensive(mtmp))
                return MMOVE_DONE;
            return MMOVE_NOMOVES;
        }
        chcnt = 0;
        jcnt = min(MTSZ, cnt - 1);
        chi = -1;
        nidist = dist2(nix, niy, ggx[0], ggy[0]);
        /* allow monsters be shortsighted on some levels for balance */
        if (!mtmp.mpeaceful && svl.level.flags.shortsighted
            && nidist > (couldsee(nix, niy) ? 144 : 36) && appr[0] == 1)
            appr[0] = 0;
        if (is_unicorn(ptr) && noteleport_level(mtmp)) {
            /* on noteleport levels, perhaps we cannot avoid hero */
            for (i = 0; i < cnt; i++)
                if (!(mfp.info[i] & NOTONL))
                    avoid = TRUE;
        }
        better_with_displacing =
            should_displace(mtmp, mfp, ggx[0], ggy[0]);
        for (i = 0; i < cnt; i++) {
            if (avoid && (mfp.info[i] & NOTONL))
                continue;
            nx = mfp.poss[i].x;
            ny = mfp.poss[i].y;

            if (m_avoid_kicked_loc(mtmp, nx, ny))
                continue;

            if (MON_AT(nx, ny) && (mfp.info[i] & ALLOW_MDISP)
                && !(mfp.info[i] & ALLOW_M) && !better_with_displacing)
                continue;
            nxti: { if (appr[0] != 0) {
                mtrk = ptr_add(mtmp.mtrack[0], 0);
                for (j = 0; j < jcnt; mtrk = ptr_add(mtrk, 1), j++)
                    if (nx == mtrk.x && ny == mtrk.y)
                        if (rn2(4 * (cnt - j)))
                            break nxti;;
            }

            nearer = +((ndist = dist2(nx, ny, ggx[0], ggy[0])) < nidist);

            if ((appr[0] == 1 && nearer) || (appr[0] == -1 && !nearer)
                || (!appr[0] && !rn2(++chcnt))
                || (appr[0] == -2
                    && ((ndist <= preferredrange_min[0] && !nearer)
                        || (ndist >= preferredrange_max[0] && nearer)))
                || (mmoved[0] == MMOVE_NOTHING)) {
                nix = nx;
                niy = ny;
                nidist = ndist;
                chi = i;
                mmoved[0] = MMOVE_MOVED;
            }
 }
            ;
        }
    }

    if (mmoved[0] != MMOVE_NOTHING) {
        if (mmoved[0] == MMOVE_MOVED && !u_at(nix, niy) && itsstuck(mtmp))
            return MMOVE_DONE;

        if (mmoved[0] == MMOVE_MOVED && m_digweapon_check(mtmp, nix, niy))
            return MMOVE_DONE;

        /* If ALLOW_U is set, either it's trying to attack you, or it
         * thinks it is.  In either case, attack this spot in preference to
         * all others.
         */
        /* Actually, this whole section of code doesn't work as you'd expect.
         * Most attacks are handled in dochug().  It calls distfleeck(), which
         * among other things sets nearby if the monster is near you--and if
         * nearby is set, we never call m_move unless it is a special case
         * (confused, stun, etc.)  The effect is that this ALLOW_U (and
         * mfndpos) has no effect for normal attacks, though it lets a
         * confused monster attack you by accident.
         */
        assert(IndexOk(chi, mfp.info));
        if (mfp.info[chi] & ALLOW_U) {
            nix = mtmp.mux;
            niy = mtmp.muy;
        }
        if (u_at(nix, niy)) {
            mtmp.mux = u.ux;
            mtmp.muy = u.uy;
            return MMOVE_NOTHING;
        }
        /* The monster may attack another based on 1 of 2 conditions:
         * 1 - It may be confused.
         * 2 - It may mistake the monster for your (displaced) image.
         * Pets get taken care of above and shouldn't reach this code.
         * Conflict gets handled even farther away (movemon()).
         */
        if ((mfp.info[chi] & ALLOW_M) != 0
            || (nix == mtmp.mux && niy == mtmp.muy))
            return m_move_aggress(mtmp, nix, niy);

        if ((mfp.info[chi] & ALLOW_MDISP) != 0) {
            var mtmp2;
            var mstatus;

            mtmp2 = m_at(nix, niy); /* ALLOW_MDISP implies m_at() is !Null */
            mstatus = mdisplacem(mtmp, mtmp2, FALSE);
            /*[if either dies, this reports mtmp has died; is that correct?]*/
            if (mstatus & (M_ATTK_AGR_DIED | M_ATTK_DEF_DIED))
                return MMOVE_DIED;
            if (mstatus & M_ATTK_HIT)
                return MMOVE_MOVED;
            return MMOVE_DONE;
        }

        if (!m_in_out_region(mtmp, nix, niy))
            return MMOVE_DONE;

        if ((mfp.info[chi] & ALLOW_ROCK) && m_can_break_boulder(mtmp)) {
            m_break_boulder(mtmp, nix, niy);
            return MMOVE_DONE;
        }

        m_postmove_effect(mtmp);

        /* move a normal monster; for a long worm, remove_monster() and
           place_monster() only manipulate the head; they leave tail as-is */
        remove_monster(omx, omy);
        place_monster(mtmp, nix, niy);
        msg_mon_movement(mtmp, omx, omy);
        /* for a long worm, insert a new segment to reconnect the head
           with the tail; worm_move() keeps the end of the tail if worm
           is scheduled to grow, removes that for move-without-growing */
        if (mtmp.wormno)
            worm_move(mtmp);

        maybe_unhide_at(mtmp.mx, mtmp.my);

        mon_track_add(mtmp, omx, omy);
    } else {
        if (is_unicorn(ptr) && rn2(2) && !tele_restrict(mtmp)) {
            rloc(mtmp, RLOC_MSG);
            return MMOVE_MOVED;
        }
        /* for a long worm, shrink it (by discarding end of tail) when
           it has failed to move */
        if (mtmp.wormno)
            worm_nomove(mtmp);
    }
    return postmov(mtmp, ptr, omx, omy, mmoved[0],
                   seenflgs, can_tunnel, can_unlock, can_open);
    } finally { stack_pop($frame); }
}

/* The part of m_move that deals with a monster attacking another monster (and
 * that monster possibly retaliating).
 * Extracted into its own function so that it can be called with monsters that
 * have special move patterns (shopkeepers, priests, etc) that want to attack
 * other monsters but aren't just roaming freely around the level (so allowing
 * m_move to run fully for them could select an invalid move).
 * x and y are the coordinates mtmp wants to attack.
 * Return values are the same as for m_move, but this function only return 2
 * (mtmp died) or 3 (mtmp made its move).
 */
export function m_move_aggress(mtmp, x, y) { /* int */
    let mtmp2;
    let mstatus = 0; /* M_ATTK_MISS */

    mtmp2 = m_at(x, y);
    if (mtmp2) {
        gb.bhitpos.x = x, gb.bhitpos.y = y;
        gn.notonhead = +(x != mtmp2.mx || y != mtmp2.my);
        mstatus = mattackm(mtmp, mtmp2);
    }

    if ((mstatus & M_ATTK_AGR_DIED) || DEADMONSTER(mtmp)) /* aggressor died */
        return MMOVE_DIED;

    if ((mstatus & (M_ATTK_HIT | M_ATTK_DEF_DIED)) == M_ATTK_HIT
        && rn2(4) && mtmp2.movement > rn2(NORMAL_SPEED)) {
        if (mtmp2.movement > NORMAL_SPEED)
            mtmp2.movement -= NORMAL_SPEED;
        else
            mtmp2.movement = 0;
        gb.bhitpos.x = mtmp.mx, gb.bhitpos.y = mtmp.my;
        gn.notonhead = FALSE;
        mstatus = mattackm(mtmp2, mtmp); /* return attack */
        /* note: at this point, defender is the original (moving) aggressor */
        if (mstatus & M_ATTK_DEF_DIED)
            return MMOVE_DIED;
    }
    return MMOVE_DONE;
}

/* returns TRUE if a mon can hide under the obj */
export function can_hide_under_obj(obj) { /* boolean */
/* uncomment '#define NO_HIDING_UNDER_STATUES' to prevent hiding under
 * statues; that was introduced to avoid nullifying statue traps but
 * isn't needed now that hiding at any non-pit trap site is disallowed */
/* #define NO_HIDING_UNDER_STATUES */
    let t;

    if (!obj || obj.where != OBJ_FLOOR)
        return FALSE;
    /* can't hide in/on/under traps (except pits) even when there is an
       object here; since obj is on floor, its <ox,oy> are up to date */
    if ((t = t_at(obj.ox, obj.oy)) != null && !is_pit(t.ttyp))
        return FALSE;
    /* can't hide under small amount of coins unless non-coins are also
       present; we expect coins to be a single stack but don't assume that */
    if (obj.oclass == COIN_CLASS) {
        let coinquan = 0;

        do {
            /* 10 coins is arbitrary amount considered enough to hide under */
            if ((coinquan += obj.quan) >= 10)
                break; /* fall through to other checks */
            obj = obj.v.v_nexthere;
            if (!obj)
                return FALSE; /* whole pile was less than 10 coins */
        } while (obj.oclass == COIN_CLASS);
    }
    /* #ifdef NO_HIDING_UNDER_STATUES: not in this build */

    return TRUE; /* can hide under the object */
}

export function dissolve_bars(x, y) { /* void */
    levl()[x][y].typ = (levl()[x][y].edge == 1) ? DOOR
        : (Is_special(u.uz) || chars[in_rooms(x, y, 0)]) ? ROOM : CORR;
    levl()[x][y].flags = 0; /* doormask = D_NODOOR */
    newsym(x, y);
    if (u_at(x, y))
        switch_terrain();
}

export function closed_door(x, y) { /* boolean */
    return (IS_DOOR(levl()[x][y].typ)
                      && (levl()[x][y].flags & (D_LOCKED | D_CLOSED)) ? 1 : 0);
}

export function accessible(x, y) { /* boolean */
    /* use underlying terrain in front of closed drawbridge */
    let levtyp = SURFACE_AT(x, y);

    return (+(ACCESSIBLE(levtyp) && !closed_door(x, y)));
}

/* decide where the monster thinks you are standing */
export function set_apparxy(mtmp) { /* void */
    let notseen, notthere, gotu;
    let displ;
    let mx = mtmp.mux, my = mtmp.muy;
    let umoney = money_cnt(gi.invent);

    /*
     * do cheapest and/or most likely tests first
     */

    /* pet knows your smell; grabber still has hold of you; monsters which
       know where you are don't suddenly forget, if you haven't moved away */
    if (mtmp.mtame || mtmp == u.ustuck || u_at(mx, my)) {
            mtmp.mux = u.ux;
            mtmp.muy = u.uy;
            return;
    }

    notseen = (!mtmp.mcansee || (Invis() && !perceives(mtmp.data)) ? 1 : 0);
    notthere = (Displaced() && mtmp.data != mons[PM_DISPLACER_BEAST] ? 1 : 0);
    /* add cases as required.  eg. Displacement ... */
    if (Underwater()) {
        displ = 1;
    } else if (notseen) {
        /* Xorns can smell quantities of valuable metal
           like that in solid gold coins, treat as seen */
        displ = (mtmp.data == mons[PM_XORN] && umoney) ? 0 : 1;
    } else if (notthere) {
        displ = couldsee(mx, my) ? 2 : 1;
    } else {
        displ = 0;
    }
    if (!displ) {
        mtmp.mux = u.ux;
        mtmp.muy = u.uy;
        return;
    }

    /* without something like the following, invisibility and displacement
       are too powerful */
    gotu = notseen ? +!rn2(3) : notthere ? +!rn2(4) : FALSE;

    if (!gotu) {
        let try_cnt = 0;

        do {
            if (++try_cnt > 200) {
                mx = u.ux;
                my = u.uy;
                break; /* punt */
            }
            mx = u.ux - displ + rn2(2 * displ + 1);
            my = u.uy - displ + rn2(2 * displ + 1);
        } while (!isok(mx, my)
                 || (displ != 2 && mx == mtmp.mx && my == mtmp.my)
                 || ((mx != u.ux || my != u.uy) && !passes_walls(mtmp.data)
                     && !(accessible(mx, my)
                          || (closed_door(mx, my)
                              && (can_ooze(mtmp) || can_fog(mtmp)))))
                 || !couldsee(mx, my));
    } else {
        mx = u.ux;
        my = u.uy;
    }

    mtmp.mux = mx;
    mtmp.muy = my;
}

/*
 * mon-to-mon displacement is a deliberate "get out of my way" act,
 * not an accidental bump, so we don't consider mstun or mconf in
 * undesired_disp().
 *
 * We do consider many other things about the target and its
 * location however.
 */
export function undesirable_disp(
    mtmp,
    x,
    y) { /* boolean */ /* spot 'mtmp' is considering moving to */
    let is_pet = (mtmp.mtame && !mtmp.isminion ? 1 : 0);
    let trap = t_at(x, y);

    if (is_pet) {
        /* Pets avoid a trap if you've seen it usually. */
        if (trap && trap.tseen && rn2(40))
            return TRUE;
        /* Pets avoid cursed locations */
        if (cursed_object_at(x, y))
            return TRUE;

    /* Monsters avoid a trap if they've seen that type before */
    } else if (trap && rn2(40)
               && mon_knows_traps(mtmp, trap.ttyp)) {
        return TRUE;
    }

    /* oversimplification:  creatures that bargethrough can't swap places
       when target monster is in rock or closed door or water (in particular,
       avoid moving to spots where mondied() won't leave a corpse; doesn't
       matter whether barger is capable of moving to such a target spot if
       it were unoccupied) */
    if (!accessible(x, y)
        /* mondied() allows is_pool() as an exception to !accessible(),
           but we'll only do that if 'mtmp' is already at a water location
           so that we don't swap a water critter onto land */
        && !(is_pool(x, y) && is_pool(mtmp.mx, mtmp.my)))
        return TRUE;

    return FALSE;
}

/*
 * Inventory prevents passage under door.
 * Used by can_ooze() and can_fog().
 */
function stuff_prevents_passage(mtmp) { /* boolean */
    let chain, obj;

    if (mtmp == gy.youmonst) {
        chain = gi.invent;
    } else {
        chain = mtmp.minvent;
    }
    for (obj = chain; obj; obj = obj.nobj) {
        let typ = obj.otyp;

        if (typ == COIN_CLASS && obj.quan > 100)
            return TRUE;
        if (obj.oclass != GEM_CLASS && !(typ >= ARROW && typ <= BOOMERANG)
            && !(typ >= DAGGER && typ <= CRYSKNIFE) && typ != SLING
            && !is_cloak(obj) && typ != FEDORA && !is_gloves(obj)
            && typ != LEATHER_JACKET && typ != CREDIT_CARD && !is_shirt(obj)
            && !(typ == CORPSE && verysmall(mons[obj.corpsenm]))
            && typ != FORTUNE_COOKIE && typ != CANDY_BAR && typ != PANCAKE
            && typ != LEMBAS_WAFER && typ != LUMP_OF_ROYAL_JELLY
            && obj.oclass != AMULET_CLASS && obj.oclass != RING_CLASS
            && obj.oclass != VENOM_CLASS && typ != SACK
            && typ != BAG_OF_HOLDING && typ != BAG_OF_TRICKS
            && !Is_candle(obj) && typ != OILSKIN_SACK && typ != LEASH
            && typ != STETHOSCOPE && typ != BLINDFOLD && typ != TOWEL
            && typ != TIN_WHISTLE && typ != MAGIC_WHISTLE
            && typ != MAGIC_MARKER && typ != TIN_OPENER && typ != SKELETON_KEY
            && typ != LOCK_PICK)
            return TRUE;
        if (Is_container(obj) && obj.cobj)
            return TRUE;
    }
    return FALSE;
}

export function can_ooze(mtmp) { /* boolean */
    if (!amorphous(mtmp.data) || stuff_prevents_passage(mtmp))
        return FALSE;
    return TRUE;
}

/* monster can change form into a fog if necessary */
export function can_fog(mtmp) { /* boolean */
    if (!(svm.mvitals[PM_FOG_CLOUD].mvflags & G_GENOD) && is_vampshifter(mtmp)
        && !Protection_from_shape_changers() && !stuff_prevents_passage(mtmp))
        return TRUE;
    return FALSE;
}

/* this is called when a vampire turns into a fog cloud in order to move
   under a closed door; if it was sensed via telepathy or seen via
   infravision, its new fog cloud shape will disappear */
function vamp_shift(
    mon,
    ptr,
    domsg) { /* int */
    let reslt = 0;

    if (mon.data == ptr) {
        /* already right shape */
        reslt = 1;
    } else if (is_vampshifter(mon)) {
        reslt = newcham(mon, ptr, domsg ? NC_SHOW_MSG : NO_NC_FLAGS);
        /* shape-change message is given when vampshifter turns into a
           fog cloud in order to move under a closed door */
        display_nhwindow()(WIN_MESSAGE, FALSE);
    }
    return reslt;
}

/*monmove.c*/

import { ACURRSTR } from "./attrib.h.macros.js";
import { something } from "./decl.h.macros.js";
import {
    AMULET_CLASS, ARMOR_CLASS, BALL_CLASS, COIN_CLASS, FOOD_CLASS, GEM_CLASS, POTION_CLASS,
    RING_CLASS, ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_BAT, S_DOG, S_EEL, S_HUMAN, S_LEPRECHAUN,
    S_LIGHT, S_NYMPH, S_VAMPIRE, VENOM_CLASS, WAND_CLASS, WEAPON_CLASS,
} from "./defsym.h.js";
import { canspotmon, vobj_at } from "./display.h.macros.js";
import { In_endgame, Inhell, Is_rogue_level } from "./dungeon.h.macros.js";
import { BUFSZ, COLNO, FALSE, ROWNO, TRUE, coordxy } from "./global.h.js";
import {
    ARM, BOLT_LIM, HEAD, KILLED_BY_AN, MMOVE_DIED, MMOVE_DONE, MMOVE_MOVED, MMOVE_NOMOVES,
    MMOVE_NOTHING, MON_POLE_DIST, NC_SHOW_MSG, NO_NC_FLAGS, NO_TRAP_FLAGS, RLOC_MSG,
} from "./hack.h.js";
import { IndexOk, distu, max, mdistu, min, rn1, verbalize1 } from "./hack.h.macros.js";
import { ACCFOOD, MANFOOD } from "./mextra.h.js";
import { EDOG, has_edog } from "./mextra.h.macros.js";
import {
    ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_U, NOTONL, struct_mfndposdata,
} from "./mfndpos.h.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    AD_CLRC, AD_CORR, AD_DRIN, AD_RUST, AD_SPEL, AT_MAGC, AT_WEAP, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED,
    M_ATTK_HIT,
} from "./monattk.h.js";
import {
    amorphous, can_teleport, corpse_eater, grounded, hides_under, is_animal, is_covetous, is_demon,
    is_mercenary, is_mind_flayer, is_rider, is_unicorn, is_wanderer, is_watch, likes_gems,
    likes_gold, likes_magic, likes_objs, metallivorous, mindless, monsndx, needspick, nohands,
    nolimbs, passes_walls, perceives, regenerates, telepathic, throws_rocks, touch_petrifies,
    tunnels, unique_corpstat, verysmall, webmaker,
} from "./mondata.h.macros.js";
import { G_GENOD, MS_BRIBE, MS_CUSS, MS_LEADER } from "./monflag.h.js";
import {
    MTSZ, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, NEED_AXE, NEED_HTH_WEAPON,
    NEED_PICK_AXE, NEED_PICK_OR_AXE, NEED_WEAPON, STRAT_ARRIVE, STRAT_CLOSE, STRAT_WAITFORU,
    STRAT_WAITMASK,
} from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, M_AP_TYPE, U_AP_TYPE, engulfing_u, helpless, is_lminion, is_obj_mappear,
    is_vampshifter, mon_offmap,
} from "./monst.h.macros.js";
import {
    PM_ANGEL, PM_DISPLACER_BEAST, PM_ETTIN, PM_FOG_CLOUD, PM_GELATINOUS_CUBE, PM_GIANT_SPIDER,
    PM_GREMLIN, PM_HEZROU, PM_JABBERWOCK, PM_KILLER_BEE, PM_LEPRECHAUN, PM_MAIL_DAEMON, PM_MINOTAUR,
    PM_QUEEN_BEE, PM_STALKER, PM_STEAM_VORTEX, PM_TENGU, PM_VROCK, PM_XORN,
} from "./monsters.h.js";
import { OBJ_FLOOR } from "./obj.h.js";
import {
    Is_candle, Is_container, is_axe, is_cloak, is_gloves, is_mines_prize, is_pick, is_pole,
    is_shirt, is_soko_prize,
} from "./obj.h.macros.js";
import { GEMSTONE, MINERAL } from "./objclass.h.js";
import { is_organic } from "./objclass.h.macros.js";
import {
    ARROW, BAG_OF_HOLDING, BAG_OF_TRICKS, BLINDFOLD, BOOMERANG, BOULDER, CANDY_BAR, CORPSE,
    CREDIT_CARD, CRYSKNIFE, DAGGER, FEDORA, FORTUNE_COOKIE, GOLD_PIECE, LEASH, LEATHER_JACKET,
    LEMBAS_WAFER, LOCK_PICK, LUMP_OF_ROYAL_JELLY, MAGIC_MARKER, MAGIC_WHISTLE, OILSKIN_SACK,
    PANCAKE, ROCK, SACK, SCR_SCARE_MONSTER, SKELETON_KEY, SLING, STETHOSCOPE, STRANGE_OBJECT,
    TIN_OPENER, TIN_WHISTLE, TOWEL,
} from "./objects.h.js";
import { NATTK, NORMAL_SPEED } from "./permonst.h.js";
import {
    CORR, DOOR, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, D_WARNED, IRONBARS,
    LADDER, ROOM, STAIRS, W_NONDIGGABLE,
} from "./rm.h.js";
import {
    ACCESSIBLE, IS_ALTAR, IS_DOOR, IS_OBSTRUCTED, IS_STWALL, IS_TREE, MON_AT, OBJ_AT, SURFACE_AT,
    Sokoban, fmon, levl, m_at, remove_monster,
} from "./rm.h.macros.js";
import { TRAPPED_DOOR, Trap_Caught_Mon, Trap_Killed_Mon, Trap_Moved_Mon, WEB } from "./trap.h.js";
import { is_pit } from "./trap.h.macros.js";
import { cansee, couldsee, m_cansee, m_canseeu } from "./vision.h.macros.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import { Upolyd, m_next2u, mhis, next2u, u_at } from "./you.h.macros.js";
import {
    Aggravate_monster, Blind_telepat, Conflict, Deaf, Displaced, Half_spell_damage, Hallucination,
    Invis, Protection_from_shape_changers, Stealth, Unaware, Underwater,
} from "./youprop.h.macros.js";
import { char, int, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u } from "../rt/int64.js";
import { assert, memset, strchr, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_add, sizeof_member, struct_assign } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { artifact_light, has_magic_key } from "./artifact.js";
import { isok } from "./cmd.js";
import { is_pool } from "./dbridge.js";
import { a11y, flags, gb, gi, gk, gn, go, gy, svc, svl, svm, u } from "./decl.js";
import { bury_an_obj, is_digging, mdig_tunnel, watch_dig } from "./dig.js";
import { canseemon, newsym, sensemon, swallowed } from "./display.js";
import { Adjmonnam, Amonnam, Monnam, YMonnam, mon_nam, y_monnam } from "./do_name.js";
import { dogfood } from "./dog.js";
import { could_reach_item, cursed_object_at, dog_move, finish_meating } from "./dogmove.js";
import { Is_special, u_on_newpos } from "./dungeon.js";
import { eaten_stat } from "./eat.js";
import { sengr_at, wipe_engr_at } from "./engrave.js";
import {
    disturb_buried_zombies, in_rooms, in_town, losehp, may_dig, money_cnt, notice_mon,
    switch_terrain,
} from "./hack.js";
import { dist2, distmin, sgn, upstart } from "./hacklib.js";
import { delobj, g_at, sobj_at } from "./invent.js";
import { picking_lock } from "./lock.js";
import { grow_up, set_malign } from "./makemon.js";
import { castmu } from "./mcastu.js";
import { mattackm, mdisplacem } from "./mhitm.js";
import { expels, mattacku, ranged_attk_available } from "./mhitu.js";
import { demon_talk } from "./minion.js";
import { bill_dummy_object, splitobj } from "./mkobj.js";
import {
    angry_guards, can_carry, can_touch_safely, curr_mon_load, healmon, hideunder, m_consume_obj,
    m_respond, max_mon_load, maybe_unhide_at, meatcorpse, meatmetal, meatobj, mfndpos, mnexto,
    mon_allowflags, mondied, mongone, monkilled, monnear, mpickstuff, newcham, unstuck, wake_msg,
    wake_nearto, wakeup,
} from "./mon.js";
import {
    attacktype, can_track, dmgtype, locomotion, mon_knows_traps, mon_learns_traps, noattacks,
    resist_conflict, sticks,
} from "./mondata.js";
import { mons } from "./monst.js";
import { lined_up, m_carrying, m_has_launcher_and_ammo } from "./mthrowu.js";
import {
    find_defensive, find_misc, find_offensive, searches_for_item, use_defensive, use_misc,
} from "./muse.js";
import { objects } from "./objects.js";
import { an, bare_artifactname, makeplural, vtense, xname, yname } from "./objnam.js";
import {
    Norep, You, You_hear, You_see, impossible, pline, pline_The, pline_mon, pline_xy, set_msg_xy,
    verbalize,
} from "./pline.js";
import { mbodypart } from "./polyself.js";
import { in_your_sanctuary, inhistemple, pri_move } from "./priest.js";
import { quest_stat_check, quest_talk } from "./quest.js";
import { create_gas_cloud, m_in_out_region, visible_region_at } from "./region.js";
import { d, rn2, rnd } from "./rnd.js";
import { add_damage, after_shk_move, costly_spot, inhishop, shk_move } from "./shk.js";
import { stairway_at, stairway_find_dir } from "./stairs.js";
import { findgold, mdrop_obj } from "./steal.js";
import { place_monster } from "./steed.js";
import { noteleport_level, rloc, tele_restrict } from "./teleport.js";
import { gettrack } from "./track.js";
import { count_traps, maketrap, mintrap, t_at } from "./trap.js";
import { gd_move } from "./vault.js";
import { recalc_block_point, vision_recalc } from "./vision.js";
import { autoreturn_weapon, mon_wield_item, select_rwep } from "./weapon.js";
import { mwelded } from "./wield.js";
import { cuss, tactics } from "./wizard.js";
import { see_wsegs, worm_move, worm_nomove, wormhitu } from "./worm.js";
import { extract_from_minvent } from "./worn.js";
import { fracture_rock } from "./zap.js";
