/*
 *  cansee()    - Returns true if the hero can see the location.
 *
 *  couldsee()  - Returns true if the hero has a clear line of sight to
 *                the location.
 */
export function cansee(x, y) { return +((uchars[gv.viz_array[y] + x] & IN_SIGHT) != 0); }
export function couldsee(x, y) { return +((uchars[gv.viz_array[y] + x] & COULD_SEE) != 0); }

/*
 *  The following assume the monster is not blind.
 *
 *  m_cansee()  - Returns true if the monster can see the given location.
 *
 *  m_canseeu() - Returns true if the monster could see the hero.  Assumes
 *                that if the hero has a clear line of sight to the monster's
 *                location and the hero is visible, then monster can see the
 *                hero.
 */
export function m_cansee(mtmp, x2, y2) { return clear_path(mtmp.mx, mtmp.my, x2, y2); }

export function m_canseeu(m) { return +((!Invis() || perceives(m.data))
     && !Underwater()
     && couldsee(m.mx, m.my)); }

/* Use this macro to get a list of distances of the edges (see vision.c). */
export function circle_ptr(z) { return circle_data.subarray((circle_start[z])); }

import { perceives } from "./mondata.h.macros.js";
import { COULD_SEE, IN_SIGHT } from "./vision.h.js";
import { Invis, Underwater } from "./youprop.h.macros.js";
import { uchars } from "../rt/heap.js";
import { gv } from "./decl.js";
import { circle_data, circle_start, clear_path } from "./vision.js";
