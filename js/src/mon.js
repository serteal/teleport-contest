/* NetHack 5.0	mon.c	$NHDT-Date: 1770949988 2026/02/12 18:33:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.621 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Derek S. Ray, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

 /* defined in shknam.c */

export function LEVEL_SPECIFIC_NOCORPSE(mdat) { return (Is_rogue_level(u.uz)
     || !svl.level.flags.deathdrops
     || (svl.level.flags.graveyard && is_undead(mdat) && rn2(3)) ? 1 : 0); }

function pet_sanity_check(
    mtmp,
    msgarg) { /* void */
    if (has_edog(mtmp)) {
        let edog = EDOG(mtmp);

        if (edog.droptime > svm.moves)
            impossible(_("insane pet #%u has droptime (%lld)" +
                       " in the future (%lld) (%s)"),
                       mtmp.m_id, edog.droptime, svm.moves, msgarg);
        /* TODO: verify some of the other edog fields */
    }
}

function sanity_check_single_mon(
    mtmp,
    chk_geno,
    msg) { /* void */
    let mptr = mtmp.data;
    let mx = mtmp.mx, my = mtmp.my;

    if (!mptr || mptr < mons[LOW_PM] || mptr > mons[HIGH_PM]) {
        /* most sanity checks issue warnings if they detect a problem,
           but this would be too extreme to keep going */
        panic(_("illegal mon data %s; mnum=%d (%s)"),
              fmt_ptr(addr_of(mptr)), mtmp.mnum, msg);
        /*NOTREACHED*/
    } else {
        let mndx = monsndx(mptr);

        if (mtmp.mnum != mndx) {
            impossible(_("monster mnum=%d, monsndx=%d (%s)"),
                       mtmp.mnum, mndx, msg);
            mtmp.mnum = mndx;
        }
        /* check before DEADMONSTER() because dead monsters should still
           have sane mhpmax */
        if (mtmp.mhpmax < 1
            /* Gremlins don't obey the (mhpmax >= m_lev) rule so disable
             * this check, at least for the time being.  We could skip it
             * when the cloned flag is set, but the original gremlin would
             * still be an issue.
            || mtmp->mhpmax < (int) mtmp->m_lev
             */
            || mtmp.mhp > mtmp.mhpmax)
            impossible(_("%s: level %d %s #%u [%s] has %d cur HP, %d max HP"),
                       msg, mtmp.m_lev, mptr.pmnames[NEUTRAL],
                       mtmp.m_id, fmt_ptr(addr_of(mtmp)),
                       mtmp.mhp, mtmp.mhpmax);
        if (DEADMONSTER(mtmp)) {
            return;
        }
        if (chk_geno && (svm.mvitals[mndx].mvflags & G_GENOD) != 0)
            impossible(_("genocided %s in play (%s)"),
                       pmname(mptr, Mgender(mtmp)), msg);
        if (mtmp.mtame && !mtmp.mpeaceful)
            impossible(_("tame %s is not peaceful (%s)"),
                       pmname(mptr, Mgender(mtmp)), msg);
    }
    if (mtmp.isshk && !has_eshk(mtmp))
        impossible(_("shk without eshk (%s)"), msg);
    if (mtmp.ispriest && !has_epri(mtmp))
        impossible(_("priest without epri (%s)"), msg);
    if (mtmp.isgd && !has_egd(mtmp))
        impossible(_("guard without egd (%s)"), msg);
    if (mtmp.isminion && !has_emin(mtmp))
        impossible(_("minion without emin (%s)"), msg);
    /* guardian angel on astral level is tame but has emin rather than edog */
    if (mtmp.mtame) {
        if (!has_edog(mtmp) && !mtmp.isminion)
            impossible(_("pet without edog (%s)"), msg);
        else
            pet_sanity_check(mtmp, msg);
    }
    /* steed should be tame and saddled */
    if (mtmp == u.usteed) {
        let ns, nt = !mtmp.mtame ? _("not tame") : 0;

        ns = !m_carrying(mtmp, SADDLE) ? _("no saddle")
             : !which_armor(mtmp, W_SADDLE) ? _("saddle not worn")
               : 0;
        if (ns || nt)
            impossible(_("steed: %s%s%s (%s)"),
                       ns ? ns : _(""), (ns && nt) ? _(", ") : _(""), nt ? nt : _(""),
                       msg);
    }

    if (mtmp.mtrapped) {
        if (mtmp.wormno) {
            ; /* TODO: how to check worm in trap? */
        } else if (!t_at(mx, my))
            impossible(_("trapped without a trap (%s)"), msg);
    }
    /* monst->mfrozen is difficult to deal with--it's used for paralysis,
       for temporary sleep, and for being busy (usually donning armor);
       code that sets mfrozen needs to also clear mcanmove, otherwise the
       helpless() test will be unreliable */
    if (mtmp.mfrozen && mtmp.mcanmove)
        impossible(_("frozen monster [%s%s] is able to move (%s)"),
                   mtmp.mtame ? _("tame ") : mtmp.mpeaceful ? _("peaceful ") : _(""),
                   pmname(mptr, Mgender(mtmp)), msg);

    /* monster is hiding? */
    if (mtmp.mundetected) {
        let t;

        if (!isok(mx, my)) /* caller will have checked this but not fixed it */
            mx = my = 0;
        if (mtmp == u.ustuck)
            impossible(_("hiding monster stuck to you (%s)"), msg);
        if (m_at(mx, my) == mtmp && hides_under(mptr) && !OBJ_AT(mx, my))
            impossible(_("mon hiding under nonexistent obj (%s)"), msg);
        if (mptr.mlet == S_EEL
            && !(is_pool(mx, my) && !Is_waterlevel(u.uz)))
            impossible(_("eel hiding %s (%s)"),
                       !Is_waterlevel(u.uz) ? _("out of water")
                                             : _("on Plane of Water"), msg);
        if (ceiling_hider(mptr)
            /* normally !accessible would be overridable with passes_walls,
               but not for hiding on the ceiling */
            && (!has_ceiling(u.uz)
                || !(levl()[mx][my].typ == POOL
                     || levl()[mx][my].typ == MOAT
                     || levl()[mx][my].typ == WATER
                     || levl()[mx][my].typ == LAVAPOOL
                     || levl()[mx][my].typ == LAVAWALL
                     || accessible(mx, my))))
            impossible(_("ceiling hider hiding %s (%s)"),
                       !has_ceiling(u.uz) ? _("without ceiling")
                                           : _("in solid stone"),
                       msg);
        if (mtmp.mtrapped && (t = t_at(mx, my)) != null && !is_pit(t.ttyp))
            impossible(_("hiding while trapped in a non-pit (%s)"), msg);
    } else if (M_AP_TYPE(mtmp) != M_AP_NOTHING) {
        let is_mimic = +(mptr.mlet == S_MIMIC);
        let what = (M_AP_TYPE(mtmp) == M_AP_FURNITURE) ? _("furniture")
                           : (M_AP_TYPE(mtmp) == M_AP_MONSTER) ? _("a monster")
                             : (M_AP_TYPE(mtmp) == M_AP_OBJECT) ? _("an object")
                               : _("something strange");

        if (!strcmp(msg, _("migr"))) {
            if (M_AP_TYPE(mtmp) != M_AP_MONSTER)
                impossible(_("migrating %s mimicking %s %s"),
                           is_mimic ? _("mimic") : _("monster"), what, msg);
        } else if (Protection_from_shape_changers()) {
            impossible(
                _("mimic%s concealed as %s despite Prot-from-shape-changers %s"),
                       is_mimic ? _("") : _("ker"), what, msg);
        }
        /* the Wizard's clone after "double trouble" starts out mimicking
           some other monster; pet's quickmimic effect can temporarily take
           on furniture, object, or monster shape, but only until the pet
           finishes eating a mimic corpse */
        if (!(is_mimic || mtmp.meating
              || (mtmp.iswiz && M_AP_TYPE(mtmp) == M_AP_MONSTER)))
            impossible(_("non-mimic (%s) posing as %s (%s)"),
                       mptr.pmnames[NEUTRAL], what, msg);
    /* #if 0: not in this build */
    }
    if (mtmp.mleashed) {
        if (!get_mleash(mtmp))
            impossible(_("monst %u: leashed but no leash for %s"),
                       mtmp.m_id, mon_pmname(mtmp));
        else if (!mtmp.mtame)
            impossible(_("monst %u: leashed but not tame %s"),
                       mtmp.m_id, mon_pmname(mtmp));
    /* #if 0: not in this build */
    }
}

export function mon_sanity_check() { /* void */
    let x, y;
    let mtmp, m;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        /* dead monsters should still have sane data */
        sanity_check_single_mon(mtmp, TRUE, _("fmon"));
        if (DEADMONSTER(mtmp) && !mtmp.isgd)
            continue;

        x = mtmp.mx, y = mtmp.my;
        if (!isok(x, y) && !(mtmp.isgd && x == 0 && y == 0)) {
            impossible(_("mon (%s) claims to be at <%d,%d>?"),
                       fmt_ptr(addr_of(mtmp)), x, y);
        } else if (mtmp == u.usteed) {
            /* steed is in fmon list but not on the map; its
               <mx,my> coordinates should match hero's location */
            if (x != u.ux || y != u.uy)
                impossible(_("steed (%s) claims to be at <%d,%d>?"),
                           fmt_ptr(addr_of(mtmp)), x, y);
        } else if (svl.level.monsters[x][y] != mtmp) {
            impossible(_("mon (%s) at <%d,%d> is not there!"),
                       fmt_ptr(addr_of(mtmp)), x, y);
        } else if (mtmp.wormno) {
            sanity_check_worm(mtmp);

        /* some temp mstate bits can be expected for a mon on fmon, as part of
           removing it, but DEADMONSTER check above should skip those. */
        } else if (mon_offmap(mtmp)) {
            impossible(_("floor mon (%s) with mstate set to 0x%08llx"),
                       fmt_ptr(addr_of(mtmp)), mtmp.mstate);
        }
    }

    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            if ((mtmp = svl.level.monsters[x][y]) != null) {
                for (m = fmon(); m; m = m.nmon)
                    if (m == mtmp)
                        break;
                if (!m)
                    impossible(_("map mon (%s) at <%d,%d> not in fmon list!"),
                               fmt_ptr(addr_of(mtmp)), x, y);
                else if (mtmp == u.usteed)
                    impossible(_("steed (%s) is on the map at <%d,%d>!"),
                               fmt_ptr(addr_of(mtmp)), x, y);
                else if ((mtmp.mx != x || mtmp.my != y)
                         && mtmp.data != mons[PM_LONG_WORM])
                    impossible(_("map mon (%s) at <%d,%d> is found at <%d,%d>?"),
                               fmt_ptr(addr_of(mtmp)),
                               mtmp.mx, mtmp.my, x, y);
            }

    for (mtmp = gm.migrating_mons; mtmp; mtmp = mtmp.nmon) {
        sanity_check_single_mon(mtmp, FALSE, _("migr"));

        if ((mtmp.mstate
             & ~(MON_MIGRATING | MON_LIMBO | MON_ENDGAME_MIGR | MON_OFFMAP))
            != 0
            || !(mtmp.mstate & MON_MIGRATING))
            impossible(_("migrating mon (%s) with mstate set to 0x%08llx"),
                       fmt_ptr(addr_of(mtmp)), mtmp.mstate);
    }

    wormno_sanity_check(); /* test for bogus worm tail */
}

/* Would monster be OK with poison gas? */
/* Does not check for actual poison gas at the location. */
/* Returns one of M_POISONGAS_foo */
export function m_poisongas_ok(mtmp) { /* int */
    let px, py;
    let is_you = +(mtmp == gy.youmonst);

    /* Non living, non breathing, immune monsters are not concerned */
    if (nonliving(mtmp.data) || is_vampshifter(mtmp)
        || breathless(mtmp.data) || immune_poisongas(mtmp.data))
        return M_POISONGAS_OK;
    /* not is_swimmer(); assume that non-fish are swimming on
       the surface and breathing the air above it periodically
       unless located at water spot on plane of water */
    px = is_you ? u.ux : mtmp.mx;
    py = is_you ? u.uy : mtmp.my;
    if ((mtmp.data.mlet == S_EEL || Is_waterlevel(u.uz))
        && is_pool(px, py))
        return M_POISONGAS_OK;
    /* exclude monsters with poison gas breath attack:
       adult green dragon and Chromatic Dragon (and iron golem,
       but nonliving() and breathless() tests also catch that) */
    if (attacktype_fordmg(mtmp.data, AT_BREA, AD_DRST)
        || attacktype_fordmg(mtmp.data, AT_BREA, AD_RBRE))
        return M_POISONGAS_OK;
    if (is_you && (u.uinvulnerable || Breathless() || Underwater()))
        return M_POISONGAS_OK;
    if (is_you ? Poison_resistance() : resists_poison(mtmp))
        return M_POISONGAS_MINOR;
    return M_POISONGAS_BAD;
}

/* return True if mon is capable of converting other monsters into zombies */
export function zombie_maker(mon) { /* boolean */
    let pm = mon.data;

    if (mon.mcan)
        return FALSE;

    switch (pm.mlet) {
    case S_ZOMBIE:
        /* Z-class monsters that aren't actually zombies go here */
        if (pm == mons[PM_GHOUL] || pm == mons[PM_SKELETON])
            return FALSE;
        return TRUE;
    case S_LICH:
        /* all liches will create zombies as well */
        return TRUE;
    }
    return FALSE;
}

/* Return monster index of zombie monster which this monster could
   be turned into, or NON_PM if it doesn't have a direct counterpart.
   Sort of the zombie-specific inverse of undead_to_corpse. */
export function zombie_form(pm) { /* int */
    switch (pm.mlet) {
    case S_ZOMBIE: /* when already a zombie/ghoul/skeleton, will stay as is */
        return NON_PM;
    case S_KOBOLD:
        return PM_KOBOLD_ZOMBIE;
    case S_ORC:
        return PM_ORC_ZOMBIE;
    case S_GIANT:
        if (pm == mons[PM_ETTIN])
            return PM_ETTIN_ZOMBIE;
        return PM_GIANT_ZOMBIE;
    case S_HUMAN:
    case S_KOP:
        if (is_elf(pm))
            return PM_ELF_ZOMBIE;
        return PM_HUMAN_ZOMBIE;
    case S_HUMANOID:
        if (is_dwarf(pm))
            return PM_DWARF_ZOMBIE;
        else
            break;
    case S_GNOME:
        return PM_GNOME_ZOMBIE;
    }
    return NON_PM;
}

/* convert the monster index of an undead to its living counterpart */
export function undead_to_corpse(mndx) { /* int */
    switch (mndx) {
    case PM_KOBOLD_ZOMBIE:
    case PM_KOBOLD_MUMMY:
        mndx = PM_KOBOLD;
        break;
    case PM_DWARF_ZOMBIE:
    case PM_DWARF_MUMMY:
        mndx = PM_DWARF;
        break;
    case PM_GNOME_ZOMBIE:
    case PM_GNOME_MUMMY:
        mndx = PM_GNOME;
        break;
    case PM_ORC_ZOMBIE:
    case PM_ORC_MUMMY:
        mndx = PM_ORC;
        break;
    case PM_ELF_ZOMBIE:
    case PM_ELF_MUMMY:
        mndx = PM_ELF;
        break;
    case PM_VAMPIRE:
    case PM_VAMPIRE_LEADER:

    case PM_HUMAN_ZOMBIE:
    case PM_HUMAN_MUMMY:
        mndx = PM_HUMAN;
        break;
    case PM_GIANT_ZOMBIE:
    case PM_GIANT_MUMMY:
        mndx = PM_GIANT;
        break;
    case PM_ETTIN_ZOMBIE:
    case PM_ETTIN_MUMMY:
        mndx = PM_ETTIN;
        break;
    default:
        break;
    }
    return mndx;
}

/* Convert the monster index of some monsters (such as quest guardians)
 * to their generic species type.
 *
 * Return associated character class monster, rather than species
 * if mode is 1.
 */
export function genus(mndx, mode) { /* int */
    switch (mndx) {
    /* Quest guardians */
    case PM_STUDENT:
        mndx = mode ? PM_ARCHEOLOGIST : PM_HUMAN;
        break;
    case PM_CHIEFTAIN:
        mndx = mode ? PM_BARBARIAN : PM_HUMAN;
        break;
    case PM_NEANDERTHAL:
        mndx = mode ? PM_CAVE_DWELLER : PM_HUMAN;
        break;
    case PM_ATTENDANT:
        mndx = mode ? PM_HEALER : PM_HUMAN;
        break;
    case PM_PAGE:
        mndx = mode ? PM_KNIGHT : PM_HUMAN;
        break;
    case PM_ABBOT:
        mndx = mode ? PM_MONK : PM_HUMAN;
        break;
    case PM_ACOLYTE:
        mndx = mode ? PM_CLERIC : PM_HUMAN;
        break;
    case PM_HUNTER:
        mndx = mode ? PM_RANGER : PM_HUMAN;
        break;
    case PM_THUG:
        mndx = mode ? PM_ROGUE : PM_HUMAN;
        break;
    case PM_ROSHI:
        mndx = mode ? PM_SAMURAI : PM_HUMAN;
        break;
    case PM_GUIDE:
        mndx = mode ? PM_TOURIST : PM_HUMAN;
        break;
    case PM_APPRENTICE:
        mndx = mode ? PM_WIZARD : PM_HUMAN;
        break;
    case PM_WARRIOR:
        mndx = mode ? PM_VALKYRIE : PM_HUMAN;
        break;
    default:
        if (ismnum(mndx)) {
            let ptr = mons[mndx];

            if (is_human(ptr))
                mndx = PM_HUMAN;
            else if (is_elf(ptr))
                mndx = PM_ELF;
            else if (is_dwarf(ptr))
                mndx = PM_DWARF;
            else if (is_gnome(ptr))
                mndx = PM_GNOME;
            else if (is_orc(ptr))
                mndx = PM_ORC;
        }
        break;
    }
    return mndx;
}

/* return monster index if chameleon, or NON_PM if not */
export function pm_to_cham(mndx) { /* int */
    let mcham = NON_PM;

    /*
     * As of 3.6.0 we just check M2_SHAPESHIFTER instead of having a
     * big switch statement with hardcoded shapeshifter types here.
     */
    if (ismnum(mndx) && is_shapeshifter(mons[mndx]))
        mcham = mndx;
    return mcham;
}

/* for deciding whether corpse will carry along full monster data */
export function KEEPTRAITS(mon) { return (mon.isshk || mon.mtame || unique_corpstat(mon.data)
     || is_reviver(mon.data)
        /* normally quest leader will be unique, */
        /* but he or she might have been polymorphed  */
     || mon.m_id == svq.quest_status.leader_m_id
        /* special cancellation handling for these */
     || (dmgtype(mon.data, AD_SEDU) || dmgtype(mon.data, AD_SSEX)) ? 1 : 0); }

/* Creates a monster corpse, a "special" corpse, or nothing if it doesn't
 * leave corpses.  Monsters which leave "special" corpses should have
 * G_NOCORPSE set in order to prevent wishing for one, finding tins of one,
 * etc....
 */
function make_corpse(mtmp, corpseflags) { /* struct obj * */
    const $frame = stack_frame(); try {
    let $goto = null; var obj = stack_var(ptr_to(struct_obj)), otmp = stack_var(ptr_to(struct_obj)), dealloc = stack_var(boolean);
    var mdat = mtmp.data;
    var num;
    obj[0] = null;
    otmp[0] = null;
    var x = mtmp.mx, y = mtmp.my;
/*    int mndx = monsndx(mdat); */
    var mndx = monsndx(mdat);
    var corpstatflags = corpseflags;
    var burythem = +((corpstatflags & CORPSTAT_BURIED) != 0);

    if (mtmp.female)
        corpstatflags = unsigned(corpstatflags | CORPSTAT_FEMALE);
    else if (!is_neuter(mtmp.data))
        corpstatflags = unsigned(corpstatflags | CORPSTAT_MALE);

    $goto_default_1: for (;;) { switch ($goto || (mndx)) {
    case PM_GRAY_DRAGON:
    case PM_GOLD_DRAGON:
    case PM_SILVER_DRAGON:

    case PM_RED_DRAGON:
    case PM_ORANGE_DRAGON:
    case PM_WHITE_DRAGON:
    case PM_BLACK_DRAGON:
    case PM_BLUE_DRAGON:
    case PM_GREEN_DRAGON:
    case PM_YELLOW_DRAGON:
        /* Make dragon scales.  This assumes that the order of the
           dragons is the same as the order of the scales. */
        if (!rn2(mtmp.mrevived ? 20 : 3)) {
            num = GRAY_DRAGON_SCALES + monsndx(mdat) - PM_GRAY_DRAGON;
            obj[0] = mksobj_at(num, x, y, FALSE, FALSE);
            obj[0].spe = 0;
            obj[0].cursed = obj[0].blessed = FALSE;
        }
        { $goto = "default_1"; continue $goto_default_1; }
    case PM_WHITE_UNICORN:
    case PM_GRAY_UNICORN:
    case PM_BLACK_UNICORN:
        if (mtmp.mrevived && rn2(2)) {
            if (canseemon(mtmp))
                pline_mon(mtmp,
                      _("%s recently regrown horn crumbles to dust."),
                      s_suffix(Monnam(mtmp)));
        } else {
            obj[0] = mksobj_at(UNICORN_HORN, x, y, TRUE, FALSE);
            if (obj[0] && mtmp.mrevived)
                obj[0].obroken = 1;
        }
        { $goto = "default_1"; continue $goto_default_1; }
    case PM_LONG_WORM:
        mksobj_at(WORM_TOOTH, x, y, TRUE, FALSE);
        { $goto = "default_1"; continue $goto_default_1; }
    case PM_VAMPIRE:
    case PM_VAMPIRE_LEADER:
        /* include mtmp in the mkcorpstat() call */
        num = undead_to_corpse(mndx);
        corpstatflags = unsigned(corpstatflags | CORPSTAT_INIT);
        obj[0] = mkcorpstat(CORPSE, mtmp, mons[num], x, y, corpstatflags);
        obj[0].age -= (TAINT_AGE + 1); /* this is an *OLD* corpse */
        break;
    case PM_KOBOLD_MUMMY:
    case PM_DWARF_MUMMY:
    case PM_GNOME_MUMMY:
    case PM_ORC_MUMMY:
    case PM_ELF_MUMMY:
    case PM_HUMAN_MUMMY:
    case PM_GIANT_MUMMY:
    case PM_ETTIN_MUMMY:
    case PM_KOBOLD_ZOMBIE:
    case PM_DWARF_ZOMBIE:
    case PM_GNOME_ZOMBIE:
    case PM_ORC_ZOMBIE:
    case PM_ELF_ZOMBIE:
    case PM_HUMAN_ZOMBIE:
    case PM_GIANT_ZOMBIE:
    case PM_ETTIN_ZOMBIE:
        num = undead_to_corpse(mndx);
        corpstatflags = unsigned(corpstatflags | CORPSTAT_INIT);
        obj[0] = mkcorpstat(CORPSE, mtmp, mons[num], x, y, corpstatflags);
        obj[0].age -= (TAINT_AGE + 1); /* this is an *OLD* corpse */
        break;
    case PM_IRON_GOLEM:
        num = d(2, 6);
        while (num--)
            obj[0] = mksobj_at(IRON_CHAIN, x, y, TRUE, FALSE);
        free_mgivenname(mtmp); /* don't christen obj */
        break;
    case PM_GLASS_GOLEM:
        num = d(2, 4); /* very low chance of creating all glass gems */
        while (num--)
            obj[0] = mksobj_at(FIRST_GLASS_GEM + rn2(NUM_GLASS_GEMS),
                            x, y, TRUE, FALSE);
        free_mgivenname(mtmp);
        break;
    case PM_CLAY_GOLEM:
        obj[0] = mksobj_at(ROCK, x, y, FALSE, FALSE);
        obj[0].quan = (rn2(20) + 50);
        obj[0].owt = unsigned(weight(obj[0]));
        free_mgivenname(mtmp);
        break;
    case PM_STONE_GOLEM:
        corpstatflags = unsigned(corpstatflags & unsigned(~CORPSTAT_INIT));
        obj[0] = mkcorpstat(STATUE, null, mdat, x, y,
                         corpstatflags);
        break;
    case PM_WOOD_GOLEM:
        num = d(2, 4);
        while (num--) {
            obj[0] = mksobj_at(
                            rn2(2) ? QUARTERSTAFF
                            : rn2(3) ? SMALL_SHIELD
                            : rn2(3) ? CLUB
                            : rn2(3) ? ELVEN_SPEAR : BOOMERANG,
                            x, y, TRUE, FALSE);
        }
        free_mgivenname(mtmp);
        break;
    case PM_ROPE_GOLEM:
        num = rn2(3);
        while (num-- > 0) {
            obj[0] = mksobj_at(rn2(2) ? LEASH
                            : rn2(3) ? BULLWHIP : GRAPPLING_HOOK,
                            x, y, TRUE, FALSE);
        }
        free_mgivenname(mtmp);
        break;
    case PM_LEATHER_GOLEM:
        num = d(2, 4);
        while (num--)
            obj[0] = mksobj_at(rn2(4) ? LEATHER_ARMOR
                            : rn2(3) ? LEATHER_CLOAK : SADDLE,
                            x, y, TRUE, FALSE);
        free_mgivenname(mtmp);
        break;
    case PM_GOLD_GOLEM:
        /* Good luck gives more coins */
        obj[0] = mkgold((200 - rnl(101)), x, y);
        free_mgivenname(mtmp);
        break;
    case PM_PAPER_GOLEM:
        num = rnd(4);
        while (num--)
            obj[0] = mksobj_at(SCR_BLANK_PAPER, x, y, TRUE, FALSE);
        free_mgivenname(mtmp);
        break;
    /* expired puddings will congeal into a large blob;
       like dragons, relies on the order remaining consistent */
    case PM_GRAY_OOZE:
    case PM_BROWN_PUDDING:
    case PM_GREEN_SLIME:
    case PM_BLACK_PUDDING:
        /* we have to do this here because most other places
           expect there to be an object coming back; not this one */
        obj[0] = mksobj_at(GLOB_OF_BLACK_PUDDING - (PM_BLACK_PUDDING - mndx),
                        x, y, TRUE, FALSE);

        while (obj[0] && (otmp[0] = obj_nexto(obj[0])) != null) {
            pudding_merge_message(obj[0], otmp[0]);
            obj[0] = obj_meld(obj, otmp);
        }
        free_mgivenname(mtmp);
        newsym(x, y);
        return obj[0];
    case NON_PM: case LEAVESTATUE: case NUMMONS: /* never use as index */
        break;

    /* #if (NH_DEVEL_STATUS != NH_STATUS_RELEASED): not in this build */

    case "default_1": default:

 $goto = null;
        if (svm.mvitals[mndx].mvflags & G_NOCORPSE) {
            return null;
        } else {
            corpstatflags = unsigned(corpstatflags | CORPSTAT_INIT);
            /* preserve the unique traits of some creatures */
            obj[0] = mkcorpstat(CORPSE, KEEPTRAITS(mtmp) ? mtmp : null,
                             mdat, x, y, corpstatflags);
            if (burythem) {
                bury_an_obj(obj[0], addr_of(dealloc));
                newsym(x, y);
                return dealloc[0] ? null : obj[0];
            }
        }
        break;
    } break; }
    /* All special cases should precede the G_NOCORPSE check */

    if (!obj[0])
        return null;

    /* if polymorph or undead turning has killed this monster,
       prevent the same attack beam from hitting its corpse */
    if (svc.context.bypasses)
        bypass_obj(obj[0]);

    if (has_mgivenname(mtmp))
        obj[0] = oname(obj[0], MGIVENNAME(mtmp), ONAME_NO_FLAGS);

    /*  Avoid "It was hidden under a green mold corpse!"
     *  during Blind combat. An unseen monster referred to as "it"
     *  could be killed and leave a corpse.  If a hider then hid
     *  underneath it, you could be told the corpse type of a
     *  monster that you never knew was there without this.
     *  The code in hitmu() substitutes the word "something"
     *  if the corpse's obj->dknown is 0.
     */
    if (Blind() && !sensemon(mtmp))
        clear_dknown(obj[0]); /* obj->dknown = 0; */

    stackobj(obj[0]); /* 'obj' remains valid if stacking happens */
    newsym(x, y);
    /* in case the corpse was placed at a different spot from where
       the monster was (not expected to happen) */
    if (obj[0].ox != x || obj[0].oy != y)
        newsym(obj[0].ox, obj[0].oy);
    return obj[0];
    } finally { stack_pop($frame); }
}

/* check mtmp and water/lava for compatibility, 0 (survived), 1 (died) */
export function minliquid(mtmp) { /* int */
    let res;

    /* set up flag for mondead() and xkilled() */
    iflags.sad_feeling = (mtmp.mtame && !canseemon(mtmp) ? 1 : 0);
    res = minliquid_core(mtmp);
    /* always clear the flag */
    iflags.sad_feeling = FALSE;
    return res;
}

