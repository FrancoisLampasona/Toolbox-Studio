import { useMemo } from "react";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { Grid, type CellComponentProps } from "react-window";
import type { ImageInfo } from "../types";
import ImageCard from "./ImageCard";

interface Props {
  images: ImageInfo[];
  selectedFiles: Set<string>;
  onToggleSelect: (path: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClearAll: () => void;
  scanning: boolean;
}

const LARGE_BATCH_THRESHOLD = 72;
const GRID_GAP = 12;
const GRID_MIN_CARD_WIDTH = 150;
const GRID_CARD_EXTRA_HEIGHT = 42;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

type GridCellData = {
  images: ImageInfo[];
  selectedFiles: Set<string>;
  onToggleSelect: (path: string) => void;
  formatBytes: (bytes: number) => string;
  columnCount: number;
};

function GridCell({
  columnIndex,
  rowIndex,
  style,
  images,
  selectedFiles,
  onToggleSelect,
  formatBytes,
  columnCount,
}: CellComponentProps<GridCellData>) {
  const index = rowIndex * columnCount + columnIndex;
  const image = images[index];

  if (!image) {
    return null;
  }

  return (
    <div style={{ ...style, boxSizing: "border-box", padding: GRID_GAP / 2 }}>
      <ImageCard
        image={image}
        selected={selectedFiles.has(image.path)}
        onToggle={onToggleSelect}
        formatBytes={formatBytes}
      />
    </div>
  );
}

function buildGridMetrics(width: number) {
  const safeWidth = Math.max(1, width);
  const columnCount = Math.max(
    1,
    Math.floor((safeWidth + GRID_GAP) / (GRID_MIN_CARD_WIDTH + GRID_GAP))
  );
  const columnWidth = Math.floor(safeWidth / columnCount);
  const rowHeight = columnWidth + GRID_CARD_EXTRA_HEIGHT;

  return {
    columnCount,
    columnWidth,
    rowHeight,
  };
}

function NormalGrid({
  images,
  selectedFiles,
  onToggleSelect,
}: Pick<Props, "images" | "selectedFiles" | "onToggleSelect">) {
  return (
    <div className="image-grid">
      {images.map((img) => (
        <ImageCard
          key={img.path}
          image={img}
          selected={selectedFiles.has(img.path)}
          onToggle={onToggleSelect}
          formatBytes={formatBytes}
        />
      ))}
    </div>
  );
}

function VirtualizedGrid({
  images,
  selectedFiles,
  onToggleSelect,
}: Pick<Props, "images" | "selectedFiles" | "onToggleSelect">) {
  return (
    <div className="image-grid virtualized-grid large-grid">
      <AutoSizer
        renderProp={({ width, height }) => {
          const measuredWidth = typeof width === "number" ? width : 0;
          const measuredHeight = typeof height === "number" ? height : 0;

          if (measuredWidth <= 0 || measuredHeight <= 0) {
            return null;
          }

          const { columnCount, columnWidth, rowHeight } = buildGridMetrics(measuredWidth);
          const rowCount = Math.ceil(images.length / columnCount);
          const gridData: GridCellData = {
            images,
            selectedFiles,
            onToggleSelect,
            formatBytes,
            columnCount,
          };

          return (
            <Grid
              className="virtualized-grid-viewport"
              columnCount={columnCount}
              columnWidth={columnWidth}
              cellComponent={GridCell}
              cellProps={gridData}
              defaultHeight={measuredHeight}
              defaultWidth={measuredWidth}
              style={{ height: measuredHeight, width: measuredWidth }}
              rowCount={rowCount}
              rowHeight={rowHeight}
              overscanCount={2}
            >
            </Grid>
          );
        }}
      />
    </div>
  );
}

export default function ImageGrid({
  images,
  selectedFiles,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onClearAll,
  scanning,
}: Props) {
  const isLargeBatch = images.length > LARGE_BATCH_THRESHOLD;

  const toolbarLabel = useMemo(() => {
    if (isLargeBatch) {
      return "Virtualizzazione attiva";
    }

    return null;
  }, [isLargeBatch]);

  if (scanning && images.length === 0) {
    return (
      <div className="image-grid-empty">
        <div className="spinner" />
        <p>Scansione immagini in corso...</p>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="image-grid-empty">
        <div className="empty-icon">{"\u{1F4F7}"}</div>
        <p>Nessuna immagine caricata</p>
        <p className="hint">Usa i bottoni <strong>+ File</strong> o <strong>+ Cartella</strong> per aggiungere immagini</p>
      </div>
    );
  }

  return (
    <div className="image-grid-wrapper">
      <div className="grid-toolbar">
        <span className="grid-count">
          <strong>{selectedFiles.size}</strong> / {images.length} selezionate
        </span>
        <button onClick={onSelectAll} className="btn btn-sm">
          Tutte
        </button>
        <button onClick={onDeselectAll} className="btn btn-sm">
          Nessuna
        </button>
        <button onClick={onClearAll} className="btn btn-sm btn-danger">
          Svuota
        </button>
        {toolbarLabel ? <span className="grid-rendering-status">{toolbarLabel}</span> : null}
      </div>

      {isLargeBatch ? (
        <VirtualizedGrid
          images={images}
          selectedFiles={selectedFiles}
          onToggleSelect={onToggleSelect}
        />
      ) : (
        <NormalGrid
          images={images}
          selectedFiles={selectedFiles}
          onToggleSelect={onToggleSelect}
        />
      )}
    </div>
  );
}
