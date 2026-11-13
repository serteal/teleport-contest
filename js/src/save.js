/* NetHack 5.0	save.c	$NHDT-Date: 1737610109 2025/01/22 21:28:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.232 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2009. */
/* NetHack may be freely redistributed.  See license for details. */

/* the #save command */
export function dosave() { /* int */
    clear_nhwindow()(WIN_MESSAGE);
    if (y_n(_("Really save?")) == ord('n')) {
        clear_nhwindow()(WIN_MESSAGE);
        if (gm.multi > 0)
            nomul(0);
    } else {
        clear_nhwindow()(WIN_MESSAGE);
        pline(_("Saving..."));

        program_state.done_hup = 0;

        if (dosave0()) {
            program_state.savefile_completed++;
            u.uhp = -1; /* universal game's over indicator */
            if (soundprocs.sound_exit_nhsound)
                soundprocs.sound_exit_nhsound(_("dosave"));

            /* make sure they see the Saving message */
            display_nhwindow()(WIN_MESSAGE, TRUE);
            exit_nhwindows()(_("Be seeing you..."));
            nh_terminate(EXIT_SUCCESS);
        } else
            docrt();
    }
    return ECMD_OK;
}

/* returns 1 if save successful */
export function dosave0() { /* int */
    const $frame = stack_frame(); try {
    var fq_save;
    var ltmp = stack_var(xint8);
    var whynot = stack_array(char, BUFSZ);
    var nhfp, onhfp;
    var res = 0;

    program_state.saving++; /* inhibit status and perm_invent updates */
    notice_mon_off();
    /* we may get here via hangup signal, in which case we want to fix up
       a few of things before saving so that they won't be restored in
       an improper state; these will be no-ops for normal save sequence */
    u.uinvulnerable = 0;
    if (iflags.save_uswallow)
        u.uswallow = 1, iflags.save_uswallow = 0;
    if (iflags.save_uinwater)
        u.uinwater = 1, iflags.save_uinwater = 0; /* bypass set_uinwater() */
    if (iflags.save_uburied)
        u.uburied = 1, iflags.save_uburied = 0;
    /* extra handling for hangup save or panic save; without this,
       a thrown light source might trigger an "obj_is_local" panic;
       if a thrown or kicked object is in transit, put it on the map;
       when punished, make sure ball and chain are placed too */
    done_object_cleanup(); /* maybe force some items onto map */

    done: { if (!program_state.something_worth_saving || !chars[gs.SAVEF + 0])
        break done;;

    fq_save = fqname(gs.SAVEF, SAVEPREFIX, 1); /* level files take 0 */

    sethanguphandler(SIG_IGN);

    signal(SIGINT, SIG_IGN);

    if (!program_state.done_hup) if (iflags.window_inited) {
        nh_uncompress(fq_save);
        nhfp = open_savefile();
        if (nhfp) {
            close_nhfile(nhfp);
            clear_nhwindow()(WIN_MESSAGE);
            There(_("seems to be an old save file."));
            if (y_n(_("Overwrite the old file?")) == ord('n')) {
                nh_sfconvert(fq_save);
                nh_compress(fq_save);
                break done;
            }
        }
    }

    if (!program_state.done_hup) mark_synch()();; /* flush any buffered screen output */

    nhfp = create_savefile();
    if (!nhfp) {
        if (!program_state.done_hup) pline(_("Cannot open save file."));;
        delete_savefile(); /* ab@unido */
        break done;
    }
    if (nhfp && nhfp.fplog) {
        nhfp.rcount = nhfp.wcount = 0;
    }

    vision_recalc(2); /* shut down vision to prevent problems
                         in the event of an impossible() call */

    /* undo date-dependent luck adjustments made at startup time */
    if (flags.moonphase == FULL_MOON) /* ut-sally!fletcher */
        change_luck(-1);              /* and unido!ab */
    if (flags.friday13)
        change_luck(1);
    if (iflags.window_inited)
        if (!program_state.done_hup) clear_nhwindow()(WIN_MESSAGE);;

    nhfp.mode = WRITING | FREEING;
    store_version(nhfp);
    store_plname_in_file(nhfp);
    /* savelev() might save uball and uchain, releasing their memory if
       FREEING, so we need to check their status now; if hero is swallowed,
       uball and uchain will persist beyond saving map floor and inventory
       so these copies of their pointers will be valid and savegamestate()
       will know to save them separately (from floor and invent); when not
       swallowed, uchain will be stale by then, and uball will be too if
       ball is on the floor rather than carried */
    gl.looseball = BALL_IN_MON() ? uball : null;
    gl.loosechain = CHAIN_IN_MON() ? uchain : null;
    savelev(nhfp, ledger_no(u.uz));
    savegamestate(nhfp);

    /* While copying level files around, zero out u.uz to keep
     * parts of the restore code from completely initializing all
     * in-core data structures, since all we're doing is copying.
     * This also avoids at least one nasty core dump.
     * [gu.uz_save is used by save_bubbles() as well as to restore u.uz]
     */
    struct_assign(gu.uz_save, u.uz);
    u.uz.dnum = u.uz.dlevel = 0;
    /* these pointers are no longer valid, and at least u.usteed
     * may mislead place_monster() on other levels
     */
    set_ustuck(null); /* also clears u.uswallow */
    u.usteed = null;

    for (ltmp[0] = 1; ltmp[0] <= maxledgerno(); ltmp[0]++) {
        if (ltmp[0] == ledger_no(gu.uz_save))
            continue;
        if (!(svl.level_info[ltmp[0]].flags & LFILE_EXISTS))
            continue;
        /* #ifdef MICRO: not in this build */

        onhfp = open_levelfile(ltmp[0], whynot);
        if (!onhfp) {
            if (!program_state.done_hup) pline1(whynot);;
            close_nhfile(nhfp);
            delete_savefile();
            if (!program_state.done_hup) strcpy(svk.killer.name, whynot);;
            if (!program_state.done_hup) done(TRICKED);;
            break done;
        }
        getlev(onhfp, svh.hackpid, ltmp[0]);
        close_nhfile(onhfp);
        sfo_xint8(nhfp, addr_of(ltmp), _("gamestate-level_number"));
        savelev(nhfp, ltmp[0]);     /* actual level*/
        delete_levelfile(ltmp[0]);
    }
    close_nhfile(nhfp);

    struct_assign(u.uz, gu.uz_save);
    gu.uz_save.dnum = gu.uz_save.dlevel = 0;

    /* get rid of current level --jgm */
    delete_levelfile(ledger_no(u.uz));
    delete_levelfile(0);
    nh_sfconvert(fq_save);
    nh_compress(fq_save);
    /* this should probably come sooner... */
    program_state.something_worth_saving = 0;
    res = 1;
 }
    notice_mon_on();
    program_state.saving--;
    return res;
    } finally { stack_pop($frame); }
}

