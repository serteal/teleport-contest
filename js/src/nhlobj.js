/* NetHack 5.0	nhlobj.c	$NHDT-Date: 1576097301 2019/12/11 20:48:21 $  $NHDT-Branch: NetHack-3.7 $:$NHDT-Revision: 1.0 $ */
/*      Copyright (c) 2019 by Pasi Kallinen */
/* NetHack may be freely redistributed.  See license for details. */

const struct__lua_obj = struct("struct__lua_obj", {
    state: int,
    obj: ptr_to("struct_obj"),
});

export function lobj_is_ok(lo) { return (lo && lo.obj && lo.obj.where != OBJ_LUAFREE ? 1 : 0); }

function l_obj_check(L, indx) { /* struct _lua_obj * */
    let lo;

    luaL_checktype(L, indx, LUA_TUSERDATA);
    lo = view_of(struct__lua_obj, luaL_checkudata(L, indx, _("obj")));
    if (!lo)
        nhl_error(L, _("Obj error"));
    return lo;
}

function l_obj_gc(L) { /* int */
    let obj, otmp;
    let lo = l_obj_check(L, 1);

    if (lo && (obj = lo.obj) != null) {
        if (obj.lua_ref_cnt > 0)
            obj.lua_ref_cnt--;
        /* free-floating objects with no other refs are deallocated. */
        if (!obj.lua_ref_cnt
            && (obj.where == OBJ_FREE || obj.where == OBJ_LUAFREE)) {
            if (Has_contents(obj)) {
                while ((otmp = obj.cobj) != null) {
                    obj_extract_self(otmp);
                    dealloc_obj(otmp);
                }
            }
            obj.where = OBJ_FREE;
            dealloc_obj(obj), obj = null;
        }
        lo.obj = null;
    }
    return 0;
}

function l_obj_push(L, otmp) { /* struct _lua_obj * */
    let lo = view_of(struct__lua_obj, lua_newuserdata(L, sizeof(struct__lua_obj)));

    luaL_getmetatable(L, _("obj"));
    lua_setmetatable(L, -2);

    lo.state = 0;
    lo.obj = otmp;
    if (otmp)
        otmp.lua_ref_cnt++;

    return lo;
}

export function nhl_push_obj(L, otmp) { /* void */
    l_obj_push(L, otmp);
}

/* local o = obj.new("large chest");
   local cobj = o:contents(); */
function l_obj_getcontents(L) { /* int */
    let lo = l_obj_check(L, 1);
    let obj = lo.obj;

    if (!obj)
        nhl_error(L, _("l_obj_getcontents: no obj"));

    l_obj_push(L, obj.cobj);
    return 1;
}

/* Puts object inside another object. */
/* local box = obj.new("large chest");
   box:addcontent(obj.new("rock"));
*/
function l_obj_add_to_container(L) { /* int */
    let lobox = l_obj_check(L, 1);
    let lo = l_obj_check(L, 2);
    let otmp;
    let refs;

    if (!lobj_is_ok(lo) || !lobj_is_ok(lobox))
        return 0;

    refs = int(lo.obj.lua_ref_cnt);

    obj_extract_self(lo.obj);
    otmp = add_to_container(lobox.obj, lo.obj);

    /* was lo->obj merged? */
    if (otmp != lo.obj) {
        lo.obj = otmp;
        lo.obj.lua_ref_cnt += unsigned(refs);
    }
    lobox.obj.owt = unsigned(weight(lobox.obj));

    return 0;
}

/* Put object into player's inventory */
/* u.giveobj(obj.new("rock")); */
export function nhl_obj_u_giveobj(L) { /* int */
    let lo = l_obj_check(L, 1);
    let otmp;
    let refs;

    if (!lobj_is_ok(lo) || lo.obj.where == OBJ_INVENT)
        return 0;

    refs = int(lo.obj.lua_ref_cnt);

    obj_extract_self(lo.obj);
    otmp = addinv(lo.obj);

    if (otmp != lo.obj) {
        lo.obj.lua_ref_cnt += unsigned(refs);
        lo.obj = otmp;
    }

    return 0;
}

