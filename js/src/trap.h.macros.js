export function newtrap() { return view_of(struct_trap, addr_of(alloc(sizeof(struct_trap)))); }
export function dealloc_trap(trap) { return free(addr_of(trap)); }

export function is_pit(ttyp) { return +(ttyp == PIT || ttyp == SPIKED_PIT); }
export function is_hole(ttyp) { return +(ttyp == HOLE || ttyp == TRAPDOOR); }
export function unhideable_trap(ttyp) { return +(ttyp == HOLE); }
export function undestroyable_trap(ttyp) { return +(ttyp == MAGIC_PORTAL
                                  || ttyp == VIBRATING_SQUARE); }
export function is_magical_trap(ttyp) { return +(ttyp == TELEP_TRAP
                               || ttyp == LEVEL_TELEP
                               || ttyp == MAGIC_TRAP
                               || ttyp == ANTI_MAGIC
                               || ttyp == POLY_TRAP); }
/* "transportation" traps */
export function is_xport(ttyp) { return +(ttyp >= TELEP_TRAP && ttyp <= MAGIC_PORTAL); }
export function fixed_tele_trap(t) { return (t.ttyp == TELEP_TRAP
                            && isok(t.launch.x,t.launch.y) ? 1 : 0); }

import {
    ANTI_MAGIC, HOLE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, PIT, POLY_TRAP, SPIKED_PIT, TELEP_TRAP,
    TRAPDOOR, VIBRATING_SQUARE, struct_trap,
} from "./trap.h.js";
import { sizeof } from "../rt/ctypes.js";
import { free } from "../rt/libc.js";
import { addr_of, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { isok } from "./cmd.js";
