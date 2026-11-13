/* NetHack 5.0	pray.c	$NHDT-Date: 1762680996 2025/11/09 01:36:36 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.244 $ */
/* Copyright (c) Benson I. Margulies, Mike Stephenson, Steve Linhart, 1989. */
/* NetHack may be freely redistributed.  See license for details. */

 /* NORETURN */

/* simplify a few tests */
export function Cursed_obj(obj, typ) { return (obj && obj.otyp == typ && obj.cursed ? 1 : 0); }

/*
 * Logic behind deities and altars and such:
 * + prayers are made to your god if not on an altar, and to the altar's god
 *   if you are on an altar
 * + If possible, your god answers all prayers, which is why bad things happen
 *   if you try to pray on another god's altar
 * + sacrifices work basically the same way, but the other god may decide to
 *   accept your allegiance, after which they are your god.  If rejected,
 *   your god takes over with your punishment.
 * + if you're in Gehennom, all messages come from Moloch
 */

/*
 *      Moloch, who dwells in Gehennom, is the "renegade" cruel god
 *      responsible for the theft of the Amulet from Marduk, the Creator.
 *      Moloch is unaligned.
 */
const Moloch = static_var("Moloch", ptr_to(char), _("Moloch"));

const godvoices = static_array("godvoices", ptr_to(char), null, [
    _("booms out"), _("thunders"), _("rings out"), _("booms"),
]);

export const PIOUS = 20;
export const DEVOUT = 14;

export const STRIDENT = 4;

/*
 * The actual trouble priority is determined by the order of the
 * checks performed in in_trouble() rather than by these numeric
 * values, so keep that code and these values synchronized in
 * order to have the values be meaningful.
 */

export const TROUBLE_STONED = 14;
export const TROUBLE_SLIMED = 13;
export const TROUBLE_STRANGLED = 12;
export const TROUBLE_LAVA = 11;
export const TROUBLE_SICK = 10;
export const TROUBLE_STARVING = 9;
export const TROUBLE_REGION = 8;
export const TROUBLE_HIT = 7;
export const TROUBLE_LYCANTHROPE = 6;
export const TROUBLE_COLLAPSING = 5;
export const TROUBLE_STUCK_IN_WALL = 4;
export const TROUBLE_CURSED_LEVITATION = 3;
export const TROUBLE_UNUSEABLE_HANDS = 2;
export const TROUBLE_CURSED_BLINDFOLD = 1;

export const TROUBLE_PUNISHED = (-1);
export const TROUBLE_FUMBLING = (-2);
export const TROUBLE_CURSED_ITEMS = (-3);
export const TROUBLE_SADDLE = (-4);
export const TROUBLE_BLIND = (-5);
export const TROUBLE_POISONED = (-6);
export const TROUBLE_WOUNDED_LEGS = (-7);
export const TROUBLE_HUNGRY = (-8);
export const TROUBLE_STUNNED = (-9);
export const TROUBLE_CONFUSED = (-10);
export const TROUBLE_HALLUCINATION = (-11);

export function ugod_is_angry() { return +(u.ualign.record < 0); }
export function on_altar() { return IS_ALTAR(levl()[u.ux][u.uy].typ); }
export function on_shrine() { return +((levl()[u.ux][u.uy].flags & AM_SHRINE) != 0); }
export function a_align(x, y) { return Amask2align(levl()[x][y].flags & AM_MASK); }

/* used by turn undead iteration function; always reinitialized
   before iterating that, so don't need to be globals */
const turn_undead_range = static_var("turn_undead_range", int);
const turn_undead_msg_cnt = static_var("turn_undead_msg_cnt", int);

/* critically low hit points if hp <= 5 or hp <= maxhp/N for some N */
export function critically_low_hp(
    only_if_injured) { /* boolean */ /* determines whether maxhp <= 5 matters */
    let divisor, hplim,
        curhp = Upolyd() ? u.mh : u.uhp,
        maxhp = Upolyd() ? u.mhmax : u.uhpmax;

    if (only_if_injured && !(curhp < maxhp))
        return FALSE;
    /* if maxhp is extremely high, use lower threshold for the division test
       (golden glow cuts off at 11+5*lvl, nurse interaction at 25*lvl; this
       ought to use monster hit dice--and a smaller multiplier--rather than
       ulevel when polymorphed, but polyself doesn't maintain that) */
    hplim = 15 * u.ulevel;
    if (maxhp > hplim)
        maxhp = hplim;
    /* 7 used to be the unconditional divisor */
    switch (xlev_to_rank(u.ulevel)) { /* maps 1..30 into 0..8 */
    case 0:
    case 1:
        divisor = 5;
        break; /* explvl 1 to 5 */
    case 2:
    case 3:
        divisor = 6;
        break; /* explvl 6 to 13 */
    case 4:
    case 5:
        divisor = 7;
        break; /* explvl 14 to 21 */
    case 6:
    case 7:
        divisor = 8;
        break; /* explvl 22 to 29 */
    default:
        divisor = 9;
        break; /* explvl 30+ */
    }
    /* 5 is a magic number in TROUBLE_HIT handling below */
    return (+(curhp <= 5 || curhp * divisor <= maxhp));
}

/* return True if surrounded by impassible rock, regardless of the state
   of your own location (for example, inside a doorless closet) */
export function stuck_in_wall() { /* boolean */
    let i, j, x, y, count = 0;

    if (Passes_walls())
        return FALSE;
    for (i = -1; i <= 1; i++) {
        x = u.ux + i;
        for (j = -1; j <= 1; j++) {
            if (!i && !j)
                continue;
            y = u.uy + j;
            if (!isok(x, y)
                || (IS_OBSTRUCTED(levl()[x][y].typ)
                    && (levl()[x][y].typ != SDOOR && levl()[x][y].typ != SCORR))
                || (blocked_boulder(i, j) && !throws_rocks(gy.youmonst.data)))
                ++count;
        }
    }
    return (count == 8) ? TRUE : FALSE;
}

/*
 * Return 0 if nothing particular seems wrong, positive numbers for
 * serious trouble, and negative numbers for comparative annoyances.
 * This returns the worst problem. There may be others, and the gods
 * may fix more than one.
 *
 * This could get as bizarre as noting surrounding opponents, (or
 * hostile dogs), but that's really hard.
 *
 * We could force rehumanize of polyselfed people, but we can't tell
 * unintentional shape changes from the other kind. Oh well.
 * 3.4.2: make an exception if polymorphed into a form which lacks
 * hands; that's a case where the ramifications override this doubt.
 */
function in_trouble() { /* int */
    let otmp;
    let i;

    /*
     * major troubles
     */
    if (Stoned())
        return TROUBLE_STONED;
    if (Slimed())
        return TROUBLE_SLIMED;
    if (Strangled())
        return TROUBLE_STRANGLED;
    if (u.utrap && u.utraptype == TT_LAVA)
        return TROUBLE_LAVA;
    if (Sick())
        return TROUBLE_SICK;
    if (u.uhs >= WEAK)
        return TROUBLE_STARVING;
    if (region_danger())
        return TROUBLE_REGION;
    if ((!Upolyd() || Unchanging()) && critically_low_hp(FALSE))
        return TROUBLE_HIT;
    if (ismnum(u.ulycn))
        return TROUBLE_LYCANTHROPE;
    if (near_capacity() >= EXT_ENCUMBER && AMAX(A_STR) - ABASE(A_STR) > 3)
        return TROUBLE_COLLAPSING;
    if (stuck_in_wall())
        return TROUBLE_STUCK_IN_WALL;
    if (Cursed_obj(uarmf, LEVITATION_BOOTS)
        || stuck_ring(uleft, RIN_LEVITATION)
        || stuck_ring(uright, RIN_LEVITATION))
        return TROUBLE_CURSED_LEVITATION;
    if (nohands(gy.youmonst.data) || !freehand()) {
        /* for bag/box access [cf use_container()]...
           make sure it's a case that we know how to handle;
           otherwise "fix all troubles" would get stuck in a loop */
        if (welded(uwep))
            return TROUBLE_UNUSEABLE_HANDS;
        if (Upolyd() && nohands(gy.youmonst.data)
            && (!Unchanging() || ((otmp = unchanger()) != null && otmp.cursed)))
            return TROUBLE_UNUSEABLE_HANDS;
    }
    if (Blindfolded() && ublindf.cursed)
        return TROUBLE_CURSED_BLINDFOLD;

    /*
     * minor troubles
     */
    if (Punished() || (u.utrap && u.utraptype == TT_BURIEDBALL))
        return TROUBLE_PUNISHED;
    if (Cursed_obj(uarmg, GAUNTLETS_OF_FUMBLING)
        || Cursed_obj(uarmf, FUMBLE_BOOTS))
        return TROUBLE_FUMBLING;
    if (worst_cursed_item())
        return TROUBLE_CURSED_ITEMS;
    if (u.usteed) { /* can't voluntarily dismount from a cursed saddle */
        otmp = which_armor(u.usteed, W_SADDLE);
        if (Cursed_obj(otmp, SADDLE))
            return TROUBLE_SADDLE;
    }

    if (BlindedTimeout() > 1 && !(HBlinded() & ~TIMEOUT)
        && (!u.uswallow
            || !attacktype_fordmg(u.ustuck.data, AT_ENGL, AD_BLND)))
        return TROUBLE_BLIND;
    /* deafness isn't its own trouble; healing magic cures deafness
       when it cures blindness, so do the same with trouble repair */
    if ((HDeaf() & TIMEOUT) > 1)
        return TROUBLE_BLIND;

    for (i = 0; i < A_MAX; i++)
        if (ABASE(i) < AMAX(i))
            return TROUBLE_POISONED;
    if (Wounded_legs() && !u.usteed)
        return TROUBLE_WOUNDED_LEGS;
    if (u.uhs >= HUNGRY)
        return TROUBLE_HUNGRY;
    if (HStun() & TIMEOUT)
        return TROUBLE_STUNNED;
    if (HConfusion() & TIMEOUT)
        return TROUBLE_CONFUSED;
    if (HHallucination() & TIMEOUT)
        return TROUBLE_HALLUCINATION;
    return 0;
}

/* select an item for TROUBLE_CURSED_ITEMS */
function worst_cursed_item() { /* struct obj * */
    let otmp;

    /* if strained or worse, check for loadstone first */
    if (near_capacity() >= HVY_ENCUMBER) {
        for (otmp = gi.invent; otmp; otmp = otmp.nobj)
            if (Cursed_obj(otmp, LOADSTONE))
                return otmp;
    }
    /* weapon takes precedence if it is interfering
       with taking off a ring or putting on a shield */
    if (welded(uwep) && (uright || bimanual(uwep))) { /* weapon */
        otmp = uwep;
    /* gloves come next, due to rings */
    } else if (uarmg && uarmg.cursed) { /* gloves */
        otmp = uarmg;
    /* then shield due to two handed weapons and spells */
    } else if (uarms && uarms.cursed) { /* shield */
        otmp = uarms;
    /* then cloak due to body armor */
    } else if (uarmc && uarmc.cursed) { /* cloak */
        otmp = uarmc;
    } else if (uarm && uarm.cursed) { /* suit */
        otmp = uarm;
    /* if worn helmet of opposite alignment is making you an adherent
       of the current god, he/she/it won't uncurse that for you */
    } else if (uarmh && uarmh.cursed /* helmet */
               && uarmh.otyp != HELM_OF_OPPOSITE_ALIGNMENT) {
        otmp = uarmh;
    } else if (uarmf && uarmf.cursed) { /* boots */
        otmp = uarmf;
    } else if (uarmu && uarmu.cursed) { /* shirt */
        otmp = uarmu;
    } else if (uamul && uamul.cursed) { /* amulet */
        otmp = uamul;
    } else if (uleft && uleft.cursed) { /* left ring */
        otmp = uleft;
    } else if (uright && uright.cursed) { /* right ring */
        otmp = uright;
    } else if (ublindf && ublindf.cursed) { /* eyewear */
        otmp = ublindf; /* must be non-blinding lenses */
    /* if weapon wasn't handled above, do it now */
    } else if (welded(uwep)) { /* weapon */
        otmp = uwep;
    /* active secondary weapon even though it isn't welded */
    } else if (uswapwep && uswapwep.cursed && u.twoweap) {
        otmp = uswapwep;
    /* all worn items ought to be handled by now */
    } else {
        for (otmp = gi.invent; otmp; otmp = otmp.nobj) {
            if (!otmp.cursed)
                continue;
            if (otmp.otyp == LOADSTONE || confers_luck(otmp))
                break;
        }
    }
    return otmp;
}

function fix_curse_trouble(otmp, what) { /* void */
    if (!otmp) {
        impossible(_("fix_curse_trouble: nothing to uncurse."));
        return;
    }
    if (otmp == uarmg && Glib()) {
        make_glib(0);
        Your(_("%s are no longer slippery."), gloves_simple_name(uarmg));
        if (!otmp.cursed)
            return;
    }
    if (!Blind() || (otmp == ublindf && Blindfolded_only())) {
        pline(_("%s %s."),
                what ? what : Yobjnam2(otmp, _("softly glow")),
                hcolor(NH_AMBER()));
        iflags.last_msg = PLNMSG_OBJ_GLOWS;
        otmp.bknown = +!Hallucination(); /* ok to skip set_bknown() */
    }
    uncurse(otmp);
    update_inventory();
}

