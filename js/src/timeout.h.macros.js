export function timer_is_pos(ttype) { return +(ttype == MELT_ICE_AWAY); }
export function timer_is_obj(ttype) { return +(ttype == ROT_ORGANIC
                             || ttype == ROT_CORPSE
                             || ttype == REVIVE_MON
                             || ttype == ZOMBIFY_MON
                             || ttype == BURN_OBJECT
                             || ttype == HATCH_EGG
                             || ttype == FIG_TRANSFORM
                             || ttype == SHRINK_GLOB); }

import {
    BURN_OBJECT, FIG_TRANSFORM, HATCH_EGG, MELT_ICE_AWAY, REVIVE_MON, ROT_CORPSE, ROT_ORGANIC,
    SHRINK_GLOB, ZOMBIFY_MON,
} from "./timeout.h.js";
