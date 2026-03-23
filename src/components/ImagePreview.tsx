import { useRef, useEffect, useState } from "react";
import type { ImageInfo, ResizeMode } from "../types";

interface Props {
  image: ImageInfo | null;
  targetWidth: number;
  targetHeight: number;
  resizeMode: ResizeMode;
}

export default function ImagePreview({ image, targetWidth, targetHeight, resizeMode }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    setImgSize(null);
  }, [image?.path]);

  if (!image) {
    return (
      <div className="image-preview placeholder">
        <div className="preview-placeholder">
          <span className="preview-placeholder-icon">{"\uD83D\uDDBC"}</span>
          <span>Clicca su un'immagine per l'anteprima</span>
        </div>
      </div>
    );
  }

  if (!image.thumbnail_base64) {
    return (
      <div className="image-preview placeholder">
        <div className="panel-title">Anteprima</div>
        <div className="preview-placeholder">
          <span className="preview-placeholder-icon">{"\uD83D\uDDBC"}</span>
          <span>Anteprima in caricamento...</span>
        </div>
        <div className="preview-info">
          <span className="preview-filename" title={image.filename}>{image.filename}</span>
          <span className="preview-dims">
            {image.width}&times;{image.height} &rarr; {targetWidth}&times;{targetHeight}
          </span>
          <span className="preview-mode">{resizeMode === "cover" ? "Cover (crop)" : "Fit (no crop)"}</span>
        </div>
      </div>
    );
  }

  const imgW = image.width;
  const imgH = image.height;
  const targetAspect = targetWidth / targetHeight;
  const imageAspect = imgW / imgH;

  // Calculate crop overlay percentages for Cover mode
  let cropTop = 0, cropBottom = 0, cropLeft = 0, cropRight = 0;

  if (resizeMode === "cover" && imgW > 0 && imgH > 0) {
    if (imageAspect > targetAspect) {
      // Image wider than target: crop sides
      const visibleWidth = imgH * targetAspect;
      const cropX = (imgW - visibleWidth) / 2;
      const cropPercent = (cropX / imgW) * 100;
      cropLeft = cropPercent;
      cropRight = cropPercent;
    } else {
      // Image taller than target: crop top/bottom
      const visibleHeight = imgW / targetAspect;
      const cropY = (imgH - visibleHeight) / 2;
      const cropPercent = (cropY / imgH) * 100;
      cropTop = cropPercent;
      cropBottom = cropPercent;
    }
  }

  const handleImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  return (
    <div className="image-preview">
      <div className="panel-title">Anteprima</div>
      <div className="preview-container" ref={containerRef}>
        <div className="preview-image-wrapper">
          <img
            src={image.thumbnail_base64}
            alt={image.filename}
            onLoad={handleImgLoad}
          />
          {resizeMode === "cover" && imgSize && (
            <>
              {cropTop > 0 && (
                <div className="preview-crop-overlay crop-top" style={{ height: `${cropTop}%` }} />
              )}
              {cropBottom > 0 && (
                <div className="preview-crop-overlay crop-bottom" style={{ height: `${cropBottom}%` }} />
              )}
              {cropLeft > 0 && (
                <div className="preview-crop-overlay crop-left" style={{ width: `${cropLeft}%` }} />
              )}
              {cropRight > 0 && (
                <div className="preview-crop-overlay crop-right" style={{ width: `${cropRight}%` }} />
              )}
            </>
          )}
          {resizeMode === "fit" && imgSize && (
            <div className="preview-fit-badge">FIT</div>
          )}
        </div>
      </div>
      <div className="preview-info">
        <span className="preview-filename" title={image.filename}>{image.filename}</span>
        <span className="preview-dims">
          {imgW}&times;{imgH} &rarr; {targetWidth}&times;{targetHeight}
        </span>
        <span className="preview-mode">{resizeMode === "cover" ? "Cover (crop)" : "Fit (no crop)"}</span>
      </div>
    </div>
  );
}
