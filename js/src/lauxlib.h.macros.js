export function luaL_checkversion(L) { return luaL_checkversion_(L, LUA_VERSION_NUM, LUAL_NUMSIZES); }

/* predefined references */

/*
** ===============================================================
** some useful macros
** ===============================================================
*/

export function luaL_newlibtable(L, l) { return lua_createtable(L, 0, Math.trunc(static_sizeof("l_obj_methods")/sizeof(struct_luaL_Reg)) - 1); }

export function luaL_newlib(L, l) { return (luaL_checkversion(L), luaL_newlibtable(L,l), luaL_setfuncs(L,l[0],0)); }

export function luaL_checkstring(L, n) { return luaL_checklstring(L, n, null); }
export function luaL_optstring(L, n, d) { return luaL_optlstring(L, n, d, null); }

export function luaL_typename(L, i) { return lua_typename(L, lua_type(L,i)); }

export function luaL_getmetatable(L, n) { return lua_getfield(L, LUA_REGISTRYINDEX, (n)); }

import { LUAL_NUMSIZES, struct_luaL_Reg } from "./lauxlib.h.js";
import { LUA_REGISTRYINDEX, LUA_VERSION_NUM } from "./lua.h.js";
import { sizeof } from "../rt/ctypes.js";
import { static_sizeof } from "../rt/locals.js";
import {
    luaL_checklstring, luaL_checkversion_, luaL_optlstring, luaL_setfuncs, lua_createtable,
    lua_getfield, lua_type, lua_typename,
} from "../rt/lua.js";
