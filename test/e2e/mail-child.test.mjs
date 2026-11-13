// Reading a scroll of mail (mail.c readmail() -> unixunix.c child(1)): the
// game suspends the windows (a blank screen), runs the mail reader outside
// the capture, then waits in getret() -> xwaitforspace() with cbreak on (the
// game's stdin is not a terminal, see settty() in the port's host).  CR,
// LF, space and ESC end the wait; any other key beeps, is consumed, and leaves
// the screen blank.  Then the windows come back (docrt()).
import { test } from "node:test";
import assert from "node:assert/strict";

const { runSegment } = await import("../../js/jsmain.js");

const rc =
  "OPTIONS=name:Tester,role:Valkyrie,race:human,gender:female,align:neutral\n" +
  "OPTIONS=playmode:debug,!legacy,!tutorial,suppress_alert:3.4.3\nOPTIONS=pettype:none\n";
// wizard mode: create a mail daemon, kill it, travel to its scroll, pick it up,
// read it (accepting the conduct prompt) and dismiss "it disappears.--More--"
const readMail = "\x07mail daemon\r#wizkill\r\r\rm.\x1b_o.,rey\r";

async function play(wait) {
  const moves = readMail + wait + "i\x1b";
  const g = await runSegment({ seed: 4242, datetime: "20000110090000", nethackrc: rc, moves });
  // input step k is the boundary after key k; blank screens are not kept
  const byStep = new Map(g._log.screenSteps.map((step, i) => [step, g.getScreens()[i]]));
  return { g, byStep, waitStep: readMail.length };
}

test("the mail reader leaves a blank screen until a key from CR, LF, space, ESC", async () => {
  const { byStep, waitStep } = await play("xq\x01y ");
  for (let k = 0; k <= 4; k++) assert.equal(byStep.has(waitStep + k), false, `step ${waitStep + k} is blank`);
  const back = byStep.get(waitStep + 5);
  assert.match(back, /Dlvl:1/, "the space redraws the map");
  assert.doesNotMatch(back, /Unknown command/);
  assert.match(byStep.get(waitStep + 6), /Weapons/, "the next key is a command again");
});

for (const [name, key] of [["CR", "\r"], ["LF", "\n"], ["space", " "], ["ESC", "\x1b"]]) {
  test(`${name} ends the wait at once, and the keys consumed by it change nothing else`, async () => {
    const a = await play(key);
    const b = await play("abc" + key);
    assert.equal(a.byStep.has(a.waitStep), false);
    assert.match(a.byStep.get(a.waitStep + 1), /Dlvl:1/);
    assert.deepEqual(b.g.getRngLog(), a.g.getRngLog());
    assert.deepEqual(b.g.getScreens(), a.g.getScreens());
  });
}
