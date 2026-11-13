/* NetHack 5.0	mkroom.c	$NHDT-Date: 1613086701 2021/02/11 23:38:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.52 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2011. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Entry points:
 *      do_mkroom() -- make and stock a room of a given type
 *      nexttodoor() -- return TRUE if adjacent to a door
 *      has_dnstairs() -- return TRUE if given room has a down staircase
 *      has_upstairs() -- return TRUE if given room has an up staircase
 *      courtmon() -- generate a court monster
 *      save_rooms() -- save rooms into file fd
 *      rest_rooms() -- restore rooms from file fd
 *      cmap_to_type() -- convert S_xxx symbol to XXX topology code
 */

export function sq(x) { return (x * x); }

 /* defined in shknam.c */

function isbig(sroom) { /* boolean */
    let area = (sroom.hx - sroom.lx + 1)
                        * (sroom.hy - sroom.ly + 1);

    return (+(area > 20));
}

/* make and stock a room of a given type */
export function do_mkroom(roomtype) { /* void */
    if (roomtype >= SHOPBASE) {
        mkshop(); /* someday, we should be able to specify shop type */
    } else {
        switch (roomtype) {
        case COURT:
            mkzoo(COURT);
            break;
        case ZOO:
            mkzoo(ZOO);
            break;
        case BEEHIVE:
            mkzoo(BEEHIVE);
            break;
        case MORGUE:
            mkzoo(MORGUE);
            break;
        case BARRACKS:
            mkzoo(BARRACKS);
            break;
        case SWAMP:
            mkswamp();
            break;
        case TEMPLE:
            mktemple();
            break;
        case LEPREHALL:
            mkzoo(LEPREHALL);
            break;
        case COCKNEST:
            mkzoo(COCKNEST);
            break;
        case ANTHOLE:
            mkzoo(ANTHOLE);
            break;
        default:
            impossible(_("Tried to make a room of type %d."), roomtype);
        }
    }
}

function mkshop() { /* void */
    var sroom;
    var i = -1;
    var ep = 0; /* (init == lint suppression) */

    /* first determine shoptype */
    gottype: { if (wizard()) {
        ep = nh_getenv(_("SHOPTYPE"));
        if (ep) {
            if (chars[ep] == ord('z') || chars[ep] == ord('Z')) {
                mkzoo(ZOO);
                return;
            }
            if (chars[ep] == ord('m') || chars[ep] == ord('M')) {
                mkzoo(MORGUE);
                return;
            }
            if (chars[ep] == ord('b') || chars[ep] == ord('B')) {
                mkzoo(BEEHIVE);
                return;
            }
            if (chars[ep] == ord('t') || chars[ep] == ord('T') || chars[ep] == ord('\\')) {
                mkzoo(COURT);
                return;
            }
            if (chars[ep] == ord('s') || chars[ep] == ord('S')) {
                mkzoo(BARRACKS);
                return;
            }
            if (chars[ep] == ord('a') || chars[ep] == ord('A')) {
                mkzoo(ANTHOLE);
                return;
            }
            if (chars[ep] == ord('c') || chars[ep] == ord('C')) {
                mkzoo(COCKNEST);
                return;
            }
            if (chars[ep] == ord('l') || chars[ep] == ord('L')) {
                mkzoo(LEPREHALL);
                return;
            }
            if (chars[ep] == ord('_')) {
                mktemple();
                return;
            }
            if (chars[ep] == ord('}')) {
                mkswamp();
                return;
            }
            for (i = 0; shtypes[i].name; i++)
                if (chars[ep] == def_oc_syms[(shtypes[i].symb)].sym)
                    break gottype;;
            if (chars[ep] == ord('g') || chars[ep] == ord('G'))
                i = 0;
            else if (chars[ep] == ord('v') || chars[ep] == ord('V'))
                i = FODDERSHOP - SHOPBASE; /* veggy food */
            else
                i = -1;
        }
    }
 }
    for (sroom = ptr_add(svr.rooms[0], 0);; sroom = ptr_add(sroom, 1)) {
        /* return from this loop: cannot find any eligible room to be a shop
         * continue: sroom is ineligible
         * break: sroom is eligible
         */
        if (sroom.hx < 0)
            return;
        if (ptr_diff(sroom, svr.rooms[0]) >= svn.nroom) {
            impossible(_("rooms[] not closed by -1?"));
            return;
        }
        if (sroom.rtype != OROOM)
            continue;
        if (has_dnstairs(sroom) || has_upstairs(sroom))
            continue;
        if (sroom.doorct == 1 || (wizard() && ep && sroom.doorct != 0)) {
            if (invalid_shop_shape(sroom))
                continue;
            else
                break;
        }
    }
    if (!sroom.rlit) {
        var x, y;

        for (x = sroom.lx - 1; x <= sroom.hx + 1; x++)
            for (y = sroom.ly - 1; y <= sroom.hy + 1; y++)
                levl()[x][y].lit = 1;
        sroom.rlit = 1;
    }

    if (i < 0) { /* shoptype not yet determined */
        var j;

        /* pick a shop type at random */
        for (j = rnd(100), i = 0; (j -= shtypes[i].prob) > 0; i++)
            continue;

        /* big rooms cannot be wand or book shops,
         * - so make them general stores
         */
        if (isbig(sroom) && (shtypes[i].symb == WAND_CLASS
                             || shtypes[i].symb == SPBOOK_CLASS))
            i = 0;
    }
    sroom.rtype = SHOPBASE + i;

    /* set room bits before stocking the shop */

    topologize(sroom);

    /* The shop used to be stocked here, but this no longer happens--all we do
       is set its rtype, and it gets stocked at the end of makelevel() along
       with other special rooms. */
    sroom.needfill = FILL_NORMAL;
}

