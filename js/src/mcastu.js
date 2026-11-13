/* NetHack 5.0	mcastu.c	$NHDT-Date: 1770949988 2026/02/12 18:33:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.111 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

const struct__mcast_data = struct("struct__mcast_data", {
    level: int,
    flags: int,
});

const mcast_data = static_array("mcast_data", struct__mcast_data, null, [
    ...mcast_data_records(),
]);

/* spell lists for specific monster casters */
/* the spells in the list should be in ascending level order */
const mon_cleric_spells = static_array("mon_cleric_spells", int, null, [
    MCAST_OPEN_WOUNDS, MCAST_CURE_SELF, MCAST_CONFUSE_YOU, MCAST_PARALYZE,
    MCAST_BLIND_YOU, MCAST_INSECTS, MCAST_CURSE_ITEMS, MCAST_LIGHTNING,
    MCAST_FIRE_PILLAR, MCAST_GEYSER
]);
const mon_wizard_spells = static_array("mon_wizard_spells", int, null, [
    MCAST_PSI_BOLT, MCAST_CURE_SELF, MCAST_HASTE_SELF, MCAST_STUN_YOU,
    MCAST_DISAPPEAR, MCAST_WEAKEN_YOU, MCAST_DESTRY_ARMR, MCAST_CURSE_ITEMS,
    MCAST_AGGRAVATION, MCAST_SUMMON_MONS, MCAST_CLONE_WIZ, MCAST_DEATH_TOUCH
]);

/* feedback when frustrated monster couldn't cast a spell */
function cursetxt(mtmp, undirected) { /* void */
    if (canseemon(mtmp) && couldsee(mtmp.mx, mtmp.my)) {
        let point_msg; /* spellcasting monsters are impolite */

        if (undirected)
            point_msg = _("all around, then curses");
        else if ((Invis() && !perceives(mtmp.data)
                  && (mtmp.mux != u.ux || mtmp.muy != u.uy))
                 || is_obj_mappear(gy.youmonst, STRANGE_OBJECT)
                 || u.uundetected)
            point_msg = _("and curses in your general direction");
        else if (Displaced() && (mtmp.mux != u.ux || mtmp.muy != u.uy))
            point_msg = _("and curses at your displaced image");
        else
            point_msg = _("at you, then curses");

        pline_mon(mtmp, _("%s points %s."), Monnam(mtmp), point_msg);
    } else if ((!(svm.moves % 4) || !rn2(4))) {
        if (!Deaf())
            Norep(_("You hear a mumbled curse."));   /* Deaf-aware */
    }
}

/* choose a spell for monster to cast */
function choose_monster_spell(mtmp, adtyp) { /* int */
    let list = null;
    let i, spellval, len = 0;
    let maxlev;

    /* which spell list to use? */
    if (adtyp == AD_SPEL) {
        list = mon_wizard_spells;
        len = SIZE(mon_wizard_spells);
    } else if (adtyp == AD_CLRC) {
        list = mon_cleric_spells;
        len = SIZE(mon_cleric_spells);
    }

    if (!list || len < 1)
        return MCAST_PSI_BOLT;

    /* max spell level in this monster spell list */
    maxlev = mcast_data[list[len - 1]].level;

    /* which level spell to cast? */
    spellval = rn2(mtmp.m_lev);
    if (spellval > maxlev && rn2(maxlev))
        spellval = rn2(maxlev);

    /* find the highest spell in the list we could cast */
    for (i = len-1; i >= 0; i--)
        if (mcast_data[list[i]].level <= spellval
            && !spell_would_be_useless(mtmp, list[i]))
            return list[i];

    /* or return the first spell in the list */
    return list[0];
}

/* return values:
 * 1: successful spell
 * 0: unsuccessful spell
 */