/* guts of minliquid() */
function minliquid_core(mtmp) { /* int */
    let inpool, inlava, infountain;
    let waterwall = is_waterwall(mtmp.mx,mtmp.my);

    /* [ceiling clingers are handled below] */
    inpool = ((is_pool(mtmp.mx, mtmp.my)
              && (!(is_flyer(mtmp.data) || is_floater(mtmp.data))
                  /* there's no "above the surface" on the plane of water */
                  || Is_waterlevel(u.uz)) ? 1 : 0));
    inlava = (is_lava(mtmp.mx, mtmp.my)
              && !(is_flyer(mtmp.data) || is_floater(mtmp.data)) ? 1 : 0);
    infountain = IS_FOUNTAIN(levl()[mtmp.mx][mtmp.my].typ);

    /* Flying and levitation keeps our steed out of the liquid
       (but not water-walking or swimming; note: if hero is in a
       water location on the Plane of Water, flight and levitating
       are blocked so this (Flying || Levitation) test fails there
       and steed will be subject to water effects, as intended) */
    if (mtmp == u.usteed && (Flying() || Levitation()) && !waterwall)
        return 0;

    /* Gremlin multiplying won't go on forever since the hit points
     * keep going down, and when it gets to 1 hit point the clone
     * function will fail.
     */
    if (mtmp.data == mons[PM_GREMLIN] && (inpool || infountain) && rn2(3)) {
        if (split_mon(mtmp, null))
            dryup(mtmp.mx, mtmp.my, FALSE);
        if (inpool)
            water_damage_chain(mtmp.minvent, FALSE);
        return 0;
    } else if (mtmp.data == mons[PM_IRON_GOLEM] && inpool && !rn2(5)) {
        let dam = d(2, 6);

        if (cansee(mtmp.mx, mtmp.my))
            pline_mon(mtmp, _("%s rusts."), Monnam(mtmp));
        mtmp.mhp -= dam;
        if (mtmp.mhpmax > dam)
            mtmp.mhpmax -= dam;
        if (DEADMONSTER(mtmp)) {
            mondied(mtmp);
            if (DEADMONSTER(mtmp))
                return 1;
        }
        water_damage_chain(mtmp.minvent, FALSE);
        return 0;
    }

    if (inlava) {
        /*
         * Lava effects much as water effects. Lava likers are able to
         * protect their stuff. Fire resistant monsters can only protect
         * themselves  --ALI
         */
        if (!is_clinger(mtmp.data) && !likes_lava(mtmp.data)) {
            /* not fair...?  hero doesn't automatically teleport away
               from lava, just from water */
            if (can_teleport(mtmp.data) && !tele_restrict(mtmp)) {
                if (rloc(mtmp, RLOC_MSG))
                    return 0;
            }
            if (!resists_fire(mtmp)) {
                if (cansee(mtmp.mx, mtmp.my)) {
                    let dummy = mtmp.data.mattk[0];
                    let how = on_fire(mtmp.data, dummy);

                    pline_mon(mtmp, _("%s %s."), Monnam(mtmp),
                          !strcmp(how, _("boiling")) ? _("boils away")
                             : !strcmp(how, _("melting")) ? _("melts away")
                                : _("burns to a crisp"));
                }
                /* unlike fire -> melt ice -> pool, there's no way for the
                   hero to create lava beneath a monster, so the !mon_moving
                   case is not expected to happen (and we haven't made a
                   player-against-monster variation of the message above) */
                if (svc.context.mon_moving)
                    mondead(mtmp); /* no corpse */
                else
                    xkilled(mtmp, XKILL_NOMSG);
            } else {
                mtmp.mhp -= 1;
                if (DEADMONSTER(mtmp)) {
                    if (cansee(mtmp.mx, mtmp.my))
                        pline_mon(mtmp, _("%s surrenders to the fire."),
                                  Monnam(mtmp));
                    mondead(mtmp); /* no corpse */
                } else if (cansee(mtmp.mx, mtmp.my)) {
                    pline_mon(mtmp, _("%s burns slightly."), Monnam(mtmp));
                }
            }
            if (!DEADMONSTER(mtmp)) {
                if (m_in_air(mtmp)) {
                    ; /* vampshifter in wolf form can revert to vampire lord
                       * and become a flyer so not need to teleport */
                } else if (likes_lava(mtmp.data)) {
                    ; /* likes_lava case is hypothetical */
                } else {
                    fire_damage_chain(mtmp.minvent, FALSE, FALSE,
                                             mtmp.mx, mtmp.my);
                    if (!rloc(mtmp, RLOC_MSG))
                        deal_with_overcrowding(mtmp);
                }
                return 0;
            }
            return 1;
        }
    } else if (inpool || waterwall) {
        /* Most monsters drown in pools.  flooreffects() will take care of
         * water damage to dead monsters' inventory, but survivors need to
         * be handled here.  Swimmers are able to protect their stuff...
         */
        if ((waterwall || !is_clinger(mtmp.data))
            && !cant_drown(mtmp.data)) {
            /* like hero with teleport intrinsic or spell, teleport away
               if possible */
            if (can_teleport(mtmp.data) && !tele_restrict(mtmp)) {
                if (rloc(mtmp, RLOC_MSG))
                    return 0;
            }
            if (cansee(mtmp.mx, mtmp.my)) {
                if (svc.context.mon_moving)
                    pline_mon(mtmp, _("%s drowns."), Monnam(mtmp));
                else
                    /* hero used fire to melt ice that monster was on */
                    You(_("drown %s."), mon_nam(mtmp));
            }
            if (engulfing_u(mtmp)) {
                /* This can happen after a purple worm plucks you off a
                   flying steed while you are over water. */
                pline(_("%s sinks as %s rushes in and flushes you out."),
                      Monnam(mtmp), hliquid(_("water")));
            }
            if (svc.context.mon_moving)
                mondied(mtmp); /* ok to leave corpse despite water */
            else
                xkilled(mtmp, XKILL_NOMSG);
            if (!DEADMONSTER(mtmp)) {
                if (m_in_air(mtmp)) {
                    ; /* vampshifter in wolf form can revert to vampire lord
                       * and become a flyer so not need to teleport */
                } else {
                    water_damage_chain(mtmp.minvent, FALSE);
                    if (!rloc(mtmp, RLOC_NOMSG))
                        deal_with_overcrowding(mtmp);
                }
                return 0;
            }
            return 1;
        }
    } else {
        /* but eels have a difficult time outside */
        if (mtmp.data.mlet == S_EEL && !Is_waterlevel(u.uz)
            && !breathless(mtmp.data)) {
            /* as mhp gets lower, the rate of further loss slows down */
            if (mtmp.mhp > 1 && rn2(mtmp.mhp) > rn2(8))
                mtmp.mhp--;
            monflee(mtmp, 2, FALSE, FALSE);
        }
    }
    return 0;
}

/* calculate 'mon's movement for current turn; called from moveloop() */
export function mcalcmove(
    mon,
    m_moving) { /* int */ /* True: adjust for moving; * False: just adjust for speed */
    let mmove = mon.data.mmove;
    let mmove_adj;

    /* Note: MSLOW's `+ 1' prevents slowed speed 1 getting reduced to 0;
     *       MFAST's `+ 2' prevents hasted speed 1 from becoming a no-op;
     *       both adjustments have negligible effect on higher speeds.
     */
    if (mon.mspeed == MSLOW) {
        /* slow-monster effects work better against faster monsters: they
           lose 1/3 of their speed below 12 but 2/3 of their speed above */
        if (mmove < NORMAL_SPEED)
            mmove = Math.trunc((2 * mmove + 1) / 3);
        else
            mmove = 4 + Math.trunc(mmove / 3);
    } else if (mon.mspeed == MFAST)
        mmove = Math.trunc((4 * mmove + 2) / 3);

    if (mon == u.usteed && u.ugallop && svc.context.mv) {
        /* increase movement by a factor of 1.5; also increase variance of
           movement speed (if it's naturally 24, we don't want it to always
           become 36) */
        mmove = Math.trunc(((rn2(2) ? 4 : 5) * mmove) / 3);
    }

    if (m_moving) {
        /* Randomly round the monster's speed to a multiple of NORMAL_SPEED.
           This makes it impossible for the player to predict when they'll
           get a free turn (thus preventing exploits like "melee kiting"),
           while retaining guarantees about shopkeepers not being outsped
           by a normal-speed player, normal-speed players being unable
           to open up a gap when fleeing a normal-speed monster, etc. */
        mmove_adj = mmove % NORMAL_SPEED;
        mmove -= mmove_adj;
        if (rn2(NORMAL_SPEED) < mmove_adj)
            mmove += NORMAL_SPEED;
    }
    return mmove;
}

/* actions that happen once per ``turn'', regardless of each
   individual monster's metabolism; some of these might need to
   be reclassified to occur more in proportion with movement rate */
export function mcalcdistress() { /* void */
    iter_mons(m_calcdistress);
}

function m_calcdistress(mtmp) { /* void */
    /* must check non-moving monsters once/turn in case they managed
       to end up in water or lava; note: when not in liquid they regen,
       shape-shift, timeout temporary maladies just like other monsters */
    if (mtmp.data.mmove == 0) {
        if (gv.vision_full_recalc)
            vision_recalc(0);
        if (minliquid(mtmp))
            return;
    }

    /* regenerate hit points */
    mon_regen(mtmp, FALSE);

    /* possibly polymorph shapechangers and lycanthropes */
    if (ismnum(mtmp.cham))
        decide_to_shapeshift(mtmp);
    were_change(mtmp);

    /* gradually time out temporary problems */
    if (mtmp.mblinded && !--mtmp.mblinded)
        mtmp.mcansee = 1;
    if (mtmp.mfrozen && !--mtmp.mfrozen)
        mtmp.mcanmove = 1;
    if (mtmp.mfleetim && !--mtmp.mfleetim)
        mtmp.mflee = 0;

    /* FIXME: mtmp->mlstmv ought to be updated here */
}

/* perform movement for a single monster.
   meant to be used with iter_mons_safe. */
export function movemon_singlemon(mtmp) { /* boolean */
    /* end monster movement early if hero is flagged to leave the level */
    if (u.utotype

        /* or if the program has lost contact with the user */
        || program_state.done_hup

        ) {
        gs.somebody_can_move = FALSE;
        return TRUE;
    }

    /* one dead monster needs to perform a move after death: vault
       guard whose temporary corridor is still on the map; live
       guards who have led the hero back to civilization get moved
       off the map too; gd_move() decides whether the temporary
       corridor can be removed and guard discarded (via clearing
       mon->isgd flag so that dmonsfree() will get rid of mon) */
    if (mtmp.isgd && !mtmp.mx && !(mtmp.mstate & MON_MIGRATING)) {
        /* parked at <0,0>; eventually isgd should get set to false */
        if (svm.moves > mtmp.mlstmv) {
            gd_move(mtmp);
            mtmp.mlstmv = svm.moves;
        }
        return FALSE;
    }
    if (DEADMONSTER(mtmp))
        return FALSE;

    /* monster isn't on this map anymore */
    if (mon_offmap(mtmp))
        return FALSE;

    m_everyturn_effect(mtmp);

    /* Find a monster that we have not treated yet. */
    if (mtmp.movement < NORMAL_SPEED)
        return FALSE;

    mtmp.movement -= NORMAL_SPEED;
    if (mtmp.movement >= NORMAL_SPEED)
        gs.somebody_can_move = TRUE;

    if (gv.vision_full_recalc)
        vision_recalc(0); /* vision! */

    /* reset obj bypasses before next monster moves */
    if (svc.context.bypasses)
        clear_bypasses();
    clear_splitobjs();
    if (minliquid(mtmp))
        return FALSE;

    /* after losing equipment, try to put on replacement */
    if (mtmp.misc_worn_check & I_SPECIAL) {
        let oldworn;

        /* hostiles only try to equip things if they think hero isn't
         * nearby; if they think hero is nearby, leave the flag intact so
         * that it can be checked again on subsequent moves until the hero
         * is perceived to be farther away. */
        if (mtmp.mpeaceful || mtmp.mtame
            || dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy) > (3 * 3)) {
            mtmp.misc_worn_check = and64(mtmp.misc_worn_check, ~I_SPECIAL);
            oldworn = mtmp.misc_worn_check;
            m_dowear(mtmp, FALSE);
            if (mtmp.misc_worn_check != oldworn || !mtmp.mcanmove)
                return FALSE; /* is spending this turn equipping */
        }
    }

    if (is_hider(mtmp.data)) {
        /* unwatched mimics and piercers may hide again  [MRS] */
        if (restrap(mtmp))
            return FALSE;
        if (M_AP_TYPE(mtmp) == M_AP_FURNITURE
            || M_AP_TYPE(mtmp) == M_AP_OBJECT)
            return FALSE;
        if (mtmp.mundetected)
            return FALSE;
    } else if (mtmp.data.mlet == S_EEL && !mtmp.mundetected
               && (mtmp.mflee || !m_next2u(mtmp))
               && !canseemon(mtmp) && !rn2(4)) {
        /* some eels end up stuck in isolated pools, where they
           can't--or at least won't--move, so they never reach
           their post-move chance to re-hide */
        if (hideunder(mtmp))
            return FALSE;
    }

    /* continue if the monster died fighting */
    if (Conflict() && !mtmp.iswiz && m_canseeu(mtmp)) {
        /* Note:
         *  Conflict does not take effect in the first round.
         *  Therefore, A monster when stepping into the area will
         *  get to swing at you.
         *
         *  The call to fightm() must be _last_.  The monster might
         *  have died if it returns 1.
         */
        if (cansee(mtmp.mx, mtmp.my)
            && (mdistu(mtmp) <= BOLT_LIM * BOLT_LIM)
            && fightm(mtmp))
            return FALSE; /* mon might have died */
    }
    dochugw(mtmp, TRUE); /* otherwise just move the monster */
    return FALSE;
}

/* perform movement for all monsters */
export function movemon() { /* int */
    gs.somebody_can_move = FALSE;

    iter_mons_safe(movemon_singlemon);

    if (any_light_source())
        gv.vision_full_recalc = 1; /* in case a mon moved w/ a light source */
    /* reset obj bypasses after last monster has moved */
    if (svc.context.bypasses)
        clear_bypasses();
    clear_splitobjs();
    /* remove dead monsters; dead vault guard will be left at <0,0>
       if temporary corridor out of vault hasn't been removed yet */
    dmonsfree();

    /* a monster may have levteleported player -dlc */
    if (u.utotype) {
        deferred_goto();
        /* changed levels, so these monsters are dormant */
        gs.somebody_can_move = FALSE;
    }

    return gs.somebody_can_move;
}

/* dispose of contents of an eaten container; used for pets and other mons */
export function meatbox(mon, otmp) { /* void */
    let engulf_contents = +(mon.data == mons[PM_GELATINOUS_CUBE]);
    let x = mon.mx, y = mon.my;
    let cobj;

    if (!Has_contents(otmp) || !isok(x, y))
        return;

    /* contents of eaten containers become engulfed or dropped onto
      the floor; this is arbitrary, but otherwise g-cubes are too
      powerful */
    if (!engulf_contents && cansee(x, y)) {
        pline(_("%s contents spill out onto the %s."),
              s_suffix(The(distant_name(otmp, xname))),
              surface(x, y));
    }
    while ((cobj = otmp.cobj) != null) {
        obj_extract_self(cobj);
        if (otmp.otyp == ICE_BOX)
            removed_from_icebox(cobj);
        if (engulf_contents) {
            mpickobj(mon, cobj);
        } else {
            if (!flooreffects(cobj, x, y, _("")))
                place_object(cobj, x, y);
        }
    }
}

export function mstoning(obj) { return +(ofood(obj) && ismnum(obj.corpsenm)
     && flesh_petrifies(mons[obj.corpsenm])); }

/* Monster mtmp consumes an object.
   Monster may die, polymorph, grow up, heal, etc; meating is not changed.
   Object is extracted from any linked list and freed. */
export function m_consume_obj(mtmp, otmp) { /* void */
    let ispet = mtmp.mtame;

    /* non-pet: Heal up to the object's weight in hp */
    if (!ispet && mtmp.mhp < mtmp.mhpmax) {
        healmon(mtmp, int(objects[otmp.otyp].oc_weight), 0);
    }
    if (Has_contents(otmp))
        meatbox(mtmp, otmp);
    if (otmp == uball) {
        unpunish();
        delobj(otmp);
    } else if (otmp == uchain) {
        unpunish(); /* frees uchain */
    } else {
        let deadmimic, slimer;
        let poly, grow, heal, eyes, mstone, vis = canseemon(mtmp);
        let corpsenm = (otmp.otyp == CORPSE ? otmp.corpsenm : NON_PM);

        deadmimic = +(otmp.otyp == CORPSE && (corpsenm == PM_SMALL_MIMIC
                                              || corpsenm == PM_LARGE_MIMIC
                                              || corpsenm == PM_GIANT_MIMIC));
        slimer = +(otmp.otyp == GLOB_OF_GREEN_SLIME);
        poly = polyfood(otmp);
        grow = mlevelgain(otmp);
        heal = mhealup(otmp);
        eyes = +(otmp.otyp == CARROT);
        mstone = mstoning(otmp);
        delobj(otmp); /* munch */
        if (poly || slimer) {
            let ptr = slimer ? mons[PM_GREEN_SLIME] : null;

            newcham(mtmp, ptr, vis ? NC_SHOW_MSG : NO_NC_FLAGS);
        }
        if (grow) {
            if ((ispet && mtmp.m_lev < mtmp.data.mlevel + 15)
                || !ispet)
                grow_up(mtmp, null);
        }
        if (mstone) {
            if (poly_when_stoned(mtmp.data)) {
                mon_to_stone(mtmp);
            } else if (!resists_ston(mtmp)) {
                if (vis)
                    pline_mon(mtmp, _("%s turns to stone!"),
                              Monnam(mtmp));
                monstone(mtmp);
            }
        }
        if (heal)
            healmon(mtmp, mtmp.mhpmax, 0);
        if ((eyes || heal) && !mtmp.mcansee)
            mcureblindness(mtmp, canseemon(mtmp));
        if (ispet && deadmimic)
            quickmimic(mtmp);
        if (otmp.otyp == EGG && corpsenm == PM_PYROLISK)
            explode(mtmp.mx, mtmp.my, -11, d(3, 6), 0, EXPL_FIERY);
        if (corpsenm != NON_PM)
            mon_givit(mtmp, mons[corpsenm]);
    }
}

/*
 * Maybe eat a metallic object (not just gold).
 * Return value: 0 => nothing happened, 1 => monster ate something,
 * 2 => monster died (it must have grown into a genocided form, but
 * that can't happen at present because nothing which eats objects
 * has young and old forms).
 */
export function meatmetal(mtmp) { /* int */
    let otmp;
    let otmpname;
    let vis = canseemon(mtmp);

    /* If a pet, eating is handled separately, in dog.c */
    if (mtmp.mtame)
        return 0;

    /* Eats topmost metal object if it is there */
    for (otmp = svl.level.objects[mtmp.mx][mtmp.my]; otmp;
         otmp = otmp.v.v_nexthere) {
        /* Don't eat indigestible/choking/inappropriate objects */
        if ((mtmp.data == mons[PM_RUST_MONSTER] && !is_rustprone(otmp))
            || (otmp.otyp == AMULET_OF_STRANGULATION
                || otmp.otyp == RIN_SLOW_DIGESTION)
            || (otmp.otrapped && !resists_poison(mtmp)))
            continue;
        if (is_metallic(otmp) && !obj_resists(otmp, 5, 95)
            && touch_artifact(otmp, mtmp)) {
            if (mtmp.data == mons[PM_RUST_MONSTER] && otmp.oerodeproof) {
                if (vis) {
                    /* call distant_name() for its side-effects even when
                       !verbose so won't be printed */
                    otmpname = distant_name(otmp, doname);
                    if (flags.verbose)
                        pline_mon(mtmp, _("%s eats %s!"),
                                  Monnam(mtmp), otmpname);
                }
                /* The object's rustproofing is gone now */
                otmp.oerodeproof = 0;
                mtmp.mstun = 1;
                if (vis) {
                    /* (see above; format even if it won't be printed) */
                    otmpname = distant_name(otmp, doname);
                    if (flags.verbose)
                        pline_mon(mtmp, _("%s spits %s out in disgust!"),
                              Monnam(mtmp), otmpname);
                }
            } else {
                if (cansee(mtmp.mx, mtmp.my)) {
                    /* (see above; format even if it won't be printed) */
                    otmpname = distant_name(otmp, doname);
                    if (flags.verbose)
                        pline_mon(mtmp, _("%s eats %s!"),
                                  Monnam(mtmp), otmpname);
                } else {
                    if (flags.verbose) {
                         ;
                        You_hear(_("a crunching sound."));
                    }
                }
                mtmp.meating = int(unsigned(Math.trunc(otmp.owt / 2) + 1));
                m_consume_obj(mtmp, otmp);
                if (DEADMONSTER(mtmp))
                    return 2;
                /* Left behind a pile? */
                if (rnd(25) < 3)
                    mksobj_at(ROCK, mtmp.mx, mtmp.my, TRUE, FALSE);
                newsym(mtmp.mx, mtmp.my);
                return 1;
            }
        }
    }
    return 0;
}

/* monster eats a pile of objects */
export function meatobj(mtmp) { /* int */ /* for gelatinous cubes */
    const $frame = stack_frame(); try {
    let otmp, otmp2;
    let ptr, original_ptr = mtmp.data;
    let count = 0, ecount = 0;
    let buf = stack_array(char, BUFSZ), otmpname;

    chars[buf + 0] = ord('\0');
    /* If a pet, eating is handled separately, in dog.c */
    if (mtmp.mtame)
        return 0;

    /* eat organic objects, including cloth and wood, if present;
       engulf others, except huge rocks and metal attached to player
       [despite comment at top, doesn't assume that eater is a g-cube] */
    for (otmp = svl.level.objects[mtmp.mx][mtmp.my]; otmp; otmp = otmp2) {
        otmp2 = otmp.v.v_nexthere;

        /* avoid special items; once hero picks them up, they'll cease
           being special, becoming eligible for engulf and devore if
           dropped again */
        if (is_mines_prize(otmp) || is_soko_prize(otmp))
            continue;

        /* touch sensitive items */
        if (otmp.otyp == CORPSE && is_rider(mons[otmp.corpsenm])) {
            let ox = otmp.ox, oy = otmp.oy;
            let revived_it = revive_corpse(otmp);

            newsym(ox, oy);
            /* Rider corpse isn't just inedible; can't engulf it either */
            if (!revived_it)
                continue;
            /* [should check whether revival forced 'mtmp' off the level
               and return 3 in that situation (if possible...)] */
            break;

        /* untouchable (or inaccessible) items */
        } else if ((otmp.otyp == CORPSE
                    && touch_petrifies(mons[otmp.corpsenm])
                    && !resists_ston(mtmp))
                   /* don't engulf boulders and statues or ball&chain */
                   || otmp.oclass == ROCK_CLASS
                   || otmp == uball || otmp == uchain
                   /* normally mtmp won't have stepped onto scare monster
                      scroll, but if it does, don't eat or engulf that
                      (note: scrolls inside eaten containers will still
                      become engulfed) */
                   || otmp.otyp == SCR_SCARE_MONSTER) {
            /* do nothing--neither eaten nor engulfed */
            continue;

        /* inedible items -- engulf these */
        } else if (!is_organic(otmp) || obj_resists(otmp, 5, 95)
                   || !touch_artifact(otmp, mtmp)
                   /* redundant due to non-organic composition but
                      included for emphasis */
                   || (otmp.otyp == AMULET_OF_STRANGULATION
                       || otmp.otyp == RIN_SLOW_DIGESTION)
                   || (otmp.otrapped && !resists_poison(mtmp))
                   /* cockatrice corpses handled above; this
                      touch_petrifies() check catches eggs */
                   || (mstoning(otmp) && !resists_ston(mtmp))
                   || (otmp.otyp == GLOB_OF_GREEN_SLIME
                       && !slimeproof(mtmp.data))) {
            /* engulf */
            ++ecount;
            /* call distant_name() for its possible side-effects even if
               the result won't be printed */
            otmpname = distant_name(otmp, doname);
            if (ecount == 1)
                sprintf(buf, _("%s engulfs %s."), Monnam(mtmp), otmpname);
            else if (ecount == 2)
                sprintf(buf, _("%s engulfs several objects."), Monnam(mtmp));
            obj_extract_self(otmp);
            mpickobj(mtmp, otmp); /* slurp */

        /* lastly, edible items; yum! */
        } else {
            /* devour */
            ++count;
            if (cansee(mtmp.mx, mtmp.my)) {
                /* (see above; distant_name() sometimes has side-effects */
                otmpname = distant_name(otmp, doname);
                if (flags.verbose)
                    pline_mon(mtmp, _("%s eats %s!"),
                              Monnam(mtmp), otmpname);
                /* give this one even if !verbose */
                if (otmp.oclass == SCROLL_CLASS
                    && objdescr_is(otmp, _("YUM YUM")))
                    pline(_("Yum%c"), otmp.blessed ? ord('!') : ord('.'));
            } else {
                 ;
                if (flags.verbose)
                    You_hear(_("a slurping sound."));
            }
            m_consume_obj(mtmp, otmp);
            /* in case it polymorphed or died */
            ptr = mtmp.data;
            if (ptr != original_ptr)
                return !ptr ? 2 : 1;
        }

        /* Engulf & devour is instant, so don't set meating */
        if (mtmp.minvis)
            newsym(mtmp.mx, mtmp.my);
    }

    if (ecount > 0) {
        if (cansee(mtmp.mx, mtmp.my) && flags.verbose && chars[buf + 0])
            pline1(buf);
        else if (flags.verbose)
            You_hear(_("%s slurping sound%s."),
                     (ecount == 1) ? _("a") : _("several"), plur(ecount));
    }
    return (count > 0 || ecount > 0) ? 1 : 0;
    } finally { stack_pop($frame); }
}

/* Monster eats a corpse off the ground.
   Return value is 0 = nothing eaten, 1 = ate a corpse, 2 = died. */
export function meatcorpse(
    mtmp) { /* int */ /* for purple worms and other voracious monsters */
    let otmp;
    let ptr, original_ptr = mtmp.data, corpsepm;
    let x = mtmp.mx, y = mtmp.my;

    /* if a pet, eating is handled separately, in dog.c */
    if (mtmp.mtame)
        return 0;

    /* skips past any globs */
    for (otmp = sobj_at(CORPSE, x, y); otmp;
         /* won't get back here if otmp is split or gets used up */
         otmp = nxtobj(otmp, CORPSE, TRUE)) {
        corpsepm = mons[otmp.corpsenm];
        /* skip some corpses */
        if (vegan(corpsepm) /* ignore veggy corpse even if omnivorous */
            /* don't eat harmful corpses */
            || (flesh_petrifies(corpsepm) && !resists_ston(mtmp)))
            continue;
        if (is_rider(corpsepm)) {
            let revived_it = revive_corpse(otmp);

            newsym(x, y); /* corpse is gone; mtmp might be too so do this now
                             since we're bypassing the bottom of the loop */
            if (!revived_it)
                continue; /* revival failed? if so, corpse is gone */
            /* Successful Rider revival; unlike skipped corpses, don't
               just move on to next corpse as if nothing has happened.
               [Can Rider revival bump 'mtmp' off level when it's full?
               We ought to return 3 if that happens.] */
            break;
        }

        if (otmp.quan > 1)
            otmp = splitobj(otmp, 1);

        if (cansee(x, y) && canseemon(mtmp)) {
            /* call distant_name() for its possible side-effects even if
               the result won't be printed */
            let otmpname = distant_name(otmp, doname);

            if (flags.verbose)
                pline_mon(mtmp, _("%s eats %s!"),
                          Monnam(mtmp), otmpname);
        } else {
             ;
            if (flags.verbose)
                You_hear(_("a masticating sound."));
        }

        m_consume_obj(mtmp, otmp);
        /* in case it polymorphed or died */
        ptr = mtmp.data;
        if (ptr != original_ptr)
            return !ptr ? 2 : 1;

        /* Engulf & devour is instant, so don't set meating */
        if (mtmp.minvis)
            newsym(x, y);

        return 1;
    }
    return 0;
}

/* give monster property prop */
export function mon_give_prop(mtmp, prop) { /* void */
    let msg = 0;
    let intrinsic = 0; /* MR_* constant */

    /* Pets don't have all the fields that the hero does, so they can't get
       all the same intrinsics.  If it happens to choose strength gain or
       teleport control or whatever, ignore it. */
    switch (prop) {
    case FIRE_RES:
        msg = _("%s shivers slightly.");
        break;
    case COLD_RES:
        msg = _("%s looks quite warm.");
        break;
    case SLEEP_RES:
        msg = _("%s looks wide awake.");
        break;
    case DISINT_RES:
        msg = _("%s looks very firm.");
        break;
    case SHOCK_RES:
        msg = _("%s crackles with static electricity.");
        break;
    case POISON_RES:
        msg = _("%s looks healthy.");
        break;
    default:
        return; /* can't give it */
        break;
    }
    intrinsic = res_to_mr(prop);

    /* Don't give message if it already had this property intrinsically, but
       still do grant the intrinsic if it only had it from mresists.
       Do print the message if it only had this property extrinsically, which
       is why mon_resistancebits isn't used here. */
    if ((mtmp.data.mresists | mtmp.mintrinsics) & intrinsic)
        msg = 0;

    if (intrinsic)
        mtmp.mintrinsics |= intrinsic;

    if (canseemon(mtmp) && msg) {
        pline_mon(mtmp, msg, Monnam(mtmp));
    }
}

