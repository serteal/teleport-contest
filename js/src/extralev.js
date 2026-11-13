/* NetHack 5.0	extralev.c	$NHDT-Date: 1737345573 2025/01/19 19:59:33 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.28 $ */
/*      Copyright 1988, 1989 by Ken Arromdee                      */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Support code for "rogue"-style level.
 */

export const XL_UP = 1;
export const XL_DOWN = 2;
export const XL_LEFT = 4;
export const XL_RIGHT = 8;

function roguejoin(x1, y1, x2, y2, horiz) { /* void */
    let x, y, middle;

    if (horiz) {
        middle = x1 + rn2(x2 - x1 + 1);
        for (x = min(x1, middle); x <= max(x1, middle); x++)
            corr(x, y1);
        for (y = min(y1, y2); y <= max(y1, y2); y++)
            corr(middle, y);
        for (x = min(middle, x2); x <= max(middle, x2); x++)
            corr(x, y2);
    } else {
        middle = y1 + rn2(y2 - y1 + 1);
        for (y = min(y1, middle); y <= max(y1, middle); y++)
            corr(x1, y);
        for (x = min(x1, x2); x <= max(x1, x2); x++)
            corr(x, middle);
        for (y = min(middle, y2); y <= max(middle, y2); y++)
            corr(x2, y);
    }
}

function roguecorr(x, y, dir) { /* void */
    let fromx, fromy, tox, toy;

    if (dir == XL_DOWN) {
        gr.r[x][y].doortable &= ~XL_DOWN;
        if (!gr.r[x][y].real) {
            fromx = gr.r[x][y].rlx;
            fromy = gr.r[x][y].rly;
            fromx += 1 + 26 * x;
            fromy += 7 * y;
        } else {
            fromx = gr.r[x][y].rlx + rn2(gr.r[x][y].dx);
            fromy = gr.r[x][y].rly + gr.r[x][y].dy;
            fromx += 1 + 26 * x;
            fromy += 7 * y;
            if (!IS_WALL(levl()[fromx][fromy].typ))
                impossible(_("down: no wall at %d,%d?"), fromx, fromy);
            dodoor(fromx, fromy, svr.rooms[gr.r[x][y].nroom]);
            levl()[fromx][fromy].flags = D_NODOOR;
            fromy++;
        }
        if (y >= 2) {
            impossible(_("down door from %d,%d going nowhere?"), x, y);
            return;
        }
        y++;
        gr.r[x][y].doortable &= ~XL_UP;
        if (!gr.r[x][y].real) {
            tox = gr.r[x][y].rlx;
            toy = gr.r[x][y].rly;
            tox += 1 + 26 * x;
            toy += 7 * y;
        } else {
            tox = gr.r[x][y].rlx + rn2(gr.r[x][y].dx);
            toy = gr.r[x][y].rly - 1;
            tox += 1 + 26 * x;
            toy += 7 * y;
            if (!IS_WALL(levl()[tox][toy].typ))
                impossible(_("up: no wall at %d,%d?"), tox, toy);
            dodoor(tox, toy, svr.rooms[gr.r[x][y].nroom]);
            levl()[tox][toy].flags = D_NODOOR;
            toy--;
        }
        roguejoin(fromx, fromy, tox, toy, FALSE);
        return;
    } else if (dir == XL_RIGHT) {
        gr.r[x][y].doortable &= ~XL_RIGHT;
        if (!gr.r[x][y].real) {
            fromx = gr.r[x][y].rlx;
            fromy = gr.r[x][y].rly;
            fromx += 1 + 26 * x;
            fromy += 7 * y;
        } else {
            fromx = gr.r[x][y].rlx + gr.r[x][y].dx;
            fromy = gr.r[x][y].rly + rn2(gr.r[x][y].dy);
            fromx += 1 + 26 * x;
            fromy += 7 * y;
            if (!IS_WALL(levl()[fromx][fromy].typ))
                impossible(_("down: no wall at %d,%d?"), fromx, fromy);
            dodoor(fromx, fromy, svr.rooms[gr.r[x][y].nroom]);
            levl()[fromx][fromy].flags = D_NODOOR;
            fromx++;
        }
        if (x >= 2) {
            impossible(_("right door from %d,%d going nowhere?"), x, y);
            return;
        }
        x++;
        gr.r[x][y].doortable &= ~XL_LEFT;
        if (!gr.r[x][y].real) {
            tox = gr.r[x][y].rlx;
            toy = gr.r[x][y].rly;
            tox += 1 + 26 * x;
            toy += 7 * y;
        } else {
            tox = gr.r[x][y].rlx - 1;
            toy = gr.r[x][y].rly + rn2(gr.r[x][y].dy);
            tox += 1 + 26 * x;
            toy += 7 * y;
            if (!IS_WALL(levl()[tox][toy].typ))
                impossible(_("left: no wall at %d,%d?"), tox, toy);
            dodoor(tox, toy, svr.rooms[gr.r[x][y].nroom]);
            levl()[tox][toy].flags = D_NODOOR;
            tox--;
        }
        roguejoin(fromx, fromy, tox, toy, TRUE);
        return;
    } else
        impossible(_("corridor in direction %d?"), dir);
}

