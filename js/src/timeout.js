/* NetHack 5.0	timeout.c	$NHDT-Date: 1776080125 2026/04/13 03:35:25 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.207 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/* used by wizard mode #timeout and #wizintrinsic; order by 'interest'
   for timeout countdown, where most won't occur in normal play */
  const struct_propname = struct("struct_propname", {
    prop_num: int,
    prop_name: ptr_to(char),
}); const propertynames = static_array("propertynames", struct_propname, null, [
    { prop_num: INVULNERABLE, prop_name: _("invulnerable") },
    { prop_num: STONED, prop_name: _("petrifying") },
    { prop_num: SLIMED, prop_name: _("becoming slime") },
    { prop_num: STRANGLED, prop_name: _("strangling") },
    { prop_num: SICK, prop_name: _("fatally sick") },
    { prop_num: STUNNED, prop_name: _("stunned") },
    { prop_num: CONFUSION, prop_name: _("confused") },
    { prop_num: HALLUC, prop_name: _("hallucinating") },
    { prop_num: BLINDED, prop_name: _("blinded") },
    { prop_num: DEAF, prop_name: _("deafness") },
    { prop_num: VOMITING, prop_name: _("vomiting") },
    { prop_num: GLIB, prop_name: _("slippery fingers") },
    { prop_num: WOUNDED_LEGS, prop_name: _("wounded legs") },
    { prop_num: SLEEPY, prop_name: _("sleepy") },
    { prop_num: TELEPORT, prop_name: _("teleporting") },
    { prop_num: POLYMORPH, prop_name: _("polymorphing") },
    { prop_num: LEVITATION, prop_name: _("levitating") },
    { prop_num: FAST, prop_name: _("very fast") }, /* timed 'FAST' is very fast */
    { prop_num: CLAIRVOYANT, prop_name: _("clairvoyant") },
    { prop_num: DETECT_MONSTERS, prop_name: _("monster detection") },
    { prop_num: SEE_INVIS, prop_name: _("see invisible") },
    { prop_num: INVIS, prop_name: _("invisible") },
    /* temporary acid resistance and stone resistance can come from eating */
    { prop_num: ACID_RES, prop_name: _("acid resistance") },
    { prop_num: STONE_RES, prop_name: _("stoning resistance") },
    /* timed displacement is possible via eating a displacer beast corpse */
    { prop_num: DISPLACED, prop_name: _("displaced") },
    /* timed pass-walls is a potential prayer result if surrounded by stone
       with nowhere to be safely teleported to */
    { prop_num: PASSES_WALLS, prop_name: _("pass thru walls") },
    /* likewise for magical breathing vs poison gas regions */
    { prop_num: MAGICAL_BREATHING, prop_name: _("magical breathing") },
    /* timed fire resistance and water walking are possible in explore mode
       (as well as in wizard mode) after life-saving in lava if it fails to
       teleport the hero to safety and player declines to die */
    { prop_num: WWALKING, prop_name: _("water walking") },
    { prop_num: FIRE_RES, prop_name: _("fire resistance") },
    /*
     * Properties beyond here don't have timed values during normal play,
     * so there's not much point in trying to order them sensibly.
     * They're either on or off based on equipment, role, actions, &c,
     * but in wizard mode, #wizintrinsic can give them as timed effects.
     */
    { prop_num: COLD_RES, prop_name: _("cold resistance") },
    { prop_num: SLEEP_RES, prop_name: _("sleep resistance") },
    { prop_num: DISINT_RES, prop_name: _("disintegration resistance") },
    { prop_num: SHOCK_RES, prop_name: _("shock resistance") },
    { prop_num: POISON_RES, prop_name: _("poison resistance") },
    { prop_num: DRAIN_RES, prop_name: _("drain resistance") },
    { prop_num: SICK_RES, prop_name: _("sickness resistance") },
    { prop_num: ANTIMAGIC, prop_name: _("magic resistance") },
    { prop_num: HALLUC_RES, prop_name: _("hallucination resistance") },
    { prop_num: BLND_RES, prop_name: _("light-induced blindness resistance") },
    { prop_num: FUMBLING, prop_name: _("fumbling") },
    { prop_num: HUNGER, prop_name: _("voracious hunger") },
    { prop_num: TELEPAT, prop_name: _("telepathic") },
    { prop_num: WARNING, prop_name: _("warning") },
    { prop_num: WARN_OF_MON, prop_name: _("warn: monster type or class") },
    { prop_num: WARN_UNDEAD, prop_name: _("warn: undead") },
    { prop_num: SEARCHING, prop_name: _("searching") },
    { prop_num: INFRAVISION, prop_name: _("infravision") },
    { prop_num: ADORNED, prop_name: _("adorned (+/- Cha)") },
    { prop_num: STEALTH, prop_name: _("stealthy") },
    { prop_num: AGGRAVATE_MONSTER, prop_name: _("monster aggravation") },
    { prop_num: CONFLICT, prop_name: _("conflict") },
    { prop_num: JUMPING, prop_name: _("jumping") },
    { prop_num: TELEPORT_CONTROL, prop_name: _("teleport control") },
    { prop_num: FLYING, prop_name: _("flying") },
    { prop_num: SWIMMING, prop_name: _("swimming") },
    { prop_num: SLOW_DIGESTION, prop_name: _("slow digestion") },
    { prop_num: HALF_SPDAM, prop_name: _("half spell damage") },
    { prop_num: HALF_PHDAM, prop_name: _("half physical damage") },
    { prop_num: REGENERATION, prop_name: _("HP regeneration") },
    { prop_num: ENERGY_REGENERATION, prop_name: _("energy regeneration") },
    { prop_num: PROTECTION, prop_name: _("extra protection") },
    { prop_num: PROT_FROM_SHAPE_CHANGERS, prop_name: _("protection from shape changers") },
    { prop_num: POLYMORPH_CONTROL, prop_name: _("polymorph control") },
    { prop_num: UNCHANGING, prop_name: _("unchanging") },
    { prop_num: REFLECTING, prop_name: _("reflecting") },
    { prop_num: FREE_ACTION, prop_name: _("free action") },
    { prop_num: FIXED_ABIL, prop_name: _("fixed abilities") },
    { prop_num: LIFESAVED, prop_name: _("life will be saved") },
    {  prop_num: 0, prop_name: 0 },
]);

export function property_by_index(idx, propertynum) { /* const char * */
    if (!IndexOkT(idx, propertynames))
        idx = SIZE(propertynames) - 1;

    if (propertynum)
        propertynum[0] = propertynames[idx].prop_num;
    return propertynames[idx].prop_name;
}

/* He is being petrified - dialogue by inmet!tower */
const stoned_texts = static_array("stoned_texts", ptr_to(char), null, [
    _("You are slowing down."),            /* 5 */
    _("Your limbs are stiffening."),       /* 4 */
    _("Your limbs have turned to stone."), /* 3 */
    _("You have turned to stone."),        /* 2 */
    _("You are a statue.")                 /* 1 */
]);

function stoned_dialogue() { /* void */
    const $frame = stack_frame(); try {
    let i = (Stoned() & TIMEOUT);

    if (i > 0 && i <= SIZE(stoned_texts)) {
        let buf = stack_array(char, BUFSZ);

        strcpy(buf, stoned_texts[SIZE(stoned_texts) - i]);
        if (nolimbs(gy.youmonst.data) && strstri(buf, _("limbs")))
            strsubst(buf, _("limbs"), _("extremities"));
        urgent_pline(_("%s"), buf);
    }
    switch (int(i)) {
    case 5: /* slowing down */
        u.uprops[FAST].intrinsic = 0;
        if (gm.multi > 0)
            nomul(0);
        break;
    case 4: /* limbs stiffening */
        /* just one move left to save oneself so quit fiddling around;
           don't stop attempt to eat tin--might be lizard or acidic */
        if (!Popeye(STONED))
            stop_occupation();
        if (gm.multi > 0)
            nomul(0);
        break;
    case 3: /* limbs turned to stone */
        stop_occupation();
        nomul(-3); /* can't move anymore */
        gm.multi_reason = _("getting stoned");
        gn.nomovemsg = You_can_move_again(); /* not unconscious */
        /* "your limbs have turned to stone" so terminate wounded legs */
        if (Wounded_legs() && !u.usteed)
            heal_legs(2);
        break;
    case 2: /* turned to stone */
        if ((HDeaf() & TIMEOUT) > 0 && (HDeaf() & TIMEOUT) < 5)
            set_itimeout(ref_of(u.uprops[DEAF], "intrinsic"), 5); /* avoid Hear_again at tail end */
        /* if also vomiting or turning into slime, stop those (no messages) */
        if (Vomiting())
            make_vomiting(0, FALSE);
        if (Slimed())
            make_slimed(0, 0);
        break;
    default:
        break;
    }
    exercise(A_DEX, FALSE);
    } finally { stack_pop($frame); }
}

/* hero is getting sicker and sicker prior to vomiting */
const vomiting_texts = static_array("vomiting_texts", ptr_to(char), null, [
    _("are feeling mildly nauseated."), /* 14 */
    _("feel slightly confused."),       /* 11 */
    _("can't seem to think straight."), /* 8 */
    _("feel incredibly sick."),         /* 5 */
    _("are about to vomit.")            /* 2 */
]);

function vomiting_dialogue() { /* void */
    const $frame = stack_frame(); try {
    let txt = 0;
    let buf = stack_array(char, BUFSZ);
    let v = (Vomiting() & TIMEOUT);

    /* note: nhtimeout() hasn't decremented timed properties for the
       current turn yet, so we use Vomiting-1 here */
    switch (int((v - 1))) {
    case 14:
        txt = vomiting_texts[0];
        break;
    case 11:
        txt = vomiting_texts[1];
        if (strstri(txt, _(" confused")) && Confusion())
            txt = strsubst(strcpy(buf, txt), _(" confused"), _(" more confused"));
        break;
    case 6:
        make_stunned((HStun() & TIMEOUT) + d(2, 4), FALSE);
        if (!Popeye(VOMITING))
            stop_occupation();
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case 9:
        make_confused((HConfusion() & TIMEOUT) + d(2, 4), FALSE);
        if (gm.multi > 0)
            nomul(0);
        break;
    case 8:
        txt = vomiting_texts[2];
        if (strstri(txt, _(" think")) && Stunned())
            txt = strsubst(strcpy(buf, txt), _("can't seem to "), _("can't "));
        break;
    case 5:
        txt = vomiting_texts[3];
        break;
    case 2:
        txt = vomiting_texts[4];
        if (cantvomit(gy.youmonst.data))
            txt = _("gag uncontrollably.");
        else if (Hallucination())
            /* "hurl" is short for "hurl chunks" which is slang for
               relatively violent vomiting... */
            txt = _("are about to hurl!");
        break;
    case 0:
        stop_occupation();
        if (!cantvomit(gy.youmonst.data)) {
            morehungry(20);
            /* case 2 used to be "You suddenly vomit!" but it wasn't sudden
               since you've just been through the earlier messages of the
               countdown, and it was still possible to move around between
               that message and "You can move again." (from vomit()'s
               nomul(-2)) with no intervening message; give one here to
               have more specific point at which hero became unable to move
               [vomit() issues its own message for the cantvomit() case
               and for the FAINTING-or-worse case where stomach is empty] */
            if (u.uhs < FAINTING)
                You(_("%s!"), !Hallucination() ? _("vomit") : _("hurl chunks"));
        }
        vomit();
        break;
    default:
        break;
    }
    if (txt)
        You1(txt);
    exercise(A_CON, FALSE);
    } finally { stack_pop($frame); }
}

function sleep_dialogue() { /* void */
    let i = (HSleepy() & TIMEOUT);

    if (i == 4)
        You(_("yawn."));
}

   /* RESTORE is after slime_dialogue */

const choke_texts = static_array("choke_texts", ptr_to(char), null, [
    _("You find it hard to breathe."),
    _("You're gasping for air."),
    _("You can no longer breathe."),
    _("You're turning %s."),
    _("You suffocate.")
]);

const choke_texts2 = static_array("choke_texts2", ptr_to(char), null, [
    _("Your %s is becoming constricted."),
    _("Your blood is having trouble reaching your brain."),
    _("The pressure on your %s increases."),
    _("Your consciousness is fading."),
    _("You suffocate.")
]);

function choke_dialogue() { /* void */
    let i = (Strangled() & TIMEOUT);

    if (i > 0 && i <= SIZE(choke_texts)) {
        if (Breathless() || !rn2(50)) {
            urgent_pline(choke_texts2[SIZE(choke_texts2) - i],
                         body_part(NECK));
        } else {
            let str = choke_texts[SIZE(choke_texts) - i];

            if (strchr(str, ord('%')))
                urgent_pline(str, hcolor(NH_BLUE()));
            else
                urgent_pline(_("%s"), str);
            stop_occupation();
        }
    }
    exercise(A_STR, FALSE);
}