/* Maybe give an intrinsic to monster from eating corpse that confers it. */
export function mon_givit(mtmp, ptr) { /* void */
    const $frame = stack_frame(); try {
    let prop = corpse_intrinsic(ptr);
    let vis = canseemon(mtmp);

    if (DEADMONSTER(mtmp))
        return;

    if (ptr == mons[PM_STALKER]) {
        /*
         * Invisible stalker isn't flagged as conferring invisibility
         * so prop is 0.  For hero, eating a stalker corpse confers
         * temporary invisibility if hero is visible.  When already
         * invisible, if confers permanent invisibility and also
         * permanent see invisible.  For monsters, only permanent
         * invisibility is possible; temporary invisibility and see
         * invisible aren't implemented for them.
         *
         * A monster being invisible gains no benefit against other
         * monsters, and an invisible pet when hero can't see invisible
         * is a nuisance at best, so this is probably detrimental.
         * Players will just have to live with it if they want to be
         * able to have pets gain intrinsics from eating corpses.
         */
        if (!mtmp.perminvis || mtmp.invis_blkd) {
            let mtmpbuf = stack_array(char, BUFSZ);

            strcpy(mtmpbuf, Monnam(mtmp));
            mon_set_minvis(mtmp, FALSE);
            if (vis)
                pline_mon(mtmp, _("%s %s."), mtmpbuf,
                      !canspotmon(mtmp) ? _("vanishes")
                      : mtmp.invis_blkd ? _("seems to flicker")
                        : _("becomes invisible"));
        }
        mtmp.mstun = 1; /* no timeout but will eventually wear off */
        return;
    }

    if (prop == 0)
        return; /* no intrinsic from this corpse */

    if (!should_givit(prop, ptr))
        return; /* failed die roll */

    mon_give_prop(mtmp, prop);
    } finally { stack_pop($frame); }
}

export function mpickgold(mtmp) { /* void */
    let gold;
    let mat_idx;

    if ((gold = g_at(mtmp.mx, mtmp.my)) != null) {
        mat_idx = objects[gold.otyp].oc_material;
        obj_extract_self(gold);
        add_to_minv(mtmp, gold);
        if (cansee(mtmp.mx, mtmp.my)) {
            if (flags.verbose && !mtmp.isgd)
                pline_mon(mtmp, _("%s picks up some %s."), Monnam(mtmp),
                         mat_idx == GOLD ? _("gold") : _("money"));
            newsym(mtmp.mx, mtmp.my);
        }
    }
}

/* monster picks up one item stack from the map location they are at */
export function mpickstuff(mtmp) { /* boolean */
    let otmp, otmp2, otmp3;
    let carryamt = 0;

    /* prevent shopkeepers from leaving the door of their shop */
    if (mtmp.isshk && inhishop(mtmp))
        return FALSE;

    /* non-tame monsters normally don't go shopping */
    if (!mtmp.mtame && chars[in_rooms(mtmp.mx, mtmp.my, SHOPBASE)] && rn2(25))
        return FALSE;

    /* item in a pool, but monster can't swim */
    if (!could_reach_item(mtmp, mtmp.mx, mtmp.my))
        return FALSE;

    for (otmp = svl.level.objects[mtmp.mx][mtmp.my]; otmp; otmp = otmp2) {
        otmp2 = otmp.v.v_nexthere;

        /* avoid special items; once hero picks them up, they'll cease
           being special, becoming eligible for normal pickup */
        if (is_mines_prize(otmp) || is_soko_prize(otmp))
            continue;

        /* Nymphs take everything.  Most monsters don't pick up corpses. */
        if (mon_would_take_item(mtmp, otmp)) {
            if (otmp.otyp == CORPSE && mtmp.data.mlet != S_NYMPH
                /* let a handful of corpse types thru to can_carry() */
                && !touch_petrifies(mons[otmp.corpsenm])
                && otmp.corpsenm != PM_LIZARD
                && !acidic(mons[otmp.corpsenm]))
                continue;
            if (!can_touch_safely(mtmp, otmp))
                continue;
            carryamt = can_carry(mtmp, otmp);
            if (carryamt == 0)
                continue;
            /* handle cases where the critter can only get some */
            otmp3 = otmp;
            if (carryamt != otmp.quan) {
                otmp3 = splitobj(otmp, carryamt);
            }
            if (cansee(mtmp.mx, mtmp.my)) {
                /* call distant_name() for its possible side-effects even
                   if the result won't be printed; do it before the extract
                   from floor and subsequent pickup by mtmp */
                let otmpname = distant_name(otmp, doname);

                if (flags.verbose)
                    pline_mon(mtmp, _("%s picks up %s."),
                              Monnam(mtmp), otmpname);
            }
            obj_extract_self(otmp3);      /* remove from floor */
            mpickobj(mtmp, otmp3); /* may merge and free otmp3 */
            /* let them try to equip it on the next turn */
            check_gear_next_turn(mtmp);
            newsym(mtmp.mx, mtmp.my);
            return TRUE; /* pick only one object */
        }
    }
    return FALSE;
}

export function curr_mon_load(mtmp) { /* int */
    let curload = 0;
    let obj;

    for (obj = mtmp.minvent; obj; obj = obj.nobj) {
        if (obj.otyp != BOULDER || !throws_rocks(mtmp.data))
            curload = int(curload + obj.owt);
    }

    return curload;
}

export function max_mon_load(mtmp) { /* int */
    let maxload;

    /* Base monster carrying capacity is equal to human maximum
     * carrying capacity, or half human maximum if not strong.
     * (for a polymorphed player, the value used would be the
     * non-polymorphed carrying capacity instead of max/half max).
     * This is then modified by the ratio between the monster weights
     * and human weights.  Corpseless monsters are given a capacity
     * proportional to their size instead of weight.
     */
    if (!mtmp.data.cwt)
        maxload = Math.trunc((MAX_CARR_CAP * mtmp.data.msize) / MZ_HUMAN);
    else if (!strongmonst(mtmp.data)
             || (strongmonst(mtmp.data) && (mtmp.data.cwt > WT_HUMAN)))
        maxload = Math.trunc((MAX_CARR_CAP * mtmp.data.cwt) / WT_HUMAN);
    else
        maxload = MAX_CARR_CAP; /*strong monsters w/cwt <= WT_HUMAN*/

    if (!strongmonst(mtmp.data))
        maxload = Math.trunc(maxload / 2);

    if (maxload < 1)
        maxload = 1;

    return int(maxload);
}

/* can monster touch object safely? */
export function can_touch_safely(mtmp, otmp) { /* boolean */
    let otyp = otmp.otyp;
    let mdat = mtmp.data;

    if (otyp == CORPSE && touch_petrifies(mons[otmp.corpsenm])
        && !(mtmp.misc_worn_check & W_ARMG) && !resists_ston(mtmp))
        return FALSE;
    if (otyp == CORPSE && is_rider(mons[otmp.corpsenm]))
        return FALSE;
    if (objects[otyp].oc_material == SILVER && mon_hates_silver(mtmp)
        && (otyp != BELL_OF_OPENING || !is_covetous(mdat)))
        return FALSE;
    if (!touch_artifact(otmp, mtmp))
        return FALSE;
    return TRUE;
}

/* for restricting monsters' object-pickup.
 *
 * to support the new pet behavior, this now returns the max # of objects
 * that a given monster could pick up from a pile. frequently this will be
 * otmp->quan, but special cases for 'only one' now exist.
 *
 * this will probably cause very amusing behavior with pets and gold coins.
 *
 * TODO: allow picking up 2-N objects from a pile of N based on weight.
 *       Change from 'int' to 'long' to accommodate big stacks of gold.
 *       Right now we fake it by reporting a partial quantity, but the
 *       likesgold handling m_move results in picking up the whole stack.
 */
export function can_carry(mtmp, otmp) { /* int */
    let iquan, otyp = otmp.otyp, newload = int(otmp.owt);
    let mdat = mtmp.data;
    let nattk = 0;

    if (notake(mdat))
        return 0; /* can't carry anything */

    if (!can_touch_safely(mtmp, otmp))
        return 0;

    /* hostile monsters who like gold will pick up the whole stack;
       tame monsters with hands will pick up the partial stack */
    iquan = (otmp.quan > LARGEST_INT)
               ? 20000 + rn2(LARGEST_INT - 20000 + 1)
               : int(otmp.quan);

    /* monsters without hands can't pick up multiple objects at once
     * unless they have an engulfing attack
     *
     * ...dragons, of course, can always carry gold pieces and gems somehow
     */
    if (iquan > 1) {
        let glomper = FALSE;

        if (mtmp.data.mlet == S_DRAGON
            && (otmp.oclass == COIN_CLASS
                || otmp.oclass == GEM_CLASS))
            glomper = TRUE;
        else
            for (nattk = 0; nattk < NATTK; nattk++)
                if (mtmp.data.mattk[nattk].aatyp == AT_ENGL) {
                    glomper = TRUE;
                    break;
                }
        if ((mtmp.data.mflags1 & M1_NOHANDS) && !glomper)
            return 1;
    }

    /* steeds don't pick up stuff (to avoid shop abuse) */
    if (mtmp == u.usteed)
        return 0;
    if (mtmp.isshk)
        return iquan; /* no limit */
    if (mtmp.mpeaceful && !mtmp.mtame)
        return 0;
    /* otherwise players might find themselves obligated to violate
     * their alignment if the monster takes something they need
     */

    /* special--boulder throwers carry unlimited amounts of boulders */
    if (throws_rocks(mdat) && otyp == BOULDER)
        return iquan;

    /* nymphs deal in stolen merchandise, but not boulders or statues */
    if (mdat.mlet == S_NYMPH)
        return (otmp.oclass == ROCK_CLASS) ? 0 : iquan;

    if (curr_mon_load(mtmp) + newload > max_mon_load(mtmp))
        return 0;

    return iquan;
}

/* is <nx,ny> in direct line with where 'mon' thinks hero is? */
function monlineu(mon, nx, ny) { /* boolean */
    return online2(nx, ny, mon.mux, mon.muy);
}

/* return flags based on monster data, for mfndpos() */
export function mon_allowflags(mtmp) { /* long long */
    let allowflags = 0;
    let can_open = +!(nohands(mtmp.data) || verysmall(mtmp.data));
    let can_unlock = ((can_open && monhaskey(mtmp, TRUE))
                          || mtmp.iswiz || is_rider(mtmp.data) ? 1 : 0);
    let doorbuster = is_giant(mtmp.data);
    /* don't tunnel if on rogue level or if hostile and close enough
       to prefer a weapon; same criteria as in m_move() */
    let can_tunnel = +(tunnels(mtmp.data) && !Is_rogue_level(u.uz));

    if (can_tunnel && needspick(mtmp.data)
        && ((!mtmp.mpeaceful || Conflict())
            && dist2(mtmp.mx, mtmp.my, mtmp.mux, mtmp.muy) <= 8))
        can_tunnel = FALSE;

    if (mtmp.mtame)
        allowflags = or64(allowflags, ALLOW_M | ALLOW_TRAPS | ALLOW_SANCT | ALLOW_SSM);
    else if (mtmp.mpeaceful)
        allowflags = or64(allowflags, ALLOW_SANCT | ALLOW_SSM);
    else
        allowflags = or64(allowflags, ALLOW_U);
    if (Conflict() && !resist_conflict(mtmp))
        allowflags = or64(allowflags, ALLOW_U);
    if (mtmp.isshk)
        allowflags = or64(allowflags, ALLOW_SSM);
    if (mtmp.ispriest)
        allowflags = or64(allowflags, ALLOW_SSM | ALLOW_SANCT);
    if (passes_walls(mtmp.data))
        allowflags = or64(allowflags, (ALLOW_ROCK | ALLOW_WALL));
    if (throws_rocks(mtmp.data) || m_can_break_boulder(mtmp))
        allowflags = or64(allowflags, ALLOW_ROCK);
    if (can_tunnel)
        allowflags = or64(allowflags, ALLOW_DIG);
    if (doorbuster)
        allowflags = or64(allowflags, BUSTDOOR);
    if (can_open)
        allowflags = or64(allowflags, OPENDOOR);
    if (can_unlock)
        allowflags = or64(allowflags, UNLOCKDOOR);
    if (passes_bars(mtmp.data)
        /* restrict engulfer or holder who might try to pass iron bars while
           carrying hero; accept small subset for poly'd hero passes_bars() */
        && (mtmp != u.ustuck || (unsolid(gy.youmonst.data)
                                 || verysmall(gy.youmonst.data))))
        allowflags = or64(allowflags, ALLOW_BARS);

    if (is_minion(mtmp.data) || is_rider(mtmp.data))
        allowflags = or64(allowflags, ALLOW_SANCT);
    /* unicorn may not be able to avoid hero on a noteleport level */
    if (is_unicorn(mtmp.data) && !noteleport_level(mtmp))
        allowflags = or64(allowflags, NOTONL);
    if (is_human(mtmp.data) || mtmp.data == mons[PM_MINOTAUR])
        allowflags = or64(allowflags, ALLOW_SSM);
    if ((is_undead(mtmp.data) && mtmp.data.mlet != S_GHOST)
        || is_vampshifter(mtmp))
        allowflags = or64u(allowflags, NOGARLIC);

    return allowflags;
}

/* return TRUE if monster is up in the air/on the ceiling */
export function m_in_air(mtmp) { /* boolean */
    return (is_flyer(mtmp.data)
            || is_floater(mtmp.data)
            || (is_clinger(mtmp.data)
                && has_ceiling(u.uz) && mtmp.mundetected) ? 1 : 0);
}

/* return number of acceptable neighbour positions */
export function mfndpos(
    mon,
    data,
    flag) { /* int */
    var mdat = mon.data;
    var ttmp;
    var x, y, nx, ny;
    var cnt = 0;
    var ntyp;
    var nowtyp;
    var wantpool, poolok, lavaok, nodiag;
    var rockok = FALSE, treeok = FALSE, thrudoor;
    var maxx, maxy;
    var poisongas_ok, in_poisongas;
    var gas_reg;
    var gas_glyph = cmap_to_glyph(S_poisoncloud);

    x = mon.mx;
    y = mon.my;
    nowtyp = uchar(levl()[x][y].typ);

    memset(addr_of(data), 0, sizeof(struct_mfndposdata));

    nodiag = NODIAG(ptr_diff(mdat, mons[0]));
    wantpool = +(mdat.mlet == S_EEL);
    poolok = ((!Is_waterlevel(u.uz) && m_in_air(mon))
              || (is_swimmer(mdat) && !wantpool) ? 1 : 0);
    lavaok = (m_in_air(mon) || likes_lava(mdat) ? 1 : 0);
    if (mdat == mons[PM_FLOATING_EYE]) /* prefers to avoid heat */
        lavaok = FALSE;
    thrudoor = +((flag & (ALLOW_WALL | BUSTDOOR)) != 0);
    poisongas_ok = +(m_poisongas_ok(mon) == M_POISONGAS_OK);
    in_poisongas = +((gas_reg = visible_region_at(x,y)) != null
                    && gas_reg.glyph == gas_glyph);

    if (flag & ALLOW_DIG) {
        var mw_tmp;

        /* need to be specific about what can currently be dug */
        if (!needspick(mdat)) {
            rockok = treeok = TRUE;
        } else if ((mw_tmp = MON_WEP(mon)) && mw_tmp.cursed
                   && mon.weapon_check == NO_WEAPON_WANTED) {
            rockok = is_pick(mw_tmp);
            treeok = is_axe(mw_tmp);
        } else {
            rockok = (m_carrying(mon, PICK_AXE)
                      || (m_carrying(mon, DWARVISH_MATTOCK)
                          && !which_armor(mon, W_ARMS)) ? 1 : 0);
            treeok = (m_carrying(mon, AXE) || (m_carrying(mon, BATTLE_AXE)
                                               && !which_armor(mon, W_ARMS)) ? 1 : 0);
        }
        if (rockok || treeok)
            thrudoor = TRUE;
    }

 nexttry: for (;;) { /* eels prefer the water, but if there is no water nearby,
             they will crawl over land */
    if (mon.mconf) {
        flag = or64(flag, ALLOW_ALL);
        flag = and64(flag, ~NOTONL);
    }
    if (!mon.mcansee)
        flag = or64(flag, ALLOW_SSM);
    maxx = min(x + 1, COLNO - 1);
    maxy = min(y + 1, ROWNO - 1);
    for (nx = max(1, x - 1); nx <= maxx; nx++)
        for (ny = max(0, y - 1); ny <= maxy; ny++) {
            if (nx == x && ny == y)
                continue;
            ntyp = uchar(levl()[nx][ny].typ);
            if (IS_OBSTRUCTED(ntyp)
                && !((flag & ALLOW_WALL) && may_passwall(nx, ny))
                && !((IS_TREE(ntyp) ? treeok : rockok) && may_dig(nx, ny)))
                continue;
            /* intelligent peacefuls avoid digging shop/temple walls */
            if (IS_OBSTRUCTED(ntyp) && rockok
                && !mindless(mon.data) && (mon.mpeaceful || mon.mtame)
                && (chars[in_rooms(nx, ny, TEMPLE)] || chars[in_rooms(nx, ny, SHOPBASE)])
                && !(chars[in_rooms(x, y, TEMPLE)] || chars[in_rooms(x, y, SHOPBASE)]))
                continue;
            if (IS_WATERWALL(ntyp) && !is_swimmer(mdat))
                continue;
            /* KMH -- Added iron bars */
            if (ntyp == IRONBARS
                && (!(flag & ALLOW_BARS)
                    || ((levl()[nx][ny].flags & W_NONDIGGABLE)
                        && (dmgtype(mdat, AD_RUST)
                            || dmgtype(mdat, AD_CORR)))))
                continue;
            if (IS_DOOR(ntyp)
                /* an amorphous creature can only move under/through a
                   closed door if it doesn't currently have hero engulfed */
                && !((amorphous(mdat) || can_fog(mon)) && !engulfing_u(mon))
                && (((levl()[nx][ny].flags & D_CLOSED) && !(flag & OPENDOOR))
                    || ((levl()[nx][ny].flags & D_LOCKED)
                        && !(flag & UNLOCKDOOR))) && !thrudoor)
                continue;
            /* avoid poison gas? */
            if (!poisongas_ok && !in_poisongas
                && (gas_reg = visible_region_at(nx,ny)) != null
                && gas_reg.glyph == gas_glyph)
                continue;
            /* first diagonal checks (tight squeezes handled below) */
            if (nx != x && ny != y
                && (nodiag
                    || (IS_DOOR(nowtyp) && (levl()[x][y].flags & ~D_BROKEN))
                    || (IS_DOOR(ntyp) && (levl()[nx][ny].flags & ~D_BROKEN))
                    || ((IS_DOOR(nowtyp) || IS_DOOR(ntyp))
                        && Is_rogue_level(u.uz))
                    /* mustn't pass between adjacent long worm segments,
                       but can attack that way */
                    || (m_at(x, ny) && m_at(nx, y) && worm_cross(x, y, nx, ny)
                        && !m_at(nx, ny) && (nx != u.ux || ny != u.uy))))
                continue;
            if ((!lavaok || !(flag & ALLOW_WALL)) && ntyp == LAVAWALL)
                continue;
            if ((poolok || is_pool(nx, ny) == wantpool)
                && (lavaok || !is_lava(nx, ny))) {
                var dispx, dispy;
                var monseeu = (mon.mcansee
                                   && (!Invis() || perceives(mdat)) ? 1 : 0);
                var checkobj = OBJ_AT(nx, ny);

                /* Displacement also displaces the Elbereth/scare monster,
                 * as long as you are visible.
                 */
                if (Displaced() && monseeu
                    && mon.mux == nx && mon.muy == ny) {
                    dispx = u.ux;
                    dispy = u.uy;
                } else {
                    dispx = nx;
                    dispy = ny;
                }

                data.info[cnt] = 0;
                if (onscary(dispx, dispy, mon)) {
                    if (!(flag & ALLOW_SSM))
                        continue;
                    data.info[cnt] = or64(data.info[cnt], ALLOW_SSM);
                }
                if (u_at(nx, ny)
                    || (nx == mon.mux && ny == mon.muy)) {
                    if (u_at(nx, ny)) {
                        /* If it's right next to you, it found you,
                         * displaced or no.  We must set mux and muy
                         * right now, so when we return we can tell
                         * that the ALLOW_U means to attack _you_ and
                         * not the image.
                         */
                        mon.mux = u.ux;
                        mon.muy = u.uy;
                    }
                    if (!(flag & ALLOW_U))
                        continue;
                    data.info[cnt] = or64(data.info[cnt], ALLOW_U);
                } else {
                    if (MON_AT(nx, ny)) {
                        var mtmp2 = m_at(nx, ny);
                        var mmflag = or64(flag, mm_aggression(mon, mtmp2));

                        if (mmflag & ALLOW_M) {
                            data.info[cnt] = or64(data.info[cnt], ALLOW_M);
                            if (mtmp2.mtame) {
                                if (!(mmflag & ALLOW_TM))
                                    continue;
                                data.info[cnt] = or64(data.info[cnt], ALLOW_TM);
                            }
                        } else {
                            flag = and64(flag, ~ALLOW_MDISP); /* depends upon defender */
                            mmflag = or64(flag, mm_displacement(mon, mtmp2));
                            if (!(mmflag & ALLOW_MDISP))
                                continue;
                            data.info[cnt] = or64(data.info[cnt], ALLOW_MDISP);
                        }
                    }
                    /* Note: ALLOW_SANCT only prevents movement, not
                       attack, into a temple. */
                    if (svl.level.flags.has_temple
                        && chars[in_rooms(nx, ny, TEMPLE)]
                        && !chars[in_rooms(x, y, TEMPLE)]
                        && in_your_sanctuary(null, nx, ny)) {
                        if (!(flag & ALLOW_SANCT))
                            continue;
                        data.info[cnt] = or64(data.info[cnt], ALLOW_SANCT);
                    }
                }
                if (checkobj && sobj_at(CLOVE_OF_GARLIC, nx, ny)) {
                    if (flag & NOGARLIC)
                        continue;
                    data.info[cnt] = or64u(data.info[cnt], NOGARLIC);
                }
                if (checkobj && sobj_at(BOULDER, nx, ny)) {
                    if (!(flag & ALLOW_ROCK))
                        continue;
                    data.info[cnt] = or64(data.info[cnt], ALLOW_ROCK);
                }
                if (monseeu && monlineu(mon, nx, ny)) {
                    if (flag & NOTONL)
                        continue;
                    data.info[cnt] = or64(data.info[cnt], NOTONL);
                }
                /* check for diagonal tight squeeze */
                if (nx != x && ny != y && bad_rock(mdat, x, ny)
                    && bad_rock(mdat, nx, y) && cant_squeeze_thru(mon))
                    continue;
                /* The monster avoids a particular type of trap if it's
                 * familiar with the trap type.  Pets get ALLOW_TRAPS
                 * and checking is done in dogmove.c.  In either case,
                 * "harmless" traps are neither avoided nor marked in info[].
                 */
                if ((ttmp = t_at(nx, ny)) != null) {
                    if (ttmp.ttyp >= TRAPNUM || ttmp.ttyp == 0) {
                        impossible(_("A monster looked at a very strange trap" +
                                   " of type %d."),
                                   ttmp.ttyp);
                            continue;
                    }
                    /* fixed-destination teleport trap, was used by hero */
                    if (fixed_tele_trap(ttmp) && hastrack(nx, ny))
                        data.info[cnt] = or64(data.info[cnt], ALLOW_TRAPS);
                    else if (!m_harmless_trap(mon, ttmp)) {
                        if (!(flag & ALLOW_TRAPS)) {
                            if (mon_knows_traps(mon, ttmp.ttyp))
                                continue;
                        }
                        data.info[cnt] = or64(data.info[cnt], ALLOW_TRAPS);
                    }
                }
                data.poss[cnt].x = nx;
                data.poss[cnt].y = ny;
                cnt++;
            }
        }
    if (!cnt && wantpool && !is_pool(x, y)) {
        wantpool = FALSE;
        continue nexttry;
    } break; }
    data.cnt = cnt;
    return cnt;
}

/* Part of mm_aggression that represents two-way aggression.  To avoid
   having to code each case twice, this function contains those cases that
   ought to happen twice, and mm_aggression will call it twice. */
function mm_2way_aggression(magr, mdef) { /* long long */
    if (On_W_tower_level(u.uz)) {
        /* treat inside the Wizard's tower as if it were a separate level
           from outside so when hero is inside Wizard's tower, both monsters
           need to be too; when outside, the monsters need to be too */
        if (In_W_tower(u.ux, u.uy, u.uz)
            ? (!In_W_tower(magr.mx, magr.my, u.uz)
               || !In_W_tower(mdef.mx, mdef.my, u.uz))
            : (In_W_tower(magr.mx, magr.my, u.uz)
               || In_W_tower(mdef.mx, mdef.my, u.uz)))
            return 0;
    }
    /* liches/zombies vs things that can be zombified

       Note: avoid this on the Castle level, partly for balance reasons
       (the monster-versus-monster fights clear out significant portions of
       the Castle and make it easier than it should be), partly for flavor
       reasons (monsters who attacked other monsters to zombify them would
       have been counterattacked to death long before the hero arrived).

       Also don't include unique monsters in this, otherwise it leads to
       them waking up early (e.g. because a zombie decided to attack the
       Wizard of Yendor). */
    if (zombie_maker(magr) && zombie_form(mdef.data) != NON_PM) {
        if (magr.mgenmklev && mdef.mgenmklev)
            return 0;
        if (!Is_stronghold(u.uz)
            && !unique_corpstat(magr.data) && !unique_corpstat(mdef.data))
            return (ALLOW_M | ALLOW_TM);
    }
    return 0;
}

/* Monster against monster special attacks; for the specified monster
   combinations, this allows one monster to attack another adjacent one
   in the absence of Conflict.  There is no provision for targeting
   other monsters; just hand to hand fighting when they happen to be
   next to each other. */
function mm_aggression(
    magr,
    mdef) { /* long long */ /* another monster which is next to it */
    let mndx = monsndx(magr.data);

    /* don't allow pets to fight each other */
    if (magr.mtame && mdef.mtame)
        return 0;

    /* supposedly purple worms are attracted to shrieking because they
       like to eat shriekers, so attack the latter when feasible */
    if ((mndx == PM_PURPLE_WORM || mndx == PM_BABY_PURPLE_WORM)
        && mdef.data == mons[PM_SHRIEKER])
        return ALLOW_M | ALLOW_TM;
    /* Various other combinations such as dog vs cat, cat vs rat, and
       elf vs orc have been suggested.  For the time being we don't
       support those. */
    return or64(mm_2way_aggression(magr, mdef), mm_2way_aggression(mdef, magr));
}

/* Monster displacing another monster out of the way */
function mm_displacement(
    magr,
    mdef) { /* long long */ /* another monster which is next to it */
    let pa = magr.data, pd = mdef.data;

    /* if attacker can't barge through, there's nothing to do;
       or if defender can barge through too and has a level at least
       as high as the attacker, don't let attacker do so, otherwise
       they might just end up swapping places again when defender
       gets its chance to move */
    if (is_displacer(pa) && (!is_displacer(pd) || magr.m_lev > mdef.m_lev)
        /* no displacing grid bugs diagonally */
        && !(magr.mx != mdef.mx && magr.my != mdef.my
             && NODIAG(monsndx(pd)))
        /* no displacing trapped monsters or multi-location longworms */
        && !mdef.mtrapped && (!mdef.wormno || !count_wsegs(mdef))
        /* riders can move anything; others, same size or smaller only */
        && (is_rider(pa) || pa.msize >= pd.msize))
        return ALLOW_MDISP;
    return 0;
}

/* Is the square close enough for the monster to move or attack into? */
export function monnear(mon, x, y) { /* boolean */
    let distance = dist2(mon.mx, mon.my, x, y);

    if (distance == 2 && NODIAG(ptr_diff(mon.data, mons[0])))
        return 0;
    return (+(distance < 3));
}

/* really free dead monsters */
export function dmonsfree() { /* void */
    const $frame = stack_frame(); try {
    let mtmp, freetmp;
    let count = 0;
    let buf = stack_array(char, QBUFSZ);

    chars[buf + 0] = ord('\0');
    for (mtmp = ref_of(svl.level, "monlist"); mtmp[0]; ) {
        freetmp = mtmp[0];
        if (DEADMONSTER(freetmp) && !freetmp.isgd) {
            mtmp[0] = freetmp.nmon;
            freetmp.nmon = null;
            dealloc_monst(freetmp);
            count++;
        } else
            mtmp = ref_of(freetmp, "nmon");
    }

    if (count != iflags.purge_monsters) {
        describe_level(buf, 2);
        impossible(_("dmonsfree: %d removed doesn't match %d pending on %s"),
                   count, iflags.purge_monsters, buf);
    }
    iflags.purge_monsters = 0;
    } finally { stack_pop($frame); }
}

/* called when monster is moved to larger structure */
export function replmon(mtmp, mtmp2) { /* void */
    let otmp;

    /* transfer the monster's inventory */
    for (otmp = mtmp2.minvent; otmp; otmp = otmp.nobj) {
        if (otmp.where != OBJ_MINVENT || otmp.v.v_ocarry != mtmp)
            impossible(_("replmon: minvent inconsistency"));
        otmp.v.v_ocarry = mtmp2;
    }
    mtmp.minvent = null;
    /* before relmon(mtmp), because it could clear polearm.hitmon */
    if (svc.context.polearm.hitmon == mtmp)
        svc.context.polearm.hitmon = mtmp2;

    /* remove the old monster from the map and from `fmon' list */
    relmon(mtmp, null);

    /* finish adding its replacement */
    if (mtmp != u.usteed) /* don't place steed onto the map */
        place_monster(mtmp2, mtmp2.mx, mtmp2.my);
    if (mtmp2.wormno)      /* update level.monsters[wseg->wx][wseg->wy] */
        place_wsegs(mtmp2, mtmp); /* locations to mtmp2 not mtmp. */
    if (emits_light(mtmp2.data)) {
        /* since this is so rare, we don't have any `mon_move_light_source' */
        new_light_source(mtmp2.mx, mtmp2.my, emits_light(mtmp2.data),
                         LS_MONSTER, monst_to_any(mtmp2));
        /* here we rely on fact that `mtmp' hasn't actually been deleted */
        del_light_source(LS_MONSTER, monst_to_any(mtmp));
    }
    mtmp2.nmon = fmon();
    svl.level.monlist = mtmp2;
    if (u.ustuck == mtmp)
        set_ustuck(mtmp2);
    if (u.usteed == mtmp)
        u.usteed = mtmp2;
    if (mtmp2.isshk)
        replshk(mtmp, mtmp2);

    /* discard the old monster */
    dealloc_monst(mtmp);
}

