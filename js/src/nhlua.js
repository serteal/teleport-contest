/* NetHack 5.0	nhlua.c	$NHDT-Date: 1744963460 2025/04/18 00:04:20 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.153 $ */
/*      Copyright (c) 2018 by Pasi Kallinen */
/* NetHack may be freely redistributed.  See license for details. */

/*
#- include <lua5.3/lua.h>
#- include <lua5.3/lualib.h>
#- include <lua5.3/lauxlib.h>
*/

/*  */

/* lua_CFunction prototypes */

const nhcore_call_names = static_array("nhcore_call_names", ptr_to(char), NUM_NHCORE_CALLS, [
    _("start_new_game"),
    _("restore_old_game"),
    _("moveloop_turn"),
    _("game_exit"),
    _("getpos_tip"),
    _("enter_tutorial"),
    _("leave_tutorial"),
]);
const nhcore_call_available = static_array("nhcore_call_available", schar, NUM_NHCORE_CALLS);

/* internal structure that hangs off L->ud (but use lua_getallocf() )
 * Note that we use it for both memory use tracking and instruction counting.
 */
 const struct_nhl_user_data = struct("struct_nhl_user_data", {
    L: ptr_to("struct_lua_State"),
    flags: unsigned,

    memlimit: unsigned,

    steps: unsigned,
    osteps: unsigned,
    perpcall: unsigned,

    statctr: unsigned,
    sid: int,
    name: ptr_to(char),

    jb: jmp_buf,
});

const luapat = static_var("luapat", ptr_to("struct_lua_State"));   /* instance for file pattern matching */

export function l_nhcore_init() { /* void */
    const $frame = stack_frame(); try {
    let sbi = init_list(stack_struct(struct_nhl_sandbox_info), { flags: NHL_SB_SAFE, memlimit: 1 * 1024 * 1024, steps: 0,
                             perpcall: 1 * 1024 * 1024 });

    if ((gl.luacore = addr_of(nhl_init(sbi))) != 0) {
        if (!nhl_loadlua(view_of(struct_lua_State, gl.luacore), _("nhcore.lua"))) {
            gl.luacore = null;
        } else {
            let i;

            for (i = 0; i < NUM_NHCORE_CALLS; i++)
                chars[nhcore_call_available + i] = TRUE;
        }
    } else
        impossible(_("l_nhcore_init failed"));
    } finally { stack_pop($frame); }
}

export function l_nhcore_done() { /* void */
    if (gl.luacore) {
        nhl_done(view_of(struct_lua_State, gl.luacore));
        gl.luacore = 0;
    }
    end_luapat();
}

export function l_nhcore_call(callidx) { /* void */
    let ltyp;

    if (callidx < 0 || callidx >= NUM_NHCORE_CALLS || !gl.luacore
        || !chars[nhcore_call_available + callidx])
        return;

    lua_getglobal(view_of(struct_lua_State, gl.luacore), _("nhcore"));
    if (!lua_istable(view_of(struct_lua_State, gl.luacore), -1)) {
        /*impossible("nhcore is not a lua table");*/
        nhl_done(view_of(struct_lua_State, gl.luacore));
        gl.luacore = 0;
        return;
    }

    lua_getfield(view_of(struct_lua_State, gl.luacore), -1, nhcore_call_names[callidx]);
    ltyp = lua_type(view_of(struct_lua_State, gl.luacore), -1);
    if (ltyp == LUA_TFUNCTION) {
        nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 0, 1, _("l_nhcore_call"), NHLpa_panic);
    } else {
        /*impossible("nhcore.%s is not a lua function",
          nhcore_call_names[callidx]);*/
        chars[nhcore_call_available + callidx] = FALSE;
    }
}

 export function nhl_error(L, msg) { /* void */
    const $frame = stack_frame(); try {
    let ar = stack_struct(struct_lua_Debug);
    let buf = stack_array(char, BUFSZ * 2);

    lua_getstack(L, 1, ar);
    lua_getinfo(L, _("lS"), ar);
    sprintf(buf, _("%s (line %d "), msg, ar.currentline);
    sprintf(eos(buf), _("%.*s)"), int((unsigned(sizeof(array_of(char, BUFSZ * 2)) - unsigned(strlen(buf) + sizeof_string(")"))))), ar.short_src)

; /* (used to be 'ar.source' here) */
    lua_pushstring(L, buf);

    lua_error(L);
    /*NOTREACHED*/
    } finally { stack_pop($frame); }
}

/* Check that parameters are nothing but single table,
   or if no parameters given, put empty table there */
export function lcheck_param_table(L) { /* void */
    let argc = lua_gettop(L);

    if (argc < 1)
        lua_createtable(L, 0, 0);

    /* discard any extra arguments passed in */
    lua_settop(L, 1);

    luaL_checktype(L, 1, LUA_TTABLE);
}

export function get_table_mapchr(L, name) { /* schar */
    let ter;
    let typ;

    ter = get_table_str(L, name);
    typ = check_mapchr(ter);
    if (typ == INVALID_TYPE)
        nhl_error(L, _("Erroneous map char"));
    if (ter)
        free(ter);
    return typ;
}

export function get_table_mapchr_opt(L, name, defval) { /* schar */
    let ter;
    let typ;

    ter = get_table_str_opt(L, name, emptystr);
    if (ter && chars[ter]) {
        typ = check_mapchr(ter);
        if (typ == INVALID_TYPE)
            nhl_error(L, _("Erroneous map char"));
    } else
        typ = defval;
    if (ter)
        free(ter);
    return typ;
}

export function nhl_get_timertype(L, idx) { /* short */
    /* these are in the same order as enum timeout_types in timeout.h and
       ttable timeout_funcs[] in timeout.c, although not spelled the same */
    let timerstr = static_array("nhl_get_timertype.timerstr", ptr_to(char), NUM_TIME_FUNCS + 1, [
        _("rot-organic"), _("rot-corpse"), _("revive-mon"),    _("zombify-mon"),
        _("burn-obj"),    _("hatch-egg"),  _("fig-transform"), _("shrink-glob"),
        _("melt-ice"),    0
    ]);
    let ret = luaL_checkoption(L, idx, 0, timerstr);

    if (ret < 0 || ret >= NUM_TIME_FUNCS)
        nhl_error(L, _("Unknown timer type"));
    return ret;
}

export function nhl_add_table_entry_int(L, name, value) { /* void */
    lua_pushstring(L, name);
    lua_pushinteger(L, value);
    lua_rawset(L, -3);
}

export function nhl_add_table_entry_char(L, name, value) { /* void */
    const $frame = stack_frame(); try {
    let buf = stack_array(char, 2);
    sprintf(buf, _("%c"), value);
    lua_pushstring(L, name);
    lua_pushstring(L, buf);
    lua_rawset(L, -3);
    } finally { stack_pop($frame); }
}

export function nhl_add_table_entry_str(L, name, value) { /* void */
    lua_pushstring(L, name);
    lua_pushstring(L, value);
    lua_rawset(L, -3);
}
export function nhl_add_table_entry_bool(L, name, value) { /* void */
    lua_pushstring(L, name);
    lua_pushboolean(L, value);
    lua_rawset(L, -3);
}

export function nhl_add_table_entry_region(L, name, x1,
                           y1, x2, y2) { /* void */
    lua_pushstring(L, name);
    lua_newtable(L);
    nhl_add_table_entry_int(L, _("x1"), x1);
    nhl_add_table_entry_int(L, _("y1"), y1);
    nhl_add_table_entry_int(L, _("x2"), x2);
    nhl_add_table_entry_int(L, _("y2"), y2);
    lua_rawset(L, -3);
}

/* converting from special level "map character" to levl location type
   and back. order here is important. */
  const struct___anon1 = struct("nhlua.struct___anon1", {
    ch: char,
    typ: schar,
}); const char2typ = static_array("char2typ", struct___anon1, null, [
                { ch: ord(' '), typ: STONE },
                { ch: ord('#'), typ: CORR },
                { ch: ord('.'), typ: ROOM },
                { ch: ord('-'), typ: HWALL },
                { ch: ord('-'), typ: TLCORNER },
                { ch: ord('-'), typ: TRCORNER },
                { ch: ord('-'), typ: BLCORNER },
                { ch: ord('-'), typ: BRCORNER },
                { ch: ord('-'), typ: CROSSWALL },
                { ch: ord('-'), typ: TUWALL },
                { ch: ord('-'), typ: TDWALL },
                { ch: ord('-'), typ: TLWALL },
                { ch: ord('-'), typ: TRWALL },
                { ch: ord('-'), typ: DBWALL },
                { ch: ord('|'), typ: VWALL },
                { ch: ord('+'), typ: DOOR },
                { ch: ord('A'), typ: AIR },
                { ch: ord('C'), typ: CLOUD },
                { ch: ord('S'), typ: SDOOR },
                { ch: ord('H'), typ: SCORR },
                { ch: ord('{'), typ: FOUNTAIN },
                { ch: ord('\\'), typ: THRONE },
                { ch: ord('K'), typ: SINK },
                { ch: ord('}'), typ: MOAT },
                { ch: ord('P'), typ: POOL },
                { ch: ord('L'), typ: LAVAPOOL },
                { ch: ord('Z'), typ: LAVAWALL },
                { ch: ord('I'), typ: ICE },
                { ch: ord('W'), typ: WATER },
                { ch: ord('T'), typ: TREE },
                { ch: ord('F'), typ: IRONBARS }, /* Fe = iron */
                { ch: ord('x'), typ: MAX_TYPE }, /* "see-through" */
                { ch: ord('B'), typ: CROSSWALL }, /* hack: boundary location */
                { ch: ord('w'), typ: MATCH_WALL }, /* IS_STWALL() */
                { ch: ord('\0'), typ: STONE },
]);

export function splev_chr2typ(c) { /* schar */
    let i;

    for (i = 0; char2typ[i].ch; i++)
        if (c == char2typ[i].ch)
            return char2typ[i].typ;
    return INVALID_TYPE;
}

export function check_mapchr(s) { /* schar */
    if (s && strlen(s) == 1)
        return splev_chr2typ(chars[s + 0]);
    return INVALID_TYPE;
}

function splev_typ2chr(typ) { /* char */
    let i;

    for (i = 0; char2typ[i].typ < MAX_TYPE; i++)
        if (typ == char2typ[i].typ)
            return char2typ[i].ch;
    return ord('x');
}

