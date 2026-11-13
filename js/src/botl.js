/* NetHack 5.0	botl.c	$NHDT-Date: 1769839231 2026/01/30 22:00:31 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.277 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2006. */
/* NetHack may be freely redistributed.  See license for details. */

 /* defined in eat.c */

/* also used in insight.c */
export const enc_stat = static_array("enc_stat", ptr_to(char), null, [
    _(""),         _("Burdened"),  _("Stressed"),
    _("Strained"), _("Overtaxed"), _("Overloaded")
]);

export function get_strength_str() { /* char * */
    let buf = static_array("get_strength_str.buf", char, 32);
    let st = ACURR(A_STR);

    if (st > 18) {
        if (st > STR18(100))
            sprintf(buf, _("%2d"), st - 100);
        else if (st < STR18(100))
            sprintf(buf, _("18/%02d"), st - 18);
        else
            sprintf(buf, _("18/**"));
    } else
        sprintf(buf, _("%-1d"), st);

    return buf;
}

export function check_gold_symbol() { /* void */
    let goldch = uchars[gs.showsyms + (COIN_CLASS + SYM_OFF_O)];

    iflags.invis_goldsym = +(goldch <= ord(' '));
}

export function do_statusline1() { /* char * */
    const $frame = stack_frame(); try {
    let newbot1 = static_array("do_statusline1.newbot1", char, BUFSZ);
    let nb;
    let i, j;

    if (suppress_map_output())
        return strcpy(newbot1, _(""));

    strcpy(newbot1, svp.plname);
    if (ord('a') <= chars[newbot1 + 0] && chars[newbot1 + 0] <= ord('z'))
        chars[newbot1 + 0] += ord('A') - ord('a');
    chars[newbot1 + BOTL_NSIZ] = 0;
    sprintf(nb = eos(newbot1), _(" the "));

    if (Upolyd()) {
        let mbot = stack_array(char, BUFSZ);
        let k = 0;

        strcpy(mbot, pmname(mons[u.umonnum], Ugender()));
        while (chars[mbot + k] != 0) {
            if ((k == 0 || (k > 0 && chars[mbot + (k - 1)] == ord(' '))) && ord('a') <= chars[mbot + k]
                && chars[mbot + k] <= ord('z'))
                chars[mbot + k] += ord('A') - ord('a');
            k++;
        }
        strcpy(nb = eos(nb), mbot);
    } else {
        strcpy(nb = eos(nb), rank());
    }

    sprintf(nb = eos(nb), _("  "));
    i = gm.mrank_sz + 15;
    j = ((nb + 2) - newbot1); /* strlen(newbot1) but less computation */
    if ((i - j) > 0)
        sprintf(nb = eos(nb), _("%*s"), i - j, _(" ")); /* pad with spaces */

    sprintf(nb = eos(nb), _("St:%s Dx:%-1d Co:%-1d In:%-1d Wi:%-1d Ch:%-1d"), get_strength_str(), ACURR(A_DEX), ACURR(A_CON), ACURR(A_INT), ACURR(A_WIS), ACURR(A_CHA))

;
    sprintf(nb = eos(nb), _("%s"), (u.ualign.type == A_CHAOTIC) ? _("  Chaotic")
              : (u.ualign.type == A_NEUTRAL) ? _("  Neutral")
                : _("  Lawful"))
;

    return newbot1;
    } finally { stack_pop($frame); }
}

export function do_statusline2() { /* char * */
    let newbot2 = static_array("do_statusline2.newbot2", char, BUFSZ),

         dloc = static_array("do_statusline2.dloc", char, QBUFSZ), hlth = static_array("do_statusline2.hlth", char, QBUFSZ), expr = static_array("do_statusline2.expr", char, QBUFSZ),
         tmmv = static_array("do_statusline2.tmmv", char, QBUFSZ), cond = static_array("do_statusline2.cond", char, QBUFSZ), vers = static_array("do_statusline2.vers", char, QBUFSZ);
    let nb;
    let dln, dx, hln, xln, tln, cln, vrn;
    let hp, hpmax, cap;
    let money;

    if (suppress_map_output())
        return strcpy(newbot2, _(""));

    /*
     * Various min(x,9999)'s are to avoid having excessive values
     * violate the field width assumptions in botl.h and should not
     * impact normal play.  Particularly 64-bit long for gold which
     * could require many more digits if someone figures out a way
     * to get and carry a really large (or negative) amount of it.
     * Turn counter is also long, but we'll risk that.
     */

    /* dungeon location plus gold */
    describe_level(dloc, 1); /* includes at least one trailing space */
    if ((money = money_cnt(gi.invent)) < 0)
        money = 0; /* ought to issue impossible() and then discard gold */
    sprintf(eos(dloc), _("%s:%-2lld"), (iflags.in_dumplog || iflags.invis_goldsym) ? _("$")
              : encglyph(objnum_to_glyph(GOLD_PIECE)), min(money, 999999))

;
    dln = strlen(dloc);
    /* '$' encoded as \GXXXXNNNN is 9 chars longer than display will need */
    dx = strstri(dloc, _("\\G")) ? 9 : 0;

    /* health and armor class (has trailing space for AC 0..9) */
    hp = Upolyd() ? u.mh : u.uhp;
    hpmax = Upolyd() ? u.mhmax : u.uhpmax;
    if (hp < 0)
        hp = 0;
    sprintf(hlth, _("HP:%d(%d) Pw:%d(%d) AC:%-2d"), min(hp, 9999), min(hpmax, 9999), min(u.uen, 9999), min(u.uenmax, 9999), u.uac)

;
    hln = strlen(hlth);

    /* experience */
    if (Upolyd())
        sprintf(expr, _("HD:%d"), mons[u.umonnum].mlevel);
    else if (flags.showexp)
        sprintf(expr, _("Xp:%d/%-1lld"), u.ulevel, u.uexp);
    else
        sprintf(expr, _("Xp:%d"), u.ulevel);
    xln = strlen(expr);

    /* time/move counter */
    if (flags.time)
        sprintf(tmmv, _("T:%lld"), svm.moves);
    else
        chars[tmmv + 0] = ord('\0');
    tln = strlen(tmmv);

    /* status conditions; worst ones first */
    chars[cond + 0] = ord('\0'); /* once non-empty, cond will have a leading space */
    nb = cond;
    /*
     * Stoned, Slimed, Strangled, and both types of Sick are all fatal
     * unless remedied before timeout expires.  Should we order them by
     * shortest time left?  [Probably not worth the effort, since it's
     * unusual for more than one of them to apply at a time.]
     */
    if (Stoned())
        strcpy(nb = eos(nb), _(" Stone"));
    if (Slimed())
        strcpy(nb = eos(nb), _(" Slime"));
    if (Strangled())
        strcpy(nb = eos(nb), _(" Strngl"));
    if (Sick()) {
        if (u.usick_type & SICK_VOMITABLE)
            strcpy(nb = eos(nb), _(" FoodPois"));
        if (u.usick_type & SICK_NONVOMITABLE)
            strcpy(nb = eos(nb), _(" TermIll"));
    }
    if (u.uhs != NOT_HUNGRY)
        sprintf(nb = eos(nb), _(" %s"), hu_stat[u.uhs]);
    if ((cap = near_capacity()) > UNENCUMBERED)
        sprintf(nb = eos(nb), _(" %s"), enc_stat[cap]);
    if (Blind())
        strcpy(nb = eos(nb), _(" Blind"));
    if (Deaf())
        strcpy(nb = eos(nb), _(" Deaf"));
    if (Stunned())
        strcpy(nb = eos(nb), _(" Stun"));
    if (Confusion())
        strcpy(nb = eos(nb), _(" Conf"));
    if (Hallucination())
        strcpy(nb = eos(nb), _(" Hallu"));
    /* levitation and flying are mutually exclusive; riding is not */
    if (Levitation())
        strcpy(nb = eos(nb), _(" Lev"));
    if (Flying())
        strcpy(nb = eos(nb), _(" Fly"));
    if (u.usteed)
        strcpy(nb = eos(nb), _(" Ride"));
    cln = strlen(cond);

    /* version on status line, with leading space */
    if (flags.showvers)
        status_version(vers, sizeof(array_of(char, QBUFSZ)), TRUE);
    else
        chars[vers + 0] = ord('\0');
    vrn = strlen(vers);

    /*
     * Put the pieces together.  If they all fit, keep the traditional
     * sequence.  Otherwise, move least important parts to the end in
     * case the interface side of things has to truncate.  Note that
     * dloc[] contains '$' encoded in ten character sequence \GXXXXNNNN
     * so we want to test its display length rather than buffer length.
     *
     * We don't have an actual display limit here, so have to go by the
     * width of the map.  Since we're reordering rather than truncating,
     * wider displays can still show wider status than the map if the
     * interface supports that.
     */
    if (unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(dln - dx) + 1) + hln) + 1) + xln) + 1) + tln) + 1) + cln) + vrn) <= COLNO) {
        Snprintf(newbot2, sizeof(array_of(char, BUFSZ)), _("%s %s %s %s %s%s"), dloc, hlth, expr, tmmv, cond, vers)
;
    } else {
        if (unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(dln + 1) + hln) + 1) + xln) + 1) + tln) + 1) + cln) + vrn) > MAXCO) {
            panic(_("bot2: second status line exceeds MAXCO (%u > %d)"),
                  unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(dln + 1) + hln) + 1) + xln) + 1) + tln) + 1) + cln)
                              + vrn),
                  MAXCO);
        } else if (unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(unsigned(dln - dx) + 1) + hln) + 1) + xln) + 1) + cln) <= COLNO) {
            Snprintf(newbot2, sizeof(array_of(char, BUFSZ)), _("%s %s %s %s %s%s"), dloc, hlth, expr, cond, tmmv, vers)
;
        } else if (unsigned(unsigned(unsigned(unsigned(unsigned(dln - dx) + 1) + hln) + 1) + cln) <= COLNO) {
            Snprintf(newbot2, sizeof(array_of(char, BUFSZ)), _("%s %s %s %s %s%s"), dloc, hlth, cond, expr, tmmv, vers)
;
        } else {
            Snprintf(newbot2, sizeof(array_of(char, BUFSZ)), _("%s %s %s %s %s%s"), hlth, cond, dloc, expr, tmmv, vers)
;
        }
        /* only two or three consecutive spaces available to squeeze out */
        mungspaces(newbot2);
    }
    return newbot2;
}

export function bot() { /* void */
    if (gb.bot_disabled)
        return;
    /* dosave() flags completion by setting u.uhp to -1; suppress_map_output()
       covers program_state.restoring and is used for status as well as map */
    if (u.uhp != -1 && gy.youmonst.data
        && iflags.status_updates && !suppress_map_output()) {
        if (VIA_WINDOWPORT()) {
            bot_via_windowport();
        } else {
            curs()(WIN_STATUS, 1, 0);
            putstr()(WIN_STATUS, 0, do_statusline1());
            curs()(WIN_STATUS, 1, 1);
            putmixed()(WIN_STATUS, 0, do_statusline2());
        }
    }
    disp.botl = disp.botlx = disp.time_botl = FALSE;
}

/* special purpose status update: move counter ('time' status) only */
export function timebot() { /* void */
    if (gb.bot_disabled)
        return;
    /* we're called when disp.time_botl is set and general disp.botl
       is clear; disp.time_botl gets set whenever svm.moves changes value
       so there's no benefit in tracking previous value to decide whether
       to skip update; suppress_map_output() handles program_state.restoring
       and program_state.done_hup (tty hangup => no further output at all)
       and we use it for maybe skipping status as well as for the map */
    if (flags.time && iflags.status_updates && !suppress_map_output()) {
        if (VIA_WINDOWPORT()) {
            stat_update_time();
        } else {
            /* old status display updates everything */
            bot();
        }
    }
    disp.time_botl = FALSE;
}

/* convert experience level (1..30) to rank index (0..8) */
export function xlev_to_rank(xlev) { /* int */
    /*
     *   1..2  => 0
     *   3..5  => 1
     *   6..9  => 2
     *  10..13 => 3
     *      ...
     *  26..29 => 7
     *    30   => 8
     * Conversion is precise but only partially reversible.
     */
    return (xlev <= 2) ? 0 : (xlev <= 30) ? Math.trunc((xlev + 2) / 4) : 8;
}

/* convert rank index (0..8) to experience level (1..30) */
export function rank_to_xlev(rank) { /* int */
    /*
     *  0 =>  1..2
     *  1 =>  3..5
     *  2 =>  6..9
     *  3 => 10..13
     *      ...
     *  7 => 26..29
     *  8 =>   30
     * We return the low end of each range.
     */
    return (rank < 1) ? 1 : (rank < 2) ? 3
           : (rank < 8) ? ((rank * 4) - 2) : 30;
}

export function rank_of(lev, monnum, female) { /* const char * */
    let role;
    let i;

    /* Find the role */
    for (role = roles[0]; role.name.m; role = ptr_add(role, 1))
        if (monnum == role.mnum)
            break;
    if (!role.name.m)
        role = gu.urole;

    /* Find the rank */
    for (i = xlev_to_rank(lev); i >= 0; i--) {
        if (female && role.rank[i].f)
            return role.rank[i].f;
        if (role.rank[i].m)
            return role.rank[i].m;
    }

    /* Try the role name, instead */
    if (female && role.name.f)
        return role.name.f;
    else if (role.name.m)
        return role.name.m;
    return _("Player");
}

function rank() { /* const char * */
    return rank_of(u.ulevel, Role_switch(), flags.female);
}

export function title_to_mon(
    str,
    rank_indx,
    title_length) { /* int */
    let i, j;

    /* Loop through each of the roles */
    for (i = 0; roles[i].name.m; i++) {
        /* loop through each of the rank titles for role #i */
        for (j = 0; j < 9; j++) {
            if (roles[i].rank[j].m
                && str_start_is(str, roles[i].rank[j].m, TRUE)) {
                if (rank_indx)
                    rank_indx[0] = j;
                if (title_length)
                    title_length[0] = int(Strlen(roles[i].rank[j].m));
                return roles[i].mnum;
            }
            if (roles[i].rank[j].f
                && str_start_is(str, roles[i].rank[j].f, TRUE)) {
                if (rank_indx)
                    rank_indx[0] = j;
                if (title_length)
                    title_length[0] = int(Strlen(roles[i].rank[j].f));
                return roles[i].mnum;
            }
        }
    }
    if (title_length)
        title_length[0] = 0;
    return NON_PM;
}

export function max_rank_sz() { /* void */
    let i;
    let r, maxr = 0;

    for (i = 0; i < 9; i++) {
        if (gu.urole.rank[i].m && (r = strlen(gu.urole.rank[i].m)) > maxr)
            maxr = r;
        if (gu.urole.rank[i].f && (r = strlen(gu.urole.rank[i].f)) > maxr)
            maxr = r;
    }
    gm.mrank_sz = int(maxr);
    return;
}

/* #ifdef SCORE_ON_BOTL: not in this build */

/* provide the name of the current level for display by various ports */
export function describe_level(
    buf,
    dflgs) { /* int */ /* 1: append trailing space; 2: include dungeon branch name */
    let addspace = +((dflgs & 1) != 0),
            addbranch = +((dflgs & 2) != 0); /* False: status, True: livelog */
    let ret = 1;

    if (Is_knox(u.uz)) {
        sprintf(buf, _("%s"), svd.dungeons[u.uz.dnum].dname);
        addbranch = FALSE;
    } else if (In_quest(u.uz)) {
        sprintf(buf, _("Home %d"), dunlev(u.uz));
    } else if (In_endgame(u.uz)) {
        /* [3.6.2: this used to be "Astral Plane" or generic "End Game"] */
        endgamelevelname(buf, depth(u.uz));
        if (!addbranch)
            strsubst(buf, _("Plane of "), _("")); /* just keep <element> */
        addbranch = FALSE;
    } else {
        /* ports with more room may expand this one */
        if (!addbranch)
            sprintf(buf, _("%s:%-2d"), In_tutorial(u.uz) ? _("Tutorial") : _("Dlvl"), depth(u.uz));
        else
            sprintf(buf, _("level %d"), depth(u.uz))
;
        ret = 0;
    }
    if (addbranch) {
        sprintf(eos(buf), _(", %s"), svd.dungeons[u.uz.dnum].dname);
        strsubst(buf, _("The "), _("the "));
    }
    if (addspace)
        strcat(buf, _(" "));
    return ret;
}

/* weapon description for status lines; started as a terser version of
   what ^X shows but has diverged to some extent */
export function weapon_status(outbuf) { /* char * */
    let res = 0;

    chars[outbuf] = ord('\0'); /* lint suppression */
    if (!uwep) {
        /* no weapon; gloves imply hands; humanoid also implies hands;
           otherwise make no assumptions */
        res = uarmg ? _("Empty-hnd") /* empty handed means "gloves only" */
              : humanoid(gy.youmonst.data) ? _("Bare-hnds") /* bare hands */
                : _("No-weapon");
    } else if (u.twoweap) {
        /* two-weaponing implies hands and a weapon or wep-tool
           (not other odd stuff) in each hand */
        res = _("Dual-weps");
        /* note: dual wielding two lances doesn't produce double joust */
        if (u.usteed && (weapon_type(uwep) == P_LANCE
                         || weapon_type(uswapwep) == P_LANCE))
            res = _("Dual+joust"); /* lance behaves specially when mounted */
    } else {
        /* report most weapons by their skill class (so a katana will be
           described as a long sword, for instance; mattock and hook are
           exceptions), or wielded non-weapon item by its object class */
        let p;
        let skill = weapon_type(uwep);

        if (u.usteed && skill == P_LANCE) {
            /* lance behaves specially when hero is mounted */
            res = _("joust");
        } else if (uwep.otyp == AKLYS) {
            /* aklys behaves specially when thrown while wielded, so
               give it a distinct name instead of skill name of "club";
               [maybe FIXME?] for the time being
               use real name even if 'obj' is undiscovered "thonged club" */
            res = _("aklys");
        } else if (is_sword(uwep)) {
            /* simplify short short/broad sword/long sword/two-handed sword
               (similar to messages when dropped due to slippery fingers) */
            res = _("sword");
        } else {
            /* shorten several */
            switch (skill) {
            case P_QUARTERSTAFF:
                res = _("staff");
                break;
            case P_MORNING_STAR:
                res = _("mrng-star"); /* still pretty long */
                break;
            case P_POLEARMS:
                res = _("pole");
                break;
            case P_UNICORN_HORN:
                res = _("unihorn");
                break;
            default:
                res = weapon_descr(uwep);
                /* [should this be moved into weapon_descr()?] */
                if (!strncmpi((res), _(("food")), -1) && uwep.otyp == CREAM_PIE)
                    res = _("pie");
                break;
            }
        }

        if ((uwep.oclass == WEAPON_CLASS || is_weptool(uwep))
            && bimanual(uwep) && chars[res] != ord('2') && strncmpi(res, _("two"), 3))
            strcat(outbuf, _("2H-"));
        strcpy(p = eos(outbuf), res), res = outbuf;
        chars[p] = highc(chars[p]);
        /* avoid embedded spaces since its designed to appear as part
           of a space-separated status line */
        strNsubst(outbuf, _(" "), _("-"), 0);
    }

    return (outbuf == res) ? outbuf : strcpy(outbuf, res);
}

/* armor description for status lines */
export function armor_status(armbuf) { /* char * */
    let n = +!!uarmg + +!!uarmc + +!!uarm + +!!uarmu + +!!uarmh + +!!uarmf + +!!uarms;

    /*
     * FIXME: ^X needs to provide non-abbreviated version of this info.
     * At present it just reports the "no armor" case.
     */
    if (n == 0) { /* no armor */
        strcpy(armbuf, _("naked"));
    } else if (n == 1) { /* just one piece; spell it out */
        strcpy(armbuf, uarmg ? _("gloves")
                       : uarmc ? _("cloak")
                         : uarm  ? _("suit")
                           : uarmu ? _("shirt")
                             : uarmh ? helm_simple_name(uarmh) /* hat|helm */
                               : uarmf ? _("boots")
                                 : uarms ? _("shield")
                                   : _("")); /* not possible */
    } else { /* more than one piece */
        let p = armbuf;

        /* gloves first since this is expected to follow weapon_status();
           cloak next since it tends to provide the most protection
           aside from raw AC */
        if (uarmg)
            chars[p++] = ord('G'); /* gloves */
        if (uarmc)
            chars[p++] = ord('C'); /* cloak */
        if (uarm)
            chars[p++] = ord('A'); /* suit but 's' is for shield */
        if (uarmu)
            chars[p++] = ord('U'); /* underwear? => shirt */
        if (uarmh)
            chars[p++] = ord('H'); /* hat/helm */
        if (uarmf)
            chars[p++] = ord('B'); /* footwear => boots */
        if (uarms)
            chars[p++] = ord('S'); /* shield */
        chars[p] = ord('\0');
    }
    /*
     * Add a hint about MC by appending a plus sign if that's augmented.
     * Bug:  we should modfiy magical_negation() to return extra info and
     * call it to scan whole inventory looking for sources of protection.
     * This is a hack for efficiency to avoid that during status updates.
     */
    if ((uright && uright.otyp == RIN_PROTECTION)
        || (uleft && uleft.otyp == RIN_PROTECTION)
        || (uamul && uamul.otyp == AMULET_OF_GUARDING)
        || (uarmc && uarmc.otyp == CLOAK_OF_PROTECTION)
        || (uarmh && uarmh.oartifact == ART_MITRE_OF_HOLINESS)
        || (uwep && uwep.oartifact == ART_TSURUGI_OF_MURAMASA))
        strkitten(armbuf, ord('+'));

    return upstart(armbuf);
}

/* =======================================================================*/
/*  statusnew routines                                                    */
/* =======================================================================*/

/* structure that tracks the status details in the core */

export function has_hilite(i) { return (gb.blstats[0][i].thresholds); }
/* TH_UPDOWN encompasses specific 'up' and 'down' also general 'changed' */
export function Is_Temp_Hilite(rule) { return (rule && rule.behavior == BL_TH_UPDOWN ? 1 : 0); }

/* pointers to current hilite rule and list of this field's defined rules */

/*
 * If entries are added to this, botl.h will require updating too.
 *
 * 'max' values of BL_XP and BL_EXP get special handling since the
 * percentage involved isn't a direct 100*current/maximum calculation.
 *
 * long int fields are given a buffer size of 30 which is guaranteed to
 * be big enough for short prefix followed by a 20+ digit 64-bit long
 * even though the actual values will be much smaller.  The gold field
 * is even bigger due to its encoded dollar sign prefix.
 */
