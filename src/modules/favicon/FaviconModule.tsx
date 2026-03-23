import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "../../App.css";
import "./favicon.css";
import BatchProgress from "../../components/BatchProgress";
import ImagePreview from "../../components/ImagePreview";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type {
  AppSettings,
  ConvertSummary,
  FaviconGeneratedFile,
  FaviconModuleSettings,
  GenerateFaviconsResult,
  ImageInfo,
  ThumbnailHydrationProgress,
} from "../../types";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

interface PlannedOutputItem {
  label: string;
  filename: string;
  size: string;
}

const DEFAULT_FAVICON_SETTINGS: FaviconModuleSettings = {
  appName: "Toolbox Creative Studio",
  shortName: "Toolbox",
  assetPath: "/",
  themeColor: "#111827",
  backgroundColor: "#ffffff",
  paddingPercent: 10,
  transparentBackground: true,
  includeManifest: true,
  includeAppleTouch: true,
  includeIco: true,
  includeAndroidIcons: true,
};

function dedupePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
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

function normalizeAssetPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
  return withoutTrailingSlash.startsWith("/")
    ? `${withoutTrailingSlash}/`
    : `/${withoutTrailingSlash}/`;
}

function joinAssetPath(base: string, filename: string): string {
  return base === "/" ? `/${filename}` : `${base}${filename}`;
}

function buildSnippetPreview(settings: FaviconModuleSettings): string {
  const assetPath = normalizeAssetPath(settings.assetPath);
  const lines: string[] = [];

  if (settings.includeIco) {
    lines.push(
      `<link rel="icon" href="${joinAssetPath(assetPath, "favicon.ico")}" sizes="any">`
    );
  }

  lines.push(
    `<link rel="icon" type="image/png" sizes="32x32" href="${joinAssetPath(assetPath, "favicon-32x32.png")}">`
  );
  lines.push(
    `<link rel="icon" type="image/png" sizes="16x16" href="${joinAssetPath(assetPath, "favicon-16x16.png")}">`
  );

  if (settings.includeAppleTouch) {
    lines.push(
      `<link rel="apple-touch-icon" sizes="180x180" href="${joinAssetPath(assetPath, "apple-touch-icon.png")}">`
    );
  }

  if (settings.includeManifest) {
    lines.push(
      `<link rel="manifest" href="${joinAssetPath(assetPath, "site.webmanifest")}">`
    );
  }

  lines.push(`<meta name="theme-color" content="${settings.themeColor}">`);
  return lines.join("\n");
}

function buildPlannedOutputs(settings: FaviconModuleSettings): PlannedOutputItem[] {
  const items: PlannedOutputItem[] = [
    { label: "PNG 16", filename: "favicon-16x16.png", size: "16x16" },
    { label: "PNG 32", filename: "favicon-32x32.png", size: "32x32" },
  ];

  if (settings.includeAppleTouch) {
    items.push({
      label: "Apple Touch",
      filename: "apple-touch-icon.png",
      size: "180x180",
    });
  }

  if (settings.includeAndroidIcons || settings.includeManifest) {
    items.push(
      {
        label: "Android 192",
        filename: "android-chrome-192x192.png",
        size: "192x192",
      },
      {
        label: "Android 512",
        filename: "android-chrome-512x512.png",
        size: "512x512",
      }
    );
  }

  if (settings.includeIco) {
    items.push({ label: "ICO", filename: "favicon.ico", size: "16/32/48" });
  }

  if (settings.includeManifest) {
    items.push({ label: "Manifest", filename: "site.webmanifest", size: "JSON" });
  }

  return items;
}

