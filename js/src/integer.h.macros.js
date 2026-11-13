/* Also provide ushort, uint, ulong */

/* for non-negative L, calculate L * 10 + D, avoiding signed overflow;
   yields -1 if overflow would have happened;
   assumes compiler will optimize the constants */
export function AppendLongDigit(L, D) { return ((L < Math.trunc(LLONG_MAX / 10)
      || (L == Math.trunc(LLONG_MAX / 10) && D <= LLONG_MAX % 10))
     ? L * 10 + D
     : -1); }

/* add a and b, return max long value if overflow would have occurred;
   assumes that both a and b are non-negative; caller should apply
   cast(s) to (long) in the arguments if any are needed */
export function nowrap_add(a, b) { return (a <= (LLONG_MAX - b) ? (a + b) : LLONG_MAX); }

import { LLONG_MAX } from "../rt/libc.js";
