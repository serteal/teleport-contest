# Contestant API contract

Your fork must export a single async function from `js/jsmain.js`.
The scoring harness calls it once per game segment, reads what it
returns, and compares against the recorded ground truth.

```js
// js/jsmain.js
export async function runSegment(input, prevGame = null) {
    // ... your code: launch a game, replay the keys, capture frames ...
    return game;
}
```

That's the whole interface. Everything below is mechanics.

## How scoring works, technically

A **session** is one or more **segments** played in sequence. A
session passes when both its PRNG and screen output match the
recorded C reference 100%, end to end.

For each session, scoring runs:

```
game = null
for segment in session.segments:
    game = await runSegment(segment, game)

screens  = game.getScreens()    // collected across all segments
rngLog   = game.getRngLog()     // collected across all segments
cursors  = game.getCursors()    // collected across all segments
```

Then it compares positionally:

| Channel | Compared how |
|---|---|
| **PRNG** | Every entry in `rngLog` is positionally checked against the C trace. Format and ordering are exact. |
| **Screen** | Every entry in `screens` is decoded into a 24×80 cell grid and cell-compared against the recorded C frame. Two encodings that produce the same pixels match. |
| **Cursor** | Tiebreaker only — match if you can. |
| **Animation frames** | **Supplemental, not part of ranking.** If your port calls `await game.animationFrame()` between intermediate display states (zap beams, thrown objects, hurtle steps, runmode-walk travel), each captured frame is positionally checked against C's. Reported on the leaderboard as a separate `Anim%` column. See "Animation frames" below. |

**Partial credit:** your score is the number of steps where the
rendered screen matches C, summed across all sessions. A session
that diverges at step 50 still earns 50 screen points; you don't
need to pass the whole session. Across the public corpus
(44 sessions, 11,284 steps) and the held-out pool (44 sessions,
10,538 steps), your headline metric is the *total fraction of
matched screens*. PRNG matching is reported alongside as advisory
progress — it's the structural prerequisite for screens to match,
but it doesn't earn points on its own. Passing whole sessions
(every screen and every PRNG call matched) is the strict-perfect
tiebreaker.

## `input` — what the harness gives you

```js
{
    seed:      <number>,    // PRNG seed; pass to your initRng()
    datetime:  <string>,    // "YYYYMMDDHHMMSS"; the C side uses this
                            //   for time-of-day, moon phase, hire-date,
                            //   shopkeeper greeting line, etc.
    nethackrc: <string>,    // multi-line OPTIONS=… text. Drives chargen
                            //   (name/role/race/gender/align), pet,
                            //   autopickup, msg_window, symset, …
    moves:     <string>,    // raw key sequence to replay from the very
                            //   first keystroke. Includes startup
                            //   prompts (chargen, lore --More--, …)
                            //   AND in-game keys.
}
```

That's all. **The recorded screens, cursors, and RNG calls are not
passed in** — you can't peek at the answer key. You have to actually
port the game.

## `opts.storage` — cross-segment persistence

Save files, bones, the record/scoreboard file, and any other game
state that must survive across segments of a session — or across a
browser page reload — flow through a single Web-Storage-shaped
object the harness gives you in `input.storage`:

```js
runSegment({ seed, datetime, nethackrc, moves, storage })
```

`storage` exposes `getItem`, `setItem`, `removeItem`, `length`, and
`key`. The judge sandbox creates one Map-backed instance per session
and passes the **same instance** to every segment of that session, so
save state written during segment 1 is readable during segment 2.
The browser at `/play/<owner>/` passes a `localStorage`-backed view
namespaced to `vfs:<owner>:` so save files written from the page
survive a reload (and don't collide with other forks' saves). Both
contexts use the same shape, so a port that honors `opts.storage`
gets correct multi-segment scoring and browser save/restore from one
implementation.

If your port doesn't have save/restore yet, just ignore `storage`;
the field sits unused and your single-segment scoring is unaffected.

## Per-segment isolation

A "session" can be multiple consecutive games (a save/restore, a
chained `#quit`/new-game sequence, a bones-leaving death/new-game
pair). `runSegment` is called once per segment with **only its
segment input**:

```js
for (const segment of session.segments) {
    await runSegment({ ...segment, storage });
}
```

Each call returns a self-contained game. `getScreens()`,
`getRngLog()`, `getCursors()`, and `getAnimationFramesByStep()`
should cover **only that segment** — the harness concatenates them
itself. Persistent C-side state (save file, bones, record) lives in
`storage`; nothing else needs to cross the segment boundary.

## `game` — what you return

Any object with the following methods. Their cumulative output across
all segments of a session is what gets compared.