function fix_worst_trouble(trouble) { /* void */
    const $frame = stack_frame(); try {
    let i, maxhp;
    let otmp = null;
    let what = 0;
    let leftglow = init_string(static_array("fix_worst_trouble.leftglow", char, sizeof_string("Your left ring softly glows")), _("Your left ring softly glows"), true),
                               rightglow = init_string(static_array("fix_worst_trouble.rightglow", char, sizeof_string("Your right ring softly glows")), _("Your right ring softly glows"), true);

    switch (trouble) {
    case TROUBLE_STONED:
        make_stoned(0, _("You feel more limber."), 0, 0);
        break;
    case TROUBLE_SLIMED:
        make_slimed(0, _("The slime disappears."));
        break;
    case TROUBLE_STRANGLED:
        if (uamul && uamul.otyp == AMULET_OF_STRANGULATION) {
            Your(_("amulet vanishes!"));
            useup(uamul);
        }
        You(_("can breathe again."));
        u.uprops[STRANGLED].intrinsic = 0;
        disp.botl = TRUE;
        break;
    case TROUBLE_LAVA:
        /* teleport should always succeed, but if not, just untrap them */
        if (!safe_teleds(TELEDS_NO_FLAGS))
            reset_utrap(TRUE);
        rescued_from_terrain(DISSOLVED); /* DISSOLVED: pending cause of death
                                          * if trouble didn't get cured */
        break;
    case TROUBLE_STARVING:
        /* temporarily lost strength recovery now handled by init_uhunger() */
        /* FALLTHROUGH */;
        /* FALLTHRU*/
    case TROUBLE_HUNGRY:
        Your(_("%s feels content."), body_part(STOMACH));
        init_uhunger();
        disp.botl = TRUE;
        break;
    case TROUBLE_SICK:
        You_feel(_("better."));
        make_sick(0, 0, FALSE, SICK_ALL);
        break;
    case TROUBLE_REGION:
        /* stinking cloud, with hero vulnerable to HP loss */
        region_safety();
        break;
    case TROUBLE_HIT:
        /* "fix all troubles" will keep trying if hero has
           5 or less hit points, so make sure they're always
           boosted to be more than that */
        You_feel(_("much better."));
        if (Upolyd()) {
            maxhp = u.mhmax + rnd(5);
            setuhpmax(max(maxhp, 5 + 1), FALSE); /* acts as setmhmax() */
            u.mh = u.mhmax;
        }
        maxhp = u.uhpmax;
        if (maxhp < u.ulevel * 5 + 11)
            maxhp += rnd(5);
        /* True: update u.uhpmax even if currently poly'd */
        setuhpmax(max(maxhp, 5 + 1), TRUE);
        u.uhp = u.uhpmax; /* setuhpmax() will do this when u.uhp is higher
                           * than u.uhpmax; prayer also does this if lower */
        disp.botl = TRUE;
        break;
    case TROUBLE_COLLAPSING:
        /* override Fixed_abil; uncurse that if feasible */
        You_feel(_("%sstronger."),
                 (AMAX(A_STR) - ABASE(A_STR) > 6) ? _("much ") : _(""));
        (chars[u.acurr.a + A_STR]) = AMAX(A_STR);
        disp.botl = TRUE;
        if (Fixed_abil()) {
            if ((otmp = stuck_ring(uleft, RIN_SUSTAIN_ABILITY)) != null) {
                if (otmp == uleft)
                    what = leftglow;
            } else if ((otmp = stuck_ring(uright, RIN_SUSTAIN_ABILITY))
                       != null) {
                if (otmp == uright)
                    what = rightglow;
            }
            if (otmp) {
                fix_curse_trouble(otmp, what);
                break;
            }
        }
        break;
    case TROUBLE_STUCK_IN_WALL:
        /* no control, but works on no-teleport levels */
        if (safe_teleds(TELEDS_NO_FLAGS)) {
            Your(_("surroundings change."));
        } else {
            /* safe_teleds() couldn't find a safe place; perhaps the
               level is completely full.  As a last resort, confer
               intrinsic wall/rock-phazing.  Hero might get stuck
               again fairly soon....
               Without something like this, fix_all_troubles can get
               stuck in an infinite loop trying to fix STUCK_IN_WALL
               and repeatedly failing. */
            set_itimeout(ref_of(u.uprops[PASSES_WALLS], "intrinsic"), (d(4, 4) + 4)); /* 8..20 */
            /* how else could you move between packed rocks or among
               lattice forming "solid" rock? */
            You_feel(_("much slimmer."));
        }
        break;
    case TROUBLE_CURSED_LEVITATION:
        if (Cursed_obj(uarmf, LEVITATION_BOOTS)) {
            otmp = uarmf;
        } else if ((otmp = stuck_ring(uleft, RIN_LEVITATION)) != null) {
            if (otmp == uleft)
                what = leftglow;
        } else if ((otmp = stuck_ring(uright, RIN_LEVITATION)) != null) {
            if (otmp == uright)
                what = rightglow;
        }
        fix_curse_trouble(otmp, what);
        break;
    case TROUBLE_UNUSEABLE_HANDS:
        if (welded(uwep)) {
            otmp = uwep;
            fix_curse_trouble(otmp, what);
            break;
        }
        if (Upolyd() && nohands(gy.youmonst.data)) {
            if (!Unchanging()) {
                Your(_("shape becomes uncertain."));
                rehumanize(); /* "You return to {normal} form." */
            } else if ((otmp = unchanger()) != null && otmp.cursed) {
                /* otmp is an amulet of unchanging */
                fix_curse_trouble(otmp, what);
                break;
            }
        }
        if (nohands(gy.youmonst.data) || !freehand())
            impossible(_("fix_worst_trouble: couldn't cure hands."));
        break;
    case TROUBLE_CURSED_BLINDFOLD:
        otmp = ublindf;
        fix_curse_trouble(otmp, what);
        break;
    case TROUBLE_LYCANTHROPE:
        you_unwere(TRUE);
        break;
    /*
     */
    case TROUBLE_PUNISHED:
        Your(_("chain disappears."));
        if (u.utrap && u.utraptype == TT_BURIEDBALL)
            buried_ball_to_freedom();
        else
            unpunish();
        break;
    case TROUBLE_FUMBLING:
        if (Cursed_obj(uarmg, GAUNTLETS_OF_FUMBLING))
            otmp = uarmg;
        else if (Cursed_obj(uarmf, FUMBLE_BOOTS))
            otmp = uarmf;
        fix_curse_trouble(otmp, what);
        break;
    case TROUBLE_CURSED_ITEMS:
        otmp = worst_cursed_item();
        if (otmp == uright)
            what = rightglow;
        else if (otmp == uleft)
            what = leftglow;
        fix_curse_trouble(otmp, what);
        break;
    case TROUBLE_POISONED:
        /* override Fixed_abil; ignore items which confer that */
        if (Hallucination())
            pline(_("There's a tiger in your tank."));
        else
            You_feel(_("in good health again."));
        for (i = 0; i < A_MAX; i++) {
            if (ABASE(i) < AMAX(i)) {
                (chars[u.acurr.a + i]) = AMAX(i);
                disp.botl = TRUE;
            }
        }
        encumber_msg();
        break;
    case TROUBLE_BLIND: { /* handles deafness as well as blindness */
        let msgbuf = stack_array(char, BUFSZ);
        let eyes = body_part(EYE);
        let cure_deaf = (HDeaf() & TIMEOUT) ? TRUE : FALSE;

        chars[msgbuf + 0] = ord('\0');
        if (Blinded()) {
            if (eyecount(gy.youmonst.data) != 1)
                eyes = makeplural(eyes);
            sprintf(msgbuf, _("Your %s %s better"), eyes, vtense(eyes, _("feel")));
            u.ucreamed = 0;
            make_blinded(0, FALSE);
        }
        if (cure_deaf) {
            make_deaf(0, FALSE);
            if (!Deaf())
                sprintf(eos(msgbuf), _("%s can hear again"), !chars[msgbuf] ? _("You") : _(" and you"))
;
        }
        if (chars[msgbuf])
            pline(_("%s."), msgbuf);
        break;
    }
    case TROUBLE_WOUNDED_LEGS:
        heal_legs(0);
        break;
    case TROUBLE_STUNNED:
        make_stunned(0, TRUE);
        break;
    case TROUBLE_CONFUSED:
        make_confused(0, TRUE);
        break;
    case TROUBLE_HALLUCINATION:
        pline(_("Looks like you are back in Kansas."));
        make_hallucinated(0, FALSE, 0);
        break;
    case TROUBLE_SADDLE:
        otmp = which_armor(u.usteed, W_SADDLE);
        if (!Blind()) {
            pline(_("%s %s."), Yobjnam2(otmp, _("softly glow")), hcolor(NH_AMBER()));
            set_bknown(otmp, 1);
        }
        uncurse(otmp);
        break;
    }
    } finally { stack_pop($frame); }
}

/* "I am sometimes shocked by... the nuns who never take a bath without
 * wearing a bathrobe all the time.  When asked why, since no man can see them,
 * they reply 'Oh, but you forget the good God'.  Apparently they conceive of
 * the Deity as a Peeping Tom, whose omnipotence enables Him to see through
 * bathroom walls, but who is foiled by bathrobes." --Bertrand Russell, 1943
 * Divine wrath, dungeon walls, and armor follow the same principle.
 */
function god_zaps_you(resp_god) { /* void */
    if (u.uswallow) {
        pline(
          _("Suddenly a bolt of lightning comes down at you from the heavens!"));
        pline(_("It strikes %s!"), mon_nam(u.ustuck));
        if (!resists_elec(u.ustuck)) {
            pline(_("%s fries to a crisp!"), Monnam(u.ustuck));
            /* Yup, you get experience.  It takes guts to successfully
             * pull off this trick on your god, anyway.
             * Other credit/blame applies (luck or alignment adjustments),
             * but not direct kill count (pacifist conduct).
             */
            xkilled(u.ustuck, XKILL_NOMSG | XKILL_NOCONDUCT);
        } else
            pline(_("%s seems unaffected."), Monnam(u.ustuck));
    } else {
        pline(_("Suddenly, a bolt of lightning strikes you!"));
        if (Reflecting()) {
            shieldeff(u.ux, u.uy);
            if (Blind())
                pline(_("For some reason you're unaffected."));
            else
                ureflects(_("%s reflects from your %s."), _("It"));
            monstseesu(M_SEEN_REFL);
        } else if (Shock_resistance()) {
            shieldeff(u.ux, u.uy);
            pline(_("It seems not to affect you."));
            monstseesu(M_SEEN_ELEC);
            monstunseesu(M_SEEN_REFL);
        } else {
            fry_by_god(resp_god, FALSE);
            monstunseesu(M_SEEN_REFL | M_SEEN_ELEC);
        }
    }

    pline(_("%s is not deterred..."), align_gname(resp_god));
    if (u.uswallow) {
        pline(_("A wide-angle disintegration beam aimed at you hits %s!"),
              mon_nam(u.ustuck));
        if (!resists_disint(u.ustuck)) {
            pline(_("%s disintegrates into a pile of dust!"), Monnam(u.ustuck));
            xkilled(u.ustuck, XKILL_NOMSG | XKILL_NOCORPSE | XKILL_NOCONDUCT);
        } else
            pline(_("%s seems unaffected."), Monnam(u.ustuck));
    } else {
        pline(_("A wide-angle disintegration beam hits you!"));

        /* disintegrate shield and body armor before disintegrating
         * the impudent mortal, like black dragon breath -3.
         */
        if (uarms && !(EReflecting() & W_ARMS)
            && !(EDisint_resistance() & W_ARMS))
            disintegrate_arm(uarms);
        if (uarmc && !(EReflecting() & W_ARMC)
            && !(EDisint_resistance() & W_ARMC))
            disintegrate_arm(uarmc);
        if (uarm && !(EReflecting() & W_ARM) && !(EDisint_resistance() & W_ARM)
            && !uarmc)
            disintegrate_arm(uarm);
        if (uarmu && !uarm && !uarmc)
            disintegrate_arm(uarmu);
        if (!Disint_resistance()) {
            fry_by_god(resp_god, TRUE);
            monstunseesu(M_SEEN_DISINT);
        } else {
            You(_("bask in its %s glow for a minute..."), NH_BLACK());
            godvoice(resp_god, _("I believe it not!"));
            monstseesu(M_SEEN_DISINT);
        }
        if (Is_astralevel(u.uz) || Is_sanctum(u.uz)) {
            /* one more try for high altars */
                  ;
            verbalize(_("Thou cannot escape my wrath, mortal!"));
            summon_minion(resp_god, FALSE);
            summon_minion(resp_god, FALSE);
            summon_minion(resp_god, FALSE);
                  ;
            verbalize(_("Destroy %s, my servants!"), uhim());
        }
    }
}

function fry_by_god(resp_god, via_disintegration) { /* void */
    You(_("%s!"), !via_disintegration ? _("fry to a crisp")
                                   : _("disintegrate into a pile of dust"));
    svk.killer.format = KILLED_BY;
    sprintf(svk.killer.name, _("the wrath of %s"), align_gname(resp_god));
    done(DIED);
}