/* Modified walkfrom() from mkmaze.c */
function miniwalk(x, y) { /* void */
    const $frame = stack_frame(); try {
    let q, dir;
    let dirs = stack_array(int, 4);

    while (1) {
        q = 0;

        if (x > 0 && (!((gr.r[x][y].doortable) & XL_LEFT))
            && (!gr.r[x - 1][y].doortable || !rn2(10)))
            dirs[q++] = 0;
        if (x < 2 && (!((gr.r[x][y].doortable) & XL_RIGHT))
            && (!gr.r[x + 1][y].doortable || !rn2(10)))
            dirs[q++] = 1;
        if (y > 0 && (!((gr.r[x][y].doortable) & XL_UP))
            && (!elt(gr.r[x], y - 1).doortable || !rn2(10)))
            dirs[q++] = 2;
        if (y < 2 && (!((gr.r[x][y].doortable) & XL_DOWN))
            && (!gr.r[x][y + 1].doortable || !rn2(10)))
            dirs[q++] = 3;
        /* Rogue levels aren't just 3 by 3 mazes; they have some extra
         * connections, thus that 1/10 chance
         */
        if (!q)
            return;
        dir = dirs[rn2(q)];
        switch (dir) { /* Move in direction */
        case 0:
            (gr.r[x][y].doortable) |= XL_LEFT;
            x--;
            (gr.r[x][y].doortable) |= XL_RIGHT;
            break;
        case 1:
            (gr.r[x][y].doortable) |= XL_RIGHT;
            x++;
            (gr.r[x][y].doortable) |= XL_LEFT;
            break;
        case 2:
            (gr.r[x][y].doortable) |= XL_UP;
            y--;
            (gr.r[x][y].doortable) |= XL_DOWN;
            break;
        case 3:
            (gr.r[x][y].doortable) |= XL_DOWN;
            y++;
            (gr.r[x][y].doortable) |= XL_UP;
            break;
        }
        miniwalk(x, y);
    }
    } finally { stack_pop($frame); }
}

export function makeroguerooms() { /* void */
    let x, y;
    /* Rogue levels are structured 3 by 3, with each section containing
     * a room or an intersection.  The minimum width is 2 each way.
     * One difference between these and "real" Rogue levels: real Rogue
     * uses 24 rows and NetHack only 23.  So we cheat a bit by making the
     * second row of rooms not as deep.
     *
     * Each normal space has 6/7 rows and 25 columns in which a room may
     * actually be placed.  Walls go from rows 0-5/6 and columns 0-24.
     * Not counting walls, the room may go in
     * rows 1-5 and columns 1-23 (numbering starting at 0).  A room
     * coordinate of this type may be converted to a level coordinate
     * by adding 1+28*x to the column, and 7*y to the row.  (The 1
     * is because column 0 isn't used [we only use 1-78]).
     * Room height may be 2-4 (2-5 on last row), length 2-23 (not
     * counting walls).
     */

    svn.nroom = 0;
    for (y = 0; y < 3; y++)
        for (x = 0; x < 3; x++) {
            /* Note: we want to insure at least 1 room.  So, if the
             * first 8 are all dummies, force the last to be a room.
             */
            if (!rn2(5) && (svn.nroom || (x < 2 && y < 2))) {
                /* Arbitrary: dummy rooms may only go where real
                 * ones do.
                 */
                gr.r[x][y].real = FALSE;
                gr.r[x][y].rlx = rn1(22, 2);
                gr.r[x][y].rly = rn1((y == 2) ? 4 : 3, 2);
            } else {
                gr.r[x][y].real = TRUE;
                gr.r[x][y].dx = rn1(22, 2); /* 2-23 long, plus walls */
                gr.r[x][y].dy = rn1((y == 2) ? 4 : 3, 2); /* 2-5 high, plus walls */

                /* boundaries of room floor */
                gr.r[x][y].rlx = rnd(23 - gr.r[x][y].dx + 1);
                gr.r[x][y].rly = rnd(((y == 2) ? 5 : 4) - gr.r[x][y].dy + 1);
                svn.nroom++;
            }
            gr.r[x][y].doortable = 0;
        }
    miniwalk(rn2(3), rn2(3));
    svn.nroom = 0;
    for (y = 0; y < 3; y++)
        for (x = 0; x < 3; x++) {
            if (gr.r[x][y].real) { /* Make a room */
                let lowx, lowy, hix, hiy;

                gr.r[x][y].nroom = svn.nroom;
                gs.smeq[svn.nroom] = svn.nroom;

                lowx = 1 + 26 * x + gr.r[x][y].rlx;
                lowy = 7 * y + gr.r[x][y].rly;
                hix = 1 + 26 * x + gr.r[x][y].rlx + gr.r[x][y].dx - 1;
                hiy = 7 * y + gr.r[x][y].rly + gr.r[x][y].dy - 1;
                /* Strictly speaking, it should be lit only if above
                 * level 10, but since Rogue rooms are only
                 * encountered below level 10, use !rn2(7).
                 */
                add_room(lowx, lowy, hix, hiy, (+!rn2(7)), OROOM,
                         FALSE);
            }
        }

    /* Now, add connecting corridors. */
    for (y = 0; y < 3; y++)
        for (x = 0; x < 3; x++) {
            if (gr.r[x][y].doortable & XL_DOWN)
                roguecorr(x, y, XL_DOWN);
            if (gr.r[x][y].doortable & XL_RIGHT)
                roguecorr(x, y, XL_RIGHT);
            if (gr.r[x][y].doortable & XL_LEFT)
                impossible(_("left end of %d, %d never connected?"), x, y);
            if (gr.r[x][y].doortable & XL_UP)
                impossible(_("up end of %d, %d never connected?"), x, y);
        }
}

