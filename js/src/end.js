/* NetHack 5.0	end.c	$NHDT-Date: 1720397752 2024/07/08 00:15:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.315 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

export function done_stopprint() { return program_state.stopprint; }

/*
 * The order of these needs to match the macros in hack.h.
 */
const deaths = static_array("deaths", ptr_to(char), null, [
    /* the array of death */
    _("died"), _("choked"), _("poisoned"), _("starvation"), _("drowning"), _("burning"),
    _("dissolving under the heat and pressure"), _("crushed"), _("turned to stone"),
    _("turned into slime"), _("genocided"), _("panic"), _("trickery"), _("quit"),
    _("escaped"), _("ascended")
]);

const ends = static_array("ends", ptr_to(char), null, [
    /* "when you %s" */
    _("died"), _("choked"), _("were poisoned"),
    _("starved"), _("drowned"), _("burned"),
    _("dissolved in the lava"),
    _("were crushed"), _("turned to stone"),
    _("turned into slime"), _("were genocided"),
    _("panicked"), _("were tricked"), _("quit"),
    _("escaped"), _("ascended")
]);

const Schroedingers_cat = static_var("Schroedingers_cat", schar, FALSE);

/* called as signal() handler, so sent at least one arg */
/*ARGSUSED*/
export function done1(sig_unused) { /* void */
    signal(SIGINT, SIG_IGN);

    iflags.debug_fuzzer = fuzzer_off;
    if (flags.ignintr) {
        signal(SIGINT, done1);

        clear_nhwindow()(WIN_MESSAGE);
        curs_on_u();
        wait_synch()();
        if (gm.multi > 0)
            nomul(0);
    } else {
        done2();
    }
}

/* "#quit" command or keyboard interrupt */
export function done2() { /* int */
    let abandon_tutorial = FALSE;

    if (In_tutorial(u.uz)
        && y_n(_("Switch from the tutorial back to regular play?")) == ord('y'))
        abandon_tutorial = TRUE;

    if (abandon_tutorial || !paranoid_query(
            ParanoidQuit(), _("Really quit without saving?"))) {
        signal(SIGINT, done1);

        clear_nhwindow()(WIN_MESSAGE);
        curs_on_u();
        wait_synch()();
        if (gm.multi > 0)
            nomul(0);
        if (gm.multi == 0) {
            u.uinvulnerable = FALSE; /* avoid ctrl-C bug -dlc */
            u.usleep = 0;
        }

        if (abandon_tutorial)
            schedule_goto(u.ucamefrom, UTOTYPE_ATSTAIRS,
                          _("Resuming regular play."), 0);
        return ECMD_OK;
    }

    if (wizard()) {
        let c;

        c = ynq(_("Dump core?"));

        if (c == ord('y')) {
            signal(SIGINT, done1);

            if (soundprocs.sound_exit_nhsound)
                soundprocs.sound_exit_nhsound(_("done2"));

            exit_nhwindows()(0);
            NH_abort(0);
        } else if (c == ord('q'))
            program_state.stopprint++;
    }

    done(QUIT);
    return ECMD_OK;
}

/* called as signal() handler, so sent at least 1 arg */
/*ARGSUSED*/
function done_intr(sig_unused) { /* void */
    program_state.stopprint++;
    signal(SIGINT, SIG_IGN);

    signal(SIGQUIT, SIG_IGN);

    return;
}

/* signal() handler */
function done_hangup(sig) { /* void */
    program_state.done_hup++;

    sethanguphandler(SIG_IGN);
    done_intr(sig);
    return;
}

 /* one compiler warns if the format
                                     string is the result of a ? x : y */

export function done_in_by(mtmp, how) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ);
    let mptr = mtmp.data,
                    champtr = ismnum(mtmp.cham) ? mons[mtmp.cham]
                                                  : mptr;
    let distorted = (Hallucination() && canspotmon(mtmp) ? 1 : 0),
            mimicker = +(M_AP_TYPE(mtmp) == M_AP_MONSTER),
            imitator = (mptr != champtr || mimicker ? 1 : 0);

    You((how == STONING) ? _("turn to stone...") : _("die..."));
    mark_synch()(); /* flush buffered screen output */
    chars[buf + 0] = ord('\0');
    svk.killer.format = KILLED_BY_AN;
    /* "killed by the high priest of Crom" is okay,
       "killed by the high priest" alone isn't */
    if ((mptr.geno & G_UNIQ) != 0 && !(imitator && !mimicker)
        && !(mptr == mons[PM_HIGH_CLERIC] && !mtmp.ispriest)) {
        if (!type_is_pname(mptr))
            strcat(buf, _("the "));
        svk.killer.format = KILLED_BY;
    }
    /* _the_ <invisible> <distorted> ghost of Dudley */

    if (mptr == mons[PM_GHOST] && has_mgivenname(mtmp)) {
        strcat(buf, _("the "));
        svk.killer.format = KILLED_BY;
    }
    monhealthdescr(mtmp, TRUE, eos(buf));
    if (mtmp.minvis)
        strcat(buf, _("invisible "));
    if (distorted)
        strcat(buf, _("hallucinogen-distorted "));

    if (imitator) {
        let shape = stack_array(char, BUFSZ);
        let realnm = pmname(champtr, Mgender(mtmp)),
                   fakenm = pmname(mptr, Mgender(mtmp));
        let alt = is_vampshifter(mtmp);

        if (mimicker) {
            /* realnm is already correct because champtr==mptr;
               set up fake mptr for type_is_pname/the_unique_pm */
            mptr = mons[mtmp.mappearance];
            fakenm = pmname(mptr, Mgender(mtmp));
        } else if (alt && strstri(realnm, _("vampire"))
                   && !strcmp(fakenm, _("vampire bat"))) {
            /* special case: use "vampire in bat form" in preference
               to redundant looking "vampire in vampire bat form" */
            fakenm = _("bat");
        }
        /* for the alternate format, always suppress any article;
           pname and the_unique should also have s_suffix() applied,
           but vampires don't take on any shapes which warrant that */
        if (alt || type_is_pname(mptr)) /* no article */
            strcpy(shape, fakenm);
        else if (the_unique_pm(mptr)) /* "the"; don't use the() here */
            sprintf(shape, _("the %s"), fakenm);
        else /* "a"/"an" */
            strcpy(shape, an(fakenm));
        /* omit "called" to avoid excessive verbosity */
        sprintf(eos(buf), alt ? _("%s in %s form")
                    : mimicker ? _("%s disguised as %s")
                               : _("%s imitating %s"), realnm, shape)

;
        mptr = mtmp.data; /* reset for mimicker case */
    } else if (mptr == mons[PM_GHOST]) {
        strcat(buf, _("ghost"));
        if (has_mgivenname(mtmp))
            sprintf(eos(buf), _(" of %s"), MGIVENNAME(mtmp));
    } else if (mtmp.isshk) {
        let shknm = shkname(mtmp),
                   honorific = shkname_is_pname(mtmp) ? _("")
                                   : mtmp.female ? _("Ms. ") : _("Mr. ");

        sprintf(eos(buf), _("%s%s, the shopkeeper"), honorific, shknm);
        svk.killer.format = KILLED_BY;
    } else if (mtmp.ispriest || mtmp.isminion) {
        /* m_monnam() suppresses "the" prefix plus "invisible", and
           it overrides the effect of Hallucination on priestname() */
        strcat(buf, m_monnam(mtmp));
    } else {
        strcat(buf, pmname(mptr, Mgender(mtmp)));
        if (has_mgivenname(mtmp)) {
            sprintf(eos(buf), _(" %s %s"), has_ebones(mtmp) ? _("of") : _("called"), MGIVENNAME(mtmp))

;
        }
    }

    strcpy(svk.killer.name, buf);

    /* might need to fix up multi_reason if 'mtmp' caused the reason */
    if (gm.multi_reason
        && gm.multi_reason > gm.multireasonbuf
        && gm.multi_reason
           < gm.multireasonbuf + sizeof_member(gm, "multireasonbuf") - 1) {
        let reasondummy = stack_var(char), p;
        let reasonmid = stack_var(unsigned, 0);

        /*
         * multireasonbuf[] contains 'm_id:reason' and multi_reason
         * points at the text past the colon, so we have something
         * like "42:paralyzed by a ghoul"; if mtmp->m_id matches 42
         * then we truncate 'reason' at its first space so that final
         * death reason becomes "Killed by a ghoul, while paralyzed."
         * instead of "Killed by a ghoul, while paralyzed by a ghoul."
         * (3.6.x gave "Killed by a ghoul, while paralyzed by a monster."
         * which is potentially misleading when the monster is also
         * the killer.)
         *
         * Note that if the hero is life-saved and then killed again
         * before the helplessness has cleared, the second death will
         * report the truncated helplessness reason even if some other
         * monster performs the /coup de grace/.
         */
        if (sscanf(gm.multireasonbuf, _("%u:%c"), reasonmid, addr_of(reasondummy)) == 2
            && mtmp.m_id == reasonmid[0]) {
            if ((p = strchr(gm.multireasonbuf, ord(' '))) != 0)
                chars[p] = ord('\0');
        }
    }

    /*
     * Chicken and egg issue:
     *  Ordinarily Unchanging ought to override something like this,
     *  but the transformation occurs at death.  With the current code,
     *  the effectiveness of Unchanging stops first, but a case could
     *  be made that it should last long enough to prevent undead
     *  transformation.  (Turning to slime isn't an issue here because
     *  Unchanging prevents that from happening.)
     */
    if (mptr.mlet == S_WRAITH)
        u.ugrave_arise = PM_WRAITH;
    else if (mptr.mlet == S_MUMMY && gu.urace.mummynum != NON_PM)
        u.ugrave_arise = gu.urace.mummynum;
    else if (zombie_maker(mtmp) && gu.urace.zombienum != NON_PM)
        u.ugrave_arise = gu.urace.zombienum;
    else if (mptr.mlet == S_VAMPIRE && Race_if(PM_HUMAN))
        u.ugrave_arise = PM_VAMPIRE;
    else if (mptr == mons[PM_GHOUL])
        u.ugrave_arise = PM_GHOUL;
    /* this could happen if a high-end vampire kills the hero
       when ordinary vampires are genocided; ditto for wraiths */
    if (u.ugrave_arise >= LOW_PM
        && (svm.mvitals[u.ugrave_arise].mvflags & G_GENOD))
        u.ugrave_arise = NON_PM;

    done(how);
    return;
    } finally { stack_pop($frame); }
}