function buildSummaryFromResult(result: GenerateFaviconsResult): ConvertSummary {
  const totalOutputSize = result.files.reduce((total, file) => total + file.bytes, 0);
  return {
    total_files: 1,
    total_operations: result.files.length,
    successful: result.files.length,
    failed: 0,
    total_input_size: result.sourceSize,
    total_output_size: totalOutputSize,
    results: result.files.map((file) => ({
      filename: file.filename,
      source_path: result.sourcePath,
      success: true,
      input_size: result.sourceSize,
      output_size: file.bytes,
      output_path: file.path,
      error: null,
    })),
  };
}

function FaviconSourceCard({
  image,
  active,
  onSelect,
}: {
  image: ImageInfo;
  active: boolean;
  onSelect: (path: string) => void;
}) {
  return (
    <button
      type="button"
      className={`favicon-source-card ${active ? "active" : ""} ${image.error ? "has-error" : ""}`}
      onClick={() => onSelect(image.path)}
    >
      <div className="favicon-source-thumb">
        {image.thumbnail_base64 ? (
          <img src={image.thumbnail_base64} alt={image.filename} loading="lazy" />
        ) : (
          <div className="favicon-source-placeholder">
            {image.error ? "!" : "Anteprima"}
          </div>
        )}
      </div>
      <div className="favicon-source-info">
        <strong title={image.filename}>{image.filename}</strong>
        <span>
          {image.width > 0 ? `${image.width}x${image.height}` : "Errore lettura"} · {formatBytes(image.size)}
        </span>
        <span className="favicon-source-format">{image.format}</span>
      </div>
    </button>
  );
}

