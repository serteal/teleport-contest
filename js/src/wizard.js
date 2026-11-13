/* NetHack 5.0	wizard.c	$NHDT-Date: 1741407262 2025/03/07 20:14:22 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.116 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2016. */
/* NetHack may be freely redistributed.  See license for details. */

/* wizard code - inspired by rogue code from Merlyn Leroy (digi-g!brian) */
/*             - heavily modified to give the wiz balls.  (genat!mike)   */
/*             - dewimped and given some maledictions. -3. */
/*             - generalized for 3.1 (mike@bullns.on01.bull.ca) */

/* other_mon_has_arti() won't blow up if passed a NULL monst,
 * but its caller target_on() passes it a nonnull monst;
 * it may return a NULL monst pointer */

  /* might return NULL obj pointer */

/* adding more neutral creatures will tend to reduce the number of monsters
   summoned by nasty(); adding more lawful creatures will reduce the number
   of monsters summoned by lawfuls; adding more chaotic creatures will reduce
   the number of monsters summoned by chaotics; prior to 3.6.1, there were
   only four lawful candidates, so lawful summoners tended to summon more
   (trying to get lawful or neutral but obtaining chaotic instead) than
   their chaotic counterparts */
const nasties = static_array("nasties", int, null, [
    /* neutral */
    PM_COCKATRICE, PM_ETTIN, PM_STALKER, PM_MINOTAUR,
    PM_OWLBEAR, PM_PURPLE_WORM, PM_XAN, PM_UMBER_HULK,
    PM_XORN, PM_ZRUTY, PM_LEOCROTTA, PM_BALUCHITHERIUM,
    PM_CARNIVOROUS_APE, PM_FIRE_ELEMENTAL, PM_JABBERWOCK,
    PM_IRON_GOLEM, PM_OCHRE_JELLY, PM_GREEN_SLIME,
    PM_DISPLACER_BEAST, PM_GENETIC_ENGINEER,
    /* chaotic */
    PM_BLACK_DRAGON, PM_RED_DRAGON, PM_ARCH_LICH, PM_VAMPIRE_LEADER,
    PM_MASTER_MIND_FLAYER, PM_DISENCHANTER, PM_WINGED_GARGOYLE,
    PM_STORM_GIANT, PM_OLOG_HAI, PM_ELF_NOBLE, PM_ELVEN_MONARCH,
    PM_OGRE_TYRANT, PM_CAPTAIN, PM_GREMLIN,
    /* lawful */
    PM_SILVER_DRAGON, PM_ORANGE_DRAGON, PM_GREEN_DRAGON,
    PM_YELLOW_DRAGON, PM_GUARDIAN_NAGA, PM_FIRE_GIANT,
    PM_ALEAX, PM_COUATL, PM_HORNED_DEVIL, PM_BARBED_DEVIL,
    /* (Archons, titans, ki-rin, and golden nagas are suitably nasty, but
       they're summoners so would aggravate excessive summoning) */
]);

const wizapp = static_array("wizapp", unsigned, null, [
    PM_HUMAN,      PM_WATER_DEMON,  PM_VAMPIRE,       PM_RED_DRAGON,
    PM_TROLL,      PM_UMBER_HULK,   PM_XORN,          PM_XAN,
    PM_COCKATRICE, PM_FLOATING_EYE, PM_GUARDIAN_NAGA, PM_TRAPPER,
]);

/* If you've found the Amulet, make the Wizard appear after some time */
/* Also, give hints about portal locations, if amulet is worn/wielded -dlc */
export function amulet() { /* void */
    let mtmp;
    let ttmp;
    let amu;

    if ((((amu = uamul) != null && amu.otyp == AMULET_OF_YENDOR)
         || ((amu = uwep) != null && amu.otyp == AMULET_OF_YENDOR))
        && !rn2(15)) {
        for (ttmp = gf.ftrap; ttmp; ttmp = ttmp.ntrap) {
            if (ttmp.ttyp == MAGIC_PORTAL) {
                let du = distu(ttmp.tx, ttmp.ty);
                if (du <= 9)
                    pline(_("%s hot!"), Tobjnam(amu, _("feel")));
                else if (du <= 64)
                    pline(_("%s very warm."), Tobjnam(amu, _("feel")));
                else if (du <= 144)
                    pline(_("%s warm."), Tobjnam(amu, _("feel")));
                /* else, the amulet feels normal */
                break;
            }
        }
    }

    if (!svc.context.no_of_wizards)
        return;
    /* find Wizard, and wake him if necessary */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (mtmp.iswiz && mtmp.msleeping && !rn2(40)) {
            mtmp.msleeping = 0;
            if (!m_next2u(mtmp))
                You(
      _("get the creepy feeling that somebody noticed your taking the Amulet."));
            return;
        }
    }
}

export function mon_has_amulet(mtmp) { /* int */
    let otmp;

    for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
        if (otmp.otyp == AMULET_OF_YENDOR)
            return 1;
    return 0;
}

