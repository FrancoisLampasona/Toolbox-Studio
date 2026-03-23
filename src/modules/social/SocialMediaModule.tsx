import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "../../App.css";
import "./social.css";
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
  ResizeMode,
  SocialMediaModuleSettings,
  ThumbnailHydrationProgress,
} from "../../types";
import {
  DEFAULT_SOCIAL_NAMING,
  SOCIAL_PACKS,
  SOCIAL_PLATFORMS,
  SOCIAL_VARIANTS,
  SOCIAL_DEFAULT_VARIANT_IDS,
  type SocialPlatformPreset,
  type SocialPackPreset,
  type SocialVariantPreset,
} from "./presets";

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

interface BrandKit {
  id: string;
  name: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  textColor?: string | null;
  backgroundColor?: string | null;
  logoPath?: string | null;
  iconPath?: string | null;
  fontHeading?: string | null;
  fontBody?: string | null;
  watermarkPath?: string | null;
  assetPath?: string | null;
  updatedAtMs?: number | null;
}

const BRAND_KIT_STORAGE_KEY = "clickoso-social-brand-kit-v1";

const DEFAULT_SOCIAL_SETTINGS: SocialMediaModuleSettings = {
  selectedVariantIds: SOCIAL_DEFAULT_VARIANT_IDS,
  namingPattern: DEFAULT_SOCIAL_NAMING,
  assetPath: "/assets/social/",
  altText: "",
  format: "webp",
  quality: 82,
  resizeMode: "cover",
  selectedBrandKitId: null,
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

function formatToExtension(format: OutputFormat): string {
  return format === "jpeg" ? "jpg" : format;
}

function formatToMime(format: OutputFormat): string {
  switch (format) {
    case "avif":
      return "image/avif";
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
    default:
      return "image/webp";
  }
}

function presetLabelFromSuffix(suffix: string): string {
  const trimmed = suffix.trim().replace(/^_+/, "").replace(/_+/g, "-");
  return trimmed || "social";
}

function buildSocialFilename({
  pattern,
  filename,
  variant,
  sequence,
  format,
}: {
  pattern: string;
  filename: string;
  variant: SocialVariantPreset;
  sequence: number;
  format: OutputFormat;
}): string {
  const sourceStem = stemFromFilename(filename) || "image";
  const extension = formatToExtension(format);
  const presetLabel = presetLabelFromSuffix(variant.suffix);
  let outputStem = (pattern.trim() || DEFAULT_SOCIAL_NAMING)
    .replaceAll("{slug}", slugify(sourceStem) || "image")
    .replaceAll("{nome}", sanitizeFileLabel(sourceStem))
    .replaceAll("{preset}", presetLabel)
    .replaceAll("{componente}", presetLabel)
    .replaceAll("{suffix}", variant.suffix)
    .replaceAll("{w}", String(variant.width))
    .replaceAll("{h}", String(variant.height))
    .replaceAll("{formato}", extension)
    .replaceAll("{n}", String(sequence).padStart(3, "0"));

  outputStem = sanitizeFileLabel(outputStem);
  return `${outputStem}.${extension}`;
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

function buildMetaSnippet({
  image,
  variant,
  assetPath,
  namingPattern,
  altText,
  format,
}: {
  image: ImageInfo | null;
  variant: SocialVariantPreset;
  assetPath: string;
  namingPattern: string;
  altText: string;
  format: OutputFormat;
}): string {
  const sourceFilename = image?.filename ?? "social-image.jpg";
  const outputFilename = buildSocialFilename({
    pattern: namingPattern,
    filename: sourceFilename,
    variant,
    sequence: 1,
    format,
  });
  const assetBase = normalizeAssetPath(assetPath);
  const imageUrl = joinAssetPath(assetBase, outputFilename);
  const escapedAlt = (altText || image?.filename || variant.name).replace(/"/g, "&quot;");

  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:image" content="${imageUrl}">`,
    `<meta property="og:image:type" content="${formatToMime(format)}">`,
    `<meta property="og:image:width" content="${variant.width}">`,
    `<meta property="og:image:height" content="${variant.height}">`,
    `<meta property="og:image:alt" content="${escapedAlt}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${imageUrl}">`,
    `<meta name="twitter:image:alt" content="${escapedAlt}">`,
  ].join("\n");
}

function getDefaultVariantIds(packId: string): string[] {
  return SOCIAL_PACKS.find((pack) => pack.id === packId)?.variantIds ?? SOCIAL_DEFAULT_VARIANT_IDS;
}

function groupVariants(platform: SocialPlatformPreset): SocialVariantPreset[] {
  return SOCIAL_VARIANTS.filter((variant) => platform.variantIds.includes(variant.id));
}

function buildPlannedOutputs({
  variants,
  previewImage,
  namingPattern,
  format,
}: {
  variants: SocialVariantPreset[];
  previewImage: ImageInfo | null;
  namingPattern: string;
  format: OutputFormat;
}): PlannedOutputItem[] {
  const source = previewImage?.filename ?? "social-image.jpg";
  return variants.map((variant, index) => ({
    label: `${variant.platformName} · ${variant.name}`,
    filename: buildSocialFilename({
      pattern: namingPattern,
      filename: source,
      variant,
      sequence: index + 1,
      format,
    }),
    size: `${variant.width}x${variant.height}`,
  }));
}

function buildConvertJobs(
  variants: SocialVariantPreset[],
  quality: number,
  format: OutputFormat,
  resizeMode: ResizeMode
): ConvertJob[] {
  return variants.map((variant) => ({
    width: variant.width,
    height: variant.height,
    quality,
    format,
    resize_mode: resizeMode,
    suffix: variant.suffix,
  }));
}

function getPlatformAccent(platformId: string): string {
  return SOCIAL_PLATFORMS.find((platform) => platform.id === platformId)?.accent ?? "#5b8cff";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeBrandKit(value: unknown): BrandKit | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id) || readString(value.name);
  const name = readString(value.name);
  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    primaryColor: readString(value.primaryColor),
    secondaryColor: readString(value.secondaryColor),
    accentColor: readString(value.accentColor),
    textColor: readString(value.textColor),
    backgroundColor: readString(value.backgroundColor),
    logoPath: readString(value.logoPath),
    iconPath: readString(value.iconPath),
    fontHeading: readString(value.fontHeading),
    fontBody: readString(value.fontBody),
    watermarkPath: readString(value.watermarkPath),
    assetPath: readString(value.assetPath),
    updatedAtMs: typeof value.updatedAtMs === "number" ? value.updatedAtMs : null,
  };
}

