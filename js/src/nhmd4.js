/* NetHack 5.0	nhmd4.c	$NHDT-Date: 1708811387 2024/02/24 21:49:47 $	$NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $ */
/*-Copyright (c) Kenneth Lorber, Kensington, Maryland, 2024 */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Usage is to try to match traceback data with the instance of the
 * program which produced that, not for security related purposes.
 *
 * Derived from:
 */
/*
 * MD4 (RFC-1320) message digest.
 * Modified from MD5 code by Andrey Panin <pazke@donpac.ru>
 *
 * Written by Solar Designer <solar@openwall.com> in 2001, and placed in
 * the public domain.  There's absolutely no warranty.
 *
 * This differs from Colin Plumb's older public domain implementation in
 * that no 32-bit integer data type is required, there's no compile-time
 * endianness configuration, and the function prototypes match OpenSSL's.
 * The primary goals are portability and ease of use.
 *
 * This implementation is meant to be fast, but not as fast as possible.
 * Some known optimizations are not included to reduce source code size
 * and avoid compile-time configuration.
 */

/* #ifdef CRASHREPORT: not in this build */

/*nhmd4.c*/
