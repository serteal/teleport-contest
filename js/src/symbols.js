/* NetHack 5.0	symbols.c	$NHDT-Date: 1736530208 2025/01/10 09:30:08 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.123 $ */
/* Copyright (c) NetHack Development Team 2020.                   */
/* NetHack may be freely redistributed.  See license for details. */

      /* drawing.c */

global_scalar("decgraphics_mode_callback", fnptr_t, null); /* set in term_start_screen() */

global_scalar("utf8graphics_mode_callback", fnptr_t, null); /* set in term_start_screen and
                                               * found in unixtty,windtty,&c */

/*
 * Explanations of the functions found below:
 *
 * init_symbols()
 *                     Sets the current display symbols, the
 *                     loadable symbols to the default NetHack
 *                     symbols, including the rogue_syms rogue level
 *                     symbols. This would typically be done
 *                     immediately after execution begins. Any
 *                     previously loaded external symbol sets are
 *                     discarded.
 *
 * switch_symbols(arg)
 *                     Called to swap in new current display symbols
 *                     (showsyms) from either the default symbols,
 *                     or from the loaded symbols.
 *
 *                     If (arg == 0) then showsyms are taken from
 *                     defsyms, def_oc_syms, and def_monsyms.
 *
 *                     If (arg != 0), which is the normal expected
 *                     usage, then showsyms are taken from the
 *                     adjustable display symbols found in gp.primary_syms.
 *                     gp.primary_syms may have been loaded from an external
 *                     symbol file by config file options or interactively
 *                     in the Options menu.
 *
 * assign_graphics(arg)
 *
 *                     This is used in the game core to toggle in and
 *                     out of other {rogue} level display modes.
 *
 *                     If arg is ROGUESET, this places the rogue level
 *                     symbols from gr.rogue_syms into gs.showsyms.
 *
 *                     If arg is PRIMARYSET, this places the symbols
 *                     from gp.primary_syms into gs.showsyms.
 *
 * update_primary_symset()
 *                     Update a member of the primary(primary_*) symbol set.
 *
 * update_rogue_symset()
 *                     Update a member of the rogue (rogue_*) symbol set.
 *
 * update_ov_primary_symset()
 *                     Update a member of the overrides for primary symbol set.
 *
 * update_ov_rogue_symset()
 *                     Update a member of the overrides for rogue symbol set.
 *
 */

export function init_symbols() { /* void */
    init_ov_primary_symbols();
    init_ov_rogue_symbols();
    init_primary_symbols();
    init_showsyms();
    init_rogue_symbols();
}

export function init_showsyms() { /* void */
    let i;

    for (i = 0; i < MAXPCHARS; i++)
        uchars[gs.showsyms + (i + SYM_OFF_P)] = defsyms[i].sym;
    for (i = 0; i < MAXOCLASSES; i++)
        uchars[gs.showsyms + (i + SYM_OFF_O)] = uchar(def_oc_syms[i].sym);
    for (i = 0; i < MAXMCLASSES; i++)
        uchars[gs.showsyms + (i + SYM_OFF_M)] = uchar(def_monsyms[i].sym);
    for (i = 0; i < WARNCOUNT; i++)
        uchars[gs.showsyms + (i + SYM_OFF_W)] = def_warnsyms[i].sym;
    for (i = 0; i < MAXOTHER; i++)
        uchars[gs.showsyms + (i + SYM_OFF_X)] = get_othersym(i, PRIMARYSET);
}

/* initialize defaults for the overrides to the rogue symset */
export function init_ov_rogue_symbols() { /* void */
    let i;

    for (i = 0; i < SYM_MAX; i++)
        uchars[go.ov_rogue_syms + i] = 0;
}
/* initialize defaults for the overrides to the primary symset */
export function init_ov_primary_symbols() { /* void */
    let i;

    for (i = 0; i < SYM_MAX; i++)
        uchars[go.ov_primary_syms + i] = 0;
}

export function get_othersym(idx, which_set) { /* nhsym */
    let sym = 0;
    let oidx = idx + SYM_OFF_X;

    if (which_set == ROGUESET)
        sym = uchars[go.ov_rogue_syms + oidx] ? uchars[go.ov_rogue_syms + oidx]
                                    : uchars[gr.rogue_syms + oidx];
    else
        sym = uchars[go.ov_primary_syms + oidx] ? uchars[go.ov_primary_syms + oidx]
                                      : uchars[gp.primary_syms + oidx];
    if (!sym) {
        switch(idx) {
            case SYM_NOTHING:
            case SYM_UNEXPLORED:
                sym = DEF_NOTHING;
                break;
            case SYM_BOULDER:
                sym = uchar(def_oc_syms[ROCK_CLASS].sym);
                break;
            case SYM_INVISIBLE:
                sym = DEF_INVISIBLE;
                break;
        }
    }
    return sym;
}

/* initialize defaults for the primary symset */
export function init_primary_symbols() { /* void */
    let i;

    for (i = 0; i < MAXPCHARS; i++)
        uchars[gp.primary_syms + (i + SYM_OFF_P)] = defsyms[i].sym;
    for (i = 0; i < MAXOCLASSES; i++)
        uchars[gp.primary_syms + (i + SYM_OFF_O)] = uchar(def_oc_syms[i].sym);
    for (i = 0; i < MAXMCLASSES; i++)
        uchars[gp.primary_syms + (i + SYM_OFF_M)] = uchar(def_monsyms[i].sym);
    for (i = 0; i < WARNCOUNT; i++)
        uchars[gp.primary_syms + (i + SYM_OFF_W)] = def_warnsyms[i].sym;
    for (i = 0; i < MAXOTHER; i++)
        uchars[gp.primary_syms + (i + SYM_OFF_X)] = get_othersym(i, PRIMARYSET);

    clear_symsetentry(PRIMARYSET, FALSE);
}

/* initialize defaults for the rogue symset */
export function init_rogue_symbols() { /* void */
    let i;

    /* These are defaults that can get overwritten
       later by the roguesymbols option */

    for (i = 0; i < MAXPCHARS; i++)
        uchars[gr.rogue_syms + (i + SYM_OFF_P)] = defsyms[i].sym;
    uchars[gr.rogue_syms + S_vodoor] = uchars[gr.rogue_syms + S_hodoor]
        = uchars[gr.rogue_syms + S_ndoor] = ord('+');
    uchars[gr.rogue_syms + S_upstair] = uchars[gr.rogue_syms + S_dnstair] = ord('%');

    for (i = 0; i < MAXOCLASSES; i++)
        uchars[gr.rogue_syms + (i + SYM_OFF_O)] = uchars[def_r_oc_syms + i];
    for (i = 0; i < MAXMCLASSES; i++)
        uchars[gr.rogue_syms + (i + SYM_OFF_M)] = uchar(def_monsyms[i].sym);
    for (i = 0; i < WARNCOUNT; i++)
        uchars[gr.rogue_syms + (i + SYM_OFF_W)] = def_warnsyms[i].sym;
    for (i = 0; i < MAXOTHER; i++)
        uchars[gr.rogue_syms + (i + SYM_OFF_X)] = get_othersym(i, ROGUESET);

    clear_symsetentry(ROGUESET, FALSE);
    /* default on Rogue level is no color
     * but some symbol sets can override that
     */
    gs.symset[ROGUESET].nocolor = 1;
}