/* local t = nh.gettrap(x,y); */
/* local t = nh.gettrap({ x = 10, y = 10 }); */
function nhl_gettrap(L) { /* int */
    const $frame = stack_frame(); try {
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("Incorrect arguments"));
        /*NOTREACHED*/
        return 0;
    }
    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (isok(x[0], y[0])) {
        let ttmp = t_at(x[0], y[0]);

        if (ttmp) {
            lua_newtable(L);

            nhl_add_table_entry_int(L, _("tx"), ttmp.tx);
            nhl_add_table_entry_int(L, _("ty"), ttmp.ty);
            nhl_add_table_entry_int(L, _("ttyp"), ttmp.ttyp);
            nhl_add_table_entry_str(L, _("ttyp_name"),
                                    get_trapname_bytype(ttmp.ttyp));
            nhl_add_table_entry_bool(L, _("tseen"), ttmp.tseen);
            nhl_add_table_entry_bool(L, _("madeby_u"), ttmp.madeby_u);
            nhl_add_table_entry_bool(L, _("once"), ttmp.once);
            switch (ttmp.ttyp) {
            case SQKY_BOARD:
                nhl_add_table_entry_int(L, _("tnote"), ttmp.vl.v_tnote);
                break;
            case ROLLING_BOULDER_TRAP:
                nhl_add_table_entry_int(L, _("launchx"), ttmp.launch.x);
                nhl_add_table_entry_int(L, _("launchy"), ttmp.launch.y);
                nhl_add_table_entry_int(L, _("launch2x"), ttmp.vl.v_launch2.x);
                nhl_add_table_entry_int(L, _("launch2y"), ttmp.vl.v_launch2.y);
                break;
            case PIT:
            case SPIKED_PIT:
                nhl_add_table_entry_int(L, _("conjoined"), ttmp.vl.v_conjoined);
                break;
            }
            return 1;
        } else {
            nhl_error(L, _("No trap at location"));
        }
    } else {
        nhl_error(L, _("Coordinates out of range"));
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* nh.deltrap(x,y); nh.deltrap({ x = 10, y = 15 }); */
function nhl_deltrap(L) { /* int */
    const $frame = stack_frame(); try {
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("Incorrect arguments"));
        /*NOTREACHED*/
        return 0;
    }
    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (isok(x[0], y[0])) {
        let ttmp = t_at(x[0], y[0]);

        if (ttmp)
            deltrap(ttmp);
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* get parameters (XX,YY) or ({ x = XX, y = YY }) or ({ XX, YY }),
   and set the x and y values.
   return TRUE if there are such params in the stack.
   Note that this does not adjust the values of x and y at all from what is
   specified in the level file; so, it returns absolute coordinates rather
   than map-relative coordinates. Callers of this function must decide if
   they want to interpret the values as absolute or as map-relative, and
   adjust accordingly.
 */
export function nhl_get_xy_params(L, x, y) { /* boolean */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let ret = FALSE;

    if (argc == 2) {
        x[0] = lua_tointeger(L, 1);
        y[0] = lua_tointeger(L, 2);
        ret = TRUE;
    } else if (argc == 1 && lua_type(L, 1) == LUA_TTABLE) {
        let ax = stack_var(lua_Integer), ay = stack_var(lua_Integer);

        ret = get_coord(L, 1, ax, ay);
        x[0] = ax[0];
        y[0] = ay[0];
    }
    return ret;
    } finally { stack_pop($frame); }
}

/* local loc = nh.getmap(x,y); */
/* local loc = nh.getmap({ x = 10, y = 35 }); */
function nhl_getmap(L) { /* int */
    const $frame = stack_frame(); try {
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("Incorrect arguments"));
        return 0;
    }
    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (isok(x[0], y[0])) {
        let buf = stack_array(char, BUFSZ);
        lua_newtable(L);

        /* FIXME: some should be boolean values */
        nhl_add_table_entry_int(L, _("glyph"), levl()[x[0]][y[0]].glyph);
        nhl_add_table_entry_int(L, _("typ"), levl()[x[0]][y[0]].typ);
        nhl_add_table_entry_str(L, _("typ_name"),
                                levltyp_to_name(levl()[x[0]][y[0]].typ));
        sprintf(buf, _("%c"), splev_typ2chr(levl()[x[0]][y[0]].typ));
        nhl_add_table_entry_str(L, _("mapchr"), buf);
        nhl_add_table_entry_int(L, _("seenv"), levl()[x[0]][y[0]].seenv);
        nhl_add_table_entry_bool(L, _("horizontal"), levl()[x[0]][y[0]].horizontal);
        nhl_add_table_entry_bool(L, _("lit"), levl()[x[0]][y[0]].lit);
        nhl_add_table_entry_bool(L, _("waslit"), levl()[x[0]][y[0]].waslit);
        nhl_add_table_entry_int(L, _("roomno"), levl()[x[0]][y[0]].roomno);
        nhl_add_table_entry_bool(L, _("edge"), levl()[x[0]][y[0]].edge);
        nhl_add_table_entry_bool(L, _("candig"), levl()[x[0]][y[0]].candig);

        nhl_add_table_entry_bool(L, _("has_trap"), t_at(x[0], y[0]) ? 1 : 0);

        /* TODO: FIXME: levl[x][y].flags */

        lua_pushstring(L, _("flags"));
        lua_newtable(L);

        if (IS_DOOR(levl()[x[0]][y[0]].typ)) {
            nhl_add_table_entry_bool(L, _("nodoor"),
                                     +(levl()[x[0]][y[0]].flags == D_NODOOR));
            nhl_add_table_entry_bool(L, _("broken"),
                                     (levl()[x[0]][y[0]].flags & D_BROKEN));
            nhl_add_table_entry_bool(L, _("isopen"),
                                     (levl()[x[0]][y[0]].flags & D_ISOPEN));
            nhl_add_table_entry_bool(L, _("closed"),
                                     (levl()[x[0]][y[0]].flags & D_CLOSED));
            nhl_add_table_entry_bool(L, _("locked"),
                                     (levl()[x[0]][y[0]].flags & D_LOCKED));
            nhl_add_table_entry_bool(L, _("trapped"),
                                     (levl()[x[0]][y[0]].flags & D_TRAPPED));
        } else if (IS_ALTAR(levl()[x[0]][y[0]].typ)) {
            /* TODO: bits 0, 1, 2 */
            nhl_add_table_entry_bool(L, _("shrine"),
                                     (levl()[x[0]][y[0]].flags & AM_SHRINE));
        } else if (IS_THRONE(levl()[x[0]][y[0]].typ)) {
            nhl_add_table_entry_bool(L, _("looted"),
                                     (levl()[x[0]][y[0]].flags & T_LOOTED));
        } else if (levl()[x[0]][y[0]].typ == TREE) {
            nhl_add_table_entry_bool(L, _("looted"),
                                     (levl()[x[0]][y[0]].flags & TREE_LOOTED));
            nhl_add_table_entry_bool(L, _("swarm"),
                                     (levl()[x[0]][y[0]].flags & TREE_SWARM));
        } else if (IS_FOUNTAIN(levl()[x[0]][y[0]].typ)) {
            nhl_add_table_entry_bool(L, _("looted"),
                                     (levl()[x[0]][y[0]].flags & F_LOOTED));
            nhl_add_table_entry_bool(L, _("warned"),
                                     (levl()[x[0]][y[0]].flags & F_WARNED));
        } else if (IS_SINK(levl()[x[0]][y[0]].typ)) {
            nhl_add_table_entry_bool(L, _("pudding"),
                                     (levl()[x[0]][y[0]].flags & S_LPUDDING));
            nhl_add_table_entry_bool(L, _("dishwasher"),
                                     (levl()[x[0]][y[0]].flags & S_LDWASHER));
            nhl_add_table_entry_bool(L, _("ring"), (levl()[x[0]][y[0]].flags & S_LRING));
        }
        /* TODO: drawbridges, walls, ladders, room=>ICED_xxx */

        lua_settable(L, -3);

        return 1;
    } else {
        /* TODO: return zerorm instead? */
        nhl_error(L, _("Coordinates out of range"));
        return 0;
    }
    } finally { stack_pop($frame); }
}

/* impossible("Error!") */
function nhl_impossible(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        impossible(_("%s"), luaL_checkstring(L, 1));
    else
        nhl_error(L, _("Wrong args"));
    return 0;
}

/* pline("It hits!") */
/* pline("It hits!", true) */
function nhl_pline(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1 || argc == 2) {
        pline(_("%s"), luaL_checkstring(L, 1));
        if (lua_toboolean(L, 2))
            display_nhwindow()(WIN_MESSAGE, TRUE); /* --more-- */
    } else
        nhl_error(L, _("Wrong args"));

    return 0;
}

/* verbalize("Fool!") */
function nhl_verbalize(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        verbalize(_("%s"), luaL_checkstring(L, 1));
    else
        nhl_error(L, _("Wrong args"));

    return 0;
}

/* parse_config("OPTIONS=!color") */
function nhl_parse_config(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        parse_conf_str(luaL_checkstring(L, 1), parse_config_line);
    else
        nhl_error(L, _("Wrong args"));

    return 0;
}

/* local windowtype = get_config("windowtype"); */
function nhl_get_config(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        lua_pushstring(L, get_option_value(luaL_checkstring(L, 1), TRUE));
        return 1;
    } else
        nhl_error(L, _("Wrong args"));

    return 0;
}

/*
  str = getlin("What do you want to call this dungeon level?");
 */
function nhl_getlin(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc == 1) {
        let prompt = luaL_checkstring(L, 1);
        let buf = stack_array(char, BUFSZ);

        getlin(prompt, buf);
        lua_pushstring(L, buf);
        return 1;
    }

    nhl_error(L, _("Wrong args"));
    /*NOTREACHED*/
    return 0;
    } finally { stack_pop($frame); }
}

/*
 selected = menu("prompt",default,pickX,{"a"="option a", "b"="option b",...})
 pickX = 0,1,2, or "none", "one", "any" (PICK_X in code)

 selected = menu("prompt", default, pickX,
                 {{key:"a", text:"option a"},{key:"b", text:"option b"},... })
 */
