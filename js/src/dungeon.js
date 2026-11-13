/* NetHack 5.0	dungeon.c	$NHDT-Date: 1737343478 2025/01/19 19:24:38 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.228 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

export const DUNGEON_FILE = "dungeon.lua";

export const X_START = "x-strt";
export const X_LOCATE = "x-loca";
export const X_GOAL = "x-goal";

const struct_proto_dungeon = struct("struct_proto_dungeon", {
    tmpdungeon: array_of("struct_tmpdungeon", MAXDUNGEON),
    tmplevel: array_of("struct_tmplevel", LEV_LIMIT),
    final_lev: array_of(ptr_to("struct_s_level"), LEV_LIMIT),
    tmpbranch: array_of("struct_tmpbranch", BRANCH_LIMIT),

    start: int,
    n_levs: int,
    n_brs: int,
});

const struct_lchoice = struct("struct_lchoice", {
    idx: int,
    lev: array_of(schar, MAXLINFO),
    playerlev: array_of(schar, MAXLINFO),
    dgn: array_of(short, MAXLINFO),
    menuletter: char,
});

function dumpit() { /* void */
    let i;
    let x;
    let br;

    if (!explicitdebug(_(__FILE__)))
        return;

    for (i = 0; i < svn.n_dgns; i++) {
        fprintf(stderr, _("\n#%d \"%s\" (%s):\n"), i, svd.dungeons[i].dname, svd.dungeons[i].proto);
        fprintf(stderr, _("    num_dunlevs %d, dunlev_ureached %d\n"),
                svd.dungeons[i].num_dunlevs, svd.dungeons[i].dunlev_ureached);
        fprintf(stderr, _("    depth_start %d, ledger_start %d\n"),
                svd.dungeons[i].depth_start, svd.dungeons[i].ledger_start);
        fprintf(stderr, _("    flags:%s%s%s\n"),
                svd.dungeons[i].flags.rogue_like ? _(" rogue_like") : _(""),
                svd.dungeons[i].flags.maze_like ? _(" maze_like") : _(""),
                svd.dungeons[i].flags.hellish ? _(" hellish") : _(""));
        getchar();
    }
    fprintf(stderr, _("\nSpecial levels:\n"));
    for (x = svs.sp_levchn; x; x = x.next) {
        fprintf(stderr, _("%s (%d): "), x.proto, x.rndlevs);
        fprintf(stderr, _("on %d, %d; "), x.dlevel.dnum, x.dlevel.dlevel);
        fprintf(stderr, _("flags:%s%s%s%s\n"),
                x.flags.rogue_like ? _(" rogue_like") : _(""),
                x.flags.maze_like ? _(" maze_like") : _(""),
                x.flags.hellish ? _(" hellish") : _(""),
                x.flags.town ? _(" town") : _(""));
        getchar();
    }
    fprintf(stderr, _("\nBranches:\n"));
    for (br = svb.branches; br; br = br.next) {
        fprintf(stderr, _("%d: %s, end1 %d %d, end2 %d %d, %s\n"), br.id,
                br.type == BR_STAIR
                    ? _("stair")
                    : br.type == BR_NO_END1
                        ? _("no end1")
                        : br.type == BR_NO_END2
                            ? _("no end2")
                            : br.type == BR_PORTAL
                                ? _("portal")
                                : _("unknown"),
                br.end1.dnum, br.end1.dlevel, br.end2.dnum,
                br.end2.dlevel, br.end1_up ? _("end1 up") : _("end1 down"));
    }
    getchar();
    fprintf(stderr, _("\nDone\n"));
    getchar();
    return;
}

/* Save the dungeon structures. */
export function save_dungeon(
    nhfp,
    perform_write,
    free_data) { /* void */
    const $frame = stack_frame(); try {
    let i, count = stack_var(int);
    let curr, next;
    let curr_ms, next_ms;

    if (perform_write) {
        Sfo_int(nhfp, ref_of(svn, "n_dgns"), _("dungeon_count"));
        for (i = 0; i < svn.n_dgns; ++i) {
            Sfo_dungeon(nhfp, svd.dungeons[i], _("dungeon"));
        }
        Sfo_dgn_topology(nhfp, svd.dungeon_topology, _("svd.dungeon_topology"));
        Sfo_char(nhfp, svt.tune, _("tune"), sizeof(array_of(char, 6)));
        for (count[0] = 0, curr = svb.branches; curr; curr = curr.next)
            count[0]++;
        Sfo_int(nhfp, count, _("branch_count"));

        for (curr = svb.branches; curr; curr = curr.next) {
            Sfo_branch(nhfp, curr, _("branch"));
        }
        count[0] = maxledgerno();
        Sfo_int(nhfp, count, _("level_info_count"));
        for (i = 0; i < count[0]; ++i) {
            Sfo_linfo(nhfp, svl.level_info[i], _("svl.level_info"));
        }
        Sfo_nhcoord(nhfp, svi.inv_pos, _("svi.inv_pos"));

        for (count[0] = 0, curr_ms = svm.mapseenchn; curr_ms;
             curr_ms = curr_ms.next)
            count[0]++;

        Sfo_int(nhfp, count, _("mapseen_count"));

        for (curr_ms = svm.mapseenchn; curr_ms; curr_ms = curr_ms.next) {
            save_mapseen(nhfp, curr_ms);
        }
    }

    if (free_data) {
        for (curr = svb.branches; curr; curr = next) {
            next = curr.next;
            free(addr_of(curr));
        }
        svb.branches = null;
        for (curr_ms = svm.mapseenchn; curr_ms; curr_ms = next_ms) {
            next_ms = curr_ms.next;
            if (curr_ms.custom)
                free(curr_ms.custom);
            if (curr_ms.final_resting_place)
                savecemetery(nhfp, ref_of(curr_ms, "final_resting_place"));
            free(addr_of(curr_ms));
        }
        svm.mapseenchn = null;
    }
    } finally { stack_pop($frame); }
}

/* Restore the dungeon structures. */
export function restore_dungeon(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let curr, last;
    let count = stack_var(int, 0);
    let i;
    let curr_ms, last_ms;

    sfi_int(nhfp, ref_of(svn, "n_dgns"), _("dungeon_count"));
    for (i = 0; i < svn.n_dgns; ++i) {
        Sfi_dungeon(nhfp, svd.dungeons[i], _("dungeon"));
    }
    Sfi_dgn_topology(nhfp, svd.dungeon_topology, _("svd.dungeon_topology"));
    Sfi_char(nhfp, svt.tune, _("tune"), sizeof(array_of(char, 6)));

    last = svb.branches = null;

    sfi_int(nhfp, count, _("branch_count"));

    for (i = 0; i < count[0]; i++) {
        curr = view_of(struct_branch, addr_of(alloc(sizeof(struct_branch))));
        Sfi_branch(nhfp, curr, _("branch"));
        curr.next = null;
        if (last)
            last.next = curr;
        else
            svb.branches = curr;
        last = curr;
    }

    sfi_int(nhfp, count, _("level_info_count"));

    if (count[0] >= MAXLINFO)
        panic(_("level information count larger (%d) than allocated size"),
              count[0]);
    for (i = 0; i < count[0]; ++i) {
        Sfi_linfo(nhfp, svl.level_info[i], _("svl.level_info"));
    }

    Sfi_nhcoord(nhfp, svi.inv_pos, _("svi.inv_pos"));

    sfi_int(nhfp, count, _("mapseen_count"));

    last_ms = null;
    for (i = 0; i < count[0]; i++) {
        curr_ms = load_mapseen(nhfp);
        curr_ms.next = null;
        if (last_ms)
            last_ms.next = curr_ms;
        else
            svm.mapseenchn = curr_ms;
        last_ms = curr_ms;
    }
    } finally { stack_pop($frame); }
}

/* #if 0: not in this build */

function dname_to_dnum(s) { /* xint16 */
    let i;

    for (i = 0; i < svn.n_dgns; i++)
        if (!strcmp(svd.dungeons[i].dname, s))
            return i;

    panic(_("Couldn't resolve dungeon number for name \"%s\"."), s);
    /*NOT REACHED*/
    return 0;
}

export function find_level(s) { /* s_level * */
    let curr;
    for (curr = svs.sp_levchn; curr; curr = curr.next)
        if (!strcmpi(s, curr.proto))
            break;
    return curr;
}

/* Find the branch that links the named dungeon. */
function find_branch(
    s,
    pd) { /* int */
    let i;

    if (pd) {
        for (i = 0; i < pd.n_brs; i++)
            if (!strcmp(pd.tmpbranch[i].name, s))
                break;
        if (i == pd.n_brs)
            panic(_("find_branch: can't find %s"), s);
    } else {
        /* support for level tport by name */
        let br;
        let dnam;

        for (br = svb.branches; br; br = br.next) {
            dnam = svd.dungeons[br.end2.dnum].dname;
            if (!strcmpi(dnam, s)
                || (!strncmpi(dnam, _("The "), 4) && !strcmpi(dnam + 4, s)))
                break;
        }
        i = br ? ((ledger_no(br.end1) << 8) | ledger_no(br.end2)) : -1;
    }
    return i;
}

/*
 * Find the "parent" by searching the prototype branch list for the branch
 * listing, then figuring out to which dungeon it belongs.
 */
function parent_dnum(
    s,
    pd) { /* xint16 */
    let i;
    let pdnum;

    i = find_branch(s, pd);
    /*
     * Got branch, now find parent dungeon.  Stop if we have reached
     * "this" dungeon (if we haven't found it by now it is an error).
     */
    for (pdnum = 0; strcmp(pd.tmpdungeon[pdnum].name, s); pdnum++)
        if ((i -= pd.tmpdungeon[pdnum].branches) < 0)
            return pdnum;

    panic(_("parent_dnum: couldn't resolve branch."));
    /*NOT REACHED*/
    return 0;
}

/*
 * Return a starting point and number of successive positions a level
 * or dungeon entrance can occupy.
 *
 * Note: This follows the acouple (instead of the rcouple) rules for a
 *       negative random component (randc < 0).  These rules are found
 *       in dgn_comp.y.  The acouple [absolute couple] section says that
 *       a negative random component means from the (adjusted) base to the
 *       end of the dungeon.
 */
function level_range(
    dgn,
    base, randc, chain,
    pd,
    adjusted_base) { /* int */
    let lmax = svd.dungeons[dgn].num_dunlevs;

    if (chain >= 0) { /* relative to a special level */
        let levtmp = pd.final_lev[chain];
        if (!levtmp)
            panic(_("level_range: empty chain level!"));

        base += levtmp.dlevel.dlevel;
    } else { /* absolute in the dungeon */
        /* from end of dungeon */
        if (base < 0)
            base = (lmax + base + 1);
    }

    if (base < 1 || base > lmax)
        panic(_("level_range: base value out of range"));

    adjusted_base[0] = base;

    if (randc == -1) { /* from base to end of dungeon */
        return (lmax - base + 1);
    } else if (randc) {
        /* make sure we don't run off the end of the dungeon */
        return (((base + randc - 1) > lmax) ? lmax - base + 1 : randc);
    } /* else only one choice */
    return 1;
}

function parent_dlevel(s, pd) { /* xint16 */
    const $frame = stack_frame(); try {
    let i, j, num, base = stack_var(int), dnum = parent_dnum(s, pd);
    let curr;

    i = find_branch(s, pd);
    num = level_range(dnum, pd.tmpbranch[i].lev.base,
                      pd.tmpbranch[i].lev.rand, pd.tmpbranch[i].chain, pd,
                      base);

    /* KMH -- Try our best to find a level without an existing branch */
    i = j = rn2(num);
    do {
        if (++i >= num)
            i = 0;
        for (curr = svb.branches; curr; curr = curr.next)
            if ((curr.end1.dnum == dnum && curr.end1.dlevel == base[0] + i)
                || (curr.end2.dnum == dnum && curr.end2.dlevel == base[0] + i))
                break;
    } while (curr && i != j);
    return (base[0] + i);
    } finally { stack_pop($frame); }
}

/* Convert from the temporary branch type to the dungeon branch type. */
function correct_branch_type(tbr) { /* int */
    switch (tbr.type) {
    case TBR_STAIR:
        return BR_STAIR;
    case TBR_NO_UP:
        return tbr.up ? BR_NO_END1 : BR_NO_END2;
    case TBR_NO_DOWN:
        return tbr.up ? BR_NO_END2 : BR_NO_END1;
    case TBR_PORTAL:
        return BR_PORTAL;
    }
    impossible(_("correct_branch_type: unknown branch type"));
    return BR_STAIR;
}

/*
 * Add the given branch to the branch list.  The branch list is ordered
 * by end1 dungeon and level followed by end2 dungeon and level.  If
 * extract_first is true, then the branch is already part of the list
 * but needs to be repositioned.
 */
export function insert_branch(new_branch, extract_first) { /* void */
    let curr, prev;
    let new_val, curr_val, prev_val;

    if (extract_first) {
        for (prev = null, curr = svb.branches; curr;
             prev = curr, curr = curr.next)
            if (curr == new_branch)
                break;

        if (!curr)
            panic(_("insert_branch: not found"));
        if (prev)
            prev.next = curr.next;
        else
            svb.branches = curr.next;
    }
    new_branch.next = null;

/* Convert the branch into a unique number so we can sort them. */

    /*
     * Insert the new branch into the correct place in the branch list.
     */
    prev = null;
    prev_val = -1;
    new_val = branch_val(new_branch);
    for (curr = svb.branches; curr;
         prev_val = curr_val, prev = curr, curr = curr.next) {
        curr_val = branch_val(curr);
        if (prev_val < new_val && new_val <= curr_val)
            break;
    }
    if (prev) {
        new_branch.next = curr;
        prev.next = new_branch;
    } else {
        new_branch.next = svb.branches;
        svb.branches = new_branch;
    }
}
export function branch_val(bp) { return (((bp.end1.dnum * (MAXLEVEL + 1) + bp.end1.dlevel) * (MAXDUNGEON + 1) * (MAXLEVEL + 1)) + (bp.end2.dnum * (MAXLEVEL + 1) + bp.end2.dlevel)); }

/* Add a dungeon branch to the branch list. */
function add_branch(
    dgn, child_entry_level,
    pd) { /* branch * */
    let branch_id = static_var("add_branch.branch_id", int, 0);
    let branch_num;
    let new_branch;

    branch_num = find_branch(svd.dungeons[dgn].dname, pd);
    new_branch = view_of(struct_branch, addr_of(alloc(sizeof(struct_branch))));
    memset(addr_of(new_branch), 0, sizeof(struct_branch));
    new_branch.next = null;
    new_branch.id = branch_id[0]++;
    new_branch.type = correct_branch_type(pd.tmpbranch[branch_num]);
    new_branch.end1.dnum = parent_dnum(svd.dungeons[dgn].dname, pd);
    new_branch.end1.dlevel = parent_dlevel(svd.dungeons[dgn].dname, pd);
    new_branch.end2.dnum = dgn;
    new_branch.end2.dlevel = child_entry_level;
    new_branch.end1_up = pd.tmpbranch[branch_num].up ? TRUE : FALSE;

    insert_branch(new_branch, FALSE);
    return new_branch;
}

/*
 * Add new level to special level chain.  Insert it in level order with the
 * other levels in this dungeon.  This assumes that we are never given a
 * level that has a dungeon number less than the dungeon number of the
 * last entry.
 */
function add_level(new_lev) { /* void */
    let prev, curr;

    prev = null;
    for (curr = svs.sp_levchn; curr; curr = curr.next) {
        if (curr.dlevel.dnum == new_lev.dlevel.dnum
            && curr.dlevel.dlevel > new_lev.dlevel.dlevel)
            break;
        prev = curr;
    }
    if (!prev) {
        new_lev.next = svs.sp_levchn;
        svs.sp_levchn = new_lev;
    } else {
        new_lev.next = curr;
        prev.next = new_lev;
    }
}

function init_level(dgn, proto_index, pd) { /* void */
    let new_level;
    let tlevel = pd.tmplevel[proto_index];

    pd.final_lev[proto_index] = null; /* no "real" level */
    if (!wizard() && tlevel.chance <= rn2(100))
        return;

    pd.final_lev[proto_index] = new_level =
        view_of(struct_s_level, addr_of(alloc(sizeof(struct_s_level))));
    memset(addr_of(new_level), 0, sizeof(struct_s_level));
    /* load new level with data */
    strcpy(new_level.proto, tlevel.name);
    new_level.boneid = tlevel.boneschar;
    new_level.dlevel.dnum = dgn;
    new_level.dlevel.dlevel = 0; /* for now */

    new_level.flags.town = +!!(tlevel.flags & TOWN);
    new_level.flags.hellish = +!!(tlevel.flags & HELLISH);
    new_level.flags.maze_like = +!!(tlevel.flags & MAZELIKE);
    new_level.flags.rogue_like = +!!(tlevel.flags & ROGUELIKE);
    new_level.flags.align = ((tlevel.flags & D_ALIGN_MASK) >> 4);
    if (!new_level.flags.align)
        new_level.flags.align =
            ((pd.tmpdungeon[dgn].flags & D_ALIGN_MASK) >> 4);

    new_level.rndlevs = uchar(tlevel.rndlevs);
    new_level.next = null;
}

