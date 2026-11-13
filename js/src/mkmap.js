/* NetHack 5.0	mkmap.c	$NHDT-Date: 1717432093 2024/06/03 16:28:13 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.40 $ */
/* Copyright (c) J. C. Collet, M. Stephenson and D. Cohrs, 1992   */
/* NetHack may be freely redistributed.  See license for details. */

export const HEIGHT = (ROWNO - 1);
export const WIDTH = (COLNO - 2);

function init_map(bg_typ) { /* void */
    let x, y;

    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            levl()[x][y].roomno = NO_ROOM;
            levl()[x][y].typ = bg_typ;
            levl()[x][y].lit = FALSE;
        }
}

function init_fill(bg_typ, fg_typ) { /* void */
    let x, y;
    let limit, count;

    limit = Math.trunc((WIDTH * HEIGHT * 2) / 5);
    count = 0;
    while (count < limit) {
        x = coordxy(rn1(WIDTH - 1, 2));
        y = coordxy(rnd(HEIGHT - 1));
        if (levl()[x][y].typ == bg_typ) {
            levl()[x][y].typ = fg_typ;
            count++;
        }
    }
}

function get_map(col, row, bg_typ) { /* schar */
    if (col <= 0 || row < 0 || col > WIDTH || row >= HEIGHT)
        return bg_typ;
    return levl()[col][row].typ;
}

const dirs = static_array("dirs", int, 16, [
    -1, -1 /**/, -1,  0 /**/, -1, 1 /**/, 0, -1 /**/,
     0,  1 /**/,  1, -1 /**/,  1, 0 /**/, 1,  1
]);

function pass_one(bg_typ, fg_typ) { /* void */
    let x, y;
    let count, dr;

    for (x = 2; x <= WIDTH; x++)
        for (y = 1; y < HEIGHT; y++) {
            for (count = 0, dr = 0; dr < 8; dr++)
                if (get_map(x + dirs[dr * 2], y + dirs[(dr * 2) + 1], bg_typ)
                    == fg_typ)
                    count++;

            switch (count) {
            case 0: /* death */
            case 1:
            case 2:
                levl()[x][y].typ = bg_typ;
                break;
            case 5:
            case 6:
            case 7:
            case 8:
                levl()[x][y].typ = fg_typ;
                break;
            default:
                break;
            }
        }
}

export function new_loc(i, j) { return chars[(gn.new_locations + (j * (WIDTH + 1)) + i)]; }

function pass_two(bg_typ, fg_typ) { /* void */
    let x, y;
    let count, dr;

    for (x = 2; x <= WIDTH; x++)
        for (y = 1; y < HEIGHT; y++) {
            for (count = 0, dr = 0; dr < 8; dr++)
                if (get_map(x + dirs[dr * 2], y + dirs[(dr * 2) + 1], bg_typ)
                    == fg_typ)
                    count++;
            if (count == 5)
                chars[((gn.new_locations + ((y) * (WIDTH + 1))) + (x))] = bg_typ;
            else
                chars[((gn.new_locations + ((y) * (WIDTH + 1))) + (x))] = get_map(x, y, bg_typ);
        }

    for (x = 2; x <= WIDTH; x++)
        for (y = 1; y < HEIGHT; y++)
            levl()[x][y].typ = new_loc(x, y);
}

function pass_three(bg_typ, fg_typ) { /* void */
    let x, y;
    let count, dr;

    for (x = 2; x <= WIDTH; x++)
        for (y = 1; y < HEIGHT; y++) {
            for (count = 0, dr = 0; dr < 8; dr++)
                if (get_map(x + dirs[dr * 2], y + dirs[(dr * 2) + 1], bg_typ)
                    == fg_typ)
                    count++;
            if (count < 3)
                chars[((gn.new_locations + ((y) * (WIDTH + 1))) + (x))] = bg_typ;
            else
                chars[((gn.new_locations + ((y) * (WIDTH + 1))) + (x))] = get_map(x, y, bg_typ);
        }

    for (x = 2; x <= WIDTH; x++)
        for (y = 1; y < HEIGHT; y++)
            levl()[x][y].typ = new_loc(x, y);
}

/*
 * use a flooding algorithm to find all locations that should
 * have the same rm number as the current location.
 * if anyroom is TRUE, use IS_ROOM to check room membership instead of
 * exactly matching levl[sx][sy].typ and walls are included as well.
 */
