// rt/setjmp.js: setjmp/longjmp.
//
// The rewriter lowers "setjmp returns twice" structurally: the statement holding the setjmp call
// becomes a label of the function's goto dispatcher, whose body runs inside a try; a longjmp
// unwinds the JS stack as an exception and the catch block asks setjmp_caught() whether it is
// the jump to this function's jmp_buf:
//
//     } catch ($e) { $jv = setjmp_caught($e, $jb); $goto = "setjmp"; continue $goto_setjmp; }
//
// A jmp_buf is identified by its address. A host whose C code longjmps to JS setjmp sites (and
// back) can install machine.longjmp / machine.catch_longjmp so that JS and C use one exception
// protocol in both directions. The game's host does not: the vendored C library's own longjmp
// (lua_error, luaL_error inside the Lua VM) is a different exception that only the C library's
// own setjmp points catch, so it never reaches a JS setjmp site; and a JS longjmp that crosses
// Lua frames (nhlua.c nhl_hookfn -> nhl_pcall) leaves that lua_State unusable, which is fine:
// the game panics there, and interactive play restores a heap snapshot.

import { machine } from "./heap.js";
import { addr } from "./struct.js";

/** The exception a JS longjmp throws (no compiled code involved). */
export class LongJmp {
  constructor(env, value) { this.env = env; this.value = value; }
}

/** longjmp(env, v): never returns. As in C, longjmp(env, 0) makes setjmp return 1. */
export function longjmp(env, v) {
  const a = addr(env);
  v = v | 0 || 1;
  if (machine.longjmp) machine.longjmp(a, v); // the host's C unwinding, when installed
  throw new LongJmp(a, v);
}

/**
 * In the catch block of a function that called setjmp(env): the value setjmp returns now, if
 * exception e is a longjmp to env; otherwise e propagates (another jmp_buf, any other error, or
 * env not set yet because the setjmp has not run).
 */
export function setjmp_caught(e, env) {
  if (env == null) throw e;
  const a = addr(env);
  if (e instanceof LongJmp) { if (e.env === a) return e.value; throw e; }
  if (machine.catch_longjmp) {
    const v = machine.catch_longjmp(e, a); // the host's longjmp to this buffer: its value, else undefined
    if (v !== undefined) return v;
  }
  throw e;
}