/* some special cases for overriding while-helpless reason */
  const struct___anon1 = struct("end.struct___anon1", {
    why: int, unmulti: int,
    exclude: ptr_to(char), include: ptr_to(char),
}); const death_fixups = static_array("death_fixups", struct___anon1, null, [
    /* "petrified by <foo>, while getting stoned" -- "while getting stoned"
       prevented any last-second recovery, but it was not the cause of
       "petrified by <foo>" */
    { why: STONING, unmulti: 1, exclude: _("getting stoned"), include: 0 },
    /* "died of starvation, while fainted from lack of food" is accurate
       but sounds a fairly silly (and doesn't actually appear unless you
       splice together death and while-helpless from xlogfile) */
    { why: STARVING, unmulti: 0, exclude: _("fainted from lack of food"), include: _("fainted") },
]);

/* clear away while-helpless when the cause of death caused that
   helplessness (ie, "petrified by <foo> while getting stoned") */
function fixup_death(how) { /* void */
    let i;

    if (gm.multi_reason) {
        for (i = 0; i < SIZE(death_fixups); ++i)
            if (death_fixups[i].why == how
                && !strcmp(death_fixups[i].exclude, gm.multi_reason)) {
                if (death_fixups[i].include) /* substitute alternate reason */
                    gm.multi_reason = death_fixups[i].include;
                else /* remove the helplessness reason */
                    gm.multi_reason = 0;
                chars[gm.multireasonbuf + 0] = ord('\0'); /* dynamic buf stale either way */
                if (death_fixups[i].unmulti) /* possibly hide helplessness */
                    gm.multi = 0;
                break;
            }
    }
}

/*VARARGS1*/
 export function panic(str, ...args) { /* void */
    const $frame = stack_frame(); try { let the_args; {
    let buf = stack_array(char, BUFSZ);
    the_args = va_start(args);
      ;

    if (program_state.panicking++)
        NH_abort(0); /* avoid loops - this should never happen*/

    gb.bot_disabled = TRUE;
    if (iflags.window_inited) {
        raw_print()(_("\r\nOops..."));
        wait_synch()(); /* make sure all pending output gets flushed */
        if (soundprocs.sound_exit_nhsound)
            soundprocs.sound_exit_nhsound(_("panic"));
        exit_nhwindows()(0);
        iflags.window_inited = FALSE; /* they're gone; force raw_print()ing */
    }

    raw_print()(program_state.gameover
                  ? _("Postgame wrapup disrupted.")
                  : !program_state.something_worth_saving
                        ? _("Program initialization has failed.")
                        : _("Suddenly, the dungeon collapses."));

    if (!wizard()) {
        let maybe_rebuild = !program_state.something_worth_saving
                                     ? _(".")
                                     : _("\nand it may be possible to rebuild.");

// XXX this may need an update if defined(CRASHREPORT) TBD
        if (sysopt.support)
            raw_printf(_("To report this error, %s%s"), sysopt.support,
                       maybe_rebuild);
        else if (sysopt.fmtd_wizard_list) /* formatted SYSCF WIZARDS */
            raw_printf(_("To report this error, contact %s%s"),
                       sysopt.fmtd_wizard_list, maybe_rebuild);
        else
            raw_printf(_("Report error to \"%s\"%s"), _(WIZARD_NAME),
                       maybe_rebuild);
    }

    /* XXX can we move this above the prints?  Then we'd be able to
     * suppress "it may be possible to rebuild" based on dosave0()
     * or say it's NOT possible to rebuild. */
    if (program_state.something_worth_saving && !iflags.debug_fuzzer) {
        set_error_savefile();
        if (dosave0()) {
            /* os/win port specific recover instructions */
            if (sysopt.recover)
                raw_printf(_("%s"), sysopt.recover);
        }
    }

    vsnprintf(buf, sizeof(array_of(char, BUFSZ)), str, the_args);
    raw_print()(buf);
    paniclog(_("panic"), buf);

    if (wizard())

        NH_abort(buf); /* generate core dump */

    va_end(the_args) } ; really_done(PANICKED); } finally { stack_pop($frame); } }

function should_query_disclose_option(category, defquery) { /* boolean */
    let idx;
    let disclose;
    let dop;

    chars[defquery] = ord('n');
    if ((dop = strchr(disclosure_options, category)) != 0) {
        idx = (dop - disclosure_options);
        if (idx < 0 || idx >= NUM_DISCLOSURE_OPTIONS) {
            impossible(
                   _("should_query_disclose_option: bad disclosure index %d %c"),
                       idx, category);
            chars[defquery] = DISCLOSE_PROMPT_DEFAULT_YES;
            return TRUE;
        }
        disclose = chars[flags.end_disclose + idx];
        if (disclose == DISCLOSE_YES_WITHOUT_PROMPT) {
            chars[defquery] = ord('y');
            return FALSE;
        } else if (disclose == DISCLOSE_SPECIAL_WITHOUT_PROMPT) {
            chars[defquery] = ord('a');
            return FALSE;
        } else if (disclose == DISCLOSE_NO_WITHOUT_PROMPT) {
            chars[defquery] = ord('n');
            return FALSE;
        } else if (disclose == DISCLOSE_PROMPT_DEFAULT_YES) {
            chars[defquery] = ord('y');
            return TRUE;
        } else if (disclose == DISCLOSE_PROMPT_DEFAULT_SPECIAL) {
            chars[defquery] = ord('a');
            return TRUE;
        } else {
            chars[defquery] = ord('n');
            return TRUE;
        }
    }
    impossible(_("should_query_disclose_option: bad category %c"), category);
    return TRUE;
}

/* #ifdef DUMPLOG: not in this build */

/*ARGSUSED*/
function dump_everything(
    how,
    when) { /* void */ /* date+time at end of game */
    /* #ifdef DUMPLOG: not in this build */

    (how);
    (when);
}

