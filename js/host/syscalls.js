// host/syscalls.js - the system calls of the C library, over host/vfs.js.
//
// The C library linked with the game (musl, as built by Emscripten:
// js/vendor/clib-lua.js) implements stdio, open(), stat(),
// opendir() and friends on top of a small set of imported system calls.
// This module implements that set on a Vfs, with the argument conventions
// and error numbers Emscripten's own implementation has, so the C library
// behaves exactly as under Emscripten's runtime (line buffering of a
// stream, for example, depends on whether ioctl(TIOCGWINSZ) succeeds).
//
//   createSyscalls(vfs, mem) -> { __syscall_openat, ..., fd_read, fd_write, ... }
//
// `mem` gives the current heap views (they change when memory grows):
// an object with HEAP8, HEAPU8, HEAP16, HEAP32, HEAPU32 properties, such as
// the instance returned by createClib().  __syscall_* return 0 or -errno;
// fd_* (WASI) return 0 or errno.

import { E, FsError, O, isChrdev, isDir, isLink } from "./vfs.js";
import { utf8ToString, stringToUtf8, utf8Length } from "./utf8.js";

const AT_FDCWD = -100;
const AT_SYMLINK_NOFOLLOW = 256;
const AT_REMOVEDIR = 512;
const AT_EMPTY_PATH = 4096;
const DIRENT_SIZE = 280;

/**
 * The system calls on a Vfs (or on the Vfs a getter returns); `mem` supplies the heap views.
 * options: uid/gid (default 0, Emscripten's).
 */
export function createSyscalls(vfsOrGetter, mem, options = {}) {
  // a Vfs, or a function returning the current one (a machine that runs several games)
  const vfs = typeof vfsOrGetter === "function" ? vfsOrGetter : () => vfsOrGetter;
  const uid = options.uid ?? 0;
  const gid = options.gid ?? 0;
  const ctx = { vfs, mem, str: (p) => utf8ToString(mem.HEAPU8, p), varargs: new Varargs(mem) };
  return {
    ...pathCalls(ctx),
    ...descriptorCalls(ctx),
    ...wasiCalls(ctx),
    __syscall_getuid32: () => uid,
    __syscall_geteuid32: () => uid,
    __syscall_getgid32: () => gid,
    __syscall_getegid32: () => gid,
  };
}

// ---- helpers ------------------------------------------------------------------------------

// the variadic arguments of fcntl/ioctl/openat: 32-bit words from `va` on
class Varargs {
  constructor(mem) {
    this.mem = mem;
    this.p = 0;
  }
  start(va) {
    this.p = va;
  }
  next() {
    const v = this.mem.HEAP32[this.p >> 2];
    this.p += 4;
    return v;
  }
}

// run f; FsError -> -errno (__syscall_*) or errno (WASI fd_*)
const posix = (f) =>
  function (...args) {
    try {
      return f(...args);
    } catch (e) {
      if (e instanceof FsError) return -e.errno;
      throw e;
    }
  };
const wasi = (f) =>
  function (...args) {
    try {
      return f(...args);
    } catch (e) {
      if (e instanceof FsError) return e.errno;
      throw e;
    }
  };

function storeI64(H32, p, v) {
  H32[p >> 2] = v >>> 0;
  H32[(p >> 2) + 1] = v >= 0 ? Math.floor(v / 4294967296) >>> 0 : ~~Math.ceil((v - (~~v >>> 0)) / 4294967296) >>> 0;
}

function i53(lo, hi) {
  return (hi + 0x200000) >>> 0 < 0x400001 - !!lo ? (lo >>> 0) + hi * 4294967296 : NaN;
}

// a path relative to a directory descriptor (the *at calls)
function atPath(ctx, dirfd, path, allowEmpty = false) {
  if (path.startsWith("/")) return path;
  const dir = dirfd === AT_FDCWD ? ctx.vfs().cwd() : ctx.vfs().getStream(dirfd).path;
  if (path.length === 0) {
    if (!allowEmpty) throw new FsError(E.ENOENT);
    return dir;
  }
  return dir + "/" + path;
}

