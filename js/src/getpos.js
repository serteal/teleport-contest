/* NetHack 5.0	getpos.c	$NHDT-Date: 1763708572 2025/11/20 23:02:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.6 $ */
/*-Copyright (c) Pasi Kallinen, 2023. */
/* NetHack may be freely redistributed.  See license for details. */

 /* from pager.c */

/* Callback function for getpos() to highlight desired map locations.
 * Parameter TRUE: initialize and highlight, FALSE: done (remove highlights).
 */
const getpos_hilitefunc = static_var("getpos_hilitefunc", fnptr_t, null);
const getpos_getvalid = static_var("getpos_getvalid", fnptr_t, null);

    const HiliteNormalMap = 0;
    const HiliteGoodposSymbol = 1;
    const HiliteBackground = 2;

const getpos_hilite_state = static_var("getpos_hilite_state", unsigned, HiliteNormalMap);
const defaultHiliteState = static_var("defaultHiliteState", unsigned, HiliteNormalMap);

export function getpos_sethilite(
    gp_hilitef,
    gp_getvalidf) { /* void */
    let old_getvalid = getpos_getvalid[0];
    let old_map_frame_color = gw.wsettings.map_frame_color;
    let sel = selection_new();

    defaultHiliteState[0] = iflags.bgcolors ? HiliteBackground : HiliteNormalMap;
    if (gp_getvalidf != old_getvalid)
        getpos_hilite_state[0] = defaultHiliteState[0];

    getpos_getvalids_selection(sel, getpos_getvalid[0]);
    getpos_hilitefunc[0] = gp_hilitef;
    getpos_getvalid[0] = gp_getvalidf;
    getpos_getvalids_selection(sel, getpos_getvalid[0]);
    gw.wsettings.map_frame_color = (getpos_hilite_state[0] == HiliteBackground)
                                   ? HI_ZAP : NO_COLOR;

    if (getpos_getvalid[0] != old_getvalid
        || gw.wsettings.map_frame_color != old_map_frame_color)
        selection_force_newsyms(sel);
    selection_free(sel, TRUE);
}

/* cycle 'getpos_hilite_state' to its next state;
   when 'bgcolors' is Off, it will alternate between not showing valid
   positions and showing them via temporary S_goodpos symbol;
   when 'bgcolors' is On, there are three states and showing them via
   setting background color becomes the default */
function getpos_toggle_hilite_state() { /* void */
    /* getpos_hilitefunc isn't Null */
    if (getpos_hilite_state[0] == HiliteGoodposSymbol) {
        /* currently on, finish */
        (getpos_hilitefunc[0])(FALSE); /* tmp_at(DISP_END) */
    }

    getpos_hilite_state[0] = unsigned(getpos_hilite_state[0] + 1)
                          % (iflags.bgcolors ? 3 : 2);
    /* resetting the callback functions to their current values will draw
       valid-spots with background color if that is the new state and turn
       off that color if it was the previous state */
    getpos_sethilite(getpos_hilitefunc[0], getpos_getvalid[0]);

    if (getpos_hilite_state[0] == HiliteGoodposSymbol) {
        /* now on, begin */
        (getpos_hilitefunc[0])(TRUE);
    }
}

export function mapxy_valid(x, y) { /* boolean */
    if (getpos_getvalid[0])
        return (getpos_getvalid[0])(x, y);
    return FALSE;
}

function getpos_getvalids_selection(
    sel,
    validf) { /* void */
    let x, y;

    if (!sel || !validf)
        return;

    for (x = 1; x < sel.wid; x++)
        for (y = 0; y < sel.hei; y++)
            if (validf(x, y))
                selection_setpoint(x, y, sel, 1);
}

const gloc_descr = static_array("gloc_descr", array_of(ptr_to(char), 4), NUM_GLOCS, [
    [ _("any monsters"), _("monster"), _("next/previous monster"), _("monsters") ],
    [ _("any items"), _("item"), _("next/previous object"), _("objects") ],
    [ _("any doors"), _("door"), _("next/previous door or doorway"),
      _("doors or doorways") ],
    [ _("any unexplored areas"), _("unexplored area"), _("unexplored location"),
      _("locations next to unexplored locations") ],
    [ _("anything interesting"), _("interesting thing"), _("anything interesting"),
      _("anything interesting") ],
    [ _("any valid locations"), _("valid location"), _("valid location"),
      _("valid locations") ]
]);

const gloc_filtertxt = static_array("gloc_filtertxt", ptr_to(char), NUM_GFILTER, [
    _(""),
    _(" in view"),
    _(" in this area")
]);

function getpos_help_keyxhelp(
    tmpwin,
    k1, k2,
    gloc) { /* void */
    const $frame = stack_frame(); try {
    let sbuf = stack_array(char, BUFSZ), fbuf = stack_array(char, QBUFSZ);
    let move_cursor_to = _("move the cursor to "),
               filtertxt = gloc_filtertxt[iflags.getloc_filter];

    if (gloc == GLOC_EXPLORE) {
        /* default of "move to unexplored location" is inaccurate
           because the position will be one spot short of that */
        move_cursor_to = _("move the cursor next to an ");
        if (iflags.getloc_usemenu)
            /* default is too wide for basic 80-column tty so shorten it
               to avoid wrapping */
            filtertxt = strsubst(strcpy(fbuf, filtertxt),
                                 _("this area"), _("area"));
    }
    sprintf(sbuf, _("Use '%s'/'%s' to %s%s%s."), k1, k2, iflags.getloc_usemenu ? _("get a menu of ") : move_cursor_to, gloc_descr[gloc][2 + iflags.getloc_usemenu], filtertxt)

;
    putstr()(tmpwin, 0, sbuf);
    } finally { stack_pop($frame); }
}

