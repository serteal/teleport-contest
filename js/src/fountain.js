/* NetHack 5.0	fountain.c	$NHDT-Date: 1699582923 2023/11/10 02:22:03 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.100 $ */
/*      Copyright Scott R. Turner, srt@ucla, 10/27/86 */
/* NetHack may be freely redistributed.  See license for details. */

/* Code for drinking from fountains. */

/* used when trying to dip in or drink from fountain or sink or pool while
   levitating above it, or when trying to move downwards in that state */
export function floating_above(what) { /* void */
    let umsg = _("are floating high above the %s.");

    if (u.utrap && (u.utraptype == TT_INFLOOR || u.utraptype == TT_LAVA)) {
        /* when stuck in floor (not possible at fountain or sink location,
           so must be attempting to move down), override the usual message */
        umsg = _("are trapped in the %s.");
        what = surface(u.ux, u.uy); /* probably redundant */
    }
    You(umsg, what);
}

/* Fountain of snakes! */
function dowatersnakes() { /* void */
    let num = rn1(5, 2);
    let mtmp;

    if (!(svm.mvitals[PM_WATER_MOCCASIN].mvflags & G_GONE)) {
        if (!Blind()) {
            pline(_("An endless stream of %s pours forth!"),
                  Hallucination() ? makeplural(rndmonnam(0)) : _("snakes"));
        } else {
             ;
            You_hear(_("%s hissing!"), something());
        }
        while (num-- > 0)
            if ((mtmp = makemon(mons[PM_WATER_MOCCASIN], u.ux, u.uy,
                                MM_NOMSG)) != null
                && t_at(mtmp.mx, mtmp.my))
                mintrap(mtmp, NO_TRAP_FLAGS);
    } else {
         ;
        pline_The(_("fountain bubbles furiously for a moment, then calms."));
    }
}

/* Water demon */
function dowaterdemon() { /* void */
    const $frame = stack_frame(); try {
    let mtmp = stack_var(ptr_to(struct_monst));

    if (!(svm.mvitals[PM_WATER_DEMON].mvflags & G_GONE)) {
        if ((mtmp[0] = makemon(mons[PM_WATER_DEMON], u.ux, u.uy,
                            MM_NOMSG)) != null) {
            if (!Blind())
                You(_("unleash %s!"), a_monnam(mtmp[0]));
            else
                You_feel(_("the presence of evil."));

            /* Give those on low levels a (slightly) better chance of survival
             */
            if (rnd(100) > (80 + level_difficulty())) {
                pline(_("Grateful for %s release, %s grants you a wish!"),
                      mhis(mtmp[0]), mhe(mtmp[0]));
                /* give a wish and discard the monster (mtmp set to null) */
                mongrantswish(mtmp);
            } else if (t_at(mtmp[0].mx, mtmp[0].my))
                mintrap(mtmp[0], NO_TRAP_FLAGS);
        }
    } else {
         ;
        pline_The(_("fountain bubbles furiously for a moment, then calms."));
    }
    } finally { stack_pop($frame); }
}

/* Water Nymph */
function dowaternymph() { /* void */
    let mtmp;

    if (!(svm.mvitals[PM_WATER_NYMPH].mvflags & G_GONE)
        && (mtmp = makemon(mons[PM_WATER_NYMPH], u.ux, u.uy,
                           MM_NOMSG)) != null) {
        if (!Blind())
            You(_("attract %s!"), a_monnam(mtmp));
        else
            You_hear(_("a seductive voice."));
        mtmp.msleeping = 0;
        if (t_at(mtmp.mx, mtmp.my))
            mintrap(mtmp, NO_TRAP_FLAGS);
    } else if (!Blind()) {
         ;
         ;
        pline(_("A large bubble rises to the surface and pops."));
    } else {
         ;
        You_hear(_("a loud pop."));
    }
}

/* Gushing forth along LOS from (u.ux, u.uy) */
export function dogushforth(drinking) { /* void */
    const $frame = stack_frame(); try {
    let madepool = stack_var(int, 0);

    do_clear_area(u.ux, u.uy, 7, gush, addr_of(madepool));
    if (!madepool[0]) {
        if (drinking)
            Your(_("thirst is quenched."));
        else
            pline(_("Water sprays all over you."));
    }
    } finally { stack_pop($frame); }
}