export function castmu(
    mtmp,
    mattk,
    thinks_it_foundyou,
    foundyou) { /* int */ /* knows hero's precise location */
    let dmg, ml = mtmp.m_lev;
    let ret;
    let spellnum = 0;

    /* Three cases:
     * -- monster is attacking you.  Search for a useful spell.
     * -- monster thinks it's attacking you.  Search for a useful spell,
     *    without checking for undirected.  If the spell found is directed,
     *    it fails with cursetxt() and loss of mspec_used.
     * -- monster isn't trying to attack.  Select a spell once.  Don't keep
     *    searching; if that spell is not useful (or if it's directed),
     *    return and do something else.
     * Since most spells are directed, this means that a monster that isn't
     * attacking casts spells only a small portion of the time that an
     * attacking monster does.
     */
    if ((mattk.adtyp == AD_SPEL || mattk.adtyp == AD_CLRC) && ml) {
        let cnt = 40;

        do {
            spellnum = choose_monster_spell(mtmp, mattk.adtyp);
            /* not trying to attack?  don't allow directed spells */
            if (!thinks_it_foundyou) {
                if (!is_undirected_spell(spellnum)
                    || spell_would_be_useless(mtmp, spellnum)) {
                    if (foundyou)
                        impossible(
                       _("spellcasting monster found you and doesn't know it?"));
                    return M_ATTK_MISS;
                }
                break;
            }
        } while (--cnt > 0
                 && spell_would_be_useless(mtmp, spellnum));
        if (cnt == 0)
            return M_ATTK_MISS;
    }

    /* monster unable to cast spells? */
    if (mtmp.mcan || mtmp.mspec_used || !ml
        || m_seenres(mtmp, cvt_adtyp_to_mseenres(mattk.adtyp))) {
        cursetxt(mtmp, is_undirected_spell(spellnum));
        return M_ATTK_MISS;
    }

    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("castmu:%s,lvl:%i,spell:%i"), noit_Monnam(mtmp), ml, spellnum); iflags.last_msg = save_plnmsg; } } while (0);

    if (mattk.adtyp == AD_SPEL || mattk.adtyp == AD_CLRC) {
        /* monst->m_lev is unsigned (uchar), monst->mspec_used is int */
        mtmp.mspec_used = ((mtmp.m_lev < 8) ? (10 - mtmp.m_lev) : 2);
    }

    /* Monster can cast spells, but is casting a directed spell at the
     * wrong place?  If so, give a message, and return.
     * Do this *after* penalizing mspec_used.
     *
     * FIXME?
     *  Shouldn't wall of lava have a case similar to wall of water?
     *  And should cold damage hit water or lava instead of missing
     *  even when the caster has targeted the wrong spot?  Likewise
     *  for fire mis-aimed at ice.
     */
    if (!foundyou && thinks_it_foundyou
        && !is_undirected_spell(spellnum)) {
        pline_mon(mtmp, _("%s casts a spell at %s!"),
                 canseemon(mtmp) ? Monnam(mtmp) : _("Something"),
                 is_waterwall(mtmp.mux, mtmp.muy) ? _("empty water")
                                                    : _("thin air"));
        return M_ATTK_MISS;
    }

    nomul(0);
    if (rn2(ml * 10) < (mtmp.mconf ? 100 : 20)) { /* fumbled attack */
         ;
        if (canseemon(mtmp) && !Deaf()) {
            set_msg_xy(mtmp.mx, mtmp.my);
            pline_The(_("air crackles around %s."), mon_nam(mtmp));
        }
        return M_ATTK_MISS;
    }
    if (canspotmon(mtmp) || !is_undirected_spell(spellnum)) {
        pline_mon(mtmp, _("%s casts a spell%s!"),
                 canspotmon(mtmp) ? Monnam(mtmp) : _("Something"),
                 is_undirected_spell(spellnum) ? _("")
                 : (Invis() && !perceives(mtmp.data)
                    && !(((mtmp.mux) == u.ux) && ((mtmp.muy) == u.uy)))
                   ? _(" at a spot near you")
                   : (Displaced() && !(((mtmp.mux) == u.ux) && ((mtmp.muy) == u.uy)))
                     ? _(" at your displaced image")
                     : _(" at you"));
    }

    /*
     * As these are spells, the damage is related to the level
     * of the monster casting the spell.
     */
    if (!foundyou) {
        dmg = 0;
        if (mattk.adtyp != AD_SPEL && mattk.adtyp != AD_CLRC) {
            impossible(
              _("%s casting non-hand-to-hand version of hand-to-hand spell %d?"),
                       Monnam(mtmp), mattk.adtyp);
            return M_ATTK_MISS;
        }
    } else if (mattk.damd)
        dmg = d((Math.trunc(ml / 2) + mattk.damn), mattk.damd);
    else
        dmg = d((Math.trunc(ml / 2) + 1), 6);
    if (Half_spell_damage())
        dmg = Math.trunc((dmg + 1) / 2);

    ret = M_ATTK_HIT;
    /*
     * FIXME: none of these hit the steed when hero is riding, nor do
     *  they inflict damage on carried items.
     */
    switch (mattk.adtyp) {
    case AD_FIRE:
        pline(_("You're enveloped in flames."));
        if (Fire_resistance()) {
            shieldeff(u.ux, u.uy);
            pline(_("But you resist the effects."));
            monstseesu(M_SEEN_FIRE);
            dmg = 0;
        } else {
            monstunseesu(M_SEEN_FIRE);
        }
        burn_away_slime();
        /* burn up flammable items on the floor, melt ice terrain */
        mon_spell_hits_spot(mtmp, AD_FIRE, u.ux, u.uy);
        break;
    case AD_COLD:
        pline(_("You're covered in frost."));
        if (Cold_resistance()) {
            shieldeff(u.ux, u.uy);
            pline(_("But you resist the effects."));
            monstseesu(M_SEEN_COLD);
            dmg = 0;
        } else {
            monstunseesu(M_SEEN_COLD);
        }
        /* freeze water or lava terrain */
        /* FIXME: mon_spell_hits_spot() uses zap_over_floor(); unlike with
         * fire, it does not target susceptible floor items with cold */
        mon_spell_hits_spot(mtmp, AD_COLD, u.ux, u.uy);
        break;
    case AD_MAGM:
        You(_("are hit by a shower of missiles!"));
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
            pline_The(_("missiles bounce off!"));
            monstseesu(M_SEEN_MAGR);
            dmg = 0;
        } else {
            dmg = d(Math.trunc(mtmp.m_lev / 2) + 1, 6);
            monstunseesu(M_SEEN_MAGR);
        }
        /* shower of magic missiles scuffs an engraving */
        mon_spell_hits_spot(mtmp, AD_MAGM, u.ux, u.uy);
        break;
    case AD_SPEL: /* wizard spell */
    case AD_CLRC: /* clerical spell */
        mcast_spell(mtmp, dmg, spellnum);
        dmg = 0; /* done by the spell casting functions */
        break;
    } /* switch */
    if (dmg)
        mdamageu(mtmp, dmg);
    return ret;
}