/* the response for '?' help request in getpos() */
function getpos_help(force, goal) { /* void */
    const $frame = stack_frame(); try {
    let $goto = null; var fastmovemode = static_array("getpos_help.fastmovemode", ptr_to(char), 2, [ _("8 units at a time"), _("skipping same glyphs") ]), sbuf = stack_array(char, BUFSZ), kbuf = stack_array(char, BUFSZ);

    var doing_what_is;
    var tmpwin = create_nhwindow()(NHW_MENU);

    sprintf(sbuf, _("Use '%s', '%s', '%s', '%s' to move the cursor to %s."), visctrl(cmd_from_func(do_move_west)), visctrl(cmd_from_func(do_move_south)), visctrl(cmd_from_func(do_move_north)), visctrl(cmd_from_func(do_move_east)), goal)

;
    putstr()(tmpwin, 0, sbuf);
    sprintf(sbuf, _("Use '%s', '%s', '%s', '%s' to fast-move the cursor, %s."), visctrl(cmd_from_func(do_run_west)), visctrl(cmd_from_func(do_run_south)), visctrl(cmd_from_func(do_run_north)), visctrl(cmd_from_func(do_run_east)), fastmovemode[iflags.getloc_moveskip])

;
    putstr()(tmpwin, 0, sbuf);
    sprintf(sbuf, _("(or prefix normal move with '%s' or '%s' to fast-move)"), visctrl(cmd_from_func(do_run)), visctrl(cmd_from_func(do_rush)))

;
    putstr()(tmpwin, 0, sbuf);
    putstr()(tmpwin, 0, _("Or enter a background symbol (ex. '<')."));
    sprintf(sbuf, _("Use '%s' to move the cursor on yourself."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_SELF]))
;
    putstr()(tmpwin, 0, sbuf);
    if (!iflags.terrainmode || (iflags.terrainmode & TER_MON) != 0) {
        getpos_help_keyxhelp(tmpwin,
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_MON_NEXT]),
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_MON_PREV]),
                             GLOC_MONS);
    }
    $goto_skip_non_mons: for (;;) { switch ($goto) { default: if (goal && !strcmp(goal, _("a monster")))
        { $goto = "skip_non_mons"; continue $goto_skip_non_mons; };
    if (!iflags.terrainmode || (iflags.terrainmode & TER_OBJ) != 0) {
        getpos_help_keyxhelp(tmpwin,
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_OBJ_NEXT]),
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_OBJ_PREV]),
                             GLOC_OBJS);
    }
    if (!iflags.terrainmode || (iflags.terrainmode & TER_MAP) != 0) {
        /* these are primarily useful when choosing a travel
           destination for the '_' command */
        getpos_help_keyxhelp(tmpwin,
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_DOOR_NEXT]),
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_DOOR_PREV]),
                             GLOC_DOOR);
        getpos_help_keyxhelp(tmpwin,
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_UNEX_NEXT]),
                             visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_UNEX_PREV]),
                             GLOC_EXPLORE);
        getpos_help_keyxhelp(tmpwin,
                          visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_INTERESTING_NEXT]),
                          visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_INTERESTING_PREV]),
                             GLOC_INTERESTING);
    }
    sprintf(sbuf, _("Use '%s' to change fast-move mode to %s."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_MOVESKIP]), fastmovemode[+!iflags.getloc_moveskip])

;
    putstr()(tmpwin, 0, sbuf);
    if (!iflags.terrainmode || (iflags.terrainmode & TER_DETECT) == 0) {
        sprintf(sbuf, _("Use '%s' to toggle menu listing for possible targets."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_MENU]))
;
        putstr()(tmpwin, 0, sbuf);
        sprintf(sbuf, _("Use '%s' to change the mode of limiting possible targets."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_LIMITVIEW]))

;
        putstr()(tmpwin, 0, sbuf);
    }
    case "skip_non_mons": if ($goto || (!iflags.terrainmode)) {
        switch ($goto) { default:

        if (getpos_getvalid[0]) {
            sprintf(sbuf, _("Use '%s' or '%s' to move to valid locations."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_VALID_NEXT]), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_VALID_PREV]))

;
            putstr()(tmpwin, 0, sbuf);
        }
        if (getpos_hilitefunc[0]) {
            sprintf(sbuf, _("Use '%s' to toggle marking of valid locations."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_SHOWVALID]))
;
            putstr()(tmpwin, 0, sbuf);
        }
        sprintf(sbuf, _("Use '%s' to toggle automatic description."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_AUTODESC]))
;
        putstr()(tmpwin, 0, sbuf);
        if (iflags.cmdassist) { /* assisting the '/' command, I suppose... */
            sprintf(sbuf, (iflags.getpos_coords == GPCOORDS_NONE)
        ? _("(Set 'whatis_coord' option to include coordinates with '%s' text.)")
        : _("(Reset 'whatis_coord' option to omit coordinates from '%s' text.)"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_AUTODESC]))

;
        }
 case "skip_non_mons": $goto = null;
        /* disgusting hack; the alternate selection characters work for any
           getpos call, but only matter for dowhatis (and doquickwhatis,
           also for dotherecmdmenu's simulated mouse) */
        doing_what_is = +(goal == what_is_a_location); }
        if (doing_what_is) {
            sprintf(kbuf, _("'%s' or '%s' or '%s' or '%s'"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK]), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_Q]), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_O]), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_V]))

;
        } else {
            sprintf(kbuf, _("'%s'"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK]));
        }
        Snprintf(sbuf, sizeof(array_of(char, BUFSZ)), _("Type a %s when you are at the right place."), kbuf)
;
        putstr()(tmpwin, 0, sbuf);
        if (doing_what_is) {
            sprintf(sbuf, _("  '%s' describe current spot, show 'more info', move to another spot."), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_V]))

;
            putstr()(tmpwin, 0, sbuf);
            sprintf(sbuf, _("  '%s' describe current spot,%s move to another spot;"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK]), flags.help && !force ? _(" prompt if 'more info',") : _(""))

;
            putstr()(tmpwin, 0, sbuf);
            sprintf(sbuf, _("  '%s' describe current spot, move to another spot;"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_Q]))

;
            putstr()(tmpwin, 0, sbuf);
            sprintf(sbuf, _("  '%s' describe current spot, stop looking at things;"), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK_O]))

;
            putstr()(tmpwin, 0, sbuf);
        }
    } } break; }
    if (!force)
        putstr()(tmpwin, 0, _("Type Space or Escape when you're done."));
    putstr()(tmpwin, 0, _(""));
    display_nhwindow()(tmpwin, TRUE);
    destroy_nhwindow()(tmpwin);
    } finally { stack_pop($frame); }
}

function cmp_coord_distu(a, b) { /* int QSORTCALLBACK */
    let c1 = view_of(struct_nhcoord, a);
    let c2 = view_of(struct_nhcoord, b);
    let dx, dy, dist_1, dist_2;

    dx = u.ux - c1.x;
    dy = u.uy - c1.y;
    dist_1 = (((abs(dx)) > (abs(dy))) ? (abs(dx)) : (abs(dy)));
    dx = u.ux - c2.x;
    dy = u.uy - c2.y;
    dist_2 = (((abs(dx)) > (abs(dy))) ? (abs(dx)) : (abs(dy)));

    if (dist_1 == dist_2)
        return (c1.y != c2.y) ? (c1.y - c2.y) : (c1.x - c2.x);

    return dist_1 - dist_2;
}

