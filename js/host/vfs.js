// host/vfs.js - the in-memory file system the game runs on.
//
// NetHack reads its data files, writes save files, bones, the record,
// the lock file and the RNG log through C stdio and POSIX calls.  Here
// those calls land on this file system (through host/syscalls.js).  Its
// behaviour is that of Emscripten's MEMFS under Emscripten's FS layer,
// the file system the vendored C library (built with Emscripten) expects:
//
//   - files, directories, symbolic links and the character devices
//     /dev/null, /dev/tty, /dev/tty1, /dev/random, /dev/urandom;
//   - fd 0, 1, 2 open on /dev/stdin, /dev/stdout, /dev/stderr;
//   - permission bits checked as Emscripten does (any of user/group/other);
//   - unlink and rename of open files (the open stream keeps the node);
//   - directory listings in the order Emscripten lists them (".", "..",
//     then the property order of a JS object: integer-like names first).
//
// Cheap rewind for interactive play: mark() starts a journal, rollback()
// puts every file, directory, open stream and counter back as it was at
// mark().  Appending to a file (the RNG log) records only its old length.
//
// Times come from the `now` option (milliseconds; default a fixed 0), so
// runs are reproducible.  No timestamp is visible to the game.

const S_IFMT = 0o170000;
const S_IFREG = 0o100000;
const S_IFDIR = 0o040000;
const S_IFCHR = 0o020000;
const S_IFLNK = 0o120000;

// errno values of the C library the game is linked with (Emscripten/WASI)
export const E = Object.freeze({
  E2BIG: 1,
  EACCES: 2,
  EAGAIN: 6,
  EBADF: 8,
  EBUSY: 10,
  EEXIST: 20,
  EINVAL: 28,
  EIO: 29,
  EISDIR: 31,
  ELOOP: 32,
  EMFILE: 33,
  ENODEV: 43,
  ENOEXEC: 45,
  ENOENT: 44,
  ENOSYS: 52,
  ENOTSUP: 58,
  ENOTDIR: 54,
  ENOTEMPTY: 55,
  ENOTTY: 59,
  ENXIO: 60,
  EPERM: 63,
  ERANGE: 68,
  ESPIPE: 70,
  EXDEV: 75,
});

// open() flags (musl, Emscripten)
export const O = Object.freeze({
  RDONLY: 0,
  WRONLY: 1,
  RDWR: 2,
  ACCMODE: 2097155,
  CREAT: 64,
  EXCL: 128,
  TRUNC: 512,
  APPEND: 1024,
  DIRECTORY: 65536,
  NOFOLLOW: 131072,
});

const MAX_OPEN_FDS = 4096;
const SYMLOOP_MAX = 40;

/** A failed file-system operation: `errno` is the C error number. */
export class FsError extends Error {
  constructor(errno) {
    super(`file system error ${errno}`);
    this.name = "FsError";
    this.errno = errno;
  }
}

const isFile = (mode) => (mode & S_IFMT) === S_IFREG;
const isDir = (mode) => (mode & S_IFMT) === S_IFDIR;
const isLink = (mode) => (mode & S_IFMT) === S_IFLNK;
const isChrdev = (mode) => (mode & S_IFMT) === S_IFCHR;
export { isFile, isDir, isLink, isChrdev };

function dirname(path) {
  const i = path.lastIndexOf("/");
  if (i < 0) return ".";
  if (i === 0) return "/";
  return path.slice(0, i);
}

function basename(path) {
  if (path === "/") return "/";
  const p = path.replace(/\/+$/, "");
  return p.slice(p.lastIndexOf("/") + 1);
}

// normalise "a/./b/../c" like Emscripten's PATH.normalize
function normalize(path) {
  const abs = path.startsWith("/");
  const parts = [];
  for (const p of path.split("/")) {
    if (!p || p === ".") continue;
    if (p === "..") {
      if (parts.length && parts[parts.length - 1] !== "..") parts.pop();
      else if (!abs) parts.push("..");
    } else parts.push(p);
  }
  let out = parts.join("/");
  if (!out && !abs) out = ".";
  if (out && path.endsWith("/")) out += "/";
  return (abs ? "/" : "") + out;
}