export function assign_graphics(whichset) { /* void */
    let i;

    switch (whichset) {
    case ROGUESET:
        /* Adjust graphics display characters on Rogue levels */

        for (i = 0; i < SYM_MAX; i++)
            uchars[gs.showsyms + i] = uchars[go.ov_rogue_syms + i] ? uchars[go.ov_rogue_syms + i]
                                           : uchars[gr.rogue_syms + i];

        gc.currentgraphics = ROGUESET;
        break;

    case PRIMARYSET:
    default:
        for (i = 0; i < SYM_MAX; i++)
            uchars[gs.showsyms + i] = uchars[go.ov_primary_syms + i] ? uchars[go.ov_primary_syms + i]
                                             : uchars[gp.primary_syms + i];

        gc.currentgraphics = PRIMARYSET;
        break;
    }
    reset_glyphmap(gm_symchange);
}

export function switch_symbols(nondefault) { /* void */
    let i;

    if (nondefault) {
        for (i = 0; i < SYM_MAX; i++)
            uchars[gs.showsyms + i] = uchars[go.ov_primary_syms + i] ? uchars[go.ov_primary_syms + i]
                                                 : uchars[gp.primary_syms + i];

        /* curses doesn't assign any routine to dec..._callback but
           probably does the expected initialization under the hood
           for terminals capable of rendering DECgraphics */
        if (SYMHANDLING(H_DEC) && decgraphics_mode_callback)
            decgraphics_mode_callback();

        if (SYMHANDLING(H_UTF8) && utf8graphics_mode_callback)
            utf8graphics_mode_callback();
    } else {
        init_primary_symbols();
        init_showsyms();
    }
}

export function update_ov_primary_symset(symp, val) { /* void */
    uchars[go.ov_primary_syms + symp.idx] = uchar(val);
}

export function update_ov_rogue_symset(symp, val) { /* void */
    uchars[go.ov_rogue_syms + symp.idx] = uchar(val);
}

export function update_primary_symset(symp, val) { /* void */
    uchars[gp.primary_syms + symp.idx] = uchar(val);
}

export function update_rogue_symset(symp, val) { /* void */
    uchars[gr.rogue_syms + symp.idx] = uchar(val);
}

export function clear_symsetentry(which_set, name_too) { /* void */
    let other_set = (which_set == PRIMARYSET) ? ROGUESET : PRIMARYSET;
    let old_handling = gs.symset[which_set].handling;

    if (gs.symset[which_set].desc)
        free((gs.symset[which_set].desc));
    gs.symset[which_set].desc = 0;

    gs.symset[which_set].handling = H_UNK;
    gs.symset[which_set].nocolor = 0;
    /* initialize restriction bits */
    gs.symset[which_set].primary = 0;
    gs.symset[which_set].rogue = 0;

    if (name_too) {
        if (gs.symset[which_set].name)
            free((gs.symset[which_set].name));
        gs.symset[which_set].name = 0;
    }

    /* if 'which_set' was using UTF8, it isn't anymore; if the other set
       isn't using UTF8, discard the data for that */
    if (old_handling == H_UTF8 && gs.symset[other_set].handling != H_UTF8)
        free_all_glyphmap_u();

    purge_custom_entries(unsigned(which_set));
    clear_all_glyphmap_colors();
}

/* called from windmain.c */
export function symset_is_compatible(
    handling,
    wincap2) { /* boolean */
    if (handling == H_UTF8 && ((wincap2 & WC2_utf8_bits) != WC2_utf8_bits))
        return FALSE;

    return TRUE;
}
export const WC2_utf8_bits = WC2_U_UTF8STR;

/*
 * If you are adding code somewhere to be able to recognize
 * particular types of symset "handling", define a
 * H_XXX macro in include/sym.h and add the name
 * to this array at the matching offset.
 * Externally referenced from files.c, options.c, utf8map.c.
 */
export const known_handling = static_array("known_handling", ptr_to(char), null, [
    _("UNKNOWN"), /* H_UNK  */
    _("IBM"),     /* H_IBM  */
    _("DEC"),     /* H_DEC  */
    _("CURS"),    /* H_CURS */
    _("MAC"),     /* H_MAC  -- pre-OSX MACgraphics */
    _("UTF8"),    /* H_UTF8 */
    0,
]);

/*
 * Accepted keywords for symset restrictions.
 * These can be virtually anything that you want to
 * be able to test in the code someplace.
 * Be sure to:
 *    - add a corresponding Bitfield to the symsetentry struct in sym.h
 *    - initialize the field to zero in parse_sym_line in the SYM_CONTROL
 *      case 0 section of the idx switch. The location is prefaced with
 *      with a comment stating "initialize restriction bits".
 *    - set the value appropriately based on the index of your keyword
 *      under the case 5 sections of the same SYM_CONTROL idx switches.
 *    - add the field to clear_symsetentry()
 */
export const known_restrictions = static_array("known_restrictions", ptr_to(char), null, [
    _("primary"), _("rogue"), 0,
]);

export const loadsyms = static_array("loadsyms", struct_symparse, null, [
    { range: SYM_CONTROL, idx: 0, name: _("start") },
    { range: SYM_CONTROL, idx: 0, name: _("begin") },
    { range: SYM_CONTROL, idx: 1, name: _("finish") },
    { range: SYM_CONTROL, idx: 2, name: _("handling") },
    { range: SYM_CONTROL, idx: 3, name: _("description") },
    { range: SYM_CONTROL, idx: 4, name: _("color") },
    { range: SYM_CONTROL, idx: 4, name: _("colour") },
    { range: SYM_CONTROL, idx: 5, name: _("restrictions") },

...loadsyms_records(),

    { range: SYM_OTH, idx: SYM_NOTHING + SYM_OFF_X, name: _("S_nothing") },
    { range: SYM_OTH, idx: SYM_UNEXPLORED + SYM_OFF_X, name: _("S_unexplored") },
    { range: SYM_OTH, idx: SYM_BOULDER + SYM_OFF_X, name: _("S_boulder") },
    { range: SYM_OTH, idx: SYM_INVISIBLE + SYM_OFF_X, name: _("S_invisible") },
    { range: SYM_OTH, idx: SYM_PET_OVERRIDE + SYM_OFF_X, name: _("S_pet_override") },
    { range: SYM_OTH, idx: SYM_HERO_OVERRIDE + SYM_OFF_X, name: _("S_hero_override") },
    { range: SYM_INVALID, idx: 0, name: 0 } /* fence post */
]);

export function proc_symset_line(buf) { /* boolean */
    return +!boolean(parse_sym_line(buf, gs.symset_which_set));
}