export function IS_UNEXPLORED_LOC(x, y) { return (isok(x, y)
     && glyph_is_unexplored(levl()[x][y].glyph)
     && !levl()[x][y].seenv ? 1 : 0); }

export function GLOC_SAME_AREA(x, y) { return (isok(x, y)
     && selection_getpoint(x,y, gg.gloc_filter_map) ? 1 : 0); }

function gloc_filter_classify_glyph(glyph) { /* int */
    let c;

    if (!glyph_is_cmap(glyph))
        return 0;

    c = glyph_to_cmap(glyph);

    if (is_cmap_room(c) || is_cmap_furniture(c))
        return 1;
    else if (is_cmap_wall(c) || c == S_tree)
        return 2;
    else if (is_cmap_corr(c))
        return 3;
    else if (is_cmap_water(c))
        return 4;
    else if (is_cmap_lava(c))
        return 5;
    return 0;
}

function gloc_filter_floodfill_matcharea(x, y) { /* int */
    let glyph = back_to_glyph(x, y);

    if (!levl()[x][y].seenv)
        return FALSE;

    if (glyph == gg.gloc_filter_floodfill_match_glyph)
        return TRUE;

    if (gloc_filter_classify_glyph(glyph)
        == gloc_filter_classify_glyph(gg.gloc_filter_floodfill_match_glyph))
        return TRUE;

    return FALSE;
}

function gloc_filter_floodfill(x, y) { /* void */
    gg.gloc_filter_floodfill_match_glyph = back_to_glyph(x, y);

    set_selection_floodfillchk(gloc_filter_floodfill_matcharea);
    selection_floodfill(gg.gloc_filter_map, x, y, FALSE);
}

function gloc_filter_init() { /* void */
    if (iflags.getloc_filter == GFILTER_AREA) {
        if (!gg.gloc_filter_map) {
            gg.gloc_filter_map = selection_new();
        }
        /* special case: if we're in a doorway, try to figure out which
           direction we're moving, and use that side of the doorway */
        if (IS_DOOR(levl()[u.ux][u.uy].typ)) {
            if ((u.dx || u.dy) && isok(u.ux + u.dx, u.uy + u.dy)) {
                gloc_filter_floodfill(u.ux + u.dx, u.uy + u.dy);
            } else {
                /* TODO: maybe add both sides of the doorway? */
            }
        } else {
            gloc_filter_floodfill(u.ux, u.uy);
        }
    }
}

function gloc_filter_done() { /* void */
    if (gg.gloc_filter_map) {
        selection_free(gg.gloc_filter_map, TRUE);
        gg.gloc_filter_map = null;
    }
}

function known_vibrating_square_at(x, y) { /* boolean */
    /* note: this only acknowledges the genuine vibrating square, not
       fake ones produced by wizard mode wishing for traps which could
       possibly be transfered to normal play via bones file */
    if (invocation_pos(x, y)) {
        let ttmp = t_at(x, y);

        return (ttmp && ttmp.ttyp == VIBRATING_SQUARE && ttmp.tseen ? 1 : 0);
    }
    return FALSE;
}

export function gather_locs_interesting(
    x, y,
    gloc) { /* boolean */
    let glyph, sym;

    if (iflags.getloc_filter == GFILTER_VIEW && !cansee(x, y))
        return FALSE;
    if (iflags.getloc_filter == GFILTER_AREA && !GLOC_SAME_AREA(x, y)
        && !GLOC_SAME_AREA(x - 1, y) && !GLOC_SAME_AREA(x, y - 1)
        && !GLOC_SAME_AREA(x + 1, y) && !GLOC_SAME_AREA(x, y + 1))
        return FALSE;

    glyph = glyph_at(x, y);
    sym = glyph_is_cmap(glyph) ? glyph_to_cmap(glyph) : -1;
    switch (gloc) {
    default:
    case GLOC_MONS:
        /* unlike '/M', this skips monsters revealed by
           warning glyphs and remembered unseen ones */
        return +(glyph_is_monster(glyph)
                && glyph != monnum_to_glyph(PM_LONG_WORM_TAIL, MALE)
                && glyph != monnum_to_glyph(PM_LONG_WORM_TAIL, FEMALE));
    case GLOC_OBJS:
        return +(glyph_is_object(glyph)
                && glyph != objnum_to_glyph(BOULDER)
                && glyph != objnum_to_glyph(ROCK));
    case GLOC_DOOR:
        return +(glyph_is_cmap(glyph)
                && (is_cmap_door(sym)
                    || is_cmap_drawbridge(sym)
                    || sym == S_ndoor));
    case GLOC_EXPLORE:
        return (glyph_is_cmap(glyph)
                && !glyph_is_nothing(glyph_to_cmap(glyph))
                && (is_cmap_door(sym)
                    || is_cmap_drawbridge(sym)
                    || sym == S_ndoor
                    || is_cmap_room(sym)
                    || is_cmap_corr(sym))
                && (IS_UNEXPLORED_LOC(x + 1, y)
                    || IS_UNEXPLORED_LOC(x - 1, y)
                    || IS_UNEXPLORED_LOC(x, y + 1)
                    || ((isok((x), (y - 1)) && glyph_is_unexplored(elt(levl()[(x)], (y - 1)).glyph)) && !elt(levl()[(x)], (y - 1)).seenv)) ? 1 : 0);
    case GLOC_VALID:
        if (getpos_getvalid[0])
            return (getpos_getvalid[0])(x, y);
        /* FALLTHROUGH */;
        /*FALLTHRU*/
    case GLOC_INTERESTING:
        return (gather_locs_interesting(x, y, GLOC_DOOR)
                || !((glyph_is_cmap(glyph)
                      && (is_cmap_wall(sym)
                          || sym == S_tree
                          || sym == S_bars
                          || sym == S_ice
                          || sym == S_air
                          || sym == S_cloud
                          || is_cmap_lava(sym)
                          || is_cmap_water(sym)
                          || sym == S_ndoor
                          || is_cmap_room(sym)
                          || is_cmap_corr(sym)))
                     || glyph_is_nothing(glyph)
                     || glyph_is_unexplored(glyph))
                || known_vibrating_square_at(x, y) ? 1 : 0);
    }
    /*NOTREACHED*/
    return FALSE;
}

