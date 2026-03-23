import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "../../App.css";
import "./srcset.css";
import BatchProgress from "../../components/BatchProgress";
import ImageGrid from "../../components/ImageGrid";
import ImagePreview from "../../components/ImagePreview";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type {
  AppSettings,
  ConvertJob,
  ConvertSummary,
  ImageInfo,
  OutputFormat,
  SrcsetModuleSettings,
  ThumbnailHydrationProgress,
} from "../../types";
import { DEFAULT_SRCSET_NAMING, SRCSET_PRESETS } from "./presets";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

const WIDTH_LIMIT_HEIGHT = 16384;

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

function parseWidthsInput(value: string): number[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((width) => Number.isFinite(width) && width > 0)
        .map((width) => Math.round(width))
    )
  ).sort((left, right) => left - right);
}

function widthsToInput(widths: number[]): string {
  return widths.join(", ");
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

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function sanitizeFileLabel(value: string): string {
  const sanitized = value
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[\s_-]{2,}/g, (match) => match[0]);
  return sanitized.replace(/^[.\s_-]+|[.\s_-]+$/g, "") || "image";
}

function stemFromFilename(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) {
    return filename;
  }
  return filename.slice(0, dotIndex);
}

function buildSrcsetFilename({
  pattern,
  filename,
  width,
  format,
  sequence,
}: {
  pattern: string;
  filename: string;
  width: number;
  format: OutputFormat;
  sequence: number;
}): string {
  const sourceStem = stemFromFilename(filename) || "image";
  const extension = format === "jpeg" ? "jpg" : format;
  let outputStem = (pattern.trim() || DEFAULT_SRCSET_NAMING)
    .replaceAll("{slug}", slugify(sourceStem) || "image")
    .replaceAll("{nome}", sanitizeFileLabel(sourceStem))
    .replaceAll("{w}", String(width))
    .replaceAll("{n}", String(sequence).padStart(3, "0"))
    .replaceAll("{formato}", extension);

  outputStem = sanitizeFileLabel(outputStem);
  return `${outputStem}.${extension}`;
}

function getSelectedFormats(includeAvif: boolean, includeWebp: boolean, includeJpeg: boolean): OutputFormat[] {
  const formats: OutputFormat[] = [];
  if (includeAvif) {
    formats.push("avif");
  }
  if (includeWebp) {
    formats.push("webp");
  }
  if (includeJpeg) {
    formats.push("jpeg");
  }
  return formats;
}

