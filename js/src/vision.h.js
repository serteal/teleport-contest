/* NetHack 5.0	vision.h	$NHDT-Date: 1666478832 2022/10/22 22:47:12 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.15 $ */
/* Copyright (c) Dean Luick, with acknowledgements to Dave Cohrs, 1990. */
/* NetHack may be freely redistributed.  See license for details.       */

export const COULD_SEE = 0x1;
export const IN_SIGHT = 0x2;
export const TEMP_LIT = 0x4;

/*
 * Light source sources
 */

    export const LS_NONE = 0;
    export const LS_OBJECT = 1;
    export const LS_MONSTER = 2;
    export const NUM_LS_SOURCES = LS_MONSTER + 1;

/*
 *  Circle information
 */
export const MAX_RADIUS = 15;

/* howmonseen() bitmask values */
export const MONSEEN_NORMAL = 0x0001;
export const MONSEEN_SEEINVIS = 0x0002;
export const MONSEEN_INFRAVIS = 0x0004;
export const MONSEEN_TELEPAT = 0x0008;
export const MONSEEN_XRAYVIS = 0x0010;
export const MONSEEN_DETECT = 0x0020;
export const MONSEEN_WARNMON = 0x0040;