function disclose(how, taken) { /* void */
    const $frame = stack_frame(); try {
    let c = ord('\0'), defquery = stack_var(char);
    let qbuf = stack_array(char, QBUFSZ);
    let ask = FALSE;

    if (gi.invent && !done_stopprint()) {
        if (taken)
            sprintf(qbuf, _("Do you want to see what you had when you %s?"), (how == QUIT) ? _("quit") : _("died"));
        else
            strcpy(qbuf, _("Do you want your possessions identified?"))
;

        ask = should_query_disclose_option(ord('i'), addr_of(defquery));
        c = ask ? yn_function(qbuf, ynqchars, defquery[0], TRUE) : defquery[0];
        if (c == ord('y')) {
            /* caller has already ID'd everything; we pass 'want_reply=True'
               to force display_pickinv() to avoid using WIN_INVENT */
            iflags.force_invmenu = FALSE;
            display_inventory(0, TRUE);
            container_contents(gi.invent, TRUE, TRUE, FALSE);
        }
        if (c == ord('q'))
            program_state.stopprint++;
    }

    if (!done_stopprint()) {
        ask = should_query_disclose_option(ord('a'), addr_of(defquery));
        c = ask ? yn_function(_("Do you want to see your attributes?"), ynqchars,
                              defquery[0], TRUE)
                : defquery[0];
        if (c == ord('y'))
            enlightenment((BASICENLIGHTENMENT | MAGICENLIGHTENMENT),
                          (how >= PANICKED) ? ENL_GAMEOVERALIVE
                                            : ENL_GAMEOVERDEAD);
        if (c == ord('q'))
            program_state.stopprint++;
    }

    if (!done_stopprint()) {
        ask = should_query_disclose_option(ord('v'), addr_of(defquery));
        list_vanquished(defquery[0], ask);
    }

    if (!done_stopprint()) {
        ask = should_query_disclose_option(ord('g'), addr_of(defquery));
        list_genocided(defquery[0], ask);
    }

    if (!done_stopprint()) {
        if (should_query_disclose_option(ord('c'), addr_of(defquery))) {
            let acnt = count_achievements();

            sprintf(qbuf, _("Do you want to see your conduct%s?"), (acnt > 0) ? _(" and achievements") : _(""))

;
            c = yn_function(qbuf, ynqchars, defquery[0], TRUE);
        } else {
            c = defquery[0];
        }
        if (c == ord('y'))
            show_conduct((how >= PANICKED) ? 1 : 2);
        if (c == ord('q'))
            program_state.stopprint++;
    }

    if (!done_stopprint()) {
        ask = should_query_disclose_option(ord('o'), addr_of(defquery));
        c = ask ? yn_function(_("Do you want to see the dungeon overview?"),
                              ynqchars, defquery[0], TRUE)
                : defquery[0];
        if (c == ord('y'))
            show_overview((how >= PANICKED) ? 1 : 2, how);
        if (c == ord('q'))
            program_state.stopprint++;
    }
    } finally { stack_pop($frame); }
}

/* try to get the player back in a viable state after being killed */
function savelife(how) { /* void */
    let uhpmin;
    let givehp = 50 + 10 * Math.trunc(ACURR(A_CON) / 2);

    /* life-drain/level-loss to experience level 0 kills without actually
       reducing ulevel below 1, but include this for bulletproofing */
    if (u.ulevel < 1)
        u.ulevel = 1;
    uhpmin = minuhpmax(10);
    if (u.uhpmax < uhpmin)
        setuhpmax(uhpmin, TRUE);
    u.uhp = min(u.uhpmax, givehp);
    if (Upolyd()) /* Unchanging, or death which bypasses losing hit points */
        u.mh = min(u.mhmax, givehp);
    if (u.uhunger < 500 || how == CHOKING) {
        init_uhunger();
    }
    /* cure impending doom of sickness hero won't have time to fix
       [shouldn't this also be applied to other fatal timeouts?] */
    if ((Sick() & TIMEOUT) == 1) {
        make_sick(0, 0, FALSE, SICK_ALL);
    }
    gn.nomovemsg = _("You survived that attempt on your life.");
    svc.context.move = 0;

    gm.multi = -1; /* can't move again during the current turn */
    /* in case being life-saved is immediately followed by being killed
       again (perhaps due to zap rebound); this text will be appended to
          "killed by <something>, while "
       in high scores entry, if any, and in logfile (but not on tombstone) */
    gm.multi_reason = Role_if(PM_TOURIST) ? _("being toyed with by Fate")
                                          : _("attempting to cheat Death");

    if (u.utrap && u.utraptype == TT_LAVA)
        reset_utrap(FALSE);
    disp.botl = TRUE;
    u.ugrave_arise = NON_PM;
    u.uprops[UNCHANGING].intrinsic = 0;
    curs_on_u();
    if (!svc.context.mon_moving)
        endmultishot(FALSE);
    if (u.uswallow) {
        /* might drop hero onto a trap that kills her all over again */
        expels(u.ustuck, u.ustuck.data, TRUE);
    } else if (u.ustuck) {
        if (Upolyd() && sticks(gy.youmonst.data))
            You(_("release %s."), mon_nam(u.ustuck));
        else
            pline(_("%s releases you."), Monnam(u.ustuck));
        unstuck(u.ustuck);
    }
}

/*
 * Get valuables from the given list.  Revised code: the list always remains
 * intact.
 */
function get_valuables(list) { /* void */ /* inventory or container contents */
    let obj;
    let i;

    /* find amulets and gems, ignoring all artifacts */
    for (obj = list; obj; obj = obj.nobj)
        if (Has_contents(obj)) {
            get_valuables(obj.cobj);
        } else if (obj.oartifact) {
            continue;
        } else if (obj.oclass == AMULET_CLASS) {
            i = obj.otyp - FIRST_AMULET;
            if (!ga.amulets[i].count) {
                ga.amulets[i].count = obj.quan;
                ga.amulets[i].typ = obj.otyp;
            } else
                ga.amulets[i].count += obj.quan; /* always adds one */
        } else if (obj.oclass == GEM_CLASS && obj.otyp <= LAST_GLASS_GEM) {
            /* last+1: combine all glass gems into one slot */
            i = min(obj.otyp, LAST_REAL_GEM + 1) - FIRST_REAL_GEM;
            if (!gg.gems[i].count) {
                gg.gems[i].count = obj.quan;
                gg.gems[i].typ = obj.otyp;
            } else
                gg.gems[i].count += obj.quan;
        }
    return;
}

/*
 *  Sort collected valuables, most frequent to least.  We could just
 *  as easily use qsort, but we don't care about efficiency here.
 */
function sort_valuables(
    list,
    size) { /* void */ /* max value is less than 20 */
    const $frame = stack_frame(); try {
    let i, j;
    let ltmp = stack_struct(struct_valuable_data);

    /* move greater quantities to the front of the list */
    for (i = 1; i < size; i++) {
        if (ptr_add(list, i).count == 0)
            continue;   /* empty slot */
        struct_assign(ltmp, ptr_add(list, i)); /* structure copy */
        for (j = i; j > 0; --j) {
            if (ptr_add(list, j - 1).count >= ltmp.count)
                break;
            struct_assign(ptr_add(list, j), ptr_add(list, j - 1));
        }
        struct_assign(ptr_add(list, j), ltmp);
    }
    return;
    } finally { stack_pop($frame); }
}

/* #if 0: not in this build */

/* deal with some objects which may be in an abnormal state at end of game */
export function done_object_cleanup() { /* void */
    let ox, oy;

    /* might have been killed while using a disposable item, so make sure
       it's gone prior to inventory disclosure and creation of bones */
    inven_inuse(TRUE);
    /*
     * Hero can die when throwing an object (by hitting an adjacent
     * gas spore, for instance, or being hit by mis-returning Mjollnir),
     * or while in transit (from falling down stairs).  If that happens,
     * some object(s) might be in limbo rather than on the map or in
     * any inventory.  Saving bones with an active light source in limbo
     * would trigger an 'object not local' panic.
     *
     * We used to use dealloc_obj() on gt.thrownobj and gk.kickedobj but
     * that keeps them out of bones and could leave uball in a confused
     * state (gone but still attached).  Place them on the map but
     * bypass flooreffects().  That could lead to minor anomalies in
     * bones, like undamaged paper at water or lava locations or piles
     * not being knocked down holes, but it seems better to get this
     * game over with than risk being tangled up in more and more details.
     */
    ox = u.ux + u.dx, oy = u.uy + u.dy;
    if (!isok(ox, oy) || !accessible(ox, oy))
        ox = u.ux, oy = u.uy;
    /* put thrown or kicked object on map (for bones); location might
       be incorrect (perhaps killed by divine lightning when throwing at
       a temple priest?) but this should be better than just vanishing
       (fragile stuff should be taken care of before getting here) */
    if (gt.thrownobj && gt.thrownobj.where == OBJ_FREE) {
        place_object(gt.thrownobj, ox, oy);
        stackobj(gt.thrownobj), gt.thrownobj = null;
    }
    if (gk.kickedobj && gk.kickedobj.where == OBJ_FREE) {
        place_object(gk.kickedobj, ox, oy);
        stackobj(gk.kickedobj), gk.kickedobj = null;
    }
    /* if Punished hero dies during level change or dies or quits while
       swallowed, uball and uchain will be in limbo; put them on floor
       so bones will have them and object list cleanup finds them */
    if (uchain && uchain.where == OBJ_FREE) {
        /* placebc(); */
        lift_covet_and_placebc(override_restriction);
    }
    /* persistent inventory window now obsolete since disclosure uses
       a normal popup one; avoids "Bad fruit #n" when saving bones */
    if (iflags.perm_invent) {
        iflags.perm_invent = FALSE;
        perm_invent_toggled(TRUE); /* make interface notice the change */
    }
    return;
}

