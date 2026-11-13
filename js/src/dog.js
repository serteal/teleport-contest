/* NetHack 5.0	dog.c	$NHDT-Date: 1753856387 2025/07/29 22:19:47 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.190 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

    const Before_you = 0;

    const With_you = 1;
    const After_you = 2;
    const Wiz_arrive = -1;

export function newedog(mtmp) { /* void */
    if (!mtmp.mextra)
        mtmp.mextra = newmextra();
    if (!EDOG(mtmp)) {
        ((mtmp).mextra.edog) = view_of(struct_edog, addr_of(alloc(sizeof(struct_edog))));
        memset(addr_of(EDOG(mtmp)), 0, sizeof(struct_edog));
        EDOG(mtmp).parentmid = mtmp.m_id;
    }
}

export function free_edog(mtmp) { /* void */
    if (mtmp.mextra && EDOG(mtmp)) {
        free(addr_of(EDOG(mtmp)));
        ((mtmp).mextra.edog) = null;
    }
    mtmp.mtame = 0;
}

export function initedog(mtmp, everything) { /* void */
    let edogp = EDOG(mtmp);
    let minhungry = svm.moves + 1000;
    let minimumtame = is_domestic(mtmp.data) ? 10 : 5;

    mtmp.mtame = max(minimumtame, mtmp.mtame);
    mtmp.mpeaceful = 1;
    mtmp.mavenge = 0;
    set_malign(mtmp); /* recalc alignment now that it's tamed */
    if (everything) {
        mtmp.mleashed = 0;
        mtmp.meating = 0;
        edogp.droptime = 0;
        edogp.dropdist = 10000;
        edogp.apport = ACURR(A_CHA);
        edogp.whistletime = 0;
        /* edogp->hungrytime = 0L; // set below */
        edogp.ogoal.x = -1; /* force error if used before set */
        edogp.ogoal.y = -1;
        edogp.abuse = 0;
        edogp.revivals = 0;
        edogp.mhpmax_penalty = 0;
        edogp.killed_by_u = 0;
    } else {
        if (edogp.apport <= 0)
            edogp.apport = 1;
    }
    /* always set for newly tamed pet or feral former pet; hungrytime might
       already be higher when taming magic affects already tame monst */
    if (edogp.hungrytime < minhungry)
        edogp.hungrytime = minhungry;
    /* livelog first pet, but only if you didn't start with one (the starting
     * pet will be initialized before in_moveloop is true) */
    if (!u.uconduct.pets && program_state.in_moveloop) {
        /* "obtained" a pet rather than "tamed" it because it might have come
         * from a figurine or some other method in which it was created tame
         * using an() is safe unless it somehow becomes possible to tame a
         * unique monster */
        livelog_printf(LL_CONDUCT, _("obtained %s first pet (%s)"),
                       uhis(), an(mon_pmname(mtmp)));
    }
    u.uconduct.pets++;
}

function pet_type() { /* int */
    if (gu.urole.petnum != NON_PM)
        return  gu.urole.petnum;
    else if (gp.preferred_pet == ord('c'))
        return  PM_KITTEN;
    else if (gp.preferred_pet == ord('d'))
        return  PM_LITTLE_DOG;
    else
        return  rn2(2) ? PM_KITTEN : PM_LITTLE_DOG;
}

function pick_familiar_pm(otmp, quietly) { /* struct permonst * */
    let pm = null;

    if (otmp) { /* figurine; otherwise spell */
        let mndx = otmp.corpsenm;

        assert(ismnum(mndx));
        pm = mons[mndx];
        /* activating a figurine provides one way to exceed the
           maximum number of the target critter created--unless
           it has a special limit (erinys, Nazgul) */
        if ((svm.mvitals[mndx].mvflags & G_EXTINCT)
            && mbirth_limit(mndx) != MAXMONNO) {
            if (!quietly)
                /* have just been given "You <do something with>
                   the figurine and it transforms." message */
                pline(_("... into a pile of dust."));
            return null;
        }
    } else if (!rn2(3)) {
        pm = mons[pet_type()];
    } else {
        let skill = spell_skilltype(SPE_CREATE_FAMILIAR);
        let max = 3 * P_SKILL(skill);

        pm = rndmonst_adj(0, max);
        if (!pm && !quietly)
            There(_("seems to be nothing available for a familiar."));
    }
    return pm;
}

export function make_familiar(otmp, x, y, quietly) { /* struct monst * */
    let pm;
    let mtmp = null;
    let chance, trycnt = 100;
    let reallytame = TRUE;

    do {
        let mmflags;
        let cgend;

        if (!(pm = pick_familiar_pm(otmp, quietly)))
            break;

        mmflags = MM_EDOG | MM_IGNOREWATER | NO_MINVENT | MM_NOMSG;
        cgend = otmp ? (otmp.spe & CORPSTAT_GENDER) : 0;
        mmflags = or64(mmflags, ((cgend == CORPSTAT_FEMALE) ? MM_FEMALE
                    : (cgend == CORPSTAT_MALE) ? MM_MALE : 0));

        mtmp = makemon(pm, x, y, mmflags);
        if (otmp) { /* figurine */
            if (!mtmp) {
                /* monster has been genocided or target spot is occupied */
                if (!quietly)
                    pline_The(
                           _("figurine writhes and then shatters into pieces!"));
                break;
            } else if (mtmp.isminion) {
                /* Fixup for figurine of an Angel:  makemon() is willing to
                   create a random Angel as either an ordinary monster or as
                   a minion of random allegiance.  We don't want the latter
                   here in case it successfully becomes a pet. */
                mtmp.isminion = 0;
                free_emin(mtmp);
                /* [This could and possibly should be redone as a new
                   MM_flag passed to makemon() to suppress making a minion
                   so that no post-creation fixup would be needed.] */
            }
        }
    } while (!mtmp && --trycnt > 0);

    if (!mtmp)
        return null;

    if (is_pool(mtmp.mx, mtmp.my) && minliquid(mtmp))
        return null;

    if (otmp) { /* figurine; resulting monster might not become a pet */
        chance = rn2(10); /* 0==tame, 1==peaceful, 2==hostile */
        if (chance > 2)
            chance = otmp.blessed ? 0 : !otmp.cursed ? 1 : 2;
        /* 0,1,2:  b=80%,10,10; nc=10%,80,10; c=10%,10,80 */
        if (chance > 0) {
            reallytame = FALSE; /* not tame after all */
            if (chance == 2) {  /* hostile (cursed figurine) */
                if (!quietly)
                    You(_("get a bad feeling about this."));
                mtmp.mpeaceful = 0;
                set_malign(mtmp);
            }
        }
        /* if figurine has been named, give same name to the monster */
        if (has_oname(otmp))
            mtmp = christen_monst(mtmp, ONAME(otmp));
    }
    if (reallytame)
        initedog(mtmp, TRUE);
    mtmp.msleeping = 0;
    set_malign(mtmp); /* more alignment changes */
    newsym(mtmp.mx, mtmp.my);

    /* must wield weapon immediately since pets will otherwise drop it */
    if (mtmp.mtame && attacktype(mtmp.data, AT_WEAP)) {
        mtmp.weapon_check = NEED_HTH_WEAPON;
        mon_wield_item(mtmp);
    }
    return mtmp;
}

