import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./shell.css";
import type { HomeDashboardProps } from "./types";
import type { ModuleConfig } from "../modules/optimize/config";

const OPTIMIZE_MODULE_ID = "optimize";

/* ---- Category grouping ---- */

interface CategoryGroup {
  label: string;
  icon: string;
  modules: ModuleConfig[];
}

function groupByCategory(modules: ModuleConfig[]): {
  hero: ModuleConfig | null;
  groups: CategoryGroup[];
} {
  const hero = modules.find((m) => m.id === OPTIMIZE_MODULE_ID) ?? null;
  const rest = modules.filter((m) => m.id !== OPTIMIZE_MODULE_ID);

  const categoryMap: Record<string, string> = {
    "Web Workflow": "🌐",
    "Video Workflow": "🎬",
    "Utility Workflow": "⚡",
    Workflow: "⚡",
    Collaborazione: "👥",
  };

  const categoryOrder = [
    "Web Workflow",
    "Video Workflow",
    "Utility Workflow",
    "Workflow",
    "Collaborazione",
  ];

  const grouped = new Map<string, ModuleConfig[]>();
  for (const m of rest) {
    const cat = m.category ?? "Altro";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(m);
  }

  const utilityMods = [
    ...(grouped.get("Utility Workflow") ?? []),
    ...(grouped.get("Workflow") ?? []),
  ];
  if (utilityMods.length > 0) {
    grouped.delete("Utility Workflow");
    grouped.delete("Workflow");
    grouped.set("Strumenti & Utility", utilityMods);
  }

  const groups: CategoryGroup[] = [];

  for (const cat of categoryOrder) {
    if (grouped.has(cat)) {
      groups.push({
        label: cat,
        icon: categoryMap[cat] ?? "📦",
        modules: grouped.get(cat)!,
      });
      grouped.delete(cat);
    }
  }

  if (grouped.has("Strumenti & Utility")) {
    groups.push({
      label: "Strumenti & Utility",
      icon: "⚡",
      modules: grouped.get("Strumenti & Utility")!,
    });
    grouped.delete("Strumenti & Utility");
  }

  for (const [cat, mods] of grouped) {
    groups.push({ label: cat, icon: "📦", modules: mods });
  }

  return { hero, groups };
}

/* ---- Helpers ---- */

function getModuleHighlights(module: ModuleConfig): string[] {
  if (module.highlights && module.highlights.length > 0) return module.highlights;
  return ["Modulo"];
}

function formatPathPreview(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.slice(-3).join(" / ") || path;
}

/* ---- Card Components ---- */

function HeroCard({
  module,
  isDropActive,
  dropItemCount,
  onOpenModule,
}: {
  module: ModuleConfig;
  isDropActive: boolean;
  dropItemCount: number;
  onOpenModule: (id: string) => void;
}) {
  const highlights = getModuleHighlights(module);

  return (
    <button
      type="button"
      className={`hero-card hero-card--${module.id}${isDropActive ? " hero-card--drop-active" : ""}`}
      onClick={() => onOpenModule(module.id)}
    >
      <div className="hero-card-glow" aria-hidden="true" />
      <div className="hero-card-content">
        <div className="hero-card-left">
          <div className="hero-card-icon" aria-hidden="true">
            {module.icon || "C"}
          </div>
          <div className="hero-card-info">
            {module.category ? (
              <span className="hero-card-category">{module.category}</span>
            ) : null}
            <h2>{module.name}</h2>
            <p>{module.description ?? "Modulo principale"}</p>
          </div>
        </div>
        <div className="hero-card-right">
          <div className="hero-card-chips">
            {highlights.map((h) => (
              <span key={h} className="hero-card-chip">{h}</span>
            ))}
          </div>
          <div className="hero-card-cta">
            {module.statusLabel ? (
              <span className="hero-card-status">{module.statusLabel}</span>
            ) : null}
            <span className="hero-card-arrow">
              Apri <span>→</span>
            </span>
          </div>
        </div>
      </div>

      {isDropActive ? (
        <div className="hero-card-drop-overlay">
          <div className="hero-card-drop-bounce">↓</div>
          Rilascia {dropItemCount} {dropItemCount === 1 ? "elemento" : "elementi"}
        </div>
      ) : null}
    </button>
  );
}

