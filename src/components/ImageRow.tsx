import { memo } from "react";
import type { ImageInfo } from "../types";

interface Props {
  image: ImageInfo;
  selected: boolean;
  onToggle: (path: string) => void;
  formatBytes: (bytes: number) => string;
  outputName?: string;
  estimatedOutputSize?: number;
  jobCount?: number;
  qualityOverride?: number | null;
}

function formatDelta(inputSize: number, outputSize: number): string {
  if (inputSize <= 0) return "";
  const delta = Math.round((1 - outputSize / inputSize) * 100);
  if (delta > 0) return `−${delta}%`;
  if (delta < 0) return `+${Math.abs(delta)}%`;
  return "0%";
}

function ImageRow({
  image,
  selected,
  onToggle,
  formatBytes,
  outputName,
  estimatedOutputSize,
  jobCount,
  qualityOverride,
}: Props) {
  const showEstimates = !image.error && estimatedOutputSize != null && estimatedOutputSize > 0;
  const delta = showEstimates ? formatDelta(image.size, estimatedOutputSize) : "";

  return (
    <div
      className={`img-row${selected ? " img-row--sel" : ""}${image.error ? " img-row--err" : ""}`}
      onClick={() => onToggle(image.path)}
    >
      <input
        type="checkbox"
        className="img-row-check"
        checked={selected}
        onChange={() => onToggle(image.path)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="img-row-thumb">
        {image.thumbnail_base64 ? (
          <img src={image.thumbnail_base64} alt="" loading="lazy" />
        ) : (
          <span className="img-row-no-thumb">{image.error ? "⚠" : "—"}</span>
        )}
      </div>
      <div className="img-row-name" title={image.filename}>
        {image.filename}
        {outputName ? <span className="img-row-output" title={outputName}>→ {outputName}</span> : null}
      </div>
      <span className="img-row-dims">
        {image.width > 0 ? `${image.width}×${image.height}` : "—"}
      </span>
      <span className="img-row-size">{formatBytes(image.size)}</span>
      {showEstimates ? (
        <span className="img-row-est">
          {formatBytes(estimatedOutputSize)}
          {delta ? (
            <span className={`img-row-delta ${estimatedOutputSize < image.size ? "savings" : "increase"}`}>
              {delta}
            </span>
          ) : null}
          {jobCount != null && jobCount > 1 ? <span className="img-row-variants">×{jobCount}</span> : null}
        </span>
      ) : (
        <span className="img-row-est">—</span>
      )}
      {qualityOverride != null ? (
        <span className="img-row-qbadge">Q{qualityOverride}</span>
      ) : null}
    </div>
  );
}

export default memo(ImageRow);