function m_cure_self(mtmp, dmg) { /* int */
    if (mtmp.mhp < mtmp.mhpmax) {
        if (canseemon(mtmp))
            pline_mon(mtmp, _("%s looks better."), Monnam(mtmp));
        /* note: player healing does 6d4; this used to do 1d8 */
        healmon(mtmp, d(3, 6), 0);
        dmg = 0;
    }
    return dmg;
}

/* unlike the finger of death spell which behaves like a wand of death,
   this monster spell only attacks the hero */
export function touch_of_death(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let kbuf = stack_array(char, BUFSZ);
    let dmg = 50 + d(8, 6);
    let drain = Math.trunc(dmg / 2);

    /* if we get here, we know that hero isn't magic resistant and isn't
       poly'd into an undead or demon */
    You_feel(_("drained..."));
    death_inflicted_by(kbuf, _("the touch of death"), mtmp);

    if (Upolyd()) {
        u.mh = 0;
        rehumanize(); /* fatal iff Unchanging */
    } else if (drain >= u.uhpmax) {
        svk.killer.format = KILLED_BY;
        strcpy(svk.killer.name, kbuf);
        done(DIED);
    } else {
        /* HP manipulation similar to poisoned(attrib.c) */
        let olduhp = u.uhp,
            uhpmin = minuhpmax(3),
            newuhpmax = u.uhpmax - drain;

        setuhpmax(max(newuhpmax, uhpmin), FALSE);
        dmg = adjuhploss(dmg, olduhp); /* reduce pending damage if uhp has
                                        * already been reduced due to drop
                                        * in uhpmax */
        losehp(dmg, kbuf, KILLED_BY);
    }
    chars[svk.killer.name + 0] = ord('\0'); /* not killed if we get here... */
    } finally { stack_pop($frame); }
}

/* give a reason for death by some monster spells */
export function death_inflicted_by(
    outbuf,
    deathreason,
    mtmp) { /* char * */ /* monster who caused it */
    strcpy(outbuf, deathreason);
    if (mtmp) {
        let mptr = mtmp.data,
            champtr = ismnum(mtmp.cham) ? mons[mtmp.cham] : mptr;
        let realnm = pmname(champtr, Mgender(mtmp)),
            fakenm = pmname(mptr, Mgender(mtmp));

        /* greatly simplified extract from done_in_by(), primarily for
           reason for death due to 'touch of death' spell; if mtmp is
           shape changed, it won't be a vampshifter or mimic since they
           can't cast spells */
        if (!type_is_pname(champtr) && !the_unique_pm(mptr))
            realnm = an(realnm);
        sprintf(eos(outbuf), _(" inflicted by %s%s"), the_unique_pm(mptr) ? _("the ") : _(""), realnm)
;
        if (champtr != mptr)
            sprintf(eos(outbuf), _(" imitating %s"), an(fakenm));
    }
    return outbuf;
}

/*
 * Monster wizard and cleric spellcasting functions.
 */

function mcast_death_touch(mtmp) { /* void */
    pline(_("Oh no, %s's using the touch of death!"), mhe(mtmp));
    if (nonliving(gy.youmonst.data) || is_demon(gy.youmonst.data)) {
        You(_("seem no deader than before."));
    } else if (!Antimagic() && rn2(mtmp.m_lev) > 12) {
        if (Hallucination()) {
            You(_("have an out of body experience."));
        } else {
            touch_of_death(mtmp);
        }
        monstunseesu(M_SEEN_MAGR);
    } else {
        if (Antimagic()) {
            shieldeff(u.ux, u.uy);
            monstseesu(M_SEEN_MAGR);
        }
        pline(_("Lucky for you, it didn't work!"));
    }
}

function mcast_clone_wiz(mtmp) { /* void */
    if (mtmp.iswiz && svc.context.no_of_wizards == 1) {
        pline(_("Double Trouble..."));
        clonewiz();
    } else
        impossible(_("bad wizard cloning?"));
}

