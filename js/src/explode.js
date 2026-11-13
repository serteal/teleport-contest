/* NetHack 5.0	explode.c	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.122 $ */
/*      Copyright (C) 1990 by Ken Arromdee */
/* NetHack may be freely redistributed.  See license for details. */

/* Note: Arrays are column first, while the screen is row first */
const explosion = static_array("explosion", array_of(int, 3), 3, [
        [ S_expl_tl, S_expl_ml, S_expl_bl ],
        [ S_expl_tc, S_expl_mc, S_expl_bc ],
        [ S_expl_tr, S_expl_mr, S_expl_br ] ]);

/* what to do at [x+i][y+j] for i=-1,0,1 and j=-1,0,1 */

    const EXPL_NONE = 0;
    const EXPL_MON = 1;
    const EXPL_HERO = 2;
    const EXPL_SKIP = 4;

/* check if shield effects are needed for location affected by explosion */
function explosionmask(
    m,
    adtyp,
    olet) { /* int */ /* object class (only matters for AD_DISN) */
    let res = EXPL_NONE;

    if (m == gy.youmonst) {
        switch (adtyp) {
        case AD_PHYS:
            /* leave 'res' with EXPL_NONE */
            break;
        case AD_MAGM:
            if (Antimagic())
                res = EXPL_HERO;
            break;
        case AD_FIRE:
            if (Fire_resistance())
                res = EXPL_HERO;
            break;
        case AD_COLD:
            if (Cold_resistance())
                res = EXPL_HERO;
            break;
        case AD_DISN:
            if ((olet == WAND_CLASS)
                ? (nonliving(m.data) || is_demon(m.data))
                : Disint_resistance())
                res = EXPL_HERO;
            break;
        case AD_ELEC:
            if (Shock_resistance())
                res = EXPL_HERO;
            break;
        case AD_DRST:
            if (Poison_resistance())
                res = EXPL_HERO;
            break;
        case AD_ACID:
            if (Acid_resistance())
                res = EXPL_HERO;
            break;
        default:
            impossible(_("explosion type %d?"), adtyp);
            break;
        }
    } else {
        /* 'm' is a monster */
        switch (adtyp) {
        case AD_PHYS:
            break;
        case AD_MAGM:
            if (resists_magm(m))
                res = EXPL_MON;
            break;
        case AD_FIRE:
            if (resists_fire(m))
                res = EXPL_MON;
            break;
        case AD_COLD:
            if (resists_cold(m))
                res = EXPL_MON;
            break;
        case AD_DISN:
            if ((olet == WAND_CLASS)
                ? (nonliving(m.data) || is_demon(m.data)
                   || is_vampshifter(m))
                : !!resists_disint(m))
                res = EXPL_MON;
            break;
        case AD_ELEC:
            if (resists_elec(m))
                res = EXPL_MON;
            break;
        case AD_DRST:
            if (resists_poison(m))
                res = EXPL_MON;
            break;
        case AD_ACID:
            if (resists_acid(m))
                res = EXPL_MON;
            break;
        default:
            impossible(_("explosion type %d?"), adtyp);
            break;
        }
    }
    return res;
}

function engulfer_explosion_msg(adtyp, olet) { /* void */
    let adj = 0;

    if (digests(u.ustuck.data)) {
        switch (adtyp) {
        case AD_FIRE:
            adj = _("heartburn");
            break;
        case AD_COLD:
            adj = _("chilly");
            break;
        case AD_DISN:
            if (olet == WAND_CLASS)
                adj = _("irradiated by pure energy");
            else
                adj = _("perforated");
            break;
        case AD_ELEC:
            adj = _("shocked");
            break;
        case AD_DRST:
            adj = _("poisoned");
            break;
        case AD_ACID:
            adj = _("an upset stomach");
            break;
        default:
            adj = _("fried");
            break;
        }
        pline(_("%s gets %s!"), Monnam(u.ustuck), adj);
    } else {
        switch (adtyp) {
        case AD_FIRE:
            adj = _("toasted");
            break;
        case AD_COLD:
            adj = _("chilly");
            break;
        case AD_DISN:
            if (olet == WAND_CLASS)
                adj = _("overwhelmed by pure energy");
            else
                adj = _("perforated");
            break;
        case AD_ELEC:
            adj = _("shocked");
            break;
        case AD_DRST:
            adj = _("intoxicated");
            break;
        case AD_ACID:
            adj = _("burned");
            break;
        default:
            adj = _("fried");
            break;
        }
        pline(_("%s gets slightly %s!"), Monnam(u.ustuck), adj);
    }
}

/* Note: I had to choose one of three possible kinds of "type" when writing
 * this function: a wand type (like in zap.c), an adtyp, or an object type.
 * Wand types get complex because they must be converted to adtyps for
 * determining such things as fire resistance.  Adtyps get complex in that
 * they don't supply enough information--was it a player or a monster that
 * did it, and with a wand, spell, or breath weapon?  Object types share both
 * these disadvantages....
 *
 * Note: anything with a AT_BOOM AD_PHYS attack uses PHYS_EXPL_TYPE for type.
 *
 * Important note about Half_physical_damage:
 *      Unlike losehp(), explode() makes the Half_physical_damage adjustments
 *      itself, so the caller should never have done that ahead of time.
 *      It has to be done this way because the damage value is applied to
 *      things beside the player. Care is taken within explode() to ensure
 *      that Half_physical_damage only affects the damage applied to the hero.
 */
