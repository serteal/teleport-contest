/* NetHack 5.0	uhitm.c	$NHDT-Date: 1752823766 2025/07/17 23:29:26 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.477 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

const brief_feeling = init_string(static_array("uhitm.c/brief_feeling", char, sizeof_string("have a %s feeling for a moment, then it passes.")), _("have a %s feeling for a moment, then it passes."), true);

/* hitum_cleave() has contradictory information. There's a comment
 * beside the 1st arg 'target' stating non-null, but later on there
 * is a test for 'target' being null */

export function PROJECTILE(obj) { return (obj && is_ammo(obj) ? 1 : 0); }

function mhitm_mgc_atk_negated(
    magr, mdef,
    verbosely) { /* boolean */ /* give mesg if magical cancellation prevents damage */
    let armpro;
    let negated;

    /* mcan doesn't apply to youmonst; hero can't be cancelled */
    if (magr != gy.youmonst && magr.mcan)
        return TRUE; /* no message if attacker has been cancelled */

    armpro = magic_negation(mdef);
    negated = +!(rn2(10) >= 3 * armpro);
    if (negated) {
        /* attack has been thwarted by negation, aka magical cancellation */
        if (verbosely) {
            if (mdef == gy.youmonst)
                You(_("avoid harm."));
            else if (gv.vis && canseemon(mdef))
                pline_mon(mdef, _("%s avoids harm."), Monnam(mdef));
        }
        return TRUE;
    }
    return FALSE;
}

/* multi_reason is usually a literal string; here we generate one that
   has the causing monster's type included */
export function dynamic_multi_reason(mon, verb, by_gaze) { /* void */
    /* combination of noname_monnam() and m_monnam(), more or less;
       accurate regardless of visibility or hallucination (only seen
       if game ends) and without personal name (M2_PNAME excepted) */
    let who = x_monnam(mon, ARTICLE_A, 0,
                         (SUPPRESS_IT | SUPPRESS_INVISIBLE
                          | SUPPRESS_HALLUCINATION | SUPPRESS_SADDLE
                          | SUPPRESS_NAME),
                         FALSE),
         p = gm.multireasonbuf;

    /* prefix info for done_in_by() */
    sprintf(p, _("%u:"), mon.m_id);
    p = eos(p);
    sprintf(p, _("%s by %s%s"), verb, !by_gaze ? who : s_suffix(who), !by_gaze ? _("") : _(" gaze"))

;
    gm.multi_reason = p;
}

export function erode_armor(mdef, hurt) { /* void */
    let target;

    /* What the following code does: it keeps looping until it
     * finds a target for the rust monster.
     * Head, feet, etc... not covered by metal, or covered by
     * rusty metal, are not targets.  However, your body always
     * is, no matter what covers it.
     */
    while (1) {
        switch (rn2(5)) {
        case 0:
            target = which_armor(mdef, W_ARMH);
            if (!target
                || erode_obj(target, xname(target), hurt, EF_GREASE)
                       == ER_NOTHING)
                continue;
            break;
        case 1:
            target = which_armor(mdef, W_ARMC);
            if (target) {
                erode_obj(target, xname(target), hurt,
                                 EF_GREASE | EF_VERBOSE);
                break;
            }
            if ((target = which_armor(mdef, W_ARM)) != null) {
                erode_obj(target, xname(target), hurt,
                                 EF_GREASE | EF_VERBOSE);
            } else if ((target = which_armor(mdef, W_ARMU))
                       != null) {
                erode_obj(target, xname(target), hurt,
                                 EF_GREASE | EF_VERBOSE);
            }
            break;
        case 2:
            target = which_armor(mdef, W_ARMS);
            if (!target
                || erode_obj(target, xname(target), hurt, EF_GREASE)
                       == ER_NOTHING)
                continue;
            break;
        case 3:
            target = which_armor(mdef, W_ARMG);
            if (!target
                || erode_obj(target, xname(target), hurt, EF_GREASE)
                       == ER_NOTHING)
                continue;
            break;
        case 4:
            target = which_armor(mdef, W_ARMF);
            if (!target
                || erode_obj(target, xname(target), hurt, EF_GREASE)
                       == ER_NOTHING)
                continue;
            break;
        }
        break; /* Out of while loop */
    }
}

/* FALSE means it's OK to attack */
export function attack_checks(
    mtmp,
    wep) { /* boolean */ /* uwep for do_attack(), null for kick_monster() */
    const $frame = stack_frame(); try {
    let glyph;

    /* if you're close enough to attack, alert any waiting monster */
    mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);

    if (engulfing_u(mtmp))
        return FALSE;

    if (svc.context.forcefight) {
        /* Do this in the caller, after we have checked that the monster
         * didn't die from the blow.  Reason: putting the 'I' there
         * causes the hero to forget the square's contents since
         * both 'I' and remembered contents are stored in .glyph.
         * If the monster dies immediately from the blow, the 'I' will
         * not stay there, so the player will have suddenly forgotten
         * the square's contents for no apparent reason.
        if (!canspotmon(mtmp)
            && !glyph_is_invisible(levl[gb.bhitpos.x][gb.bhitpos.y].glyph))
            map_invisible(gb.bhitpos.x, gb.bhitpos.y);
         */
        return FALSE;
    }

    /* cache the shown glyph;
       cases which might change it (by placing or removing
       'remembered, unseen monster' glyph or revealing a mimic)
       always return without further reference to this */
    glyph = glyph_at(gb.bhitpos.x, gb.bhitpos.y);

    /* Put up an invisible monster marker, but with exceptions for
     * monsters that hide and monsters you've been warned about.
     * The former already prints a warning message and
     * prevents you from hitting the monster just via the hidden monster
     * code below; if we also did that here, similar behavior would be
     * happening two turns in a row.  The latter shows a glyph on
     * the screen, so you know something is there.
     */
    if (!canspotmon(mtmp)
        && !glyph_is_warning(glyph) && !glyph_is_invisible(glyph)
        && !(!Blind() && mtmp.mundetected && hides_under(mtmp.data))) {
        pline(_("Wait!  There's %s there you can't see!"), something());
        map_invisible(gb.bhitpos.x, gb.bhitpos.y);
        /* if it was an invisible mimic, treat it as if we stumbled
         * onto a visible mimic
         */
        if (M_AP_TYPE(mtmp) && !Protection_from_shape_changers()) {
            if (!u.ustuck && !mtmp.mflee && dmgtype(mtmp.data, AD_STCK)
                /* applied pole-arm attack is too far to get stuck */
                && m_next2u(mtmp))
                set_ustuck(mtmp);
        }
        /* #H7329 - if hero is on engraved "Elbereth", this will end up
         * assessing an alignment penalty and removing the engraving
         * even though no attack actually occurs.  Since it also angers
         * peacefuls, we're operating as if an attack attempt did occur
         * and the Elbereth behavior is consistent.
         */
        wakeup(mtmp, TRUE); /* always necessary; also un-mimics mimics */
        return TRUE;
    }

    if (M_AP_TYPE(mtmp) && !Protection_from_shape_changers() && !sensemon(mtmp)
        && !glyph_is_warning(glyph)) {
        /* If a hidden mimic was in a square where a player remembers
         * some (probably different) unseen monster, the player is in
         * luck--he attacks it even though it's hidden.
         */
        if (glyph_is_invisible(glyph)) {
            seemimic(mtmp);
            return FALSE;
        }
        stumble_onto_mimic(mtmp);
        return TRUE;
    }

    if (mtmp.mundetected && !canseemon(mtmp)
        && !glyph_is_warning(glyph)
        && (hides_under(mtmp.data) || mtmp.data.mlet == S_EEL)) {
        mtmp.mundetected = mtmp.msleeping = 0;
        newsym(mtmp.mx, mtmp.my);
        if (glyph_is_invisible(glyph)) {
            seemimic(mtmp);
            return FALSE;
        }
        if (!tp_sensemon(mtmp) && !Detect_monsters()) {
            let obj;
            let lmonbuf = stack_array(char, BUFSZ);
            let notseen;

            strcpy(lmonbuf, l_monnam(mtmp));
            /* might be unseen if invisible and hero can't see invisible */
            notseen = +!strcmp(lmonbuf, _("it")); /* note: not strcmpi() */
            if (!Blind() && Hallucination())
                pline(_("A %s %s %s!"), mtmp.mtame ? _("tame") : _("wild"),
                      notseen ? _("creature") : lmonbuf,
                      notseen ? _("is present") : _("appears"));
            else if (Blind() || (is_pool(mtmp.mx, mtmp.my) && !Underwater()))
                pline(_("Wait!  There's a hidden monster there!"));
            else if ((obj = svl.level.objects[mtmp.mx][mtmp.my]) != null)
                pline(_("Wait!  There's %s hiding under %s!"),
                      notseen ? something() : an(lmonbuf),
                      doname(obj));
            return TRUE;
        }
    }

    /*
     * make sure to wake up a monster from the above cases if the
     * hero can sense that the monster is there.
     */
    if ((mtmp.mundetected || M_AP_TYPE(mtmp)) && sensemon(mtmp)) {
        mtmp.mundetected = 0;
        wakeup(mtmp, TRUE);
    }

    if (flags.confirm && mtmp.mpeaceful
        && !Confusion() && !Hallucination() && !Stunned()) {
        /* Intelligent chaotic weapons (Stormbringer) want blood */
        if (is_art(wep, ART_STORMBRINGER)) {
            go.override_confirmation = TRUE;
            return FALSE;
        }
        if (canspotmon(mtmp)) {
            let qbuf = stack_array(char, QBUFSZ);

            sprintf(qbuf, _("Really attack %s?"), mon_nam(mtmp));
            if (!paranoid_query(ParanoidHit(), qbuf)) {
                svc.context.move = 0;
                return TRUE;
            }
        }
    }

    return FALSE;
    } finally { stack_pop($frame); }
}

/* it is unchivalrous for a knight to attack the defenseless or from behind */
export function check_caitiff(mtmp) { /* void */
    if (u.ualign.record <= -10)
        return;

    if (Role_if(PM_KNIGHT) && u.ualign.type == A_LAWFUL
        && !is_undead(mtmp.data)
        && (helpless(mtmp)
            || (mtmp.mflee && !mtmp.mavenge))) {
        You(_("caitiff!"));
        adjalign(-1);
    } else if (Role_if(PM_SAMURAI) && mtmp.mpeaceful) {
        /* attacking peaceful creatures is bad for the samurai's giri */
        You(_("dishonorably attack the innocent!"));
        adjalign(-1);
    }
}

/* maybe unparalyze monster */
export function mon_maybe_unparalyze(mtmp) { /* void */
    if (!mtmp.mcanmove) {
        if (!rn2(10)) {
            mtmp.mcanmove = 1;
            mtmp.mfrozen = 0;
        }
    }
}

/* how easy it is for hero to hit a monster,
   using attack type aatyp and/or weapon.
   larger value == easier to hit */
export function find_roll_to_hit(
    mtmp,
    aatyp,
    weapon,
    attk_count,
    role_roll_penalty) { /* int */
    let tmp, tmp2;

    role_roll_penalty[0] = 0; /* default is `none' */

    tmp = 1 + abon() + find_mac(mtmp) + u.uhitinc
          + (sgn(Luck()) * Math.trunc((abs(Luck()) + 2) / 3))
          + (Upolyd() ? (gy.youmonst.data.mlevel) : (u.ulevel));

    /* some actions should occur only once during multiple attacks */
    if (!(attk_count[0])++) {
        /* knight's chivalry or samurai's giri */
        check_caitiff(mtmp);
    }

    /* adjust vs. monster state */
    if (mtmp.mstun)
        tmp += 2;
    if (mtmp.mflee)
        tmp += 2;
    if (mtmp.msleeping)
        tmp += 2;
    if (!mtmp.mcanmove)
        tmp += 4;

    /* role/race adjustments */
    if (Role_if(PM_MONK) && !Upolyd()) {
        if (uarm)
            tmp -= (role_roll_penalty[0] = gu.urole.spelarmr);
        else if (!uwep && !uarms)
            tmp += Math.trunc(u.ulevel / 3) + 2;
    }
    if (is_orc(mtmp.data)
        && (Upolyd() ? (is_elf(gy.youmonst.data)) : (Race_if(PM_ELF))))
        tmp++;

    /* encumbrance: with a lot of luggage, your agility diminishes */
    if ((tmp2 = near_capacity()) != 0)
        tmp -= (tmp2 * 2) - 1;
    if (u.utrap)
        tmp -= 3;

    /*
     * hitval applies if making a weapon attack while wielding a weapon;
     * weapon_hit_bonus applies if doing a weapon attack even bare-handed
     * or if kicking as martial artist
     */
    if (aatyp == AT_WEAP || aatyp == AT_CLAW) {
        if (weapon)
            tmp += hitval(weapon, mtmp);
        tmp += weapon_hit_bonus(weapon);
    } else if (aatyp == AT_KICK && martial_bonus()) {
        tmp += weapon_hit_bonus(null);
    }

    return tmp;
}

/* temporarily override 'safepet' (by faking use of 'F' prefix) when possibly
   unintentionally attacking peaceful monsters and optionally pets */
export function force_attack(mtmp, pets_too) { /* boolean */
    let attacked, save_Forcefight;

    save_Forcefight = svc.context.forcefight;
    /* always set forcefight On for hostiles and peacefuls, maybe for pets */
    if (pets_too || !mtmp.mtame)
        svc.context.forcefight = TRUE;
    attacked = do_attack(mtmp);
    svc.context.forcefight = save_Forcefight;
    return attacked;
}

/* try to attack; return False if monster evaded;
   u.dx and u.dy must be set */
export function do_attack(mtmp) { /* boolean */
    const $frame = stack_frame(); try {
    var mdat = mtmp.data;

    /* This section of code provides protection against accidentally
     * hitting peaceful (like '@') and tame (like 'd') monsters.
     * Protection is provided as long as player is not: blind, confused,
     * hallucinating or stunned.
     * changes by wwp 5/16/85
     * More changes 12/90, -dkh-. if its tame and safepet, (and protected
     * 07/92) then we assume that you're not trying to attack. Instead,
     * you'll usually just swap places if this is a movement command
     */
    /* Intelligent chaotic weapons (Stormbringer) want blood */
    if (is_safemon(mtmp) && !svc.context.forcefight) {
        if (!u_wield_art(ART_STORMBRINGER)) {
            /* There are some additional considerations: this won't work
             * if in a shop or Punished or you miss a random roll or
             * if you can walk thru walls and your pet cannot (KAA) or
             * if your pet is a long worm with a tail.
             * There's also a chance of displacing a "frozen" monster:
             * sleeping monsters might magically walk in their sleep.
             * This block of code used to only be called for pets; now
             * that it also applies to peacefuls, non-pets mustn't be
             * forced to flee.
             */
            var foo = (Punished() || !rn2(7)
                           || (is_longworm(mtmp.data) && mtmp.wormno)
                           || (IS_OBSTRUCTED(levl()[u.ux][u.uy].typ)
                               && !passes_walls(mtmp.data)) ? 1 : 0),
                    inshop = FALSE;
            var p;

            /* only check for in-shop if don't already have reason to stop */
            if (!foo) {
                for (p = in_rooms(mtmp.mx, mtmp.my, SHOPBASE); chars[p]; p++)
                    if (tended_shop(elt(svr.rooms, chars[p] - ROOMOFFSET))) {
                        inshop = TRUE;
                        break;
                    }
            }
            if (inshop || foo) {
                var buf = stack_array(char, BUFSZ);

                if (!svc.context.travel && !svc.context.run)
                    if (canspotmon(mtmp) && mtmp.isshk)
                        return ECMD_TIME | dopay();

                if (mtmp.mtame) /* see 'additional considerations' above */
                    monflee(mtmp, rnd(6), FALSE, FALSE);
                strcpy(buf, y_monnam(mtmp));
                chars[buf + 0] = highc(chars[buf + 0]);
                You(_("stop.  %s is in the way!"), buf);
                end_running(TRUE);
                return TRUE;
            } else if (mtmp.mfrozen || helpless(mtmp)
                       || (mtmp.data.mmove == 0 && rn2(6))) {
                pline(_("%s doesn't seem to move!"), Monnam(mtmp));
                end_running(TRUE);
                return TRUE;
            } else
                return FALSE;
        }
    }

    /* possibly set in attack_checks;
       examined in known_hitum, called via hitum or hmonas below */
    go.override_confirmation = FALSE;
    /* attack_checks() used to use <u.ux+u.dx,u.uy+u.dy> directly, now
       it uses gb.bhitpos instead; it might map an invisible monster there */
    gb.bhitpos.x = u.ux + u.dx;
    gb.bhitpos.y = u.uy + u.dy;
    gn.notonhead = +(gb.bhitpos.x != mtmp.mx || gb.bhitpos.y != mtmp.my);
    if (attack_checks(mtmp, uwep))
        return TRUE;

    atk_done: { if (Upolyd() && noattacks(gy.youmonst.data)) {
        /* certain "pacifist" monsters don't attack */
        You(_("have no way to attack monsters physically."));
        mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);
        break atk_done;
    }

    if (check_capacity(_("You cannot fight while so heavily loaded."))
        /* consume extra nutrition during combat; maybe pass out */
        || overexertion())
        break atk_done;;

    if (u.twoweap && !can_twoweapon())
        untwoweapon();

    if (gu.unweapon) {
        gu.unweapon = FALSE;
        if (flags.verbose) {
            if (uwep)
                You(_("begin bashing monsters with %s."), yname(uwep));
            else if (!cantwield(gy.youmonst.data))
                You(_("begin %s monsters with your %s %s."),
                    ing_suffix(Role_if(PM_MONK) ? _("strike") : _("bash")),
                    uarmg ? _("gloved") : _("bare"), /* Del Lamb */
                    makeplural(body_part(HAND)));
        }
    }
    exercise(A_STR, TRUE); /* you're exercising muscles */
    /* andrew@orca: prevent unlimited pick-axe attacks */
    u_wipe_engr(3);

    /* Is the "it died" check actually correct? */
    if (mdat.mlet == S_LEPRECHAUN && !mtmp.mfrozen && !helpless(mtmp)
        && !mtmp.mconf && mtmp.mcansee && !rn2(7)
        && (m_move(mtmp, 0) == MMOVE_DIED /* it died */
            || mtmp.mx != u.ux + u.dx
            || mtmp.my != u.uy + u.dy)) { /* it moved */
        You(_("miss wildly and stumble forwards."));
        return FALSE;
    }

    if (Upolyd())
        hmonas(mtmp);
    else
        hitum(mtmp, gy.youmonst.data.mattk[0]);
    mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);
 }
    /* see comment in attack_checks() */
    /* we only need to check for this if we did an attack_checks()
     * and it returned 0 (it's okay to attack), and the monster didn't
     * evade.
     */
    if (svc.context.forcefight && !DEADMONSTER(mtmp) && !canspotmon(mtmp)
        && !glyph_is_invisible(levl()[u.ux + u.dx][u.uy + u.dy].glyph)
        && !engulfing_u(mtmp))
        map_invisible(u.ux + u.dx, u.uy + u.dy);

    return TRUE;
    } finally { stack_pop($frame); }
}

/* really hit target monster; returns TRUE if it still lives */
function known_hitum(
    mon,
    weapon,
    mhit,

    rollneeded,
    armorpenalty,

    uattk,
    dieroll) { /* boolean */
    let malive = TRUE,

            slice_or_chop = (weapon && (is_blade(weapon) || is_axe(weapon)) ? 1 : 0);

    if (go.override_confirmation) {
        /* this may need to be generalized if weapons other than
           Stormbringer acquire similar anti-social behavior... */
        if (flags.verbose)
            Your(_("bloodthirsty blade attacks!"));
    }

    if (!mhit[0]) {
        missum(mon, uattk, +(rollneeded + armorpenalty > dieroll));
    } else {
        let oldhp = mon.mhp;
        let oldweaphit = u.uconduct.weaphit;

        /* KMH, conduct */
        if (weapon && (weapon.oclass == WEAPON_CLASS || is_weptool(weapon)))
            u.uconduct.weaphit++;

        /* we hit the monster; be careful: it might die or
           be knocked into a different location */
        gn.notonhead = +(mon.mx != gb.bhitpos.x || mon.my != gb.bhitpos.y);
        malive = hmon(mon, weapon, HMON_MELEE, dieroll);
        if (malive) {
            /* monster still alive */
            if (!rn2(25) && mon.mhp < Math.trunc(mon.mhpmax / 2)
                && !engulfing_u(mon)) {
                /* maybe should regurgitate if swallowed? */
                monflee(mon, !rn2(3) ? rnd(100) : 0, FALSE, TRUE);

                if (u.ustuck == mon && !u.uswallow
                    && !sticks(gy.youmonst.data))
                    set_ustuck(null);
            }
            /* Vorpal Blade hit converted to miss */
            /* could be headless monster or worm tail */
            if (mon.mhp == oldhp) {
                mhit[0] = 0;
                /* a miss does not break conduct */
                u.uconduct.weaphit = oldweaphit;
            }
            if (mon.wormno && mhit[0])
                cutworm(mon, gb.bhitpos.x, gb.bhitpos.y, slice_or_chop);
        }
    }
    return malive;
}

/* hit the monster next to you and the monsters to the left and right of it;
   return False if the primary target is killed, True otherwise */
function hitum_cleave(
    target,
    uattk) { /* boolean */ /*+ but we don't enforce that here; Null works ok */
    const $frame = stack_frame(); try {
    /* swings will be delivered in alternate directions; with consecutive
       attacks it will simulate normal swing and backswing; when swings
       are non-consecutive, hero will sometimes start a series of attacks
       with a backswing--that doesn't impact actual play, just spoils the
       simulation attempt a bit */
    let clockwise = static_var("hitum_cleave.clockwise", schar, FALSE);
    let i;
    let save_bhitpos = stack_struct(struct_nhcoord);
    let save_notonhead;
    let count, umort, x = u.ux, y = u.uy;

    /* find the direction toward primary target */
    i = xytodir(u.dx, u.dy);
    if (i == DIR_ERR) {
        impossible(_("hitum_cleave: unknown target direction [%d,%d,%d]?"),
                   u.dx, u.dy, u.dz);
        return TRUE; /* target hasn't been killed */
    }
    /* adjust direction by two so that loop's increment (for clockwise)
       or decrement (for counter-clockwise) will point at the spot next
       to primary target */
    i = clockwise[0] ? DIR_LEFT2(i) : DIR_RIGHT2(i);
    umort = u.umortality; /* used to detect life-saving */
    struct_assign(save_bhitpos, gb.bhitpos);
    save_notonhead = gn.notonhead;

    /*
     * Three attacks:  adjacent to primary, primary, adjacent on other
     * side.  Primary target must be present or we wouldn't have gotten
     * here (forcefight at thin air won't 'cleave').  However, the
     * first attack might kill it (gas spore explosion, weak long worm
     * occupying both spots) so we don't assume that it's still present
     * on the second attack.
     */
    for (count = 3; count > 0; --count) {
        let mtmp;
        let tx, ty, tmp, dieroll, mhit = stack_var(int), attknum = stack_var(int, 0), armorpenalty = stack_var(int);

        /* ++i, wrap 8 to i=0 /or/ --i, wrap -1 to i=7 */
        i = clockwise[0] ? DIR_RIGHT(i) : DIR_LEFT(i);

        tx = x + chars[xdir + i], ty = y + chars[ydir + i]; /* current target location */
        if (!isok(tx, ty))
            continue;
        mtmp = m_at(tx, ty);
        if (!mtmp) {
            if (glyph_is_invisible(levl()[tx][ty].glyph))
                unmap_invisible(tx, ty);
            continue;
        }

        tmp = find_roll_to_hit(mtmp, uattk.aatyp, uwep,
                               attknum, armorpenalty);
        mon_maybe_unparalyze(mtmp);
        dieroll = rnd(20);
        mhit[0] = +(tmp > dieroll);
        gb.bhitpos.x = tx, gb.bhitpos.y = ty; /* normally set by do_attack() */
        gn.notonhead = +(mtmp.mx != tx || mtmp.my != ty);
        known_hitum(mtmp, uwep, mhit, tmp, armorpenalty[0],
                           uattk, dieroll);
        passive(mtmp, uwep, mhit[0], +!DEADMONSTER(mtmp), AT_WEAP, +!uwep);

        /* stop attacking if weapon is gone or hero got paralyzed or
           killed (and then life-saved) by passive counter-attack */
        if (!uwep || gm.multi < 0 || u.umortality > umort)
            break;
    }
    /* set up for next time */
    clockwise[0] = +!clockwise[0]; /* alternate */
    struct_assign(gb.bhitpos, save_bhitpos); /* in case somebody relies on bhitpos
                                * designating the primary target */
    gn.notonhead = save_notonhead;

    /* return False if primary target died, True otherwise; note: if 'target'
       was nonNull upon entry then it's still nonNull even if *target died */
    return (target && DEADMONSTER(target)) ? FALSE : TRUE;
    } finally { stack_pop($frame); }
}

/* returns True if hero is fighting without a weapon and without a shield and
   has sufficient skill in bare-handed/martial arts to attack twice */
function double_punch() { /* boolean */
    /* note: P_BARE_HANDED_COMBAT and P_MARTIAL_ARTS are equivalent */
    let skl_lvl = P_SKILL(P_BARE_HANDED_COMBAT);

    /*
     * Chance to attempt a second bare-handed or martial arts hit:
     *  restricted  (0),        [not applicable; no one is restricted]
     *  unskilled   (1) :  0%
     *  basic       (2) :  0%
     *  skilled     (3) : 20%
     *  expert      (4) : 40%
     *  master      (5) : 60%
     *  grandmaster (6) : 80%
     */
    if (!uwep && !uarms && skl_lvl > P_BASIC)
        return +((skl_lvl - P_BASIC) > rn2(5));
    return FALSE;
}

/* hit target monster; returns TRUE if it still lives */
function hitum(mon, uattk) { /* boolean */
    const $frame = stack_frame(); try {
    let malive, wep_was_destroyed = FALSE;
    let wepbefore = uwep,
        secondwep = u.twoweap ? uswapwep : null;
    let tmp, dieroll, mhit = stack_var(int), armorpenalty = stack_var(int), attknum = stack_var(int, 0),
        x = u.ux + u.dx, y = u.uy + u.dy, oldumort = u.umortality;

    /* Cleaver attacks three spots, 'mon' and one on either side of 'mon';
       it can't be part of dual-wielding but we guard against that anyway;
       cleave return value reflects status of primary target ('mon') */
    if (u_wield_art(ART_CLEAVER) && !u.twoweap
        && !u.uswallow && !u.ustuck && !NODIAG(u.umonnum))
        return hitum_cleave(mon, uattk);

    /* 0: single hit, 1: first of two hits; affects strength bonus and
       silver rings; known_hitum() -> hmon() -> hmon_hitmon() will copy
       gt.twohits into struct _hitmon_data hmd.twohits */
    gt.twohits = (uwep ? u.twoweap : double_punch()) ? 1 : 0;

    tmp = find_roll_to_hit(mon, uattk.aatyp, uwep, attknum, armorpenalty);
    mon_maybe_unparalyze(mon);
    dieroll = rnd(20);
    mhit[0] = (tmp > dieroll || u.uswallow ? 1 : 0);
    if (tmp > dieroll)
        exercise(A_DEX, TRUE);

    /* gb.bhitpos is set up by caller */
    malive = known_hitum(mon, uwep, mhit, tmp, armorpenalty[0], uattk, dieroll);
    if (wepbefore && !uwep)
        wep_was_destroyed = TRUE;
    passive(mon, uwep, mhit[0], malive, AT_WEAP, wep_was_destroyed);

    /* second attack for two-weapon combat or skilled unarmed combat;
       won't occur if Stormbringer overrode confirmation (assumes
       Stormbringer is primary weapon), or if hero became paralyzed by
       passive counter-attack, or if hero was killed by passive
       counter-attack and got life-saved, or if monster was killed or
       knocked to different location */
    if (gt.twohits && !(go.override_confirmation
                        || gm.multi < 0 || u.umortality > oldumort
                        || !malive || m_at(x, y) != mon)) {
        gt.twohits = 2; /* second of 2 hits */
        tmp = find_roll_to_hit(mon, uattk.aatyp, uswapwep, attknum,
                               armorpenalty);
        mon_maybe_unparalyze(mon);
        dieroll = rnd(20);
        mhit[0] = (tmp > dieroll || u.uswallow ? 1 : 0);
        malive = known_hitum(mon, secondwep, mhit, tmp, armorpenalty[0], uattk,
                             dieroll);
        /* second passive counter-attack only occurs if second attack hits */
        if (mhit[0])
            passive(mon, secondwep, mhit[0], malive, AT_WEAP,
                           (secondwep && !uswapwep ? 1 : 0));
    }
    gt.twohits = 0;
    return malive;
    } finally { stack_pop($frame); }
}

/* general "damage monster" routine; return True if mon still alive */
export function hmon(mon,
     obj,
     thrown,
     dieroll) { /* boolean */
    let result, anger_guards;

    anger_guards = (mon.mpeaceful
                    && (mon.ispriest || mon.isshk || is_watch(mon.data)) ? 1 : 0);
    result = hmon_hitmon(mon, obj, thrown, dieroll);
    if (mon.ispriest && !rn2(2))
        ghod_hitsu(mon);
    if (anger_guards)
        angry_guards(+!!Deaf());
    return result;
}

/* hero hits monster bare handed */
function hmon_hitmon_barehands(hmd, mon) { /* void */
    const $frame = stack_frame(); try {
    let spcdmgflg, silverhit = stack_var(long, 0); /* worn masks */

    if (hmd.mdat == mons[PM_SHADE]) {
        hmd.dmg = 0;
    } else {
        /* note: 1..2 or 1..4 can be substantially increased by
           strength bonus or skill bonus, usually both... */
        hmd.dmg = rnd(!martial_bonus() ? 2 : 4);
        hmd.use_weapon_skill = TRUE;
        hmd.train_weapon_skill = +(hmd.dmg > 1);
    }

    /* Blessed gloves give bonuses when fighting 'bare-handed'.  So do
       silver rings.  Note:  rings are worn under gloves, so you don't
       get both bonuses, and two silver rings don't give double bonus.
       When making only one hit, both rings are checked (backwards
       compatibility => playability), but when making two hits, only the
       ring on the hand making the attack is checked. */
    spcdmgflg = uarmg ? W_ARMG
              : (((hmd.twohits == 0 || hmd.twohits == 1) ? W_RINGR : 0)
                 | ((hmd.twohits == 0 || hmd.twohits == 2) ? W_RINGL : 0));
    hmd.dmg += special_dmgval(gy.youmonst, mon, spcdmgflg, silverhit);

    /* copy silverhit info back into struct _hitmon_data *hmd */
    switch (hmd.twohits) {
    case 0: /* only one hit being attempted; a silver ring on either hand
             * applies but having silver rings on both is same as just one */
        hmd.barehand_silver_rings = (silverhit[0] & (W_RINGR | W_RINGL)) ? 1 : 0;
        break;
    case 1: /* first of two or more hit attempts; right ring applies */
        hmd.barehand_silver_rings = (silverhit[0] & W_RINGR) ? 1 : 0;
        break;
    case 2: /* second of two or more hit attempts; left ring applies */
        hmd.barehand_silver_rings = (silverhit[0] & W_RINGL) ? 1 : 0;
        break;
    default: /* third or later of more than two hit attempts (poly'd hero);
              * rings were applied on first and second hits */
        hmd.barehand_silver_rings = 0;
        break;
    }
    if (hmd.barehand_silver_rings > 0)
        hmd.silvermsg = TRUE;
    } finally { stack_pop($frame); }
}