/* pick an unused room, preferably with only one door */
function pick_room(strict) { /* struct mkroom * */
    let sroom;
    let i = svn.nroom;

    for (sroom = ptr_add(svr.rooms[0], rn2(svn.nroom)); i--; sroom = ptr_add(sroom, 1)) {
        if (sroom == svr.rooms[svn.nroom])
            sroom = ptr_add(svr.rooms[0], 0);
        if (sroom.hx < 0)
            return null;
        if (sroom.rtype != OROOM)
            continue;
        if (!strict) {
            if (has_upstairs(sroom) || (has_dnstairs(sroom) && rn2(3)))
                continue;
        } else if (has_upstairs(sroom) || has_dnstairs(sroom))
            continue;
        if (sroom.doorct == 1 || !rn2(5) || wizard())
            return sroom;
    }
    return null;
}

function mkzoo(type) { /* void */
    let sroom;

    if ((sroom = pick_room(FALSE)) != null) {
        sroom.rtype = type;
        /* room does not get stocked at this time - it will get stocked at the
         * end of makelevel() */
        sroom.needfill = FILL_NORMAL;
    }
}

function mk_zoo_thronemon(x, y) { /* void */
    let i = rnd(level_difficulty());
    let pm = (i > 9) ? PM_OGRE_TYRANT
        : (i > 5) ? PM_ELVEN_MONARCH
        : (i > 2) ? PM_DWARF_RULER
        : PM_GNOME_RULER;
    let mon = makemon(mons[pm], x, y, NO_MM_FLAGS);

    if (mon) {
        mon.msleeping = 1;
        mon.mpeaceful = 0;
        set_malign(mon);
        /* Give him a sceptre to pound in judgment */
        mongets(mon, MACE);
    }
}

