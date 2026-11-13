/* NetHack 5.0	engrave.h	$NHDT-Date: 1596498535 2020/08/03 23:48:55 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.10 $ */
/* Copyright (c) Stichting Mathematisch Centrum, Amsterdam, 1985. */
/*-Copyright (c) Kenneth Lorber, Kensington, Maryland, 2015. */
/* NetHack may be freely redistributed.  See license for details. */

    export const actual_text = 0;
    export const remembered_text = actual_text + 1;
    export const pristine_text = remembered_text + 1;
    export const text_states = pristine_text + 1;

export const DUST = 1; export const ENGRAVE = 2; export const BURN = 3; export const MARK = 4; export const ENGR_BLOOD = 5; export const HEADSTONE = 6; export const N_ENGRAVE = 6; export const struct_engr = struct("struct_engr", {
    nxt_engr: ptr_to("struct_engr"),
    engr_txt: array_of(ptr_to(char), text_states),
    engr_x: coordxy, engr_y: coordxy,
    engr_szeach: unsigned, /* length of text including trailing NUL */
    engr_alloc: unsigned, /* for save & restore; not length of text */
    engr_time: long, /* moment engraving was (will be) finished */
    engr_type: xint8,

    guardobjects: Bitfield(1), /* if engr_txt is "Elbereth", it is effective
                                * against monsters when an object is present
                                * even when hero isn't (so behaves similarly
                                * to how Elbereth did in 3.4.3) */
    nowipeout: Bitfield(1), /* this engraving will not degrade */
    eread: Bitfield(1), /* refers to the engaving text: read or felt */
    erevealed: Bitfield(1), /* refers to engraving map symbol: revealed */
    /* 4 free bits */
});

import { coordxy, xint8 } from "./global.h.js";
import { char, long, unsigned } from "../rt/ctypes.js";
import { Bitfield, array_of, ptr_to, struct } from "../rt/struct.js";