const initblstats = static_array("initblstats", struct_istat_s, MAXBLSTATS, [
    { fldname: _("title"), fldfmt: _("%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: MAXVALWIDTH, idxmax: -1, fld: BL_TITLE },
    { fldname: _("strength"), fldfmt: _(" St:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_STR },
    { fldname: _("dexterity"), fldfmt: _(" Dx:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_DX },
    { fldname: _("constitution"), fldfmt: _(" Co:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_CO },
    { fldname: _("intelligence"), fldfmt: _(" In:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_IN },
    { fldname: _("wisdom"), fldfmt: _(" Wi:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_WI },
    { fldname: _("charisma"), fldfmt: _(" Ch:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_CH },
    { fldname: _("alignment"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: 20, idxmax: -1, fld: BL_ALIGN },
    { fldname: _("score"), fldfmt: _(" S:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_LONG, valwidth: 30, idxmax: -1, fld: BL_SCORE },
    { fldname: _("carrying-capacity"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 20, idxmax: -1, fld: BL_CAP },
    { fldname: _("gold"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_LONG, valwidth: 40, idxmax: -1, fld: BL_GOLD },
    { fldname: _("power"), fldfmt: _(" Pw:%s"), chg: FALSE, percent_matters: TRUE, anytype: ANY_INT, valwidth: 10, idxmax: BL_ENEMAX, fld: BL_ENE },
    { fldname: _("power-max"), fldfmt: _("(%s)"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_ENEMAX },
    { fldname: _("experience-level"), fldfmt: _(" Xp:%s"), chg: FALSE, percent_matters: TRUE, anytype: ANY_INT, valwidth: 10, idxmax: BL_EXP, fld: BL_XP },
    { fldname: _("armor-class"), fldfmt: _(" AC:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_AC },
    { fldname: _("HD"), fldfmt: _(" HD:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_HD },
    { fldname: _("time"), fldfmt: _(" T:%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_LONG, valwidth: 30, idxmax: -1, fld: BL_TIME },
    /* hunger used to be 'ANY_UINT'; see note below in bot_via_windowport() */
    { fldname: _("hunger"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 20, idxmax: -1, fld: BL_HUNGER },
    { fldname: _("hitpoints"), fldfmt: _(" HP:%s"), chg: FALSE, percent_matters: TRUE, anytype: ANY_INT, valwidth: 10, idxmax: BL_HPMAX, fld: BL_HP },
    { fldname: _("hitpoints-max"), fldfmt: _("(%s)"), chg: FALSE, percent_matters: FALSE, anytype: ANY_INT, valwidth: 10, idxmax: -1, fld: BL_HPMAX },
    { fldname: _("dungeon-level"), fldfmt: _("%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: MAXVALWIDTH, idxmax: -1, fld: BL_LEVELDESC },
    { fldname: _("experience"), fldfmt: _("/%s"), chg: FALSE, percent_matters: TRUE, anytype: ANY_LONG, valwidth: 30, idxmax: BL_EXP, fld: BL_EXP },
    { fldname: _("condition"), fldfmt: _("%s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_MASK32, idxmax: -1, fld: BL_CONDITION },
    /* optional; once set it doesn't change unless 'showvers' option is
       toggled or player modifies the 'versinfo' option;
       available mostly for screenshots or someone looking over shoulder;
       blstat[][BL_VERS] is actually an int copy of flags.versinfo (0...7) */
    { fldname: _("version"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: MAXVALWIDTH, idxmax: -1, fld: BL_VERS },
    /* weapon and armor are constructed strings with no particular numeric
       equivalent */
    { fldname: _("weapon"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: 20, idxmax: -1, fld: BL_WEAPON },
    { fldname: _("armor"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: 20, idxmax: -1, fld: BL_ARMOR },
    /* terrain is tracked by a number but designating it as type 'int'
       isn't useful; using type 'string' allows highlighting based on text
       matching which is potentially useful */
    { fldname: _("terrain"), fldfmt: _(" %s"), chg: FALSE, percent_matters: FALSE, anytype: ANY_STR, valwidth: 20, idxmax: -1, fld: BL_TERRAIN },
]);

const condition_aliases = static_array("condition_aliases", struct_condmap, null, [
    { id: _("strangled"),      bitmask: BL_MASK_STRNGL },
    { id: _("all"),            bitmask: BL_MASK_BAREH | BL_MASK_BLIND | BL_MASK_BUSY
                        | BL_MASK_CONF | BL_MASK_DEAF | BL_MASK_ELF_IRON
                        | BL_MASK_FLY | BL_MASK_FOODPOIS | BL_MASK_GLOWHANDS
                        | BL_MASK_GRAB | BL_MASK_HALLU | BL_MASK_HELD
                        | BL_MASK_ICY | BL_MASK_INLAVA | BL_MASK_LEV
                        | BL_MASK_PARLYZ | BL_MASK_RIDE | BL_MASK_SLEEPING
                        | BL_MASK_SLIME | BL_MASK_SLIPPERY | BL_MASK_STONE
                        | BL_MASK_STRNGL | BL_MASK_STUN | BL_MASK_SUBMERGED
                        | BL_MASK_TERMILL | BL_MASK_TETHERED
                        | BL_MASK_TRAPPED | BL_MASK_UNCONSC
                        | BL_MASK_WOUNDEDL | BL_MASK_HOLDING },
    { id: _("major_troubles"), bitmask: BL_MASK_FOODPOIS | BL_MASK_GRAB | BL_MASK_INLAVA
                        | BL_MASK_SLIME | BL_MASK_STONE | BL_MASK_STRNGL
                        | BL_MASK_TERMILL },
    { id: _("minor_troubles"), bitmask: BL_MASK_BLIND | BL_MASK_CONF | BL_MASK_DEAF
                        | BL_MASK_HALLU | BL_MASK_PARLYZ | BL_MASK_SUBMERGED
                        | BL_MASK_STUN },
    { id: _("movement"),       bitmask: BL_MASK_LEV | BL_MASK_FLY | BL_MASK_RIDE },
    { id: _("opt_in"),         bitmask: BL_MASK_BAREH | BL_MASK_BUSY | BL_MASK_GLOWHANDS
                        | BL_MASK_HELD | BL_MASK_ICY | BL_MASK_PARLYZ
                        | BL_MASK_SLEEPING | BL_MASK_SLIPPERY
                        | BL_MASK_SUBMERGED | BL_MASK_TETHERED
                        | BL_MASK_TRAPPED
                        | BL_MASK_UNCONSC | BL_MASK_WOUNDEDL
                        | BL_MASK_HOLDING },
]);

/* condition names and their abbreviations are used by windowport code */
export const conditions = static_array("conditions", struct_conditions_t, null, [
    /* ranking, mask, identifier, txt1, txt2, txt3 */
    { ranking: 20, mask: BL_MASK_BAREH,     c: bl_bareh,     text: [ _("Bare"),     _("Bar"),   _("Bh")  ] },
    { ranking: 10, mask: BL_MASK_BLIND,     c: bl_blind,     text: [ _("Blind"),    _("Blnd"),  _("Bl")  ] },
    { ranking: 20, mask: BL_MASK_BUSY,      c: bl_busy,      text: [ _("Busy"),     _("Bsy"),   _("By")  ] },
    { ranking: 10, mask: BL_MASK_CONF,      c: bl_conf,      text: [ _("Conf"),     _("Cnf"),   _("Cf")  ] },
    { ranking: 10, mask: BL_MASK_DEAF,      c: bl_deaf,      text: [ _("Deaf"),     _("Def"),   _("Df")  ] },
    { ranking: 15, mask: BL_MASK_ELF_IRON,  c: bl_elf_iron,  text: [ _("Iron"),     _("Irn"),   _("Fe")  ] },
    { ranking: 10, mask: BL_MASK_FLY,       c: bl_fly,       text: [ _("Fly"),      _("Fly"),   _("Fl")  ] },
    {  ranking: 6, mask: BL_MASK_FOODPOIS,  c: bl_foodpois,  text: [ _("FoodPois"), _("Fpois"), _("Poi") ] },
    { ranking: 20, mask: BL_MASK_GLOWHANDS, c: bl_glowhands, text: [ _("Glow"),     _("Glo"),   _("Gl")  ] },
    {  ranking: 2, mask: BL_MASK_GRAB,      c: bl_grab,      text: [ _("Grab"),     _("Grb"),   _("Gr")  ] },
    { ranking: 10, mask: BL_MASK_HALLU,     c: bl_hallu,     text: [ _("Hallu"),    _("Hal"),   _("Hl")  ] },
    { ranking: 20, mask: BL_MASK_HELD,      c: bl_held,      text: [ _("Held"),     _("Hld"),   _("Hd")  ] },
    { ranking: 20, mask: BL_MASK_ICY,       c: bl_icy,       text: [ _("Icy"),      _("Icy"),   _("Ic")  ] },
    {  ranking: 8, mask: BL_MASK_INLAVA,    c: bl_inlava,    text: [ _("InLava"),   _("Lav"),   _("La")  ] },
    { ranking: 10, mask: BL_MASK_LEV,       c: bl_lev,       text: [ _("Lev"),      _("Lev"),   _("Lv")  ] },
    { ranking: 20, mask: BL_MASK_PARLYZ,    c: bl_parlyz,    text: [ _("Parlyz"),   _("Para"),  _("Par") ] },
    { ranking: 10, mask: BL_MASK_RIDE,      c: bl_ride,      text: [ _("Ride"),     _("Rid"),   _("Rd")  ] },
    { ranking: 20, mask: BL_MASK_SLEEPING,  c: bl_sleeping,  text: [ _("Zzz"),      _("Zzz"),   _("Zz")  ] },
    {  ranking: 6, mask: BL_MASK_SLIME,     c: bl_slime,     text: [ _("Slime"),    _("Slim"),  _("Slm") ] },
    { ranking: 20, mask: BL_MASK_SLIPPERY,  c: bl_slippery,  text: [ _("Slip"),     _("Slp"),   _("Sl")  ] },
    {  ranking: 6, mask: BL_MASK_STONE,     c: bl_stone,     text: [ _("Stone"),    _("Ston"),  _("Sto") ] },
    {  ranking: 4, mask: BL_MASK_STRNGL,    c: bl_strngl,    text: [ _("Strngl"),   _("Stngl"), _("Str") ] },
    { ranking: 10, mask: BL_MASK_STUN,      c: bl_stun,      text: [ _("Stun"),     _("Stun"),  _("St")  ] },
    { ranking: 15, mask: BL_MASK_SUBMERGED, c: bl_submerged, text: [ _("Submrg"),   _("Subm"),  _("Sm")  ] },
    {  ranking: 6, mask: BL_MASK_TERMILL,   c: bl_termill,   text: [ _("TermIll"),  _("Ill"),   _("Ill") ] },
    { ranking: 20, mask: BL_MASK_TETHERED,  c: bl_tethered,  text: [ _("Teth"),     _("Tth"),   _("Te")  ] },
    { ranking: 20, mask: BL_MASK_TRAPPED,   c: bl_trapped,   text: [ _("Trap"),     _("Trp"),   _("Tr")  ] },
    { ranking: 20, mask: BL_MASK_UNCONSC,   c: bl_unconsc,   text: [ _("Out"),      _("Out"),   _("KO")  ] },
    { ranking: 20, mask: BL_MASK_WOUNDEDL,  c: bl_woundedl,  text: [ _("WLegs"),    _("Leg"),   _("Lg")  ] },
    { ranking: 20, mask: BL_MASK_HOLDING,   c: bl_holding,   text: [ _("UHold"),    _("UHld"),  _("UHd") ] },
]);

/* [perhaps these should all be opt_out with default of 'in';
   otherwise some players may never learn about them] */
export const condtests = static_array("condtests", struct_condtests_t, CONDITION_COUNT, [
    /* id, useropt, opt_in or out, enabled, configchoice, testresult;
       default value for enabled is !opt_in but can get changed via options */
    { c: bl_bareh,     useroption: _("barehanded"),  opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_blind,     useroption: _("blind"),       opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_busy,      useroption: _("busy"),        opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_conf,      useroption: _("conf"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_deaf,      useroption: _("deaf"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_elf_iron,  useroption: _("iron"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_fly,       useroption: _("fly"),         opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_foodpois,  useroption: _("foodPois"),    opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_glowhands, useroption: _("glowhands"),   opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_grab,      useroption: _("grab"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_hallu,     useroption: _("hallucinat"),  opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_held,      useroption: _("held"),        opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_icy,       useroption: _("ice"),         opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_inlava,    useroption: _("lava"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_lev,       useroption: _("levitate"),    opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_parlyz,    useroption: _("paralyzed"),   opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_ride,      useroption: _("ride"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_sleeping,  useroption: _("sleep"),       opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_slime,     useroption: _("slime"),       opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_slippery,  useroption: _("slip"),        opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_stone,     useroption: _("stone"),       opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_strngl,    useroption: _("strngl"),      opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_stun,      useroption: _("stun"),        opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_submerged, useroption: _("submerged"),   opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_termill,   useroption: _("termIll"),     opt: opt_out, enabled: TRUE,  choice: FALSE, test: FALSE },
    { c: bl_tethered,  useroption: _("tethered"),    opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_trapped,   useroption: _("trap"),        opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_unconsc,   useroption: _("unconscious"), opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_woundedl,  useroption: _("woundedlegs"), opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
    { c: bl_holding,   useroption: _("holding"),     opt: opt_in,  enabled: FALSE, choice: FALSE, test: FALSE },
]);
/* condition indexing */
export const cond_idx = static_array("cond_idx", int, CONDITION_COUNT, [ 0 ]);

const c_Wall = init_string(static_array("c_Wall", char, sizeof_string("Wall")), _("Wall"), true);
/*
 *  Terrain descriptions for flags.terrainstatus; simplified from
 *  def_syms[].name and indexed by iflags.terrain_typ; should be
 *  kept in sync with rm.h types and the first half of def_syms[].
 *  The extra pseudo-types are specified by classify_terrain()
 *  when it sets up iflags.terrain_typ.  Walls and a few of the
 *  others can only occur when hero has the Passes_walls ability.
 */
export const terrain_descr = static_array("terrain_descr", ptr_to(char), null, [
/* 0*/ _("Stone"),         /* stone */
       c_Wall,          /* vwall */
       c_Wall,          /* hwall */
       c_Wall,          /* tlcorner */
       c_Wall,          /* trcorner */
       c_Wall,          /* blcorner */
       c_Wall,          /* brcorner */
       c_Wall,          /* crosswall */
       c_Wall,          /* tuwall */
       c_Wall,          /* tdwall */
/*10*/ c_Wall,          /* tlwall */
       c_Wall,          /* trwall */
       _("Portcullis"),    /* dbwall, closed drawbridge 'door' */
       _("Tree"),
       c_Wall,          /* sdoor: secret door */
       _("Stone"),         /* scorr: secret corridor */
       _("Pool"),          /* pool or non-moat water; can be boiled away */
       _("Moat"),          /* water that can't be boiled away */
       _("Water"),         /* water on Water level; can't be boiled or frozen */
       _("(gap)"),         /* drawbridge_up; replaced by whatever is under */
/*20*/ _("Lava"),          /* lavapool */
       _("LavaWall"),      /* lava that extends to ceiling */
       _("Bars"),          /* ironbars */
       _("Doorway"),       /* doorless or broken door; diagonal movement is ok */
       _("Corridor"),      /* replaced by "Floor" */
       _("Room"),          /* also replaced by "Floor" */
       _("Stairs"),
       _("Ladder"),
       _("Fountain"),
       _("Throne"),
/*30*/ _("Sink"),
       _("Grave"),
       _("Altar"),
       _("Ice"),
       _("Bridge"),        /* drawbridge_down, span across moat/ice/lava/floor */
       _("Air"),           /* open air on Air level or bubble on Water level */
       _("Cloud"),         /* [part of] a cloud or Air level */
       /*
        */
/*37*/ _(""),              /* MAX_TYPE; skipped ratther than overloaded */
/*38*/ c_Wall,          /* MATCH_WALL for special levels; shouldn't happen */
       /*
        * additional terrain names that aren't simple levl[][].typ values
        */
/*39*/ _("Floor"),         /* substituted for room or corridor */
/*40*/ _("Ground"),        /* 'room' on Earth level */
       _("Open-door"),     /* open (not broken or doorless) */
       _("Shut-door"),     /* closed or locked (or trapped) */
       _("Swamp"),         /* Juiblex level */
       _("Submerged"),     /* under water */
       _("Sea"),           /* moat terrain on Medusa's level: "shallow sea" */
       _("WaterWall"),     /* water that extends to the ceiling */
]);

/* cache-related */
const cache_avail = static_array("cache_avail", schar, 3, [ FALSE, FALSE, FALSE ]);
const cache_reslt = static_array("cache_reslt", schar, 3, [ FALSE, FALSE, FALSE ]);
const cache_nomovemsg = static_var("cache_nomovemsg", ptr_to(char), 0); const cache_multi_reason = static_var("cache_multi_reason", ptr_to(char), 0);

export function cond_cache_prepA() {
do {
    let clear_cache = FALSE, refresh_cache = FALSE;

    if (gm.multi < 0) {
        if (gn.nomovemsg || gm.multi_reason) {
            if (cache_nomovemsg[0] != gn.nomovemsg)
                refresh_cache = TRUE;
            if (cache_multi_reason[0] != gm.multi_reason)
                refresh_cache = TRUE;
        } else {
            clear_cache = TRUE;
        }
    } else {
        clear_cache = TRUE;
    }
    if (clear_cache) {
        cache_nomovemsg[0] = 0;
        cache_multi_reason[0] = 0;
    }
    if (refresh_cache) {
        cache_nomovemsg[0] = gn.nomovemsg;
        cache_multi_reason[0] = gm.multi_reason;
    }
    if (clear_cache || refresh_cache) {
        chars[cache_reslt + 0] = chars[cache_avail + 0] = FALSE;
        chars[cache_reslt + 1] = chars[cache_avail + 1] = FALSE;
    }
} while (0) }

/* we don't put this next declaration in #ifdef STATUS_HILITES.
 * In the absence of STATUS_HILITES, each array
 * element will be 0 however, and quite meaningless,
 * but we need to pass the first array element as
 * the final argument of status_update, with or
 * without STATUS_HILITES.
 */

function bot_via_windowport() { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let titl;
    let nb;
    let i, idx, cap;
    let money;

    if (!gb.blinit)
        panic(_("bot before init."));

    /* toggle from previous iteration */
    idx = 1 - gn.now_or_before_idx; /* 0 -> 1, 1 -> 0 */
    gn.now_or_before_idx = idx;

    /* clear the "value set" indicators */
    memset(gv.valset, 0, MAXBLSTATS * sizeof(schar));

    /*
     * Note: min(x,9999) - we enforce the same maximum on hp, maxhp,
     * pw, maxpw, and gold as basic status formatting so that the two
     * modes of status display don't produce different information.
     */

    /*
     *  Player name and title.
     */
    strcpy(nb = buf, svp.plname);
    chars[nb + 0] = highc(chars[nb + 0]);
    titl = !Upolyd() ? rank() : pmname(mons[u.umonnum], Ugender());
    i = int(unsigned(unsigned(unsigned(strlen(buf) + sizeof_string(" the ")) + strlen(titl)) - sizeof_string("")));
    /* if "Name the Rank/monster" is too long, we truncate the name but
       always keep at least BOTL_NSIZ characters of it; when hitpointbar is
       enabled, anything beyond 30 (long monster name) will be truncated */
    if (i > 30) {
        i = 30 - int(unsigned(unsigned(sizeof_string(" the ") + strlen(titl)) - sizeof_string("")));
        chars[nb + max(i, BOTL_NSIZ)] = ord('\0');
    }
    strcpy(nb = eos(nb), _(" the "));
    strcpy(nb = eos(nb), titl);
    if (Upolyd()) { /* when poly'd, capitalize monster name */
        for (i = 0; chars[nb + i]; i++)
            if (i == 0 || chars[nb + (i - 1)] == ord(' '))
                chars[nb + i] = highc(chars[nb + i]);
    }
    sprintf(gb.blstats[idx][BL_TITLE].val, _("%-30s"), buf);
    chars[gv.valset + BL_TITLE] = TRUE; /* indicate val already set */

    /* Strength */
    gb.blstats[idx][BL_STR].a.a_int = ACURR(A_STR);
    strcpy(gb.blstats[idx][BL_STR].val, get_strength_str());
    chars[gv.valset + BL_STR] = TRUE; /* indicate val already set */

    /*  Dexterity, constitution, intelligence, wisdom, charisma. */
    gb.blstats[idx][BL_DX].a.a_int = ACURR(A_DEX);
    gb.blstats[idx][BL_CO].a.a_int = ACURR(A_CON);
    gb.blstats[idx][BL_IN].a.a_int = ACURR(A_INT);
    gb.blstats[idx][BL_WI].a.a_int = ACURR(A_WIS);
    gb.blstats[idx][BL_CH].a.a_int = ACURR(A_CHA);

    /* Alignment */
    strcpy(gb.blstats[idx][BL_ALIGN].val, (u.ualign.type == A_CHAOTIC)
                                          ? _("Chaotic")
                                          : (u.ualign.type == A_NEUTRAL)
                                               ? _("Neutral")
                                               : _("Lawful"));

    /* Score */
    gb.blstats[idx][BL_SCORE].a.a_long =

        0;

    /*  Hit points  */
    i = Upolyd() ? u.mh : u.uhp;
    if (i < 0) /* gameover sets u.uhp to -1 */
        i = 0;
    gb.blstats[idx][BL_HP].rawval.a_int = i;
    gb.blstats[idx][BL_HP].a.a_int = min(i, 9999);
    i = Upolyd() ? u.mhmax : u.uhpmax;
    gb.blstats[idx][BL_HPMAX].rawval.a_int = i;
    gb.blstats[idx][BL_HPMAX].a.a_int = min(i, 9999);

    /*  Dungeon level. */
    describe_level(gb.blstats[idx][BL_LEVELDESC].val, 1);
    chars[gv.valset + BL_LEVELDESC] = TRUE; /* indicate val already set */

    /* Gold */
    if ((money = money_cnt(gi.invent)) < 0)
        money = 0; /* ought to issue impossible() and then discard gold */
    gb.blstats[idx][BL_GOLD].rawval.a_long = money;
    gb.blstats[idx][BL_GOLD].a.a_long = min(money, 999999);
    /*
     * The tty port needs to display the current symbol for gold
     * as a field header, so to accommodate that we pass gold with
     * that already included. If a window port needs to use the text
     * gold amount without the leading "$:" the port will have to
     * skip past ':' to the value pointer it was passed in status_update()
     * for the BL_GOLD case.
     *
     * Another quirk of BL_GOLD is that the field display may have
     * changed if a new symbol set was loaded, or we entered or left
     * the rogue level.
     *
     * The currency prefix is encoded as ten character \GXXXXNNNN
     * sequence.
     */
    sprintf(gb.blstats[idx][BL_GOLD].val, _("%s:%lld"), (iflags.in_dumplog || iflags.invis_goldsym) ? _("$")
              : encglyph(objnum_to_glyph(GOLD_PIECE)), gb.blstats[idx][BL_GOLD].a.a_long)

;
    chars[gv.valset + BL_GOLD] = TRUE; /* indicate val already set */

    /* Power (magical energy) */
    gb.blstats[idx][BL_ENE].rawval.a_int = u.uen;
    gb.blstats[idx][BL_ENE].a.a_int = min(u.uen, 9999);
    gb.blstats[idx][BL_ENEMAX].rawval.a_int = u.uenmax;
    gb.blstats[idx][BL_ENEMAX].a.a_int = min(u.uenmax, 9999);

    /* Armor class */
    gb.blstats[idx][BL_AC].a.a_int = u.uac;

    /* Monster level (if Upolyd) */
    gb.blstats[idx][BL_HD].a.a_int = Upolyd() ? (mons[u.umonnum].mlevel) : 0;

    /* Experience */
    gb.blstats[idx][BL_XP].a.a_int = u.ulevel;
    gb.blstats[idx][BL_EXP].a.a_long = u.uexp;

    /* Time (moves) */
    gb.blstats[idx][BL_TIME].a.a_long = svm.moves;

    /* Hunger */
    /* note: u.uhs is unsigned, and 3.6.1's STATUS_HILITE defined
       BL_HUNGER to be ANY_UINT, but that was the only non-int/non-long
       numeric field so it's far simpler to treat it as plain int and
       not need ANY_UINT handling at all */
    gb.blstats[idx][BL_HUNGER].a.a_int = int(u.uhs);
    strcpy(gb.blstats[idx][BL_HUNGER].val, (u.uhs != NOT_HUNGRY) ? hu_stat[u.uhs] : _(""))
;
    chars[gv.valset + BL_HUNGER] = TRUE;

    /* Carrying capacity */
    cap = near_capacity();
    gb.blstats[idx][BL_CAP].a.a_int = cap;
    strcpy(gb.blstats[idx][BL_CAP].val, (cap > UNENCUMBERED) ? enc_stat[cap] : _(""))
;
    chars[gv.valset + BL_CAP] = TRUE;

    /* Version; unchanging unless player toggles 'showvers' option or
       modifies 'versinfo' option; toggling showvers off will clear it */
    if (gb.blstats[idx][BL_VERS].a.a_int != int(flags.versinfo)) {
        gb.blstats[idx][BL_VERS].a.a_int = int(flags.versinfo);
        chars[gv.valset + BL_VERS] = FALSE;
    }
    if (!chars[gv.valset + BL_VERS]) {
        status_version(gb.blstats[idx][BL_VERS].val,
                              unsigned(gb.blstats[idx][BL_VERS].valwidth), FALSE);
        chars[gv.valset + BL_VERS] = TRUE;
    }

    /* Conditions */

    gb.blstats[idx][BL_CONDITION].a.a_ulong = 0;

    /*
     * Avoid anything that does string comparisons in here because this
     * is called *extremely* often, for every screen update and the same
     * string comparisons would be repeated, thus contributing toward
     * performance degradation.  If it is essential that string comparisons
     * are needed for a particular condition, consider adding a caching
     * mechanism to limit the string comparisons to the first occurrence
     * for that cache lifetime.  There is caching of that nature done for
     * unconsc (1) and parlyz (2) because the suggested way of being able
     * to distinguish unconsc, parlyz, sleeping, and busy involves multiple
     * string comparisons.
     *
     * [Rebuttal:  it's called a lot for Windows and MS-DOS because their
     * sample run-time configuration file enables 'time' (move counter).
     * The optimization to bypass full status update when only 'time'
     * has changed (via timebot(), only effective for VIA_WINDOWPORT()
     * configurations) should ameliorate that.]
     */

    condtests[bl_foodpois].test = condtests[bl_termill].test = FALSE;
    if (Sick()) {
        if (condtests[(bl_foodpois)].enabled) condtests[(bl_foodpois)].test = +((u.usick_type & SICK_VOMITABLE) != 0);;
        if (condtests[(bl_termill)].enabled) condtests[(bl_termill)].test = +((u.usick_type & SICK_NONVOMITABLE) != 0);;
    }
    condtests[bl_inlava].test = condtests[bl_tethered].test
        = condtests[bl_trapped].test = FALSE;
    if (u.utrap) {
        if (condtests[(bl_inlava)].enabled) condtests[(bl_inlava)].test = +(u.utraptype == TT_LAVA);;
        if (condtests[(bl_tethered)].enabled) condtests[(bl_tethered)].test = +(u.utraptype == TT_BURIEDBALL);;
        /* if in-lava or tethered is disabled and the condition applies,
           lump it in with trapped */
        if (condtests[(bl_trapped)].enabled) condtests[(bl_trapped)].test = +(!condtests[bl_inlava].test
                                       && !condtests[bl_tethered].test);;
    }
    condtests[bl_grab].test = condtests[bl_held].test

        = condtests[bl_holding].test = FALSE;
    if (u.ustuck) {
        /* it is possible for a hero in sticks() form to be swallowed,
           so swallowed needs to be checked first; it is not possible for
           a hero in sticks() form to be held--sticky hero does the holding
           even if u.ustuck is also a holder */
        if (u.uswallow) {
            /* engulfed/swallowed isn't currently a tracked status condition;
               "held" might look odd for it but seems better than blank */

            if (condtests[(bl_held)].enabled) condtests[(bl_held)].test = TRUE;;
        } else if (Upolyd() && sticks(gy.youmonst.data)) {
            if (condtests[(bl_holding)].enabled) condtests[(bl_holding)].test = TRUE;;
        } else {
            /* grab == hero is held by sea monster and about to be drowned;
               held == hero is held by something else and can't move away */
            if (condtests[(bl_grab)].enabled) condtests[(bl_grab)].test = +(u.ustuck.data.mlet == S_EEL);;
            if (condtests[(bl_held)].enabled) condtests[(bl_held)].test = +!condtests[bl_grab].test;;
        }
    }
    condtests[bl_blind].test     = Blind() ? TRUE : FALSE;
    condtests[bl_conf].test      = Confusion() ? TRUE : FALSE;
    condtests[bl_deaf].test      = Deaf() ? TRUE : FALSE;
    condtests[bl_fly].test       = Flying() ? TRUE : FALSE;
    condtests[bl_glowhands].test = u.umconf ? TRUE : FALSE;
    condtests[bl_hallu].test     = Hallucination() ? TRUE : FALSE;
    condtests[bl_lev].test       = Levitation() ? TRUE : FALSE;
    condtests[bl_ride].test      = u.usteed ? TRUE : FALSE;
    condtests[bl_slime].test     = Slimed() ? TRUE : FALSE;
    condtests[bl_stone].test     = Stoned() ? TRUE : FALSE;
    condtests[bl_strngl].test    = Strangled() ? TRUE : FALSE;
    condtests[bl_stun].test      = Stunned() ? TRUE : FALSE;
    condtests[bl_submerged].test = Underwater() ? TRUE : FALSE;
    if (condtests[(bl_elf_iron)].enabled) condtests[(bl_elf_iron)].test = FALSE;;
    if (condtests[(bl_bareh)].enabled) condtests[(bl_bareh)].test = +(!uarmg && !uwep);;
    if (condtests[(bl_icy)].enabled) condtests[(bl_icy)].test = +(levl()[u.ux][u.uy].typ == ICE);;
    if (condtests[(bl_slippery)].enabled) condtests[(bl_slippery)].test = Glib() ? TRUE : FALSE;;
    if (condtests[(bl_woundedl)].enabled) condtests[(bl_woundedl)].test = Wounded_legs() ? TRUE : FALSE;;

    if (gm.multi < 0) {
        cond_cache_prepA();
        if (condtests[bl_unconsc].enabled
            && cache_nomovemsg[0] && !chars[cache_avail + 0]) {
                chars[cache_reslt + 0] = (!u.usleep && unconscious() ? 1 : 0);
                chars[cache_avail + 0] = TRUE;
        }
        if (condtests[bl_parlyz].enabled
            && cache_multi_reason[0] && !chars[cache_avail + 1]) {
                chars[cache_reslt + 1] = +(!strncmp(cache_multi_reason[0], _("paralyzed"), 9)
                                 || !strncmp(cache_multi_reason[0], _("frozen"), 6));
                chars[cache_avail + 1] = TRUE;
        }
        if (chars[cache_avail + 0] && chars[cache_reslt + 0]) {
            condtests[bl_unconsc].test = chars[cache_reslt + 0];
        } else if (chars[cache_avail + 1] && chars[cache_reslt + 1]) {
            condtests[bl_parlyz].test = chars[cache_reslt + 1];
        } else if (condtests[bl_sleeping].enabled && u.usleep) {
            condtests[bl_sleeping].test = TRUE;
        } else if (condtests[bl_busy].enabled) {
            condtests[bl_busy].test = TRUE;
        }
    } else {
        condtests[bl_unconsc].test = condtests[bl_parlyz].test =
            condtests[bl_sleeping].test = condtests[bl_busy].test = FALSE;
    }

    for (i = 0; i < CONDITION_COUNT; ++i) {
        if (condtests[i].enabled
             /* && i != bl_holding  */ /* uncomment to suppress UHold */
                && condtests[i].test)
            gb.blstats[idx][BL_CONDITION].a.a_ulong = or64u(gb.blstats[idx][BL_CONDITION].a.a_ulong, conditions[(i)].mask);
    }

    /*
     * Optionally displayed weapon(s), armor, and terrain.
     */
    if (flags.weaponstatus)
        weapon_status(gb.blstats[idx][BL_WEAPON].val);
    else
        chars[gb.blstats[idx][BL_WEAPON].val] = ord('\0');

    if (flags.armorstatus)
        armor_status(gb.blstats[idx][BL_ARMOR].val);
    else
        chars[gb.blstats[idx][BL_ARMOR].val] = ord('\0');

    if (flags.terrainstatus) {
        if (iflags.terrain_typ == MAX_TYPE)
            classify_terrain();
        i = iflags.terrain_typ;
        if (gb.blstats[idx][BL_TERRAIN].a.a_int != i) {
            strcpy(gb.blstats[idx][BL_TERRAIN].val, terrain_descr[i]);
            gb.blstats[idx][BL_TERRAIN].a.a_int = i;
        }
    } else {
        chars[gb.blstats[idx][BL_TERRAIN].val] = ord('\0');
        /* MAX_TYPE is "none of the above" for levl[][].typ */
        gb.blstats[idx][BL_TERRAIN].a.a_int = MAX_TYPE;
    }
    chars[gv.valset + BL_TERRAIN] = TRUE;

    /* now request rendering */
    evaluate_and_notify_windowport(gv.valset, idx);
    } finally { stack_pop($frame); }
}

/* update just the status lines' 'time' field */
function stat_update_time() { /* void */
    let idx = gn.now_or_before_idx; /* no 0/1 toggle */
    let fld = BL_TIME;

    /* Time (moves) */
    gb.blstats[idx][fld].a.a_long = svm.moves;
    chars[gv.valset + fld] = FALSE;

    eval_notify_windowport_field(fld, gv.valset, idx);
    if ((windowprocs.wincap2 & WC2_FLUSH_STATUS) != 0)
        status_update()(BL_FLUSH, 0, 0, 0,
                      NO_COLOR, null);
    return;
}

/* deal with player's choice to change processing of a condition */
export function condopt(idx, addr, negated) { /* void */
    let i;

    /* sanity check */
    if ((idx < 0 || idx >= CONDITION_COUNT)
        || (addr && addr != addr_of(ref_of(condtests[idx], "choice"))))
        return;

    if (!addr) {
        /* special: indicates a request to init so
           set the choice values to match the defaults */
        gc.condmenu_sortorder = 0;
        for (i = 0; i < CONDITION_COUNT; ++i) {
            cond_idx[i] = i;
            condtests[i].choice = condtests[i].enabled;
        }
        qsort(addr_of(cond_idx), CONDITION_COUNT,
              sizeof(int), cond_cmp);
    } else {
        /* (addr == &condtests[idx].choice) */
        condtests[idx].enabled = negated ? FALSE : TRUE;
        condtests[idx].choice = condtests[idx].enabled;
        /* avoid lingering false positives if test is no longer run */
        condtests[idx].test = FALSE;
    }
}

/* qsort callback routine for sorting the condition index */
function cond_cmp(vptr1, vptr2) { /* int QSORTCALLBACK */
    let indx1 = ref_to(int, vptr1)[0], indx2 = ref_to(int, vptr2)[0],
        c1 = conditions[indx1].ranking, c2 = conditions[indx2].ranking;

    if (c1 != c2)
        return c1 - c2;
    /* tie-breaker - visible alpha by name */
    return strcmpi(condtests[indx1].useroption, condtests[indx2].useroption);
}

/* qsort callback routine for alphabetical sorting of index */
function menualpha_cmp(vptr1, vptr2) { /* int QSORTCALLBACK */
    let indx1 = ref_to(int, vptr1)[0], indx2 = ref_to(int, vptr2)[0];

    return strcmpi(condtests[indx1].useroption, condtests[indx2].useroption);
}

export function parse_cond_option(negated, opts) { /* int */
    const $frame = stack_frame(); try {
    let i, sl;
    let compareto, uniqpart, prefix = init_string(stack_array(char, sizeof_string("cond_")), _("cond_"));

    if (!opts || strlen(opts) <= sizeof_string("cond_") - 1)
        return 2;
    uniqpart = opts + (sizeof_string("cond_") - 1);
    for (i = 0; i < CONDITION_COUNT; ++i) {
        compareto = condtests[i].useroption;
        sl = int(Strlen(compareto));
        if (match_optname(uniqpart, compareto, (sl >= 4) ? 4 : sl, FALSE)) {
            condopt(i, addr_of(ref_of(condtests[i], "choice")), negated);
            return 0;
        }
    }
    return 1;  /* !0 indicates error */
    } finally { stack_pop($frame); }
}

/* display a menu of all available status condition options and let player
   toggled them on or off; returns True iff any changes are made */
export function cond_menu() { /* boolean */
    const $frame = stack_frame(); try {
    let menutitle = static_array("cond_menu.menutitle", ptr_to(char), 2, [
        _("alphabetically"), _("by ranking")
    ]);
    let i, res, idx = 0;
    let sequence = stack_array(int, CONDITION_COUNT);
    let tmpwin;
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let mbuf = stack_array(char, QBUFSZ);
    let showmenu = TRUE;
    let clr = NO_COLOR;
    let changed = FALSE;

    do {
        for (i = 0; i < CONDITION_COUNT; ++i) {
            sequence[i] = i;
        }
        qsort(addr_of(sequence), CONDITION_COUNT,
              sizeof(int),
              gc.condmenu_sortorder ? cond_cmp : menualpha_cmp);

        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

        struct_assign(any, cg.zeroany);
        any.a_int = 1;
        sprintf(mbuf, _("change sort order from \"%s\" to \"%s\""), menutitle[gc.condmenu_sortorder], menutitle[1 - gc.condmenu_sortorder])

;
        add_menu(tmpwin, nul_glyphinfo, any, ord('S'), 0, ATR_NONE,
                 clr, mbuf, MENU_ITEMFLAGS_SKIPINVERT);
        struct_assign(any, cg.zeroany);
        sprintf(mbuf, _("sorted %s"), menutitle[gc.condmenu_sortorder]);
        add_menu_heading(tmpwin, mbuf);
        for (i = 0; i < SIZE(condtests); i++) {
            idx = sequence[i];
            sprintf(mbuf, _("cond_%-14s"), condtests[idx].useroption);
            struct_assign(any, cg.zeroany);
            any.a_int = idx + 2; /* avoid zero and the sort change pick */
            condtests[idx].choice = FALSE;
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE, clr, mbuf,
                     condtests[idx].enabled
                        ? MENU_ITEMFLAGS_SELECTED : MENU_ITEMFLAGS_NONE);
        }

        end_menu()(tmpwin, _("Choose status conditions to toggle"));

        res = select_menu(tmpwin, PICK_ANY, picks);
        destroy_nhwindow()(tmpwin);
        showmenu = FALSE;
        if (res > 0) {
            for (i = 0; i < res; i++) {
                idx = ptr_add(picks[0], i).item.a_int;
                if (idx == 1) {
                   /* sort change requested */
                   gc.condmenu_sortorder = 1 - gc.condmenu_sortorder;
                   showmenu = TRUE;
                   break;       /* for loop */
                } else {
                    idx -= 2;
                    condtests[idx].choice = TRUE;
                }
            }
            free(addr_of(picks[0]));
        }
    } while (showmenu);

    if (res >= 0) {
        for (i = 0; i < CONDITION_COUNT; ++i)
            if (condtests[i].enabled != condtests[i].choice) {
                condtests[i].enabled = condtests[i].choice;
                condtests[idx].test = FALSE;
                disp.botl = changed = TRUE;
            }
    }
    return changed;
    } finally { stack_pop($frame); }
}

/* called by all_options_conds() to get value for next cond_xyz option
   so that #saveoptions can collect it and write the set into new RC file.
   returns zero-length string if the option is the default value. */
export function opt_next_cond(indx, outbuf) { /* boolean */
    chars[outbuf] = ord('\0');
    if (indx >= CONDITION_COUNT)
        return FALSE;

    /*
     * The entries are returned in internal order which requires the
     * least code.  It would be easy to sort them into alphabetic order
     * (just sort all over again for every requested entry:
     *  int i, sequence[CONDITION_COUNT]
     *  for (i = 0; i < CONDITION_COUNT; ++i) sequence[i] = i;
     *  qsort(sequence, ..., menualpha_cmp);
     *  indx = sequence[indx];
     *  Sprintf(outbuf, ...);
     * with no need to hang on to 'sequence[]' between calls).
     *
     * But using 'severity order' isn't feasible unless the player has
     * used 'mO' on conditions in this session.  Even then, they would
     * revert to the default order (whether internal or alphabetical)
     * if #saveoptions got used in some later session where doset()
     * wasn't used to choose their preferred order.
     */

    if ((condtests[indx].opt == opt_in && condtests[indx].enabled)
        || (condtests[indx].opt == opt_out && !condtests[indx].enabled)) {
        sprintf(outbuf, _("%scond_%s"), condtests[indx].enabled ? _("") : _("!"), condtests[indx].useroption)
;
    }
    return TRUE;
}

function eval_notify_windowport_field(
    fld,
    valsetlist,
    idx) { /* boolean */
    const $frame = stack_frame(); try {
    let oldrndencode = static_var("eval_notify_windowport_field.oldrndencode", int, 0);
    let oldgoldsym = static_var("eval_notify_windowport_field.oldgoldsym", uchar, 0);
    let pc, chg, color = stack_var(int, NO_COLOR);
    let anytype;
    let updated = FALSE, reset;
    let curr, prev;
    let fldmax;

    /*
     *  Now pass the changed values to window port.
     */
    anytype = gb.blstats[idx][fld].anytype;
    curr = gb.blstats[idx][fld];
    prev = gb.blstats[1 - idx][fld];
    color[0] = NO_COLOR;

    chg = gu.update_all ? 0 : compare_blstats(prev, curr);
    /*
     * TODO:
     *  Dynamically update 'percent_matters' as rules are added or
     *  removed to track whether any of them are percentage rules.
     *  Then there'll be no need to assume that non-Null 'thresholds'
     *  means that percentages need to be kept up to date.
     *  [Affects exp_percent_changing() too.]
     */
    if (((chg || gu.update_all || fld == BL_XP)
         && curr.percent_matters

         && curr.thresholds

        )
        /* when 'hitpointbar' is On, percent matters even if HP
           hasn't changed and has no percentage rules (in case HPmax
           has changed when HP hasn't, where we ordinarily wouldn't
           update HP so would miss an update of the hitpoint bar) */
        || (fld == BL_HP && iflags.wc2_hitpointbar)) {
        fldmax = curr.idxmax;
        pc = (fldmax == BL_EXP) ? exp_percentage()
              : (fldmax >= 0 && fldmax < MAXBLSTATS)
                 ? percentage(curr, gb.blstats[idx][fldmax])
                 : 0; /* bullet proofing; can't get here */
        if (pc != prev.percent_value)
            chg = (pc < prev.percent_value) ? -1 : 1;
        curr.percent_value = pc;
    } else {
        pc = 0;
    }

    /* Temporary? hack: moveloop()'s prolog for a new game sets
     * svc.context.rndencode after the status window has been init'd,
     * so $:0 has already been encoded and cached by the window
     * port.  Without this hack, gold's \G sequence won't be
     * recognized and ends up being displayed as-is for 'gu.update_all'.
     *
     * Also, even if svc.context.rndencode hasn't changed and the
     * gold amount itself hasn't changed, the glyph portion of the
     * encoding may have changed if a new symset was put into effect.
     *
     *  \GXXXXNNNN:25
     *  XXXX = the svc.context.rndencode portion
     *  NNNN = the glyph portion
     *  25   = the gold amount
     *
     * Setting 'chg = 2' is enough to render the field properly, but
     * not to honor an initial highlight, so force 'gu.update_all = TRUE'.
     */
    if (fld == BL_GOLD
        && (svc.context.rndencode != oldrndencode[0]
            || uchars[gs.showsyms + (COIN_CLASS + SYM_OFF_O)] != oldgoldsym[0])) {
        gu.update_all = TRUE; /* chg = 2; */
        oldrndencode[0] = svc.context.rndencode;
        oldgoldsym[0] = uchars[gs.showsyms + (COIN_CLASS + SYM_OFF_O)];
    }

    reset = FALSE;

    if (gu.update_all) {
        chg = 0;
        curr.time = prev.time = 0;
    } else if (!chg && curr.time) {
        reset = hilite_reset_needed(prev, gb.bl_hilite_moves);
        if (reset)
            curr.time = prev.time = 0;
    }

   if (gu.update_all || chg || reset) {
        if (!chars[valsetlist + fld])
            anything_to_s(curr.val, curr.a, int(anytype));

        if (anytype != ANY_MASK32) {
            if (chg || chars[curr.val]) {
                /* if Xp percentage changed, we set 'chg' to 1 above;
                   reset that if the Xp value hasn't actually changed
                   or possibly went down rather than up (level loss) */
                if (chg == 1 && fld == BL_XP)
                    chg = compare_blstats(prev, curr);

                curr.hilite_rule = get_hilite(idx, fld,
                                               addr_of(curr.a),
                                               chg, pc, color);
                prev.hilite_rule = curr.hilite_rule;
                if (chg == 2) {
                    color[0] = NO_COLOR;
                    chg = 0;
                }
            }

            status_update()(fld, curr.val,
                          chg, pc, color[0], null);
        } else {
            /* Color for conditions is done through gc.cond_hilites[] */
            status_update()(fld, addr_of(ref_of(curr.a, "a_ulong")),
                          chg, pc, color[0], gc.cond_hilites);
        }
        curr.chg = prev.chg = TRUE;
        updated = TRUE;
    }
    return updated;
    } finally { stack_pop($frame); }
}

function evaluate_and_notify_windowport(
    valsetlist,
    idx) { /* void */
    let i, fld, updated = 0;

    /*
     *  Now pass the changed values to window port.
     */
    for (i = 0; i < MAXBLSTATS; i++) {
        fld = initblstats[i].fld;
        if (((fld == BL_SCORE) && !flags.showscore)
            || ((fld == BL_EXP) && !flags.showexp)
            || ((fld == BL_TIME) && !flags.time)
            || ((fld == BL_HD) && !Upolyd())
            || ((fld == BL_XP || fld == BL_EXP) && Upolyd())
            || ((fld == BL_VERS) && !flags.showvers)
            || ((fld == BL_TERRAIN) && !flags.terrainstatus)
            || ((fld == BL_WEAPON) && !flags.weaponstatus)
            || ((fld == BL_ARMOR) && !flags.armorstatus)
            ) {
            continue;
        }
        if (eval_notify_windowport_field(fld, valsetlist, idx))
            updated++;
    }
    /*
     * Notes:
     *  1. It is possible to get here, with nothing having been pushed
     *     to the window port, when none of the info has changed.
     *
     *  2. Some window ports are also known to optimize by only drawing
     *     fields that have changed since the previous update.
     *
     * In both of those situations, we need to force updates to
     * all of the fields when disp.botlx is set. The tty port in
     * particular has a problem if that isn't done, since the core sets
     * disp.botlx when a menu or text display obliterates the status
     * line.
     *
     * For those situations, to trigger the full update of every field
     * whether changed or not, call status_update() with BL_RESET.
     *
     * For regular processing and to notify the window port that a
     * bot() round has finished and it's time to trigger a flush of
     * all buffered changes received thus far but not reflected in
     * the display, call status_update() with BL_FLUSH.
     *
     */
    if (disp.botlx && (windowprocs.wincap2 & WC2_RESET_STATUS) != 0)
        status_update()(BL_RESET, 0, 0, 0,
                      NO_COLOR, null);
    else if ((updated || disp.botlx)
             && (windowprocs.wincap2 & WC2_FLUSH_STATUS) != 0)
        status_update()(BL_FLUSH, 0, 0, 0,
                      NO_COLOR, null);

    disp.botl = disp.botlx = disp.time_botl = FALSE;
    gu.update_all = FALSE;
}

export function status_initialize(
    reassessment) { /* void */ /* True: just recheck fields without other init */
    let fld;
    let fldenabl;
    let i;
    let fieldfmt, fieldname;

    if (!reassessment) {
        if (gb.blinit)
            impossible(_("2nd status_initialize with full init."));
        init_blstats();
        windowprocs.win_status_init();
        gb.blinit = TRUE;
    } else if (!gb.blinit) {
        panic(_("status 'reassess' before init"));
    }
    for (i = 0; i < MAXBLSTATS; ++i) {
        fld = initblstats[i].fld;
        fldenabl = (fld == BL_SCORE) ? flags.showscore
                   : (fld == BL_TIME) ? flags.time
                     : (fld == BL_EXP) ? (flags.showexp && !Upolyd() ? 1 : 0)
                       : (fld == BL_XP) ? (+!Upolyd())
                         : (fld == BL_HD) ? Upolyd()
                           : (fld == BL_VERS) ? flags.showvers
                             : (fld == BL_WEAPON) ? flags.weaponstatus
                               : (fld == BL_ARMOR) ? flags.armorstatus
                                 : (fld == BL_TERRAIN) ? flags.terrainstatus
                                   : TRUE;

        fieldname = initblstats[i].fldname;
        fieldfmt = (fld == BL_TITLE && iflags.wc2_hitpointbar) ? _("%-30.30s")
                   : initblstats[i].fldfmt;
        status_enablefield()(fld, fieldname, fieldfmt, fldenabl);
    }
    gu.update_all = TRUE;
    disp.botlx = TRUE;
}

export function status_finish() { /* void */
    let i;

    /* call the window port cleanup routine first */
    if (windowprocs.win_status_finish)
        windowprocs.win_status_finish();

    /* free memory that we alloc'd now */
    for (i = 0; i < MAXBLSTATS; ++i) {
        if (gb.blstats[0][i].val)
            free((gb.blstats[0][i].val)),
                gb.blstats[0][i].val = (0);
        if (gb.blstats[1][i].val)
            free((gb.blstats[1][i].val)),
                gb.blstats[1][i].val = (0);

        /* pointer to an entry in thresholds list; Null it out since
           that list is about to go away */
        gb.blstats[0][i].hilite_rule = gb.blstats[1][i].hilite_rule = null;
        if (gb.blstats[0][i].thresholds) {
            let temp, next;

            for (temp = gb.blstats[0][i].thresholds; temp; temp = next) {
                next = temp.next;
                free(addr_of(temp));
            }
            gb.blstats[0][i].thresholds
                = gb.blstats[1][i].thresholds
                    = null;
        }
    }
}

function init_blstats() { /* void */
    let initalready = static_var("init_blstats.initalready", schar, FALSE);
    let i, j;

    if (initalready[0]) {
        impossible(_("init_blstats called more than once."));
        return;
    }
    for (i = 0; i <= 1; ++i) {
        for (j = 0; j < MAXBLSTATS; ++j) {
            let keep_hilite_chain = gb.blstats[i][j].thresholds;

            struct_assign(gb.blstats[i][j], initblstats[j]);
            struct_assign(gb.blstats[i][j].a, cg.zeroany);
            if (gb.blstats[i][j].valwidth) {
                gb.blstats[i][j].val
                    = addr_of(alloc(unsigned(gb.blstats[i][j].valwidth)));
                chars[gb.blstats[i][j].val + 0] = ord('\0');
            } else
                gb.blstats[i][j].val = 0;

            gb.blstats[i][j].thresholds = keep_hilite_chain;
        }
    }
    initalready[0] = TRUE;
}

/*
 * This compares the previous stat with the current stat,
 * and returns one of the following results based on that:
 *
 *   if prev_value < new_value (stat went up, increased)
 *      return 1
 *
 *   if prev_value > new_value (stat went down, decreased)
 *      return  -1
 *
 *   if prev_value == new_value (stat stayed the same)
 *      return 0
 *
 *   Special cases:
 *     - for bitmasks, 0 = stayed the same, 1 = changed
 *     - for strings,  0 = stayed the same, 1 = changed
 *
 */
function compare_blstats(bl1, bl2) { /* int */
    let a1, a2;
    let use_rawval;
    let anytype, fld, result = 0;

    if (!bl1 || !bl2) {
        panic(_("compare_blstat: bad istat pointer %s, %s"),
              fmt_ptr(addr_of(bl1)), fmt_ptr(addr_of(bl2)));
    }

    anytype = int(bl1.anytype);
    if ((!bl1.a.a_void || !bl2.a.a_void)
        && (anytype == ANY_IPTR || anytype == ANY_UPTR
            || anytype == ANY_LPTR || anytype == ANY_ULPTR)) {
        panic(_("compare_blstat: invalid pointer %s, %s"),
              fmt_ptr(bl1.a.a_void),
              fmt_ptr(bl2.a.a_void));
    }
    /* cheat; terrain is highlighted as a string but we have a handy int
       reflecting its value to use when checking for changes */
    if (bl1.fld == BL_TERRAIN)
        anytype = ANY_INT;

    fld = bl1.fld;
    use_rawval = +(fld == BL_HP || fld == BL_HPMAX
                  || fld == BL_ENE || fld == BL_ENEMAX
                  || fld == BL_GOLD);
    a1 = use_rawval ? bl1.rawval : bl1.a;
    a2 = use_rawval ? bl2.rawval : bl2.a;

    switch (anytype) {
    case ANY_INT:
        result = (a1.a_int < a2.a_int) ? 1
                     : (a1.a_int > a2.a_int) ? -1 : 0;
        break;
    case ANY_IPTR:
        result = (a1.a_iptr[0] < a2.a_iptr[0]) ? 1
                     : (a1.a_iptr[0] > a2.a_iptr[0]) ? -1 : 0;
        break;
    case ANY_LONG:
        result = (a1.a_long < a2.a_long) ? 1
                     : (a1.a_long > a2.a_long) ? -1 : 0;
        break;
    case ANY_LPTR:
        result = (a1.a_lptr[0] < a2.a_lptr[0]) ? 1
                     : (a1.a_lptr[0] > a2.a_lptr[0]) ? -1 : 0;
        break;
    case ANY_UINT:
        result = (a1.a_uint < a2.a_uint) ? 1
                     : (a1.a_uint > a2.a_uint) ? -1 : 0;
        break;
    case ANY_UPTR:
        result = (a1.a_uptr[0] < a2.a_uptr[0]) ? 1
                     : (a1.a_uptr[0] > a2.a_uptr[0]) ? -1 : 0;
        break;
    case ANY_ULONG:
        result = (a1.a_ulong < a2.a_ulong) ? 1
                     : (a1.a_ulong > a2.a_ulong) ? -1 : 0;
        break;
    case ANY_ULPTR:
        result = (a1.a_ulptr[0] < a2.a_ulptr[0]) ? 1
                     : (a1.a_ulptr[0] > a2.a_ulptr[0]) ? -1 : 0;
        break;
    case ANY_STR:
        result = sgn(strcmp(bl1.val, bl2.val));
        break;
    case ANY_MASK32:
        result = +(a1.a_ulong != a2.a_ulong);
        break;
    default:
        result = 1;
    }
    return result;
}

function anything_to_s(buf, a, anytype) { /* char * */
    if (!buf)
        return 0;

    switch (anytype) {
    case ANY_ULONG:
        sprintf(buf, _("%llu"), a.a_ulong);
        break;
    case ANY_MASK32:
        sprintf(buf, _("%llx"), a.a_ulong);
        break;
    case ANY_LONG:
        sprintf(buf, _("%lld"), a.a_long);
        break;
    case ANY_INT:
        sprintf(buf, _("%d"), a.a_int);
        break;
    case ANY_UINT:
        sprintf(buf, _("%u"), a.a_uint);
        break;
    case ANY_IPTR:
        sprintf(buf, _("%d"), a.a_iptr[0]);
        break;
    case ANY_LPTR:
        sprintf(buf, _("%lld"), a.a_lptr[0]);
        break;
    case ANY_ULPTR:
        sprintf(buf, _("%llu"), a.a_ulptr[0]);
        break;
    case ANY_UPTR:
        sprintf(buf, _("%u"), a.a_uptr[0]);
        break;
    case ANY_STR: /* do nothing */
        ;
        break;
    default:
        chars[buf + 0] = ord('\0');
    }
    return buf;
}

function s_to_anything(a, buf, anytype) { /* void */
    if (!buf || !a)
        return;

    switch (anytype) {
    case ANY_LONG:
        a.a_long = atoll(buf);
        break;
    case ANY_INT:
        a.a_int = atoi(buf);
        break;
    case ANY_UINT:
        a.a_uint = unsigned(atoi(buf));
        break;
    case ANY_ULONG:
        a.a_ulong = ulong(atoll(buf));
        break;
    case ANY_IPTR:
        if (a.a_iptr)
            a.a_iptr[0] = atoi(buf);
        break;
    case ANY_UPTR:
        if (a.a_uptr)
            a.a_uptr[0] = unsigned(atoi(buf));
        break;
    case ANY_LPTR:
        if (a.a_lptr)
            a.a_lptr[0] = atoll(buf);
        break;
    case ANY_ULPTR:
        if (a.a_ulptr)
            a.a_ulptr[0] = ulong(atoll(buf));
        break;
    case ANY_MASK32:
        a.a_ulong = ulong(atoll(buf));
        break;
    default:
        a.a_void = 0;
        break;
    }
    return;
}

/* integer percentage is 100 * bl->a / maxbl->a */
function percentage(bl, maxbl) { /* int */
    let result = 0;
    let anytype;
    let ival, mval;
    let lval;
    let uval;
    let ulval;
    let fld;
    let use_rawval;

    if (!bl || !maxbl) {
        impossible(_("percentage: bad istat pointer %s, %s"),
                   fmt_ptr(addr_of(bl)), fmt_ptr(addr_of(maxbl)));
        return 0;
    }

    fld = bl.fld;
    use_rawval = +(fld == BL_HP || fld == BL_ENE);
    ival = 0, lval = 0, uval = 0, ulval = 0;
    anytype = int(bl.anytype);
    if (maxbl.a.a_void) {
        switch (anytype) {
        case ANY_INT:
            /* HP and energy are int so this is the only case that cares
               about 'rawval'; for them, we use that rather than their
               potentially truncated (to 9999) display value */
            ival = use_rawval ? bl.rawval.a_int : bl.a.a_int;
            mval = use_rawval ? maxbl.rawval.a_int : maxbl.a.a_int;
            result = Math.trunc((100 * ival) / mval);
            break;
        case ANY_LONG:
            lval  = bl.a.a_long;
            result = int(Math.trunc((100 * lval) / maxbl.a.a_long));
            break;
        case ANY_UINT:
            uval = bl.a.a_uint;
            result = int(Math.trunc(unsigned(Math.imul(100, uval)) / maxbl.a.a_uint));
            break;
        case ANY_ULONG:
            ulval = bl.a.a_ulong;
            result = int(Math.trunc((100 * ulval) / maxbl.a.a_ulong));
            break;
        case ANY_IPTR:
            ival = bl.a.a_iptr[0];
            result = Math.trunc((100 * ival) / (maxbl.a.a_iptr[0]));
            break;
        case ANY_LPTR:
            lval = bl.a.a_lptr[0];
            result = int(Math.trunc((100 * lval) / (maxbl.a.a_lptr[0])));
            break;
        case ANY_UPTR:
            uval = bl.a.a_uptr[0];
            result = int(Math.trunc(unsigned(Math.imul(100, uval)) / (maxbl.a.a_uptr[0])));
            break;
        case ANY_ULPTR:
            ulval = bl.a.a_ulptr[0];
            result = int(Math.trunc((100 * ulval) / (maxbl.a.a_ulptr[0])));
            break;
        }
    }
    /* don't let truncation from integer division produce a zero result
       from a non-zero input; note: if we ever change to something like
       ((((1000 * val) / max) + 5) / 10) for a rounded result, we'll
       also need to check for and convert false 100 to 99 */
    if (result == 0
        && (ival != 0 || lval != 0 || uval != 0 || ulval != 0))
        result = 1;

    return result;
}

/* percentage for both xp (level) and exp (points) is the percentage for
   (curr_exp - this_level_start) in (next_level_start - this_level_start) */
function exp_percentage() { /* int */
    const $frame = stack_frame(); try {
    let res = 0;

    if (u.ulevel < 30) {
        let exp_val, nxt_exp_val, curlvlstart;

        curlvlstart = newuexp(u.ulevel - 1);
        exp_val = u.uexp - curlvlstart;
        nxt_exp_val = newuexp(u.ulevel) - curlvlstart;
        if (exp_val == nxt_exp_val - 1) {
            /*
             * Full 100% is unattainable since hero gains a level
             * and the threshold for next level increases, but treat
             * (next_level_start - 1 point) as a special case.  It's a
             * key value after being level drained so is something that
             * some players would like to be able to highlight distinctly.
             */
            res = 100;
        } else {
            let curval = stack_struct(struct_istat_s), maxval = stack_struct(struct_istat_s);

            curval.anytype = maxval.anytype = ANY_LONG;
            struct_assign(curval.a, struct_assign(maxval.a, cg.zeroany));
            curval.a.a_long = exp_val;
            maxval.a.a_long = nxt_exp_val;
            curval.fld = maxval.fld = BL_EXP; /* (neither BL_HP nor BL_ENE) */
            /* maximum delta between levels is 10000000; calculation of
               100 * (10000000 - N) / 10000000 fits within 32-bit long */
            res = percentage(curval, maxval);
        }
    }
    return res;
    } finally { stack_pop($frame); }
}

/* experience points have changed but experience level hasn't; decide whether
   botl update is needed for a different percentage highlight rule for Xp */
export function exp_percent_changing() { /* boolean */
    const $frame = stack_frame(); try {
    let pc;
    let a = stack_struct(struct_any);

    let color_dummy = stack_var(int);
    let rule;

    let curr;

    /* if status update is already requested, skip this processing */
    if (!disp.botl) {
        /*
         * Status update is warranted iff percent integer changes and the new
         * percentage results in a different highlighting rule being selected.
         */
        curr = gb.blstats[gn.now_or_before_idx][BL_XP];
        /* TODO: [see eval_notify_windowport_field() about percent_matters
           and the check against 'thresholds'] */
        if (curr.percent_matters

            && curr.thresholds

            && (pc = exp_percentage()) != curr.percent_value) {
            struct_assign(a, cg.zeroany);
            a.a_int = u.ulevel;

            rule = get_hilite(gn.now_or_before_idx, BL_XP,
                              addr_of(a), 0, pc, color_dummy);
            if (rule != curr.hilite_rule)
                return TRUE; /* caller should set 'disp.botl' to True */
        }
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* callback so that interface can get capacity index rather than trying
   to reconstruct that from the encumbrance string or asking the general
   core what the value is */
export function stat_cap_indx() { /* int */
    let cap;

    cap = gb.blstats[gn.now_or_before_idx][BL_CAP].a.a_int;

    return cap;
}

/* callback so that interface can get hunger index rather than trying to
   reconstruct that from the hunger string or dipping into core internals */
export function stat_hunger_indx() { /* int */
    let uhs;

    uhs = gb.blstats[gn.now_or_before_idx][BL_HUNGER].a.a_int;

    return uhs;
}

/* used by X11 for "tty status" even when STATUS_HILITES is disabled */
export function bl_idx_to_fldname(idx) { /* const char * */
    if (idx >= 0 && idx < MAXBLSTATS)
        return initblstats[idx].fldname;
    return 0;
}

/* used when rendering hitpointbar; inoutbuf[] has been padded with
   trailing spaces; replace pairs of spaces with pairs of space+dash */
export function repad_with_dashes(inoutbuf) { /* void */
    let p = eos(inoutbuf);

    while (p >= inoutbuf + 2 && chars[p + (-1)] == ord(' ') && chars[p + (-2)] == ord(' ')) {
        chars[p + (-1)] = ord('-');
        p -= 2;
    }
}

/****************************************************************************/
/* Core status hiliting support */
/****************************************************************************/

  const struct_fieldid_t = struct("struct_fieldid_t", {
    fieldname: ptr_to(char),
    fldid: int,
}); const fieldids_alias = static_array("fieldids_alias", struct_fieldid_t, null, [
    { fieldname: _("characteristics"),   fldid: BL_CHARACTERISTICS },
    { fieldname: _("encumbrance"),       fldid: BL_CAP },
    { fieldname: _("experience-points"), fldid: BL_EXP },
    { fieldname: _("dx"),       fldid: BL_DX },
    { fieldname: _("co"),       fldid: BL_CO },
    { fieldname: _("con"),      fldid: BL_CO },
    { fieldname: _("points"),   fldid: BL_SCORE },
    { fieldname: _("cap"),      fldid: BL_CAP },
    { fieldname: _("pw"),       fldid: BL_ENE },
    { fieldname: _("pw-max"),   fldid: BL_ENEMAX },
    { fieldname: _("xl"),       fldid: BL_XP },
    { fieldname: _("xplvl"),    fldid: BL_XP },
    { fieldname: _("ac"),       fldid: BL_AC },
    { fieldname: _("hit-dice"), fldid: BL_HD },
    { fieldname: _("turns"),    fldid: BL_TIME },
    { fieldname: _("hp"),       fldid: BL_HP },
    { fieldname: _("hp-max"),   fldid: BL_HPMAX },
    { fieldname: _("dgn"),      fldid: BL_LEVELDESC },
    { fieldname: _("xp"),       fldid: BL_EXP },
    { fieldname: _("exp"),      fldid: BL_EXP },
    { fieldname: _("flags"),    fldid: BL_CONDITION },
    { fieldname: 0,       fldid: BL_FLUSH }
]);

/* format arguments */
const threshold_value = init_string(static_array("threshold_value", char, sizeof_string("hilite_status threshold ")), _("hilite_status threshold "), true);
const is_out_of_range = init_string(static_array("is_out_of_range", char, sizeof_string(" is out of range")), _(" is out of range"), true);

/* field name to bottom line index */
function fldname_to_bl_indx(name) { /* enum statusfields */
    let i, nmatches = 0, fld = 0;

    if (name && chars[name]) {
        /* check matches to canonical names */
        for (i = 0; i < SIZE(initblstats); i++)
            if (fuzzymatch(initblstats[i].fldname, name, _(" -_"), TRUE)) {
                fld = initblstats[i].fld;
                nmatches++;
            }
        if (!nmatches) {
            /* check aliases */
            for (i = 0; fieldids_alias[i].fieldname; i++)
                if (fuzzymatch(fieldids_alias[i].fieldname, name,
                               _(" -_"), TRUE)) {
                    fld = fieldids_alias[i].fldid;
                    nmatches++;
                }
        }
        if (!nmatches) {
            /* check partial matches to canonical names */
            let len = int(strlen(name));

            for (i = 0; i < SIZE(initblstats); i++)
                if (!strncmpi(name, initblstats[i].fldname, len)) {
                    fld = initblstats[i].fld;
                    nmatches++;
                }
        }
    }
    return (nmatches == 1) ? fld : BL_FLUSH;
}

function hilite_reset_needed(
    bl_p,
    augmented_time) { /* boolean */ /* no longer augmented; it once encoded fractional * amounts for multiple moves within same turn */
    /*
     * This 'multi' handling may need some tuning...
     */
    if (gm.multi)
        return FALSE;

    if (!Is_Temp_Hilite(bl_p.hilite_rule))
        return FALSE;

    if (bl_p.time == 0 || bl_p.time >= augmented_time)
        return FALSE;

    return TRUE;
}

/* called from moveloop(); sets context.botl if temp hilites have timed out */
export function status_eval_next_unhilite() { /* void */
    let i;
    let curr;
    let next_unhilite, this_unhilite;

    gb.bl_hilite_moves = svm.moves; /* simplified; at one point we used to
                                     * try to encode fractional amounts for
                                     * multiple moves within same turn */
    /* figure out whether an unhilight needs to be performed now */
    next_unhilite = 0;
    for (i = 0; i < MAXBLSTATS; ++i) {
        curr = gb.blstats[0][i]; /* blstats[0][*].time==blstats[1][*].time */

        if (curr.chg) {
            let prev = gb.blstats[1][i];

            if (Is_Temp_Hilite(curr.hilite_rule))
                curr.time = (gb.bl_hilite_moves + iflags.hilite_delta);
            else
                curr.time = 0;
            prev.time = curr.time;

            curr.chg = prev.chg = FALSE;
            disp.botl = TRUE;
        }
        if (disp.botl)
            continue; /* just process other gb.blstats[][].time and .chg */

        this_unhilite = curr.time;
        if (this_unhilite > 0
            && (next_unhilite == 0 || this_unhilite < next_unhilite)
            && hilite_reset_needed(curr, this_unhilite + 1)) {
            next_unhilite = this_unhilite;
            if (next_unhilite < gb.bl_hilite_moves)
                disp.botl = TRUE;
        }
    }
}

/* called by options handling when 'statushilites' value is changed */
export function reset_status_hilites() { /* void */
    if (iflags.hilite_delta) {
        let i;

        for (i = 0; i < MAXBLSTATS; ++i)
            gb.blstats[0][i].time = gb.blstats[1][i].time = 0;
        gu.update_all = TRUE;
    }
    disp.botlx = TRUE;
}

/* test whether the text from a title rule matches the string for
   title-while-polymorphed in the 'textmatch' menu */
function noneoftheabove(hl_text) { /* boolean */
    if (fuzzymatch(hl_text, _("none of the above"), _("\" -_"), TRUE)
        || fuzzymatch(hl_text, _("(polymorphed)"), _("\"()"), TRUE)
        || fuzzymatch(hl_text, _("none of the above (polymorphed)"),
                      _("\" -_()"), TRUE))
        return TRUE;
    return FALSE;
}

/*
 * get_hilite
 *
 * Returns, based on the value and the direction it is moving,
 * the highlight rule that applies to the specified field.
 *
 * Provide get_hilite() with the following to work with:
 *     actual value vp
 *          useful for BL_TH_VAL_ABSOLUTE
 *     indicator of down, up, or the same (-1, 1, 0) chg
 *          useful for BL_TH_UPDOWN or change detection
 *     percentage (current value percentage of max value) pc
 *          useful for BL_TH_VAL_PERCENTAGE
 *
 * Get back:
 *     pointer to rule that applies; Null if no rule does.
 */
function get_hilite(
    idx, fldidx,
    vp,
    chg, pc,
    colorptr) { /* struct hilite_s * */
    let hl, rule = null;
    let value = view_of(struct_any, vp);
    let txtstr;

    if (fldidx < 0 || fldidx >= MAXBLSTATS)
        return null;

    if (has_hilite(fldidx)) {
        let dt;
        /* there are hilites set here */
        let max_pc = -1, min_pc = 101;
        /* LARGEST_INT isn't INT_MAX; it fits within 16 bits, but that
           value is big enough to handle all 'int' status fields */
        let max_ival = -LARGEST_INT, min_ival = LARGEST_INT;
        /* LONG_MAX comes from <limits.h> which might not be available for
           ancient configurations; we don't need LONG_MIN */
        let max_lval = -LLONG_MAX, min_lval = LLONG_MAX;
        let exactmatch = FALSE, updown = FALSE, changed = FALSE,
                perc_or_abs = FALSE, crit_hp = FALSE;

        /* min_/max_ are used to track best fit */
        for (hl = gb.blstats[0][fldidx].thresholds; hl; hl = hl.next) {
            dt = int(initblstats[fldidx].anytype); /* only needed for 'absolute' */
            /* for HP, if we already have a critical-hp rule then we ignore
               other HP rules unless we hit another critical-hp one (last
               one found wins); critical-hp takes precedence over temporary
               HP highlights, otherwise a hero with regeneration and an up
               or changed rule for HP would always show that up or changed
               highlight even when within the critical-hp threshold because
               the value will go up by at least one on every move */
            if (crit_hp && hl.behavior != BL_TH_CRITICALHP)
                continue;
            /* if we've already matched a temporary highlight, it takes
               precedence over all persistent ones; we still process
               updown rules to get the last one which qualifies */
            if ((updown || changed) && hl.behavior != BL_TH_UPDOWN)
                continue;
            /* among persistent highlights, if a 'percentage' or 'absolute'
               rule has been matched, it takes precedence over 'always' */
            if (perc_or_abs && hl.behavior == BL_TH_ALWAYS_HILITE)
                continue;

            switch (hl.behavior) {
            case BL_TH_VAL_PERCENTAGE: /* percent values are always ANY_INT */
                if (hl.rel == EQ_VALUE && pc == hl.value.a_int) {
                    rule = hl;
                    min_pc = max_pc = hl.value.a_int;
                    exactmatch = perc_or_abs = TRUE;
                } else if (exactmatch) {
                    ; /* already found best fit, skip lt,ge,&c */
                } else if (hl.rel == LT_VALUE
                           && (pc < hl.value.a_int)
                           && (hl.value.a_int <= min_pc)) {
                    rule = hl;
                    min_pc = hl.value.a_int;
                    perc_or_abs = TRUE;
                } else if (hl.rel == LE_VALUE
                           && (pc <= hl.value.a_int)
                           && (hl.value.a_int <= min_pc)) {
                    rule = hl;
                    min_pc = hl.value.a_int;
                    perc_or_abs = TRUE;
                } else if (hl.rel == GT_VALUE
                           && (pc > hl.value.a_int)
                           && (hl.value.a_int >= max_pc)) {
                    rule = hl;
                    max_pc = hl.value.a_int;
                    perc_or_abs = TRUE;
                } else if (hl.rel == GE_VALUE
                           && (pc >= hl.value.a_int)
                           && (hl.value.a_int >= max_pc)) {
                    rule = hl;
                    max_pc = hl.value.a_int;
                    perc_or_abs = TRUE;
                }
                break;
            case BL_TH_UPDOWN: /* uses 'chg' (set by caller), not 'dt' */
                /* specific 'up' or 'down' takes precedence over general
                   'changed' regardless of their order in the rule set */
                if (chg < 0 && hl.rel == LT_VALUE) {
                    rule = hl;
                    updown = TRUE;
                } else if (chg > 0 && hl.rel == GT_VALUE) {
                    rule = hl;
                    updown = TRUE;
                } else if (chg != 0 && hl.rel == EQ_VALUE && !updown) {
                    rule = hl;
                    changed = TRUE;
                }
                break;
            case BL_TH_VAL_ABSOLUTE: /* either ANY_INT or ANY_LONG */
                /*
                 * The int and long variations here are identical aside from
                 * union field and min_/max_ variable names.  If you change
                 * one, be sure to make a corresponding change in the other.
                 */
                if (dt == ANY_INT) {
                    if (hl.rel == EQ_VALUE
                        && hl.value.a_int == value.a_int) {
                        rule = hl;
                        min_ival = max_ival = hl.value.a_int;
                        exactmatch = perc_or_abs = TRUE;
                    } else if (exactmatch) {
                        ; /* already found best fit, skip lt,ge,&c */
                    } else if (hl.rel == LT_VALUE
                               && (value.a_int < hl.value.a_int)
                               && (hl.value.a_int <= min_ival)) {
                        rule = hl;
                        min_ival = hl.value.a_int;
                        perc_or_abs = TRUE;
                    } else if (hl.rel == LE_VALUE
                               && (value.a_int <= hl.value.a_int)
                               && (hl.value.a_int <= min_ival)) {
                        rule = hl;
                        min_ival = hl.value.a_int;
                        perc_or_abs = TRUE;
                    } else if (hl.rel == GT_VALUE
                               && (value.a_int > hl.value.a_int)
                               && (hl.value.a_int >= max_ival)) {
                        rule = hl;
                        max_ival = hl.value.a_int;
                        perc_or_abs = TRUE;
                    } else if (hl.rel == GE_VALUE
                               && (value.a_int >= hl.value.a_int)
                               && (hl.value.a_int >= max_ival)) {
                        rule = hl;
                        max_ival = hl.value.a_int;
                        perc_or_abs = TRUE;
                    }
                } else { /* ANY_LONG */
                    if (hl.rel == EQ_VALUE
                        && hl.value.a_long == value.a_long) {
                        rule = hl;
                        min_lval = max_lval = hl.value.a_long;
                        exactmatch = perc_or_abs = TRUE;
                    } else if (exactmatch) {
                        ; /* already found best fit, skip lt,ge,&c */
                    } else if (hl.rel == LT_VALUE
                               && (value.a_long < hl.value.a_long)
                               && (hl.value.a_long <= min_lval)) {
                        rule = hl;
                        min_lval = hl.value.a_long;
                        perc_or_abs = TRUE;
                    } else if (hl.rel == LE_VALUE
                               && (value.a_long <= hl.value.a_long)
                               && (hl.value.a_long <= min_lval)) {
                        rule = hl;
                        min_lval = hl.value.a_long;
                        perc_or_abs = TRUE;
                    } else if (hl.rel == GT_VALUE
                               && (value.a_long > hl.value.a_long)
                               && (hl.value.a_long >= max_lval)) {
                        rule = hl;
                        max_lval = hl.value.a_long;
                        perc_or_abs = TRUE;
                    } else if (hl.rel == GE_VALUE
                               && (value.a_long >= hl.value.a_long)
                               && (hl.value.a_long >= max_lval)) {
                        rule = hl;
                        max_lval = hl.value.a_long;
                        perc_or_abs = TRUE;
                    }
                }
                break;
            case BL_TH_TEXTMATCH: /* ANY_STR */
                txtstr = gb.blstats[idx][fldidx].val;
                if (fldidx == BL_TITLE)
                    /* "<name> the <rank-title>", skip past "<name> the " */
                    txtstr += unsigned(unsigned(strlen(svp.plname) + sizeof_string(" the ")) - sizeof_string(""));
                if (hl.rel == TXT_VALUE && chars[hl.textmatch + 0]) {
                    if (fuzzymatch(hl.textmatch, txtstr, _("\" -_"), TRUE)) {
                        rule = hl;
                        exactmatch = TRUE;
                    } else if (exactmatch) {
                        ; /* already found best fit, skip "noneoftheabove" */
                    } else if (fldidx == BL_TITLE
                               && Upolyd() && noneoftheabove(hl.textmatch)) {
                        rule = hl;
                    }
                }
                break;
            case BL_TH_ALWAYS_HILITE:
                rule = hl;
                break;
            case BL_TH_CRITICALHP:
                if (fldidx == BL_HP && critically_low_hp(FALSE)) {
                    rule = hl;
                    crit_hp = TRUE;
                    updown = changed = perc_or_abs = FALSE;
                }
                break;
            case BL_TH_NONE:
                break;
            default:
                break;
            }
        }
    }
    colorptr[0] = rule ? rule.coloridx : NO_COLOR;
    return rule;
}

function split_clridx(idx, coloridx, attrib) { /* void */
    if (coloridx)
        coloridx[0] = idx & 0x00FF;
    if (attrib)
        attrib[0] = (idx >> 8) & 0x00FF;
}

/*
 * This is the parser for the hilite options.
 *
 * parse_status_hl1() separates each hilite entry into
 * a set of field threshold/action component strings,
 * then calls parse_status_hl2() to parse further
 * and configure the hilite.
 */
export function parse_status_hl1(op, from_configfile) { /* boolean */
    const $frame = stack_frame(); try {
    let hsbuf = stack_array(array_of(char, QBUFSZ), MAX_THRESH);
    let rslt, badopt = FALSE;
    let i, fldnum, ccount = 0;
    let c;

    fldnum = 0;
    for (i = 0; i < MAX_THRESH; ++i) {
        chars[hsbuf[i] + 0] = ord('\0');
    }
    while (chars[op] && fldnum < MAX_THRESH && ccount < (QBUFSZ - 2)) {
        c = lowc(chars[op]);
        if (c == ord(' ')) {
            if (fldnum >= 1) {
                if (fldnum == 1 && strncmpi((hsbuf[0]), _(("title")), -1) == 0) {
                    /* spaces are allowed in title */
                    chars[hsbuf[fldnum] + (ccount++)] = c;
                    chars[hsbuf[fldnum] + ccount] = ord('\0');
                    op++;
                    continue;
                }
                rslt = parse_status_hl2(hsbuf, from_configfile);
                if (!rslt) {
                    badopt = TRUE;
                    break;
                }
            }
            for (i = 0; i < MAX_THRESH; ++i) {
                chars[hsbuf[i] + 0] = ord('\0');
            }
            fldnum = 0;
            ccount = 0;
        } else if (c == ord('/')) {
            fldnum++;
            ccount = 0;
        } else {
            chars[hsbuf[fldnum] + (ccount++)] = c;
            chars[hsbuf[fldnum] + ccount] = ord('\0');
        }
        op++;
    }
    if (fldnum >= 1 && !badopt) {
        rslt = parse_status_hl2(hsbuf, from_configfile);
        if (!rslt)
            badopt = TRUE;
    }
    if (badopt)
        return FALSE;
    /* make sure highlighting is On; use short duration for temp highlights */
    if (!iflags.hilite_delta)
        iflags.hilite_delta = 3;
    return TRUE;
    } finally { stack_pop($frame); }
}
export const MAX_THRESH = 21;

/* is str in the format of "[<>]?=?[-+]?[0-9]+%?" regex */
function is_ltgt_percentnumber(str) { /* boolean */
    let s = str;

    if (chars[s] == ord('<') || chars[s] == ord('>'))
        s++;
    if (chars[s] == ord('='))
        s++;
    if (chars[s] == ord('-') || chars[s] == ord('+'))
        s++;
    if (!digit(chars[s]))
        return FALSE;
    while (digit(chars[s]))
        s++;
    if (chars[s] == ord('%'))
        s++;
    return +(chars[s] == ord('\0'));
}

/* does str only contain "<>=-+0-9%" chars */
function has_ltgt_percentnumber(str) { /* boolean */
    let s = str;

    while (chars[s]) {
        if (!strchr(_("<>=-+0123456789%"), chars[s]))
            return FALSE;
        s++;
    }
    return TRUE;
}

/* splitsubfields(): splits str in place into '+' or '&' separated strings.
   returns number of strings, or -1 if more than maxsf or MAX_SUBFIELDS */
function splitsubfields(str, sfarr, maxsf) { /* int */
    let subfields = static_array("splitsubfields.subfields", ptr_to(char), MAX_SUBFIELDS);
    let st = 0;
    let sf = 0;

    if (!str)
        return 0;
    for (sf = 0; sf < MAX_SUBFIELDS; ++sf)
        subfields[sf] = 0;

    maxsf = (maxsf == 0) ? MAX_SUBFIELDS : min(maxsf, MAX_SUBFIELDS);

    if (strchr(str, ord('+')) || strchr(str, ord('&'))) {
        let c = str;

        sf = 0;
        st = c;
        while (chars[c] && sf < maxsf) {
            if (chars[c] == ord('&') || chars[c] == ord('+')) {
                chars[c] = ord('\0');
                subfields[sf] = st;
                st = c+1;
                sf++;
            }
            c++;
        }
        if (sf >= maxsf - 1)
            return -1;
        if (!chars[c] && c != st)
            subfields[sf++] = st;
    } else {
        sf = 1;
        subfields[0] = str;
    }
    sfarr[0] = subfields;
    return sf;
}
export const MAX_SUBFIELDS = 16;

function is_fld_arrayvalues(
    str,
    arr,
    arrmin, arrmax,
    retidx) { /* boolean */
    let i;

    for (i = arrmin; i < arrmax; i++)
        if (!strcmpi(str, arr[i])) {
            retidx[0] = i;
            return TRUE;
        }
    return FALSE;
}

function query_arrayvalue(
    querystr,
    arr,
    arrmin, arrmax) { /* int */
    const $frame = stack_frame(); try {
    let i, res, ret = arrmin - 1;
    let tmpwin;
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let adj = (arrmin > 0) ? 1 : arrmax;
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    for (i = arrmin; i < arrmax; i++) {
        if (!arr[i])  /* the array of hunger status values has a gap ...*/
            continue; /*... set to Null between Satiated and Hungry     */
        struct_assign(any, cg.zeroany);
        any.a_int = i + adj;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, arr[i], MENU_ITEMFLAGS_NONE);
    }

    end_menu()(tmpwin, querystr);

    res = select_menu(tmpwin, PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);
    if (res > 0) {
        ret = picks[0].item.a_int - adj;
        free(addr_of(picks[0]));
    }

    return ret;
    } finally { stack_pop($frame); }
}

function status_hilite_add_threshold(fld, hilite) { /* void */
    let new_hilite, old_hilite;

    if (!hilite)
        return;

    /* alloc and initialize a new hilite_s struct */
    new_hilite = view_of(struct_hilite_s, addr_of(alloc(sizeof(struct_hilite_s))));
    struct_assign(new_hilite, hilite);   /* copy struct */

    new_hilite.set = TRUE;
    new_hilite.fld = fld;
    new_hilite.next = null;
    /* insert new entry at the end of the list */
    if (!gb.blstats[0][fld].thresholds) {
        gb.blstats[0][fld].thresholds = new_hilite;
    } else {
        for (old_hilite = gb.blstats[0][fld].thresholds; old_hilite.next;
             old_hilite = old_hilite.next)
            continue;
        old_hilite.next = new_hilite;
    }
    /* sort_hilites(fld) */

    /* current and prev must both point at the same hilites */
    gb.blstats[1][fld].thresholds = gb.blstats[0][fld].thresholds;
}

function parse_status_hl2(s, from_configfile) { /* boolean */
    const $frame = stack_frame(); try {
    let aligntxt = static_array("parse_status_hl2.aligntxt", ptr_to(char), null, [ _("chaotic"), _("neutral"), _("lawful") ]);
    /* hu_stat[] from eat.c has trailing spaces which foul up comparisons;
       for the "not hungry" case, there's no text hence no way to highlight */
    let hutxt = static_array("parse_status_hl2.hutxt", ptr_to(char), null, [
        _("Satiated"), _(""), _("Hungry"), _("Weak"), _("Fainting"), _("Fainted"), _("Starved")
    ]);
    let tmp, how;
    let sidx = 0, i = -1, dt = ANY_INVALID;
    let coloridx = -1, successes = 0;
    let disp_attrib = 0;
    let percent, changed, numeric, down, up,
            grt, lt, gte, le, eq, txtval, always, criticalhp;
    let txt;
    let fld = BL_FLUSH;
    let hilite = stack_struct(struct_hilite_s);
    let tmpbuf = stack_array(char, BUFSZ);

    /* Examples:
        3.6.1:
      OPTION=hilite_status: hitpoints/<10%/red
      OPTION=hilite_status: hitpoints/<10%/red/<5%/purple/1/red&blink+inverse
      OPTION=hilite_status: experience/down/red/up/green
      OPTION=hilite_status: cap/strained/yellow/overtaxed/orange
      OPTION=hilite_status: title/always/blue
      OPTION=hilite_status: title/blue
    */

    /* field name to statusfield */
    fld = fldname_to_bl_indx(s[sidx]);

    if (fld == BL_CHARACTERISTICS) {
        let res = FALSE;

        /* recursively set each of strength, dexterity, constitution, &c */
        for (fld = BL_STR; fld <= BL_CH; fld++) {
            strcpy(s[sidx], initblstats[fld].fldname);
            res = parse_status_hl2(s, from_configfile);
            if (!res)
                return FALSE;
        }
        return TRUE;
    }
    if (fld == BL_FLUSH) {
        config_error_add(_("Unknown status field '%s'"), s[sidx]);
        return FALSE;
    }
    if (fld == BL_CONDITION)
        return parse_condition(s, sidx);

    ++sidx;
    while (chars[s[sidx] + 0]) {
        let buf = stack_array(char, BUFSZ), subfields = stack_var(ptr_to(ptr_to(char)));
        let sf = 0;     /* subfield count */
        let kidx = stack_var(int);

        txt = 0;
        percent = numeric = always = FALSE;
        down = up = changed = FALSE;
        criticalhp = FALSE;
        grt = gte = eq = le = lt = txtval = FALSE;

        memset(addr_of(hilite), 0, sizeof(struct_hilite_s));
        hilite.set = FALSE; /* mark it "unset" */
        hilite.fld = fld;

        if (chars[s[sidx + 1]] == ord('\0') || !strncmpi((s[sidx]), _(("always")), -1)) {
            /* "field/always/color" OR "field/color" */
            always = TRUE;
            if (chars[s[sidx + 1]] == ord('\0'))
                sidx--;
        } else if (!strncmpi((s[sidx]), _(("up")), -1) || !strncmpi((s[sidx]), _(("down")), -1)) {
            if (initblstats[fld].anytype == ANY_STR)
                /* ordered string comparison is supported but LT/GT for
                   the string fields (title, dungeon-level, alignment)
                   is pointless; treat 'up' or 'down' for string fields
                   as 'changed' rather than rejecting them outright */
                ;
            else if (!strncmpi((s[sidx]), _(("down")), -1))
                down = TRUE;
            else
                up = TRUE;
            changed = TRUE;
        } else if (fld == BL_CAP
                   && is_fld_arrayvalues(s[sidx], enc_stat,
                                         SLT_ENCUMBER, OVERLOADED + 1,
                                         kidx)) {
            txt = enc_stat[kidx[0]];
            txtval = TRUE;
        } else if (fld == BL_ALIGN
                   && is_fld_arrayvalues(s[sidx], aligntxt, 0, 3, kidx)) {
            txt = aligntxt[kidx[0]];
            txtval = TRUE;
        } else if (fld == BL_HUNGER
                   && is_fld_arrayvalues(s[sidx], hutxt,
                                         SATIATED, STARVED + 1, kidx)) {
            txt = hu_stat[kidx[0]];   /* store hu_stat[] val, not hutxt[] */
            txtval = TRUE;
        } else if (!strncmpi((s[sidx]), _(("changed")), -1)) {
            changed = TRUE;
        } else if (fld == BL_HP && !strncmpi((s[sidx]), _(("criticalhp")), -1)) {
            criticalhp = TRUE;
        } else if (is_ltgt_percentnumber(s[sidx])) {
            let op;

            tmp = s[sidx]; /* is_ltgt_() guarantees [<>]?=?[-+]?[0-9]+%? */
            if (strchr(tmp, ord('%')))
               percent = TRUE;
            if (chars[tmp] == ord('<')) {
                if (chars[tmp + 1] == ord('='))
                    le = TRUE;
                else
                    lt = TRUE;
            } else if (chars[tmp] == ord('>')) {
                if (chars[tmp + 1] == ord('='))
                    gte = TRUE;
                else
                    grt = TRUE;
            }
            /* '%', '<', '>' have served their purpose, '=' is either
               part of '<' or '>' or optional for '=N', unary '+' is
               just decorative, so get rid of them, leaving -?[0-9]+ */
            tmp = stripchars(tmpbuf, _("%<>=+"), tmp);
            numeric = TRUE;
            dt = int(percent ? ANY_INT : initblstats[fld].anytype);
            s_to_anything(hilite.value, tmp, dt);

            op = grt ? _(">") : gte ? _(">=") : lt ? _("<") : le ? _("<=") : _("=");
            if (dt == ANY_INT
                /* AC is the only field where negative values make sense but
                   accept >-1 for other fields; reject <0 for non-AC */
                && (hilite.value.a_int
                    < ((fld == BL_AC) ? -128 : grt ? -1 : lt ? 1 : 0)
                /* percentages have another more comprehensive check below */
                    || hilite.value.a_int > (percent ? (lt ? 101 : 100)
                                                     : LARGEST_INT))) {
                config_error_add(_("%s'%s%d%s'%s"), threshold_value,
                                 op, hilite.value.a_int, percent ? _("%") : _(""),
                                 is_out_of_range);
                return FALSE;
            } else if (dt == ANY_LONG
                       && hilite.value.a_long < (grt ? -1 : lt ? 1 : 0)) {
                config_error_add(_("%s'%s%lld'%s"), threshold_value,
                                 op, hilite.value.a_long, is_out_of_range);
                return FALSE;
            }
        } else if (initblstats[fld].anytype == ANY_STR) {
            txt = s[sidx];
            txtval = TRUE;
        } else {
            config_error_add(has_ltgt_percentnumber(s[sidx])
                 ? _("Wrong format '%s', expected a threshold number or percent")
                 : _("Unknown behavior '%s'"),
                             s[sidx]);
            return FALSE;
        }

        /* relationships {LT_VALUE, LE_VALUE, EQ_VALUE, GE_VALUE, GT_VALUE} */
        if (grt || up)
            hilite.rel = GT_VALUE;
        else if (lt || down)
            hilite.rel = LT_VALUE;
        else if (gte)
            hilite.rel = GE_VALUE;
        else if (le)
            hilite.rel = LE_VALUE;
        else if (eq  || percent || numeric || changed)
            hilite.rel = EQ_VALUE;
        else if (txtval)
            hilite.rel = TXT_VALUE;
        else
            hilite.rel = LT_VALUE;

        if (initblstats[fld].anytype == ANY_STR && (percent || numeric)) {
            config_error_add(_("Field '%s' does not support numeric values"),
                             initblstats[fld].fldname);
            return FALSE;
        }

        if (percent) {
            if (initblstats[fld].idxmax < 0) {
                config_error_add(_("Cannot use percent with '%s'"),
                                 initblstats[fld].fldname);
                return FALSE;
            } else if ((hilite.value.a_int < -1)
                       || (hilite.value.a_int == -1
                           && hilite.value.a_int != GT_VALUE)
                       || (hilite.value.a_int == 0
                           && hilite.rel == LT_VALUE)
                       || (hilite.value.a_int == 100
                           && hilite.rel == GT_VALUE)
                       || (hilite.value.a_int == 101
                           && hilite.value.a_int != LT_VALUE)
                       || (hilite.value.a_int > 101)) {
                config_error_add(
                           _("hilite_status: invalid percentage value '%s%d%%'"),
                                 (hilite.rel == LT_VALUE) ? _("<")
                                   : (hilite.rel == LE_VALUE) ? _("<=")
                                     : (hilite.rel == GT_VALUE) ? _(">")
                                       : (hilite.rel == GE_VALUE) ? _(">=")
                                         : _("="),
                                 hilite.value.a_int);
                return FALSE;
            }
        }

        /* actions */
        sidx++;
        how = s[sidx];
        if (!how) {
            if (!successes)
                return FALSE;
        }
        coloridx = -1;
        strcpy(buf, how);
        sf = splitsubfields(buf, subfields, 0);

        if (sf < 1)
            return FALSE;

        disp_attrib = HL_UNDEF;

        for (i = 0; i < sf; ++i) {
            let a = match_str2attr(subfields[0][i], FALSE);

            if (a == ATR_BOLD)
                disp_attrib |= HL_BOLD;
            else if (a == ATR_DIM)
                disp_attrib |= HL_DIM;
            else if (a == ATR_ITALIC)
                disp_attrib |= HL_ITALIC;
            else if (a == ATR_ULINE)
                disp_attrib |= HL_ULINE;
            else if (a == ATR_BLINK)
                disp_attrib |= HL_BLINK;
            else if (a == ATR_INVERSE)
                disp_attrib |= HL_INVERSE;
            else if (a == ATR_NONE)
                disp_attrib = HL_NONE;
            else {
                let c = match_str2clr(subfields[0][i], FALSE);

                if (c >= CLR_MAX || coloridx != -1) {
                    config_error_add(_("bad color '%d %d'"), c, coloridx);
                    return FALSE;
                }
                coloridx = c;
            }
        }
        if (coloridx == -1)
            coloridx = NO_COLOR;

        /* Assign the values */
        hilite.coloridx = coloridx | (disp_attrib << 8);

        if (always)
            hilite.behavior = BL_TH_ALWAYS_HILITE;
        else if (percent)
            hilite.behavior = BL_TH_VAL_PERCENTAGE;
        else if (changed)
            hilite.behavior = BL_TH_UPDOWN;
        else if (numeric)
            hilite.behavior = BL_TH_VAL_ABSOLUTE;
        else if (txtval)
            hilite.behavior = BL_TH_TEXTMATCH;
        else if (hilite.value.a_void)
            hilite.behavior = BL_TH_VAL_ABSOLUTE;
        else if (criticalhp)
            hilite.behavior = BL_TH_CRITICALHP;
        else
            hilite.behavior = BL_TH_NONE;

        hilite.anytype = unsigned(dt);

        if (hilite.behavior == BL_TH_TEXTMATCH && txt) {
            strncpy(hilite.textmatch, txt, sizeof_member(hilite, "textmatch"));
            chars[hilite.textmatch + (sizeof_member(hilite, "textmatch") - 1)] = ord('\0');
            trimspaces(hilite.textmatch);
        }

        status_hilite_add_threshold(fld, hilite);

        successes++;
        sidx++;
    }

    return +(successes > 0);
    } finally { stack_pop($frame); }
}

function query_conditions() { /* unsigned long long */
    const $frame = stack_frame(); try {
    let i, res;
    let ret = 0;
    let tmpwin;
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    for (i = 0; i < SIZE(conditions); i++) {
        struct_assign(any, cg.zeroany);
        any.a_ulong = ulong(conditions[i].mask);
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, conditions[i].text[0], MENU_ITEMFLAGS_NONE);
    }

    end_menu()(tmpwin, _("Choose status conditions"));

    res = select_menu(tmpwin, PICK_ANY, picks);
    destroy_nhwindow()(tmpwin);
    if (res > 0) {
        for (i = 0; i < res; i++)
            ret = or64u(ret, ptr_add(picks[0], i).item.a_ulong);
        free(addr_of(picks[0]));
    }
    return ret;
    } finally { stack_pop($frame); }
}

function conditionbitmask2str(ul) { /* char * */
    let buf = static_array("conditionbitmask2str.buf", char, BUFSZ);
    let i;
    let first = TRUE;
    let alias = 0;

    chars[buf + 0] = ord('\0');
    if (!ul)
        return buf;

    for (i = 1; i < SIZE(condition_aliases); i++)
        if (condition_aliases[i].bitmask == ul)
            alias = condition_aliases[i].id;

    for (i = 0; i < SIZE(conditions); i++)
        if ((conditions[i].mask & ul) != 0) {
            sprintf(eos(buf), _("%s%s"), first ? _("") : _("+"), conditions[i].text[0])
;
            first = FALSE;
        }

    if (!first && alias)
        sprintf(buf, _("%s"), alias);

    return buf;
}

function match_str2conditionbitmask(str) { /* unsigned long long */
    let i, nmatches = 0;
    let mask = 0;

    if (str && chars[str]) {
        /* check matches to canonical names */
        for (i = 0; i < SIZE(conditions); i++)
            if (fuzzymatch(conditions[i].text[0], str, _(" -_"), TRUE)) {
                mask = or64u(mask, conditions[i].mask);
                nmatches++;
            }

        if (!nmatches) {
            /* check aliases */
            for (i = 0; i < SIZE(condition_aliases); i++)
                if (fuzzymatch(condition_aliases[i].id, str, _(" -_"), TRUE)) {
                    mask = or64u(mask, condition_aliases[i].bitmask);
                    nmatches++;
                }
        }

        if (!nmatches) {
            /* check partial matches to aliases */
            let len = int(strlen(str));

            for (i = 0; i < SIZE(condition_aliases); i++)
                if (!strncmpi(str, condition_aliases[i].id, len)) {
                    mask = or64u(mask, condition_aliases[i].bitmask);
                    nmatches++;
                }
        }
    }

    return mask;
}

function str2conditionbitmask(str) { /* unsigned long long */
    const $frame = stack_frame(); try {
    let conditions_bitmask = 0;
    let subfields = stack_var(ptr_to(ptr_to(char)));
    let i, sf;

    sf = splitsubfields(str, subfields, SIZE(conditions));

    if (sf < 1)
        return 0;

    for (i = 0; i < sf; ++i) {
        let bm = match_str2conditionbitmask(subfields[0][i]);

        if (!bm) {
            config_error_add(_("Unknown condition '%s'"), subfields[0][i]);
            return 0;
        }
        conditions_bitmask = or64u(conditions_bitmask, bm);
    }
    return conditions_bitmask;
    } finally { stack_pop($frame); }
}

function parse_condition(s, sidx) { /* boolean */
    const $frame = stack_frame(); try {
    let i;
    let coloridx = NO_COLOR;
    let tmp, how;
    let conditions_bitmask = 0;
    let result = FALSE;

    if (!s)
        return FALSE;

    /*3.6.1:
      OPTION=hilite_status: condition/stone+slime+foodPois/red&inverse */

    /*
     * TODO?
     *  It would be simpler to treat each condition (also hunger state
     *  and encumbrance level) as if it were a separate field.  That
     *  way they could have either or both 'changed' temporary rule and
     *  'always' persistent rule and wouldn't need convoluted access to
     *  the intended color and attributes.
     */

    sidx++;
    if (!chars[s[sidx] + 0]) {
        config_error_add(_("Missing condition(s)"));
        return FALSE;
    }
    while (chars[s[sidx] + 0]) {
        let sf = 0;     /* subfield count */
        let buf = stack_array(char, BUFSZ), subfields = stack_var(ptr_to(ptr_to(char)));

        tmp = s[sidx];
        strcpy(buf, tmp);
        conditions_bitmask = str2conditionbitmask(buf);

        if (!conditions_bitmask)
            return FALSE;

        /*
         * We have the conditions_bitmask with bits set for
         * each ailment we want in a particular color and/or
         * attribute, but we need to assign it to an array of
         * bitmasks indexed by the color chosen
         *        (0 to (CLR_MAX - 1))
         * and/or attributes chosen
         *        (HL_ATTCLR_NONE to (BL_ATTCLR_MAX - 1))
         * We still have to parse the colors and attributes out.
         */

        /* actions */
        sidx++;
        how = s[sidx];
        if (!how || !chars[how]) {
            config_error_add(_("Missing color+attribute"));
            return FALSE;
        }

        strcpy(buf, how);
        sf = splitsubfields(buf, subfields, 0);

        /*
         * conditions_bitmask now has bits set representing
         * the conditions that player wants represented, but
         * now we parse out *how* they will be represented.
         *
         * Only 1 colour is allowed, but potentially multiple
         * attributes are allowed.
         *
         * We have the following additional array offsets to
         * use for storing the attributes beyond the end of
         * the color indexes, all of which are less than CLR_MAX.
         *
         */

        for (i = 0; i < sf; ++i) {
            let a = match_str2attr(subfields[0][i], FALSE);

            if (a == ATR_BOLD)
                gc.cond_hilites[HL_ATTCLR_BOLD] = or64u(gc.cond_hilites[HL_ATTCLR_BOLD], conditions_bitmask);
            else if (a == ATR_DIM)
                gc.cond_hilites[HL_ATTCLR_DIM] = or64u(gc.cond_hilites[HL_ATTCLR_DIM], conditions_bitmask);
            else if (a == ATR_ITALIC)
                gc.cond_hilites[HL_ATTCLR_ITALIC] = or64u(gc.cond_hilites[HL_ATTCLR_ITALIC], conditions_bitmask);
            else if (a == ATR_ULINE)
                gc.cond_hilites[HL_ATTCLR_ULINE] = or64u(gc.cond_hilites[HL_ATTCLR_ULINE], conditions_bitmask);
            else if (a == ATR_BLINK)
                gc.cond_hilites[HL_ATTCLR_BLINK] = or64u(gc.cond_hilites[HL_ATTCLR_BLINK], conditions_bitmask);
            else if (a == ATR_INVERSE)
                gc.cond_hilites[HL_ATTCLR_INVERSE] = or64u(gc.cond_hilites[HL_ATTCLR_INVERSE], conditions_bitmask);
            else if (a == ATR_NONE) {
                gc.cond_hilites[HL_ATTCLR_BOLD] = and64u(gc.cond_hilites[HL_ATTCLR_BOLD], not64u(conditions_bitmask));
                gc.cond_hilites[HL_ATTCLR_DIM] = and64u(gc.cond_hilites[HL_ATTCLR_DIM], not64u(conditions_bitmask));
                gc.cond_hilites[HL_ATTCLR_ITALIC] = and64u(gc.cond_hilites[HL_ATTCLR_ITALIC], not64u(conditions_bitmask));
                gc.cond_hilites[HL_ATTCLR_ULINE] = and64u(gc.cond_hilites[HL_ATTCLR_ULINE], not64u(conditions_bitmask));
                gc.cond_hilites[HL_ATTCLR_BLINK] = and64u(gc.cond_hilites[HL_ATTCLR_BLINK], not64u(conditions_bitmask));
                gc.cond_hilites[HL_ATTCLR_INVERSE] = and64u(gc.cond_hilites[HL_ATTCLR_INVERSE], not64u(conditions_bitmask));
            } else {
                let k = match_str2clr(subfields[0][i], FALSE);

                if (k >= CLR_MAX) {
                    config_error_add(_("bad color %d"), k);
                    return FALSE;
                }
                coloridx = k;
            }
        }
        /* set the bits in the appropriate member of the
           condition array according to color chosen as index */

        gc.cond_hilites[coloridx] = or64u(gc.cond_hilites[coloridx], conditions_bitmask);
        result = TRUE;
        sidx++;
    }
    return result;
    } finally { stack_pop($frame); }
}

export function clear_status_hilites() { /* void */
    let i;

    for (i = 0; i < MAXBLSTATS; ++i) {
        let temp, next;

        for (temp = gb.blstats[0][i].thresholds; temp; temp = next) {
            next = temp.next;
            free(addr_of(temp));
        }
        gb.blstats[0][i].thresholds = gb.blstats[1][i].thresholds = null;
        /* pointer into thresholds list, now stale */
        gb.blstats[0][i].hilite_rule = gb.blstats[1][i].hilite_rule = null;
    }
}

function hlattr2attrname(attrib, buf, bufsz) { /* char * */
    const $frame = stack_frame(); try {
    if (attrib && buf) {
        let attbuf = stack_array(char, BUFSZ);
        let first = 0;
        let k;

        chars[attbuf + 0] = ord('\0');
        if (attrib == HL_NONE) {
            strcpy(buf, _("normal"));
            return buf;
        }

        if (attrib & HL_BOLD)
            strcat(attbuf, first++ ? _("+bold") : _("bold"));
        if (attrib & HL_DIM)
            strcat(attbuf, first++ ? _("+dim") : _("dim"));
        if (attrib & HL_ITALIC)
            strcat(attbuf, first++ ? _("+italic") : _("italic"));
        if (attrib & HL_ULINE)
            strcat(attbuf, first++ ? _("+underline") : _("underline"));
        if (attrib & HL_BLINK)
            strcat(attbuf, first++ ? _("+blink") : _("blink"));
        if (attrib & HL_INVERSE)
            strcat(attbuf, first++ ? _("+inverse") : _("inverse"));

        k = strlen(attbuf);
        if (k < unsigned(bufsz - 1))
            strcpy(buf, attbuf);
        return buf;
    }
    return 0;
    } finally { stack_pop($frame); }
}

const struct__status_hilite_line_str = struct("struct__status_hilite_line_str", {
    id: int,
    fld: int,
    hl: ptr_to("struct_hilite_s"),
    mask: ulong,
    str: array_of(char, BUFSZ),
    next: ptr_to("struct__status_hilite_line_str"),
});

/* these don't need to be in 'struct g' */
const status_hilite_str = static_var("status_hilite_str", ptr_to(struct__status_hilite_line_str), null);
const status_hilite_str_id = static_var("status_hilite_str_id", int, 0);

function status_hilite_linestr_add(
    fld,
    hl,
    mask,
    str) { /* void */
    let tmp, nxt;

    tmp = view_of(struct__status_hilite_line_str, addr_of(alloc(sizeof(struct__status_hilite_line_str))));
    memset(addr_of(tmp), 0, sizeof(struct__status_hilite_line_str));
    tmp.next = null;

    tmp.id = ++status_hilite_str_id[0];
    tmp.fld = fld;
    tmp.hl = hl;
    tmp.mask = mask;
    if (fld == BL_TITLE)
        strcpy(tmp.str, str);
    else
        stripchars(tmp.str, _(" "), str);

    if ((nxt = status_hilite_str[0]) != null) {
        while (nxt.next)
            nxt = nxt.next;
        nxt.next = tmp;
    } else {
        status_hilite_str[0] = tmp;
    }
}

function status_hilite_linestr_done() { /* void */
    let nxt, tmp = status_hilite_str[0];

    while (tmp) {
        nxt = tmp.next;
        free(addr_of(tmp));
        tmp = nxt;
    }
    status_hilite_str[0] = null;
    status_hilite_str_id[0] = 0;
}

function status_hilite_linestr_countfield(fld) { /* int */
    let tmp;
    let countall = +(fld == BL_FLUSH);
    let count = 0;

    for (tmp = status_hilite_str[0]; tmp; tmp = tmp.next) {
        if (countall || tmp.fld == fld)
            count++;
    }
    return count;
}

/* used by options handling, doset(options.c) */
export function count_status_hilites() { /* int */
    let count;

    status_hilite_linestr_gather();
    count = status_hilite_linestr_countfield(BL_FLUSH);
    status_hilite_linestr_done();
    return count;
}

function status_hilite_linestr_gather_conditions() { /* void */
    const $frame = stack_frame(); try {
    let i;
    const struct__cond_map = struct("status_hilite_linestr_gather_conditions.struct__cond_map", {
        bm: ulong,
        clratr: unsigned,
    }); let cond_maps = stack_array(struct__cond_map, SIZE(conditions));

    memset(addr_of(cond_maps[0]), 0,
                  SIZE(conditions) * sizeof(struct__cond_map));

    for (i = 0; i < SIZE(conditions); i++) {
        let clr = NO_COLOR;
        let atr = HL_NONE;
        let j;

        for (j = 0; j < CLR_MAX; j++)
            if (gc.cond_hilites[j] & conditions[i].mask) {
                clr = j;
                break;
            }
        if (gc.cond_hilites[HL_ATTCLR_BOLD] & conditions[i].mask)
            atr |= HL_BOLD;
        if (gc.cond_hilites[HL_ATTCLR_DIM] & conditions[i].mask)
            atr |= HL_DIM;
        if (gc.cond_hilites[HL_ATTCLR_ITALIC] & conditions[i].mask)
            atr |= HL_ITALIC;
        if (gc.cond_hilites[HL_ATTCLR_ULINE] & conditions[i].mask)
            atr |= HL_ULINE;
        if (gc.cond_hilites[HL_ATTCLR_BLINK] & conditions[i].mask)
            atr |= HL_BLINK;
        if (gc.cond_hilites[HL_ATTCLR_INVERSE] & conditions[i].mask)
            atr |= HL_INVERSE;
        if (atr != HL_NONE)
            atr &= ~HL_NONE;

        if (clr != NO_COLOR || atr != HL_NONE) {
            let ca = unsigned(clr | (atr << 8));
            let added_condmap = FALSE;

            for (j = 0; j < SIZE(conditions); j++)
                if (cond_maps[j].clratr == ca) {
                    cond_maps[j].bm = or64u(cond_maps[j].bm, conditions[i].mask);
                    added_condmap = TRUE;
                    break;
                }
            if (!added_condmap) {
                for (j = 0; j < SIZE(conditions); j++)
                    if (!cond_maps[j].bm) {
                        cond_maps[j].bm = ulong(conditions[i].mask);
                        cond_maps[j].clratr = ca;
                        break;
                    }
            }
        }
    }

    for (i = 0; i < SIZE(conditions); i++)
        if (cond_maps[i].bm) {
            let clr = stack_var(int, NO_COLOR), atr = stack_var(int, HL_NONE);

            split_clridx(int(cond_maps[i].clratr), clr, atr);
            if (clr[0] != NO_COLOR || atr[0] != HL_NONE) {
                let clrbuf = stack_array(char, BUFSZ);
                let attrbuf = stack_array(char, BUFSZ);
                let condbuf = stack_array(char, BUFSZ);
                let tmpattr;

                strNsubst(strcpy(clrbuf, clr2colorname(clr[0])),
                                 _(" "), _("-"), 0);
                tmpattr = hlattr2attrname(atr[0], attrbuf, BUFSZ);
                if (tmpattr)
                    sprintf(eos(clrbuf), _("&%s"), tmpattr);
                Snprintf(condbuf, sizeof(array_of(char, BUFSZ)), _("condition/%s/%s"), conditionbitmask2str(cond_maps[i].bm), clrbuf)
;
                status_hilite_linestr_add(BL_CONDITION, null,
                                          cond_maps[i].bm, condbuf);
            }
        }
    } finally { stack_pop($frame); }
}

function status_hilite_linestr_gather() { /* void */
    let i;
    let hl;

    status_hilite_linestr_done();

    for (i = 0; i < MAXBLSTATS; i++) {
        hl = gb.blstats[0][i].thresholds;
        while (hl) {
            status_hilite_linestr_add(i, hl, 0, status_hilite2str(hl));
            hl = hl.next;
        }
    }

    status_hilite_linestr_gather_conditions();
}

function status_hilite2str(hl) { /* char * */
    const $frame = stack_frame(); try {
    let buf = static_array("status_hilite2str.buf", char, BUFSZ);
    let clr = stack_var(int, NO_COLOR), attr = stack_var(int, ATR_NONE);
    let behavebuf = stack_array(char, BUFSZ);
    let clrbuf = stack_array(char, BUFSZ);
    let attrbuf = stack_array(char, BUFSZ);
    let tmpattr;
    let op;

    if (!hl)
        return 0;

    chars[behavebuf + 0] = ord('\0');
    chars[clrbuf + 0] = ord('\0');
    op = (hl.rel == LT_VALUE) ? _("<")
           : (hl.rel == LE_VALUE) ? _("<=")
             : (hl.rel == GT_VALUE) ? _(">")
               : (hl.rel == GE_VALUE) ? _(">=")
                 : (hl.rel == EQ_VALUE) ? _("=")
                   : 0;

    switch (hl.behavior) {
    case BL_TH_VAL_PERCENTAGE:
        if (op)
            sprintf(behavebuf, _("%s%d%%"), op, hl.value.a_int);
        else
            impossible(_("hl->behavior=percentage, rel error"));
        break;
    case BL_TH_UPDOWN:
        if (hl.rel == LT_VALUE)
            sprintf(behavebuf, _("down"));
        else if (hl.rel == GT_VALUE)
            sprintf(behavebuf, _("up"));
        else if (hl.rel == EQ_VALUE)
            sprintf(behavebuf, _("changed"));
        else
            impossible(_("hl->behavior=updown, rel error"));
        break;
    case BL_TH_VAL_ABSOLUTE:
        if (op)
            sprintf(behavebuf, _("%s%d"), op, hl.value.a_int);
        else
            impossible(_("hl->behavior=absolute, rel error"));
        break;
    case BL_TH_TEXTMATCH:
        if (hl.rel == TXT_VALUE && chars[hl.textmatch + 0])
            sprintf(behavebuf, _("%s"), hl.textmatch);
        else
            impossible(_("hl->behavior=textmatch, rel or textmatch error"));
        break;
    case BL_TH_CONDITION:
        if (hl.rel == EQ_VALUE)
            sprintf(behavebuf, _("%s"), conditionbitmask2str(hl.value.a_ulong));
        else
            impossible(_("hl->behavior=condition, rel error"));
        break;
    case BL_TH_ALWAYS_HILITE:
        sprintf(behavebuf, _("always"));
        break;
    case BL_TH_CRITICALHP:
        sprintf(behavebuf, _("criticalhp"));
        break;
    case BL_TH_NONE:
        break;
    default:
        break;
    }

    split_clridx(hl.coloridx, clr, attr);
    strNsubst(strcpy(clrbuf, clr2colorname(clr[0])), _(" "), _("-"), 0);
    if (attr[0] != HL_UNDEF) {
        if ((tmpattr = hlattr2attrname(attr[0], attrbuf, BUFSZ)) != 0)
            sprintf(eos(clrbuf), _("&%s"), tmpattr);
    }
    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s/%s/%s"), initblstats[hl.fld].fldname, behavebuf, clrbuf)
;

    return buf;
    } finally { stack_pop($frame); }
}

function status_hilite_menu_choose_field() { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let i, res, fld = BL_FLUSH;
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    for (i = 0; i < MAXBLSTATS; i++) {
        if (initblstats[i].fld == BL_SCORE
            && !gb.blstats[0][BL_SCORE].thresholds)
            continue;

        struct_assign(any, cg.zeroany);
        any.a_int = (i + 1);
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, initblstats[i].fldname, MENU_ITEMFLAGS_NONE);
    }

    end_menu()(tmpwin, _("Select a hilite field:"));

    res = select_menu(tmpwin, PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);
    if (res > 0) {
        fld = picks[0].item.a_int - 1;
        free(addr_of(picks[0]));
    }
    return fld;
    } finally { stack_pop($frame); }
}

function status_hilite_menu_choose_behavior(fld) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let res = 0, beh = BL_TH_NONE-1;
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let buf = stack_array(char, BUFSZ);
    let at;
    let onlybeh = BL_TH_NONE, nopts = 0;
    let clr = NO_COLOR;

    if (fld < 0 || fld >= MAXBLSTATS)
        return BL_TH_NONE;

    at = int(initblstats[fld].anytype);

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    if (fld != BL_CONDITION) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_ALWAYS_HILITE;
        sprintf(buf, _("Always highlight %s"), initblstats[fld].fldname);
        add_menu(tmpwin, nul_glyphinfo, any, ord('a'), 0, ATR_NONE,
                 clr, buf, MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    if (fld == BL_CONDITION) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_CONDITION;
        add_menu(tmpwin, nul_glyphinfo, any, ord('b'), 0, ATR_NONE,
                 clr, _("Bitmask of conditions"), MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    if (fld != BL_CONDITION && fld != BL_VERS) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_UPDOWN;
        sprintf(buf, _("%s value changes"), initblstats[fld].fldname);
        add_menu(tmpwin, nul_glyphinfo, any, ord('c'), 0, ATR_NONE,
                 clr, buf, MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    if (fld != BL_CAP && fld != BL_HUNGER
        && (at == ANY_INT || at == ANY_LONG)) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_VAL_ABSOLUTE;
        add_menu(tmpwin, nul_glyphinfo, any, ord('n'), 0, ATR_NONE,
                 clr, _("Number threshold"), MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    if (initblstats[fld].idxmax >= 0) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_VAL_PERCENTAGE;
        add_menu(tmpwin, nul_glyphinfo, any, ord('p'), 0, ATR_NONE,
                 clr, _("Percentage threshold"), MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    if (fld == BL_HP) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_CRITICALHP;
        sprintf(buf, _("Highlight critically low %s"), initblstats[fld].fldname)
;
        add_menu(tmpwin, nul_glyphinfo, any, ord('C'), 0, ATR_NONE,
                 clr, buf, MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    if (initblstats[fld].anytype == ANY_STR
        || fld == BL_CAP || fld == BL_HUNGER) {
        struct_assign(any, cg.zeroany);
        any.a_int = onlybeh = BL_TH_TEXTMATCH;
        sprintf(buf, _("%s text match"), initblstats[fld].fldname);
        add_menu(tmpwin, nul_glyphinfo, any, ord('t'), 0, ATR_NONE,
                 clr, buf, MENU_ITEMFLAGS_NONE);
        nopts++;
    }

    sprintf(buf, _("Select %s field hilite behavior:"), initblstats[fld].fldname)
;
    end_menu()(tmpwin, buf);

    if (nopts > 1) {
        res = select_menu(tmpwin, PICK_ONE, picks);
        if (res == 0) /* none chosen*/
            beh = BL_TH_NONE;
        else if (res == -1) /* menu cancelled */
            beh = (BL_TH_NONE - 1);
    } else if (onlybeh != BL_TH_NONE) {
        beh = onlybeh;
    }
    destroy_nhwindow()(tmpwin);
    if (res > 0) {
        beh = picks[0].item.a_int;
        free(addr_of(picks[0]));
    }
    return beh;
    } finally { stack_pop($frame); }
}

function status_hilite_menu_choose_updownboth(
    fld,
    str,
    ltok, gtok) { /* int */
    const $frame = stack_frame(); try {
    let res, ret = NO_LTEQGT;
    let tmpwin;
    let buf = stack_array(char, BUFSZ);
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    if (ltok) {
        if (str)
            sprintf(buf, _("%s than %s"), (fld == BL_AC) ? _("Better (lower)") : _("Less"), str);
        else
            sprintf(buf, _("Value goes down"))
;
        struct_assign(any, cg.zeroany);
        any.a_int = 10 + LT_VALUE;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, buf, MENU_ITEMFLAGS_NONE);

        if (str) {
            sprintf(buf, _("%s or %s"), str, (fld == BL_AC) ? _("better (lower)") : _("less"))
;
            struct_assign(any, cg.zeroany);
            any.a_int = 10 + LE_VALUE;
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                     clr, buf, MENU_ITEMFLAGS_NONE);
        }
    }

    if (str)
        sprintf(buf, _("Exactly %s"), str);
    else
        sprintf(buf, _("Value changes"));
    struct_assign(any, cg.zeroany);
    any.a_int = 10 + EQ_VALUE;
    add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
             clr, buf, MENU_ITEMFLAGS_NONE);

    if (gtok) {
        if (str) {
            sprintf(buf, _("%s or %s"), str, (fld == BL_AC) ? _("worse (higher)") : _("more"))
;
            struct_assign(any, cg.zeroany);
            any.a_int = 10 + GE_VALUE;
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                     clr, buf, MENU_ITEMFLAGS_NONE);
        }

        if (str)
            sprintf(buf, _("%s than %s"), (fld == BL_AC) ? _("Worse (higher)") : _("More"), str);
        else
            sprintf(buf, _("Value goes up"))
;
        struct_assign(any, cg.zeroany);
        any.a_int = 10 + GT_VALUE;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE, clr,
                 buf, MENU_ITEMFLAGS_NONE);
    }
    sprintf(buf, _("Select field %s value:"), initblstats[fld].fldname);
    end_menu()(tmpwin, buf);

    res = select_menu(tmpwin, PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);
    if (res > 0) {
        ret = picks[0].item.a_int - 10;
        free(addr_of(picks[0]));
    }

    return ret;
    } finally { stack_pop($frame); }
}

function status_hilite_menu_add(origfld) { /* boolean */
    const $frame = stack_frame(); try {
    var fld;
    var behavior;
    var lt_gt_eq;
    var clr = NO_COLOR, atr = HL_UNDEF;
    var hilite = stack_struct(struct_hilite_s);
    var cond = 0;
    var colorqry = stack_array(char, BUFSZ);
    var attrqry = stack_array(char, BUFSZ);
    var retry = 0;

 choose_field: for (;;) {
    fld = origfld;
    if (fld == BL_FLUSH) {
        fld = status_hilite_menu_choose_field();
        /* isn't this redundant given what follows? */
        if (fld == BL_FLUSH)
            return FALSE;
    }

    if (fld == BL_FLUSH)
        return FALSE;

    chars[colorqry + 0] = ord('\0');
    chars[attrqry + 0] = ord('\0');

    memset(addr_of(hilite), 0, sizeof(struct_hilite_s));
    hilite.next = null;
    hilite.set = FALSE; /* mark it "unset" */
    hilite.fld = fld;

 choose_behavior: for (;;) {
    behavior = status_hilite_menu_choose_behavior(fld);

    if (behavior == (BL_TH_NONE - 1)) {
        return FALSE;
    } else if (behavior == BL_TH_NONE) {
        if (origfld == BL_FLUSH)
            continue choose_field;;
        return FALSE;
    }

    hilite.behavior = behavior;

 choose_value: for (;;) {
    if (retry++ > 5) {
        pline(_("That's enough tries."));
        return FALSE;
    }
    if (behavior == BL_TH_VAL_PERCENTAGE
        || behavior == BL_TH_VAL_ABSOLUTE) {
        var inbuf = stack_array(char, BUFSZ), buf = stack_array(char, BUFSZ);
        var aval = stack_struct(struct_any);
        var val, dt;
        var gotnum = FALSE, percent = +(behavior == BL_TH_VAL_PERCENTAGE);
        var inp, numstart;
        var op;

        lt_gt_eq = NO_LTEQGT; /* not set up yet */
        chars[inbuf + 0] = ord('\0');
        sprintf(buf, _("Enter %svalue for %s threshold:"), percent ? _("percentage ") : _(""), initblstats[fld].fldname)

;
        getlin(buf, inbuf);
        if (chars[inbuf + 0] == ord('\0') || chars[inbuf + 0] == ord('\x1b'))
            continue choose_behavior;;

        inp = numstart = trimspaces(inbuf);
        if (!chars[inp])
            continue choose_behavior;;

        /* allow user to enter "<50%" or ">50" or just "50"
           or <=50% or >=50 or =50 */
        if (chars[inp] == ord('>') || chars[inp] == ord('<') || chars[inp] == ord('=')) {
            lt_gt_eq = (chars[inp] == ord('>')) ? ((chars[inp + 1] == ord('=')) ? GE_VALUE : GT_VALUE)
                     : (chars[inp] == ord('<')) ? ((chars[inp + 1] == ord('=')) ? LE_VALUE : LT_VALUE)
                       : EQ_VALUE;
            chars[inp++] = ord(' ');
            numstart++;
            if (lt_gt_eq == GE_VALUE || lt_gt_eq == LE_VALUE) {
                chars[inp++] = ord(' ');
                numstart++;
            }
        }
        if (chars[inp] == ord('-')) {
            inp++;
        } else if (chars[inp] == ord('+')) {
            chars[inp++] = ord(' ');
            numstart++;
        }
        while (digit(chars[inp])) {
            inp++;
            gotnum = TRUE;
        }
        if (chars[inp] == ord('%')) {
            if (!percent) {
                pline(_("Not expecting a percentage."));
                continue choose_behavior;
            }
            chars[inp] = ord('\0'); /* strip '%' [this accepts trailing junk!] */
        } else if (chars[inp]) {
            /* some random characters */
            pline(_("\"%s\" is not a recognized number."), inp);
            continue choose_value;
        }
        if (!gotnum) {
            pline(_("Is that an invisible number?"));
            continue choose_value;
        }
        op = (lt_gt_eq == LT_VALUE) ? _("<")
               : (lt_gt_eq == LE_VALUE) ? _("<=")
                 : (lt_gt_eq == GT_VALUE) ? _(">")
                   : (lt_gt_eq == GE_VALUE) ? _(">=")
                     : (lt_gt_eq == EQ_VALUE) ? _("=")
                       : _(""); /* didn't specify lt_gt_eq with number */

        struct_assign(aval, cg.zeroany);
        dt = int(percent ? ANY_INT : initblstats[fld].anytype);
        s_to_anything(aval, numstart, dt);

        if (percent) {
            val = aval.a_int;
            if (initblstats[fld].idxmax == -1) {
                pline(_("Field '%s' does not support percentage values."),
                      initblstats[fld].fldname);
                behavior = BL_TH_VAL_ABSOLUTE;
                continue choose_value;
            }
            /* if player only specified a number then lt_gt_eq isn't set
               up yet and the >-1 and <101 exceptions can't be honored;
               deliberate use of those should be uncommon enough for
               that to be palatable; for 0 and 100, choose_updown_both()
               will prevent useless operations */
            if ((val < 0 && (val != -1 || lt_gt_eq != GT_VALUE))
                || (val == 0 && lt_gt_eq == LT_VALUE)
                || (val == 100 && lt_gt_eq == GT_VALUE)
                || (val > 100 && (val != 101 || lt_gt_eq != LT_VALUE))) {
                pline(_("'%s%d%%' is not a valid percent value."), op, val);
                continue choose_value;
            }
            /* restore suffix for use in color and attribute prompts */
            if (!strchr(numstart, ord('%')))
                strcat(numstart, _("%"));

        /* reject negative values except for AC and >-1; reject 0 for < */
        } else if (dt == ANY_INT
                   && (aval.a_int < ((fld == BL_AC) ? -128
                                     : (lt_gt_eq == GT_VALUE) ? -1
                                       : (lt_gt_eq == LT_VALUE) ? 1 : 0))) {
            pline(_("%s'%s%d'%s"), threshold_value,
                  op, aval.a_int, is_out_of_range);
            continue choose_value;
        } else if (dt == ANY_LONG
                   && (aval.a_long < ((lt_gt_eq == GT_VALUE) ? -1
                                      : (lt_gt_eq == LT_VALUE) ? 1 : 0))) {
            pline(_("%s'%s%lld'%s"), threshold_value,
                  op, aval.a_long, is_out_of_range);
            continue choose_value;
        }

        if (lt_gt_eq == NO_LTEQGT) {
            var ltok = ((dt == ANY_INT)
                            ? +(aval.a_int > 0 || fld == BL_AC)
                            : +(aval.a_long > 0)),
                    gtok = +(!percent || aval.a_long < 100);

            lt_gt_eq = status_hilite_menu_choose_updownboth(fld, inbuf,
                                                            ltok, gtok);
            if (lt_gt_eq == NO_LTEQGT)
                continue choose_value;;
        }

        sprintf(colorqry, _("Choose a color for when %s is %s%s%s:"), initblstats[fld].fldname, (lt_gt_eq == LT_VALUE) ? _("less than ")
                  : (lt_gt_eq == GT_VALUE) ? _("more than ")
                    : _(""), numstart, (lt_gt_eq == LE_VALUE) ? _(" or less")
                  : (lt_gt_eq == GE_VALUE) ? _(" or more")
                    : _(""))

;
        sprintf(attrqry, _("Choose attribute for when %s is %s%s%s:"), initblstats[fld].fldname, (lt_gt_eq == LT_VALUE) ? _("less than ")
                  : (lt_gt_eq == GT_VALUE) ? _("more than ")
                    : _(""), numstart, (lt_gt_eq == LE_VALUE) ? _(" or less")
                  : (lt_gt_eq == GE_VALUE) ? _(" or more")
                    : _(""))

;

        hilite.rel = lt_gt_eq;
        struct_assign(hilite.value, aval);
    } else if (behavior == BL_TH_UPDOWN) {
        if (initblstats[fld].anytype != ANY_STR) {
            var ltok = +(fld != BL_TIME), gtok = TRUE;

            lt_gt_eq = status_hilite_menu_choose_updownboth(fld, 0,
                                                            ltok, gtok);
            if (lt_gt_eq == NO_LTEQGT)
                continue choose_behavior;;
        } else { /* ANY_STR */
            /* player picked '<field> value changes' in outer menu;
               ordered string comparison is supported but LT/GT for the
               string status fields (title, dungeon level, alignment)
               is pointless; rather than calling ..._choose_updownboth()
               with ltok==False plus gtok=False and having a menu with a
               single choice, skip it altogether and just use 'changed' */
            lt_gt_eq = EQ_VALUE;
        }
        sprintf(colorqry, _("Choose a color for when %s %s:"), initblstats[fld].fldname, (lt_gt_eq == EQ_VALUE) ? _("changes")
                  : (lt_gt_eq == LT_VALUE) ? _("decreases")
                    : _("increases"))

;
        sprintf(attrqry, _("Choose attribute for when %s %s:"), initblstats[fld].fldname, (lt_gt_eq == EQ_VALUE) ? _("changes")
                  : (lt_gt_eq == LT_VALUE) ? _("decreases")
                    : _("increases"))

;
        hilite.rel = lt_gt_eq;
    } else if (behavior == BL_TH_CONDITION) {
        cond = query_conditions();
        if (!cond) {
            if (origfld == BL_FLUSH)
                continue choose_field;;
            return FALSE;
        }
        Snprintf(colorqry, sizeof(array_of(char, BUFSZ)), _("Choose a color for conditions %s:"), conditionbitmask2str(cond))

;
        Snprintf(attrqry, sizeof(array_of(char, BUFSZ)), _("Choose attribute for conditions %s:"), conditionbitmask2str(cond))

;
    } else if (behavior == BL_TH_TEXTMATCH) {
        var qry_buf = stack_array(char, BUFSZ);

        sprintf(qry_buf, _("%s %s text value to match:"), (fld == BL_CAP
                 || fld == BL_ALIGN
                 || fld == BL_HUNGER
                 || fld == BL_TITLE) ? _("Choose") : _("Enter"), initblstats[fld].fldname)

;
        if (fld == BL_CAP) {
            var rv = query_arrayvalue(qry_buf,
                                      enc_stat,
                                      SLT_ENCUMBER, OVERLOADED + 1);

            if (rv < SLT_ENCUMBER)
                continue choose_behavior;;

            hilite.rel = TXT_VALUE;
            strcpy(hilite.textmatch, enc_stat[rv]);
        } else if (fld == BL_ALIGN) {
            var aligntxt = static_array("status_hilite_menu_add.aligntxt", ptr_to(char), null, [
                _("chaotic"), _("neutral"), _("lawful")
            ]);
            var rv = query_arrayvalue(qry_buf,
                                      aligntxt, 0, 2 + 1);

            if (rv < 0)
                continue choose_behavior;;

            hilite.rel = TXT_VALUE;
            strcpy(hilite.textmatch, aligntxt[rv]);
        } else if (fld == BL_HUNGER) {
            var hutxt = static_array("status_hilite_menu_add.hutxt", ptr_to(char), null, [
                _("Satiated"), 0, _("Hungry"), _("Weak"),
                _("Fainting"), _("Fainted"), _("Starved")
            ]);
            var rv = query_arrayvalue(qry_buf, hutxt, SATIATED, STARVED + 1);

            if (rv < SATIATED)
                continue choose_behavior;;

            hilite.rel = TXT_VALUE;
            strcpy(hilite.textmatch, hutxt[rv]);
        } else if (fld == BL_TITLE) {
            var rolelist = stack_array(ptr_to(char), 3 * 9 + 1);
            var mbuf = stack_array(char, MAXVALWIDTH), fbuf = stack_array(char, MAXVALWIDTH), obuf = stack_array(char, MAXVALWIDTH);
            var i, j, rv;

            for (i = j = 0; i < 9; i++) {
                sprintf(mbuf, _("\"%s\""), gu.urole.rank[i].m);
                if (gu.urole.rank[i].f) {
                    sprintf(fbuf, _("\"%s\""), gu.urole.rank[i].f);
                    Snprintf(obuf, sizeof(array_of(char, MAXVALWIDTH)), _("%s or %s"), flags.female ? fbuf : mbuf, flags.female ? mbuf : fbuf)

;
                } else {
                    chars[fbuf + 0] = chars[obuf + 0] = ord('\0');
                }
                if (flags.female) {
                    if (chars[fbuf])
                        rolelist[j++] = dupstr(fbuf);
                    rolelist[j++] = dupstr(mbuf);
                    if (chars[obuf])
                        rolelist[j++] = dupstr(obuf);
                } else {
                    rolelist[j++] = dupstr(mbuf);
                    if (chars[fbuf])
                        rolelist[j++] = dupstr(fbuf);
                    if (chars[obuf])
                        rolelist[j++] = dupstr(obuf);
                }
            }
            rolelist[j++] = dupstr(_("\"none of the above (polymorphed)\""));

            rv = query_arrayvalue(qry_buf, rolelist, 0, j);
            if (rv >= 0) {
                hilite.rel = TXT_VALUE;
                strcpy(hilite.textmatch, rolelist[rv]);
            }
            for (i = 0; i < j; i++)
                free((rolelist[i])), rolelist[i] = 0;
            if (rv < 0)
                continue choose_behavior;;
        } else {
            var inbuf = stack_array(char, BUFSZ);

            chars[inbuf + 0] = ord('\0');
            getlin(qry_buf, inbuf);
            if (chars[inbuf + 0] == ord('\0') || chars[inbuf + 0] == ord('\x1b'))
                continue choose_behavior;;

            hilite.rel = TXT_VALUE;
            if (strlen(inbuf) < sizeof_member(hilite, "textmatch"))
                strcpy(hilite.textmatch, inbuf);
            else
                return FALSE;
        }
        sprintf(colorqry, _("Choose a color for when %s is '%s':"), initblstats[fld].fldname, hilite.textmatch)
;
        sprintf(attrqry, _("Choose attribute for when %s is '%s':"), initblstats[fld].fldname, hilite.textmatch)
;
    } else if (behavior == BL_TH_ALWAYS_HILITE) {
        sprintf(colorqry, _("Choose a color to always hilite %s:"), initblstats[fld].fldname)
;
        sprintf(attrqry, _("Choose attribute to always hilite %s:"), initblstats[fld].fldname)
;
    }

 choose_color: for (;;) {
    clr = query_color(colorqry, NO_COLOR);
    if (clr == -1) {
        if (behavior != BL_TH_ALWAYS_HILITE)
            continue choose_value;
        else
            continue choose_behavior;;
    }
    atr = query_attr(attrqry, ATR_NONE);
    if (atr == -1)
        continue choose_color;; break; } break; } break; } break; }

    if (behavior == BL_TH_CONDITION) {
        var clrbuf = stack_array(char, BUFSZ);
        var attrbuf = stack_array(char, BUFSZ);
        var tmpattr;

        if (atr & HL_BOLD)
            gc.cond_hilites[HL_ATTCLR_BOLD] = or64u(gc.cond_hilites[HL_ATTCLR_BOLD], cond);
        if (atr & HL_DIM)
            gc.cond_hilites[HL_ATTCLR_DIM] = or64u(gc.cond_hilites[HL_ATTCLR_DIM], cond);
        if (atr & HL_ITALIC)
            gc.cond_hilites[HL_ATTCLR_ITALIC] = or64u(gc.cond_hilites[HL_ATTCLR_ITALIC], cond);
        if (atr & HL_ULINE)
            gc.cond_hilites[HL_ATTCLR_ULINE] = or64u(gc.cond_hilites[HL_ATTCLR_ULINE], cond);
        if (atr & HL_BLINK)
            gc.cond_hilites[HL_ATTCLR_BLINK] = or64u(gc.cond_hilites[HL_ATTCLR_BLINK], cond);
        if (atr & HL_INVERSE)
            gc.cond_hilites[HL_ATTCLR_INVERSE] = or64u(gc.cond_hilites[HL_ATTCLR_INVERSE], cond);
        if (atr == HL_NONE) {
            gc.cond_hilites[HL_ATTCLR_BOLD] = and64u(gc.cond_hilites[HL_ATTCLR_BOLD], not64u(cond));
            gc.cond_hilites[HL_ATTCLR_DIM] = and64u(gc.cond_hilites[HL_ATTCLR_DIM], not64u(cond));
            gc.cond_hilites[HL_ATTCLR_ITALIC] = and64u(gc.cond_hilites[HL_ATTCLR_ITALIC], not64u(cond));
            gc.cond_hilites[HL_ATTCLR_ULINE] = and64u(gc.cond_hilites[HL_ATTCLR_ULINE], not64u(cond));
            gc.cond_hilites[HL_ATTCLR_BLINK] = and64u(gc.cond_hilites[HL_ATTCLR_BLINK], not64u(cond));
            gc.cond_hilites[HL_ATTCLR_INVERSE] = and64u(gc.cond_hilites[HL_ATTCLR_INVERSE], not64u(cond));
        }
        gc.cond_hilites[clr] = or64u(gc.cond_hilites[clr], cond);
        strNsubst(strcpy(clrbuf, clr2colorname(clr)), _(" "), _("-"), 0);
        tmpattr = hlattr2attrname(atr, attrbuf, BUFSZ);
        if (tmpattr)
            sprintf(eos(clrbuf), _("&%s"), tmpattr);
        pline(_("Added hilite condition/%s/%s"),
              conditionbitmask2str(cond), clrbuf);
    } else {
        var p, q;

        hilite.coloridx = clr | (atr << 8);
        hilite.anytype = initblstats[fld].anytype;

        if (fld == BL_TITLE && (p = strstri(hilite.textmatch, _(" or "))) != 0) {
            /* split menu choice "male-rank or female-rank" into two distinct
               but otherwise identical rules, "male-rank" and "female-rank" */
            chars[p] = ord('\0'); /* chop off " or female-rank" */
            /* new rule for male-rank */
            status_hilite_add_threshold(fld, hilite);
            pline(_("Added hilite %s"), status_hilite2str(hilite));
            /* transfer female-rank to start of hilite.textmatch buffer */
            p += sizeof_string(" or ") - sizeof_string("");
            q = hilite.textmatch;
            while ((chars[q++] = chars[p++]) != ord('\0'))
                continue;
            /* proceed with normal addition of new rule */
        }
        status_hilite_add_threshold(fld, hilite);
        pline(_("Added hilite %s"), status_hilite2str(hilite));
    }
    reset_status_hilites();
    return TRUE;
    } finally { stack_pop($frame); }
}

function status_hilite_remove(id) { /* boolean */
    let hlstr = status_hilite_str[0];

    while (hlstr && hlstr.id != id) {
        hlstr = hlstr.next;
    }

    if (!hlstr)
        return FALSE;

    if (hlstr.fld == BL_CONDITION) {
        let i;

        for (i = 0; i < CLR_MAX; i++)
            gc.cond_hilites[i] = and64u(gc.cond_hilites[i], not64u(hlstr.mask));
        gc.cond_hilites[HL_ATTCLR_BOLD] = and64u(gc.cond_hilites[HL_ATTCLR_BOLD], not64u(hlstr.mask));
        gc.cond_hilites[HL_ATTCLR_DIM] = and64u(gc.cond_hilites[HL_ATTCLR_DIM], not64u(hlstr.mask));
        gc.cond_hilites[HL_ATTCLR_ITALIC] = and64u(gc.cond_hilites[HL_ATTCLR_ITALIC], not64u(hlstr.mask));
        gc.cond_hilites[HL_ATTCLR_ULINE] = and64u(gc.cond_hilites[HL_ATTCLR_ULINE], not64u(hlstr.mask));
        gc.cond_hilites[HL_ATTCLR_BLINK] = and64u(gc.cond_hilites[HL_ATTCLR_BLINK], not64u(hlstr.mask));
        gc.cond_hilites[HL_ATTCLR_INVERSE] = and64u(gc.cond_hilites[HL_ATTCLR_INVERSE], not64u(hlstr.mask));
        return TRUE;
    } else {
        let fld = hlstr.fld;
        let hl, hlprev = null;

        for (hl = gb.blstats[0][fld].thresholds; hl; hl = hl.next) {
            if (hlstr.hl == hl) {
                if (hlprev) {
                    hlprev.next = hl.next;
                } else {
                    gb.blstats[0][fld].thresholds = hl.next;
                    gb.blstats[1][fld].thresholds
                        = gb.blstats[0][fld].thresholds;
                }
                if (gb.blstats[0][fld].hilite_rule == hl) {
                    gb.blstats[0][fld].hilite_rule
                        = gb.blstats[1][fld].hilite_rule
                        = null;
                    gb.blstats[0][fld].time = gb.blstats[1][fld].time = 0;
                }
                free(addr_of(hl));
                return TRUE;
            }
            hlprev = hl;
        }
    }
    return FALSE;
}

function status_hilite_menu_fld(fld) { /* boolean */
    const $frame = stack_frame(); try {
    let tmpwin;
    let i, res;
    let picks = stack_var(ptr_to(struct_mi), null);
    let any = stack_struct(struct_any);
    let count = status_hilite_linestr_countfield(fld);
    let hlstr;
    let buf = stack_array(char, BUFSZ);
    let acted;
    let clr = NO_COLOR;

    if (!count) {
        if (status_hilite_menu_add(fld)) {
            status_hilite_linestr_done();
            status_hilite_linestr_gather();
            count = status_hilite_linestr_countfield(fld);
        } else
            return FALSE;
    }

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    if (count) {
        hlstr = status_hilite_str[0];
        while (hlstr) {
            if (hlstr.fld == fld) {
                struct_assign(any, cg.zeroany);
                any.a_int = hlstr.id;
                add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                         clr, hlstr.str, MENU_ITEMFLAGS_NONE);
            }
            hlstr = hlstr.next;
        }
    } else {
        sprintf(buf, _("No current hilites for %s"), initblstats[fld].fldname);
        add_menu_str(tmpwin, buf);
    }

    /* separator line */
    add_menu_str(tmpwin, _(""));

    if (count) {
        struct_assign(any, cg.zeroany);
        any.a_int = -1;
        add_menu(tmpwin, nul_glyphinfo, any, ord('X'), 0, ATR_NONE, clr,
                 _("Remove selected hilites"), MENU_ITEMFLAGS_NONE);
    }

    if (fld == BL_SCORE) {
        /* suppress 'Z - Add a new hilite' for 'score' when SCORE_ON_BOTL
           is disabled; we wouldn't be called for 'score' unless it has
           hilite rules from the config file, so count must be positive
           (hence there's no risk that we're putting up an empty menu) */
        ;
    } else

    {
        struct_assign(any, cg.zeroany);
        any.a_int = -2;
        add_menu(tmpwin, nul_glyphinfo, any, ord('Z'), 0, ATR_NONE,
                 clr, _("Add new hilites"), MENU_ITEMFLAGS_NONE);
    }

    sprintf(buf, _("Current %s hilites:"), initblstats[fld].fldname);
    end_menu()(tmpwin, buf);

    acted = FALSE;
    if ((res = select_menu(tmpwin, PICK_ANY, picks)) > 0) {
        let idx;
        let mode = 0;

        for (i = 0; i < res; i++) {
            idx = ptr_add(picks[0], i).item.a_int;
            if (idx == -1)
                mode = unsigned(mode | 1); /* delete selected hilites */
            else if (idx == -2)
                mode = unsigned(mode | 2); /* create new hilites */
        }
        if (mode & 1) { /* delete selected hilites */
            for (i = 0; i < res; i++) {
                idx = ptr_add(picks[0], i).item.a_int;
                if (idx > 0 && status_hilite_remove(idx))
                    acted = TRUE;
            }
        }
        if (mode & 2) { /* create new hilites */
            while (status_hilite_menu_add(fld))
                acted = TRUE;
        }
        free(addr_of(picks[0])), picks[0] = null;
    }
    destroy_nhwindow()(tmpwin);
    return acted;
    } finally { stack_pop($frame); }
}

function status_hilites_viewall() { /* void */
    const $frame = stack_frame(); try {
    let datawin;
    let hlstr = status_hilite_str[0];
    let buf = stack_array(char, BUFSZ);

    datawin = create_nhwindow()(NHW_TEXT);

    while (hlstr) {
        sprintf(buf, _("OPTIONS=hilite_status: %.*s"), (BUFSZ - sizeof_string("OPTIONS=hilite_status: ") - 1), hlstr.str)

;
        putstr()(datawin, 0, buf);
        hlstr = hlstr.next;
    }

    display_nhwindow()(datawin, FALSE);
    destroy_nhwindow()(datawin);
    } finally { stack_pop($frame); }
}

export function all_options_statushilites(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let hlstr;
    let buf = stack_array(char, BUFSZ);

    status_hilite_linestr_done();
    status_hilite_linestr_gather();

    hlstr = status_hilite_str[0];

    while (hlstr) {
        sprintf(buf, _("OPTIONS=hilite_status: %.*s\n"), (BUFSZ - sizeof_string("OPTIONS=hilite_status:  ") - 1), hlstr.str)

;
        strbuf_append(sbuf, buf);
        hlstr = hlstr.next;
    }
    status_hilite_linestr_done();
    } finally { stack_pop($frame); }
}

export function status_hilite_menu() { /* boolean */
    const $frame = stack_frame(); try {
    var tmpwin;
    var i, fld, res;
    var picks = stack_var(ptr_to(struct_mi), null);
    var any = stack_struct(struct_any);
    var redo;
    var countall;
    var clr = NO_COLOR;

 shlmenu_redo: for (;;) {
    redo = FALSE;

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    status_hilite_linestr_gather();
    countall = status_hilite_linestr_countfield(BL_FLUSH);
    if (countall) {
        struct_assign(any, cg.zeroany);
        any.a_int = -1;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, _("View all hilites in config format"),
                 MENU_ITEMFLAGS_NONE);

        add_menu_str(tmpwin, _(""));
    }

    for (i = 0; i < MAXBLSTATS; i++) {
        var count;
        var buf = stack_array(char, BUFSZ);

        fld = initblstats[i].fld;
        count = status_hilite_linestr_countfield(fld);

        /* config file might contain rules for highlighting 'score'
           even when SCORE_ON_BOTL is disabled; if so, 'O' command
           menus will show them and allow deletions but not additions,
           otherwise, it won't show 'score' at all */
        if (fld == BL_SCORE && !count)
            continue;

        struct_assign(any, cg.zeroany);
        any.a_int = fld + 1;
        sprintf(buf, _("%-18s"), initblstats[i].fldname);
        if (count)
            sprintf(eos(buf), _(" (%d defined)"), count);
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, buf, MENU_ITEMFLAGS_NONE);
    }

    end_menu()(tmpwin, _("Status hilites:"));
    if ((res = select_menu(tmpwin, PICK_ONE, picks)) > 0) {
        fld = picks[0].item.a_int - 1;
        if (fld < 0) {
            status_hilites_viewall();
        } else {
            if (status_hilite_menu_fld(fld))
                reset_status_hilites();
        }
        free(addr_of(picks[0])), picks[0] = null;
        redo = TRUE;
    }

    destroy_nhwindow()(tmpwin);
    countall = status_hilite_linestr_countfield(BL_FLUSH);
    status_hilite_linestr_done();

    /* fuzzer is unlikely to pick something useful within nested menus;
       limit it to one try */
    if (redo && !iflags.debug_fuzzer)
        continue shlmenu_redo;; break; }

    /* hilite_delta=='statushilites' does double duty:  it is the
       number of turns for temporary highlights to remain visible
       and also when non-zero it is the flag to enable highlighting */
    if (countall > 0 && !iflags.hilite_delta)
        iflags.hilite_delta = 3;

    return TRUE;
    } finally { stack_pop($frame); }
}

/*botl.c*/

import { A_CHAOTIC, A_NEUTRAL } from "./align.h.js";
import { ART_MITRE_OF_HOLINESS, ART_TSURUGI_OF_MURAMASA } from "./artilist.h.js";
import { A_CHA, A_CON, A_DEX, A_INT, A_STR, A_WIS } from "./attrib.h.js";
import { ACURR, STR18 } from "./attrib.h.macros.js";
import {
    BL_AC, BL_ALIGN, BL_ARMOR, BL_CAP, BL_CH, BL_CHARACTERISTICS, BL_CO, BL_CONDITION, BL_DX,
    BL_ENE, BL_ENEMAX, BL_EXP, BL_FLUSH, BL_GOLD, BL_HD, BL_HP, BL_HPMAX, BL_HUNGER, BL_IN,
    BL_LEVELDESC, BL_MASK_BAREH, BL_MASK_BLIND, BL_MASK_BUSY, BL_MASK_CONF, BL_MASK_DEAF,
    BL_MASK_ELF_IRON, BL_MASK_FLY, BL_MASK_FOODPOIS, BL_MASK_GLOWHANDS, BL_MASK_GRAB, BL_MASK_HALLU,
    BL_MASK_HELD, BL_MASK_HOLDING, BL_MASK_ICY, BL_MASK_INLAVA, BL_MASK_LEV, BL_MASK_PARLYZ,
    BL_MASK_RIDE, BL_MASK_SLEEPING, BL_MASK_SLIME, BL_MASK_SLIPPERY, BL_MASK_STONE, BL_MASK_STRNGL,
    BL_MASK_STUN, BL_MASK_SUBMERGED, BL_MASK_TERMILL, BL_MASK_TETHERED, BL_MASK_TRAPPED,
    BL_MASK_UNCONSC, BL_MASK_WOUNDEDL, BL_RESET, BL_SCORE, BL_STR, BL_TERRAIN, BL_TH_ALWAYS_HILITE,
    BL_TH_CONDITION, BL_TH_CRITICALHP, BL_TH_NONE, BL_TH_TEXTMATCH, BL_TH_UPDOWN,
    BL_TH_VAL_ABSOLUTE, BL_TH_VAL_PERCENTAGE, BL_TIME, BL_TITLE, BL_VERS, BL_WEAPON, BL_WI, BL_XP,
    BOTL_NSIZ, CONDITION_COUNT, EQ_VALUE, GE_VALUE, GT_VALUE, HL_ATTCLR_BLINK, HL_ATTCLR_BOLD,
    HL_ATTCLR_DIM, HL_ATTCLR_INVERSE, HL_ATTCLR_ITALIC, HL_ATTCLR_ULINE, HL_BLINK, HL_BOLD, HL_DIM,
    HL_INVERSE, HL_ITALIC, HL_NONE, HL_ULINE, HL_UNDEF, LE_VALUE, LT_VALUE, MAXBLSTATS, MAXCO,
    MAXVALWIDTH, NO_LTEQGT, TXT_VALUE, bl_bareh, bl_blind, bl_busy, bl_conf, bl_deaf, bl_elf_iron,
    bl_fly, bl_foodpois, bl_glowhands, bl_grab, bl_hallu, bl_held, bl_holding, bl_icy, bl_inlava,
    bl_lev, bl_parlyz, bl_ride, bl_sleeping, bl_slime, bl_slippery, bl_stone, bl_strngl, bl_stun,
    bl_submerged, bl_termill, bl_tethered, bl_trapped, bl_unconsc, bl_woundedl, struct_conditions_t,
    struct_condmap, struct_condtests_t, struct_hilite_s, struct_istat_s,
} from "./botl.h.js";
import { VIA_WINDOWPORT } from "./botl.h.macros.js";
import { CLR_MAX, NO_COLOR } from "./color.h.js";
import { COIN_CLASS, S_EEL, WEAPON_CLASS } from "./defsym.h.js";
import { objnum_to_glyph } from "./display.h.macros.js";
import { In_endgame, In_tutorial, Is_knox } from "./dungeon.h.macros.js";
import { BUFSZ, COLNO, FALSE, LARGEST_INT, QBUFSZ, TRUE, opt_in, opt_out } from "./global.h.js";
import { Strlen, strcmpi } from "./global.h.macros.js";
import {
    NOT_HUNGRY, OVERLOADED, SATIATED, SLT_ENCUMBER, STARVED, SYM_OFF_O, UNENCUMBERED,
} from "./hack.h.js";
import { max, min, qsort } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { humanoid } from "./mondata.h.macros.js";
import { NON_PM } from "./monsters.h.js";
import { bimanual, is_sword, is_weptool } from "./obj.h.macros.js";
import {
    AKLYS, AMULET_OF_GUARDING, CLOAK_OF_PROTECTION, CREAM_PIE, GOLD_PIECE, RIN_PROTECTION,
} from "./objects.h.js";
import { ICE, MAX_TYPE } from "./rm.h.js";
import { levl } from "./rm.h.macros.js";
import { P_LANCE, P_MORNING_STAR, P_POLEARMS, P_QUARTERSTAFF, P_UNICORN_HORN } from "./skills.h.js";
import { WC2_FLUSH_STATUS, WC2_RESET_STATUS } from "./winprocs.h.js";
import {
    create_nhwindow, curs, destroy_nhwindow, display_nhwindow, end_menu, putmixed, putstr,
    start_menu, status_enablefield, status_update,
} from "./winprocs.h.macros.js";
import {
    ANY_INT, ANY_INVALID, ANY_IPTR, ANY_LONG, ANY_LPTR, ANY_MASK32, ANY_STR, ANY_UINT, ANY_ULONG,
    ANY_ULPTR, ANY_UPTR, ATR_BLINK, ATR_BOLD, ATR_DIM, ATR_INVERSE, ATR_ITALIC, ATR_NONE, ATR_ULINE,
    MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, MENU_ITEMFLAGS_SKIPINVERT,
    NHW_MENU, NHW_TEXT, PICK_ANY, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { SICK_NONVOMITABLE, SICK_VOMITABLE, TT_BURIEDBALL, TT_LAVA } from "./you.h.js";
import { Role_switch, Ugender, Upolyd } from "./you.h.macros.js";
import {
    Blind, Confusion, Deaf, Flying, Glib, Hallucination, Levitation, Sick, Slimed, Stoned,
    Strangled, Stunned, Underwater, Wounded_legs,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import {
    char, int, ord, schar, sizeof, sizeof_string, uchar, ulong, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64u, not64u, or64u } from "../rt/int64.js";
import {
    LLONG_MAX, atoi, atoll, free, memset, sprintf, strcat, strchr, strcmp, strcpy, strlen, strncmp,
    strncpy,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, ref_to, sizeof_member, struct, struct_assign,
    view_of,
} from "../rt/struct.js";
import { alloc, dupstr, fmt_ptr } from "./alloc.js";
import { config_error_add } from "./cfgfiles.js";
import {
    clr2colorname, match_str2attr, match_str2clr, query_attr, query_color,
} from "./coloratt.js";
import {
    cg, disp, flags, gb, gc, gi, gm, gn, gs, gu, gv, gy, iflags, svc, svd, svm, svp, u,
} from "./decl.js";
import { nul_glyphinfo, suppress_map_output } from "./display.js";
import { pmname } from "./do_name.js";
import { In_quest, depth, dunlev, endgamelevelname } from "./dungeon.js";
import { hu_stat } from "./eat.js";
import { panic } from "./end.js";
import { newuexp } from "./exper.js";
import { classify_terrain, money_cnt, near_capacity } from "./hack.js";
import {
    digit, eos, fuzzymatch, highc, lowc, mungspaces, sgn, strNsubst, str_start_is, stripchars,
    strkitten, strncmpi, strstri, strsubst, trimspaces, upstart,
} from "./hacklib.js";
import { sticks } from "./mondata.js";
import { mons } from "./monst.js";
import { helm_simple_name } from "./objnam.js";
import { match_optname } from "./options.js";
import { impossible, pline } from "./pline.js";
import { critically_low_hp } from "./pray.js";
import { roles } from "./role.js";
import { strbuf_append } from "./strutil.js";
import { unconscious } from "./trap.js";
import { status_version } from "./version.js";
import { weapon_descr, weapon_type } from "./weapon.js";
import {
    add_menu, add_menu_heading, add_menu_str, encglyph, getlin, select_menu, windowprocs,
} from "./windows.js";
