/* NetHack 5.0	priest.c	$NHDT-Date: 1764567778 2025/11/30 21:42:58 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.106 $ */
/* Copyright (c) Izchak Miller, Steve Linhart, 1989.              */
/* NetHack may be freely redistributed.  See license for details. */

/* these match the categorizations shown by enlightenment */
export const ALGN_SINNED = (-4);
export const ALGN_DEVOUT = 14;

export function newepri(mtmp) { /* void */
    if (!mtmp.mextra)
        mtmp.mextra = newmextra();
    if (!EPRI(mtmp)) {
        ((mtmp).mextra.epri) = view_of(struct_epri, addr_of(alloc(sizeof(struct_epri))));
        memset(addr_of(EPRI(mtmp)), 0, sizeof(struct_epri));
        EPRI(mtmp).parentmid = mtmp.m_id;
    }
}

export function free_epri(mtmp) { /* void */
    if (mtmp.mextra && EPRI(mtmp)) {
        free(addr_of(EPRI(mtmp)));
        ((mtmp).mextra.epri) = null;
    }
    mtmp.ispriest = 0;
}

/*
 * Move for priests and shopkeepers.  Called from shk_move() and pri_move().
 * Valid returns are  1: moved  0: didn't  -1: let m_move do it  -2: died.
 */
export function move_special(mtmp, in_his_shop, appr,
             uondoor, avoid,
             omx, omy, ggx, ggy) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var mfp = stack_struct(struct_mfndposdata);
    var nx, ny, nix, niy;
    var i;
    var chcnt, cnt;

    var ninfo = 0;
    var allowflags;

    if (omx == ggx && omy == ggy)
        return 0;
    if (mtmp.mconf) {
        avoid = FALSE;
        appr = 0;
    }

    nix = omx;
    niy = omy;
    allowflags = mon_allowflags(mtmp);
    cnt = mfndpos(mtmp, mfp, allowflags);

    $goto_pick_move: for (;;) { switch ($goto) { default: if (mtmp.isshk && avoid && uondoor) { /* perhaps we cannot avoid him */
        for (i = 0; i < cnt; i++)
            if (!(mfp.info[i] & NOTONL))
                { $goto = "pick_move"; continue $goto_pick_move; };
        avoid = FALSE;
    }

 case "pick_move": $goto = null;
    chcnt = 0;
    for (i = 0; i < cnt; i++) {
        nx = mfp.poss[i].x;
        ny = mfp.poss[i].y;
        if (IS_ROOM(levl()[nx][ny].typ)
            || (mtmp.isshk && (!in_his_shop || ESHK(mtmp).following))) {
            if (avoid && (mfp.info[i] & NOTONL) && !(mfp.info[i] & ALLOW_M))
                continue;
            if ((!appr && !rn2(++chcnt))
                || (appr && dist2(nx, ny, ggx, ggy) < dist2(nix, niy, ggx, ggy))
                || (mfp.info[i] & ALLOW_M)) {
                nix = nx;
                niy = ny;
                ninfo = mfp.info[i];
            }
        }
    }

    if (mtmp.ispriest && avoid && nix == omx && niy == omy
        && onlineu(omx, omy)) {
        /* might as well move closer as long it's going to stay
         * lined up */
        avoid = FALSE;
        { $goto = "pick_move"; continue $goto_pick_move; }
    } } break; }

    if (nix != omx || niy != omy) {
        if (ninfo & ALLOW_ROCK) {
            m_break_boulder(mtmp, nix, niy);
            return 1;
        } else if (ninfo & ALLOW_M) {
            /* mtmp is deciding it would like to attack this turn.
             * Returns from m_move_aggress don't correspond to the same things
             * as this function should return, so we need to translate. */
            switch (m_move_aggress(mtmp, nix, niy)) {
            case 2:
                return -2; /* died making the attack */
            case 3:
                return 1; /* attacked and spent this move */
            }
        }

        if (MON_AT(nix, niy) || u_at(nix, niy))
            return 0;
        remove_monster(omx, omy);
        place_monster(mtmp, nix, niy);
        newsym(nix, niy);
        if (mtmp.isshk && !in_his_shop && inhishop(mtmp))
            check_special_room(FALSE);

        return 1;
    }
    return 0;
    } finally { stack_pop($frame); }
}

export function temple_occupied(array) { /* char */
    let ptr;

    for (ptr = array; chars[ptr]; ptr++)
        if (elt(svr.rooms, chars[ptr] - ROOMOFFSET).rtype == TEMPLE)
            return chars[ptr];
    return ord('\0');
}