export function corr(x, y) { /* void */
    if (rn2(50)) {
        levl()[x][y].typ = CORR;
    } else {
        levl()[x][y].typ = SCORR;
    }
}

export function makerogueghost() { /* void */
    let ghost;
    let ghostobj;
    let croom;
    let x, y;

    if (!svn.nroom)
        return; /* Should never happen */
    croom = svr.rooms[rn2(svn.nroom)];
    x = somex(croom);
    y = somey(croom);
    if (!(ghost = makemon(mons[PM_GHOST], x, y, NO_MM_FLAGS)))
        return;
    ghost.msleeping = 1;
    ghost = christen_monst(ghost, roguename());
    (ghost);

    if (rn2(4)) {
        ghostobj = mksobj_at(FOOD_RATION, x, y, FALSE, FALSE);
        ghostobj.quan = rnd(7);
        ghostobj.owt = unsigned(weight(ghostobj));
    }
    if (rn2(2)) {
        ghostobj = mksobj_at(MACE, x, y, FALSE, FALSE);
        ghostobj.spe = rnd(3);
        if (rn2(4))
            curse(ghostobj);
    } else {
        ghostobj = mksobj_at(TWO_HANDED_SWORD, x, y, FALSE, FALSE);
        ghostobj.spe = rnd(5) - 2;
        if (rn2(4))
            curse(ghostobj);
    }
    ghostobj = mksobj_at(BOW, x, y, FALSE, FALSE);
    ghostobj.spe = 1;
    if (rn2(4))
        curse(ghostobj);

    ghostobj = mksobj_at(ARROW, x, y, FALSE, FALSE);
    ghostobj.spe = 0;
    ghostobj.quan = rn1(10, 25);
    ghostobj.owt = unsigned(weight(ghostobj));
    if (rn2(4))
        curse(ghostobj);

    if (rn2(2)) {
        ghostobj = mksobj_at(RING_MAIL, x, y, FALSE, FALSE);
        ghostobj.spe = rn2(3);
        if (!rn2(3))
            ghostobj.oerodeproof = TRUE;
        if (rn2(4))
            curse(ghostobj);
    } else {
        ghostobj = mksobj_at(PLATE_MAIL, x, y, FALSE, FALSE);
        ghostobj.spe = rnd(5) - 2;
        if (!rn2(3))
            ghostobj.oerodeproof = TRUE;
        if (rn2(4))
            curse(ghostobj);
    }
    if (rn2(2)) {
        ghostobj = mksobj_at(FAKE_AMULET_OF_YENDOR, x, y, TRUE, FALSE);
        ghostobj.known = TRUE;
    }
}

/*extralev.c*/

import { FALSE, TRUE } from "./global.h.js";
import { NO_MM_FLAGS } from "./hack.h.js";
import { max, min, rn1 } from "./hack.h.macros.js";
import { OROOM } from "./mkroom.h.js";
import { PM_GHOST } from "./monsters.h.js";
import {
    ARROW, BOW, FAKE_AMULET_OF_YENDOR, FOOD_RATION, MACE, PLATE_MAIL, RING_MAIL, TWO_HANDED_SWORD,
} from "./objects.h.js";
import { CORR, D_NODOOR, SCORR } from "./rm.h.js";
import { IS_WALL, levl } from "./rm.h.macros.js";
import { int, unsigned } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { stack_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { elt } from "../rt/struct.js";
import { gr, gs, svn, svr } from "./decl.js";
import { christen_monst, roguename } from "./do_name.js";
import { makemon } from "./makemon.js";
import { add_room, dodoor } from "./mklev.js";
import { curse, mksobj_at, weight } from "./mkobj.js";
import { somex, somey } from "./mkroom.js";
import { mons } from "./monst.js";
import { impossible } from "./pline.js";
import { rn2, rnd } from "./rnd.js";