/* called twice; first to calculate total, then to list relevant items */
function artifact_score(
    list,
    counting,
    endwin) { /* void */
    const $frame = stack_frame(); try {
    let pbuf = stack_array(char, BUFSZ);
    let otmp;
    let value, points;

    for (otmp = list; otmp; otmp = otmp.nobj) {
        if (otmp.oartifact || otmp.otyp == BELL_OF_OPENING
            || otmp.otyp == SPE_BOOK_OF_THE_DEAD
            || otmp.otyp == CANDELABRUM_OF_INVOCATION) {
            value = arti_cost(otmp); /* zorkmid value */
            points = Math.trunc(value * 5 / 2);  /* score value */
            if (counting) {
                u.urexp = nowrap_add(u.urexp, points);
            } else {
                discover_object(otmp.otyp, TRUE, TRUE, FALSE);
                /* not observe_object; dead characters don't observe */
                otmp.known = otmp.dknown = otmp.bknown = otmp.rknown = 1;
                /* assumes artifacts don't have quan > 1 */
                sprintf(pbuf, _("%s%s (worth %lld %s and %lld points)"), the_unique_obj(otmp) ? _("The ") : _(""), otmp.oartifact ? artiname(otmp.oartifact)
                                        : OBJ_NAME(objects[otmp.otyp]), value, currency(value), points)

;
                putstr()(endwin, 0, pbuf);
            }
        }
        if (Has_contents(otmp))
            artifact_score(otmp.cobj, counting, endwin);
    }
    } finally { stack_pop($frame); }
}

/* when dying while running the debug fuzzer, [almost] always keep going;
   True: forced survival; False: doomed unless wearing life-save amulet */
function fuzzer_savelife(how) { /* boolean */
    /*
     * Some debugging code pulled out of done() to unclutter it.
     * 'done_seq' is maintained in done().
     */
    if (!program_state.panicking && how != PANICKED && how != TRICKED) {
        savelife(how);

        /* periodically restore characteristics plus lost experience
           levels or cure lycanthropy or both; those conditions make the
           hero vulnerable to repeat deaths (often by becoming surrounded
           while being too encumbered to do anything) */
        if (!rn2((gd.done_seq > gh.hero_seq + 2) ? 2 : 10)) {
            let potion;
            let propidx, proptim, remedies = 0;

            /* get rid of temporary potion with obfree() rather than useup()
               because it doesn't get entered into inventory */
            if (ismnum(u.ulycn) && !rn2(3)) {
                potion = mksobj(POT_WATER, TRUE, FALSE);
                bless(potion);
                peffects(potion);
                obfree(potion, null);
                ++remedies;
            }
            if (!remedies || rn2(3)) {
                potion = mksobj(POT_RESTORE_ABILITY, TRUE, FALSE);
                bless(potion);
                peffects(potion);
                obfree(potion, null);
                ++remedies;
            }
            if (!rn2(3 + 3 * remedies)) {
                /* confer temporary resistances for first 8 properties:
                   fire, cold, sleep, disint, shock, poison, acid, stone */
                for (propidx = 1; propidx <= 8; ++propidx) {
                    if (!u.uprops[propidx].intrinsic
                        && !u.uprops[propidx].extrinsic
                        && (proptim = rn2(3)) > 0) /* 0..2 */
                        set_itimeout(ref_of(u.uprops[propidx], "intrinsic"),
                                     (2 * proptim + 1)); /* 3 or 5 */
                }
                ++remedies;
            }
            if (!rn2(5 + 5 * remedies)) {
                ; /* might confer temporary Antimagic (magic resistance)
                   * or even Invulnerable */
            }
        }
        /* clear stale cause of death info after life-saving */
        chars[svk.killer.name + 0] = ord('\0');
        svk.killer.format = 0;

        /*
         * Guard against getting stuck in a loop if we die in one of
         * the few ways where life-saving isn't effective (cited case
         * was burning in lava when the level was too full to allow
         * teleporting to safety).  Deal with it by recreating the level
         * if we're in wizmode (always the case for debug_fuzzer unless
         * player has used a debugger to fiddle with 'iflags' bits).
         */
        if (gd.done_seq++ > gh.hero_seq + 100) {
            if (!wizard())
                return FALSE; /* can't deal with it */
            cmdq_add_ec(CQ_CANNED, wiz_makemap);
        }

        return TRUE;
    }
    return FALSE; /* panic or too many consecutive deaths */
}

/* Be careful not to call panic from here! */
export function done(how) { /* void */
    const $frame = stack_frame(); try {
    let survive = FALSE;

    if (how == TRICKED) {
        if (chars[svk.killer.name + 0]) {
            paniclog(_("trickery"), svk.killer.name);
            chars[svk.killer.name + 0] = ord('\0');
        }
        if (wizard()) {
            /* Suppress message for deterministic replay. */
            /* You("are a very tricky wizard, it seems."); */
            svk.killer.format = KILLED_BY_AN; /* reset to 0 */
            return;
        }
    }
    if (program_state.panicking

        || program_state.done_hup

        || (how == QUIT && done_stopprint())) {
        /* skip status update if panicking or disconnected
           or answer of 'q' to "Really quit?" */
        disp.botl = disp.botlx = disp.time_botl = FALSE;
    } else {
        /* otherwise force full status update */
        disp.botlx = TRUE;
        bot();
    }

    /* hero_seq is (moves<<3 + n) where n is number of moves made
       by the hero on the current turn (since the 'moves' variable
       actually counts turns); its details shouldn't matter here;
       used by fuzzer_savelife() and for hangup below */
    if (gd.done_seq < gh.hero_seq)
        gd.done_seq = gh.hero_seq;

    if (iflags.debug_fuzzer) {
        if (fuzzer_savelife(how))
            return;
    }

    if (how == ASCENDED || (!chars[svk.killer.name + 0] && how == GENOCIDED))
        svk.killer.format = NO_KILLER_PREFIX;
    /* Avoid killed by "a" burning or "a" starvation */
    if (!chars[svk.killer.name + 0] && (how == STARVING || how == BURNING))
        svk.killer.format = KILLED_BY;
    if (!chars[svk.killer.name + 0] || how >= PANICKED)
        strcpy(svk.killer.name, deaths[how]);

    if (how < PANICKED) {
        u.umortality++;
        /* in case caller hasn't already done this */
        if (u.uhp != 0 || (Upolyd() && u.mh != 0)) {
            /* force HP to zero in case it is still positive (some
               deaths aren't triggered by loss of hit points), or
               negative (-1 is used as a flag in some circumstances
               which don't apply when actually dying due to HP loss) */
            u.uhp = u.mh = 0;
            disp.botl = TRUE;
        }
    }
    if (Lifesaved() && (how <= GENOCIDED)) {
        pline(_("But wait..."));
        /* assumes that only one type of item confers LifeSaved property */
        makeknown(AMULET_OF_LIFE_SAVING);
        Your(_("medallion %s!"), !Blind() ? _("begins to glow") : _("feels warm"));
        if (how == CHOKING)
            You(_("vomit ..."));
        You_feel(_("much better!"));
        pline_The(_("medallion crumbles to dust!"));
        if (uamul)
            useup(uamul);

        adjattrib(A_CON, -1, TRUE);
        savelife(how);
        if (how == GENOCIDED) {
            pline(_("Unfortunately you are still genocided..."));
        } else {
            let killbuf = stack_array(char, BUFSZ);
            formatkiller(killbuf, BUFSZ, how, FALSE);
            livelog_printf(LL_LIFESAVE, _("averted death (%s)"), killbuf);
            survive = TRUE;
        }
    }
    /* explore and wizard modes offer player the option to keep playing */
    if (!survive && (wizard() || discover()) && how <= GENOCIDED

        /* if hangup has occurred, the only possible answer to a paranoid
           query is 'no'; we want 'no' as the default for "Die?" but can't
           accept it more than once if there's no user supplying it */
        && !(program_state.done_hup && gd.done_seq++ == gh.hero_seq)

        && !paranoid_query(ParanoidDie(), _("Die?"))) {
        pline(_("OK, so you don't %s."), (how == CHOKING) ? _("choke") : _("die"));
        iflags.last_msg = PLNMSG_OK_DONT_DIE;
        savelife(how);
        survive = TRUE;
    }

    if (survive) {
        chars[svk.killer.name + 0] = ord('\0');
        svk.killer.format = KILLED_BY_AN; /* reset to 0 */
        return;
    }
    really_done(how);
    /*NOTREACHED*/
    } finally { stack_pop($frame); }
}