const sickness_texts = static_array("sickness_texts", ptr_to(char), null, [
    _("Your illness feels worse."),
    _("Your illness is severe."),
    _("You are at Death's door."),
]);

function sickness_dialogue() { /* void */
    const $frame = stack_frame(); try {
    let j = (Sick() & TIMEOUT), i = Math.trunc(j / 2);

    if (i > 0 && i <= SIZE(sickness_texts) && (j % 2) != 0) {
        let buf = stack_array(char, BUFSZ), pronounbuf = stack_array(char, 40);

        strcpy(buf, sickness_texts[SIZE(sickness_texts) - i]);
        /* change the message slightly for food poisoning */
        if ((u.usick_type & SICK_NONVOMITABLE) == 0)
            strsubst(buf, _("illness"), _("sickness"));
        if (Hallucination() && strstri(buf, _("Death's door"))) {
            /* youmonst: for Hallucination, mhe()'s mon argument isn't used */
            strcpy(pronounbuf, mhe(gy.youmonst));
            sprintf(eos(buf), _("  %s %s inviting you in."), upstart(pronounbuf), vtense(pronounbuf, _("are")))

;
        }
        urgent_pline(_("%s"), buf);
    }
    exercise(A_CON, FALSE);
    } finally { stack_pop($frame); }
}

const levi_texts = static_array("levi_texts", ptr_to(char), null, [
    _("You float slightly lower."),
    _("You wobble unsteadily %s the %s.")
]);

function levitation_dialogue() { /* void */
    /* -1 because the last message comes via float_down() */
    let i = Math.trunc(((HLevitation() & TIMEOUT) - 1) / 2);

    if (ELevitation())
        return;

    if (!ACCESSIBLE(levl()[u.ux][u.uy].typ)
        && !is_pool_or_lava(u.ux,u.uy))
        return;

    if (((HLevitation() & TIMEOUT) % 2) && i > 0 && i <= SIZE(levi_texts)) {
        let s = levi_texts[SIZE(levi_texts) - i];

        if (strchr(s, ord('%'))) {
            let danger = (is_pool_or_lava(u.ux, u.uy)
                              && !Is_waterlevel(u.uz) ? 1 : 0);

            urgent_pline(s, danger ? _("over") : _("in"),
                         danger ? surface(u.ux, u.uy) : _("air"));
        } else
            pline1(s);
        stop_occupation();
    }
}

const slime_texts = static_array("slime_texts", ptr_to(char), null, [
    _("You are turning a little %s."),   /* 5 */
    _("Your limbs are getting oozy."),   /* 4 */
    _("Your skin begins to peel away."), /* 3 */
    _("You are turning into %s."),       /* 2 */
    _("You have become %s.")             /* 1 */
]);

function slime_dialogue() { /* void */
    const $frame = stack_frame(); try {
    let t = (Slimed() & TIMEOUT), i = Math.trunc(t / 2);

    if (t == 1) {
        /* display as green slime during "You have become green slime."
           but don't worry about not being able to see self; if already
           mimicking something else at the time, implicitly be revealed */
        gy.youmonst.m_ap_type = M_AP_MONSTER;
        gy.youmonst.mappearance = PM_GREEN_SLIME;
        /* no message given when 't' is odd, so no automatic update of
           self; force one */
        newsym(u.ux, u.uy);
    }

    if ((t % 2) != 0 && i >= 0 && i < SIZE(slime_texts)) {
        let buf = stack_array(char, BUFSZ);

        strcpy(buf, slime_texts[SIZE(slime_texts) - i - 1]);
        if (nolimbs(gy.youmonst.data) && strstri(buf, _("limbs")))
            strsubst(buf, _("limbs"), _("extremities"));

        if (strchr(buf, ord('%'))) {
            if (i == 4) {  /* "you are turning green" */
                if (!Blind()) /* [what if you're already green?] */
                    urgent_pline(buf, hcolor(NH_GREEN()));
            } else {
                urgent_pline(buf, an(Hallucination() ? rndmonnam(0)
                                                   : _("green slime")));
            }
        } else {
            urgent_pline(_("%s"), buf);
        }
    }

    switch (i) {
    case 3:  /* limbs becoming oozy */
        u.uprops[FAST].intrinsic = 0; /* lose intrinsic speed */
        if (!Popeye(SLIMED))
            stop_occupation();
        if (gm.multi > 0)
            nomul(0);
        break;
    case 2: /* skin begins to peel */
        if ((HDeaf() & TIMEOUT) > 0 && (HDeaf() & TIMEOUT) < 5)
            set_itimeout(ref_of(u.uprops[DEAF], "intrinsic"), 5); /* avoid Hear_again at tail end */
        break;
    case 1: /* turning into slime */
        /* if also turning to stone, stop doing that (no message) */
        if (Stoned())
            make_stoned(0, 0, KILLED_BY_AN, 0);
        break;
    }
    exercise(A_DEX, FALSE);
    } finally { stack_pop($frame); }
}

export function burn_away_slime() { /* void */
    if (Slimed()) {
        make_slimed(0, _("The slime that covers you is burned away!"));
    }
}

/* countdown timer for turning into green slime has run out; kill our hero */
function slimed_to_death(kptr) { /* void */
    const $frame = stack_frame(); try {
    let save_mvflags;

    /* redundant: polymon() cures sliming when polying into green slime */
    if (Upolyd() && gy.youmonst.data == mons[PM_GREEN_SLIME]) {
        dealloc_killer(kptr);
        return;
    }
    /* more sure killer reason is set up */
    if (kptr && chars[kptr.name + 0]) {
        svk.killer.format = kptr.format;
        strcpy(svk.killer.name, kptr.name);
    } else {
        svk.killer.format = NO_KILLER_PREFIX;
        strcpy(svk.killer.name, _("turned into green slime"));
    }
    dealloc_killer(kptr);

    /*
     * Polymorph into a green slime, which might destroy some worn armor
     * (potentially affecting bones) and dismount from steed.
     * Can't be Unchanging; wouldn't have turned into slime if we were.
     * Despite lack of Unchanging, neither done() nor savelife() calls
     * rehumanize() if hero dies while polymorphed.
     * polymon() undoes the slime countdown's mimick-green-slime hack
     * but does not perform polyself()'s light source bookkeeping.
     * No longer need to manually increment uconduct.polyselfs to reflect
     * [formerly implicit] change of form; polymon() takes care of that.
     * Temporarily ungenocide if necessary.
     */
    if (emits_light(gy.youmonst.data))
        del_light_source(LS_MONSTER, monst_to_any(gy.youmonst));
    save_mvflags = svm.mvitals[PM_GREEN_SLIME].mvflags;
    svm.mvitals[PM_GREEN_SLIME].mvflags = save_mvflags & ~G_GENOD;
    /* become a green slime; also resets youmonst.m_ap_type+.mappearance */
    polymon(PM_GREEN_SLIME);
    svm.mvitals[PM_GREEN_SLIME].mvflags = save_mvflags;
    done_timeout(TURNED_SLIME, SLIMED);

    /* life-saved; even so, hero still has turned into green slime;
       player may have genocided green slimes after being infected */
    if ((svm.mvitals[PM_GREEN_SLIME].mvflags & G_GENOD) != 0) {
        let slimebuf = stack_array(char, BUFSZ);

        svk.killer.format = KILLED_BY;
        strcpy(svk.killer.name, _("slimicide"));
        /* vary the message depending upon whether life-save was due to
           amulet or due to declining to die in explore or wizard mode */
        strcpy(slimebuf, _("green slime has been genocided..."));
        if (iflags.last_msg == PLNMSG_OK_DONT_DIE)
            /* follows "OK, so you don't die." and arg is second sentence */
            urgent_pline(_("Yes, you do.  %s"), upstart(slimebuf));
        else
            /* follows "The medallion crumbles to dust." */
            urgent_pline(_("Unfortunately, %s"), slimebuf);
        /* die again; no possibility of amulet this time */
        done(GENOCIDED); /* [should it be done_timeout(GENOCIDED, SLIMED)?] */
        /* could be life-saved again (only in explore or wizard mode)
           but green slimes are gone; just stay in current form */
    }
    return;
    } finally { stack_pop($frame); }
}

/* Intrinsic Passes_walls is temporary when your god is trying to fix
   all troubles and then TROUBLE_STUCK_IN_WALL calls safe_teleds() but
   it can't find anywhere to place you.  If that happens you get a small
   value for (HPasses_walls & TIMEOUT) to move somewhere yourself.
   Message given is "you feel much slimmer" as a joke hint that you can
   move between things which are closely packed--like the substance of
   solid rock! */
const phaze_texts = static_array("phaze_texts", ptr_to(char), null, [
    _("You start to feel bloated."),
    _("You are feeling rather flabby."),
]);

function phaze_dialogue() { /* void */
    let i = Math.trunc((HPasses_walls() & TIMEOUT) / 2);

    if (EPasses_walls() || (HPasses_walls() & ~TIMEOUT))
        return;

    if (((HPasses_walls() & TIMEOUT) % 2) && i > 0 && i <= SIZE(phaze_texts))
        pline(_("%s"), phaze_texts[SIZE(phaze_texts) - i]);
}

/* Similar to Passes_walls, if prayer tries to save hero from a poison
   gas region but can't, (HMagical_breathing & TIMEOUT) will be set to
   a small value.  Unlike Passes_walls, there's no joke message. */
const region_texts = static_array("region_texts", ptr_to(char), null, [
    _("You seem to have some trouble breathing."),
    _("The air here seems foul."),
]);

function region_dialogue() { /* void */
    let no_need_to_breathe, in_poison_gas_cloud;
    let r = (HMagical_breathing() & TIMEOUT), i = Math.trunc(r / 2);

    /* might have poly'd into non-breather or moved out of gas cloud */
    u.uprops[MAGICAL_BREATHING].intrinsic = and64(u.uprops[MAGICAL_BREATHING].intrinsic, ~TIMEOUT);
    no_need_to_breathe = Breathless();
    in_poison_gas_cloud = region_danger();
    u.uprops[MAGICAL_BREATHING].intrinsic = or64(u.uprops[MAGICAL_BREATHING].intrinsic, r);
    if (no_need_to_breathe || !in_poison_gas_cloud)
        return;

    if ((r % 2) && i > 0 && i <= SIZE(region_texts))
        pline(_("%s"), region_texts[SIZE(region_texts) - i]);
}

/* when a status timeout is fatal, keep the status line indicator shown
   during end of game rundown (and potential dumplog);
   timeout has already counted down to 0 by the time we get here */
function done_timeout(how, which) { /* void */
    let intrinsic_p = ref_of(u.uprops[which], "intrinsic");

    intrinsic_p[0] = or64(intrinsic_p[0], I_SPECIAL); /* affects final disclosure */
    done(how);

    /* life-saved */
    intrinsic_p[0] = and64(intrinsic_p[0], ~I_SPECIAL);
    disp.botl = TRUE;
}

