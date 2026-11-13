/* SAS/C already shifts to stricmp */

export function strcmpi(a, b) { return strncmpi(a, b, -1); }

/* define USING_ADDRESS_SANITIZER if ASAN is in use */

/*
 * Automatic inclusions for the subsidiary files.
 * Please don't change the order.  It does matter.
 */

/* amiconf.h needs to be the last nested #include of config.h because
   'make depend' will turn it into a comment, hiding anything after it */

/* Displayable name of this port; don't redefine if defined in *conf.h */

/* Check again in case something more specific has been defined above. */

/* vms_exit() (sys/vms/vmsmisc.c) expects the non-VMS EXIT_xxx values below.
 * these definitions allow all systems to be treated uniformly, provided
 * main() routines do not terminate with return(), whose value is not
 * so massaged.
 */

export function Strlen(s) { return Strlen_(s,_("Strlen"),0); }

/*
 * Version 5.0.x has aspirations of portable file formats. We
 * make a distinction between MAIL functionality and MAIL_STRUCTURES
 * so that the underlying structures are consistent, whether MAIL is
 * defined or not.
 */

/* PANICTRACE: Always defined for NH_DEVEL_STATUS != NH_STATUS_RELEASED
   but only for supported platforms. */

/* see end.c */

/* The following are meaningless if PANICTRACE is not defined: */

/* Supply nethack_enter macro if not supplied by port */

/* Supply nhassert macro if not supplied by port */

export function nhassert(expression, __FILE__) { return void ((!!expression) ||
        (nhassert_failed(_("gc.command_count != 0"), _(__FILE__), 0), 0)); }

/* Macros for meta and ctrl modifiers:
 *   M and C return the meta/ctrl code for the given character;
 *     e.g., (C('c') is ctrl-c
 */

export function M(c) { return (c - 128); }

export function C(c) { return (0x1f & c); }

export function unmeta(c) { return (0x7f & c); }

export function SET__IS_VALUE_VALID(s) { return +((s < set_in_sysconf) || (s > set_wiznofuz)); }

import { set_in_sysconf, set_wiznofuz } from "./global.h.js";
import { _ } from "../rt/strings.js";
import { strncmpi } from "./hacklib.js";
import { nhassert_failed } from "./pline.js";
import { Strlen_ } from "./strutil.js";
