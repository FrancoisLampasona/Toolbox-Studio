import type { Preset } from "../types";

interface Props {
  presets: Preset[];
  activePresets: Set<string>;
  onTogglePreset: (preset: Preset) => void;
  customWidth: number;
  customHeight: number;
  useCustom: boolean;
  onCustomFocus: () => void;
  onCustomWidthChange: (w: number) => void;
  onCustomHeightChange: (h: number) => void;
}

const categoryIcons: Record<string, string> = {
  "Hero Banner": "\u{1F3AC}",
  "Blog/Post": "\u{1F4DD}",
  "WooCommerce": "\u{1F6D2}",
  "Thumbnail": "\u{1F5BC}",
  "Logo": "\u{2B50}",
  "Contenuto": "\u{1F4C4}",
};

export default function PresetPanel({
  presets,
  activePresets,
  onTogglePreset,
  customWidth,
  customHeight,
  useCustom,
  onCustomFocus,
  onCustomWidthChange,
  onCustomHeightChange,
}: Props) {
  const grouped = presets.reduce<Record<string, Preset[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {});

  const isActive = (p: Preset) =>
    activePresets.has(`${p.width}x${p.height}${p.suffix}`);

  return (
    <div className="preset-panel">
      <div className="panel-title">Dimensioni</div>
      <p className="panel-hint">Seleziona uno o piu preset</p>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="preset-group">
          <h4>{categoryIcons[category] || "\u{1F4D0}"} {category}</h4>
          {items.map((p) => (
            <button
              key={`${p.width}x${p.height}${p.suffix}`}
              className={`preset-btn ${isActive(p) ? "active" : ""}`}
              onClick={() => onTogglePreset(p)}
            >
              {p.name}
              <span className="preset-dims">{p.suffix.replace("_", "")}</span>
            </button>
          ))}
        </div>
      ))}

      <div className="preset-group">
        <h4>{"\u{2699}"} Custom</h4>
        <div className={`custom-section ${useCustom ? "active" : ""}`}>
          <div className="custom-inputs">
            <label>
              Larghezza
              <input
                type="number"
                value={customWidth}
                onFocus={onCustomFocus}
                onChange={(e) => onCustomWidthChange(Number(e.target.value))}
                min={1}
                max={5000}
              />
            </label>
            <span className="times">&times;</span>
            <label>
              Altezza
              <input
                type="number"
                value={customHeight}
                onFocus={onCustomFocus}
                onChange={(e) => onCustomHeightChange(Number(e.target.value))}
                min={1}
                max={5000}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
