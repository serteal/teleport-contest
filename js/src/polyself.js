/* NetHack 5.0	polyself.c	$NHDT-Date: 1772101811 2026/02/26 02:30:11 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.227 $ */
/*      Copyright (C) 1987, 1988, 1989 by Ken Arromdee */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Polymorph self routine.
 *
 * Note:  the light source handling code assumes that gy.youmonst.m_id
 * always remains 1 and gy.youmonst.mx will always remain 0 when it handles
 * the case of the player polymorphed into a light-emitting monster.
 *
 * Transformation sequences:
 *              /-> polymon                 poly into monster form
 *    polyself =
 *              \-> newman -> polyman       fail to poly, get human form
 *
 *    rehumanize -> polyman                 return to original form
 *
 *    polymon (called directly)             usually golem petrification
 */

const no_longer_petrify_resistant = init_string(static_array("no_longer_petrify_resistant", char, sizeof_string("No longer petrify-resistant, you")), _("No longer petrify-resistant, you"), true);

/* update the gy.youmonst.data structure pointer and intrinsics */
export function set_uasmon() { /* void */
    let mdat = mons[u.umonnum];
    let was_vampshifter = valid_vampshiftform(gy.youmonst.cham, u.umonnum);

    set_mon_data(gy.youmonst, mdat);
    gy.youmonst.m_id = 1;

    if (Protection_from_shape_changers())
        gy.youmonst.cham = NON_PM;
    else if (is_vampire(gy.youmonst.data))
        gy.youmonst.cham = gy.youmonst.mnum;
    /* assume hero-as-chameleon/doppelganger/sandestin doesn't change shape */
    else if (!was_vampshifter)
        gy.youmonst.cham = NON_PM;
    u.mcham = gy.youmonst.cham; /* for save/restore since youmonst isn't */

    do { if (resist_from_form(MR_FIRE)) u.uprops[FIRE_RES].intrinsic = or64(u.uprops[FIRE_RES].intrinsic, FROMFORM); else u.uprops[FIRE_RES].intrinsic = and64(u.uprops[FIRE_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form( MR_COLD)) u.uprops[COLD_RES].intrinsic = or64(u.uprops[COLD_RES].intrinsic, FROMFORM); else u.uprops[COLD_RES].intrinsic = and64(u.uprops[COLD_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form(MR_SLEEP)) u.uprops[SLEEP_RES].intrinsic = or64(u.uprops[SLEEP_RES].intrinsic, FROMFORM); else u.uprops[SLEEP_RES].intrinsic = and64(u.uprops[SLEEP_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form(MR_DISINT)) u.uprops[DISINT_RES].intrinsic = or64(u.uprops[DISINT_RES].intrinsic, FROMFORM); else u.uprops[DISINT_RES].intrinsic = and64(u.uprops[DISINT_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form(MR_ELEC)) u.uprops[SHOCK_RES].intrinsic = or64(u.uprops[SHOCK_RES].intrinsic, FROMFORM); else u.uprops[SHOCK_RES].intrinsic = and64(u.uprops[SHOCK_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form(MR_POISON)) u.uprops[POISON_RES].intrinsic = or64(u.uprops[POISON_RES].intrinsic, FROMFORM); else u.uprops[POISON_RES].intrinsic = and64(u.uprops[POISON_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form(MR_ACID)) u.uprops[ACID_RES].intrinsic = or64(u.uprops[ACID_RES].intrinsic, FROMFORM); else u.uprops[ACID_RES].intrinsic = and64(u.uprops[ACID_RES].intrinsic, ~FROMFORM); } while (0);
    do { if (resist_from_form(MR_STONE)) u.uprops[STONE_RES].intrinsic = or64(u.uprops[STONE_RES].intrinsic, FROMFORM); else u.uprops[STONE_RES].intrinsic = and64(u.uprops[STONE_RES].intrinsic, ~FROMFORM); } while (0);
    {
        /* resists_drli() takes wielded weapon into account; suppress it */
        let save_uwep = uwep;

        uwep = null;
        do { if (resists_drli(gy.youmonst)) u.uprops[DRAIN_RES].intrinsic = or64(u.uprops[DRAIN_RES].intrinsic, FROMFORM); else u.uprops[DRAIN_RES].intrinsic = and64(u.uprops[DRAIN_RES].intrinsic, ~FROMFORM); } while (0);
        uwep = save_uwep;
    }
    /* resists_magm() takes wielded, worn, and carried equipment into
       into account; cheat and duplicate its monster-specific part */
    do { if ((dmgtype(mdat, AD_MAGM)
                        || mdat == mons[PM_BABY_GRAY_DRAGON]
                        || dmgtype(mdat, AD_RBRE))) u.uprops[ANTIMAGIC].intrinsic = or64(u.uprops[ANTIMAGIC].intrinsic, FROMFORM); else u.uprops[ANTIMAGIC].intrinsic = and64(u.uprops[ANTIMAGIC].intrinsic, ~FROMFORM); } while (0);
    do { if ((mdat.mlet == S_FUNGUS || mdat == mons[PM_GHOUL])) u.uprops[SICK_RES].intrinsic = or64(u.uprops[SICK_RES].intrinsic, FROMFORM); else u.uprops[SICK_RES].intrinsic = and64(u.uprops[SICK_RES].intrinsic, ~FROMFORM); } while (0);

    do { if ((mdat == mons[PM_STALKER] || is_bat(mdat))) u.uprops[STUNNED].intrinsic = or64(u.uprops[STUNNED].intrinsic, FROMFORM); else u.uprops[STUNNED].intrinsic = and64(u.uprops[STUNNED].intrinsic, ~FROMFORM); } while (0);
    PROPSET(HALLUC_RES, dmgtype(mdat, AD_HALU));
    do { if (perceives(mdat)) u.uprops[SEE_INVIS].intrinsic = or64(u.uprops[SEE_INVIS].intrinsic, FROMFORM); else u.uprops[SEE_INVIS].intrinsic = and64(u.uprops[SEE_INVIS].intrinsic, ~FROMFORM); } while (0);
    do { if (telepathic(mdat)) u.uprops[TELEPAT].intrinsic = or64(u.uprops[TELEPAT].intrinsic, FROMFORM); else u.uprops[TELEPAT].intrinsic = and64(u.uprops[TELEPAT].intrinsic, ~FROMFORM); } while (0);
    /* note that Infravision uses mons[race] rather than usual mons[role] */
    do { if (infravision(Upolyd() ? mdat : mons[gu.urace.mnum])) u.uprops[INFRAVISION].intrinsic = or64(u.uprops[INFRAVISION].intrinsic, FROMFORM); else u.uprops[INFRAVISION].intrinsic = and64(u.uprops[INFRAVISION].intrinsic, ~FROMFORM); } while (0);
    do { if (pm_invisible(mdat)) u.uprops[INVIS].intrinsic = or64(u.uprops[INVIS].intrinsic, FROMFORM); else u.uprops[INVIS].intrinsic = and64(u.uprops[INVIS].intrinsic, ~FROMFORM); } while (0);
    do { if (can_teleport(mdat)) u.uprops[TELEPORT].intrinsic = or64(u.uprops[TELEPORT].intrinsic, FROMFORM); else u.uprops[TELEPORT].intrinsic = and64(u.uprops[TELEPORT].intrinsic, ~FROMFORM); } while (0);
    do { if (control_teleport(mdat)) u.uprops[TELEPORT_CONTROL].intrinsic = or64(u.uprops[TELEPORT_CONTROL].intrinsic, FROMFORM); else u.uprops[TELEPORT_CONTROL].intrinsic = and64(u.uprops[TELEPORT_CONTROL].intrinsic, ~FROMFORM); } while (0);
    do { if (is_floater(mdat)) u.uprops[LEVITATION].intrinsic = or64(u.uprops[LEVITATION].intrinsic, FROMFORM); else u.uprops[LEVITATION].intrinsic = and64(u.uprops[LEVITATION].intrinsic, ~FROMFORM); } while (0);
    /* floating eye is the only 'floater'; it is also flagged as a 'flyer';
       suppress flying for it so that enlightenment doesn't confusingly
       show latent flight capability always blocked by levitation */
    do { if ((is_flyer(mdat) && !is_floater(mdat))) u.uprops[FLYING].intrinsic = or64(u.uprops[FLYING].intrinsic, FROMFORM); else u.uprops[FLYING].intrinsic = and64(u.uprops[FLYING].intrinsic, ~FROMFORM); } while (0);
    do { if (is_swimmer(mdat)) u.uprops[SWIMMING].intrinsic = or64(u.uprops[SWIMMING].intrinsic, FROMFORM); else u.uprops[SWIMMING].intrinsic = and64(u.uprops[SWIMMING].intrinsic, ~FROMFORM); } while (0);
    /* [don't touch MAGICAL_BREATHING here; both Amphibious and Breathless
       key off of it but include different monster forms...] */
    do { if (passes_walls(mdat)) u.uprops[PASSES_WALLS].intrinsic = or64(u.uprops[PASSES_WALLS].intrinsic, FROMFORM); else u.uprops[PASSES_WALLS].intrinsic = and64(u.uprops[PASSES_WALLS].intrinsic, ~FROMFORM); } while (0);
    do { if (regenerates(mdat)) u.uprops[REGENERATION].intrinsic = or64(u.uprops[REGENERATION].intrinsic, FROMFORM); else u.uprops[REGENERATION].intrinsic = and64(u.uprops[REGENERATION].intrinsic, ~FROMFORM); } while (0);
    do { if ((mdat == mons[PM_SILVER_DRAGON])) u.uprops[REFLECTING].intrinsic = or64(u.uprops[REFLECTING].intrinsic, FROMFORM); else u.uprops[REFLECTING].intrinsic = and64(u.uprops[REFLECTING].intrinsic, ~FROMFORM); } while (0);
    do { if (!haseyes(mdat)) u.uprops[BLINDED].intrinsic = or64(u.uprops[BLINDED].intrinsic, FROMFORM); else u.uprops[BLINDED].intrinsic = and64(u.uprops[BLINDED].intrinsic, ~FROMFORM); } while (0);
    PROPSET(BLND_RES, (dmgtype_fromattack(mdat, AD_BLND, AT_EXPL)
                       || dmgtype_fromattack(mdat, AD_BLND, AT_GAZE) ? 1 : 0));

    /* whether the player is flying/floating depends on their steed,
       which won't be known during the restore process: but BFlying
       and BStealth should be set correctly already in that case, so
       there's nothing to do */
    if (!program_state.restoring)
        float_vs_flight(); /* maybe toggle (BFlying & I_SPECIAL) */
    polysense();

    if (VIA_WINDOWPORT())
        status_initialize(TRUE);

    /* we can reset this now, having just done what it is meant to trigger */
    gw.were_changes = 0;
}
export function resist_from_form(MRtyp) { return +((gy.youmonst.data.mresists & MRtyp) != 0); }
export function PROPSET(PropIndx, ON) { do { if (ON) u.uprops[PropIndx].intrinsic = or64(u.uprops[PropIndx].intrinsic, FROMFORM); else u.uprops[PropIndx].intrinsic = and64(u.uprops[PropIndx].intrinsic, ~FROMFORM); } while (0) }

/* Levitation overrides Flying; set or clear BFlying|I_SPECIAL */
export function float_vs_flight() { /* void */
    let stuck_in_floor = (u.utrap && u.utraptype != TT_PIT ? 1 : 0);

    /* floating overrides flight; so does being trapped in the floor */
    if ((HLevitation() || ELevitation())
        || ((HFlying() || EFlying()) && stuck_in_floor))
        u.uprops[FLYING].blocked = or64(u.uprops[FLYING].blocked, I_SPECIAL);
    else
        u.uprops[FLYING].blocked = and64(u.uprops[FLYING].blocked, ~I_SPECIAL);
    /* being trapped on the ground (bear trap, web, molten lava survived
       with fire resistance, former lava solidified via cold, tethered
       to a buried iron ball) overrides floating--the floor is reachable */
    if ((HLevitation() || ELevitation()) && stuck_in_floor)
        u.uprops[LEVITATION].blocked = or64(u.uprops[LEVITATION].blocked, I_SPECIAL);
    else
        u.uprops[LEVITATION].blocked = and64(u.uprops[LEVITATION].blocked, ~I_SPECIAL);

    /* riding blocks stealth unless hero+steed fly, so a change in flying
       might cause a change in stealth */
    steed_vs_stealth();

    disp.botl = TRUE;
}

/* riding blocks stealth unless hero+steed fly */
export function steed_vs_stealth() { /* void */
    if (u.usteed && !Flying() && !Levitation())
        u.uprops[STEALTH].blocked = or64(u.uprops[STEALTH].blocked, FROMOUTSIDE);
    else
        u.uprops[STEALTH].blocked = and64(u.uprops[STEALTH].blocked, ~FROMOUTSIDE);
}

/* for changing into form that's immune to strangulation */
function check_strangling(on) { /* void */
    /* on -- maybe resume strangling */
    if (on) {
        let was_strangled = +(Strangled() != 0);

        /* when Strangled is already set, polymorphing from one
           vulnerable form into another causes the counter to be reset */
        if (uamul && uamul.otyp == AMULET_OF_STRANGULATION
            && can_be_strangled(gy.youmonst)) {
            u.uprops[STRANGLED].intrinsic = 6;
            disp.botl = TRUE;
            Your(_("%s %s your %s!"), simpleonames(uamul),
                 was_strangled ? _("still constricts") : _("begins constricting"),
                 body_part(NECK)); /* "throat" */
            makeknown(AMULET_OF_STRANGULATION);
        }

    /* off -- maybe block strangling */
    } else {
        if (Strangled() && !can_be_strangled(gy.youmonst)) {
            u.uprops[STRANGLED].intrinsic = 0;
            disp.botl = TRUE;
            You(_("are no longer being strangled."));
        }
    }
}

/* make a (new) human out of the player */
function polyman(fmt, arg) { /* void */
    let sticking = (sticks(gy.youmonst.data) && u.ustuck && !u.uswallow ? 1 : 0),
            was_mimicking = +(U_AP_TYPE() != M_AP_NOTHING);
    let was_blind = +!!Blind(),
            had_see_invis = +!!See_invisible();

    if (Upolyd()) {
        struct_assign(u.acurr, u.macurr); /* restore old attribs */
        struct_assign(u.amax, u.mamax);
        u.umonnum = u.umonster;
        flags.female = u.mfemale;
    }
    set_uasmon();

    u.mh = u.mhmax = 0;
    u.mtimedone = 0;
    skinback(FALSE);
    u.uundetected = 0;

    if (sticking)
        uunstick();
    find_ac();
    if (was_mimicking) {
        if (gm.multi < 0)
            unmul(_(""));
        gy.youmonst.m_ap_type = M_AP_NOTHING;
        gy.youmonst.mappearance = 0;
    }

    newsym(u.ux, u.uy);

    urgent_pline(fmt, arg);
    /* check whether player foolishly genocided self while poly'd */
    if (ugenocided()) {
        /* intervening activity might have clobbered genocide info */
        let kptr = find_delayed_killer(POLYMORPH);

        if (kptr != null && chars[kptr.name + 0]) {
            svk.killer.format = kptr.format;
            strcpy(svk.killer.name, kptr.name);
        } else {
            svk.killer.format = KILLED_BY;
            strcpy(svk.killer.name, _("self-genocide"));
        }
        dealloc_killer(kptr);
        done(GENOCIDED);
    }

    if (+!!See_invisible() ^ had_see_invis)
        set_mimic_blocking(); /* See_invisible just toggled */

    if (u.twoweap && !could_twoweap(gy.youmonst.data))
        untwoweapon();

    if (u.utrap && u.utraptype == TT_PIT) {
        set_utrap(unsigned(rn1(6, 2)), TT_PIT); /* time to escape resets */
    }
    if (was_blind && !Blind()) { /* reverting from eyeless */
        set_itimeout(ref_of(u.uprops[BLINDED], "intrinsic"), 1);
        make_blinded(0, TRUE); /* remove blindness */
    }
    check_strangling(TRUE);

    if (!Levitation() && !u.ustuck && is_pool_or_lava(u.ux, u.uy))
        spoteffects(TRUE);

    see_monsters();
}

export function change_sex() { /* void */
    /* Some monsters are always of one sex and their sex can't be changed;
     * Succubi/incubi can change, but are handled below.
     *
     * !Upolyd check necessary because is_male() and is_female()
     * may be true for certain roles
     */
    if (!Upolyd()
        || (!is_male(gy.youmonst.data) && !is_female(gy.youmonst.data)
            && !is_neuter(gy.youmonst.data)))
        flags.female = +!flags.female;
    if (Upolyd()) /* poly'd: also change saved sex */
        u.mfemale = +!u.mfemale;
    max_rank_sz(); /* [this appears to be superfluous] */
    if ((Upolyd() ? u.mfemale : flags.female) && gu.urole.name.f)
        strcpy(svp.pl_character, gu.urole.name.f);
    else
        strcpy(svp.pl_character, gu.urole.name.m);
    if (!Upolyd()) {
        u.umonnum = u.umonster;
    } else if (u.umonnum == PM_AMOROUS_DEMON) {
        flags.female = +!flags.female;

        set_uasmon();
    }
}

/* log a message if non-poly'd hero's gender has changed */
export function livelog_newform(viapoly, oldgend, newgend) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let oldrole, oldrank, newrole, newrank;

    /*
     * TODO?
     *  Give other logging feedback here instead of in newman().
     */

    if (!Upolyd()) {
        if (newgend != oldgend) {
            oldrole = (oldgend && gu.urole.name.f) ? gu.urole.name.f
                                                  : gu.urole.name.m;
            newrole = (newgend && gu.urole.name.f) ? gu.urole.name.f
                                                  : gu.urole.name.m;
            oldrank = rank_of(u.ulevel, Role_switch(), oldgend);
            newrank = rank_of(u.ulevel, Role_switch(), newgend);
            sprintf(buf, _("%.10s %.30s"), genders[flags.female].adj, newrank);
            livelog_printf(LL_MINORAC, _("%s into %s"),
                           viapoly ? _("polymorphed") : _("transformed"),
                           an(strcmp(newrole, oldrole) ? newrole
                              : strcmp(newrank, oldrank) ? newrank
                                : buf));
        }
    }
    } finally { stack_pop($frame); }
}

function newman() { /* void */
    let $goto = null;
    var newform;
    var i, oldlvl, newlvl, oldgend, newgend, hpmax, enmax;

    oldlvl = u.ulevel;
    newlvl = oldlvl + rn1(5, -2);     /* new = old + {-2,-1,0,+1,+2} */
    $goto_dead: for (;;) { switch ($goto) { default: if (newlvl > 127 || newlvl < 1) { /* level went below 0? */
        { $goto = "dead"; continue $goto_dead; } /* old level is still intact (in case of lifesaving) */
    }
    if (newlvl > MAXULEV)
        newlvl = MAXULEV;
    /* If your level goes down, your peak level goes down by
       the same amount so that you can't simply use blessed
       full healing to undo the decrease.  But if your level
       goes up, your peak level does *not* undergo the same
       adjustment; you might end up losing out on the chance
       to regain some levels previously lost to other causes. */
    if (newlvl < oldlvl)
        u.ulevelmax -= (oldlvl - newlvl);
    if (u.ulevelmax < newlvl)
        u.ulevelmax = newlvl;
    u.ulevel = newlvl;

    oldgend = poly_gender();
    if (gs.sex_change_ok && !rn2(10))
        change_sex();

    adjabil(oldlvl, u.ulevel);

    /* random experience points for the new experience level */
    u.uexp = rndexp(FALSE);

    /* set up new attribute points (particularly Con) */
    redist_attr();

    /*
     * New hit points:
     *  remove "level gain"-based HP from any extra HP accumulated
     *  (the "extra" might actually be negative);
     *  modify the extra, retaining {80%, 90%, 100%, or 110%};
     *  add in newly generated set of level-gain HP.
     *
     * (This used to calculate new HP in direct proportion to old HP,
     * but that was subject to abuse:  accumulate a large amount of
     * extra HP, drain level down to 1, then polyself to level 2 or 3
     * [lifesaving capability needed to handle level 0 and -1 cases]
     * and the extra got multiplied by 2 or 3.  Repeat the level
     * drain and polyself steps until out of lifesaving capability.)
     */
    hpmax = u.uhpmax;
    for (i = 0; i < oldlvl; i++)
        hpmax -= (u.uhpinc[i]);
    /* hpmax * rn1(4,8) / 10; 0.95*hpmax on average */
    hpmax = rounddiv(hpmax * rn1(4, 8), 10);
    for (i = 0; (u.ulevel = i) < newlvl; i++)
        hpmax += newhp();
    if (hpmax < u.ulevel)
        hpmax = u.ulevel; /* min of 1 HP per level */
    /* retain same proportion for current HP; u.uhp * hpmax / u.uhpmax */
    u.uhp = rounddiv(u.uhp * hpmax, u.uhpmax);
    setuhpmax(hpmax, TRUE); /* might reduce u.uhp */
    /*
     * Do the same for spell power.
     */
    enmax = u.uenmax;
    for (i = 0; i < oldlvl; i++)
        enmax -= (u.ueninc[i]);
    enmax = rounddiv(enmax * rn1(4, 8), 10);
    for (i = 0; (u.ulevel = i) < newlvl; i++)
        enmax += newpw();
    if (enmax < u.ulevel)
        enmax = u.ulevel;
    u.uen = rounddiv(u.uen * enmax,
                     ((u.uenmax < 1) ? 1 : u.uenmax));
    u.uenmax = enmax;
    /* [should alignment record be tweaked too?] */

    u.uhunger = rn1(500, 500);
    if (Sick())
        make_sick(0, 0, FALSE, SICK_ALL);
    if (Stoned())
        make_stoned(0, 0, 0, 0);
    case "dead": if ($goto || (u.uhp <= 0)) {
        if (!$goto && (Polymorph_control())) { /* even when Stunned || Unaware */
            if (u.uhp <= 0)
                u.uhp = 1;
        } else {
 $goto = null;      /* we come directly here if experience level went to 0 or less */
            urgent_pline(
                     _("Your new form doesn't seem healthy enough to survive."));
            svk.killer.format = KILLED_BY_AN;
            strcpy(svk.killer.name, _("unsuccessful polymorph"));
            done(DIED);
            /* must have been life-saved to get here */
            newuhs(FALSE);
            encumber_msg(); /* used to be done by redist_attr() */
            return; /* lifesaved */
        }
    } } break; }
    newuhs(FALSE);
    /* use saved gender we're about to revert to, not current */
    newform = ((Upolyd() ? u.mfemale : flags.female) && gu.urace.individual.f)
                ? gu.urace.individual.f
                : gu.urace.individual.m
                   ? gu.urace.individual.m
                   : gu.urace.noun;
    polyman(_("You feel like a new %s!"), newform);

    newgend = poly_gender();
    /* note: newman() bypasses achievements for new ranks attained and
       doesn't log "new <form>" when that isn't accompanied by level change */
    if (newlvl != oldlvl)
        livelog_printf(LL_MINORAC, _("became experience level %d as a new %s"),
                       newlvl, newform);
    else
        livelog_newform(TRUE, oldgend, newgend);

    if (Slimed()) {
        Your(_("body transforms, but there is still slime on you."));
        make_slimed(10, 0);
    }

    disp.botl = TRUE;
    see_monsters();
    encumber_msg();

    retouch_equipment(2);
    if (!uarmg)
        selftouch(no_longer_petrify_resistant);
}

export function polyself(psflags) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var buf = stack_array(char, BUFSZ), mntmp = stack_var(int), gvariant = stack_var(int);

    var old_light, new_light, class_, tryct; gvariant[0] = NEUTRAL;
    var forcecontrol = +((psflags & POLY_CONTROLLED) != 0),
            low_control = +((psflags & POLY_LOW_CTRL) != 0),
            monsterpoly = +((psflags & POLY_MONSTER) != 0),
            formrevert = +((psflags & POLY_REVERT) != 0),
            draconian = (uarm && Is_dragon_armor(uarm) ? 1 : 0),
            iswere = ismnum(u.ulycn),
            isvamp = +(is_vampire(gy.youmonst.data)
                      || is_vampshifter(gy.youmonst)),
            controllable_poly = (Polymorph_control() && !(Stunned() || Unaware()) ? 1 : 0);

    if (Unchanging()) {
        You(_("fail to transform!"));
        return;
    }
    /* being Stunned|Unaware doesn't negate this aspect of Poly_control */
    if (!Polymorph_control() && !forcecontrol && !draconian && !iswere
        && !isvamp) {
        if (rn2(20) > ACURR(A_CON)) {
            You1(shudder_for_moment());
            losehp(rnd(30), _("system shock"), KILLED_BY_AN);
            exercise(A_CON, FALSE);
            return;
        }
    }
    old_light = emits_light(gy.youmonst.data);
    mntmp[0] = NON_PM;

    if (formrevert) {
        mntmp[0] = gy.youmonst.cham;
        monsterpoly = TRUE;
        controllable_poly = FALSE;
    }

    if (forcecontrol && low_control
        && (draconian || monsterpoly || isvamp || iswere))
        forcecontrol = FALSE;

    $goto_do_merge: for (;;) { switch ($goto) { default: if (monsterpoly && isvamp)
        { $goto = "do_vampyr"; continue $goto_do_merge; };

    case "do_merge": case "do_shift": case "do_vampyr": if (!$goto && (controllable_poly || forcecontrol)) {
        chars[buf + 0] = ord('\0');
        tryct = 5;

        $out_by_class: do {
            mntmp[0] = NON_PM;
            getlin(_("Become what kind of monster? [type the name]"), buf);
            mungspaces(buf);
            if (chars[buf] == ord('\x1b')) {
                /* user is cancelling controlled poly */
                if (forcecontrol) { /* wizard mode #polyself */
                    pline1(Never_mind());
                    return;
                }
                strcpy(buf, _("*")); /* resort to random */
            }
            if (!strcmp(buf, _("*")) || !strcmp(buf, _("random"))) {
                /* explicitly requesting random result */
                tryct = 0; /* will skip thats_enough_tries */
                continue;  /* end do-while(--tryct > 0) loop */
            }
            class_ = 0;
            mntmp[0] = name_to_mon(buf, gvariant);
            $goto_by_class: for (;;) { switch ($goto) { default: case "by_class": if ($goto || (mntmp[0] < LOW_PM)) {
 $goto = null;
                class_ = name_to_monclass(buf, mntmp);
                if (class_ && mntmp[0] == NON_PM)
                    mntmp[0] = (draconian && class_ == S_DRAGON)
                            ? armor_to_dragon(uarm.otyp)
                            : mkclass_poly(class_);

            /* placeholder monsters are for corpses and all flagged
               M2_NOPOLY but they are reasonable polymorph targets;
               pick a suitable substitute (which might be geno'd) */
            } else if (is_placeholder(mons[mntmp[0]])
                       /* when your own race, fall to !polyok() case */
                       && !your_race(mons[mntmp[0]])
                       /* same for generic human, even if hero isn't human */
                       && mntmp[0] != PM_HUMAN) {
                /* far less general than mkclass() */
                if (mntmp[0] == PM_ORC)
                    mntmp[0] = rn2(3) ? PM_HILL_ORC : PM_MORDOR_ORC;
                else if (mntmp[0] == PM_ELF)
                    mntmp[0] = rn2(3) ? PM_GREEN_ELF : PM_GREY_ELF;
                else if (mntmp[0] == PM_GIANT)
                    mntmp[0] = rn2(3) ? PM_STONE_GIANT : PM_HILL_GIANT;
                /* note: PM_DWARF and PM_GNOME are ordinary monsters and
                   no longer flagged no-poly so have no need for placeholder
                   handling; PM_HUMAN is a placeholder without a suitable
                   substitute so gets handled differently below */
            }

            if (mntmp[0] < LOW_PM) {
                if (!class_)
                    pline(_("I've never heard of such monsters."));
                else
                    You_cant(_("polymorph into any of those."));
            } else if (wizard() && Upolyd()
                       && (mntmp[0] == u.umonster
                           /* "priest" and "priestess" match the monster
                              rather than the role; override that unless
                              the text explicitly contains "aligned" */
                           || (u.umonster == PM_CLERIC
                               && mntmp[0] == PM_ALIGNED_CLERIC
                               && !strstri(buf, _("aligned"))))) {
                /* in wizard mode, picking own role while poly'd reverts to
                   normal without newman()'s chance of level or sex change */
                rehumanize();
                old_light = 0; /* rehumanize() extinguishes u-as-mon light */
                { $goto = "made_change"; continue $goto_do_merge; }
            } else if (iswere && (were_beastie(mntmp[0]) == u.ulycn
                                  || mntmp[0] == counter_were(u.ulycn)
                                  || (Upolyd() && mntmp[0] == PM_HUMAN))) {
                { $goto = "do_shift"; continue $goto_do_merge; }
            } else if (!polyok(mons[mntmp[0]])
                       /* Note:  humans are illegal as monsters, but an
                          illegal monster forces newman(), which is what
                          we want if they specified a human.... (unless
                          they specified a unique monster) */
                       && !(mntmp[0] == PM_HUMAN
                            || (your_race(mons[mntmp[0]])
                                && (mons[mntmp[0]].geno & G_UNIQ) == 0)
                            || mntmp[0] == gu.urole.mnum)) {
                var pm_name;

                /* mkclass_poly() can pick a !polyok()
                   candidate; if so, usually try again */
                if (class_) {
                    if (rn2(3) || --tryct > 0)
                        { $goto = "by_class"; continue $goto_by_class; };
                    /* no retries left; put one back on counter
                       so that end of loop decrement will yield
                       0 and trigger thats_enough_tries message */
                    ++tryct;
                }
                pm_name = pmname(mons[mntmp[0]], flags.female ? FEMALE : MALE);
                if (the_unique_pm(mons[mntmp[0]]))
                    pm_name = the(pm_name);
                else if (!type_is_pname(mons[mntmp[0]]))
                    pm_name = an(pm_name);
                You_cant(_("polymorph into %s."), pm_name);
            } else
                break $out_by_class; } break; }
        } while (--tryct > 0);

        if (!tryct)
            pline1(thats_enough_tries());
        /* allow skin merging, even when polymorph is controlled */
        if (draconian && (tryct <= 0 || mntmp[0] == armor_to_dragon(uarm.otyp)))
            { $goto = "do_merge"; continue $goto_do_merge; };
        if (isvamp && (tryct <= 0 || mntmp[0] == PM_WOLF || mntmp[0] == PM_FOG_CLOUD
                       || is_bat(mons[mntmp[0]])))
            { $goto = "do_vampyr"; continue $goto_do_merge; };
    } else if ($goto || (draconian || iswere || isvamp)) {
        /* special changes that don't require polyok() */
        if ($goto ? $goto === "do_merge" : (draconian)) {
 $goto = null;
            mntmp[0] = armor_to_dragon(uarm.otyp);
            if (!(svm.mvitals[mntmp[0]].mvflags & G_GENOD)) {
                var was_lit = uarm.lamplit;
                var arm_light = artifact_light(uarm) ? arti_light_radius(uarm)
                                                     : 0;

                /* allow G_EXTINCT */
                if (Is_dragon_scales(uarm)) {
                    /* dragon scales remain intact as uskin */
                    You(_("merge with your scaly armor."));
                } else { /* dragon scale mail reverts to scales */
                    /* similar to noarmor(invent.c),
                       shorten to "<color> scale mail" */
                    strcpy(buf, simpleonames(uarm));
                    strsubst(buf, _(" dragon "), _(" "));
                    /* tricky phrasing; dragon scale mail is singular, dragon
                       scales are plural (note: we don't use "set of scales",
                       which usually overrides the distinction, here) */
                    Your(_("%s reverts to scales as you merge with them."), buf);
                    /* uarm->spe enchantment remains unchanged;
                       re-converting scales to mail poses risk
                       of evaporation due to over enchanting */
                    uarm.otyp += GRAY_DRAGON_SCALES - GRAY_DRAGON_SCALE_MAIL;
                    observe_object(uarm);
                    disp.botl = TRUE; /* AC is changing */
                }
                uskin = uarm;
                uarm = null;
                /* save/restore hack */
                uskin.owornmask = or64(uskin.owornmask, I_SPECIAL);
                if (was_lit)
                    maybe_adjust_light(uskin, arm_light);
                update_inventory();
            }
        } else if ($goto ? $goto === "do_shift" : (iswere)) {
 $goto = null;
            if (Upolyd() && were_beastie(mntmp[0]) != u.ulycn)
                mntmp[0] = PM_HUMAN; /* Illegal; force newman() */
            else
                mntmp[0] = u.ulycn;
        } else if ($goto || (isvamp)) {
 $goto = null;
            if (mntmp[0] < LOW_PM || (mons[mntmp[0]].geno & G_UNIQ)) {
                mntmp[0] = (gy.youmonst.data == mons[PM_VAMPIRE_LEADER]
                         && !rn2(10)) ? PM_WOLF
                                      : !rn2(4) ? PM_FOG_CLOUD
                                                : PM_VAMPIRE_BAT;
                if (ismnum(gy.youmonst.cham)
                    && !is_vampire(gy.youmonst.data) && !rn2(2))
                    mntmp[0] = gy.youmonst.cham;
            }
            if (controllable_poly) {
                sprintf(buf, _("Become %s?"), an(pmname(mons[mntmp[0]], gvariant[0])))
;
                if (y_n(buf) != ord('y'))
                    return;
            }
        }
        /* if polymon fails, "you feel" message has been given
           so don't follow up with another polymon or newman;
           sex_change_ok left disabled here */
        if (mntmp[0] == PM_HUMAN)
            newman(); /* werecritter */
        else
            polymon(mntmp[0]);
        { $goto = "made_change"; continue $goto_do_merge; } /* maybe not, but this is right anyway */
    }

    if (mntmp[0] < LOW_PM) {
        tryct = 200;
        do {
            /* randomly pick an "ordinary" monster */
            mntmp[0] = rn1(SPECIAL_PM - LOW_PM, LOW_PM);
            if (polyok(mons[mntmp[0]]) && !is_placeholder(mons[mntmp[0]]))
                break;
        } while (--tryct > 0);
    }

    /* The below polyok() fails either if everything is genocided, or if
     * we deliberately chose something illegal to force newman().
     */
    gs.sex_change_ok++;
    if (!polyok(mons[mntmp[0]]) || (!forcecontrol && !rn2(5))
        || your_race(mons[mntmp[0]])) {
        newman();
    } else {
        polymon(mntmp[0]);
    }
    gs.sex_change_ok--; /* reset */

 case "made_change": $goto = null;
    new_light = emits_light(gy.youmonst.data); } break; }
    if (old_light != new_light) {
        if (old_light)
            del_light_source(LS_MONSTER, monst_to_any(gy.youmonst));
        if (new_light == 1)
            ++new_light; /* otherwise it's undetectable */
        if (new_light)
            new_light_source(u.ux, u.uy, new_light, LS_MONSTER,
                             monst_to_any(gy.youmonst));
    }
    } finally { stack_pop($frame); }
}

/* (try to) make a mntmp monster out of the player; return 1 if successful */
export function polymon(mntmp) { /* int */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), ustuckNam = stack_array(char, BUFSZ);
    let sticking = (sticks(gy.youmonst.data) && u.ustuck && !u.uswallow ? 1 : 0),
            was_blind = +!!Blind(), dochange = FALSE, was_expelled = FALSE,
            was_hiding_under = (u.uundetected && hides_under(gy.youmonst.data) ? 1 : 0);
    let mlvl, newMaxStr;

    if (svm.mvitals[mntmp].mvflags & G_GENOD) { /* allow G_EXTINCT */
        You_feel(_("rather %s-ish."),
                 pmname(mons[mntmp], flags.female ? FEMALE : MALE));
        exercise(A_WIS, TRUE);
        return 0;
    }

    /* KMH, conduct */
    if (!u.uconduct.polyselfs++)
        livelog_printf(LL_CONDUCT,
                       _("changed form for the first time, becoming %s"),
                       an(pmname(mons[mntmp], flags.female ? FEMALE : MALE)));

    /* exercise used to be at the very end but only Wis was affected
       there since the polymorph was always in effect by then */
    exercise(A_CON, FALSE);
    exercise(A_WIS, TRUE);

    if (!Upolyd()) {
        /* Human to monster; save human stats */
        struct_assign(u.macurr, u.acurr);
        struct_assign(u.mamax, u.amax);
        u.mfemale = unsigned(flags.female);
    } else {
        /* Monster to monster; restore human stats, to be
         * immediately changed to provide stats for the new monster
         */
        struct_assign(u.acurr, u.macurr);
        struct_assign(u.amax, u.mamax);
        flags.female = u.mfemale;
    }

    /* if stuck mimicking gold, stop immediately */
    if (gm.multi < 0 && U_AP_TYPE() == M_AP_OBJECT
        && gy.youmonst.data.mlet != S_MIMIC)
        unmul(_(""));
    /* if becoming a non-mimic, stop mimicking anything */
    if (mons[mntmp].mlet != S_MIMIC) {
        /* as in polyman() */
        gy.youmonst.m_ap_type = M_AP_NOTHING;
        gy.youmonst.mappearance = 0;
    }
    if (is_male(mons[mntmp])) {
        if (flags.female)
            dochange = TRUE;
    } else if (is_female(mons[mntmp])) {
        if (!flags.female)
            dochange = TRUE;
    } else if (!is_neuter(mons[mntmp]) && mntmp != u.ulycn) {
        if (gs.sex_change_ok && !rn2(10))
            dochange = TRUE;
    }

    strcpy(ustuckNam, u.ustuck ? Some_Monnam(u.ustuck) : _(""));

    strcpy(buf, (u.umonnum != mntmp) ? _("") : _("new "));
    if (dochange) {
        flags.female = +!flags.female;
        strcat(buf, (is_male(mons[mntmp]) || is_female(mons[mntmp]))
                       ? _("") : flags.female ? _("female ") : _("male "));
    }
    strcat(buf, pmname(mons[mntmp], flags.female ? FEMALE : MALE));
    You(_("%s %s!"), (u.umonnum != mntmp) ? _("turn into") : _("feel like"), an(buf));

    if (Stoned() && poly_when_stoned(mons[mntmp])) {
        /* poly_when_stoned already checked stone golem genocide */
        mntmp = PM_STONE_GOLEM;
        make_stoned(0, _("You turn to stone!"), 0, 0);
    }

    u.mtimedone = rn1(500, 500);
    u.umonnum = mntmp;
    set_uasmon();

    /* New stats for monster, to last only as long as polymorphed.
     * Currently only strength gets changed.
     */
    newMaxStr = uasmon_maxStr();
    if (strongmonst(mons[mntmp])) {
        (chars[u.acurr.a + A_STR]) = (chars[u.amax.a + A_STR]) = schar(newMaxStr);
    } else {
        /* not a strongmonst(); if hero has exceptional strength, remove it
           (note: removal is temporary until returning to original form);
           we don't attempt to enforce lower maximum for wimpy forms;
           unlike for strongmonst, current strength does not get set to max */
        (chars[u.amax.a + A_STR]) = schar(newMaxStr);
        /* make sure current is not higher than max (strip exceptional Str) */
        if (ABASE(A_STR) > AMAX(A_STR))
            (chars[u.acurr.a + A_STR]) = AMAX(A_STR);
    }

    if (Stone_resistance() && Stoned()) { /* parnes@eniac.seas.upenn.edu */
        make_stoned(0, _("You no longer seem to be petrifying."), 0,
                    0);
    }
    if (Sick_resistance() && Sick()) {
        make_sick(0, 0, FALSE, SICK_ALL);
        You(_("no longer feel sick."));
    }
    if (Slimed()) {
        if (flaming(gy.youmonst.data)) {
            make_slimed(0, _("The slime burns away!"));
        } else if (mntmp == PM_GREEN_SLIME) {
            /* do it silently */
            make_slimed(0, 0);
        }
    }
    check_strangling(FALSE); /* maybe stop strangling */
    if (nohands(gy.youmonst.data))
        make_glib(0);

    /*
    mlvl = adj_lev(&mons[mntmp]);
     * We can't do the above, since there's no such thing as an
     * "experience level of you as a monster" for a polymorphed character.
     */
    mlvl = (mons[mntmp].mlevel);
    if (gy.youmonst.data.mlet == S_DRAGON && mntmp >= PM_GRAY_DRAGON) {
        u.mhmax = In_endgame(u.uz) ? (8 * mlvl) : (4 * mlvl + d(mlvl, 4));
    } else if (is_golem(gy.youmonst.data)) {
        u.mhmax = golemhp(mntmp);
    } else {
        if (!mlvl)
            u.mhmax = rnd(4);
        else
            u.mhmax = d(mlvl, 8);
        if (is_home_elemental(mons[mntmp]))
            u.mhmax *= 3;
    }
    u.mh = u.mhmax;

    if (u.ulevel < mlvl) {
        /* Low level characters can't become high level monsters for long */

        u.mtimedone = Math.trunc(u.mtimedone * u.ulevel / mlvl);
    }

    if (uskin && mntmp != armor_to_dragon(uskin.otyp))
        skinback(FALSE);
    break_armor();
    drop_weapon(1);
    find_ac(); /* (repeated below) */
    /* if hiding under something and can't hide anymore, unhide now;
       but don't auto-hide when not already hiding-under */
    if (was_hiding_under)
        hideunder(gy.youmonst);

    if (u.utrap && u.utraptype == TT_PIT) {
        set_utrap(unsigned(rn1(6, 2)), TT_PIT); /* time to escape resets */
    }
    if (was_blind && !Blind()) { /* previous form was eyeless */
        set_itimeout(ref_of(u.uprops[BLINDED], "intrinsic"), 1);
        make_blinded(0, TRUE); /* remove blindness */
    }
    newsym(u.ux, u.uy); /* Change symbol */

    /* you now know what an egg of your type looks like; [moved from
       below in case expels() -> spoteffects() drops hero onto any eggs] */
    if (lays_eggs(gy.youmonst.data)) {
        learn_egg_type(u.umonnum);
        /* make queen bees recognize killer bee eggs */
        learn_egg_type(egg_type_from_parent(u.umonnum, TRUE));
    }

    if (u.uswallow) {
        let usiz;

        /* if new form can't be swallowed, make engulfer expel hero */
        if (unsolid(gy.youmonst.data)
            /* subset of engulf_target() */
            || (usiz = gy.youmonst.data.msize) >= MZ_HUGE
            || (u.ustuck.data.msize < usiz && !is_whirly(u.ustuck.data))) {
            let expels_mesg = TRUE;

            if (unsolid(gy.youmonst.data)) {
                if (canspotmon(u.ustuck)) /* [see below for explanation] */
                    strcpy(ustuckNam, Monnam(u.ustuck));
                pline(_("%s can no longer contain you."), ustuckNam);
                expels_mesg = FALSE;
            }
            expels(u.ustuck, u.ustuck.data, expels_mesg);
            was_expelled = TRUE;
            /* FIXME? if expels() triggered rehumanize then we should
               return early */
        }

    /* [note:  this 'sticking' handling is only sufficient for changing from
       grabber to engulfer or vice versa because engulfing by poly'd hero
       always ends immediately so won't be in effect during a polymorph] */
    } else if (u.ustuck && !sticking /* && !u.uswallow */
               /* being held; if now capable of holding, make holder
                  release so that hero doesn't automagically start holding
                  it; or, release if no longer capable of being held */
               && (sticks(gy.youmonst.data) || unsolid(gy.youmonst.data))) {
        /* u.ustuck name was saved above in case we're changing from can-see
           to can't-see; but might have changed from can't-see to can-see so
           override here if hero knows who u.ustuck is */
        if (canspotmon(u.ustuck))
            strcpy(ustuckNam, Monnam(u.ustuck));
        set_ustuck(null);
        pline(_("%s loses its grip on you."), ustuckNam);
    } else if (sticking && !sticks(gy.youmonst.data)) {
        /* was holding onto u.ustuck but no longer capable of that */
        uunstick();
    }

    if (u.usteed) {
        if (touch_petrifies(u.usteed.data) && !Stone_resistance() && rnl(3)) {
            pline(_("%s touch %s."), no_longer_petrify_resistant,
                  mon_nam(u.usteed));
            sprintf(buf, _("riding %s"), an(pmname(u.usteed.data, Mgender(u.usteed))))
;
            instapetrify(buf);
        }
        if (!can_ride(u.usteed))
            dismount_steed(DISMOUNT_POLY);
    }

    find_ac();
    if (((!Levitation() && !u.ustuck && !Flying() && is_pool_or_lava(u.ux, u.uy))
         || (Underwater() && !Swimming()))
        /* if expelled above, expels() already called spoteffects() */
        && !was_expelled) {
        spoteffects(TRUE);
        /* FIXME? if spoteffects() triggered rehumanize then we should
           return early */
    }
    if (Passes_walls() && u.utrap
        && (u.utraptype == TT_INFLOOR || u.utraptype == TT_BURIEDBALL)) {
        if (u.utraptype == TT_INFLOOR) {
            pline_The(_("rock seems to no longer trap you."));
        } else {
            pline_The(_("buried ball is no longer bound to you."));
            buried_ball_to_freedom();
        }
        reset_utrap(TRUE);
    } else if (likes_lava(gy.youmonst.data) && u.utrap
               && u.utraptype == TT_LAVA) {
        pline_The(_("%s now feels soothing."), hliquid(_("lava")));
        reset_utrap(TRUE);
    }
    if (amorphous(gy.youmonst.data) || is_whirly(gy.youmonst.data)
        || unsolid(gy.youmonst.data)) {
        if (Punished()) {
            You(_("slip out of the iron chain."));
            unpunish();
        } else if (u.utrap && u.utraptype == TT_BURIEDBALL) {
            You(_("slip free of the buried ball and chain."));
            buried_ball_to_freedom();
        }
    }
    if (u.utrap && (u.utraptype == TT_WEB || u.utraptype == TT_BEARTRAP)
        && (amorphous(gy.youmonst.data) || is_whirly(gy.youmonst.data)
            || unsolid(gy.youmonst.data)
            || (gy.youmonst.data.msize <= MZ_SMALL
                && u.utraptype == TT_BEARTRAP))) {
        You(_("are no longer stuck in the %s."),
            u.utraptype == TT_WEB ? _("web") : _("bear trap"));
        /* probably should burn webs too if PM_FIRE_ELEMENTAL */
        reset_utrap(TRUE);
    }
    if (webmaker(gy.youmonst.data) && u.utrap && u.utraptype == TT_WEB) {
        You(_("orient yourself on the web."));
        reset_utrap(TRUE);
    }
    check_strangling(TRUE); /* maybe start strangling */

    disp.botl = TRUE;
    gv.vision_full_recalc = 1;
    see_monsters();
    encumber_msg();

    retouch_equipment(2);
    /* this might trigger a recursive call to polymon() [stone golem
       wielding cockatrice corpse and hit by stone-to-flesh, becomes
       flesh golem above, now gets transformed back into stone golem;
       fortunately neither form uses #monster] */
    if (!uarmg)
        selftouch(no_longer_petrify_resistant);

    /* the explanation of '#monster' used to be shown sooner, but there are
       possible fatalities above and it isn't useful unless hero survives */
    if (flags.verbose) {
        let use_thec = init_string(static_array("polymon.use_thec", char, sizeof_string("Use the command #%s to %s.")), _("Use the command #%s to %s."), true);
        let monsterc = init_string(static_array("polymon.monsterc", char, sizeof_string("monster")), _("monster"), true);
        let uptr = gy.youmonst.data;
        let might_hide = +(is_hider(uptr) || hides_under(uptr));

        if (can_breathe(uptr))
            pline(use_thec, monsterc, _("use your breath weapon"));
        if (attacktype(uptr, AT_SPIT))
            pline(use_thec, monsterc, _("spit venom"));
        if (uptr.mlet == S_NYMPH)
            pline(use_thec, monsterc, _("remove an iron ball"));
        if (attacktype(uptr, AT_GAZE))
            pline(use_thec, monsterc, _("gaze at monsters"));
        if (might_hide && webmaker(uptr))
            pline(use_thec, monsterc, _("hide or to spin a web"));
        else if (might_hide)
            pline(use_thec, monsterc, _("hide"));
        else if (webmaker(uptr))
            pline(use_thec, monsterc, _("spin a web"));
        if (is_were(uptr))
            pline(use_thec, monsterc, _("summon help"));
        if (u.umonnum == PM_GREMLIN)
            pline(use_thec, monsterc, _("multiply in a fountain"));
        if (is_unicorn(uptr))
            pline(use_thec, monsterc, _("use your horn"));
        if (is_mind_flayer(uptr))
            pline(use_thec, monsterc, _("emit a mental blast"));
        if (uptr.msound == MS_SHRIEK) /* worthless, actually */
            pline(use_thec, monsterc, _("shriek"));
        if (is_vampire(uptr) || is_vampshifter(gy.youmonst))
            pline(use_thec, monsterc, _("change shape"));

        if (lays_eggs(uptr) && flags.female
            && !(uptr == mons[PM_GIANT_EEL]
                 || uptr == mons[PM_ELECTRIC_EEL]))
            pline(use_thec, _("sit"),
                  eggs_in_water(uptr) ? _("spawn in the water") : _("lay an egg"));
    }
    return 1;
    } finally { stack_pop($frame); }
}

