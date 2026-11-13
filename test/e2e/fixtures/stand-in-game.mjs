// A tiny stand-in game driven the way the emitted sys/c2js/nhjs_tty_api.c
// drives the real one (test/e2e/host-driver.test.mjs): session_init sets the
// environment with setenv(), install_files writes the playground with stdio,
// tgetch longjmp()s back to session_run when the input runs out (the rewriter's
// setjmp lowering: a dispatcher loop whose body is in a try), and the host
// supplies only the callbacks nhjs_js_key / nhjs_js_capture /
// nhjs_js_boundary and the data installer nhjs_install_data_files.
import { machine, uchars, i32 } from "../../../js/rt/heap.js";
import { fopen, fclose, fprintf, setvbuf, getenv, malloc, exit } from "../../../js/rt/libc.js";
import { setjmp_caught, longjmp } from "../../../js/rt/setjmp.js";

const libc = (name, ...args) => machine.libc(name, args);
const cstr = (s) => {
  const p = malloc(s.length + 1);
  for (let i = 0; i < s.length; i++) uchars[p + i] = s.charCodeAt(i);
  uchars[p + s.length] = 0;
  return p;
};
const jstr = (p) => {
  let s = "";
  for (let i = 0; p && uchars[p + i]; i++) s += String.fromCharCode(uchars[p + i]);
  return s;
};

// statics (allocated at load: part of the pristine image)
const S = malloc(32); // 0 phase, 1 key index, 2 counter, 3 log FILE *, 4 seq
const JMP = malloc(16);
const get = (k) => i32[(S >> 2) + k];
const put = (k, v) => (i32[(S >> 2) + k] = v);
const LINE = cstr("rn2(%d)=%d\n");
const EXHAUSTED = 1, ENTERED = 2;

export function nhjs_session_init(seedText, datetime, rc, name) {
  libc("unsetenv", cstr("USER"));
  libc("setenv", cstr("NETHACK_RNGLOG"), cstr("/rng.log"), 1);
  libc("setenv", cstr("NETHACK_SEED"), seedText, 1);
  libc("setenv", cstr("PLAYER"), name, 1);
  for (let k = 0; k < 8; k++) put(k, 0);
  void datetime, rc;
}

export function nhjs_install_data() {
  libc("nhjs_install_data_files");
}

export function nhjs_install_files() {
  libc("mkdir", cstr("/save"), 0o777);
  fclose(fopen(cstr("/record"), cstr("ab")));
  const fp = fopen(cstr("/sysconf"), cstr("wb"));
  libc("fwrite", cstr("WIZARDS=*\n"), 1, 10, fp);
  fclose(fp);
}

function tgetch() {
  const ch = libc("nhjs_js_key", get(1));
  if (ch < 0) longjmp(JMP, EXHAUSTED);
  put(1, get(1) + 1);
  return ch & 255;
}

function show(text) {
  libc("nhjs_js_capture", 0, get(4), 0, 0, 1, cstr(text));
  put(4, get(4) + 1);
}

function main() {
  const log = fopen(getenv(cstr("NETHACK_RNGLOG")), cstr("w"));
  setvbuf(log, 0, 1, 0);
  put(3, log);
  put(2, Number(jstr(getenv(cstr("NETHACK_SEED")))) % 100);
  show(`hello ${jstr(getenv(cstr("PLAYER")))} ${get(2)} user=${getenv(cstr("USER"))}`);
  const k = tgetch();
  fprintf(get(3), LINE, 7, k % 7);
  put(0, ENTERED);
  longjmp(JMP, ENTERED); // moveloop() -> nhjs_moveloop_entry
}

function moveloop_core() {
  libc("nhjs_js_boundary", 1);
  show(`c=${get(2)}`);
  const k = tgetch();
  if (k === 0x51) exit(0);
  put(2, get(2) + k);
  fprintf(get(3), LINE, 100, get(2) % 100);
}

export function nhjs_session_run() {
  let $jv = 0;
  for (;;) {
    try {
      const jump = $jv;
      $jv = 0;
      if (jump === EXHAUSTED) return 0;
      if (get(0) === 0) {
        put(0, 1);
        main();
      }
      if (get(0) === ENTERED) {
        libc("nhjs_js_boundary", 0);
        put(0, 3);
      }
      for (;;) moveloop_core();
    } catch ($e) {
      $jv = setjmp_caught($e, JMP);
    }
  }
}

export function dataFiles() {
  return [["/data.txt", "game data\n"]];
}