/* release mon from the display and the map's monster list,
   maybe transfer it to one of the other monster lists */
export function relmon(
    mon,
    monst_list) { /* void */ /* &gm.migrating_mons or &gm.mydogs or null */
    if (!fmon())
        panic(_("relmon: no fmon available."));

    /* take 'mon' off the map */
    mon_leaving_level(mon);

    /* remove 'mon' from the 'fmon' list */
    if (mon == fmon()) {
        svl.level.monlist = fmon().nmon;
    } else {
        let mtmp;

        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
            if (mtmp.nmon == mon) {
                mtmp.nmon = mon.nmon;
                break;
            }
        if (!mtmp)
            panic(_("relmon: mon not in list."));
    }

    if (monst_list) {
        /* insert into gm.mydogs or gm.migrating_mons */
        mon.nmon = monst_list[0];
        monst_list[0] = mon;
    } else {
        /* orphan has no next monster */
        mon.nmon = null;
    }
}

export function copy_mextra(mtmp2, mtmp1) { /* void */
    if (!mtmp2 || !mtmp1 || !mtmp1.mextra)
        return;

    if (!mtmp2.mextra)
        mtmp2.mextra = newmextra();
    if (MGIVENNAME(mtmp1)) {
        new_mgivenname(mtmp2, int(strlen(MGIVENNAME(mtmp1))) + 1);
        strcpy(MGIVENNAME(mtmp2), MGIVENNAME(mtmp1));
    }
    if (EGD(mtmp1)) {
        if (!EGD(mtmp2))
            newegd(mtmp2);
        assert(has_egd(mtmp2));
        struct_assign(EGD(mtmp2), EGD(mtmp1));
    }
    if (EPRI(mtmp1)) {
        if (!EPRI(mtmp2))
            newepri(mtmp2);
        assert(has_epri(mtmp2));
        struct_assign(EPRI(mtmp2), EPRI(mtmp1));
    }
    if (ESHK(mtmp1)) {
        if (!ESHK(mtmp2))
            neweshk(mtmp2);
        assert(has_eshk(mtmp2));
        struct_assign(ESHK(mtmp2), ESHK(mtmp1));
    }
    if (EMIN(mtmp1)) {
        if (!EMIN(mtmp2))
            newemin(mtmp2);
        assert(has_emin(mtmp2));
        struct_assign(EMIN(mtmp2), EMIN(mtmp1));
    }
    if (EDOG(mtmp1)) {
        if (!EDOG(mtmp2))
            newedog(mtmp2);
        assert(has_edog(mtmp2));
        struct_assign(EDOG(mtmp2), EDOG(mtmp1));
    }
    if (EBONES(mtmp1)) {
        if (!EBONES(mtmp2))
            newebones(mtmp2);
        assert(has_ebones(mtmp2));
        struct_assign(EBONES(mtmp2), EBONES(mtmp1));
    }
    if (has_mcorpsenm(mtmp1))
        ((mtmp2).mextra.mcorpsenm) = MCORPSENM(mtmp1);
}

export function dealloc_mextra(m) { /* void */
    let x = m.mextra;

    if (x) {
        if (x.mgivenname)
            free(x.mgivenname), x.mgivenname = 0;
        if (x.egd)
            free(addr_of(x.egd)), x.egd = null;
        if (x.epri)
            free(addr_of(x.epri)), x.epri = null;
        if (x.eshk)
            free(addr_of(x.eshk)), x.eshk = null;
        if (x.emin)
            free(addr_of(x.emin)), x.emin = null;
        if (x.edog)
            free(addr_of(x.edog)), x.edog = null;
        if (x.ebones)
            free(addr_of(x.ebones)), x.ebones = null;
        x.mcorpsenm = NON_PM; /* no allocation to release */

        free(addr_of(x));
        m.mextra = null;
    }
}

export function dealloc_monst(mon) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, QBUFSZ);

    chars[buf + 0] = ord('\0');
    if (mon.nmon) {
        describe_level(buf, 2);
        panic(_("dealloc_monst with nmon on %s"), buf);
    }
    if (mon.mextra)
        dealloc_mextra(mon);
    /* clear out of date information contained in the about-to-become
       stale memory; see dealloc_obj() */
    struct_assign(mon, cg.zeromonst);
    free(addr_of(mon));
    } finally { stack_pop($frame); }
}

/* 'mon' is being removed from level due to migration [relmon from keepdogs
   or migrate_to_level] or due to death [m_detach from mondead or mongone] */
function mon_leaving_level(mon) { /* void */
    let mx = mon.mx, my = mon.my;
    let onmap = (isok(mx, my) && svl.level.monsters[mx][my] == mon ? 1 : 0);

    /* to prevent an infinite relobj-flooreffects-hmon-killed loop */
    mon.mtrapped = 0;
    unstuck(mon); /* mon is not swallowing or holding you nor held by you */

    /* vault guard might be at <0,0> */
    if (onmap || mon == svl.level.monsters[0][0]) {
        if (mon.wormno)
            remove_worm(mon);
        else
            remove_monster(mx, my);
    }
    if (onmap) {
        mon.mundetected = 0; /* for migration; doesn't matter for death */
        /* unhide mimic in case its shape has been blocking line of sight
           or it is accompanying the hero to another level */
        if (M_AP_TYPE(mon) != M_AP_NOTHING && M_AP_TYPE(mon) != M_AP_MONSTER)
            seemimic(mon);
        /* if mon is pinned by a boulder, removing mon lets boulder drop */
        fill_pit(mx, my);
        newsym(mx, my);
    }
    /* if mon is a remembered target, forget it since it isn't here anymore */
    if (mon == svc.context.polearm.hitmon)
        svc.context.polearm.hitmon = null;
}

/* 'mtmp' is going away; remove effects of mtmp from other data structures */
function m_detach(
    mtmp,
    mptr,
    due_to_death) { /* void */
    let mx = mtmp.mx, my = mtmp.my;

    if (mtmp.mleashed)
        m_unleash(mtmp, FALSE);

    if (mx > 0 && emits_light(mptr))
        del_light_source(LS_MONSTER, monst_to_any(mtmp));

    /*
     * Take mtmp off map but not out of fmon list yet (dmonsfree does that).
     *
     * Sequencing issue:  mtmp's inventory should be dropped before taking
     * it off the map but if that includes a boulder and mtmp is at a pit
     * location, dropping minvent ought to be deferred until its corpse
     * gets placed.  We compromise and just make sure mtmp is off the map
     * before dropping its former belongings.
     */
    mon_leaving_level(mtmp);

    mtmp.mhp = 0; /* simplify some tests: force mhp to 0 */
    /* death handling for the Wizard needs to take place even if he is
       leaving the dungeon alive rather than dying */
    if (mtmp.iswiz)
        wizdeadorgone();
    /* foodead() might give quest feedback for foo having died; skip that
       if we're called for mongone() rather than mondead(); saving bones
       or wizard mode genocide of "*" can result in special monsters going
       away without having been killed */
    if (due_to_death) {
        if (mtmp.data.msound == MS_NEMESIS) {
            nemdead();
            /* The Archeologist, Caveman, and Priest quest texts describe
               the nemesis's body creating noxious fumes/gas when killed. */
            if (stinky_nemesis(mtmp))
                nemesis_stinks(mx, my);
        }
        if (mtmp.data.msound == MS_LEADER)
            leaddead();
        /* release (drop onto map) all objects carried by mtmp; assumes that
           mtmp->mx,my contains the appropriate location */
        relobj(mtmp, 1, FALSE); /* drop mtmp->minvent, issue newsym(mx,my) */
    }

    if (mtmp.m_id == gs.stealmid)
        thiefdead(); /* reset theft-in-progress data */
    if (mtmp.isshk)
        shkgone(mtmp);
    if (mtmp.wormno)
        wormgone(mtmp);
    if (In_endgame(u.uz))
        mtmp.mstate = or64(mtmp.mstate, MON_ENDGAME_FREE);

    if ((mtmp.mstate & MON_DETACH) != 0) {
        impossible(_("m_detach: %s is already detached?"),
                   minimal_monnam(mtmp, FALSE));
    } else {
        mtmp.mstate = or64(mtmp.mstate, MON_DETACH);
        iflags.purge_monsters++;
    }

    /* hero is thrown from his steed when it dies or gets genocided */
    if (mtmp == u.usteed)
        dismount_steed(DISMOUNT_GENERIC);
    return;
}

/* give a life-saved monster a reasonable mhpmax value in case it has
   been the victim of excessive life draining */
function set_mon_min_mhpmax(
    mon,
    minimum_mhpmax) { /* void */ /* monster life-saving has traditionally used 10 */
    /* can't be less than m_lev+1 (if we just used m_lev itself, level 0
       monsters would end up allowing a minimum of 0); since life draining
       reduces m_lev, this usually won't give the monster much of a boost */
    if (mon.mhpmax < mon.m_lev + 1)
        mon.mhpmax = mon.m_lev + 1;
    /* caller can specify an alternate minimum; we'll honor it iff it is
       greater than m_lev+1; the traditional arbitrary value of 10 always
       gives level 0 and level 1 monsters a boost and has a moderate
       chance of doing so for level 2, a tiny chance for levels 3..9 */
    if (mon.mhpmax < minimum_mhpmax)
        mon.mhpmax = minimum_mhpmax;
}

/* find the worn amulet of life saving which will save a monster */
export function mlifesaver(mon) { /* struct obj * */
    if (!nonliving(mon.data) || is_vampshifter(mon)) {
        let otmp = which_armor(mon, W_AMUL);

        if (otmp && otmp.otyp == AMULET_OF_LIFE_SAVING)
            return otmp;
    }
    return null;
}

function lifesaved_monster(mtmp) { /* void */
    let surviver;
    let lifesave = mlifesaver(mtmp);

    if (lifesave) {
        /* not canseemon; amulets are on the head, so you don't want
         * to show this for a long worm with only a tail visible.
         * Nor do you check invisibility, because glowing and
         * disintegrating amulets are always visible. */
        if (cansee(mtmp.mx, mtmp.my)) {
            pline(_("But wait..."));
            pline(_("%s medallion begins to glow!"), s_suffix(Monnam(mtmp)));
            makeknown(AMULET_OF_LIFE_SAVING);
            /* amulet is visible, but monster might not be */
            if (canseemon(mtmp)) {
                if (attacktype(mtmp.data, AT_EXPL)
                    || attacktype(mtmp.data, AT_BOOM))
                    pline(_("%s reconstitutes!"), Monnam(mtmp));
                else
                    pline(_("%s looks much better!"), Monnam(mtmp));
            }
            pline_The(_("medallion crumbles to dust!"));
        }
        m_useup(mtmp, lifesave);
        /* equip replacement amulet, if any, on next move */
        check_gear_next_turn(mtmp);

        surviver = +!(svm.mvitals[monsndx(mtmp.data)].mvflags & G_GENOD);
        mtmp.mcanmove = 1;
        mtmp.mfrozen = 0;
        if (mtmp.mtame && !mtmp.isminion) {
            wary_dog(mtmp, +!surviver);
        }
        set_mon_min_mhpmax(mtmp, 10); /* mtmp->mhpmax=max(mtmp->m_lev+1,10) */
        mtmp.mhp = mtmp.mhpmax;

        if (!surviver) {
            /* genocided monster can't be life-saved */
            if (cansee(mtmp.mx, mtmp.my))
                pline(_("Unfortunately, %s is still genocided..."),
                      mon_nam(mtmp));
            mtmp.mhp = 0;
        }
    }
}

/* when a shape-shifted vampire is killed, it reverts to base form instead
   of dying; returns True if mtmp successfully revives, False otherwise;
   "successfully revived" vampire might be killed by a booby trapped door */
