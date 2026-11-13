/* NetHack 5.0	mkmaze.c	$NHDT-Date: 1745114235 2025/04/19 17:57:15 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.179 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2018. */
/* NetHack may be freely redistributed.  See license for details. */

/* adjust a coordinate one step in the specified direction */

/* used to determine if wall spines can join this location */
function iswall(x, y) { /* int */
    let type;

    if (!isok(x, y))
        return 0;
    type = levl()[x][y].typ;
    return (IS_WALL(type) || IS_DOOR(type)
            || type == LAVAWALL || type == WATER
            || type == SDOOR || type == IRONBARS ? 1 : 0);
}

/* used to determine if wall spines can join this location */
function iswall_or_stone(x, y) { /* int */
    /* out of bounds = stone */
    if (!isok(x, y))
        return 1;

    return (levl()[x][y].typ == STONE || iswall(x, y) ? 1 : 0);
}

/* return TRUE if out of bounds, wall or rock */
function is_solid(x, y) { /* boolean */
    return (+(!isok(x, y) || IS_STWALL(levl()[x][y].typ)));
}

/* set map terrain type, handling lava lit, ice melt timers, etc */
export function set_levltyp(x, y, newtyp) { /* boolean */
    if (isok(x, y) && newtyp >= STONE && newtyp < MAX_TYPE) {
        let oldtyp = levl()[x][y].typ;

        /* hack for secret doors in garden theme rooms */
        if (oldtyp == SDOOR && newtyp == AIR) {
            /* levl[][].typ stays SDOOR rather than change to AIR */
            levl()[x][y].candig = 1;
            return TRUE;
        }

        if (CAN_OVERWRITE_TERRAIN(oldtyp)) {
            /* typ==ICE || (typ==DRAWBRIDGE_UP && drawbridgemask==DB_ICE) */
            let was_ice = is_ice(x, y);

            levl()[x][y].typ = newtyp;
            /* TODO?
             *  if oldtyp used flags or horizontal differently from
             *  the way newtyp will use them, clear them.
             */

            if (IS_LAVA(newtyp)) /* [what about IS_LAVA(oldtyp)=>.lit = 0?] */
                levl()[x][y].lit = 1;
            if (was_ice && newtyp != ICE) {
                /* frozen corpses resume rotting, no more ice to melt away */
                obj_ice_effects(x, y, TRUE);
                spot_stop_timers(x, y, MELT_ICE_AWAY);
            }
            if ((IS_FOUNTAIN(oldtyp) != IS_FOUNTAIN(newtyp))
                || (IS_SINK(oldtyp) != IS_SINK(newtyp)))
                count_level_features(); /* level.flags.nfountains,nsinks */

            return TRUE;
        }
    }
    return FALSE;
}

/* set map terrain type and light state */
export function set_levltyp_lit(x, y, typ, lit) { /* boolean */
    let ret = set_levltyp(x, y, typ);

    if (ret && isok(x, y)) {
        if (lit != SET_LIT_NOCHANGE) {
            if (IS_LAVA(typ))
                lit = 1;
            else if (lit == SET_LIT_RANDOM)
                lit = rn2(2);

            levl()[x][y].lit = unsigned(lit);
        }
    }
    return ret;
}

/*
 * Return 1 (not TRUE - we're doing bit vectors here) if we want to extend
 * a wall spine in the (dx,dy) direction.  Return 0 otherwise.
 *
 * To extend a wall spine in that direction, first there must be a wall there.
 * Then, extend a spine unless the current position is surrounded by walls
 * in the direction given by (dx,dy).  E.g. if 'x' is our location, 'W'
 * a wall, '.' a room, 'a' anything (we don't care), and our direction is
 * (0,1) - South or down - then:
 *
 *              a a a
 *              W x W           This would not extend a spine from x down
 *              W W W           (a corridor of walls is formed).
 *
 *              a a a
 *              W x W           This would extend a spine from x down.
 *              . W W
 */
function extend_spine(locale, wall_there, dx, dy) { /* int */
    let spine, nx, ny;

    nx = 1 + dx;
    ny = 1 + dy;

    if (wall_there) { /* wall in that direction */
        if (dx) {
            if (locale[1][0] && locale[1][2]         /* EW are wall/stone */
                && locale[nx][0] && locale[nx][2]) { /* diag are wall/stone */
                spine = 0;
            } else {
                spine = 1;
            }
        } else { /* dy */
            if (locale[0][1] && locale[2][1]         /* NS are wall/stone */
                && locale[0][ny] && locale[2][ny]) { /* diag are wall/stone */
                spine = 0;
            } else {
                spine = 1;
            }
        }
    } else {
        spine = 0;
    }

    return spine;
}

/* Remove walls totally surrounded by stone */
function wall_cleanup(x1, y1, x2, y2) { /* void */
    let type;
    let x, y;
    let lev;

    /* sanity check on incoming variables */
    if (x1 < 0 || x2 >= COLNO || x1 > x2 || y1 < 0 || y2 >= ROWNO || y1 > y2)
        panic(_("wall_cleanup: bad bounds (%d,%d) to (%d,%d)"), x1, y1, x2, y2);

    /* change walls surrounded by rock to rock. */
    for (x = x1; x <= x2; x++)
        for (y = y1; y <= y2; y++) {
            if (within_bounded_area(x, y,
                                  gb.bughack.inarea.x1, gb.bughack.inarea.y1,
                                  gb.bughack.inarea.x2, gb.bughack.inarea.y2))
                continue;
            lev = levl()[x][y];
            type = uchar(lev.typ);
            if (IS_WALL(type) && type != DBWALL) {
                if (is_solid(x - 1, y - 1) && is_solid(x - 1, y)
                    && is_solid(x - 1, y + 1) && is_solid(x, y - 1)
                    && is_solid(x, y + 1) && is_solid(x + 1, y - 1)
                    && is_solid(x + 1, y) && is_solid(x + 1, y + 1))
                    lev.typ = STONE;
            }
        }
}

/* Correct wall types so they extend and connect to each other */
export function fix_wall_spines(x1, y1, x2, y2) { /* void */
    const $frame = stack_frame(); try {
    let type;
    let x, y;
    let lev;
    let loc_f;
    let bits;
    let locale = stack_array(array_of(int, 3), 3); /* rock or wall status surrounding positions */

    /*
     * Value 0 represents a free-standing wall.  It could be anything,
     * so even though this table says VWALL, we actually leave whatever
     * typ was there alone.
     */
    let spine_array = static_array("fix_wall_spines.spine_array", short, 16, [ VWALL, HWALL,    HWALL,    HWALL,
                                     VWALL, TRCORNER, TLCORNER, TDWALL,
                                     VWALL, BRCORNER, BLCORNER, TUWALL,
                                     VWALL, TLWALL,   TRWALL,   CROSSWALL ]);

    /* sanity check on incoming variables */
    if (x1 < 0 || x2 >= COLNO || x1 > x2 || y1 < 0 || y2 >= ROWNO || y1 > y2)
        panic(_("wall_extends: bad bounds (%d,%d) to (%d,%d)"), x1, y1, x2, y2);

    /* set the correct wall type. */
    for (x = x1; x <= x2; x++)
        for (y = y1; y <= y2; y++) {
            lev = levl()[x][y];
            type = uchar(lev.typ);
            if (!(IS_WALL(type) && type != DBWALL))
                continue;

            /* set the locations TRUE if rock or wall or out of bounds */
            loc_f = within_bounded_area(x, y, /* for baalz insect */
                                   gb.bughack.inarea.x1, gb.bughack.inarea.y1,
                                   gb.bughack.inarea.x2, gb.bughack.inarea.y2)
                       ? iswall
                       : iswall_or_stone;
            locale[0][0] = loc_f(x - 1, y - 1);
            locale[1][0] = loc_f(x, y - 1);
            locale[2][0] = loc_f(x + 1, y - 1);

            locale[0][1] = loc_f(x - 1, y);
            locale[2][1] = loc_f(x + 1, y);

            locale[0][2] = loc_f(x - 1, y + 1);
            locale[1][2] = loc_f(x, y + 1);
            locale[2][2] = loc_f(x + 1, y + 1);

            /* determine if wall should extend to each direction NSEW */
            bits = (extend_spine(locale, iswall(x, y - 1), 0, -1) << 3)
                   | (extend_spine(locale, iswall(x, y + 1), 0, 1) << 2)
                   | (extend_spine(locale, iswall(x + 1, y), 1, 0) << 1)
                   | extend_spine(locale, iswall(x - 1, y), -1, 0);

            /* don't change typ if wall is free-standing */
            if (bits)
                lev.typ = spine_array[bits];
        }
    } finally { stack_pop($frame); }
}

export function wallification(x1, y1, x2, y2) { /* void */
    wall_cleanup(x1, y1, x2, y2);
    fix_wall_spines(x1, y1, x2, y2);
}