function hmon_hitmon_weapon_ranged(
    hmd,
    mon,
    obj) { /* void */ /* obj is not NULL */
    /* then do only 1-2 points of damage and don't use or
       train weapon's skill */
    if (hmd.mdat == mons[PM_SHADE] && !shade_glare(obj))
        hmd.dmg = 0;
    else
        hmd.dmg = rnd(2);
    if (hmd.material == SILVER && mon_hates_silver(mon)) {
        hmd.silvermsg = hmd.silverobj = TRUE;
        /* if it will already inflict dmg, make it worse */
        hmd.dmg += rnd(hmd.dmg ? 20 : 10);
    }
    if (!hmd.thrown && obj == uwep && obj.otyp == BOOMERANG
        && rnl(4) == 4 - 1) {
        let more_than_1 = +(obj.quan > 1);

        pline(_("As you hit %s, %s%s breaks into splinters."),
              mon_nam(mon), more_than_1 ? _("one of ") : _(""),
              yname(obj));
        if (!more_than_1)
            uwepgone(); /* set gu.unweapon */
        useup(obj);
        if (!more_than_1)
            obj = null;
        hmd.hittxt = TRUE;
        if (hmd.mdat != mons[PM_SHADE])
            hmd.dmg++;
    }
}

/* can monster be stabbed in the back? */
function backstabbable(mon) { /* boolean */
    return (!amorphous(mon.data)
        && !is_whirly(mon.data)
        && !noncorporeal(mon.data)
        && mon.data.mlet != S_BLOB
        && mon.data.mlet != S_EYE
        && mon.data.mlet != S_FUNGUS
        && canseemon(mon)
        && (mon.mflee || helpless(mon)) ? 1 : 0);
}

function hmon_hitmon_weapon_melee(
    hmd,
    mon,
    obj) { /* void */ /* obj is not NULL */
    const $frame = stack_frame(); try {
    let wtype;
    let monwep;

    /* "normal" weapon usage */
    hmd.use_weapon_skill = TRUE;
    hmd.dmg = dmgval(obj, mon);
    /* a minimal hit doesn't exercise proficiency */
    hmd.train_weapon_skill = +(hmd.dmg > 1);

    /* Healer with anatomy knowledge */
    if (Role_if(PM_HEALER) && hmd.hand_to_hand
        && obj.oclass == WEAPON_CLASS
        && objects[obj.otyp].oc_subtyp == P_KNIFE)
        hmd.dmg += min(3, Math.trunc(svm.mvitals[monsndx(mon.data)].died / 6));

    /* special attack actions */
    if (!hmd.train_weapon_skill || mon == u.ustuck || u.twoweap
        /* Cleaver can hit up to three targets at once so don't
           let it also hit from behind or shatter foes' weapons */
        || (hmd.hand_to_hand && is_art(obj, ART_CLEAVER))) {
        ; /* no special bonuses */
    } else if (Role_if(PM_ROGUE) && backstabbable(mon) && !Upolyd()
               /* multi-shot throwing is too powerful here */
               && hmd.hand_to_hand) {
        You(_("strike %s from behind!"), mon_nam(mon));
        hmd.dmg += rnd(u.ulevel);
        hmd.hittxt = TRUE;
    } else if (hmd.dieroll == 2 && obj == uwep
               && obj.oclass == WEAPON_CLASS
               && (bimanual(obj)
                   || (Role_if(PM_SAMURAI) && obj.otyp == KATANA
                       && !uarms))
               && ((wtype = uwep_skill_type()) != P_NONE
                   && P_SKILL(wtype) >= P_SKILLED)
               && ((monwep = MON_WEP(mon)) != null
                   && !is_flimsy(monwep)
                   && !obj_resists(monwep,
                                   50 + 15 * (greatest_erosion(obj)
                                              - greatest_erosion(monwep)),
                                   100))) {
        let from_your_blow = init_string(static_array("hmon_hitmon_weapon_melee.from_your_blow", char, sizeof_string(" from the force of your blow!")), _(" from the force of your blow!"), true);
        let buf = stack_array(char, BUFSZ);
        /*
         * 2.5% chance of shattering defender's weapon when
         * using a two-handed weapon; less if uwep is rusted.
         * [dieroll == 2 is most successful non-beheading or
         * -bisecting hit, in case of special artifact damage;
         * the percentage chance is (1/20)*(50/100).]
         * If attacker's weapon is rustier than defender's,
         * the obj_resists chance is increased so the shatter
         * chance is decreased; if less rusty, then vice versa.
         */
        setmnotwielded(mon, monwep);
        mon.weapon_check = NEED_WEAPON;
        if (canseemon(mon))
            /* Yobjnam2(X,"shatter") yields "Shk's X shatters" if X is owned
               by a shop or "Mon's X shatters" if X is carried by a monster
               (or "{Your|The} X shatters" if {carried by hero|last resort})*/
            strcpy(buf, Yobjnam2(monwep, _("shatter")));
        else /* hero is blind or can't see invisible mon */
            /* construct "Its weapon shatters"; not an exact replacement
               for Yobjnam2() if an unseen mon other than the shopkeeper
               is wielding a shop-owned weapon; telepathy or extended
               monster detection will name mon but not its weapon */
            sprintf(buf, _("%s weapon%s %s"), s_suffix(Monnam(mon)), plur(monwep.quan), otense(monwep, _("shatter")))
;
        chars[buf + (sizeof(array_of(char, BUFSZ)) - sizeof_string(" from the force of your blow!"))] = ord('\0');
        pline(_("%s%s"), buf, from_your_blow);
        m_useupall(mon, monwep);
        /* If someone just shattered MY weapon, I'd flee! */
        if (rn2(4)) {
            monflee(mon, d(2, 3), TRUE, TRUE);
        }
        hmd.hittxt = TRUE;
    }

    if (obj.oartifact
        && artifact_hit(gy.youmonst, mon, obj, ref_of(hmd, "dmg"), hmd.dieroll)) {
        /* artifact_hit updates 'tmp' but doesn't inflict any
           damage; however, it might cause carried items to be
           destroyed and they might do so */
        if (DEADMONSTER(mon)) { /* artifact killed monster */
            hmd.doreturn = TRUE;
            hmd.retval = FALSE;
            return;
            /*return FALSE;*/
        }
        /* perhaps artifact tried to behead a headless monster */
        if (hmd.dmg == 0) {
            hmd.doreturn = TRUE;
            hmd.retval = TRUE;
            return;
            /*return TRUE;*/
        }
        hmd.hittxt = TRUE;
    }
    if (hmd.material == SILVER && mon_hates_silver(mon)) {
        hmd.silvermsg = hmd.silverobj = TRUE;
    }
    if (artifact_light(obj) && obj.lamplit
        && mon_hates_light(mon))
        hmd.lightobj = TRUE;
    if (u.usteed && !hmd.thrown && hmd.dmg > 0
        && weapon_type(obj) == P_LANCE && mon != u.ustuck) {
        hmd.jousting = joust(mon, obj);
        /* exercise skill even for minimal damage hits */
        if (hmd.jousting)
            hmd.train_weapon_skill = TRUE;
    }
    if (hmd.thrown == HMON_THROWN
        && (is_ammo(obj) || is_missile(obj))) {
        if (ammo_and_launcher(obj, uwep)) {
            /* elves and samurai do extra damage using their own
               bows with their own arrows; they're highly trained */
            if (Role_if(PM_SAMURAI) && obj.otyp == YA
                && uwep.otyp == YUMI)
                hmd.dmg++;
            else if (Race_if(PM_ELF) && obj.otyp == ELVEN_ARROW
                     && uwep.otyp == ELVEN_BOW)
                hmd.dmg++;
            hmd.train_weapon_skill = +(hmd.dmg > 0);
        }
        if (obj.otrapped && is_poisonable(obj))
            hmd.ispoisoned = TRUE;
    }
    /* permapoisoned is non-ammo/missile, limit the poison */
    if (permapoisoned(obj) && hmd.dieroll <= 5)
        hmd.ispoisoned = TRUE;
    } finally { stack_pop($frame); }
}

function hmon_hitmon_weapon(
    hmd,
    mon,
    obj) { /* void */ /* obj is not NULL */
    /* is it not a melee weapon? */
    if (/* if you strike with a bow... */
        is_launcher(obj)
        /* or strike with a missile in your hand... */
        || (!hmd.thrown && (is_missile(obj) || is_ammo(obj)))
        /* or use a pole at short range and not mounted... */
        || (!hmd.thrown && !u.usteed && is_pole(obj)
            && !is_art(obj,ART_SNICKERSNEE))
        /* or throw a missile without the proper bow... */
        || (is_ammo(obj) && (hmd.thrown != HMON_THROWN
                             || !ammo_and_launcher(obj, uwep)))) {
        hmon_hitmon_weapon_ranged(hmd, mon, obj);
    } else {
        hmon_hitmon_weapon_melee(hmd, mon, obj);
        if (hmd.doreturn)
            return;
    }
}

function hmon_hitmon_potion(
    hmd,
    mon,
    obj) { /* void */ /* obj is not NULL */
    if (obj.quan > 1)
        obj = splitobj(obj, 1);
    else
        setuwep(null);
    freeinv(obj);
    potionhit(mon, obj,
              hmd.hand_to_hand ? POTHIT_HERO_BASH : POTHIT_HERO_THROW);
    if (DEADMONSTER(mon)) {
        hmd.doreturn = TRUE;
        hmd.retval = FALSE; /* killed */
        return;
    }
    hmd.hittxt = TRUE;
    /* in case potion effect causes transformation */
    hmd.mdat = mon.data;
    hmd.dmg = (hmd.mdat == mons[PM_SHADE]) ? 0 : 1;
}

function hmon_hitmon_misc_obj(
    hmd,
    mon,
    obj) { /* void */ /* obj is not NULL */
    switch (obj.otyp) {
    case BOULDER:         /* 1d20 */
    case HEAVY_IRON_BALL: /* 1d25 */
    case IRON_CHAIN:      /* 1d4+1 */
        hmd.dmg = dmgval(obj, mon);
        break;
    case MIRROR:
        if (breaktest(obj)) {
            You(_("break %s.  That's bad luck!"), ysimple_name(obj));
            change_luck(-2);
            useup(obj);
            obj = null;
            hmd.unarmed = FALSE; /* avoid obj==0 confusion */
            hmd.get_dmg_bonus = FALSE;
            hmd.hittxt = TRUE;
        }
        hmd.dmg = 1;
        break;
    case EXPENSIVE_CAMERA:
        You(_("succeed in destroying %s.  Congratulations!"),
            ysimple_name(obj));
        release_camera_demon(obj, u.ux, u.uy);
        useup(obj);
        hmd.doreturn = TRUE;
        hmd.retval = TRUE;
        return;
        /*return TRUE;*/
    case CORPSE: /* fixed by polder@cs.vu.nl */
        if (touch_petrifies(mons[obj.corpsenm])) {
            hmd.dmg = 1;
            hmd.hittxt = TRUE;
            You(_("hit %s with %s."), mon_nam(mon),
                corpse_xname(obj, 0,
                             obj.dknown ? CXN_PFX_THE
                             : CXN_ARTICLE));
            observe_object(obj);
            if (!munstone(mon, TRUE))
                minstapetrify(mon, TRUE);
            if (resists_ston(mon))
                break;
            /* note: hp may be <= 0 even if munstoned==TRUE */
            hmd.doreturn = TRUE;
            hmd.retval = +!DEADMONSTER(mon);
            return;
            /*return (boolean) !DEADMONSTER(mon);*/
        }
        hmd.dmg = (ismnum(obj.corpsenm) ? mons[obj.corpsenm].msize
                    : 0) + 1;
        break;

    case EGG: {
        let cnt = obj.quan;

        hmd.dmg = 1; /* nominal physical damage */
        hmd.get_dmg_bonus = FALSE;
        hmd.hittxt = TRUE; /* message always given */
        /* egg is always either used up or transformed, so next
           hand-to-hand attack should yield a "bashing" mesg */
        if (obj == uwep)
            gu.unweapon = TRUE;
        if (obj.spe && ismnum(obj.corpsenm)) {
            if (obj.quan < 5)
                change_luck(schar((- obj.quan)));
            else
                change_luck(-5);
        }

        if (ismnum(obj.corpsenm)
            && touch_petrifies(mons[obj.corpsenm])) {
            /*learn_egg_type(obj->corpsenm);*/
            pline(_("Splat!  You hit %s with %s %s egg%s!"),
                  mon_nam(mon),
                  obj.known ? _("the") : cnt > 1 ? _("some") : _("a"),
                  obj.known ? mons[obj.corpsenm].pmnames[NEUTRAL]
                  : _("petrifying"),
                  plur(cnt));
            obj.known = 1; /* (not much point...) */
            do { if (hmd.thrown) obfree(obj, null); else useupall(obj); obj = null; } while (0);
            if (!munstone(mon, TRUE))
                minstapetrify(mon, TRUE);
            if (resists_ston(mon))
                break;
            hmd.doreturn = TRUE;
            hmd.retval = +!DEADMONSTER(mon);
            return;
            /*return (boolean) (!DEADMONSTER(mon));*/
        } else { /* ordinary egg(s) */
            let mnum = obj.corpsenm;
            let eggp = (ismnum(mnum) && obj.known)
                    ? the(mons[mnum].pmnames[NEUTRAL])
                    : (cnt > 1) ? _("some") : _("an");

            You(_("hit %s with %s egg%s."), mon_nam(mon), eggp,
                plur(cnt));
            if (touch_petrifies(hmd.mdat) && !stale_egg(obj)) {
                pline_The(_("egg%s %s alive any more..."), plur(cnt),
                          (cnt == 1) ? _("isn't") : _("aren't"));
                if (obj.timed)
                    obj_stop_timers(obj);
                obj.otyp = ROCK;
                obj.oclass = GEM_CLASS;
                obj.oartifact = 0;
                obj.spe = 0;
                obj.known = obj.dknown = obj.bknown = 0;
                obj.owt = unsigned(weight(obj));
                if (hmd.thrown)
                    place_object(obj, mon.mx, mon.my);
            } else if (obj.corpsenm == PM_PYROLISK) {
                do { if (hmd.thrown) obfree(obj, null); else useupall(obj); obj = null; } while (0);
                explode(mon.mx, mon.my, -11, d(3, 6), 0, EXPL_FIERY);
                hmd.doreturn = TRUE;
                hmd.retval = +!DEADMONSTER(mon);
                return;
            } else {
                pline(_("Splat!"));
                do { if (hmd.thrown) obfree(obj, null); else useupall(obj); obj = null; } while (0);
                exercise(A_WIS, FALSE);
            }
        }
        break;
    }
    case CLOVE_OF_GARLIC: /* no effect against demons */
        if (is_undead(hmd.mdat) || is_vampshifter(mon)) {
            monflee(mon, d(2, 4), FALSE, TRUE);
        }
        hmd.dmg = 1;
        break;
    case CREAM_PIE:
    case BLINDING_VENOM:
        mon.msleeping = 0;
        if (can_blnd(gy.youmonst, mon,
                     ((obj.otyp == BLINDING_VENOM)
                              ? AT_SPIT
                              : AT_WEAP),
                     obj)) {
            if (Blind()) {
                pline(obj.otyp == CREAM_PIE ? _("Splat!")
                      : _("Splash!"));
            } else if (obj.otyp == BLINDING_VENOM) {
                pline_The(_("venom blinds %s%s!"), mon_nam(mon),
                          mon.mcansee ? _("") : _(" further"));
            } else {
                let whom = mon_nam(mon);
                let what = The(xname(obj));

                if (!hmd.thrown && obj.quan > 1)
                    what = An(singular(obj, xname));
                /* note: s_suffix returns a modifiable buffer */
                if (haseyes(hmd.mdat)
                    && hmd.mdat != mons[PM_FLOATING_EYE])
                    whom = strcat(strcat(s_suffix(whom), _(" ")),
                                  mbodypart(mon, FACE));
                pline(_("%s %s over %s!"), what,
                      vtense(what, _("splash")), whom);
            }
            setmangry(mon, TRUE);
            mon.mcansee = 0;
            hmd.dmg = rn1(25, 21);
            if ((mon.mblinded + hmd.dmg) > 127)
                mon.mblinded = 127;
            else
                mon.mblinded += hmd.dmg;
        } else {
            pline(obj.otyp == CREAM_PIE ? _("Splat!") : _("Splash!"));
            setmangry(mon, TRUE);
        }
        {
            var more_than_1 = +(obj.quan > 1);

            if (hmd.thrown)
                obfree(obj, null);
            else
                useup(obj);

            if (!more_than_1)
                obj = null;
        }
        hmd.hittxt = TRUE;
        hmd.get_dmg_bonus = FALSE;
        hmd.dmg = 0;
        break;
    case ACID_VENOM: /* thrown (or spit) */
        if (resists_acid(mon)) {
            Your(_("venom hits %s harmlessly."), mon_nam(mon));
            hmd.dmg = 0;
        } else {
            Your(_("venom burns %s!"), mon_nam(mon));
            hmd.dmg = dmgval(obj, mon);
        }
        {
            var more_than_1 = +(obj.quan > 1);

            if (hmd.thrown)
                obfree(obj, null);
            else
                useup(obj);

            if (!more_than_1)
                obj = null;
        }
        hmd.hittxt = TRUE;
        hmd.get_dmg_bonus = FALSE;
        break;
    default:
        if ((objects[obj.otyp].oc_material == VEGGY ||
             objects[obj.otyp].oc_material == PAPER) &&
            obj.oclass != SPBOOK_CLASS) {
            /* vegetables (and similar) do no damage, because they
               aren't rigid enough; paper objects also do no damage,
               except for books */
            hmd.dmg = 0;
            hmd.get_dmg_bonus = FALSE;
            break;
        }
        /* non-weapons can damage because of their weight */
        /* (but not too much) */
        hmd.dmg = int(Math.trunc(unsigned(obj.owt + 99) / 100));
        hmd.dmg = (hmd.dmg <= 1) ? 1 : rnd(hmd.dmg);
        if (hmd.dmg > 6)
            hmd.dmg = 6;
        /* wet towel has modest damage bonus beyond its weight,
           based on its wetness */
        if (is_wet_towel(obj)) {
            let doubld = +(mon.data == mons[PM_IRON_GOLEM]);

            /* wielded wet towel should probably use whip skill
               (but not by setting objects[TOWEL].oc_skill==P_WHIP
               because that would turn towel into a weptool);
               due to low weight, tmp always starts at 1 here, and
               due to wet towel's definition, obj->spe is 1..7 */
            hmd.dmg += obj.spe * (doubld ? 2 : 1);
            hmd.dmg = rnd(hmd.dmg); /* wet towel damage not capped at 6 */
            /* usually lose some wetness but defer doing so
               until after hit message */
            hmd.dryit = +(rn2(obj.spe + 1) > 0);
        }
        /* things like silver wands can arrive here so we
           need another silver check; blessed check too */
        if (hmd.material == SILVER && mon_hates_silver(mon)) {
            hmd.dmg += rnd(20);
            hmd.silvermsg = hmd.silverobj = TRUE;
        }
        if (obj.blessed && mon_hates_blessings(mon))
            hmd.dmg += rnd(4);
    }
}

/* do the actual hitting monster with obj/fists */
function hmon_hitmon_do_hit(
    hmd,
    mon,
    obj) { /* void */ /* obj can be NULL */
    if (!obj) { /* attack with bare hands */
        hmon_hitmon_barehands(hmd, mon);
    } else {
        /* obj is not NULL here because of the !obj check in this if block,
         , so no guard is needed ahead of stone_missile(obj) */
        /* stone missile does not hurt xorn or earth elemental, but doesn't
           pass all the way through and continue on to some further target */
        if ((hmd.thrown == HMON_THROWN
             || hmd.thrown == HMON_KICKED) /* not Applied */
            && stone_missile(obj) && passes_rocks(hmd.mdat)) {
            hit(mshot_xname(obj), mon, _(" but does no harm."));
            wakeup(mon, TRUE);
            hmd.doreturn = TRUE;
            hmd.retval = TRUE;
            return;
        }
        /* remember obj's name since it might end up being destroyed and
           we'll want to use it after that */
        if (!(artifact_light(obj) && obj.lamplit))
            strcpy(hmd.saved_oname, cxname(obj));
        else
            strcpy(hmd.saved_oname, bare_artifactname(obj));

        if (obj.oclass == WEAPON_CLASS || is_weptool(obj)
            || obj.oclass == GEM_CLASS) {
            hmon_hitmon_weapon(hmd, mon, obj);
            if (hmd.doreturn)
                return;
        /* attacking with non-weapons */
        } else if (obj.oclass == POTION_CLASS) {
            hmon_hitmon_potion(hmd, mon, obj);
            if (hmd.doreturn)
                return;
        } else {
            if (hmd.mdat == mons[PM_SHADE] && !shade_aware(obj)) {
                hmd.dmg = 0;
            } else {
                hmon_hitmon_misc_obj(hmd, mon, obj);
            }
        }
    }
}

function hmon_hitmon_dmg_recalc(hmd, obj) { /* void */
    let dmgbonus = 0, strbonus, absbonus;

    /*
     * Potential bonus (or penalty) from worn ring of increase damage
     * (or intrinsic bonus from eating same) or from strength.  Strength
     * bonus is increased for melee with two-handed weapons and decreased
     * for dual attacks (but when both hit, the total for the two is more
     * than the bonus for a regular single hit).
     */
    if (hmd.get_dmg_bonus) {
        /* for dual attacks, udaminc applies to both, and two-handed
           weapons use it as-is */
        dmgbonus = u.udaminc;
        /* throwing using a propellor gets an increase-damage bonus
           but not a strength one; other attacks get both;
           for dual attacks, 3/4 of the strength bonus is used; when
           both attacks hit, overall bonus is 3/2 rather than doubled;
           melee hit with two-handed weapon uses 3/2 strength bonus to
           approximately match double hit with two-weapon ('approximate'
           because udaminc skews in favor of two-weapon); the 3/2 factor
           for two-handed strength does not apply to polearms unless
           hero is simply bashing with one of those and does not apply
           to jousting because lances are one-handed */
        if (hmd.thrown != HMON_THROWN
            || !obj || !uwep || !ammo_and_launcher(obj, uwep)) {
            strbonus = dbon();
            absbonus = abs(strbonus);
            if (hmd.twohits)
                strbonus = Math.trunc((3 * absbonus + 2) / 4) * sgn(strbonus);
            else if (hmd.thrown == HMON_MELEE && uwep && bimanual(uwep))
                strbonus = Math.trunc((3 * absbonus + 1) / 2) * sgn(strbonus);
            dmgbonus += strbonus;
        }
    }

    /*
     * Potential bonus (or penalty) from weapon skill.
     * 'use_weapon_skill' is True for hand-to-hand ordinary weapon,
     * applied or jousting polearm or lance, thrown missile (dart,
     * shuriken, boomerang), or shot ammo (arrow, bolt, rock/gem when
     * wielding corresponding launcher).
     * It is False for hand-to-hand or thrown non-weapon, hand-to-hand
     * polearm or lance when not mounted, hand-to-hand missile or ammo
     * or launcher, thrown non-missile, or thrown ammo (including rocks)
     * when not wielding corresponding launcher.
     */
    if (hmd.use_weapon_skill) {
        let skillwep = obj;

        if (PROJECTILE(obj) && ammo_and_launcher(obj, uwep))
            skillwep = uwep;
        dmgbonus += weapon_dam_bonus(skillwep);

        /* hit for more than minimal damage (before being adjusted
           for damage or skill bonus) trains the skill toward future
           enhancement */
        if (hmd.train_weapon_skill) {
            /* [this assumes that `!thrown' implies wielded...] */
            let wtype = hmd.thrown ? weapon_type(skillwep)
                                    : uwep_skill_type();
            use_skill(wtype, 1);
        }
    }

    /* apply combined damage+strength and skill bonuses */
    hmd.dmg += dmgbonus;
    /* don't let penalty, if bonus is negative, turn a hit into a miss */
    if (hmd.dmg < 1)
        hmd.dmg = 1;
}

function hmon_hitmon_poison(
    hmd,
    mon,
    obj) { /* void */ /* obj is not NULL */
    let nopoison = int(unsigned(10 - Math.trunc(obj.owt / 10)));

    if (nopoison < 2)
        nopoison = 2;
    if (Role_if(PM_SAMURAI)) {
        You(_("dishonorably use a poisoned weapon!"));
        adjalign(-sgn(u.ualign.type));
    } else if (u.ualign.type == A_LAWFUL && u.ualign.record > -10) {
        You_feel(_("like an evil coward for using a poisoned weapon."));
        adjalign(-1);
    }
    if (!permapoisoned(obj) && !rn2(nopoison)) {
        /* remove poison now in case obj ends up in a bones file */
        obj.otrapped = FALSE;
        /* defer "obj is no longer poisoned" until after hit message */
        hmd.unpoisonmsg = TRUE;
    }
    if (resists_poison(mon))
        hmd.needpoismsg = TRUE;
    else if (rn2(10))
        hmd.dmg += rnd(6);
    else
        hmd.poiskilled = TRUE;
}

function hmon_hitmon_jousting(
    hmd,
    mon,
    obj) { /* void */ /* lance; obj is not NULL */
    hmd.dmg += d(2, (obj == uwep) ? 10 : 2); /* [was in dmgval()] */
    You(_("joust %s%s"), mon_nam(mon), canseemon(mon) ? exclam(hmd.dmg) : _("."));
    /* if this hit just broke the never-hit-with-wielded-weapon conduct
       (handled by caller...), give a livelog message for that now */
    if (u.uconduct.weaphit <= 1)
        first_weapon_hit(obj);

    if (hmd.jousting < 0) {
        /* (must be either primary or secondary weapon to get here) */
        set_twoweap(FALSE); /* sets u.twoweap = FALSE;
                             * untwoweapon() is too verbose here */
        if (obj == uwep)
            uwepgone(); /* set gu.unweapon */
        pline(_("%s shatters on impact!"), Yname2(obj));
        /* minor side-effect: broken lance won't split puddings */
        useup(obj);
        obj = null;
    }
    if (mhurtle_to_doom(mon, hmd.dmg, ref_of(hmd, "mdat")))
        hmd.already_killed = TRUE;
    hmd.hittxt = TRUE;
}

function hmon_hitmon_stagger(
    hmd,
    mon,
    obj) { /* void */
    /* VERY small chance of stunning opponent if unarmed. */
    if (rnd(100) < P_SKILL(P_BARE_HANDED_COMBAT) && !bigmonst(hmd.mdat)
        && !thick_skinned(hmd.mdat)) {
        if (canspotmon(mon))
            pline(_("%s %s from your powerful strike!"), Monnam(mon),
                  makeplural(stagger(mon.data, _("stagger"))));
        if (mhurtle_to_doom(mon, hmd.dmg, ref_of(hmd, "mdat")))
            hmd.already_killed = TRUE;
        hmd.hittxt = TRUE;
    }
}

function hmon_hitmon_pet(
    hmd,
    mon,
    obj) { /* void */
    if (mon.mtame && hmd.dmg > 0) {
        /* do this even if the pet is being killed or migrating (affects revival) */
        abuse_dog(mon); /* reduces tameness */
        /* flee if still alive and still tame; if already suffering from
           untimed fleeing, no effect, otherwise increases timed fleeing */
        if (mon.mtame && !hmd.destroyed)
            monflee(mon, 10 * rnd(hmd.dmg), FALSE, FALSE);
    }
}

function hmon_hitmon_splitmon(
    hmd,
    mon,
    obj) { /* void */ /* obj can be NULL but guards are in place below */
    const $frame = stack_frame(); try {
    if ((hmd.mdat == mons[PM_BLACK_PUDDING]
         || hmd.mdat == mons[PM_BROWN_PUDDING])
        /* pudding is alive and healthy enough to split */
        && mon.mhp > 1 && !mon.mcan && !hmd.offmap
        /* iron weapon using melee or polearm hit [3.6.1: metal weapon too;
           also allow either or both weapons to cause split when twoweap] */
        && obj && (obj == uwep || (u.twoweap && obj == uswapwep))
        && ((hmd.material == IRON
             /* allow scalpel and tsurugi to split puddings */
             || hmd.material == METAL)
            /* but not bashing with darts, arrows or ya */
            && !(is_ammo(obj) || is_missile(obj)))
        && hmd.hand_to_hand) {
        let mclone;
        let withwhat = stack_array(char, BUFSZ);

        if ((mclone = clone_mon(mon, 0, 0)) != null) {
            chars[withwhat + 0] = ord('\0');
            if (u.twoweap && flags.verbose)
                sprintf(withwhat, _(" with %s"), yname(obj));
            pline(_("%s divides as you hit it%s!"), Monnam(mon), withwhat);
            hmd.hittxt = TRUE;
            mintrap(mclone, NO_TRAP_FLAGS);
        }
    }
    } finally { stack_pop($frame); }
}

function hmon_hitmon_msg_hit(
    hmd,
    mon,
    obj) { /* void */ /* obj can be NULL for hand_to_hand; otherwise not */
    if (!hmd.hittxt /*( thrown => obj exists )*/
        && (!hmd.destroyed
            || (hmd.thrown && gm.m_shot.n > 1
                && gm.m_shot.o == obj.otyp))) {
        if (hmd.thrown)
            hit(mshot_xname(obj), mon, exclam(hmd.dmg));
        else if (!flags.verbose)
            You(_("hit it."));
        else /* hand_to_hand */
            You(_("%s %s%s"),
                (obj && (is_shield(obj)
                         || obj.otyp == HEAVY_IRON_BALL)) ? _("bash")
                : (obj && (objects[obj.otyp].oc_subtyp == P_WHIP
                           || is_wet_towel(obj))) ? _("lash")
                  : Role_if(PM_BARBARIAN) ? _("smite")
                    : _("hit"),
                mon_nam(mon), canseemon(mon) ? exclam(hmd.dmg) : _("."));
    }
}