function nhl_menu(L) { /* int */
    const $frame = stack_frame(); try {
    let pickX = static_array("nhl_menu.pickX", ptr_to(char), null, [ _("none"), _("one"), _("any") ]); /* PICK_x */
    let argc = lua_gettop(L);
    let prompt;
    let defval = _("");
    let pick = PICK_ONE, pick_cnt;
    let tmpwin;
    let any = stack_struct(struct_any);
    let picks = stack_var(ptr_to(struct_mi), null);
    let clr = NO_COLOR;

    if (argc < 2 || argc > 4) {
        nhl_error(L, _("Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    prompt = luaL_checkstring(L, 1);
    if (lua_isstring(L, 2))
        defval = luaL_checkstring(L, 2);
    if (lua_isstring(L, 3))
        pick = luaL_checkoption(L, 3, _("one"), pickX);
    luaL_checktype(L, argc, LUA_TTABLE);

    tmpwin = create_nhwindow()(NHW_MENU);
    start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

    lua_pushnil(L); /* first key */
    while (lua_next(L, argc) != 0) {
        let str = _("");
        let key = _("");

        /* key @ index -2, value @ index -1 */
        if (lua_istable(L, -1)) {
            lua_pushstring(L, _("key"));
            lua_gettable(L, -2);
            key = lua_tostring(L, -1);
            lua_pop(L, 1);

            lua_pushstring(L, _("text"));
            lua_gettable(L, -2);
            str = lua_tostring(L, -1);
            lua_pop(L, 1);

            /* TODO: glyph, attr, accel, group accel (all optional) */
        } else if (lua_isstring(L, -1)) {
            str = luaL_checkstring(L, -1);
            key = luaL_checkstring(L, -2);
        }

        struct_assign(any, cg.zeroany);
        if (chars[key])
            any.a_char = chars[key + 0];
        add_menu(tmpwin, nul_glyphinfo, any, 0, 0, ATR_NONE, clr, str,
                 (chars[defval] && chars[key] && chars[defval + 0] == chars[key + 0])
                     ? MENU_ITEMFLAGS_SELECTED
                     : MENU_ITEMFLAGS_NONE);

        lua_pop(L, 1); /* removes 'value'; keeps 'key' for next iteration */
    }

    end_menu()(tmpwin, prompt);
    pick_cnt = select_menu(tmpwin, pick, picks);
    destroy_nhwindow()(tmpwin);

    if (pick_cnt > 0) {
        let buf = stack_array(char, 2);
        chars[buf + 0] = ptr_add(picks[0], 0).item.a_char;

        if (pick == PICK_ONE && pick_cnt > 1 && chars[defval]
            && chars[defval + 0] == ptr_add(picks[0], 0).item.a_char)
            chars[buf + 0] = ptr_add(picks[0], 1).item.a_char;

        chars[buf + 1] = ord('\0');
        lua_pushstring(L, buf);
        /* TODO: pick any */
    } else {
        let buf = stack_array(char, 2);
        chars[buf + 0] = chars[defval + 0];
        chars[buf + 1] = ord('\0');
        lua_pushstring(L, buf);
    }

    return 1;
    } finally { stack_pop($frame); }
}

/* text("foo\nbar\nbaz") */
function nhl_text(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc > 0) {
        let picks = stack_var(ptr_to(struct_mi), null);
        let tmpwin;

        tmpwin = create_nhwindow()(NHW_MENU);
        start_menu()(tmpwin, MENU_BEHAVE_STANDARD);

        while (lua_gettop(L) > 0) {
            let ostr = dupstr(luaL_checkstring(L, 1));
            let ptr, str = ostr;
            let lstr = str + strlen(str) - 1;

            do {
                let nlp = strchr(str, ord('\n'));

                if (nlp && (nlp - str) <= 76) {
                    ptr = nlp;
                } else {
                    ptr = str + 76;
                    if (ptr > lstr)
                        ptr = lstr;
                }
                while ((ptr > str) && !(chars[ptr] == ord(' ') || chars[ptr] == ord('\n')))
                    ptr--;
                chars[ptr] = ord('\0');
                add_menu_str(tmpwin, str);
                str = ptr + 1;
            } while (chars[str] && str <= lstr);
            lua_pop(L, 1);
            free(ostr);
        }

        end_menu()(tmpwin, 0);
        select_menu(tmpwin, PICK_NONE, picks);
        destroy_nhwindow()(tmpwin);
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* makeplural("zorkmid") */
function nhl_makeplural(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        lua_pushstring(L, makeplural(luaL_checkstring(L, 1)));
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* makesingular("zorkmids") */
function nhl_makesingular(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        lua_pushstring(L, makesingular(luaL_checkstring(L, 1)));
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* s_suffix("foo") */
function nhl_s_suffix(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        lua_pushstring(L, s_suffix(luaL_checkstring(L, 1)));
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* ing_suffix("foo") */
function nhl_ing_suffix(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        lua_pushstring(L, ing_suffix(luaL_checkstring(L, 1)));
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* an("foo") */
function nhl_an(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1)
        lua_pushstring(L, an(luaL_checkstring(L, 1)));
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* rn2(10) */
function nhl_lua_rnglog_ctx_enabled() { /* boolean */
    let enabled = static_var("nhl_lua_rnglog_ctx_enabled.enabled", int, -1);
    let env;
    let rnglog;

    if (enabled[0] >= 0)
        return enabled[0] ? TRUE : FALSE;

    env = getenv(_("NETHACK_LUA_RNGLOG_CTX"));
    if (env) {
        enabled[0] = (chars[env] && strcmp(env, _("0"))) ? 1 : 0;
        return enabled[0] ? TRUE : FALSE;
    }

    /* Harness default: when RNG logging is active, include Lua callsites. */
    rnglog = getenv(_("NETHACK_RNGLOG"));
    enabled[0] = (rnglog && chars[rnglog]) ? 1 : 0;
    return enabled[0] ? TRUE : FALSE;
}

function nhl_rnglog_set_lua_caller(L, fallback) { /* void */
    const $frame = stack_frame(); try {
    /* Static buffers are safe here because this helper is used
       synchronously for a single Lua->C->RNG call path and is not
       expected to be re-entrant. */
    let rnglog_srcbuf = static_array("nhl_rnglog_set_lua_caller.rnglog_srcbuf", char, BUFSZ);
    let rnglog_namebuf = static_array("nhl_rnglog_set_lua_caller.rnglog_namebuf", char, BUFSZ);
    let rnglog_name1buf = static_array("nhl_rnglog_set_lua_caller.rnglog_name1buf", char, BUFSZ);
    let rnglog_src1buf = static_array("nhl_rnglog_set_lua_caller.rnglog_src1buf", char, BUFSZ);
    let rnglog_src2buf = static_array("nhl_rnglog_set_lua_caller.rnglog_src2buf", char, BUFSZ);
    let rnglog_parentbuf = static_array("nhl_rnglog_set_lua_caller.rnglog_parentbuf", char, BUFSZ);
    let ar = stack_struct(struct_lua_Debug);
    let ar2 = stack_struct(struct_lua_Debug);
    let src = rnglog_srcbuf;
    let line = 0, line1 = 0, line2 = 0;
    let name = fallback;
    let name1 = fallback;
    let name2 = _("lua");
    let have1 = FALSE, have2 = FALSE;

    if (!nhl_lua_rnglog_ctx_enabled())
        return;

    Snprintf(rnglog_srcbuf, sizeof(array_of(char, BUFSZ)), _("%s"), _("lua"));
    Snprintf(rnglog_src1buf, sizeof(array_of(char, BUFSZ)), _("%s"), _("lua"));
    Snprintf(rnglog_src2buf, sizeof(array_of(char, BUFSZ)), _("%s"), _("lua"));

    if (lua_getstack(L, 1, ar) && lua_getinfo(L, _("nSl"), ar)) {
        if (ar.short_src && chars[ar.short_src]) {
            let src_start = ar.short_src;
            let src_len = strlen(ar.short_src);

            /* Lua string chunks render as [string "(name.lua)"].
               Normalize to plain "name.lua" for readable RNG logs. */
            if (src_len >= 11
                && !strncmp(src_start, _("[string \""), 9)
                && chars[src_start + unsigned(src_len - 2)] == ord('"')
                && chars[src_start + unsigned(src_len - 1)] == ord(']')) {
                src_start += 9;
                src_len = unsigned(src_len - 11);
            }
            if (src_len >= 1 && chars[src_start + 0] == ord('@')) {
                src_start++;
                src_len--;
            }
            if (src_len >= 2
                && chars[src_start + 0] == ord('(')
                && chars[src_start + unsigned(src_len - 1)] == ord(')')) {
                src_start++;
                src_len = unsigned(src_len - 2);
            }
            Snprintf(rnglog_src1buf, sizeof(array_of(char, BUFSZ)), _("%.*s"), int(src_len), src_start)
;
        }
        line1 = ar.currentline;
        if (ar.name && chars[ar.name]
            && ((chars[ar.name + 0] >= ord('A') && chars[ar.name + 0] <= ord('Z'))
                || (chars[ar.name + 0] >= ord('a') && chars[ar.name + 0] <= ord('z'))
                || chars[ar.name + 0] == ord('_'))) {
            Snprintf(rnglog_name1buf, sizeof(array_of(char, BUFSZ)), _("%s"), ar.name);
            name1 = rnglog_name1buf;
        }
        have1 = TRUE;
    }

    if (lua_getstack(L, 2, ar2) && lua_getinfo(L, _("nSl"), ar2)) {
        if (ar2.short_src && chars[ar2.short_src]) {
            let src_start = ar2.short_src;
            let src_len = strlen(ar2.short_src);

            if (src_len >= 11
                && !strncmp(src_start, _("[string \""), 9)
                && chars[src_start + unsigned(src_len - 2)] == ord('"')
                && chars[src_start + unsigned(src_len - 1)] == ord(']')) {
                src_start += 9;
                src_len = unsigned(src_len - 11);
            }
            if (src_len >= 1 && chars[src_start + 0] == ord('@')) {
                src_start++;
                src_len--;
            }
            if (src_len >= 2
                && chars[src_start + 0] == ord('(')
                && chars[src_start + unsigned(src_len - 1)] == ord(')')) {
                src_start++;
                src_len = unsigned(src_len - 2);
            }
            Snprintf(rnglog_src2buf, sizeof(array_of(char, BUFSZ)), _("%.*s"), int(src_len), src_start)
;
        }
        line2 = ar2.currentline;
        if (ar2.name && chars[ar2.name]
            && ((chars[ar2.name + 0] >= ord('A') && chars[ar2.name + 0] <= ord('Z'))
                || (chars[ar2.name + 0] >= ord('a') && chars[ar2.name + 0] <= ord('z'))
                || chars[ar2.name + 0] == ord('_'))) {
            Snprintf(rnglog_parentbuf, sizeof(array_of(char, BUFSZ)), _("%s"), ar2.name);
            name2 = rnglog_parentbuf;
        }
        have2 = TRUE;
    }

    if (have2) {
        src = rnglog_src2buf;
        line = line2;
        if (have1) {
            Snprintf(rnglog_namebuf, sizeof(array_of(char, BUFSZ)), _("%s src=%s:%d parent=%s"), name1, rnglog_src1buf, line1, name2)

;
            name = rnglog_namebuf;
        } else {
            name = name2;
        }
    } else if (have1) {
        src = rnglog_src1buf;
        line = line1;
        name = name1;
    }
    rng_log_set_caller(src, line, name);
    } finally { stack_pop($frame); }
}

/* rn2(10) */
function nhl_rn2(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let range = int(luaL_checkinteger(L, 1));
        nhl_rnglog_set_lua_caller(L, _("nh.rn2"));
        lua_pushinteger(L, rn2(range));
    }
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* random(10);  -- is the same as rn2(10); */
/* random(5,8); -- same as 5 + rn2(8); */
function nhl_random(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let range = int(luaL_checkinteger(L, 1));
        nhl_rnglog_set_lua_caller(L, _("nh.random"));
        lua_pushinteger(L, rn2(range));
    } else if (argc == 2) {
        let base = int(luaL_checkinteger(L, 1));
        let range = int(luaL_checkinteger(L, 2));
        nhl_rnglog_set_lua_caller(L, _("nh.random"));
        lua_pushinteger(L, base + rn2(range));
    }
    else
        nhl_error(L, _("Wrong args"));

    return 1;
}

/* level_difficulty() */
function nhl_level_difficulty(L) { /* int */
    let argc = lua_gettop(L);
    if (argc == 0) {
        lua_pushinteger(L, level_difficulty());
    } else {
        nhl_error(L, _("level_difficulty should not have any args"));
    }
    return 1;
}

/* local x = nh.is_genocided("vampire") */
function nhl_is_genocided(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc == 1) {
        let paramstr = luaL_checkstring(L, 1);
        let mgend = stack_var(int);
        let i = name_to_mon(paramstr, mgend);

        lua_pushboolean(L, (i != NON_PM)
                        && (svm.mvitals[i].mvflags & G_GENOD)
                        ? TRUE : FALSE);
    } else {
        nhl_error(L, _("Wrong args"));
    }
    return 1;
    } finally { stack_pop($frame); }
}

/* local debug_themerm = nh.debug_themerm(isfill)
 * if isfill is false, returns value of env variable THEMERM
 * if isfill is true,  returns value of env variable THEMERMFILL
 * return nil if not in wizard mode or the variable isn't set */
function nhl_get_debug_themerm_name(L) { /* int */
    let argc = lua_gettop(L);
    if (argc == 1) {
        let dbg_themerm = 0;
        let is_fill = lua_toboolean(L, 1);
        lua_pop(L, 1);
        if (wizard())
            dbg_themerm = getenv(is_fill ? _("THEMERMFILL") : _("THEMERM"));
        if (!dbg_themerm || !chars[dbg_themerm]) {
            lua_pushnil(L);
        } else {
            lua_pushstring(L, dbg_themerm);
        }
    } else {
        nhl_error(L, _("debug_themerm should have 1 boolean arg"));
    }
    return 1;
}

/* get mandatory integer value from table */
export function get_table_int(L, name) { /* int */
    let ret;

    lua_getfield(L, -1, name);
    ret = int(luaL_checkinteger(L, -1));
    lua_pop(L, 1);
    return ret;
}

/* get optional integer value from table */
export function get_table_int_opt(L, name, defval) { /* int */
    let ret = defval;

    lua_getfield(L, -1, name);
    if (!lua_isnil(L, -1)) {
        ret = int(luaL_checkinteger(L, -1));
    }
    lua_pop(L, 1);
    return ret;
}

export function get_table_str(L, name) { /* char * */
    let ret;

    lua_getfield(L, -1, name);
    ret = dupstr(luaL_checkstring(L, -1));
    lua_pop(L, 1);
    return ret;
}

/* get optional string value from table.
   return value must be freed by caller. */
export function get_table_str_opt(L, name, defval) { /* char * */
    let ret;
    let ltyp;

    lua_getfield(L, -1, name);
    ltyp = lua_type(L, -1);
    if (ltyp == LUA_TSTRING || ltyp == LUA_TNIL) {
        ret = luaL_optstring(L, -1, defval);
    } else if (ltyp == LUA_TFUNCTION) {
        nhl_pcall_handle(L, 0, 1, _("get_table_str_opt"), NHLpa_panic);
        ret = luaL_optstring(L, -1, defval);
    } else {
        nhl_error(L, _("get_table_str_opt: no string"));
    }
    if (ret) {
        lua_pop(L, 1);
        return dupstr(ret);
    }
    lua_pop(L, 1);
    return 0;
}

export function get_table_boolean(L, name) { /* int */
    let boolstr = static_array("get_table_boolean.boolstr", ptr_to(char), null, [
        _("true"), _("false"), _("yes"), _("no"), 0
    ]);
    /* static const int boolstr2i[] = { TRUE, FALSE, TRUE, FALSE, -1 }; */
    let ltyp;
    let ret = -1;

    lua_getfield(L, -1, name);
    ltyp = lua_type(L, -1);
    if (ltyp == LUA_TSTRING) {
        ret = luaL_checkoption(L, -1, 0, boolstr);
        /* nhUse(boolstr2i[0]); */
    } else if (ltyp == LUA_TBOOLEAN) {
        ret = lua_toboolean(L, -1);
    } else if (ltyp == LUA_TNUMBER) {
        ret = int(luaL_checkinteger(L, -1));
        if (ret < 0 || ret > 1)
            ret = -1;
    }
    lua_pop(L, 1);
    if (ret == -1)
        nhl_error(L, _("Expected a boolean"));
    return ret;
}

export function get_table_boolean_opt(L, name, defval) { /* int */
    let ret = defval;

    lua_getfield(L, -1, name);
    if (lua_type(L, -1) != LUA_TNIL) {
        lua_pop(L, 1);
        return get_table_boolean(L, name);
    }
    lua_pop(L, 1);
    return ret;
}

/* opts[] is a null-terminated list */
export function get_table_option(L,
                 name,
                 defval,
                 opts) { /* int */
    let ret;

    lua_getfield(L, -1, name);
    ret = luaL_checkoption(L, -1, defval, opts);
    lua_pop(L, 1);
    return ret;
}

/* #ifdef DUMPLOG: not in this build */

/* local dungeon_name = dnum_name(u.dnum); */
function nhl_dnum_name(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let dnum = luaL_checkinteger(L, 1);

        if (dnum >= 0 && dnum < svn.n_dgns)
            lua_pushstring(L, svd.dungeons[dnum].dname);
        else
            lua_pushstring(L, _(""));
    } else
        nhl_error(L, _("Expected an integer parameter"));
    return 1;
}

/* return gender-neutral monster type name by integer value,
   or empty string if outside LOW_PM - HIGH_PM range */
/* local montypename = int_to_pmname(12); */
function nhl_int_to_pm_name(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let i = luaL_checkinteger(L, 1);

        if (i >= LOW_PM && i <= HIGH_PM)
            lua_pushstring(L, mons[i].pmnames[NEUTRAL]);
        else
            lua_pushstring(L, _(""));
    } else
        nhl_error(L, _("Expected an integer parameter"));
    return 1;
}

/* convert integer to object type name and class */
/* local oname,oclass = int_to_objname(25); */
function nhl_int_to_obj_name(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc == 1) {
        let buf = stack_array(char, 8);
        let i = luaL_checkinteger(L, 1);

        if (i >= 0 && i < NUM_OBJECTS && OBJ_NAME(objects[i])) {
            lua_pushstring(L, OBJ_NAME(objects[i]));
            chars[buf + 0] = def_oc_syms[(objects[i].oc_class)].sym;
            chars[buf + 1] = ord('\0');
            lua_pushstring(L, buf);
        } else {
            lua_pushstring(L, _(""));
            lua_pushstring(L, _(""));
        }
    } else
        nhl_error(L, _("Expected an integer parameter"));
    return 2;
    } finally { stack_pop($frame); }
}

/* because nhl_error() does not return */

/* set or get variables which are saved and restored along with the game.
   nh.variable("test", 10);
   local ten = nh.variable("test"); */
function nhl_variable(L) { /* int */
    let argc = lua_gettop(L);
    let typ;
    let key;

    if (!gl.luacore) {
        panic(_("nh luacore not inited"));
        /*NOTREACHED*/
        return 0;
    }

    lua_getglobal(view_of(struct_lua_State, gl.luacore), _("nh_lua_variables"));
    if (!lua_istable(view_of(struct_lua_State, gl.luacore), -1)) {
        impossible(_("nh_lua_variables is not a lua table"));
        return 0;
    }

    if (argc == 1) {
        key = luaL_checkstring(L, 1);

        lua_getfield(view_of(struct_lua_State, gl.luacore), -1, key);
        typ = lua_type(view_of(struct_lua_State, gl.luacore), -1);
        if (typ == LUA_TSTRING)
            lua_pushstring(L, lua_tostring(view_of(struct_lua_State, gl.luacore), -1));
        else if (typ == LUA_TNIL)
            lua_pushnil(L);
        else if (typ == LUA_TBOOLEAN)
            lua_pushboolean(L, lua_toboolean(view_of(struct_lua_State, gl.luacore), -1));
        else if (typ == LUA_TNUMBER)
            lua_pushinteger(L, lua_tointeger(view_of(struct_lua_State, gl.luacore), -1));
        else if (typ == LUA_TTABLE) {
            lua_getglobal(view_of(struct_lua_State, gl.luacore), _("nh_get_variables_string"));
            lua_pushvalue(view_of(struct_lua_State, gl.luacore), -2);
            nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 1, 1, _("nhl_variable"), NHLpa_panic);
            luaL_loadstring(L, lua_tostring(view_of(struct_lua_State, gl.luacore), -1));
            nhl_pcall_handle(L, 0, 1, _("nhl_variable-1"), NHLpa_panic);
        } else
            nhl_error(L, _("Cannot get variable of that type"));
        return 1;
    } else if (argc == 2) {
        /* set nh_lua_variables[key] = value;
           nh.variable("key", value); */
        key = luaL_checkstring(L, 1);
        //pline("SETVAR:%s", key);
        typ = lua_type(L, -1);

        if (typ == LUA_TSTRING) {
            lua_pushstring(view_of(struct_lua_State, gl.luacore), lua_tostring(L, -1));
            lua_setfield(view_of(struct_lua_State, gl.luacore), -2, key);
        } else if (typ == LUA_TNIL) {
            lua_pushnil(view_of(struct_lua_State, gl.luacore));
            lua_setfield(view_of(struct_lua_State, gl.luacore), -2, key);
        } else if (typ == LUA_TBOOLEAN) {
            lua_pushboolean(view_of(struct_lua_State, gl.luacore), lua_toboolean(L, -1));
            lua_setfield(view_of(struct_lua_State, gl.luacore), -2, key);
        } else if (typ == LUA_TNUMBER) {
            lua_pushinteger(view_of(struct_lua_State, gl.luacore), lua_tointeger(L, -1));
            lua_setfield(view_of(struct_lua_State, gl.luacore), -2, key);
        } else if (typ == LUA_TTABLE) {
            lua_getglobal(L, _("nh_set_variables_string"));
            lua_pushstring(L, key);
            lua_pushvalue(L, -3); /* copy value to top */
            nhl_pcall_handle(L, 2, 1, _("nhl_variable-2"), NHLpa_panic);
            luaL_loadstring(view_of(struct_lua_State, gl.luacore), lua_tostring(L, -1));
            nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 0, 0, _("nhl_variable-3"), NHLpa_panic);
        } else
            nhl_error(L, _("Cannot set variable of that type"));
        return 0;
    } else
        nhl_error(L, _("Wrong number of arguments"));
    return 1;
}