export function explode(
    x, y,

    type,
    dam,
    olet,
    expltype) { /* void */ /* explosion type: controls color of explosion glyphs */
    const $frame = stack_frame(); try {
    let i, j, k, damu = dam;
    let starting = 1;
    let visible, any_shield;
    let uhurt = 0; /* 0=unhurt, 1=items damaged, 2=you and items damaged */
    let str = 0;
    let mtmp, mdef = null;
    let adtyp;
    let explmask = stack_array(array_of(int, 3), 3); /* 0=normal explosion, 1=do shieldeff, 2=do nothing */
    let xx, yy;
    let shopdamage = stack_var(boolean, FALSE), generic = FALSE,
            do_hallu = FALSE, inside_engulfer, grabbed, grabbing;
    let grabxy = stack_struct(struct_nhcoord);
    let hallu_buf = stack_array(char, BUFSZ), killr_buf = stack_array(char, BUFSZ);
    let exploding_wand_typ = 0;
    let you_exploding = +(olet == MON_EXPLODE && type >= 0);
    let didmsg = FALSE;

    if (olet == WAND_CLASS) { /* retributive strike */
        /* 'type' is passed as (wand's object type * -1); save
           object type and convert 'type' itself to zap-type */
        if (type < 0) {
            type = -type;
            exploding_wand_typ = short(type);
            /* most attack wands produce specific explosions;
               other types produce a generic magical explosion */
            if (objects[type].oc_dir == RAY
                && type != WAN_DIGGING && type != WAN_SLEEP) {
                type -= WAN_MAGIC_MISSILE;
                if (type < 0 || type > 9) {
                    impossible(_("explode: wand has bad zap type (%d)."), type);
                    type = 0;
                }
            } else
                type = 0;
        }
        switch (Role_switch()) {
        case PM_CLERIC:
        case PM_MONK:
        case PM_WIZARD:
            damu = Math.trunc(damu / 5);
            break;
        case PM_HEALER:
        case PM_KNIGHT:
            damu = Math.trunc(damu / 2);
            break;
        default:
            break;
        }
    } else if (olet == BURNING_OIL) {
        /* used to provide extra information to zap_over_floor() */
        exploding_wand_typ = POT_OIL;
    } else if (olet == SCROLL_CLASS) {
        /* ditto */
        exploding_wand_typ = SCR_FIRE;
    } else if (olet == TRAP_EXPLODE) {
        type = 0; /* hardcoded to generic magic explosion */
    }
    /* muse_unslime: SCR_FIRE */
    if (expltype < 0) {
        /* hero gets credit/blame for killing this monster, not others */
        mdef = m_at(x, y);
        expltype = -expltype;
    }
    /* if hero is engulfed and caused the explosion, only hero and
       engulfer will be affected */
    inside_engulfer = (u.uswallow && type >= 0 ? 1 : 0);
    /* held but not engulfed implies holder is reaching into second spot
       so might get hit by double damage */
    grabbed = grabbing = FALSE;
    if (u.ustuck && !u.uswallow) {
        if (Upolyd() && sticks(gy.youmonst.data))
            grabbing = TRUE;
        else
            grabbed = TRUE;
        grabxy.x = u.ustuck.mx;
        grabxy.y = u.ustuck.my;
    } else
        grabxy.x = grabxy.y = 0; /* lint suppression */
    /* FIXME:
     *  It is possible for a grabber to be outside the explosion
     *  radius and reaching inside to hold the hero.  If so, it ought
     *  to take damage (the extra half of double damage).  It is also
     *  possible for poly'd hero to be outside the radius and reaching
     *  in to hold a monster.  Hero should take damage in that situation.
     *
     *  Probably the simplest way to handle this would be to expand
     *  the radius used when collecting targets but exclude everything
     *  beyond the regular radius which isn't reaching inside.  Then
     *  skip harm to gear of any extended targets when inflicting damage.
     */

    if (olet == MON_EXPLODE && !you_exploding) {
        /* when explode() is called recursively, svk.killer.name might change
           so retain a copy of the current value for this explosion */
        str = strcpy(killr_buf, svk.killer.name);
        do_hallu = (Hallucination()
                    && (strstri(str, _("'s explosion"))
                        || strstri(str, _("s' explosion"))) ? 1 : 0);
    }
    if (type == PHYS_EXPL_TYPE) {
        /* currently only gas spores */
        adtyp = AD_PHYS;
    } else {
        /* If str is e.g. "flaming sphere's explosion" from above, we want to
         * still assign adtyp appropriately, but not replace str. */
        let adstr = 0;

        switch (abs(type) % 10) {
        case 0:
            adstr = _("magical blast");
            adtyp = AD_MAGM;
            break;
        case 1:
            adstr = (olet == BURNING_OIL) ? _("burning oil")
                     : (olet == SCROLL_CLASS) ? _("tower of flame") : _("fireball");
            /* fire damage, not physical damage */
            adtyp = AD_FIRE;
            break;
        case 2:
            adstr = _("ball of cold");
            adtyp = AD_COLD;
            break;
        case 4:
            adstr = (olet == WAND_CLASS) ? _("death field")
                                         : _("disintegration field");
            adtyp = AD_DISN;
            break;
        case 5:
            adstr = _("ball of lightning");
            adtyp = AD_ELEC;
            break;
        case 6:
            adstr = _("poison gas cloud");
            adtyp = AD_DRST;
            break;
        case 7:
            adstr = _("splash of acid");
            adtyp = AD_ACID;
            break;
        default:
            impossible(_("explosion base type %d?"), type);
            return;
        }
        if (!str)
            str = adstr;
    }

    any_shield = visible = FALSE;
    for (i = 0; i < 3; i++)
        for (j = 0; j < 3; j++) {
            xx = x + i - 1;
            yy = y + j - 1;
            if (!isok(xx, yy)) {
                explmask[i][j] = EXPL_SKIP;
                continue;
            }
            explmask[i][j] = EXPL_NONE;

            if (u_at(xx, yy)) {
                explmask[i][j] = explosionmask(gy.youmonst, adtyp, olet);
            }
            /* can be both you and mtmp if you're swallowed or riding */
            mtmp = m_at(xx, yy);
            if (!mtmp && u_at(xx, yy))
                mtmp = u.usteed;
            if (mtmp && DEADMONSTER(mtmp))
                mtmp = null;
            if (mtmp) {
                explmask[i][j] |= explosionmask(mtmp, adtyp, olet);
            }

            if (mtmp && cansee(xx, yy) && !canspotmon(mtmp))
                map_invisible(xx, yy);
            else if (!mtmp)
                unmap_invisible(xx, yy);
            if (cansee(xx, yy))
                visible = TRUE;
            if ((explmask[i][j] & (EXPL_MON | EXPL_HERO)) != 0)
                any_shield = TRUE;
        }

    if (visible) {
        /* Start the explosion */
        for (i = 0; i < 3; i++)
            for (j = 0; j < 3; j++) {
                if (explmask[i][j] == EXPL_SKIP)
                    continue;
                xx = x + i - 1;
                yy = y + j - 1;
                tmp_at(starting ? DISP_BEAM : DISP_CHANGE,
                       explosion_to_glyph(expltype, explosion[i][j]));
                tmp_at(xx, yy);
                starting = 0;
            }
        curs_on_u(); /* will flush screen and output */

        if (any_shield && flags.sparkle) { /* simulate shield effect */
            for (k = 0; k < SHIELD_COUNT; k++) {
                for (i = 0; i < 3; i++)
                    for (j = 0; j < 3; j++) {
                        xx = x + i - 1;
                        yy = y + j - 1;
                        if ((explmask[i][j] & (EXPL_MON | EXPL_HERO)) != 0)
                            /*
                             * Bypass tmp_at() and send the shield glyphs
                             * directly to the buffered screen.  tmp_at()
                             * will clean up the location for us later.
                             */
                            show_glyph(xx, yy,
                                       cmap_to_glyph(shield_static[k]));
                    }
                curs_on_u(); /* will flush screen and output */
                nh_delay_output()();
            }

            /* Cover last shield glyph with blast symbol. */
            for (i = 0; i < 3; i++)
                for (j = 0; j < 3; j++) {
                    xx = x + i - 1;
                    yy = y + j - 1;
                    if ((explmask[i][j] & (EXPL_MON | EXPL_HERO)) != 0)
                        show_glyph(xx, yy,
                                   explosion_to_glyph(expltype,
                                                      explosion[i][j]));
                }
        } else { /* delay a little bit. */
            nh_delay_output()();
            nh_delay_output()();
        }

        tmp_at(DISP_END, 0); /* clear the explosion */
    } else {
        if (olet == MON_EXPLODE || olet == TRAP_EXPLODE) {
            str = _("explosion");
            generic = TRUE;
        }
        if (!Deaf() && olet != SCROLL_CLASS) {
             ;
            You_hear(_("a blast."));
            didmsg = TRUE;
        }
    }

    if (!Deaf() && !didmsg)
        pline(_("Boom!"));

    /* apply effects to monsters and floor objects first, in case the
       damage to the hero is fatal and leaves bones */
    if (dam) {
        for (i = 0; i < 3; i++) {
            for (j = 0; j < 3; j++) {
                let itemdmg = 0;

                if (explmask[i][j] == EXPL_SKIP)
                    continue;
                xx = x + i - 1;
                yy = y + j - 1;
                if (u_at(xx, yy)) {
                    uhurt = ((explmask[i][j] & EXPL_HERO) != 0) ? 1 : 2;
                    /* If the player is attacking via polyself into something
                     * with an explosion attack, leave them (and their gear)
                     * unharmed, to avoid punishing them from using such
                     * polyforms creatively */
                    if (!svc.context.mon_moving && you_exploding)
                        uhurt = 0;
                } else if (inside_engulfer) {
                    /* for inside_engulfer, only <u.ux,u.uy> is affected */
                    continue;
                }

                /* Affect the floor unless the player caused the explosion
                 * from inside their engulfer. */
                if (!(u.uswallow && !svc.context.mon_moving))
                    zap_over_floor(xx, yy, type,
                                          addr_of(shopdamage), FALSE,
                                          exploding_wand_typ);

                mtmp = m_at(xx, yy);
                if (!mtmp && u_at(xx, yy))
                    mtmp = u.usteed;
                if (!mtmp)
                    continue;
                if (do_hallu) {
                    let tryct = 0;

                    /* replace "gas spore" with a different description
                       for each target (we can't distinguish personal names
                       like "Barney" here in order to suppress "the" below,
                       so avoid any which begins with a capital letter) */
                    do {
                        sprintf(hallu_buf, _("%s explosion"), s_suffix(rndmonnam(0)))
;
                    } while (chars[hallu_buf] != lowc(chars[hallu_buf]) && ++tryct < 20);
                    str = hallu_buf;
                }
                if (engulfing_u(mtmp)) {
                    engulfer_explosion_msg(adtyp, olet);
                } else if (cansee(xx, yy)) {
                    if (mtmp.m_ap_type)
                        seemimic(mtmp);
                    pline(_("%s is caught in the %s!"), Monnam(mtmp), str);
                }

                itemdmg = destroy_items(mtmp, adtyp, dam);
                if (adtyp == AD_FIRE) {
                    burnarmor(mtmp);
                    ignite_items(mtmp.minvent);
                }

                if ((explmask[i][j] & EXPL_MON) != 0) {
                    /* Damage from ring/wand explosion isn't itself
                     * electrical in nature, nor is damage from freezing
                     * potion really cold in nature, nor is damage from
                     * boiling potion or exploding oil; only burning items
                     * damage is the "same type" as the explosion.  Because
                     * this is imperfect and marginal (burning items only
                     * deal 1 damage), ignore it for golemeffects(). */
                    golemeffects(mtmp, adtyp, dam);
                    mtmp.mhp -= itemdmg; /* item destruction dmg */
                } else {
                    /* Call resist with 0 and do damage manually so 1) we can
                     * get out the message before doing the damage, and 2) we
                     * can call mondied, not killed, if it's not your blast.
                     */
                    let mdam = dam;

                    if (resist(mtmp, olet, 0, FALSE)) {
                        /* inside_engulfer: <xx,yy> == <u.ux,u.uy> */
                        if (cansee(xx, yy) || inside_engulfer)
                            pline(_("%s resists the %s!"), Monnam(mtmp), str);
                        mdam = Math.trunc((dam + 1) / 2);
                    }
                    /* if grabber is reaching into hero's spot and
                       hero's spot is within explosion radius, grabber
                       gets hit by double damage */
                    if (grabbed && mtmp == u.ustuck && next2u(x, y))
                        mdam *= 2;
                    /* being resistant to opposite type of damage makes
                       target more vulnerable to current type of damage
                       (when target is also resistant to current type,
                       we won't get here) */
                    if (resists_cold(mtmp) && adtyp == AD_FIRE)
                        mdam *= 2;
                    else if (resists_fire(mtmp) && adtyp == AD_COLD)
                        mdam *= 2;
                    mtmp.mhp -= mdam + itemdmg;
                }
                if (DEADMONSTER(mtmp)) {
                    let xkflg = ((adtyp == AD_FIRE
                                  && completelyburns(mtmp.data))
                                 ? XKILL_NOCORPSE : 0);

                    if (!svc.context.mon_moving) {
                        xkilled(mtmp, XKILL_GIVEMSG | xkflg);
                    } else if (mdef && mtmp == mdef) {
                        /* 'mdef' killed self trying to cure being turned
                         * into slime due to some action by the player.
                         * Hero gets the credit (experience) and most of
                         * the blame (possible loss of alignment and/or
                         * luck and/or telepathy depending on mtmp) but
                         * doesn't break pacifism.  xkilled()'s message
                         * would be "you killed <mdef>" so give our own.
                         */
                        if (cansee(mtmp.mx, mtmp.my) || canspotmon(mtmp))
                            pline(_("%s is %s!"), Monnam(mtmp),
                                  xkflg ? _("burned completely")
                                        : nonliving(mtmp.data) ? _("destroyed")
                                                                : _("killed"));
                        xkilled(mtmp, XKILL_NOMSG | XKILL_NOCONDUCT | xkflg);
                    } else {
                        if (xkflg)
                            adtyp = AD_RBRE; /* no corpse */
                        monkilled(mtmp, _(""), adtyp);
                    }
                } else if (!svc.context.mon_moving) {
                    /* all affected monsters, even if mdef is set */
                    setmangry(mtmp, TRUE);
                }
            }
        }
    }

    /* Do your injury last */
    if (uhurt) {
        /* give message for any monster-induced explosion
           or player-induced one other than scroll of fire */
        if (flags.verbose && (type < 0 || olet != SCROLL_CLASS)) {
            if (do_hallu) { /* (see explanation above) */
                do {
                    sprintf(hallu_buf, _("%s explosion"), s_suffix(rndmonnam(0)))
;
                } while (chars[hallu_buf] != lowc(chars[hallu_buf]));
                str = hallu_buf;
            }
            You(_("are caught in the %s!"), str);
            iflags.last_msg = PLNMSG_CAUGHT_IN_EXPLOSION;
        }
        /* do property damage first, in case we end up leaving bones */
        if (adtyp == AD_FIRE)
            burn_away_slime();
        if (Invulnerable()) {
            damu = 0;
            You(_("are unharmed!"));
        } else if (adtyp == AD_PHYS || adtyp == AD_ACID)
            damu = Maybe_Half_Phys(damu);
        if (adtyp == AD_FIRE) {
            burnarmor(gy.youmonst);
            ignite_items(gi.invent);
        }
        destroy_items(gy.youmonst, adtyp, dam);

        ugolemeffects(adtyp, damu);
        if (uhurt == 2) {
            /* if poly'd hero is grabbing another victim, hero takes
               double damage (note: don't rely on u.ustuck here because
               that victim might have been killed when hit by the blast) */
            if (grabbing && dist2(grabxy.x, grabxy.y, x, y) <= 2)
                damu *= 2;
            /* hero does not get same fire-resistant vs cold and
               cold-resistant vs fire double damage as monsters [why not?] */
            if (Upolyd())
                u.mh -= damu;
            else
                u.uhp -= damu;
            disp.botl = TRUE;
        }

        /* You resisted the damage, lets not keep that to ourselves */
        if (uhurt == 1)
            monstseesu_ad(adtyp);
        else
            monstunseesu_ad(adtyp);

        if (u.uhp <= 0 || (Upolyd() && u.mh <= 0)) {
            if (Upolyd()) {
                rehumanize();
            } else {
                if (olet == MON_EXPLODE) {
                    if (generic) /* explosion was unseen; str=="explosion", */
                        ; /* svk.killer.name=="gas spore's explosion". */
                    else if (str != svk.killer.name && str != hallu_buf)
                        strcpy(svk.killer.name, str);
                    svk.killer.format = KILLED_BY_AN;
                } else if (olet == TRAP_EXPLODE) {
                    svk.killer.format = NO_KILLER_PREFIX;
                    Snprintf(svk.killer.name, sizeof_member(svk.killer, "name"), _("caught %sself in a %s"), uhim(), str)

;
                } else if (type >= 0 && olet != SCROLL_CLASS) {
                    svk.killer.format = NO_KILLER_PREFIX;
                    Snprintf(svk.killer.name, sizeof_member(svk.killer, "name"), _("caught %sself in %s own %s"), uhim(), uhis(), str)

;
                } else {
                    svk.killer.format = (!strncmpi((str), _(("tower of flame")), -1)
                                     || !strncmpi((str), _(("fireball")), -1))
                                        ? KILLED_BY_AN
                                        : KILLED_BY;
                    strcpy(svk.killer.name, str);
                }
                if (iflags.last_msg == PLNMSG_CAUGHT_IN_EXPLOSION
                    || iflags.last_msg == PLNMSG_TOWER_OF_FLAME) /*seffects()*/
                    pline(_("It is fatal."));
                else
                    pline_The(_("%s is fatal."), str);
                /* Known BUG: BURNING suppresses corpse in bones data,
                   but done does not handle killer reason correctly */
                done((adtyp == AD_FIRE) ? BURNING : DIED);
            }
        }
        exercise(A_STR, FALSE);
    }

    if (shopdamage[0]) {
        pay_for_damage((adtyp == AD_FIRE) ? _("burn away")
                          : (adtyp == AD_COLD) ? _("shatter")
                             : (adtyp == AD_DISN) ? _("disintegrate")
                                : _("destroy"),
                       FALSE);
    }

    /* explosions are noisy */
    i = dam * dam;
    if (i < 50)
        i = 50; /* in case random damage is very small */
    if (inside_engulfer)
        i = Math.trunc((i + 3) / 4);
    wake_nearto(x, y, i);
    } finally { stack_pop($frame); }
}