function save_gamelog(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let tmp = gg.gamelog, tmp2;
    let slen = stack_var(int);

    while (tmp) {
        tmp2 = tmp.next;
        if (nhfp.mode & (COUNTING | WRITING)) {
            slen[0] = int(Strlen(tmp.text));
            Sfo_int(nhfp, slen, _("gamelog-length"));
            Sfo_char(nhfp, tmp.text, _("gamelog-gamelog_text"), slen[0]);
            Sfo_gamelog_line(nhfp, tmp, _("gamelog-gamelog_line"));
        }
        if (nhfp.mode & FREEING) {
            free(tmp.text);
            free(addr_of(tmp));
        }
        tmp = tmp2;
    }
    if (nhfp.mode & (COUNTING | WRITING)) {
        slen[0] = -1;
        Sfo_int(nhfp, slen, _("gamelog-length"));
    }
    if (nhfp.mode & FREEING)
        gg.gamelog = null;
    } finally { stack_pop($frame); }
}

function savegamestate(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let i;
    let uid = stack_var(ulong);

    program_state.saving++; /* caller should/did already set this... */
    uid[0] = getuid();
    sfo_ulong(nhfp, uid, _("gamestate-uid"));
    Sfo_char(nhfp, svn.nhuuid + 0, _("nhuuid"), sizeof_member(svn, "nhuuid"));
    sfo_long(nhfp, ref_of(svm, "moves"), _("gamestate-moves"));
    moves_to_relative_time(ref_of(svc.context, "seer_turn"));
    moves_to_relative_time(ref_of(svc.context.digging, "lastdigtime"));
    Sfo_context_info(nhfp, svc.context, _("gamestate-context"));
    relative_time_to_moves(ref_of(svc.context, "seer_turn"));
    relative_time_to_moves(ref_of(svc.context.digging, "lastdigtime"));

    Sfo_flag(nhfp, flags, _("gamestate-flags"));
    urealtime.finish_time = getnow();
    urealtime.realtime += timet_delta(urealtime.finish_time,
                                      urealtime.start_timing);
    sfo_long(nhfp, ref_of(svw, "wreserve"), _("wreserve"));
    Sfo_int32(nhfp, ref_of(svw, "wtreserved"), _("wtreserved"));
    Sfo_you(nhfp, u, _("gamestate-you"));
    sfo_char(nhfp, yyyymmddhhmmss(ubirthday), _("gamestate-ubirthday"), 14);
    sfo_long(nhfp, ref_of(urealtime, "realtime"), _("gamestate-realtime"));
    sfo_char(nhfp, yyyymmddhhmmss(urealtime.start_timing), _("gamestate-start_timing"), 14);
    /* this is the value to use for the next update of urealtime.realtime */
    urealtime.start_timing = urealtime.finish_time;
    save_killers(nhfp);

    /* must come before gm.migrating_objs and gm.migrating_mons are freed */
    save_timers(nhfp, RANGE_GLOBAL);
    save_light_sources(nhfp, RANGE_GLOBAL);

    /* when FREEING, deletes objects in invent and sets invent to Null;
       pointers into invent (uwep, uarmg, uamul, &c) are set to Null too */
    saveobjchn(nhfp, ref_of(gi, "invent"));

    /* save ball and chain if they happen to be in an unusual state */
    save_bc(nhfp);

    saveobjchn(nhfp, ref_of(gm, "migrating_objs")); /* frees objs and sets to Null */
    savemonchn(nhfp, gm.migrating_mons);
    if (release_data(nhfp))
        gm.migrating_mons = null;
    for (i = 0; i < NUMMONS; ++i) {
        Sfo_mvitals(nhfp, svm.mvitals[i], _("gamestate-mvitals"));
    }
    save_dungeon(nhfp, (+!!update_file(nhfp)),
                 (+!!release_data(nhfp)));
    savelevchn(nhfp);
    Sfo_q_score(nhfp, svq.quest_status, _("gamestate-quest_status"));
    for (i = 0; i < (MAXSPELL + 1); ++i) {
        Sfo_spell(nhfp, svs.spl_book[i], _("gamestate-spl_book"));
    }
    save_artifacts(nhfp);
    save_oracles(nhfp);
    Sfo_char(nhfp, svp.pl_character, _("gamestate-pl_character"), sizeof_member(svp, "pl_character"));
    Sfo_char(nhfp, svp.pl_fruit, _("gamestate-pl_fruit"), sizeof_member(svp, "pl_fruit"));
    savefruitchn(nhfp);
    savenames(nhfp);
    save_msghistory(nhfp);
    save_gamelog(nhfp);
    save_luadata(nhfp);
    if (nhfp.structlevel)
        bflush(nhfp.fd);
    program_state.saving--;
    return;
    } finally { stack_pop($frame); }
}

/* potentially called from goto_level(do.c) as well as savestateinlock() */
export function tricked_fileremoved(nhfp, whynot) { /* boolean */
    if (!nhfp) {
        pline1(whynot);
        pline(_("Probably someone removed it."));
        strcpy(svk.killer.name, whynot);
        done(TRICKED);
        return TRUE;
    }
    return FALSE;
}

