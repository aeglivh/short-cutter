const DB_NAME = "short-cutter-video";
const STORE_NAME = "videos";
const VIDEO_KEY = "current";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveVideo(file: File): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(
    { blob: file, name: file.name, type: file.type, size: file.size },
    VIDEO_KEY
  );
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadVideo(): Promise<File | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(VIDEO_KEY);
    return new Promise((resolve) => {
      req.onsuccess = () => {
        const data = req.result;
        if (!data) return resolve(null);
        const file = new File([data.blob], data.name, { type: data.type });
        resolve(file);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function clearVideo(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(VIDEO_KEY);
  } catch {
    // ignore
  }
}