const struct_scatter_chain = struct("struct_scatter_chain", {
    next: ptr_to("struct_scatter_chain"),
    obj: ptr_to("struct_obj"),
    ox: coordxy,
    oy: coordxy,
    dx: schar,
    dy: schar,
    range: int,
    stopped: boolean,
});

/*
 * scflags:
 *      VIS_EFFECTS     Add visual effects to display
 *      MAY_HITMON      Objects may hit monsters
 *      MAY_HITYOU      Objects may hit hero
 *      MAY_HIT         Objects may hit you or monsters
 *      MAY_DESTROY     Objects may be destroyed at random
 *      MAY_FRACTURE    Stone objects can be fractured (statues, boulders)
 */

/* returns number of scattered objects */
export function scatter(
    sx, sy,
    blastforce,
    scflags,
    obj) { /* long long */ /* only scatter this obj */
    let otmp;
    let tmp;
    let farthest = 0;
    let typ;
    let qtmp;
    let used_up;
    let individual_object = obj ? TRUE : FALSE;
    let shop_origin, lostgoods = FALSE;
    let mtmp, shkp = null;
    let stmp, stmp2 = null;
    let schain = null;
    let total = 0;

    if (individual_object && (obj.ox != sx || obj.oy != sy))
        impossible(_("scattered object <%d,%d> not at scatter site <%d,%d>"),
                   obj.ox, obj.oy, sx, sy);

    shop_origin = ((shkp = shop_keeper(chars[in_rooms(sx, sy, SHOPBASE)])) != null
                && costly_spot(sx, sy) ? 1 : 0);
    if (shop_origin)
        credit_report(shkp, 0, TRUE);   /* establish baseline, without msgs */

    while ((otmp = (individual_object ? obj
                                      : svl.level.objects[sx][sy])) != null) {
        if (otmp == uball || otmp == uchain) {
            let waschain = +(otmp == uchain);

             ;
            pline_The(_("chain shatters!"));
            unpunish();
            if (waschain)
                continue;
        }
        if (otmp.quan > 1) {
            qtmp = otmp.quan - 1;
            if (qtmp > LARGEST_INT)
                qtmp = LARGEST_INT;
            qtmp = rnd(int(qtmp));
            otmp = splitobj(otmp, qtmp);
        } else {
            obj = null; /* all used */
        }
        obj_extract_self(otmp);
        used_up = FALSE;

        /* 9 in 10 chance of fracturing boulders or statues */
        if ((scflags & MAY_FRACTURE) != 0
            && (otmp.otyp == BOULDER || otmp.otyp == STATUE)
            && rn2(10)) {
            if (otmp.otyp == BOULDER) {
                if (cansee(sx, sy)) {
                    pline(_("%s apart."), Tobjnam(otmp, _("break")));
                } else {
                     ;
                    You_hear(_("stone breaking."));
                }
                fracture_rock(otmp);
                place_object(otmp, sx, sy);
                if ((otmp = sobj_at(BOULDER, sx, sy)) != null) {
                    /* another boulder here, restack it to the top */
                    obj_extract_self(otmp);
                    place_object(otmp, sx, sy);
                }
            } else {
                let trap;

                if ((trap = t_at(sx, sy)) && trap.ttyp == STATUE_TRAP)
                    deltrap(trap);
                if (cansee(sx, sy)) {
                    pline(_("%s."), Tobjnam(otmp, _("crumble")));
                } else {
                     ;
                    You_hear(_("stone crumbling."));
                }
                break_statue(otmp);
                place_object(otmp, sx, sy); /* put fragments on floor */
            }
            newsym(sx, sy); /* in case it's beyond radius of 'farthest' */
            used_up = TRUE;

            /* 1 in 10 chance of destruction of obj; glass, egg destruction */
        } else if ((scflags & MAY_DESTROY) != 0
                   && (!rn2(10) || (objects[otmp.otyp].oc_material == GLASS
                                    || otmp.otyp == EGG))) {
            if (breaks(otmp, sx, sy))
                used_up = TRUE;
        }

        if (!used_up) {
            stmp = view_of(struct_scatter_chain, addr_of(alloc(sizeof(struct_scatter_chain))));
            stmp.next = null;
            stmp.obj = otmp;
            stmp.ox = sx;
            stmp.oy = sy;
            tmp = rn2(N_DIRS); /* get the direction */
            stmp.dx = chars[xdir + tmp];
            stmp.dy = chars[ydir + tmp];
            tmp = int(unsigned(unsigned(blastforce) - Math.trunc(otmp.owt / 40)));
            if (tmp < 1)
                tmp = 1;
            stmp.range = rnd(tmp); /* anywhere up to that determ. by wt */
            if (farthest < stmp.range)
                farthest = stmp.range;
            stmp.stopped = FALSE;
            if (!schain)
                schain = stmp;
            else
                stmp2.next = stmp;
            stmp2 = stmp;
        }
    }

    while (farthest-- > 0) {
        for (stmp = schain; stmp; stmp = stmp.next) {
            if ((stmp.range-- > 0) && (!stmp.stopped)) {
                gt.thrownobj = stmp.obj; /* mainly in case it kills hero */
                gb.bhitpos.x = stmp.ox + stmp.dx;
                gb.bhitpos.y = stmp.oy + stmp.dy;
                if (isok(gb.bhitpos.x, gb.bhitpos.y))
                    typ = uchar(levl()[gb.bhitpos.x][gb.bhitpos.y].typ);
                else
                    typ = STONE;
                if (!isok(gb.bhitpos.x, gb.bhitpos.y)) {
                    gb.bhitpos.x -= stmp.dx;
                    gb.bhitpos.y -= stmp.dy;
                    stmp.stopped = TRUE;
                } else if (!ZAP_POS(typ)
                           || closed_door(gb.bhitpos.x, gb.bhitpos.y)) {
                    gb.bhitpos.x -= stmp.dx;
                    gb.bhitpos.y -= stmp.dy;
                    stmp.stopped = TRUE;
                } else if ((mtmp = m_at(gb.bhitpos.x, gb.bhitpos.y)) != null) {
                    if (scflags & MAY_HITMON) {
                        stmp.range--;
                        if (ohitmon(mtmp, stmp.obj, 1, FALSE)) {
                            stmp.obj = null;
                            stmp.stopped = TRUE;
                        }
                    }
                } else if (u_at(gb.bhitpos.x, gb.bhitpos.y)) {
                    if (scflags & MAY_HITYOU) {
                        let dam, hitvalu, hitu;

                        if (gm.multi)
                            nomul(0);
                        dam = dmgval(stmp.obj, gy.youmonst);
                        hitvalu = 8 + stmp.obj.spe;
                        if (bigmonst(gy.youmonst.data))
                            hitvalu++;
                        hitu = thitu(hitvalu, Maybe_Half_Phys(dam),
                                     ref_of(stmp, "obj"), 0);
                        if (!stmp.obj)
                            stmp.stopped = TRUE;
                        if (hitu) {
                            stmp.range -= 3;
                            stop_occupation();
                        }
                    }
                } else {
                    if (scflags & VIS_EFFECTS) {
                        /* tmp_at(gb.bhitpos.x, gb.bhitpos.y); */
                        /* nh_delay_output(); */
                    }
                }
                stmp.ox = gb.bhitpos.x;
                stmp.oy = gb.bhitpos.y;
                if (IS_SINK(levl()[stmp.ox][stmp.oy].typ))
                    stmp.stopped = TRUE;
                gt.thrownobj = null;
            }
        }
    }
    for (stmp = schain; stmp; stmp = stmp2) {
        let x, y;
        let obj_left_shop = FALSE;

        stmp2 = stmp.next;
        x = stmp.ox;
        y = stmp.oy;
        if (stmp.obj) {
            if (x != sx || y != sy) {
                total += stmp.obj.quan;
                obj_left_shop = (shop_origin && !costly_spot(x, y) ? 1 : 0);
            }
            if (!flooreffects(stmp.obj, x, y, _("land"))) {
                if (obj_left_shop
                    && strchr(u.urooms, chars[in_rooms(u.ux, u.uy, SHOPBASE)])) {
                    /* At the moment this only takes on gold. While it is
                       simple enough to call addtobill for other items that
                       leave the shop due to scatter(), by default the hero
                       will get billed for the full shopkeeper asking-price
                       on the object's way out of shop. That can leave the
                       hero in a pickle. Even if the hero then manages to
                       retrieve the item and drop it back inside the shop,
                       the owed charges will only be reduced at that point
                       by the lesser shopkeeper buying-price.
                       The non-gold situation will likely get adjusted
                       further.
                     */
                    if (stmp.obj.otyp == GOLD_PIECE) {
                        addtobill(stmp.obj, FALSE, FALSE, TRUE);
                        lostgoods = TRUE;
                    }
                }
                place_object(stmp.obj, x, y);
                stackobj(stmp.obj);
            }
        }
        free(addr_of(stmp));
        newsym(x, y);
    }
    newsym(sx, sy);
    if (u_at(sx, sy) && u.uundetected && hides_under(gy.youmonst.data))
        hideunder(gy.youmonst);
    if (((mtmp = m_at(sx, sy)) != null) && mtmp.mtrapped)
        mtmp.mtrapped = 0;
    maybe_unhide_at(sx, sy);
    if (lostgoods) /* implies shop_origin and therefore shkp valid */
        credit_report(shkp, 1, FALSE);
    return total;
}

