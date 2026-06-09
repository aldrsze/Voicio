import { useCallback, useState } from "react";
import { listModels, loadModel, removeModel, saveModel, type StoredModel } from "../lib/modelStorage";

const API_BASE = "/api";

export interface CatalogVoice {
  id: string;
  name: string;
  language: string;
  region: string;
  quality: string;
  gender: string;
  vibe: string[];
  description: string;
  size_mb: number;
  installed: boolean; // Installed in IndexedDB
}

// HF download URL for Piper files
export function hfDownloadUrl(voiceId: string, filename: string): string {
  const prefix = voiceId.split("-")[0]; // e.g. "en_US", "en_GB"
  const langDir = prefix === "en_GB" ? "en_GB" : prefix.split("_")[0];

  // Extract voice name portion
  const withoutQuality = voiceId.replace(/-[^-]*$/, "");
  const name = withoutQuality.includes("-")
    ? withoutQuality.slice(withoutQuality.indexOf("-") + 1)
    : withoutQuality;

  const langRegion = voiceId.split("-")[0];
  const quality = voiceId.includes("-") ? voiceId.split("-").pop()! : "medium";

  return (
    `https://huggingface.co/rhasspy/piper-voices/resolve/main/` +
    `${langDir}/${langRegion}/${name}/${quality}/${filename}`
  );
}

// Parse voice display name from ID
export function parseVoiceName(voiceId: string): string {
  const lastDash = voiceId.lastIndexOf("-");
  const withoutQuality = lastDash !== -1 ? voiceId.slice(0, lastDash) : voiceId;
  const nameRaw = withoutQuality.includes("-")
    ? withoutQuality.slice(withoutQuality.indexOf("-") + 1)
    : withoutQuality;
  return nameRaw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
    .trim();
}

// Parse language code from ID
export function parseLanguageCode(voiceId: string): string {
  return voiceId.split("_")[0];
}

// Parse quality from ID
export function parseQuality(voiceId: string): string {
  return voiceId.includes("-") ? voiceId.split("-").pop()! : "medium";
}

// Model & config filenames
function modelFiles(voiceId: string): [string, string] {
  return [`${voiceId}.onnx`, `${voiceId}.onnx.json`];
}

// Fetch model bytes from HF
export async function downloadFromHf(
  voiceId: string,
  _onProgress?: (loaded: number, total: number) => void,
): Promise<{ onnx: ArrayBuffer; config: ArrayBuffer }> {
  const [onnxFilename, configFilename] = modelFiles(voiceId);

  // Fetch files in parallel
  const [onnxRes, configRes] = await Promise.all([
    fetch(hfDownloadUrl(voiceId, onnxFilename)),
    fetch(hfDownloadUrl(voiceId, configFilename)),
  ]);

  if (!onnxRes.ok) {
    throw new Error(
      `Failed to download ${onnxFilename} (HTTP ${onnxRes.status}). ` +
      `This quality tier may not exist for this voice — try medium or low.`,
    );
  }
  if (!configRes.ok) {
    throw new Error(`Failed to download ${configFilename} (HTTP ${configRes.status})`);
  }

  const [onnx, config] = await Promise.all([
    onnxRes.arrayBuffer(),
    configRes.arrayBuffer(),
  ]);

  return { onnx, config };
}

interface ModelsState {
  catalog: CatalogVoice[];
  loading: boolean;
  busyVoiceId: string | null; // Busy voice ID
  error: string | null;
}

export function useModels() {
  const [state, setState] = useState<ModelsState>({
    catalog: [],
    loading: false,
    busyVoiceId: null,
    error: null,
  });

  // Load catalog from backend and merge local storage
  const refreshCatalog = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [res, localModels] = await Promise.all([
        fetch(`${API_BASE}/models/catalog`),
        listModels(),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { voices: CatalogVoice[] } = await res.json();

      const localMap = new Map(localModels.map(m => [m.voiceId, m]));

      // Check if installed
      const enriched = data.voices.map((v) => ({
        ...v,
        installed: v.installed || localMap.has(v.id),
      }));

      // Add missing local models
      for (const m of localModels) {
        if (!enriched.some(v => v.id === m.voiceId)) {
          enriched.push({
            id: m.voiceId,
            name: m.name,
            language: m.language,
            region: m.language,
            quality: m.quality,
            gender: "mixed",
            vibe: [],
            description: "Custom imported model",
            size_mb: m.sizeMb,
            installed: true,
          });
        }
      }

      setState((prev) => ({
        ...prev,
        catalog: enriched,
        loading: false,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch catalog";
      setState((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  // Download from HF and save to local storage
  const downloadModel = useCallback(
    async (voice: CatalogVoice): Promise<boolean> => {
      setState((prev) => ({ ...prev, busyVoiceId: voice.id, error: null }));
      try {
        const { onnx, config } = await downloadFromHf(voice.id);

        const stored: StoredModel = {
          voiceId: voice.id,
          name: voice.name,
          language: voice.language,
          quality: voice.quality,
          sizeMb: voice.size_mb,
          onnx,
          config,
          importedAt: Date.now(),
        };

        await saveModel(stored);

        // Update catalog state
        setState((prev) => ({
          ...prev,
          busyVoiceId: null,
          catalog: prev.catalog.map((v) =>
            v.id === voice.id ? { ...v, installed: true } : v,
          ),
        }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Download failed";
        setState((prev) => ({ ...prev, busyVoiceId: null, error: msg }));
        return false;
      }
    },
    [],
  );

  // Remove model from local storage
  const deleteModel = useCallback(async (voiceId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, busyVoiceId: voiceId, error: null }));
    try {
      await removeModel(voiceId);
      setState((prev) => ({
        ...prev,
        busyVoiceId: null,
        catalog: prev.catalog.map((v) =>
          v.id === voiceId ? { ...v, installed: false } : v,
        ),
      }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setState((prev) => ({ ...prev, busyVoiceId: null, error: msg }));
      return false;
    }
  }, []);

  // Import custom model files
  const importModel = useCallback(
    async (
      voiceId: string,
      name: string,
      language: string,
      quality: string,
      sizeMb: number,
      onnxBytes: ArrayBuffer,
      configBytes: ArrayBuffer,
    ): Promise<boolean> => {
      setState((prev) => ({ ...prev, busyVoiceId: voiceId, error: null }));
      try {
        const stored: StoredModel = {
          voiceId,
          name,
          language,
          quality,
          sizeMb,
          onnx: onnxBytes,
          config: configBytes,
          importedAt: Date.now(),
        };
        await saveModel(stored);

        setState((prev) => {
          const exists = prev.catalog.some(v => v.id === voiceId);
          if (exists) {
            return {
              ...prev,
              busyVoiceId: null,
              catalog: prev.catalog.map((v) =>
                v.id === voiceId ? { ...v, installed: true } : v,
              ),
            };
          }
          return {
            ...prev,
            busyVoiceId: null,
            catalog: [
              ...prev.catalog,
              {
                id: voiceId,
                name,
                language,
                region: language,
                quality,
                gender: "mixed",
                vibe: [],
                description: "Custom imported model",
                size_mb: sizeMb,
                installed: true,
              }
            ],
          };
        });
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed";
        setState((prev) => ({ ...prev, busyVoiceId: null, error: msg }));
        return false;
      }
    },
    [],
  );

  // Get stored model
  const getStoredModel = useCallback(
    async (voiceId: string): Promise<StoredModel | null> => {
      return loadModel(voiceId);
    },
    [],
  );

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    refreshCatalog,
    downloadModel,
    deleteModel,
    importModel,
    getStoredModel,
    clearError,
  };
}
