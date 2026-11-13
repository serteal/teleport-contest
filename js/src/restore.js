/* NetHack 5.0	restore.c	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.234 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2009. */
/* NetHack may be freely redistributed.  See license for details. */

/* these ones are declared non-static in extern.h if SFCTOOL is defined */

/*
 * Save a mapping of IDs from ghost levels to the current level.  This
 * map is used by the timer routines when restoring ghost levels.
 */
export const N_PER_BUCKET = 64;
const struct_bucket = struct("struct_bucket", {
    next: ptr_to("struct_bucket"),
    map: array_of(struct("struct_bucket.map", {
        gid: unsigned,
        nid: unsigned,
    }), N_PER_BUCKET),
});

export function Is_IceBox(o) { return (o.otyp == ICE_BOX ? TRUE : FALSE); }

/* Recalculate svl.level.objects[x][y], since this info was not saved. */

function find_lev_obj() { /* void */
    let fobjtmp = null;
    let otmp;
    let x, y;

    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            svl.level.objects[x][y] = null;

    /*
     * Reverse the entire fobj chain, which is necessary so that we can
     * place the objects in the proper order.  Make all obj in chain
     * OBJ_FREE so place_object will work correctly.
     */
    while ((otmp = fobj()) != null) {
        svl.level.objlist = otmp.nobj;
        otmp.nobj = fobjtmp;
        otmp.where = OBJ_FREE;
        fobjtmp = otmp;
    }
    /* fobj should now be empty */

    /* Set svl.level.objects (as well as reversing the chain back again) */
    while ((otmp = fobjtmp) != null) {
        fobjtmp = otmp.nobj;
        place_object(otmp, otmp.ox, otmp.oy);

        /* fixup(s) performed when restoring the level that the hero
           is on, rather than just an arbitrary one */
        if (u.uz.dlevel) { /* 0 during full restore until current level */
            /* handle uchain and uball when they're on the floor */
            if (otmp.owornmask & (W_BALL | W_CHAIN))
                setworn(otmp, otmp.owornmask);
        }
    }
}

/* Things that were marked "in_use" when the game was saved (ex. via the
 * infamous "HUP" cheat) get used up here.
 */
export function inven_inuse(quietly) { /* void */
    let otmp, otmp2;

    for (otmp = gi.invent; otmp; otmp = otmp2) {
        otmp2 = otmp.nobj;
        if (otmp.in_use) {
            if (!quietly)
                pline(_("Finishing off %s..."), xname(otmp));
            useup(otmp);
        }
    }
}

function restlevchn(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let cnt = stack_var(int, 0);
    let tmplev, x;

    svs.sp_levchn = null;
    sfi_int(nhfp, cnt, _("levchn-lev_count"));
    for (; cnt[0] > 0; cnt[0]--) {
        tmplev = view_of(struct_s_level, addr_of(alloc(sizeof(struct_s_level))));
        Sfi_s_level(nhfp, tmplev, _("levchn-s_level"));

        if (!svs.sp_levchn)
            svs.sp_levchn = tmplev;
        else {
            for (x = svs.sp_levchn; x.next; x = x.next)
                ;
            x.next = tmplev;
        }
        tmplev.next = null;
    }
    } finally { stack_pop($frame); }
}

function restdamage(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let dmgcount = stack_var(unsigned, 0);
    let counter;
    let tmp_dam;

    let ghostly = +(nhfp.ftype == NHF_BONESFILE);

    sfi_unsigned(nhfp, dmgcount, _("damage-damage_count"));
    counter = int((dmgcount[0]));

    if (!counter)
        return;
    do {
        tmp_dam = view_of(struct_damage, addr_of(alloc(sizeof(struct_damage))));

        Sfi_damage(nhfp, tmp_dam, _("damage"));

        if (ghostly)
            tmp_dam.when += (svm.moves - svo.omoves);

        tmp_dam.next = svl.level.damagelist;
        svl.level.damagelist = tmp_dam;
    } while (--counter > 0);
    } finally { stack_pop($frame); }
}

/* restore one object */
function restobj(nhfp, otmp) { /* void */
    const $frame = stack_frame(); try {
    let buflen = stack_var(int, 0);
    let omid = stack_var(unsigned, 0);

    Sfi_obj(nhfp, otmp, _("obj"));
    otmp.lua_ref_cnt = 0;
    /* next object pointers are invalid; otmp->cobj needs to be left
       as is--being non-null is key to restoring container contents */
    otmp.nobj = otmp.v.v_nexthere = null;
    /* non-null oextra needs to be reconstructed */
    if (otmp.oextra) {
        otmp.oextra = newoextra();

        /* oname - object's name */
        sfi_int(nhfp, buflen, _("obj-oname_length"));
        if (buflen[0] > 0) { /* includes terminating '\0' */
            new_oname(otmp, buflen[0]);
            Sfi_char(nhfp, ONAME(otmp), _("obj-oname"), buflen[0]);
        }

        /* omonst - corpse or statue might retain full monster details */
        sfi_int(nhfp, buflen, _("obj-omonst_length"));
        if (buflen[0] > 0) {
            newomonst(otmp);
            /* this is actually a monst struct, so we
               can just defer to restmon() here */
            restmon(nhfp, OMONST(otmp));
        }

        /* omailcmd - feedback mechanism for scroll of mail */
        sfi_int(nhfp, buflen, _("obj-omailcmd_length"));
        if (buflen[0] > 0) {
            let omailcmd = addr_of(alloc(unsigned(buflen[0])));

            Sfi_char(nhfp, omailcmd, _("obj-omailcmd"), buflen[0]);
            new_omailcmd(otmp, omailcmd);
            free(omailcmd);
        }

        /* omid - monster id number, connecting corpse to ghost */
        newomid(otmp); /* superfluous; we're already allocated otmp->oextra */
        sfi_unsigned(nhfp, omid, _("obj-omid"));
        ((otmp).oextra.omid) = omid[0];
    }
    } finally { stack_pop($frame); }
}

function restobjchn(nhfp, frozen) { /* struct obj * */
    const $frame = stack_frame(); try {
    let otmp, otmp2 = null;
    let first = null;
    let buflen = stack_var(int, 0);

    let ghostly = +(nhfp.ftype == NHF_BONESFILE);

    while (1) {
        sfi_int(nhfp, buflen, _("obj-obj_length"));
        if (buflen[0] == -1)
            break;

        otmp = newobj();
        assert(otmp != null);
        restobj(nhfp, otmp);
        if (!first)
            first = otmp;
        else
            otmp2.nobj = otmp;

        if (ghostly) {
            let nid = next_ident();

            add_id_mapping(otmp.o_id, nid);
            otmp.o_id = nid;
        }
        if (ghostly && otmp.otyp == SLIME_MOLD)
            ghostfruit(otmp);
        /* Ghost levels get object age shifted from old player's clock
         * to new player's clock.  Assumption: new player arrived
         * immediately after old player died.
         */
        if (ghostly && !frozen && !age_is_relative(otmp))
            otmp.age = svm.moves - svo.omoves + otmp.age;

        /* get contents of a container or statue */
        if (Has_contents(otmp)) {
            let otmp3;

            otmp.cobj = restobjchn(nhfp, Is_IceBox(otmp));
            /* restore container back pointers */
            for (otmp3 = otmp.cobj; otmp3; otmp3 = otmp3.nobj)
                otmp3.v.v_ocontainer = otmp;
        }

        if (otmp.bypass)
            otmp.bypass = 0;
        if (!ghostly) {
            /* fix the pointers */
            if (otmp.o_id == svc.context.victual.o_id)
                svc.context.victual.piece = otmp;
            if (otmp.o_id == svc.context.tin.o_id)
                svc.context.tin.tin = otmp;
            if (otmp.o_id == svc.context.spbook.o_id)
                svc.context.spbook.book = otmp;
        }

        otmp2 = otmp;
    }
    if (first && otmp2.nobj) {
        impossible(_("Restobjchn: error reading objchn."));
        otmp2.nobj = null;
    }

    return first;
    } finally { stack_pop($frame); }
}

