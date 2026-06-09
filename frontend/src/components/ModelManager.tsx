import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cloud,
  Download,
  HardDrive,
  LoaderCircle,
  Package,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useModels, type CatalogVoice, parseVoiceName, parseLanguageCode, parseQuality } from "../hooks/useModels";

type Tab = "installed" | "catalog" | "import";

interface Props {
  onModelChanged: () => void;
}

export function ModelManager({ onModelChanged }: Props) {
  const {
    catalog,
    loading,
    busyVoiceId,
    error,
    refreshCatalog,
    downloadModel,
    deleteModel,
    importModel,
    clearError,
  } = useModels();

  const [tab, setTab] = useState<Tab>("catalog");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch catalog on mount
  useEffect(() => {
    refreshCatalog();
  }, [refreshCatalog]);

  // Auto-dismiss toast after 4 s
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Cleanup toast timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // Show errors as toasts
  useEffect(() => {
    if (error) {
      showToast(error);
      clearError();
    }
  }, [error, showToast, clearError]);

  const installedVoices = catalog.filter((v) => v.installed);
  const availableVoices = catalog.filter((v) => !v.installed);

  const handleDownload = useCallback(
    async (voice: CatalogVoice) => {
      const ok = await downloadModel(voice);
      if (ok) {
        showToast(`"${voice.name}" downloaded`);
        onModelChanged();
      }
    },
    [downloadModel, showToast, onModelChanged],
  );

  const handleDelete = useCallback(
    async (voice: CatalogVoice) => {
      const ok = await deleteModel(voice.id);
      if (ok) {
        showToast(`"${voice.name}" removed`);
        onModelChanged();
      }
    },
    [deleteModel, showToast, onModelChanged],
  );

  // ── Import state ──
  const [onnxFile, setOnnxFile] = useState<File | null>(null);
  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = useCallback(async () => {
    if (!onnxFile || !jsonFile) return;

    // Infer voice ID from the .onnx filename
    const voiceId = onnxFile.name.endsWith(".onnx")
      ? onnxFile.name.slice(0, -5)
      : onnxFile.name;

    setImporting(true);
    const onnxBytes = await onnxFile.arrayBuffer();
    const configBytes = await jsonFile.arrayBuffer();

    const ok = await importModel(
      voiceId,
      parseVoiceName(voiceId),
      parseLanguageCode(voiceId),
      parseQuality(voiceId),
      Math.round((onnxBytes.byteLength + configBytes.byteLength) / (1024 * 1024)),
      onnxBytes,
      configBytes,
    );
    setImporting(false);
    if (ok) {
      showToast(`"${parseVoiceName(voiceId)}" imported`);
      setOnnxFile(null);
      setJsonFile(null);
      onModelChanged();
    }
  }, [onnxFile, jsonFile, importModel, showToast, onModelChanged]);

  const canImport = onnxFile && jsonFile && !importing;

  return (
    <div className="mt-4 border border-black/10 bg-white dark:border-white/10 dark:bg-bento-bg-dark">
      {/* ── Toast ── */}
      {toast && (
        <div className="flex items-center justify-between border-b border-black/5 bg-black/5 px-4 py-2 dark:border-white/5 dark:bg-white/5">
          <span className="font-sans text-xs text-black/80 dark:text-white/80">
            {toast}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-black/40 hover:text-black/80 dark:text-white/40 dark:hover:text-white/80"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex border-b border-black/10 dark:border-white/10">
        {((
          [
            { key: "installed" as Tab, label: "Installed", icon: HardDrive },
            { key: "catalog" as Tab, label: "Catalog", icon: Cloud },
            { key: "import" as Tab, label: "Import", icon: Upload },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`
              flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5
              font-sans text-xs font-semibold tracking-wide
              transition-all duration-150
              ${
                tab === key
                  ? "bg-black text-white dark:bg-white dark:text-black"
                  : "bg-white text-black/60 hover:bg-black/5 dark:bg-transparent dark:text-white/60 dark:hover:bg-white/10"
              }
            `}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )))}
      </div>

      {/* ── Body ── */}
      <div className="max-h-72 overflow-y-auto p-3">
        {tab === "installed" && (
          <InstalledTab
            voices={installedVoices}
            busyVoiceId={busyVoiceId}
            onDelete={handleDelete}
          />
        )}

        {tab === "catalog" && (
          <CatalogTab
            voices={availableVoices}
            busyVoiceId={busyVoiceId}
            loading={loading}
            onDownload={handleDownload}
          />
        )}

        {tab === "import" && (
          <ImportTab
            onnxFile={onnxFile}
            jsonFile={jsonFile}
            onOnnxChange={setOnnxFile}
            onJsonChange={setJsonFile}
            onImport={handleImport}
            canImport={canImport}
            importing={importing}
          />
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function InstalledTab({
  voices,
  busyVoiceId,
  onDelete,
}: {
  voices: CatalogVoice[];
  busyVoiceId: string | null;
  onDelete: (v: CatalogVoice) => void;
}) {
  if (voices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6">
        <Package className="h-5 w-5 text-black/30 dark:text-white/30" />
        <p className="font-sans text-xs text-black/40 dark:text-white/40">
          No installed models
        </p>
        <p className="font-sans text-[10px] text-black/30 dark:text-white/30">
          Download from the Catalog or use Import
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {voices.map((v) => {
        const isBusy = busyVoiceId === v.id;
        return (
          <div
            key={v.id}
            className="flex items-center justify-between gap-2 border border-black/5 px-3 py-2 dark:border-white/5"
          >
            <div className="min-w-0 flex-1">
              <span className="font-sans text-xs font-semibold text-black dark:text-white">
                {v.name}
              </span>
              <span className="ml-1.5 font-sans text-[10px] text-black/40 dark:text-white/50">
                {v.id}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
                  {v.quality}
                </span>
                <span className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
                  {v.language.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onDelete(v)}
              disabled={isBusy}
              className="flex h-6 w-6 shrink-0 items-center justify-center border border-black/10 text-black/40 transition-colors hover:border-red-400 hover:text-red-500 disabled:opacity-40 dark:border-white/10 dark:text-white/40 dark:hover:border-red-400 dark:hover:text-red-400"
              aria-label={`Remove ${v.name}`}
            >
              {isBusy ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function CatalogTab({
  voices,
  busyVoiceId,
  loading,
  onDownload,
}: {
  voices: CatalogVoice[];
  busyVoiceId: string | null;
  loading: boolean;
  onDownload: (v: CatalogVoice) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6">
        <LoaderCircle className="h-4 w-4 animate-spin text-black/50 dark:text-white/50" />
        <span className="font-sans text-xs text-black/50 dark:text-white/50">
          Loading catalog…
        </span>
      </div>
    );
  }

  if (voices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1.5 py-6">
        <Cloud className="h-5 w-5 text-black/30 dark:text-white/30" />
        <p className="font-sans text-xs text-black/40 dark:text-white/40">
          All catalog voices are installed
        </p>
        <p className="font-sans text-[10px] text-black/30 dark:text-white/30">
          Check the Installed tab to manage them
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {voices.map((v) => {
        const isBusy = busyVoiceId === v.id;
        return (
          <div
            key={v.id}
            className="flex items-center justify-between gap-2 border border-black/5 px-3 py-2 dark:border-white/5"
          >
            <div className="min-w-0 flex-1">
              <span className="font-sans text-xs font-semibold text-black dark:text-white">
                {v.name}
              </span>
              <span className="ml-1.5 font-sans text-[10px] text-black/40 dark:text-white/50">
                {v.id}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
                  {v.quality}
                </span>
                <span className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
                  {v.language.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 border border-black/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-black/70 dark:border-white/10 dark:text-white/80">
                  ~{v.size_mb}MB
                </span>
              </div>
              {v.description && (
                <p className="mt-0.5 truncate font-sans text-[10px] text-black/30 dark:text-white/30">
                  {v.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDownload(v)}
              disabled={isBusy}
              className="flex h-6 w-6 shrink-0 items-center justify-center border border-black/10 bg-white text-black/40 transition-colors hover:bg-black/5 hover:text-black/70 disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
              aria-label={`Download ${v.name}`}
            >
              {isBusy ? (
                <LoaderCircle className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ImportTab({
  onnxFile,
  jsonFile,
  onOnnxChange,
  onJsonChange,
  onImport,
  canImport,
  importing,
}: {
  onnxFile: File | null;
  jsonFile: File | null;
  onOnnxChange: (f: File | null) => void;
  onJsonChange: (f: File | null) => void;
  onImport: () => void;
  canImport: boolean;
  importing: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {/* .onnx file */}
      <div>
        <label className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-wider text-black/60 dark:text-white/60">
          Model file (.onnx)
        </label>
        <label
          className={`
            flex cursor-pointer items-center justify-center border px-3 py-3
            font-sans text-xs transition-colors
            ${
              onnxFile
                ? "border-black/30 bg-black/5 text-black/80 dark:border-white/30 dark:bg-white/5 dark:text-white/80"
                : "border-dashed border-black/20 text-black/40 hover:bg-black/5 dark:border-white/20 dark:text-white/40 dark:hover:bg-white/5"
            }
          `}
        >
          {onnxFile ? (
            <span className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5" />
              {onnxFile.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOnnxChange(null);
                }}
                className="ml-1 text-black/40 hover:text-black/80 dark:text-white/40 dark:hover:text-white/80"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              Click to select .onnx file
            </span>
          )}
          <input
            type="file"
            accept=".onnx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onOnnxChange(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* .onnx.json file */}
      <div>
        <label className="mb-1 block font-sans text-[10px] font-semibold uppercase tracking-wider text-black/60 dark:text-white/60">
          Config file (.onnx.json)
        </label>
        <label
          className={`
            flex cursor-pointer items-center justify-center border px-3 py-3
            font-sans text-xs transition-colors
            ${
              jsonFile
                ? "border-black/30 bg-black/5 text-black/80 dark:border-white/30 dark:bg-white/5 dark:text-white/80"
                : "border-dashed border-black/20 text-black/40 hover:bg-black/5 dark:border-white/20 dark:text-white/40 dark:hover:bg-white/5"
            }
          `}
        >
          {jsonFile ? (
            <span className="flex items-center gap-2">
              <HardDrive className="h-3.5 w-3.5" />
              {jsonFile.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onJsonChange(null);
                }}
                className="ml-1 text-black/40 hover:text-black/80 dark:text-white/40 dark:hover:text-white/80"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              Click to select .onnx.json file
            </span>
          )}
          <input
            type="file"
            accept=".onnx.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onJsonChange(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* Import button */}
      <button
        type="button"
        onClick={onImport}
        disabled={!canImport}
        className={`
          flex items-center justify-center gap-1.5 border px-3 py-2
          font-sans text-xs font-semibold tracking-wide
          transition-all duration-150
          disabled:cursor-not-allowed disabled:opacity-40
          ${
            canImport
              ? "border-black bg-black text-white hover:bg-black/80 dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/80"
              : "border-black/10 bg-white text-black/40 dark:border-white/10 dark:bg-transparent dark:text-white/40"
          }
        `}
      >
        {importing ? (
          <>
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Importing…
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            Import Model
          </>
        )}
      </button>
    </div>
  );
}