function possible_places(
    idx,
    map,
    pd) { /* int */
    const $frame = stack_frame(); try {
    let i, start = stack_var(int), count;
    let lev = pd.final_lev[idx];

    /* init level possibilities */
    for (i = 0; i <= MAXLEVEL; i++)
        chars[map + i] = FALSE;

    /* get base and range and set those entries to true */
    count = level_range(lev.dlevel.dnum, pd.tmplevel[idx].lev.base,
                        pd.tmplevel[idx].lev.rand, pd.tmplevel[idx].chain,
                        pd, start);
    for (i = start[0]; i < start[0] + count; i++)
        chars[map + i] = TRUE;

    /* mark off already placed levels */
    for (i = pd.start; i < idx; i++) {
        if (pd.final_lev[i] && chars[map + (pd.final_lev[i].dlevel.dlevel)]) {
            chars[map + (pd.final_lev[i].dlevel.dlevel)] = FALSE;
            --count;
        }
    }

    return count;
    } finally { stack_pop($frame); }
}

/* Pick the nth TRUE entry in the given boolean array. */
function pick_level(
    map,
    nth) { /* xint16 */
    let i;
    for (i = 1; i <= MAXLEVEL; i++)
        if (chars[map + i] && !nth--)
            return i;
    panic(_("pick_level:  ran out of valid levels"));
    /*NOTREACHED*/
    return 0;
}

/* #ifdef DDEBUG: not in this build */

/*
 * Place a level.  First, find the possible places on a dungeon map
 * template.  Next pick one.  Then try to place the next level.  If
 * successful, we're done.  Otherwise, try another (and another) until
 * all possible places have been tried.  If all possible places have
 * been exhausted, return false.
 */
function place_level(proto_index, pd) { /* boolean */
    const $frame = stack_frame(); try {
    let map = stack_array(schar, MAXLEVEL + 1); /* valid levels are 1..MAXLEVEL inclusive */
    let lev;
    let npossible;

    if (proto_index == pd.n_levs)
        return TRUE; /* at end of proto levels */

    lev = pd.final_lev[proto_index];

    /* No level created for this prototype, goto next. */
    if (!lev)
        return place_level(proto_index + 1, pd);

    npossible = possible_places(proto_index, map, pd);

    for (; npossible; --npossible) {
        lev.dlevel.dlevel = pick_level(map, rn2(npossible));

        if (place_level(proto_index + 1, pd))
            return TRUE;
        chars[map + lev.dlevel.dlevel] = FALSE; /* this choice didn't work */
    }

    return FALSE;
    } finally { stack_pop($frame); }
}

 const struct_level_map = struct("struct_level_map", {
    lev_name: ptr_to(char),
    lev_spec: ptr_to("struct_d_level"),
}); const level_map = static_array("level_map", struct_level_map, null, [ { lev_name: _("air"), lev_spec: svd.dungeon_topology.d_air_level },
                  { lev_name: _("asmodeus"), lev_spec: svd.dungeon_topology.d_asmodeus_level },
                  { lev_name: _("astral"), lev_spec: svd.dungeon_topology.d_astral_level },
                  { lev_name: _("baalz"), lev_spec: svd.dungeon_topology.d_baalzebub_level },
                  { lev_name: _("bigrm"), lev_spec: svd.dungeon_topology.d_bigroom_level },
                  { lev_name: _("castle"), lev_spec: svd.dungeon_topology.d_stronghold_level },
                  { lev_name: _("earth"), lev_spec: svd.dungeon_topology.d_earth_level },
                  { lev_name: _("fakewiz1"), lev_spec: svd.dungeon_topology.d_portal_level },
                  { lev_name: _("fire"), lev_spec: svd.dungeon_topology.d_fire_level },
                  { lev_name: _("juiblex"), lev_spec: svd.dungeon_topology.d_juiblex_level },
                  { lev_name: _("knox"), lev_spec: svd.dungeon_topology.d_knox_level },
                  { lev_name: _("medusa"), lev_spec: svd.dungeon_topology.d_medusa_level },
                  { lev_name: _("oracle"), lev_spec: svd.dungeon_topology.d_oracle_level },
                  { lev_name: _("orcus"), lev_spec: svd.dungeon_topology.d_orcus_level },
                  { lev_name: _("rogue"), lev_spec: svd.dungeon_topology.d_rogue_level },
                  { lev_name: _("sanctum"), lev_spec: svd.dungeon_topology.d_sanctum_level },
                  { lev_name: _("valley"), lev_spec: svd.dungeon_topology.d_valley_level },
                  { lev_name: _("water"), lev_spec: svd.dungeon_topology.d_water_level },
                  { lev_name: _("wizard1"), lev_spec: svd.dungeon_topology.d_wiz1_level },
                  { lev_name: _("wizard2"), lev_spec: svd.dungeon_topology.d_wiz2_level },
                  { lev_name: _("wizard3"), lev_spec: svd.dungeon_topology.d_wiz3_level },
                  { lev_name: _("minend"), lev_spec: svd.dungeon_topology.d_mineend_level },
                  { lev_name: _("soko1"), lev_spec: svd.dungeon_topology.d_sokoend_level },
                  { lev_name: _(X_START), lev_spec: svd.dungeon_topology.d_qstart_level },
                  { lev_name: _(X_LOCATE), lev_spec: svd.dungeon_topology.d_qlocate_level },
                  { lev_name: _(X_GOAL), lev_spec: svd.dungeon_topology.d_nemesis_level },
                  { lev_name: _(""), lev_spec: null }
]);

function get_dgn_flags(L) { /* int */
    let dgn_flags = 0;
    let flagstrs = static_array("get_dgn_flags.flagstrs", ptr_to(char), null, [
        _("town"), _("hellish"), _("mazelike"), _("roguelike"), _("unconnected"), 0
    ]);
    let flagstrs2i = static_array("get_dgn_flags.flagstrs2i", int, null, [
        TOWN, HELLISH, MAZELIKE, ROGUELIKE, UNCONNECTED, 0
    ]);

    lua_getfield(L, -1, _("flags"));
    if (lua_type(L, -1) == LUA_TTABLE) {
        let f, nflags;

        lua_len(L, -1);
        nflags = int(lua_tointeger(L, -1));
        lua_pop(L, 1);
        for (f = 0; f < nflags; f++) {
            lua_pushinteger(L, f + 1);
            lua_gettable(L, -2);
            if (lua_type(L, -1) == LUA_TSTRING) {
                dgn_flags |= flagstrs2i[luaL_checkoption(L, -1, 0,
                                                         flagstrs)];
                lua_pop(L, 1);
            } else
                impossible(_("flags[%i] is not a string"), f);
        }
    } else if (lua_type(L, -1) == LUA_TSTRING) {
        dgn_flags |= flagstrs2i[luaL_checkoption(L, -1, 0, flagstrs)];
    } else if (lua_type(L, -1) != LUA_TNIL)
        impossible(_("flags is not an array or string"));
    lua_pop(L, 1);

    return dgn_flags;
}

function get_dgn_align(L) { /* int */
    let dgnaligns = static_array("get_dgn_align.dgnaligns", ptr_to(char), null, [
        _("unaligned"), _("noalign"), _("lawful"), _("neutral"), _("chaotic"), 0
    ]);
    let dgnaligns2i = static_array("get_dgn_align.dgnaligns2i", int, null, [
        D_ALIGN_NONE, D_ALIGN_NONE, D_ALIGN_LAWFUL,
        D_ALIGN_NEUTRAL, D_ALIGN_CHAOTIC, D_ALIGN_NONE
    ]);

    let a = dgnaligns2i[get_table_option(L, _("alignment"),
                                         _("unaligned"), dgnaligns)];
    return a;
}

function init_dungeon_levels(
    L,
    pd,
    dngidx) { /* void */
    let lvl_name, lvl_bonetag, lvl_chain;
    let lvl_base, lvl_range, lvl_nlevels, lvl_chance,
        lvl_align, lvl_flags;
    let tmpl;
    let bi, f, nlevels;

    lua_len(L, -1);
    nlevels = int(lua_tointeger(L, -1));
    pd.tmpdungeon[dngidx].levels = nlevels;
    lua_pop(L, 1);
    for (f = 0; f < nlevels; f++) {
        lua_pushinteger(L, f + 1);
        lua_gettable(L, -2);
        if (lua_type(L, -1) == LUA_TTABLE) {
            lvl_name = get_table_str(L, _("name"));
            lvl_bonetag = get_table_str_opt(L, _("bonetag"), emptystr);
            lvl_chain = get_table_str_opt(L, _("chainlevel"), 0);
            lvl_base = get_table_int(L, _("base"));
            lvl_range = get_table_int_opt(L, _("range"), 0);
            lvl_nlevels = get_table_int_opt(L, _("nlevels"), 0);
            lvl_chance = get_table_int_opt(L, _("chance"), 100);
            lvl_align = get_dgn_align(L);
            lvl_flags = get_dgn_flags(L);
            /* array index is offset by cumulative number of levels
               defined for preceding branches (iterations of 'while'
               loop we're inside, not branch connections below) */
            tmpl = pd.tmplevel[pd.n_levs + f];

            debugpline4(_("LEVEL[%i]:%s,(%i,%i)"),
                        f, lvl_name, lvl_base, lvl_range, __FILE__);
            tmpl.name = lvl_name;
            tmpl.chainlvl = lvl_chain;
            tmpl.lev.base = lvl_base;
            tmpl.lev.rand = lvl_range;
            tmpl.chance = lvl_chance;
            tmpl.rndlevs = lvl_nlevels;
            tmpl.flags = lvl_flags | lvl_align;
            tmpl.boneschar = chars[lvl_bonetag] ? chars[lvl_bonetag] : 0;
            free(lvl_bonetag);
            tmpl.chain = -1;
            if (lvl_chain) {
                debugpline1(_("CHAINLEVEL: %s"), lvl_chain, __FILE__);
                for (bi = 0; bi < pd.n_levs + f; bi++) {
                    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("checking(%i):%s"), bi, pd.tmplevel[bi].name); iflags.last_msg = save_plnmsg; } } while (0)
;
                    if (!strcmp(pd.tmplevel[bi].name, lvl_chain)) {
                        tmpl.chain = bi;
                        break;
                    }
                }
                if (tmpl.chain == -1)
                    panic(_("Could not chain level %s to %s"),
                          lvl_name, lvl_chain);
                /* free(lvl_chain); -- recorded in pd.tmplevel[] */
            }
        } else
            panic(_("dungeon[%i].levels[%i] is not a hash"), dngidx, f);
        lua_pop(L, 1);
    }
    pd.n_levs += nlevels;
    if (pd.n_levs > LEV_LIMIT)
        panic(_("init_dungeon: too many special levels"));
}

function init_dungeon_branches(
    L,
    pd,
    dngidx) { /* void */
    let brdirstr = static_array("init_dungeon_branches.brdirstr", ptr_to(char), null, [ _("up"), _("down"), 0 ]);
    let brdirstr2i = static_array("init_dungeon_branches.brdirstr2i", int, null, [ TRUE, FALSE, FALSE ]);
    let brtypes = static_array("init_dungeon_branches.brtypes", ptr_to(char), null, [
        _("stair"), _("portal"), _("no_down"), _("no_up"), 0
    ]);
    let brtypes2i = static_array("init_dungeon_branches.brtypes2i", int, null, [
        TBR_STAIR, TBR_PORTAL, TBR_NO_DOWN, TBR_NO_UP, TBR_STAIR
    ]);
    let br_name, br_chain;
    let br_base, br_range, br_type, br_up;
    let tmpb;
    let bi, f, nbranches;

    lua_len(L, -1);
    nbranches = int(lua_tointeger(L, -1));
    pd.tmpdungeon[dngidx].branches = nbranches;
    lua_pop(L, 1);
    for (f = 0; f < nbranches; f++) {
        lua_pushinteger(L, f + 1);
        lua_gettable(L, -2);
        if (lua_type(L, -1) == LUA_TTABLE) {
            br_name = get_table_str(L, _("name"));
            br_chain = get_table_str_opt(L, _("chainlevel"), 0);
            br_base = get_table_int(L, _("base"));
            br_range = get_table_int_opt(L, _("range"), 0);
            br_type = brtypes2i[get_table_option(L, _("branchtype"),
                                                 _("stair"), brtypes)];
            br_up = brdirstr2i[get_table_option(L, _("direction"),
                                                _("down"), brdirstr)];
            tmpb = (pd.tmpbranch[pd.n_brs + f]);

            debugpline4(_("BRANCH[%i]:%s,(%i,%i)"),
                        f, br_name, br_base, br_range, __FILE__);
            tmpb.name = br_name;
            tmpb.lev.base = br_base;
            tmpb.lev.rand = br_range;
            tmpb.type = br_type;
            tmpb.up = br_up;
            tmpb.chain = -1;
            if (br_chain) {
                debugpline1(_("CHAINBRANCH:%s"), br_chain, __FILE__);
                for (bi = 0; bi < pd.n_levs + f - 1; bi++)
                    if (!strcmp(pd.tmplevel[bi].name, br_chain)) {
                        tmpb.chain = bi;
                        break;
                    }
                if (tmpb.chain == -1)
                    panic(_("Could not chain branch %s to level %s"),
                          br_name, br_chain);
                free(br_chain);
            }
        } else
            panic(_("dungeon[%i].branches[%i] is not a hash"), dngidx, f);
        lua_pop(L, 1);
    }
    pd.n_brs += nbranches;
    if (pd.n_brs > BRANCH_LIMIT)
        panic(_("init_dungeon: too many branches"));
}

function init_dungeon_set_entry(pd, dngidx) { /* void */
    let dgn_entry = pd.tmpdungeon[dngidx].entry_lev;
    /*
     * Set the entry level for this dungeon.  The entry value means:
     *              < 0     from bottom (-1 == bottom level)
     *                0     default (top)
     *              > 0     actual level (1 = top)
     *
     * Note that the entry_lev field in the dungeon structure is
     * redundant.  It is used only here and in print_dungeon().
     */
    if (dgn_entry < 0) {
        svd.dungeons[dngidx].entry_lev =
            svd.dungeons[dngidx].num_dunlevs + dgn_entry + 1;
        if (svd.dungeons[dngidx].entry_lev <= 0)
            svd.dungeons[dngidx].entry_lev = 1;
    } else if (dgn_entry > 0) {
        svd.dungeons[dngidx].entry_lev = dgn_entry;
        if (svd.dungeons[dngidx].entry_lev > svd.dungeons[dngidx].num_dunlevs)
            svd.dungeons[dngidx].entry_lev = svd.dungeons[dngidx].num_dunlevs;
    } else { /* default */
        svd.dungeons[dngidx].entry_lev = 1; /* defaults to top level */
    }
}

function init_dungeon_set_depth(pd, dngidx) { /* void */
    let br;
    let from_depth;
    let from_up;

    br = add_branch(dngidx, svd.dungeons[dngidx].entry_lev, pd);

    /* Get the depth of the connecting end. */
    if (br.end1.dnum == dngidx) {
        from_depth = depth(br.end2);
        from_up = +!br.end1_up;
    } else {
        from_depth = depth(br.end1);
        from_up = br.end1_up;
    }

    /*
     * Calculate the depth of the top of the dungeon via
     * its branch.  First, the depth of the entry point:
     *
     *  depth of branch from "parent" dungeon
     *  + -1 or 1 depending on an up or down stair or
     *    0 if portal
     *
     * Followed by the depth of the top of the dungeon:
     *
     *  - (entry depth - 1)
     *
     * We'll say that portals stay on the same depth.
     */
    svd.dungeons[dngidx].depth_start =
        from_depth + (br.type == BR_PORTAL ? 0 : (from_up ? -1 : 1))
        - (svd.dungeons[dngidx].entry_lev - 1);
}

