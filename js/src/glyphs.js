/* NetHack 5.0	glyphs.c	TODO: add NHDT branch/date/revision tags */
/* Copyright (c) Michael Allison, 2021. */
/* NetHack may be freely redistributed.  See license for details. */

const res_nothing = 0; const res_dump_glyphids = res_nothing + 1; const res_fill_cache = res_dump_glyphids + 1;
const find_nothing = 0; const find_pm = find_nothing + 1; const find_oc = find_pm + 1; const find_cmap = find_oc + 1; const find_glyph = find_cmap + 1;
const struct_find_struct = struct("struct_find_struct", {
    findtype: unsigned,
    val: int,
    loadsyms_offset: int,
    loadsyms_count: int,
    extraval: ptr_to(int),
    color: uint32,
    unicode_val: ptr_to(char),
    callback: fnptr_t,
    restype: unsigned,
    reserved: ptr_to(void_t),
});
const zero_find = static_struct("zero_find", struct_find_struct, { findtype: 0 });
const struct_glyphid_cache_t = struct("struct_glyphid_cache_t", {
    glyphnum: int,
    id: ptr_to(char),
});
const glyphid_cache = static_var("glyphid_cache", ptr_to(struct_glyphid_cache_t));
const glyphid_cache_lsize = static_var("glyphid_cache_lsize", unsigned);
const glyphid_cache_size = static_var("glyphid_cache_size", unsigned);
const glyphcache_find = static_struct("glyphcache_find", struct_find_struct); const to_custom_symbol_find = static_struct("to_custom_symbol_find", struct_find_struct);
const nonzero_black = static_var("nonzero_black", long, CLR_BLACK | NH_BASIC_COLOR);

/* staticfn void purge_custom_entries(enum graphics_sets which_set); */

function to_custom_symset_entry_callback(
    glyph,
    findwhat) { /* void */
    const $frame = stack_frame(); try {
    let idx = gs.symset_which_set;

    let utf8str = init_list(stack_array(uchar, 6), [ 0, 0, 0, 0, 0, 0 ]);
    let uval = 0;

    if (findwhat.extraval)
        findwhat.extraval[0] = glyph;

    assert(idx >= 0 && idx < NUM_GRAPHICS);

    if (findwhat.unicode_val)
        uval = unicode_val(findwhat.unicode_val);
    if (uval && unicodeval_to_utf8str(uval, utf8str, sizeof(array_of(uchar, 6)))) {
        /* presently the customizations are affiliated with a particular
         * symset but if we don't have any symset context, ignore it for now
         * in order to avoid a segfault.
         * FIXME:
         * One future idea might be to store the U+ entries under "UTF8"
         * and apply those customizations to any current symset if it has
         * a UTF8 handler. Similar approach for unaffiliated glyph/symbols
         * non-UTF color customizations
         */
        if (gs.symset[idx].name) {
            add_custom_urep_entry(gs.symset[idx].name, glyph, unsigned(uval),
                              utf8str, unsigned(gs.symset_which_set));
        } else {
            let glyphnag = static_var("to_custom_symset_entry_callback.glyphnag", int, 0);

            if (!glyphnag[0]++)
                config_error_add(_("Unimplemented customization feature," +
                                 " ignoring for now"));
        }
    }

    if (findwhat.color) {
        if (gs.symset[idx].name) {
            add_custom_nhcolor_entry(gs.symset[idx].name, glyph,
                                 findwhat.color, unsigned(gs.symset_which_set));
        } else {
            let colornag = static_var("to_custom_symset_entry_callback.colornag", int, 0);

            if (!colornag[0]++)
                config_error_add(_("Unimplemented customization feature," +
                                 " ignoring for now"));
        }
    }
    } finally { stack_pop($frame); }
}

/*
 * Return value:
 *               1 = success
 *               0 = failure
 */
export function glyphrep_to_custom_map_entries(
    op,
    glyphptr) { /* int */
    const $frame = stack_frame(); try {
    struct_assign(to_custom_symbol_find, zero_find);
    let buf = stack_array(char, BUFSZ), c_glyphid, c_unicode, c_colorval, cp;
    let reslt = 0;
    let rgb = 0;
    let slash = FALSE, colon = FALSE;

    if (!glyphid_cache[0])
        reslt = 1; /* for debugger use only; no cache available */
    (reslt);

    Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s"), op);
    c_unicode = c_colorval = 0;
    c_glyphid = cp = buf;
    while (chars[cp]) {
        if (chars[cp] == ord(':') || chars[cp] == ord('/')) {
            if (chars[cp] == ord(':')) {
                colon = TRUE;
                chars[cp] = ord('\0');
            }
            if (chars[cp] == ord('/')) {
                slash = TRUE;
                chars[cp] = ord('\0');
            }
        }
        cp++;
        if (colon) {
            c_unicode = cp;
            colon = FALSE;
        }
        if (slash) {
            c_colorval = cp;
            slash = FALSE;
        }
    }
    /* some sanity checks */
    if (c_glyphid && chars[c_glyphid] == ord(' '))
        c_glyphid++;
    if (c_colorval && chars[c_colorval] == ord(' '))
        c_colorval++;
    if (c_unicode && chars[c_unicode] == ord(' ')) {
        while (chars[c_unicode] == ord(' ')) {
            c_unicode++;
        }
    }
    if (c_unicode && !chars[c_unicode])
        c_unicode = 0;

    if ((c_colorval && (rgb = rgbstr_to_int32(c_colorval)) != -1)
        || !c_colorval) {
        /* if the color 0 is an actual color, as opposed to just "not set"
           we set a marker bit outside the 24-bit range to indicate a
           valid color value 0. That allows valid color 0, but allows a
           simple checking for 0 to detect "not set". The window port that
           implements the color switch, needs to either check that bit
           or appropriately mask colors with 0xFFFFFF. */
        to_custom_symbol_find.color = unsigned((rgb == -1 || !c_colorval) ? 0
                                      : (rgb == 0) ? nonzero_black[0]
                                                    : rgb);
    }
    if (c_unicode)
        to_custom_symbol_find.unicode_val = c_unicode;
    to_custom_symbol_find.extraval = glyphptr;
    to_custom_symbol_find.callback = to_custom_symset_entry_callback;
    reslt = glyph_find_core(c_glyphid, to_custom_symbol_find);
    return reslt;
    } finally { stack_pop($frame); }
}

