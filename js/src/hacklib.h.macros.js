/* NetHack 5.0	hacklib.h	$NHDT-Date: 1725653010 2024/09/06 20:03:30 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $ */
/* Copyright (c) Steve Creps, 1988.                               */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * hacklib true library functions
 */

/* ought to be changed to NONNULL NONNULLARG1
                               * and the code changed to not allow NULL arg */

export function FITSint(x) { return FITSint_(x, _("FITSint"), 0); }

/* note: the snprintf CPP wrapper includes the "fmt" argument in "..."
   (__VA_ARGS__) to allow for zero arguments after fmt */

export function Snprintf(str, size, ...args) { return nh_snprintf(_("Snprintf"), 0, str, size, ...args); }

/*#define Strlen(s) Strlen_(s, __func__, __LINE__)*/

import { _ } from "../rt/strings.js";
import { FITSint_ } from "./alloc.js";
import { nh_snprintf } from "./hacklib.js";