function hmon_hitmon_msg_silver(
    hmd,
    mon,
    obj) { /* void */
    const $frame = stack_frame(); try {
    let fmt;
    let whom = mon_nam(mon);
    let silverobjbuf = stack_array(char, BUFSZ);

    if (canspotmon(mon)) {
        if (hmd.barehand_silver_rings == 1)
            fmt = _("Your silver ring sears %s!");
        else if (hmd.barehand_silver_rings == 2)
            fmt = _("Your silver rings sear %s!");
        else if (hmd.silverobj && chars[hmd.saved_oname + 0]) {
            /* guard constructed format string against '%' in
               saved_oname[] from xname(via cxname()) */
            Snprintf(silverobjbuf, sizeof(array_of(char, BUFSZ)), _("Your %s%s %s"), strstri(hmd.saved_oname, _("silver")) ? _("") : _("silver "), hmd.saved_oname, vtense(hmd.saved_oname, _("sear")))

;
            strNsubst(silverobjbuf, _("%"), _("%%"), 0);
            strncat(silverobjbuf, _(" %s!"),
                    unsigned(sizeof(array_of(char, BUFSZ)) - unsigned(strlen(silverobjbuf) + 1)));
            fmt = silverobjbuf;
        } else
            fmt = _("The silver sears %s!");
    } else {
        chars[whom] = highc(chars[whom]); /* "it" -> "It" */
        fmt = _("%s is seared!");
    }
    /* note: s_suffix returns a modifiable buffer */
    if (!noncorporeal(hmd.mdat) && !amorphous(hmd.mdat))
        whom = strcat(s_suffix(whom), _(" flesh"));

    pline(fmt, whom);
    } finally { stack_pop($frame); }
}

function hmon_hitmon_msg_lightobj(
    hmd,
    mon,
    obj) { /* void */
    const $frame = stack_frame(); try {
    let fmt;
    let whom = mon_nam(mon);
    let emitlightobjbuf = stack_array(char, BUFSZ);

    if (canspotmon(mon)) {
        if (chars[hmd.saved_oname + 0]) {
            sprintf(emitlightobjbuf, _("%s radiance penetrates deep into"), s_suffix(hmd.saved_oname))

;
            strcat(emitlightobjbuf, _(" %s!"));
            fmt = emitlightobjbuf;
        } else
            fmt = _("The light sears %s!");
    } else {
        chars[whom] = highc(chars[whom]); /* "it" -> "It" */
        fmt = _("%s is seared!");
    }
    /* note: s_suffix returns a modifiable buffer */
    if (!noncorporeal(hmd.mdat) && !amorphous(hmd.mdat))
        whom = strcat(s_suffix(whom), _(" flesh"));

    pline(fmt, whom);
    } finally { stack_pop($frame); }
}

/*
 * These will segfault if passed a NULL obj pointer:
 *       hmon_hitmon_weapon_ranged,
 *       hmon_hitmon_weapon_melee,
 *       hmon_hitmon_weapon,
 *       hmon_hitmon_potion,
 *       hmon_hitmon_misc_obj,
 *       hmon_hitmon_poison,
 *       hmon_hitmon_jousting,
 *
 * These are equipped to handle a NULL obj pointer:
 *       hmon_hitmon_stagger,       - obj arg is unused
 *       hmon_hitmon_pet,           - obj arg is unused
 *       hmon_hitmon_msg_silver,    - obj arg is unused
 *       hmon_hitmon_msg_lightobj,  - obj arg is unused
 *       hmon_hitmon_do_hit,        - has obj and !obj code paths
 *       hmon_hitmon_splitmon,      - has !obj guards
 *       hmon_hitmon_msg_hit,       - has !obj guards exc. thrown which is ok
 */

/* guts of hmon(); returns True if 'mon' survives */
function hmon_hitmon(
    mon,
    obj,
    thrown,
    dieroll) { /* boolean */
    const $frame = stack_frame(); try {
    let hmd = stack_struct(struct__hitmon_data);
    let maybe_knockback = FALSE;

    hmd.dmg = 0;
    hmd.thrown = thrown;
    hmd.twohits = thrown ? 0 : gt.twohits;
    hmd.dieroll = dieroll;
    hmd.mdat = mon.data;
    hmd.use_weapon_skill = FALSE;
    hmd.train_weapon_skill = FALSE;
    hmd.barehand_silver_rings = 0;
    hmd.silvermsg = FALSE;
    hmd.silverobj = FALSE;
    hmd.lightobj = FALSE;
    hmd.material = obj ? objects[obj.otyp].oc_material
                       : NO_MATERIAL;
    hmd.jousting = 0;
    hmd.hittxt = FALSE;
    hmd.get_dmg_bonus = TRUE;
    hmd.unarmed = +(!uwep && !uarm && !uarms);
    hmd.hand_to_hand = (thrown == HMON_MELEE
                        /* not grapnels; applied implies uwep */
                        || (thrown == HMON_APPLIED && is_pole(uwep)) ? 1 : 0);
    hmd.ispoisoned = FALSE;
    hmd.unpoisonmsg = FALSE;
    hmd.needpoismsg = FALSE;
    hmd.poiskilled = FALSE;
    hmd.already_killed = FALSE;
    hmd.offmap = FALSE;
    hmd.destroyed = FALSE;
    hmd.dryit = FALSE;
    hmd.doreturn = FALSE;
    hmd.retval = FALSE;
    chars[hmd.saved_oname + 0] = ord('\0');

    hmon_hitmon_do_hit(hmd, mon, obj);
    if (hmd.doreturn)
        return hmd.retval;

    /*
     ***** NOTE: perhaps obj is undefined! (if !thrown && BOOMERANG)
     *      *OR* if attacking bare-handed!
     * Note too: the cases where obj might get destroyed do not
     *      set 'use_weapon_skill', bare-handed does.
     */

    if (hmd.dmg > 0)
        hmon_hitmon_dmg_recalc(hmd, obj);

    if (hmd.ispoisoned)
        hmon_hitmon_poison(hmd, mon, obj);

    if (hmd.dmg < 1) {
        let mon_is_shade = +(mon.data == mons[PM_SHADE]);

        /* make sure that negative damage adjustment can't result
           in inadvertently boosting the victim's hit points */
        hmd.dmg = (hmd.get_dmg_bonus && !mon_is_shade) ? 1 : 0;
        if (mon_is_shade && !hmd.hittxt
            && thrown != HMON_THROWN && thrown != HMON_KICKED)
            /* this gives "harmlessly passes through" feedback even when
               hero doesn't see it happen; presumably sensed by touch? */
            hmd.hittxt = shade_miss(gy.youmonst, mon, obj, FALSE, TRUE);
    }

    if (hmd.jousting) {
        hmon_hitmon_jousting(hmd, mon, obj);
    } else if (hmd.unarmed && hmd.dmg > 1 && !thrown && !obj && !Upolyd()) {
        hmon_hitmon_stagger(hmd, mon, obj);
    } else if (!hmd.unarmed && hmd.dmg > 1 && !thrown && !Upolyd()
               && !u.twoweap && uwep) {
        maybe_knockback = TRUE;
    }

    if (!hmd.already_killed) {
        if (obj && (obj == uwep || (obj == uswapwep && u.twoweap))
            /* known_hitum 'what counts as a weapon' criteria */
            && (obj.oclass == WEAPON_CLASS || is_weptool(obj))
            && (thrown == HMON_MELEE || thrown == HMON_APPLIED)
            /* if jousting, the hit was already logged */
            && !hmd.jousting
            /* note: caller has already incremented u.uconduct.weaphit
               so we test for 1; 0 shouldn't be able to happen here... */
            && hmd.dmg > 0 && u.uconduct.weaphit <= 1)
            first_weapon_hit(obj);
        mon.mhp -= hmd.dmg;
    }
    /* adjustments might have made tmp become less than what
       a level-draining artifact has already done to max HP */
    if (mon.mhp > mon.mhpmax)
        mon.mhp = mon.mhpmax;
    if (mon.mx == 0) {
        /*
         * jousting can lead to:
         *     mhurtle_to_doom()
         *      mhurtle()
         *       mintrap()
         *        trapeffect_hole()
         *         trapeffect_level_telep()
         *          migrate_to_level()
         * Set offmap in that situation so code to follow can test for it.*/
        hmd.offmap = TRUE;
    }
    if (DEADMONSTER(mon))
        hmd.destroyed = TRUE;

    hmon_hitmon_pet(hmd, mon, obj);

    hmon_hitmon_splitmon(hmd, mon, obj);

    hmon_hitmon_msg_hit(hmd, mon, obj);

    if (hmd.dryit) { /* dryit implies wet towel, so 'obj' is still intact */
        assert(obj != null);
        dry_a_towel(obj, -1, TRUE);
    }

    if (hmd.silvermsg)
        hmon_hitmon_msg_silver(hmd, mon, obj);

    if (hmd.lightobj)
        hmon_hitmon_msg_lightobj(hmd, mon, obj);

    /* if a "no longer poisoned" message is coming, it will be last;
       obj->opoisoned was cleared above and any message referring to
       "poisoned <obj>" has now been given; we want just "<obj>" for
       last message, so reformat while obj is still accessible */
    if (hmd.unpoisonmsg) {
        assert(obj != null);
        strcpy(hmd.saved_oname, cxname(obj));
    }

    /* [note: thrown obj might go away during killed()/xkilled() call
       (via 'thrownobj'; if swallowed, it gets added to engulfer's
       minvent and might merge with a stack that's already there)] */
    /* already_killed and poiskilled won't apply for Trollsbane */

    if (hmd.needpoismsg)
        pline_The(_("poison doesn't seem to affect %s."), mon_nam(mon));
    if (hmd.poiskilled) {
        pline_The(_("poison was deadly..."));
        if (!hmd.already_killed)
            xkilled(mon, XKILL_NOMSG);
        hmd.destroyed = TRUE; /* return FALSE; */
    } else if (hmd.destroyed) {
        if (!hmd.already_killed) {
            if (troll_baned(mon, obj))
                gm.mkcorpstat_norevive = TRUE;
            killed(mon); /* takes care of most messages */
            gm.mkcorpstat_norevive = FALSE;
        }
    } else if (u.umconf && hmd.hand_to_hand) {
        nohandglow(mon);
        if (!mon.mconf && !resist(mon, SPBOOK_CLASS, 0, NOTELL)) {
            mon.mconf = 1;
            if (!mon.mstun && !helpless(mon) && canseemon(mon))
                pline(_("%s appears confused."), Monnam(mon));
        }
    }
    if (hmd.unpoisonmsg)
        Your(_("%s %s no longer poisoned."), hmd.saved_oname,
             vtense(hmd.saved_oname, _("are")));

    if (!hmd.destroyed && !hmd.offmap) {
        let hitflags = stack_var(int, M_ATTK_HIT);

        wakeup(mon, TRUE);
        if (maybe_knockback
            && mhitm_knockback(gy.youmonst, mon, gy.youmonst.data.mattk[0],
                               hitflags, TRUE)) {
            if ((hitflags[0] & M_ATTK_DEF_DIED) != 0)
                hmd.destroyed = TRUE;
        }
    }
    return hmd.destroyed ? FALSE : TRUE;
    } finally { stack_pop($frame); }
}

/* joust or martial arts punch is knocking the target back; that might
   kill 'mon' (via trap) before known_hitum() has a chance to do so;
   return True if we kill mon, False otherwise */
function mhurtle_to_doom(
    mon,
    tmp,
    mptr) { /* boolean */ /* caller's cached copy of mon->data */
    /* only hurtle if pending physical damage (tmp) isn't going to kill mon */
    if (tmp < mon.mhp) {
        mhurtle(mon, u.dx, u.dy, 1);
        /* update caller's cached mon->data in case mon was pushed into
           a polymorph trap or is a vampshifter whose current form has
           been killed by a trap so that it reverted to original form */
        mptr[0] = mon.data;
        if (DEADMONSTER(mon))
            return TRUE;
    }
    return FALSE; /* mon isn't dead yet */
}

/* gamelog version of "you've broken never-hit-with-wielded-weapon conduct;
   the conduct is tracked in known_hitum(); we're called by hmon_hitmon() */
function first_weapon_hit(weapon) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    /* avoid xname() since that includes "named <foo>" and we don't want
       player-supplied <foo> in livelog */
    chars[buf + 0] = ord('\0');
    /* include "cursed" if known but don't bother with blessed */
    if (weapon.cursed && weapon.bknown)
        strcat(buf, _("cursed ")); /* normally supplied by doname() */
    if (obj_is_pname(weapon)) {
        strcat(buf, ONAME(weapon)); /* fully IDed artifact */
    } else {
        strcat(buf, simpleonames(weapon));
        if (weapon.oartifact && weapon.dknown)
            sprintf(eos(buf), _(" named %s"), bare_artifactname(weapon));
    }

    /* when a hit breaks the never-hit-with-wielded-weapon conduct
       (handled by caller) we need to log the message about that before
       monster is possibly killed; otherwise getting log entry sequence
         N : killed for the first time
         N : hit with a wielded weapon for the first time
       reported on the same turn (N) looks "suboptimal" */
    livelog_printf(LL_CONDUCT,
                   _("hit with a wielded weapon (%s) for the first time"), buf);
    } finally { stack_pop($frame); }
}

function shade_aware(obj) { /* boolean */
    if (!obj)
        return FALSE;
    /*
     * The things in this list either
     * 1) affect shades.
     *  OR
     * 2) are dealt with properly by other routines
     *    when it comes to shades.
     */
    if (obj.otyp == BOULDER
        || obj.otyp == HEAVY_IRON_BALL
        || obj.otyp == IRON_CHAIN      /* dmgval handles those first three */
        || obj.otyp == MIRROR          /* silver in the reflective surface */
        || obj.otyp == CLOVE_OF_GARLIC /* causes shades to flee */
        || objects[obj.otyp].oc_material == SILVER)
        return TRUE;
    return FALSE;
}

/* used for hero vs monster and monster vs monster; also handles
   monster vs hero but that won't happen because hero can't be a shade */
export function shade_miss(
    magr,
    mdef,
    obj,
    thrown,
    verbose) { /* boolean */
    let what, whose, target;
    let youagr = +(magr == gy.youmonst), youdef = +(mdef == gy.youmonst);

    /* we're using dmgval() for zero/not-zero, not for actual damage amount */
    if (mdef.data != mons[PM_SHADE] || (obj && dmgval(obj, mdef)))
        return FALSE;

    if (verbose
        && ((youdef || cansee(mdef.mx, mdef.my) || sensemon(mdef))
            || (magr == gy.youmonst && m_next2u(mdef)))) {
        let harmlessly_thru = init_string(static_array("shade_miss.harmlessly_thru", char, sizeof_string(" harmlessly through ")), _(" harmlessly through "), true);

        what = (!obj || shade_aware(obj)) ? _("attack") : cxname(obj);
        target = youdef ? _("you") : mon_nam(mdef);
        if (!thrown) {
            whose = youagr ? _("Your") : s_suffix(Monnam(magr));
            pline(_("%s %s %s%s%s."), whose, what,
                  vtense(what, _("pass")), harmlessly_thru, target);
        } else {
            pline(_("%s %s%s%s."), The(what), /* note: not pline_The() */
                  vtense(what, _("pass")), harmlessly_thru, target);
        }
        if (!youdef && !canspotmon(mdef))
            map_invisible(mdef.mx, mdef.my);
    }
    if (!youdef)
        mdef.msleeping = 0;
    return TRUE;
}

/* check whether slippery clothing protects from hug or wrap attack */
/* [currently assumes that you are the attacker] */
function m_slips_free(mdef, mattk) { /* boolean */
    let obj;

    if (mattk.adtyp == AD_DRIN) {
        /* intelligence drain attacks the head */
        obj = which_armor(mdef, W_ARMH);
    } else {
        /* grabbing attacks the body */
        obj = which_armor(mdef, W_ARMC); /* cloak */
        if (!obj)
            obj = which_armor(mdef, W_ARM); /* suit */
        if (!obj)
            obj = which_armor(mdef, W_ARMU); /* shirt */
    }

    /* if monster's cloak/armor is greased, your grab slips off; this
       protection might fail (33% chance) when the armor is cursed */
    if (obj && (obj.greased || obj.otyp == OILSKIN_CLOAK)
        && (!obj.cursed || rn2(3))) {
        You(_("%s %s %s %s!"),
            (mattk.adtyp == AD_WRAP) ? _("slip off of")
                                      : _("grab, but cannot hold onto"),
            s_suffix(mon_nam(mdef)), obj.greased ? _("greased") : _("slippery"),
            /* avoid "slippery slippery cloak"
               for undiscovered oilskin cloak */
            (obj.greased || objects[obj.otyp].oc_name_known)
                ? xname(obj)
                : cloak_simple_name(obj));

        if (obj.greased && !rn2(2)) {
            pline_The(_("grease wears off."));
            obj.greased = 0;
        }
        return TRUE;
    }
    return FALSE;
}

/* used when hitting a monster with a lance while mounted;
   1: joust hit; 0: ordinary hit; -1: joust but break lance */
function joust(mon,
      obj) { /* int */ /* weapon */
    let skill_rating, joust_dieroll;

    if (Fumbling() || Stunned())
        return 0;
    /* sanity check; lance must be wielded in order to joust */
    if (obj != uwep && (obj != uswapwep || !u.twoweap))
        return 0;
    /* can't joust while trapped--not enough room to maneuver;
     * TODO? if the steed is trapped in a pit, perhaps the hero ought to be
     * able to joust against a monster that's in a conjoined pit */
    if (u.utrap)
        return 0;

    /* if using two weapons, use worse of lance and two-weapon skills */
    skill_rating = P_SKILL(weapon_type(obj)); /* lance skill */
    if (u.twoweap && P_SKILL(P_TWO_WEAPON_COMBAT) < skill_rating)
        skill_rating = P_SKILL(P_TWO_WEAPON_COMBAT);
    if (skill_rating == P_ISRESTRICTED)
        skill_rating = P_UNSKILLED; /* 0=>1 */

    /* odds to joust are expert:80%, skilled:60%, basic:40%, unskilled:20% */
    if ((joust_dieroll = rn2(5)) < skill_rating) {
        if (joust_dieroll == 0 && rnl(50) == (50 - 1) && !unsolid(mon.data)
            && !obj_resists(obj, 0, 100))
            return -1; /* hit that breaks lance */
        return 1;      /* successful joust */
    }
    return 0; /* no joust bonus; revert to ordinary attack */
}

/* send in a demon pet for the hero; exercise wisdom */
function demonpet() { /* void */
    let i;
    let pm;
    let dtmp;

    pline(_("Some hell-p has arrived!"));
    i = !rn2(6) ? ndemon(u.ualign.type) : NON_PM;
    pm = i != NON_PM ? mons[i] : gy.youmonst.data;
    if ((dtmp = makemon(pm, u.ux, u.uy, NO_MM_FLAGS)) != null)
        tamedog(dtmp, null, FALSE);
    exercise(A_WIS, TRUE);
}

function theft_petrifies(otmp) { /* boolean */
    if (uarmg || otmp.otyp != CORPSE
        || !touch_petrifies(mons[otmp.corpsenm]) || Stone_resistance())
        return FALSE;

    /* stealing this corpse is fatal... */
    instapetrify(corpse_xname(otmp, _("stolen"), CXN_ARTICLE));
    /* apparently wasn't fatal after all... */
    return TRUE;
}

/*
 * Player uses theft attack against monster.
 *
 * If the target is wearing body armor, take all of its possessions;
 * otherwise, take one object.  [Is this really the behavior we want?]
 */
function steal_it(mdef, mattk) { /* void */
    const $frame = stack_frame(); try {
    let otmp, gold = null, ustealo, minvent_ptr;
    let unwornmask;

    otmp = mdef.minvent;
    if (!otmp || (otmp.oclass == COIN_CLASS && !otmp.nobj))
        return; /* nothing to take */

    /* look for worn body armor */
    ustealo = null;
    if (could_seduce(gy.youmonst, mdef, mattk) && mdef.mcanmove) {
        /* find armor, and move it to end of inventory in the process */
        minvent_ptr = ref_of(mdef, "minvent");
        while ((otmp = minvent_ptr[0]) != null)
            if (otmp.owornmask & W_ARM) {
                if (ustealo)
                    panic(_("steal_it: multiple worn suits"));
                minvent_ptr[0] = otmp.nobj; /* take armor out of minvent */
                ustealo = otmp;
                ustealo.nobj = null;
            } else {
                minvent_ptr = ref_of(otmp, "nobj");
            }
        minvent_ptr[0] = ustealo; /* put armor back into minvent */
    }
    gold = findgold(mdef.minvent);

    if (ustealo) { /* we will be taking everything */
        let heshe = stack_array(char, 20);

        /* 5.0: this uses hero's base gender rather than nymph femininity
           but was using hardcoded pronouns She/her for target monster;
           switch to dynamic pronoun */
        if (gender(mdef) == u.mfemale
            && gy.youmonst.data.mlet == S_NYMPH)
            You(_("charm %s.  %s gladly hands over %s%s possessions."),
                mon_nam(mdef), upstart(strcpy(heshe, mhe(mdef))),
                !gold ? _("") : _("most of "), mhis(mdef));
        else
            You(_("seduce %s and %s starts to take off %s clothes."),
                mon_nam(mdef), mhe(mdef), mhis(mdef));
    }

    /* prevent gold from being stolen so that steal-item isn't a superset
       of steal-gold; shuffling it out of minvent before selecting next
       item, and then back in case hero or monster dies (hero touching
       stolen c'trice corpse or monster wielding one and having gloves
       stolen) is less bookkeeping than skipping it within the loop or
       taking it out once and then trying to figure out how to put it back */
    if (gold)
        obj_extract_self(gold);

    while ((otmp = mdef.minvent) != null) {
        if (gold) /* put 'mdef's gold back after remembering mdef->minvent */
            mpickobj(mdef, gold), gold = null;
        if (!Upolyd())
            break; /* no longer have ability to steal */
        unwornmask = otmp.owornmask;
        /* this would take place when doname() formats the object for
           the hold_another_object() call, but we want to do it before
           otmp gets removed from mdef's inventory */
        if (otmp.oartifact && !Blind())
            find_artifact(otmp);
        /* take the object away from the monster */
        extract_from_minvent(mdef, otmp, TRUE, FALSE);
        /* special message for final item; no need to check owornmask because
         * ustealo is only set on objects with (owornmask & W_ARM) */
        if (otmp == ustealo)
            pline(_("%s finishes taking off %s suit."), Monnam(mdef),
                  mhis(mdef));
        /* give the object to the character */
        otmp = hold_another_object(otmp, _("You snatched but dropped %s."),
                                   doname(otmp), _("You steal: "));
        /* might have dropped otmp, and it might have broken or left level */
        if (!otmp || otmp.where != OBJ_INVENT)
            continue;
        if (theft_petrifies(otmp))
            break; /* stop thieving even though hero survived */
        /* more take-away handling, after theft message */
        if (unwornmask & W_WEP) { /* stole wielded weapon */
            possibly_unwield(mdef, FALSE);
        } else if (unwornmask & W_ARMG) { /* stole worn gloves */
            mselftouch(mdef, 0, TRUE);
            if (DEADMONSTER(mdef)) /* it's now a statue */
                break; /* can't continue stealing */
        }

        if (!ustealo)
            break; /* only taking one item */

        /* take gold out of minvent before making next selection; if it
           is the only thing left, the loop will terminate and it will be
           put back below */
        if ((gold = findgold(mdef.minvent)) != null)
            obj_extract_self(gold);
    }

    /* put gold back; won't happen if either hero or 'mdef' dies because
       gold will be back in monster's inventory at either of those times
       (so will be present in mdef's minvent for bones, or in its statue
       now if it has just been turned into one) */
    if (gold)
        mpickobj(mdef, gold);
    } finally { stack_pop($frame); }
}

export function mhitm_ad_rust(
    magr, mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (completelyrusts(pd)) { /* iron golem */
            /* note: the life-saved case is hypothetical because
               life-saving doesn't work for golems */
            pline(_("%s %s to pieces!"), Monnam(mdef),
                  !mlifesaver(mdef) ? _("falls") : _("starts to fall"));
            xkilled(mdef, XKILL_NOMSG);
            mhm.hitflags |= M_ATTK_DEF_DIED;
        }
        erode_armor(mdef, ERODE_RUST);
        mhm.damage = 0; /* damageum(), int tmp */
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (magr.mcan) {
            return;
        }
        if (completelyrusts(pd)) {
            You(_("rust!"));
            /* KMH -- this is okay with unchanging */
            rehumanize();
            return;
        }
        erode_armor(gy.youmonst, ERODE_RUST);
    } else {
        /* mhitm */
        if (magr.mcan)
            return;
        if (completelyrusts(pd)) { /* PM_IRON_GOLEM */
            if (gv.vis && canseemon(mdef))
                pline_mon(mdef, _("%s %s to pieces!"), Monnam(mdef),
                      !mlifesaver(mdef) ? _("falls") : _("starts to fall"));
            monkilled(mdef, 0, AD_RUST);
            if (!DEADMONSTER(mdef)) {
                mhm.hitflags = M_ATTK_MISS;
                mhm.done = TRUE;
                return;
            }
            mhm.hitflags = (M_ATTK_DEF_DIED | (grow_up(magr, mdef) ? 0
                                            : M_ATTK_AGR_DIED));
            mhm.done = TRUE;
            return;
        }
        erode_armor(mdef, ERODE_RUST);
        mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        mhm.damage = 0; /* mdamagem(), int tmp */
    }
}

export function mhitm_ad_corr(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        erode_armor(mdef, ERODE_CORRODE);
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (magr.mcan)
            return;
        erode_armor(mdef, ERODE_CORRODE);
    } else {
        /* mhitm */
        if (magr.mcan)
            return;
        erode_armor(mdef, ERODE_CORRODE);
        mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        mhm.damage = 0;
    }
}

export function mhitm_ad_dcay(
    magr, mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (completelyrots(pd)) { /* wood golem or leather golem */
            pline(_("%s %s to pieces!"), Monnam(mdef),
                  !mlifesaver(mdef) ? _("falls") : _("starts to fall"));
            xkilled(mdef, XKILL_NOMSG);
        }
        erode_armor(mdef, ERODE_ROT);
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (magr.mcan)
            return;
        if (completelyrots(pd)) {
            You(_("rot!"));
            /* KMH -- this is okay with unchanging */
            rehumanize();
            return;
        }
        erode_armor(mdef, ERODE_ROT);
    } else {
        /* mhitm */
        if (magr.mcan)
            return;
        if (completelyrots(pd)) { /* PM_WOOD_GOLEM || PM_LEATHER_GOLEM */
            /* note: the life-saved case is hypothetical because
               life-saving doesn't work for golems */
            if (gv.vis && canseemon(mdef))
                pline_mon(mdef, _("%s %s to pieces!"), Monnam(mdef),
                      !mlifesaver(mdef) ? _("falls") : _("starts to fall"));
            monkilled(mdef, 0, AD_DCAY);
            if (!DEADMONSTER(mdef)) {
                mhm.done = TRUE;
                mhm.hitflags = M_ATTK_MISS;
                return;
            }
            mhm.done = TRUE;
            mhm.hitflags = (M_ATTK_DEF_DIED
                             | (grow_up(magr, mdef) ? 0 : M_ATTK_AGR_DIED));
            return;
        }
        erode_armor(mdef, ERODE_ROT);
        mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        mhm.damage = 0;
    }
}

export function mhitm_ad_dren(
    magr, mattk,
    mdef, mhm) { /* void */
    let negated = mhitm_mgc_atk_negated(magr, mdef, FALSE);

    if (magr == gy.youmonst) {
        /* uhitm */
        if (!negated && !rn2(4))
            xdrainenergym(mdef, TRUE);
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!negated && !rn2(4)) /* 25% chance */
            drain_en(mhm.damage, FALSE);
        mhm.damage = 0;
    } else {
        /* mhitm */
        if (!negated && !rn2(4))
            xdrainenergym(mdef, (gv.vis && canspotmon(mdef)
                                           && mattk.aatyp != AT_ENGL ? 1 : 0));
        mhm.damage = 0;
    }
}

export function mhitm_ad_drli(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        if (!rn2(3) && !(resists_drli(mdef) || defended(mdef, AD_DRLI))
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = d(2, 6); /* Stormbringer uses monhp_per_lvl
                                    * (usually 1d8) */
            pline(_("%s becomes weaker!"), Monnam(mdef));
            if (mdef.mhpmax - mhm.damage > mdef.m_lev) {
                mdef.mhpmax -= mhm.damage;
            } else {
                /* limit floor of mhpmax reduction to current m_lev + 1;
                   avoid increasing it if somehow already less than that */
                if (mdef.mhpmax > mdef.m_lev)
                    mdef.mhpmax = mdef.m_lev + 1;
            }
            mdef.mhp -= mhm.damage;
            /* !m_lev: level 0 monster is killed regardless of hit points
               rather than drop to level -1; note: some non-living creatures
               (golems, vortices) are subject to life-drain */
            if (DEADMONSTER(mdef) || !mdef.m_lev) {
                pline(_("%s %s!"), Monnam(mdef),
                      nonliving(mdef.data) ? _("expires") : _("dies"));
                xkilled(mdef, XKILL_NOMSG);
            } else
                mdef.m_lev--;
            mhm.damage = 0; /* damage has already been inflicted */

            /* unlike hitting with Stormbringer, wounded hero doesn't
               heal any from the drained life */
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!rn2(3) && !Drain_resistance()
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)){
            losexp(_("life drainage"));

            /* unlike hitting with Stormbringer, wounded attacker doesn't
               heal any from the drained life */
        }
    } else {
        /* mhitm */
        /* mhitm_ad_deth gets redirected here for Death's touch */
        let is_death = +(mattk.adtyp == AD_DETH);

        if (is_death
            || (!rn2(3) && !(resists_drli(mdef) || defended(mdef, AD_DRLI))
                && !mhitm_mgc_atk_negated(magr, mdef, TRUE))) {
            if (!is_death) /* Stormbringer uses monhp_per_lvl (1d8) */
                mhm.damage = d(2, 6);
            if (gv.vis && canspotmon(mdef))
                pline_mon(mdef, _("%s becomes weaker!"), Monnam(mdef));
            if (mdef.mhpmax - mhm.damage > mdef.m_lev) {
                mdef.mhpmax -= mhm.damage;
            } else {
                /* limit floor of mhpmax reduction to current m_lev + 1;
                   avoid increasing it if somehow already less than that */
                if (mdef.mhpmax > mdef.m_lev)
                    mdef.mhpmax = mdef.m_lev + 1;
            }
            if (mdef.m_lev == 0) /* automatic kill if drained past level 0 */
                mhm.damage = mdef.mhp;
            else
                mdef.m_lev--;

            /* unlike hitting with Stormbringer, wounded attacker doesn't
               heal any from the drained life */
        }
    }
}

