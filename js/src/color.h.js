/* NetHack 5.0	color.h	$NHDT-Date: 1682205020 2023/04/22 23:10:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.18 $ */
/* Copyright (c) Steve Linhart, Eric Raymond, 1989. */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * The color scheme used is tailored for an IBM PC.  It consists of the
 * standard 8 colors, followed by their bright counterparts.  There are
 * exceptions, these are listed below.	Bright black doesn't mean very
 * much, so it is used as the "default" foreground color of the screen.
 */
export const CLR_BLACK = 0;
export const CLR_RED = 1;
export const CLR_GREEN = 2;
export const CLR_BROWN = 3;
export const CLR_BLUE = 4;
export const CLR_MAGENTA = 5;
export const CLR_CYAN = 6;
export const CLR_GRAY = 7;
export const NO_COLOR = 8;
export const CLR_ORANGE = 9;
export const CLR_BRIGHT_GREEN = 10;
export const CLR_YELLOW = 11;
export const CLR_BRIGHT_BLUE = 12;
export const CLR_BRIGHT_MAGENTA = 13;
export const CLR_BRIGHT_CYAN = 14;
export const CLR_WHITE = 15;
export const CLR_MAX = 16;

/* The "half-way" point for tty-based color systems.  This is used in */
/* the tty color setup code.  (IMHO, it should be removed - dean).    */
export const BRIGHT = 8;

/* color aliases used in monsters.h and display.c  */
export const HI_DOMESTIC = CLR_WHITE;
export const HI_LORD = CLR_MAGENTA;
export const HI_OVERLORD = CLR_BRIGHT_MAGENTA;

/* these can be configured */

export const HI_METAL = CLR_CYAN;
export const HI_COPPER = CLR_YELLOW;
export const HI_SILVER = CLR_GRAY;
export const HI_GOLD = CLR_YELLOW;
export const HI_LEATHER = CLR_BROWN;
export const HI_CLOTH = CLR_BROWN;
export const HI_ORGANIC = CLR_BROWN;
export const HI_WOOD = CLR_BROWN;
export const HI_PAPER = CLR_WHITE;
export const HI_GLASS = CLR_BRIGHT_CYAN;
export const HI_MINERAL = CLR_GRAY;
export const DRAGON_SILVER = CLR_BRIGHT_CYAN;
export const HI_ZAP = CLR_BRIGHT_BLUE;

export const NH_BASIC_COLOR = 0x1000000;

export const no_color = 0; export const nh_color = no_color + 1; export const rgb_color = nh_color + 1;

export const struct_nethack_color = struct("struct_nethack_color", {
    colortyp: unsigned,
    tableindex: int,
    rgbindex: int,
    name: ptr_to(char),
    r: long, g: long, b: long,
});

export const struct_color_and_attr = struct("struct_color_and_attr", {
           color: int, attr: int,
});

/*color.h*/

import { char, int, long, unsigned } from "../rt/ctypes.js";
import { ptr_to, struct } from "../rt/struct.js";
