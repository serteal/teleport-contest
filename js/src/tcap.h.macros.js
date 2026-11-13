/* some curses.h declare CM etc. */
export function nh_CM() { return tc_lcl_data.tc_CM; }
export function nh_ND() { return tc_lcl_data.tc_ND; }
export function nh_CD() { return tc_lcl_data.tc_CD; }
export function nh_HI() { return tc_lcl_data.tc_HI; }
export function nh_HE() { return tc_lcl_data.tc_HE; }
export function nh_US() { return tc_lcl_data.tc_US; }
export function nh_UE() { return tc_lcl_data.tc_UE; }
export function ul_hack() { return tc_lcl_data.tc_ul_hack; }

/* set up in termcap.c */

import { tc_lcl_data } from "../win/tty/termcap.js";
