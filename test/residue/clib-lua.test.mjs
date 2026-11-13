// Tests for js/vendor/clib-lua.js (the vendored Lua VM + C library).  Run: node --test test/residue/
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createClib, isLongjmp, SIGNATURES, BUILD, printfSlots } from "../../js/vendor/clib-lua.js";

const LUA_MULTRET = -1;
const LUA_REGISTRYINDEX = -1001000;

/** A Lua state plus helpers on top of the raw API (the lua.h macros written in JS). */
function luaOf(c, L) {
  const pop = (n) => c.fn.lua_settop(L, -n - 1);
  const tostring = (i) => {
    const p = c.fn.lua_tolstring(L, i, 0);
    return p ? c.readString(p) : null;
  };
  const register = (name, f) => {
    const k = c.addFunction(f);
    c.fn.lua_pushcclosure(L, k, 0);
    c.call("lua_setglobal", L, name);
    return k;
  };
  /** Load and run a chunk; returns [status, first result as string]. */
  const run = (code) => {
    let rc = c.call("luaL_loadbufferx", L, code, code.length, "=chunk", 0);
    if (rc === 0) rc = c.fn.lua_pcallk(L, 0, 1, 0, 0, 0);
    const out = tostring(-1);
    c.fn.lua_settop(L, 0);
    return [rc, out];
  };
  return { L, pop, tostring, register, run };
}

function newLua(c, alloc) {
  const L = alloc ? c.fn.lua_newstate(alloc, 0) : c.fn.luaL_newstate();
  assert.ok(L > 0);
  c.fn.luaL_openlibs(L);
  return luaOf(c, L);
}

test("module facts: build info, synchronous creation, layout", () => {
  assert.equal(BUILD.lua, "5.4.8");
  assert.equal(BUILD.luaDefines, "-DLUA_COMPAT_5_3 -DLUA_USE_POSIX");
  const c = createClib();
  assert.equal(c.layout.globalBase, BUILD.globalBase);
  assert.ok(c.layout.stackEnd >= c.layout.globalBase);
  assert.ok(c.layout.heapBase >= c.layout.stackBase);
  assert.equal(SIGNATURES.lua_pushinteger, "v:pj");
  assert.equal(SIGNATURES.strtoll, "j:ppi");
  assert.equal(SIGNATURES.vsnprintf, "i:pupV");
  assert.equal(SIGNATURES.snprintf, "i:pup.");
});

test("Lua state with the default allocator and with a JS allocator", () => {
  const c = createClib();
  const a = newLua(c);
  assert.deepEqual(a.run("return _VERSION"), [0, "Lua 5.4"]);
  let calls = 0;
  const alloc = c.addFunction((ud, ptr, osize, nsize) => {
    calls++;
    if (nsize === 0) { c.fn.free(ptr); return 0; }
    return c.fn.realloc(ptr, nsize);
  });
  const b = newLua(c, alloc);
  assert.deepEqual(b.run("local t = {} for i = 1, 100 do t[i] = i * i end return #t .. ':' .. t[100]"), [0, "100:10000"]);
  assert.ok(calls > 100);
  c.fn.lua_close(b.L);
  c.fn.lua_close(a.L);
});

test("Lua calls a JS function registered as a C function; 64-bit integers cross", () => {
  const c = createClib();
  const lua = newLua(c);
  let seen = 0;
  lua.register("twice", (L) => {
    const x = c.call("luaL_checkinteger", L, 1);
    seen += x;
    c.call("lua_pushinteger", L, x * 2);
    return 1;
  });
  assert.deepEqual(lua.run("local t = 0 for i = 1, 1000 do t = t + twice(i) end return t"), [0, "1001000"]);
  assert.equal(seen, 500500);
  assert.deepEqual(lua.run("return twice(1 << 40)"), [0, String(2 ** 41)]);
  c.call("lua_pushinteger", lua.L, -(2n ** 62n));
  assert.equal(c.call64("lua_tointegerx", lua.L, -1, 0), -(2n ** 62n));
  lua.pop(1);
});

test("lua_error raised in a JS callback unwinds through the JS frame into pcall", () => {
  const c = createClib();
  const lua = newLua(c);
  let after = 0;
  lua.register("fail", (L) => {
    c.call("luaL_error", L, "boom %d %s", 7, "from js");
    after++; // never reached
    return 0;
  });
  const [rc, msg] = lua.run("fail() return 1");
  assert.equal(rc, 2); // LUA_ERRRUN
  assert.equal(msg, "chunk:1: boom 7 from js");
  assert.deepEqual(lua.run("local ok, e = pcall(fail) return tostring(ok) .. '|' .. e"), [0, "false|boom 7 from js"]);
  assert.equal(after, 0);
  // the state is still usable and the C stack is balanced
  const sp = c.stackSave();
  for (let i = 0; i < 1000; i++) lua.run("pcall(fail)");
  assert.equal(c.stackSave(), sp);
  assert.deepEqual(lua.run("return 6 * 7"), [0, "42"]);
});