function init_dungeon_dungeons(
   L,
   pd,
   dngidx) { /* boolean */
    let dgn_name, dgn_bonetag, dgn_protoname, dgn_fill;
    let dgn_themerms;
    let dgn_base, dgn_range, dgn_align, dgn_entry, dgn_chance, dgn_flags;

    dgn_name = get_table_str(L, _("name"));
    /* TODO: accept single char or "none" for bonetag */
    dgn_bonetag = get_table_str_opt(L, _("bonetag"), emptystr);
    dgn_protoname = get_table_str_opt(L, _("protofile"), emptystr);
    dgn_base = get_table_int(L, _("base"));
    dgn_range = get_table_int_opt(L, _("range"), 0);
    dgn_align = get_dgn_align(L);
    dgn_entry = get_table_int_opt(L, _("entry"), 0);
    dgn_chance = get_table_int_opt(L, _("chance"), 100);
    dgn_flags = get_dgn_flags(L);
    dgn_fill = get_table_str_opt(L, _("lvlfill"), emptystr);
    dgn_themerms = get_table_str_opt(L, _("themerooms"), emptystr);

    debugpline4(_("DUNGEON[%i]: %s, base=(%i,%i)"),
                dngidx, dgn_name, dgn_base, dgn_range, __FILE__);

    if (!wizard() && dgn_chance && (dgn_chance <= rn2(100))) {
        debugpline1(_("IGNORING %s"), dgn_name, __FILE__);
        svn.n_dgns--;
        free(dgn_name);
        free(dgn_bonetag);
        free(dgn_protoname);
        free(dgn_fill);
        free(dgn_themerms);
        return FALSE;
    }

    /* levels begin */
    lua_getfield(L, -1, _("levels"));
    if (lua_type(L, -1) == LUA_TTABLE) {
        init_dungeon_levels(L, pd, dngidx);
    } else if (lua_type(L, -1) != LUA_TNIL)
        panic(_("dungeon[%i].levels is not an array of hashes"), dngidx);
    lua_pop(L, 1);
    /* levels end */

    /* branches begin */
    lua_getfield(L, -1, _("branches"));
    if (lua_type(L, -1) == LUA_TTABLE) {
        init_dungeon_branches(L, pd, dngidx);
    } else if (lua_type(L, -1) != LUA_TNIL)
        panic(_("dungeon[%i].branches is not an array of hashes"), dngidx);
    lua_pop(L, 1);
    /* branches end */

    pd.tmpdungeon[dngidx].name = dgn_name;
    pd.tmpdungeon[dngidx].protoname = dgn_protoname;
    pd.tmpdungeon[dngidx].boneschar = chars[dgn_bonetag] ? chars[dgn_bonetag] : 0;
    pd.tmpdungeon[dngidx].lev.base = dgn_base;
    pd.tmpdungeon[dngidx].lev.rand = dgn_range;
    pd.tmpdungeon[dngidx].flags = dgn_flags;
    pd.tmpdungeon[dngidx].align = dgn_align;
    pd.tmpdungeon[dngidx].chance = dgn_chance;
    pd.tmpdungeon[dngidx].entry_lev = dgn_entry;

    /* FIXME: these should have length checks */
    strcpy(svd.dungeons[dngidx].fill_lvl, dgn_fill);
    strcpy(svd.dungeons[dngidx].dname, dgn_name);
    strcpy(svd.dungeons[dngidx].proto, dgn_protoname);
    strcpy(svd.dungeons[dngidx].themerms, dgn_themerms);
    /* FIXME: accept "none", convert that to '\0' */
    svd.dungeons[dngidx].boneid = chars[dgn_bonetag] ? chars[dgn_bonetag] : 0;
    free(dgn_fill);
    /* free((genericptr) dgn_protoname); -- stored in pd.tmpdungeon[] */
    free(dgn_bonetag);
    free(dgn_themerms);

    if (dgn_range)
        svd.dungeons[dngidx].num_dunlevs = xint16(rn1(dgn_range, dgn_base));
    else
        svd.dungeons[dngidx].num_dunlevs = xint16(dgn_base);

    if (!dngidx) {
        svd.dungeons[dngidx].ledger_start = 0;
        svd.dungeons[dngidx].depth_start = 1;
        svd.dungeons[dngidx].dunlev_ureached = 1;
    } else {
        svd.dungeons[dngidx].ledger_start
            = elt(svd.dungeons, dngidx - 1).ledger_start
              + elt(svd.dungeons, dngidx - 1).num_dunlevs;
        svd.dungeons[dngidx].dunlev_ureached = 0;
    }

    svd.dungeons[dngidx].flags.hellish = +!!(dgn_flags & HELLISH);
    svd.dungeons[dngidx].flags.maze_like = +!!(dgn_flags & MAZELIKE);
    svd.dungeons[dngidx].flags.rogue_like = +!!(dgn_flags & ROGUELIKE);
    svd.dungeons[dngidx].flags.align = unsigned(dgn_align);
    svd.dungeons[dngidx].flags.unconnected = +!!(dgn_flags & UNCONNECTED);

    init_dungeon_set_entry(pd, dngidx);

    if (svd.dungeons[dngidx].flags.unconnected) {
        svd.dungeons[dngidx].depth_start = 1;
    } else if (dngidx) { /* set depth */
        init_dungeon_set_depth(pd, dngidx);
    }

    if (svd.dungeons[dngidx].num_dunlevs > MAXLEVEL)
        svd.dungeons[dngidx].num_dunlevs = MAXLEVEL;

    return TRUE;
}

/* initialize the Castle drawbridge tune */
function init_castle_tune() { /* void */
    let i;

    for (i = 0; i < 5; i++)
        chars[svt.tune + i] = ord('A') + rn2(7);
    chars[svt.tune + 5] = 0;
}

/* fix up the special level names and locations for quick access */
function fixup_level_locations() { /* void */
    let i;
    let x;
    let lev_map;

    /*
     * Find most of the special levels and dungeons so we can access their
     * locations quickly.
     */
    for (lev_map = level_map[0]; chars[lev_map.lev_name + 0]; lev_map = ptr_add(lev_map, 1)) {
        x = find_level(lev_map.lev_name);
        if (x) {
            assign_level(lev_map.lev_spec, x.dlevel);
            if (!strncmp(lev_map.lev_name, _("x-"), 2)) {
                /* This is where the name substitution on the
                 * levels of the quest dungeon occur.
                 */
                sprintf(x.proto, _("%s%s"), gu.urole.filecode, lev_map.lev_name + 1)
;
            } else if (lev_map.lev_spec == svd.dungeon_topology.d_knox_level) {
                let br;
                /*
                 * Kludge to allow floating Knox entrance.  We
                 * specify a floating entrance by the fact that its
                 * entrance (end1) has a bogus dnum, namely n_dgns.
                 */
                for (br = svb.branches; br; br = br.next)
                    if (on_level(br.end2, svd.dungeon_topology.d_knox_level))
                        break;

                if (br) {
                    br.end1.dnum = svn.n_dgns;
                    /* adjust the branch's position on the list */
                    insert_branch(br, TRUE);
                }
            }
        }
    }
    /*
     *  I hate hardwiring these names. :-(
     */
    svd.dungeon_topology.d_quest_dnum = dname_to_dnum(_("The Quest"));
    svd.dungeon_topology.d_sokoban_dnum = dname_to_dnum(_("Sokoban"));
    svd.dungeon_topology.d_mines_dnum = dname_to_dnum(_("The Gnomish Mines"));
    svd.dungeon_topology.d_tower_dnum = dname_to_dnum(_("Vlad's Tower"));
    svd.dungeon_topology.d_tutorial_dnum = dname_to_dnum(_("The Tutorial"));

    /* one special fixup for dummy surface level */
    if ((x = find_level(_("dummy"))) != null) {
        i = x.dlevel.dnum;
        /* the code above puts earth one level above dungeon level #1,
           making the dummy level overlay level 1; but the whole reason
           for having the dummy level is to make earth have depth -1
           instead of 0, so adjust the start point to shift endgame up */
        if (dunlevs_in_dungeon(x.dlevel) > 1 - svd.dungeons[i].depth_start)
            svd.dungeons[i].depth_start -= 1;
        /* TODO: strip "dummy" out all the way here,
           so that it's hidden from '#wizwhere' feedback. */
    }
}

function free_proto_dungeon(pd) { /* void */
    let i;

    for (i = 0; i < pd.n_brs; i++) {
        free((pd.tmpbranch[i].name));
    }
    for (i = 0; i < pd.n_levs; i++) {
        free((pd.tmplevel[i].name));
        if (pd.tmplevel[i].chainlvl)
            free((pd.tmplevel[i].chainlvl));
    }
    for (i = 0; i < svn.n_dgns; i++) {
        free((pd.tmpdungeon[i].name));
        free((pd.tmpdungeon[i].protoname));
    }
}

/* initialize the "dungeon" structs */
export function init_dungeons() { /* void */
    const $frame = stack_frame(); try {
    let L;
    let i, cl = 0;
    let pd = stack_struct(struct_proto_dungeon);
    let tidx;
    let sbi = init_list(stack_struct(struct_nhl_sandbox_info), {flags: NHL_SB_SAFE, memlimit: 1*1024*1024, steps: 0, perpcall: 1*1024*1024});

    memset(addr_of(pd), 0, sizeof(struct_proto_dungeon));
    pd.n_levs = pd.n_brs = 0;

    L = nhl_init(sbi); /* private Lua state for this function */
    if (!L) {
        panic1(_("'nhl_init' failed; can't continue."));
        /*NOTREACHED*/
    }
    if (!nhl_loadlua(L, _(DUNGEON_FILE))) {
        let tbuf = stack_array(char, BUFSZ);
        sprintf(tbuf, _("Cannot open dungeon description - \"%s"), _(DUNGEON_FILE));

        /* #if defined(DLB): not in this build */

        strcat(tbuf, _("\" file!"));

        panic1(tbuf);
    }

    if (iflags.window_inited)
        clear_nhwindow()(WIN_MAP);

    svs.sp_levchn = null;

    lua_settop(L, 0);

    lua_getglobal(L, _("dungeon"));
    if (!lua_istable(L, -1))
        panic(_("dungeon is not a lua table"));

    lua_len(L, -1);
    svn.n_dgns = int(lua_tointeger(L, -1));
    lua_pop(L, 1);

    pd.start = 0;
    pd.n_levs = 0;
    pd.n_brs = 0;

    /*
     * Read in each dungeon and transfer the results to the internal
     * dungeon arrays.
     */

    if (svn.n_dgns >= MAXDUNGEON)
        panic(_("init_dungeons: too many dungeons"));

    tidx = lua_gettop(L);

    lua_pushnil(L); /* first key */
    i = 0;
    while (lua_next(L, tidx) != 0) {
        if (!lua_istable(L, -1))
            panic(_("dungeon[%i] is not a lua table"), i);

        if (init_dungeon_dungeons(L, pd, i)) {
            for (; cl < pd.n_levs; cl++) {
                init_level(i, cl, pd);
            }
            /*
             * Recursively place the generated levels for this dungeon.  This
             * routine will attempt all possible combinations before giving
             * up.
             */
            if (!place_level(pd.start, pd))
                panic(_("init_dungeon:  couldn't place levels"));

            for (; pd.start < pd.n_levs; pd.start++)
                if (pd.final_lev[pd.start])
                    add_level(pd.final_lev[pd.start]);
            /* levels handling end */
            i++;
        }
        lua_pop(L, 1); /* pop the dungeon table */
    }

    lua_pop(L, 1); /* get rid of the dungeon global */
    debugpline2(_("init_dungeon lua DONE (n_levs=%i, n_brs=%i)"),
                pd.n_levs, pd.n_brs, __FILE__);

    init_castle_tune();
    fixup_level_locations();
    nhl_done(L);
    free_proto_dungeon(pd);

    dumpit();
    } finally { stack_pop($frame); }
}

/* return the level number for lev in *this* dungeon */
export function dunlev(lev) { /* xint16 */
    return lev.dlevel;
}

/* return the lowest level number for *this* dungeon */
export function dunlevs_in_dungeon(lev) { /* xint16 */
    return elt(svd.dungeons, lev.dnum).num_dunlevs;
}

/* return the lowest level explored in the game*/
export function deepest_lev_reached(noquest) { /* xint16 */
    const $frame = stack_frame(); try {
    /* this function is used for three purposes: to provide a factor
     * of difficulty in monster generation; to provide a factor of
     * difficulty in experience calculations (botl.c and end.c); and
     * to insert the deepest level reached in the game in the topten
     * display.  the 'noquest' arg switch is required for the latter.
     *
     * from the player's point of view, going into the Quest is _not_
     * going deeper into the dungeon -- it is going back "home", where
     * the dungeon starts at level 1.  given the setup in dungeon.def,
     * the depth of the Quest (thought of as starting at level 1) is
     * never lower than the level of entry into the Quest, so we exclude
     * the Quest from the topten "deepest level reached" display
     * calculation.  _However_ the Quest is a difficult dungeon, so we
     * include it in the factor of difficulty calculations.
     */
    let i;
    let tmp = stack_struct(struct_d_level);
    let ret = 0;

    for (i = 0; i < svn.n_dgns; i++) {
        if (noquest && i == quest_dnum())
            continue;
        tmp.dlevel = svd.dungeons[i].dunlev_ureached;
        if (tmp.dlevel == 0)
            continue;
        tmp.dnum = i;
        if (depth(tmp) > ret)
            ret = depth(tmp);
    }
    return ret;
    } finally { stack_pop($frame); }
}

/* return a bookkeeping level number for purpose of comparisons and
   save/restore */
export function ledger_no(lev) { /* xint16 */
    return xint16((lev.dlevel + elt(svd.dungeons, lev.dnum).ledger_start));
}

/*
 * The last level in the bookkeeping list of level is the bottom of the last
 * dungeon in the svd.dungeons[] array.
 *
 * Maxledgerno() -- which is the max number of levels in the bookkeeping
 * list, should not be confused with dunlevs_in_dungeon(lev) -- which
 * returns the max number of levels in lev's dungeon, and both should
 * not be confused with deepest_lev_reached() -- which returns the lowest
 * depth visited by the player.
 */
export function maxledgerno() { /* xint16 */
    return xint16((elt(svd.dungeons, svn.n_dgns - 1).ledger_start
                    + elt(svd.dungeons, svn.n_dgns - 1).num_dunlevs));
}

/* return the dungeon that this ledgerno exists in */
export function ledger_to_dnum(ledgerno) { /* xint16 */
    let i;

    /* find i such that (i->base + 1) <= ledgerno <= (i->base + i->count) */
    for (i = 0; i < svn.n_dgns; i++)
        if (svd.dungeons[i].ledger_start < ledgerno
            && ledgerno <= (svd.dungeons[i].ledger_start
                            + svd.dungeons[i].num_dunlevs))
            return i;

    panic(_("level number out of range [ledger_to_dnum(%d)]"), ledgerno);
    /*NOT REACHED*/
    return 0;
}

/* return the level of the dungeon this ledgerno exists in */
export function ledger_to_dlev(ledgerno) { /* xint16 */
    return xint16((ledgerno
                    - svd.dungeons[ledger_to_dnum(ledgerno)].ledger_start));
}

/* returns the depth of a level, in floors below the surface
   (note levels in different dungeons can have the same depth) */
export function depth(lev) { /* schar */
    return schar((elt(svd.dungeons, lev.dnum).depth_start + lev.dlevel - 1));
}

/* are "lev1" and "lev2" actually the same? */
export function on_level(lev1, lev2) { /* boolean */
    return (+(lev1.dnum == lev2.dnum
                      && lev1.dlevel == lev2.dlevel));
}

/* is this level referenced in the special level chain? */
export function Is_special(lev) { /* s_level * */
    let levtmp;

    for (levtmp = svs.sp_levchn; levtmp; levtmp = levtmp.next)
        if (on_level(lev, levtmp.dlevel))
            return levtmp;

    return null;
}

/*
 * Is this a multi-dungeon branch level?  If so, return a pointer to the
 * branch.  Otherwise, return null.
 */
export function Is_branchlev(lev) { /* branch * */
    let curr;

    for (curr = svb.branches; curr; curr = curr.next) {
        if (on_level(lev, curr.end1) || on_level(lev, curr.end2))
            return curr;
    }
    return null;
}

/* returns True iff the branch 'lev' is in a branch which builds up */
export function builds_up(lev) { /* boolean */
    let dptr = elt(svd.dungeons, lev.dnum);
    let br;
    if (dptr.num_dunlevs > 1)
        return (+(dptr.entry_lev == dptr.num_dunlevs));
    /* else, single-level branch; find branch connection that connects this
     * dungeon from a parent dungeon and determine whether it builds up from
     * that */
    for (br = svb.branches; br; br = br.next) {
        if (on_level(lev, br.end2)) {
            return br.end1_up;
        }
    }
    impossible(_("builds_up: can't find branch for dungeon %d"), lev.dnum);
    return FALSE;
}

