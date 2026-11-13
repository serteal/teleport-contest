/* NetHack 5.0	track.c	$NHDT-Date: 1596498219 2020/08/03 23:43:39 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.12 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Kenneth Lorber, Kensington, Maryland, 2015. */
/* NetHack may be freely redistributed.  See license for details. */
/* track.c - version 1.0.2 */

export const UTSZ = 100;

const utcnt = static_var("utcnt", int); const utpnt = static_var("utpnt", int);
const utrack = static_array("utrack", struct_nhcoord, UTSZ);

export function initrack() { /* void */
    utcnt[0] = utpnt[0] = 0;
    memset(addr_of(utrack), 0, sizeof(array_of(struct_nhcoord, UTSZ)));
}

/* add to track */
export function settrack() { /* void */
    if ((uleft && uleft.otyp == RIN_STEALTH)
        || (uright && uright.otyp == RIN_STEALTH))
        return;

    if (utcnt[0] < UTSZ)
        utcnt[0]++;
    if (utpnt[0] == UTSZ)
        utpnt[0] = 0;
    utrack[utpnt[0]].x = u.ux;
    utrack[utpnt[0]].y = u.uy;
    utpnt[0]++;
}

/* get a track coord on or next to x,y and last tracked by hero,
   returns null if no such track */
export function gettrack(x, y) { /* coord * */
    let cnt, ndist;
    let tc;
    cnt = utcnt[0];
    for (tc = ptr_add(utrack[0], utpnt[0]); cnt--;) {
        if (tc == utrack[0])
            tc = ptr_add(utrack[0], UTSZ - 1);
        else
            tc = ptr_add(tc, -1);
        ndist = distmin(x, y, tc.x, tc.y);

        if (ndist <= 1)
            return (ndist ? tc : null);
    }
    return null;
}

/* return TRUE if x,y has hero tracks on it */
export function hastrack(x, y) { /* boolean */
    let i;

    for (i = 0; i < utcnt[0]; i++)
        if (utrack[i].x == x && utrack[i].y == y)
            return TRUE;

    return FALSE;
}

/* save the hero tracking info */
export function save_track(nhfp) { /* void */
    if (update_file(nhfp)) {
        let i;

        Sfo_int(nhfp, utcnt, _("track-utcnt"));
        Sfo_int(nhfp, utpnt, _("track-utpnt"));
        for (i = 0; i < utcnt[0]; i++) {
            Sfo_nhcoord(nhfp, utrack[i], _("utrack"));
        }
    }
    if (release_data(nhfp))
        initrack();
}

/* restore the hero tracking info */
export function rest_track(nhfp) { /* void */
    let i;

    sfi_int(nhfp, utcnt, _("track-utcnt"));
    sfi_int(nhfp, utpnt, _("track-utpnt"));

    if (utcnt[0] > UTSZ || utpnt[0] > UTSZ)
        panic(_("rest_track: impossible pt counts"));
    for (i = 0; i < utcnt[0]; i++) {
        Sfi_nhcoord(nhfp, utrack[i], _("utrack"));
    }
}

/*track.c*/

import { struct_nhcoord } from "./coord.h.js";
import { FALSE, TRUE } from "./global.h.js";
import { release_data, update_file } from "./hack.h.macros.js";
import { RIN_STEALTH } from "./objects.h.js";
import { Sfi_nhcoord, Sfo_int, Sfo_nhcoord } from "./savefile.h.macros.js";
import { int, sizeof } from "../rt/ctypes.js";
import { memset } from "../rt/libc.js";
import { static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_add } from "../rt/struct.js";
import { u } from "./decl.js";
import { panic } from "./end.js";
import { distmin } from "./hacklib.js";
import { sfi_int } from "./sfbase.js";