export function fill_zoo(sroom) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var mm = stack_struct(struct_nhcoord);
    var mon;
    var sx, sy, i;
    var sh, goldlim = 0, type = sroom.rtype;
    var tx = 0, ty = 0;
    var rmno = int((ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET));

    /* Note: This doesn't check needfill; it assumes the caller has already
       done that. */
    sh = sroom.fdoor;
    $goto_throne_placed: for (;;) { switch ($goto || (type)) {
    case COURT:
        if (svl.level.flags.is_maze_lev) {
            for (tx = sroom.lx; tx <= sroom.hx; tx++)
                for (ty = sroom.ly; ty <= sroom.hy; ty++)
                    if (IS_THRONE(levl()[tx][ty].typ))
                        { $goto = "throne_placed"; continue $goto_throne_placed; };
        }
        i = 100;
        do { /* don't place throne on top of stairs */
            somexyspace(sroom, mm);
            tx = mm.x;
            ty = mm.y;
        } while (occupied(tx, ty) && --i > 0);
 case "throne_placed": $goto = null;
        mk_zoo_thronemon(tx, ty);
        break;
    case BEEHIVE:
        tx = sroom.lx + Math.trunc((sroom.hx - sroom.lx + 1) / 2);
        ty = sroom.ly + Math.trunc((sroom.hy - sroom.ly + 1) / 2);
        if (sroom.irregular) {
            /* center might not be valid, so put queen elsewhere */
            if ((levl()[tx][ty].roomno) != rmno || levl()[tx][ty].edge) {
                somexyspace(sroom, mm);
                tx = mm.x;
                ty = mm.y;
            }
        }
        break;
    case ZOO:
    case LEPREHALL:
        goldlim = 500 * level_difficulty();
        break;
    } break; }

    for (sx = sroom.lx; sx <= sroom.hx; sx++)
        for (sy = sroom.ly; sy <= sroom.hy; sy++) {
            if (sroom.irregular) {
                if ((levl()[sx][sy].roomno) != rmno || levl()[sx][sy].edge
                    || (sroom.doorct
                        && (distmin(sx, sy, ptr_add(svd.doors, sh).x, ptr_add(svd.doors, sh).y)
                            <= 1)))
                    continue;
            } else if (!SPACE_POS(levl()[sx][sy].typ)
                       || (sroom.doorct
                           && ((sx == sroom.lx && ptr_add(svd.doors, sh).x == sx - 1)
                               || (sx == sroom.hx && ptr_add(svd.doors, sh).x
                                   == sx + 1)
                               || (sy == sroom.ly && ptr_add(svd.doors, sh).y
                                   == sy - 1)
                               || (sy == sroom.hy
                                   && ptr_add(svd.doors, sh).y == sy + 1))))
                continue;
            /* don't place monster on explicitly placed throne */
            if (type == COURT && IS_THRONE(levl()[sx][sy].typ))
                continue;
            mon = makemon((type == COURT)
                           ? courtmon()
                           : (type == BARRACKS)
                              ? squadmon()
                              : (type == MORGUE)
                                 ? morguemon()
                                 : (type == BEEHIVE)
                                     ? (sx == tx && sy == ty
                                         ? mons[PM_QUEEN_BEE]
                                         : mons[PM_KILLER_BEE])
                                     : (type == LEPREHALL)
                                         ? mons[PM_LEPRECHAUN]
                                         : (type == COCKNEST)
                                             ? mons[PM_COCKATRICE]
                                             : (type == ANTHOLE)
                                                 ? antholemon()
                                                 : null,
                          sx, sy, MM_ASLEEP | MM_NOGRP);
            if (mon) {
                mon.msleeping = 1;
                if (type == COURT && mon.mpeaceful) {
                    mon.mpeaceful = 0;
                    set_malign(mon);
                }
            }
            switch (type) {
            case ZOO:
            case LEPREHALL:
                if (sroom.doorct) {
                    var distval = dist2(sx, sy,
                                        ptr_add(svd.doors, sh).x, ptr_add(svd.doors, sh).y);
                    i = sq(distval);
                } else
                    i = goldlim;
                if (i >= goldlim)
                    i = 5 * level_difficulty();
                goldlim -= i;
                mkgold(rn1(i, 10), sx, sy);
                break;
            case MORGUE:
                if (!rn2(5))
                    mk_tt_object(CORPSE, sx, sy);
                if (!rn2(10)) /* lots of treasure buried with dead */
                    mksobj_at(rn2(3) ? LARGE_BOX : CHEST, sx, sy,
                                     TRUE, FALSE);
                if (!rn2(5))
                    make_grave(sx, sy, 0);
                break;
            case BEEHIVE:
                if (!rn2(3))
                    mksobj_at(LUMP_OF_ROYAL_JELLY, sx, sy, TRUE,
                                     FALSE);
                break;
            case BARRACKS:
                if (!rn2(20)) /* the payroll and some loot */
                    mksobj_at(rn2(3) ? LARGE_BOX : CHEST, sx, sy,
                                     TRUE, FALSE);
                break;
            case COCKNEST:
                if (!rn2(3)) {
                    var sobj = mk_tt_object(STATUE, sx, sy);

                    if (sobj) {
                        for (i = rn2(5); i; i--)
                            add_to_container(
                                sobj, mkobj(RANDOM_CLASS, FALSE));
                        sobj.owt = unsigned(weight(sobj));
                    }
                }
                break;
            case ANTHOLE:
                if (!rn2(3))
                    mkobj_at(FOOD_CLASS, sx, sy, FALSE);
                break;
            }
        }
    switch (type) {
    case COURT: {
        var chest, gold;
        levl()[tx][ty].typ = THRONE;
        somexyspace(sroom, mm);
        gold = mksobj(GOLD_PIECE, TRUE, FALSE);
        gold.quan = (rn2(50 * level_difficulty()) + (10));
        gold.owt = unsigned(weight(gold));
        /* the royal coffers */
        chest = mksobj_at(CHEST, mm.x, mm.y, TRUE, FALSE);
        add_to_container(chest, gold);
        chest.owt = unsigned(weight(chest));
        chest.spe = 2; /* so it can be found later */
        svl.level.flags.has_court = 1;
        break;
    }
    case BARRACKS:
        svl.level.flags.has_barracks = 1;
        break;
    case ZOO:
        svl.level.flags.has_zoo = 1;
        break;
    case MORGUE:
        svl.level.flags.has_morgue = 1;
        break;
    case SWAMP:
        svl.level.flags.has_swamp = 1;
        break;
    case BEEHIVE:
        svl.level.flags.has_beehive = 1;
        break;
    }
    } finally { stack_pop($frame); }
}

