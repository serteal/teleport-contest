/* NetHack 5.0	vision.c	$NHDT-Date: 1777205478 2026/04/26 04:11:18 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.75 $ */
/* Copyright (c) Dean Luick, with acknowledgements to Dave Cohrs, 1990. */
/* NetHack may be freely redistributed.  See license for details.       */

/* Circles
 * ==================================================================*/

/*
 * These numbers are limit offsets for one quadrant of a circle of a given
 * radius (the first number of each line) from the source.  The number in
 * the comment is the element number (so pointers can be set up).  Each
 * "circle" has as many elements as its radius+1.  The radius is the number
 * of points away from the source that the limit exists.  The radius of the
 * offset on the same row as the source *is* included so we don't have to
 * make an extra check.  For example, a circle of radius 4 has offsets:
 *
 *              XXX     +2
 *              ...X    +3
 *              ....X   +4
 *              ....X   +4
 *              @...X   +4
 *
 * Externally referenced from light.c
*/
export const circle_data = static_array("circle_data", short, null, [
    /*  0*/ 0,
    /*  1*/ 1,  1,
    /*  3*/ 2,  2,  1,
    /*  6*/ 3,  3,  2,  1,
    /* 10*/ 4,  4,  4,  3,  2,
    /* 15*/ 5,  5,  5,  4,  3,  2,
    /* 21*/ 6,  6,  6,  5,  5,  4,  2,
    /* 28*/ 7,  7,  7,  6,  6,  5,  4,  2,
    /* 36*/ 8,  8,  8,  7,  7,  6,  6,  4,  2,
    /* 45*/ 9,  9,  9,  9,  8,  8,  7,  6,  5,  3,
    /* 55*/ 10, 10, 10, 10, 9,  9,  8,  7,  6,  5,  3,
    /* 66*/ 11, 11, 11, 11, 10, 10, 9,  9,  8,  7,  5,  3,
    /* 78*/ 12, 12, 12, 12, 11, 11, 10, 10, 9,  8,  7,  5,  3,
    /* 91*/ 13, 13, 13, 13, 12, 12, 12, 11, 10, 10, 9,  7,  6, 3,
    /*105*/ 14, 14, 14, 14, 13, 13, 13, 12, 12, 11, 10, 9,  8, 6, 3,
    /*120*/ 15, 15, 15, 15, 14, 14, 14, 13, 13, 12, 11, 10, 9, 8, 6, 3,
    /*136*/ 16 /* MAX_RADIUS+1; used to terminate range loops -dlc */
]);

/*
 * These are the starting indexes into the circle_data[] array for a
 * circle of a given radius.  Radius 0 used to be unused, but is now
 * used for a single point:  temporary light source of a camera flash
 * as it traverses its path.
 */
export const circle_start = static_array("circle_start", short, null, [
    /* 0*/ 0,
    /* 1*/ 1,
    /* 2*/ 3,
    /* 3*/ 6,
    /* 4*/ 10,
    /* 5*/ 15,
    /* 6*/ 21,
    /* 7*/ 28,
    /* 8*/ 36,
    /* 9*/ 45,
    /*10*/ 55,
    /*11*/ 66,
    /*12*/ 78,
    /*13*/ 91,
    /*14*/ 105,
    /*15*/ 120,
]);

/*==========================================================================*/
/* Vision (arbitrary line of sight)
 * =========================================*/

/*------ local variables ------*/

const could_see = static_array("could_see", array_of(array_of(uchar, COLNO), ROWNO), 2); /* vision work space */
const cs_rows0 = static_array("cs_rows0", ptr_to(uchar), ROWNO); const cs_rows1 = static_array("cs_rows1", ptr_to(uchar), ROWNO);
const cs_rmin0 = static_array("cs_rmin0", short, ROWNO); const cs_rmax0 = static_array("cs_rmax0", short, ROWNO);
const cs_rmin1 = static_array("cs_rmin1", short, ROWNO); const cs_rmax1 = static_array("cs_rmax1", short, ROWNO);

const viz_clear = static_array("viz_clear", array_of(char, COLNO), ROWNO); /* vision clear/blocked map */
const viz_clear_rows = static_array("viz_clear_rows", ptr_to(char), ROWNO);

const left_ptrs = static_array("left_ptrs", array_of(short, COLNO), ROWNO); /* LOS algorithm helpers */
const right_ptrs = static_array("right_ptrs", array_of(short, COLNO), ROWNO);

/* Forward declarations. */

/* Macro definitions that I can't find anywhere. */
export function sign(z) { return (z < 0 ? -1 : (z ? 1 : 0)); }
export function v_abs(z) { return (z < 0 ? -z : z); }

/* expose viz_clear[][] for sanity checking */
export function get_viz_clear(x, y) { /* boolean */
    if (isok(x,y) && !chars[viz_clear[y] + x])
        return TRUE;
    return FALSE;
}

/*
 * vision_init()
 *
 * The one-time vision initialization routine.
 *
 * This must be called before mklev() is called in newgame() [allmain.c],
 * or before a game restore.   Else we die a horrible death.
 */
export function vision_init() { /* void */
    let i;

    /* Set up the pointers. */
    for (i = 0; i < ROWNO; i++) {
        cs_rows0[i] = could_see[0][i];
        cs_rows1[i] = could_see[1][i];
        viz_clear_rows[i] = viz_clear[i];
    }

    /* Start out with cs0 as our current array */
    gv.viz_array = cs_rows0;
    gv.viz_rmin = cs_rmin0;
    gv.viz_rmax = cs_rmax0;

    gv.vision_full_recalc = 0;
    memset(addr_of(could_see), 0, sizeof(array_of(array_of(array_of(uchar, COLNO), ROWNO), 2)));

    /* Initialize the vision algorithm (currently C). */
    view_init();
}

/*
 * does_block()
 *
 * Returns 0 if nothing at (x,y) blocks sight, 1 if anything other than
 * an opaque region (gas cloud rather than CLOUD terrain) blocks sight,
 * or 2 if an opaque region blocks sight.  [At present, the rest of the
 * code makes no distinction between 1 and 2, just between 0 and non-0.]
 */
export function does_block(x, y, lev) { /* int */
    let obj;
    let mon;

    /* set DEBUGFILES=seethru in environment to see through bubbles */
    if (gs.seethru == 0) { /* init once */
        gs.seethru = (wizard() && explicitdebug(_("seethru"))) ? 1 : -1;
    }

    /* Features that block . . */
    if (IS_OBSTRUCTED(lev.typ) || lev.typ == TREE
        || (IS_DOOR(lev.typ)
            && (lev.flags & (D_CLOSED | D_LOCKED | D_TRAPPED))))
        return 1;

    if (gs.seethru != 1) {
    if (lev.typ == CLOUD || IS_WATERWALL(lev.typ) || lev.typ == LAVAWALL
        || (Underwater() && is_moat(x, y)))
        return 1;
    } /* gs.seethru */

    /* Boulders block light. */
    for (obj = svl.level.objects[x][y]; obj; obj = obj.v.v_nexthere)
        if (obj.otyp == BOULDER)
            return 1;

    /* Mimics mimicking a door or boulder or ... block light. */
    if ((mon = m_at(x, y)) && (!mon.minvis || See_invisible())
        && is_lightblocker_mappear(mon))
        return 1;

    if (gs.seethru != 1) {
    /* Clouds (poisonous or not) block light. */
    if (visible_region_at(x, y))
        return 2;
    } /* gs.seethru */

    return 0;
}

/*
 * vision_reset()
 *
 * This must be called *after* the levl[][] structure is set with the new
 * level and the level monsters and objects are in place.
 */