/* goto the next level (or appropriate dungeon) */
export function next_level(at_stairs) { /* void */
    const $frame = stack_frame(); try {
    let stway = stairway_at(u.ux, u.uy);
    let newlevel = stack_struct(struct_d_level);

    if (at_stairs && stway)
        stway.u_traversed = TRUE;

    if (at_stairs && stway) {
        newlevel.dnum = stway.tolev.dnum;
        newlevel.dlevel = stway.tolev.dlevel;
        goto_level(newlevel, at_stairs, FALSE, FALSE);
    } else {
        newlevel.dnum = u.uz.dnum;
        newlevel.dlevel = u.uz.dlevel + 1;
        goto_level(newlevel, at_stairs, +!at_stairs, FALSE);
    }
    } finally { stack_pop($frame); }
}

/* goto the previous level (or appropriate dungeon) */
export function prev_level(at_stairs) { /* void */
    const $frame = stack_frame(); try {
    let stway = stairway_at(u.ux, u.uy);
    let newlevel = stack_struct(struct_d_level);

    if (at_stairs && stway)
        stway.u_traversed = TRUE;

    if (at_stairs && stway && stway.tolev.dnum != u.uz.dnum) {
        /* Taking an up dungeon branch. */
        /* KMH -- Upwards branches are okay if not level 1 */
        /* (Just make sure it doesn't go above depth 1) */
        if (!u.uz.dnum && u.uz.dlevel == 1 && !u.uhave.amulet)
            done(ESCAPED);
        else {
            newlevel.dnum = stway.tolev.dnum;
            newlevel.dlevel = stway.tolev.dlevel;
            goto_level(newlevel, at_stairs, FALSE, FALSE);
        }
    } else {
        /* Going up a stairs or rising through the ceiling. */
        newlevel.dnum = u.uz.dnum;
        newlevel.dlevel = u.uz.dlevel - 1;
        goto_level(newlevel, at_stairs, FALSE, FALSE);
    }
    } finally { stack_pop($frame); }
}

/* Dwarves have "earth sense",
   able to sense if something is buried under their feet */
function earth_sense() { /* void */
    let otmp;

    if (!Race_if(PM_DWARF))
        return;
    if (u.usteed || Flying() || Levitation() || Upolyd())
        return;
    if (levl()[u.ux][u.uy].typ != CORR
        && levl()[u.ux][u.uy].typ != ROOM)
        return;

    for (otmp = svl.level.buriedobjlist; otmp; otmp = otmp.nobj)
        if ((((otmp.ox) == u.ux) && ((otmp.oy) == u.uy))) {
            You(_("sense something below your %s."), makeplural(body_part(FOOT)));
            return;
        }
}

export function u_on_newpos(x, y) { /* void */
    if (!isok(x, y)) { /* validate location */
        let func;

        func = (x < 0 || y < 0 || x > COLNO - 1 || y > ROWNO - 1) ? panic
               : impossible;
        func(_("u_on_newpos: trying to place hero off map <%d,%d>"), x, y);
    }
    u.ux = x;
    u.uy = y;

    cliparound()(u.ux, u.uy);

    u.uundetected = 0;
    /* ridden steed always shares hero's location */
    if (u.usteed)
        u.usteed.mx = u.ux, u.usteed.my = u.uy;
    /* when changing levels, don't leave old position set with
       stale values from previous level */
    if (!on_level(u.uz, u.uz0)) {
        u.ux0 = u.ux, u.uy0 = u.uy;
        /* sets lastseentyp[u.ux][u.uy]; needed for switch_terrain()
           somewhere back up the call chain */
        map_location(u.ux, u.uy, FALSE);
        iflags.terrain_typ = MAX_TYPE; /* "none of the above" value */
    } else {
        /* still on same level; might have come close enough to
           generic object(s) to redisplay them as specific objects */
        if (!Blind() && !Hallucination() && !u.uswallow)
            see_nearby_objects();
    }
    earth_sense();
}

/* place you on a random location when arriving on a level */
export function u_on_rndspot(upflag) { /* void */
    let up = (upflag & 1), was_in_W_tower = (upflag & 2);

    /*
     * Place the hero at a random location within the relevant region.
     * place_lregion(xTELE) -> put_lregion_here(xTELE) -> u_on_newpos()
     * Unspecified region (.lx == 0) defaults to entire level.
     */
    if (was_in_W_tower && On_W_tower_level(u.uz))
        /* Stay inside the Wizard's tower when feasible.
           We use the W Tower's exclusion region for the
           destination instead of its enclosing region.
           Note: up vs down doesn't matter in this case
           because both specify the same exclusion area. */
        place_lregion(svd.dndest.nlx, svd.dndest.nly,
                      svd.dndest.nhx, svd.dndest.nhy,
                      0, 0, 0, 0, LR_DOWNTELE, null);
    else if (up)
        place_lregion(svu.updest.lx, svu.updest.ly,
                      svu.updest.hx, svu.updest.hy,
                      svu.updest.nlx, svu.updest.nly,
                      svu.updest.nhx, svu.updest.nhy,
                      LR_UPTELE, null);
    else
        place_lregion(svd.dndest.lx, svd.dndest.ly,
                      svd.dndest.hx, svd.dndest.hy,
                      svd.dndest.nlx, svd.dndest.nly,
                      svd.dndest.nhx, svd.dndest.nhy,
                      LR_DOWNTELE, null);

    /* might have just left solid rock and unblocked levitation */
    switch_terrain();
}

export function Is_botlevel(lev) { /* boolean */
    return (+(lev.dlevel == elt(svd.dungeons, lev.dnum).num_dunlevs));
}

export function Can_dig_down(lev) { /* boolean */
    return (+(!svl.level.flags.hardfloor
                      && !Is_botlevel(lev)
                      && !Invocation_lev(lev)));
}

/*
 * Like Can_dig_down (above), but also allows falling through on the
 * stronghold level.  Normally, the bottom level of a dungeon resists
 * both digging and falling.
 */
export function Can_fall_thru(lev) { /* boolean */
    return (Can_dig_down(lev) || Is_stronghold(lev) ? 1 : 0);
}

/*
 * True if one can rise up a level (e.g. cursed gain level).
 * This happens on intermediate dungeon levels or on any top dungeon
 * level that has a stairwell style branch to the next higher dungeon.
 * Checks for amulets and such must be done elsewhere.
 */
export function Can_rise_up(x, y, lev) { /* boolean */
    let stway = stairway_find_special_dir(FALSE);

    /* can't rise up from inside the top of the Wizard's tower */
    /* KMH -- or in sokoban */
    if (In_endgame(lev) || In_sokoban(lev)
        || (Is_wiz1_level(lev) && In_W_tower(x, y, lev)))
        return FALSE;
    return (lev.dlevel > 1
                      || (elt(svd.dungeons, lev.dnum).entry_lev == 1
                          && ledger_no(lev) != 1
                          && stway && stway.up) ? 1 : 0);
}

export function has_ceiling(lev) { /* boolean */
    /* FIXME: some (most? all?) of the quest home levels are conceptually
       above ground and don't have ceilings outside of their buildings
       but we don't presently check for that */
    if (In_endgame(lev) && !Is_earthlevel(lev))
        return FALSE;
    return TRUE;
}

export function avoid_ceiling(lev) { /* boolean */
    /* The quest is challenging since parts of the level
       may have ceilings and other parts may not; Avoid
       the ambiguity there by testing with avoid_ceiling()
       and using alternative messaging that avoids the term
       ceiling altogether there */
    if (In_quest(lev) || !has_ceiling(lev))
        return TRUE;
    return FALSE;
}

export function ceiling(x, y) { /* const char * */
    let lev = levl()[x][y];
    let what;

    /* other room types will no longer exist when we're interested --
     * see check_special_room()
     */
    if (chars[in_rooms(x, y, VAULT)])
        what = _("vault's ceiling");
    else if (chars[in_rooms(x, y, TEMPLE)])
        what = _("temple's ceiling");
    else if (chars[in_rooms(x, y, SHOPBASE)])
        what = _("shop's ceiling");
    else if (Is_waterlevel(u.uz))
        /* water plane has no surface; its air bubbles aren't below sky */
        what = _("water above");
    else if (IS_AIR(lev.typ))
        what = _("sky");
    else if (Is_firelevel(u.uz))
        what = _("flames above");
    else if (In_quest(u.uz))
        /* just in case; try to avoid in caller if you can */
        what = _("expanse above");
    else if (Underwater())
        what = _("water's surface");
    else if ((IS_ROOM(lev.typ) && !Is_earthlevel(u.uz))
             || IS_WALL(lev.typ) || IS_DOOR(lev.typ) || lev.typ == SDOOR)
        what = _("ceiling");
    else
        what = _("rock cavern");

    return what;
}

export function surface(x, y) { /* const char * */
    let lev = levl()[x][y];
    let levtyp = SURFACE_AT(x, y);

    if (u_at(x, y) && u.uswallow && is_animal(u.ustuck.data))
        /* 'husk' is iffy but maw is wrong for 't' class */
        return digests(u.ustuck.data) ? _("maw")
               : enfolds(u.ustuck.data) ? _("husk")
                 : _("nonesuch"); /* can't happen (fingers crossed...) */
    else if (IS_AIR(levtyp))
        return Is_waterlevel(u.uz) ? _("air bubble")
                                    : (levtyp == CLOUD) ? _("cloud") : _("air");
    else if (is_pool(x, y))
        return (Underwater() && !Is_waterlevel(u.uz))
            ? _("bottom") : hliquid(_("water"));
    else if (is_ice(x, y))
        return _("ice");
    else if (is_lava(x, y))
        return hliquid(_("lava"));
    else if (lev.typ == DRAWBRIDGE_DOWN)
        return _("bridge");
    else if (IS_ALTAR(levtyp))
        return _("altar");
    else if (IS_GRAVE(levtyp))
        return _("headstone");
    else if (IS_FOUNTAIN(levtyp))
        return _("fountain");
    else if (On_stairs(x, y))
        return _("stairs");
    else if (IS_WALL(levtyp) || levtyp == SDOOR)
        return _("wall"); /* 'surface' during Passes_walls */
    else if (IS_DOOR(levtyp))
        return _("doorway"); /* even for closed door */
    else if (IS_ROOM(levtyp) && !Is_earthlevel(u.uz))
        return _("floor");
    else
        return _("ground");
}

/*
 * It is expected that the second argument of get_level is a depth value,
 * either supplied by the user (teleport control) or randomly generated.
 * But more than one level can be at the same depth.  If the target level
 * is "above" the present depth location, get_level must trace "up" from
 * the player's location (through the ancestors dungeons) the dungeon
 * within which the target level is located.  With only one exception
 * which does not pass through this routine (see level_tele), teleporting
 * "down" is confined to the current dungeon.  At present, level teleport
 * in dungeons that build up is confined within them.
 */
export function get_level(newlevel, levnum) { /* void */
    let br;
    let dgn = u.uz.dnum;

    if (levnum <= 0) {
        /* can only currently happen in endgame */
        levnum = u.uz.dlevel;
    } else if (levnum > (svd.dungeons[dgn].depth_start
                         + svd.dungeons[dgn].num_dunlevs - 1)) {
        /* beyond end of dungeon, jump to last level */
        levnum = svd.dungeons[dgn].num_dunlevs;
    } else {
        /* The desired level is in this dungeon or a "higher" one. */

        /*
         * Branch up the tree until we reach a dungeon that contains the
         * levnum.
         */
        if (levnum < svd.dungeons[dgn].depth_start) {
            do {
                /*
                 * Find the parent dungeon of this dungeon.
                 *
                 * This assumes that end2 is always the "child" and it is
                 * unique.
                 */
                for (br = svb.branches; br; br = br.next)
                    if (br.end2.dnum == dgn)
                        break;
                if (!br)
                    panic(_("get_level: can't find parent dungeon"));

                dgn = br.end1.dnum;
            } while (levnum < svd.dungeons[dgn].depth_start);
        }

        /* We're within the same dungeon; calculate the level. */
        levnum = levnum - svd.dungeons[dgn].depth_start + 1;
    }

    newlevel.dnum = dgn;
    newlevel.dlevel = levnum;
}

/* are you in the quest dungeon? */
export function In_quest(lev) { /* boolean */
    return (+(lev.dnum == quest_dnum()));
}

/* are you in the mines dungeon? */
export function In_mines(lev) { /* boolean */
    return (+(lev.dnum == mines_dnum()));
}

/*
 * Return the branch for the given dungeon.
 *
 * This function assumes:
 *      + This is not called with "Dungeons of Doom".
 *      + There is only _one_ branch to a given dungeon.
 *      + Field end2 is the "child" dungeon.
 */
export function dungeon_branch(s) { /* branch * */
    let br;
    let dnum;

    dnum = dname_to_dnum(s);

    /* Find the branch that connects to dungeon i's branch. */
    for (br = svb.branches; br; br = br.next)
        if (br.end2.dnum == dnum)
            break;

    if (!br)
        panic(_("dgn_entrance: can't find entrance to %s"), s);

    return br;
}

/*
 * This returns true if the hero is on the same level as the entrance to
 * the named dungeon.
 *
 * Called from do.c and mklev.c.
 *
 * Assumes that end1 is always the "parent".
 */
export function at_dgn_entrance(s) { /* boolean */
    let br;

    br = dungeon_branch(s);
    return on_level(u.uz, br.end1) ? TRUE : FALSE;
}

/* is `lev' part of Vlad's tower? */
export function In_V_tower(lev) { /* boolean */
    return (+(lev.dnum == tower_dnum()));
}

/* is `lev' a level containing the Wizard's tower? */
export function On_W_tower_level(lev) { /* boolean */
    return (Is_wiz1_level(lev)
                      || Is_wiz2_level(lev)
                      || Is_wiz3_level(lev) ? 1 : 0);
}

/* is <x,y> of `lev' inside the Wizard's tower? */
export function In_W_tower(x, y, lev) { /* boolean */
    if (!On_W_tower_level(lev))
        return FALSE;
    if (!svd.dndest.nlx) {
        impossible(_("No boundary for Wizard's Tower?"));
        return FALSE;
    }
    /*
     * Both of the exclusion regions for arriving via level teleport
     * (from above or below) define the tower's boundary.
     *  assert( svu.updest.nIJ == svd.dndest.nIJ for I={l|h},J={x|y} );
     */
    return within_bounded_area(x, y, svd.dndest.nlx, svd.dndest.nly,
                                         svd.dndest.nhx, svd.dndest.nhy);
}

/* are you in one of the Hell levels? */
export function In_hell(lev) { /* boolean */
    return (elt(svd.dungeons, lev.dnum).flags.hellish);
}

/* sets *lev to be the gateway to Gehennom... */
export function find_hell(lev) { /* void */
    lev.dnum = valley_level().dnum;
    lev.dlevel = 1;
}

/* go directly to hell... */
export function goto_hell(at_stairs, falling) { /* void */
    const $frame = stack_frame(); try {
    let lev = stack_struct(struct_d_level);

    find_hell(lev);
    goto_level(lev, at_stairs, falling, FALSE);
    } finally { stack_pop($frame); }
}

/* is 'lev' the only level in its branch?  affects level teleporters */
export function single_level_branch(lev) { /* boolean */
    /*
     * TODO:  this should be generalized instead of assuming that
     * Fort Ludios is the only single level branch in the dungeon.
     */
    return Is_knox(lev);
}

/* equivalent to dest = source */
export function assign_level(dest, src) { /* void */
    dest.dnum = src.dnum;
    dest.dlevel = src.dlevel;
}

/* dest = src + rn1(range) */
export function assign_rnd_level(dest, src, range) { /* void */
    dest.dnum = src.dnum;
    dest.dlevel = src.dlevel + ((range > 0) ? rnd(range) : -rnd(-range));

    if (dest.dlevel > dunlevs_in_dungeon(dest))
        dest.dlevel = dunlevs_in_dungeon(dest);
    else if (dest.dlevel < 1)
        dest.dlevel = 1;
}

/* return an alignment mask */
export function induced_align(pct) { /* unsigned int */
    let lev = Is_special(u.uz);
    let al;

    if (lev && lev.flags.align)
        if (rn2(100) < pct)
            return lev.flags.align;

    if (svd.dungeons[u.uz.dnum].flags.align)
        if (rn2(100) < pct)
            return svd.dungeons[u.uz.dnum].flags.align;

    al = rn2(3) - 1;
    return Align2amask(al);
}

export function Invocation_lev(lev) { /* boolean */
    return (In_hell(lev)
                   && lev.dlevel == elt(svd.dungeons, lev.dnum).num_dunlevs - 1 ? 1 : 0);
}

/* use instead of depth() wherever a degree of difficulty is made
 * dependent on the location in the dungeon (eg. monster creation).
 */