```js
{
    getScreens():  string[],         // one per input boundary
    getRngLog():   string[],         // every PRNG call in order
    getCursors():  [col, row, vis][],// cursor at each boundary

    // OPTIONAL — supplemental scoring only.
    //
    // Frames are populated automatically when you call
    // `await game.animationFrame()` inside your animation code (see
    // "Animation frames" below).  If you don't call it, every entry
    // is an empty array and your official RNG/screen score is
    // unaffected.
    //
    // Returns one inner array per step (length matches
    // getScreens().length), each holding the frames captured during
    // that step in emission order.  Frames have shape { screen,
    // cursor }, same encoding as a regular boundary capture.
    getAnimationFramesByStep(): { screen: string, cursor: [c,r,v] }[][]
}
```

### `getScreens()`

One string per **input boundary** — that is, every time C's
`tty_nhgetch()` blocks waiting for the next key. The first frame is
the initial state before any key. Each subsequent frame is the
terminal state after consuming one key from `moves`.

A frame is the visible terminal contents. Format isn't tightly
specified — both your output and the recorded ground truth are
canonicalized before comparison (see *Screen comparator* below).
The provided `frozen/terminal.js` has a `serialize()` method that
produces the canonical format directly from a 24×80 grid; the
provided `js/jsmain.js` capture hook calls it for you.

If you implement your own terminal, output anything that — after
canonicalization — matches the recorded screen.

### `getRngLog()`

Every PRNG call your code made, in order, formatted as one of:

```
rn2(N)=M
rnd(N)=M
rn1(N,B)=M
rnl(N)=M
rne(N)=M
rnz(N)=M
d(N,B)=M
```

The provided `frozen/isaac64.js` is the canonical PRNG engine. The
provided `js/rng.js` is a wrapper that produces the right log
format. If you replace `js/rng.js`, your replacement must produce
log entries in the same format.

The log is compared positionally. Your call N must equal C's call N
exactly (after stripping the `@ caller(file:line)` annotation that
C-side recordings carry).

### `getCursors()`

Currently scored as a tiebreaker only — match it if you can; not
required for a session to pass.

### Animation frames — supplemental, optional

NetHack draws **intermediate animation frames** during certain
actions: zap beams travelling across the dungeon, thrown objects in
flight, hurtle steps after a knockback, explosion expansions. The C
recorder captures each of these and stores them inside the canonical
session JSON, nested under the step they fired during:

```json
{
    "key": "z", "rng": [...], "screen": "<final boundary>",
    "animation_frames": [
        { "screen": "<intermediate frame 0>", "cursor": [c,r,v] },
        { "screen": "<intermediate frame 1>", "cursor": [c,r,v] },
        ...
    ]
}
```

If your port reproduces these intermediate frames, just call:

```js
await game.animationFrame();
```

inside whatever you wrote as the equivalent of NetHack's
`nh_delay_output()` (or wherever else you'd flush a mid-animation
frame). That single call:

1. Captures the current `terminal.serialize()` + cursor and stores
   it in the per-step buffer.
2. Yields the event loop, so the browser's paint loop has a chance
   to flush DOM cell updates between frames before the next animation
   step writes over them.

**Same code in every runtime.** Contestant code always writes
`await game.animationFrame()` — there is no `mode` parameter, no
feature detection, no separate code path. Inside the canonical
implementation the yield uses `requestAnimationFrame` when one is
available (so the browser actually paints between frames in
`/play/<owner>/`) and falls back to a microtask yield in Node
(judge sandbox + local `score.sh`), where the Terminal is a pure
data structure and there is no paint loop to wait for. That choice
is invisible to your code.

**Animation frames are scored separately and are not part of the
official ranking.** They contribute a supplemental `Anim%` column on
the leaderboard so contestants who reproduce them get visible
credit, but a session passes or fails purely on RNG + screen match
at input boundaries. Sessions with no animation activity have empty
inner arrays at every step. If you never call `animationFrame()`,
every step's entry is empty and your official score is unaffected.

## What's frozen

Two files in your fork are overlaid from the canonical copy before
every scoring run:

| File | Why frozen |
|---|---|
| `js/isaac64.js` | Canonical PRNG engine. Frozen so every contestant draws from the same number stream the C recorder did, letting per-call results align bit-for-bit. |
| `js/terminal.js` | Canonical 24×80 terminal grid + serialization. Defines what counts as "the screen." |
| `js/storage.js` | Canonical VFS contract for save/restore, bones, and the topten record. Backed by `localStorage` in the browser and by an `InMemoryStorage` mock in the Node sandbox. Frozen so multi-segment sessions (save+restore, bones, chained `#quit`/new-game) have a well-defined isolation: state persists across segments within a session, resets between sessions. |

Plus the scoring infrastructure (not part of your fork; lives only
in the scorer):

| File | Why frozen |
|---|---|
| `frozen/ps_test_runner.mjs` | The scoring runner — same one ships in your fork so you can self-test. |
| `frozen/session_loader.mjs` | Normalizes session JSON to the v5 shape passed to `runSegment`. |

Everything else in `js/` — including `js/jsmain.js`, `js/rng.js`,
`js/display.js`, `js/const.js` — is yours to edit, replace, or
restructure.

