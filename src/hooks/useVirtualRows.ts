"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";

const OVERSCAN = 260;
const INITIAL_HEIGHT = 720;
const INITIAL_WIDTH = 390;
const oneItemPerRow: (index: number) => number = () => 1;

export function useViewportSize(viewportRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({
    height: INITIAL_HEIGHT,
    width: INITIAL_WIDTH,
    compact: true,
  });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const wideScreen = window.matchMedia?.("(min-width: 640px)");
    const syncSize = () => {
      const height = viewport.clientHeight || INITIAL_HEIGHT;
      const width = viewport.clientWidth || INITIAL_WIDTH;
      const compact = !wideScreen?.matches;
      setSize((previous) => previous.height === height && previous.width === width && previous.compact === compact
        ? previous
        : { height, width, compact });
    };

    syncSize();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(syncSize) : null;
    observer?.observe(viewport);
    wideScreen?.addEventListener("change", syncSize);
    return () => {
      observer?.disconnect();
      wideScreen?.removeEventListener("change", syncSize);
    };
  }, [viewportRef]);

  return size;
}

interface RowLocation {
  row: number;
  item: number;
}

function rowAtOffset(offsets: readonly number[], offset: number): number {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (offsets[middle] <= offset) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

function getRowLocation(target: EventTarget): RowLocation | null {
  if (!(target instanceof Element)) return null;
  const row = target.closest<HTMLElement>("[data-virtual-row]");
  const item = target.closest<HTMLElement>("[data-virtual-item]");
  return row ? { row: Number(row.dataset.virtualRow), item: Number(item?.dataset.virtualItem ?? 0) } : null;
}

function focusRow(viewport: HTMLDivElement, location: RowLocation): boolean {
  const row = viewport.querySelector<HTMLElement>(`[data-virtual-row="${location.row}"]`);
  const button = row instanceof HTMLButtonElement
    ? row
    : row?.querySelector<HTMLButtonElement>(`[data-virtual-item="${location.item}"]`);
  if (!button) return false;

  button.focus({ preventScroll: true });
  const bounds = button.getBoundingClientRect();
  const viewportLeft = viewport.getBoundingClientRect().left + viewport.clientLeft;
  const viewportRight = viewportLeft + viewport.clientWidth;
  if (bounds.width <= viewport.clientWidth) {
    viewport.scrollLeft += bounds.left < viewportLeft ? bounds.left - viewportLeft : Math.max(0, bounds.right - viewportRight);
  }
  return true;
}

export function useVirtualRows(
  viewportRef: RefObject<HTMLDivElement | null>,
  height: number,
  offsets: readonly number[],
  headerHeight: number,
  itemsInRow = oneItemPerRow,
  resetKey?: string,
) {
  const pendingFocus = useRef<RowLocation | null>(null);
  const [pinnedRow, setPinnedRow] = useState<number | null>(null);
  const [top, setTop] = useState(0);
  const rowCount = offsets.length - 1;
  const totalHeight = offsets[rowCount];
  const visibleHeight = Math.max(0, height - headerHeight);
  const clampedTop = Math.min(top, Math.max(0, totalHeight - visibleHeight));
  const first = rowAtOffset(offsets, Math.max(0, clampedTop - OVERSCAN));
  const last = Math.min(
    rowCount,
    rowAtOffset(offsets, clampedTop + visibleHeight + OVERSCAN) + 1,
  );
  const visibleRows: number[] = [];

  if (pinnedRow !== null && pinnedRow < first && pinnedRow < rowCount) {
    visibleRows.push(pinnedRow);
  }
  for (let index = first; index < last; index += 1) {
    visibleRows.push(index);
  }
  if (pinnedRow !== null && pinnedRow >= last && pinnedRow < rowCount) {
    visibleRows.push(pinnedRow);
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const syncViewport = () => setTop(viewport.scrollTop);

    syncViewport();
    viewport.addEventListener("scroll", syncViewport, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", syncViewport);
    };
  }, [viewportRef]);

  useLayoutEffect(() => {
    if (viewportRef.current) viewportRef.current.scrollTop = 0;
    pendingFocus.current = null;
    setPinnedRow(null);
    setTop(0);
  }, [resetKey, viewportRef]);

  useLayoutEffect(() => {
    if (pendingFocus.current && viewportRef.current && focusRow(viewportRef.current, pendingFocus.current)) {
      pendingFocus.current = null;
    }
  });

  function onRowFocus(event: FocusEvent<HTMLDivElement>) {
    setPinnedRow(getRowLocation(event.target)?.row ?? null);
  }

  function onRowBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    // Keep the trigger mounted while a person dialog owns focus.
    if (next instanceof Element && !next.closest('[role="dialog"]') && !event.currentTarget.contains(next)) {
      setPinnedRow(null);
    }
  }

  function onRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.metaKey || event.defaultPrevented) return;
    const current = getRowLocation(event.target);
    if (!current) return;

    const { ctrlKey, key, shiftKey } = event;
    const forward = key === "ArrowDown" || (key === "Tab" && !shiftKey);
    const backward = key === "ArrowUp" || (key === "Tab" && shiftKey);
    if (!(forward || backward || key === "Home" || key === "End")) return;
    if (ctrlKey && key !== "Home" && key !== "End") return;

    const step = forward || key === "Home" ? 1 : -1;
    let nextRow = current.row;
    let nextItem = current.item + step;
    if (key === "Home" || key === "End" || nextItem < 0 || nextItem >= itemsInRow(nextRow)) {
      nextRow = key === "Home" ? 0 : key === "End" ? rowCount - 1 : current.row + step;
      while (nextRow >= 0 && nextRow < rowCount && itemsInRow(nextRow) === 0) nextRow += step;
      if (nextRow < 0 || nextRow >= rowCount) return;
      nextItem = step > 0 ? 0 : itemsInRow(nextRow) - 1;
    }
    if (nextRow === current.row && nextItem === current.item) return;

    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    const top = viewport.scrollTop;
    const nextTop = Math.min(offsets[nextRow], Math.max(top, offsets[nextRow + 1] - visibleHeight));
    viewport.scrollTop = nextTop;
    const target = { row: nextRow, item: nextItem };
    pendingFocus.current = focusRow(viewport, target) ? null : target;
    setPinnedRow(nextRow);
    setTop(viewport.scrollTop);
  }

  return { visibleRows, totalHeight, onRowBlur, onRowFocus, onRowKeyDown };
}