export function mon_has_special(mtmp) { /* int */
    let otmp;

    for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj)
        if (otmp.otyp == AMULET_OF_YENDOR
            || any_quest_artifact(otmp)
            || otmp.otyp == BELL_OF_OPENING
            || otmp.otyp == CANDELABRUM_OF_INVOCATION
            || otmp.otyp == SPE_BOOK_OF_THE_DEAD)
            return 1;
    return 0;
}

/*
 *      New for 3.1  Strategy / Tactics for the wiz, as well as other
 *      monsters that are "after" something (defined via mflag3).
 *
 *      The strategy section decides *what* the monster is going
 *      to attempt, the tactics section implements the decision.
 */

function which_arti(mask) { /* short */
    switch (mask) {
    case M3_WANTSAMUL:
        return AMULET_OF_YENDOR;
    case M3_WANTSBELL:
        return BELL_OF_OPENING;
    case M3_WANTSCAND:
        return CANDELABRUM_OF_INVOCATION;
    case M3_WANTSBOOK:
        return SPE_BOOK_OF_THE_DEAD;
    default:
        break; /* 0 signifies quest artifact */
    }
    return 0;
}

/*
 *      If "otyp" is zero, it triggers a check for the quest_artifact,
 *      since bell, book, candle, and amulet are all objects, not really
 *      artifacts right now.  [MRS]
 */
function mon_has_arti(mtmp, otyp) { /* boolean */
    let otmp;

    for (otmp = mtmp.minvent; otmp; otmp = otmp.nobj) {
        if (otyp) {
            if (otmp.otyp == otyp)
                return 1;
        } else if (any_quest_artifact(otmp))
            return 1;
    }
    return 0;
}

/*
 * Returns some monster other than mtmp that
 * has artifact, or NULL monst pointer.
 */
function other_mon_has_arti(mtmp, otyp) { /* struct monst * */
    let mtmp2;

    for (mtmp2 = fmon(); mtmp2; mtmp2 = mtmp2.nmon)
        /* no need for !DEADMONSTER check here since they have no inventory */
        if (mtmp2 != mtmp)
            if (mon_has_arti(mtmp2, otyp))
                return mtmp2;

    return null;
}

/*
 * Returns obj of type specified if there is one
 * on the ground, otherwise returns NULL obj pointer.
 */
function on_ground(otyp) { /* struct obj * */
    let otmp;

    for (otmp = fobj(); otmp; otmp = otmp.nobj)
        if (otyp) {
            if (otmp.otyp == otyp)
                return otmp;
        } else if (any_quest_artifact(otmp))
            return otmp;
    return null;
}

function you_have(mask) { /* boolean */
    switch (mask) {
    case M3_WANTSAMUL:
        return u.uhave.amulet;
    case M3_WANTSBELL:
        return u.uhave.bell;
    case M3_WANTSCAND:
        return u.uhave.menorah;
    case M3_WANTSBOOK:
        return u.uhave.book;
    case M3_WANTSARTI:
        return u.uhave.questart;
    default:
        break;
    }
    return 0;
}

function target_on(mask, mtmp) { /* unsigned long long */
    let otyp;
    let otmp;
    let mtmp2;

    if (!(mtmp.data.mflags3 & (mask)))
        return STRAT_NONE;

    otyp = which_arti(mask);
    if (!mon_has_arti(mtmp, otyp)) {
        if (you_have(mask)) {
            mtmp.mgoal.x = u.ux;
            mtmp.mgoal.y = u.uy;
            return ulong((STRAT_PLAYER | mask));
        } else if ((otmp = on_ground(otyp))) {
            mtmp.mgoal.x = otmp.ox;
            mtmp.mgoal.y = otmp.oy;
            return ulong((STRAT_GROUND | mask));
        } else if ((mtmp2 = other_mon_has_arti(mtmp, otyp)) != null
                 /* when seeking the Amulet, avoid targeting the Wizard
                    or temple priests (to protect Moloch's high priest) */
                 && (otyp != AMULET_OF_YENDOR
                     || (!mtmp2.iswiz && !inhistemple(mtmp2)))) {
            mtmp.mgoal.x = mtmp2.mx;
            mtmp.mgoal.y = mtmp2.my;
            return ulong((STRAT_MONSTR | mask));
        }
    }
    mtmp.mgoal.x = mtmp.mgoal.y = 0;
    return STRAT_NONE;
}

