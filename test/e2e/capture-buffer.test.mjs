// The 6,144-byte capture buffer of win/tty/termcap.c (nomux_ref_overflow_state):
// synthetic screens put straight into the NOMUX shadow buffer, captured as the
// game captures them, checked against a byte model of the reference memory
// layout (buffer, then nomux_raw_active/row/col at 6144/6148/6152, then
// stdout's 1,024-byte buffer at 6448).
import { test } from "node:test";
import assert from "node:assert/strict";

await import("../../js/jsmain.js"); // sets the game's entry module
const { loadMachine } = await import("../../js/host/game.js");
const m = await loadMachine(); // loads the game's modules on the machine's heap
const T = await import("../../js/win/tty/termcap.js");
const { _ } = await import("../../js/rt/strings.js");

// One fresh process: pristine statics, captures collected.
function freshGame({ unbounded = false } = {}) {
  m.newGame({ datetime: "" });
  if (unbounded) m.clib.call("setenv", "NHJS_UNBOUNDED_CAPTURE", "1", 1);
  const got = [];
  m.current = {
    key: () => -1,
    capture: (anim, seq, animId, cx, cy, screen) => got.push({ anim, seq, animId, cursor: [cx, cy], screen }),
    boundary: () => {},
    installData: () => {},
  };
  T.nomux_clear_screen();
  return got;
}

// `coloured` cells of alternating red/green from the top left, then `plain` uncoloured
// cells on the last row: a coloured cell serializes to 6 bytes, a plain one to 1, so the
// length is set to the byte.
function paint(coloured, plain = 0) {
  T.nomux_clear_screen();
  for (let k = 0; k < coloured; k++) {
    const cell = T.nomux_buf[Math.floor(k / 80)][k % 80];
    cell.ch = 0x41 + (k % 26);
    cell.fg = k % 2 ? 1 : 2;
  }
  for (let c = 0; c < plain; c++) T.nomux_buf[23][c].ch = 0x61 + (c % 26);
}

// What the true capture of the current shadow buffer is (no reference effects).
const trueScreen = () => m.clib.readString(T.nomux_capture_screen());

// The reference build's memory around its capture buffer.
function referenceModel() {
  const mem = new Uint8Array(8192);
  const i32 = (o) => mem[o] | (mem[o + 1] << 8) | (mem[o + 2] << 16) | (mem[o + 3] << 24);
  return {
    capture(S, seq, anim, cursor) {
      const L = S.length;
      for (let k = 0; k < L; k++) mem[k] = S.charCodeAt(k);
      mem[L] = 0;
      const active = i32(6144) !== 0;
      const [cx, cy] = active ? [i32(6152), i32(6148)] : cursor;
      const H = `\x1b]7777;KIND=input;SEQ=${seq};ANIM=${anim};CX=${cx};CY=${cy};LEN=${L}\x07`;
      for (let k = 0; k < H.length; k++) mem[6448 + k] = H.charCodeAt(k);
      for (let k = 0; 6448 + H.length + k < Math.min(L, 6448 + 1024); k++) mem[6448 + H.length + k] = mem[k];
      return { cursor: [cx, cy], screen: String.fromCharCode(...mem.subarray(0, L)) };
    },
    raw() {
      // nomux_raw_emit with nomux_raw_active set: no reset; the text (off screen here)
      // then a newline: next row, column 0
      const view = new DataView(mem.buffer);
      view.setInt32(6148, i32(6148) + 1, true);
      view.setInt32(6152, 0, true);
    },
  };
}

test("a capture within 6,144 bytes is unchanged", () => {
  const got = freshGame();
  paint(1000);
  const S = trueScreen();
  assert.ok(S.length > 6000 && S.length <= 6144, `length ${S.length}`);
  T.nomux_capture_write_input_boundary();
  assert.deepEqual(got.at(-1).cursor, [0, 0]);
  assert.equal(got.at(-1).screen, S);
});

test("past 6,448 bytes: overwritten cursor state and the marker in the payload, for the rest of the process", () => {
  const got = freshGame();
  const model = referenceModel();
  const steps = [
    () => paint(1100), // > 6,448 bytes
    () => paint(200), // short: the cursor stays where the long one put it
    () => {
      T.nomux_raw_emit(_("You die..."), 0); // raw_print goes on from that row, no clear
      model.raw();
    },
    () => paint(1030), // between 6,144 and 6,448: state only
  ];
  let seq = 0;
  for (const step of steps) {
    step();
    const S = trueScreen();
    T.nomux_capture_write_input_boundary();
    const want = model.capture(S, ++seq, 0, [0, 0]);
    const have = got.at(-1);
    assert.deepEqual(have.cursor, want.cursor, `step ${seq} cursor`);
    assert.equal(have.screen, want.screen, `step ${seq} screen`);
  }
  assert.ok(got[0].screen.includes("\x1b]7777;KIND=input;SEQ=1;"));
  assert.notDeepEqual(got[1].cursor, [0, 0]);
  assert.equal(got[2].cursor[0], 0);
  assert.equal(got[2].cursor[1], got[1].cursor[1] + 1);
});

test("a capture ending on the saved state replaces only the bytes it covers", () => {
  for (const target of [6144, 6145, 6149, 6153, 6156]) {
    const got = freshGame();
    const model = referenceModel();
    paint(1000);
    const base = trueScreen().length;
    const plain = target - base;
    assert.ok(plain > 0 && plain <= 80, `cannot reach ${target} from ${base}`);
    paint(1000, plain);
    const S = trueScreen();
    assert.equal(S.length, target);
    T.nomux_capture_write_input_boundary();
    assert.deepEqual(got.at(-1).cursor, model.capture(S, 1, 0, [0, 0]).cursor, `length ${target}`);
  }
});

test("a new process starts clean; interactive play keeps the whole capture", () => {
  let got = freshGame();
  paint(1100);
  T.nomux_capture_write_input_boundary();
  got = freshGame();
  paint(200);
  T.nomux_capture_write_input_boundary();
  assert.deepEqual(got.at(-1).cursor, [0, 0]);

  got = freshGame({ unbounded: true });
  paint(1100);
  const S = trueScreen();
  T.nomux_capture_write_input_boundary();
  assert.deepEqual(got.at(-1).cursor, [0, 0]);
  assert.equal(got.at(-1).screen, S);
});
