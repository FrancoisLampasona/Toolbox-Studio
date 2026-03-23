import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type LayoutMode = "desktop" | "tablet" | "mobile";
type DragEdge = "left" | "right";

interface PanelWidths {
  left: number;
  right: number;
}

interface DragState {
  edge: DragEdge;
  startX: number;
  startLeft: number;
  startRight: number;
}

interface Props {
  storageKey: string;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  leftMinWidth?: number;
  leftMaxWidth?: number;
  rightMinWidth?: number;
  rightMaxWidth?: number;
  centerMinWidth?: number;
  mobileBreakpoint?: number;
  tabletBreakpoint?: number;
}

const HANDLE_SIZE = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readStoredWidths(storageKey: string, fallback: PanelWidths): PanelWidths {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<PanelWidths>;
    return {
      left: typeof parsed.left === "number" ? parsed.left : fallback.left,
      right: typeof parsed.right === "number" ? parsed.right : fallback.right,
    };
  } catch {
    return fallback;
  }
}

function resolveLayoutMode(width: number, mobileBreakpoint: number, tabletBreakpoint: number): LayoutMode {
  if (width > 0 && width <= mobileBreakpoint) {
    return "mobile";
  }

  if (width > 0 && width <= tabletBreakpoint) {
    return "tablet";
  }

  return "desktop";
}

function clampPanelWidths({
  widths,
  containerWidth,
  mode,
  leftMinWidth,
  leftMaxWidth,
  rightMinWidth,
  rightMaxWidth,
  centerMinWidth,
}: {
  widths: PanelWidths;
  containerWidth: number;
  mode: LayoutMode;
  leftMinWidth: number;
  leftMaxWidth: number;
  rightMinWidth: number;
  rightMaxWidth: number;
  centerMinWidth: number;
}): PanelWidths {
  if (containerWidth <= 0) {
    return widths;
  }

  if (mode === "mobile") {
    return widths;
  }

  if (mode === "tablet") {
    const available = containerWidth - HANDLE_SIZE;
    const maxLeft = Math.max(leftMinWidth, Math.min(leftMaxWidth, available - centerMinWidth));
    return {
      left: clamp(widths.left, leftMinWidth, maxLeft),
      right: widths.right,
    };
  }

  const available = containerWidth - HANDLE_SIZE * 2;
  const maxLeft = Math.max(leftMinWidth, Math.min(leftMaxWidth, available - rightMinWidth - centerMinWidth));
  const clampedLeft = clamp(widths.left, leftMinWidth, maxLeft);
  const maxRight = Math.max(rightMinWidth, Math.min(rightMaxWidth, available - clampedLeft - centerMinWidth));
  const clampedRight = clamp(widths.right, rightMinWidth, maxRight);
  const refinedMaxLeft = Math.max(leftMinWidth, Math.min(leftMaxWidth, available - clampedRight - centerMinWidth));

  return {
    left: clamp(clampedLeft, leftMinWidth, refinedMaxLeft),
    right: clampedRight,
  };
}

