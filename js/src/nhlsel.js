/* NetHack 5.0	nhlua.c	$NHDT-Date: 1769840272 2026/01/30 22:17:52 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.69 $ */
/*      Copyright (c) 2018 by Pasi Kallinen */
/* NetHack may be freely redistributed.  See license for details. */

/* lua_CFunction prototypes */

/* There doesn't seem to be a point in having a l_selection_add since it would
 * do the same thing as l_selection_or. The addition operator is mapped to
 * l_selection_or. */

/* #if 0: not in this build */

export function l_selection_check(L, index) { /* struct selectionvar * */
    let sel;

    luaL_checktype(L, index, LUA_TUSERDATA);
    sel = view_of(struct_selectionvar, luaL_checkudata(L, index, _("selection")));
    if (!sel)
        nhl_error(L, _("Selection error"));
    return sel;
}

function l_selection_gc(L) { /* int */
    let sel = l_selection_check(L, 1);

    if (sel)
        selection_free(sel, FALSE);
    return 0;
}

/* #if 0: not in this build */

/* push a new selection into lua stack, return the selectionvar */
function l_selection_push_new(L) { /* struct selectionvar * */
    let tmp = selection_new();
    let sel = view_of(struct_selectionvar, lua_newuserdata(L, sizeof(struct_selectionvar)));

    luaL_getmetatable(L, _("selection"));
    lua_setmetatable(L, -2);

    struct_assign(sel, tmp);
    sel.map = dupstr(tmp.map);
    selection_free(tmp, TRUE);

    return sel;
}

/* push a copy of selectionvar tmp to lua stack */
export function l_selection_push_copy(L, tmp) { /* void */
    let sel = view_of(struct_selectionvar, lua_newuserdata(L, sizeof(struct_selectionvar)));

    luaL_getmetatable(L, _("selection"));
    lua_setmetatable(L, -2);

    struct_assign(sel, tmp);
    sel.map = dupstr(tmp.map);
}

/* local sel = selection.new(); */
function l_selection_new(L) { /* int */
    l_selection_push_new(L);
    return 1;
}

/* Replace the topmost selection in the stack with a clone of it. */
/* local sel = selection.clone(sel); */
function l_selection_clone(L) { /* int */
    let sel = l_selection_check(L, 1);
    let tmp;

    l_selection_new(L);
    tmp = l_selection_check(L, 2);
    if (tmp.map)
        free(tmp.map);
    struct_assign(tmp, sel);
    tmp.map = dupstr(sel.map);
    return 1;
}

/* selection.set(sel, x, y); */
/* selection.set(sel, x, y, value); */
/* local sel = selection.set(); */
/* local sel = sel:set(); */
/* local sel = selection.set(sel); */
/* TODO: allow setting multiple coords at once: set({x1,y1},{x2,y2},...); */
function l_selection_setpoint(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = null;
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);
    let val = 1;
    let argc = lua_gettop(L);
    let crd = 0;

    if (argc == 0) {
        l_selection_new(L);
    } else if (argc == 1) {
        sel = l_selection_check(L, 1);
    } else if (argc == 2) {
        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        lua_pop(L, 2);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
    } else {
        sel = l_selection_check(L, 1);
        x[0] = coordxy(luaL_checkinteger(L, 2));
        y[0] = coordxy(luaL_checkinteger(L, 3));
        val = int(luaL_optinteger(L, 4, 1));
    }

    if (!sel || !sel.map) {
        nhl_error(L, _("Selection setpoint error"));
        /*NOTREACHED*/
        return 0;
    }

    if (x[0] == -1 && y[0] == -1)
        crd = SP_COORD_PACK_RANDOM(0);
    else
        crd = SP_COORD_PACK(x[0],y[0]);
    get_location_coord(x, y, ANY_LOC,
                       gc.coder ? gc.coder.croom : null, crd);
    selection_setpoint(x[0], y[0], sel, val);
    lua_settop(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* local numpoints = selection.numpoints(sel); */
function l_selection_numpoints(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = l_selection_check(L, 1);
    let x, y;
    let ret = 0;
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(sel, rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++)
            if (selection_getpoint(x, y, sel))
                ret++;

    lua_settop(L, 0);
    lua_pushinteger(L, ret);
    return 1;
    } finally { stack_pop($frame); }
}

