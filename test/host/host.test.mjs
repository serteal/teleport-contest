// Unit tests of the platform layer (js/host).  Expectations are fixtures:
// libc-transcript.json (the C library on Emscripten's file-system semantics),
// time-vectors.json (calendar.c's New York conversion) and
// qsort-reference.json (the comparator call order of the reference qsort).
//   node --test test/host/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { Vfs, E, O } from "../../js/host/vfs.js";
import { createSyscalls } from "../../js/host/syscalls.js";
import { utf8ToString, stringToUtf8 } from "../../js/host/utf8.js";
import * as T from "../../js/host/time.js";
import { qsort } from "../../js/host/qsort.js";
import { regerror, regerrorText, REG_EPAREN, REG_BADRPT } from "../../js/host/regerror.js";
import { playerNameFromRc } from "../../js/host/env.js";
import { createClib } from "../../js/vendor/clib-lua.js";
import { InMemoryStorage } from "../../js/storage.js";
import { restorePersistentVfs, snapshotPersistentVfs } from "../../js/persistence.js";
import { runScenario } from "./fixtures/libc-scenario.mjs";

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

function residue(vfs = new Vfs()) {
  let c = null;
  const mem = {
    get HEAP8() { return c.HEAP8; },
    get HEAPU8() { return c.HEAPU8; },
    get HEAP16() { return c.HEAP16; },
    get HEAP32() { return c.HEAP32; },
    get HEAPU32() { return c.HEAPU32; },
  };
  c = createClib({ sys: createSyscalls(vfs, mem) });
  return { c, vfs, mem };
}

test("C library over the VFS: same transcript as under Emscripten's FS", () => {
  const { c } = residue();
  const got = runScenario({
    call(name, ...args) {
      if (name === "creat") return c.call("open", args[0], O.CREAT | O.WRONLY | O.TRUNC, args[1]);
      const flat = [];
      for (const v of args) if (v && v.va) flat.push(...v.va); else flat.push(v);
      if (name === "open" && args.length === 3 && typeof args[2] === "number") flat.length = 2;
      return c.call(name, ...flat);
    },
    cstr: (s) => c.newString(s),
    buf(n) { const p = c.fn.malloc(n); c.HEAPU8.fill(0, p, p + n); return p; },
    bytes: (p, n) => [...c.HEAPU8.subarray(p, p + n)],
    i32: (p) => c.HEAP32[p >> 2],
    errno: () => c.HEAP32[c.fn.__errno_location() >> 2],
    va: (...x) => ({ va: x }),
  });
  const want = fixture("libc-transcript.json");
  assert.equal(got.length, want.length);
  for (let i = 0; i < want.length; i++) assert.deepEqual(got[i], want[i], `step ${i} ${want[i][0]}`);
});

test("VFS initial tree, std streams and devices as Emscripten sets them up", () => {
  const vfs = new Vfs();
  assert.deepEqual(vfs.readdir("/"), [".", "..", "tmp", "home", "dev", "proc"]);
  assert.deepEqual(vfs.readdir("/dev"), [".", "..", "null", "tty", "tty1", "random", "urandom", "shm", "stdin", "stdout", "stderr"]);
  assert.equal(vfs.streams[0].path, "/dev/tty");
  assert.equal(vfs.streams[2].path, "/dev/tty1");
  assert.equal(vfs.streams.length, 3);
});

test("VFS journal: mark/rollback restores files, directories, streams, positions", () => {
  const vfs = new Vfs();
  vfs.writeFile("/save/keep", "abc");
  vfs.writeFile("/log", "1\n");
  const log = vfs.open("/log", O.WRONLY | O.APPEND);
  const ro = vfs.open("/save/keep", O.RDONLY);
  vfs.mark();
  const buf = new Uint8Array(8);
  vfs.write(log, new TextEncoder().encode("2\n3\n"), 0, 4);
  vfs.read(ro, buf, 0, 2);
  vfs.writeFile("/save/new", "zzz");
  vfs.unlink("/save/keep");
  vfs.rename("/log", "/save/log2");
  vfs.mkdir("/x");
  vfs.close(ro);
  const extra = vfs.open("/save/new", O.RDONLY);
  vfs.rollback();
  assert.deepEqual([...vfs.readFile("/log")], [...new TextEncoder().encode("1\n")]);
  assert.equal(new TextDecoder().decode(vfs.readFile("/save/keep")), "abc");
  assert.equal(vfs.exists("/save/new"), false);
  assert.equal(vfs.exists("/save/log2"), false);
  assert.equal(vfs.exists("/x"), false);
  assert.equal(vfs.streams[ro.fd], ro);
  assert.equal(ro.position, 0);
  assert.equal(vfs.streams[extra.fd ?? -1] ?? null, extra.fd === null ? null : vfs.streams[extra.fd]);
  assert.equal(vfs.streams.filter(Boolean).length, 5);
  // the journal keeps working after a rollback (a new mark)
  vfs.write(log, new TextEncoder().encode("x"), 0, 1);
  vfs.rollback();
  assert.equal(vfs.readFile("/log").length, 2);
  // overwriting old bytes is undone too
  const rw = vfs.open("/save/keep", O.RDWR);
  vfs.mark();
  vfs.write(rw, new TextEncoder().encode("Q"), 0, 1);
  vfs.rollback();
  assert.equal(new TextDecoder().decode(vfs.readFile("/save/keep")), "abc");
});