/* make a swarm of undead around mm */
export function mkundead(
    mm,
    revive_corpses,
    mm_flags) { /* void */
    const $frame = stack_frame(); try {
    let cnt = Math.trunc((level_difficulty() + 1) / 10) + rnd(5);
    let mdat;
    let otmp;
    let cc = stack_struct(struct_nhcoord);

    while (cnt--) {
        mdat = morguemon();
        if (mdat && enexto(cc, mm.x, mm.y, mdat)
            && (!revive_corpses
                || !(otmp = sobj_at(CORPSE, cc.x, cc.y))
                || !revive(otmp, FALSE)))
            makemon(mdat, cc.x, cc.y, unsigned(mm_flags));
    }
    svl.level.flags.graveyard = TRUE; /* reduced chance for undead corpse */
    } finally { stack_pop($frame); }
}

function morguemon() { /* struct permonst * */
    let i = rn2(100), hd = rn2(level_difficulty());

    if (hd > 10 && i < 10) {
        if (Inhell() || In_endgame(u.uz)) {
            return mkclass(S_DEMON, 0);
        } else {
            let ndemon_res = ndemon(A_NONE);
            if (ndemon_res != NON_PM)
                return mons[ndemon_res];
            /* else do what? As is, it will drop to ghost/wraith/zombie */
        }
    }

    if (hd > 8 && i > 85)
        return mkclass(S_VAMPIRE, 0);

    return ((i < 20) ? mons[PM_GHOST]
                     : (i < 40) ? mons[PM_WRAITH]
                                : mkclass(S_ZOMBIE, 0));
}

export function antholemon() { /* struct permonst * */
    let mtyp, indx, trycnt = 0;

    /* casts are for dealing with time_t */
    indx = (ubirthday % 3);
    indx += level_difficulty();
    /* Same monsters within a level, different ones between levels */
    do {
        switch ((indx + trycnt) % 3) {
        case 0:
            mtyp = PM_SOLDIER_ANT;
            break;
        case 1:
            mtyp = PM_FIRE_ANT;
            break;
        default:
            mtyp = PM_GIANT_ANT;
            break;
        }
        /* try again if chosen type has been genocided or used up */
    } while (++trycnt < 3 && (svm.mvitals[mtyp].mvflags & G_GONE));

    return ((svm.mvitals[mtyp].mvflags & G_GONE) ? null
                                             : mons[mtyp]);
}

function mkswamp() { /* void */ /* Michiel Huisjes & Fred de Wilde */
    let sroom;
    let i, eelct = 0;
    let sx, sy;
    let rmno;

    for (i = 0; i < 5; i++) { /* turn up to 5 rooms swampy */
        sroom = svr.rooms[rn2(svn.nroom)];
        if (sroom.hx < 0 || sroom.rtype != OROOM || has_upstairs(sroom)
            || has_dnstairs(sroom))
            continue;

        rmno = ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET;

        /* satisfied; make a swamp */
        sroom.rtype = SWAMP;
        for (sx = sroom.lx; sx <= sroom.hx; sx++)
            for (sy = sroom.ly; sy <= sroom.hy; sy++) {
                if (!IS_ROOM(levl()[sx][sy].typ)
                    || (levl()[sx][sy].roomno) != rmno)
                    continue;
                if (!OBJ_AT(sx, sy) && !MON_AT(sx, sy) && !t_at(sx, sy)
                    && !nexttodoor(sx, sy)) {
                    if ((sx + sy) % 2) {
                        del_engr_at(sx, sy);
                        levl()[sx][sy].typ = POOL;
                        if (!eelct || !rn2(4)) {
                            /* mkclass() won't do, as we might get kraken */
                            makemon(rn2(5)
                                              ? mons[PM_GIANT_EEL]
                                              : rn2(2)
                                                 ? mons[PM_PIRANHA]
                                                 : mons[PM_ELECTRIC_EEL],
                                           sx, sy, NO_MM_FLAGS);
                            eelct++;
                        }
                    } else if (!rn2(4)) /* swamps tend to be moldy */
                        makemon(mkclass(S_FUNGUS, 0), sx, sy,
                                       NO_MM_FLAGS);
                }
            }
        svl.level.flags.has_swamp = 1;
    }
}

function shrine_pos(roomno) { /* coord * */
    let buf = static_struct("shrine_pos.buf", struct_nhcoord);
    let delta;
    let troom = elt(svr.rooms, roomno - ROOMOFFSET);

    /* if width and height are odd, placement will be the exact center;
       if either or both are even, center point is a hypothetical spot
       between map locations and placement will be adjacent to that */
    delta = troom.hx - troom.lx;
    buf.x = troom.lx + Math.trunc(delta / 2);
    if ((delta % 2) && rn2(2))
        buf.x++;
    delta = troom.hy - troom.ly;
    buf.y = troom.ly + Math.trunc(delta / 2);
    if ((delta % 2) && rn2(2))
        buf.y++;
    return buf;
}