export function savestateinlock() { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var hpid = stack_var(int), whynot = stack_array(char, BUFSZ), currlev = stack_var(int);
    hpid[0] = 0;

    var nhfp;

    program_state.saving++; /* inhibit status and perm_invent updates */
    /* When checkpointing is on, the full state needs to be written
     * on each checkpoint.  When checkpointing is off, only the pid
     * needs to be in the level.0 file, so it does not need to be
     * constantly rewritten.  When checkpointing is turned off during
     * a game, however, the file has to be rewritten once to truncate
     * it and avoid restoring from outdated information.
     *
     * Restricting gh.havestate to this routine means that an additional
     * noop pid rewriting will take place on the first "checkpoint" after
     * the game is started or restored, if checkpointing is off.
     */
    if (flags.ins_chkpt || gh.havestate) {
        /* save the rest of the current game state in the lock file,
         * following the original int pid, the current level number,
         * and the current savefile name, which should not be subject
         * to any internal compression schemes since they must be
         * readable by an external utility
         */
        nhfp = open_levelfile(0, whynot);
        if (tricked_fileremoved(nhfp, whynot)) {
            program_state.saving--;
            return;
        }

        sfi_int(nhfp, hpid, _("gamestate-hackpid"));
        $goto_giveup: for (;;) { switch ($goto) { default: if (svh.hackpid != hpid[0]) {
            sprintf(whynot, _("Level #0 pid (%d) doesn't match ours (%d)!"), hpid[0], svh.hackpid)
;
            { $goto = "giveup"; continue $goto_giveup; }
        }
        close_nhfile(nhfp);

        nhfp = create_levelfile(0, whynot);
        case "giveup": if ($goto || (!nhfp)) {
            switch ($goto) { default: pline1(whynot);
 case "giveup": $goto = null;
            strcpy(svk.killer.name, whynot); }
            /* done(TRICKED) will return when running in wizard mode;
               clear the display-update-suppression flag before rather
               than after so that screen updating behaves normally;
               game data shouldn't be inconsistent yet, unlike it would
               become midway through saving */
            program_state.saving--;
            done(TRICKED);
            return;
        } } break; }
        nhfp.mode = WRITING;
        Sfo_int(nhfp, ref_of(svh, "hackpid"), _("gamestate-hackpid"));
        if (flags.ins_chkpt) {
            currlev[0] = ledger_no(u.uz);

            Sfo_int(nhfp, currlev, _("gamestate-savestateinlock"));
            save_savefile_name(nhfp);
            store_version(nhfp);
            store_plname_in_file(nhfp);

            /* if ball and/or chain aren't on floor or in invent, keep a copy
               of their pointers; not valid when on floor or in invent */
            gl.looseball = BALL_IN_MON() ? uball : null;
            gl.loosechain = CHAIN_IN_MON() ? uchain : null;
            savegamestate(nhfp);
        }
        close_nhfile(nhfp);
    }
    program_state.saving--;
    gh.havestate = flags.ins_chkpt;
    return;
    } finally { stack_pop($frame); }
}

export function savelev(nhfp, lev) { /* void */
    let set_uz_save = +(gu.uz_save.dnum == 0 && gu.uz_save.dlevel == 0);

    /* caller might have already set up gu.uz_save and zeroed u.uz;
       if not, we need to set it for save_bubbles(); caveat: if the
       player quits during character selection, u.uz won't be set yet
       but we'll be called during run-down */
    if (set_uz_save && (nhfp.mode & (COUNTING | WRITING))) {
        if (u.uz.dnum == 0 && u.uz.dlevel == 0) {
            program_state.something_worth_saving = 0;
            panic(_("savelev: where are we?"));
        }
        struct_assign(gu.uz_save, u.uz);
    }

    savelev_core(nhfp, lev);

    if (set_uz_save)
        gu.uz_save.dnum = gu.uz_save.dlevel = 0; /* unset */
}

function savelev_core(nhfp, lev$) { /* void */
    const $frame = stack_frame(); try {
    const lev = stack_var(schar, lev$);

    var i, c, r;
    var tmpc;

    program_state.saving++; /* even if current mode is FREEING */

    if (!nhfp)
        panic(_("Save on bad file!")); /* impossible */
    /*
     *  Level file contents:
     *    version info (handled by caller);
     *    save file info (compression type; also by caller);
     *    process ID;
     *    internal level number (ledger number);
     *    bones info;
     *    actual level data.
     *
     *  If we're tearing down the current level without saving anything
     *  (which happens at end of game or upon entrance to endgame or
     *  after an aborted restore attempt) then we don't want to do any
     *  actual I/O.  So when only freeing, we skip to the bones info
     *  portion (which has some freeing to do), then jump quite a bit
     *  further ahead to the middle of the 'actual level data' portion.
     */
    if (nhfp.mode != FREEING) {
        /* WRITING (probably ORed with FREEING), or COUNTING */

        /* purge any dead monsters (necessary if we're starting
           a panic save rather than a normal one, or sometimes
           when changing levels without taking time -- e.g.
           create statue trap then immediately level teleport) */
        if (iflags.purge_monsters)
            dmonsfree();
        /* clear objs_deleted list too */
        if (go.objs_deleted)
            dobjsfree(); /* really free deleted objects */

        if (lev[0] >= 0 && lev[0] <= maxledgerno())
            svl.level_info[lev[0]].flags |= VISITED;
        Sfo_int(nhfp, ref_of(svh, "hackpid"), _("gamestate-hackpid"));
        sfo_xint8(nhfp, addr_of(lev), _("gamestate-dlvl"));
    }

    /* bones info comes before level data; the intent is for an external
       program ('hearse') to be able to match a bones file with the
       corresponding log file entry--or perhaps just skip that?--without
       the guessing that was needed in 3.4.3 and without having to
       interpret level data to find where to start; unfortunately it
       still needs to handle all the data compression schemes */
    savecemetery(nhfp, ref_of(svl.level, "bonesinfo"));
    skip_lots: { if (nhfp.mode == FREEING) /* see above */
        break skip_lots;;

    savelevl(nhfp);
    for (c = 0; c < COLNO; ++c) {
        for (r = 0; r < ROWNO; ++r) {
            Sfo_schar(nhfp, svl.lastseentyp[c] + r, _("lastseentyp"));
        }
    }
    /* svm.moves will actually be read back into svo.omoves on restore */
    sfo_long(nhfp, ref_of(svm, "moves"), _("lev-timestmp"));
    save_stairs(nhfp);
    Sfo_dest_area(nhfp, svu.updest, _("lev-updest"));
    Sfo_dest_area(nhfp, svd.dndest, _("lev-dndest"));
    save_adjust_levelflags();
    Sfo_levelflags(nhfp, svl.level.flags, _("lev-level_flags"));
    rest_adjust_levelflags();

    Sfo_int(nhfp, ref_of(svd, "doors_alloc"), _("lev-doors_alloc"));
    /* don't rely on underlying write() behavior to write
     *  nothing if count arg is 0, just skip it */
    if (svd.doors_alloc) {
        tmpc = svd.doors;
        for (i = 0; i < svd.doors_alloc; ++i) {
            Sfo_nhcoord(nhfp, tmpc, _("lev-doors"));
            tmpc = ptr_add(tmpc, 1);
        }
    }
    save_rooms(nhfp); /* no dynamic memory to reclaim */

    /* from here on out, saving also involves allocated memory cleanup */
 }
    /* timers and lights must be saved before monsters and objects */
    save_timers(nhfp, RANGE_LEVEL);
    save_light_sources(nhfp, RANGE_LEVEL);

    savemonchn(nhfp, fmon());
    save_worm(nhfp); /* save worm information */
    savetrapchn(nhfp, gf.ftrap);
    saveobjchn(nhfp, ref_of(svl.level, "objlist"));
    saveobjchn(nhfp, ref_of(svl.level, "buriedobjlist"));
    saveobjchn(nhfp, ref_of(gb, "billobjs"));
    save_engravings(nhfp);
    savedamage(nhfp); /* pending shop wall and/or floor repair */
    save_regions(nhfp);
    save_bubbles(nhfp, lev[0]); /* for water and air */
    save_exclusions(nhfp);
    save_track(nhfp);

    if (nhfp.mode != FREEING) {
        if (nhfp.structlevel)
            bflush(nhfp.fd);
    }
    program_state.saving--;
    if (release_data(nhfp)) {
        clear_level_structures();
        gf.ftrap = null;
        gb.billobjs = null;
        memset(addr_of(svr.rooms[0]), 0, sizeof_member(svr, "rooms"));
    }
    return;
    } finally { stack_pop($frame); }
}

