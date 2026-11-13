// Interactive play through js/allmain.js moveloop_core() on a display, as the browser page
// drives it: with every key queued up front (type-ahead: one run over the queued keys,
// host/game.js pushKey), with one key per call (snapshot and replay), and with keys arriving
// in bursts (both, mixed). After every call the display and the screen shown must be
// the same in all three, and the screen the one a batch run shows after that many keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { runSegment, NethackGame } = await import("../../js/jsmain.js");
const { moveloop_core } = await import("../../js/allmain.js");
const { game } = await import("../../js/gstate.js");
const { GameDisplay } = await import("../../js/game_display.js");
const { normalizeSession } = await import("../../frozen/session_loader.mjs");
const { InMemoryStorage } = await import("../../js/storage.js");

const load = (name) =>
  normalizeSession(JSON.parse(readFileSync(new URL(`../../sessions/${name}.session.json`, import.meta.url), "utf8")));

class QueueEmpty extends Error {}

// bursts of 1, 2, 3 or 7 keys, in a fixed order
const BURSTS = [3, 1, 7, 2, 1, 1, 7, 3];

async function play(seg, storage, mode) {
  const display = new GameDisplay(null);
  display.onEmptyQueue = () => {
    throw new QueueEmpty();
  };
  game.nhDisplay = display;
  const g = new NethackGame({ seed: seg.seed, datetime: seg.datetime, nethackrc: seg.nethackrc, storage });
  g._pendingDisplay = display;
  const keys = [...seg.moves].map((c) => c.charCodeAt(0));
  let pushed = 0, burst = 0;
  const push = (n) => {
    for (let k = 0; k < n && pushed < keys.length; k++) display.pushKey(keys[pushed++]);
  };
  if (mode === "queued") push(keys.length);
  if (mode === "bursts") push(BURSTS[burst++ % BURSTS.length]);
  await g.start();
  const shown = () => ({
    display: [display.terminal.serialize(), display.cursorCol, display.cursorRow, display.cursorVisible],
    screen: g.shownScreen(),
  });
  const steps = [shown()];
  for (let i = 0; i < keys.length; i++) {
    if (mode === "one") push(1);
    if (mode === "bursts" && display.inputQueueLength === 0) push(BURSTS[burst++ % BURSTS.length]);
    try {
      await moveloop_core();
    } catch (e) {
      if (e instanceof QueueEmpty) break;
      throw e;
    }
    steps.push(shown());
    if (game.program_state?.gameover) break;
  }
  return { steps, ended: g.ended };
}

for (const name of ["seed8000-tourist-starter", "seed0101-ranger-quiver-throw-travel-engrave", "seed0013-friday13-save-then-fullmoon-restore"]) {
  test(`type-ahead, key by key and bursts show the same as batch: ${name}`, async () => {
    const stores = { queued: new InMemoryStorage(), one: new InMemoryStorage(), bursts: new InMemoryStorage(), batch: new InMemoryStorage() };
    for (const seg of load(name).segments) {
      const queued = await play(seg, stores.queued, "queued");
      const one = await play(seg, stores.one, "one");
      const bursts = await play(seg, stores.bursts, "bursts");
      const batch = await runSegment({ ...seg, storage: stores.batch });
      assert.deepEqual(queued, one);
      assert.deepEqual(bursts, one);
      assert.equal(one.ended, batch.ended);
      one.steps.forEach((step, k) => assert.deepEqual(step.screen, batch._log.shownAt(k), `after ${k} keys`));
    }
  });
}

test("an interactive game shown on a display writes no RNG log unless asked to", async () => {
  const seg = load("seed8000-tourist-starter").segments[0];
  const withDisplay = async (opts) => {
    const g = new NethackGame({ ...seg, moves: "", ...opts });
    g.attachDisplay(new GameDisplay(null));
    await g.start();
    for (const ch of seg.moves) g.pushKey(ch.charCodeAt(0));
    return g;
  };
  const batch = await runSegment({ ...seg });
  assert.deepEqual((await withDisplay({})).getRngLog(), []);
  assert.deepEqual((await withDisplay({ rngLog: true })).getRngLog(), batch.getRngLog());
});