function histemple_at(priest, x, y) { /* boolean */
    return (priest && priest.ispriest
                      && (EPRI(priest).shroom == chars[in_rooms(x, y, TEMPLE)])
                      && on_level((EPRI(priest).shrlevel), u.uz) ? 1 : 0);
}

export function inhistemple(priest) { /* boolean */
    /* make sure we have a priest */
    if (!priest || !priest.ispriest)
        return FALSE;
    /* priest must be on right level and in right room */
    if (!histemple_at(priest, priest.mx, priest.my))
        return FALSE;
    /* temple room must still contain properly aligned altar */
    return has_shrine(priest);
}

/*
 * pri_move: return 1: moved  0: didn't  -1: let m_move do it  -2: died
 */
export function pri_move(priest) { /* int */
    let ggx, ggy, omx, omy;
    let temple;
    let avoid = TRUE;

    omx = priest.mx;
    omy = priest.my;

    if (!histemple_at(priest, omx, omy))
        return -1;

    temple = EPRI(priest).shroom;

    ggx = EPRI(priest).shrpos.x;
    ggy = EPRI(priest).shrpos.y;

    ggx += rn1(3, -1); /* mill around the altar */
    ggy += rn1(3, -1);

    if (!priest.mpeaceful
        || (Conflict() && !resist_conflict(priest))) {
        if (monnear(priest, u.ux, u.uy)) {
            if (Displaced())
                Your(_("displaced image doesn't fool %s!"), mon_nam(priest));
            mattacku(priest);
            return 0;
        } else if (strchr(u.urooms, temple)) {
            /* chase player if inside temple & can see him */
            if (priest.mcansee && m_canseeu(priest)) {
                ggx = u.ux;
                ggy = u.uy;
            }
            avoid = FALSE;
        }
    } else if (Invis())
        avoid = FALSE;

    return move_special(priest, FALSE, TRUE, FALSE, avoid, omx, omy, ggx, ggy);
}

/* exclusively for mktemple() */
export function priestini(
    lvl,
    sroom,
    sx, sy,
    sanctum) { /* void */ /* is it the seat of the high priest? */
    let priest;
    let otmp;
    let cnt;
    let px = 0, py = 0, i, si = rn2(N_DIRS);
    let prim = mons[sanctum ? PM_HIGH_CLERIC
                                          : PM_ALIGNED_CLERIC];

    for (i = 0; i < N_DIRS; i++) {
        px = sx + chars[xdir + DIR_CLAMP(i+si)];
        py = sy + chars[ydir + DIR_CLAMP(i+si)];
        if (pm_good_location(px, py, prim))
            break;
    }
    if (i == N_DIRS)
        px = sx, py = sy;

    if (MON_AT(px, py))
        rloc(m_at(px, py), RLOC_NOMSG); /* insurance */

    priest = makemon(prim, px, py, MM_EPRI);
    if (priest) {
        EPRI(priest).shroom = schar((ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET));
        EPRI(priest).shralign = Amask2align(levl()[sx][sy].flags);
        EPRI(priest).shrpos.x = sx;
        EPRI(priest).shrpos.y = sy;
        assign_level((EPRI(priest).shrlevel), lvl);
        mon_learns_traps(priest, ALL_TRAPS); /* traps are known */
        priest.mpeaceful = 1;
        priest.ispriest = 1;
        priest.isminion = 0;
        priest.msleeping = 0;
        set_malign(priest); /* mpeaceful may have changed */

        /* now his/her goodies... */
        if (sanctum && EPRI(priest).shralign == A_NONE
            && on_level(svd.dungeon_topology.d_sanctum_level, u.uz)) {
            mongets(priest, AMULET_OF_YENDOR);
        }
        /* 2 to 4 spellbooks */
        for (cnt = rn1(3, 2); cnt > 0; --cnt) {
            mpickobj(priest, mkobj(SPBOOK_no_NOVEL, FALSE));
        }
        /* robe [via makemon()] */
        if (rn2(2) && (otmp = which_armor(priest, W_ARMC)) != null) {
            if (p_coaligned(priest))
                uncurse(otmp);
            else
                curse(otmp);
        }
    }
}

/* get a monster's alignment type without caller needing EPRI & EMIN */
export function mon_aligntyp(mon) { /* aligntyp */
    let algn = mon.ispriest ? EPRI(mon).shralign
                                  : mon.isminion ? EMIN(mon).min_align
                                                  : mon.data.maligntyp;

    if (algn == A_NONE)
        return A_NONE; /* negative but differs from chaotic */
    return (algn > 0) ? A_LAWFUL : (algn < 0) ? A_CHAOTIC : A_NEUTRAL;
}