export function vision_reset() { /* void */
    let y;
    let x, i, dig_left, block;
    let lev;

    /* Start out with cs0 as our current array */
    gv.viz_array = cs_rows0;
    gv.viz_rmin = cs_rmin0;
    gv.viz_rmax = cs_rmax0;

    memset(addr_of(could_see), 0, sizeof(array_of(array_of(array_of(uchar, COLNO), ROWNO), 2)));

    /* Reset the pointers and clear so that we have a "full" dungeon. */
    memset(addr_of(viz_clear), 0, sizeof(array_of(array_of(char, COLNO), ROWNO)));

    /* Dig the level */
    for (y = 0; y < ROWNO; y++) {
        dig_left = 0;
        block = TRUE; /* location (0,y) is always stone; it's !isok() */
        lev = ptr_add(levl()[1][0], y);
        for (x = 1; x < COLNO; x++, lev = ptr_add(lev, ROWNO))
            if (block != (IS_OBSTRUCTED(lev.typ) || does_block(x, y, lev) ? 1 : 0)) {
                if (block) {
                    for (i = dig_left; i < x; i++) {
                        left_ptrs[y][i] = dig_left;
                        right_ptrs[y][i] = x - 1;
                    }
                } else {
                    i = dig_left;
                    if (dig_left)
                        dig_left--; /* point at first blocked point */
                    for (; i < x; i++) {
                        left_ptrs[y][i] = dig_left;
                        right_ptrs[y][i] = x;
                        chars[viz_clear[y] + i] = 1;
                    }
                }
                dig_left = x;
                block = +!block;
            }
        /* handle right boundary; almost identical for blocked/unblocked */
        i = dig_left;
        if (!block && dig_left)
            dig_left--; /* point at first blocked point */
        for (; i < COLNO; i++) {
            left_ptrs[y][i] = dig_left;
            right_ptrs[y][i] = (COLNO - 1);
            chars[viz_clear[y] + i] = +!block;
        }
    }

    iflags.vision_inited = TRUE; /* vision is ready */
    gv.vision_full_recalc = 1;   /* we want to run vision_recalc() */
}

/*
 * get_unused_cs()
 *
 * Called from vision_recalc() and at least one light routine.  Get pointers
 * to the unused vision work area.
 */
function get_unused_cs(rows, rmin, rmax) { /* void */
    let row;
    let nrmin, nrmax;

    if ((addr_of(gv.viz_array) == addr_of(cs_rows0))) {
        rows[0] = cs_rows1;
        rmin[0] = cs_rmin1;
        rmax[0] = cs_rmax1;
    } else {
        rows[0] = cs_rows0;
        rmin[0] = cs_rmin0;
        rmax[0] = cs_rmax0;
    }

    /* return an initialized, unused work area */
    nrmin = rmin[0];
    nrmax = rmax[0];

    memset(((rows[0])[0]), 0,
                  ROWNO * COLNO * sizeof(uchar)); /* see nothing */
    for (row = 0; row < ROWNO; row++) { /* set row min & max */
        (nrmin = ref_add(nrmin, 1), ref_add(nrmin, -1))[0] = COLNO - 1;
        (nrmax = ref_add(nrmax, 1), ref_add(nrmax, -1))[0] = 1;
    }
}

/*
 * rogue_vision()
 *
 * Set the "could see" and in sight bits so vision acts just like the old
 * rogue game:
 *
 *      + If in a room, the hero can see to the room boundaries.
 *      + The hero can always see adjacent squares.
 *
 * We set the in_sight bit here as well to escape a bug that shows up
 * due to the one-sided lit wall hack.
 */
function rogue_vision(next, rmin, rmax) { /* void */
    let rnum = levl()[u.ux][u.uy].roomno - ROOMOFFSET; /* no SHARED... */
    let start, stop, in_door, xhi, xlo, yhi, ylo;
    let zx, zy;

    /* If in a lit room, we are able to see to its boundaries. */
    /* If dark, set COULD_SEE so various spells work -dlc */
    if (rnum >= 0) {
        for (zy = svr.rooms[rnum].ly - 1; zy <= svr.rooms[rnum].hy + 1; zy++) {
            rmin[zy] = start = svr.rooms[rnum].lx - 1;
            rmax[zy] = stop = svr.rooms[rnum].hx + 1;

            for (zx = start; zx <= stop; zx++) {
                if (svr.rooms[rnum].rlit) {
                    uchars[next[zy] + zx] = COULD_SEE | IN_SIGHT;
                    levl()[zx][zy].seenv = SVALL; /* see the walls */
                } else
                    uchars[next[zy] + zx] = COULD_SEE;
            }
        }
    }

    in_door = +(levl()[u.ux][u.uy].typ == DOOR);

    /* Can always see adjacent. */
    ylo = max(u.uy - 1, 0);
    yhi = min(u.uy + 1, ROWNO - 1);
    xlo = max(u.ux - 1, 1);
    xhi = min(u.ux + 1, COLNO - 1);
    for (zy = ylo; zy <= yhi; zy++) {
        if (xlo < rmin[zy])
            rmin[zy] = xlo;
        if (xhi > rmax[zy])
            rmax[zy] = xhi;

        for (zx = xlo; zx <= xhi; zx++) {
            uchars[next[zy] + zx] = COULD_SEE | IN_SIGHT;
            /*
             * Yuck, update adjacent non-diagonal positions when in a doorway.
             * We need to do this to catch the case when we first step into
             * a room.  The room's walls were not seen from the outside, but
             * now are seen (the seen bits are set just above).  However, the
             * positions are not updated because they were already in sight.
             * So, we have to do it here.
             */
            if (in_door && (zx == u.ux || zy == u.uy))
                newsym(zx, zy);
        }
    }
}

/*#define EXTEND_SPINE*/ /* possibly better looking wall-angle */

/* #ifdef EXTEND_SPINE: not in this build */

/*
 * new_angle()
 *
 * Return the new angle seen by the hero for this location.  The angle
 * bit is given in the value pointed at by sv.
 *
 * The other parameters are not used.
 */

/*
 * vision_recalc()
 *
 * Do all of the heavy vision work.  Recalculate all locations that could
 * possibly be seen by the hero --- if the location were lit, etc.  Note
 * which locations are actually seen because of lighting.  Then add to
 * this all locations that be seen by hero due to night vision and x-ray
 * vision.  Finally, compare with what the hero was able to see previously.
 * Update the difference.
 *
 * This function is usually called only when the variable 'vision_full_recalc'
 * is set.  The following is a list of places where this function is called,
 * with three valid values for the control flag parameter:
 *
 * Control flag = 0.  A complete vision recalculation.  Generate the vision
 * tables from scratch.  This is necessary to correctly set what the hero
 * can see.  (1) and (2) call this routine for synchronization purposes, (3)
 * calls this routine so it can operate correctly.
 *
 *      + After the monster move, before input from the player. [moveloop()]
 *      + At end of moveloop. [moveloop() ??? not sure why this is here]
 *      + Right before something is printed. [pline()]
 *      + Right before we do a vision-based operation. [do_clear_area()]
 *      + screen redraw, so we can renew all positions in sight. [docrt()]
 *      + When toggling temporary blindness, in case additional events
 *        impacted by vision occur during the same move [make_blinded()]
 *
 * Control flag = 1.  An adjacent vision recalculation.  The hero has moved
 * one square.  Knowing this, it might be possible to optimize the vision
 * recalculation using the current knowledge.  This is presently unimplemented
 * and is treated as a control = 0 call.
 *
 *      + Right after the hero moves. [domove()]
 *
 * Control flag = 2.  Turn off the vision system.  Nothing new will be
 * displayed, since nothing is seen.  This is usually done when you need
 * a newsym() run on all locations in sight, or on some locations but you
 * don't know which ones.
 *
 *      + Before a screen redraw, so all positions are renewed. [docrt()]
 *      + Right before the hero arrives on a new level. [goto_level()]
 *      + Right after a scroll of light is read. [litroom()]
 *      + After an option has changed that affects vision [parseoptions()]
 *      + Right after the hero is swallowed. [gulpmu()]
 *      + Just before bubbles are moved. [movebubbles()]
 */