export function flood_fill_rm(
    sx,
    sy,
    rmno,
    lit,
    anyroom) { /* void */
    let i, nx;
    let fg_typ = levl()[sx][sy].typ;

    /* back up to find leftmost uninitialized location */
    while (sx > 0 && (anyroom ? IS_ROOM(levl()[sx][sy].typ)
                              : levl()[sx][sy].typ == fg_typ)
           && (levl()[sx][sy].roomno) != rmno)
        sx--;
    sx++; /* compensate for extra decrement */

    /* assume sx,sy is valid */
    if (sx < gm.min_rx)
        gm.min_rx = sx;
    if (sy < gm.min_ry)
        gm.min_ry = sy;

    for (i = sx; i <= WIDTH && levl()[i][sy].typ == fg_typ; i++) {
        levl()[i][sy].roomno = unsigned(rmno);
        levl()[i][sy].lit = unsigned(lit);
        if (anyroom) {
            /* add walls to room as well */
            let ii, jj;
            for (ii = (i == sx ? i - 1 : i); ii <= i + 1; ii++)
                for (jj = sy - 1; jj <= sy + 1; jj++)
                    if (isok(ii, jj) && (IS_WALL(levl()[ii][jj].typ)
                                         || IS_DOOR(levl()[ii][jj].typ)
                                         || levl()[ii][jj].typ == SDOOR)) {
                        levl()[ii][jj].edge = 1;
                        if (lit)
                            levl()[ii][jj].lit = unsigned(lit);

                        if (levl()[ii][jj].roomno == NO_ROOM)
                            levl()[ii][jj].roomno = unsigned(rmno);
                        else if ((levl()[ii][jj].roomno) != rmno)
                            levl()[ii][jj].roomno = SHARED;
                    }
        }
        gn.n_loc_filled++;
    }
    nx = i;

    if (isok(sx, sy - 1)) {
        for (i = sx; i < nx; i++)
            if (levl()[i][sy - 1].typ == fg_typ) {
                if ((levl()[i][sy - 1].roomno) != rmno)
                    flood_fill_rm(i, sy - 1, rmno, lit, anyroom);
            } else {
                if ((i > sx || isok(i - 1, sy - 1))
                    && levl()[i - 1][sy - 1].typ == fg_typ) {
                    if ((levl()[i - 1][sy - 1].roomno) != rmno)
                        flood_fill_rm(i - 1, sy - 1, rmno, lit, anyroom);
                }
                if ((i < nx - 1 || isok(i + 1, sy - 1))
                    && levl()[i + 1][sy - 1].typ == fg_typ) {
                    if ((levl()[i + 1][sy - 1].roomno) != rmno)
                        flood_fill_rm(i + 1, sy - 1, rmno, lit, anyroom);
                }
            }
    }
    if (isok(sx, sy + 1)) {
        for (i = sx; i < nx; i++)
            if (levl()[i][sy + 1].typ == fg_typ) {
                if ((levl()[i][sy + 1].roomno) != rmno)
                    flood_fill_rm(i, sy + 1, rmno, lit, anyroom);
            } else {
                if ((i > sx || isok(i - 1, sy + 1))
                    && levl()[i - 1][sy + 1].typ == fg_typ) {
                    if ((levl()[i - 1][sy + 1].roomno) != rmno)
                        flood_fill_rm(i - 1, sy + 1, rmno, lit, anyroom);
                }
                if ((i < nx - 1 || isok(i + 1, sy + 1))
                    && levl()[i + 1][sy + 1].typ == fg_typ) {
                    if ((levl()[i + 1][sy + 1].roomno) != rmno)
                        flood_fill_rm(i + 1, sy + 1, rmno, lit, anyroom);
                }
            }
    }

    if (nx > gm.max_rx)
        gm.max_rx = nx - 1; /* nx is just past valid region */
    if (sy > gm.max_ry)
        gm.max_ry = sy;
}

/* join_map uses temporary rooms; clean up after it */
function join_map_cleanup() { /* void */
    let x, y;

    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++)
            levl()[x][y].roomno = NO_ROOM;
    svn.nroom = gn.nsubroom = 0;
    svr.rooms[svn.nroom].hx = ptr_add(gs.subrooms, gn.nsubroom).hx = -1;
}