function join2(a, b) {
  return normalize(a + "/" + b);
}

// a stream: dup'ed descriptors share `shared` (flags and position)
class Stream {
  constructor(fields) {
    this.shared = { flags: fields.flags, position: fields.position ?? 0 };
    this.node = fields.node;
    this.path = fields.path;
    this.seekable = fields.seekable ?? true;
    this.tty = fields.tty ?? null;
    this.fd = -1;
    this.getdents = null;
  }
  get flags() {
    return this.shared.flags;
  }
  set flags(v) {
    this.shared.flags = v;
  }
  get position() {
    return this.shared.position;
  }
  set position(v) {
    this.shared.position = v;
  }
  clone() {
    const s = Object.create(Stream.prototype);
    s.shared = this.shared;
    s.node = this.node;
    s.path = this.path;
    s.seekable = this.seekable;
    s.tty = this.tty;
    s.fd = -1;
    s.getdents = null;
    return s;
  }
}

const EMPTY = new Uint8Array(0);

export class Vfs {
  /**
   * options:
   *   now()      clock for file times, ms (default: always 0)
   *   stdout(bytes), stderr(bytes)   output of /dev/tty, /dev/tty1 (default: dropped)
   *   stdin()    next input byte of /dev/tty, or null at end (default: end)
   *   random()   next byte of /dev/random, /dev/urandom (default: a fixed sequence)
   */
  constructor(options = {}) {
    this.now = options.now ?? (() => 0);
    this.out = { tty: options.stdout ?? null, tty1: options.stderr ?? null };
    this.stdin = options.stdin ?? (() => null);
    let seed = 0x2545f491;
    this.random =
      options.random ??
      (() => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return seed & 255;
      });
    this.nextInode = 1;
    this.streams = [];
    this.cwdPath = "/";
    this.umask = 0o022;
    this.ignorePermissions = true;
    this.devices = new Map();
    this.journal = null;
    this.root = this._newNode(null, "/", S_IFDIR | 0o777, 0);
    this._staticInit();
    this.ignorePermissions = false;
  }

  // ---- nodes ----------------------------------------------------------------------------

  _newNode(parent, name, mode, rdev) {
    const node = {
      id: this.nextInode++,
      name,
      parent: null,
      mode,
      rdev: rdev ?? 0,
      contents: null,
      usedBytes: 0,
      link: null,
      atime: 0,
      mtime: 0,
      ctime: 0,
    };
    node.parent = parent || node;
    if (isDir(mode)) node.contents = Object.create(null);
    else if (isFile(mode)) node.contents = EMPTY;
    node.atime = node.mtime = node.ctime = this.now();
    if (parent) {
      this._dirChange(parent);
      parent.contents[name] = node;
      parent.atime = parent.mtime = parent.ctime = node.atime;
    }
    return node;
  }

  _isRoot(node) {
    return node === node.parent;
  }

  getPath(node) {
    let path = "";
    while (!this._isRoot(node)) {
      path = path ? `${node.name}/${path}` : node.name;
      node = node.parent;
    }
    return "/" + path;
  }

  _perm(node, perms) {
    if (this.ignorePermissions) return 0;
    if (perms.includes("r") && !(node.mode & 0o444)) return E.EACCES;
    if (perms.includes("w") && !(node.mode & 0o222)) return E.EACCES;
    if (perms.includes("x") && !(node.mode & 0o111)) return E.EACCES;
    return 0;
  }

  _lookupNode(parent, name) {
    if (!isDir(parent.mode)) throw new FsError(E.ENOTDIR);
    const err = this._perm(parent, "x");
    if (err) throw new FsError(err);
    const node = parent.contents[name];
    if (!node) throw new FsError(E.ENOENT);
    return node;
  }

  /** Resolve path; opts: parent (stop before the last part), follow (follow a final link),
   *  noentOkay (a missing last part gives {path} with no node). */
  lookupPath(path, opts = {}) {
    if (!path) throw new FsError(E.ENOENT);
    if (!path.startsWith("/")) path = this.cwdPath + "/" + path;
    for (let nlinks = 0; nlinks < SYMLOOP_MAX; nlinks++) {
      const parts = path.split("/").filter(Boolean);
      let current = this.root;
      let currentPath = "/";
      let restart = false;
      for (let i = 0; i < parts.length; i++) {
        const last = i === parts.length - 1;
        if (last && opts.parent) break;
        if (parts[i] === ".") continue;
        if (parts[i] === "..") {
          currentPath = dirname(currentPath);
          if (this._isRoot(current)) {
            path = currentPath + "/" + parts.slice(i + 1).join("/");
            nlinks--;
            restart = true;
            break;
          }
          current = current.parent;
          continue;
        }
        currentPath = join2(currentPath, parts[i]);
        try {
          current = this._lookupNode(current, parts[i]);
        } catch (e) {
          if (e.errno === E.ENOENT && last && opts.noentOkay) return { path: currentPath, node: null };
          throw e;
        }
        if (isLink(current.mode) && (!last || opts.follow)) {
          let link = current.link;
          if (!link.startsWith("/")) link = dirname(currentPath) + "/" + link;
          path = link + "/" + parts.slice(i + 1).join("/");
          restart = true;
          break;
        }
      }
      if (!restart) return { path: currentPath, node: current };
    }
    throw new FsError(E.ELOOP);
  }

  _mayCreate(dir, name) {
    if (!isDir(dir.mode)) return E.ENOTDIR;
    try {
      this._lookupNode(dir, name);
      return E.EEXIST;
    } catch {
      // not there: fine
    }
    return this._perm(dir, "wx");
  }

  _mayDelete(dir, name, wantDir) {
    let node;
    try {
      node = this._lookupNode(dir, name);
    } catch (e) {
      return e.errno;
    }
    const err = this._perm(dir, "wx");
    if (err) return err;
    if (wantDir) {
      if (!isDir(node.mode)) return E.ENOTDIR;
      if (this._isRoot(node) || this.getPath(node) === this.cwdPath) return E.EBUSY;
    } else if (isDir(node.mode)) return E.EISDIR;
    return 0;
  }

  mknod(path, mode, dev) {
    const parent = this.lookupPath(path, { parent: true }).node;
    const name = basename(path);
    if (!name) throw new FsError(E.EINVAL);
    if (name === "." || name === "..") throw new FsError(E.EEXIST);
    const err = this._mayCreate(parent, name);
    if (err) throw new FsError(err);
    if (!isDir(parent.mode)) throw new FsError(E.EPERM);
    return this._newNode(parent, name, mode, dev);
  }

  create(path, mode = 0o666) {
    return this.mknod(path, (mode & 0o7777) | S_IFREG, 0);
  }

  mkdir(path, mode = 0o777) {
    return this.mknod(path, (mode & 0o1777) | S_IFDIR, 0);
  }

  /** mkdir -p (host helper) */
  mkdirTree(path, mode = 0o777) {
    let d = "";
    for (const part of path.split("/")) {
      if (!part) continue;
      d += "/" + part;
      try {
        this.mkdir(d, mode);
      } catch (e) {
        if (e.errno !== E.EEXIST) throw e;
      }
    }
  }

  symlink(target, path) {
    const parent = this.lookupPath(path, { parent: true }).node;
    const name = basename(path);
    const err = this._mayCreate(parent, name);
    if (err) throw new FsError(err);
    const node = this._newNode(parent, name, 0o777 | S_IFLNK, 0);
    node.link = target;
    return node;
  }

  readlink(path) {
    const node = this.lookupPath(path).node;
    if (!isLink(node.mode)) throw new FsError(E.EINVAL);
    return node.link;
  }

  rename(oldPath, newPath) {
    const oldName = basename(oldPath);
    const newName = basename(newPath);
    const oldDir = this.lookupPath(oldPath, { parent: true }).node;
    const newDir = this.lookupPath(newPath, { parent: true }).node;
    if (!oldDir || !newDir) throw new FsError(E.ENOENT);
    const oldNode = this._lookupNode(oldDir, oldName);
    // old path must not be an ancestor of the new path, and vice versa
    const rel = relative(oldPath, dirname(newPath));
    if (rel.charAt(0) !== ".") throw new FsError(E.EINVAL);
    const rel2 = relative(newPath, dirname(oldPath));
    let newNode = null;
    try {
      newNode = this._lookupNode(newDir, newName);
    } catch {
      // the new name is free
    }
    if (rel2.charAt(0) !== ".") throw new FsError(E.ENOTEMPTY);
    if (oldNode === newNode) return;
    const wantDir = isDir(oldNode.mode);
    let err = this._mayDelete(oldDir, oldName, wantDir);
    if (err) throw new FsError(err);
    err = newNode ? this._mayDelete(newDir, newName, wantDir) : this._mayCreate(newDir, newName);
    if (err) throw new FsError(err);
    if (newDir !== oldDir) {
      err = this._perm(oldDir, "w");
      if (err) throw new FsError(err);
    }
    if (newNode && wantDir) {
      for (const k in newNode.contents) {
        void k;
        throw new FsError(E.ENOTEMPTY);
      }
    }
    this._dirChange(oldDir);
    this._dirChange(newDir);
    this._nodeMove(oldNode);
    delete oldNode.parent.contents[oldNode.name];
    newDir.contents[newName] = oldNode;
    oldNode.name = newName;
    oldNode.parent = newDir;
    newDir.ctime = newDir.mtime = oldDir.ctime = oldDir.mtime = this.now();
  }

  rmdir(path) {
    const parent = this.lookupPath(path, { parent: true }).node;
    const name = basename(path);
    const node = this._lookupNode(parent, name);
    const err = this._mayDelete(parent, name, true);
    if (err) throw new FsError(err);
    for (const k in node.contents) {
      void k;
      throw new FsError(E.ENOTEMPTY);
    }
    this._dirChange(parent);
    delete parent.contents[name];
    parent.ctime = parent.mtime = this.now();
  }

  unlink(path) {
    const parent = this.lookupPath(path, { parent: true }).node;
    if (!parent) throw new FsError(E.ENOENT);
    const name = basename(path);
    this._lookupNode(parent, name);
    const err = this._mayDelete(parent, name, false);
    if (err) throw new FsError(err);
    this._dirChange(parent);
    delete parent.contents[name];
    parent.ctime = parent.mtime = this.now();
  }

  readdir(path) {
    const node = this.lookupPath(path, { follow: true }).node;
    if (!isDir(node.mode)) throw new FsError(E.ENOTDIR);
    return [".", "..", ...Object.keys(node.contents)];
  }

  getattr(node) {
    let size = 0;
    if (isDir(node.mode)) size = 4096;
    else if (isFile(node.mode)) size = node.usedBytes;
    else if (isLink(node.mode)) size = node.link.length;
    return {
      dev: isChrdev(node.mode) ? node.id : 1,
      ino: node.id,
      mode: node.mode,
      nlink: 1,
      uid: 0,
      gid: 0,
      rdev: node.rdev,
      size,
      atime: node.atime,
      mtime: node.mtime,
      ctime: node.ctime,
      blksize: 4096,
      blocks: Math.ceil(size / 4096),
    };
  }

  stat(path, dontFollow = false) {
    return this.getattr(this.lookupPath(path, { follow: !dontFollow }).node);
  }

  lstat(path) {
    return this.stat(path, true);
  }

  fstat(fd) {
    return this.getattr(this.getStream(fd).node);
  }

  _setattr(node, attr) {
    this._touch(node, attr.size === undefined ? Infinity : attr.size);
    for (const key of ["mode", "atime", "mtime", "ctime"]) if (attr[key] != null) node[key] = attr[key];
    if (attr.size !== undefined && node.usedBytes !== attr.size) {
      const old = node.contents;
      node.contents = new Uint8Array(attr.size);
      node.contents.set(old.subarray(0, Math.min(attr.size, node.usedBytes)));
      node.usedBytes = attr.size;
    }
  }

  chmod(pathOrNode, mode, dontFollow = false) {
    const node = typeof pathOrNode === "string" ? this.lookupPath(pathOrNode, { follow: !dontFollow }).node : pathOrNode;
    this._setattr(node, { mode: (mode & 0o7777) | (node.mode & ~0o7777), ctime: this.now() });
  }

  truncate(pathOrNode, len) {
    if (len < 0) throw new FsError(E.EINVAL);
    const node = typeof pathOrNode === "string" ? this.lookupPath(pathOrNode, { follow: true }).node : pathOrNode;
    if (isDir(node.mode)) throw new FsError(E.EISDIR);
    if (!isFile(node.mode)) throw new FsError(E.EINVAL);
    const err = this._perm(node, "w");
    if (err) throw new FsError(err);
    this._setattr(node, { size: len, mtime: this.now() });
  }

  ftruncate(fd, len) {
    const stream = this.getStream(fd);
    if (len < 0 || (stream.flags & O.ACCMODE) === 0) throw new FsError(E.EINVAL);
    this.truncate(stream.node, len);
  }

  cwd() {
    return this.cwdPath;
  }

  chdir(path) {
    const lookup = this.lookupPath(path, { follow: true });
    if (!lookup.node) throw new FsError(E.ENOENT);
    if (!isDir(lookup.node.mode)) throw new FsError(E.ENOTDIR);
    const err = this._perm(lookup.node, "x");
    if (err) throw new FsError(err);
    this.cwdPath = lookup.path;
  }

  // ---- streams --------------------------------------------------------------------------

  getStream(fd) {
    const s = this.streams[fd];
    if (!s) throw new FsError(E.EBADF);
    return s;
  }

  _nextfd() {
    for (let fd = 0; fd <= MAX_OPEN_FDS; fd++) if (!this.streams[fd]) return fd;
    throw new FsError(E.EMFILE);
  }

  _install(stream, fd = -1) {
    this._streamsChange();
    if (fd === -1) fd = this._nextfd();
    stream.fd = fd;
    this.streams[fd] = stream;
    return stream;
  }

  dupStream(stream, fd = -1) {
    return this._install(stream.clone(), fd);
  }

  /** open(2); flags as numbers or an fopen-style mode string ("r", "w", "a+"...). */
  open(path, flags, mode = 0o666) {
    if (path === "") throw new FsError(E.ENOENT);
    if (typeof flags === "string") flags = modeStringToFlags(flags);
    mode = flags & O.CREAT ? (mode & 0o7777) | S_IFREG : 0;
    const isDirPath = path.endsWith("/");
    const lookup = this.lookupPath(path, { follow: !(flags & O.NOFOLLOW), noentOkay: true });
    let node = lookup.node;
    path = lookup.path;
    let created = false;
    if (flags & O.CREAT) {
      if (node) {
        if (flags & O.EXCL) throw new FsError(E.EEXIST);
      } else if (isDirPath) {
        throw new FsError(E.EISDIR);
      } else {
        node = this.mknod(path, mode | 0o777, 0);
        created = true;
      }
    }
    if (!node) throw new FsError(E.ENOENT);
    if (isChrdev(node.mode)) flags &= ~O.TRUNC;
    if (flags & O.DIRECTORY && !isDir(node.mode)) throw new FsError(E.ENOTDIR);
    if (!created) {
      const err = this._mayOpen(node, flags);
      if (err) throw new FsError(err);
    }
    if (flags & O.TRUNC && !created) this.truncate(node, 0);
    flags &= ~(O.EXCL | O.TRUNC | O.NOFOLLOW);
    const stream = new Stream({ node, path: this.getPath(node), flags, position: 0 });
    if (isChrdev(node.mode)) {
      const dev = this.devices.get(node.rdev);
      if (!dev) throw new FsError(E.ENXIO);
      stream.seekable = false;
      stream.tty = dev.tty ?? null;
      stream.dev = dev;
    }
    this._install(stream);
    if (created) this.chmod(node, mode & 0o777);
    return stream;
  }

  _mayOpen(node, flags) {
    if (!node) return E.ENOENT;
    if (isLink(node.mode)) return E.ELOOP;
    let perms = ["r", "w", "rw"][flags & 3];
    if (flags & O.TRUNC) perms += "w";
    if (isDir(node.mode) && (perms !== "r" || flags & (O.TRUNC | O.CREAT))) return E.EISDIR;
    return this._perm(node, perms);
  }

  close(stream) {
    if (stream.fd === null) throw new FsError(E.EBADF);
    stream.getdents = null;
    if (stream.dev?.flush) stream.dev.flush();
    this._streamsChange();
    this.streams[stream.fd] = null;
    stream.fd = null;
  }

  llseek(stream, offset, whence) {
    if (stream.fd === null) throw new FsError(E.EBADF);
    if (!stream.seekable) throw new FsError(E.ESPIPE);
    if (whence !== 0 && whence !== 1 && whence !== 2) throw new FsError(E.EINVAL);
    let position = offset;
    if (whence === 1) position += stream.position;
    else if (whence === 2 && isFile(stream.node.mode)) position += stream.node.usedBytes;
    if (position < 0) throw new FsError(E.EINVAL);
    this._streamTouch(stream);
    stream.position = position;
    return position;
  }

  /** read up to `length` bytes into buffer[offset...]; returns the count. */
  read(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) throw new FsError(E.EINVAL);
    if (stream.fd === null) throw new FsError(E.EBADF);
    if ((stream.flags & O.ACCMODE) === 1) throw new FsError(E.EBADF);
    if (isDir(stream.node.mode)) throw new FsError(E.EISDIR);
    const seeking = position !== undefined;
    if (!seeking) position = stream.position;
    else if (!stream.seekable) throw new FsError(E.ESPIPE);
    let n;
    if (stream.dev) n = stream.dev.read(stream, buffer, offset, length);
    else {
      const node = stream.node;
      if (position >= node.usedBytes) n = 0;
      else {
        n = Math.min(node.usedBytes - position, length);
        buffer.set(node.contents.subarray(position, position + n), offset);
      }
    }
    if (!seeking && n) {
      this._streamTouch(stream);
      stream.position += n;
    }
    return n;
  }

  /** write `length` bytes from buffer[offset...]; returns the count. */
  write(stream, buffer, offset, length, position) {
    if (length < 0 || position < 0) throw new FsError(E.EINVAL);
    if (stream.fd === null) throw new FsError(E.EBADF);
    if ((stream.flags & O.ACCMODE) === 0) throw new FsError(E.EBADF);
    if (isDir(stream.node.mode)) throw new FsError(E.EISDIR);
    if (stream.seekable && stream.flags & O.APPEND) this.llseek(stream, 0, 2);
    const seeking = position !== undefined;
    if (!seeking) position = stream.position;
    else if (!stream.seekable) throw new FsError(E.ESPIPE);
    let n;
    if (stream.dev) n = stream.dev.write(stream, buffer, offset, length);
    else n = this._writeFile(stream.node, buffer, offset, length, position);
    if (!seeking && n) {
      this._streamTouch(stream);
      stream.position += n;
    }
    return n;
  }

  _writeFile(node, buffer, offset, length, position) {
    if (!length) return 0;
    this._touch(node, position);
    node.mtime = node.ctime = this.now();
    if (!node.usedBytes && !position) {
      node.contents = buffer.slice(offset, offset + length);
      node.usedBytes = length;
    } else {
      const want = position + length;
      const cap = node.contents.length;
      if (cap < want) {
        let size = Math.max(want, (cap * (cap < 1048576 ? 2 : 1.125)) >>> 0);
        if (cap) size = Math.max(size, 256);
        const bigger = new Uint8Array(size);
        bigger.set(node.contents.subarray(0, node.usedBytes));
        node.contents = bigger;
      }
      node.contents.set(buffer.subarray(offset, offset + length), position);
      node.usedBytes = Math.max(node.usedBytes, want);
    }
    return length;
  }

  // ---- devices and the initial tree (as Emscripten sets it up) --------------------------

  _registerDevice(dev, ops) {
    this.devices.set(dev, ops);
  }

  // /dev/tty (fd 0, 1) reads `stdin` and writes `stdout`; /dev/tty1 (fd 2) cannot be read
  _tty(name, getOut, readable) {
    let line = [];
    const flush = () => {
      if (line.length) {
        const f = getOut();
        if (f) f(Uint8Array.from(line));
        line = [];
      }
    };
    return {
      tty: { name, termios: readable },
      flush,
      read: (stream, buffer, offset, length) => {
        if (!readable) throw new FsError(E.ENXIO);
        let n = 0;
        for (let i = 0; i < length; i++) {
          const c = this.stdin();
          if (c === null || c === undefined) break;
          buffer[offset + i] = c;
          n++;
          if (c === 10) break;
        }
        return n;
      },
      write: (stream, buffer, offset, length) => {
        for (let i = 0; i < length; i++) {
          const c = buffer[offset + i];
          if (c === 10) {
            line.push(10);
            flush();
          } else if (c !== 0) line.push(c);
        }
        return length;
      },
    };
  }

  _staticInit() {
    this.mkdir("/tmp");
    this.mkdir("/home");
    this.mkdir("/home/web_user");
    this.mkdir("/dev");
    this._registerDevice(259, {
      read: () => 0,
      write: (stream, buffer, offset, length) => length,
    });
    this.mknod("/dev/null", 0o666 | S_IFCHR, 259);
    this._registerDevice(1280, this._tty("tty", () => this.out.tty, true));
    this._registerDevice(1536, this._tty("tty1", () => this.out.tty1, false));
    this.mknod("/dev/tty", 0o666 | S_IFCHR, 1280);
    this.mknod("/dev/tty1", 0o666 | S_IFCHR, 1536);
    const randomDev = {
      read: (stream, buffer, offset, length) => {
        for (let i = 0; i < length; i++) buffer[offset + i] = this.random();
        return length;
      },
      write: (stream, buffer, offset, length) => length,
    };
    // Emscripten's createDevice: majors 64, 65, ... in creation order, read-only
    this._registerDevice(64 << 8, randomDev);
    this.mknod("/dev/random", 0o555 | S_IFCHR, 64 << 8);
    this._registerDevice(65 << 8, randomDev);
    this.mknod("/dev/urandom", 0o555 | S_IFCHR, 65 << 8);
    this.mkdir("/dev/shm");
    this.mkdir("/dev/shm/tmp");
    this.mkdir("/proc");
    this.mkdir("/proc/self");
    this.mkdir("/proc/self/fd");
    this.nextInode++; // Emscripten mounts a pseudo file system there (one more inode)
    this.symlink("/dev/tty", "/dev/stdin");
    this.symlink("/dev/tty", "/dev/stdout");
    this.symlink("/dev/tty1", "/dev/stderr");
    this.open("/dev/stdin", 0);
    this.open("/dev/stdout", 1);
    this.open("/dev/stderr", 1);
  }

  // ---- host helpers ---------------------------------------------------------------------

  /** Create or replace a file (parents created); data: Uint8Array or binary string. */
  writeFile(path, data, mode = 0o666) {
    const bytes = typeof data === "string" ? binaryToBytes(data) : data;
    const dir = dirname(path);
    if (dir !== "/" && dir !== ".") this.mkdirTree(dir);
    const stream = this.open(path, O.WRONLY | O.CREAT | O.TRUNC, mode);
    this.write(stream, bytes, 0, bytes.length);
    this.close(stream);
  }

  /** Bytes of a file (a copy), or null when there is no such file. */
  readFile(path) {
    let node;
    try {
      node = this.lookupPath(path, { follow: true }).node;
    } catch {
      return null;
    }
    if (!node || !isFile(node.mode)) return null;
    return node.contents.slice(0, node.usedBytes);
  }

  exists(path) {
    try {
      return !!this.lookupPath(path, { follow: true }).node;
    } catch {
      return false;
    }
  }

  /** Every file and directory below `from` as [path, node], parents first. */
  walk(from = "/") {
    const out = [];
    const visit = (dir, base) => {
      for (const name of Object.keys(dir.contents)) {
        const node = dir.contents[name];
        const path = `${base}/${name}`;
        out.push([path, node]);
        if (isDir(node.mode)) visit(node, path);
      }
    };
    const start = this.lookupPath(from, { follow: true }).node;
    visit(start, from === "/" ? "" : from);
    return out;
  }

  // ---- journal: mark() / rollback() ----------------------------------------------------

  /** Start recording what is needed to come back to the current state. */
  mark() {
    this.journal = {
      files: new Map(),
      dirs: new Map(),
      moved: new Map(),
      streams: null,
      positions: new Map(),
      state: { nextInode: this.nextInode, cwd: this.cwdPath, umask: this.umask },
    };
  }

  /** Put the file system back as it was at the last mark(); the mark stays. */
  rollback() {
    const j = this.journal;
    if (!j) throw new Error("vfs: rollback without mark");
    for (const [node, u] of j.files) {
      if (u.copy) node.contents = u.copy;
      else if (u.contents !== node.contents && u.used <= node.contents.length) {
        // grown or truncated since: the old bytes are still in the old array
        node.contents = u.contents;
      }
      node.usedBytes = u.used;
      node.mode = u.mode;
      node.atime = u.atime;
      node.mtime = u.mtime;
      node.ctime = u.ctime;
    }
    for (const [node, m] of j.moved) {
      node.parent = m.parent;
      node.name = m.name;
    }
    for (const [dir, saved] of j.dirs) {
      dir.contents = Object.assign(Object.create(null), saved);
    }
    if (j.streams) this.streams = j.streams.map((s) => s);
    for (const [shared, pos] of j.positions) shared.position = pos;
    for (const s of this.streams) if (s) s.getdents = null;
    if (j.streams) for (let fd = 0; fd < this.streams.length; fd++) if (this.streams[fd]) this.streams[fd].fd = fd;
    this.nextInode = j.state.nextInode;
    this.cwdPath = j.state.cwd;
    this.umask = j.state.umask;
    this.mark();
  }

  _touch(node, from) {
    const j = this.journal;
    if (!j) return;
    let u = j.files.get(node);
    if (!u) {
      u = {
        used: node.usedBytes,
        contents: node.contents,
        copy: null,
        mode: node.mode,
        atime: node.atime,
        mtime: node.mtime,
        ctime: node.ctime,
      };
      j.files.set(node, u);
    }
    // bytes below the old length are about to change: keep a copy of them
    if (!u.copy && from < u.used && isFile(node.mode)) u.copy = u.contents.slice(0, u.used);
  }

  _dirChange(dir) {
    const j = this.journal;
    if (j && !j.dirs.has(dir)) {
      j.dirs.set(dir, Object.assign(Object.create(null), dir.contents));
      if (!j.files.has(dir)) this._touch(dir, Infinity);
    }
  }

  _nodeMove(node) {
    const j = this.journal;
    if (j && !j.moved.has(node)) j.moved.set(node, { parent: node.parent, name: node.name });
  }

  _streamsChange() {
    const j = this.journal;
    if (j && !j.streams) {
      j.streams = this.streams.map((s) => s);
      for (const s of this.streams) if (s) this._streamTouch(s);
    }
  }

  _streamTouch(stream) {
    const j = this.journal;
    if (j && !j.positions.has(stream.shared)) j.positions.set(stream.shared, stream.shared.position);
  }
}

function relative(from, to) {
  const f = normalize(from).split("/").filter(Boolean);
  const t = normalize(to).split("/").filter(Boolean);
  let i = 0;
  while (i < f.length && i < t.length && f[i] === t[i]) i++;
  const up = f.slice(i).map(() => "..");
  return [...up, ...t.slice(i)].join("/");
}

// open() flags of an fopen() mode string
function modeStringToFlags(str) {
  const flags = {
    r: 0,
    "r+": 2,
    w: O.TRUNC | O.CREAT | O.WRONLY,
    "w+": O.TRUNC | O.CREAT | O.RDWR,
    a: O.APPEND | O.CREAT | O.WRONLY,
    "a+": O.APPEND | O.CREAT | O.RDWR,
  }[str];
  if (flags === undefined) throw new Error(`vfs: unknown open mode ${str}`);
  return flags;
}

/** Bytes of a binary string (one char per byte). */
export function binaryToBytes(text) {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return bytes;
}

/** Binary string (one char per byte) of bytes. */
export function bytesToBinary(bytes) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return text;
}