function angrygods(resp_god) { /* void */
    let maxanger, new_ublesscnt;

    if (Inhell())
        resp_god = A_NONE;
    u.ublessed = 0; /* lose divine protection */

    /* changed from tmp = u.ugangr + abs (u.uluck) -- rph */
    /* added test for alignment diff -dlc */
    if (resp_god != u.ualign.type)
        maxanger = Math.trunc(u.ualign.record / 2) + (Luck() > 0 ? Math.trunc(-Luck() / 3) : -Luck());
    else
        maxanger = 3 * u.ugangr + ((Luck() > 0 || u.ualign.record >= STRIDENT)
                                   ? Math.trunc(-Luck() / 3)
                                   : -Luck());
    if (maxanger < 1)
        maxanger = 1; /* possible if bad align & good luck */
    else if (maxanger > 15)
        maxanger = 15; /* be reasonable */

    switch (rn2(maxanger)) {
    case 0:
    case 1:
        You_feel(_("that %s is %s."), align_gname(resp_god),
                 Hallucination() ? _("bummed") : _("displeased"));
        break;
    case 2:
    case 3:
        godvoice(resp_god, 0);
        pline(_("\"Thou %s, %s.\""),
              (ugod_is_angry() && resp_god == u.ualign.type)
                  ? _("hast strayed from the path")
                  : _("art arrogant"),
              gy.youmonst.data.mlet == S_HUMAN ? _("mortal") : _("creature"));
              ;
        verbalize(_("Thou must relearn thy lessons!"));
        adjattrib(A_WIS, -1, FALSE);
        losexp(0);
        break;
    case 6:
        if (!Punished()) {
            gods_angry(resp_god);
            punish(null);
            break;
        }
        /* FALLTHROUGH */;
        /* FALLTHRU */
    case 4:
    case 5:
        gods_angry(resp_god);
        if (!Blind() && !Antimagic())
            pline(_("%s glow surrounds you."), An(hcolor(NH_BLACK())));
        if (rn2(2) || !attrcurse())
            rndcurse();
        break;
    case 7:
    case 8:
        godvoice(resp_god, 0);
              ;
        verbalize(_("Thou durst %s me?"),
                  (on_altar() && (a_align(u.ux, u.uy) != resp_god))
                      ? _("scorn")
                      : _("call upon"));
        /* [why isn't this using verbalize()?] */
        pline(_("\"Then die, %s!\""),
              (gy.youmonst.data.mlet == S_HUMAN) ? _("mortal") : _("creature"));
        summon_minion(resp_god, FALSE);
        break;

    default:
        gods_angry(resp_god);
        god_zaps_you(resp_god);
        break;
    }
    /* even though this might not be in response to prayer, set pray timer */
    new_ublesscnt = rnz(300);
    if (new_ublesscnt > u.ublesscnt)
        u.ublesscnt = new_ublesscnt;
    return;
}

/* helper to print "str appears at your feet", or appropriate */
function at_your_feet(str) { /* void */
    if (Blind())
        str = Something();
    if (u.uswallow) {
        /* barrier between you and the floor */
        pline(_("%s %s into %s %s."), str, vtense(str, _("drop")),
              s_suffix(mon_nam(u.ustuck)), mbodypart(u.ustuck, STOMACH));
    } else {
        pline(_("%s %s %s your %s!"), str,
              vtense(str, Blind() ? _("land") : _("appear")),
              Levitation() ? _("beneath") : _("at"),
              makeplural(body_part(FOOT)));
    }
}

function gcrownu() { /* void */
    const $frame = stack_frame(); try {
    let obj;
    let what;
    let already_exists, in_hand;
    let class_gift;

    u.uprops[SEE_INVIS].intrinsic = or64(u.uprops[SEE_INVIS].intrinsic, FROMOUTSIDE);
    u.uprops[FIRE_RES].intrinsic = or64(u.uprops[FIRE_RES].intrinsic, FROMOUTSIDE);
    u.uprops[COLD_RES].intrinsic = or64(u.uprops[COLD_RES].intrinsic, FROMOUTSIDE);
    u.uprops[SHOCK_RES].intrinsic = or64(u.uprops[SHOCK_RES].intrinsic, FROMOUTSIDE);
    u.uprops[SLEEP_RES].intrinsic = or64(u.uprops[SLEEP_RES].intrinsic, FROMOUTSIDE);
    u.uprops[POISON_RES].intrinsic = or64(u.uprops[POISON_RES].intrinsic, FROMOUTSIDE);
    godvoice(u.ualign.type, 0);

    class_gift = STRANGE_OBJECT;
    /* 3.3.[01] had this in the A_NEUTRAL case,
       preventing chaotic wizards from receiving a spellbook */
    if (Role_if(PM_WIZARD)
        && !u_wield_art(ART_VORPAL_BLADE)
        && !u_wield_art(ART_STORMBRINGER)
        && !carrying(SPE_FINGER_OF_DEATH)) {
        class_gift = SPE_FINGER_OF_DEATH;
    } else if (Role_if(PM_MONK) && (!uwep || !uwep.oartifact)
               && !carrying(SPE_RESTORE_ABILITY)) {
        /* monks rarely wield a weapon */
        class_gift = SPE_RESTORE_ABILITY;
    }

    obj = ok_wep(uwep) ? uwep : null;
    already_exists = in_hand = FALSE; /* lint suppression */
    switch (u.ualign.type) {
    case A_LAWFUL:
        u.uevent.uhand_of_elbereth = 1;
              ;
        verbalize(_("I crown thee...  The Hand of Elbereth!"));
        livelog_printf(LL_DIVINEGIFT,
                       _("was crowned \"The Hand of Elbereth\" by %s"),
                       u_gname());
        break;
    case A_NEUTRAL:
        u.uevent.uhand_of_elbereth = 2;
        in_hand = u_wield_art(ART_VORPAL_BLADE);
        already_exists = exist_artifact(LONG_SWORD,
                                        artiname(ART_VORPAL_BLADE));
              ;
        verbalize(_("Thou shalt be my Envoy of Balance!"));
        livelog_printf(LL_DIVINEGIFT, _("became %s Envoy of Balance"),
                       s_suffix(u_gname()));
        break;
    case A_CHAOTIC:
        u.uevent.uhand_of_elbereth = 3;
        in_hand = u_wield_art(ART_STORMBRINGER);
        already_exists = exist_artifact(RUNESWORD,
                                        artiname(ART_STORMBRINGER));
        what = (((already_exists && !in_hand) || class_gift != STRANGE_OBJECT)
                ? _("take lives")
                : _("steal souls"));
              ;
        verbalize(_("Thou art chosen to %s for My Glory!"), what);
        livelog_printf(LL_DIVINEGIFT, _("was chosen to %s for the Glory of %s"),
                       what, u_gname());
        break;
    }

    if (objects[class_gift].oc_class == SPBOOK_CLASS) {
        let bbuf = stack_array(char, BUFSZ);

        obj = mksobj(class_gift, TRUE, FALSE);
        /* get book type before dropping (don't think that could destroy
           the book because we need to be on an altar in order to become
           crowned, but be paranoid about it) */
        strcpy(bbuf, actualoname(obj)); /* for livelog; "spellbook of <foo>"
                                         * even if hero doesn't know book */
        bless(obj);
        obj.bknown = 1; /* ok to skip set_bknown() */
        observe_object(obj);
        at_your_feet(upstart(ansimpleoname(obj)));
        dropy(obj);
        u.ugifts++;
        /* not an artifact, but treat like one for this situation;
           classify as a spoiler in case player hasn't IDed the book yet */
        livelog_printf(LL_DIVINEGIFT | LL_ARTIFACT | LL_SPOILER,
                       _("was bestowed with %s"), bbuf);

        /* when getting a new book for known spell, enhance
           currently wielded weapon rather than the book */
        if (known_spell(class_gift) != spe_Unknown && ok_wep(uwep))
            obj = uwep; /* to be blessed,&c */
    }

    switch (u.ualign.type) {
    case A_LAWFUL:
        if (class_gift != STRANGE_OBJECT) {
            ; /* already got bonus above */
        } else if (obj && obj.otyp == LONG_SWORD && !obj.oartifact) {
            let lbuf = stack_array(char, BUFSZ);

            strcpy(lbuf, simpleonames(obj)); /* before transformation */
            if (!Blind())
                Your(_("sword shines brightly for a moment."));
            obj = oname(obj, artiname(ART_EXCALIBUR),
                        ONAME_GIFT | ONAME_KNOW_ARTI);
            if (is_art(obj, ART_EXCALIBUR)) {
                u.ugifts++;
                livelog_printf(LL_DIVINEGIFT | LL_ARTIFACT,
                               _("had %s wielded %s transformed into %s"),
                               uhis(), lbuf, artiname(ART_EXCALIBUR));
            }
        }
        /* acquire Excalibur's skill regardless of weapon or gift */
        unrestrict_weapon_skill(P_LONG_SWORD);
        if (is_art(obj, ART_EXCALIBUR))
            discover_artifact(ART_EXCALIBUR);
        break;
    case A_NEUTRAL:
        if (class_gift != STRANGE_OBJECT) {
            ; /* already got bonus above */
        } else if (obj && in_hand) {
            Your(_("%s goes snicker-snack!"), xname(obj));
            observe_object(obj);
        } else if (!already_exists) {
            obj = mksobj(LONG_SWORD, FALSE, FALSE);
            obj = oname(obj, artiname(ART_VORPAL_BLADE),
                        ONAME_GIFT | ONAME_KNOW_ARTI);
            obj.spe = 1;
            at_your_feet(_("A sword"));
            dropy(obj);
            u.ugifts++;
            livelog_printf(LL_DIVINEGIFT | LL_ARTIFACT,
                           _("was bestowed with %s"),
                           artiname(ART_VORPAL_BLADE));
        }
        /* acquire Vorpal Blade's skill regardless of weapon or gift */
        unrestrict_weapon_skill(P_LONG_SWORD);
        if (is_art(obj, ART_VORPAL_BLADE))
            discover_artifact(ART_VORPAL_BLADE);
        break;
    case A_CHAOTIC: {
        let swordbuf = stack_array(char, BUFSZ);

        sprintf(swordbuf, _("%s sword"), hcolor(NH_BLACK()));
        if (class_gift != STRANGE_OBJECT) {
            ; /* already got bonus above */
        } else if (obj && in_hand) {
            Your(_("%s hums ominously!"), swordbuf);
            observe_object(obj);
        } else if (!already_exists) {
            obj = mksobj(RUNESWORD, FALSE, FALSE);
            obj = oname(obj, artiname(ART_STORMBRINGER),
                        ONAME_GIFT | ONAME_KNOW_ARTI);
            obj.spe = 1;
            at_your_feet(An(swordbuf));
            dropy(obj);
            u.ugifts++;
            livelog_printf(LL_DIVINEGIFT | LL_ARTIFACT,
                           _("was bestowed with %s"),
                           artiname(ART_STORMBRINGER));
        }
        /* acquire Stormbringer's skill regardless of weapon or gift */
        unrestrict_weapon_skill(P_BROAD_SWORD);
        if (is_art(obj, ART_STORMBRINGER))
            discover_artifact(ART_STORMBRINGER);
        break;
    }
    default:
        obj = null; /* lint */
        break;
    }

    /* enhance weapon regardless of alignment or artifact status */
    if (ok_wep(obj)) {
        bless(obj);
        obj.oeroded = obj.oeroded2 = 0;
        obj.oerodeproof = TRUE;
        obj.bknown = obj.rknown = 1; /* ok to skip set_bknown() */
        if (obj.spe < 1)
            obj.spe = 1;
        /* acquire skill in this weapon */
        unrestrict_weapon_skill(weapon_type(obj));
    } else if (class_gift == STRANGE_OBJECT) {
        /* opportunity knocked, but there was nobody home... */
        You_feel(_("unworthy."));
    }
    update_inventory();

    /* lastly, confer an extra skill slot/credit beyond the
       up-to-29 you can get from gaining experience levels */
    add_weapon_skill(1);
    return;
    } finally { stack_pop($frame); }
}
export function ok_wep(o) { return (o && (o.oclass == WEAPON_CLASS || is_weptool(o)) ? 1 : 0); }

function give_spell() { /* void */
    let otmp;
    let spe_let;
    let spe_knowledge, trycnt = u.ulevel + 1;

    /* not yet known spells and forgotten spells are given preference over
       usable ones; also, try to grant spell that hero could gain skill in
       (even though being restricted doesn't prevent learning and casting) */
    otmp = mkobj(SPBOOK_no_NOVEL, TRUE);
    while (--trycnt > 0) {
        if (otmp.otyp != SPE_BLANK_PAPER) {
            if (known_spell(otmp.otyp) <= spe_Unknown
                && !P_RESTRICTED(spell_skilltype(otmp.otyp)))
                break; /* forgotten or not yet known */
        } else {
            /* blank paper is acceptable if not discovered yet or
               if hero has a magic marker to write something on it
               (doesn't matter if marker is out of charges); it will
               become discovered (below) without needing to be read */
            if (!objects[SPE_BLANK_PAPER].oc_name_known
                || carrying(MAGIC_MARKER))
                break;
        }
        otmp.otyp = rnd_class(svb.bases[SPBOOK_CLASS], SPE_BLANK_PAPER);
    }
    /*
     * 25% chance of learning the spell directly instead of
     * receiving the book for it, unless it's already well known.
     * The chance is not influenced by whether hero is illiterate.
     */
    if (otmp.otyp != SPE_BLANK_PAPER && !rn2(4)
        && (spe_knowledge = known_spell(otmp.otyp)) != spe_Fresh) {
        /* force_learn_spell() should only return '\0' if the book
           is blank paper or the spell is known and has retention
           of spe_Fresh, so no 'else' case is needed here */
        if ((spe_let = force_learn_spell(otmp.otyp)) != ord('\0')) {
            /* for spellbook class, OBJ_NAME() yields the name of
               the spell rather than "spellbook of <spell-name>" */
            let spe_name = OBJ_NAME(objects[otmp.otyp]);

            if (spe_knowledge == spe_Unknown) /* prior to learning */
                /* appending "spell 'a'" seems slightly silly but
                   is similar to "added to your repertoire, as 'a'"
                   and without any spellbook on hand a novice player
                   might not recognize that 'spe_name' is a spell */
                pline(_("Divine knowledge of %s fills your mind!  Spell '%c'."),
                      spe_name, spe_let);
            else
                Your(_("knowledge of spell '%c' - %s is %s."),
                     spe_let, spe_name,
                     (spe_knowledge == spe_Forgotten) ? _("restored")
                                                      : _("refreshed"));
        }
        obfree(otmp, null); /* discard the book */
    } else {
        observe_object(otmp);
        /* don't set bknown */
        /* discovering blank paper will make it less likely to
           be given again; small chance to arbitrarily discover
           some other book type without having to read it first */
        if (otmp.otyp == SPE_BLANK_PAPER || !rn2(100))
            makeknown(otmp.otyp);
        bless(otmp);
        at_your_feet(upstart(ansimpleoname(otmp)));
        place_object(otmp, u.ux, u.uy);
        newsym(u.ux, u.uy);
    }
    return;
}