export function save_adjust_levelflags() { /* void */
    /* adjust any timestamps */
    moves_to_relative_time(ref_of(svl.level.flags, "stasis_until"));
}

function savelevl(nhfp) { /* void */
    let x, y;

    for (x = 0; x < COLNO; x++) {
        for (y = 0; y < ROWNO; y++) {
            Sfo_rm(nhfp, levl()[x][y], _("location-rm"));
        }
    }
    return;
}

/* save Plane of Water's air bubbles and Plane of Air's clouds */
function save_bubbles(nhfp, lev) { /* void */
    const $frame = stack_frame(); try {
    let bbubbly = stack_var(xint8);

    /* air bubbles and clouds used to be saved as part of game state
       because restoring them needs dungeon data that isn't available
       during the first pass of their levels; now that they are part of
       the current level instead, we write a zero or non-zero marker
       so that restore can determine whether they are present even when
       u.uz and ledger_no() aren't available to it yet */
    bbubbly[0] = 0;
    if (lev == ledger_no(svd.dungeon_topology.d_water_level) || lev == ledger_no(svd.dungeon_topology.d_air_level))
        bbubbly[0] = lev; /* non-zero */
    if (update_file(nhfp)) sfo_xint8(nhfp, addr_of(bbubbly), _("bubbles-bbubbly"))
;

    if (bbubbly[0])
        save_waterlevel(nhfp); /* save air bubbles or clouds */
    } finally { stack_pop($frame); }
}

/* used when saving a level and also when saving dungeon overview data */
export function savecemetery(nhfp, cemeteryaddr) { /* void */
    const $frame = stack_frame(); try {
    let thisbones, nextbones;
    let flag = stack_var(int);

    flag[0] = cemeteryaddr[0] ? 0 : -1;
    if (update_file(nhfp)) {
        Sfo_int(nhfp, flag, _("cemetery-cemetery_flag"));
    }
    nextbones = cemeteryaddr[0];
    while ((thisbones = nextbones) != null) {
        nextbones = thisbones.next;
        if (update_file(nhfp)) {
            Sfo_cemetery(nhfp, thisbones, _("cemetery-bonesinfo"));
        }
        if (release_data(nhfp))
            free(addr_of(thisbones));
    }
    if (release_data(nhfp))
        cemeteryaddr[0] = null;
    } finally { stack_pop($frame); }
}

function savedamage(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let damageptr, tmp_dam;
    let xl = stack_var(unsigned, 0);

    damageptr = svl.level.damagelist;
    for (tmp_dam = damageptr; tmp_dam; tmp_dam = tmp_dam.next)
        xl[0]++;
    if (update_file(nhfp)) {
        Sfo_unsigned(nhfp, xl, _("damage-damage_count"));
    }
    while (damageptr) {
        if (update_file(nhfp)) {
            Sfo_damage(nhfp, damageptr, _("damage"));
        }
        tmp_dam = damageptr;
        damageptr = damageptr.next;
        if (release_data(nhfp))
            free(addr_of(tmp_dam));
    }
    if (release_data(nhfp))
        svl.level.damagelist = null;
    } finally { stack_pop($frame); }
}

function save_stairs(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let stway = gs.stairs;
    let buflen = stack_var(int, sizeof(struct_stairway));

    while (stway) {
        if (update_file(nhfp)) {
            let use_relative = +(program_state.restoring != REST_GSTATE
                                    && stway.tolev.dnum == u.uz.dnum);
            if (use_relative) {
                /* make dlevel relative to current level */
                stway.tolev.dlevel -= u.uz.dlevel;
            }
            Sfo_int(nhfp, buflen, _("stairs-staircount"));
            Sfo_stairway(nhfp, stway, _("stairs-stairway"));
            if (use_relative) {
                /* reset stairway dlevel back to absolute */
                stway.tolev.dlevel += u.uz.dlevel;
            }
        }
        stway = stway.next;
    }
    if (update_file(nhfp)) {
        buflen[0] = -1;
        Sfo_int(nhfp, buflen, _("stairs-staircount"));
    }
    } finally { stack_pop($frame); }
}

/* if ball and/or chain are loose, make an object chain for it/them and
   save that separately from other objects */
function save_bc(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let bc_objs = stack_var(ptr_to(struct_obj), null);

    /* save ball and chain if they are currently dangling free (i.e. not
       on floor or in inventory); 'looseball' and 'loosechain' have been
       set up in caller because ball and chain will be gone by now if on
       floor, or ball gone if carried */
    if (gl.loosechain) {
        gl.loosechain.nobj = bc_objs[0]; /* uchain */
        bc_objs[0] = gl.loosechain;
        if (nhfp.mode & FREEING) {
            setworn(null, W_CHAIN); /* sets 'uchain' to Null */
            gl.loosechain = null;
        }
    }
    if (gl.looseball) {
        gl.looseball.nobj = bc_objs[0];
        bc_objs[0] = gl.looseball;
        if (nhfp.mode & FREEING) {
            setworn(null, W_BALL); /* sets 'uball' to Null */
            gl.looseball = null;
        }
    }
    saveobjchn(nhfp, bc_objs); /* frees objs in list, sets bc_objs to Null */
    } finally { stack_pop($frame); }
}