function gush(x, y, poolcnt) { /* void */
    let mtmp;
    let ttmp;

    if (((x + y) % 2) || u_at(x, y)
        || rn2(1 + distmin(u.ux, u.uy, x, y)) || (levl()[x][y].typ != ROOM)
        || sobj_at(BOULDER, x, y) || nexttodoor(x, y))
        return;

    if ((ttmp = t_at(x, y)) != null && !delfloortrap(ttmp))
        return;

    if (!((ref_to(int, poolcnt)[0])++))
        pline(_("Water gushes forth from the overflowing fountain!"));

    /* Put a pool at x, y */
    set_levltyp(x, y, POOL);
    levl()[x][y].flags = 0;
    /* No kelp! */
    del_engr_at(x, y);
    water_damage_chain(svl.level.objects[x][y], TRUE);

    if ((mtmp = m_at(x, y)) != null)
        minliquid(mtmp);
    else
        newsym(x, y);
}

/* Find a gem in the sparkling waters. */
function dofindgem() { /* void */
    if (!Blind())
        You(_("spot a gem in the sparkling waters!"));
    else
        You_feel(_("a gem here!"));
    mksobj_at(rnd_class(DILITHIUM_CRYSTAL, LUCKSTONE - 1), u.ux, u.uy,
                     FALSE, FALSE);
    levl()[u.ux][u.uy].flags |= F_LOOTED;
    newsym(u.ux, u.uy);
    exercise(A_WIS, TRUE); /* a discovery! */
}

function watchman_warn_fountain(mtmp) { /* boolean */
    if (is_watch(mtmp.data) && couldsee(mtmp.mx, mtmp.my)
        && mtmp.mpeaceful) {
        if (!Deaf()) {
            pline(_("%s yells:"), Amonnam(mtmp));
            verbalize(_("Hey, stop using that fountain!"));
        } else {
            pline(_("%s earnestly %s %s %s!"),
                  Amonnam(mtmp),
                  nolimbs(mtmp.data) ? _("shakes") : _("waves"),
                  mhis(mtmp),
                  nolimbs(mtmp.data)
                  ? mbodypart(mtmp, HEAD)
                  : makeplural(mbodypart(mtmp, ARM)));
        }
        return TRUE;
    }
    return FALSE;
}

export function dryup(x, y, isyou) { /* void */
    if (IS_FOUNTAIN(levl()[x][y].typ)
        && (!rn2(3) || FOUNTAIN_IS_WARNED(x, y))) {
        if (isyou && in_town(x, y) && !FOUNTAIN_IS_WARNED(x, y)) {
            let mtmp;

            levl()[x][y].flags |= F_WARNED;
            /* Warn about future fountain use. */
            mtmp = get_iter_mons(watchman_warn_fountain);
            /* You can see or hear this effect */
            if (!mtmp)
                pline_The(_("flow reduces to a trickle."));
            return;
        }
        if (isyou && wizard()) {
            if (y_n(_("Dry up fountain?")) == ord('n'))
                return;
        }
        /* FIXME: sight-blocking clouds should use block_point() when
           being created and unblock_point() when going away, then this
           glyph hackery wouldn't be necessary */
        if (cansee(x, y)) {
            let glyph = glyph_at(x, y);

            if (!glyph_is_cmap(glyph) || glyph_to_cmap(glyph) != S_cloud)
                pline_The(_("fountain dries up!"));
        }
        /* replace the fountain with ordinary floor */
        set_levltyp(x, y, ROOM); /* updates level.flags.nfountains */
        levl()[x][y].flags = 0;
        levl()[x][y].horizontal = 0;
        /* The location is seen if the hero/monster is invisible
           or felt if the hero is blind. */
        newsym(x, y);
        if (isyou && in_town(x, y))
            angry_guards(FALSE);
    }
}