function strategy(mtmp) { /* unsigned long long */
    let strat, dstrat;

    if (!is_covetous(mtmp.data)
        /* perhaps a shopkeeper has been polymorphed into a master
           lich; we don't want it teleporting to the stairs to heal
           because that will leave its shop untended */
        || (mtmp.isshk && inhishop(mtmp))
        /* likewise for temple priests */
        || (mtmp.ispriest && inhistemple(mtmp)))
        return STRAT_NONE;

    switch (Math.trunc((mtmp.mhp * 3) / mtmp.mhpmax)) { /* 0-3 */
    default:
    case 0: /* panic time - mtmp is almost snuffed */
        return STRAT_HEAL;

    case 1: /* the wiz is less cautious */
        if (mtmp.data != mons[PM_WIZARD_OF_YENDOR])
            return STRAT_HEAL;
        /* FALLTHROUGH */;
        /* FALLTHRU */
    case 2:
        dstrat = STRAT_HEAL;
        break;

    case 3:
        dstrat = STRAT_NONE;
        break;
    }

    if (svc.context.made_amulet)
        if ((strat = target_on(M3_WANTSAMUL, mtmp)) != STRAT_NONE)
            return strat;

    if (u.uevent.invoked) { /* priorities change once gate opened */
        if ((strat = target_on(M3_WANTSARTI, mtmp)) != STRAT_NONE)
            return strat;
        if ((strat = target_on(M3_WANTSBOOK, mtmp)) != STRAT_NONE)
            return strat;
        if ((strat = target_on(M3_WANTSBELL, mtmp)) != STRAT_NONE)
            return strat;
        if ((strat = target_on(M3_WANTSCAND, mtmp)) != STRAT_NONE)
            return strat;
    } else {
        if ((strat = target_on(M3_WANTSBOOK, mtmp)) != STRAT_NONE)
            return strat;
        if ((strat = target_on(M3_WANTSBELL, mtmp)) != STRAT_NONE)
            return strat;
        if ((strat = target_on(M3_WANTSCAND, mtmp)) != STRAT_NONE)
            return strat;
        if ((strat = target_on(M3_WANTSARTI, mtmp)) != STRAT_NONE)
            return strat;
    }
    return dstrat;
}

/* pick a destination for a covetous monster to flee to so that it can
   heal or for guardians (Kops) to congregate at to block hero's progress */
export function choose_stairs(
    sx, sy,
    dir) { /* void */ /* True: forward, False: backtrack (usually up) */
    let stway;
    let stdir = builds_up(u.uz) ? dir : +!dir;

    /* look for stairs in direction 'stdir' (True: up, False: down) */
    stway = stairway_find_type_dir(FALSE, stdir);
    if (!stway) {
        /* no stairs; look for ladder it that direction */
        stway = stairway_find_type_dir(TRUE, stdir);
        if (!stway) {
            /* no ladder either; look for branch stairs or ladder in any
               direction */
            for (stway = gs.stairs; stway; stway = stway.next)
                if (stway.tolev.dnum != u.uz.dnum)
                    break;
            /* if no branch stairs/ladder, check for regular stairs in
               opposite direction, then for regular ladder if necessary */
            if (!stway) {
                stway = stairway_find_type_dir(FALSE, +!stdir);
                if (!stway)
                    stway = stairway_find_type_dir(TRUE, +!stdir);
            }
        }
        /* [note: 'stway' could still be Null if the only access to this
           level is via magic portal] */
    }

    if (stway)
        sx[0] = stway.sx, sy[0] = stway.sy;
}