function mktemple() { /* void */
    let sroom;
    let shrine_spot;
    let lev;

    if (!(sroom = pick_room(TRUE)))
        return;

    /* set up Priest and shrine */
    sroom.rtype = TEMPLE;
    /*
     * In temples, shrines are blessed altars
     * located in the center of the room
     */
    shrine_spot = shrine_pos(int((ptr_diff(sroom, svr.rooms[0]) + ROOMOFFSET)));
    lev = levl()[shrine_spot.x][shrine_spot.y];
    lev.typ = ALTAR;
    lev.flags = induced_align(80);
    priestini(u.uz, sroom, shrine_spot.x, shrine_spot.y, FALSE);
    lev.flags |= AM_SHRINE;
    svl.level.flags.has_temple = 1;
}

export function nexttodoor(sx, sy) { /* boolean */
    let dx, dy;
    let lev;

    for (dx = -1; dx <= 1; dx++)
        for (dy = -1; dy <= 1; dy++) {
            if (!isok(sx + dx, sy + dy))
                continue;
            lev = levl()[sx + dx][sy + dy];
            if (IS_DOOR(lev.typ) || lev.typ == SDOOR)
                return TRUE;
        }
    return FALSE;
}

export function has_dnstairs(sroom) { /* boolean */
    let stway = gs.stairs;

    while (stway) {
        if (!stway.up && inside_room(sroom, stway.sx, stway.sy))
            return TRUE;
        stway = stway.next;
    }
    return FALSE;
}

export function has_upstairs(sroom) { /* boolean */
    let stway = gs.stairs;

    while (stway) {
        if (stway.up && inside_room(sroom, stway.sx, stway.sy))
            return TRUE;
        stway = stway.next;
    }
    return FALSE;
}

export function somex(croom) { /* int */
    return rn1(croom.hx - croom.lx + 1, croom.lx);
}

export function somey(croom) { /* int */
    return rn1(croom.hy - croom.ly + 1, croom.ly);
}

export function inside_room(croom, x, y) { /* boolean */
    if (croom.irregular) {
        let i = int((ptr_diff(croom, svr.rooms[0]) + ROOMOFFSET));
        return +(!levl()[x][y].edge && (levl()[x][y].roomno) == i);
    }

    return (+(x >= croom.lx - 1 && x <= croom.hx + 1
                      && y >= croom.ly - 1 && y <= croom.hy + 1));
}

/* return a coord c inside mkroom croom, but not in a subroom.
   returns TRUE if any such space found.
   can return a non-accessible location, eg. inside a wall
   if a themed room is not irregular, but has some non-room terrain */
export function somexy(croom, c) { /* boolean */
    var try_cnt = 0;
    var i;

    if (croom.irregular) {
        i = int((ptr_diff(croom, svr.rooms[0]) + ROOMOFFSET));

        while (try_cnt++ < 100) {
            c.x = somex(croom);
            c.y = somey(croom);
            if (!levl()[c.x][c.y].edge && (levl()[c.x][c.y].roomno) == i)
                return TRUE;
        }
        /* try harder; exhaustively search until one is found */
        for (c.x = croom.lx; c.x <= croom.hx; c.x++)
            for (c.y = croom.ly; c.y <= croom.hy; c.y++)
                if (!levl()[c.x][c.y].edge
                    && (levl()[c.x][c.y].roomno) == i)
                    return TRUE;
        return FALSE;
    }

    if (!croom.nsubrooms) {
        c.x = somex(croom);
        c.y = somey(croom);
        return TRUE;
    }

    /* Check that coords doesn't fall into a subroom or into a wall */

    while (try_cnt++ < 100) {
        c.x = somex(croom);
        c.y = somey(croom);
        if (IS_WALL(levl()[c.x][c.y].typ))
            continue;
        you_lose: { for (i = 0; i < croom.nsubrooms; i++)
            if (inside_room(croom.sbrooms[i], c.x, c.y))
                break you_lose;;
        break;
 }
        ;
    }
    if (try_cnt >= 100)
        return FALSE;
    return TRUE;
}

/* like somexy(), but returns an accessible location */
export function somexyspace(croom, c) { /* boolean */
    let trycnt = 0;
    let okay;

    do {
        okay = (somexy(croom, c) && isok(c.x, c.y) && !occupied(c.x, c.y)
            && (levl()[c.x][c.y].typ == ROOM
                || levl()[c.x][c.y].typ == CORR
                || levl()[c.x][c.y].typ == ICE) ? 1 : 0);
    } while (trycnt++ < 100 && !okay);
    return okay;
}

/*
 * Search for a special room given its type (zoo, court, etc...)
 *      Special values :
 *              - ANY_SHOP
 *              - ANY_TYPE
 */
