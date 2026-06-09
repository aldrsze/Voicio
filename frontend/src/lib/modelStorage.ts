/** IndexedDB storage for local Piper TTS models. Uploaded to backend on-demand. */

const DB_NAME = "voicio-models";
const DB_VERSION = 1;
const STORE_NAME = "models";

export interface StoredModel {
  voiceId: string; // Voice ID (e.g., "en_US-lessac-medium")
  name: string; // Display name
  language: string; // Language code
  quality: string; // Quality tier
  sizeMb: number; // Size in MB
  onnx: ArrayBuffer; // .onnx bytes
  config: ArrayBuffer; // .onnx.json bytes
  importedAt: number; // Timestamp
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

// Save model to DB
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

// Load model by ID
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

// List stored models
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

// Local voice IDs
export async function listInstalledIds(): Promise<Set<string>> {
  const models = await listModels();
  return new Set(models.map((m) => m.voiceId));
}

// Remove model by ID
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
