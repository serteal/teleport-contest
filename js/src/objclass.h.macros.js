export function newfruit() { return view_of(struct_fruit, addr_of(alloc(sizeof(struct_fruit)))); }
export function dealloc_fruit(rind) { return free(addr_of(rind)); }

export function OBJ_NAME(obj) { return (obj_descr[obj.oc_name_idx].oc_name); }
export function OBJ_DESCR(obj) { return (obj_descr[obj.oc_descr_idx].oc_descr); }

export function is_organic(otmp) { return +(objects[otmp.otyp].oc_material <= WOOD); }
export function is_metallic(otmp) { return +(objects[otmp.otyp].oc_material >= IRON
     && objects[otmp.otyp].oc_material <= MITHRIL); }

/* primary damage: fire/rust/--- */
/* is_flammable(otmp), is_rottable(otmp) in mkobj.c */
export function is_rustprone(otmp) { return +(objects[otmp.otyp].oc_material == IRON); }
export function is_crackable(otmp) { return +(objects[otmp.otyp].oc_material == GLASS
     && otmp.oclass == ARMOR_CLASS); }

/* secondary damage: rot/acid/acid */
export function is_corrodeable(otmp) { return +(objects[otmp.otyp].oc_material == COPPER
     || objects[otmp.otyp].oc_material == IRON); }

/* subject to any damage */
export function is_damageable(otmp) { return (is_rustprone(otmp) || is_flammable(otmp)
     || is_rottable(otmp) || is_corrodeable(otmp)
     || is_crackable(otmp) ? 1 : 0); }

import { ARMOR_CLASS } from "./defsym.h.js";
import { COPPER, GLASS, IRON, MITHRIL, WOOD, struct_fruit } from "./objclass.h.js";
import { sizeof } from "../rt/ctypes.js";
import { free } from "../rt/libc.js";
import { addr_of, view_of } from "../rt/struct.js";
import { alloc } from "./alloc.js";
import { is_flammable, is_rottable } from "./mkobj.js";
import { obj_descr, objects } from "./objects.js";