export function tactics(mtmp) { /* int */
    const $frame = stack_frame(); try {
    let strat = strategy(mtmp);
    let sx = stack_var(coordxy, 0), sy = stack_var(coordxy, 0), mx, my;

    mtmp.mstrategy =
        or64u(and64u(mtmp.mstrategy, or64u(STRAT_WAITMASK, STRAT_APPEARMSG)), strat);

    switch (strat) {
    case STRAT_HEAL: /* hide and recover */
        mx = mtmp.mx, my = mtmp.my;

        if (u.uswallow && u.ustuck == mtmp)
            expels(mtmp, mtmp.data, TRUE);

        /* if wounded, hole up on or near the stairs (to block them) */
        choose_stairs(sx, sy, (mtmp.m_id % 2));
        mtmp.mavenge = 1; /* covetous monsters attack while fleeing */
        if (In_W_tower(mx, my, u.uz)
            || (mtmp.iswiz && !sx[0] && !mon_has_amulet(mtmp))) {
            if (!noteleport_level(mtmp) &&
                !rn2(3 + Math.trunc(mtmp.mhp / 10)))
                rloc(mtmp, RLOC_MSG);
        } else if (sx[0] && (mx != sx[0] || my != sy[0])) {
            if (!noteleport_level(mtmp) &&
                !mnearto(mtmp, sx[0], sy[0], TRUE, RLOC_MSG)) {
                /* couldn't move to the target spot for some reason,
                   so stay where we are (don't actually need rloc_to()
                   because mtmp is still on the map at <mx,my>... */
                rloc_to(mtmp, mx, my);
                return 0;
            }
            mx = mtmp.mx, my = mtmp.my; /* update cached location */
        }
        /* if you're not around, cast healing spells */
        if (distu(mx, my) > (BOLT_LIM * BOLT_LIM))
            if (mtmp.mhp <= mtmp.mhpmax - 8) {
                healmon(mtmp, rnd(8), 0);
                return 1;
            }
        /* FALLTHROUGH */;
        /*FALLTHRU*/

    case STRAT_NONE: /* harass */
        if (!noteleport_level(mtmp) && !rn2(!mtmp.mflee ? 5 : 33))
            mnexto(mtmp, RLOC_MSG);
        return 0;

    default: /* kill, maim, pillage! */
    {
        let where = (strat & STRAT_STRATMASK);
        let tx = mtmp.mgoal.x, ty = mtmp.mgoal.y;
        let targ = (strat & STRAT_GOAL);
        let otmp;

        if (!targ || !isok(tx, ty)) { /* simply wants you to close */
            return 0;
        }
        if (noteleport_level(mtmp) && !monnear(mtmp, tx, ty))
            return 0;
        if (u_at(tx, ty) || where == STRAT_PLAYER) {
            /* player is standing on it (or has it) */
            mx = mtmp.mx, my = mtmp.my;
            if (noteleport_level(mtmp) ||
                !mnearto(mtmp, tx, ty, FALSE, RLOC_MSG))
                rloc_to(mtmp, mx, my); /* no room? stay put */
            return 0;
        }
        if (where == STRAT_GROUND) {
            if (!MON_AT(tx, ty) || (mtmp.mx == tx && mtmp.my == ty)) {
                /* teleport to it and pick it up */
                rloc_to(mtmp, tx, ty); /* clean old pos */

                if ((otmp = on_ground(which_arti(targ))) != null) {
                    if (cansee(mtmp.mx, mtmp.my))
                        pline(_("%s picks up %s."), Monnam(mtmp),
                              distant_name(otmp, doname));
                    obj_extract_self(otmp);
                    mpickobj(mtmp, otmp);
                    return 1;
                } else
                    return 0;
            } else {
                /* a monster is standing on it - cause some trouble */
                if (!rn2(5) && !noteleport_level(mtmp))
                    mnexto(mtmp, RLOC_MSG);
                return 0;
            }
        } else { /* a monster has it - 'port beside it. */
            mx = mtmp.mx, my = mtmp.my;
            if (!noteleport_level(mtmp) &&
                !mnearto(mtmp, tx, ty, FALSE, RLOC_MSG))
                rloc_to(mtmp, mx, my); /* no room? stay put */
            return 0;
        }
    } /* default case */
    } /* switch */
    /*NOTREACHED*/
    return 0;
    } finally { stack_pop($frame); }
}

/* are there any monsters mon could aggravate? */
export function has_aggravatables(mon) { /* boolean */
    let mtmp;
    let in_w_tower = In_W_tower(mon.mx, mon.my, u.uz);

    if (in_w_tower != In_W_tower(u.ux, u.uy, u.uz))
        return FALSE;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (in_w_tower != In_W_tower(mtmp.mx, mtmp.my, u.uz))
            continue;
        if ((mtmp.mstrategy & STRAT_WAITFORU) != 0 || helpless(mtmp))
            return TRUE;
    }
    return FALSE;
}

export function aggravate() { /* void */
    let mtmp;
    let in_w_tower = In_W_tower(u.ux, u.uy, u.uz);

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (in_w_tower != In_W_tower(mtmp.mx, mtmp.my, u.uz))
            continue;
        mtmp.mstrategy = and64u(mtmp.mstrategy, not64u(or64u(STRAT_WAITFORU, STRAT_APPEARMSG)));
        mtmp.msleeping = 0;
        if (!mtmp.mcanmove && !rn2(5)) {
            mtmp.mfrozen = 0;
            mtmp.mcanmove = 1;
        }
    }
}

/* "Double Trouble" spell cast by the Wizard; caller is responsible for
   only casting this when there is currently one wizard in existence;
   the clone can't use it unless/until its creator has been killed off */
export function clonewiz() { /* void */
    let mtmp2;

    if ((mtmp2 = makemon(mons[PM_WIZARD_OF_YENDOR], u.ux, u.uy, MM_NOWAIT))
        != null) {
        mtmp2.msleeping = mtmp2.mtame = mtmp2.mpeaceful = 0;
        if (!u.uhave.amulet && rn2(2)) { /* give clone a fake */
            add_to_minv(mtmp2,
                               mksobj(FAKE_AMULET_OF_YENDOR, TRUE, FALSE));
        }
        if (!Protection_from_shape_changers()) {
            mtmp2.m_ap_type = M_AP_MONSTER;
            mtmp2.mappearance = ROLL_FROM(wizapp);
        }
        newsym(mtmp2.mx, mtmp2.my);
    }
}

