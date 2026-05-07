import { InMemoryStorage } from './storage.js';

const VFS_PREFIX = 'vfs:';
const FS_MANIFEST_PATH = '/.nhjs-fs-manifest.json';
const SKIP_FS_PATHS = new Set([FS_MANIFEST_PATH, '/.nethackrc', '/rng.log', '/sysconf']);
const SKIP_FS_PREFIXES = ['/dev', '/proc', '/home'];

export function storageForGame(prevGame) {
  return prevGame?._storage || prevGame?.getStorage?.() || new InMemoryStorage();
}

function storageKey(path) {
  return `${VFS_PREFIX}${path}`;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(text) {
  const binary = atob(text || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parentDir(path) {
  if (!path || path === '/') return '/';
  const idx = path.lastIndexOf('/');
  return idx <= 0 ? '/' : path.slice(0, idx);
}

function ensureDir(FS, path) {
  if (!path || path === '/') return;
  const parts = path.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += `/${part}`;
    try {
      if (FS.isDir(FS.stat(cur).mode)) continue;
    } catch {
      // Create it below.
    }
    try {
      FS.mkdir(cur);
    } catch {
      // Another restored path may already have created it.
    }
  }
}

function shouldPersistFsPath(path) {
  if (!path || path === '/') return false;
  if (SKIP_FS_PATHS.has(path)) return false;
  return !SKIP_FS_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function readStoredManifest(storage) {
  try {
    const raw = storage.getItem(storageKey(FS_MANIFEST_PATH));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function restorePersistentFs(FS, storage) {
  const manifest = readStoredManifest(storage);
  if (!manifest) return;
  for (const dir of manifest.dirs || []) {
    if (shouldPersistFsPath(dir)) ensureDir(FS, dir);
  }
  for (const path of manifest.files || []) {
    if (!shouldPersistFsPath(path)) continue;
    const raw = storage.getItem(storageKey(path));
    if (!raw) continue;
    try {
      const entry = JSON.parse(raw);
      ensureDir(FS, parentDir(path));
      FS.writeFile(path, base64ToBytes(entry.data || ''));
    } catch {
      // Ignore malformed persisted entries; the C side will recreate
      // default runtime files where possible.
    }
  }
}

export function snapshotPersistentFs(FS, storage) {
  const previous = readStoredManifest(storage);
  const dirs = [];
  const files = [];
  const liveFiles = new Set();

  function walk(dir) {
    let entries;
    try {
      entries = FS.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry === '.' || entry === '..') continue;
      const path = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
      if (!shouldPersistFsPath(path)) continue;
      let stat;
      try {
        stat = FS.stat(path);
      } catch {
        continue;
      }
      if (FS.isDir(stat.mode)) {
        dirs.push(path);
        walk(path);
      } else if (FS.isFile(stat.mode)) {
        try {
          const data = FS.readFile(path);
          files.push(path);
          liveFiles.add(path);
          storage.setItem(
            storageKey(path),
            JSON.stringify({
              encoding: 'base64',
              data: bytesToBase64(data),
            }),
          );
        } catch {
          // Non-readable runtime files are not useful across a
          // segment boundary.
        }
      }
    }
  }

  walk('/');
  for (const oldPath of previous?.files || []) {
    if (!liveFiles.has(oldPath)) storage.removeItem(storageKey(oldPath));
  }
  storage.setItem(
    storageKey(FS_MANIFEST_PATH),
    JSON.stringify({
      version: 1,
      dirs,
      files,
    }),
  );
}