/*
 * Splatter burning oil from x,y to the surrounding area.
 *
 * This routine should really take a how and direction parameters.
 * The how is how it was caused, e.g. kicked verses thrown.  The
 * direction is which way to spread the flaming oil.  Different
 * "how"s would give different dispersal patterns.  For example,
 * kicking a burning flask will splatter differently from a thrown
 * flask hitting the ground.
 *
 * For now, just perform a "regular" explosion.
 */
export function splatter_burning_oil(x, y, diluted_oil) { /* void */
    let dmg = d(diluted_oil ? 3 : 4, 4);

/* ZT_SPELL(ZT_FIRE) = ZT_SPELL(AD_FIRE-1) = 10+(2-1) = 11 */

    explode(x, y, ZT_SPELL_O_FIRE, dmg, BURNING_OIL, EXPL_FIERY);
}
export const ZT_SPELL_O_FIRE = 11;

/* lit potion of oil is exploding; extinguish it as a light source before
   possibly killing the hero and attempting to save bones */
export function explode_oil(obj, x, y) { /* void */
    let diluted_oil = obj.oeroded;

    if (!obj.lamplit)
        impossible(_("exploding unlit oil"));
    end_burn(obj, TRUE);
    obj.how_lost = LOST_EXPLODING;
    splatter_burning_oil(x, y, diluted_oil);
}

