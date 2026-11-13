/* NetHack 5.0	winprocs.h	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.83 $ */
/* Copyright (c) David Cohrs, 1992                                */
/* NetHack may be freely redistributed.  See license for details. */

export const wp_tty = 1; export const wp_X11 = wp_tty + 1; export const wp_Qt = wp_X11 + 1; export const wp_mswin = wp_Qt + 1; export const wp_curses = wp_mswin + 1;
              export const wp_chainin = wp_curses + 1; export const wp_chainout = wp_chainin + 1; export const wp_shim = wp_chainout + 1;
              export const wp_hup = wp_shim + 1; export const wp_guistubs = wp_hup + 1; export const wp_ttystubs = wp_guistubs + 1;

              export const wp_trace = wp_ttystubs + 1; // XXX do we need this?  should chainin/out get an id? TBD

/* NB: this MUST match chain_procs below */
export const struct_window_procs = struct("struct_window_procs", {
    name: ptr_to(char), /* Names should start with [a-z].  Names must
                           * not start with '-'.  Names starting with
                           * '+' are reserved for processors. */
    wp_id: unsigned,
    wincap: ulong, /* window port capability options supported */
    wincap2: ulong, /* additional window port capability options */
    has_color: array_of(schar, CLR_MAX),
    win_init_nhwindows: fnptr_t,
    win_player_selection: fnptr_t,
    win_askname: fnptr_t,
    win_get_nh_event: fnptr_t,
    win_exit_nhwindows: fnptr_t,
    win_suspend_nhwindows: fnptr_t,
    win_resume_nhwindows: fnptr_t,
    win_create_nhwindow: fnptr_t,
    win_clear_nhwindow: fnptr_t,
    win_display_nhwindow: fnptr_t,
    win_destroy_nhwindow: fnptr_t,
    win_curs: fnptr_t,
    win_putstr: fnptr_t,
    win_putmixed: fnptr_t,
    win_display_file: fnptr_t,
    win_start_menu: fnptr_t,

                         win_add_menu: fnptr_t,
    win_end_menu: fnptr_t,
    win_select_menu: fnptr_t,
    win_message_menu: fnptr_t,
    win_mark_synch: fnptr_t,
    win_wait_synch: fnptr_t,

    win_cliparound: fnptr_t,

                            win_print_glyph: fnptr_t,
    win_raw_print: fnptr_t,
    win_raw_print_bold: fnptr_t,
    win_nhgetch: fnptr_t,
    win_nh_poskey: fnptr_t,
    win_nhbell: fnptr_t,
    win_doprev_message: fnptr_t,
    win_yn_function: fnptr_t,
    win_getlin: fnptr_t,
    win_get_ext_cmd: fnptr_t,
    win_number_pad: fnptr_t,
    win_delay_output: fnptr_t,

    win_outrip: fnptr_t,
    win_preference_update: fnptr_t,
    win_getmsghistory: fnptr_t,
    win_putmsghistory: fnptr_t,
    win_status_init: fnptr_t,
    win_status_finish: fnptr_t,

                                   win_status_enablefield: fnptr_t,

                              win_status_update: fnptr_t,
    win_can_suspend: fnptr_t,
    win_update_inventory: fnptr_t,
    win_ctrl_nhwindow: fnptr_t,
});

/*
 *
 */

/*
 * WINCAP
 * Window port preference capability bits.
 * Some day this might be better in its own wincap.h file.
 */
/* clang-format off */
export const WC_COLOR = 0x00000001;
export const WC_HILITE_PET = 0x00000002;
export const WC_ASCII_MAP = 0x00000004;
export const WC_TILED_MAP = 0x00000008;
export const WC_PRELOAD_TILES = 0x00000010;
export const WC_TILE_WIDTH = 0x00000020;
export const WC_TILE_HEIGHT = 0x00000040;
export const WC_TILE_FILE = 0x00000080;
export const WC_INVERSE = 0x00000100;
export const WC_ALIGN_MESSAGE = 0x00000200;
export const WC_ALIGN_STATUS = 0x00000400;
export const WC_VARY_MSGCOUNT = 0x00000800;
export const WC_FONT_MAP = 0x00001000;
export const WC_FONT_MESSAGE = 0x00002000;
export const WC_FONT_STATUS = 0x00004000;
export const WC_FONT_MENU = 0x00008000;
export const WC_FONT_TEXT = 0x00010000;
export const WC_FONTSIZ_MAP = 0x00020000;
export const WC_FONTSIZ_MESSAGE = 0x040000;
export const WC_FONTSIZ_STATUS = 0x0080000;
export const WC_FONTSIZ_MENU = 0x00100000;
export const WC_FONTSIZ_TEXT = 0x00200000;
export const WC_SCROLL_MARGIN = 0x00400000;
export const WC_SPLASH_SCREEN = 0x00800000;
export const WC_POPUP_DIALOG = 0x01000000;
export const WC_SCROLL_AMOUNT = 0x02000000;
export const WC_EIGHT_BIT_IN = 0x04000000;
export const WC_PERM_INVENT = 0x08000000;
export const WC_MAP_MODE = 0x10000000;
export const WC_WINDOWCOLORS = 0x20000000;
export const WC_PLAYER_SELECTION = 0x40000000;