function mcast_summon_mons(mtmp) { /* void */
    let count = nasty(mtmp);

    if (!count) {
        ; /* nothing was created? */
    } else if (mtmp.iswiz) {
           ;
        verbalize(_("Destroy the thief, my pet%s!"), plur(count));
    } else {
        let one = +(count == 1);
        let mappear = one ? _("A monster appears")
                                  : _("Monsters appear");

        /* messages not quite right if plural monsters created but
           only a single monster is seen */
        if (Invis() && !perceives(mtmp.data)
            && (mtmp.mux != u.ux || mtmp.muy != u.uy))
            pline(_("%s %s a spot near you!"), mappear,
                  one ? _("at") : _("around"));
        else if (Displaced() && (mtmp.mux != u.ux || mtmp.muy != u.uy))
            pline(_("%s %s your displaced image!"), mappear,
                  one ? _("by") : _("around"));
        else
            pline(_("%s from nowhere!"), mappear);
    }
}

function mcast_destroy_armor() { /* void */
    if (Antimagic()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        pline(_("A field of force surrounds you!"));
    } else if (!destroy_arm()) {
        Your(_("skin itches."));
    } else {
        /* monsters only realize you aren't magic-protected if armor is
           actually destroyed */
        monstunseesu(M_SEEN_MAGR);
    }
}

function mcast_weaken_you(mtmp, dmg) { /* void */
    const $frame = stack_frame(); try {
    if (Antimagic()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        You_feel(_("momentarily weakened."));
    } else {
        let kbuf = stack_array(char, BUFSZ);

        You(_("suddenly feel weaker!"));
        dmg = mtmp.m_lev - 6;
        if (dmg < 1) /* paranoia since only chosen when m_lev is high */
            dmg = 1;
        if (Half_spell_damage())
            dmg = Math.trunc((dmg + 1) / 2);
        losestr(rnd(dmg),
                death_inflicted_by(kbuf, _("strength loss"), mtmp),
                KILLED_BY);
        chars[svk.killer.name + 0] = ord('\0'); /* not killed if we get here... */
        monstunseesu(M_SEEN_MAGR);
    }
    } finally { stack_pop($frame); }
}

function mcast_disappear(mtmp) { /* void */
    if (!mtmp.minvis && !mtmp.invis_blkd) {
        if (canseemon(mtmp))
            pline_mon(mtmp, _("%s suddenly %s!"), Monnam(mtmp),
                      !See_invisible() ? _("disappears") : _("becomes transparent"));
        mon_set_minvis(mtmp, FALSE);
        if (cansee(mtmp.mx, mtmp.my) && !canspotmon(mtmp))
            map_invisible(mtmp.mx, mtmp.my);
    } else
        impossible(_("no reason for monster to cast disappear spell?"));
}

function mcast_stun_you(dmg) { /* void */
    if (Antimagic() || Free_action()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        if (!Stunned())
            You_feel(_("momentarily disoriented."));
        make_stunned(1, FALSE);
    } else {
        You(Stunned() ? _("struggle to keep your balance.") : _("reel..."));
        dmg = d(ACURR(A_DEX) < 12 ? 6 : 4, 4);
        if (Half_spell_damage())
            dmg = Math.trunc((dmg + 1) / 2);
        make_stunned((HStun() & TIMEOUT) + dmg, FALSE);
        monstunseesu(M_SEEN_MAGR);
    }
}

function mcast_geyser(dmg) { /* int */
    /* this is physical damage (force not heat),
     * not magical damage or fire damage
     */
    pline(_("A sudden geyser slams into you from nowhere!"));
    dmg = d(8, 6);
    if (Half_physical_damage())
        dmg = Math.trunc((dmg + 1) / 2);

    return dmg;
}

function mcast_fire_pillar(mtmp, dmg) { /* int */
    let orig_dmg;

    pline(_("A pillar of fire strikes all around you!"));
    orig_dmg = dmg = d(8, 6);
    if (Fire_resistance()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_FIRE);
        dmg = 0;
    } else {
        monstunseesu(M_SEEN_FIRE);
    }
    if (Half_spell_damage())
        dmg = Math.trunc((dmg + 1) / 2);
    burn_away_slime();
    burnarmor(gy.youmonst);
    /* item destruction dmg */
    destroy_items(gy.youmonst, AD_FIRE, orig_dmg);
    ignite_items(gi.invent);
    /* burn up flammable items on the floor, melt ice terrain */
    mon_spell_hits_spot(mtmp, AD_FIRE, u.ux, u.uy);
    return dmg;
}

function mcast_lightning(mtmp, dmg) { /* int */
    let orig_dmg;
    let reflects;

     ;
    pline(_("A bolt of lightning strikes down at you from above!"));
    reflects = ureflects(_("It bounces off your %s%s."), _(""));
    orig_dmg = dmg = d(8, 6);
    if (reflects || Shock_resistance()) {
        shieldeff(u.ux, u.uy);
        dmg = 0;
        if (reflects) {
            monstseesu(M_SEEN_REFL);
            return dmg;
        }
        monstunseesu(M_SEEN_REFL);
        monstseesu(M_SEEN_ELEC);
    } else {
        monstunseesu(M_SEEN_ELEC | M_SEEN_REFL);
    }
    if (Half_spell_damage())
        dmg = Math.trunc((dmg + 1) / 2);
    destroy_items(gy.youmonst, AD_ELEC, orig_dmg);
    /* lightning might destroy iron bars if hero is on such a spot;
       reflection protects terrain here [execution won't get here due
       to 'if (reflects) break' above] but hero resistance doesn't;
       do this before maybe blinding the hero via flashburn() */
    mon_spell_hits_spot(mtmp, AD_ELEC, u.ux, u.uy);
    /* blind hero; no effect if already blind */
    flashburn(rnd(100), TRUE);
    return dmg;
}

