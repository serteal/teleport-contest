/* NetHack 5.0	mhitm.c	$NHDT-Date: 1732979463 2024/11/30 07:11:03 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.253 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

const brief_feeling = init_string(static_array("mhitm.c/brief_feeling", char, sizeof_string("have a %s feeling for a moment, then it passes.")), _("have a %s feeling for a moment, then it passes."), true);

function noises(magr, mattk) { /* void */
    let farq = +(mdistu(magr) > 15);

    if (!Deaf() && (farq != gf.far_noise || svm.moves - gn.noisetime > 10)) {
        gf.far_noise = farq;
        gn.noisetime = svm.moves;
        You_hear(_("%s%s."),
                 (mattk.aatyp == AT_EXPL) ? _("an explosion") : _("some noises"),
                 farq ? _(" in the distance") : _(""));
    }
}

function pre_mm_attack(magr, mdef) { /* void */
    let showit = FALSE;

    /* unhiding or unmimicking happens even if hero can't see it
       because the formerly concealed monster is now in action */
    if (M_AP_TYPE(mdef)) {
        seemimic(mdef);
        showit |= gv.vis;
    } else if (mdef.mundetected) {
        mdef.mundetected = 0;
        showit |= gv.vis;
    }
    if (M_AP_TYPE(magr)) {
        seemimic(magr);
        showit |= gv.vis;
    } else if (magr.mundetected) {
        magr.mundetected = 0;
        showit |= gv.vis;
    }

    if (gv.vis) {
        if (!canspotmon(magr))
            map_invisible(magr.mx, magr.my);
        else if (showit)
            newsym(magr.mx, magr.my);
        if (!canspotmon(mdef))
            map_invisible(mdef.mx, mdef.my);
        else if (showit)
            newsym(mdef.mx, mdef.my);
    }
}

/* feedback for when a monster-vs-monster attack misses */
function missmm(
    magr,
    mdef,
    mattk) { /* void */ /* attack and damage types */
    pre_mm_attack(magr, mdef);

    if (gv.vis) {
        pline(_("%s %s %s."), Monnam(magr),
              (magr.mcan || !could_seduce(magr, mdef, mattk)) ? _("misses")
                  : _("pretends to be friendly to"),
              mon_nam_too(mdef, magr));
    } else {
        noises(magr, mattk);
    }
}

/*
 *  fightm()  -- fight some other monster
 *
 *  Returns:
 *      0 - Monster did nothing.
 *      1 - If the monster made an attack.  The monster might have died.
 *
 *  There is an exception to the above.  If mtmp has the hero swallowed,
 *  then we report that the monster did nothing so it will continue to
 *  digest the hero.
 */
 /* have monsters fight each other */
export function fightm(mtmp) { /* int */
    let mon, nmon;
    let result, has_u_swallowed;
    /* perhaps the monster will resist Conflict */
    if (resist_conflict(mtmp))
        return 0;

    if (u.ustuck == mtmp) {
        /* perhaps we're holding it... */
        if (itsstuck(mtmp))
            return 0;
    }
    has_u_swallowed = engulfing_u(mtmp);

    for (mon = fmon(); mon; mon = nmon) {
        nmon = mon.nmon;
        if (nmon == mtmp)
            nmon = mtmp.nmon;
        /* Be careful to ignore monsters that are already dead, since we
         * might be calling this before we've cleaned them up.  This can
         * happen if the monster attacked a cockatrice bare-handedly, for
         * instance.
         */
        if (mon != mtmp && !DEADMONSTER(mon)) {
            if (monnear(mtmp, mon.mx, mon.my)) {
                if (!u.uswallow && (mtmp == u.ustuck)) {
                    if (!rn2(4)) {
                        set_ustuck(null);
                        pline(_("%s releases you!"), Monnam(mtmp));
                    } else
                        break;
                }

                /* mtmp can be killed */
                gb.bhitpos.x = mon.mx, gb.bhitpos.y = mon.my;
                gn.notonhead = FALSE;
                result = mattackm(mtmp, mon);

                if (result & M_ATTK_AGR_DIED)
                    return 1; /* mtmp died */
                /*
                 * If mtmp has the hero swallowed, lie and say there
                 * was no attack (this allows mtmp to digest the hero).
                 */
                if (has_u_swallowed)
                    return 0;

                /* allow attacked monsters a chance to hit back, primarily
                   to allow monsters that resist conflict to respond */
                if ((result & (M_ATTK_HIT | M_ATTK_DEF_DIED)) == M_ATTK_HIT
                    && rn2(4) && mon.movement > rn2(NORMAL_SPEED)) {
                    if (mon.movement > NORMAL_SPEED)
                        mon.movement -= NORMAL_SPEED;
                    else
                        mon.movement = 0;
                    gb.bhitpos.x = mtmp.mx, gb.bhitpos.y = mtmp.my;
                    gn.notonhead = FALSE;
                    mattackm(mon, mtmp); /* return attack */
                }

                return (result & M_ATTK_HIT) ? 1 : 0;
            }
        }
    }
    return 0;
}

/*
 * mdisplacem() -- attacker moves defender out of the way;
 *                 returns same results as mattackm().
 */
export function mdisplacem(
    magr,
    mdef,
    quietly) { /* int */
    let pa, pd;
    let tx, ty, fx, fy;

    /* sanity checks; could matter if we unexpectedly get a long worm */
    if (!magr || !mdef || magr == mdef)
        return M_ATTK_MISS;
    pa = magr.data, pd = mdef.data;
    tx = mdef.mx, ty = mdef.my; /* destination */
    fx = magr.mx, fy = magr.my; /* current location */
    if (m_at(fx, fy) != magr || m_at(tx, ty) != mdef)
        return M_ATTK_MISS;

    /* The 1 in 7 failure below matches the chance in do_attack()
     * for pet displacement.
     */
    if (!rn2(7))
        return M_ATTK_MISS;

    /* Grid bugs cannot displace at an angle. */
    if (pa == mons[PM_GRID_BUG] && magr.mx != mdef.mx
        && magr.my != mdef.my)
        return M_ATTK_MISS;

    /* undetected monster becomes un-hidden if it is displaced */
    if (mdef.mundetected)
        mdef.mundetected = 0;
    if (M_AP_TYPE(mdef) && M_AP_TYPE(mdef) != M_AP_MONSTER)
        seemimic(mdef);
    /* wake up the displaced defender */
    mdef.msleeping = 0;
    mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITMASK);
    finish_meating(mdef);

    /*
     * Set up the visibility of action.
     * You can observe monster displacement if you can see both of
     * the monsters involved.
     */
    gv.vis = (canspotmon(magr) && canspotmon(mdef) ? 1 : 0);

    if (touch_petrifies(pd) && !resists_ston(magr)) {
        if (!which_armor(magr, W_ARMG)) {
            if (poly_when_stoned(pa)) {
                mon_to_stone(magr);
                return M_ATTK_HIT; /* no damage during the polymorph */
            }
            if (!quietly && canspotmon(magr)) {
                if (gv.vis) {
                    pline(_("%s tries to move %s out of %s way."), Monnam(magr),
                          mon_nam(mdef), is_rider(pa) ? _("the") : mhis(magr));
                }
                pline_mon(magr, _("%s turns to stone!"), Monnam(magr));
            }
            monstone(magr);
            if (!DEADMONSTER(magr))
                return M_ATTK_HIT; /* lifesaved */
            else if (magr.mtame && !gv.vis)
                You(brief_feeling, _("peculiarly sad"));
            return M_ATTK_AGR_DIED;
        }
    }

    remove_monster(fx, fy); /* pick up from orig position */
    if (mdef.wormno)
        remove_worm(mdef);
    else
        remove_monster(tx, ty);
    place_monster(magr, tx, ty); /* put down at target spot */
    place_monster(mdef, fx, fy);
    if (mdef.wormno) /* now put down tail */
        place_worm_tail_randomly(mdef, fx, fy);
    /* either creature might move into or out of a poison gas cloud */
    update_monster_region(magr);
    update_monster_region(mdef);

    if (gv.vis && !quietly)
        pline(_("%s moves %s out of %s way!"), Monnam(magr), mon_nam(mdef),
              is_rider(pa) ? _("the") : mhis(magr));
    newsym(fx, fy);  /* see it       */
    newsym(tx, ty);  /*   all happen */
    flush_screen(0); /* make sure it shows up */

    return M_ATTK_HIT;
}

