/* NetHack 5.0  wintype.h       $NHDT-Date: 1717880364 2024/06/08 20:59:24 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.52 $ */
/* Copyright (c) David Cohrs, 1991                                */
/* NetHack may be freely redistributed.  See license for details. */

export const winid = int; /* a window identifier */

/* generic parameter - must not be any larger than a pointer */
export const struct_any = union("struct_any", {
    a_void: ptr_to(void_t),
    a_obj: ptr_to("struct_obj"),
    a_monst: ptr_to("struct_monst"),
    a_int: int,
    a_xint16: int,
    a_xint8: int,
    a_char: char,
    a_schar: schar,
    a_uchar: uchar,
    a_uint: unsigned,
    a_long: long,
    a_ulong: ulong,
    a_coordxy: coordxy,
    a_iptr: ptr_to(int),
    a_xint16ptr: ptr_to(short),
    a_xint8ptr: ptr_to(schar),
    a_lptr: ptr_to(long),
    a_coordxyptr: ptr_to(short),
    a_ulptr: ptr_to(ulong),
    a_uptr: ptr_to(unsigned),
    a_string: ptr_to(char),
    a_nfunc: fnptr_t,
    a_mask32: ulong, /* used by status highlighting */
    a_int64: int64_t,
    a_uint64: uint64_t,
    /* add types as needed */
});

/* symbolic names for the data types housed in anything */

    export const ANY_VOID = 1;
    export const ANY_OBJ = ANY_VOID + 1; /* struct obj */
    export const ANY_MONST = ANY_OBJ + 1; /* struct monst (not used) */
    export const ANY_INT = ANY_MONST + 1; /* int */
    export const ANY_CHAR = ANY_INT + 1; /* char */
    export const ANY_UCHAR = ANY_CHAR + 1; /* unsigned char */
    export const ANY_SCHAR = ANY_UCHAR + 1; /* signed char */
    export const ANY_UINT = ANY_SCHAR + 1; /* unsigned int */
    export const ANY_LONG = ANY_UINT + 1; /* long */
    export const ANY_ULONG = ANY_LONG + 1; /* unsigned long */
    export const ANY_IPTR = ANY_ULONG + 1; /* pointer to int */
    export const ANY_UPTR = ANY_IPTR + 1; /* pointer to unsigned int */
    export const ANY_LPTR = ANY_UPTR + 1; /* pointer to long */
    export const ANY_ULPTR = ANY_LPTR + 1; /* pointer to unsigned long */
    export const ANY_STR = ANY_ULPTR + 1; /* pointer to null-terminated char string */
    export const ANY_NFUNC = ANY_STR + 1; /* pointer to function taking no args, returning int */
    export const ANY_MASK32 = ANY_NFUNC + 1; /* 32-bit mask (stored as unsigned long) */

    export const ANY_INVALID = ANY_MASK32 + 1; /* leave this last */

/* menu return list */
export const struct_mi = struct("struct_mi", {
    item: "struct_any", /* identifier */
    count: long, /* count */
    itemflags: unsigned, /* item flags */
});

/* These would be in sym.h and display.h if they weren't needed to
   define the windowproc interface for X11 which doesn't include
   most of the main NetHack header files */

export const struct_classic_representation = struct("struct_classic_representation", {
    color: int,
    symidx: int,
});

export const struct_unicode_representation = struct("struct_unicode_representation", {
    utf32ch: uint32,
    utf8str: ptr_to(uchar),
});

export const struct_glyph_map_entry = struct("struct_glyph_map_entry", {
    glyphflags: unsigned,
    sym: "struct_classic_representation",
    customcolor: uint32,
    color256idx: uint16,
    tileidx: short,

    u: ptr_to("struct_unicode_representation"),
});

/* glyph plus additional info
   if you add fields or change the ordering, fix up the following:
        g_info initialization in display.c
        nul_glyphinfo initialization in display.c
 */
export const struct_glyphinfo = struct("struct_glyphinfo", {
    glyph: int, /* the display entity */
    ttychar: int,
    framecolor: uint32,
    gm: "struct_glyph_map_entry",
});
/*#define GLYPH_INFO_P struct glyphinfo //not used*/

/* select_menu() "how" argument types */
/* [MINV_PICKMASK in monst.h assumes these have values of 0, 1, 2] */
export const PICK_NONE = 0;
export const PICK_ONE = 1;
export const PICK_ANY = 2;

/* window types */
/* any additional port specific types should be defined in win*.h */
export const NHW_MESSAGE = 1;
export const NHW_STATUS = 2;
export const NHW_MAP = 3;
export const NHW_MENU = 4;
export const NHW_TEXT = 5;
export const NHW_PERMINVENT = 6;
export const NHW_LAST_TYPE = NHW_PERMINVENT;