function mcast_psi_bolt(dmg) { /* int */
    /* prior to 3.4.0 Antimagic was setting the damage to 1--this
       made the spell virtually harmless to players with magic res. */
    if (Antimagic()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        dmg = Math.trunc((dmg + 1) / 2);
    } else {
        monstunseesu(M_SEEN_MAGR);
    }
    if (dmg <= 5)
        You(_("get a slight %sache."), body_part(HEAD));
    else if (dmg <= 10)
        Your(_("brain is on fire!"));
    else if (dmg <= 20)
        Your(_("%s suddenly aches painfully!"), body_part(HEAD));
    else
        Your(_("%s suddenly aches very painfully!"), body_part(HEAD));
    return dmg;
}

function mcast_open_wounds(dmg) { /* int */
    if (Antimagic()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        dmg = Math.trunc((dmg + 1) / 2);
    } else {
        monstunseesu(M_SEEN_MAGR);
    }
    if (dmg <= 5)
        Your(_("skin itches badly for a moment."));
    else if (dmg <= 10)
        pline(_("Wounds appear on your body!"));
    else if (dmg <= 20)
        pline(_("Severe wounds appear on your body!"));
    else
        Your(_("body is covered with painful wounds!"));
    return dmg;
}

function mcast_insects(mtmp) { /* void */
    const $frame = stack_frame(); try {
    /* Try for insects, and if there are none
       left, go for (sticks to) snakes.  -3. */
    let pm = mkclass(S_ANT, 0);
    let mtmp2 = null;
    let whatbuf = stack_array(char, QBUFSZ), let_ = (pm ? S_ANT : S_SNAKE);
    let success = FALSE, seecaster;
    let i, quan, oldseen, newseen;
    let bypos = stack_struct(struct_nhcoord);
    let fmt, what;

    oldseen = monster_census(TRUE);
    quan = (mtmp.m_lev < 2) ? 1 : rnd(Math.trunc(mtmp.m_lev / 2));
    if (quan < 3)
        quan = 3;
    for (i = 0; i <= quan; i++) {
        if (!enexto(bypos, mtmp.mux, mtmp.muy, mtmp.data))
            return;
        if ((pm = mkclass(let_, 0)) != null
            && (mtmp2 = makemon(pm, bypos.x, bypos.y, MM_ANGRY | MM_NOMSG))
            != null) {
            success = TRUE;
            mtmp2.msleeping = mtmp2.mpeaceful = mtmp2.mtame = 0;
            set_malign(mtmp2);
        }
    }
    newseen = monster_census(TRUE);

    /* not canspotmon() which includes unseen things sensed via warning */
    seecaster = (canseemon(mtmp) || tp_sensemon(mtmp) || Detect_monsters() ? 1 : 0);
    what = (let_ == S_SNAKE) ? _("snakes") : _("insects");
    if (Hallucination())
        what = makeplural(bogusmon(whatbuf, 0));

    fmt = 0;
    if (!seecaster) {
        if (newseen <= oldseen || Unaware()) {
            /* unseen caster fails or summons unseen critters,
               or unconscious hero ("You dream that you hear...") */
            You_hear(_("someone summoning %s."), what);
        } else {
            let arg;

            if (what != whatbuf)
                what = strcpy(whatbuf, what);
            /* unseen caster summoned seen critter(s) */
            arg = (newseen == oldseen + 1) ? an(makesingular(what))
                                           : whatbuf;
            if (!Deaf()) {
                 ;
                You_hear(_("someone summoning something, and %s %s."), arg,
                         vtense(arg, _("appear")));
            } else {
                pline(_("%s %s."), upstart(arg), vtense(arg, _("appear")));
            }
        }

        /* seen caster, possibly producing unseen--or just one--critters;
           hero is told what the caster is doing and doesn't necessarily
           observe complete accuracy of that caster's results (in other
           words, no need to fuss with visibility or singularization;
           player is told what's happening even if hero is unconscious) */
    } else if (!success) {
        fmt = _("%s casts at a clump of sticks, but nothing happens.%s");
        what = _("");
    } else if (let_ == S_SNAKE) {
        fmt = _("%s transforms a clump of sticks into %s!");
    } else if (Invis() && !perceives(mtmp.data)
               && (mtmp.mux != u.ux || mtmp.muy != u.uy)) {
        fmt = _("%s summons %s around a spot near you!");
    } else if (Displaced() && (mtmp.mux != u.ux || mtmp.muy != u.uy)) {
        fmt = _("%s summons %s around your displaced image!");
    } else {
        fmt = _("%s summons %s!");
    }
    if (fmt) {
        ;
        pline_mon(mtmp, fmt, Monnam(mtmp), what);
        ;
    }
    } finally { stack_pop($frame); }
}

