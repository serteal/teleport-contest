// rt/int64.js: bit operations on 64-bit C integers (`long`, `unsigned long`).
//
// 64-bit values are JS Numbers (exact below 2^53). JS bit operators work on 32 bits, so a bit
// operation on `long` operands whose values may not fit in 32 bits is written with these
// functions, named after the operator. Where the rewriter can show both operands fit in a
// signed 32-bit int, or only the truthiness of the result is used, it writes the plain JS
// operator instead (the checked build asserts that choice at run time).

const TWO32 = 4294967296;

function hi(v) { return Math.floor(v / TWO32); }
function lo(v) { return v - Math.floor(v / TWO32) * TWO32; } // 0 <= lo < 2^32

function join(h, l) { return (h | 0) * TWO32 + (l >>> 0); }
function joinu(h, l) { return (h >>> 0) * TWO32 + (l >>> 0); }

/** a & b */
export function and64(a, b) { return join(hi(a) & hi(b), lo(a) & lo(b)); }
/** a | b */
export function or64(a, b) { return join(hi(a) | hi(b), lo(a) | lo(b)); }
/** a ^ b */
export function xor64(a, b) { return join(hi(a) ^ hi(b), lo(a) ^ lo(b)); }
/** ~a */
export function not64(a) { return join(~hi(a), ~lo(a)); }
/** a << n */
export function shl64(a, n) { return Number(BigInt.asIntN(64, BigInt(a) << BigInt(n))); }
/** a >> n (signed) */
export function shr64(a, n) { return Math.floor(a / 2 ** n); }

/** unsigned variants: same bits, result read as unsigned */
export function and64u(a, b) { return joinu(hi(a) & hi(b), lo(a) & lo(b)); }
export function or64u(a, b) { return joinu(hi(a) | hi(b), lo(a) | lo(b)); }
export function xor64u(a, b) { return joinu(hi(a) ^ hi(b), lo(a) ^ lo(b)); }
/**
 * ~a for unsigned 64-bit a: the unsigned value is 2^64 - 1 - a, beyond 2^53 for every mask, so it
 * cannot be a Number; the same 64 bits are returned as the signed value -a - 1 (exact), which
 * and64u / or64u / stores (store_i64 writes the two's-complement bits) treat identically.
 */
export function not64u(a) { return join(~hi(a), ~lo(a)); }
export function shr64u(a, n) { return Number(BigInt.asUintN(64, BigInt(a)) >> BigInt(n)); }

// ---- exact 64-bit integers: uint64_t / int64_t (RNG state, hashes) are BigInt ---------------

/** (uint64_t) v: BigInt in [0, 2^64), from a Number or a BigInt (also wraps arithmetic). */
export function u64(v) { return BigInt.asUintN(64, typeof v === "bigint" ? v : BigInt(Math.trunc(v))); }
/** (int64_t) v */
export function i64(v) { return BigInt.asIntN(64, typeof v === "bigint" ? v : BigInt(Math.trunc(v))); }