/* attribute types for putstr; the same as the ANSI value, for convenience */
export const ATR_NONE = 0;
export const ATR_BOLD = 1;
export const ATR_DIM = 2;
export const ATR_ITALIC = 3;
export const ATR_ULINE = 4;
export const ATR_BLINK = 5;
export const ATR_INVERSE = 7;
/* not a display attribute but passed to putstr() as an attribute;
   can be masked with one regular display attribute */
export const ATR_URGENT = 16;
export const ATR_NOHISTORY = 32;

/* nh_poskey() modifier types */
export const CLICK_1 = 1;
export const CLICK_2 = 2;
export const NUM_MOUSE_BUTTONS = 2;

/* invalid winid */
export const WIN_ERR = (-1);

/* menu window keyboard commands (may be mapped); menu_shift_right and
   menu_shift_left are for interacting with persistent inventory window */
/* clang-format off */
export const MENU_FIRST_PAGE = ord('^');
export const MENU_LAST_PAGE = ord('|');
export const MENU_NEXT_PAGE = ord('>');
export const MENU_PREVIOUS_PAGE = ord('<');
export const MENU_SHIFT_RIGHT = ord('}');
export const MENU_SHIFT_LEFT = ord('{');
export const MENU_SELECT_ALL = ord('.');
export const MENU_UNSELECT_ALL = ord('-');
export const MENU_INVERT_ALL = ord('@');
export const MENU_SELECT_PAGE = ord(',');
export const MENU_UNSELECT_PAGE = ord('\\');
export const MENU_INVERT_PAGE = ord('~');
export const MENU_SEARCH = ord(':');

export const MENU_ITEMFLAGS_NONE = 0x0000000;
export const MENU_ITEMFLAGS_SELECTED = 0x0000001;
export const MENU_ITEMFLAGS_SKIPINVERT = 0x0000002;
export const MENU_ITEMFLAGS_SKIPMENUCOLORS = 0x0000004;

/* 5.0+ enhanced menu flags that not all window ports are likely to
 * support initially.
 *
 * As behavior and appearance modification flags are added, the various
 * individual window ports will likely have to be updated to respond
 * to the flags in an appropriate way.
 */

export const MENU_BEHAVE_STANDARD = 0x0000000;
export const MENU_BEHAVE_PERMINV = 0x0000001;

    export const toggling_off = -1;
    export const toggling_not = 0;
    export const toggling_on = 1;

/* perm_invent modes */

    export const InvNormal = 1;
    export const InvShowGold = 2;
    export const InvSparse = 4; /* must be ORed with Normal or ShowGold to be valid */
    export const InvInUse = 8;

/* 'perminv_mode' option settings */
    export const InvOptNone = 0; /* no perm_invent */
    export const InvOptOn = InvNormal; /* 1 */
    export const InvOptFull = InvShowGold; /* 2 */

    /* confusingly-named "sparse mode" shows all inventory letters, even when
       their slots are empty; only meaningful for tty's perm_invent */
    export const InvOptOn_grid = InvNormal | InvSparse; /* 5 */
    export const InvOptFull_grid = InvShowGold | InvSparse; /* 6 */

    export const InvOptInUse = InvInUse; /* 8 */

    export const active = 0x001;
    export const too_small = 0x002;
    export const prohibited = 0x004;
    export const no_init_done = 0x008;
    export const too_early = 0x010;

    export const invalid_core_request = 0;
    export const set_mode = 1;
    export const request_settings = 2;
    export const set_menu_promptstyle = 3;

export const struct_to_core = struct("struct_to_core", {
    tocore_flags: long,
    active: boolean,
    use_update_inventory: boolean, /* disable the newer slot interface */
    maxslot: int,
    needrows: int, needcols: int,
    haverows: int, havecols: int,
});

export const struct_from_core = struct("struct_from_core", {
    core_request: unsigned,
    invmode: unsigned,
    menu_promptstyle: "struct_color_and_attr",
});

export const struct_win_request_info_t = struct("struct_win_request_info_t", {
    tocore: "struct_to_core",
    fromcore: "struct_from_core",
});

/* windows.c */

/* #define CORE_INVENT */

/* In a binary with multiple window interfaces linked in, this is
 * a structure to track certain interface capabilities that cannot be
 * statically done at compile time. Some of them can be toggled and
 * the core needs to know if they are active or not at the time.
 */

    export const wdmode_traditional = 0;
    export const wdmode_tiled = wdmode_traditional + 1;

export const struct_win_settings = struct("struct_win_settings", {
    wdmode: unsigned,
    map_frame_color: uint32,
});

/* clang-format on */

import { boolean, coordxy } from "./global.h.js";
import { uint16, uint32 } from "./integer.h.js";
import {
    char, int, int64_t, long, ord, schar, short, uchar, uint64_t, ulong, unsigned,
} from "../rt/ctypes.js";
import { fnptr_t, ptr_to, struct, union, void_t } from "../rt/struct.js";