/* despite rather general name, used exclusively for hero's starting pet */
export function makedog() { /* struct monst * */
    let mtmp;
    let petname;
    let pettype;

    if (gp.preferred_pet == ord('n')) {
        /* static init yields 0 (PM_GIANT_ANT); fix that up now */
        svc.context.startingpet_typ = NON_PM;
        return null;
    }

    pettype = svc.context.startingpet_typ = pet_type();
    petname = (pettype == PM_LITTLE_DOG) ? gd.dogname
              : (pettype == PM_KITTEN) ? gc.catname
                : (pettype == PM_PONY) ? gh.horsename
                  : _("");

    /* default pet names */
    if (!chars[petname] && pettype == PM_LITTLE_DOG) {
        /* All of these names were for dogs. */
        if (Role_if(PM_CAVE_DWELLER))
            petname = _("Slasher"); /* The Warrior */
        if (Role_if(PM_SAMURAI))
            petname = _("Hachi"); /* Shibuya Station */
        if (Role_if(PM_BARBARIAN))
            petname = _("Idefix"); /* Obelix */
        if (Role_if(PM_RANGER))
            petname = _("Sirius"); /* Orion's dog */
    }

    /* specifying NO_MINVENT prevents makemon() from having a 1% chance
       of creating a pony with an already worn saddle; dogs and cats
       aren't affected because they don't have any initial inventory
       [if anybody adds stranger pets that are expected to have such,
       they'll need to modify this] */
    mtmp = makemon(mons[pettype], u.ux, u.uy, MM_EDOG | NO_MINVENT);

    if (!mtmp)
        return null; /* pets were genocided [how?] */

    if (!svc.context.startingpet_mid) {
        svc.context.startingpet_mid = mtmp.m_id;
        if (!u.uroleplay.pauper) {
            /* initial horses start wearing a saddle (pauper hero excluded) */
            if (pettype == PM_PONY) {
                /* NULL obj arg means put_saddle_on_mon()
                 * will carry out the saddle creation */
                put_saddle_on_mon(null, mtmp);
            }
        }
        /* starting pet's type has been seen up close (unless PermaBlind)
           and for tourist treat it as having already been photographed */
        gb.bhitpos.x = mtmp.mx, gb.bhitpos.y = mtmp.my;
        gn.notonhead = FALSE;
        see_monster_closeup(mtmp, carrying(EXPENSIVE_CAMERA) ? TRUE : FALSE);
    } else {
        impossible(_("makedog() when startingpet_mid is already non-zero?"));
    }

    if (!gp.petname_used++ && chars[petname])
        mtmp = christen_monst(mtmp, petname);

    initedog(mtmp, TRUE);
    return  mtmp;
}

function set_mon_lastmove(mtmp) { /* void */
    mtmp.mlstmv = svm.moves;
}

/* record `last move time' for all monsters prior to level save so that
   mon_arrive() can catch up for lost time when they're restored later */
export function update_mlstmv() { /* void */
    iter_mons(set_mon_lastmove);
}

/* note: always reset when used so doesn't need to be part of struct 'g' */
const failed_arrivals = static_var("failed_arrivals", ptr_to(struct_monst), null);

export function losedogs() { /* void */
    let mtmp, mprev;
    let dismissKops = 0, xyloc;

    failed_arrivals[0] = null;
    /*
     * First, scan gm.migrating_mons for shopkeepers who want to dismiss Kops,
     * and scan gm.mydogs for shopkeepers who want to retain kops.
     * Second, dismiss kops if warranted, making more room for arrival.
     * Third, replace monsters who went onto migrating_mons in order to
     * be accessible from other levels but didn't actually leave the level.
     * Fourth, place monsters accompanying the hero.
     * Last, place migrating monsters coming to this level.
     *
     * Hero might eventually be displaced (due to the third step, but
     * occurring later), which is the main reason to do the second step
     * sooner (in turn necessitating the first step, rather than combining
     * the list scans with monster placement).
     */

    /* check for returning shk(s) */
    for (mtmp = gm.migrating_mons; mtmp; mtmp = mtmp.nmon) {
        if (mtmp.mux != u.uz.dnum || mtmp.muy != u.uz.dlevel)
            continue;
        if (mtmp.isshk) {
            if (ESHK(mtmp).dismiss_kops) {
                if (dismissKops == 0)
                    dismissKops = 1;
                ESHK(mtmp).dismiss_kops = FALSE; /* reset */
            } else if (!mtmp.mpeaceful) {
                /* an unpacified shk is returning; don't dismiss kops
                   even if another pacified one is willing to do so */
                dismissKops = -1;
                /* [keep looping; later monsters might need ESHK reset] */
            }
        }
    }
    /* make the same check for gm.mydogs */
    for (mtmp = gm.mydogs; mtmp && dismissKops >= 0; mtmp = mtmp.nmon) {
        if (mtmp.isshk) {
            /* hostile shk might accompany hero [ESHK(mtmp)->dismiss_kops
               can't be set here; it's only used for gm.migrating_mons] */
            if (!mtmp.mpeaceful)
                dismissKops = -1;
        }
    }

    /* when a hostile shopkeeper chases hero to another level
       and then gets paid off there, get rid of summoned kops
       here now that he has returned to his shop level */
    if (dismissKops > 0)
        make_happy_shoppers(TRUE);

    /* put monsters who went onto migrating_mons in order to be accessible
       when other levels are active back to their positions on this level;
       they're handled before mydogs so that monsters accompanying the
       hero can't steal the spot that belongs to them; these migraters
       should always be able to arrive because they were present on the
       level at the time the hero left [if they can't arrive for some
       reason, mon_arrive() will put them on the 'failed_arrivals' list] */
    for (mprev = ref_of(gm, "migrating_mons"); (mtmp = mprev[0]) != null; ) {
        xyloc = mtmp.mtrack[0].x; /* (for legibility) */
        if (mtmp.mux == u.uz.dnum && mtmp.muy == u.uz.dlevel
            && xyloc == MIGR_EXACT_XY) {
            /* remove mtmp from migrating_mons */
            mprev[0] = mtmp.nmon;
            mon_arrive(mtmp, Before_you);
        } else {
            mprev = ref_of(mtmp, "nmon");
        }
    }

    /* place pets and/or any other monsters who accompany hero;
       any that fail to arrive (level may be full) will be moved
       first to failed_arrivals, then to migrating_mons scheduled
       to arrive back on this level if hero leaves and returns */
    while ((mtmp = gm.mydogs) != null) {
        gm.mydogs = mtmp.nmon;
        mon_arrive(mtmp, With_you);
    }

    /* time for migrating monsters to arrive; monsters who belong on
       this level but fail to arrive get put on the failed_arrivals list
       temporarily [by mon_arrive()], then back onto the migrating_mons
       list below */
    for (mprev = ref_of(gm, "migrating_mons"); (mtmp = mprev[0]) != null; ) {
        xyloc = mtmp.mtrack[0].x;
        if (mtmp.mux == u.uz.dnum && mtmp.muy == u.uz.dlevel
            && xyloc != MIGR_EXACT_XY) {
            /* remove mtmp from migrating_mons */
            mprev[0] = mtmp.nmon;
            /* note: if there's no room, it ends up on failed_arrivals list */
            mon_arrive(mtmp, After_you);
        } else {
            mprev = ref_of(mtmp, "nmon");
        }
    }

    /* put any monsters who couldn't arrive back on migrating_mons,
       clearing out the temporary 'failed_arrivals' list in the process */
    while ((mtmp = failed_arrivals[0]) != null) {
        failed_arrivals[0] = mtmp.nmon;
        /* mon_arrive() put mtmp onto fmon, but if there wasn't room to
           arrive, relmon() was used to take it off again; put it back now
           because m_into_limbo() expects it to be there */
        mtmp.nmon = fmon();
        svl.level.monlist = mtmp;
        /* set this monster to migrate back to this level if hero leaves
           and then returns */
        m_into_limbo(mtmp);
    }
}

