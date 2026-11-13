/* NetHack 5.0	lint.h	$NHDT-Date: 1655631029 2022/06/19 09:30:29 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.8 $ */
/*      Copyright (c) 2016 by Robert Patrick Rankin               */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Hacks to suppress compiler warnings.  Use with caution.
 * Assumes it has been preceded by '#include "config.h"' but
 * not necessarily by '#include "hack.h"'.
 */

/* cast away implicit const from a string literal (caller's responsibility
   to ensure that) in order to avoid a warning from 'gcc -Wwrite-strings'
   (also caller's responsibility to ensure it isn't actually modified!) */
export function nhStr(str) { return str; }

/*
 * This stuff isn't related to lint suppression but lives here to
 * avoid cluttering up hack.h.
 */
/* [DEBUG shouldn't be defined unless you know what you're doing...] */

export function showdebug(file) { return debugcore(file, TRUE); }
export function explicitdebug(file) { return debugcore(file, FALSE); }
    /* in case 'stmt' is pline() or something which calls pline(),
       save and restore previous plnmsg code so that use of debugpline()
       doesn't change message semantics */

/* if we have microsoft's C runtime we can use these instead */

/* these don't require compiler support for C99 variadic macros */
export function debugpline0(str, __FILE__) { do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(str); iflags.last_msg = save_plnmsg; } } while (0) }
export function debugpline1(fmt, arg, __FILE__) { do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(fmt, arg); iflags.last_msg = save_plnmsg; } } while (0) }
export function debugpline2(fmt, a1, a2, __FILE__) { do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(fmt, a1, a2); iflags.last_msg = save_plnmsg; } } while (0) }
export function debugpline3(fmt, a1, a2, a3, __FILE__) { do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(fmt, a1, a2, a3); iflags.last_msg = save_plnmsg; } } while (0) }
export function debugpline4(fmt, a1, a2, a3, a4, __FILE__) { do { if (showdebug(_(__FILE__))) { let save_plnmsg = iflags.last_msg; pline(fmt, a1, a2, a3, a4); iflags.last_msg = save_plnmsg; } } while (0) }

import { FALSE, TRUE } from "./global.h.js";
import { _ } from "../rt/strings.js";
import { iflags } from "./decl.js";
import { debugcore } from "./files.js";
import { pline } from "./pline.js";