/*
 * Specially aligned monsters are named specially.
 *      - aligned priests with ispriest and high priests have shrines
 *              they retain ispriest and epri when polymorphed
 *      - aligned priests without ispriest are roamers
 *              they have isminion set and use emin rather than epri
 *      - minions do not have ispriest but have isminion and emin
 *      - caller needs to inhibit Hallucination if it wants to force
 *              the true name even when under that influence
 */
export function priestname(
    mon,
    article,
    reveal_high_priest,
    pname) { /* char * */ /* caller-supplied output buffer */
    const $frame = stack_frame(); try {
    let do_hallu = Hallucination(),
            aligned_priest = +(mon.data == mons[PM_ALIGNED_CLERIC]),
            high_priest = +(mon.data == mons[PM_HIGH_CLERIC]);
    let whatcode = stack_var(char, ord('\0'));
    let what = do_hallu ? rndmonnam(addr_of(whatcode)) : mon_pmname(mon);

    if (!mon.ispriest && !mon.isminion) /* should never happen...  */
        return strcpy(pname, what);       /* caller must be confused */

    /* for high priest(ess), "high" (or "grand" for poohbah) will be inserted
       [this was done near the end but we want 'what' to be updated sooner] */
    if (mon.ispriest || aligned_priest || high_priest)
        what = do_hallu ? _("poohbah") : mon.female ? _("priestess") : _("priest");

    chars[pname] = ord('\0');
    if (article != ARTICLE_NONE && (!do_hallu || !bogon_is_pname(whatcode[0]))) {
        if (article == ARTICLE_YOUR || (article == ARTICLE_A && high_priest))
            article = ARTICLE_THE;
        if (article == ARTICLE_THE) {
            strcpy(pname, _("the "));
        } else if (!strcmp(what, _("Angel"))) {
            /* bypass just_an(); it would yield "" due to treating capital A
               as indicating a personal name */
            strcpy(pname, _("an "));
        } else {
            just_an(pname, what);
        }
    }
    /* pname[] contains "" or {"a ","an ","the "} */
    if (mon.minvis) {
        /* avoid "a invisible priest" */
        if (!strcmp(pname, _("a ")))
            strcpy(pname, _("an "));
        strcat(pname, _("invisible "));
    }
    if (mon.isminion && EMIN(mon).renegade) {
        /* avoid "an renegade Angel" */
        if (!strcmp(pname, _("an ")) && !mon.minvis)
            strcpy(pname, _("a "));
        strcat(pname, _("renegade "));
    }

    if (mon.ispriest || aligned_priest) {
        if (high_priest)
            strcat(pname, do_hallu ? _("grand ") : _("high "));
    } else {
        if (mon.mtame && !strncmpi((what), _(("Angel")), -1))
            strcat(pname, _("guardian "));
    }

    strcat(pname, what);
    /* same as distant_monnam(), more or less... */
    if (do_hallu || !high_priest || reveal_high_priest
        || !Is_astralevel(u.uz)
        || m_next2u(mon) || program_state.gameover) {
        strcat(pname, _(" of "));
        strcat(pname, halu_gname(mon_aligntyp(mon)));
    }
    return pname;
    } finally { stack_pop($frame); }
}

export function p_coaligned(priest) { /* boolean */
    return (+(u.ualign.type == mon_aligntyp(priest)));
}

function has_shrine(pri) { /* boolean */
    let lev;
    let epri_p;

    if (!pri || !pri.ispriest)
        return FALSE;
    epri_p = EPRI(pri);
    lev = levl()[epri_p.shrpos.x][epri_p.shrpos.y];
    if (!IS_ALTAR(lev.typ) || !(lev.flags & AM_SHRINE))
        return FALSE;
    return (+(epri_p.shralign
                      == Amask2align(lev.flags & ~AM_SHRINE)));
}

export function findpriest(roomno) { /* struct monst * */
    let mtmp;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (mtmp.ispriest && (EPRI(mtmp).shroom == roomno)
            && histemple_at(mtmp, mtmp.mx, mtmp.my))
            return mtmp;
    }
    return null;
}

