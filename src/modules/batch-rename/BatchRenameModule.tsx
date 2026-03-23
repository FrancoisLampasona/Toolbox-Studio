import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "../../App.css";
import "./batch-rename.css";
import ImageGrid from "../../components/ImageGrid";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type {
  AppSettings,
  BatchRenameModuleSettings,
  ImageInfo,
  RenamePlanItem,
  RenameSummary,
  ScanProgress,
  ThumbnailHydrationProgress,
} from "../../types";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_BATCH_RENAME_SETTINGS: BatchRenameModuleSettings = {
  namingPattern: "{slug}-{n}",
  startIndex: 1,
};

function dedupePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function mergeImages(current: ImageInfo[], incoming: ImageInfo[]): ImageInfo[] {
  const byPath = new Map(current.map((image) => [image.path, image]));
  for (const image of incoming) {
    const existing = byPath.get(image.path);
    byPath.set(image.path, existing ? { ...existing, ...image } : image);
  }
  return Array.from(byPath.values()).sort((a, b) => a.filename.localeCompare(b.filename));
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function buildThumbnailProgress(
  images: ImageInfo[],
  currentPath: string | null,
  failedPaths: Set<string>
): ThumbnailHydrationProgress | null {
  const hydratableImages = images.filter((image) => !image.error);
  if (hydratableImages.length === 0) {
    return null;
  }

  const loaded = hydratableImages.filter((image) => Boolean(image.thumbnail_base64)).length;
  const failed = hydratableImages.filter((image) => failedPaths.has(image.path)).length;
  return {
    loaded,
    failed,
    completed: Math.min(hydratableImages.length, loaded + failed),
    total: hydratableImages.length,
    currentPath,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function applyRenameResults(images: ImageInfo[], summary: RenameSummary): ImageInfo[] {
  const resultMap = new Map(summary.results.map((result) => [result.sourcePath, result]));
  return images
    .map((image) => {
      const result = resultMap.get(image.path);
      if (!result || !result.success || !result.changed) {
        return image;
      }

      return {
        ...image,
        path: result.targetPath,
        filename: result.targetName,
      };
    })
    .sort((left, right) => left.filename.localeCompare(right.filename));
}

function applyRenameToPaths(paths: string[], summary: RenameSummary): string[] {
  const resultMap = new Map(summary.results.map((result) => [result.sourcePath, result]));
  return paths.map((path) => {
    const result = resultMap.get(path);
    if (!result || !result.success || !result.changed) {
      return path;
    }
    return result.targetPath;
  });
}

function applyRenameToSelection(selection: Set<string>, summary: RenameSummary): Set<string> {
  const resultMap = new Map(summary.results.map((result) => [result.sourcePath, result]));
  return new Set(
    Array.from(selection).map((path) => {
      const result = resultMap.get(path);
      if (!result || !result.success || !result.changed) {
        return path;
      }
      return result.targetPath;
    })
  );
}

export default function BatchRenameModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<ImageInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<ThumbnailHydrationProgress | null>(null);
  const [namingPattern, setNamingPattern] = useState(DEFAULT_BATCH_RENAME_SETTINGS.namingPattern);
  const [startIndex, setStartIndex] = useState(DEFAULT_BATCH_RENAME_SETTINGS.startIndex);
  const [renamePlan, setRenamePlan] = useState<RenamePlanItem[]>([]);
  const [summary, setSummary] = useState<RenameSummary | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const inputPathsRef = useRef<string[]>([]);
  const imagesRef = useRef<ImageInfo[]>([]);
  const thumbQueueRef = useRef<string[]>([]);
  const thumbInflightRef = useRef(new Set<string>());
  const thumbFailedRef = useRef(new Set<string>());
  const thumbLoadedRef = useRef(new Set<string>());
  const thumbTimerRef = useRef<number | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    inputPathsRef.current = inputPaths;
  }, [inputPaths]);

  const persistedSettings = useMemo<BatchRenameModuleSettings>(
    () => ({
      namingPattern,
      startIndex,
    }),
    [namingPattern, startIndex]
  );

  const selectedPaths = useMemo(
    () => images.filter((image) => selectedFiles.has(image.path)).map((image) => image.path),
    [images, selectedFiles]
  );

  const changedCount = useMemo(
    () => renamePlan.filter((item) => item.changed && !item.error).length,
    [renamePlan]
  );

  const collisionCount = useMemo(
    () => renamePlan.filter((item) => item.collisionResolved).length,
    [renamePlan]
  );

  const updateThumbnailProgress = useCallback((nextImages: ImageInfo[], currentPath: string | null = null) => {
    setThumbnailProgress(buildThumbnailProgress(nextImages, currentPath, thumbFailedRef.current));
  }, []);

  const resetThumbnailState = useCallback(() => {
    if (thumbTimerRef.current) {
      window.clearTimeout(thumbTimerRef.current);
      thumbTimerRef.current = null;
    }
    thumbQueueRef.current = [];
    thumbInflightRef.current.clear();
    thumbFailedRef.current.clear();
    thumbLoadedRef.current.clear();
    setThumbnailProgress(null);
  }, []);

  const loadThumbnail = useCallback(async (path: string) => {
    try {
      const thumbnail = await invoke<string>("load_thumbnail", {
        path,
        maxSize: 200,
      });

      thumbLoadedRef.current.add(path);
      setImages((current) => {
        const nextImages = current.map((image) =>
          image.path === path ? { ...image, thumbnail_base64: thumbnail } : image
        );
        updateThumbnailProgress(nextImages, path);
        return nextImages;
      });
    } catch (error) {
      thumbFailedRef.current.add(path);
      updateThumbnailProgress(imagesRef.current, path);
      console.error("Errore thumbnail rename:", error);
    } finally {
      thumbInflightRef.current.delete(path);
      if (thumbInflightRef.current.size === 0 && thumbQueueRef.current.length === 0) {
        updateThumbnailProgress(imagesRef.current, null);
      }
      void flushThumbnailQueue();
    }
  }, [updateThumbnailProgress]);

  async function flushThumbnailQueue() {
    while (thumbInflightRef.current.size < 4 && thumbQueueRef.current.length > 0) {
      const nextPath = thumbQueueRef.current.shift();
      if (!nextPath) {
        continue;
      }

      if (
        thumbInflightRef.current.has(nextPath) ||
        thumbLoadedRef.current.has(nextPath) ||
        thumbFailedRef.current.has(nextPath)
      ) {
        continue;
      }

      thumbInflightRef.current.add(nextPath);
      updateThumbnailProgress(imagesRef.current, nextPath);
      void loadThumbnail(nextPath);
    }
  }

  const refreshRenamePlan = useCallback(async (
    paths: string[],
    pattern = namingPattern,
    sequenceStart = startIndex
  ) => {
    if (paths.length === 0) {
      setRenamePlan([]);
      return;
    }

    setPreviewBusy(true);
    try {
      const preview = await invoke<RenamePlanItem[]>("preview_batch_rename", {
        request: {
          paths,
          namingPattern: pattern,
          startIndex: sequenceStart,
        },
      });
      setRenamePlan(preview);
    } catch (error) {
      console.error("Errore anteprima rename:", error);
      setStatusMessage(getErrorMessage(error, "Impossibile aggiornare l'anteprima rename."));
      setStatusTone("error");
    } finally {
      setPreviewBusy(false);
    }
  }, [namingPattern, startIndex]);

  const runScan = useCallback(async (
    paths: string[],
    mode: "replace" | "append",
    rememberedPaths: string[] = paths
  ) => {
    const normalizedPaths = dedupePaths(paths);
    const normalizedRemembered = dedupePaths(rememberedPaths);
    if (normalizedPaths.length === 0) {
      if (mode === "replace") {
        resetThumbnailState();
        setImages([]);
        setSelectedFiles(new Set());
        setPreviewImage(null);
        setRenamePlan([]);
      }
      return;
    }

    setScanning(true);
    setScanProgress(null);
    setSummary(null);
    setStatusMessage(null);
    setStatusTone(null);
    resetThumbnailState();

    try {
      const scanned = await invoke<ImageInfo[]>("scan_paths", {
        paths: normalizedPaths,
        rememberedPaths: normalizedRemembered,
      });

      setImages((current) => {
        const nextImages = mode === "replace" ? scanned : mergeImages(current, scanned);
        setPreviewImage((currentPreview) => {
          if (currentPreview && nextImages.some((image) => image.path === currentPreview.path)) {
            return nextImages.find((image) => image.path === currentPreview.path) ?? currentPreview;
          }
          return nextImages.find((image) => !image.error) ?? nextImages[0] ?? null;
        });
        updateThumbnailProgress(nextImages);
        return nextImages;
      });

      setSelectedFiles((currentSelection) => {
        const nextSelection = mode === "replace" ? new Set<string>() : new Set(currentSelection);
        for (const image of scanned) {
          if (!image.error) {
            nextSelection.add(image.path);
          }
        }
        return nextSelection;
      });
      setInputPaths(normalizedRemembered);
    } catch (error) {
      console.error("Errore scansione rename:", error);
      setStatusMessage(getErrorMessage(error, "Impossibile caricare i file per la rinomina."));
      setStatusTone("error");
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [resetThumbnailState, updateThumbnailProgress]);

  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!initialSettings || hydrated) {
      return;
    }

    const batchSettings = initialSettings.lastBatchRenameOptions;
    if (batchSettings) {
      setNamingPattern(batchSettings.namingPattern || DEFAULT_BATCH_RENAME_SETTINGS.namingPattern);
      setStartIndex(batchSettings.startIndex || DEFAULT_BATCH_RENAME_SETTINGS.startIndex);
    }

    setHydrated(true);
  }, [hydrated, initialSettings]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    onSettingsChange({
      lastInputPaths: inputPaths,
      lastBatchRenameOptions: persistedSettings,
    });
  }, [hydrated, inputPaths, onSettingsChange, persistedSettings]);

  useEffect(() => {
    const missingPaths = images
      .filter(
        (image) =>
          !image.error &&
          !image.thumbnail_base64 &&
          !thumbInflightRef.current.has(image.path) &&
          !thumbLoadedRef.current.has(image.path) &&
          !thumbFailedRef.current.has(image.path)
      )
      .map((image) => image.path);

    if (missingPaths.length === 0) {
      updateThumbnailProgress(images, thumbnailProgress?.currentPath ?? null);
      return;
    }

    thumbQueueRef.current = dedupePaths([...thumbQueueRef.current, ...missingPaths]);
    updateThumbnailProgress(images, thumbnailProgress?.currentPath ?? null);

    if (thumbTimerRef.current) {
      window.clearTimeout(thumbTimerRef.current);
    }

    thumbTimerRef.current = window.setTimeout(() => {
      void flushThumbnailQueue();
    }, 40);
  }, [images, thumbnailProgress?.currentPath, updateThumbnailProgress]);

  useEffect(() => {
    if (!active) {
      return;
    }

    if (selectedPaths.length === 0) {
      setRenamePlan([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshRenamePlan(selectedPaths);
    }, 140);

    return () => {
      window.clearTimeout(timer);
    };
  }, [active, refreshRenamePlan, selectedPaths]);

  const addFiles = async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [{ name: "Immagini", extensions: ["jpg", "jpeg", "png", "heic", "heif", "tif", "tiff"] }],
    });

    if (!selected) {
      return;
    }

    const paths = Array.isArray(selected) ? selected : [selected];
    const nextInputPaths = dedupePaths([...inputPathsRef.current, ...paths]);
    await runScan(paths, "append", nextInputPaths);
  };

  const addFolder = async () => {
    const selected = await open({
      multiple: false,
      directory: true,
    });

    if (!selected || typeof selected !== "string") {
      return;
    }

    const nextInputPaths = dedupePaths([...inputPathsRef.current, selected]);
    await runScan([selected], "append", nextInputPaths);
  };

  const clearAll = () => {
    resetThumbnailState();
    setImages([]);
    setInputPaths([]);
    setSelectedFiles(new Set());
    setPreviewImage(null);
    setRenamePlan([]);
    setSummary(null);
    setStatusMessage(null);
    setStatusTone(null);
  };

  const handleToggleSelect = useCallback((path: string) => {
    setSelectedFiles((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
    setPreviewImage(imagesRef.current.find((image) => image.path === path) ?? null);
  }, []);

  const handleRename = async () => {
    if (renamePlan.length === 0) {
      setStatusMessage("Seleziona almeno un file valido per la rinomina.");
      setStatusTone("error");
      return;
    }

    setRenameBusy(true);
    setStatusMessage(null);
    setStatusTone(null);
    setSummary(null);

    try {
      const renameSummary = await invoke<RenameSummary>("apply_batch_rename", {
        request: {
          items: renamePlan,
        },
      });
      setSummary(renameSummary);
      setImages((current) => applyRenameResults(current, renameSummary));
      setInputPaths((current) => applyRenameToPaths(current, renameSummary));
      setSelectedFiles((current) => applyRenameToSelection(current, renameSummary));
      setPreviewImage((currentPreview) => {
        if (!currentPreview) {
          return currentPreview;
        }
        const result = renameSummary.results.find((item) => item.sourcePath === currentPreview.path);
        if (!result || !result.success || !result.changed) {
          return currentPreview;
        }
        return {
          ...currentPreview,
          path: result.targetPath,
          filename: result.targetName,
        };
      });

      const failureCount = renameSummary.failed;
      if (failureCount > 0) {
        setStatusMessage(
          `Rinomina completata con ${renameSummary.renamed} file rinominati e ${failureCount} errori.`
        );
        setStatusTone("error");
      } else {
        setStatusMessage(
          `Rinomina completata: ${renameSummary.renamed} file aggiornati${
            renameSummary.collisionsResolved > 0
              ? `, ${renameSummary.collisionsResolved} collisioni risolte`
              : ""
          }.`
        );
        setStatusTone("success");
      }
    } catch (error) {
      console.error("Errore apply rename:", error);
      setStatusMessage(getErrorMessage(error, "Impossibile completare la rinomina batch."));
      setStatusTone("error");
    } finally {
      setRenameBusy(false);
    }
  };

  const planPreview = renamePlan.slice(0, 12);
  const previewTarget = previewImage?.thumbnail_base64
    ? previewImage
    : images.find((image) => image.path === selectedPaths[0]) ?? previewImage ?? null;

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo rename-logo">R</div>
          <div className="header-brand-copy">
            <h1>Batch<span>Rename</span></h1>
            <span className="header-subtitle">Preview naming, collisioni sicure e rinomina in-place sui tuoi asset</span>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void addFiles()}>
            + File
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void addFolder()}>
            + Cartella
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void refreshRenamePlan(selectedPaths)}
            disabled={selectedPaths.length === 0 || previewBusy}
          >
            Anteprima
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRename}
            disabled={renameBusy || previewBusy || renamePlan.length === 0}
          >
            Applica rinomina
          </button>
        </div>
      </header>

      <ResizableModuleLayout
        storageKey="toolbox-layout-batch-rename-v1"
        defaultLeftWidth={320}
        defaultRightWidth={360}
        leftMinWidth={280}
        leftMaxWidth={460}
        rightMinWidth={320}
        rightMaxWidth={520}
        centerMinWidth={420}
        left={
          <>
            <div className="panel-title">Setup Rename</div>
            <div className="rename-panel">
              <div className="rename-section">
                <span className="rename-section-title">Pattern</span>
                <label className="rename-field">
                  <span>Naming pattern</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={namingPattern}
                    onChange={(event) => setNamingPattern(event.target.value)}
                    placeholder="{slug}-{n}"
                    spellCheck={false}
                  />
                </label>
                <label className="rename-field rename-field--small">
                  <span>Contatore iniziale</span>
                  <input
                    className="profile-name-input"
                    type="number"
                    min={1}
                    step={1}
                    value={startIndex}
                    onChange={(event) => setStartIndex(Math.max(1, Number(event.target.value) || 1))}
                  />
                </label>
                <p className="rename-hint">
                  Il modulo rinomina in-place i file selezionati. Se due output convergono sullo stesso nome, aggiunge automaticamente
                  un suffisso numerico stabile.
                </p>
              </div>

              <div className="rename-section">
                <span className="rename-section-title">Token disponibili</span>
                <div className="rename-token-grid">
                  {["{nome}", "{slug}", "{w}", "{h}", "{formato}", "{n}"].map((token) => (
                    <code key={token} className="rename-token">{token}</code>
                  ))}
                </div>
              </div>

              <div className="rename-section">
                <span className="rename-section-title">Riepilogo</span>
                <div className="rename-metrics">
                  <div className="rename-metric">
                    <strong>{images.length}</strong>
                    <span>asset caricati</span>
                  </div>
                  <div className="rename-metric">
                    <strong>{selectedFiles.size}</strong>
                    <span>selezionati</span>
                  </div>
                  <div className="rename-metric">
                    <strong>{changedCount}</strong>
                    <span>rinomine attive</span>
                  </div>
                  <div className="rename-metric">
                    <strong>{collisionCount}</strong>
                    <span>collisioni risolte</span>
                  </div>
                </div>
              </div>

              {statusMessage ? (
                <div className={`rename-status ${statusTone === "error" ? "error" : "success"}`}>
                  {statusMessage}
                </div>
              ) : null}
            </div>
          </>
        }
        center={
          <>
            <div className="panel-title">Asset Selezionati</div>
            <ImageGrid
              images={images}
              selectedFiles={selectedFiles}
              onToggleSelect={handleToggleSelect}
              onSelectAll={() => setSelectedFiles(new Set(images.filter((image) => !image.error).map((image) => image.path)))}
              onDeselectAll={() => setSelectedFiles(new Set())}
              onClearAll={clearAll}
              scanning={scanning}
            />
          </>
        }
        right={
          <>
            <div className="panel-title">Anteprima Rename</div>
            <div className="rename-preview-card">
              {previewTarget?.thumbnail_base64 ? (
                <img className="rename-preview-image" src={previewTarget.thumbnail_base64} alt={previewTarget.filename} />
              ) : (
                <div className="rename-preview-placeholder">
                  <span>{"\u{1F4DD}"}</span>
                  <span>{previewTarget ? "Anteprima in caricamento..." : "Seleziona un file per vedere la preview"}</span>
                </div>
              )}
              {previewTarget ? (
                <div className="rename-preview-meta">
                  <strong title={previewTarget.filename}>{previewTarget.filename}</strong>
                  <span>
                    {previewTarget.width}×{previewTarget.height} · {formatBytes(previewTarget.size)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="rename-preview-list">
              <div className="rename-preview-list-header">
                <span>Mappa rename</span>
                <span>{previewBusy ? "Aggiornamento..." : `${renamePlan.length} righe`}</span>
              </div>
              {planPreview.length > 0 ? (
                planPreview.map((item) => (
                  <div key={`${item.sourcePath}->${item.targetPath}`} className="rename-preview-row">
                    <div className="rename-preview-source">
                      <strong>{item.sourceName}</strong>
                      <span>{item.error ? item.error : `${item.width}×${item.height} · ${item.format.toUpperCase()}`}</span>
                    </div>
                    <div className="rename-preview-arrow">→</div>
                    <div className="rename-preview-target">
                      <strong>{item.targetName}</strong>
                      <span>
                        {item.error
                          ? "Saltato"
                          : item.collisionResolved
                            ? "Collisione risolta"
                            : item.changed
                              ? "Pronto"
                              : "Invariato"}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rename-preview-empty">
                  Seleziona uno o piu' file per generare l'anteprima rename.
                </div>
              )}
            </div>

            {summary ? (
              <div className="rename-summary-card">
                <div className="rename-summary-item">
                  <strong>{summary.renamed}</strong>
                  <span>rinominati</span>
                </div>
                <div className="rename-summary-item">
                  <strong>{summary.unchanged}</strong>
                  <span>invariati</span>
                </div>
                <div className="rename-summary-item">
                  <strong>{summary.failed}</strong>
                  <span>errori</span>
                </div>
                <div className="rename-summary-item">
                  <strong>{summary.collisionsResolved}</strong>
                  <span>collisioni</span>
                </div>
              </div>
            ) : null}
          </>
        }
      />

      <div className={`rename-footer ${renameBusy || previewBusy || scanning ? "active" : ""}`}>
        <span>
          {scanning && scanProgress
            ? `Scansione ${scanProgress.current}/${scanProgress.total} — ${scanProgress.filename}`
            : renameBusy
              ? "Rinomina batch in corso..."
              : previewBusy
                ? "Aggiornamento anteprima naming..."
                : thumbnailProgress && thumbnailProgress.completed < thumbnailProgress.total
                  ? `Miniature ${thumbnailProgress.completed}/${thumbnailProgress.total}`
                  : "Seleziona file, regola il pattern e applica la rinomina."}
        </span>
      </div>
    </div>
  );
}