/* called from resurrect() in addition to losedogs() */
export function mon_arrive(mtmp, when) { /* void */
    const $frame = stack_frame(); try {
    let t;
    let xlocale, ylocale, xyloc, xyflags;
    let wander;
    let num_segs;
    let failed_to_place = FALSE;
    let stway;
    let fromdlev = stack_struct(struct_d_level);

    mtmp.mstate = or64(mtmp.mstate, MON_STILL_ARRIVING);
    mtmp.nmon = fmon();
    svl.level.monlist = mtmp;
    if (mtmp.isshk)
        set_residency(mtmp, FALSE);

    num_segs = mtmp.wormno;
    /* baby long worms have no tail so don't use is_longworm() */
    if (mtmp.data == mons[PM_LONG_WORM]) {
        mtmp.wormno = unsigned(get_wormno());
        if (mtmp.wormno)
            initworm(mtmp, num_segs);
    } else
        mtmp.wormno = 0;

    /* some monsters might need to do something special upon arrival
       _after_ the current level has been fully set up; see dochug() */
    mtmp.mstrategy = or64u(mtmp.mstrategy, STRAT_ARRIVE);
    mtmp.mstate = and64(mtmp.mstate, ~(MON_MIGRATING | MON_LIMBO));

    /* make sure mnexto(rloc_to(set_apparxy())) doesn't use stale data */
    mtmp.mux = u.ux, mtmp.muy = u.uy;
    xyloc = mtmp.mtrack[0].x;
    xyflags = mtmp.mtrack[0].y;
    xlocale = mtmp.mtrack[1].x;
    ylocale = mtmp.mtrack[1].y;
    fromdlev.dnum = mtmp.mtrack[2].x;
    fromdlev.dlevel = mtmp.mtrack[2].y;
    mon_track_clear(mtmp);
    /* in case Protection_from_shape_changers is different now from when
       'mtmp' went onto the migrating monsters list; that's handled in
       getlev() when returning to a previously visited level and by the
       special level code for monsters specified in the level, but needed
       here for monsters migrating to a newly created level */
    restore_cham(mtmp);

    if (mtmp == u.usteed)
        return; /* don't place steed on the map */
    if (when == With_you) {
        /* When a monster accompanies you, sometimes it will arrive
           at your intended destination and you'll end up next to
           that spot.  This code doesn't control the final outcome;
           goto_level(do.c) decides who ends up at your target spot
           when there is a monster there too. */
        if (!MON_AT(u.ux, u.uy)
            && !rn2(mtmp.mtame ? 10 : mtmp.mpeaceful ? 5 : 2))
            rloc_to(mtmp, u.ux, u.uy);
        else
            mnexto(mtmp, RLOC_NOMSG);
        mtmp.mstate = and64(mtmp.mstate, ~MON_STILL_ARRIVING);
        return;
    } else if (when == Wiz_arrive) {
        /* resurrect() is bringing existing wizard to harass the hero */
        xyloc = MIGR_WITH_HERO;
    }
    /*
     * The monster arrived on this level independently of the player.
     * Its coordinate fields were overloaded for use as flags that
     * specify its final destination.
     */

    if (mtmp.mlstmv < svm.moves - 1) {
        /* heal monster for time spent in limbo */
        let nmv = svm.moves - 1 - mtmp.mlstmv;

        mon_catchup_elapsed_time(mtmp, nmv);

        /* let monster move a bit on new level (see placement code below) */
        wander = xint16(min(nmv, 8));
    } else
        wander = 0;

    switch (xyloc) {
    case MIGR_APPROX_XY: /* {x,y}locale set above */
        break;
    case MIGR_EXACT_XY:
        wander = 0;
        break;
    case MIGR_WITH_HERO:
        xlocale = u.ux, ylocale = u.uy;
        break;
    case MIGR_STAIRS_UP:
        if ((stway = stairway_find_from(fromdlev, FALSE)) != null) {
            xlocale = stway.sx;
            ylocale = stway.sy;
        }
        break;
    case MIGR_STAIRS_DOWN:
        if ((stway = stairway_find_from(fromdlev, FALSE)) != null) {
            xlocale = stway.sx;
            ylocale = stway.sy;
        }
        break;
    case MIGR_LADDER_UP:
        if ((stway = stairway_find_from(fromdlev, TRUE)) != null) {
            xlocale = stway.sx;
            ylocale = stway.sy;
        }
        break;
    case MIGR_LADDER_DOWN:
        if ((stway = stairway_find_from(fromdlev, TRUE)) != null) {
            xlocale = stway.sx;
            ylocale = stway.sy;
        }
        break;
    case MIGR_SSTAIRS:
        if ((stway = stairway_find(fromdlev)) != null) {
            xlocale = stway.sx;
            ylocale = stway.sy;
        }
        break;
    case MIGR_PORTAL:
        if (In_endgame(u.uz)) {
            /* there is no arrival portal for endgame levels */
            /* BUG[?]: for simplicity, this code relies on the fact
               that we know that the current endgame levels always
               build upwards and never have any exclusion subregion
               inside their TELEPORT_REGION settings. */
            xlocale = rn1(svu.updest.hx - svu.updest.lx + 1, svu.updest.lx);
            ylocale = rn1(svu.updest.hy - svu.updest.ly + 1, svu.updest.ly);
            break;
        }
        /* find the arrival portal */
        for (t = gf.ftrap; t; t = t.ntrap)
            if (t.ttyp == MAGIC_PORTAL)
                break;
        if (t) {
            xlocale = t.tx, ylocale = t.ty;
            break;
        } else if (iflags.debug_fuzzer
                   && (stway = stairway_find_dir(+!builds_up(u.uz))) != null) {
            /* debugfuzzer returns from or enters another branch */
            xlocale = stway.sx, ylocale = stway.sy;
            break;
        } else if (!(u.uevent.qexpelled
                     && (Is_qstart(u.uz0) || Is_qstart(u.uz)))) {
            impossible(_("mon_arrive: no corresponding portal?"));
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
    case MIGR_RANDOM:
        xlocale = ylocale = 0;
        break;
    }

    if ((mtmp.migflags & MIGR_LEFTOVERS) != 0) {
        /* Pick up the rest of the MIGR_TO_SPECIES objects */
        if (gm.migrating_objs)
            deliver_obj_to_mon(mtmp, 0, DF_ALL);
    }

    if (xlocale && wander) {
        /* monster moved a bit; pick a nearby location */
        /* mnearto() deals w/stone, et al */
        let r = in_rooms(xlocale, ylocale, 0);

        if (r && chars[r]) {
            let c = stack_struct(struct_nhcoord);

            /* somexy() handles irregular rooms */
            if (somexy(elt(svr.rooms, chars[r] - ROOMOFFSET), c))
                xlocale = c.x, ylocale = c.y;
            else
                xlocale = ylocale = 0;
        } else { /* not in a room */
            let i, j;

            i = max(1, xlocale - wander);
            j = min(COLNO - 1, xlocale + wander);
            xlocale = rn1(j - i, i);
            i = max(0, ylocale - wander);
            j = min(ROWNO - 1, ylocale + wander);
            ylocale = rn1(j - i, i);
        }
    } /* moved a bit */

    mtmp.mx = 0; /*(already is 0)*/
    mtmp.my = xyflags;

    if (xlocale)
        failed_to_place = +!mnearto(mtmp, xlocale, ylocale, FALSE, RLOC_NOMSG);
    else
        failed_to_place = +!rloc(mtmp, RLOC_NOMSG);

    if (failed_to_place) {
        if (when != Wiz_arrive)
            /* losedogs() will deal with this */
            relmon(mtmp, failed_arrivals);
        else /* when==Wiz_arrive => not being called by losedogs() */
            m_into_limbo(mtmp);
    }
    mtmp.mstate = and64(mtmp.mstate, ~MON_STILL_ARRIVING);
    } finally { stack_pop($frame); }
}

/* heal monster for time spent elsewhere */
export function mon_catchup_elapsed_time(
    mtmp,
    nmv) { /* void */ /* number of moves */
    let imv = 0; /* avoid zillions of casts and lint warnings */

    if (nmv < 0) { /* crash likely... */
        panic(_("catchup from future time?"));
        /*NOTREACHED*/
        return;
    } else if (nmv == 0) { /* safe, but shouldn't happen */
        impossible(_("catchup from now?"));
    } else

        if (nmv >= LARGEST_INT) /* paranoia */
        imv = LARGEST_INT - 1;
    else
        imv = int(nmv);

    /* might stop being afraid, blind or frozen */
    /* set to 1 and allow final decrement in movemon() */
    if (mtmp.mblinded) {
        if (imv >= mtmp.mblinded)
            mtmp.mblinded = 1;
        else
            mtmp.mblinded -= imv;
    }
    if (mtmp.mfrozen) {
        if (imv >= mtmp.mfrozen)
            mtmp.mfrozen = 1;
        else
            mtmp.mfrozen -= imv;
    }
    if (mtmp.mfleetim) {
        if (imv >= mtmp.mfleetim)
            mtmp.mfleetim = 1;
        else
            mtmp.mfleetim -= imv;
    }

    /* might recover from temporary trouble */
    if (mtmp.mtrapped && rn2(imv + 1) > Math.trunc(40 / 2))
        mtmp.mtrapped = 0;
    if (mtmp.mconf && rn2(imv + 1) > Math.trunc(50 / 2))
        mtmp.mconf = 0;
    if (mtmp.mstun && rn2(imv + 1) > Math.trunc(10 / 2))
        mtmp.mstun = 0;

    /* might finish eating or be able to use special ability again */
    if (mtmp.meating) {
        if (imv > mtmp.meating)
            finish_meating(mtmp);
        else
            mtmp.meating -= imv;
    }
    if (imv > mtmp.mspec_used)
        mtmp.mspec_used = 0;
    else
        mtmp.mspec_used -= imv;

    /* reduce tameness for every 150 moves you are separated */
    if (mtmp.mtame) {
        let wilder = Math.trunc((imv + 75) / 150);
        if (mtmp.mtame > wilder)
            mtmp.mtame -= wilder; /* less tame */
        else if (mtmp.mtame > rn2(wilder))
            mtmp.mtame = 0; /* untame */
        else
            mtmp.mtame = mtmp.mpeaceful = 0; /* hostile! */
    }
    /* check to see if it would have died as a pet; if so, go wild instead
     * of dying the next time we call dog_move()
     */
    if (mtmp.mtame && !mtmp.isminion
        && (carnivorous(mtmp.data) || herbivorous(mtmp.data))) {
        let edog = EDOG(mtmp);

        if ((svm.moves > edog.hungrytime + 500 && mtmp.mhp < 3)
            || (svm.moves > edog.hungrytime + 750))
            mtmp.mtame = mtmp.mpeaceful = 0;
    }

    if (!mtmp.mtame && mtmp.mleashed) {
        /* leashed monsters should always be with hero, consequently
           never losing any time to be accounted for later */
        impossible(_("catching up for leashed monster?"));
        m_unleash(mtmp, FALSE);
    }

    /* recover lost hit points */
    if (!regenerates(mtmp.data))
        imv = Math.trunc(imv / 20);
    healmon(mtmp, imv, 0);

    set_mon_lastmove(mtmp);
}

/* bookkeeping when mtmp is about to leave the current level;
   common to keepdogs() and migrate_to_level() */
function mon_leave(mtmp) { /* int */
    let obj;
    let num_segs = 0; /* return value */

    /* set minvent's obj->no_charge to 0 */
    for (obj = mtmp.minvent; obj; obj = obj.nobj) {
        if (Has_contents(obj))
            picked_container(obj); /* does the right thing */
        obj.no_charge = 0;
    }

    /* if this is a shopkeeper, clear the 'resident' field of her shop;
       if/when she returns, it will be set back by mon_arrive()  */
    if (mtmp.isshk)
        set_residency(mtmp, TRUE);

    /* if this is a long worm, handle its tail segments before mtmp itself;
       we pass possibly truncated segment count to caller via return value  */
    if (mtmp.wormno) {
        let cnt = count_wsegs(mtmp), mx = mtmp.mx, my = mtmp.my;

        /* since monst->wormno is overloaded to hold the number of
           tail segments during migration, a very long worm with
           more segments than can fit in that field gets truncated */
        num_segs = min(cnt, MAX_NUM_WORMS - 1);
        wormgone(mtmp);
        /* put the head back; note: mtmp might not be on the map if this
           is happening during a failed attempt to migrate to this level */
        if (mx)
            place_monster(mtmp, mx, my);
    }

    return num_segs;
}

/* when hero leaves a level, some monsters should be placed on the
   migrating_mons list instead of being stashed inside the level's file */
function keep_mon_accessible(mon) { /* boolean */
    /* the Wizard is kept accessible so that his harassment can fetch
       him instead of creating a new instance but also so that he can
       be put back at his current location if hero returns to his level */
    if (mon.iswiz)
        return TRUE;
    /* monsters with special attachment to a particular level only need
       to be kept accessible when on some other level */
    if (mon.mextra
        && ((mon.isshk && !on_level(u.uz, ESHK(mon).shoplevel))
            || (mon.ispriest && !on_level(u.uz, EPRI(mon).shrlevel))
            || (mon.isgd && !on_level(u.uz, EGD(mon).gdlevel))))
        return TRUE;
    /* normal monsters go into the level save file instead of being held
       on the migrating_mons list for off-level accessibility */
    return FALSE;
}

/* called when you move to another level */
export function keepdogs(
    pets_only) { /* void */ /* true for ascension or final escape */
    let mtmp, mtmp2;

    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp))
            continue;
        if (pets_only) {
            if (!mtmp.mtame)
                continue; /* reject non-pets */
            /* don't block pets from accompanying hero's dungeon
               escape or ascension simply due to mundane trifles;
               unlike level change for steed, don't bother trying
               to achieve a normal trap escape first */
            mtmp.mtrapped = 0;
            finish_meating(mtmp);
            mtmp.msleeping = 0;
            mtmp.mfrozen = 0;
            mtmp.mcanmove = 1;
        }
        if (((monnear(mtmp, u.ux, u.uy) && levl_follower(mtmp))
             /* the wiz will level t-port from anywhere to chase
                the amulet; if you don't have it, will chase you
                only if in range. -3. */
             || (u.uhave.amulet && mtmp.iswiz))
            && (!helpless(mtmp)
                /* eg if level teleport or new trap, steed has no control
                   to avoid following */
                || (mtmp == u.usteed))
            /* monster won't follow if it hasn't noticed you yet */
            && !(mtmp.mstrategy & STRAT_WAITFORU)) {
            let num_segs;
            let stay_behind = FALSE;

            if (mtmp.mtrapped)
                mintrap(mtmp, NO_TRAP_FLAGS); /* try to escape */
            if (mtmp == u.usteed) {
                /* make sure steed is eligible to accompany hero */
                mtmp.mtrapped = 0;       /* escape trap */
                mtmp.meating = 0;        /* terminate eating */
                mdrop_special_objs(mtmp); /* drop Amulet */
            } else if (mtmp.meating || mtmp.mtrapped) {
                if (canseemon(mtmp))
                    pline_mon(mtmp, _("%s is still %s."), Monnam(mtmp),
                             mtmp.meating ? _("eating") : _("trapped"));
                stay_behind = TRUE;
            } else if (mon_has_amulet(mtmp)) {
                if (canseemon(mtmp))
                    pline(_("%s seems very disoriented for a moment."),
                          Monnam(mtmp));
                stay_behind = TRUE;
            }
            if (stay_behind) {
                if (mtmp.mleashed) {
                    pline(_("%s leash suddenly comes loose."),
                          humanoid(mtmp.data)
                              ? (mtmp.female ? _("Her") : _("His"))
                              : _("Its"));
                    m_unleash(mtmp, FALSE);
                }
                if (mtmp == u.usteed) {
                    /* can't happen unless someone makes a change
                       which scrambles the stay_behind logic above */
                    impossible(_("steed left behind?"));
                    dismount_steed(DISMOUNT_GENERIC);
                }
                continue;
            }

            /* prepare to take mtmp off the map */
            num_segs = mon_leave(mtmp);
            /* take off map and move mtmp from fmon list to mydogs */
            relmon(mtmp, ref_of(gm, "mydogs")); /* mtmp->mx,my retain current value */
            mtmp.mx = mtmp.my = 0; /* mx==0 implies migrating */
            mtmp.wormno = unsigned(num_segs);
            mtmp.mlstmv = svm.moves;
        } else if (keep_mon_accessible(mtmp)) {
            /* we want to be able to find the Wizard when his next
               resurrection chance comes up, but have him resume his
               present location if player returns to this level before
               that time; also needed for monsters (shopkeeper, temple
               priest, vault guard) who have level data in mon->mextra
               in case #wizmakemap is used to replace their home level
               while they're away from it */
            migrate_to_level(mtmp, ledger_no(u.uz), MIGR_EXACT_XY,
                             null);
        } else if (mtmp.mleashed) {
            /* this can happen if your quest leader ejects you from the
               "home" level while a leashed pet isn't next to you */
            pline(_("%s leash goes slack."), s_suffix(Monnam(mtmp)));
            m_unleash(mtmp, FALSE);
        }
    }
}