/* return nh_lua_variable lua table as a string */
export function get_nh_lua_variables() { /* char * */
    let key = 0;

    if (!gl.luacore) {
        panic(_("nh luacore not inited"));
        /*NOTREACHED*/
        return key;
    }
    lua_getglobal(view_of(struct_lua_State, gl.luacore), _("get_variables_string"));
    if (lua_type(view_of(struct_lua_State, gl.luacore), -1) == LUA_TFUNCTION) {
        if (nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 0, 1, _("get_nh_lua_variables"),
                             NHLpa_impossible)) {
            return key;
        }
        key = dupstr(lua_tostring(view_of(struct_lua_State, gl.luacore), -1));
    }
    lua_pop(view_of(struct_lua_State, gl.luacore), 1);
    return key;
}

/* save nh_lua_variables table to file */
export function save_luadata(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let lua_data_len = stack_var(unsigned);

    let lua_data = get_nh_lua_variables(); /* note: '\0' terminated */

    if (!lua_data)
        lua_data = dupstr(emptystr);
    lua_data_len[0] = unsigned(Strlen(lua_data) + 1); /* +1: include the terminator */
    Sfo_unsigned(nhfp, lua_data_len, _("luadata-lua_data_len"));
    Sfo_char(nhfp, lua_data, _("luadata"), int(lua_data_len[0]));
    free(lua_data);
    } finally { stack_pop($frame); }
}

/* restore nh_lua_variables table from file */
export function restore_luadata(nhfp) { /* void */
    const $frame = stack_frame(); try {
    let lua_data_len = stack_var(unsigned, 0);

    let lua_data;

    sfi_unsigned(nhfp, lua_data_len, _("luadata-lua_data_len"));
    lua_data = addr_of(alloc(lua_data_len[0]));
    Sfi_char(nhfp, lua_data, _("luadata"), int(lua_data_len[0]));

    if (!gl.luacore)
        l_nhcore_init();
    luaL_loadstring(view_of(struct_lua_State, gl.luacore), lua_data);
    free(lua_data);
    nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 0, 0, _("restore_luadata"), NHLpa_panic);
    } finally { stack_pop($frame); }
}

/* local stairs = stairways(); */
function nhl_stairways(L) { /* int */
    let tmp = gs.stairs;
    let i = 1; /* lua arrays should start at 1 */

    lua_newtable(L);

    while (tmp) {
        lua_pushinteger(L, i);
        lua_newtable(L);

        nhl_add_table_entry_bool(L, _("up"), tmp.up);
        nhl_add_table_entry_bool(L, _("ladder"), tmp.isladder);
        nhl_add_table_entry_int(L, _("x"), tmp.sx);
        nhl_add_table_entry_int(L, _("y"), tmp.sy);
        nhl_add_table_entry_int(L, _("dnum"), tmp.tolev.dnum);
        nhl_add_table_entry_int(L, _("dlevel"), tmp.tolev.dlevel);

        lua_settable(L, -3);

        tmp = tmp.next;
        i++;
    }

    return 1;
}

/*
  test( { x = 123, y = 456 } );
*/
function nhl_test(L) { /* int */
    const $frame = stack_frame(); try {
    let x, y;
    let name, Player = init_string(stack_array(char, sizeof_string("Player")), _("Player"));

    /* discard any extra arguments passed in */
    lua_settop(L, 1);

    luaL_checktype(L, 1, LUA_TTABLE);

    x = coordxy(get_table_int(L, _("x")));
    y = coordxy(get_table_int(L, _("y")));
    name = get_table_str_opt(L, _("name"), Player);

    pline(_("TEST:{ x=%i, y=%i, name=\"%s\" }"), x, y, name);

    free(name);

    return 1;
    } finally { stack_pop($frame); }
}

/* push a key into command queue */
/* nh.pushkey("i"); */
function nhl_pushkey(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let key = luaL_checkstring(L, 1);

        while (chars[key]) {
            cmdq_add_key(CQ_CANNED, chars[key]);
            key++;
        }
    }

    return 0;
}

/* do a turn of moveloop, or until gm.multi is done if param is true. */
/* nh.doturn(); nh.doturn(true); */
function nhl_doturn(L) { /* int */
    let argc = lua_gettop(L);
    let domulti = FALSE;

    if (argc == 1)
        domulti = lua_toboolean(L, 1);

    do {
        moveloop_core();
    } while (domulti && gm.multi);

    return 0;
}

/* set debugging flags. debugging use only, of course. */
/* nh.debug_flags({ mongen = false,
                    hunger = false,
                    overwrite_stairs = true }); */
function nhl_debug_flags(L) { /* int */
    let val;

    lcheck_param_table(L);

    /* disable monster generation */
    val = get_table_boolean_opt(L, _("mongen"), -1);
    if (val != -1) {
        iflags.debug_mongen = +!boolean(val); /* value in lua is negated */
        if (iflags.debug_mongen) {
            let mtmp, mtmp2;

            for (mtmp = fmon(); mtmp; mtmp = mtmp2) {
                mtmp2 = mtmp.nmon;
                if (DEADMONSTER(mtmp))
                    continue;
                mongone(mtmp);
            }
        }
    }

    /* prevent hunger */
    val = get_table_boolean_opt(L, _("hunger"), -1);
    if (val != -1) {
        iflags.debug_hunger = +!boolean(val); /* value in lua is negated */
    }

    /* allow overwriting stairs */
    val = get_table_boolean_opt(L, _("overwrite_stairs"), -1);
    if (val != -1) {
        iflags.debug_overwrite_stairs = boolean(val);
    }

    /* prevent pline going out to the UI */
    val = get_table_boolean_opt(L, _("prevent_pline"), -1);
    if (val != -1) {
        iflags.debug_prevent_pline = boolean(val);
    }

    return 0;
}

/* flip level */
/* nh.flip_level(n); */
function nhl_flip_level(L) { /* int */
    let argc = lua_gettop(L);
    let flp = 0;

    if (argc == 1)
        flp = lua_tointeger(L, 1);

    flip_level(flp, +!gi.in_mklev);

    return 0;
}

/* does location at x,y have timer? */
/* local has_melttimer = nh.has_timer_at(x,y, "melt-ice"); */
/* local has_melttimer = nh.has_timer_at({x=4,y=7}, "melt-ice"); */
function nhl_timer_has_at(L) { /* int */
    const $frame = stack_frame(); try {
    let ret = FALSE;
    let timertype = nhl_get_timertype(L, -1);
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);
    let when;

    lua_pop(L, 1); /* remove timertype */
    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("nhl_timer_has_at: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (isok(x[0], y[0])) {
        when = spot_time_expires(x[0], y[0], timertype);
        ret = +(when > 0);
    }
    lua_pushboolean(L, ret);
    return 1;
    } finally { stack_pop($frame); }
}