/* save one object;
   caveat: this is only for update_file(); caller handles release_data() */
function saveobj(nhfp, otmp) { /* void */
    const $frame = stack_frame(); try {
    let buflen = stack_var(int), zerobuf = stack_var(int, 0);

    buflen[0] = sizeof(struct_obj);
    Sfo_int(nhfp, buflen, _("obj-obj_length"));
    Sfo_obj(nhfp, otmp, _("obj"));
    if (otmp.oextra) {
        buflen[0] = ONAME(otmp) ? int(strlen(ONAME(otmp))) + 1 : 0;
        Sfo_int(nhfp, buflen, _("obj-oname_length"));

        if (buflen[0] > 0) {
            Sfo_char(nhfp, ONAME(otmp), _("obj-oname"), buflen[0]);
        }
        /* defer to savemon() for this one */
        if (OMONST(otmp)) {
            savemon(nhfp, OMONST(otmp));
        } else {
            Sfo_int(nhfp, zerobuf, _("obj-omonst_length"));
        }
        /* extra info about scroll of mail */
        buflen[0] = OMAILCMD(otmp) ? int(strlen(OMAILCMD(otmp))) + 1 : 0;
        Sfo_int(nhfp, buflen, _("obj-omailcmd_length"));
        if (buflen[0] > 0) {
            Sfo_char(nhfp, OMAILCMD(otmp), _("obj-omailcmd"), buflen[0]);
        }
        /* omid used to be indirect via a pointer in oextra but has
           become part of oextra itself; 0 means not applicable and
           gets saved/restored whenever any other oextra components do */
        Sfo_unsigned(nhfp, ref_of((otmp).oextra, "omid"), _("obj-omid"));
    }
    } finally { stack_pop($frame); }
}

/* save an object chain; sets head of list to Null when done;
   handles release_data() for each object in the list */
function saveobjchn(nhfp, obj_p) { /* void */
    const $frame = stack_frame(); try {
    let otmp = obj_p[0];
    let otmp2;
    let is_invent = (otmp && otmp == gi.invent ? 1 : 0);
    let minusone = stack_var(int, -1);

    while (otmp) {
        otmp2 = otmp.nobj;
        if (update_file(nhfp)) {
            saveobj(nhfp, otmp);
        }
        if (Has_contents(otmp))
            saveobjchn(nhfp, ref_of(otmp, "cobj"));
        if (release_data(nhfp)) {
            /*
             * If these are on the floor, the discarding could be
             * due to game save, or we could just be changing levels.
             * Always invalidate the pointer, but ensure that we have
             * the o_id in order to restore the pointer on reload.
             */
            if (otmp == svc.context.victual.piece) {
                svc.context.victual.o_id = otmp.o_id;
                svc.context.victual.piece = null;
            }
            if (otmp == svc.context.tin.tin) {
                svc.context.tin.o_id = otmp.o_id;
                svc.context.tin.tin = null;
            }
            if (otmp == svc.context.spbook.book) {
                svc.context.spbook.o_id = otmp.o_id;
                svc.context.spbook.book = null;
            }
            otmp.where = OBJ_FREE; /* set to free so dealloc will work */
            otmp.nobj = null;      /* nobj saved into otmp2 */
            otmp.cobj = null;      /* contents handled above */
            otmp.timed = 0;        /* not timed any more */
            otmp.lamplit = 0;      /* caller handled lights */
            otmp.corpsenm = 0;     /* mon->mleashed could still be set;
                                     * unfortunately, we can't clear that
                                     * until after the monster is saved */
            /* clear 'uball' and 'uchain' pointers if resetting their mask;
               could also do same for other worn items but don't need to */
            if ((otmp.owornmask & (W_BALL | W_CHAIN)) != 0)
                setworn(null,
                        otmp.owornmask & (W_BALL | W_CHAIN));
            otmp.owornmask = 0;   /* no longer care */
            program_state.freeingdata++;
            dealloc_obj(otmp);
            program_state.freeingdata--;
        }
        otmp = otmp2;
    }
    if (update_file(nhfp)) {
        Sfo_int(nhfp, minusone, _("obj-obj_length"));
    }
    if (release_data(nhfp)) {
        if (is_invent)
            allunworn(); /* clear uwep, uarm, uball, &c pointers */
        obj_p[0] = null;
    }
    } finally { stack_pop($frame); }
}

function savemon(nhfp, mtmp) { /* void */
    const $frame = stack_frame(); try {
    let buflen = stack_var(int);

    mtmp.mtemplit = 0; /* normally clear; if set here then a panic save
                         * is being written while bhit() was executing */
    buflen[0] = sizeof(struct_monst);
    Sfo_int(nhfp, buflen, _("monst-monst_length"));
    Sfo_monst(nhfp, mtmp, _("monst"));
    if (mtmp.mextra) {
        buflen[0] = MGIVENNAME(mtmp) ? int(strlen(MGIVENNAME(mtmp))) + 1 : 0;
        Sfo_int(nhfp, buflen, _("monst-mgivenname_length"));
        if (buflen[0] > 0) {
            Sfo_char(nhfp, MGIVENNAME(mtmp), _("monst-mgivenname"), buflen[0]);
        }
        buflen[0] = EGD(mtmp) ? sizeof(struct_egd) : 0;
        Sfo_int(nhfp, buflen, _("monst-egd_length"));
        if (buflen[0] > 0) {
            Sfo_egd(nhfp, EGD(mtmp), _("monst-egd"));
        }
        buflen[0] = EPRI(mtmp) ? sizeof(struct_epri) : 0;
        Sfo_int(nhfp, buflen, _("monst-epri_length"));
        if (buflen[0] > 0) {
            Sfo_epri(nhfp, EPRI(mtmp), _("monst-epri"));
        }
        buflen[0] = ESHK(mtmp) ? sizeof(struct_eshk) : 0;
        Sfo_int(nhfp, buflen, _("monst-eshk_length"));
        if (buflen[0] > 0) {
            Sfo_eshk(nhfp, ESHK(mtmp), _("monst-eshk"));
        }
        buflen[0] = EMIN(mtmp) ? sizeof(struct_emin) : 0;
        Sfo_int(nhfp, buflen, _("monst-emin_length"));
        if (buflen[0] > 0) {
            Sfo_emin(nhfp, EMIN(mtmp), _("monst-emin"));
        }
        buflen[0] = EDOG(mtmp) ? sizeof(struct_edog) : 0;
        Sfo_int(nhfp, buflen, _("monst-edog_length"));
        if (buflen[0] > 0) {
            /* we only store relative times in save and bones */
            moves_to_relative_time(ref_of(EDOG(mtmp), "droptime"));
            moves_to_relative_time(ref_of(EDOG(mtmp), "hungrytime"));
            Sfo_edog(nhfp, EDOG(mtmp), _("monst-edog"));
            relative_time_to_moves(ref_of(EDOG(mtmp), "droptime"));
            relative_time_to_moves(ref_of(EDOG(mtmp), "hungrytime"));
        }
        buflen[0] = EBONES(mtmp) ? sizeof(struct_ebones) : 0;
        Sfo_int(nhfp, buflen, _("monst-ebones_length"));
        if (buflen[0] > 0) {
            Sfo_ebones(nhfp, EBONES(mtmp), _("monst-ebones"));
        }
        /* mcorpsenm is inline int rather than pointer to something,
           so doesn't need to be preceded by a length field */
        buflen[0] = MCORPSENM(mtmp);
        Sfo_int(nhfp, buflen, _("monst-mcorpsenm"));
    }
    } finally { stack_pop($frame); }
}