/* gather locations for monsters or objects shown on the map */
function gather_locs(arr_p, cnt_p, gloc) { /* void */
    let pass, idx;
    let x, y;

    /*
     * We always include the hero's location even if there is no monster
     * (invisible hero without see invisible) or object (usual case)
     * displayed there.  That way, the count will always be at least 1,
     * and player has a visual indicator (cursor returns to hero's spot)
     * highlighting when successive 'm's or 'o's have cycled all the way
     * through all monsters or objects.
     *
     * Hero's spot will always sort to array[0] because it will always
     * be the shortest distance (namely, 0 units) away from <u.ux,u.uy>.
     */

    gloc_filter_init();

    cnt_p[0] = idx = 0;
    for (pass = 0; pass < 2; pass++) {
        for (x = 1; x < COLNO; x++)
            for (y = 0; y < ROWNO; y++) {
                if (u_at(x, y) || gather_locs_interesting(x, y, gloc)) {
                    if (!pass) {
                        ++cnt_p[0];
                    } else {
                        ptr_add((arr_p[0]), idx).x = x;
                        ptr_add((arr_p[0]), idx).y = y;
                        ++idx;
                    }
                }
            }

        if (!pass) /* end of first pass */
            arr_p[0] = view_of(struct_nhcoord, addr_of(alloc(unsigned(Math.imul(unsigned(cnt_p[0]), sizeof(struct_nhcoord))))));
        else /* end of second pass */
            nh_deterministic_qsort(addr_of((arr_p[0])), unsigned((cnt_p[0])), (sizeof(struct_nhcoord)), (cmp_coord_distu));
    } /* pass */

    gloc_filter_done();
}

export function dxdy_to_dist_descr(dx, dy, fulldir) { /* char * */
    let buf = static_array("dxdy_to_dist_descr.buf", char, 30);
    let dst;

    if (!dx && !dy) {
        sprintf(buf, _("here"));
    } else if ((dst = xytodir(dx, dy)) != -1) {
        /* explicit direction; 'one step' is implicit */
        sprintf(buf, _("%s"), directionname(dst));
    } else {
        let dirnames = static_array("dxdy_to_dist_descr.dirnames", array_of(ptr_to(char), 2), 4, [
            [ _("n"), _("north") ],
            [ _("s"), _("south") ],
            [ _("w"), _("west") ],
            [ _("e"), _("east") ] ]);
        chars[buf + 0] = ord('\0');
        /* 9999: protect buf[] against overflow caused by invalid values */
        if (dy) {
            if (abs(dy) > 9999)
                dy = sgn(dy) * 9999;
            sprintf(eos(buf), _("%d%s%s"), abs(dy), dirnames[+(dy > 0)][fulldir], dx ? _(",") : _(""))
;
        }
        if (dx) {
            if (abs(dx) > 9999)
                dx = sgn(dx) * 9999;
            sprintf(eos(buf), _("%d%s"), abs(dx), dirnames[2 + +(dx > 0)][fulldir])
;
        }
    }
    return buf;
}

/* coordinate formatting for 'whatis_coord' option */
export function coord_desc(x, y, outbuf, cmode) { /* char * */
    let screen_fmt = static_array("coord_desc.screen_fmt", char, 16); /* [12] suffices: "[%02d,%02d]" */
    let dx, dy;

    chars[outbuf + 0] = ord('\0');
    switch (cmode) {
    default:
        break;
    case GPCOORDS_COMFULL:
    case GPCOORDS_COMPASS:
        /* "east", "3s", "2n,4w" */
        dx = x - u.ux;
        dy = y - u.uy;
        sprintf(outbuf, _("(%s)"), dxdy_to_dist_descr(dx, dy, +(cmode == GPCOORDS_COMFULL)))
;
        break;
    case GPCOORDS_MAP: /* x,y */
        /* upper left corner of map is <1,0>;
           with default COLNO,ROWNO lower right corner is <79,20> */
        sprintf(outbuf, _("<%d,%d>"), x, y);
        break;
    case GPCOORDS_SCREEN: /* y+2,x */
        /* for normal map sizes, force a fixed-width formatting so that
           /m, /M, /o, and /O output lines up cleanly; map sizes bigger
           than Nx999 or 999xM will still work, but not line up like normal
           when displayed in a column setting.

           The (100) is placed in brackets below to mark the [: "03"] as
           explicit compile-time dead code for clang */
        if (!chars[screen_fmt])
            sprintf(screen_fmt, _("[%%%sd,%%%sd]"), (ROWNO - 1 + 2 < (100)) ? _("02") :  _("03"), (COLNO - 1 < (100)) ? _("02") : _("03"))

;
        /* map line 0 is screen row 2;
           map column 0 isn't used, map column 1 is screen column 1 */
        sprintf(outbuf, screen_fmt, y + 2, x);
        break;
    }
    return outbuf;
}

export function auto_describe(cx, cy) { /* void */
    const $frame = stack_frame(); try {
    let cc = stack_struct(struct_nhcoord);
    let sym = 0;
    let tmpbuf = stack_array(char, BUFSZ);
    let firstmatch = stack_var(ptr_to(char), _("unknown"));

    cc.x = cx;
    cc.y = cy;
    if (do_screen_description(struct_copy(cc), TRUE, sym, tmpbuf, firstmatch,
                              null)) {
        coord_desc(cx, cy, tmpbuf, iflags.getpos_coords);
        custompline((SUPPRESS_HISTORY | OVERRIDE_MSGTYPE | NO_CURS_ON_U),
                    _("%s%s%s%s%s"), firstmatch[0], chars[tmpbuf] ? _(" ") : _(""), tmpbuf,
                    (iflags.autodescribe
                     && getpos_getvalid[0] && !(getpos_getvalid[0])(cx, cy))
                      ? _(" (invalid target)") : _(""),
                    (iflags.getloc_travelmode && !is_valid_travelpt(cx, cy))
                      ? _(" (no travel path)") : _(""));
        curs()(WIN_MAP, cx, cy);
        flush_screen(0);
    }
    } finally { stack_pop($frame); }
}