/* Get a table of object class data. */
/* local odata = obj.class(otbl.otyp); */
/* local odata = obj.class(obj.new("rock")); */
/* local odata = o:class(); */
function l_obj_objects_to_table(L) { /* int */
    let argc = lua_gettop(L);
    let otyp = -1;
    let o;

    if (argc != 1) {
        nhl_error(L, _("l_obj_objects_to_table: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    if (lua_type(L, 1) == LUA_TNUMBER) {
        otyp = int(luaL_checkinteger(L, 1));
    } else if (lua_type(L, 1) == LUA_TUSERDATA) {
        let lo = l_obj_check(L, 1);
        if (lo && lo.obj)
            otyp = lo.obj.otyp;
    }
    lua_pop(L, 1);

    if (otyp == -1) {
        nhl_error(L, _("l_obj_objects_to_table: Wrong args"));
        /*NOTREACHED*/
        return 0;
    }

    o = objects[otyp];

    lua_newtable(L);

    if (OBJ_NAME(objects[otyp]))
        nhl_add_table_entry_str(L, _("name"), OBJ_NAME(objects[otyp]));
    if (OBJ_DESCR(objects[otyp]))
        nhl_add_table_entry_str(L, _("descr"),
                                OBJ_DESCR(objects[otyp]));
    if (o.oc_uname)
        nhl_add_table_entry_str(L, _("uname"), o.oc_uname);

    nhl_add_table_entry_int(L, _("name_known"), o.oc_name_known);
    nhl_add_table_entry_int(L, _("merge"), o.oc_merge);
    nhl_add_table_entry_int(L, _("uses_known"), o.oc_uses_known);
    nhl_add_table_entry_int(L, _("encountered"), o.oc_encountered);
    nhl_add_table_entry_int(L, _("magic"), o.oc_magic);
    nhl_add_table_entry_int(L, _("charged"), o.oc_charged);
    nhl_add_table_entry_int(L, _("unique"), o.oc_unique);
    nhl_add_table_entry_int(L, _("nowish"), o.oc_nowish);
    nhl_add_table_entry_int(L, _("big"), o.oc_big);
    /* TODO: oc_bimanual, oc_bulky */
    nhl_add_table_entry_int(L, _("tough"), o.oc_tough);
    nhl_add_table_entry_int(L, _("dir"), o.oc_dir); /* TODO: convert to text */
    nhl_add_table_entry_str(L, _("material"), materialnm[o.oc_material]);
    /* TODO: oc_subtyp, oc_skill, oc_armcat */
    nhl_add_table_entry_int(L, _("oprop"), o.oc_oprop);
    nhl_add_table_entry_char(L, _("class"),
                             def_oc_syms[uchar(o.oc_class)].sym);
    nhl_add_table_entry_int(L, _("delay"), o.oc_delay);
    nhl_add_table_entry_int(L, _("color"), o.oc_color); /* TODO: text? */
    nhl_add_table_entry_int(L, _("prob"), o.oc_prob);
    nhl_add_table_entry_int(L, _("weight"), o.oc_weight);
    nhl_add_table_entry_int(L, _("cost"), o.oc_cost);
    nhl_add_table_entry_int(L, _("damage_small"), o.oc_wsdam);
    nhl_add_table_entry_int(L, _("damage_large"), o.oc_wldam);
    /* TODO: oc_oc1, oc_oc2, oc_hitbon, a_ac, a_can, oc_level */
    nhl_add_table_entry_int(L, _("nutrition"), o.oc_nutrition);

    return 1;
}

/* Create a lua table representation of the object, unpacking all the
   object fields.
   local o = obj.new("rock");
   local otbl = o:totable(); */
function l_obj_to_table(L) { /* int */
    let lo = l_obj_check(L, 1);
    let obj = lo.obj;

    lua_newtable(L);

    if (!obj || obj.where == OBJ_LUAFREE) {
        nhl_add_table_entry_int(L, _("NO_OBJ"), 1);
        return 1;
    }

    nhl_add_table_entry_int(L, _("has_contents"), Has_contents(obj));
    nhl_add_table_entry_int(L, _("is_container"), Is_container(obj));
    nhl_add_table_entry_int(L, _("o_id"), obj.o_id);
    nhl_add_table_entry_int(L, _("ox"), obj.ox);
    nhl_add_table_entry_int(L, _("oy"), obj.oy);
    nhl_add_table_entry_int(L, _("otyp"), obj.otyp);
    if (OBJ_NAME(objects[obj.otyp]))
        nhl_add_table_entry_str(L, _("otyp_name"), OBJ_NAME(objects[obj.otyp]));
    if (OBJ_DESCR(objects[obj.otyp]))
        nhl_add_table_entry_str(L, _("otyp_descr"),
                                OBJ_DESCR(objects[obj.otyp]));
    nhl_add_table_entry_int(L, _("owt"), obj.owt);
    nhl_add_table_entry_int(L, _("quan"), obj.quan);
    nhl_add_table_entry_int(L, _("spe"), obj.spe);

    if (obj.otyp == STATUE)
        nhl_add_table_entry_int(L, _("historic"),
                                +((obj.spe & CORPSTAT_HISTORIC) != 0));
    if (obj.otyp == CORPSE || obj.otyp == STATUE) {
        nhl_add_table_entry_int(L, _("male"),
                                +((obj.spe & CORPSTAT_MALE) != 0));
        nhl_add_table_entry_int(L, _("female"),
                                +((obj.spe & CORPSTAT_FEMALE) != 0));
    }

    nhl_add_table_entry_char(L, _("oclass"),
                             def_oc_syms[uchar(obj.oclass)].sym);
    nhl_add_table_entry_char(L, _("invlet"), obj.invlet);
    /* TODO: nhl_add_table_entry_char(L, "oartifact", obj->oartifact);*/
    nhl_add_table_entry_int(L, _("where"), obj.where);
    /* TODO: nhl_add_table_entry_int(L, "timed", obj->timed); */
    nhl_add_table_entry_int(L, _("cursed"), obj.cursed);
    nhl_add_table_entry_int(L, _("blessed"), obj.blessed);
    nhl_add_table_entry_int(L, _("unpaid"), obj.unpaid);
    nhl_add_table_entry_int(L, _("no_charge"), obj.no_charge);
    nhl_add_table_entry_int(L, _("known"), obj.known);
    nhl_add_table_entry_int(L, _("dknown"), obj.dknown);
    nhl_add_table_entry_int(L, _("bknown"), obj.bknown);
    nhl_add_table_entry_int(L, _("rknown"), obj.rknown);
    nhl_add_table_entry_int(L, _("tknown"), obj.tknown);
    if (obj.oclass == POTION_CLASS)
        nhl_add_table_entry_int(L, _("odiluted"), obj.oeroded);
    else
        nhl_add_table_entry_int(L, _("oeroded"), obj.oeroded);
    nhl_add_table_entry_int(L, _("oeroded2"), obj.oeroded2);
    /* TODO: orotten, norevive */
    nhl_add_table_entry_int(L, _("oerodeproof"), obj.oerodeproof);
    nhl_add_table_entry_int(L, _("olocked"), obj.olocked);
    nhl_add_table_entry_int(L, _("obroken"), obj.obroken);
    if (is_poisonable(obj))
        nhl_add_table_entry_int(L, _("opoisoned"), obj.otrapped);
    else
        nhl_add_table_entry_int(L, _("otrapped"), obj.otrapped);
    /* TODO: degraded_horn */
    nhl_add_table_entry_int(L, _("recharged"), obj.recharged);
    /* TODO: on_ice */
    nhl_add_table_entry_int(L, _("lamplit"), obj.lamplit);
    nhl_add_table_entry_int(L, _("globby"), obj.globby);
    nhl_add_table_entry_int(L, _("greased"), obj.greased);
    nhl_add_table_entry_int(L, _("nomerge"), obj.nomerge);
    nhl_add_table_entry_int(L, _("how_lost"), obj.how_lost);
    nhl_add_table_entry_int(L, _("in_use"), obj.in_use);
    nhl_add_table_entry_int(L, _("bypass"), obj.bypass);
    nhl_add_table_entry_int(L, _("cknown"), obj.cknown);
    nhl_add_table_entry_int(L, _("lknown"), obj.lknown);
    nhl_add_table_entry_int(L, _("corpsenm"), obj.corpsenm);
    if (obj.corpsenm != NON_PM
        && (obj.otyp == TIN || obj.otyp == CORPSE || obj.otyp == EGG
            || obj.otyp == FIGURINE || obj.otyp == STATUE))
        nhl_add_table_entry_str(L, _("corpsenm_name"),
                                mons[obj.corpsenm].pmnames[NEUTRAL]);
    /* TODO: leashmon, fromsink, novelidx, record_achieve_special */
    nhl_add_table_entry_int(L, _("usecount"), obj.usecount);
    /* TODO: spestudied */
    nhl_add_table_entry_int(L, _("oeaten"), obj.oeaten);
    nhl_add_table_entry_int(L, _("age"), obj.age);
    nhl_add_table_entry_int(L, _("owornmask"), obj.owornmask);
    /* TODO: more of oextra */
    nhl_add_table_entry_int(L, _("has_oname"), has_oname(obj));
    if (has_oname(obj))
        nhl_add_table_entry_str(L, _("oname"), ONAME(obj));

    return 1;
}

/* create a new object via wishing routine */
/* local o = obj.new("rock"); */
/* local o = obj.new({ id = "food ration", class = "%" }); */
function l_obj_new_readobjnam(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc == 1 && lua_type(L, 1) == LUA_TSTRING) {
        let buf = stack_array(char, BUFSZ);
        let otmp;

        sprintf(buf, _("%s"), luaL_checkstring(L, 1));
        lua_pop(L, 1);
        if ((otmp = readobjnam(buf, null)) == hands_obj)
            otmp = null;
        l_obj_push(L, otmp);
        return 1;
    } else if (argc == 1 && lua_type(L, 1) == LUA_TTABLE) {
        let id = get_table_objtype(L);
        let class_ = get_table_objclass(L);
        let otmp;

        if (id >= FIRST_OBJECT) {
            otmp = mksobj(id, TRUE, FALSE);
        } else {
            class_ = def_char_to_objclass(class_);
            if (class_ >= MAXOCLASSES)
                class_ = RANDOM_CLASS;
            otmp = mkobj(class_, FALSE);
        }
        lua_pop(L, 1);
        l_obj_push(L, otmp);
        return 1;
    } else
        nhl_error(L, _("l_obj_new_readobjname: Wrong args"));
    /*NOTREACHED*/
    return 0;
    } finally { stack_pop($frame); }
}

