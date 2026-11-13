/*
** $Id: lua.h $
** Lua - A Scripting Language
** Lua.org, PUC-Rio, Brazil (http://www.lua.org)
** See Copyright Notice at the end of this file
*/

export const LUA_VERSION_NUM = 504;
export const LUA_VERSION_RELEASE_NUM = (LUA_VERSION_NUM * 100 + 8);

export const LUA_VERSION = "Lua 5.4";
export const LUA_RELEASE = "Lua 5.4.8";
export const LUA_COPYRIGHT = "Lua 5.4.8  Copyright (C) 1994-2025 Lua.org, PUC-Rio";

/* mark for precompiled code ('<esc>Lua') */

/* option for multiple returns in 'lua_pcall' and 'lua_call' */
export const LUA_MULTRET = (-1);

/*
** Pseudo-indices
** (-LUAI_MAXSTACK is the minimum valid index; we keep some free empty
** space after that to help overflow detection)
*/
export const LUA_REGISTRYINDEX = (-LUAI_MAXSTACK - 1000);

/* thread status */
export const LUA_OK = 0;

/*
** basic types
*/
export const LUA_TNONE = (-1);

export const LUA_TNIL = 0;
export const LUA_TBOOLEAN = 1;

export const LUA_TNUMBER = 3;
export const LUA_TSTRING = 4;
export const LUA_TTABLE = 5;
export const LUA_TFUNCTION = 6;
export const LUA_TUSERDATA = 7;

/* minimum Lua stack available to a C function */

/* predefined values in the registry */

/* type of numbers in Lua */
export const lua_Number = double;

/* type for integer functions */
export const lua_Integer = long;

/*
** coroutine functions
*/

/*
** Warning-related functions
*/

/*
** garbage-collection function and options
*/

export const LUA_GCCOLLECT = 2;
export const LUA_GCCOUNT = 3;
export const LUA_GCCOUNTB = 4;

/* }============================================================== */

/*
** {======================================================================
** Debug API
** =======================================================================
*/

/*
** Event codes
*/

export const LUA_HOOKCOUNT = 3;

/*
** Event masks
*/

export const LUA_MASKCOUNT = (1 << LUA_HOOKCOUNT);

export const struct_lua_Debug = struct("struct_lua_Debug", {
  event: int,
  name: ptr_to(char), /* (n) */
  namewhat: ptr_to(char), /* (n) 'global', 'local', 'field', 'method' */
  what: ptr_to(char), /* (S) 'Lua', 'C', 'main', 'tail' */
  source: ptr_to(char), /* (S) */
  srclen: unsigned, /* (S) */
  currentline: int, /* (l) */
  linedefined: int, /* (S) */
  lastlinedefined: int, /* (S) */
  nups: uchar, /* (u) number of upvalues */
  nparams: uchar, /* (u) number of parameters */
  isvararg: char, /* (u) */
  istailcall: char, /* (t) */
  ftransfer: ushort, /* (r) index of first value transferred */
  ntransfer: ushort, /* (r) number of transferred values */
  short_src: array_of(char, LUA_IDSIZE), /* (S) */
  /* private part */
  i_ci: ptr_to("struct_CallInfo"), /* active function */
});

/* }====================================================================== */

/******************************************************************************
* Copyright (C) 1994-2025 Lua.org, PUC-Rio.
*
* Permission is hereby granted, free of charge, to any person obtaining
* a copy of this software and associated documentation files (the
* "Software"), to deal in the Software without restriction, including
* without limitation the rights to use, copy, modify, merge, publish,
* distribute, sublicense, and/or sell copies of the Software, and to
* permit persons to whom the Software is furnished to do so, subject to
* the following conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
******************************************************************************/

import { LUAI_MAXSTACK, LUA_IDSIZE } from "./luaconf.h.js";
import { char, double, int, long, uchar, unsigned, ushort } from "../rt/ctypes.js";
import { array_of, ptr_to, struct } from "../rt/struct.js";
