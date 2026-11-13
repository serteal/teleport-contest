// lib/exact64.mjs: 64-bit values that need every bit (RNG seeds) beyond the uint64_t typedefs.
//
// After the long64 rewrite `unsigned long long` is also every `unsigned long` of NetHack, which
// is held as a Number (exact below 2^53). Seeds are full-range 64-bit values (NETHACK_SEED can be
// 18446744073709551615), so the variables, parameters and returns that carry one are in the
// BigInt domain like uint64_t. This list is the rule's whole configuration (audit it here):
//   function -> names of its parameters/locals that hold a seed
export const EXACT64_VARS = {
  init_isaac64: ["seed"],
  set_random: ["seed"],
  sys_random_seed: ["seed", "pid"],
  nhlL_openlibs: ["seed"], // (nhlua.c: Lua's math.randomseed from NETHACK_SEED)
};
//   functions whose result is a seed (strtoull: only ever used on NETHACK_SEED)
export const EXACT64_RETURNS = new Set(["sys_random_seed", "strtoull"]);
//   functions whose parameter (by index) is a seed
export const EXACT64_PARAMS = { init_isaac64: [0], set_random: [0] };