test("JS exceptions pass through compiled frames untouched; longjmp sentinel is recognisable", () => {
  const c = createClib();
  const lua = newLua(c);
  const sp = c.stackSave();
  lua.register("jsthrow", () => { throw new RangeError("js side"); });
  assert.throws(() => lua.run("jsthrow()"), RangeError);
  // compiled frames between the throw and the catch did not pop their stack space: the
  // catcher restores the stack pointer it saved (and must not keep using that Lua state)
  assert.ok(c.stackSave() < sp);
  c.stackRestore(sp);
  let caught = null;
  lua.register("probe", (L) => {
    try { c.call("luaL_error", L, "x"); } catch (e) { caught = e; throw e; }
  });
  lua.run("pcall(probe)");
  assert.ok(isLongjmp(caught));
});

const PAIRS = `
  local t = {}
  for _, w in ipairs({"wand","ring","amulet","tool","food","potion","scroll","spellbook","gem","rock","ball","chain","venom","coin","armor","weapon"}) do t[w] = #w end
  for i = 1, 40 do t["k" .. i] = i end
  local out = {}
  for k, v in pairs(t) do out[#out + 1] = k end
  return table.concat(out, ",")`;

test("pairs iteration order is deterministic across instances and processes", () => {
  const orders = [1, 2].map(() => newLua(createClib()).run(PAIRS)[1]);
  assert.equal(orders[0], orders[1]);
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { createClib } from ${JSON.stringify(new URL("../../js/vendor/clib-lua.js", import.meta.url).href)};
    const c = createClib(); const L = c.fn.luaL_newstate(); c.fn.luaL_openlibs(L);
    const code = ${JSON.stringify(PAIRS)};
    c.call("luaL_loadbufferx", L, code, code.length, "=chunk", 0); c.fn.lua_pcallk(L, 0, 1, 0, 0, 0);
    process.stdout.write(c.readString(c.fn.lua_tolstring(L, -1, 0)));`], { encoding: "utf8" });
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, orders[0]);
});

test("printf family through the format-driven marshaller", () => {
  const c = createClib();
  const cases = [
    [["%d", 42], "42"],
    [["%d %i", -1, 2147483647], "-1 2147483647"],
    [["%u", -1], "4294967295"],
    [["%5d|%-5d|%05d", 42, 42, 42], "   42|42   |00042"],
    [["%*d|%-*d|%.*f", 6, 7, 4, 8, 2, 3.14159], "     7|8   |3.14"],
    [["%lld", 2n ** 62n], "4611686018427387904"],
    [["%lld", -(2 ** 40)], "-1099511627776"],
    [["%llu", -1n], "18446744073709551615"],
    [["%llx|%llX", 0xdeadbeefcafen, 255], "deadbeefcafe|FF"],
    [["%jd", 2 ** 50], "1125899906842624"],
    [["%x %X %o %#x", 255, 255, 8, 255], "ff FF 10 0xff"],
    [["%s|%.3s|%10s|%-10s|", "hello", "hello", "right", "left"], "hello|hel|     right|left      |"],
    [["%c%c%c", "a", 66, "c"], "aBc"],
    [["100%% %s", "sure"], "100% sure"],
    [["%f %e %g %g", 1.5, 12345.678, 0.0001, 1e20], "1.500000 1.234568e+04 0.0001 1e+20"],
    [["%.2f %8.3f %-8.1f|", 2.675, -1.5, 9.99], "2.67   -1.500 10.0    |"],
    [["%d %f %lld %s", 1, 2.5, 3n, "x"], "1 2.500000 3 x"],
    [["%+d % d %hhd %hd", 5, 5, 300, 70000], "+5  5 44 4464"],
    [["%p", 4096], "0x1000"],
    [["%ld", 123456], "123456"],
  ];
  for (const [args, want] of cases) assert.equal(c.format(...args), want, args.map(String).join(" "));
  // snprintf truncation and return value
  const sp = c.stackSave();
  const buf = c.stackAlloc(8);
  assert.equal(c.call("snprintf", buf, 8, "%s-%d", "abcdef", 12345), 12);
  assert.equal(c.readString(buf), "abcdef-");
  // vsnprintf with an argument array as the va_list, and with a raw va_list pointer
  assert.equal(c.call("vsnprintf", buf, 8, "%d/%d", [3, 4]), 3);
  assert.equal(c.readString(buf), "3/4");
  const va = c.vaList(printfSlots("%d %lld").slots, [9, 2n ** 33n]);
  const big = c.stackAlloc(64);
  c.call("vsnprintf", big, 64, "%d %lld", va);
  assert.equal(c.readString(big), "9 8589934592");
  c.stackRestore(sp);
  // sprintf into heap memory
  const p = c.fn.malloc(64);
  assert.equal(c.call("sprintf", p, "%s=%d", "hp", 12), 5);
  assert.equal(c.readString(p), "hp=12");
  c.fn.free(p);
});

test("long64 mode: %ld/%lu/%lx take 64-bit values (the game's long is 64-bit)", () => {
  const c32 = createClib();
  const c64 = createClib({ long64: true });
  assert.equal(c64.format("%ld %lu %lx %d", 2 ** 40, 2 ** 33, 2 ** 36, 7), "1099511627776 8589934592 1000000000 7");
  assert.equal(c32.format("%ld", 2 ** 31 + 5), "-2147483643"); // plain C: long is 32-bit here
  const sp = c64.stackSave();
  const n = c64.stackAlloc(8);
  assert.equal(c64.call("sscanf", "1099511627776", "%ld", n), 1);
  assert.equal(c64.HEAPU32[n >> 2] + c64.HEAP32[(n >> 2) + 1] * 2 ** 32, 2 ** 40);
  c64.stackRestore(sp);
});

test("sscanf", () => {
  const c = createClib();
  const sp = c.stackSave();
  const a = c.stackAlloc(4), b = c.stackAlloc(8), d = c.stackAlloc(8), s = c.stackAlloc(32), x = c.stackAlloc(4);
  assert.equal(c.call("sscanf", "12 -987654321012 3.25 word ff", "%d %lld %lf %31s %x", a, b, d, s, x), 5);
  assert.equal(c.HEAP32[a >> 2], 12);
  assert.equal(c.HEAPU32[b >> 2] + c.HEAP32[(b >> 2) + 1] * 2 ** 32, -987654321012);
  assert.equal(c.HEAPF64[d >> 3], 3.25);
  assert.equal(c.readString(s), "word");
  assert.equal(c.HEAP32[x >> 2], 255);
  assert.equal(c.call("sscanf", "key = value;", "%[a-z] = %[^;]", s, s + 16), 2);
  assert.equal(c.readString(s) + "|" + c.readString(s + 16), "key|value");
  assert.equal(c.call("sscanf", "7 8", "%*d %d", a), 1);
  assert.equal(c.HEAP32[a >> 2], 8);
  assert.equal(c.call("sscanf", "", "%d", a), -1);
  c.stackRestore(sp);
});

test("regex: regcomp / regexec / regerror / regfree", () => {
  const c = createClib();
  const re = c.fn.malloc(64); // regex_t
  const m = c.fn.malloc(8 * 4); // regmatch_t[4]
  const REG_EXTENDED = 1, REG_ICASE = 2;
  assert.equal(c.call("regcomp", re, "^(gr[ae]y) (cat|dog)s?$", REG_EXTENDED | REG_ICASE), 0);
  assert.equal(c.call("regexec", re, "Grey Dogs", 4, m, 0), 0);
  assert.deepEqual([c.HEAP32[(m >> 2) + 2], c.HEAP32[(m >> 2) + 3]], [0, 4]);
  assert.deepEqual([c.HEAP32[(m >> 2) + 4], c.HEAP32[(m >> 2) + 5]], [5, 8]);
  assert.equal(c.call("regexec", re, "green cat", 0, 0, 0), 1); // REG_NOMATCH
  c.fn.regfree(re);
  const rc = c.call("regcomp", re, "a(b", REG_EXTENDED);
  assert.notEqual(rc, 0);
  const buf = c.fn.malloc(128);
  c.call("regerror", rc, re, buf, 128);
  assert.equal(c.readString(buf), "Missing ')'"); // musl's text; the game uses host/regerror.js
  c.fn.free(buf); c.fn.free(m); c.fn.free(re);
});

test("qsort and bsearch with a JS comparator in the function table", () => {
  const c = createClib();
  const n = 200;
  const arr = c.fn.malloc(n * 4);
  let seed = 12345;
  for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; c.HEAP32[(arr >> 2) + i] = seed % 1000; }
  let calls = 0;
  const cmp = c.addFunction((a, b) => { calls++; return c.HEAP32[a >> 2] - c.HEAP32[b >> 2]; });
  c.fn.qsort(arr, n, 4, cmp);
  const got = Array.from(c.HEAP32.subarray(arr >> 2, (arr >> 2) + n));
  assert.deepEqual(got, [...got].sort((x, y) => x - y));
  assert.ok(calls > n);
  const key = c.fn.malloc(4);
  c.HEAP32[key >> 2] = got[77];
  const hit = c.fn.bsearch(key, arr, n, 4, cmp);
  assert.equal(c.HEAP32[hit >> 2], got[77]);
  c.removeFunction(cmp);
  assert.equal(c.addFunction(() => 0), cmp); // freed slot reused
});

test("malloc/realloc/free stress with heap growth and the growth hook", () => {
  const c = createClib();
  const grows = [];
  c.onGrow((buf, oldSize) => grows.push([oldSize, buf.byteLength]));
  const startSize = c.HEAPU8.length;
  const live = new Map();
  let seed = 1;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) >>> 0; return (seed >>> 8) % n; };
  for (let i = 0; i < 20000; i++) {
    const op = rnd(10);
    if (op < 5 || live.size < 10) {
      const size = 1 + rnd(i > 15000 ? 300000 : 4000);
      const p = c.fn.malloc(size);
      assert.ok(p >= c.layout.heapBase, "allocation below the heap");
      c.HEAPU8.fill(i & 255, p, p + size);
      live.set(p, [size, i & 255]);
    } else if (op < 8) {
      const keys = [...live.keys()];
      const p = keys[rnd(keys.length)];
      const [size, fill] = live.get(p);
      assert.equal(c.HEAPU8[p], fill); assert.equal(c.HEAPU8[p + size - 1], fill);
      c.fn.free(p);
      live.delete(p);
    } else {
      const keys = [...live.keys()];
      const p = keys[rnd(keys.length)];
      const [size, fill] = live.get(p);
      const ns = 1 + rnd(8000);
      const q = c.fn.realloc(p, ns);
      for (const at of [0, Math.min(size, ns) - 1]) assert.equal(c.HEAPU8[q + at], fill);
      live.delete(p);
      c.HEAPU8.fill(fill, q, q + ns);
      live.set(q, [ns, fill]);
    }
  }
  assert.ok(c.HEAPU8.length > startSize, "heap grew");
  assert.ok(grows.length > 0);
  assert.equal(grows[grows.length - 1][1], c.HEAPU8.length);
  assert.equal(c.buffer, c.HEAPU8.buffer);
  const big = c.call("calloc", 1, 50 << 20);
  assert.ok(big > 0 && c.HEAPU8[big + (50 << 20) - 1] === 0);
  const al = c.fn.aligned_alloc(4096, 100);
  assert.equal(al % 4096, 0);
});

function workload(c) {
  const lua = newLua(c);
  lua.register("f", (L) => { c.call("lua_pushinteger", L, c.call("luaL_checkinteger", L, 1) + 1); return 1; });
  lua.run("local s = {} for i = 1, 2000 do s[#s + 1] = tostring(f(i)) .. string.rep('x', i % 7) end return #table.concat(s)");
  lua.run(PAIRS);
  const ps = [];
  for (let i = 0; i < 300; i++) ps.push(c.fn.malloc(1 + ((i * 7919) % 5000)));
  for (let i = 0; i < 300; i += 3) c.fn.free(ps[i]);
  c.format("%d %s %f", 1, "two", 3.0);
  return lua;
}

test("determinism: two instances doing the same operations have identical memory", () => {
  const a = createClib(), b = createClib();
  workload(a); workload(b);
  assert.equal(a.HEAPU8.length, b.HEAPU8.length);
  const h = (c) => createHash("sha256").update(c.HEAPU8).digest("hex");
  assert.equal(h(a), h(b));
});

test("the reserved low region [0, globalBase) is never written", () => {
  const c = createClib();
  const low = c.HEAPU8.subarray(0, c.layout.globalBase);
  assert.ok(low.every((x) => x === 0));
  low.fill(0xa5, 1024);
  workload(c);
  const lowAfter = c.HEAPU8.subarray(0, c.layout.globalBase);
  assert.ok(lowAfter.subarray(0, 1024).every((x) => x === 0));
  assert.ok(lowAfter.subarray(1024).every((x) => x === 0xa5));
});

test("time: fixed clock by default, host clock and local-time hooks", () => {
  const c = createClib();
  assert.equal(c.call("time", 0), 0);
  const fixed = Date.UTC(2026, 10, 10, 12, 30, 0);
  const h = createClib({
    now: () => fixed,
    localtime: (t) => {
      const f = { ...utc(t - 5 * 3600), isdst: 0, gmtoff: -5 * 3600 };
      return f;
    },
  });
  function utc(t) {
    const d = new Date(t * 1000);
    return { sec: d.getUTCSeconds(), min: d.getUTCMinutes(), hour: d.getUTCHours(), mday: d.getUTCDate(),
      mon: d.getUTCMonth(), year: d.getUTCFullYear() - 1900, wday: d.getUTCDay(),
      yday: Math.floor((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5), isdst: 0, gmtoff: 0 };
  }
  assert.equal(h.call("time", 0), fixed / 1000);
  const sp = h.stackSave();
  const tp = h.stackAlloc(8);
  h.call("time", tp);
  const tm = h.fn.localtime(tp);
  const buf = h.stackAlloc(64);
  h.call("strftime", buf, 64, "%Y-%m-%d %H:%M:%S %a %j", tm);
  assert.equal(h.readString(buf), "2026-11-10 07:30:00 Tue 314");
  const g = h.fn.gmtime(tp);
  h.call("strftime", buf, 64, "%H:%M", g);
  assert.equal(h.readString(buf), "12:30");
  h.stackRestore(sp);
  const lua = newLua(h);
  assert.deepEqual(lua.run("return os.time() .. ' ' .. os.date('!%Y-%m-%d', 0)"), [0, `${fixed / 1000} 1970-01-01`]);
});

test("environment and stdout hooks", () => {
  const out = [];
  const c = createClib({ env: { HOME: "/home/x", TERM: "xterm" }, stdout: (b) => out.push(Buffer.from(b).toString("latin1")) });
  assert.equal(c.readString(c.call("getenv", "TERM")), "xterm");
  assert.equal(c.call("getenv", "NOPE"), 0);
  c.call("printf", "a%db\n", 1);
  c.call("puts", "line");
  c.call("fflush", 0);
  assert.equal(out.join(""), "a1b\nline\n");
  assert.equal(c.call("fopen", "/x", "r"), 0); // no file system unless the host provides one
});

test("string, ctype, stdlib and math functions", () => {
  const c = createClib();
  assert.equal(c.call("strlen", "hello"), 5);
  assert.equal(c.call("strcmp", "abc", "abd") < 0, true);
  assert.equal(c.call("strncasecmp", "HeLLo", "hello", 5), 0);
  assert.equal(c.fn.toupper(97), 65);
  assert.equal(c.fn.isspace(9) !== 0, true);
  assert.equal(c.call("atoi", "  -17x"), -17);
  assert.equal(c.call("strtol", "0x7fffffff", 0, 0), 2147483647);
  assert.equal(c.call("strtoull", "18446744073709551615", 0, 10), 2 ** 64);
  assert.equal(c.call("llabs", -(2 ** 40)), 2 ** 40);
  assert.equal(c.call("atoll", "-9007199254740991"), -9007199254740991);
  assert.equal(c.call("strtod", "2.5e3", 0), 2500);
  assert.equal(c.fn.pow(2, 10), 1024);
  assert.equal(c.fn.sqrt(2), Math.SQRT2);
  assert.equal(c.fn.floor(-1.5), -2);
  const sp = c.stackSave();
  const r = c.stackAlloc(8);
  c.call("div", r, 17, 5); // struct return: caller passes the result buffer
  assert.deepEqual([c.HEAP32[r >> 2], c.HEAP32[(r >> 2) + 1]], [3, 2]);
  c.stackRestore(sp);
  c.fn.srand(1);
  const r1 = [c.fn.rand(), c.fn.rand()];
  c.fn.srand(1);
  assert.deepEqual([c.fn.rand(), c.fn.rand()], r1);
});

test("snapshot / restore returns the module to an identical state", () => {
  const c = createClib();
  const lua = newLua(c);
  lua.run("x = 1");
  const s = c.snapshot();
  const h = () => createHash("sha256").update(c.HEAPU8.subarray(0, c.sbrk(0))).digest("hex");
  const before = h();
  const after1 = lua.run("x = x + 1 local t = {} for i = 1, 5000 do t[i] = ('v' .. i):rep(50) end return x");
  for (let i = 0; i < 100; i++) c.fn.malloc(100000);
  c.restore(s);
  assert.equal(c.sbrk(0), s.top);
  assert.equal(h(), before);
  assert.ok(c.HEAPU8.subarray(s.top).every((b) => b === 0));
  assert.deepEqual(lua.run("x = x + 1 local t = {} for i = 1, 5000 do t[i] = ('v' .. i):rep(50) end return x"), after1);
});