function mcast_blind_you() { /* void */
    /* note: resists_blnd() doesn't apply here */
    if (!Blinded()) {
        let num_eyes = eyecount(gy.youmonst.data);

        pline(_("Scales cover your %s!"), (num_eyes == 1)
                                       ? body_part(EYE)
                                       : makeplural(body_part(EYE)));
        make_blinded(Half_spell_damage() ? 100 : 200, FALSE);
        if (!Blind())
            Your1(vision_clears());
    } else
        impossible(_("no reason for monster to cast blindness spell?"));
}

function mcast_paralyze(mtmp) { /* int */
    let dmg = 0;

    if (Antimagic() || Free_action()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        if (gm.multi >= 0)
            You(_("stiffen briefly."));
        dmg = 1; /* to produce nomul(-1), not actual damage */
    } else {
        if (gm.multi >= 0)
            You(_("are frozen in place!"));
        dmg = 4 + mtmp.m_lev;
        if (Half_spell_damage())
            dmg = Math.trunc((dmg + 1) / 2);
        monstunseesu(M_SEEN_MAGR);
    }
    nomul(-dmg);
    gm.multi_reason = _("paralyzed by a monster");
    gn.nomovemsg = 0;
    return dmg;
}

function mcast_confuse_you(mtmp) { /* void */
    if (Antimagic()) {
        shieldeff(u.ux, u.uy);
        monstseesu(M_SEEN_MAGR);
        You_feel(_("momentarily dizzy."));
    } else {
        let oldprop = +!!Confusion();
        let dmg = mtmp.m_lev;

        if (Half_spell_damage())
            dmg = Math.trunc((dmg + 1) / 2);
        make_confused(HConfusion() + dmg, TRUE);
        if (Hallucination())
            You_feel(_("%s!"), oldprop ? _("trippier") : _("trippy"));
        else
            You_feel(_("%sconfused!"), oldprop ? _("more ") : _(""));
        monstunseesu(M_SEEN_MAGR);
    }
}

/*
   If dmg is zero, then the monster is not casting at you.
   If the monster is intentionally not casting at you, we have previously
   called spell_would_be_useless() and spellnum should always be a valid
   undirected spell.
   If you modify either of these, be sure to change is_undirected_spell()
   and spell_would_be_useless().
 */
function mcast_spell(mtmp, dmg, spellnum) { /* void */
    if (dmg < 0) {
        impossible(_("monster cast spell (%d) with negative dmg (%d)?"),
                   spellnum, dmg);
        return;
    }
    if (dmg == 0 && !is_undirected_spell(spellnum)) {
        impossible(_("cast directed wizard spell (%d) with dmg=0?"), spellnum);
        return;
    }

    switch (spellnum) {
    case MCAST_DEATH_TOUCH:
        mcast_death_touch(mtmp);
        dmg = 0;
        break;
    case MCAST_CLONE_WIZ:
        mcast_clone_wiz(mtmp);
        dmg = 0;
        break;
    case MCAST_SUMMON_MONS:
        mcast_summon_mons(mtmp);
        dmg = 0;
        break;
    case MCAST_AGGRAVATION:
        You_feel(_("that monsters are aware of your presence."));
        aggravate();
        dmg = 0;
        break;
    case MCAST_CURSE_ITEMS:
        You_feel(_("as if you need some help."));
        rndcurse();
        dmg = 0;
        break;
    case MCAST_DESTRY_ARMR:
        mcast_destroy_armor();
        dmg = 0;
        break;
    case MCAST_WEAKEN_YOU: /* drain strength */
        mcast_weaken_you(mtmp, dmg);
        dmg = 0;
        break;
    case MCAST_DISAPPEAR: /* makes self invisible */
        mcast_disappear(mtmp);
        dmg = 0;
        break;
    case MCAST_STUN_YOU:
        mcast_stun_you(dmg);
        dmg = 0;
        break;
    case MCAST_HASTE_SELF:
        mon_adjust_speed(mtmp, 1, null);
        dmg = 0;
        break;
    case MCAST_CURE_SELF:
        dmg = m_cure_self(mtmp, dmg);
        break;
    case MCAST_PSI_BOLT:
        dmg = mcast_psi_bolt(dmg);
        break;
    case MCAST_GEYSER:
        dmg = mcast_geyser(dmg);
        break;
    case MCAST_FIRE_PILLAR:
        dmg = mcast_fire_pillar(mtmp, dmg);
        break;
    case MCAST_LIGHTNING:
        dmg = mcast_lightning(mtmp, dmg);
        break;
    case MCAST_INSECTS:
        mcast_insects(mtmp);
        dmg = 0;
        break;
    case MCAST_BLIND_YOU:
        mcast_blind_you();
        dmg = 0;
        break;
    case MCAST_PARALYZE:
        dmg = mcast_paralyze(mtmp);
        break;
    case MCAST_CONFUSE_YOU:
        mcast_confuse_you(mtmp);
        dmg = 0;
        break;
    case MCAST_OPEN_WOUNDS:
        dmg = mcast_open_wounds(dmg);
        break;
    default:
        impossible(_("mcastu: invalid magic spell (%d)"), spellnum);
        dmg = 0;
        break;
    }

    if (dmg)
        mdamageu(mtmp, dmg);
}