// struct stat (wasm32 musl layout)
function writeStat(mem, buf, st) {
  const U32 = mem.HEAPU32;
  const H32 = mem.HEAP32;
  U32[buf >> 2] = st.dev;
  U32[(buf + 4) >> 2] = st.mode;
  U32[(buf + 8) >> 2] = st.nlink;
  U32[(buf + 12) >> 2] = st.uid;
  U32[(buf + 16) >> 2] = st.gid;
  U32[(buf + 20) >> 2] = st.rdev;
  storeI64(H32, buf + 24, st.size);
  H32[(buf + 32) >> 2] = 4096;
  H32[(buf + 36) >> 2] = st.blocks;
  const times = [st.atime, st.mtime, st.ctime];
  for (let k = 0; k < 3; k++) {
    storeI64(H32, buf + 40 + 16 * k, Math.floor(times[k] / 1000));
    U32[(buf + 48 + 16 * k) >> 2] = (times[k] % 1000) * 1000 * 1000;
  }
  storeI64(H32, buf + 88, st.ino);
  return 0;
}

// ---- calls on paths: stat, directories, rename, unlink, access, umask -----------------------

function pathCalls(ctx) {
  const { vfs, mem, str } = ctx;
  const at = (dirfd, path, allowEmpty) => atPath(ctx, dirfd, path, allowEmpty);
  return {
    __syscall_chdir: posix((path) => {
      vfs().chdir(str(path));
      return 0;
    }),
    __syscall_chmod: posix((path, mode) => {
      vfs().chmod(str(path), mode);
      return 0;
    }),
    __syscall_faccessat: posix((dirfd, path, amode) => {
      path = at(dirfd, str(path));
      if (amode & ~7) return -E.EINVAL;
      const node = vfs().lookupPath(path, { follow: true }).node;
      if (!node) return -E.ENOENT;
      let perms = "";
      if (amode & 4) perms += "r";
      if (amode & 2) perms += "w";
      if (amode & 1) perms += "x";
      if (perms && vfs()._perm(node, perms)) return -E.EACCES;
      return 0;
    }),
    __syscall_stat64: posix((path, buf) => writeStat(mem, buf, vfs().stat(str(path)))),
    __syscall_lstat64: posix((path, buf) => writeStat(mem, buf, vfs().lstat(str(path)))),
    __syscall_newfstatat: posix((dirfd, path, buf, flags) => {
      const nofollow = flags & AT_SYMLINK_NOFOLLOW;
      const p = at(dirfd, str(path), flags & AT_EMPTY_PATH);
      return writeStat(mem, buf, nofollow ? vfs().lstat(p) : vfs().stat(p));
    }),
    __syscall_getcwd: posix((buf, size) => {
      if (!size) return -E.EINVAL;
      const cwd = vfs().cwd();
      const n = utf8Length(cwd) + 1;
      if (size < n) return -E.ERANGE;
      stringToUtf8(cwd, mem.HEAPU8, buf, size);
      return n;
    }),
    __syscall_mkdirat: posix((dirfd, path, mode) => {
      vfs().mkdir(at(dirfd, str(path)), mode & ~vfs().umask);
      return 0;
    }),
    __syscall_renameat: posix((olddirfd, oldpath, newdirfd, newpath) => {
      const a = at(olddirfd, str(oldpath));
      const b = at(newdirfd, str(newpath));
      vfs().rename(a, b);
      return 0;
    }),
    __syscall_rmdir: posix((path) => {
      vfs().rmdir(str(path));
      return 0;
    }),
    __syscall_umask: (mask) => {
      const old = vfs().umask;
      vfs().umask = mask;
      return old;
    },
    __syscall_unlinkat: posix((dirfd, path, flags) => {
      const p = at(dirfd, str(path));
      if (!flags) vfs().unlink(p);
      else if (flags === AT_REMOVEDIR) vfs().rmdir(p);
      else return -E.EINVAL;
      return 0;
    }),
  };
}

// ---- calls on descriptors: open, dup, fcntl, ioctl, fstat, getdents -------------------------

