/* A particular dungeon contains num_dunlevs d_levels with dlevel 1..
 * num_dunlevs.  Ledger_start and depth_start are bases that are added
 * to the dlevel of a particular d_level to get the effective ledger_no
 * and depth for that d_level.
 *
 * Ledger_no is a bookkeeping number that gives a unique identifier for a
 * particular d_level (for level.?? files, e.g.).
 *
 * Depth corresponds to the number of floors below the surface.
 */

/* These both can't be zero, or dungeon_topology isn't init'd / restored */
export function Lassigned(y) { return (y.dlevel || y.dnum ? 1 : 0); }
export function Lcheck(x, z) { return (Lassigned(z) && on_level(x, z) ? 1 : 0); }

export function Is_astralevel(x) { return Lcheck(x, svd.dungeon_topology.d_astral_level); }
export function Is_earthlevel(x) { return Lcheck(x, svd.dungeon_topology.d_earth_level); }
export function Is_waterlevel(x) { return Lcheck(x, svd.dungeon_topology.d_water_level); }
export function Is_firelevel(x) { return Lcheck(x, svd.dungeon_topology.d_fire_level); }
export function Is_airlevel(x) { return Lcheck(x, svd.dungeon_topology.d_air_level); }
export function Is_medusa_level(x) { return Lcheck(x, svd.dungeon_topology.d_medusa_level); }
export function Is_oracle_level(x) { return Lcheck(x, svd.dungeon_topology.d_oracle_level); }
export function Is_valley(x) { return Lcheck(x, svd.dungeon_topology.d_valley_level); }
export function Is_juiblex_level(x) { return Lcheck(x, svd.dungeon_topology.d_juiblex_level); }

export function Is_wiz1_level(x) { return Lcheck(x, svd.dungeon_topology.d_wiz1_level); }
export function Is_wiz2_level(x) { return Lcheck(x, svd.dungeon_topology.d_wiz2_level); }
export function Is_wiz3_level(x) { return Lcheck(x, svd.dungeon_topology.d_wiz3_level); }
export function Is_sanctum(x) { return Lcheck(x, svd.dungeon_topology.d_sanctum_level); }

export function Is_rogue_level(x) { return Lcheck(x, svd.dungeon_topology.d_rogue_level); }
export function Is_stronghold(x) { return Lcheck(x, svd.dungeon_topology.d_stronghold_level); }
export function Is_bigroom(x) { return Lcheck(x, svd.dungeon_topology.d_bigroom_level); }
export function Is_qstart(x) { return Lcheck(x, svd.dungeon_topology.d_qstart_level); }
export function Is_qlocate(x) { return Lcheck(x, svd.dungeon_topology.d_qlocate_level); }
export function Is_nemesis(x) { return Lcheck(x, svd.dungeon_topology.d_nemesis_level); }
export function Is_knox(x) { return Lcheck(x, svd.dungeon_topology.d_knox_level); }
export function Is_mineend_level(x) { return Lcheck(x, svd.dungeon_topology.d_mineend_level); }
export function Is_sokoend_level(x) { return Lcheck(x, svd.dungeon_topology.d_sokoend_level); }

export function In_sokoban(x) { return +(x.dnum == sokoban_dnum()); }
export function Inhell() { return In_hell(u.uz); }
export function In_endgame(x) { return +(x.dnum == astral_level().dnum); }
export function In_tutorial(x) { return +(x.dnum == tutorial_dnum()); }

export function within_bounded_area(X, Y, LX, LY, HX, HY) { return +(X >= LX && X <= HX && Y >= LY && Y <= HY); }

import { astral_level, sokoban_dnum, tutorial_dnum } from "./hack.h.macros.js";
import { svd, u } from "./decl.js";
import { In_hell, on_level } from "./dungeon.js";