export function vision_recalc(control) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var colbump = static_array("vision_recalc.colbump", short, COLNO + 1), next_array = stack_var(ptr_to(ptr_to(uchar))), next_rmin = stack_var(ptr_to(short)), next_rmax = stack_var(ptr_to(short));
     /* from display.c */
     /* cols to bump sv */
    var temp_array; /* points to the old vision array */
     /* points to the new vision array */
    var next_row;    /* row pointer for the new array */
    var old_row;     /* row pointer for the old array */
     /* min pointer for the new array */
     /* max pointer for the new array */
    var ranges; /* circle ranges -- used for xray & night vision */
    var row = 0;       /* row counter (outer loop)  */
    var start, stop;   /* inner loop starting/stopping index */
    var dx, dy;        /* one step from a lit door or lit wall (see below) */
    var col;  /* inner loop counter */
    var lev; /* pointer to current pos */
    var flev;   /* pointer to position in "front" of current pos */
    var sv;   /* ptr to seen angle bits */
    var oldseenv;      /* previous seenv value */

    gv.vision_full_recalc = 0; /* reset flag */
    if (gi.in_mklev || program_state.in_getlev || !iflags.vision_inited)
        return;

    /*
     * Either the light sources have been taken care of, or we must
     * recalculate them here.
     */

    /* Get the unused could see, row min, and row max arrays. */
    get_unused_cs(next_array, next_rmin, next_rmax);

    /* You see nothing, nothing can see you --- if swallowed or refreshing. */
    skip: { if (u.uswallow || control == 2) {
        /* do nothing -- get_unused_cs() nulls out the new work area */
        ;
    } else if (Blind()) {
        /*
         * Calculate the could_see array even when blind so that monsters
         * can see you, even if you can't see them.  Note that the current
         * setup allows:
         *
         *      + Monsters to see with the "new" vision, even on the rogue
         *        level.
         *      + Monsters can see you even when you're in a pit.
         */
        view_from(u.uy, u.ux, next_array[0], next_rmin[0], next_rmax[0], 0,
                  null,
                  0);

        /*
         * Our own version of the update loop below.  We know we can't see
         * anything, so we only need to update positions we used to be able
         * to see.
         */
        temp_array = gv.viz_array; /* set gv.viz_array so newsym() will work */
        gv.viz_array = next_array[0];

        for (row = 0; row < ROWNO; row++) {
            old_row = temp_array[row];

            /* Find the min and max positions on the row. */
            start = min(gv.viz_rmin[row], next_rmin[0][row]);
            stop = max(gv.viz_rmax[row], next_rmax[0][row]);

            for (col = start; col <= stop; col++)
                if (uchars[old_row + col] & IN_SIGHT)
                    newsym(col, row);
        }

        /* skip the normal update loop */
        break skip;
    } else if (Is_rogue_level(u.uz)) {
        rogue_vision(next_array[0], next_rmin[0], next_rmax[0]);
    } else {
        var lo_col, has_night_vision = 1; /* hero has night vision */

        if (Underwater() && !Is_waterlevel(u.uz)) {
            /*
             * The hero is underwater.  Only see surrounding locations if
             * they are also underwater.  This overrides night vision but
             * does not override x-ray vision.
             */
            has_night_vision = 0;

            lo_col = max(u.ux - 1, 1);
            for (row = u.uy - 1; row <= u.uy + 1; row++)
                for (col = lo_col; col <= u.ux + 1; col++) {
                    if (!isok(col, row) || !is_pool(col, row))
                        continue;

                    next_rmin[0][row] = min(next_rmin[0][row], col);
                    next_rmax[0][row] = max(next_rmax[0][row], col);
                    uchars[next_array[0][row] + col] = IN_SIGHT | COULD_SEE;
                }

        /* if in a pit, just update for immediate locations */
        } else if (u.utrap && u.utraptype == TT_PIT) {
            for (row = u.uy - 1; row <= u.uy + 1; row++) {
                if (row < 0)
                    continue;
                if (row >= ROWNO)
                    break;

                next_rmin[0][row] = max(1, u.ux - 1);
                next_rmax[0][row] = min(COLNO - 1, u.ux + 1);
                next_row = next_array[0][row];

                for (col = next_rmin[0][row]; col <= next_rmax[0][row]; col++)
                    uchars[next_row + col] = IN_SIGHT | COULD_SEE;
            }
        } else
            view_from(u.uy, u.ux, next_array[0], next_rmin[0], next_rmax[0], 0,
                      null,
                      0);

        /*
         * Set the IN_SIGHT bit for xray and night vision.
         */
        if (u.xray_range >= 0) {
            if (u.xray_range) {
                ranges = circle_ptr(u.xray_range);

                for (row = u.uy - u.xray_range; row <= u.uy + u.xray_range;
                     row++) {
                    if (row < 0)
                        continue;
                    if (row >= ROWNO)
                        break;
                    dy = v_abs(u.uy - row);
                    next_row = next_array[0][row];

                    start = max(1, u.ux - ranges[dy]);
                    stop = min(COLNO - 1, u.ux + ranges[dy]);

                    for (col = start; col <= stop; col++) {
                        var old_row_val = char(uchars[next_row + col]);

                        uchars[next_row + col] |= IN_SIGHT;
                        oldseenv = levl()[col][row].seenv;
                        levl()[col][row].seenv = SVALL; /* see all! */
                        /* Update if previously not in sight or new angle. */
                        if (!(old_row_val & IN_SIGHT) || oldseenv != SVALL)
                            newsym(col, row);
                    }

                    next_rmin[0][row] = min(start, next_rmin[0][row]);
                    next_rmax[0][row] = max(stop, next_rmax[0][row]);
                }
            } else { /* range is 0 */
                uchars[next_array[0][u.uy] + u.ux] |= IN_SIGHT;
                levl()[u.ux][u.uy].seenv = SVALL;
                next_rmin[0][u.uy] = min(u.ux, next_rmin[0][u.uy]);
                next_rmax[0][u.uy] = max(u.ux, next_rmax[0][u.uy]);
            }
        }

        if (has_night_vision && u.xray_range < u.nv_range) {
            if (!u.nv_range) { /* range is 0 */
                uchars[next_array[0][u.uy] + u.ux] |= IN_SIGHT;
                levl()[u.ux][u.uy].seenv = SVALL;
                next_rmin[0][u.uy] = min(u.ux, next_rmin[0][u.uy]);
                next_rmax[0][u.uy] = max(u.ux, next_rmax[0][u.uy]);
            } else if (u.nv_range > 0) {
                ranges = circle_ptr(u.nv_range);

                for (row = u.uy - u.nv_range; row <= u.uy + u.nv_range;
                     row++) {
                    if (row < 0)
                        continue;
                    if (row >= ROWNO)
                        break;
                    dy = v_abs(u.uy - row);
                    next_row = next_array[0][row];

                    start = max(1, u.ux - ranges[dy]);
                    stop = min(COLNO - 1, u.ux + ranges[dy]);

                    for (col = start; col <= stop; col++)
                        if (uchars[next_row + col])
                            uchars[next_row + col] |= IN_SIGHT;

                    next_rmin[0][row] = min(start, next_rmin[0][row]);
                    next_rmax[0][row] = max(stop, next_rmax[0][row]);
                }
            }
        }
    }

    /* Set the correct bits for all light sources. */
    do_light_sources(next_array[0]);

    /*
     * Make the viz_array the new array so that cansee() will work correctly.
     */
    temp_array = gv.viz_array;
    gv.viz_array = next_array[0];

    /*
     * The main update loop.  Here we do two things:
     *
     *      + Set the IN_SIGHT bit for places that we could see and are lit.
     *      + Reset changed places.
     *
     * There is one thing that makes deciding what the hero can see
     * difficult:
     *
     *  1.  Directional lighting.  Items that block light create problems.
     *      The worst offenders are doors.  Suppose a door to a lit room
     *      is closed.  It is lit on one side, but not on the other.  How
     *      do you know?  You have to check the closest adjacent position.
     *      Even so, that is not entirely correct.  But it seems close
     *      enough for now.
     */
    colbump[u.ux] = colbump[u.ux + 1] = 1;
    for (row = 0; row < ROWNO; row++) {
        dy = u.uy - row;
        dy = sign(dy);
        next_row = next_array[0][row];
        old_row = temp_array[row];

        /* Find the min and max positions on the row. */
        start = min(gv.viz_rmin[row], next_rmin[0][row]);
        stop = max(gv.viz_rmax[row], next_rmax[0][row]);
        lev = ptr_add(levl()[start][0], row);

        sv = seenv_matrix[dy + 1] + (start < u.ux ? 0 : (start > u.ux ? 2 : 1));

        for (col = start; col <= stop;
             lev = ptr_add(lev, ROWNO), sv += (colbump[++col])) {
            $goto_not_in_sight: for (;;) { switch ($goto) { default: case "not_in_sight": if (!$goto && (uchars[next_row + col] & IN_SIGHT)) {
                /*
                 * We see this position because of night- or xray-vision.
                 */
                oldseenv = lev.seenv;
                lev.seenv |=
                    (uchars[sv]); /* update seen angle */

                /* Update pos if previously not in sight or new angle. */
                if (!(uchars[old_row + col] & IN_SIGHT) || oldseenv != lev.seenv)
                    newsym(col, row);
            } else if (!$goto && ((uchars[next_row + col] & COULD_SEE)
                     && (lev.lit || (uchars[next_row + col] & TEMP_LIT)))) {
                /*
                 * We see this position because it is lit.
                 */
                if ((IS_DOOR(lev.typ) || lev.typ == SDOOR
                     || IS_WALL(lev.typ)) && !chars[viz_clear[row] + col]) {
                    /*
                     * Make sure doors, walls, boulders or mimics don't show
                     * up at the end of dark hallways.  We do this by checking
                     * the adjacent position.  If it is lit, then we can see
                     * the door or wall; otherwise we can't.
                     */
                    dx = u.ux - col;
                    dx = sign(dx);
                    flev = (levl()[col + dx][row + dy]);
                    if (flev.lit
                        || uchars[next_array[0][row + dy] + (col + dx)] & TEMP_LIT) {
                        uchars[next_row + col] |= IN_SIGHT; /* we see it */

                        oldseenv = lev.seenv;
                        lev.seenv |= (uchars[sv]);

                        /* Update pos if previously not in sight or new
                         * angle.*/
                        if (!(uchars[old_row + col] & IN_SIGHT)
                            || oldseenv != lev.seenv)
                            newsym(col, row);
                    } else
                        { $goto = "not_in_sight"; continue $goto_not_in_sight; }; /* we don't see it */
                } else {
                    uchars[next_row + col] |= IN_SIGHT; /* we see it */

                    oldseenv = lev.seenv;
                    lev.seenv |= (uchars[sv]);

                    /* Update pos if previously not in sight or new angle. */
                    if (!(uchars[old_row + col] & IN_SIGHT) || oldseenv != lev.seenv)
                        newsym(col, row);
                }
            } else if (!$goto && ((uchars[next_row + col] & COULD_SEE) && lev.waslit)) {
                /*
                 * If we make it here, the hero _could see_ the location,
                 * but doesn't see it (location is not lit).
                 * However, the hero _remembers_ it as lit (waslit is true).
                 * The hero can now see that it is not lit, so change waslit
                 * and update the location.
                 */
                lev.waslit = 0; /* remember lit condition */
                newsym(col, row);

            /*
             * At this point we know that the row position is *not* in normal
             * sight.  That is, the position could be seen, but is dark
             * or LOS is just plain blocked.
             *
             * Update the position if:
             * o If the old one *was* in sight.  We may need to clean up
             *   the glyph -- E.g. darken room spot, etc.
             * o If we now could see the location (yet the location is not
             *   lit), but previously we couldn't see the location, or vice
             *   versa.  Update the spot because there may be an
             *   infrared monster there.
             */
            } else {
 $goto = null;
                if ((uchars[old_row + col] & IN_SIGHT)
                    || ((uchars[next_row + col] & COULD_SEE)
                        ^ (uchars[old_row + col] & COULD_SEE)))
                {
                    /*
                     * TEMPORARY?  Sometimes we get here with col==0 and
                     * newsym()'s impossible() for !isok() is being
                     * triggered, so avoid calling it for <0,y>; other bad
                     * coordinates will produce a panic() as they should.
                     */
                    if (col != 0)
                    /*
                     */
                    newsym(col, row);
                }
            } } break; }
        } /* end for col . . */
    }     /* end for row . .  */
    colbump[u.ux] = colbump[u.ux + 1] = 0;
 }
    /* This newsym() caused a crash delivering msg about failure to open
     * dungeon file init_dungeons() -> panic() -> done(11) ->
     * vision_recalc(2) -> newsym() -> crash!  u.ux and u.uy are 0 and
     * program_state.panicking == 1 under those circumstances
     */
    if (!program_state.panicking)
        newsym(u.ux, u.uy); /* Make sure the hero shows up! */

    /* Set the new min and max pointers. */
    gv.viz_rmin = next_rmin[0];
    gv.viz_rmax = next_rmax[0];

    notice_all_mons(TRUE);
    } finally { stack_pop($frame); }
}