/* returns 0 on error */
export function parse_sym_line(buf, which_set) { /* int */
    const $frame = stack_frame(); try {
    let val, i;
    let symp = null;
    let bufp, commentp, altp;
    let glyph = stack_var(int, NO_GLYPH);
    let enhanced_unavailable = FALSE, is_glyph = FALSE;

    if (strlen(buf) >= BUFSZ)
        chars[buf + (BUFSZ - 1)] = ord('\0');
    /* convert each instance of whitespace (tabs, consecutive spaces)
       into a single space; leading and trailing spaces are stripped */
    mungspaces(buf);

    /* remove trailing comment, if any (this isn't strictly needed for
       individual symbols, and it won't matter if "X#comment" without
       separating space slips through; for handling or set description,
       symbol set creator is responsible for preceding '#' with a space
       and that comment itself doesn't contain " #") */
    if ((commentp = strrchr(buf, ord('#'))) != 0 && chars[commentp + (-1)] == ord(' '))
        chars[commentp + (-1)] = ord('\0');

    /* find the '=' or ':' */
    bufp = strchr(buf, ord('='));
    altp = strchr(buf, ord(':'));

    if (!bufp || (altp && altp < bufp))
        bufp = altp;

    if (!bufp) {
        if (strncmpi(buf, _("finish"), 6) == 0) {
            /* end current graphics set */
            if (gc.chosen_symset_start)
                gc.chosen_symset_end = TRUE;
            gc.chosen_symset_start = FALSE;
            return 1;
        }
        config_error_add(_("No \"finish\""));
        return 0;
    }
    /* skip '=' and space which follows, if any */
    ++bufp;
    if (chars[bufp] == ord(' '))
        ++bufp;

    symp = match_sym(buf);
    if (!symp && chars[buf + 0] == ord('G') && chars[buf + 1] == ord('_')) {
        if (gc.chosen_symset_start) {
            is_glyph = match_glyph(buf);
        } else {
            is_glyph = TRUE; /* report error only once */
        }

        enhanced_unavailable = FALSE;
    }
    if (!symp && !is_glyph && !enhanced_unavailable) {
        config_error_add(_("Unknown sym keyword"));
        return 0;
    }
    if (symp) {
        if (!gs.symset[which_set].name) {
            /* A null symset name indicates that we're just
               building a pick-list of possible symset
               values from the file, so only do that */
            if (symp.range == SYM_CONTROL) {
                let tmpsp, lastsp;

                for (lastsp = gs.symset_list; lastsp; lastsp = lastsp.next)
                    if (!lastsp.next)
                        break;
                switch (symp.idx) {
                case 0:
                    tmpsp = view_of(struct_symsetentry, addr_of(alloc(sizeof(struct_symsetentry))));
                    tmpsp.next = null;
                    if (!lastsp)
                        gs.symset_list = tmpsp;
                    else
                        lastsp.next = tmpsp;
                    tmpsp.idx = gs.symset_count++;
                    tmpsp.name = dupstr(bufp);
                    tmpsp.desc = 0;
                    tmpsp.handling = H_UNK;
                    /* initialize restriction bits */
                    tmpsp.nocolor = 0;
                    tmpsp.primary = 0;
                    tmpsp.rogue = 0;
                    break;
                case 2:
                    /* handler type identified */
                    tmpsp = lastsp; /* most recent symset */
                    for (i = 0; known_handling[i]; ++i)
                        if (!strcmpi(known_handling[i], bufp)) {
                            if (tmpsp)
                                tmpsp.handling = unsigned(i);
                            break; /* for loop */
                        }
                    break;
                case 3:
                    /* description:something */
                    tmpsp = lastsp; /* most recent symset */
                    if (tmpsp && !tmpsp.desc)
                        tmpsp.desc = dupstr(bufp);
                    break;
                case 5:
                    /* restrictions: xxxx*/
                    tmpsp = lastsp; /* most recent symset */
                    for (i = 0; known_restrictions[i]; ++i) {
                        if (!strcmpi(known_restrictions[i], bufp)) {
                            if (tmpsp) {
                                switch (i) {
                                case 0:
                                    tmpsp.primary = 1;
                                    break;
                                case 1:
                                    tmpsp.rogue = 1;
                                    break;
                                }
                            }
                            break; /* while loop */
                        }
                    }
                    break;
                }
            }
            return 1;
        }
        if (symp.range && symp.range == SYM_CONTROL) {
            switch (symp.idx) {
            case 0:
                /* start of symset */
                if (!strcmpi(bufp, gs.symset[which_set].name)) {
                    /* matches desired one */
                    gc.chosen_symset_start = TRUE;
                    /* these init_*() functions clear symset fields too */
                    if (which_set == ROGUESET)
                        init_rogue_symbols();
                    else if (which_set == PRIMARYSET)
                        init_primary_symbols();
                }
                break;
            case 1:
                /* finish symset */
                if (gc.chosen_symset_start)
                    gc.chosen_symset_end = TRUE;
                gc.chosen_symset_start = FALSE;
                break;
            case 2:
                /* handler type identified */
                if (gc.chosen_symset_start)
                    set_symhandling(bufp, which_set);
                break;
            /* case 3: (description) is ignored here */
            case 4: /* color:off */
                if (gc.chosen_symset_start) {
                    if (bufp) {
                        if (!strncmpi((bufp), _(("true")), -1) || !strncmpi((bufp), _(("yes")), -1)
                            || !strncmpi((bufp), _(("on")), -1))
                            gs.symset[which_set].nocolor = 0;
                        else if (!strncmpi((bufp), _(("false")), -1)
                                 || !strncmpi((bufp), _(("no")), -1)
                                 || !strncmpi((bufp), _(("off")), -1))
                            gs.symset[which_set].nocolor = 1;
                    }
                }
                break;
            case 5: /* restrictions: xxxx*/
                if (gc.chosen_symset_start) {
                    let n = 0;

                    while (known_restrictions[n]) {
                        if (!strcmpi(known_restrictions[n], bufp)) {
                            switch (n) {
                            case 0:
                                gs.symset[which_set].primary = 1;
                                break;
                            case 1:
                                gs.symset[which_set].rogue = 1;
                                break;
                            }
                            break; /* while loop */
                        }
                        n++;
                    }
                }
                break;
            }
        } else {
            /* Not SYM_CONTROL */
            if (gs.symset[which_set].handling != H_UTF8) {
                if (gc.chosen_symset_start) {
                    val = sym_val(bufp);
                    if (which_set == PRIMARYSET) {
                        update_primary_symset(symp, val);
                    } else if (which_set == ROGUESET) {
                        update_rogue_symset(symp, val);
                    }
                }
            } else {
                if (gc.chosen_symset_start) {
                    glyphrep_to_custom_map_entries(buf, glyph);
                }
            }
        }
    } else if (gc.chosen_symset_start) {
        /* glyph, not symbol */
        glyphrep_to_custom_map_entries(buf, glyph);
    }

    return 1;
    } finally { stack_pop($frame); }
}

export function set_symhandling(handling, which_set) { /* void */
    let i = 0;

    gs.symset[which_set].handling = H_UNK;
    while (known_handling[i]) {
        if (!strcmpi(known_handling[i], handling)) {
            gs.symset[which_set].handling = unsigned(i);
            return;
        }
        i++;
    }
}

/* bundle some common usage into one easy-to-use routine */
export function load_symset(s, which_set) { /* int */
    clear_symsetentry(which_set, TRUE);

    if (gs.symset[which_set].name)
        free((gs.symset[which_set].name));
    gs.symset[which_set].name = dupstr(s);

    if (read_sym_file(which_set)) {
        switch_symbols(TRUE);
        apply_customizations(unsigned(gc.currentgraphics),
                             do_custom_symbols | do_custom_colors);
    } else {
        clear_symsetentry(which_set, TRUE);
        return 0;
    }
    return 1;
}

export function free_symsets() { /* void */
    clear_symsetentry(PRIMARYSET, TRUE);
    clear_symsetentry(ROGUESET, TRUE);

    /* symset_list is cleaned up as soon as it's used, so we shouldn't
       have to anything about it here */
    /* assert( symset_list == NULL ); */
}

const struct__savedsym = struct("struct__savedsym", {
    name: ptr_to(char),
    val: ptr_to(char),
    which_set: int,
    next: ptr_to("struct__savedsym"),
});
global_scalar("saved_symbols", ptr_to(struct__savedsym), null);

export function savedsym_free() { /* void */
    let tmp = saved_symbols, tmp2;

    while (tmp) {
        tmp2 = tmp.next;
        free(tmp.name);
        free(tmp.val);
        free(addr_of(tmp));
        tmp = tmp2;
    }
}

