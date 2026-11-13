// The game on sessions of sessions/ (emitted game + js/host + js/vendor): 3 public sessions
// scored like frozen/ps_test_runner.mjs, key-by-key play equal to batch, a save/restore session
// across segments, and several games in one process.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { runSegment, NethackGame } = await import("../../js/jsmain.js");
const { decodeScreen, diffCell } = await import("../../frozen/screen-decode.mjs");
const { normalizeSession } = await import("../../frozen/session_loader.mjs");
const { InMemoryStorage } = await import("../../js/storage.js");

const load = (name) =>
  normalizeSession(JSON.parse(readFileSync(new URL(`../../sessions/${name}.session.json`, import.meta.url), "utf8")));
const isRng = (e) => typeof e === "string" && /^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/.test(e);
const normRng = (e) => e.replace(/\s*@\s.*$/, "").replace(/^\d+\s+/, "").trim();
const pre = (s) => String(s).replace(/Version\s+\d+\.\d+\.\d+[^\n]*/, "<<V>>").replace(/^\d{2}:\d{2}:\d{2}\.$/gm, "<time>.");
function sameScreen(a, b) {
  const ga = decodeScreen(pre(a)), gb = decodeScreen(pre(b));
  for (let r = 0; r < 24; r++) for (let c = 0; c < 80; c++) if (diffCell(ga[r][c], gb[r][c])) return false;
  return true;
}

async function score(name) {
  const session = load(name);
  const storage = new InMemoryStorage();
  const screens = [], rng = [], wantScreens = [], wantRng = [];
  for (const seg of session.segments) {
    const g = await runSegment({ ...seg, storage });
    screens.push(...g.getScreens());
    rng.push(...g.getRngLog().map(normRng));
    for (const st of seg.steps || []) {
      wantRng.push(...(st.rng || []).filter(isRng).map(normRng));
      if (st.screen) wantScreens.push(st.screen);
    }
  }
  let s = 0;
  while (s < wantScreens.length && s < screens.length && sameScreen(screens[s], wantScreens[s])) s++;
  let r = 0;
  while (r < wantRng.length && rng[r] === wantRng[r]) r++;
  return { screens: [s, wantScreens.length, screens.length], rng: [r, wantRng.length, rng.length] };
}

test("jsmain exports the host's game", async () => {
  const { Game } = await import("../../js/host/game.js");
  assert.equal(NethackGame, Game);
  assert.equal(typeof runSegment, "function");
});

for (const name of ["seed8000-tourist-starter", "seed0106-priest-extcmd-sweep", "seed0013-friday13-save-then-fullmoon-restore"]) {
  test(`passes ${name}`, async () => {
    const r = await score(name);
    assert.deepEqual(r.screens, [r.screens[1], r.screens[1], r.screens[1]]);
    assert.deepEqual(r.rng, [r.rng[1], r.rng[1], r.rng[1]]);
  });
}

test("key by key (snapshot/replay) equals batch on a real session", async () => {
  const seg = load("seed0106-priest-extcmd-sweep").segments[0];
  const batch = await runSegment({ ...seg });
  const g = new NethackGame({ ...seg, moves: "", interactive: true });
  await g.start();
  for (let i = 0; i < seg.moves.length; i++) g.pushKey(seg.moves.charCodeAt(i));
  assert.deepEqual(g.getScreens(), batch.getScreens());
  assert.deepEqual(g.getCursors(), batch.getCursors());
  assert.deepEqual(g.getRngLog(), batch.getRngLog());
  assert.deepEqual(g.getAnimationFramesByStep(), batch.getAnimationFramesByStep());
});

test("several games in one process are independent", async () => {
  const seg = load("seed8000-tourist-starter").segments[0];
  const a = await runSegment({ ...seg });
  await runSegment({ ...load("seed0106-priest-extcmd-sweep").segments[0] });
  const b = await runSegment({ ...seg });
  assert.deepEqual(b.getScreens(), a.getScreens());
  assert.deepEqual(b.getRngLog(), a.getRngLog());
});