export function migrate_to_level(
    mtmp,
    tolev,
    xyloc,
    cc) { /* void */ /* optional destination coordinates */
    const $frame = stack_frame(); try {
    let new_lev = stack_struct(struct_d_level);
    let xyflags;
    let mx = mtmp.mx, my = mtmp.my; /* <mx,my> needed below */
    let num_segs; /* count of worm segments */

    if (mtmp.mleashed) {
        mtmp.mtame--;
        m_unleash(mtmp, TRUE);
    }

    /* prepare to take mtmp off the map */
    num_segs = mon_leave(mtmp);
    /* take off map and move mtmp from fmon list to migrating_mons */
    relmon(mtmp, ref_of(gm, "migrating_mons")); /* mtmp->mx,my retain their value */
    mtmp.mstate = or64(mtmp.mstate, MON_MIGRATING);

    new_lev.dnum = ledger_to_dnum(tolev);
    new_lev.dlevel = ledger_to_dlev(tolev);
    /* overload mtmp->[mx,my], mtmp->[mux,muy], and mtmp->mtrack[] as
       destination codes */
    xyflags = +(depth(new_lev) < depth(u.uz)); /* 1 => up */
    if (In_W_tower(mx, my, u.uz))
        xyflags |= 2;
    mtmp.wormno = unsigned(num_segs);
    mtmp.mlstmv = svm.moves;
    mtmp.mtrack[2].x = u.uz.dnum; /* migrating from this dungeon */
    mtmp.mtrack[2].y = u.uz.dlevel; /* migrating from this dungeon level */
    mtmp.mtrack[1].x = cc ? cc.x : mx;
    mtmp.mtrack[1].y = cc ? cc.y : my;
    mtmp.mtrack[0].x = xyloc;
    mtmp.mtrack[0].y = xyflags;
    mtmp.mux = new_lev.dnum;
    mtmp.muy = new_lev.dlevel;
    mtmp.mx = mtmp.my = 0; /* mx==0 implies migrating */

    /* don't extinguish a mobile light; it still exists but has changed
       from local (monst->mx > 0) to global (mx==0, not on this level) */
    if (emits_light(mtmp.data))
        vision_recalc(0);
    } finally { stack_pop($frame); }
}

