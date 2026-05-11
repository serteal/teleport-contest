import { game } from './gstate.js';
// storage.js -- Virtual filesystem backed by localStorage.
//
// Each VFS file is stored as a separate localStorage key with a 'vfs:' prefix.
// Example: localStorage['vfs:/home/rodney/notes'] = 'Remember to buy scrolls'
//
// The /play/<owner>/index.html scaffold sets window.__TELEPORT_VFS_PREFIX to
// 'vfs:<owner>:' before any module loads, so save files / record / bones /
// per-segment state for fork A do not collide with fork B in the same browser.
// Node sandbox runs leave the prefix at 'vfs:' (no window) so parity scoring
// is unaffected.

const VFS_PREFIX =
    (typeof window !== 'undefined' && window.__TELEPORT_VFS_PREFIX) || 'vfs:';

// Safe localStorage access -- returns null when unavailable (e.g. Node.js tests).

export function setStorageForTesting(mock) { if (game) game.mockStorage = mock; }
function storage() {
    if (game?.mockStorage) return game.mockStorage;
    try {
        if (typeof localStorage === 'undefined') return null;
        return localStorage;
    } catch (e) { return null; }
}

export function vfsReadFile(path) {
    const s = storage();
    if (!s) return null;
    try {
        const v = s.getItem(VFS_PREFIX + path);
        return v !== null ? v : null;
    } catch (e) { return null; }
}

export function vfsWriteFile(path, content) {
    const s = storage();
    if (!s) return false;
    try { s.setItem(VFS_PREFIX + path, content); return true; }
    catch (e) { return false; }
}

export function vfsDeleteFile(path) {
    const s = storage();
    if (!s) return false;
    try {
        if (s.getItem(VFS_PREFIX + path) === null) return false;
        s.removeItem(VFS_PREFIX + path);
        return true;
    } catch (e) { return false; }
}

export function vfsListFiles(prefix) {
    const s = storage();
    if (!s) return [];
    try {
        const result = [];
        for (let i = 0; i < s.length; i++) {
            const key = s.key(i);
            if (!key || !key.startsWith(VFS_PREFIX)) continue;
            const path = key.slice(VFS_PREFIX.length);
            if (!prefix || path.startsWith(prefix)) result.push(path);
        }
        return result;
    } catch (e) { return []; }
}

export function init_storage_globals() {
    if (game) game.mockStorage = null;
}

// Minimal Storage-API-compatible in-memory backing for tests and multi-segment
// replay. session_test_runner.mjs / NethackGame instances create one of these
// at construction time and re-link it onto game.mockStorage after every
// decl_globals_init() (which clears the link). The Map survives across segments
// so vfsWriteFile in seg 1 is readable by vfsReadFile in seg 2 — same role
// localStorage plays in the browser.
export class InMemoryStorage {
    constructor() { this._data = new Map(); }
    getItem(key) { return this._data.has(key) ? this._data.get(key) : null; }
    setItem(key, value) { this._data.set(key, String(value)); }
    removeItem(key) { this._data.delete(key); }
    get length() { return this._data.size; }
    key(i) {
        let n = 0;
        for (const k of this._data.keys()) {
            if (n === i) return k;
            n++;
        }
        return null;
    }
}