/* quaff from a fountain when standing on its location */
export function drinkfountain() { /* void */
    /* What happens when you drink from a fountain? */
    let mgkftn = +(levl()[u.ux][u.uy].horizontal == 1);
    let fate = rnd(30);

    if (Levitation()) {
        floating_above(_("fountain"));
        return;
    }

    if (mgkftn && u.uluck >= 0 && fate >= 10) {
        let i, ii, littleluck = +(u.uluck < 4);

        pline(_("Wow!  This makes you feel great!"));
        /* blessed restore ability */
        for (ii = 0; ii < A_MAX; ii++)
            if (ABASE(ii) < AMAX(ii)) {
                (chars[u.acurr.a + ii]) = AMAX(ii);
                disp.botl = TRUE;
            }
        /* gain ability, blessed if "natural" luck is high */
        i = rn2(A_MAX); /* start at a random attribute */
        for (ii = 0; ii < A_MAX; ii++) {
            if (adjattrib(i, 1, littleluck ? -1 : 0) && littleluck)
                break;
            if (++i >= A_MAX)
                i = 0;
        }
        display_nhwindow()(WIN_MESSAGE, FALSE);
        pline(_("A wisp of vapor escapes the fountain..."));
        exercise(A_WIS, TRUE);
        levl()[u.ux][u.uy].horizontal = 0;
        return;
    }

    if (fate < 10) {
        pline_The(_("cool draught refreshes you."));
        u.uhunger += rnd(10); /* don't choke on water */
        newuhs(FALSE);
        if (mgkftn)
            return;
    } else {
        switch (fate) {
        case 19: /* Self-knowledge */
            You_feel(_("self-knowledgeable..."));
            display_nhwindow()(WIN_MESSAGE, FALSE);
            enlightenment(MAGICENLIGHTENMENT, ENL_GAMEINPROGRESS);
            exercise(A_WIS, TRUE);
            pline_The(_("feeling subsides."));
            break;
        case 20: /* Foul water */
            pline_The(_("water is foul!  You gag and vomit."));
            morehungry(rn1(20, 11));
            vomit();
            break;
        case 21: /* Poisonous */
            pline_The(_("water is contaminated!"));
            if (Poison_resistance()) {
                pline(_("Perhaps it is runoff from the nearby %s farm."),
                      fruitname(FALSE));
                losehp(rnd(4), _("unrefrigerated sip of juice"), KILLED_BY_AN);
                break;
            }
            poison_strdmg(rn1(4, 3), rnd(10), _("contaminated water"),
                          KILLED_BY);
            exercise(A_CON, FALSE);
            break;
        case 22: /* Fountain of snakes! */
            dowatersnakes();
            break;
        case 23: /* Water demon */
            dowaterdemon();
            break;
        case 24: { /* Maybe curse some items */
            let obj, nextobj;
            let buc_changed = 0;

            pline(_("This water's no good!"));
            morehungry(rn1(20, 11));
            exercise(A_CON, FALSE);
            /* this is more severe than rndcurse() */
            for (obj = gi.invent; obj; obj = nextobj) {
                nextobj = obj.nobj;
                if (obj.oclass != COIN_CLASS && !obj.cursed && !rn2(5)) {
                    curse(obj);
                    ++buc_changed;
                }
            }
            if (buc_changed)
                update_inventory();
            break;
        }
        case 25: /* See invisible */
            if (Blind()) {
                if (Invisible()) {
                    You(_("feel transparent."));
                } else {
                    You(_("feel very self-conscious."));
                    pline(_("Then it passes."));
                }
            } else {
                You_see(_("an image of someone stalking you."));
                pline(_("But it disappears."));
            }
            u.uprops[SEE_INVIS].intrinsic = or64(u.uprops[SEE_INVIS].intrinsic, FROMOUTSIDE);
            newsym(u.ux, u.uy);
            exercise(A_WIS, TRUE);
            break;
        case 26: /* See Monsters */
            if (monster_detect(null, 0))
                pline_The(_("%s tastes like nothing."), hliquid(_("water")));
            exercise(A_WIS, TRUE);
            break;
        case 27: /* Find a gem in the sparkling waters. */
            if (!FOUNTAIN_IS_LOOTED(u.ux, u.uy)) {
                dofindgem();
                break;
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/
        case 28: /* Water Nymph */
            dowaternymph();
            break;
        case 29: /* Scare */
        {
            let mtmp;

            pline(_("This %s gives you bad breath!"),
                  hliquid(_("water")));
            for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
                if (DEADMONSTER(mtmp))
                    continue;
                monflee(mtmp, 0, FALSE, FALSE);
            }
            break;
        }
        case 30: /* Gushing forth in this room */
            dogushforth(TRUE);
            break;
        default:
            pline(_("This tepid %s is tasteless."),
                  hliquid(_("water")));
            break;
        }
    }
    dryup(u.ux, u.uy, TRUE);
}