/* separated from done() in order to specify the __noreturn__ attribute */
function really_done(how) { /* void */
    const $frame = stack_frame(); try {
    let taken;
    let pbuf = stack_array(char, BUFSZ);
    let endwin = WIN_ERR;
    let bones_ok, have_windows = iflags.window_inited;
    let corpse = null;
    let endtime;
    let umoney;
    let tmp;

    /*
     *  The game is now over...
     */
    program_state.gameover = 1;
    /* in case of a subsequent panic(), there's no point trying to save */
    program_state.something_worth_saving = 0;

    if (program_state.done_hup)
        program_state.stopprint++;

    /* render vision subsystem inoperative */
    iflags.vision_inited = FALSE;

    /* maybe use up active invent item(s), place thrown/kicked missile,
       deal with ball and chain possibly being temporarily off the map */
    if (!program_state.panicking)
        done_object_cleanup();
    /* in case we're panicking; normally cleared by done_object_cleanup() */
    iflags.perm_invent = FALSE;

    /* remember time of death here instead of having bones, rip, and
       topten figure it out separately and possibly getting different
       time or even day if player is slow responding to --More-- */
    urealtime.finish_time = endtime = getnow();
    urealtime.realtime += timet_delta(endtime, urealtime.start_timing);
    /* collect these for end of game disclosure (not used during play) */
    iflags.at_night = night();
    iflags.at_midnight = midnight();

    /* final achievement tracking; only show blind and nudist if some
       tangible progress has been made; always show ascension last */
    if (chars[u.uachieved + 0] || !flags.beginner) {
        if (u.uroleplay.blind)
            record_achievement(ACH_BLND); /* blind the whole game */
        if (u.uroleplay.nudist)
            record_achievement(ACH_NUDE); /* never wore armor */
    }
    if (how == ASCENDED)
        record_achievement(ACH_UWIN);

    dump_open_log(endtime);
    /* Sometimes you die on the first move.  Life's not fair.
     * On those rare occasions you get hosed immediately, go out
     * smiling... :-)  -3.
     */
    if (svm.moves <= 1 && how < PANICKED && !done_stopprint())
        pline(_("Do not pass Go.  Do not collect 200 %s."), currency(200));

    if (have_windows)
        wait_synch()(); /* flush screen output */

    signal(SIGINT, done_intr);

    signal(SIGQUIT, done_intr);

    sethanguphandler(done_hangup);

    bones_ok = ((how < GENOCIDED) && can_make_bones() ? 1 : 0);

    if (bones_ok && launch_in_progress())
        force_launch_placement();

    /* maintain ugrave_arise even for !bones_ok */
    if (how == PANICKED)
        u.ugrave_arise = (NON_PM - 3); /* no corpse, no grave */
    else if (how == BURNING || how == DISSOLVED) /* corpse burns up too */
        u.ugrave_arise = (NON_PM - 2); /* leave no corpse */
    else if (how == STONING)
        u.ugrave_arise = LEAVESTATUE; /* statue instead of corpse */
    else if (how == TURNED_SLIME
             /* it's possible to turn into slime even though green slimes
                have been genocided:  genocide could occur after hero is
                already infected or hero could eat a glob of one created
                before genocide; don't try to arise as one if they're gone */
             && !(svm.mvitals[PM_GREEN_SLIME].mvflags & G_GENOD))
        u.ugrave_arise = PM_GREEN_SLIME;

    if (how == QUIT) {
        svk.killer.format = NO_KILLER_PREFIX;
        if (u.uhp < 1) {
            how = DIED;
            u.umortality++; /* skipped above when how==QUIT */
            strcpy(svk.killer.name, _("quit while already on Charon's boat"));
        }
    }
    if (how == ESCAPED || how == PANICKED)
        svk.killer.format = NO_KILLER_PREFIX;

    fixup_death(how); /* actually, fixup gm.multi_reason */

    if (how != PANICKED) {
        let silently = done_stopprint() ? TRUE : FALSE;

        /* these affect score and/or bones, but avoid them during panic */
        taken = paybill((how == ESCAPED) ? -1 : +(how != QUIT), silently);
        paygd(silently);
        clearpriests();
    } else
        taken = FALSE; /* lint; assert( !bones_ok ); */

    clearlocks();

    if (have_windows)
        display_nhwindow()(WIN_MESSAGE, FALSE);

    if (how != PANICKED) {
        let obj, nextobj;

        /*
         * This is needed for both inventory disclosure and dumplog.
         * Both are optional, so do it once here instead of duplicating
         * it in both of those places.
         */
        for (obj = gi.invent; obj; obj = nextobj) {
            nextobj = obj.nobj;
            discover_object(obj.otyp, TRUE, TRUE, FALSE);
            /* observe_object not necessary after discover_object */
            obj.known = obj.bknown = obj.dknown = obj.rknown = 1;
            set_cknown_lknown(obj); /* set flags when applicable */
            /* we resolve Schroedinger's cat now in case of both
               disclosure and dumplog, where the 50:50 chance for
               live cat has to be the same both times */
            if (SchroedingersBox(obj)) {
                if (!Schroedingers_cat[0]) {
                    /* tell observe_quantum_cat() not to create a cat; if it
                       chooses live cat in this situation, it will leave the
                       SchroedingersBox flag set (for container_contents()) */
                    observe_quantum_cat(obj, FALSE, FALSE);
                    if (SchroedingersBox(obj))
                        Schroedingers_cat[0] = TRUE;
                } else
                    obj.spe = 0; /* ordinary box with cat corpse in it */
            }
        }

        if (strcmp(flags.end_disclose, _("none")))
            disclose(how, taken);

        /* it would be better to do this after killer.name fixups but
           that comes too late; included in final dumplog but might be
           excluded by active livelog */
        formatkiller(pbuf, sizeof(array_of(char, BUFSZ)), how, TRUE);
        if (!chars[pbuf])
            strcpy(pbuf, deaths[how]);
        livelog_printf(LL_DUMP, _("%s"), pbuf);

        dump_everything(how, endtime);
    }

    /* if pets will contribute to score, populate gm.mydogs list now
       (bones creation isn't a factor, but pline() messaging is; used to
       be done even sooner, but we need it to come after dump_everything()
       so that any accompanying pets are still on the map during dump) */
    if (how == ESCAPED || how == ASCENDED)
        keepdogs(TRUE);

    /* finish_paybill should be called after disclosure but before bones */
    if (bones_ok && taken)
        finish_paybill();

    /* grave creation should be after disclosure so it doesn't have
       this grave in the current level's features for #overview */
    if (bones_ok && u.ugrave_arise == NON_PM
        && !(svm.mvitals[u.umonnum].mvflags & G_NOCORPSE)) {
        /* Base corpse on race when not poly'd since original u.umonnum
           is based on role, and all role monsters are human. */
        let mnum = !Upolyd() ? gu.urace.mnum : u.umonnum,
            was_already_grave = IS_GRAVE(levl()[u.ux][u.uy].typ);

        corpse = mk_named_object(CORPSE, mons[mnum], u.ux, u.uy, svp.plname);
        sprintf(pbuf, _("%s, "), svp.plname);
        formatkiller(eos(pbuf), unsigned(sizeof(array_of(char, BUFSZ)) - Strlen(pbuf)), how, TRUE);
        make_grave(u.ux, u.uy, pbuf);
        if (IS_GRAVE(levl()[u.ux][u.uy].typ) && !was_already_grave)
            levl()[u.ux][u.uy].flags = 1; /* corpse isn't buried */
    }
    chars[pbuf + 0] = ord('\0'); /* clear grave text; also lint suppression */

    /* calculate score, before creating bones [container gold] */
    {
        let deepest = deepest_lev_reached(FALSE);

        umoney = money_cnt(gi.invent);
        tmp = u.umoney0;
        umoney += hidden_gold(TRUE); /* accumulate gold from containers */
        tmp = umoney - tmp;          /* net gain */

        if (tmp < 0)
            tmp = 0;
        if (how < PANICKED)
            tmp -= Math.trunc(tmp / 10);
        tmp += 50 * (deepest - 1);
        if (deepest > 20)
            tmp += 1000 * ((deepest > 30) ? 10 : deepest - 20);
        u.urexp = nowrap_add(u.urexp, tmp);

        /* ascension gives a score bonus iff offering to original deity */
        if (how == ASCENDED && u.ualign.type == chars[u.ualignbase + A_ORIGINAL]) {
            /* retaining original alignment: score *= 2;
               converting, then using helm-of-OA to switch back: *= 1.5 */
            tmp = (chars[u.ualignbase + A_CURRENT] == chars[u.ualignbase + A_ORIGINAL])
                      ? u.urexp
                      : Math.trunc(u.urexp / 2);
            u.urexp = nowrap_add(u.urexp, tmp);
        }
    }

    if (ismnum(u.ugrave_arise) && !done_stopprint()) {
        /* give this feedback even if bones aren't going to be created,
           so that its presence or absence doesn't tip off the player to
           new bones or their lack; it might be a lie if makemon fails */
        Your(_("%s as %s..."),
             (u.ugrave_arise != PM_GREEN_SLIME)
                 ? _("body rises from the dead")
                 : _("revenant persists"),
             an(pmname(mons[u.ugrave_arise], Ugender())));
        display_nhwindow()(WIN_MESSAGE, FALSE);
    }

    if (bones_ok) {
        if (!wizard() || paranoid_query(ParanoidBones(), _("Save bones?")))
            savebones(how, endtime, corpse);
        /* corpse may be invalid pointer now so
            ensure that it isn't used again */
        corpse = null;
    }

    /* update gold for the rip output, which can't use hidden_gold()
       (containers will be gone by then if bones just got saved...) */
    gd.done_money = umoney;

    /* clean up unneeded windows */
    if (have_windows) {
        wait_synch()();
        free_pickinv_cache(); /* extra persistent window if perm_invent */
        if (WIN_INVEN != WIN_ERR) {
            destroy_nhwindow()(WIN_INVEN),  WIN_INVEN = WIN_ERR;
            /* precaution in case any late update_inventory() calls occur */
            iflags.perm_invent = FALSE;
        }
        display_nhwindow()(WIN_MESSAGE, TRUE);
        destroy_nhwindow()(WIN_MAP),  WIN_MAP = WIN_ERR;
        if (WIN_STATUS != WIN_ERR)
            destroy_nhwindow()(WIN_STATUS),  WIN_STATUS = WIN_ERR;
        destroy_nhwindow()(WIN_MESSAGE),  WIN_MESSAGE = WIN_ERR;

        if (!done_stopprint() || flags.tombstone)
            endwin = create_nhwindow()(NHW_TEXT);

        if (how < GENOCIDED && flags.tombstone && endwin != WIN_ERR)
            outrip()(endwin, how, endtime);
    } else
        program_state.stopprint = 1; /* just avoid any more output */

    /* #ifdef DUMPLOG: not in this build */

    if (u.uhave.amulet) {
        strcat(svk.killer.name, _(" (with the Amulet)"));
    } else if (how == ESCAPED) {
        if (Is_astralevel(u.uz)) /* offered Amulet to wrong deity */
            strcat(svk.killer.name, _(" (in celestial disgrace)"));
        else if (carrying(FAKE_AMULET_OF_YENDOR))
            strcat(svk.killer.name, _(" (with a fake Amulet)"));
        /* don't bother counting to see whether it should be plural */
    }

    sprintf(pbuf, _("%s %s the %s..."), Goodbye(), svp.plname, (how != ASCENDED)
                ? ((flags.female && gu.urole.name.f)
                    ? gu.urole.name.f
                    : gu.urole.name.m)
                : (flags.female ? _("Demigoddess") : _("Demigod")))
;
    dump_forward_putstr(endwin, 0, pbuf, done_stopprint());
    dump_forward_putstr(endwin, 0, _(""), done_stopprint());

    if (how == ESCAPED || how == ASCENDED) {
        let mtmp;
        let otmp;
        let val;
        let i;

        for (val = gv.valuables[0]; val.list; val = ptr_add(val, 1))
            for (i = 0; i < val.size; i++) {
                ptr_add(val.list, i).count = 0;
            }
        get_valuables(gi.invent);

        /* add points for collected valuables */
        for (val = gv.valuables[0]; val.list; val = ptr_add(val, 1))
            for (i = 0; i < val.size; i++)
                if (ptr_add(val.list, i).count != 0) {
                    tmp = ptr_add(val.list, i).count
                          * (objects[ptr_add(val.list, i).typ].oc_cost);
                    u.urexp = nowrap_add(u.urexp, tmp);
                }

        /* count the points for artifacts */
        artifact_score(gi.invent, TRUE, endwin);

        uchars[gv.viz_array[0] + 0] |= IN_SIGHT; /* need visibility for naming */
        mtmp = gm.mydogs;
        strcpy(pbuf, _("You"));
        if (mtmp || Schroedingers_cat[0]) {
            while (mtmp) {
                sprintf(eos(pbuf), _(" and %s"), mon_nam(mtmp));
                if (mtmp.mtame)
                    u.urexp = nowrap_add(u.urexp, mtmp.mhp);
                mtmp = mtmp.nmon;
            }
            /* [it might be more robust to create a housecat and add it to
               gm.mydogs; it doesn't have to be placed on the map for that] */
            if (Schroedingers_cat[0]) {
                let mhp, m_lev = adj_lev(mons[PM_HOUSECAT]);

                mhp = d(m_lev, 8);
                u.urexp = nowrap_add(u.urexp, mhp);
                strcat(eos(pbuf), _(" and Schroedinger's cat"));
            }
            dump_forward_putstr(endwin, 0, pbuf, done_stopprint());
            chars[pbuf + 0] = ord('\0');
        } else {
            strcat(pbuf, _(" "));
        }
        sprintf(eos(pbuf), _("%s with %lld point%s,"), (how == ASCENDED) ? _("went to your reward")
                                  : _("escaped from the dungeon"), u.urexp, plur(u.urexp))

;
        dump_forward_putstr(endwin, 0, pbuf, done_stopprint());

        if (!done_stopprint())
            artifact_score(gi.invent, FALSE, endwin); /* list artifacts */

        /* list valuables here */
        for (val = gv.valuables[0]; val.list; val = ptr_add(val, 1)) {
            sort_valuables(val.list, val.size);
            for (i = 0; i < val.size && !done_stopprint(); i++) {
                let typ = ptr_add(val.list, i).typ;
                let count = ptr_add(val.list, i).count;

                if (count == 0)
                    continue;
                if (objects[typ].oc_class != GEM_CLASS
                    || typ <= LAST_REAL_GEM) {
                    otmp = mksobj(typ, FALSE, FALSE);
                    discover_object(otmp.otyp, TRUE, TRUE, FALSE);
                    otmp.dknown = 1; /* seen it (blindness fix) */
                    /* observe_object not necessary after discover_object */
                    otmp.known = 1;  /* for fake amulets */
                    if (has_oname(otmp))
                        free_oname(otmp);
                    otmp.quan = count;
                    sprintf(pbuf, _("%8lld %s (worth %lld %s),"), count, xname(otmp), count * (objects[typ].oc_cost), currency(2))

;
                    obfree(otmp, null);
                } else {
                    sprintf(pbuf, _("%8lld worthless piece%s of colored glass,"), count, plur(count))
;
                }
                dump_forward_putstr(endwin, 0, pbuf, 0);
            }
        }
    } else {
        /* did not escape or ascend */
        if (u.uz.dnum == 0 && u.uz.dlevel <= 0) {
            /* level teleported out of the dungeon; `how' is DIED,
               due to falling or to "arriving at heaven prematurely" */
            sprintf(pbuf, _("You %s beyond the confines of the dungeon"), (u.uz.dlevel < 0) ? _("passed away") : ends[how])
;
        } else {
            /* more conventional demise */
            let where = svd.dungeons[u.uz.dnum].dname;

            if (Is_astralevel(u.uz))
                where = _("The Astral Plane");
            sprintf(pbuf, _("You %s in %s"), ends[how], where);
            if (!In_endgame(u.uz) && !single_level_branch(u.uz))
                sprintf(eos(pbuf), _(" on dungeon level %d"), In_quest(u.uz) ? dunlev(u.uz) : depth(u.uz))
;
        }

        sprintf(eos(pbuf), _(" with %lld point%s,"), u.urexp, plur(u.urexp));
        dump_forward_putstr(endwin, 0, pbuf, done_stopprint());
    }

    sprintf(pbuf, _("and %lld piece%s of gold, after %lld move%s."), umoney, plur(umoney), svm.moves, plur(svm.moves))
;
    dump_forward_putstr(endwin, 0, pbuf, done_stopprint());
    sprintf(pbuf, _("You were level %d with a maximum of %d hit point%s when you %s."), u.ulevel, u.uhpmax, plur(u.uhpmax), ends[how])

;
    dump_forward_putstr(endwin, 0, pbuf, done_stopprint());
    dump_forward_putstr(endwin, 0, _(""), done_stopprint());
    if (!done_stopprint())
        display_nhwindow()(endwin, TRUE);
    if (endwin != WIN_ERR)
        destroy_nhwindow()(endwin);

    dump_close_log();

    /* shut down soundlib */
    if (soundprocs.sound_exit_nhsound)
        soundprocs.sound_exit_nhsound(_("really_done"));

    /*
     * "So when I die, the first thing I will see in Heaven is a score list?"
     *
     * topten() updates 'logfile' and 'xlogfile', when they're enabled.
     * Then the current game's score is shown in its relative position
     * within high scores, and 'record' is updated if that makes the cut.
     *
     * FIXME!
     *  If writing topten with raw_print(), which will usually be sent to
     *  stdout, we call exit_nhwindows() first in case it erases the screen.
     *  But when writing topten to a window, we call exit_nhwindows()
     *  after topten() because that needs the windowing system to still
     *  be up.  This sequencing is absurd; we need something like
     *  raw_prompt("--More--") (or "Press <return> to continue.") that
     *  topten() can call for !toptenwin before returning here.
     */
    if (have_windows && !iflags.toptenwin)
        exit_nhwindows()(0), have_windows = FALSE;
    topten(how, endtime);
    if (have_windows)
        exit_nhwindows()(0);

    if (done_stopprint()) {
        raw_print()(_(""));
        raw_print()(_(""));
    }
    nh_terminate(EXIT_SUCCESS);
    } finally { stack_pop($frame); }
}

