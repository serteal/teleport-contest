/* NetHack 5.0	rip.c	$NHDT-Date: 1597967808 2020/08/20 23:56:48 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.33 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2017. */
/* NetHack may be freely redistributed.  See license for details. */

/* Defining TEXT_TOMBSTONE causes genl_outrip() to exist, but it doesn't
   necessarily have to be used by a binary with multiple window-ports */

/* A normal tombstone for end of game display. */
const rip_txt = static_array("rip_txt", ptr_to(char), null, [
    _("                       ----------"),
    _("                      /          \\"),
    _("                     /    REST    \\"),
    _("                    /      IN      \\"),
    _("                   /     PEACE      \\"),
    _("                  /                  \\"),
    _("                  |                  |"), /* Name of player */
    _("                  |                  |"), /* Amount of $ */
    _("                  |                  |"), /* Type of death */
    _("                  |                  |"), /* . */
    _("                  |                  |"), /* . */
    _("                  |                  |"), /* . */
    _("                  |       1001       |"), /* Real year of death */
    _("                 *|     *  *  *      | *"),
    _("        _________)/\\\\_//(\\/(/\\)/\\//\\/|_)_______"), 0
]);
export const STONE_LINE_CENT = 28;
/* #else (#ifndef NH320_DEDICATION): not in this build */

export const STONE_LINE_LEN = 16;

export const NAME_LINE = 6;
export const GOLD_LINE = 7;
export const DEATH_LINE = 8;
export const YEAR_LINE = 12;

function center(line, text) { /* void */
    let ip, op;
    ip = text;
    op = gr.rip[line] + unsigned(STONE_LINE_CENT - (unsigned(strlen(text) + 1) >>> 1));
    while (chars[ip])
        chars[op++] = chars[ip++];
}

export function genl_outrip(tmpwin, how, when) { /* void */
    const $frame = stack_frame(); try {
    let dp;
    let dpx;
    let buf = stack_array(char, BUFSZ);
    let x;
    let line, year;
    let cash;

    gr.rip = dp = ref_to(ptr_to(char), addr_of(alloc(static_sizeof("rip_txt"))));
    for (x = 0; rip_txt[x]; ++x)
        dp[x] = dupstr(rip_txt[x]);
    dp[x] = 0;

    /* Put name on stone */
    sprintf(buf, _("%.*s"), STONE_LINE_LEN, svp.plname);
    center(NAME_LINE, buf);

    /* Put $ on stone */
    cash = max(gd.done_money, 0);
    /* arbitrary upper limit; practical upper limit is quite a bit less */
    if (cash > 999999999)
        cash = 999999999;
    sprintf(buf, _("%lld Au"), cash);
    center(GOLD_LINE, buf);

    /* Put together death description */
    formatkiller(buf, sizeof(array_of(char, BUFSZ)), how, FALSE);

    /* Put death type on stone */
    for (line = DEATH_LINE, dpx = buf; line < YEAR_LINE; line++) {
        let tmpchar;
        let i, i0 = int(strlen(dpx));

        if (i0 > STONE_LINE_LEN) {
            for (i = STONE_LINE_LEN; (i > 0) && (i0 > STONE_LINE_LEN); --i)
                if (chars[dpx + i] == ord(' '))
                    i0 = i;
            if (!i)
                i0 = STONE_LINE_LEN;
        }
        tmpchar = chars[dpx + i0];
        chars[dpx + i0] = 0;
        center(line, dpx);
        if (tmpchar != ord(' ')) {
            chars[dpx + i0] = tmpchar;
            dpx = dpx + i0;
        } else
            dpx = dpx + (i0 + 1);
    }

    /* Put year on stone */
    year = (Math.trunc(yyyymmdd(when) / 10000) % 10000);
    sprintf(buf, _("%4d"), year);
    center(YEAR_LINE, buf);

        putstr()(tmpwin, 0, _(""));

    for (; dp[0]; dp = dp.subarray(1))
        putstr()(tmpwin, 0, dp[0]);

    putstr()(tmpwin, 0, _(""));

        putstr()(tmpwin, 0, _(""));

    for (x = 0; rip_txt[x]; x++) {
        free((gr.rip[x]));
    }
    free(addr_of(gr.rip));
    gr.rip = null;
    } finally { stack_pop($frame); }
}

/*rip.c*/

import { BUFSZ, FALSE } from "./global.h.js";
import { max } from "./hack.h.macros.js";
import { putstr } from "./winprocs.h.macros.js";
import { char, int, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { free, sprintf, strlen } from "../rt/libc.js";
import { stack_array, static_array, static_sizeof } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ptr_to, ref_to } from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { yyyymmdd } from "./calendar.js";
import { gd, gr, svp } from "./decl.js";
import { formatkiller } from "./topten.js";