function vamprises(mtmp) { /* boolean */
    const $frame = stack_frame(); try {
    let mndx = mtmp.cham;

    /*
     * Protection from shape changers protects against this because
     * the vampire will always be in normal form instead of shifted.
     * So there's no need to check for that attribute being active.
     */
    if (ismnum(mndx) && mndx != monsndx(mtmp.data)
        && !(svm.mvitals[mndx].mvflags & G_GENOD)) {
        let action = stack_array(char, BUFSZ);
        /* alternate message phrasing for some monster types */
        let spec_mon = +(nonliving(mtmp.data)
                            || noncorporeal(mtmp.data)
                            || amorphous(mtmp.data)),
                spec_death = (gd.disintegested /* disintegrated/digested */
                              || noncorporeal(mtmp.data)
                              || amorphous(mtmp.data) ? 1 : 0);
        let x = mtmp.mx, y = mtmp.my;

        /* construct a 'before' argument to pass to pline(); this used
           to construct a dynamic format string but that's overkill */
        Snprintf(action, sizeof(array_of(char, BUFSZ)), _("%s%s %s%s and rises as"), Unaware() ? _("you dream that ") : _(""), x_monnam(mtmp, ARTICLE_THE,
                          spec_mon ? 0 : _("seemingly dead"),
                          (SUPPRESS_INVISIBLE | AUGMENT_IT), FALSE), Unaware() ? _("") : _("suddenly "), spec_death ? _("reconstitutes") : _("transforms"))

;
        mtmp.mcanmove = 1;
        mtmp.mfrozen = 0;
        set_mon_min_mhpmax(mtmp, 10); /* mtmp->mhpmax=max(m_lev+1,10) */
        mtmp.mhp = mtmp.mhpmax;
        /* mtmp==u.ustuck can happen if previously a fog cloud or if
           poly'd hero is hugging a vampire bat */
        if (mtmp == u.ustuck) {
            if (u.uswallow)
                expels(mtmp, mtmp.data, FALSE);
            else
                uunstick();
        }

        if (!newcham(mtmp, mons[mndx], NO_NC_FLAGS))
            return +!DEADMONSTER(mtmp);
        mtmp.cham = (mtmp.data == mons[mndx]) ? NON_PM : mndx;

        if (canspotmon(mtmp)) {
            /* 3.6.0 used a_monnam(mtmp); that was weird if mtmp was
               named: "Dracula suddenly transforms and rises as Dracula";
               3.6.1 used mtmp->data->mname; that ignored hallucination */
            pline_mon(mtmp, _("%s %s!"), upstart(action),
                      x_monnam(mtmp, ARTICLE_A, 0,
                           (SUPPRESS_NAME | SUPPRESS_IT | SUPPRESS_INVISIBLE),
                               FALSE));
            gv.vamp_rise_msg = TRUE;
        }
        /* revived vampire is in normal shape, so can't be amorphous; if on
           a closed door spot, destroy the door and if trapped, blow it up */
        if (closed_door(x, y)) {
            let door_smashed = init_string(static_array("vamprises.door_smashed", char, sizeof_string("a door being smashed")), _("a door being smashed"), true),
                door_go_boom = init_string(static_array("vamprises.door_go_boom", char, sizeof_string("a door exploding")), _("a door exploding"), true);

            let door = levl()[x][y];
            let trapped = +((door.flags & D_TRAPPED) != 0),
                    seeit = cansee(x, y);

            set_msg_xy(x, y); /* You()/pline() will reset this */
            if (!seeit)
                You_hear(_("%s."), trapped ? _("an explosion") : door_smashed);
            else if (!canspotmon(mtmp))
                You_see(_("%s."), trapped ? door_go_boom : door_smashed);
            else if (!Unaware())
                pline_The(_("door is smashed%s"),
                          trapped ? _(" and it explodes!") : _("."));
            set_msg_xy(0, 0); /* in case none of the messages was delivered */

            door.flags = D_NODOOR;
            recalc_block_point(x, y);
            if (trapped) {
                let trap_killed, save_verbose = flags.verbose;

                flags.verbose = FALSE; /* suppress mb_trapped() messages
                                        * (that makes the 'seeit' arg moot) */
                trap_killed = mb_trapped(mtmp, seeit);
                flags.verbose = save_verbose;
                /* if the booby trap has killed the monster, mondied() will
                   have been called but no message about its death given yet;
                   mtmp was a vampire so use unconditional "destroyed" */
                if (trap_killed && canspotmon(mtmp) && !Unaware())
                    pline_mon(mtmp, _("%s is destroyed!"), Monnam(mtmp));
            }
        }
        newsym(x, y);
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

/* specific combination of x_monnam flags for livelogging; show what was
   actually killed even when unseen or hallucinated to be something else */
export function livelog_mon_nam(mtmp) { return x_monnam(mtmp, ARTICLE_THE, 0, EXACT_NAME, FALSE); }

/* when a mon has died, maybe record an achievement or issue livelog message;
   moved into separate routine to unclutter mondead() */
function logdeadmon(mtmp, mndx) { /* void */
    const $frame = stack_frame(); try {
    let howmany = svm.mvitals[mndx].died;

    if (mndx == PM_MEDUSA && howmany == 1) {
        record_achievement(ACH_MEDU); /* also generates a livelog event */
    } else if ((unique_corpstat(mtmp.data)
                && (mndx != PM_HIGH_CLERIC || !mtmp.mrevived))
               || (mtmp.isshk && !mtmp.mrevived)) {
        let shkdetail = stack_array(char, QBUFSZ);
        let mkilled;
        let herodidit = +!svc.context.mon_moving;

        /*
         * livelog event; unique_corpstat() includes the Wizard and
         * any High Priest even though they aren't actually unique.
         *
         * Shopkeeper kills are logged, but only the first time per
         * shopkeeper, since their shared kill counter wouldn't work
         * for this purpose (and it wouldn't account for polymorphed
         * shopkeepers either).
         */
        chars[shkdetail + 0] = ord('\0');
        if (mtmp.isshk) {
            howmany = 1;
            /* ", the <shoptype> proprietor" needs a trailing comma for
               the alternate phrasing "<shk>, shkdetails, has been killed"
               when hero isn't directly responsible */
            Snprintf(shkdetail, sizeof(array_of(char, QBUFSZ)), _(", the %s %s%s"), elt(shtypes, ESHK(mtmp).shoptype - SHOPBASE).name, mtmp.female ? _("proprietrix") : _("proprietor"), herodidit ? _("") : _(","))

;
        } else if (mndx == PM_HIGH_CLERIC) {
            /* the high priest[ess] monster is not unique; we know that
               this is the first death for this particular high priest
               (because of the !mtmp->mrevived test above) */
            howmany = 1;
        }

        /* killing a unique more than once doesn't get logged every time;
           the Wizard and the Riders can be killed more than once
           "naturally", others require deliberate player action such as
           use of undead turning to revive a corpse or petrification plus
           stone-to-flesh to create and revive a statue */
        if (howmany <= 3 || howmany == 5 || howmany == 10 || howmany == 25
            || (howmany % 50) == 0) { /* 50, 100, 150, 200, 250 */
            let xtra = stack_array(char, 40); /* space for " (Nth time)" when N > 1 */
            let llevent_type = LL_UMONST;

            /* the first kill of any unique monster is a major event;
               all kills of the Wizard and the Riders are major when
               they're logged but they still don't get logged every time */
            if (howmany == 1 || mtmp.iswiz || is_rider(mtmp.data))
                llevent_type = or64(llevent_type, LL_ACHIEVE);
            chars[xtra + 0] = ord('\0');
            if (howmany > 1) /* "(2nd time)" or "(50th time)" */
                sprintf(xtra, _(" (%d%s time)"), howmany, ordin(howmany));

            mkilled = nonliving(mtmp.data) ? _("destroyed") : _("killed");
            /* hero is responsible: "killed <monst>" */
            if (herodidit)
                livelog_printf(llevent_type, _("%s %s%s%s"),
                               mkilled,
                               livelog_mon_nam(mtmp), shkdetail, xtra);
            else /* trap, pet, conflict:  "<monst> has been killed" */
                livelog_printf(llevent_type, _("%s%s has been %s%s"),
                               livelog_mon_nam(mtmp), shkdetail,
                               mkilled, xtra);
        }
    }
    } finally { stack_pop($frame); }
}

/* anger all the quest guards on the level */
function anger_quest_guardians(mtmp) { /* void */
    if (mtmp.data == mons[gu.urole.guardnum])
        setmangry(mtmp, TRUE);
}

/* monster 'mtmp' has died; maybe life-save, otherwise unshapeshift and
   update vanquished stats and update map */
export function mondead(mtmp) { /* void */
    let mptr;
    let be_sad;
    let mndx;

    /* potential pet message; always clear global flag */
    be_sad = iflags.sad_feeling;
    iflags.sad_feeling = FALSE;

    mtmp.mhp = 0; /* in case caller hasn't done this */
    lifesaved_monster(mtmp);
    if (!DEADMONSTER(mtmp))
        return;

    /* vampire in bat/fog/wolf form reverts to vampire instead of dying */
    if (is_vampshifter(mtmp) && vamprises(mtmp))
        return;

    if (be_sad)
        You(_("have a sad feeling for a moment, then it passes."));

    if (mtmp.data == mons[PM_STEAM_VORTEX])
        create_gas_cloud(mtmp.mx, mtmp.my, rn2(10) + 5, 0); /* harmless */

    /* dead vault guard is actually kept at coordinate <0,0> until
       his temporary corridor to/from the vault has been removed;
       need to do this after life-saving and before m_detach() */
    if (mtmp.isgd && !grddead(mtmp))
        return;

    mptr = mtmp.data; /* save this for m_detach() */
    /* restore chameleon, lycanthropes to true form at death */
    if (ismnum(mtmp.cham)) {
        set_mon_data(mtmp, mons[mtmp.cham]);
        mtmp.cham = NON_PM;
    } else if (mtmp.data == mons[PM_WEREJACKAL])
        set_mon_data(mtmp, mons[PM_HUMAN_WEREJACKAL]);
    else if (mtmp.data == mons[PM_WEREWOLF])
        set_mon_data(mtmp, mons[PM_HUMAN_WEREWOLF]);
    else if (mtmp.data == mons[PM_WERERAT])
        set_mon_data(mtmp, mons[PM_HUMAN_WERERAT]);

    /*
     * svm.mvitals[].died does double duty as total number of dead monsters
     * and as experience factor for the player killing more monsters.
     * this means that a dragon dying by other means reduces the
     * experience the player gets for killing a dragon directly; this
     * is probably not too bad, since the player likely finagled the
     * first dead dragon via ring of conflict or pets, and extinguishing
     * based on only player kills probably opens more avenues of abuse
     * for rings of conflict and such.
     */
    mndx = monsndx(mtmp.data);
    if (svm.mvitals[mndx].died < 255)
        svm.mvitals[mndx].died++;

    /* if it's a (possibly polymorphed) quest leader, mark him as dead */
    if (mtmp.m_id == svq.quest_status.leader_m_id)
        svq.quest_status.leader_is_dead = TRUE;

    /* if the mail daemon dies, no more mail delivery.  -3. */
    if (mndx == PM_MAIL_DAEMON)
        svm.mvitals[mndx].mvflags |= G_GENOD;

    if (mtmp.data.mlet == S_KOP) {
        let stway = stairway_find_type_dir(FALSE, FALSE);

        /* Dead Kops may come back. */
        switch (rnd(5)) {
        case 1: /* returns near the stairs */
            if (stway) {
                makemon(mtmp.data, stway.sx, stway.sy, NO_MM_FLAGS);
                break;
            }
            /* FALLTHROUGH */;
            /* FALLTHRU */
        case 2: /* randomly */
            makemon(mtmp.data, 0, 0, NO_MM_FLAGS);
            break;
        default:
            break;
        }
    }

    /* achievement and/or livelog */
    logdeadmon(mtmp, mndx);

    if (glyph_is_invisible(levl()[mtmp.mx][mtmp.my].glyph))
        unmap_object(mtmp.mx, mtmp.my);

    /* remove 'mtmp' from play; it will stay on the fmon list until end of
       current move, then dmonsfree() will get rid of it */
    m_detach(mtmp, mptr, TRUE);
    return;
}

/* TRUE if corpse might be dropped, magr may die if mon was swallowed */
export function corpse_chance(
    mon,
    magr,
    was_swallowed) { /* boolean */ /* digestion */
    let mdat = mon.data;
    let i, tmp;

    if (!magr && gm.mswallower && attacktype(gm.mswallower.data, AT_ENGL))
        magr = gm.mswallower, was_swallowed = TRUE; /* for gas spore boom */

    if (mdat == mons[PM_VLAD_THE_IMPALER] || mdat.mlet == S_LICH) {
        if (cansee(mon.mx, mon.my) && !was_swallowed)
            pline_mon(mon, _("%s body crumbles into dust."),
                      s_suffix(Monnam(mon)));
        return FALSE;
    }

    /* Gas spores always explode upon death */
    for (i = 0; i < NATTK; i++) {
        if (mdat.mattk[i].aatyp == AT_BOOM) {
            if (mdat.mattk[i].damn)
                tmp = d((mdat.mattk[i].damn), (mdat.mattk[i].damd));
            else if (mdat.mattk[i].damd)
                tmp = d(mdat.mlevel + 1, (mdat.mattk[i].damd));
            else
                tmp = 0;

            if (was_swallowed && magr) {
                /* mdef is a gas spore (AT_BOOM) that is exploding inside an
                   engulfer; suppress usual explosion since it's contained */
                if (magr == gy.youmonst) {
                    There(_("is an explosion in your %s!"), body_part(STOMACH));
                    sprintf(svk.killer.name, _("%s explosion"), s_suffix(pmname(mdat, Mgender(mon))))
;
                    losehp(Maybe_Half_Phys(tmp), svk.killer.name,
                           KILLED_BY_AN);
                } else {
                    You_hear(_("an explosion."));
                    magr.mhp -= tmp;
                    if (DEADMONSTER(magr))
                        mondied(magr);
                    if (DEADMONSTER(magr)) { /* maybe lifesaved */
                        if (canspotmon(magr))
                            pline_mon(magr, _("%s rips open!"), Monnam(magr));
                    } else if (canseemon(magr))
                        pline_mon(magr, _("%s seems to have indigestion."),
                                  Monnam(magr));
                }
                return FALSE;
            }

            mon_explodes(mon, mdat.mattk[i]);
            return FALSE;
        }
    }

    /* must duplicate this below check in xkilled() since it results in
     * creating no objects as well as no corpse
     */
    if (LEVEL_SPECIFIC_NOCORPSE(mdat))
        return FALSE;

    if (((bigmonst(mdat) || mdat == mons[PM_LIZARD]) && !mon.mcloned)
        || is_golem(mdat) || is_mplayer(mdat) || is_rider(mdat) || mon.isshk)
        return TRUE;
    tmp = 2 + +((mdat.geno & G_FREQ) < 2) + verysmall(mdat);
    return (+!rn2(tmp));
}

/* drop (perhaps) a cadaver and remove monster */
export function mondied(mdef) { /* void */
    mondead(mdef);
    if (!DEADMONSTER(mdef))
        return; /* lifesaved */

    /* this assumes that the dead monster's map coordinates remain accurate */
    if (corpse_chance(mdef, null, FALSE)
        && (accessible(mdef.mx, mdef.my) || is_pool(mdef.mx, mdef.my)))
        make_corpse(mdef, CORPSTAT_NONE);
}

/* monster disappears, not dies */
export function mongone(mdef) { /* void */
    mdef.mhp = 0; /* can skip some inventory bookkeeping */

    /* dead vault guard is actually kept at coordinate <0,0> until
       his temporary corridor to/from the vault has been removed */
    if (mdef.isgd && !grddead(mdef))
        return;
    /* stuck to you? release */
    unstuck(mdef);
    /* drop special items like the Amulet so that a dismissed Kop or nurse
       can't remove them from the game */
    mdrop_special_objs(mdef);
    /* release rest of monster's inventory--it is removed from game */
    discard_minvent(mdef, FALSE);
    m_detach(mdef, mdef.data, FALSE);
}

/* drop a statue or rock and remove monster */
export function monstone(mdef) { /* void */
    let otmp, obj, oldminvent;
    let x = mdef.mx, y = mdef.my;
    let wasinside = FALSE;

    /* vampshifter reverts to vampire;
       3.6.3: also used to unshift shape-changed sandestin */
    if (!vamp_stone(mdef))
        return;

    /* we have to make the statue before calling mondead, to be able to
     * put inventory in it, and we have to check for lifesaving before
     * making the statue....
     */
    mdef.mhp = 0; /* in case caller hasn't done this */
    lifesaved_monster(mdef);
    if (!DEADMONSTER(mdef))
        return;

    mdef.mtrapped = 0; /* (see m_detach) */

    if (mdef.data.msize > MZ_TINY
        || !rn2(2 + +((mdef.data.geno & G_FREQ) > 2))) {
        let corpstatflags = CORPSTAT_NONE;

        oldminvent = null;
        /* some objects may end up outside the statue */
        while ((obj = mdef.minvent) != null) {
            extract_from_minvent(mdef, obj, TRUE, TRUE);
            if (obj.otyp == BOULDER

                /* invocation tools resist even with 0% resistance */
                || obj_resists(obj, 0, 0)) {
                if (flooreffects(obj, x, y, _("fall")))
                    continue;
                place_object(obj, x, y);
            } else {
                if (obj.lamplit)
                    end_burn(obj, TRUE);
                obj.nobj = oldminvent;
                oldminvent = obj;
            }
        }
        /* defer statue creation until after inventory removal
           so that saved monster traits won't retain any stale
           item-conferred attributes */
        if (mdef.female)
            corpstatflags = unsigned(corpstatflags | CORPSTAT_FEMALE);
        else if (!is_neuter(mdef.data))
            corpstatflags = unsigned(corpstatflags | CORPSTAT_MALE);
        /* Archeologists should not break unique statues */
        if (mdef.data.geno & G_UNIQ)
            corpstatflags = unsigned(corpstatflags | CORPSTAT_HISTORIC);
        otmp = mkcorpstat(STATUE, mdef, mdef.data, x, y, corpstatflags);
        if (has_mgivenname(mdef))
            otmp = oname(otmp, MGIVENNAME(mdef), ONAME_NO_FLAGS);
        while ((obj = oldminvent) != null) {
            oldminvent = obj.nobj;
            obj.nobj = null; /* avoid merged-> obfree-> dealloc_obj-> panic */
            add_to_container(otmp, obj);
        }
        otmp.owt = unsigned(weight(otmp));
    } else
        otmp = mksobj_at(ROCK, x, y, TRUE, FALSE);

    stackobj(otmp);
    /* mondead() already does this, but we must do it before the newsym */
    if (glyph_is_invisible(levl()[x][y].glyph))
        unmap_object(x, y);
    if (cansee(x, y))
        newsym(x, y);
    /* we don't currently trap the hero in the statue in this case but we
       could */
    if (engulfing_u(mdef))
        wasinside = TRUE;
    mondead(mdef);
    if (wasinside) {
        if (digests(mdef.data))
            You(_("%s through an opening in the new %s."),
                u_locomotion(_("jump")), xname(otmp));
    }
    return;
}

/* another monster has killed the monster mdef */
export function monkilled(
    mdef,
    fltxt,
    how) { /* void */
    let mptr = mdef.data;

    if (fltxt && (mdef.wormno ? worm_known(mdef)
                               : cansee(mdef.mx, mdef.my)))
        pline_mon(mdef, _("%s is %s%s%s!"), Monnam(mdef),
              nonliving(mptr) ? _("destroyed") : _("killed"),
              chars[fltxt] ? _(" by the ") : _(""), fltxt);
    else
        /* sad feeling is deferred until after potential life-saving */
        iflags.sad_feeling = mdef.mtame ? TRUE : FALSE;

    /* no corpse if digested or disintegrated or flammable golem burnt up;
       no corpse for a paper golem means no scrolls; golems that rust or
       rot completely are described as "falling to pieces" so they do
       leave a corpse (which means staves for wood golem, leather armor for
       leather golem, iron chains for iron golem, not a regular corpse) */
    gd.disintegested = +(how == AD_DGST || how == -AD_RBRE
                       || (how == AD_FIRE && completelyburns(mptr)));
    if (gd.disintegested)
        mondead(mdef); /* never leaves a corpse */
    else
        mondied(mdef); /* calls mondead() and maybe leaves a corpse */

    if (!DEADMONSTER(mdef))
        return; /* life-saved */
    /* extra message if pet golem is completely destroyed;
       if not visible, this will follow "you have a sad feeling" */
    if (mdef.mtame) {
        let rxt = (how == AD_FIRE && completelyburns(mptr)) ? _("roast")
                          : (how == AD_RUST && completelyrusts(mptr)) ? _("rust")
                            : (how == AD_DCAY && completelyrots(mptr)) ? _("rot")
                              :  0;
        if (rxt)
            pline(_("May %s %s in peace."), noit_mon_nam(mdef), rxt);
    }
    return;
}

export function set_ustuck(mtmp) { /* void */
    if (iflags.sanity_check || iflags.debug_fuzzer) {
        if (mtmp && !m_next2u(mtmp))
            impossible(_("Sticking to %s at distu %d?"),
                       mon_nam(mtmp), mdistu(mtmp));
    }

    disp.botl = TRUE;
    u.ustuck = mtmp;
    if (!u.ustuck) {
        u.uswallow = 0;
        u.uswldtim = 0;
    }
}

export function unstuck(mtmp) { /* void */
    if (u.ustuck == mtmp) {
        let ptr = mtmp.data;
        let swallowed = u.uswallow;

        /* do this first so that docrt()'s botl update is accurate;
           clears u.uswallow as well as setting u.ustuck to Null */
        set_ustuck(null);

        if (swallowed) {
            gm.mswallower = null;
            u.ux = mtmp.mx;
            u.uy = mtmp.my;
            if (Punished() && uchain.where != OBJ_FLOOR)
                placebc();
            gv.vision_full_recalc = 1;
            docrt();
        }

        /* prevent holder/engulfer from immediately re-holding/re-engulfing
           [note: this call to unstuck() might be because u.ustuck has just
           changed shape and doesn't have a holding attack any more, hence
           don't set mspec_used unconditionally] */
        if (!mtmp.mspec_used && (dmgtype(ptr, AD_STCK)
                                  || attacktype(ptr, AT_ENGL)
                                  || attacktype(ptr, AT_HUGS)))
            mtmp.mspec_used = rnd(2);
    }
}

export function killed(mtmp) { /* void */
    xkilled(mtmp, XKILL_GIVEMSG);
}

/* the player has killed the monster mtmp */
export function xkilled(
    mtmp,
    xkill_flags) { /* void */ /* 1: suppress mesg, 2: suppress corpse, 4: pacifist */
    const $frame = stack_frame(); try {
    var tmp, mndx;
    var x = mtmp.mx, y = mtmp.my;
    var museum = struct_assign(stack_struct(struct_monst), cg.zeromonst);
    var mdat;
    var otmp;
    var t;
    var be_sad;
    var wasinside = engulfing_u(mtmp),
            burycorpse = FALSE,
            nomsg = +((xkill_flags & XKILL_NOMSG) != 0),
            nocorpse = +((xkill_flags & XKILL_NOCORPSE) != 0),
            noconduct = +((xkill_flags & XKILL_NOCONDUCT) != 0);

    /* potential pet message; always clear global flag */
    be_sad = iflags.sad_feeling;
    iflags.sad_feeling = FALSE;

    mtmp.mhp = 0; /* caller will usually have already done this */
    if (!noconduct) { /* KMH, conduct */
        if (!u.uconduct.killer++)
            livelog_printf(LL_CONDUCT, _("killed for the first time"));
    }
    if (!nomsg) {
        var namedpet = (has_mgivenname(mtmp) && !Hallucination() ? 1 : 0);

        You(_("%s %s!"),
            nonliving(mtmp.data) ? _("destroy") : _("kill"),
            !(wasinside || canspotmon(mtmp)) ? _("it")
              : !mtmp.mtame ? mon_nam(mtmp)
                : x_monnam(mtmp, namedpet ? ARTICLE_NONE : ARTICLE_THE,
                           _("poor"), namedpet ? SUPPRESS_SADDLE : 0, FALSE));
    }

    if (mtmp.mtrapped && (t = t_at(x, y)) != null && is_pit(t.ttyp)) {
        if (sobj_at(BOULDER, x, y))
            nocorpse = TRUE; /* Prevent corpses/treasure being created
                              * "on top" of boulder that is about to fall in.
                              * This is out of order, but cannot be helped
                              * unless this whole routine is rearranged. */
        if (m_carrying(mtmp, BOULDER))
            burycorpse = TRUE;
    }

    /* your pet knows who just killed it...watch out */
    if (mtmp.mtame && !mtmp.isminion)
        EDOG(mtmp).killed_by_u = 1;

    if (wasinside && gt.thrownobj && gt.thrownobj != uball
        /* don't give to mon if missile is going to be destroyed */
        && gt.thrownobj.oclass != POTION_CLASS
        /* don't give to mon if missile is going to return to hero */
        && gt.thrownobj != view_of(struct_obj, iflags.returning_missile)) {
        /* thrown object has killed hero's engulfer; add it to mon's
           inventory now so that it will be placed with mon's other
           stuff prior to lookhere/autopickup when hero is expelled
           below (as a side-effect, this missile has immunity from
           being consumed [for this shot/throw only]) */
        mpickobj(mtmp, gt.thrownobj);
        /* let throwing code know that missile has been disposed of */
        gt.thrownobj = null;
    }

    gv.vamp_rise_msg = FALSE; /* might get set in mondead(); checked below */
    gd.disintegested = nocorpse; /* alternate vamp_rise mesg needed if true */
    /* dispose of monster and make cadaver */
    if (gs.stoned)
        monstone(mtmp);
    else
        mondead(mtmp);
    gd.disintegested = FALSE; /* reset */

    if (!DEADMONSTER(mtmp)) { /* monster lifesaved */
        /* Cannot put the non-visible lifesaving message in
         * lifesaved_monster() since the message appears only when _you_
         * kill it (as opposed to visible lifesaving which always appears).
         */
        gs.stoned = FALSE;
        if (!cansee(x, y) && !gv.vamp_rise_msg)
            pline(_("Maybe not..."));
        return;
    }

    if (be_sad)
        You(_("have a sad feeling for a moment, then it passes."));

    mdat = mtmp.data; /* note: mondead can change mtmp->data */
    mndx = monsndx(mdat);

    cleanup: { if (gs.stoned) {
        gs.stoned = FALSE;
        break cleanup;
    }

    if (nocorpse || LEVEL_SPECIFIC_NOCORPSE(mdat))
        break cleanup;;

    if (mdat == mons[PM_MAIL_DAEMON]) {
        stackobj(mksobj_at(SCR_MAIL, x, y, FALSE, FALSE));
    }

    if (accessible(x, y) || is_pool(x, y)) {
        var cadaver;
        var otyp;

        /* illogical but traditional "treasure drop" */
        if (!rn2(6) && !(svm.mvitals[mndx].mvflags & G_NOCORPSE)
            /* no extra item from swallower or steed */
            && (x != u.ux || y != u.uy)
            /* no extra item from kops--too easy to abuse */
            && mdat.mlet != S_KOP
            /* no items from cloned monsters */
            && !mtmp.mcloned) {
            otmp = mkobj(RANDOM_CLASS, TRUE);
            /* don't create large objects from small monsters */
            otyp = otmp.otyp;
            if (otmp.oclass == FOOD_CLASS && !(mdat.mflags2 & M2_COLLECT)
                && !otmp.oartifact) {
                /* don't drop newly created permafood from kills, unless
                   the monster collects food; it creates too much nutrition
                   in the late game and encourages grinding in the early
                   game; oartifact check is paranoia and will be redundant
                   until an artifact comestible is added */
                delobj(otmp);
            } else if (mdat.msize < MZ_HUMAN && otyp != FIGURINE
                /* oc_big is also oc_bimanual and oc_bulky */
                && (otmp.owt > 30 || objects[otyp].oc_big)) {
                if (otmp.oartifact) /* un-create */
                    artifact_exists(otmp, safe_oname(otmp), FALSE,
                                    ONAME_NO_FLAGS);
                delobj(otmp);
            } else if (!flooreffects(otmp, x, y, nomsg ? _("") : _("fall"))) {
                place_object(otmp, x, y);
                stackobj(otmp);
            }
        }
        /* corpse--none if hero was inside the monster */
        if (!wasinside && corpse_chance(mtmp, null, FALSE)) {
            gz.zombify = (!gt.thrownobj && !gs.stoned && !uwep
                         && zombie_maker(gy.youmonst)
                         && zombie_form(mtmp.data) != NON_PM ? 1 : 0);
            cadaver = make_corpse(mtmp, burycorpse ? CORPSTAT_BURIED
                                                   : CORPSTAT_NONE);
            gz.zombify = FALSE; /* reset */
            if (burycorpse && cadaver && cansee(x, y) && !mtmp.minvis
                && cadaver.where == OBJ_BURIED && !nomsg) {
                pline(_("%s corpse ends up buried."), s_suffix(Monnam(mtmp)));
            }
        }
    }

    if (wasinside) {
        /* spoteffects() can end up clearing level of monsters; grab a copy */
        struct_assign(museum, mtmp);
        museum.nmon = null;
        museum.minvent = null;
        museum.mextra = null;
        spoteffects(TRUE); /* poor man's expels() */
        mtmp = museum; /* use the reference copy now */
    }
    /* monster is gone, corpse or other object might now be visible */
    newsym(x, y);
 }
    /*
     * Punish bad behavior.
     */
    if (is_human(mdat)
        && (!always_hostile(mdat) && mtmp.malign <= 0)
        /* exclude role monsters */
        && (mndx < PM_ARCHEOLOGIST || mndx > PM_WIZARD)
        /* exclude plain "human", which isn't flagged as always hostile;
           it is rare and most likely to occur as the result of resurrecting
           a corpse or animating a statue and usually will be hostile */
        && mndx != PM_HUMAN
        /* only applicable if hero is lawful or neutral */
        && u.ualign.type != A_CHAOTIC) {
        u.uprops[TELEPAT].intrinsic = and64(u.uprops[TELEPAT].intrinsic, ~INTRINSIC);
        change_luck(-2);
        You(_("murderer!"));
        if (Blind() && !Blind_telepat())
            see_monsters(); /* Can't sense monsters any more. */
    }
    if ((mtmp.mpeaceful && !rn2(2)) || mtmp.mtame)
        change_luck(-1);
    if (is_unicorn(mdat) && sgn(u.ualign.type) == sgn(mdat.maligntyp)) {
        change_luck(-5);
        You_feel(_("guilty..."));
    }

    /* give experience points */
    tmp = experience(mtmp, (svm.mvitals[mndx].died));
    more_experienced(tmp, 0);
    newexplevel(); /* will decide if you go up */

    /* adjust alignment points */
    if (mtmp.m_id == svq.quest_status.leader_m_id) { /* REAL BAD! */
        adjalign(-(u.ualign.record + Math.trunc(int(ALIGNLIM()) / 2)));
        u.ugangr += 7; /* instantly become "extremely" angry */
        change_luck(-20);
        pline(_("That was %sa bad idea..."),
              u.uevent.qcompleted ? _("probably ") : _(""));
        if (!svc.context.mon_moving)
            iter_mons(anger_quest_guardians);
    } else if (mdat.msound == MS_NEMESIS) { /* Real good! */
        if (!svq.quest_status.killed_leader)
            adjalign(int(Math.trunc(ALIGNLIM() / 4)));
    } else if (mdat.msound == MS_GUARDIAN) { /* Bad */
        adjalign(-int(Math.trunc(ALIGNLIM() / 8)));
        u.ugangr++;
        change_luck(-4);
        if (!Hallucination())
            pline(_("That was probably a bad idea..."));
        else
            pline(_("Whoopsie-daisy!"));
    } else if (mtmp.ispriest) {
        adjalign(p_coaligned(mtmp) ? -2 : 2);
        /* cancel divine protection for killing your priest */
        if (p_coaligned(mtmp))
            u.ublessed = 0;
        if (mdat.maligntyp == A_NONE)
            adjalign(int(Math.trunc(ALIGNLIM() / 4))); /* BIG bonus */
    } else if (mtmp.mtame) {
        adjalign(-15); /* bad!! */
        /* your god is mighty displeased... */
        if (!Hallucination()) {
             ;
            You_hear(_("the rumble of distant thunder..."));
        } else {
             ;
            You_hear(_("the studio audience applaud!"));
        }
        if (!unique_corpstat(mdat)) {
            var mname = has_mgivenname(mtmp);

            livelog_printf(LL_KILLEDPET, _("murdered %s%s%s faithful %s"),
                           mname ? MGIVENNAME(mtmp) : _(""),
                           mname ? _(", ") : _(""),
                           uhis(), pmname(mdat, Mgender(mtmp)));
        }
    } else if (mtmp.mpeaceful)
        adjalign(-5);

    /* malign was already adjusted for u.ualign.type and randomization */
    adjalign(mtmp.malign);

    /* #if 0: not in this build */

    return;
    } finally { stack_pop($frame); }
}

/* changes the monster into a stone monster of the same type
   this should only be called when poly_when_stoned() is true */
export function mon_to_stone(mtmp) { /* void */
    if (mtmp.data.mlet == S_GOLEM) {
        /* it's a golem, and not a stone golem */
        if (canseemon(mtmp))
            pline_mon(mtmp, _("%s solidifies..."), Monnam(mtmp));
        if (newcham(mtmp, mons[PM_STONE_GOLEM], NO_NC_FLAGS)) {
            if (canseemon(mtmp))
                pline(_("Now it's %s."), an(pmname(mtmp.data, Mgender(mtmp))));
        } else {
            if (canseemon(mtmp))
                pline(_("... and returns to normal."));
        }
    } else
        impossible(_("Can't polystone %s!"), a_monnam(mtmp));
}

export function vamp_stone(mtmp) { /* boolean */
    const $frame = stack_frame(); try {
    if (is_vampshifter(mtmp)) {
        let mndx = mtmp.cham;
        let x = mtmp.mx, y = mtmp.my;

        /* this only happens if shapeshifted */
        if (mndx >= LOW_PM && mndx != monsndx(mtmp.data)
            && !(svm.mvitals[mndx].mvflags & G_GENOD)) {
            let buf = stack_array(char, BUFSZ);

            /* construct a format string before transformation */
            sprintf(buf, _("The lapidifying %s %s %s"), x_monnam(mtmp, ARTICLE_NONE, 0,
                             (SUPPRESS_SADDLE | SUPPRESS_HALLUCINATION
                              | SUPPRESS_INVISIBLE | SUPPRESS_IT), FALSE), amorphous(mtmp.data) ? _("coalesces on the")
                       : is_flyer(mtmp.data) ? _("drops to the")
                          : _("writhes on the"), surface(x, y))

;
            mtmp.mcanmove = 1;
            mtmp.mfrozen = 0;
            set_mon_min_mhpmax(mtmp, 10); /* mtmp->mhpmax=max(m_lev+1,10) */
            mtmp.mhp = mtmp.mhpmax;
            /* this can happen if previously a fog cloud */
            if (engulfing_u(mtmp))
                expels(mtmp, mtmp.data, FALSE);
            if (amorphous(mtmp.data) && closed_door(mtmp.mx, mtmp.my)) {
                let new_xy = stack_struct(struct_nhcoord);

                if (enexto(new_xy, mtmp.mx, mtmp.my, mons[mndx])) {
                    rloc_to(mtmp, new_xy.x, new_xy.y);
                }
            }
            if (canspotmon(mtmp)) {
                pline_mon(mtmp, _("%s!"), buf);
                display_nhwindow()(WIN_MESSAGE, FALSE);
            }
            newcham(mtmp, mons[mndx], NO_NC_FLAGS);
            if (mtmp.data == mons[mndx])
                mtmp.cham = NON_PM;
            else
                mtmp.cham = mndx;
            if (canspotmon(mtmp)) {
                pline_mon(mtmp,
                      _("%s rises from the %s with renewed agility!"),
                      Amonnam(mtmp), surface(mtmp.mx, mtmp.my));
            }
            newsym(mtmp.mx, mtmp.my);
            return FALSE;   /* didn't petrify */
        }
    } else if (ismnum(mtmp.cham)
               && (mons[mtmp.cham].mresists & MR_STONE)) {
        /* sandestins are stoning-immune so if hit by stoning damage
           they revert to innate shape rather than become a statue */
        mtmp.mcanmove = 1;
        mtmp.mfrozen = 0;
        set_mon_min_mhpmax(mtmp, 10); /* mtmp->mhpmax=max(mtmp->m_lev+1,10) */
        mtmp.mhp = mtmp.mhpmax;
        newcham(mtmp, mons[mtmp.cham], NC_SHOW_MSG);
        newsym(mtmp.mx, mtmp.my);
        return FALSE;   /* didn't petrify */
    }
    return TRUE;
    } finally { stack_pop($frame); }
}

/* drop monster into "limbo" - that is, migrate to the current level */
export function m_into_limbo(mtmp) { /* void */
    let target_lev = ledger_no(u.uz), xyloc = MIGR_APPROX_XY;

    mtmp.mstate = or64(mtmp.mstate, MON_LIMBO);
    migrate_mon(mtmp, target_lev, xyloc);
}

export function migrate_mon(
    mtmp,
    target_lev,
    xyloc) { /* void */ /* MIGR_xxx flag for location within destination */
    /*
     * If mtmp->mx is zero, this was a failed arrival attempt from a
     * prior migration and mtmp isn't on the map.  In that situation
     * it can't be engulfing or holding the hero or held by same and
     * should have dropped any special objects during that earlier
     * migration back when it had a valid map location.  So only
     * perform some actions when mx is non-zero.
     */
    if (mtmp.mx) {
        unstuck(mtmp);
        mdrop_special_objs(mtmp);
    }
    migrate_to_level(mtmp, target_lev, xyloc, null);
}

function ok_to_obliterate(mtmp) { /* boolean */
    /*
     * Add checks for monsters that should not be obliterated
     * here (return FALSE).
     */
    if (mtmp.data == mons[PM_WIZARD_OF_YENDOR] || is_rider(mtmp.data)
        || has_emin(mtmp) || has_epri(mtmp) || has_eshk(mtmp)
        || mtmp == u.ustuck || mtmp == u.usteed)
        return FALSE;
    return TRUE;
}

export function elemental_clog(mon) { /* void */
    const $frame = stack_frame(); try {
    let msgmv = static_var("elemental_clog.msgmv", long, 0);
    let m_lev = 0;
    let mtmp, m1, m2, m3, m4, m5, zm;

    if (In_endgame(u.uz)) {
        m1 = m2 = m3 = m4 = m5 = zm = null;
        if (!msgmv[0] || (svm.moves - msgmv[0]) > 200) {
            if (!msgmv[0] || rn2(2))
                You_feel(_("besieged."));
            msgmv[0] = svm.moves;
        }
        /*
         * m1 an elemental from another plane.
         * m2 an elemental from this plane.
         * m3 the least powerful monst encountered in loop so far.
         * m4 some other non-tame monster.
         * m5 a pet.
         */
        for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
            if (DEADMONSTER(mtmp) || mtmp == mon)
                continue;
            if (mtmp.mx == 0 && mtmp.my == 0)
                continue;
            if (mon_has_amulet(mtmp) || !ok_to_obliterate(mtmp))
                continue;
            if (mtmp.data.mlet == S_ELEMENTAL) {
                if (!is_home_elemental(mtmp.data)) {
                    if (!m1)
                        m1 = mtmp;
                } else {
                    if (!m2)
                        m2 = mtmp;
                }
            } else {
                if (!mtmp.mtame) {
                    if (!m_lev || mtmp.m_lev < m_lev) {
                        m_lev = mtmp.m_lev;
                        m3 = mtmp;
                    } else if (!m4) {
                        m4 = mtmp;
                    }
                } else {
                    if (!m5)
                        m5 = mtmp;
                    break;
                }
            }
        }
        mtmp = m1 ? m1 : m2 ? m2 : m3 ? m3 : m4 ? m4 : m5 ? m5 : zm;
        if (mtmp) {
            let mx = mtmp.mx, my = mtmp.my;

            mtmp.mstate = or64(mtmp.mstate, MON_OBLITERATE);
            mongone(mtmp);
            /* places in the code might still reference mtmp->mx, mtmp->my */
            /* mtmp->mx = mtmp->my = 0; */
            rloc_to(mon, mx, my);           /* note: mon, not mtmp */

        /* last resort - migrate mon to the next plane */
        } else if (!Is_astralevel(u.uz)) {
            let dest = stack_struct(struct_d_level);
            let target_lev;

            struct_assign(dest, u.uz);
            dest.dlevel--;
            target_lev = ledger_no(dest);
            mon.mstate = or64(mon.mstate, MON_ENDGAME_MIGR);
            migrate_mon(mon, target_lev, MIGR_RANDOM);
        }
    }
    } finally { stack_pop($frame); }
}

/* make monster mtmp next to you (if possible);
   might place monst on far side of a wall or boulder */
export function mnexto(mtmp, rlocflags) { /* void */
    const $frame = stack_frame(); try {
    let mm = stack_struct(struct_nhcoord);

    if (mtmp == u.usteed) {
        /* Keep your steed in sync with you instead */
        mtmp.mx = u.ux;
        mtmp.my = u.uy;
        return;
    }

    if (!enexto(mm, u.ux, u.uy, mtmp.data) || !isok(mm.x, mm.y)) {
        deal_with_overcrowding(mtmp);
        return;
    }
    /* wizard-mode player can choose destination by setting 'montelecontrol'
       option; enexto()'s value for 'mm' will be the default; 'savemm' is
       used to make sure player doesn't choose hero's location and then
       answer 'y' to the 'override invalid spot' prompt */
    if (iflags.mon_telecontrol) {
        let savemm = struct_assign(stack_struct(struct_nhcoord), mm);

        if (!control_mon_tele(mtmp, mm, rlocflags, FALSE))
            struct_assign(mm, savemm);
    }

    rloc_to_flag(mtmp, mm.x, mm.y, rlocflags);
    return;
    } finally { stack_pop($frame); }
}

export function deal_with_overcrowding(mtmp) { /* void */
    if (In_endgame(u.uz)) {
        do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("overcrowding: elemental_clog on %s"), m_monnam(mtmp)); iflags.last_msg = save_plnmsg; } } while (0);
        elemental_clog(mtmp);
    } else {
        do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("overcrowding: sending %s into limbo"), m_monnam(mtmp)); iflags.last_msg = save_plnmsg; } } while (0);
        m_into_limbo(mtmp);
    }
}

/* like mnexto() but requires destination to be directly accessible */
export function maybe_mnexto(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let mm = stack_struct(struct_nhcoord);
    let ptr = mtmp.data;
    let diagok = +!NODIAG(ptr_diff(ptr, mons[0]));
    let tryct = 20;

    do {
        if (!enexto(mm, u.ux, u.uy, ptr))
            return;
        if (couldsee(mm.x, mm.y)
            /* don't move grid bugs diagonally */
            && (diagok || mm.x == mtmp.mx || mm.y == mtmp.my)) {
            /* [this doesn't honor the 'montelecontrol' option] */
            rloc_to(mtmp, mm.x, mm.y);
            return;
        }
    } while (--tryct > 0);
    } finally { stack_pop($frame); }
}

/* mnearto()
 * Put monster near (or at) location if possible.
 * Returns:
 *  2 if another monster was moved out of this one's way;
 *  1 if relocation was successful (without moving another one);
 *  0 otherwise.
 * Note: if already at the target spot, result is 1 rather than 0.
 *
 * Might be called recursively if 'move_other' is True; if so, that argument
 * will be False on the nested call so there won't be any further recursion.
 */
export function mnearto(
    mtmp,
    x,
    y,
    move_other,
    rlocflags) { /* int */
    const $frame = stack_frame(); try {
    let othermon = null;
    let newx, newy;
    let mm = stack_struct(struct_nhcoord);
    let res = 1;

    if (mtmp.mx == x && mtmp.my == y && m_at(x, y) == mtmp)
        return res;

    if (move_other && (othermon = m_at(x, y)) != null) {
        /* take othermon off the map; it might end up immediately returning
           but for the moment it is leaving */
        mon_leaving_level(othermon);
        othermon.mx = othermon.my = 0; /* 'othermon' is not on the map */
        othermon.mstate = or64(othermon.mstate, MON_OFFMAP);
    }

    newx = x;
    newy = y;
    if (!goodpos(newx, newy, mtmp, 0)) {
        /* Actually we have real problems if enexto ever fails.
         * Migrating_mons that need to be placed will cause
         * no end of trouble.
         */
        if (!enexto(mm, newx, newy, mtmp.data) || !isok(mm.x, mm.y)) {
            if (othermon) {
                /* othermon already had its mx, my set to 0 above
                 * and this would shortly cause a sanity check to fail
                 * if we just return 0 here. The caller only possesses
                 * awareness of mtmp, not othermon. */
                deal_with_overcrowding(othermon);
            }
            return 0;
        }
        newx = mm.x;
        newy = mm.y;
    }
    /* [this doesn't honor the 'montelecontrol' option] */
    rloc_to_flag(mtmp, newx, newy, rlocflags);

    if (move_other && othermon) {
        res = 2; /* moving another monster out of the way */
        /* 'move_other'==FALSE this time; fail rather than recurse */
        if (!mnearto(othermon, x, y, FALSE, rlocflags))
            deal_with_overcrowding(othermon);
    }

    return res;
    } finally { stack_pop($frame); }
}

/* shrieker special action: shriek, maybe summon monster, aggravate */
function m_respond_shrieker(mtmp) { /* void */
    if (!Deaf()) {
        pline(_("%s shrieks."), Monnam(mtmp));
        stop_occupation();
    }
    if (!rn2(10)) { /* 1/10 chance per shriek to create a monster */
        /* new monster has a 1/13 chance to be a purple worm, random
           otherwise; baby purple worm if adult is too difficult */
        makemon(rn2(13) ? null
                       : mons[montoostrong(PM_PURPLE_WORM,
                                            monmax_difficulty_lev())
                               ? PM_BABY_PURPLE_WORM : PM_PURPLE_WORM],
                       0, 0, NO_MM_FLAGS);
    }
    aggravate();
}

/* medusa special action: gaze at hero */
function m_respond_medusa(mtmp) { /* void */
    let i;

    for (i = 0; i < NATTK; i++)
        if (mtmp.data.mattk[i].aatyp == AT_GAZE) {
            gazemu(mtmp, mtmp.data.mattk[i]);
            break;
        }
}

/* monster responds to player action; not the same as a passive attack */
export function m_respond(mtmp) { /* void */
    if (mtmp.data.msound == MS_SHRIEK && !um_dist(mtmp.mx, mtmp.my, 1))
        m_respond_shrieker(mtmp);
    if (mtmp.data == mons[PM_MEDUSA] && couldsee(mtmp.mx, mtmp.my))
        m_respond_medusa(mtmp);
    /* Erinyes will inform surrounding monsters of your crimes */
    if (mtmp.data == mons[PM_ERINYS] && !mtmp.mpeaceful && m_canseeu(mtmp))
        aggravate();
}

/* how quest guardians respond when you attack the quest leader */
function qst_guardians_respond() { /* void */
    let mon;
    let q_guardian = mons[quest_info(MS_GUARDIAN)];
    let got_mad = 0;

    /* guardians will sense this attack even if they can't see it */
    for (mon = fmon(); mon; mon = mon.nmon) {
        if (DEADMONSTER(mon))
            continue;
        if (mon.data == q_guardian && mon.mpeaceful) {
            mon.mpeaceful = 0;
            if (canseemon(mon))
                ++got_mad;
        }
    }
    if (got_mad && !Hallucination()) {
        let who = q_guardian.pmnames[NEUTRAL];

        if (got_mad > 1)
            who = makeplural(who);
        pline_The(_("%s %s to be angry too..."),
                  who, vtense(who, _("appear")));
    }
}

