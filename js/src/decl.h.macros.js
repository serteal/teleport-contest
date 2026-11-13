/* NetHack 5.0  decl.h  $NHDT-Date: 1725653004 2024/09/06 20:03:24 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.377 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Michael Allison, 2007. */
/* NetHack may be freely redistributed.  See license for details. */

/* The names of the colors used for gems, etc. */

/* lua callback queue names */

export function NH_BLACK() { return c_color_names.c_black; }
export function NH_AMBER() { return c_color_names.c_amber; }
export function NH_GOLDEN() { return c_color_names.c_golden; }
export function NH_LIGHT_BLUE() { return c_color_names.c_light_blue; }
export function NH_RED() { return c_color_names.c_red; }
export function NH_GREEN() { return c_color_names.c_green; }
export function NH_SILVER() { return c_color_names.c_silver; }
export function NH_BLUE() { return c_color_names.c_blue; }
export function NH_PURPLE() { return c_color_names.c_purple; }
export function NH_WHITE() { return c_color_names.c_white; }
export function NH_ORANGE() { return c_color_names.c_orange; }

/* common_strings */

export function nothing_happens() { return c_common_strings.c_nothing_happens; }
export function nothing_seems_to_happen() { return c_common_strings.c_nothing_seems_to_happen; }
export function thats_enough_tries() { return c_common_strings.c_thats_enough_tries; }
export function silly_thing_to() { return c_common_strings.c_silly_thing_to; }
export function shudder_for_moment() { return c_common_strings.c_shudder_for_moment; }
export function something() { return c_common_strings.c_something; }
export function Something() { return c_common_strings.c_Something; }
export function You_can_move_again() { return c_common_strings.c_You_can_move_again; }
export function Never_mind() { return c_common_strings.c_Never_mind; }
export function vision_clears() { return c_common_strings.c_vision_clears; }
export function the_your() { return c_common_strings.c_the_your; }
/* fakename[] used occasionally so vtense() won't be fooled by an assigned
   name ending in 's' */
export function fakename() { return c_common_strings.c_fakename; }

export function AS() { return gt.tc_gbl_data.tc_AS; }
export function AE() { return gt.tc_gbl_data.tc_AE; }
export function LI() { return gt.tc_gbl_data.tc_LI; }
export function CO() { return gt.tc_gbl_data.tc_CO; }

import { c_color_names, c_common_strings, gt } from "./decl.js";