test("VFS errors: errno values of the C library", () => {
  const vfs = new Vfs();
  const code = (f) => { try { f(); return 0; } catch (e) { return e.errno; } };
  assert.equal(code(() => vfs.open("/nope", O.RDONLY)), E.ENOENT);
  assert.equal(code(() => vfs.mkdir("/tmp")), E.EEXIST);
  assert.equal(code(() => vfs.rmdir("/dev")), E.ENOTEMPTY);
  assert.equal(code(() => vfs.unlink("/tmp")), E.EISDIR);
  assert.equal(code(() => vfs.open("/tmp", O.WRONLY)), E.EISDIR);
  assert.equal(code(() => vfs.llseek(vfs.streams[1], 0, 0)), E.ESPIPE);
});

test("persistence: files survive a segment through storage, data files do not", () => {
  const storage = new InMemoryStorage();
  const a = new Vfs();
  a.writeFile("/nhdat", "data");
  const skip = new Set(a.walk("/").map(([p]) => p));
  a.writeFile("/save/0wizard.gz", "\x00\x01\xff");
  a.writeFile("/record", "rec\n");
  snapshotPersistentVfs(a, storage, skip);
  const b = new Vfs();
  restorePersistentVfs(b, storage);
  assert.deepEqual([...b.readFile("/save/0wizard.gz")], [0, 1, 255]);
  assert.equal(new TextDecoder().decode(b.readFile("/record")), "rec\n");
  assert.equal(b.exists("/nhdat"), false);
  // deleted files leave storage
  b.unlink("/save/0wizard.gz");
  snapshotPersistentVfs(b, storage);
  assert.equal(storage.getItem("vfs:/save/0wizard.gz"), null);
});

test("UTF-8 path strings as Emscripten converts them", () => {
  const heap = new Uint8Array(64);
  const n = stringToUtf8("/save/Zoë☃", heap, 0, 64);
  assert.equal(utf8ToString(heap, 0), "/save/Zoë☃");
  assert.equal(n, 13);
});

test("session time: equals calendar.c's New York conversion on golden vectors", () => {
  for (const [dt, epoch, tms] of fixture("time-vectors.json")) {
    assert.equal(T.sessionEpoch(dt), epoch, dt);
    for (const [d, sec, min, hour, mday, mon, year, wday, yday, isdst] of tms) {
      const f = T.localtime(epoch + d);
      assert.deepEqual([f.sec, f.min, f.hour, f.mday, f.mon, f.year, f.wday, f.yday, f.isdst], [sec, min, hour, mday, mon, year, wday, yday, isdst], `${dt}${d >= 0 ? "+" : ""}${d}`);
    }
  }
  assert.equal(T.mktime(T.localtime(T.sessionEpoch("20260704120000"))), T.sessionEpoch("20260704120000"));
});

