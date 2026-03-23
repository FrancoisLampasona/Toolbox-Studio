import { memo } from "react";
import type { ImageInfo } from "../types";

interface Props {
  image: ImageInfo;
  selected: boolean;
  onToggle: (path: string) => void;
  formatBytes: (bytes: number) => string;
}

function ImageCard({ image, selected, onToggle, formatBytes }: Props) {
  const handleToggle = () => {
    onToggle(image.path);
  };

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
      </div>
    </div>
  );
}

export default memo(ImageCard);
