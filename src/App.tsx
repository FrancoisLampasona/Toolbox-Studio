import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import FaviconModule from "./modules/favicon/FaviconModule";
import OptimizeModule from "./optimize/OptimizeModule";
import SrcsetModule from "./modules/srcset/SrcsetModule";
import WordPressModule from "./modules/wordpress/WordPressModule";
import {
  HomeDashboard,
  getInitialShellRoute,
  getModuleById,
  getModuleByRoute,
  getPreferredModuleRoute,
  normalizeShellRoute,
  shellRoutes,
  getEnabledModules,
} from "./shell";
import type { AppSettings } from "./types";

const DEFAULT_SETTINGS: AppSettings = {
  lastInputPaths: [],
  lastOutputPath: null,
  defaultModule: "home",
  lastOptimizeOptions: {
    activePresetKeys: [],
    customWidth: 800,
    customHeight: 600,
    useCustom: false,
    format: "webp",
    quality: 80,
    resizeMode: "cover",
    namingPattern: "{nome}{suffix}_{w}x{h}",
  },
  optimizeProfiles: [],
  lastWordPressOptions: {
    selectedProfileId: "generic-editorial",
    activeComponentIds: [],
    projectSlug: "progetto-wordpress",
    namingPattern: "{profilo}-{componente}-{slug}-{w}x{h}",
    format: "webp",
    quality: 82,
    resizeMode: "cover",
    useFallbackChain: false,
  },
  wordpressProfiles: [],
  lastSrcsetOptions: {
    presetId: "editorial-hero",
    widths: [320, 640, 768, 1024, 1440, 1920],
    sizes: "100vw",
    altText: "",
    namingPattern: "{slug}-{w}w",
    quality: 82,
    resizeMode: "fit",
    includeAvif: true,
    includeWebp: true,
    includeJpeg: true,
  },
  lastFaviconOptions: {
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
  },
};

function mergeSettings(current: AppSettings, partial: Partial<AppSettings>): AppSettings {
  return {
    ...current,
    ...partial,
    lastInputPaths: partial.lastInputPaths ?? current.lastInputPaths,
    lastOutputPath: partial.lastOutputPath ?? current.lastOutputPath,
    defaultModule: partial.defaultModule ?? current.defaultModule,
    lastOptimizeOptions: {
      ...current.lastOptimizeOptions,
      ...partial.lastOptimizeOptions,
      activePresetKeys:
        partial.lastOptimizeOptions?.activePresetKeys ?? current.lastOptimizeOptions.activePresetKeys,
    },
    lastWordPressOptions: {
      ...current.lastWordPressOptions,
      ...partial.lastWordPressOptions,
      activeComponentIds:
        partial.lastWordPressOptions?.activeComponentIds ?? current.lastWordPressOptions.activeComponentIds,
    },
    lastSrcsetOptions: {
      ...current.lastSrcsetOptions,
      ...partial.lastSrcsetOptions,
      widths: partial.lastSrcsetOptions?.widths ?? current.lastSrcsetOptions.widths,
    },
    lastFaviconOptions: {
      ...current.lastFaviconOptions,
      ...partial.lastFaviconOptions,
    },
    optimizeProfiles: partial.optimizeProfiles ?? current.optimizeProfiles,
    wordpressProfiles: partial.wordpressProfiles ?? current.wordpressProfiles,
  };
}

function normalizeLoadedSettings(settings: Partial<AppSettings> | null | undefined): AppSettings {
  return mergeSettings(DEFAULT_SETTINGS, settings ?? {});
}

function syncHistory(route: string, replace = false) {
  if (window.location.pathname === route) {
    return;
  }

  if (replace) {
    window.history.replaceState({}, "", route);
    return;
  }

  window.history.pushState({}, "", route);
}