export function search_special(type) { /* struct mkroom * */
    let croom;

    for (croom = ptr_add(svr.rooms[0], 0); croom.hx >= 0; croom = ptr_add(croom, 1))
        if ((type == ANY_TYPE && croom.rtype != OROOM)
            || (type == ANY_SHOP && croom.rtype >= SHOPBASE)
            || croom.rtype == type)
            return croom;
    for (croom = ptr_add(gs.subrooms, 0); croom.hx >= 0; croom = ptr_add(croom, 1))
        if ((type == ANY_TYPE && croom.rtype != OROOM)
            || (type == ANY_SHOP && croom.rtype >= SHOPBASE)
            || croom.rtype == type)
            return croom;
    return null;
}

export function courtmon() { /* struct permonst * */
    let i = rn2(60) + rn2(3 * level_difficulty());

    if (i > 100)
        return mkclass(S_DRAGON, 0);
    else if (i > 95)
        return mkclass(S_GIANT, 0);
    else if (i > 85)
        return mkclass(S_TROLL, 0);
    else if (i > 75)
        return mkclass(S_CENTAUR, 0);
    else if (i > 60)
        return mkclass(S_ORC, 0);
    else if (i > 45)
        return mons[PM_BUGBEAR];
    else if (i > 30)
        return mons[PM_HOBGOBLIN];
    else if (i > 15)
        return mkclass(S_GNOME, 0);
    else
        return mkclass(S_KOBOLD, 0);
}

  const struct___anon1 = struct("mkroom.struct___anon1", {
    pm: unsigned,
    prob: unsigned,
}); const squadprob = static_array("squadprob", struct___anon1, null, [ { pm: PM_SOLDIER, prob: 80 },
                  { pm: PM_SERGEANT, prob: 15 },
                  { pm: PM_LIEUTENANT, prob: 4 },
                  { pm: PM_CAPTAIN, prob: 1 } ]);

/* return soldier types. */
function squadmon() { /* struct permonst * */
    var sel_prob, i, cpro, mndx;

    sel_prob = rnd(80 + level_difficulty());

    cpro = 0;
    gotone: { for (i = 0; i < SIZE(squadprob); i++) {
        cpro = int(cpro + (squadprob[i].prob));
        if (cpro > sel_prob) {
            mndx = int(squadprob[i].pm);
            break gotone;
        }
    }
    mndx = int(ROLL_FROM(squadprob).pm);
 }
    if (!(svm.mvitals[mndx].mvflags & G_GONE))
        return mons[mndx];
    else
        return null;
}

/*
 * save_room : A recursive function that saves a room and its subrooms
 * (if any).
 */
function save_room(nhfp, r) { /* void */
    let i;

    /*
     * Well, I really should write only useful information instead
     * of writing the whole structure. That is I should not write
     * the gs.subrooms pointers, but who cares ?
     */
    Sfo_mkroom(nhfp, r, _("room-mkroom"));
    for (i = 0; i < r.nsubrooms; i++) {
        save_room(nhfp, r.sbrooms[i]);
    }
}

/*
 * save_rooms : Save all the rooms on disk!
 */
export function save_rooms(nhfp) { /* void */
    let i;

    /* First, write the number of rooms */
    Sfo_int(nhfp, ref_of(svn, "nroom"), _("room-nroom"));
    for (i = 0; i < svn.nroom; i++)
        save_room(nhfp, svr.rooms[i]);
}

function rest_room(nhfp, r) { /* void */
    let i;

    Sfi_mkroom(nhfp, r, _("room-mkroom"));

    for (i = 0; i < r.nsubrooms; i++) {
        r.sbrooms[i] = ptr_add(gs.subrooms, gn.nsubroom);
        rest_room(nhfp, ptr_add(gs.subrooms, gn.nsubroom));
        ptr_add(gs.subrooms, gn.nsubroom++).resident = null;
    }
}

/*
 * rest_rooms : That's for restoring rooms. Read the rooms structure from
 * the disk.
 */
export function rest_rooms(nhfp) { /* void */
    let i;

    sfi_int(nhfp, ref_of(svn, "nroom"), _("room-nroom"));

    gn.nsubroom = 0;
    for (i = 0; i < svn.nroom; i++) {
        rest_room(nhfp, svr.rooms[i]);
        svr.rooms[i].resident = null;
    }
    svr.rooms[svn.nroom].hx = -1; /* restore ending flags */
    ptr_add(gs.subrooms, gn.nsubroom).hx = -1;
}

/* convert a display symbol for terrain into topology type;
   used for remembered terrain when mimics pose as furniture */
