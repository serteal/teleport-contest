export function hero_inside(r) { return (r.player_flags & REG_HERO_INSIDE); }
export function heros_fault(r) { return (+!(r.player_flags & REG_NOT_HEROS)); }
export function set_hero_inside(r) { return (r.player_flags |= REG_HERO_INSIDE); }
export function clear_hero_inside(r) { return (r.player_flags &= unsigned(~REG_HERO_INSIDE)); }
export function set_heros_fault(r) { return (r.player_flags &= unsigned(~REG_NOT_HEROS)); }
export function clear_heros_fault(r) { return (r.player_flags |= REG_NOT_HEROS); }

import { REG_HERO_INSIDE, REG_NOT_HEROS } from "./region.h.js";
import { unsigned } from "../rt/ctypes.js";