/* Get the topmost object on the map at x,y */
/* local o = obj.at(x, y); */
function l_obj_at(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);

    if (argc == 2) {
        let x = stack_var(coordxy), y = stack_var(coordxy);

        x[0] = coordxy(luaL_checkinteger(L, 1));
        y[0] = coordxy(luaL_checkinteger(L, 2));
        cvt_to_abscoord(x, y);

        lua_pop(L, 2);
        l_obj_push(L, svl.level.objects[x[0]][y[0]]);
        return 1;
    } else
        nhl_error(L, _("l_obj_at: Wrong args"));
    /*NOTREACHED*/
    return 0;
    } finally { stack_pop($frame); }
}

/* Place an object on the map at (x,y).
   local o = obj.new("rock");
   o:placeobj(u.ux, u.uy); */
function l_obj_placeobj(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let lo = l_obj_check(L, 1);
    let x = stack_var(coordxy), y = stack_var(coordxy);

    if (argc != 3)
        nhl_error(L, _("l_obj_placeobj: Wrong args"));

    x[0] = coordxy(luaL_checkinteger(L, 2));
    y[0] = coordxy(luaL_checkinteger(L, 3));
    cvt_to_abscoord(x, y);

    lua_pop(L, 3);

    if (lobj_is_ok(lo)) {
        obj_extract_self(lo.obj);
        place_object(lo.obj, x[0], y[0]);
        newsym(x[0], y[0]);
    }

    return 0;
    } finally { stack_pop($frame); }
}

