/** IndexedDB storage for user-imported Piper TTS model files.

    Models are stored entirely in the browser so the backend can be
    stateless (no persistent filesystem needed on the server).
    When generating TTS, the model files are uploaded to the backend
    on-demand via ``POST /api/tts-with-model``.
 */

const DB_NAME = "voicio-models";
const DB_VERSION = 1;
const STORE_NAME = "models";

export interface StoredModel {
  /** Voice ID (e.g. ``"en_US-lessac-medium"``) */
  voiceId: string;
  /** Display name */
  name: string;
  /** Language code */
  language: string;
  /** Quality tier */
  quality: string;
  /** Estimated size in MB */
  sizeMb: number;
  /** .onnx file bytes */
  onnx: ArrayBuffer;
  /** .onnx.json file bytes */
  config: ArrayBuffer;
  /** When it was stored */
  importedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "voiceId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a model to IndexedDB. */
export async function saveModel(model: StoredModel): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(model);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Load a single model by voice ID. Returns ``null`` if not found. */
export async function loadModel(voiceId: string): Promise<StoredModel | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(voiceId);
    req.onsuccess = () => {
      db.close();
      resolve(req.result ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** List all stored models. */
export async function listModels(): Promise<StoredModel[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Get the set of voice IDs that are stored locally. */
export async function listInstalledIds(): Promise<Set<string>> {
  const models = await listModels();
  return new Set(models.map((m) => m.voiceId));
}

/** Remove a model from IndexedDB by voice ID. */
export async function removeModel(voiceId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(voiceId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
