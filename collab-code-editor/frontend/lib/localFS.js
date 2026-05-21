/**
 * localFS.js — Persist FileSystemDirectoryHandle in IndexedDB
 *
 * The File System Access API gives us directory handles that can access
 * the local filesystem, but they live only in memory. IndexedDB is the
 * only browser storage that can serialize these handles so they survive
 * page refreshes.
 *
 * Supported: Chrome 86+, Edge 86+, Opera 72+
 * NOT supported: Firefox, Safari (they have no showDirectoryPicker)
 */

const DB_NAME = "collab-local-fs";
const STORE = "handles";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save the root directory handle for a room. */
export async function saveRoomDirHandle(roomId, handle) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(handle, `room:${roomId}`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("[localFS] Could not save handle:", e);
  }
}

/** Load the root directory handle for a room (may be null). */
export async function loadRoomDirHandle(roomId) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(`room:${roomId}`);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

/** Clear the saved handle for a room. */
export async function clearRoomDirHandle(roomId) {
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(`room:${roomId}`);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

/**
 * Check (and optionally request) read-write permission for a handle.
 * Must be called from a user-gesture context (click handler) when
 * permission is "prompt".
 */
export async function verifyPermission(handle, { request = false } = {}) {
  if (!handle) return false;
  try {
    const perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm === "granted") return true;
    if (!request) return false;
    const asked = await handle.requestPermission({ mode: "readwrite" });
    return asked === "granted";
  } catch {
    return false;
  }
}

/**
 * Walk a directory handle recursively, collecting all FileSystemFileHandles.
 * Returns an array of { path: string, handle: FileSystemFileHandle }
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string[]} ignoreDirs  - directory names to skip
 * @param {string} prefix        - path prefix (used during recursion)
 */
export async function walkDirectory(dirHandle, ignoreDirs = [], prefix = "") {
  const results = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (ignoreDirs.includes(name)) continue;
    if (handle.kind === "directory") {
      const sub = await walkDirectory(handle, ignoreDirs, `${prefix}${name}/`);
      results.push(...sub);
    } else {
      results.push({ path: `${prefix}${name}`, handle });
    }
  }
  return results;
}