/* determine hero's temporary strength value used while polymorphed;
   hero poly'd into M2_STRONG monster usually gets 18/100 strength but
   there are exceptions; non-M2_STRONG get maximum strength set to 18 */
export function uasmon_maxStr() { /* schar */
    let R;
    let newMaxStr;
    let mndx = u.umonnum;
    let ptr = mons[mndx];

    if (is_orc(ptr)) {
        if (mndx != PM_URUK_HAI && mndx != PM_ORC_CAPTAIN)
            mndx = PM_ORC;
    } else if (is_elf(ptr)) {
        mndx = PM_ELF;
    } else if (is_dwarf(ptr)) {
        mndx = PM_DWARF;
    } else if (is_gnome(ptr)) {
        mndx = PM_GNOME;
    }
    R = character_race(mndx);

    if (strongmonst(ptr)) {
        /* ettins, titans and minotaurs don't pass the is_giant() test;
           giant mummies and giant zombies do but we throttle those */
        let live_H = +(is_giant(ptr) && !is_undead(ptr));

        /* hero orcs are limited to 18/50 for maximum strength, so treat
           hero poly'd into an orc the same; goblins, orc shamans, and orc
           zombies don't have strongmonst() attribute so won't get here;
           hobgoblins and orc mummies do get here and are limited to 18/50
           like normal orcs; however, orc captains and Uruk-hai retain 18/100
           strength; hero gnomes are also limited to 18/50; hero elves are
           limited to 18/00 regardless of whether they're strongmonst, but
           the two strongmonst types (monarchs and nobles) have current
           strength set to 18 [by polymon()], the others don't */
        newMaxStr = R ? R.attrmax[A_STR] : live_H ? STR19(19) : STR18(100);
    } else {
        newMaxStr = R ? R.attrmax[A_STR] : 18; /* 18 is same as STR18(0) */
    }
    return schar(newMaxStr);
}