export function nh_timeout() { /* void */
    let upp;
    let kptr;
    let was_flying;
    let sleeptime;
    let m_idx;
    let baseluck = (flags.moonphase == FULL_MOON) ? 1 : 0;

    if (flags.friday13)
        baseluck -= 1;

    if (svq.quest_status.killed_leader)
        baseluck -= 4;

    if (Role_if(PM_ARCHEOLOGIST) && uarmh && uarmh.otyp == FEDORA)
        baseluck += 1;

    if (u.uluck != baseluck
        && svm.moves % ((u.uhave.amulet || u.ugangr) ? 300 : 600) == 0) {
        /* Cursed luckstones stop bad luck from timing out; blessed luckstones
         * stop good luck from timing out; normal luckstones stop both;
         * neither is stopped if you don't have a luckstone.
         * Luck is based at 0 usually, +1 if a full moon and -1 on Friday 13th
         */
        let time_luck = stone_luck(FALSE);
        let nostone = +(!carrying(LUCKSTONE) && !stone_luck(TRUE));

        if (u.uluck > baseluck && (nostone || time_luck < 0))
            u.uluck--;
        else if (u.uluck < baseluck && (nostone || time_luck > 0))
            u.uluck++;
    }
    if (u.uinvulnerable)
        return; /* things past this point could kill you */
    if (Stoned())
        stoned_dialogue();
    if (Slimed())
        slime_dialogue();
    if (Vomiting())
        vomiting_dialogue();
    if (Strangled())
        choke_dialogue();
    if (Sick())
        sickness_dialogue();
    if (HLevitation() & TIMEOUT)
        levitation_dialogue();
    if (HPasses_walls() & TIMEOUT)
        phaze_dialogue();
    if (HMagical_breathing() & TIMEOUT)
        region_dialogue();
    if (HSleepy() & TIMEOUT)
        sleep_dialogue();
    if (u.mtimedone && !--u.mtimedone) {
        if (Unchanging())
            u.mtimedone = rnd(100 * gy.youmonst.data.mlevel + 1);
        else if (is_were(gy.youmonst.data))
            you_unwere(FALSE); /* if polycontrl, asks whether to rehumanize */
        else
            rehumanize();
    }
    if (u.ucreamed)
        u.ucreamed--;

    /* Dissipate spell-based protection. */
    if (u.usptime) {
        if (--u.usptime == 0 && u.uspellprot) {
            u.usptime = u.uspmtime;
            u.uspellprot--;
            find_ac();
            if (!Blind())
                Norep(_("The %s haze around you %s."), hcolor(NH_GOLDEN()),
                      u.uspellprot ? _("becomes less dense") : _("disappears"));
        }
    }

    if (u.ugallop) {
        if (--u.ugallop == 0 && u.usteed)
            pline(_("%s stops galloping."), Monnam(u.usteed));
    }

    was_flying = Flying();
    for (upp = u.uprops[0]; upp < ptr_add(u.uprops[0], SIZE(u.uprops)); upp = ptr_add(upp, 1))
        if ((upp.intrinsic & TIMEOUT) && !(--upp.intrinsic & TIMEOUT)) {
            kptr = find_delayed_killer(ptr_diff(upp, u.uprops[0]));
            switch (ptr_diff(upp, u.uprops[0])) {
            case STONED:
                if (kptr && chars[kptr.name + 0]) {
                    svk.killer.format = kptr.format;
                    strcpy(svk.killer.name, kptr.name);
                } else {
                    svk.killer.format = NO_KILLER_PREFIX;
                    strcpy(svk.killer.name, _("killed by petrification"));
                }
                dealloc_killer(kptr);
                /* (unlike sliming, you aren't changing form here) */
                done_timeout(STONING, STONED);
                break;
            case SLIMED:
                slimed_to_death(kptr); /* done_timeout(TURNED_SLIME,SLIMED) */
                break;
            case VOMITING:
                make_vomiting(0, TRUE);
                break;
            case SICK:
                /* hero might be able to bounce back from food poisoning,
                   but not other forms of illness */
                if ((u.usick_type & SICK_NONVOMITABLE) == 0
                    && rn2(100) < ACURR(A_CON)) {
                    You(_("have recovered from your illness."));
                    make_sick(0, 0, FALSE, SICK_ALL);
                    exercise(A_CON, FALSE);
                    adjattrib(A_CON, -1, 1);
                    break;
                }
                urgent_pline(_("You die from your illness."));
                if (kptr && chars[kptr.name + 0]) {
                    svk.killer.format = kptr.format;
                    strcpy(svk.killer.name, kptr.name);
                } else {
                    svk.killer.format = KILLED_BY_AN;
                    chars[svk.killer.name + 0] = 0; /* take the default */
                }
                dealloc_killer(kptr);

                if ((m_idx = name_to_mon(svk.killer.name,
                                         null)) >= LOW_PM) {
                    if (type_is_pname(mons[m_idx])) {
                        svk.killer.format = KILLED_BY;
                    } else if (mons[m_idx].geno & G_UNIQ) {
                        strcpy(svk.killer.name, the(svk.killer.name));
                        svk.killer.format = KILLED_BY;
                    }
                }
                done_timeout(POISONING, SICK);
                u.usick_type = 0;
                break;
            case FAST:
                if (!Very_fast())
                    You_feel(_("yourself slow down%s."),
                             Fast() ? _(" a bit") : _(""));
                break;
            case CONFUSION:
                /* So make_confused works properly */
                set_itimeout(ref_of(u.uprops[CONFUSION], "intrinsic"), 1);
                make_confused(0, TRUE);
                if (!Confusion())
                    stop_occupation();
                break;
            case STUNNED:
                set_itimeout(ref_of(u.uprops[STUNNED], "intrinsic"), 1);
                make_stunned(0, TRUE);
                if (!Stunned())
                    stop_occupation();
                break;
            case BLINDED: {
                let was_blind = +!!Blind();

                set_itimeout(ref_of(u.uprops[BLINDED], "intrinsic"), 1);
                make_blinded(0, TRUE);
                if (was_blind && !Blind())
                    stop_occupation();
                break;
            }
            case DEAF:
                set_itimeout(ref_of(u.uprops[DEAF], "intrinsic"), 1);
                make_deaf(0, TRUE);
                disp.botl = TRUE;
                if (!Deaf())
                    stop_occupation();
                break;
            case INVIS:
                newsym(u.ux, u.uy);
                if (!Invis() && !BInvis() && !Blind()) {
                    You(!See_invisible()
                            ? _("are no longer invisible.")
                            : _("can no longer see through yourself."));
                    stop_occupation();
                }
                break;
            case SEE_INVIS:
                set_mimic_blocking(); /* do special mimic handling */
                see_monsters();       /* make invis mons appear */
                newsym(u.ux, u.uy);   /* make self appear */
                stop_occupation();
                break;
            case WOUNDED_LEGS:
                heal_legs(0);
                stop_occupation();
                break;
            case HALLUC:
                set_itimeout(ref_of(u.uprops[HALLUC], "intrinsic"), 1);
                make_hallucinated(0, TRUE, 0);
                if (!Hallucination())
                    stop_occupation();
                break;
            case SLEEPY:
                if (unconscious() || Sleep_resistance()) {
                    incr_itimeout(ref_of(u.uprops[SLEEPY], "intrinsic"), rnd(100));
                } else if (Sleepy()) {
                    You(_("fall asleep."));
                    sleeptime = rnd(20);
                    fall_asleep(-sleeptime, TRUE);
                    incr_itimeout(ref_of(u.uprops[SLEEPY], "intrinsic"), sleeptime + rnd(100));
                }
                break;
            case LEVITATION:
                /* timed Levitation is ordinary, timed Flying is via
                   #wizintrinsic only; still, we want to avoid float_down()
                   reporting "you have stopped levitating and are now flying"
                   when both are timing out together; if that is about to
                   happen, end Flying early to skip feedback about it;
                   assumes Levitation is handled before Flying */
                if ((HFlying() & TIMEOUT) == 1)
                    set_itimeout(ref_of(u.uprops[FLYING], "intrinsic"), 0); /* bypass 'case FLYING' */
                float_down(I_SPECIAL | TIMEOUT, 0);
                break;
            case FLYING:
                /* timed Flying is via #wizintrinsic only */
                if (was_flying && !Flying()) {
                    disp.botl = TRUE;
                    You(_("land."));
                    spoteffects(TRUE);
                }
                break;
            case ACID_RES:
                if (!Acid_resistance()) {
                    if (eating_dangerous_corpse(ACID_RES)) {
                        /* extend temporary acid resistance if in midst
                           of eating an acidic corpse; this will repeat
                           until eating is finished or interrupted */
                        set_itimeout(ref_of(u.uprops[ACID_RES], "intrinsic"), 1);
                        break;
                    }
                    if (!Unaware())
                        You(_("no longer feel safe from acid."));
                }
                break;
            case STONE_RES:
                if (!Stone_resistance()) {
                    if (eating_dangerous_corpse(STONE_RES)) {
                        /* extend temporary stoning resistance if in midst
                           of eating a stoning corpse; this will repeat
                           until eating is finished or interrupted */
                        set_itimeout(ref_of(u.uprops[STONE_RES], "intrinsic"), 1);
                        break;
                    }
                    if (!Unaware())
                        You(_("no longer feel secure from petrification."));
                    /* no-op if not wielding a cockatrice corpse;
                       uswapwep case is always a no-op because two-weapon
                       combat is only possible with two one-handed weapons
                       or weapon tools, not corpses */
                    wielding_corpse(uwep, null, FALSE);
                    wielding_corpse(uswapwep, null, FALSE);
                }
                break;
            case FIRE_RES:
                /* timed fire resistance and timed water walking combine
                   as a way to survive lava after multiple life-saving
                   attempts fail to relocate hero; skip timeout message
                   if hero has acquired fire resistance in the meantime */
                if (!Fire_resistance())
                    Your(_("temporary ability to survive burning has ended."));
                break;
            case WWALKING:
                /* [see fire resistance] */
                if (!Wwalking())
                    Your(_("temporary ability to walk on liquid has ended."));
                break;
            case DISPLACED:
                if (!Displaced()) /* give a message */
                    toggle_displacement(null, 0, FALSE);
                break;
            case WARN_OF_MON:
                /* timed Warn_of_mon is via #wizintrinsic only */
                if (!Warn_of_mon()) {
                    let wptr = svc.context.warntype.species;

                    svc.context.warntype.species = null;
                    svc.context.warntype.speciesidx = NON_PM;
                    if (wptr)
                        You(_("are no longer warned about %s."),
                            makeplural(wptr.pmnames[NEUTRAL]));
                }
                break;
            case PASSES_WALLS:
                if (!Passes_walls()) {
                    if (stuck_in_wall())
                        You_feel(_("hemmed in again."));
                    else
                        pline(_("You're back to your %s self again."),
                              !Upolyd() ? _("normal") : _("unusual"));
                }
                break;
            case MAGICAL_BREATHING:
                if (!Breathless()) {
                    if (region_danger())
                        You(_("cough%s"),
                            Poison_resistance() ? _(".") : _(" and spit blood!"));
                }
                break;
            case STRANGLED:
                svk.killer.format = KILLED_BY;
                strcpy(svk.killer.name, u.uburied ? _("suffocation") : _("strangulation"))
;
                done_timeout(DIED, STRANGLED);
                /* must be declining to die in explore|wizard mode;
                   treat like being cured of strangulation by prayer */
                if (uamul && uamul.otyp == AMULET_OF_STRANGULATION) {
                    Your(_("amulet vanishes!"));
                    useup(uamul);
                }
                break;
            case FUMBLING:
                /* call this only when a move took place.  */
                /* otherwise handle fumbling msgs locally. */
                if (u.umoved && !(Levitation() || Flying())) {
                    slip_or_trip();
                    nomul(-2);
                    gm.multi_reason = _("fumbling");
                    gn.nomovemsg = _("");
                    /* The more you are carrying the more likely you
                     * are to make noise when you fumble.  Adjustments
                     * to this number must be thoroughly play tested.
                     */
                    if ((inv_weight() > (WT_NOISY_INV * -1))) {
                        if (!Deaf())
                            You(_("make a lot of noise!"));
                        wake_nearby(FALSE);
                    }
                }
                /* from outside means slippery ice; don't reset
                   counter if that's the only fumble reason */
                u.uprops[FUMBLING].intrinsic = and64(u.uprops[FUMBLING].intrinsic, ~FROMOUTSIDE);
                if (Fumbling())
                    incr_itimeout(ref_of(u.uprops[FUMBLING], "intrinsic"), rnd(20));

                if (iflags.defer_decor) {
                    /* 'mention_decor' was deferred for message sequencing
                       reasons; catch up now */
                    deferred_decor(FALSE);
                }
                break;
            case DETECT_MONSTERS:
                see_monsters();
                break;
            case GLIB:
                make_glib(0); /* might update persistent inventory */
                break;
            case PROT_FROM_SHAPE_CHANGERS:
                /* timed Protection_from_shape_changers is via
                   #wizintrinsic only */
                if (!Protection_from_shape_changers())
                    restartcham();
                break;
            }
        }

    run_timers();
}

export function fall_asleep(how_long, wakeup_msg) { /* void */
    stop_occupation();
    nomul(how_long);
    gm.multi_reason = _("sleeping");
    /* #if 0: not in this build */

    /* early wakeup from combat won't be possible until next monster turn */
    u.usleep = svm.moves;
    gn.nomovemsg = wakeup_msg ? _("You wake up.") : You_can_move_again();
}

/* Attach an egg hatch timeout to the given egg.
 *      when = Time to hatch, usually only passed if re-creating an
 *             existing hatch timer. Pass 0L for random hatch time.
 */
export function attach_egg_hatch_timeout(egg, when) { /* void */
    let i;

    /* stop previous timer, if any */
    stop_timer(HATCH_EGG, obj_to_any(egg));

    /*
     * Decide if and when to hatch the egg.  The old hatch_it() code tried
     * once a turn from age 151 to 200 (inclusive), hatching if it rolled
     * a number x, 1<=x<=age, where x>150.  This yields a chance of
     * hatching > 99.9993%.  Mimic that here.
     */
    if (!when) {
        for (i = (MAX_EGG_HATCH_TIME - 50) + 1; i <= MAX_EGG_HATCH_TIME; i++)
            if (rnd(i) > 150) {
                /* egg will hatch */
                when = i;
                break;
            }
    }
    if (when) {
        start_timer(when, TIMER_OBJECT, HATCH_EGG, obj_to_any(egg));
    }
}

/* prevent an egg from ever hatching */
export function kill_egg(egg) { /* void */
    /* stop previous timer, if any */
    stop_timer(HATCH_EGG, obj_to_any(egg));
}

