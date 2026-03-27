import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, save } from "@tauri-apps/plugin-dialog";
import type {
  AppSettings,
  ConvertJob,
  ConvertProgress,
  ConvertSummary,
  EstimateConvertResult,
  ExportOptimizeProfilesRequest,
  ImageInfo,
  ImportOptimizeProfilesResult,
  OptimizeProfile,
  OptimizeSettings,
  OutputFormat,
  Preset,
  ResizeMode,
  SaveOptimizeProfileRequest,
  ScanProgress,
  ThumbnailHydrationProgress,
} from "../types";
import BatchProgress from "../components/BatchProgress";
import ImageGrid from "../components/ImageGrid";
import ImagePreview from "../components/ImagePreview";
import PresetPanel from "../components/PresetPanel";
import ResizableModuleLayout from "../components/ResizableModuleLayout";
import SettingsPanel from "../components/SettingsPanel";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  droppedPathsRequest: { id: number; paths: string[] } | null;
  onDroppedPathsRequestHandled?: (requestId: number) => void;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

const DEFAULT_OPTIMIZE_SETTINGS: OptimizeSettings = {
  activePresetKeys: [],
  customWidth: 800,
  customHeight: 600,
  useCustom: false,
  format: "webp",
  quality: 80,
  resizeMode: "cover",
  namingPattern: "{nome}{suffix}_{w}x{h}",
};

function dedupePaths(paths: string[]): string[] {
  return Array.from(new Set(paths));
}

function normalizePresetKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => left.localeCompare(right));
}

function mergeImages(current: ImageInfo[], incoming: ImageInfo[]): ImageInfo[] {
  const byPath = new Map(current.map((image) => [image.path, image]));
  for (const image of incoming) {
    const existing = byPath.get(image.path);
    byPath.set(image.path, existing ? { ...existing, ...image } : image);
  }
  return Array.from(byPath.values()).sort((a, b) => a.filename.localeCompare(b.filename));
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

function buildSettingsSnapshot(state: {
  activePresets: Set<string>;
  customWidth: number;
  customHeight: number;
  useCustom: boolean;
  format: OutputFormat;
  quality: number;
  resizeMode: ResizeMode;
  namingPattern: string;
}): OptimizeSettings {
  return {
    activePresetKeys: normalizePresetKeys(Array.from(state.activePresets)),
    customWidth: state.customWidth,
    customHeight: state.customHeight,
    useCustom: state.useCustom,
    format: state.format,
    quality: state.quality,
    resizeMode: state.resizeMode,
    namingPattern: state.namingPattern,
  };
}

function profileMatchesState(
  profile: OptimizeProfile,
  outputPath: string | null,
  settings: OptimizeSettings
): boolean {
  return (
    (profile.outputPath || null) === (outputPath || null) &&
    profile.settings.format === settings.format &&
    profile.settings.quality === settings.quality &&
    profile.settings.resizeMode === settings.resizeMode &&
    profile.settings.useCustom === settings.useCustom &&
    profile.settings.customWidth === settings.customWidth &&
    profile.settings.customHeight === settings.customHeight &&
    profile.settings.namingPattern === settings.namingPattern &&
    normalizePresetKeys(profile.settings.activePresetKeys).join("|") ===
      normalizePresetKeys(settings.activePresetKeys).join("|")
  );
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

function sanitizeFileLabel(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[\s_-]{2,}/g, (match) => match[0]);
  return sanitized.replace(/^[.\s_-]+|[.\s_-]+$/g, "") || "image";
}

function sanitizeSuffixLabel(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/^[.\s]+|[.\s]+$/g, "");
}

function slugifyValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function presetLabelFromSuffix(suffix: string): string {
  const value = suffix.trim().replace(/^_+/, "").replace(/_+/g, "-").replace(/^-+|-+$/g, "");
  return value || "custom";
}

function stemFromFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) {
    return filename;
  }
  return filename.slice(0, dotIndex);
}