function savemonchn(nhfp, mtmp) { /* void */
    const $frame = stack_frame(); try {
    let mtmp2;
    let minusone = stack_var(int, -1);

    while (mtmp) {
        mtmp2 = mtmp.nmon;
        if (update_file(nhfp)) {
            mtmp.mnum = monsndx(mtmp.data);
            if (mtmp.ispriest)
                forget_temple_entry(mtmp); /* EPRI() */
            savemon(nhfp, mtmp);
        }
        if (mtmp.minvent)
            saveobjchn(nhfp, ref_of(mtmp, "minvent"));
        if (release_data(nhfp)) {
            if (mtmp == svc.context.polearm.hitmon) {
                svc.context.polearm.m_id = mtmp.m_id;
                svc.context.polearm.hitmon = null;
            }
            if (mtmp == u.ustuck)
                u.ustuck_mid = u.ustuck.m_id;
            if (mtmp == u.usteed)
                u.usteed_mid = u.usteed.m_id;
            mtmp.nmon = null;  /* nmon saved into mtmp2 */
            dealloc_monst(mtmp);
        }
        mtmp = mtmp2;
    }
    if (update_file(nhfp)) {
        Sfo_int(nhfp, minusone, _("monst-monst_length"));
    }
    } finally { stack_pop($frame); }
}

/* save traps; gf.ftrap is the only trap chain so 2nd arg is superfluous */
function savetrapchn(nhfp, trap) { /* void */
    let zerotrap = static_struct("savetrapchn.zerotrap", struct_trap);
    let trap2;

    while (trap) {
        let use_relative = +(program_state.restoring != REST_GSTATE
                                && trap.dst.dnum == u.uz.dnum);
        trap2 = trap.ntrap;
        if (use_relative)
            trap.dst.dlevel -= u.uz.dlevel; /* make it relative */
        if (update_file(nhfp)) {
            Sfo_trap(nhfp, trap, _("trap"));
        }
        if (use_relative)
            trap.dst.dlevel += u.uz.dlevel; /* reset back to absolute */
        if (release_data(nhfp))
            dealloc_trap(trap);
        trap = trap2;
    }
    if (update_file(nhfp)) {
        Sfo_trap(nhfp, zerotrap, _("trap"));
    }
}

/* save all the fruit names and ID's; this is used only in saving whole games
 * (not levels) and in saving bones levels.  When saving a bones level,
 * we only want to save the fruits which exist on the bones level; the bones
 * level routine marks nonexistent fruits by making the fid negative.
 */
export function savefruitchn(nhfp) { /* void */
    let zerofruit = static_struct("savefruitchn.zerofruit", struct_fruit);
    let f2, f1;

    f1 = gf.ffruit;
    while (f1) {
        f2 = f1.nextf;
        if (f1.fid >= 0 && update_file(nhfp)) {
            Sfo_fruit(nhfp, f1, _("fruit"));
        }
        if (release_data(nhfp))
            dealloc_fruit(f1);
        f1 = f2;
    }
    if (update_file(nhfp)) {
        Sfo_fruit(nhfp, zerofruit, _("fruit"));
    }
    if (release_data(nhfp))
        gf.ffruit = null;
}

function savelevchn(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let tmplev, tmplev2;
    let cnt = stack_var(int, 0);

    for (tmplev = svs.sp_levchn; tmplev; tmplev = tmplev.next)
        cnt[0]++;
    if (update_file(nhfp)) {
        Sfo_int(nhfp, cnt, _("levchn-lev_count"));
    }
    for (tmplev = svs.sp_levchn; tmplev; tmplev = tmplev2) {
        tmplev2 = tmplev.next;
        if (update_file(nhfp)) {
            Sfo_s_level(nhfp, tmplev, _("levchn-s_level"));
        }
        if (release_data(nhfp))
            free(addr_of(tmplev));
    }
    if (release_data(nhfp))
        svs.sp_levchn = null;
    } finally { stack_pop($frame); }
}

/* write "name-role-race-gend-algn" into save file for menu-based restore;
   the first dash is actually stored as '\0' instead of '-' */