function join_map(bg_typ, fg_typ) { /* void */
    const $frame = stack_frame(); try {
    var croom, croom2;

    var x, y, sx, sy;
    var sm = stack_struct(struct_nhcoord), em = stack_struct(struct_nhcoord);

    /* first, use flood filling to find all of the regions that need joining
     */
    joinm: { for (x = 2; x <= WIDTH; x++)
        for (y = 1; y < HEIGHT; y++) {
            if (levl()[x][y].typ == fg_typ && levl()[x][y].roomno == NO_ROOM) {
                gm.min_rx = gm.max_rx = x;
                gm.min_ry = gm.max_ry = y;
                gn.n_loc_filled = 0;
                flood_fill_rm(x, y, svn.nroom + ROOMOFFSET, FALSE, FALSE);
                if (gn.n_loc_filled > 3) {
                    add_room(gm.min_rx, gm.min_ry, gm.max_rx, gm.max_ry,
                             FALSE, OROOM, TRUE);
                    elt(svr.rooms, svn.nroom - 1).irregular = TRUE;
                    if (svn.nroom >= (MAXNROFROOMS * 2))
                        break joinm;;
                } else {
                    /*
                     * it's a tiny hole; erase it from the map to avoid
                     * having the player end up here with no way out.
                     */
                    for (sx = gm.min_rx; sx <= gm.max_rx; sx++)
                        for (sy = gm.min_ry; sy <= gm.max_ry; sy++)
                            if ((levl()[sx][sy].roomno)
                                == svn.nroom + ROOMOFFSET) {
                                levl()[sx][sy].typ = bg_typ;
                                levl()[sx][sy].roomno = NO_ROOM;
                            }
                }
            }
        }
 }
    /*
     * Ok, now we can actually join the regions with fg_typ's.
     * The rooms are already sorted due to the previous loop,
     * so don't call sort_rooms(), which can screw up the roomno's
     * validity in the levl structure.
     */
    for (croom = svr.rooms[0], croom2 = ptr_add(croom, 1);
         croom2 < svr.rooms[svn.nroom]; ) {
        /* pick random starting and end locations for "corridor" */
        if (!somexy(croom, sm) || !somexy(croom2, em)) {
            /* ack! -- the level is going to be busted */
            /* arbitrarily pick centers of both rooms and hope for the best */
            impossible(_("No start/end room loc in join_map."));
            sm.x = croom.lx + Math.trunc((croom.hx - croom.lx) / 2);
            sm.y = croom.ly + Math.trunc((croom.hy - croom.ly) / 2);
            em.x = croom2.lx + Math.trunc((croom2.hx - croom2.lx) / 2);
            em.y = croom2.ly + Math.trunc((croom2.hy - croom2.ly) / 2);
        }

        dig_corridor(sm, em, null, FALSE, fg_typ, bg_typ);

        /* choose next region to join */
        /* only increment croom if croom and croom2 are non-overlapping */
        if (croom2.lx > croom.hx
            || ((croom2.ly > croom.hy || croom2.hy < croom.ly)
                && rn2(3))) {
            croom = croom2;
        }
        croom2 = ptr_add(croom2, 1); /* always increment the next room */
    }
    join_map_cleanup();
    } finally { stack_pop($frame); }
}

function finish_map(
    fg_typ,
    bg_typ,
    lit,
    walled,
    icedpools) { /* void */
    let x, y;

    if (walled)
        wallify_map(1, 0, COLNO-1, ROWNO-1);

    if (lit) {
        for (x = 1; x < COLNO; x++)
            for (y = 0; y < ROWNO; y++)
                if ((!IS_OBSTRUCTED(fg_typ) && levl()[x][y].typ == fg_typ)
                    || (!IS_OBSTRUCTED(bg_typ) && levl()[x][y].typ == bg_typ)
                    || (bg_typ == TREE && levl()[x][y].typ == bg_typ)
                    || (walled && IS_WALL(levl()[x][y].typ)))
                    levl()[x][y].lit = TRUE;
        for (x = 0; x < svn.nroom; x++)
            svr.rooms[x].rlit = 1;
    }
    /* light lava even if everything's otherwise unlit;
       ice might be frozen pool rather than frozen moat */
    for (x = 1; x < COLNO; x++)
        for (y = 0; y < ROWNO; y++) {
            if (levl()[x][y].typ == LAVAPOOL)
                levl()[x][y].lit = TRUE;
            else if (levl()[x][y].typ == ICE)
                levl()[x][y].flags = icedpools ? ICED_POOL : ICED_MOAT;
        }
}

/*
 * TODO: If we really want to remove rooms after a map is plopped down
 * in a special level, this needs to be rewritten - the maps may have
 * holes in them ("x" mapchar), leaving parts of rooms still on the map.
 *
 * When level processed by join_map is overlaid by a MAP, some rooms may no
 * longer be valid.  All rooms in the region lx <= x < hx, ly <= y < hy are
 * removed.  Rooms partially in the region are truncated.  This function
 * must be called before the REGIONs or ROOMs of the map are processed, or
 * those rooms will be removed as well.  Assumes roomno fields in the
 * region are already cleared, and roomno and irregular fields outside the
 * region are all set.
 */