export const WC_MOUSE_SUPPORT = 0x80000000;

                                     /* no free bits */

export const WC2_FULLSCREEN = 0x0001;
export const WC2_SOFTKEYBOARD = 0x0002;
export const WC2_WRAPTEXT = 0x0004;
export const WC2_HILITE_STATUS = 0x0008;
export const WC2_SELECTSAVED = 0x0010;
export const WC2_DARKGRAY = 0x0020;
export const WC2_HITPOINTBAR = 0x0040;
export const WC2_FLUSH_STATUS = 0x0080;

export const WC2_RESET_STATUS = 0x0100;

export const WC2_TERM_SIZE = 0x0200;
export const WC2_STATUSLINES = 0x0400;
export const WC2_WINDOWBORDERS = 0x0800;
export const WC2_PETATTR = 0x1000;
export const WC2_GUICOLOR = 0x2000;
/* pline() can overload the display attributes argument passed to putstr()
   with one or more flags and at most one of bold/blink/inverse/&c */
export const WC2_URGENT_MESG = 0x4000;

export const WC2_SUPPRESS_HIST = 0x8000;

export const WC2_MENU_SHIFT = 0x010000;
export const WC2_U_UTF8STR = 0x020000;
export const WC2_EXTRACOLORS = 0x040000;
                                   /* 13 free bits */
export const WC2_EXTRASTATUS = 0x080000;

                                   /* 12 free bits */

export const ALIGN_LEFT = 1;
export const ALIGN_RIGHT = 2;
export const ALIGN_TOP = 3;
export const ALIGN_BOTTOM = 4;

/* player_selection */
export const VIA_DIALOG = 0;
export const VIA_PROMPTS = 1;

/* map_mode settings - deprecated */
export const MAP_MODE_TILES = 0;
export const MAP_MODE_ASCII4x6 = 1;
export const MAP_MODE_ASCII6x8 = 2;
export const MAP_MODE_ASCII8x8 = 3;
export const MAP_MODE_ASCII16x8 = 4;
export const MAP_MODE_ASCII7x12 = 5;
export const MAP_MODE_ASCII8x12 = 6;
export const MAP_MODE_ASCII16x12 = 7;
export const MAP_MODE_ASCII12x16 = 8;
export const MAP_MODE_ASCII10x18 = 9;
export const MAP_MODE_ASCII_FIT_TO_SCREEN = 10;
export const MAP_MODE_TILES_FIT_TO_SCREEN = 11;

export const struct_wc_Opt = struct("struct_wc_Opt", {
    wc_name: ptr_to(char),
    wc_bit: ulong,
});

/* Macro for the currently active Window Port whose function
   pointers have been loaded */

/* 5.0 The string comparison version isn't used anymore */

/* role selection by player_selection(); this ought to be in the core... */
export const RS_NAME = 0;
export const RS_ROLE = 1;
export const RS_RACE = 2;
export const RS_GENDER = 3;
export const RS_ALGNMNT = 4;
export const RS_filter = 5;

/* Choose_windows() may be called multiple times; these constants tell the
 * init function whether the window system is coming or going. */
export const WININIT = 0;
export const WININIT_UNDO = 1;

/* Setup phases for window chain elements.
        void *  rv = X_procs_chain(int, int, void *, void *, void *);
                Xprivate*          ALLOC n      0       0       0
                -                  INIT  n   self    next    nextdata
   where:
        Xprivate* is anything window chain entry type X wants back
        n is the link count (starting with 1)
        self is the Xprivate* returned earlier
        next is struct winprocs * or struct chainprocs * for the next link
        nextdata is the Xprivate* for the next link in the chain
*/

/* clang-format on */

/* Expose log file for additional debugging. */

    /* Names should start with [a-z].  Names must
                           * not start with '-'.  Names starting with
                           * '+' are reserved for processors. */

    /* window port capability options supported */
    /* additional window port capability options */

import { CLR_MAX } from "./color.h.js";
import { char, schar, ulong, unsigned } from "../rt/ctypes.js";
import { array_of, fnptr_t, ptr_to, struct } from "../rt/struct.js";
