import { useMemo } from "react";
import type { ImageInfo } from "../types";
import ImageRow from "./ImageRow";

interface FileEstimate {
  outputName: string;
  estimatedOutputSize: number;
  jobCount: number;
  qualityOverride: number | null;
}

interface Props {
  images: ImageInfo[];
  selectedFiles: Set<string>;
  onToggleSelect: (path: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClearAll: () => void;
  scanning: boolean;
  fileEstimates?: Map<string, FileEstimate>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function ImageGrid({
  images,
  selectedFiles,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onClearAll,
  scanning,
  fileEstimates,
}: Props) {
  const totalSize = useMemo(
    () => images.reduce((sum, img) => sum + img.size, 0),
    [images],
  );

  if (scanning && images.length === 0) {
    return (
      <div className="img-list-empty">
        <p>Scansione in corso...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="img-list-empty">
        <p>Nessuna immagine</p>
        <p className="img-list-hint">Trascina file qui o usa + File / + Cartella</p>
      </div>
    );
  }

  return (
    <div className="img-list">
      {/* Toolbar */}
      <div className="img-list-bar">
        <span className="img-list-count">
          <strong>{selectedFiles.size}</strong> / {images.length} &middot; {formatBytes(totalSize)}
        </span>
        <div className="img-list-actions">
          <button onClick={onSelectAll} className="opt-btn opt-btn--sm">Tutte</button>
          <button onClick={onDeselectAll} className="opt-btn opt-btn--sm">Nessuna</button>
          <button onClick={onClearAll} className="opt-btn opt-btn--sm img-list-clear">Svuota</button>
        </div>
      </div>

      {/* Header row */}
      <div className="img-row img-row--header">
        <span className="img-row-check-h" />
        <span className="img-row-thumb-h" />
        <span className="img-row-name">Nome</span>
        <span className="img-row-dims">Dim.</span>
        <span className="img-row-size">Peso</span>
        <span className="img-row-est">Output</span>
      </div>

      {/* Rows */}
      <div className="img-list-body">
        {images.map((img) => {
          const estimate = fileEstimates?.get(img.path);
          return (
            <ImageRow
              key={img.path}
              image={img}
              selected={selectedFiles.has(img.path)}
              onToggle={onToggleSelect}
              formatBytes={formatBytes}
              outputName={estimate?.outputName}
              estimatedOutputSize={estimate?.estimatedOutputSize}
              jobCount={estimate?.jobCount}
              qualityOverride={estimate?.qualityOverride}
            />
          );
        })}
      </div>
    </div>
  );
}
