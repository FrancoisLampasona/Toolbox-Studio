import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import "../../App.css";
import "./wordpress.css";
import BatchProgress from "../../components/BatchProgress";
import ImageGrid from "../../components/ImageGrid";
import ImagePreview from "../../components/ImagePreview";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type {
  AppSettings,
  ConvertJob,
  ConvertSummary,
  ExportWordPressProfilesRequest,
  ImageInfo,
  ImportWordPressProfilesResult,
  OutputFormat,
  ResizeMode,
  ThumbnailHydrationProgress,
  SaveWordPressProfileRequest,
  WordPressComponentPreset,
  WordPressProfile,
  WordPressThemeProfile,
} from "../../types";
import {
  WORDPRESS_DEFAULT_NAMING,
  WORDPRESS_THEME_PROFILES,
} from "./profiles";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

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

function buildWordPressNamingPreview({
  pattern,
  filename,
  format,
  component,
  projectSlug,
  sequence,
}: {
  pattern: string;
  filename: string;
  format: OutputFormat;
  component: WordPressComponentPreset;
  projectSlug: string;
  sequence: number;
}): string {
  const sourceStem = stemFromFilename(filename) || "image";
  let outputStem = (pattern.trim() || WORDPRESS_DEFAULT_NAMING)
    .replaceAll("{profilo}", slugify(projectSlug) || "progetto")
    .replaceAll("{componente}", slugify(component.name) || "component")
    .replaceAll("{slug}", slugify(sourceStem) || "image")
    .replaceAll("{nome}", sanitizeFileLabel(sourceStem))
    .replaceAll("{preset}", slugify(component.name) || "component")
    .replaceAll("{w}", String(component.width))
    .replaceAll("{h}", String(component.height))
    .replaceAll("{n}", String(sequence).padStart(3, "0"))
    .replaceAll("{formato}", format === "jpeg" ? "jpg" : format);

  outputStem = sanitizeFileLabel(outputStem);
  const extension = format === "jpeg" ? "jpg" : format;
  return `${outputStem}.${extension}`;
}

function getWordPressOutputFormats(useFallbackChain: boolean, singleFormat: OutputFormat): OutputFormat[] {
  if (useFallbackChain) {
    return ["avif", "webp", "jpeg"];
  }

  return [singleFormat];
}

function defaultComponentIds(profile: WordPressThemeProfile): Set<string> {
  return new Set(
    profile.components
      .filter((component) => component.defaultEnabled)
      .map((component) => component.id)
  );
}

function summarizeSelection(profile: WordPressThemeProfile, activeComponentIds: Set<string>) {
  return profile.components.filter((component) => activeComponentIds.has(component.id));
}

function buildWordPressProfileSnapshot(
  profile: WordPressThemeProfile,
  activeComponentIds: Set<string>
): WordPressComponentPreset[] {
  return profile.components.map((component) => ({
    ...component,
    defaultEnabled: activeComponentIds.has(component.id),
  }));
}

function isBuiltInWordPressProfile(profileId: string | null): boolean {
  if (!profileId) {
    return false;
  }

  return WORDPRESS_THEME_PROFILES.some((profile) => profile.id === profileId);
}

function normalizeWordPressProfiles(profiles: WordPressProfile[]): WordPressProfile[] {
  return [...profiles].sort(
    (left, right) => right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name)
  );
}

