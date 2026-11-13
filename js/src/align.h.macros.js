/* bounds for "record" -- respect initial alignments of 10 */
export function ALIGNLIM() { return (10 + Math.trunc(svm.moves / 200)); }

export function Amask2align(x) { return (((x & AM_MASK) == 0) ? A_NONE
                 : ((x & AM_MASK) == AM_LAWFUL) ? A_LAWFUL
                   : (x & AM_MASK) - 2); }

export function Align2amask(x) { return unsigned(((x == A_NONE) ? AM_NONE
                 : (x == A_LAWFUL) ? AM_LAWFUL
                   : (x + 2))); }

/* Because clearly Nethack needs more ways to specify alignment...
   Amask2msa(): 1, 2, 4 converted to 1, 2, 3 to fit within a width 2 bitfield;
   Msa2amask(): 1, 2, 3 converted back to 1, 2, 4;
   For Amask2msa(), 'x' might have the shrine bit set so strip that off. */
export function Amask2msa(x) { return (((x & AM_MASK) == 4) ? 3 : x & AM_MASK); }
export function Msa2amask(x) { return ((x == 3) ? 4 : x); }

import { AM_LAWFUL, AM_MASK, AM_NONE, A_LAWFUL, A_NONE } from "./align.h.js";
import { unsigned } from "../rt/ctypes.js";
import { svm } from "./decl.js";