/* timer callback routine: hatch the given egg */
export function hatch_egg(arg, timeout) { /* void */
    const $frame = stack_frame(); try {
    let egg;
    let mon, mon2;
    let cc = stack_struct(struct_nhcoord);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let yours, silent, knows_egg = FALSE;
    let cansee_hatchspot = FALSE;
    let i, mnum, hatchcount = 0;

    egg = arg.a_obj;
    /* sterilized while waiting */
    if (egg.corpsenm == NON_PM)
        return;

    mon = mon2 = null;
    mnum = big_to_little(egg.corpsenm);
    /* The identity of one's father is learned, not innate */
    yours = (egg.spe || (!flags.female && carried(egg) && !rn2(2)) ? 1 : 0);
    silent = +(timeout != svm.moves); /* hatched while away */

    /* only can hatch when in INVENT, FLOOR, MINVENT;
       get_obj_location() will fail for MIGRATING, also for CONTAINED
       and BURIED when the flags for those aren't included in the call */
    if (get_obj_location(egg, x, y, 0)) {
        hatchcount = rnd(int(egg.quan));
        cansee_hatchspot = +(cansee(x[0], y[0]) && !silent);
        if (!(mons[mnum].geno & G_UNIQ)
            && !(svm.mvitals[mnum].mvflags & (G_GENOD | G_EXTINCT))) {
            for (i = hatchcount; i > 0; i--) {
                if (!enexto(cc, x[0], y[0], mons[mnum])
                    || !(mon = makemon(mons[mnum], cc.x, cc.y,
                                       NO_MINVENT | MM_NOMSG)))
                    break;
                /* tame if your own egg hatches while you're on the
                   same dungeon level, or any dragon egg which hatches
                   while it's in your inventory */
                if ((yours && !silent)
                    || (carried(egg) && mon.data.mlet == S_DRAGON)) {
                    if (tamedog(mon, null, FALSE)) {
                        if (carried(egg) && mon.data.mlet != S_DRAGON)
                            mon.mtame = 20;
                    }
                }
                if (svm.mvitals[mnum].mvflags & G_EXTINCT)
                    break;  /* just made last one */
                mon2 = mon; /* in case makemon() fails on 2nd egg */
            }
            if (!mon)
                mon = mon2;
            hatchcount -= i;
            egg.quan -= hatchcount;
        }
    /* #if 0: not in this build */
    }

    if (mon) {
        let monnambuf = stack_array(char, BUFSZ), carriedby = stack_array(char, BUFSZ);
        let siblings = +(hatchcount > 1), redraw = FALSE;

        if (cansee_hatchspot) {
            /* [bug?  m_monnam() yields accurate monster type
               regardless of hallucination] */
            sprintf(monnambuf, _("%s%s"), siblings ? _("some ") : _(""), siblings ? makeplural(m_monnam(mon)) : an(m_monnam(mon)))
;
            /* we don't learn the egg type here because learning
               an egg type requires either seeing the egg hatch
               or being familiar with the egg already,
               as well as being able to see the resulting
               monster, checked below
            */
        }
        switch (egg.where) {
        case OBJ_INVENT:
            knows_egg = TRUE; /* true even if you are blind */
            if (!cansee_hatchspot)
                You_feel(_("%s %s from your pack!"), something(),
                         locomotion(mon.data, _("drop")));
            else
                You_see(_("%s %s out of your pack!"), monnambuf,
                        locomotion(mon.data, _("drop")));
            if (yours) {
                pline(_("%s %s %s like \"%s%s\""),
                      siblings ? _("Their") : _("Its"),
                      ing_suffix(cry_sound(mon)),
                      (is_silent(mon.data) || Deaf()) ? _("seems") : _("sounds"),
                      flags.female ? _("mommy") : _("daddy"), egg.spe ? _(".") : _("?"));
            } else if (mon.data.mlet == S_DRAGON && !Deaf()) {
                   ;
                verbalize(_("Gleep!")); /* Mything eggs :-) */
            }
            break;

        case OBJ_FLOOR:
            if (cansee_hatchspot) {
                knows_egg = TRUE;
                You_see(_("%s hatch."), monnambuf);
                redraw = TRUE; /* update egg's map location */
            }
            break;

        case OBJ_MINVENT:
            if (cansee_hatchspot) {
                /* egg carrying monster might be invisible */
                mon2 = egg.v.v_ocarry;
                if (canseemon(mon2)
                    && (!mon2.wormno || cansee(mon2.mx, mon2.my))) {
                    sprintf(carriedby, _("%s pack"), s_suffix(a_monnam(mon2)))
;
                    knows_egg = TRUE;
                } else if (is_pool(mon.mx, mon.my)) {
                    strcpy(carriedby, _("empty water"));
                } else {
                    strcpy(carriedby, _("thin air"));
                }
                You_see(_("%s %s out of %s!"), monnambuf,
                        locomotion(mon.data, _("drop")), carriedby);
            }
            break;

        default:
            impossible(_("egg hatched where? (%d)"), egg.where);
            break;
        }

        if (cansee_hatchspot && knows_egg)
            learn_egg_type(mnum);

        if (egg.quan > 0) {
            /* still some eggs left; we didn't split the stack, just
               subtracted from quantity so weight needs to be updated;
               for remainder of stack, add a new, short hatch timer */
            attach_egg_hatch_timeout(egg, rnd(12));
            /* container_weight(arg) updates arg->owt, and if contained,
               its enclosing container arg->ocontainer (recursively)
               [egg won't be contained due to conditions imposed above] */
            container_weight(egg);
        } else if (carried(egg)) {
            useup(egg);
        } else {
            /* free egg here because we use it above */
            obj_extract_self(egg);
            obfree(egg, null);
            if ((mon = m_at(x[0],y[0])) && !hideunder(mon) && cansee(x[0], y[0]))
                redraw = TRUE;
        }
        if (redraw)
            newsym(x[0], y[0]);
    }
    } finally { stack_pop($frame); }
}

/* Learn to recognize eggs of the given type. */
export function learn_egg_type(mnum) { /* void */
    /* baby monsters hatch from grown-up eggs */
    mnum = little_to_big(mnum);
    svm.mvitals[mnum].mvflags |= MV_KNOWS_EGG;
    /* we might have just learned about other eggs being carried */
    update_inventory();
}

/* Attach a fig_transform timeout to the given figurine. */
export function attach_fig_transform_timeout(figurine) { /* void */
    let i;

    /* stop previous timer, if any */
    stop_timer(FIG_TRANSFORM, obj_to_any(figurine));

    /*
     * Decide when to transform the figurine.
     */
    i = rnd(9000) + 200;
    /* figurine will transform */
    start_timer(i, TIMER_OBJECT, FIG_TRANSFORM,
                       obj_to_any(figurine));
}

/* give a fumble message */
function slip_or_trip() { /* void */
    const $frame = stack_frame(); try {
    let otmp = vobj_at(u.ux, u.uy), otmp2, saddle;
    let what;
    let buf = stack_array(char, BUFSZ);
    let on_foot = +!u.usteed;

    if (otmp && on_foot && !u.uinwater && is_pool(u.ux, u.uy))
        otmp = null;

    if (otmp && on_foot) { /* trip over something in particular */
        /*
          If there is only one item, it will have just been named
          during the move, so refer to it by pronoun; otherwise,
          if the top item has been or can be seen, refer to it by
          name; if not, look for rocks to trip over; trip over
          anonymous "something" if there aren't any rocks.
        */
        what = (iflags.last_msg == PLNMSG_ONE_ITEM_HERE)
                ? ((otmp.quan == 1) ? _("it")
                      : Hallucination() ? _("they") : _("them"))
                : (otmp.dknown || !Blind())
                      ? doname(otmp)
                      : ((otmp2 = sobj_at(ROCK, u.ux, u.uy)) == null
                             ? something()
                             : (otmp2.quan == 1 ? _("a rock") : _("some rocks")));
        if (Hallucination()) {
            what = strcpy(buf, what);
            chars[buf + 0] = highc(chars[buf + 0]);
            pline(_("Egads!  %s bite%s your %s!"), what,
                  (!otmp || otmp.quan == 1) ? _("s") : _(""), body_part(FOOT));
        } else {
            You(_("trip over %s."), what);
        }
        if (!uarmf && otmp.otyp == CORPSE
            && touch_petrifies(mons[otmp.corpsenm]) && !Stone_resistance()) {
            sprintf(svk.killer.name, _("tripping over %s corpse"), an(mons[otmp.corpsenm].pmnames[NEUTRAL]))
;
            instapetrify(svk.killer.name);
        }
    } else if ((HFumbling() & FROMOUTSIDE) || (is_ice(u.ux, u.uy) && !rn2(3))) {
        /* is fumbling from ice alone? */
        let ice_only = +!(EFumbling() || (HFumbling() & ~FROMOUTSIDE));

        pline(_("%s %s %s the ice."),
              u.usteed ? upstart(x_monnam(u.usteed, ARTICLE_THE, 0,
                                          SUPPRESS_SADDLE, FALSE))
                       : _("You"),
              /* "steed": arbitrary value that will use third person verb
                 regardless of what u.usteed might be named, as opposed to
                 "you" (second person, which won't have final 's' added) */
              vtense(u.usteed ? _("steed") : _("you"), rn2(2) ? _("slip") : _("slide")),
              /* sometimes slipping due to ice occurs during turn that hero
                 has just moved off the ice; phrase things differently then */
              is_ice(u.ux, u.uy) ? _("on") : _("off"));
        /* fumbling outside of ice while mounted always causes the hero to
           fall from the saddle (unless it is cursed), so to avoid a
           counterintuitive effect where ice makes riding _less_ hazardous,
           unconditionally dismount if fumbling is from a non-ice source */
        if (!on_foot
            && ((saddle = which_armor(u.usteed, W_SADDLE)) == null
                || !saddle.cursed)
            && (!ice_only || !rn2(3))) {
            You(_("lose your balance."));
            dismount_steed(DISMOUNT_FELL);
        } else if (!rn2(10 + ACURR(A_DEX))) {
            /* Maybe slip in a random direction.  This takes place after
               the hero has already changed location.  If the hero is
               in grid bug form, only allow forward hurtle, otherwise a
               90 degree orthogonal one after the step would make the
               combined move appear to be a single diagonal step. */
            if (!NODIAG(u.umonnum))
                confdir(TRUE); /* sets u.dx and u.dy */
            /* Only hurtle if the random direction won't move hero back
               to same spot where this move started. */
            if (u.ux + u.dx != u.ux0 || u.uy + u.dy != u.uy0)
                hurtle(u.dx, u.dy, 1, FALSE);
        }
    } else {
        if (on_foot) {
            switch (rn2(4)) {
            case 1:
                You(_("trip over your own %s."),
                    Hallucination() ? _("elbow") : makeplural(body_part(FOOT)));
                break;
            case 2:
                You(_("slip %s."),
                    Hallucination() ? _("on a banana peel") : _("and nearly fall"));
                break;
            case 3:
                You(_("flounder."));
                break;
            default:
                You(_("stumble."));
                break;
            }

        /* mounted; saddle should never end up being Null here;
           don't fall off when it happens to be cursed */
        } else if ((saddle = which_armor(u.usteed, W_SADDLE)) == null
                   || !saddle.cursed) {
            switch (rn2(4)) {
            case 1:
                Your(_("%s slip out of the stirrups."),
                     makeplural(body_part(FOOT)));
                break;
            case 2:
                You(_("let go of the reins."));
                break;
            case 3:
                You(_("bang into the saddle-horn."));
                break;
            default:
                You(_("slide to one side of the saddle."));
                break;
            }
            dismount_steed(DISMOUNT_FELL);
        }
    }
    } finally { stack_pop($frame); }
}

/* Print a lamp flicker message with tailer.  Only called if seen. */
function see_lamp_flicker(obj, tailer) { /* void */
    switch (obj.where) {
    case OBJ_INVENT:
    case OBJ_MINVENT:
        pline(_("%s flickers%s."), Yname2(obj), tailer);
        break;
    case OBJ_FLOOR:
        You_see(_("%s flicker%s."), an(xname(obj)), tailer);
        break;
    }
}

/* Print a dimming message for brass lanterns.  Only called if seen. */
function lantern_message(obj) { /* void */
    /* from adventure */
    switch (obj.where) {
    case OBJ_INVENT:
        Your(_("lantern is getting dim."));
        if (Hallucination())
            pline(_("Batteries have not been invented yet."));
        break;
    case OBJ_FLOOR:
        You_see(_("a lantern getting dim."));
        break;
    case OBJ_MINVENT:
        pline(_("%s lantern is getting dim."), s_suffix(Monnam(obj.v.v_ocarry)));
        break;
    }
}

/*
 * Timeout callback for objects that are burning. E.g. lamps, candles.
 * See begin_burn() for meanings of obj->age and obj->spe.
 */