/*
 * mattackm() -- a monster attacks another monster.
 *
 *          --------- aggressor died
 *         /  ------- defender died
 *        /  /  ----- defender was hit
 *       /  /  /
 *      x  x  x
 *
 *      0x8     M_ATTK_AGR_DONE
 *      0x4     M_ATTK_AGR_DIED
 *      0x2     M_ATTK_DEF_DIED
 *      0x1     M_ATTK_HIT
 *      0x0     M_ATTK_MISS
 *
 * Each successive attack has a lower probability of hitting.  Some rely on
 * success of previous attacks.  ** this doesn't seem to be implemented -dl **
 *
 * Attacker has targeted <bhitpos.x,bhitpos.y> rather than
 * <mdef->mx,mdef->my>; matters for long worms.
 *
 * In the case of exploding monsters, the monster dies as well.
 */
export function mattackm(
    magr,
    mdef) { /* int */
    const $frame = stack_frame(); try {
    let i,
        tmp,
        strike = 0,
        attk,
        struck = 0,
        res = stack_array(int, NATTK),
        dieroll = 0;
    let mattk, alt_attk = stack_struct(struct_attack);
    let mwep;
    let pa, pd;

    if (!magr || !mdef)
        return M_ATTK_MISS; /* mike@genat */
    if (helpless(magr))
        return M_ATTK_MISS;
    pa = magr.data;
    pd = mdef.data;

    /* Grid bugs cannot attack at an angle. */
    if (pa == mons[PM_GRID_BUG] && magr.mx != mdef.mx
        && magr.my != mdef.my)
        return M_ATTK_MISS;

    /* Calculate the armour class differential. */
    tmp = find_mac(mdef) + magr.m_lev;
    if (mdef.mconf || helpless(mdef)) {
        tmp += 4;
        mdef.msleeping = 0;
    }

    /* mundetected monsters become un-hidden if they are attacked */
    if (mdef.mundetected) {
        mdef.mundetected = 0;
        newsym(mdef.mx, mdef.my);
        if (canseemon(mdef) && !sensemon(mdef)) {
            if (Unaware()) {
                let justone = +((mdef.data.geno & G_UNIQ) != 0);
                let montype;

                montype = noname_monnam(mdef, justone ? ARTICLE_THE
                                                      : ARTICLE_NONE);
                if (!justone)
                    montype = makeplural(montype);
                You(_("dream of %s."), montype);
            } else {
                if (iflags.last_msg == PLNMSG_HIDE_UNDER
                    && mdef.m_id == gl.last_hider)
                    pline_mon(mdef, _("%s emerges from hiding."), Monnam(mdef));
                else if (mdef.m_id == gl.last_hider)
                    You(_("notice %s."), mon_nam(mdef));
                else
                    pline(_("Suddenly, you notice %s."), a_monnam(mdef));
            }
        }
    }

    /* Elves hate orcs. */
    if (is_elf(pa) && is_orc(pd))
        tmp++;

    /* Set up the visibility of action */
    gv.vis = ((cansee(magr.mx, magr.my) && canspotmon(magr))
              || (cansee(mdef.mx, mdef.my) && canspotmon(mdef)) ? 1 : 0);

    /* Set flag indicating monster has moved this turn.  Necessary since a
     * monster might get an attack out of sequence (i.e. before its move) in
     * some cases, in which case this still counts as its move for the round
     * and it shouldn't move again.
     */
    magr.mlstmv = svm.moves;

    /* controls whether a mind flayer uses all of its tentacle-for-DRIN
       attacks; when fighting a headless monster, stop after the first
       one because repeating the same failing hit (or even an ordinary
       tentacle miss) is very verbose and makes the flayer look stupid */
    gs.skipdrin = FALSE;

    /* Now perform all attacks for the monster. */
    for (i = 0; i < NATTK; i++) {
        res[i] = M_ATTK_MISS;

        /* target might no longer be there */
        if (i > 0 && (m_at(gb.bhitpos.x, gb.bhitpos.y) != mdef
                      || DEADMONSTER(magr) || DEADMONSTER(mdef)))
            continue;

        mattk = getmattk(magr, mdef, i, res, alt_attk);
        /* reduce verbosity for mind flayer attacking creature without a
           head (or worm's tail); this is similar to monster with multiple
           attacks after a wildmiss against displaced or invisible hero */
        if (gs.skipdrin && mattk.aatyp == AT_TENT && mattk.adtyp == AD_DRIN)
            continue;
        mwep = null;
        attk = 1;

        switch (mattk.aatyp) {
        case AT_WEAP: /* "hand to hand" attacks */
            if (distmin(magr.mx, magr.my, mdef.mx, mdef.my) > 1) {
                /* D: Do a ranged attack here! */
                strike = (thrwmm(magr, mdef) == M_ATTK_MISS) ? 0 : 1;
                if (strike)
                    /* don't really know if we hit or not; pretend we did */
                    res[i] |= M_ATTK_HIT;
                if (DEADMONSTER(mdef))
                    res[i] = M_ATTK_DEF_DIED;
                if (DEADMONSTER(magr))
                    res[i] |= M_ATTK_AGR_DIED;
                break;
            }
            if (magr.weapon_check == NEED_WEAPON || !MON_WEP(magr)) {
                magr.weapon_check = NEED_HTH_WEAPON;
                if (mon_wield_item(magr) != 0)
                    return M_ATTK_MISS;
            }
            possibly_unwield(magr, FALSE);
            if ((mwep = MON_WEP(magr)) != null) {
                if (gv.vis)
                    mswingsm(magr, mdef, mwep);
                tmp += hitval(mwep, mdef);
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case AT_CLAW:
        case AT_KICK:
        case AT_BITE:
        case AT_STNG:
        case AT_TUCH:
        case AT_BUTT:
        case AT_TENT:
            if (mattk.aatyp == AT_KICK && mtrapped_in_pit(magr))
                    continue;
            /* Nymph that teleported away on first attack? */
            if (distmin(magr.mx, magr.my, mdef.mx, mdef.my) > 1)
                /* Continue because the monster may have a ranged attack. */
                continue;
            /* Monsters won't attack cockatrices physically if they
             * have a weapon instead.  This instinct doesn't work for
             * players, or under conflict or confusion.
             */
            if (!magr.mconf && !Conflict() && mwep && mattk.aatyp != AT_WEAP
                && touch_petrifies(mdef.data)) {
                strike = 0;
                break;
            }
            dieroll = rnd(20 + i);
            strike = +(tmp > dieroll);
            /* KMH -- don't accumulate to-hit bonuses */
            if (mwep)
                tmp -= hitval(mwep, mdef);
            if (strike) {
                /* for eel AT_TUCH+AD_WRAP attack: can't grab an unsolid
                   target; the unsolid test is redundant since failed_grab
                   checks it too, but is cheap and avoids calling failed_grab
                   for ordinary targets */
                if (unsolid(mdef.data) && failed_grab(magr, mdef, mattk)) {
                    strike = 0;
                    break;
                }
                res[i] = hitmm(magr, mdef, mattk, mwep, dieroll);
                if ((mdef.data == mons[PM_BLACK_PUDDING]
                     || mdef.data == mons[PM_BROWN_PUDDING])
                    && (mwep && (objects[mwep.otyp].oc_material == IRON
                                 || objects[mwep.otyp].oc_material == METAL))
                    && mdef.mhp > 1 && !mdef.mcan) {
                    let mclone;

                    if ((mclone = clone_mon(mdef, 0, 0)) != null) {
                        if (gv.vis && canspotmon(mdef))
                            pline(_("%s divides as %s hits it!"),
                                  Monnam(mdef), mon_nam(magr));
                        mintrap(mclone, NO_TRAP_FLAGS);
                        if (DEADMONSTER(magr))
                            res[i] |= M_ATTK_AGR_DIED;
                    }
                }
            } else
                missmm(magr, mdef, mattk);
            break;

        case AT_HUGS: /* automatic if prev two attacks succeed */
            strike = +(i >= 2 && res[i - 1] == M_ATTK_HIT
                      && res[i - 2] == M_ATTK_HIT);
            if (strike) {
                /* note: monsters with hug attacks don't wear cloaks or gloves
                   so this doesn't need a special case for hugging a shade
                   while covered by blessed armor (which does damage but does
                   not achieve a successful hold); likewise, rope golems can't
                   wield weapons so ability to choke isn't affected by such */
                if (failed_grab(magr, mdef, mattk))
                    strike = 0;
                else
                    res[i] = hitmm(magr, mdef, mattk, null, 0);
            }
            break;

        case AT_GAZE:
            strike = 0;
            res[i] = gazemm(magr, mdef, mattk);
            break;

        case AT_EXPL:
            /* D: Prevent explosions from a distance */
            if (distmin(magr.mx, magr.my, mdef.mx, mdef.my) > 1)
                continue;

            res[i] = explmm(magr, mdef, mattk);
            if (res[i] == M_ATTK_MISS) { /* cancelled--no attack */
                strike = 0;
                attk = 0;
            } else
                strike = 1; /* automatic hit */
            break;

        case AT_ENGL:
            if (mdef.data == mons[PM_SHADE]) { /* no silver teeth... */
                if (gv.vis)
                    pline(_("%s attempt to engulf %s is futile."),
                          s_suffix(Monnam(magr)), mon_nam(mdef));
                strike = 0;
                break;
            }
            if (u.usteed && mdef == u.usteed) {
                strike = 0;
                break;
            }
            /* D: Prevent engulf from a distance */
            if (distmin(magr.mx, magr.my, mdef.mx, mdef.my) > 1)
                continue;
            /* Engulfing attacks are directed at the hero if possible. -dlc */
            if (engulfing_u(magr)) {
                strike = 0;
            } else if ((strike = +(tmp > rnd(20 + i))) != 0) {
                if (failed_grab(magr, mdef, mattk))
                    strike = 0; /* purple worm can't swallow unsolid mons */
                else
                    res[i] = gulpmm(magr, mdef, mattk);
            } else {
                missmm(magr, mdef, mattk);
            }
            break;

        case AT_BREA:
        case AT_SPIT:
            /*
             * Ranged attacks aren't allowed at point blank range.
             *
             * That impacts pet use of ranged attacks.  It's rather arbitrary
             * but various parts of the code assume it to be the case, not to
             * mention a part of player tactics when fighting dragons.
             */
            if (!monnear(magr, mdef.mx, mdef.my)) {
                let mmtmp = ((mattk.aatyp == AT_BREA)
                             ? breamm(magr, mattk, mdef)
                             : spitmm(magr, mattk, mdef));

                strike = (mmtmp == M_ATTK_MISS) ? 0 : 1;
                /* We don't really know if we hit or not; pretend we did. */
                if (strike)
                    res[i] |= M_ATTK_HIT;
                if (DEADMONSTER(mdef))
                    res[i] = M_ATTK_DEF_DIED;
                if (DEADMONSTER(magr))
                    res[i] |= M_ATTK_AGR_DIED;
            } else {
                strike = 0;
                attk = 0;
            }
            break;

        default: /* no attack */
            strike = 0;
            attk = 0;
            break;
        }

        if (attk && !(res[i] & M_ATTK_AGR_DIED)
            && distmin(magr.mx, magr.my, mdef.mx, mdef.my) <= 1)
            res[i] = passivemm(magr, mdef, strike,
                               (res[i] & M_ATTK_DEF_DIED), mwep);

        if (res[i] & M_ATTK_DEF_DIED)
            return res[i];
        if (res[i] & M_ATTK_AGR_DIED)
            return res[i];
        /* return if aggressor can no longer attack */
        if ((res[i] & M_ATTK_AGR_DONE) || helpless(magr))
            return res[i];
        /* eg. defender was knocked into a level teleport trap */
        if (mon_offmap(mdef))
            return res[i];
        if (res[i] & M_ATTK_HIT)
            struck = 1; /* at least one hit */
    } /* for (;i < NATTK;) loop */

    return (struck ? M_ATTK_HIT : M_ATTK_MISS);
    } finally { stack_pop($frame); }
}

/* can't hold an unsolid target (ghosts, lights, vortices, most elementals)
   or a long worm tail */
export function failed_grab(
    magr,
    mdef,
    mattk) { /* boolean */
    const $frame = stack_frame(); try {
    if ((unsolid(mdef.data) || gn.notonhead)
        /* hug attack: most holders (owlbear, python, pit fiend, &c);
           wrap damage: eel grabbing, trapper/lurker-above engulfing;
           stick-to damage: mimic, lichen;
           digestion damage: purple worm swallowing */
        && (mattk.aatyp == AT_HUGS || mattk.adtyp == AD_WRAP
            || mattk.adtyp == AD_STCK  || mattk.adtyp == AD_DGST)) {
        if ((gv.vis && canspotmon(mdef)) /* mon-vs-mon */
            || magr == gy.youmonst || mdef == gy.youmonst) {
            let magrnam = stack_array(char, BUFSZ), mdefnam = stack_array(char, BUFSZ);
            let tailmiss = gn.notonhead;
            let verb = (mattk.adtyp == AD_DGST) ? _("gulp")
                               : (mattk.adtyp == AD_STCK) ? _("adhere")
                                 : _("grab");

            /* beware of "Foo's grab passes through Bar's ghost";
               mon_nam(x_monnam) calls s_suffix() for named ghosts and
               s_suffix() uses a single static buffer; make copies of both
               names to overcome that [note: comment predates 'tailmiss'] */
            strcpy(magrnam, (magr == gy.youmonst) ? _("Your")
                                                   : s_suffix(Monnam(magr)));
            if (!tailmiss) {
                strcpy(mdefnam, (mdef == gy.youmonst) ? _("you")
                                                       : mon_nam(mdef));
            } else {
                /* hero poly'd into long worm can't grow tail
                   so no 'youmonst' handling is needed here */
                sprintf(mdefnam, _("%s tail"), s_suffix(some_mon_nam(mdef)));
            }
            /* unsolid grab misses are actually somewhat iffy--how come
               ordinary attacks don't also pass right through? */
            pline(_("%.99s %s attempt %s %.99s!"), magrnam, verb,
                  !tailmiss ? _("passes right through") : _("fails to hold"),
                  mdefnam);
        }
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* Returns the result of mdamagem(). */
function hitmm(
    magr,
    mdef,
    mattk,
    mwep,
    dieroll) { /* int */
    const $frame = stack_frame(); try {
    let compat;
    let weaponhit = (mattk.aatyp == AT_WEAP
                         || (mattk.aatyp == AT_CLAW && mwep) ? 1 : 0),
            silverhit = (weaponhit && mwep
                         && objects[mwep.otyp].oc_material == SILVER ? 1 : 0);

    pre_mm_attack(magr, mdef);

    compat = !magr.mcan ? could_seduce(magr, mdef, mattk) : 0;
    if (!compat && shade_miss(magr, mdef, mwep, FALSE, gv.vis))
        return M_ATTK_MISS; /* bypass mdamagem() */

    if (gv.vis) {
        let buf = stack_array(char, BUFSZ), magr_name = stack_array(char, BUFSZ);

        strcpy(magr_name, Monnam(magr));
        if (compat) {
            Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s %s"), magr_name, mdef.mcansee ? _("smiles at") : _("talks to"))
;
            pline(_("%s %s %s."), buf, mon_nam(mdef),
                  (compat == 2) ? _("engagingly") : _("seductively"));
        } else {
            chars[buf + 0] = ord('\0');
            switch (mattk.aatyp) {
            case AT_BITE:
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s bites"), magr_name);
                break;
            case AT_STNG:
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s stings"), magr_name);
                break;
            case AT_BUTT:
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s butts"), magr_name);
                break;
            case AT_TUCH:
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s touches"), magr_name);
                break;
            case AT_TENT:
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s tentacles suck"), s_suffix(magr_name))
;
                break;
            case AT_HUGS:
                if (magr != u.ustuck) {
                    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s squeezes"), magr_name);
                    break;
                }
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            default:
                if (!weaponhit || !mwep || !mwep.oartifact)
                    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s hits"), magr_name);
                break;
            }
            if (chars[buf])
                pline(_("%s %s."), buf, mon_nam_too(mdef, magr));

            if (mon_hates_silver(mdef) && silverhit) {
                let mdef_name = mon_nam_too(mdef, magr);

                /* note: mon_nam_too returns a modifiable buffer; so
                   does s_suffix, but it returns a single static buffer
                   and we might be calling it twice for this message */
                strcpy(magr_name, s_suffix(magr_name));
                if (!noncorporeal(mdef.data) && !amorphous(mdef.data)) {
                    if (mdef != magr) {
                        mdef_name = s_suffix(mdef_name);
                    } else {
                        strsubst(mdef_name, _("himself"), _("his own"));
                        strsubst(mdef_name, _("herself"), _("her own"));
                        strsubst(mdef_name, _("itself"), _("its own"));
                    }
                    strcat(mdef_name, _(" flesh"));
                }

                pline(_("%s %s sears %s!"), magr_name, /* s_suffix(magr_name), */
                      simpleonames(mwep), mdef_name);
            }
        }
    } else
        noises(magr, mattk);

    return mdamagem(magr, mdef, mattk, mwep, dieroll);
    } finally { stack_pop($frame); }
}

/* Returns the same values as mdamagem(). */
function gazemm(magr, mdef, mattk) { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    /* an Archon's gaze affects target even if Archon itself is blinded */
    let archon = +(magr.data == mons[PM_ARCHON]
                      && mattk.adtyp == AD_BLND),
            altmesg = (archon && !magr.mcansee ? 1 : 0);

    /* bring target out of hiding even if hero doesn't see it happen (this
       is already done in pre_mm_attack() and shouldn't be needed here) */
    if (mdef.data.mlet == S_MIMIC && M_AP_TYPE(mdef) != M_AP_NOTHING)
        seemimic(mdef);
    mdef.mundetected = 0;

    if (gv.vis) {
        sprintf(buf, _("%s gazes %s"), altmesg ? Adjmonnam(magr, _("blinded")) : Monnam(magr), altmesg ? _("toward") : _("at"))

;
        pline(_("%s %s..."), buf,
              canspotmon(mdef) ? mon_nam(mdef) : _("something"));
    }

    if (magr.mcan || !mdef.mcansee
        || (archon ? resists_blnd(mdef) : !magr.mcansee)
        || (magr.minvis && !perceives(mdef.data)) || mdef.msleeping) {
        if (gv.vis && canspotmon(mdef))
            pline(_("but nothing happens."));
        return M_ATTK_MISS;
    }
    /* call mon_reflects 2x, first test, then, if visible, print message */
    if (magr.data == mons[PM_MEDUSA] && mon_reflects(mdef, 0)) {
        if (canseemon(mdef))
            mon_reflects(mdef, _("The gaze is reflected away by %s %s."));
        if (mdef.mcansee) {
            if (mon_reflects(magr, 0)) {
                if (canseemon(magr))
                    mon_reflects(magr,
                                      _("The gaze is reflected away by %s %s."));
                return M_ATTK_MISS;
            }
            if (mdef.minvis && !perceives(magr.data)) {
                if (canseemon(magr)) {
                    pline(
                      _("%s doesn't seem to notice that %s gaze was reflected."),
                          Monnam(magr), mhis(magr));
                }
                return M_ATTK_MISS;
            }
            if (canseemon(magr))
                pline_mon(magr, _("%s is turned to stone!"), Monnam(magr));
            monstone(magr);
            if (!DEADMONSTER(magr))
                return M_ATTK_MISS;
            return M_ATTK_AGR_DIED;
        }
    } else if (archon) {
        mhitm_ad_blnd(magr, mattk, mdef, null);
        /* an Archon's blinding radiance also stuns;
           this is different from the way the hero gets stunned because
           a stunned monster recovers randomly instead of via countdown;
           both cases make an effort to prevent the target from being
           continuously stunned due to repeated gaze attacks */
        if (rn2(2))
            mdef.mstun = 1;
    }

    return mdamagem(magr, mdef, mattk, null, 0);
    } finally { stack_pop($frame); }
}

/* return True if magr is allowed to swallow mdef, False otherwise */
export function engulf_target(magr, mdef) { /* boolean */
    let lev;
    let ax, ay, dx, dy;
    let uatk = +(magr == gy.youmonst),
            udef = +(mdef == gy.youmonst);

    /* can't swallow something that's too big */
    if (mdef.data.msize >= MZ_HUGE
        || (magr.data.msize < mdef.data.msize && !is_whirly(magr.data)))
        return FALSE;

    /* can't (move to) swallow if trapped. TODO: could do some? */
    if (mdef.mtrapped || magr.mtrapped)
        return FALSE;

    /* if attacker is phasing in solid rock and defender can't move there,
       or vice versa, don't allow engulf to succeed; otherwise expelling
       might not be able to place attacker and defender both back on map;
       when defender is the hero, a sanity_check complaint about placing
       the hero on top of a monster can occur */
    dx = (mdef == gy.youmonst) ? u.ux : mdef.mx;
    dy = (mdef == gy.youmonst) ? u.uy : mdef.my;
    lev = levl()[dx][dy];
    if (!(udef ? Passes_walls() : passes_walls(mdef.data))
          && (IS_OBSTRUCTED(lev.typ) || closed_door(dx, dy) || IS_TREE(lev.typ)
              /* not passes_bars(); engulfer isn't squeezing through */
              || (lev.typ == IRONBARS && !is_whirly(magr.data))))
        return FALSE;
    ax = (magr == gy.youmonst) ? u.ux : magr.mx;
    ay = (magr == gy.youmonst) ? u.uy : magr.my;
    lev = levl()[ax][ay];
    if (!(uatk ? Passes_walls() : passes_walls(magr.data))
        && (IS_OBSTRUCTED(lev.typ) || closed_door(ax, ay) || IS_TREE(lev.typ)
            || (lev.typ == IRONBARS && !is_whirly(mdef.data))))
        return FALSE;

    return TRUE;
}

/* Returns the same values as mattackm(). */
function gulpmm(
    magr,
    mdef,
    mattk) { /* int */
    let ax, ay, dx, dy;
    let status;
    let obj;

    if (!engulf_target(magr, mdef))
        return M_ATTK_MISS;

    if (gv.vis) {
        pline(_("%s %s %s."), Monnam(magr),
              digests(magr.data) ? _("swallows")
              : enfolds(magr.data) ? _("encloses")
                : _("engulfs"),
              mon_nam(mdef));
    }
    if (!flaming(magr.data)) {
        for (obj = mdef.minvent; obj; obj = obj.nobj)
            snuff_lit(obj);
    }

    if (is_vampshifter(mdef)
        && newcham(mdef, mons[mdef.cham], NO_NC_FLAGS)) {
        if (gv.vis) {
            /* 'it' -- previous form is no longer available and
               using that would be excessively verbose */
            pline(_("%s expels %s."), Monnam(magr),
                  canspotmon(mdef) ? _("it") : something());
            if (canspotmon(mdef)) {
                pline(_("It turns into %s."),
                      x_monnam(mdef, ARTICLE_A, 0,
                               (SUPPRESS_NAME | SUPPRESS_IT
                                | SUPPRESS_INVISIBLE), FALSE));
            }
        }
        return M_ATTK_HIT; /* bypass mdamagem() */
    }

    /*
     *  All of this manipulation is needed to keep the display correct.
     *  There is a flush at the next pline().
     */
    ax = magr.mx;
    ay = magr.my;
    dx = mdef.mx;
    dy = mdef.my;
    /*
     *  Leave the defender in the monster chain at its current position,
     *  but don't leave it on the screen.  Move the aggressor to the
     *  defender's position.
     */
    remove_monster(dx, dy);
    remove_monster(ax, ay);
    place_monster(magr, dx, dy);
    newsym(ax, ay); /* erase old position */
    newsym(dx, dy); /* update new position */

    gm.mswallower = magr; /* corpse_chance() wants this */
    status = mdamagem(magr, mdef, mattk, null, 0);
    gm.mswallower = null; /* reset */

    if ((status & (M_ATTK_AGR_DIED | M_ATTK_DEF_DIED))
        == (M_ATTK_AGR_DIED | M_ATTK_DEF_DIED)) {
        ;                              /* both died -- do nothing  */
    } else if (status & M_ATTK_DEF_DIED) { /* defender died */
        /*
         *  Note: mdamagem() -> monkilled() -> mondead() -> m_detach()
         *  -> relmon() used to call remove_monster() for the dead
         *  monster even when it wasn't the one on the map, so we
         *  needed to put magr back after mdef was killed and removed
         *  from their shared spot.  But now [5.0] relmon() calls
         *  mon_leaving_level() and that checks whether the monster at
         *  dying monster's coordinates is that dying monster and only
         *  removes it when they match.  So magr is still at mdef's
         *  former spot these days.
         *
         *  We still potentially do one fixup:  if the gulp targeted
         *  an inhospitable location, magr will return to its previous
         *  spot instead of staying.
         */
        if (!goodpos(dx, dy, magr, MM_IGNOREWATER)) {
            if (m_at(dx, dy) == magr) {
                remove_monster(dx, dy);
                newsym(dx, dy);
            }
            dx = ax, dy = ay; /* magr's spot at start of the attack */
        }
        if (m_at(dx, dy) != magr) {
            place_monster(magr, dx, dy);
            newsym(dx, dy);
        }
        /* aggressor moves to <dx,dy> and might encounter trouble there */
        if (minliquid(magr)
            || (t_at(dx, dy)
                && mintrap(magr, NO_TRAP_FLAGS) == Trap_Killed_Mon))
            status |= M_ATTK_AGR_DIED;
    } else if (status & M_ATTK_AGR_DIED) { /* aggressor died */
        place_monster(mdef, dx, dy);
        newsym(dx, dy);
    } else {                           /* both alive, put them back */
        if (cansee(dx, dy)) {
            pline(_("%s is %s!"), Monnam(mdef),
                  digests(magr.data) ? _("regurgitated")
                    : enfolds(magr.data) ? _("released")
                      : _("expelled"));
        }

        remove_monster(dx,dy);
        place_monster(magr, ax, ay);
        place_monster(mdef, dx, dy);
        newsym(ax, ay);
        newsym(dx, dy);
    }

    return status;
}

function explmm(magr, mdef, mattk) { /* int */
    let result;

    if (magr.mcan)
        return M_ATTK_MISS;

    if (cansee(magr.mx, magr.my))
        pline_mon(magr, _("%s explodes!"), Monnam(magr));
    else
        noises(magr, mattk);

    /* monster explosion types which actually create an explosion */
    if (mattk.adtyp == AD_FIRE || mattk.adtyp == AD_COLD
        || mattk.adtyp == AD_ELEC) {
        mon_explodes(magr, mattk);
        /* unconditionally set AGR_DIED here; lifesaving is accounted below */
        result = M_ATTK_AGR_DIED | (DEADMONSTER(mdef) ? M_ATTK_DEF_DIED : 0);
    } else {
        result = mdamagem(magr, mdef, mattk, null, 0);
    }

    /* Kill off aggressor if it didn't die. */
    if (!(result & M_ATTK_AGR_DIED)) {
        let was_leashed = +(magr.mleashed != 0);

        mondead(magr);
        if (!DEADMONSTER(magr))
            return result; /* life saved */
        result |= M_ATTK_AGR_DIED;

        /* mondead() -> m_detach() -> m_unleash() always suppresses
           the m_unleash() slack message, so deliver it here instead */
        if (was_leashed)
            Your(_("leash falls slack."));
    }
    if (magr.mtame) /* give this one even if it was visible */
        You(brief_feeling, _("melancholy"));

    return result;
}

/*
 *  See comment at top of mattackm(), for return values.
 */
function mdamagem(
    magr,
    mdef,
    mattk,
    mwep,
    dieroll) { /* int */
    const $frame = stack_frame(); try {
    let pa = magr.data, pd = mdef.data;
    let mhm = stack_struct(struct_mhitm_data);
    mhm.damage = d(mattk.damn, mattk.damd);
    mhm.hitflags = M_ATTK_MISS;
    mhm.permdmg = 0;
    mhm.specialdmg = 0;
    mhm.dieroll = dieroll;
    mhm.done = FALSE;

    if ((touch_petrifies(pd) /* or flesh_petrifies() */
         || (mattk.adtyp == AD_DGST && pd == mons[PM_MEDUSA]))
        && !resists_ston(magr)) {
        let protector = attk_protection(mattk.aatyp),
             wornitems = magr.misc_worn_check;

        /* wielded weapon gives same protection as gloves here */
        if (mwep)
            wornitems = or64(wornitems, W_ARMG);

        if (protector == 0
            || (protector != ~0 && and64(wornitems, protector) != protector)) {
            if (poly_when_stoned(pa)) {
                mon_to_stone(magr);
                return M_ATTK_HIT; /* no damage during the polymorph */
            }
            if (gv.vis && canspotmon(magr))
                pline_mon(magr, _("%s turns to stone!"), Monnam(magr));
            monstone(magr);
            if (!DEADMONSTER(magr))
                return M_ATTK_HIT; /* lifesaved */
            else if (magr.mtame && !gv.vis)
                You(brief_feeling, _("peculiarly sad"));
            return M_ATTK_AGR_DIED;
        }
    }

    mhitm_adtyping(magr, mattk, mdef, mhm);

    if (mhitm_knockback(magr, mdef, mattk, ref_of(mhm, "hitflags"),
                        +(MON_WEP(magr) != null))
        && ((mhm.hitflags & (M_ATTK_DEF_DIED | M_ATTK_HIT)) != 0
            || mon_offmap(mdef)))
        return mhm.hitflags;

    if (mhm.done)
        return mhm.hitflags;

    if (!mhm.damage)
        return mhm.hitflags;

    mdef.mhp -= mhm.damage;
    if (mdef.mhp < 1) {
        if (m_at(mdef.mx, mdef.my) == magr) { /* see gulpmm() */
            remove_monster(mdef.mx, mdef.my);
            mdef.mhp = 1; /* otherwise place_monster will complain */
            place_monster(mdef, mdef.mx, mdef.my);
            mdef.mhp = 0;
        }
        if (mattk.aatyp == AT_WEAP || mattk.aatyp == AT_CLAW)
            gm.mkcorpstat_norevive = troll_baned(mdef, mwep) ? TRUE : FALSE;
        gz.zombify = (!mwep && zombie_maker(magr)
                     && (mattk.aatyp == AT_TUCH
                         || mattk.aatyp == AT_CLAW
                         || mattk.aatyp == AT_BITE)
                     && zombie_form(mdef.data) != NON_PM ? 1 : 0);
        monkilled(mdef, _(""), mattk.adtyp);
        gz.zombify = FALSE; /* reset */
        gm.mkcorpstat_norevive = FALSE;
        if (!DEADMONSTER(mdef))
            return mhm.hitflags; /* mdef lifesaved */
        else if (mhm.hitflags == M_ATTK_AGR_DIED)
            return (M_ATTK_DEF_DIED | M_ATTK_AGR_DIED);

        if (mattk.adtyp == AD_DGST) {
            /* various checks similar to dog_eat and meatobj.
             * after monkilled() to provide better message ordering */
            if (ismnum(mdef.cham)) {
                newcham(magr, null, NC_SHOW_MSG);
            } else if (pd == mons[PM_GREEN_SLIME] && !slimeproof(pa)) {
                newcham(magr, mons[PM_GREEN_SLIME], NC_SHOW_MSG);
            } else if (pd == mons[PM_WRAITH]) {
                grow_up(magr, null);
                /* don't grow up twice */
                return (M_ATTK_DEF_DIED
                        | (!DEADMONSTER(magr) ? 0 : M_ATTK_AGR_DIED));
            } else if (pd == mons[PM_NURSE]) {
                healmon(magr, magr.mhpmax, 0);
            }
            mon_givit(magr, pd);
        }
        /* caveat: above digestion handling doesn't keep `pa' up to date */

        return (M_ATTK_DEF_DIED
                | (grow_up(magr, mdef) ? 0 : M_ATTK_AGR_DIED));
    }
    return (mhm.hitflags == M_ATTK_AGR_DIED) ? M_ATTK_AGR_DIED : M_ATTK_HIT;
    } finally { stack_pop($frame); }
}

export function mon_poly(magr, mdef, dmg) { /* int */
    const $frame = stack_frame(); try {
    let freaky = init_string(static_array("mon_poly.freaky", char, sizeof_string(" undergoes a freakish metamorphosis")), _(" undergoes a freakish metamorphosis"), true);
    let oldform = mdef.data;

    if (mdef == gy.youmonst) {
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
        } else if (Unchanging()) {
            ; /* just take a little damage */
        } else {
            /* system shock might take place in polyself() */
            if (u.ulycn == NON_PM) {
                You(_("are subjected to a freakish metamorphosis."));
                polyself(POLY_NOFLAGS);
            } else if (u.umonnum != u.ulycn) {
                You_feel(_("an unnatural urge coming on."));
                you_were();
            } else {
                You_feel(_("a natural urge coming on."));
                you_unwere(FALSE);
            }
            dmg = 0;
        }
    } else {
        let Before = stack_array(char, BUFSZ);

        strcpy(Before, Monnam(mdef));
        if (resists_magm(mdef)) {
            /* Magic resistance */
            if (gv.vis)
                shieldeff_mon(mdef);
        } else if (resist(mdef, WAND_CLASS, 0, TELL)) {
            /* general resistance to magic... */
            ;
        } else if (!rn2(25) && mdef.cham == NON_PM
                   && (mdef.mcan
                       || pm_to_cham(monsndx(mdef.data)) != NON_PM)) {
            /* system shock; this variation takes away half of mon's HP
               rather than kill outright */
            if (gv.vis)
                pline(_("%s shudders!"), Before);

            dmg += Math.trunc((mdef.mhpmax + 1) / 2);
            mdef.mhp -= dmg;
            dmg = 0;
            if (DEADMONSTER(mdef)) {
                if (magr == gy.youmonst)
                    xkilled(mdef, XKILL_GIVEMSG | XKILL_NOCORPSE);
                else
                    monkilled(mdef, _(""), AD_RBRE);
            }
        } else if (newcham(mdef, null, NO_NC_FLAGS)) {
            if (gv.vis) { /* either seen or adjacent */
                let was_seen = +!!strncmpi(_(("It")), (Before), -1),
                        verbosely = (flags.verbose || !was_seen ? 1 : 0);

                if (canspotmon(mdef))
                    pline(_("%s%s%s turns into %s."), Before,
                          verbosely ? freaky : _(""), verbosely ? _(" and") : _(""),
                          x_monnam(mdef, ARTICLE_A, 0,
                                   (SUPPRESS_NAME | SUPPRESS_IT
                                    | SUPPRESS_INVISIBLE), FALSE));
                else if (was_seen || magr == gy.youmonst)
                    pline(_("%s%s%s."), Before, freaky,
                          !was_seen ? _("") : _(" and disappears"));
            }
            dmg = 0;
            if (can_teleport(magr.data)) {
                if (magr == gy.youmonst)
                    tele();
                else if (!tele_restrict(magr))
                    rloc(magr, RLOC_MSG);
            }
        } else {
            if (gv.vis && flags.verbose)
                pline1(nothing_happens());
        }
    }
    /* when a transformation has happened, can't attack again for poly
       effect during next turn or two; not enforced for poly'd hero */
    if (mdef.data != oldform && magr != gy.youmonst)
        magr.mspec_used += rnd(2);

    return dmg;
    } finally { stack_pop($frame); }
}

export function paralyze_monst(mon, amt) { /* void */
    if (amt > 127)
        amt = 127;

    mon.mcanmove = 0;
    mon.mfrozen = unsigned(amt);
    mon.meating = 0; /* terminate any meal-in-progress */
    mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITFORU);
}

/* `mon' is hit by a sleep attack; return 1 if it's affected, 0 otherwise */
export function sleep_monst(mon, amt, how) { /* int */
    /* reveal mimic unless already asleep or paralyzed (won't be 'busy') */
    if (how >= 0 && !mon.msleeping && !mon.mfrozen
        && mon.data.mlet == S_MIMIC && (M_AP_TYPE(mon) == M_AP_FURNITURE
                                          || M_AP_TYPE(mon) == M_AP_OBJECT))
        seemimic(mon);

    if (resists_sleep(mon) || defended(mon, AD_SLEE)
        || (how >= 0 && resist(mon, char(how), 0, NOTELL))) {
        shieldeff(mon.mx, mon.my);
    } else if (mon.mcanmove) {
        finish_meating(mon); /* terminate any meal-in-progress */
        amt += mon.mfrozen;
        if (amt > 0) { /* sleep for N turns */
            mon.mcanmove = 0;
            mon.mfrozen = unsigned(min(amt, 127));
        } else { /* sleep until awakened */
            mon.msleeping = 1;
        }
        return 1;
    }
    return 0;
}

/* sleeping grabber releases, engulfer doesn't; don't use for paralysis! */
export function slept_monst(mon) { /* void */
    if (helpless(mon) && mon == u.ustuck
        && !sticks(gy.youmonst.data) && !u.uswallow) {
        pline_mon(mon, _("%s grip relaxes."), s_suffix(Monnam(mon)));
        unstuck(mon);
    }
}

export function rustm(mdef, obj) { /* void */
    let dmgtyp = ERODE_NONE, chance = 1;

    if (!mdef || !obj)
        return; /* just in case */
    /* AD_ACID and AD_ENCH are handled in passivemm() and passiveum() */
    if (dmgtype(mdef.data, AD_CORR)) {
        dmgtyp = ERODE_CORRODE;
    } else if (dmgtype(mdef.data, AD_RUST)) {
        dmgtyp = ERODE_RUST;
    } else if (dmgtype(mdef.data, AD_FIRE)
               /* steam vortex: fire resist applies, fire damage doesn't */
               && mdef.data != mons[PM_STEAM_VORTEX]) {
        dmgtyp = ERODE_BURN;
        chance = 6;
    }

    if (dmgtyp != ERODE_NONE && !rn2(chance))
        erode_obj(obj, 0, dmgtyp, EF_GREASE | EF_VERBOSE);
}

function mswingsm(
    magr,
    mdef,
    otemp) { /* void */ /* attacker's weapon */
    if (flags.verbose && !Blind() && mon_visible(magr)) {
        let bash = (is_pole(otemp) && !is_art(otemp, ART_SNICKERSNEE)
                        && (dist2(magr.mx, magr.my, mdef.mx, mdef.my)
                            <= 2) ? 1 : 0);

        pline(_("%s %s %s%s %s at %s."), Monnam(magr), mswings_verb(otemp, bash),
              (otemp.quan > 1) ? _("one of ") : _(""), mhis(magr), xname(otemp),
              mon_nam(mdef));
    }
}

/*
 * Passive responses by defenders.  Does not replicate responses already
 * handled above.  Returns same values as mattackm.
 */
function passivemm(
    magr,
    mdef,
    mhitb,
    mdead,
    mwep) { /* int */
    const $frame = stack_frame(); try {
    var mddat = mdef.data;
    var madat = magr.data;
    var buf = stack_array(char, BUFSZ);
    var i, tmp;
    var mhit = mhitb ? M_ATTK_HIT : M_ATTK_MISS;

    for (i = 0;; i++) {
        if (i >= NATTK)
            return (mdead | mhit); /* no passive attacks */
        if (mddat.mattk[i].aatyp == AT_NONE)
            break;
    }
    if (mddat.mattk[i].damn)
        tmp = d((mddat.mattk[i].damn), (mddat.mattk[i].damd));
    else if (mddat.mattk[i].damd)
        tmp = d(mddat.mlevel + 1, (mddat.mattk[i].damd));
    else
        tmp = 0;

    /* These affect the enemy even if defender killed */
    assess_dmg: { switch (mddat.mattk[i].adtyp) {
    case AD_ACID:
        if (mhitb && !rn2(2)) {
            strcpy(buf, Monnam(magr));
            if (canseemon(magr))
                pline(_("%s is splashed by %s %s!"), buf,
                      s_suffix(mon_nam(mdef)), hliquid(_("acid")));
            if (resists_acid(magr)) {
                if (canseemon(magr))
                    pline(_("%s is not affected."), Monnam(magr));
                tmp = 0;
            }
        } else
            tmp = 0;
        if (!rn2(30))
            erode_armor(magr, ERODE_CORRODE);
        if (!rn2(6))
            acid_damage(MON_WEP(magr));
        break assess_dmg;
    case AD_ENCH: /* KMH -- remove enchantment (disenchanter) */
        if (mhitb && !mdef.mcan && mwep) {
            drain_item(mwep, FALSE);
            /* No message */
        }
        break;
    default:
        break;
    }
    if (mdead || mdef.mcan)
        return (mdead | mhit);

    /* These affect the enemy only if defender is still alive */
    if (rn2(3))
        switch (mddat.mattk[i].adtyp) {
        case AD_PLYS: /* Floating eye */
            if (tmp > 127)
                tmp = 127;
            if (mddat == mons[PM_FLOATING_EYE]) {
                if (!rn2(4))
                    tmp = 127;
                if (magr.mcansee && haseyes(madat) && mdef.mcansee
                    && (perceives(madat) || !mdef.minvis)) {
                    /* construct format string; guard against '%' in Monnam */
                    strcpy(buf, s_suffix(Monnam(mdef)));
                    strNsubst(buf, _("%"), _("%%"), 0);
                    strcat(buf, _(" gaze is reflected by %s %s."));
                    if (mon_reflects(magr,
                                     canseemon(magr) ? buf : 0))
                        return (mdead | mhit);
                    strcpy(buf, Monnam(magr));
                    if (canseemon(magr))
                        pline(_("%s is frozen by %s gaze!"), buf,
                              s_suffix(mon_nam(mdef)));
                    paralyze_monst(magr, tmp);
                    return (mdead | mhit);
                }
            } else { /* gelatinous cube */
                strcpy(buf, Monnam(magr));
                if (canseemon(magr))
                    pline(_("%s is frozen by %s."), buf, mon_nam(mdef));
                paralyze_monst(magr, tmp);
                return (mdead | mhit);
            }
            return 1;
        case AD_COLD:
            if (resists_cold(magr)) {
                if (canseemon(magr)) {
                    pline_mon(magr, _("%s is mildly chilly."), Monnam(magr));
                    golemeffects(magr, AD_COLD, tmp);
                }
                tmp = 0;
                break;
            }
            if (canseemon(magr))
                pline_mon(magr, _("%s is suddenly very cold!"), Monnam(magr));
            healmon(mdef, Math.trunc(tmp/2), Math.trunc(tmp/2));
            if (mdef.mhpmax > ((mdef.m_lev + 1) * 8))
                split_mon(mdef, magr);
            break;
        case AD_STUN:
            if (!magr.mstun) {
                magr.mstun = 1;
                if (canseemon(magr))
                    pline_mon(magr, _("%s %s..."), Monnam(magr),
                          makeplural(stagger(magr.data, _("stagger"))));
            }
            tmp = 0;
            break;
        case AD_FIRE:
            if (resists_fire(magr)) {
                if (canseemon(magr)) {
                    pline_mon(magr, _("%s is mildly warmed."), Monnam(magr));
                    golemeffects(magr, AD_FIRE, tmp);
                }
                tmp = 0;
                break;
            }
            if (canseemon(magr))
                pline_mon(magr, _("%s is suddenly very hot!"), Monnam(magr));
            break;
        case AD_ELEC:
            if (resists_elec(magr)) {
                if (canseemon(magr)) {
                    pline_mon(magr, _("%s is mildly tingled."), Monnam(magr));
                    golemeffects(magr, AD_ELEC, tmp);
                }
                tmp = 0;
                break;
            }
            if (canseemon(magr))
                pline_mon(magr, _("%s is jolted with electricity!"),
                          Monnam(magr));
            break;
        default:
            tmp = 0;
            break;
        }
    else
        tmp = 0;
 }
    if ((magr.mhp -= tmp) <= 0) {
        monkilled(magr, _(""), (mddat.mattk[i].adtyp));
        return (mdead | mhit | M_ATTK_AGR_DIED);
    }
    return (mdead | mhit);
    } finally { stack_pop($frame); }
}

/* hero or monster has successfully hit target mon with drain energy attack */
export function xdrainenergym(mon, givemsg) { /* void */
    if (mon.mspec_used < 20 /* limit draining */
        && (attacktype(mon.data, AT_MAGC)
            || attacktype(mon.data, AT_BREA))) {
        mon.mspec_used += d(2, 2);
        if (givemsg)
            pline_mon(mon, _("%s seems lethargic."), Monnam(mon));
    }
}

/* "aggressive defense"; what type of armor prevents specified attack
   from touching its target? */
export function attk_protection(aatyp) { /* long long */
    let w_mask = 0;

    switch (aatyp) {
    case AT_NONE:
    case AT_SPIT:
    case AT_EXPL:
    case AT_BOOM:
    case AT_GAZE:
    case AT_BREA:
    case AT_MAGC:
        w_mask = ~0; /* special case; no defense needed */
        break;
    case AT_CLAW:
    case AT_TUCH:
    case AT_WEAP:
        w_mask = W_ARMG; /* caller needs to check for weapon */
        break;
    case AT_KICK:
        w_mask = W_ARMF;
        break;
    case AT_BUTT:
        w_mask = W_ARMH;
        break;
    case AT_HUGS:
        w_mask = (W_ARMC | W_ARMG); /* attacker needs both to be protected */
        break;
    case AT_BITE:
    case AT_STNG:
    case AT_ENGL:
    case AT_TENT:
    default:
        w_mask = 0; /* no defense available */
        break;
    }
    return w_mask;
}

/*mhitm.c*/

import { ART_SNICKERSNEE } from "./artilist.h.js";
import { nothing_happens, something } from "./decl.h.macros.js";
import { S_MIMIC, WAND_CLASS } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { PLNMSG_HIDE_UNDER } from "./flag.h.js";
import { BUFSZ, FALSE, TRUE } from "./global.h.js";
import {
    ARTICLE_A, ARTICLE_NONE, ARTICLE_THE, MM_IGNOREWATER, NC_SHOW_MSG, NOTELL, NO_NC_FLAGS,
    NO_TRAP_FLAGS, POLY_NOFLAGS, RLOC_MSG, SUPPRESS_INVISIBLE, SUPPRESS_IT, SUPPRESS_NAME, TELL,
    XKILL_GIVEMSG, XKILL_NOCORPSE,
} from "./hack.h.js";
import { mdistu, min, pline1 } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    AD_ACID, AD_BLND, AD_COLD, AD_CORR, AD_DGST, AD_DRIN, AD_ELEC, AD_ENCH, AD_FIRE, AD_PLYS,
    AD_RBRE, AD_RUST, AD_SLEE, AD_STCK, AD_STUN, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT,
    AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG,
    AT_TENT, AT_TUCH, AT_WEAP, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT,
    M_ATTK_MISS, struct_mhitm_data,
} from "./monattk.h.js";
import {
    amorphous, can_teleport, digests, enfolds, flaming, haseyes, is_elf, is_orc, is_rider,
    is_whirly, monsndx, noncorporeal, passes_walls, perceives, slimeproof, touch_petrifies, unsolid,
} from "./mondata.h.macros.js";
import { G_UNIQ, MZ_HUGE } from "./monflag.h.js";
import {
    M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, NEED_HTH_WEAPON, NEED_WEAPON,
    STRAT_WAITFORU, STRAT_WAITMASK,
} from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, M_AP_TYPE, engulfing_u, helpless, is_vampshifter, ismnum, mon_offmap,
    resists_acid, resists_cold, resists_elec, resists_fire, resists_sleep, resists_ston,
    troll_baned,
} from "./monst.h.macros.js";
import {
    NON_PM, PM_ARCHON, PM_BLACK_PUDDING, PM_BROWN_PUDDING, PM_FLOATING_EYE, PM_GREEN_SLIME,
    PM_GRID_BUG, PM_MEDUSA, PM_NURSE, PM_SHADE, PM_STEAM_VORTEX, PM_WRAITH,
} from "./monsters.h.js";
import {
    EF_GREASE, EF_VERBOSE, ERODE_BURN, ERODE_CORRODE, ERODE_NONE, ERODE_RUST,
} from "./obj.h.js";
import { is_pole } from "./obj.h.macros.js";
import { IRON, METAL, SILVER } from "./objclass.h.js";
import { NATTK, NORMAL_SPEED, struct_attack } from "./permonst.h.js";
import { W_ARMC, W_ARMF, W_ARMG, W_ARMH } from "./prop.h.js";
import { IRONBARS } from "./rm.h.js";
import { IS_OBSTRUCTED, IS_TREE, fmon, levl, m_at, remove_monster } from "./rm.h.macros.js";
import { Trap_Killed_Mon } from "./trap.h.js";
import { cansee } from "./vision.h.macros.js";
import { mhis } from "./you.h.macros.js";
import {
    Antimagic, Blind, Conflict, Deaf, Passes_walls, Unaware, Unchanging,
} from "./youprop.h.macros.js";
import { char, int, ord, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, and64u, or64 } from "../rt/int64.js";
import { sprintf, strcat, strcpy } from "../rt/libc.js";
import { init_string, stack_array, stack_struct, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, ref_of } from "../rt/struct.js";
import { snuff_lit } from "./apply.js";
import { is_art } from "./artifact.js";
import { flags, gb, gf, gl, gm, gn, gs, gv, gy, gz, iflags, svm, u } from "./decl.js";
import {
    canseemon, flush_screen, map_invisible, mon_visible, newsym, sensemon, shieldeff,
} from "./display.js";
import {
    Adjmonnam, Monnam, a_monnam, hliquid, mon_nam, mon_nam_too, noname_monnam, some_mon_nam,
    x_monnam,
} from "./do_name.js";
import { finish_meating } from "./dogmove.js";
import { mon_explodes } from "./explode.js";
import { dist2, distmin, s_suffix, strNsubst, strncmpi, strsubst } from "./hacklib.js";
import { clone_mon, grow_up } from "./makemon.js";
import { could_seduce, getmattk, mswings_verb, mtrapped_in_pit } from "./mhitu.js";
import {
    golemeffects, healmon, minliquid, mon_givit, mon_to_stone, mondead, monkilled, monnear,
    monstone, newcham, pm_to_cham, seemimic, set_ustuck, shieldeff_mon, unstuck, xkilled,
    zombie_form, zombie_maker,
} from "./mon.js";
import {
    attacktype, defended, dmgtype, mon_hates_silver, poly_when_stoned, resist_conflict,
    resists_blnd, resists_magm, stagger, sticks,
} from "./mondata.js";
import { closed_door, itsstuck } from "./monmove.js";
import { mons } from "./monst.js";
import { breamm, spitmm, thrwmm } from "./mthrowu.js";
import { mon_reflects } from "./muse.js";
import { objects } from "./objects.js";
import { makeplural, simpleonames, xname } from "./objnam.js";
import { You, You_feel, You_hear, Your, pline, pline_mon } from "./pline.js";
import { polyself } from "./polyself.js";
import { split_mon } from "./potion.js";
import { update_monster_region } from "./region.js";
import { d, rn2, rnd } from "./rnd.js";
import { place_monster } from "./steed.js";
import { goodpos, rloc, tele, tele_restrict } from "./teleport.js";
import { acid_damage, erode_obj, mintrap, t_at } from "./trap.js";
import {
    erode_armor, mhitm_ad_blnd, mhitm_adtyping, mhitm_knockback, shade_miss,
} from "./uhitm.js";
import { hitval, mon_wield_item, possibly_unwield } from "./weapon.js";
import { you_unwere, you_were } from "./were.js";
import { place_worm_tail_randomly, remove_worm } from "./worm.js";
import { find_mac, which_armor } from "./worn.js";
import { drain_item, resist } from "./zap.js";