/*
 * block_point()
 *
 * Make the location opaque to light.
 */
export function block_point(x, y) { /* void */
    /* set DEBUGFILES=seethru in environment to see through clouds & water */
    if (gs.seethru == 0) { /* init once */
        gs.seethru = (wizard() && explicitdebug(_("seethru"))) ? 1 : -1;
    }
    if (gs.seethru == 1) {
        if (!does_block(x, y, levl()[x][y]))
            return;
    }

    fill_point(y, x);

    /* recalc light sources here? */

    /*
     * We have to do a full vision recalculation if we "could see" the
     * location.  Why? Suppose some monster opened a way so that the
     * hero could see a lit room.  However, the position of the opening
     * was out of night-vision range of the hero.  Suddenly the hero should
     * see the lit room.
     */
    if (uchars[gv.viz_array[y] + x])
        gv.vision_full_recalc = 1;
}

/*
 * unblock_point()
 *
 * Make the location transparent to light.
 */
export function unblock_point(x, y) { /* void */
    dig_point(y, x);

    /* recalc light sources here? */

    if (uchars[gv.viz_array[y] + x])
        gv.vision_full_recalc = 1;
}

/* recalc if point should be blocked or unblocked */
export function recalc_block_point(x, y) { /* void */
    if (does_block(x, y, levl()[x][y]))
        block_point(x, y);
    else
        unblock_point(x, y);
}

/*==========================================================================* \
 :                                                                          :
 :      Everything below this line uses (y,x) instead of (x,y) --- the      :
 :      algorithms are faster if they are less recursive and can scan       :
 :      on a row longer.                                                    :
 :                                                                          :
\*==========================================================================*/

/* ======================================================================= *\
                        Left and Right Pointer Updates
\* ======================================================================= */

/*
 *              LEFT and RIGHT pointer rules
 *
 *
 * **NOTE**  The rules changed on 4/4/90.  This comment reflects the
 * new rules.  The change was so that the stone-wall optimization
 * would work.
 *
 * OK, now the tough stuff.  We must maintain our left and right
 * row pointers.  The rules are as follows:
 *
 * Left Pointers:
 * ______________
 *
 * + If you are a clear spot, your left will point to the first
 *   stone to your left.  If there is none, then point the first
 *   legal position in the row (0).
 *
 * + If you are a blocked spot, then your left will point to the
 *   left-most blocked spot to your left that is connected to you.
 *   This means that a left-edge (a blocked spot that has an open
 *   spot on its left) will point to itself.
 *
 *
 * Right Pointers:
 * ---------------
 * + If you are a clear spot, your right will point to the first
 *   stone to your right.  If there is none, then point the last
 *   legal position in the row (COLNO-1).
 *
 * + If you are a blocked spot, then your right will point to the
 *   right-most blocked spot to your right that is connected to you.
 *   This means that a right-edge (a blocked spot that has an open
 *   spot on its right) will point to itself.
 */