function savedsym_find(name, which_set) { /* struct _savedsym * */
    let tmp = saved_symbols;

    while (tmp) {
        if (which_set == tmp.which_set && !strcmp(name, tmp.name))
            return tmp;
        tmp = tmp.next;
    }
    return null;
}

function savedsym_add(name, val, which_set) { /* void */
    let tmp = null;

    if ((tmp = savedsym_find(name, which_set)) != null) {
        free(tmp.val);
        tmp.val = dupstr(val);
    } else {
        tmp = view_of(struct__savedsym, addr_of(alloc(sizeof(struct__savedsym))));
        tmp.name = dupstr(name);
        tmp.val = dupstr(val);
        tmp.which_set = which_set;
        tmp.next = saved_symbols;
        saved_symbols = tmp;
    }
}

export function savedsym_strbuf(sbuf) { /* void */
    const $frame = stack_frame(); try {
    let tmp = saved_symbols;
    let buf = stack_array(char, BUFSZ);

    while (tmp) {
        sprintf(buf, _("%sSYMBOLS=%s:%s\n"), (tmp.which_set == ROGUESET) ? _("ROGUE") : _(""), tmp.name, tmp.val)

;
        strbuf_append(sbuf, buf);
        tmp = tmp.next;
    }
    } finally { stack_pop($frame); }
}

/* Parse the value of a SYMBOLS line from a config file */
export function parsesymbols(opts, which_set) { /* boolean */
    const $frame = stack_frame(); try {
    let val;
    let symname, strval, ch,
         first_unquoted_comma = 0, first_unquoted_colon = 0;
    let symp;
    let is_glyph = FALSE;

    /* are there any commas or colons that aren't quoted? */
    for (ch = opts + 1; chars[ch]; ++ch) {
        let prech, postch;

        prech = ch - 1;
        postch = ch + 1;
        if (!chars[postch])
            break;
        if (chars[ch] == ord(',')) {
            if (chars[prech] == ord('\'') && chars[postch] == ord('\''))
                continue;
            if (chars[prech] == ord('\\'))
                continue;
        }
        if (chars[ch] == ord(':')) {
            if (chars[prech] == ord('\'') && chars[postch] == ord('\''))
                continue;
        }
        if (chars[ch] == ord(',') && !first_unquoted_comma)
            first_unquoted_comma = ch;
        if (chars[ch] == ord(':') && !first_unquoted_colon)
            first_unquoted_colon = ch;
    }
    if (first_unquoted_comma != 0) {
        chars[first_unquoted_comma++] = ord('\0');
        if (!parsesymbols(first_unquoted_comma, which_set))
            return FALSE;
    }

    /* S_sample:string */
    symname = opts;
    strval = first_unquoted_colon;
    if (!strval)
        strval = strchr(opts, ord('='));
    if (!strval)
        return FALSE;
    chars[strval++] = ord('\0');

    /* strip leading and trailing white space from symname and strval */
    mungspaces(symname);
    mungspaces(strval);

    symp = match_sym(symname);
    if (!symp && chars[symname + 0] == ord('G') && chars[symname + 1] == ord('_')) {
        is_glyph = match_glyph(symname);
    }
    if (!symp && !is_glyph)
        return FALSE;
    if (symp) {
        if (symp.range && symp.range != SYM_CONTROL) {
            if (gs.symset[which_set].handling == H_UTF8
                || (lowc(chars[strval + 0]) == ord('u') && chars[strval + 1] == ord('+'))) {
                let buf = stack_array(char, BUFSZ);
                let glyph = stack_var(int);

                Snprintf(buf, sizeof(array_of(char, BUFSZ)), _("%s:%s"), opts, strval);
                glyphrep_to_custom_map_entries(buf, glyph);
            } else {
                    val = sym_val(strval);
                    if (which_set == ROGUESET)
                        update_ov_rogue_symset(symp, val);
                    else
                        update_ov_primary_symset(symp, val);
            }
        }
    }
    savedsym_add(opts, strval, which_set);
    return TRUE;
    } finally { stack_pop($frame); }
}

export function match_sym(buf) { /* const struct symparse * */
    const struct_alternate_parse = struct("match_sym.struct_alternate_parse", {
        altnm: ptr_to(char),
        nm: ptr_to(char),
    }); let alternates = static_array("match_sym.alternates", struct_alternate_parse, null, [
        { altnm: _("S_armour"), nm: _("S_armor") },
        /* alt explosion names are numbered in phone key/button layout */
        { altnm: _("S_explode1"), nm: _("S_expl_tl") },
        { altnm: _("S_explode2"), nm: _("S_expl_tc") }, { altnm: _("S_explode3"), nm: _("S_expl_tr") },
        { altnm: _("S_explode4"), nm: _("S_expl_ml") }, { altnm: _("S_explode5"), nm: _("S_expl_mc") },
        { altnm: _("S_explode6"), nm: _("S_expl_mr") }, { altnm: _("S_explode7"), nm: _("S_expl_bl") },
        { altnm: _("S_explode8"), nm: _("S_expl_bc") }, { altnm: _("S_explode9"), nm: _("S_expl_br") },
    ]);
    let i;
    let len = strlen(buf);
    let p = strchr(buf, ord(':')), q = strchr(buf, ord('='));
    let sp = loadsyms[0];

    /* G_ lines will never match here */
    if ((chars[buf + 0] == ord('G') || chars[buf + 0] == ord('g')) && chars[buf + 1] == ord('_'))
        return null;

    if (!p || (q && q < p))
        p = q;
    if (p) {
        /* note: there will be at most one space before the '='
           because caller has condensed buf[] with mungspaces() */
        if (p > buf && chars[p + (-1)] == ord(' '))
            p--;
        len = unsigned((p - buf));
    }
    while (sp.range) {
        if ((len >= strlen(sp.name)) && !strncmpi(buf, sp.name, int(len)))
            return sp;
        sp = ptr_add(sp, 1);
    }
    for (i = 0; i < SIZE(alternates); ++i) {
        if ((len >= strlen(alternates[i].altnm))
            && !strncmpi(buf, alternates[i].altnm, int(len))) {
            sp = loadsyms[0];
            while (sp.range) {
                if (!strcmp(alternates[i].nm, sp.name))
                    return sp;
                sp = ptr_add(sp, 1);
            }
        }
    }
    return null;
}

/*
 * this is called from options.c to do the symset work.
 */
