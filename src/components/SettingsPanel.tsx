import type {
  ConvertSummary,
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
  exportingReport: boolean;
  reportStatus: string | null;
  reportStatusTone: "success" | "error" | null;
  onExportReport: () => void;
  onConvert: () => void;
  loading: boolean;
}

function basename(path: string | null): string {
  if (!path) {
    return "Output libero";
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

export default function SettingsPanel({
  format,
  onFormatChange,
  quality,
  onQualityChange,
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
      <div className="panel-title">Impostazioni</div>

      <div className="setting-group">
        <span className="setting-label">Formato Output</span>
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
          Qualita: <strong>{quality}%</strong>
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
          <span>Leggero</span>
          <span>Massima</span>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Ridimensionamento</span>
        <div className="format-buttons">
          <button
            className={`format-btn ${resizeMode === "cover" ? "active" : ""}`}
            onClick={() => onResizeModeChange("cover")}
          >
            Cover
          </button>
          <button
            className={`format-btn ${resizeMode === "fit" ? "active" : ""}`}
            onClick={() => onResizeModeChange("fit")}
          >
            Fit
          </button>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Naming Output</span>
        <div className="naming-summary">
          <input
            type="text"
            className="profile-name-input"
            value={namingPattern}
            onChange={(event) => onNamingPatternChange(event.target.value)}
            placeholder="{nome}{suffix}_{w}x{h}"
            spellCheck={false}
          />
          <div className="naming-token-list" aria-label="Token naming disponibili">
            {["{nome}", "{slug}", "{preset}", "{suffix}", "{w}", "{h}", "{formato}", "{n}", "{profilo}"].map((token) => (
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
        <span className="setting-label">Profili Rapidi</span>
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
              {savingProfile ? "Salvataggio..." : "Salva nuovo"}
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
              Salva il primo profilo per riusare output e impostazioni nei prossimi batch.
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
        <span className="setting-label">Percorsi</span>
        <div className="path-summary">
          <div className="path-summary-row">
            <span className="path-summary-label">Input</span>
            <span className="path-summary-value">
              {inputPathCount > 0 ? `${inputPathCount} sorgenti ricordate` : "Nessun percorso ancora scelto"}
            </span>
          </div>
          {visibleInputPaths.length > 0 && (
            <div className="path-summary-list" aria-label="Sorgenti ricordate">
              {visibleInputPaths.map((path) => (
                <span key={path} className="path-summary-chip" title={path}>
                  {path}
                </span>
              ))}
              {inputPathCount > visibleInputPaths.length && (
                <span className="path-summary-more">
                  +{inputPathCount - visibleInputPaths.length} altri
                </span>
              )}
            </div>
          )}
          <div className="path-summary-row">
            <span className="path-summary-label">Output</span>
            <span className="path-summary-value" title={outputPath || undefined}>
              {outputPath || "Seleziona una cartella output"}
            </span>
          </div>
          <div className="path-summary-actions">
            <button className="btn btn-sm" onClick={onChooseOutput}>
              Cambia output
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={onClearInputPaths}
              disabled={inputPathCount === 0}
            >
              Svuota sorgenti
            </button>
          </div>
        </div>
      </div>

      <div className="setting-group">
        <span className="setting-label">Riepilogo Conversione</span>
        <div className="convert-summary">
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
            <span>{jobCount} dimensioni</span>
            <span>=</span>
            <span className="summary-total">{totalOps} file</span>
          </div>
          {summary && (
            <div className="summary-secondary">
              <div className="summary-stats summary-stats-secondary">
                <span>{summary.successful}/{summary.total_operations} varianti</span>
                <span>&middot;</span>
                <span>{summary.total_files} sorgenti</span>
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
                  {exportingReport ? "Esportazione..." : "Esporta CSV"}
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
          "Conversione in corso..."
        ) : (
          <>
            CONVERTI
            <span className="convert-count">
              {totalOps} file in uscita
            </span>
          </>
        )}
      </button>
    </div>
  );
}