/* used for disclosure and for the ':' choice when looting a container */
export function container_contents(
    list,
    identified,
    all_containers,
    reportempty) { /* void */
    const $frame = stack_frame(); try {
    let box, obj;
    let buf = stack_array(char, BUFSZ);
    let cat, dumping = iflags.in_dumplog;

    for (box = list; box; box = box.nobj) {
        if (Is_container(box) || box.otyp == STATUE) {
            if (!box.cknown || (identified && !box.lknown)) {
                box.cknown = 1; /* we're looking at the contents now */
                if (identified)
                    box.lknown = 1;
                update_inventory();
            }
            if (box.otyp == BAG_OF_TRICKS) {
                continue; /* wrong type of container */
            } else if (box.cobj) {
                let tmpwin = create_nhwindow()(NHW_MENU);
                let sortedcobj = stack_var(ptr_to(struct_sortloot_item)), srtc;
                let sortflags;

                /* at this stage, the SchroedingerBox() flag is only set
                   if the cat inside the box is alive; the box actually
                   contains a cat corpse that we'll pretend is not there;
                   for dead cat, the flag will be clear and there'll be
                   a cat corpse inside the box; either way, inventory
                   reports the box as containing "1 item" */
                cat = SchroedingersBox(box);

                sprintf(buf, _("Contents of %s:"), the(xname(box)));
                putstr()(tmpwin, 0, buf);
                if (!dumping)
                    putstr()(tmpwin, 0, _(""));
                chars[buf + 0] = chars[buf + 1] = ord(' '); /* two leading spaces */
                if (box.cobj && !cat) {
                    sortflags = (((flags.sortloot == ord('l')
                                   || flags.sortloot == ord('f'))
                                     ? SORTLOOT_LOOT : 0)
                                 | (flags.sortpack ? SORTLOOT_PACK : 0));
                    sortedcobj[0] = sortloot(ref_of(box, "cobj"), sortflags, FALSE,
                                          null);
                    for (srtc = sortedcobj[0]; (obj = srtc.obj) != null; srtc = ptr_add(srtc, 1)) {
                        if (identified) {
                            discover_object(obj.otyp, TRUE, TRUE, FALSE);
                            obj.dknown = 1; /* observe_object unnecessary */
                            obj.known = obj.bknown = obj.rknown = 1;
                            if (Is_container(obj) || obj.otyp == STATUE)
                                obj.cknown = obj.lknown = 1;
                        }
                        strcpy(buf + 2, doname_with_price(obj));
                        putstr()(tmpwin, 0, buf);
                    }
                    unsortloot(sortedcobj);
                } else if (cat) {
                    strcpy(buf + 2, _("Schroedinger's cat!"));
                    putstr()(tmpwin, 0, buf);
                }
                if (dumping)
                    putstr()(0, 0, _(""));
                display_nhwindow()(tmpwin, TRUE);
                destroy_nhwindow()(tmpwin);
                if (all_containers)
                    container_contents(box.cobj, identified, TRUE,
                                       reportempty);
            } else if (reportempty) {
                pline(_("%s is empty."), upstart(thesimpleoname(box)));
                display_nhwindow()(WIN_MESSAGE, FALSE);
            }
        }
        if (!all_containers)
            break;
    }
    } finally { stack_pop($frame); }
}