export function getpos_menu(ccp, gloc) { /* boolean */
    const $frame = stack_frame(); try {
    let garr = stack_var(ptr_to(struct_nhcoord), DUMMY());
    let gcount = stack_var(int, 0);
    let tmpwin;
    let any = stack_struct(struct_any);
    let i, pick_cnt;
    let picks = stack_var(ptr_to(struct_mi), null);
    let tmpbuf = stack_array(char, BUFSZ);
    let clr = NO_COLOR;

    gather_locs(garr, gcount, gloc);

    if (gcount[0] < 2) { /* gcount always includes the hero */
        free(addr_of(garr[0]));
        You(_("cannot %s %s."),
            (iflags.getloc_filter == GFILTER_VIEW) ? _("see") : _("detect"),
            gloc_descr[gloc][0]);
        return FALSE;
    }

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);
    struct_assign(any, cg.zeroany);

    /* gather_locs returns array[0] == you. skip it. */
    for (i = 1; i < gcount[0]; i++) {
        let fullbuf = stack_array(char, BUFSZ);
        let tmpcc = stack_struct(struct_nhcoord);
        let firstmatch = stack_var(ptr_to(char), _("unknown"));
        let sym = 0;

        any.a_int = i + 1;
        tmpcc.x = ptr_add(garr[0], i).x;
        tmpcc.y = ptr_add(garr[0], i).y;
        if (do_screen_description(struct_copy(tmpcc), TRUE, sym, tmpbuf,
                              firstmatch, null)) {
            coord_desc(ptr_add(garr[0], i).x, ptr_add(garr[0], i).y, tmpbuf,
                              iflags.getpos_coords);
            Snprintf(fullbuf, sizeof(array_of(char, BUFSZ)), _("%s%s%s"), firstmatch[0], (chars[tmpbuf] ? _(" ") : _("")), tmpbuf)
;
            add_menu(tmpwin, nul_glyphinfo, any, 0, 0,
                     ATR_NONE, clr, fullbuf, MENU_ITEMFLAGS_NONE);
        }
    }

    sprintf(tmpbuf, _("Pick %s%s%s"), an(gloc_descr[gloc][1]), gloc_filtertxt[iflags.getloc_filter], iflags.getloc_travelmode ? _(" for travel destination") : _(""))

;
    end_menu()(tmpwin, tmpbuf);
    pick_cnt = select_menu(tmpwin, PICK_ONE, picks);
    destroy_nhwindow()(tmpwin);
    if (pick_cnt > 0) {
        ccp.x = ptr_add(garr[0], picks[0].item.a_int - 1).x;
        ccp.y = ptr_add(garr[0], picks[0].item.a_int - 1).y;
        free(addr_of(picks[0]));
    }
    free(addr_of(garr[0]));
    return +(pick_cnt > 0);
    } finally { stack_pop($frame); }
}

/* add dx,dy to cx,cy, truncating at map edges */
function truncate_to_map(cx, cy, dx, dy) { /* void */
    /* diagonal moves complicate this... */
    if (cx[0] + dx < 1) {
        dy -= sgn(dy) * (1 - (cx[0] + dx));
        dx = 1 - cx[0]; /* so that (cx+dx == 1) */
    } else if (cx[0] + dx > COLNO - 1) {
        dy += sgn(dy) * ((COLNO - 1) - (cx[0] + dx));
        dx = (COLNO - 1) - cx[0];
    }
    if (cy[0] + dy < 0) {
        dx -= sgn(dx) * (0 - (cy[0] + dy));
        dy = 0 - cy[0]; /* so that (cy+dy == 0) */
    } else if (cy[0] + dy > ROWNO - 1) {
        dx += sgn(dx) * ((ROWNO - 1) - (cy[0] + dy));
        dy = (ROWNO - 1) - cy[0];
    }
    cx[0] += dx;
    cy[0] += dy;
}

/* called when ^R typed; if '$' is being shown for valid spots, remove that;
   if alternate background color is being shown for that, redraw it */
function getpos_refresh() { /* void */
    if (getpos_hilitefunc[0] && getpos_hilite_state[0] == HiliteGoodposSymbol) {
        (getpos_hilitefunc[0])(FALSE); /* tmp_at(DISP_END) */
        getpos_hilite_state[0] = defaultHiliteState[0];
    }

    docrt_flags(docrtRefresh);

    if (getpos_hilitefunc[0] && getpos_hilite_state[0] == HiliteBackground) {
        /* resetting to current values will draw valid-spots highlighting */
        getpos_sethilite(getpos_hilitefunc[0], getpos_getvalid[0]);
    }
}

/* have the player use movement keystrokes to position the cursor at a
   particular map location, then use one of [.,:;] to pick the spot */