export function do_symset(rogueflag) { /* int */
    const $frame = stack_frame(); try {
    let tmpwin;
    let any = stack_struct(struct_any);
    let n;
    let buf = stack_array(char, BUFSZ);
    let symset_pick = stack_var(ptr_to(struct_mi), null);
    let ready_to_switch = FALSE,
            nothing_to_do = FALSE;
    let symset_name, fmtstr = stack_array(char, 20);
    let sl;
    let res, which_set, setcount = 0, chosen = -2, defindx = 0;
    let clr = NO_COLOR;

    which_set = rogueflag ? ROGUESET : PRIMARYSET;
    gs.symset_list = null;
    /* clear symset[].name as a flag to read_sym_file() to build list */
    symset_name = gs.symset[which_set].name;
    gs.symset[which_set].name = 0;

    res = read_sym_file(which_set);
    /* put symset name back */
    gs.symset[which_set].name = symset_name;

    if (res && gs.symset_list) {
        let thissize,
            biggest = (sizeof_string("Default Symbols") - sizeof_string("")),
            big_desc = 0;

        for (sl = gs.symset_list; sl; sl = sl.next) {
            /* check restrictions */
            if (rogueflag ? sl.primary : sl.rogue)
                continue;

            if (sl.handling == H_MAC)
                continue;

            setcount++;
            /* find biggest name */
            thissize = sl.name ? int(strlen(sl.name)) : 0;
            if (thissize > biggest)
                biggest = thissize;
            thissize = sl.desc ? int(strlen(sl.desc)) : 0;
            if (thissize > big_desc)
                big_desc = thissize;
        }
        if (!setcount) {
            There(_("are no appropriate %s symbol sets available."),
                  rogueflag ? _("rogue level") : _("primary"));
            return TRUE;
        }

        sprintf(fmtstr, _("%%-%ds %%s"), biggest + 2);
        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
        struct_assign(any, cg.zeroany);
        any.a_int = 1; /* -1 + 2 [see 'if (sl->name) {' below]*/
        if (!symset_name)
            defindx = any.a_int;
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE,
                 clr, _("Default Symbols"),
                 (any.a_int == defindx) ? MENU_ITEMFLAGS_SELECTED
                                        : MENU_ITEMFLAGS_NONE);

        for (sl = gs.symset_list; sl; sl = sl.next) {
            /* check restrictions */
            if (rogueflag ? sl.primary : sl.rogue)
                continue;

            if (sl.handling == H_MAC)
                continue;

            if (sl.name) {
                /* +2: sl->idx runs from 0 to N-1 for N symsets;
                   +1 because Defaults are implicitly in slot [0];
                   +1 again so that valid data is never 0 */
                any.a_int = sl.idx + 2;
                if (symset_name && !strcmpi(sl.name, symset_name))
                    defindx = any.a_int;
                sprintf(buf, fmtstr, sl.name, sl.desc ? sl.desc : _(""));
                add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                         ATR_NONE, clr, buf,
                         (any.a_int == defindx) ? MENU_ITEMFLAGS_SELECTED
                                                : MENU_ITEMFLAGS_NONE);
            }
        }
        sprintf(buf, _("Select %ssymbol set:"), rogueflag ? _("rogue level ") : _(""))
;
        end_menu()(tmpwin, buf);
        n = select_menu(tmpwin, PICK_ONE, symset_pick);
        if (n > 0) {
            chosen = ptr_add(symset_pick[0], 0).item.a_int;
            /* if picking non-preselected entry yields 2, make sure
               that we're going with the non-preselected one */
            if (n == 2 && chosen == defindx)
                chosen = ptr_add(symset_pick[0], 1).item.a_int;
            chosen -= 2; /* convert menu index to symset index;
                          * "Default symbols" have index -1 */
            free(addr_of(symset_pick[0]));
        } else if (n == 0 && defindx > 0) {
            chosen = defindx - 2;
        }
        destroy_nhwindow()(tmpwin);

        if (chosen > -1) {
            /* chose an actual symset name from file */
            for (sl = gs.symset_list; sl; sl = sl.next)
                if (sl.idx == chosen)
                    break;
            if (sl) {
                /* free the now stale attributes */
                clear_symsetentry(which_set, TRUE);

                /* transfer only the name of the symbol set */
                gs.symset[which_set].name = dupstr(sl.name);
                ready_to_switch = TRUE;
            }
        } else if (chosen == -1) {
            /* explicit selection of defaults */
            /* free the now stale symset attributes */
            clear_symsetentry(which_set, TRUE);
        } else
            nothing_to_do = TRUE;
    } else if (!res) {
        /* The symbols file could not be accessed */
        pline(_("Unable to access \"%s\" file."), _(SYMBOLS));
        return TRUE;
    } else if (!gs.symset_list) {
        /* The symbols file was empty */
        There(_("were no symbol sets found in \"%s\"."), _(SYMBOLS));
        return TRUE;
    }

    /* clean up */
    while ((sl = gs.symset_list) != null) {
        gs.symset_list = sl.next;
        if (sl.name)
            free(sl.name), sl.name = 0;
        if (sl.desc)
            free(sl.desc), sl.desc = 0;
        free(addr_of(sl));
    }

    if (nothing_to_do)
        return TRUE;

    /* Set default symbols and clear the handling value */
    if (rogueflag)
        init_rogue_symbols();
    else
        init_primary_symbols();

    if (gs.symset[which_set].name) {
        /* non-default symbols */
        let ok;
        if (!glyphid_cache_status()) {
            fill_glyphid_cache();
        }
        ok = read_sym_file(which_set);
        if (glyphid_cache_status()) {
            free_glyphid_cache();
        }
        if (ok) {
            ready_to_switch = TRUE;
        } else {
            clear_symsetentry(which_set, TRUE);
            return TRUE;
        }
    }

    if (ready_to_switch)
        switch_symbols(TRUE);

    if (Is_rogue_level(u.uz)) {
        if (rogueflag)
            assign_graphics(ROGUESET);
    } else if (!rogueflag)
        assign_graphics(PRIMARYSET);
    apply_customizations(rogueflag ? ROGUESET : PRIMARYSET,
                         (do_custom_symbols | do_custom_colors));
    preference_update()(_("symset"));
    return TRUE;
    } finally { stack_pop($frame); }
}

/*symbols.c*/