function basename(path: string | null): string {
  if (!path) {
    return "Nessuna cartella scelta";
  }

  const segments = path.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || path;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function buildNamingPreview({
  pattern,
  filename,
  width,
  height,
  format,
  suffix,
  sequence,
  profileName,
}: {
  pattern: string;
  filename: string;
  width: number;
  height: number;
  format: OutputFormat;
  suffix: string;
  sequence: number;
  profileName: string | null;
}): string {
  const fallbackPattern = DEFAULT_OPTIMIZE_SETTINGS.namingPattern;
  const sourceStem = stemFromFilename(filename) || "image";
  const normalizedPattern = pattern.trim() || fallbackPattern;
  const replacements: Array<[string, string]> = [
    ["{nome}", sanitizeFileLabel(sourceStem)],
    ["{slug}", slugifyValue(sourceStem) || "image"],
    ["{suffix}", sanitizeSuffixLabel(suffix)],
    ["{preset}", presetLabelFromSuffix(suffix)],
    ["{componente}", presetLabelFromSuffix(suffix)],
    ["{w}", String(width)],
    ["{h}", String(height)],
    ["{formato}", format === "jpeg" ? "jpg" : format],
    ["{n}", String(sequence).padStart(3, "0")],
    ["{profilo}", slugifyValue(profileName || "") || "profilo"],
  ];

  let outputStem = normalizedPattern;
  for (const [token, value] of replacements) {
    outputStem = outputStem.replaceAll(token, value);
  }

  const safeStem = sanitizeFileLabel(outputStem) || sanitizeFileLabel(`${sourceStem}${suffix}_${width}x${height}`);
  const extension = format === "jpeg" ? "jpg" : format;
  return `${safeStem}.${extension}`;
}

function estimateJobOutputBytes(image: ImageInfo, job: ConvertJob): number {
  const sourcePixels = Math.max(1, image.width * image.height);
  const targetPixels = Math.max(1, job.width * job.height);
  const pixelRatio = Math.min(1, targetPixels / sourcePixels);
  const formatFactor = {
    webp: 0.36,
    avif: 0.28,
    jpeg: 0.48,
    png: 0.92,
  }[job.format] ?? 0.42;
  const qualityFactor = 0.55 + job.quality / 180;
  const resizeFactor = job.resize_mode === "cover" ? Math.max(pixelRatio, 0.14) : Math.max(pixelRatio, 0.1);
  const encoded = image.size * formatFactor * qualityFactor * resizeFactor;

  return Math.max(1024, Math.round(encoded));
}

function sumEstimatedJobOutputs(image: ImageInfo, jobs: ConvertJob[]): number {
  return jobs.reduce((total, job) => total + estimateJobOutputBytes(image, job), 0);
}

function getJobsWithQuality(jobs: ConvertJob[], quality: number): ConvertJob[] {
  return jobs.map((job) => ({
    ...job,
    quality,
  }));
}

export default function OptimizeModule({
  active,
  initialSettings,
  droppedPathsRequest,
  onDroppedPathsRequestHandled,
  onBackHome,
  onSettingsChange,
}: Props) {
  const moduleRef = useRef<HTMLDivElement | null>(null);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activePresets, setActivePresets] = useState<Set<string>>(new Set());
  const [customWidth, setCustomWidth] = useState(DEFAULT_OPTIMIZE_SETTINGS.customWidth);
  const [customHeight, setCustomHeight] = useState(DEFAULT_OPTIMIZE_SETTINGS.customHeight);
  const [useCustom, setUseCustom] = useState(DEFAULT_OPTIMIZE_SETTINGS.useCustom);
  const [format, setFormat] = useState<OutputFormat>(DEFAULT_OPTIMIZE_SETTINGS.format);
  const [quality, setQuality] = useState(DEFAULT_OPTIMIZE_SETTINGS.quality);
  const [fileQualityOverrides, setFileQualityOverrides] = useState<Record<string, number>>({});
  const [resizeMode, setResizeMode] = useState<ResizeMode>(DEFAULT_OPTIMIZE_SETTINGS.resizeMode);
  const [namingPattern, setNamingPattern] = useState(DEFAULT_OPTIMIZE_SETTINGS.namingPattern);
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ConvertProgress | null>(null);
  const [summary, setSummary] = useState<ConvertSummary | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<ThumbnailHydrationProgress | null>(null);
  const [previewImage, setPreviewImage] = useState<ImageInfo | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportStatusTone, setReportStatusTone] = useState<"success" | "error" | null>(null);
  const [previewEstimate, setPreviewEstimate] = useState<{
    inputSize: number;
    outputSize: number;
  } | null>(null);
  const [profiles, setProfiles] = useState<OptimizeProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileStatusTone, setProfileStatusTone] = useState<"success" | "error" | null>(null);
  const [exportingProfiles, setExportingProfiles] = useState(false);
  const [importingProfiles, setImportingProfiles] = useState(false);
  const [profileTransferStatus, setProfileTransferStatus] = useState<string | null>(null);
  const [profileTransferStatusTone, setProfileTransferStatusTone] = useState<"success" | "error" | null>(null);
  const [dropZoneVisible, setDropZoneVisible] = useState(false);
  const [dropPathCount, setDropPathCount] = useState(0);

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
  const processedDropRequestRef = useRef<number | null>(null);
  const profilesLoadedRef = useRef(false);

  const updateThumbnailProgress = useCallback((nextImages: ImageInfo[], currentPath: string | null = null) => {
    setThumbnailProgress(buildThumbnailProgress(nextImages, currentPath, thumbFailedRef.current));
  }, []);

  const getQualityForPath = useCallback(
    (path: string) => fileQualityOverrides[path] ?? quality,
    [fileQualityOverrides, quality]
  );

  const setPreviewQuality = useCallback(
    (nextQuality: number) => {
      if (!previewImage) {
        return;
      }

      setFileQualityOverrides((current) => {
        const next = { ...current };
        if (nextQuality === quality) {
          delete next[previewImage.path];
        } else {
          next[previewImage.path] = nextQuality;
        }
        return next;
      });
    },
    [previewImage, quality]
  );

  const resetPreviewQuality = useCallback(() => {
    if (!previewImage) {
      return;
    }

    setFileQualityOverrides((current) => {
      if (!(previewImage.path in current)) {
        return current;
      }

      const next = { ...current };
      delete next[previewImage.path];
      return next;
    });
  }, [previewImage]);

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
    invoke<Preset[]>("get_presets").then(setPresets);
  }, []);

  useEffect(() => {
    if (!initialSettings || hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    const optimizeSettings = initialSettings.lastOptimizeOptions || DEFAULT_OPTIMIZE_SETTINGS;

    setActivePresets(new Set(optimizeSettings.activePresetKeys));
    setCustomWidth(optimizeSettings.customWidth);
    setCustomHeight(optimizeSettings.customHeight);
    setUseCustom(optimizeSettings.useCustom);
    setFormat(optimizeSettings.format);
    setQuality(optimizeSettings.quality);
    setResizeMode(optimizeSettings.resizeMode);
    setNamingPattern(optimizeSettings.namingPattern || DEFAULT_OPTIMIZE_SETTINGS.namingPattern);
    setInputPaths(initialSettings.lastInputPaths || []);
    setOutputPath(initialSettings.lastOutputPath || null);
    setProfiles(initialSettings.optimizeProfiles || []);
  }, [initialSettings]);

  useEffect(() => {
    if (!hydratedRef.current || profilesLoadedRef.current) {
      return;
    }

    profilesLoadedRef.current = true;
    let cancelled = false;

    invoke<OptimizeProfile[]>("get_optimize_profiles")
      .then((loadedProfiles) => {
        if (cancelled) {
          return;
        }

        setProfiles(loadedProfiles);
        onSettingsChange({ optimizeProfiles: loadedProfiles });
      })
      .catch((error) => {
        console.error("Errore caricamento profili:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [initialSettings, onSettingsChange]);

  useEffect(() => {
    const unlisten = listen<ConvertProgress>("convert-progress", (event) => {
      setProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      onSettingsChange({
        lastInputPaths: inputPaths,
        lastOutputPath: outputPath,
        lastOptimizeOptions: {
          activePresetKeys: Array.from(activePresets),
          customWidth,
          customHeight,
          useCustom,
          format,
          quality,
          resizeMode,
          namingPattern,
        },
      });
    }, 250);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    activePresets,
    customHeight,
    customWidth,
    format,
    inputPaths,
    onSettingsChange,
    outputPath,
    quality,
    resizeMode,
    namingPattern,
    useCustom,
  ]);

  useEffect(() => {
    if (!active || autoLoadedRef.current || inputPaths.length === 0 || images.length > 0) {
      return;
    }

    autoLoadedRef.current = true;
    void runScan(inputPaths, "replace", inputPaths);
  }, [active, images.length, inputPaths]);

  const syncProfiles = useCallback((nextProfiles: OptimizeProfile[]) => {
    setProfiles(nextProfiles);
    onSettingsChange({ optimizeProfiles: nextProfiles });
  }, [onSettingsChange]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    setFileQualityOverrides((current) => {
      if (Object.keys(current).length === 0) {
        return current;
      }

      const validPaths = new Set(images.map((image) => image.path));
      let changed = false;
      const nextEntries = Object.entries(current).filter(([path]) => {
        const keep = validPaths.has(path);
        if (!keep) {
          changed = true;
        }
        return keep;
      });

      return changed ? Object.fromEntries(nextEntries) : current;
    });
  }, [images]);

  useEffect(() => {
    inputPathsRef.current = inputPaths;
  }, [inputPaths]);

  useEffect(() => {
    if (!previewImage) {
      return;
    }

    const updatedPreview = images.find((image) => image.path === previewImage.path);
    if (!updatedPreview) {
      setPreviewImage(null);
      return;
    }

    if (updatedPreview !== previewImage) {
      setPreviewImage(updatedPreview);
    }
  }, [images, previewImage]);

  useEffect(() => {
    if (profiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    if (selectedProfileId && !profiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(null);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (profiles.length === 0 || selectedProfileId || profileName.trim().length > 0) {
      return;
    }

    const currentSettings = buildSettingsSnapshot({
      activePresets,
      customWidth,
      customHeight,
      useCustom,
      format,
      quality,
      resizeMode,
      namingPattern,
    });

    const matchingProfile = profiles.find((profile) =>
      profileMatchesState(profile, outputPath, currentSettings)
    );

    if (!matchingProfile) {
      return;
    }

    setSelectedProfileId(matchingProfile.id);
    setProfileName(matchingProfile.name);
  }, [
    activePresets,
    customHeight,
    customWidth,
    format,
    namingPattern,
    outputPath,
    profileName,
    profiles,
    quality,
    resizeMode,
    selectedProfileId,
    useCustom,
  ]);

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
      .slice(0, 16)
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
      }, 30);
    }
  }, [images, resetThumbnailState, thumbnailProgress?.currentPath, updateThumbnailProgress]);

  async function flushThumbnailQueue() {
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
  }

  async function loadThumbnail(path: string) {
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
      console.error("Errore thumbnail:", error);
    } finally {
      thumbInflightRef.current.delete(path);
      if (thumbInflightRef.current.size === 0 && thumbQueueRef.current.length === 0) {
        updateThumbnailProgress(imagesRef.current, null);
      }
      void flushThumbnailQueue();
    }
  }

  const runScan = useCallback(async (
    paths: string[],
    mode: "replace" | "append",
    rememberedPaths: string[] = paths
  ) => {
    const normalizedPaths = dedupePaths(paths);
    const normalizedRememberedPaths = dedupePaths(rememberedPaths);
    if (normalizedPaths.length === 0) {
      if (mode === "replace") {
        resetThumbnailState();
        setImages([]);
        setSelectedFiles(new Set());
        setPreviewImage(null);
      }
      return;
    }

    setScanning(true);
    setScanProgress(null);
    setProgress(null);
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);
    resetThumbnailState();

    try {
      const scanned = await invoke<ImageInfo[]>("scan_paths", {
        paths: normalizedPaths,
        rememberedPaths: normalizedRememberedPaths,
      });
      setImages((current) => {
        const nextImages = mode === "replace" ? scanned : mergeImages(current, scanned);
        setPreviewImage((currentPreview) => {
          if (currentPreview && nextImages.some((image) => image.path === currentPreview.path)) {
            const updatedPreview = nextImages.find((image) => image.path === currentPreview.path);
            return updatedPreview || currentPreview;
          }
          return nextImages.find((image) => !image.error) || nextImages[0] || null;
        });
        updateThumbnailProgress(nextImages);
        return nextImages;
      });

      if (mode === "replace") {
        setSelectedFiles(new Set());
      }
    } catch (error) {
      console.error("Errore scansione:", error);
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [resetThumbnailState, updateThumbnailProgress]);

  const isPositionInsideModule = useCallback((x: number, y: number) => {
    const rect = moduleRef.current?.getBoundingClientRect();
    if (!rect) {
      return false;
    }

    const scale = window.devicePixelRatio || 1;
    const cssX = x / scale;
    const cssY = y / scale;

    const withinCssBounds =
      cssX >= rect.left &&
      cssX <= rect.right &&
      cssY >= rect.top &&
      cssY <= rect.bottom;

    const withinRawBounds =
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom;

    return withinCssBounds || withinRawBounds;
  }, []);

  const handleDroppedPaths = useCallback(async (droppedPaths: string[]) => {
    const uniqueDropped = dedupePaths(droppedPaths);
    const newPaths = uniqueDropped.filter((path) => !inputPathsRef.current.includes(path));

    if (newPaths.length === 0) {
      return;
    }

    const nextInputPaths = dedupePaths([...inputPathsRef.current, ...newPaths]);
    setInputPaths(nextInputPaths);
    await runScan(newPaths, "append", nextInputPaths);
  }, [runScan]);

  useEffect(() => {
    if (!active || !droppedPathsRequest) {
      return;
    }

    if (processedDropRequestRef.current === droppedPathsRequest.id) {
      return;
    }

    processedDropRequestRef.current = droppedPathsRequest.id;
    onDroppedPathsRequestHandled?.(droppedPathsRequest.id);
    void handleDroppedPaths(droppedPathsRequest.paths);
  }, [active, droppedPathsRequest, handleDroppedPaths, onDroppedPathsRequestHandled]);

  useEffect(() => {
    if (!active) {
      setDropZoneVisible(false);
      setDropPathCount(0);
      return;
    }

    let disposed = false;
    let cleanup: (() => void) | null = null;

    try {
      getCurrentWindow()
        .onDragDropEvent(async ({ payload }) => {
          if (!active) {
            return;
          }

          if (payload.type === "leave") {
            setDropZoneVisible(false);
            setDropPathCount(0);
            return;
          }

          const insideModule = isPositionInsideModule(payload.position.x, payload.position.y);
          if (!insideModule) {
            setDropZoneVisible(false);
            if (payload.type !== "drop") {
              setDropPathCount(0);
            }
            return;
          }

          if (payload.type === "enter") {
            setDropZoneVisible(true);
            setDropPathCount(payload.paths.length);
            return;
          }

          if (payload.type === "over") {
            setDropZoneVisible(true);
            return;
          }

          if (payload.type === "drop") {
            setDropZoneVisible(false);
            setDropPathCount(0);
            await handleDroppedPaths(payload.paths);
          }
        })
        .then((unlisten) => {
          if (disposed) {
            unlisten();
            return;
          }
          cleanup = unlisten;
        })
        .catch((error) => {
          console.error("Errore drag & drop Optimize:", error);
        });
    } catch (error) {
      console.error("Errore drag & drop Optimize:", error);
    }

    return () => {
      disposed = true;
      setDropZoneVisible(false);
      setDropPathCount(0);
      cleanup?.();
    };
  }, [active, handleDroppedPaths, isPositionInsideModule]);

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
    await runScan(paths, "append", nextInputPaths);
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
    await runScan([selected], "append", nextInputPaths);
  };

  const reloadInputs = async () => {
    if (inputPaths.length === 0) {
      return;
    }
    await runScan(inputPaths, "replace", inputPaths);
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

  const prioritizeThumbnail = useCallback((path: string) => {
    const targetImage = imagesRef.current.find((image) => image.path === path);
    if (
      !targetImage ||
      targetImage.error ||
      targetImage.thumbnail_base64 ||
      thumbInflightRef.current.has(path) ||
      thumbLoadedRef.current.has(path) ||
      thumbFailedRef.current.has(path)
    ) {
      return;
    }

    thumbQueueRef.current = dedupePaths([path, ...thumbQueueRef.current]);
    if (thumbTimerRef.current === null) {
      thumbTimerRef.current = window.setTimeout(() => {
        thumbTimerRef.current = null;
        void flushThumbnailQueue();
      }, 10);
    }
  }, []);

  const toggleSelect = useCallback((path: string) => {
    setSelectedFiles((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    setPreviewImage((currentPreview) => {
      if (currentPreview?.path === path) {
        return currentPreview;
      }
      return imagesRef.current.find((image) => image.path === path) || currentPreview;
    });
    prioritizeThumbnail(path);
  }, [prioritizeThumbnail]);

  const selectAll = () =>
    setSelectedFiles(new Set(images.filter((image) => !image.error).map((image) => image.path)));
  const deselectAll = () => setSelectedFiles(new Set());
  const clearImages = () => {
    resetThumbnailState();
    setImages([]);
    setSelectedFiles(new Set());
    setPreviewImage(null);
    setFileQualityOverrides({});
  };

  const clearInputPaths = () => {
    autoLoadedRef.current = false;
    resetThumbnailState();
    inputPathsRef.current = [];
    setInputPaths([]);
    setImages([]);
    setSelectedFiles(new Set());
    setPreviewImage(null);
    setFileQualityOverrides({});
    setSummary(null);
    setProgress(null);
    setReportStatus(null);
    setReportStatusTone(null);
  };

  const applyProfile = useCallback((profileId: string) => {
    const profile = profiles.find((item) => item.id === profileId);
    if (!profile) {
      return;
    }

    setSelectedProfileId(profile.id);
    setProfileName(profile.name);
    setOutputPath(profile.outputPath || null);
    setActivePresets(new Set(profile.settings.activePresetKeys));
    setCustomWidth(profile.settings.customWidth);
    setCustomHeight(profile.settings.customHeight);
    setUseCustom(profile.settings.useCustom);
    setFormat(profile.settings.format);
    setQuality(profile.settings.quality);
    setResizeMode(profile.settings.resizeMode);
    setNamingPattern(profile.settings.namingPattern || DEFAULT_OPTIMIZE_SETTINGS.namingPattern);
    setProfileStatus(`Profilo "${profile.name}" applicato.`);
    setProfileStatusTone("success");
  }, [profiles]);

  const persistProfile = useCallback(async (mode: "create" | "update") => {
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileStatus("Inserisci un nome profilo.");
      setProfileStatusTone("error");
      return;
    }

    if (mode === "update" && !selectedProfileId) {
      setProfileStatus("Seleziona un profilo da aggiornare.");
      setProfileStatusTone("error");
      return;
    }

    setSavingProfile(true);
    setProfileStatus(null);
    setProfileStatusTone(null);

    const request: SaveOptimizeProfileRequest = {
      id: mode === "update" ? selectedProfileId : null,
      name: trimmedName,
      outputPath,
      settings: buildSettingsSnapshot({
        activePresets,
        customWidth,
        customHeight,
        useCustom,
        format,
        quality,
        resizeMode,
        namingPattern,
      }),
    };

    try {
      const savedProfile = await invoke<OptimizeProfile>("save_optimize_profile", { request });
      const nextProfiles = [...profiles.filter((profile) => profile.id !== savedProfile.id), savedProfile]
        .sort((left, right) => right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name));

      syncProfiles(nextProfiles);
      setSelectedProfileId(savedProfile.id);
      setProfileName(savedProfile.name);
      setProfileStatus(
        mode === "update"
          ? `Profilo "${savedProfile.name}" aggiornato.`
          : `Profilo "${savedProfile.name}" salvato.`
      );
      setProfileStatusTone("success");
    } catch (error) {
      console.error("Errore salvataggio profilo:", error);
      setProfileStatus(getErrorMessage(error, "Impossibile salvare il profilo."));
      setProfileStatusTone("error");
    } finally {
      setSavingProfile(false);
    }
  }, [
    activePresets,
    customHeight,
    customWidth,
    format,
    namingPattern,
    outputPath,
    profileName,
    profiles,
    quality,
    resizeMode,
    selectedProfileId,
    syncProfiles,
    useCustom,
  ]);

  const deleteSelectedProfile = useCallback(async () => {
    if (!selectedProfileId) {
      return;
    }

    setDeletingProfile(true);
    setProfileStatus(null);
    setProfileStatusTone(null);

    try {
      const nextProfiles = await invoke<OptimizeProfile[]>("delete_optimize_profile", {
        id: selectedProfileId,
      });

      syncProfiles(nextProfiles);
      setSelectedProfileId(null);
      setProfileName("");
      setProfileStatus("Profilo eliminato.");
      setProfileStatusTone("success");
    } catch (error) {
      console.error("Errore eliminazione profilo:", error);
      setProfileStatus(getErrorMessage(error, "Impossibile eliminare il profilo."));
      setProfileStatusTone("error");
    } finally {
      setDeletingProfile(false);
    }
  }, [selectedProfileId, syncProfiles]);

  const exportSelectedProfile = useCallback(async () => {
    const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || null;
    if (!selectedProfile) {
      setProfileTransferStatus("Seleziona un profilo da esportare.");
      setProfileTransferStatusTone("error");
      return;
    }

    const profileSlug = slugifyValue(selectedProfile.name) || "profilo";
    const defaultPath = outputPath
      ? `${outputPath}/toolbox-profilo-${profileSlug}.json`
      : `toolbox-profilo-${profileSlug}.json`;

    const selected = await save({
      defaultPath,
      filters: [
        {
          name: "JSON",
          extensions: ["json"],
        },
      ],
    });

    if (!selected) {
      return;
    }

    setExportingProfiles(true);
    setProfileTransferStatus(null);
    setProfileTransferStatusTone(null);

    try {
      const request: ExportOptimizeProfilesRequest = {
        destinationPath: selected,
        profileIds: [selectedProfile.id],
      };
      const savedPath = await invoke<string>("export_optimize_profiles", { request });
      setProfileTransferStatus(`Profilo esportato in ${savedPath}.`);
      setProfileTransferStatusTone("success");
    } catch (error) {
      console.error("Errore export profili:", error);
      setProfileTransferStatus(getErrorMessage(error, "Impossibile esportare i profili JSON."));
      setProfileTransferStatusTone("error");
    } finally {
      setExportingProfiles(false);
    }
  }, [outputPath, profiles, selectedProfileId]);

  const importProfiles = useCallback(async () => {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "JSON",
          extensions: ["json"],
        },
      ],
    });

    if (!selected) {
      return;
    }

    const sourcePaths = dedupePaths(Array.isArray(selected) ? selected : [selected]);
    if (sourcePaths.length === 0) {
      return;
    }

    setImportingProfiles(true);
    setProfileTransferStatus(null);
    setProfileTransferStatusTone(null);

    try {
      const result = await invoke<ImportOptimizeProfilesResult>("import_optimize_profiles", {
        request: {
          sourcePaths,
        },
      });

      syncProfiles(result.profiles);

      const firstImported = result.importedProfiles[0] || null;
      if (firstImported) {
        setSelectedProfileId(firstImported.id);
        setProfileName(firstImported.name);
        setOutputPath(firstImported.outputPath || null);
        setActivePresets(new Set(firstImported.settings.activePresetKeys));
        setCustomWidth(firstImported.settings.customWidth);
        setCustomHeight(firstImported.settings.customHeight);
        setUseCustom(firstImported.settings.useCustom);
        setFormat(firstImported.settings.format);
        setQuality(firstImported.settings.quality);
        setResizeMode(firstImported.settings.resizeMode);
        setNamingPattern(firstImported.settings.namingPattern || DEFAULT_OPTIMIZE_SETTINGS.namingPattern);
      }

      const importedCount = result.importedCount;
      const failedCount = result.failedFiles.length;
      const firstFailure = result.failedFiles[0];
      const baseMessage =
        failedCount > 0
          ? `Importati ${importedCount} profili, ${failedCount} file non importati.`
          : `Importati ${importedCount} profili JSON.`;
      const detailMessage = firstFailure
        ? ` Primo errore: ${firstFailure.sourcePath} - ${firstFailure.error}`
        : "";

      setProfileTransferStatus(`${baseMessage}${detailMessage}`);
      setProfileTransferStatusTone(failedCount > 0 ? "error" : "success");
    } catch (error) {
      console.error("Errore import profili:", error);
      setProfileTransferStatus(getErrorMessage(error, "Impossibile importare i profili JSON."));
      setProfileTransferStatusTone("error");
    } finally {
      setImportingProfiles(false);
    }
  }, [syncProfiles]);

  const togglePreset = (preset: Preset) => {
    const key = `${preset.width}x${preset.height}${preset.suffix}`;
    setActivePresets((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    setUseCustom(false);
  };

  const handleCustomFocus = () => {
    setUseCustom(true);
    setActivePresets(new Set());
  };

  const buildJobs = (): ConvertJob[] => {
    const jobs: ConvertJob[] = [];

    if (useCustom || activePresets.size === 0) {
      jobs.push({
        width: customWidth,
        height: customHeight,
        quality,
        format,
        resize_mode: resizeMode,
        suffix: "_custom",
      });
    }

    for (const key of activePresets) {
      const preset = presets.find((item) => `${item.width}x${item.height}${item.suffix}` === key);
      if (!preset) {
        continue;
      }

      jobs.push({
        width: preset.width,
        height: preset.height,
        quality,
        format,
        resize_mode: resizeMode,
        suffix: preset.suffix,
      });
    }

    return jobs;
  };

  const handleConvert = async () => {
    if (selectedFiles.size === 0) {
      return;
    }

    const jobs = buildJobs();
    if (jobs.length === 0) {
      return;
    }

    const targetOutput = outputPath || (await chooseOutput());
    if (!targetOutput) {
      return;
    }

    setLoading(true);
    setProgress(null);
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);

    const requestedFiles = Array.from(selectedFiles).map((path) => {
      const overrideQuality = fileQualityOverrides[path];
      if (overrideQuality !== undefined && overrideQuality !== quality) {
        return `${path}|quality=${overrideQuality}`;
      }
      return path;
    });

    try {
      const result = await invoke<ConvertSummary>("convert_images", {
        request: {
          files: requestedFiles,
          jobs,
          output_dir: targetOutput,
          naming_pattern: namingPattern,
          profile_name: profileName.trim() || null,
        },
      });
      setSummary(result);
    } catch (error) {
      console.error("Errore conversione:", error);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleExportReport = async () => {
    if (!summary) {
      return;
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[:]/g, "-")
      .replace(/\..+$/, "");

    const selected = await save({
      defaultPath: outputPath ? `${outputPath}/toolbox-report-${timestamp}.csv` : `toolbox-report-${timestamp}.csv`,
      filters: [
        {
          name: "CSV",
          extensions: ["csv"],
        },
      ],
    });

    if (!selected) {
      return;
    }

    setExportingReport(true);
    setReportStatus(null);
    setReportStatusTone(null);

    try {
      const savedPath = await invoke<string>("export_conversion_report", {
        request: {
          destination_path: selected,
          summary,
        },
      });
      setReportStatus(savedPath);
      setReportStatusTone("success");
    } catch (error) {
      console.error("Errore export report:", error);
      setReportStatus("Impossibile esportare il report CSV.");
      setReportStatusTone("error");
    } finally {
      setExportingReport(false);
    }
  };

  const currentOptimizeSettings = buildSettingsSnapshot({
    activePresets,
    customWidth,
    customHeight,
    useCustom,
    format,
    quality,
    resizeMode,
    namingPattern,
  });
  const activeProfile = profiles.find((profile) => profile.id === selectedProfileId) || null;
  const profileDirty = activeProfile
    ? !profileMatchesState(activeProfile, outputPath, currentOptimizeSettings)
    : false;
  const jobs = buildJobs();
  const jobCount = jobs.length;
  const totalOps = selectedFiles.size * jobCount;
  const selectedImages = images.filter((image) => selectedFiles.has(image.path) && !image.error);
  const primaryTarget =
    activePresets.size > 0
      ? presets.find((preset) => activePresets.has(`${preset.width}x${preset.height}${preset.suffix}`))
      : null;
  const previewSource =
    previewImage ||
    images.find((image) => selectedFiles.has(image.path)) ||
    images.find((image) => !image.error) ||
    images[0] ||
    null;
  const previewQuality = previewImage ? getQualityForPath(previewImage.path) : quality;
  const previewQualityOverridden = Boolean(
    previewImage && Object.prototype.hasOwnProperty.call(fileQualityOverrides, previewImage.path)
  );
  const previewJob = jobs[0] || {
    width: customWidth,
    height: customHeight,
    quality,
    format,
    resize_mode: resizeMode,
    suffix: "_custom",
  };
  const activePreviewJobs = getJobsWithQuality(jobs, previewQuality);
  const previewEstimateKey = previewImage
    ? [
        previewImage.path,
        ...activePreviewJobs.map((job) =>
          `${job.width}x${job.height}:${job.quality}:${job.format}:${job.resize_mode}:${job.suffix}`
        ),
      ].join("|")
    : "";
  const activePreviewResults =
    summary && previewImage
      ? summary.results.filter((result) => result.source_path === previewImage.path)
      : [];
  const activePreviewInputSize =
    activePreviewResults[0]?.input_size ?? previewEstimate?.inputSize ?? previewImage?.size ?? 0;
  const activePreviewOutputSize = activePreviewResults.length > 0
    ? activePreviewResults.reduce((total, result) => total + (result.success ? result.output_size : 0), 0)
    : previewEstimate?.outputSize ?? (previewImage ? sumEstimatedJobOutputs(previewImage, activePreviewJobs) : 0);
  const activePreviewWeightMode = activePreviewResults.length > 0 ? "reale" : previewImage ? "stimato" : "idle";
  const batchEstimatedInputSize = selectedImages.reduce((total, image) => total + image.size, 0);
  const batchEstimatedOutputSize = selectedImages.reduce((total, image) => {
    const imageQuality = getQualityForPath(image.path);
    return total + sumEstimatedJobOutputs(image, getJobsWithQuality(jobs, imageQuality));
  }, 0);
  const batchWeightInputSize = summary?.total_input_size ?? batchEstimatedInputSize;
  const batchWeightOutputSize = summary?.total_output_size ?? batchEstimatedOutputSize;
  const batchWeightMode = summary ? "reale" : selectedImages.length > 0 ? "stimato" : "idle";
  const batchWeightNote =
    batchWeightMode === "reale"
      ? "Dati reali dalla conversione"
      : batchWeightMode === "stimato"
        ? "Stima rapida del batch; il file attivo usa una stima più accurata"
        : "Seleziona immagini per vedere il peso finale";
  const namingPreview = buildNamingPreview({
    pattern: namingPattern,
    filename: previewSource?.filename || "example-image.jpg",
    width: previewJob.width,
    height: previewJob.height,
    format,
    suffix: previewJob.suffix,
    sequence: 1,
    profileName: profileName.trim() || activeProfile?.name || null,
  });

  useEffect(() => {
    let cancelled = false;

    if (!previewImage || activePreviewJobs.length === 0) {
      setPreviewEstimate(null);
      return;
    }

    const estimatePreview = async () => {
      try {
        const estimates = await Promise.all(
          activePreviewJobs.map((job) =>
            invoke<EstimateConvertResult>("estimate_output_size", {
              request: {
                path: previewImage.path,
                job,
              },
            })
          )
        );

        if (cancelled) {
          return;
        }

        setPreviewEstimate({
          inputSize: estimates[0]?.input_size ?? previewImage.size,
          outputSize: estimates.reduce((total, estimate) => total + estimate.estimated_output_size, 0),
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Errore stima peso preview:", error);
          setPreviewEstimate(null);
        }
      }
    };

    void estimatePreview();

    return () => {
      cancelled = true;
    };
  }, [previewEstimateKey]);

  const fileEstimates = useMemo(() => {
    const map = new Map<string, { outputName: string; estimatedOutputSize: number; jobCount: number; qualityOverride: number | null }>();
    for (const image of images) {
      if (image.error) continue;
      const imageQuality = getQualityForPath(image.path);
      const imageJobs = getJobsWithQuality(jobs, imageQuality);
      const firstJob = imageJobs[0];
      if (!firstJob) continue;
      const outputName = buildNamingPreview({
        pattern: namingPattern,
        filename: image.filename,
        width: firstJob.width,
        height: firstJob.height,
        format,
        suffix: firstJob.suffix,
        sequence: 1,
        profileName: profileName.trim() || activeProfile?.name || null,
      });
      const estimatedOutputSize = sumEstimatedJobOutputs(image, imageJobs);
      const override = Object.prototype.hasOwnProperty.call(fileQualityOverrides, image.path)
        ? fileQualityOverrides[image.path]
        : null;
      map.set(image.path, {
        outputName,
        estimatedOutputSize,
        jobCount: imageJobs.length,
        qualityOverride: override ?? null,
      });
    }
    return map;
  }, [images, jobs, namingPattern, format, profileName, activeProfile?.name, fileQualityOverrides, getQualityForPath]);

  const [showPreview, setShowPreview] = useState(false);

  const handleCardToggle = useCallback((path: string) => {
    toggleSelect(path);
    const img = imagesRef.current.find((i) => i.path === path);
    if (img) {
      setPreviewImage(img);
    }
  }, [toggleSelect]);

  const openPreview = useCallback(() => {
    if (previewImage) setShowPreview(true);
  }, [previewImage]);

  const workspaceStatus = scanning
    ? scanProgress
      ? `Scansione ${Math.min(scanProgress.current, scanProgress.total)}/${scanProgress.total}`
      : "Scansione in corso"
    : thumbnailProgress && thumbnailProgress.total > 0 && thumbnailProgress.completed < thumbnailProgress.total
      ? `Anteprime ${thumbnailProgress.completed}/${thumbnailProgress.total}`
      : loading
        ? "Conversione in corso"
        : images.length > 0
          ? "Sessione pronta"
          : "Aggiungi file o cartelle per iniziare";

  return (
    <div
      ref={moduleRef}
      className={`optimize-screen ${active ? "active" : "hidden"} ${
        dropZoneVisible ? "drag-drop-active" : ""
      }`}
    >
      <div className={`module-drop-overlay ${dropZoneVisible ? "visible" : ""}`} aria-hidden={!dropZoneVisible}>
        <div className="module-drop-overlay-card">
          <strong>
            {dropPathCount > 0
              ? `Rilascia ${dropPathCount} ${dropPathCount === 1 ? "elemento" : "elementi"}`
              : "Rilascia file o cartelle"}
          </strong>
        </div>
      </div>

      {/* Minimal top bar */}
      <header className="opt-bar">
        <div className="opt-bar-left">
          <button onClick={onBackHome} className="opt-bar-back" aria-label="Home">←</button>
          <h1 className="opt-bar-title">Optimize</h1>
          <span className="opt-bar-sep" />
          <span className="opt-bar-stat">{images.length} file</span>
          <span className="opt-bar-stat">{selectedFiles.size} sel</span>
          <span className="opt-bar-stat">{jobCount} output</span>
          {batchWeightMode !== "idle" ? (
            <span className="opt-bar-stat opt-bar-stat--accent">{formatBytes(batchWeightOutputSize)}</span>
          ) : null}
        </div>
        <div className="opt-bar-right">
          <button onClick={addFiles} className="opt-btn">+ File</button>
          <button onClick={addFolder} className="opt-btn">+ Cartella</button>
          <button onClick={reloadInputs} disabled={scanning || inputPaths.length === 0} className="opt-btn">
            {scanning ? "Scan..." : "Ricarica"}
          </button>
          <button onClick={() => void chooseOutput()} className="opt-btn">Output</button>
        </div>
      </header>

      {/* 3-col layout */}
      <div className="opt-shell">
        <ResizableModuleLayout
          storageKey="toolbox-layout-optimize-v3"
          defaultLeftWidth={260}
          defaultRightWidth={360}
          leftMinWidth={220}
          leftMaxWidth={340}
          rightMinWidth={300}
          rightMaxWidth={440}
          centerMinWidth={480}
          left={
            <div className="opt-panel opt-panel--presets">
              <div className="opt-panel-head">
                <h2>Dimensioni</h2>
                <span className="opt-badge">{jobCount}</span>
              </div>
              <PresetPanel
                presets={presets}
                activePresets={activePresets}
                onTogglePreset={togglePreset}
                customWidth={customWidth}
                customHeight={customHeight}
                useCustom={useCustom}
                onCustomFocus={handleCustomFocus}
                onCustomWidthChange={setCustomWidth}
                onCustomHeightChange={setCustomHeight}
              />
            </div>
          }
          center={
            <div className="opt-center">
              {/* Compact status row */}
              <div className="opt-status-row">
                <span className="opt-status-text">{workspaceStatus}</span>
                <div className="opt-status-actions">
                  <button onClick={() => void chooseOutput()} className="opt-btn opt-btn--sm">
                    📁 {basename(outputPath)}
                  </button>
                  <button onClick={() => void openOutput()} disabled={!outputPath} className="opt-btn opt-btn--sm">
                    Apri
                  </button>
                </div>
              </div>

              {/* Image grid */}
              <div className="opt-grid-area">
                <ImageGrid
                  images={images}
                  selectedFiles={selectedFiles}
                  onToggleSelect={handleCardToggle}
                  onSelectAll={selectAll}
                  onDeselectAll={deselectAll}
                  onClearAll={clearImages}
                  scanning={scanning}
                  fileEstimates={fileEstimates}
                />
              </div>
            </div>
          }
          right={
            <div className="opt-panel opt-panel--settings">
              {/* Preview */}
              <div className="opt-preview">
                <ImagePreview
                  image={previewImage}
                  targetWidth={primaryTarget?.width || customWidth}
                  targetHeight={primaryTarget?.height || customHeight}
                  resizeMode={resizeMode}
                />
                {previewImage ? (
                  <div className="opt-preview-meta">
                    <button className="opt-btn opt-btn--sm" onClick={openPreview}>Espandi</button>
                    <span className="opt-preview-name" title={previewImage.filename}>{previewImage.filename}</span>
                  </div>
                ) : null}
              </div>

              {/* Settings */}
              <SettingsPanel
                format={format}
                onFormatChange={setFormat}
                quality={quality}
                onQualityChange={setQuality}
                previewImage={previewImage}
                previewQuality={previewQuality}
                previewQualityOverridden={previewQualityOverridden}
                onPreviewQualityChange={setPreviewQuality}
                onResetPreviewQuality={resetPreviewQuality}
                resizeMode={resizeMode}
                onResizeModeChange={setResizeMode}
                namingPattern={namingPattern}
                onNamingPatternChange={setNamingPattern}
                namingPreview={namingPreview}
                selectedCount={selectedFiles.size}
                jobCount={jobCount}
                totalOps={totalOps}
                activePresets={activePresets}
                presets={presets}
                useCustom={useCustom}
                customWidth={customWidth}
                customHeight={customHeight}
                outputPath={outputPath}
                inputPaths={inputPaths}
                inputPathCount={inputPaths.length}
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                profileName={profileName}
                profileDirty={profileDirty}
                savingProfile={savingProfile}
                deletingProfile={deletingProfile}
                exportingProfiles={exportingProfiles}
                importingProfiles={importingProfiles}
                profileStatus={profileStatus}
                profileStatusTone={profileStatusTone}
                profileTransferStatus={profileTransferStatus}
                profileTransferStatusTone={profileTransferStatusTone}
                onProfileNameChange={setProfileName}
                onApplyProfile={applyProfile}
                onSaveNewProfile={() => void persistProfile("create")}
                onUpdateProfile={() => void persistProfile("update")}
                onDeleteProfile={() => void deleteSelectedProfile()}
                onExportProfiles={() => void exportSelectedProfile()}
                onImportProfiles={() => void importProfiles()}
                onChooseOutput={() => void chooseOutput()}
                onClearInputPaths={clearInputPaths}
                summary={summary}
                batchWeightMode={batchWeightMode}
                batchWeightInputSize={batchWeightInputSize}
                batchWeightOutputSize={batchWeightOutputSize}
                batchWeightNote={batchWeightNote}
                activePreviewWeightMode={activePreviewWeightMode}
                activePreviewInputSize={activePreviewInputSize}
                activePreviewOutputSize={activePreviewOutputSize}
                exportingReport={exportingReport}
                reportStatus={reportStatus}
                reportStatusTone={reportStatusTone}
                onExportReport={handleExportReport}
                onConvert={handleConvert}
                loading={loading}
              />
            </div>
          }
        />
      </div>

      {/* Preview overlay */}
      {showPreview && previewImage && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-overlay-content" onClick={(e) => e.stopPropagation()}>
            <button className="preview-overlay-close" onClick={() => setShowPreview(false)}>✕</button>
            <ImagePreview
              image={previewImage}
              targetWidth={primaryTarget?.width || customWidth}
              targetHeight={primaryTarget?.height || customHeight}
              resizeMode={resizeMode}
            />
          </div>
        </div>
      )}

      <footer className="app-footer">
        <BatchProgress
          progress={progress}
          summary={summary}
          loading={loading}
          scanProgress={scanProgress}
          scanning={scanning}
          thumbnailProgress={thumbnailProgress}
        />
      </footer>
    </div>
  );
}
