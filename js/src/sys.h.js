/* NetHack 5.0	sys.h	$NHDT-Date: 1693083207 2023/08/26 20:53:27 $  $NHDT-Branch: keni-crashweb2 $:$NHDT-Revision: 1.41 $ */
/* Copyright (c) Kenneth Lorber, Kensington, Maryland, 2008. */
/* NetHack may be freely redistributed.  See license for details. */

export const struct_sysopt_s = struct("struct_sysopt_s", {
    support: ptr_to(char), /* local support contact */
    recover: ptr_to(char), /* how to run recover - may be overridden by win port */
    wizards: ptr_to(char), /* space-separated list of usernames */
    fmtd_wizard_list: ptr_to(char), /* formatted version of wizards; null or "one"
                               or "one or two" or "one, two, or three", &c */
    explorers: ptr_to(char), /* like wizards, but for access to explore mode */
    shellers: ptr_to(char), /* like wizards, for ! command (-DSHELL); also ^Z */
    genericusers: ptr_to(char), /* usernames that prompt for user name */
    debugfiles: ptr_to(char), /* files to show debugplines in. '*' is all. */
    msghandler: ptr_to(char),

    /* where the dump file is saved */

    env_dbgfl: int, /*  1: debugfiles comes from getenv("DEBUGFILES")
                       *     so sysconf's DEBUGFILES shouldn't override it;
                       *  0: getenv() hasn't been attempted yet;
                       * -1: getenv() didn't find a value for DEBUGFILES.
                       */
    maxplayers: int,
    seduce: int,
    check_save_uid: int, /* restoring savefile checks UID? */
    check_plname: int, /* use plname for checking wizards/explorers/shellers */
    bones_pools: int,
    livelog: long, /* LL_foo events to livelog */

    /* record file */
    persmax: int,
    pers_is_uid: int,
    entrymax: int,
    pointsmin: int,
    tt_oname_maxrank: int,

    /* panic options */
    gdbpath: ptr_to(char),
    greppath: ptr_to(char),
    crashreporturl: ptr_to(char),
    panictrace_gdb: int,
    panictrace_libc: int,

    /* save and bones format */
    saveformat: array_of(int, 2), /* primary and onetime conversion */
    bonesformat: array_of(int, 2), /* primary and onetime conversion */

    /* enable accessibility options */
    accessibility: int,

    /* nethack config for a portable device */

    /* nethack's interactive help menu */
    hideusage: int, /* 0: include 'command-line usage' entry in help menu;
                         * 1: suppress it */
});

import { char, int, long } from "../rt/ctypes.js";
import { array_of, ptr_to, struct } from "../rt/struct.js";