function pleased(g_align) { /* void */
    const $frame = stack_frame(); try {
    /* don't use p_trouble, worst trouble may get fixed while praying */
    let trouble = in_trouble(); /* what's your worst difficulty? */
    let pat_on_head = 0, kick_on_butt;

    You_feel(_("that %s is %s."), align_gname(g_align),
             (u.ualign.record >= DEVOUT)
                 ? Hallucination() ? _("pleased as punch") : _("well-pleased")
                 : (u.ualign.record >= STRIDENT)
                       ? Hallucination() ? _("ticklish") : _("pleased")
                       : Hallucination() ? _("full") : _("satisfied"));

    /* not your deity */
    if (on_altar() && gp.p_aligntyp != u.ualign.type) {
        adjalign(-1);
        return;
    } else if (u.ualign.record < 2 && trouble <= 0)
        adjalign(1);

    /*
     * Depending on your luck & align level, the god you prayed to will:
     *  - fix your worst problem if it's major;
     *  - fix all your major problems;
     *  - fix your worst problem if it's minor;
     *  - fix all of your problems;
     *  - do you a gratuitous favor.
     *
     * If you make it to the last category, you roll randomly again
     * to see what they do for you.
     *
     * If your luck is at least 0, then you are guaranteed rescued from
     * your worst major problem.
     */
    if (!trouble && u.ualign.record >= DEVOUT) {
        /* if hero was in trouble, but got better, no special favor */
        if (gp.p_trouble == 0)
            pat_on_head = 1;
    } else {
        let action, prayer_luck;
        let tryct = 0;

        /* Negative luck is normally impossible here (can_pray() forces
           prayer failure in that situation), but it's possible for
           Luck to drop during the period of prayer occupation and
           become negative by the time we get here.  [Reported case
           was lawful character whose stinking cloud caused a delayed
           killing of a peaceful human, triggering the "murderer"
           penalty while successful prayer was in progress.  It could
           also happen due to inconvenient timing on Friday 13th, but
           the magnitude there (-1) isn't big enough to cause trouble.]
           We don't bother remembering start-of-prayer luck, just make
           sure it's at least -1 so that Luck+2 is big enough to avoid
           a divide by zero crash when generating a random number.  */
        prayer_luck = max(Luck(), -1); /* => (prayer_luck + 2 > 0) */
        action = rn1(prayer_luck + (on_altar() ? 3 + on_shrine() : 2), 1);
        if (!on_altar())
            action = min(action, 3);
        if (u.ualign.record < STRIDENT)
            action = (u.ualign.record > 0 || !rnl(2)) ? 1 : 0;

        switch (min(action, 5)) {
        case 5:
            pat_on_head = 1;
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 4:
            do
                fix_worst_trouble(trouble);
            while ((trouble = in_trouble()) != 0);
            break;

        case 3:
            /* up to 10 troubles */
            fix_worst_trouble(trouble);
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 2:
            /* up to 9 troubles */
            while ((trouble = in_trouble()) > 0 && (++tryct < 10))
                fix_worst_trouble(trouble);
            break;

        case 1:
            if (trouble > 0)
                fix_worst_trouble(trouble);
            break;
        case 0:
            break; /* your god blows you off, too bad */
        }
    }

    /* note: can't get pat_on_head unless all troubles have just been
       fixed or there were no troubles to begin with; hallucination
       won't be in effect so special handling for it is superfluous */
    if (pat_on_head)
        switch (rn2((Luck() + 6) >> 1)) {
        case 0:
            break;
        case 1:
            if (uwep && (welded(uwep) || uwep.oclass == WEAPON_CLASS
                         || is_weptool(uwep))) {
                let repair_buf = stack_array(char, BUFSZ);

                chars[repair_buf] = ord('\0');
                if (uwep.oeroded || uwep.oeroded2)
                    sprintf(repair_buf, _(" and %s now as good as new"), otense(uwep, _("are")))
;

                if (uwep.cursed) {
                    if (!Blind()) {
                        pline(_("%s %s%s."), Yobjnam2(uwep, _("softly glow")),
                              hcolor(NH_AMBER()), repair_buf);
                        iflags.last_msg = PLNMSG_OBJ_GLOWS;
                    } else
                        You_feel(_("the power of %s over %s."), u_gname(),
                                 yname(uwep));
                    uncurse(uwep);
                    uwep.bknown = 1; /* ok to bypass set_bknown() */
                    chars[repair_buf] = ord('\0');
                } else if (!uwep.blessed) {
                    if (!Blind()) {
                        pline(_("%s with %s aura%s."),
                              Yobjnam2(uwep, _("softly glow")),
                              an(hcolor(NH_LIGHT_BLUE())), repair_buf);
                        iflags.last_msg = PLNMSG_OBJ_GLOWS;
                    } else
                        You_feel(_("the blessing of %s over %s."), u_gname(),
                                 yname(uwep));
                    bless(uwep);
                    uwep.bknown = 1; /* ok to bypass set_bknown() */
                    chars[repair_buf] = ord('\0');
                }

                /* fix any rust/burn/rot damage, but don't protect
                   against future damage */
                if (uwep.oeroded || uwep.oeroded2) {
                    uwep.oeroded = uwep.oeroded2 = 0;
                    /* only give this message if we didn't just bless
                       or uncurse (which has already given a message) */
                    if (chars[repair_buf])
                        pline(_("%s as good as new!"),
                              Yobjnam2(uwep, Blind() ? _("feel") : _("look")));
                }
                update_inventory();
            }
            break;
        case 3:
            /* takes 2 hints to get the music to enter the stronghold;
               skip if you've solved it via mastermind or destroyed the
               drawbridge (both set uopened_dbridge) or if you've already
               travelled past the Valley of the Dead (gehennom_entered) */
            if (!u.uevent.uopened_dbridge && !u.uevent.gehennom_entered) {
                if (u.uevent.uheard_tune < 1) {
                    godvoice(g_align, 0);
                          ;
                    verbalize(_("Hark, %s!"), is_human(gy.youmonst.data)
                                               ? _("mortal")
                                               : _("creature"));
                          ;
                    verbalize(
                       _("To enter the castle, thou must play the right tune!"));
                    u.uevent.uheard_tune++;
                    break;
                } else if (u.uevent.uheard_tune < 2) {
                     ;
                    You_hear(_("a divine music..."));
                    pline(_("It sounds like:  \"%s\"."), svt.tune);
                    u.uevent.uheard_tune++;
                    record_achievement(ACH_TUNE);
                    break;
                }
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 2:
            if (!Blind())
                You(_("are surrounded by %s glow."), an(hcolor(NH_GOLDEN())));
            /* if any levels have been lost (and not yet regained),
               treat this effect like blessed full healing */
            if (u.ulevel < u.ulevelmax) {
                u.ulevelmax -= 1; /* see potion.c */
                pluslvl(FALSE);
            } else {
                u.uhpmax += 5;
                if (u.uhpmax > u.uhppeak)
                    u.uhppeak = u.uhpmax;
                if (Upolyd())
                    u.mhmax += 5;
            }
            u.uhp = u.uhpmax;
            if (Upolyd())
                u.mh = u.mhmax;
            if (ABASE(A_STR) < AMAX(A_STR)) {
                (chars[u.acurr.a + A_STR]) = AMAX(A_STR);
                disp.botl = TRUE; /* before potential message */
                encumber_msg();
            }
            if (u.uhunger < 900)
                init_uhunger();
            /* luck couldn't have been negative at start of prayer because
               the prayer would have failed, but might have been decremented
               due to a timed event (delayed death of peaceful monster hit
               by hero-created stinking cloud) during the praying interval */
            if (u.uluck < 0)
                u.uluck = 0;
            /* superfluous; if hero was blinded we'd be handling trouble
               rather than issuing a pat-on-head */
            u.ucreamed = 0;
            make_blinded(0, TRUE);
            disp.botl = TRUE;
            break;
        case 4: {
            let otmp, nextobj;
            let any = 0;

            if (Blind())
                You_feel(_("the power of %s."), u_gname());
            else
                You(_("are surrounded by %s aura."), an(hcolor(NH_LIGHT_BLUE())));
            for (otmp = gi.invent; otmp; otmp = nextobj) {
                nextobj = otmp.nobj;
                if (otmp.cursed
                    && (otmp != uarmh /* [see worst_cursed_item()] */
                        || uarmh.otyp != HELM_OF_OPPOSITE_ALIGNMENT)) {
                    if (!Blind()) {
                        pline(_("%s %s."), Yobjnam2(otmp, _("softly glow")),
                              hcolor(NH_AMBER()));
                        iflags.last_msg = PLNMSG_OBJ_GLOWS;
                        otmp.bknown = 1; /* ok to bypass set_bknown() */
                        ++any;
                    }
                    uncurse(otmp);
                }
            }
            if (any)
                update_inventory();
            break;
        }
        case 5: {
            let msg = init_string(static_array("pleased.msg", char, sizeof_string("\"and thus I grant thee the gift of %s!\"")), _("\"and thus I grant thee the gift of %s!\""), true);

            godvoice(u.ualign.type,
                     _("Thou hast pleased me with thy progress,"));
            if (!(HTelepat() & INTRINSIC)) {
                u.uprops[TELEPAT].intrinsic = or64(u.uprops[TELEPAT].intrinsic, FROMOUTSIDE);
                pline(msg, _("Telepathy"));
                if (Blind())
                    see_monsters();
            } else if (!(HFast() & INTRINSIC)) {
                u.uprops[FAST].intrinsic = or64(u.uprops[FAST].intrinsic, FROMOUTSIDE);
                pline(msg, _("Speed"));
            } else if (!(HStealth() & INTRINSIC)) {
                u.uprops[STEALTH].intrinsic = or64(u.uprops[STEALTH].intrinsic, FROMOUTSIDE);
                pline(msg, _("Stealth"));
            } else {
                if (!(HProtection() & INTRINSIC)) {
                    u.uprops[PROTECTION].intrinsic = or64(u.uprops[PROTECTION].intrinsic, FROMOUTSIDE);
                    if (!u.ublessed)
                        u.ublessed = rn1(3, 2);
                } else
                    u.ublessed++;
                pline(msg, _("my protection"));
            }
                  ;
            verbalize(_("Use it wisely in my name!"));
            break;
        }
        case 7:
        case 8:
            if (u.ualign.record >= PIOUS && !u.uevent.uhand_of_elbereth) {
                gcrownu();
                break;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 6:
            give_spell();
            break;
        default:
            impossible(_("Confused deity!"));
            break;
        }

    u.ublesscnt = rnz(350);
    kick_on_butt = u.uevent.udemigod ? 1 : 0;
    if (u.uevent.uhand_of_elbereth)
        kick_on_butt++;
    if (kick_on_butt)
        u.ublesscnt += kick_on_butt * rnz(1000);

    /* Avoid games that go into infinite loops of copy-pasted commands
       with no human interaction; this is a DoS vector against the
       computer running NetHack.  Once the turn counter is over 100000,
       every additional 100 turns increases the prayer timeout by 1,
       thus eventually hunger prayers will fail and some other source
       of nutrition will be required.  The increase gets throttled if
       it ever reaches 32K so that configurations using 16-bit ints are
       still viable. */
    if (svm.moves > 100000) {
        let incr = Math.trunc((svm.moves - 100000) / 100),
             largest_ublesscnt_incr = (LARGEST_INT - u.ublesscnt);

        if (incr > largest_ublesscnt_incr)
            incr = largest_ublesscnt_incr;
        u.ublesscnt += int(incr);
    }

    return;
    } finally { stack_pop($frame); }
}

/* either blesses or curses water on the altar,
 * returns true if it found any water here.
 */
function water_prayer(bless_water) { /* boolean */
    let otmp;
    let changed = 0;
    let other = FALSE, bc_known = +!(Blind() || Hallucination());

    for (otmp = svl.level.objects[u.ux][u.uy]; otmp; otmp = otmp.v.v_nexthere) {
        /* turn water into (un)holy water */
        if (otmp.otyp == POT_WATER
            && (bless_water ? !otmp.blessed : !otmp.cursed)) {
            otmp.blessed = unsigned(bless_water);
            otmp.cursed = +!bless_water;
            otmp.bknown = unsigned(bc_known); /* ok to bypass set_bknown() */
            changed += otmp.quan;
        } else if (otmp.oclass == POTION_CLASS)
            other = TRUE;
    }
    if (!Blind() && changed) {
        pline(_("%s potion%s on the altar glow%s %s for a moment."),
              ((other && changed > 1) ? _("Some of the")
                                       : (other ? _("One of the") : _("The"))),
              ((other || changed > 1) ? _("s") : _("")), (changed > 1 ? _("") : _("s")),
              (bless_water ? hcolor(NH_LIGHT_BLUE()) : hcolor(NH_BLACK())));
    }
    return (+(changed > 0));
}

function godvoice(g_align, words) { /* void */
    let quot = _("");

    if (words)
        quot = _("\"");
    else
        words = _("");

    pline_The(_("voice of %s %s: %s%s%s"), align_gname(g_align),
              ROLL_FROM(godvoices), quot, words, quot);
}

function gods_angry(g_align) { /* void */
    godvoice(g_align, _("Thou hast angered me."));
}

/* The g_align god is upset with you. */
function gods_upset(g_align) { /* void */
    if (g_align == u.ualign.type)
        u.ugangr++;
    else if (u.ugangr)
        u.ugangr--;
    angrygods(g_align);
}

function consume_offering(otmp) { /* void */
    if (Hallucination())
        switch (rn2(3)) {
        case 0:
            Your(_("sacrifice sprouts wings and a propeller and roars away!"));
            break;
        case 1:
            Your(_("sacrifice puffs up, swelling bigger and bigger, and pops!"));
            break;
        case 2:
            Your(
     _("sacrifice collapses into a cloud of dancing particles and fades away!"));
            break;
        }
    else if (Blind() && u.ualign.type == A_LAWFUL)
        Your(_("sacrifice disappears!"));
    else
        Your(_("sacrifice is consumed in a %s!"),
             (u.ualign.type == A_LAWFUL)
                ? _("flash of light")
                : (u.ualign.type == A_NEUTRAL)
                    ? _("plume of smoke")
                    : _("burst of flame"));
    if (carried(otmp))
        useup(otmp);
    else
        useupf(otmp, 1);
    exercise(A_WIS, TRUE);
}

/* feedback when attempting to offer the Amulet on a "low altar" (not one of
   the high altars in the temples on the Astral Plane or Moloch's Sanctum) */
function offer_too_soon(altaralign) { /* void */
    if (altaralign == A_NONE && Inhell()) {
        /* offering on an unaligned altar in Gehennom;
           hero has left Moloch's Sanctum (caller handles that)
           so is in the process of getting away with the Amulet;
           for any unaligned altar outside of Gehennom, give the
           "you feel ashamed" feedback for wrong alignment below */
        gods_upset(A_NONE); /* Moloch becomes angry */
        return;
    }
    You_feel(_("%s."), Hallucination()
                    ? _("homesick")
                    /* if on track, give a big hint */
                    : (altaralign == u.ualign.type)
                        ? _("an urge to return to the surface")
                        /* else headed towards celestial disgrace */
                        : _("ashamed"));
}

export function desecrate_altar(highaltar, altaralign) { /* void */
    const $frame = stack_frame(); try {
    let gvbuf = stack_array(char, BUFSZ);

    /*
     * REAL BAD NEWS!!! High altars cannot be converted.  Even an attempt
     * gets the god who owns it truly pissed off.  The same effect for
     * deliberately destroying a normal altar.
     */
    /* if you did this to your own altar, your god will hold a grudge... */
    if (altaralign == u.ualign.type) {
        adjalign(-20);
        u.ugangr += 5;
    }
    You_feel(_("the air around you grow charged..."));
    pline(_("Suddenly, you realize that %s has noticed you..."),
          align_gname(altaralign));
    sprintf(gvbuf, _("So, mortal!  You dare desecrate my %s!"), highaltar ? _("High Temple") : _("altar"))
;
    godvoice(altaralign, gvbuf);
    /* Throw everything we have at the player */
    god_zaps_you(altaralign);
    } finally { stack_pop($frame); }
}

/* offering the Amulet on a high altar (checked by caller) ends the game;
   we don't declare this 'NORETURN' because done() can return (if called
   with some reasons other than ASCENDED and ESCAPED) */
function offer_real_amulet(otmp, altaralign) { /* void */
    let cloud_of_smoke = init_string(static_array("offer_real_amulet.cloud_of_smoke", char, sizeof_string("A cloud of %s smoke surrounds you...")), _("A cloud of %s smoke surrounds you..."), true);

    /* The final Test.  Did you win? */
    if (uamul == otmp)
        Amulet_off();
    if (carried(otmp))
        useup(otmp); /* well, it's gone now */
    else
        useupf(otmp, 1);

    You(_("offer the Amulet of Yendor to %s..."), a_gname());

    if (altaralign == A_NONE) {
        /* Moloch's high altar at the bottom of Gehennom. */
        if (u.ualign.record > -99)
            u.ualign.record = -99;
        pline(_("An invisible choir chants, and you are bathed in darkness..."));
        /*[apparently shrug/snarl can be sensed without being seen]*/
        pline(_("%s shrugs and retains dominion over %s,"), Moloch[0], u_gname());
        pline(_("then mercilessly snuffs out your life."));
        sprintf(svk.killer.name, _("%s indifference"), s_suffix(Moloch[0]));
        svk.killer.format = KILLED_BY;
        done(DIED);
        /* life-saved (or declined to die in wizard/explore mode) */
        pline(_("%s snarls and tries again..."), Moloch[0]);
        fry_by_god(A_NONE, TRUE); /* wrath of Moloch */
        /* declined to die in wizard or explore mode */
        pline(cloud_of_smoke, hcolor(NH_BLACK()));
        done(ESCAPED);
        /*NOTREACHED*/
    } else if (u.ualign.type != altaralign) {
        /* And the opposing team picks you up and carries you off
           on their shoulders. */
        adjalign(-99);
        pline(_("%s accepts your gift, and gains dominion over %s..."),
              a_gname(), u_gname());
        pline(_("%s is enraged..."), u_gname());
        pline(_("Fortunately, %s permits you to live..."), a_gname());
        pline(cloud_of_smoke, hcolor(NH_ORANGE()));
        done(ESCAPED);
        /*NOTREACHED*/
    } else {
        /* You've won the game!  Feedback-wise, it's a bit of a let down. */
        u.uevent.ascended = 1;
        adjalign(10);
        pline(_("An invisible choir sings, and you are bathed in radiance..."));
        godvoice(altaralign, _("Mortal, thou hast done well!"));
        display_nhwindow()(WIN_MESSAGE, FALSE);
              ;
        verbalize(
          _("In return for thy service, I grant thee the gift of Immortality!"));
        You(_("ascend to the status of Demigod%s..."),
            flags.female ? _("dess") : _(""));
        done(ASCENDED);
        /*NOTREACHED*/
    }
    /*NOTREACHED*/
}

function offer_negative_valued(highaltar, altaralign) { /* void */
    if (altaralign != u.ualign.type && highaltar) {
        desecrate_altar(highaltar, altaralign);
    } else {
        gods_upset(altaralign);
    }
}

function offer_fake_amulet(
    otmp,
    highaltar,
    altaralign) { /* void */
    if (!highaltar && !otmp.known) {
        offer_too_soon(altaralign);
        return;
    }
     ;
    You_hear(_("a nearby thunderclap."));
    if (!otmp.known) {
        You(_("realize you have made a %s."),
            Hallucination() ? _("boo-boo") : _("mistake"));
        otmp.known = TRUE;
        change_luck(-1);
    } else {
        /* don't you dare try to fool the gods */
        if (Deaf())
            pline(_("Oh, no.")); /* didn't hear thunderclap */
        change_luck(-3);
        adjalign(-1);
        u.ugangr += 3;
        offer_negative_valued(highaltar, altaralign);
    }
}

/* possibly convert an altar's alignment or the hero's alignment */
function offer_different_alignment_altar(
    otmp,
    altaralign) { /* void */
    /* Is this a conversion ? */
    /* An unaligned altar in Gehennom will always elicit rejection. */
    if (ugod_is_angry() || (altaralign == A_NONE && Inhell())) {
        if (chars[u.ualignbase + A_CURRENT] == chars[u.ualignbase + A_ORIGINAL]
            && altaralign != A_NONE) {
            You(_("have a strong feeling that %s is angry..."), u_gname());
            consume_offering(otmp);
            pline(_("%s accepts your allegiance."), a_gname());

            uchangealign(altaralign, A_CG_CONVERT);
            /* Beware, Conversion is costly */
            change_luck(-3);
            u.ublesscnt += 300;
        } else {
            u.ugangr += 3;
            adjalign(-5);
            pline(_("%s rejects your sacrifice!"), a_gname());
            godvoice(altaralign, _("Suffer, infidel!"));
            change_luck(-5);
            adjattrib(A_WIS, -2, TRUE);
            if (!Inhell())
                angrygods(u.ualign.type);
        }
    } else {
        consume_offering(otmp);
        You(_("sense a conflict between %s and %s."), u_gname(), a_gname());
        if (rn2(8 + u.ulevel) > 5) {
            let pri;
            let shrine;

            You_feel(_("the power of %s increase."), u_gname());
            exercise(A_WIS, TRUE);
            change_luck(1);
            shrine = on_shrine();
            levl()[u.ux][u.uy].flags = Align2amask(u.ualign.type);
            if (shrine)
                levl()[u.ux][u.uy].flags |= AM_SHRINE;
            newsym(u.ux, u.uy); /* in case Invisible to self */
            if (!Blind())
                pline_The(_("altar glows %s."),
                          hcolor((u.ualign.type == A_LAWFUL) ? NH_WHITE()
                                 : u.ualign.type ? NH_BLACK()
                                   : _("gray")));

            if (rnl(u.ulevel) > 6 && u.ualign.record > 0
                && rnd(u.ualign.record) > Math.trunc((3 * ALIGNLIM()) / 4))
                summon_minion(altaralign, TRUE);
            /* anger priest; test handles bones files */
            if ((pri = findpriest(temple_occupied(u.urooms)))
                && !p_coaligned(pri))
                angry_priest();
        } else {
            pline(_("Unluckily, you feel the power of %s decrease."), u_gname());
            change_luck(-1);
            exercise(A_WIS, FALSE);
            if (rnl(u.ulevel) > 6 && u.ualign.record > 0
                && rnd(u.ualign.record) > Math.trunc((7 * ALIGNLIM()) / 8))
                summon_minion(altaralign, TRUE);
        }
    }
}

function sacrifice_your_race(
    otmp,
    highaltar,
    altaralign) { /* void */
    const $frame = stack_frame(); try {
    let pm;

    if (is_demon(gy.youmonst.data)) {
        You(_("find the idea very satisfying."));
        exercise(A_WIS, TRUE);
    } else if (u.ualign.type != A_CHAOTIC) {
        pline(_("You'll regret this infamous offense!"));
        exercise(A_WIS, FALSE);
    }

    if (highaltar
        && (altaralign != A_CHAOTIC || u.ualign.type != A_CHAOTIC)) {
        desecrate_altar(highaltar, altaralign);
        return;
    } else if (altaralign != A_CHAOTIC && altaralign != A_NONE) {
        /* curse the lawful/neutral altar */
        pline_The(_("altar is stained with %s blood."), gu.urace.adj);
        levl()[u.ux][u.uy].flags = AM_CHAOTIC;
        newsym(u.ux, u.uy); /* in case Invisible to self */
        angry_priest();
    } else {
        let dmon;
        let demonless_msg;

        /* Human sacrifice on a chaotic or unaligned altar */
        /* is equivalent to demon summoning */
        if (altaralign == A_CHAOTIC && u.ualign.type != A_CHAOTIC) {
            pline(
            _("The blood floods the altar, which vanishes in %s cloud!"),
                    an(hcolor(NH_BLACK())));
            levl()[u.ux][u.uy].typ = ROOM;
            levl()[u.ux][u.uy].flags = 0;
            newsym(u.ux, u.uy);
            angry_priest();
            demonless_msg = _("cloud dissipates");
        } else {
            /* either you're chaotic or altar is Moloch's or both */
            pline_The(_("blood covers the altar!"));
            change_luck(altaralign == A_NONE ? -2 : 2);
            demonless_msg = _("blood coagulates");
        }
        if ((pm = dlord(altaralign)) != NON_PM
            && (dmon = makemon(mons[pm], u.ux, u.uy, MM_NOMSG))
                    != null) {
            let dbuf = stack_array(char, BUFSZ);

            strcpy(dbuf, a_monnam(dmon));
            if (!strncmpi((dbuf), _(("it")), -1))
                strcpy(dbuf, _("something dreadful"));
            else
                dmon.mstrategy = and64u(dmon.mstrategy, not64u(STRAT_APPEARMSG));
            You(_("have summoned %s!"), dbuf);
            if (sgn(u.ualign.type) == sgn(dmon.data.maligntyp))
                dmon.mpeaceful = TRUE;
            You(_("are terrified, and unable to move."));
            nomul(-3);
            gm.multi_reason = _("being terrified of a demon");
            gn.nomovemsg = 0;
        } else
            pline_The(_("%s."), demonless_msg);
    }

    if (u.ualign.type != A_CHAOTIC) {
        adjalign(-5);
        u.ugangr += 3;
        adjattrib(A_WIS, -1, TRUE);
        if (!Inhell())
            angrygods(u.ualign.type);
        change_luck(-5);
    } else
        adjalign(5);
    if (carried(otmp))
        useup(otmp);
    else
        useupf(otmp, 1);
    } finally { stack_pop($frame); }
}

function bestow_artifact(max_giftvalue) { /* int */
    const $frame = stack_frame(); try {
    let nartifacts = nartifact_exist();
    let do_bestow = +(u.ulevel > 2 && u.uluck >= 0);
    if (do_bestow) {
        /* you were already in pretty good standing */
        /* The player can gain an artifact */
        /* The chance goes down as the number of artifacts goes up */
        if (wizard())
            do_bestow = +(y_n(_("Gift an artifact?")) == ord('y'));
        else
            do_bestow = +!rn2(6 + (2 * u.ugifts * nartifacts));
    }

    if (do_bestow) {
        let otmp;
        /* mk_artifact() with NULL obj and a_align() arg can return NULL */
        otmp = mk_artifact(null, a_align(u.ux, u.uy),
                           max_giftvalue, TRUE);
        if (otmp) {
            let buf = stack_array(char, BUFSZ);

            artifact_origin(otmp, ONAME_GIFT | ONAME_KNOW_ARTI);
            if (otmp.spe < 0)
                otmp.spe = 0;
            if (otmp.cursed)
                uncurse(otmp);
            otmp.oerodeproof = TRUE;
            strcpy(buf, (Hallucination() ? _("a doodad")
                            : Blind() ? _("an object")
                            : ansimpleoname(otmp)));
            if (!Blind())
                sprintf(eos(buf), _(" named %s"), bare_artifactname(otmp))
;
            at_your_feet(upstart(buf));
            dropy(otmp);
            godvoice(u.ualign.type, _("Use my gift wisely!"));
            u.ugifts++;
            u.ublesscnt = rnz(300 + (50 * nartifacts));
            exercise(A_WIS, TRUE);
            livelog_printf (LL_DIVINEGIFT | LL_ARTIFACT,
                            _("was bestowed with %s by %s"),
                            artiname(otmp.oartifact),
                            align_gname(u.ualign.type));
            /* make sure we can use this weapon */
            unrestrict_weapon_skill(weapon_type(otmp));
            if (!Hallucination() && !Blind()) {
                observe_object(otmp);
                makeknown(otmp.otyp);
                discover_artifact(otmp.oartifact);
            }
            return TRUE;
        }
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

function sacrifice_value(otmp) { /* int */
    let value = 0;

    if (otmp.corpsenm == PM_ACID_BLOB
        || (svm.moves <= peek_at_iced_corpse_age(otmp) + 50)) {
        value = mons[otmp.corpsenm].difficulty + 1;
        if (otmp.oeaten)
            value = eaten_stat(value, otmp);
    }
    return value;
}

/* the #offer command - sacrifice something to the gods */
export function dosacrifice() { /* int */
    let otmp;
    let highaltar;
    let altaralign = a_align(u.ux, u.uy);

    if (!on_altar() || u.uswallow) {
        You(_("are not %s an altar."),
            (Levitation() || Flying()) ? _("over") : _("on"));
        return ECMD_OK;
    } else if (Confusion() || Stunned()) {
        You(_("are too impaired to perform the rite."));
        return ECMD_OK;
    }
    highaltar = (levl()[u.ux][u.uy].flags & AM_SANCTUM);

    otmp = floorfood(_("sacrifice"), 1);
    if (!otmp)
        return ECMD_OK;

    if (otmp.otyp == AMULET_OF_YENDOR) {
        if (!highaltar) {
            offer_too_soon(altaralign);
            return ECMD_TIME;
        } else {
            offer_real_amulet(otmp, altaralign);
            /*NOTREACHED*/
        }
    } /* real Amulet */

    if (otmp.otyp == FAKE_AMULET_OF_YENDOR) {
        offer_fake_amulet(otmp, highaltar, altaralign);
        return ECMD_TIME;
    } /* fake Amulet */

    if (otmp.otyp == CORPSE) {
        offer_corpse(otmp, highaltar, altaralign);
        return ECMD_TIME;
    }

    pline1(nothing_happens());
    return ECMD_TIME;
}

function eval_offering(otmp, altaralign) { /* int */
    let ptr;
    let value;

    value = sacrifice_value(otmp);

    if (!value)
        return 0;

    ptr = mons[otmp.corpsenm];

    if (is_undead(ptr)) { /* Not demons--no demon corpses */
        /* most undead that leave a corpse yield 'human' (or other race)
           corpse so won't get here; the exception is wraith; give the
           bonus for wraith to chaotics too because they are sacrificing
           something valuable (unless hero refuses to eat such things) */
        if (u.ualign.type != A_CHAOTIC
            /* reaching this side of the 'or' means hero is chaotic */
            || (ptr == mons[PM_WRAITH] && u.uconduct.unvegetarian))
            value += 1;
    } else if (is_unicorn(ptr)) {
        let unicalign = sgn(ptr.maligntyp);

        if (unicalign == altaralign) {
            /* When same as altar, always a very bad action.
             */
            pline(_("Such an action is an insult to %s!"),
                  (unicalign == A_CHAOTIC) ? _("chaos")
                     : unicalign ? _("law") : _("balance"));
            adjattrib(A_WIS, -1, TRUE);
            return -1;
        } else if (u.ualign.type == altaralign) {
            /* When different from altar, and altar is same as yours,
             * it's a very good action.
             */
            if (u.ualign.record < ALIGNLIM())
                You_feel(_("appropriately %s."), align_str(u.ualign.type));
            else
                You_feel(_("you are thoroughly on the right path."));
            adjalign(5);
            value += 3;
        } else if (unicalign == u.ualign.type) {
            /* When sacrificing unicorn of your alignment to altar not of
             * your alignment, your god gets angry and it's a conversion.
             */
            u.ualign.record = -1;
            value = 1;
        } else {
            /* Otherwise, unicorn's alignment is different from yours
             * and different from the altar's.  It's an ordinary (well,
             * with a bonus) sacrifice on a cross-aligned altar.
             */
            value += 3;
        }
    }
    return value;
}

function offer_corpse(otmp, highaltar, altaralign) { /* void */
    let value;
    let ptr;
    let mtmp;

    /*
     * Was based on nutritional value and aging behavior (< 50 moves).
     * Sacrificing a food ration got you max luck instantly, making the
     * gods as easy to please as an angry dog!
     *
     * Now only accepts corpses, based on the game's evaluation of their
     * toughness.  Human and pet sacrifice, as well as sacrificing unicorns
     * of your alignment, is strongly discouraged.
     */

    /* KMH, conduct */
    if (!u.uconduct.gnostic++)
        livelog_printf(LL_CONDUCT, _("rejected atheism" +
                                   " by offering %s on an altar of %s"),
                       corpse_xname(otmp, 0, CXN_ARTICLE),
                       a_gname());

    /* you're handling this corpse, even if it was killed upon the altar
     */
    feel_cockatrice(otmp, TRUE);
    if (rider_corpse_revival(otmp, FALSE))
        return;

    ptr = mons[otmp.corpsenm];

    /* same race or former pet results apply even if the corpse is
       too old (value==0) */
    if (your_race(ptr)) {
        sacrifice_your_race(otmp, highaltar, altaralign);
        return;
    }
    if (has_omonst(otmp)
               && (mtmp = get_mtraits(otmp, FALSE)) != null
               && mtmp.mtame) {
            /* mtmp is a temporary pointer to a tame monster's attributes,
             * not a real monster */
        pline(_("So this is how you repay loyalty?"));
        adjalign(-3);
        u.uprops[AGGRAVATE_MONSTER].intrinsic = or64(u.uprops[AGGRAVATE_MONSTER].intrinsic, FROMOUTSIDE);
        offer_negative_valued(highaltar, altaralign);
        return;
    }

    value = eval_offering(otmp, altaralign);
    if (value == 0) {
        /* too old; don't give undead or unicorn bonus or penalty */
        pline1(nothing_happens());
        return;
    }
    if (value < 0) {
        offer_negative_valued(highaltar, altaralign);
        return;
    }

    if (altaralign != u.ualign.type && highaltar) {
        desecrate_altar(highaltar, altaralign);
        return;
    }
    if (u.ualign.type != altaralign) {
        /* Sacrificing at an altar of a different alignment */
        offer_different_alignment_altar(otmp, altaralign);
        return;
    }
    consume_offering(otmp);
    /* OK, you get brownie points. */
    if (u.ugangr) {
        let saved_anger = u.ugangr;
        u.ugangr -= Math.trunc((value * (u.ualign.type == A_CHAOTIC ? 2 : 3))
                     / MAXVALUE);
        if (u.ugangr < 0)
            u.ugangr = 0;
        if (u.ugangr != saved_anger) {
            if (u.ugangr) {
                pline(_("%s seems %s."), u_gname(),
                      Hallucination() ? _("groovy") : _("slightly mollified"));

                if (u.uluck < 0)
                    change_luck(1);
            } else {
                pline(_("%s seems %s."), u_gname(),
                      Hallucination() ? _("cosmic (not a new fact)")
                                    : _("mollified"));

                if (u.uluck < 0)
                    u.uluck = 0;
            }
        } else { /* not satisfied yet */
            if (Hallucination())
                pline_The(_("gods seem tall."));
            else
                You(_("have a feeling of inadequacy."));
        }
    } else if (ugod_is_angry()) {
        if (value > MAXVALUE)
            value = MAXVALUE;
        if (value > -u.ualign.record)
            value = -u.ualign.record;
        adjalign(value);
        You_feel(_("partially absolved."));
    } else if (u.ublesscnt > 0) {
        let saved_cnt = u.ublesscnt;
        u.ublesscnt -= Math.trunc((value * (u.ualign.type == A_CHAOTIC ? 500 : 300))
                        / MAXVALUE);
        if (u.ublesscnt < 0)
            u.ublesscnt = 0;
        if (u.ublesscnt != saved_cnt) {
            if (u.ublesscnt) {
                if (Hallucination())
                    You(_("realize that the gods are not like you and I."));
                else
                    You(_("have a hopeful feeling."));
                if (u.uluck < 0)
                    change_luck(1);
            } else {
                if (Hallucination())
                    pline(_("Overall, there is a smell of fried onions."));
                else
                    You(_("have a feeling of reconciliation."));
                if (u.uluck < 0)
                    u.uluck = 0;
            }
        }
    } else {
        let orig_luck, luck_increase;

        if (bestow_artifact(uchar(value)))
            return;

        orig_luck = u.uluck;
        luck_increase = Math.trunc((value * LUCKMAX) / (MAXVALUE * 2));

        /* sacrificing can't increase non-bonus Luck to above the value of the
           sacrifice; this prevents players immediately maxing their Luck as
           soon as they find an altar and a few rations via sacrificing lots
           of low-valued corpses, which can unbalance the early game */
        if (orig_luck > value)
            luck_increase = 0;
        else if (orig_luck + luck_increase > value)
            luck_increase = value - orig_luck;

        change_luck(luck_increase);
        if (u.uluck < 0)
            u.uluck = 0;
        if (u.uluck != orig_luck) {
            if (Blind())
                You(_("think %s brushed your %s."), something(),
                    body_part(FOOT));
            else
                You(Hallucination()
                ? _("see crabgrass at your %s.  A funny thing in a dungeon.")
                        : _("glimpse a four-leaf clover at your %s."),
                    makeplural(body_part(FOOT)));
        }
    }
}
export const MAXVALUE = 24;

/* determine prayer results in advance; also used for enlightenment */
export function can_pray(praying) { /* boolean */ /* false means no messages should be given */
    let alignment;

    gp.p_aligntyp = on_altar() ? a_align(u.ux, u.uy) : u.ualign.type;
    gp.p_trouble = in_trouble();

    if (is_demon(gy.youmonst.data) /* ok if chaotic or none (Moloch) */
        && (gp.p_aligntyp == A_LAWFUL || gp.p_aligntyp != A_NEUTRAL)) {
        if (praying)
            pline_The(_("very idea of praying to a %s god is repugnant to you."),
                      gp.p_aligntyp ? _("lawful") : _("neutral"));
        return FALSE;
    }

    if (praying)
        You(_("begin praying to %s."), align_gname(gp.p_aligntyp));

    if (u.ualign.type && u.ualign.type == -gp.p_aligntyp)
        alignment = -u.ualign.record; /* Opposite alignment altar */
    else if (u.ualign.type != gp.p_aligntyp)
        alignment = Math.trunc(u.ualign.record / 2); /* Different alignment altar */
    else
        alignment = u.ualign.record;

    if (gp.p_aligntyp == A_NONE) /* praying to Moloch */
        gp.p_type = -2;
    else if ((gp.p_trouble > 0) ? (u.ublesscnt > 200)   /* big trouble */
             : (gp.p_trouble < 0) ? (u.ublesscnt > 100) /* minor difficulty */
               : (u.ublesscnt > 0))                     /* not in trouble */
        gp.p_type = 0;                     /* too soon... */
    else if (Luck() < 0 || u.ugangr || alignment < 0)
        gp.p_type = 1; /* too naughty... */
    else /* alignment >= 0 */ {
        if (on_altar() && u.ualign.type != gp.p_aligntyp)
            gp.p_type = 2;
        else
            gp.p_type = 3;
    }

    if (is_undead(gy.youmonst.data) && !Inhell()
        && (gp.p_aligntyp == A_LAWFUL
            || (gp.p_aligntyp == A_NEUTRAL && !rn2(10))))
        gp.p_type = -1;
    /* Note:  when !praying, the random factor for neutrals makes the
       return value a non-deterministic approximation for enlightenment.
       This case should be uncommon enough to live with... */

    return !praying ? (+(gp.p_type == 3 && !Inhell())) : TRUE;
}

/* return TRUE if praying revived a pet corpse */
function pray_revive() { /* boolean */
    let otmp;

    for (otmp = svl.level.objects[u.ux][u.uy]; otmp; otmp = otmp.v.v_nexthere)
        if ((otmp.otyp == CORPSE || otmp.otyp == STATUE)
            && has_omonst(otmp)
            && OMONST(otmp).mtame && !OMONST(otmp).isminion)
            break;

    if (!otmp)
        return FALSE;

    if (otmp.otyp == CORPSE)
        return +(revive(otmp, TRUE) != null);
    else {
        return +(animate_statue(otmp, u.ux, u.uy, ANIMATE_SPELL, null) != null);
    }
}

/* #pray command */
export function dopray() { /* int */
    let ok;

    /*
     * If ParanoidPray is set, confirm prayer to avoid accidental slips
     * of Alt+p.  If ParanoidConfirm is also set, require "yes" rather
     * than just "y" (will also require "no" to decline).
     */
    if (ParanoidPray()) {
        ok = paranoid_query(ParanoidConfirm(),
                            _("Are you sure you want to pray?"));

        if (!ok) /* declined the "are you sure?" confirmation */
            return ECMD_OK;
    }

    if (!u.uconduct.gnostic++)
        /* breaking conduct should probably occur in can_pray() at
         * "You begin praying to %s", as demons who find praying repugnant
         * should not break conduct.  Also we can add more detail to the
         * livelog message as p_aligntyp will be known.
         */
        livelog_printf(LL_CONDUCT, _("rejected atheism with a prayer"));

    /* set up p_type and p_alignment */
    if (!can_pray(TRUE))
        return ECMD_OK;

    if (wizard() && gp.p_type >= 0) {
        let forcesuccess = init_string(static_array("dopray.forcesuccess", char, sizeof_string("Force the gods to be pleased?")), _("Force the gods to be pleased?"), true);

        /* if we asked "are you sure?" above we suppressed the response
           from the do-again buffer, so need to suppress this response too;
           otherwise subsequent ^A would use this answer for "are you sure?"
           and bypass confirmation */
        if (ParanoidPray()) {
            let save_doagain = gi.in_doagain;

            gi.in_doagain = FALSE;
            ok = +(YN(forcesuccess) == ord('y'));
            gi.in_doagain = save_doagain;
        } else {
            ok = +(y_n(forcesuccess) == ord('y'));
        }
        if (ok) {
            u.ublesscnt = 0;
            if (u.uluck < 0)
                u.uluck = 0;
            if (u.ualign.record <= 0)
                u.ualign.record = 1;
            u.ugangr = 0;
            if (gp.p_type < 2)
                gp.p_type = 3;
        }
    }
    nomul(-3);
    gm.multi_reason = _("praying");
    gn.nomovemsg = _("You finish your prayer.");
    ga.afternmv = prayer_done;

    if (gp.p_type == 3 && !Inhell()) {
        /* if you've been true to your god you can't die while you pray */
        if (!Blind())
            You(_("are surrounded by a shimmering light."));
        u.uinvulnerable = TRUE;
    }

    return ECMD_TIME;
}

function prayer_done() { /* int */ /* M. Stephenson (1.0.3b) */
    let alignment = gp.p_aligntyp;

    u.uinvulnerable = FALSE;
    if (gp.p_type == -2) {
        /* praying at an unaligned altar, not necessarily in Gehennom */
        You(_("%s diabolical laughter all around you..."),
            !Deaf() ? _("hear") : _("intuit"));
        wake_nearby(FALSE);
        adjalign(-2);
        exercise(A_WIS, FALSE);
        if (!Inhell()) {
            /* hero's god[dess] seems to be keeping his/her head down */
            pline(_("Nothing else happens.")); /* not actually true... */
            return 1;
        } /* else use regular Inhell result below */
    } else if (gp.p_type == -1) {
        /* praying while poly'd into an undead creature while non-chaotic */
        godvoice(alignment,
                 (alignment == A_LAWFUL)
                    ? _("Vile creature, thou durst call upon me?")
                    : _("Walk no more, perversion of nature!"));
        You_feel(_("like you are falling apart."));
        /* KMH -- Gods have mastery over unchanging */
        rehumanize();
        /* no Half_physical_damage adjustment here */
        losehp(rnd(20), _("residual undead turning effect"), KILLED_BY_AN);
        exercise(A_CON, FALSE);
        return 1;
    }
    if (Inhell()) {
        pline(_("Since you are in Gehennom, %s can't help you."),
              align_gname(alignment));
        /* haltingly aligned is least likely to anger */
        if (u.ualign.record <= 0 || rnl(u.ualign.record))
            angrygods(u.ualign.type);
        return 0;
    }

    if (gp.p_type == 0) {
        if (on_altar() && u.ualign.type != alignment)
            water_prayer(FALSE);
        u.ublesscnt += rnz(250);
        change_luck(-3);
        gods_upset(u.ualign.type);
    } else if (gp.p_type == 1) {
        if (on_altar() && u.ualign.type != alignment)
            water_prayer(FALSE);
        angrygods(u.ualign.type); /* naughty */
    } else if (gp.p_type == 2) {
        if (water_prayer(FALSE)) {
            /* attempted water prayer on a non-coaligned altar */
            u.ublesscnt += rnz(250);
            change_luck(-3);
            gods_upset(u.ualign.type);
        } else
            pleased(alignment);
    } else {
        /* coaligned */
        if (on_altar()) {
            pray_revive();
            water_prayer(TRUE);
        }
        pleased(alignment); /* nice */
    }
    return 1;
}

/* iterable for undead turning by priest/knight */
function maybe_turn_mon_iter(mtmp) { /* void */
    /* 3.6.3: used to use cansee() here but the purpose is to prevent
       #turn operating through walls, not to require that the hero be
       able to see the target location */
    if (!couldsee(mtmp.mx, mtmp.my)
        || mdistu(mtmp) > turn_undead_range[0])
        return;

    if (!mtmp.mpeaceful
        && (is_undead(mtmp.data) || is_vampshifter(mtmp)
            || (is_demon(mtmp.data) && (u.ulevel > Math.trunc(MAXULEV / 2))))) {
        mtmp.msleeping = 0;
        if (Confusion()) {
            if (!turn_undead_msg_cnt[0]++)
                pline(_("Unfortunately, your voice falters."));
            mtmp.mflee = 0;
            mtmp.mfrozen = 0;
            mtmp.mcanmove = 1;
        } else if (!resist(mtmp, ord('\0'), 0, TELL)) {
            let xlev = 6;

            switch (mtmp.data.mlet) {
                /* this is intentional, lichs are tougher
                   than zombies. */
            case S_LICH:
                xlev += 2;
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case S_GHOST:
                xlev += 2;
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case S_VAMPIRE:
                xlev += 2;
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case S_WRAITH:
                xlev += 2;
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case S_MUMMY:
                xlev += 2;
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case S_ZOMBIE:
                if (u.ulevel >= xlev && !resist(mtmp, ord('\0'), 0, NOTELL)) {
                    if (u.ualign.type == A_CHAOTIC) {
                        mtmp.mpeaceful = 1;
                        set_malign(mtmp);
                    } else { /* damn them */
                        killed(mtmp);
                    }
                    break;
                } /* else flee */
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            default:
                monflee(mtmp, 0, FALSE, TRUE);
                break;
            }
        }
    }
}

/* #turn command */
export function doturn() { /* int */
    /* Knights & Priest(esse)s only please */
    let Gname;

    if (!Role_if(PM_CLERIC) && !Role_if(PM_KNIGHT)) {
        /* Try to use the "turn undead" spell. */
        if (known_spell(SPE_TURN_UNDEAD))
            return spelleffects(SPE_TURN_UNDEAD, FALSE, FALSE);
        You(_("don't know how to turn undead!"));
        return ECMD_OK;
    }
    if (!u.uconduct.gnostic++)
        livelog_printf(LL_CONDUCT, _("rejected atheism by turning undead"));

    Gname = halu_gname(u.ualign.type);

    /* [What about needing free hands (does #turn involve any gesturing)?] */
    if (!can_chant(gy.youmonst)) {
        /* "evilness": "demons and undead" is too verbose and too precise */
        You(_("are %s upon %s to turn aside evilness."),
            Strangled() ? _("not able to call") : _("incapable of calling"), Gname);
        /* violates agnosticism due to intent; conduct tracking is not
           supposed to affect play but we make an exception here:  use a
           move if this is the first time agnostic conduct has been broken */
        return (u.uconduct.gnostic == 1) ? ECMD_TIME : ECMD_OK;
    }
    if ((u.ualign.type != A_CHAOTIC
         && (is_demon(gy.youmonst.data)
             || is_undead(gy.youmonst.data) || is_vampshifter(gy.youmonst)))
        || u.ugangr > 6) { /* "Die, mortal!" */
        pline(_("For some reason, %s seems to ignore you."), Gname);
        aggravate();
        exercise(A_WIS, FALSE);
        return ECMD_TIME;
    }
    if (Inhell()) {
        pline(_("Since you are in Gehennom, %s %s help you."),
              /* not actually calling upon Moloch but use alternate
                 phrasing anyway if hallucinatory feedback says it's him */
              Gname, !strcmp(Gname, Moloch[0]) ? _("won't") : _("can't"));
        aggravate();
        return ECMD_TIME;
    }
    pline(_("Calling upon %s, you chant an arcane formula."), Gname);
    exercise(A_WIS, TRUE);

    /* note: does not perform unturn_dead() on victims' inventories */
    turn_undead_range[0] = BOLT_LIM + Math.trunc(u.ulevel / 5); /* 8 to 14 */
    turn_undead_range[0] *= turn_undead_range[0];
    turn_undead_msg_cnt[0] = 0;

    iter_mons(maybe_turn_mon_iter);

    /*
     *  There is no detrimental effect on self for successful #turn
     *  while in demon or undead form.  That can only be done while
     *  chaotic oneself (see "For some reason" above) and chaotic
     *  turning only makes targets peaceful.
     *
     *  Paralysis duration probably ought to be based on the strength
     *  of turned creatures rather than on turner's level.
     *  Why doesn't this honor Free_action?  [Because being able to
     *  repeat #turn every turn would be too powerful.  Maybe instead
     *  of nomul(-N) we should add the equivalent of mon->mspec_used
     *  for the hero and refuse to #turn when it's non-zero?  Or have
     *  both and u.uspec_used only matters when Free_action prevents
     *  the brief paralysis?]
     */
    nomul(-(5 - Math.trunc((u.ulevel - 1) / 6))); /* -5 .. -1 */
    gm.multi_reason = _("trying to turn the monsters");
    gn.nomovemsg = You_can_move_again();
    return ECMD_TIME;
}

export function altarmask_at(x, y) { /* int */
    let res = 0;

    if (isok(x, y)) {
        let mon = m_at(x, y);

        if (mon && M_AP_TYPE(mon) == M_AP_FURNITURE
            && mon.mappearance == S_altar)
            res = has_mcorpsenm(mon) ? MCORPSENM(mon) : 0;
        else if (IS_ALTAR(levl()[x][y].typ))
            res = levl()[x][y].flags;
    }
    return res;
}

export function a_gname() { /* const char * */
    return a_gname_at(u.ux, u.uy);
}

/* returns the name of an altar's deity */
export function a_gname_at(x, y) { /* const char * */
    if (!IS_ALTAR(levl()[x][y].typ))
        return 0;

    return align_gname(a_align(x, y));
}

/* returns the name of the hero's deity */
export function u_gname() { /* const char * */
    return align_gname(u.ualign.type);
}

export function align_gname(alignment) { /* const char * */
    let gnam;

    switch (alignment) {
    case A_NONE:
        gnam = Moloch[0];
        break;
    case A_LAWFUL:
        gnam = gu.urole.lgod;
        break;
    case A_NEUTRAL:
        gnam = gu.urole.ngod;
        break;
    case A_CHAOTIC:
        gnam = gu.urole.cgod;
        break;
    default:
        impossible(_("unknown alignment."));
        gnam = _("someone");
        break;
    }
    if (chars[gnam] == ord('_'))
        ++gnam;
    return gnam;
}

const hallu_gods = static_array("hallu_gods", ptr_to(char), null, [
    _("the Flying Spaghetti Monster"), /* Church of the FSM */
    _("Eris"),                         /* Discordianism */
    _("the Martians"),                 /* every science fiction ever */
    _("Xom"),                          /* Crawl */
    _("AnDoR dRaKoN"),                 /* ADOM */
    _("the Central Bank of Yendor"),   /* economics */
    _("Tooth Fairy"),                  /* real world(?) */
    _("Om"),                           /* Discworld */
    _("Yawgmoth"),                     /* Magic: the Gathering */
    _("Morgoth"),                      /* LoTR */
    _("Cthulhu"),                      /* Lovecraft */
    _("the Ori"),                      /* Stargate */
    _("destiny"),                      /* why not? */
    _("your Friend the Computer"),     /* Paranoia */
]);

/* hallucination handling for priest/minion names: select a random god
   iff character is hallucinating */
export function halu_gname(alignment) { /* const char * */
    let gnam = 0;
    let which;

    if (!Hallucination())
        return align_gname(alignment);

    /* Some roles (Priest) don't have a pantheon unless we're playing as
       that role, so keep trying until we get a role which does have one.
       [If playing a Priest, the current pantheon will be twice as likely
       to get picked as any of the others.  That's not significant enough
       to bother dealing with.] */
    do
        which = randrole(TRUE);
    while (!roles[which].lgod);

    switch (rn2_on_display_rng(9)) {
    case 0:
    case 1:
        gnam = roles[which].lgod;
        break;
    case 2:
    case 3:
        gnam = roles[which].ngod;
        break;
    case 4:
    case 5:
        gnam = roles[which].cgod;
        break;
    case 6:
    case 7:
        gnam = hallu_gods[rn2_on_display_rng(SIZE(hallu_gods))];
        break;
    case 8:
        gnam = Moloch[0];
        break;
    default:
        impossible(_("rn2 broken in halu_gname?!?"));
    }
    if (!gnam) {
        impossible(_("No random god name?"));
        gnam = _("your Friend the Computer"); /* Paranoia */
    }
    if (chars[gnam] == ord('_'))
        ++gnam;
    return gnam;
}

/* deity's title */
export function align_gtitle(alignment) { /* const char * */
    let gnam, result = _("god");

    switch (alignment) {
    case A_LAWFUL:
        gnam = gu.urole.lgod;
        break;
    case A_NEUTRAL:
        gnam = gu.urole.ngod;
        break;
    case A_CHAOTIC:
        gnam = gu.urole.cgod;
        break;
    default:
        gnam = 0;
        break;
    }
    if (gnam && chars[gnam] == ord('_'))
        result = _("goddess");
    return result;
}

export function altar_wrath(x, y) { /* void */
    let altaralign = a_align(x, y);

    if (u.ualign.type == altaralign && u.ualign.record > -rn2(4)) {
        godvoice(altaralign, _("How darest thou desecrate my altar!"));
        adjattrib(A_WIS, -1, FALSE);
        u.ualign.record--;
    } else {
        pline(_("%s %s%s:"),
              !Deaf() ? _("A voice (could it be")
                    : _("Despite your deafness, you seem to hear"),
              align_gname(altaralign),
              !Deaf() ? _("?) whispers") : _(" say"));
              ;
        verbalize(_("Thou shalt pay, infidel!"));
        /* higher luck is more likely to be reduced; as it approaches -5
           the chance to lose another point drops down, eventually to 0 */
        if (Luck() > -5 && rn2(Luck() + 6))
            change_luck(rn2(20) ? -1 : -2);
    }
}

/* assumes isok() at one space away, but not necessarily at two */
function blocked_boulder(dx, dy) { /* boolean */
    let otmp;
    let nx, ny;
    let count = 0;

    for (otmp = svl.level.objects[u.ux + dx][u.uy + dy]; otmp;
         otmp = otmp.v.v_nexthere) {
        if (otmp.otyp == BOULDER)
            count += otmp.quan;
    }

    nx = u.ux + 2 * dx, ny = u.uy + 2 * dy; /* next spot beyond boulder(s) */
    switch (count) {
    case 0:
        /* no boulders--not blocked */
        return FALSE;
    case 1:
        /* possibly blocked depending on if it's pushable */
        break;
    case 2:
        /* this is only approximate since multiple boulders might sink */
        if (is_pool_or_lava(nx, ny)) /* does its own isok() check */
            break; /* still need Sokoban check below */
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        /* more than one boulder--blocked after they push the top one;
           don't force them to push it first to find out */
        return TRUE;
    }

    if (dx && dy && Sokoban()) /* can't push boulder diagonally in Sokoban */
        return TRUE;
    if (!isok(nx, ny))
        return TRUE;
    if (IS_OBSTRUCTED(levl()[nx][ny].typ))
        return TRUE;
    if (sobj_at(BOULDER, nx, ny))
        return TRUE;

    return FALSE;
}

/*pray.c*/

import {
    AM_CHAOTIC, AM_MASK, AM_SANCTUM, AM_SHRINE, A_CG_CONVERT, A_CHAOTIC, A_LAWFUL, A_NEUTRAL,
    A_NONE,
} from "./align.h.js";
import { ALIGNLIM, Align2amask, Amask2align } from "./align.h.macros.js";
import { ART_EXCALIBUR, ART_STORMBRINGER, ART_VORPAL_BLADE } from "./artilist.h.js";
import { A_CON, A_MAX, A_STR, A_WIS } from "./attrib.h.js";
import { ABASE, AMAX } from "./attrib.h.macros.js";
import {
    NH_AMBER, NH_BLACK, NH_GOLDEN, NH_LIGHT_BLUE, NH_ORANGE, NH_WHITE, Something,
    You_can_move_again, nothing_happens, something,
} from "./decl.h.macros.js";
import {
    POTION_CLASS, SPBOOK_CLASS, S_GHOST, S_HUMAN, S_LICH, S_MUMMY, S_VAMPIRE, S_WRAITH, S_ZOMBIE,
    S_altar, WEAPON_CLASS,
} from "./defsym.h.js";
import { Inhell, Is_astralevel, Is_sanctum } from "./dungeon.h.macros.js";
import { PLNMSG_OBJ_GLOWS } from "./flag.h.js";
import { ParanoidConfirm, ParanoidPray, wizard } from "./flag.h.macros.js";
import {
    BUFSZ, FALSE, LARGEST_INT, LL_ARTIFACT, LL_CONDUCT, LL_DIVINEGIFT, LL_SPOILER, MAXULEV, TRUE,
} from "./global.h.js";
import {
    ASCENDED, BOLT_LIM, CXN_ARTICLE, DIED, DISSOLVED, ECMD_OK, ECMD_TIME, ESCAPED, EXT_ENCUMBER,
    EYE, FOOT, HUNGRY, HVY_ENCUMBER, KILLED_BY, KILLED_BY_AN, MM_NOMSG, NOTELL, ONAME_GIFT,
    ONAME_KNOW_ARTI, STOMACH, TELEDS_NO_FLAGS, TELL, WEAK, XKILL_NOCONDUCT, XKILL_NOCORPSE,
    XKILL_NOMSG,
} from "./hack.h.js";
import { ROLL_FROM, YN, makeknown, max, mdistu, min, pline1, rn1, y_n } from "./hack.h.macros.js";
import { MCORPSENM, has_mcorpsenm } from "./mextra.h.macros.js";
import { AD_BLND, AT_ENGL } from "./monattk.h.js";
import {
    eyecount, is_demon, is_human, is_undead, is_unicorn, nohands, throws_rocks, your_race,
} from "./mondata.h.macros.js";
import {
    M_AP_FURNITURE, M_SEEN_DISINT, M_SEEN_ELEC, M_SEEN_REFL, STRAT_APPEARMSG,
} from "./monst.h.js";
import {
    M_AP_TYPE, is_vampshifter, ismnum, resists_disint, resists_elec,
} from "./monst.h.macros.js";
import {
    NON_PM, PM_ACID_BLOB, PM_CLERIC, PM_KNIGHT, PM_MONK, PM_WIZARD, PM_WRAITH,
} from "./monsters.h.js";
import { OMONST, bimanual, carried, has_omonst, is_weptool, u_wield_art } from "./obj.h.macros.js";
import { SPBOOK_no_NOVEL } from "./objclass.h.js";
import { OBJ_NAME } from "./objclass.h.macros.js";
import {
    AMULET_OF_STRANGULATION, AMULET_OF_YENDOR, BOULDER, CORPSE, FAKE_AMULET_OF_YENDOR, FUMBLE_BOOTS,
    GAUNTLETS_OF_FUMBLING, HELM_OF_OPPOSITE_ALIGNMENT, LEVITATION_BOOTS, LOADSTONE, LONG_SWORD,
    MAGIC_MARKER, POT_WATER, RIN_LEVITATION, RIN_SUSTAIN_ABILITY, RUNESWORD, SADDLE,
    SPE_BLANK_PAPER, SPE_FINGER_OF_DEATH, SPE_RESTORE_ABILITY, SPE_TURN_UNDEAD, STATUE,
    STRANGE_OBJECT,
} from "./objects.h.js";
import {
    AGGRAVATE_MONSTER, COLD_RES, FAST, FIRE_RES, FROMOUTSIDE, INTRINSIC, PASSES_WALLS, POISON_RES,
    PROTECTION, SEE_INVIS, SHOCK_RES, SLEEP_RES, STEALTH, STRANGLED, TELEPAT, TIMEOUT, W_ARM,
    W_ARMC, W_ARMS, W_SADDLE,
} from "./prop.h.js";
import { ROOM, SCORR, SDOOR } from "./rm.h.js";
import { IS_ALTAR, IS_OBSTRUCTED, Sokoban, levl, m_at } from "./rm.h.macros.js";
import { P_BROAD_SWORD, P_LONG_SWORD } from "./skills.h.js";
import { P_RESTRICTED } from "./skills.h.macros.js";
import { spe_Forgotten, spe_Fresh, spe_Unknown } from "./spell.h.js";
import { ANIMATE_SPELL } from "./trap.h.js";
import { couldsee } from "./vision.h.macros.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import {
    ACH_TUNE, A_CURRENT, A_ORIGINAL, LUCKMAX, SICK_ALL, TT_BURIEDBALL, TT_LAVA,
} from "./you.h.js";
import { Luck, Role_if, Upolyd, uhim, uhis } from "./you.h.macros.js";
import {
    Antimagic, Blind, Blinded, BlindedTimeout, Blindfolded, Blindfolded_only, Confusion, Deaf,
    Disint_resistance, EDisint_resistance, EReflecting, Fixed_abil, Flying, Glib, HBlinded,
    HConfusion, HDeaf, HFast, HHallucination, HProtection, HStealth, HStun, HTelepat, Hallucination,
    Levitation, Passes_walls, Punished, Reflecting, Shock_resistance, Sick, Slimed, Stoned,
    Strangled, Stunned, Unchanging, Wounded_legs,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64u, not64u, or64 } from "../rt/int64.js";
import { sprintf, strcmp, strcpy } from "../rt/libc.js";
import { init_string, stack_array, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { ptr_to, ref_of } from "../rt/struct.js";
import {
    artifact_origin, artiname, confers_luck, discover_artifact, exist_artifact, is_art, mk_artifact,
    nartifact_exist,
} from "./artifact.js";
import { adjalign, adjattrib, change_luck, exercise, setuhpmax, uchangealign } from "./attrib.js";
import { xlev_to_rank } from "./botl.js";
import { isok, paranoid_query } from "./cmd.js";
import { is_pool_or_lava } from "./dbridge.js";
import {
    disp, flags, ga, gi, gm, gn, gp, gu, gy, iflags, svb, svk, svl, svm, svt, u,
} from "./decl.js";
import { buried_ball_to_freedom } from "./dig.js";
import { newsym, see_monsters, shieldeff } from "./display.js";
import { dropy, heal_legs } from "./do.js";
import { Monnam, a_monnam, hcolor, mon_nam, oname } from "./do_name.js";
import { Amulet_off, disintegrate_arm, stuck_ring, unchanger } from "./do_wear.js";
import { eaten_stat, floorfood, init_uhunger } from "./eat.js";
import { done } from "./end.js";
import { freehand } from "./engrave.js";
import { losexp, pluslvl } from "./exper.js";
import { losehp, near_capacity, nomul } from "./hack.js";
import { eos, s_suffix, sgn, strncmpi, upstart } from "./hacklib.js";
import { align_str, record_achievement } from "./insight.js";
import { carrying, feel_cockatrice, sobj_at, update_inventory, useup, useupf } from "./invent.js";
import { makemon, set_malign } from "./makemon.js";
import { dlord, summon_minion } from "./minion.js";
import {
    bless, get_mtraits, mkobj, mksobj, peek_at_iced_corpse_age, place_object, set_bknown, uncurse,
} from "./mkobj.js";
import { iter_mons, killed, wake_nearby, xkilled } from "./mon.js";
import { attacktype_fordmg, can_chant, monstseesu, monstunseesu } from "./mondata.js";
import { monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { ureflects } from "./muse.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    An, Yobjnam2, actualoname, an, ansimpleoname, bare_artifactname, corpse_xname,
    gloves_simple_name, makeplural, otense, rnd_class, simpleonames, vtense, xname, yname,
} from "./objnam.js";
import { encumber_msg, rider_corpse_revival } from "./pickup.js";
import {
    You, You_feel, You_hear, Your, impossible, livelog_printf, pline, pline_The, verbalize,
} from "./pline.js";
import { body_part, mbodypart, rehumanize } from "./polyself.js";
import {
    make_blinded, make_confused, make_deaf, make_glib, make_hallucinated, make_sick, make_slimed,
    make_stoned, make_stunned, set_itimeout,
} from "./potion.js";
import { angry_priest, findpriest, p_coaligned, temple_occupied } from "./priest.js";
import { punish, unpunish } from "./read.js";
import { region_danger, region_safety } from "./region.js";
import { d, rn2, rn2_on_display_rng, rnd, rnl, rnz } from "./rnd.js";
import { randrole, roles } from "./role.js";
import { obfree } from "./shk.js";
import { attrcurse, rndcurse } from "./sit.js";
import { force_learn_spell, known_spell, spell_skilltype, spelleffects } from "./spell.js";
import { safe_teleds } from "./teleport.js";
import { animate_statue, rescued_from_terrain, reset_utrap } from "./trap.js";
import { add_weapon_skill, unrestrict_weapon_skill, weapon_type } from "./weapon.js";
import { you_unwere } from "./were.js";
import { welded } from "./wield.js";
import { aggravate } from "./wizard.js";
import { which_armor } from "./worn.js";
import { resist, revive } from "./zap.js";
