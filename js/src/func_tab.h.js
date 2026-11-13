/* NetHack 5.0	func_tab.h	$NHDT-Date: 1684791775 2023/05/22 21:42:55 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.24 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Pasi Kallinen, 2016. */
/* NetHack may be freely redistributed.  See license for details. */

/* extended command flags */
export const IFBURIED = 0x0001;
export const AUTOCOMPLETE = 0x0002;
export const WIZMODECMD = 0x0004;
export const GENERALCMD = 0x0008;
export const CMD_NOT_AVAILABLE = 0x0010;
export const NOFUZZERCMD = 0x0020;
export const INTERNALCMD = 0x0040;
export const CMD_M_PREFIX = 0x0080;
export const CMD_gGF_PREFIX = 0x0100;
export const CMD_MOVE_PREFIXES = (CMD_M_PREFIX | CMD_gGF_PREFIX);
export const PREFIXCMD = 0x0200;
export const MOVEMENTCMD = 0x0400;
export const MOUSECMD = 0x0800;
export const CMD_INSANE = 0x1000;
export const AUTOCOMP_ADJ = 0x2000;
export const CMD_PARAM = 0x4000;

/* flags for extcmds_match() */
export const ECM_NOFLAGS = 0;
export const ECM_IGNOREAC = 0x01;
export const ECM_EXACTMATCH = 0x02;
export const ECM_NO1CHARCMD = 0x04;

/* a key bound to ext_func_tab */
export const struct_Cmd_bind = struct("struct_Cmd_bind", {
    key: uchar,
    userbind: boolean, /* added by user */
    param: ptr_to(char),
    cmd: ptr_to("struct_ext_func_tab"),
    next: ptr_to("struct_Cmd_bind"),
});

export const struct_ext_func_tab = struct("struct_ext_func_tab", {
    key: uchar,
    ef_txt: ptr_to(char), ef_desc: ptr_to(char),
    ef_funct: fnptr_t, /* must return ECMD_foo flags */
    flags: unsigned,
    f_text: ptr_to(char),
});

import { boolean } from "./global.h.js";
import { char, uchar, unsigned } from "../rt/ctypes.js";
import { fnptr_t, ptr_to, struct } from "../rt/struct.js";