/* when entering the endgame, levels from the dungeon and its branches are
   discarded because they can't be reached again; do the same for monsters
   and objects scheduled to migrate to those levels */
export function discard_migrations() { /* void */
    const $frame = stack_frame(); try {
    let mtmp, mprev;
    let otmp, oprev;
    let dest = stack_struct(struct_d_level);

    for (mprev = ref_of(gm, "migrating_mons"); (mtmp = mprev[0]) != null; ) {
        dest.dnum = mtmp.mux;
        dest.dlevel = mtmp.muy;
        /* the Wizard is kept regardless of location so that he is
           ready to be brought back; nothing should be scheduled to
           migrate to the endgame but if we find such, we'll keep it */
        if (mtmp.iswiz || In_endgame(dest)) {
            mprev = ref_of(mtmp, "nmon"); /* keep mtmp on migrating_mons */
        } else {
            mprev[0] = mtmp.nmon; /* remove mtmp from migrating_mons */
            mtmp.nmon = null;
            discard_minvent(mtmp, FALSE);
            /* bypass mongone() and its call to m_detach() plus dmonsfree() */
            if (emits_light(mtmp.data))
                del_light_source(LS_MONSTER, monst_to_any(mtmp));
            dealloc_monst(mtmp);
        }
    }

    /* objects get similar treatment */
    for (oprev = ref_of(gm, "migrating_objs"); (otmp = oprev[0]) != null; ) {
        dest.dnum = otmp.ox;
        dest.dlevel = otmp.oy;
        /* there is no special case like the Wizard (certainly not the
           Amulet; the hero has to be carrying it to enter the endgame
           which triggers the call to this routine); again we don't
           expect any objects to be migrating to the endgame but will
           keep any we find so that they could be delivered */
        if (In_endgame(dest)) {
            oprev = ref_of(otmp, "nobj"); /* keep otmp on migrating_objs */
        } else {
            /* bypass obj_extract_self() */
            oprev[0] = otmp.nobj; /* remove otmp from migrating_objs */
            otmp.nobj = null;
            otmp.where = OBJ_FREE;
            otmp.owornmask = 0; /* overloaded for destination usage;
                                   * obfree() will complain if nonzero */
            /*
             * obfree(otmp,)
             *  -> dealloc_obj(otmp)
             *      -> obj_stop_timers(otmp)
             *      -> del_light_source(LS_OBJECT, obj_to_any(otmp))
             */
            obfree(otmp, null); /* releases any contents too */
        }
    }
    } finally { stack_pop($frame); }
}

/* returns the quality of an item of food; the lower the better;
   fungi and ghouls will eat even tainted food */