/* restore one monster */
function restmon(nhfp, mtmp) { /* void */
    const $frame = stack_frame(); try {
    let buflen = stack_var(int, 0), mc = stack_var(int, 0);

    Sfi_monst(nhfp, mtmp, _("monst"));

    /* next monster pointer is invalid */
    mtmp.nmon = null;
    /* non-null mextra needs to be reconstructed */
    if (mtmp.mextra) {
        mtmp.mextra = newmextra();

        /* mgivenname - monster's name */
        sfi_int(nhfp, buflen, _("monst-mgivenname_length"));
        if (buflen[0] > 0) { /* includes terminating '\0' */
            new_mgivenname(mtmp, buflen[0]);
            Sfi_char(nhfp, MGIVENNAME(mtmp), _("monst-mgivenname"), (buflen[0]));
        }
        /* egd - vault guard */
        sfi_int(nhfp, buflen, _("monst-egd_length"));
        if (buflen[0] > 0) {
            newegd(mtmp);
            Sfi_egd(nhfp, EGD(mtmp), _("monst-egd"));
        }
        /* epri - temple priest */
        sfi_int(nhfp, buflen, _("monst-epri_length"));
        if (buflen[0] > 0) {
            newepri(mtmp);
            Sfi_epri(nhfp, EPRI(mtmp), _("monst-epri"));
        }
        /* eshk - shopkeeper */
        sfi_int(nhfp, buflen, _("monst-eshk_length"));
        if (buflen[0] > 0) {
            neweshk(mtmp);
            Sfi_eshk(nhfp, ESHK(mtmp), _("monst-eshk"));
        }
        /* emin - minion */
        sfi_int(nhfp, buflen, _("monst-emin_length"));
        if (buflen[0] > 0) {
            newemin(mtmp);
            Sfi_emin(nhfp, EMIN(mtmp), _("monst-emin"));
        }
        /* edog - pet */
        sfi_int(nhfp, buflen, _("monst-edog_length"));
        if (buflen[0] > 0) {
            newedog(mtmp);
            Sfi_edog(nhfp, EDOG(mtmp), _("monst-edog"));
            /* save or bones held a relative time */
            relative_time_to_moves(ref_of(EDOG(mtmp), "droptime"));
            relative_time_to_moves(ref_of(EDOG(mtmp), "hungrytime"));
            /* sanity check to prevent rn2(0) */
           if (EDOG(mtmp).apport <= 0) {
               EDOG(mtmp).apport = 1;
           }
        }
        /* ebones */
        sfi_int(nhfp, buflen, _("monst-ebones_length"));
        if (buflen[0] > 0) {
            newebones(mtmp);
            Sfi_ebones(nhfp, EBONES(mtmp), _("monst-ebones"));
        }
        /* mcorpsenm - obj->corpsenm for mimic posing as corpse or
           statue (inline int rather than pointer to something) */
        sfi_int(nhfp, mc, _("monst-mcorpsenm"));
        ((mtmp).mextra.mcorpsenm) = mc[0];
    } /* mextra */
    } finally { stack_pop($frame); }
}

function restmonchn(nhfp) { /* struct monst * */
    const $frame = stack_frame(); try {
    let mtmp, mtmp2 = null;
    let first = null;
    let buflen = stack_var(int, 0);

    let offset;
    let ghostly = +(nhfp.ftype == NHF_BONESFILE);

    while (1) {
        sfi_int(nhfp, buflen, _("monst-monst_length"));
        if (buflen[0] == -1)
            break;

        mtmp = newmonst();
        assert(mtmp != null);
        restmon(nhfp, mtmp);
        if (!first)
            first = mtmp;
        else
            mtmp2.nmon = mtmp;

        if (ghostly) {
            let nid = next_ident();

            add_id_mapping(mtmp.m_id, nid);
            mtmp.m_id = nid;
        }
        offset = mtmp.mnum;
        mtmp.data = mons[offset];
        if (ghostly) {
            let mndx = (mtmp.cham == NON_PM) ? monsndx(mtmp.data)
                                              : mtmp.cham;

            if (propagate(mndx, TRUE, ghostly) == 0) {
                /* cookie to trigger purge in getbones() */
                mtmp.mhpmax = DEFUNCT_MONSTER;
            }
        }

        if (mtmp.minvent) {
            let obj;
            mtmp.minvent = restobjchn(nhfp, FALSE);

            /* restore monster back pointer */
            for (obj = mtmp.minvent; obj; obj = obj.nobj)
                obj.v.v_ocarry = mtmp;
        }

        if (mtmp.mw) {
            let obj;

            for (obj = mtmp.minvent; obj; obj = obj.nobj)
                if (obj.owornmask & W_WEP)
                    break;
            if (obj)
                mtmp.mw = obj;
            else {
                MON_NOWEP(mtmp);
                impossible(_("bad monster weapon restore"));
            }
        }

        if (mtmp.isshk)
            restshk(mtmp, ghostly);
        if (mtmp.ispriest)
            restpriest(mtmp, ghostly);

        if (!ghostly) {
            if (mtmp.m_id == svc.context.polearm.m_id)
                svc.context.polearm.hitmon = mtmp;
        }

        mtmp2 = mtmp;
    }

    if (first && mtmp2.nmon) {
        impossible(_("Restmonchn: error reading monchn."));
        mtmp2.nmon = null;
    }

    return first;
    } finally { stack_pop($frame); }
}

function loadfruitchn(nhfp) { /* struct fruit * */
    let flist, fnext;

    flist = null;
    for (;;) {
        fnext = newfruit();
        Sfi_fruit(nhfp, fnext, _("fruit"));
        if (fnext.fid != 0) {
            fnext.nextf = flist;
            flist = fnext;
        } else
            break;
    }
    dealloc_fruit(fnext);
    return flist;
}

function freefruitchn(flist) { /* void */
    let fnext;

    while (flist) {
        fnext = flist.nextf;
        dealloc_fruit(flist);
        flist = fnext;
    }
}

function ghostfruit(otmp) { /* void */
    let oldf;

    for (oldf = go.oldfruit; oldf; oldf = oldf.nextf)
        if (oldf.fid == otmp.spe)
            break;

    if (!oldf)
        impossible(_("no old fruit?"));
    else
        otmp.spe = fruitadd(oldf.fname, null);
}

export function SYSOPT_CHECK_SAVE_UID() { return sysopt.check_save_uid; }

