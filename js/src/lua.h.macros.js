/* unsigned integer type */

/* type for continuation-function contexts */

/*
** Type for C functions registered with Lua
*/

/*
** Type for continuation functions
*/

/*
** Type for functions that read/write blocks when loading/dumping Lua chunks
*/

/*
** Type for memory-allocation functions
*/

/*
** Type for warning functions
*/

/*
** Type used by the debug API to collect debug information
*/

/*
** Functions to be called by the debugger in specific events
*/

/*
** generic extra include file
*/

/*
** RCS ident string
*/

/*
** state manipulation
*/

/* Deprecated! */

/*
** basic stack manipulation
*/

/*
** access functions (stack -> C)
*/

/*
** Comparison and arithmetic functions
*/

/*
** push functions (C -> stack)
*/

/*
** get functions (Lua -> stack)
*/

/*
** set functions (stack -> Lua)
*/

/*
** 'load' and 'call' functions (load and run Lua code)
*/

export function lua_call(L, n, r) { return lua_callk(L, n, r, 0, null); }

export function lua_pcall(L, n, r, f) { return lua_pcallk(L, n, r, f, 0, null); }

/*
** miscellaneous functions
*/

/*
** {==============================================================
** some useful macros
** ===============================================================
*/

export function lua_tointeger(L, i) { return lua_tointegerx(L,i,null); }

export function lua_pop(L, n) { return lua_settop(L, -n-1); }

export function lua_newtable(L) { return lua_createtable(L, 0, 0); }

export function lua_pushcfunction(L, f) { return lua_pushcclosure(L, f, 0); }

export function lua_istable(L, n) { return +(lua_type(L, n) == LUA_TTABLE); }

export function lua_isnil(L, n) { return +(lua_type(L, n) == LUA_TNIL); }

export function lua_tostring(L, i) { return lua_tolstring(L, i, null); }

export function lua_insert(L, idx) { return lua_rotate(L, idx, 1); }

export function lua_remove(L, idx) { return (lua_rotate(L, idx, -1), lua_pop(L, 1)); }

/* }============================================================== */

/*
** {==============================================================
** compatibility macros
** ===============================================================
*/

export function lua_newuserdata(L, s) { return lua_newuserdatauv(L,s,1); }

import { LUA_TNIL, LUA_TTABLE } from "./lua.h.js";
import {
    lua_callk, lua_createtable, lua_newuserdatauv, lua_pcallk, lua_pushcclosure, lua_rotate,
    lua_settop, lua_tointegerx, lua_tolstring, lua_type,
} from "../rt/lua.js";