export function level_difficulty() { /* xint16 */
    let res;

    if (In_endgame(u.uz)) {
        res = depth(svd.dungeon_topology.d_sanctum_level) + Math.trunc(u.ulevel / 2);
    } else if (u.uhave.amulet) {
        res = deepest_lev_reached(FALSE);
    } else {
        res = depth(u.uz);
        /* depth() is the number of elevation units (levels) below
           the theoretical surface; in a builds-up branch, that value
           ends up making the harder to reach levels be treated as if
           they were easier; adjust for the extra effort involved in
           going down to the entrance and then up to the location */
        if (builds_up(u.uz))
            res += 2 * (svd.dungeons[u.uz.dnum].entry_lev - u.uz.dlevel + 1);
            /*
             * 'Proof' by example:  suppose the entrance to sokoban is
             * on dungeon level 9, leading up to bottom sokoban level
             * of 8 [entry_lev].  When the hero is on sokoban level 8
             * [uz.dlevel], depth() yields eight but he has ventured
             * one level beyond 9, so difficulty depth should be 10:
             *   8 + 2 * (8 - 8 + 1) => 10.
             * Going up to 7, depth is 7 but hero will be two beyond 9:
             *   7 + 2 * (8 - 7 + 1) => 11.
             * When he goes up to level 6, three levels beyond 9:
             *   6 + 2 * (8 - 6 + 1) => 12.
             * And the top level of sokoban at 5, four levels beyond 9:
             *   5 + 2 * (8 - 5 + 1) => 13.
             * The same applies to Vlad's Tower, although the increment
             * there is inconsequential compared to overall depth.
             */
    /* #if 0: not in this build */
    }
    /* ring of aggravate monster */
    if (EAggravate_monster())
        res = res > 25 ? 50 : res * 2;
    return res;
}

/* within same branch, or else main dungeon <-> gehennom */
export function dlev_in_current_branch(dlev) { return +(dlev.dnum == u.uz.dnum
     || (u.uz.dnum == valley_level().dnum
         && dlev.dnum == medusa_level().dnum)
     || (u.uz.dnum == medusa_level().dnum
         && dlev.dnum == valley_level().dnum)); }

/* Take one word and try to match it to a level.
 * Recognized levels are as shown by print_dungeon().
 */
export function lev_by_name(nam) { /* schar */
    const $frame = stack_frame(); try {
    let lev = 0;
    let slev = null;
    let dlev = stack_struct(struct_d_level);
    let p;
    let idx, idxtoo;
    let buf = stack_array(char, BUFSZ);
    let mseen;

    /* look at the player's custom level annotations first */
    if ((mseen = find_mapseen_by_str(nam)) != null) {
        struct_assign(dlev, mseen.lev);
    } else {
        /* no matching annotation, check whether they used a name we know */

        /* allow strings like "the oracle level" to find "oracle" */
        if (!strncmpi(nam, _("the "), 4))
            nam += 4;
        if ((p = strstri(nam, _(" level"))) != 0 && p == eos(nam) - 6) {
            nam = strcpy(buf, nam);
            chars[(eos(buf) - 6)] = ord('\0');
        }
        /* hell is the old name, and wouldn't match; gehennom would match its
           branch, yielding the castle level instead of valley of the dead */
        if (!strncmpi((nam), _(("gehennom")), -1) || !strncmpi((nam), _(("hell")), -1)) {
            if (In_V_tower(u.uz))
                nam = _(" to Vlad's tower"); /* branch to... */
            else
                nam = _("valley");
        } else if (!strncmpi((nam), _(("delphi")), -1)) {
            /* Oracle says "welcome to Delphi" so recognize that name too */
            nam = _("oracle");
        }

        if ((slev = find_level(nam)) != null)
            struct_assign(dlev, slev.dlevel);
    }

    if (mseen || slev) {
        idx = ledger_no(dlev);
        if (dlev_in_current_branch(dlev)
            /* either wizard mode or else seen and not forgotten;
               note: used to be '(flags & (FORGOTTEN|VISITED)) == VISITED'
               back when amnesia could cause levels to be forgotten */
            && (wizard() || (svl.level_info[idx].flags & VISITED) == VISITED)) {
            lev = depth(dlev);
        }
    } else { /* not a specific level; try branch names */
        idx = find_branch(nam, null);
        /* "<branch> to Xyzzy" */
        if (idx < 0 && (p = strstri(nam, _(" to "))) != 0)
            idx = find_branch(p + 4, null);

        if (idx >= 0) {
            idxtoo = (idx >> 8) & 0x00FF;
            idx &= 0x00FF;
            /* either wizard mode, or else _both_ sides of branch seen; */
            /* (flags & VISITED)==VISITED: see comment about amnesia above */
            if (wizard() || (((svl.level_info[idx].flags & VISITED) == VISITED)
                           && ((svl.level_info[idxtoo].flags & VISITED)
                               == VISITED))) {
                if (ledger_to_dnum(idxtoo) == u.uz.dnum)
                    idx = idxtoo;
                dlev.dnum = ledger_to_dnum(idx);
                dlev.dlevel = ledger_to_dlev(idx);
                if (dlev_in_current_branch(dlev))
                    lev = depth(dlev);
            }
        }
    }
    return lev;
    } finally { stack_pop($frame); }
}

function unplaced_floater(dptr) { /* boolean */
    let br;
    let idx = ptr_diff(dptr, svd.dungeons[0]);

    /* if other floating branches are added, this will need to change */
    if (idx != knox_level().dnum)
        return FALSE;
    for (br = svb.branches; br; br = br.next)
        if (br.end1.dnum == svn.n_dgns && br.end2.dnum == idx)
            return TRUE;
    return FALSE;
}

function unreachable_level(lvl_p, unplaced) { /* boolean */
    let dummy;

    if (unplaced)
        return TRUE;
    if (In_endgame(u.uz) && !In_endgame(lvl_p))
        return TRUE;
    if ((dummy = find_level(_("dummy"))) != null && on_level(lvl_p, dummy.dlevel))
        return TRUE;
    return FALSE;
}

function tport_menu(
    win,
    entry,
    lchoices,
    lvl_p,
    cannotreach) { /* void */
    const $frame = stack_frame(); try {
    let tmpbuf = stack_array(char, BUFSZ);
    let any = stack_struct(struct_any);
    let clr = NO_COLOR;

    chars[lchoices.lev + lchoices.idx] = lvl_p.dlevel;
    lchoices.dgn[lchoices.idx] = lvl_p.dnum;
    chars[lchoices.playerlev + lchoices.idx] = depth(lvl_p);
    struct_assign(any, cg.zeroany);
    if (cannotreach) {
        /* not selectable, but still consumes next menuletter;
           prepend padding in place of missing menu selector */
        sprintf(tmpbuf, _("    %s"), entry);
        entry = tmpbuf;
    } else {
        any.a_int = lchoices.idx + 1;
    }
    add_menu(win, nul_glyphinfo, any, lchoices.menuletter, 0,
             ATR_NONE, clr, entry, MENU_ITEMFLAGS_NONE);
    /* this assumes there are at most 52 interesting levels */
    if (lchoices.menuletter == ord('z'))
        lchoices.menuletter = ord('A');
    else
        lchoices.menuletter++;
    lchoices.idx++;
    return;
    } finally { stack_pop($frame); }
}

/* Convert a branch type to a string usable by print_dungeon(). */
function br_string(type) { /* const char * */
    switch (type) {
    case BR_PORTAL:
        return _("Portal");
    case BR_NO_END1:
        return _("Connection");
    case BR_NO_END2:
        return _("One way stair");
    case BR_STAIR:
        return _("Stair");
    }
    return _(" (unknown)");
}

function chr_u_on_lvl(dlev) { /* char */
    return u.uz.dnum == dlev.dnum && u.uz.dlevel == dlev.dlevel ? ord('*') : ord(' ');
}

/* Print all child branches between the lower and upper bounds. */
function print_branch(
    win,
    dnum, lower_bound, upper_bound,
    bymenu, lchoices_p) { /* void */
    const $frame = stack_frame(); try {
    let br;
    let buf = stack_array(char, BUFSZ);

    /* This assumes that end1 is the "parent". */
    for (br = svb.branches; br; br = br.next) {
        if (br.end1.dnum == dnum && lower_bound < br.end1.dlevel
            && br.end1.dlevel <= upper_bound) {
            sprintf(buf, _("%c %s to %s: %d"), bymenu ? chr_u_on_lvl(br.end1) : ord(' '), br_string(br.type), svd.dungeons[br.end2.dnum].dname, depth(br.end1))

;
            if (bymenu)
                tport_menu(win, buf, lchoices_p, br.end1,
                           unreachable_level(br.end1, FALSE));
            else
                putstr()(win, 0, buf);
        }
    }
    } finally { stack_pop($frame); }
}

/* Print available dungeon information. */
export function print_dungeon(bymenu, rlev, rdgn) { /* schar */
    const $frame = stack_frame(); try {
    let i, last_level, nlev;
    let buf = stack_array(char, BUFSZ);
    let descr;
    let first, unplaced;
    let slev;
    let dptr;
    let br;
    let lchoices = stack_struct(struct_lchoice);
    let win = create_nhwindow()(NHW_MENU);

    if (bymenu) {
        start_menu()(win, MENU_BEHAVE_STANDARD);
        lchoices.idx = 0;
        lchoices.menuletter = ord('a');
    }

    for (i = 0, dptr = svd.dungeons[0]; i < svn.n_dgns; i++, dptr = ptr_add(dptr, 1)) {
        if (bymenu && In_endgame(u.uz) && i != astral_level().dnum)
            continue;
        unplaced = unplaced_floater(dptr);
        descr = unplaced ? _("depth") : _("level");
        nlev = dptr.num_dunlevs;
        if (nlev > 1)
            Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s: %s %d to %d"), dptr.dname, makeplural(descr), dptr.depth_start, dptr.depth_start + nlev - 1);
        else
            Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s: %s %d"), dptr.dname, descr, dptr.depth_start)

;

        /* Most entrances are uninteresting. */
        if (dptr.entry_lev != 1) {
            if (dptr.entry_lev == nlev)
                strcat(buf, _(", entrance from below"));
            else
                sprintf(eos(buf), _(", entrance on %d"), dptr.depth_start + dptr.entry_lev - 1)
;
        }
        if (bymenu) {
            add_menu_heading(win, buf);
        } else
            putstr()(win, 0, buf);

        /*
         * Circle through the special levels to find levels that are in
         * this dungeon.
         */
        for (slev = svs.sp_levchn, last_level = 0; slev; slev = slev.next) {
            if (slev.dlevel.dnum != i)
                continue;

            /* print any branches before this level */
            print_branch(win, i, last_level, slev.dlevel.dlevel, bymenu,
                         lchoices);

            sprintf(buf, _("%c %s: %d"), chr_u_on_lvl(slev.dlevel), slev.proto, depth(slev.dlevel))

;
            if ((Lassigned((svd.dungeon_topology.d_stronghold_level)) && on_level(slev.dlevel, (svd.dungeon_topology.d_stronghold_level))))
                sprintf(eos(buf), _(" (tune %s)"), svt.tune);
            if (bymenu)
                tport_menu(win, buf, lchoices, slev.dlevel,
                           unreachable_level(slev.dlevel, unplaced));
            else
                putstr()(win, 0, buf);

            last_level = slev.dlevel.dlevel;
        }
        /* print branches after the last special level */
        print_branch(win, i, last_level, MAXLEVEL, bymenu, lchoices);
    }

    if (bymenu) {
        let n;
        let selected = stack_var(ptr_to(struct_mi));
        let idx;

        end_menu()(win, _("Level teleport to where:"));
        n = select_menu(win, PICK_ONE, selected);
        destroy_nhwindow()(win);
        if (n > 0) {
            idx = ptr_add(selected[0], 0).item.a_int - 1;
            free(addr_of(selected[0]));
            if (rlev && rdgn) {
                chars[rlev] = chars[lchoices.lev + idx];
                rdgn[0] = lchoices.dgn[idx];
                return chars[lchoices.playerlev + idx];
            }
        }
        return 0;
    }

    /* Print out floating branches (if any). */
    for (first = TRUE, br = svb.branches; br; br = br.next) {
        if (br.end1.dnum == svn.n_dgns) {
            if (first) {
                putstr()(win, 0, _(""));
                putstr()(win, 0, _("Floating branches"));
                first = FALSE;
            }
            sprintf(buf, _("   %s to %s"), br_string(br.type), svd.dungeons[br.end2.dnum].dname)
;
            putstr()(win, 0, buf);
        }
    }

    /* I hate searching for the invocation pos while debugging. -dean */
    if (Invocation_lev(u.uz)) {
        putstr()(win, 0, _(""));
        sprintf(buf, _("Invocation position @ (%d,%d), hero @ (%d,%d)"), svi.inv_pos.x, svi.inv_pos.y, u.ux, u.uy)
;
        putstr()(win, 0, buf);
    } else {
        let trap;

        /* if current level has a magic portal, report its location;
           this assumes that there is at most one magic portal on any
           given level; quest and ft.ludios have pairs (one in main
           dungeon matched with one in the corresponding branch), the
           elemental planes have singletons (connection to next plane) */
        chars[buf] = ord('\0');
        for (trap = gf.ftrap; trap; trap = trap.ntrap)
            if (trap.ttyp == MAGIC_PORTAL)
                break;

        if (trap)
            sprintf(buf, _("Portal @ (%d,%d), hero @ (%d,%d)"), trap.tx, trap.ty, u.ux, u.uy);

        /* only report "no portal found" when actually expecting a portal */
        else if (Is_earthlevel(u.uz) || Is_waterlevel(u.uz)
                 || Is_firelevel(u.uz) || Is_airlevel(u.uz)
                 || Is_qstart(u.uz) || at_dgn_entrance(_("The Quest"))
                 || Is_knox(u.uz))
            strcpy(buf, _("No portal found."))
;

        /* only give output if we found a portal or expected one and didn't */
        if (chars[buf]) {
            putstr()(win, 0, _(""));
            putstr()(win, 0, buf);
        }
    }

    display_nhwindow()(win, TRUE);
    destroy_nhwindow()(win);
    return 0;
    } finally { stack_pop($frame); }
}

/* Record that the player knows about a branch from a level. This function
 * will determine whether or not it was a "real" branch that was taken.
 * This function should not be called for a transition done via level
 * teleport or via the Eye.
 */
export function recbranch_mapseen(source, dest) { /* void */
    let mptr;
    let br;

    /* not a branch */
    if (source.dnum == dest.dnum)
        return;

    /* we only care about forward branches */
    for (br = svb.branches; br; br = br.next) {
        if (on_level(source, br.end1) && on_level(dest, br.end2))
            break;
        if (on_level(source, br.end2) && on_level(dest, br.end1))
            return;
    }

    /* branch not found, so not a real branch. */
    if (!br)
        return;

    if ((mptr = find_mapseen(source)) != null) {
        if (mptr.br && br != mptr.br)
            impossible(_("Two branches on the same level?"));
        mptr.br = br;
    } else {
        impossible(_("Can't note branch for unseen level (%d, %d)"),
                   source.dnum, source.dlevel);
    }
}

function get_annotation(lev) { /* char * */
    let mptr;

    if ((mptr = find_mapseen(lev)))
        return mptr.custom;
    return 0;
}

/* print the annotation for the current level, if it exists */
export function print_level_annotation() { /* void */
    let annotation;

    if ((annotation = get_annotation(u.uz)) != 0)
        You(_("remember this level as %s."), annotation);
}

/* ask user to annotate level lev.
   if lev is NULL, uses current level. */