import { NO_COLOR } from "./color.h.js";
import {
    DEF_INVISIBLE, MAXMCLASSES, MAXOCLASSES, MAXPCHARS, ROCK_CLASS, S_ANGEL, S_ANT, S_BAT, S_BLOB,
    S_CENTAUR, S_COCKATRICE, S_DEMON, S_DOG, S_DRAGON, S_EEL, S_ELEMENTAL, S_EYE, S_FELINE,
    S_FUNGUS, S_GHOST, S_GIANT, S_GNOME, S_GOLEM, S_GREMLIN, S_HUMAN, S_HUMANOID, S_IMP,
    S_JABBERWOCK, S_JELLY, S_KOBOLD, S_KOP, S_LEPRECHAUN, S_LICH, S_LIGHT, S_LIZARD, S_MIMIC,
    S_MIMIC_DEF, S_MUMMY, S_NAGA, S_NYMPH, S_OGRE, S_ORC, S_PIERCER, S_PUDDING, S_QUADRUPED,
    S_QUANTMECH, S_RODENT, S_RUSTMONST, S_SNAKE, S_SPIDER, S_TRAPPER, S_TROLL, S_UMBER, S_UNICORN,
    S_VAMPIRE, S_VORTEX, S_WORM, S_WORM_TAIL, S_WRAITH, S_XAN, S_XORN, S_YETI, S_ZOMBIE, S_ZRUTY,
    S_air, S_altar, S_amulet, S_anti_magic_trap, S_armor, S_arrow_trap, S_ball, S_bars, S_bear_trap,
    S_blcorn, S_book, S_boomleft, S_boomright, S_brcorn, S_brdnladder, S_brdnstair, S_brupladder,
    S_brupstair, S_chain, S_cloud, S_coin, S_corr, S_crwall, S_darkroom, S_dart_trap, S_digbeam,
    S_dnladder, S_dnstair, S_engrcorr, S_engroom, S_expl_bc, S_expl_bl, S_expl_br, S_expl_mc,
    S_expl_ml, S_expl_mr, S_expl_tc, S_expl_tl, S_expl_tr, S_falling_rock_trap, S_fire_trap,
    S_flashbeam, S_food, S_fountain, S_gem, S_goodpos, S_grave, S_hbeam, S_hcdbridge, S_hcdoor,
    S_hodbridge, S_hodoor, S_hole, S_hwall, S_ice, S_invisible, S_land_mine, S_lava, S_lavawall,
    S_level_teleporter, S_litcorr, S_lslant, S_magic_portal, S_magic_trap, S_ndoor, S_pit,
    S_poisoncloud, S_polymorph_trap, S_pool, S_potion, S_ring, S_rock, S_rolling_boulder_trap,
    S_room, S_rslant, S_rust_trap, S_scroll, S_sink, S_sleeping_gas_trap, S_spiked_pit,
    S_squeaky_board, S_ss1, S_ss2, S_ss3, S_ss4, S_statue_trap, S_stone, S_strange_obj, S_sw_bc,
    S_sw_bl, S_sw_br, S_sw_ml, S_sw_mr, S_sw_tc, S_sw_tl, S_sw_tr, S_tdwall, S_teleportation_trap,
    S_throne, S_tlcorn, S_tlwall, S_tool, S_trap_door, S_trapped_chest, S_trapped_door, S_trcorn,
    S_tree, S_trwall, S_tuwall, S_upladder, S_upstair, S_vbeam, S_vcdbridge, S_vcdoor, S_venom,
    S_vibrating_square, S_vodbridge, S_vodoor, S_vwall, S_wand, S_water, S_weapon, S_web,
} from "./defsym.h.js";
import { NO_GLYPH, gm_symchange } from "./display.h.js";
import { Is_rogue_level } from "./dungeon.h.macros.js";
import { BUFSZ, FALSE, SYMBOLS, TRUE, boolean } from "./global.h.js";
import { strcmpi } from "./global.h.macros.js";
import {
    DEF_NOTHING, SYM_MAX, SYM_OFF_M, SYM_OFF_O, SYM_OFF_P, SYM_OFF_W, SYM_OFF_X,
} from "./hack.h.js";
import { Snprintf } from "./hacklib.h.macros.js";
import {
    H_DEC, H_MAC, H_UNK, H_UTF8, MAXOTHER, PRIMARYSET, ROGUESET, SYM_BOULDER, SYM_CONTROL,
    SYM_HERO_OVERRIDE, SYM_INVALID, SYM_INVISIBLE, SYM_MON, SYM_NOTHING, SYM_OC, SYM_OTH, SYM_PCHAR,
    SYM_PET_OVERRIDE, SYM_UNEXPLORED, WARNCOUNT, do_custom_colors, do_custom_symbols,
    struct_symparse, struct_symsetentry,
} from "./sym.h.js";
import { SYMHANDLING } from "./sym.h.macros.js";
import { WC2_U_UTF8STR } from "./winprocs.h.js";
import {
    create_nhwindow, destroy_nhwindow, end_menu, preference_update, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, MENU_ITEMFLAGS_SELECTED, NHW_MENU,
    PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, sizeof_string, uchar, unsigned } from "../rt/ctypes.js";
import { global_scalar } from "../rt/globals.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { free, sprintf, strchr, strcmp, strlen, strrchr } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array } from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, fnptr_t, ptr_add, ptr_to, struct, struct_assign, view_of,
} from "../rt/struct.js";
import { alloc, dupstr } from "./alloc.js";
import { config_error_add } from "./cfgfiles.js";
import { cg, gc, go, gp, gr, gs, u } from "./decl.js";
import { nul_glyphinfo, reset_glyphmap } from "./display.js";
import { def_monsyms, def_oc_syms, def_r_oc_syms, def_warnsyms, defsyms } from "./drawing.js";
import { read_sym_file } from "./files.js";
import {
    apply_customizations, clear_all_glyphmap_colors, fill_glyphid_cache, free_glyphid_cache,
    glyphid_cache_status, glyphrep_to_custom_map_entries, match_glyph, purge_custom_entries,
} from "./glyphs.js";
import { lowc, mungspaces, strncmpi } from "./hacklib.js";
import { sym_val } from "./options.js";
import { There, pline } from "./pline.js";
import { strbuf_append } from "./strutil.js";
import { free_all_glyphmap_u } from "./utf8map.js";
import { add_menu, select_menu } from "./windows.js";