/* called from check_special_room() when the player enters the temple room */
export function intemple(roomno) { /* void */
    const $frame = stack_frame(); try {
    let priest, mtmp;
    let epri_p;
    let shrined, sanctum, can_speak;
    let this_time, other_time;
    let msg1, msg2;
    let buf = stack_array(char, BUFSZ);

    /* don't do anything if hero is already in the room */
    if (temple_occupied(u.urooms0))
        return;

    if ((priest = findpriest(char(roomno))) != null) {
        /* tended */
        record_achievement(ACH_TMPL);

        epri_p = EPRI(priest);
        shrined = has_shrine(priest);
        sanctum = (priest.data == mons[PM_HIGH_CLERIC]
                   && (Is_sanctum(u.uz) || In_endgame(u.uz)) ? 1 : 0);
        can_speak = +!helpless(priest);
        if (can_speak && !Deaf() && svm.moves >= epri_p.intone_time) {
            let save_priest = priest.ispriest;

            /* don't reveal the altar's owner upon temple entry in
               the endgame; for the Sanctum, the next message names
               Moloch so suppress the "of Moloch" for him here too */
            if (sanctum && !Hallucination())
                priest.ispriest = 0;
            pline(_("%s intones:"),
                  canseemon(priest) ? Monnam(priest) : _("A nearby voice"));
            priest.ispriest = save_priest;
            epri_p.intone_time = svm.moves + d(10, 500); /* ~2505 */
            /* make sure that we don't suppress entry message when
               we've just given its "priest intones" introduction */
            epri_p.enter_time = 0;
        }
        msg1 = msg2 = 0;
        if (sanctum && Is_sanctum(u.uz)) {
            if (priest.mpeaceful) {
                /* first time inside */
                msg1 = _("Infidel, you have entered Moloch's Sanctum!");
                msg2 = _("Be gone!");
                priest.mpeaceful = 0;
                /* became angry voluntarily; no penalty for attacking him */
                set_malign(priest);
            } else {
                /* repeat visit, or attacked priest before entering */
                msg1 = _("You desecrate this place by your presence!");
            }
        } else if (svm.moves >= epri_p.enter_time) {
            sprintf(buf, _("Pilgrim, you enter a %s place!"), !shrined ? _("desecrated") : _("sacred"))
;
            msg1 = buf;
        }
        if (msg1 && can_speak && !Deaf()) {
               ;
            verbalize1(msg1);
            if (msg2)
                verbalize1(msg2);
            epri_p.enter_time = svm.moves + d(10, 100); /* ~505 */
        }
        if (!sanctum) {
            if (!shrined || !p_coaligned(priest)
                || u.ualign.record <= ALGN_SINNED) {
                msg1 = _("have a%s forbidding feeling...");
                msg2 = (!shrined || !p_coaligned(priest)) ? _("") : _(" strange");
                this_time = ref_of(epri_p, "hostile_time");
                other_time = ref_of(epri_p, "peaceful_time");
            } else {
                msg1 = _("experience %s sense of peace.");
                msg2 = (u.ualign.record >= ALGN_DEVOUT) ? _("a") : _("an unusual");
                this_time = ref_of(epri_p, "peaceful_time");
                other_time = ref_of(epri_p, "hostile_time");
            }
            /* give message if we haven't seen it recently or
               if alignment update has caused it to switch from
               forbidding to sense-of-peace or vice versa */
            if (svm.moves >= this_time[0] || other_time[0] >= this_time[0]) {
                You(msg1, msg2);
                this_time[0] = svm.moves + d(10, 20); /* ~55 */
                /* avoid being tricked by the RNG:  switch might have just
                   happened and previous random threshold could be larger */
                if (this_time[0] <= other_time[0])
                    other_time[0] = this_time[0] - 1;
            }
        }
        /* recognize the Valley of the Dead and Moloch's Sanctum
           once hero has encountered the temple priest on those levels */
        mapseen_temple(priest);
    } else {
        /* untended */

        switch (rn2(4)) {
        case 0:
            You(_("have an eerie feeling..."));
            break;
        case 1:
            You_feel(_("like you are being watched."));
            break;
        case 2:
            pline(_("A shiver runs down your %s."), body_part(SPINE));
            break;
        default:
            break; /* no message; unfortunately there's no
                      EPRI(priest)->eerie_time available to
                      make sure we give one the first time */
        }
        if (!rn2(5)
            && (mtmp = makemon(mons[PM_GHOST], u.ux, u.uy, MM_NOMSG))
                   != null) {
            let ngen = svm.mvitals[PM_GHOST].born;
            if (canspotmon(mtmp))
                pline(_("A%s ghost appears next to you%c"),
                      ngen < 5 ? _("n enormous") : _(""),
                      ngen < 10 ? ord('!') : ord('.'));
            else
                You(_("sense a presence close by!"));
            mtmp.mpeaceful = 0;
            set_malign(mtmp);
            if (flags.verbose)
                You(_("are frightened to death, and unable to move."));
            nomul(-3);
            gm.multi_reason = _("being terrified of a ghost");
            gn.nomovemsg = _("You regain your composure.");
        }
    }
    } finally { stack_pop($frame); }
}