function restgamestate(nhfp) { /* boolean */
    const $frame = stack_frame(); try {
    let i;
    let newgameflags = stack_struct(struct_flag);
    let newgamecontext = stack_struct(struct_context_info); /* all 0, but has some pointers */
    let bc_obj;
    let timebuf = stack_array(char, 15);
    let uid = stack_var(ulong, 0);

    let defer_perm_invent, restoring_special;
    let otmp;

    sfi_ulong(nhfp, uid, _("gamestate-uid"));
    Sfi_char(nhfp, svn.nhuuid + 0, _("nhuuid"), sizeof_member(svn, "nhuuid"));
    sfi_long(nhfp, ref_of(svm, "moves"), _("gamestate-moves"));

    if (SYSOPT_CHECK_SAVE_UID()
        && uid[0] != getuid()) { /* strange ... */
        if (!gc.converted_savefile_loaded)
            /* for wizard mode, issue a reminder; for others, treat it
             * as an attempt to cheat and refuse to restore this file */
            pline(_("Saved game was not yours."));
        if (wizard() || gc.converted_savefile_loaded) {
            if (gc.converted_savefile_loaded)
                gc.converted_savefile_loaded = FALSE;
        } else {
            return FALSE;
        }
    }

    struct_assign(newgamecontext, svc.context); /* copy statically init'd context */
    Sfi_context_info(nhfp, svc.context, _("gamestate-context"));
    relative_time_to_moves(ref_of(svc.context, "seer_turn"));
    relative_time_to_moves(ref_of(svc.context.digging, "lastdigtime"));
    svc.context.warntype.species = ismnum(svc.context.warntype.speciesidx)
                                  ? mons[svc.context.warntype.speciesidx]
                                  : null;
    /* context.victual.piece, .tin.tin, .spellbook.book, and .polearm.hitmon
       are pointers which get set to Null during save and will be recovered
       via corresponding o_id or m_id while objs or mons are being restored */

    /* we want to be able to revert to command line/environment/config
       file option values instead of keeping old save file option values
       if partial restore fails and we resort to starting a new game */
    struct_assign(newgameflags, flags);
    Sfi_flag(nhfp, flags, _("gamestate-flags"));

    /* avoid keeping permanent inventory window up to date during restore
       (setworn() calls update_inventory); attempting to include the cost
       of unpaid items before shopkeeper's bill is available is a no-no;
       named fruit names aren't accessible yet either
       [3.6.2: moved perm_invent from flags to iflags to keep it out of
       save files; retaining the override here is simpler than trying
       to figure out where it really belongs now] */
    defer_perm_invent = iflags.perm_invent;
    iflags.perm_invent = FALSE;
    /* wizard and discover are actually flags.debug and flags.explore;
       player might be overriding the save file values for them;
       in the discover case, we don't want to set that for a normal
       game until after the save file has been removed */
    iflags.deferred_X = (newgameflags.explore && !discover() ? 1 : 0);
    restoring_special = (wizard() || discover() ? 1 : 0);
    if (newgameflags.debug) {
        /* authorized by startup code; wizard mode exists and is allowed */
        flags.debug = TRUE, flags.explore = iflags.deferred_X = FALSE;
    } else if (restoring_special) {
        /* specified by save file; check authorization now. */
        set_playmode();
    }
    role_init(); /* Reset the initial role, race, gender, and alignment */

    sfi_long(nhfp, ref_of(svw, "wreserve"), _("wreserve"));
    Sfi_int32(nhfp, ref_of(svw, "wtreserved"), _("wtreserved"));
    Sfi_you(nhfp, u, _("gamestate-you"));
    gy.youmonst.cham = u.mcham;

    if (restoring_special && iflags.explore_error_flag) {
        /* savefile has wizard or explore mode, but player is no longer
           authorized to access either; can't downgrade mode any further, so
           fail restoration. */
        u.uhp = 0;
    }

    Sfi_char(nhfp, timebuf, _("gamestate-ubirthday"), 14);
    chars[timebuf + 14] = ord('\0');
    ubirthday = time_from_yyyymmddhhmmss(timebuf);
    sfi_long(nhfp, ref_of(urealtime, "realtime"), _("gamestate-realtime"));
    Sfi_char(nhfp, timebuf, _("gamestate-start_timing"), 14);
    chars[timebuf + 14] = ord('\0');

    urealtime.start_timing = time_from_yyyymmddhhmmss(timebuf);

    /* current time is the time to use for next urealtime.realtime update */
    urealtime.start_timing = getnow();

    set_uasmon();

    cliparound()(u.ux, u.uy);

    if (u.uhp <= 0 && (!Upolyd() || u.mh <= 0)) {
        u.ux = u.uy = 0; /* affects pline() [hence You()] */
        You(_("were not healthy enough to survive restoration."));
        /* wiz1_level.dlevel is used by mklev.c to see if lots of stuff is
         * uninitialized, so we only have to set it and not the other stuff.
         */
        wiz1_level().dlevel = 0;
        u.uz.dnum = 0;
        u.uz.dlevel = 1;
        /* revert to pre-restore option settings */
        iflags.deferred_X = FALSE;
        iflags.perm_invent = defer_perm_invent;
        struct_assign(flags, newgameflags);
        struct_assign(svc.context, newgamecontext);
        struct_assign(gy.youmonst, cg.zeromonst);
        return FALSE;
    }
    /* in case hangup save occurred in midst of level change */
    assign_level(u.uz0, u.uz);

    /* this stuff comes after potential aborted restore attempts */
    restore_killers(nhfp);
    restore_timers(nhfp, RANGE_GLOBAL, 0);
    restore_light_sources(nhfp);

    gi.invent = restobjchn(nhfp, FALSE);

    /* restore dangling (not on floor or in inventory) ball and/or chain */
    bc_obj = restobjchn(nhfp, FALSE);

    while (bc_obj) {
        let nobj = bc_obj.nobj;

        bc_obj.nobj = null;
        if (bc_obj.owornmask)
            setworn(bc_obj, bc_obj.owornmask);
        bc_obj = nobj;
    }

    gm.migrating_objs = restobjchn(nhfp, FALSE);
    gm.migrating_mons = restmonchn(nhfp);

    for (i = 0; i < NUMMONS; ++i) {
        Sfi_mvitals(nhfp, svm.mvitals[i], _("gamestate-mvitals"));
    }

    /*
     * There are some things after this that can have unintended display
     * side-effects too early in the game.
     * Disable see_monsters() here, re-enable it at the top of moveloop()
     */
    gd.defer_see_monsters = TRUE;

    /* this comes after inventory has been loaded */
    for (otmp = gi.invent; otmp; otmp = otmp.nobj)
        if (otmp.owornmask)
            setworn(otmp, otmp.owornmask);

    /* reset weapon so that player will get a reminder about "bashing"
       during next fight when bare-handed or wielding an unconventional
       item; for pick-axe, we aren't able to distinguish between having
       applied or wielded it, so be conservative and assume the former */
    otmp = uwep;   /* `uwep' usually init'd by setworn() in loop above */
    uwep = null;      /* clear it and have setuwep() reinit */
    setuwep(otmp); /* (don't need any null check here) */
    if (!uwep || uwep.otyp == PICK_AXE || uwep.otyp == GRAPPLING_HOOK)
        gu.unweapon = TRUE;

    restore_dungeon(nhfp);
    restlevchn(nhfp);
    /* hero_seq isn't saved and restored because it can be recalculated */
    gh.hero_seq = shl64(svm.moves, 3); /* normally handled in moveloop() */
    Sfi_q_score(nhfp, svq.quest_status, _("gamestate-quest_status"));

    for (i = 0; i < (MAXSPELL + 1); ++i) {
        Sfi_spell(nhfp, svs.spl_book[i], _("gamestate-spl_book"));
    }
    restore_artifacts(nhfp);
    restore_oracles(nhfp);
    Sfi_char(nhfp, svp.pl_character,
             _("gamestate-pl_character"), sizeof_member(svp, "pl_character"));
    Sfi_char(nhfp, svp.pl_fruit, _("gamestate-pl_fruit"), sizeof_member(svp, "pl_fruit"));
    freefruitchn(gf.ffruit); /* clean up fruit(s) made by initoptions() */
    gf.ffruit = loadfruitchn(nhfp);

    restnames(nhfp);
    restore_msghistory(nhfp);
    restore_gamelog(nhfp);
    restore_luadata(nhfp);

    /* must come after all mons & objs are restored */
    relink_timers(FALSE);
    relink_light_sources(FALSE);
    adj_erinys(u.ualign.abuse);
    /* inventory display is now viable */
    iflags.perm_invent = defer_perm_invent;

    return TRUE;
    } finally { stack_pop($frame); }
}

