/* NetHack 5.0	alloc.c	$NHDT-Date: 1737281026 2025/01/19 02:03:46 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.38 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Robert Patrick Rankin, 2012. */
/* NetHack may be freely redistributed.  See license for details. */

/* since this file is also used in auxiliary programs, don't include all the
   function declarations for all of nethack */

/*#define FITSint(x) FITSint_(x, __func__, __LINE__)*/

/*#define FITSuint(x) FITSuint_(x, __func__, __LINE__)*/

/* #ifdef MONITOR_HEAP: not in this build */

/*
 * For historical reasons, nethack's alloc() returns 'long *' rather
 * than 'void *' or 'char *'.
 *
 * Some static analysis complains if it can't deduce that the number
 * of bytes being allocated is a multiple of 'sizeof (long)'.  It
 * recognizes that the following manipulation overcomes that via
 * rounding the requested length up to the next long.  NetHack doesn't
 * make a lot of tiny allocations, so this shouldn't waste much memory
 * regardless of whether malloc() does something similar.  NetHack
 * isn't expected to call alloc(0), but if that happens treat it as
 * alloc(sizeof (long)) instead.
 */

export function alloc(lth) { /* long long * */
    let ptr;

    do { if ((!(lth) || (((lth) % sizeof(long)) != 0))) (lth) = unsigned((lth) + (sizeof(long) - ((lth) % sizeof(long)))); } while (0);
    ptr = malloc(lth);

    if (!ptr)
        panic(_("Memory allocation failure; cannot get %u bytes"), lth);

    return ref_to(long, ptr);
}

/* realloc() call that might get substituted by nhrealloc(p,n,file,line) */
export function re_alloc(oldptr, newlth) { /* long long * */
    let newptr;

    do { if ((!(newlth) || (((newlth) % sizeof(long)) != 0))) (newlth) = unsigned((newlth) + (sizeof(long) - ((newlth) % sizeof(long)))); } while (0);
    newptr = ref_to(long, realloc(addr_of(oldptr), newlth));

    /* "extend to":  assume it won't ever fail if asked to shrink */
    if (newlth && !newptr)
        panic(_("Memory allocation failure; cannot extend to %u bytes"), newlth);

    return newptr;
}

export const PTR_FMT = "%p";

/* A small pool of static formatting buffers.
 * PTRBUFSIZ:  We assume that pointers will be formatted as integers in
 * hexadecimal, requiring at least 16+1 characters for each buffer to handle
 * 64-bit systems, but the standard doesn't mandate that encoding and an
 * implementation could do something different for %p, so we make some
 * extra room.
 * PTRBUFCNT:  Number of formatted values which can be in use at the same
 * time.  To have more, callers need to make copies of them as they go.
 */
export const PTRBUFCNT = 4;
export const PTRBUFSIZ = 32;
const ptrbuf = static_array("ptrbuf", array_of(char, PTRBUFSIZ), PTRBUFCNT);
const ptrbufidx = static_var("ptrbufidx", int, 0);

/* format a pointer for display purposes; returns a static buffer */
export function fmt_ptr(ptr) { /* char * */
    let buf;

    buf = ptrbuf[ptrbufidx[0]];
    if (++ptrbufidx[0] >= PTRBUFCNT)
        ptrbufidx[0] = 0;

    sprintf(buf, _(PTR_FMT), ptr);
    return buf;
}

/* #ifdef MONITOR_HEAP: not in this build */

/* strdup() which uses our alloc() rather than libc's malloc();
   not used when MONITOR_HEAP is enabled, but included unconditionally
   in case utility programs get built using a different setting for that */
export function dupstr(string) { /* char * */
    let len = strlen(string);

    /* make sure len+1 doesn't overflow plain unsigned (for alloc()) */
    if (len > (unsigned(~0) - 1))
        panic(_("dupstr: string length overflow"));

    return strcpy(addr_of(alloc(unsigned(len + 1))), string);
}

/* #if 0: not in this build */

/* cast to int or panic on overflow; use via macro */
export function FITSint_(i, file, line) { /* int */
    let iret = int(i);

    if (iret != i)
        panic(_("Overflow at %s:%d"), file, line);
    return iret;
}

export function FITSuint_(ull, file, line) { /* unsigned */
    let uret = unsigned(ull);

    if (uret != ull)
        panic(_("Overflow at %s:%d"), file, line);
    return uret;
}

/*alloc.c*/

import { char, int, long, sizeof, unsigned } from "../rt/ctypes.js";
import { malloc, realloc, sprintf, strcpy, strlen } from "../rt/libc.js";
import { static_array, static_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, array_of, ref_to } from "../rt/struct.js";
import { panic } from "./end.js";