/* dropx() jacket for break_armor() */
function dropp(obj) { /* void */
    let otmp;

    /*
     * Dropping worn armor while polymorphing might put hero into water
     * (loss of levitation boots or water walking boots that the new
     * form can't wear), where emergency_disrobe() could remove it from
     * inventory.  Without this, dropx() could trigger an 'object lost'
     * panic.  Right now, boots are the only armor which might encounter
     * this situation, but handle it for all armor.
     *
     * Hypothetically, 'obj' could have merged with something (not
     * applicable for armor) and no longer be a valid pointer, so scan
     * inventory for it instead of trusting obj->where.
     */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
        if (otmp == obj) {
            dropx(obj);
            /* Note that otmp->nobj is pointing at fobj now,
             * as a result of:
             * dropx() -> dropy() -> dropz() -> place_object(),
             * and no longer pointing at the next obj in inventory.
             * That would be an issue if this loop were allowed
             * to continue, but the break statement that
             * follows prevents the loop from continuing on with
             * objects on the floor.
             */
            break;
        }
    }
}

function break_armor() { /* void */
    const $frame = stack_frame(); try {
    let otmp;
    let uptr = gy.youmonst.data;

    if (breakarm(uptr)) {
        if ((otmp = uarm) != null) {
            if (donning(otmp))
                cancel_don();
            /* for gold DSM, we don't want Armor_gone() to report that it
               stops shining _after_ we've been told that it is destroyed */
            if (otmp.lamplit)
                end_burn(otmp, FALSE);

            You(_("break out of your armor!"));
            exercise(A_STR, FALSE);
            Armor_gone();
            useup(otmp);
        }
        if ((otmp = uarmc) != null
            /* mummy wrapping adapts to small and very big sizes */
            && (otmp.otyp != MUMMY_WRAPPING || !WrappingAllowed(uptr))) {
            if (otmp.otyp == MUMMY_WRAPPING) {
                /* doesn't have a clasp to break open */
                Your(_("%s tears apart!"), cloak_simple_name(otmp));
                Cloak_off();
                useup(otmp);
            } else if (otmp.otyp == ALCHEMY_SMOCK) {
                pline_The(_("knot on your %s is pulled apart!"), cloak_simple_name(otmp));
                Cloak_off();
                dropp(otmp);
            } else {
                pline_The(_("clasp on your %s breaks open!"), cloak_simple_name(otmp));
                Cloak_off();
                dropp(otmp);
            }
        }
        if (uarmu) {
            Your(_("shirt rips to shreds!"));
            useup(uarmu);
        }
    } else if (sliparm(uptr)) {
        if ((otmp = uarm) != null && racial_exception(gy.youmonst, otmp) < 1) {
            if (donning(otmp))
                cancel_don();
            Your(_("armor falls around you!"));
            /* [note: _gone() instead of _off() dates to when life-saving
               could force fire resisting armor back on if hero burned in
               hell (3.0, predating Gehennom); the armor isn't actually
               gone here but also isn't available to be put back on] */
            Armor_gone();
            dropp(otmp);
        }
        if ((otmp = uarmc) != null
            /* mummy wrapping adapts to small and very big sizes */
            && (otmp.otyp != MUMMY_WRAPPING || !WrappingAllowed(uptr))) {
            if (is_whirly(uptr))
                Your(_("%s falls, unsupported!"), cloak_simple_name(otmp));
            else
                You(_("shrink out of your %s!"), cloak_simple_name(otmp));
            Cloak_off();
            dropp(otmp);
        }
        if ((otmp = uarmu) != null) {
            if (is_whirly(uptr))
                You(_("seep right through your shirt!"));
            else
                You(_("become much too small for your shirt!"));
            setworn(null, otmp.owornmask & W_ARMU);
            dropp(otmp);
        }
    }
    if (has_horns(uptr)) {
        if ((otmp = uarmh) != null) {
            if (is_flimsy(otmp) && !donning(otmp)) {
                let hornbuf = stack_array(char, BUFSZ);

                /* Future possibilities: This could damage/destroy helmet */
                sprintf(hornbuf, _("horn%s"), plur(num_horns(uptr)));
                Your(_("%s %s through %s."), hornbuf, vtense(hornbuf, _("pierce")),
                     yname(otmp));
            } else {
                if (donning(otmp))
                    cancel_don();
                Your(_("%s falls to the %s!"), helm_simple_name(otmp),
                     surface(u.ux, u.uy));
                Helmet_off();
                dropp(otmp);
            }
        }
    }
    if (nohands(uptr) || verysmall(uptr)) {
        if ((otmp = uarmg) != null) {
            if (donning(otmp))
                cancel_don();
            /* Drop weapon along with gloves */
            You(_("drop your gloves%s!"), uwep ? _(" and weapon") : _(""));
            drop_weapon(0);
            Gloves_off();
            /* Glib manipulation (ends immediately) handled by Gloves_off */
            dropp(otmp);
        }
        if ((otmp = uarms) != null) {
            You(_("can no longer hold your shield!"));
            Shield_off();
            dropp(otmp);
        }
        if ((otmp = uarmh) != null) {
            if (donning(otmp))
                cancel_don();
            Your(_("%s falls to the %s!"), helm_simple_name(otmp),
                 surface(u.ux, u.uy));
            Helmet_off();
            dropp(otmp);
        }
    }
    if (nohands(uptr) || verysmall(uptr)
        || slithy(uptr) || uptr.mlet == S_CENTAUR) {
        if ((otmp = uarmf) != null) {
            if (donning(otmp))
                cancel_don();
            if (is_whirly(uptr))
                Your(_("boots fall away!"));
            else
                Your(_("boots %s off your feet!"),
                     verysmall(uptr) ? _("slide") : _("are pushed"));
            Boots_off();
            dropp(otmp);
        }
    }
    /* not armor, but eyewear shouldn't stay worn without a head to wear
       it/them on (should also come off if head is too tiny or too huge,
       but putting accessories on doesn't reject those cases [yet?]);
       amulet stays worn */
    if ((otmp = ublindf) != null && !has_head(uptr)) {
        let l;
        let eyewear = simpleonames(otmp); /* blindfold|towel|lenses */

        if (!strncmp(eyewear, _("pair of "), l = 8)) /* lenses */
            eyewear += l;
        Your(_("%s %s off!"), eyewear, vtense(eyewear, _("fall")));
        Blindf_off(null); /* Null: skip usual off mesg */
        dropp(otmp);
    }
    /* rings stay worn even when no hands */
    } finally { stack_pop($frame); }
}