/* update game state pointers to those valid for the current level (so we
   don't dereference a wild u.ustuck when saving game state, for instance) */
function restlevelstate() { /* void */
    /*
     * Note: restoring steed and engulfer/holder/holdee is now handled
     * in getlev() and there's nothing left for restlevelstate() to do.
     */
    return;
}

/* after getlev(), put current level into a level/lock file;
   essential when splitting a save file into individual level files */
/*ARGSUSED*/
function restlevelfile(ltmp) { /* int */
    const $frame = stack_frame(); try {
    let whynot = stack_array(char, BUFSZ);
    let nhfp = null;

    nhfp = create_levelfile(ltmp, whynot);
    if (!nhfp) {
        /* failed to create a new file; don't attempt to make a panic save */
        program_state.something_worth_saving = 0;
        panic(_("restlevelfile: %s"), whynot);
    }
    bufon(nhfp.fd);
    nhfp.mode = WRITING | FREEING;
    savelev(nhfp, ltmp);
    close_nhfile(nhfp);
    return 2;
    } finally { stack_pop($frame); }
}

/*
 * restore_saved_game() prior to this left us at this position in
 * the savefile for dorecover():
 *
 *     format indicator                (1 byte)
 *     n = count of critical size list (1 byte)
 *     n bytes of critical sizes       (n bytes)
 *     version info
 * --> plnametmp = player name size (int, 2 bytes)
 *     player name (PL_NSIZ_PLUS)
 *     current level (including pets)
 *     (non-level-based) game state
 *     other levels
 */

export function dorecover(nhfp) { /* int */
    const $frame = stack_frame(); try {
    let ltmp = stack_var(xint8, 0);
    let rtmp;

    /* suppress map display if some part of the code tries to update that */
    program_state.restoring = REST_GSTATE;

    get_plname_from_file(nhfp, svp.plname, TRUE);
    /*
     * The position in the save file is now here:
     *
     *     format indicator                (1 byte)
     *     n = count of critical size list (1 byte)
     *     n bytes of critical sizes       (n bytes)
     *     version info
     *     plnametmp = player name size (int, 2 bytes)
     *     player name (PL_NSIZ_PLUS)
     * --> current level (including pets)
     *     (non-level-based) game state
     *     other levels
     */
    getlev(nhfp, 0, 0);
    if (!restgamestate(nhfp)) {
        let tnhfp = get_freeing_nhfile();

        display_nhwindow()(WIN_MESSAGE, TRUE);
        savelev(tnhfp, 0); /* discard current level */
        close_nhfile(tnhfp);
        close_nhfile(nhfp);
        delete_savefile();
        u.usteed_mid = u.ustuck_mid = 0;
        program_state.restoring = 0;
        return 0;
    }
    /* after restgamestate() -> restnames() so that 'bases[]' is populated */
    init_oclass_probs(); /* recompute go.oclass_prob_totals[] */

    restlevelstate();

    savestateinlock();

    rtmp = restlevelfile(ledger_no(u.uz));
    if (rtmp < 2)
        return rtmp; /* dorecover called recursively */

    program_state.restoring = REST_LEVELS;

    /* these pointers won't be valid while we're processing the
     * other levels, but they'll be reset again by restlevelstate()
     * afterwards, and in the meantime at least u.usteed may mislead
     * place_monster() on other levels
     */
    u.ustuck = null;
    u.usteed = null;

    /* #ifdef MICRO: not in this build */

    restoreinfo.mread_flags = 1; /* return despite error */
    while (1) {
        sfi_xint8(nhfp, addr_of(ltmp), _("gamestate-level_number"));
        if (nhfp.eof)
            break;
        getlev(nhfp, 0, ltmp[0]);
        /* #ifdef MICRO: not in this build */

        rtmp = restlevelfile(ltmp[0]);
        if (rtmp < 2)
            return rtmp; /* dorecover called recursively */
    }
    restoreinfo.mread_flags = 0;

    rewind_nhfile(nhfp);        /* return to beginning of file */
    validate(nhfp, 0, FALSE);
    get_plname_from_file(nhfp, svp.plname, TRUE);

    /* not 0 nor REST_GSTATE nor REST_LEVELS */
    program_state.restoring = REST_CURRENT_LEVEL;

    getlev(nhfp, 0, 0);
    close_nhfile(nhfp);
    restlevelstate();
    program_state.something_worth_saving = 1; /* useful data now exists */

    if (!wizard() && !discover())
        delete_savefile();
    if (Is_rogue_level(u.uz))
        assign_graphics(ROGUESET);
    reset_glyphmap(gm_levelchange);
    max_rank_sz(); /* to recompute gm.mrank_sz (botl.c) */

    if ((uball && !uchain) || (uchain && !uball)) {
        impossible(_("restgamestate: lost ball & chain"));
        /* poor man's unpunish() */
        setworn(null, W_CHAIN);
        setworn(null, W_BALL);
    }

    /* in_use processing must be after:
     *    + The inventory has been read so that freeinv() works.
     *    + The current level has been restored so billing information
     *      is available.
     */
    inven_inuse(FALSE);

    /* Set up the vision internals, after levl[] data is loaded
       but before docrt(). */
    reglyph_darkroom();
    vision_reset();
    gv.vision_full_recalc = 1; /* recompute vision (not saved) */

    run_timers(); /* expire all timers that have gone off while away */
    program_state.restoring = 0; /* affects bot() so clear before docrt() */

    if (ge.early_raw_messages && !program_state.beyond_savefile_load) {
        /*
         * We're about to obliterate some potentially important
         * startup messages, so give the player a chance to see them.
         */
        ge.early_raw_messages = 0;
        wait_synch()();
    }
    u.usteed_mid = u.ustuck_mid = 0;
    program_state.beyond_savefile_load = 1;

    docrt();
    clear_nhwindow()(WIN_MESSAGE);

    /* Success! */
    welcome(FALSE);
    check_special_room(FALSE);
    return 1;
    } finally { stack_pop($frame); }
}