/* also used by newcham() */
export function pick_nasty(
    difcap) { /* int */ /* if non-zero, try to make difficulty be lower than this */
    let alt, res = ROLL_FROM(nasties);

    /* To do?  Possibly should filter for appropriate forms when
     * in the elemental planes or surrounded by water or lava.
     *
     * We want monsters represented by uppercase on rogue level,
     * but we don't try very hard.
     */
    if (Is_rogue_level(u.uz)
        && !(ord('A') <= monsym(mons[res]) && monsym(mons[res]) <= ord('Z')))
        res = ROLL_FROM(nasties);

    /* if genocided or too difficult or out of place, try a substitute
       when a suitable one exists
           arch-lich -> master lich,
           master mind flayer -> mind flayer,
       but the substitutes are likely to be genocided too */
    alt = res;
    if ((svm.mvitals[res].mvflags & G_GENOD) != 0
        || (difcap > 0 && mons[res].difficulty >= difcap)
         /* note: nasty() -> makemon() ignores G_HELL|G_NOHELL;
            arch-lich and master lich are both flagged as hell-only;
            this filtering demotes arch-lich to master lich when
            outside of Gehennom (unless the latter has been genocided) */
        || (mons[res].geno & (Inhell() ? G_NOHELL : G_HELL)) != 0)
        alt = big_to_little(res);
    if (alt != res && (svm.mvitals[alt].mvflags & G_GENOD) == 0) {
        let mnam = mons[alt].pmnames[NEUTRAL],
                   lastspace = strrchr(mnam, ord(' '));

        /* only non-juveniles can become alternate choice */
        if (strncmp(mnam, _("baby "), 5)
            && (!lastspace
                || (strcmp(lastspace, _(" hatchling"))
                    && strcmp(lastspace, _(" pup"))
                    && strcmp(lastspace, _(" cub")))))
            res = alt;
    }

    return res;
}

/* create some nasty monsters, aligned with the caster or neutral; chaotic
   and unaligned are treated as equivalent; if summoner is Null, this is
   for late-game harassment (after the Wizard has been killed at least once
   or the invocation ritual has been performed), in which case we treat
   'summoner' as neutral, since that will produce the greatest number of
   creatures on average (in 3.6.0 and earlier, Null was treated as chaotic);
   returns the number of monsters created */
export function nasty(summoner) { /* int */
    const $frame = stack_frame(); try {
    var mtmp;
    var bypos = stack_struct(struct_nhcoord);
    var i, j, count, census, tmp, makeindex,
        s_cls, m_cls, difcap, trylimit, castalign;
    /* when a monster casts the "summon nasties" spell, it gives feedback;
       when random post-Wizard harassment casts that, we give feedback */
    var mmflags = summoner ? MM_NOMSG : NO_MM_FLAGS;

    /* some candidates may be created in groups, so simple count
       of non-null makemon() return is inadequate */
    census = monster_census(FALSE);

    if (!rn2(10) && Inhell()) {
        /* this might summon a demon prince or lord */
        count = msummon(null); /* summons like WoY */
    } else {
        count = 0;
        s_cls = summoner ? summoner.data.mlet : 0;
        difcap = summoner ? summoner.data.difficulty : 0; /* spellcasters */
        castalign = summoner ? sgn(summoner.data.maligntyp) : 0;
        tmp = (u.ulevel > 3) ? Math.trunc(u.ulevel / 3) : 1;
        /* if we don't have a casting monster, nasties appear around hero,
           otherwise they'll appear around spot summoner thinks she's at */
        bypos.x = u.ux;
        bypos.y = u.uy;
        for (i = rnd(tmp); i > 0 && count < MAXNASTIES; --i) {
            /* Of the 44 nasties[], 10 are lawful, 14 are chaotic,
             * and 20 are neutral.  [These numbers are up date for
             * 5.0.0; the ones in the next paragraph are not....]
             *
             * Neutral caster, used for late-game harassment,
             * has 18/42 chance to stop the inner loop on each
             * critter, 24/42 chance for another iteration.
             * Lawful caster has 28/42 chance to stop unless the
             * summoner is an angel or demon, in which case the
             * chance is 26/42.
             * Chaotic or unaligned caster has 32/42 chance to
             * stop, so will summon fewer creatures on average.
             *
             * The outer loop potentially gives chaotic/unaligned
             * a chance to even things up since others will hit
             * MAXNASTIES sooner, but its number of iterations is
             * randomized so it won't always do so.
             */
            for (j = 0; j < 20; j++) {
                /* Don't create more spellcasters of the monster's level or
                 * higher--avoids chain summoners filling up the level.
                 */
                trylimit = 10 + 1; /* 10 tries */
                nextj: { do {
                    if (!--trylimit)
                        break nextj;; /* break this loop, continue outer one */
                    makeindex = pick_nasty(difcap);
                    m_cls = mons[makeindex].mlet;
                } while ((difcap > 0 && mons[makeindex].difficulty >= difcap
                          && attacktype(mons[makeindex], AT_MAGC))
                         || (s_cls == S_DEMON && m_cls == S_ANGEL)
                         || (s_cls == S_ANGEL && m_cls == S_DEMON));
                /* do this after picking the monster to place */
                if (summoner && !enexto(bypos, summoner.mux, summoner.muy,
                                        mons[makeindex]))
                    continue;
                /* this honors genocide but overrides extinction; it ignores
                   inside-hell-only (G_HELL) & outside-hell-only (G_NOHELL) */
                if ((mtmp = makemon(mons[makeindex], bypos.x, bypos.y,
                                    mmflags)) != null) {
                    mtmp.msleeping = mtmp.mpeaceful = mtmp.mtame = 0;
                    set_malign(mtmp);
                } else {
                    /* random monster to substitute for geno'd selection;
                       unlike direct choice, not forced to be hostile [why?];
                       limit spellcasters to inhibit chain summoning */
                    if ((mtmp = makemon(null,
                                        bypos.x, bypos.y, mmflags)) != null) {
                        m_cls = mtmp.data.mlet;
                        if ((difcap > 0 && mtmp.data.difficulty >= difcap
                             /* always capping for substitutes made wanton
                                genocide become too strong in the endgame */
                             && rn2(In_endgame(u.uz) ? 3 : 7) /* usually */
                             && attacktype(mtmp.data, AT_MAGC))
                            || (s_cls == S_DEMON && m_cls == S_ANGEL)
                            || (s_cls == S_ANGEL && m_cls == S_DEMON))
                            mtmp = unmakemon(mtmp, NO_MM_FLAGS); /* Null */
                    }
                }

                if (mtmp) {
                    /* if creating an arch-lich or Archon, further directly
                       selected nasties will have to be less difficult, and
                       substitues for geno victims will usually be less
                       (note: Archon is not in nasties[] but could be chosen
                       as random replacement for a genocided selection) */
                    if (mtmp.data == mons[PM_ARCH_LICH]
                        || mtmp.data == mons[PM_ARCHON]) {
                        tmp = min(mons[PM_ARCHON].difficulty, /* A:26 */
                                  mons[PM_ARCH_LICH].difficulty); /* L:31 */
                        if (!difcap || difcap > tmp)
                            difcap = tmp; /* rest must be lower difficulty */
                    }
                    /* delay first use of spell or breath attack */
                    mtmp.mspec_used = rnd(4);

                    if (++count >= MAXNASTIES
                        || mtmp.data.maligntyp == 0
                        || sgn(mtmp.data.maligntyp) == castalign)
                        break;
                }
 }
                ; /* empty; label must be followed by a statement */
            } /* for j */
        } /* for i */
    }

    if (count)
        count = monster_census(FALSE) - census;
    return count;
    } finally { stack_pop($frame); }
}
export const MAXNASTIES = 10;