export function burn_object(arg, timeout) { /* void */
    const $frame = stack_frame(); try {
    let obj = arg.a_obj;
    let canseeit, many, menorah, need_newsym, need_invupdate, bytouch;
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let whose = stack_array(char, BUFSZ);

    menorah = +(obj.otyp == CANDELABRUM_OF_INVOCATION);
    many = menorah ? +(obj.spe > 1) : +(obj.quan > 1);

    /* timeout while away */
    if (timeout != svm.moves) {
        let how_long = svm.moves - timeout;

        if (how_long >= obj.age) {
            obj.age = 0;
            end_burn(obj, FALSE);

            if (menorah) {
                obj.spe = 0; /* no more candles */
                obj.owt = unsigned(weight(obj));
            } else if (Is_candle(obj) || obj.otyp == POT_OIL) {
                let mtmp = null;

                if (obj.where == OBJ_FLOOR)
                    mtmp = m_at(obj.ox, obj.oy);
                /* get rid of candles and burning oil potions;
                   we know this object isn't carried by hero,
                   nor is it migrating */
                obj_extract_self(obj);
                obfree(obj, null);
                obj = null;
                if (mtmp)
                    maybe_unhide_at(mtmp.mx, mtmp.my);
            }
        } else {
            obj.age -= how_long;
            begin_burn(obj, TRUE);
        }
        return;
    }

    /* only interested in INVENT, FLOOR, and MINVENT */
    if (get_obj_location(obj, x, y, 0)) {
        canseeit = +(!Blind() && cansee(x[0], y[0]));
        /* set `whose[]' to be "Your " or "Fred's " or "The goblin's " */
        Shk_Your(whose, obj);
    } else {
        canseeit = FALSE;
    }
    /* when carrying the light source, you can feel the heat from lit lamp
       or candle so you'll be notified when it burns out even if blind at
       the time; brass lantern doesn't radiate sufficient heat for that
       (however, inventory formatting drops "(lit)" so player can tell) */
    bytouch = +(obj.where == OBJ_INVENT && obj.otyp != BRASS_LANTERN);
    need_newsym = need_invupdate = FALSE;

    /* obj->age is the age remaining at this point.  */
    switch (obj.otyp) {
    case POT_OIL:
        /* this should only be called when we run out */
        if (canseeit) {
            switch (obj.where) {
            case OBJ_INVENT:
                need_invupdate = TRUE;
                /* FALLTHROUGH */;
                /*FALLTHRU*/
            case OBJ_MINVENT:
                pline(_("%spotion of oil has burnt away."), whose);
                break;
            case OBJ_FLOOR:
                You_see(_("a burning potion of oil go out."));
                need_newsym = TRUE;
                break;
            }
        }
        end_burn(obj, FALSE); /* turn off light source */
        if (carried(obj)) {
            useupall(obj);
        } else {
            /* clear migrating obj's destination code before obfree
               to avoid false complaint of deleting worn item */
            if (obj.where == OBJ_MIGRATING)
                obj.owornmask = 0;
            obj_extract_self(obj);
            obfree(obj, null);
        }
        obj = null;
        break;

    case BRASS_LANTERN:
    case OIL_LAMP:
        switch (int(obj.age)) {
        case 150:
        case 100:
        case 50:
            if (canseeit) {
                if (obj.otyp == BRASS_LANTERN)
                    lantern_message(obj);
                else
                    see_lamp_flicker(obj,
                                     obj.age == 50 ? _(" considerably") : _(""));
            }
            break;

        case 25:
            if (canseeit) {
                if (obj.otyp == BRASS_LANTERN) {
                    lantern_message(obj);
                } else {
                    switch (obj.where) {
                    case OBJ_INVENT:
                    case OBJ_MINVENT:
                        pline(_("%s seems about to go out."), Yname2(obj));
                        break;
                    case OBJ_FLOOR:
                        You_see(_("%s about to go out."), an(xname(obj)));
                        break;
                    }
                }
            }
            break;

        case 0:
            /* even if blind you'll know if holding it */
            if (canseeit || bytouch) {
                switch (obj.where) {
                case OBJ_INVENT:
                    need_invupdate = TRUE;
                    /* FALLTHROUGH */;
                    /*FALLTHRU*/
                case OBJ_MINVENT:
                    if (obj.otyp == BRASS_LANTERN)
                        pline(_("%slantern has run out of power."), whose);
                    else
                        pline(_("%s has gone out."), Yname2(obj));
                    break;
                case OBJ_FLOOR:
                    if (obj.otyp == BRASS_LANTERN)
                        You_see(_("a lantern run out of power."));
                    else
                        You_see(_("%s go out."), an(xname(obj)));
                    break;
                }
            }
            end_burn(obj, FALSE);
            break;

        default:
            /*
             * Someone added fuel to the lamp while it was
             * lit. Just fall through and let begin_burn()
             * handle the new age.
             */
            break;
        }

        if (obj.age)
            begin_burn(obj, TRUE);

        break;

    case CANDELABRUM_OF_INVOCATION:
    case TALLOW_CANDLE:
    case WAX_CANDLE:
        switch (obj.age) {
        case 75:
            if (canseeit)
                switch (obj.where) {
                case OBJ_INVENT:
                case OBJ_MINVENT:
                    pline(_("%s%scandle%s getting short."), whose,
                          menorah ? _("candelabrum's ") : _(""),
                          many ? _("s are") : _(" is"));
                    break;
                case OBJ_FLOOR:
                    You_see(_("%scandle%s getting short."),
                            menorah ? _("a candelabrum's ") : many ? _("some ")
                                                                : _("a "),
                            many ? _("s") : _(""));
                    break;
                }
            break;

        case 15:
            if (canseeit)
                switch (obj.where) {
                case OBJ_INVENT:
                case OBJ_MINVENT:
                    pline(_("%s%scandle%s flame%s flicker%s low!"), whose,
                          menorah ? _("candelabrum's ") : _(""), many ? _("s'") : _("'s"),
                          many ? _("s") : _(""), many ? _("") : _("s"));
                    break;
                case OBJ_FLOOR:
                    You_see(_("%scandle%s flame%s flicker low!"),
                            menorah ? _("a candelabrum's ") : many ? _("some ")
                                                                : _("a "),
                            many ? _("s'") : _("'s"), many ? _("s") : _(""));
                    break;
                }
            break;

        case 0:
            /* we know even if blind and in our inventory */
            if (canseeit || bytouch) {
                if (menorah) {
                    switch (obj.where) {
                    case OBJ_INVENT:
                        need_invupdate = TRUE;
                        /* FALLTHROUGH */;
                        /*FALLTHRU*/
                    case OBJ_MINVENT:
                        pline(_("%scandelabrum's flame%s."), whose,
                              many ? _("s die") : _(" dies"));
                        break;
                    case OBJ_FLOOR:
                        You_see(_("a candelabrum's flame%s die."),
                                many ? _("s") : _(""));
                        break;
                    }
                } else {
                    switch (obj.where) {
                    case OBJ_INVENT:
                        /* no need_invupdate for update_inventory() necessary;
                           useupall() -> freeinv() handles it */
                           /* FALLTHROUGH */;
                        /*FALLTHRU*/
                    case OBJ_MINVENT:
                        pline(_("%s %s consumed!"), Yname2(obj),
                              many ? _("are") : _("is"));
                        break;
                    case OBJ_FLOOR:
                        /*
                          You see some wax candles consumed!
                          You see a wax candle consumed!
                         */
                        You_see(_("%s%s consumed!"), many ? _("some ") : _(""),
                                many ? xname(obj) : an(xname(obj)));
                        need_newsym = TRUE;
                        break;
                    }

                    /* post message */
                    pline(Hallucination()
                              ? (many ? _("They shriek!") : _("It shrieks!"))
                              : Blind() ? _("") : (many ? _("Their flames die.")
                                                   : _("Its flame dies.")));
                }
            }
            end_burn(obj, FALSE);

            if (menorah) {
                obj.spe = 0; /* no candles */
                obj.owt = unsigned(weight(obj));
                if (carried(obj))
                    need_invupdate = TRUE;
            } else {
                if (carried(obj)) {
                    useupall(obj);
                } else {
                    let onfloor = +(obj.where == OBJ_FLOOR);

                    /* clear migrating obj's destination code
                       so obfree won't think this item is worn */
                    if (obj.where == OBJ_MIGRATING)
                        obj.owornmask = 0;
                    obj_extract_self(obj);
                    if (onfloor)
                        maybe_unhide_at(x[0], y[0]);
                    obfree(obj, null);
                }
                obj = null;
            }
            break; /* case [age ==] 0 */

        default:
            /*
             * Someone added fuel (candles) to the menorah while
             * it was lit. Just fall through and let begin_burn()
             * handle the new age.
             */
            break;
        }

        if (obj && obj.age)
            begin_burn(obj, TRUE);
        break; /* case [otyp ==] candelabrum|tallow_candle|wax_candle */

    default:
        impossible(_("burn_object: unexpected obj %s"), xname(obj));
        break;
    }
    if (need_newsym)
        newsym(x[0], y[0]);
    if (need_invupdate)
        update_inventory();
    } finally { stack_pop($frame); }
}

/*
 * Start a burn timeout on the given object. If not "already lit" then
 * create a light source for the vision system.  There had better not
 * be a burn already running on the object.
 *
 * Magic lamps stay lit as long as there's a genie inside, so don't start
 * a timer.
 *
 * Burn rules:
 *      potions of oil, lamps & candles:
 *              age = # of turns of fuel left
 *              spe = <unused>
 *      magic lamps:
 *              age = <unused>
 *              spe = 0 not lightable, 1 lightable forever
 *      candelabrum:
 *              age = # of turns of fuel left
 *              spe = # of candles
 *
 * Once the burn begins, the age will be set to the amount of fuel
 * remaining _once_the_burn_finishes_.  If the burn is terminated
 * early then fuel is added back.
 *
 * This use of age differs from the use of age for corpses and eggs.
 * For the latter items, age is when the object was created, so we
 * know when it becomes "bad".
 *
 * This is a "silent" routine - it should not print anything out.
 */
export function begin_burn(obj, already_lit) { /* void */
    const $frame = stack_frame(); try {
    let radius = 3;
    let turns = 0;
    let do_timer = TRUE;

    if (obj.age == 0 && obj.otyp != MAGIC_LAMP && !artifact_light(obj))
        return;

    switch (obj.otyp) {
    case MAGIC_LAMP:
        obj.lamplit = 1;
        do_timer = FALSE;
        break;

    case POT_OIL:
        turns = obj.age;
        if (obj.oeroded)
            turns = Math.trunc((3 * turns + 2) / 4);
        radius = 1; /* very dim light */
        break;

    case BRASS_LANTERN:
    case OIL_LAMP:
        /* magic times are 150, 100, 50, 25, and 0 */
        if (obj.age > 150)
            turns = obj.age - 150;
        else if (obj.age > 100)
            turns = obj.age - 100;
        else if (obj.age > 50)
            turns = obj.age - 50;
        else if (obj.age > 25)
            turns = obj.age - 25;
        else
            turns = obj.age;
        break;

    case CANDELABRUM_OF_INVOCATION:
    case TALLOW_CANDLE:
    case WAX_CANDLE:
        /* magic times are 75, 15, and 0 */
        if (obj.age > 75)
            turns = obj.age - 75;
        else if (obj.age > 15)
            turns = obj.age - 15;
        else
            turns = obj.age;
        radius = candle_light_range(obj);
        break;

    default:
        /* [ALI] Support artifact light sources */
        if (artifact_light(obj)) {
            obj.lamplit = 1;
            do_timer = FALSE;
            radius = arti_light_radius(obj);
        } else {
            impossible(_("begin burn: unexpected %s"), xname(obj));
            turns = obj.age;
        }
        break;
    }

    if (do_timer) {
        if (start_timer(turns, TIMER_OBJECT, BURN_OBJECT, obj_to_any(obj))) {
            obj.lamplit = 1;
            obj.age -= turns;
            if (carried(obj) && !already_lit)
                update_inventory();
        } else {
            obj.lamplit = 0;
        }
    } else {
        if (carried(obj) && !already_lit)
            update_inventory();
    }

    if (obj.lamplit && !already_lit) {
        let x = stack_var(coordxy), y = stack_var(coordxy);

        if (get_obj_location(obj, x, y, CONTAINED_TOO | BURIED_TOO))
            new_light_source(x[0], y[0], radius, LS_OBJECT, obj_to_any(obj));
        else
            impossible(_("begin_burn: can't get obj position"));
    }
    } finally { stack_pop($frame); }
}

/*
 * Stop a burn timeout on the given object if timer attached.  Darken
 * light source.
 */
export function end_burn(obj, timer_attached) { /* void */
    if (!obj.lamplit) {
        impossible(_("end_burn: obj %s not lit"), xname(obj));
        return;
    }

    if (obj.otyp == MAGIC_LAMP || artifact_light(obj))
        timer_attached = FALSE;

    if (!timer_attached) {
        /* [DS] Cleanup explicitly, since timer cleanup won't happen */
        del_light_source(LS_OBJECT, obj_to_any(obj));
        obj.lamplit = 0;
        if (obj.where == OBJ_INVENT)
            update_inventory();
    } else if (!stop_timer(BURN_OBJECT, obj_to_any(obj)))
        impossible(_("end_burn: obj %s not timed!"), xname(obj));
}