function rest_stairs(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let buflen = stack_var(int, 0);
    let stway = init_list(stack_struct(struct_stairway), {});

    let newst;

    stairway_free_all();

    while (1) {
        sfi_int(nhfp, buflen, _("stairs-staircount"));
        if (buflen[0] == -1)
            break;

        Sfi_stairway(nhfp, stway, _("stairs-stairway"));
        if (program_state.restoring != REST_GSTATE
            && stway.tolev.dnum == u.uz.dnum) {
            /* stairway dlevel is relative, make it absolute */
            stway.tolev.dlevel += u.uz.dlevel;
        }

        stairway_add(stway.sx, stway.sy, stway.up, stway.isladder,
                     stway.tolev);
        newst = stairway_at(stway.sx, stway.sy);
        if (newst)
            newst.u_traversed = stway.u_traversed;
    }
    } finally { stack_pop($frame); }
}

export function restcemetery(nhfp, cemeteryaddr) { /* void */
    const $frame = stack_frame(); try {
    let bonesinfo, bonesaddr;
    let cflag = stack_var(int, 0);

    sfi_int(nhfp, cflag, _("cemetery-cemetery_flag"));
    if (cflag[0] == 0) {
        bonesaddr = cemeteryaddr;
        do {
            bonesinfo = view_of(struct_cemetery, addr_of(alloc(sizeof(struct_cemetery))));
            Sfi_cemetery(nhfp, bonesinfo, _("cemetery-bonesinfo"));
            bonesaddr[0] = bonesinfo;
            bonesaddr = ref_of((bonesaddr[0]), "next");
        } while (bonesaddr[0]);
    } else {
        cemeteryaddr[0] = null;
    }
    if (((nhfp.mode & CONVERTING) != 0)
         || ((nhfp.mode & UNCONVERTING) != 0)) {
        let thisbones, nextbones;

        /* free the memory */
        nextbones = cemeteryaddr[0];
        while ((thisbones = nextbones) != null) {
            nextbones = thisbones.next;
            free(addr_of(thisbones));
        }
        cemeteryaddr[0] = null;
    }
    } finally { stack_pop($frame); }
}

/*ARGSUSED*/
function rest_levl(nhfp) { /* void */
    let c, r;

    for (c = 0; c < COLNO; ++c) {
        for (r = 0; r < ROWNO; ++r) {
            Sfi_rm(nhfp, levl()[c][r], _("location-rm"));
        }
    }
}

export function trickery(reason) { /* void */
    pline(_("Strange, this map is not as I remember it."));
    pline(_("Somebody is trying some trickery here..."));
    pline(_("This game is void."));
    strcpy(svk.killer.name, reason ? reason : _(""));
    done(TRICKED);
}

export function getlev(nhfp, pid, lev) { /* void */
    const $frame = stack_frame(); try {
    let trap;

    let mtmp;
    let br;
    let x, y;

    let elapsed = 0;
    let hpid = stack_var(int, 0);
    let dlvl = stack_var(xint8, 0);
    let i, c, r;
    let ghostly = +(nhfp.ftype == NHF_BONESFILE);
    let tmpc = null;

    program_state.in_getlev = TRUE;

    if (ghostly)
        clear_id_mapping();

    /* Load the old fruit info.  We have to do it first, so the
     * information is available when restoring the objects.
     */
    if (ghostly)
        go.oldfruit = loadfruitchn(nhfp);

    /* First some sanity checks */
    sfi_int(nhfp, hpid, _("gamestate-hackpid"));
/* CHECK:  This may prevent restoration */
    sfi_xint8(nhfp, addr_of(dlvl), _("gamestate-dlvl"));

    if ((pid && pid != hpid[0]) || (lev && dlvl[0] != lev)) {
        let trickbuf = stack_array(char, BUFSZ);

        if (pid && pid != hpid[0])
            sprintf(trickbuf, _("PID (%d) doesn't match saved PID (%d)!"), hpid[0], pid);
        else
            sprintf(trickbuf, _("This is level %d, not %d!"), dlvl[0], lev)
;
        if (wizard())
            pline1(trickbuf);
        trickery(trickbuf);
    }

    restcemetery(nhfp, ref_of(svl.level, "bonesinfo"));
    rest_levl(nhfp);

    for (c = 0; c < COLNO; ++c) {
        for (r = 0; r < ROWNO; ++r) {
            Sfi_schar(nhfp, svl.lastseentyp[c] + r, _("lastseentyp"));
        }
    }
    sfi_long(nhfp, ref_of(svo, "omoves"), _("lev-timestmp"));
    elapsed = (svm.moves - svo.omoves);

    rest_stairs(nhfp);
    Sfi_dest_area(nhfp, svu.updest, _("lev-updest"));
    Sfi_dest_area(nhfp, svd.dndest, _("lev-dndest"));
    Sfi_levelflags(nhfp, svl.level.flags, _("lev-level_flags"));
    rest_adjust_levelflags();
    if (svd.doors) {
        free(addr_of(svd.doors));
        svd.doors = null;
    }

    sfi_int(nhfp, ref_of(svd, "doors_alloc"), _("lev-doors_alloc"));
    if (svd.doors_alloc) { /* avoid pointless alloc(0) */
        svd.doors = view_of(struct_nhcoord, addr_of(alloc(unsigned(Math.imul(unsigned(svd.doors_alloc), sizeof(struct_nhcoord))))));
        tmpc = svd.doors;
        for (i = 0; i < svd.doors_alloc; ++i) {
            Sfi_nhcoord(nhfp, tmpc, _("lev-doors"));
            tmpc = ptr_add(tmpc, 1);
        }
    }
    rest_rooms(nhfp); /* No joke :-) */
    if (svn.nroom) {
        gd.doorindex = elt(svr.rooms, svn.nroom - 1).fdoor
                               + elt(svr.rooms, svn.nroom - 1).doorct;
    } else {
        gd.doorindex = 0;
    }

    restore_timers(nhfp, RANGE_LEVEL, elapsed);
    restore_light_sources(nhfp);
    svl.level.monlist = restmonchn(nhfp);
    rest_worm(nhfp);    /* restore worm information */

    gf.ftrap = null;
    for (;;) {
        trap = newtrap();
        Sfi_trap(nhfp, trap, _("trap"));
        if (trap.tx != 0) {
            if (program_state.restoring != REST_GSTATE
                && trap.dst.dnum == u.uz.dnum) {
                /* convert relative destination to absolute */
                trap.dst.dlevel += u.uz.dlevel;
            }
            trap.ntrap = gf.ftrap;
            gf.ftrap = trap;
        } else
            break;
    }
    dealloc_trap(trap);

    svl.level.objlist = restobjchn(nhfp, FALSE);

    find_lev_obj();

    /* restobjchn()'s `frozen' argument probably ought to be a callback
       routine so that we can check for objects being buried under ice */
    svl.level.buriedobjlist = restobjchn(nhfp, FALSE);
    gb.billobjs = restobjchn(nhfp, FALSE);
    rest_engravings(nhfp);

    /* reset level.monsters for new level */
    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            svl.level.monsters[x][y] = null;
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (mtmp.isshk)
            set_residency(mtmp, FALSE);
        if (mtmp.m_id == u.usteed_mid) {
            /* steed is kept on fmon list but off the map */
            u.usteed = mtmp;
            u.usteed_mid = 0;
        } else {
            if (mtmp.m_id == u.ustuck_mid) {
                set_ustuck(mtmp);
                u.ustuck_mid = 0;
            }
            place_monster(mtmp, mtmp.mx, mtmp.my);
            if (mtmp.wormno)
                place_wsegs(mtmp, null);
            if (hides_under(mtmp.data) && mtmp.mundetected)
                hideunder(mtmp);
        }

        /* regenerate monsters while on another level */
        if (!u.uz.dlevel || program_state.restoring == REST_LEVELS)
            continue;
        if (ghostly) {
            /* reset peaceful/malign relative to new character;
               shopkeepers will reset based on name */
            if (!mtmp.isshk)
                mtmp.mpeaceful = unsigned((is_unicorn(mtmp.data)
                                   && (sgn(u.ualign.type)
                                       == sgn(mtmp.data.maligntyp))) ? 1
                                  : peace_minded(mtmp.data));
            set_malign(mtmp);
        } else if (elapsed > 0) {
            mon_catchup_elapsed_time(mtmp, elapsed);
        }
        /* update shape-changers in case protection against
           them is different now than when the level was saved */
        restore_cham(mtmp);
        /* give hiders a chance to hide before their next move */
        if (ghostly || (elapsed > 0 && elapsed > rnd(10)))
            hide_monst(mtmp);
    }

    restdamage(nhfp);
    rest_regions(nhfp);
    rest_bubbles(nhfp); /* for water and air; empty marker on other levels */
    load_exclusions(nhfp);
    rest_track(nhfp);

    if (ghostly) {
        let stway = gs.stairs;
        while (stway) {
            if (!stway.isladder && !stway.up
                && stway.tolev.dnum == u.uz.dnum)
                break;
            stway = stway.next;
        }

        /* Now get rid of all the temp fruits... */
        freefruitchn(go.oldfruit), go.oldfruit = null;

        if (lev > ledger_no(svd.dungeon_topology.d_medusa_level)
            && lev < ledger_no(svd.dungeon_topology.d_stronghold_level) && !stway) {
            let cc = stack_struct(struct_nhcoord);
            let dest = stack_struct(struct_d_level);

            dest.dnum = u.uz.dnum;
            dest.dlevel = u.uz.dlevel + 1;

            mazexy(cc);
            stairway_add(cc.x, cc.y, FALSE, FALSE, dest);
            levl()[cc.x][cc.y].typ = STAIRS;
        }

        br = Is_branchlev(u.uz);
        if (br && u.uz.dlevel == 1) {
            let ltmp = stack_struct(struct_d_level);

            if (on_level(u.uz, br.end1))
                assign_level(ltmp, br.end2);
            else
                assign_level(ltmp, br.end1);

            switch (br.type) {
            case BR_STAIR:
            case BR_NO_END1:
            case BR_NO_END2:
                stway = gs.stairs;
                while (stway) {
                    if (stway.tolev.dnum != u.uz.dnum)
                        break;
                    stway = stway.next;
                }
                if (stway)
                    assign_level(stway.tolev, ltmp);
                break;
            case BR_PORTAL: /* max of 1 portal per level */
                for (trap = gf.ftrap; trap; trap = trap.ntrap)
                    if (trap.ttyp == MAGIC_PORTAL)
                        break;
                if (!trap)
                    panic(_("getlev: need portal but none found"));
                assign_level(trap.dst, ltmp);
                break;
            }
        } else if (!br) {
            let ttmp = null;

            /* Remove any dangling portals. */
            for (trap = gf.ftrap; trap; trap = ttmp) {
                ttmp = trap.ntrap;
                if (trap.ttyp == MAGIC_PORTAL)
                    deltrap(trap);
            }
        }
    }
    /* must come after all mons & objs are restored */
    relink_timers(ghostly);
    relink_light_sources(ghostly);
    reset_oattached_mids(ghostly);

    if (ghostly)
        clear_id_mapping();
    program_state.in_getlev = FALSE;

    program_state.in_getlev = FALSE;
    } finally { stack_pop($frame); }
}