export function dogfood(mon, obj) { /* int */
    let mptr = mon.data, fptr;
    let carni = carnivorous(mptr), herbi = herbivorous(mptr),
            starving, mblind;
    let fx;

    if (obj.otrapped && !resists_poison(mon))
        return POISON;
    if (is_quest_artifact(obj) || obj_resists(obj, 0, 95))
        return obj.cursed ? TABU : APPORT;

    switch (obj.oclass) {
    case FOOD_CLASS:
        fx = (obj.otyp == CORPSE || obj.otyp == TIN || obj.otyp == EGG)
                /* corpsenm might be NON_PM (special tin, unhatchable egg) */
                ? obj.corpsenm
                : NON_PM;
        /* mons[NUMMONS] is a valid array entry, though not a valid monster;
         * predicate tests against it will fail */
        fptr = mons[ismnum(fx) ? fx : NUMMONS];

        if (obj.otyp == CORPSE && is_rider(fptr))
            return TABU;
        if ((obj.otyp == CORPSE || obj.otyp == EGG)
            && flesh_petrifies(fptr) /* c*ckatrice or Medusa */
            && !resists_ston(mon))
            return POISON;
        if (obj.otyp == LUMP_OF_ROYAL_JELLY
            && mon.data == mons[PM_KILLER_BEE]) {
            let mtmp = find_pmmonst(PM_QUEEN_BEE);

            /* if there's a queen bee on the level, don't eat royal jelly;
               if there isn't, do eat it and grow into a queen */
            return !mtmp ? DOGFOOD : TABU;
        }
        if (!carni && !herbi)
            return obj.cursed ? UNDEF : APPORT;

        /* a starving pet will eat almost anything */
        starving = (mon.mtame && !mon.isminion
                    && EDOG(mon).mhpmax_penalty ? 1 : 0);
        /* even carnivores will eat carrots if they're temporarily blind */
        mblind = +(!mon.mcansee && haseyes(mon.data));

        /* ghouls prefer old corpses and unhatchable eggs, yum!
           they'll eat fresh non-veggy corpses and hatchable eggs
           when starving; they never eat stone-to-flesh'd meat */
        if (mptr == mons[PM_GHOUL]) {
            if (obj.otyp == CORPSE)
                return (peek_at_iced_corpse_age(obj) + 50 <= svm.moves
                        && !(fx == PM_LIZARD || fx == PM_LICHEN)) ? DOGFOOD
                       : (starving && !vegan(fptr)) ? ACCFOOD
                         : POISON;
            if (obj.otyp == EGG)
                return stale_egg(obj) ? CADAVER : starving ? ACCFOOD : POISON;
            return TABU;
        }

        switch (obj.otyp) {
        case TRIPE_RATION:
        case MEATBALL:
        case MEAT_RING:
        case MEAT_STICK:
        case ENORMOUS_MEATBALL:
            return carni ? DOGFOOD : MANFOOD;
        case EGG:
            if (obj.corpsenm == PM_PYROLISK && !likes_fire(mptr))
                return POISON;
            return carni ? CADAVER : MANFOOD;
        case CORPSE:
            if ((peek_at_iced_corpse_age(obj) + 50 <= svm.moves
                 && !(fx == PM_LIZARD || fx == PM_LICHEN)
                 && mptr.mlet != S_FUNGUS)
                || (acidic(fptr) && !resists_acid(mon))
                || (poisonous(fptr) && !resists_poison(mon)))
                return POISON;
            /* avoid polymorph unless starving or abused (in which case the
               pet will consider it for a chance to become more powerful) */
            else if (polyfood(obj) && mon.mtame > 1 && !starving)
                return MANFOOD;
            else if (vegan(fptr))
                return herbi ? CADAVER : MANFOOD;
            /* most humanoids will avoid cannibalism unless starving;
               arbitrary: elves won't eat other elves even then */
            else if (humanoid(mptr) && same_race(mptr, fptr)
                     && (!is_undead(mptr) && fptr.mlet != S_KOBOLD
                         && fptr.mlet != S_ORC && fptr.mlet != S_OGRE))
                return (starving && carni && !is_elf(mptr)) ? ACCFOOD : TABU;
            else
                return carni ? CADAVER : MANFOOD;
        case GLOB_OF_GREEN_SLIME: /* other globs use the default case */
            /* turning into slime is preferable to starvation */
            return (starving || slimeproof(mon.data)) ? ACCFOOD : POISON;
        case CLOVE_OF_GARLIC:
            return (is_undead(mptr) || is_vampshifter(mon)) ? TABU
                   : (herbi || starving) ? ACCFOOD
                     : MANFOOD;
        case TIN:
            return metallivorous(mptr) ? ACCFOOD : MANFOOD;
        case APPLE:
            return herbi ? DOGFOOD : starving ? ACCFOOD : MANFOOD;
        case CARROT:
            return (herbi || mblind) ? DOGFOOD : starving ? ACCFOOD : MANFOOD;
        case BANANA:
            /* monkeys and apes (tamable) plus sasquatch prefer these,
               yetis will only will only eat them if starving */
            return (mptr.mlet == S_YETI && herbi) ? DOGFOOD
                   : (herbi || starving) ? ACCFOOD
                     : MANFOOD;
        default:
            if (starving)
                return ACCFOOD;
            return (obj.otyp > SLIME_MOLD) ? (carni ? ACCFOOD : MANFOOD)
                                            : (herbi ? ACCFOOD : MANFOOD);
        }
    default:
        if (obj.otyp == AMULET_OF_STRANGULATION
            || obj.otyp == RIN_SLOW_DIGESTION)
            return TABU;
        if (mon_hates_silver(mon) && objects[obj.otyp].oc_material == SILVER)
            return TABU;
        if (mptr == mons[PM_GELATINOUS_CUBE] && is_organic(obj))
            return ACCFOOD;
        if (metallivorous(mptr) && is_metallic(obj)
            && (is_rustprone(obj) || mptr != mons[PM_RUST_MONSTER])) {
            /* Non-rustproofed ferrous-based metals are preferred. */
            return (is_rustprone(obj) && !obj.oerodeproof) ? DOGFOOD
                                                            : ACCFOOD;
        }
        if (!obj.cursed
            && obj.oclass != BALL_CLASS
            && obj.oclass != CHAIN_CLASS)
            return APPORT;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case ROCK_CLASS:
        return UNDEF;
    }
}

/*
 * tamedog() used to return the monster, which might have changed address
 * if a new one was created in order to allocate the edog extension.
 * With the separate mextra structure added in 3.6.x it always operates
 * on the original mtmp.  It now returns TRUE if the taming succeeded.
 */