/* Get the next object in the object chain */
/* local o = obj.at(x, y);
   local o2 = o:next(true);
   local firstobj = obj.next();
*/
function l_obj_nextobj(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 0) {
        l_obj_push(L, fobj());
    } else {
        let lo = l_obj_check(L, 1);
        let use_nexthere = FALSE;

        if (argc == 2)
            use_nexthere = lua_toboolean(L, 2);

        if (lo && lo.obj)
            l_obj_push(L, (use_nexthere && lo.obj.where == OBJ_FLOOR)
                                  ? lo.obj.v.v_nexthere
                                  : lo.obj.nobj);
    }
    return 1;
}

/* Get the container object is in */
/* local box = o:container(); */
function l_obj_container(L) { /* int */
    let lo = l_obj_check(L, 1);

    if (lo && lo.obj && lo.obj.where == OBJ_CONTAINED)
        l_obj_push(L, lo.obj.v.v_ocontainer);
    else
        l_obj_push(L, null);
    return 1;
}

/* Is the object a null? */
/* local badobj = o:isnull(); */
function l_obj_isnull(L) { /* int */
    let lo = l_obj_check(L, 1);

    lua_pushboolean(L, +!lobj_is_ok(lo));
    return 1;
}

/* does object have a timer of certain type? */
/* local hastimer = o:has_timer("rot-organic"); */
function l_obj_timer_has(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 2) {
        let lo = l_obj_check(L, 1);
        let timertype = nhl_get_timertype(L, 2);

        if (timer_is_obj(timertype) && lo && lo.obj) {
            lua_pushboolean(L, obj_has_timer(lo.obj, timertype));
            return 1;
        } else {
            lua_pushboolean(L, FALSE);
            return 1;
        }
    } else
        nhl_error(L, _("l_obj_timer_has: Wrong args"));
    return 0;
}