/* reset the move counters used to limit temple entry feedback;
   leaving the level and then returning yields a fresh start */
export function forget_temple_entry(priest) { /* void */
    let epri_p = priest.ispriest ? EPRI(priest) : null;

    if (!epri_p) {
        impossible(_("attempting to manipulate shrine data for non-priest?"));
        return;
    }
    epri_p.intone_time = epri_p.enter_time = epri_p.peaceful_time =
        epri_p.hostile_time = 0;
}

export function priest_talk(priest) { /* void */
    const $frame = stack_frame(); try {
    let coaligned = p_coaligned(priest);
    let strayed = +(u.ualign.record < 0);
    let cheapskate = null;
    if (EPRI(priest)) cheapskate = ref_of(EPRI(priest), "cheapskate_count");

    /*
     * Note: we won't be called if hero is Deaf [since dochat() will
     * return before calling domonnoise()], so we don't need to check
     * for that before the various calls to verbalize() here.
     */

    /* KMH, conduct */
    if (!u.uconduct.gnostic++)
        livelog_printf(LL_CONDUCT,
                       _("rejected atheism by consulting with %s"),
                       mon_nam(priest));

    if (priest.mflee || (!priest.ispriest && coaligned && strayed)) {
        pline(_("%s doesn't want anything to do with you!"), Monnam(priest));
        priest.mpeaceful = 0;
        return;
    }

    /* priests don't chat unless peaceful and in their own temple */
    if (!inhistemple(priest) || !priest.mpeaceful || helpless(priest)) {
        let cranky_msg = static_array("priest_talk.cranky_msg", ptr_to(char), 3, [
            _("Thou wouldst have words, eh?  I'll give thee a word or two!"),
            _("Talk?  Here is what I have to say!"),
            _("Pilgrim, I would speak no longer with thee.")
        ]);

        if (helpless(priest)) {
            pline(_("%s breaks out of %s reverie!"), Monnam(priest),
                  mhis(priest));
            priest.mfrozen = priest.msleeping = 0;
            priest.mcanmove = 1;
        }
        priest.mpeaceful = 0;
           ;
        verbalize(_("%s"), cranky_msg[rn2(3)]);
        return;
    }

    /* you desecrated the temple and now you want to chat? */
    if (priest.mpeaceful && chars[in_rooms(priest.mx, priest.my, TEMPLE)]
        && !has_shrine(priest)) {
           ;
        verbalize(
              _("Begone!  Thou desecratest this holy place with thy presence."));
        priest.mpeaceful = 0;
        return;
    }
    if (!money_cnt(gi.invent)) {
        if (coaligned && !strayed) {
            let pmoney = money_cnt(priest.minvent);
            if (pmoney > 0) {
                let bits;
                bits = Hallucination() ? currency(pmoney)
                                       : (pmoney == 1) ? _("bit") : _("bits");
                /* Note: two bits is actually 25 cents.  Hmm. */
                pline(_("%s gives you %s%s for an ale."), Monnam(priest),
                      (pmoney == 1) ? _("one ") : _("two "), bits);
                money2u(priest, pmoney > 1 ? 2 : 1);
            } else
                pline(_("%s preaches the virtues of poverty."), Monnam(priest));
            exercise(A_WIS, TRUE);
        } else
            pline(_("%s is not interested."), Monnam(priest));
        return;
    } else {
        /* there's now some randomization in how much you need to donate, but
           you are given suggested donation values that will guarantee
           clairvoyance and protection respectively; with more gold visible
           you need to donate more but get a greater effect; and if you
           cheapskate out to rerandomize the donation amounts they will be
           higher next time */
        let offer;
        let suggested = unsigned(Math.imul(unsigned((u.ulevelpeak ? u.ulevelpeak : 1 )), unsigned((unsigned(rn2(101)) + (unsigned(150 + unsigned(Math.imul((cheapskate ? cheapskate[0] : 0), 40))))))));

        let quan = Math.trunc(money_cnt(gi.invent) / (suggested * 3));
        let buf = stack_array(char, BUFSZ);

        if (quan < 1)
            quan = 1;

        sprintf(buf, _("How much will you offer (suggested: %lld or %lld)?"), suggested * quan, suggested * quan * 2)
;

        if (flags.debug)
            pline(_("%s asks you for a contribution for the temple (base %lld)."),
                  Monnam(priest), suggested);
        else
            pline(_("%s asks you for a contribution for the temple."),
                  Monnam(priest));
        if ((offer = bribe(priest, buf)) == 0) {
               ;
            verbalize(_("Thou shalt regret thine action!"));
            if (coaligned)
                adjalign(-1);
            if (cheapskate) ++cheapskate[0];
        } else if (offer < suggested * quan) {
            if (money_cnt(gi.invent) > (offer * 2)) {
                   ;
                verbalize(_("Cheapskate."));
                if (cheapskate) ++cheapskate[0];
            } else {
                   ;
                verbalize(_("I thank thee for thy contribution."));
                /* give player some token */
                exercise(A_WIS, TRUE);
            }
        } else if (offer < suggested * quan * 2) {
               ;
            verbalize(_("Thou art indeed a pious individual."));
            if (money_cnt(gi.invent) < (offer * 2)) {
                if (coaligned && u.ualign.record <= ALGN_SINNED)
                    adjalign(1);
            }
            verbalize(_("I bestow upon thee a blessing."));
            incr_itimeout(ref_of(u.uprops[CLAIRVOYANT], "intrinsic"), rn1(Math.trunc(500 * offer / suggested),
                                             Math.trunc(500 * offer / suggested)));
        } else if (offer < suggested * quan * 3) {
            let orig_ublessed = u.ublessed;

            /* u.ublessed is only active when Protection is enabled via
               something other than worn gear (theft by gremlin clears the
               intrinsic but not its former magnitude, making it
               recoverable) */
            if (!(HProtection() & INTRINSIC)) {
                u.uprops[PROTECTION].intrinsic = or64(u.uprops[PROTECTION].intrinsic, FROMOUTSIDE);
                orig_ublessed = -1; /* force "rewarded" message */
            }

            for (; offer >= (2 * suggested); offer -= (2 * suggested)) {
                if (!u.ublessed)
                    u.ublessed = rn1(3, 2);
                else if (u.ublessed < 20 &&
                         (u.ublessed < 9 || !rn2(u.ublessed)))
                    u.ublessed++;
            }
               ;
            if (u.ublessed > orig_ublessed) {
                verbalize(_("Thou hast been rewarded for thy devotion."));
            } else {
                verbalize(_("Thy selfless generosity is deeply appreciated."));
            }
        } else {
               ;
            verbalize(_("Thy selfless generosity is deeply appreciated."));
            /* money_cnt check is preserved for futureproofing but probably
               can't fail in the current code */
            if (money_cnt(gi.invent) < (offer * 2) && coaligned) {
                if (strayed && (svm.moves - u.ucleansed) > 5000) {
                    u.ualign.record = 0; /* cleanse thee */
                    u.ucleansed = svm.moves;
                } else {
                    adjalign(2);
                }
            }
        }
    }
    } finally { stack_pop($frame); }
}

