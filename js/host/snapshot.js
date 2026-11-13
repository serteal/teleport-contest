// host/snapshot.js - rewind a game to the last command boundary.
//
// Interactive play (browser, playability check) takes a snapshot at the top
// of every moveloop_core() iteration; a new key restores it and runs again
// with the key appended, so keys typed earlier in an unfinished command are
// consumed again (the game is fully synchronous: no async code, no replay
// from the start).  What a snapshot holds:
//   - the heap below the allocator's break (statics, C library data, the C
//     stack, malloc's heap: every byte of C-visible state, the Lua VM too);
//   - the file system, by its journal (host/vfs.js mark/rollback);
//   - JS-side state: js/rt's (arena, literals, statics) when it exports
//     rt_state_save/rt_state_restore, the capture counters (passed as
//     `extra` by host/game.js) and the signal table of host/libc.js.

import * as rtHeap from "../rt/heap.js";

export class MachineSnapshot {
  constructor() {
    this.bytes = new Uint8Array(0);
    this.top = 0;
    this.taken = false;
  }

  /** extra: { name: {save(), restore(v)} } JS state that belongs to the snapshot. */
  take(machine, extra = {}) {
    const clib = machine.clib;
    const top = clib.sbrk(0) >>> 0;
    if (this.bytes.length < top) this.bytes = new Uint8Array(top + (top >>> 3) + (1 << 20));
    this.bytes.set(clib.HEAPU8.subarray(0, top));
    this.top = top;
    machine.vfs.mark();
    this.rt = typeof rtHeap.rt_state_save === "function" ? rtHeap.rt_state_save() : null;
    this.signals = new Map(machine.signals);
    this.extra = extra;
    this.values = Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.save()]));
    this.taken = true;
  }

  restore(machine) {
    if (!this.taken) throw new Error("snapshot: nothing taken");
    const clib = machine.clib;
    const now = clib.sbrk(0) >>> 0;
    clib.HEAPU8.set(this.bytes.subarray(0, this.top));
    if (now > this.top) clib.HEAPU8.fill(0, this.top, now);
    machine.vfs.rollback();
    if (this.rt) rtHeap.rt_state_restore(this.rt);
    machine.signals.clear();
    for (const [k, v] of this.signals) machine.signals.set(k, v);
    for (const [k, v] of Object.entries(this.extra)) v.restore(this.values[k]);
  }
}
