// The host (js/host/game.js) on a small stand-in game driven the way the emitted
// sys/c2js/nhjs_tty_api.c drives the real one: host callbacks, data installer,
// environment set by the C code, setjmp lowering, persistence of the playground files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Game, setGameEntry } from "../../js/host/game.js";
import { InMemoryStorage } from "../../js/storage.js";

setGameEntry(() => import("./fixtures/stand-in-game.mjs"));
const base = { seed: 4231, datetime: "20260704120000", nethackrc: "OPTIONS=name:Cee\n" };

async function run(input) {
  const g = new Game(input);
  await g.start();
  return g;
}

test("a segment run at once, key by key, and ended by exit()", async () => {
  const input = { ...base, moves: "abcd" };
  const a = await run(input);
  assert.deepEqual(a.getScreens(), ["hello Cee 31 user=0", "c=31", "c=129", "c=228", "c=328"]);
  assert.deepEqual(a.getRngLog(), ["rn2(7)=6", "rn2(100)=29", "rn2(100)=28", "rn2(100)=28"]);
  const b = new Game({ ...input, moves: "", interactive: true });
  await b.start();
  for (const ch of input.moves) b.pushKey(ch.charCodeAt(0));
  assert.deepEqual(b.getScreens(), a.getScreens());
  assert.deepEqual(b.getRngLog(), a.getRngLog());
  const storage = new InMemoryStorage();
  const c = await run({ ...input, moves: "aQ", storage });
  assert.equal(c.ended, true);
  assert.equal(storage.getItem("vfs:/data.txt"), null);
  assert.equal(storage.getItem("vfs:/sysconf"), null);
  assert.equal(storage.getItem("vfs:/record"), "");
});