function drop_weapon(alone) { /* void */
    let otmp;
    let what, which, whichtoo;
    let candropwep, candropswapwep, updateinv = TRUE;

    if (uwep) {
        /* !alone check below is currently superfluous but in the
         * future it might not be so if there are monsters which cannot
         * wear gloves but can wield weapons
         */
        if (!alone || cantwield(gy.youmonst.data)) {
            candropwep = canletgo(uwep, _(""));
            candropswapwep = (!u.twoweap || canletgo(uswapwep, _("")) ? 1 : 0);
            if (alone) {
                what = (candropwep && candropswapwep) ? _("drop") : _("release");
                which = is_sword(uwep) ? _("sword") : weapon_descr(uwep);
                if (u.twoweap) {
                    whichtoo =
                        is_sword(uswapwep) ? _("sword") : weapon_descr(uswapwep);
                    if (strcmp(which, whichtoo))
                        which = _("weapon");
                }
                if (uwep.quan != 1 || u.twoweap)
                    which = makeplural(which);

                You(_("find you must %s %s %s!"), what,
                    the_your()[+!!strncmp(which, _("corpse"), 6)], which);
            }
            /* if either uwep or wielded uswapwep is flagged as 'in_use'
               then don't drop it or explicitly update inventory; leave
               those actions to caller (or caller's caller, &c) */
            if (u.twoweap) {
                otmp = uswapwep;
                uswapwepgone();
                if (otmp.in_use)
                    updateinv = FALSE;
                else if (candropswapwep)
                    dropx(otmp);
            }
            otmp = uwep;
            uwepgone();
            if (otmp.in_use)
                updateinv = FALSE;
            else if (candropwep)
                dropx(otmp);
            /* [note: dropp vs dropx -- if heart of ahriman is wielded, we
               might be losing levitation by dropping it; but that won't
               happen until the drop, unlike Boots_off() dumping hero into
               water and triggering emergency_disrobe() before dropx()] */

            if (updateinv)
                update_inventory();
        } else if (!could_twoweap(gy.youmonst.data)) {
            untwoweapon();
        }
    }
}