export function rest_adjust_levelflags() { /* void */
    /* adjust timestamps */
    relative_time_to_moves(ref_of(svl.level.flags, "stasis_until"));
}
export function moves_to_relative_time(timestamp) { /* void */
    let prevts = timestamp[0];

    timestamp[0] = prevts - svm.moves;
}

export function relative_time_to_moves(timestamp) { /* void */
    let prevts = timestamp[0];

    timestamp[0] = svm.moves + prevts;
}

/* "name-role-race-gend-algn" occurs very early in a save file; sometimes we
   want the whole thing, other times just "name" (for svp.plname[]) */
export function get_plname_from_file(
    nhfp,
    outbuf,
    name_only) { /* void */ /* True: just name; False: name-role-race-gend-algn */
    const $frame = stack_frame(); try {
    let plbuf = stack_array(char, PL_NSIZ_PLUS);
    let pltmpsiz = stack_var(int, 0);

    chars[plbuf + 0] = ord('\0');

    sfi_int(nhfp, pltmpsiz, _("plname-size"));
    /* pltmpsiz should now be PL_NSIZ_PLUS */
    Sfi_char(nhfp, plbuf, _("plname"), pltmpsiz[0]);
    /* plbuf[PL_NSIZ_PLUS-2] should be '\0';
       plbuf[PL_NSIZ_PLUS-1] should be '-' or 'X' or 'D' */
    /* "-race-role-gend-algn" is already present except that it has been
       hidden by replacing the initial dash with NUL; if we want that
       information, replace the NUL with a dash */
    if (!name_only)
        chars[eos(plbuf)] = ord('-');
    /* not simple strcpy(); playmode is in the last slot and could (probably
       will) be preceded by NULs */
    memcpy(outbuf, plbuf, PL_NSIZ_PLUS);
    return;
    } finally { stack_pop($frame); }
}

/* restore Plane of Water's air bubbles and Plane of Air's clouds */

function rest_bubbles(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let bbubbly = stack_var(xint8);

    /* whether or not the Plane of Water's air bubbles or Plane of Air's
       clouds are present is recorded during save so that we don't have to
       know what level is being restored */
    bbubbly[0] = 0;
    sfi_xint8(nhfp, addr_of(bbubbly), _("bubbles-bbubbly"));

    if (bbubbly[0])
        restore_waterlevel(nhfp);
    } finally { stack_pop($frame); }
}

function restore_gamelog(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let slen = stack_var(int, 0);
    let msg = stack_array(char, BUFSZ*2);
    let tmp = init_list(stack_struct(struct_gamelog_line), { turn: 0 });

    while (1) {
        sfi_int(nhfp, slen, _("gamelog-length"));
        if (slen[0] == -1)
            break;
        if (slen[0] > ((BUFSZ*2) - 1))
            panic(_("restore_gamelog: msg too big (%d)"), slen[0]);
        Sfi_char(nhfp, msg, _("gamelog-gamelog_text"), slen[0]);
        chars[msg + (slen[0])] = ord('\0');
        Sfi_gamelog_line(nhfp, tmp, _("gamelog-gamelog_line"));

        gamelog_add(tmp.flags, tmp.turn, msg);
    }
    } finally { stack_pop($frame); }
}