/* when does location at x,y timer trigger? */
/* local melttime = nh.peek_timer_at(x,y, "melt-ice"); */
/* local melttime = nh.peek_timer_at({x=5,y=6}, "melt-ice"); */
function nhl_timer_peek_at(L) { /* int */
    const $frame = stack_frame(); try {
    let when = 0;
    let timertype = nhl_get_timertype(L, -1);
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    lua_pop(L, 1); /* remove timertype */
    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("nhl_timer_peek_at: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (timer_is_pos(timertype) && isok(x[0], y[0]))
        when = spot_time_expires(x[0], y[0], timertype);
    lua_pushinteger(L, when);
    return 1;
    } finally { stack_pop($frame); }
}

/* stop timer at location x,y */
/* nh.stop_timer_at(x,y, "melt-ice"); */
/* nh.stop_timer_at({x=6,y=8}, "melt-ice"); */
function nhl_timer_stop_at(L) { /* int */
    const $frame = stack_frame(); try {
    let timertype = nhl_get_timertype(L, -1);
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    lua_pop(L, 1); /* remove timertype */
    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("nhl_timer_stop_at: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (timer_is_pos(timertype) && isok(x[0], y[0]))
        spot_stop_timers(x[0], y[0], timertype);
    return 0;
    } finally { stack_pop($frame); }
}

/* start timer at location x,y */
/* nh.start_timer_at(x,y, "melt-ice", 10); */
function nhl_timer_start_at(L) { /* int */
    const $frame = stack_frame(); try {
    let timertype = nhl_get_timertype(L, -2);
    let when = lua_tointeger(L, -1);
    let lx = stack_var(lua_Integer), ly = stack_var(lua_Integer);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    lua_pop(L, 2); /* remove when and timertype */
    if (!nhl_get_xy_params(L, lx, ly)) {
        nhl_error(L, _("nhl_timer_start_at: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    x[0] = coordxy((lx[0]));
    y[0] = coordxy((ly[0]));
    cvt_to_abscoord(x, y);

    if (timer_is_pos(timertype) && isok(x[0], y[0])) {
        let where = or64(shl64((x[0]), 16), (y[0]));

        spot_stop_timers(x[0], y[0], timertype);
        start_timer(when, TIMER_LEVEL, MELT_ICE_AWAY,
                           long_to_any(where));
    }
    return 0;
    } finally { stack_pop($frame); }
}

/* returns the visual interpretation of the key bound to an extended command,
   or the ext cmd name if not bound to any key */
/* local helpkey = eckey("help"); */
function nhl_get_cmd_key(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let cmd = luaL_checkstring(L, 1);
        let key = cmd_from_ecname(cmd);

        lua_pushstring(L, key);
        return 1;
    }

    return 0;
}

/* add or remove a lua function callback */
/* callback("level_enter", "function_name"); */
/* callback("level_enter", "function_name", true); */
/* level_enter, level_leave, cmd_before */
function nhl_callback(L) { /* int */
    let argc = lua_gettop(L);
    let i;
    let rm;
    let fn, cb;

    if (!gl.luacore) {
        panic(_("nh luacore not inited"));
        /*NOTREACHED*/
        return 0;
    }
    if (argc == 2 || argc == 3) {
        if (argc == 2) {
            rm = FALSE;
            fn = luaL_checkstring(L, -1);
            cb = luaL_checkstring(L, -2);
        } else {
            rm = lua_toboolean(L, -1);
            fn = luaL_checkstring(L, -2);
            cb = luaL_checkstring(L, -3);
        }
        for (i = 0; i < NUM_NHCB; i++)
            if (!strcmp(cb, nhcb_name[i]))
                break;
        if (i >= NUM_NHCB)
            return 0;

        if (rm) {
            nhcb_counts[i]--;
            if (nhcb_counts[i] < 0)
                impossible(_("nh.callback counts are wrong"));
        } else {
            nhcb_counts[i]++;
        }

        lua_getglobal(view_of(struct_lua_State, gl.luacore), rm ? _("nh_callback_rm") : _("nh_callback_set"));
        lua_pushstring(view_of(struct_lua_State, gl.luacore), cb);
        lua_pushstring(view_of(struct_lua_State, gl.luacore), fn);
        nhl_pcall_handle(view_of(struct_lua_State, gl.luacore), 2, 0, _("nhl_callback"), NHLpa_panic);
    }
    return 0;
}

/* store or restore game state */
/*
 * Currently handles
 *   turn counter,
 *   hero inventory and hunger,
 *   hero attributes and skills and conducts (all via 'struct u'),
 *   object discoveries,
 *   monster generation and vanquished statistics.
 * NOTE: wouldn't work after restore if game has been saved, so the
 * #save command ('S') is disabled during the tutorial.
 */
/* gamestate(); -- save state */
/* gamestate(true); -- restore state */
function nhl_gamestate(L) { /* int */
    const $frame = stack_frame(); try {
    let wornmask;
    let otmp;
    let argc = lua_gettop(L);
    let reststate = (argc > 0) ? lua_toboolean(L, -1) : FALSE;
    let otyp;

    debugpline4(_("gamestate: %d:%d (%c vs %c)"), u.uz.dnum, u.uz.dlevel,
                reststate ? ord('T') : ord('F'), gg.gmst_stored ? ord('t') : ord('f'), __FILE__);

    if (reststate && gg.gmst_stored) {
        let cur_uz = struct_assign(stack_struct(struct_d_level), u.uz), cur_uz0 = struct_assign(stack_struct(struct_d_level), u.uz0);

        /* restore game state */
        svm.moves = gg.gmst_moves;
        pline(_("Resetting time to move #%lld."), svm.moves);
        gg.gmst_moves = 0;

        gl.lastinvnr = 51;
        while (gi.invent)
            useupall(gi.invent);
        while ((otmp = gg.gmst_invent) != null) {
            wornmask = otmp.owornmask;
            otmp.owornmask = 0;
            extract_nobj(otmp, ref_of(gg, "gmst_invent"));
            addinv_nomerge(otmp);
            if (wornmask)
                setworn(otmp, wornmask);
        }
        assert(gg.gmst_ubak != null);
        memcpy(addr_of(u), addr_of(gg.gmst_ubak), sizeof(struct_you));
        assert(gg.gmst_disco != null);
        memcpy(addr_of(svd.disco), addr_of(gg.gmst_disco),
                      sizeof_member(svd, "disco"));
        assert(gg.gmst_mvitals != null);
        memcpy(addr_of(svm.mvitals), addr_of(gg.gmst_mvitals),
                      sizeof_member(svm, "mvitals"));
        /* clear user-given object type names */
        for (otyp = 0; otyp < NUM_OBJECTS; otyp++)
            if (objects[otyp].oc_uname) {
                free(objects[otyp].oc_uname);
                objects[otyp].oc_uname = 0;
            }
        /* some restored state would confuse the level change in progress */
        struct_assign(u.uz, cur_uz), struct_assign(u.uz0, cur_uz0);
        init_uhunger();
        free_tutorial(); /* release gg.gmst_XYZ */
        gg.gmst_stored = FALSE;
        memcpy(addr_of(svs.spl_book[0]), addr_of(gg.gmst_spl_book[0]), sizeof_member(svs, "spl_book"));
    } else if (!reststate && !gg.gmst_stored) {
        /* store game state */
        gg.gmst_moves = svm.moves;
        while ((otmp = gi.invent) != null) {
            wornmask = otmp.owornmask;
            setnotworn(otmp);
            freeinv(otmp);
            otmp.owornmask = wornmask; /* flag for later restore */
            otmp.nobj = gg.gmst_invent;
            gg.gmst_invent = otmp;
        }
        gl.lastinvnr = 51; /* next inv letter to try to use will be 'a' */
        gg.gmst_ubak = ref_to(ptr_to(void_t), addr_of(alloc(sizeof(struct_you))));
        memcpy(addr_of(gg.gmst_ubak), addr_of(u), sizeof(struct_you));
        gg.gmst_disco = ref_to(ptr_to(void_t), addr_of(alloc(sizeof_member(svd, "disco"))));
        memcpy(addr_of(gg.gmst_disco), addr_of(svd.disco),
                      sizeof_member(svd, "disco"));
        gg.gmst_mvitals = ref_to(ptr_to(void_t), addr_of(alloc(sizeof_member(svm, "mvitals"))));
        memcpy(addr_of(gg.gmst_mvitals), addr_of(svm.mvitals),
                      sizeof_member(svm, "mvitals"));
        memcpy(addr_of(gg.gmst_spl_book[0]), addr_of(svs.spl_book[0]), sizeof_member(svs, "spl_book"));
        memset(addr_of(svs.spl_book[0]), 0, sizeof_member(svs, "spl_book"));
        gg.gmst_stored = TRUE;
    } else {
        impossible(_("nhl_gamestate: inconsistent state (%s vs %s)"),
                   reststate ? _("restore") : _("save"),
                   gg.gmst_stored ? _("already stored") : _("not stored"));
    }
    update_inventory();
    return 0;
    } finally { stack_pop($frame); }
}

/* free dynamic date allocated when entering tutorial;
   called when exiting tutorial normally or if player quits while in it */
export function free_tutorial() { /* void */
    let otmp;

    /* for normal tutorial exit, gmst_invent will already be Null */
    while ((otmp = gg.gmst_invent) != null) {
        /* set otmp->where = OBJ_FREE, otmp->nobj = NULL */
        extract_nobj(otmp, ref_of(gg, "gmst_invent"));
        /* gmst_invent is a list of invent items sequestered when entering
           the tutorial; for them, owornmask is used as a flag to re-wear
           them when exiting tutorial, not that they are currently worn;
           clear it to avoid a "deleting worn obj" complaint from obfree() */
        otmp.owornmask = 0;
        /* dealloc_obj() isn't enough (for containers, it assumes that
           caller has already freed their contents) */
        obfree(otmp, null);
    }

    if (gg.gmst_ubak)
        free(addr_of(gg.gmst_ubak)), gg.gmst_ubak = null;
    if (gg.gmst_disco)
        free(addr_of(gg.gmst_disco)), gg.gmst_disco = null;
    if (gg.gmst_mvitals)
        free(addr_of(gg.gmst_mvitals)), gg.gmst_mvitals = null;
}

/* called from gotolevel(do.c) */
export function tutorial(entering) { /* void */
    l_nhcore_call(entering ? NHCORE_ENTER_TUTORIAL : NHCORE_LEAVE_TUTORIAL);

    if (!entering) { /* after leaving, can't go back */
        chars[nhcore_call_available + NHCORE_ENTER_TUTORIAL]
            = chars[nhcore_call_available + NHCORE_LEAVE_TUTORIAL]
                = FALSE;
    }
}

const nhl_functions = static_array("nhlua.c/nhl_functions", struct_luaL_Reg, null, [
    { name: _("test"), func: nhl_test },

    { name: _("getmap"), func: nhl_getmap },

    { name: _("gettrap"), func: nhl_gettrap },
    { name: _("deltrap"), func: nhl_deltrap },

    { name: _("has_timer_at"), func: nhl_timer_has_at },
    { name: _("peek_timer_at"), func: nhl_timer_peek_at },
    { name: _("stop_timer_at"), func: nhl_timer_stop_at },
    { name: _("start_timer_at"), func: nhl_timer_start_at },

    { name: _("abscoord"), func: nhl_abs_coord },

    { name: _("impossible"), func: nhl_impossible },
    { name: _("pline"), func: nhl_pline },
    { name: _("verbalize"), func: nhl_verbalize },
    { name: _("menu"), func: nhl_menu },
    { name: _("text"), func: nhl_text },
    { name: _("getlin"), func: nhl_getlin },
    { name: _("eckey"), func: nhl_get_cmd_key },
    { name: _("callback"), func: nhl_callback },
    { name: _("gamestate"), func: nhl_gamestate },

    { name: _("makeplural"), func: nhl_makeplural },
    { name: _("makesingular"), func: nhl_makesingular },
    { name: _("s_suffix"), func: nhl_s_suffix },
    { name: _("ing_suffix"), func: nhl_ing_suffix },
    { name: _("an"), func: nhl_an },
    { name: _("rn2"), func: nhl_rn2 },
    { name: _("random"), func: nhl_random },
    { name: _("level_difficulty"), func: nhl_level_difficulty },
    { name: _("is_genocided"), func: nhl_is_genocided },
    { name: _("debug_themerm"), func: nhl_get_debug_themerm_name },
    { name: _("parse_config"), func: nhl_parse_config },
    { name: _("get_config"), func: nhl_get_config },
    { name: _("get_config_errors"), func: l_get_config_errors },

    { name: _("dnum_name"), func: nhl_dnum_name },
    { name: _("int_to_pmname"), func: nhl_int_to_pm_name },
    { name: _("int_to_objname"), func: nhl_int_to_obj_name },
    { name: _("variable"), func: nhl_variable },
    { name: _("stairways"), func: nhl_stairways },
    { name: _("pushkey"), func: nhl_pushkey },
    { name: _("doturn"), func: nhl_doturn },
    { name: _("debug_flags"), func: nhl_debug_flags },
    { name: _("flip_level"), func: nhl_flip_level },
    { name: 0, func: null }
]);

  const struct___anon2 = struct("nhlua.struct___anon2", {
    name: ptr_to(char),
    value: long,
}); const nhl_consts = static_array("nhl_consts", struct___anon2, null, [
    { name: _("COLNO"),  value: COLNO },
    { name: _("ROWNO"),  value: ROWNO },
    { name: _("NUMMONS"), value: NUMMONS },
    { name: _("LOW_PM"), value: LOW_PM },
    { name: _("HIGH_PM"), value: HIGH_PM },
    { name: _("FIRST_OBJECT"), value: FIRST_OBJECT },
    { name: _("LAST_OBJECT"), value: NUM_OBJECTS-1 },

    { name: _("DLB"), value: 0 },

    { name: 0, value: 0 },
]);

/* register and init the constants table */
function init_nhc_data(L) { /* void */
    let i;

    lua_newtable(L);

    for (i = 0; nhl_consts[i].name; i++) {
        lua_pushstring(L, nhl_consts[i].name);
        lua_pushinteger(L, nhl_consts[i].value);
        lua_rawset(L, -3);
    }

    lua_setglobal(L, _("nhc"));
}

function nhl_push_anything(L, anytype, src) { /* int */
    const $frame = stack_frame(); try {
    let any = struct_assign(stack_struct(struct_any), cg.zeroany);

    switch (anytype) {
    case ANY_INT:
        any.a_int = ref_to(int, src)[0];
        lua_pushinteger(L, any.a_int);
        break;
    case ANY_UCHAR:
        any.a_uchar = uchars[src];
        lua_pushinteger(L, any.a_uchar);
        break;
    case ANY_SCHAR:
        any.a_schar = chars[src];
        lua_pushinteger(L, any.a_schar);
        break;
    }
    return 1;
    } finally { stack_pop($frame); }
}

function nhl_meta_u_index(L) { /* int */
    const struct___anon3 = struct("nhl_meta_u_index.struct___anon3", {
        name: ptr_to(char),
        ptr: ptr_to(void_t),
        type: int,
    }); let ustruct = static_array("nhl_meta_u_index.ustruct", struct___anon3, null, [
        { name: _("ux"), ptr: addr_of(ref_of(u, "ux")), type: ANY_UCHAR },
        { name: _("uy"), ptr: addr_of(ref_of(u, "uy")), type: ANY_UCHAR },
        { name: _("dx"), ptr: addr_of(ref_of(u, "dx")), type: ANY_SCHAR },
        { name: _("dy"), ptr: addr_of(ref_of(u, "dy")), type: ANY_SCHAR },
        { name: _("dz"), ptr: addr_of(ref_of(u, "dz")), type: ANY_SCHAR },
        { name: _("tx"), ptr: addr_of(ref_of(u, "tx")), type: ANY_UCHAR },
        { name: _("ty"), ptr: addr_of(ref_of(u, "ty")), type: ANY_UCHAR },
        { name: _("ulevel"), ptr: addr_of(ref_of(u, "ulevel")), type: ANY_INT },
        { name: _("ulevelmax"), ptr: addr_of(ref_of(u, "ulevelmax")), type: ANY_INT },
        { name: _("uhunger"), ptr: addr_of(ref_of(u, "uhunger")), type: ANY_INT },
        { name: _("nv_range"), ptr: addr_of(ref_of(u, "nv_range")), type: ANY_INT },
        { name: _("xray_range"), ptr: addr_of(ref_of(u, "xray_range")), type: ANY_INT },
        { name: _("umonster"), ptr: addr_of(ref_of(u, "umonster")), type: ANY_INT },
        { name: _("umonnum"), ptr: addr_of(ref_of(u, "umonnum")), type: ANY_INT },
        { name: _("mh"), ptr: addr_of(ref_of(u, "mh")), type: ANY_INT },
        { name: _("mhmax"), ptr: addr_of(ref_of(u, "mhmax")), type: ANY_INT },
        { name: _("mtimedone"), ptr: addr_of(ref_of(u, "mtimedone")), type: ANY_INT },
        { name: _("dlevel"), ptr: addr_of(ref_of(u.uz, "dlevel")), type: ANY_SCHAR }, /* actually coordxy */
        { name: _("dnum"), ptr: addr_of(ref_of(u.uz, "dnum")), type: ANY_SCHAR },     /* actually coordxy */
        { name: _("uluck"), ptr: addr_of(ref_of(u, "uluck")), type: ANY_SCHAR },
        { name: _("uhp"), ptr: addr_of(ref_of(u, "uhp")), type: ANY_INT },
        { name: _("uhpmax"), ptr: addr_of(ref_of(u, "uhpmax")), type: ANY_INT },
        { name: _("uen"), ptr: addr_of(ref_of(u, "uen")), type: ANY_INT },
        { name: _("uenmax"), ptr: addr_of(ref_of(u, "uenmax")), type: ANY_INT },
    ]);
    let tkey = luaL_checkstring(L, 2);
    let i;

    /* FIXME: doesn't really work, eg. negative values for u.dx */
    for (i = 0; i < SIZE(ustruct); i++)
        if (!strcmp(tkey, ustruct[i].name)) {
            return nhl_push_anything(L, ustruct[i].type, ustruct[i].ptr);
        }

    if (!strcmp(tkey, _("inventory"))) {
        nhl_push_obj(L, gi.invent);
        return 1;
    } else if (!strcmp(tkey, _("role"))) {
        lua_pushstring(L, gu.urole.name.m);
        return 1;
    } else if (!strcmp(tkey, _("moves"))) {
        lua_pushinteger(L, svm.moves);
        return 1;
    } else if (!strcmp(tkey, _("uhave_amulet"))) {
        lua_pushinteger(L, u.uhave.amulet);
        return 1;
    } else if (!strcmp(tkey, _("depth"))) {
        lua_pushinteger(L, depth(u.uz));
        return 1;
    } else if (!strcmp(tkey, _("invocation_level"))) {
        lua_pushboolean(L, Invocation_lev(u.uz));
        return 1;
    }

    nhl_error(L, _("Unknown u table index"));
    /*NOTREACHED*/
    return 0;
}

function nhl_meta_u_newindex(L) { /* int */
    nhl_error(L, _("Cannot set u table values"));
    /*NOTREACHED*/
    return 0;
}

function nhl_u_clear_inventory(L) { /* int */
    while (gi.invent)
        useupall(gi.invent);
    return 0;
}

/* Put object into player's inventory */
/* u.giveobj(obj.new("rock")); */
function nhl_u_giveobj(L) { /* int */
    return nhl_obj_u_giveobj(L);
}

const nhl_u_functions = static_array("nhl_u_functions", struct_luaL_Reg, null, [
    { name: _("clear_inventory"), func: nhl_u_clear_inventory },
    { name: _("giveobj"), func: nhl_u_giveobj },
    { name: 0, func: null }
]);

function init_u_data(L) { /* void */
    lua_newtable(L);
    luaL_setfuncs(L, nhl_u_functions[0], 0);
    lua_newtable(L);
    lua_pushcfunction(L, nhl_meta_u_index);
    lua_setfield(L, -2, _("__index"));
    lua_pushcfunction(L, nhl_meta_u_newindex);
    lua_setfield(L, -2, _("__newindex"));
    lua_setmetatable(L, -2);
    lua_setglobal(L, _("u"));
}

/* #ifdef notyet: not in this build */

function traceback_handler(L) { /* int */
    luaL_traceback(L, L, lua_tostring(L, 1), 0);
    /* TODO: call impossible() if fuzzing? */
    return 1;
}

function nhl_getmeminuse(L) { /* uint32_t */
    return unsigned(lua_gc(L, LUA_GCCOUNT) * 1024 + lua_gc(L, LUA_GCCOUNTB));
}

/* lua_pcall with our traceback handler and memory and instruction step
 * limiting.
 *  On error, traceback will be on top of stack */
export function nhl_pcall(L, nargs, nresults, name) { /* int */
    const $frame = stack_frame(); try {
    let $goto = null, $jv = 0, $jb = null; var nud = stack_var(ptr_to(struct_nhl_user_data));

    var rv;

    lua_pushcfunction(L, traceback_handler);
    lua_insert(L, 1);
    lua_getallocf(L, nud);

    if (nud[0] && name) {
        nud[0].name = name;
    }
    /* NB: We don't need to deal with nud->memlimit - Lua handles that. */
    $goto_setjmp: for (;;) { try { switch ($goto) { default: case "setjmp": if ($goto || (nud[0] && (nud[0].steps || nud[0].perpcall))) {
        switch ($goto) { default: if (nud[0].perpcall) {
            nud[0].steps = nud[0].perpcall;
            nud[0].statctr = 0;
        }
        case "setjmp": $goto = null; if (($jb = nud[0].jb[0], $jv)) {
            /* panic, because we don't know if the game state is corrupt */
            /* XXX can we get a lua stack trace as well? */
            panic(_("Lua time exceeded %d:%s"), nud[0].sid,
                  nud[0].name ? nud[0].name : _("(unknown)"));
        } $jv = 0; }
    }

    rv = lua_pcall(L, nargs, nresults, 1);

    lua_remove(L, 1); /* remove handler */

    if (nud[0] && nud[0].perpcall && gl.loglua) {
        var ic = unsigned(Math.imul(nud[0].statctr, NHL_SB_STEPSIZE)); // an approximation
        livelog_printf(LL_DEBUG, _("LUASTATS PCAL %d:%s %lld"), nud[0].sid,
                       nud[0].name, ic);
    }
    if (nud[0] && nud[0].memlimit && gl.loglua) {
        livelog_printf(LL_DEBUG, _("LUASTATS PMEM %d:%s %llu"), nud[0].sid,
                       nud[0].name, nhl_getmeminuse(L));
    }

    return rv; } break; } catch ($e) { $jv = setjmp_caught($e, $jb); $goto = "setjmp"; continue $goto_setjmp; } }
    } finally { stack_pop($frame); }
}

export function nhl_pcall_handle(L, nargs, nresults, name,
                 npa) { /* int */
    const $frame = stack_frame(); try {
    let rv = nhl_pcall(L, nargs, nresults, name);
    if (rv) {
        let nud = stack_var(ptr_to(struct_nhl_user_data));
        lua_getallocf(L, nud);
        /* XXX can we get a lua stack trace as well? */
        switch (npa) {
        case NHLpa_panic:
            panic(_("Lua error %d:%s %s"), nud[0].sid,
                  nud[0].name ? nud[0].name : _("(unknown)"), lua_tostring(L, -1));
            /*NOTREACHED*/
            break;
        case NHLpa_impossible:
            impossible(_("Lua error: %d:%s %s"), nud[0].sid,
                       nud[0].name ? nud[0].name : _("(unknown)"),
                       lua_tostring(L, -1));
                /* Drop the error.  If the caller cares, use nhl_pcall(). */
            lua_pop(L, 1);
        }
    }
    return rv;
    } finally { stack_pop($frame); }
}

/* XXX impossible() should be swappable with pline/nothing/panic via flag */
/* read lua code/data from a dlb module or an external file
   into a string buffer and feed that to lua */
export function nhl_loadlua(L, fname) { /* boolean */
    var ret = TRUE;
    var fh;
    var buf = 0, bufin, bufout, p, nl, altfname;
    var buflen, ct, cnt;
    var llret;

    altfname = addr_of(alloc(unsigned(Strlen(fname) + 3))); /* 3: '('...')\0' */
    /* don't know whether 'fname' is inside a dlb container;
       if we did, we could choose between "nhdat(<fname>)" and "<fname>"
       but since we don't, compromise */
    sprintf(altfname, _("(%s)"), fname);
    fh = dlb_fopen(fname, _(RDBMODE));
    give_up: { if (!fh) {
        impossible(_("nhl_loadlua: Error opening %s"), altfname);
        ret = FALSE;
        break give_up;
    }

    dlb_fseek(fh, 0, SEEK_END);
    buflen = dlb_ftell(fh);
    dlb_fseek(fh, 0, SEEK_SET);

    /* extra +1: room to add final '\n' if missing */
    buf = bufout = addr_of(alloc(unsigned(FITSint(buflen + 1 + 1))));
    chars[buf + 0] = ord('\0');
    bufin = bufout = buf;

    ct = 0;
    while (buflen > 0 || ct) {
        /*
         * Semi-arbitrarily limit reads to 8K at a time.  That's big
         * enough to cover the majority of our Lua files in one bite
         * but small enough to fully exercise the partial record
         * handling (when processing the castle's level description).
         *
         * [For an external file (non-DLB), VMS may only be able to
         * read at most 32K-1 at a time depending on the file format
         * in use, and fseek(SEEK_END) only yields an upper bound on
         * the actual amount of data in that situation.]
         */
        if ((cnt = dlb_fread(bufin, 1, unsigned(min(int(buflen), LOADCHUNKSIZE)), fh))
            < 0)
            break;
        buflen -= cnt; /* set up for next iteration, if any */
        if (cnt == 0) {
            chars[bufin] = ord('\n'); /* very last line is unterminated? */
            cnt = 1;
        }
        chars[bufin + cnt] = ord('\0'); /* fread() doesn't do this */

        /* in case partial line was leftover from previous fread */
        bufin -= ct, cnt += ct, ct = 0;

        while (cnt > 0) {
            if ((nl = strchr(bufin, ord('\n'))) != 0) {
                /* normal case, newline is present */
                ct = (nl - bufin + 1); /* +1: keep the newline */
                for (p = bufin; p <= nl; ++p)
                    chars[bufout++] = chars[bufin++];
                if (chars[bufin] == ord('\r'))
                    ++bufin, ++ct;
                /* update for next loop iteration */
                cnt -= ct;
                ct = 0;
            } else if (strlen(bufin) < LOADCHUNKSIZE) {
                /* no newline => partial record; move unprocessed chars
                   to front of input buffer (bufin portion of buf[]) */
                ct = cnt = (eos(bufin) - bufin);
                for (p = bufout; cnt > 0; --cnt)
                    chars[p++] = chars[bufin++];
                chars[p] = ord('\0');
                bufin = p; /* next fread() populates buf[] starting here */
                /* cnt==0 so inner loop will terminate */
            } else {
                /* LOADCHUNKSIZE portion of buffer already completely full */
                impossible(_("(%s) line too long"), altfname);
                break give_up;
            }
        }
    }
    chars[bufout] = ord('\0');
    dlb_fclose(fh);

    llret = luaL_loadbufferx(L, buf, strlen(buf), altfname, 0);
    if (llret != LUA_OK) {
        impossible(_("luaL_loadbuffer: Error loading %s: %s"), altfname,
                   lua_tostring(L, -1));
        ret = FALSE;
        break give_up;
    } else {
        if (nhl_pcall_handle(L, 0, LUA_MULTRET, fname, NHLpa_impossible)) {
            ret = FALSE;
            break give_up;
        }
    }
 }
    if (altfname)
        free(altfname);
    if (buf)
        free(buf);
    return ret;
}
export const LOADCHUNKSIZE = shl64(1, 13);

export function nhl_init(sbi) { /* lua_State * */
    /* It would be nice to import EXPECTED from each build system. XXX */
    /* And it would be nice to do it only once, but it's cheap. */

    if (NHL_VERSION_EXPECTED != LUA_VERSION_RELEASE_NUM) {
        panic(
            _("sandbox doesn't know this Lua version: this=%d != expected=%d "),
            LUA_VERSION_RELEASE_NUM, NHL_VERSION_EXPECTED);
    }

    let L = nhlL_newstate(sbi, _("nhl_init"));
    if(!L) return null;

    iflags.in_lua = TRUE;
    /* Temporary for development XXX */
    /* Turn this off in config.h to disable the sandbox. */

    nhlL_openlibs(L, sbi.flags);

    /* register nh -table, and functions for it */
    lua_newtable(L);
    luaL_setfuncs(L, nhl_functions[0], 0);
    lua_setglobal(L, _("nh"));

    /* init nhc -table */
    init_nhc_data(L);

    /* init u -table */
    init_u_data(L);

    l_selection_register(L);
    l_register_des(L);

    l_obj_register(L);

    /* nhlib.lua assumes the math table exists. */
    if (LUA_TTABLE != lua_getglobal(L, _("math"))) {
        lua_newtable(L);
        lua_setglobal(L, _("math"));
    }

    if (!nhl_loadlua(L, _("nhlib.lua"))) {
        nhl_done(L);
        return null;
    }

    return L;
}
export const NHL_VERSION_EXPECTED = 50408;

export function nhl_done(L) { /* void */
    const $frame = stack_frame(); try {
    if (L) {
        let nud = stack_var(ptr_to(struct_nhl_user_data), null);
        lua_getallocf(L, nud);
        if (gl.loglua) {
            if (nud[0] && nud[0].osteps) {
                let ic = unsigned(Math.imul(nud[0].statctr, NHL_SB_STEPSIZE)); // an approximation
                livelog_printf(LL_DEBUG, _("LUASTATS DONE %d:%s %lld"), nud[0].sid,
                               nud[0].name, ic);
            }
            if (nud[0] && nud[0].memlimit && !nud[0].perpcall) {
                livelog_printf(LL_DEBUG, _("LUASTATS DMEM %d:%s %llu"), nud[0].sid,
                               nud[0].name, nhl_getmeminuse(L));
            }
        }
        lua_close(L);
        if (nud[0])
            nhl_alloc((0), addr_of(nud[0]), 0, 0); // free nud
    }
    iflags.in_lua = FALSE;
    } finally { stack_pop($frame); }
}

export function load_lua(name, sbi) { /* boolean */
    var ret = TRUE;
    var L = nhl_init(sbi);

    give_up: { if (!L) {
        ret = FALSE;
        break give_up;
    }

    if (!nhl_loadlua(L, name)) {
        ret = FALSE;
        break give_up;
    }
 }
    nhl_done(L);

    return ret;
}

export function get_lua_version() { /* const char * */
    const $frame = stack_frame(); try {
    let sbi = init_list(stack_struct(struct_nhl_sandbox_info), { flags: NHL_SB_VERSION, memlimit: 1 * 1024 * 1024, steps: 0,
                             perpcall: 1 * 1024 * 1024 });

    if (chars[gl.lua_ver + 0] == 0) {
        let L = nhl_init(sbi);

        if (L) {
            let len = stack_var(unsigned, 0);
            let vs = 0;

            /* LUA_VERSION yields "<major>.<minor>" although we check to see
               whether it is "Lua-<major>.<minor>" and strip prefix if so;
               LUA_RELEASE is <LUA_VERSION>.<LUA_VERSION_RELEASE> but doesn't
               get set up as a lua global */
            lua_getglobal(L, _("_RELEASE"));
            if (lua_isstring(L, -1))
                vs = lua_tolstring(L, -1, len);

            else
                vs = _(LUA_RELEASE), len[0] = strlen(vs);

            if (!vs) {
                lua_getglobal(L, _("_VERSION"));
                if (lua_isstring(L, -1))
                    vs = lua_tolstring(L, -1, len);

                else
                    vs = _(LUA_VERSION), len[0] = strlen(vs);
            }
            if (vs && len[0] < sizeof_member(gl, "lua_ver")) {
                if (!strncmpi(vs, _("Lua"), 3)) {
                    vs += 3;
                    if (chars[vs] == ord('-') || chars[vs] == ord(' '))
                        vs += 1;
                }
                strcpy(gl.lua_ver, vs);
            }
        }
        nhl_done(L);

        if (sizeof_string(LUA_COPYRIGHT) <= sizeof_member(gl, "lua_copyright"))
            strcpy(gl.lua_copyright, _(LUA_COPYRIGHT));
    }
    return gl.lua_ver;
    } finally { stack_pop($frame); }
}

/***
 *** SANDBOX / HARDENING CODE
 ***/
/*
 * Tracing the sandbox:
 * 1. Make sure CHRONICLE and LIVELOG are defined in config.h.
 * 2. Rebuild the game.
 * 3. Run the game and do whatever you want to check with lua.
 * 4. Find the logged information in livelog.
 *
 * Logging format in livelog:
 * <livelog leader>message=LUASTATS <TYPE> <SID>:<TAG> <DATA>
 * where:
 *  TYPE
 *     DONE rough number of step taken during the life of the VM
 *     DMEM memory in use at destruction of VM
 *     PCAL rough number of steps during lua_pcall
 *     PMEM memory in use after lua_pcall returns
 *  SID     a small integer identifying the Lua VM instance
 *  TAG     a string from the nhl_luapcall call
 *  DATA    memory: rough number of bytes in use by the VM
 *          steps: rough number of steps by the VM(see NHL_SB_STEPSIZE)
 */

const NEVER = 0; const IFFLAG = NEVER + 1; const EOT = IFFLAG + 1;
const struct_e = struct("struct_e", {
    when: unsigned,
    fnname: ptr_to(char),
});

/* NHL_BASE_BASE - safe things */
const ct_base_base = static_array("ct_base_base", struct_e, null, [
    { when: IFFLAG, fnname: _("ipairs") },
    { when: IFFLAG, fnname: _("next") },
    { when: IFFLAG, fnname: _("pairs") },
    { when: IFFLAG, fnname: _("pcall") },
    { when: IFFLAG, fnname: _("select") },
    { when: IFFLAG, fnname: _("tonumber") },
    { when: IFFLAG, fnname: _("tostring") },
    { when: IFFLAG, fnname: _("type") },
    { when: IFFLAG, fnname: _("xpcall") },
    { when: EOT, fnname: 0 }
]);

/* NHL_BASE_ERROR - not really safe--might not want Lua to kill the process */
const ct_base_error = static_array("ct_base_error", struct_e, null, [
    { when: IFFLAG, fnname: _("assert") }, /* ok, calls error */
    { when: IFFLAG, fnname: _("error") },  /* ok, calls G->panic */
    { when: NEVER, fnname: _("print") },   /* not ok - calls lua_writestring/lua_writeline
                           * which write to stdout */
    { when: NEVER, fnname: _("warn") },    /* not ok - calls lua_writestringerror which writes
                           * to stderr */
    { when: EOT, fnname: 0 }
]);

/* NHL_BASE_META - metatable access */
const ct_base_meta = static_array("ct_base_meta", struct_e, null, [
    { when: IFFLAG, fnname: _("getmetatable") },
    { when: IFFLAG, fnname: _("rawequal") },
    { when: IFFLAG, fnname: _("rawget") },
    { when: IFFLAG, fnname: _("rawlen") },
    { when: IFFLAG, fnname: _("rawset") },
    { when: IFFLAG, fnname: _("setmetatable") },
    { when: EOT, fnname: 0 }
]);

/* NHL_BASE_GC - questionable safety */
const ct_base_iffy = static_array("ct_base_iffy", struct_e, null, [
    { when: IFFLAG, fnname: _("collectgarbage") },
    { when: EOT, fnname: 0 }
]);

/* NHL_BASE_UNSAFE - include only if required */
/* TODO: if NHL_BASE_UNSAFE is ever used, we need to wrap lua_load with
 * something to forbid mode=="b" */
const ct_base_unsafe = static_array("ct_base_unsafe", struct_e, null, [
    { when: IFFLAG, fnname: _("dofile") },
    { when: IFFLAG, fnname: _("loadfile") },
    { when: IFFLAG, fnname: _("load") },
    { when: EOT, fnname: 0 }
]);

/* no ct_co_ tables; all fns at same level of concern */
/* no ct_string_ tables; all fns at same level of concern */
/* no ct_table_ tables; all fns at same level of concern (but
   sort can take a lot of time and can't be caught by the step limit */
/* no ct_utf8_ tables; all fns at same level of concern */

/* possible ct_debug tables - likely to need changes */
const ct_debug_debug = static_array("ct_debug_debug", struct_e, null, [
    { when: NEVER,  fnname: _("debug") },          /* uses normal I/O so needs re-write */
    { when: IFFLAG, fnname: _("getuservalue") },
    { when: NEVER,  fnname: _("gethook") },        /* see sethook */
    { when: IFFLAG, fnname: _("getinfo") },
    { when: IFFLAG, fnname: _("getlocal") },
    { when: IFFLAG, fnname: _("getregistry") },
    { when: IFFLAG, fnname: _("getmetatable") },
    { when: IFFLAG, fnname: _("getupvalue") },
    { when: IFFLAG, fnname: _("upvaluejoin") },
    { when: IFFLAG, fnname: _("upvalueid") },
    { when: IFFLAG, fnname: _("setuservalue") },
    { when: NEVER,  fnname: _("sethook") },        /* used for memory and step limits */
    { when: IFFLAG, fnname: _("setlocal") },
    { when: IFFLAG, fnname: _("setmetatable") },
    { when: IFFLAG, fnname: _("setupvalue") },
    { when: IFFLAG, fnname: _("setcstacklimit") },
    { when: EOT, fnname: 0 }
]);
const ct_debug_safe = static_array("ct_debug_safe", struct_e, null, [
    { when: IFFLAG, fnname: _("traceback") },
    { when: EOT, fnname: 0 }
]);

/* possible ct_os_ tables */
const ct_os_time = static_array("ct_os_time", struct_e, null, [
    { when: IFFLAG, fnname: _("clock") },          /* is this portable? XXX */
    { when: IFFLAG, fnname: _("date") },
    { when: IFFLAG, fnname: _("difftime") },
    { when: IFFLAG, fnname: _("time") },
    { when: EOT, fnname: 0 }
]);

const ct_os_files = static_array("ct_os_files", struct_e, null, [
    { when: NEVER, fnname: _("execute") },         /* not portable */
    { when: NEVER, fnname: _("exit") },
    { when: NEVER, fnname: _("getenv") },
    { when: IFFLAG, fnname: _("remove") },
    { when: IFFLAG, fnname: _("rename") },
    { when: NEVER, fnname: _("setlocale") },
    { when: NEVER, fnname: _("tmpname") },
    { when: EOT, fnname: 0 }
]);

function nhl_clearfromtable(L, flag, tndx, todo) { /* void */
    while (todo.when != EOT) {
        lua_pushnil(L);
        /* if we load the library at all, NEVER items must be erased
         * and IFFLAG items should be erased if !flag */
        if (todo.when == NEVER || !flag) {
            lua_setfield(L, tndx, todo.fnname);
        }
        todo = ptr_add(todo, 1);
    }
}

/*
XXX
registry["org.nethack.nethack.sb.fs"][N]=
    CODEOBJECT
    {
        modepat: PATTERN,
        filepat: PATTERN
    }
CODEOBJECT
    if string then if pcall(string,mode, dir, file)
    if table then if mode matches pattern and filepat ma....
or do we use a real regex engine? (which we don't have and I just
 argued against adding)

return values from "call it":
    accept - file access granted
    reject - file access denied
    continue - try next element
    fail - error.  deny and call impossible/panic
*/

/* stack indexes:
 * -1       table to index with ename
 * params   file
 * params+1 [mode]
 */
/*
 * Problem: NetHack doesn't have a regex engine and Lua doesn't give
 *  C access to pattern matching.  There are 3 poor solutions:
 * 1. Import ~5K lines of code in a dozen files from FreeBSD. (Upside - we
 *    could use it in other places in NetHack.)
 * 2. Hack up lstrlib.c to give C direct access to the pattern matching code.
 * 3. Create a Lua state just to do pattern matching.
 * We're going to do #3.
 */
/* #ifdef notyet: not in this build */

function end_luapat() { /* void */
    if (luapat[0]) {
        lua_close(luapat[0]);
        luapat[0] = null;
    }
}

/* #ifdef notyet: not in this build */

/* put the table open uses to check its arguments on the top of the stack,
 * creating it if needed
 */
export const HOOKTBLNAME = "org.nethack.nethack.sb.fs";

export function nhl_pushhooked_open_table(L) { /* void */
    let hot = lua_getfield(L, LUA_REGISTRYINDEX, _(HOOKTBLNAME));

    if (hot == LUA_TNONE) {
        lua_newtable(L);
        lua_pushvalue(L, -1);
        lua_setfield(L, LUA_REGISTRYINDEX, _(HOOKTBLNAME));
    }
}

/* #ifdef notyet: not in this build */

function nhlL_openlibs(L, lflags) { /* void */
    /* translate lflags from user-friendly to internal */
    if (NHL_SB_DEBUGGING & lflags) {
        lflags = unsigned(lflags | NHL_SB_DB_SAFE);
    }
    /* only for debugging the sandbox integration */
    if (NHL_SB_ALL & lflags) {
        lflags = unsigned(-1);
    } else if (NHL_SB_SAFE & lflags) {
        lflags = unsigned(lflags | NHL_SB_BASE_BASE);
        lflags = unsigned(lflags | NHL_SB_COROUTINE);
        lflags = unsigned(lflags | NHL_SB_TABLE);
        lflags = unsigned(lflags | NHL_SB_STRING);
        lflags = unsigned(lflags | NHL_SB_MATH);
        lflags = unsigned(lflags | NHL_SB_UTF8);
    } else if (NHL_SB_VERSION) {
        lflags = unsigned(lflags | NHL_SB_BASE_BASE);
    }
    /* #ifdef notyet: not in this build */

    if (lflags & NHL_SB_BASEMASK) {
        let baselib;
        /* load the entire library ... */
        luaL_requiref(L, _(LUA_GNAME), luaopen_base, 1);

        baselib = lua_gettop(L);

        /* ... and remove anything unsupported or not requested */
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_BASE_BASE), baselib, ct_base_base[0]);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_BASE_ERROR), baselib, ct_base_error[0]);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_BASE_META), baselib, ct_base_meta[0]);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_BASE_GC), baselib, ct_base_iffy[0]);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_BASE_UNSAFE), baselib, ct_base_unsafe[0]);

        lua_pop(L, 1);
    }

    if (lflags & NHL_SB_COROUTINE) {
        luaL_requiref(L, _(LUA_COLIBNAME), luaopen_coroutine, 1);
        lua_pop(L, 1);
    }
    if (lflags & NHL_SB_TABLE) {
        luaL_requiref(L, _(LUA_TABLIBNAME), luaopen_table, 1);
        lua_pop(L, 1);
    }

    if (lflags & NHL_SB_OSMASK) {
        let oslib;
        luaL_requiref(L, _(LUA_OSLIBNAME), luaopen_os, 1);
        oslib = lua_gettop(L);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_OS_TIME), oslib, ct_os_time[0]);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_OS_FILES), oslib, ct_os_files[0]);
        lua_pop(L, 1);
    }

    if (lflags & NHL_SB_STRING) {
        luaL_requiref(L, _(LUA_STRLIBNAME), luaopen_string, 1);
        lua_pop(L, 1);
    }
    if (lflags & NHL_SB_MATH) {
        luaL_requiref(L, _(LUA_MATHLIBNAME), luaopen_math, 1);
        /* Seed Lua's math.random (xoshiro256**) from the game seed so
         * that math.random() calls in level scripts produce deterministic,
         * reproducible results. */
        {
            let env_seed = nh_getenv(_("NETHACK_SEED"));
            if (env_seed) {
                let seed = strtoull(env_seed, null, 10);
                lua_getfield(L, -1, _("randomseed"));
                lua_pushinteger(L, i64(seed));
                lua_call(L, 1, 0);
            }
        }
        lua_pop(L, 1);
    }
    if (lflags & NHL_SB_UTF8) {
        luaL_requiref(L, _(LUA_UTF8LIBNAME), luaopen_utf8, 1);
        lua_pop(L, 1);
    }
    if (lflags & NHL_SB_DBMASK) {
        let dblib;
        luaL_requiref(L, _(LUA_DBLIBNAME), luaopen_debug, 1);
        dblib = lua_gettop(L);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_DB_DB), dblib, ct_debug_debug[0]);
        nhl_clearfromtable(L, +!!(lflags & NHL_SB_DB_SAFE), dblib, ct_debug_safe[0]);
        lua_pop(L, 1);
    }
}