/* return to original form, usually either due to polymorph timing out
   or dying from loss of hit points while being polymorphed */
export function rehumanize() { /* void */
    let was_flying = +(Flying() != 0);

    /* You can't revert back while unchanging */
    if (Unchanging()) {
        if (u.mh < 1) {
            svk.killer.format = NO_KILLER_PREFIX;
            strcpy(svk.killer.name, _("killed while stuck in creature form"));
            done(DIED);
            /* can get to here if declining to die in explore or wizard
               mode; since we're wearing an amulet of unchanging we can't
               be wearing an amulet of life-saving */
            return; /* don't rehumanize after all */
        } else if (uamul && uamul.otyp == AMULET_OF_UNCHANGING) {
            Your(_("%s %s!"), simpleonames(uamul), otense(uamul, _("fail")));
            observe_object(uamul);
            makeknown(AMULET_OF_UNCHANGING);
        }
    }

    /*
     * Right now, dying while being a shifted vampire (bat, cloud, wolf)
     * reverts to human rather than to vampire.
     */

    if (emits_light(gy.youmonst.data))
        del_light_source(LS_MONSTER, monst_to_any(gy.youmonst));
    polyman(_("You return to %s form!"), gu.urace.adj);

    if (u.uhp < 1) {
        /* can only happen if some bit of code reduces u.uhp
           instead of u.mh while poly'd */
        Your(_("old form was not healthy enough to survive."));
        sprintf(svk.killer.name, _("reverting to unhealthy %s form"), gu.urace.adj)
;
        svk.killer.format = KILLED_BY;
        done(DIED);
    }
    nomul(0);

    disp.botl = TRUE;
    gv.vision_full_recalc = 1;
    encumber_msg();
    update_inventory();
    if (was_flying && !Flying() && u.usteed)
        You(_("and %s return gently to the %s."),
            mon_nam(u.usteed), surface(u.ux, u.uy));
    retouch_equipment(2);
    if (!uarmg)
        selftouch(no_longer_petrify_resistant);
}

export function dobreathe() { /* int */
    let mattk;

    if (Strangled()) {
        You_cant(_("breathe.  Sorry."));
        return ECMD_OK;
    }
    if (u.uen < 15) {
        You(_("don't have enough energy to breathe!"));
        return ECMD_OK;
    }
    u.uen -= 15;
    disp.botl = TRUE;

    if (!getdir(0))
        return ECMD_CANCEL;

    mattk = attacktype_fordmg(gy.youmonst.data, AT_BREA, AD_ANY);
    if (!mattk)
        impossible(_("bad breath attack?")); /* mouthwash needed... */
    else if (!u.dx && !u.dy && !u.dz)
        ubreatheu(mattk);
    else
        ubuzz(BZ_U_BREATH(BZ_OFS_AD(mattk.adtyp)), mattk.damn);
    return ECMD_TIME;
}

export function dospit() { /* int */
    let otmp;
    let mattk;

    if (!getdir(0))
        return ECMD_CANCEL;
    mattk = attacktype_fordmg(gy.youmonst.data, AT_SPIT, AD_ANY);
    if (!mattk) {
        impossible(_("bad spit attack?"));
    } else {
        switch (mattk.adtyp) {
        case AD_BLND:
        case AD_DRST:
            otmp = mksobj(BLINDING_VENOM, TRUE, FALSE);
            break;
        default:
            impossible(_("bad attack type in dospit"));
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case AD_ACID:
            otmp = mksobj(ACID_VENOM, TRUE, FALSE);
            break;
        }
        otmp.spe = 1; /* to indicate it's yours */
        throwit(otmp, 0, FALSE, null);
    }
    return ECMD_TIME;
}

export function doremove() { /* int */
    if (!Punished()) {
        if (u.utrap && u.utraptype == TT_BURIEDBALL) {
            pline_The(_("ball and chain are buried firmly in the %s."),
                      surface(u.ux, u.uy));
            return ECMD_OK;
        }
        You(_("are not chained to anything!"));
        return ECMD_OK;
    }
    unpunish();
    return ECMD_TIME;
}

