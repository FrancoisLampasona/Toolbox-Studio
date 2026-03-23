import type {
  ConvertProgress,
  ConvertSummary,
  ScanProgress,
  ThumbnailHydrationProgress,
} from "../types";

interface Props {
  progress: ConvertProgress | null;
  summary: ConvertSummary | null;
  loading: boolean;
  scanProgress: ScanProgress | null;
  scanning: boolean;
  thumbnailProgress: ThumbnailHydrationProgress | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function BatchProgress({
  progress,
  summary,
  loading,
  scanProgress,
  scanning,
  thumbnailProgress,
}: Props) {
  // Scan progress takes priority when scanning
  if (scanning && scanProgress && scanProgress.total > 0) {
    const percent = Math.round((scanProgress.current / scanProgress.total) * 100);
    return (
      <div className="batch-progress active scanning">
        <div className="progress-bar-container">
          <div className="progress-bar scan-bar" style={{ width: `${percent}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-status">
            Caricamento {scanProgress.current}/{scanProgress.total} &mdash; {scanProgress.filename}
          </span>
          <span className="progress-percent">{percent}%</span>
        </div>
      </div>
    );
  }

  if (scanning && !scanProgress) {
    return (
      <div className="batch-progress active scanning">
        <div className="progress-bar-container">
          <div className="progress-bar scan-bar" style={{ width: "100%" }} />
        </div>
        <div className="progress-info">
          <span className="progress-status">Scansione immagini in corso...</span>
        </div>
      </div>
    );
  }

  if (summary && !loading) {
    const isMultiVariantBatch = summary.total_operations > summary.total_files;

    return (
      <div className="batch-progress summary">
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: "100%" }} />
        </div>
        <div className="progress-info">
          <span className="progress-status success">
            Completato: {summary.successful}/{summary.total_operations} varianti generate
            {summary.total_files > 0 && ` \u00b7 ${summary.total_files} sorgenti`}
            {summary.failed > 0 && ` \u00b7 ${summary.failed} errori`}
          </span>
          <span className="progress-savings">
            {isMultiVariantBatch
              ? `${formatBytes(summary.total_input_size)} sorgenti \u2192 ${formatBytes(summary.total_output_size)} output`
              : `${formatBytes(summary.total_input_size)} \u2192 ${formatBytes(summary.total_output_size)} (${summary.total_input_size > 0
                  ? `${Math.round((1 - summary.total_output_size / summary.total_input_size) * 100)}%`
                  : "0%"
                })`}
          </span>
        </div>
      </div>
    );
  }

  if (progress && loading) {
    const percent = Math.round((progress.current / progress.total) * 100);
    return (
      <div className="batch-progress active">
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: `${percent}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-status">
            {progress.current}/{progress.total} &mdash; {progress.filename}
          </span>
          <span className="progress-percent">{percent}%</span>
        </div>
      </div>
    );
  }

  if (loading && !progress) {
    return (
      <div className="batch-progress active">
        <div className="progress-bar-container">
          <div className="progress-bar" style={{ width: "100%" }} />
        </div>
        <div className="progress-info">
          <span className="progress-status">Conversione batch in corso...</span>
        </div>
      </div>
    );
  }

  if (
    !scanning &&
    !loading &&
    thumbnailProgress &&
    thumbnailProgress.total > 0 &&
    thumbnailProgress.completed < thumbnailProgress.total
  ) {
    const percent = Math.round((thumbnailProgress.completed / thumbnailProgress.total) * 100);
    const pending = thumbnailProgress.total - thumbnailProgress.completed;

    return (
      <div className="batch-progress active hydrating">
        <div className="progress-bar-container">
          <div className="progress-bar thumb-bar" style={{ width: `${percent}%` }} />
        </div>
        <div className="progress-info">
          <span className="progress-status">
            Miniature {thumbnailProgress.loaded}/{thumbnailProgress.total}
            {thumbnailProgress.failed > 0 ? ` \u00b7 ${thumbnailProgress.failed} errori` : ""}
            {thumbnailProgress.currentPath ? ` — ${thumbnailProgress.currentPath}` : ""}
            {pending > 0 ? ` (${pending} in coda)` : ""}
          </span>
          <span className="progress-percent">{percent}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="batch-progress idle">
      <div className="progress-info">
        <span className="progress-status hint">
          Seleziona immagini, scegli un preset e clicca CONVERTI
        </span>
      </div>
    </div>
  );
}