function nhl_alloc(ud, ptr, osize, nsize) { /* void * */
    let nud = view_of(struct_nhl_user_data, ud);

    if (nsize == 0) {
        if (ptr != (0)) {
            free(ptr);
        }
        return (0);
    }

    /* Check nud->L because it will be NULL during state init. */
    if (nud && nud.L && nud.memlimit) { /* this state is size limited */
        if (nhl_getmeminuse(nud.L) > nud.memlimit)
            return (0);
    }

    return addr_of(re_alloc(ref_to(long, ptr), nsize));
}

function nhl_panic(L) { /* int */
    let msg = lua_tostring(L, -1);

    if (msg == (0))
        msg = _("error object is not a string");
    panic(_("unprotected error in call to Lua API (%s)\n"), msg);
    /*NOTREACHED*/
    return 0; /* return to Lua to abort */
}

/* called when lua issues a warning message; the text of the message
   is passed to us in pieces across multiple function calls */
function nhl_warn(
    userdata,
    msg_fragment,
    to_be_continued) { /* void */ /* 0: last fragment; 1: more to come */
    let fraglen, buflen = strlen(gl.lua_warnbuf);

    if (msg_fragment && buflen < sizeof_member(gl, "lua_warnbuf") - 1) {
        fraglen = strlen(msg_fragment);
        if (unsigned(buflen + fraglen) > sizeof_member(gl, "lua_warnbuf") - 1)
            fraglen = unsigned(sizeof_member(gl, "lua_warnbuf") - 1 - buflen);
        strncat(gl.lua_warnbuf, msg_fragment, fraglen);
    }
    if (!to_be_continued) {
        paniclog(_("[lua]"), gl.lua_warnbuf);
        chars[gl.lua_warnbuf + 0] = ord('\0');
    }
}