export function dospinweb() { /* int */
    const $frame = stack_frame(); try {
    let x = u.ux, y = u.uy;
    let ttmp = t_at(x, y);
    /* disallow webs on water, lava, air & cloud */
    let reject_terrain = (is_pool_or_lava(x, y) || IS_AIR(levl()[x][y].typ) ? 1 : 0);

    /* [at the time this was written, it was not possible to be both a
       webmaker and a flyer, but with the advent of amulet of flying that
       became a possibility; at present hero can spin a web while flying] */
    if (Levitation() || reject_terrain) {
        You(_("must be on %s ground to spin a web."),
            reject_terrain ? _("solid") : _("the"));
        return ECMD_OK;
    }
    if (u.uswallow) {
        You(_("release web fluid inside %s."), mon_nam(u.ustuck));
        if (is_animal(u.ustuck.data)) {
            expels(u.ustuck, u.ustuck.data, TRUE);
            return ECMD_OK;
        }
        if (is_whirly(u.ustuck.data)) {
            let i;

            for (i = 0; i < NATTK; i++)
                if (u.ustuck.data.mattk[i].aatyp == AT_ENGL)
                    break;
            if (i == NATTK)
                impossible(_("Swallower has no engulfing attack?"));
            else {
                let sweep = stack_array(char, 30);

                chars[sweep + 0] = ord('\0');
                switch (u.ustuck.data.mattk[i].adtyp) {
                case AD_FIRE:
                    strcpy(sweep, _("ignites and "));
                    break;
                case AD_ELEC:
                    strcpy(sweep, _("fries and "));
                    break;
                case AD_COLD:
                    strcpy(sweep, _("freezes, shatters and "));
                    break;
                }
                pline_The(_("web %sis swept away!"), sweep);
            }
            return ECMD_OK;
        } /* default: a nasty jelly-like creature */
        pline_The(_("web dissolves into %s."), mon_nam(u.ustuck));
        return ECMD_OK;
    }
    if (u.utrap) {
        You(_("cannot spin webs while stuck in a trap."));
        return ECMD_OK;
    }
    exercise(A_DEX, TRUE);
    if (ttmp) {
        switch (ttmp.ttyp) {
        case PIT:
        case SPIKED_PIT:
            You(_("spin a web, covering up the pit."));
            deltrap(ttmp);
            bury_objs(x, y);
            newsym(x, y);
            return ECMD_TIME;
        case SQKY_BOARD:
            pline_The(_("squeaky board is muffled."));
            deltrap(ttmp);
            newsym(x, y);
            return ECMD_TIME;
        case TELEP_TRAP:
        case LEVEL_TELEP:
        case MAGIC_PORTAL:
        case VIBRATING_SQUARE:
            Your(_("webbing vanishes!"));
            return ECMD_OK;
        case WEB:
            You(_("make the web thicker."));
            return ECMD_TIME;
        case HOLE:
        case TRAPDOOR:
            You(_("web over the %s."),
                (ttmp.ttyp == TRAPDOOR) ? _("trap door") : _("hole"));
            deltrap(ttmp);
            newsym(x, y);
            return ECMD_TIME;
        case ROLLING_BOULDER_TRAP:
            You(_("spin a web, jamming the trigger."));
            deltrap(ttmp);
            newsym(x, y);
            return ECMD_TIME;
        case ARROW_TRAP:
        case DART_TRAP:
        case BEAR_TRAP:
        case ROCKTRAP:
        case FIRE_TRAP:
        case LANDMINE:
        case SLP_GAS_TRAP:
        case RUST_TRAP:
        case MAGIC_TRAP:
        case ANTI_MAGIC:
        case POLY_TRAP:
            You(_("have triggered a trap!"));
            dotrap(ttmp, NO_TRAP_FLAGS);
            return ECMD_TIME;
        default:
            impossible(_("Webbing over trap type %d?"), ttmp.ttyp);
            return ECMD_OK;
        }
    } else if (On_stairs(x, y)) {
        /* cop out: don't let them hide the stairs */
        Your(_("web fails to impede access to the %s."),
             (levl()[x][y].typ == STAIRS) ? _("stairs") : _("ladder"));
        return ECMD_TIME;
    }
    ttmp = maketrap(x, y, WEB);
    if (ttmp) {
        You(_("spin a web."));
        ttmp.madeby_u = 1;
        feeltrap(ttmp);
        if (chars[in_rooms(x, y, SHOPBASE)])
            add_damage(x, y, SHOP_WEB_COST);
    }
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

export function dosummon() { /* int */
    const $frame = stack_frame(); try {
    let placeholder = stack_var(int);
    if (u.uen < 10) {
        You(_("lack the energy to send forth a call for help!"));
        return ECMD_OK;
    }
    u.uen -= 10;
    disp.botl = TRUE;

    You(_("call upon your brethren for help!"));
    exercise(A_WIS, TRUE);
    if (!were_summon(gy.youmonst.data, TRUE, placeholder, 0))
        pline(_("But none arrive."));
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

export function dogaze() { /* int */
    const $frame = stack_frame(); try {
    let mtmp;
    let looked = 0;
    let qbuf = stack_array(char, QBUFSZ);
    let i;
    let adtyp = 0;

    for (i = 0; i < NATTK; i++) {
        if (gy.youmonst.data.mattk[i].aatyp == AT_GAZE) {
            adtyp = gy.youmonst.data.mattk[i].adtyp;
            break;
        }
    }
    if (adtyp != AD_CONF && adtyp != AD_FIRE) {
        impossible(_("gaze attack %d?"), adtyp);
        return ECMD_OK;
    }

    if (Blind()) {
        You_cant(_("see anything to gaze at."));
        return ECMD_OK;
    } else if (Hallucination()) {
        You_cant(_("gaze at anything you can see."));
        return ECMD_OK;
    }
    if (u.uen < 15) {
        You(_("lack the energy to use your special gaze!"));
        return ECMD_OK;
    }
    u.uen -= 15;
    disp.botl = TRUE;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (canseemon(mtmp) && couldsee(mtmp.mx, mtmp.my)) {
            looked++;
            if (Invis() && !perceives(mtmp.data)) {
                pline(_("%s seems not to notice your gaze."), Monnam(mtmp));
            } else if (mtmp.minvis && !See_invisible()) {
                You_cant(_("see where to gaze at %s."), Monnam(mtmp));
            } else if (M_AP_TYPE(mtmp) == M_AP_FURNITURE
                       || M_AP_TYPE(mtmp) == M_AP_OBJECT) {
                looked--;
                continue;
            } else if (flags.safe_dog && mtmp.mtame && !Confusion()) {
                You(_("avoid gazing at %s."), y_monnam(mtmp));
            } else {
                if (flags.confirm && mtmp.mpeaceful && !Confusion()) {
                    sprintf(qbuf, _("Really %s %s?"), (adtyp == AD_CONF) ? _("confuse") : _("attack"), mon_nam(mtmp))

;
                    if (y_n(qbuf) != ord('y'))
                        continue;
                }
                setmangry(mtmp, TRUE);
                if (helpless(mtmp) || mtmp.mstun
                    || !mtmp.mcansee || !haseyes(mtmp.data)) {
                    looked--;
                    continue;
                }
                /* No reflection check for consistency with when a monster
                 * gazes at *you*--only medusa gaze gets reflected then.
                 */
                if (adtyp == AD_CONF) {
                    if (!mtmp.mconf)
                        Your(_("gaze confuses %s!"), mon_nam(mtmp));
                    else
                        pline(_("%s is getting more and more confused."),
                              Monnam(mtmp));
                    mtmp.mconf = 1;
                } else if (adtyp == AD_FIRE) {
                    let dmg = d(2, 6), orig_dmg = dmg, lev = u.ulevel;

                    You(_("attack %s with a fiery gaze!"), mon_nam(mtmp));
                    if (resists_fire(mtmp)) {
                        pline_The(_("fire doesn't burn %s!"), mon_nam(mtmp));
                        dmg = 0;
                    }
                    if (lev > rn2(20)) {
                        dmg += destroy_items(mtmp, AD_FIRE, orig_dmg);
                        ignite_items(mtmp.minvent);
                    }
                    if (dmg)
                        mtmp.mhp -= dmg;
                    if (DEADMONSTER(mtmp))
                        killed(mtmp);
                }
                /* For consistency with passive() in uhitm.c, this only
                 * affects you if the monster is still alive.
                 */
                if (DEADMONSTER(mtmp))
                    continue;

                if (mtmp.data == mons[PM_FLOATING_EYE] && !mtmp.mcan) {
                    if (!Free_action()) {
                        You(_("are frozen by %s gaze!"),
                            s_suffix(mon_nam(mtmp)));
                        nomul((u.ulevel > 6 || rn2(4))
                                  ? -d(mtmp.m_lev + 1,
                                       (mtmp.data.mattk[0].damd))
                                  : -200);
                        gm.multi_reason = _("frozen by a monster's gaze");
                        gn.nomovemsg = 0;
                        return ECMD_TIME;
                    } else
                        You(_("stiffen momentarily under %s gaze."),
                            s_suffix(mon_nam(mtmp)));
                }
                /* Technically this one shouldn't affect you at all because
                 * the Medusa gaze is an active monster attack that only
                 * works on the monster's turn, but for it to *not* have an
                 * effect would be too weird.
                 */
                if (mtmp.data == mons[PM_MEDUSA] && !mtmp.mcan) {
                    pline(_("Gazing at the awake %s is not a very good idea."),
                          l_monnam(mtmp));
                    /* as if gazing at a sleeping anything is fruitful... */
                    urgent_pline(_("You turn to stone..."));
                    svk.killer.format = KILLED_BY;
                    strcpy(svk.killer.name, _("deliberately meeting Medusa's gaze"))
;
                    done(STONING);
                }
            }
        }
    }
    if (!looked)
        You(_("gaze at no place in particular."));
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

/* called by domonability() for #monster */
export function dohide() { /* int */
    const $frame = stack_frame(); try {
    let ismimic = +(gy.youmonst.data.mlet == S_MIMIC),
            on_ceiling = (is_clinger(gy.youmonst.data) || Flying() ? 1 : 0);

    /* can't hide while being held (or holding) or while trapped
       (except for floor hiders [trapper or mimic] in pits) */
    if (u.ustuck || (u.utrap && (u.utraptype != TT_PIT || on_ceiling))) {
        You_cant(_("hide while you're %s."),
                 !u.ustuck ? _("trapped")
                   : u.uswallow ? (digests(u.ustuck.data) ? _("swallowed")
                                                           : _("engulfed"))
                     : !sticks(gy.youmonst.data) ? _("being held")
                       : (humanoid(u.ustuck.data) ? _("holding someone")
                                                   : _("holding that creature")));
        if (u.uundetected || (ismimic && U_AP_TYPE() != M_AP_NOTHING)) {
            u.uundetected = 0;
            gy.youmonst.m_ap_type = M_AP_NOTHING;
            newsym(u.ux, u.uy);
        }
        return ECMD_OK;
    }
    /* note: hero-as-eel handling is incomplete but unnecessary;
       such critters aren't offered the option of hiding via #monster */
    if (gy.youmonst.data.mlet == S_EEL && !is_pool(u.ux, u.uy)) {
        if (IS_FOUNTAIN(levl()[u.ux][u.uy].typ))
            pline_The(_("fountain is not deep enough to hide in."));
        else
            There(_("is no %s to hide in here."), hliquid(_("water")));
        u.uundetected = 0;
        return ECMD_OK;
    }
    if (hides_under(gy.youmonst.data)) {
        let ct = 0;
        let otmp, otop = svl.level.objects[u.ux][u.uy];

        if (!otop) {
            There(_("is nothing to hide under here."));
            u.uundetected = 0;
            return ECMD_OK;
        }
        for (otmp = otop;
             otmp && otmp.otyp == CORPSE
                  && touch_petrifies(mons[otmp.corpsenm]);
             otmp = otmp.v.v_nexthere)
            ct += otmp.quan;
        /* otmp will be Null iff the entire pile consists of 'trice corpses */
        if (!otmp && !Stone_resistance()) {
            let kbuf = stack_array(char, BUFSZ);
            let corpse_name = cxname(otop);

            /* for the plural case, we'll say "cockatrice corpses" or
               "chickatrice corpses" depending on the top of the pile
               even if both types are present */
            if (ct == 1)
                corpse_name = an(corpse_name);
            /* no need to check poly_when_stoned(); no hide-underers can
               turn into stone golems instead of becoming petrified */
            pline(_("Hiding under %s%s is a fatal mistake..."),
                  corpse_name, plur(ct));
            sprintf(kbuf, _("hiding under %s%s"), corpse_name, plur(ct));
            instapetrify(kbuf);
            /* only reach here if life-saved */
            u.uundetected = 0;
            return ECMD_TIME;
        }
    }
    /* Planes of Air and Water */
    if (on_ceiling && !has_ceiling(u.uz)) {
        There(_("is nowhere to hide above you."));
        u.uundetected = 0;
        return ECMD_OK;
    }
    if ((is_hider(gy.youmonst.data) && !Flying()) /* floor hider */
        && (Is_airlevel(u.uz) || Is_waterlevel(u.uz))) {
        There(_("is nowhere to hide beneath you."));
        u.uundetected = 0;
        return ECMD_OK;
    }
    /* TODO? inhibit floor hiding at furniture locations, or
     * else make youhiding() give smarter messages at such spots.
     */

    if (u.uundetected || (ismimic && U_AP_TYPE() != M_AP_NOTHING)) {
        youhiding(FALSE, 1); /* "you are already hiding" */
        return ECMD_OK;
    }

    if (ismimic) {
        /* should bring up a dialog "what would you like to imitate?" */
        gy.youmonst.m_ap_type = M_AP_OBJECT;
        gy.youmonst.mappearance = STRANGE_OBJECT;
    } else
        u.uundetected = 1;
    newsym(u.ux, u.uy);
    youhiding(FALSE, 0); /* "you are now hiding" */
    return ECMD_TIME;
    } finally { stack_pop($frame); }
}

export function dopoly() { /* int */
    let savedat = gy.youmonst.data;

    if (is_vampire(gy.youmonst.data) || is_vampshifter(gy.youmonst)) {
        polyself(POLY_MONSTER);
        if (savedat != gy.youmonst.data) {
            You(_("transform into %s."),
                an(pmname(gy.youmonst.data, Ugender())));
            newsym(u.ux, u.uy);
        }
    }
    return ECMD_TIME;
}

/* #monster for hero-as-mind_flayer giving psychic blast */
export function domindblast() { /* int */
    let mtmp, nmon;
    let dmg;

    if (u.uen < 10) {
        You(_("concentrate but lack the energy to maintain doing so."));
        return ECMD_OK;
    }
    u.uen -= 10;
    disp.botl = TRUE;

    You(_("concentrate."));
    pline(_("A wave of psychic energy pours out."));
    for (mtmp = fmon(); mtmp; mtmp = nmon) {
        let u_sen;

        nmon = mtmp.nmon;
        if (DEADMONSTER(mtmp))
            continue;
        if (mdistu(mtmp) > BOLT_LIM * BOLT_LIM)
            continue;
        if (mtmp.mpeaceful)
            continue;
        if (mindless(mtmp.data))
            continue;
        u_sen = +(telepathic(mtmp.data) && !mtmp.mcansee);
        if (u_sen || (telepathic(mtmp.data) && rn2(2)) || !rn2(10)) {
            dmg = rnd(15);
            /* wake it up first, to bring hidden monster out of hiding;
               but in case it is currently peaceful, don't make it hostile
               unless it will survive the psychic blast, otherwise hero
               would avoid the penalty for killing it while peaceful */
            wakeup(mtmp, (dmg > mtmp.mhp) ? TRUE : FALSE);
            You(_("lock in on %s %s."), s_suffix(mon_nam(mtmp)),
                u_sen ? _("telepathy")
                : telepathic(mtmp.data) ? _("latent telepathy")
                  : _("mind"));
            mtmp.mhp -= dmg;
            if (DEADMONSTER(mtmp))
                killed(mtmp);
        }
    }
    return ECMD_TIME;
}

export function uunstick() { /* void */
    let mtmp = u.ustuck;

    if (!mtmp) {
        impossible(_("uunstick: no ustuck?"));
        return;
    }
    set_ustuck(null); /* before pline() */
    pline(_("%s is no longer in your clutches."), Monnam(mtmp));
}

export function skinback(silently) { /* void */
    if (uskin) {
        let old_light = arti_light_radius(uskin);

        if (!silently)
            Your(_("skin returns to its original form."));
        uarm = uskin;
        uskin = null;
        /* undo save/restore hack */
        uarm.owornmask = and64(uarm.owornmask, ~I_SPECIAL);

        if (artifact_light(uarm))
            maybe_adjust_light(uarm, old_light);
    }
}

export function mbodypart(mon, part) { /* const char * */
    let humanoid_parts = static_array("mbodypart.humanoid_parts", ptr_to(char), null, [ _("arm"),       _("eye"),  _("face"),         _("finger"),
                              _("fingertip"), _("foot"), _("hand"),         _("handed"),
                              _("head"),      _("leg"),  _("light headed"), _("neck"),
                              _("spine"),     _("toe"),  _("hair"),         _("blood"),
                              _("lung"),      _("nose"), _("stomach") ]),
        jelly_parts = static_array("mbodypart.jelly_parts", ptr_to(char), null, [ _("pseudopod"), _("dark spot"), _("front"),
                           _("pseudopod extension"), _("pseudopod extremity"),
                           _("pseudopod root"), _("grasp"), _("grasped"),
                           _("cerebral area"), _("lower pseudopod"), _("viscous"),
                           _("middle"), _("surface"), _("pseudopod extremity"),
                           _("ripples"), _("juices"), _("surface"), _("sensor"),
                           _("stomach") ]),
        animal_parts = static_array("mbodypart.animal_parts", ptr_to(char), null, [ _("forelimb"),  _("eye"),           _("face"),
                            _("foreclaw"),  _("claw tip"),      _("rear claw"),
                            _("foreclaw"),  _("clawed"),        _("head"),
                            _("rear limb"), _("light headed"),  _("neck"),
                            _("spine"),     _("rear claw tip"), _("fur"),
                            _("blood"),     _("lung"),          _("nose"),
                            _("stomach") ]),
        bird_parts = static_array("mbodypart.bird_parts", ptr_to(char), null, [ _("wing"),     _("eye"),  _("face"),         _("wing"),
                          _("wing tip"), _("foot"), _("wing"),         _("winged"),
                          _("head"),     _("leg"),  _("light headed"), _("neck"),
                          _("spine"),    _("toe"),  _("feathers"),     _("blood"),
                          _("lung"),     _("bill"), _("stomach") ]),
        horse_parts = static_array("mbodypart.horse_parts", ptr_to(char), null, [ _("foreleg"),  _("eye"),           _("face"),
                           _("forehoof"), _("hoof tip"),      _("rear hoof"),
                           _("forehoof"), _("hooved"),        _("head"),
                           _("rear leg"), _("light headed"),  _("neck"),
                           _("backbone"), _("rear hoof tip"), _("mane"),
                           _("blood"),    _("lung"),          _("nose"),
                           _("stomach") ]),
        sphere_parts = static_array("mbodypart.sphere_parts", ptr_to(char), null, [ _("appendage"), _("optic nerve"), _("body"), _("tentacle"),
                            _("tentacle tip"), _("lower appendage"), _("tentacle"),
                            _("tentacled"), _("body"), _("lower tentacle"),
                            _("rotational"), _("equator"), _("body"),
                            _("lower tentacle tip"), _("cilia"), _("life force"),
                            _("retina"), _("olfactory nerve"), _("interior") ]),
        fungus_parts = static_array("mbodypart.fungus_parts", ptr_to(char), null, [ _("mycelium"), _("visual area"), _("front"),
                            _("hypha"),    _("hypha"),       _("root"),
                            _("strand"),   _("stranded"),    _("cap area"),
                            _("rhizome"),  _("sporulated"),  _("stalk"),
                            _("root"),     _("rhizome tip"), _("spores"),
                            _("juices"),   _("gill"),        _("gill"),
                            _("interior") ]),
        vortex_parts = static_array("mbodypart.vortex_parts", ptr_to(char), null, [ _("region"),        _("eye"),           _("front"),
                            _("minor current"), _("minor current"), _("lower current"),
                            _("swirl"),         _("swirled"),       _("central core"),
                            _("lower current"), _("addled"),        _("center"),
                            _("currents"),      _("edge"),          _("currents"),
                            _("life force"),    _("center"),        _("leading edge"),
                            _("interior") ]),
        snake_parts = static_array("mbodypart.snake_parts", ptr_to(char), null, [ _("vestigial limb"), _("eye"), _("face"), _("large scale"),
                           _("large scale tip"), _("rear region"), _("scale gap"),
                           _("scale gapped"), _("head"), _("rear region"),
                           _("light headed"), _("neck"), _("length"), _("rear scale"),
                           _("scales"), _("blood"), _("lung"), _("forked tongue"),
                           _("stomach") ]),
        worm_parts = static_array("mbodypart.worm_parts", ptr_to(char), null, [ _("anterior segment"), _("light sensitive cell"),
                          _("clitellum"), _("setae"), _("setae"), _("posterior segment"),
                          _("segment"), _("segmented"), _("anterior segment"),
                          _("posterior"), _("over stretched"), _("clitellum"),
                          _("length"), _("posterior setae"), _("setae"), _("blood"),
                          _("skin"), _("prostomium"), _("stomach") ]),
        spider_parts = static_array("mbodypart.spider_parts", ptr_to(char), null, [ _("pedipalp"), _("eye"), _("face"), _("pedipalp"), _("tarsus"),
                            _("claw"), _("pedipalp"), _("palped"), _("cephalothorax"),
                            _("leg"), _("spun out"), _("cephalothorax"), _("abdomen"),
                            _("claw"), _("hair"), _("hemolymph"), _("book lung"),
                            _("labrum"), _("digestive tract") ]),
        fish_parts = static_array("mbodypart.fish_parts", ptr_to(char), null, [ _("fin"), _("eye"), _("premaxillary"), _("pelvic axillary"),
                          _("pelvic fin"), _("anal fin"), _("pectoral fin"), _("finned"),
                          _("head"), _("peduncle"), _("played out"), _("gills"),
                          _("dorsal fin"), _("caudal fin"), _("scales"), _("blood"),
                          _("gill"), _("nostril"), _("stomach") ]);

    /* claw attacks are overloaded in mons[]; most humanoids with
       such attacks should still reference hands rather than claws */
    let not_claws = static_array("mbodypart.not_claws", char, null, [
        S_HUMAN,     S_MUMMY,   S_ZOMBIE, S_ANGEL, S_NYMPH, S_LEPRECHAUN,
        S_QUANTMECH, S_VAMPIRE, S_ORC,    S_GIANT, /* quest nemeses */
        ord('\0') /* string terminator; assert( S_xxx != 0 ); */
    ]);
    let mptr = mon.data;

    if (part <= NO_PART) {
        impossible(_("mbodypart: bad part %d"), part);
        return _("mystery part");
    }

    /* some special cases */
    if (mptr.mlet == S_DOG || mptr.mlet == S_FELINE
        || mptr.mlet == S_RODENT || mptr == mons[PM_OWLBEAR]) {
        switch (part) {
        case HAND:
            return _("paw");
        case HANDED:
            return _("pawed");
        case FOOT:
            return _("rear paw");
        case ARM:
        case LEG:
            return horse_parts[part]; /* "foreleg", "rear leg" */
        default:
            break; /* for other parts, use animal_parts[] below */
        }
    } else if (mptr.mlet == S_YETI) { /* excl. owlbear due to 'if' above */
        /* opposable thumbs, hence "hands", "arms", "legs", &c */
        return humanoid_parts[part]; /* yeti/sasquatch, monkey/ape */
    }
    if ((part == HAND || part == HANDED)
        && (humanoid(mptr) && attacktype(mptr, AT_CLAW)
            && !strchr(not_claws, mptr.mlet) && mptr != mons[PM_STONE_GOLEM]
            && mptr != mons[PM_AMOROUS_DEMON]))
        return (part == HAND) ? _("claw") : _("clawed");
    if ((mptr == mons[PM_MUMAK] || mptr == mons[PM_MASTODON])
        && part == NOSE)
        return _("trunk");
    if (mptr == mons[PM_SHARK] && part == HAIR)
        return _("skin"); /* sharks don't have scales */
    if ((mptr == mons[PM_JELLYFISH] || mptr == mons[PM_KRAKEN])
        && (part == ARM || part == FINGER || part == HAND || part == FOOT
            || part == TOE))
        return _("tentacle");
    if (mptr == mons[PM_FLOATING_EYE] && part == EYE)
        return _("cornea");
    if (humanoid(mptr) && (part == ARM || part == FINGER || part == FINGERTIP
                           || part == HAND || part == HANDED))
        return humanoid_parts[part];
    if (mptr.mlet == S_COCKATRICE)
        return (part == HAIR) ? snake_parts[part] : bird_parts[part];
    if (mptr == mons[PM_RAVEN])
        return bird_parts[part];
    if (mptr.mlet == S_CENTAUR || mptr.mlet == S_UNICORN
        || mptr == mons[PM_KI_RIN]
        || (mptr == mons[PM_ROTHE] && part != HAIR))
        return horse_parts[part];
    if (mptr.mlet == S_LIGHT) {
        if (part == HANDED)
            return _("rayed");
        else if (part == ARM || part == FINGER || part == FINGERTIP
                 || part == HAND)
            return _("ray");
        else
            return _("beam");
    }
    if (mptr == mons[PM_STALKER] && part == HEAD)
        return _("head");
    if (mptr.mlet == S_EEL && mptr != mons[PM_JELLYFISH])
        return fish_parts[part];
    if (mptr.mlet == S_WORM)
        return worm_parts[part];
    if (mptr.mlet == S_SPIDER)
        return spider_parts[part];
    if (slithy(mptr) || (mptr.mlet == S_DRAGON && part == HAIR))
        return snake_parts[part];
    if (mptr.mlet == S_EYE)
        return sphere_parts[part];
    if (mptr.mlet == S_JELLY || mptr.mlet == S_PUDDING
        || mptr.mlet == S_BLOB || mptr == mons[PM_JELLYFISH])
        return jelly_parts[part];
    if (mptr.mlet == S_VORTEX || mptr.mlet == S_ELEMENTAL)
        return vortex_parts[part];
    if (mptr.mlet == S_FUNGUS)
        return fungus_parts[part];
    if (humanoid(mptr))
        return humanoid_parts[part];
    return animal_parts[part];
}

export function body_part(part) { /* const char * */
    return mbodypart(gy.youmonst, part);
}

export function poly_gender() { /* int */
    /* Returns gender of polymorphed player;
     * 0/1=same meaning as flags.female, 2=none.
     */
    if (is_neuter(gy.youmonst.data) || !humanoid(gy.youmonst.data))
        return 2;
    return flags.female;
}

export function ugolemeffects(damtype, dam) { /* void */
    let heal = 0;

    /* We won't bother with "slow"/"haste" since players do not
     * have a monster-specific slow/haste so there is no way to
     * restore the old velocity once they are back to human.
     */
    if (u.umonnum != PM_FLESH_GOLEM && u.umonnum != PM_IRON_GOLEM)
        return;
    switch (damtype) {
    case AD_ELEC:
        if (u.umonnum == PM_FLESH_GOLEM)
            heal = Math.trunc((dam + 5) / 6); /* Approx 1 per die */
        break;
    case AD_FIRE:
        if (u.umonnum == PM_IRON_GOLEM)
            heal = dam;
        break;
    }
    if (heal && (u.mh < u.mhmax)) {
        u.mh += heal;
        if (u.mh > u.mhmax)
            u.mh = u.mhmax;
        disp.botl = TRUE;
        pline(_("Strangely, you feel better than before."));
        exercise(A_STR, TRUE);
    }
}

function armor_to_dragon(atyp) { /* int */
    switch (atyp) {
    case GRAY_DRAGON_SCALE_MAIL:
    case GRAY_DRAGON_SCALES:
        return PM_GRAY_DRAGON;
    case SILVER_DRAGON_SCALE_MAIL:
    case SILVER_DRAGON_SCALES:
        return PM_SILVER_DRAGON;
    case GOLD_DRAGON_SCALE_MAIL:
    case GOLD_DRAGON_SCALES:
        return PM_GOLD_DRAGON;

    case RED_DRAGON_SCALE_MAIL:
    case RED_DRAGON_SCALES:
        return PM_RED_DRAGON;
    case ORANGE_DRAGON_SCALE_MAIL:
    case ORANGE_DRAGON_SCALES:
        return PM_ORANGE_DRAGON;
    case WHITE_DRAGON_SCALE_MAIL:
    case WHITE_DRAGON_SCALES:
        return PM_WHITE_DRAGON;
    case BLACK_DRAGON_SCALE_MAIL:
    case BLACK_DRAGON_SCALES:
        return PM_BLACK_DRAGON;
    case BLUE_DRAGON_SCALE_MAIL:
    case BLUE_DRAGON_SCALES:
        return PM_BLUE_DRAGON;
    case GREEN_DRAGON_SCALE_MAIL:
    case GREEN_DRAGON_SCALES:
        return PM_GREEN_DRAGON;
    case YELLOW_DRAGON_SCALE_MAIL:
    case YELLOW_DRAGON_SCALES:
        return PM_YELLOW_DRAGON;
    default:
        return NON_PM;
    }
}

/* some species have awareness of other species */
function polysense() { /* void */
    let warnidx = NON_PM;

    svc.context.warntype.speciesidx = NON_PM;
    svc.context.warntype.species = null;
    svc.context.warntype.polyd = 0;
    u.uprops[WARN_OF_MON].intrinsic = and64(u.uprops[WARN_OF_MON].intrinsic, ~FROMRACE);

    switch (u.umonnum) {
    case PM_PURPLE_WORM:
    case PM_BABY_PURPLE_WORM:
        warnidx = PM_SHRIEKER;
        break;
    case PM_VAMPIRE:
    case PM_VAMPIRE_LEADER:
        svc.context.warntype.polyd = M2_HUMAN | M2_ELF;
        u.uprops[WARN_OF_MON].intrinsic = or64(u.uprops[WARN_OF_MON].intrinsic, FROMRACE);
        return;
    }
    if (ismnum(warnidx)) {
        svc.context.warntype.speciesidx = warnidx;
        svc.context.warntype.species = mons[warnidx];
        u.uprops[WARN_OF_MON].intrinsic = or64(u.uprops[WARN_OF_MON].intrinsic, FROMRACE);
    }
}

/* True iff hero's role or race has been genocided */
export function ugenocided() { /* boolean */
    return ((svm.mvitals[gu.urole.mnum].mvflags & G_GENOD)
            || (svm.mvitals[gu.urace.mnum].mvflags & G_GENOD) ? 1 : 0);
}

/* how hero feels "inside" after self-genocide of role or race */
export function udeadinside() { /* const char * */
    /* self-genocide used to always say "you feel dead inside" but that
       seems silly when you're polymorphed into something undead;
       monkilled() distinguishes between living (killed) and non (destroyed)
       for monster death message; we refine the nonliving aspect a bit */
    return !nonliving(gy.youmonst.data)
             ? _("dead")          /* living, including demons */
             : !weirdnonliving(gy.youmonst.data)
                 ? _("condemned") /* undead plus manes */
                 : _("empty");    /* golems plus vortices */
}

/*polyself.c*/

import { A_CON, A_DEX, A_STR, A_WIS } from "./attrib.h.js";
import { ABASE, ACURR, AMAX, STR18, STR19 } from "./attrib.h.macros.js";
import { VIA_WINDOWPORT } from "./botl.h.macros.js";
import { Never_mind, shudder_for_moment, thats_enough_tries, the_your } from "./decl.h.macros.js";
import {
    S_ANGEL, S_BLOB, S_CENTAUR, S_COCKATRICE, S_DOG, S_DRAGON, S_EEL, S_ELEMENTAL, S_EYE, S_FELINE,
    S_FUNGUS, S_GIANT, S_HUMAN, S_JELLY, S_LEPRECHAUN, S_LIGHT, S_MIMIC, S_MUMMY, S_NYMPH, S_ORC,
    S_PUDDING, S_QUANTMECH, S_RODENT, S_SPIDER, S_UNICORN, S_VAMPIRE, S_VORTEX, S_WORM, S_YETI,
    S_ZOMBIE,
} from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { In_endgame, Is_airlevel, Is_waterlevel } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_CONDUCT, LL_MINORAC, MAXULEV, QBUFSZ, TRUE } from "./global.h.js";
import {
    ARM, BOLT_LIM, DIED, DISMOUNT_POLY, ECMD_CANCEL, ECMD_OK, ECMD_TIME, EYE, FINGER, FINGERTIP,
    FOOT, GENOCIDED, HAIR, HAND, HANDED, HEAD, KILLED_BY, KILLED_BY_AN, LEG, NECK, NOSE,
    NO_KILLER_PREFIX, NO_PART, NO_TRAP_FLAGS, POLY_CONTROLLED, POLY_LOW_CTRL, POLY_MONSTER,
    POLY_REVERT, SHOP_WEB_COST, STONING, TOE,
} from "./hack.h.js";
import {
    BZ_OFS_AD, BZ_U_BREATH, You1, makeknown, mdistu, pline1, plur, rn1, y_n,
} from "./hack.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    AD_ACID, AD_ANY, AD_BLND, AD_COLD, AD_CONF, AD_DRST, AD_ELEC, AD_FIRE, AD_HALU, AD_MAGM,
    AD_RBRE, AT_BREA, AT_CLAW, AT_ENGL, AT_EXPL, AT_GAZE, AT_SPIT,
} from "./monattk.h.js";
import {
    amorphous, can_breathe, can_teleport, cantwield, control_teleport, could_twoweap, digests,
    eggs_in_water, emits_light, flaming, has_head, has_horns, haseyes, hides_under, humanoid,
    infravision, is_animal, is_bat, is_clinger, is_dwarf, is_elf, is_female, is_floater, is_flyer,
    is_giant, is_gnome, is_golem, is_hider, is_male, is_mind_flayer, is_neuter, is_orc,
    is_placeholder, is_swimmer, is_undead, is_unicorn, is_vampire, is_were, is_whirly, lays_eggs,
    likes_lava, mindless, nohands, nonliving, passes_walls, perceives, pm_invisible, polyok,
    regenerates, slithy, strongmonst, telepathic, touch_petrifies, type_is_pname, unsolid,
    verysmall, webmaker, weirdnonliving, your_race,
} from "./mondata.h.macros.js";
import {
    FEMALE, G_GENOD, G_UNIQ, M2_ELF, M2_HUMAN, MALE, MR_ACID, MR_COLD, MR_DISINT, MR_ELEC, MR_FIRE,
    MR_POISON, MR_SLEEP, MR_STONE, MS_SHRIEK, MZ_HUGE, MZ_SMALL, NEUTRAL,
} from "./monflag.h.js";
import { M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT } from "./monst.h.js";
import {
    DEADMONSTER, M_AP_TYPE, U_AP_TYPE, helpless, is_vampshifter, ismnum, resists_fire,
} from "./monst.h.macros.js";
import {
    LOW_PM, NON_PM, PM_ALIGNED_CLERIC, PM_AMOROUS_DEMON, PM_BABY_GRAY_DRAGON, PM_BABY_PURPLE_WORM,
    PM_BLACK_DRAGON, PM_BLUE_DRAGON, PM_CLERIC, PM_DWARF, PM_ELECTRIC_EEL, PM_ELF, PM_FLESH_GOLEM,
    PM_FLOATING_EYE, PM_FOG_CLOUD, PM_GHOUL, PM_GIANT, PM_GIANT_EEL, PM_GNOME, PM_GOLD_DRAGON,
    PM_GRAY_DRAGON, PM_GREEN_DRAGON, PM_GREEN_ELF, PM_GREEN_SLIME, PM_GREMLIN, PM_GREY_ELF,
    PM_HILL_GIANT, PM_HILL_ORC, PM_HUMAN, PM_IRON_GOLEM, PM_JELLYFISH, PM_KI_RIN, PM_KRAKEN,
    PM_MASTODON, PM_MEDUSA, PM_MORDOR_ORC, PM_MUMAK, PM_ORANGE_DRAGON, PM_ORC, PM_ORC_CAPTAIN,
    PM_OWLBEAR, PM_PURPLE_WORM, PM_RAVEN, PM_RED_DRAGON, PM_ROTHE, PM_SHARK, PM_SHRIEKER,
    PM_SILVER_DRAGON, PM_STALKER, PM_STONE_GIANT, PM_STONE_GOLEM, PM_URUK_HAI, PM_VAMPIRE,
    PM_VAMPIRE_BAT, PM_VAMPIRE_LEADER, PM_WHITE_DRAGON, PM_WOLF, PM_YELLOW_DRAGON, SPECIAL_PM,
} from "./monsters.h.js";
import {
    Is_dragon_armor, Is_dragon_scales, WrappingAllowed, is_flimsy, is_sword,
} from "./obj.h.macros.js";
import {
    ACID_VENOM, ALCHEMY_SMOCK, AMULET_OF_STRANGULATION, AMULET_OF_UNCHANGING, BLACK_DRAGON_SCALES,
    BLACK_DRAGON_SCALE_MAIL, BLINDING_VENOM, BLUE_DRAGON_SCALES, BLUE_DRAGON_SCALE_MAIL, CORPSE,
    GOLD_DRAGON_SCALES, GOLD_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, GRAY_DRAGON_SCALE_MAIL,
    GREEN_DRAGON_SCALES, GREEN_DRAGON_SCALE_MAIL, MUMMY_WRAPPING, ORANGE_DRAGON_SCALES,
    ORANGE_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RED_DRAGON_SCALE_MAIL, SILVER_DRAGON_SCALES,
    SILVER_DRAGON_SCALE_MAIL, STRANGE_OBJECT, WHITE_DRAGON_SCALES, WHITE_DRAGON_SCALE_MAIL,
    YELLOW_DRAGON_SCALES, YELLOW_DRAGON_SCALE_MAIL,
} from "./objects.h.js";
import { NATTK } from "./permonst.h.js";
import {
    ACID_RES, ANTIMAGIC, BLINDED, BLND_RES, COLD_RES, DISINT_RES, DRAIN_RES, FIRE_RES, FLYING,
    FROMFORM, FROMOUTSIDE, FROMRACE, HALLUC_RES, INFRAVISION, INVIS, I_SPECIAL, LEVITATION,
    PASSES_WALLS, POISON_RES, POLYMORPH, REFLECTING, REGENERATION, SEE_INVIS, SHOCK_RES, SICK_RES,
    SLEEP_RES, STEALTH, STONE_RES, STRANGLED, STUNNED, SWIMMING, TELEPAT, TELEPORT,
    TELEPORT_CONTROL, WARN_OF_MON, W_ARMU,
} from "./prop.h.js";
import { STAIRS } from "./rm.h.js";
import { IS_AIR, IS_FOUNTAIN, fmon, levl } from "./rm.h.macros.js";
import {
    ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP,
    MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP,
    SLP_GAS_TRAP, SPIKED_PIT, SQKY_BOARD, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB,
} from "./trap.h.js";
import { LS_MONSTER } from "./vision.h.js";
import { couldsee } from "./vision.h.macros.js";
import {
    SICK_ALL, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB,
} from "./you.h.js";
import { Role_switch, Ugender, Upolyd } from "./you.h.macros.js";
import {
    Blind, Confusion, EFlying, ELevitation, Flying, Free_action, HFlying, HLevitation,
    Hallucination, Invis, Levitation, Passes_walls, Polymorph_control,
    Protection_from_shape_changers, Punished, See_invisible, Sick, Sick_resistance, Slimed,
    Stone_resistance, Stoned, Strangled, Stunned, Swimming, Unaware, Unchanging, Underwater,
} from "./youprop.h.macros.js";
import { char, int, ord, schar, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, or64 } from "../rt/int64.js";
import { sprintf, strcat, strchr, strcmp, strcpy, strncmp } from "../rt/libc.js";
import { init_string, stack_array, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { ptr_to, ref_of, struct_assign } from "../rt/struct.js";
import { artifact_light, retouch_equipment } from "./artifact.js";
import { adjabil, exercise, newhp, redist_attr, setuhpmax } from "./attrib.js";
import { max_rank_sz, rank_of, status_initialize } from "./botl.js";
import { getdir } from "./cmd.js";
import { is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    disp, flags, gi, gm, gn, gs, gu, gv, gw, gy, program_state, svc, svk, svl, svm, svp, u,
} from "./decl.js";
import { buried_ball_to_freedom, bury_objs } from "./dig.js";
import { canseemon, newsym, see_monsters, set_mimic_blocking } from "./display.js";
import { canletgo, dropx } from "./do.js";
import {
    Mgender, Monnam, Some_Monnam, hliquid, l_monnam, mon_nam, pmname, y_monnam,
} from "./do_name.js";
import {
    Armor_gone, Blindf_off, Boots_off, Cloak_off, Gloves_off, Helmet_off, Shield_off, cancel_don,
    donning, find_ac,
} from "./do_wear.js";
import { throwit } from "./dothrow.js";
import { has_ceiling, surface } from "./dungeon.js";
import { newuhs } from "./eat.js";
import { dealloc_killer, done, find_delayed_killer } from "./end.js";
import { newpw, rndexp } from "./exper.js";
import { in_rooms, losehp, monst_to_any, nomul, rounddiv, spoteffects, unmul } from "./hack.js";
import { mungspaces, s_suffix, strstri, strsubst } from "./hacklib.js";
import { youhiding } from "./insight.js";
import { update_inventory, useup } from "./invent.js";
import { arti_light_radius, del_light_source, new_light_source } from "./light.js";
import { golemhp, is_home_elemental, mkclass_poly } from "./makemon.js";
import { expels } from "./mhitu.js";
import { maybe_adjust_light, mksobj } from "./mkobj.js";
import {
    egg_type_from_parent, hideunder, killed, set_ustuck, setmangry, valid_vampshiftform, wakeup,
} from "./mon.js";
import {
    attacktype, attacktype_fordmg, breakarm, can_be_strangled, dmgtype, dmgtype_fromattack,
    name_to_mon, name_to_monclass, num_horns, poly_when_stoned, resists_drli, set_mon_data, sliparm,
    sticks,
} from "./mondata.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import {
    an, cloak_simple_name, cxname, helm_simple_name, makeplural, otense, simpleonames, the,
    the_unique_pm, vtense, yname,
} from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import {
    There, You, You_cant, You_feel, Your, impossible, livelog_printf, pline, pline_The,
    urgent_pline,
} from "./pline.js";
import {
    make_blinded, make_glib, make_sick, make_slimed, make_stoned, set_itimeout,
} from "./potion.js";
import { unpunish } from "./read.js";
import { d, rn2, rnd, rnl } from "./rnd.js";
import { character_race, genders } from "./role.js";
import { add_damage } from "./shk.js";
import { On_stairs } from "./stairs.js";
import { can_ride, dismount_steed } from "./steed.js";
import { end_burn, learn_egg_type } from "./timeout.js";
import {
    deltrap, dotrap, feeltrap, ignite_items, instapetrify, maketrap, reset_utrap, selftouch,
    set_utrap, t_at,
} from "./trap.js";
import { weapon_descr } from "./weapon.js";
import { counter_were, were_beastie, were_summon } from "./were.js";
import { untwoweapon, uswapwepgone, uwepgone } from "./wield.js";
import { getlin } from "./windows.js";
import { racial_exception, setworn } from "./worn.js";
import { destroy_items, ubreatheu, ubuzz } from "./zap.js";
