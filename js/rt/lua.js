// rt/lua.js: the Lua C API as seen by emitted code.
//
// Lua 5.4 is part of the residue (compiled C that never changes: js/vendor/clib-lua.js). Emitted code calls the API under its C names; each is
// forwarded to the residue by the host (machine.libc(name, args)), like rt/libc.js. The lua.h /
// lauxlib.h macros (lua_pop, lua_tostring, lua_pcall, ...) are emitted from the headers as calls
// of these functions. Opaque handles (lua_State *, lua_Debug *) cross as addresses or views.

import { libc_function } from "./heap.js";

function residue(name) { return libc_function(name); }

// lua.h: state, stack, access, push, get/set, calls, misc
export const lua_newstate = residue("lua_newstate");
export const lua_close = residue("lua_close");
export const lua_atpanic = residue("lua_atpanic");
export const lua_setwarnf = residue("lua_setwarnf");
export const lua_getallocf = residue("lua_getallocf");
export const lua_gettop = residue("lua_gettop");
export const lua_settop = residue("lua_settop");
export const lua_pushvalue = residue("lua_pushvalue");
export const lua_rotate = residue("lua_rotate");
export const lua_type = residue("lua_type");
export const lua_typename = residue("lua_typename");
export const lua_isnumber = residue("lua_isnumber");
export const lua_isstring = residue("lua_isstring");
export const lua_toboolean = residue("lua_toboolean");
export const lua_tointegerx = residue("lua_tointegerx");
export const lua_tolstring = residue("lua_tolstring");
export const lua_len = residue("lua_len");
export const lua_pushnil = residue("lua_pushnil");
export const lua_pushnumber = residue("lua_pushnumber");
export const lua_pushinteger = residue("lua_pushinteger");
export const lua_pushstring = residue("lua_pushstring");
export const lua_pushcclosure = residue("lua_pushcclosure");
export const lua_pushboolean = residue("lua_pushboolean");
export const lua_getglobal = residue("lua_getglobal");
export const lua_gettable = residue("lua_gettable");
export const lua_getfield = residue("lua_getfield");
export const lua_createtable = residue("lua_createtable");
export const lua_newuserdatauv = residue("lua_newuserdatauv");
export const lua_setglobal = residue("lua_setglobal");
export const lua_settable = residue("lua_settable");
export const lua_setfield = residue("lua_setfield");
export const lua_rawset = residue("lua_rawset");
export const lua_setmetatable = residue("lua_setmetatable");
export const lua_callk = residue("lua_callk");
export const lua_pcallk = residue("lua_pcallk");
export const lua_gc = residue("lua_gc");
export const lua_error = residue("lua_error");
export const lua_next = residue("lua_next");
export const lua_getstack = residue("lua_getstack");
export const lua_getinfo = residue("lua_getinfo");
export const lua_sethook = residue("lua_sethook");
// lauxlib.h
export const luaL_checkversion_ = residue("luaL_checkversion_");
export const luaL_newmetatable = residue("luaL_newmetatable");
export const luaL_checkudata = residue("luaL_checkudata");
export const luaL_checklstring = residue("luaL_checklstring");
export const luaL_optlstring = residue("luaL_optlstring");
export const luaL_checkinteger = residue("luaL_checkinteger");
export const luaL_optinteger = residue("luaL_optinteger");
export const luaL_checktype = residue("luaL_checktype");
export const luaL_checkoption = residue("luaL_checkoption");
export const luaL_loadbufferx = residue("luaL_loadbufferx");
export const luaL_loadstring = residue("luaL_loadstring");
export const luaL_setfuncs = residue("luaL_setfuncs");
export const luaL_requiref = residue("luaL_requiref");
export const luaL_traceback = residue("luaL_traceback");
// lualib.h
export const luaopen_base = residue("luaopen_base");
export const luaopen_coroutine = residue("luaopen_coroutine");
export const luaopen_table = residue("luaopen_table");
export const luaopen_os = residue("luaopen_os");
export const luaopen_string = residue("luaopen_string");
export const luaopen_utf8 = residue("luaopen_utf8");
export const luaopen_math = residue("luaopen_math");
export const luaopen_debug = residue("luaopen_debug");