/* how other peacefuls react when you attack monster */
function peacefuls_respond(mtmp) { /* void */
    const $frame = stack_frame(); try {
    let mon;
    let mndx = monsndx(mtmp.data);

    for (mon = fmon(); mon; mon = mon.nmon) {
        if (DEADMONSTER(mon))
            continue;
        if (mon == mtmp) /* the mpeaceful test catches this since mtmp */
            continue;    /* is no longer peaceful, but be explicit...  */

        if (!mindless(mon.data) && mon.mpeaceful
            && couldsee(mon.mx, mon.my) && !mon.msleeping
            && mon.mcansee && m_canseeu(mon)) {
            let buf = stack_array(char, BUFSZ);
            let exclaimed = FALSE, needpunct = FALSE, alreadyfleeing;

            chars[buf + 0] = ord('\0');
            if (humanoid(mon.data) || mon.isshk || mon.ispriest) {
                if (is_watch(mon.data)) {
                       ;
                    verbalize(_("Halt!  You're under arrest!"));
                    angry_guards(+!!Deaf());
                } else {
                    if (!Deaf() && !rn2(5)) {
                        let gasp = maybe_gasp(mon);

                        if (gasp) {
                            if (!strncmpi(gasp, _("gasp"), 4)) {
                                sprintf(buf, _("%s gasps"), Monnam(mon));
                                needpunct = TRUE;
                            } else {
                                sprintf(buf, _("%s exclaims \"%s\""), Monnam(mon), gasp)
;
                            }
                            exclaimed = TRUE;
                        }
                    }
                    /* shopkeepers and temple priests might gasp in
                       surprise, but they won't become angry here;
                       quest leader will only get angry if hero attacks
                       own quest guardians */
                    if (mon.isshk || mon.ispriest
                        || (mon.data == mons[quest_info(MS_LEADER)]
                            && mtmp.data != mons[gu.urole.guardnum])) {
                        if (exclaimed)
                            pline_mon(mon, _("%s%s"), buf, _(" then shrugs."));
                        continue;
                    }

                    if (mon.data.mlevel < rn2(10)
                        /* don't have quest guardians turn to flee */
                        && (mon.data != mons[gu.urole.guardnum])) {
                        alreadyfleeing = (mon.mflee || mon.mfleetim ? 1 : 0);
                        monflee(mon, rn2(50) + 25, TRUE, +!exclaimed);
                        if (exclaimed) {
                            if (flags.verbose && !alreadyfleeing) {
                                strcat(buf, _(" and then turns to flee."));
                                needpunct = FALSE;
                            }
                        } else
                            exclaimed = TRUE; /* got msg from monflee() */
                    }
                    if (chars[buf])
                        pline_mon(mon, _("%s%s"), buf, needpunct ? _(".") : _(""));
                    if (mon.mtame) {
                        ; /* mustn't set mpeaceful to 0 as below;
                           * perhaps reduce tameness? */
                    } else {
                        mon.mpeaceful = 0;
                        mon.mstrategy = and64u(mon.mstrategy, ~STRAT_WAITMASK);
                        adjalign(-1);
                        if (!exclaimed)
                            pline_mon(mon, _("%s gets angry!"), Monnam(mon));
                    }
                }
            } else if (mon.data.mlet == mtmp.data.mlet
                       && big_little_match(mndx, monsndx(mon.data))
                       && !rn2(3)) {
                if (!rn2(4)) {
                    growl(mon);
                    exclaimed = +(iflags.last_msg == PLNMSG_GROWL);
                }
                if (rn2(6)) {
                    alreadyfleeing = (mon.mflee || mon.mfleetim ? 1 : 0);
                    monflee(mon, rn2(25) + 15, TRUE, +!exclaimed);
                    if (exclaimed && !alreadyfleeing)
                        /* word like a separate sentence so that we
                           don't have to poke around inside growl() */
                        pline(_("And then starts to flee."));
                }
            }
        }
    }
    } finally { stack_pop($frame); }
}

/* Called whenever the player attacks mtmp; also called in other situations
   where mtmp gets annoyed at the player. Handles mtmp getting annoyed at the
   attack and any ramifications that might have. Useful also in situations
   where mtmp was already hostile; it checks for situations where the player
   shouldn't be attacking and any ramifications /that/ might have. */
export function setmangry(mtmp, via_attack) { /* void */
    if (via_attack && sengr_at(_("Elbereth"), u.ux, u.uy, TRUE)
        /* only hypocritical if monster is vulnerable to Elbereth (or
           peaceful--not vulnerable but attacking it is hypocritical) */
        && (onscary(u.ux, u.uy, mtmp) || mtmp.mpeaceful)) {
        You_feel(_("like a hypocrite."));
        /* AIS: Yes, I know alignment penalties and bonuses aren't balanced
           at the moment. This is about correct relative to other "small"
           penalties; it should be fairly large, as attacking while standing
           on an Elbereth means that you're requesting peace and then
           violating your own request. I know 5 isn't actually large, but
           it's intentionally larger than the 1s and 2s that are normally
           given for this sort of thing. */
        /* reduce to 3 (average) when alignment is already very low */
        adjalign((u.ualign.record > 5) ? -5 : -rnd(5));

        if (!Blind())
            pline(_("The engraving beneath you fades."));
        del_engr_at(u.ux, u.uy);
    }

    /* AIS: Should this be in both places, or just in wakeup()? */
    mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK);
    if (!mtmp.mpeaceful)
        return;
    /* [FIXME: this logic seems wrong; peaceful humanoids gasp or exclaim
       when they see you attack a peaceful monster but they just casually
       look the other way when you attack a pet?] */
    if (mtmp.mtame)
        return;
    mtmp.mpeaceful = 0;
    if (mtmp.ispriest) {
        if (p_coaligned(mtmp))
            adjalign(-5); /* very bad */
        else
            adjalign(2);
    } else
        adjalign(-1); /* attacking peaceful monsters is bad */
    if (humanoid(mtmp.data) || mtmp.isshk || mtmp.isgd) {
        if (couldsee(mtmp.mx, mtmp.my))
            pline_mon(mtmp, _("%s gets angry!"), Monnam(mtmp));
    } else {
        growl(mtmp);
    }

    /* attacking your own quest leader will anger his or her guardians */
    if (mtmp.data == mons[quest_info(MS_LEADER)])
        qst_guardians_respond();

    /* make other peaceful monsters react */
    if (!svc.context.mon_moving)
        peacefuls_respond(mtmp);
}

/* Indicate via message that a monster has awoken. */
export function wake_msg(mtmp, interesting) { /* void */
    if (mtmp.msleeping && canseemon(mtmp)) {
        pline_mon(mtmp, _("%s wakes up%s%s"),
              Monnam(mtmp), interesting ? _("!") : _("."),
              mtmp.data == mons[PM_FLESH_GOLEM] ? _(" It's alive!") : _(""));
    }
}

/* wake up a monster, possibly making it angry in the process */
export function wakeup(mtmp, via_attack) { /* void */
    let was_sleeping = mtmp.msleeping;

    wake_msg(mtmp, via_attack);
    mtmp.msleeping = 0;
    if (M_AP_TYPE(mtmp) != M_AP_NOTHING) {
        /* mimics come out of hiding, but disguised Wizard doesn't
           have to lose his disguise */
        if (M_AP_TYPE(mtmp) != M_AP_MONSTER)
            seemimic(mtmp);
    } else if (svc.context.forcefight && !svc.context.mon_moving
               && mtmp.mundetected) {
        mtmp.mundetected = 0;
        newsym(mtmp.mx, mtmp.my);
    }
    finish_meating(mtmp);
    if (via_attack) {
        let was_peaceful = mtmp.mpeaceful;

        if (was_sleeping)
            growl(mtmp);
        setmangry(mtmp, TRUE);
        if (was_peaceful) {
            if (mtmp.ispriest && chars[in_rooms(mtmp.mx, mtmp.my, TEMPLE)])
                ghod_hitsu(mtmp);
            if (mtmp.isshk && !chars[u.ushops])
                hot_pursuit(mtmp);
        }
    }
}

/* Wake up nearby monsters without angering them. */
export function wake_nearby(petcall) { /* void */
    wake_nearto_core(u.ux, u.uy, u.ulevel * 20, petcall);
}

/* Wake up monsters near some particular location. */
function wake_nearto_core(x, y, distance, petcall) { /* void */
    let mtmp;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (distance == 0 || dist2(mtmp.mx, mtmp.my, x, y) < distance) {
            /* sleep for N turns uses mtmp->mfrozen, but so does paralysis
               so we leave mfrozen monsters alone */
            wake_msg(mtmp, FALSE);
            mtmp.msleeping = 0; /* wake indeterminate sleep */
            if (!(mtmp.data.geno & G_UNIQ))
                mtmp.mstrategy = and64u(mtmp.mstrategy, ~STRAT_WAITMASK); /* wake 'meditation' */
            if (svc.context.mon_moving || !petcall)
                continue;
            if (mtmp.mtame) {
                if (!mtmp.isminion)
                    EDOG(mtmp).whistletime = svm.moves;
                /* Fix up a pet who is stuck "fleeing" its master */
                mon_track_clear(mtmp);
            }
        }
    }
    disturb_buried_zombies(x, y);
}

export function wake_nearto(x, y, distance) { /* void */
    wake_nearto_core(x, y, distance, FALSE);
}

/* NOTE: we must check for mimicry before calling this routine */
export function seemimic(mtmp) { /* void */
    let is_blocker_appear = is_lightblocker_mappear(mtmp);

    if (has_mcorpsenm(mtmp))
        freemcorpsenm(mtmp);

    mtmp.m_ap_type = M_AP_NOTHING;
    mtmp.mappearance = 0;

    /*
     *  Discovered mimics don't block light.
     */
    if (is_blocker_appear
        && !does_block(mtmp.mx, mtmp.my, levl()[mtmp.mx][mtmp.my]))
        unblock_point(mtmp.mx, mtmp.my);

    newsym(mtmp.mx, mtmp.my);
}

/* [taken out of rescham() in order to be shared by restore_cham()] */
export function normal_shape(mon) { /* void */
    let mcham = mon.cham;

    if (ismnum(mcham)) {
        let mcan = mon.mcan;

        newcham(mon, mons[mcham], NC_SHOW_MSG);
        mon.cham = NON_PM;
        /* newcham() may uncancel a polymorphing monster; override that */
        if (mcan)
            mon.mcan = 1;
        newsym(mon.mx, mon.my);
    }
    if (is_were(mon.data) && mon.data.mlet != S_HUMAN) {
        new_were(mon);
    }
    if (M_AP_TYPE(mon) != M_AP_NOTHING) {
        /* this used to include a cansee() check but Protection_from_
           _shape_changers shouldn't be trumped by being unseen */
        if (!mon.meating) {
            /* make revealed mimic fall asleep in lieu of shape change */
            if (M_AP_TYPE(mon) != M_AP_MONSTER)
                mon.msleeping = 1;
            seemimic(mon);
        } else {
            /* quickmimic: pet is midst of eating a mimic corpse;
               this terminates the meal early */
            finish_meating(mon);
        }
    }
}

/* freed by freedynamicdata() when game ends; doesn't need to be struct g */
const itermonarr = static_var("itermonarr", ptr_to(ptr_to(struct_monst)), null);
const itermonsiz = static_var("itermonsiz", unsigned, 0); /* size in 'monst *' pointers */

/* manage itermonarr; it used to be allocated and freed every time the
   monster movement loop ran; now, keep it around most of the time */
export function alloc_itermonarr(count) { /* void */
    /* if count is 0 or bigger than itermonsiz or much smaller than
       itermonsiz, release itermonarr (and reset itermonsiz to 0) */
    if (!count || count > itermonsiz[0] || unsigned(count + 40) < itermonsiz[0]) {
        if (itermonarr[0])
            free(addr_of(itermonarr[0])), itermonarr[0] = null;
        itermonsiz[0] = 0;
    }
    /* when count is more than itermonsiz (including when that just
       got reset to 0), allocate a new instance of itermonarr;
       implies that count is greater than 0 */
    if (count > itermonsiz[0]) {
        /* overallocate to reduce free/alloc-again thrashing when the
           number of monsters varies from turn to turn */
        itermonsiz[0] = unsigned(count + 20);
        itermonarr[0] = ref_to(ptr_to(struct_monst), addr_of(alloc(
                                        unsigned(Math.imul(itermonsiz[0], sizeof(ptr_to(struct_monst)))))));
    }
}

/* Iterate all monsters on the level, even dead or off-map ones, calling
   bfunc() for each monster.  If bfunc() returns TRUE, stop iterating.
   If the game ends during the call to bfunc(), then freedynamicdata()
   will free 'itermonarr'.

   Safe for list deletions and insertions, and guarantees calling bfunc()
   once per monster in fmon unless it returns TRUE (or game ends). */
export function iter_mons_safe(bfunc) { /* void */
    let mtmp;
    let i, nmons;

    for (nmons = 0, mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
        nmons++;

    /* make sure itermonarr[] is big enough to hold nmons entries */
    alloc_itermonarr(nmons);

    if (nmons) {
        for (i = 0, mtmp = fmon(); mtmp; mtmp = mtmp.nmon)
            itermonarr[0][i++] = mtmp;

        for (i = 0; i < nmons; i++) {
            mtmp = itermonarr[0][i];
            if (bfunc(mtmp))
                break;
        }
    }
    return;
}

/* iterate all living monsters on current level, calling vfunc for each. */
export function iter_mons(vfunc) { /* void */
    let mtmp, mtmp2;

    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp) || mon_offmap(mtmp))
            continue;
        vfunc(mtmp);
    }
    return;
}

/* iterate all living monsters on current level, calling bfunc for each.
   if bfunc returns TRUE, stop and return that monster. */
export function get_iter_mons(bfunc) { /* struct monst * */
    let mtmp, mtmp2;

    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp) || mon_offmap(mtmp))
            continue;
        if (bfunc(mtmp))
            break;
    }
    return mtmp;
}

/* iterate all living monsters on current level, calling bfunc for each,
   passing x,y to the function.
   if bfunc returns TRUE, stop and return that monster. */
export function get_iter_mons_xy(
    bfunc,
    x, y) { /* struct monst * */
    let mtmp, mtmp2;

    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp) || mon_offmap(mtmp))
            continue;
        if (bfunc(mtmp, x, y))
            break;
    }
    return mtmp;
}

/* Heal the given monster by amt hitpoints, unless it is somehow prevented
   from healing. "overheal" is the maximum amount by which the max HP will
   increase to allow for the healing (the resulting HP caps at max HP +
   overheal, and the max HP stays the some unless it needs to increase to
   accommodate the new HP). Overhealing the player is not currently
   implemented by this method.

   This function should only be used for situations which are conceptually
   heals, rather than other situations where a monster's HP is set, so that
   "prevent healing" effects work correctly. In particular, it should not
   be used for cases where a monster's HP is restored upon revival, or when
   a monster is created. It also shouldn't be used for lifesaving, which
   overrides "cannot heal" effects.

   amt and overheal must not be negative (0 is allowed, and a very common
   amount for overheal). Returns the number of hitpoints healed. */
export function healmon(mtmp, amt, overheal) { /* int */
    if (mtmp == gy.youmonst) {
        let oldhp = Upolyd() ? u.mh : u.uhp;
        healup(amt, 0, 0, 0);
        return (Upolyd() ? u.mh : u.uhp) - oldhp;
    } else {
        let oldhp = mtmp.mhp;
        if (mtmp.mhp + amt > mtmp.mhpmax + overheal) {
            mtmp.mhpmax += overheal;
            mtmp.mhp = mtmp.mhpmax;
        } else {
            mtmp.mhp += amt;
            if (mtmp.mhp > mtmp.mhpmax)
                mtmp.mhpmax = mtmp.mhp;
        }
        return mtmp.mhp - oldhp;
    }
}

/* force all chameleons and mimics to become themselves and werecreatures
   to revert to human form; called when Protection_from_shape_changers gets
   activated via wearing or eating ring or via #wizintrinsic */
export function rescham() { /* void */
    iter_mons(normal_shape);
}

function m_restartcham(mtmp) { /* void */
    if (!mtmp.mcan)
        mtmp.cham = pm_to_cham(monsndx(mtmp.data));
    if (mtmp.data.mlet == S_MIMIC && mtmp.msleeping) {
        set_mimic_sym(mtmp);
        newsym(mtmp.mx, mtmp.my);
    }
}

/* let chameleons change and mimics hide again; called when taking off
   ring of protection from shape changers */
export function restartcham() { /* void */
    iter_mons(m_restartcham);
}

/* called when restoring a monster from a saved level; protection
   against shape-changing might be different now than it was at the
   time the level was saved. */
export function restore_cham(mon) { /* void */
    if (Protection_from_shape_changers() || mon.mcan) {
        /* force chameleon or mimic to revert to its natural shape */
        normal_shape(mon);
    } else if (mon.cham == NON_PM) {
        /* chameleon doesn't change shape here, just gets allowed to do so */
        mon.cham = pm_to_cham(monsndx(mon.data));
    }
}

/* unwatched hiders may hide again; if so, returns True */
function restrap(mtmp) { /* boolean */
    let t;

    if (mtmp.mcan || M_AP_TYPE(mtmp) || cansee(mtmp.mx, mtmp.my)
        || rn2(3) || mtmp == u.ustuck
        /* can't hide while trapped except in pits */
        || (mtmp.mtrapped && (t = t_at(mtmp.mx, mtmp.my)) != null
            && !is_pit(t.ttyp))
        /* can't hide on ceiling if there isn't one */
        || (ceiling_hider(mtmp.data) && !has_ceiling(u.uz))
        /* won't hide when adjacent to hero */
        || (sensemon(mtmp) && m_next2u(mtmp)))
        return FALSE;

    if (mtmp.data.mlet == S_MIMIC) {
        if (mtmp.msleeping || mtmp.mfrozen) {
        /*
         * The mimic needs to be awake to disguise itself
         * as something else.
         */
            return FALSE;
        }
        set_mimic_sym(mtmp);
        return TRUE;
    } else if (levl()[mtmp.mx][mtmp.my].typ == ROOM) {
        mtmp.mundetected = 1;
        return TRUE;
    }

    return FALSE;
}

/* reveal a hiding monster at x,y, either under nonexistent object,
   or an eel out of water. */
export function maybe_unhide_at(x, y) { /* void */
    let mtmp;
    let undetected = FALSE, trapped = FALSE;

    if ((mtmp = m_at(x, y)) != null) {
        undetected = mtmp.mundetected;
        trapped = mtmp.mtrapped;
    } else if (u_at(x, y)) {
        mtmp = gy.youmonst;
        undetected = u.uundetected;
        trapped = schar(u.utrap);
    } else {
        return;
    }

    if (undetected
        && ((hides_under(mtmp.data)
             && (!OBJ_AT(x, y) || trapped
                 || !can_hide_under_obj(svl.level.objects[x][y])))
            || (mtmp.data.mlet == S_EEL && !is_pool(x, y))))
        hideunder(mtmp);
}

/* monster/hero tries to hide under something at the current location;
   if used by monster creation, should only happen during level
   creation, otherwise there will be message sequencing issues */
export function hideunder(mtmp) { /* boolean */
    let t;
    let otmp;
    let seenmon = 0, seenobj = 0,
               locomo = 0;
    let seeit = gi.in_mklev ? 0 : canseemon(mtmp);
    let oldundetctd, undetected = FALSE, is_u = +(mtmp == gy.youmonst);
    let x = is_u ? u.ux : mtmp.mx, y = is_u ? u.uy : mtmp.my;

    if (mtmp == u.ustuck) {
        ; /* undetected==FALSE; can't hide if holding you or held by you */
    } else if ((is_u ? u.utrap : mtmp.mtrapped)
               || ((t = t_at(x, y)) != null && !is_pit(t.ttyp))) {
        ; /* undetected==FALSE; can't hide while trapped or on/in/under
             any non-pit trap when not trapped */
    } else if (mtmp.data.mlet == S_EEL) {
        /* aquatic creatures only hide under water, not under objects;
           they don't do so on the Plane of Water or when hero is also
           under water unless some obstacle blocks line-of-sight */
        undetected = (is_pool(x, y) && !Is_waterlevel(u.uz)
                      && (!Underwater() || !couldsee(x, y)) ? 1 : 0);
        if (seeit) {
            seenobj = _("the water");
            locomo = _("dive");
        }
    } else if (hides_under(mtmp.data)
               /* hider-underers only hide under objects */
               && (otmp = svl.level.objects[x][y]) != null
               /* most things can be hidden under, but not all */
               && can_hide_under_obj(otmp)
               /* pets won't hide under a cursed item or an item of any BUC
                  state that shares a pile with one or more cursed items */
               && (!mtmp.mtame || !cursed_object_at(x, y))
               /* aquatic creatures don't reach here; other swimmers
                  shouldn't hide beneath underwater objects */
               && !is_pool_or_lava(x, y)) {
        if (seeit) /*&& (!is_pool(x, y) || (Underwater && distu(x, y) <= 2))*/
            seenobj = ansimpleoname(otmp);
        /* most monsters won't hide under a cockatrice corpse but they
           can hide under a pile containing more than just such corpses */
        if (is_u ? !Stone_resistance() : !resists_ston(mtmp))
            while (otmp && otmp.otyp == CORPSE
                   && touch_petrifies(mons[otmp.corpsenm]))
                otmp = otmp.v.v_nexthere;
        if (otmp)
            undetected = TRUE;
    }

    if (is_u) {
        oldundetctd = +(u.uundetected != 0);
        u.uundetected = undetected ? 1 : 0;
    } else {
        if (seeit)
            seenmon = y_monnam(mtmp);
        oldundetctd = +(mtmp.mundetected != 0);
        mtmp.mundetected = undetected ? 1 : 0;
        /* the "you see" message won't be shown for monster hiding during
           level creation because 'seeit' will be 0 so 'seenmon' and 'seenobj'
           will be Null */
        if (undetected && seenmon && seenobj) {
            if (!locomo)
                locomo = locomotion(mtmp.data, _("hide"));
            set_msg_xy(mtmp.mx, mtmp.my); /* pline() will reset this */
            You_see(_("%s %s under %s."), seenmon, locomo, seenobj);
            iflags.last_msg = PLNMSG_HIDE_UNDER;
            gl.last_hider = mtmp.m_id;
        }
    }
    if (undetected != oldundetctd)
        newsym(x, y);
    return undetected;
}

/* called when returning to a previously visited level */
export function hide_monst(mon) { /* void */
    let hider_under = +(hides_under(mon.data) || mon.data.mlet == S_EEL);

    if ((is_hider(mon.data) || hider_under)
        && !(mon.mundetected || M_AP_TYPE(mon))) {
        let x = mon.mx, y = mon.my;
        let save_viz = char(uchars[gv.viz_array[y] + x]);

        /* override vision, forcing hero to be unable to see monster's spot */
        uchars[gv.viz_array[y] + x] &= ~(IN_SIGHT | COULD_SEE);
        if (is_hider(mon.data))
            restrap(mon);
        /* try again if mimic missed its 1/3 chance to hide */
        if (mon.data.mlet == S_MIMIC && !M_AP_TYPE(mon))
            restrap(mon);
        uchars[gv.viz_array[y] + x] = uchar(save_viz);
        if (hider_under)
            hideunder(mon);
    }
}

export function mon_animal_list(construct) { /* void */
    const $frame = stack_frame(); try {
    if (construct) {
        let animal_temp = stack_array(short, SPECIAL_PM);
        let i, n;

        /* if (animal_list) impossible("animal_list already exists"); */

        for (n = 0, i = LOW_PM; i < SPECIAL_PM; i++)
            if (is_animal(mons[i]))
                animal_temp[n++] = i;
        /* if (n == 0) animal_temp[n++] = NON_PM; */

        ga.animal_list = ref_to(short, addr_of(alloc(unsigned(Math.imul(unsigned(n), sizeof(short))))));
        memcpy(addr_of(ga.animal_list),
                      addr_of(animal_temp),
                      unsigned(Math.imul(unsigned(n), sizeof(short))));
        ga.animal_list_count = n;
    } else { /* release */
        if (ga.animal_list)
            free(addr_of(ga.animal_list)), ga.animal_list = null;
        ga.animal_list_count = 0;
    }
    } finally { stack_pop($frame); }
}

function pick_animal() { /* int */
    let res;

    if (!ga.animal_list)
        mon_animal_list(TRUE);
    assert(ga.animal_list != null);
    res = ga.animal_list[rn2(ga.animal_list_count)];
    /* rogue level should use monsters represented by uppercase letters
       only, but since chameleons aren't generated there (not uppercase!)
       we don't perform a lot of retries */
    if (Is_rogue_level(u.uz) && !(0 ? isupper(monsym(mons[res])) : ((unsigned((unsigned((monsym(mons[res]))) - ord("A")))) < 26)))
        res = ga.animal_list[rn2(ga.animal_list_count)];
    return res;
}

export function decide_to_shapeshift(mon) { /* void */
    const $frame = stack_frame(); try {
    let ptr = null;
    let mndx;
    let was_female = mon.female;
    let dochng = FALSE;

    if (!is_vampshifter(mon)) {
        /* regular shapeshifter; 'ptr' is Null */
        if (!mon.mspec_used && !rn2(6)) {
            dochng = TRUE;
            mon.mspec_used = 3 + rn2(10);
        }
    } else if (!(mon.mstrategy & STRAT_WAITFORU)) {
        /* The vampire has to be in good health (mhp) to maintain
         * its shifted form.
         *
         * If we're shifted and getting low on hp, maybe shift back, or
         * if we're a fog cloud at full hp, maybe pick a different shape.
         * If we're not already shifted and in good health, maybe shift.
         */
        if (mon.data.mlet != S_VAMPIRE) {
            if ((mon.mhp <= Math.trunc((mon.mhpmax + 5) / 6)) && rn2(4)
                && ismnum(mon.cham)) {
                ptr = mons[mon.cham];
                dochng = TRUE;
            } else if (mon.data == mons[PM_FOG_CLOUD]
                       && mon.mhp == mon.mhpmax && !rn2(4)
                       && (!canseemon(mon)
                           || mdistu(mon) > BOLT_LIM * BOLT_LIM)) {
                /* if a fog cloud, maybe change to wolf or vampire bat;
                   those are more likely to take damage--at least when
                   tame--and then switch back to vampire; they'll also
                   switch to fog cloud if they encounter a closed door */
                mndx = pickvampshape(mon);
                if (ismnum(mndx)) {
                    ptr = mons[mndx];
                    dochng = +(ptr != mon.data);
                }
            }
            if (dochng && amorphous(mon.data)
                && closed_door(mon.mx, mon.my)) {
                let new_xy = stack_struct(struct_nhcoord);

                if (enexto(new_xy, mon.mx, mon.my, ptr)) {
                    rloc_to(mon, new_xy.x, new_xy.y);
                }
            }
        } else {
            if (mon.mhp >= Math.trunc(9 * mon.mhpmax / 10) && !rn2(6)
                && (!canseemon(mon)
                    || mdistu(mon) > BOLT_LIM * BOLT_LIM))
                dochng = TRUE; /* 'ptr' stays Null */
        }
    }
    if (dochng) {
        if (newcham(mon, ptr, NC_SHOW_MSG)) {
            /* for vampshift, override the 10% chance for sex change
               (by forcing original gender in case that occurred) */
            if (is_vampshifter(mon)) {
                ptr = mon.data;
                if (!is_male(ptr) && !is_female(ptr) && !is_neuter(ptr))
                    mon.female = was_female;
            }
        }
    }
    } finally { stack_pop($frame); }
}

function pickvampshape(mon) { /* int */
    let mndx = mon.cham, wolfchance = 10;
    /* avoid picking monsters with lowercase display symbols ('d' for wolf
       and 'v' for fog cloud) on rogue level*/
    let uppercase_only = Is_rogue_level(u.uz);

    switch (mndx) {
    case PM_VLAD_THE_IMPALER:
        /* ensure Vlad can keep carrying the Candelabrum */
        if (mon_has_special(mon))
            break; /* leave mndx as is */
        wolfchance = 3;
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case PM_VAMPIRE_LEADER: /* vampire lord or Vlad can become wolf */
        if (!rn2(wolfchance) && !uppercase_only
            /* don't pick a walking form if that would lead to immediate
               drowning or immolation and reversion to vampire form */
            && !is_pool_or_lava(mon.mx, mon.my)) {
            mndx = PM_WOLF;
            break;
        }
        /* FALLTHROUGH */;
    /*FALLTHRU*/
    case PM_VAMPIRE: /* any vampire can become fog or bat */
        mndx = (!rn2(4) && !uppercase_only) ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
        break;
    }

    /* return to base form if chosen poly target has been genocided
       or randomly if already in an alternate form (to prevent always
       switching back and forth between bat and fog) */
    if ((svm.mvitals[mndx].mvflags & G_GENOD) != 0
        || (mon.data != mons[mon.cham] && !rn2(4)))
        return mon.cham;

    return mndx;
}

/* nonshapechangers who warrant special polymorph handling */
function isspecmon(mon) { /* boolean */
    return (mon.isshk || mon.ispriest || mon.isgd
            || mon.m_id == svq.quest_status.leader_m_id ? 1 : 0);
}

/* restrict certain special monsters (shopkeepers, aligned priests,
   vault guards) to forms that allow them to behave sensibly (catching
   gold, speaking?) so that they don't need too much extra code */