function fix_glyphname(str) { /* char * */
    let c;

    for (c = str; chars[c]; c++) {
        if (chars[c] >= ord('A') && chars[c] <= ord('Z'))
            chars[c] += (ord('a') - ord('A'));
        else if (chars[c] >= ord('0') && chars[c] <= ord('9'))
            ;
        else if (chars[c] < ord('a') || chars[c] > ord('z'))
            chars[c] = ord('_');
    }
    return str;
}

export function glyph_to_cmap(glyph) { /* int */
    if (glyph == GLYPH_CMAP_STONE_OFF)
        return S_stone;
    else if (glyph_is_cmap_main(glyph))
        return (glyph - GLYPH_CMAP_MAIN_OFF) + S_vwall;
    else if (glyph_is_cmap_mines(glyph))
        return (glyph - GLYPH_CMAP_MINES_OFF) + S_vwall;
    else if (glyph_is_cmap_gehennom(glyph))
        return (glyph - GLYPH_CMAP_GEH_OFF) + S_vwall;
    else if (glyph_is_cmap_knox(glyph))
        return (glyph - GLYPH_CMAP_KNOX_OFF) + S_vwall;
    else if (glyph_is_cmap_sokoban(glyph))
        return (glyph - GLYPH_CMAP_SOKO_OFF) + S_vwall;
    else if (glyph_is_cmap_a(glyph))
        return (glyph - GLYPH_CMAP_A_OFF) + S_ndoor;
    else if (glyph_is_cmap_altar(glyph))
        return S_altar;
    else if (glyph_is_cmap_b(glyph))
        return (glyph - GLYPH_CMAP_B_OFF) + S_grave;
    else if (glyph_is_cmap_c(glyph))
        return (glyph - GLYPH_CMAP_C_OFF) + S_digbeam;
    else if (glyph_is_cmap_zap(glyph))
        return ((glyph - GLYPH_ZAP_OFF) % 4) + S_vbeam;
    else if (glyph_is_swallow(glyph))
        return glyph_to_swallow(glyph) + S_sw_tl;
    else if (glyph_is_explosion(glyph))
        return glyph_to_explosion(glyph) + S_expl_tl;
    else
        return MAXPCHARS;    /* MAXPCHARS is legal array index because
                              * of trailing fencepost entry */
}

function glyph_find_core(
    id,
    findwhat) { /* int */
    let glyph;
    let do_callback, end_find = FALSE;

    if (parse_id(id, findwhat)) {
        if (findwhat.findtype == find_glyph) {
            findwhat.callback(findwhat.val, findwhat);
        } else {
            for (glyph = 0; glyph < MAX_GLYPH; ++glyph) {
                do_callback = FALSE;
                switch (findwhat.findtype) {
                case find_cmap:
                    if (glyph_to_cmap(glyph) == findwhat.val)
                        do_callback = TRUE;
                    break;
                case find_pm:
                    if (glyph_is_monster(glyph)
                        && mons[glyph_to_mon(glyph)].mlet
                           == findwhat.val)
                        do_callback = TRUE;
                    break;
                case find_oc:
                    if (glyph_is_object(glyph)
                        && glyph_to_obj(glyph) == findwhat.val)
                        do_callback = TRUE;
                    break;
                case find_glyph:
                    if (glyph == findwhat.val) {
                        do_callback = TRUE;
                        end_find = TRUE;
                    }
                    break;
                case find_nothing:
                default:
                    end_find = TRUE;
                    break;
                }
                if (do_callback)
                    findwhat.callback(glyph, findwhat);
                if (end_find)
                    break;
            }
        }
        return 1;
    }
    return 0;
}

/*
 When we start to process a config file or a symbol file,
 that might have G_ entries, generating all 9000+ glyphid
 for comparison repeatedly each time we encounter a G_
 entry to decipher, then comparing against them, is obviously
 extremely performance-poor.

 Setting aside the "comparison" part for now (that has to be
 done in some manner), we can likely do something about the
 repeated "generation" of the names for parsing prior to the
 actual comparison part by generating them once, ahead of the
 bulk of the potential parsings. We can later free up
 all the memory those names consumed once the bulk parsing is
 over with.
*/

export function fill_glyphid_cache() { /* void */
    let reslt = 0;

    if (!glyphid_cache[0]) {
        init_glyph_cache();
    }
    if (glyphid_cache[0]) {
        struct_assign(glyphcache_find, zero_find);
        glyphcache_find.findtype = find_nothing;
        glyphcache_find.reserved = addr_of(glyphid_cache[0]);
        glyphcache_find.restype = res_fill_cache;
        reslt = parse_id(0, glyphcache_find);
        if (!reslt) {
            free_glyphid_cache();
            glyphid_cache[0] = null;
        }
    }
}

/*
 * The glyph ID cache is a simple double-hash table.
 * The cache size is a power of two, and two hashes are derived from the
 * cache ID. The first is a location in the table, and the second is an
 * offset. On any collision, the second hash is added to the first until
 * a match or an empty bucket is found.
 * The second hash is an odd number, which is necessary and sufficient
 * to traverse the entire table.
 */