export function tamedog(
    mtmp,
    obj,
    givemsg) { /* boolean */
    let blessed_scroll = FALSE;

    if (obj && (obj.oclass == SCROLL_CLASS || obj.oclass == SPBOOK_CLASS)) {
        blessed_scroll = obj.blessed ? TRUE : FALSE;
        /* the rest of this routine assumes 'obj' represents food */
        obj = null;
    }
    /* reduce timed sleep or paralysis, leaving mtmp->mcanmove as-is
       (note: if mtmp is donning armor, this will reduce its busy time) */
    if (mtmp.mfrozen)
        mtmp.mfrozen = Math.trunc((mtmp.mfrozen + 1) / 2);
    /* end indefinite sleep; using distance==1 limits the waking to mtmp */
    if (mtmp.msleeping)
        wake_nearto(mtmp.mx, mtmp.my, 1); /* [different from wakeup()] */

    /* The Wiz, Medusa and the quest nemeses aren't even made peaceful. */
    if (mtmp.iswiz || mtmp.data == mons[PM_MEDUSA]
        || (mtmp.data.mflags3 & M3_WANTSARTI))
        return FALSE;

    /* worst case, at least it'll be peaceful. */
    if (givemsg && !mtmp.mpeaceful && canspotmon(mtmp)) {
        pline_mon(mtmp, _("%s seems %s."), Monnam(mtmp),
              Hallucination() ? _("really chill") : _("more amiable"));
        givemsg = FALSE; /* don't give another message below */
    }
    mtmp.mpeaceful = 1;
    set_malign(mtmp);
    if (flags.moonphase == FULL_MOON && night() && rn2(6) && obj
        && mtmp.data.mlet == S_DOG)
        return FALSE;

    /* If we cannot tame it, at least it's no longer afraid. */
    mtmp.mflee = 0;
    mtmp.mfleetim = 0;

    /* make grabber let go now, whether it becomes tame or not */
    if (mtmp == u.ustuck) {
        if (u.uswallow)
            expels(mtmp, mtmp.data, TRUE);
        else if (!(Upolyd() && sticks(gy.youmonst.data)))
            unstuck(mtmp);
    }

    /* feeding it treats makes it tamer */
    if (mtmp.mtame && obj) {
        let tasty;

        if (mtmp.mcanmove && !mtmp.mconf && !mtmp.meating
            && ((tasty = dogfood(mtmp, obj)) == DOGFOOD
                || (tasty <= ACCFOOD
                    && EDOG(mtmp).hungrytime <= svm.moves))) {
            /* pet will "catch" and eat this thrown food */
            if (canseemon(mtmp)) {
                let big_corpse = +(obj.otyp == CORPSE && ismnum(obj.corpsenm)
                     && mons[obj.corpsenm].msize > mtmp.data.msize);

                pline_mon(mtmp, _("%s catches %s%s"),
                          Monnam(mtmp), the(xname(obj)),
                         !big_corpse ? _(".") : _(", or vice versa!"));
            } else if (cansee(mtmp.mx, mtmp.my))
                pline(_("%s."), Tobjnam(obj, _("stop")));
            /* dog_eat expects a floor object */
            place_object(obj, mtmp.mx, mtmp.my);
            dog_eat(mtmp, obj, mtmp.mx, mtmp.my, FALSE);
            /* eating might have killed it, but that doesn't matter here;
               a non-null result suppresses "miss" message for thrown
               food and also implies that the object has been deleted */
            return TRUE;
        } else
            return FALSE;
    }

    /* maximum tameness is 20, only reachable via eating; if already tame but
       less than 10, taming magic might make it become tamer; blessed scroll
       or skilled spell raises low tameness by 2 or 3, uncursed by 0 or 1 */
    if (mtmp.mtame && mtmp.mtame < 10) {
        if (mtmp.mtame < rnd(10))
            mtmp.mtame++;
        if (blessed_scroll) {
            mtmp.mtame += 2;
            if (mtmp.mtame > 10)
                mtmp.mtame = 10;
        }
        return FALSE; /* didn't just get tamed */
    }
    /* pacify angry shopkeeper but don't tame him/her/it/them */
    if (mtmp.isshk) {
        make_happy_shk(mtmp, FALSE);
        return FALSE;
    }

    if (!mtmp.mcanmove
        /* monsters with conflicting structures cannot be tamed
           [note: the various mextra structures don't actually conflict
           with each other anymore] */
        || mtmp.isshk || mtmp.isgd || mtmp.ispriest || mtmp.isminion
        || is_covetous(mtmp.data) || is_human(mtmp.data)
        || (is_demon(mtmp.data) && !is_demon(gy.youmonst.data))
        || (obj && dogfood(mtmp, obj) >= MANFOOD))
        return FALSE;

    if (mtmp.m_id == svq.quest_status.leader_m_id)
        return FALSE;

    /* add the pet extension */
    if (!has_edog(mtmp)) {
        newedog(mtmp);
        initedog(mtmp, TRUE);
    } else {
        initedog(mtmp, FALSE);
    }

    if (obj) { /* thrown food */
        /* defer eating until the edog extension has been set up */
        place_object(obj, mtmp.mx, mtmp.my); /* put on floor */
        /* devour the food (might grow into larger, genocided monster) */
        if (dog_eat(mtmp, obj, mtmp.mx, mtmp.my, TRUE) == 2)
            return TRUE; /* oops, it died... */
        /* `obj' is now obsolete */
    }

    if (givemsg && canspotmon(mtmp))
        pline_mon(mtmp, _("%s seems quite %s."), Monnam(mtmp),
              Hallucination() ? _("approachable") : _("friendly"));

    newsym(mtmp.mx, mtmp.my);
    if (mtmp.wormno)
        redraw_worm(mtmp);
    if (attacktype(mtmp.data, AT_WEAP)) {
        mtmp.weapon_check = NEED_HTH_WEAPON;
        mon_wield_item(mtmp);
    }
    return TRUE;
}

/*
 * Called during pet revival or pet life-saving.
 * If you killed the pet, it revives wild.
 * If you abused the pet a lot while alive, it revives wild.
 * If you abused the pet at all while alive, it revives untame.
 * If the pet wasn't abused and was very tame, it might revive tame.
 */
export function wary_dog(mtmp, was_dead) { /* void */
    let edog;
    let quietly = was_dead;

    finish_meating(mtmp);

    if (!mtmp.mtame)
        return;
    edog = !mtmp.isminion ? EDOG(mtmp) : null;

    /* if monster was starving when it died, undo that now */
    if (edog && edog.mhpmax_penalty) {
        mtmp.mhpmax += edog.mhpmax_penalty;
        mtmp.mhp += edog.mhpmax_penalty; /* heal it */
        edog.mhpmax_penalty = 0;
    }

    if (edog && (edog.killed_by_u == 1 || edog.abuse > 2)) {
        mtmp.mpeaceful = mtmp.mtame = 0;
        if (edog.abuse >= 0 && edog.abuse < 10)
            if (!rn2(edog.abuse + 1))
                mtmp.mpeaceful = 1;
        if (!quietly && cansee(mtmp.mx, mtmp.my)) {
            if (haseyes(gy.youmonst.data)) {
                if (haseyes(mtmp.data))
                    pline_mon(mtmp,
                             _("%s %s to look you in the %s."), Monnam(mtmp),
                             mtmp.mpeaceful ? _("seems unable") : _("refuses"),
                             body_part(EYE));
                else
                    pline_mon(mtmp, _("%s avoids your gaze."), Monnam(mtmp));
            }
        }
    } else {
        /* chance it goes wild anyway - Pet Sematary */
        mtmp.mtame = rn2(mtmp.mtame + 1);
        if (!mtmp.mtame)
            mtmp.mpeaceful = unsigned(rn2(2));
    }

    if (!mtmp.mtame) {
        if (!quietly && canspotmon(mtmp))
            pline_mon(mtmp, _("%s %s."), Monnam(mtmp),
                  mtmp.mpeaceful ? _("is no longer tame") : _("has become feral"));
        newsym(mtmp.mx, mtmp.my);
        /* a life-saved monster might be leashed;
           don't leave it that way if it's no longer tame */
        if (mtmp.mleashed)
            m_unleash(mtmp, TRUE);
        if (mtmp == u.usteed)
            dismount_steed(DISMOUNT_THROWN);
    } else if (edog) {
        /* it's still a pet; start a clean pet-slate now */
        edog.revivals++;
        edog.killed_by_u = 0;
        edog.abuse = 0;
        edog.ogoal.x = edog.ogoal.y = -1;
        if (was_dead || edog.hungrytime < svm.moves + 500)
            edog.hungrytime = svm.moves + 500;
        if (was_dead) {
            edog.droptime = 0;
            edog.dropdist = 10000;
            edog.whistletime = 0;
            edog.apport = 5;
        } /* else lifesaved, so retain current values */
    }
}

export function abuse_dog(mtmp) { /* void */
    if (!mtmp.mtame)
        return;

    if (Aggravate_monster() || Conflict())
        mtmp.mtame = Math.trunc(mtmp.mtame / 2);
    else
        mtmp.mtame--;

    if (mtmp.mtame && !mtmp.isminion)
        EDOG(mtmp).abuse++;

    if (!mtmp.mtame && mtmp.mleashed)
        m_unleash(mtmp, TRUE);

    /* don't make a sound if pet is in the middle of leaving the level */
    /* newsym isn't necessary in this case either */
    if (mtmp.mx != 0) {
        if (mtmp.mtame && rn2(mtmp.mtame))
            yelp(mtmp);
        else
            growl(mtmp); /* give them a moment's worry */

        if (!mtmp.mtame) {
            newsym(mtmp.mx, mtmp.my);
            if (mtmp.wormno) {
                redraw_worm(mtmp);
            }
        }
    }
}

/*dog.c*/