function query_annotation(lev) { /* void */
    const $frame = stack_frame(); try {
    let mptr;
    let nbuf = stack_array(char, BUFSZ); /* Buffer for response */

    if (!(mptr = find_mapseen(lev ? lev : u.uz)))
        return;

    chars[nbuf + 0] = ord('\0');

    if (mptr.custom) {
        let tmpbuf = stack_array(char, BUFSZ);

        sprintf(tmpbuf, _("Replace annotation \"%.30s%s\" with?"), mptr.custom, (strlen(mptr.custom) > 30) ? _("...") : _(""))
;
        getlin(tmpbuf, nbuf);
    } else

    {
        let qbuf = stack_array(char, QBUFSZ), lbuf = stack_array(char, QBUFSZ); /* level description */

        if (!lev || on_level(u.uz, lev)) {
            strcpy(lbuf, _("this dungeon level"));
        } else {
            let dflgs = (lev.dnum == u.uz.dnum) ? 0 : 2;
            let save_uz = struct_assign(stack_struct(struct_d_level), u.uz);

            struct_assign(u.uz, lev);
            describe_level(lbuf, dflgs);
            struct_assign(u.uz, save_uz);

            strsubst(lbuf, _("Dlvl:"), _("level "));
            /* even though we've told describe_level() not to append
               a trailing space (by not including '1' in dflgs), the
               level number is formatted with %-2d so single digit
               values will end up with one anyway; remove it */
            trimspaces(lbuf);
        }
        Snprintf(qbuf, sizeof(array_of(char, QBUFSZ)), _("What do you want to call %s?"), lbuf);
        getlin(qbuf, nbuf);
    }

    /* empty input or ESC means don't add or change annotation;
       space-only means discard current annotation without adding new one */
    if (!chars[nbuf] || chars[nbuf] == ord('\x1b'))
        return;
    /* strip leading and trailing spaces, compress out consecutive spaces */
    mungspaces(nbuf);

    /* discard old annotation, if any */
    if (mptr.custom) {
        free(mptr.custom);
        mptr.custom = 0;
        mptr.custom_lth = 0;
    }
    /* add new annotation, unless it's all spaces (which will be an
       empty string after mungspaces() above) */
    if (chars[nbuf] && strcmp(nbuf, _(" "))) {
        mptr.custom = dupstr(nbuf);
        /* _lth field does not include trailing '\0' in the count */
        mptr.custom_lth = strlen(mptr.custom);
    }
    } finally { stack_pop($frame); }
}

/* #annotate command - add a custom name to the current level */
export function donamelevel() { /* int */
    if (iflags.menu_requested)
        return dooverview();
    query_annotation(null);
    return ECMD_OK;
}

/* exclusion zones */
export function free_exclusions() { /* void */
    let ez = sve.exclusion_zones;

    while (ez) {
        let nxtez = ez.next;

        free(addr_of(ez));
        ez = nxtez;
    }
    sve.exclusion_zones = null;
}

export function save_exclusions(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let ez;
    let nez = stack_var(int);

    for (nez[0] = 0, ez = sve.exclusion_zones; ez; ez = ez.next, ++nez[0])
        ;

    if (update_file(nhfp)) {
        Sfo_int(nhfp, nez, _("exclusion_count"));
        for (ez = sve.exclusion_zones; ez; ez = ez.next) {
            Sfo_xint16(nhfp, ref_of(ez, "zonetype"), _("exclusion-zonetype"));
            Sfo_coordxy(nhfp, ref_of(ez, "lx"), _("exclusion-lx"));
            Sfo_coordxy(nhfp, ref_of(ez, "ly"), _("exclusion-ly"));
            Sfo_coordxy(nhfp, ref_of(ez, "hx"), _("exclusion-hx"));
            Sfo_coordxy(nhfp, ref_of(ez, "hy"), _("exclusion-hy"));
        }
    }
    } finally { stack_pop($frame); }
}

export function load_exclusions(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let ez;
    let nez = stack_var(int, 0);

    sfi_int(nhfp, nez, _("exclusion_count"));

    while (nez[0]-- > 0) {
        ez = view_of(struct_exclusion_zone, addr_of(alloc(sizeof(struct_exclusion_zone))));
        sfi_xint16(nhfp, ref_of(ez, "zonetype"), _("exclusion-zonetype"));
        Sfi_coordxy(nhfp, ref_of(ez, "lx"), _("exclusion-lx"));
        Sfi_coordxy(nhfp, ref_of(ez, "ly"), _("exclusion-ly"));
        Sfi_coordxy(nhfp, ref_of(ez, "hx"), _("exclusion-hx"));
        Sfi_coordxy(nhfp, ref_of(ez, "hy"), _("exclusion-hy"));
        ez.next = sve.exclusion_zones;
        sve.exclusion_zones = ez;
    }
    } finally { stack_pop($frame); }
}

/* find the particular mapseen object in the chain; may return null */
function find_mapseen(lev) { /* mapseen * */
    let mptr;

    for (mptr = svm.mapseenchn; mptr; mptr = mptr.next)
        if (on_level(mptr.lev, lev))
            break;

    return mptr;
}

function find_mapseen_by_str(s) { /* mapseen * */
    let mptr;

    for (mptr = svm.mapseenchn; mptr; mptr = mptr.next)
        if (mptr.custom && !strcmpi(s, mptr.custom))
            break;

    return mptr;
}

export function rm_mapseen(ledger_num) { /* void */
    let mptr, mprev = null;
    let bp, bpnext;

    for (mptr = svm.mapseenchn; mptr; mprev = mptr, mptr = mptr.next)
        if (svd.dungeons[mptr.lev.dnum].ledger_start + mptr.lev.dlevel
            == ledger_num)
            break;
    if (!mptr)
        return;

    if (mptr.custom)
        free(mptr.custom), mptr.custom = (0);

    bpnext = mptr.final_resting_place;
    while ((bp = bpnext) != null) {
        bpnext = bp.next;
        free(addr_of(bp));
    }

    if (mprev) {
        mprev.next = mptr.next;
    } else {
        svm.mapseenchn = mptr.next;
    }
    free(addr_of(mptr));
}

function save_mapseen(nhfp, mptr) { /* void */
    const $frame = stack_frame(); try {
    let curr;
    let i, brindx = stack_var(int);

    for (brindx[0] = 0, curr = svb.branches; curr; curr = curr.next, ++brindx[0])
        if (curr == mptr.br)
            break;
    Sfo_int(nhfp, brindx, _("mapseen-branch_index"));
    Sfo_d_level(nhfp, mptr.lev, _("mapseen-d_level"));
    Sfo_mapseen_feat(nhfp, mptr.feat, _("mapseen-feat"));
    Sfo_mapseen_flags(nhfp, mptr.flags, _("mapseen-flags"));
    Sfo_unsigned(nhfp, ref_of(mptr, "custom_lth"), _("mapseen-custom_lth"));

    if (mptr.custom_lth) {
        Sfo_char(nhfp, mptr.custom, _("mapseen-custom"),
                 int(mptr.custom_lth));
    }
    for (i = 0; i < ((MAXNROFROOMS + 1) * 2); ++i) {
        Sfo_mapseen_rooms(nhfp, mptr.msrooms[i], _("mapseen-msrooms"));
    }
    savecemetery(nhfp, ref_of(mptr, "final_resting_place"));
    } finally { stack_pop($frame); }
}

function load_mapseen(nhfp) { /* mapseen * */
    const $frame = stack_frame(); try {
    let i, branchnum = stack_var(int, 0), brindx;
    let load;
    let curr;

    load = view_of(struct_mapseen, addr_of(alloc(sizeof(struct_mapseen))));

    sfi_int(nhfp, branchnum, _("mapseen-branch_index"));
    for (brindx = 0, curr = svb.branches; curr; curr = curr.next, ++brindx)
        if (brindx == branchnum[0])
            break;
    load.br = curr;

    Sfi_d_level(nhfp, load.lev, _("mapseen-d_level"));
    Sfi_mapseen_feat(nhfp, load.feat, _("mapseen-feat"));
    Sfi_mapseen_flags(nhfp, load.flags, _("mapseen-flags"));
    sfi_unsigned(nhfp, ref_of(load, "custom_lth"), _("mapseen-custom_lth"));

    if (load.custom_lth) {
        /* length doesn't include terminator (which isn't saved & restored) */
        load.custom = addr_of(alloc(unsigned(load.custom_lth + 1)));
        Sfi_char(nhfp, load.custom, _("mapseen-custom"),
                 int(load.custom_lth));
        chars[load.custom + load.custom_lth] = ord('\0');
    } else {
        load.custom = 0;
    }
    for (i = 0; i < ((MAXNROFROOMS + 1) * 2); ++i) {
        Sfi_mapseen_rooms(nhfp, load.msrooms[i], _("mapseen-msrooms"));
    }
    restcemetery(nhfp, ref_of(load, "final_resting_place"));
    return load;
    } finally { stack_pop($frame); }
}

/* for '#stats' wizard-mode command, to show memory used for #overview data */
export function overview_stats(
    win,
    statsfmt,
    total_count, total_size) { /* void */ /* args for the format */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), hdrbuf = stack_array(char, QBUFSZ);
    let ocount, osize, bcount, bsize, acount, asize;
    let ce;
    let mptr;

    ocount = bcount = acount = osize = bsize = asize = 0;
    for (mptr = svm.mapseenchn; mptr; mptr = mptr.next) {
        ++ocount;
        osize += NHJS_SIZEOF_mapseen;
        for (ce = mptr.final_resting_place; ce; ce = ce.next) {
            ++bcount;
            bsize += NHJS_SIZEOF_struct_cemetery;
        }
        if (mptr.custom_lth) {
            ++acount;
            asize += unsigned(mptr.custom_lth + 1);
        }
    }

    sprintf(hdrbuf, _("general, size %lld"), NHJS_SIZEOF_mapseen);
    sprintf(buf, statsfmt, hdrbuf, ocount, osize);
    putstr()(win, 0, buf);
    if (bcount) {
        sprintf(hdrbuf, _("cemetery, size %lld"), NHJS_SIZEOF_struct_cemetery)
;
        sprintf(buf, statsfmt, hdrbuf, bcount, bsize);
        putstr()(win, 0, buf);
    }
    if (acount) {
        sprintf(hdrbuf, _("annotations, text"));
        sprintf(buf, statsfmt, hdrbuf, acount, asize);
        putstr()(win, 0, buf);
    }
    total_count[0] += ocount + bcount + acount;
    total_size[0] += osize + bsize + asize;
    } finally { stack_pop($frame); }
}

/* Remove all mapseen objects for a particular dnum.
 * Useful during quest expulsion to remove quest levels.
 * [No longer deleted, just marked as notreachable.  #overview will
 * ignore such levels, end of game disclosure will include them.]
 */
export function remdun_mapseen(dnum) { /* void */
    let mptr, mptraddr;

    mptraddr = ref_of(svm, "mapseenchn");
    while ((mptr = mptraddr[0]) != null) {
        if (mptr.lev.dnum == dnum) {
            mptr.flags.notreachable = 1;
        }

        mptraddr = ref_of(mptr, "next");
    }
}

export function init_mapseen(lev) { /* void */
    /* Create a level and insert in "sorted" order.  This is an insertion
     * sort first by dungeon (in order of discovery) and then by level number.
     */
    let mptr, init, prev;

    init = view_of(struct_mapseen, addr_of(alloc(sizeof(struct_mapseen))));
    memset(addr_of(init), 0, sizeof(struct_mapseen));
    /* memset is fine for feature bits, flags, and rooms array;
       explicitly initialize pointers to null */
    init.next = null, init.br = null, init.custom = 0;
    init.final_resting_place = null;
    /* svl.lastseentyp[][] is reused for each level, so get rid of
       previous level's data */
    memset(addr_of(svl.lastseentyp), 0, sizeof_member(svl, "lastseentyp"));

    init.lev.dnum = lev.dnum;
    init.lev.dlevel = lev.dlevel;

    /* walk until we get to the place where we should insert init */
    for (mptr = svm.mapseenchn, prev = null; mptr;
         prev = mptr, mptr = mptr.next) {
        if (mptr.lev.dnum > init.lev.dnum
            || (mptr.lev.dnum == init.lev.dnum
                && mptr.lev.dlevel > init.lev.dlevel))
            break;
    }
    if (!prev) {
        init.next = svm.mapseenchn;
        svm.mapseenchn = init;
    } else {
        mptr = prev.next;
        prev.next = init;
        init.next = mptr;
    }
}

export function OF_INTEREST(feat) { return (feat.nfount || feat.nsink || feat.nthrone || feat.naltar
     || feat.ngrave || feat.ntree || feat.nshop || feat.ntemple ? 1 : 0); }

  /* || (feat).water || (feat).ice || (feat).lava */

/* returns true if this level has something interesting to print out */
function interest_mapseen(mptr) { /* boolean */
    if (on_level(u.uz, mptr.lev))
        return TRUE;
    if (mptr.flags.notreachable || mptr.flags.forgot)
        return FALSE;
    /* when in tutorial, show all tutorial levels visited whether interesting
       or not and don't show any other levels; when outside tutorial, don't
       show any tutorial levels even if they're considered interesting */
    if (In_tutorial(u.uz)) {
        return In_tutorial(mptr.lev);
    } else {
        if (In_tutorial(mptr.lev))
            return FALSE;
    }
    /* level is of interest if it has an auto-generated annotation */
    if (mptr.flags.oracle || mptr.flags.bigroom || mptr.flags.roguelevel
        || mptr.flags.castle || mptr.flags.valley
        || mptr.flags.msanctum || mptr.flags.vibrating_square
        || mptr.flags.quest_summons || mptr.flags.questing)
        return TRUE;
    /* when in Sokoban, list all sokoban levels visited; when not in it,
       list any visited Sokoban level which remains unsolved (will usually
       only be furthest one reached, but it's possible to enter pits and
       climb out on the far side on the first Sokoban level; also, wizard
       mode overrides teleport restrictions) */
    if (In_sokoban(mptr.lev)
        && (In_sokoban(u.uz) || !mptr.flags.sokosolved))
        return TRUE;
    /* when in the endgame, list all endgame levels visited, whether they
       have annotations or not, so that #overview doesn't become extremely
       sparse once the rest of the dungeon has been flagged as notreachable */
    if (In_endgame(u.uz))
        return In_endgame(mptr.lev);
    /* level is of interest if it has non-zero feature count or known bones
       or user annotation or known connection to another dungeon branch
       or is the furthest level reached in its branch */
    return (OF_INTEREST(mptr.feat)
                      || (mptr.final_resting_place
                          && (mptr.flags.knownbones || wizard()))
                      || mptr.custom || mptr.br
                      || (mptr.lev.dlevel
                          == svd.dungeons[mptr.lev.dnum].dunlev_ureached) ? 1 : 0);
}

/* update the lastseentyp at x,y */
export function update_lastseentyp(x, y) { /* void */
    let mtmp;
    let ltyp = levl()[x][y].typ;

    if (ltyp == DRAWBRIDGE_UP)
        ltyp = db_under_typ(levl()[x][y].flags);
    if ((mtmp = m_at(x, y)) != null
        && M_AP_TYPE(mtmp) == M_AP_FURNITURE && canseemon(mtmp))
        ltyp = cmap_to_type(int(mtmp.mappearance));
    chars[svl.lastseentyp[x] + y] = ltyp;
}

/* for some cases where deferred update needs to be done immediately;
   hide details from caller */
export function update_mapseen_for(x, y) { /* int */
    recalc_mapseen(); /* whole level */
    return chars[svl.lastseentyp[x] + y];
}

/* count mapseen feature from lastseentyp at x,y */
function count_feat_lastseentyp(
    mptr,
    x, y) { /* void */
    let count;
    let atmp;

    switch (chars[svl.lastseentyp[x] + y]) {
    /* #if 0: not in this build */

    case TREE:
        count = mptr.feat.ntree + 1;
        if (count <= 3)
            mptr.feat.ntree = unsigned(count);
        break;
    case FOUNTAIN:
        count = mptr.feat.nfount + 1;
        if (count <= 3)
            mptr.feat.nfount = unsigned(count);
        break;
    case THRONE:
        count = mptr.feat.nthrone + 1;
        if (count <= 3)
            mptr.feat.nthrone = unsigned(count);
        break;
    case SINK:
        count = mptr.feat.nsink + 1;
        if (count <= 3)
            mptr.feat.nsink = unsigned(count);
        break;
    case GRAVE:
        count = mptr.feat.ngrave + 1;
        if (count <= 3)
            mptr.feat.ngrave = unsigned(count);
        break;
    case ALTAR:
        /* get the altarmask for this location; might be a mimic */
        atmp = unsigned(altarmask_at(x, y));
        /* convert to index: 0..3 */
        atmp = (Is_astralevel(u.uz) && (levl()[x][y].seenv & SVALL) != SVALL)
               ? MSA_NONE
               : Amask2msa(atmp);
        if (!mptr.feat.naltar)
            mptr.feat.msalign = atmp;
        else if (mptr.feat.msalign != atmp)
            mptr.feat.msalign = MSA_NONE;
        count = mptr.feat.naltar + 1;
        if (count <= 3)
            mptr.feat.naltar = unsigned(count);
        break;
        /*  An automatic annotation is added to the Castle and
         *  to Fort Ludios once their structure's main entrance
         *  has been seen (in person or via magic mapping).
         *  For the Fort, that entrance is just a secret door
         *  which will be converted into a regular one when
         *  located (or destroyed).
         * DOOR: possibly a lowered drawbridge's open portcullis;
         * DBWALL: a raised drawbridge's "closed door";
         * DRAWBRIDGE_DOWN: the span provided by lowered bridge,
         *  with moat or other terrain hidden underneath;
         * DRAWBRIDGE_UP: moat in front of a raised drawbridge,
         *  not recognizable as a bridge location unless/until
         *  the adjacent DBWALL has been seen.
         */
    case DOOR:
        if (Is_knox(u.uz)) {
            let ty, tx = x - 4;

            /* Throne is four columns to left, either directly in
             * line or one row higher or lower, and doesn't have
             * to have been seen yet.
             *   ......|}}}.
             *   ..\...S}...
             *   ..\...S}...
             *   ......|}}}.
             * For 3.6.0 and earlier, it was always in direct line:
             * both throne and door on the lower of the two rows.
             */
            for (ty = y - 1; ty <= y + 1; ++ty)
                if (isok(tx, ty) && IS_THRONE(levl()[tx][ty].typ)) {
                    mptr.flags.ludios = 1;
                    break;
                }
            break;
        }
        if (is_drawbridge_wall(x, y) < 0)
            break;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case DBWALL:
    case DRAWBRIDGE_DOWN:
        if (Is_stronghold(u.uz))
            mptr.flags.castle = 1, mptr.flags.castletune = 1;
        break;
    default:
        break;
    }
}