function ModuleCard({
  module,
  index,
  onOpenModule,
}: {
  module: ModuleConfig;
  index: number;
  onOpenModule: (id: string) => void;
}) {
  const highlights = getModuleHighlights(module);

  return (
    <button
      type="button"
      className={`mod-card mod-card--${module.id}`}
      style={{ "--card-i": index } as React.CSSProperties}
      onClick={() => onOpenModule(module.id)}
    >
      <div className="mod-card-accent" aria-hidden="true" />
      <div className="mod-card-inner">
        <div className="mod-card-head">
          <div className="mod-card-icon" aria-hidden="true">
            {module.icon || "M"}
          </div>
          <div className="mod-card-title">
            <h3>{module.name}</h3>
            {module.statusLabel ? (
              <span className={`mod-card-status mod-card-status--${module.statusLabel.toLowerCase()}`}>
                {module.statusLabel}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mod-card-desc">{module.description ?? "Modulo disponibile"}</p>
        <div className="mod-card-chips">
          {highlights.slice(0, 3).map((h) => (
            <span key={h} className="mod-card-chip">{h}</span>
          ))}
          {highlights.length > 3 ? (
            <span className="mod-card-chip mod-card-chip--more">+{highlights.length - 3}</span>
          ) : null}
        </div>
      </div>
      <div className="mod-card-footer">
        <span>Apri modulo</span>
        <span className="mod-card-arrow">→</span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function HomeDashboard({
  active = true,
  modules,
  defaultModuleId: _defaultModuleId,
  recentPaths = [],
  onOpenModule,
  onDropModulePaths,
  onOpenSettings,
}: HomeDashboardProps) {
  const orderedModules = useMemo(
    () => [...modules].sort((a, b) => a.priority - b.priority),
    [modules],
  );

  const { hero, groups } = useMemo(
    () => groupByCategory(orderedModules),
    [orderedModules],
  );

  const recentSummary =
    recentPaths.length > 0
      ? formatPathPreview(recentPaths[0])
      : null;

  /* ---- Tabs ---- */
  const [activeTab, setActiveTab] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const trackRef = useRef<HTMLDivElement>(null);

  const handleTabChange = useCallback(
    (idx: number) => {
      if (idx === activeTab) return;
      setSlideDir(idx > activeTab ? "right" : "left");
      setActiveTab(idx);
    },
    [activeTab],
  );

  useEffect(() => {
    if (!active || groups.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveTab((prev) => {
          const next = (prev + 1) % groups.length;
          setSlideDir("right");
          return next;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveTab((prev) => {
          const next = (prev - 1 + groups.length) % groups.length;
          setSlideDir("left");
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, groups.length]);

  /* ---- Drag & Drop ---- */
  const [dropTargetModuleId, setDropTargetModuleId] = useState<string | null>(null);
  const [dropItemCount, setDropItemCount] = useState(0);

  useEffect(() => {
    if (
      !active ||
      !onDropModulePaths ||
      !orderedModules.some((m) => m.id === OPTIMIZE_MODULE_ID)
    ) {
      setDropTargetModuleId(null);
      setDropItemCount(0);
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | null = null;

    const attachListener = async () => {
      try {
        unlisten = await getCurrentWindow().onDragDropEvent((event) => {
          if (disposed) return;
          if (event.payload.type === "enter") {
            setDropTargetModuleId(OPTIMIZE_MODULE_ID);
            setDropItemCount(event.payload.paths.length);
            return;
          }
          if (event.payload.type === "over") {
            setDropTargetModuleId((c) => c ?? OPTIMIZE_MODULE_ID);
            return;
          }
          if (event.payload.type === "drop") {
            const paths = event.payload.paths ?? [];
            setDropTargetModuleId(null);
            setDropItemCount(0);
            if (paths.length > 0) onDropModulePaths(OPTIMIZE_MODULE_ID, paths);
            return;
          }
          setDropTargetModuleId(null);
          setDropItemCount(0);
        });
        if (disposed && unlisten) { unlisten(); unlisten = null; }
      } catch (error) {
        console.error("Errore drag & drop Home:", error);
      }
    };

    void attachListener();

    return () => {
      disposed = true;
      setDropTargetModuleId(null);
      setDropItemCount(0);
      if (unlisten) unlisten();
    };
  }, [active, onDropModulePaths, orderedModules]);

  /* ---- Render ---- */

  const activeGroup = groups[activeTab] ?? null;

  return (
    <main className={`dash${dropTargetModuleId ? " dash--dragging" : ""}`}>
      {/* Ambient background */}
      <div className="dash-bg-orbs" aria-hidden="true">
        <div className="dash-orb dash-orb--1" />
        <div className="dash-orb dash-orb--2" />
        <div className="dash-orb dash-orb--3" />
      </div>

      {/* ---- Top bar ---- */}
      <header className="dash-topbar">
        <div className="dash-topbar-left">
          <div className="dash-brand-icon" aria-hidden="true">
            <span>T</span>
          </div>
          <div className="dash-brand-inline">
            <span className="dash-brand-name">Toolbox</span>
            <span className="dash-brand-sub-inline">Creative Studio</span>
          </div>
        </div>
        <div className="dash-topbar-right">
          <span className="dash-topbar-dot" aria-hidden="true" />
          <span className="dash-topbar-label">{orderedModules.length} moduli</span>
          {recentSummary ? (
            <span className="dash-topbar-recent">📂 {recentSummary}</span>
          ) : null}
          {onOpenSettings ? (
            <button
              type="button"
              className="dash-topbar-settings"
              onClick={onOpenSettings}
              aria-label="Impostazioni"
            >
              ⚙
            </button>
          ) : null}
        </div>
      </header>

      {/* ---- Main content ---- */}
      <div className="dash-main">
        {/* Tagline + Hero */}
        <section className="dash-welcome">
          <h1 className="dash-tagline">
            Cosa vuoi fare <span className="dash-tagline-accent">oggi</span>
            <span className="dash-tagline-q">?</span>
          </h1>

          {hero ? (
            <div className="dash-hero-inline">
              <HeroCard
                module={hero}
                isDropActive={dropTargetModuleId === hero.id}
                dropItemCount={dropItemCount}
                onOpenModule={onOpenModule}
              />
              <p className="dash-hero-hint">
                ↑ Trascina immagini qui per ottimizzare al volo
              </p>
            </div>
          ) : null}
        </section>

        {/* Tabs + Carousel */}
        {groups.length > 0 ? (
          <section className="dash-carousel-section">
            <div className="dash-carousel-header">
              <nav className="dash-tabs" role="tablist">
                {groups.map((group, i) => (
                  <button
                    key={group.label}
                    type="button"
                    role="tab"
                    aria-selected={i === activeTab}
                    className={`dash-tab${i === activeTab ? " dash-tab--active" : ""}`}
                    onClick={() => handleTabChange(i)}
                  >
                    <span className="dash-tab-icon">{group.icon}</span>
                    <span className="dash-tab-label">{group.label}</span>
                    <span className="dash-tab-count">{group.modules.length}</span>
                  </button>
                ))}
              </nav>

              <div className="dash-nav-arrows">
                <button
                  type="button"
                  className="dash-nav-arrow"
                  onClick={() =>
                    handleTabChange((activeTab - 1 + groups.length) % groups.length)
                  }
                  aria-label="Categoria precedente"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="dash-nav-arrow"
                  onClick={() =>
                    handleTabChange((activeTab + 1) % groups.length)
                  }
                  aria-label="Categoria successiva"
                >
                  →
                </button>
              </div>
            </div>

            <div className="dash-carousel">
              <div
                ref={trackRef}
                className={`dash-carousel-track dash-carousel-track--${slideDir}`}
                key={activeTab}
              >
                {activeGroup?.modules.map((mod, idx) => (
                  <ModuleCard
                    key={mod.id}
                    module={mod}
                    index={idx}
                    onOpenModule={onOpenModule}
                  />
                ))}
              </div>
            </div>

            <div className="dash-dots">
              {groups.map((group, i) => (
                <button
                  key={group.label}
                  type="button"
                  className={`dash-dot${i === activeTab ? " dash-dot--active" : ""}`}
                  onClick={() => handleTabChange(i)}
                  aria-label={`Vai a ${group.label}`}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