function init_glyph_cache() { /* void */
    let glyph;

    /* Cache size of power of 2 not less than 2*MAX_GLYPH */
    glyphid_cache_lsize[0] = 0;
    glyphid_cache_size[0] = 1;
    while (glyphid_cache_size[0] < 2*MAX_GLYPH) {
        ++glyphid_cache_lsize[0];
        glyphid_cache_size[0] <<= 1;
    }

    glyphid_cache[0] = view_of(struct_glyphid_cache_t, addr_of(alloc(
                        unsigned(Math.imul(glyphid_cache_size[0], sizeof(struct_glyphid_cache_t))))));
    for (glyph = 0; glyph < glyphid_cache_size[0]; ++glyph) {
        ptr_add(glyphid_cache[0], glyph).glyphnum = 0;
        ptr_add(glyphid_cache[0], glyph).id = 0;
    }
}

export function free_glyphid_cache() { /* void */
    let idx;

    if (!glyphid_cache[0])
        return;
    for (idx = 0; idx < glyphid_cache_size[0]; ++idx) {
        if (ptr_add(glyphid_cache[0], idx).id) {
            free(ptr_add(glyphid_cache[0], idx).id);
            ptr_add(glyphid_cache[0], idx).id = 0;
        }
    }
    free(addr_of(glyphid_cache[0]));
    glyphid_cache[0] = null;
}

function add_glyph_to_cache(glyphnum, id) { /* void */
    let hash = glyph_hash(id);
    let hash1 = unsigned(hash & unsigned(glyphid_cache_size[0] - 1));
    let hash2 = unsigned(unsigned((hash >>> glyphid_cache_lsize[0]) & unsigned(glyphid_cache_size[0] - 1)) | 1);

    let i = hash1;

    do {
        if (ptr_add(glyphid_cache[0], i).id == (0)) {
            /* Empty bucket found */
            ptr_add(glyphid_cache[0], i).id = dupstr(id);
            ptr_add(glyphid_cache[0], i).glyphnum = glyphnum;
            return;
        }
        /* For speed, assume that no ID occurs twice */
        i = unsigned(unsigned(i + hash2) & unsigned(glyphid_cache_size[0] - 1));
    } while (i != hash1);
    /* This should never happen */
    panic(_("glyphid_cache full"));
}

function find_glyph_in_cache(id) { /* int */
    let hash = glyph_hash(id);
    let hash1 = unsigned(hash & unsigned(glyphid_cache_size[0] - 1));
    let hash2 = unsigned(unsigned((hash >>> glyphid_cache_lsize[0]) & unsigned(glyphid_cache_size[0] - 1)) | 1);

    let i = hash1;

    do {
        if (ptr_add(glyphid_cache[0], i).id == (0)) {
            /* Empty bucket found */
            return -1;
        }
        if (strcmpi(id, ptr_add(glyphid_cache[0], i).id) == 0) {
            /* Match found */
            return ptr_add(glyphid_cache[0], i).glyphnum;
        }
        i = unsigned(unsigned(i + hash2) & unsigned(glyphid_cache_size[0] - 1));
    } while (i != hash1);
    return -1;
}

function find_glyphid_in_cache_by_glyphnum(glyphnum) { /* char * */
    let idx;

    if (!glyphid_cache[0])
        return 0;
    for (idx = 0; idx < glyphid_cache_size[0]; ++idx) {
        if (ptr_add(glyphid_cache[0], idx).glyphnum == glyphnum
            && ptr_add(glyphid_cache[0], idx).id != 0) {
            /* Match found */
            return ptr_add(glyphid_cache[0], idx).id;
        }
    }
    return 0;
}

function glyph_hash(id) { /* uint32 */
    let hash = 0;
    let i;

    for (i = 0; chars[id + i] != ord('\0'); ++i) {
        let ch = chars[id + i];
        if (ord('A') <= ch && ch <= ord('Z')) {
            ch += ord('a') - ord('A');
        }
        hash = unsigned(unsigned(hash << 1) | (hash >>> 31));
        hash = unsigned(hash ^ unsigned(ch));
    }
    return hash;
}

export function glyphid_cache_status() { /* boolean */
    return +(glyphid_cache[0] != null);
}

export function match_glyph(buf) { /* int */
    const $frame = stack_frame(); try {
    let workbuf = stack_array(char, BUFSZ);

    /* buf contains a G_ glyph reference, not an S_ symbol.
        There could be an R-G-B color attached too.
        Let's get a copy to work with. */
    Snprintf(workbuf, sizeof(array_of(char, BUFSZ)), _("%s"), buf); /* get a copy */
    return glyphrep(workbuf);
    } finally { stack_pop($frame); }
}

export function glyphrep(op) { /* int */
    const $frame = stack_frame(); try {
    let reslt = 0, glyph = stack_var(int, NO_GLYPH);

    if (!glyphid_cache[0])
        reslt = 1;      /* for debugger use only; no cache available */
    (reslt);
    reslt = glyphrep_to_custom_map_entries(op, glyph);
    if (reslt)
        return 1;
    return 0;
    } finally { stack_pop($frame); }
}