/* peek at an object timer. return the turn when timer triggers.
   returns 0 if no such timer attached to the object. */
/* local timeout = o:peek_timer("hatch-egg"); */
function l_obj_timer_peek(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 2) {
        let lo = l_obj_check(L, 1);
        let timertype = nhl_get_timertype(L, 2);

        if (timer_is_obj(timertype) && lo && lo.obj) {
            lua_pushinteger(L, peek_timer(timertype, obj_to_any(lo.obj)));
            return 1;
        } else {
            lua_pushinteger(L, 0);
            return 1;
        }
    } else
        nhl_error(L, _("l_obj_timer_peek: Wrong args"));
    /*NOTREACHED*/
    return 0;
}

/* stop object timer(s). return the turn when timer triggers.
   returns 0 if no such timer attached to the object.
   without a timer type parameter, stops all timers for the object. */
/* local timeout = o:stop_timer("rot-organic"); */
/* o:stop_timer(); */
function l_obj_timer_stop(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 1) {
        let lo = l_obj_check(L, 1);

        if (lo && lo.obj)
            obj_stop_timers(lo.obj);
        return 0;
    } else if (argc == 2) {
        let lo = l_obj_check(L, 1);
        let timertype = nhl_get_timertype(L, 2);

        if (timer_is_obj(timertype) && lo && lo.obj) {
            lua_pushinteger(L, stop_timer(timertype, obj_to_any(lo.obj)));
            return 1;
        } else {
            lua_pushinteger(L, 0);
            return 1;
        }
    } else
        nhl_error(L, _("l_obj_timer_stop: Wrong args"));
    return 0;
}