/* Convert a damage type into an explosion display type. */
export function adtyp_to_expltype(adtyp) { /* int */
    switch(adtyp) {
    case AD_ELEC:
        /* Electricity isn't magical, but there currently isn't an electric
         * explosion type. Magical is the next best thing. */
    case AD_SPEL:
    case AD_DREN:
    case AD_ENCH:
        return EXPL_MAGICAL;
    case AD_FIRE:
        return EXPL_FIERY;
    case AD_COLD:
        return EXPL_FROSTY;
    case AD_DRST:
    case AD_DRDX:
    case AD_DRCO:
    case AD_DISE:
    case AD_PEST:
    case AD_PHYS: /* gas spore */
        return EXPL_NOXIOUS;
    default:
        impossible(_("adtyp_to_expltype: bad explosion type %d"), adtyp);
        return EXPL_FIERY;
    }
}

/* A monster explodes in a way that produces a real explosion (e.g. a sphere
 * or gas spore, not a yellow light or similar).
 * This is some common code between explmu() and explmm().
 */
export function mon_explodes(
    mon,
    mattk) { /* void */
    let dmg;
    let type;
    if (mattk.damn) {
        dmg = d(mattk.damn, mattk.damd);
    }
    else if (mattk.damd) {
        dmg = d(mon.data.mlevel + 1, mattk.damd);
    }
    else {
        dmg = 0;
    }

    if (mattk.adtyp == AD_PHYS) {
        type = PHYS_EXPL_TYPE;
    }
    else if (mattk.adtyp >= AD_MAGM && mattk.adtyp <= AD_SPC2) {
        /* The -1, +20, *-1 math is to set it up as a 'monster breath' type
         * for the explosions (it isn't, but this is the closest analogue). */
        /* FIXME: there are macros for kind of thing... */
        type = -((mattk.adtyp - 1) + 20);
    }
    else {
        impossible(_("unknown type for mon_explode %d"), mattk.adtyp);
        return;
    }

    /* Kill it now so it won't appear to be caught in its own explosion.
     * Must check to see if already dead - which happens if this is called
     * from an AT_BOOM attack upon death. */
    if (!DEADMONSTER(mon)) {
        mondead(mon);
    }

    /* This might end up killing you, too; you never know...
     * also, it is used in explode() messages */
    sprintf(svk.killer.name, _("%s explosion"), s_suffix(pmname(mon.data, Mgender(mon))))
;
    svk.killer.format = KILLED_BY_AN;

    explode(mon.mx, mon.my, type, dmg, MON_EXPLODE,
            adtyp_to_expltype(mattk.adtyp));

    /* reset killer */
    chars[svk.killer.name + 0] = ord('\0');
}

