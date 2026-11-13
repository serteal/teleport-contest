/* NetHack 5.0	wintty.h	$NHDT-Date: 1656014599 2022/06/23 20:03:19 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.55 $ */
/* Copyright (c) David Cohrs, 1991,1992                           */
/* NetHack may be freely redistributed.  See license for details. */

/* NOMUX_CAPTURE: shadow frame buffer for direct screen capture without tmux */

export const nomux_cell = struct("nomux_cell", { ch: char, fg: uchar, attr: uchar, decgfx: uchar, });

/* for static init of zerottycell, put pointer first */

    /* adjusted color 0 = ignore
                         * 1-16             = NetHack color + 1
                         * 17..16,777,233   = 24-bit color  + 17
                         */

/* menu structure */
export const struct_tty_mi = struct("struct_tty_mi", {
    next: ptr_to("struct_tty_mi"),
    identifier: "struct_any", /* user identifier */
    count: long, /* user count */
    str: ptr_to(char), /* description string (including accelerator) */
    glyphinfo: "struct_glyphinfo", /* glyph */
    attr: int, /* string attribute */
    color: int, /* string color */
    selected: boolean, /* TRUE if selected by user */
    itemflags: unsigned, /* item flags */
    selector: char, /* keyboard accelerator */
    gselector: char, /* group accelerator */
});

/* descriptor for tty-based windows */
export const struct_WinDesc = struct("struct_WinDesc", {
    flags: int, /* window flags */
    type: xint16, /* type of window */
    active: boolean, /* true if window is active */
    blanked: boolean, /* for erase_tty_screen(); not used [yet?] */
    offx: short, offy: short, /* offset from topleft of display */
    rows: long, cols: long, /* dimensions */
    curx: long, cury: long, /* current cursor position */
    maxrow: long, maxcol: long, /* the maximum size used -- for MENU wins;
                            * maxcol is also used by WIN_MESSAGE for
                            * tracking the ^P command */
    mbehavior: ulong, /* menu behavior flags (MENU) */
    datlen: ptr_to(short), /* allocation size for *data */
    data: ptr_to(ptr_to(char)), /* window data [row][column] */
    morestr: ptr_to(char), /* string to display instead of default */
    mlist: ptr_to("struct_tty_mi"), /* menu information (MENU) */
    plist: ptr_to(ptr_to("struct_tty_mi")), /* menu page pointers (MENU) */
    plist_size: long, /* size of allocated plist (MENU) */
    npages: long, /* number of pages in menu (MENU) */
    nitems: long, /* total number of items (MENU) */
    how: short, /* menu mode - pick 1 or N (MENU) */
    menu_ch: char, /* menu char (MENU) */
});

/* window flags */
export const WIN_CANCELLED = 1;
export const WIN_STOP = 1;

export const WIN_LOCKHISTORY = 2;
export const WIN_NOSTOP = 4;

/* topline states */
export const TOPLINE_EMPTY = 0;
export const TOPLINE_NEED_MORE = 1;
export const TOPLINE_NON_EMPTY = 2;
export const TOPLINE_SPECIAL_PROMPT = 3;

/* descriptor for tty-based displays -- all the per-display data */
export const struct_DisplayDesc = struct("struct_DisplayDesc", {
    rows: short, cols: short, /* width and height of tty display */
    curx: short, cury: short, /* current cursor position on the screen */
    color: uint32, /* current color */
    colorflags: uint32, /* NH_BASIC_COLOR or 24-bit color */
    framecolor: uint32, /* current background color */
    attrs: int, /* attributes in effect */
    toplin: int, /* flag for topl stuff */
    rawprint: int, /* number of raw_printed lines since synch */
    inmore: int, /* non-zero if more() is active */
    inread: int, /* non-zero if reading a character */
    intr: int, /* non-zero if inread was interrupted */
    lastwin: winid, /* last window used for I/O */
    dismiss_more: char, /* extra character accepted at --More-- */
    topl_utf8: int, /* non-zero if utf8 in str */
    mixed: int, /* we are processing mixed output */
});

export const struct_tty_status_fields = struct("struct_tty_status_fields", {
    idx: int,
    color: int,
    attr: int,
    x: int, y: int,
    lth: unsigned,
    valid: boolean,
    dirty: boolean,
    redraw: boolean,
    sanitycheck: boolean, /* was 'last_in_row' */
});

export const MAXWIN = 20;

/* tty dependent window types */

export const NHW_BASE = (NHW_LAST_TYPE + 1);

/* external declarations */

/* port specific variable declarations */

/* the tty display descriptor */

/* last character typed to xwaitforspace */
/* default --more-- prompt */

/* port specific external function references */

/* ### getline.c ### */

/* ### termcap.c, video.c ### */

/*
 * TERM or NO_TERMS
 *
 * The tty windowport interface relies on lower-level support routines
 * to actually manipulate the terminal/display. Those are the right place
 * for doing strange and arcane things such as outputting escape sequences
 * to select a color or whatever.  wintty.c should concern itself with WHERE
 * to put stuff in a window.

 * The TERM routines are found in:
 *
 * !NO_TERMS:          termcap.c
 *
 * NO_TERMS:
 *            WINCON   sys/windows/consoletty.c
 *            MSDOS    sys/msdos/video.c
 *
 */

/* ### topl.c ### */

/* ### wintty.c ### */

/* tty interface */

/* termcap is implied if NO_TERMS is not defined */

import { boolean, xint16 } from "./global.h.js";
import { uint32 } from "./integer.h.js";
import { NHW_LAST_TYPE, winid } from "./wintype.h.js";
import { char, int, long, short, uchar, ulong, unsigned } from "../rt/ctypes.js";
import { ptr_to, struct } from "../rt/struct.js";
