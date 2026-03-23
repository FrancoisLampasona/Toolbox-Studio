import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import "../../App.css";
import "./brand.css";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type { AppSettings, BrandKit, SaveBrandKitRequest } from "../../types";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

interface BrandModuleStorage {
  kits: BrandKit[];
  selectedKitId: string | null;
  draftKit: BrandKit | null;
}

const STORAGE_KEY = "toolbox-brand-module-v1";

const DEFAULT_KIT: BrandKit = {
  id: "studio-blueprint",
  name: "Studio Blueprint",
  primaryColor: "#0f766e",
  secondaryColor: "#38bdf8",
  accentColor: "#f59e0b",
  textColor: "#e5eefb",
  backgroundColor: "#07111f",
  logoPath: "/assets/brand/logo.svg",
  iconPath: "/assets/brand/icon.png",
  fontHeading: "Space Grotesk",
  fontBody: "Inter",
  watermarkPath: "/assets/brand/watermark.png",
  updatedAtMs: Date.now(),
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return fallback;
}

function cloneKit(kit: BrandKit): BrandKit {
  return { ...kit };
}

function createNewKit(partial?: Partial<BrandKit>): BrandKit {
  const timestamp = Date.now();
  return {
    ...cloneKit(DEFAULT_KIT),
    id: `brand-kit-${timestamp}`,
    name: partial?.name || "Nuovo brand kit",
    primaryColor: partial?.primaryColor || DEFAULT_KIT.primaryColor,
    secondaryColor: partial?.secondaryColor || DEFAULT_KIT.secondaryColor,
    accentColor: partial?.accentColor || DEFAULT_KIT.accentColor,
    textColor: partial?.textColor || DEFAULT_KIT.textColor,
    backgroundColor: partial?.backgroundColor || DEFAULT_KIT.backgroundColor,
    logoPath: partial?.logoPath || DEFAULT_KIT.logoPath,
    iconPath: partial?.iconPath || DEFAULT_KIT.iconPath,
    fontHeading: partial?.fontHeading || DEFAULT_KIT.fontHeading,
    fontBody: partial?.fontBody || DEFAULT_KIT.fontBody,
    watermarkPath: partial?.watermarkPath || DEFAULT_KIT.watermarkPath,
    updatedAtMs: timestamp,
  };
}

function normalizeColor(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "#000000";
  }

  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const expanded = trimmed
      .slice(1)
      .split("")
      .map((char) => `${char}${char}`)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }

  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function normalizeKit(kit: BrandKit): BrandKit {
  return {
    ...kit,
    primaryColor: normalizeColor(kit.primaryColor),
    secondaryColor: normalizeColor(kit.secondaryColor),
    accentColor: normalizeColor(kit.accentColor),
    textColor: normalizeColor(kit.textColor),
    backgroundColor: normalizeColor(kit.backgroundColor),
    logoPath: kit.logoPath.trim(),
    iconPath: kit.iconPath.trim(),
    fontHeading: kit.fontHeading.trim() || DEFAULT_KIT.fontHeading,
    fontBody: kit.fontBody.trim() || DEFAULT_KIT.fontBody,
    watermarkPath: kit.watermarkPath.trim(),
  };
}

function normalizeKits(kits: BrandKit[]): BrandKit[] {
  return [...kits]
    .map(normalizeKit)
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs || left.name.localeCompare(right.name));
}

function readStorage(): BrandModuleStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BrandModuleStorage>;
    return {
      kits: Array.isArray(parsed.kits) ? normalizeKits(parsed.kits as BrandKit[]) : [],
      selectedKitId: typeof parsed.selectedKitId === "string" ? parsed.selectedKitId : null,
      draftKit: parsed.draftKit ? normalizeKit(parsed.draftKit as BrandKit) : null,
    };
  } catch {
    return null;
  }
}

function writeStorage(payload: BrandModuleStorage) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function kitPreviewLabel(kit: BrandKit): string {
  return `${kit.fontHeading} / ${kit.fontBody}`;
}

function kitDisplayName(kit: BrandKit): string {
  return kit.name.trim() || "Brand kit";
}