/*explode.c*/

import { A_STR } from "./attrib.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    SCROLL_CLASS, S_expl_bc, S_expl_bl, S_expl_br, S_expl_mc, S_expl_ml, S_expl_mr, S_expl_tc,
    S_expl_tl, S_expl_tr, WAND_CLASS,
} from "./defsym.h.js";
import {
    DISP_BEAM, DISP_CHANGE, DISP_END, EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, EXPL_NOXIOUS,
    SHIELD_COUNT,
} from "./display.h.js";
import { canspotmon, cmap_to_glyph, explosion_to_glyph } from "./display.h.macros.js";
import { PLNMSG_CAUGHT_IN_EXPLOSION, PLNMSG_TOWER_OF_FLAME } from "./flag.h.js";
import { BUFSZ, FALSE, LARGEST_INT, TRUE, boolean, coordxy } from "./global.h.js";
import {
    BURNING, DIED, KILLED_BY, KILLED_BY_AN, MAY_DESTROY, MAY_FRACTURE, MAY_HITMON, MAY_HITYOU,
    NO_KILLER_PREFIX, N_DIRS, PHYS_EXPL_TYPE, VIS_EFFECTS, XKILL_GIVEMSG, XKILL_NOCONDUCT,
    XKILL_NOCORPSE, XKILL_NOMSG,
} from "./hack.h.js";
import { Maybe_Half_Phys } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { SHOPBASE } from "./mkroom.h.js";
import {
    AD_ACID, AD_COLD, AD_DISE, AD_DISN, AD_DRCO, AD_DRDX, AD_DREN, AD_DRST, AD_ELEC, AD_ENCH,
    AD_FIRE, AD_MAGM, AD_PEST, AD_PHYS, AD_RBRE, AD_SPC2, AD_SPEL,
} from "./monattk.h.js";
import {
    bigmonst, completelyburns, digests, hides_under, is_demon, nonliving,
} from "./mondata.h.macros.js";
import {
    DEADMONSTER, engulfing_u, is_vampshifter, monstseesu_ad, monstunseesu_ad, resists_acid,
    resists_cold, resists_disint, resists_elec, resists_fire, resists_poison,
} from "./monst.h.macros.js";
import { PM_CLERIC, PM_HEALER, PM_KNIGHT, PM_MONK, PM_WIZARD } from "./monsters.h.js";
import { LOST_EXPLODING } from "./obj.h.js";
import { BURNING_OIL, GLASS, MON_EXPLODE, RAY, TRAP_EXPLODE } from "./objclass.h.js";
import {
    BOULDER, EGG, GOLD_PIECE, POT_OIL, SCR_FIRE, STATUE, WAN_DIGGING, WAN_MAGIC_MISSILE, WAN_SLEEP,
} from "./objects.h.js";
import { STONE } from "./rm.h.js";
import { IS_SINK, ZAP_POS, levl, m_at } from "./rm.h.macros.js";
import { STATUE_TRAP } from "./trap.h.js";
import { cansee } from "./vision.h.macros.js";
import { nh_delay_output } from "./winprocs.h.macros.js";
import { Role_switch, Upolyd, next2u, u_at, uhim, uhis } from "./you.h.macros.js";
import {
    Acid_resistance, Antimagic, Cold_resistance, Deaf, Disint_resistance, Fire_resistance,
    Hallucination, Invulnerable, Poison_resistance, Shock_resistance,
} from "./youprop.h.macros.js";
import { char, int, ord, schar, short, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { abs, free, sprintf, strchr, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_of, sizeof_member, struct, view_of } from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc } from "./alloc.js";
import { exercise } from "./attrib.js";
import { isok } from "./cmd.js";
import {
    disp, flags, gb, gi, gm, gt, gy, iflags, shield_static, svc, svk, svl, u, xdir, ydir,
} from "./decl.js";
import {
    curs_on_u, map_invisible, newsym, show_glyph, tmp_at, unmap_invisible,
} from "./display.js";
import { flooreffects } from "./do.js";
import { Mgender, Monnam, pmname, rndmonnam } from "./do_name.js";
import { breaks } from "./dothrow.js";
import { done } from "./end.js";
import { in_rooms, nomul } from "./hack.js";
import { dist2, lowc, s_suffix, strncmpi, strstri } from "./hacklib.js";
import { sobj_at, stackobj } from "./invent.js";
import { obj_extract_self, place_object, splitobj } from "./mkobj.js";
import {
    golemeffects, hideunder, maybe_unhide_at, mondead, monkilled, seemimic, setmangry, wake_nearto,
    xkilled,
} from "./mon.js";
import { resists_magm, sticks } from "./mondata.js";
import { closed_door } from "./monmove.js";
import { ohitmon, thitu } from "./mthrowu.js";
import { objects } from "./objects.js";
import { Tobjnam } from "./objnam.js";
import { You, You_hear, impossible, pline, pline_The } from "./pline.js";
import { rehumanize, ugolemeffects } from "./polyself.js";
import { unpunish } from "./read.js";
import { d, rn2, rnd } from "./rnd.js";
import { addtobill, costly_spot, credit_report, pay_for_damage, shop_keeper } from "./shk.js";
import { burn_away_slime, end_burn } from "./timeout.js";
import { burnarmor, deltrap, ignite_items, t_at } from "./trap.js";
import { dmgval } from "./weapon.js";
import { break_statue, destroy_items, fracture_rock, resist, zap_over_floor } from "./zap.js";