function dig_point(row, col) { /* void */
    let i;

    if (chars[viz_clear[row] + col])
        return; /* already done */

    chars[viz_clear[row] + col] = 1;

    /*
     * Boundary cases first.
     */
    if (col == 0) { /* left edge */
        if (chars[viz_clear[row] + 1]) {
            right_ptrs[row][0] = right_ptrs[row][1];
        } else {
            right_ptrs[row][0] = 1;
            for (i = 1; i <= right_ptrs[row][1]; i++)
                left_ptrs[row][i] = 1;
        }
    } else if (col == (COLNO - 1)) { /* right edge */
        if (chars[viz_clear[row] + (COLNO - 2)]) {
            left_ptrs[row][COLNO - 1] = left_ptrs[row][COLNO - 2];
        } else {
            left_ptrs[row][COLNO - 1] = COLNO - 2;
            for (i = left_ptrs[row][COLNO - 2]; i < COLNO - 1; i++)
                right_ptrs[row][i] = COLNO - 2;
        }

    /*
     * At this point, we know we aren't on the boundaries.
     */
    } else if (chars[viz_clear[row] + (col - 1)] && chars[viz_clear[row] + (col + 1)]) {
        /* Both sides clear */
        for (i = left_ptrs[row][col - 1]; i <= col; i++) {
            if (!chars[viz_clear[row] + i])
                continue; /* catch non-end case */
            right_ptrs[row][i] = right_ptrs[row][col + 1];
        }
        for (i = col; i <= right_ptrs[row][col + 1]; i++) {
            if (!chars[viz_clear[row] + i])
                continue; /* catch non-end case */
            left_ptrs[row][i] = left_ptrs[row][col - 1];
        }
    } else if (chars[viz_clear[row] + (col - 1)]) {
        /* Left side clear, right side blocked. */
        for (i = col + 1; i <= right_ptrs[row][col + 1]; i++)
            left_ptrs[row][i] = col + 1;

        for (i = left_ptrs[row][col - 1]; i <= col; i++) {
            if (!chars[viz_clear[row] + i])
                continue; /* catch non-end case */
            right_ptrs[row][i] = col + 1;
        }
        left_ptrs[row][col] = left_ptrs[row][col - 1];
    } else if (chars[viz_clear[row] + (col + 1)]) {
        /* Right side clear, left side blocked. */
        for (i = left_ptrs[row][col - 1]; i < col; i++)
            right_ptrs[row][i] = col - 1;

        for (i = col; i <= right_ptrs[row][col + 1]; i++) {
            if (!chars[viz_clear[row] + i])
                continue; /* catch non-end case */
            left_ptrs[row][i] = col - 1;
        }
        right_ptrs[row][col] = right_ptrs[row][col + 1];
    } else {
        /* Both sides blocked */
        for (i = left_ptrs[row][col - 1]; i < col; i++)
            right_ptrs[row][i] = col - 1;

        for (i = col + 1; i <= right_ptrs[row][col + 1]; i++)
            left_ptrs[row][i] = col + 1;

        left_ptrs[row][col] = col - 1;
        right_ptrs[row][col] = col + 1;
    }
}

function fill_point(row, col) { /* void */
    let i;

    if (!chars[viz_clear[row] + col])
        return;

    chars[viz_clear[row] + col] = 0;

    if (col == 0) {
        if (chars[viz_clear[row] + 1]) { /* adjacent is clear */
            right_ptrs[row][0] = 0;
        } else {
            right_ptrs[row][0] = right_ptrs[row][1];
            for (i = 1; i <= right_ptrs[row][1]; i++)
                left_ptrs[row][i] = 0;
        }
    } else if (col == COLNO - 1) {
        if (chars[viz_clear[row] + (COLNO - 2)]) { /* adjacent is clear */
            left_ptrs[row][COLNO - 1] = COLNO - 1;
        } else {
            left_ptrs[row][COLNO - 1] = left_ptrs[row][COLNO - 2];
            for (i = left_ptrs[row][COLNO - 2]; i < COLNO - 1; i++)
                right_ptrs[row][i] = COLNO - 1;
        }

    /*
     * Else we know that we are not on an edge.
     */
    } else if (chars[viz_clear[row] + (col - 1)] && chars[viz_clear[row] + (col + 1)]) {
        /* Both sides clear */
        for (i = left_ptrs[row][col - 1] + 1; i <= col; i++)
            right_ptrs[row][i] = col;

        if (!left_ptrs[row][col - 1]) /* catch the end case */
            right_ptrs[row][0] = col;

        for (i = col; i < right_ptrs[row][col + 1]; i++)
            left_ptrs[row][i] = col;

        if (right_ptrs[row][col + 1] == COLNO - 1) /* catch the end case */
            left_ptrs[row][COLNO - 1] = col;
    } else if (chars[viz_clear[row] + (col - 1)]) {
        /* Left side clear, right side blocked. */
        for (i = col; i <= right_ptrs[row][col + 1]; i++)
            left_ptrs[row][i] = col;

        for (i = left_ptrs[row][col - 1] + 1; i < col; i++)
            right_ptrs[row][i] = col;

        if (!left_ptrs[row][col - 1]) /* catch the end case */
            right_ptrs[row][i] = col;

        right_ptrs[row][col] = right_ptrs[row][col + 1];
    } else if (chars[viz_clear[row] + (col + 1)]) {
        /* Right side clear, left side blocked. */
        for (i = left_ptrs[row][col - 1]; i <= col; i++)
            right_ptrs[row][i] = col;

        for (i = col + 1; i < right_ptrs[row][col + 1]; i++)
            left_ptrs[row][i] = col;

        if (right_ptrs[row][col + 1] == COLNO - 1) /* catch the end case */
            left_ptrs[row][i] = col;

        left_ptrs[row][col] = left_ptrs[row][col - 1];
    } else {
        /* Both sides blocked */
        for (i = left_ptrs[row][col - 1]; i <= col; i++)
            right_ptrs[row][i] = right_ptrs[row][col + 1];

        for (i = col; i <= right_ptrs[row][col + 1]; i++)
            left_ptrs[row][i] = left_ptrs[row][col - 1];
    }
}

/*==========================================================================*/
/*==========================================================================*/

/*
 * Variables local to Algorithm C.
 */
const start_row = static_var("start_row", int);
const start_col = static_var("start_col", int);
const step = static_var("step", int);
const cs_rows = static_var("cs_rows", ptr_to(ptr_to(uchar)));
const cs_left = static_var("cs_left", ptr_to(short));
const cs_right = static_var("cs_right", ptr_to(short));

const vis_func = static_var("vis_func", fnptr_t);
const varg = static_var("varg", ptr_to(void_t));

/*
 * Algorithm C uses the following macros:
 *
 *      good_row(z)       - Return TRUE if the argument is a legal row.
 *      set_cs(rowp,col)  - Set the local could see array.
 *      set_min(z)        - Save the min value of the argument and the current
 *                            row minimum.
 *      set_max(z)        - Save the max value of the argument and the current
 *                            row maximum.
 *
 * The last three macros depend on having local pointers row_min, row_max,
 * and rowp being set correctly.
 *
 * The assertions are included to pacify a static source code analyzer.
 * Compile with NDEBUG defined to suppress them.
 */
export function is_clear(row, col) { return chars[viz_clear_rows[row] + col]; }
export function good_row(z) { return +(z >= 0 && z < ROWNO); }
export function set_cs(rowp, col) { do {
        assert(rowp != (0));
        uchars[rowp + col] = COULD_SEE;
    } while (0) }

/*
 * clear_path()         expanded into 4 macros/functions:
 *
 *      q1_path()
 *      q2_path()
 *      q3_path()
 *      q4_path()
 *
 * "Draw" a line from the start to the given location.  Stop if we hit
 * something that blocks light.  The start and finish points themselves are
 * not checked, just the points between them.  These routines do _not_
 * expect to be called with the same starting and stopping point.
 *
 * These routines use the generalized integer Bresenham's algorithm (fast
 * line drawing) for all quadrants.  The algorithm was taken from _Procedural
 * Elements for Computer Graphics_, by David F. Rogers.  McGraw-Hill, 1985.
 */

/*
 * When called, the result is in "result".
 * The first two arguments (srow,scol) are one end of the path.  The next
 * two arguments (row,col) are the destination.  The last argument is
 * used as a C language label.  This means that it must be different
 * in each pair of calls.
 */