export default function WordPressModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [customProfiles, setCustomProfiles] = useState<WordPressProfile[]>([]);
  const [profileId, setProfileId] = useState(WORDPRESS_THEME_PROFILES[0]?.id ?? "");
  const [activeComponentIds, setActiveComponentIds] = useState<Set<string>>(
    defaultComponentIds(WORDPRESS_THEME_PROFILES[0])
  );
  const [profileName, setProfileName] = useState("");
  const [projectSlug, setProjectSlug] = useState("progetto-wordpress");
  const [namingPattern, setNamingPattern] = useState(WORDPRESS_DEFAULT_NAMING);
  const [format, setFormat] = useState<OutputFormat>("webp");
  const [quality, setQuality] = useState(82);
  const [resizeMode, setResizeMode] = useState<ResizeMode>("cover");
  const [useFallbackChain, setUseFallbackChain] = useState(false);
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
  const [savingProfile, setSavingProfile] = useState(false);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const [exportingProfiles, setExportingProfiles] = useState(false);
  const [importingProfiles, setImportingProfiles] = useState(false);
  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [profileStatusTone, setProfileStatusTone] = useState<"success" | "error" | null>(null);
  const [profileTransferStatus, setProfileTransferStatus] = useState<string | null>(null);
  const [profileTransferStatusTone, setProfileTransferStatusTone] = useState<"success" | "error" | null>(null);

  const imagesRef = useRef<ImageInfo[]>([]);
  const inputPathsRef = useRef<string[]>([]);
  const thumbQueueRef = useRef<string[]>([]);
  const thumbInflightRef = useRef(new Set<string>());
  const thumbLoadedRef = useRef(new Set<string>());
  const thumbFailedRef = useRef(new Set<string>());
  const thumbTimerRef = useRef<number | null>(null);
  const hydratedSettingsRef = useRef(false);
  const profilesLoadedRef = useRef(false);
  const wordpressSaveTimerRef = useRef<number | null>(null);

  const allProfiles = useMemo<WordPressThemeProfile[]>(
    () => [...WORDPRESS_THEME_PROFILES, ...customProfiles],
    [customProfiles]
  );
  const activeProfile = useMemo(
    () => allProfiles.find((profile) => profile.id === profileId) ?? allProfiles[0] ?? WORDPRESS_THEME_PROFILES[0],
    [allProfiles, profileId]
  );
  const selectedComponents = useMemo(
    () => summarizeSelection(activeProfile, activeComponentIds),
    [activeProfile, activeComponentIds]
  );
  const primaryComponent = selectedComponents[0] ?? activeProfile.components[0];
  const isCustomProfile = useMemo(() => !isBuiltInWordPressProfile(profileId), [profileId]);

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
    if (!initialSettings || hydratedSettingsRef.current) {
      return;
    }

    hydratedSettingsRef.current = true;
    const wordpressSettings = initialSettings.lastWordPressOptions;
    if (initialSettings.lastOutputPath) {
      setOutputPath(initialSettings.lastOutputPath);
    }
    if (initialSettings.wordpressProfiles?.length) {
      setCustomProfiles(normalizeWordPressProfiles(initialSettings.wordpressProfiles));
    }
    if (wordpressSettings) {
      setProfileId(wordpressSettings.selectedProfileId || WORDPRESS_THEME_PROFILES[0]?.id || "");
      setActiveComponentIds(new Set(wordpressSettings.activeComponentIds || []));
      setProjectSlug(wordpressSettings.projectSlug || "progetto-wordpress");
      setNamingPattern(wordpressSettings.namingPattern || WORDPRESS_DEFAULT_NAMING);
      setFormat(wordpressSettings.format || "webp");
      setQuality(wordpressSettings.quality || 82);
      setResizeMode(wordpressSettings.resizeMode || "cover");
      setUseFallbackChain(wordpressSettings.useFallbackChain ?? false);
    }
  }, [initialSettings]);

  useEffect(() => {
    if (!hydratedSettingsRef.current || profilesLoadedRef.current) {
      return;
    }

    profilesLoadedRef.current = true;
    let cancelled = false;

    invoke<WordPressProfile[]>("get_wordpress_profiles")
      .then((loadedProfiles) => {
        if (cancelled) {
          return;
        }

        const normalized = normalizeWordPressProfiles(loadedProfiles);
        setCustomProfiles(normalized);
        onSettingsChange({ wordpressProfiles: normalized });
      })
      .catch((error) => {
        console.error("Errore caricamento profili WordPress:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [onSettingsChange]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    inputPathsRef.current = inputPaths;
    onSettingsChange({
      lastInputPaths: inputPaths,
      lastOutputPath: outputPath,
    });
  }, [inputPaths, onSettingsChange, outputPath]);

  useEffect(() => {
    setActiveComponentIds((current) => {
      if (current.size > 0 && activeProfile.components.some((component) => current.has(component.id))) {
        const validNext = new Set(
          Array.from(current).filter((componentId) =>
            activeProfile.components.some((component) => component.id === componentId)
          )
        );
        if (validNext.size > 0) {
          return validNext;
        }
      }

      return defaultComponentIds(activeProfile);
    });
    setProfileName(activeProfile.name);
  }, [activeProfile]);

  useEffect(() => {
    if (!hydratedSettingsRef.current) {
      return;
    }

    if (wordpressSaveTimerRef.current) {
      window.clearTimeout(wordpressSaveTimerRef.current);
    }

    wordpressSaveTimerRef.current = window.setTimeout(() => {
      onSettingsChange({
        lastWordPressOptions: {
          selectedProfileId: profileId || null,
          activeComponentIds: Array.from(activeComponentIds),
          projectSlug,
          namingPattern,
          format,
          quality,
          resizeMode,
          useFallbackChain,
        },
        wordpressProfiles: customProfiles,
      });
    }, 250);

    return () => {
      if (wordpressSaveTimerRef.current) {
        window.clearTimeout(wordpressSaveTimerRef.current);
      }
    };
  }, [
    activeComponentIds,
    customProfiles,
    format,
    namingPattern,
    onSettingsChange,
    profileId,
    projectSlug,
    quality,
    resizeMode,
    useFallbackChain,
  ]);

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
      console.error("Errore thumbnail WordPress:", error);
    } finally {
      thumbInflightRef.current.delete(path);
      if (thumbInflightRef.current.size === 0 && thumbQueueRef.current.length === 0) {
        updateThumbnailProgress(imagesRef.current, null);
      }
      void flushThumbnailQueue();
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
      const scanned = await invoke<ImageInfo[]>("scan_paths", {
        paths: normalizedPaths,
        rememberedPaths: mode === "replace" ? normalizedPaths : dedupePaths([...inputPathsRef.current, ...normalizedPaths]),
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
      console.error("Errore scansione WordPress:", error);
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
  };

  const toggleComponent = (componentId: string) => {
    setActiveComponentIds((current) => {
      const next = new Set(current);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  };

  const selectRecommendedComponents = () => {
    setActiveComponentIds(defaultComponentIds(activeProfile));
  };

  const selectAllComponents = () => {
    setActiveComponentIds(new Set(activeProfile.components.map((component) => component.id)));
  };

  const clearComponents = () => {
    setActiveComponentIds(new Set());
  };

  const syncCustomProfiles = useCallback((nextProfiles: WordPressProfile[]) => {
    const normalized = normalizeWordPressProfiles(nextProfiles);
    setCustomProfiles(normalized);
    onSettingsChange({ wordpressProfiles: normalized });
  }, [onSettingsChange]);

  const applyProfile = useCallback((nextProfileId: string) => {
    const nextProfile = allProfiles.find((profile) => profile.id === nextProfileId);
    if (!nextProfile) {
      return;
    }

    setProfileId(nextProfile.id);
    setProfileName(nextProfile.name);
    setActiveComponentIds(defaultComponentIds(nextProfile));
    setProfileStatus(`Profilo "${nextProfile.name}" applicato.`);
    setProfileStatusTone("success");
  }, [allProfiles]);

  const saveProfile = useCallback(async (mode: "create" | "update") => {
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileStatus("Inserisci un nome profilo WordPress.");
      setProfileStatusTone("error");
      return;
    }

    if (mode === "update" && !isCustomProfile) {
      setProfileStatus("Puoi aggiornare solo profili WordPress custom.");
      setProfileStatusTone("error");
      return;
    }

    setSavingProfile(true);
    setProfileStatus(null);
    setProfileStatusTone(null);

    const request: SaveWordPressProfileRequest = {
      id: mode === "update" ? profileId : null,
      name: trimmedName,
      description: activeProfile.description,
      note: activeProfile.note,
      components: buildWordPressProfileSnapshot(activeProfile, activeComponentIds),
    };

    try {
      const savedProfile = await invoke<WordPressProfile>("save_wordpress_profile", { request });
      const nextProfiles = [...customProfiles.filter((profile) => profile.id !== savedProfile.id), savedProfile];
      syncCustomProfiles(nextProfiles);
      setProfileId(savedProfile.id);
      setProfileName(savedProfile.name);
      setProfileStatus(
        mode === "update"
          ? `Profilo WordPress "${savedProfile.name}" aggiornato.`
          : `Profilo WordPress "${savedProfile.name}" salvato.`
      );
      setProfileStatusTone("success");
    } catch (error) {
      console.error("Errore salvataggio profilo WordPress:", error);
      setProfileStatus(getErrorMessage(error, "Impossibile salvare il profilo WordPress."));
      setProfileStatusTone("error");
    } finally {
      setSavingProfile(false);
    }
  }, [
    activeComponentIds,
    activeProfile,
    customProfiles,
    isCustomProfile,
    profileId,
    profileName,
    syncCustomProfiles,
  ]);

  const deleteProfile = useCallback(async () => {
    if (!profileId || !isCustomProfile) {
      setProfileStatus("Seleziona un profilo WordPress custom da eliminare.");
      setProfileStatusTone("error");
      return;
    }

    setDeletingProfile(true);
    setProfileStatus(null);
    setProfileStatusTone(null);

    try {
      const nextProfiles = await invoke<WordPressProfile[]>("delete_wordpress_profile", {
        id: profileId,
      });
      syncCustomProfiles(nextProfiles);
      const fallbackProfile = WORDPRESS_THEME_PROFILES[0];
      setProfileId(fallbackProfile?.id ?? "");
      setProfileName(fallbackProfile?.name ?? "");
      setProfileStatus("Profilo WordPress eliminato.");
      setProfileStatusTone("success");
    } catch (error) {
      console.error("Errore eliminazione profilo WordPress:", error);
      setProfileStatus(getErrorMessage(error, "Impossibile eliminare il profilo WordPress."));
      setProfileStatusTone("error");
    } finally {
      setDeletingProfile(false);
    }
  }, [isCustomProfile, profileId, syncCustomProfiles]);

  const exportProfile = useCallback(async () => {
    const selectedProfile = allProfiles.find((profile) => profile.id === profileId) ?? activeProfile;
    if (!selectedProfile) {
      setProfileTransferStatus("Seleziona un profilo WordPress da esportare.");
      setProfileTransferStatusTone("error");
      return;
    }

    const profileSlug = slugify(selectedProfile.name) || "wordpress-profile";
    const defaultPath = outputPath
      ? `${outputPath}/toolbox-wordpress-${profileSlug}.json`
      : `toolbox-wordpress-${profileSlug}.json`;

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
      const request: ExportWordPressProfilesRequest = {
        destinationPath: selected,
        profiles: [
          {
            name: selectedProfile.name,
            description: selectedProfile.description,
            note: selectedProfile.note,
            components: buildWordPressProfileSnapshot(selectedProfile, activeComponentIds),
          },
        ],
      };
      const savedPath = await invoke<string>("export_wordpress_profiles", { request });
      setProfileTransferStatus(`Profilo WordPress esportato in ${savedPath}.`);
      setProfileTransferStatusTone("success");
    } catch (error) {
      console.error("Errore export profili WordPress:", error);
      setProfileTransferStatus(getErrorMessage(error, "Impossibile esportare il profilo WordPress."));
      setProfileTransferStatusTone("error");
    } finally {
      setExportingProfiles(false);
    }
  }, [activeComponentIds, activeProfile, allProfiles, outputPath, profileId]);

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
      const result = await invoke<ImportWordPressProfilesResult>("import_wordpress_profiles", {
        request: { sourcePaths },
      });

      syncCustomProfiles(result.profiles);

      const firstImported = result.importedProfiles[0] || null;
      if (firstImported) {
        applyProfile(firstImported.id);
      }

      const importedCount = result.importedCount;
      const failedCount = result.failedFiles.length;
      const firstFailure = result.failedFiles[0];
      const baseMessage =
        failedCount > 0
          ? `Importati ${importedCount} profili WordPress, ${failedCount} file non importati.`
          : `Importati ${importedCount} profili WordPress JSON.`;
      const detailMessage = firstFailure
        ? ` Primo errore: ${firstFailure.sourcePath} - ${firstFailure.error}`
        : "";

      setProfileTransferStatus(`${baseMessage}${detailMessage}`);
      setProfileTransferStatusTone(failedCount > 0 ? "error" : "success");
    } catch (error) {
      console.error("Errore import profili WordPress:", error);
      setProfileTransferStatus(getErrorMessage(error, "Impossibile importare i profili WordPress."));
      setProfileTransferStatusTone("error");
    } finally {
      setImportingProfiles(false);
    }
  }, [applyProfile, syncCustomProfiles]);

  const outputFormats = useMemo(
    () => getWordPressOutputFormats(useFallbackChain, format),
    [format, useFallbackChain]
  );

  const buildJobs = (): ConvertJob[] =>
    selectedComponents.flatMap((component) =>
      outputFormats.map((nextFormat) => ({
        width: component.width,
        height: component.height,
        quality,
        format: nextFormat,
        resize_mode: resizeMode,
        suffix: component.suffix,
      }))
    );

  const handleConvert = async () => {
    const files = images
      .filter((image) => selectedFiles.has(image.path))
      .map((image) => image.path);

    if (files.length === 0) {
      setReportStatus("Seleziona almeno una sorgente per il batch WordPress.");
      setReportStatusTone("error");
      return;
    }

    if (selectedComponents.length === 0) {
      setReportStatus("Attiva almeno un componente del profilo tema.");
      setReportStatusTone("error");
      return;
    }

    let finalOutputPath = outputPath;
    if (!finalOutputPath) {
      finalOutputPath = await chooseOutput();
    }

    if (!finalOutputPath) {
      setReportStatus("Scegli una cartella output per il batch WordPress.");
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
          profile_name: projectSlug,
        },
      });
      setSummary(result);
      setReportStatus(
        useFallbackChain
          ? `Batch WordPress completato: ${result.successful}/${result.total_operations} varianti multi-formato generate.`
          : `Batch WordPress completato: ${result.successful}/${result.total_operations} varianti generate.`
      );
      setReportStatusTone("success");
    } catch (error) {
      console.error("Errore conversione WordPress:", error);
      setReportStatus(getErrorMessage(error, "Impossibile completare il batch WordPress."));
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
      defaultPath: outputPath ? `${outputPath}/wordpress-media-report-${timestamp}.csv` : `wordpress-media-report-${timestamp}.csv`,
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
      console.error("Errore export report WordPress:", error);
      setReportStatus("Impossibile esportare il report CSV del batch WordPress.");
      setReportStatusTone("error");
    } finally {
      setExportingReport(false);
    }
  };

  const namingPreview = useMemo(() => {
    if (!primaryComponent) {
      return "Seleziona un componente";
    }

    const sourceImage =
      previewImage ||
      images.find((image) => selectedFiles.has(image.path)) ||
      images.find((image) => !image.error);

    return buildWordPressNamingPreview({
      pattern: namingPattern,
      filename: sourceImage?.filename ?? "hero.jpg",
      format: useFallbackChain ? "avif" : format,
      component: primaryComponent,
      projectSlug,
      sequence: 1,
    });
  }, [format, images, namingPattern, previewImage, primaryComponent, projectSlug, selectedFiles, useFallbackChain]);

  const snippetPreview = useMemo(() => {
    if (!primaryComponent) {
      return "";
    }

    const assetFolder = slugify(projectSlug) || "progetto";
    const basePath = `<?php echo get_template_directory_uri(); ?>/assets/img/${assetFolder}/`;

    if (useFallbackChain) {
      const avifName = buildWordPressNamingPreview({
        pattern: namingPattern,
        filename: previewImage?.filename ?? "hero.jpg",
        format: "avif",
        component: primaryComponent,
        projectSlug,
        sequence: 1,
      });
      const webpName = buildWordPressNamingPreview({
        pattern: namingPattern,
        filename: previewImage?.filename ?? "hero.jpg",
        format: "webp",
        component: primaryComponent,
        projectSlug,
        sequence: 1,
      });
      const jpegName = buildWordPressNamingPreview({
        pattern: namingPattern,
        filename: previewImage?.filename ?? "hero.jpg",
        format: "jpeg",
        component: primaryComponent,
        projectSlug,
        sequence: 1,
      });

      return `<picture>
  <source srcset="${basePath}${avifName}" type="image/avif">
  <source srcset="${basePath}${webpName}" type="image/webp">
  <img src="${basePath}${jpegName}" alt="" loading="lazy" decoding="async" width="${primaryComponent.width}" height="${primaryComponent.height}">
</picture>`;
    }

    return `<img src="${basePath}${namingPreview}" alt="" loading="lazy" decoding="async" width="${primaryComponent.width}" height="${primaryComponent.height}">`;
  }, [namingPattern, namingPreview, previewImage?.filename, primaryComponent, projectSlug, useFallbackChain]);

  const totalOps = selectedFiles.size * selectedComponents.length * outputFormats.length;

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo">W</div>
          <div className="header-brand-copy">
            <h1>WordPress<span>Media</span></h1>
            <span className="header-subtitle">Workflow tema e componenti per Toolbox Creative Studio</span>
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
        storageKey="toolbox-layout-wordpress-v1"
        defaultLeftWidth={300}
        defaultRightWidth={320}
        leftMinWidth={250}
        leftMaxWidth={440}
        rightMinWidth={280}
        rightMaxWidth={480}
        centerMinWidth={440}
        left={
          <>
            <div className="panel-title">Profilo Tema</div>
            <div className="wp-profile-panel">
              <div className="wp-profile-card">
                <select
                  className="wp-profile-select"
                  value={activeProfile.id}
                  onChange={(event) => applyProfile(event.target.value)}
                >
                  <optgroup label="Built-in">
                    {WORDPRESS_THEME_PROFILES.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </optgroup>
                  {customProfiles.length > 0 ? (
                    <optgroup label="Custom locali">
                      {customProfiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
                <p className="wp-profile-note">{activeProfile.description}</p>
                <p className="wp-hint">{activeProfile.note}</p>
              </div>

              <div className="wp-profile-card">
                <div className="wp-profile-headline">
                  <strong>Profili WordPress</strong>
                  <span>{isCustomProfile ? "Custom" : "Built-in"}</span>
                </div>
                <input
                  className="wp-text-input"
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Nome profilo custom"
                  maxLength={64}
                />
                <div className="profile-actions-row">
                  <button
                    className="btn btn-sm"
                    onClick={() => void saveProfile("create")}
                    disabled={savingProfile || deletingProfile || exportingProfiles || importingProfiles}
                  >
                    {savingProfile && !isCustomProfile ? "Salvataggio..." : "Salva copia"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => void saveProfile("update")}
                    disabled={!isCustomProfile || savingProfile || deletingProfile || exportingProfiles || importingProfiles}
                  >
                    {savingProfile && isCustomProfile ? "Aggiornamento..." : "Aggiorna"}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => void deleteProfile()}
                    disabled={!isCustomProfile || savingProfile || deletingProfile || exportingProfiles || importingProfiles}
                  >
                    {deletingProfile ? "Eliminazione..." : "Elimina"}
                  </button>
                </div>
                <div className="profile-actions-row">
                  <button
                    className="btn btn-sm"
                    onClick={() => void exportProfile()}
                    disabled={savingProfile || deletingProfile || exportingProfiles || importingProfiles}
                  >
                    {exportingProfiles ? "Esportazione..." : "Esporta JSON"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => void importProfiles()}
                    disabled={savingProfile || deletingProfile || exportingProfiles || importingProfiles}
                  >
                    {importingProfiles ? "Importazione..." : "Importa JSON"}
                  </button>
                </div>
                {profileStatus ? (
                  <div className={`report-status ${profileStatusTone === "error" ? "error" : "success"}`}>
                    {profileStatus}
                  </div>
                ) : null}
                {profileTransferStatus ? (
                  <div className={`report-status ${profileTransferStatusTone === "error" ? "error" : "success"}`}>
                    {profileTransferStatus}
                  </div>
                ) : null}
                <p className="wp-hint">
                  Salvi una copia locale del profilo corrente con i componenti attivi come default, oppure importi/esporti JSON.
                </p>
              </div>

              <div className="wp-component-toolbar">
                <button className="btn btn-sm" onClick={selectRecommendedComponents}>
                  Consigliati
                </button>
                <button className="btn btn-sm" onClick={selectAllComponents}>
                  Tutti
                </button>
                <button className="btn btn-sm btn-danger" onClick={clearComponents}>
                  Nessuno
                </button>
              </div>

              <div className="wp-component-list">
                {activeProfile.components.map((component) => {
                  const isActive = activeComponentIds.has(component.id);
                  return (
                    <label
                      key={component.id}
                      className={`wp-component-card ${isActive ? "active" : ""}`}
                    >
                      <div className="wp-component-check">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={() => toggleComponent(component.id)}
                        />
                      </div>
                      <div className="wp-component-copy">
                        <div className="wp-component-topline">
                          <strong>{component.name}</strong>
                          <span>{component.width}x{component.height}</span>
                        </div>
                        <p>{component.description}</p>
                        <div className="wp-component-meta">
                          <span className="wp-component-chip">{component.suffix.replace(/^_/, "")}</span>
                          {component.defaultEnabled ? <span className="wp-component-chip">Consigliato</span> : null}
                        </div>
                      </div>
                    </label>
                  );
                })}
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
              targetWidth={primaryComponent?.width || 1200}
              targetHeight={primaryComponent?.height || 800}
              resizeMode={resizeMode}
            />

            <div className="settings-panel">
              <div className="panel-title">Setup WordPress</div>

              <div className="setting-group">
                <span className="setting-label">Progetto / Slug</span>
                <input
                  className="profile-name-input"
                  type="text"
                  value={projectSlug}
                  onChange={(event) => setProjectSlug(event.target.value)}
                  placeholder="nome-progetto"
                  spellCheck={false}
                />
              </div>

              <div className="setting-group">
                <span className="setting-label">Formato Output</span>
                <div className="format-buttons">
                  {(["webp", "avif", "jpeg", "png"] as OutputFormat[]).map((nextFormat) => (
                    <button
                      key={nextFormat}
                      className={`format-btn ${format === nextFormat ? "active" : ""}`}
                      onClick={() => setFormat(nextFormat)}
                    >
                      {nextFormat.toUpperCase()}
                    </button>
                  ))}
                </div>
                <p className="wp-hint">
                  {useFallbackChain
                    ? "Con fallback attivo il batch genera sempre AVIF + WebP + JPEG per ogni componente."
                    : "Formato singolo: il batch usa solo il formato selezionato qui sopra."}
                </p>
              </div>

              <div className="setting-group">
                <span className="setting-label">Compatibilita` WordPress</span>
                <div className="wp-inline-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={useFallbackChain}
                      onChange={(event) => setUseFallbackChain(event.target.checked)}
                    />
                    Fallback AVIF + WebP + JPEG
                  </label>
                  <span className="wp-meta-pill">
                    {useFallbackChain ? "picture" : "single"}
                  </span>
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
                <span className="setting-label">Ridimensionamento</span>
                <div className="format-buttons">
                  <button
                    className={`format-btn ${resizeMode === "cover" ? "active" : ""}`}
                    onClick={() => setResizeMode("cover")}
                  >
                    Cover
                  </button>
                  <button
                    className={`format-btn ${resizeMode === "fit" ? "active" : ""}`}
                    onClick={() => setResizeMode("fit")}
                  >
                    Fit
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Naming WordPress</span>
                <div className="naming-summary">
                  <input
                    type="text"
                    className="profile-name-input"
                    value={namingPattern}
                    onChange={(event) => setNamingPattern(event.target.value)}
                    placeholder={WORDPRESS_DEFAULT_NAMING}
                    spellCheck={false}
                  />
                  <div className="naming-token-list" aria-label="Token naming disponibili">
                    {["{profilo}", "{componente}", "{slug}", "{nome}", "{w}", "{h}", "{n}", "{formato}"].map((token) => (
                      <span key={token} className="naming-token-chip">
                        {token}
                      </span>
                    ))}
                  </div>
                  <div className="naming-preview-card">
                    <span className="path-summary-label">Preview</span>
                    <strong>{namingPreview}</strong>
                  </div>
                </div>
              </div>

              <div className="setting-group">
                <span className="setting-label">Batch WordPress</span>
                <div className="wp-summary-grid">
                  <div className="wp-summary-card">
                    <span>Sorgenti</span>
                    <strong>{selectedFiles.size}</strong>
                  </div>
                  <div className="wp-summary-card">
                    <span>Componenti</span>
                    <strong>{selectedComponents.length}</strong>
                  </div>
                  <div className="wp-summary-card">
                    <span>Operazioni</span>
                    <strong>{totalOps}</strong>
                  </div>
                  <div className="wp-summary-card">
                    <span>Profilo</span>
                    <strong>{activeProfile.name}</strong>
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
                <span className="setting-label">Snippet Starter</span>
                <div className="wp-snippet-card">
                  <p className="wp-hint">
                    Primo snippet statico utile per temi che servono asset dal tema, basato sul componente attivo principale.
                  </p>
                  <pre>{snippetPreview}</pre>
                </div>
              </div>

              <div className="setting-group">
                <div className="profile-actions-row">
                  <button className="btn btn-primary" onClick={() => void handleConvert()} disabled={loading}>
                    {loading ? "Generazione..." : "Genera Batch WP"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void handleExportReport()}
                    disabled={!summary || exportingReport}
                  >
                    {exportingReport ? "Export..." : "Esporta CSV"}
                  </button>
                </div>
                {reportStatus ? (
                  <div className={`report-status ${reportStatusTone === "error" ? "error" : "success"}`}>
                    {reportStatus}
                  </div>
                ) : null}
              </div>
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