export function mhitm_ad_fire(
    magr, mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;
    let orig_dmg = mhm.damage; /* damage coming into the function */

    if (magr == gy.youmonst) {
        /* uhitm */
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = 0;
            return;
        }
        if (!Blind())
            pline(_("%s is %s!"), Monnam(mdef), on_fire(pd, mattk));
        if (completelyburns(pd)) { /* paper golem or straw golem */
            if (!Blind())
                /* note: the life-saved case is hypothetical because
                   life-saving doesn't work for golems */
                pline(_("%s %s!"), Monnam(mdef),
                      !mlifesaver(mdef) ? _("burns completely")
                                        : _("is totally engulfed in flames"));
            else
                You(_("smell burning%s."),
                    (pd == mons[PM_PAPER_GOLEM]) ? _(" paper")
                      : (pd == mons[PM_STRAW_GOLEM]) ? _(" straw") : _(""));
            xkilled(mdef, XKILL_NOMSG | XKILL_NOCORPSE);
            mhm.damage = 0;
            return;
            /* Don't return yet; keep hp<1 and mhm.damage=0 for pet msg */
        }
        if (resists_fire(mdef) || defended(mdef, AD_FIRE)) {
            if (!Blind())
                pline_The(_("fire doesn't heat %s!"), mon_nam(mdef));
            golemeffects(mdef, AD_FIRE, mhm.damage);
            shieldeff(mdef.mx, mdef.my);
            mhm.damage = 0;
        }
        mhm.damage += destroy_items(mdef, AD_FIRE, orig_dmg);
        ignite_items(mdef.minvent);
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            pline(_("You're %s!"), on_fire(pd, mattk));
            if (completelyburns(pd)) { /* paper or straw golem */
                You(_("go up in flames!"));
                monstunseesu(M_SEEN_FIRE);
                /* KMH -- this is okay with unchanging */
                rehumanize();
                return;
            } else if (Fire_resistance()) {
                pline_The(_("fire doesn't feel hot!"));
                monstseesu(M_SEEN_FIRE);
                mhm.damage = 0;
            } else {
                monstunseesu(M_SEEN_FIRE);
            }
            if (magr.m_lev > rn2(20)) {
                destroy_items(gy.youmonst, AD_FIRE, orig_dmg);
                ignite_items(gi.invent);
            }
            burn_away_slime();
        } else {
            mhm.damage = 0;
        }
    } else {
        /* mhitm */
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = 0;
            return;
        }
        if (gv.vis && canseemon(mdef))
            pline_mon(mdef, _("%s is %s!"), Monnam(mdef), on_fire(pd, mattk));
        if (completelyburns(pd)) { /* paper golem or straw golem */
            /* note: the life-saved case is hypothetical because
               life-saving doesn't work for golems */
            if (gv.vis && canseemon(mdef))
                pline_mon(mdef, _("%s %s!"), Monnam(mdef),
                      !mlifesaver(mdef) ? _("burns completely")
                                        : _("is totally engulfed in flames"));
            monkilled(mdef, 0, AD_FIRE);
            if (!DEADMONSTER(mdef)) {
                mhm.hitflags = M_ATTK_MISS;
                mhm.done = TRUE;
                return;
            }
            mhm.hitflags = (M_ATTK_DEF_DIED
                             | (grow_up(magr, mdef) ? 0 : M_ATTK_AGR_DIED));
            mhm.done = TRUE;
            return;
        }
        if (resists_fire(mdef) || defended(mdef, AD_FIRE)) {
            if (gv.vis && canseemon(mdef))
                pline_The(_("fire doesn't seem to burn %s!"), mon_nam(mdef));
            shieldeff(mdef.mx, mdef.my);
            golemeffects(mdef, AD_FIRE, mhm.damage);
            mhm.damage = 0;
        }
        mhm.damage += destroy_items(mdef, AD_FIRE, orig_dmg);
        ignite_items(mdef.minvent);
    }
}

export function mhitm_ad_cold(
    magr, mattk,
    mdef, mhm) { /* void */
    let orig_dmg = mhm.damage;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = 0;
            return;
        }
        if (!Blind())
            pline(_("%s is covered in frost!"), Monnam(mdef));
        if (resists_cold(mdef) || defended(mdef, AD_COLD)) {
            shieldeff(mdef.mx, mdef.my);
            if (!Blind())
                pline_The(_("frost doesn't chill %s!"), mon_nam(mdef));
            golemeffects(mdef, AD_COLD, mhm.damage);
            mhm.damage = 0;
        }
        mhm.damage += destroy_items(mdef, AD_COLD, orig_dmg);
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            pline(_("You're covered in frost!"));
            if (Cold_resistance()) {
                pline_The(_("frost doesn't seem cold!"));
                monstseesu(M_SEEN_COLD);
                mhm.damage = 0;
            } else {
                monstunseesu(M_SEEN_COLD);
            }
            if (magr.m_lev > rn2(20))
                destroy_items(gy.youmonst, AD_COLD, orig_dmg);
        } else
            mhm.damage = 0;
    } else {
        /* mhitm */
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = 0;
            return;
        }
        if (gv.vis && canseemon(mdef))
            pline_mon(mdef, _("%s is covered in frost!"), Monnam(mdef));
        if (resists_cold(mdef) || defended(mdef, AD_COLD)) {
            if (gv.vis && canseemon(mdef))
                pline_The(_("frost doesn't seem to chill %s!"), mon_nam(mdef));
            shieldeff(mdef.mx, mdef.my);
            golemeffects(mdef, AD_COLD, mhm.damage);
            mhm.damage = 0;
        }
        mhm.damage += destroy_items(mdef, AD_COLD, orig_dmg);
    }
}

export function mhitm_ad_elec(
    magr, mattk,
    mdef, mhm) { /* void */
    let orig_dmg = mhm.damage;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = 0;
            return;
        }
        if (!Blind())
            pline(_("%s is zapped!"), Monnam(mdef));
        if (resists_elec(mdef) || defended(mdef, AD_ELEC)) {
            if (!Blind())
                pline_The(_("zap doesn't shock %s!"), mon_nam(mdef));
            golemeffects(mdef, AD_ELEC, mhm.damage);
            shieldeff(mdef.mx, mdef.my);
            mhm.damage = 0;
        }
        mhm.damage += destroy_items(mdef, AD_ELEC, orig_dmg);
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            You(_("get zapped!"));
            if (Shock_resistance()) {
                pline_The(_("zap doesn't shock you!"));
                monstseesu(M_SEEN_ELEC);
                mhm.damage = 0;
            } else {
                monstunseesu(M_SEEN_ELEC);
            }
            if (magr.m_lev > rn2(20))
                destroy_items(gy.youmonst, AD_ELEC, orig_dmg);
        } else
            mhm.damage = 0;
    } else {
        /* mhitm */
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            mhm.damage = 0;
            return;
        }
        if (gv.vis && canseemon(mdef))
            pline_mon(mdef, _("%s gets zapped!"), Monnam(mdef));
        if (resists_elec(mdef) || defended(mdef, AD_ELEC)) {
            if (gv.vis && canseemon(mdef))
                pline_The(_("zap doesn't shock %s!"), mon_nam(mdef));
            shieldeff(mdef.mx, mdef.my);
            golemeffects(mdef, AD_ELEC, mhm.damage);
            mhm.damage = 0;
        }
        mhm.damage += destroy_items(mdef, AD_ELEC, orig_dmg);
    }
}

export function mhitm_ad_acid(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        if (resists_acid(mdef) || defended(mdef, AD_ACID))
            mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!magr.mcan && !rn2(3))
            if (Acid_resistance()) {
                pline(_("You're covered in %s, but it seems harmless."),
                      hliquid(_("acid")));
                monstseesu(M_SEEN_ACID);
                mhm.damage = 0;
            } else {
                pline(_("You're covered in %s!  It burns!"), hliquid(_("acid")));
                exercise(A_STR, FALSE);
                monstunseesu(M_SEEN_ACID);
            }
        else
            mhm.damage = 0;
    } else {
        /* mhitm */
        if (magr.mcan) {
            mhm.damage = 0;
            return;
        }
        if (resists_acid(mdef) || defended(mdef, AD_ACID)) {
            if (gv.vis && canseemon(mdef))
                pline(_("%s is covered in %s, but it seems harmless."),
                      Monnam(mdef), hliquid(_("acid")));
            mhm.damage = 0;
        } else if (gv.vis && canseemon(mdef)) {
            pline_mon(mdef, _("%s is covered in %s!"), Monnam(mdef), hliquid(_("acid")));
            pline(_("It burns %s!"), mon_nam(mdef));
        }
        if (!rn2(30))
            erode_armor(mdef, ERODE_CORRODE);
        if (!rn2(6))
            acid_damage(MON_WEP(mdef));
    }
}