// the records of loadsyms[] from defsym.h, laid out like it
function loadsyms_records() {
    return [
    { range: SYM_PCHAR, idx: S_stone, name: _("S_stone") },
    { range: SYM_PCHAR, idx: S_vwall, name: _("S_vwall") },
    { range: SYM_PCHAR, idx: S_hwall, name: _("S_hwall") },
    { range: SYM_PCHAR, idx: S_tlcorn, name: _("S_tlcorn") },
    { range: SYM_PCHAR, idx: S_trcorn, name: _("S_trcorn") },
    { range: SYM_PCHAR, idx: S_blcorn, name: _("S_blcorn") },
    { range: SYM_PCHAR, idx: S_brcorn, name: _("S_brcorn") },
    { range: SYM_PCHAR, idx: S_crwall, name: _("S_crwall") },
    { range: SYM_PCHAR, idx: S_tuwall, name: _("S_tuwall") },
    { range: SYM_PCHAR, idx: S_tdwall, name: _("S_tdwall") },
    { range: SYM_PCHAR, idx: S_tlwall, name: _("S_tlwall") },
    { range: SYM_PCHAR, idx: S_trwall, name: _("S_trwall") },

    { range: SYM_PCHAR, idx: S_ndoor, name: _("S_ndoor") },
    { range: SYM_PCHAR, idx: S_vodoor, name: _("S_vodoor") },
    { range: SYM_PCHAR, idx: S_hodoor, name: _("S_hodoor") },
    { range: SYM_PCHAR, idx: S_vcdoor, name: _("S_vcdoor") },
    { range: SYM_PCHAR, idx: S_hcdoor, name: _("S_hcdoor") },
    { range: SYM_PCHAR, idx: S_bars, name: _("S_bars") },
    { range: SYM_PCHAR, idx: S_tree, name: _("S_tree") },
    { range: SYM_PCHAR, idx: S_room, name: _("S_room") },
    { range: SYM_PCHAR, idx: S_darkroom, name: _("S_darkroom") },
    { range: SYM_PCHAR, idx: S_engroom, name: _("S_engroom") },
    { range: SYM_PCHAR, idx: S_corr, name: _("S_corr") },
    { range: SYM_PCHAR, idx: S_litcorr, name: _("S_litcorr") },
    { range: SYM_PCHAR, idx: S_engrcorr, name: _("S_engrcorr") },
    { range: SYM_PCHAR, idx: S_upstair, name: _("S_upstair") },
    { range: SYM_PCHAR, idx: S_dnstair, name: _("S_dnstair") },
    { range: SYM_PCHAR, idx: S_upladder, name: _("S_upladder") },
    { range: SYM_PCHAR, idx: S_dnladder, name: _("S_dnladder") },
    { range: SYM_PCHAR, idx: S_brupstair, name: _("S_brupstair") },
    { range: SYM_PCHAR, idx: S_brdnstair, name: _("S_brdnstair") },
    { range: SYM_PCHAR, idx: S_brupladder, name: _("S_brupladder") },
    { range: SYM_PCHAR, idx: S_brdnladder, name: _("S_brdnladder") },

    { range: SYM_PCHAR, idx: S_altar, name: _("S_altar") },

    { range: SYM_PCHAR, idx: S_grave, name: _("S_grave") },
    { range: SYM_PCHAR, idx: S_throne, name: _("S_throne") },
    { range: SYM_PCHAR, idx: S_sink, name: _("S_sink") },
    { range: SYM_PCHAR, idx: S_fountain, name: _("S_fountain") },

    { range: SYM_PCHAR, idx: S_pool, name: _("S_pool") },
    { range: SYM_PCHAR, idx: S_ice, name: _("S_ice") },
    { range: SYM_PCHAR, idx: S_lava, name: _("S_lava") },
    { range: SYM_PCHAR, idx: S_lavawall, name: _("S_lavawall") },
    { range: SYM_PCHAR, idx: S_vodbridge, name: _("S_vodbridge") },
    { range: SYM_PCHAR, idx: S_hodbridge, name: _("S_hodbridge") },
    { range: SYM_PCHAR, idx: S_vcdbridge, name: _("S_vcdbridge") },
    { range: SYM_PCHAR, idx: S_hcdbridge, name: _("S_hcdbridge") },
    { range: SYM_PCHAR, idx: S_air, name: _("S_air") },
    { range: SYM_PCHAR, idx: S_cloud, name: _("S_cloud") },

    { range: SYM_PCHAR, idx: S_water, name: _("S_water") },

    { range: SYM_PCHAR, idx: S_arrow_trap, name: _("S_arrow_trap") },
    { range: SYM_PCHAR, idx: S_dart_trap, name: _("S_dart_trap") },
    { range: SYM_PCHAR, idx: S_falling_rock_trap, name: _("S_falling_rock_trap") },
    { range: SYM_PCHAR, idx: S_squeaky_board, name: _("S_squeaky_board") },
    { range: SYM_PCHAR, idx: S_bear_trap, name: _("S_bear_trap") },
    { range: SYM_PCHAR, idx: S_land_mine, name: _("S_land_mine") },
    { range: SYM_PCHAR, idx: S_rolling_boulder_trap, name: _("S_rolling_boulder_trap") },
    { range: SYM_PCHAR, idx: S_sleeping_gas_trap, name: _("S_sleeping_gas_trap") },
    { range: SYM_PCHAR, idx: S_rust_trap, name: _("S_rust_trap") },
    { range: SYM_PCHAR, idx: S_fire_trap, name: _("S_fire_trap") },
    { range: SYM_PCHAR, idx: S_pit, name: _("S_pit") },
    { range: SYM_PCHAR, idx: S_spiked_pit, name: _("S_spiked_pit") },
    { range: SYM_PCHAR, idx: S_hole, name: _("S_hole") },
    { range: SYM_PCHAR, idx: S_trap_door, name: _("S_trap_door") },
    { range: SYM_PCHAR, idx: S_teleportation_trap, name: _("S_teleportation_trap") },
    { range: SYM_PCHAR, idx: S_level_teleporter, name: _("S_level_teleporter") },
    { range: SYM_PCHAR, idx: S_magic_portal, name: _("S_magic_portal") },
    { range: SYM_PCHAR, idx: S_web, name: _("S_web") },
    { range: SYM_PCHAR, idx: S_statue_trap, name: _("S_statue_trap") },
    { range: SYM_PCHAR, idx: S_magic_trap, name: _("S_magic_trap") },
    { range: SYM_PCHAR, idx: S_anti_magic_trap, name: _("S_anti_magic_trap") },
    { range: SYM_PCHAR, idx: S_polymorph_trap, name: _("S_polymorph_trap") },
    { range: SYM_PCHAR, idx: S_vibrating_square, name: _("S_vibrating_square") },
    { range: SYM_PCHAR, idx: S_trapped_door, name: _("S_trapped_door") },
    { range: SYM_PCHAR, idx: S_trapped_chest, name: _("S_trapped_chest") },

    { range: SYM_PCHAR, idx: S_vbeam, name: _("S_vbeam") },
    { range: SYM_PCHAR, idx: S_hbeam, name: _("S_hbeam") },
    { range: SYM_PCHAR, idx: S_lslant, name: _("S_lslant") },
    { range: SYM_PCHAR, idx: S_rslant, name: _("S_rslant") },

    { range: SYM_PCHAR, idx: S_digbeam, name: _("S_digbeam") },
    { range: SYM_PCHAR, idx: S_flashbeam, name: _("S_flashbeam") },
    { range: SYM_PCHAR, idx: S_boomleft, name: _("S_boomleft") },
    { range: SYM_PCHAR, idx: S_boomright, name: _("S_boomright") },

    { range: SYM_PCHAR, idx: S_ss1, name: _("S_ss1") },
    { range: SYM_PCHAR, idx: S_ss2, name: _("S_ss2") },
    { range: SYM_PCHAR, idx: S_ss3, name: _("S_ss3") },
    { range: SYM_PCHAR, idx: S_ss4, name: _("S_ss4") },
    { range: SYM_PCHAR, idx: S_poisoncloud, name: _("S_poisoncloud") },

    { range: SYM_PCHAR, idx: S_goodpos, name: _("S_goodpos") },

    { range: SYM_PCHAR, idx: S_sw_tl, name: _("S_sw_tl") },
    { range: SYM_PCHAR, idx: S_sw_tc, name: _("S_sw_tc") },
    { range: SYM_PCHAR, idx: S_sw_tr, name: _("S_sw_tr") },
    { range: SYM_PCHAR, idx: S_sw_ml, name: _("S_sw_ml") },
    { range: SYM_PCHAR, idx: S_sw_mr, name: _("S_sw_mr") },
    { range: SYM_PCHAR, idx: S_sw_bl, name: _("S_sw_bl") },
    { range: SYM_PCHAR, idx: S_sw_bc, name: _("S_sw_bc") },
    { range: SYM_PCHAR, idx: S_sw_br, name: _("S_sw_br") },

    { range: SYM_PCHAR, idx: S_expl_tl, name: _("S_expl_tl") },
    { range: SYM_PCHAR, idx: S_expl_tc, name: _("S_expl_tc") },
    { range: SYM_PCHAR, idx: S_expl_tr, name: _("S_expl_tr") },
    { range: SYM_PCHAR, idx: S_expl_ml, name: _("S_expl_ml") },
    { range: SYM_PCHAR, idx: S_expl_mc, name: _("S_expl_mc") },
    { range: SYM_PCHAR, idx: S_expl_mr, name: _("S_expl_mr") },
    { range: SYM_PCHAR, idx: S_expl_bl, name: _("S_expl_bl") },
    { range: SYM_PCHAR, idx: S_expl_bc, name: _("S_expl_bc") },
    { range: SYM_PCHAR, idx: S_expl_br, name: _("S_expl_br") },

    { range: SYM_OC, idx: (S_strange_obj + SYM_OFF_O), name: _("S_strange_obj") },
    { range: SYM_OC, idx: (S_weapon + SYM_OFF_O), name: _("S_weapon") },
    { range: SYM_OC, idx: (S_armor + SYM_OFF_O), name: _("S_armor") },
    { range: SYM_OC, idx: (S_ring + SYM_OFF_O), name: _("S_ring") },
    { range: SYM_OC, idx: (S_amulet + SYM_OFF_O), name: _("S_amulet") },
    { range: SYM_OC, idx: (S_tool + SYM_OFF_O), name: _("S_tool") },
    { range: SYM_OC, idx: (S_food + SYM_OFF_O), name: _("S_food") },
    { range: SYM_OC, idx: (S_potion + SYM_OFF_O), name: _("S_potion") },
    { range: SYM_OC, idx: (S_scroll + SYM_OFF_O), name: _("S_scroll") },
    { range: SYM_OC, idx: (S_book + SYM_OFF_O), name: _("S_book") },
    { range: SYM_OC, idx: (S_wand + SYM_OFF_O), name: _("S_wand") },
    { range: SYM_OC, idx: (S_coin + SYM_OFF_O), name: _("S_coin") },
    { range: SYM_OC, idx: (S_gem + SYM_OFF_O), name: _("S_gem") },
    { range: SYM_OC, idx: (S_rock + SYM_OFF_O), name: _("S_rock") },
    { range: SYM_OC, idx: (S_ball + SYM_OFF_O), name: _("S_ball") },
    { range: SYM_OC, idx: (S_chain + SYM_OFF_O), name: _("S_chain") },
    { range: SYM_OC, idx: (S_venom + SYM_OFF_O), name: _("S_venom") },{ range: SYM_MON, idx: (S_ANT + SYM_OFF_M), name: _("S_ANT") },
    { range: SYM_MON, idx: (S_BLOB + SYM_OFF_M), name: _("S_BLOB") },
    { range: SYM_MON, idx: (S_COCKATRICE + SYM_OFF_M), name: _("S_COCKATRICE") },
    { range: SYM_MON, idx: (S_DOG + SYM_OFF_M), name: _("S_DOG") },
    { range: SYM_MON, idx: (S_EYE + SYM_OFF_M), name: _("S_EYE") },
    { range: SYM_MON, idx: (S_FELINE + SYM_OFF_M), name: _("S_FELINE") },
    { range: SYM_MON, idx: (S_GREMLIN + SYM_OFF_M), name: _("S_GREMLIN") },

    { range: SYM_MON, idx: (S_HUMANOID + SYM_OFF_M), name: _("S_HUMANOID") },

    { range: SYM_MON, idx: (S_IMP + SYM_OFF_M), name: _("S_IMP") },
    { range: SYM_MON, idx: (S_JELLY + SYM_OFF_M), name: _("S_JELLY") },
    { range: SYM_MON, idx: (S_KOBOLD + SYM_OFF_M), name: _("S_KOBOLD") },
    { range: SYM_MON, idx: (S_LEPRECHAUN + SYM_OFF_M), name: _("S_LEPRECHAUN") },
    { range: SYM_MON, idx: (S_MIMIC + SYM_OFF_M), name: _("S_MIMIC") },
    { range: SYM_MON, idx: (S_NYMPH + SYM_OFF_M), name: _("S_NYMPH") },
    { range: SYM_MON, idx: (S_ORC + SYM_OFF_M), name: _("S_ORC") },
    { range: SYM_MON, idx: (S_PIERCER + SYM_OFF_M), name: _("S_PIERCER") },

    { range: SYM_MON, idx: (S_QUADRUPED + SYM_OFF_M), name: _("S_QUADRUPED") },
    { range: SYM_MON, idx: (S_RODENT + SYM_OFF_M), name: _("S_RODENT") },
    { range: SYM_MON, idx: (S_SPIDER + SYM_OFF_M), name: _("S_SPIDER") },
    { range: SYM_MON, idx: (S_TRAPPER + SYM_OFF_M), name: _("S_TRAPPER") },

    { range: SYM_MON, idx: (S_UNICORN + SYM_OFF_M), name: _("S_UNICORN") },
    { range: SYM_MON, idx: (S_VORTEX + SYM_OFF_M), name: _("S_VORTEX") },
    { range: SYM_MON, idx: (S_WORM + SYM_OFF_M), name: _("S_WORM") },
    { range: SYM_MON, idx: (S_XAN + SYM_OFF_M), name: _("S_XAN") },

    { range: SYM_MON, idx: (S_LIGHT + SYM_OFF_M), name: _("S_LIGHT") },
    { range: SYM_MON, idx: (S_ZRUTY + SYM_OFF_M), name: _("S_ZRUTY") },
    { range: SYM_MON, idx: (S_ANGEL + SYM_OFF_M), name: _("S_ANGEL") },
    { range: SYM_MON, idx: (S_BAT + SYM_OFF_M), name: _("S_BAT") },
    { range: SYM_MON, idx: (S_CENTAUR + SYM_OFF_M), name: _("S_CENTAUR") },
    { range: SYM_MON, idx: (S_DRAGON + SYM_OFF_M), name: _("S_DRAGON") },

    { range: SYM_MON, idx: (S_ELEMENTAL + SYM_OFF_M), name: _("S_ELEMENTAL") },
    { range: SYM_MON, idx: (S_FUNGUS + SYM_OFF_M), name: _("S_FUNGUS") },
    { range: SYM_MON, idx: (S_GNOME + SYM_OFF_M), name: _("S_GNOME") },

    { range: SYM_MON, idx: (S_GIANT + SYM_OFF_M), name: _("S_GIANT") },
    { range: SYM_MON, idx: (S_invisible + SYM_OFF_M), name: _("S_invisible") },
    { range: SYM_MON, idx: (S_JABBERWOCK + SYM_OFF_M), name: _("S_JABBERWOCK") },
    { range: SYM_MON, idx: (S_KOP + SYM_OFF_M), name: _("S_KOP") },
    { range: SYM_MON, idx: (S_LICH + SYM_OFF_M), name: _("S_LICH") },
    { range: SYM_MON, idx: (S_MUMMY + SYM_OFF_M), name: _("S_MUMMY") },
    { range: SYM_MON, idx: (S_NAGA + SYM_OFF_M), name: _("S_NAGA") },
    { range: SYM_MON, idx: (S_OGRE + SYM_OFF_M), name: _("S_OGRE") },
    { range: SYM_MON, idx: (S_PUDDING + SYM_OFF_M), name: _("S_PUDDING") },
    { range: SYM_MON, idx: (S_QUANTMECH + SYM_OFF_M), name: _("S_QUANTMECH") },
    { range: SYM_MON, idx: (S_RUSTMONST + SYM_OFF_M), name: _("S_RUSTMONST") },
    { range: SYM_MON, idx: (S_SNAKE + SYM_OFF_M), name: _("S_SNAKE") },
    { range: SYM_MON, idx: (S_TROLL + SYM_OFF_M), name: _("S_TROLL") },

    { range: SYM_MON, idx: (S_UMBER + SYM_OFF_M), name: _("S_UMBER") },
    { range: SYM_MON, idx: (S_VAMPIRE + SYM_OFF_M), name: _("S_VAMPIRE") },
    { range: SYM_MON, idx: (S_WRAITH + SYM_OFF_M), name: _("S_WRAITH") },
    { range: SYM_MON, idx: (S_XORN + SYM_OFF_M), name: _("S_XORN") },

    { range: SYM_MON, idx: (S_YETI + SYM_OFF_M), name: _("S_YETI") },
    { range: SYM_MON, idx: (S_ZOMBIE + SYM_OFF_M), name: _("S_ZOMBIE") },
    { range: SYM_MON, idx: (S_HUMAN + SYM_OFF_M), name: _("S_HUMAN") },

    { range: SYM_MON, idx: (S_GHOST + SYM_OFF_M), name: _("S_GHOST") },
    { range: SYM_MON, idx: (S_GOLEM + SYM_OFF_M), name: _("S_GOLEM") },
    { range: SYM_MON, idx: (S_DEMON + SYM_OFF_M), name: _("S_DEMON") },

    { range: SYM_MON, idx: (S_EEL + SYM_OFF_M), name: _("S_EEL") },

    { range: SYM_MON, idx: (S_LIZARD + SYM_OFF_M), name: _("S_LIZARD") },
    { range: SYM_MON, idx: (S_WORM_TAIL + SYM_OFF_M), name: _("S_WORM_TAIL") },
    { range: SYM_MON, idx: (S_MIMIC_DEF + SYM_OFF_M), name: _("S_MIMIC_DEF") },
    ];
}