/* local value = selection.get(sel, x, y); */
function l_selection_getpoint(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = l_selection_check(L, 1);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let ix = stack_var(lua_Integer), iy = stack_var(lua_Integer);
    let val;
    let crd;

    lua_remove(L, 1); /* sel */
    if (!nhl_get_xy_params(L, ix, iy)) {
        nhl_error(L, _("l_selection_getpoint: Incorrect params"));
        /*NOTREACHED*/
        return 0;
    }
    x[0] = coordxy((ix[0]));
    y[0] = coordxy((iy[0]));

    if (x[0] == -1 && y[0] == -1)
        crd = SP_COORD_PACK_RANDOM(0);
    else
        crd = SP_COORD_PACK(x[0],y[0]);
    get_location_coord(x, y, ANY_LOC,
                       gc.coder ? gc.coder.croom : null, crd);

    val = selection_getpoint(x[0], y[0], sel);
    lua_settop(L, 0);
    lua_pushnumber(L, val);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.negate(sel); */
/* local s = selection.negate(); */
/* local s = sel:negate(); */
function l_selection_not(L) { /* int */
    let argc = lua_gettop(L);
    let sel, sel2;

    if (argc == 0) {
        l_selection_new(L);
        sel = l_selection_check(L, 1);
        selection_clear(sel, 1);
    } else {
        l_selection_check(L, 1);
        l_selection_clone(L);
        sel2 = l_selection_check(L, 2);
        selection_not(sel2);
        lua_remove(L, 1);
    }
    return 1;
}

/* local sel = selection.area(4,5, 40,10) & selection.rect(7,8, 60,14); */
function l_selection_and(L) { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let sela = l_selection_check(L, 1);
    let selb = l_selection_check(L, 2);
    let selr = l_selection_push_new(L);
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    rect_bounds(struct_copy(sela.bounds), struct_copy(selb.bounds), rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++) {
            let val = (selection_getpoint(x, y, sela)
                       & selection_getpoint(x, y, selb));

            selection_setpoint(x, y, selr, val);
        }

    lua_remove(L, 1);
    lua_remove(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* local sel = selection.area(4,5, 40,10) | selection.rect(7,8, 60,14); */
function l_selection_or(L) { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let sela = l_selection_check(L, 1);
    let selb = l_selection_check(L, 2);
    let selr = l_selection_push_new(L);
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    rect_bounds(struct_copy(sela.bounds), struct_copy(selb.bounds), rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++) {
            let val = (selection_getpoint(x, y, sela)
                       | selection_getpoint(x, y, selb));

            selection_setpoint(x, y, selr, val);
        }
    struct_assign(selr.bounds, rect);

    lua_remove(L, 1);
    lua_remove(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* local sel = selection.area(4,5, 40,10) ~ selection.rect(7,8, 60,14); */
function l_selection_xor(L) { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let sela = l_selection_check(L, 1);
    let selb = l_selection_check(L, 2);
    let selr = l_selection_push_new(L);
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    rect_bounds(struct_copy(sela.bounds), struct_copy(selb.bounds), rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++) {
            let val = (selection_getpoint(x, y, sela)
                       ^ selection_getpoint(x, y, selb));

            selection_setpoint(x, y, selr, val);
        }
    /* this may have created a smaller or irregular selection with
     * bounds_dirty set to true - update its boundaries */
    selection_recalc_bounds(selr);

    lua_remove(L, 1);
    lua_remove(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* local sel = selection.area(10,10, 20,20) - selection.area(14,14, 17,17)
 *   - i.e. points that are in A but not in B */
function l_selection_sub(L) { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let sela = l_selection_check(L, 1);
    let selb = l_selection_check(L, 2);
    let selr = l_selection_push_new(L);
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    rect_bounds(struct_copy(sela.bounds), struct_copy(selb.bounds), rect);

    for (x = rect.lx; x <= rect.hx; x++)
        for (y = rect.ly; y <= rect.hy; y++) {
            let a_pt = selection_getpoint(x, y, sela);
            let b_pt = selection_getpoint(x, y, selb);
            let val = (a_pt ^ b_pt) & a_pt;
            selection_setpoint(x, y, selr, val);
        }
    /* this may have created a smaller or irregular selection with
     * bounds_dirty set to true - update its boundaries */
    selection_recalc_bounds(selr);

    lua_remove(L, 1);
    lua_remove(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.percentage(sel, 50); */
function l_selection_filter_percent(L) { /* int */
    let argc = lua_gettop(L);
    let sel = l_selection_check(L, 1);
    let p = int(luaL_checkinteger(L, 2));
    let tmp;

    tmp = selection_filter_percent(sel, p);
    lua_pop(L, argc);
    l_selection_push_copy(L, tmp);
    selection_free(tmp, TRUE);

    return 1;
}

/* local pt = selection.rndcoord(sel); */
/* local pt = selection.rndcoord(sel, 1); */
function l_selection_rndcoord(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = l_selection_check(L, 1);
    let removeit = int(luaL_optinteger(L, 2, 0));
    let x = stack_var(coordxy, -1), y = stack_var(coordxy, -1);
    selection_rndcoord(sel, x, y, removeit);
    if (!(x[0] == -1 && y[0] == -1)) {
        update_croom();
        if (gc.coder && gc.coder.croom) {
            x[0] -= gc.coder.croom.lx;
            y[0] -= gc.coder.croom.ly;
        } else {
            x[0] -= gx.xstart;
            y[0] -= gy.ystart;
        }
    }
    lua_settop(L, 0);
    lua_newtable(L);
    nhl_add_table_entry_int(L, _("x"), x[0]);
    nhl_add_table_entry_int(L, _("y"), y[0]);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.room(); */
function l_selection_room(L) { /* int */
    let sel;
    let argc = lua_gettop(L);
    let croom = null;

    if (argc == 1) {
        let i = luaL_checkinteger(L, -1);

        croom = (i >= 0 && i < svn.nroom) ? svr.rooms[i] : null;
    }

    sel = selection_from_mkroom(croom);

    l_selection_push_copy(L, sel);
    selection_free(sel, TRUE);

    return 1;
}

/* local rect = sel:bounds(); */
function l_selection_getbounds(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = l_selection_check(L, 1);
    let rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    selection_getbounds(sel, rect);
    lua_settop(L, 0);
    lua_newtable(L);
    nhl_add_table_entry_int(L, _("lx"), rect.lx);
    nhl_add_table_entry_int(L, _("ly"), rect.ly);
    nhl_add_table_entry_int(L, _("hx"), rect.hx);
    nhl_add_table_entry_int(L, _("hy"), rect.hy);
    return 1;
    } finally { stack_pop($frame); }
}

/* internal function to get a selection and 4 integer values from lua stack.
   removes the integers from the stack.
   returns TRUE if params are good.
*/
/* function(selection, x1,y1, x2,y2) */
/* selection:function(x1,y1, x2,y2) */
function params_sel_2coords(L, sel,
                   x1, y1, x2, y2) { /* boolean */
    let argc = lua_gettop(L);

    if (argc == 4) {
        l_selection_new(L);
        x1[0] = coordxy(luaL_checkinteger(L, 1));
        y1[0] = coordxy(luaL_checkinteger(L, 2));
        x2[0] = coordxy(luaL_checkinteger(L, 3));
        y2[0] = coordxy(luaL_checkinteger(L, 4));
        sel[0] = l_selection_check(L, 5);
        lua_remove(L, 1);
        lua_remove(L, 1);
        lua_remove(L, 1);
        lua_remove(L, 1);
        return TRUE;
    } else if (argc == 5) {
        sel[0] = l_selection_check(L, 1);
        x1[0] = coordxy(luaL_checkinteger(L, 2));
        y1[0] = coordxy(luaL_checkinteger(L, 3));
        x2[0] = coordxy(luaL_checkinteger(L, 4));
        y2[0] = coordxy(luaL_checkinteger(L, 5));
        lua_pop(L, 4);
        return TRUE;
    }
    return FALSE;
}

/* local s = selection.line(sel, x1,y1, x2,y2); */
/* local s = selection.line(x1,y1, x2,y2); */
/* s:line(x1,y1, x2,y2); */
function l_selection_line(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = stack_var(ptr_to(struct_selectionvar), null);
    let x1 = stack_var(coordxy), y1 = stack_var(coordxy), x2 = stack_var(coordxy), y2 = stack_var(coordxy);

    if (!params_sel_2coords(L, sel, x1, y1, x2, y2)) {
        nhl_error(L, _("selection.line: illegal arguments"));
    }

    get_location_coord(x1, y1, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x1[0], y1[0]));
    get_location_coord(x2, y2, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x2[0], y2[0]));

    l_selection_clone(L);
    sel[0] = l_selection_check(L, 2);
    selection_do_line(x1[0],y1[0],x2[0],y2[0], sel[0]);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.rect(sel, x1,y1, x2,y2); */
function l_selection_rect(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = stack_var(ptr_to(struct_selectionvar), null);
    let x1 = stack_var(coordxy), y1 = stack_var(coordxy), x2 = stack_var(coordxy), y2 = stack_var(coordxy);

    if (!params_sel_2coords(L, sel, x1, y1, x2, y2)) {
        nhl_error(L, _("selection.rect: illegal arguments"));
    }

    get_location_coord(x1, y1, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x1[0], y1[0]));
    get_location_coord(x2, y2, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x2[0], y2[0]));

    l_selection_clone(L);
    sel[0] = l_selection_check(L, 2);
    selection_do_line(x1[0], y1[0], x2[0], y1[0], sel[0]);
    selection_do_line(x1[0], y1[0], x1[0], y2[0], sel[0]);
    selection_do_line(x2[0], y1[0], x2[0], y2[0], sel[0]);
    selection_do_line(x1[0], y2[0], x2[0], y2[0], sel[0]);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.fillrect(sel, x1,y1, x2,y2); */
/* local s = selection.fillrect(x1,y1, x2,y2); */
/* s:fillrect(x1,y1, x2,y2); */
/* selection.area(x1,y1, x2,y2); */
function l_selection_fillrect(L) { /* int */
    const $frame = stack_frame(); try {
    let sel = stack_var(ptr_to(struct_selectionvar), null);
    let y;
    let x1 = stack_var(coordxy), y1 = stack_var(coordxy), x2 = stack_var(coordxy), y2 = stack_var(coordxy);

    if (!params_sel_2coords(L, sel, x1, y1, x2, y2)) {
        nhl_error(L, _("selection.fillrect: illegal arguments"));
    }

    get_location_coord(x1, y1, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x1[0], y1[0]));
    get_location_coord(x2, y2, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x2[0], y2[0]));

    l_selection_clone(L);
    sel[0] = l_selection_check(L, 2);
    if (x1[0] == x2[0]) {
        for (y = y1[0]; y <= y2[0]; y++)
            selection_setpoint(x1[0], y, sel[0], 1);
    } else {
        for (y = y1[0]; y <= y2[0]; y++)
            selection_do_line(x1[0], y, x2[0], y, sel[0]);
    }
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.randline(sel, x1,y1, x2,y2, roughness); */
/* local s = selection.randline(x1,y1, x2,y2, roughness); */
/* TODO: selection.randline(x1,y1, x2,y2, roughness); */
/* TODO: selection.randline({x1,y1}, {x2,y2}, roughness); */
function l_selection_randline(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let sel;
    let x1 = stack_var(coordxy, 0), y1 = stack_var(coordxy, 0), x2 = stack_var(coordxy, 0), y2 = stack_var(coordxy, 0);
    let roughness = 7;

    if (argc == 6) {
        l_selection_check(L, 1);
        x1[0] = coordxy(luaL_checkinteger(L, 2));
        y1[0] = coordxy(luaL_checkinteger(L, 3));
        x2[0] = coordxy(luaL_checkinteger(L, 4));
        y2[0] = coordxy(luaL_checkinteger(L, 5));
        roughness = int(luaL_checkinteger(L, 6));
        lua_pop(L, 5);
    } else if (argc == 5 && lua_type(L, 1) == LUA_TNUMBER) {
        x1[0] = coordxy(luaL_checkinteger(L, 1));
        y1[0] = coordxy(luaL_checkinteger(L, 2));
        x2[0] = coordxy(luaL_checkinteger(L, 3));
        y2[0] = coordxy(luaL_checkinteger(L, 4));
        roughness = int(luaL_checkinteger(L, 5));
        lua_pop(L, 5);
        l_selection_new(L);
        l_selection_check(L, 1);
    }

    get_location_coord(x1, y1, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x1[0], y1[0]));
    get_location_coord(x2, y2, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x2[0], y2[0]));

    l_selection_clone(L);
    sel = l_selection_check(L, 2);
    selection_do_randline(x1[0], y1[0], x2[0], y2[0], roughness, 12, sel);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.grow(sel); */
/* local s = selection.grow(sel, "north"); */
function l_selection_grow(L) { /* int */
    let growdirs = static_array("l_selection_grow.growdirs", ptr_to(char), null, [
        _("all"), _("random"), _("north"), _("west"), _("east"), _("south"), 0
    ]);
    let growdirs2i = static_array("l_selection_grow.growdirs2i", int, null, [
        W_ANY, W_RANDOM, W_NORTH, W_WEST, W_EAST, W_SOUTH, 0
    ]);
    let sel;
    let dir, argc = lua_gettop(L);

    l_selection_check(L, 1);
    dir = growdirs2i[luaL_checkoption(L, 2, _("all"), growdirs)];

    if (argc == 2)
        lua_pop(L, 1); /* get rid of growdir */

    l_selection_clone(L);
    sel = l_selection_check(L, 2);
    selection_do_grow(sel, dir);
    return 1;
}

/* local s = selection.filter_mapchar(sel, mapchar, lit); */
function l_selection_filter_mapchar(L) { /* int */
    let argc = lua_gettop(L);
    let sel = l_selection_check(L, 1);
    let mapchr = dupstr(luaL_checkstring(L, 2));
    let typ = check_mapchr(mapchr);
    let lit = int(luaL_optinteger(L, 3, -2)); /* TODO: special lit values */
    let tmp;

    if (typ == INVALID_TYPE)
        nhl_error(L, _("Erroneous map char"));

    tmp = selection_filter_mapchar(sel, typ, lit);
    lua_pop(L, argc);
    l_selection_push_copy(L, tmp);
    selection_free(tmp, TRUE);

    if (mapchr)
        free(mapchr);

    return 1;
}

/* local s = selection.match([[...]]); */
function l_selection_match(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let sel = null;
    let mf = stack_var(ptr_to(struct_mapfragment), null);
    let x, y;

    if (argc == 1) {
        let err;
        let mapstr = dupstr(luaL_checkstring(L, 1));
        lua_pop(L, 1);
        l_selection_new(L);
        sel = l_selection_check(L, 1);

        mf[0] = mapfrag_fromstr(mapstr);
        free(mapstr);

        if ((err = mapfrag_error(mf[0])) != (0)) {
            nhl_error(L, err);
            /*NOTREACHED*/
        }
    } else {
        nhl_error(L, _("wrong parameters"));
        /*NOTREACHED*/
    }

    for (y = 0; y <= sel.hei; y++)
        for (x = 1; x < sel.wid; x++)
            selection_setpoint(x, y, sel, mapfrag_match(mf[0], x,y) ? 1 : 0);

    /* unless the (0, 1) coordinate is a match, this would wind up with a
       selection with lx=COLNO, hx=0, etc, so fix the boundaries */
    selection_recalc_bounds(sel);

    mapfrag_free(mf);

    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.floodfill(x,y); */
/* local s = selection.floodfill(x,y, diagonals); */
function l_selection_flood(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let sel = null;
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0);
    let diagonals = FALSE;

    if (argc == 2 || argc == 3) {
        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        if (argc == 3)
            diagonals = lua_toboolean(L, 3);
        lua_pop(L, argc);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
    } else {
        nhl_error(L, _("wrong parameters"));
        /*NOTREACHED*/
    }

    get_location_coord(x, y, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x[0], y[0]));

    if (isok(x[0], y[0])) {
        set_floodfillchk_match_under(levl()[x[0]][y[0]].typ);
        selection_floodfill(sel, x[0], y[0], diagonals);
    }
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.circle(x,y, radius); */
/* local s = selection.circle(x, y, radius, filled); */
/* local s = selection.circle(sel, x, y, radius); */
/* local s = selection.circle(sel, x, y, radius, filled); */
function l_selection_circle(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let sel = null;
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0);
    let r = 0, filled = 0;

    if (argc == 3) {
        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        r = int(luaL_checkinteger(L, 3));
        lua_pop(L, 3);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
        filled = 0;
    } else if (argc == 4 && lua_type(L, 1) == LUA_TNUMBER) {
        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        r = int(luaL_checkinteger(L, 3));
        filled = int(luaL_checkinteger(L, 4)); /* TODO: boolean*/
        lua_pop(L, 4);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
    } else if (argc == 4 || argc == 5) {
        sel = l_selection_check(L, 1);
        x[0] = coordxy(luaL_checkinteger(L, 2));
        y[0] = coordxy(luaL_checkinteger(L, 3));
        r = int(luaL_checkinteger(L, 4));
        filled = int(luaL_optinteger(L, 5, 0)); /* TODO: boolean */
    } else {
        nhl_error(L, _("wrong parameters"));
        /*NOTREACHED*/
    }

    get_location_coord(x, y, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x[0], y[0]));

    selection_do_ellipse(sel, x[0], y[0], r, r, +!filled);

    lua_settop(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* local s = selection.ellipse(x, y, radius1, radius2); */
/* local s = selection.ellipse(x, y, radius1, radius2, filled); */
/* local s = selection.ellipse(sel, x, y, radius1, radius2); */
/* local s = selection.ellipse(sel, x, y, radius1, radius2, filled); */
function l_selection_ellipse(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let sel = null;
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0);
    let r1 = 0, r2 = 0, filled = 0;

    if (argc == 4) {
        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        r1 = int(luaL_checkinteger(L, 3));
        r2 = int(luaL_checkinteger(L, 4));
        lua_pop(L, 4);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
        filled = 0;
    } else if (argc == 5 && lua_type(L, 1) == LUA_TNUMBER) {
        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        r1 = int(luaL_checkinteger(L, 3));
        r2 = int(luaL_checkinteger(L, 4));
        filled = int(luaL_optinteger(L, 5, 0)); /* TODO: boolean */
        lua_pop(L, 5);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
    } else if (argc == 5 || argc == 6) {
        sel = l_selection_check(L, 1);
        x[0] = coordxy(luaL_checkinteger(L, 2));
        y[0] = coordxy(luaL_checkinteger(L, 3));
        r1 = int(luaL_checkinteger(L, 4));
        r2 = int(luaL_checkinteger(L, 5));
        filled = int(luaL_optinteger(L, 6, 0)); /* TODO: boolean */
    } else {
        nhl_error(L, _("wrong parameters"));
        /*NOTREACHED*/
    }

    get_location_coord(x, y, ANY_LOC, gc.coder ? gc.coder.croom : null,
                       SP_COORD_PACK(x[0], y[0]));

    selection_do_ellipse(sel, x[0], y[0], r1, r2, +!filled);

    lua_settop(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* Gradients are versatile enough, with so many independently optional
 * arguments, that it doesn't seem helpful to provide a non-table form with
 * non-obvious argument order. */
/* selection.gradient({ type = "radial", x = 3, y = 5, x2 = 10, y2 = 12,
 *                      mindist = 4, maxdist = 10, limited = false });    */
function l_selection_gradient(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let sel = null;
    /* if x2 and y2 aren't set, the gradient has a single center point of x,y;
     * if they are set, the gradient is centered on a (x,y) to (x2,y2) line */
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0), x2 = stack_var(coordxy, -1), y2 = stack_var(coordxy, -1);
    /* points are always added within mindist of the center; the chance for a
     * point between mindist and maxdist to be added to the selection starts
     * at 100% at mindist and decreases linearly to 0% at maxdist */
    let mindist = 0, maxdist = 0;
    let type = 0;
    let gradtypes = static_array("l_selection_gradient.gradtypes", ptr_to(char), null, [
        _("radial"), _("square"), 0
    ]);
    let gradtypes2i = static_array("l_selection_gradient.gradtypes2i", int, null, [
        SEL_GRADIENT_RADIAL, SEL_GRADIENT_SQUARE, -1
    ]);

    if (argc == 1 && lua_type(L, 1) == LUA_TTABLE) {
        lcheck_param_table(L);
        type = gradtypes2i[get_table_option(L, _("type"), _("radial"), gradtypes)];
        x[0] = coordxy(get_table_int(L, _("x")));
        y[0] = coordxy(get_table_int(L, _("y")));
        x2[0] = coordxy(get_table_int_opt(L, _("x2"), -1));
        y2[0] = coordxy(get_table_int_opt(L, _("y2"), -1));
        cvt_to_abscoord(x, y);
        cvt_to_abscoord(x2, y2);
        /* maxdist is required because there's no obvious default value for
         * it, whereas mindist has an obvious default of 0 */
        maxdist = get_table_int(L, _("maxdist"));
        mindist = get_table_int_opt(L, _("mindist"), 0);

        lua_pop(L, 1);
        l_selection_new(L);
        sel = l_selection_check(L, 1);
    } else {
        nhl_error(L, _("selection.gradient requires table argument"));
        /* NOTREACHED */
    }

    /* someone might conceivably want to draw a gradient somewhere off-map. So
     * the only coordinate that's "illegal" for that is (-1,-1).
     * If a level designer really needs to draw a gradient line using that
     * coordinate, they can do so by setting regular x and y to -1. */
    if (x2[0] == -1 && y2[0] == -1) {
        x2[0] = x[0];
        y2[0] = y[0];
    }

    selection_do_gradient(sel, x[0], y[0], x2[0], y2[0], type, mindist, maxdist);
    lua_settop(L, 1);
    return 1;
    } finally { stack_pop($frame); }
}

/* sel:iterate(function(x,y) ... end);
 * The x, y coordinates passed to the function are map- or room-relative
 * rather than absolute, unless there has been no previous map or room
 * defined.
 */
function l_selection_iterate(L) { /* int */
    const $frame = stack_frame(); try {
    var argc = lua_gettop(L);
    var sel = null;
    var x, y;
    var rect = struct_assign(stack_struct(struct_nhrect), cg.zeroNhRect);

    out: { if (argc == 2 && lua_type(L, 2) == LUA_TFUNCTION) {
        sel = l_selection_check(L, 1);
        selection_getbounds(sel, rect);
        for (y = rect.ly; y <= rect.hy; y++) {
            for (x = max(1,rect.lx); x <= rect.hx; x++)
                if (selection_getpoint(x, y, sel)) {
                    var tmpx = stack_var(coordxy, x), tmpy = stack_var(coordxy, y);
                    cvt_to_relcoord(tmpx, tmpy);
                    lua_pushvalue(L, 2);
                    lua_pushinteger(L, tmpx[0]);
                    lua_pushinteger(L, tmpy[0]);
                    if (nhl_pcall_handle(L, 2, 0, _("l_selection_iterate"),
                                         NHLpa_impossible)) {
                        /* abort loops to prevent possible error cascade */
                        break out;
                    }
                }
            lua_gc(L, LUA_GCCOLLECT, 0);
        }
    } else {
        nhl_error(L, _("wrong parameters"));
        /*NOTREACHED*/
    }
 }
    return 0;
    } finally { stack_pop($frame); }
}

/* local txt = sel:describe_size(); */
/* gives a textual description of the selection size */
function l_selection_size_description(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc == 1) {
        let sel = l_selection_check(L, 1);
        let buf = stack_array(char, BUFSZ);

        lua_pushstring(L, selection_size_description(sel, buf));
        return 1;
    } else {
        nhl_error(L, _("wrong parameters"));
        /*NOTREACHED*/
    }
    return 0;
    } finally { stack_pop($frame); }
}

const l_selection_methods = static_array("l_selection_methods", struct_luaL_Reg, null, [
    { name: _("new"), func: l_selection_new },
    { name: _("clone"), func: l_selection_clone },
    { name: _("get"), func: l_selection_getpoint },
    { name: _("set"), func: l_selection_setpoint },
    { name: _("numpoints"), func: l_selection_numpoints },
    { name: _("negate"), func: l_selection_not },
    { name: _("percentage"), func: l_selection_filter_percent },
    { name: _("rndcoord"), func: l_selection_rndcoord },
    { name: _("line"), func: l_selection_line },
    { name: _("randline"), func: l_selection_randline },
    { name: _("rect"), func: l_selection_rect },
    { name: _("fillrect"), func: l_selection_fillrect },
    { name: _("area"), func: l_selection_fillrect },
    { name: _("grow"), func: l_selection_grow },
    { name: _("filter_mapchar"), func: l_selection_filter_mapchar },
    { name: _("match"), func: l_selection_match },
    { name: _("floodfill"), func: l_selection_flood },
    { name: _("circle"), func: l_selection_circle },
    { name: _("ellipse"), func: l_selection_ellipse },
    { name: _("gradient"), func: l_selection_gradient },
    { name: _("iterate"), func: l_selection_iterate },
    { name: _("bounds"), func: l_selection_getbounds },
    { name: _("room"), func: l_selection_room },
    { name: _("describe_size"), func: l_selection_size_description },
    { name: 0, func: null }
]);

const l_selection_meta = static_array("l_selection_meta", struct_luaL_Reg, null, [
    { name: _("__gc"), func: l_selection_gc },
    { name: _("__unm"), func: l_selection_not },
    { name: _("__band"), func: l_selection_and },
    { name: _("__bor"), func: l_selection_or },
    { name: _("__bxor"), func: l_selection_xor },
    { name: _("__bnot"), func: l_selection_not },
    { name: _("__add"), func: l_selection_or }, /* this aliases + to be the same as | */
    { name: _("__sub"), func: l_selection_sub },
    /* TODO: http://lua-users.org/wiki/MetatableEvents
       { "__ipairs", l_selection_ipairs },
    */
    { name: 0, func: null }
]);

export function l_selection_register(L) { /* int */
    /* Table of instance methods and static methods. */
    ((luaL_checkversion(L), lua_createtable(L, 0, (Math.trunc((static_sizeof("l_selection_methods") / sizeof(struct_luaL_Reg))) - 1))), luaL_setfuncs(L, l_selection_methods[0], 0));

    /* metatable = { __name = "selection", __gc = l_selection_gc } */
    luaL_newmetatable(L, _("selection"));
    luaL_setfuncs(L, l_selection_meta[0], 0);

    /* metatable.__index points at the selection method table. */
    lua_pushvalue(L, -2);
    lua_setfield(L, -2, _("__index"));

    /* Don't let lua code mess with the real metatable.
       Instead offer a fake one that only contains __gc. */
    ((luaL_checkversion(L), lua_createtable(L, 0, (Math.trunc((static_sizeof("l_selection_meta") / sizeof(struct_luaL_Reg))) - 1))), luaL_setfuncs(L, l_selection_meta[0], 0));
    lua_setfield(L, -2, _("__metatable"));

    /* We don't need the metatable anymore. It's safe in the
       Lua registry for use by luaL_setmetatable. */
    lua_pop(L, 1);

    /* global selection = the method table we created at the start */
    lua_setglobal(L, _("selection"));

    return 0;
}

import { BUFSZ, FALSE, NHLpa_impossible, TRUE, coordxy } from "./global.h.js";
import { struct_selectionvar } from "./hack.h.js";
import { max } from "./hack.h.macros.js";
import { struct_luaL_Reg } from "./lauxlib.h.js";
import { luaL_checkstring, luaL_checkversion, luaL_getmetatable } from "./lauxlib.h.macros.js";
import {
    LUA_GCCOLLECT, LUA_TFUNCTION, LUA_TNUMBER, LUA_TTABLE, LUA_TUSERDATA, lua_Integer,
} from "./lua.h.js";
import { lua_newtable, lua_newuserdata, lua_pop, lua_remove } from "./lua.h.macros.js";
import { struct_nhrect } from "./rect.h.js";
import { INVALID_TYPE } from "./rm.h.js";
import { levl } from "./rm.h.macros.js";
import {
    ANY_LOC, SEL_GRADIENT_RADIAL, SEL_GRADIENT_SQUARE, W_ANY, W_EAST, W_NORTH, W_RANDOM, W_SOUTH,
    W_WEST, struct_mapfragment,
} from "./sp_lev.h.js";
import { SP_COORD_PACK, SP_COORD_PACK_RANDOM } from "./sp_lev.h.macros.js";
import { char, int, sizeof } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { free } from "../rt/libc.js";
import { stack_array, stack_struct, stack_var, static_array, static_sizeof } from "../rt/locals.js";
import {
    luaL_checkinteger, luaL_checkoption, luaL_checktype, luaL_checkudata, luaL_newmetatable,
    luaL_optinteger, luaL_setfuncs, lua_createtable, lua_gc, lua_gettop, lua_pushinteger,
    lua_pushnumber, lua_pushstring, lua_pushvalue, lua_setfield, lua_setglobal, lua_setmetatable,
    lua_settop, lua_toboolean, lua_type,
} from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import { ptr_to, struct_assign, struct_copy, view_of } from "../rt/struct.js";
import { dupstr } from "./alloc.js";
import { isok } from "./cmd.js";
import { cg, gc, gx, gy, svn, svr } from "./decl.js";
import {
    check_mapchr, get_table_int, get_table_int_opt, get_table_option, lcheck_param_table,
    nhl_add_table_entry_int, nhl_error, nhl_get_xy_params, nhl_pcall_handle,
} from "./nhlua.js";
import { rect_bounds } from "./rect.js";
import {
    selection_clear, selection_do_ellipse, selection_do_gradient, selection_do_grow,
    selection_do_line, selection_do_randline, selection_filter_mapchar, selection_filter_percent,
    selection_floodfill, selection_free, selection_from_mkroom, selection_getbounds,
    selection_getpoint, selection_new, selection_not, selection_recalc_bounds, selection_rndcoord,
    selection_setpoint, selection_size_description,
} from "./selvar.js";
import {
    cvt_to_abscoord, cvt_to_relcoord, get_location_coord, mapfrag_error, mapfrag_free,
    mapfrag_fromstr, mapfrag_match, set_floodfillchk_match_under, update_croom,
} from "./sp_lev.js";
