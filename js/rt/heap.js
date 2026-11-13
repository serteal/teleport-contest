// rt/heap.js: the one heap.
//
// All game state lives in a single ArrayBuffer laid out exactly like the wasm32 build of the
// C code (with 64-bit `long`), shared with the vendored C library (host/boot.js attaches it).
// Emitted code reads bytes through `chars` (signed char) and `uchars` (unsigned char); wider
// scalars are reached through struct views and typed refs (rt/struct.js).

export let buffer = null;
export let chars = null;   // Int8Array: *p for char / schar pointers
export let uchars = null;  // Uint8Array: *p for unsigned char / boolean pointers
export let i16 = null, u16 = null, i32 = null, u32 = null, f32 = null, f64 = null;

// Machine hooks, installed by the host (host/boot.js: the C library's stack pointer, allocator
// and functions). The optional ones let the runtime share memory with an existing C image whose
// objects it can look up; the game's host sets none of them.
export const machine = {
  getSP: null,
  setSP: null,
  symbol: null,     // optional: (name, file) -> address of an existing C object, or 0
  symbolSize: null, // optional: name -> size in bytes of that object
  findLiteral: null, // optional: address of an existing NUL-terminated copy of a string, or 0
  malloc: null,     // (size) -> address
  free: null,
  libc: null,       // (name, args) -> the residue's C library function (printf family, stdio, ...);
                    // optional libc.lookup(name) -> (args) -> the same call, for one name
  longjmp: null,    // optional: (envAddr, value): unwind as C code in the same memory does (rt/setjmp.js)
  catch_longjmp: null, // optional: (exception, envAddr) -> setjmp value if it is such a longjmp to env
  libc_data: null,  // (name) -> address of a residue data object (stdout...); else machine.symbol
};

/**
 * The function emitted code calls for the host's C library function `name` (rt/libc.js,
 * rt/lua.js, rt/port.js): machine.libc.lookup(name) when the host has it, looked up on the first
 * call and again whenever machine.libc is replaced; otherwise each call goes to machine.libc.
 */
export function libc_function(name) {
  let libc = null, f = null;
  const call = function (...args) {
    if (libc !== machine.libc) {
      libc = machine.libc;
      f = typeof libc.lookup === "function" ? libc.lookup(name) : (a) => libc(name, a);
    }
    return f(args);
  };
  Object.defineProperty(call, "name", { value: name });
  return call;
}

let ownSP = 0;
let stableBuffer = null;
/** Is the memory fixed for the process (attach_heap {stable: true})? */
export function heap_is_stable() { return stableBuffer !== null; }
let arenaNext = 0, arenaEnd = 0, arenaStart = 0;

/** Incremented whenever the typed views are rebuilt (attach_heap, regrow_heap). */
export let epoch = 0;
const attachHooks = [];
/** Run f({ grown }) after every attach_heap / regrow_heap (rt modules refresh heap-bound state). */
export function on_attach(f) { attachHooks.push(f); }

function bindViews(buf) {
  buffer = buf;
  chars = new Int8Array(buf);
  uchars = new Uint8Array(buf);
  i16 = new Int16Array(buf);
  u16 = new Uint16Array(buf);
  i32 = new Int32Array(buf);
  u32 = new Uint32Array(buf);
  f32 = new Float32Array(buf);
  f64 = new Float64Array(buf);
  epoch++;
}

/**
 * Attach to a buffer: a new memory image.
 *
 * The arena holds string literals and statics. It must be memory the C side never uses:
 *   opts.arena = [start, end]   explicit region (host/boot.js: the region the vendored C library
 *                               reserves for them, [1024, 4 MiB) in js/vendor)
 *   opts.arenaSize = n          otherwise the top n bytes of the buffer (default 8 MiB). Memory
 *                               growth would move the top, so a host that can grow memory must
 *                               pass an explicit region or keep the break below the arena.
 * The arena is never reset while its region stays the same: arena addresses held by module-level
 * objects (statics, literals) stay valid across attaches; the new memory gets the literals'
 * bytes again (strings.js) and statics start zeroed, as in a fresh C image.
 */
export function attach_heap(buf, opts = {}) {
  bindViews(buf);
  let start, end;
  if (opts.arena) [start, end] = opts.arena;
  else { end = buf.byteLength; start = end - (opts.arenaSize ?? (8 << 20)); }
  if (start < 0 || end > buf.byteLength || start >= end) throw new Error(`rt: arena [${start}, ${end}) outside memory of ${buf.byteLength} bytes`);
  if (start !== arenaStart || end !== arenaEnd) {
    // module-level objects may hold arena addresses: the region is fixed once used
    if (arenaNext > arenaStart) throw new Error(`rt: arena moved from [${arenaStart}, ${arenaEnd}) to [${start}, ${end}) after use`);
    arenaStart = arenaNext = start; arenaEnd = end;
  }
  if (opts.getSP) { machine.getSP = opts.getSP; machine.setSP = opts.setSP; }
  else {
    ownSP = opts.stackTop ?? arenaStart;
    machine.getSP = () => ownSP;
    machine.setSP = (v) => { ownSP = v; };
  }
  if (opts.symbol) machine.symbol = opts.symbol;
  if (opts.malloc) { machine.malloc = opts.malloc; machine.free = opts.free; }
  if (opts.symbolSize) machine.symbolSize = opts.symbolSize;
  if (opts.findLiteral) machine.findLiteral = opts.findLiteral;
  // stable: this buffer is the only memory for the life of the process (host/boot.js sizes memory
  // up front): static scalars may then be plain typed arrays (x[0] on a typed array is ~40x faster than
  // an accessor cell); a later attach to another buffer or a growth is refused
  if (stableBuffer && stableBuffer !== buf) throw new Error("rt: attach_heap to a new buffer after a stable one");
  if (opts.stable) stableBuffer = buf;
  for (const f of attachHooks) f({ grown: false });
}