export function mk_roamer(ptr, alignment, x, y,
          peaceful) { /* struct monst * */
    let roamer;
    let coaligned = +(u.ualign.type == alignment);

    if (MON_AT(x, y))
        rloc(m_at(x, y), RLOC_NOMSG); /* insurance */

    if (!(roamer = makemon(ptr, x, y, MM_ADJACENTOK | MM_EMIN | MM_NOMSG)))
        return null;

    EMIN(roamer).min_align = alignment;
    EMIN(roamer).renegade = (coaligned && !peaceful ? 1 : 0);
    roamer.ispriest = 0;
    roamer.isminion = 1;
    mon_learns_traps(roamer, ALL_TRAPS); /* traps are known */
    roamer.mpeaceful = unsigned(peaceful);
    roamer.msleeping = 0;
    set_malign(roamer); /* peaceful may have changed */

    /* MORE TO COME */
    return roamer;
}

export function reset_hostility(roamer) { /* void */
    if (!roamer.isminion)
        return;
    if (roamer.data != mons[PM_ALIGNED_CLERIC]
        && roamer.data != mons[PM_ANGEL])
        return;

    if (EMIN(roamer).min_align != u.ualign.type) {
        roamer.mpeaceful = roamer.mtame = 0;
        set_malign(roamer);
    }
    newsym(roamer.mx, roamer.my);
}

export function in_your_sanctuary(
    mon,
    x, y) { /* boolean */
    let roomno;
    let priest;

    if (mon) {
        if (is_minion(mon.data) || is_rider(mon.data))
            return FALSE;
        x = mon.mx, y = mon.my;
    }
    if (u.ualign.record <= ALGN_SINNED) /* sinned or worse */
        return FALSE;
    if ((roomno = temple_occupied(u.urooms)) == 0
        || roomno != chars[in_rooms(x, y, TEMPLE)])
        return FALSE;
    if ((priest = findpriest(roomno)) == null)
        return FALSE;
    return (has_shrine(priest) && p_coaligned(priest)
                      && priest.mpeaceful ? 1 : 0);
}

