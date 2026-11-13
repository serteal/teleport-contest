// rt/ctypes.js: C scalar types.
//
// Every C scalar type is a JS function named like the type. Called, it converts a value the
// way a C cast does (`schar(200)` is -56, `unsigned(-1)` is 4294967295). It also carries the
// wasm32 layout facts (`size`, `align`, `kind`) used by struct layouts, sizeof() and the stack.
// Typedef names (coordxy, boolean, xint8, ...) are emitted into header modules as aliases.

function scalar(name, size, kind, conv) {
  Object.defineProperty(conv, "name", { value: name });
  conv.size = size;
  conv.align = size;
  conv.kind = kind;
  conv.scalar = true;
  return conv;
}

// (a BigInt argument comes from uint64_t/int64_t code: rt/int64.js)
const n32 = (v) => (typeof v === "bigint" ? Number(BigInt.asIntN(32, v)) : v);
export const char = scalar("char", 1, "i8", (v) => (n32(v) << 24) >> 24);
export const schar = scalar("schar", 1, "i8", (v) => (n32(v) << 24) >> 24);
export const uchar = scalar("uchar", 1, "u8", (v) => n32(v) & 255);
export const short = scalar("short", 2, "i16", (v) => (n32(v) << 16) >> 16);
export const ushort = scalar("ushort", 2, "u16", (v) => n32(v) & 65535);
export const int = scalar("int", 4, "i32", (v) => n32(v) | 0);
export const unsigned = scalar("unsigned", 4, "u32", (v) => n32(v) >>> 0);
// 64-bit integers are JS Numbers (exact below 2^53; the checked build asserts that range)
export const long = scalar("long", 8, "i64", (v) => (typeof v === "bigint" ? Number(BigInt.asIntN(64, v)) : Number.isInteger(v) ? v : Math.trunc(v)));
export const ulong = scalar("ulong", 8, "u64", (v) => {
  if (typeof v === "bigint") return Number(BigInt.asUintN(64, v));
  v = Number.isInteger(v) ? v : Math.trunc(v);
  return v < 0 ? v + 18446744073709551616 : v;
});
export const float = scalar("float", 4, "f32", (v) => Math.fround(v));
export const double = scalar("double", 8, "f64", (v) => +v);
// C99 _Bool
export const bool = scalar("bool", 1, "bool", (v) => (v ? 1 : 0));

// <stdint.h> names. uint64_t / int64_t are exact 64-bit values (BigInt), unlike `long`
// (a Number): RNG state and hashes need every bit. As conversions they wrap like C casts.
const big = (v) => (typeof v === "bigint" ? v : BigInt(Number.isInteger(v) ? v : Math.trunc(v)));
export const uint64_t = scalar("uint64_t", 8, "u64n", (v) => BigInt.asUintN(64, big(v)));
export const int64_t = scalar("int64_t", 8, "i64n", (v) => BigInt.asIntN(64, big(v)));
export const uint8_t = uchar, int16_t = short, uint16_t = ushort;
export const int32_t = int, uint32_t = unsigned;
export const size_t = unsigned, ssize_t = int, intptr_t = int, uintptr_t = unsigned;
export const time_t = long;

/** sizeof(T) for any type descriptor (scalars, structs, arrays, pointers). */
export function sizeof(t) {
  if (t == null || t.size === undefined) throw new Error("sizeof: not a type");
  return t.size;
}

/** Integer division truncating toward zero, like C `/` on integers. */
export function idiv(a, b) { return Math.trunc(a / b); }

/** Character code of a one-character string literal: C 'x'. */
export function ord(c) { return c.charCodeAt(0); }

/** sizeof("literal"): its length including the terminating NUL. */
export function sizeof_string(s) { return s.length + 1; }