/* Let's resurrect the Wizard, for some unexpected fun. */
export function resurrect() { /* void */
    let mtmp, mmtmp;
    let elapsed;
    let verb;

    if (!svc.context.no_of_wizards) {
        /* make a new Wizard */
        verb = _("kill");
        mtmp = makemon(mons[PM_WIZARD_OF_YENDOR], u.ux, u.uy, MM_NOWAIT);
        /* affects experience; he's not coming back from a corpse
           but is subject to repeated killing like a revived corpse */
        if (mtmp)
            mtmp.mrevived = 1;
    } else {
        /* look for a migrating Wizard */
        verb = _("elude");
        mmtmp = ref_of(gm, "migrating_mons");
        while ((mtmp = mmtmp[0]) != null) {
            if (mtmp.iswiz
                /* if he has the Amulet, he won't bring it to you */
                && !mon_has_amulet(mtmp)
                && long(elapsed = svm.moves - mtmp.mlstmv) > 0) {
                mon_catchup_elapsed_time(mtmp, elapsed);
                if (elapsed >= LARGEST_INT)
                    elapsed = LARGEST_INT - 1;
                elapsed = Math.trunc(elapsed / 50);
                if (mtmp.msleeping && rn2(int(elapsed) + 1))
                    mtmp.msleeping = 0;
                if (mtmp.mfrozen == 1) /* would unfreeze on next move */
                    mtmp.mfrozen = 0, mtmp.mcanmove = 1;
                if (!helpless(mtmp)) {
                    mmtmp[0] = mtmp.nmon;
                    mon_arrive(mtmp, -1); /* -1: Wiz_arrive (dog.c) */
                    /* mx: mon_arrive() might have sent mtmp into limbo */
                    if (!mtmp.mx)
                        mtmp = null;
                    /* note: there might be a second Wizard; if so,
                       he'll have to wait until the next resurrection */
                    break;
                }
            }
            mmtmp = ref_of(mtmp, "nmon");
        }
    }

    if (mtmp) {
        /* FIXME: when a new wizard is created by makemon(), it gives
           a "<mon> appears" message, delivered after he's been placed
           on the map; however, when an existing wizard comes off
           migrating_mons, he ends up triggering "<mon> vanishes and
           reappears" on his first move (tactics when hero is carrying
           the Amulet); setting STRAT_WAITMASK suppresses that but then
           he just sits wherever he is, "meditating", contradicting the
           threatening message below */
        mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);

        mtmp.mtame = 0, mtmp.mpeaceful = 0; /* paranoia */
        set_malign(mtmp);
        if (!Deaf()) {
            pline(_("A voice booms out..."));
               ;
            verbalize(_("So thou thought thou couldst %s me, fool."), verb);
        }
    }
}