function buildSnippetPreview({
  image,
  widths,
  sizes,
  altText,
  namingPattern,
  includeAvif,
  includeWebp,
  includeJpeg,
}: {
  image: ImageInfo | null;
  widths: number[];
  sizes: string;
  altText: string;
  namingPattern: string;
  includeAvif: boolean;
  includeWebp: boolean;
  includeJpeg: boolean;
}): string {
  const sourceFilename = image?.filename ?? "hero.jpg";
  const orderedWidths = [...widths].sort((left, right) => left - right);
  const selectedFormats = getSelectedFormats(includeAvif, includeWebp, includeJpeg);
  if (orderedWidths.length === 0 || selectedFormats.length === 0) {
    return "";
  }

  const displayWidth =
    orderedWidths.find((width) => width >= 1024) ??
    orderedWidths[orderedWidths.length - 1];
  const intrinsicWidth = orderedWidths[orderedWidths.length - 1];
  const imageWidth = image?.width ?? intrinsicWidth;
  const imageHeight = image?.height ?? Math.round(intrinsicWidth * 0.5625);
  const intrinsicHeight = Math.max(1, Math.round((intrinsicWidth * imageHeight) / Math.max(1, imageWidth)));
  const escapedAlt = altText.replace(/"/g, "&quot;");

  const lines: string[] = [];
  const buildSrcset = (format: OutputFormat) =>
    orderedWidths
      .map((width, index) => `${buildSrcsetFilename({
        pattern: namingPattern,
        filename: sourceFilename,
        width,
        format,
        sequence: index + 1,
      })} ${width}w`)
      .join(", ");

  const fallbackFormat = includeJpeg ? "jpeg" : includeWebp ? "webp" : "avif";

  if ((includeAvif || includeWebp) && selectedFormats.length > 1) {
    lines.push("<picture>");
    if (includeAvif) {
      lines.push(`  <source type="image/avif" srcset="${buildSrcset("avif")}" sizes="${sizes}">`);
    }
    if (includeWebp) {
      lines.push(`  <source type="image/webp" srcset="${buildSrcset("webp")}" sizes="${sizes}">`);
    }
    lines.push(
      `  <img src="${buildSrcsetFilename({
        pattern: namingPattern,
        filename: sourceFilename,
        width: displayWidth,
        format: fallbackFormat,
        sequence: orderedWidths.indexOf(displayWidth) + 1,
      })}" srcset="${buildSrcset(fallbackFormat)}" sizes="${sizes}" alt="${escapedAlt}" loading="lazy" decoding="async" width="${intrinsicWidth}" height="${intrinsicHeight}">`
    );
    lines.push("</picture>");
    return lines.join("\n");
  }

  lines.push(
    `<img src="${buildSrcsetFilename({
      pattern: namingPattern,
      filename: sourceFilename,
      width: displayWidth,
      format: fallbackFormat,
      sequence: orderedWidths.indexOf(displayWidth) + 1,
    })}" srcset="${buildSrcset(fallbackFormat)}" sizes="${sizes}" alt="${escapedAlt}" loading="lazy" decoding="async" width="${intrinsicWidth}" height="${intrinsicHeight}">`
  );
  return lines.join("\n");
}

export default function SrcsetModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [presetId, setPresetId] = useState(SRCSET_PRESETS[0]?.id ?? "editorial-hero");
  const [widths, setWidths] = useState<number[]>(SRCSET_PRESETS[0]?.widths ?? [320, 640, 768, 1024, 1440, 1920]);
  const [widthsInput, setWidthsInput] = useState(widthsToInput(SRCSET_PRESETS[0]?.widths ?? [320, 640, 768, 1024, 1440, 1920]));
  const [sizes, setSizes] = useState(SRCSET_PRESETS[0]?.sizes ?? "100vw");
  const [altText, setAltText] = useState("");
  const [namingPattern, setNamingPattern] = useState(DEFAULT_SRCSET_NAMING);
  const [quality, setQuality] = useState(82);
  const [includeAvif, setIncludeAvif] = useState(true);
  const [includeWebp, setIncludeWebp] = useState(true);
  const [includeJpeg, setIncludeJpeg] = useState(true);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<ImageInfo | null>(null);
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<ConvertSummary | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<ThumbnailHydrationProgress | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [reportStatusTone, setReportStatusTone] = useState<"success" | "error" | null>(null);
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

  const activePreset = useMemo(
    () => SRCSET_PRESETS.find((preset) => preset.id === presetId) ?? SRCSET_PRESETS[0],
    [presetId]
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
    const srcsetSettings = initialSettings.lastSrcsetOptions;
    if (initialSettings.lastOutputPath) {
      setOutputPath(initialSettings.lastOutputPath);
    }
    if (initialSettings.lastInputPaths?.length) {
      setInputPaths(initialSettings.lastInputPaths);
    }
    if (srcsetSettings) {
      setPresetId(srcsetSettings.presetId || SRCSET_PRESETS[0]?.id || "editorial-hero");
      setWidths(srcsetSettings.widths?.length ? srcsetSettings.widths : (SRCSET_PRESETS[0]?.widths ?? [320, 640, 768, 1024, 1440, 1920]));
      setWidthsInput(widthsToInput(srcsetSettings.widths?.length ? srcsetSettings.widths : (SRCSET_PRESETS[0]?.widths ?? [320, 640, 768, 1024, 1440, 1920])));
      setSizes(srcsetSettings.sizes || SRCSET_PRESETS[0]?.sizes || "100vw");
      setAltText(srcsetSettings.altText || "");
      setNamingPattern(srcsetSettings.namingPattern || DEFAULT_SRCSET_NAMING);
      setQuality(srcsetSettings.quality || 82);
      setIncludeAvif(srcsetSettings.includeAvif ?? true);
      setIncludeWebp(srcsetSettings.includeWebp ?? true);
      setIncludeJpeg(srcsetSettings.includeJpeg ?? true);
    }
  }, [initialSettings]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    if (!hydratedRef.current) {
      return;
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      const payload: SrcsetModuleSettings = {
        presetId,
        widths,
        sizes,
        altText,
        namingPattern,
        quality,
        resizeMode: "fit",
        includeAvif,
        includeWebp,
        includeJpeg,
      };
      onSettingsChange({
        lastInputPaths: inputPaths,
        lastOutputPath: outputPath,
        lastSrcsetOptions: payload,
      });
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [
    altText,
    includeAvif,
    includeJpeg,
    includeWebp,
    inputPaths,
    namingPattern,
    onSettingsChange,
    outputPath,
    presetId,
    quality,
    sizes,
    widths,
  ]);

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
    if (!active || autoLoadedRef.current || inputPaths.length === 0 || images.length > 0) {
      return;
    }

    autoLoadedRef.current = true;
    void runScan(inputPaths, "replace");
  }, [active, images.length, inputPaths]);

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
      console.error("Errore thumbnail srcset:", error);
    } finally {
      thumbInflightRef.current.delete(path);
      if (thumbInflightRef.current.size === 0 && thumbQueueRef.current.length === 0) {
        updateThumbnailProgress(imagesRef.current, null);
      }
      void flushThumbnailQueue();
    }
  }

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

  const runScan = useCallback(async (paths: string[], mode: "replace" | "append") => {
    const normalizedPaths = dedupePaths(paths);
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
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);
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

        setPreviewImage((currentPreview) => {
          if (currentPreview && nextImages.some((image) => image.path === currentPreview.path)) {
            return nextImages.find((image) => image.path === currentPreview.path) || currentPreview;
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
      console.error("Errore scansione srcset:", error);
      setReportStatus(getErrorMessage(error, "Impossibile leggere i percorsi selezionati."));
      setReportStatusTone("error");
    } finally {
      setScanning(false);
    }
  }, [resetThumbnailState, updateThumbnailProgress]);

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

  const reloadInputs = async () => {
    if (inputPaths.length === 0) {
      return;
    }

    await runScan(inputPaths, "replace");
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
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);
    setSnippetStatus(null);
    setSnippetStatusTone(null);
  };

  const clearInputPaths = () => {
    resetThumbnailState();
    inputPathsRef.current = [];
    setInputPaths([]);
    setImages([]);
    setSelectedFiles(new Set());
    setPreviewImage(null);
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);
    setSnippetStatus(null);
    setSnippetStatusTone(null);
  };

  const applyPreset = (nextPresetId: string) => {
    const nextPreset = SRCSET_PRESETS.find((preset) => preset.id === nextPresetId);
    if (!nextPreset) {
      return;
    }

    setPresetId(nextPreset.id);
    setWidths(nextPreset.widths);
    setWidthsInput(widthsToInput(nextPreset.widths));
    setSizes(nextPreset.sizes);
    setSnippetStatus(`Preset "${nextPreset.name}" applicato.`);
    setSnippetStatusTone("success");
  };

  const commitWidthsInput = () => {
    const parsed = parseWidthsInput(widthsInput);
    if (parsed.length === 0) {
      setSnippetStatus("Inserisci almeno una larghezza valida separata da virgole.");
      setSnippetStatusTone("error");
      return;
    }

    setWidths(parsed);
    setSnippetStatus(`Breakpoint aggiornati: ${parsed.join(", ")}.`);
    setSnippetStatusTone("success");
  };

  const selectedFormats = useMemo(
    () => getSelectedFormats(includeAvif, includeWebp, includeJpeg),
    [includeAvif, includeJpeg, includeWebp]
  );

  const buildJobs = (): ConvertJob[] =>
    widths.flatMap((width) =>
      selectedFormats.map((format) => ({
        width,
        height: WIDTH_LIMIT_HEIGHT,
        quality,
        format,
        resize_mode: "fit",
        suffix: `_${width}w`,
      }))
    );

  const handleConvert = async () => {
    const files = images
      .filter((image) => selectedFiles.has(image.path))
      .map((image) => image.path);

    if (files.length === 0) {
      setReportStatus("Seleziona almeno una sorgente per generare il srcset.");
      setReportStatusTone("error");
      return;
    }

    if (widths.length === 0) {
      setReportStatus("Definisci almeno una larghezza responsive.");
      setReportStatusTone("error");
      return;
    }

    if (selectedFormats.length === 0) {
      setReportStatus("Attiva almeno un formato output per il srcset.");
      setReportStatusTone("error");
      return;
    }

    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      finalOutputPath = await chooseOutput();
    }

    if (!finalOutputPath) {
      setReportStatus("Scegli una cartella output per generare il srcset.");
      setReportStatusTone("error");
      return;
    }

    setLoading(true);
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);

    try {
      const result = await invoke<ConvertSummary>("convert_images", {
        request: {
          files,
          jobs: buildJobs(),
          output_dir: finalOutputPath,
          naming_pattern: namingPattern,
          profile_name: "srcset",
        },
      });
      setSummary(result);
      setReportStatus(
        `Srcset completato: ${result.successful}/${result.total_operations} varianti responsive generate.`
      );
      setReportStatusTone("success");
    } catch (error) {
      console.error("Errore conversione srcset:", error);
      setReportStatus(getErrorMessage(error, "Impossibile generare il batch responsive."));
      setReportStatusTone("error");
    } finally {
      setLoading(false);
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
      defaultPath: outputPath
        ? `${outputPath}/srcset-report-${timestamp}.csv`
        : `srcset-report-${timestamp}.csv`,
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
      console.error("Errore export report srcset:", error);
      setReportStatus("Impossibile esportare il report CSV del srcset.");
      setReportStatusTone("error");
    } finally {
      setExportingReport(false);
    }
  };

  const snippetPreview = useMemo(
    () =>
      buildSnippetPreview({
        image: previewImage || images.find((image) => selectedFiles.has(image.path)) || images.find((image) => !image.error) || null,
        widths,
        sizes,
        altText,
        namingPattern,
        includeAvif,
        includeWebp,
        includeJpeg,
      }),
    [altText, images, includeAvif, includeJpeg, includeWebp, namingPattern, previewImage, selectedFiles, sizes, widths]
  );

  const filenamePreview = useMemo(() => {
    const image = previewImage || images.find((image) => selectedFiles.has(image.path)) || images.find((image) => !image.error) || null;
    if (!image || widths.length === 0 || selectedFormats.length === 0) {
      return "Seleziona un'immagine";
    }

    return buildSrcsetFilename({
      pattern: namingPattern,
      filename: image.filename,
      width: widths[0],
      format: selectedFormats[0],
      sequence: 1,
    });
  }, [images, namingPattern, previewImage, selectedFiles, selectedFormats, widths]);

  const copySnippet = async () => {
    if (!snippetPreview) {
      setSnippetStatus("Seleziona un'immagine e definisci almeno un formato per generare lo snippet.");
      setSnippetStatusTone("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(snippetPreview);
      setSnippetStatus("Snippet HTML copiato negli appunti.");
      setSnippetStatusTone("success");
    } catch (error) {
      console.error("Errore copia snippet:", error);
      setSnippetStatus("Impossibile copiare lo snippet HTML.");
      setSnippetStatusTone("error");
    }
  };

  const totalOps = selectedFiles.size * widths.length * selectedFormats.length;

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo">S</div>
          <div className="header-brand-copy">
            <h1>Srcset<span>Generator</span></h1>
            <span className="header-subtitle">Varianti responsive e snippet HTML per Toolbox Creative Studio</span>
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
        storageKey="toolbox-layout-srcset-v1"
        defaultLeftWidth={320}
        defaultRightWidth={340}
        leftMinWidth={260}
        leftMaxWidth={460}
        rightMinWidth={300}
        rightMaxWidth={520}
        centerMinWidth={440}
        left={
          <>
            <div className="panel-title">Preset Responsive</div>
            <div className="srcset-preset-panel">
              <div className="srcset-preset-list">
                {SRCSET_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`srcset-preset-card ${preset.id === activePreset.id ? "active" : ""}`}
                    onClick={() => applyPreset(preset.id)}
                  >
                    <div className="srcset-preset-head">
                      <strong>{preset.name}</strong>
                      <span>{preset.widths.length} tagli</span>
                    </div>
                    <p>{preset.description}</p>
                    <span className="srcset-meta-pill">{preset.widths.join(", ")}w</span>
                  </button>
                ))}
              </div>

              <div className="srcset-widths-panel">
                <strong>Breakpoint custom</strong>
                <input
                  className="profile-name-input srcset-widths-input"
                  type="text"
                  value={widthsInput}
                  onChange={(event) => setWidthsInput(event.target.value)}
                  onBlur={commitWidthsInput}
                  placeholder="320, 640, 768, 1024, 1440"
                  spellCheck={false}
                />
                <p className="srcset-widths-hint">
                  Inserisci larghezze separate da virgole. Il modulo genera le varianti in ordine crescente.
                </p>
                <button className="btn btn-sm" onClick={commitWidthsInput}>
                  Applica larghezze
                </button>
              </div>
            </div>
          </>
        }
        center={
          <ImageGrid
            images={images}
            selectedFiles={selectedFiles}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
            onDeselectAll={deselectAll}
            onClearAll={clearImages}
            scanning={scanning}
          />
        }
        right={
          <>
            <ImagePreview
              image={previewImage}
              targetWidth={widths[widths.length - 1] || 1920}
              targetHeight={Math.round(((widths[widths.length - 1] || 1920) * 9) / 16)}
              resizeMode="fit"
            />

            <div className="settings-panel">
              <div className="panel-title">Setup Srcset</div>

              <div className="setting-group">
                <span className="setting-label">Sizes</span>
                <input
                  className="profile-name-input"
                  type="text"
                  value={sizes}
                  onChange={(event) => setSizes(event.target.value)}
                  placeholder="100vw"
                  spellCheck={false}
                />
              </div>

              <div className="setting-group">
                <span className="setting-label">Alt Text</span>
                <input
                  className="profile-name-input"
                  type="text"
                  value={altText}
                  onChange={(event) => setAltText(event.target.value)}
                  placeholder="Descrizione immagine"
                />
              </div>

              <div className="setting-group">
                <span className="setting-label">Formato e fallback</span>
                <div className="srcset-format-row">
                  <div className="srcset-format-toggle">
                    <label>
                      <input type="checkbox" checked={includeAvif} onChange={(event) => setIncludeAvif(event.target.checked)} />
                      AVIF
                    </label>
                    <span className="srcset-meta-pill">moderno</span>
                  </div>
                  <div className="srcset-format-toggle">
                    <label>
                      <input type="checkbox" checked={includeWebp} onChange={(event) => setIncludeWebp(event.target.checked)} />
                      WebP
                    </label>
                    <span className="srcset-meta-pill">standard</span>
                  </div>
                  <div className="srcset-format-toggle">
                    <label>
                      <input type="checkbox" checked={includeJpeg} onChange={(event) => setIncludeJpeg(event.target.checked)} />
                      JPEG
                    </label>
                    <span className="srcset-meta-pill">fallback</span>
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">
                  Qualita: <strong>{quality}%</strong>
                </span>
                <div className="quality-slider-wrapper">
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={quality}
                    onChange={(event) => setQuality(Number(event.target.value))}
                    className="quality-slider"
                  />
                </div>
                <div className="quality-labels">
                  <span>Leggero</span>
                  <span>Massima</span>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Naming Srcset</span>
                <div className="naming-summary">
                  <input
                    type="text"
                    className="profile-name-input"
                    value={namingPattern}
                    onChange={(event) => setNamingPattern(event.target.value)}
                    placeholder={DEFAULT_SRCSET_NAMING}
                    spellCheck={false}
                  />
                  <div className="srcset-token-list">
                    {["{slug}", "{nome}", "{w}", "{n}", "{formato}"].map((token) => (
                      <span key={token} className="srcset-token">
                        {token}
                      </span>
                    ))}
                  </div>
                  <div className="naming-preview-card">
                    <span className="path-summary-label">Preview</span>
                    <strong>{filenamePreview}</strong>
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Riepilogo Responsive</span>
                <div className="srcset-summary-grid">
                  <div className="srcset-summary-card">
                    <span>Sorgenti</span>
                    <strong>{selectedFiles.size}</strong>
                  </div>
                  <div className="srcset-summary-card">
                    <span>Breakpoint</span>
                    <strong>{widths.length}</strong>
                  </div>
                  <div className="srcset-summary-card">
                    <span>Formati</span>
                    <strong>{selectedFormats.length}</strong>
                  </div>
                  <div className="srcset-summary-card">
                    <span>Operazioni</span>
                    <strong>{totalOps}</strong>
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Percorsi</span>
                <div className="path-summary">
                  <div className="path-summary-row">
                    <span className="path-summary-label">Input</span>
                    <span className="path-summary-value">{inputPaths.length} sorgenti ricordate in sessione</span>
                  </div>
                  {inputPaths.length > 0 ? (
                    <div className="path-summary-list">
                      {inputPaths.slice(0, 3).map((path) => (
                        <span key={path} className="path-summary-chip" title={path}>
                          {path}
                        </span>
                      ))}
                      {inputPaths.length > 3 ? (
                        <span className="path-summary-more">+{inputPaths.length - 3} altre</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="path-summary-row">
                    <span className="path-summary-label">Output</span>
                    <span className="path-summary-value">{outputPath || "Nessuna cartella selezionata"}</span>
                  </div>
                  <div className="path-summary-actions">
                    <button className="btn btn-sm" onClick={() => void chooseOutput()}>
                      Scegli Output
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={clearInputPaths}>
                      Svuota sorgenti
                    </button>
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Snippet HTML</span>
                <div className="srcset-snippet-card">
                  <p>
                    Genera uno snippet pronto per `picture` o `img srcset` usando il file selezionato come riferimento.
                  </p>
                  <pre>{snippetPreview || "Seleziona un'immagine e almeno un formato per vedere lo snippet responsive."}</pre>
                  <div className="srcset-actions-row">
                    <button className="btn btn-sm" onClick={() => void copySnippet()}>
                      Copia HTML
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => void handleExportReport()}
                      disabled={!summary || exportingReport}
                    >
                      {exportingReport ? "Export..." : "Esporta CSV"}
                    </button>
                  </div>
                  {snippetStatus ? (
                    <div className={`report-status ${snippetStatusTone === "error" ? "error" : "success"}`}>
                      {snippetStatus}
                    </div>
                  ) : null}
                  {reportStatus ? (
                    <div className={`report-status ${reportStatusTone === "error" ? "error" : "success"}`}>
                      {reportStatus}
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                className="btn btn-convert"
                onClick={() => void handleConvert()}
                disabled={loading || selectedFiles.size === 0}
              >
                {loading ? (
                  "Generazione in corso..."
                ) : (
                  <>
                    GENERA SRCSET
                    <span className="convert-count">{totalOps} varianti in uscita</span>
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