/* steal gold */
export function mhitm_ad_sgld(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    let pa = magr.data;
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        let mongold = findgold(mdef.minvent);

        if (mongold) {
            obj_extract_self(mongold);
            if (merge_choice(gi.invent, mongold)
                    || inv_cnt(FALSE) < invlet_basic) {
                addinv(mongold);
                Your(_("purse feels heavier."));
            } else {
                You(_("grab %s's gold, but find no room in your knapsack."),
                    mon_nam(mdef));
                dropy(mongold);
            }
        }
        exercise(A_DEX, TRUE);
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (pd.mlet == pa.mlet)
            return;
        if (!magr.mcan)
            stealgold(magr);
    } else {
        /* mhitm */
        let buf = stack_array(char, BUFSZ);

        mhm.damage = 0;
        if (magr.mcan)
            return;
        /* technically incorrect; no check for stealing gold from
         * between mdef's feet...
         */
        {
            let gold = findgold(mdef.minvent);

            if (!gold)
                return;
            obj_extract_self(gold);
            add_to_minv(magr, gold);
        }
        mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        strcpy(buf, Monnam(magr));
        if (gv.vis && canseemon(mdef)) {
            pline(_("%s steals some gold from %s."), buf, mon_nam(mdef));
        }
        if (!tele_restrict(magr)) {
            let couldspot = canspotmon(magr);

            mhm.hitflags = M_ATTK_AGR_DONE;
            rloc(magr, RLOC_NOMSG);
            /* TODO: use RLOC_MSG instead? */
            if (gv.vis && couldspot && !canspotmon(magr))
                pline(_("%s suddenly disappears!"), buf);
        }
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_tlpt(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    if (magr == gy.youmonst) {
        /* uhitm */
        if (mhm.damage <= 0)
            mhm.damage = 1;
        if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            pline(_("%s is not affected."), Monnam(mdef));
        } else {
            let nambuf = stack_array(char, BUFSZ);
            let u_saw_mon = (canseemon(mdef) || engulfing_u(mdef) ? 1 : 0);

            /* record the name before losing sight of monster */
            strcpy(nambuf, Monnam(mdef));
            if (u_teleport_mon(mdef, FALSE) && u_saw_mon
                && !(canseemon(mdef) || engulfing_u(mdef)))
                pline(_("%s suddenly disappears!"), nambuf);
            if (mhm.damage >= mdef.mhp) { /* see hitmu(mhitu.c) */
                if (mdef.mhp == 1)
                    ++mdef.mhp;
                mhm.damage = mdef.mhp - 1;
            }
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        let tmphp;

        hitmsg(magr, mattk);
        if (mhitm_mgc_atk_negated(magr, mdef, FALSE)) {
            You(_("are not affected."));
        } else {
            if (flags.verbose)
                Your(_("position suddenly seems %suncertain!"),
                     (Teleport_control() && !Stunned() && !unconscious()) ? _("")
                     : _("very "));
            tele();
            /* As of 3.6.2:  make sure damage isn't fatal; previously, it
               was possible to be teleported and then drop dead at
               the destination when QM's 1d4 damage gets applied below;
               even though that wasn't "wrong", it seemed strange,
               particularly if the teleportation had been controlled
               [applying the damage first and not teleporting if fatal
               is another alternative but it has its own complications] */
            if ((Half_physical_damage() ? Math.trunc((mhm.damage - 1) / 2) : mhm.damage)
                >= (tmphp = (Upolyd() ? u.mh : u.uhp))) {
                mhm.damage = tmphp - 1;
                if (Half_physical_damage())
                    mhm.damage *= 2; /* doesn't actually increase damage;
                                       * we only get here if half the
                                       * original damage would have
                                       * been fatal, so double reduced
                                       * damage will be less than original */
                if (mhm.damage < 1) { /* implies (tmphp <= 1) */
                    mhm.damage = 1;
                    /* this might increase current HP beyond maximum HP but it
                       will be immediately reduced by caller, so that should
                       be indistinguishable from zero damage; we don't drop
                       damage all the way to zero because that inhibits any
                       passive counterattack if poly'd hero has one */
                    if (Upolyd() && u.mh == 1)
                        ++u.mh;
                    else if (!Upolyd() && u.uhp == 1)
                        ++u.uhp;
                    /* [don't set context.botl here] */
                }
            }
        }
    } else {
        /* mhitm */
        if (magr.mcan || mhm.damage >= mdef.mhp || tele_restrict(mdef)) {
            ; /* no negation message */
        } else if (mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            if (gv.vis)
                pline_mon(mdef, _("%s is not affected."), Monnam(mdef));
        } else {
            let mdef_Monnam = stack_array(char, BUFSZ);
            let wasseen = canspotmon(mdef);

            /* save the name before monster teleports, otherwise
               we'll get "it" in the suddenly disappears message */
            if (gv.vis && wasseen)
                strcpy(mdef_Monnam, Monnam(mdef));
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
            rloc(mdef, RLOC_NOMSG);
            /* TODO: use RLOC_MSG instead? */
            if (gv.vis && wasseen && !canspotmon(mdef) && mdef != u.usteed)
                pline(_("%s suddenly disappears!"), mdef_Monnam);
            if (mhm.damage >= mdef.mhp) { /* see hitmu(mhitu.c) */
                if (mdef.mhp == 1)
                    ++mdef.mhp;
                mhm.damage = mdef.mhp - 1;
            }
        }
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_blnd(
    magr,
    mattk,
    mdef,
    mhm) { /* void */ /* optional for monster vs monster */
    const $frame = stack_frame(); try {
    if (magr == gy.youmonst) {
        /* uhitm */
        if (can_blnd(magr, mdef, mattk.aatyp, null)) {
            if (!Blind() && mdef.mcansee)
                pline(_("%s is blinded."), Monnam(mdef));
            mdef.mcansee = 0;
            mhm.damage += mdef.mblinded;
            if (mhm.damage > 127)
                mhm.damage = 127;
            mdef.mblinded = unsigned(mhm.damage);
        }
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        if (can_blnd(magr, mdef, mattk.aatyp, null)) {
            if (!Blind())
                pline(_("%s blinds you!"), Monnam(magr));
            make_blinded(BlindedTimeout() + mhm.damage, FALSE);
            if (!Blind()) /* => Eyes of the Overworld */
                Your1(vision_clears());
        }
        mhm.damage = 0;
    } else {
        /* mhitm */
        if (can_blnd(magr, mdef, mattk.aatyp, null)) {
            let buf = stack_array(char, BUFSZ);
            let rnd_tmp;

            if (gv.vis && mdef.mcansee && canspotmon(mdef)) {
                /* feedback for becoming blinded is given if observed
                   telepathically (canspotmon suffices) but additional
                   info about archon's glow is only given if seen */
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s is blinded"), Monnam(mdef));
                if (mdef.data == mons[PM_ARCHON] && canseemon(mdef))
                    Snprintf(eos(buf), unsigned(sizeof(array_of(char, BUFSZ)) - strlen(buf)), _(" by %s radiance"), s_suffix(mon_nam(magr)))
;
                pline(_("%s."), buf);
            }
            rnd_tmp = unsigned(d(mattk.damn, mattk.damd));
            if ((rnd_tmp = unsigned(rnd_tmp + mdef.mblinded)) > 127)
                rnd_tmp = 127;
            mdef.mblinded = rnd_tmp;
            mdef.mcansee = 0;
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        }
        if (mhm)
            mhm.damage = 0;
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_curs(
    magr, mattk,
    mdef, mhm) { /* void */
    let pa = magr.data;
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (night() && !rn2(10) && !mdef.mcan) {
            if (pd == mons[PM_CLAY_GOLEM]) {
                if (!Blind())
                    pline(_("Some writing vanishes from %s head!"),
                          s_suffix(mon_nam(mdef)));
                xkilled(mdef, XKILL_NOMSG);
                /* Don't return yet; keep hp<1 and mhm.damage=0 for pet msg */
            } else {
                mdef.mcan = 1;
                You(_("chuckle."));
            }
        }
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!night() && pa == mons[PM_GREMLIN])
            return;
        if (!magr.mcan && !rn2(10)) {
            if (!Deaf()) {
                 ;
                if (Blind()) {
                    You_hear(_("laughter."));
                } else {
                    pline_mon(magr, _("%s chuckles."), Monnam(magr));
                }
            }
            if (u.umonnum == PM_CLAY_GOLEM) {
                pline(_("Some writing vanishes from your head!"));
                /* KMH -- this is okay with unchanging */
                rehumanize();
                return;
            }
            mon_give_prop(magr, attrcurse());
        }
    } else {
        /* mhitm */
        if (!night() && (pa == mons[PM_GREMLIN]))
            return;
        if (!magr.mcan && !rn2(10)) {
            mdef.mcan = 1; /* cancelled regardless of lifesave */
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
            if (is_were(pd) && pd.mlet != S_HUMAN)
                were_change(mdef);
            if (pd == mons[PM_CLAY_GOLEM]) {
                if (gv.vis && canseemon(mdef)) {
                    pline(_("Some writing vanishes from %s head!"),
                          s_suffix(mon_nam(mdef)));
                    pline_mon(mdef, _("%s is destroyed!"), Monnam(mdef));
                }
                mondied(mdef);
                if (!DEADMONSTER(mdef)) {
                    mhm.hitflags = M_ATTK_MISS;
                    mhm.done = TRUE;
                    return;
                } else if (mdef.mtame && !gv.vis) {
                    You(brief_feeling, _("strangely sad"));
                }
                mhm.hitflags = (M_ATTK_DEF_DIED
                                 | (grow_up(magr, mdef) ? 0
                                    : M_ATTK_AGR_DIED));
                mhm.done = TRUE;
                return;
            }
            if (!Deaf()) {
                if (!gv.vis)
                    You_hear(_("laughter."));
                else if (canseemon(magr))
                    pline_mon(magr, _("%s chuckles."), Monnam(magr));
            }
        }
    }
}

/* Helper for mhitm_ad_drst(), containing some code that is also called from
 * mhitm_ad_phys (for poisoned weapons) and shouldn't be subject to magic
 * cancellation or a 1/8 chance roll.
 * In this specific case, the "mhitm" in the name ACTUALLY means just that -
 * this should be called only for monster versus monster situations. */
function mhitm_really_poison(magr, mattk,
                    mdef, mhm) { /* void */
    if (gv.vis && canspotmon(magr))
        pline(_("%s %s was poisoned!"), s_suffix(Monnam(magr)),
              mpoisons_subj(magr, mattk));
    if (resists_poison(mdef)) {
        if (gv.vis && canspotmon(mdef) && canspotmon(magr))
            pline_The(_("poison doesn't seem to affect %s."),
                        mon_nam(mdef));
    } else {
        mhm.damage += rn1(10, 6);
        if (mhm.damage >= mdef.mhp && gv.vis && canspotmon(mdef))
            pline_The(_("poison was deadly..."));
    }
}

export function mhitm_ad_drst(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    let negated = mhitm_mgc_atk_negated(magr, mdef, FALSE);
    let pa = magr.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (!negated && !rn2(8)) {
            Your(_("%s was poisoned!"), mpoisons_subj(magr, mattk));
            if (resists_poison(mdef)) {
                pline_The(_("poison doesn't seem to affect %s."), mon_nam(mdef));
            } else {
                if (!rn2(10)) {
                    Your(_("poison was deadly..."));
                    mhm.damage = mdef.mhp;
                } else
                    mhm.damage += rn1(10, 6);
            }
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        let ptmp = A_STR;  /* A_STR == 0 */
        let buf = stack_array(char, BUFSZ);

        switch (mattk.adtyp) {
        case AD_DRST: ptmp = A_STR; break;
        case AD_DRDX: ptmp = A_DEX; break;
        case AD_DRCO: ptmp = A_CON; break;
        }
        hitmsg(magr, mattk);
        if (!negated && !rn2(8)) {
            sprintf(buf, _("%s %s"), s_suffix(Monnam(magr)), mpoisons_subj(magr, mattk))
;
            poisoned(buf, ptmp, pmname(pa, Mgender(magr)), 30, FALSE);
        }
    } else {
        /* mhitm */
        if (!negated && !rn2(8)) {
            mhitm_really_poison(magr, mattk, mdef, mhm);
        }
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_drin(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    let pd = mdef.data;
    let amu;
    let lifsav;

    /*
     * Mind flayers have multiple AD_DRIN attacks (3 for plain mind flayer,
     * 5 for master mind flayer).  If one of those kills the target, skip
     * the others (for rest of attacker's current move).  To check whether
     * hero has been killed, we check mortality counter.  For a monster,
     * we check whether it was wearing an amulet of life-saving before the
     * attack and no longer wearing any amulet after the attack.
     */

    if (magr == gy.youmonst) {
        /* uhitm */
        let helmet;

        if (gn.notonhead || !has_head(pd)) {
            pline(_("%s doesn't seem harmed."), Monnam(mdef));
            /* hero should skip remaining AT_TENT+AD_DRIN attacks
               because they'll be just as harmless as this one (and also
               to reduce verbosity) */
            gs.skipdrin = TRUE;
            mhm.damage = 0;
            if (!Unchanging() && pd == mons[PM_GREEN_SLIME]) {
                if (!Slimed()) {
                    You(_("suck in some slime and don't feel very well."));
                    make_slimed(10, 0);
                }
            }
            return;
        }
        if (m_slips_free(mdef, mattk))
            return;

        if ((helmet = which_armor(mdef, W_ARMH)) != null && rn2(8)) {
            pline(_("%s %s blocks your attack to %s head."),
                  s_suffix(Monnam(mdef)), helm_simple_name(helmet),
                  mhis(mdef));
            return;
        }
        amu = which_armor(mdef, W_AMUL);
        lifsav = (amu && amu.otyp == AMULET_OF_LIFE_SAVING ? 1 : 0);

        eat_brains(gy.youmonst, mdef, TRUE, ref_of(mhm, "damage"));

        /* skip further AD_DRIN if amulet of life-saving got used up */
        if (lifsav && !which_armor(mdef, W_AMUL))
            gs.skipdrin = TRUE;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (defends(AD_DRIN, uwep) || !has_head(pd)) {
            You(_("don't seem harmed."));
            /* attacker should skip remaining AT_TENT+AD_DRIN attacks */
            gs.skipdrin = TRUE;
            /* Not clear what to do for green slimes */
            return;
        }
        if (u_slip_free(magr, mattk))
            return;

        if (uarmh && rn2(8)) {
            /* not body_part(HEAD) */
            Your(_("%s blocks the attack to your head."),
                 helm_simple_name(uarmh));
            return;
        }
        /* negative armor class doesn't reduce this damage */
        if (Half_physical_damage())
            mhm.damage = Math.trunc((mhm.damage + 1) / 2);
        mdamageu(magr, mhm.damage);
        mhm.damage = 0; /* don't inflict a second dose below */

        if (!uarmh || uarmh.otyp != DUNCE_CAP) {
            let oldmort = u.umortality,
                mhitu = eat_brains(magr, mdef, TRUE, null);

            /* skip further AD_DRIN if hero's number of deaths went up */
            if (u.umortality > oldmort)
                gs.skipdrin = TRUE;
            /* eat_brains() will miss if target is mindless (won't
               happen here--hero is considered to retain his mind
               regardless of current shape) or is noncorporeal
               (can't happen here--no one can poly into a ghost
               or shade) so this check for missing is academic */
            if (mhitu == M_ATTK_MISS)
                return;
        }
        /* adjattrib gives dunce cap message when appropriate */
        adjattrib(A_INT, -rnd(2), FALSE);
        if (!rn2(5)) {
            losespells();
            gs.skipdrin = TRUE;
        }
        if (!rn2(5)) {
            drain_weapon_skill(rnd(2));
            gs.skipdrin = TRUE;
        }
    } else {
        /* mhitm */
        let buf = stack_array(char, BUFSZ);

        if (gn.notonhead || !has_head(pd)) {
            if (gv.vis && canspotmon(mdef))
                pline_mon(mdef, _("%s doesn't seem harmed."), Monnam(mdef));
            /* Not clear what to do for green slimes */
            mhm.damage = 0;
            /* don't bother with additional DRIN attacks since they wouldn't
               be able to hit target on head either */
            gs.skipdrin = TRUE; /* affects mattackm()'s attack loop */
            return;
        }
        if ((mdef.misc_worn_check & W_ARMH) && rn2(8)) {
            if (gv.vis && canspotmon(magr) && canseemon(mdef)) {
                strcpy(buf, s_suffix(Monnam(mdef)));
                pline(_("%s helmet blocks %s attack to %s head."), buf,
                      s_suffix(mon_nam(magr)), mhis(mdef));
            }
            return;
        }
        amu = which_armor(mdef, W_AMUL);
        lifsav = (amu && amu.otyp == AMULET_OF_LIFE_SAVING ? 1 : 0);

        mhm.hitflags = eat_brains(magr, mdef, gv.vis, ref_of(mhm, "damage"));

        /* skip further AD_DRIN if amulet of life-saving got used up */
        if (lifsav && !which_armor(mdef, W_AMUL))
            gs.skipdrin = TRUE;
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_stck(
    magr, mattk,
    mdef, mhm) { /* void */
    let negated = mhitm_mgc_atk_negated(magr, mdef, FALSE);
    let pd = mdef.data;
    let barbs = +(magr.data == mons[PM_BARBED_DEVIL]);

    if (magr == gy.youmonst) {
        /* uhitm */
        if (!negated && !sticks(pd) && m_next2u(mdef)) {
            set_ustuck(mdef); /* it's now stuck to you */
            if (barbs)
                Your(_("barbs stick to %s!"), y_monnam(mdef));
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!negated && !u.ustuck && !sticks(pd)) {
            set_ustuck(magr);
            if (barbs)
                pline(_("The barbs stick to you!"));
        }
    } else {
        /* mhitm */
        if (negated)
            mhm.damage = 0;
    }
}

export function mhitm_ad_wrap(
    magr, mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data, pa = magr.data;
    let coil = +(slithy(pa) && (pa.mlet == S_SNAKE || pa.mlet == S_NAGA));

    if (magr == gy.youmonst) {
        /* uhitm */
        if (!sticks(pd)) {
            let tailmiss = +!gn.notonhead;

            if (!u.ustuck && !tailmiss && !rn2(10)) {
                if (m_slips_free(mdef, mattk)) {
                    mhm.damage = 0;
                } else {
                    You(_("%s yourself around %s!"),
                        coil ? _("coil") : _("swing"), mon_nam(mdef));
                    set_ustuck(mdef);
                }
            } else if (u.ustuck == mdef && !tailmiss) {
                /* Monsters don't wear amulets of magical breathing */
                if (is_pool(u.ux, u.uy) && !cant_drown(pd)) {
                    You(_("drown %s..."), mon_nam(mdef));
                    mhm.damage = mdef.mhp;
                } else if (mattk.aatyp == AT_HUGS)
                    pline(_("%s is being crushed."), Monnam(mdef));
            } else {
                mhm.damage = 0;
                if (flags.verbose) {
                    if (coil && !tailmiss)
                        You(_("brush against %s."), mon_nam(mdef));
                    else
                        You(_("brush against %s %s."), s_suffix(mon_nam(mdef)),
                            tailmiss ? _("tail") : mbodypart(mdef, LEG));
                }
            }
        } else
            mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        if ((!magr.mcan || u.ustuck == magr) && !sticks(pd)) {
            if (!u.ustuck && !rn2(10)) {
                if (u_slip_free(magr, mattk)) {
                    mhm.damage = 0;
                } else {
                    set_ustuck(magr); /* before message, for botl update */
                    urgent_pline(_("%s %s itself around you!"),
                                 Some_Monnam(magr),
                                 coil ? _("coils") : _("swings"));
                }
            } else if (u.ustuck == magr) {
                if (is_pool(magr.mx, magr.my) && !Swimming() && !Amphibious()
                    && !Breathless()) {
                    let moat = +((levl()[magr.mx][magr.my].typ != POOL)
                                   && !is_waterwall(magr.mx, magr.my)
                                   && !Is_medusa_level(u.uz)
                                   && !Is_waterlevel(u.uz));

                    urgent_pline(_("%s drowns you..."), Monnam(magr));
                    svk.killer.format = KILLED_BY_AN;
                    sprintf(svk.killer.name, _("%s by %s"), moat ? _("moat") : _("pool of water"), an(pmname(magr.data, Mgender(magr))))

;
                    done(DROWNING);
                } else if (mattk.aatyp == AT_HUGS) {
                    You(_("are being crushed."));
                }
            } else {
                mhm.damage = 0;
                if (flags.verbose) {
                    if (coil)
                        pline_mon(magr, _("%s brushes against you."),
                                  Monnam(magr));
                    else
                        pline_mon(magr, _("%s brushes against your %s."),
                                  Monnam(magr), body_part(LEG));
                }
            }
        } else
            mhm.damage = 0;
    } else {
        /* mhitm */
        if (magr.mcan)
            mhm.damage = 0;

        if (!mhm.damage && (canseemon(magr) || canseemon(mdef))) {
            pline(_("%s brushes against %s."),
                  Some_Monnam(magr), some_mon_nam(mdef));
        }
    }
}

export function mhitm_ad_plys(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    if (magr == gy.youmonst) {
        /* uhitm */
        if (!rn2(3) && mhm.damage < mdef.mhp
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            if (!Blind())
                pline(_("%s is frozen by you!"), Monnam(mdef));
            paralyze_monst(mdef, rnd(10));
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (gm.multi >= 0 && !rn2(3)
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            if (Free_action()) {
                You(_("momentarily stiffen."));
            } else {
                if (Blind())
                    You(_("are frozen!"));
                else
                    You(_("are frozen by %s!"), mon_nam(magr));
                gn.nomovemsg = You_can_move_again();
                nomul(-rnd(10));
                /* set gm.multi_reason;
                   3.6.x used "paralyzed by a monster"; be more specific */
                dynamic_multi_reason(magr, _("paralyzed"), FALSE);
                exercise(A_DEX, FALSE);
            }
        }
    } else {
        /* mhitm */
        if (mdef.mcanmove && !rn2(3)
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            if (gv.vis && canspotmon(mdef)) {
                let buf = stack_array(char, BUFSZ);

                strcpy(buf, Monnam(mdef));
                pline(_("%s is frozen by %s."), buf, mon_nam(magr));
            }
            paralyze_monst(mdef, rnd(10));
        }
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_slee(
    magr, mattk,
    mdef,
    mhm) { /* void */
    const $frame = stack_frame(); try {
    if (magr == gy.youmonst) {
        /* uhitm */
        if (!mdef.msleeping && !mhitm_mgc_atk_negated(magr, mdef, FALSE)
            && sleep_monst(mdef, rnd(10), -1)) {
            if (!Blind())
                pline(_("%s is put to sleep by you!"), Monnam(mdef));
            slept_monst(mdef);
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (gm.multi >= 0 && !rn2(5)
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            if (Sleep_resistance()) {
                monstseesu(M_SEEN_SLEEP);
                return;
            }
            monstunseesu(M_SEEN_SLEEP);
            fall_asleep(-rnd(10), TRUE);
            if (Blind())
                You(_("are put to sleep!"));
            else
                You(_("are put to sleep by %s!"), mon_nam(magr));
        }
    } else {
        /* mhitm */
        if (!mdef.msleeping && sleep_monst(mdef, rnd(10), -1)
            && sleep_monst(mdef, rnd(10), -1)) {
            if (gv.vis && canspotmon(mdef)) {
                let buf = stack_array(char, BUFSZ);

                strcpy(buf, Monnam(mdef));
                pline(_("%s is put to sleep by %s."), buf, mon_nam(magr));
            }
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
            slept_monst(mdef);
        }
    }
    } finally { stack_pop($frame); }
}

/* slime */
export function mhitm_ad_slim(
    magr, mattk,
    mdef, mhm) { /* void */
    let negated = mhitm_mgc_atk_negated(magr, mdef, FALSE);
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (negated)
            return; /* physical damage only */
        if (!rn2(4) && !slimeproof(pd)) {
            if (!munslime(mdef, TRUE) && !DEADMONSTER(mdef)) {
                /* this assumes newcham() won't fail; since hero has
                   a slime attack, green slimes haven't been geno'd */
                You(_("turn %s into slime."), mon_nam(mdef));
                if (newcham(mdef, mons[PM_GREEN_SLIME], NO_NC_FLAGS))
                    pd = mdef.data;
            }
            /* munslime attempt could have been fatal */
            if (DEADMONSTER(mdef)) {
                mhm.hitflags = M_ATTK_DEF_DIED; /* skip death message */
                mhm.done = TRUE;
                return;
            }
            mhm.damage = 0;
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (negated) {
            if (!magr.mcan)
                You(_("escape harm."));
            return;
        }
        if (flaming(pd)) {
            pline_The(_("slime burns away!"));
            mhm.damage = 0;
        } else if (Unchanging() || noncorporeal(pd)
                   || pd == mons[PM_GREEN_SLIME]) {
            You(_("are unaffected."));
            mhm.damage = 0;
        } else if (!Slimed()) {
            You(_("don't feel very well."));
            make_slimed(10, 0);
            delayed_killer(SLIMED, KILLED_BY_AN,
                           pmname(magr.data, Mgender(magr)));
        } else
            pline(_("Yuck!"));
    } else {
        /* mhitm */
        if (negated)
            return; /* physical damage only */
        if (!rn2(4) && !slimeproof(pd)) {
            if (!munslime(mdef, FALSE) && !DEADMONSTER(mdef)) {
                let ncflags = NO_NC_FLAGS;

                if (gv.vis && canseemon(mdef))
                    ncflags = unsigned(ncflags | NC_SHOW_MSG);
                if (newcham(mdef, mons[PM_GREEN_SLIME], ncflags))
                    pd = mdef.data;
                mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
                mhm.hitflags = M_ATTK_HIT;
            }
            /* munslime attempt could have been fatal,
               potentially to multiple monsters (SCR_FIRE) */
            if (DEADMONSTER(magr))
                mhm.hitflags |= M_ATTK_AGR_DIED;
            if (DEADMONSTER(mdef))
                mhm.hitflags |= M_ATTK_DEF_DIED;
            mhm.damage = 0;
        }
    }
    (pd);
}

export function mhitm_ad_ench(
    magr, mattk,
    mdef,
    mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        /* there's no msomearmor() function, so just do damage */
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        let negated = mhitm_mgc_atk_negated(magr, mdef, FALSE);

        hitmsg(magr, mattk);
        /* uncancelled is sufficient enough; please
           don't make this attack less frequent */
        if (!negated) {
            let obj = some_armor(mdef);

            if (!obj) {
                /* some rings are susceptible;
                   amulets and blindfolds aren't (at present) */
                switch (rn2(5)) {
                case 0:
                    break;
                case 1:
                    obj = uright;
                    break;
                case 2:
                    obj = uleft;
                    break;
                case 3:
                    obj = uamul;
                    break;
                case 4:
                    obj = ublindf;
                    break;
                }
            }
            if (obj && drain_item(obj, FALSE)) {
                pline(_("%s less effective."), Yobjnam2(obj, _("seem")));
            }
        }
    } else {
        /* mhitm */
        /* there's no msomearmor() function, so just do damage */
    }
}

export function mhitm_ad_slow(
    magr, mattk,
    mdef,
    mhm) { /* void */
    let negated = mhitm_mgc_atk_negated(magr, mdef, FALSE);

    if (defended(mdef, AD_SLOW))
        return;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (!negated && mdef.mspeed != MSLOW) {
            let oldspeed = mdef.mspeed;

            mon_adjust_speed(mdef, -1, null);
            if (mdef.mspeed != oldspeed && canseemon(mdef))
                pline(_("%s slows down."), Monnam(mdef));
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!negated && HFast() && !rn2(4))
            u_slow_down();
    } else {
        /* mhitm */
        if (!negated && mdef.mspeed != MSLOW) {
            let oldspeed = mdef.mspeed;

            mon_adjust_speed(mdef, -1, null);
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
            if (mdef.mspeed != oldspeed && gv.vis && canspotmon(mdef))
                pline_mon(mdef, _("%s slows down."), Monnam(mdef));
        }
    }
}

export function mhitm_ad_conf(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        if (!mdef.mconf) {
            if (canseemon(mdef))
                pline(_("%s looks confused."), Monnam(mdef));
            mdef.mconf = 1;
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!magr.mcan && !rn2(4) && !magr.mspec_used) {
            magr.mspec_used = magr.mspec_used + (mhm.damage + rn2(6));
            if (Confusion())
                You(_("are getting even more confused."));
            else
                You(_("are getting confused."));
            make_confused(HConfusion() + mhm.damage, FALSE);
        }
        mhm.damage = 0;
    } else {
        /* mhitm */
        /* Since confusing another monster doesn't have a real time
         * limit, setting spec_used would not really be right (though
         * we still should check for it).
         */
        if (!magr.mcan && !mdef.mconf && !magr.mspec_used) {
            if (gv.vis && canseemon(mdef))
                pline_mon(mdef, _("%s looks confused."), Monnam(mdef));
            mdef.mconf = 1;
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        }
    }
}

export function mhitm_ad_poly(
    magr, mattk,
    mdef, mhm) { /* void */
    let negated = (mhitm_mgc_atk_negated(magr, mdef, FALSE)
                       || magr.mspec_used ? 1 : 0);

    if (magr == gy.youmonst) {
        /* uhitm */
        /* require weaponless attack in order to honor AD_POLY */
        if (!uwep && mhm.damage < mdef.mhp) {
            if (negated) {
                /* assume that you can tell by touch if blinded */
                pline(_("%s is not transformed."), Monnam(mdef));
            } else {
                mhm.damage = mon_poly(gy.youmonst, mdef, mhm.damage);
                if (DEADMONSTER(mdef))
                    mhm.hitflags |= M_ATTK_DEF_DIED;
                mhm.hitflags |= M_ATTK_HIT;
                mhm.done = TRUE;
            }
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (((Half_physical_damage()) ? (Math.trunc((((mhm.damage) + 1) / 2))) : (mhm.damage)) < (Upolyd() ? u.mh : u.uhp)) {
            if (negated) {
                if (magr.mcan)
                    You(_("aren't transformed."));
            } else {
                mhm.damage = mon_poly(magr, gy.youmonst, mhm.damage);
                mhm.hitflags |= M_ATTK_HIT;
                mhm.done = TRUE;
            }
        }
    } else {
        /* mhitm */
        if (mhm.damage < mdef.mhp && !negated) {
            mhm.damage = mon_poly(magr, mdef, mhm.damage);
            if (DEADMONSTER(mdef))
                mhm.hitflags |= M_ATTK_DEF_DIED;
            mhm.hitflags |= M_ATTK_HIT;
            mhm.done = TRUE;
        }
    }
}

export function mhitm_ad_famn(
    magr,
    mattk,
    mdef, mhm) { /* void */
    let $goto = null;
    var pd = mdef.data;

    $goto_mhitm_famn: for (;;) { switch ($goto) { default: case "mhitm_famn": if (!$goto && (magr == gy.youmonst)) {
        /* uhitm; hero can't polymorph into anything with this attack
           so this won't happen; if it could, it would be the same as
           the mhitm case except for messaging */
        { $goto = "mhitm_famn"; continue $goto_mhitm_famn; }
    } else if (!$goto && (mdef == gy.youmonst)) {
        /* mhitu */
        pline_mon(magr, _("%s reaches out, and your body shrivels."),
                  Monnam(magr));
        exercise(A_CON, FALSE);
        if (!is_fainted())
            morehungry(rn1(40, 40));
        /* plus the normal damage */
    } else {
 $goto = null;
        /* mhitm; it's possible for Famine to hit another monster;
           if target is something that doesn't eat, it won't be harmed;
           otherwise, just inflict the normal damage */
        if (!(carnivorous(pd) || herbivorous(pd) || metallivorous(pd)))
            mhm.damage = 0;
    } } break; }
}

export function mhitm_ad_pest(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var alt_attk = stack_struct(struct_attack);

    var pa = magr.data;

    $goto_mhitm_pest: for (;;) { switch ($goto) { default: case "mhitm_pest": if (!$goto && (magr == gy.youmonst)) {
        /* uhitm; hero can't polymorph into anything with this attack
           so this won't happen; if it could, it would be the same as
           the mhitm case except for messaging */
        { $goto = "mhitm_pest"; continue $goto_mhitm_pest; }
    } else if (!$goto && (mdef == gy.youmonst)) {
        /* mhitu */
        pline_mon(magr, _("%s reaches out, and you feel fever and chills."),
                  Monnam(magr));
        diseasemu(pa);
        /* plus the normal damage */
    } else {
 $goto = null;
        /* mhitm; it's possible for Pestilence to hit another monster;
           treat it the same as an attack for AD_DISE damage */
        struct_assign(alt_attk, mattk);
        alt_attk.adtyp = AD_DISE;
        mhitm_ad_dise(magr, alt_attk, mdef, mhm);
    } } break; }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_deth(
    magr,
    mattk,
    mdef, mhm) { /* void */
    let $goto = null;
    var pd = mdef.data;

    $goto_mhitm_deth: for (;;) { switch ($goto) { default: case "mhitm_deth": if (!$goto && (magr == gy.youmonst)) {
        /* uhitm; hero can't polymorph into anything with this attack
           so this won't happen; if it could, it would be the same as
           the mhitm case except for messaging */
        { $goto = "mhitm_deth"; continue $goto_mhitm_deth; }
    } else if (!$goto && (mdef == gy.youmonst)) {
        /* mhitu */
        pline_mon(magr, _("%s reaches out with its deadly touch."), Monnam(magr));
        if (is_undead(pd)) {
            /* still does some damage */
            mhm.damage = Math.trunc((mhm.damage + 1) / 2);
            pline(_("Was that the touch of death?"));
            return;
        }
        switch (rn2(20)) {
        case 19:
        case 18:
        case 17:
            if (!Antimagic()) {
                touch_of_death(magr);
                mhm.damage = 0;
                return;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        default: /* case 16: ... case 5: */
            You_feel(_("your life force draining away..."));
            mhm.permdmg = 1; /* actual damage done by caller */
            return;
        case 4:
        case 3:
        case 2:
        case 1:
        case 0:
            if (Antimagic())
                shieldeff(u.ux, u.uy);
            pline(_("Lucky for you, it didn't work!"));
            mhm.damage = 0;
            return;
        }
    } else {
 $goto = null;
        /* mhitm; it's possible for Death to hit another monster;
           if target is undead, it will take some damage but less than an
           undead hero would; otherwise, just inflict the normal damage */
        if (is_undead(pd) && mhm.damage > 1)
            mhm.damage = rnd(Math.trunc(mhm.damage / 2));
        /* simulate Death's touch with drain life attack */
        mhitm_ad_drli(magr, mattk, mdef, mhm);
    } } break; }
}

export function mhitm_ad_halu(
    magr,
    mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        mhm.damage = 0;
    } else {
        /* mhitm */
        if (!magr.mcan && haseyes(pd) && mdef.mcansee) {
            if (gv.vis && canseemon(mdef))
                pline_mon(mdef, _("%s looks %sconfused."), Monnam(mdef),
                      mdef.mconf ? _("more ") : _(""));
            mdef.mconf = 1;
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
        }
        mhm.damage = 0;
    }
}

export function do_stone_u(mtmp) { /* boolean */
    if (!Stoned() && !Stone_resistance()
        && !(poly_when_stoned(gy.youmonst.data)
             && polymon(PM_STONE_GOLEM))) {
        let kformat = KILLED_BY_AN;
        let kname = pmname(mtmp.data, Mgender(mtmp));

        if (mtmp.data.geno & G_UNIQ) {
            if (!type_is_pname(mtmp.data))
                kname = the(kname);
            kformat = KILLED_BY;
        }
        make_stoned(5, 0, kformat, kname);
        return 1;
        /* done_in_by(mtmp, STONING); */
    }
    return 0;
}

export function do_stone_mon(
    magr,
    mattk,
    mdef, mhm) { /* void */
    let $goto = null;
    var pd = mdef.data;

    /* may die from the acid if it eats a stone-curing corpse */
    $goto_post_stone: for (;;) { switch ($goto) { default: if (munstone(mdef, FALSE))
        { $goto = "post_stone"; continue $goto_post_stone; };
    if (poly_when_stoned(pd)) {
        mon_to_stone(mdef);
        mhm.damage = 0;
        return;
    }
    case "post_stone": if ($goto || (!resists_ston(mdef))) {
        switch ($goto) { default: if (gv.vis && canseemon(mdef))
            pline_mon(mdef, _("%s turns to stone!"), Monnam(mdef));
        monstone(mdef);
 case "post_stone": $goto = null;
        if (!DEADMONSTER(mdef)) {
            mhm.hitflags = M_ATTK_MISS;
            mhm.done = TRUE;
            return;
        } else if (mdef.mtame && !gv.vis) {
            You(brief_feeling, _("peculiarly sad"));
        } }
        mhm.hitflags = (M_ATTK_DEF_DIED
                         | (grow_up(magr, mdef) ? 0 : M_ATTK_AGR_DIED));
        mhm.done = TRUE;
        return;
    } } break; }
    mhm.damage = (mattk.adtyp == AD_STON ? 0 : 1);
}

export function mhitm_ad_phys(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    let pa = magr.data;
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (pd == mons[PM_SHADE]) {
            mhm.damage = 0;
            if (!mhm.specialdmg)
                impossible(_("bad shade attack function flow?"));
        }
        mhm.damage += mhm.specialdmg;

        if (mattk.aatyp == AT_WEAP) {
            /* hmonas() uses known_hitum() to deal physical damage,
               then also damageum() for non-AD_PHYS; don't inflict
               extra physical damage for unusual damage types */
            mhm.damage = 0;
        } else if (mattk.aatyp == AT_KICK
                   || mattk.aatyp == AT_CLAW
                   || mattk.aatyp == AT_TUCH
                   || mattk.aatyp == AT_HUGS) {
            if (thick_skinned(pd))
                mhm.damage = (mattk.aatyp == AT_KICK) ? 0
                              : Math.trunc((mhm.damage + 1) / 2);
            /* add ring(s) of increase damage */
            if (u.udaminc > 0) {
                /* applies even if damage was 0 */
                mhm.damage += u.udaminc;
            } else if (mhm.damage > 0) {
                /* ring(s) might be negative; avoid converting
                   0 to non-0 or positive to non-positive */
                mhm.damage += u.udaminc;
                if (mhm.damage < 1)
                    mhm.damage = 1;
            }
        }
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        if (mattk.aatyp == AT_HUGS && !sticks(pd)) {
            if (!u.ustuck && rn2(2)) {
                if (u_slip_free(magr, mattk)) {
                    mhm.damage = 0;
                    mhm.hitflags |= M_ATTK_MISS;
                } else {
                    set_ustuck(magr);
                    pline_mon(magr, _("%s grabs you!"), Monnam(magr));
                    mhm.hitflags |= M_ATTK_HIT;
                }
            } else if (u.ustuck == magr) {
                exercise(A_STR, FALSE);
                You(_("are being %s."),
                    (pa == mons[PM_ROPE_GOLEM]) ? _("choked") : _("crushed"));
            }
        } else { /* hand to hand weapon */
            let otmp = MON_WEP(magr);

            if (mattk.aatyp == AT_WEAP && otmp) {
                let marmg;
                let tmp;
                let was_poisoned = (otmp.otrapped
                                        || permapoisoned(otmp) ? 1 : 0);

                if (otmp.otyp == CORPSE
                    && touch_petrifies(mons[otmp.corpsenm])) {
                    mhm.damage = 1;
                    pline_mon(magr, _("%s hits you with the %s corpse."),
                              Monnam(magr),
                              mons[otmp.corpsenm].pmnames[NEUTRAL]);
                    if (!Stoned()) {
                        if (do_stone_u(magr)) {
                            mhm.hitflags = M_ATTK_HIT;
                            mhm.done = 1;
                            return;
                        }
                    }
                }
                mhm.damage += dmgval(otmp, mdef);
                if ((marmg = which_armor(magr, W_ARMG)) != null
                    && marmg.otyp == GAUNTLETS_OF_POWER)
                    mhm.damage += rn1(4, 3); /* 3..6 */
                if (mhm.damage <= 0)
                    mhm.damage = 1;
                if (!otmp.oartifact
                    || !artifact_hit(magr, mdef, otmp, ref_of(mhm, "damage"),
                                     gm.mhitu_dieroll)) {
                    hitmsg(magr, mattk);
                    mhm.hitflags |= M_ATTK_HIT;
                }
                if (!mhm.damage)
                    return;
                if (objects[otmp.otyp].oc_material == SILVER
                    && Hate_silver()) {
                    pline_The(_("silver sears your flesh!"));
                    exercise(A_CON, FALSE);
                }
                /* this redundancy necessary because you have
                   to take the damage _before_ being cloned;
                   need to have at least 2 hp left to split */
                tmp = mhm.damage;
                if (u.uac < 0)
                    tmp -= rnd(-u.uac);
                if (tmp < 1)
                    tmp = 1;
                if (Half_physical_damage())
                    tmp = Math.trunc((tmp + 1) / 2);

                if (u.mh - tmp > 1
                    && (objects[otmp.otyp].oc_material == IRON
                        /* relevant 'metal' objects are scalpel and tsurugi */
                        || objects[otmp.otyp].oc_material == METAL)
                    && (u.umonnum == PM_BLACK_PUDDING
                        || u.umonnum == PM_BROWN_PUDDING)) {
                    if (tmp > 1)
                        exercise(A_STR, FALSE);
                    /* inflict damage now; we know it can't be fatal */
                    u.mh -= tmp;
                    disp.botl = TRUE;
                    mhm.damage = 0; /* don't inflict more damage below */
                    if (cloneu())
                        You(_("divide as %s hits you!"), mon_nam(magr));
                }
                rustm(gy.youmonst, otmp);
                if (was_poisoned && gm.mhitu_dieroll <= 5) {
                    let buf = stack_array(char, BUFSZ);

                    /* similar to mhitm_really_poison, but we don't use the
                     * exact same values, nor do we want same 1/8 chance of
                     * poison taking (use 1/4, same as in the mhitm case). */
                    sprintf(buf, _("%s %s"), s_suffix(Monnam(magr)), mpoisons_subj(magr, mattk))
;
                    /* arbitrary, but most poison sources in the game are
                     * strength-based. With hpdamchance = 10, HP damage occurs
                     * 1/2 of the time and it will hit Str rest of the time.
                     * (This is the same as poisoned ammo.) */
                    poisoned(buf, A_STR, pmname(magr.data, Mgender(magr)),
                             10, FALSE);
                }
            } else if (mattk.aatyp != AT_TUCH || mhm.damage != 0
                       || magr != u.ustuck) {
                hitmsg(magr, mattk);
                mhm.hitflags |= M_ATTK_HIT;
            }
        }
    } else {
        /* mhitm */
        let mwep = MON_WEP(magr);
        let vis = (canseemon(magr) && canseemon(mdef) ? 1 : 0);

        if (mattk.aatyp != AT_WEAP && mattk.aatyp != AT_CLAW)
            mwep = null;

        if (shade_miss(magr, mdef, mwep, FALSE, vis)) {
            mhm.damage = 0;
        } else if (mattk.aatyp == AT_KICK && thick_skinned(pd)) {
            /* [no 'kicking boots' check needed; monsters with kick attacks
               can't wear boots and monsters that wear boots don't kick] */
            mhm.damage = 0;
        } else if (mwep) { /* non-Null 'mwep' implies AT_WEAP || AT_CLAW */
            let marmg;

            if (mwep.otyp == CORPSE
                && touch_petrifies(mons[mwep.corpsenm])) {
                do_stone_mon(magr, mattk, mdef, mhm);
                if (mhm.done)
                    return;
            }

            mhm.damage += dmgval(mwep, mdef);
            if ((marmg = which_armor(magr, W_ARMG)) != null
                && marmg.otyp == GAUNTLETS_OF_POWER)
                mhm.damage += rn1(4, 3); /* 3..6 */
            if (mhm.damage < 1) /* is this necessary?  mhitu.c has it... */
                mhm.damage = 1;
            if (mwep.oartifact) {
                /* when magr's weapon is an artifact, caller suppressed its
                   usual 'hit' message in case artifact_hit() delivers one;
                   now we'll know and might need to deliver skipped message
                   (note: if there's no message there'll be no auxiliary
                   damage so the message here isn't coming too late) */
                if (!artifact_hit(magr, mdef, mwep, ref_of(mhm, "damage"),
                                  mhm.dieroll)) {
                    if (gv.vis)
                        pline_mon(magr, _("%s hits %s."), Monnam(magr),
                              mon_nam_too(mdef, magr));
                    mhm.hitflags |= M_ATTK_HIT;
                }
                /* artifact_hit updates 'tmp' but doesn't inflict any
                   damage; however, it might cause carried items to be
                   destroyed and they might do so */
                if (DEADMONSTER(mdef)) {
                    mhm.hitflags = (M_ATTK_DEF_DIED
                                     | (grow_up(magr, mdef) ? 0
                                        : M_ATTK_AGR_DIED));
                    mhm.done = TRUE;
                    return;
                }
            }
            if (mhm.damage)
                rustm(mdef, mwep);
            if ((mwep.otrapped || permapoisoned(mwep)) && !rn2(4)) {
                /* 1/4 chance of weapon poison applying is the same as in
                 * uhitm and mhitu cases. But since we don't need to call
                 * any special functions or go through tangled hmon_hitmon
                 * code, we can just jump straight to the poisoning. */
                mhitm_really_poison(magr, mattk, mdef, mhm);
            }
        } else if (pa == mons[PM_PURPLE_WORM] && pd == mons[PM_SHRIEKER]) {
            /* hack to enhance mm_aggression(); we don't want purple
               worm's bite attack to kill a shrieker because then it
               won't swallow the corpse; but if the target survives,
               the subsequent engulf attack should accomplish that */
            if (mhm.damage >= mdef.mhp && mdef.mhp > 1)
                mhm.damage = mdef.mhp - 1;
        }
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_ston(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        if (!munstone(mdef, TRUE))
            minstapetrify(mdef, TRUE);
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!rn2(3)) {
            if (magr.mcan) {
                if (!Deaf())
                    You_hear(_("a cough from %s!"), mon_nam(magr));
            } else {
                if (Hallucination() && !Blind()) {
                     ;
                    You_hear(_("hissing.")); /* You_hear() deals with Deaf */
                    pline(_("%s appears to be blowing you a kiss..."),
                          Monnam(magr));
                } else if (!Deaf()) {
                    You_hear(_("%s hissing!"), s_suffix(mon_nam(magr)));
                } else if (!Blind()) {
                    pline(_("%s seems to grimace."), Monnam(magr));
                }
                /*
                 * 5.0:  New moon is no longer overridden by carrying a
                 * lizard corpse.  Having the moon's impact on terrestrial
                 * activity be affected by carrying a dead critter felt
                 * silly.
                 *
                 * That behavior dated to when there were no corpse objects
                 * yet; "dead lizard" was a distinct item.  With a lizard
                 * corpse, hero can eat it to survive petrification and
                 * probably retain a partly eaten corpse for future use.
                 *
                 * Maintaining foodless conduct during a new moon might
                 * become a little harder.  Clearing out cockatrice nests
                 * during a new moon could become quite a bit harder.
                 */
                if (!rn2(10) || flags.moonphase == NEW_MOON) {
                    if (do_stone_u(magr)) {
                        mhm.hitflags = M_ATTK_HIT;
                        mhm.done = TRUE;
                        return;
                    }
                }
            }
        }
    } else {
        /* mhitm */
        if (magr.mcan)
            return;
        do_stone_mon(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    }
}

export function mhitm_ad_were(
    magr, mattk,
    mdef, mhm) { /* void */
    let pa = magr.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!rn2(4) && u.ulycn == NON_PM
            && !Protection_from_shape_changers() && !defends(AD_WERE, uwep)
            && !mhitm_mgc_atk_negated(magr, mdef, TRUE)) {
            urgent_pline(_("You feel feverish."));
            exercise(A_CON, FALSE);
            set_ulycn(monsndx(pa));
            retouch_equipment(2);
        }
    } else {
        /* mhitm */
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    }
}

export function mhitm_ad_heal(
    magr, mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        /* a cancelled nurse is just an ordinary monster,
         * nurses don't heal those that cause petrification */
        if (magr.mcan || (Upolyd() && touch_petrifies(pd))) {
            hitmsg(magr, mattk);
            return;
        }
        /* weapon check should match the one in sounds.c for MS_NURSE */
        if (!(uwep && (uwep.oclass == WEAPON_CLASS || is_weptool(uwep)))
            && !uarmu && !uarm && !uarmc
            && !uarms && !uarmg && !uarmf && !uarmh) {
            let goaway = FALSE;

            pline_mon(magr, _("%s hits!  (I hope you don't mind.)"),
                      Monnam(magr));
            if (Upolyd()) {
                u.mh += rnd(7);
                if (!rn2(7)) {
                    /* no upper limit necessary; effect is temporary */
                    u.mhmax++;
                    if (!rn2(13))
                        goaway = TRUE;
                }
                if (u.mh > u.mhmax)
                    u.mh = u.mhmax;
            } else {
                u.uhp += rnd(7);
                if (!rn2(7)) {
                    /* hard upper limit via nurse care: 25 * ulevel */
                    if (u.uhpmax < 5 * u.ulevel + d(2 * u.ulevel, 10)) {
                        u.uhpmax++;
                        if (u.uhpmax > u.uhppeak)
                            u.uhppeak = u.uhpmax;
                    }
                    if (!rn2(13))
                        goaway = TRUE;
                }
                if (u.uhp > u.uhpmax)
                    u.uhp = u.uhpmax;
            }
            if (!rn2(3))
                exercise(A_STR, TRUE);
            if (!rn2(3))
                exercise(A_CON, TRUE);
            if (Sick())
                make_sick(0, 0, FALSE, SICK_ALL);
            disp.botl = TRUE;
            if (goaway) {
                mongone(magr);
                mhm.done = TRUE;
                mhm.hitflags = M_ATTK_DEF_DIED; /* return 2??? */
                return;
            } else if (!rn2(33)) {
                if (!tele_restrict(magr))
                    rloc(magr, RLOC_MSG);
                monflee(magr, d(3, 6), TRUE, FALSE);
                mhm.done = TRUE;
                mhm.hitflags = M_ATTK_HIT | M_ATTK_DEF_DIED; /* return 3??? */
                return;
            }
            mhm.damage = 0;
        } else {
            if (Role_if(PM_HEALER)) {
                if (!Deaf() && !(svm.moves % 5)) {
                       ;
                    verbalize(_("Doc, I can't help you unless you cooperate."));
                }
                mhm.damage = 0;
            } else
                hitmsg(magr, mattk);
        }
    } else {
        /* mhitm */
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    }
}

export function mhitm_ad_stun(
    magr, mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        if (!Blind())
            pline(_("%s %s for a moment."), Monnam(mdef),
                  makeplural(stagger(pd, _("stagger"))));
        mdef.mstun = 1;
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!magr.mcan && !rn2(4)) {
            make_stunned((HStun() & TIMEOUT) + mhm.damage, TRUE);
            mhm.damage = Math.trunc(mhm.damage / 2);
        }
    } else {
        /* mhitm */
        if (magr.mcan)
            return;
        if (canseemon(mdef))
            pline_mon(mdef, _("%s %s for a moment."), Monnam(mdef),
                  makeplural(stagger(pd, _("stagger"))));
        mdef.mstun = 1;
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    }
}

export function mhitm_ad_legs(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */

        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        let side = rn2(2) ? RIGHT_SIDE : LEFT_SIDE;
        let sidestr = (side == RIGHT_SIDE) ? _("right") : _("left"),
                   Monst_name = Monnam(magr), leg = body_part(LEG);

        /* This case is too obvious to ignore, but Nethack is not in
         * general very good at considering height--most short monsters
         * still _can_ attack you when you're flying or mounted.
         */
        if ((u.usteed || Levitation() || Flying()) && !is_flyer(magr.data)) {
            pline(_("%s tries to reach your %s %s!"), Monst_name, sidestr, leg);
            mhm.damage = 0;
        } else if (magr.mcan) {
            pline_mon(magr, _("%s nuzzles against your %s %s!"), Monnam(magr),
                  sidestr, leg);
            mhm.damage = 0;
        } else {
            if (uarmf) {
                if (rn2(2) && (uarmf.otyp == LOW_BOOTS
                               || uarmf.otyp == IRON_SHOES)) {
                    pline(_("%s pricks the exposed part of your %s %s!"),
                          Monst_name, sidestr, leg);
                } else if (!rn2(5)) {
                    pline(_("%s pricks through your %s boot!"), Monst_name,
                          sidestr);
                } else {
                    pline(_("%s scratches your %s boot!"), Monst_name,
                          sidestr);
                    mhm.damage = 0;
                    return;
                }
            } else
                pline(_("%s pricks your %s %s!"), Monst_name, sidestr, leg);

            set_wounded_legs(side, rnd(60 - ACURR(A_DEX)));
            exercise(A_STR, FALSE);
            exercise(A_DEX, FALSE);
        }
    } else {
        /* mhitm */
        if (magr.mcan) {
            mhm.damage = 0;
            return;
        }
        mhitm_ad_phys(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    }
}

export function mhitm_ad_dgst(
    magr,
    mattk,
    mdef, mhm) { /* void */
    let pd = mdef.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        mhm.damage = 0;
    } else {
        /* mhitm */
        let num;
        let obj;

        /* eating a Rider or its corpse is fatal */
        if (is_rider(pd)) {
            if (gv.vis && canseemon(magr))
                pline_mon(magr, _("%s %s!"), Monnam(magr),
                      (pd == mons[PM_FAMINE])
                          ? _("belches feebly, shrivels up and dies")
                          : (pd == mons[PM_PESTILENCE])
                                ? _("coughs spasmodically and collapses")
                                : _("vomits violently and drops dead"));
            mondied(magr);
            if (!DEADMONSTER(magr)) {
                mhm.hitflags = M_ATTK_MISS; /* lifesaved */
                mhm.done = TRUE;
                return;
            } else if (magr.mtame && !gv.vis)
                You(brief_feeling, _("queasy"));
            mhm.hitflags = M_ATTK_AGR_DIED;
            mhm.done = TRUE;
            return;
        }
        if (flags.verbose && !Deaf()) {
            /* Soundeffect? */
               ;
            verbalize(_("Burrrrp!"));
        }
        wake_nearto(magr.mx, magr.my, 2 * 2); /* Burrrrp! */
        mhm.damage = mdef.mhp;
        /* Use up amulet of life saving */
        if ((obj = mlifesaver(mdef)) != null)
            m_useup(mdef, obj);

        /* Is a corpse for nutrition possible?  It may kill magr */
        if (!corpse_chance(mdef, magr, TRUE) || DEADMONSTER(magr))
            return;

        /* Pets get nutrition from swallowing monster whole.
         * No nutrition from G_NOCORPSE monster, eg, undead.
         * DGST monsters don't die from undead corpses
         */
        num = monsndx(pd);
        if (magr.mtame && !magr.isminion
            && !(svm.mvitals[num].mvflags & G_NOCORPSE)) {
            let virtualcorpse = mksobj(CORPSE, FALSE, FALSE);
            let nutrit;

            set_corpsenm(virtualcorpse, num);
            nutrit = dog_nutrition(magr, virtualcorpse);
            dealloc_obj(virtualcorpse);

            /* only 50% nutrition, 25% of normal eating time */
            if (magr.meating > 1)
                magr.meating = Math.trunc((magr.meating + 3) / 4);
            if (nutrit > 1)
                nutrit = Math.trunc(nutrit / 2);
            EDOG(magr).hungrytime += nutrit;
        }
    }
}

export function mhitm_ad_samu(
    magr, mattk,
    mdef, mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        hitmsg(magr, mattk);
        /* when the Wizard or quest nemesis hits, there's a 1/20 chance
           to steal a quest artifact (any, not just the one for the hero's
           own role) or the Amulet or one of the invocation tools */
        if (!rn2(20))
            stealamulet(magr);
    } else {
        /* mhitm */
        mhm.damage = 0;
    }
}

/* disease */
export function mhitm_ad_dise(
    magr, mattk,
    mdef, mhm) { /* void */
    let $goto = null;
    var pa = magr.data, pd = mdef.data;

    $goto_mhitm_dise: for (;;) { switch ($goto) { default: case "mhitm_dise": if (!$goto && (magr == gy.youmonst)) {
        /* uhitm; hero can't polymorph into anything with this attack so
           this won't happen; if it could, it would be the same as the
           mhitm case except for messaging */
        { $goto = "mhitm_dise"; continue $goto_mhitm_dise; }
    } else if (!$goto && (mdef == gy.youmonst)) {
        /* mhitu */
        hitmsg(magr, mattk);
        if (!diseasemu(pa))
            mhm.damage = 0;
    } else {
 $goto = null;
        /* mhitm; protected monsters use the same criteria as for poly'd
           hero gaining sick resistance combined with any hero wielding a
           weapon or wearing dragon scales/mail that guards against disease */
        if (pd.mlet == S_FUNGUS || pd == mons[PM_GHOUL]
            || defended(mdef, AD_DISE))
            mhm.damage = 0;
        /* else does ordinary damage */
    } } break; }
}

/* seduce and also steal item */
export function mhitm_ad_sedu(
    magr, mattk,
    mdef, mhm) { /* void */
    const $frame = stack_frame(); try {
    let pa = magr.data;

    if (magr == gy.youmonst) {
        /* uhitm */
        steal_it(mdef, mattk);
        mhm.damage = 0;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        let buf = stack_array(char, BUFSZ);

        if (is_animal(magr.data)) {
            hitmsg(magr, mattk);
            if (magr.mcan)
                return;
            /* Continue below */
        } else if (dmgtype(gy.youmonst.data, AD_SEDU)
                   /* !SYSOPT_SEDUCE: when hero is attacking and AD_SSEX
                      is disabled, it would be changed to another damage
                      type, but when defending, it remains as-is */
                   || dmgtype(gy.youmonst.data, AD_SSEX)) {
            pline_mon(magr, _("%s %s."), Monnam(magr),
                  Deaf() ? _("says something but you can't hear it")
                  : magr.minvent
                    ? _("brags about the goods some dungeon explorer provided")
                  : _("makes some remarks about how difficult theft is lately"));
            if (!tele_restrict(magr))
                rloc(magr, RLOC_MSG);
            mhm.hitflags = M_ATTK_AGR_DONE; /* return 3??? */
            mhm.done = TRUE;
            return;
        } else if (magr.mcan) {
            if (!Blind())
                pline(_("%s tries to %s you, but you seem %s."),
                      Adjmonnam(magr, _("plain")),
                      flags.female ? _("charm") : _("seduce"),
                      flags.female ? _("unaffected") : _("uninterested"));
            if (rn2(3)) {
                if (!tele_restrict(magr))
                    rloc(magr, RLOC_MSG);
                mhm.hitflags = M_ATTK_AGR_DONE; /* return 3??? */
                mhm.done = TRUE;
                return;
            }
            return;
        }
        chars[buf + 0] = ord('\0');
        switch (steal(magr, buf)) {
        case -1:
            mhm.hitflags = M_ATTK_AGR_DIED; /* return 2??? */
            mhm.done = TRUE;
            return;
        case 0:
            return;
        default:
            if (!is_animal(magr.data) && !tele_restrict(magr))
                rloc(magr, RLOC_MSG);
            if (is_animal(magr.data) && chars[buf]) {
                if (canseemon(magr))
                    pline_mon(magr, _("%s tries to %s away with %s."),
                              Monnam(magr),
                              locomotion(magr.data, _("run")), buf);
            }
            monflee(magr, 0, FALSE, FALSE);
            mhm.hitflags = M_ATTK_AGR_DONE; /* return 3??? */
            mhm.done = TRUE;
            return;
        }
    } else {
        /* mhitm */
        let obj;

        if (magr.mcan)
            return;
        /* find an object to steal, non-cursed if magr is tame */
        for (obj = mdef.minvent; obj; obj = obj.nobj)
            if (!magr.mtame || !obj.cursed)
                break;

        if (obj) {
            let buf = stack_array(char, BUFSZ);
            let onambuf = stack_array(char, BUFSZ), mdefnambuf = stack_array(char, BUFSZ);

            /* make a special x_monnam() call that never omits
               the saddle, and save it for later messages */
            strcpy(mdefnambuf, x_monnam(mdef, ARTICLE_THE, 0, 0, FALSE))
;

            if (u.usteed == mdef && obj == which_armor(mdef, W_SADDLE))
                /* "You can no longer ride <steed>." */
                dismount_steed(DISMOUNT_POLY);
            extract_from_minvent(mdef, obj, TRUE, FALSE);
            /* add_to_minv() might free 'obj' [if it merges] */
            if (gv.vis)
                strcpy(onambuf, doname(obj));
            add_to_minv(magr, obj);
            strcpy(buf, Monnam(magr));
            if (gv.vis && canseemon(mdef)) {
                pline(_("%s steals %s from %s!"), buf, onambuf, mdefnambuf);
            }
            possibly_unwield(mdef, FALSE);
            mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU);
            mselftouch(mdef, 0, FALSE);
            if (DEADMONSTER(mdef)) {
                mhm.hitflags = (M_ATTK_DEF_DIED
                                 | (grow_up(magr, mdef) ? 0
                                    : M_ATTK_AGR_DIED));
                mhm.done = TRUE;
                return;
            }
            if (pa.mlet == S_NYMPH && !tele_restrict(magr)) {
                let couldspot = canspotmon(magr);

                mhm.hitflags = M_ATTK_AGR_DONE;
                rloc(magr, RLOC_NOMSG);
                /* TODO: use RLOC_MSG instead? */
                if (gv.vis && couldspot && !canspotmon(magr))
                    pline(_("%s suddenly disappears!"), buf);
            }
        }
        mhm.damage = 0;
    }
    } finally { stack_pop($frame); }
}

export function mhitm_ad_ssex(magr, mattk, mdef,
              mhm) { /* void */
    if (magr == gy.youmonst) {
        /* uhitm */
        mhitm_ad_sedu(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    } else if (mdef == gy.youmonst) {
        /* mhitu */
        if (SYSOPT_SEDUCE()) {
            if (could_seduce(magr, mdef, mattk) == 1 && !magr.mcan)
                if (doseduce(magr)) {
                    mhm.hitflags = M_ATTK_AGR_DONE;
                    mhm.done = TRUE;
                    return;
                }
            return;
        }
        mhitm_ad_sedu(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    } else {
        /* mhitm */
        mhitm_ad_sedu(magr, mattk, mdef, mhm);
        if (mhm.done)
            return;
    }
}

export function mhitm_adtyping(
    magr, mattk,
    mdef, mhm) { /* void */
    switch (mattk.adtyp) {
    case AD_STUN: mhitm_ad_stun(magr, mattk, mdef, mhm); break;
    case AD_LEGS: mhitm_ad_legs(magr, mattk, mdef, mhm); break;
    case AD_WERE: mhitm_ad_were(magr, mattk, mdef, mhm); break;
    case AD_HEAL: mhitm_ad_heal(magr, mattk, mdef, mhm); break;
    case AD_PHYS: mhitm_ad_phys(magr, mattk, mdef, mhm); break;
    case AD_FIRE: mhitm_ad_fire(magr, mattk, mdef, mhm); break;
    case AD_COLD: mhitm_ad_cold(magr, mattk, mdef, mhm); break;
    case AD_ELEC: mhitm_ad_elec(magr, mattk, mdef, mhm); break;
    case AD_ACID: mhitm_ad_acid(magr, mattk, mdef, mhm); break;
    case AD_STON: mhitm_ad_ston(magr, mattk, mdef, mhm); break;
    case AD_SSEX: mhitm_ad_ssex(magr, mattk, mdef, mhm); break;
    case AD_SITM:
    case AD_SEDU: mhitm_ad_sedu(magr, mattk, mdef, mhm); break;
    case AD_SGLD: mhitm_ad_sgld(magr, mattk, mdef, mhm); break;
    case AD_TLPT: mhitm_ad_tlpt(magr, mattk, mdef, mhm); break;
    case AD_BLND: mhitm_ad_blnd(magr, mattk, mdef, mhm); break;
    case AD_CURS: mhitm_ad_curs(magr, mattk, mdef, mhm); break;
    case AD_DRLI: mhitm_ad_drli(magr, mattk, mdef, mhm); break;
    case AD_RUST: mhitm_ad_rust(magr, mattk, mdef, mhm); break;
    case AD_CORR: mhitm_ad_corr(magr, mattk, mdef, mhm); break;
    case AD_DCAY: mhitm_ad_dcay(magr, mattk, mdef, mhm); break;
    case AD_DREN: mhitm_ad_dren(magr, mattk, mdef, mhm); break;
    case AD_DRST:
    case AD_DRDX:
    case AD_DRCO: mhitm_ad_drst(magr, mattk, mdef, mhm); break;
    case AD_DRIN: mhitm_ad_drin(magr, mattk, mdef, mhm); break;
    case AD_STCK: mhitm_ad_stck(magr, mattk, mdef, mhm); break;
    case AD_WRAP: mhitm_ad_wrap(magr, mattk, mdef, mhm); break;
    case AD_PLYS: mhitm_ad_plys(magr, mattk, mdef, mhm); break;
    case AD_SLEE: mhitm_ad_slee(magr, mattk, mdef, mhm); break;
    case AD_SLIM: mhitm_ad_slim(magr, mattk, mdef, mhm); break;
    case AD_ENCH: mhitm_ad_ench(magr, mattk, mdef, mhm); break;
    case AD_SLOW: mhitm_ad_slow(magr, mattk, mdef, mhm); break;
    case AD_CONF: mhitm_ad_conf(magr, mattk, mdef, mhm); break;
    case AD_POLY: mhitm_ad_poly(magr, mattk, mdef, mhm); break;
    case AD_DISE: mhitm_ad_dise(magr, mattk, mdef, mhm); break;
    case AD_SAMU: mhitm_ad_samu(magr, mattk, mdef, mhm); break;
    case AD_DETH: mhitm_ad_deth(magr, mattk, mdef, mhm); break;
    case AD_PEST: mhitm_ad_pest(magr, mattk, mdef, mhm); break;
    case AD_FAMN: mhitm_ad_famn(magr, mattk, mdef, mhm); break;
    case AD_DGST: mhitm_ad_dgst(magr, mattk, mdef, mhm); break;
    case AD_HALU: mhitm_ad_halu(magr, mattk, mdef, mhm); break;
    default:
        mhm.damage = 0;
    }
}

export function damageum(
    mdef,
    mattk,
    specialdmg) { /* int */ /* blessed and/or silver bonus against various things */
    const $frame = stack_frame(); try {
    let mhm = stack_struct(struct_mhitm_data);

    mhm.damage = d(mattk.damn, mattk.damd);
    mhm.hitflags = M_ATTK_MISS;
    mhm.permdmg = 0;
    mhm.specialdmg = specialdmg;
    mhm.done = FALSE;

    if (is_demon(gy.youmonst.data) && !rn2(13) && !uwep
        && u.umonnum != PM_AMOROUS_DEMON && u.umonnum != PM_BALROG) {
        demonpet();
        return M_ATTK_MISS;
    }

    mhitm_adtyping(gy.youmonst, mattk, mdef, mhm);

    if (mhm.done)
        return mhm.hitflags;

    mdef.mstrategy = and64u(mdef.mstrategy, ~STRAT_WAITFORU); /* in case player is very fast */
    mdef.mhp -= mhm.damage;
    if (DEADMONSTER(mdef)) {
        /* troll killed by Trollsbane won't auto-revive; FIXME? same when
           Trollsbane is wielded as primary and two-weaponing kills with
           secondary, which matches monster vs monster behavior but is
           different from the non-poly'd hero vs monster behavior */
        if (mattk.aatyp == AT_WEAP || mattk.aatyp == AT_CLAW)
            gm.mkcorpstat_norevive = troll_baned(mdef, uwep) ? TRUE : FALSE;
        /* (DEADMONSTER(mdef) and !mhm.damage => already killed) */
        if (mdef.mtame && !cansee(mdef.mx, mdef.my)) {
            You_feel(_("embarrassed for a moment."));
            if (mhm.damage)
                xkilled(mdef, XKILL_NOMSG);
        } else if (!flags.verbose) {
            You(_("destroy it!"));
            if (mhm.damage)
                xkilled(mdef, XKILL_NOMSG);
        } else if (mhm.damage) {
            killed(mdef); /* regular "you kill <mdef>" message */
        }
        gm.mkcorpstat_norevive = FALSE;
        return M_ATTK_DEF_DIED;
    }
    return M_ATTK_HIT;
    } finally { stack_pop($frame); }
}

/* Hero, as a monster which is capable of an exploding attack mattk, is
 * exploding at a target monster mdef, or just exploding at nothing (e.g. with
 * forcefight) if mdef is null.
 */
export function explum(mdef, mattk) { /* int */
    let tmp = d(mattk.damn, mattk.damd);

    switch (mattk.adtyp) {
    case AD_BLND:
        if (mdef && !resists_blnd(mdef)) {
            pline(_("%s is blinded by your flash of light!"), Monnam(mdef));
            mdef.mblinded = unsigned(min(mdef.mblinded + tmp, 127));
            mdef.mcansee = 0;
        }
        break;
    case AD_HALU:
        if (mdef && haseyes(mdef.data) && mdef.mcansee) {
            pline(_("%s is affected by your flash of light!"), Monnam(mdef));
            mdef.mconf = 1;
        }
        break;
    case AD_COLD:
    case AD_FIRE:
    case AD_ELEC:
        /* See comment in mon_explodes() and in zap.c for an explanation
           of this math.  Here, the player is causing the explosion, so it
           should be in the +20 to +29 range instead of negative. */
        explode(u.ux, u.uy, (mattk.adtyp - 1) + 20, tmp, MON_EXPLODE,
                adtyp_to_expltype(mattk.adtyp));
        if (mdef && DEADMONSTER(mdef)) {
            /* Other monsters may have died too, but return this if the actual
               target died. */
            return M_ATTK_DEF_DIED;
        }
        break;
    default:
        break;
    }
    wake_nearto(u.ux, u.uy, 7 * 7); /* same radius as exploding monster */
    return M_ATTK_HIT;
}

function start_engulf(mdef) { /* void */
    let u_digest = digests(gy.youmonst.data),
            u_enfold = enfolds(gy.youmonst.data);

    if (!Invisible()) {
        map_location(u.ux, u.uy, TRUE);
        tmp_at(DISP_ALWAYS, mon_to_glyph(gy.youmonst, rn2_on_display_rng));
        tmp_at(mdef.mx, mdef.my);
    }
    You(_("%s %s%s!"),
        u_digest ? _("swallow") : u_enfold ? _("enclose") : _("engulf"),
        mon_nam(mdef), u_digest ? _(" whole") : _(""));
    nh_delay_output()();
    nh_delay_output()();
}

function end_engulf() { /* void */
    if (!Invisible()) {
        tmp_at(DISP_END, 0);
        newsym(u.ux, u.uy);
    }
}

function gulpum(mdef, mattk) { /* int */
    const $frame = stack_frame(); try {
    let msgbuf = static_array("gulpum.msgbuf", char, BUFSZ); /* for gn.nomovemsg */
    let tmp;
    let dam = d(mattk.damn, mattk.damd);
    let fatal_gulp,
            u_digest = digests(gy.youmonst.data),
            u_enfold = enfolds(gy.youmonst.data);
    let otmp;
    let pd = mdef.data;
    let expel_verb = u_digest ? _("regurgitate")
                             : u_enfold ? _("release")
                               : _("expel");

    /* Not totally the same as for real monsters.  Specifically, these
     * don't take multiple moves.  (It's just too hard, for too little
     * result, to program monsters which attack from inside you, which
     * would be necessary if done accurately.)  Instead, we arbitrarily
     * kill the monster immediately for AD_DGST and we regurgitate them
     * after exactly 1 round of attack otherwise.  -KAA
     */

    if (!engulf_target(gy.youmonst, mdef))
        return M_ATTK_MISS;

    if (!(u_digest && u.uhunger >= 1500) && !u.uswallow) {
        if (!flaming(gy.youmonst.data)) {
            for (otmp = mdef.minvent; otmp; otmp = otmp.nobj)
                snuff_lit(otmp);
        }

        /* force vampire in bat, cloud, or wolf form to revert back to
           vampire form now instead of dealing with that when it dies */
        if (is_vampshifter(mdef)
            && newcham(mdef, mons[mdef.cham], NO_NC_FLAGS)) {
            You(_("%s it, then %s it."),
                u_digest ? _("swallow") : u_enfold ? _("enclose") : _("engulf"),
                expel_verb);
            if (canspotmon(mdef)) {
                /* Avoiding a_monnam here: if the target is named, it gives us
                   a sequence like "You bite Dracula.  You swallow it, then
                   regurgitate it.  It turns into Dracula." */
                pline(_("It turns into %s."),
                      x_monnam(mdef, ARTICLE_A, 0,
                               (SUPPRESS_NAME | SUPPRESS_IT
                                | SUPPRESS_INVISIBLE), FALSE));
            } else {
                map_invisible(mdef.mx, mdef.my);
            }
            return M_ATTK_HIT;
        }

        /* engulfing a cockatrice or digesting a Rider or Medusa */
        fatal_gulp = +((touch_petrifies(pd) && !Stone_resistance())
                     || (mattk.adtyp == AD_DGST
                         && (is_rider(pd) || (pd == mons[PM_MEDUSA]
                                              && !Stone_resistance()))));

        if (mattk.adtyp == AD_DGST && (!Slow_digestion() || fatal_gulp))
            eating_conducts(pd);

        if (fatal_gulp && !is_rider(pd)) { /* petrification */
            let kbuf = stack_array(char, BUFSZ);
            let mnam = pmname(pd, Mgender(mdef));

            if (!type_is_pname(pd))
                mnam = an(mnam);
            You(_("%s %s."), u_digest ? _("englut") : _("engulf"), mon_nam(mdef));
            sprintf(kbuf, _("%s %s%s"), u_digest ? _("swallowing")
                    : u_enfold ? _("enclosing")
                      : _("engulfing"), mnam, u_digest ? _(" whole") : _(""))

;
            instapetrify(kbuf);
        } else {
            start_engulf(mdef);
            switch (mattk.adtyp) {
            case AD_DGST:
                /* eating a Rider or its corpse is fatal */
                if (is_rider(pd)) {
                    pline(_("Unfortunately, digesting any of it is fatal."));
                    end_engulf();
                    sprintf(svk.killer.name, _("unwisely tried to eat %s"), pmname(pd, Mgender(mdef)))
;
                    svk.killer.format = NO_KILLER_PREFIX;
                    done(DIED);
                    return M_ATTK_MISS; /* lifesaved */
                }

                if (Slow_digestion()) {
                    dam = 0;
                    break;
                }

                /* Use up amulet of life saving */
                if ((otmp = mlifesaver(mdef)) != null)
                    m_useup(mdef, otmp);

                newuhs(FALSE);
                /* start_engulf() issues "you engulf <mdef>" above; this
                   used to specify XKILL_NOMSG but we need "you kill <mdef>"
                   in case we're also going to get "welcome to level N+1";
                   "you totally digest <mdef>" will be coming soon (after
                   several turns) but the level-gain message seems out of
                   order if the kill message is left implicit */
                gm.mswallower = gy.youmonst;
                xkilled(mdef, XKILL_GIVEMSG | XKILL_NOCORPSE);
                if (!DEADMONSTER(mdef)) { /* monster lifesaved */
                    You(_("hurriedly regurgitate the sizzling in your %s."),
                        body_part(STOMACH));
                } else {
                    tmp = 1 + (pd.cwt >>> 8);
                    if (corpse_chance(mdef, gy.youmonst, TRUE)
                        && !(svm.mvitals[monsndx(pd)].mvflags & G_NOCORPSE)) {
                        /* nutrition only if there can be a corpse */
                        u.uhunger += Math.trunc((pd.cnutrit + 1) / 2);
                    } else {
                        tmp = 0;
                    }
                    sprintf(msgbuf, _("You totally digest %s."), mon_nam(mdef));
                    if (tmp != 0) {
                        /* setting afternmv = end_engulf is tempting,
                         * but will cause problems if the player is
                         * attacked (which uses his real location) or
                         * if his See_invisible wears off
                         */
                        You(_("digest %s."), mon_nam(mdef));
                        if (Slow_digestion())
                            tmp *= 2;
                        nomul(-tmp);
                        gm.multi_reason = _("digesting something");
                        gn.nomovemsg = msgbuf;
                        /* possible intrinsic once totally digested */
                        gc.corpsenm_digested = monsndx(pd);
                        ga.afternmv = Finish_digestion;
                    } else
                        pline1(msgbuf);
                    if (pd == mons[PM_GREEN_SLIME]) {
                        sprintf(msgbuf, _("%s isn't sitting well with you."), The(pmname(pd, Mgender(mdef))))
;
                        if (!Unchanging()) {
                            make_slimed(5, 0);
                        }
                    } else
                        exercise(A_CON, TRUE);
                }
                gm.mswallower = null;
                end_engulf();
                return M_ATTK_DEF_DIED;
            case AD_PHYS:
                if (gy.youmonst.data == mons[PM_FOG_CLOUD]) {
                    pline(_("%s is laden with your moisture."), Monnam(mdef));
                    if ((breathless(pd) || amphibious(pd)) && !flaming(pd)) {
                        dam = 0;
                        pline(_("%s seems unharmed."), Monnam(mdef));
                    }
                } else {
                    pline(_("%s is %s!"), Monnam(mdef),
                          enfolds(gy.youmonst.data) ? _("being squashed")
                            : _("pummeled with your debris"));
                }
                break;
            case AD_ACID:
                pline(_("%s is covered with your goo!"), Monnam(mdef));
                if (resists_acid(mdef)) {
                    pline(_("It seems harmless to %s."), mon_nam(mdef));
                    dam = 0;
                }
                break;
            case AD_BLND:
                if (can_blnd(gy.youmonst, mdef, mattk.aatyp,
                             null)) {
                    if (mdef.mcansee)
                        pline(_("%s can't see in there!"), Monnam(mdef));
                    mdef.mcansee = 0;
                    dam += mdef.mblinded;
                    if (dam > 127)
                        dam = 127;
                    mdef.mblinded = unsigned(dam);
                }
                dam = 0;
                break;
            case AD_ELEC:
                if (rn2(2)) {
                    pline_The(_("air around %s crackles with electricity."),
                              mon_nam(mdef));
                    if (resists_elec(mdef)) {
                        pline(_("%s seems unhurt."), Monnam(mdef));
                        dam = 0;
                    }
                    golemeffects(mdef, mattk.adtyp, dam);
                } else
                    dam = 0;
                break;
            case AD_COLD:
                if (rn2(2)) {
                    if (resists_cold(mdef)) {
                        pline(_("%s seems mildly chilly."), Monnam(mdef));
                        dam = 0;
                    } else
                        pline(_("%s is freezing to death!"), Monnam(mdef));
                    golemeffects(mdef, mattk.adtyp, dam);
                } else
                    dam = 0;
                break;
            case AD_FIRE:
                if (rn2(2)) {
                    if (resists_fire(mdef)) {
                        pline(_("%s seems mildly hot."), Monnam(mdef));
                        dam = 0;
                    } else
                        pline(_("%s is burning to a crisp!"), Monnam(mdef));
                    golemeffects(mdef, mattk.adtyp, dam);
                } else
                    dam = 0;
                break;
            case AD_DREN:
                if (!rn2(4))
                    xdrainenergym(mdef, TRUE);
                dam = 0;
                break;
            }
            end_engulf();
            mdef.mhp -= dam;
            if (DEADMONSTER(mdef)) {
                killed(mdef);
                if (DEADMONSTER(mdef)) /* not lifesaved */
                    return M_ATTK_DEF_DIED;
            }
            You(_("%s %s!"), expel_verb, mon_nam(mdef));
            if ((Slow_digestion() || is_animal(gy.youmonst.data)) && u_digest) {
                pline(_("Obviously, you didn't like %s taste."),
                      s_suffix(mon_nam(mdef)));
            }
        }
    }
    return M_ATTK_MISS;
    } finally { stack_pop($frame); }
}

export function missum(
    mdef,
    mattk,
    wouldhavehit) { /* void */
    if (wouldhavehit) /* monk is missing due to penalty for wearing suit */
        Your(_("armor is rather cumbersome..."));

    if (could_seduce(gy.youmonst, mdef, mattk))
        You(_("pretend to be friendly to %s."), mon_nam(mdef));
    else if (canspotmon(mdef) && flags.verbose)
        You(_("miss %s."), mon_nam(mdef));
    else
        You(_("miss it."));
    if (!helpless(mdef))
        wakeup(mdef, TRUE);
}

/* check whether equipment protects against knockback */
export function m_is_steadfast(mtmp) { /* boolean */
    let is_u = +(mtmp == gy.youmonst);
    let otmp = is_u ? uwep : MON_WEP(mtmp);

    /* must be on the ground (or in water) */
    if ((is_u ? (Flying() || Levitation())
              : (is_flyer(mtmp.data) || is_floater(mtmp.data)))
        || Is_airlevel(u.uz) /* air or cloud */
        || (Is_waterlevel(u.uz) && !is_pool(u.ux, u.uy))) /* air bubble */
        return FALSE;

    if (is_art(otmp, ART_GIANTSLAYER))
        return TRUE;

    /* steadfast if carrying any loadstone (and not floating or flying);
       'is_u' test not needed here; m_carrying() is 'youmonst' aware */
    if (m_carrying(mtmp, LOADSTONE))
        return TRUE;
    /* when mounted and steed is target of knockback, check the rider for
       a loadstone too (Giantslayer's protection doesn't extend to steed) */
    if (u.usteed && mtmp == u.usteed && carrying(LOADSTONE))
        return TRUE;

    return FALSE;
}

/* monster hits another monster hard enough to knock it back? */
export function mhitm_knockback(
    magr,
    mdef,
    mattk,
    hitflags,
    weapon_used) { /* boolean */ /* True: via weapon hit */
    const $frame = stack_frame(); try {
    let magrbuf = stack_array(char, BUFSZ), mdefbuf = stack_array(char, BUFSZ);
    let otmp;
    let knockedhow;
    let dx, dy, defx, defy;
    let knockdistance = rn2(3) ? 1 : 2; /* 67%: 1 step, 33%: 2 steps */
    let chance = 6; /* 1/6 chance of attack knocking back a monster */
    let u_agr = +(magr == gy.youmonst);
    let u_def = +(mdef == gy.youmonst);
    let was_u = FALSE, dismount = FALSE;
    let wep = weapon_used ? (u_agr ? uwep : MON_WEP(magr))
                                  : null;

    if (wep && is_art(wep, ART_OGRESMASHER))
        chance = 2;

    if (rn2(chance))
        return FALSE;

    /* only certain attacks qualify for knockback */
    if (!((mattk.adtyp == AD_PHYS)
          && (mattk.aatyp == AT_CLAW
              || mattk.aatyp == AT_KICK
              || mattk.aatyp == AT_BUTT
              || mattk.aatyp == AT_WEAP)))
        return FALSE;

    /* don't knockback if attacker also wants to grab or engulf */
    if (attacktype(magr.data, AT_ENGL)
        || attacktype(magr.data, AT_HUGS)
        || sticks(magr.data))
        return FALSE;

    /* decide where the first step will place the target; not accurate
       for being knocked out of saddle but doesn't need to be; used for
       test_move() and for message before actual hurtle */
    defx = u_def ? u.ux : mdef.mx;
    defy = u_def ? u.uy : mdef.my;
    dx = sgn(defx - (u_agr ? u.ux : magr.mx));
    dy = sgn(defy - (u_agr ? u.uy : magr.my));

    /* can't move most targets into or out of a doorway diagonally */
    if (u_def) {
        if (!test_move(defx, defy, dx, dy, TEST_MOVE))
            return FALSE;
    } else {
        /* subset of test_move() */
        if (!isok(defx + dx, defy + dy))
            return FALSE;
        if (IS_DOOR(levl()[defx][defy].typ)
            && (defx - magr.mx && defy - magr.my)
            && !doorless_door(defx, defy))
            return FALSE;
    }

    /* if hero is stuck to a cursed saddle, knock the steed back */
    if (u_def && u.usteed) {
        if ((otmp = which_armor(u.usteed, W_SADDLE)) != null && otmp.cursed) {
            mdef = u.usteed;
            was_u = TRUE;
            u_def = FALSE;
        } else {
            dismount = TRUE; /* saddle is not cursed; knock hero out of it */
        }
    }

    /* monsters must be alive */
    if ((!u_agr && DEADMONSTER(magr))
        || (!u_def && DEADMONSTER(mdef)))
        return FALSE;

    /* attacker must be much larger than defender */
    if (!(magr.data.msize > (mdef.data.msize + 1)))
        return FALSE;

    /* no knockback with a flimsy or non-blunt weapon */
    if (wep && (is_flimsy(wep) || !is_blunt_weapon(wep)))
        return FALSE;

    /* needs a solid physical hit */
    if (unsolid(magr.data))
        return FALSE;

    /* the attack must have hit */
    /* mon-vs-mon code path doesn't set up hitflags */
    if ((u_agr || u_def) && !(hitflags[0] & M_ATTK_HIT))
        return FALSE;

    /* steadfast defender cannot be pushed around */
    if (m_is_steadfast(mdef)) {
        if (u_def || (u.usteed && mdef == u.usteed)) {
            chars[mdefbuf + 0] = ord('\0');
            if (u.usteed)
                Snprintf(mdefbuf, sizeof(array_of(char, BUFSZ)), _("and %s "), y_monnam(u.usteed))
;
            You(_("%sdon't budge."), mdefbuf);
        } else if (canseemon(mdef)) {
            pline(_("%s doesn't budge."), Monnam(mdef));
        }
        return FALSE;
    }

    /* subtly vary the message text if monster won't actually move */
    knockedhow = dismount ? _("out of your saddle")
                 : will_hurtle(mdef, defx + dx, defy + dy) ? _("backward")
                   : _("back");

    /* give the message */
    if (u_def || canseemon(mdef)) {
        strcpy(magrbuf, u_agr ? _("You") : Monnam(magr));
        strcpy(mdefbuf, (u_def || was_u) ? _("you") : y_monnam(mdef));
        if (was_u)
            Snprintf(eos(mdefbuf), unsigned(sizeof(array_of(char, BUFSZ)) - strlen(mdefbuf)), _(" and %s"), y_monnam(u.usteed))
;
        /*
         * uhitm: You knock the gnome back with a powerful blow!
         * mhitu: The red dragon knocks you back with a forceful blow!
         * mhitm: The fire giant knocks the gnome back with a forceful strike!
         */
        pline(_("%s %s %s %s with a %s %s!"),
              magrbuf, vtense(magrbuf, _("knock")), mdefbuf, knockedhow,
              rn2(2) ? _("forceful") : _("powerful"), rn2(2) ? _("blow") : _("strike"));
    } else if (u_agr) {
        /* hero knocks unseen foe back; noticed by touch */
        You_feel(_("%s be knocked %s!"), some_mon_nam(mdef), knockedhow);
    }

    if (u.ustuck && (u_def || u_agr))
        unstuck(u.ustuck);

    /* do the actual knockback effect */
    if (u_def) {
        if (dismount) {
            /* normally u.dx,u.dy indicates the direction hero is throwing,
               zapping, &c but here it is used to pass preferred direction
               for dismount to dismount_steed (for DISMOUNT_KNOCKED only) */
            u.dx = dx;
            u.dy = dy;
            dismount_steed(DISMOUNT_KNOCKED);
        } else {
            hurtle(dx, dy, knockdistance, FALSE);
            hitflags[0] |= M_ATTK_HIT;
        }
        set_apparxy(magr); /* update magr's idea of where you are */
        if (!Stunned() && !rn2(4))
            make_stunned((knockdistance + 1), TRUE); /* 2 or 3 */
    } else {
        mhurtle(mdef, dx, dy, knockdistance);
        if (!u_agr)
            hitflags[0] |= M_ATTK_HIT;
        if (DEADMONSTER(mdef)) {
            if (!was_u)
                hitflags[0] |= M_ATTK_DEF_DIED;
        } else if (!rn2(4)) {
            mdef.mstun = 1;
            /* if steed and hero were knocked back, update attacker's idea
               of where hero is */
            if (mdef == u.usteed)
                set_apparxy(magr);
        }
    }
    if (!u_agr) {
        if (DEADMONSTER(magr))
            hitflags[0] |= M_ATTK_AGR_DIED;
    }

    return TRUE;
    } finally { stack_pop($frame); }
}

/* attack monster as a monster; returns True if mon survives */
function hmonas(mon) { /* boolean */
    const $frame = stack_frame(); try {
    let $goto = null; var alt_attk = stack_struct(struct_attack), armorpenalty = stack_var(int), sum = stack_array(int, NATTK), dhit = stack_var(int), attknum = stack_var(int), silverhit = stack_var(long), silverhit = stack_var(long);
    var mattk;
    var weapon, originalweapon;
    var altwep = FALSE, weapon_used = FALSE, odd_claw = TRUE;
    var i, tmp, dieroll;
        dhit[0] = 0; attknum[0] = 0; var multi_claw = 0, multi_weap = 0;
    var monster_survived;

    /* not used here but umpteen mhitm_ad_xxxx() need this */
    gv.vis = (canseemon(mon) || m_next2u(mon) ? 1 : 0);

    /* with just one touch/claw/weapon attack, both rings matter;
       with more than one, alternate right and left when checking
       whether silver ring causes successful hit */
    for (i = 0; i < NATTK; i++) {
        sum[i] = M_ATTK_MISS;
        mattk = getmattk(gy.youmonst, mon, i, sum, alt_attk);
        if (mattk.aatyp == AT_WEAP)
            ++multi_weap;
        if (mattk.aatyp == AT_WEAP
            || mattk.aatyp == AT_CLAW || mattk.aatyp == AT_TUCH)
            ++multi_claw;
    }
    multi_claw = +(multi_claw > 1); /* switch from count to yes/no */
    gt.twohits = 0;

    gs.skipdrin = FALSE; /* [see mattackm(mhitm.c)] */

    $out_use_weapon: for (i = 0; i < NATTK; i++) {
        /* sum[i] = M_ATTK_MISS; -- now done above */

        /* target might have been knocked back so no longer in range, or an
           engulfing vampshifted fog cloud killed and reverted to vampire
           that's placed at another spot (hero occupies mon's first spot) */
        if (i > 0 && (m_at(gb.bhitpos.x, gb.bhitpos.y) != mon
                      || DEADMONSTER(mon)))
            continue;

        mattk = getmattk(gy.youmonst, mon, i, sum, alt_attk);
        if (gs.skipdrin && mattk.aatyp == AT_TENT && mattk.adtyp == AD_DRIN)
            continue;
        weapon = null;
        passivedone: { $goto_use_weapon: for (;;) { switch ($goto || (mattk.aatyp)) {
        case "use_weapon": case AT_WEAP:
            /* if (!uwep) goto weaponless; */
 $goto = null;
            odd_claw = +!odd_claw; /* see case AT_CLAW,AT_TUCH below */
            /* if we've already hit with a two-handed weapon, we don't
               get to make another weapon attack (note:  monsters who
               use weapons do not have this restriction, but they also
               never have the opportunity to use two weapons) */
            if (weapon_used && (sum[i - 1] > M_ATTK_MISS)
                && uwep && bimanual(uwep))
                continue $out_use_weapon;
            /* Certain monsters don't use weapons when encountered as enemies,
             * but players who polymorph into them have hands or claws and
             * thus should be able to use weapons.  This shouldn't prohibit
             * the use of most special abilities, either.
             * If monster has multiple claw attacks, only one can use weapon.
             */
            weapon_used = TRUE;
            /* Potential problem: if the monster gets multiple weapon attacks,
             * we currently allow the player to get each of these as a weapon
             * attack.  Is this really desirable?
             */
            /* approximate two-weapon mode; known_hitum() -> hmon() -> &c
               might destroy the weapon argument, but it might also already
               be Null, and we want to track that for passive() */
            originalweapon = (altwep && uswapwep) ? global_ref("uswapwep", ptr_to(struct_obj)) : global_ref("uwep", ptr_to(struct_obj));
            if (uswapwep /* set up 'altwep' flag for next iteration */
                /* only consider secondary when wielding one-handed primary */
                && uwep && (uwep.oclass == WEAPON_CLASS || is_weptool(uwep))
                && !bimanual(uwep)
                /* only switch if not wearing shield and not at artifact;
                   shield limitation is iffy since still get extra swings
                   if polyform has them, but it matches twoweap behavior;
                   twoweap also only allows primary to be an artifact, so
                   if alternate weapon is one, don't use it */
                && !uarms && !uswapwep.oartifact
                /* only switch to uswapwep if it's a weapon */
                && (uswapwep.oclass == WEAPON_CLASS || is_weptool(uswapwep))
                /* only switch if uswapwep is not bow, arrows, or darts */
                && !(is_launcher(uswapwep) || is_ammo(uswapwep)
                     || is_missile(uswapwep)) /* dart, shuriken, boomerang */
                /* and not two-handed and not incapable of being wielded */
                && !bimanual(uswapwep)
                && !(objects[uswapwep.otyp].oc_material == SILVER
                     && Hate_silver()))
                altwep = +!altwep; /* toggle for next attack */
            weapon = originalweapon[0];
            if (!weapon) /* no need to go beyond no-gloves to rings; not ...*/
                originalweapon = global_ref("uarmg", ptr_to(struct_obj)); /*... subject to erosion damage */

            tmp = find_roll_to_hit(mon, AT_WEAP, weapon, attknum,
                                   armorpenalty);
            mon_maybe_unparalyze(mon);
            dieroll = rnd(20);
            dhit[0] = (tmp > dieroll || u.uswallow ? 1 : 0);
            if (multi_weap > 1)
                ++gt.twohits;
            /* caller must set gb.bhitpos */
            monster_survived = known_hitum(mon, weapon, dhit, tmp,
                                           armorpenalty[0], mattk, dieroll);
            /* originalweapon points to an equipment slot which might
               now be empty if the weapon was destroyed during the hit;
               passive(,weapon,...) won't call passive_obj() in that case */
            weapon = originalweapon[0]; /* might receive passive erosion */
            if (!monster_survived) {
                /* enemy dead, before any special abilities used */
                sum[i] = M_ATTK_DEF_DIED;
                break;
            } else
                sum[i] = dhit[0] ? M_ATTK_HIT : M_ATTK_MISS;
            /* might be a worm that gets cut in half; if so, early return */
            if (m_at(u.ux + u.dx, u.uy + u.dy) != mon) {
                i = NATTK; /* skip additional attacks */
                /* proceed with uswapwep->cursed check, then exit loop */
                break passivedone;
            }
            /* Do not print "You hit" message; known_hitum already did it. */
            if (dhit[0] && mattk.adtyp != AD_SPEL && mattk.adtyp != AD_PHYS)
                sum[i] = damageum(mon, mattk, 0);
            break;
        case AT_CLAW:
            if (uwep && !cantwield(gy.youmonst.data) && !weapon_used)
                { $goto = "use_weapon"; continue $goto_use_weapon; };
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case AT_TUCH:
            if (uwep && gy.youmonst.data.mlet == S_LICH && !weapon_used)
                { $goto = "use_weapon"; continue $goto_use_weapon; };
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case AT_KICK:
            if (mattk.aatyp == AT_KICK && mtrapped_in_pit(gy.youmonst))
                continue $out_use_weapon;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case AT_BITE:
        case AT_STNG:
        case AT_BUTT:
        case AT_TENT:
        /*weaponless:*/
            tmp = find_roll_to_hit(mon, mattk.aatyp, null,
                                   attknum, armorpenalty);
            mon_maybe_unparalyze(mon);
            dieroll = rnd(20);
            dhit[0] = (tmp > dieroll || u.uswallow ? 1 : 0);
            if (dhit[0]) {
                var compat, specialdmg;
                silverhit[0] = 0;
                var verb = 0; /* verb or body part */

                if (!u.uswallow
                    && (compat = could_seduce(gy.youmonst, mon, mattk))
                       != 0) {
                    You(_("%s %s %s."),
                        (mon.mcansee && haseyes(mon.data)) ? _("smile at")
                                                             : _("talk to"),
                        mon_nam(mon),
                        (compat == 2) ? _("engagingly") : _("seductively"));
                    /* doesn't anger it; no wakeup() */
                    sum[i] = damageum(mon, mattk, 0);
                    break;
                }
                wakeup(mon, TRUE);

                specialdmg = 0; /* blessed and/or silver bonus */
                switch (mattk.aatyp) {
                case AT_CLAW:
                case AT_TUCH:
                    /* verb=="claws" may be overridden below */
                    verb = (mattk.aatyp == AT_TUCH) ? _("touch") : _("claws");
                    /* decide if silver-hater will be hit by silver ring(s);
                       for 'multi_claw' where attacks alternate right/left,
                       assume 'even' claw or touch attacks use dominant hand
                       or paw, 'odd' ones use non-dominant hand for ring
                       interaction; even vs odd is based on actual attacks
                       rather than on index into mon->dat->mattk[] so that
                       {bite,claw,claw} instead of {claw,claw,bite} doesn't
                       make poly'd hero mysteriously switch handedness */
                    odd_claw = +!odd_claw;
                    specialdmg = special_dmgval(gy.youmonst, mon,
                                                W_ARMG
                                                | ((odd_claw || !multi_claw)
                                                   ? W_RINGL : 0)
                                                | ((!odd_claw || !multi_claw)
                                                   ? W_RINGR : 0),
                                                silverhit);
                    break;
                case AT_TENT:
                    /* assumes mind flayer's tentacles-on-head rather
                       than sea monster's tentacle-as-arm */
                    verb = _("tentacles");
                    break;
                case AT_KICK:
                    verb = _("kick");
                    specialdmg = special_dmgval(gy.youmonst, mon, W_ARMF,
                                                silverhit);
                    break;
                case AT_BUTT:
                    verb = _("head butt"); /* mbodypart(mon,HEAD)=="head" */
                    /* hypothetical; if any form with a head-butt attack
                       could wear a helmet, it would hit shades when
                       wearing a blessed (or silver) one */
                    specialdmg = special_dmgval(gy.youmonst, mon, W_ARMH,
                                                silverhit);
                    break;
                case AT_BITE:
                    verb = _("bite");
                    break;
                case AT_STNG:
                    verb = _("sting");
                    break;
                default:
                    verb = _("hit");
                    break;
                }
                if (mon.data == mons[PM_SHADE] && !specialdmg) {
                    if (!strcmp(verb, _("hit"))
                        || (mattk.aatyp == AT_CLAW && humanoid(mon.data)))
                        verb = _("attack");
                    Your(_("%s %s harmlessly through %s."),
                         verb, vtense(verb, _("pass")), mon_nam(mon));
                } else {
                    /* either not a shade or no special silver/blessed damage,
                       other unsolid monsters are immune to AT_TUCH+AD_WRAP */
                    if (failed_grab(gy.youmonst, mon, mattk))
                        break; /* miss; message already given */

                    if (mattk.aatyp == AT_TENT) {
                        Your(_("tentacles suck %s."), mon_nam(mon));
                    } else {
                        if (mattk.aatyp == AT_CLAW)
                            verb = _("hit"); /* not "claws" */
                        You(_("%s %s."), verb, mon_nam(mon));
                        if (silverhit[0] && flags.verbose)
                            silver_sears(gy.youmonst, mon, silverhit[0]);
                    }
                    sum[i] = damageum(mon, mattk, specialdmg);
                }
            } else { /* !dhit */
                missum(mon, mattk, +(tmp + armorpenalty[0] > dieroll));
            }
            break;

        case AT_HUGS: {
            var specialdmg;
            silverhit[0] = 0;
            var byhand = hug_throttles(mons[u.umonnum]),
                    unconcerned = (byhand && !can_be_strangled(mon) ? 1 : 0);

            if (sticks(mon.data) || u.uswallow || gn.notonhead
                || (byhand && (uwep || !has_head(mon.data)))) {
                /* can't hold a holder due to subsequent ambiguity over
                   who is holding whom; can't hug engulfer from inside;
                   can't hug a worm tail (would immobilize entire worm!);
                   byhand: can't choke something that lacks a head;
                   not allowed to make a choking hug if wielding a weapon
                   (but might have grabbed w/o weapon, then wielded one,
                   and may even be attacking a different monster now) */
                if (byhand && uwep && u.ustuck
                    && !(sticks(u.ustuck.data) || u.uswallow))
                    uunstick();
                continue $out_use_weapon; /* not 'break'; bypass passive counter-attack */
            }
            /* automatic if prev two attacks succeed, or if
               already grabbed in a previous attack */
            dhit[0] = 1;
            wakeup(mon, TRUE);
            /* choking hug/throttling grab uses hands (gloves or rings);
               normal hug uses outermost of cloak/suit/shirt */
            specialdmg = special_dmgval(gy.youmonst, mon,
                                        byhand ? (W_ARMG | W_RINGL | W_RINGR)
                                               : (W_ARMC | W_ARM | W_ARMU),
                                        silverhit);
            if (unconcerned) {
                /* strangling something which can't be strangled */
                if (mattk != alt_attk) {
                    struct_assign(alt_attk, mattk);
                    mattk = alt_attk;
                }
                /* change damage to 1d1; not strangling but still
                   doing [minimal] physical damage to victim's body */
                mattk.damn = mattk.damd = 1;
                /* don't give 'unconcerned' feedback if there is extra damage
                   or if it is nearly destroyed or if creature doesn't have
                   the mental ability to be concerned in the first place */
                if (specialdmg || mindless(mon.data)
                    || mon.mhp <= 1 + max(u.udaminc, 1))
                    unconcerned = FALSE;
            }
            if (mon.data == mons[PM_SHADE]) {
                var verb = byhand ? _("grasp") : _("hug");

                /* hugging a shade; successful if blessed outermost armor
                   for normal hug, or blessed gloves or silver ring(s) for
                   choking hug; deals damage but never grabs hold */
                if (specialdmg) {
                    You(_("%s %s%s"), verb, mon_nam(mon), exclam(specialdmg));
                    if (silverhit[0] && flags.verbose)
                        silver_sears(gy.youmonst, mon, silverhit[0]);
                    sum[i] = damageum(mon, mattk, specialdmg);
                } else {
                    Your(_("%s passes harmlessly through %s."),
                         verb, mon_nam(mon));
                }
                break;
            }
            /* can't grab unsolid creatures (checked after shade handling) */
            if (failed_grab(gy.youmonst, mon, mattk))
                break;
            /* hug attack against ordinary foe */
            if (mon == u.ustuck) {
                pline(_("%s is being %s%s."), Monnam(mon),
                      byhand ? _("throttled") : _("crushed"),
                      /* extra feedback for non-breather being choked */
                      unconcerned ? _(" but doesn't seem concerned") : _(""));
                if (silverhit[0] && flags.verbose)
                    silver_sears(gy.youmonst, mon, silverhit[0]);
                sum[i] = damageum(mon, mattk, specialdmg);
            } else if (i >= 2 && (sum[i - 1] > M_ATTK_MISS)
                       && (sum[i - 2] > M_ATTK_MISS)) {
                /* in case we're hugging a new target while already
                   holding something else; yields feedback
                   "<u.ustuck> is no longer in your clutches" */
                if (u.ustuck && u.ustuck != mon)
                    uunstick();
                You(_("grab %s!"), mon_nam(mon));
                set_ustuck(mon);
                if (silverhit[0] && flags.verbose)
                    silver_sears(gy.youmonst, mon, silverhit[0]);
                sum[i] = damageum(mon, mattk, specialdmg);
            }
            break; /* AT_HUGS */
        }

        case AT_EXPL: /* automatic hit if next to */
            dhit[0] = -1;
            wakeup(mon, TRUE);
            You(_("explode!"));
            sum[i] = explum(mon, mattk);
            break;

        case AT_ENGL:
            tmp = find_roll_to_hit(mon, mattk.aatyp, null,
                                   attknum, armorpenalty);
            mon_maybe_unparalyze(mon);
            if ((dhit[0] = +(tmp > rnd(20 + i)))) {
                wakeup(mon, TRUE);
                /* can't engulf unsolid creatures */
                if (mon.data == mons[PM_SHADE]) {
                    /* no specialdmg check needed */
                    Your(_("attempt to surround %s is harmless."), mon_nam(mon));
                } else if (failed_grab(gy.youmonst, mon, mattk)) {
                    ; /* non-shade miss; message already given */
                } else {
                    sum[i] = gulpum(mon, mattk);
                    if (sum[i] == M_ATTK_DEF_DIED
                        && (mon.data.mlet == S_ZOMBIE
                            || mon.data.mlet == S_MUMMY)
                        && rn2(5) && !Sick_resistance()) {
                        You_feel(_("%ssick."), Sick() ? _("very ") : _(""));
                        mdamageu(mon, rnd(8));
                    }
                }
            } else {
                missum(mon, mattk, FALSE);
            }
            break;

        case AT_MAGC:
            /* No check for uwep; if wielding nothing we want to
             * do the normal 1-2 points bare hand damage...
             */
            if ((gy.youmonst.data.mlet == S_KOBOLD
                 || gy.youmonst.data.mlet == S_ORC
                 || gy.youmonst.data.mlet == S_GNOME) && !weapon_used)
                { $goto = "use_weapon"; continue $goto_use_weapon; };
            /* FALLTHROUGH */;
            /*FALLTHRU*/

        case AT_NONE:
        case AT_BOOM:
            continue $out_use_weapon;
        /* Not break--avoid passive attacks from enemy */

        case AT_BREA:
        case AT_SPIT:
        case AT_GAZE: /* all done using #monster command */
            dhit[0] = 0;
            break;

        default: /* Strange... */
            impossible(_("strange attack of yours (%d)"), mattk.aatyp);
        } break; }
        if (dhit[0] == -1) {
            u.mh = -1; /* dead in the current form */
            rehumanize();
        }
        if (sum[i] == M_ATTK_DEF_DIED) {
            /* defender dead */
            passive(mon, weapon, 1, 0, mattk.aatyp, FALSE);
        } else {
            passive(mon, weapon, +(sum[i] != M_ATTK_MISS), 1,
                           mattk.aatyp, FALSE);
        }

        if (mhitm_knockback(gy.youmonst, mon, mattk, sum.subarray(i), weapon_used))
            break;

        /* don't use sum[i] beyond this point;
           'i' will be out of bounds if we get here via 'goto' */
 }
        /* when using dual weapons, cursed secondary weapon doesn't weld,
           it gets dropped; do the same when multiple AT_WEAP attacks
           simulate twoweap */
        if (uswapwep && weapon == uswapwep && weapon.cursed) {
            drop_uswapwep();
            break; /* don't proceed with additional attacks */
        }
        /* stop attacking if defender has died;
           needed to defer this until after uswapwep->cursed check */
        if (DEADMONSTER(mon))
            break;
        if (!Upolyd())
            break; /* No extra attacks if no longer a monster */
        if (gm.multi < 0)
            break; /* If paralyzed while attacking, i.e. floating eye */
    }

    gv.vis = FALSE; /* reset */
    gt.twohits = 0;
    /* return value isn't used, but make it match hitum()'s */
    return +!DEADMONSTER(mon);
    } finally { stack_pop($frame); }
}

/*      Special (passive) attacks on you by monsters done here.
 */
export function passive(
    mon,
    weapon,
    mhitb,
    maliveb,
    aatyp,
    wep_was_destroyed) { /* int */
    let ptr = mon.data;
    let i, tmp;
    let mhit = mhitb ? M_ATTK_HIT : M_ATTK_MISS;
    let malive = maliveb ? M_ATTK_HIT : M_ATTK_MISS;

    for (i = 0;; i++) {
        if (i >= NATTK)
            return (malive | mhit); /* no passive attacks */
        if (ptr.mattk[i].aatyp == AT_NONE)
            break; /* try this one */
    }
    /* Note: tmp not always used */
    if (ptr.mattk[i].damn)
        tmp = d((ptr.mattk[i].damn), (ptr.mattk[i].damd));
    else if (ptr.mattk[i].damd)
        tmp = d(mon.m_lev + 1, (ptr.mattk[i].damd));
    else
        tmp = 0;

    /*  These affect you even if they just died.
     */
    switch (ptr.mattk[i].adtyp) {
    case AD_FIRE:
        if (mhitb && !mon.mcan && weapon) {
            if (aatyp == AT_KICK) {
                if (uarmf && !rn2(6))
                    erode_obj(uarmf, xname(uarmf), ERODE_BURN,
                                     EF_GREASE | EF_VERBOSE);
            } else if (aatyp == AT_WEAP || aatyp == AT_CLAW
                       || aatyp == AT_MAGC || aatyp == AT_TUCH)
                passive_obj(mon, weapon, (ptr.mattk[i]));
        }
        break;
    case AD_ACID:
        if (mhitb && rn2(2)) {
            if (Blind() || !flags.verbose)
                You(_("are splashed!"));
            else
                You(_("are splashed by %s %s!"), s_suffix(mon_nam(mon)),
                    hliquid(_("acid")));

            if (!Acid_resistance()) {
                mdamageu(mon, tmp);
                monstunseesu(M_SEEN_ACID);
            } else {
                monstseesu(M_SEEN_ACID);
            }
            if (!rn2(30))
                erode_armor(gy.youmonst, ERODE_CORRODE);
        }
        if (mhitb && weapon) {
            if (aatyp == AT_KICK) {
                if (uarmf && !rn2(6))
                    erode_obj(uarmf, xname(uarmf), ERODE_CORRODE,
                                     EF_GREASE | EF_VERBOSE);
            } else if (aatyp == AT_WEAP || aatyp == AT_CLAW
                       || aatyp == AT_MAGC || aatyp == AT_TUCH)
                passive_obj(mon, weapon, (ptr.mattk[i]));
        }
        exercise(A_STR, FALSE);
        break;
    case AD_STON:
        if (mhitb) { /* successful attack */
            let protector = attk_protection(aatyp);

            /* hero using monsters' AT_MAGC attack is hitting hand to
               hand rather than casting a spell */
            if (aatyp == AT_MAGC)
                protector = W_ARMG;

            if (protector == 0 /* no protection */
                || (protector == W_ARMG && !uarmg
                    && !uwep && !wep_was_destroyed)
                || (protector == W_ARMF && !uarmf)
                || (protector == W_ARMH && !uarmh)
                || (protector == (W_ARMC | W_ARMG) && (!uarmc || !uarmg))) {
                if (!Stone_resistance()
                    && !(poly_when_stoned(gy.youmonst.data)
                         && polymon(PM_STONE_GOLEM))) {
                    done_in_by(mon, STONING); /* "You turn to stone..." */
                    return M_ATTK_DEF_DIED;
                }
            }
        }
        break;
    case AD_RUST:
        if (mhitb && !mon.mcan && weapon) {
            if (aatyp == AT_KICK) {
                if (uarmf)
                    erode_obj(uarmf, xname(uarmf), ERODE_RUST,
                                     EF_GREASE | EF_VERBOSE);
            } else if (aatyp == AT_WEAP || aatyp == AT_CLAW
                       || aatyp == AT_MAGC || aatyp == AT_TUCH)
                passive_obj(mon, weapon, (ptr.mattk[i]));
        }
        break;
    case AD_CORR:
        if (mhitb && !mon.mcan && weapon) {
            if (aatyp == AT_KICK) {
                if (uarmf)
                    erode_obj(uarmf, xname(uarmf), ERODE_CORRODE,
                                     EF_GREASE | EF_VERBOSE);
            } else if (aatyp == AT_WEAP || aatyp == AT_CLAW
                       || aatyp == AT_MAGC || aatyp == AT_TUCH)
                passive_obj(mon, weapon, (ptr.mattk[i]));
        }
        break;
    case AD_MAGM:
        /* wrath of gods for attacking Oracle */
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
            monstseesu(M_SEEN_MAGR);
            pline(_("A hail of magic missiles narrowly misses you!"));
        } else {
            You(_("are hit by magic missiles appearing from thin air!"));
            mdamageu(mon, tmp);
            monstunseesu(M_SEEN_MAGR);
        }
        break;
    case AD_ENCH: /* KMH -- remove enchantment (disenchanter) */
        if (mhitb) {
            if (aatyp == AT_KICK) {
                if (!weapon)
                    break;
            } else if (aatyp == AT_BITE || aatyp == AT_BUTT
                       || (aatyp >= AT_STNG && aatyp < AT_WEAP)) {
                break; /* no object involved */
            } else {
                /*
                 * TODO:  #H2668 - if hitting with a ring that has a
                 * positive enchantment, it ought to be subject to
                 * having that enchantment reduced.  But we don't have
                 * sufficient information here to know which hand/ring
                 * has delivered a weaponless blow.
                 */
                ;
            }
            passive_obj(mon, weapon, (ptr.mattk[i]));
        }
        break;
    default:
        break;
    }

    /*  These only affect you if they still live.
     */
    if (malive && !mon.mcan && rn2(3)) {
        switch (ptr.mattk[i].adtyp) {
        case AD_PLYS:
            if (ptr == mons[PM_FLOATING_EYE]) {
                if (!canseemon(mon)) {
                    break;
                }
                if (mon.mcansee) {
                    if (ureflects(_("%s gaze is reflected by your %s."),
                                  s_suffix(Monnam(mon)))) {
                        ;
                    } else if (Hallucination() && rn2(4)) {
                        /* [it's the hero who should be getting paralyzed
                           and isn't; this message describes the monster's
                           reaction rather than the hero's escape] */
                        pline(_("%s looks %s%s."), Monnam(mon),
                              !rn2(2) ? _("") : _("rather "),
                              !rn2(2) ? _("numb") : _("stupefied"));
                    } else if (Free_action()) {
                        You(_("momentarily stiffen under %s gaze!"),
                            s_suffix(mon_nam(mon)));
                    } else {
                        You(_("are frozen by %s gaze!"), s_suffix(mon_nam(mon)));
                        nomul((ACURR(A_WIS) > 12 || rn2(4)) ? -tmp : -127);
                        /* set gm.multi_reason;
                           3.6.x used "frozen by a monster's gaze" */
                        dynamic_multi_reason(mon, _("frozen"), TRUE);
                        gn.nomovemsg = 0;
                    }
                } else {
                    pline(_("%s cannot defend itself."),
                          Adjmonnam(mon, _("blind")));
                    if (!rn2(500))
                        change_luck(-1);
                }
            } else if (Free_action()) {
                You(_("momentarily stiffen."));
            } else { /* gelatinous cube */
                You(_("are frozen by %s!"), mon_nam(mon));
                gn.nomovemsg = You_can_move_again();
                nomul(-tmp);
                /* set gm.multi_reason;
                   3.6.x used "frozen by a monster"; be more specific */
                dynamic_multi_reason(mon, _("frozen"), FALSE);
                exercise(A_DEX, FALSE);
            }
            break;
        case AD_COLD: /* brown mold or blue jelly */
            if (monnear(mon, u.ux, u.uy)) {
                if (Cold_resistance()) {
                    shieldeff(u.ux, u.uy);
                    You_feel(_("a mild chill."));
                    monstseesu(M_SEEN_COLD);
                    ugolemeffects(AD_COLD, tmp);
                    break;
                }
                monstunseesu(M_SEEN_COLD);
                You(_("are suddenly very cold!"));
                mdamageu(mon, tmp);
                /* monster gets stronger with your heat! */
                healmon(mon, Math.trunc((tmp + rn2(2)) / 2), Math.trunc((tmp + 1) / 2));
                /* at a certain point, the monster will reproduce! */
                if (mon.mhpmax > (mon.m_lev + 1) * 8)
                    split_mon(mon, gy.youmonst);
            }
            break;
        case AD_STUN: /* specifically yellow mold */
            if (!Stunned())
                make_stunned(tmp, TRUE);
            break;
        case AD_FIRE:
            if (monnear(mon, u.ux, u.uy)) {
                if (Fire_resistance()) {
                    shieldeff(u.ux, u.uy);
                    You_feel(_("mildly warm."));
                    monstseesu(M_SEEN_FIRE);
                    ugolemeffects(AD_FIRE, tmp);
                    break;
                }
                monstunseesu(M_SEEN_FIRE);
                You(_("are suddenly very hot!"));
                mdamageu(mon, tmp); /* fire damage */
            }
            break;
        case AD_ELEC:
            if (Shock_resistance()) {
                shieldeff(u.ux, u.uy);
                You_feel(_("a mild tingle."));
                monstseesu(M_SEEN_ELEC);
                ugolemeffects(AD_ELEC, tmp);
                break;
            }
            monstunseesu(M_SEEN_ELEC);
            You(_("are jolted with electricity!"));
            mdamageu(mon, tmp);
            break;
        default:
            break;
        }
    }
    return (malive | mhit);
}

/*
 * Special (passive) attacks on an attacking object by monsters done here.
 * Assumes the attack was successful.
 */
export function passive_obj(
    mon,
    obj,
    mattk) { /* void */ /* null means we find one internally */
    let ptr = mon.data;
    let i;

    /* [this first bit is obsolete; we're not called with Null anymore] */
    /* if caller hasn't specified an object, use uwep, uswapwep or uarmg */
    if (!obj) {
        obj = (u.twoweap && uswapwep && !rn2(2)) ? uswapwep : uwep;
        if (!obj && mattk.adtyp == AD_ENCH)
            obj = uarmg; /* no weapon? then must be gloves */
        if (!obj)
            return; /* no object to affect */
    }

    /* if caller hasn't specified an attack, find one */
    if (!mattk) {
        for (i = 0;; i++) {
            if (i >= NATTK)
                return; /* no passive attacks */
            if (ptr.mattk[i].aatyp == AT_NONE)
                break; /* try this one */
        }
        mattk = (ptr.mattk[i]);
    }

    switch (mattk.adtyp) {
    case AD_FIRE:
        if (!rn2(6) && !mon.mcan
            /* steam vortex: fire resist applies, fire damage doesn't */
            && mon.data != mons[PM_STEAM_VORTEX]) {
            erode_obj(obj, 0, ERODE_BURN, EF_NONE);
        }
        break;
    case AD_ACID:
        if (!rn2(6)) {
            erode_obj(obj, 0, ERODE_CORRODE, EF_GREASE);
        }
        break;
    case AD_RUST:
        if (!mon.mcan) {
            erode_obj(obj, 0, ERODE_RUST, EF_GREASE);
        }
        break;
    case AD_CORR:
        if (!mon.mcan) {
            erode_obj(obj, 0, ERODE_CORRODE, EF_GREASE);
        }
        break;
    case AD_ENCH:
        if (!mon.mcan) {
            if (drain_item(obj, TRUE) && carried(obj)
                && (obj.known || obj.oclass == ARMOR_CLASS)) {
                pline(_("%s less effective."), Yobjnam2(obj, _("seem")));
            }
            break;
        }
        /* FALLTHROUGH */;
        /* FALLTHRU */
    default:
        break;
    }

    if (carried(obj))
        update_inventory();
}

/* used by stumble_onto_mimic() and bhitm() cases WAN_LOCKING, WAN_OPENING */
export function that_is_a_mimic(
    mtmp,
    mimic_flags) { /* void */ /* 0, MIM_REVEAL, MIM_OMIT_WAIT, REVEAL+OMIT */
    const $frame = stack_frame(); try {
    let generic = init_string(static_array("that_is_a_mimic.generic", char, sizeof_string("a monster")), _("a monster"), true);
    let fmtbuf = stack_array(char, BUFSZ);
    let what = 0;
    let reveal_it = +((mimic_flags & MIM_REVEAL) != 0),
            omit_wait = +((mimic_flags & MIM_OMIT_WAIT) != 0);

    strcpy(fmtbuf, _("Wait!  That's %s!"));
    if (Blind()) {
        if (!Blind_telepat())
            what = generic; /* with default fmt */
        else if (M_AP_TYPE(mtmp) == M_AP_MONSTER)
            what = a_monnam(mtmp); /* differs from what was sensed */
    } else {
        let x = mtmp.mx, y = mtmp.my;
        let glyph = glyph_at(x, y);

        if (glyph_is_cmap(glyph)) {
            let sym = glyph_to_cmap(glyph);

            if (M_AP_TYPE(mtmp) == M_AP_FURNITURE
                || (M_AP_TYPE(mtmp) == M_AP_OBJECT && sym == S_trapped_chest))
                Snprintf(fmtbuf, sizeof(array_of(char, BUFSZ)), _("That %s actually is %%s!"), defsyms[sym].explanation)
;
        } else if (glyph_is_object(glyph)) {
            let fakeobj;
            let otmp_name;
            let otmp = stack_var(ptr_to(struct_obj), null);

            fakeobj = object_from_map(glyph, x, y, otmp);
            otmp_name = (otmp[0] && otmp[0].otyp != STRANGE_OBJECT)
                        ? simpleonames(otmp[0]) : _("strange object");
            Snprintf(fmtbuf, sizeof(array_of(char, BUFSZ)), _("%s %s %s %%s!"), (otmp[0] && is_plural(otmp[0])) ? _("Those") : _("That"), otmp_name, otmp[0] ? otense(otmp[0], _("are")) : _("is"))

;
            if (fakeobj && otmp[0]) {
                otmp[0].where = OBJ_FREE; /* object_from_map set to OBJ_FLOOR */
                dealloc_obj(otmp[0]);
            }
        } else if (glyph_is_monster(glyph)) {
            let mtmp_name;
            let mndx = glyph_to_mon(glyph);

            assert(mndx >= LOW_PM && mndx <= HIGH_PM);
            mtmp_name = pmname(mons[mndx], Mgender(mtmp));
            Snprintf(fmtbuf, sizeof(array_of(char, BUFSZ)), _("Wait!  That %s is really %%s!"), mtmp_name)
;
        }

        /* cloned Wiz starts out mimicking some other monster and
           might make himself invisible before being revealed */
        if (mtmp.minvis && !See_invisible())
            what = generic;
        else if (M_AP_TYPE(mtmp) == M_AP_MONSTER)
            what = x_monnam(mtmp, ARTICLE_A, (0), EXACT_NAME, TRUE);
        else if (mtmp.data.mlet == S_MIMIC
                 && (M_AP_TYPE(mtmp) == M_AP_OBJECT
                     || M_AP_TYPE(mtmp) == M_AP_FURNITURE)
                 && (mtmp.msleeping || mtmp.mfrozen))
            /* BUG: this will misclassify a paralyzed mimic as sleeping */
            what = x_monnam(mtmp, ARTICLE_A, _("sleeping"), 0, FALSE);
        else
            what = a_monnam(mtmp);
    }

    if (what) {
        let i = (omit_wait && !strncmp(fmtbuf, _("Wait!  "), 7)) ? 7 : 0;

        pline(fmtbuf + i, what);
    }
    if (reveal_it)
        seemimic(mtmp);
    } finally { stack_pop($frame); }
}

/* Note: caller must ascertain mtmp is mimicking... */
export function stumble_onto_mimic(mtmp) { /* void */
    that_is_a_mimic(mtmp, MIM_REVEAL);

    if (!u.ustuck && !mtmp.mflee && dmgtype(mtmp.data, AD_STCK)
        /* must be adjacent; attack via polearm could be from farther away */
        && m_next2u(mtmp))
        set_ustuck(mtmp);

    wakeup(mtmp, FALSE); /* clears mimicking */
    /* if hero is blind, wakeup() won't display the monster even though
       it's no longer concealed */
    if (!canspotmon(mtmp)
        && !glyph_is_invisible(levl()[mtmp.mx][mtmp.my].glyph))
        map_invisible(mtmp.mx, mtmp.my);
}

export function disguised_as_non_mon(mtmp) { /* boolean */
    return (!sensemon(mtmp)
            && M_AP_TYPE(mtmp)
            && M_AP_TYPE(mtmp) != M_AP_MONSTER ? 1 : 0);
}

export function disguised_as_mon(mtmp) { /* boolean */
    return (M_AP_TYPE(mtmp)
            && M_AP_TYPE(mtmp) == M_AP_MONSTER ? 1 : 0);
}

function nohandglow(mon) { /* void */
    let hands;
    let altfeedback;

    if (!u.umconf || mon.mconf)
        return;

    hands = makeplural(body_part(HAND));
    altfeedback = (Blind() || Invisible() ? 1 : 0); /* Invisible == Invis && !See_invis */
    if (u.umconf == 1) {
        if (altfeedback)
            Your(_("%s stop tingling."), hands);
        else
            Your(_("%s stop glowing %s."), hands, hcolor(NH_RED()));
    } else {
        if (altfeedback)
            pline_The(_("tingling in your %s lessens."), hands);
        else
            Your(_("%s no longer glow so brightly %s."), hands, hcolor(NH_RED()));
    }
    u.umconf--;
}

/* returns 1 if light flash has noticeable effect on 'mtmp', 0 otherwise */
export function flash_hits_mon(
    mtmp,
    otmp) { /* int */ /* source of flash */
    const $frame = stack_frame(); try {
    let lev;
    let mx = mtmp.mx, my = mtmp.my;
    let tmp, amt, useeit, res = 0;

    if (gn.notonhead)
        return 0;
    lev = levl()[mx][my];
    useeit = canseemon(mtmp);

    if (M_AP_TYPE(mtmp) != M_AP_NOTHING) {
        let whatbuf = stack_array(char, BUFSZ);
        let oldglyph = glyph_at(mx, my);

        /* 'altmon' probably doesn't matter here because 'whatbuf' will
           only be shown if the glyph changes and wakeup() doesn't call
           seemimic() for M_AP_MONSTER */
        mhidden_description(mtmp, MHID_ALTMON, whatbuf);

        wakeup(mtmp, FALSE); /* -> seemimic() -> newsym(); also calls
                              * finish_meating() to end quickmimic */

        /* if glyph has changed then hero saw something happen */
        if (glyph_at(mx, my) != oldglyph) {
            pline(_("That %s is really %s%c"), whatbuf,
                  /* y_monnam()+a_monnam() */
                  x_monnam(mtmp, mtmp.mtame ? ARTICLE_YOUR : ARTICLE_A,
                           0, 0, FALSE),
                  mtmp.mtame ? ord('.') : ord('!'));
            res = 1;
        }
    }

    if (mtmp.msleeping && haseyes(mtmp.data)) {
        mtmp.msleeping = 0;
        if (useeit) {
            pline_The(_("flash awakens %s."), mon_nam(mtmp));
            res = 1;
        }
    } else if (mtmp.data.mlet != S_LIGHT) {
        if (!resists_blnd(mtmp)) {
            tmp = dist2(otmp.ox, otmp.oy, mx, my);
            if (useeit) {
                pline(_("%s is blinded by the flash!"), Monnam(mtmp));
                res = 1;
            }
            if (mtmp.data == mons[PM_GREMLIN]) {
                /* Rule #1: Keep them out of the light. */
                amt = (otmp.otyp == WAN_LIGHT) ? d(1 + otmp.spe, 4)
                                                : rnd(min(mtmp.mhp, 4));
                light_hits_gremlin(mtmp, amt);
            }
            if (!DEADMONSTER(mtmp)) {
                if (!svc.context.mon_moving)
                    setmangry(mtmp, TRUE);
                if (tmp < 9 && !mtmp.isshk && rn2(4))
                    monflee(mtmp, rn2(4) ? rnd(100) : 0, FALSE, TRUE);
                mtmp.mcansee = 0;
                mtmp.mblinded = unsigned((tmp < 3) ? 0 : rnd(1 + Math.trunc(50 / tmp)));
            }
        } else if (useeit) {
            if (resists_blnd_by_arti(mtmp))
                shieldeff(mx, my);
            if (flags.verbose) {
                if (lev.lit)
                    pline(_("The flash of light shines on %s."), mon_nam(mtmp));
                else
                    pline(_("%s is illuminated."), Monnam(mtmp));
                res = 2; /* 'message has been given' temporary value */
            }
        }
    }
    if (res) {
        if (!lev.lit)
            display_nhwindow()(WIN_MESSAGE, TRUE);
        res &= 1; /* change temporary 2 back to 0 */
    }
    return res;
    } finally { stack_pop($frame); }
}

export function light_hits_gremlin(mon, dmg) { /* void */
    if (!Deaf() && mdistu(mon) <= 90) {
        /* cry of pain can be heard somewhat farther than the waking radius */
        pline_mon(mon, _("%s %s!"), Monnam(mon),
                  (dmg > Math.trunc(mon.mhp / 2)) ? _("wails in agony")
                                       : _("cries out in pain"));
    } else if (canseemon(mon)) {
        pline_mon(mon, _("%s recoils from the light!"), Monnam(mon));
    }
    mon.mhp -= dmg;
    wake_nearto(mon.mx, mon.my, 30);
    if (DEADMONSTER(mon)) {
        if (svc.context.mon_moving)
            monkilled(mon, 0, AD_BLND);
        else
            killed(mon);
    } else if (cansee(mon.mx, mon.my) && !canspotmon(mon)) {
        map_invisible(mon.mx, mon.my);
    }
}

/*uhitm.c*/

import { A_LAWFUL } from "./align.h.js";
import {
    ART_CLEAVER, ART_GIANTSLAYER, ART_OGRESMASHER, ART_SNICKERSNEE, ART_STORMBRINGER,
} from "./artilist.h.js";
import { A_CON, A_DEX, A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { NH_RED, You_can_move_again, something, vision_clears } from "./decl.h.macros.js";
import {
    ARMOR_CLASS, COIN_CLASS, GEM_CLASS, POTION_CLASS, SPBOOK_CLASS, S_BLOB, S_EEL, S_EYE, S_FUNGUS,
    S_GNOME, S_HUMAN, S_KOBOLD, S_LEPRECHAUN, S_LICH, S_LIGHT, S_MIMIC, S_MUMMY, S_NAGA, S_NYMPH,
    S_ORC, S_SNAKE, S_ZOMBIE, S_trapped_chest, WEAPON_CLASS,
} from "./defsym.h.js";
import { DISP_ALWAYS, DISP_END, EXPL_FIERY } from "./display.h.js";
import {
    canspotmon, glyph_is_cmap, glyph_is_invisible, glyph_is_monster, glyph_is_object,
    glyph_is_warning, glyph_to_mon, mon_to_glyph,
} from "./display.h.macros.js";
import { Is_airlevel, Is_medusa_level, Is_waterlevel } from "./dungeon.h.macros.js";
import { NEW_MOON } from "./flag.h.js";
import { ParanoidHit } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_CONDUCT, QBUFSZ, TRUE } from "./global.h.js";
import {
    ARTICLE_A, ARTICLE_THE, ARTICLE_YOUR, CXN_ARTICLE, CXN_PFX_THE, DIED, DIR_ERR, DISMOUNT_KNOCKED,
    DISMOUNT_POLY, DROWNING, ECMD_TIME, EXACT_NAME, FACE, HAND, HMON_APPLIED, HMON_KICKED,
    HMON_MELEE, HMON_THROWN, KILLED_BY, KILLED_BY_AN, LEG, MHID_ALTMON, MIM_OMIT_WAIT, MIM_REVEAL,
    MMOVE_DIED, NC_SHOW_MSG, NOTELL, NO_KILLER_PREFIX, NO_MM_FLAGS, NO_NC_FLAGS, NO_TRAP_FLAGS,
    RLOC_MSG, RLOC_NOMSG, STOMACH, STONING, SUPPRESS_HALLUCINATION, SUPPRESS_INVISIBLE, SUPPRESS_IT,
    SUPPRESS_NAME, SUPPRESS_SADDLE, TEST_MOVE, XKILL_GIVEMSG, XKILL_NOCORPSE, XKILL_NOMSG,
    invlet_basic,
} from "./hack.h.js";
import {
    DIR_LEFT, DIR_LEFT2, DIR_RIGHT, DIR_RIGHT2, NODIAG, Your1, max, mdistu, min, pline1, plur, rn1,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { EDOG } from "./mextra.h.macros.js";
import { ROOMOFFSET, SHOPBASE } from "./mkroom.h.js";
import {
    AD_ACID, AD_BLND, AD_COLD, AD_CONF, AD_CORR, AD_CURS, AD_DCAY, AD_DETH, AD_DGST, AD_DISE,
    AD_DRCO, AD_DRDX, AD_DREN, AD_DRIN, AD_DRLI, AD_DRST, AD_ELEC, AD_ENCH, AD_FAMN, AD_FIRE,
    AD_HALU, AD_HEAL, AD_LEGS, AD_MAGM, AD_PEST, AD_PHYS, AD_PLYS, AD_POLY, AD_RUST, AD_SAMU,
    AD_SEDU, AD_SGLD, AD_SITM, AD_SLEE, AD_SLIM, AD_SLOW, AD_SPEL, AD_SSEX, AD_STCK, AD_STON,
    AD_STUN, AD_TLPT, AD_WERE, AD_WRAP, AT_BITE, AT_BOOM, AT_BREA, AT_BUTT, AT_CLAW, AT_ENGL,
    AT_EXPL, AT_GAZE, AT_HUGS, AT_KICK, AT_MAGC, AT_NONE, AT_SPIT, AT_STNG, AT_TENT, AT_TUCH,
    AT_WEAP, M_ATTK_AGR_DIED, M_ATTK_AGR_DONE, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS,
    struct_mhitm_data,
} from "./monattk.h.js";
import {
    amorphous, amphibious, bigmonst, breathless, cant_drown, cantwield, carnivorous,
    completelyburns, completelyrots, completelyrusts, digests, enfolds, flaming, has_head, haseyes,
    herbivorous, hides_under, hug_throttles, humanoid, is_animal, is_demon, is_elf, is_floater,
    is_flyer, is_longworm, is_orc, is_rider, is_undead, is_watch, is_were, is_whirly, metallivorous,
    mindless, monsndx, noncorporeal, nonliving, passes_rocks, passes_walls, slimeproof, slithy,
    thick_skinned, touch_petrifies, type_is_pname, unsolid,
} from "./mondata.h.macros.js";
import { G_NOCORPSE, G_UNIQ, NEUTRAL } from "./monflag.h.js";
import {
    MSLOW, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, M_SEEN_ACID, M_SEEN_COLD,
    M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_SLEEP, NEED_WEAPON, STRAT_WAITFORU,
    STRAT_WAITMASK,
} from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, M_AP_TYPE, engulfing_u, helpless, is_vampshifter, ismnum, resists_acid,
    resists_cold, resists_elec, resists_fire, resists_poison, resists_ston, troll_baned,
} from "./monst.h.macros.js";
import {
    HIGH_PM, LOW_PM, NON_PM, PM_AMOROUS_DEMON, PM_ARCHON, PM_BALROG, PM_BARBARIAN, PM_BARBED_DEVIL,
    PM_BLACK_PUDDING, PM_BROWN_PUDDING, PM_CLAY_GOLEM, PM_ELF, PM_FAMINE, PM_FLOATING_EYE,
    PM_FOG_CLOUD, PM_GHOUL, PM_GREEN_SLIME, PM_GREMLIN, PM_HEALER, PM_IRON_GOLEM, PM_KNIGHT,
    PM_MEDUSA, PM_MONK, PM_PAPER_GOLEM, PM_PESTILENCE, PM_PURPLE_WORM, PM_PYROLISK, PM_ROGUE,
    PM_ROPE_GOLEM, PM_SAMURAI, PM_SHADE, PM_SHRIEKER, PM_STEAM_VORTEX, PM_STONE_GOLEM,
    PM_STRAW_GOLEM,
} from "./monsters.h.js";
import {
    EF_GREASE, EF_NONE, EF_VERBOSE, ERODE_BURN, ERODE_CORRODE, ERODE_ROT, ERODE_RUST, ER_NOTHING,
    OBJ_FREE, OBJ_INVENT, POTHIT_HERO_BASH, POTHIT_HERO_THROW, struct_obj,
} from "./obj.h.js";
import {
    ONAME, ammo_and_launcher, bimanual, carried, greatest_erosion, is_ammo, is_axe, is_blade,
    is_blunt_weapon, is_flimsy, is_launcher, is_missile, is_plural, is_poisonable, is_pole,
    is_shield, is_weptool, is_wet_towel, stale_egg, stone_missile, u_wield_art,
} from "./obj.h.macros.js";
import { IRON, METAL, MON_EXPLODE, NO_MATERIAL, PAPER, SILVER, VEGGY } from "./objclass.h.js";
import {
    ACID_VENOM, AMULET_OF_LIFE_SAVING, BLINDING_VENOM, BOOMERANG, BOULDER, CLOVE_OF_GARLIC, CORPSE,
    CREAM_PIE, DUNCE_CAP, EGG, ELVEN_ARROW, ELVEN_BOW, EXPENSIVE_CAMERA, GAUNTLETS_OF_POWER,
    HEAVY_IRON_BALL, IRON_CHAIN, IRON_SHOES, KATANA, LOADSTONE, LOW_BOOTS, MIRROR, OILSKIN_CLOAK,
    ROCK, STRANGE_OBJECT, WAN_LIGHT, YA, YUMI,
} from "./objects.h.js";
import { NATTK, struct_attack } from "./permonst.h.js";
import {
    LEFT_SIDE, RIGHT_SIDE, SLIMED, TIMEOUT, W_AMUL, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS,
    W_ARMU, W_RINGL, W_RINGR, W_SADDLE, W_WEP,
} from "./prop.h.js";
import { POOL } from "./rm.h.js";
import { IS_DOOR, IS_OBSTRUCTED, levl, m_at } from "./rm.h.macros.js";
import {
    P_BARE_HANDED_COMBAT, P_BASIC, P_ISRESTRICTED, P_KNIFE, P_LANCE, P_NONE, P_SKILLED,
    P_TWO_WEAPON_COMBAT, P_UNSKILLED, P_WHIP,
} from "./skills.h.js";
import { P_SKILL, martial_bonus } from "./skills.h.macros.js";
import { SYSOPT_SEDUCE } from "./sys.h.macros.js";
import { cansee } from "./vision.h.macros.js";
import { display_nhwindow, nh_delay_output } from "./winprocs.h.macros.js";
import { SICK_ALL, struct__hitmon_data } from "./you.h.js";
import { Luck, Race_if, Role_if, Upolyd, m_next2u, mhe, mhis } from "./you.h.macros.js";
import {
    Acid_resistance, Amphibious, Antimagic, Blind, Blind_telepat, BlindedTimeout, Breathless,
    Cold_resistance, Confusion, Deaf, Detect_monsters, Drain_resistance, Fire_resistance, Flying,
    Free_action, Fumbling, HConfusion, HFast, HStun, Half_physical_damage, Hallucination,
    Hate_silver, Invisible, Levitation, Protection_from_shape_changers, Punished, See_invisible,
    Shock_resistance, Sick, Sick_resistance, Sleep_resistance, Slimed, Slow_digestion,
    Stone_resistance, Stoned, Stunned, Swimming, Teleport_control, Unchanging, Underwater,
} from "./youprop.h.macros.js";
import { char, int, long, ord, schar, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { global_ref } from "../rt/globals.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u } from "../rt/int64.js";
import {
    abs, assert, sprintf, strcat, strcmp, strcpy, strlen, strncat, strncmp,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { array_of, elt, ptr_to, ref_of, struct_assign } from "../rt/struct.js";
import { snuff_lit } from "./apply.js";
import {
    artifact_hit, artifact_light, defends, find_artifact, is_art, permapoisoned, retouch_equipment,
    shade_glare,
} from "./artifact.js";
import { adjalign, adjattrib, change_luck, exercise, poisoned } from "./attrib.js";
import { night } from "./calendar.js";
import { isok, paranoid_query, xytodir } from "./cmd.js";
import { is_pool, is_waterwall } from "./dbridge.js";
import {
    disp, flags, ga, gb, gc, gi, gm, gn, go, gs, gt, gu, gv, gy, svc, svk, svl, svm, svr, u, xdir,
    ydir,
} from "./decl.js";
import {
    canseemon, glyph_at, is_safemon, map_invisible, map_location, newsym, sensemon, shieldeff,
    tmp_at, tp_sensemon, unmap_invisible,
} from "./display.js";
import { dropy, set_wounded_legs } from "./do.js";
import {
    Adjmonnam, Mgender, Monnam, Some_Monnam, a_monnam, hcolor, hliquid, l_monnam, mon_nam,
    mon_nam_too, pmname, some_mon_nam, x_monnam, y_monnam,
} from "./do_name.js";
import { some_armor } from "./do_wear.js";
import { abuse_dog, tamedog } from "./dog.js";
import { dog_nutrition } from "./dogmove.js";
import { breaktest, hurtle, mhurtle, release_camera_demon, will_hurtle } from "./dothrow.js";
import { defsyms } from "./drawing.js";
import {
    Finish_digestion, eat_brains, eating_conducts, is_fainted, morehungry, newuhs,
} from "./eat.js";
import { delayed_killer, done, done_in_by, panic } from "./end.js";
import { u_wipe_engr } from "./engrave.js";
import { losexp } from "./exper.js";
import { adtyp_to_expltype, explode } from "./explode.js";
import { glyph_to_cmap } from "./glyphs.js";
import {
    check_capacity, doorless_door, end_running, in_rooms, inv_cnt, near_capacity, nomul,
    overexertion, test_move,
} from "./hack.js";
import {
    dist2, eos, highc, ing_suffix, s_suffix, sgn, strNsubst, strstri, upstart,
} from "./hacklib.js";
import {
    addinv, carrying, freeinv, hold_another_object, merge_choice, update_inventory, useup, useupall,
} from "./invent.js";
import { clone_mon, grow_up, makemon } from "./makemon.js";
import { touch_of_death } from "./mcastu.js";
import {
    attk_protection, engulf_target, failed_grab, mon_poly, paralyze_monst, rustm, sleep_monst,
    slept_monst, xdrainenergym,
} from "./mhitm.js";
import {
    cloneu, could_seduce, diseasemu, doseduce, getmattk, hitmsg, magic_negation, mdamageu,
    mpoisons_subj, mtrapped_in_pit, u_slip_free, u_slow_down,
} from "./mhitu.js";
import { ndemon } from "./minion.js";
import {
    add_to_minv, dealloc_obj, mksobj, obj_extract_self, place_object, set_corpsenm, splitobj,
    weight,
} from "./mkobj.js";
import {
    angry_guards, corpse_chance, golemeffects, healmon, killed, mlifesaver, mon_give_prop,
    mon_to_stone, mondied, mongone, monkilled, monnear, monstone, newcham, seemimic, set_ustuck,
    setmangry, unstuck, wake_nearto, wakeup, xkilled,
} from "./mon.js";
import {
    attacktype, can_be_strangled, can_blnd, defended, dmgtype, gender, locomotion,
    mon_hates_blessings, mon_hates_light, mon_hates_silver, monstseesu, monstunseesu, noattacks,
    on_fire, poly_when_stoned, resists_blnd, resists_blnd_by_arti, resists_drli, stagger, sticks,
} from "./mondata.js";
import { m_move, monflee, set_apparxy } from "./monmove.js";
import { mons } from "./monst.js";
import { m_carrying, m_useup, m_useupall } from "./mthrowu.js";
import { munslime, munstone, ureflects } from "./muse.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    An, The, Yname2, Yobjnam2, an, bare_artifactname, cloak_simple_name, corpse_xname, cxname,
    doname, helm_simple_name, makeplural, mshot_xname, obj_is_pname, otense, simpleonames, singular,
    the, vtense, xname, yname, ysimple_name,
} from "./objnam.js";
import { mhidden_description, object_from_map } from "./pager.js";
import {
    You, You_feel, You_hear, Your, impossible, livelog_printf, pline, pline_The, pline_mon,
    urgent_pline, verbalize,
} from "./pline.js";
import { body_part, mbodypart, polymon, rehumanize, ugolemeffects, uunstick } from "./polyself.js";
import {
    make_blinded, make_confused, make_sick, make_slimed, make_stoned, make_stunned, potionhit,
    split_mon,
} from "./potion.js";
import { ghod_hitsu } from "./priest.js";
import { d, rn2, rn2_on_display_rng, rnd, rnl } from "./rnd.js";
import { dopay, obfree, tended_shop } from "./shk.js";
import { attrcurse } from "./sit.js";
import { losespells } from "./spell.js";
import { findgold, mpickobj, steal, stealamulet, stealgold } from "./steal.js";
import { dismount_steed } from "./steed.js";
import { rloc, tele, tele_restrict, u_teleport_mon } from "./teleport.js";
import { burn_away_slime, fall_asleep, obj_stop_timers } from "./timeout.js";
import {
    acid_damage, drain_en, erode_obj, ignite_items, instapetrify, minstapetrify, mintrap,
    mselftouch, unconscious,
} from "./trap.js";
import {
    abon, dbon, dmgval, drain_weapon_skill, dry_a_towel, hitval, possibly_unwield, setmnotwielded,
    silver_sears, special_dmgval, use_skill, uwep_skill_type, weapon_dam_bonus, weapon_hit_bonus,
    weapon_type,
} from "./weapon.js";
import { set_ulycn, were_change } from "./were.js";
import {
    can_twoweapon, drop_uswapwep, set_twoweap, setuwep, untwoweapon, uwepgone,
} from "./wield.js";
import { cutworm } from "./worm.js";
import { extract_from_minvent, find_mac, mon_adjust_speed, which_armor } from "./worn.js";
import { destroy_items, drain_item, exclam, hit, obj_resists, resist } from "./zap.js";
