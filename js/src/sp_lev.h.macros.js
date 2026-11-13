export function SP_COORD_X(l) { return (l & 0xff); }
export function SP_COORD_Y(l) { return (shr64(l, 16) & 0xff); }
export function SP_COORD_PACK(x, y) { return ((x & 0xff) + ((y & 0xff) << 16)); }
export function SP_COORD_PACK_RANDOM(f) { return (SP_COORD_IS_RANDOM | f); }

import { SP_COORD_IS_RANDOM } from "./sp_lev.h.js";
import { shr64 } from "../rt/int64.js";