export function getpos(ccp, force, goal) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null; var mMoOdDxX_def = static_array("getpos.mMoOdDxX_def", int, null, [ NHKF_GETPOS_MON_NEXT, NHKF_GETPOS_MON_PREV, NHKF_GETPOS_OBJ_NEXT, NHKF_GETPOS_OBJ_PREV, NHKF_GETPOS_DOOR_NEXT, NHKF_GETPOS_DOOR_PREV, NHKF_GETPOS_UNEX_NEXT, NHKF_GETPOS_UNEX_PREV, NHKF_GETPOS_INTERESTING_NEXT, NHKF_GETPOS_INTERESTING_PREV, NHKF_GETPOS_VALID_NEXT, NHKF_GETPOS_VALID_PREV ]), cq = stack_struct(struct__cmd_queue), pick_chars = stack_array(char, 6), mMoOdDxX = stack_array(char, 13), sidx = stack_var(int), cx = stack_var(coordxy), cy = stack_var(coordxy), tx = stack_var(coordxy), ty = stack_var(coordxy), garr = stack_array(ptr_to(struct_nhcoord), NUM_GLOCS), gcount = stack_array(int, NUM_GLOCS), gidx = stack_array(int, NUM_GLOCS), view_filters = static_array("getpos.view_filters", ptr_to(char), NUM_GFILTER, [ _("Not limiting targets"), _("Limiting targets to those in sight"), _("Limiting targets to those in same area") ]), tmpcrd = stack_struct(struct_nhcoord), matching = stack_array(char, MAXPCHARS), note = stack_array(char, QBUFSZ);
    const struct___anon1 = struct("getpos.struct___anon1", {
        nhkf: int, ret: int,
    }); var pick_chars_def = static_array("getpos.pick_chars_def", struct___anon1, null, [
        { nhkf: NHKF_GETPOS_PICK, ret: LOOK_TRADITIONAL },
        { nhkf: NHKF_GETPOS_PICK_Q, ret: LOOK_QUICK },
        { nhkf: NHKF_GETPOS_PICK_O, ret: LOOK_ONCE },
        { nhkf: NHKF_GETPOS_PICK_V, ret: LOOK_VERBOSE }
    ]);

    var cmdq;
    var cp;

    var result = 0;
    var i, c;

    tx[0] = u.ux; ty[0] = u.uy;
    var msg_given = TRUE; /* clear message window by default */
    var show_goal_msg = FALSE;
    init_list(garr, []);
    init_list(gcount, []);
    init_list(gidx, []);
    var udx = u.dx, udy = u.dy, udz = u.dz;
    var dx, dy;
    var rushrun = FALSE;

    /* temporary? if we have a queued direction, return the adjacent spot
       in that direction */
    if (!gi.in_doagain) {
        if ((cmdq = cmdq_pop()) != null) {
            struct_assign(cq, cmdq);
            free(addr_of(cmdq));
            if (cq.typ == CMDQ_DIR && !cq.dirz) {
                ccp.x = u.ux + cq.dirx;
                ccp.y = u.uy + cq.diry;
            } else {
                cmdq_clear(CQ_CANNED);
                result = -1;
            }
            return result;
        }
    }

    for (i = 0; i < SIZE(pick_chars_def); i++)
        chars[pick_chars + i] = chars[gc.Cmd.spkeys + (pick_chars_def[i].nhkf)];
    chars[pick_chars + SIZE(pick_chars_def)] = ord('\0');

    for (i = 0; i < SIZE(mMoOdDxX_def); i++)
        chars[mMoOdDxX + i] = chars[gc.Cmd.spkeys + (mMoOdDxX_def[i])];
    chars[mMoOdDxX + SIZE(mMoOdDxX_def)] = ord('\0');

    if (handle_tip(TIP_GETPOS))
        show_goal_msg = TRUE; /* tip has overwritten prompt in mesg window */

    if (!goal)
        goal = _("desired location");
    if (flags.verbose) {
        pline(_("(For instructions type a '%s')"),
              visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_HELP]));
        msg_given = TRUE;
    }
    cx[0] = gg.getposx = ccp.x;
    cy[0] = gg.getposy = ccp.y;

    cliparound()(cx[0], cy[0]);

    curs()(WIN_MAP, cx[0], cy[0]);
    flush_screen(0);

    lock_mouse_buttons(TRUE);
    exitgetpos: { $out_do_rushrun: for (;;) {
        if (show_goal_msg) {
            pline(_("Move cursor to %s:"), goal);
            curs()(WIN_MAP, cx[0], cy[0]);
            flush_screen(0);
            show_goal_msg = FALSE;
        } else if (iflags.autodescribe && !msg_given) {
            auto_describe(cx[0], cy[0]);
        }

        rushrun = FALSE;

        if ((cmdq = cmdq_pop()) != null) {
            if (cmdq.typ == CMDQ_KEY) {
                c = cmdq.key;
            } else {
                cmdq_clear(CQ_CANNED);
                result = -1;
                break exitgetpos;
            }
            free(addr_of(cmdq));
        } else {
            c = readchar_poskey(tx, ty, sidx);
            /* remember_getpos is normally False because reusing the
               cursor positioning during ^A is almost never the right
               thing to do, but caller could set it if that was needed */
            if (iflags.remember_getpos && !gi.in_doagain)
                cmdq_add_key(CQ_REPEAT, c);
        }

        if (iflags.autodescribe)
            msg_given = FALSE;

        if (c == chars[gc.Cmd.spkeys + NHKF_ESC]) {
            cx[0] = cy[0] = -10;
            msg_given = TRUE; /* force clear */
            result = -1;
            break;
        }
        if (c == cmd_from_func(do_run) || c == cmd_from_func(do_rush)) {
            c = readchar_poskey(tx, ty, sidx);
            rushrun = TRUE;
        }
        if (c == 0) {
            if (!isok(tx[0], ty[0]))
                continue;
            /* a mouse click event, just assign and return */
            cx[0] = tx[0];
            cy[0] = ty[0];
            break;
        }
        $goto_do_rushrun: for (;;) { switch ($goto) { default: case "do_rushrun": if (!$goto && ((cp = strchr(pick_chars, c)) != 0)) {
            /* '.' => 0, ',' => 1, ';' => 2, ':' => 3 */
            result = pick_chars_def[(cp - pick_chars)].ret;
            break $out_do_rushrun;
        } else if (!$goto && (movecmd(c, MV_WALK))) {
            if (rushrun)
                { $goto = "do_rushrun"; continue $goto_do_rushrun; };
            dx = u.dx;
            dy = u.dy;
            truncate_to_map(cx, cy, dx, dy);
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if ($goto || (movecmd(c, MV_RUSH) || movecmd(c, MV_RUN))) {
 $goto = null;
            if (iflags.getloc_moveskip) {
                /* skip same glyphs */
                var glyph = glyph_at(cx[0], cy[0]);

                dx = u.dx;
                dy = u.dy;
                while (isok(cx[0] + dx, cy[0] + dy)
                       && glyph == glyph_at(cx[0] + dx, cy[0] + dy)
                       && isok(cx[0] + dx + u.dx, cy[0] + dy + u.dy)
                       && glyph == glyph_at(cx[0] + dx + u.dx, cy[0] + dy + u.dy)) {
                    dx += u.dx;
                    dy += u.dy;
                }
            } else {
                dx = 8 * u.dx;
                dy = 8 * u.dy;
            }
            truncate_to_map(cx, cy, dx, dy);
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        }

        if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_HELP] || redraw_cmd(c)) {
            /* '?' will redraw twice, first when removing popup text window
               after showing the help text, then to reset highlighting */
            if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_HELP])
                getpos_help(force, goal);
            /* ^R: docrt(), hilite_state = default */
            getpos_refresh();
            curs()(WIN_MAP, cx[0], cy[0]);
            /* update message window to reflect that we're still targeting */
            show_goal_msg = TRUE;
        } else if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_SHOWVALID]) {
            if (getpos_hilitefunc[0]) {
                getpos_toggle_hilite_state();
                curs()(WIN_MAP, cx[0], cy[0]);
            }
            show_goal_msg = TRUE; /* we're still targeting */
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_AUTODESC]) {
            iflags.autodescribe = +!iflags.autodescribe;
            pline(_("Automatic description %sis %s."),
                  flags.verbose ? _("of features under cursor ") : _(""),
                  iflags.autodescribe ? _("on") : _("off"));
            if (!iflags.autodescribe)
                show_goal_msg = TRUE;
            msg_given = TRUE;
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_LIMITVIEW]) {
            iflags.getloc_filter = (iflags.getloc_filter + 1) % NUM_GFILTER;
            for (i = 0; i < NUM_GLOCS; i++) {
                if (garr[i]) {
                    free(addr_of(garr[i]));
                    garr[i] = null;
                }
                gidx[i] = gcount[i] = 0;
            }
            pline(_("%s."), view_filters[iflags.getloc_filter]);
            msg_given = TRUE;
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_MENU]) {
            iflags.getloc_usemenu = +!iflags.getloc_usemenu;
            pline(_("%s a menu to show possible targets%s."),
                  iflags.getloc_usemenu ? _("Using") : _("Not using"),
                  iflags.getloc_usemenu
                      ? _(" for 'm|M', 'o|O', 'd|D', and 'x|X'") : _(""));
            msg_given = TRUE;
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_SELF]) {
            /* reset 'm&M', 'o&O', &c; otherwise, there's no way for player
               to achieve that except by manually cycling through all spots */
            for (i = 0; i < NUM_GLOCS; i++)
                gidx[i] = 0;
            cx[0] = u.ux;
            cy[0] = u.uy;
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if (c == chars[gc.Cmd.spkeys + NHKF_GETPOS_MOVESKIP]) {
            iflags.getloc_moveskip = +!iflags.getloc_moveskip;
            pline(_("%skipping over similar terrain when fastmoving the cursor."),
                  iflags.getloc_moveskip ? _("S") : _("Not s"));
            msg_given = TRUE;
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else if ((cp = strchr(mMoOdDxX, c)) != 0) { /* 'm|M', 'o|O', &c */
            /* nearest or farthest monster or object or door or unexplored */
            var gtmp = (cp - mMoOdDxX),
                gloc = gtmp >> 1;             /* 0..3 */

            if (iflags.getloc_usemenu) {
                if (getpos_menu(tmpcrd, gloc)) {
                    cx[0] = tmpcrd.x;
                    cy[0] = tmpcrd.y;
                }
                { $goto = "nxtc"; continue $goto_do_rushrun; }
            }

            if (!garr[gloc]) {
                gather_locs(garr.subarray(gloc), gcount.subarray(gloc), gloc);
                gidx[gloc] = 0; /* garr[][0] is hero's spot */
            }
            if (!(gtmp & 1)) {  /* c=='m' || c=='o' || c=='d' || c=='x') */
                gidx[gloc] = (gidx[gloc] + 1) % gcount[gloc];
            } else {            /* c=='M' || c=='O' || c=='D' || c=='X') */
                if (--gidx[gloc] < 0)
                    gidx[gloc] = gcount[gloc] - 1;
            }
            cx[0] = ptr_add(garr[gloc], gidx[gloc]).x;
            cy[0] = ptr_add(garr[gloc], gidx[gloc]).y;
            { $goto = "nxtc"; continue $goto_do_rushrun; }
        } else {
            if (!strchr(quitchars, c)) {
                var pass, k = 0;
                var lo_x, lo_y, hi_x, hi_y;

                memset(matching, 0, sizeof(array_of(char, MAXPCHARS)));
                for (sidx[0] = 0; sidx[0] < MAXPCHARS; sidx[0]++) {
                    /* don't even try to match some terrain: walls, room... */
                    if (is_cmap_wall(sidx[0]) || is_cmap_room(sidx[0])
                        || is_cmap_corr(sidx[0]) || is_cmap_door(sidx[0])
                        || sidx[0] == S_ndoor)
                        continue;
                    if (c == defsyms[sidx[0]].sym
                        || c == (uchars[gs.showsyms + (sidx[0])])
                        /* have '^' match webs and vibrating square or any
                           other trap that uses something other than '^' */
                        || (c == ord('^') && is_cmap_trap(sidx[0]))
                        /* have room engraving character (default '`')
                           match corridor engravings (default '#') too */
                        || (c == uchars[gs.showsyms + S_engroom]
                            && is_cmap_engraving(sidx[0])))
                        chars[matching + (sidx[0])] = char((++k));
                }
                if (k) {
                    for (pass = 0; pass <= 1; pass++) {
                        /* pass 0: just past current pos to lower right;
                           pass 1: upper left corner to current pos */
                        lo_y = (pass == 0) ? cy[0] : 0;
                        hi_y = (pass == 0) ? ROWNO - 1 : cy[0];
                        for (ty[0] = lo_y; ty[0] <= hi_y; ty[0]++) {
                            lo_x = (pass == 0 && ty[0] == lo_y) ? cx[0] + 1 : 1;
                            hi_x = (pass == 1 && ty[0] == hi_y) ? cx[0] : COLNO - 1;
                            for (tx[0] = lo_x; tx[0] <= hi_x; tx[0]++) {
                                /* first, look at what is currently visible
                                   (might be monster) */
                                k = glyph_at(tx[0], ty[0]);
                                foundc: { if (glyph_is_cmap(k)
                                    && chars[matching + glyph_to_cmap(k)])
                                    break foundc;;
                                /* next, try glyph that's remembered here
                                   (might be trap or object) */
                                if (svl.level.flags.hero_memory
                                    /* !terrainmode: don't move to remembered
                                       trap or object if not currently shown */
                                    && !iflags.terrainmode) {
                                    k = levl()[tx[0]][ty[0]].glyph;
                                    if (glyph_is_cmap(k)
                                        && chars[matching + glyph_to_cmap(k)])
                                        break foundc;;
                                }
                                /* FIXME: check player-specified vib.sq trap
                                   symbol rather than or in addition to '~' */
                                if (c == ord('~')
                                    && known_vibrating_square_at(tx[0], ty[0]))
                                    break foundc;;
                                /* last, try actual terrain here (shouldn't
                                   we be using svl.lastseentyp[][] instead?) */
                                if (levl()[tx[0]][ty[0]].seenv) {
                                    k = back_to_glyph(tx[0], ty[0]);
                                    if (glyph_is_cmap(k)
                                        && chars[matching + glyph_to_cmap(k)])
                                        break foundc;;
                                }
                                continue;
 }
                                cx[0] = tx[0], cy[0] = ty[0];
                                if (msg_given) {
                                    clear_nhwindow()(WIN_MESSAGE);
                                    msg_given = FALSE;
                                }
                                { $goto = "nxtc"; continue $goto_do_rushrun; }
                            } /* column */
                        }     /* row */
                    }         /* pass */
                    pline(_("Can't find dungeon feature '%c'."), c);
                    msg_given = TRUE;
                    { $goto = "nxtc"; continue $goto_do_rushrun; }
                } else {
                    if (!force)
                        strcpy(note, _("aborted"));
                    else /* hjkl */
                        sprintf(note, _("use '%s', '%s', '%s', '%s' or '%s'"), visctrl(cmd_from_func(do_move_west)), visctrl(cmd_from_func(do_move_south)), visctrl(cmd_from_func(do_move_north)), visctrl(cmd_from_func(do_move_east)), visctrl(chars[gc.Cmd.spkeys + NHKF_GETPOS_PICK]))

;
                    pline(_("Unknown direction: '%s' (%s)."), visctrl(char(c)),
                          note);
                    msg_given = TRUE;
                } /* k => matching */
            }     /* !quitchars */
            if (force)
                { $goto = "nxtc"; continue $goto_do_rushrun; };
            pline(_("Done."));
            msg_given = FALSE; /* suppress clear */
            cx[0] = -1;
            cy[0] = 0;
            result = 0; /* not -1 */
            break $out_do_rushrun;
        }
 case "nxtc": $goto = null;
        gg.getposx = cx[0], gg.getposy = cy[0]; } break; }

        cliparound()(cx[0], cy[0]);

        curs()(WIN_MAP, cx[0], cy[0]);
        flush_screen(0);
    }
 }

    lock_mouse_buttons(FALSE);
    if (msg_given)
        clear_nhwindow()(WIN_MESSAGE);
    ccp.x = cx[0];
    ccp.y = cy[0];
    gg.getposx = gg.getposy = 0;
    for (i = 0; i < NUM_GLOCS; i++)
        if (garr[i])
            free(addr_of(garr[i]));
    getpos_sethilite(null, null);
    u.dx = udx, u.dy = udy, u.dz = udz;
    return result;
    } finally { stack_pop($frame); }
}