import { A_CHA } from "./attrib.h.js";
import { ACURR } from "./attrib.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    BALL_CLASS, CHAIN_CLASS, FOOD_CLASS, ROCK_CLASS, SCROLL_CLASS, SPBOOK_CLASS, S_DOG, S_FUNGUS,
    S_KOBOLD, S_OGRE, S_ORC, S_YETI,
} from "./defsym.h.js";
import { canspotmon } from "./display.h.macros.js";
import {
    MIGR_APPROX_XY, MIGR_EXACT_XY, MIGR_LADDER_DOWN, MIGR_LADDER_UP, MIGR_LEFTOVERS, MIGR_PORTAL,
    MIGR_RANDOM, MIGR_SSTAIRS, MIGR_STAIRS_DOWN, MIGR_STAIRS_UP, MIGR_WITH_HERO, struct_d_level,
} from "./dungeon.h.js";
import { In_endgame, Is_qstart } from "./dungeon.h.macros.js";
import { FULL_MOON } from "./flag.h.js";
import {
    COLNO, FALSE, LARGEST_INT, LL_CONDUCT, MAXMONNO, ROWNO, TRUE, xint16,
} from "./global.h.js";
import {
    CORPSTAT_FEMALE, CORPSTAT_GENDER, CORPSTAT_MALE, DF_ALL, DISMOUNT_GENERIC, DISMOUNT_THROWN, EYE,
    MM_EDOG, MM_FEMALE, MM_IGNOREWATER, MM_MALE, MM_NOMSG, NO_MINVENT, NO_TRAP_FLAGS, RLOC_NOMSG,
} from "./hack.h.js";
import { max, min, rn1 } from "./hack.h.macros.js";
import {
    ACCFOOD, APPORT, CADAVER, DOGFOOD, MANFOOD, POISON, TABU, UNDEF, struct_edog,
} from "./mextra.h.js";
import { EDOG, EGD, EPRI, ESHK, has_edog } from "./mextra.h.macros.js";
import { ROOMOFFSET } from "./mkroom.h.js";
import { AT_WEAP } from "./monattk.h.js";
import {
    acidic, carnivorous, emits_light, flesh_petrifies, haseyes, herbivorous, humanoid, is_covetous,
    is_demon, is_domestic, is_elf, is_human, is_rider, is_undead, likes_fire, metallivorous,
    poisonous, regenerates, slimeproof, vegan,
} from "./mondata.h.macros.js";
import { G_EXTINCT, M3_WANTSARTI } from "./monflag.h.js";
import {
    MAX_NUM_WORMS, MON_LIMBO, MON_MIGRATING, MON_STILL_ARRIVING, NEED_HTH_WEAPON, STRAT_ARRIVE,
    STRAT_WAITFORU, struct_monst,
} from "./monst.h.js";
import {
    DEADMONSTER, helpless, is_vampshifter, ismnum, resists_acid, resists_poison, resists_ston,
} from "./monst.h.macros.js";
import {
    NON_PM, NUMMONS, PM_BARBARIAN, PM_CAVE_DWELLER, PM_GELATINOUS_CUBE, PM_GHOUL, PM_KILLER_BEE,
    PM_KITTEN, PM_LICHEN, PM_LITTLE_DOG, PM_LIZARD, PM_LONG_WORM, PM_MEDUSA, PM_PONY, PM_PYROLISK,
    PM_QUEEN_BEE, PM_RANGER, PM_RUST_MONSTER, PM_SAMURAI,
} from "./monsters.h.js";
import { OBJ_FREE } from "./obj.h.js";
import { Has_contents, ONAME, has_oname, polyfood, stale_egg } from "./obj.h.macros.js";
import { SILVER } from "./objclass.h.js";
import { is_metallic, is_organic, is_rustprone } from "./objclass.h.macros.js";
import {
    AMULET_OF_STRANGULATION, APPLE, BANANA, CARROT, CLOVE_OF_GARLIC, CORPSE, EGG, ENORMOUS_MEATBALL,
    EXPENSIVE_CAMERA, GLOB_OF_GREEN_SLIME, LUMP_OF_ROYAL_JELLY, MEATBALL, MEAT_RING, MEAT_STICK,
    RIN_SLOW_DIGESTION, SLIME_MOLD, SPE_CREATE_FAMILIAR, TIN, TRIPE_RATION,
} from "./objects.h.js";
import { MON_AT, fmon } from "./rm.h.macros.js";
import { P_SKILL } from "./skills.h.macros.js";
import { MAGIC_PORTAL } from "./trap.h.js";
import { LS_MONSTER } from "./vision.h.js";
import { cansee } from "./vision.h.macros.js";
import { Role_if, Upolyd, uhis } from "./you.h.macros.js";
import { Aggravate_monster, Conflict, Hallucination } from "./youprop.h.macros.js";
import { int, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { and64, or64, or64u } from "../rt/int64.js";
import { assert, free, memset } from "../rt/libc.js";
import { stack_struct, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, elt, ptr_to, ref_of, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { m_unleash } from "./apply.js";
import { night } from "./calendar.js";
import { is_pool } from "./dbridge.js";
import {
    flags, gb, gc, gd, gf, gh, gm, gn, gp, gu, gy, iflags, program_state, svc, svl, svm, svq, svr,
    svu, u,
} from "./decl.js";
import { canseemon, newsym } from "./display.js";
import { Monnam, christen_monst, mon_pmname } from "./do_name.js";
import { dog_eat, finish_meating } from "./dogmove.js";
import { deliver_obj_to_mon } from "./dokick.js";
import {
    In_W_tower, builds_up, depth, ledger_no, ledger_to_dlev, ledger_to_dnum, on_level,
} from "./dungeon.js";
import { panic } from "./end.js";
import { in_rooms, monst_to_any } from "./hack.js";
import { s_suffix } from "./hacklib.js";
import { carrying } from "./invent.js";
import { del_light_source } from "./light.js";
import { makemon, mbirth_limit, newmextra, rndmonst_adj, set_malign } from "./makemon.js";
import { expels } from "./mhitu.js";
import { free_emin } from "./minion.js";
import { discard_minvent, peek_at_iced_corpse_age, place_object } from "./mkobj.js";
import { somexy } from "./mkroom.js";
import {
    dealloc_monst, healmon, iter_mons, m_into_limbo, minliquid, mnearto, mnexto, monnear, relmon,
    restore_cham, see_monster_closeup, unstuck, wake_nearto,
} from "./mon.js";
import { attacktype, levl_follower, mon_hates_silver, same_race, sticks } from "./mondata.js";
import { find_pmmonst, mon_track_clear } from "./monmove.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import { Tobjnam, an, the, xname } from "./objnam.js";
import { There, You, impossible, livelog_printf, pline, pline_The, pline_mon } from "./pline.js";
import { body_part } from "./polyself.js";
import { is_quest_artifact } from "./questpgr.js";
import { rn2, rnd } from "./rnd.js";
import {
    make_happy_shk, make_happy_shoppers, obfree, picked_container, set_residency,
} from "./shk.js";
import { growl, yelp } from "./sounds.js";
import { spell_skilltype } from "./spell.js";
import { stairway_find, stairway_find_dir, stairway_find_from } from "./stairs.js";
import { mdrop_special_objs } from "./steal.js";
import { dismount_steed, place_monster, put_saddle_on_mon } from "./steed.js";
import { rloc, rloc_to } from "./teleport.js";
import { mintrap } from "./trap.js";
import { vision_recalc } from "./vision.js";
import { mon_wield_item } from "./weapon.js";
import { mon_has_amulet } from "./wizard.js";
import { count_wsegs, get_wormno, initworm, redraw_worm, wormgone } from "./worm.js";
import { obj_resists } from "./zap.js";
