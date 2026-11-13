export function ROOM_INDEX(x) { return ptr_diff(x, svr.rooms[0]); }

import { ptr_diff } from "../rt/struct.js";
import { svr } from "./decl.js";