function okay(x, y, dir) { /* boolean */
    do { switch (dir) { case 0: --(y); break; case 1: (x)++; break; case 2: (y)++; break; case 3: --(x); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
    do { switch (dir) { case 0: --(y); break; case 1: (x)++; break; case 2: (y)++; break; case 3: --(x); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
    if (x < 3 || y < 3 || x > gx.x_maze_max || y > gy.y_maze_max
        || levl()[x][y].typ != STONE)
        return FALSE;
    return TRUE;
}

/* find random starting point for maze generation */
function maze0xy(cc) { /* void */
    cc.x = 3 + 2 * rn2((gx.x_maze_max >> 1) - 1);
    cc.y = 3 + 2 * rn2((gy.y_maze_max >> 1) - 1);
    return;
}

export function is_exclusion_zone(type, x, y) { /* boolean */
    let ez = sve.exclusion_zones;

    while (ez) {
        if (((type == LR_DOWNTELE
              && (ez.zonetype == LR_DOWNTELE || ez.zonetype == LR_TELE))
             || (type == LR_UPTELE
                 && (ez.zonetype == LR_UPTELE || ez.zonetype == LR_TELE))
             || type == ez.zonetype)
            && (((((x) >= (ez.lx)) && ((x) <= (ez.hx))) && ((y) >= (ez.ly))) && ((y) <= (ez.hy))))
            return TRUE;
        ez = ez.next;
    }
    return FALSE;
}

/*
 * Bad if:
 *      pos is occupied OR
 *      pos is inside restricted region (nlx,nly,nhx,nhy) OR
 *      NOT (pos is corridor and a maze level OR pos is a room OR pos is air)
 */
export function bad_location(
    x, y,
    nlx, nly, nhx, nhy) { /* boolean */
    return (occupied(x, y)
                      || within_bounded_area(x, y, nlx, nly, nhx, nhy)
                      || !((levl()[x][y].typ == CORR
                            && svl.level.flags.is_maze_lev)
                           || levl()[x][y].typ == ROOM
                           || levl()[x][y].typ == AIR) ? 1 : 0);
}

/* pick a location in area (lx, ly, hx, hy) but not in (nlx, nly, nhx, nhy)
   and place something (based on rtype) in that region */
export function place_lregion(
    lx, ly, hx, hy,
    nlx, nly, nhx, nhy,
    rtype,
    lev) { /* void */
    let trycnt;
    let oneshot;
    let x, y;

    if (!lx) { /* default to whole level */
        /*
         * if there are rooms and this a branch, let place_branch choose
         * the branch location (to avoid putting branches in corridors).
         */
        if (rtype == LR_BRANCH && svn.nroom) {
            place_branch(Is_branchlev(u.uz), 0, 0);
            return;
        }

        lx = 1; /* column 0 is not used */
        hx = COLNO - 1;
        ly = 0; /* 3.6.0 and earlier erroneously had 1 here */
        hy = ROWNO - 1;
    }

    /* clamp the area to the map */
    if (lx < 1)
        lx = 1;
    if (hx > COLNO - 1)
        hx = COLNO - 1;
    if (ly < 0)
        ly = 0;
    if (hy > ROWNO - 1)
        hy = ROWNO - 1;

    /* first a probabilistic approach */

    oneshot = +(lx == hx && ly == hy);
    for (trycnt = 0; trycnt < 200; trycnt++) {
        x = rn1((hx - lx) + 1, lx);
        y = rn1((hy - ly) + 1, ly);
        if (put_lregion_here(x, y, nlx, nly, nhx, nhy, rtype, oneshot, lev))
            return;
    }

    /* then a deterministic one */

    for (x = lx; x <= hx; x++)
        for (y = ly; y <= hy; y++)
            if (put_lregion_here(x, y, nlx, nly, nhx, nhy, rtype, TRUE, lev))
                return;

    impossible(_("Couldn't place lregion type %d!"), rtype);
}

function put_lregion_here(
    x, y,
    nlx, nly, nhx, nhy,
    rtype,
    oneshot,
    lev) { /* boolean */
    let mtmp;

    if (bad_location(x, y, nlx, nly, nhx, nhy)
        || is_exclusion_zone(rtype, x, y)) {
        if (!oneshot) {
            return FALSE; /* caller should try again */
        } else {
            /* Must make do with the only location possible;
               avoid failure due to a misplaced trap.
               It might still fail if there's a dungeon feature here. */
            let t = t_at(x, y);

            if (t && !undestroyable_trap(t.ttyp)) {
                if (((mtmp = m_at(x, y)) != null) && mtmp.mtrapped)
                    mtmp.mtrapped = 0;
                deltrap(t);
            }
            if (bad_location(x, y, nlx, nly, nhx, nhy)
                || is_exclusion_zone(rtype, x, y))
                return FALSE;
        }
    }
    switch (rtype) {
    case LR_TELE:
    case LR_UPTELE:
    case LR_DOWNTELE:
        /* "something" means the player in this case */
        if ((mtmp = m_at(x, y)) != null) {
            /* move the monster if no choice, or just try again */
            if (oneshot) {
                if (!rloc(mtmp, RLOC_NOMSG))
                    m_into_limbo(mtmp);
            } else
                return FALSE;
        }
        u_on_newpos(x, y);
        break;
    case LR_PORTAL:
        mkportal(x, y, lev.dnum, lev.dlevel);
        break;
    case LR_DOWNSTAIR:
    case LR_UPSTAIR:
        mkstairs(x, y, char(rtype), null, FALSE);
        break;
    case LR_BRANCH:
        place_branch(Is_branchlev(u.uz), x, y);
        break;
    }
    return TRUE;
}

/* fix up Baalzebub's lair, which depicts a level-sized beetle;
   its legs are walls within solid rock--regular wallification
   classifies them as superfluous and gets rid of them */
function baalz_fixup() { /* void */
    let mtmp;
    let x, y, lastx, lasty;

    /*
     * baalz level's nondiggable region surrounds the "insect" and rooms.
     * The outermost perimeter of that region is subject to wall cleanup
     * (hence 'x + 1' and 'y + 1' for starting don't-clean column and row,
     * 'lastx - 1' and 'lasty - 1' for ending don't-clean column and row)
     * and the interior is protected against that (in wall_cleanup()).
     *
     * Assumes level.flags.corrmaze is True, otherwise the bug legs will
     * have already been "cleaned" away by general wallification.
     */

    /* find low and high x for to-be-wallified portion of level */
    y = Math.trunc(ROWNO / 2);
    for (lastx = x = 0; x < COLNO; ++x)
        if ((levl()[x][y].flags & W_NONDIGGABLE) != 0) {
            if (!lastx)
                gb.bughack.inarea.x1 = x + 1;
            lastx = x;
        }
    gb.bughack.inarea.x2 = ((lastx > gb.bughack.inarea.x1) ? lastx : x) - 1;
    /* find low and high y for to-be-wallified portion of level */
    x = gb.bughack.inarea.x1;
    for (lasty = y = 0; y < ROWNO; ++y)
        if ((levl()[x][y].flags & W_NONDIGGABLE) != 0) {
            if (!lasty)
                gb.bughack.inarea.y1 = y + 1;
            lasty = y;
        }
    gb.bughack.inarea.y2 = ((lasty > gb.bughack.inarea.y1) ? lasty : y) - 1;
    /* two pools mark where special post-wallify fix-ups are needed */
    for (x = gb.bughack.inarea.x1; x <= gb.bughack.inarea.x2; ++x)
        for (y = gb.bughack.inarea.y1; y <= gb.bughack.inarea.y2; ++y)
            if (levl()[x][y].typ == POOL) {
                levl()[x][y].typ = HWALL;
                if (gb.bughack.delarea.x1 == COLNO)
                    gb.bughack.delarea.x1 = x, gb.bughack.delarea.y1 = y;
                else
                    gb.bughack.delarea.x2 = x, gb.bughack.delarea.y2 = y;
            } else if (levl()[x][y].typ == IRONBARS) {
                /* novelty effect; allowing digging in front of 'eyes' */
                if (isok(x - 1, y)
                    && (levl()[x - 1][y].flags & W_NONDIGGABLE) != 0) {
                    levl()[x - 1][y].flags &= ~W_NONDIGGABLE;
                    if (isok(x - 2, y))
                        levl()[x - 2][y].flags &= ~W_NONDIGGABLE;
                } else if (isok(x + 1, y)
                    && (levl()[x + 1][y].flags & W_NONDIGGABLE) != 0) {
                    levl()[x + 1][y].flags &= ~W_NONDIGGABLE;
                    if (isok(x + 2, y))
                        levl()[x + 2][y].flags &= ~W_NONDIGGABLE;
                }
            }

    wallification(max(gb.bughack.inarea.x1 - 2, 1),
                  max(gb.bughack.inarea.y1 - 2, 0),
                  min(gb.bughack.inarea.x2 + 2, COLNO - 1),
                  min(gb.bughack.inarea.y2 + 2, ROWNO - 1));

    /* bughack hack for rear-most legs on baalz level; first joint on
       both top and bottom gets a bogus extra connection to room area,
       producing unwanted rectangles; change back to separated legs */
    x = gb.bughack.delarea.x1, y = gb.bughack.delarea.y1;
    if (isok(x, y) && (levl()[x][y].typ == TLWALL || levl()[x][y].typ == TRWALL)
        && isok(x, y + 1) && levl()[x][y + 1].typ == TUWALL) {
        levl()[x][y].typ = (levl()[x][y].typ == TLWALL) ? BRCORNER : BLCORNER;
        levl()[x][y + 1].typ = HWALL;
        if ((mtmp = m_at(x, y)) != null) /* something at temporary pool... */
            rloc(mtmp, RLOC_ERR|RLOC_NOMSG);
    }

    x = gb.bughack.delarea.x2, y = gb.bughack.delarea.y2;
    if (isok(x, y) && (levl()[x][y].typ == TLWALL || levl()[x][y].typ == TRWALL)
        && isok(x, y - 1) && levl()[x][y - 1].typ == TDWALL) {
        levl()[x][y].typ = (levl()[x][y].typ == TLWALL) ? TRCORNER : TLCORNER;
        levl()[x][y - 1].typ = HWALL;
        if ((mtmp = m_at(x, y)) != null) /* something at temporary pool... */
            rloc(mtmp, RLOC_ERR|RLOC_NOMSG);
    }

    /* reset bughack region; set low end to <COLNO,ROWNO> so that
       within_bounded_region() in fix_wall_spines() will fail
       most quickly--on its first test--when loading other levels */
    gb.bughack.inarea.x1 = gb.bughack.delarea.x1 = COLNO;
    gb.bughack.inarea.y1 = gb.bughack.delarea.y1 = ROWNO;
    gb.bughack.inarea.x2 = gb.bughack.delarea.x2 = 0;
    gb.bughack.inarea.y2 = gb.bughack.delarea.y2 = 0;
}

/* this is special stuff that the level compiler cannot (yet) handle */
export function fixup_special() { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var lev = stack_struct(struct_d_level);
    var r = gl.lregions;
    var sp;

    var x, y;
    var croom;
    var added_branch = FALSE;

    if (Is_waterlevel(u.uz) || Is_airlevel(u.uz)) {
        svl.level.flags.hero_memory = 0;
        /* water level is an odd beast - it has to be set up
           before calling place_lregions etc. */
        setup_waterlevel();
    }
    for (x = 0; x < gn.num_lregions; x++, r = ptr_add(r, 1)) {
        $goto_place_it: for (;;) { switch ($goto || (r.rtype)) {
        case LR_BRANCH:
            added_branch = TRUE;
            { $goto = "place_it"; continue $goto_place_it; }

        case LR_PORTAL:
            if (chars[r.rname.str] >= ord('0') && chars[r.rname.str] <= ord('9')) {
                /* "chutes and ladders" */
                struct_assign(lev, u.uz);
                lev.dlevel = atoi(r.rname.str);
            } else {
                sp = find_level(r.rname.str);
                struct_assign(lev, sp.dlevel);
            }
            /* FALLTHROUGH */;
            /*FALLTHRU*/

        case "place_it": case LR_UPSTAIR:
        case LR_DOWNSTAIR:
 $goto = null;
            place_lregion(r.inarea.x1, r.inarea.y1, r.inarea.x2,
                          r.inarea.y2, r.delarea.x1, r.delarea.y1,
                          r.delarea.x2, r.delarea.y2, r.rtype, lev);
            break;

        case LR_TELE:
        case LR_UPTELE:
        case LR_DOWNTELE:
            /* save the region outlines for goto_level() */
            if (r.rtype == LR_TELE || r.rtype == LR_UPTELE) {
                svu.updest.lx = r.inarea.x1;
                svu.updest.ly = r.inarea.y1;
                svu.updest.hx = r.inarea.x2;
                svu.updest.hy = r.inarea.y2;
                svu.updest.nlx = r.delarea.x1;
                svu.updest.nly = r.delarea.y1;
                svu.updest.nhx = r.delarea.x2;
                svu.updest.nhy = r.delarea.y2;
            }
            if (r.rtype == LR_TELE || r.rtype == LR_DOWNTELE) {
                svd.dndest.lx = r.inarea.x1;
                svd.dndest.ly = r.inarea.y1;
                svd.dndest.hx = r.inarea.x2;
                svd.dndest.hy = r.inarea.y2;
                svd.dndest.nlx = r.delarea.x1;
                svd.dndest.nly = r.delarea.y1;
                svd.dndest.nhx = r.delarea.x2;
                svd.dndest.nhy = r.delarea.y2;
            }
            /* place_lregion gets called from goto_level() */
            break;
        } break; }

        if (r.rname.str)
            free(r.rname.str), r.rname.str = 0;
    }

    /* place dungeon branch if not placed above */
    if (!added_branch && Is_branchlev(u.uz)) {
        place_lregion(0, 0, 0, 0, 0, 0, 0, 0, LR_BRANCH, null);
    }

    /* Still need to add some stuff to level file */
    if (Is_medusa_level(u.uz)) {
        var otmp;
        var tryct;

        croom = svr.rooms[0]; /* the first room defined on the medusa level */
        for (tryct = rnd(4); tryct; tryct--) {
            x = somex(croom);
            y = somey(croom);
            if (goodpos(x, y, null, 0)) {
                var tryct2 = 0;

                otmp = mk_tt_object(STATUE, x, y);
                while (++tryct2 < 100 && otmp
                       && (poly_when_stoned(mons[otmp.corpsenm])
                                || pm_resistance(mons[otmp.corpsenm],
                                                 MR_STONE))) {
                    /* set_corpsenm() handles weight too */
                    set_corpsenm(otmp, rndmonnum());
                }
            }
        }

        if (rn2(2))
            otmp = mk_tt_object(STATUE, somex(croom), somey(croom));
        else /* Medusa statues don't contain books */
            otmp =
                mkcorpstat(STATUE, null, null,
                           somex(croom), somey(croom), CORPSTAT_NONE);
        if (otmp) {
            tryct = 0;
            while (++tryct < 100
                   && (pm_resistance(mons[otmp.corpsenm], MR_STONE)
                       || poly_when_stoned(mons[otmp.corpsenm]))) {
                /* set_corpsenm() handles weight too */
                set_corpsenm(otmp, rndmonnum());
            }
        }
    } else if (Role_if(PM_CLERIC) && In_quest(u.uz)) {
        /* less chance for undead corpses (lured from lower morgues) */
        svl.level.flags.graveyard = 1;
    } else if (Is_stronghold(u.uz)) {
        svl.level.flags.graveyard = 1;
    } else if (on_level(u.uz, svd.dungeon_topology.d_baalzebub_level)) {
        /* custom wallify the "beetle" potion of the level */
        baalz_fixup();
    } else if (u.uz.dnum == mines_dnum() && gr.ransacked) {
       stolen_booty();
    }

    if ((sp = Is_special(u.uz)) != null && sp.flags.town) /* Mine Town */
        svl.level.flags.has_town = 1;

    if (gl.lregions)
        free(addr_of(gl.lregions)), gl.lregions = null;
    gn.num_lregions = 0;
    } finally { stack_pop($frame); }
}

function check_ransacked(s) { /* void */
    /* this kludge only works as long as orctown is minetn-1 */
    gr.ransacked = +(u.uz.dnum == mines_dnum() && !strcmp(s, _("minetn-1")));
}

export const ORC_LEADER = 1;
const orcfruit = static_array("orcfruit", ptr_to(char), null, [ _("paddle cactus"), _("dwarven root") ]);

function migrate_orc(mtmp, mflags) { /* void */
    const $frame = stack_frame(); try {
    let nlev, max_depth, cur_depth;
    let dest = stack_struct(struct_d_level);

    cur_depth = depth(u.uz);
    max_depth = dunlevs_in_dungeon(u.uz)
                + (svd.dungeons[u.uz.dnum].depth_start - 1);
    if (mflags == ORC_LEADER) {
        /* Note that the orc leader will take possession of any
         * remaining stuff not already delivered to other
         * orcs between here and the bottom of the mines.
         */
        nlev = max_depth;
        /* once in a blue moon, he won't be at the very bottom */
        if (!rn2(40))
            nlev--;
        mtmp.migflags = or64(mtmp.migflags, MIGR_LEFTOVERS);
    } else {
        nlev = rn2((max_depth - cur_depth) + 1) + cur_depth;
        if (nlev == cur_depth)
            nlev++;
        if (nlev > max_depth)
            nlev = max_depth;
        mtmp.migflags = and64(mtmp.migflags, ~MIGR_LEFTOVERS);
    }
    get_level(dest, nlev);
    migrate_to_level(mtmp, ledger_no(dest), MIGR_RANDOM, null);
    } finally { stack_pop($frame); }
}

function shiny_orc_stuff(mtmp) { /* void */
    let gemprob, goldprob, otyp;
    let otmp;
    let is_captain = +(mtmp.data == mons[PM_ORC_CAPTAIN]);

    /* probabilities */
    goldprob = is_captain ? 600 : 300;
    gemprob = Math.trunc(goldprob / 4);
    if (rn2(1000) < goldprob) {
        if ((otmp = mksobj(GOLD_PIECE, TRUE, FALSE)) != null) {
            otmp.quan = 1 + rnd(goldprob);
            otmp.owt = unsigned(weight(otmp));
            add_to_minv(mtmp, otmp);
        }
    }
    if (rn2(1000) < gemprob) {
        if ((otmp = mkobj(GEM_CLASS, FALSE)) != null) {
            if (otmp.otyp == ROCK)
                dealloc_obj(otmp);
            else
                add_to_minv(mtmp, otmp);
        }
    }
    if (is_captain || !rn2(8)) {
        otyp = shiny_obj(RING_CLASS);
        if (otyp != STRANGE_OBJECT && (otmp = mksobj(otyp, TRUE, FALSE)) != null)
            add_to_minv(mtmp, otmp);
    }
}

function migr_booty_item(otyp, gang) { /* void */
    let otmp;

    otmp = mksobj_migr_to_species(otyp, M2_ORC, TRUE, FALSE);
    if (otmp && gang) {
        new_oname(otmp, int(unsigned(Strlen(gang) + 1))); /* removes old name if present */
        strcpy(ONAME(otmp), gang);
        if (objects[otyp].oc_class == FOOD_CLASS) {
            if (otyp == SLIME_MOLD)
                otmp.spe = fruitadd(ROLL_FROM(orcfruit),
                                     null);
            otmp.quan += rn2(3);
            otmp.owt = unsigned(weight(otmp));
        }
    }
}

function stolen_booty() { /* void */
    const $frame = stack_frame(); try {
    let gang, gang_name = stack_array(char, BUFSZ);
    let mtmp;
    let cnt, i, otyp;

    /*
     * --------------------------------------------------------
     * Mythos:
     *
     *      A tragic accident has occurred in Frontier Town...
     *      It has been overrun by orcs.
     *
     *      The booty that the orcs took from the town is now
     *      in the possession of the orcs that did this and
     *      have long since fled the level.
     * --------------------------------------------------------
     */

    gang = rndorcname(gang_name);
    /* create the stuff that the gang took */
    cnt = rnd(4);
    for (i = 0; i < cnt; ++i)
        migr_booty_item(rn2(4) ? TALLOW_CANDLE : WAX_CANDLE, gang);
    cnt = rnd(3);
    for (i = 0; i < cnt; ++i)
        migr_booty_item(SKELETON_KEY, gang);
    otyp = rn1((GAUNTLETS_OF_DEXTERITY - LEATHER_GLOVES) + 1, LEATHER_GLOVES);
    migr_booty_item(otyp, gang);
    cnt = rnd(10);
    for (i = 0; i < cnt; ++i) {
        /* Food items - but no lembas! (or some other weird things) */
        otyp = rn1(TIN - TRIPE_RATION + 1, TRIPE_RATION);
        if (otyp != LEMBAS_WAFER
            /* exclude meat <anything>, globs of <anything>, kelp
               which all have random generation probability of 0
               (K-/C-rations do too, but we want to include those) */
            && (objects[otyp].oc_prob != 0
                || otyp == C_RATION || otyp == K_RATION)
            /* exclude food items which utilize obj->corpsenm because
               that field is going to be overloaded for delivery purposes */
            && otyp != CORPSE && otyp != EGG && otyp != TIN)
            migr_booty_item(otyp, gang);
    }
    migr_booty_item(rn2(2) ? LONG_SWORD : SILVER_SABER, gang);
    /* create the leader of the orc gang */
    mtmp = makemon(mons[PM_ORC_CAPTAIN], 0, 0, MM_NONAME);
    if (mtmp) {
        mtmp = christen_monst(mtmp, upstart(gang));
        mtmp.mpeaceful = 0;
        set_malign(mtmp);
        shiny_orc_stuff(mtmp);
        migrate_orc(mtmp, ORC_LEADER);
    }
    /* Make most of the orcs on the level be part of the invading gang */
    for (mtmp = fmon(); mtmp; mtmp = mtmp.nmon) {
        if (DEADMONSTER(mtmp))
            continue;

        if (is_orc(mtmp.data) && !has_mgivenname(mtmp) && rn2(10)) {
            /*
             * We'll consider the orc captain from the level
             * description to be the captain of a rival orc horde
             * who is there to see what has transpired, and to
             * contemplate future action.
             *
             * Don't christen the orc captain as a subordinate
             * member of the main orc horde.
             */
            if (mtmp.data != mons[PM_ORC_CAPTAIN])
                mtmp = christen_orc(mtmp, upstart(gang), _(""));
        }
    }
    /* Lastly, ensure there's several more orcs from the gang along the way.
     * The mechanics are such that they aren't actually identified as
     * members of the invading gang until they get their spoils assigned
     * to the inventory; handled during that assignment.
     */
    cnt = rn2(10) + 5;
    for (i = 0; i < cnt; ++i) {
        let mtyp;

        mtyp = rn2((PM_ORC_SHAMAN - PM_ORC) + 1) + PM_ORC;
        mtmp = makemon(mons[mtyp], 0, 0, MM_NONAME);
        if (mtmp) {
            shiny_orc_stuff(mtmp);
            migrate_orc(mtmp, 0);
        }
    }
    gr.ransacked = 0;
    } finally { stack_pop($frame); }
}

function maze_inbounds(x, y) { /* boolean */
    return (x >= 2 && y >= 2
            && x < gx.x_maze_max && y < gy.y_maze_max
            /* isok() test is superfluous here (unless something has
               clobbered the static *_maze_max variables) */
            && isok(x, y) ? 1 : 0);
}

function maze_remove_deadends(typ) { /* void */
    const $frame = stack_frame(); try {
    let dirok = stack_array(char, 4);
    let x, y, dir, idx, idx2, dx, dy, dx2, dy2;

    chars[dirok + 0] = 0; /* lint suppression */
    for (x = 2; x < gx.x_maze_max; x++)
        for (y = 2; y < gy.y_maze_max; y++)
            if (ACCESSIBLE(levl()[x][y].typ) && (x % 2) && (y % 2)) {
                idx = idx2 = 0;
                for (dir = 0; dir < 4; dir++) {
                    /* note: mz_move() is a macro which modifies
                       one of its first two parameters */
                    dx = dx2 = x;
                    dy = dy2 = y;
                    do { switch (dir) { case 0: --(dy); break; case 1: (dx)++; break; case 2: (dy)++; break; case 3: --(dx); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
                    if (!maze_inbounds(dx, dy)) {
                        idx2++;
                        continue;
                    }
                    do { switch (dir) { case 0: --(dy2); break; case 1: (dx2)++; break; case 2: (dy2)++; break; case 3: --(dx2); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
                    do { switch (dir) { case 0: --(dy2); break; case 1: (dx2)++; break; case 2: (dy2)++; break; case 3: --(dx2); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
                    if (!maze_inbounds(dx2, dy2)) {
                        idx2++;
                        continue;
                    }
                    if (!ACCESSIBLE(levl()[dx][dy].typ)
                        && ACCESSIBLE(levl()[dx2][dy2].typ)) {
                        chars[dirok + (idx++)] = dir;
                        idx2++;
                    }
                }
                if (idx2 >= 3 && idx > 0) {
                    dx = x;
                    dy = y;
                    dir = chars[dirok + rn2(idx)];
                    do { switch (dir) { case 0: --(dy); break; case 1: (dx)++; break; case 2: (dy)++; break; case 3: --(dx); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
                    levl()[dx][dy].typ = typ;
                }
            }
    } finally { stack_pop($frame); }
}

/* Create a maze with specified corridor width and wall thickness
 * TODO: rewrite walkfrom so it works on temp space, not levl
 */
export function create_maze(corrwid, wallthick, rmdeadends) { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let mm = stack_struct(struct_nhcoord);
    let tmp_xmax = gx.x_maze_max;
    let tmp_ymax = gy.y_maze_max;
    let rdx = 0;
    let rdy = 0;
    let scale;

    if (corrwid == -1)
        corrwid = rnd(4);

    if (wallthick == -1)
        wallthick = rnd(4) - corrwid;

    if (wallthick < 1)
        wallthick = 1;
    else if (wallthick > 5)
        wallthick = 5;

    if (corrwid < 1)
        corrwid = 1;
    else if (corrwid > 5)
        corrwid = 5;

    scale = corrwid + wallthick;
    rdx = Math.trunc(gx.x_maze_max / scale);
    rdy = Math.trunc(gy.y_maze_max / scale);

    if (svl.level.flags.corrmaze)
        for (x = 2; x < (rdx * 2); x++)
            for (y = 2; y < (rdy * 2); y++)
                levl()[x][y].typ = STONE;
    else
        for (x = 2; x <= (rdx * 2); x++)
            for (y = 2; y <= (rdy * 2); y++)
                levl()[x][y].typ = ((x % 2) && (y % 2)) ? STONE : HWALL;

    /* set upper bounds for maze0xy and walkfrom */
    gx.x_maze_max = (rdx * 2);
    gy.y_maze_max = (rdy * 2);

    /* create maze */
    maze0xy(mm);
    walkfrom(mm.x, mm.y, 0);

    if (rmdeadends)
        maze_remove_deadends(svl.level.flags.corrmaze ? CORR : ROOM);

    /* restore bounds */
    gx.x_maze_max = tmp_xmax;
    gy.y_maze_max = tmp_ymax;

    /* scale maze up if needed */
    if (scale > 2) {
        let tmpmap = stack_array(array_of(char, ROWNO), COLNO);
        let mx, my, dx, dy, rx = 1, ry = 1;

        /* back up the existing smaller maze */
        for (x = 1; x < gx.x_maze_max; x++)
            for (y = 1; y < gy.y_maze_max; y++) {
                chars[tmpmap[x] + y] = levl()[x][y].typ;
            }

        /* do the scaling */
        rx = x = 2;
        while (rx < gx.x_maze_max) {
            mx = (x % 2) ? corrwid : (x == 2 || x == rdx * 2) ? 1 : wallthick;
            ry = y = 2;
            while (ry < gy.y_maze_max) {
                my = (y % 2) ? corrwid
                     : (y == 2 || y == rdy * 2) ? 1
                       : wallthick;
                for (dx = 0; dx < mx; dx++)
                    for (dy = 0; dy < my; dy++) {
                        if (rx + dx >= gx.x_maze_max
                            || ry + dy >= gy.y_maze_max)
                            break;
                        levl()[rx + dx][ry + dy].typ = chars[tmpmap[x] + y];
                    }
                ry += my;
                y++;
            }
            rx += mx;
            x++;
        }
    }
    } finally { stack_pop($frame); }
}

export function pick_vibrasquare_location() { /* void */
    let x, y;
    let stway;
    let trycnt = 0;
    /* these are also defined in mklev.c and they may not be appropriate
       for mazes with corridors wider than 1 or for cavernous levels */

    /*
     * Pick a position where the stairs down to Moloch's Sanctum
     * level will ultimately be created.  At that time, an area
     * will be altered:  walls removed, moat and traps generated,
     * boulders destroyed.  The position picked here must ensure
     * that that invocation area won't extend off the map.
     *
     * We actually allow up to 2 squares around the usual edge of
     * the area to get truncated; see mkinvokearea(mklev.c).
     */

    let x_range = gx.x_maze_max - x_maze_min - 2 * INVPOS_X_MARGIN - 1,
        y_range = gy.y_maze_max - y_maze_min - 2 * INVPOS_Y_MARGIN - 1;

    if (x_range <= INVPOS_X_MARGIN || y_range <= INVPOS_Y_MARGIN
        || (x_range * y_range) <= (INVPOS_DISTANCE * INVPOS_DISTANCE)) {
        debugpline2(_("svi.inv_pos: maze is too small! (%d x %d)"),
                    gx.x_maze_max, gy.y_maze_max, __FILE__);
    }
    svi.inv_pos.x = svi.inv_pos.y = 0; /*{occupied() => invocation_pos()}*/
    do {
        x = rn1(x_range, x_maze_min + INVPOS_X_MARGIN + 1);
        y = rn1(y_range, y_maze_min + INVPOS_Y_MARGIN + 1);
        /* we don't want it to be too near the stairs, nor
           to be on a spot that's already in use (wall|trap) */
        if (++trycnt > 1000)
            break;
    } while (((stway = stairway_find_dir(TRUE)) != null)
             && (x == stway.sx || y == stway.sy /*(direct line)*/
                 || abs(x - stway.sx) == abs(y - stway.sy)
                 || distmin(x, y, stway.sx, stway.sy) <= INVPOS_DISTANCE
                 || !SPACE_POS(levl()[x][y].typ) || occupied(x, y)));
    svi.inv_pos.x = x;
    svi.inv_pos.y = y;
}
export const x_maze_min = 2;
export const INVPOS_X_MARGIN = (6 - 2);
export const y_maze_min = 2;
export const INVPOS_Y_MARGIN = (5 - 2);
export const INVPOS_DISTANCE = 11;

/* add objects and monsters to random maze */
function populate_maze() { /* void */
    const $frame = stack_frame(); try {
    let i;
    let mm = stack_struct(struct_nhcoord);

    for (i = rn1(8, 11); i; i--) {
        mazexy(mm);
        mkobj_at(rn2(2) ? GEM_CLASS : RANDOM_CLASS, mm.x, mm.y, TRUE);
    }
    for (i = rn1(10, 2); i; i--) {
        mazexy(mm);
        mksobj_at(BOULDER, mm.x, mm.y, TRUE, FALSE);
    }
    for (i = rn2(3); i; i--) {
        mazexy(mm);
        makemon(mons[PM_MINOTAUR], mm.x, mm.y, NO_MM_FLAGS);
    }
    for (i = rn1(5, 7); i; i--) {
        mazexy(mm);
        makemon(null, mm.x, mm.y, NO_MM_FLAGS);
    }
    for (i = rn1(6, 7); i; i--) {
        mazexy(mm);
        mkgold(0, mm.x, mm.y);
    }
    for (i = rn1(6, 7); i; i--)
        mktrap(0, MKTRAP_MAZEFLAG, null, null);
    } finally { stack_pop($frame); }
}

export function makemaz(s) { /* void */
    const $frame = stack_frame(); try {
    let protofile = stack_array(char, 20);
    let sp = Is_special(u.uz);
    let mm = stack_struct(struct_nhcoord);

    if (chars[s]) {
        if (sp && sp.rndlevs)
            Snprintf(protofile, sizeof(array_of(char, 20)), _("%s-%d"), s, rnd(sp.rndlevs));
        else
            strcpy(protofile, s)
;
    } else if (chars[(svd.dungeons[u.uz.dnum].proto)]) {
        if (dunlevs_in_dungeon(u.uz) > 1) {
            if (sp && sp.rndlevs)
                Snprintf(protofile, sizeof(array_of(char, 20)), _("%s%d-%d"), svd.dungeons[u.uz.dnum].proto, dunlev(u.uz), rnd(sp.rndlevs));
            else
                Snprintf(protofile, sizeof(array_of(char, 20)), _("%s%d"), svd.dungeons[u.uz.dnum].proto, dunlev(u.uz))

;
        } else if (sp && sp.rndlevs) {
            Snprintf(protofile, sizeof(array_of(char, 20)), _("%s-%d"), svd.dungeons[u.uz.dnum].proto, rnd(sp.rndlevs))

;
        } else
            strcpy(protofile, svd.dungeons[u.uz.dnum].proto);
    } else
        strcpy(protofile, _(""));

    /* SPLEVTYPE format is "level-choice,level-choice"... */
    if (wizard() && chars[protofile] && sp && sp.rndlevs) {
        let ep = getenv(_("SPLEVTYPE")); /* not nh_getenv */

        if (ep) {
            /* strrchr always succeeds due to code in prior block */
            let len = int(((strrchr(protofile, ord('-')) - protofile) + 1));

            while (ep && chars[ep]) {
                if (!strncmp(ep, protofile, unsigned(len))) {
                    let pick = atoi(ep + len);

                    /* use choice only if valid */
                    if (pick > 0 && pick <= sp.rndlevs)
                        sprintf(protofile + len, _("%d"), pick);
                    break;
                } else {
                    ep = strchr(ep, ord(','));
                    if (ep)
                        ++ep;
                }
            }
        }
    }

    if (chars[protofile]) {
        check_ransacked(protofile);
        strcat(protofile, _(LEV_EXT));
        gi.in_mk_themerooms = FALSE;
        if (load_special(protofile)) {
            /* some levels can end up with monsters
               on dead mon list, including light source monsters */
            dmonsfree();
            return; /* no mazification right now */
        }
        impossible(_("Couldn't load \"%s\" - making a maze."), protofile);
    }

    svl.level.flags.is_maze_lev = 1;
    svl.level.flags.corrmaze = +!rn2(3);

    if (!Invocation_lev(u.uz) && rn2(2)) {
        create_maze(-1, -1, +!rn2(5));
    } else {
        create_maze(1, 1, FALSE);
    }

    if (!svl.level.flags.corrmaze)
        wallification(2, 2, gx.x_maze_max, gy.y_maze_max);

    mazexy(mm);
    mkstairs(mm.x, mm.y, 1, null, FALSE); /* up */
    if (!Invocation_lev(u.uz)) {
        mazexy(mm);
        mkstairs(mm.x, mm.y, 0, null, FALSE); /* down */
    } else { /* choose "vibrating square" location */
        pick_vibrasquare_location();
        maketrap(svi.inv_pos.x, svi.inv_pos.y, VIBRATING_SQUARE);
    }

    /* place branch stair or portal */
    place_branch(Is_branchlev(u.uz), 0, 0);

    populate_maze();
    } finally { stack_pop($frame); }
}

/* #ifdef MICRO: not in this build */

export function walkfrom(x, y, typ) { /* void */
    const $frame = stack_frame(); try {
    let q, a, dir;
    let dirs = stack_array(int, 4);

    if (!typ) {
        if (svl.level.flags.corrmaze)
            typ = CORR;
        else
            typ = ROOM;
    }

    if (!IS_DOOR(levl()[x][y].typ)) {
        /* might still be on edge of MAP, so don't overwrite */
        levl()[x][y].typ = typ;
        levl()[x][y].flags = 0;
    }

    while (1) {
        q = 0;
        for (a = 0; a < 4; a++)
            if (okay(x, y, a))
                dirs[q++] = a;
        if (!q)
            return;
        dir = dirs[rn2(q)];
        do { switch (dir) { case 0: --(y); break; case 1: (x)++; break; case 2: (y)++; break; case 3: --(x); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
        levl()[x][y].typ = typ;
        do { switch (dir) { case 0: --(y); break; case 1: (x)++; break; case 2: (y)++; break; case 3: --(x); break; default: panic(_("mz_move: bad direction %d"), dir); } } while (0);
        walkfrom(x, y, typ);
    }
    } finally { stack_pop($frame); }
}

/* find random point in generated corridors,
   so we don't create items in moats, bunkers, or walls */
export function mazexy(cc) { /* void */
    let x, y;
    let allowedtyp = (svl.level.flags.corrmaze ? CORR : ROOM);
    let cpt = 0;

    do {
        /* once upon a time this only considered odd values greater than 2
           and less than N (for N=={x,y}_maze_max) because even values were
           where maze walls always got placed; when wider maze corridors
           were introduced it was changed to 1+rn2(N) which is just an
           obscure way to get rnd(N); probably ought to be using 2+rn2(N-1)
           to exclude the maze's outer boundary walls; trying and rejecting
           those walls will waste some of the 100 random attempts... */
        x = rnd(gx.x_maze_max);
        y = rnd(gy.y_maze_max);
        if (levl()[x][y].typ == allowedtyp) {
            cc.x = x;
            cc.y = y;
            return;
        }
    } while (++cpt < 100);
    /* 100 random attempts failed; systematically try every possibility */
    for (x = 1; x <= gx.x_maze_max; x++)
        for (y = 1; y <= gy.y_maze_max; y++)
            if (levl()[x][y].typ == allowedtyp) {
                cc.x = x;
                cc.y = y;
                return;
            }
    /* every spot on the area of map allowed for mazes has been rejected */
    panic(_("mazexy: can't find a place!"));
    /*NOTREACHED*/
    return;
}

export function get_level_extends(
    left, top,
    right, bottom) { /* void */
    let x, y;
    let typ;
    let lev;
    let found, nonwall;
    let xmin, xmax, ymin, ymax;

    found = nonwall = FALSE;
    for (xmin = 0; !found && xmin <= COLNO; xmin++) {
        lev = ptr_add(levl()[xmin][0], 0);
        for (y = 0; y <= ROWNO - 1; y++, lev = ptr_add(lev, 1)) {
            typ = unsigned(lev.typ);
            if (typ != STONE) {
                found = TRUE;
                if (!IS_WALL(typ))
                    nonwall = TRUE;
            }
        }
    }
    xmin -= (nonwall || !svl.level.flags.is_maze_lev) ? 2 : 1;
    if (xmin < 0)
        xmin = 0;

    found = nonwall = FALSE;
    for (xmax = COLNO - 1; !found && xmax >= 0; xmax--) {
        lev = ptr_add(levl()[xmax][0], 0);
        for (y = 0; y <= ROWNO - 1; y++, lev = ptr_add(lev, 1)) {
            typ = unsigned(lev.typ);
            if (typ != STONE) {
                found = TRUE;
                if (!IS_WALL(typ))
                    nonwall = TRUE;
            }
        }
    }
    xmax += (nonwall || !svl.level.flags.is_maze_lev) ? 2 : 1;
    if (xmax >= COLNO)
        xmax = COLNO - 1;

    found = nonwall = FALSE;
    for (ymin = 0; !found && ymin <= ROWNO; ymin++) {
        lev = ptr_add(levl()[xmin][0], ymin);
        for (x = xmin; x <= xmax; x++, lev = ptr_add(lev, ROWNO)) {
            typ = unsigned(lev.typ);
            if (typ != STONE) {
                found = TRUE;
                if (!IS_WALL(typ))
                    nonwall = TRUE;
            }
        }
    }
    ymin -= (nonwall || !svl.level.flags.is_maze_lev) ? 2 : 1;

    found = nonwall = FALSE;
    for (ymax = ROWNO - 1; !found && ymax >= 0; ymax--) {
        lev = ptr_add(levl()[xmin][0], ymax);
        for (x = xmin; x <= xmax; x++, lev = ptr_add(lev, ROWNO)) {
            typ = unsigned(lev.typ);
            if (typ != STONE) {
                found = TRUE;
                if (!IS_WALL(typ))
                    nonwall = TRUE;
            }
        }
    }
    ymax += (nonwall || !svl.level.flags.is_maze_lev) ? 2 : 1;

    left[0] = xmin;
    right[0] = xmax;
    top[0] = ymin;
    bottom[0] = ymax;
}

/* put a non-diggable/non-phaseable boundary around the initial portion
 * of a level map. assumes that no level will initially put things
 * beyond the isok() range.
 *
 * we can't bound unconditionally on the last line with something in it,
 * because that something might be a niche which was already reachable,
 * so the boundary would be breached
 *
 * we can't bound unconditionally on one beyond the last line, because
 * that provides a window of abuse for wallified special levels
 */
export function bound_digging() { /* void */
    const $frame = stack_frame(); try {
    let x, y;
    let xmin = stack_var(coordxy), xmax = stack_var(coordxy), ymin = stack_var(coordxy), ymax = stack_var(coordxy);

    if (Is_earthlevel(u.uz))
        return; /* everything diggable here */

    get_level_extends(xmin, ymin, xmax, ymax);

    for (x = 0; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            if (IS_STWALL(levl()[x][y].typ)) {
                /* undiggable walls at edges, ... */
                if (y <= ymin[0] || y >= ymax[0] || x <= xmin[0] || x >= xmax[0])
                    levl()[x][y].flags |= W_NONDIGGABLE;
                /* one tile past that, everything is also unphaseable */
                if (y < ymin[0] || y > ymax[0] || x < xmin[0] || x > xmax[0])
                    levl()[x][y].flags |= W_NONPASSWALL;
            }
    } finally { stack_pop($frame); }
}

export function mkportal(x, y, todnum, todlevel) { /* void */
    /* a portal "trap" must be matched by a
       portal in the destination dungeon/dlevel */
    let ttmp = maketrap(x, y, MAGIC_PORTAL);

    if (!ttmp) {
        impossible(_("portal on top of portal?"));
        return;
    }
    do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(_("mkportal: at <%d,%d>, to %s, level %d"), x, y, svd.dungeons[todnum].dname, todlevel); iflags.last_msg = save_plnmsg; } } while (0)
;
    ttmp.dst.dnum = todnum;
    ttmp.dst.dlevel = todlevel;
    return;
}

/* augment the Plane of Fire; called from goto_level() when arriving and
   moveloop_core() when on the level */
export function fumaroles() { /* void */
    let n, nmax = rn2(3);
    let sizemin = 5;
    let snd = FALSE, loud = FALSE;

    if (Is_firelevel(u.uz)) {
        nmax++;
        sizemin += 5;
    }
    if (svl.level.flags.temperature > 0) {
        nmax++;
        sizemin += 5;
    }

    for (n = nmax; n; n--) {
        let x = rn1(COLNO - 4, 3);
        let y = rn1(ROWNO - 4, 3);

        if (levl()[x][y].typ == LAVAPOOL) {
            let r = create_gas_cloud(x, y, rn1(10, sizemin), rn1(10, 5));

            clear_heros_fault(r);
            snd = TRUE;
            if (distu(x, y) < 15)
                loud = TRUE;
        }
    }
    if (snd && !Deaf())
        Norep(_("You hear a %swhoosh!"), loud ? _("loud ") : _(""));  /* Deaf-aware */
}

/*
 * Special waterlevel stuff in endgame (TH).
 *
 * Some of these functions would probably logically belong to some
 * other source files, but they are all so nicely encapsulated here.
 */

/* bubble movement boundaries */
export function gbxmin() { return (svx.xmin + 1); }
export function gbymin() { return (svy.ymin + 1); }
export function gbxmax() { return (svx.xmax - 1); }
export function gbymax() { return (svy.ymax - 1); }

/* the bubble hero is in */
const hero_bubble = static_var("hero_bubble", ptr_to(struct_bubble), null);

/* augment the Planes of Water (for bubbles) and Air (for clouds); called
   from goto_level() when arriving and moveloop_core() when on the level */
export function movebubbles() { /* void */
    let water_pos = static_struct("movebubbles.water_pos", struct_rm, {
        glyph: cmap_b_to_glyph(S_water), typ: WATER, seenv: 0, flags: 0, horizontal: 0, lit: 0, waslit: 0, roomno: 0, edge: 0, candig: 0
    }), air_pos = static_struct("movebubbles.air_pos", struct_rm, {
        glyph: cmap_b_to_glyph(S_cloud), typ: AIR, seenv: 0, flags: 0, horizontal: 0, lit: 1, waslit: 0, roomno: 0, edge: 0, candig: 0
    });
    let up = static_var("movebubbles.up", schar, FALSE);
    let b;
    let cons;
    let btrap;
    let x, y;
    let i, j, bcpin = 0;

    /* set up the portal the first time bubbles are moved */
    if (!gw.wportal)
        set_wportal();

    vision_recalc(2);

    hero_bubble[0] = null;

    if (Is_waterlevel(u.uz)) {
        /* keep attached ball&chain separate from bubble objects */
        if (Punished())
            bcpin = unplacebc_and_covet_placebc();

        /*
         * Pick up everything inside of a bubble then fill all bubble
         * locations.
         */
        for (b = up[0] ? svb.bbubbles : ge.ebubbles; b;
             b = up[0] ? b.next : b.prev) {
            if (b.cons)
                panic(_("movebubbles: cons != null"));
            for (i = 0, x = b.x; i < (uchars[b.bm + 0]); i++, x++)
                for (j = 0, y = b.y; j < (uchars[b.bm + 1]); j++, y++)
                    if (uchars[b.bm + (j + 2)] & (1 << i)) {
                        if (!isok(x, y)) {
                            impossible(_("movebubbles: bad pos (%d,%d)"), x, y);
                            continue;
                        }

                        /* pick up objects, monsters, hero, and traps */
                        if (OBJ_AT(x, y)) {
                            let olist = null, otmp;

                            while ((otmp = svl.level.objects[x][y]) != null) {
                                remove_object(otmp);
                                otmp.ox = otmp.oy = 0;
                                otmp.v.v_nexthere = olist;
                                olist = otmp;
                            }

                            cons = view_of(struct_container, addr_of(alloc(sizeof(struct_container))));
                            cons.x = x;
                            cons.y = y;
                            cons.what = CONS_OBJ;
                            cons.list = addr_of(olist);
                            cons.next = b.cons;
                            b.cons = cons;
                        }
                        if (MON_AT(x, y)) {
                            let mon = m_at(x, y);

                            cons = view_of(struct_container, addr_of(alloc(sizeof(struct_container))));
                            cons.x = x;
                            cons.y = y;
                            cons.what = CONS_MON;
                            cons.list = addr_of(mon);

                            cons.next = b.cons;
                            b.cons = cons;

                            if (mon.wormno)
                                remove_worm(mon);
                            else
                                remove_monster(x, y);

                            newsym(x, y); /* clean up old position */
                            mon.mx = mon.my = 0;
                            mon.mstate = or64(mon.mstate, MON_BUBBLEMOVE);
                        }
                        if (!u.uswallow && u_at(x, y)) {
                            cons = view_of(struct_container, addr_of(alloc(sizeof(struct_container))));
                            cons.x = x;
                            cons.y = y;
                            cons.what = CONS_HERO;
                            cons.list = 0;

                            cons.next = b.cons;
                            b.cons = cons;
                            hero_bubble[0] = b;
                        }
                        if ((btrap = t_at(x, y)) != null) {
                            cons = view_of(struct_container, addr_of(alloc(sizeof(struct_container))));
                            cons.x = x;
                            cons.y = y;
                            cons.what = CONS_TRAP;
                            cons.list = addr_of(btrap);

                            cons.next = b.cons;
                            b.cons = cons;
                        }

                        struct_assign(levl()[x][y], water_pos);
                        block_point(x, y);
                    }
        }
    } else if (Is_airlevel(u.uz)) {
        let xedge, yedge;

        for (x = 1; x <= (COLNO - 1); x++)
            for (y = 0; y <= (ROWNO - 1); y++) {
                struct_assign(levl()[x][y], air_pos);
                recalc_block_point(x, y);
                /* all air or all cloud around the perimeter of the Air
                   level tends to look strange; break up the pattern */
                xedge = (+(x < gbxmin() || x > gbxmax()));
                yedge = (+(y < gbymin() || y > gbymax()));
                if (xedge || yedge) {
                    if (!rn2(xedge ? 3 : 5)) {
                        levl()[x][y].typ = CLOUD;
                        block_point(x, y);
                    }
                }
            }
    }

    /*
     * Every second time traverse down.  This is because otherwise
     * all the junk that changes owners when bubbles overlap
     * would eventually end up in the last bubble in the chain.
     */
    up[0] = +!up[0];
    for (b = up[0] ? svb.bbubbles : ge.ebubbles; b; b = up[0] ? b.next : b.prev) {
        let rx = rn2(3), ry = rn2(3);

        mv_bubble(b, b.dx + 1 - (!b.dx ? rx : (rx ? 1 : 0)),
                  b.dy + 1 - (!b.dy ? ry : (ry ? 1 : 0)), FALSE);
    }

    /* put attached ball&chain back */
    if (Is_waterlevel(u.uz) && Punished())
        lift_covet_and_placebc(bcpin);
    gv.vision_full_recalc = 1;
}

/* when moving in water, possibly (1 in 3) alter the intended destination */
export function water_friction() { /* void */
    let x, y, dx, dy;
    let eff = FALSE;

    if (Swimming() && rn2(4))
        return; /* natural swimmers have advantage */

    if (u.dx && !rn2(!u.dy ? 3 : 6)) { /* 1/3 chance or half that */
        /* cancel delta x and choose an arbitrary delta y value */
        x = u.ux;
        do {
            dy = rn2(3) - 1; /* -1, 0, 1 */
            y = u.uy + dy;
        } while (dy && (!isok(x, y) || !is_pool(x, y)));
        u.dx = 0;
        u.dy = dy;
        eff = TRUE;
    } else if (u.dy && !rn2(!u.dx ? 3 : 5)) { /* 1/3 or 1/5*(5/6) */
        /* cancel delta y and choose an arbitrary delta x value */
        y = u.uy;
        do {
            dx = rn2(3) - 1; /* -1 .. 1 */
            x = u.ux + dx;
        } while (dx && (!isok(x, y) || !is_pool(x, y)));
        u.dy = 0;
        u.dx = dx;
        eff = TRUE;
    }
    if (eff)
        pline(_("Water turbulence affects your movements."));
}

export function save_waterlevel(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let b;

    if (!svb.bbubbles)
        return;

    if (update_file(nhfp)) {
        let n = stack_var(int, 0);
        for (b = svb.bbubbles; b; b = b.next)
            ++n[0];
        Sfo_int(nhfp, n, _("waterlevel-bubble_count"));
        Sfo_int(nhfp, ref_of(svx, "xmin"), _("waterlevel-xmin"));
        Sfo_int(nhfp, ref_of(svy, "ymin"), _("waterlevel-ymin"));
        Sfo_int(nhfp, ref_of(svx, "xmax"), _("waterlevel-xmax"));
        Sfo_int(nhfp, ref_of(svy, "ymax"), _("waterlevel-ymax"));
        for (b = svb.bbubbles; b; b = b.next) {
            Sfo_bubble(nhfp, b, _("waterlevel-bubble"));
        }
    }
    if (release_data(nhfp))
        unsetup_waterlevel();
    } finally { stack_pop($frame); }
}

/* restoring air bubbles on Plane of Water or clouds on Plane of Air */
export function restore_waterlevel(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let b = null, btmp;
    let i, n = stack_var(int, 0);

    sfi_int(nhfp, n, _("waterlevel-bubble_count"));
    sfi_int(nhfp, ref_of(svx, "xmin"), _("waterlevel-xmin"));
    sfi_int(nhfp, ref_of(svy, "ymin"), _("waterlevel-ymin"));
    sfi_int(nhfp, ref_of(svx, "xmax"), _("waterlevel-xmax"));
    sfi_int(nhfp, ref_of(svy, "ymax"), _("waterlevel-ymax"));
    for (i = 0; i < n[0]; i++) {
        btmp = b;
        b = view_of(struct_bubble, addr_of(alloc(sizeof(struct_bubble))));
        Sfi_bubble(nhfp, b, _("waterlevel-bubble"));
        if (btmp) {
            btmp.next = b;
            b.prev = btmp;
        } else {
            svb.bbubbles = b;
            b.prev = null;
        }

        mv_bubble(b, 0, 0, TRUE);
    }

    ge.ebubbles = b;
    if (b) {
        b.next = null;
    } else {
        /* avoid "saving and reloading may fix this" */
        program_state.something_worth_saving = 0;
        /* during restore, information about what level this is might not
           be available so we're wishy-washy about what we describe */
        impossible(_("No %s to restore?"),
                   (Is_waterlevel(u.uz) || Is_waterlevel(gu.uz_save))
                   ? _("air bubbles")
                   : (Is_airlevel(u.uz) || Is_airlevel(gu.uz_save))
                     ? _("clouds")
                     : _("air bubbles or clouds"));
        program_state.something_worth_saving = 1;
    }
    } finally { stack_pop($frame); }
}

function set_wportal() { /* void */
    /* there better be only one magic portal on water level... */
    for (gw.wportal = gf.ftrap; gw.wportal; gw.wportal = gw.wportal.ntrap)
        if (gw.wportal.ttyp == MAGIC_PORTAL)
            return;
    impossible(_("set_wportal(): no portal!"));
}

function setup_waterlevel() { /* void */
    let typ, glyph;
    let x, y, xskip, yskip;

    if (!Is_waterlevel(u.uz) && !Is_airlevel(u.uz))
        panic(_("setup_waterlevel(): [%d:%d] neither 'Water' nor 'Air'"),
              u.uz.dnum, u.uz.dlevel);

    /* ouch, hardcoded... (file scope statics and used in bxmin,bymax,&c) */
    svx.xmin = 3;
    svy.ymin = 1;
    /* use separate statements so that compiler won't complain about min()
       comparing two constants; the alternative is to do this in the
       preprocessor: #if (20 > ROWNO-1) ymax=ROWNO-1 #else ymax=20 #endif */
    svx.xmax = 78;
    svx.xmax = min(svx.xmax, (COLNO - 1) - 1);
    svy.ymax = 20;
    svy.ymax = min(svy.ymax, (ROWNO - 1));

    /* entire level is remembered as one glyph and any unspecified portion
       should default to level's base element rather than to usual stone */
    glyph = cmap_to_glyph(Is_waterlevel(u.uz) ? S_water : S_air);
    typ = Is_waterlevel(u.uz) ? WATER : AIR;

    /* set unspecified terrain (stone) and hero's memory to water or air */
    for (x = 1; x <= COLNO - 1; x++)
        for (y = 0; y <= ROWNO - 1; y++) {
            levl()[x][y].glyph = glyph;
            if (levl()[x][y].typ == STONE)
                levl()[x][y].typ = typ;
        }

    /* make bubbles */
    if (Is_waterlevel(u.uz)) {
        xskip = 10 + rn2(10);
        yskip = 4 + rn2(4);
    } else {
        xskip = 6 + rn2(4);
        yskip = 3 + rn2(3);
    }

    for (x = gbxmin(); x <= gbxmax(); x += xskip)
        for (y = gbymin(); y <= gbymax(); y += yskip)
            mk_bubble(x, y, rn2(7));
}

function unsetup_waterlevel() { /* void */
    let b, bb;

    /* free bubbles */
    for (b = svb.bbubbles; b; b = bb) {
        bb = b.next;
        free(addr_of(b));
    }
    svb.bbubbles = ge.ebubbles = null;
}

function mk_bubble(x, y, n) { /* void */
    /*
     * These bit masks make visually pleasing bubbles on a normal aspect
     * 25x80 terminal, which naturally results in them being mathematically
     * anything but symmetric.  For this reason they cannot be computed
     * in situ, either.  The first two elements tell the dimensions of
     * the bubble's bounding box.
     */
    let bm2 = static_array("mk_bubble.bm2", uchar, null, [ 2, 1, 0x3 ]),
        bm3 = static_array("mk_bubble.bm3", uchar, null, [ 3, 2, 0x7, 0x7 ]),
        bm4 = static_array("mk_bubble.bm4", uchar, null, [ 4, 3, 0x6, 0xf, 0x6 ]),
        bm5 = static_array("mk_bubble.bm5", uchar, null, [ 5, 3, 0xe, 0x1f, 0xe ]),
        bm6 = static_array("mk_bubble.bm6", uchar, null, [ 6, 4, 0x1e, 0x3f, 0x3f, 0x1e ]),
        bm7 = static_array("mk_bubble.bm7", uchar, null, [ 7, 4, 0x3e, 0x7f, 0x7f, 0x3e ]),
        bm8 = static_array("mk_bubble.bm8", uchar, null, [ 8, 4, 0x7e, 0xff, 0xff, 0x7e ]),
        bmask = static_array("mk_bubble.bmask", ptr_to(uchar), null, [ bm2, bm3, bm4, bm5, bm6, bm7, bm8 ]);

    let b;

    if (x >= gbxmax() || y >= gbymax())
        return;
    if (n >= SIZE(bmask)) {
        impossible(_("n too large (mk_bubble)"));
        n = SIZE(bmask) - 1;
    }
    if (uchars[bmask[n] + 1] > MAX_BMASK) {
        panic(_("bmask size is larger than MAX_BMASK"));
    }
    b = view_of(struct_bubble, addr_of(alloc(sizeof(struct_bubble))));
    if ((x + (uchars[bmask[n] + 0]) - 1) > gbxmax())
        x = gbxmax() - uchars[bmask[n] + 0] + 1;
    if ((y + (uchars[bmask[n] + 1]) - 1) > gbymax())
        y = gbymax() - uchars[bmask[n] + 1] + 1;
    b.x = x;
    b.y = y;
    b.dx = 1 - rn2(3);
    b.dy = 1 - rn2(3);
    /* y dimension is the length of bitmap data - see bmask above */
    memcpy(b.bm, (bmask[n]),
                  (uchars[bmask[n] + 1] + 2) * sizeof(uchar));
    b.cons = null;
    if (!svb.bbubbles)
        svb.bbubbles = b;
    if (ge.ebubbles) {
        ge.ebubbles.next = b;
        b.prev = ge.ebubbles;
    } else
        b.prev = null;
    b.next = null;
    ge.ebubbles = b;
    mv_bubble(b, 0, 0, TRUE);
}

/* maybe change the movement direction of the bubble hero is in */
export function maybe_adjust_hero_bubble() { /* void */
    if (!Is_waterlevel(u.uz))
        return;

    if (!u.dx && !u.dy)
        return;

    if (hero_bubble[0] && !rn2(2)) {
        hero_bubble[0].dx = u.dx;
        hero_bubble[0].dy = u.dy;
    }
}

/*
 * The player, the portal and all other objects and monsters
 * float along with their associated bubbles.  Bubbles may overlap
 * freely, and the contents may get associated with other bubbles in
 * the process.  Bubbles are "sticky", meaning that if the player is
 * in the immediate neighborhood of one, he/she may get sucked inside.
 * This property also makes leaving a bubble slightly difficult.
 */
function mv_bubble(b, dx, dy, ini) { /* void */
    let i, j, colli = 0;
    let x, y;
    let cons, ctemp;

    /* clouds move slowly */
    if (!Is_airlevel(u.uz) || !rn2(6)) {
        /* move bubble */
        if (dx < -1 || dx > 1 || dy < -1 || dy > 1) {
            /* pline("mv_bubble: dx = %d, dy = %d", dx, dy); */
            dx = sgn(dx);
            dy = sgn(dy);
        }

        /*
         * collision with level borders?
         *      1 = horizontal border, 2 = vertical, 3 = corner
         */
        if (b.x <= gbxmin())
            colli |= 2;
        if (b.y <= gbymin())
            colli |= 1;
        if ((b.x + uchars[b.bm + 0] - 1) >= gbxmax())
            colli |= 2;
        if ((b.y + uchars[b.bm + 1] - 1) >= gbymax())
            colli |= 1;

        if (b.x < gbxmin()) {
            pline(_("bubble xmin: x = %d, xmin = %d"), b.x, gbxmin());
            b.x = gbxmin();
        }
        if (b.y < gbymin()) {
            pline(_("bubble ymin: y = %d, ymin = %d"), b.y, gbymin());
            b.y = gbymin();
        }
        if ((b.x + uchars[b.bm + 0] - 1) > gbxmax()) {
            pline(_("bubble xmax: x = %d, xmax = %d"), b.x + uchars[b.bm + 0] - 1,
                  gbxmax());
            b.x = gbxmax() - uchars[b.bm + 0] + 1;
        }
        if ((b.y + uchars[b.bm + 1] - 1) > gbymax()) {
            pline(_("bubble ymax: y = %d, ymax = %d"), b.y + uchars[b.bm + 1] - 1,
                  gbymax());
            b.y = gbymax() - uchars[b.bm + 1] + 1;
        }

        /* bounce if we're trying to move off the border */
        if (b.x == gbxmin() && dx < 0)
            dx = -dx;
        if (b.x + uchars[b.bm + 0] - 1 == gbxmax() && dx > 0)
            dx = -dx;
        if (b.y == gbymin() && dy < 0)
            dy = -dy;
        if (b.y + uchars[b.bm + 1] - 1 == gbymax() && dy > 0)
            dy = -dy;

        b.x += dx;
        b.y += dy;
    }

    /* draw the bubbles */
    for (i = 0, x = b.x; i < (uchars[b.bm + 0]); i++, x++)
        for (j = 0, y = b.y; j < (uchars[b.bm + 1]); j++, y++)
            if (uchars[b.bm + (j + 2)] & (1 << i)) {
                if (Is_waterlevel(u.uz)) {
                    levl()[x][y].typ = AIR;
                    levl()[x][y].lit = 1;
                    unblock_point(x, y);
                } else if (Is_airlevel(u.uz)) {
                    levl()[x][y].typ = CLOUD;
                    levl()[x][y].lit = 1;
                    block_point(x, y);
                }
            }

    if (Is_waterlevel(u.uz)) {
        /* replace contents of bubble */
        for (cons = b.cons; cons; cons = ctemp) {
            ctemp = cons.next;
            cons.x += dx;
            cons.y += dy;

            switch (cons.what) {
            case CONS_OBJ: {
                let olist, otmp;

                for (olist = view_of(struct_obj, cons.list); olist; olist = otmp) {
                    otmp = olist.v.v_nexthere;
                    place_object(olist, cons.x, cons.y);
                    stackobj(olist);
                }
                break;
            }

            case CONS_MON: {
                let mon = view_of(struct_monst, cons.list);

                /* mnearto() might fail. We can jump right to elemental_clog
                   from here rather than deal_with_overcrowding() */
                if (!mnearto(mon, cons.x, cons.y, TRUE, RLOC_NOMSG))
                    elemental_clog(mon);
                break;
            }

            case CONS_HERO: {
                let mtmp = m_at(cons.x, cons.y);
                let ux0 = u.ux, uy0 = u.uy;

                u_on_newpos(cons.x, cons.y);
                newsym(ux0, uy0); /* clean up old position */

                if (mtmp) {
                    mnexto(mtmp, RLOC_NOMSG);
                }
                break;
            }

            case CONS_TRAP: {
                let btrap = view_of(struct_trap, cons.list);

                btrap.tx = cons.x;
                btrap.ty = cons.y;
                break;
            }

            default:
                impossible(_("mv_bubble: unknown bubble contents"));
                break;
            }
            free(addr_of(cons));
        }
        b.cons = null;
    }

    /* boing? */
    switch (colli) {
    case 1:
        b.dy = -b.dy;
        break;
    case 3:
        b.dy = -b.dy;
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case 2:
        b.dx = -b.dx;
        break;
    default:
        /* sometimes alter direction for fun anyway
           (higher probability for stationary bubbles) */
        if (!ini && ((b.dx || b.dy) ? !rn2(20) : !rn2(5))) {
            b.dx = 1 - rn2(3);
            b.dy = 1 - rn2(3);
        }
    }
}

/*mkmaze.c*/

import { struct_nhcoord } from "./coord.h.js";
import {
    FOOD_CLASS, GEM_CLASS, RANDOM_CLASS, RING_CLASS, S_air, S_cloud, S_water,
} from "./defsym.h.js";
import { cmap_b_to_glyph, cmap_to_glyph } from "./display.h.macros.js";
import {
    LR_BRANCH, LR_DOWNSTAIR, LR_DOWNTELE, LR_PORTAL, LR_TELE, LR_UPSTAIR, LR_UPTELE, MIGR_LEFTOVERS,
    MIGR_RANDOM, struct_d_level,
} from "./dungeon.h.js";
import {
    Is_airlevel, Is_earthlevel, Is_firelevel, Is_medusa_level, Is_stronghold, Is_waterlevel,
    within_bounded_area,
} from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { BUFSZ, COLNO, FALSE, LEV_EXT, ROWNO, TRUE, coordxy } from "./global.h.js";
import { Strlen } from "./global.h.macros.js";
import {
    CONS_HERO, CONS_MON, CONS_OBJ, CONS_TRAP, CORPSTAT_NONE, MAX_BMASK, MKTRAP_MAZEFLAG, MM_NONAME,
    NO_MM_FLAGS, RLOC_ERR, RLOC_NOMSG, struct_bubble, struct_container,
} from "./hack.h.js";
import {
    ROLL_FROM, distu, max, min, mines_dnum, release_data, rn1, update_file,
} from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { debugpline2, showdebug } from "./lint.h.macros.js";
import { has_mgivenname } from "./mextra.h.macros.js";
import { is_orc, pm_resistance } from "./mondata.h.macros.js";
import { M2_ORC, MR_STONE } from "./monflag.h.js";
import { MON_BUBBLEMOVE, struct_monst } from "./monst.h.js";
import { DEADMONSTER } from "./monst.h.macros.js";
import { PM_CLERIC, PM_MINOTAUR, PM_ORC, PM_ORC_CAPTAIN, PM_ORC_SHAMAN } from "./monsters.h.js";
import { struct_obj } from "./obj.h.js";
import { ONAME } from "./obj.h.macros.js";
import {
    BOULDER, CORPSE, C_RATION, EGG, GAUNTLETS_OF_DEXTERITY, GOLD_PIECE, K_RATION, LEATHER_GLOVES,
    LEMBAS_WAFER, LONG_SWORD, ROCK, SILVER_SABER, SKELETON_KEY, SLIME_MOLD, STATUE, STRANGE_OBJECT,
    TALLOW_CANDLE, TIN, TRIPE_RATION, WAX_CANDLE,
} from "./objects.h.js";
import { clear_heros_fault } from "./region.h.macros.js";
import {
    AIR, BLCORNER, BRCORNER, CLOUD, CORR, CROSSWALL, DBWALL, HWALL, ICE, IRONBARS, LAVAPOOL,
    LAVAWALL, MAX_TYPE, POOL, ROOM, SDOOR, SET_LIT_NOCHANGE, SET_LIT_RANDOM, STONE, TDWALL,
    TLCORNER, TLWALL, TRCORNER, TRWALL, TUWALL, VWALL, WATER, W_NONDIGGABLE, W_NONPASSWALL,
    struct_rm,
} from "./rm.h.js";
import {
    ACCESSIBLE, CAN_OVERWRITE_TERRAIN, IS_DOOR, IS_FOUNTAIN, IS_LAVA, IS_SINK, IS_STWALL, IS_WALL,
    MON_AT, OBJ_AT, SPACE_POS, fmon, levl, m_at, remove_monster,
} from "./rm.h.macros.js";
import { Sfi_bubble, Sfo_bubble, Sfo_int } from "./savefile.h.macros.js";
import { MELT_ICE_AWAY } from "./timeout.h.js";
import { MAGIC_PORTAL, VIBRATING_SQUARE, struct_trap } from "./trap.h.js";
import { undestroyable_trap } from "./trap.h.macros.js";
import { Role_if, u_at } from "./you.h.macros.js";
import { Deaf, Punished, Swimming } from "./youprop.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, schar, short, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { and64, or64 } from "../rt/int64.js";
import {
    abs, atoi, free, getenv, memcpy, sprintf, strcat, strchr, strcmp, strcpy, strncmp, strrchr,
} from "../rt/libc.js";
import {
    stack_array, stack_struct, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, ref_of, struct_assign, view_of,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { lift_covet_and_placebc, unplacebc_and_covet_placebc } from "./ball.js";
import { isok } from "./cmd.js";
import { is_ice, is_pool } from "./dbridge.js";
import {
    gb, ge, gf, gi, gl, gn, gr, gu, gv, gw, gx, gy, iflags, program_state, svb, svd, sve, svi, svl,
    svn, svr, svu, svx, svy, u,
} from "./decl.js";
import { newsym } from "./display.js";
import { christen_monst, christen_orc, new_oname, rndorcname } from "./do_name.js";
import { migrate_to_level } from "./dog.js";
import {
    In_quest, Invocation_lev, Is_branchlev, Is_special, depth, dunlev, dunlevs_in_dungeon,
    find_level, get_level, ledger_no, on_level, u_on_newpos,
} from "./dungeon.js";
import { panic } from "./end.js";
import { distmin, sgn, upstart } from "./hacklib.js";
import { stackobj } from "./invent.js";
import { makemon, set_malign } from "./makemon.js";
import { count_level_features, mkstairs, mktrap, occupied, place_branch } from "./mklev.js";
import {
    add_to_minv, dealloc_obj, mk_tt_object, mkcorpstat, mkgold, mkobj, mkobj_at, mksobj, mksobj_at,
    mksobj_migr_to_species, obj_ice_effects, place_object, remove_object, rndmonnum, set_corpsenm,
    weight,
} from "./mkobj.js";
import { somex, somey } from "./mkroom.js";
import { dmonsfree, elemental_clog, m_into_limbo, mnearto, mnexto } from "./mon.js";
import { poly_when_stoned } from "./mondata.js";
import { mons } from "./monst.js";
import { objects } from "./objects.js";
import { shiny_obj } from "./objnam.js";
import { fruitadd } from "./options.js";
import { Norep, impossible, pline } from "./pline.js";
import { create_gas_cloud } from "./region.js";
import { rn2, rnd } from "./rnd.js";
import { sfi_int } from "./sfbase.js";
import { load_special } from "./sp_lev.js";
import { stairway_find_dir } from "./stairs.js";
import { goodpos, rloc } from "./teleport.js";
import { spot_stop_timers } from "./timeout.js";
import { deltrap, maketrap, t_at } from "./trap.js";
import { block_point, recalc_block_point, unblock_point, vision_recalc } from "./vision.js";
import { remove_worm } from "./worm.js";
const __FILE__ = "mkmaze.c";
