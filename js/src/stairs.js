/* NetHack 5.0	stairs.c	$NHDT-Date: 1704043695 2023/12/31 17:28:15 $  $NHDT-Branch: keni-luabits2 $:$NHDT-Revision: 1.207 $ */
/* Copyright (c) 2024 by Pasi Kallinen */
/* NetHack may be freely redistributed.  See license for details. */

export function stairway_add(
    x, y,
    up, isladder,
    dest) { /* void */
    let tmp = view_of(struct_stairway, addr_of(alloc(sizeof(struct_stairway))));

    memset(addr_of(tmp), 0, sizeof(struct_stairway));
    tmp.sx = x;
    tmp.sy = y;
    tmp.up = up;
    tmp.isladder = isladder;
    tmp.u_traversed = FALSE;
    assign_level(tmp.tolev, dest);
    tmp.next = gs.stairs;
    gs.stairs = tmp;
}

export function stairway_free_all() { /* void */
    let tmp = gs.stairs;

    while (tmp) {
        let tmp2 = tmp.next;
        free(addr_of(tmp));
        tmp = tmp2;
    }
    gs.stairs = null;
}

export function stairway_at(x, y) { /* stairway * */
    let tmp = gs.stairs;

    while (tmp && !(tmp.sx == x && tmp.sy == y))
        tmp = tmp.next;
    return tmp;
}

export function stairway_find(fromdlev) { /* stairway * */
    let tmp = gs.stairs;

    while (tmp) {
        if (tmp.tolev.dnum == fromdlev.dnum
            && tmp.tolev.dlevel == fromdlev.dlevel)
            break; /* return */
        tmp = tmp.next;
    }
    return tmp;
}

export function stairway_find_from(fromdlev, isladder) { /* stairway * */
    let tmp = gs.stairs;

    while (tmp) {
        if (tmp.tolev.dnum == fromdlev.dnum
            && tmp.tolev.dlevel == fromdlev.dlevel
            && tmp.isladder == isladder)
            break; /* return */
        tmp = tmp.next;
    }
    return tmp;
}

export function stairway_find_dir(up) { /* stairway * */
    let tmp = gs.stairs;

    while (tmp && !(tmp.up == up))
        tmp = tmp.next;
    return tmp;
}

export function stairway_find_type_dir(isladder, up) { /* stairway * */
    let tmp = gs.stairs;

    while (tmp && !(tmp.isladder == isladder && tmp.up == up))
        tmp = tmp.next;
    return tmp;
}

export function stairway_find_special_dir(up) { /* stairway * */
    let tmp = gs.stairs;

    while (tmp) {
        if (tmp.tolev.dnum != u.uz.dnum && tmp.up != up)
            return tmp;
        tmp = tmp.next;
    }
    return tmp;
}

/* place you on the special staircase */
export function u_on_sstairs(upflag) { /* void */
    let stway = stairway_find_special_dir(upflag);

    if (stway)
        u_on_newpos(stway.sx, stway.sy);
    else
        u_on_rndspot(upflag);
}

/* place you on upstairs (or special equivalent) */
export function u_on_upstairs() { /* void */
    let stway = stairway_find_dir(TRUE);

    if (stway)
        u_on_newpos(stway.sx, stway.sy);
    else
        u_on_sstairs(0); /* destination upstairs implies moving down */
}

/* place you on dnstairs (or special equivalent) */
export function u_on_dnstairs() { /* void */
    let stway = stairway_find_dir(FALSE);

    if (stway)
        u_on_newpos(stway.sx, stway.sy);
    else
        u_on_sstairs(1); /* destination dnstairs implies moving up */
}

export function On_stairs(x, y) { /* boolean */
    return +(stairway_at(x, y) != null);
}

export function On_ladder(x, y) { /* boolean */
    let stway = stairway_at(x, y);

    return (stway && stway.isladder ? 1 : 0);
}

export function On_stairs_up(x, y) { /* boolean */
    let stway = stairway_at(x, y);

    return (stway && stway.up ? 1 : 0);
}

export function On_stairs_dn(x, y) { /* boolean */
    let stway = stairway_at(x, y);

    return (stway && !stway.up ? 1 : 0);
}

/* return True if 'sway' is a branch staircase and hero has used these stairs
   to visit the branch */
export function known_branch_stairs(sway) { /* boolean */
    return (sway && sway.tolev.dnum != u.uz.dnum && sway.u_traversed ? 1 : 0);
}

/* describe staircase 'sway' based on whether hero knows the destination */
export function stairs_description(
    sway,
    outbuf,
    stcase) { /* char * */ /* True: "staircase" or "ladder", always singular; * False: "stairs" or "ladder"; caller needs to deal * with singular vs plural when forming a sentence */
    const $frame = stack_frame(); try {
    let tolev = stack_struct(struct_d_level);
    let stairs, updown;

    struct_assign(tolev, sway.tolev);
    stairs = sway.isladder ? _("ladder") : stcase ? _("staircase") : _("stairs");
    updown = sway.up ? _("up") : _("down");

    if (!known_branch_stairs(sway)) {
        /* ordinary stairs or branch stairs to not-yet-visited branch */
        sprintf(outbuf, _("%s %s"), stairs, updown);
        if (sway.u_traversed) {
            let specialdepth = (tolev.dnum == quest_dnum()
                                    || single_level_branch(tolev) ? 1 : 0); /* knox */
            let to_dlev = specialdepth ? dunlev(tolev) : depth(tolev);

            sprintf(eos(outbuf), _(" to level %d"), to_dlev);
        }
    } else if (u.uz.dnum == 0 && u.uz.dlevel == 1 && sway.up) {
        /* stairs up from level one are a special case; they are marked
           as having been traversed because the hero obviously started
           the game by coming down them, but the remote side varies
           depending on whether the Amulet is being carried */
        sprintf(outbuf, _("%s%s %s %s"), !u.uhave.amulet ? _("") : _("branch "), stairs, updown, !u.uhave.amulet ? _("out of the dungeon")
                /* minimize our expectations about what comes next */
                : (on_level(tolev, svd.dungeon_topology.d_earth_level)
                   || on_level(tolev, svd.dungeon_topology.d_air_level)
                   || on_level(tolev, svd.dungeon_topology.d_fire_level)
                   || on_level(tolev, svd.dungeon_topology.d_water_level))
                  ? _("to the Elemental Planes")
                  : _("to the end game"))

;
    } else {
        /* known branch stairs; tacking on destination level is too verbose */
        sprintf(outbuf, _("branch %s %s to %s"), stairs, updown, svd.dungeons[tolev.dnum].dname)
;
        /* dungeons[].dname is capitalized; undo that for "The <Branch>" */
        strsubst(outbuf, _("The "), _("the "));
    }
    return outbuf;
    } finally { stack_pop($frame); }
}

/*stairs.c*/

import { struct_d_level } from "./dungeon.h.js";
import { FALSE, TRUE } from "./global.h.js";
import { quest_dnum } from "./hack.h.macros.js";
import { struct_stairway } from "./stairs.h.js";
import { sizeof } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { free, memset, sprintf } from "../rt/libc.js";
import { stack_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, struct_assign, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { gs, svd, u } from "./decl.js";
import {
    assign_level, depth, dunlev, on_level, single_level_branch, u_on_newpos, u_on_rndspot,
} from "./dungeon.js";
import { eos, strsubst } from "./hacklib.js";
