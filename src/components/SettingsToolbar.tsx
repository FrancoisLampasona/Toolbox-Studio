import type {
  OptimizeProfile,
  OutputFormat,
  ResizeMode,
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
  profiles: OptimizeProfile[];
  selectedProfileId: string | null;
  profileName: string;
  onProfileNameChange: (value: string) => void;
  onApplyProfile: (id: string) => void;
  onSaveNewProfile: () => void;
  onChooseOutput: () => void;
  outputPath: string | null;
}

function basename(path: string | null): string {
  if (!path) return "Nessuna";
  const segments = path.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] || path;
}

export default function SettingsToolbar({
  format,
  onFormatChange,
  quality,
  onQualityChange,
  resizeMode,
  onResizeModeChange,
  namingPattern,
  onNamingPatternChange,
  namingPreview,
  profiles,
  selectedProfileId,
  profileName,
  onProfileNameChange,
  onApplyProfile,
  onSaveNewProfile,
  onChooseOutput,
  outputPath,
}: Props) {
  return (
    <div className="settings-toolbar">
      {/* Format */}
      <div className="toolbar-group">
        <span className="toolbar-label">Formato</span>
        <div className="toolbar-format-btns">
          {(["webp", "avif", "jpeg", "png"] as OutputFormat[]).map((f) => (
            <button
              key={f}
              className={`toolbar-fmt-btn ${format === f ? "active" : ""}`}
              onClick={() => onFormatChange(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Quality */}
      <div className="toolbar-group toolbar-quality">
        <span className="toolbar-label">Qualità</span>
        <div className="toolbar-quality-row">
          <input
            type="range"
            min={1}
            max={100}
            value={quality}
            onChange={(e) => onQualityChange(Number(e.target.value))}
            className="toolbar-quality-slider"
          />
          <span className="toolbar-quality-value">{quality}%</span>
        </div>
      </div>

      {/* Resize */}
      <div className="toolbar-group">
        <span className="toolbar-label">Ridimensiona</span>
        <div className="toolbar-format-btns">
          <button
            className={`toolbar-fmt-btn ${resizeMode === "cover" ? "active" : ""}`}
            onClick={() => onResizeModeChange("cover")}
            title="Riempie l'area, potrebbe ritagliare i bordi"
          >
            Riempi
          </button>
          <button
            className={`toolbar-fmt-btn ${resizeMode === "fit" ? "active" : ""}`}
            onClick={() => onResizeModeChange("fit")}
            title="L'immagine entra tutta, senza ritagli"
          >
            Adatta
          </button>
        </div>
      </div>

      {/* Naming */}
      <div className="toolbar-group toolbar-naming">
        <span className="toolbar-label">Nome output</span>
        <input
          type="text"
          className="toolbar-naming-input"
          value={namingPattern}
          onChange={(e) => onNamingPatternChange(e.target.value)}
          placeholder="{nome}{suffix}_{w}x{h}"
          spellCheck={false}
        />
        <span className="toolbar-naming-preview" title={namingPreview}>
          → {namingPreview}
        </span>
      </div>

      {/* Profile */}
      <div className="toolbar-group toolbar-profile">
        <span className="toolbar-label">Profilo</span>
        <div className="toolbar-profile-row">
          <select
            className="toolbar-profile-select"
            value={selectedProfileId || ""}
            onChange={(e) => {
              if (e.target.value) {
                onApplyProfile(e.target.value);
              }
            }}
          >
            <option value="">— Nessun profilo —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            className="toolbar-profile-name"
            value={profileName}
            onChange={(e) => onProfileNameChange(e.target.value)}
            placeholder="Nome profilo"
            maxLength={64}
          />
          <button
            className="toolbar-btn"
            onClick={onSaveNewProfile}
            disabled={!profileName.trim()}
          >
            Salva
          </button>
        </div>
      </div>

      {/* Output folder */}
      <div className="toolbar-group">
        <span className="toolbar-label">Destinazione</span>
        <button
          className="toolbar-output-btn"
          onClick={onChooseOutput}
          title={outputPath || "Scegli cartella di uscita"}
        >
          📁 {basename(outputPath)}
        </button>
      </div>
    </div>
  );
}
