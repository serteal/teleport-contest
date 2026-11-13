// A sequence of C library calls exercising the file system the way NetHack
// uses it (stdio on files, open/creat/read/write/lseek, unlink of open
// files, rename, directories, access/stat, umask, buffering).  Run against a
// C library + file system through an adapter; the transcript (return
// values, errno, bytes) is compared between implementations:
//   - test/host/host.test.mjs: js/vendor residue over js/host/vfs.js
//   - libc-transcript.json: the expected transcript (Emscripten's file-system semantics)
//
// adapter: { call(name, ...args) -> number, cstr(s) -> address (scratch), buf(n) -> address,
//            bytes(p, n) -> number[], i32(p), errno(), va(...ints) -> address }

const O_RDONLY = 0, O_WRONLY = 1, O_RDWR = 2, O_CREAT = 64, O_EXCL = 128, O_TRUNC = 512, O_APPEND = 1024;
const SEEK_SET = 0, SEEK_CUR = 1, SEEK_END = 2;
const F_OK = 0, W_OK = 2, R_OK = 4;
const _IOLBF = 1;

export function runScenario(a) {
  const out = [];
  const log = (what, v) => out.push([what, v]);
  const err = (what, r) => log(what, r < 0 || r === 0 ? [r, a.errno()] : [r]);
  const s = (x) => a.cstr(x);
  const ST = a.buf(128);
  const statSize = (p) => {
    const r = a.call("stat", s(p), ST);
    return r ? [r, a.errno()] : [a.i32(ST + 24), a.i32(ST + 4).toString(8)];
  };

  err("mkdir /save", a.call("mkdir", s("/save"), 0o777));
  err("mkdir /save again", a.call("mkdir", s("/save"), 0o777));
  err("umask", a.call("umask", 0o022));
  let f = a.call("fopen", s("/save/a"), s("w"));
  log("fopen w", f !== 0);
  log("fputs", a.call("fputs", s("hello\nworld\n"), f));
  log("fwrite", a.call("fwrite", s("ABCDEFGH"), 1, 8, f));
  log("ftell", a.call("ftell", f));
  log("size before flush", statSize("/save/a"));
  log("fflush", a.call("fflush", f));
  log("size after flush", statSize("/save/a"));
  log("fclose", a.call("fclose", f));

  f = a.call("fopen", s("/save/a"), s("r"));
  const B = a.buf(64);
  log("fgets", a.call("fgets", B, 64, f) === B ? a.bytes(B, 6) : null);
  log("fgets2", a.call("fgets", B, 4, f) === B ? a.bytes(B, 4) : null);
  log("fseek", a.call("fseek", f, 2, SEEK_SET));
  log("fgetc", a.call("fgetc", f));
  log("ftell", a.call("ftell", f));
  log("fseek end", a.call("fseek", f, 0, SEEK_END));
  log("ftell end", a.call("ftell", f));
  log("fgetc eof", a.call("fgetc", f));
  log("feof", a.call("feof", f) !== 0);
  log("fread", a.call("fread", B, 1, 10, f));
  log("clearerr/feof", (a.call("clearerr", f), a.call("feof", f)));
  log("rewind/fgetc", (a.call("rewind", f), a.call("fgetc", f)));
  log("fclose", a.call("fclose", f));

  f = a.call("fopen", s("/save/a"), s("a"));
  log("fputs append", a.call("fputs", s("tail"), f));
  log("fclose", a.call("fclose", f));
  log("size appended", statSize("/save/a"));

  f = a.call("fopen", s("/save/a"), s("r+"));
  log("fseek r+", a.call("fseek", f, 1, SEEK_SET));
  log("fputc r+", a.call("fputc", 0x45, f));
  log("fclose", a.call("fclose", f));
  f = a.call("fopen", s("/save/a"), s("r"));
  log("read back r+", (a.call("fread", B, 1, 30, f), a.bytes(B, 30)));
  log("fclose", a.call("fclose", f));

  let fd = a.call("open", s("/save/b"), O_CREAT | O_EXCL | O_WRONLY, a.va(0o644));
  log("open excl", fd >= 0 ? fd : [fd, a.errno()]);
  err("open excl again", a.call("open", s("/save/b"), O_CREAT | O_EXCL | O_WRONLY, a.va(0o644)));
  log("write", a.call("write", fd, s("0123456789"), 10));
  log("lseek cur", a.call("lseek", fd, 0, SEEK_CUR));
  log("lseek set beyond", a.call("lseek", fd, 20, SEEK_SET));
  log("write beyond", a.call("write", fd, s("xy"), 2));
  log("close", a.call("close", fd));
  log("size b", statSize("/save/b"));
  fd = a.call("open", s("/save/b"), O_RDONLY, 0);
  log("read b", (a.call("read", fd, B, 30), a.bytes(B, 22)));
  err("write rdonly", a.call("write", fd, s("q"), 1));
  log("close", a.call("close", fd));
  fd = a.call("creat", s("/save/c"), 0o600);
  log("creat", fd >= 0);
  log("write c", a.call("write", fd, s("lock"), 4));
  log("close", a.call("close", fd));
  log("size c", statSize("/save/c"));
  fd = a.call("open", s("/save/b"), O_WRONLY | O_TRUNC, 0);
  log("trunc", a.call("close", fd));
  log("size b trunc", statSize("/save/b"));
  fd = a.call("open", s("/save/b"), O_WRONLY | O_APPEND, 0);
  log("append write", (a.call("write", fd, s("ab"), 2), a.call("lseek", fd, 0, SEEK_SET), a.call("write", fd, s("cd"), 2)));
  log("close", a.call("close", fd));
  log("size b append", statSize("/save/b"));

  // unlink while open: the open stream keeps the data
  f = a.call("fopen", s("/save/a"), s("r"));
  err("unlink open", a.call("unlink", s("/save/a")));
  log("read unlinked", (a.call("fread", B, 1, 5, f), a.bytes(B, 5)));
  log("fclose", a.call("fclose", f));
  err("access unlinked", a.call("access", s("/save/a"), F_OK));
  err("unlink again", a.call("unlink", s("/save/a")));

  err("rename c->d", a.call("rename", s("/save/c"), s("/save/d")));
  err("rename b->d (replace)", a.call("rename", s("/save/b"), s("/save/d")));
  log("size d", statSize("/save/d"));
  err("access d rw", a.call("access", s("/save/d"), R_OK | W_OK));
  err("chmod 0", a.call("chmod", s("/save/d"), 0));
  err("access d w", a.call("access", s("/save/d"), W_OK));
  log("fopen 0-mode for read", a.call("fopen", s("/save/d"), s("r")) !== 0 ? "opened" : a.errno());
  err("chmod 644", a.call("chmod", s("/save/d"), 0o644));
  err("mkdir sub", a.call("mkdir", s("/save/sub"), 0o755));
  f = a.call("fopen", s("/save/sub/x"), s("w"));
  log("fclose", a.call("fclose", f));
  err("unlink dir", a.call("unlink", s("/save/sub")));
  err("rename dir onto file", a.call("rename", s("/save/sub"), s("/save/d")));
  err("stat missing", a.call("stat", s("/save/nope"), ST));
  err("stat through file", a.call("stat", s("/save/d/x"), ST));
  log("fopen missing dir", a.call("fopen", s("/nodir/x"), s("w")) === 0 ? a.errno() : "opened");
  log("fopen dir for write", a.call("fopen", s("/save"), s("w")) === 0 ? a.errno() : "opened");
  log("fopen missing for read", a.call("fopen", s("/save/nope"), s("r")) === 0 ? a.errno() : "opened");

  // directory listing
  const dir = a.call("opendir", s("/save"));
  const names = [];
  for (let e; (e = a.call("readdir", dir)); ) {
    let n = "";
    for (let k = 19; ; k++) {
      const c = a.bytes(e + k, 1)[0];
      if (!c) break;
      n += String.fromCharCode(c);
    }
    names.push(n);
  }
  log("readdir", names);
  log("closedir", a.call("closedir", dir));

  // cwd
  const CW = a.buf(256);
  log("getcwd", a.call("getcwd", CW, 256) === CW ? a.bytes(CW, 2) : null);
  err("chdir", a.call("chdir", s("/save")));
  f = a.call("fopen", s("d"), s("r"));
  log("relative fopen", f !== 0);
  if (f) a.call("fclose", f);
  log("getcwd2", a.call("getcwd", CW, 256) === CW ? a.bytes(CW, 6) : null);
  err("chdir file", a.call("chdir", s("/save/d")));
  err("chdir back", a.call("chdir", s("/")));

  // buffering: a line-buffered stream (the RNG log) reaches the file at each newline
  f = a.call("fopen", s("/save/log"), s("w"));
  log("setvbuf", a.call("setvbuf", f, 0, _IOLBF, 0));
  a.call("fputs", s("partial"), f);
  log("lbf before newline", statSize("/save/log"));
  a.call("fputs", s(" line\nnext"), f);
  log("lbf after newline", statSize("/save/log"));
  log("fclose", a.call("fclose", f));
  log("lbf after close", statSize("/save/log"));
  // a fully buffered stream (no setvbuf) does not
  f = a.call("fopen", s("/save/full"), s("w"));
  a.call("fputs", s("a line\n"), f);
  log("fbf after newline", statSize("/save/full"));
  log("fclose", a.call("fclose", f));

  // fdopen (NetHack's buffered save-file writer)
  fd = a.call("open", s("/save/fd"), O_CREAT | O_WRONLY | O_TRUNC, a.va(0o644));
  f = a.call("fdopen", fd, s("w"));
  log("fdopen", f !== 0);
  log("fwrite fdopen", a.call("fwrite", s("12345678"), 4, 2, f));
  log("fclose fdopen", a.call("fclose", f));
  log("size fd", statSize("/save/fd"));
  return out;
}