/* dip an object into a fountain when standing on its location */
export function dipfountain(obj) { /* void */
    let er = ER_NOTHING;
    let is_hands = +(obj == hands_obj);

    if (Levitation()) {
        floating_above(_("fountain"));
        return;
    }

    if (obj.otyp == LONG_SWORD && u.ulevel >= 5
        && !rn2(Role_if(PM_KNIGHT) ? 6 : 30)
        /* once upon a time it was possible to poly N daggers into N swords */
        && obj.quan == 1 && !obj.oartifact
        && !exist_artifact(LONG_SWORD, artiname(ART_EXCALIBUR))) {
        let lady = init_string(static_array("dipfountain.lady", char, sizeof_string("Lady of the Lake")), _("Lady of the Lake"), true);

        if (u.ualign.type != A_LAWFUL) {
            /* Ha!  Trying to cheat her. */
            pline(_("A freezing mist rises from the %s" +
                  " and envelopes the sword."),
                  hliquid(_("water")));
            pline_The(_("fountain disappears!"));
            curse(obj);
            if (obj.spe > -6 && !rn2(3))
                obj.spe--;
            obj.oerodeproof = FALSE;
            exercise(A_WIS, FALSE);
            livelog_printf(LL_ARTIFACT,
                           _("was denied %s!  The %s has deemed %s unworthy"),
                           artiname(ART_EXCALIBUR), lady, uhim());
        } else {
            /* The lady of the lake acts! - Eric Backus */
            /* Be *REAL* nice */
            pline(
              _("From the murky depths, a hand reaches up to bless the sword."));
            pline(_("As the hand retreats, the fountain disappears!"));
            obj = oname(obj, artiname(ART_EXCALIBUR),
                        ONAME_VIA_DIP | ONAME_KNOW_ARTI);
            discover_artifact(ART_EXCALIBUR);
            bless(obj);
            obj.oeroded = obj.oeroded2 = 0;
            obj.oerodeproof = TRUE;
            exercise(A_WIS, TRUE);
            livelog_printf(LL_ARTIFACT, _("was given %s by the %s"),
                           artiname(ART_EXCALIBUR), lady);
        }
        update_inventory();
        set_levltyp(u.ux, u.uy, ROOM); /* updates level.flags.nfountains */
        levl()[u.ux][u.uy].flags = 0;
        newsym(u.ux, u.uy);
        if (in_town(u.ux, u.uy))
            angry_guards(FALSE);
        return;
    } else if (is_hands || obj == uarmg) {
        er = wash_hands();
    } else {
        er = water_damage(obj, 0, TRUE);
    }

    if (er == ER_DESTROYED || (er != ER_NOTHING && !rn2(2))) {
        return; /* no further effect */
    }

    switch (rnd(30)) {
    case 16: /* Curse the item */
        if (!is_hands && obj.oclass != COIN_CLASS && !obj.cursed) {
            curse(obj);
        }
        break;
    case 17:
    case 18:
    case 19:
    case 20: /* Uncurse the item */
        if (!is_hands && obj.cursed) {
            if (!Blind())
                pline_The(_("%s glows for a moment."), hliquid(_("water")));
            uncurse(obj);
        } else {
            pline(_("A feeling of loss comes over you."));
        }
        break;
    case 21: /* Water Demon */
        dowaterdemon();
        break;
    case 22: /* Water Nymph */
        dowaternymph();
        break;
    case 23: /* an Endless Stream of Snakes */
        dowatersnakes();
        break;
    case 24: /* Find a gem */
        if (!FOUNTAIN_IS_LOOTED(u.ux, u.uy)) {
            dofindgem();
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case 25: /* Water gushes forth */
        dogushforth(FALSE);
        break;
    case 26: /* Strange feeling */
        pline(_("A strange tingling runs up your %s."), body_part(ARM));
        break;
    case 27: /* Strange feeling */
        You_feel(_("a sudden chill."));
        break;
    case 28: /* Strange feeling */
        pline(_("An urge to take a bath overwhelms you."));
        {
            var money = money_cnt(gi.invent);
            var otmp, nextobj;

            if (money > 10) {
                /* Amount to lose.  Might get rounded up as fountains don't
                 * pay change... */
                money = Math.trunc(somegold(money) / 10);
                for (otmp = gi.invent; otmp && money > 0; otmp = nextobj) {
                    nextobj = otmp.nobj;
                    if (otmp.oclass == COIN_CLASS) {
                        let denomination = objects[otmp.otyp].oc_cost;
                        let coin_loss = Math.trunc((money + denomination - 1) / denomination);

                        coin_loss = min(coin_loss, otmp.quan);
                        otmp.quan -= coin_loss;
                        money -= coin_loss * denomination;
                        if (!otmp.quan)
                            delobj(otmp);
                    }
                }
                You(_("lost some of your gold in the fountain!"));
                levl()[u.ux][u.uy].flags &= ~F_LOOTED;
                exercise(A_WIS, FALSE);
            }
        }
        break;
    case 29: /* You see coins */
        /* We make fountains have more coins the closer you are to the
         * surface.  After all, there will have been more people going
         * by.  Just like a shopping mall!  Chris Woodbury  */

        if (FOUNTAIN_IS_LOOTED(u.ux, u.uy))
            break;
        levl()[u.ux][u.uy].flags |= F_LOOTED;
        mkgold((rnd((dunlevs_in_dungeon(u.uz) - dunlev(u.uz)
                                   + 1) * 2) + 5),
                      u.ux, u.uy);
        if (!Blind())
            pline(_("Far below you, you see coins glistening in the %s."),
                  hliquid(_("water")));
        exercise(A_WIS, TRUE);
        newsym(u.ux, u.uy);
        break;
    default:
        if (er == ER_NOTHING)
            pline1(nothing_seems_to_happen());
        break;
    }
    update_inventory();
    dryup(u.ux, u.uy, TRUE);
}

/* dipping '-' in fountain, pool, or sink */
export function wash_hands() { /* int */
    let hands = makeplural(body_part(HAND));
    let res = ER_NOTHING;
    let was_glib = +!!Glib();

    You(_("wash your %s%s in the %s."), uarmg ? _("gloved ") : _(""), hands,
        hliquid(_("water")));
    if (Glib()) {
        make_glib(0);
        Your(_("%s are no longer slippery."), fingers_or_gloves(TRUE));
    }
    if (uarmg)
        res = water_damage(uarmg, 0, TRUE);
    /* not what ER_GREASED is for, but the checks in dipfountain just
       compare the result to ER_DESTROYED and ER_NOTHING, so it works */
    if (was_glib && res == ER_NOTHING)
        res = ER_GREASED;
    return res;
}

/* convert a sink into a fountain */
export function breaksink(x, y) { /* void */
    if (cansee(x, y) || u_at(x, y))
        pline_The(_("pipes break!  Water spurts out!"));
    /* updates level.flags.nsinks and level.flags.nfountains */
    set_levltyp(x, y, FOUNTAIN);
    levl()[x][y].flags = 0;
    levl()[x][y].horizontal = 0;
    levl()[x][y].flags |= F_LOOTED;
    newsym(x, y);
}

/* quaff from a sink while standing on its location */
export function drinksink() { /* void */
    let otmp;
    let mtmp;

    if (Levitation()) {
        floating_above(_("sink"));
        return;
    }
    switch (rn2(20)) {
    case 0:
        You(_("take a sip of very cold %s."), hliquid(_("water")));
        break;
    case 1:
        You(_("take a sip of very warm %s."), hliquid(_("water")));
        break;
    case 2:
        You(_("take a sip of scalding hot %s."), hliquid(_("water")));
        if (Fire_resistance()) {
            pline(_("It seems quite tasty."));
            monstseesu(M_SEEN_FIRE);
        } else {
            losehp(rnd(6), _("sipping boiling water"), KILLED_BY);
            monstunseesu(M_SEEN_FIRE);
        }
        /* boiling water burns considered fire damage */
        break;
    case 3:
        if (svm.mvitals[PM_SEWER_RAT].mvflags & G_GONE)
            pline_The(_("sink seems quite dirty."));
        else {
            mtmp = makemon(mons[PM_SEWER_RAT], u.ux, u.uy, MM_NOMSG);
            if (mtmp)
                pline(_("Eek!  There's %s in the sink!"),
                      (Blind() || !canspotmon(mtmp)) ? _("something squirmy")
                                                   : a_monnam(mtmp));
        }
        break;
    case 4:
        for (;;) {
            otmp = mkobj(POTION_CLASS, FALSE);
            if (otmp.otyp != POT_WATER)
                break;
            /* reject water and try again */
            obfree(otmp, null);
        }
        otmp.cursed = otmp.blessed = 0;
        pline(_("Some %s liquid flows from the faucet."),
              Blind() ? _("odd") : hcolor(OBJ_DESCR(objects[otmp.otyp])));
        if(!(Blind() || Hallucination()))
            observe_object(otmp);
        otmp.quan++;       /* Avoid panic upon useup() */
        otmp.corpsenm = 1; /* kludge for docall() */
        dopotion(otmp);
        obfree(otmp, null);
        break;
    case 5:
        if (!(levl()[u.ux][u.uy].flags & S_LRING)) {
            You(_("find a ring in the sink!"));
            mkobj_at(RING_CLASS, u.ux, u.uy, TRUE);
            levl()[u.ux][u.uy].flags |= S_LRING;
            exercise(A_WIS, TRUE);
            newsym(u.ux, u.uy);
        } else
            pline(_("Some dirty %s backs up in the drain."), hliquid(_("water")));
        break;
    case 6:
        breaksink(u.ux, u.uy);
        break;
    case 7:
        pline_The(_("%s moves as though of its own will!"), hliquid(_("water")));
        if ((svm.mvitals[PM_WATER_ELEMENTAL].mvflags & G_GONE)
            || !makemon(mons[PM_WATER_ELEMENTAL], u.ux, u.uy, MM_NOMSG))
            pline(_("But it quiets down."));
        break;
    case 8:
        pline(_("Yuk, this %s tastes awful."), hliquid(_("water")));
        more_experienced(1, 0);
        newexplevel();
        break;
    case 9:
        pline(_("Gaggg... this tastes like sewage!  You vomit."));
        morehungry((rn2(30 - ACURR(A_CON)) + (11)));
        vomit();
        break;
    case 10:
        pline(_("This %s contains toxic wastes!"), hliquid(_("water")));
        if (!Unchanging()) {
            You(_("undergo a freakish metamorphosis!"));
            polyself(POLY_NOFLAGS);
        }
        break;
    /* more odd messages --JJB */
    case 11:
        ;
        You_hear(_("clanking from the pipes..."));
        break;
    case 12:
        ;
        You_hear(_("snatches of song from among the sewers..."));
        break;
    case 13:
        pline(_("Ew, what a stench!"));
        create_gas_cloud(u.ux, u.uy, 1, 4);
        break;
    case 19:
        if (Hallucination()) {
            pline(_("From the murky drain, a hand reaches up... --oops--"));
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        You(_("take a sip of %s %s."),
            rn2(3) ? (rn2(2) ? _("cold") : _("warm")) : _("hot"),
            hliquid(_("water")));
    }
}

/* for #dip(potion.c) when standing on a sink */
export function dipsink(obj) { /* void */
    let try_call = FALSE,
            not_looted_yet = +((levl()[u.ux][u.uy].flags & S_LRING) == 0),
            is_hands = (obj == hands_obj || (uarmg && obj == uarmg) ? 1 : 0);

    if (!rn2(not_looted_yet ? 25 : 15)) {
        /* can't rely on using sink for unlimited scroll blanking; however,
           since sink will be converted into a fountain, hero can dip again */
        breaksink(u.ux, u.uy); /* "The pipes break!  Water spurts out!" */
        if (Glib() && is_hands)
            Your(_("%s are still slippery."), fingers_or_gloves(TRUE));
        return;
    } else if (is_hands) {
        wash_hands();
        return;
    } else if (obj.oclass != POTION_CLASS) {
        You(_("hold %s under the tap."), the(xname(obj)));
        if (water_damage(obj, 0, TRUE) == ER_NOTHING)
            pline1(nothing_seems_to_happen());
        return;
    }

    /* at this point the object must be a potion */
    You(_("pour %s%s down the drain."), (obj.quan > 1 ? _("one of ") : _("")),
        the(xname(obj)));
    switch (obj.otyp) {
    case POT_POLYMORPH:
        polymorph_sink();
        try_call = TRUE;
        break;
    case POT_OIL:
        if (!Blind()) {
            pline(_("It leaves an oily film on the basin."));
            try_call = TRUE;
        } else {
            pline1(nothing_seems_to_happen());
        }
        break;
    case POT_ACID:
        /* acts like a drain cleaner product */
        try_call = TRUE;
        if (!Blind()) {
            pline_The(_("drain seems less clogged."));
        } else if (!Deaf()) {
            You_hear(_("a sucking sound."));
        } else {
            pline1(nothing_seems_to_happen());
            try_call = FALSE;
        }
        break;
    case POT_LEVITATION:
        sink_backs_up(u.ux, u.uy);
        try_call = TRUE;
        break;
    case POT_OBJECT_DETECTION:
        if (!(levl()[u.ux][u.uy].flags & S_LRING)) {
            You(_("sense a ring lost down the drain."));
            try_call = TRUE;
            break;
        }
        /* FALLTHROUGH */;
        /* FALLTHRU */
    case POT_GAIN_LEVEL:
    case POT_GAIN_ENERGY:
    case POT_MONSTER_DETECTION:
    case POT_FRUIT_JUICE:
    case POT_WATER:
        /* potions with no potionbreathe() effects, plus water.  if effects
           are added to potionbreathe these should go to that instead (except
           for water). */
        pline1(nothing_seems_to_happen());
        break;
    default:
        /* hero can feel the vapor on her skin, so no need to check Blind or
           breathless for this message */
        pline(_("A wisp of vapor rises up..."));
        /* NB: potionbreathe calls trycall or makeknown as appropriate */
        if (!breathless(gy.youmonst.data) || haseyes(gy.youmonst.data))
            potionbreathe(obj);
        break;
    }
    if (try_call && obj.dknown)
        trycall(obj);
    useup(obj);
}

/* find a ring in a sink */
export function sink_backs_up(x, y) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);

    if (!Blind())
        strcpy(buf, _("Muddy waste pops up from the drain"));
    else if (!Deaf())
        strcpy(buf, _("You hear a sloshing sound")); /* Deaf-aware */
    else
        sprintf(buf, _("Something splashes you in the %s"), body_part(FACE));
    pline(_("%s%s."), !Deaf() ? _("Flupp!  ") : _(""), buf);

    if (!(levl()[x][y].flags & S_LRING)) { /* once per sink */
        if (!Blind())
            You_see(_("a ring shining in its midst."));
        mkobj_at(RING_CLASS, x, y, TRUE);
        newsym(x, y);
        exercise(A_DEX, TRUE);
        exercise(A_WIS, TRUE); /* a discovery! */
        levl()[x][y].flags |= S_LRING;
    }
    } finally { stack_pop($frame); }
}

