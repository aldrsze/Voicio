import { useCallback, useState } from "react";
import { listInstalledIds, loadModel, removeModel, saveModel, type StoredModel } from "../lib/modelStorage";

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
  /** Whether the model is stored in IndexedDB (set by frontend) */
  installed: boolean;
}

/**
 * Build the Hugging Face download URL for a Piper model file.
 *
 * Mirror of the backend's ``_hf_download_url`` so the frontend can fetch
 * model files directly from Hugging Face without a server proxy.
 */
/** Build the Hugging Face download URL for a Piper model file. */
export function hfDownloadUrl(voiceId: string, filename: string): string {
  const prefix = voiceId.split("-")[0]; // e.g. "en_US", "en_GB"
  const langDir = prefix === "en_GB" ? "en_GB" : prefix.split("_")[0];

  // Voice name portion between region prefix and quality suffix
  // Equivalent of Python's rsplit("-", 1)[0] — strip the last `-word`
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

/** Parse a voice display name from its ID (front-end version). */
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

/** Parse language code from a voice ID (e.g. "en_US-amy-medium" → "en"). */
export function parseLanguageCode(voiceId: string): string {
  return voiceId.split("_")[0];
}

/** Parse quality from a voice ID (last segment after "-"). */
export function parseQuality(voiceId: string): string {
  return voiceId.includes("-") ? voiceId.split("-").pop()! : "medium";
}

/** Filenames for a Piper voice's model file and config file. */
function modelFiles(voiceId: string): [string, string] {
  return [`${voiceId}.onnx`, `${voiceId}.onnx.json`];
}

/** Fetch model bytes from Hugging Face for a catalog voice. */
export async function downloadFromHf(
  voiceId: string,
  _onProgress?: (loaded: number, total: number) => void,
): Promise<{ onnx: ArrayBuffer; config: ArrayBuffer }> {
  const [onnxFilename, configFilename] = modelFiles(voiceId);

  // Fetch .onnx and .onnx.json in parallel
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
  /** Currently downloading/deleting voice ID */
  busyVoiceId: string | null;
  error: string | null;
}

export function useModels() {
  const [state, setState] = useState<ModelsState>({
    catalog: [],
    loading: false,
    busyVoiceId: null,
    error: null,
  });

  /** Fetch catalog from backend and merge with IndexedDB installed state. */
  const refreshCatalog = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [res, installedIds] = await Promise.all([
        fetch(`${API_BASE}/models/catalog`),
        listInstalledIds(),
      ]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { voices: CatalogVoice[] } = await res.json();

      // Mark voices as installed if they exist in IndexedDB OR on the backend's filesystem
      const enriched = data.voices.map((v) => ({
        ...v,
        installed: v.installed || installedIds.has(v.id),
      }));

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

  /** Download a model from Hugging Face and save to IndexedDB. */
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

        // Refresh catalog to show installed
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

  /** Remove a model from IndexedDB. */
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

  /** Import user-supplied model files (from drag & drop or file picker). */
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

        setState((prev) => ({
          ...prev,
          busyVoiceId: null,
          catalog: prev.catalog.map((v) =>
            v.id === voiceId ? { ...v, installed: true } : v,
          ),
        }));
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Import failed";
        setState((prev) => ({ ...prev, busyVoiceId: null, error: msg }));
        return false;
      }
    },
    [],
  );

  /** Get stored model data for use with TTS generation. */
  const getStoredModel = useCallback(
    async (voiceId: string): Promise<StoredModel | null> => {
      return loadModel(voiceId);
    },
    [],
  );

  /** Clear error */
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