function is_undirected_spell(spellnum) { /* boolean */
    if ((mcast_data[spellnum].flags & MCF_INDIRECT) != 0)
        return TRUE;
    return FALSE;
}

/* Some spells are useless under some circumstances. */
function spell_would_be_useless(mtmp, spellnum) { /* boolean */
    /* Some spells don't require the player to really be there and can be cast
     * by the monster when you're invisible, yet still shouldn't be cast when
     * the monster doesn't even think you're there.
     * This check isn't quite right because it always uses your real position.
     * We really want something like "if the monster could see mux, muy".
     */

    /* spell is only cast by hostile monsters */
    if ((mcast_data[spellnum].flags & MCF_HOSTILE) != 0) {
        if (mtmp.mpeaceful)
            return TRUE;
    }

    /* spell needs the monster to see hero */
    if ((mcast_data[spellnum].flags & MCF_SIGHT) != 0) {
        let mcouldseeu = couldsee(mtmp.mx, mtmp.my);

        if (!mcouldseeu)
            return TRUE;
    }

    switch (spellnum) {
    case MCAST_DEATH_TOUCH:
        if ((Antimagic() || Hallucination()) && !rn2(2))
            return TRUE;
        break;
    case MCAST_GEYSER:
        if (!rn2(5))
            return TRUE;
        break;
    case MCAST_CLONE_WIZ:
        /* only the Wizard is allowed to clone himself */
        if (!mtmp.iswiz || svc.context.no_of_wizards > 1)
            return TRUE;
        break;
    case MCAST_AGGRAVATION:
        /* aggravation (global wakeup) when everyone is already active */
        /* if nothing needs to be awakened then this spell is useless
           but caster might not realize that [chance to pick it then
           must be very small otherwise caller's many retry attempts
           will eventually end up picking it too often] */
        if (!has_aggravatables(mtmp))
            return rn2(100) ? TRUE : FALSE;
        break;
    case MCAST_HASTE_SELF:
        /* haste self when already fast */
        if (mtmp.permspeed == MFAST)
            return TRUE;
        break;
    case MCAST_DISAPPEAR:
        /* invisibility when already invisible */
        if (mtmp.minvis || mtmp.invis_blkd)
            return TRUE;
        /* peaceful monster won't cast invisibility if you can't see
           invisible,
           same as when monsters drink potions of invisibility.  This doesn't
           really make a lot of sense, but lets the player avoid hitting
           peaceful monsters by mistake */
        if (mtmp.mpeaceful && !See_invisible())
            return TRUE;
        break;
    case MCAST_CURE_SELF:
        /* healing when already healed */
        if (mtmp.mhp == mtmp.mhpmax)
            return TRUE;
        break;
    case MCAST_BLIND_YOU:
        if (Blinded())
            return TRUE;
        break;
    default:
        break;
    }
    return FALSE;
}

/* monster uses spell (ranged) */
export function buzzmu(mtmp, mattk) { /* int */
    /* don't print constant stream of curse messages for 'normal'
       spellcasting monsters at range */
    if (!BZ_VALID_ADTYP(mattk.adtyp))
        return M_ATTK_MISS;

    if (mtmp.mcan || m_seenres(mtmp, cvt_adtyp_to_mseenres(mattk.adtyp))) {
        cursetxt(mtmp, FALSE);
        return M_ATTK_MISS;
    }
    if (lined_up(mtmp) && rn2(3)) {
        nomul(0);
        if (canseemon(mtmp))
            pline_mon(mtmp, _("%s zaps you with a %s!"), Monnam(mtmp),
                  flash_str(BZ_OFS_AD(mattk.adtyp), FALSE));
        gb.buzzer = mtmp;
        buzz(BZ_M_SPELL(BZ_OFS_AD(mattk.adtyp)), mattk.damn,
             mtmp.mx, mtmp.my, sgn(gt.tbx), sgn(gt.tby));
        gb.buzzer = null;
        return M_ATTK_HIT;
    }
    return M_ATTK_MISS;
}

/*mcastu.c*/