/* Here, we make trouble for the poor shmuck who actually
   managed to do in the Wizard. */
export function intervene() { /* void */
    let which = Is_astralevel(u.uz) ? rnd(4) : rn2(6);

    /* cases 0 and 5 don't apply on the Astral level */
    switch (which) {
    case 0:
    case 1:
        You_feel(_("vaguely nervous."));
        break;
    case 2:
        if (!Blind())
            You(_("notice a %s glow surrounding you."), hcolor(NH_BLACK()));
        rndcurse();
        break;
    case 3:
        aggravate();
        break;
    case 4:
        nasty(null);
        break;
    case 5:
        resurrect();
        break;
    }
}

/* Wizard of Yendor is being removed from play (dead or escaped the dungeon);
   keep the bookkeeping for him up to date */
export function wizdeadorgone() { /* void */
    svc.context.no_of_wizards--;
    if (!u.uevent.udemigod) {
        u.uevent.udemigod = TRUE;
        u.udg_cnt = unsigned(rn1(250, 50));
    }
}

const random_insult = static_array("random_insult", ptr_to(char), null, [
    _("antic"),      _("blackguard"),   _("caitiff"),    _("chucklehead"),
    _("coistrel"),   _("craven"),       _("cretin"),     _("cur"),
    _("dastard"),    _("demon fodder"), _("dimwit"),     _("dolt"),
    _("fool"),       _("footpad"),      _("imbecile"),   _("knave"),
    _("maledict"),   _("miscreant"),    _("niddering"),  _("poltroon"),
    _("rattlepate"), _("reprobate"),    _("scapegrace"), _("varlet"),
    _("villein"), /* (sic.) */
    _("wittol"),     _("worm"),         _("wretch"),
]);

const random_malediction = static_array("random_malediction", ptr_to(char), null, [
    _("Hell shall soon claim thy remains,"), _("I chortle at thee, thou pathetic"),
    _("Prepare to die, thou"), _("Resistance is useless,"),
    _("Surrender or die, thou"), _("There shall be no mercy, thou"),
    _("Thou shalt repent of thy cunning,"), _("Thou art as a flea to me,"),
    _("Thou art doomed,"), _("Thy fate is sealed,"),
    _("Verily, thou shalt be one dead")
]);

/* Insult or intimidate the player */
export function cuss(mtmp) { /* void */
    if (Deaf())
        return;
    if (mtmp.iswiz) {
        if (!rn2(5)) { /* typical bad guy action */
            pline(_("%s laughs fiendishly."), Monnam(mtmp));
        } else if (u.uhave.amulet && !rn2(SIZE(random_insult))) {
               ;
            verbalize(_("Relinquish the amulet, %s!"),
                      ROLL_FROM(random_insult));
        } else if (u.uhp < 5 && !rn2(2)) { /* Panic */
               ;
            verbalize(rn2(2) ? _("Even now thy life force ebbs, %s!")
                             : _("Savor thy breath, %s, it be thy last!"),
                      ROLL_FROM(random_insult));
        } else if (mtmp.mhp < 5 && !rn2(2)) { /* Parthian shot */
               ;
            verbalize(rn2(2) ? _("I shall return.") : _("I'll be back."));
        } else {
               ;
            verbalize(_("%s %s!"),
                      ROLL_FROM(random_malediction),
                      ROLL_FROM(random_insult));
        }
    } else if (is_lminion(mtmp)
               && !(mtmp.isminion && EMIN(mtmp).renegade)) {
        com_pager(_("angel_cuss")); /* TODO: the Hallucination msg */
        /*com_pager(rn2(QTN_ANGELIC - 1 + (Hallucination ? 1 : 0))
          + QT_ANGELIC);*/
    } else {
        if (!rn2(is_minion(mtmp.data) ? 100 : 5))
            pline(_("%s casts aspersions on your ancestry."), Monnam(mtmp));
        else
            com_pager(_("demon_cuss"));
    }
    wake_nearto(mtmp.mx, mtmp.my, 5 * 5);
}

/*wizard.c*/

