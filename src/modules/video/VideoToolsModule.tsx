import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import "../../App.css";
import "./video.css";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type {
  AppSettings,
  CompressVideoResult,
  ExtractVideoFrameResult,
  VideoModuleSettings,
  VideoToolStatus,
} from "../../types";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

type PosterFormat = "png" | "jpeg";

interface VideoPreset {
  id: string;
  name: string;
  description: string;
  targetPercent: number;
  reductionHint: string;
  estimatedMultiplier: number;
  backendPreset: "draft" | "balanced" | "quality";
}

interface VideoSourceItem {
  path: string;
  filename: string;
  sizeBytes: number;
  presetId: string;
  posterTime: string;
  lastResult: CompressVideoResult | null;
}

const VIDEO_PRESETS: VideoPreset[] = [
  {
    id: "pct-60",
    name: "60%",
    description: "Taglio aggressivo per preview e background leggeri",
    targetPercent: 60,
    reductionHint: "-40%",
    estimatedMultiplier: 0.6,
    backendPreset: "draft",
  },
  {
    id: "pct-70",
    name: "70%",
    description: "Compromesso rapido per embed e social",
    targetPercent: 70,
    reductionHint: "-30%",
    estimatedMultiplier: 0.7,
    backendPreset: "balanced",
  },
  {
    id: "pct-80",
    name: "80%",
    description: "Equilibrato per la maggior parte dei video web",
    targetPercent: 80,
    reductionHint: "-20%",
    estimatedMultiplier: 0.8,
    backendPreset: "balanced",
  },
  {
    id: "pct-90",
    name: "90%",
    description: "Qualita piu alta per portfolio e showcase",
    targetPercent: 90,
    reductionHint: "-10%",
    estimatedMultiplier: 0.9,
    backendPreset: "quality",
  },
];

const DEFAULT_VIDEO_SETTINGS: VideoModuleSettings = {
  selectedPresetId: "pct-80",
  outputPath: null,
  muteAudio: false,
  extractFrameAt: 1,
};

const DEFAULT_FFMPEG_STATUS: VideoToolStatus = {
  installed: false,
  binaryPath: null,
  version: null,
  message: "Stato FFmpeg non ancora verificato.",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
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

function fileNameFromPath(path: string): string {
  return path.split(/[/\\]/).filter(Boolean).pop() || path;
}

function stemFromFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) {
    return filename;
  }
  return filename.slice(0, dotIndex);
}

function estimateOutputBytes(sizeBytes: number, presetId: string): number {
  const preset = VIDEO_PRESETS.find((item) => item.id === presetId) ?? VIDEO_PRESETS[2];
  return Math.max(1, Math.round(sizeBytes * preset.estimatedMultiplier));
}

function presetById(presetId: string): VideoPreset {
  return VIDEO_PRESETS.find((preset) => preset.id === presetId) ?? VIDEO_PRESETS[2];
}

function secondsToTimestamp(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, "0")).join(":");
}

function timestampToSeconds(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 1;
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.max(0, Number(trimmed));
  }

  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    return 1;
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  return 1;
}

