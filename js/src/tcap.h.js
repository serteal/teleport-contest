/* NetHack 5.0	tcap.h	$NHDT-Date: 1596498562 2020/08/03 23:49:22 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.12 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1989. */
/*-Copyright (c) Kenneth Lorber, Kensington, Maryland, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

/* not named termcap.h because it may conflict with a system header */

/* might display need graphics code? */

/* also declared in decl.h; defined in decl.c */
    /* graphics start and end (tty font swapping) */
    /* lines and columns */

export const struct_tc_lcl_data = struct("struct_tc_lcl_data", { /* defined and set up in termcap.c */
    tc_CM: ptr_to(char), tc_ND: ptr_to(char), tc_CD: ptr_to(char),
    tc_HI: ptr_to(char), tc_HE: ptr_to(char), tc_US: ptr_to(char), tc_UE: ptr_to(char),
    tc_ul_hack: boolean,
});

import { boolean } from "./global.h.js";
import { char } from "../rt/ctypes.js";
import { ptr_to, struct } from "../rt/struct.js";