/* should be called with either EXIT_SUCCESS or EXIT_FAILURE */
 export function nh_terminate(status) { /* void */
    program_state.in_moveloop = 0; /* won't be returning to normal play */

    /* Issue #460: capture the final post-topten screen state once,
     * deterministically, before tearing down. nomux_raw_emit no longer
     * writes the file per emit (that caused intermediate captures); the
     * write at nhgetch is the normal sync point during gameplay, but
     * after death/quit there's no further nhgetch — topten emits then
     * we get here. This single call ensures the harness sees the final
     * state (with all topten lines painted) when waiting for SEQ to
     * advance. See termcap.c nomux_raw_emit for the matching comment. */
    nomux_capture_write_input_boundary();

    l_nhcore_call(NHCORE_GAME_EXIT);

    /* don't bother to try to release memory if we're in panic mode, to
       avoid trouble in case that happens to be due to memory problems */
    if (!program_state.panicking) {
        freedynamicdata();
        ;
        l_nhcore_done();
    }

    /* #ifdef VMS: not in this build */

    program_state.exiting = 1;
    nethack_exit(status);
}

/* set a delayed killer, ensure non-delayed killer is cleared out */
export function delayed_killer(id, format, killername) { /* void */
    let k = find_delayed_killer(id);

    if (!k) {
        /* no match, add a new delayed killer to the list */
        k = view_of(struct_kinfo, addr_of(alloc(sizeof(struct_kinfo))));
        memset(addr_of(k), 0, sizeof(struct_kinfo));
        k.id = id;
        k.next = svk.killer.next;
        svk.killer.next = k;
    }

    k.format = format;
    strcpy(k.name, killername ? killername : _(""));
    chars[svk.killer.name + 0] = 0;
}

export function find_delayed_killer(id) { /* struct kinfo * */
    let k;

    for (k = svk.killer.next; k != null; k = k.next) {
        if (k.id == id)
            break;
    }
    return k;
}

export function dealloc_killer(kptr) { /* void */
    let prev = svk.killer, k;

    if (kptr == null)
        return;
    for (k = svk.killer.next; k != null; k = k.next) {
        if (k == kptr)
            break;
        prev = k;
    }

    if (k == null) {
        impossible(_("dealloc_killer (#%d) not on list"), kptr.id);
    } else {
        prev.next = k.next;
        free(addr_of(k));
        do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("freed delayed killer #%d"), kptr.id); iflags.last_msg = save_plnmsg; } } while (0);
    }
}

export function save_killers(nhfp) { /* void */
    let kptr;

    if (update_file(nhfp)) {
        for (kptr = svk.killer; kptr; kptr = kptr.next) {
            Sfo_kinfo(nhfp, kptr, _("kinfo"));
        }
    }
    if (release_data(nhfp)) {
        while (svk.killer.next) {
            kptr = svk.killer.next.next;
            free(addr_of(svk.killer.next));
            svk.killer.next = kptr;
        }
    }
}

export function restore_killers(nhfp) { /* void */
    let kptr;

    for (kptr = svk.killer; kptr != null; kptr = kptr.next) {
        Sfi_kinfo(nhfp, kptr, _("kinfo"));
        if (kptr.next) {
            kptr.next = view_of(struct_kinfo, addr_of(alloc(sizeof(struct_kinfo))));
        }
    }
}

function wordcount(p) { /* int */
    let words = 0;

    while (chars[p]) {
        while (chars[p] && __isspace(uchar((chars[p]))))
            p++;
        if (chars[p])
            words++;
        while (chars[p] && !__isspace(uchar((chars[p]))))
            p++;
    }
    return words;
}

function bel_copy1(inp, out) { /* void */
    let in_ = inp[0];

    out += strlen(out); /* eos() */
    while (chars[in_] && __isspace(uchar((chars[in_]))))
        in_++;
    while (chars[in_] && !__isspace(uchar((chars[in_]))))
        chars[out++] = chars[in_++];
    chars[out] = ord('\0');
    inp[0] = in_;
}

export function build_english_list(in_) { /* char * */
    const $frame = stack_frame(); try {
    let out, p = stack_var(ptr_to(char), in_);
    let len = int(strlen(p[0])), words = wordcount(p[0]);

    /* +3: " or " - " "; +(words - 1): (N-1)*(", " - " ") */
    if (words > 1)
        len += 3 + (words - 1);
    out = addr_of(alloc(unsigned(len + 1)));
    chars[out] = ord('\0'); /* bel_copy1() appends */

    switch (words) {
    case 0:
        impossible(_("no words in list"));
        break;
    case 1:
        /* "single" */
        bel_copy1(p, out);
        break;
    default:
        if (words == 2) {
            /* "first or second" */
            bel_copy1(p, out);
            strcat(out, _(" "));
        } else {
            /* "first, second, or third */
            do {
                bel_copy1(p, out);
                strcat(out, _(", "));
            } while (--words > 1);
        }
        strcat(out, _("or "));
        bel_copy1(p, out);
        break;
    }
    return out;
    } finally { stack_pop($frame); }
}

/* What do we try to in what order?  Tradeoffs:
 * libc: +no external programs required
 *        -requires newish libc/glibc
 *        -requires -rdynamic
 * gdb:   +gives more detailed information
 *        +works on more OS versions
 *        -requires -g, which may preclude -O on some compilers
 *
 * And the UI: if sysopt.crashreporturl, and defined(CRASHREPORT)
 * we gather the stacktrace (etc) and launch a browser to submit a bug report
 * otherwise we just use stdout.  Requires libc for now.
 */