function BrandKitCard({
  kit,
  active,
  onSelect,
}: {
  kit: BrandKit;
  active: boolean;
  onSelect: (kit: BrandKit) => void;
}) {
  return (
    <button
      type="button"
      className={`brand-kit-card ${active ? "active" : ""}`}
      onClick={() => onSelect(kit)}
    >
      <div className="brand-kit-head">
        <div className="brand-kit-title">
          <strong>{kitDisplayName(kit)}</strong>
          <span>{kitPreviewLabel(kit)}</span>
        </div>
        <span className="brand-kit-state">
          {active ? "Attivo" : "Locale"}
        </span>
      </div>
      <div className="brand-kit-swatches">
        {[kit.primaryColor, kit.secondaryColor, kit.accentColor, kit.textColor].map((color) => (
          <span key={color} className="brand-kit-swatch">
            <span className="brand-kit-swatch-bullet" style={{ backgroundColor: color }} />
            {color}
          </span>
        ))}
      </div>
      <span className="brand-kit-state" style={{ textTransform: "none", letterSpacing: 0 }}>
        Aggiornato {new Date(kit.updatedAtMs).toLocaleString("it-IT")}
      </span>
    </button>
  );
}

export default function BrandModule({ active, initialSettings, onBackHome, onSettingsChange }: Props) {
  const hydratedRef = useRef(false);
  const [kits, setKits] = useState<BrandKit[]>([cloneKit(DEFAULT_KIT)]);
  const [selectedKitId, setSelectedKitId] = useState<string | null>(DEFAULT_KIT.id);
  const [draftKit, setDraftKit] = useState<BrandKit>(cloneKit(DEFAULT_KIT));
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | null>(null);

  const selectedKit = useMemo(
    () => kits.find((kit) => kit.id === selectedKitId) || null,
    [kits, selectedKitId]
  );

  const draftDirty = useMemo(() => {
    if (!selectedKit) {
      return true;
    }

    const fields: Array<keyof BrandKit> = [
      "name",
      "primaryColor",
      "secondaryColor",
      "accentColor",
      "textColor",
      "backgroundColor",
      "logoPath",
      "iconPath",
      "fontHeading",
      "fontBody",
      "watermarkPath",
    ];

    return fields.some((field) => draftKit[field] !== selectedKit[field]);
  }, [draftKit, selectedKit]);

  const previewStyle = useMemo(
    () =>
      ({
        "--brand-primary": draftKit.primaryColor,
        "--brand-secondary": draftKit.secondaryColor,
        "--brand-accent": draftKit.accentColor,
        "--brand-text": draftKit.textColor,
        "--brand-background": draftKit.backgroundColor,
        fontFamily: draftKit.fontBody,
      }) as CSSProperties,
    [draftKit]
  );

  const persistLocalState = (nextKits: BrandKit[], nextSelectedId: string | null, nextDraft: BrandKit) => {
    const normalized = normalizeKits(nextKits);
    setKits(normalized);
    setSelectedKitId(nextSelectedId);
    setDraftKit(nextDraft);
    writeStorage({
      kits: normalized,
      selectedKitId: nextSelectedId,
      draftKit: nextDraft,
    });
  };

  const syncFromKit = (kit: BrandKit) => {
    const nextKit = normalizeKit(kit);
    setSelectedKitId(nextKit.id);
    setDraftKit(nextKit);
    setStatusMessage(`Kit selezionato: ${nextKit.name}`);
    setStatusTone("success");
  };

  useEffect(() => {
    if (!initialSettings || !active) {
      return;
    }

    const preferredKitId = initialSettings.lastBrandOptions?.selectedBrandKitId ?? null;
    if (preferredKitId) {
      setSelectedKitId(preferredKitId);
    }
  }, [active, initialSettings]);

  useEffect(() => {
    if (!active || hydratedRef.current) {
      return;
    }

    hydratedRef.current = true;
    let cancelled = false;

    const loadKits = async () => {
      const stored = readStorage();
      const storedKits = stored?.kits || [];
      const storedDraft = stored?.draftKit || null;
      const storedSelectedId = stored?.selectedKitId || null;

      try {
        const remoteKits = await invoke<unknown>("get_brand_kits");
        if (cancelled) {
          return;
        }

        const nextKits = Array.isArray(remoteKits) && remoteKits.length > 0
          ? normalizeKits(remoteKits as BrandKit[])
          : storedKits.length > 0
            ? storedKits
            : [cloneKit(DEFAULT_KIT)];
        const nextSelected = nextKits.find((kit) => kit.id === storedSelectedId) || nextKits[0] || cloneKit(DEFAULT_KIT);
        const nextDraft = storedDraft && nextKits.some((kit) => kit.id === storedDraft.id)
          ? storedDraft
          : cloneKit(nextSelected);

        setKits(nextKits);
        setSelectedKitId(nextSelected.id);
        setDraftKit(nextDraft);
        writeStorage({
          kits: nextKits,
          selectedKitId: nextSelected.id,
          draftKit: nextDraft,
        });
        setStatusMessage("Brand kit caricati e pronti all'uso.");
        setStatusTone("success");
      } catch (error) {
        if (cancelled) {
          return;
        }

        const fallbackKits = storedKits.length > 0 ? storedKits : [cloneKit(DEFAULT_KIT)];
        const nextSelected = fallbackKits.find((kit) => kit.id === storedSelectedId) || fallbackKits[0];
        const nextDraft = storedDraft && fallbackKits.some((kit) => kit.id === storedDraft.id)
          ? storedDraft
          : cloneKit(nextSelected);

        setKits(fallbackKits);
        setSelectedKitId(nextSelected.id);
        setDraftKit(nextDraft);
        writeStorage({
          kits: fallbackKits,
          selectedKitId: nextSelected.id,
          draftKit: nextDraft,
        });
        setStatusMessage(`Usando brand kit locali: ${getErrorMessage(error, "backend non ancora disponibile")}`);
        setStatusTone("error");
      }
    };

    void loadKits();

    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }

    onSettingsChange({
      brandKits: kits,
      lastBrandOptions: {
        selectedBrandKitId: selectedKitId,
        lastOutputPath: initialSettings?.lastBrandOptions?.lastOutputPath ?? null,
      },
    });

    writeStorage({
      kits,
      selectedKitId,
      draftKit,
    });
  }, [active, draftKit, initialSettings?.lastBrandOptions?.lastOutputPath, kits, onSettingsChange, selectedKitId]);

  useEffect(() => {
    if (kits.length === 0) {
      const starter = cloneKit(DEFAULT_KIT);
      setKits([starter]);
      setSelectedKitId(starter.id);
      setDraftKit(starter);
    }
  }, [kits.length]);

  const updateField = <K extends keyof BrandKit>(field: K, value: BrandKit[K]) => {
    setDraftKit((current) => normalizeKit({ ...current, [field]: value }));
    setStatusMessage(null);
  };

  const createFreshKit = () => {
    const nextKit = createNewKit();
    setSelectedKitId(nextKit.id);
    setDraftKit(nextKit);
    setStatusMessage("Nuovo brand kit pronto da compilare.");
    setStatusTone("success");
  };

  const saveKit = async (mode: "create" | "update") => {
    if (!draftKit.name.trim()) {
      setStatusMessage("Inserisci un nome per il brand kit.");
      setStatusTone("error");
      return;
    }

    const nextKit = normalizeKit({
      ...draftKit,
      id: mode === "create" ? `brand-kit-${Date.now()}` : draftKit.id,
      updatedAtMs: Date.now(),
    });

    const nextKits =
      mode === "create"
        ? [nextKit, ...kits.filter((kit) => kit.id !== nextKit.id)]
        : kits.map((kit) => (kit.id === nextKit.id ? nextKit : kit));

    persistLocalState(nextKits, nextKit.id, nextKit);

    try {
      const request: SaveBrandKitRequest = {
        id: mode === "create" ? null : nextKit.id,
        name: nextKit.name,
        primaryColor: nextKit.primaryColor,
        secondaryColor: nextKit.secondaryColor,
        accentColor: nextKit.accentColor,
        textColor: nextKit.textColor,
        backgroundColor: nextKit.backgroundColor,
        logoPath: nextKit.logoPath || "",
        iconPath: nextKit.iconPath || "",
        fontHeading: nextKit.fontHeading,
        fontBody: nextKit.fontBody,
        watermarkPath: nextKit.watermarkPath || "",
      };
      const savedKit = await invoke<BrandKit>("save_brand_kit", { request });
      persistLocalState(
        mode === "create"
          ? [savedKit, ...kits.filter((kit) => kit.id !== nextKit.id)]
          : kits.map((kit) => (kit.id === nextKit.id ? savedKit : kit)),
        savedKit.id,
        savedKit
      );
      setStatusMessage(mode === "create" ? "Brand kit salvato." : "Brand kit aggiornato.");
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(`Salvataggio locale OK, sincronizzazione backend non disponibile: ${getErrorMessage(error, "errore")}`);
      setStatusTone("error");
    }
  };

  const deleteKit = async () => {
    if (!selectedKit) {
      return;
    }

    const nextKits = kits.filter((kit) => kit.id !== selectedKit.id);
    const nextSelected = nextKits[0] || cloneKit(DEFAULT_KIT);
    const nextDraft = cloneKit(nextSelected);
    persistLocalState(nextKits.length > 0 ? nextKits : [nextSelected], nextSelected.id, nextDraft);

    try {
      const persisted = await invoke<BrandKit[]>("delete_brand_kit", {
        id: selectedKit.id,
      });
      const nextPersisted = persisted.length > 0 ? persisted : [cloneKit(DEFAULT_KIT)];
      persistLocalState(nextPersisted, nextPersisted[0].id, cloneKit(nextPersisted[0]));
      setStatusMessage("Brand kit eliminato.");
      setStatusTone("success");
    } catch (error) {
      setStatusMessage(`Eliminazione locale OK, backend non ancora disponibile: ${getErrorMessage(error, "errore")}`);
      setStatusTone("error");
    }
  };

  const selectedCount = kits.length;

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo brand-logo">B</div>
          <div className="header-brand-copy">
            <h1>Team<span>Brand</span></h1>
            <span className="header-subtitle">Brand kit locali, palette condivise e asset di team</span>
          </div>
        </div>
        <div className="header-actions">
          <button type="button" className="btn btn-secondary" onClick={createFreshKit}>
            + Nuovo kit
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void saveKit("create")}>
            Salva nuovo
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void saveKit("update")} disabled={!selectedKit}>
            Aggiorna
          </button>
        </div>
      </header>

      <ResizableModuleLayout
        storageKey="toolbox-layout-brand-v1"
        defaultLeftWidth={320}
        defaultRightWidth={360}
        leftMinWidth={280}
        leftMaxWidth={420}
        rightMinWidth={320}
        rightMaxWidth={520}
        centerMinWidth={420}
        left={
          <>
            <div className="panel-title">Brand kit</div>
            <div className="brand-panel">
              <div className="brand-section">
                <span className="brand-section-title">Kit salvati</span>
                <div className="brand-kit-list">
                  {kits.length > 0 ? (
                    kits.map((kit) => (
                      <BrandKitCard
                        key={kit.id}
                        kit={kit}
                        active={kit.id === selectedKitId}
                        onSelect={syncFromKit}
                      />
                    ))
                  ) : (
                    <div className="brand-empty-state">
                      Nessun brand kit salvato. Crea il primo kit per iniziare a condividere colori e asset.
                    </div>
                  )}
                </div>
              </div>

              <div className="brand-section">
                <span className="brand-section-title">Sintesi</span>
                <div className="brand-kit-empty">
                  {selectedCount} kit locali pronti. Il kit attivo resta in sessione e viene ricordato anche al riavvio.
                </div>
              </div>

              {statusMessage ? (
                <div className={`brand-status ${statusTone === "error" ? "error" : "success"}`}>
                  {statusMessage}
                </div>
              ) : null}
            </div>
          </>
        }
        center={
          <>
            <div className="panel-title">Editor brand</div>
            <div className="brand-card">
              <div className="brand-editor">
                <label className="brand-field">
                  <span>Nome kit</span>
                  <input
                    className="brand-input"
                    type="text"
                    value={draftKit.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Studio Creativo"
                  />
                </label>

                <div className="brand-color-grid">
                  {[
                    ["primaryColor", "Primario"],
                    ["secondaryColor", "Secondario"],
                    ["accentColor", "Accento"],
                    ["textColor", "Testo"],
                    ["backgroundColor", "Background"],
                  ].map(([field, label]) => (
                    <label key={field} className="brand-color-field">
                      <span>{label}</span>
                      <div className="brand-color-input">
                        <input
                          type="color"
                          value={draftKit[field as keyof BrandKit] as string}
                          onChange={(event) => updateField(field as keyof BrandKit, event.target.value)}
                        />
                        <input
                          className="brand-input"
                          type="text"
                          value={draftKit[field as keyof BrandKit] as string}
                          onChange={(event) => updateField(field as keyof BrandKit, event.target.value)}
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <label className="brand-field">
                  <span>Font heading</span>
                  <input
                    className="brand-input"
                    type="text"
                    value={draftKit.fontHeading}
                    onChange={(event) => updateField("fontHeading", event.target.value)}
                    placeholder="Space Grotesk"
                  />
                </label>

                <label className="brand-field">
                  <span>Font body</span>
                  <input
                    className="brand-input"
                    type="text"
                    value={draftKit.fontBody}
                    onChange={(event) => updateField("fontBody", event.target.value)}
                    placeholder="Inter"
                  />
                </label>

                <div className="brand-path-grid">
                  <label className="brand-field">
                    <span>Logo path</span>
                    <input
                      className="brand-input"
                      type="text"
                      value={draftKit.logoPath}
                      onChange={(event) => updateField("logoPath", event.target.value)}
                      placeholder="/assets/brand/logo.svg"
                    />
                  </label>
                  <label className="brand-field">
                    <span>Icon path</span>
                    <input
                      className="brand-input"
                      type="text"
                      value={draftKit.iconPath}
                      onChange={(event) => updateField("iconPath", event.target.value)}
                      placeholder="/assets/brand/icon.png"
                    />
                  </label>
                  <label className="brand-field">
                    <span>Watermark path</span>
                    <input
                      className="brand-input"
                      type="text"
                      value={draftKit.watermarkPath}
                      onChange={(event) => updateField("watermarkPath", event.target.value)}
                      placeholder="/assets/brand/watermark.png"
                    />
                  </label>
                </div>

                <div className="brand-actions">
                  <button type="button" className="btn btn-secondary" onClick={createFreshKit}>
                    Nuovo kit
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => void saveKit("create")}>
                    Salva nuovo
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => void saveKit("update")} disabled={!selectedKit}>
                    Aggiorna kit
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => void deleteKit()} disabled={!selectedKit}>
                    Elimina
                  </button>
                </div>

                <div className={`brand-status ${draftDirty ? "error" : "success"}`}>
                  {draftDirty ? "Modifiche non salvate nel kit selezionato." : "Kit sincronizzato con la selezione corrente."}
                </div>
              </div>
            </div>
          </>
        }
        right={
          <>
            <div className="panel-title">Preview</div>
            <div className="brand-card brand-preview-card">
              <div className="brand-preview-stage" style={previewStyle}>
                <div className="brand-preview-mark">
                  {(draftKit.name.trim().slice(0, 2) || "B").toUpperCase()}
                </div>
                <strong>{draftKit.name || "Team & Brand"}</strong>
                <span>
                  Palette, tipografia e asset centralizzati per moduli come Social Media, Favicon e Watermark.
                </span>
                <span>
                  Watermark: {draftKit.watermarkPath || "non definito"}
                </span>
              </div>

              <div className="brand-preview-samples">
                <div className="brand-preview-swatches">
                  {[
                    draftKit.primaryColor,
                    draftKit.secondaryColor,
                    draftKit.accentColor,
                    draftKit.textColor,
                    draftKit.backgroundColor,
                  ].map((color) => (
                    <span key={color} className="brand-preview-swatch">
                      <span className="brand-preview-swatch-bullet" style={{ backgroundColor: color }} />
                      {color}
                    </span>
                  ))}
                </div>

                <div className="brand-preview-typography" style={{ fontFamily: draftKit.fontBody }}>
                  <strong style={{ fontFamily: draftKit.fontHeading }}>Aa Brand heading</strong>
                  <p>
                    Body text: {draftKit.fontBody}. Il brand kit guida gli altri moduli con colori, font e asset
                    condivisi.
                  </p>
                </div>

                <div className="brand-preview-meta">
                  <div className="brand-preview-chip">
                    <span>Logo</span>
                    <strong>{draftKit.logoPath || "non definito"}</strong>
                  </div>
                  <div className="brand-preview-chip">
                    <span>Icona</span>
                    <strong>{draftKit.iconPath || "non definito"}</strong>
                  </div>
                  <div className="brand-preview-chip">
                    <span>Font heading</span>
                    <strong>{draftKit.fontHeading || "Space Grotesk"}</strong>
                  </div>
                  <div className="brand-preview-chip">
                    <span>Font body</span>
                    <strong>{draftKit.fontBody || "Inter"}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="brand-footer-note">
              <span>Le invocazioni previste sono `get_brand_kits`, `save_brand_kit` e `delete_brand_kit`.</span>
              <span>Il kit attivo resta in sessione anche mentre modifichi i campi.</span>
            </div>
          </>
        }
      />
    </div>
  );
}
