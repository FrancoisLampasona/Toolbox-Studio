import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "../../App.css";
import "./automation.css";
import ResizableModuleLayout from "../../components/ResizableModuleLayout";
import type {
  AppSettings,
  AutomationModuleSettings,
  WatchFolderStatus,
} from "../../types";

interface Props {
  active: boolean;
  initialSettings: AppSettings | null;
  onBackHome: () => void;
  onSettingsChange: (settings: Partial<AppSettings>) => void;
}

const LAST_OPTIMIZE_PROFILE_ID = "__last_optimize__";

const DEFAULT_AUTOMATION_SETTINGS: AutomationModuleSettings = {
  watchPath: null,
  outputPath: null,
  selectedProfileId: LAST_OPTIMIZE_PROFILE_ID,
  recursive: true,
  moveProcessed: false,
  processedDirName: "Processati",
};

const EMPTY_STATUS: WatchFolderStatus = {
  active: false,
  watchPath: null,
  outputPath: null,
  selectedProfileId: LAST_OPTIMIZE_PROFILE_ID,
  recursive: true,
  moveProcessed: false,
  processedDirName: "Processati",
  queueLength: 0,
  processing: false,
  processedCount: 0,
  startedAt: null,
  lastError: null,
  recentJobs: [],
};

function formatDateTime(timestamp: number | null): string {
  if (!timestamp) {
    return "—";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function profileSummaryLabel(settings: AppSettings | null, selectedProfileId: string | null): string {
  if (!selectedProfileId || selectedProfileId === LAST_OPTIMIZE_PROFILE_ID) {
    return "Ultime impostazioni optimize";
  }

  return (
    settings?.optimizeProfiles.find((profile) => profile.id === selectedProfileId)?.name ??
    "Profilo optimize"
  );
}

export default function AutomationModule({
  active,
  initialSettings,
  onBackHome,
  onSettingsChange,
}: Props) {
  const [watchPath, setWatchPath] = useState<string | null>(DEFAULT_AUTOMATION_SETTINGS.watchPath);
  const [outputPath, setOutputPath] = useState<string | null>(DEFAULT_AUTOMATION_SETTINGS.outputPath);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    DEFAULT_AUTOMATION_SETTINGS.selectedProfileId
  );
  const [recursive, setRecursive] = useState(DEFAULT_AUTOMATION_SETTINGS.recursive);
  const [moveProcessed, setMoveProcessed] = useState(DEFAULT_AUTOMATION_SETTINGS.moveProcessed);
  const [processedDirName, setProcessedDirName] = useState(DEFAULT_AUTOMATION_SETTINGS.processedDirName);
  const [status, setStatus] = useState<WatchFolderStatus>(EMPTY_STATUS);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionTone, setActionTone] = useState<"success" | "error" | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const persistedSettings = useMemo<AutomationModuleSettings>(
    () => ({
      watchPath,
      outputPath,
      selectedProfileId,
      recursive,
      moveProcessed,
      processedDirName,
    }),
    [moveProcessed, outputPath, processedDirName, recursive, selectedProfileId, watchPath]
  );

  const profileOptions = useMemo(() => {
    const profiles = initialSettings?.optimizeProfiles ?? [];
    return [
      { id: LAST_OPTIMIZE_PROFILE_ID, label: "Ultime impostazioni optimize" },
      ...profiles.map((profile) => ({
        id: profile.id,
        label: profile.name,
      })),
    ];
  }, [initialSettings?.optimizeProfiles]);

  const loadStatus = useCallback(async () => {
    try {
      const nextStatus = await invoke<WatchFolderStatus>("get_watch_folder_status");
      setStatus(nextStatus);
    } catch (error) {
      console.error("Errore stato watch folder:", error);
    }
  }, []);

  useEffect(() => {
    if (!initialSettings || hydrated) {
      return;
    }

    const automationSettings = initialSettings.lastAutomationOptions;
    if (automationSettings) {
      setWatchPath(automationSettings.watchPath);
      setOutputPath(automationSettings.outputPath);
      setSelectedProfileId(automationSettings.selectedProfileId);
      setRecursive(automationSettings.recursive);
      setMoveProcessed(automationSettings.moveProcessed);
      setProcessedDirName(automationSettings.processedDirName || "Processati");
    }

    setHydrated(true);
  }, [hydrated, initialSettings]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    onSettingsChange({ lastAutomationOptions: persistedSettings });
  }, [hydrated, onSettingsChange, persistedSettings]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!active && !status.active) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStatus();
    }, 1500);

    return () => {
      window.clearInterval(interval);
    };
  }, [active, loadStatus, status.active]);

  const chooseDirectory = async (
    setter: (value: string | null) => void,
    defaultPath?: string | null
  ) => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: defaultPath || undefined,
    });

    if (!selected || typeof selected !== "string") {
      return;
    }

    setter(selected);
  };

  const handleStart = async () => {
    if (!watchPath) {
      setActionMessage("Seleziona una cartella watch.");
      setActionTone("error");
      return;
    }

    if (!outputPath) {
      setActionMessage("Seleziona una cartella output.");
      setActionTone("error");
      return;
    }

    setBusy(true);
    setActionMessage(null);
    setActionTone(null);

    try {
      const nextStatus = await invoke<WatchFolderStatus>("start_watch_folder", {
        request: {
          watchPath,
          outputPath,
          selectedProfileId,
          recursive,
          moveProcessed,
          processedDirName,
        },
      });
      setStatus(nextStatus);
      setActionMessage("Watch folder attivato.");
      setActionTone("success");
    } catch (error) {
      console.error("Errore avvio watch folder:", error);
      setActionMessage(
        typeof error === "string" ? error : "Impossibile avviare il watch folder."
      );
      setActionTone("error");
    } finally {
      setBusy(false);
    }
  };

  const handleStop = async () => {
    setBusy(true);
    try {
      const nextStatus = await invoke<WatchFolderStatus>("stop_watch_folder");
      setStatus(nextStatus);
      setActionMessage("Watch folder fermato.");
      setActionTone("success");
    } catch (error) {
      console.error("Errore stop watch folder:", error);
      setActionMessage(
        typeof error === "string" ? error : "Impossibile fermare il watch folder."
      );
      setActionTone("error");
    } finally {
      setBusy(false);
    }
  };

  const selectedProfileLabel = profileSummaryLabel(initialSettings, selectedProfileId);
  const liveSelectedProfileLabel = profileSummaryLabel(initialSettings, status.selectedProfileId);

  return (
    <div className={`optimize-screen ${active ? "active" : "hidden"}`}>
      <header className="app-header">
        <div className="header-brand">
          <button onClick={onBackHome} className="btn-icon btn-back" aria-label="Torna alla Home">
            ←
          </button>
          <div className="header-logo automation-logo">A</div>
          <div className="header-brand-copy">
            <h1>Watch<span>Folder</span></h1>
            <span className="header-subtitle">Sorveglia una cartella e converte automaticamente con optimize</span>
          </div>
        </div>
        <div className="header-actions automation-header-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void chooseDirectory(setWatchPath, watchPath)}
          >
            Cartella Watch...
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void chooseDirectory(setOutputPath, outputPath)}
          >
            Output...
          </button>
          {status.active ? (
            <button type="button" className="btn btn-secondary" onClick={handleStop} disabled={busy}>
              Ferma
            </button>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={handleStart} disabled={busy}>
              Avvia
            </button>
          )}
        </div>
      </header>

      <ResizableModuleLayout
        storageKey="toolbox-layout-automation-v1"
        defaultLeftWidth={320}
        defaultRightWidth={340}
        leftMinWidth={280}
        leftMaxWidth={460}
        rightMinWidth={300}
        rightMaxWidth={500}
        centerMinWidth={420}
        left={
          <>
            <div className="panel-title">Configurazione</div>
            <div className="automation-panel">
              <div className="automation-section">
                <span className="automation-section-title">Cartelle</span>
                <label className="automation-field">
                  <span>Watch path</span>
                  <div className="automation-path-row">
                    <input
                      className="profile-name-input"
                      type="text"
                      value={watchPath ?? ""}
                      onChange={(event) => setWatchPath(event.target.value || null)}
                      placeholder="/Users/me/Da-convertire"
                      spellCheck={false}
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => void chooseDirectory(setWatchPath, watchPath)}>
                      Scegli
                    </button>
                  </div>
                </label>

                <label className="automation-field">
                  <span>Output path</span>
                  <div className="automation-path-row">
                    <input
                      className="profile-name-input"
                      type="text"
                      value={outputPath ?? ""}
                      onChange={(event) => setOutputPath(event.target.value || null)}
                      placeholder="/Users/me/Convertite"
                      spellCheck={false}
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => void chooseDirectory(setOutputPath, outputPath)}>
                      Scegli
                    </button>
                  </div>
                </label>
              </div>

              <div className="automation-section">
                <span className="automation-section-title">Profilo Optimize</span>
                <label className="automation-field">
                  <span>Preset operativo</span>
                  <select
                    className="profile-name-input"
                    value={selectedProfileId ?? LAST_OPTIMIZE_PROFILE_ID}
                    onChange={(event) => setSelectedProfileId(event.target.value || null)}
                  >
                    {profileOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="automation-hint">
                  Il watcher riusa i job del modulo optimize. Se scegli le ultime impostazioni, segue l’ultimo setup salvato in optimize.
                </p>
              </div>

              <div className="automation-section">
                <span className="automation-section-title">Comportamento</span>
                <label className="automation-toggle">
                  <input
                    type="checkbox"
                    checked={recursive}
                    onChange={(event) => setRecursive(event.target.checked)}
                  />
                  <span>Processa anche le sottocartelle</span>
                </label>
                <label className="automation-toggle">
                  <input
                    type="checkbox"
                    checked={moveProcessed}
                    onChange={(event) => setMoveProcessed(event.target.checked)}
                  />
                  <span>Sposta gli originali dopo una conversione senza errori</span>
                </label>
                <label className="automation-field">
                  <span>Cartella processati</span>
                  <input
                    className="profile-name-input"
                    type="text"
                    value={processedDirName}
                    onChange={(event) => setProcessedDirName(event.target.value)}
                    placeholder="Processati"
                    spellCheck={false}
                  />
                </label>
              </div>
            </div>
          </>
        }
        center={
          <div className="automation-center">
            <div className="panel-title">Stato Live</div>
            <div className="automation-card">
              <div className={`automation-status-badge ${status.active ? "active" : ""}`}>
                <span className="automation-status-dot" />
                {status.active ? "Watcher attivo" : "Watcher fermo"}
              </div>
              <div className="automation-center-grid">
                <div className="automation-stat">
                  <strong>{status.queueLength}</strong>
                  <span>In coda</span>
                </div>
                <div className="automation-stat">
                  <strong>{status.processedCount}</strong>
                  <span>File processati</span>
                </div>
                <div className="automation-stat">
                  <strong>{status.processing ? "Si" : "No"}</strong>
                  <span>Sta convertendo</span>
                </div>
              </div>
              <dl className="automation-kv">
                <dt>Watch</dt>
                <dd>{status.watchPath ?? watchPath ?? "Non configurata"}</dd>
                <dt>Output</dt>
                <dd>{status.outputPath ?? outputPath ?? "Non configurata"}</dd>
                <dt>Profilo live</dt>
                <dd>{liveSelectedProfileLabel}</dd>
                <dt>Avviato</dt>
                <dd>{formatDateTime(status.startedAt)}</dd>
              </dl>
              {status.lastError ? <p className="automation-error">{status.lastError}</p> : null}
              {actionMessage ? (
                <p className={actionTone === "error" ? "automation-error" : "automation-note"}>
                  {actionMessage}
                </p>
              ) : null}
            </div>

            {status.recentJobs.length === 0 ? (
              <div className="automation-empty">
                <div className="empty-icon">🛰</div>
                <p>Nessuna attivita` recente.</p>
                <span>Avvia il watcher e aggiungi nuove immagini nella cartella sorvegliata.</span>
              </div>
            ) : (
              <div className="automation-card">
                <div className="automation-status-label">Attivita` recente</div>
                <div className="automation-job-list">
                  {status.recentJobs.map((job) => (
                    <div key={`${job.sourcePath}-${job.processedAt}`} className="automation-job-item">
                      <div className="automation-job-head">
                        <strong>{job.outputCount} output</strong>
                        <span className={`automation-job-status ${job.status}`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="automation-job-path">{job.sourcePath}</div>
                      <div className="automation-job-meta">
                        {formatDateTime(job.processedAt)} · {job.outputDir}
                      </div>
                      {job.error ? <div className="automation-error">{job.error}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
        right={
          <>
            <div className="panel-title">Profilo & Note</div>
            <div className="automation-right-stack">
              <div className="automation-card">
                <div className="automation-status-label">Preset selezionato</div>
                <strong>{selectedProfileLabel}</strong>
                <p className="automation-note">
                  Il watcher applichera` lo stesso naming pattern, formato, quality e preset dimensionali del profilo optimize scelto.
                </p>
              </div>

              <div className="automation-card">
                <div className="automation-status-label">Primo taglio reale</div>
                <p className="automation-note">
                  Questo round copre watcher locale, start/stop reale, conversione automatica con optimize e cronologia minima.
                </p>
                <p className="automation-note">
                  Restano fuori per ora notifiche desktop vere, FTP/SFTP, CLI e sincronizzazione condivisa.
                </p>
              </div>

              <div className="automation-card">
                <div className="automation-status-label">Consiglio operativo</div>
                <p className="automation-note">
                  Usa una cartella `Da-convertire` separata e, se attivi lo spostamento originali, una cartella `Processati` interna per evitare ambiguita` nei batch ripetuti.
                </p>
              </div>
            </div>
          </>
        }
      />

      <footer className="automation-footer">
        <span>
          Profilo corrente: <strong>{selectedProfileLabel}</strong>
        </span>
        <span>
          {status.active
            ? `Watcher attivo${status.processing ? " · conversione in corso" : ""}`
            : "Watcher fermo"}
        </span>
      </footer>
    </div>
  );
}