function restore_msghistory(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let msgsize = stack_var(int, 0);

    let msgcount = 0;

    let msg = stack_array(char, BUFSZ);

    while (1) {
        sfi_int(nhfp, msgsize, _("msghistory-length"));
        if (msgsize[0] == -1)
            break;
        if (msgsize[0] > BUFSZ - 1)
            panic(_("restore_msghistory: msg too big (%d)"), msgsize[0]);
        Sfi_char(nhfp, msg, _("msghistory-msg"), msgsize[0]);
        chars[msg + (msgsize[0])] = ord('\0');

        putmsghistory()(msg, TRUE);
        ++msgcount;
    }

    if (msgcount)
        putmsghistory()(0, TRUE);
    debugpline1(_("Read %d messages from savefile."), msgcount, __FILE__);
    } finally { stack_pop($frame); }
}

/* Clear all structures for object and monster ID mapping. */
function clear_id_mapping() { /* void */
    let curr;

    while ((curr = gi.id_map) != null) {
        gi.id_map = curr.next;
        free(addr_of(curr));
    }
    gn.n_ids_mapped = 0;
}

/* Add a mapping to the ID map. */
function add_id_mapping(gid, nid) { /* void */
    let idx;

    idx = gn.n_ids_mapped % N_PER_BUCKET;
    /* idx is zero on first time through, as well as when a new bucket is */
    /* needed */
    if (idx == 0) {
        let gnu = view_of(struct_bucket, addr_of(alloc(sizeof(struct_bucket))));
        gnu.next = gi.id_map;
        gi.id_map = gnu;
    }

    gi.id_map.map[idx].gid = gid;
    gi.id_map.map[idx].nid = nid;
    gn.n_ids_mapped++;
}

/*
 * Global routine to look up a mapping.  If found, return TRUE and fill
 * in the new ID value.  Otherwise, return false and return -1 in the new
 * ID.
 */
export function lookup_id_mapping(gid, nidp) { /* boolean */
    let i;
    let curr;

    if (gn.n_ids_mapped)
        for (curr = gi.id_map; curr; curr = curr.next) {
            /* first bucket might not be totally full */
            if (curr == gi.id_map) {
                i = gn.n_ids_mapped % N_PER_BUCKET;
                if (i == 0)
                    i = N_PER_BUCKET;
            } else
                i = N_PER_BUCKET;

            while (--i >= 0)
                if (gid == curr.map[i].gid) {
                    nidp[0] = curr.map[i].nid;
                    return TRUE;
                }
        }

    return FALSE;
}

function reset_oattached_mids(ghostly) { /* void */
    const $frame = stack_frame(); try {
    let otmp;
    let oldid, nid = stack_var(unsigned);

    for (otmp = fobj(); otmp; otmp = otmp.nobj) {
        if (ghostly && has_omonst(otmp)) {
            let mtmp = OMONST(otmp);

            mtmp.m_id = 0;
            mtmp.mpeaceful = mtmp.mtame = 0; /* pet's owner died! */
        }
        if (ghostly && has_omid(otmp)) {
            oldid = OMID(otmp);
            if (lookup_id_mapping(oldid, nid))
                ((otmp).oextra.omid) = nid[0];
            else
                free_omid(otmp);
        }
    }
    } finally { stack_pop($frame); }
}

/* put up a menu listing each character from this player's saved games;
   returns 1: use svp.plname[], 0: new game, -1: quit */
export function restore_menu(
    bannerwin) { /* int */ /* if not WIN_ERR, clear window * and show copyright in menu */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let saved, next, mode, menutext = stack_array(char, BUFSZ);
    let all_normal;
    let chosen_game = stack_var(ptr_to(struct_mi), null);
    let k, clet, ch = 0; /* ch: 0 => new game */
    let clr = NO_COLOR;

    chars[svp.plname] = ord('\0');
    saved = get_saved_games(); /* array of character names */
    if (saved && saved[0]) {
        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
        struct_assign(any, cg.zeroany); /* no selection */
        if (bannerwin != WIN_ERR) {
            /* for tty; erase copyright notice and redo it in the menu */
            clear_nhwindow()(bannerwin);
            /* COPYRIGHT_BANNER_[ABCD] */
            for (k = 1; k <= 4; ++k)
                add_menu_str(tmpwin, copyright_banner_line(k));
            add_menu_str(tmpwin, _(""));
        }
        add_menu_str(tmpwin, _("Select one of your saved games"));
        /* if all the save files have a playmode of '-' then we'll just list
           their character name-role-race-gend-algn values, but if any are
           'X' or 'D', we'll list playmode along with name-role-&c values
           for every entry; first, figure out if they're all normal play */
        for (all_normal = TRUE, k = 0; all_normal && saved[k]; ++k) {
            next = saved[k];
            mode = chars[next + (PL_NSIZ_PLUS - 1)]; /* fixed last char, beyond '\0' */
            if (mode != ord('-'))
                all_normal = FALSE;
        }
        for (k = 0; saved[k]; ++k) {
            any.a_int = k + 1;
            next = saved[k];
            mode = chars[next + (PL_NSIZ_PLUS - 1)];
            if (all_normal)
                sprintf(menutext, _("%.*s"), PL_NSIZ_PLUS - 1, next);
            else
                sprintf(menutext, _("%c %.*s"), mode, PL_NSIZ_PLUS - 1, next);
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE, clr,
                     menutext, MENU_ITEMFLAGS_SKIPMENUCOLORS);
        }
        clet = (k <= ord('n') - ord('a')) ? ord('n')      /* new game */
               : (k <= 26 + ord('N') - ord('A')) ? ord('N') : 0;
        any.a_int = -1;                    /* not >= 0 */
        add_menu(tmpwin, nul_glyphinfo, any, clet, ord('N'), ATR_NONE, clr,
                 _("Start a new character"), MENU_ITEMFLAGS_NONE);
        clet = (k + 1 <= ord('q') - ord('a') && clet == ord('n')) ? ord('q')  /* quit */
               : (k + 1 <= 26 + ord('Q') - ord('A') && clet == ord('N')) ? ord('Q') : 0;
        any.a_int = -2;
        add_menu(tmpwin, nul_glyphinfo, any, clet, ord('Q'), ATR_NONE, clr,
                 _("Never mind (quit)"), MENU_ITEMFLAGS_SELECTED);
        /* no prompt on end_menu, as we've done our own at the top */
        end_menu()(tmpwin, 0);
        if (select_menu(tmpwin, PICK_ONE, chosen_game) > 0) {
            ch = chosen_game[0].item.a_int;
            if (ch > 0)
                strcpy(svp.plname, saved[ch - 1]);
            else if (ch < 0)
                ++ch; /* -1 -> 0 (new game), -2 -> -1 (quit) */
            free(addr_of(chosen_game[0]));
        } else {
            ch = -1; /* quit menu without making a selection => quit */
        }
        destroy_nhwindow()(tmpwin);
        if (bannerwin != WIN_ERR) {
            /* for tty; clear the menu away and put subset of copyright back
             */
            clear_nhwindow()(bannerwin);
            /* COPYRIGHT_BANNER_A, preceding "Who are you?" prompt */
            if (ch == 0)
                putstr()(bannerwin, 0, copyright_banner_line(1));
        }
    }
    free_saved_games(saved);
    return (ch > 0) ? 1 : ch;
    } finally { stack_pop($frame); }
}

/*restore.c*/

