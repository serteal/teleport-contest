export function DARKROOMSYM() { return (Is_rogue_level(u.uz) ? S_stone : S_darkroom); }

export function is_cmap_trap(i) { return +(i >= S_arrow_trap && i < S_arrow_trap + MAXTCHARS); }
export function is_cmap_drawbridge(i) { return +(i >= S_vodbridge && i <= S_hcdbridge); }
export function is_cmap_door(i) { return +(i >= S_vodoor && i <= S_hcdoor); }
export function is_cmap_wall(i) { return +(i >= S_stone && i <= S_trwall); }
export function is_cmap_room(i) { return +(i >= S_room && i <= S_darkroom); }
export function is_cmap_corr(i) { return +(i >= S_corr && i <= S_litcorr); }
export function is_cmap_furniture(i) { return +(i >= S_upstair && i <= S_fountain); }
export function is_cmap_water(i) { return +(i == S_pool || i == S_water); }
export function is_cmap_lava(i) { return +(i == S_lava || i == S_lavawall); }

export function is_cmap_engraving(i) { return +(i == S_engroom || i == S_engrcorr); }

export function SYMHANDLING(ht) { return +(gs.symset[gc.currentgraphics].handling == ht); }

import {
    S_arrow_trap, S_corr, S_darkroom, S_engrcorr, S_engroom, S_fountain, S_hcdbridge, S_hcdoor,
    S_lava, S_lavawall, S_litcorr, S_pool, S_room, S_stone, S_trwall, S_upstair, S_vodbridge,
    S_vodoor, S_water,
} from "./defsym.h.js";
import { Is_rogue_level } from "./dungeon.h.macros.js";
import { MAXTCHARS } from "./sym.h.js";
import { gc, gs, u } from "./decl.js";