/* when attacking "priest" in his temple */
export function ghod_hitsu(priest) { /* void */
    let troom;
    let oldbuzzer;
    let oldcurrwand;
    let x, y, ax, ay;
    let roomno = temple_occupied(u.urooms);

    if (!roomno || !has_shrine(priest))
        return;

    ax = x = EPRI(priest).shrpos.x;
    ay = y = EPRI(priest).shrpos.y;
    troom = elt(svr.rooms, roomno - ROOMOFFSET);

    if (u_at(x, y) || !linedup(u.ux, u.uy, x, y, 1)) {
        if (IS_DOOR(levl()[u.ux][u.uy].typ)) {
            if (u.ux == troom.lx - 1) {
                x = troom.hx;
                y = u.uy;
            } else if (u.ux == troom.hx + 1) {
                x = troom.lx;
                y = u.uy;
            } else if (u.uy == troom.ly - 1) {
                x = u.ux;
                y = troom.hy;
            } else if (u.uy == troom.hy + 1) {
                x = u.ux;
                y = troom.ly;
            }
        } else {
            switch (rn2(4)) {
            case 0:
                x = u.ux;
                y = troom.ly;
                break;
            case 1:
                x = u.ux;
                y = troom.hy;
                break;
            case 2:
                x = troom.lx;
                y = u.uy;
                break;
            default:
                x = troom.hx;
                y = u.uy;
                break;
            }
        }
        if (!linedup(u.ux, u.uy, x, y, 1))
            return;
    }

    switch (rn2(3)) {
    case 0:
        pline(_("%s roars in anger:  \"Thou shalt suffer!\""),
              a_gname_at(ax, ay));
        break;
    case 1:
        pline(_("%s voice booms:  \"How darest thou harm my servant!\""),
              s_suffix(a_gname_at(ax, ay)));
        break;
    default:
        pline(_("%s roars:  \"Thou dost profane my shrine!\""),
              a_gname_at(ax, ay));
        break;
    }

    /* bolt of lightning cast by unspecified monster */
    oldcurrwand = gc.current_wand;
    gc.current_wand = null;
    oldbuzzer = gb.buzzer;
    gb.buzzer = null;
    buzz(BZ_M_SPELL(BZ_OFS_AD(AD_ELEC)), 6, x, y, sgn(gt.tbx), sgn(gt.tby));
    gb.buzzer = oldbuzzer;
    gc.current_wand = oldcurrwand;
    exercise(A_WIS, FALSE);
}

export function angry_priest() { /* void */
    let priest;
    let lev;

    if ((priest = findpriest(temple_occupied(u.urooms))) != null) {
        let eprip = EPRI(priest);

        wakeup(priest, FALSE);
        setmangry(priest, FALSE);
        /*
         * If the altar has been destroyed or converted, let the
         * priest run loose.
         * (When it's just a conversion and there happens to be
         * a fresh corpse nearby, the priest ought to have an
         * opportunity to try converting it back; maybe someday...)
         */
        lev = levl()[eprip.shrpos.x][eprip.shrpos.y];
        if (!IS_ALTAR(lev.typ)
            || (Amask2align(lev.flags & AM_MASK)
                != eprip.shralign)) {
            if (!EMIN(priest))
                newemin(priest);
            priest.ispriest = 0; /* now a roaming minion */
            priest.isminion = 1;
            assert(has_emin(priest));
            EMIN(priest).min_align = eprip.shralign;
            EMIN(priest).renegade = FALSE;
            /* discard priest's memory of his former shrine;
               if we ever implement the re-conversion mentioned
               above, this will need to be removed */
            free_epri(priest);
        }
    }
}

/*
 * When saving bones, find priests that aren't on their shrine level,
 * and remove them.  This avoids big problems when restoring bones.
 * [Perhaps we should convert them into roamers instead?]
 */
export function clearpriests() { /* void */
    let mtmp;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (mtmp.ispriest && !on_level((EPRI(mtmp).shrlevel), u.uz))
            mongone(mtmp);
    }
}

/* munge priest-specific structure when restoring -dlc */
export function restpriest(mtmp, ghostly) { /* void */
    if (u.uz.dlevel) {
        if (ghostly)
            assign_level((EPRI(mtmp).shrlevel), u.uz);
    }
}

/*priest.c*/

