import type {
  ConvertSummary,
  ImageInfo,
  OptimizeProfile,
  OutputFormat,
  ResizeMode,
  Preset,
} from "../types";

interface Props {
  format: OutputFormat;
  onFormatChange: (f: OutputFormat) => void;
  quality: number;
  onQualityChange: (q: number) => void;
  previewImage: ImageInfo | null;
  previewQuality: number;
  previewQualityOverridden: boolean;
  onPreviewQualityChange: (q: number) => void;
  onResetPreviewQuality: () => void;
  resizeMode: ResizeMode;
  onResizeModeChange: (m: ResizeMode) => void;
  namingPattern: string;
  onNamingPatternChange: (value: string) => void;
  namingPreview: string;
  selectedCount: number;
  jobCount: number;
  totalOps: number;
  activePresets: Set<string>;
  presets: Preset[];
  useCustom: boolean;
  customWidth: number;
  customHeight: number;
  outputPath: string | null;
  inputPaths: string[];
  inputPathCount: number;
  profiles: OptimizeProfile[];
  selectedProfileId: string | null;
  profileName: string;
  profileDirty: boolean;
  savingProfile: boolean;
  deletingProfile: boolean;
  exportingProfiles: boolean;
  importingProfiles: boolean;
  profileStatus: string | null;
  profileStatusTone: "success" | "error" | null;
  profileTransferStatus: string | null;
  profileTransferStatusTone: "success" | "error" | null;
  onProfileNameChange: (value: string) => void;
  onApplyProfile: (id: string) => void;
  onSaveNewProfile: () => void;
  onUpdateProfile: () => void;
  onDeleteProfile: () => void;
  onExportProfiles: () => void;
  onImportProfiles: () => void;
  onChooseOutput: () => void;
  onClearInputPaths: () => void;
  summary: ConvertSummary | null;
  batchWeightMode: "idle" | "stimato" | "reale";
  batchWeightInputSize: number;
  batchWeightOutputSize: number;
  batchWeightNote: string;
  activePreviewWeightMode: "idle" | "stimato" | "reale";
  activePreviewInputSize: number;
  activePreviewOutputSize: number;
  exportingReport: boolean;
  reportStatus: string | null;
  reportStatusTone: "success" | "error" | null;
  onExportReport: () => void;
  onConvert: () => void;
  loading: boolean;
}

function basename(path: string | null): string {
  if (!path) {
    return "Nessuna cartella scelta";
  }

  const segments = path.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || path;
}

