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

function ImageCard({
  image,
  selected,
  onToggle,
  formatBytes,
  outputName,
  estimatedOutputSize,
  jobCount,
  qualityOverride,
}: Props) {
  const handleToggle = () => {
    onToggle(image.path);
  };

  const showEstimates = !image.error && estimatedOutputSize != null && estimatedOutputSize > 0;
  const delta = showEstimates ? formatDelta(image.size, estimatedOutputSize) : "";

  return (
    <div
      className={`image-card ${selected ? "selected" : ""} ${image.error ? "has-error" : ""}`}
      onClick={handleToggle}
    >
      <div className="image-card-thumb">
        {image.thumbnail_base64 ? (
          <img src={image.thumbnail_base64} alt={image.filename} loading="lazy" />
        ) : (
          <div className="no-thumb">{image.error ? "\u26A0" : "Preview"}</div>
        )}
        {image.error && (
          <div className="thumb-error" title={image.error}>
            <span className="error-icon">{"\u26A0"}</span>
          </div>
        )}
        <div className="image-card-check">
          <input
            type="checkbox"
            checked={selected}
            onChange={handleToggle}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        {qualityOverride != null && (
          <div className="image-card-quality-badge" title={`Qualità personalizzata: ${qualityOverride}%`}>
            Q{qualityOverride}
          </div>
        )}
      </div>
      <div className="image-card-info">
        <span className="image-card-name" title={image.filename}>
          {image.filename}
        </span>
        <span className="image-card-meta">
          {image.width > 0 ? (
            <>
              {image.width}&times;{image.height} &middot; {formatBytes(image.size)}
            </>
          ) : (
            <span className="meta-error">Errore caricamento</span>
          )}
          <span className="image-card-format">{image.format}</span>
        </span>
        {showEstimates && (
          <div className="image-card-estimate">
            <span className="estimate-arrow">→</span>
            <span className="estimate-size">{formatBytes(estimatedOutputSize)}</span>
            {delta && (
              <span className={`estimate-delta ${estimatedOutputSize < image.size ? "savings" : "increase"}`}>
                {delta}
              </span>
            )}
            {jobCount != null && jobCount > 1 && (
              <span className="estimate-variants">×{jobCount}</span>
            )}
          </div>
        )}
        {outputName && (
          <span className="image-card-output-name" title={outputName}>
            {outputName}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(ImageCard);