import { AM_MASK, AM_SHRINE, A_CHAOTIC, A_LAWFUL, A_NEUTRAL, A_NONE } from "./align.h.js";
import { Amask2align } from "./align.h.macros.js";
import { A_WIS } from "./attrib.h.js";
import { canspotmon } from "./display.h.macros.js";
import { In_endgame, Is_astralevel, Is_sanctum } from "./dungeon.h.macros.js";
import { BUFSZ, FALSE, LL_CONDUCT, TRUE } from "./global.h.js";
import {
    ARTICLE_A, ARTICLE_NONE, ARTICLE_THE, ARTICLE_YOUR, MM_ADJACENTOK, MM_EMIN, MM_EPRI, MM_NOMSG,
    N_DIRS, RLOC_NOMSG, SPINE,
} from "./hack.h.js";
import { BZ_M_SPELL, BZ_OFS_AD, DIR_CLAMP, onlineu, rn1, verbalize1 } from "./hack.h.macros.js";
import { struct_epri } from "./mextra.h.js";
import { EMIN, EPRI, ESHK, has_emin } from "./mextra.h.macros.js";
import { ALLOW_M, ALLOW_ROCK, NOTONL, struct_mfndposdata } from "./mfndpos.h.js";
import { ROOMOFFSET, TEMPLE } from "./mkroom.h.js";
import { AD_ELEC } from "./monattk.h.js";
import { is_minion, is_rider } from "./mondata.h.macros.js";
import { DEADMONSTER, helpless } from "./monst.h.macros.js";
import { PM_ALIGNED_CLERIC, PM_ANGEL, PM_GHOST, PM_HIGH_CLERIC } from "./monsters.h.js";
import { SPBOOK_no_NOVEL } from "./objclass.h.js";
import { AMULET_OF_YENDOR } from "./objects.h.js";
import { CLAIRVOYANT, FROMOUTSIDE, INTRINSIC, PROTECTION, W_ARMC } from "./prop.h.js";
import {
    IS_ALTAR, IS_DOOR, IS_ROOM, MON_AT, fmon, levl, m_at, remove_monster,
} from "./rm.h.macros.js";
import { ALL_TRAPS } from "./trap.h.js";
import { m_canseeu } from "./vision.h.macros.js";
import { ACH_TMPL } from "./you.h.js";
import { m_next2u, mhis, u_at } from "./you.h.macros.js";
import {
    Conflict, Deaf, Displaced, HProtection, Hallucination, Invis,
} from "./youprop.h.macros.js";
import { char, ord, schar, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { or64 } from "../rt/int64.js";
import { assert, free, memset, sprintf, strcat, strchr, strcmp, strcpy } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, elt, ptr_diff, ptr_to, ref_of, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { adjalign, exercise } from "./attrib.js";
import {
    flags, gb, gc, gi, gm, gn, gt, program_state, svd, svm, svr, u, xdir, ydir,
} from "./decl.js";
import { canseemon, newsym } from "./display.js";
import { Monnam, bogon_is_pname, mon_nam, mon_pmname, rndmonnam } from "./do_name.js";
import { assign_level, mapseen_temple, on_level } from "./dungeon.js";
import { check_special_room, in_rooms, money_cnt, nomul } from "./hack.js";
import { dist2, s_suffix, sgn, strncmpi } from "./hacklib.js";
import { record_achievement } from "./insight.js";
import { currency } from "./invent.js";
import { makemon, mongets, newmextra, set_malign } from "./makemon.js";
import { mattacku } from "./mhitu.js";
import { bribe, newemin } from "./minion.js";
import { curse, mkobj, uncurse } from "./mkobj.js";
import { mfndpos, mon_allowflags, mongone, monnear, setmangry, wakeup } from "./mon.js";
import { mon_learns_traps, resist_conflict } from "./mondata.js";
import { m_break_boulder, m_move_aggress } from "./monmove.js";
import { mons } from "./monst.js";
import { linedup } from "./mthrowu.js";
import { just_an } from "./objnam.js";
import { You, You_feel, Your, impossible, livelog_printf, pline, verbalize } from "./pline.js";
import { body_part } from "./polyself.js";
import { incr_itimeout } from "./potion.js";
import { a_gname_at, halu_gname } from "./pray.js";
import { d, rn2 } from "./rnd.js";
import { inhishop, money2u } from "./shk.js";
import { pm_good_location } from "./sp_lev.js";
import { mpickobj } from "./steal.js";
import { place_monster } from "./steed.js";
import { rloc } from "./teleport.js";
import { which_armor } from "./worn.js";
import { buzz } from "./zap.js";
