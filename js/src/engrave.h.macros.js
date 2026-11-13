export function engr_text_space(ep) { return addr_of(ptr_add(ep, 1)); }

export function newengr(lth) { return view_of(struct_engr, addr_of(alloc(unsigned(lth + sizeof(struct_engr))))); }

export function dealloc_engr(engr) { return free(addr_of(engr)); }

export function engraving_to_defsym(ep) { return ((levl()[ep.engr_x][ep.engr_y].typ == CORR) ? S_engrcorr : S_engroom); }

export function spot_shows_engravings(x, y) { return +(levl()[x][y].typ == CORR
     || levl()[x][y].typ == ICE
     || levl()[x][y].typ == ROOM); }

import { S_engrcorr, S_engroom } from "./defsym.h.js";
import { struct_engr } from "./engrave.h.js";
import { CORR, ICE, ROOM } from "./rm.h.js";
import { levl } from "./rm.h.macros.js";
import { sizeof, unsigned } from "../rt/ctypes.js";
import { free } from "../rt/libc.js";
import { addr_of, ptr_add, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