export default function ResizableModuleLayout({
  storageKey,
  left,
  center,
  right,
  defaultLeftWidth = 240,
  defaultRightWidth = 280,
  leftMinWidth = 220,
  leftMaxWidth = 420,
  rightMinWidth = 260,
  rightMaxWidth = 460,
  centerMinWidth = 420,
  mobileBreakpoint = 760,
  tabletBreakpoint = 1180,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panelWidths, setPanelWidths] = useState<PanelWidths>(() =>
    readStoredWidths(storageKey, {
      left: defaultLeftWidth,
      right: defaultRightWidth,
    })
  );

  const layoutMode = useMemo(
    () => resolveLayoutMode(containerWidth, mobileBreakpoint, tabletBreakpoint),
    [containerWidth, mobileBreakpoint, tabletBreakpoint]
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(node.getBoundingClientRect().width);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setPanelWidths((current) =>
      clampPanelWidths({
        widths: current,
        containerWidth,
        mode: layoutMode,
        leftMinWidth,
        leftMaxWidth,
        rightMinWidth,
        rightMaxWidth,
        centerMinWidth,
      })
    );
  }, [
    centerMinWidth,
    containerWidth,
    layoutMode,
    leftMaxWidth,
    leftMinWidth,
    rightMaxWidth,
    rightMinWidth,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(panelWidths));
  }, [panelWidths, storageKey]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const onPointerMove = (event: PointerEvent) => {
      const deltaX = event.clientX - dragState.startX;
      const nextWidths =
        dragState.edge === "left"
          ? {
              left: dragState.startLeft + deltaX,
              right: dragState.startRight,
            }
          : {
              left: dragState.startLeft,
              right: dragState.startRight - deltaX,
            };

      setPanelWidths(
        clampPanelWidths({
          widths: nextWidths,
          containerWidth,
          mode: layoutMode,
          leftMinWidth,
          leftMaxWidth,
          rightMinWidth,
          rightMaxWidth,
          centerMinWidth,
        })
      );
    };

    const onPointerUp = () => {
      setDragState(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [
    centerMinWidth,
    containerWidth,
    dragState,
    layoutMode,
    leftMaxWidth,
    leftMinWidth,
    rightMaxWidth,
    rightMinWidth,
  ]);

  const startDrag = (edge: DragEdge, clientX: number) => {
    if (layoutMode === "mobile") {
      return;
    }

    if (layoutMode === "tablet" && edge === "right") {
      return;
    }

    setDragState({
      edge,
      startX: clientX,
      startLeft: panelWidths.left,
      startRight: panelWidths.right,
    });
  };

  const resetWidth = (edge: DragEdge) => {
    setPanelWidths((current) => ({
      left: edge === "left" ? defaultLeftWidth : current.left,
      right: edge === "right" ? defaultRightWidth : current.right,
    }));
  };

  const desktopColumns = `${panelWidths.left}px ${HANDLE_SIZE}px minmax(0, 1fr) ${HANDLE_SIZE}px ${panelWidths.right}px`;
  const tabletColumns = `${panelWidths.left}px ${HANDLE_SIZE}px minmax(0, 1fr)`;
  const mobileColumns = "1fr";

  const gridTemplateColumns =
    layoutMode === "desktop" ? desktopColumns : layoutMode === "tablet" ? tabletColumns : mobileColumns;

  return (
    <div
      ref={rootRef}
      className={`app-body resizable-layout layout-${layoutMode} ${dragState ? "is-dragging" : ""}`}
      style={{ gridTemplateColumns }}
    >
      {layoutMode === "desktop" ? (
        <>
          <aside className="panel-left">{left}</aside>
          <div
            className={`panel-resize-handle handle-left ${dragState?.edge === "left" ? "active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona colonna sinistra"
            onPointerDown={(event) => startDrag("left", event.clientX)}
            onDoubleClick={() => resetWidth("left")}
          />
          <main className="panel-center">{center}</main>
          <div
            className={`panel-resize-handle handle-right ${dragState?.edge === "right" ? "active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona colonna destra"
            onPointerDown={(event) => startDrag("right", event.clientX)}
            onDoubleClick={() => resetWidth("right")}
          />
          <aside className="panel-right">{right}</aside>
        </>
      ) : null}

      {layoutMode === "tablet" ? (
        <>
          <aside className="panel-left">{left}</aside>
          <div
            className={`panel-resize-handle handle-left ${dragState?.edge === "left" ? "active" : ""}`}
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona colonna sinistra"
            onPointerDown={(event) => startDrag("left", event.clientX)}
            onDoubleClick={() => resetWidth("left")}
          />
          <main className="panel-center">{center}</main>
          <aside className="panel-right panel-right-stacked">{right}</aside>
        </>
      ) : null}

      {layoutMode === "mobile" ? (
        <>
          <aside className="panel-left panel-mobile">{left}</aside>
          <main className="panel-center panel-mobile">{center}</main>
          <aside className="panel-right panel-mobile">{right}</aside>
        </>
      ) : null}
    </div>
  );
}