export default function VideoToolsModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [sources, setSources] = useState<VideoSourceItem[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [globalPresetId, setGlobalPresetId] = useState(DEFAULT_VIDEO_SETTINGS.selectedPresetId);
  const [posterTime, setPosterTime] = useState(secondsToTimestamp(DEFAULT_VIDEO_SETTINGS.extractFrameAt));
  const [posterFormat, setPosterFormat] = useState<PosterFormat>("png");
  const [outputDir, setOutputDir] = useState<string | null>(DEFAULT_VIDEO_SETTINGS.outputPath);
  const [ffmpegStatus, setFfmpegStatus] = useState<VideoToolStatus>(DEFAULT_FFMPEG_STATUS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  const [posterBusy, setPosterBusy] = useState(false);
  const hydratedRef = useRef(false);

  const selectedSource = useMemo(
    () => sources.find((source) => source.path === selectedPath) ?? sources[0] ?? null,
    [selectedPath, sources]
  );

  const activePreset = useMemo(() => presetById(globalPresetId), [globalPresetId]);
  const completedResults = useMemo(
    () => sources.flatMap((source) => (source.lastResult ? [source.lastResult] : [])),
    [sources]
  );

  const totalSourceBytes = useMemo(
    () => sources.reduce((total, source) => total + source.sizeBytes, 0),
    [sources]
  );

  const projectedOutputBytes = useMemo(
    () =>
      sources.reduce(
        (total, source) => total + (source.lastResult?.outputSize ?? estimateOutputBytes(source.sizeBytes, source.presetId)),
        0
      ),
    [sources]
  );

  const outputWeightMode = useMemo(() => {
    if (sources.length === 0) {
      return "idle";
    }
    if (completedResults.length === sources.length) {
      return "reale";
    }
    return "stimato";
  }, [completedResults.length, sources.length]);

  const compressionReduction = useMemo(() => {
    if (totalSourceBytes === 0) {
      return 0;
    }
    return Math.max(0, Math.round((1 - projectedOutputBytes / totalSourceBytes) * 100));
  }, [projectedOutputBytes, totalSourceBytes]);

  const selectedPresetCount = useMemo(
    () => new Set(sources.map((source) => source.presetId)).size,
    [sources]
  );

  const selectedSourceOutputSize = selectedSource
    ? selectedSource.lastResult?.outputSize ?? estimateOutputBytes(selectedSource.sizeBytes, selectedSource.presetId)
    : 0;
  const selectedSourceWeightMode = selectedSource?.lastResult ? "reale" : selectedSource ? "stimato" : "idle";
  const selectedPosterTime = selectedSource?.posterTime ?? posterTime;

  useEffect(() => {
    if (!initialSettings || hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    const loaded = initialSettings.lastVideoOptions || DEFAULT_VIDEO_SETTINGS;
    setGlobalPresetId(loaded.selectedPresetId || DEFAULT_VIDEO_SETTINGS.selectedPresetId);
    setOutputDir(loaded.outputPath || null);
    setPosterTime(secondsToTimestamp(loaded.extractFrameAt || DEFAULT_VIDEO_SETTINGS.extractFrameAt));
  }, [initialSettings]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    onSettingsChange({
      lastVideoOptions: {
        selectedPresetId: globalPresetId,
        outputPath: outputDir,
        muteAudio: false,
        extractFrameAt: Math.max(0, Math.round(timestampToSeconds(selectedPosterTime))),
      },
    });
  }, [globalPresetId, onSettingsChange, outputDir, selectedPosterTime]);

  useEffect(() => {
    if (!selectedPath && sources.length > 0) {
      setSelectedPath(sources[0].path);
      return;
    }

    if (selectedPath && !sources.some((source) => source.path === selectedPath)) {
      setSelectedPath(sources[0]?.path ?? null);
    }
  }, [selectedPath, sources]);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;

    const checkStatus = async () => {
      try {
        const status = await invoke<VideoToolStatus>("get_ffmpeg_status");
        if (!cancelled) {
          setFfmpegStatus(status);
        }
      } catch (error) {
        if (!cancelled) {
          setFfmpegStatus({
            installed: false,
            binaryPath: null,
            version: null,
            message: getErrorMessage(error, "FFmpeg non rilevato."),
          });
        }
      }
    };

    void checkStatus();

    return () => {
      cancelled = true;
    };
  }, [active]);

  const addVideos = async () => {
    const selected = await open({
      multiple: true,
      directory: false,
      filters: [
        {
          name: "Video",
          extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv", "3gp"],
        },
      ],
    });

    if (!selected) {
      return;
    }

    const paths = Array.isArray(selected) ? selected : [selected];
    const nextItems = await Promise.all(
      paths.map(async (path) => {
        let sizeBytes = 0;
        try {
          const info = await stat(path);
          sizeBytes = Number(info.size ?? 0);
        } catch {
          sizeBytes = 0;
        }

        return {
          path,
          filename: fileNameFromPath(path),
          sizeBytes,
          presetId: globalPresetId,
          posterTime,
          lastResult: null,
        } satisfies VideoSourceItem;
      })
    );

    setSources((current) => {
      const byPath = new Map(current.map((item) => [item.path, item]));
      for (const item of nextItems) {
        byPath.set(item.path, byPath.get(item.path) ?? item);
      }
      return Array.from(byPath.values());
    });
    setStatusMessage(`${paths.length} video aggiunti alla coda.`);
    setStatusTone("success");
  };

  const chooseOutputDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: outputDir || undefined,
    });

    if (!selected || typeof selected !== "string") {
      return;
    }

    setOutputDir(selected);
  };

  const updateSourcePreset = (path: string, presetId: string) => {
    setSources((current) =>
      current.map((source) =>
        source.path === path ? { ...source, presetId, lastResult: null } : source
      )
    );
  };

  const updateSourcePosterTime = (path: string, nextPosterTime: string) => {
    setPosterTime(nextPosterTime);
    setSources((current) =>
      current.map((source) =>
        source.path === path ? { ...source, posterTime: nextPosterTime } : source
      )
    );
  };

  const applyGlobalPresetToAll = () => {
    setSources((current) =>
      current.map((source) => ({
        ...source,
        presetId: globalPresetId,
        lastResult: null,
      }))
    );
    setStatusMessage(`Preset ${activePreset.name} applicato a tutti i file.`);
    setStatusTone("success");
  };

  const removeSource = (path: string) => {
    setSources((current) => current.filter((source) => source.path !== path));
    setSelectedPath((current) => (current === path ? null : current));
  };

  const refreshFfmpegStatus = async () => {
    try {
      const status = await invoke<VideoToolStatus>("get_ffmpeg_status");
      setFfmpegStatus(status);
    } catch (error) {
      setFfmpegStatus({
        installed: false,
        binaryPath: null,
        version: null,
        message: getErrorMessage(error, "FFmpeg non rilevato."),
      });
    }
  };

  const compressVideos = async () => {
    if (sources.length === 0) {
      setStatusMessage("Aggiungi almeno un video prima di comprimere.");
      setStatusTone("error");
      return;
    }

    if (!outputDir) {
      setStatusMessage("Scegli una cartella di output prima di comprimere.");
      setStatusTone("error");
      return;
    }

    if (!ffmpegStatus.installed) {
      setStatusMessage(ffmpegStatus.message || "FFmpeg non disponibile. Installalo prima di comprimere.");
      setStatusTone("error");
      return;
    }

    setBusy(true);
    setStatusMessage(null);
    setStatusTone(null);

    const nextResults = new Map<string, CompressVideoResult>();
    const failures: string[] = [];

    try {
      for (let index = 0; index < sources.length; index += 1) {
        const source = sources[index];
        setStatusMessage(`Compressione ${index + 1}/${sources.length}: ${source.filename}`);
        setStatusTone(null);

        try {
          const result = await invoke<CompressVideoResult>("compress_video", {
            request: {
              inputPath: source.path,
              outputDir,
              preset: presetById(source.presetId).backendPreset,
              overwrite: true,
            },
          });
          nextResults.set(source.path, result);
        } catch (error) {
          failures.push(`${source.filename}: ${getErrorMessage(error, "Errore compressione")}`);
        }
      }

      setSources((current) =>
        current.map((source) => ({
          ...source,
          lastResult: nextResults.get(source.path) ?? source.lastResult,
        }))
      );

      const resultList = Array.from(nextResults.values());
      const outputBytes = resultList.reduce((total, result) => total + result.outputSize, 0);
      const inputBytes = resultList.reduce((total, result) => total + result.inputSize, 0);

      if (resultList.length > 0) {
        const baseMessage = `Compressi ${resultList.length}/${sources.length} video · ${formatBytes(inputBytes)} -> ${formatBytes(outputBytes)}.`;
        const failureSuffix = failures.length > 0 ? ` Primo errore: ${failures[0]}` : "";
        setStatusMessage(`${baseMessage}${failureSuffix}`);
        setStatusTone(failures.length > 0 ? "error" : "success");
      } else {
        setStatusMessage(failures[0] || "Compressione non eseguita.");
        setStatusTone("error");
      }
    } finally {
      setBusy(false);
    }
  };

  const extractPosterFrame = async () => {
    if (!selectedSource) {
      setStatusMessage("Seleziona un video per estrarre il poster frame.");
      setStatusTone("error");
      return;
    }

    const selected = await save({
      defaultPath: `${stemFromFilename(selectedSource.filename)}-poster.${posterFormat}`,
      filters: [
        {
          name: posterFormat.toUpperCase(),
          extensions: [posterFormat],
        },
      ],
    });

    if (!selected) {
      return;
    }

    setPosterBusy(true);
    setStatusMessage(null);
    setStatusTone(null);

    try {
      const result = await invoke<ExtractVideoFrameResult>("extract_frame", {
        request: {
          inputPath: selectedSource.path,
          outputPath: selected,
          timestampSeconds: timestampToSeconds(selectedPosterTime),
          imageFormat: posterFormat,
          overwrite: true,
        },
      });

      setStatusMessage(
        `Poster frame estratto da ${selectedSource.filename} · ${formatBytes(result.bytes)}.`
      );
      setStatusTone("success");
    } catch (error) {
      console.error("Errore estrazione frame:", error);
      setStatusMessage(getErrorMessage(error, "Impossibile estrarre il poster frame."));
      setStatusTone("error");
    } finally {
      setPosterBusy(false);
    }
  };

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo video-logo">V</div>
          <div className="header-brand-copy">
            <h1>Video<span>Tools</span></h1>
            <span className="header-subtitle">Compressione FFmpeg, target per-file ed estrazione frame</span>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={() => void addVideos()}>
            + File
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void chooseOutputDirectory()}>
            Output...
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void extractPosterFrame()}
            disabled={posterBusy}
          >
            {posterBusy ? "Estrazione..." : "Estrai frame"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void compressVideos()} disabled={busy}>
            {busy ? "Compressione..." : "Comprimi batch"}
          </button>
        </div>
      </header>

      <ResizableModuleLayout
        storageKey="toolbox-layout-video-v1"
        defaultLeftWidth={330}
        defaultRightWidth={360}
        leftMinWidth={290}
        leftMaxWidth={460}
        rightMinWidth={320}
        rightMaxWidth={520}
        centerMinWidth={420}
        left={
          <>
            <div className="panel-title">Preset Compressione</div>
            <div className="video-panel">
              <div className="video-section">
                <span className="video-section-title">Preset globali</span>
                <div className="video-preset-grid">
                  {VIDEO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`video-preset-chip ${globalPresetId === preset.id ? "active" : ""}`}
                      onClick={() => setGlobalPresetId(preset.id)}
                    >
                      <strong>{preset.name}</strong>
                      <span>{preset.targetPercent}% · {preset.reductionHint}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-small-inline" onClick={applyGlobalPresetToAll}>
                  Applica a tutti
                </button>
              </div>

              <div className="video-section">
                <span className="video-section-title">FFmpeg</span>
                <div className={`video-status-card ${ffmpegStatus.installed ? "success" : "warning"}`}>
                  <strong>{ffmpegStatus.installed ? "FFmpeg disponibile" : "FFmpeg non rilevato"}</strong>
                  <span>{ffmpegStatus.version || ffmpegStatus.message || "In attesa di verifica..."}</span>
                  {ffmpegStatus.binaryPath ? <code>{ffmpegStatus.binaryPath}</code> : null}
                </div>
                <button type="button" className="btn btn-secondary btn-small-inline" onClick={() => void refreshFfmpegStatus()}>
                  Verifica stato
                </button>
              </div>

              <div className="video-section">
                <span className="video-section-title">Riepilogo rapido</span>
                <div className="video-metrics">
                  <div className="video-metric">
                    <strong>{sources.length}</strong>
                    <span>video in coda</span>
                  </div>
                  <div className="video-metric">
                    <strong>{selectedPresetCount}</strong>
                    <span>tagli attivi</span>
                  </div>
                  <div className="video-metric">
                    <strong>{formatBytes(totalSourceBytes)}</strong>
                    <span>peso sorgente</span>
                  </div>
                  <div className="video-metric">
                    <strong>{formatBytes(projectedOutputBytes)}</strong>
                    <span>peso finale {outputWeightMode === "reale" ? "reale" : "stimato"}</span>
                  </div>
                </div>
              </div>

              {statusMessage ? (
                <div className={`video-status-banner ${statusTone === "error" ? "error" : "success"}`}>
                  {statusMessage}
                </div>
              ) : null}
            </div>
          </>
        }
        center={
          <>
            <div className="panel-title">File Video</div>
            <div className="video-file-list">
              {sources.length > 0 ? (
                sources.map((source) => {
                  const preset = presetById(source.presetId);
                  const outputBytes = source.lastResult?.outputSize ?? estimateOutputBytes(source.sizeBytes, source.presetId);
                  const reduction = source.sizeBytes > 0
                    ? Math.max(0, Math.round((1 - outputBytes / source.sizeBytes) * 100))
                    : 0;

                  return (
                    <button
                      key={source.path}
                      type="button"
                      className={`video-file-card ${selectedSource?.path === source.path ? "active" : ""}`}
                      onClick={() => setSelectedPath(source.path)}
                    >
                      <div className="video-file-top">
                        <div className="video-file-copy">
                          <strong title={source.filename}>{source.filename}</strong>
                          <span>
                            {formatBytes(source.sizeBytes)} · {preset.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm video-card-remove"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeSource(source.path);
                          }}
                        >
                          Rimuovi
                        </button>
                      </div>

                      <div className="video-file-meta">
                        <span>{preset.targetPercent}% target</span>
                        <span>{source.lastResult ? source.lastResult.presetLabel : preset.description}</span>
                        <span>{source.lastResult ? "Peso reale" : "Peso stimato"} {formatBytes(outputBytes)}</span>
                      </div>

                      <div className="video-file-controls">
                        <label className="video-field">
                          <span>Compressione per file</span>
                          <select
                            className="profile-name-input"
                            value={source.presetId}
                            onChange={(event) => updateSourcePreset(source.path, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {VIDEO_PRESETS.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} · {item.description}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="video-field">
                          <span>Poster frame</span>
                          <input
                            className="profile-name-input"
                            type="text"
                            value={source.posterTime}
                            onChange={(event) => updateSourcePosterTime(source.path, event.target.value)}
                            onClick={(event) => event.stopPropagation()}
                            placeholder="00:00:05"
                          />
                        </label>
                      </div>

                      <div className="video-file-footer">
                        <span title={source.path}>{source.path}</span>
                        <span>{reduction > 0 ? `-${reduction}% sul file` : "Riduzione non stimata"}</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="video-empty-state">
                  <strong>Nessun video caricato</strong>
                  <span>Aggiungi uno o piu file per costruire una coda di compressione web.</span>
                </div>
              )}
            </div>
          </>
        }
        right={
          <>
            <div className="panel-title">Anteprima & Summary</div>
            <div className="video-preview-card">
              <div className="video-preview-stage">
                <div className="video-preview-badge">
                  {selectedSourceWeightMode === "reale" ? "Peso reale" : "Peso stimato"}
                </div>
                <strong>{selectedSource ? selectedSource.filename : "Seleziona un video"}</strong>
                <span>
                  {selectedSource
                    ? `${formatBytes(selectedSource.sizeBytes)} · target ${selectedPosterTime} · ${presetById(selectedSource.presetId).name}`
                    : "Qui mostriamo il file attivo e il target di estrazione"}
                </span>
                {selectedSource ? (
                  <span>
                    Peso finale {selectedSourceWeightMode === "reale" ? "reale" : "stimato"}: {formatBytes(selectedSourceOutputSize)} · poster {posterFormat.toUpperCase()}
                  </span>
                ) : null}
              </div>

              <div className="video-summary-block">
                <span className="video-section-title">Estrazione frame</span>
                <label className="video-field">
                  <span>Timestamp</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={selectedPosterTime}
                    onChange={(event) => {
                      if (selectedSource) {
                        updateSourcePosterTime(selectedSource.path, event.target.value);
                      } else {
                        setPosterTime(event.target.value);
                      }
                    }}
                    placeholder="00:00:05"
                  />
                </label>
                <label className="video-field">
                  <span>Formato output</span>
                  <div className="video-toggle-row">
                    {(["png", "jpeg"] as PosterFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        className={`format-btn ${posterFormat === format ? "active" : ""}`}
                        onClick={() => setPosterFormat(format)}
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            </div>

            <div className="video-summary-card">
              <div className="video-summary-row">
                <span>Preset attivo</span>
                <strong>{activePreset.name}</strong>
              </div>
              <div className="video-summary-row">
                <span>Target</span>
                <strong>{activePreset.targetPercent}%</strong>
              </div>
              <div className="video-summary-row">
                <span>Output</span>
                <strong>{outputDir || "Nessuna cartella scelta"}</strong>
              </div>
              <div className="video-summary-row">
                <span>Peso finale</span>
                <strong>{formatBytes(projectedOutputBytes)}</strong>
              </div>
              <div className="video-summary-row">
                <span>Riduzione media</span>
                <strong>{compressionReduction}%</strong>
              </div>
              <div className="video-summary-row">
                <span>Modalita</span>
                <strong>{outputWeightMode === "reale" ? "Dati reali" : outputWeightMode === "stimato" ? "Stima attiva" : "In attesa"}</strong>
              </div>
            </div>

            <div className="video-steps-card">
              <span className="video-section-title">Flusso consigliato</span>
              <ol className="video-steps-list">
                <li>Aggiungi i video e scegli il target per ogni file.</li>
                <li>Seleziona l&apos;output e verifica FFmpeg.</li>
                <li>Comprimi il batch oppure estrai un poster frame dal video attivo.</li>
              </ol>
            </div>
          </>
        }
      />
    </div>
  );
}
