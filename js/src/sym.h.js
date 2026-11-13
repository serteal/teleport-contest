/* NetHack	5.0	sym.h	$NHDT-Date: $ $NHDT-Branch: $ $NHDT-Revision: $ */
/*      Copyright (c) 2016 by Pasi Kallinen              */
/* NetHack may be freely redistributed.  See license for details. */

/*
 * Default characters for monsters.
 */
/* clang-format off */

/* clang-format on */

    /* number of monster classes */

/* Default characters for dungeon surroundings and furniture */

/*
 * special symbol set handling types ( for invoking callbacks, etc.)
 * Must match the order of the known_handlers strings
 * in drawing.c
 */

    export const H_UNK = 0;
    export const H_IBM = 1;
    export const H_DEC = 2;
    export const H_CURS = 3;
    export const H_MAC = 4; /* obsolete; needed so that the listing of available
                * symsets by 'O' can skip it for !MAC_GRAPHICS_ENV */
    export const H_UTF8 = 5;

export const struct_symdef = struct("struct_symdef", {
    sym: uchar,
    explanation: ptr_to(char),
    color: uchar,
});

    export const SYM_INVALID = 0;
    export const SYM_CONTROL = 1; /* start/finish markers */
    export const SYM_PCHAR = 2; /* index into showsyms  */
    export const SYM_OC = 3; /* index into oc_syms   */
    export const SYM_MON = 4; /* index into monsyms   */
    export const SYM_OTH = 5; /* misc                 */

export const struct_symparse = struct("struct_symparse", {
    range: unsigned,
    idx: int,
    name: ptr_to(char),
});

/* linked list of symsets and their characteristics */
export const struct_symsetentry = struct("struct_symsetentry", {
    next: ptr_to("struct_symsetentry"), /* next in list                         */
    name: ptr_to(char), /* ptr to symset name                   */
    desc: ptr_to(char), /* ptr to description                   */
    idx: int, /* an index value                       */
    handling: unsigned, /* known handlers value */
    nocolor: Bitfield(1), /* don't use color if set               */
    primary: Bitfield(1), /* restricted for use as primary set    */
    rogue: Bitfield(1), /* restricted for use as rogue lev set  */
    explicitly: Bitfield(1), /* explicit symset set                  */
                              /* 4 free bits */
});

/*
 *
 */

export const MAXDCHARS = (S_water - S_stone + 1);
export const MAXTCHARS = (TRAPNUM - 1);
export const MAXECHARS = (S_expl_br - S_vbeam + 1);
export const MAXEXPCHARS = 9;

/* misc symbol definitions */

        export const SYM_NOTHING = 0;
        export const SYM_UNEXPLORED = 1;
        export const SYM_BOULDER = 2;
        export const SYM_INVISIBLE = 3;
        export const SYM_PET_OVERRIDE = 4;
        export const SYM_HERO_OVERRIDE = 5;
        export const MAXOTHER = SYM_HERO_OVERRIDE + 1;

/*
 * Graphics sets for display symbols
 */

        export const PRIMARYSET = 0; /* primary graphics set        */
        export const ROGUESET = 1; /* rogue graphics set          */
        export const NUM_GRAPHICS = ROGUESET + 1;
        export const UNICODESET = NUM_GRAPHICS;

       export const do_custom_none = 0;
       export const do_custom_colors = do_custom_none + 1;
       export const do_custom_symbols = do_custom_colors + 1;

export const custom_none = 0; export const custom_symbols = custom_none + 1;
    export const custom_ureps = custom_symbols + 1; export const custom_nhcolor = custom_ureps + 1; export const custom_count = custom_nhcolor + 1;

export const struct_custom_symbol = struct("struct_custom_symbol", {
    symparse: ptr_to("struct_symparse"),
    val: uchar,
});
export const struct_custom_urep = struct("struct_custom_urep", {
    glyphidx: int,
    u: "struct_unicode_representation",
});
export const struct_custom_nhcolor = struct("struct_custom_nhcolor", {
    glyphidx: int,
    nhcolor: uint32,
});
export const struct_customization_content = union("struct_customization_content", {
    sym: "struct_custom_symbol",
    urep: "struct_custom_urep",
    ccolor: "struct_custom_nhcolor",
});
export const struct_customization_detail = struct("struct_customization_detail", {
    content: "struct_customization_content",
    next: ptr_to("struct_customization_detail"),
});

/* one set per symset_name */
export const struct_symset_customization = struct("struct_symset_customization", {
    customization_name: ptr_to(char),
    count: int,
    custtype: unsigned,
    details: ptr_to("struct_customization_detail"),
    details_end: ptr_to("struct_customization_detail"),
});

/* defaults */
export const WARNCOUNT = 6;

import { S_expl_br, S_stone, S_vbeam, S_water } from "./defsym.h.js";
import { uint32 } from "./integer.h.js";
import { TRAPNUM } from "./trap.h.js";
import { char, int, uchar, unsigned } from "../rt/ctypes.js";
import { Bitfield, ptr_to, struct, union } from "../rt/struct.js";