/* start an object timer. */
/* o:start_timer("hatch-egg", 10); */
function l_obj_timer_start(L) { /* int */
    let argc = lua_gettop(L);

    if (argc == 3) {
        let lo = l_obj_check(L, 1);
        let timertype = nhl_get_timertype(L, 2);
        let when = luaL_checkinteger(L, 3);

        if (timer_is_obj(timertype) && lo && lo.obj && when > 0) {
            if (obj_has_timer(lo.obj, timertype))
                stop_timer(timertype, obj_to_any(lo.obj));
            start_timer(when, TIMER_OBJECT, timertype, obj_to_any(lo.obj));
        }
    } else
        nhl_error(L, _("l_obj_timer_start: Wrong args"));
    return 0;
}

/* bury an obj. returns true if object is gone (merged with ground),
   false otherwise. */
/* local ogone = o:bury(); */
/* local ogone = o:bury(5,5); */
function l_obj_bury(L) { /* int */
    const $frame = stack_frame(); try {
    let argc = lua_gettop(L);
    let dealloced = stack_var(boolean, FALSE);
    let lo = l_obj_check(L, 1);
    let x = stack_var(coordxy, 0), y = stack_var(coordxy, 0);

    if (argc == 1) {
        x[0] = lo.obj.ox;
        y[0] = lo.obj.oy;
    } else if (argc == 3) {
        x[0] = coordxy(lua_tointeger(L, 2));
        y[0] = coordxy(lua_tointeger(L, 3));
        cvt_to_abscoord(x, y);
    } else
        nhl_error(L, _("l_obj_bury: Wrong args"));

    if (lobj_is_ok(lo) && isok(x[0], y[0])) {
        lo.obj.ox = x[0];
        lo.obj.oy = y[0];
        bury_an_obj(lo.obj, addr_of(dealloced));
    }
    lua_pushboolean(L, dealloced[0]);
    return 1;
    } finally { stack_pop($frame); }
}

const l_obj_methods = static_array("l_obj_methods", struct_luaL_Reg, null, [
    { name: _("new"), func: l_obj_new_readobjnam },
    { name: _("isnull"), func: l_obj_isnull },
    { name: _("at"), func: l_obj_at },
    { name: _("next"), func: l_obj_nextobj },
    { name: _("totable"), func: l_obj_to_table },
    { name: _("class"), func: l_obj_objects_to_table },
    { name: _("placeobj"), func: l_obj_placeobj },
    { name: _("container"), func: l_obj_container },
    { name: _("contents"), func: l_obj_getcontents },
    { name: _("addcontent"), func: l_obj_add_to_container },
    { name: _("has_timer"), func: l_obj_timer_has },
    { name: _("peek_timer"), func: l_obj_timer_peek },
    { name: _("stop_timer"), func: l_obj_timer_stop },
    { name: _("start_timer"), func: l_obj_timer_start },
    { name: _("bury"), func: l_obj_bury },
    { name: 0, func: null }
]);

const l_obj_meta = static_array("l_obj_meta", struct_luaL_Reg, null, [
    { name: _("__gc"), func: l_obj_gc },
    { name: 0, func: null }
]);

export function l_obj_register(L) { /* int */
    /* Table of instance methods (e.g. an_object:isnull())
       and static methods (e.g. obj.new("dagger")). */
    luaL_newlib(L, l_obj_methods);

    /* metatable = { __name = "obj", __gc = l_obj_gc } */
    luaL_newmetatable(L, _("obj"));
    luaL_setfuncs(L, l_obj_meta[0], 0);
    /* metatable.__index points at the object method table. */
    lua_pushvalue(L, -2);
    lua_setfield(L, -2, _("__index"));

    /* Don't let lua code mess with the real metatable.
       Instead offer a fake one that only contains __gc. */
    ((luaL_checkversion(L), lua_createtable(L, 0, (Math.trunc((static_sizeof("l_obj_meta") / sizeof(struct_luaL_Reg))) - 1))), luaL_setfuncs(L, l_obj_meta[0], 0));
    lua_setfield(L, -2, _("__metatable"));

    /* We don't need the metatable anymore. It's safe in the
       Lua registry for use by luaL_setmetatable. */
    lua_pop(L, 1);

    /* global obj = the method table we created at the start */
    lua_setglobal(L, _("obj"));
    return 0;
}