// qsort-reference.json: comparator calls of the reference qsort(): per call [position of a,
// id of a, position of b, id of b, result]; position -1 is heapsort's temporary element.  Element i holds id i in its first
// min(width, 8) bytes.  Modes: 0 compare keys[id]; 1 NetHack's nh_qsort_idx_cmp (keys, then id),
// run here with an 8-byte index struct and with this port's 4-byte one; 2 random answers
// in {-1, 0, 1} from an LCG; 4 McIlroy's antiqsort adversary.
test("qsort: the same comparator calls, in the same order, as the reference qsort", () => {
  const { c } = residue();
  for (const k of fixture("qsort-reference.json").cases) {
    for (const width of k.mode === 1 ? [k.width, 4] : [k.width]) {
      const n = k.keys.length;
      const idBytes = Math.min(width, 4);
      const base = c.fn.malloc(Math.max(1, n * width));
      const id = (p) => { let v = 0; for (let i = 0; i < idBytes; i++) v += c.HEAPU8[p + i] * 2 ** (8 * i); return v; };
      for (let i = 0; i < n; i++) {
        c.HEAPU8.fill(0, base + i * width, base + (i + 1) * width);
        for (let b = 0; b < idBytes; b++) c.HEAPU8[base + i * width + b] = (i >>> (8 * b)) & 255;
      }
      const pos = (p) => (p >= base && p < base + n * width && (p - base) % width === 0 ? (p - base) / width : -1);
      let seed = k.seed >>> 0;
      const val = new Array(n).fill(n);
      let solid = 0, cand = 0;
      const calls = [];
      qsort(c, base, n, width, (x, y) => {
        const a = id(x), b = id(y);
        let r;
        if (k.mode === 0 || k.mode === 1) {
          r = (k.keys[a] > k.keys[b]) - (k.keys[a] < k.keys[b]);
          if (!r && k.mode === 1) r = a < b ? -1 : +(a > b);
        } else if (k.mode === 2) {
          seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
          r = ((seed >>> 16) % 3) - 1;
        } else {
          if (val[a] === n && val[b] === n) { if (a === cand) val[a] = solid++; else val[b] = solid++; }
          if (val[a] === n) cand = a; else if (val[b] === n) cand = b;
          r = (val[a] > val[b]) - (val[a] < val[b]);
        }
        calls.push([pos(x), a, pos(y), b, r]);
        return r;
      });
      const order = Array.from({ length: n }, (_, i) => id(base + i * width));
      c.fn.free(base);
      assert.deepEqual(calls, k.calls, `${k.note}, width ${width}: comparator calls`);
      assert.deepEqual(order, k.order, `${k.note}, width ${width}: result`);
    }
  }
});

test("regerror: FreeBSD messages, truncation like strncpy", () => {
  const mem = { HEAPU8: new Uint8Array(64) };
  assert.equal(regerror(mem, REG_EPAREN, 0, 0, 64), "parentheses not balanced".length + 1);
  assert.equal(utf8ToString(mem.HEAPU8, 0), "parentheses not balanced");
  regerror(mem, REG_BADRPT, 0, 0, 7);
  assert.equal(utf8ToString(mem.HEAPU8, 0), "repeti");
  assert.equal(regerrorText(999), "*** unknown regexp error code ***");
});

test("player name: the first name: of an OPTIONS= line of the rc", () => {
  assert.equal(playerNameFromRc("OPTIONS=color\nOPTIONS=name:Zed,!autopickup\n"), "Zed");
  assert.equal(playerNameFromRc("OPTIONS = name: Ann\nOPTIONS=name:Bob\n"), "Ann");
  assert.equal(playerNameFromRc("OPTIONS=color\n"), "");
});

test("host libc: popen/pclose (no subprocesses), isatty (std streams are pipes), file_exists", async () => {
  const { createHostLibc } = await import("../../js/host/libc.js");
  const vfs = new Vfs();
  const { c } = residue(vfs);
  vfs.writeFile("/sysconf", "x");
  const h = createHostLibc(c, { vfs: () => vfs });
  const errno = () => c.HEAP32[c.fn.__errno_location() >> 2];
  assert.equal(h.popen(c.newString("ls"), c.newString("r")), 0);
  assert.equal(errno(), E.ENOSYS);
  assert.equal(h.pclose(0), -1);
  assert.equal(h.file_exists(c.newString("/sysconf")), 1);
  assert.equal(h.file_exists(c.newString("/nope")), 0);
  // the std streams are pipes
  assert.deepEqual([0, 1, 2].map((fd) => h.isatty(fd)), [0, 0, 0]);
  assert.equal(errno(), E.ENOTSUP);
  const fd = c.call("open", "/sysconf", 0);
  assert.equal(h.isatty(fd), 0);
  assert.equal(errno(), E.ENOTTY);
  assert.equal(h.isatty(c.call("open", "/dev/tty", 2)), 1);
  assert.equal(h.isatty(99), 0);
});