function nhl_hookfn(L, ar) { /* void */
    const $frame = stack_frame(); try {
    let nud = stack_var(ptr_to(struct_nhl_user_data));

    lua_getallocf(L, nud);

    if (nud[0].steps <= NHL_SB_STEPSIZE)
        longjmp(nud[0].jb[0], 1);

    nud[0].steps -= NHL_SB_STEPSIZE;
    nud[0].statctr++;
    } finally { stack_pop($frame); }
}

function nhlL_newstate(sbi, name) { /* lua_State * */
    let nud = null;

    if (sbi.memlimit || sbi.steps || sbi.perpcall) {
        nud = view_of(struct_nhl_user_data, nhl_alloc((0), (0), 0, sizeof(struct_nhl_user_data)));
        if (!nud)
            return null;
        nud.L = null;
        nud.memlimit = sbi.memlimit;
        nud.perpcall = 0; /* set up below, if needed */
        nud.steps = 0;
        nud.osteps = 0;
        nud.flags = sbi.flags; /* save reporting flags */
        nud.statctr = 0;

        if (name) {
            nud.name = name;
        }
        nud.sid = ++gl.lua_sid;
    }

    let L = lua_newstate(nhl_alloc, addr_of(nud)

                               );
    if (!L)
        panic(_("NULL lua_newstate"));

    if(nud) nud.L = L;
    lua_atpanic(L, nhl_panic);

    lua_setwarnf(L, nhl_warn, addr_of(L));

    if (nud && (sbi.steps || sbi.perpcall)) {
        if (sbi.steps && sbi.perpcall)
            impossible(_("steps and perpcall both non-zero"));
        if (sbi.perpcall) {
            nud.perpcall = sbi.perpcall;
        } else {
            nud.steps = sbi.steps;
            nud.osteps = sbi.steps;
        }
        lua_sethook(L, nhl_hookfn, LUA_MASKCOUNT, NHL_SB_STEPSIZE);
    }

    return L;
}

