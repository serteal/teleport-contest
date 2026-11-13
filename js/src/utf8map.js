/* NetHack 5.0	utf8map.c	*/
/* Copyright (c) Michael Allison, 2021. */
/* NetHack may be freely redistributed.  See license for details. */

        /* symbols.c */

/* hexdd[] is defined in decl.c */

export function unicode_val(cp) { /* int */
    let dp;
    let cval = 0, dcount;

    if (cp && chars[cp]) {
        cval = dcount = 0;
        if ((chars[cp] == ord('U') || chars[cp] == ord('u'))
            && chars[cp + 1] == ord('+') && chars[cp + 2] && (dp = strchr(hexdd, chars[cp + 2])) != 0) {
            cp += 2; /* move past the 'U' and '+' */
            do {
                cval = (cval * 16) + Math.trunc((dp - hexdd) / 2);
            } while (chars[++cp] && (dp = strchr(hexdd, chars[cp])) != 0 && ++dcount < 7);
        }
    }
    return cval;
}

export function set_map_u(gmap, utf32ch, utf8str) { /* int */
    let tmpgm = gmap;

    if (!tmpgm || !utf32ch)
        return 0;

    if (gmap.u == null) {
        gmap.u =
            view_of(struct_unicode_representation, addr_of(alloc(sizeof(struct_unicode_representation))));
        gmap.u.utf8str = 0;
    }
    if (gmap.u.utf8str != 0) {
        free(gmap.u.utf8str);
        gmap.u.utf8str = 0;
    }
    gmap.u.utf8str = dupstr(utf8str);
    gmap.u.utf32ch = utf32ch;
    return 1;
}

export function free_all_glyphmap_u() { /* void */
    let glyph;
    let x, y;

    for (glyph = 0; glyph < MAX_GLYPH; ++glyph) {
        if (glyphmap[glyph].u) {
            if (glyphmap[glyph].u.utf8str) {
                free(glyphmap[glyph].u.utf8str);
                glyphmap[glyph].u.utf8str = 0;
            }
            free(addr_of(glyphmap[glyph].u));
            glyphmap[glyph].u = null;
        }
    }
    /* Prevent use after free from gg.gbuf */
    for (y = 0; y < ROWNO; ++y) {
        for (x = 0; x < COLNO; ++x) {
            gg.gbuf[y][x].glyphinfo.gm.u = null;
        }
    }
}

/* helper routine if a window port wants to embed any UTF-8 sequences
   for the glyph representation in the string in place of the \GNNNNNNNN
   reference */
export function mixed_to_utf8(buf, bufsz, str, retflags) { /* char * */
    const $frame = stack_frame(); try {
    let put = buf;
    let glyphinfo = struct_assign(stack_struct(struct_glyphinfo), nul_glyphinfo);

    if (!str)
        return strcpy(buf, _(""));

    while (chars[str] && put < (buf + bufsz) - 1) {
        if (chars[str] == ord('\\')) {
            let dcount, so, ggv = stack_var(int);
            let save_str;

            save_str = str++;
            switch (chars[str]) {
            case ord('G'): /* glyph value \GXXXXNNNN*/
                if ((dcount = decode_glyph(str + 1, ggv))) {
                    str += (dcount + 1);
                    map_glyphinfo(0, 0, ggv[0], 0, glyphinfo);
                    if (glyphinfo.gm.u && glyphinfo.gm.u.utf8str) {
                        let ucp = glyphinfo.gm.u.utf8str;

                        while (uchars[ucp] && put < (buf + bufsz) - 1)
                            chars[put++] = char(uchars[ucp++]);
                        if (retflags)
                            retflags[0] = 1;
                    } else {
                        so = glyphinfo.gm.sym.symidx;
                        chars[put++] = char(uchars[gs.showsyms + so]);
                        if (retflags)
                            retflags[0] = 0;
                    }
                    /* 'str' is ready for the next loop iteration and
                        '*str' should not be copied at the end of this
                        iteration */
                    continue;
                } else {
                    /* possible forgery - leave it the way it is */
                    str = save_str;
                }
                break;
            case ord('\\'):
                break;
            case ord('\0'):
                /* String ended with '\\'.  This can happen when someone
                    names an object with a name ending with '\\', drops the
                    named object on the floor nearby and does a look at all
                    nearby objects. */
                /* brh - should we perhaps not allow things to have names
                    that contain '\\' */
                str = save_str;
                break;
            }
        }
        if (put < (buf + bufsz) - 1)
            chars[put++] = chars[str++];
    }
    chars[put] = ord('\0');
    return buf;
    } finally { stack_pop($frame); }
}

export function add_custom_urep_entry(
    customization_name,
    glyphidx,
    utf32ch,
    utf8str,
    which_set) { /* int */
    let gdc = gs.sym_customizations[which_set][custom_ureps];

    let details, newdetails = null;

    if (!gdc.details) {
        gdc.customization_name = dupstr(customization_name);
        gdc.custtype = custom_ureps;
        gdc.details = null;
        gdc.details_end = null;
    }
    details = find_matching_customization(customization_name,
                                          custom_ureps, which_set); /* FIXME */
    if (details) {
        while (details) {
            if (details.content.urep.glyphidx == glyphidx) {
                if (details.content.urep.u.utf8str)
                    free(details.content.urep.u.utf8str);
                if (utf32ch) {
                    details.content.urep.u.utf8str =
                        dupstr(utf8str);
                    details.content.urep.u.utf32ch = utf32ch;
                } else {
                    details.content.urep.u.utf8str = 0;
                    details.content.urep.u.utf32ch = 0;
                }
                return 1;
            }
            details = details.next;
        }
    }
    /* create new details entry */
    newdetails = view_of(struct_customization_detail, addr_of(alloc(
                                        sizeof(struct_customization_detail))));
    newdetails.content.urep.glyphidx = glyphidx;
    if (utf8str && uchars[utf8str]) {
        newdetails.content.urep.u.utf8str =
            dupstr(utf8str);
    } else {
        newdetails.content.urep.u.utf8str =
            0;
    }
    newdetails.content.urep.u.utf32ch = utf32ch;
    newdetails.next = null;
    if (gdc.details == null) {
        gdc.details = newdetails;
    } else {
        gdc.details_end.next = newdetails;
    }
    gdc.details_end = newdetails;
    gdc.count++;
    return 1;
}

export function reset_customsymbols() { /* void */
    free_all_glyphmap_u();
    apply_customizations(unsigned(gc.currentgraphics), do_custom_symbols);
}

/* utf8map.c */

import { MAX_GLYPH } from "./display.h.js";
import { COLNO, ROWNO } from "./global.h.js";
import { custom_ureps, do_custom_symbols, struct_customization_detail } from "./sym.h.js";
import { struct_glyphinfo, struct_unicode_representation } from "./wintype.h.js";
import { char, int, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { free, strchr, strcpy } from "../rt/libc.js";
import { stack_struct, stack_var } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import { addr_of, struct_assign, view_of } from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { gc, gg, gs, hexdd } from "./decl.js";
import { glyphmap, map_glyphinfo, nul_glyphinfo } from "./display.js";
import { apply_customizations, find_matching_customization } from "./glyphs.js";
import { decode_glyph } from "./windows.js";