export function cmap_to_type(sym) { /* int */
    let typ = STONE; /* catchall */

    switch (sym) {
    case S_stone:
        typ = STONE;
        break;
    case S_vwall:
        typ = VWALL;
        break;
    case S_hwall:
        typ = HWALL;
        break;
    case S_tlcorn:
        typ = TLCORNER;
        break;
    case S_trcorn:
        typ = TRCORNER;
        break;
    case S_blcorn:
        typ = BLCORNER;
        break;
    case S_brcorn:
        typ = BRCORNER;
        break;
    case S_crwall:
        typ = CROSSWALL;
        break;
    case S_tuwall:
        typ = TUWALL;
        break;
    case S_tdwall:
        typ = TDWALL;
        break;
    case S_tlwall:
        typ = TLWALL;
        break;
    case S_trwall:
        typ = TRWALL;
        break;
    case S_ndoor:  /* no door (empty doorway) */
    case S_vodoor: /* open door in vertical wall */
    case S_hodoor: /* open door in horizontal wall */
    case S_vcdoor: /* closed door in vertical wall */
    case S_hcdoor:
        typ = DOOR;
        break;
    case S_bars:
        typ = IRONBARS;
        break;
    case S_tree:
        typ = TREE;
        break;
    case S_room:
    case S_darkroom:
        typ = ROOM;
        break;
    case S_corr:
    case S_litcorr:
        typ = CORR;
        break;
    case S_upstair:
    case S_dnstair:
        typ = STAIRS;
        break;
    case S_upladder:
    case S_dnladder:
        typ = LADDER;
        break;
    case S_altar:
        typ = ALTAR;
        break;
    case S_grave:
        typ = GRAVE;
        break;
    case S_throne:
        typ = THRONE;
        break;
    case S_sink:
        typ = SINK;
        break;
    case S_fountain:
        typ = FOUNTAIN;
        break;
    case S_pool:
        typ = POOL;
        break;
    case S_ice:
        typ = ICE;
        break;
    case S_lava:
        typ = LAVAPOOL;
        break;
    case S_vodbridge: /* open drawbridge spanning north/south */
    case S_hodbridge:
        typ = DRAWBRIDGE_DOWN;
        break;        /* east/west */
    case S_vcdbridge: /* closed drawbridge in vertical wall */
    case S_hcdbridge:
        typ = DBWALL;
        break;
    case S_air:
        typ = AIR;
        break;
    case S_cloud:
        typ = CLOUD;
        break;
    case S_water:
        typ = WATER;
        break;
    case S_lavawall:
        typ = LAVAWALL;
        break;
    default:
        break; /* not a cmap symbol? */
    }
    return typ;
}

/* With the introduction of themed rooms, there are certain room shapes that
 * may generate a door, the square just inside the door, and only one other
 * ROOM square touching that one. E.g.
 *   ---
 * ---..
 * +....
 * ---..
 *   ---
 * This means that if the room becomes a shop, the shopkeeper will move
 * between those two squares nearest the door without ever allowing the
 * player to get past them.
 * Before approving sroom as a shop, check for this circumstance, and if it
 * exists, don't consider it as valid for a shop.
 *
 * Note that the invalidity of the shape derives from the position of its door
 * already being chosen. It's quite possible that if the door were somewhere
 * else on the perimeter of this room, it would work fine as a shop.*/
function invalid_shop_shape(sroom) { /* boolean */
    let x, y;
    let doorx = ptr_add(svd.doors, sroom.fdoor).x;
    let doory = ptr_add(svd.doors, sroom.fdoor).y;
    let insidex = 0, insidey = 0, insidect = 0;

    /* First, identify squares inside the room and next to the door. */
    for (x = max(doorx - 1, sroom.lx);
         x <= min(doorx + 1, sroom.hx); x++) {
        for (y = max(doory - 1, sroom.ly);
             y <= min(doory + 1, sroom.hy); y++) {
            if (levl()[x][y].typ == ROOM) {
                insidex = x;
                insidey = y;
                insidect++;
            }
        }
    }
    if (insidect < 1) {
        impossible(_("invalid_shop_shape: no squares inside door?"));
        return TRUE;
    }
    /* if insidect > 1, then the shopkeeper already has alternate
     * squares to move to so we don't need to check further. */
    if (insidect == 1) {
        /* But if it is 1, scan all adjacent squares for other squares
         * that are part of this room. */
        insidect = 0;
        for (x = max(insidex - 1, sroom.lx);
             x <= min(insidex + 1, sroom.hx); x++) {
            for (y = max(insidey - 1, sroom.ly);
                 y <= min(insidey + 1, sroom.hy); y++) {
                if (x == insidex && y == insidey)
                    continue;
                if (levl()[x][y].typ == ROOM)
                    insidect++;
            }
        }
        if (insidect == 1) {
            /* shopkeeper standing just inside the door can only move
             * to one other square; this cannot be a shop. */
            return TRUE;
        }
    }
    return FALSE;
}

/*mkroom.c*/