/*
 * Cleanup a burning object if timer stopped.
 */
function cleanup_burn(arg, expire_time) { /* void */
    let obj = arg.a_obj;

    if (!obj.lamplit) {
        impossible(_("cleanup_burn: obj %s not lit"), xname(obj));
        return;
    }

    del_light_source(LS_OBJECT, obj_to_any(obj));
    /* restore unused time */
    obj.age += expire_time - svm.moves;
    obj.lamplit = 0;

    if (obj.where == OBJ_INVENT)
        update_inventory();
}

export function do_storms() { /* void */
    let nstrike;
    let x, y;
    let dirx, diry;
    let count;

    /* no lightning if not stormy level or too often, even then */
    if (!svl.level.flags.stormy || rn2(8))
        return;

    /* the number of strikes is 8-log2(nstrike) */
    for (nstrike = rnd(64); nstrike <= 64; nstrike *= 2) {
        count = 0;
        do {
            x = rnd(COLNO - 1);
            y = rn2(ROWNO);
        } while (++count < 100 && levl()[x][y].typ != CLOUD);

        if (count < 100) {
            dirx = rn2(3) - 1;
            diry = rn2(3) - 1;
            if (dirx != 0 || diry != 0) {
                /* BZ_M_SPELL(BZ_OFS_AD(AD_ELEC)): monster LIGHTNING spell */
                gb.buzzer = null; /* unspecified attacker */
                buzz(BZ_M_SPELL(BZ_OFS_AD(AD_ELEC)), 8, x, y, dirx, diry);
            }
        }
    }

    if (levl()[u.ux][u.uy].typ == CLOUD) {
        /* Inside a cloud during a thunderstorm is deafening. */
        /* Even if already deaf, we sense the thunder's vibrations. */
         ;
        pline(_("Kaboom!!!  Boom!!  Boom!!"));
        incr_itimeout(ref_of(u.uprops[DEAF], "intrinsic"), rn1(20, 30));
        disp.botl = TRUE;
        if (!u.uinvulnerable) {
            stop_occupation();
            nomul(-3);
            gm.multi_reason = _("hiding from thunderstorm");
            gn.nomovemsg = 0;
        }
    } else
        You_hear(_("a rumbling noise."));
}

/* -------------------------------------------------------------------------
 */
/*
 * Generic Timeout Functions.
 *
 * Interface:
 *
 * General:
 *  boolean start_timer(long timeout,short kind,short func_index,
 *                      anything *arg)
 *      Start a timer of kind 'kind' that will expire at time
 *      svm.moves+'timeout'.  Call the function at 'func_index'
 *      in the timeout table using argument 'arg'.  Return TRUE if
 *      a timer was started.  This places the timer on a list ordered
 *      "sooner" to "later".  If an object, increment the object's
 *      timer count.
 *
 *  long stop_timer(short func_index, anything *arg)
 *      Stop a timer specified by the (func_index, arg) pair.  This
 *      assumes that such a pair is unique.  Return the time the
 *      timer would have gone off.  If no timer is found, return 0.
 *      If an object, decrement the object's timer count.
 *
 *  long peek_timer(short func_index, anything *arg)
 *      Return time specified timer will go off (0 if no such timer).
 *
 *  void run_timers(void)
 *      Call timers that have timed out.
 *
 * Save/Restore:
 *  void save_timers(NHFILE *, int range)
 *      Save all timers of range 'range'.  Range is either global
 *      or local.  Global timers follow game play, local timers
 *      are saved with a level.  Object and monster timers are
 *      saved using their respective ids instead of pointers.
 *
 *  void restore_timers(NHFILE *, int range, long adjust)
 *      Restore timers of range 'range'.  If from a ghost pile,
 *      adjust the timeout by 'adjust'.  The object and monster
 *      ids are not restored until later.
 *
 *  void relink_timers(boolean ghostly)
 *      Relink all object and monster timers that had been saved
 *      using their object's or monster's id number.
 *
 * Object Specific:
 *  void obj_move_timers(struct obj *src, struct obj *dest)
 *      Reassign all timers from src to dest.
 *
 *  void obj_split_timers(struct obj *src, struct obj *dest)
 *      Duplicate all timers assigned to src and attach them to dest.
 *
 *  void obj_stop_timers(struct obj *obj)
 *      Stop all timers attached to obj.
 *
 *  boolean obj_has_timer(struct obj *object, short timer_type)
 *      Check whether object has a timer of type timer_type.
 */

/* If defined, then include names when printing out the timer queue */

 const ttable = struct("ttable", {
    f: fnptr_t, cleanup: fnptr_t,

    name: ptr_to(char),
});

/*
 * Table of timeout functions, listed in order of enum timeout_types:
 */
const timeout_funcs = static_array("timeout_funcs", ttable, NUM_TIME_FUNCS, [
    /* object timers */
    { f: rot_organic, name: _("rot_organic") },
    { f: rot_corpse, name: _("rot_corpse") },
    { f: revive_mon, name: _("revive_mon") },
    { f: zombify_mon, name: _("zombify_mon") },
    { f: burn_object, cleanup: cleanup_burn, name: _("burn_object") },
    { f: hatch_egg, name: _("hatch_egg") },
    { f: fig_transform, name: _("fig_transform") },
    { f: shrink_glob, name: _("shrink_glob") },
    /* level timers */
    { f: melt_ice_away, name: _("melt_ice_away") },
    /* currently no monster or global timers */
]);

function kind_name(kind) { /* const char * */
    switch (kind) {
    case TIMER_NONE:
        impossible(_("no timer type"));
        return _("none");
    case TIMER_LEVEL:
        return _("level");
    case TIMER_GLOBAL:
        return _("global");
    case TIMER_OBJECT:
        return _("object");
    case TIMER_MONSTER:
        return _("monster");
    }
    return _("unknown");
}

function print_queue(win, base) { /* void */
    const $frame = stack_frame(); try {
    let curr;
    let buf = stack_array(char, BUFSZ);

    if (!base) {
        putstr()(win, 0, _(" <empty>"));
    } else {
        putstr()(win, 0, _("timeout  id   kind   call"));
        for (curr = base; curr; curr = curr.next) {
            sprintf(buf, _(" %4lld   %4lld  %-6s %s(%s)"), curr.timeout, curr.tid, kind_name(curr.kind), timeout_funcs[curr.func_index].name, fmt_ptr(curr.arg.a_void))

;

            putstr()(win, 0, buf);
        }
    }
    } finally { stack_pop($frame); }
}

/* the #timeout command */
export function wiz_timeout_queue() { /* int */
    const $frame = stack_frame(); try {
    let win;
    let buf = stack_array(char, BUFSZ);
    let propname;
    let intrinsic;
    let i, p, count, longestlen, ln, specindx = 0;

    win = create_nhwindow()(NHW_MENU); /* corner text window */
    if (win == WIN_ERR)
        return ECMD_OK;

    sprintf(buf, _("Current time = %lld."), svm.moves);
    putstr()(win, 0, buf);
    putstr()(win, 0, _(""));
    putstr()(win, 0, _("Active timeout queue:"));
    putstr()(win, 0, _(""));
    print_queue(win, gt.timer_base);

    /* Timed properties:
     * check every one; the majority can't obtain temporary timeouts in
     * normal play but those can be forced via the #wizintrinsic command.
     */
    count = longestlen = 0;
    for (i = 0; (propname = propertynames[i].prop_name) != 0; ++i) {
        p = propertynames[i].prop_num;
        intrinsic = u.uprops[p].intrinsic;
        if (intrinsic & TIMEOUT) {
            ++count;
            if ((ln = int(strlen(propname))) > longestlen)
                longestlen = ln;
        }
        if (specindx == 0 && p == COLD_RES) /* was FIRE_RES but has changed */
            specindx = i;
    }
    putstr()(win, 0, _(""));
    if (!count) {
        putstr()(win, 0, _("No timed properties."));
    } else {
        putstr()(win, 0, _("Timed properties:"));
        putstr()(win, 0, _(""));
        for (i = 0; (propname = propertynames[i].prop_name) != 0; ++i) {
            p = propertynames[i].prop_num;
            intrinsic = u.uprops[p].intrinsic;
            if (intrinsic & TIMEOUT) {
                if (specindx > 0 && i >= specindx) {
                    putstr()(win, 0, _(" -- settable via #wizintrinsic only --"));
                    specindx = 0;
                }
                /* timeout value can be up to 16777215 (0x00ffffff) but
                   width of 4 digits should result in values lining up
                   almost all the time (if/when they don't, it won't
                   look nice but the information will still be accurate) */
                sprintf(buf, _(" %*s %4lld"), -longestlen, propname, (intrinsic & TIMEOUT))
;
                putstr()(win, 0, buf);
            }
        }
    }
    if (u.uswldtim) {
        putstr()(win, 0, _(""));
        /* decremented when engulfer makes a move, so can last longer than
           the number of turns reported if engulfer is slow */
        sprintf(buf, _("Swallow countdown is %u."), u.uswldtim);
        putstr()(win, 0, buf);
    }
    if (u.uinvault) {
        putstr()(win, 0, _(""));
        sprintf(buf, _("Vault counter is %d."), u.uinvault);
        putstr()(win, 0, buf);
    }
    if (any_visible_region()) {
        visible_region_summary(win);
    }
    if (svl.level.flags.stasis_until >= svm.moves) {
        putstr()(win, 0, _(""));
        sprintf(buf, _("Level is no-teleport for %lld %s."), svl.level.flags.stasis_until - svm.moves + 1, (svl.level.flags.stasis_until - svm.moves > 0)
                  ? _("turns") : _("more turn"))

;
        putstr()(win, 0, buf);
    }
    display_nhwindow()(win, FALSE);
    destroy_nhwindow()(win);

    return ECMD_OK;
    } finally { stack_pop($frame); }
}

export function timer_sanity_check() { /* void */
    const $frame = stack_frame(); try {
    let curr;
    let t_id;
    let x = stack_var(coordxy), y = stack_var(coordxy);

    for (curr = gt.timer_base; curr; curr = curr.next) {
        t_id = curr.tid;
        switch (curr.kind) {
        case TIMER_OBJECT: {
            /* TODO? verify that the timer type is attached to applicable
               object (egg for hatch, glob for shrink, and so forth) */
            let obj = curr.arg.a_obj, top;
            let obj_adr = fmt_ptr(addr_of(obj));
            let owhere = obj.where;

            if (obj.timed == 0) {
                impossible(_("timer sanity: untimed obj %s, timer %llu"),
                           obj_adr, t_id);
            }
            x[0] = y[0] = 0;
            /* if obj is in a container, possibly a nested one, figure out
               where the outermost container is */
            for (top = obj; top; top = top.v.v_ocontainer)
                if ((owhere = top.where) != OBJ_CONTAINED)
                    break;
            assert(top != null);
            if (owhere == OBJ_MIGRATING
                || (owhere == OBJ_MINVENT && !mon_is_local(top.v.v_ocarry))) {
                /* migrating directly or carried by migrating monster */
                ; /* not able to validate location so skip checks */
            } else if (!get_obj_location(obj, x, y,
                                         CONTAINED_TOO | BURIED_TOO)) {
                /* free? or on a shop's used-up bill? */
                impossible(
                    _("timer sanity: can't locate obj %s [where=%d], timer %llu"),
                           obj_adr, obj.where, t_id);
            } else if (!isok(x[0], y[0])) {
                impossible(
              _("timer sanity: obj %s [where=%d] located at <%d,%d>, timer %llu"),
                           obj_adr, obj.where, x[0], y[0], t_id);
            }
            break;
        }
        case TIMER_MONSTER:
            impossible(_("timer sanity: unexpected monster timer %llu"), t_id);
            break;
        case TIMER_LEVEL: {
            let lwhere = curr.arg.a_long;

            x[0] = coordxy((shr64(lwhere, 16) & 0xFFFF));
            y[0] = coordxy((lwhere & 0xFFFF));
            if (isok(x[0], y[0])) {
                /* replicate isok() in order to convince static analysis
                   that the decoding via '& 0xFFFF' hasn't produced a value
                   too big for levl[][] and that the cast to a narrower type
                   hasn't intruded on the sign bit to yield a negative value;
                   the analyzer isn't aware that isok() filters such things */
                assert(x[0] > 0 && x[0] < COLNO && y[0] >= 0 && y[0] < ROWNO);

                if (curr.func_index == MELT_ICE_AWAY && !is_ice(x[0], y[0])
                    /* the terrain under the span of an open drawbridge might
                       be frozen moat; is_ice() only checks for that when
                       the drawbridge is closed (and terrain here would be
                       DRAWBRIGE_UP) */
                    && !(levl()[x[0]][y[0]].typ == DRAWBRIDGE_DOWN
                         && (levl()[x[0]][y[0]].flags & DB_UNDER) == DB_ICE))
                    impossible(
                         _("timer sanity: melt timer %llu on non-ice %d <%d,%d>"),
                               t_id, levl()[x[0]][y[0]].typ, x[0], y[0]);
            } else {
                impossible(_("timer sanity: spot timer %llu at <%d,%d>"),
                           t_id, x[0], y[0]);
            }
            break;
        }
        case TIMER_GLOBAL:
            impossible(_("timer sanity: unexpected global timer %llu"), t_id);
            break;
        default:
            impossible(_("timer sanity: unknown timer %llu, type: %d"),
                       t_id, curr.kind);
            break;
        }
    }
    } finally { stack_pop($frame); }
}