function descriptorCalls(ctx) {
  const { vfs, mem, str, varargs } = ctx;
  return {
    __syscall_openat: posix((dirfd, path, flags, va) => {
      varargs.start(va);
      const p = atPath(ctx, dirfd, str(path));
      let mode = va ? varargs.next() : 0;
      if (flags & O.CREAT) mode &= ~vfs().umask;
      return vfs().open(p, flags, mode).fd;
    }),
    __syscall_dup: posix((fd) => vfs().dupStream(vfs().getStream(fd)).fd),
    __syscall_dup3: posix((fd, newfd, flags) => {
      if (fd === newfd) return -E.EINVAL;
      if (flags & ~524288) return -E.EINVAL;
      const old = vfs().getStream(fd);
      if (newfd < 0 || newfd >= 4096) return -E.EBADF;
      const existing = vfs().streams[newfd];
      if (existing) vfs().close(existing);
      const stream = vfs().dupStream(old, newfd);
      if (flags & 524288) stream.flags |= 524288;
      return stream.fd;
    }),
    __syscall_fcntl64: posix((fd, cmd, va) => fcntl(ctx, fd, cmd, va)),
    __syscall_ioctl: posix((fd, op, va) => ioctl(ctx, fd, op, va)),
    __syscall_fstat64: posix((fd, buf) => writeStat(mem, buf, vfs().fstat(fd))),
    __syscall_getdents64: posix((fd, dirp, count) => getdents(ctx, fd, dirp, count)),
  };
}

function fcntl({ vfs, mem, varargs }, fd, cmd, va) {
  varargs.start(va);
  const stream = vfs().getStream(fd);
  switch (cmd) {
    case 0: {
      // F_DUPFD
      let arg = varargs.next();
      if (arg < 0) return -E.EINVAL;
      while (vfs().streams[arg]) arg++;
      return vfs().dupStream(stream, arg).fd;
    }
    case 1:
    case 2:
      return 0;
    case 3:
      return stream.flags;
    case 4: {
      // F_SETFL
      const arg = varargs.next();
      const mask = 289792;
      vfs()._streamsChange();
      stream.flags = (stream.flags & ~mask) | (arg & mask);
      return 0;
    }
    case 12: {
      // F_GETLK
      const arg = varargs.next();
      mem.HEAP16[arg >> 1] = 2; // F_UNLCK: never locked
      return 0;
    }
    case 13:
    case 14:
      return 0;
  }
  return -E.EINVAL;
}

// termios of /dev/tty as Emscripten reports it
const TTY_CC = [0x03, 0x1c, 0x7f, 0x15, 0x04, 0x00, 0x01, 0x00, 0x11, 0x13, 0x1a, 0x00, 0x12, 0x0f, 0x17, 0x16];

function ioctl({ vfs, mem, varargs }, fd, op, va) {
  varargs.start(va);
  const stream = vfs().getStream(fd);
  const tty = stream.tty;
  switch (op) {
    case 21509: // TCFLSH...
    case 21510:
    case 21511:
    case 21512:
    case 21524:
    case 21515:
      return tty ? 0 : -E.ENOTTY;
    case 21505: {
      // TCGETS
      if (!tty) return -E.ENOTTY;
      if (tty.termios) {
        const argp = varargs.next();
        const H32 = mem.HEAP32;
        H32[argp >> 2] = 25856;
        H32[(argp + 4) >> 2] = 5;
        H32[(argp + 8) >> 2] = 191;
        H32[(argp + 12) >> 2] = 35387;
        for (let i = 0; i < 32; i++) mem.HEAP8[argp + 17 + i] = TTY_CC[i] || 0;
      }
      return 0;
    }
    case 21506: // TCSETS*
    case 21507:
    case 21508:
      return tty ? 0 : -E.ENOTTY;
    case 21519: {
      // TIOCGPGRP
      if (!tty) return -E.ENOTTY;
      mem.HEAP32[varargs.next() >> 2] = 0;
      return 0;
    }
    case 21520:
      return tty ? -E.EINVAL : -E.ENOTTY;
    case 21537:
    case 21531:
      varargs.next();
      return -E.ENOTTY;
    case 21523: {
      // TIOCGWINSZ
      if (!tty) return -E.ENOTTY;
      if (tty.termios) {
        const argp = varargs.next();
        mem.HEAP16[argp >> 1] = 24;
        mem.HEAP16[(argp + 2) >> 1] = 80;
      }
      return 0;
    }
    default:
      return -E.EINVAL;
  }
}

