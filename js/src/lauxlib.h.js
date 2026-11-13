/*
** $Id: lauxlib.h $
** Auxiliary functions for building Lua libraries
** See Copyright Notice in lua.h
*/

/* global table */
export const LUA_GNAME = "_G";

/* extra error code for 'luaL_loadfilex' */

/* key, in the registry, for table of loaded modules */

/* key, in the registry, for table of preloaded loaders */

export const struct_luaL_Reg = struct("struct_luaL_Reg", {
  name: ptr_to(char),
  func: fnptr_t,
});

export const LUAL_NUMSIZES = (sizeof(long)*16 + sizeof(double));

/*
** Perform arithmetic operations on lua_Integer values with wrap-around
** semantics, as the Lua core does.
*/

/* push the value used to represent failure/error */

/*
** Internal assertions for in-house debugging
*/

/*
** {======================================================
** Generic Buffer manipulation
** =======================================================
*/

export const struct_luaL_Buffer = struct("struct_luaL_Buffer", {
  b: ptr_to(char), /* buffer address */
  size: unsigned, /* buffer size */
  n: unsigned, /* number of characters in buffer */
  L: ptr_to("struct_lua_State"),
  init: union("struct_luaL_Buffer.init", {
    n: lua_Number, u: double, s: ptr_to(void_t), i: lua_Integer, l: int, /* ensure maximum alignment for buffer */
    b: array_of(char, LUAL_BUFFERSIZE), /* initial buffer */
  }),
});

/* }====================================================== */

/*
** {======================================================
** File handles for IO library
** =======================================================
*/

/*
** A file handle is a userdata with metatable 'LUA_FILEHANDLE' and
** initial structure 'luaL_Stream' (it may contain other fields
** after that initial structure).
*/

export const struct_luaL_Stream = struct("struct_luaL_Stream", {
  f: ptr_to("struct__IO_FILE"), /* stream (NULL for incompletely created streams) */
  closef: fnptr_t, /* to close stream (NULL for closed streams) */
});

/* }====================================================== */

/*
** {==================================================================
** "Abstraction Layer" for basic report of messages and errors
** ===================================================================
*/

/* print a string */

/* print a newline and flush the output */

/* print an error message */

/* }================================================================== */

/*
** {============================================================
** Compatibility with deprecated conversions
** =============================================================
*/

/* }============================================================ */

import { lua_Integer, lua_Number } from "./lua.h.js";
import { LUAL_BUFFERSIZE } from "./luaconf.h.js";
import { char, double, int, long, sizeof, unsigned } from "../rt/ctypes.js";
import { array_of, fnptr_t, ptr_to, struct, union, void_t } from "../rt/struct.js";