function validspecmon(mon, mndx) { /* boolean */
    if (mndx == NON_PM)
        return TRUE; /* caller wants random */

    if (!accept_newcham_form(mon, mndx))
        return FALSE; /* geno'd or !polyok */

    if (isspecmon(mon)) {
        let ptr = mons[mndx];

        /* reject notake because object manipulation is expected
           and nohead because speech capability is expected */
        if (notake(ptr) || !has_head(ptr))
            return FALSE;
        /* [should we check ptr->msound here too?] */
    }
    return TRUE; /* potential new form is ok */
}

/* used for hero polyself handling */
export function valid_vampshiftform(base, form) { /* boolean */
    if (base >= LOW_PM && is_vampire(mons[base])) {
        if (form == PM_VAMPIRE_BAT || form == PM_FOG_CLOUD
            || (form == PM_WOLF && base != PM_VAMPIRE))
            return TRUE;
    }
    return FALSE;
}

/* prevent wizard mode user from specifying invalid vampshifter shape
   when using monpolycontrol to assign a new form to a vampshifter */
export function validvamp(mon, mndx_p, monclass) { /* boolean */
    /* simplify caller's usage */
    if (!is_vampshifter(mon))
        return validspecmon(mon, mndx_p[0]);

    if (mon.cham == PM_VLAD_THE_IMPALER && mon_has_special(mon)) {
        /* Vlad with Candelabrum; override choice, then accept it */
        mndx_p[0] = PM_VLAD_THE_IMPALER;
        return TRUE;
    }
    if (ismnum(mndx_p[0]) && is_shapeshifter(mons[mndx_p[0]])) {
        /* player picked some type of shapeshifter; use mon's self
           (vampire or chameleon) */
        mndx_p[0] = mon.cham;
        return TRUE;
    }
    /* basic vampires can't become wolves; any can become fog or bat
       (we don't enforce upper-case only for rogue level here) */
    if (mndx_p[0] == PM_WOLF)
        return (+(mon.cham != PM_VAMPIRE));
    if (mndx_p[0] == PM_FOG_CLOUD || mndx_p[0] == PM_VAMPIRE_BAT)
        return TRUE;

    /* if we get here, specific type was no good; try by class */
    switch (monclass) {
    case S_VAMPIRE:
        mndx_p[0] = mon.cham;
        break;
    case S_BAT:
        mndx_p[0] = PM_VAMPIRE_BAT;
        break;
    case S_VORTEX:
        mndx_p[0] = PM_FOG_CLOUD;
        break;
    case S_DOG:
        if (mon.cham != PM_VAMPIRE) {
            mndx_p[0] = PM_WOLF;
            break;
        }
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    default:
        mndx_p[0] = NON_PM;
        break;
    }
    return (+(mndx_p[0] != NON_PM));
}

function wiz_force_cham_form(mon) { /* int */
    const $frame = stack_frame(); try {
    let pprompt = stack_array(char, BUFSZ), parttwo = stack_array(char, QBUFSZ), buf = stack_array(char, BUFSZ), prevbuf = stack_array(char, BUFSZ);
    let monclass, len, tryct, mndx = stack_var(int, NON_PM);

    /* construct prompt in pieces */
    sprintf(pprompt, _("Change %s"), noit_mon_nam(mon));
    sprintf(parttwo, _(" @ %s into what?"), coord_desc(mon.mx, mon.my, buf,
                       (iflags.getpos_coords != GPCOORDS_NONE)
                       ? iflags.getpos_coords : GPCOORDS_MAP))
;
    /* combine the two parts, not exceeding QBUFSZ-1 in overall length;
       if combined length is too long it has to be due to monster's
       name so we'll chop enough of that off to fit the second part */
    if (int(len = int(strlen(pprompt)) + int(strlen(parttwo))) >= QBUFSZ)
        /* strlen(parttwo) is less than QBUFSZ/2 so strlen(pprompt) is
           more than QBUFSZ/2 and excess amount being truncated can't
           exceed pprompt's length and back up to before &pprompt[0]) */
        chars[(eos(pprompt) - (len - (QBUFSZ - 1)))] = ord('\0');
    strcat(pprompt, parttwo);

    chars[buf + 0] = chars[prevbuf + 0] = ord('\0'); /* clear buffer for EDIT_GETLIN */

    tryct = TRYLIMIT;
    do {
        if (tryct == TRYLIMIT - 1) { /* first retry */
            /* change "into what?" to "into what kind of monster?" */
            if (unsigned(unsigned(strlen(pprompt) + sizeof_string(" kind of monster")) - 1) < QBUFSZ)
                strcpy(eos(pprompt) - 1, _(" kind of monster?"));
        }

        monclass = 0;
        getlin(pprompt, buf);
        mungspaces(buf);
        /* for ESC, take form selected above (might be NON_PM) */
        if (chars[buf] == ord('\x1b'))
            break;
        /* for "*", use NON_PM to pick an arbitrary shape below */
        if (!strcmp(buf, _("*")) || !strncmpi((buf), _(("random")), -1)) {
            mndx[0] = NON_PM;
            break;
        }
        mndx[0] = name_to_mon(buf, null);
        if (mndx[0] == NON_PM) {
            /* didn't get a type, so check whether it's a class
               (single letter or text match with def_monsyms[]) */
            monclass = name_to_monclass(buf, mndx);
            if (monclass && mndx[0] == NON_PM)
                mndx[0] = mkclass_poly(monclass);
        }
        if (ismnum(mndx[0])) {
            /* got a specific type of monster; use it if we can */
            if (validvamp(mon, mndx, monclass))
                break;
            /* can't; revert to random in case we exhaust tryct */
            mndx[0] = NON_PM;
        }

        pline(_("It can't become that."));

        (prevbuf);
    } while (--tryct > 0);

    if (!tryct)
        pline1(thats_enough_tries());
    if (is_vampshifter(mon) && !validvamp(mon, mndx, monclass))
        mndx[0] = pickvampshape(mon); /* don't resort to arbitrary */
    return mndx[0];
    } finally { stack_pop($frame); }
}
export const TRYLIMIT = 5;

export function select_newcham_form(mon) { /* int */
    let mndx = NON_PM, tryct;

    switch (mon.cham) {
    case PM_SANDESTIN:
        if (rn2(7))
            mndx = pick_nasty(mons[PM_ARCHON].difficulty - 1);
        break;
    case PM_DOPPELGANGER:
        if (!rn2(7)) {
            mndx = pick_nasty(mons[PM_JABBERWOCK].difficulty - 1);
        } else if (rn2(3)) { /* role monsters */
            mndx = tt_doppel(mon);
        } else if (!rn2(3)) { /* quest guardians */
            mndx = rn1(PM_APPRENTICE - PM_STUDENT + 1, PM_STUDENT);
            /* avoid own role's guardian */
            if (mndx == gu.urole.guardnum)
                mndx = NON_PM;
        } else { /* general humanoids */
            tryct = 5;
            do {
                mndx = rn1(SPECIAL_PM - LOW_PM, LOW_PM);
                /* assert(ismnum(mndx)); */
                if (humanoid(mons[mndx]) && polyok(mons[mndx]))
                    break;
            } while (--tryct > 0);
            if (!tryct)
                mndx = NON_PM;
        }
        break;
    case PM_CHAMELEON:
        if (!rn2(3))
            mndx = pick_animal();
        break;
    case PM_VLAD_THE_IMPALER:
    case PM_VAMPIRE_LEADER:
    case PM_VAMPIRE:
        mndx = pickvampshape(mon);
        break;
    case NON_PM: /* ordinary */
      {
        let m_armr = which_armor(mon, W_ARM);

        if (m_armr && Is_dragon_scales(m_armr))
            mndx = ptr_diff(Dragon_scales_to_pm(m_armr), mons[0]);
        else if (m_armr && Is_dragon_mail(m_armr))
            mndx = ptr_diff(Dragon_mail_to_pm(m_armr), mons[0]);
      }
        break;
    }

    /* for debugging: allow control of polymorphed monster */
    if (wizard() && iflags.mon_polycontrol)
        mndx = wiz_force_cham_form(mon);

    /* if no form was specified above, pick one at random now */
    if (mndx == NON_PM) {
        tryct = 50;
        do {
            mndx = rn1(SPECIAL_PM - LOW_PM, LOW_PM);
            /* assert(ismnum(mndx); */
        } while (--tryct > 0 && !validspecmon(mon, mndx)
                 /* try harder to select uppercase monster on rogue level */
                 && (tryct > 40 && Is_rogue_level(u.uz)
                     && !(0 ? isupper(monsym(mons[mndx])) : ((unsigned((unsigned((monsym(mons[mndx]))) - ord("A")))) < 26))));
    }
    return mndx;
}

/* this used to be inline within newcham() but monpolycontrol needs it too */
function accept_newcham_form(mon, mndx) { /* struct permonst * */
    let mdat;

    if (mndx == NON_PM)
        return null;
    mdat = mons[mndx];
    if ((svm.mvitals[mndx].mvflags & G_GENOD) != 0)
        return null;
    if (is_placeholder(mdat))
        return null;
    /* select_newcham_form() might deliberately pick a player
       character type (random selection never does) which
       polyok() rejects, so we need a special case here */
    if (is_mplayer(mdat))
        return mdat;
    /* shapeshifters are rejected by polyok() but allow a shapeshifter
       to take on its 'natural' form */
    if (is_shapeshifter(mdat)
        && ismnum(mon.cham) && mdat == mons[mon.cham])
        return mdat;
    /* polyok() rules out M2_PNAME, M2_WERE, and all humans except Kops */
    return polyok(mdat) ? mdat : null;
}

/* shapechanger might take on a shape that forces gender change */
export function mgender_from_permonst(
    mtmp,
    mdat) { /* void */
    if (is_male(mdat)) {
        mtmp.female = FALSE;
    } else if (is_female(mdat)) {
        mtmp.female = TRUE;
    } else if (!is_neuter(mdat)) {
        /* usually leave as-is; same chance to change as polymorphing hero;
           vampires use controlled shapechange (from their perspective, even
           if it is random from the player's perspective) and don't undergo
           gender change */
        if (!rn2(10) && !(is_vampire(mdat) || is_vampshifter(mtmp)))
            mtmp.female = +!mtmp.female;
    }
}

/* make a chameleon take on another shape, or a polymorph target
   (possibly self-inflicted) become a different monster;
   returns 1 if it actually changes form */
export function newcham(
    mtmp,
    mdat,
    ncflags) { /* int */
    const $frame = stack_frame(); try {
    let polyspot = +((ncflags & NC_VIA_WAND_OR_SPELL) !=0),

            msg = +((ncflags & NC_SHOW_MSG) != 0),
            seenorsensed = canspotmon(mtmp);
    let hpn, hpd, mndx, tryct;
    let olddata = mtmp.data;
    let p, oldname = stack_array(char, BUFSZ), l_oldname = stack_array(char, BUFSZ);

    /* Riders are immune to polymorph and green slime
       (but apparent Rider might actually be a doppelganger) */
    if (mtmp.cham == NON_PM) { /* not a shapechanger */
        if (is_rider(olddata))
            return 0;
        /* make Nazgul and erinyes immune too, to reduce chance of
           anomalous extinction feedback during final disclosure */
        if (mbirth_limit(monsndx(olddata)) < MAXMONNO)
            return 0;
        /* cancelled shapechangers become uncancelled prior
           to being given a new shape */
        if (mtmp.mcan && !Protection_from_shape_changers()) {
            mtmp.cham = pm_to_cham(monsndx(mtmp.data));
            if (mtmp.cham != NON_PM)
                mtmp.mcan = 0;
        }
    }

    if (msg) {
        strcpy(oldname, x_monnam(mtmp, mtmp.mtame ? ARTICLE_YOUR : ARTICLE_THE,
                        0, SUPPRESS_SADDLE, FALSE))

;
        chars[oldname + 0] = highc(chars[oldname + 0]);
    }
    /* we need this one whether msg is true or not */
    strcpy(l_oldname, x_monnam(mtmp, ARTICLE_THE, 0,
                               has_mgivenname(mtmp) ? SUPPRESS_SADDLE : 0,
                               FALSE));

    /* mdat = 0 -> caller wants a random monster shape */
    if (mdat == null) {
        /* select_newcham_form() loops when resorting to random but
           it doesn't always pick that so we still retry here too */
        tryct = 20;
        do {
            mndx = select_newcham_form(mtmp);
            mdat = accept_newcham_form(mtmp, mndx);
            /* for the first several tries we require upper-case on
               the rogue level (after that, we take whatever we get) */
            if (tryct > 15 && Is_rogue_level(u.uz)
                && mdat && !(0 ? isupper(monsym(mdat)) : ((unsigned((unsigned((monsym(mdat))) - ord("A")))) < 26)))
                mdat = null;
            if (mdat)
                break;
        } while (--tryct > 0);
        if (!tryct)
            return 0;
    } else if (svm.mvitals[monsndx(mdat)].mvflags & G_GENOD)
        return 0; /* passed in mdat is genocided */

    if (mdat == olddata)
        return 0; /* still the same monster */

    mgender_from_permonst(mtmp, mdat);
    /* Endgame mplayers start out as "Foo the Bar", but some of the
     * titles are inappropriate when polymorphed, particularly into
     * the opposite sex.  Player characters don't use ranks when
     * polymorphed, so dropping rank for mplayers seems reasonable.
     */
    if (In_endgame(u.uz) && is_mplayer(olddata)
        && has_mgivenname(mtmp)
        && (p = strstr(MGIVENNAME(mtmp), _(" the "))) != 0)
        chars[p] = ord('\0');

    if (mtmp.wormno) { /* throw tail away */
        let mx = mtmp.mx, my = mtmp.my;

        wormgone(mtmp); /* discards tail segments, takes head off the map */
        /* put the head back; it will morph into mtmp's new form */
        place_monster(mtmp, mx, my);
    }
    if (M_AP_TYPE(mtmp) && mdat.mlet != S_MIMIC)
        seemimic(mtmp); /* revert to normal monster */

    /* (this code used to try to adjust the monster's health based on
       a normal one of its type but there are too many special cases
       which need to be handled in order to do that correctly, so just
       give the new form the same proportion of HP as its old one had) */
    hpn = mtmp.mhp;
    hpd = mtmp.mhpmax;
    /* set level and hit points */
    newmonhp(mtmp, monsndx(mdat));
    /* new hp: same fraction of max as before */
    mtmp.mhp = int(Math.trunc((hpn * mtmp.mhp) / hpd));
    /* sanity check (potential overflow) */
    if (mtmp.mhp < 0 || mtmp.mhp > mtmp.mhpmax)
        mtmp.mhp = mtmp.mhpmax;
    /* unlikely but not impossible; a 1HD creature with 1HP that changes
       into a 0HD creature will require this statement */
    if (!mtmp.mhp)
        mtmp.mhp = 1;

    /* take on the new form... */
    set_mon_data(mtmp, mdat);

    if (mtmp.mleashed) {
        if (!leashable(mtmp))
            m_unleash(mtmp, TRUE);
        else
            /* if leashed, persistent inventory window needs updating
               (really only when mon_nam() is going to yield "a frog"
               rather than "Kermit" but no need to micromanage here) */
            update_inventory(); /* x - leash (attached to a <mon>) */
    }

    if (emits_light(olddata) != emits_light(mtmp.data)) {
        /* used to give light, now doesn't, or vice versa,
           or light's range has changed */
        if (emits_light(olddata))
            del_light_source(LS_MONSTER, monst_to_any(mtmp));
        if (emits_light(mtmp.data))
            new_light_source(mtmp.mx, mtmp.my, emits_light(mtmp.data),
                             LS_MONSTER, monst_to_any(mtmp));
    }
    if (!mtmp.perminvis || pm_invisible(olddata))
        mtmp.perminvis = pm_invisible(mdat);
    mtmp.minvis = mtmp.invis_blkd ? 0 : mtmp.perminvis;
    if (mtmp.mundetected)
        hideunder(mtmp);
    if (u.ustuck == mtmp) {
        if (u.uswallow) {
            if (!attacktype(mdat, AT_ENGL)) {
                /* Does mdat care? */
                if (!noncorporeal(mdat) && !is_whirly(mdat)
                    && !(amorphous(mdat) || mdat.mlet == S_LIGHT)) {
                    let msgtrail = stack_array(char, BUFSZ);

                    if (is_vampshifter(mtmp)) {
                        sprintf(msgtrail, _(" which was a shapeshifted %s"), noname_monnam(mtmp, ARTICLE_NONE))
;
                    } else if (digests(mdat)) {
                        strcpy(msgtrail, _("'s stomach"));
                    } else {
                        chars[msgtrail + 0] = ord('\0');
                    }
                    /* Do this even if msg is FALSE */
                    You(_("%s %s%s!"),
                        (amorphous(olddata) || is_whirly(olddata))
                            ? _("emerge from") : _("break out of"),
                        l_oldname, msgtrail);
                    msg = FALSE; /* message has been given */
                    mtmp.mhp = 1; /* almost dead */
                }
                expels(mtmp, olddata, FALSE);
            } else {
                /* update swallow glyphs for new monster */
                swallowed(0);
            }
        } else if ((!sticks(mdat) && !sticks(gy.youmonst.data))
                   /* sticky hero can't continue to hold mtmp if it has
                      turned into a non-solid creature; we don't use
                      uunstick() for that because its message would be
                      shown out of sequence [before 'if (msg)' below];
                      unstuck() doesn't issue any messages */
                   || unsolid(mdat)) {
            unstuck(mtmp);
        }
    }

    if (mdat == mons[PM_LONG_WORM] && int((mtmp.wormno = unsigned(get_wormno()))) != 0) {
        initworm(mtmp, rn2(5));
        place_worm_tail_randomly(mtmp, mtmp.mx, mtmp.my);
    }

    mtmp.meverseen = 0; /* never seen mon in present shape; newsym() ->
                          * display_monster() may change it right back */
    newsym(mtmp.mx, mtmp.my);

    if (msg) {
        /* oldname is capitalized and might be an assigned name */
        if (!canspotmon(mtmp)) { /* can't see or sense it now */
            if (seenorsensed) /* could see or sense it before */
                pline_mon(mtmp, _("%s disappears!"), oldname);
            usmellmon(mdat);
        } else if (!seenorsensed) { /* couldn't see/sense before, can now */
            let mnm = x_monnam(mtmp, mtmp.mtame ? ARTICLE_YOUR : ARTICLE_A,
                                 0, 0, FALSE);

            pline_mon(mtmp, _("%s appears!"), upstart(mnm));
        } else { /* saw/sensed it before, still see/sense it now */
            pline_mon(mtmp, _("%s turns into %s!"), oldname,
                      /* "a <monster type>" even if it has a name assigned */
                      noname_monnam(mtmp, ARTICLE_A));
        }
    }

    /* when polymorph trap/wand/potion produces a vampire, turn in into
       a full-fledged vampshifter unless shape-changing is blocked */
    if (mtmp.cham == NON_PM && mdat.mlet == S_VAMPIRE
        && !Protection_from_shape_changers())
        mtmp.cham = pm_to_cham(monsndx(mdat));

    possibly_unwield(mtmp, polyspot); /* might lose use of weapon */
    mon_break_armor(mtmp, polyspot);
    if (!(mtmp.misc_worn_check & W_ARMG))
        mselftouch(mtmp, _("No longer petrify-resistant, "),
                   +!svc.context.mon_moving);
    check_gear_next_turn(mtmp);

    /* This ought to re-test can_carry() on each item in the inventory
     * rather than just checking ex-giants & boulders, but that'd be
     * pretty expensive to perform.  If implemented, then perhaps
     * minvent should be sorted in order to drop heaviest items first.
     */
    /* former giants can't continue carrying boulders */
    if (mtmp.minvent && !throws_rocks(mdat)) {
        let otmp, otmp2;

        /* DEADMONSTER(): it is possible for flooreffects() to kill mtmp;
           the rest of its inventory would be dropped making otmp2 stale */
        for (otmp = mtmp.minvent; otmp && !DEADMONSTER(mtmp); otmp = otmp2) {
            otmp2 = otmp.nobj;
            if (otmp.otyp == BOULDER) {
                /* this keeps otmp from being polymorphed in the
                   same zap that the monster that held it is polymorphed */
                if (polyspot)
                    bypass_obj(otmp);
                obj_extract_self(otmp);
                /* probably ought to give some "drop" message here */
                if (flooreffects(otmp, mtmp.mx, mtmp.my, _("")))
                    continue;
                place_object(otmp, mtmp.mx, mtmp.my);
            }
        }
    }
    if (mtmp == u.usteed)
        poly_steed(mtmp, olddata);

    /* old form might not have been affected by Elbereth but perhaps the
       new form is */
    if (svc.context.mon_moving) {
        /* give 'mtmp' a new chance to pinpoint hero's location */
        if (!(((mtmp.mux) == u.ux) && ((mtmp.muy) == u.uy)))
            set_apparxy(mtmp);
        /* if hero is on Elbereth or scare monster, mtmp in new form might
           become scared */
        if (!mtmp.mpeaceful
            && onscary(mtmp.mux, mtmp.muy, mtmp)
            && monnear(mtmp, mtmp.mux, mtmp.muy))
            monflee(mtmp, rn1(9, 2), TRUE, TRUE); /* 2..10 turns */
    }

    return 1;
    } finally { stack_pop($frame); }
}

/* sometimes an egg will be special */
export function BREEDER_EGG() { return (+!rn2(77)); }

/*
 * Determine if the given monster number can be hatched from an egg.
 * Return the monster number to use as the egg's corpsenm.  Return
 * NON_PM if the given monster can't be hatched.
 */
export function can_be_hatched(mnum) { /* int */
    /* ranger quest nemesis has the oviparous bit set, making it
       be possible to wish for eggs of that unique monster; turn
       such into ordinary eggs rather than forbidding them outright */
    if (mnum == PM_SCORPIUS)
        mnum = PM_SCORPION;

    mnum = little_to_big(mnum);
    /*
     * Queen bees lay killer bee eggs (usually), but killer bees don't
     * grow into queen bees.  Ditto for [winged-]gargoyles.
     */
    if (mnum == PM_KILLER_BEE || mnum == PM_GARGOYLE
        || (lays_eggs(mons[mnum])
            && (BREEDER_EGG()
                || (mnum != PM_QUEEN_BEE && mnum != PM_WINGED_GARGOYLE))))
        return mnum;
    return NON_PM;
}

/* type of egg laid by #sit; usually matches parent */
export function egg_type_from_parent(
    mnum,
    force_ordinary) { /* int */
    if (force_ordinary || !BREEDER_EGG()) {
        if (mnum == PM_QUEEN_BEE)
            mnum = PM_KILLER_BEE;
        else if (mnum == PM_WINGED_GARGOYLE)
            mnum = PM_GARGOYLE;
    }
    return mnum;
}

/* decide whether an egg of the indicated monster type is viable;
   also used to determine whether an egg or tin can be created... */
export function dead_species(m_idx, egg) { /* boolean */
    let alt_idx;

    /* generic eggs are unhatchable and have corpsenm of NON_PM */
    if (m_idx < LOW_PM)
        return TRUE;
    /*
     * For monsters with both baby and adult forms, genociding either
     * form kills all eggs of that monster.  Monsters with more than
     * two forms (small->large->giant mimics) are more or less ignored;
     * fortunately, none of them have eggs.  Species extinction due to
     * overpopulation does not kill eggs.
     */
    /* assert(ismnum(m_idx)); */
    alt_idx = egg ? big_to_little(m_idx) : m_idx;
    return (+((svm.mvitals[m_idx].mvflags & G_GENOD) != 0
                      || (svm.mvitals[alt_idx].mvflags & G_GENOD) != 0));
}

/* kill off any eggs of genocided monsters */
function kill_eggs(obj_list) { /* void */
    let otmp;

    for (otmp = obj_list; otmp; otmp = otmp.nobj)
        if (otmp.otyp == EGG) {
            if (dead_species(otmp.corpsenm, TRUE)) {
                /*
                 * It seems we could also just catch this when
                 * it attempted to hatch, so we wouldn't have to
                 * search all of the objlists.. or stop all
                 * hatch timers based on a corpsenm.
                 */
                kill_egg(otmp);
            }
        } else if (Has_contents(otmp)) {
            kill_eggs(otmp.cobj);
        }
}

/* kill all members of genocided species */
export function kill_genocided_monsters() { /* void */
    let mtmp, mtmp2;
    let kill_cham;
    let mndx;

    /*
     * Called during genocide, and again upon level change.  The latter
     * catches up with any migrating monsters as they finally arrive at
     * their intended destinations, so possessions get deposited there.
     *
     * Chameleon handling:
     *  1) if chameleons have been genocided, destroy them
     *     regardless of current form;
     *  2) otherwise, force every chameleon which is imitating
     *     any genocided species to take on a new form.
     */
    for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
        mtmp2 = mtmp.nmon;
        if (DEADMONSTER(mtmp))
            continue;
        mndx = monsndx(mtmp.data);
        kill_cham = (ismnum(mtmp.cham)
                     && (svm.mvitals[mtmp.cham].mvflags & G_GENOD) ? 1 : 0);
        if ((svm.mvitals[mndx].mvflags & G_GENOD) || kill_cham) {
            if (ismnum(mtmp.cham) && !kill_cham)
                newcham(mtmp, null, NC_SHOW_MSG);
            else
                mondead(mtmp);
        }
        if (mtmp.minvent)
            kill_eggs(mtmp.minvent);
    }

    kill_eggs(gi.invent);
    kill_eggs(fobj());
    kill_eggs(gm.migrating_objs);
    kill_eggs(svl.level.buriedobjlist);
}

export function golemeffects(mon, damtype, dam) { /* void */
    let heal = 0, slow = 0;

    if (mon.data == mons[PM_FLESH_GOLEM]) {
        if (damtype == AD_ELEC)
            heal = Math.trunc((dam + 5) / 6);
        else if (damtype == AD_FIRE || damtype == AD_COLD)
            slow = 1;
    } else if (mon.data == mons[PM_IRON_GOLEM]) {
        if (damtype == AD_ELEC)
            slow = 1;
        else if (damtype == AD_FIRE)
            heal = dam;
    } else {
        return;
    }
    if (slow) {
        if (mon.mspeed != MSLOW)
            mon_adjust_speed(mon, -1, null);
    }
    if (heal) {
        if (healmon(mon, heal, 0)) {
            if (cansee(mon.mx, mon.my))
                pline_mon(mon, _("%s seems healthier."), Monnam(mon));
        }
    }
}

/* anger the Minetown watch */
export function angry_guards(silent) { /* boolean */
    const $frame = stack_frame(); try {
    let mtmp;
    let ct = 0, nct = 0, sct = 0, slct = 0;

    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;
        if (is_watch(mtmp.data) && mtmp.mpeaceful) {
            ct++;
            if (canspotmon(mtmp) && mtmp.mcanmove) {
                if (m_next2u(mtmp))
                    nct++;
                else
                    sct++;
            }
            if (mtmp.msleeping || mtmp.mfrozen) {
                slct++;
                mtmp.msleeping = mtmp.mfrozen = 0;
            }
            mtmp.mpeaceful = 0;
        }
    }
    if (ct) {
        if (!silent) { /* do we want pline msgs? */
            let buf = stack_array(char, BUFSZ);

            if (slct) { /* sleeping guard(s) */
                sprintf(buf, _("guard%s"), plur(slct));
                pline_The(_("%s %s up."), buf, vtense(buf, _("wake")));
            }

            if (nct) { /* seen/sensed adjacent guard(s) */
                sprintf(buf, _("guard%s"), plur(nct));
                pline_The(_("%s %s angry!"), buf, vtense(buf, _("get")));
            } else if (sct) { /* seen/sensed non-adjacent guard(s) */
                sprintf(buf, _("guard%s"), plur(sct));
                pline(_("%s %s %s approaching!"),
                      (sct == 1) ? _("An angry") : _("Angry"),
                      buf, vtense(buf, _("are")));
            } else {
                strcpy(buf, (ct == 1) ? _("a guard's") : _("guards'"));
                 ;
                You_hear(_("the shrill sound of %s whistle%s."), buf, plur(ct));
            }
        }
        return TRUE;
    }
    return FALSE;
    } finally { stack_pop($frame); }
}

function pacify_guard(mtmp) { /* void */
    if (is_watch(mtmp.data))
        mtmp.mpeaceful = 1;
}

export function pacify_guards() { /* void */
    iter_mons(pacify_guard);
}

export function mimic_hit_msg(mtmp, otyp) { /* void */
    let ap = short(mtmp.mappearance);

    switch (M_AP_TYPE(mtmp)) {
    case M_AP_NOTHING:
    case M_AP_FURNITURE:
    case M_AP_MONSTER:
        break;
    case M_AP_OBJECT:
        if (otyp == SPE_HEALING || otyp == SPE_EXTRA_HEALING) {
            pline_mon(mtmp, _("%s seems a more vivid %s than before."),
                  The(simple_typename(ap)),
                  c_obj_colors[objects[ap].oc_color]);
        }
        break;
    }
}