export function store_plname_in_file(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let hero = stack_array(char, PL_NSIZ_PLUS); /* [PL_NSIZ + 4*(1+3) + 1] */
    let plsiztmp = stack_var(int, sizeof(array_of(char, PL_NSIZ_PLUS)));

    memset(hero, ord('\0'), sizeof(array_of(char, PL_NSIZ_PLUS)));
    /* augment svp.plname[]; the gender and alignment values reflect those
       in effect at time of saving rather than at start of game */
    Snprintf(hero, sizeof(array_of(char, PL_NSIZ_PLUS)), _("%s-%.3s-%.3s-%.3s-%.3s"), svp.plname, gu.urole.filecode, gu.urace.filecode, genders[flags.female].filecode, aligns[1 - u.ualign.type].filecode)

;
    /* replace "-role-race..." with "\0role-race..." so that we can include
       or exclude the role-&c suffix easily, without worrying about whether
       plname contains any dashes; but don't rely on snprintf() for this */
    chars[hero + strlen(svp.plname)] = ord('\0');
    /* insert playmode into final slot of hero[];
       'D','X','-' are the same characters as are used for paniclog entries */
    assert(chars[hero + (PL_NSIZ_PLUS - 1 - 1)] == ord('\0'));
    chars[hero + (PL_NSIZ_PLUS - 1)] = wizard() ? ord('D') : discover() ? ord('X') : ord('-');

    if (nhfp.structlevel)
        bufoff(nhfp.fd);  /* bwrite() before bufon() uses plain write() */
    Sfo_int(nhfp, plsiztmp, _("plname-size"));
    Sfo_char(nhfp, hero, _("plname"), plsiztmp[0]);
    if (nhfp.structlevel)
        bufon(nhfp.fd);
    return;
    } finally { stack_pop($frame); }
}

function save_msghistory(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let msg;
    let msgcount = 0;
    let minusone = stack_var(int, -1), msglen = stack_var(int);
    let init = TRUE;

    if (update_file(nhfp)) {
        /* ask window port for each message in sequence */
        while ((msg = getmsghistory()(init)) != 0) {
            init = FALSE;
            msglen[0] = int(Strlen(msg));
            if (msglen[0] < 1)
                continue;
            /* sanity: truncate if necessary (shouldn't happen);
               no need to modify msg[] since terminator isn't written */
            if (msglen[0] > BUFSZ - 1)
                msglen[0] = BUFSZ - 1;
            Sfo_int(nhfp, msglen, _("msghistory-length"));
            Sfo_char(nhfp, msg, _("msghistory-msg"), msglen[0]);
            ++msgcount;
        }
        Sfo_int(nhfp, minusone, _("msghistory-length"));
    }
    debugpline1(_("Stored %d messages into savefile."), msgcount, __FILE__);
    /* note: we don't attempt to handle release_data() here */
    } finally { stack_pop($frame); }
}

/* also called by prscore(); this probably belongs in dungeon.c... */
export function free_dungeons() { /* void */
    let tnhfp = get_freeing_nhfile();

    savelevchn(tnhfp);
    save_dungeon(tnhfp, FALSE, TRUE);
    free_luathemes(all_themes);
    close_nhfile(tnhfp);

    return;
}

 /* options.c */

/* free a lot of allocated memory which is ordinarily freed during save */
export function freedynamicdata() { /* void */
    let tnhfp = get_freeing_nhfile();

    free_maildata();

    free_menu_coloring();
    free_invbuf();           /* let_to_name (invent.c) */
    free_youbuf();           /* You_buf,&c (pline.c) */
    msgtype_free();
    savedsym_free();
    tmp_at(DISP_FREEMEM, 0); /* temporary display effects */
    purge_all_custom_entries();

    /* move-specific data */
    dmonsfree(); /* release dead monsters */
    /* dobjsfree(); // handled below */
    alloc_itermonarr(0); /* a request of 0 releases existing allocation */

    /* level-specific data */
    done_object_cleanup(); /* maybe force some OBJ_FREE items onto map */
    savelev(tnhfp, -1);

    /* game-state data [ought to reorganize savegamestate() to handle this] */
    save_killers(tnhfp);
    save_timers(tnhfp, RANGE_GLOBAL);
    save_light_sources(tnhfp, RANGE_GLOBAL);
    (saveobjchn(tnhfp, ref_of(gi, "invent")), gi.invent = null);
    (saveobjchn(tnhfp, ref_of(gm, "migrating_objs")), gm.migrating_objs = null);
    (savemonchn(tnhfp, gm.migrating_mons), gm.migrating_mons = null);
    (savemonchn(tnhfp, gm.mydogs), gm.mydogs = null); /* ascension or dungeon escape */
    /* freelevchn();  --  [folded into free_dungeons()] */
    free_animals();
    save_oracles(tnhfp);
    savefruitchn(tnhfp);
    savenames(tnhfp);
    save_waterlevel(tnhfp);
    free_dungeons();
    free_CapMons();
    free_rect();
    freeroleoptvals(); /* saveoptvals(&tnhfp) */
    cmdq_clear(CQ_CANNED);
    cmdq_clear(CQ_REPEAT);
    cmdbind_freeall();
    free_tutorial(); /* (only needed if quitting while in tutorial) */
    wish_history_flush();

    /* per-turn data, but might get added to when freeing other stuff */
    dobjsfree(); /* really free deleted objects */

    /* some pointers in iflags */
    if (iflags.wc_font_map)
        free(iflags.wc_font_map), iflags.wc_font_map = 0;
    if (iflags.wc_font_message)
        free(iflags.wc_font_message),
        iflags.wc_font_message = 0;
    if (iflags.wc_font_text)
        free(iflags.wc_font_text), iflags.wc_font_text = 0;
    if (iflags.wc_font_menu)
        free(iflags.wc_font_menu), iflags.wc_font_menu = 0;
    if (iflags.wc_font_status)
        free(iflags.wc_font_status), iflags.wc_font_status = 0;
    if (iflags.wc_tile_file)
        free(iflags.wc_tile_file), iflags.wc_tile_file = 0;
    free_autopickup_exceptions();

    /* miscellaneous */
    /* free_pickinv_cache();  --  now done from really_done()... */
    free_symsets();

    save_gamelog(tnhfp);
    release_runtime_info(); /* build-time options and version stuff */
    free_convert_filenames();

    free_nhuuid();

    if (VIA_WINDOWPORT())
        status_finish();

    if (options_set_window_colors_flag)
        options_free_window_colors();

    if (glyphid_cache_status())
        free_glyphid_cache();

    if (tnhfp) {
        close_nhfile(tnhfp);
        tnhfp = null;
    }

    /* last, because it frees data that might be used by panic() to provide
       feedback to the user; conceivably other freeing might trigger panic */
    sysopt_release(); /* SYSCF strings */
}
export function free_animals() { return mon_animal_list(FALSE); }

/*save.c*/