export function remove_rooms(lx, ly, hx, hy) { /* void */
    let i;
    let croom;

    for (i = svn.nroom - 1; i >= 0; --i) {
        croom = svr.rooms[i];
        if (croom.hx < lx || croom.lx >= hx || croom.hy < ly
            || croom.ly >= hy)
            continue; /* no overlap */

        if (croom.lx < lx || croom.hx >= hx || croom.ly < ly
            || croom.hy >= hy) { /* partial overlap */
            /* TODO: ensure remaining parts of room are still joined */

            if (!croom.irregular)
                impossible(_("regular room in joined map"));
        } else {
            /* total overlap, remove the room */
            remove_room(unsigned(i));
        }
    }
}

/*
 * Remove roomno from the rooms array, decrementing nroom.
 * The last room is swapped with the being-removed room and locations
 * within it have their roomno field updated.  Other rooms are unaffected.
 * Assumes level structure contents corresponding to roomno have already
 * been reset.
 * Currently handles only the removal of rooms that have no subrooms.
 */
function remove_room(roomno) { /* void */
    let croom = svr.rooms[roomno];
    let maxroom = svr.rooms[--svn.nroom];
    let x, y;
    let oroomno;

    if (croom != maxroom) {
        /* since the order in the array only matters for making corridors,
         * copy the last room over the one being removed on the assumption
         * that corridors have already been dug. */
        struct_assign(croom, maxroom);

        /* since maxroom moved, update affected level roomno values */
        oroomno = unsigned(svn.nroom + ROOMOFFSET);
        roomno = unsigned(roomno + ROOMOFFSET);
        for (x = croom.lx; x <= croom.hx; ++x)
            for (y = croom.ly; y <= croom.hy; ++y) {
                if (levl()[x][y].roomno == oroomno)
                    levl()[x][y].roomno = roomno;
            }
    }

    maxroom.hx = -1; /* just like add_room */
}

export const N_P1_ITER = 1;
export const N_P2_ITER = 1;
export const N_P3_ITER = 2;

export function litstate_rnd(litstate) { /* boolean */
    if (litstate < 0)
        return (rnd(1 + abs(depth(u.uz))) < 11 && rn2(77)) ? TRUE : FALSE;
    return boolean(litstate);
}

export function mkmap(init_lev) { /* void */
    let bg_typ = init_lev.bg, fg_typ = init_lev.fg;
    let smooth = init_lev.smoothed, join = init_lev.joined;
    let lit = init_lev.lit, walled = init_lev.walled;
    let i;

    lit = litstate_rnd(lit);

    gn.new_locations = addr_of(alloc((WIDTH + 1) * HEIGHT));

    init_map(bg_typ);
    init_fill(bg_typ, fg_typ);

    for (i = 0; i < N_P1_ITER; i++)
        pass_one(bg_typ, fg_typ);

    for (i = 0; i < N_P2_ITER; i++)
        pass_two(bg_typ, fg_typ);

    if (smooth)
        for (i = 0; i < N_P3_ITER; i++)
            pass_three(bg_typ, fg_typ);

    if (join)
        join_map(bg_typ, fg_typ);

    finish_map(fg_typ, bg_typ, boolean(lit), boolean(walled),
               init_lev.icedpools);
    /* a walled, joined level is cavernous, not mazelike -dlc */
    if (walled && join) {
        svl.level.flags.is_maze_lev = FALSE;
        svl.level.flags.is_cavernous_lev = TRUE;
    }
    free(gn.new_locations);
}

/*mkmap.c*/

import { struct_nhcoord } from "./coord.h.js";
import { COLNO, FALSE, MAXNROFROOMS, ROWNO, TRUE, boolean, coordxy } from "./global.h.js";
import { rn1 } from "./hack.h.macros.js";
import { NO_ROOM, OROOM, ROOMOFFSET, SHARED } from "./mkroom.h.js";
import { ICE, ICED_MOAT, ICED_POOL, LAVAPOOL, SDOOR, TREE } from "./rm.h.js";
import { IS_DOOR, IS_OBSTRUCTED, IS_ROOM, IS_WALL, levl } from "./rm.h.macros.js";
import { int, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { abs, free } from "../rt/libc.js";
import { stack_struct, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, elt, ptr_add, struct_assign } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { isok } from "./cmd.js";
import { gm, gn, gs, svl, svn, svr, u } from "./decl.js";
import { depth } from "./dungeon.js";
import { add_room } from "./mklev.js";
import { somexy } from "./mkroom.js";
import { impossible } from "./pline.js";
import { rn2, rnd } from "./rnd.js";
import { dig_corridor, wallify_map } from "./sp_lev.js";