/*
 * Pick off timeout elements from the global queue and call their functions.
 * Do this until their time is less than or equal to the move count.
 */
export function run_timers() { /* void */
    let curr;

    /*
     * Always use the first element.  Elements may be added or deleted at
     * any time.  The list is ordered; we are done when the first element
     * is in the future.
     */
    while (gt.timer_base && gt.timer_base.timeout <= svm.moves) {
        curr = gt.timer_base;
        gt.timer_base = curr.next;

        if (curr.kind == TIMER_OBJECT)
            curr.arg.a_obj.timed--;
        (timeout_funcs[curr.func_index].f)(curr.arg, curr.timeout);
        memset(addr_of(curr), 0, sizeof(struct_fe));
        free(addr_of(curr));
    }
}

/*
 * Start a timer.  Return TRUE if successful.
 */
export function start_timer(
    when,
    kind,
    func_index,
    arg) { /* boolean */
    const $frame = stack_frame(); try {
    let gnu, dup;

    if (kind <= TIMER_NONE || kind >= NUM_TIMER_KINDS
        || func_index < 0 || func_index >= NUM_TIME_FUNCS)
        panic(_("start_timer (%s: %d)"), kind_name(kind), func_index);

    /* fail if <arg> already has a <func_index> timer running */
    for (dup = gt.timer_base; dup; dup = dup.next)
        if (dup.kind == kind
            && dup.func_index == func_index
            && dup.arg.a_void == arg.a_void)
            break;
    if (dup) {
        let idbuf = stack_array(char, QBUFSZ);

        sprintf(idbuf, _("%s timer"), timeout_funcs[func_index].name);

        impossible(_("Attempted to start duplicate %s, aborted."), idbuf);
        return FALSE;
    }

    gnu = view_of(struct_fe, addr_of(alloc(sizeof(struct_fe))));
    memset(addr_of(gnu), 0, sizeof(struct_fe));
    gnu.next = null;
    gnu.tid = svt.timer_id++;
    gnu.timeout = svm.moves + when;
    gnu.kind = kind;
    gnu.needs_fixup = 0;
    gnu.func_index = func_index;
    struct_assign(gnu.arg, arg);
    insert_timer(gnu);

    if (kind == TIMER_OBJECT) /* increment object's timed count */
        arg.a_obj.timed++;

    return TRUE;
    } finally { stack_pop($frame); }
}

/*
 * Remove the timer from the current list and free it up.  Return the time
 * remaining until it would have gone off, 0 if not found.
 */
export function stop_timer(func_index, arg) { /* long long */
    let cleanup_func;
    let doomed;
    let timeout;

    doomed = remove_timer(ref_of(gt, "timer_base"), func_index, arg);

    if (doomed) {
        timeout = doomed.timeout;
        if (doomed.kind == TIMER_OBJECT)
            arg.a_obj.timed--;
        if ((cleanup_func = timeout_funcs[doomed.func_index].cleanup) != null)
            cleanup_func(arg, timeout);
        memset(addr_of(doomed), 0, sizeof(struct_fe));
        free(addr_of(doomed));
        return (timeout - svm.moves);
    }
    return 0;
}

/*
 * Find the timeout of specified timer; return 0 if none.
 */
export function peek_timer(type, arg) { /* long long */
    let curr;

    for (curr = gt.timer_base; curr; curr = curr.next) {
        if (curr.func_index == type && curr.arg.a_void == arg.a_void)
            return curr.timeout;
    }
    return 0;
}

/*
 * Move all object timers from src to dest, leaving src untimed.
 */
export function obj_move_timers(src, dest) { /* void */
    let count;
    let curr;

    for (count = 0, curr = gt.timer_base; curr; curr = curr.next)
        if (curr.kind == TIMER_OBJECT && curr.arg.a_obj == src) {
            curr.arg.a_obj = dest;
            dest.timed++;
            count++;
        }
    if (count != src.timed)
        panic(_("obj_move_timers"));
    src.timed = 0;
}

/*
 * Find all object timers and duplicate them for the new object "dest".
 */
export function obj_split_timers(src, dest) { /* void */
    let curr, next_timer = null;

    for (curr = gt.timer_base; curr; curr = next_timer) {
        next_timer = curr.next; /* things may be inserted */
        if (curr.kind == TIMER_OBJECT && curr.arg.a_obj == src) {
            start_timer(curr.timeout - svm.moves, TIMER_OBJECT,
                               curr.func_index, obj_to_any(dest));
        }
    }
}

/*
 * Stop all timers attached to this object.  We can get away with this because
 * all object pointers are unique.
 */
export function obj_stop_timers(obj) { /* void */
    let cleanup_func;
    let curr, prev, next_timer = null;

    for (prev = null, curr = gt.timer_base; curr; curr = next_timer) {
        next_timer = curr.next;
        if (curr.kind == TIMER_OBJECT && curr.arg.a_obj == obj) {
            if (prev)
                prev.next = curr.next;
            else
                gt.timer_base = curr.next;
            if ((cleanup_func = timeout_funcs[curr.func_index].cleanup) != null)
                cleanup_func(curr.arg, curr.timeout);
            memset(addr_of(curr), 0, sizeof(struct_fe));
            free(addr_of(curr));
        } else {
            prev = curr;
        }
    }
    obj.timed = 0;
}

/*
 * Check whether object has a timer of type timer_type.
 */
export function obj_has_timer(object, timer_type) { /* boolean */
    let timeout = peek_timer(timer_type, obj_to_any(object));

    return (+(timeout != 0));
}

/*
 * Stop all timers of index func_index at this spot.
 *
 */
export function spot_stop_timers(x, y, func_index) { /* void */
    let cleanup_func;
    let curr, prev, next_timer = null;
    let where = or64(shl64(x, 16), y);

    for (prev = null, curr = gt.timer_base; curr; curr = next_timer) {
        next_timer = curr.next;
        if (curr.kind == TIMER_LEVEL && curr.func_index == func_index
            && curr.arg.a_long == where) {
            if (prev)
                prev.next = curr.next;
            else
                gt.timer_base = curr.next;
            if ((cleanup_func = timeout_funcs[curr.func_index].cleanup) != null)
                cleanup_func(curr.arg, curr.timeout);
            memset(addr_of(curr), 0, sizeof(struct_fe));
            free(addr_of(curr));
        } else {
            prev = curr;
        }
    }
}

/*
 * When is the spot timer of type func_index going to expire?
 * Returns 0L if no such timer.
 */
export function spot_time_expires(x, y, func_index) { /* long long */
    let curr;
    let where = or64(shl64(x, 16), y);

    for (curr = gt.timer_base; curr; curr = curr.next) {
        if (curr.kind == TIMER_LEVEL && curr.func_index == func_index
            && curr.arg.a_long == where)
            return curr.timeout;
    }
    return 0;
}

export function spot_time_left(x, y, func_index) { /* long long */
    let expires = spot_time_expires(x, y, func_index);
    return (expires > 0) ? expires - svm.moves : 0;
}

/* Insert timer into the global queue */
function insert_timer(gnu) { /* void */
    let curr, prev;

    for (prev = null, curr = gt.timer_base; curr; prev = curr, curr = curr.next)
        if (curr.timeout >= gnu.timeout)
            break;

    gnu.next = curr;
    if (prev)
        prev.next = gnu;
    else
        gt.timer_base = gnu;
}

function remove_timer(
    base,
    func_index,
    arg) { /* timer_element * */
    let prev, curr;

    for (prev = null, curr = base[0]; curr; prev = curr, curr = curr.next)
        if (curr.func_index == func_index && curr.arg.a_void == arg.a_void)
            break;

    if (curr) {
        if (prev)
            prev.next = curr.next;
        else
            base[0] = curr.next;
    }

    return curr;
}

function write_timer(nhfp, timer) { /* void */
    const $frame = stack_frame(); try {
    let arg_save = stack_struct(struct_any);

    struct_assign(arg_save, cg.zeroany);
    switch (timer.kind) {
    case TIMER_GLOBAL:
    case TIMER_LEVEL:
        /* assume no pointers in arg */
        Sfo_fe(nhfp, timer, _("timer"));
        break;

    case TIMER_OBJECT:
        if (timer.needs_fixup) {
            Sfo_fe(nhfp, timer, _("timer"));
        } else {
            /* replace object pointer with id */
            arg_save.a_obj = timer.arg.a_obj;
            struct_assign(timer.arg, cg.zeroany);
            timer.arg.a_uint = arg_save.a_obj.o_id;
            timer.needs_fixup = 1;
            Sfo_fe(nhfp, timer, _("timer"));
            timer.arg.a_obj = arg_save.a_obj;
            timer.needs_fixup = 0;
        }
        break;

    case TIMER_MONSTER:
        if (timer.needs_fixup) {
            Sfo_fe(nhfp, timer, _("timer"));
        } else {
            /* replace monster pointer with id */
            arg_save.a_monst = timer.arg.a_monst;
            struct_assign(timer.arg, cg.zeroany);
            timer.arg.a_uint = arg_save.a_monst.m_id;
            timer.needs_fixup = 1;
            Sfo_fe(nhfp, timer, _("timer"));
            timer.arg.a_monst = arg_save.a_monst;
            timer.needs_fixup = 0;
        }
        break;

    default:
        panic(_("write_timer"));
        break;
    }
    } finally { stack_pop($frame); }
}

/*
 * Return TRUE if the object will stay on the level when the level is
 * saved.
 */
export function obj_is_local(obj) { /* boolean */
    switch (obj.where) {
    case OBJ_INVENT:
    case OBJ_MIGRATING:
        return FALSE;
    case OBJ_FLOOR:
    case OBJ_BURIED:
        return TRUE;
    case OBJ_CONTAINED:
        return obj_is_local(obj.v.v_ocontainer);
    case OBJ_MINVENT:
        return mon_is_local(obj.v.v_ocarry);
    }
    panic(_("obj_is_local"));
    /*NOTREACHED*/
    return FALSE;
}

/*
 * Return TRUE if the given monster will stay on the level when the
 * level is saved.
 */
function mon_is_local(mon) { /* boolean */
    let curr;

    for (curr = gm.migrating_mons; curr; curr = curr.nmon)
        if (curr == mon)
            return FALSE;
    /* `gm.mydogs' is used during level changes, never saved and restored */
    for (curr = gm.mydogs; curr; curr = curr.nmon)
        if (curr == mon)
            return FALSE;
    return TRUE;
}

/*
 * Return TRUE if the timer is attached to something that will stay on the
 * level when the level is saved.
 */
function timer_is_local(timer) { /* boolean */
    switch (timer.kind) {
    case TIMER_LEVEL:
        return TRUE;
    case TIMER_GLOBAL:
        return FALSE;
    case TIMER_OBJECT:
        return obj_is_local(timer.arg.a_obj);
    case TIMER_MONSTER:
        return mon_is_local(timer.arg.a_monst);
    }
    panic(_("timer_is_local"));
    /*NOTREACHED*/
    return FALSE;
}

/*
 * Part of the save routine.  Count up the number of timers that would
 * be written.  If write_it is true, actually write the timer.
 */
function maybe_write_timer(nhfp, range, write_it) { /* int */
    let count = 0;
    let curr;

    for (curr = gt.timer_base; curr; curr = curr.next) {
        if (range == RANGE_GLOBAL) {
            /* global timers */

            if (!timer_is_local(curr)) {
                count++;
                if (write_it) write_timer(nhfp, curr);
            }
        } else {
            /* local timers */

            if (timer_is_local(curr)) {
                count++;
                if (write_it) write_timer(nhfp, curr);
            }
        }
    }

    return count;
}

/*
 * Save part of the timer list.  The parameter 'range' specifies either
 * global or level timers to save.  The timer ID is saved with the global
 * timers.
 *
 * Global range:
 *      + timeouts that follow the hero (global)
 *      + timeouts that follow obj & monst that are migrating
 *
 * Level range:
 *      + timeouts that are level-specific (e.g. storms)
 *      + timeouts that stay with the level (obj & monst)
 */