import { NO_COLOR } from "./color.h.js";
import { struct_context_info } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import { gm_levelchange } from "./display.h.js";
import {
    BR_NO_END1, BR_NO_END2, BR_PORTAL, BR_STAIR, struct_d_level, struct_s_level,
} from "./dungeon.h.js";
import { Is_rogue_level } from "./dungeon.h.macros.js";
import { struct_flag } from "./flag.h.js";
import { discover, wizard } from "./flag.h.macros.js";
import { BUFSZ, COLNO, FALSE, PL_NSIZ_PLUS, ROWNO, TRUE, xint8 } from "./global.h.js";
import {
    CONVERTING, DEFUNCT_MONSTER, FREEING, NHF_BONESFILE, REST_CURRENT_LEVEL, REST_GSTATE,
    REST_LEVELS, TRICKED, UNCONVERTING, WRITING, struct_gamelog_line,
} from "./hack.h.js";
import { pline1, wiz1_level } from "./hack.h.macros.js";
import { debugpline1 } from "./lint.h.macros.js";
import { EBONES, EDOG, EGD, EMIN, EPRI, ESHK, MGIVENNAME } from "./mextra.h.macros.js";
import { hides_under, is_unicorn, monsndx } from "./mondata.h.macros.js";
import { MON_NOWEP, ismnum, newmonst } from "./monst.h.macros.js";
import { NON_PM, NUMMONS } from "./monsters.h.js";
import { OBJ_FREE } from "./obj.h.js";
import {
    Has_contents, OMID, OMONST, ONAME, age_is_relative, has_omid, has_omonst, newobj,
} from "./obj.h.macros.js";
import { MAXSPELL } from "./objclass.h.js";
import { dealloc_fruit, newfruit } from "./objclass.h.macros.js";
import { GRAPPLING_HOOK, ICE_BOX, PICK_AXE, SLIME_MOLD } from "./objects.h.js";
import { W_BALL, W_CHAIN, W_WEP } from "./prop.h.js";
import { STAIRS, struct_cemetery, struct_damage } from "./rm.h.js";
import { fmon, fobj, levl } from "./rm.h.macros.js";
import {
    Sfi_cemetery, Sfi_char, Sfi_context_info, Sfi_damage, Sfi_dest_area, Sfi_ebones, Sfi_edog,
    Sfi_egd, Sfi_emin, Sfi_epri, Sfi_eshk, Sfi_flag, Sfi_fruit, Sfi_gamelog_line, Sfi_int32,
    Sfi_levelflags, Sfi_monst, Sfi_mvitals, Sfi_nhcoord, Sfi_obj, Sfi_q_score, Sfi_rm, Sfi_s_level,
    Sfi_schar, Sfi_spell, Sfi_stairway, Sfi_trap, Sfi_you,
} from "./savefile.h.macros.js";
import { struct_stairway } from "./stairs.h.js";
import { ROGUESET } from "./sym.h.js";
import { RANGE_GLOBAL, RANGE_LEVEL } from "./timeout.h.js";
import { MAGIC_PORTAL } from "./trap.h.js";
import { dealloc_trap, newtrap } from "./trap.h.macros.js";
import {
    clear_nhwindow, cliparound, create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu,
    putmsghistory, putstr, start_menu, wait_synch,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED,
    MENU_ITEMFLAGS_SKIPMENUCOLORS, NHW_MENU, PICK_ONE, WIN_ERR, struct_any, struct_mi,
} from "./wintype.h.js";
import { Upolyd } from "./you.h.macros.js";
import { char, int, ord, sizeof, ulong, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { shl64 } from "../rt/int64.js";
import { assert, free, getuid, memcpy, sprintf, strcpy } from "../rt/libc.js";
import { init_list, stack_array, stack_struct, stack_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_to, ref_of, sizeof_member, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { welcome } from "./allmain.js";
import { alloc } from "./alloc.js";
import { restore_artifacts } from "./artifact.js";
import { newebones } from "./bones.js";
import { max_rank_sz } from "./botl.js";
import { getnow, time_from_yyyymmddhhmmss } from "./calendar.js";
import {
    cg, flags, gb, gc, gd, ge, gf, gh, gi, gm, gn, go, gs, gu, gv, gy, iflags, program_state, svc,
    svd, svk, svl, svm, svn, svo, svp, svq, svr, svs, svu, svw, u, urealtime,
} from "./decl.js";
import { docrt, nul_glyphinfo, reglyph_darkroom, reset_glyphmap } from "./display.js";
import { new_mgivenname, new_oname } from "./do_name.js";
import { mon_catchup_elapsed_time, newedog } from "./dog.js";
import {
    Is_branchlev, assign_level, ledger_no, load_exclusions, on_level, restore_dungeon,
} from "./dungeon.js";
import { done, panic, restore_killers } from "./end.js";
import { rest_engravings } from "./engrave.js";
import {
    close_nhfile, create_levelfile, delete_savefile, free_saved_games, get_freeing_nhfile,
    get_saved_games, rewind_nhfile,
} from "./files.js";
import { check_special_room } from "./hack.js";
import { eos, sgn } from "./hacklib.js";
import { useup } from "./invent.js";
import { relink_light_sources, restore_light_sources } from "./light.js";
import { newmextra, peace_minded, propagate, set_malign } from "./makemon.js";
import { newemin } from "./minion.js";
import { mazexy, restore_waterlevel } from "./mkmaze.js";
import {
    free_omid, new_omailcmd, newoextra, newomid, newomonst, next_ident, place_object,
} from "./mkobj.js";
import { rest_rooms } from "./mkroom.js";
import { adj_erinys, hide_monst, hideunder, restore_cham, set_ustuck } from "./mon.js";
import { mons } from "./monst.js";
import { restore_luadata } from "./nhlua.js";
import { init_oclass_probs, restnames } from "./o_init.js";
import { xname } from "./objnam.js";
import { fruitadd, set_playmode } from "./options.js";
import { You, gamelog_add, impossible, pline } from "./pline.js";
import { set_uasmon } from "./polyself.js";
import { newepri, restpriest } from "./priest.js";
import { rest_regions } from "./region.js";
import { rnd } from "./rnd.js";
import { role_init } from "./role.js";
import { restore_oracles } from "./rumors.js";
import { savelev, savestateinlock } from "./save.js";
import { sfi_int, sfi_long, sfi_ulong, sfi_unsigned, sfi_xint8 } from "./sfbase.js";
import { bufon, restoreinfo } from "./sfstruct.js";
import { restshk, set_residency } from "./shk.js";
import { neweshk } from "./shknam.js";
import { stairway_add, stairway_at, stairway_free_all } from "./stairs.js";
import { place_monster } from "./steed.js";
import { assign_graphics } from "./symbols.js";
import { sysopt } from "./sys.js";
import { relink_timers, restore_timers, run_timers } from "./timeout.js";
import { rest_track } from "./track.js";
import { deltrap } from "./trap.js";
import { newegd } from "./vault.js";
import { copyright_banner_line, validate } from "./version.js";
import { vision_reset } from "./vision.js";
import { setuwep } from "./wield.js";
import { add_menu, add_menu_str, select_menu } from "./windows.js";
import { place_wsegs, rest_worm } from "./worm.js";
import { setworn } from "./worn.js";
const __FILE__ = "restore.c";
