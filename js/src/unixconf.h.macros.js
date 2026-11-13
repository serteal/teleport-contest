export const tgetch = nhjs_tgetch;

/* Use the high quality random number routines. */
/* the high quality random number routines */

/* Relevant for some systems:  some older versions
   of curses (the run-time library optionally used by nethack's tty
   interface in addition to its curses interface) supply 'has_colors()'
   but corresponding <curses.h> doesn't declare it.  has_colors() is used
   in unixtty.c by init_sco_cons() and init_linux_cons().  If the compiler
   complains about has_colors() not being declared, try uncommenting
   NEED_HAS_COLORS_DECL.  If the linker complains about has_colors not
   being found, switch to ncurses() or update to newer version of curses. */
/* #define NEED_HAS_COLORS_DECL */

/*
 * [ALI] We assume that SVR4 means we can safely include syscall.h
 * (although it's really a BSDism). This is certainly true for Solaris 2.5,
 * Solaris 7, Solaris 8 and Compaq Tru64 5.1
 * Later BSD systems will have the getresid system calls.
 */

/*
 * /dev/random is blocking on Linux, so there we default to /dev/urandom which
 * should still be good enough.
 * BSD systems usually have /dev/random that is supposed to be used.
 * OSX is based on NetBSD kernel and has both /dev/random and /dev/urandom.
 */

import { nhjs_tgetch } from "../sys/c2js/nhjs_tty_api.js";