export function save_timers(nhfp, range) { /* void */
    const $frame = stack_frame(); try {
    let curr, prev, next_timer = null;
    let count = stack_var(int);

    if (update_file(nhfp)) {
        if (range == RANGE_GLOBAL) {
            sfo_ulong(nhfp, ref_of(svt, "timer_id"), _("timer-timer_id"));
        }
        count[0] = maybe_write_timer(nhfp, range, FALSE);
        Sfo_int(nhfp, count, _("timer-timer_count"));
        maybe_write_timer(nhfp, range, TRUE);
    }

    if (release_data(nhfp)) {
        for (prev = null, curr = gt.timer_base; curr; curr = next_timer) {
            next_timer = curr.next; /* in case curr is removed */

            if (!(+!!(range == RANGE_LEVEL) ^ +!!timer_is_local(curr))) {
                if (prev)
                    prev.next = curr.next;
                else
                    gt.timer_base = curr.next;
                memset(addr_of(curr), 0, sizeof(struct_fe));
                free(addr_of(curr));
                /* prev stays the same */
            } else {
                prev = curr;
            }
        }
    }
    } finally { stack_pop($frame); }
}

/*
 * Pull in the structures from disk, but don't recalculate the object and
 * monster pointers.
 */
export function restore_timers(nhfp, range, adjust) { /* void */
    const $frame = stack_frame(); try {
    let count = stack_var(int, 0);
    let curr;
    let ghostly = +(nhfp.ftype == NHF_BONESFILE); /* from a ghost level */

    if (range == RANGE_GLOBAL) {
        sfi_ulong(nhfp, ref_of(svt, "timer_id"), _("timer-timer_id"));
    }

    /* restore elements */
    sfi_int(nhfp, count, _("timer-timer_count"));
    while (count[0]-- > 0) {
        curr = view_of(struct_fe, addr_of(alloc(sizeof(struct_fe))));
        Sfi_fe(nhfp, curr, _("timer"));
        if (ghostly)
            curr.timeout += adjust;

        insert_timer(curr);
    }
    } finally { stack_pop($frame); }
}

/* to support '#stats' wizard-mode command */
export function timer_stats(hdrfmt, hdrbuf, count, size) { /* void */
    let te;

    sprintf(hdrbuf, hdrfmt, NHJS_SIZEOF_timer_element);
    count[0] = size[0] = 0;
    for (te = gt.timer_base; te; te = te.next) {
        ++count[0];
        size[0] += NHJS_SIZEOF_timer_element;
    }
}

/* reset all timers that are marked for resetting */
export function relink_timers(ghostly) { /* void */
    const $frame = stack_frame(); try {
    let curr;
    let nid = stack_var(unsigned);

    for (curr = gt.timer_base; curr; curr = curr.next) {
        if (curr.needs_fixup) {
            if (curr.kind == TIMER_OBJECT) {
                if (ghostly) {
                    if (!lookup_id_mapping(curr.arg.a_uint, nid))
                        panic(_("relink_timers 1"));
                } else
                    nid[0] = curr.arg.a_uint;
                curr.arg.a_obj = find_oid(nid[0]);
                if (!curr.arg.a_obj)
                    panic(_("can't find o_id %d"), nid[0]);
                curr.needs_fixup = 0;
            } else if (curr.kind == TIMER_MONSTER) {
                panic(_("relink_timers: no monster timer implemented"));
            } else
                panic(_("relink_timers 2"));
        }
    }
    } finally { stack_pop($frame); }
}

/*timeout.c*/

import { A_CON, A_DEX, A_STR } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { NH_BLUE, NH_GOLDEN, NH_GREEN, You_can_move_again, something } from "./decl.h.macros.js";
import { S_DRAGON } from "./defsym.h.js";
import { vobj_at } from "./display.h.macros.js";
import { Is_waterlevel } from "./dungeon.h.macros.js";
import { FULL_MOON, PLNMSG_OK_DONT_DIE, PLNMSG_ONE_ITEM_HERE } from "./flag.h.js";
import { BUFSZ, COLNO, FALSE, QBUFSZ, ROWNO, TRUE, coordxy } from "./global.h.js";
import {
    ARTICLE_THE, DIED, DISMOUNT_FELL, ECMD_OK, FAINTING, FOOT, GENOCIDED, KILLED_BY, KILLED_BY_AN,
    MM_NOMSG, NECK, NHF_BONESFILE, NO_KILLER_PREFIX, NO_MINVENT, POISONING, STONING,
    SUPPRESS_SADDLE, TURNED_SLIME,
} from "./hack.h.js";
import {
    BZ_M_SPELL, BZ_OFS_AD, IndexOkT, NODIAG, You1, pline1, release_data, rn1, update_file,
} from "./hack.h.macros.js";
import { AD_ELEC } from "./monattk.h.js";
import {
    emits_light, is_silent, is_were, nolimbs, touch_petrifies, type_is_pname,
} from "./mondata.h.macros.js";
import { G_EXTINCT, G_GENOD, G_UNIQ, MV_KNOWS_EGG, NEUTRAL } from "./monflag.h.js";
import { M_AP_MONSTER } from "./monst.h.js";
import { LOW_PM, NON_PM, PM_ARCHEOLOGIST, PM_GREEN_SLIME } from "./monsters.h.js";
import { NHJS_SIZEOF_timer_element } from "./nhjs_struct_sizes.h.js";
import {
    BURIED_TOO, CONTAINED_TOO, MAX_EGG_HATCH_TIME, OBJ_BURIED, OBJ_CONTAINED, OBJ_FLOOR, OBJ_INVENT,
    OBJ_MIGRATING, OBJ_MINVENT,
} from "./obj.h.js";
import { Is_candle, carried } from "./obj.h.macros.js";
import {
    AMULET_OF_STRANGULATION, BRASS_LANTERN, CANDELABRUM_OF_INVOCATION, CORPSE, FEDORA, LUCKSTONE,
    MAGIC_LAMP, OIL_LAMP, POT_OIL, ROCK, TALLOW_CANDLE, WAX_CANDLE,
} from "./objects.h.js";
import {
    ACID_RES, ADORNED, AGGRAVATE_MONSTER, ANTIMAGIC, BLINDED, BLND_RES, CLAIRVOYANT, COLD_RES,
    CONFLICT, CONFUSION, DEAF, DETECT_MONSTERS, DISINT_RES, DISPLACED, DRAIN_RES,
    ENERGY_REGENERATION, FAST, FIRE_RES, FIXED_ABIL, FLYING, FREE_ACTION, FROMOUTSIDE, FUMBLING,
    GLIB, HALF_PHDAM, HALF_SPDAM, HALLUC, HALLUC_RES, HUNGER, INFRAVISION, INVIS, INVULNERABLE,
    I_SPECIAL, JUMPING, LEVITATION, LIFESAVED, MAGICAL_BREATHING, PASSES_WALLS, POISON_RES,
    POLYMORPH, POLYMORPH_CONTROL, PROTECTION, PROT_FROM_SHAPE_CHANGERS, REFLECTING, REGENERATION,
    SEARCHING, SEE_INVIS, SHOCK_RES, SICK, SICK_RES, SLEEPY, SLEEP_RES, SLIMED, SLOW_DIGESTION,
    STEALTH, STONED, STONE_RES, STRANGLED, STUNNED, SWIMMING, TELEPAT, TELEPORT, TELEPORT_CONTROL,
    TIMEOUT, UNCHANGING, VOMITING, WARNING, WARN_OF_MON, WARN_UNDEAD, WOUNDED_LEGS, WWALKING,
    W_SADDLE,
} from "./prop.h.js";
import { CLOUD, DB_ICE, DB_UNDER, DRAWBRIDGE_DOWN } from "./rm.h.js";
import { ACCESSIBLE, levl, m_at } from "./rm.h.macros.js";
import { Sfi_fe, Sfo_fe, Sfo_int } from "./savefile.h.macros.js";
import {
    BURN_OBJECT, FIG_TRANSFORM, HATCH_EGG, MELT_ICE_AWAY, NUM_TIMER_KINDS, NUM_TIME_FUNCS,
    RANGE_GLOBAL, RANGE_LEVEL, TIMER_GLOBAL, TIMER_LEVEL, TIMER_MONSTER, TIMER_NONE, TIMER_OBJECT,
    struct_fe,
} from "./timeout.h.js";
import { LS_MONSTER, LS_OBJECT } from "./vision.h.js";
import { cansee } from "./vision.h.macros.js";
import { WT_NOISY_INV } from "./weight.h.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, putstr,
} from "./winprocs.h.macros.js";
import { NHW_MENU, WIN_ERR, struct_any } from "./wintype.h.js";
import { SICK_ALL, SICK_NONVOMITABLE } from "./you.h.js";
import { Role_if, Upolyd, mhe } from "./you.h.macros.js";
import {
    Acid_resistance, BInvis, Blind, Breathless, Confusion, Deaf, Displaced, EFumbling, ELevitation,
    EPasses_walls, Fast, Fire_resistance, Flying, Fumbling, HConfusion, HDeaf, HFlying, HFumbling,
    HLevitation, HMagical_breathing, HPasses_walls, HSleepy, HStun, Hallucination, Invis,
    Levitation, Passes_walls, Poison_resistance, Protection_from_shape_changers, See_invisible,
    Sick, Sleep_resistance, Sleepy, Slimed, Stone_resistance, Stoned, Strangled, Stunned, Unaware,
    Unchanging, Very_fast, Vomiting, Warn_of_mon, Wounded_legs, Wwalking,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, or64, shl64, shr64 } from "../rt/int64.js";
import { assert, free, memset, sprintf, strchr, strcpy, strlen } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, fnptr_t, ptr_add, ptr_diff, ptr_to, ref_of, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc, fmt_ptr } from "./alloc.js";
import { fig_transform } from "./apply.js";
import { artifact_light } from "./artifact.js";
import { adjattrib, exercise, stone_luck } from "./attrib.js";
import { confdir, isok } from "./cmd.js";
import { is_ice, is_pool, is_pool_or_lava } from "./dbridge.js";
import {
    cg, disp, flags, gb, gm, gn, gt, gy, iflags, svc, svk, svl, svm, svq, svt, u,
} from "./decl.js";
import { rot_corpse, rot_organic } from "./dig.js";
import { canseemon, newsym, see_monsters, set_mimic_blocking } from "./display.js";
import { heal_legs, revive_mon, zombify_mon } from "./do.js";
import { Monnam, a_monnam, hcolor, m_monnam, rndmonnam, x_monnam } from "./do_name.js";
import { find_ac, toggle_displacement, wielding_corpse } from "./do_wear.js";
import { tamedog } from "./dog.js";
import { hurtle } from "./dothrow.js";
import { surface } from "./dungeon.js";
import { Popeye, eating_dangerous_corpse, morehungry, vomit } from "./eat.js";
import { dealloc_killer, done, find_delayed_killer, panic } from "./end.js";
import { inv_weight, monst_to_any, nomul, obj_to_any, spoteffects } from "./hack.js";
import { eos, highc, ing_suffix, s_suffix, strstri, strsubst, upstart } from "./hacklib.js";
import { carrying, sobj_at, update_inventory, useup, useupall } from "./invent.js";
import {
    arti_light_radius, candle_light_range, del_light_source, new_light_source,
} from "./light.js";
import { makemon } from "./makemon.js";
import { container_weight, obj_extract_self, shrink_glob, weight } from "./mkobj.js";
import { hideunder, maybe_unhide_at, restartcham, wake_nearby } from "./mon.js";
import { big_to_little, cantvomit, little_to_big, locomotion, name_to_mon } from "./mondata.js";
import { mons } from "./monst.js";
import { Yname2, an, doname, makeplural, the, vtense, xname } from "./objnam.js";
import { deferred_decor } from "./pickup.js";
import {
    Norep, You, You_feel, You_hear, You_see, Your, impossible, pline, urgent_pline, verbalize,
} from "./pline.js";
import { body_part, polymon, rehumanize } from "./polyself.js";
import {
    incr_itimeout, make_blinded, make_confused, make_deaf, make_glib, make_hallucinated, make_sick,
    make_slimed, make_stoned, make_stunned, make_vomiting, set_itimeout,
} from "./potion.js";
import { stuck_in_wall } from "./pray.js";
import { any_visible_region, region_danger, visible_region_summary } from "./region.js";
import { lookup_id_mapping } from "./restore.js";
import { d, rn2, rnd } from "./rnd.js";
import { sfi_int, sfi_ulong, sfo_ulong } from "./sfbase.js";
import { Shk_Your, find_oid, obfree } from "./shk.js";
import { cry_sound } from "./sounds.js";
import { dismount_steed } from "./steed.js";
import { enexto } from "./teleport.js";
import { float_down, instapetrify, unconscious } from "./trap.js";
import { you_unwere } from "./were.js";
import { which_armor } from "./worn.js";
import { buzz, get_obj_location, melt_ice_away } from "./zap.js";