/* recalculate mapseen for the current level */
export function recalc_mapseen() { /* void */
    const $frame = stack_frame(); try {
    let mptr, oth_mptr;
    let mtmp;
    let bp, bonesaddr;
    let t;
    let i, ridx;
    let count;
    let x, y;
    let uroom;

    /* Should not happen in general, but possible if in the process
     * of being booted from the quest.  The mapseen object gets
     * removed during the expulsion but prior to leaving the level
     * [Since quest expulsion no longer deletes quest mapseen data,
     * null return from find_mapseen() should now be impossible.]
     */
    if (!(mptr = find_mapseen(u.uz)))
        return;

    /* reset all features; mptr->feat.* = 0; */
    memset(addr_of(mptr.feat), 0, sizeof(struct_mapseen_feat));
    /* reset most flags; some level-specific ones are left as-is */
    if (mptr.flags.notreachable) {
        mptr.flags.notreachable = 0; /* reached it; Eye of the Aethiopica? */
        if (In_quest(u.uz)) {
            let mptrtmp = svm.mapseenchn;

            /* when quest was notreachable due to ejection and portal removal,
               getting back to it via arti-invoke should revive annotation
               data for all quest levels, not just the one we're on now */
            do {
                if (mptrtmp.lev.dnum == mptr.lev.dnum)
                    mptrtmp.flags.notreachable = 0;
                mptrtmp = mptrtmp.next;
            } while (mptrtmp);
        }
    }
    mptr.flags.knownbones = 0;
    mptr.flags.sokosolved = +(In_sokoban(u.uz) && !Sokoban());
    /* mptr->flags.bigroom retains previous value when hero can't see */
    if (!Blind())
        mptr.flags.bigroom = Is_bigroom(u.uz);
    else if (mptr.flags.forgot)
        mptr.flags.bigroom = 0;
    mptr.flags.roguelevel = Is_rogue_level(u.uz);
    mptr.flags.oracle = 0; /* recalculated during room traversal below */
    mptr.flags.castletune = 0;
    /* flags.castle retains previous value */
    mptr.flags.forgot = 0;
    /* flags.quest_summons disabled once quest finished */
    mptr.flags.quest_summons = (at_dgn_entrance(_("The Quest"))
                                 && u.uevent.qcalled
                                 && !(u.uevent.qcompleted
                                      || u.uevent.qexpelled
                                      || svq.quest_status.leader_is_dead) ? 1 : 0);
    mptr.flags.questing = (on_level(u.uz, svd.dungeon_topology.d_qstart_level)
                            && svq.quest_status.got_quest ? 1 : 0);
    /* flags.msanctum, .valley, and .vibrating_square handled below */

    /* track rooms the hero is in */
    for (i = 0; (uroom = chars[u.urooms + i]) != ord('\0'); ++i) {
        ridx = unsigned(unsigned(uroom) - ROOMOFFSET);
        mptr.msrooms[ridx].seen = 1;
        mptr.msrooms[ridx].untended =
            (svr.rooms[ridx].rtype >= SHOPBASE)
                ? +(!(mtmp = shop_keeper(uroom)) || !inhishop(mtmp))
                : (svr.rooms[ridx].rtype == TEMPLE)
                      ? +(!(mtmp = findpriest(uroom)) || !inhistemple(mtmp))
                      : 0;
    }

    /* recalculate room knowledge: for now, just shops and temples
     * this could be extended to an array of 0..SHOPBASE
     */
    for (i = 0; i < SIZE(mptr.msrooms); ++i) {
        if (mptr.msrooms[i].seen) {
            if (svr.rooms[i].rtype >= SHOPBASE) {
                if (mptr.msrooms[i].untended)
                    mptr.feat.shoptype = SHOPBASE - 1;
                else if (!mptr.feat.nshop)
                    mptr.feat.shoptype = unsigned(svr.rooms[i].rtype);
                else if (mptr.feat.shoptype != unsigned((svr.rooms[i].rtype)))
                    mptr.feat.shoptype = 0;
                count = mptr.feat.nshop + 1;
                if (count <= 3)
                    mptr.feat.nshop = unsigned(count);
            } else if (svr.rooms[i].rtype == TEMPLE) {
                /* altar and temple alignment handled below */
                count = mptr.feat.ntemple + 1;
                if (count <= 3)
                    mptr.feat.ntemple = unsigned(count);
            } else if (svr.rooms[i].orig_rtype == DELPHI) {
                mptr.flags.oracle = 1;
            }
        }
    }

    /* Update svl.lastseentyp with typ if and only if it is in sight or the
     * hero can feel it on their current location (i.e. not levitating).
     * This *should* give the "last known typ" for each dungeon location.
     * (At the very least, it's a better assumption than determining what
     * the player knows from the glyph and the typ (which is isn't quite
     * enough information in some cases)).
     *
     * It was reluctantly added to struct rm to track.  Alternatively
     * we could track "features" and then update them all here, and keep
     * track of when new features are created or destroyed, but this
     * seemed the most elegant, despite adding more data to struct rm.
     * [3.6.0: we're using svl.lastseentyp[][] rather than level.locations
     * to track the features seen.]
     *
     * Although no current windowing systems (can) do this, this would add
     * the ability to have non-dungeon glyphs float above the last known
     * dungeon glyph (i.e. items on fountains).
     */
    if (!Levitation())
        update_lastseentyp(u.ux, u.uy);

    for (x = 1; x < COLNO; x++) {
        for (y = 0; y < ROWNO; y++) {
            count_feat_lastseentyp(mptr, x, y);
        }
    }

    /* Moloch's Sanctum and the Valley of the Dead are normally given an
       automatic annotation when you enter a temple attended by a priest,
       but it is possible for the priest to be killed prior to that; we
       assume that both of those levels only contain one altar, so add the
       annotation if that altar has been mapped (seen or magic mapping) */
    if (Is_valley(u.uz)) {
        /* don't clear valley if naltar==0; maybe altar got destroyed? */
        if (mptr.feat.naltar > 0)
            mptr.flags.valley = 1;

    /* Sanctum and Gateway-to-Sanctum are mutually exclusive automatic
       annotations but handling that is tricky because they're stored
       with data for different levels */
    } else if (Is_sanctum(u.uz)) {
        if (mptr.feat.naltar > 0)
            mptr.flags.msanctum = 1;

        if (mptr.flags.msanctum) {
            let invocat_lvl = stack_struct(struct_d_level);

            struct_assign(invocat_lvl, u.uz);
            invocat_lvl.dlevel -= 1;
            if ((oth_mptr = find_mapseen(invocat_lvl)) != null)
                oth_mptr.flags.vibrating_square = 0;
        }
    } else if (Invocation_lev(u.uz)) {
        /* annotate vibrating square's level if vibr_sqr 'trap' has been
           found or if that trap is gone (indicating that invocation has
           happened) provided that the sanctum's annotation hasn't been
           added (either hero hasn't descended to that level yet or hasn't
           mapped its temple) */
        for (t = gf.ftrap; t; t = t.ntrap)
            if (t.ttyp == VIBRATING_SQUARE)
                break;
        mptr.flags.vibrating_square = t ? t.tseen
                      /* no trap implies that invocation has been performed */
                             : +((oth_mptr = find_mapseen(svd.dungeon_topology.d_sanctum_level)) == null
                                || !oth_mptr.flags.msanctum);
    }

    if (svl.level.bonesinfo && !mptr.final_resting_place) {
        /* clone the bonesinfo so we aren't dependent upon this
           level being in memory */
        bonesaddr = ref_of(mptr, "final_resting_place");
        bp = svl.level.bonesinfo;
        do {
            bonesaddr[0] = view_of(struct_cemetery, addr_of(alloc(sizeof(struct_cemetery))));
            struct_assign(bonesaddr[0], bp);
            bp = bp.next;
            bonesaddr = ref_of((bonesaddr[0]), "next");
        } while (bp);
        bonesaddr[0] = null;
    }
    /* decide which past hero deaths have become known; there's no
       guarantee of either a grave or a ghost, so we go by whether the
       current hero has seen the map location where each old one died */
    for (bp = mptr.final_resting_place; bp; bp = bp.next)
        if (chars[svl.lastseentyp[bp.frpx] + bp.frpy]) {
            bp.bonesknown = TRUE;
            mptr.flags.knownbones = 1;
        }
    } finally { stack_pop($frame); }
}

/*ARGUSED*/
/* valley and sanctum levels get automatic annotation once their temple
   is entered */
export function mapseen_temple(
    priest) { /* void */ /* not used; might be useful someday */
    let mptr = find_mapseen(u.uz);

    if (!mptr)
        return;
    if (Is_valley(u.uz))
        mptr.flags.valley = 1;
    else if (Is_sanctum(u.uz))
        mptr.flags.msanctum = 1;
}

/* room entry message has just been delivered so learn room even if blind */
export function room_discovered(roomno) { /* void */
    let mptr = find_mapseen(u.uz);

    if (mptr && !mptr.msrooms[roomno].seen) {
        mptr.msrooms[roomno].seen = 1;
        recalc_mapseen();
    }
}

/* #overview command */
export function dooverview() { /* int */
    /* game in progress; 'why' is 0 for normal #overview, -1 if user prefixed
       #overview with 'm'; 'reason' for end of game isn't applicable: use 0 */
    show_overview(iflags.menu_requested ? -1 : 0, 0);
    iflags.menu_requested = FALSE;
    return ECMD_OK;
}

/* called for #overview or for end of game disclosure */
export function show_overview(
    why,

    reason) { /* void */ /* how hero died; used when disclosing end-of-game level */
    const $frame = stack_frame(); try {
    let win;
    let lastdun = stack_var(int, -1);
    let selected = stack_var(ptr_to(struct_mi));
    let n;

    /* lazy initialization */
    recalc_mapseen();

    win = create_nhwindow()(NHW_MENU);
    start_menu()(win, MENU_BEHAVE_STANDARD);
    /* show the endgame levels before the rest of the dungeon,
       so that the Planes (dnum 5-ish) come out above main dungeon (dnum 0) */
    if (In_endgame(u.uz))
        traverse_mapseenchn(1, win, why, reason, lastdun);
    /* if game is over or we're not in the endgame yet, show the dungeon */
    if (why > 0 || !In_endgame(u.uz))
        traverse_mapseenchn(0, win, why, reason, lastdun);
    end_menu()(win, 0);
    n = select_menu(win, (why != -1) ? PICK_NONE : PICK_ONE, selected);
    if (n > 0) {
        let ledger;
        let lev = stack_struct(struct_d_level);

        ledger = ptr_add(selected[0], 0).item.a_int - 1;
        lev.dnum = ledger_to_dnum(ledger);
        lev.dlevel = ledger_to_dlev(ledger);
        query_annotation(lev);
        free(addr_of(selected[0]));
    }
    destroy_nhwindow()(win);
    } finally { stack_pop($frame); }
}

/* display endgame levels or non-endgame levels, not both */
function traverse_mapseenchn(
    viewendgame,
    win,
    why,
    reason,
    lastdun_p) { /* void */ /* where to restart if called twice */
    let mptr;
    let showheader;

    for (mptr = svm.mapseenchn; mptr; mptr = mptr.next) {
        if (viewendgame ^ In_endgame(mptr.lev))
            continue;

        /* only print out info for a level or a dungeon if it's of interest */
        if (why != 0 || interest_mapseen(mptr)) {
            showheader = (+(mptr.lev.dnum != lastdun_p[0]));
            print_mapseen(win, mptr, why, reason, showheader);
            lastdun_p[0] = mptr.lev.dnum;
        }
    }
}

function seen_string(x, obj) { /* const char * */
    /* players are computer scientists: 0, 1, 2, n */
    switch (x) {
    case 0:
        return _("no");
    /* an() returns too much.  index/strchr is ok in this case */
    case 1:
        return strchr(vowels, chars[obj]) ? _("an") : _("a");
    case 2:
        return _("some");
    case 3:
        return _("many");
    }

    return _("(unknown)");
}

/* better br_string */
function br_string2(br) { /* const char * */
    /* Special case: quest portal says closed if kicked from quest */
    let closed_portal = (br.end2.dnum == quest_dnum()
                             && u.uevent.qexpelled ? 1 : 0);

    switch (br.type) {
    case BR_PORTAL:
        return closed_portal ? _("Sealed portal") : _("Portal");
    case BR_NO_END1:
        return _("Connection");
    case BR_NO_END2:
        return br.end1_up ? _("One way stairs up") : _("One way stairs down");
    case BR_STAIR:
        return br.end1_up ? _("Stairs up") : _("Stairs down");
    }

    return _("(unknown)");
}

/* get the name of an endgame level; topten.c does something similar */
export function endgamelevelname(outbuf, indx) { /* const char * */
    let planename = 0;

    chars[outbuf] = ord('\0');
    switch (indx) {
    case -5:
        strcpy(outbuf, _("Astral Plane"));
        break;
    case -4:
        planename = _("Water");
        break;
    case -3:
        planename = _("Fire");
        break;
    case -2:
        planename = _("Air");
        break;
    case -1:
        planename = _("Earth");
        break;
    }
    if (planename)
        sprintf(outbuf, _("Plane of %s"), planename);
    else if (!chars[outbuf])
        sprintf(outbuf, _("unknown plane #%d"), indx);
    return outbuf;
}

/* short shop description */
function shop_string(rtype) { /* const char * */
    const $frame = stack_frame(); try {
     /* defined in shknam.c */
    let shoptype = rtype - SHOPBASE; /* convert room type to shop type */
    let str = _("shop?"); /* catchall */

    if (shoptype < 0) {
        str = _("untended shop");
    } else if (shtypes[shoptype].annotation) {
        str = shtypes[shoptype].annotation;
    } else if (shtypes[shoptype].name) {
        str = shtypes[shoptype].name;
    }
    return str;
    } finally { stack_pop($frame); }
}

/* if player knows about the mastermind tune, append it to Castle annotation;
   if drawbridge has been destroyed, flags.castletune will be zero */
function tunesuffix(
    mptr,
    outbuf,
    bsz) { /* char * */ /* size of outbuf */
    const $frame = stack_frame(); try {
    chars[outbuf] = ord('\0');
    if (mptr.flags.castletune && u.uevent.uheard_tune) {
        let tmp = stack_array(char, BUFSZ);

        if (u.uevent.uheard_tune == 2)
            sprintf(tmp, _("notes \"%s\""), svt.tune);
        else
            strcpy(tmp, _("5-note tune"));
        Snprintf(outbuf, bsz, _(" (play %s to open or close drawbridge)"), tmp);
    }
    return outbuf;
    } finally { stack_pop($frame); }
}

/* some utility macros for print_mapseen */
export const TAB = "   ";

/* K&R: don't require support for concatenation of adjacent string literals */
export const PREFIX = "      ";

/* "iterate" once; safe to use as ``if (cond) ADDTOBUF(); else whatever;'' */

/* ADD2NTOBUF: for "M temples and N altars"; seen_string() is safe to use
   multiple times within one expression; so is plur() */

