/* NetHack 5.0	sys.c	$NHDT-Date: 1717449153 2024/06/03 21:12:33 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.64 $ */
/* Copyright (c) Kenneth Lorber, Kensington, Maryland, 2008. */
/* NetHack may be freely redistributed.  See license for details. */

/* #ifndef SYSCF: not in this build */

export const sysopt = static_struct("sysopt", struct_sysopt_s);

export function sys_early_init() { /* void */
    let p;

    /* Don't assume that these are not already set, and that it is
     * safe to dupstr() without orphaning any pointers. Check them. */

    sysopt.support = 0;
    sysopt.recover = 0;

    sysopt.wizards = 0;

    if ((p = getenv(_("DEBUGFILES"))) != 0) {
        if (sysopt.debugfiles)
            free(sysopt.debugfiles);
        sysopt.debugfiles = dupstr(p);
        sysopt.env_dbgfl = 1; /* prevent sysconf processing from overriding */
    } else {
        sysopt.debugfiles = 0;

        sysopt.env_dbgfl = 0;
    }

    sysopt.shellers = 0;
    sysopt.explorers = 0;
    sysopt.genericusers = 0;
    sysopt.msghandler = 0;
    sysopt.maxplayers = 0; /* XXX eventually replace MAX_NR_OF_PLAYERS */
    sysopt.bones_pools = 0;
    sysopt.livelog = LL_NONE;

    /* record file */
    sysopt.persmax = max(PERSMAX, 1);
    sysopt.entrymax = max(ENTRYMAX, 10);
    sysopt.pointsmin = max(POINTSMIN, 1);
    sysopt.pers_is_uid = PERS_IS_UID;
    sysopt.tt_oname_maxrank = 10;

    /* sanity checks */
    if (sysopt.pers_is_uid != 0 && sysopt.pers_is_uid != 1)
        panic(_("config error: PERS_IS_UID must be either 0 or 1"));

    /* #ifdef PANICTRACE: not in this build */

    sysopt.crashreporturl = 0;

    sysopt.check_save_uid = 1;
    sysopt.check_plname = 0;
    sysopt.seduce = 1; /* if it's compiled in, default to on */
    sysopt_seduce_set(sysopt.seduce);
    sysopt.saveformat[0] = sysopt.bonesformat[0] = historical;
    sysopt.accessibility = 0;

    /* help menu */
    sysopt.hideusage = 0;

    return;
}

export function sysopt_release() { /* void */
    if (sysopt.support)
        free(sysopt.support), sysopt.support = 0;
    if (sysopt.recover)
        free(sysopt.recover), sysopt.recover = 0;
    if (sysopt.wizards)
        free(sysopt.wizards), sysopt.wizards = 0;
    if (sysopt.explorers)
        free(sysopt.explorers), sysopt.explorers = 0;
    if (sysopt.shellers)
        free(sysopt.shellers), sysopt.shellers = 0;
    if (sysopt.debugfiles)
        free(sysopt.debugfiles),
        sysopt.debugfiles = 0;
    sysopt.env_dbgfl = 0;
    if (sysopt.msghandler)
        free(sysopt.msghandler), sysopt.msghandler = 0;

    if (sysopt.genericusers)
        free(sysopt.genericusers),
            sysopt.genericusers = 0;
    if (sysopt.gdbpath)
        free(sysopt.gdbpath), sysopt.gdbpath = 0;
    if (sysopt.greppath)
        free(sysopt.greppath), sysopt.greppath = 0;

    /* this one's last because it might be used in panic feedback, although
       none of the preceding ones are likely to trigger a controlled panic */
    if (sysopt.fmtd_wizard_list)
        free(sysopt.fmtd_wizard_list),
            sysopt.fmtd_wizard_list = 0;
    return;
}

export function sysopt_seduce_set(

val) { /* void */
    return;
}

/*sys.c*/

import { ENTRYMAX, PERSMAX, PERS_IS_UID, POINTSMIN } from "./config.h.js";
import { LL_NONE } from "./global.h.js";
import { historical } from "./hack.h.js";
import { max } from "./hack.h.macros.js";
import { struct_sysopt_s } from "./sys.h.js";
import { free, getenv } from "../rt/libc.js";
import { static_struct } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { dupstr } from "./alloc.js";
import { panic } from "./end.js";