function formatProfileMeta(profile: OptimizeProfile): string {
  const presetCount = profile.settings.activePresetKeys.length;
  const sizeLabel = profile.settings.useCustom || presetCount === 0
    ? `${profile.settings.customWidth}x${profile.settings.customHeight}`
    : `${presetCount} preset`;

  return `${profile.settings.format.toUpperCase()} • ${sizeLabel} • ${basename(profile.outputPath)}`;
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

function formatDeltaPercent(inputSize: number, outputSize: number): string {
  if (inputSize <= 0) {
    return "0%";
  }

  const delta = Math.round((1 - outputSize / inputSize) * 100);
  if (delta > 0) {
    return `-${delta}%`;
  }
  if (delta < 0) {
    return `+${Math.abs(delta)}%`;
  }
  return "0%";
}

export default function SettingsPanel({
  format,
  onFormatChange,
  quality,
  onQualityChange,
  previewImage,
  previewQuality,
  previewQualityOverridden,
  onPreviewQualityChange,
  onResetPreviewQuality,
  resizeMode,
  onResizeModeChange,
  namingPattern,
  onNamingPatternChange,
  namingPreview,
  selectedCount,
  jobCount,
  totalOps,
  activePresets,
  presets,
  useCustom,
  customWidth,
  customHeight,
  outputPath,
  inputPaths,
  inputPathCount,
  profiles,
  selectedProfileId,
  profileName,
  profileDirty,
  savingProfile,
  deletingProfile,
  exportingProfiles,
  importingProfiles,
  profileStatus,
  profileStatusTone,
  profileTransferStatus,
  profileTransferStatusTone,
  onProfileNameChange,
  onApplyProfile,
  onSaveNewProfile,
  onUpdateProfile,
  onDeleteProfile,
  onExportProfiles,
  onImportProfiles,
  onChooseOutput,
  onClearInputPaths,
  summary,
  batchWeightMode,
  batchWeightInputSize,
  batchWeightOutputSize,
  batchWeightNote,
  activePreviewWeightMode,
  activePreviewInputSize,
  activePreviewOutputSize,
  exportingReport,
  reportStatus,
  reportStatusTone,
  onExportReport,
  onConvert,
  loading,
}: Props) {
  const activePresetList = presets.filter((p) =>
    activePresets.has(`${p.width}x${p.height}${p.suffix}`)
  );
  const visibleInputPaths = inputPaths.slice(0, 3);
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) || null;
  const canSaveNewProfile =
    profileName.trim().length > 0 && !savingProfile && !deletingProfile;
  const canUpdateProfile =
    Boolean(selectedProfile) &&
    profileName.trim().length > 0 &&
    !savingProfile &&
    !deletingProfile &&
    (
      profileDirty ||
      profileName.trim() !== selectedProfile?.name
    );

  return (
    <div className="settings-panel">
      <div className="panel-title">Impostazioni Output</div>

      <div className="setting-group">
        <span className="setting-label">Formato Immagine</span>
        <div className="format-buttons">
          {(["webp", "avif", "jpeg", "png"] as OutputFormat[]).map((f) => (
            <button
              key={f}
              className={`format-btn ${format === f ? "active" : ""}`}
              onClick={() => onFormatChange(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">
          Qualità generale: <strong>{quality}%</strong>
        </span>
        <div className="quality-slider-wrapper">
          <input
            type="range"
            min={1}
            max={100}
            value={quality}
            onChange={(e) => onQualityChange(Number(e.target.value))}
            className="quality-slider"
          />
        </div>
        <div className="quality-labels">
          <span>Più leggero</span>
          <span>Massima qualità</span>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">
          Qualità file selezionato: <strong>{previewImage ? `${previewQuality}%` : "—"}</strong>
        </span>
        <div className="quality-override-card">
          {previewImage ? (
            <>
              <div className="quality-override-head">
                <div className="quality-override-meta">
                  <strong title={previewImage.filename}>{previewImage.filename}</strong>
                  <span>
                    {previewQualityOverridden ? "Qualità personalizzata per questo file" : "Usa la qualità generale"}
                  </span>
                </div>
                <span className={`quality-override-badge ${previewQualityOverridden ? "active" : ""}`}>
                  {previewQualityOverridden ? "Personalizzata" : "Generale"}
                </span>
              </div>
              <div className="quality-slider-wrapper">
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={previewQuality}
                  onChange={(e) => onPreviewQualityChange(Number(e.target.value))}
                  className="quality-slider"
                />
              </div>
              <div className="quality-labels">
                <span>Generale: {quality}%</span>
                <span>Questo file: {previewQuality}%</span>
              </div>
              <div className="quality-override-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={onResetPreviewQuality}
                  disabled={!previewQualityOverridden}
                >
                  Ripristina qualità generale
                </button>
              </div>
            </>
          ) : (
            <div className="quality-override-empty">
              Seleziona un'immagine per regolare la qualità solo su quel file.
            </div>
          )}
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Modalità Ridimensionamento</span>
        <div className="format-buttons">
          <button
            className={`format-btn ${resizeMode === "cover" ? "active" : ""}`}
            onClick={() => onResizeModeChange("cover")}
            title="Riempie l'area, potrebbe ritagliare i bordi"
          >
            Riempi
          </button>
          <button
            className={`format-btn ${resizeMode === "fit" ? "active" : ""}`}
            onClick={() => onResizeModeChange("fit")}
            title="L'immagine entra tutta nell'area, senza ritagli"
          >
            Adatta
          </button>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Nome File di Uscita</span>
        <div className="naming-summary">
          <input
            type="text"
            className="profile-name-input"
            value={namingPattern}
            onChange={(event) => onNamingPatternChange(event.target.value)}
            placeholder="{nome}{suffix}_{w}x{h}"
            spellCheck={false}
          />
          <div className="naming-token-list" aria-label="Variabili disponibili per il nome">
            {[
              { token: "{nome}", desc: "nome originale" },
              { token: "{slug}", desc: "nome semplificato" },
              { token: "{preset}", desc: "dimensione scelta" },
              { token: "{suffix}", desc: "suffisso preset" },
              { token: "{w}", desc: "larghezza" },
              { token: "{h}", desc: "altezza" },
              { token: "{formato}", desc: "formato" },
              { token: "{n}", desc: "numero progressivo" },
              { token: "{profilo}", desc: "nome profilo" },
            ].map(({ token, desc }) => (
              <span key={token} className="naming-token-chip" title={desc}>
                {token}
              </span>
            ))}
          </div>
          <div className="naming-preview-card">
            <span className="path-summary-label">Anteprima nome</span>
            <strong>{namingPreview}</strong>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Profili Salvati</span>
        <div className="profile-summary">
          <input
            type="text"
            className="profile-name-input"
            value={profileName}
            onChange={(event) => onProfileNameChange(event.target.value)}
            placeholder="Cliente, progetto o preset ricorrente"
            maxLength={64}
          />
          <div className="profile-actions-row">
            <button
              className="btn btn-sm"
              onClick={onSaveNewProfile}
              disabled={!canSaveNewProfile || exportingProfiles || importingProfiles}
            >
              {savingProfile ? "Salvataggio..." : "Salva come nuovo"}
            </button>
            <button
              className="btn btn-sm"
              onClick={onUpdateProfile}
              disabled={!canUpdateProfile || exportingProfiles || importingProfiles}
            >
              {savingProfile && selectedProfile ? "Aggiornamento..." : "Aggiorna"}
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={onDeleteProfile}
              disabled={!selectedProfile || savingProfile || deletingProfile || exportingProfiles || importingProfiles}
            >
              {deletingProfile ? "Eliminazione..." : "Elimina"}
            </button>
          </div>
          <div className="profile-actions-row">
            <button
              className="btn btn-sm"
              onClick={onExportProfiles}
              disabled={!selectedProfile || savingProfile || deletingProfile || exportingProfiles || importingProfiles}
            >
              {exportingProfiles ? "Esportazione..." : "Esporta JSON"}
            </button>
            <button
              className="btn btn-sm"
              onClick={onImportProfiles}
              disabled={savingProfile || deletingProfile || exportingProfiles || importingProfiles}
            >
              {importingProfiles ? "Importazione..." : "Importa JSON"}
            </button>
          </div>
          {profiles.length > 0 ? (
            <div className="profile-chip-list" aria-label="Profili salvati">
              {profiles.map((profile) => {
                const isActive = profile.id === selectedProfileId;
                return (
                  <button
                    key={profile.id}
                    className={`profile-chip-card ${isActive ? "active" : ""}`}
                    onClick={() => onApplyProfile(profile.id)}
                  >
                    <span className="profile-chip-name">{profile.name}</span>
                    <span className="profile-chip-meta">{formatProfileMeta(profile)}</span>
                    {isActive ? (
                      <span className="profile-chip-state">
                        {profileDirty ? "Modifiche non salvate" : "Profilo attivo"}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="profile-empty-state">
              Crea un profilo per salvare queste impostazioni e riutilizzarle in futuro.
            </div>
          )}
          {profileStatus && (
            <div className={`report-status ${profileStatusTone === "error" ? "error" : "success"}`}>
              {profileStatus}
            </div>
          )}
          {profileTransferStatus && (
            <div className={`report-status ${profileTransferStatusTone === "error" ? "error" : "success"}`}>
              {profileTransferStatus}
            </div>
          )}
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Cartelle</span>
        <div className="path-summary">
          <div className="path-summary-row">
            <span className="path-summary-label">Sorgente</span>
            <span className="path-summary-value">
              {inputPathCount > 0 ? `${inputPathCount} cartelle sorgente` : "Nessuna cartella selezionata"}
            </span>
          </div>
          {visibleInputPaths.length > 0 && (
            <div className="path-summary-list" aria-label="Cartelle sorgente">
              {visibleInputPaths.map((path) => (
                <span key={path} className="path-summary-chip" title={path}>
                  {path}
                </span>
              ))}
              {inputPathCount > visibleInputPaths.length && (
                <span className="path-summary-more">
                  +{inputPathCount - visibleInputPaths.length} altre
                </span>
              )}
            </div>
          )}
          <div className="path-summary-row">
            <span className="path-summary-label">Destinazione</span>
            <span className="path-summary-value" title={outputPath || undefined}>
              {outputPath || "Scegli dove salvare i file"}
            </span>
          </div>
          <div className="path-summary-actions">
            <button className="btn btn-sm" onClick={onChooseOutput}>
              Scegli cartella di uscita
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={onClearInputPaths}
              disabled={inputPathCount === 0}
            >
              Rimuovi tutte le sorgenti
            </button>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Riepilogo</span>
        <div className="convert-summary">
          <div className="output-weight-card">
            <div className="output-weight-head">
              <div className="output-weight-title">
                <span>Peso Totale</span>
                <strong>
                  {batchWeightMode === "reale" ? "Calcolato" : batchWeightMode === "stimato" ? "Stimato" : "—"}
                </strong>
              </div>
              <span className={`output-weight-badge ${batchWeightMode}`}>
                {batchWeightMode === "reale" ? "✓ Reale" : batchWeightMode === "stimato" ? "~ Stima" : "—"}
              </span>
            </div>
            <div className="output-weight-grid">
              <div className="output-weight-item">
                <span className="output-weight-label">Originale</span>
                <strong>{formatBytes(batchWeightInputSize)}</strong>
              </div>
              <div className="output-weight-item">
                <span className="output-weight-label">Dopo conversione</span>
                <strong>{formatBytes(batchWeightOutputSize)}</strong>
              </div>
            </div>
            <div className="output-weight-note">
              {batchWeightNote}
              {batchWeightMode !== "idle" && batchWeightInputSize > 0
                ? ` · ${formatDeltaPercent(batchWeightInputSize, batchWeightOutputSize)}`
                : ""}
            </div>
            {previewImage && (
              <div className="output-weight-preview">
                <div className="output-weight-preview-row">
                  <span className="output-weight-label">File selezionato</span>
                  <strong title={previewImage.filename}>{previewImage.filename}</strong>
                </div>
                <div className="output-weight-grid compact">
                  <div className="output-weight-item">
                    <span className="output-weight-label">Originale</span>
                    <strong>{formatBytes(activePreviewInputSize)}</strong>
                  </div>
                  <div className="output-weight-item">
                    <span className="output-weight-label">Dopo conversione</span>
                    <strong>{formatBytes(activePreviewOutputSize)}</strong>
                  </div>
                </div>
                <div className="output-weight-note">
                  {activePreviewWeightMode === "reale"
                    ? "Peso reale dalla conversione"
                    : activePreviewWeightMode === "stimato"
                      ? "Stima sul file selezionato"
                      : "Seleziona un'immagine per il dettaglio"}
                  {activePreviewInputSize > 0
                    ? ` · ${formatDeltaPercent(activePreviewInputSize, activePreviewOutputSize)}`
                    : ""}
                </div>
              </div>
            )}
          </div>
          {activePresetList.length > 0 && (
            <div className="summary-presets">
              {activePresetList.map((p) => (
                <span key={`${p.width}x${p.height}${p.suffix}`} className="summary-tag">
                  {p.name}
                </span>
              ))}
            </div>
          )}
          {useCustom && (
            <div className="summary-presets">
              <span className="summary-tag custom">
                {customWidth}&times;{customHeight}
              </span>
            </div>
          )}
          {!useCustom && activePresetList.length === 0 && (
            <div className="summary-presets">
              <span className="summary-tag custom">
                {customWidth}&times;{customHeight}
              </span>
            </div>
          )}
          <div className="summary-stats">
            <span>{selectedCount} immagini</span>
            <span>&times;</span>
            <span>{jobCount} varianti</span>
            <span>=</span>
            <span className="summary-total">{totalOps} file totali</span>
          </div>
          {summary && (
            <div className="summary-secondary">
              <div className="summary-stats summary-stats-secondary">
                <span>{summary.successful} di {summary.total_operations} completate</span>
                <span>&middot;</span>
                <span>{summary.total_files} file originali</span>
                {summary.failed > 0 && (
                  <>
                    <span>&middot;</span>
                    <span>{summary.failed} errori</span>
                  </>
                )}
              </div>
              <div className="report-actions">
                <button
                  className="btn btn-sm"
                  onClick={onExportReport}
                  disabled={exportingReport}
                >
                  {exportingReport ? "Esportazione..." : "Esporta Report CSV"}
                </button>
              </div>
              {reportStatus && (
                <div className={`report-status ${reportStatusTone === "error" ? "error" : "success"}`}>
                  {reportStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        className="btn btn-convert"
        onClick={onConvert}
        disabled={loading || selectedCount === 0}
      >
        {loading ? (
          "Ottimizzazione in corso..."
        ) : (
          <>
            OTTIMIZZA
            <span className="convert-count">
              {totalOps} file verranno creati
            </span>
          </>
        )}
      </button>
    </div>
  );
}
