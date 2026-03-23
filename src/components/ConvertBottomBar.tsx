interface Props {
  selectedCount: number;
  jobCount: number;
  totalOps: number;
  batchWeightInputSize: number;
  batchWeightOutputSize: number;
  batchWeightMode: "idle" | "stimato" | "reale";
  loading: boolean;
  onConvert: () => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDelta(inputSize: number, outputSize: number): string {
  if (inputSize <= 0) return "";
  const delta = Math.round((1 - outputSize / inputSize) * 100);
  if (delta > 0) return `−${delta}%`;
  if (delta < 0) return `+${Math.abs(delta)}%`;
  return "0%";
}

export default function ConvertBottomBar({
  selectedCount,
  jobCount,
  totalOps,
  batchWeightInputSize,
  batchWeightOutputSize,
  batchWeightMode,
  loading,
  onConvert,
}: Props) {
  const deltaLabel = batchWeightMode !== "idle" && batchWeightInputSize > 0
    ? formatDelta(batchWeightInputSize, batchWeightOutputSize)
    : null;

  return (
    <div className="convert-bottom-bar">
      <div className="bottom-bar-stats">
        <div className="bottom-bar-counts">
          <span className="bottom-bar-pill">
            {selectedCount} immagini × {jobCount} varianti = <strong>{totalOps} file</strong>
          </span>
        </div>

        {batchWeightMode !== "idle" && (
          <div className="bottom-bar-weight">
            <span className="bottom-bar-weight-in">
              {formatBytes(batchWeightInputSize)}
            </span>
            <span className="bottom-bar-arrow">→</span>
            <span className="bottom-bar-weight-out">
              {formatBytes(batchWeightOutputSize)}
            </span>
            {deltaLabel && (
              <span className={`bottom-bar-delta ${batchWeightInputSize > batchWeightOutputSize ? "savings" : "increase"}`}>
                {deltaLabel}
              </span>
            )}
            <span className="bottom-bar-mode-badge">
              {batchWeightMode === "reale" ? "✓" : "~"}
            </span>
          </div>
        )}
      </div>

      <button
        className="btn btn-convert bottom-bar-convert"
        onClick={onConvert}
        disabled={loading || selectedCount === 0}
      >
        {loading ? (
          "Ottimizzazione in corso..."
        ) : (
          <>
            OTTIMIZZA
            <span className="convert-count">{totalOps} file</span>
          </>
        )}
      </button>
    </div>
  );
}