/*
(See end of comment for conclusion.)
to make packages safe, we need something like:
    if setuid/setgid (but does NH drop privs before we can check? TBD)
        unsetenv LUA_CPATH, LUA_CPATH_5_4 (and this needs to change with
          version) maybe more
    luaopen_package calls getenv
        unsetenv(LUA_PATH_VAR)
        unsetenv(LUA_CPATH_VAR)
        unsetenv(LUA_PATH_VAR LUA_VERSUFFIX)
        unsetenv(LUA_CPATH_VAR LUA_VERSUFFIX)
                    package.config
                    oackage[fieldname] = path
            NB: LUA_PATH_DEFAULT and LUA_CPATH_DEFAULT must be safe
                or we must setenv LUA_PATH_VAR and LUA_CPATH_VAR to something
                safe
            or we could just clean out the searchers table?
                package.searchers[preload,Lua,C,Croot]
also, can setting package.path to something odd get Lua to load files
 it shouldn't? (see docs package.searchers)
set (and disallow changing) package.cpath (etc?)
loadlib.c:
    lsys_load -> dlopen     Kill with undef LUA_USE_DLOPEN LUA_DL_DLL
    searchpath -> readable -> fopen
        <- ll_searchpath
        <- findfile <- {searchers C, Croot, Lua}
Probably the best thing to do is replace G.require with our own function
that does whatever it is we need and completely ignore the package library.
*/
/*
TODO:
docs
unfinished functionality & design
commit, cleanup, commit with SHA1 of full code version
BUT how do we compact the current history?
    new branch, then compress there
XXX
*/

/*nhlua.c*/

import { AM_SHRINE } from "./align.h.js";
import { NO_COLOR } from "./color.h.js";
import { RDBMODE } from "./dlb.h.js";
import { dlb_fclose, dlb_fopen, dlb_fread, dlb_fseek, dlb_ftell } from "./dlb.h.macros.js";
import { struct_d_level } from "./dungeon.h.js";
import { wizard } from "./flag.h.macros.js";
import {
    BUFSZ, COLNO, FALSE, LL_DEBUG, NHL_SB_ALL, NHL_SB_BASEMASK, NHL_SB_BASE_BASE, NHL_SB_BASE_ERROR,
    NHL_SB_BASE_GC, NHL_SB_BASE_META, NHL_SB_BASE_UNSAFE, NHL_SB_COROUTINE, NHL_SB_DBMASK,
    NHL_SB_DB_DB, NHL_SB_DB_SAFE, NHL_SB_DEBUGGING, NHL_SB_MATH, NHL_SB_OSMASK, NHL_SB_OS_FILES,
    NHL_SB_OS_TIME, NHL_SB_SAFE, NHL_SB_STEPSIZE, NHL_SB_STRING, NHL_SB_TABLE, NHL_SB_UTF8,
    NHL_SB_VERSION, NHLpa_impossible, NHLpa_panic, ROWNO, TRUE, boolean, coordxy,
    struct_nhl_sandbox_info,
} from "./global.h.js";
import { Strlen } from "./global.h.macros.js";
import {
    CQ_CANNED, NHCORE_ENTER_TUTORIAL, NHCORE_LEAVE_TUTORIAL, NUM_NHCB, NUM_NHCORE_CALLS,
} from "./hack.h.js";
import { min } from "./hack.h.macros.js";
import { FITSint, Snprintf } from "./hacklib.h.macros.js";
import { LUA_GNAME, struct_luaL_Reg } from "./lauxlib.h.js";
import { luaL_checkstring, luaL_optstring } from "./lauxlib.h.macros.js";
import { debugpline4 } from "./lint.h.macros.js";
import {
    LUA_COPYRIGHT, LUA_GCCOUNT, LUA_GCCOUNTB, LUA_MASKCOUNT, LUA_MULTRET, LUA_OK, LUA_REGISTRYINDEX,
    LUA_RELEASE, LUA_TBOOLEAN, LUA_TFUNCTION, LUA_TNIL, LUA_TNONE, LUA_TNUMBER, LUA_TSTRING,
    LUA_TTABLE, LUA_VERSION, LUA_VERSION_RELEASE_NUM, lua_Integer, struct_lua_Debug,
} from "./lua.h.js";
import {
    lua_call, lua_insert, lua_isnil, lua_istable, lua_newtable, lua_pcall, lua_pop,
    lua_pushcfunction, lua_remove, lua_tointeger, lua_tostring,
} from "./lua.h.macros.js";
import {
    LUA_COLIBNAME, LUA_DBLIBNAME, LUA_MATHLIBNAME, LUA_OSLIBNAME, LUA_STRLIBNAME, LUA_TABLIBNAME,
    LUA_UTF8LIBNAME,
} from "./lualib.h.js";
import { G_GENOD, NEUTRAL } from "./monflag.h.js";
import { DEADMONSTER } from "./monst.h.macros.js";
import { HIGH_PM, LOW_PM, NON_PM, NUMMONS } from "./monsters.h.js";
import { OBJ_NAME } from "./objclass.h.macros.js";
import { FIRST_OBJECT, NUM_OBJECTS } from "./objects.h.js";
import {
    AIR, BLCORNER, BRCORNER, CLOUD, CORR, CROSSWALL, DBWALL, DOOR, D_BROKEN, D_CLOSED, D_ISOPEN,
    D_LOCKED, D_NODOOR, D_TRAPPED, FOUNTAIN, F_LOOTED, F_WARNED, HWALL, ICE, INVALID_TYPE, IRONBARS,
    LAVAPOOL, LAVAWALL, MATCH_WALL, MAX_TYPE, MOAT, POOL, ROOM, SCORR, SDOOR, SINK, STONE,
    S_LDWASHER, S_LPUDDING, S_LRING, TDWALL, THRONE, TLCORNER, TLWALL, TRCORNER, TREE, TREE_LOOTED,
    TREE_SWARM, TRWALL, TUWALL, T_LOOTED, VWALL, WATER,
} from "./rm.h.js";
import { IS_ALTAR, IS_DOOR, IS_FOUNTAIN, IS_SINK, IS_THRONE, fmon, levl } from "./rm.h.macros.js";
import { Sfi_char, Sfo_char, Sfo_unsigned } from "./savefile.h.macros.js";
import { MELT_ICE_AWAY, NUM_TIME_FUNCS, TIMER_LEVEL } from "./timeout.h.js";
import { timer_is_pos } from "./timeout.h.macros.js";
import { PIT, ROLLING_BOULDER_TRAP, SPIKED_PIT, SQKY_BOARD } from "./trap.h.js";
import {
    create_nhwindow, destroy_nhwindow, display_nhwindow, end_menu, start_menu,
} from "./winprocs.h.macros.js";
import {
    ANY_INT, ANY_SCHAR, ANY_UCHAR, ATR_NONE, MENU_BEHAVE_STANDARD, MENU_ITEMFLAGS_NONE,
    MENU_ITEMFLAGS_SELECTED, NHW_MENU, PICK_NONE, PICK_ONE, struct_any, struct_mi,
} from "./wintype.h.js";
import { struct_you } from "./you.h.js";
import { jmp_buf } from "../libc/records.js";
import { SIZE } from "../rt/cmacros.js";
import { char, int, long, ord, schar, sizeof, sizeof_string, unsigned } from "../rt/ctypes.js";
import { chars, stack_frame, stack_pop, uchars } from "../rt/heap.js";
import { i64, or64, shl64 } from "../rt/int64.js";
import {
    SEEK_END, SEEK_SET, assert, free, getenv, longjmp, memcpy, memset, sprintf, strchr, strcmp,
    strcpy, strlen, strncat, strncmp, strtoull,
} from "../rt/libc.js";
import {
    init_list, init_string, stack_array, stack_struct, stack_var, static_array, static_var,
} from "../rt/locals.js";
import {
    luaL_checkinteger, luaL_checkoption, luaL_checktype, luaL_loadbufferx, luaL_loadstring,
    luaL_requiref, luaL_setfuncs, luaL_traceback, lua_atpanic, lua_close, lua_createtable,
    lua_error, lua_gc, lua_getallocf, lua_getfield, lua_getglobal, lua_getinfo, lua_getstack,
    lua_gettable, lua_gettop, lua_isstring, lua_newstate, lua_next, lua_pushboolean,
    lua_pushinteger, lua_pushnil, lua_pushstring, lua_pushvalue, lua_rawset, lua_setfield,
    lua_setglobal, lua_sethook, lua_setmetatable, lua_settable, lua_settop, lua_setwarnf,
    lua_toboolean, lua_tolstring, lua_type, luaopen_base, luaopen_coroutine, luaopen_debug,
    luaopen_math, luaopen_os, luaopen_string, luaopen_table, luaopen_utf8,
} from "../rt/lua.js";
import { setjmp_caught } from "../rt/setjmp.js";
import { _ } from "../rt/strings.js";
import {
    addr_of, array_of, ptr_add, ptr_to, record_or_opaque, ref_of, ref_to, sizeof_member, struct,
    struct_assign, view_of, void_t,
} from "../rt/struct.js";
import { moveloop_core } from "./allmain.js";
import { alloc, dupstr, re_alloc } from "./alloc.js";
import { l_get_config_errors, parse_conf_str, parse_config_line } from "./cfgfiles.js";
import { cmd_from_ecname, cmdq_add_key, isok, levltyp_to_name } from "./cmd.js";
import {
    cg, emptystr, gg, gi, gl, gm, gs, gu, iflags, nhcb_counts, nhcb_name, svd, svm, svn, svs, u,
} from "./decl.js";
import { nul_glyphinfo } from "./display.js";
import { def_oc_syms } from "./drawing.js";
import { Invocation_lev, depth, level_difficulty } from "./dungeon.js";
import { init_uhunger } from "./eat.js";
import { panic } from "./end.js";
import { paniclog } from "./files.js";
import { long_to_any } from "./hack.js";
import { eos, ing_suffix, s_suffix, strncmpi } from "./hacklib.js";
import { addinv_nomerge, freeinv, update_inventory, useupall } from "./invent.js";
import { extract_nobj } from "./mkobj.js";
import { mongone } from "./mon.js";
import { name_to_mon } from "./mondata.js";
import { mons } from "./monst.js";
import { l_obj_register, nhl_obj_u_giveobj, nhl_push_obj } from "./nhlobj.js";
import { l_selection_register } from "./nhlsel.js";
import { objects } from "./objects.js";
import { an, makeplural, makesingular } from "./objnam.js";
import { get_option_value, nh_getenv } from "./options.js";
import { impossible, livelog_printf, pline, verbalize } from "./pline.js";
import { rn2, rng_log_set_caller } from "./rnd.js";
import { sfi_unsigned } from "./sfbase.js";
import { obfree } from "./shk.js";
import {
    cvt_to_abscoord, flip_level, get_coord, get_trapname_bytype, l_register_des, nhl_abs_coord,
} from "./sp_lev.js";
import { spot_stop_timers, spot_time_expires, start_timer } from "./timeout.js";
import { deltrap, t_at } from "./trap.js";
import { add_menu, add_menu_str, getlin, select_menu } from "./windows.js";
import { setnotworn, setworn } from "./worn.js";
const struct_lua_State = record_or_opaque("struct_lua_State");
const __FILE__ = "nhlua.c";