/*getpos.c*/

import { HI_ZAP, NO_COLOR } from "./color.h.js";
import { TIP_GETPOS } from "./context.h.js";
import { struct_nhcoord } from "./coord.h.js";
import {
    MAXPCHARS, S_air, S_bars, S_cloud, S_engroom, S_ice, S_ndoor, S_tree,
} from "./defsym.h.js";
import { docrtRefresh } from "./display.h.js";
import {
    glyph_is_cmap, glyph_is_monster, glyph_is_nothing, glyph_is_object, glyph_is_unexplored,
    monnum_to_glyph, objnum_to_glyph,
} from "./display.h.macros.js";
import {
    GFILTER_AREA, GFILTER_VIEW, GLOC_DOOR, GLOC_EXPLORE, GLOC_INTERESTING, GLOC_MONS, GLOC_OBJS,
    GLOC_VALID, GPCOORDS_COMFULL, GPCOORDS_COMPASS, GPCOORDS_MAP, GPCOORDS_NONE, GPCOORDS_SCREEN,
    NUM_GFILTER, NUM_GLOCS, TER_DETECT, TER_MAP, TER_MON, TER_OBJ,
} from "./flag.h.js";
import { BUFSZ, COLNO, FALSE, QBUFSZ, ROWNO, TRUE, coordxy } from "./global.h.js";
import {
    CMDQ_DIR, CMDQ_KEY, CQ_CANNED, CQ_REPEAT, LOOK_ONCE, LOOK_QUICK, LOOK_TRADITIONAL, LOOK_VERBOSE,
    MV_RUN, MV_RUSH, MV_WALK, NHKF_ESC, NHKF_GETPOS_AUTODESC, NHKF_GETPOS_DOOR_NEXT,
    NHKF_GETPOS_DOOR_PREV, NHKF_GETPOS_HELP, NHKF_GETPOS_INTERESTING_NEXT,
    NHKF_GETPOS_INTERESTING_PREV, NHKF_GETPOS_LIMITVIEW, NHKF_GETPOS_MENU, NHKF_GETPOS_MON_NEXT,
    NHKF_GETPOS_MON_PREV, NHKF_GETPOS_MOVESKIP, NHKF_GETPOS_OBJ_NEXT, NHKF_GETPOS_OBJ_PREV,
    NHKF_GETPOS_PICK, NHKF_GETPOS_PICK_O, NHKF_GETPOS_PICK_Q, NHKF_GETPOS_PICK_V, NHKF_GETPOS_SELF,
    NHKF_GETPOS_SHOWVALID, NHKF_GETPOS_UNEX_NEXT, NHKF_GETPOS_UNEX_PREV, NHKF_GETPOS_VALID_NEXT,
    NHKF_GETPOS_VALID_PREV, NO_CURS_ON_U, OVERRIDE_MSGTYPE, SUPPRESS_HISTORY, struct__cmd_queue,
} from "./hack.h.js";
import { DUMMY } from "./hack.h.macros.js";
import { Snprintf } from "./hacklib.h.macros.js";
import { FEMALE, MALE } from "./monflag.h.js";
import { PM_LONG_WORM_TAIL } from "./monsters.h.js";
import { BOULDER, ROCK } from "./objects.h.js";
import { IS_DOOR, levl } from "./rm.h.macros.js";
import {
    is_cmap_corr, is_cmap_door, is_cmap_drawbridge, is_cmap_engraving, is_cmap_furniture,
    is_cmap_lava, is_cmap_room, is_cmap_trap, is_cmap_wall, is_cmap_water,
} from "./sym.h.macros.js";
import { VIBRATING_SQUARE } from "./trap.h.js";
import { cansee } from "./vision.h.macros.js";
import {
    clear_nhwindow, cliparound, create_nhwindow, curs, destroy_nhwindow, display_nhwindow, end_menu,
    putstr, start_menu,
} from "./winprocs.h.macros.js";
import {
    ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE, NHW_MENU, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { u_at } from "./you.h.macros.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, ord, sizeof, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { abs, free, memset, sprintf, strchr, strcmp, strcpy } from "../rt/libc.js";
import {
    init_list, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, elt, fnptr_t, ptr_add, ptr_to, struct, struct_assign, struct_copy, view_of,
} from "../rt/struct.js";
import { alloc } from "./alloc.js";
import {
    cmd_from_func, cmdq_add_key, cmdq_clear, cmdq_pop, directionname, do_move_east, do_move_north,
    do_move_south, do_move_west, do_run, do_run_east, do_run_north, do_run_south, do_run_west,
    do_rush, isok, lock_mouse_buttons, movecmd, readchar_poskey, redraw_cmd, xytodir,
} from "./cmd.js";
import { cg, flags, gc, gg, gi, gs, gw, iflags, quitchars, svl, u } from "./decl.js";
import { back_to_glyph, docrt_flags, flush_screen, glyph_at, nul_glyphinfo } from "./display.js";
import { defsyms } from "./drawing.js";
import { glyph_to_cmap } from "./glyphs.js";
import { handle_tip, invocation_pos, is_valid_travelpt } from "./hack.js";
import { eos, nh_deterministic_qsort, sgn, strsubst, visctrl } from "./hacklib.js";
import { an } from "./objnam.js";
import { do_screen_description, what_is_a_location } from "./pager.js";
import { You, custompline, pline } from "./pline.js";
import {
    selection_floodfill, selection_force_newsyms, selection_free, selection_getpoint, selection_new,
    selection_setpoint, set_selection_floodfillchk,
} from "./selvar.js";
import { t_at } from "./trap.js";
import { add_menu, select_menu } from "./windows.js";