/*
 *  Quadrant I (step < 0).
 */

/*
 * Quadrant IV (step > 0).
 */

/*
 * Quadrant II (step < 0).
 */

/*
 * Quadrant III (step > 0).
 */

/* #else (#ifdef MACRO_CPATH): not in this build */

/*
 * Use vision tables to determine if there is a clear path from
 * (col1,row1) to (col2,row2).  This is used by:
 *      m_cansee()
 *      m_canseeu()
 *      do_light_sources()
 */
export function clear_path(col1, row1, col2, row2) { /* boolean */
    var result;

    cleardone: { if (col1 < col2) {
        if (row1 > row2) {
            { var dx, dy; var k, err, x, y, dxs, dys; x = (col1); y = (row1); dx = ((col2) - x); dy = (y - (row2)); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x++; err -= dys; } y--; err += dxs; if (!is_clear(y, x)) break cleardone; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y--; err -= dxs; } x++; err += dys; if (!is_clear(y, x)) break cleardone; } } result = 1 };
        } else {
            { var dx, dy; var k, err, x, y, dxs, dys; x = (col1); y = (row1); dx = ((col2) - x); dy = ((row2) - y); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x++; err -= dys; } y++; err += dxs; if (!is_clear(y, x)) break cleardone; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y++; err -= dxs; } x++; err += dys; if (!is_clear(y, x)) break cleardone; } } result = 1 };
        }
    } else {
        if (row1 > row2) {
            { var dx, dy; var k, err, x, y, dxs, dys; x = (col1); y = (row1); dx = (x - (col2)); dy = (y - (row2)); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x--; err -= dys; } y--; err += dxs; if (!is_clear(y, x)) break cleardone; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y--; err -= dxs; } x--; err += dys; if (!is_clear(y, x)) break cleardone; } } result = 1 };
        } else if (row1 == row2 && col1 == col2) {
            result = 1;
        } else {
            { var dx, dy; var k, err, x, y, dxs, dys; x = (col1); y = (row1); dx = (x - (col2)); dy = ((row2) - y); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x--; err -= dys; } y++; err += dxs; if (!is_clear(y, x)) break cleardone; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y++; err -= dxs; } x--; err += dys; if (!is_clear(y, x)) break cleardone; } } result = 1 };
        }
    }
 }

    return boolean(result);
}

/*==========================================================================*\
                            GENERAL LINE OF SIGHT
                                Algorithm C
\*==========================================================================*/

/*
 * Defines local to Algorithm C.
 */

/* Initialize algorithm C (nothing). */
function view_init() { /* void */
}

/*
 * Mark positions as visible on one quadrant of the right side.  The
 * quadrant is determined by the value of the global variable step.
 *
 * Arguments:
 *   row         current row
 *   left        first (left side) visible spot on prev row
 *   right_mark  last (right side) visible spot on prev row
 *   limits      points at range limit for current row, or NULL
 */
function right_side(
    row,
    left,
    right_mark,
    limits) { /* void */
    var right;                  /* right limit of "could see" */
    var right_edge;             /* right edge of an opening */
    var nrow;                   /* new row (calculate once) */
    var deeper;                 /* if TRUE, call self as needed */
    var result;                 /* set by q?_path() */
    var i;             /* loop counter */
    var rowp = 0; /* row optimization */
    var row_min = null;     /* left most  [used by macro set_min()] */
    var row_max = null;     /* right most [used by macro set_max()] */
    var lim_max;                /* right most limit of circle */

    nrow = row + step[0];
    /*
     * Can go deeper if the row is in bounds and the next row is within
     * the circle's limit.  We tell the latter by checking to see if the next
     * limit value is the start of a new circle radius (meaning we depend
     * on the structure of circle_data[]).
     */
    deeper = +(good_row(nrow) && (!limits || (limits[0] >= limits.subarray(1)[0])));
    if (!vis_func[0]) {
        rowp = cs_rows[0][row]; /* optimization */
        row_min = cs_left[0].subarray(row);
        row_max = cs_right[0].subarray(row);
    }
    if (limits) {
        lim_max = start_col[0] + limits[0];
        if (lim_max > COLNO - 1)
            lim_max = COLNO - 1;
        if (right_mark > lim_max)
            right_mark = lim_max;
        limits = limits.subarray(1); /* prepare for next row */
    } else
        lim_max = COLNO - 1;

    while (left <= right_mark) {
        right_edge = right_ptrs[row][left];
        if (right_edge > lim_max)
            right_edge = lim_max;

        if (!is_clear(row, left)) {
            /*
             * Jump to the far side of a stone wall.  We can set all
             * the points in between as seen.
             *
             * If the right edge goes beyond the right mark, check to see
             * how much we can see.
             */
            if (right_edge > right_mark) {
                /*
                 * If the mark on the previous row was a clear position,
                 * the odds are that we can actually see part of the wall
                 * beyond the mark on this row.  If so, then see one beyond
                 * the mark.  Otherwise don't.  This is a kludge so corners
                 * with an adjacent doorway show up in nethack.
                 */
                right_edge = is_clear(row - step[0], right_mark) ? right_mark + 1
                                                              : right_mark;
            }
            if (vis_func[0]) {
                for (i = left; i <= right_edge; i++)
                    (vis_func[0])(i, row, varg[0]);
            } else {
                for (i = left; i <= right_edge; i++)
                    set_cs(rowp, i);
                do { assert((row_min != null)); if ((row_min[0] > (left))) row_min[0] = (left); } while (0);
                do { assert((row_max != null)); if ((row_max[0] < (right_edge))) row_max[0] = (right_edge); } while (0);
            }
            left = right_edge + 1; /* no limit check necessary */
            continue;
        }

        /* No checking needed if our left side is the start column. */
        if (left != start_col[0]) {
            /*
             * Find the left side.  Move right until we can see it or we run
             * into a wall.
             */
            for (; left <= right_edge; left++) {
                rside1: { if (step[0] < 0) {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = ((left) - x); dy = (y - (row)); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x++; err -= dys; } y--; err += dxs; if (!is_clear(y, x)) break rside1; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y--; err -= dxs; } x++; err += dys; if (!is_clear(y, x)) break rside1; } } result = 1 };
                } else {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = ((left) - x); dy = ((row) - y); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x++; err -= dys; } y++; err += dxs; if (!is_clear(y, x)) break rside1; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y++; err -= dxs; } x++; err += dys; if (!is_clear(y, x)) break rside1; } } result = 1 };
                }
 }        /* used if q?_path() is a macro */
                if (result)
                    break;
            }

            /*
             * Check for boundary conditions.  We *need* check (2) to break
             * an infinite loop where:
             *
             *           left == right_edge == right_mark == lim_max.
             *
             */
            if (left > lim_max)
                return;            /* check (1) */
            if (left == lim_max) { /* check (2) */
                if (vis_func[0]) {
                    (vis_func[0])(lim_max, row, varg[0]);
                } else {
                    set_cs(rowp, lim_max);
                    do { assert((row_max != null)); if ((row_max[0] < (lim_max))) row_max[0] = (lim_max); } while (0);
                }
                return;
            }
            /*
             * Check if we can see any spots in the opening.  We might
             * (left == right_edge) or might not (left == right_edge+1) have
             * been able to see the far wall.  Make sure we *can* see the
             * wall (remember, we can see the spot above/below this one)
             * by backing up.
             */
            if (left >= right_edge) {
                left = right_edge; /* for the case left == right_edge+1 */
                continue;
            }
        }

        /*
         * Find the right side.  If the marker from the previous row is
         * closer than the edge on this row, then we have to check
         * how far we can see around the corner (under the overhang).  Stop
         * at the first non-visible spot or we actually hit the far wall.
         *
         * Otherwise, we know we can see the right edge of the current row.
         *
         * This must be a strict "less than" so that we can always see a
         * horizontal wall, even if it is adjacent to us.
         */
        if (right_mark < right_edge) {
            for (right = right_mark; right <= right_edge; right++) {
                rside2: { if (step[0] < 0) {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = ((right) - x); dy = (y - (row)); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x++; err -= dys; } y--; err += dxs; if (!is_clear(y, x)) break rside2; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y--; err -= dxs; } x++; err += dys; if (!is_clear(y, x)) break rside2; } } result = 1 };
                } else {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = ((right) - x); dy = ((row) - y); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x++; err -= dys; } y++; err += dxs; if (!is_clear(y, x)) break rside2; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y++; err -= dxs; } x++; err += dys; if (!is_clear(y, x)) break rside2; } } result = 1 };
                }
 }        /* used if q?_path() is a macro */
                if (!result)
                    break;
            }
            --right; /* get rid of the last increment */
        } else
            right = right_edge;

        /*
         * We have the range that we want.  Set the bits.  Note that
         * there is no else --- we no longer handle splinters.
         */
        if (left <= right) {
            /*
             * An ugly special case.  If you are adjacent to a vertical wall
             * and it has a break in it, then the right mark is set to be
             * start_col.  We *want* to be able to see adjacent vertical
             * walls, so we have to set it back.
             */
            if (left == right && left == start_col[0] && start_col[0] < (COLNO - 1)
                && !is_clear(row, start_col[0] + 1))
                right = start_col[0] + 1;

            if (right > lim_max)
                right = lim_max;
            /* set the bits */
            if (vis_func[0]) {
                for (i = left; i <= right; i++)
                    (vis_func[0])(i, row, varg[0]);
            } else {
                for (i = left; i <= right; i++)
                    set_cs(rowp, i);
                do { assert((row_min != null)); if ((row_min[0] > (left))) row_min[0] = (left); } while (0);
                do { assert((row_max != null)); if ((row_max[0] < (right))) row_max[0] = (right); } while (0);
            }

            /* recursive call for next finger of light */
            if (deeper)
                right_side(nrow, left, right, limits);
            left = right + 1; /* no limit check necessary */
        }
    }
}