// struct dirent records of a directory stream, DIRENT_SIZE bytes each, from its position on
function getdents({ vfs, mem }, fd, dirp, count) {
  const stream = vfs().getStream(fd);
  stream.getdents ||= vfs().readdir(stream.path);
  let pos = 0;
  const off = vfs().llseek(stream, 0, 1);
  const startIdx = Math.floor(off / DIRENT_SIZE);
  const endIdx = Math.min(stream.getdents.length, startIdx + Math.floor(count / DIRENT_SIZE));
  let idx;
  for (idx = startIdx; idx < endIdx; idx++) {
    let id, type;
    const name = stream.getdents[idx];
    if (name === ".") {
      id = stream.node.id;
      type = 4;
    } else if (name === "..") {
      id = vfs().lookupPath(stream.path, { parent: true }).node.id;
      type = 4;
    } else {
      const child = vfs()._lookupNode(stream.node, name);
      id = child.id;
      type = isChrdev(child.mode) ? 2 : isDir(child.mode) ? 4 : isLink(child.mode) ? 10 : 8;
    }
    storeI64(mem.HEAP32, dirp + pos, id);
    storeI64(mem.HEAP32, dirp + pos + 8, (idx + 1) * DIRENT_SIZE);
    mem.HEAP16[(dirp + pos + 16) >> 1] = DIRENT_SIZE;
    mem.HEAP8[dirp + pos + 18] = type;
    stringToUtf8(name, mem.HEAPU8, dirp + pos + 19, 256);
    pos += DIRENT_SIZE;
  }
  vfs().llseek(stream, idx * DIRENT_SIZE, 0);
  return pos;
}

// ---- WASI fd_* calls: read, write, seek, close ----------------------------------------------

function wasiCalls(ctx) {
  const { vfs, mem } = ctx;
  return {
    fd_close: wasi((fd) => {
      vfs().close(vfs().getStream(fd));
      return 0;
    }),
    fd_read: wasi((fd, iov, iovcnt, pnum) => {
      const n = readv(ctx, vfs().getStream(fd), iov, iovcnt);
      mem.HEAPU32[pnum >> 2] = n;
      return 0;
    }),
    fd_write: wasi((fd, iov, iovcnt, pnum) => {
      const n = writev(ctx, vfs().getStream(fd), iov, iovcnt);
      mem.HEAPU32[pnum >> 2] = n;
      return 0;
    }),
    fd_seek: wasi((fd, lo, hi, whence, pnew) => {
      const offset = i53(lo, hi);
      if (Number.isNaN(offset)) return 61;
      const stream = vfs().getStream(fd);
      vfs().llseek(stream, offset, whence);
      storeI64(mem.HEAP32, pnew, stream.position);
      if (stream.getdents && !offset && whence === 0) stream.getdents = null;
      return 0;
    }),
    fd_fdstat_get: wasi((fd, p) => {
      const stream = vfs().getStream(fd);
      const mode = stream.node.mode;
      const type = stream.tty ? 2 : isDir(mode) ? 3 : isLink(mode) ? 7 : 4;
      mem.HEAPU8.fill(0, p, p + 24);
      mem.HEAP8[p] = type;
      return 0;
    }),
  };
}

function readv({ vfs, mem }, stream, iov, iovcnt) {
  let ret = 0;
  for (let i = 0; i < iovcnt; i++) {
    const ptr = mem.HEAPU32[iov >> 2];
    const len = mem.HEAPU32[(iov + 4) >> 2];
    iov += 8;
    let cur;
    try {
      cur = vfs().read(stream, mem.HEAP8, ptr, len);
    } catch (e) {
      if (ret > 0 && e instanceof FsError && e.errno === E.EAGAIN) break;
      throw e;
    }
    ret += cur;
    if (cur < len) break;
  }
  return ret;
}

function writev({ vfs, mem }, stream, iov, iovcnt) {
  if (iovcnt === 1) return vfs().write(stream, mem.HEAP8, mem.HEAPU32[iov >> 2], mem.HEAPU32[(iov + 4) >> 2]);
  let total = 0;
  for (let i = 0, p = iov; i < iovcnt; i++, p += 8) total += mem.HEAPU32[(p + 4) >> 2];
  const view = new Uint8Array(total);
  let off = 0;
  for (let i = 0; i < iovcnt; i++, iov += 8) {
    const ptr = mem.HEAPU32[iov >> 2];
    const len = mem.HEAPU32[(iov + 4) >> 2];
    view.set(mem.HEAPU8.subarray(ptr, ptr + len), off);
    off += len;
  }
  return vfs().write(stream, view, 0, total);
}