import { AM_SHRINE, A_NONE } from "./align.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    FOOD_CLASS, RANDOM_CLASS, SPBOOK_CLASS, S_CENTAUR, S_DEMON, S_DRAGON, S_FUNGUS, S_GIANT,
    S_GNOME, S_KOBOLD, S_ORC, S_TROLL, S_VAMPIRE, S_ZOMBIE, S_air, S_altar, S_bars, S_blcorn,
    S_brcorn, S_cloud, S_corr, S_crwall, S_darkroom, S_dnladder, S_dnstair, S_fountain, S_grave,
    S_hcdbridge, S_hcdoor, S_hodbridge, S_hodoor, S_hwall, S_ice, S_lava, S_lavawall, S_litcorr,
    S_ndoor, S_pool, S_room, S_sink, S_stone, S_tdwall, S_throne, S_tlcorn, S_tlwall, S_trcorn,
    S_tree, S_trwall, S_tuwall, S_upladder, S_upstair, S_vcdbridge, S_vcdoor, S_vodbridge, S_vodoor,
    S_vwall, S_water, WAND_CLASS,
} from "./defsym.h.js";
import { In_endgame, Inhell } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { FALSE, TRUE } from "./global.h.js";
import { MM_ASLEEP, MM_NOGRP, NO_MM_FLAGS } from "./hack.h.js";
import { ROLL_FROM, max, min, rn1 } from "./hack.h.macros.js";
import {
    ANTHOLE, ANY_SHOP, ANY_TYPE, BARRACKS, BEEHIVE, COCKNEST, COURT, FILL_NORMAL, FODDERSHOP,
    LEPREHALL, MORGUE, OROOM, ROOMOFFSET, SHOPBASE, SWAMP, TEMPLE, ZOO,
} from "./mkroom.h.js";
import { G_GONE } from "./monflag.h.js";
import {
    NON_PM, PM_BUGBEAR, PM_CAPTAIN, PM_COCKATRICE, PM_DWARF_RULER, PM_ELECTRIC_EEL,
    PM_ELVEN_MONARCH, PM_FIRE_ANT, PM_GHOST, PM_GIANT_ANT, PM_GIANT_EEL, PM_GNOME_RULER,
    PM_HOBGOBLIN, PM_KILLER_BEE, PM_LEPRECHAUN, PM_LIEUTENANT, PM_OGRE_TYRANT, PM_PIRANHA,
    PM_QUEEN_BEE, PM_SERGEANT, PM_SOLDIER, PM_SOLDIER_ANT, PM_WRAITH,
} from "./monsters.h.js";
import {
    CHEST, CORPSE, GOLD_PIECE, LARGE_BOX, LUMP_OF_ROYAL_JELLY, MACE, STATUE,
} from "./objects.h.js";
import {
    AIR, ALTAR, BLCORNER, BRCORNER, CLOUD, CORR, CROSSWALL, DBWALL, DOOR, DRAWBRIDGE_DOWN, FOUNTAIN,
    GRAVE, HWALL, ICE, IRONBARS, LADDER, LAVAPOOL, LAVAWALL, POOL, ROOM, SDOOR, SINK, STAIRS, STONE,
    TDWALL, THRONE, TLCORNER, TLWALL, TRCORNER, TREE, TRWALL, TUWALL, VWALL, WATER,
} from "./rm.h.js";
import {
    IS_DOOR, IS_ROOM, IS_THRONE, IS_WALL, MON_AT, OBJ_AT, SPACE_POS, levl,
} from "./rm.h.macros.js";
import { Sfi_mkroom, Sfo_int, Sfo_mkroom } from "./savefile.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { int, ord, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { stack_struct, static_array, static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { elt, ptr_add, ptr_diff, ref_of, struct } from "../rt/struct.js";
import { isok } from "./cmd.js";
import { gn, gs, svd, svl, svm, svn, svr, u } from "./decl.js";
import { def_oc_syms } from "./drawing.js";
import { induced_align, level_difficulty } from "./dungeon.js";
import { del_engr_at, make_grave } from "./engrave.js";
import { dist2, distmin } from "./hacklib.js";
import { sobj_at } from "./invent.js";
import { makemon, mkclass, mongets, set_malign } from "./makemon.js";
import { ndemon } from "./minion.js";
import { occupied, topologize } from "./mklev.js";
import {
    add_to_container, mk_tt_object, mkgold, mkobj, mkobj_at, mksobj, mksobj_at, weight,
} from "./mkobj.js";
import { mons } from "./monst.js";
import { nh_getenv } from "./options.js";
import { impossible } from "./pline.js";
import { priestini } from "./priest.js";
import { rn2, rnd } from "./rnd.js";
import { sfi_int } from "./sfbase.js";
import { shtypes } from "./shknam.js";
import { enexto } from "./teleport.js";
import { t_at } from "./trap.js";
import { revive } from "./zap.js";