/*
 * This routine is the mirror image of right_side().  See right_side() for
 * extensive comments.
 */
function left_side(
    row,
    left_mark,
    right,
    limits) { /* void */
    var left, left_edge, nrow, deeper, result;
    var i;
    var rowp = 0;
    var row_min = null;
    var row_max = null;
    var lim_min;

    nrow = row + step[0];
    deeper = +(good_row(nrow) && (!limits || (limits[0] >= limits.subarray(1)[0])));
    if (!vis_func[0]) {
        rowp = cs_rows[0][row];
        row_min = cs_left[0].subarray(row);
        row_max = cs_right[0].subarray(row);
    }
    if (limits) {
        lim_min = start_col[0] - limits[0];
        if (lim_min < 0)
            lim_min = 0;
        if (left_mark < lim_min)
            left_mark = lim_min;
        limits = limits.subarray(1); /* prepare for next row */
    } else
        lim_min = 0;

    while (right >= left_mark) {
        left_edge = left_ptrs[row][right];
        if (left_edge < lim_min)
            left_edge = lim_min;

        if (!is_clear(row, right)) {
            /* Jump to the far side of a stone wall. */
            if (left_edge < left_mark) {
                /* Maybe see more (kludge). */
                left_edge = is_clear(row - step[0], left_mark) ? left_mark - 1
                                                            : left_mark;
            }
            if (vis_func[0]) {
                for (i = left_edge; i <= right; i++)
                    (vis_func[0])(i, row, varg[0]);
            } else {
                for (i = left_edge; i <= right; i++)
                    set_cs(rowp, i);
                do { assert((row_min != null)); if ((row_min[0] > (left_edge))) row_min[0] = (left_edge); } while (0);
                do { assert((row_max != null)); if ((row_max[0] < (right))) row_max[0] = (right); } while (0);
            }
            right = left_edge - 1; /* no limit check necessary */
            continue;
        }

        if (right != start_col[0]) {
            /* Find the right side. */
            for (; right >= left_edge; right--) {
                lside1: { if (step[0] < 0) {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = (x - (right)); dy = (y - (row)); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x--; err -= dys; } y--; err += dxs; if (!is_clear(y, x)) break lside1; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y--; err -= dxs; } x--; err += dys; if (!is_clear(y, x)) break lside1; } } result = 1 };
                } else {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = (x - (right)); dy = ((row) - y); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x--; err -= dys; } y++; err += dxs; if (!is_clear(y, x)) break lside1; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y++; err -= dxs; } x--; err += dys; if (!is_clear(y, x)) break lside1; } } result = 1 };
                }
 }        /* used if q?_path() is a macro */
                if (result)
                    break;
            }

            /* Check for boundary conditions. */
            if (right < lim_min)
                return;
            if (right == lim_min) {
                if (vis_func[0]) {
                    (vis_func[0])(lim_min, row, varg[0]);
                } else {
                    set_cs(rowp, lim_min);
                    do { assert((row_min != null)); if ((row_min[0] > (lim_min))) row_min[0] = (lim_min); } while (0);
                }
                return;
            }
            /* Check if we can see any spots in the opening. */
            if (right <= left_edge) {
                right = left_edge;
                continue;
            }
        }

        /* Find the left side. */
        if (left_mark > left_edge) {
            for (left = left_mark; left >= left_edge; --left) {
                lside2: { if (step[0] < 0) {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = (x - (left)); dy = (y - (row)); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x--; err -= dys; } y--; err += dxs; if (!is_clear(y, x)) break lside2; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y--; err -= dxs; } x--; err += dys; if (!is_clear(y, x)) break lside2; } } result = 1 };
                } else {
                    { var dx, dy; var k, err, x, y, dxs, dys; x = (start_col[0]); y = (start_row[0]); dx = (x - (left)); dy = ((row) - y); result = 0; dxs = (dx << 1); dys = (dy << 1); if ((dy > dx)) { err = (dxs - dy); for (k = (dy - 1); k; k--) { if ((err >= 0)) { x--; err -= dys; } y++; err += dxs; if (!is_clear(y, x)) break lside2; } } else { err = (dys - dx); for (k = (dx - 1); k; k--) { if ((err >= 0)) { y++; err -= dxs; } x--; err += dys; if (!is_clear(y, x)) break lside2; } } result = 1 };
                }
 }        /* used if q?_path() is a macro */
                if (!result)
                    break;
            }
            left++; /* get rid of the last decrement */
        } else
            left = left_edge;

        if (left <= right) {
            /* An ugly special case. */
            if (left == right && right == start_col[0] && start_col[0] > 0
                && !is_clear(row, start_col[0] - 1))
                left = start_col[0] - 1;

            if (left < lim_min)
                left = lim_min;
            if (vis_func[0]) {
                for (i = left; i <= right; i++)
                    (vis_func[0])(i, row, varg[0]);
            } else {
                for (i = left; i <= right; i++)
                    set_cs(rowp, i);
                do { assert((row_min != null)); if ((row_min[0] > (left))) row_min[0] = (left); } while (0);
                do { assert((row_max != null)); if ((row_max[0] < (right))) row_max[0] = (right); } while (0);
            }

            /* Recurse */
            if (deeper)
                left_side(nrow, left, right, limits);
            right = left - 1; /* no limit check necessary */
        }
    }
}

/*
 * Calculate all possible visible locations from the given location
 * (srow,scol).  NOTE this is (y,x)!  Mark the visible locations in the
 * array provided.
 *
 * Arguments
 *   srow, scol     starting row and column
 *   loc_cs_rows    pointers to the rows of the could_see array
 *   left_most      min mark on each row
 *   right_most     max mark on each row
 *   range          0 if unlimited
 *   func           function to call on each spot
 *   arg            argument for func
 */