function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [activeRoute, setActiveRoute] = useState(() => getInitialShellRoute(window.location));
  const [moduleDropRequest, setModuleDropRequest] = useState<{
    moduleId: string;
    requestId: number;
    paths: string[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    invoke<Partial<AppSettings>>("get_app_settings")
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        const normalized = normalizeLoadedSettings(loaded);
        setSettings(normalized);

        const preferredRoute = getPreferredModuleRoute(
          normalized.defaultModule === "home" ? undefined : normalized.defaultModule
        );
        if (window.location.pathname === shellRoutes.home && preferredRoute !== shellRoutes.home) {
          setActiveRoute(normalizeShellRoute(preferredRoute));
          syncHistory(preferredRoute, true);
        }
      })
      .catch((error) => {
        console.error("Errore lettura impostazioni:", error);
      })
      .finally(() => {
        if (!cancelled) {
          setSettingsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveRoute(normalizeShellRoute(window.location.pathname));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!settingsReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      void invoke("set_app_settings", { settings });
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [settings, settingsReady]);

  const openModule = useCallback((moduleId: string) => {
    const route = getModuleById(moduleId)?.route;
    if (!route) {
      return;
    }

    setActiveRoute(normalizeShellRoute(route));
    setSettings((current) => ({
      ...current,
      defaultModule: moduleId,
    }));
    syncHistory(route);
  }, []);

  const openHome = useCallback(() => {
    setActiveRoute(shellRoutes.home);
    setSettings((current) => ({
      ...current,
      defaultModule: "home",
    }));
    syncHistory(shellRoutes.home);
  }, []);

  const handleSettingsChange = useCallback((partial: Partial<AppSettings>) => {
    setSettings((current) => mergeSettings(current, partial));
  }, []);

  const handleHomeModuleDrop = useCallback((moduleId: string, paths: string[]) => {
    if (paths.length === 0) {
      return;
    }

    setModuleDropRequest({
      moduleId,
      requestId: Date.now(),
      paths,
    });
    openModule(moduleId);
  }, [openModule]);

  const handleDroppedPathsRequestHandled = useCallback((requestId: number) => {
    setModuleDropRequest((current) => {
      if (!current || current.requestId !== requestId) {
        return current;
      }
      return null;
    });
  }, []);

  return (
    <div className="suite-root">
      <div className={`shell-view ${activeRoute === shellRoutes.home ? "active" : "hidden"}`}>
        <HomeDashboard
          active={activeRoute === shellRoutes.home}
          modules={getEnabledModules()}
          activeModuleId={getModuleByRoute(activeRoute)?.id}
          defaultModuleId={settings.defaultModule}
          recentPaths={settings.lastInputPaths}
          onOpenModule={openModule}
          onDropModulePaths={handleHomeModuleDrop}
        />
      </div>

      {settingsReady ? (
        <OptimizeModule
          active={activeRoute === shellRoutes.optimize}
          initialSettings={settings}
          droppedPathsRequest={
            moduleDropRequest?.moduleId === "optimize"
              ? {
                  id: moduleDropRequest.requestId,
                  paths: moduleDropRequest.paths,
                }
              : null
          }
          onDroppedPathsRequestHandled={handleDroppedPathsRequestHandled}
          onBackHome={openHome}
          onSettingsChange={handleSettingsChange}
        />
      ) : null}

      {settingsReady ? (
        <WordPressModule
          active={activeRoute === shellRoutes.wordpress}
          initialSettings={settings}
          onBackHome={openHome}
          onSettingsChange={handleSettingsChange}
        />
      ) : null}

      {settingsReady ? (
        <SrcsetModule
          active={activeRoute === shellRoutes.srcset}
          initialSettings={settings}
          onBackHome={openHome}
          onSettingsChange={handleSettingsChange}
        />
      ) : null}

      {settingsReady ? (
        <FaviconModule
          active={activeRoute === shellRoutes.favicon}
          initialSettings={settings}
          onBackHome={openHome}
          onSettingsChange={handleSettingsChange}
        />
      ) : null}
    </div>
  );
}

export default App;