export function NH_abort(why) { /* void */
    let aborting = static_var("NH_abort.aborting", schar, FALSE);

    /* don't execute this code recursively if a second abort is requested
       while this routine or the code it calls is executing */
    if (aborting[0])
        return;
    aborting[0] = TRUE;

    /* #ifdef PANICTRACE: not in this build */

    abort();
}

/*end.c*/

import { A_CON } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { WIZARD_NAME } from "./config.h.js";
import { AMULET_CLASS, GEM_CLASS, S_MUMMY, S_VAMPIRE, S_WRAITH } from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import { In_endgame, In_tutorial, Is_astralevel } from "./dungeon.h.macros.js";
import { nethack_exit } from "./extern.h.macros.js";
import {
    DISCLOSE_NO_WITHOUT_PROMPT, DISCLOSE_PROMPT_DEFAULT_SPECIAL, DISCLOSE_PROMPT_DEFAULT_YES,
    DISCLOSE_SPECIAL_WITHOUT_PROMPT, DISCLOSE_YES_WITHOUT_PROMPT, NUM_DISCLOSURE_OPTIONS,
    PLNMSG_OK_DONT_DIE, fuzzer_off,
} from "./flag.h.js";
import { ParanoidBones, ParanoidDie, ParanoidQuit, discover, wizard } from "./flag.h.macros.js";
import { BUFSZ, FALSE, LL_DUMP, LL_LIFESAVE, QBUFSZ, TRUE } from "./global.h.js";
import { Strlen } from "./global.h.macros.js";
import {
    ASCENDED, BASICENLIGHTENMENT, BURNING, CHOKING, CQ_CANNED, DIED, DISSOLVED, ECMD_OK,
    ENL_GAMEOVERALIVE, ENL_GAMEOVERDEAD, ESCAPED, GENOCIDED, KILLED_BY, KILLED_BY_AN,
    MAGICENLIGHTENMENT, NHCORE_GAME_EXIT, NO_KILLER_PREFIX, PANICKED, QUIT, SORTLOOT_LOOT,
    SORTLOOT_PACK, STARVING, STONING, TRICKED, TURNED_SLIME, override_restriction, struct_kinfo,
    struct_sortloot_item, struct_valuable_data,
} from "./hack.h.js";
import { makeknown, min, plur, release_data, update_file, y_n, ynq } from "./hack.h.macros.js";
import { nowrap_add } from "./integer.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import { MGIVENNAME, has_ebones, has_mgivenname } from "./mextra.h.macros.js";
import { type_is_pname } from "./mondata.h.macros.js";
import { G_GENOD, G_NOCORPSE, G_UNIQ } from "./monflag.h.js";
import { M_AP_MONSTER } from "./monst.h.js";
import { M_AP_TYPE, is_vampshifter, ismnum } from "./monst.h.macros.js";
import {
    LEAVESTATUE, LOW_PM, NON_PM, PM_GHOST, PM_GHOUL, PM_GREEN_SLIME, PM_HIGH_CLERIC, PM_HOUSECAT,
    PM_HUMAN, PM_TOURIST, PM_VAMPIRE, PM_WRAITH,
} from "./monsters.h.js";
import { OBJ_FREE } from "./obj.h.js";
import { Has_contents, Is_container, SchroedingersBox, has_oname } from "./obj.h.macros.js";
import { OBJ_NAME } from "./objclass.h.macros.js";
import {
    AMULET_OF_LIFE_SAVING, BAG_OF_TRICKS, BELL_OF_OPENING, CANDELABRUM_OF_INVOCATION, CORPSE,
    FAKE_AMULET_OF_YENDOR, FIRST_AMULET, FIRST_REAL_GEM, LAST_GLASS_GEM, LAST_REAL_GEM,
    POT_RESTORE_ABILITY, POT_WATER, SPE_BOOK_OF_THE_DEAD, STATUE,
} from "./objects.h.js";
import { TIMEOUT, UNCHANGING } from "./prop.h.js";
import { IS_GRAVE, levl } from "./rm.h.macros.js";
import { Sfi_kinfo, Sfo_kinfo } from "./savefile.h.macros.js";
import { IN_SIGHT } from "./vision.h.js";
import {
    clear_nhwindow, create_nhwindow, destroy_nhwindow, display_nhwindow, exit_nhwindows, mark_synch,
    outrip, putstr, raw_print, wait_synch,
} from "./winprocs.h.macros.js";
import { NHW_MENU, NHW_TEXT, WIN_ERR } from "./wintype.h.js";
import {
    ACH_BLND, ACH_NUDE, ACH_UWIN, A_CURRENT, A_ORIGINAL, SICK_ALL, TT_LAVA, UTOTYPE_ATSTAIRS,
} from "./you.h.js";
import { Race_if, Role_if, Ugender, Upolyd } from "./you.h.macros.js";
import { Blind, Hallucination, Lifesaved, Sick } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import {
    EXIT_SUCCESS, SIGINT, SIGQUIT, SIG_IGN, __isspace, abort, free, memset, signal, sprintf, sscanf,
    strcat, strchr, strcmp, strcpy, strlen, vsnprintf,
} from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, sizeof_member, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { va_end, va_start } from "../rt/varargs.js";
import { timet_delta } from "./allmain.js";
import { alloc } from "./alloc.js";
import { arti_cost, artiname } from "./artifact.js";
import { adjattrib, minuhpmax, setuhpmax } from "./attrib.js";
import { lift_covet_and_placebc } from "./ball.js";
import { can_make_bones, savebones } from "./bones.js";
import { bot } from "./botl.js";
import { getnow, midnight, night } from "./calendar.js";
import { cmdq_add_ec, isok, paranoid_query, yn_function } from "./cmd.js";
import {
    disclosure_options, disp, flags, ga, gb, gd, gg, gh, gi, gk, gm, gn, gt, gu, gv, gy, iflags,
    program_state, svc, svd, svk, svm, svp, u, urealtime, ynqchars,
} from "./decl.js";
import { curs_on_u } from "./display.js";
import { schedule_goto } from "./do.js";
import { Mgender, Monnam, free_oname, m_monnam, mon_nam, pmname } from "./do_name.js";
import { keepdogs } from "./dog.js";
import { endmultishot } from "./dothrow.js";
import {
    In_quest, deepest_lev_reached, depth, dunlev, show_overview, single_level_branch,
} from "./dungeon.js";
import { init_uhunger } from "./eat.js";
import { make_grave } from "./engrave.js";
import { clearlocks, paniclog, set_error_savefile } from "./files.js";
import { money_cnt, nomul } from "./hack.js";
import { eos, strstri, upstart } from "./hacklib.js";
import {
    count_achievements, enlightenment, list_genocided, list_vanquished, record_achievement,
    show_conduct,
} from "./insight.js";
import {
    carrying, currency, display_inventory, free_pickinv_cache, perm_invent_toggled,
    set_cknown_lknown, sortloot, stackobj, unsortloot, update_inventory, useup,
} from "./invent.js";
import { adj_lev } from "./makemon.js";
import { expels } from "./mhitu.js";
import { bless, mk_named_object, mksobj, place_object } from "./mkobj.js";
import { unstuck, zombie_maker } from "./mon.js";
import { sticks } from "./mondata.js";
import { accessible } from "./monmove.js";
import { mons } from "./monst.js";
import { l_nhcore_call, l_nhcore_done } from "./nhlua.js";
import { discover_object } from "./o_init.js";
import { objects } from "./objects.js";
import {
    an, doname_with_price, the, the_unique_obj, the_unique_pm, thesimpleoname, xname,
} from "./objnam.js";
import { monhealthdescr } from "./pager.js";
import { observe_quantum_cat } from "./pickup.js";
import {
    You, You_feel, Your, impossible, livelog_printf, pline, pline_The, raw_printf,
} from "./pline.js";
import { make_sick, peffects, set_itimeout } from "./potion.js";
import { clearpriests } from "./priest.js";
import { inven_inuse } from "./restore.js";
import { d, rn2 } from "./rnd.js";
import { Goodbye } from "./role.js";
import { dosave0, freedynamicdata } from "./save.js";
import { finish_paybill, obfree, paybill } from "./shk.js";
import { shkname, shkname_is_pname } from "./shknam.js";
import { soundprocs } from "./sounds.js";
import { sysopt } from "./sys.js";
import { formatkiller, topten } from "./topten.js";
import { force_launch_placement, launch_in_progress, reset_utrap } from "./trap.js";
import { hidden_gold, paygd } from "./vault.js";
import { dump_close_log, dump_forward_putstr, dump_open_log } from "./windows.js";
import { wiz_makemap } from "./wizcmds.js";
import { sethanguphandler } from "../sys/unix/unixmain.js";
import { nomux_capture_write_input_boundary } from "../win/tty/termcap.js";
const __FILE__ = "end.c";