import { struct_nhcoord } from "./coord.h.js";
import { NH_BLACK } from "./decl.h.macros.js";
import { S_ANGEL, S_DEMON } from "./defsym.h.js";
import { In_endgame, Inhell, Is_astralevel, Is_rogue_level } from "./dungeon.h.macros.js";
import { FALSE, LARGEST_INT, TRUE, coordxy } from "./global.h.js";
import { BOLT_LIM, MM_NOMSG, MM_NOWAIT, NO_MM_FLAGS, RLOC_MSG } from "./hack.h.js";
import { ROLL_FROM, distu, min, rn1 } from "./hack.h.macros.js";
import { EMIN } from "./mextra.h.macros.js";
import { AT_MAGC } from "./monattk.h.js";
import { is_covetous, is_minion, monsym } from "./mondata.h.macros.js";
import {
    G_GENOD, G_HELL, G_NOHELL, M3_WANTSAMUL, M3_WANTSARTI, M3_WANTSBELL, M3_WANTSBOOK, M3_WANTSCAND,
    NEUTRAL,
} from "./monflag.h.js";
import {
    M_AP_MONSTER, STRAT_APPEARMSG, STRAT_GOAL, STRAT_GROUND, STRAT_HEAL, STRAT_MONSTR, STRAT_NONE,
    STRAT_PLAYER, STRAT_STRATMASK, STRAT_WAITFORU, STRAT_WAITMASK,
} from "./monst.h.js";
import { DEADMONSTER, helpless, is_lminion } from "./monst.h.macros.js";
import {
    PM_ALEAX, PM_ARCHON, PM_ARCH_LICH, PM_BALUCHITHERIUM, PM_BARBED_DEVIL, PM_BLACK_DRAGON,
    PM_CAPTAIN, PM_CARNIVOROUS_APE, PM_COCKATRICE, PM_COUATL, PM_DISENCHANTER, PM_DISPLACER_BEAST,
    PM_ELF_NOBLE, PM_ELVEN_MONARCH, PM_ETTIN, PM_FIRE_ELEMENTAL, PM_FIRE_GIANT, PM_FLOATING_EYE,
    PM_GENETIC_ENGINEER, PM_GREEN_DRAGON, PM_GREEN_SLIME, PM_GREMLIN, PM_GUARDIAN_NAGA,
    PM_HORNED_DEVIL, PM_HUMAN, PM_IRON_GOLEM, PM_JABBERWOCK, PM_LEOCROTTA, PM_MASTER_MIND_FLAYER,
    PM_MINOTAUR, PM_OCHRE_JELLY, PM_OGRE_TYRANT, PM_OLOG_HAI, PM_ORANGE_DRAGON, PM_OWLBEAR,
    PM_PURPLE_WORM, PM_RED_DRAGON, PM_SILVER_DRAGON, PM_STALKER, PM_STORM_GIANT, PM_TRAPPER,
    PM_TROLL, PM_UMBER_HULK, PM_VAMPIRE, PM_VAMPIRE_LEADER, PM_WATER_DEMON, PM_WINGED_GARGOYLE,
    PM_WIZARD_OF_YENDOR, PM_XAN, PM_XORN, PM_YELLOW_DRAGON, PM_ZRUTY,
} from "./monsters.h.js";
import { any_quest_artifact } from "./obj.h.macros.js";
import {
    AMULET_OF_YENDOR, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, FAKE_AMULET_OF_YENDOR,
    SPE_BOOK_OF_THE_DEAD,
} from "./objects.h.js";
import { MON_AT, fmon, fobj } from "./rm.h.macros.js";
import { MAGIC_PORTAL } from "./trap.h.js";
import { cansee } from "./vision.h.macros.js";
import { m_next2u, u_at } from "./you.h.macros.js";
import { Blind, Deaf, Protection_from_shape_changers } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, long, ord, ulong, unsigned } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { and64u, not64u, or64u } from "../rt/int64.js";
import { strcmp, strncmp, strrchr } from "../rt/libc.js";
import { stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { ptr_to, ref_of } from "../rt/struct.js";
import { isok } from "./cmd.js";
import { gf, gm, gs, svc, svm, u } from "./decl.js";
import { newsym } from "./display.js";
import { Monnam, hcolor } from "./do_name.js";
import { mon_arrive, mon_catchup_elapsed_time } from "./dog.js";
import { In_W_tower, builds_up } from "./dungeon.js";
import { sgn } from "./hacklib.js";
import { makemon, set_malign, unmakemon } from "./makemon.js";
import { expels } from "./mhitu.js";
import { monster_census, msummon } from "./minion.js";
import { add_to_minv, mksobj, obj_extract_self } from "./mkobj.js";
import { healmon, mnearto, mnexto, monnear, wake_nearto } from "./mon.js";
import { attacktype, big_to_little } from "./mondata.js";
import { mons } from "./monst.js";
import { Tobjnam, distant_name, doname } from "./objnam.js";
import { You, You_feel, pline, verbalize } from "./pline.js";
import { inhistemple } from "./priest.js";
import { com_pager } from "./questpgr.js";
import { rn2, rnd } from "./rnd.js";
import { inhishop } from "./shk.js";
import { rndcurse } from "./sit.js";
import { stairway_find_type_dir } from "./stairs.js";
import { mpickobj } from "./steal.js";
import { enexto, noteleport_level, rloc, rloc_to } from "./teleport.js";