/* for 'onefile' processing where end of this file isn't necessarily the
   end of the source code seen by the compiler */

/*nhlobj.c*/

import { MAXOCLASSES, POTION_CLASS, RANDOM_CLASS } from "./defsym.h.js";
import { BUFSZ, FALSE, TRUE, boolean, coordxy } from "./global.h.js";
import { CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_MALE } from "./hack.h.js";
import { struct_luaL_Reg } from "./lauxlib.h.js";
import {
    luaL_checkstring, luaL_checkversion, luaL_getmetatable, luaL_newlib,
} from "./lauxlib.h.macros.js";
import { LUA_TNUMBER, LUA_TSTRING, LUA_TTABLE, LUA_TUSERDATA } from "./lua.h.js";
import { lua_newtable, lua_newuserdata, lua_pop, lua_tointeger } from "./lua.h.macros.js";
import { NEUTRAL } from "./monflag.h.js";
import { NON_PM } from "./monsters.h.js";
import { OBJ_CONTAINED, OBJ_FLOOR, OBJ_FREE, OBJ_INVENT, OBJ_LUAFREE } from "./obj.h.js";
import { Has_contents, Is_container, ONAME, has_oname, is_poisonable } from "./obj.h.macros.js";
import { OBJ_DESCR, OBJ_NAME } from "./objclass.h.macros.js";
import { CORPSE, EGG, FIGURINE, FIRST_OBJECT, STATUE, TIN } from "./objects.h.js";
import { fobj } from "./rm.h.macros.js";
import { TIMER_OBJECT } from "./timeout.h.js";
import { timer_is_obj } from "./timeout.h.macros.js";
import { char, int, sizeof, uchar, unsigned } from "../rt/ctypes.js";
import { stack_frame, stack_pop } from "../rt/heap.js";
import { sprintf } from "../rt/libc.js";
import { stack_array, stack_var, static_array, static_sizeof } from "../rt/locals.js";
import {
    luaL_checkinteger, luaL_checktype, luaL_checkudata, luaL_newmetatable, luaL_setfuncs,
    lua_createtable, lua_gettop, lua_pushboolean, lua_pushinteger, lua_pushvalue, lua_setfield,
    lua_setglobal, lua_setmetatable, lua_toboolean, lua_type,
} from "../rt/lua.js";
import { _ } from "../rt/strings.js";
import { addr_of, ptr_to, struct, view_of } from "../rt/struct.js";
import { isok } from "./cmd.js";
import { hands_obj, materialnm, svl } from "./decl.js";
import { bury_an_obj } from "./dig.js";
import { newsym } from "./display.js";
import { def_char_to_objclass, def_oc_syms } from "./drawing.js";
import { obj_to_any } from "./hack.js";
import { addinv } from "./invent.js";
import {
    add_to_container, dealloc_obj, mkobj, mksobj, obj_extract_self, place_object, weight,
} from "./mkobj.js";
import { mons } from "./monst.js";
import {
    nhl_add_table_entry_char, nhl_add_table_entry_int, nhl_add_table_entry_str, nhl_error,
    nhl_get_timertype,
} from "./nhlua.js";
import { objects } from "./objects.js";
import { readobjnam } from "./objnam.js";
import { cvt_to_abscoord, get_table_objclass, get_table_objtype } from "./sp_lev.js";
import { obj_has_timer, obj_stop_timers, peek_timer, start_timer, stop_timer } from "./timeout.js";