export default function FaviconModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [appName, setAppName] = useState(DEFAULT_FAVICON_SETTINGS.appName);
  const [shortName, setShortName] = useState(DEFAULT_FAVICON_SETTINGS.shortName);
  const [assetPath, setAssetPath] = useState(DEFAULT_FAVICON_SETTINGS.assetPath);
  const [themeColor, setThemeColor] = useState(DEFAULT_FAVICON_SETTINGS.themeColor);
  const [backgroundColor, setBackgroundColor] = useState(DEFAULT_FAVICON_SETTINGS.backgroundColor);
  const [paddingPercent, setPaddingPercent] = useState(DEFAULT_FAVICON_SETTINGS.paddingPercent);
  const [transparentBackground, setTransparentBackground] = useState(DEFAULT_FAVICON_SETTINGS.transparentBackground);
  const [includeManifest, setIncludeManifest] = useState(DEFAULT_FAVICON_SETTINGS.includeManifest);
  const [includeAppleTouch, setIncludeAppleTouch] = useState(DEFAULT_FAVICON_SETTINGS.includeAppleTouch);
  const [includeIco, setIncludeIco] = useState(DEFAULT_FAVICON_SETTINGS.includeIco);
  const [includeAndroidIcons, setIncludeAndroidIcons] = useState(DEFAULT_FAVICON_SETTINGS.includeAndroidIcons);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [selectedSourcePath, setSelectedSourcePath] = useState<string | null>(null);
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ConvertSummary | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<ThumbnailHydrationProgress | null>(null);
  const [generated, setGenerated] = useState<GenerateFaviconsResult | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);
  const [snippetStatus, setSnippetStatus] = useState<string | null>(null);
  const [snippetStatusTone, setSnippetStatusTone] = useState<"success" | "error" | null>(null);

  const hydratedRef = useRef(false);
  const autoLoadedRef = useRef(false);
  const imagesRef = useRef<ImageInfo[]>([]);
  const inputPathsRef = useRef<string[]>([]);
  const thumbQueueRef = useRef<string[]>([]);
  const thumbInflightRef = useRef(new Set<string>());
  const thumbLoadedRef = useRef(new Set<string>());
  const thumbFailedRef = useRef(new Set<string>());
  const thumbTimerRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  const settingsSnapshot = useMemo<FaviconModuleSettings>(
    () => ({
      appName,
      shortName,
      assetPath,
      themeColor,
      backgroundColor,
      paddingPercent,
      transparentBackground,
      includeManifest,
      includeAppleTouch,
      includeIco,
      includeAndroidIcons,
    }),
    [
      appName,
      assetPath,
      backgroundColor,
      includeAndroidIcons,
      includeAppleTouch,
      includeIco,
      includeManifest,
      paddingPercent,
      shortName,
      themeColor,
      transparentBackground,
    ]
  );

  const previewImage = useMemo(
    () => images.find((image) => image.path === selectedSourcePath) ?? images.find((image) => !image.error) ?? null,
    [images, selectedSourcePath]
  );

  const plannedOutputs = useMemo(
    () => buildPlannedOutputs(settingsSnapshot),
    [settingsSnapshot]
  );

  const snippetPreview = useMemo(
    () => generated?.htmlSnippet ?? buildSnippetPreview(settingsSnapshot),
    [generated?.htmlSnippet, settingsSnapshot]
  );

  const updateThumbnailProgress = useCallback((nextImages: ImageInfo[], currentPath: string | null = null) => {
    setThumbnailProgress(buildThumbnailProgress(nextImages, currentPath, thumbFailedRef.current));
  }, []);

  const resetThumbnailState = useCallback(() => {
    thumbQueueRef.current = [];
    thumbInflightRef.current.clear();
    thumbLoadedRef.current.clear();
    thumbFailedRef.current.clear();
    if (thumbTimerRef.current !== null) {
      window.clearTimeout(thumbTimerRef.current);
      thumbTimerRef.current = null;
    }
    setThumbnailProgress(null);
  }, []);

  useEffect(() => {
    if (!initialSettings || hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    if (initialSettings.lastOutputPath) {
      setOutputPath(initialSettings.lastOutputPath);
    }
    if (initialSettings.lastInputPaths?.length) {
      setInputPaths(initialSettings.lastInputPaths);
    }

    const faviconSettings = initialSettings.lastFaviconOptions;
    if (faviconSettings) {
      setAppName(faviconSettings.appName || DEFAULT_FAVICON_SETTINGS.appName);
      setShortName(faviconSettings.shortName || DEFAULT_FAVICON_SETTINGS.shortName);
      setAssetPath(faviconSettings.assetPath || DEFAULT_FAVICON_SETTINGS.assetPath);
      setThemeColor(faviconSettings.themeColor || DEFAULT_FAVICON_SETTINGS.themeColor);
      setBackgroundColor(faviconSettings.backgroundColor || DEFAULT_FAVICON_SETTINGS.backgroundColor);
      setPaddingPercent(
        typeof faviconSettings.paddingPercent === "number"
          ? faviconSettings.paddingPercent
          : DEFAULT_FAVICON_SETTINGS.paddingPercent
      );
      setTransparentBackground(faviconSettings.transparentBackground ?? DEFAULT_FAVICON_SETTINGS.transparentBackground);
      setIncludeManifest(faviconSettings.includeManifest ?? DEFAULT_FAVICON_SETTINGS.includeManifest);
      setIncludeAppleTouch(faviconSettings.includeAppleTouch ?? DEFAULT_FAVICON_SETTINGS.includeAppleTouch);
      setIncludeIco(faviconSettings.includeIco ?? DEFAULT_FAVICON_SETTINGS.includeIco);
      setIncludeAndroidIcons(faviconSettings.includeAndroidIcons ?? DEFAULT_FAVICON_SETTINGS.includeAndroidIcons);
    }
  }, [initialSettings]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    inputPathsRef.current = inputPaths;
  }, [inputPaths]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      onSettingsChange({
        lastInputPaths: inputPaths,
        lastOutputPath: outputPath,
        lastFaviconOptions: settingsSnapshot,
      });
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [inputPaths, onSettingsChange, outputPath, settingsSnapshot]);

  useEffect(() => {
    if (!active || autoLoadedRef.current || inputPaths.length === 0 || images.length > 0) {
      return;
    }

    autoLoadedRef.current = true;
    void runScan(inputPaths, "replace");
  }, [active, images.length, inputPaths]);

  const loadThumbnail = useCallback(async (path: string) => {
    try {
      const thumbnail = await invoke<string>("load_thumbnail", {
        path,
        maxSize: 256,
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
      console.error("Errore thumbnail favicon:", error);
    } finally {
      thumbInflightRef.current.delete(path);
      if (thumbInflightRef.current.size === 0 && thumbQueueRef.current.length === 0) {
        updateThumbnailProgress(imagesRef.current, null);
      }
      void flushThumbnailQueue();
    }
  }, [updateThumbnailProgress]);

  const flushThumbnailQueue = useCallback(async () => {
    while (thumbInflightRef.current.size < 4 && thumbQueueRef.current.length > 0) {
      const nextPath = thumbQueueRef.current.shift();
      if (
        !nextPath ||
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
  }, [loadThumbnail, updateThumbnailProgress]);

  useEffect(() => {
    const missing = images
      .filter(
        (image) =>
          !image.error &&
          !image.thumbnail_base64 &&
          !thumbLoadedRef.current.has(image.path) &&
          !thumbFailedRef.current.has(image.path)
      )
      .map((image) => image.path);

    if (images.length === 0) {
      resetThumbnailState();
      return;
    }

    updateThumbnailProgress(images, thumbnailProgress?.currentPath || null);

    if (missing.length === 0) {
      return;
    }

    const priorityPaths = images
      .slice(0, 12)
      .filter(
        (image) =>
          !image.error &&
          !image.thumbnail_base64 &&
          !thumbLoadedRef.current.has(image.path) &&
          !thumbFailedRef.current.has(image.path)
      )
      .map((image) => image.path);

    const rest = missing.filter((path) => !priorityPaths.includes(path));
    thumbQueueRef.current = dedupePaths([...priorityPaths, ...thumbQueueRef.current, ...rest]);

    if (thumbTimerRef.current === null) {
      thumbTimerRef.current = window.setTimeout(() => {
        thumbTimerRef.current = null;
        void flushThumbnailQueue();
      }, 20);
    }
  }, [flushThumbnailQueue, images, resetThumbnailState, thumbnailProgress?.currentPath, updateThumbnailProgress]);

  const runScan = useCallback(async (paths: string[], mode: "replace" | "append") => {
    const normalizedPaths = dedupePaths(paths);
    if (normalizedPaths.length === 0) {
      if (mode === "replace") {
        resetThumbnailState();
        setImages([]);
        setSelectedSourcePath(null);
      }
      return;
    }

    setScanning(true);
    setSummary(null);
    setGenerated(null);
    setStatusMessage(null);
    setStatusTone(null);
    resetThumbnailState();

    try {
      const rememberedPaths =
        mode === "replace"
          ? normalizedPaths
          : dedupePaths([...inputPathsRef.current, ...normalizedPaths]);
      const scanned = await invoke<ImageInfo[]>("scan_paths", {
        paths: normalizedPaths,
        rememberedPaths,
      });

      setImages((current) => {
        const nextImages =
          mode === "replace"
            ? scanned
            : Array.from(
                new Map([...current, ...scanned].map((image) => [image.path, image])).values()
              ).sort((a, b) => a.filename.localeCompare(b.filename));

        const nextSelected =
          nextImages.find((image) => image.path === selectedSourcePath)?.path ??
          nextImages.find((image) => !image.error)?.path ??
          nextImages[0]?.path ??
          null;

        setSelectedSourcePath(nextSelected);
        updateThumbnailProgress(nextImages);
        return nextImages;
      });
    } catch (error) {
      console.error("Errore scansione favicon:", error);
      setStatusMessage(getErrorMessage(error, "Impossibile leggere i percorsi selezionati."));
      setStatusTone("error");
    } finally {
      setScanning(false);
    }
  }, [resetThumbnailState, selectedSourcePath, updateThumbnailProgress]);

  const addFiles = async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Immagini",
          extensions: ["jpg", "jpeg", "png", "heic", "heif", "tif", "tiff"],
        },
      ],
    });

    if (!selected) {
      return;
    }

    const paths = Array.isArray(selected) ? selected : [selected];
    const nextInputPaths = dedupePaths([...inputPaths, ...paths]);
    setInputPaths(nextInputPaths);
    await runScan(paths, "append");
  };

  const addFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (!selected || typeof selected !== "string") {
      return;
    }

    const nextInputPaths = dedupePaths([...inputPaths, selected]);
    setInputPaths(nextInputPaths);
    await runScan([selected], "append");
  };

  const chooseOutput = async (): Promise<string | null> => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: outputPath || undefined,
    });

    if (!selected || typeof selected !== "string") {
      return null;
    }

    setOutputPath(selected);
    return selected;
  };

  const openOutput = async () => {
    if (!outputPath) {
      const selected = await chooseOutput();
      if (!selected) {
        return;
      }
      await invoke("open_output_folder", { path: selected });
      return;
    }

    await invoke("open_output_folder", { path: outputPath });
  };

  const reloadInputs = async () => {
    if (inputPaths.length === 0) {
      return;
    }

    await runScan(inputPaths, "replace");
  };

  const clearAll = () => {
    resetThumbnailState();
    setImages([]);
    setSelectedSourcePath(null);
    setInputPaths([]);
    setSummary(null);
    setGenerated(null);
    setStatusMessage(null);
    setStatusTone(null);
    setSnippetStatus(null);
    setSnippetStatusTone(null);
  };

  const handleGenerate = async () => {
    if (!previewImage || previewImage.error) {
      setStatusMessage("Seleziona una sorgente valida per generare il pacchetto favicon.");
      setStatusTone("error");
      return;
    }

    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      finalOutputPath = await chooseOutput();
    }

    if (!finalOutputPath) {
      setStatusMessage("Scegli una cartella output per generare i favicon.");
      setStatusTone("error");
      return;
    }

    setLoading(true);
    setSummary(null);
    setGenerated(null);
    setStatusMessage(null);
    setStatusTone(null);

    try {
      const result = await invoke<GenerateFaviconsResult>("generate_favicons", {
        request: {
          sourcePath: previewImage.path,
          outputDir: finalOutputPath,
          appName,
          shortName,
          assetPath,
          themeColor,
          backgroundColor,
          paddingPercent,
          transparentBackground,
          includeManifest,
          includeAppleTouch,
          includeIco,
          includeAndroidIcons,
        },
      });

      setGenerated(result);
      setSummary(buildSummaryFromResult(result));
      setStatusMessage(
        `Pacchetto favicon generato: ${result.files.length} asset in ${result.outputDir}.`
      );
      setStatusTone("success");
    } catch (error) {
      console.error("Errore generazione favicon:", error);
      setStatusMessage(getErrorMessage(error, "Impossibile generare il pacchetto favicon."));
      setStatusTone("error");
    } finally {
      setLoading(false);
    }
  };

  const copySnippet = async () => {
    if (!snippetPreview) {
      setSnippetStatus("Non c'e' ancora uno snippet da copiare.");
      setSnippetStatusTone("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(snippetPreview);
      setSnippetStatus("Snippet head copiato negli appunti.");
      setSnippetStatusTone("success");
    } catch (error) {
      console.error("Errore copia snippet favicon:", error);
      setSnippetStatus("Impossibile copiare lo snippet.");
      setSnippetStatusTone("error");
    }
  };

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo favicon-logo">F</div>
          <div className="header-brand-copy">
            <h1>Favicon<span>Generator</span></h1>
            <span className="header-subtitle">Pacchetto favicon, manifest e snippet per Toolbox Creative Studio</span>
          </div>
        </div>
        <div className="header-actions">
          <button onClick={addFiles} className="btn btn-secondary">
            + File
          </button>
          <button onClick={addFolder} className="btn btn-secondary">
            + Cartella
          </button>
          <button
            onClick={reloadInputs}
            disabled={scanning || inputPaths.length === 0}
            className="btn btn-secondary"
          >
            {scanning ? "Scansione..." : "Ricarica"}
          </button>
          <button onClick={() => void chooseOutput()} className="btn btn-secondary">
            Output...
          </button>
          <button onClick={openOutput} className="btn btn-secondary">
            Apri Output
          </button>
        </div>
      </header>

      <ResizableModuleLayout
        storageKey="toolbox-layout-favicon-v1"
        defaultLeftWidth={312}
        defaultRightWidth={360}
        leftMinWidth={260}
        leftMaxWidth={420}
        rightMinWidth={320}
        rightMaxWidth={520}
        centerMinWidth={420}
        left={
          <>
            <div className="panel-title">Configurazione</div>
            <div className="favicon-panel">
              <div className="favicon-section">
                <label className="favicon-field">
                  <span>Nome app</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={appName}
                    onChange={(event) => setAppName(event.target.value)}
                    placeholder="Toolbox Creative Studio"
                  />
                </label>
                <label className="favicon-field">
                  <span>Nome breve</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={shortName}
                    onChange={(event) => setShortName(event.target.value)}
                    placeholder="Toolbox"
                  />
                </label>
                <label className="favicon-field">
                  <span>Percorso asset</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={assetPath}
                    onChange={(event) => setAssetPath(event.target.value)}
                    placeholder="/"
                    spellCheck={false}
                  />
                </label>
              </div>

              <div className="favicon-section">
                <div className="favicon-color-grid">
                  <label className="favicon-color-field">
                    <span>Theme color</span>
                    <div className="favicon-color-input">
                      <input type="color" value={themeColor} onChange={(event) => setThemeColor(event.target.value)} />
                      <input
                        className="profile-name-input"
                        type="text"
                        value={themeColor}
                        onChange={(event) => setThemeColor(event.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                  <label className="favicon-color-field">
                    <span>Background</span>
                    <div className="favicon-color-input">
                      <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} />
                      <input
                        className="profile-name-input"
                        type="text"
                        value={backgroundColor}
                        onChange={(event) => setBackgroundColor(event.target.value)}
                        spellCheck={false}
                      />
                    </div>
                  </label>
                </div>

                <label className="favicon-slider-field">
                  <div className="favicon-slider-head">
                    <span>Padding interno</span>
                    <strong>{paddingPercent}%</strong>
                  </div>
                  <input
                    className="favicon-range"
                    type="range"
                    min={0}
                    max={35}
                    step={1}
                    value={paddingPercent}
                    onChange={(event) => setPaddingPercent(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="favicon-section">
                <span className="favicon-section-title">Asset inclusi</span>
                <label className="favicon-toggle">
                  <input
                    type="checkbox"
                    checked={transparentBackground}
                    onChange={(event) => setTransparentBackground(event.target.checked)}
                  />
                  <span>PNG base trasparenti</span>
                </label>
                <label className="favicon-toggle">
                  <input
                    type="checkbox"
                    checked={includeIco}
                    onChange={(event) => setIncludeIco(event.target.checked)}
                  />
                  <span>Genera `favicon.ico`</span>
                </label>
                <label className="favicon-toggle">
                  <input
                    type="checkbox"
                    checked={includeAppleTouch}
                    onChange={(event) => setIncludeAppleTouch(event.target.checked)}
                  />
                  <span>Genera `apple-touch-icon.png`</span>
                </label>
                <label className="favicon-toggle">
                  <input
                    type="checkbox"
                    checked={includeAndroidIcons}
                    onChange={(event) => setIncludeAndroidIcons(event.target.checked)}
                  />
                  <span>Genera icone Android 192/512</span>
                </label>
                <label className="favicon-toggle">
                  <input
                    type="checkbox"
                    checked={includeManifest}
                    onChange={(event) => setIncludeManifest(event.target.checked)}
                  />
                  <span>Genera `site.webmanifest`</span>
                </label>
              </div>

              <div className="favicon-section">
                <span className="favicon-section-title">Output previsto</span>
                <div className="favicon-output-list compact">
                  {plannedOutputs.map((item) => (
                    <div key={item.filename} className="favicon-output-item">
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.filename}</span>
                      </div>
                      <span>{item.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        }
        center={
          <div className="favicon-center">
            <div className="panel-title">Sorgente Principale</div>
            {images.length === 0 ? (
              <div className="favicon-empty-state">
                <div className="empty-icon">🧩</div>
                <p>Carica un logo o una sorgente quadrata ad alta risoluzione.</p>
                <span>
                  JPG, PNG, TIFF e HEIC sono supportati. Puoi anche aggiungere una cartella e scegliere poi la sorgente migliore.
                </span>
              </div>
            ) : (
              <div className="favicon-source-grid">
                {images.map((image) => (
                  <FaviconSourceCard
                    key={image.path}
                    image={image}
                    active={image.path === selectedSourcePath}
                    onSelect={setSelectedSourcePath}
                  />
                ))}
              </div>
            )}

            <div className="favicon-center-footer">
              <button className="btn btn-secondary" onClick={clearAll}>
                Svuota sessione
              </button>
              <div className="favicon-center-meta">
                <span>{images.length} sorgenti caricate</span>
                <span>{previewImage ? previewImage.filename : "Nessuna selezionata"}</span>
              </div>
            </div>
          </div>
        }
        right={
          <>
            <div className="panel-title">Preview & Snippet</div>
            <div className="favicon-right-stack">
              <ImagePreview image={previewImage} targetWidth={512} targetHeight={512} resizeMode="fit" />

              <div className="favicon-card">
                <div className="favicon-card-head">
                  <strong>Snippet &lt;head&gt;</strong>
                  <button className="btn btn-sm" onClick={copySnippet}>
                    Copia
                  </button>
                </div>
                <pre className="favicon-code-block">{snippetPreview || "Configura il pacchetto per vedere lo snippet."}</pre>
                {snippetStatus ? (
                  <p className={`favicon-status ${snippetStatusTone === "error" ? "error" : "success"}`}>
                    {snippetStatus}
                  </p>
                ) : null}
              </div>

              <div className="favicon-card">
                <div className="favicon-card-head">
                  <strong>Pacchetto generato</strong>
                  <span>{generated ? `${generated.files.length} file` : "In attesa"}</span>
                </div>
                {generated ? (
                  <div className="favicon-output-list">
                    {generated.files.map((file: FaviconGeneratedFile) => (
                      <div key={file.path} className="favicon-output-item">
                        <div>
                          <strong>{file.label}</strong>
                          <span>{file.filename}</span>
                        </div>
                        <span>{formatBytes(file.bytes)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="favicon-placeholder-text">
                    Dopo la generazione qui compariranno asset, pesi e percorso finale del pacchetto.
                  </p>
                )}
                {statusMessage ? (
                  <p className={`favicon-status ${statusTone === "error" ? "error" : "success"}`}>
                    {statusMessage}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                className="btn-convert"
                onClick={handleGenerate}
                disabled={loading || scanning || !previewImage}
              >
                {loading ? (
                  "GENERAZIONE..."
                ) : (
                  <>
                    GENERA FAVICON PACK
                    <span className="convert-count">{plannedOutputs.length} asset previsti</span>
                  </>
                )}
              </button>
            </div>
          </>
        }
      />

      <footer className="app-footer">
        <BatchProgress
          progress={null}
          summary={summary}
          loading={loading}
          scanProgress={null}
          scanning={scanning}
          thumbnailProgress={thumbnailProgress}
        />
      </footer>
    </div>
  );
}