export function usmellmon(mdat) { /* boolean */
    let mndx;
    let nonspecific = FALSE;
    let msg_given = FALSE;

    if (mdat) {
        if (!olfaction(gy.youmonst.data))
            return FALSE;
        mndx = monsndx(mdat);
        switch (mndx) {
        case PM_ROTHE:
        case PM_MINOTAUR:
            You(_("notice a bovine smell."));
            msg_given = TRUE;
            break;
        case PM_CAVE_DWELLER:
        case PM_BARBARIAN:
        case PM_NEANDERTHAL:
            You(_("smell body odor."));
            msg_given = TRUE;
            break;
        /*
        case PM_PESTILENCE:
        case PM_FAMINE:
        case PM_DEATH:
            break;
        */
        case PM_HORNED_DEVIL:
        case PM_BALROG:
        case PM_ASMODEUS:
        case PM_DISPATER:
        case PM_YEENOGHU:
        case PM_ORCUS:
            break;
        case PM_HUMAN_WEREJACKAL:
        case PM_HUMAN_WERERAT:
        case PM_HUMAN_WEREWOLF:
        case PM_WEREJACKAL:
        case PM_WERERAT:
        case PM_WEREWOLF:
        case PM_OWLBEAR:
            You(_("detect an odor reminiscent of an animal's den."));
            msg_given = TRUE;
            break;
        /*
        case PM_PURPLE_WORM:
            break;
        */
        case PM_STEAM_VORTEX:
            You(_("smell steam."));
            msg_given = TRUE;
            break;
        case PM_GREEN_SLIME:
            pline(_("%s stinks."), Something());
            msg_given = TRUE;
            break;
        case PM_VIOLET_FUNGUS:
        case PM_SHRIEKER:
            You(_("smell mushrooms."));
            msg_given = TRUE;
            break;
        /* These are here to avoid triggering the
           nonspecific treatment through the default case below*/
        case PM_WHITE_UNICORN:
        case PM_GRAY_UNICORN:
        case PM_BLACK_UNICORN:
        case PM_JELLYFISH:
            break;
        default:
            nonspecific = TRUE;
            break;
        }

        if (nonspecific)
            switch (mdat.mlet) {
            case S_DOG:
                You(_("notice a dog smell."));
                msg_given = TRUE;
                break;
            case S_DRAGON:
                You(_("smell a dragon!"));
                msg_given = TRUE;
                break;
            case S_FUNGUS:
                pline(_("%s smells moldy."), Something());
                msg_given = TRUE;
                break;
            case S_UNICORN:
                You(_("detect a%s odor reminiscent of a stable."),
                    (mndx == PM_PONY) ? _("n") : _(" strong"));
                msg_given = TRUE;
                break;
            case S_ZOMBIE:
                You(_("smell rotting flesh."));
                msg_given = TRUE;
                break;
            case S_EEL:
                You(_("smell fish."));
                msg_given = TRUE;
                break;
            case S_ORC:
                if ((Upolyd() ? (is_orc(gy.youmonst.data)) : (Race_if(PM_ORC))))
                    You(_("notice an attractive smell."));
                else
                    pline(_("A foul stench makes you feel a little nauseated."));
                msg_given = TRUE;
                break;
            default:
                break;
            }
    }
    return msg_given ? TRUE : FALSE;
}

/* setting misc_worn_check's I_SPECIAL bit flags a monster to reassess
   and potentially re-equip gear at the start of its next move;
   this hides the details of that */
export function check_gear_next_turn(mon) { /* void */
    mon.misc_worn_check = or64(mon.misc_worn_check, I_SPECIAL);
}

/* make erinyes more dangerous based on your alignment abuse */
export function adj_erinys(abuse) { /* void */
    let pm = mons[PM_ERINYS];

    if (abuse > 5) {
        pm.mflags1 = or64u(pm.mflags1, M1_SEE_INVIS);
    }
    if (abuse > 10) {
        pm.mflags1 = or64u(pm.mflags1, M1_AMPHIBIOUS);
    }
    if (abuse > 15) {
        pm.mflags1 = or64u(pm.mflags1, M1_FLY);
    }
    if (abuse > 20) {
        /* more powerful attack */
        pm.mattk[0].damn = 3;
    }
    if (abuse > 25) {
        pm.mflags1 = or64u(pm.mflags1, M1_REGEN);
    }
    if (abuse > 30) {
        pm.mflags1 = or64u(pm.mflags1, M1_TPORT_CNTRL);
    }
    if (abuse > 35) {
        /* second attack */
        pm.mattk[1].aatyp = AT_WEAP;
        pm.mattk[1].adtyp = AD_DRST;
        pm.mattk[1].damn = 3;
        pm.mattk[1].damd = 4;
    }
    if (abuse > 40) {
        pm.mflags1 = or64u(pm.mflags1, M1_TPORT);
    }
    if (abuse > 50) {
        /* third (spellcasting) attack */
        pm.mattk[2].aatyp = AT_MAGC;
        pm.mattk[2].adtyp = AD_SPEL;
        pm.mattk[2].damn = 3;
        pm.mattk[2].damd = 4;
    }

    /* also adjust level and difficulty */
    pm.mlevel = schar(min(unsigned(7 + u.ualign.abuse), 50));
    pm.difficulty = uchar(min(unsigned(10 + Math.trunc(u.ualign.abuse / 3)), 25));
}

/* mark individual monster type as seen from close-up,
   if we haven't seen it nearby before */
export function see_monster_closeup(mtmp, photo) { /* void */
    let mndx;

    if (Hallucination() || (Blind() && !Blind_telepat()))
        return;

    mndx = monsndx(mtmp.data);
    if (M_AP_TYPE(mtmp) == M_AP_MONSTER && !sensemon(mtmp))
        mndx = int(mtmp.mappearance);
    if (mndx == PM_LONG_WORM && gn.notonhead)
        mndx = PM_LONG_WORM_TAIL;

    if (!svm.mvitals[mndx].seen_close) {
        svm.mvitals[mndx].seen_close = 1;
        svc.context.lifelist.total_seen_upclose++;
    }

    /* hallucinatory monsters don't reach here--they're not recorded;
       being able to see invisible doesn't make invisible monsters show up
       on photos; likewise, telepathy allows hero to see hidden monsters
       but doesn't cause them to appear on photos */
    if (photo && !mtmp.minvis && !mtmp.mundetected
        && (M_AP_TYPE(mtmp) == M_AP_NOTHING
            || M_AP_TYPE(mtmp) == M_AP_MONSTER)) {
        if (M_AP_TYPE(mtmp) == M_AP_MONSTER) /* cloned Wizard of Yendor */
            mndx = int(mtmp.mappearance);

        if (!svm.mvitals[mndx].photographed) {
            svm.mvitals[mndx].photographed = 1;
            svc.context.lifelist.total_photographed++;

            /* tourist earns points (toward EXP but not final score) for
               the first instance of each type of monster photographed;
               worm tail can be photographed but yields no EXP bonus */
            if (Role_if(PM_TOURIST)
                /* suppress extra points for photographing the pet that hero
                   started with (unless it has changed shape due to growing
                   up or being polymorphed) */
                && (mtmp.m_id != svc.context.startingpet_mid
                    || mndx != svc.context.startingpet_typ)
                /* monsndx() check covers worm tail and also disguised
                   Wizard of Yendor; experienced() won't yield a reasonable
                   value for those */
                && mndx == monsndx(mtmp.data)) {
                more_experienced(experience(mtmp, 0), 0);
                newexplevel();
            }
        }
    }
}

/* mark a monster type as seen close-up when we see it next to us */
export function see_nearby_monsters() { /* void */
    let mtmp;
    let mndx;
    let x, y;

    if (Hallucination() || (Blind() && !Blind_telepat()))
        return;

    for (x = u.ux - 1; x <= u.ux + 1; x++)
        for (y = u.uy - 1; y <= u.uy + 1; y++) {
            if (!isok(x, y))
                continue;
            if (!(mtmp = m_at(x, y)))
                continue;
            mndx = monsndx(mtmp.data);
            if (M_AP_TYPE(mtmp) == M_AP_MONSTER)
                mndx = int(mtmp.mappearance);
            /* skip closeup handling if this mon type has already been done */
            if (svm.mvitals[mndx].seen_close)
                continue;
            /* disguised mimics pass canseemon(); undetected hiders don't */
            if (canseemon(mtmp) || (mtmp.mundetected && sensemon(mtmp))) {
                gb.bhitpos.x = x, gb.bhitpos.y = y;
                gn.notonhead = +(x != mtmp.mx || y != mtmp.my);
                see_monster_closeup(mtmp, FALSE);
            }
        }
}

/* monster resists something.
   make a shield effect at monster's location and give a message */
export function shieldeff_mon(mtmp) { /* void */
    shieldeff(mtmp.mx, mtmp.my);
    /* does not depend on seeing the monster; the shield effect is visible */
    if (cansee(mtmp.mx, mtmp.my))
        pline_mon(mtmp, _("%s resists!"), Monnam(mtmp));
}

export function flash_mon(mtmp) { /* void */
    let mx = mtmp.mx, my = mtmp.my;
    let count = couldsee(mx, my) ? 8 : 4;
    let saveviz = char(uchars[gv.viz_array[my] + mx]);

    if (!flags.sparkle)
        count = Math.trunc(count / 2);
    uchars[gv.viz_array[my] + mx] |= (IN_SIGHT | COULD_SEE);
    flash_glyph_at(mx, my, mon_to_glyph(mtmp, newsym_rn2), count);
    uchars[gv.viz_array[my] + mx] = uchar(saveviz);
    newsym(mx, my);
}

/* cleanup for 'onefile' processing */

/*mon.c*/

import { A_CHAOTIC, A_NONE } from "./align.h.js";
import { ALIGNLIM } from "./align.h.macros.js";
import { struct_nhcoord } from "./coord.h.js";
import { Something, thats_enough_tries } from "./decl.h.macros.js";
import {
    COIN_CLASS, FOOD_CLASS, GEM_CLASS, POTION_CLASS, RANDOM_CLASS, ROCK_CLASS, SCROLL_CLASS, S_BAT,
    S_DOG, S_DRAGON, S_EEL, S_ELEMENTAL, S_FUNGUS, S_GHOST, S_GIANT, S_GNOME, S_GOLEM, S_HUMAN,
    S_HUMANOID, S_KOBOLD, S_KOP, S_LICH, S_LIGHT, S_MIMIC, S_NYMPH, S_ORC, S_UNICORN, S_VAMPIRE,
    S_VORTEX, S_ZOMBIE, S_poisoncloud,
} from "./defsym.h.js";
import { EXPL_FIERY } from "./display.h.js";
import {
    canspotmon, cmap_to_glyph, glyph_is_invisible, mon_to_glyph, newsym_rn2,
} from "./display.h.macros.js";
import { MIGR_APPROX_XY, MIGR_RANDOM, struct_d_level } from "./dungeon.h.js";
import {
    In_endgame, Is_astralevel, Is_rogue_level, Is_stronghold, Is_waterlevel,
} from "./dungeon.h.macros.js";
import { GPCOORDS_MAP, GPCOORDS_NONE, PLNMSG_GROWL, PLNMSG_HIDE_UNDER } from "./flag.h.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, LARGEST_INT, LL_ACHIEVE, LL_CONDUCT, LL_KILLEDPET, LL_UMONST, MAXMONNO,
    QBUFSZ, ROWNO, TRUE, boolean,
} from "./global.h.js";
import {
    ARTICLE_A, ARTICLE_NONE, ARTICLE_THE, ARTICLE_YOUR, AUGMENT_IT, BOLT_LIM, CORPSTAT_BURIED,
    CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_INIT, CORPSTAT_MALE, CORPSTAT_NONE,
    DISMOUNT_GENERIC, EXACT_NAME, KILLED_BY_AN, M_POISONGAS_BAD, M_POISONGAS_MINOR, M_POISONGAS_OK,
    NC_SHOW_MSG, NC_VIA_WAND_OR_SPELL, NO_MM_FLAGS, NO_NC_FLAGS, ONAME_NO_FLAGS, RLOC_MSG,
    RLOC_NOMSG, STOMACH, SUPPRESS_HALLUCINATION, SUPPRESS_INVISIBLE, SUPPRESS_IT, SUPPRESS_NAME,
    SUPPRESS_SADDLE, TAINT_AGE, XKILL_GIVEMSG, XKILL_NOCONDUCT, XKILL_NOCORPSE, XKILL_NOMSG,
} from "./hack.h.js";
import {
    Maybe_Half_Phys, NODIAG, makeknown, max, mdistu, min, pline1, plur, rn1,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { showdebug } from "./lint.h.macros.js";
import {
    EBONES, EDOG, EGD, EMIN, EPRI, ESHK, MCORPSENM, MGIVENNAME, has_ebones, has_edog, has_egd,
    has_emin, has_epri, has_eshk, has_mcorpsenm, has_mgivenname,
} from "./mextra.h.macros.js";
import {
    ALLOW_ALL, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_SANCT, ALLOW_SSM,
    ALLOW_TM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, BUSTDOOR, NOGARLIC, NOTONL, OPENDOOR, UNLOCKDOOR,
    struct_mfndposdata,
} from "./mfndpos.h.js";
import { SHOPBASE, TEMPLE } from "./mkroom.h.js";
import {
    AD_COLD, AD_CORR, AD_DCAY, AD_DGST, AD_DRST, AD_ELEC, AD_FIRE, AD_RBRE, AD_RUST, AD_SEDU,
    AD_SPEL, AD_SSEX, AD_STCK, AT_BOOM, AT_BREA, AT_ENGL, AT_EXPL, AT_GAZE, AT_HUGS, AT_MAGC,
    AT_WEAP,
} from "./monattk.h.js";
import {
    acidic, always_hostile, amorphous, bigmonst, breathless, can_teleport, cant_drown,
    ceiling_hider, completelyburns, completelyrots, completelyrusts, digests, emits_light,
    flesh_petrifies, has_head, hides_under, humanoid, immune_poisongas, is_animal, is_clinger,
    is_covetous, is_displacer, is_dwarf, is_elf, is_female, is_floater, is_flyer, is_giant,
    is_gnome, is_golem, is_hider, is_human, is_male, is_minion, is_mplayer, is_neuter, is_orc,
    is_placeholder, is_reviver, is_rider, is_shapeshifter, is_swimmer, is_undead, is_unicorn,
    is_vampire, is_watch, is_were, is_whirly, lays_eggs, likes_lava, mindless, monsndx, monsym,
    needspick, nohands, noncorporeal, nonliving, notake, passes_walls, perceives, pm_invisible,
    polyok, slimeproof, strongmonst, throws_rocks, touch_petrifies, tunnels, unique_corpstat,
    unsolid, vegan, verysmall,
} from "./mondata.h.macros.js";
import {
    G_FREQ, G_GENOD, G_NOCORPSE, G_UNIQ, M1_AMPHIBIOUS, M1_FLY, M1_NOHANDS, M1_REGEN, M1_SEE_INVIS,
    M1_TPORT, M1_TPORT_CNTRL, M2_COLLECT, MR_STONE, MS_GUARDIAN, MS_LEADER, MS_NEMESIS, MS_SHRIEK,
    MZ_HUMAN, MZ_TINY, NEUTRAL,
} from "./monflag.h.js";
import {
    MFAST, MON_DETACH, MON_ENDGAME_FREE, MON_ENDGAME_MIGR, MON_LIMBO, MON_MIGRATING, MON_OBLITERATE,
    MON_OFFMAP, MSLOW, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, NO_WEAPON_WANTED,
    STRAT_WAITFORU, STRAT_WAITMASK, struct_monst,
} from "./monst.h.js";
import {
    DEADMONSTER, MON_WEP, M_AP_TYPE, engulfing_u, is_lightblocker_mappear, is_vampshifter, ismnum,
    mon_offmap, monmax_difficulty_lev, montoostrong, resists_fire, resists_poison, resists_ston,
} from "./monst.h.macros.js";
import {
    HIGH_PM, LEAVESTATUE, LOW_PM, NON_PM, NUMMONS, PM_ABBOT, PM_ACOLYTE, PM_APPRENTICE,
    PM_ARCHEOLOGIST, PM_ARCHON, PM_ASMODEUS, PM_ATTENDANT, PM_BABY_PURPLE_WORM, PM_BALROG,
    PM_BARBARIAN, PM_BLACK_DRAGON, PM_BLACK_PUDDING, PM_BLACK_UNICORN, PM_BLUE_DRAGON,
    PM_BROWN_PUDDING, PM_CAVE_DWELLER, PM_CHAMELEON, PM_CHIEFTAIN, PM_CLAY_GOLEM, PM_CLERIC,
    PM_DISPATER, PM_DOPPELGANGER, PM_DWARF, PM_DWARF_MUMMY, PM_DWARF_ZOMBIE, PM_ELF, PM_ELF_MUMMY,
    PM_ELF_ZOMBIE, PM_ERINYS, PM_ETTIN, PM_ETTIN_MUMMY, PM_ETTIN_ZOMBIE, PM_FLESH_GOLEM,
    PM_FLOATING_EYE, PM_FOG_CLOUD, PM_GARGOYLE, PM_GELATINOUS_CUBE, PM_GHOUL, PM_GIANT,
    PM_GIANT_MIMIC, PM_GIANT_MUMMY, PM_GIANT_ZOMBIE, PM_GLASS_GOLEM, PM_GNOME, PM_GNOME_MUMMY,
    PM_GNOME_ZOMBIE, PM_GOLD_DRAGON, PM_GOLD_GOLEM, PM_GRAY_DRAGON, PM_GRAY_OOZE, PM_GRAY_UNICORN,
    PM_GREEN_DRAGON, PM_GREEN_SLIME, PM_GREMLIN, PM_GUIDE, PM_HEALER, PM_HIGH_CLERIC,
    PM_HORNED_DEVIL, PM_HUMAN, PM_HUMAN_MUMMY, PM_HUMAN_WEREJACKAL, PM_HUMAN_WERERAT,
    PM_HUMAN_WEREWOLF, PM_HUMAN_ZOMBIE, PM_HUNTER, PM_IRON_GOLEM, PM_JABBERWOCK, PM_JELLYFISH,
    PM_KILLER_BEE, PM_KNIGHT, PM_KOBOLD, PM_KOBOLD_MUMMY, PM_KOBOLD_ZOMBIE, PM_LARGE_MIMIC,
    PM_LEATHER_GOLEM, PM_LIZARD, PM_LONG_WORM, PM_LONG_WORM_TAIL, PM_MAIL_DAEMON, PM_MEDUSA,
    PM_MINOTAUR, PM_MONK, PM_NEANDERTHAL, PM_ORANGE_DRAGON, PM_ORC, PM_ORCUS, PM_ORC_MUMMY,
    PM_ORC_ZOMBIE, PM_OWLBEAR, PM_PAGE, PM_PAPER_GOLEM, PM_PONY, PM_PURPLE_WORM, PM_PYROLISK,
    PM_QUEEN_BEE, PM_RANGER, PM_RED_DRAGON, PM_ROGUE, PM_ROPE_GOLEM, PM_ROSHI, PM_ROTHE,
    PM_RUST_MONSTER, PM_SAMURAI, PM_SANDESTIN, PM_SCORPION, PM_SCORPIUS, PM_SHRIEKER,
    PM_SILVER_DRAGON, PM_SKELETON, PM_SMALL_MIMIC, PM_STALKER, PM_STEAM_VORTEX, PM_STONE_GOLEM,
    PM_STUDENT, PM_THUG, PM_TOURIST, PM_VALKYRIE, PM_VAMPIRE, PM_VAMPIRE_BAT, PM_VAMPIRE_LEADER,
    PM_VIOLET_FUNGUS, PM_VLAD_THE_IMPALER, PM_WARRIOR, PM_WEREJACKAL, PM_WERERAT, PM_WEREWOLF,
    PM_WHITE_DRAGON, PM_WHITE_UNICORN, PM_WINGED_GARGOYLE, PM_WIZARD, PM_WIZARD_OF_YENDOR, PM_WOLF,
    PM_WOOD_GOLEM, PM_YEENOGHU, PM_YELLOW_DRAGON, SPECIAL_PM,
} from "./monsters.h.js";
import { OBJ_BURIED, OBJ_FLOOR, OBJ_MINVENT, struct_obj } from "./obj.h.js";
import {
    Dragon_mail_to_pm, Dragon_scales_to_pm, Has_contents, Is_dragon_mail, Is_dragon_scales, is_axe,
    is_mines_prize, is_pick, is_soko_prize, mhealup, mlevelgain, ofood, polyfood,
} from "./obj.h.macros.js";
import { GOLD, NUM_GLASS_GEMS, SILVER } from "./objclass.h.js";
import { is_metallic, is_organic, is_rustprone } from "./objclass.h.macros.js";
import {
    AMULET_OF_LIFE_SAVING, AMULET_OF_STRANGULATION, AXE, BATTLE_AXE, BELL_OF_OPENING, BOOMERANG,
    BOULDER, BULLWHIP, CARROT, CLOVE_OF_GARLIC, CLUB, CORPSE, DWARVISH_MATTOCK, EGG, ELVEN_SPEAR,
    FIGURINE, FIRST_GLASS_GEM, GLOB_OF_BLACK_PUDDING, GLOB_OF_GREEN_SLIME, GRAPPLING_HOOK,
    GRAY_DRAGON_SCALES, ICE_BOX, IRON_CHAIN, LEASH, LEATHER_ARMOR, LEATHER_CLOAK, PICK_AXE,
    QUARTERSTAFF, RIN_SLOW_DIGESTION, ROCK, SADDLE, SCR_BLANK_PAPER, SCR_MAIL, SCR_SCARE_MONSTER,
    SMALL_SHIELD, SPE_EXTRA_HEALING, SPE_HEALING, STATUE, UNICORN_HORN, WORM_TOOTH,
} from "./objects.h.js";
import { NATTK, NORMAL_SPEED } from "./permonst.h.js";
import {
    COLD_RES, DISINT_RES, FIRE_RES, INTRINSIC, I_SPECIAL, POISON_RES, SHOCK_RES, SLEEP_RES, TELEPAT,
    W_AMUL, W_ARM, W_ARMG, W_ARMS, W_SADDLE,
} from "./prop.h.js";
import { res_to_mr } from "./prop.h.macros.js";
import {
    D_BROKEN, D_CLOSED, D_LOCKED, D_NODOOR, D_TRAPPED, IRONBARS, LAVAPOOL, LAVAWALL, MOAT, POOL,
    ROOM, WATER, W_NONDIGGABLE,
} from "./rm.h.js";
import {
    IS_DOOR, IS_FOUNTAIN, IS_OBSTRUCTED, IS_TREE, IS_WATERWALL, MON_AT, OBJ_AT, fmon, fobj, levl,
    m_at, remove_monster,
} from "./rm.h.macros.js";
import { TRAPNUM } from "./trap.h.js";
import { fixed_tele_trap, is_pit } from "./trap.h.macros.js";
import { COULD_SEE, IN_SIGHT, LS_MONSTER } from "./vision.h.js";
import { cansee, couldsee, m_canseeu } from "./vision.h.macros.js";
import { MAX_CARR_CAP, WT_HUMAN } from "./weight.h.js";
import { display_nhwindow } from "./winprocs.h.macros.js";
import { ACH_MEDU } from "./you.h.js";
import { Race_if, Role_if, Upolyd, m_next2u, u_at, uhis } from "./you.h.macros.js";
import {
    Blind, Blind_telepat, Breathless, Conflict, Deaf, Displaced, Flying, Hallucination, Invis,
    Levitation, Poison_resistance, Protection_from_shape_changers, Punished, Stone_resistance,
    Unaware, Underwater,
} from "./youprop.h.macros.js";
import {
    char, int, long, ord, schar, short, sizeof, sizeof_string, uchar, unsigned,
} from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64, and64u, or64, or64u } from "../rt/int64.js";
import {
    assert, free, isupper, memcpy, memset, sprintf, strcat, strcmp, strcpy, strlen, strstr,
} from "../rt/libc.js";
import {
    init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_diff, ptr_to, ref_of, ref_to, struct_assign, view_of,
} from "../rt/struct.js";
import { stop_occupation } from "./allmain.js";
import { alloc, fmt_ptr } from "./alloc.js";
import { get_mleash, leashable, m_unleash, um_dist } from "./apply.js";
import { artifact_exists, touch_artifact } from "./artifact.js";
import { adjalign, change_luck } from "./attrib.js";
import { placebc } from "./ball.js";
import { newebones } from "./bones.js";
import { describe_level } from "./botl.js";
import { isok } from "./cmd.js";
import { is_lava, is_pool, is_pool_or_lava, is_waterwall } from "./dbridge.js";
import {
    c_obj_colors, cg, disp, flags, ga, gb, gd, gi, gl, gm, gn, gs, gt, gu, gv, gy, gz, iflags,
    program_state, svc, svk, svl, svm, svq, u,
} from "./decl.js";
import { bury_an_obj } from "./dig.js";
import {
    canseemon, docrt, flash_glyph_at, newsym, see_monsters, sensemon, shieldeff, swallowed,
    unmap_object,
} from "./display.js";
import { deferred_goto, flooreffects, revive_corpse } from "./do.js";
import {
    Amonnam, Mgender, Monnam, a_monnam, free_mgivenname, hliquid, m_monnam, minimal_monnam, mon_nam,
    mon_pmname, new_mgivenname, noit_mon_nam, noname_monnam, oname, pmname, safe_oname, x_monnam,
    y_monnam,
} from "./do_name.js";
import { migrate_to_level, newedog, wary_dog } from "./dog.js";
import { could_reach_item, cursed_object_at, finish_meating, quickmimic } from "./dogmove.js";
import { In_W_tower, On_W_tower_level, has_ceiling, ledger_no, surface } from "./dungeon.js";
import { corpse_intrinsic, should_givit } from "./eat.js";
import { panic } from "./end.js";
import { del_engr_at, sengr_at } from "./engrave.js";
import { experience, more_experienced, newexplevel } from "./exper.js";
import { explode, mon_explodes } from "./explode.js";
import { dryup } from "./fountain.js";
import { coord_desc } from "./getpos.js";
import {
    bad_rock, cant_squeeze_thru, disturb_buried_zombies, in_rooms, losehp, may_dig, may_passwall,
    monst_to_any, spoteffects, u_locomotion,
} from "./hack.js";
import {
    dist2, eos, highc, mungspaces, online2, ordin, s_suffix, sgn, strncmpi, upstart,
} from "./hacklib.js";
import { record_achievement } from "./insight.js";
import { delobj, g_at, nxtobj, sobj_at, stackobj, update_inventory } from "./invent.js";
import { any_light_source, del_light_source, new_light_source } from "./light.js";
import {
    freemcorpsenm, grow_up, is_home_elemental, makemon, mbirth_limit, mkclass_poly, newmextra,
    newmonhp, set_mimic_sym,
} from "./makemon.js";
import { fightm } from "./mhitm.js";
import { expels, gazemu } from "./mhitu.js";
import { newemin } from "./minion.js";
import {
    add_to_container, add_to_minv, clear_dknown, clear_splitobjs, discard_minvent, mkcorpstat,
    mkgold, mkobj, mksobj_at, obj_extract_self, obj_meld, obj_nexto, place_object,
    pudding_merge_message, splitobj, weight,
} from "./mkobj.js";
import {
    attacktype, attacktype_fordmg, big_little_match, big_to_little, dmgtype, little_to_big,
    locomotion, mon_hates_silver, mon_knows_traps, name_to_mon, name_to_monclass, olfaction,
    on_fire, passes_bars, poly_when_stoned, resist_conflict, set_mon_data, sticks,
} from "./mondata.js";
import {
    accessible, can_fog, can_hide_under_obj, closed_door, dochugw, m_can_break_boulder,
    m_everyturn_effect, mb_trapped, mon_regen, mon_track_clear, mon_would_take_item, monflee,
    monhaskey, onscary, set_apparxy,
} from "./monmove.js";
import { mons } from "./monst.js";
import { m_carrying, m_useup } from "./mthrowu.js";
import { mcureblindness } from "./muse.js";
import { objdescr_is } from "./o_init.js";
import { objects } from "./objects.js";
import {
    The, an, ansimpleoname, distant_name, doname, makeplural, simple_typename, vtense, xname,
} from "./objnam.js";
import { removed_from_icebox } from "./pickup.js";
import {
    There, You, You_feel, You_hear, You_see, impossible, livelog_printf, pline, pline_The,
    pline_mon, set_msg_xy, verbalize,
} from "./pline.js";
import { body_part, uunstick } from "./polyself.js";
import { healup, split_mon } from "./potion.js";
import { ghod_hitsu, in_your_sanctuary, newepri, p_coaligned } from "./priest.js";
import { leaddead, nemdead, nemesis_stinks } from "./quest.js";
import { quest_info, stinky_nemesis } from "./questpgr.js";
import { unpunish } from "./read.js";
import { create_gas_cloud, visible_region_at } from "./region.js";
import { d, rn2, rnd, rnl } from "./rnd.js";
import { hot_pursuit, inhishop, replshk, shkgone } from "./shk.js";
import { neweshk, shtypes } from "./shknam.js";
import { growl, maybe_gasp } from "./sounds.js";
import { stairway_find_type_dir } from "./stairs.js";
import { mdrop_special_objs, mpickobj, relobj, thiefdead } from "./steal.js";
import { dismount_steed, place_monster, poly_steed } from "./steed.js";
import {
    control_mon_tele, enexto, goodpos, noteleport_level, rloc, rloc_to, rloc_to_flag, tele_restrict,
} from "./teleport.js";
import { end_burn, kill_egg } from "./timeout.js";
import { tt_doppel } from "./topten.js";
import { hastrack } from "./track.js";
import {
    fill_pit, fire_damage_chain, m_harmless_trap, mselftouch, t_at, water_damage_chain,
} from "./trap.js";
import { gd_move, grddead, newegd } from "./vault.js";
import { does_block, recalc_block_point, unblock_point, vision_recalc } from "./vision.js";
import { possibly_unwield } from "./weapon.js";
import { new_were, were_change } from "./were.js";
import { getlin } from "./windows.js";
import { aggravate, mon_has_amulet, mon_has_special, pick_nasty, wizdeadorgone } from "./wizard.js";
import {
    count_wsegs, get_wormno, initworm, place_worm_tail_randomly, place_wsegs, remove_worm,
    sanity_check_worm, worm_cross, worm_known, wormgone, wormno_sanity_check,
} from "./worm.js";
import {
    bypass_obj, clear_bypasses, extract_from_minvent, m_dowear, mon_adjust_speed, mon_break_armor,
    mon_set_minvis, which_armor,
} from "./worn.js";
import { obj_resists } from "./zap.js";
const __FILE__ = "mon.c";