export function add_custom_nhcolor_entry(
    customization_name,
    glyphidx,
    nhcolor,
    which_set) { /* int */
    let gdc = gs.sym_customizations[which_set][custom_nhcolor];

    let details, newdetails = null;

    if (!gdc.details) {
        gdc.customization_name = dupstr(customization_name);
        gdc.custtype = custom_nhcolor;
        gdc.details = null;
        gdc.details_end = null;
    }
    details = find_matching_customization(customization_name,
                                          custom_nhcolor, which_set);
    if (details) {
        while (details) {
            if (details.content.ccolor.glyphidx == glyphidx) {
                details.content.ccolor.nhcolor = nhcolor;
                return 1;
            }
            details = details.next;
        }
    }
    /* create new details entry */
    newdetails = view_of(struct_customization_detail, addr_of(alloc(sizeof(struct_customization_detail))));
    newdetails.content.urep.glyphidx = glyphidx;
    newdetails.content.ccolor.nhcolor = nhcolor;
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

export function apply_customizations(
    which_set,
    docustomize) { /* void */
    let gmap;
    let details;
    let sc;
    let at_least_one = FALSE,
            do_colors = +((docustomize & do_custom_colors) != 0),
            do_symbols = +((docustomize & do_custom_symbols) != 0);
    let custs;

    for (custs = 0; custs < custom_count; ++custs) {
        sc = gs.sym_customizations[which_set][custs];
        if (sc.count && sc.details) {
            at_least_one = TRUE;
            /* These glyph customizations get applied to the glyphmap array,
               not to symset entries */
            details = sc.details;
            while (details) {
                if (iflags.customsymbols && do_symbols) {
                    if (sc.custtype == custom_ureps) {
                        gmap = glyphmap[details.content.urep.glyphidx];
                        if (gs.symset[which_set].handling == H_UTF8)
                            set_map_u(gmap,
                                             details.content.urep.u.utf32ch,
                                             details.content.urep.u.utf8str);
                    }
                }

                if (iflags.customcolors && do_colors) {
                    if (sc.custtype == custom_nhcolor) {
                        gmap = glyphmap[details.content.ccolor.glyphidx];
                        set_map_customcolor(gmap,
                                             details.content.ccolor.nhcolor);
                    }
                }
                details = details.next;
            }
        }
    }
    iflags.pending_customizations = at_least_one;
}

/* Shuffle the customizations to match shuffled object descriptions,
 * so a red potion isn't displayed with a blue customization, and so on.
 */

export function maybe_shuffle_customizations() { /* void */
    if (iflags.pending_customizations) {
        shuffle_customizations();
        iflags.pending_customizations = 0;
    }
}

/* #if 0: not in this build */

function shuffle_customizations() { /* void */
    const $frame = stack_frame(); try {
    let offsets = static_array("shuffle_customizations.offsets", int, 2, [ GLYPH_OBJ_OFF, GLYPH_OBJ_PILETOP_OFF ]);
    let j;

    for (j = 0; j < SIZE(offsets); j++) {
        let obj_glyphs = ptr_add(glyphmap[0], (offsets[j]));
        let i;

        let tmp_u = stack_array(ptr_to(struct_unicode_representation), NUM_OBJECTS);

        let tmp_customcolor = stack_array(unsigned, NUM_OBJECTS);
        let tmp_color256idx = stack_array(ushort, NUM_OBJECTS);

        let duplicate = stack_array(int, NUM_OBJECTS);

        for (i = 0; i < NUM_OBJECTS; i++) {
            duplicate[i] = -1;

            tmp_u[i] = null;

            tmp_customcolor[i] = 0;
            tmp_color256idx[i] = 0;
        }
        for (i = 0; i < NUM_OBJECTS; i++) {
            let idx = objects[i].oc_descr_idx;

            /*
             * Shuffling gem appearances can cause the same oc_descr_idx to
             * appear more than once. Detect this condition and ensure that
             * each pointer points to a unique allocation.
             */
            if (duplicate[idx] >= 0) {
                /* Current structure already appears in tmp_u */
                let other = tmp_u[duplicate[idx]];

                let other_customcolor = tmp_customcolor[duplicate[idx]];
                let other_color256idx = tmp_color256idx[duplicate[idx]];

                tmp_customcolor[i] = other_customcolor;
                tmp_color256idx[i] = other_color256idx;

                if (other) {
                    tmp_u[i] = view_of(struct_unicode_representation, addr_of(alloc(
                        sizeof(struct_unicode_representation))));
                    struct_assign(tmp_u[i], other);
                    if (other.utf8str != (0)) {
                        tmp_u[i].utf8str =
                            dupstr(other.utf8str);
                    }
                }
            } else {
                tmp_customcolor[i] = ptr_add(obj_glyphs, idx).customcolor;
                tmp_color256idx[i] = ptr_add(obj_glyphs, idx).color256idx;

                tmp_u[i] = ptr_add(obj_glyphs, idx).u;

                if (

                    ptr_add(obj_glyphs, idx).u != null ||

                    ptr_add(obj_glyphs, idx).customcolor != 0) {
                    duplicate[idx] = i;

                    ptr_add(obj_glyphs, idx).u = null;

                    ptr_add(obj_glyphs, idx).customcolor = 0;
                    ptr_add(obj_glyphs, idx).color256idx = 0;
                }
            }
        }
        for (i = 0; i < NUM_OBJECTS; i++) {
            /* Some glyphmaps may not have been transferred */

            if (ptr_add(obj_glyphs, i).u != null) {
                free(ptr_add(obj_glyphs, i).u.utf8str);
                free(addr_of(ptr_add(obj_glyphs, i).u));
            }
            ptr_add(obj_glyphs, i).u = tmp_u[i];

            ptr_add(obj_glyphs, i).customcolor = tmp_customcolor[i];
            ptr_add(obj_glyphs, i).color256idx = tmp_color256idx[i];
        }
    }
    } finally { stack_pop($frame); }
}

export function find_matching_customization(
    customization_name,
    custtype,
    which_set) { /* struct customization_detail * */
    let gdc = gs.sym_customizations[which_set][custtype];

    if ((gdc.custtype == custtype) && gdc.customization_name
        && (strcmp(customization_name, gdc.customization_name) == 0))
        return gdc.details;
    return null;
}

export function purge_all_custom_entries() { /* void */
    let i;

    for (i = 0; i < NUM_GRAPHICS + 1; ++i) {
        purge_custom_entries(unsigned(i));
    }
}

export function purge_custom_entries(which_set) { /* void */
    let custtype;
    let gdc;
    let details, next;

    for (custtype = custom_none; custtype < custom_count; ++custtype) {
        gdc = gs.sym_customizations[which_set][custtype];
        details = gdc.details;
        while (details) {
            next = details.next;
            if (gdc.custtype == custom_ureps) {
                if (details.content.urep.u.utf8str)
                    free(details.content.urep.u.utf8str);
                details.content.urep.u.utf8str = 0;
            } else if (gdc.custtype == custom_symbols) {
                details.content.sym.symparse = null;
                details.content.sym.val = 0;
            } else if (gdc.custtype == custom_nhcolor) {
                details.content.ccolor.nhcolor = 0;
                details.content.ccolor.glyphidx = 0;
            }
            free(addr_of(details));
            details = next;
        }
        gdc.details = null;
        gdc.details_end = null;
        if (gdc.customization_name) {
            free(gdc.customization_name);
            gdc.customization_name = 0;
        }
        gdc.count = 0;
    }
}

export function dump_all_glyphids(fp) { /* void */
    const $frame = stack_frame(); try {
    let dump_glyphid_find = struct_assign(stack_struct(struct_find_struct), zero_find);

    dump_glyphid_find.findtype = find_nothing;
    dump_glyphid_find.reserved = addr_of(fp);
    dump_glyphid_find.restype = res_dump_glyphids;
    parse_id(0, dump_glyphid_find);
    } finally { stack_pop($frame); }
}

export function wizcustom_glyphids(win) { /* void */
    let glyphnum;
    let id;

    if (!glyphid_cache[0])
        return;
    for (glyphnum = 0; glyphnum < MAX_GLYPH; ++glyphnum) {
        id = find_glyphid_in_cache_by_glyphnum(glyphnum);
        if (id) {
            wizcustom_callback(win, glyphnum, id);
        }
    }
}

function parse_id(
    id,
    findwhat) { /* int */
    const $frame = stack_frame(); try {
    let fp = null;
    let i = 0, j, mnum, glyph,
        pm_offset = 0, oc_offset = 0, cmap_offset = 0,
        pm_count = 0, oc_count = 0, cmap_count = 0;
    let skip_base = FALSE, skip_this_one = FALSE, dump_ids = FALSE,
            filling_cache = FALSE, is_S = FALSE, is_G = FALSE;
    let buf = stack_array(array_of(char, QBUFSZ), 4);

    if (findwhat.findtype == find_nothing && findwhat.restype) {
        if (findwhat.restype == res_dump_glyphids) {
            if (findwhat.reserved) {
                fp = view_of(struct__IO_FILE, findwhat.reserved);
                dump_ids = TRUE;
            } else {
                return 0;
            }
        }
        if (findwhat.restype == res_fill_cache) {
            if (findwhat.reserved
                && findwhat.reserved == addr_of(glyphid_cache[0])) {
                filling_cache = TRUE;
            } else {
                return 0;
            }
        }
    }

    is_G = (id && chars[id + 0] == ord('G') && chars[id + 1] == ord('_') ? 1 : 0);
    is_S = (id && chars[id + 0] == ord('S') && chars[id + 1] == ord('_') ? 1 : 0);

    if ((is_G && !glyphid_cache[0]) || filling_cache || dump_ids || is_S) {
        while (loadsyms[i].range) {
            if (!pm_offset && loadsyms[i].range == SYM_MON)
                pm_offset = i;
            if (!pm_count && pm_offset && loadsyms[i].range != SYM_MON)
                pm_count = i - pm_offset;
            if (!oc_offset && loadsyms[i].range == SYM_OC)
                oc_offset = i;
            if (!oc_count && oc_offset && loadsyms[i].range != SYM_OC)
                oc_count = i - oc_offset;
            if (!cmap_offset && loadsyms[i].range == SYM_PCHAR)
                cmap_offset = i;
            if (!cmap_count && cmap_offset && loadsyms[i].range != SYM_PCHAR)
                cmap_count = i - cmap_offset;
            i++;
        }
    }
    if (is_G || filling_cache || dump_ids) {
        if (!filling_cache && id && glyphid_cache[0]) {
            let val = find_glyph_in_cache(id);
            if (val >= 0) {
                findwhat.findtype = find_glyph;
                findwhat.val = val;
                findwhat.loadsyms_offset = 0;
                return 1;
            } else {
                return 0;
            }
        } else {
            let buf2, buf3, buf4;

            /* individual matching glyph entries */
            for (glyph = 0; glyph < MAX_GLYPH; ++glyph) {
                skip_base = FALSE;
                skip_this_one = FALSE;
                chars[buf[0] + 0] = chars[buf[1] + 0] = chars[buf[2] + 0] = chars[buf[3] + 0] = ord('\0');
                if (glyph_is_monster(glyph)) {
                    /* buf2 will hold the distinguishing prefix */
                    /* buf3 will hold the base name */
                    buf2 = _("");
                    buf3 = monsdump[glyph_to_mon(glyph)].nm;

                    if (glyph_is_normal_male_monster(glyph)) {
                        buf2 = _("male_");
                    } else if (glyph_is_normal_female_monster(glyph)) {
                        buf2 = _("female_");
                    } else if (glyph_is_ridden_male_monster(glyph)) {
                        buf2 = _("ridden_male_");
                    } else if (glyph_is_ridden_female_monster(glyph)) {
                        buf2 = _("ridden_female_");
                    } else if (glyph_is_detected_male_monster(glyph)) {
                        buf2 = _("detected_male_");
                    } else if (glyph_is_detected_female_monster(glyph)) {
                        buf2 = _("detected_female_");
                    } else if (glyph_is_male_pet(glyph)) {
                        buf2 = _("pet_male_");
                    } else if (glyph_is_female_pet(glyph)) {
                        buf2 = _("pet_female_");
                    }
                    strcpy(buf[0], _("G_"));
                    strcat(buf[0], buf2);
                    strcat(buf[0], buf3);
                } else if (glyph_is_body(glyph)) {
                    /* buf2 will hold the distinguishing prefix */
                    /* buf3 will hold the base name */
                    buf2 = glyph_is_body_piletop(glyph)
                           ? _("piletop_body_")
                           : _("body_");
                    buf3 = monsdump[glyph_to_body_corpsenm(glyph)].nm;
                    strcpy(buf[0], _("G_"));
                    strcat(buf[0], buf2);
                    strcat(buf[0], buf3);
                } else if (glyph_is_statue(glyph)) {
                    /* buf2 will hold the distinguishing prefix */
                    /* buf3 will hold the base name */
                    buf2 = glyph_is_fem_statue_piletop(glyph)
                           ? _("piletop_statue_of_female_")
                           : glyph_is_fem_statue(glyph)
                             ? _("statue_of_female_")
                             : glyph_is_male_statue_piletop(glyph)
                               ? _("piletop_statue_of_male_")
                               : glyph_is_male_statue(glyph)
                                 ? _("statue_of_male_")
                                 : _(""); /* shouldn't happen */
                    buf3 = monsdump[glyph_to_statue_corpsenm(glyph)].nm;
                    strcpy(buf[0], _("G_"));
                    strcat(buf[0], buf2);
                    strcat(buf[0], buf3);
                } else if (glyph_is_object(glyph)) {
                    i = glyph_to_obj(glyph);
                    /* buf2 will hold the distinguishing prefix */
                    /* buf3 will hold the base name */
                    if (((i > SCR_STINKING_CLOUD) && (i < SCR_MAIL))
                        || ((i > WAN_LIGHTNING) && (i < GOLD_PIECE)))
                        skip_this_one = TRUE;
                    if (!skip_this_one) {
                        if ((i >= WAN_LIGHT) && (i <= WAN_LIGHTNING))
                            buf2 = _("wand of ");
                        else if ((i >= SPE_DIG) && (i < SPE_BLANK_PAPER))
                            buf2 = _("spellbook of ");
                        else if ((i >= SCR_ENCHANT_ARMOR)
                                 && (i <= SCR_STINKING_CLOUD))
                            buf2 = _("scroll of ");
                        else if ((i >= POT_GAIN_ABILITY) && (i <= POT_WATER))
                            buf2 = (i == POT_WATER) ? _("flask of n")
                                                    : _("potion of ");
                        else if ((i >= RIN_ADORNMENT)
                                 && (i <= RIN_PROTECTION_FROM_SHAPE_CHAN))
                            buf2 = _("ring of ");
                        else if (i == LAND_MINE)
                            buf2 = _("unset ");
                        else
                            buf2 = _("");
                        buf3 = (i == SCR_BLANK_PAPER) ? _("blank scroll")
                               : (i == SPE_BLANK_PAPER) ? _("blank spellbook")
                                 : (i == SLIME_MOLD) ? _("slime mold")
                                   : obj_descr[i].oc_name
                                     ? obj_descr[i].oc_name
                                     : obj_descr[i].oc_descr;
                        strcpy(buf[0], _("G_"));
                        if (glyph_is_normal_piletop_obj(glyph))
                            strcat(buf[0], _("piletop_"));
                        strcat(buf[0], buf2);
                        strcat(buf[0], buf3);
                    }
                } else if (glyph_is_cmap(glyph) || glyph_is_cmap_zap(glyph)
                           || glyph_is_swallow(glyph)
                           || glyph_is_explosion(glyph)) {
                    let cmap = -1;

                    /* buf2 will hold the distinguishing prefix */
                    /* buf3 will hold the base name */
                    /* buf4 will hold the distinguishing suffix */
                    buf2 = _("");
                    buf3 = _("");
                    buf4 = _("");
                    if (glyph == GLYPH_CMAP_OFF) {
                        cmap = S_stone;
                        buf3 = _("stone substrate");
                        skip_base = TRUE;
                    } else if (glyph_is_cmap_gehennom(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_GEH_OFF) + S_vwall;
                        buf4 = _("_gehennom");
                    } else if (glyph_is_cmap_knox(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_KNOX_OFF) + S_vwall;
                        buf4 = _("_knox");
                    } else if (glyph_is_cmap_main(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_MAIN_OFF) + S_vwall;
                        buf4 = _("_main");
                    } else if (glyph_is_cmap_mines(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_MINES_OFF) + S_vwall;
                        buf4 = _("_mines");
                    } else if (glyph_is_cmap_sokoban(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_SOKO_OFF) + S_vwall;
                        buf4 = _("_sokoban");
                    } else if (glyph_is_cmap_a(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_A_OFF) + S_ndoor;
                    } else if (glyph_is_cmap_altar(glyph)) {
                        let altar_text = static_array("parse_id.altar_text", ptr_to(char), null, [
                            _("unaligned"), _("chaotic"), _("neutral"),
                            _("lawful"),    _("other"),
                        ]);

                        j = (glyph - GLYPH_ALTAR_OFF);
                        cmap = S_altar;
                        if (j != altar_other) {
                            Snprintf(buf[2], sizeof(array_of(char, QBUFSZ)), _("%s_"), altar_text[j])
;
                            buf2 = buf[2];
                        } else {
                            buf3 = _("altar other");
                            skip_base = TRUE;
                        }
                    } else if (glyph_is_cmap_b(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_B_OFF) + S_grave;
                    } else if (glyph_is_cmap_zap(glyph)) {
                        let zap_texts = static_array("parse_id.zap_texts", ptr_to(char), null, [
                            _("missile"), _("fire"),      _("frost"),      _("sleep"),
                            _("death"),   _("lightning"), _("poison gas"), _("acid")
                        ]);

                        j = (glyph - GLYPH_ZAP_OFF);
                        cmap = (j % 4) + S_vbeam;
                        Snprintf(buf[2], sizeof(array_of(char, QBUFSZ)), _("%s"), loadsyms[cmap + cmap_offset].name + 2)
;
                        Snprintf(buf[3], sizeof(array_of(char, QBUFSZ)), _("%s zap %s"), zap_texts[Math.trunc(j / 4)], fix_glyphname(buf[2]))
;
                        buf3 = buf[3];
                        buf2 = _("");
                        skip_base = TRUE;
                    } else if (glyph_is_cmap_c(glyph)) {
                        cmap = (glyph - GLYPH_CMAP_C_OFF) + S_digbeam;
                    } else if (glyph_is_swallow(glyph)) {
                        let swallow_texts = static_array("parse_id.swallow_texts", ptr_to(char), null, [
                            _("top left"),      _("top center"),   _("top right"),
                            _("middle left"),   _("middle right"), _("bottom left"),
                            _("bottom center"), _("bottom right"),
                        ]);

                        j = glyph - GLYPH_SWALLOW_OFF;
                        cmap = glyph_to_swallow(glyph);
                        mnum = Math.trunc(j / ((S_sw_br - S_sw_tl) + 1));
                        strcpy(buf[3], _("swallow "));
                        strcat(buf[3], monsdump[mnum].nm);
                        strcat(buf[3], _(" "));
                        strcat(buf[3], swallow_texts[cmap]);
                        buf3 = buf[3];
                        skip_base = TRUE;
                    } else if (glyph_is_explosion(glyph)) {
                        let expl_type_texts = static_array("parse_id.expl_type_texts", ptr_to(char), null, [
                            _("dark"),    _("noxious"), _("muddy"),  _("wet"),
                            _("magical"), _("fiery"),   _("frosty"),
                        ]);
                        let expl_texts = static_array("parse_id.expl_texts", ptr_to(char), null, [
                            _("tl"), _("tc"), _("tr"), _("ml"), _("mc"),
                            _("mr"), _("bl"), _("bc"), _("br"),
                        ]);
                        let expl;

                        j = glyph - GLYPH_EXPLODE_OFF;
                        expl = Math.trunc(j / ((S_expl_br - S_expl_tl) + 1));
                        cmap = glyph_to_explosion(glyph) + S_expl_tl;
                        i = cmap - S_expl_tl;
                        Snprintf(buf[2], sizeof(array_of(char, QBUFSZ)), _("%s "), expl_type_texts[expl])
;
                        buf2 = buf[2];
                        Snprintf(buf[3], sizeof(array_of(char, QBUFSZ)), _("%s%s"), _("expl_"), expl_texts[i])
;
                        buf3 = buf[3];
                        skip_base = TRUE;
                    }
                    if (!skip_base) {
                        if (cmap >= 0 && cmap < MAXPCHARS) {
                            buf3 = loadsyms[cmap + cmap_offset].name + 2;
                        }
                    }
                    strcpy(buf[0], _("G_"));
                    strcat(buf[0], buf2);
                    strcat(buf[0], buf3);
                    strcat(buf[0], buf4);
                } else if (glyph_is_invisible(glyph)) {
                    strcpy(buf[0], _("G_invisible"));
                } else if (glyph_is_nothing(glyph)) {
                    strcpy(buf[0], _("G_nothing"));
                } else if (glyph_is_unexplored(glyph)) {
                    strcpy(buf[0], _("G_unexplored"));
                } else if (glyph_is_warning(glyph)) {
                    j = glyph - GLYPH_WARNING_OFF;
                    Snprintf(buf[0], sizeof(array_of(char, QBUFSZ)), _("G_%s%d"), _("warning"), j);
                }
                if (memchr(buf[0], ord('\0'), sizeof(array_of(char, QBUFSZ))) == (0))
                    panic(_("parse_id: buf[0] overflowed"));
                if (!skip_this_one) {
                    fix_glyphname(buf[0]+2);
                    if (dump_ids) {
                        fprintf(fp, _("(%04d) %s\n"), glyph, buf[0]);
                    } else if (filling_cache) {
                        add_glyph_to_cache(glyph, buf[0]);
                    } else if (id) {
                        if (!strcmpi(id, buf[0])) {
                            findwhat.findtype = find_glyph;
                            findwhat.val = glyph;
                            findwhat.loadsyms_offset = 0;
                            return 1;
                        }
                    }
                }
            }
        } /* not glyphid_cache */
    } else if (is_S) {
        /* cmap entries */
        for (i = 0; i < cmap_count; ++i) {
            if (!strcmpi(loadsyms[i + cmap_offset].name + 2, id + 2)) {
                findwhat.findtype = find_cmap;
                findwhat.val = i;
                findwhat.loadsyms_offset = i + cmap_offset;
                return 1;
            }
        }
        /* objclass entries */
        for (i = 0; i < oc_count; ++i) {
            if (!strcmpi(loadsyms[i + oc_offset].name + 2, id + 2)) {
                findwhat.findtype = find_oc;
                findwhat.val = i;
                findwhat.loadsyms_offset = i + oc_offset;
                return 1;
            }
        }
        /* permonst entries */
        for (i = 0; i <= pm_count; ++i) {
            if (!strcmpi(loadsyms[i + pm_offset].name + 2, id + 2)) {
                findwhat.findtype = find_pm;
                findwhat.val = i + 1; /* starts at 1 */
                findwhat.loadsyms_offset = i + pm_offset;
                return 1;
            }
        }
    }
    if (dump_ids || filling_cache)
        return 1;
    findwhat.findtype = find_nothing;
    findwhat.val = 0;
    findwhat.loadsyms_offset = 0;
    return 0;
    } finally { stack_pop($frame); }
}

/* extern glyph_map glyphmap[MAX_GLYPH]; */

export function clear_all_glyphmap_colors() { /* void */
    let glyph;

    for (glyph = 0; glyph < MAX_GLYPH; ++glyph) {
        if (glyphmap[glyph].customcolor)
            glyphmap[glyph].customcolor = 0;
        glyphmap[glyph].color256idx = 0;
    }
}

export function reset_customcolors() { /* void */
    clear_all_glyphmap_colors();
    apply_customizations(unsigned(gc.currentgraphics), do_custom_colors);
}

/* not used yet */

/* #if 0: not in this build */

/* #ifdef TEST_GLYPHNAMES: not in this build */

/* glyphs.c */

import { CLR_BLACK, NH_BASIC_COLOR } from "./color.h.js";
import {
    MAXPCHARS, S_altar, S_digbeam, S_expl_br, S_expl_tl, S_grave, S_ndoor, S_stone, S_sw_br,
    S_sw_tl, S_vbeam, S_vwall,
} from "./defsym.h.js";
import {
    GLYPH_ALTAR_OFF, GLYPH_CMAP_A_OFF, GLYPH_CMAP_B_OFF, GLYPH_CMAP_C_OFF, GLYPH_CMAP_GEH_OFF,
    GLYPH_CMAP_KNOX_OFF, GLYPH_CMAP_MAIN_OFF, GLYPH_CMAP_MINES_OFF, GLYPH_CMAP_OFF,
    GLYPH_CMAP_SOKO_OFF, GLYPH_CMAP_STONE_OFF, GLYPH_EXPLODE_OFF, GLYPH_OBJ_OFF,
    GLYPH_OBJ_PILETOP_OFF, GLYPH_SWALLOW_OFF, GLYPH_WARNING_OFF, GLYPH_ZAP_OFF, MAX_GLYPH, NO_GLYPH,
    altar_other,
} from "./display.h.js";
import {
    glyph_is_body, glyph_is_body_piletop, glyph_is_cmap, glyph_is_cmap_a, glyph_is_cmap_altar,
    glyph_is_cmap_b, glyph_is_cmap_c, glyph_is_cmap_gehennom, glyph_is_cmap_knox,
    glyph_is_cmap_main, glyph_is_cmap_mines, glyph_is_cmap_sokoban, glyph_is_cmap_zap,
    glyph_is_detected_female_monster, glyph_is_detected_male_monster, glyph_is_explosion,
    glyph_is_fem_statue, glyph_is_fem_statue_piletop, glyph_is_female_pet, glyph_is_invisible,
    glyph_is_male_pet, glyph_is_male_statue, glyph_is_male_statue_piletop, glyph_is_monster,
    glyph_is_normal_female_monster, glyph_is_normal_male_monster, glyph_is_normal_piletop_obj,
    glyph_is_nothing, glyph_is_object, glyph_is_ridden_female_monster, glyph_is_ridden_male_monster,
    glyph_is_statue, glyph_is_swallow, glyph_is_unexplored, glyph_is_warning,
    glyph_to_body_corpsenm, glyph_to_explosion, glyph_to_mon, glyph_to_obj,
    glyph_to_statue_corpsenm, glyph_to_swallow,
} from "./display.h.macros.js";
import { BUFSZ, FALSE, QBUFSZ, TRUE } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { uint32 } from "./integer.h.js";
import {
    GOLD_PIECE, LAND_MINE, NUM_OBJECTS, POT_GAIN_ABILITY, POT_WATER, RIN_ADORNMENT,
    RIN_PROTECTION_FROM_SHAPE_CHAN, SCR_BLANK_PAPER, SCR_ENCHANT_ARMOR, SCR_MAIL,
    SCR_STINKING_CLOUD, SLIME_MOLD, SPE_BLANK_PAPER, SPE_DIG, WAN_LIGHT, WAN_LIGHTNING,
} from "./objects.h.js";
import {
    H_UTF8, NUM_GRAPHICS, SYM_MON, SYM_OC, SYM_PCHAR, custom_count, custom_nhcolor, custom_none,
    custom_symbols, custom_ureps, do_custom_colors, do_custom_symbols, struct_customization_detail,
} from "./sym.h.js";
import { struct_unicode_representation } from "./wintype.h.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, long, ord, sizeof, uchar, unsigned, ushort } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop } from "../rt/heap.js";
import { assert, fprintf, free, memchr, strcat, strcmp, strcpy } from "../rt/libc.js";
import {
    init_list, stack_array, stack_struct, stack_var, static_array, static_struct, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, fnptr_t, ptr_add, ptr_to, record_or_opaque, struct, struct_assign, view_of,
    void_t,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { config_error_add } from "./cfgfiles.js";
import { rgbstr_to_int32, set_map_customcolor } from "./coloratt.js";
import { gc, gs, iflags } from "./decl.js";
import { glyphmap } from "./display.js";
import { monsdump } from "./earlyarg.js";
import { panic } from "./end.js";
import { unicodeval_to_utf8str } from "./hacklib.js";
import { mons } from "./monst.js";
import { obj_descr, objects } from "./objects.js";
import { loadsyms } from "./symbols.js";
import { add_custom_urep_entry, set_map_u, unicode_val } from "./utf8map.js";
import { wizcustom_callback } from "./wizcmds.js";
const struct__IO_FILE = record_or_opaque("struct__IO_FILE");