/**
 * The same memory grew (wasm memory.grow / a wasm2js grow replaced the ArrayBuffer with a larger
 * copy): rebind the typed views; arena, literals and statics are kept. Views and cells read
 * through the rebound arrays; a typed ref (`stack_var`, `ref_to`) created before the growth
 * still points into the OLD buffer, so a host must not grow memory while emitted code holds
 * such refs (grow between commands, or size memory up front).
 */
export function regrow_heap(buf) {
  if (stableBuffer) throw new Error("rt: regrow_heap on a stable heap (typed-array statics would go stale)");
  if (buf.byteLength < (buffer ? buffer.byteLength : 0)) throw new Error("rt: regrow_heap with a smaller buffer");
  bindViews(buf);
  for (const f of attachHooks) f({ grown: true });
}

/** Permanent allocation from the arena (string literals, runtime-owned statics). */
export function arena_alloc(size, align = 1) {
  arenaNext = (arenaNext + align - 1) & -align;
  const a = arenaNext;
  arenaNext += size;
  if (arenaNext > arenaEnd) throw new Error("rt: arena exhausted");
  return a;
}

/** Address range of the arena. */
export function arena_range() { return [arenaStart, arenaEnd]; }

/** Bytes of the arena in use. */
export function arena_used() { return arenaNext - arenaStart; }

// ---- rt state that lives outside the heap ----------------------------------------------
// The arena's bytes are memory, but which literal or static owns which arena address (and
// whether an initializer ran) is kept in JS maps. A host that rewinds memory in place (interactive
// play: restore the heap image of the last command boundary, or the pristine image of a new
// game) must rewind these maps with it: every creation is journaled, and rt_state_restore
// undoes the creations since the matching rt_state_save.

const journal = [];

/** Record how to undo one creation (rt modules only). */
export function rt_journal(undo) { journal.push(undo); }

/** An opaque mark of the current rt state (take it together with the heap image). */
export function rt_state_save() { return { j: journal.length, next: arenaNext, start: arenaStart }; }

/** Undo every literal / static / initialiser created since mark m (restore the heap image too). */
export function rt_state_restore(m) {
  if (m.start !== arenaStart) throw new Error("rt: rt_state_restore across arena regions");
  while (journal.length > m.j) journal.pop()();
  arenaNext = m.next;
}

// ---- the C stack: frames for address-taken locals, local arrays and struct values ----------

/** Open a frame: remember the stack pointer (restore it with stack_pop). */
export function stack_frame() { return machine.getSP(); }

/** Close a frame. */
export function stack_pop(sp) { machine.setSP(sp); }

/** Allocate `size` bytes of zeroed stack memory in the current frame. */
// The C ABI (wasm32 clang) keeps the stack pointer 16-byte aligned, and the vendored C library
// relies on it (musl __stdio_write addresses its 2nd iovec as `iov | 8`): a JS frame must not
// leave the stack pointer less aligned when it calls into the C library.
export function stack_alloc(size, align = 16) {
  if (align < 16) align = 16;
  const sp = (machine.getSP() - size) & -align;
  machine.setSP(sp);
  uchars.fill(0, sp, sp + size);
  return sp;
}

// ---- raw memory helpers (memcpy/memset/memcmp semantics) -------------------------------

export function memcpy(dst, src, n) { uchars.copyWithin(dst, src, src + n); return dst; }
export function memmove(dst, src, n) { uchars.copyWithin(dst, src, src + n); return dst; }
export function memset(dst, c, n) { uchars.fill(c & 255, dst, dst + n); return dst; }
export function memcmp(a, b, n) {
  for (let i = 0; i < n; i++) {
    const d = uchars[a + i] - uchars[b + i];
    if (d) return d;
  }
  return 0;
}

// ---- 64-bit loads/stores (C `long`, held in JS as a Number, exact below 2^53) ----------

export function load_i64(a) { return u32[a >> 2] + i32[(a >> 2) + 1] * 4294967296; }
export function load_u64(a) { return u32[a >> 2] + u32[(a >> 2) + 1] * 4294967296; }
// uint64_t / int64_t objects (RNG state, hashes) are exact: BigInt
export function load_u64n(a) { return (BigInt(u32[(a >> 2) + 1]) << 32n) | BigInt(u32[a >> 2]); }
export function load_i64n(a) { return BigInt.asIntN(64, load_u64n(a)); }
export function store_64n(a, v) {
  const x = BigInt.asUintN(64, typeof v === "bigint" ? v : BigInt(Math.trunc(v)));
  u32[a >> 2] = Number(x & 0xffffffffn);
  u32[(a >> 2) + 1] = Number(x >> 32n);
}
export function store_i64(a, v) {
  const lo = v % 4294967296;
  u32[a >> 2] = lo;
  i32[(a >> 2) + 1] = Math.floor(v / 4294967296);
}
