/*
 * Avoid using the level types in inequalities:
 * these types are subject to change.
 * Instead, use one of the macros below.
 */
export function IS_WALL(typ) { return (typ && typ <= DBWALL ? 1 : 0); }
export function IS_STWALL(typ) { return +(typ <= DBWALL); }
export function IS_OBSTRUCTED(typ) { return +(typ < POOL); }
export function IS_SDOOR(typ) { return +(typ == SDOOR); }
export function IS_DOOR(typ) { return +(typ == DOOR); }
export function IS_DOORJOIN(typ) { return +(IS_OBSTRUCTED(typ) || typ == IRONBARS); }
export function IS_TREE(typ) { return (typ == TREE || (svl.level.flags.arboreal && typ == STONE) ? 1 : 0); }

export function ACCESSIBLE(typ) { return +(typ >= DOOR); }
export function IS_ROOM(typ) { return +(typ >= ROOM); }
export function ZAP_POS(typ) { return +(typ >= POOL); }
export function SPACE_POS(typ) { return +(typ > DOOR); }
export function IS_POOL(typ) { return +(typ >= POOL && typ <= DRAWBRIDGE_UP); }
export function IS_LAVA(typ) { return +(typ == LAVAPOOL || typ == LAVAWALL); }
export function IS_THRONE(typ) { return +(typ == THRONE); }
export function IS_FOUNTAIN(typ) { return +(typ == FOUNTAIN); }
export function IS_SINK(typ) { return +(typ == SINK); }
export function IS_GRAVE(typ) { return +(typ == GRAVE); }
export function IS_ALTAR(typ) { return +(typ == ALTAR); }
export function IS_DRAWBRIDGE(typ) { return +(typ == DRAWBRIDGE_UP || typ == DRAWBRIDGE_DOWN); }

export function IS_FURNITURE(typ) { return +(typ >= STAIRS && typ <= ALTAR); }
export function IS_AIR(typ) { return +(typ == AIR || typ == CLOUD); }
export function IS_SOFT(typ) { return +(typ == AIR || typ == CLOUD || IS_POOL(typ)); }
export function IS_WATERWALL(typ) { return +(typ == WATER); }
/* for surface checks when it's unknown whether a drawbridge is involved;
   drawbridge_up is the spot in front of a closed drawbridge and not the
   current surface at that spot; caveat: this evaluates its arguments more
   than once and might make a function call */
export function SURFACE_AT(x, y) { return ((levl()[x][y].typ == DRAWBRIDGE_UP)
     ? db_under_typ(levl()[x][y].flags)
     : levl()[x][y].typ); }

export function FOUNTAIN_IS_WARNED(x, y) { return (levl()[x][y].flags & F_WARNED); }
export function FOUNTAIN_IS_LOOTED(x, y) { return (levl()[x][y].flags & F_LOOTED); }

export function CAN_OVERWRITE_TERRAIN(ttyp) { return (iflags.debug_overwrite_stairs || !(ttyp == LADDER || ttyp == STAIRS) ? 1 : 0); }

/*
 * Macros for compatibility with old code. Someday these will go away.
 */
export function levl() { return svl.level.locations; }
export function fobj() { return svl.level.objlist; }
export function fmon() { return svl.level.monlist; }

/*
 * Convert a trap number into the defsym graphics array.
 * Convert a defsym number into a trap number.
 * Assumes that arrow trap will always be the first trap.
 */
export function trap_to_defsym(t) { return (S_arrow_trap + t - 1); }
export function defsym_to_trap(d) { return (d - S_arrow_trap + 1); }

export function OBJ_AT(x, y) { return +(svl.level.objects[x][y] != null); }
/*
 * Macros for encapsulation of level.monsters references.
 */

/* these wouldn't allow buried monster and surface monster at same location */

export function MON_AT(x, y) { return +(svl.level.monsters[x][y] != null); }
export function m_at(x, y) { return (svl.level.monsters[x][y]); }

export function place_worm_seg(m, x, y) { return svl.level.monsters[x][y] = m; }
export function remove_monster(x, y) { return svl.level.monsters[x][y] = null; }

/* restricted movement, potential luck penalties */
export function Sokoban() { return svl.level.flags.sokoban_rules; }

/*
 * These prototypes are in extern.h but some of the code which uses them
 * includes config.h instead of hack.h so doesn't see extern.h.
 */
/* ### drawing.c ### */

import { S_arrow_trap } from "./defsym.h.js";
import {
    AIR, ALTAR, CLOUD, DBWALL, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, FOUNTAIN, F_LOOTED, F_WARNED,
    GRAVE, IRONBARS, LADDER, LAVAPOOL, LAVAWALL, POOL, ROOM, SDOOR, SINK, STAIRS, STONE, THRONE,
    TREE, WATER,
} from "./rm.h.js";
import { db_under_typ } from "./dbridge.js";
import { iflags, svl } from "./decl.js";
