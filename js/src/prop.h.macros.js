    /* note: the first eight properties above are equivalent to MR_xxx bits
     * MR_FIRE through MR_STONE, and can be directly converted to them: */
export function res_to_mr(r) { return ((FIRE_RES <= r && r <= STONE_RES) ? uchar((1 << (r - 1))) : 0x00); }

import { FIRE_RES, STONE_RES } from "./prop.h.js";
import { uchar } from "../rt/ctypes.js";