## Screen comparator

Both sides are decoded into a 24×80 cell grid (one entry per cell,
holding char + foreground color + attr bits + DEC-graphics flag),
then compared cell-by-cell. Two screens are considered equal when
every cell renders the same pixels, regardless of how the underlying
byte sequence got there:

- **Version banner** lines (`Version X.Y.Z … built …`) are collapsed
  to a sentinel before decoding — the build timestamp varies by C
  build and would otherwise punish contestants for not pinning to a
  moving target.
- **Cursor-forward escapes** (`\x1b[NC`), **SGR (color/attribute)
  state transitions**, and **SI/SO charset shifts** all fall out of
  the decode automatically — they affect cursor/state, not pixel
  output, so encodings that differ but produce the same grid match.
- **DEC line-drawing** glyphs are translated to their Unicode
  equivalents during decode.
- **Invisible attrs on a space** are ignored. Bold or color on a
  glyphless cell produces no pixels, so a `\x1b[1m \x1b[22m` and a
  plain space match. Inverse-video and underline DO matter on a
  space (they paint background / draw a rule), so those count.

See `frozen/screen-decode.mjs` for the decoder and the per-cell
diff used by both the runner (`frozen/ps_test_runner.mjs`) and the
Session Viewer (`tools/session-viewer/`).

## Scoring isolation — the sandbox

Your `runSegment` runs in a Node child process spawned with
`--permission` and a tight `--allow-fs-read` whitelist (just your
fork's tree + the runner script directory). Your process **cannot**:

- write to the filesystem
- open network sockets
- spawn child processes or worker threads
- load native addons
- access anything outside your fork

The recorded ground truth is held in a separate process and never
crosses the IPC boundary into your code. The only thing that crosses
is the `input` object above.

## Local self-test

```bash
# Score one session
node frozen/ps_test_runner.mjs sessions/seed8000-tourist-starter.session.json

# Score everything
bash frozen/score.sh
```

Same comparator, same input shape as the official scoring run. The
only differences:

- Local self-test does not enforce the sandbox (faster iteration;
  debug freely).
- Local self-test only sees the 44 public sessions. The official run
  also scores against 44 held-out sessions you never see.

## Worked example — minimal `runSegment`

```js
// Hypothetical minimal implementation that just plays the keys and
// captures the rendered terminal each time the game asks for input.

import { initRng, enableRngLog, getRngLog } from './rng.js';
import { Terminal } from './terminal.js';

export async function runSegment(input, prevGame = null) {
    const game = prevGame || createFreshGame();

    initRng(input.seed);
    enableRngLog();

    const terminal = new Terminal(null, { rows: 24, cols: 80 });
    game.terminal = terminal;
    game.applyNethackrc(input.nethackrc);
    game.setDatetime(input.datetime);

    // Capture frame BEFORE each key — mirrors when C's tty_nhgetch fires.
    game.onBeforeReadKey = () => {
        game._capturedScreens.push(terminal.serialize());
        game._capturedCursors.push([terminal.cursorCol, terminal.cursorRow, 1]);
    };

    for (const ch of input.moves) {
        game.pushKey(ch.charCodeAt(0));
    }
    await game.run();   // runs until input queue empty

    return {
        getScreens: () => game._capturedScreens,
        getRngLog:  () => getRngLog(),
        getCursors: () => game._capturedCursors,
    };
}
```

The provided skeleton in `js/jsmain.js` is more elaborate (it uses a
`NethackGame` class and a pre-nhgetch hook), but the contract is the
same.

## FAQ

**Can I replace `js/rng.js`?** Yes, but it must use `frozen/isaac64.js`
underneath and produce the same log entry format. If your PRNG values
differ from C's, you fail.

**Can I replace `js/terminal.js`?** No — it's frozen.

**Can I replace `js/storage.js`?** No — it's frozen too. Use its
`vfsReadFile` / `vfsWriteFile` / `vfsDeleteFile` / `vfsListFiles`
API for save files, bones, the topten record, and anything else
that needs to survive a `#quit`/restart or save/restore. State
written via this VFS persists across segments within one session
(both browser and Node sandbox) and resets between sessions —
that's the multi-segment contract the judge depends on.

**Can I replace `js/display.js`?** Yes. It builds your in-game screens.
Just make sure they compare equal (after canonicalization) to C's.

**Can I add new files under `js/`?** Yes. Anything that helps.

**Can I import from outside `js/`?** Only what your fork ships:
`frozen/`, `nethack-c/upstream/` (read-only reference), and node
built-ins. The sandbox blocks anything else.

**Does `runSegment` get a fresh process per call?** Per *session*,
yes. Per *segment* within a session, no — you get the previous
segment's `game` as `prevGame`.

**What if my code throws?** That session is marked errored and the
message is reported. Errors don't break other sessions.

**What if my code runs forever?** Each session has a 900-second
wall-clock limit. After that, the runner kills the process and
records a timeout.