function print_mapseen(
    win, mptr,
    final,

    how,
    printdun) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, BUFSZ), tmpbuf = stack_array(char, BUFSZ);
    let i, depthstart, dnum;
    let died_here = (final == 2 && on_level(u.uz, mptr.lev) ? 1 : 0);
    let any = stack_struct(struct_any);

    /* Damnable special cases */
    /* The quest and knox should appear to be level 1 to match
     * other text.
     */
    dnum = mptr.lev.dnum;
    if (dnum == quest_dnum() || dnum == knox_level().dnum)
        depthstart = 1;
    else
        depthstart = svd.dungeons[dnum].depth_start;

    if (printdun) {
        if (svd.dungeons[dnum].dunlev_ureached == svd.dungeons[dnum].entry_lev
            /* suppress the negative numbers in the endgame */
            || In_endgame(mptr.lev))
            sprintf(buf, _("%s:"), svd.dungeons[dnum].dname);
        else if (builds_up(mptr.lev))
            sprintf(buf, _("%s: levels %d up to %d"), svd.dungeons[dnum].dname, depthstart + svd.dungeons[dnum].entry_lev - 1, depthstart + svd.dungeons[dnum].dunlev_ureached - 1);
        else
            sprintf(buf, _("%s: levels %d to %d"), svd.dungeons[dnum].dname, depthstart, depthstart + svd.dungeons[dnum].dunlev_ureached - 1)

;

        add_menu_heading(win, buf);
    }

    /* calculate level number */
    i = depthstart + mptr.lev.dlevel - 1;
    if (In_endgame(mptr.lev))
        sprintf(buf, _("%s%s:"), (final != -1) ? _(TAB) : _(""), endgamelevelname(tmpbuf, i));
    else
        sprintf(buf, _("%sLevel %d:"), (final != -1) ? _(TAB) : _(""), i)
;

    /* wizmode prints out proto dungeon names for clarity */
    if (wizard()) {
        let slev;

        if ((slev = Is_special(mptr.lev)) != null)
            sprintf(eos(buf), _(" [%s]"), slev.proto);
    }
    /* [perhaps print custom annotation on its own line when it's long] */
    if (mptr.custom)
        sprintf(eos(buf), _(" \"%s\""), mptr.custom);
    if (on_level(u.uz, mptr.lev))
        sprintf(eos(buf), _(" <- You %s here."), (final <= 0 || (final == 1 && how == ASCENDED)) ? _("are")
                  : (final == 1 && how == ESCAPED) ? _("left from")
                    : _("were"))
;

    struct_assign(any, cg.zeroany);
    if (final == -1)
        any.a_int = ledger_no(mptr.lev) + 1;
    add_menu(win, nul_glyphinfo, any, 0, 0, ATR_NONE, NO_COLOR,
             buf, MENU_ITEMFLAGS_NONE);

    if (mptr.flags.forgot)
        return;

    if (OF_INTEREST(mptr.feat)) {
        chars[buf + 0] = 0;

        i = 0; /* interest counter */
        /* List interests in an order vaguely corresponding to
         * how important they are.
         */
        if (mptr.feat.nshop > 0) {
            if (mptr.feat.nshop > 1)
                do { if (mptr.feat.nshop) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.nshop), _(("shop"))), _(("shop")), plur(mptr.feat.nshop)); } while (0);
            else
                sprintf(eos(buf), _("%s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), an(shop_string(mptr.feat.shoptype)))
;
        }
        if (mptr.feat.naltar > 0 || mptr.feat.ntemple > 0) {
            let atmp;

            /* being aware of a temple doesn't guarantee being aware of its
               altar (via entrance message when entering while blinded, or
               possibly it being out of view in an irregularly shaped room);
               FIXME: if all temples present have been desecrated, we ought
               to say so */
            do { if ((mptr.feat.ntemple && mptr.feat.naltar)) { sprintf(eos(buf), _("%s%s %s%s and %s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.ntemple), _(("temple"))), _(("temple")), plur(mptr.feat.ntemple), seen_string((mptr.feat.naltar), _(("altar"))), _(("altar")), plur(mptr.feat.naltar)); } else if (mptr.feat.ntemple) { do { if (mptr.feat.ntemple) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.ntemple), _(("temple"))), _(("temple")), plur(mptr.feat.ntemple)); } while (0) } else if (mptr.feat.naltar) { do { if (mptr.feat.naltar) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.naltar), _(("altar"))), _(("altar")), plur(mptr.feat.naltar)); } while (0) } } while (0)
;

            /* only print out altar's god if they are all to your god */
            atmp = mptr.feat.msalign;              /*    0,  1,  2,  3 */
            atmp = Msa2amask(atmp);                 /*    0,  1,  2,  4 */
            if (Amask2align(atmp) == u.ualign.type) /* -128, -1,  0, +1 */
                sprintf(eos(buf), _(" to %s"), align_gname(u.ualign.type));
        }
        do { if (mptr.feat.nthrone) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.nthrone), _(("throne"))), _(("throne")), plur(mptr.feat.nthrone)); } while (0);
        do { if (mptr.feat.nfount) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.nfount), _(("fountain"))), _(("fountain")), plur(mptr.feat.nfount)); } while (0);
        do { if (mptr.feat.nsink) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.nsink), _(("sink"))), _(("sink")), plur(mptr.feat.nsink)); } while (0);
        do { if (mptr.feat.ngrave) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.ngrave), _(("grave"))), _(("grave")), plur(mptr.feat.ngrave)); } while (0);
        do { if (mptr.feat.ntree) sprintf(eos(buf), _("%s%s %s%s"), ((i++ > 0) ? _(", ") : _(PREFIX)), seen_string((mptr.feat.ntree), _(("tree"))), _(("tree")), plur(mptr.feat.ntree)); } while (0);

        /* capitalize afterwards */
        i = strlen(_(PREFIX));
        chars[buf + i] = highc(chars[buf + i]);
        /* capitalizing it makes it a sentence; terminate with '.' */
        strcat(buf, _("."));
        add_menu_str(win, buf);
    }

    /* we assume that these are mutually exclusive */
    chars[buf] = ord('\0');
    if (mptr.flags.oracle) {
        sprintf(buf, _("%sOracle of Delphi."), _(PREFIX));
    } else if (In_sokoban(mptr.lev)) {
        sprintf(buf, _("%s%s."), _(PREFIX), mptr.flags.sokosolved ? _("Solved") : _("Unsolved"))
;
    } else if (mptr.flags.bigroom) {
        sprintf(buf, _("%sA very big room."), _(PREFIX));
    } else if (mptr.flags.roguelevel) {
        sprintf(buf, _("%sA primitive area."), _(PREFIX));
    } else if (on_level(mptr.lev, svd.dungeon_topology.d_qstart_level)) {
        sprintf(buf, _("%sHome%s."), _(PREFIX), mptr.flags.notreachable ? _(" (no way back...)") : _(""))
;
        if (u.uevent.qcompleted)
            sprintf(buf, _("%sCompleted quest for %s."), _(PREFIX), ldrname());
        else if (mptr.flags.questing)
            sprintf(buf, _("%sGiven quest by %s."), _(PREFIX), ldrname());
    } else if (mptr.flags.ludios) {
        /* presence of the ludios branch in #overview output indicates that
           the player has made it onto the level; presence of this annotation
           indicates that the fort's entrance has been seen (or mapped) */
        sprintf(buf, _("%sFort Ludios."), _(PREFIX));
    } else if (mptr.flags.castle) {
        Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%sThe castle%s."), _(PREFIX), tunesuffix(mptr, tmpbuf, sizeof(array_of(char, BUFSZ))))
;
    } else if (mptr.flags.valley) {
        sprintf(buf, _("%sValley of the Dead."), _(PREFIX));
    } else if (mptr.flags.vibrating_square) {
        sprintf(buf, _("%sGateway to Moloch's Sanctum."), _(PREFIX));
    } else if (mptr.flags.msanctum) {
        sprintf(buf, _("%sMoloch's Sanctum."), _(PREFIX));
    }
    if (chars[buf]) {
        add_menu_str(win, buf);
    }
    /* quest entrance is not mutually-exclusive with bigroom or rogue level */
    if (mptr.flags.quest_summons) {
        sprintf(buf, _("%sSummoned by %s."), _(PREFIX), ldrname());
        add_menu_str(win, buf);
    }

    /* print out branches */
    if (mptr.br) {
        sprintf(buf, _("%s%s to %s"), _(PREFIX), br_string2(mptr.br), svd.dungeons[mptr.br.end2.dnum].dname)
;

        /* Since mapseen objects are printed out in increasing order
         * of dlevel, clarify which level this branch is going to
         * if the branch goes upwards.  Unless it's the end game.
         */
        if (mptr.br.end1_up && !In_endgame(mptr.br.end2))
            sprintf(eos(buf), _(", level %d"), depth(mptr.br.end2));
        strcat(buf, _("."));
        add_menu_str(win, buf);
    }

    /* maybe print out bones details */
    if (mptr.final_resting_place || final > 0) {
        let bp;
        let kncnt = !died_here ? 0 : 1;

        for (bp = mptr.final_resting_place; bp; bp = bp.next)
            if (bp.bonesknown || wizard() || final > 0)
                ++kncnt;
        if (kncnt) {
            sprintf(buf, _("%s%s"), _(PREFIX), _("Final resting place for"));
            add_menu_str(win, buf);
            if (died_here) {
                /* disclosure occurs before bones creation, so listing dead
                   hero here doesn't give away whether bones are produced */
                formatkiller(tmpbuf, sizeof(array_of(char, BUFSZ)), how, TRUE);
                /* rephrase a few death reasons to work with "you" */
                strsubst(tmpbuf, _(" himself"), _(" yourself"));
                strsubst(tmpbuf, _(" herself"), _(" yourself"));
                strsubst(tmpbuf, _(" his "), _(" your "));
                strsubst(tmpbuf, _(" her "), _(" your "));
                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s%syou, %s%c"), _(PREFIX), _(TAB), tmpbuf, --kncnt ? ord(',') : ord('.'))
;
                add_menu_str(win, buf);
            }
            for (bp = mptr.final_resting_place; bp; bp = bp.next) {
                if (bp.bonesknown || wizard() || final > 0) {
                    sprintf(buf, _("%s%s%s, %s%c"), _(PREFIX), _(TAB), bp.who, bp.how, --kncnt ? ord(',') : ord('.'))
;
                    add_menu_str(win, buf);
                }
            }
        }
    }
    } finally { stack_pop($frame); }
}

/*dungeon.c*/

import { MSA_NONE } from "./align.h.js";
import { Align2amask, Amask2align, Amask2msa, Msa2amask } from "./align.h.macros.js";
import { NO_COLOR } from "./color.h.js";
import {
    BRANCH_LIMIT, D_ALIGN_CHAOTIC, D_ALIGN_LAWFUL, D_ALIGN_MASK, D_ALIGN_NEUTRAL, D_ALIGN_NONE,
    HELLISH, LEV_LIMIT, MAZELIKE, ROGUELIKE, TBR_NO_DOWN, TBR_NO_UP, TBR_PORTAL, TBR_STAIR, TOWN,
    UNCONNECTED,
} from "./dgn_file.h.js";
import {
    BR_NO_END1, BR_NO_END2, BR_PORTAL, BR_STAIR, LR_DOWNTELE, LR_UPTELE, VISITED, struct_branch,
    struct_d_level, struct_exclusion_zone, struct_mapseen, struct_mapseen_feat, struct_s_level,
} from "./dungeon.h.js";
import {
    In_endgame, In_sokoban, In_tutorial, Is_airlevel, Is_astralevel, Is_bigroom, Is_earthlevel,
    Is_firelevel, Is_knox, Is_qstart, Is_rogue_level, Is_sanctum, Is_stronghold, Is_valley,
    Is_waterlevel, Is_wiz1_level, Is_wiz2_level, Is_wiz3_level, Lassigned, within_bounded_area,
} from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, MAXDUNGEON, MAXLEVEL, MAXNROFROOMS, NHL_SB_SAFE, QBUFSZ, ROWNO, TRUE,
    struct_nhl_sandbox_info, xint16,
} from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import { ASCENDED, ECMD_OK, ESCAPED, FOOT, MAXLINFO } from "./hack.h.js";
import {
    astral_level, knox_level, medusa_level, mines_dnum, panic1, plur, quest_dnum, rn1, tower_dnum,
    update_file, valley_level,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    debugpline1, debugpline2, debugpline4, explicitdebug, showdebug,
} from "./lint.h.macros.js";
import { LUA_TNIL, LUA_TSTRING, LUA_TTABLE } from "./lua.h.js";
import { lua_istable, lua_pop, lua_tointeger } from "./lua.h.macros.js";
import { DELPHI, ROOMOFFSET, SHOPBASE, TEMPLE, VAULT } from "./mkroom.h.js";
import { digests, enfolds, is_animal } from "./mondata.h.macros.js";
import { M_AP_FURNITURE } from "./monst.h.js";
import { M_AP_TYPE } from "./monst.h.macros.js";
import { PM_DWARF } from "./monsters.h.js";
import { NHJS_SIZEOF_mapseen, NHJS_SIZEOF_struct_cemetery } from "./nhjs_struct_sizes.h.js";
import {
    ALTAR, CLOUD, CORR, DBWALL, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, FOUNTAIN, GRAVE, MAX_TYPE,
    ROOM, SDOOR, SINK, SVALL, THRONE, TREE, struct_cemetery,
} from "./rm.h.js";
import {
    IS_AIR, IS_ALTAR, IS_DOOR, IS_FOUNTAIN, IS_GRAVE, IS_ROOM, IS_THRONE, IS_WALL, SURFACE_AT,
    Sokoban, levl, m_at,
} from "./rm.h.macros.js";
import {
    Sfi_branch, Sfi_char, Sfi_coordxy, Sfi_d_level, Sfi_dgn_topology, Sfi_dungeon, Sfi_linfo,
    Sfi_mapseen_feat, Sfi_mapseen_flags, Sfi_mapseen_rooms, Sfi_nhcoord, Sfo_branch, Sfo_char,
    Sfo_coordxy, Sfo_d_level, Sfo_dgn_topology, Sfo_dungeon, Sfo_int, Sfo_linfo, Sfo_mapseen_feat,
    Sfo_mapseen_flags, Sfo_mapseen_rooms, Sfo_nhcoord, Sfo_unsigned, Sfo_xint16,
} from "./savefile.h.macros.js";
import { MAGIC_PORTAL, VIBRATING_SQUARE } from "./trap.h.js";
import {
    clear_nhwindow, cliparound, create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu,
    putstr, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, PICK_NONE, PICK_ONE, struct_any,
    struct_mi,
} from "./wintype.h.js";
import { Race_if, Upolyd, u_at } from "./you.h.macros.js";
import {
    Blind, EAggravate_monster, Flying, Hallucination, Levitation, Underwater,
} from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, short, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import {
    fprintf, free, getchar, memset, sprintf, stderr, strcat, strchr, strcmp, strcpy, strlen,
    strncmp,
} from "../rt/libc.js";
import {
    init_list, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import {
    luaL_checkoption, lua_getfield, lua_getglobal, lua_gettable, lua_gettop, lua_len, lua_next,
    lua_pushinteger, lua_pushnil, lua_settop, lua_type,
} from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, ptr_add, ptr_diff, ptr_to, ref_of, sizeof_member, struct, struct_assign,
    view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { describe_level } from "./botl.js";
import { isok } from "./cmd.js";
import { db_under_typ, is_drawbridge_wall, is_ice, is_lava, is_pool } from "./dbridge.js";
import {
    cg, emptystr, gf, gu, iflags, svb, svd, sve, svi, svl, svm, svn, svq, svr, svs, svt, svu, u,
    vowels,
} from "./decl.js";
import { canseemon, map_location, nul_glyphinfo, see_nearby_objects } from "./display.js";
import { goto_level } from "./do.js";
import { hliquid } from "./do_name.js";
import { done, panic } from "./end.js";
import { in_rooms, switch_terrain } from "./hack.js";
import { eos, highc, mungspaces, strncmpi, strstri, strsubst, trimspaces } from "./hacklib.js";
import { place_lregion } from "./mkmaze.js";
import { cmap_to_type } from "./mkroom.js";
import {
    get_table_int, get_table_int_opt, get_table_option, get_table_str, get_table_str_opt, nhl_done,
    nhl_init, nhl_loadlua,
} from "./nhlua.js";
import { an, makeplural } from "./objnam.js";
import { You, impossible, pline } from "./pline.js";
import { body_part } from "./polyself.js";
import { align_gname, altarmask_at } from "./pray.js";
import { findpriest, inhistemple } from "./priest.js";
import { ldrname } from "./questpgr.js";
import { restcemetery } from "./restore.js";
import { rn2, rnd } from "./rnd.js";
import { savecemetery } from "./save.js";
import { sfi_int, sfi_unsigned, sfi_xint16 } from "./sfbase.js";
import { inhishop, shop_keeper } from "./shk.js";
import { shtypes } from "./shknam.js";
import { On_stairs, stairway_at, stairway_find_special_dir } from "./stairs.js";
import { formatkiller } from "./topten.js";
import { add_menu, add_menu_heading, add_menu_str, getlin, select_menu } from "./windows.js";
const __FILE__ = "dungeon.c";