function view_from(
    srow, scol,
    loc_cs_rows,
    left_most, right_most,
    range,
    func,
    arg) { /* void */
    let i; /* loop counter */
    let rowp;    /* optimization for setting could_see */
    let nrow;       /* the next row */
    let left;       /* the left-most visible column */
    let right;      /* the right-most visible column */
    let limits;   /* range limit for next row */

    /* Set globals for q?_path(), left_side(), and right_side() to use. */
    start_col[0] = scol;
    start_row[0] = srow;
    cs_rows[0] = loc_cs_rows; /* 'could see' rows */
    cs_left[0] = left_most;
    cs_right[0] = right_most;
    vis_func[0] = func;
    varg[0] = arg;

    /*
     * Determine extent of sight on the starting row.
     */
    if (is_clear(srow, scol)) {
        left = left_ptrs[srow][scol];
        right = right_ptrs[srow][scol];
    } else {
        /*
         * When in stone, you can only see your adjacent squares, unless
         * you are on an array boundary or a stone/clear boundary.
         */
        left = (!scol) ? 0
                       : (is_clear(srow, scol - 1) ? left_ptrs[srow][scol - 1]
                                                   : scol - 1);
        right = (scol == COLNO - 1)
                    ? COLNO - 1
                    : (is_clear(srow, scol + 1) ? right_ptrs[srow][scol + 1]
                                                : scol + 1);
    }

    if (range) {
        if (range > MAX_RADIUS || range < 1)
            panic(_("view_from called with range %d"), range);
        limits = circle_ptr(range).subarray(1); /* start at next row */
        if (left < scol - range)
            left = scol - range;
        if (right > scol + range)
            right = scol + range;
    } else
        limits = null;

    if (func) {
        for (i = left; i <= right; i++)
            func(i, srow, arg);
    } else {
        /* Row pointer optimization. */
        rowp = cs_rows[0][srow];

        /* We know that we can see our row. */
        for (i = left; i <= right; i++)
            set_cs(rowp, i);
        cs_left[0][srow] = left;
        cs_right[0][srow] = right;
    }

    /*
     * Check what could be seen in quadrants.  We need to check for valid
     * rows here, since we don't do it in the routines right_side() and
     * left_side() [ugliness to remove extra routine calls].
     */
    if ((nrow = srow + 1) < ROWNO) { /* move down */
        step[0] = 1;
        if (scol < COLNO - 1)
            right_side(nrow, scol, right, limits);
        if (scol)
            left_side(nrow, left, scol, limits);
    }

    if ((nrow = srow - 1) >= 0) { /* move up */
        step[0] = -1;
        if (scol < COLNO - 1)
            right_side(nrow, scol, right, limits);
        if (scol)
            left_side(nrow, left, scol, limits);
    }
}

/*===== End of algorithm C =====*/

/*
 * AREA OF EFFECT "ENGINE"
 *
 * Calculate all possible visible locations as viewed from the given location
 * (srow,scol) within the range specified. Perform "func" with (x, y) args and
 * additional argument "arg" for each square.
 *
 * If not centered on the hero, just forward arguments to view_from(); it
 * will call "func" when necessary.  If the hero is the center, use the
 * vision matrix and reduce extra work.
 */
export function do_clear_area(
    scol, srow,
    range,
    func,
    arg) { /* void */
    /* If not centered on hero, do the hard work of figuring the area */
    if (scol != u.ux || srow != u.uy) {
        view_from(srow, scol, null, null, null,
                  range, func, arg);
    } else {
        let x;
        let y, min_x, max_x, max_y, offset;
        let limits;
        let override_vision;

        /* vision doesn't pass through water or clouds, detection should
           [this probably ought to be an arg supplied by our caller...] */
        override_vision = (detecting(func)
                           && (Is_waterlevel(u.uz) || Is_airlevel(u.uz)) ? 1 : 0);

        if (range > MAX_RADIUS || range < 1)
            panic(_("do_clear_area:  illegal range %d"), range);
        if (gv.vision_full_recalc)
            vision_recalc(0); /* recalc vision if dirty */
        limits = circle_ptr(range);
        if (int(max_y = (srow + range)) >= ROWNO)
            max_y = ROWNO - 1;
        if (int(y = (srow - range)) < 0)
            y = 0;
        for (; y <= max_y; y++) {
            offset = limits[v_abs(y - srow)];
            if (int(min_x = (scol - offset)) < 1)
                min_x = 1;
            if (int(max_x = (scol + offset)) >= COLNO)
                max_x = COLNO - 1;
            for (x = min_x; x <= max_x; x++)
                if (couldsee(x, y) || override_vision)
                    func(x, y, arg);
        }
    }
}

/* bitmask indicating ways mon is seen; extracted from lookat(pager.c) */
export function howmonseen(mon) { /* unsigned */
    let useemon = boolean(canseemon(mon));
    let xraydist = (u.xray_range < 0) ? -1 : (u.xray_range * u.xray_range);
    let how_seen = 0; /* result */

    /* assert(mon != NULL) */
    /* normal vision;
       cansee is true for both normal and astral vision,
       but couldsee it not true for astral vision */
    if ((mon.wormno ? worm_known(mon) : (cansee(mon.mx, mon.my)
                                          && couldsee(mon.mx, mon.my)))
        && mon_visible(mon) && !mon.minvis)
        how_seen = unsigned(how_seen | MONSEEN_NORMAL);
    /* see invisible */
    if (useemon && mon.minvis)
        how_seen = unsigned(how_seen | MONSEEN_SEEINVIS);
    /* infravision */
    if ((!mon.minvis || See_invisible()) && see_with_infrared(mon))
        how_seen = unsigned(how_seen | MONSEEN_INFRAVIS);
    /* telepathy */
    if (tp_sensemon(mon))
        how_seen = unsigned(how_seen | MONSEEN_TELEPAT);
    /* xray */
    if (useemon && xraydist > 0 && mdistu(mon) <= xraydist)
        how_seen = unsigned(how_seen | MONSEEN_XRAYVIS);
    /* extended detection */
    if (Detect_monsters())
        how_seen = unsigned(how_seen | MONSEEN_DETECT);
    /* class-/type-specific warning */
    if (MATCH_WARN_OF_MON(mon))
        how_seen = unsigned(how_seen | MONSEEN_WARNMON);

    return how_seen;
}

/*vision.c*/

import { Is_airlevel, Is_rogue_level, Is_waterlevel } from "./dungeon.h.macros.js";
import { wizard } from "./flag.h.macros.js";
import { COLNO, FALSE, ROWNO, TRUE, boolean } from "./global.h.js";
import { MATCH_WARN_OF_MON, max, mdistu, min } from "./hack.h.macros.js";
import { explicitdebug } from "./lint.h.macros.js";
import { ROOMOFFSET } from "./mkroom.h.js";
import { is_lightblocker_mappear } from "./monst.h.macros.js";
import { BOULDER } from "./objects.h.js";
import {
    CLOUD, DOOR, D_CLOSED, D_LOCKED, D_TRAPPED, LAVAWALL, SDOOR, SVALL, TREE,
} from "./rm.h.js";
import { IS_DOOR, IS_OBSTRUCTED, IS_WALL, IS_WATERWALL, levl, m_at } from "./rm.h.macros.js";
import {
    COULD_SEE, IN_SIGHT, MAX_RADIUS, MONSEEN_DETECT, MONSEEN_INFRAVIS, MONSEEN_NORMAL,
    MONSEEN_SEEINVIS, MONSEEN_TELEPAT, MONSEEN_WARNMON, MONSEEN_XRAYVIS, TEMP_LIT,
} from "./vision.h.js";
import { cansee, circle_ptr, couldsee } from "./vision.h.macros.js";
import { TT_PIT } from "./you.h.js";
import { Blind, Detect_monsters, See_invisible, Underwater } from "./youprop.h.macros.js";
import { char, int, short, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { assert, memset } from "../rt/libc.js";
import { stack_var, static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, fnptr_t, ptr_add, ptr_to, ref_add, void_t } from "../rt/struct.js";
import { isok } from "./cmd.js";
import { is_moat, is_pool } from "./dbridge.js";
import { gi, gs, gv, iflags, program_state, svl, svr, u } from "./decl.js";
import { detecting } from "./detect.js";
import {
    canseemon, mon_visible, newsym, see_with_infrared, seenv_matrix, tp_sensemon,
} from "./display.js";
import { panic } from "./end.js";
import { notice_all_mons } from "./hack.js";
import { do_light_sources } from "./light.js";
import { visible_region_at } from "./region.js";
import { worm_known } from "./worm.js";