/*fountain.c*/

import { A_LAWFUL } from "./align.h.js";
import { ART_EXCALIBUR } from "./artilist.h.js";
import { A_CON, A_DEX, A_MAX, A_WIS } from "./attrib.h.js";
import { ABASE, ACURR, AMAX } from "./attrib.h.macros.js";
import { nothing_seems_to_happen, something } from "./decl.h.macros.js";
import { COIN_CLASS, POTION_CLASS, RING_CLASS, S_cloud } from "./defsym.h.js";
import { canspotmon, glyph_is_cmap } from "./display.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_ARTIFACT, TRUE } from "./global.h.js";
import {
    ARM, ENL_GAMEINPROGRESS, FACE, HAND, HEAD, KILLED_BY, KILLED_BY_AN, MAGICENLIGHTENMENT,
    MM_NOMSG, NO_TRAP_FLAGS, ONAME_KNOW_ARTI, ONAME_VIA_DIP, POLY_NOFLAGS,
} from "./hack.h.js";
import { min, pline1, rn1, y_n } from "./hack.h.macros.js";
import { breathless, haseyes, is_watch, nolimbs } from "./mondata.h.macros.js";
import { G_GONE } from "./monflag.h.js";
import { M_SEEN_FIRE, struct_monst } from "./monst.h.js";
import { DEADMONSTER } from "./monst.h.macros.js";
import {
    PM_KNIGHT, PM_SEWER_RAT, PM_WATER_DEMON, PM_WATER_ELEMENTAL, PM_WATER_MOCCASIN, PM_WATER_NYMPH,
} from "./monsters.h.js";
import { ER_DESTROYED, ER_GREASED, ER_NOTHING } from "./obj.h.js";
import { OBJ_DESCR } from "./objclass.h.macros.js";
import {
    BOULDER, DILITHIUM_CRYSTAL, LONG_SWORD, LUCKSTONE, POT_ACID, POT_FRUIT_JUICE, POT_GAIN_ENERGY,
    POT_GAIN_LEVEL, POT_LEVITATION, POT_MONSTER_DETECTION, POT_OBJECT_DETECTION, POT_OIL,
    POT_POLYMORPH, POT_WATER,
} from "./objects.h.js";
import { FROMOUTSIDE, SEE_INVIS } from "./prop.h.js";
import { FOUNTAIN, F_LOOTED, F_WARNED, POOL, ROOM, S_LRING } from "./rm.h.js";
import {
    FOUNTAIN_IS_LOOTED, FOUNTAIN_IS_WARNED, IS_FOUNTAIN, fmon, levl, m_at,
} from "./rm.h.macros.js";
import { cansee, couldsee } from "./vision.h.macros.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import { TT_INFLOOR, TT_LAVA } from "./you.h.js";
import { Role_if, mhe, mhis, u_at, uhim } from "./you.h.macros.js";
import {
    Blind, Deaf, Fire_resistance, Glib, Hallucination, Invisible, Levitation, Poison_resistance,
    Unchanging,
} from "./youprop.h.macros.js";
import { char, int, ord, sizeof_string } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import { sprintf, strcpy } from "../rt/libc.js";
import { init_string, stack_array, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, ref_to } from "../rt/struct.js";
import { artiname, discover_artifact, exist_artifact } from "./artifact.js";
import { adjattrib, exercise, poison_strdmg } from "./attrib.js";
import { disp, gi, gy, hands_obj, svl, svm, u } from "./decl.js";
import { monster_detect } from "./detect.js";
import { glyph_at, newsym } from "./display.js";
import { polymorph_sink, trycall } from "./do.js";
import { Amonnam, a_monnam, hcolor, hliquid, oname, rndmonnam } from "./do_name.js";
import { fingers_or_gloves } from "./do_wear.js";
import { dunlev, dunlevs_in_dungeon, level_difficulty, surface } from "./dungeon.js";
import { morehungry, newuhs, vomit } from "./eat.js";
import { del_engr_at } from "./engrave.js";
import { more_experienced, newexplevel } from "./exper.js";
import { glyph_to_cmap } from "./glyphs.js";
import { in_town, losehp, money_cnt } from "./hack.js";
import { distmin } from "./hacklib.js";
import { enlightenment } from "./insight.js";
import { delobj, sobj_at, update_inventory, useup } from "./invent.js";
import { makemon } from "./makemon.js";
import { set_levltyp } from "./mkmaze.js";
import { bless, curse, mkgold, mkobj, mkobj_at, mksobj_at, uncurse } from "./mkobj.js";
import { nexttodoor } from "./mkroom.js";
import { angry_guards, get_iter_mons, minliquid } from "./mon.js";
import { monstseesu, monstunseesu } from "./mondata.js";
import { monflee } from "./monmove.js";
import { mons } from "./monst.js";
import { observe_object } from "./o_init.js";
import { objects } from "./objects.js";
import { fruitname, makeplural, rnd_class, the, xname } from "./objnam.js";
import {
    You, You_feel, You_hear, You_see, Your, livelog_printf, pline, pline_The, verbalize,
} from "./pline.js";
import { body_part, mbodypart, polyself } from "./polyself.js";
import { dopotion, make_glib, mongrantswish, potionbreathe } from "./potion.js";
import { create_gas_cloud } from "./region.js";
import { rn2, rnd } from "./rnd.js";
import { obfree } from "./shk.js";
import { somegold } from "./steal.js";
import { delfloortrap, mintrap, t_at, water_damage, water_damage_chain } from "./trap.js";
import { do_clear_area } from "./vision.js";