import { VIA_WINDOWPORT } from "./botl.h.macros.js";
import { DISP_FREEMEM } from "./display.h.js";
import { LFILE_EXISTS, VISITED } from "./dungeon.h.js";
import { FULL_MOON } from "./flag.h.js";
import { discover, notice_mon_off, notice_mon_on, wizard } from "./flag.h.macros.js";
import { BUFSZ, COLNO, FALSE, PL_NSIZ_PLUS, ROWNO, TRUE, xint8 } from "./global.h.js";
import { Strlen } from "./global.h.macros.js";
import {
    COUNTING, CQ_CANNED, CQ_REPEAT, ECMD_OK, FREEING, REST_GSTATE, SAVEPREFIX, TRICKED, WRITING,
    all_themes,
} from "./hack.h.js";
import {
    BALL_IN_MON, CHAIN_IN_MON, pline1, release_data, update_file, y_n,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { debugpline1 } from "./lint.h.macros.js";
import {
    struct_ebones, struct_edog, struct_egd, struct_emin, struct_epri, struct_eshk,
} from "./mextra.h.js";
import { EBONES, EDOG, EGD, EMIN, EPRI, ESHK, MCORPSENM, MGIVENNAME } from "./mextra.h.macros.js";
import { monsndx } from "./mondata.h.macros.js";
import { struct_monst } from "./monst.h.js";
import { NUMMONS } from "./monsters.h.js";
import { OBJ_FREE, struct_obj } from "./obj.h.js";
import { Has_contents, OMAILCMD, OMONST, ONAME } from "./obj.h.macros.js";
import { MAXSPELL, struct_fruit } from "./objclass.h.js";
import { dealloc_fruit } from "./objclass.h.macros.js";
import { W_BALL, W_CHAIN } from "./prop.h.js";
import { fmon, levl } from "./rm.h.macros.js";
import {
    Sfo_cemetery, Sfo_char, Sfo_context_info, Sfo_damage, Sfo_dest_area, Sfo_ebones, Sfo_edog,
    Sfo_egd, Sfo_emin, Sfo_epri, Sfo_eshk, Sfo_flag, Sfo_fruit, Sfo_gamelog_line, Sfo_int,
    Sfo_int32, Sfo_levelflags, Sfo_monst, Sfo_mvitals, Sfo_nhcoord, Sfo_obj, Sfo_q_score, Sfo_rm,
    Sfo_s_level, Sfo_schar, Sfo_spell, Sfo_stairway, Sfo_trap, Sfo_unsigned, Sfo_you,
} from "./savefile.h.macros.js";
import { struct_stairway } from "./stairs.h.js";
import { RANGE_GLOBAL, RANGE_LEVEL } from "./timeout.h.js";
import { struct_trap } from "./trap.h.js";
import { dealloc_trap } from "./trap.h.macros.js";
import {
    clear_nhwindow, display_nhwindow, exit_nhwindows, getmsghistory, mark_synch,
} from "./winprocs.h.macros.js";
import { char, int, ord, schar, sizeof, ulong, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    EXIT_SUCCESS, SIGINT, SIG_IGN, assert, free, getuid, memset, signal, sprintf, strcpy, strlen,
} from "../rt/libc.js";
import { stack_array, stack_var, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, sizeof_member, struct_assign,
} from "../rt/struct.js";
import { timet_delta } from "./allmain.js";
import { save_artifacts } from "./artifact.js";
import { change_luck } from "./attrib.js";
import { status_finish } from "./botl.js";
import { getnow, yyyymmddhhmmss } from "./calendar.js";
import { cmdbind_freeall, cmdq_clear } from "./cmd.js";
import { free_menu_coloring } from "./coloratt.js";
import {
    flags, gb, gf, gg, gh, gi, gl, gm, go, gs, gu, iflags, program_state, svc, svd, svh, svk, svl,
    svm, svn, svp, svq, svr, svs, svu, svw, u, urealtime,
} from "./decl.js";
import { docrt, tmp_at } from "./display.js";
import { ledger_no, maxledgerno, save_dungeon, save_exclusions } from "./dungeon.js";
import { done, done_object_cleanup, nh_terminate, panic, save_killers } from "./end.js";
import { save_engravings } from "./engrave.js";
import {
    close_nhfile, create_levelfile, create_savefile, delete_levelfile, delete_savefile, fqname,
    free_convert_filenames, get_freeing_nhfile, nh_compress, nh_sfconvert, nh_uncompress,
    open_levelfile, open_savefile, save_savefile_name,
} from "./files.js";
import { free_glyphid_cache, glyphid_cache_status, purge_all_custom_entries } from "./glyphs.js";
import { nomul } from "./hack.js";
import { free_invbuf } from "./invent.js";
import { save_light_sources } from "./light.js";
import { free_maildata } from "./mail.js";
import { release_runtime_info } from "./mdlib.js";
import { clear_level_structures, free_luathemes } from "./mklev.js";
import { save_waterlevel } from "./mkmaze.js";
import { dealloc_obj, dobjsfree } from "./mkobj.js";
import { save_rooms } from "./mkroom.js";
import { alloc_itermonarr, dealloc_monst, dmonsfree, mon_animal_list, set_ustuck } from "./mon.js";
import { free_tutorial, save_luadata } from "./nhlua.js";
import { savenames } from "./o_init.js";
import {
    free_autopickup_exceptions, freeroleoptvals, msgtype_free, options_free_window_colors,
} from "./options.js";
import { There, free_youbuf, pline } from "./pline.js";
import { forget_temple_entry } from "./priest.js";
import { free_rect } from "./rect.js";
import { save_regions } from "./region.js";
import {
    getlev, moves_to_relative_time, relative_time_to_moves, rest_adjust_levelflags,
} from "./restore.js";
import { aligns, genders } from "./role.js";
import { free_CapMons, save_oracles } from "./rumors.js";
import { sfi_int, sfo_char, sfo_long, sfo_ulong, sfo_xint8 } from "./sfbase.js";
import { bflush, bufoff, bufon } from "./sfstruct.js";
import { soundprocs } from "./sounds.js";
import { free_symsets, savedsym_free } from "./symbols.js";
import { sysopt_release } from "./sys.js";
import { save_timers } from "./timeout.js";
import { save_track } from "./track.js";
import { store_version } from "./version.js";
import { vision_recalc } from "./vision.js";
import { save_worm } from "./worm.js";
import { allunworn, setworn } from "./worn.js";
import { wish_history_flush } from "./zap.js";
import { free_nhuuid, sethanguphandler } from "../sys/unix/unixmain.js";
const __FILE__ = "save.c";
