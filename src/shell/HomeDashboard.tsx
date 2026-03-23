import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./shell.css";
import type { HomeDashboardProps } from "./types";
import type { ModuleConfig } from "../modules/optimize/config";

const OPTIMIZE_MODULE_ID = "optimize";

const NEXT_ROADMAP_ITEMS = [
  { title: "Social Media Images", state: "Prossimo" },
  { title: "Automazioni", state: "Roadmap" },
  { title: "Batch Rename", state: "Roadmap" },
] as const;

function getModuleHighlights(module: ModuleConfig): string[] {
  if (module.highlights && module.highlights.length > 0) return module.highlights;
  if (module.id === OPTIMIZE_MODULE_ID) return ["Batch", "Preview", "Profili", "Report"];
  return ["Modulo"];
}

function formatPathPreview(path: string): { leaf: string; trail: string } {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  const leaf = parts[parts.length - 1] || path;
  const trail = parts.slice(-3).join(" / ") || normalized;
  return { leaf, trail };
}

/* ------------------------------------------------------------------ */

function DashModuleCard({
  module,
  index,
  isDefault,
  isDropActive,
  dropItemCount,
  onOpenModule,
}: {
  module: ModuleConfig;
  index: number;
  isDefault: boolean;
  isDropActive: boolean;
  dropItemCount: number;
  onOpenModule: (moduleId: string) => void;
}) {
  const highlights = getModuleHighlights(module);

  const className = [
    "dash-card",
    `dash-card--${module.id}`,
    isDefault ? "dash-card--default" : "",
    isDropActive ? "dash-card--drop-active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      style={{ "--card-index": index } as React.CSSProperties}
      onClick={() => onOpenModule(module.id)}
    >
      {/* Gradient accent bar */}
      <div className="dash-card-accent" aria-hidden="true" />

      <div className="dash-card-body">
        {/* Icon */}
        <div className="dash-card-icon" aria-hidden="true">
          {module.icon || "C"}
        </div>

        {/* Content */}
        <div className="dash-card-content">
          <div className="dash-card-top">
            <div className="dash-card-title-group">
              {module.category ? (
                <span className="dash-card-category">{module.category}</span>
              ) : null}
              <h2>{module.name}</h2>
            </div>
            <div className="dash-card-meta">
              {module.statusLabel ? (
                <span className="dash-card-status">{module.statusLabel}</span>
              ) : null}
              {module.badge ? (
                <span className="dash-card-badge">{module.badge}</span>
              ) : null}
            </div>
          </div>

          <p className="dash-card-desc">
            {module.description ?? "Modulo disponibile nella suite"}
          </p>

          <div className="dash-card-chips">
            {highlights.map((h) => (
              <span key={h} className="dash-card-chip">{h}</span>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="dash-card-cta">
        <span>Apri modulo</span>
        <span className="dash-card-arrow">→</span>
      </div>

      {/* Drop overlay */}
      {isDropActive ? (
        <div className="dash-card-drop-overlay">
          <div className="dash-card-drop-icon">↓</div>
          Rilascia {dropItemCount}{" "}
          {dropItemCount === 1 ? "elemento" : "elementi"}
        </div>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ */

export function HomeDashboard({
  active = true,
  modules,
  defaultModuleId,
  recentPaths = [],
  onOpenModule,
  onDropModulePaths,
  onOpenSettings,
}: HomeDashboardProps) {
  const orderedModules = useMemo(
    () => [...modules].sort((a, b) => a.priority - b.priority),
    [modules],
  );

  const recentSummary =
    recentPaths.length > 0
      ? formatPathPreview(recentPaths[0]).trail
      : "Nessun file recente";

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

  return (
    <main className={`dash-home${dropTargetModuleId ? " dash-home--dragging" : ""}`}>
      <div className="dash-center">
        {/* Header — settings only */}
        <header className="dash-header">
          <div className="dash-header-spacer" />
          {onOpenSettings ? (
            <button
              type="button"
              className="dash-settings-btn"
              onClick={onOpenSettings}
              aria-label="Impostazioni"
            >
              ⚙
            </button>
          ) : null}
        </header>

        {/* Brand hero — large centered title */}
        <div className="dash-hero">
          <div className="dash-brand-mark" aria-hidden="true">T</div>
          <h1>Toolbox <span>Creative Studio</span></h1>
          <p className="dash-hero-sub">
            Cosa vuoi fare? — {orderedModules.length} moduli disponibili
          </p>
        </div>

        {/* Module grid */}
        <section className="dash-modules" aria-label="Moduli disponibili">
          {orderedModules.map((module, index) => (
            <DashModuleCard
              key={module.id}
              module={module}
              index={index}
              isDefault={module.id === defaultModuleId}
              isDropActive={dropTargetModuleId === module.id}
              dropItemCount={dropItemCount}
              onOpenModule={onOpenModule}
            />
          ))}
        </section>

        {/* Bottom area */}
        <div className="dash-bottom">
          {/* Roadmap */}
          <div className="dash-roadmap">
            <span className="dash-roadmap-label">In arrivo</span>
            <div className="dash-roadmap-grid">
              {NEXT_ROADMAP_ITEMS.map((item) => (
                <div key={item.title} className="dash-roadmap-item">
                  <strong>{item.title}</strong>
                  <span>{item.state}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <footer className="dash-footer">
            <span>📂 {recentSummary}</span>
            <span className="dash-footer-hint">Trascina file sulla Home → Optimize</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
