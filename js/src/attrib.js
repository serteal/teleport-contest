/* NetHack 5.0	attrib.c	$NHDT-Date: 1777000050 2026/04/23 19:07:30 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.137 $ */
/*      Copyright 1988, 1989, 1990, 1992, M. Stephenson           */
/* NetHack may be freely redistributed.  See license for details. */

/*  attribute modification routines. */

/* part of the output on gain or loss of attribute */

const plusattr = static_array("plusattr", ptr_to(char), null, [ _("strong"), _("smart"), _("wise"),
                          _("agile"),  _("tough"), _("charismatic") ]);
const minusattr = static_array("minusattr", ptr_to(char), null, [ _("weak"),    _("stupid"),
                           _("foolish"), _("clumsy"),
                           _("fragile"), _("repulsive") ]);
/* also used by enlightenment in insight.c for non-abbreviated status info */

export const attrname = static_array("attrname", ptr_to(char), null, [ _("strength"), _("intelligence"), _("wisdom"),
                          _("dexterity"), _("constitution"), _("charisma") ]);

  const struct_innate = struct("struct_innate", {
    ulevel: schar,
    ability: ptr_to(long),
    gainstr: ptr_to(char), losestr: ptr_to(char),
}); const arc_abil = static_array("arc_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[SEARCHING], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 5, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _("stealthy"), losestr: _("") },
                 { ulevel: 10, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _("quick"), losestr: _("slow") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const bar_abil = static_array("bar_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[POISON_RES], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 7, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _("quick"), losestr: _("slow") },
                 { ulevel: 15, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _("stealthy"), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const cav_abil = static_array("cav_abil", struct_innate, null, [ { ulevel: 7, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _("quick"), losestr: _("slow") },
                 { ulevel: 15, ability: ref_of(u.uprops[WARNING], "intrinsic"), gainstr: _("sensitive"), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const hea_abil = static_array("hea_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[POISON_RES], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 15, ability: ref_of(u.uprops[WARNING], "intrinsic"), gainstr: _("sensitive"), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const kni_abil = static_array("kni_abil", struct_innate, null, [ { ulevel: 7, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _("quick"), losestr: _("slow") }, { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const mon_abil = static_array("mon_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 1, ability: ref_of(u.uprops[SLEEP_RES], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 1, ability: ref_of(u.uprops[SEE_INVIS], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 3, ability: ref_of(u.uprops[POISON_RES], "intrinsic"), gainstr: _("healthy"), losestr: _("") },
                 { ulevel: 5, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _("stealthy"), losestr: _("") },
                 { ulevel: 7, ability: ref_of(u.uprops[WARNING], "intrinsic"), gainstr: _("sensitive"), losestr: _("") },
                 { ulevel: 9, ability: ref_of(u.uprops[SEARCHING], "intrinsic"), gainstr: _("perceptive"), losestr: _("unaware") },
                 { ulevel: 11, ability: ref_of(u.uprops[FIRE_RES], "intrinsic"), gainstr: _("cool"), losestr: _("warmer") },
                 { ulevel: 13, ability: ref_of(u.uprops[COLD_RES], "intrinsic"), gainstr: _("warm"), losestr: _("cooler") },
                 { ulevel: 15, ability: ref_of(u.uprops[SHOCK_RES], "intrinsic"), gainstr: _("insulated"), losestr: _("conductive") },
                 { ulevel: 17, ability: ref_of(u.uprops[TELEPORT_CONTROL], "intrinsic"), gainstr: _("controlled"), losestr: _("uncontrolled") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const pri_abil = static_array("pri_abil", struct_innate, null, [ { ulevel: 15, ability: ref_of(u.uprops[WARNING], "intrinsic"), gainstr: _("sensitive"), losestr: _("") },
                 { ulevel: 20, ability: ref_of(u.uprops[FIRE_RES], "intrinsic"), gainstr: _("cool"), losestr: _("warmer") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const ran_abil = static_array("ran_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[SEARCHING], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 7, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _("stealthy"), losestr: _("") },
                 { ulevel: 15, ability: ref_of(u.uprops[SEE_INVIS], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const rog_abil = static_array("rog_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 10, ability: ref_of(u.uprops[SEARCHING], "intrinsic"), gainstr: _("perceptive"), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const sam_abil = static_array("sam_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 15, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _("stealthy"), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const tou_abil = static_array("tou_abil", struct_innate, null, [ { ulevel: 10, ability: ref_of(u.uprops[SEARCHING], "intrinsic"), gainstr: _("perceptive"), losestr: _("") },
                 { ulevel: 20, ability: ref_of(u.uprops[POISON_RES], "intrinsic"), gainstr: _("hardy"), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const val_abil = static_array("val_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[COLD_RES], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 3, ability: ref_of(u.uprops[STEALTH], "intrinsic"), gainstr: _("stealthy"), losestr: _("") },
                 { ulevel: 7, ability: ref_of(u.uprops[FAST], "intrinsic"), gainstr: _("quick"), losestr: _("slow") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const wiz_abil = static_array("wiz_abil", struct_innate, null, [ { ulevel: 15, ability: ref_of(u.uprops[WARNING], "intrinsic"), gainstr: _("sensitive"), losestr: _("") },
                 { ulevel: 17, ability: ref_of(u.uprops[TELEPORT_CONTROL], "intrinsic"), gainstr: _("controlled"), losestr: _("uncontrolled") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const dwa_abil = static_array("dwa_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[INFRAVISION], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const elf_abil = static_array("elf_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[INFRAVISION], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 4, ability: ref_of(u.uprops[SLEEP_RES], "intrinsic"), gainstr: _("awake"), losestr: _("tired") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const gno_abil = static_array("gno_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[INFRAVISION], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const orc_abil = static_array("orc_abil", struct_innate, null, [ { ulevel: 1, ability: ref_of(u.uprops[INFRAVISION], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 1, ability: ref_of(u.uprops[POISON_RES], "intrinsic"), gainstr: _(""), losestr: _("") },
                 { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

const hum_abil = static_array("hum_abil", struct_innate, null, [ { ulevel: 0, ability: null, gainstr: 0, losestr: 0 } ]);

/* adjust an attribute; return TRUE if change is made, FALSE otherwise */
export function adjattrib(
    ndx,
    incr,
    msgflg) { /* boolean */ /* positive => no message, zero => message, and */
               /* negative => conditional (msg if change made) */
    let old_acurr, old_abase, old_amax, decr;
    let abonflg;
    let attrstr;

    if (Fixed_abil() || !incr)
        return FALSE;

    if ((ndx == A_INT || ndx == A_WIS) && uarmh && uarmh.otyp == DUNCE_CAP) {
        if (msgflg == 0)
            Your(_("cap constricts briefly, then relaxes again."));
        return FALSE;
    }

    old_acurr = ACURR(ndx);
    old_abase = ABASE(ndx);
    old_amax = AMAX(ndx);
    (chars[u.acurr.a + ndx]) += incr; /* when incr is negative, this reduces ABASE() */
    if (incr > 0) {
        if (ABASE(ndx) > AMAX(ndx)) {
            (chars[u.amax.a + ndx]) = ABASE(ndx);
            if (AMAX(ndx) > ATTRMAX(ndx))
                (chars[u.acurr.a + ndx]) = (chars[u.amax.a + ndx]) = ATTRMAX(ndx);
        }
        attrstr = plusattr[ndx];
        abonflg = +(ABON(ndx) < 0);
    } else { /* incr is negative */
        if (ABASE(ndx) < ATTRMIN(ndx)) {
            /*
             * If base value has dropped so low that it is trying to be
             * taken below the minimum, reduce max value (peak reached)
             * instead.  That means that restore ability and repeated
             * applications of unicorn horn will not be able to recover
             * all the lost value.  As of 3.6.2, we only take away
             * some (average half, possibly zero) of the excess from max
             * instead of all of it, but without intervening recovery, it
             * can still eventually drop to the minimum allowed.  After
             * that, it can't be recovered, only improved with new gains.
             *
             * This used to assign a new negative value to incr and then
             * add it, but that could affect messages below, possibly
             * making a large decrease be described as a small one.
             *
             * decr = rn2(-(ABASE - ATTRMIN) + 1);
             */
            decr = rn2(ATTRMIN(ndx) - ABASE(ndx) + 1);
            (chars[u.acurr.a + ndx]) = ATTRMIN(ndx);
            (chars[u.amax.a + ndx]) -= decr;
            if (AMAX(ndx) < ATTRMIN(ndx))
                (chars[u.amax.a + ndx]) = ATTRMIN(ndx);
        }
        attrstr = minusattr[ndx];
        abonflg = +(ABON(ndx) > 0);
    }
    if (ACURR(ndx) == old_acurr) {
        if (msgflg == 0 && flags.verbose) {
            if (ABASE(ndx) == old_abase && AMAX(ndx) == old_amax) {
                pline(_("You're %s as %s as you can get."),
                      abonflg ? _("currently") : _("already"), attrstr);
            } else {
                /* current stayed the same but base value changed, or
                   base is at minimum and reduction caused max to drop */
                Your(_("innate %s has %s."), attrname[ndx],
                     (incr > 0) ? _("improved") : _("declined"));
            }
        }
        return FALSE;
    }

    /* Any successful change also resets abuse / exercise level */
    (chars[u.aexe.a + ndx]) = 0;

    disp.botl = TRUE;
    if (msgflg <= 0)
        You_feel(_("%s%s!"), (incr > 1 || incr < -1) ? _("very ") : _(""), attrstr);
    if (program_state.in_moveloop && (ndx == A_STR || ndx == A_CON))
        encumber_msg();
    return TRUE;
}

/* strength gain */
export function gainstr(otmp, incr, givemsg) { /* void */
    let num = incr;

    if (!num) {
        if (ABASE(A_STR) < 18)
            num = (rn2(4) ? 1 : rnd(6));
        else if (ABASE(A_STR) < STR18(85))
            num = rnd(10);
        else
            num = 1;
    }
    adjattrib(A_STR, (otmp && otmp.cursed) ? -num : num,
                     givemsg ? -1 : 1);
}

/* strength loss, may kill you; cause may be poison or monster like 'a' */
export function losestr(num, knam, k_format) { /* void */
    let uhpmin = minuhpmax(1), olduhpmax = u.uhpmax;
    let ustr = ABASE(A_STR) - num, amt, dmg;
    let waspolyd = Upolyd();

    if (num <= 0 || ABASE(A_STR) < ATTRMIN(A_STR)) {
        impossible(_("losestr: %d - %d"), ABASE(A_STR), num);
        return;
    }
    dmg = 0;
    while (ustr < ATTRMIN(A_STR)) {
        ++ustr;
        --num;
        amt = rn1(4, 3); /* (0..(4-1))+3 => 3..6; used to use flat 6 here */
        dmg += amt;
    }
    if (dmg) {
        /* in case damage is fatal and caller didn't supply killer reason */
        if (!knam || !chars[knam]) {
            knam = _("terminal frailty");
            k_format = KILLED_BY;
        }
        losehp(dmg, knam, k_format);

        if (Upolyd()) {
            /* when still poly'd, reduce you-as-monst maxHP; never below 1 */
            setuhpmax(max(u.mhmax - dmg, 1), FALSE); /* acts as setmhmax() */
        } else if (!waspolyd) {
            /* not polymorphed now and didn't rehumanize when taking damage;
               reduce max HP, but not below uhpmin */
            if (u.uhpmax > uhpmin)
                setuhpmax(max(u.uhpmax - dmg, uhpmin), FALSE);
        }
        disp.botl = TRUE;
    }

    (olduhpmax);

    /* 'num' could have been reduced to 0 in the minimum strength loop;
       '(Upolyd || !waspolyd)' is True unless damage caused rehumanization */
    if (num > 0 && (Upolyd() || !waspolyd))
        adjattrib(A_STR, -num, 1);
}

/* combined strength loss and damage from some poisons */
export function poison_strdmg(strloss, dmg, knam, k_format) { /* void */
    losestr(strloss, knam, k_format);
    losehp(dmg, knam, k_format);
}

  const struct_poison_effect_message = struct("struct_poison_effect_message", {
    delivery_func: fnptr_t,
    effect_msg: ptr_to(char),
}); const poiseff = static_array("poiseff", struct_poison_effect_message, null, [
    { delivery_func: You_feel, effect_msg: _("weaker") },             /* A_STR */
    { delivery_func: Your, effect_msg: _("brain is on fire") },       /* A_INT */
    { delivery_func: Your, effect_msg: _("judgement is impaired") },  /* A_WIS */
    { delivery_func: Your, effect_msg: _("muscles won't obey you") }, /* A_DEX */
    { delivery_func: You_feel, effect_msg: _("very sick") },          /* A_CON */
    { delivery_func: You, effect_msg: _("break out in hives") }       /* A_CHA */
]);

/* feedback for attribute loss due to poisoning */
export function poisontell(typ,
           exclaim) { /* void */ /* emphasis */
    let func = poiseff[typ].delivery_func;
    let msg_txt = poiseff[typ].effect_msg;

    /*
     * "You feel weaker" or "you feel very sick" aren't appropriate when
     * wearing or wielding something (gauntlets of power, Ogresmasher)
     * which forces the attribute to maintain its maximum value.
     * Phrasing for other attributes which might have fixed values
     * (dunce cap) is such that we don't need message fixups for them.
     */
    if (typ == A_STR && ACURR(A_STR) == STR19(25))
        msg_txt = _("innately weaker");
    else if (typ == A_CON && ACURR(A_CON) == 25)
        msg_txt = _("sick inside");

    func(_("%s%c"), msg_txt, exclaim ? ord('!') : ord('.'));
}

/* called when an attack or trap has poisoned hero (used to be in mon.c) */
export function poisoned(
    reason,
    typ,
    pkiller,
    fatal,
    thrown_weapon) { /* void */ /* thrown weapons are less deadly */
    let i, loss, kprefix = KILLED_BY_AN;
    let blast = +!strcmp(reason, _("blast"));

    /* inform player about being poisoned unless that's already been done;
       "blast" has given a "blast of poison gas" message; "poison arrow",
       "poison dart", etc have implicitly given poison messages too... */
    if (!blast && !strstri(reason, _("poison"))) {
        let plural = (chars[reason + unsigned(strlen(reason) - 1)] == ord('s')) ? 1 : 0;

        /* avoid "The" Orcus's sting was poisoned... */
        pline(_("%s%s %s poisoned!"),
              (0 ? isupper(uchar((chars[reason]))) : ((unsigned(((uchar((chars[reason]))) - ord("A")))) < 26)) ? _("") : _("The "), reason,
              plural ? _("were") : _("was"));
    }
    if (Poison_resistance()) {
        if (blast)
            shieldeff(u.ux, u.uy);
        pline_The(_("poison doesn't seem to affect you."));
        return;
    }

    /* suppress killer prefix if it already has one */
    i = name_to_mon(pkiller, null);
    if (ismnum(i) && (mons[i].geno & G_UNIQ)) {
        kprefix = KILLED_BY;
        if (!type_is_pname(mons[i]))
            pkiller = the(pkiller);
    } else if (!strncmpi(pkiller, _("the "), 4) || !strncmpi(pkiller, _("an "), 3)
               || !strncmpi(pkiller, _("a "), 2)) {
        /*[ does this need a plural check too? ]*/
        kprefix = KILLED_BY;
    }

    /*
     * FIXME:
     *  this operates on u.uhp[max] even when hero is polymorphed....
     */

    i = !fatal ? 1 : rn2(fatal + (thrown_weapon ? 20 : 0));
    if (i == 0 && typ != A_CHA) {
        /* sometimes survivable instant kill */
        loss = 6 + d(4, 6); /* 6 + 4d6 => 10..34 */
        if (u.uhp <= loss) {
            u.uhp = -1;
            disp.botl = TRUE;
            pline_The(_("poison was deadly..."));
        } else {
            /* survived, but with severe reaction */
            let olduhp = u.uhp,
                newuhpmax = u.uhpmax - Math.trunc(loss / 2);

            setuhpmax(max(newuhpmax, minuhpmax(3)), TRUE); /*True: see FIXME*/
            loss = adjuhploss(loss, olduhp);

            losehp(loss, pkiller, kprefix); /* poison damage */
            if (adjattrib(A_CON, (typ != A_CON) ? -1 : -3, TRUE))
                poisontell(A_CON, TRUE);
            if (typ != A_CON && adjattrib(typ, -3, 1))
                poisontell(typ, TRUE);
        }
    } else if (i > 5) {
        let cloud = +!strcmp(reason, _("gas cloud"));

        /* HP damage; more likely--but less severe--with missiles */
        loss = thrown_weapon ? rnd(6) : rn1(10, 6);
        if ((blast || cloud) && Half_gas_damage()) /* worn towel */
            loss = Math.trunc((loss + 1) / 2);
        losehp(loss, pkiller, kprefix); /* poison damage */
    } else {
        /* attribute loss; if typ is A_STR, reduction in current and
           maximum HP will occur once strength has dropped down to 3 */
        loss = (thrown_weapon || !fatal) ? 1 : d(2, 2); /* was rn1(3,3) */
        /* check that a stat change was made */
        if (adjattrib(typ, -loss, 1))
            poisontell(typ, TRUE);
    }

    if (u.uhp < 1) {
        svk.killer.format = kprefix;
        strcpy(svk.killer.name, pkiller);
        /* "Poisoned by a poisoned ___" is redundant */
        done(strstri(pkiller, _("poison")) ? DIED : POISONING);
    }
    encumber_msg();
}

export function change_luck(n) { /* void */
    u.uluck += n;
    if (u.uluck < 0 && u.uluck < LUCKMIN)
        u.uluck = LUCKMIN;
    if (u.uluck > 0 && u.uluck > LUCKMAX)
        u.uluck = LUCKMAX;
}

/* decide whether there are more blessed luckstones (plus luck-conferring
   artifacts) than cursed ones; optionally combine uncursed with blessed */
export function stone_luck(include_uncursed) { /* int */
    let otmp;
    let bonchance = 0;

    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (confers_luck(otmp)) {
            if (otmp.cursed)
                bonchance -= otmp.quan;
            else if (otmp.blessed || include_uncursed)
                bonchance += otmp.quan;
        }

    return sgn(int(bonchance));
}

/* there has just been an inventory change affecting a luck-granting item */
export function set_moreluck() { /* void */
    let luckbon = stone_luck(TRUE);

    if (!luckbon && !carrying(LUCKSTONE))
        u.moreluck = 0;
    else if (luckbon >= 0)
        u.moreluck = LUCKADD;
    else
        u.moreluck = -LUCKADD;
}

/* (not used) */
export function restore_attrib() { /* void */
    let i, equilibrium;;

    /*
     * Note:  this used to get called by moveloop() on every turn but
     * ATIME() is never set to non-zero anywhere so didn't do anything.
     * Presumably it once supported something like potion of heroism
     * which conferred temporary characteristics boost(s).
     *
     * ATEMP() is used for strength loss from hunger, which doesn't
     * time out, and for dexterity loss from wounded legs, which has
     * its own timeout routine.
     */

    for (i = 0; i < A_MAX; i++) { /* all temporary losses/gains */
        equilibrium = ((i == A_STR && u.uhs >= WEAK)
                       || (i == A_DEX && Wounded_legs())) ? -1 : 0;
        if (ATEMP(i) != equilibrium && ATIME(i) != 0) {
            if (!(--(chars[u.atime.a + i]))) { /* countdown for change */
                (chars[u.atemp.a + i]) += (ATEMP(i) > 0) ? -1 : 1;
                disp.botl = TRUE;
                if (ATEMP(i)) /* reset timer */
                    (chars[u.atime.a + i]) = Math.trunc(100 / ACURR(A_CON));
            }
        }
    }
    if (disp.botl)
        encumber_msg();
}

export const AVAL = 50;

export function exercise(i, inc_or_dec) { /* void */
    debugpline0(_("Exercise:"), __FILE__);
    if (i == A_INT || i == A_CHA)
        return; /* can't exercise these */

    /* no physical exercise while polymorphed; the body's temporary */
    if (Upolyd() && i != A_WIS)
        return;

    if (abs(AEXE(i)) < AVAL) {
        /*
         *      Law of diminishing returns (Part I):
         *
         *      Gain is harder at higher attribute values.
         *      79% at "3" --> 0% at "18"
         *      Loss is even at all levels (50%).
         *
         *      Note: *YES* ACURR is the right one to use.
         */
        (chars[u.aexe.a + i]) += inc_or_dec ? +(rn2(19) > ACURR(i)) : -rn2(2);
        do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("%s, %s AEXE = %d"), (i == A_STR) ? _("Str") : (i == A_WIS) ? _("Wis") : (i == A_DEX)
                                                                      ? _("Dex")
                                                                      : _("Con"), inc_or_dec ? _("inc") : _("dec"), AEXE(i)); iflags.last_msg = save_plnmsg; } } while (0)

;
    }
    if (svm.moves > 0 && (i == A_STR || i == A_CON))
        encumber_msg();
}

function exerper() { /* void */
    if (!(svm.moves % 10)) {
        /* Hunger Checks */
        let hs = (u.uhunger > 1000) ? SATIATED
                 : (u.uhunger > 150) ? NOT_HUNGRY
                   : (u.uhunger > 50) ? HUNGRY
                     : (u.uhunger > 0) ? WEAK
                       : FAINTING;

        debugpline0(_("exerper: Hunger checks"), __FILE__);
        switch (hs) {
        case SATIATED:
            exercise(A_DEX, FALSE);
            if (Role_if(PM_MONK))
                exercise(A_WIS, FALSE);
            break;
        case NOT_HUNGRY:
            exercise(A_CON, TRUE);
            break;
        case WEAK:
            exercise(A_STR, FALSE);
            if (Role_if(PM_MONK)) /* fasting */
                exercise(A_WIS, TRUE);
            break;
        case FAINTING:
        case FAINTED:
            exercise(A_CON, FALSE);
            break;
        }

        /* Encumbrance Checks */
        debugpline0(_("exerper: Encumber checks"), __FILE__);
        switch (near_capacity()) {
        case MOD_ENCUMBER:
            exercise(A_STR, TRUE);
            break;
        case HVY_ENCUMBER:
            exercise(A_STR, TRUE);
            exercise(A_DEX, FALSE);
            break;
        case EXT_ENCUMBER:
            exercise(A_DEX, FALSE);
            exercise(A_CON, FALSE);
            break;
        }
    }

    /* status checks */
    if (!(svm.moves % 5)) {
        debugpline0(_("exerper: Status checks"), __FILE__);
        if ((HClairvoyant() & (INTRINSIC | TIMEOUT)) && !BClairvoyant())
            exercise(A_WIS, TRUE);
        if (HRegeneration())
            exercise(A_STR, TRUE);

        if (Sick() || Vomiting())
            exercise(A_CON, FALSE);
        if (Confusion() || Hallucination())
            exercise(A_WIS, FALSE);
        if ((Wounded_legs() && !u.usteed) || Fumbling() || HStun())
            exercise(A_DEX, FALSE);
    }
}

/* exercise/abuse text (must be in attribute order, not botl order);
   phrased as "You must have been [][0]." or "You haven't been [][1]." */
const exertext = static_array("exertext", array_of(ptr_to(char), 2), A_MAX, [
    [ _("exercising diligently"), _("exercising properly") ],           /* Str */
    [ 0, 0 ],                                                     /* Int */
    [ _("very observant"), _("paying attention") ],                     /* Wis */
    [ _("working on your reflexes"), _("working on reflexes lately") ], /* Dex */
    [ _("leading a healthy life-style"), _("watching your health") ],   /* Con */
    [ 0, 0 ],                                                     /* Cha */
]);

export function exerchk() { /* void */
    var i, ax, mod_val, lolim, hilim;

    /*  Check out the periodic accumulations */
    exerper();

    if (svm.moves >= svc.context.next_attrib_check) {
        debugpline1(_("exerchk: ready to test. multi = %lld."), gm.multi, __FILE__);
    }
    /*  Are we ready for a test? */
    if (svm.moves >= svc.context.next_attrib_check && !gm.multi) {
        debugpline0(_("exerchk: testing."), __FILE__);
        /*
         *      Law of diminishing returns (Part II):
         *
         *      The effects of "exercise" and "abuse" wear
         *      off over time.  Even if you *don't* get an
         *      increase/decrease, you lose some of the
         *      accumulated effects.
         */
        for (i = 0; i < A_MAX; ++i) {
            ax = AEXE(i);
            /* nothing to do here if no exercise or abuse has occurred
               (Int and Cha always fall into this category) */
            if (!ax)
                continue; /* ok to skip nextattrib */

            mod_val = sgn(ax); /* +1 or -1; used below */
            /* no further effect for exercise if at max or abuse if at min;
               can't exceed 18 via exercise even if actual max is higher */
            lolim = ATTRMIN(i); /* usually 3; might be higher */
            hilim = ATTRMAX(i); /* usually 18; maybe lower or higher */
            if (hilim > 18)
                hilim = 18;
            nextattrib: { if ((ax < 0) ? (ABASE(i) <= lolim) : (ABASE(i) >= hilim))
                break nextattrib;;
            /* can't exercise non-Wisdom while polymorphed; previous
               exercise/abuse gradually wears off without impact then */
            if (Upolyd() && i != A_WIS)
                break nextattrib;;

            debugpline2(_("exerchk: testing %s (%d)."),
                        (i == A_STR) ? _("Str")
                        : (i == A_INT) ? _("Int?")
                          : (i == A_WIS) ? _("Wis")
                            : (i == A_DEX) ? _("Dex")
                              : (i == A_CON) ? _("Con")
                                : (i == A_CHA) ? _("Cha?")
                                  : _("???"),
                        ax, __FILE__);
            /*
             *  Law of diminishing returns (Part III):
             *
             *  You don't *always* gain by exercising.
             *  [MRS 92/10/28 - Treat Wisdom specially for balance.]
             */
            if (rn2(AVAL) > ((i != A_WIS) ? Math.trunc(abs(ax) * 2 / 3) : abs(ax)))
                break nextattrib;;

            debugpline1(_("exerchk: changing %d."), i, __FILE__);
            if (adjattrib(i, mod_val, -1)) {
                debugpline1(_("exerchk: changed %d."), i, __FILE__);
                /* if you actually changed an attrib - zero accumulation */
                (chars[u.aexe.a + i]) = ax = 0;
                /* then print an explanation */
                You(_("%s %s."),
                    (mod_val > 0) ? _("must have been") : _("haven't been"),
                    exertext[i][(mod_val > 0) ? 0 : 1]);
            }
 }
            /* this used to be ``AEXE(i) /= 2'' but that would produce
               platform-dependent rounding/truncation for negative vals */
            (chars[u.aexe.a + i]) = Math.trunc(abs(ax) / 2) * mod_val;
        }
        svc.context.next_attrib_check += rn1(200, 800);
        debugpline1(_("exerchk: next check at %lld."),
                    svc.context.next_attrib_check, __FILE__);
    }
}

/* return random hero attribute (by role's attr distribution).
   returns A_MAX if failed. */
function rnd_attr() { /* int */
    let i, x = rn2(100);

    /* 5.0: the x -= ... calculation used to have an off by 1 error that
       resulted in the values being biased toward Str and away from Cha */
    for (i = 0; i < A_MAX; ++i)
        if ((x -= gu.urole.attrdist[i]) < 0)
            break;
    return i;
}

/* add or subtract np points from random attributes,
   adjusting the base and maximum values of the attributes.
   if subtracting, np must be negative.
   returns the left over points. */
function init_attr_role_redist(np, addition) { /* int */
    let tryct = 0;
    let adj = addition ? 1 : -1;

    while ((addition ? (np > 0) : (np < 0)) && tryct < 100) {
        let i = rnd_attr();

        if (i >= A_MAX
            || (addition ? (ABASE(i) >= ATTRMAX(i))
                         : (ABASE(i) <= ATTRMIN(i)))) {
            tryct++;
            continue;
        }
        tryct = 0;
        (chars[u.acurr.a + i]) += adj;
        (chars[u.amax.a + i]) += adj;
        np -= adj;
    }
    return np;
}

/* allocate hero's initial characteristics */
export function init_attr(np) { /* void */
    let i;

    for (i = 0; i < A_MAX; i++) {
        (chars[u.acurr.a + i]) = (chars[u.amax.a + i]) = gu.urole.attrbase[i];
        (chars[u.atemp.a + i]) = (chars[u.atime.a + i]) = 0;
        np -= gu.urole.attrbase[i];
    }

    /* distribute leftover points */
    np = init_attr_role_redist(np, TRUE);
    /* if we went over, remove points */
    np = init_attr_role_redist(np, FALSE);
}

export function redist_attr() { /* void */
    let i, tmp;

    for (i = 0; i < A_MAX; i++) {
        if (i == A_INT || i == A_WIS)
            continue;
        /* Polymorphing doesn't change your mind */
        tmp = AMAX(i);
        (chars[u.amax.a + i]) += (rn2(5) - 2);
        if (AMAX(i) > ATTRMAX(i))
            (chars[u.amax.a + i]) = ATTRMAX(i);
        if (AMAX(i) < ATTRMIN(i))
            (chars[u.amax.a + i]) = ATTRMIN(i);
        (chars[u.acurr.a + i]) = Math.trunc(ABASE(i) * AMAX(i) / tmp);
        /* ABASE(i) > ATTRMAX(i) is impossible */
        if (ABASE(i) < ATTRMIN(i))
            (chars[u.acurr.a + i]) = ATTRMIN(i);
    }
    /* encumber_msg(); -- caller needs to do this */
}

/* apply minor variation to attributes */
export function vary_init_attr() { /* void */
    let i;

    for (i = 0; i < A_MAX; i++)
        if (!rn2(20)) {
            let xd = rn2(7) - 2; /* biased variation */

            adjattrib(i, xd, TRUE);
            if (ABASE(i) < AMAX(i))
                (chars[u.amax.a + i]) = ABASE(i);
        }
}

function postadjabil(ability) { /* void */
    if (!u.ulevel) /* initializing hero; don't attempt screen update yet */
        return;
    if ((addr_of(ability) == addr_of(ref_of(u.uprops[WARNING], "intrinsic"))) || (addr_of(ability) == addr_of(ref_of(u.uprops[SEE_INVIS], "intrinsic"))))
        see_monsters();
}

function role_abil(r) { /* const struct innate * */
    const $frame = stack_frame(); try {
    const struct___anon1 = struct("role_abil.struct___anon1", {
        role: short,
        abil: ptr_to("struct_innate"),
    }); let roleabils = stack_array(struct___anon1, null, [
        { role: PM_ARCHEOLOGIST, abil: arc_abil[0] },
        { role: PM_BARBARIAN, abil: bar_abil[0] },
        { role: PM_CAVE_DWELLER, abil: cav_abil[0] },
        { role: PM_HEALER, abil: hea_abil[0] },
        { role: PM_KNIGHT, abil: kni_abil[0] },
        { role: PM_MONK, abil: mon_abil[0] },
        { role: PM_CLERIC, abil: pri_abil[0] },
        { role: PM_RANGER, abil: ran_abil[0] },
        { role: PM_ROGUE, abil: rog_abil[0] },
        { role: PM_SAMURAI, abil: sam_abil[0] },
        { role: PM_TOURIST, abil: tou_abil[0] },
        { role: PM_VALKYRIE, abil: val_abil[0] },
        { role: PM_WIZARD, abil: wiz_abil[0] },
        { role: 0, abil: null }
    ]);
    let i;

    for (i = 0; roleabils[i].abil && roleabils[i].role != r; i++)
        continue;
    return roleabils[i].abil;
    } finally { stack_pop($frame); }
}

function check_innate_abil(ability, frommask) { /* const struct innate * */
    let abil = null;

    if (frommask == FROMEXPER)
        abil = role_abil(Role_switch());
    else if (frommask == FROMRACE)
        switch (Race_switch()) {
        case PM_DWARF:
            abil = dwa_abil[0];
            break;
        case PM_ELF:
            abil = elf_abil[0];
            break;
        case PM_GNOME:
            abil = gno_abil[0];
            break;
        case PM_ORC:
            abil = orc_abil[0];
            break;
        case PM_HUMAN:
            abil = hum_abil[0];
            break;
        default:
            break;
        }

    while (abil && abil.ability) {
        if ((addr_of(abil.ability) == addr_of(ability)) && (u.ulevel >= abil.ulevel))
            return abil;
        abil = ptr_add(abil, 1);
    }
    return null;
}

/* reasons for innate ability */
export const FROM_NONE = 0;
export const FROM_ROLE = 1;
export const FROM_RACE = 2;
export const FROM_INTR = 3;
export const FROM_EXP = 4;
export const FROM_FORM = 5;
export const FROM_LYCN = 6;

/* check whether particular ability has been obtained via innate attribute */
function innately(ability) { /* int */
    let iptr;

    if ((iptr = check_innate_abil(ability, FROMEXPER)) != null)
        return (iptr.ulevel == 1) ? FROM_ROLE : FROM_EXP;
    if ((iptr = check_innate_abil(ability, FROMRACE)) != null)
        return FROM_RACE;
    if ((ability[0] & FROMOUTSIDE) != 0)
        return FROM_INTR;
    if ((ability[0] & FROMFORM) != 0)
        return FROM_FORM;
    return FROM_NONE;
}

export function is_innate(propidx) { /* int */
    let innateness;

    /* innately() would report FROM_FORM for this; caller wants specificity */
    if (propidx == DRAIN_RES && ismnum(u.ulycn))
        return FROM_LYCN;
    if (propidx == FAST && Very_fast())
        return FROM_NONE; /* can't become very fast innately */
    if ((innateness = innately(ref_of(u.uprops[propidx], "intrinsic"))) != FROM_NONE)
        return innateness;
    if (propidx == JUMPING && Role_if(PM_KNIGHT)
        /* knight has intrinsic jumping, but extrinsic is more versatile so
           ignore innateness if equipment is going to claim responsibility */
        && !u.uprops[propidx].extrinsic)
        return FROM_ROLE;
    if ((propidx == BLINDED && !haseyes(gy.youmonst.data))
        || (propidx == BLND_RES && (HBlnd_resist() & FROMFORM) != 0))
        return FROM_FORM;
    return FROM_NONE;
}

export function from_what(
    propidx) { /* char * */ /* special cases can have negative values */
    let buf = static_array("from_what.buf", char, BUFSZ);

    chars[buf + 0] = ord('\0');
    /*
     * Restrict the source of the attributes just to debug mode for now
     */
    if (wizard()) {
        let because_of = init_string(static_array("from_what.because_of", char, sizeof_string(" because of %s")), _(" because of %s"), true);

        if (propidx >= 0) {
            let p;
            let obj = null;
            let innateness = is_innate(propidx);

            /*
             * Properties can be obtained from multiple sources and we
             * try to pick the most significant one.  Classification
             * priority is not set in stone; current precedence is:
             * "from the start" (from role or race at level 1),
             * "from outside" (eating corpse, divine reward, blessed potion),
             * "from experience" (from role or race at level 2+),
             * "from current form" (while polymorphed),
             * "from timed effect" (potion or spell),
             * "from worn/wielded equipment" (Firebrand, elven boots, &c),
             * "from carried equipment" (mainly quest artifacts).
             * There are exceptions.  Versatile jumping from spell or boots
             * takes priority over knight's innate but limited jumping.
             */
            if ((propidx == BLINDED && u.uroleplay.blind)
                || (propidx == DEAF && u.uroleplay.deaf))
                sprintf(buf, _(" from birth"));
            else if (innateness == FROM_ROLE || innateness == FROM_RACE)
                strcpy(buf, _(" innately"));
            else if (innateness == FROM_INTR) /* [].intrinsic & FROMOUTSIDE */
                strcpy(buf, _(" intrinsically"));
            else if (innateness == FROM_EXP)
                strcpy(buf, _(" because of your experience"));
            else if (innateness == FROM_LYCN)
                strcpy(buf, _(" due to your lycanthropy"));
            else if (innateness == FROM_FORM)
                strcpy(buf, _(" from your creature form"));
            else if (propidx == FAST && Very_fast())
                sprintf(buf, because_of, ((HFast() & TIMEOUT) != 0) ? _("a potion or spell")
                          : ((EFast() & W_ARMF) != 0 && uarmf.dknown
                             && objects[uarmf.otyp].oc_name_known)
                              ? ysimple_name(uarmf) /* speed boots */
                                : EFast() ? _("worn equipment")
                                  : something());
            else if (wizard()
                     && (obj = what_gives(ref_of(u.uprops[propidx], "extrinsic"))) != null)
                sprintf(buf, because_of, obj.oartifact
                                             ? bare_artifactname(obj)
                                             : ysimple_name(obj));
            else if (propidx == BLINDED && Blindfolded_only())
                sprintf(buf, because_of, ysimple_name(ublindf));
            else if (propidx == BLINDED && u.ucreamed
                     && BlindedTimeout() == u.ucreamed
                     && !EBlinded() && !(HBlinded() & ~TIMEOUT))
                sprintf(buf, _("due to goop covering your %s"), body_part(FACE))

;

            /* remove some verbosity and/or redundancy */
            if ((p = strstri(buf, _(" pair of "))) != 0)
                copynchars(p + 1, p + 9, BUFSZ); /* overlapping buffers ok */
            else if (propidx == STRANGLED
                     && (p = strstri(buf, _(" of strangulation"))) != 0)
                chars[p] = ord('\0');
        } else { /* negative property index */
            /* if more blocking capabilities get implemented we'll need to
               replace this with what_blocks() comparable to what_gives() */
            switch (-propidx) {
            case BLINDED:
                /* wearing the Eyes of the Overworld overrides blindness */
                if (BBlinded() && is_art(ublindf, ART_EYES_OF_THE_OVERWORLD))
                    sprintf(buf, because_of, bare_artifactname(ublindf));
                break;
            case INVIS:
                if (u.uprops[INVIS].blocked & W_ARMC)
                    sprintf(buf, because_of, ysimple_name(uarmc))
; /* mummy wrapping */
                break;
            case CLAIRVOYANT:
                if (wizard() && (u.uprops[CLAIRVOYANT].blocked & W_ARMH))
                    sprintf(buf, because_of, ysimple_name(uarmh))
; /* cornuthaum */
                break;
            }
        }
    } /*wizard*/
    return buf;
}

export function adjabil(oldlevel, newlevel) { /* void */
    let abil, rabil;
    let prevabil, mask = FROMEXPER;

    abil = role_abil(Role_switch());

    switch (Race_switch()) {
    case PM_ELF:
        rabil = elf_abil[0];
        break;
    case PM_ORC:
        rabil = orc_abil[0];
        break;
    case PM_HUMAN:
    case PM_DWARF:
    case PM_GNOME:
    default:
        rabil = null;
        break;
    }

    while (abil || rabil) {
        /* Have we finished with the intrinsics list? */
        if (!abil || !abil.ability) {
            /* Try the race intrinsics */
            if (!rabil || !rabil.ability)
                break;
            abil = rabil;
            rabil = null;
            mask = FROMRACE;
        }
        prevabil = abil.ability[0];
        if (oldlevel < abil.ulevel && newlevel >= abil.ulevel) {
            /* Abilities gained at level 1 can never be lost
             * via level loss, only via means that remove _any_
             * sort of ability.  A "gain" of such an ability from
             * an outside source is devoid of meaning, so we set
             * FROMOUTSIDE to avoid such gains.
             */
            if (abil.ulevel == 1)
                abil.ability[0] = or64(abil.ability[0], or64(mask, FROMOUTSIDE));
            else
                abil.ability[0] = or64(abil.ability[0], mask);
            if (!(abil.ability[0] & INTRINSIC & not64(mask))) {
                if (chars[abil.gainstr])
                    You_feel(_("%s!"), abil.gainstr);
            }
        } else if (oldlevel >= abil.ulevel && newlevel < abil.ulevel) {
            abil.ability[0] = and64(abil.ability[0], not64(mask));
            if (!(abil.ability[0] & INTRINSIC)) {
                if (chars[abil.losestr])
                    You_feel(_("%s!"), abil.losestr);
                else if (chars[abil.gainstr])
                    You_feel(_("less %s!"), abil.gainstr);
            }
        }
        if (prevabil != abil.ability[0]) /* it changed */
            postadjabil(abil.ability);
        abil = ptr_add(abil, 1);
    }

    if (oldlevel > 0) {
        if (newlevel > oldlevel)
            add_weapon_skill(newlevel - oldlevel);
        else
            lose_weapon_skill(oldlevel - newlevel);
    }
}

/* called when gaining a level (before u.ulevel gets incremented);
   also called with u.ulevel==0 during hero initialization or for
   re-init if hero turns into a "new man/woman/elf/&c" */
export function newhp() { /* int */
    let hp, conplus;

    if (u.ulevel == 0) {
        /* Initialize hit points */
        hp = gu.urole.hpadv.infix + gu.urace.hpadv.infix;
        if (gu.urole.hpadv.inrnd > 0)
            hp += rnd(gu.urole.hpadv.inrnd);
        if (gu.urace.hpadv.inrnd > 0)
            hp += rnd(gu.urace.hpadv.inrnd);
        if (svm.moves == 0) { /* initial hero; skip for polyself to new man */
            /* Initialize alignment stuff */
            u.ualign.type = aligns[flags.initalign].value;
            u.ualign.record = gu.urole.initrecord;
        }
        /* no Con adjustment for initial hit points */
    } else {
        if (u.ulevel < gu.urole.xlev) {
            hp = gu.urole.hpadv.lofix + gu.urace.hpadv.lofix;
            if (gu.urole.hpadv.lornd > 0)
                hp += rnd(gu.urole.hpadv.lornd);
            if (gu.urace.hpadv.lornd > 0)
                hp += rnd(gu.urace.hpadv.lornd);
        } else {
            hp = gu.urole.hpadv.hifix + gu.urace.hpadv.hifix;
            if (gu.urole.hpadv.hirnd > 0)
                hp += rnd(gu.urole.hpadv.hirnd);
            if (gu.urace.hpadv.hirnd > 0)
                hp += rnd(gu.urace.hpadv.hirnd);
        }
        if (ACURR(A_CON) <= 3)
            conplus = -2;
        else if (ACURR(A_CON) <= 6)
            conplus = -1;
        else if (ACURR(A_CON) <= 14)
            conplus = 0;
        else if (ACURR(A_CON) <= 16)
            conplus = 1;
        else if (ACURR(A_CON) == 17)
            conplus = 2;
        else if (ACURR(A_CON) == 18)
            conplus = 3;
        else
            conplus = 4;
        hp += conplus;
    }
    if (hp <= 0)
        hp = 1;
    if (u.ulevel < MAXULEV) {
        /* remember increment; future level drain could take it away again */
        u.uhpinc[u.ulevel] = xint16(hp);
    } else {
        /* after level 30, throttle hit point gains from extra experience;
           once max reaches 1200, further increments will be just 1 more */
        let lim = 5 - Math.trunc(u.uhpmax / 300);

        lim = max(lim, 1);
        if (hp > lim)
            hp = lim;
    }
    return hp;
}

/* minimum value for uhpmax is ulevel but for life-saving it is always at
   least 10 if ulevel is less than that */
export function minuhpmax(altmin) { /* int */
    if (altmin < 1)
        altmin = 1;
    return max(u.ulevel, altmin);
}

/* update u.uhpmax or u.mhmax and values of other things that depend upon
   whichever of them is relevant */
export function setuhpmax(newmax, even_when_polyd) { /* void */
    if (!Upolyd() || even_when_polyd) {
        if (newmax != u.uhpmax) {
            u.uhpmax = newmax;
            if (u.uhpmax > u.uhppeak)
                u.uhppeak = u.uhpmax;
            disp.botl = TRUE;
        }
        if (u.uhp > u.uhpmax)
            u.uhp = u.uhpmax, disp.botl = TRUE;
    } else { /* Upolyd */
        if (newmax != u.mhmax) {
            u.mhmax = newmax;
            disp.botl = TRUE;
        }
        if (u.mh > u.mhmax)
            u.mh = u.mhmax, disp.botl = TRUE;
    }
}

/* called after setuhpmax() when damage is pending;
   if uhpmax (or mhmax) has been reduced, it might have caused uhp (or mh)
   to be reduced too; if so, recalculate pending loss to account for that */
export function adjuhploss(
    loss,
    olduhp) { /* int */ /* does double duty as oldmh when Upolyd */
    if (!Upolyd()) {
        if (u.uhp < olduhp)
            loss -= (olduhp - u.uhp);
    } else {
        if (u.mh < olduhp)
            loss -= (olduhp - u.mh);
    }
    return max(loss, 1);
}

/* return the current effective value of a specific characteristic
   (the 'a' in 'acurr()' comes from outdated use of "attribute" for the
   six Str/Dex/&c characteristics; likewise for u.abon, u.atemp, u.acurr) */
export function acurr(chridx) { /* schar */
    let tmp, result = 0; /* 'result' will always be reset to positive value */

    assert(chridx >= 0 && chridx < A_MAX);
    tmp = chars[u.abon.a + chridx] + chars[u.atemp.a + chridx] + chars[u.acurr.a + chridx];

    /* for Strength:  3 <= result <= 125;
       for all others:  3 <= result <= 25 */
    if (chridx == A_STR) {
        /* strength value is encoded:  3..18 normal, 19..118 for 18/xx (with
           1 <= xx <= 100), and 119..125 for other characteristics' 19..25;
           STR18(x) yields 18 + x (intended for 0 <= x <= 100; not used here);
           STR19(y) yields 100 + y (intended for 19 <= y <= 25) */
        if (tmp >= STR19(25) || (uarmg && uarmg.otyp == GAUNTLETS_OF_POWER))
            result = STR19(25); /* 125 */
        else
            /* need non-zero here to avoid 'if(result==0)' below because
               that doesn't deal with Str encoding; the cap of 25 applied
               there would limit Str to 18/07 [18 + 7] */
            result = max(tmp, 3);
    } else if (chridx == A_CHA) {
        if (tmp < 18 && (gy.youmonst.data.mlet == S_NYMPH
                         || u.umonnum == PM_AMOROUS_DEMON))
            result = 18;
    } else if (chridx == A_CON) {
        if (u_wield_art(ART_OGRESMASHER))
            result = 25;
    } else if (chridx == A_INT || chridx == A_WIS) {
        /* Yes, this may raise Int and/or Wis if hero is sufficiently
           stupid.  There are lower levels of cognition than "dunce". */
        if (uarmh && uarmh.otyp == DUNCE_CAP)
            result = 6;
    } else if (chridx == A_DEX) {
        ; /* there aren't any special cases for dexterity */
    }

    if (result == 0) /* none of the special cases applied */
        result = (tmp >= 25) ? 25 : (tmp <= 3) ? 3 : tmp;

    return schar(result);
}

/* condense clumsy ACURR(A_STR) value into value that fits into formulas */
export function acurrstr() { /* schar */
    let str = ACURR(A_STR),
        result; /* 3..25 */

    if (str <= STR18(0)) /* <= 18; max(,3) here is redundant */
        result = max(str, 3); /* 3..18 */
    else if (str <= STR19(21)) /* <= 121 */
        /* this converts
           18/01..18/31 into 19,
           18/32..18/81 into 20,
           18/82..18/100 and 19..21 into 21 */
        result = 19 + Math.trunc(str / 50); /* map to 19..21 */
    else /* convert 122..125; min(,125) here is redundant */
        result = min(str, 125) - 100; /* 22..25 */

    return schar(result);
}

/* when wearing (or taking off) an unID'd item, this routine is used
   to distinguish between observable +0 result and no-visible-effect
   due to an attribute not being able to exceed maximum or minimum */
export function extremeattr(
    attrindx) { /* boolean */ /* does attrindx's value match its max or min? */
    /* Fixed_abil and racial MINATTR/MAXATTR aren't relevant here */
    let lolimit = 3, hilimit = 25, curval = ACURR(attrindx);

    /* upper limit for Str is 25 but its value is encoded differently */
    if (attrindx == A_STR) {
        hilimit = STR19(25); /* 125 */
        /* lower limit for Str can also be 25 */
        if (uarmg && uarmg.otyp == GAUNTLETS_OF_POWER)
            lolimit = hilimit;
    } else if (attrindx == A_CON) {
        if (u_wield_art(ART_OGRESMASHER))
            lolimit = hilimit;
    }
    /* this exception is hypothetical; the only other worn item affecting
       Int or Wis is another helmet so can't be in use at the same time */
    if (attrindx == A_INT || attrindx == A_WIS) {
        if (uarmh && uarmh.otyp == DUNCE_CAP)
            hilimit = lolimit = 6;
    }

    /* are we currently at either limit? */
    return (curval == lolimit || curval == hilimit) ? TRUE : FALSE;
}

/* avoid possible problems with alignment overflow, and provide a centralized
   location for any future alignment limits */
export function adjalign(n) { /* void */
    let newalign = u.ualign.record + n;

    if (n < 0) {
        let newabuse = unsigned(u.ualign.abuse - unsigned(n));

        if (newalign < u.ualign.record)
            u.ualign.record = newalign;
        if (newabuse > u.ualign.abuse) {
            u.ualign.abuse = newabuse;
            adj_erinys(newabuse);
        }
    } else if (newalign > u.ualign.record) {
        u.ualign.record = newalign;
        if (u.ualign.record > ALIGNLIM())
            u.ualign.record = int(ALIGNLIM());
    }
}

/* change hero's alignment type, possibly losing use of artifacts */
export function uchangealign(
    newalign,
    reason) { /* void */ /* A_CG_CONVERT, A_CG_HELM_ON, or A_CG_HELM_OFF */
    let oldalign = u.ualign.type;

    u.ublessed = 0; /* lose divine protection */
    /* You/Your/pline message with call flush_screen(), triggering bot(),
       so the actual data change needs to come before the message */
    disp.botl = TRUE; /* status line needs updating */
    if (reason == A_CG_CONVERT) {
        /* conversion via altar */
        livelog_printf(LL_ALIGNMENT, _("permanently converted to %s"),
                       aligns[1 - newalign].adj);
        chars[u.ualignbase + A_CURRENT] = aligntyp(newalign);
        /* worn helm of opposite alignment might block change */
        if (!uarmh || uarmh.otyp != HELM_OF_OPPOSITE_ALIGNMENT)
            u.ualign.type = chars[u.ualignbase + A_CURRENT];
        You(_("have a %ssense of a new direction."),
            (u.ualign.type != oldalign) ? _("sudden ") : _(""));
    } else {
        /* putting on or taking off a helm of opposite alignment */
        u.ualign.type = aligntyp(newalign);
        if (reason == A_CG_HELM_ON) {
            adjalign(-7); /* for abuse -- record will be cleared shortly */
            Your(_("mind oscillates %s."), Hallucination() ? _("wildly") : _("briefly"));
            make_confused(rn1(2, 3), FALSE);
            if (Is_astralevel(u.uz) || (unsigned(rn2(50)) < u.ualign.abuse))
                summon_furies(Is_astralevel(u.uz) ? 0 : 1);
            /* don't livelog taking it back off */
            livelog_printf(LL_ALIGNMENT, _("used a helm to turn %s"),
                           aligns[1 - newalign].adj);
        } else if (reason == A_CG_HELM_OFF) {
            Your(_("mind is %s."), Hallucination()
                                    ? _("much of a muchness")
                                    : _("back in sync with your body"));
        }
    }
    if (u.ualign.type != oldalign) {
        u.ualign.record = 0; /* slate is wiped clean */
        retouch_equipment(0);
    }
}

/*attrib.c*/

import { A_CG_CONVERT, A_CG_HELM_OFF, A_CG_HELM_ON, aligntyp } from "./align.h.js";
import { ALIGNLIM } from "./align.h.macros.js";
import { ART_EYES_OF_THE_OVERWORLD, ART_OGRESMASHER } from "./artilist.h.js";
import { A_CHA, A_CON, A_DEX, A_INT, A_MAX, A_STR, A_WIS } from "./attrib.h.js";
import {
    ABASE, ABON, ACURR, AEXE, AMAX, ATEMP, ATIME, ATTRMAX, ATTRMIN, STR18, STR19,
} from "./attrib.h.macros.js";
import { something } from "./decl.h.macros.js";
import { S_NYMPH } from "./defsym.h.js";
import { Is_astralevel } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_ALIGNMENT, MAXULEV, TRUE, xint16 } from "./global.h.js";
import {
    DIED, EXT_ENCUMBER, FACE, FAINTED, FAINTING, HUNGRY, HVY_ENCUMBER, KILLED_BY, KILLED_BY_AN,
    MOD_ENCUMBER, NOT_HUNGRY, POISONING, SATIATED, WEAK,
} from "./hack.h.js";
import { max, min, rn1 } from "./hack.h.macros.js";
import { debugpline0, debugpline1, debugpline2, showdebug } from "./lint.h.macros.js";
import { haseyes, type_is_pname } from "./mondata.h.macros.js";
import { G_UNIQ } from "./monflag.h.js";
import { ismnum } from "./monst.h.macros.js";
import {
    PM_AMOROUS_DEMON, PM_ARCHEOLOGIST, PM_BARBARIAN, PM_CAVE_DWELLER, PM_CLERIC, PM_DWARF, PM_ELF,
    PM_GNOME, PM_HEALER, PM_HUMAN, PM_KNIGHT, PM_MONK, PM_ORC, PM_RANGER, PM_ROGUE, PM_SAMURAI,
    PM_TOURIST, PM_VALKYRIE, PM_WIZARD,
} from "./monsters.h.js";
import { u_wield_art } from "./obj.h.macros.js";
import {
    DUNCE_CAP, GAUNTLETS_OF_POWER, HELM_OF_OPPOSITE_ALIGNMENT, LUCKSTONE,
} from "./objects.h.js";
import {
    BLINDED, BLND_RES, CLAIRVOYANT, COLD_RES, DEAF, DRAIN_RES, FAST, FIRE_RES, FROMEXPER, FROMFORM,
    FROMOUTSIDE, FROMRACE, INFRAVISION, INTRINSIC, INVIS, JUMPING, POISON_RES, SEARCHING, SEE_INVIS,
    SHOCK_RES, SLEEP_RES, STEALTH, STRANGLED, TELEPORT_CONTROL, TIMEOUT, WARNING, W_ARMC, W_ARMF,
    W_ARMH,
} from "./prop.h.js";
import { A_CURRENT, LUCKADD, LUCKMAX, LUCKMIN } from "./you.h.js";
import { Race_switch, Role_if, Role_switch, Upolyd } from "./you.h.macros.js";
import {
    BBlinded, BClairvoyant, BlindedTimeout, Blindfolded_only, Confusion, EBlinded, EFast,
    Fixed_abil, Fumbling, HBlinded, HBlnd_resist, HClairvoyant, HFast, HRegeneration, HStun,
    Half_gas_damage, Hallucination, Poison_resistance, Sick, Very_fast, Vomiting, Wounded_legs,
} from "./youprop.h.macros.js";
import {
    char, int, long, ord, schar, short, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, not64, or64 } from "../rt/int64.js";
import { abs, assert, isupper, sprintf, strcmp, strcpy, strlen } from "../rt/libc.js";
import { init_list, init_string, stack_array, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, fnptr_t, ptr_add, ptr_to, ref_of, struct } from "../rt/struct.js";
import { confers_luck, is_art, retouch_equipment, what_gives } from "./artifact.js";
import { disp, flags, gi, gm, gu, gy, iflags, program_state, svc, svk, svm, u } from "./decl.js";
import { see_monsters, shieldeff } from "./display.js";
import { done } from "./end.js";
import { losehp, near_capacity } from "./hack.js";
import { copynchars, sgn, strncmpi, strstri } from "./hacklib.js";
import { carrying } from "./invent.js";
import { summon_furies } from "./makemon.js";
import { adj_erinys } from "./mon.js";
import { name_to_mon } from "./mondata.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import { bare_artifactname, the, ysimple_name } from "./objnam.js";
import { encumber_msg } from "./pickup.js";
import { You, You_feel, Your, impossible, livelog_printf, pline, pline_The } from "./pline.js";
import { body_part } from "./polyself.js";
import { make_confused } from "./potion.js";
import { d, rn2, rnd } from "./rnd.js";
import { aligns } from "./role.js";
import { add_weapon_skill, lose_weapon_skill } from "./weapon.js";
const __FILE__ = "attrib.c";