import { A_DEX } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { vision_clears } from "./decl.h.macros.js";
import { S_ANT, S_SNAKE } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE } from "./global.h.js";
import { DIED, EYE, HEAD, KILLED_BY, MM_ANGRY, MM_NOMSG } from "./hack.h.js";
import { BZ_M_SPELL, BZ_OFS_AD, BZ_VALID_ADTYP, Your1, max, plur } from "./hack.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import {
    MCAST_AGGRAVATION, MCAST_BLIND_YOU, MCAST_CLONE_WIZ, MCAST_CONFUSE_YOU, MCAST_CURE_SELF,
    MCAST_CURSE_ITEMS, MCAST_DEATH_TOUCH, MCAST_DESTRY_ARMR, MCAST_DISAPPEAR, MCAST_FIRE_PILLAR,
    MCAST_GEYSER, MCAST_HASTE_SELF, MCAST_INSECTS, MCAST_LIGHTNING, MCAST_OPEN_WOUNDS,
    MCAST_PARALYZE, MCAST_PSI_BOLT, MCAST_STUN_YOU, MCAST_SUMMON_MONS, MCAST_WEAKEN_YOU,
    MCF_HOSTILE, MCF_INDIRECT, MCF_SIGHT,
} from "./mcastu.h.js";
import {
    AD_CLRC, AD_COLD, AD_ELEC, AD_FIRE, AD_MAGM, AD_SPEL, M_ATTK_HIT, M_ATTK_MISS,
} from "./monattk.h.js";
import { eyecount, is_demon, nonliving, perceives, type_is_pname } from "./mondata.h.macros.js";
import {
    MFAST, M_SEEN_COLD, M_SEEN_ELEC, M_SEEN_FIRE, M_SEEN_MAGR, M_SEEN_REFL,
} from "./monst.h.js";
import { is_obj_mappear, ismnum, m_seenres } from "./monst.h.macros.js";
import { STRANGE_OBJECT } from "./objects.h.js";
import { TIMEOUT } from "./prop.h.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { Upolyd, mhe } from "./you.h.macros.js";
import {
    Antimagic, Blind, Blinded, Cold_resistance, Confusion, Deaf, Detect_monsters, Displaced,
    Fire_resistance, Free_action, HConfusion, HStun, Half_physical_damage, Half_spell_damage,
    Hallucination, Invis, See_invisible, Shock_resistance, Stunned, Unaware,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { sprintf, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { struct } from "../rt/struct.js";
import { adjuhploss, losestr, minuhpmax, setuhpmax } from "./attrib.js";
import { is_waterwall } from "./dbridge.js";
import { gb, gi, gm, gn, gt, gy, iflags, svc, svk, svm, u } from "./decl.js";
import { canseemon, map_invisible, shieldeff, tp_sensemon } from "./display.js";
import { Mgender, Monnam, bogusmon, mon_nam, noit_Monnam, pmname } from "./do_name.js";
import { destroy_arm } from "./do_wear.js";
import { done } from "./end.js";
import { losehp, nomul } from "./hack.js";
import { eos, sgn, upstart } from "./hacklib.js";
import { makemon, mkclass, set_malign } from "./makemon.js";
import { mdamageu } from "./mhitu.js";
import { monster_census } from "./minion.js";
import { healmon } from "./mon.js";
import { cvt_adtyp_to_mseenres, monstseesu, monstunseesu } from "./mondata.js";
import { mons } from "./monst.js";
import { lined_up } from "./mthrowu.js";
import { ureflects } from "./muse.js";
import { an, makeplural, makesingular, the_unique_pm, vtense } from "./objnam.js";
import {
    Norep, You, You_feel, You_hear, Your, impossible, pline, pline_The, pline_mon, set_msg_xy,
    verbalize,
} from "./pline.js";
import { body_part, rehumanize } from "./polyself.js";
import { make_blinded, make_confused, make_stunned } from "./potion.js";
import { d, rn2, rnd } from "./rnd.js";
import { rndcurse } from "./sit.js";
import { enexto } from "./teleport.js";
import { burn_away_slime } from "./timeout.js";
import { burnarmor, ignite_items } from "./trap.js";
import { aggravate, clonewiz, has_aggravatables, nasty } from "./wizard.js";
import { mon_adjust_speed, mon_set_minvis } from "./worn.js";
import { buzz, destroy_items, flash_str, flashburn, mon_spell_hits_spot } from "./zap.js";
const __FILE__ = "mcastu.c";

// the records of mcast_data[] from mcastu.h, laid out like it
function mcast_data_records() {
    return [
{ flags: MCF_HOSTILE|MCF_SIGHT },
{ flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 1, flags: MCF_INDIRECT },
{ level: 2, flags: MCF_INDIRECT },
{ level: 2, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 3, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 4, flags: MCF_INDIRECT },
{ level: 4, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 6, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 6, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 8, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 8, flags: MCF_HOSTILE|MCF_INDIRECT|MCF_SIGHT },
{ level: 10, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 11, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 12, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 13, flags: MCF_HOSTILE|MCF_SIGHT },
{ level: 13, flags: MCF_INDIRECT|MCF_HOSTILE|MCF_SIGHT },
{ level: 15, flags: MCF_HOSTILE|MCF_INDIRECT|MCF_SIGHT },
{ level: 18, flags: MCF_HOSTILE|MCF_INDIRECT|MCF_SIGHT },
{ level: 20, flags: MCF_HOSTILE|MCF_SIGHT },
    ];
}