function normalizeBrandKitList(payload: unknown): BrandKit[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeBrandKit).filter((kit): kit is BrandKit => kit !== null);
  }

  if (isRecord(payload)) {
    const listCandidate = payload.brandKits ?? payload.kits ?? payload.items;
    if (Array.isArray(listCandidate)) {
      return listCandidate.map(normalizeBrandKit).filter((kit): kit is BrandKit => kit !== null);
    }
  }

  return [];
}

function directoryFromPath(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\\/g, "/").trim();
  if (!normalized) {
    return null;
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return null;
  }

  const directory = normalized.startsWith("/") ? `/${parts.slice(0, -1).join("/")}` : parts.slice(0, -1).join("/");
  return normalizeAssetPath(directory);
}

function brandKitAssetPath(kit: BrandKit): string | null {
  return normalizeAssetPath(kit.assetPath || directoryFromPath(kit.logoPath) || "/");
}

export default function SocialMediaModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>(DEFAULT_SOCIAL_SETTINGS.selectedVariantIds);
  const [namingPattern, setNamingPattern] = useState(DEFAULT_SOCIAL_SETTINGS.namingPattern);
  const [assetPath, setAssetPath] = useState(DEFAULT_SOCIAL_SETTINGS.assetPath);
  const [altText, setAltText] = useState(DEFAULT_SOCIAL_SETTINGS.altText);
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [selectedBrandKitId, setSelectedBrandKitId] = useState<string | null>(null);
  const [brandKitStatus, setBrandKitStatus] = useState<string | null>(null);
  const [brandKitStatusTone, setBrandKitStatusTone] = useState<"success" | "error" | null>(null);
  const [applyingBrandKit, setApplyingBrandKit] = useState(false);
  const [brandLogoPath, setBrandLogoPath] = useState<string | null>(null);
  const [format, setFormat] = useState<OutputFormat>(DEFAULT_SOCIAL_SETTINGS.format);
  const [quality, setQuality] = useState(DEFAULT_SOCIAL_SETTINGS.quality);
  const [resizeMode, setResizeMode] = useState<ResizeMode>(DEFAULT_SOCIAL_SETTINGS.resizeMode);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [previewImage, setPreviewImage] = useState<ImageInfo | null>(null);
  const [inputPaths, setInputPaths] = useState<string[]>([]);
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [summary, setSummary] = useState<ConvertSummary | null>(null);
  const [thumbnailProgress, setThumbnailProgress] = useState<ThumbnailHydrationProgress | null>(null);
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
  const brandKitsLoadedRef = useRef(false);

  const persistedSettings = useMemo<SocialMediaModuleSettings>(
    () => ({
      selectedVariantIds,
      namingPattern,
      assetPath,
      altText,
      format,
      quality,
      resizeMode,
      selectedBrandKitId,
    }),
    [altText, assetPath, format, namingPattern, quality, resizeMode, selectedBrandKitId, selectedVariantIds]
  );

  const selectedVariants = useMemo(
    () => SOCIAL_VARIANTS.filter((variant) => selectedVariantIds.includes(variant.id)),
    [selectedVariantIds]
  );

  const selectedBrandKit = useMemo(
    () => brandKits.find((kit) => kit.id === selectedBrandKitId) ?? null,
    [brandKits, selectedBrandKitId]
  );

  const brandKitStyle = useMemo(() => {
    if (!selectedBrandKit) {
      return undefined;
    }

    return {
      "--social-brand-primary": selectedBrandKit.primaryColor || "#5b8cff",
      "--social-brand-secondary": selectedBrandKit.secondaryColor || selectedBrandKit.primaryColor || "#ff5ea8",
      "--social-brand-accent": selectedBrandKit.accentColor || selectedBrandKit.primaryColor || "#8b5cf6",
      "--social-brand-text": selectedBrandKit.textColor || "#f8fafc",
      "--social-brand-background": selectedBrandKit.backgroundColor || "#111827",
    } as CSSProperties;
  }, [selectedBrandKit]);

  const activeVariant = selectedVariants[0] ?? SOCIAL_VARIANTS.find((variant) => variant.defaultEnabled) ?? SOCIAL_VARIANTS[0];

  const previewSource = useMemo(
    () => images.find((image) => image.path === previewImage?.path) ?? images.find((image) => !image.error) ?? null,
    [images, previewImage]
  );

  const plannedOutputs = useMemo(
    () => buildPlannedOutputs({
      variants: selectedVariants,
      previewImage: previewSource,
      namingPattern,
      format,
    }),
    [format, namingPattern, previewSource, selectedVariants]
  );

  const snippetPreview = useMemo(() => {
    const snippet = buildMetaSnippet({
      image: previewSource,
      variant: activeVariant,
      assetPath,
      namingPattern,
      altText,
      format,
    });

    if (!selectedBrandKit) {
      return snippet;
    }

    const previewLines = [
      `<!-- Brand kit: ${selectedBrandKit.name} -->`,
      selectedBrandKit.logoPath ? `<!-- Logo path: ${selectedBrandKit.logoPath} -->` : null,
      selectedBrandKit.assetPath ? `<!-- Asset path: ${selectedBrandKit.assetPath} -->` : null,
      selectedBrandKit.primaryColor ? `<!-- Primary: ${selectedBrandKit.primaryColor} -->` : null,
      selectedBrandKit.secondaryColor ? `<!-- Secondary: ${selectedBrandKit.secondaryColor} -->` : null,
      selectedBrandKit.accentColor ? `<!-- Accent: ${selectedBrandKit.accentColor} -->` : null,
    ].filter((line): line is string => Boolean(line));

    return [...previewLines, snippet].join("\n");
  }, [
    activeVariant,
    altText,
    assetPath,
    format,
    namingPattern,
    previewSource,
    selectedBrandKit,
  ]);

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
    const socialSettings = initialSettings.lastSocialOptions;

    if (initialSettings.lastOutputPath) {
      setOutputPath(initialSettings.lastOutputPath);
    }
    if (initialSettings.lastInputPaths?.length) {
      setInputPaths(initialSettings.lastInputPaths);
    }
    if (socialSettings) {
      setSelectedVariantIds(
        socialSettings.selectedVariantIds?.length
          ? socialSettings.selectedVariantIds
          : DEFAULT_SOCIAL_SETTINGS.selectedVariantIds
      );
      setNamingPattern(socialSettings.namingPattern || DEFAULT_SOCIAL_SETTINGS.namingPattern);
      setAssetPath(socialSettings.assetPath || DEFAULT_SOCIAL_SETTINGS.assetPath);
      setAltText(socialSettings.altText || "");
      setFormat(socialSettings.format || DEFAULT_SOCIAL_SETTINGS.format);
      setQuality(typeof socialSettings.quality === "number" ? socialSettings.quality : DEFAULT_SOCIAL_SETTINGS.quality);
      setResizeMode(socialSettings.resizeMode || DEFAULT_SOCIAL_SETTINGS.resizeMode);
      setSelectedBrandKitId(socialSettings.selectedBrandKitId || null);
    }
  }, [initialSettings]);

  useEffect(() => {
    const stored = window.localStorage.getItem(BRAND_KIT_STORAGE_KEY);
    if (stored) {
      setSelectedBrandKitId(stored);
    }
  }, []);

  useEffect(() => {
    if (!selectedBrandKitId) {
      window.localStorage.removeItem(BRAND_KIT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(BRAND_KIT_STORAGE_KEY, selectedBrandKitId);
  }, [selectedBrandKitId]);

  useEffect(() => {
    if (!active || brandKitsLoadedRef.current) {
      return;
    }

    let cancelled = false;
    brandKitsLoadedRef.current = true;

    const loadBrandKits = async () => {
      try {
        const payload = await invoke<unknown>("get_brand_kits");
        if (cancelled) {
          return;
        }

        const kits = normalizeBrandKitList(payload);
        setBrandKits(kits);
        if (kits.length === 0) {
          setBrandKitStatus("Nessun brand kit locale disponibile: puoi continuare in modalita manuale.");
          setBrandKitStatusTone(null);
          return;
        }

        setBrandKitStatus(`${kits.length} brand kit caricati.`);
        setBrandKitStatusTone("success");

        setSelectedBrandKitId((current) => {
          if (current && kits.some((kit) => kit.id === current)) {
            return current;
          }
          return kits[0].id;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Errore caricamento brand kit:", error);
        setBrandKits([]);
        setBrandKitStatus("Brand kit non disponibile: il modulo continua con i campi manuali.");
        setBrandKitStatusTone("error");
      }
    };

    void loadBrandKits();

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    setBrandLogoPath(selectedBrandKit?.logoPath || selectedBrandKit?.iconPath || null);
  }, [selectedBrandKit]);

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
        lastSocialOptions: persistedSettings,
      });
    }, 250);

    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [inputPaths, onSettingsChange, outputPath, persistedSettings]);

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
        maxSize: 220,
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
      console.error("Errore thumbnail social:", error);
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
      console.error("Errore scansione social:", error);
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

  const applyBrandKitToModule = async () => {
    if (!selectedBrandKit) {
      setBrandKitStatus("Seleziona un brand kit locale prima di applicarlo.");
      setBrandKitStatusTone("error");
      return;
    }

    setApplyingBrandKit(true);
    await Promise.resolve();
    const nextAssetPath = brandKitAssetPath(selectedBrandKit) || assetPath;
    const nextLogoPath = selectedBrandKit.logoPath || selectedBrandKit.iconPath || null;

    setAssetPath(nextAssetPath);
    setBrandLogoPath(nextLogoPath);
    setAltText((current) => current.trim().length > 0 ? current : selectedBrandKit.name);
    setBrandKitStatus(`Brand kit ${selectedBrandKit.name} applicato al modulo.`);
    setBrandKitStatusTone("success");
    setApplyingBrandKit(false);
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
  }, [flushThumbnailQueue]);

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

  const clearAll = () => {
    resetThumbnailState();
    setImages([]);
    setSelectedFiles(new Set());
    setPreviewImage(null);
    setInputPaths([]);
    setSummary(null);
    setReportStatus(null);
    setReportStatusTone(null);
    setSnippetStatus(null);
    setSnippetStatusTone(null);
  };

  const selectPack = (pack: SocialPackPreset) => {
    setSelectedVariantIds(getDefaultVariantIds(pack.id));
  };

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((current) => {
      if (current.includes(variantId)) {
        return current.filter((id) => id !== variantId);
      }
      return [...current, variantId];
    });
  };

  const togglePlatform = (platform: SocialPlatformPreset) => {
    const allSelected = platform.variantIds.every((id) => selectedVariantIds.includes(id));
    setSelectedVariantIds((current) => {
      if (allSelected) {
        return current.filter((id) => !platform.variantIds.includes(id));
      }

      const next = new Set(current);
      platform.variantIds.forEach((id) => next.add(id));
      return SOCIAL_VARIANTS.filter((variant) => next.has(variant.id)).map((variant) => variant.id);
    });
  };

  const handleConvert = async () => {
    const files = images
      .filter((image) => selectedFiles.has(image.path))
      .map((image) => image.path);

    if (files.length === 0) {
      setReportStatus("Seleziona almeno una sorgente per generare il pack social.");
      setReportStatusTone("error");
      return;
    }

    if (selectedVariants.length === 0) {
      setReportStatus("Seleziona almeno una variante social.");
      setReportStatusTone("error");
      return;
    }

    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      finalOutputPath = await chooseOutput();
    }

    if (!finalOutputPath) {
      setReportStatus("Scegli una cartella output per generare il pack social.");
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
          jobs: buildConvertJobs(selectedVariants, quality, format, resizeMode),
          output_dir: finalOutputPath,
          naming_pattern: namingPattern,
          profile_name: "social",
        },
      });
      setSummary(result);
      setReportStatus(
        `Pack social completato: ${result.successful}/${result.total_operations} varianti generate.`
      );
      setReportStatusTone("success");
    } catch (error) {
      console.error("Errore conversione social:", error);
      setReportStatus(getErrorMessage(error, "Impossibile generare il pack social."));
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
        ? `${outputPath}/social-report-${timestamp}.csv`
        : `social-report-${timestamp}.csv`,
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
      console.error("Errore export report social:", error);
      setReportStatus("Impossibile esportare il report CSV del pack social.");
      setReportStatusTone("error");
    }
  };

  const copySnippet = async () => {
    if (!snippetPreview) {
      setSnippetStatus("Seleziona una variante e una sorgente per generare lo snippet.");
      setSnippetStatusTone("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(snippetPreview);
      setSnippetStatus("Snippet meta copiato negli appunti.");
      setSnippetStatusTone("success");
    } catch (error) {
      console.error("Errore copia snippet social:", error);
      setSnippetStatus("Impossibile copiare lo snippet meta.");
      setSnippetStatusTone("error");
    }
  };

  return (
    <div
      className={`optimize-screen ${active ? "active" : "hidden"}`}
      style={brandKitStyle}
    >
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo social-logo">S</div>
          <div className="header-brand-copy">
            <h1>Social<span>Media Images</span></h1>
            <span className="header-subtitle">Pack social, snippet meta e batch pronti per i canali principali</span>
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
        storageKey="clickoso-layout-social-v1"
        defaultLeftWidth={336}
        defaultRightWidth={360}
        leftMinWidth={280}
        leftMaxWidth={460}
        rightMinWidth={320}
        rightMaxWidth={540}
        centerMinWidth={420}
        left={
          <>
            <div className="panel-title">Preset Social</div>
            <div className="social-panel">
              <div className="social-section">
                <span className="social-section-title">Pack rapidi</span>
                <div className="social-pack-row">
                  {SOCIAL_PACKS.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      className={`social-pack-btn ${
                        pack.variantIds.every((id) => selectedVariantIds.includes(id)) &&
                        pack.variantIds.length > 0
                          ? "active"
                          : ""
                      }`}
                      onClick={() => selectPack(pack)}
                    >
                      <strong>{pack.name}</strong>
                      <span>{pack.description}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="social-section">
                <span className="social-section-title">Formato e resa</span>
                <label className="social-field">
                  <span>Naming pattern</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={namingPattern}
                    onChange={(event) => setNamingPattern(event.target.value)}
                    spellCheck={false}
                  />
                </label>
                <label className="social-field">
                  <span>Asset path snippet</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={assetPath}
                    onChange={(event) => setAssetPath(event.target.value)}
                    spellCheck={false}
                  />
                </label>
                <label className="social-field">
                  <span>Alt testo snippet</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={altText}
                    onChange={(event) => setAltText(event.target.value)}
                    placeholder="Alt immagine social"
                    spellCheck={false}
                  />
                </label>
                <div className="social-input-grid">
                  <label className="social-field">
                    <span>Formato output</span>
                    <select
                      className="profile-name-input"
                      value={format}
                      onChange={(event) => setFormat(event.target.value as OutputFormat)}
                    >
                      <option value="webp">WebP</option>
                      <option value="jpeg">JPEG</option>
                      <option value="png">PNG</option>
                      <option value="avif">AVIF</option>
                    </select>
                  </label>

                  <label className="social-field">
                    <div className="social-slider-head">
                      <span>Quality</span>
                      <strong>{quality}%</strong>
                    </div>
                    <input
                      className="social-range"
                      type="range"
                      min={1}
                      max={100}
                      step={1}
                      value={quality}
                      onChange={(event) => setQuality(Number(event.target.value))}
                    />
                  </label>

                  <label className="social-field">
                    <span>Resize mode</span>
                    <select
                      className="profile-name-input"
                      value={resizeMode}
                      onChange={(event) => setResizeMode(event.target.value as ResizeMode)}
                    >
                      <option value="cover">Cover</option>
                      <option value="fit">Fit</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="social-section social-brand-section">
                <span className="social-section-title">Brand Kit</span>
                <label className="social-field">
                  <span>Kit disponibile</span>
                  <select
                    className="profile-name-input"
                    value={selectedBrandKitId || ""}
                    onChange={(event) => setSelectedBrandKitId(event.target.value || null)}
                  >
                    <option value="">Nessun kit selezionato</option>
                    {brandKits.map((kit) => (
                      <option key={kit.id} value={kit.id}>
                        {kit.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="social-brand-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-small-inline"
                    onClick={() => void applyBrandKitToModule()}
                    disabled={applyingBrandKit || brandKits.length === 0}
                  >
                    {applyingBrandKit ? "Applicazione..." : "Applica al modulo"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small-inline"
                    onClick={() => {
                      setSelectedBrandKitId(null);
                      setBrandLogoPath(null);
                      setBrandKitStatus("Selezione brand kit rimossa.");
                      setBrandKitStatusTone(null);
                    }}
                  >
                    Svuota selezione
                  </button>
                </div>

                {brandKitStatus ? (
                  <div className={`social-status ${brandKitStatusTone === "error" ? "error" : "success"}`}>
                    {brandKitStatus}
                  </div>
                ) : null}

                {selectedBrandKit ? (
                  <div className="social-brand-preview">
                    <div className="social-brand-preview-head">
                      <strong>{selectedBrandKit.name}</strong>
                      <span>{brandLogoPath || selectedBrandKit.logoPath || "logo non impostato"}</span>
                    </div>
                    <div className="social-brand-swatch-row">
                      {[
                        { label: "Primary", value: selectedBrandKit.primaryColor || "#5b8cff" },
                        { label: "Secondary", value: selectedBrandKit.secondaryColor || selectedBrandKit.primaryColor || "#ff5ea8" },
                        { label: "Accent", value: selectedBrandKit.accentColor || selectedBrandKit.primaryColor || "#8b5cf6" },
                        { label: "Text", value: selectedBrandKit.textColor || "#f8fafc" },
                        { label: "Background", value: selectedBrandKit.backgroundColor || "#111827" },
                      ].map((item) => (
                        <div key={item.label} className="social-brand-swatch">
                          <span className="social-brand-swatch-chip" style={{ background: item.value }} />
                          <div>
                            <strong>{item.label}</strong>
                            <span>{item.value}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="social-brand-meta">
                      <span>Asset path: {brandKitAssetPath(selectedBrandKit) || "n/d"}</span>
                      <span>Logo path: {brandLogoPath || selectedBrandKit.logoPath || "n/d"}</span>
                      <span>Font: {selectedBrandKit.fontHeading || "n/d"} / {selectedBrandKit.fontBody || "n/d"}</span>
                    </div>
                  </div>
                ) : (
                  <div className="social-brand-empty">
                    Carica un brand kit locale per precompilare asset path, logo path e palette.
                  </div>
                )}
              </div>

              <div className="social-section">
                <span className="social-section-title">Varianti</span>
                <div className="social-platform-list">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const variants = groupVariants(platform);
                    const allSelected = platform.variantIds.every((id) => selectedVariantIds.includes(id));
                    return (
                      <div
                        key={platform.id}
                        className="social-platform-card"
                        style={{ "--social-accent": getPlatformAccent(platform.id) } as CSSProperties}
                      >
                        <div className="social-platform-head">
                          <div className="social-platform-title">
                            <strong>{platform.name}</strong>
                            <span>{platform.description}</span>
                          </div>
                          <span className="social-platform-badge">{platform.badge}</span>
                        </div>
                        <div className="social-platform-actions">
                          <button type="button" className="social-mini-btn" onClick={() => togglePlatform(platform)}>
                            {allSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                          </button>
                        </div>
                        <div className="social-variant-list">
                          {variants.map((variant) => {
                            const selected = selectedVariantIds.includes(variant.id);
                            return (
                              <div
                                key={variant.id}
                                className={`social-variant-item ${selected ? "selected" : ""}`}
                                onClick={() => toggleVariant(variant.id)}
                              >
                                <span className="social-variant-check">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleVariant(variant.id)}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                </span>
                                <span className="social-variant-info">
                                  <strong>{variant.name}</strong>
                                  <span>{variant.description}</span>
                                </span>
                                <span className="social-variant-meta">
                                  {variant.width}x{variant.height}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        }
        center={
          <div className="social-center">
            <div className="panel-title">Sorgenti</div>
            <ImageGrid
              images={images}
              selectedFiles={selectedFiles}
              onToggleSelect={toggleSelect}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              onClearAll={clearAll}
              scanning={scanning}
            />
            <div className="social-center-footer">
              <button className="btn btn-secondary" onClick={clearAll}>
                Svuota sessione
              </button>
              <div className="social-center-meta">
                <span>{images.length} sorgenti caricate</span>
                <span>{selectedVariants.length} varianti attive</span>
              </div>
            </div>
          </div>
        }
        right={
          <>
            <div className="panel-title">Preview & Snippet</div>
            <div className="social-right-stack">
              <ImagePreview
                image={previewSource}
                targetWidth={activeVariant?.width ?? 1200}
                targetHeight={activeVariant?.height ?? 630}
                resizeMode={resizeMode}
              />

              <div className="social-card">
                <div className="social-card-head">
                  <strong>Snippet meta</strong>
                  <button className="btn btn-sm" onClick={copySnippet}>
                    Copia
                  </button>
                </div>
                <pre className="social-code-block">
                  {snippetPreview || "Configura una variante per vedere lo snippet meta."}
                </pre>
                {snippetStatus ? (
                  <p className={`social-status ${snippetStatusTone === "error" ? "error" : "success"}`}>
                    {snippetStatus}
                  </p>
                ) : null}
              </div>

              <div className="social-card">
                <div className="social-card-head">
                  <strong>Output previsto</strong>
                  <span>{plannedOutputs.length} file</span>
                </div>
                <div className="social-output-list compact">
                  {plannedOutputs.map((item) => (
                    <div key={`${item.label}-${item.filename}`} className="social-output-item">
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.filename}</span>
                      </div>
                      <span>{item.size}</span>
                    </div>
                  ))}
                </div>
                {reportStatus ? (
                  <p className={`social-status ${reportStatusTone === "error" ? "error" : "success"}`}>
                    {reportStatus}
                  </p>
                ) : null}
              </div>

              <div className="social-card">
                <div className="social-card-head">
                  <strong>Report CSV</strong>
                  <button className="btn btn-sm" onClick={handleExportReport} disabled={!summary || loading}>
                    Esporta
                  </button>
                </div>
                {summary ? (
                  <div className="social-output-list">
                    <div className="social-output-item">
                      <div>
                        <strong>{summary.successful}/{summary.total_operations} varianti</strong>
                        <span>{summary.total_files} sorgenti · {summary.failed} errori</span>
                      </div>
                      <span>
                        {formatBytes(summary.total_input_size)} → {formatBytes(summary.total_output_size)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="social-placeholder-text">
                    Dopo la conversione apparira' il riepilogo del batch e potrai esportarlo in CSV.
                  </p>
                )}
              </div>

              <button
                type="button"
                className="btn-convert"
                onClick={handleConvert}
                disabled={loading || scanning || selectedFiles.size === 0 || selectedVariants.length === 0}
              >
                {loading ? (
                  "GENERAZIONE..."
                ) : (
                  <>
                    GENERA SOCIAL PACK
                    <span className="convert-count">
                      {selectedFiles.size * selectedVariants.length} varianti previste
                    </span>
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
