"use client";

import { Fragment, useId, useMemo, useRef, useState, type CSSProperties } from "react";

import type { PersonRecord } from "@/models/Person";
import { PersonGlyph } from "@/components/PersonGlyph";
import { useViewportSize, useVirtualRows } from "@/hooks/useVirtualRows";
import {
  computeGenerationMap,
  extractYear,
  formatDateLabel,
  getPersonDisplayName,
  getPartnerComponents,
  matchesPersonQuery,
} from "@/utils/familyTree";

interface TimelineViewProps {
  people: PersonRecord[];
  query: string;
  onSelectPerson: (personId: string) => void;
}

interface TimelineEntry {
  person: PersonRecord;
  birthYear: number;
  endYear: number;
  isLiving: boolean;
}

interface TimelineGroup {
  generation: number;
  entries: TimelineEntry[];
}

type TimelineRow =
  | { kind: "generation"; generation: number }
  | { kind: "person"; entry: TimelineEntry }
  | { kind: "undated-heading" }
  | { kind: "undated"; people: PersonRecord[] };

interface AxisMarker {
  year: number;
  isToday: boolean;
  showOnMobile: boolean;
}

const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5] as const;
const AXIS_HEIGHT = 53;
const GENERATION_NAMES = [
  "Prima",
  "Seconda",
  "Terza",
  "Quarta",
  "Quinta",
  "Sesta",
] as const;

function alignPartnerGenerations(people: PersonRecord[]): Map<string, number> {
  const generations = computeGenerationMap(people);
  for (const component of getPartnerComponents(people)) {
    let generation = 0;
    for (const id of component) {
      generation = Math.max(generation, generations.get(id) ?? 0);
    }
    for (const id of component) generations.set(id, generation);
  }

  return generations;
}

function buildTimelineData(people: PersonRecord[]) {
  const currentYear = new Date().getUTCFullYear();
  const generations = alignPartnerGenerations(people);
  const undatedPeople: PersonRecord[] = [];
  const groupedEntries = new Map<number, TimelineEntry[]>();
  let minYear = currentYear;
  let maxYear = currentYear;
  let hasDatedPeople = false;

  for (const person of people) {
    const birthYear = extractYear(person.birthDate);

    if (birthYear === null) {
      undatedPeople.push(person);
      continue;
    }

    const endYear = Math.max(extractYear(person.deathDate) ?? currentYear, birthYear);
    const generation = generations.get(person.id) ?? 0;
    const generationEntries = groupedEntries.get(generation) ?? [];
    generationEntries.push({
      person,
      birthYear,
      endYear,
      isLiving: person.deathDate === null,
    });
    groupedEntries.set(generation, generationEntries);
    minYear = hasDatedPeople ? Math.min(minYear, birthYear) : birthYear;
    maxYear = Math.max(maxYear, endYear);
    hasDatedPeople = true;
  }

  const groups: TimelineGroup[] = Array.from(groupedEntries.entries())
    .sort(([left], [right]) => left - right)
    .map(([generation, generationEntries]) => ({
      generation,
      entries: generationEntries.sort((left, right) =>
        Number(right.person.parentIds.length > 0) - Number(left.person.parentIds.length > 0),
      ),
    }));

  return {
    currentYear,
    groups,
    maxYear,
    minYear,
    undatedPeople,
  };
}

function buildTimelineRows(
  groups: TimelineGroup[],
  undatedPeople: PersonRecord[],
  undatedColumns: number,
  compact: boolean,
) {
  const rows: TimelineRow[] = [];
  const offsets = [0];
  const addRow = (row: TimelineRow, height: number) => {
    rows.push(row);
    offsets.push(offsets[offsets.length - 1] + height);
  };

  for (const group of groups) {
    addRow({ kind: "generation", generation: group.generation }, compact ? 37 : 35);
    for (const entry of group.entries) addRow({ kind: "person", entry }, compact ? 57 : 52);
  }

  if (undatedPeople.length) {
    addRow({ kind: "undated-heading" }, 43);
    for (let index = 0; index < undatedPeople.length; index += undatedColumns) {
      addRow({ kind: "undated", people: undatedPeople.slice(index, index + undatedColumns) }, 52);
    }
  }

  return { rows, offsets };
}

function getAxisMarkers(
  axisStartYear: number,
  axisEndYear: number,
  currentYear: number,
): AxisMarker[] {
  const years = new Set<number>();

  for (
    let year = Math.ceil(axisStartYear / 10) * 10;
    year <= axisEndYear;
    year += 10
  ) {
    years.add(year);
  }

  years.add(axisStartYear);
  years.add(axisEndYear);

  if (currentYear >= axisStartYear && currentYear <= axisEndYear) {
    years.add(currentYear);
  }

  return Array.from(years)
    .sort((left, right) => left - right)
    .map((year) => ({
      year,
      isToday: year === currentYear,
      showOnMobile:
        year === currentYear ||
        year === axisEndYear ||
        ((year - axisStartYear) % 20 === 0 && axisEndYear - year >= 12),
    }));
}

function getGenerationLabel(generation: number): string {
  return GENERATION_NAMES[generation]
    ? `${GENERATION_NAMES[generation]} generazione`
    : `${generation + 1}ª generazione`;
}

function getLegalName(person: PersonRecord): string {
  return (
    [person.name, person.surname].filter(Boolean).join(" ").trim() ||
    getPersonDisplayName(person)
  );
}

function getPosition(year: number, axisStartYear: number, axisEndYear: number): number {
  const span = Math.max(axisEndYear - axisStartYear, 1);
  return Math.min(100, Math.max(0, ((year - axisStartYear) / span) * 100));
}

function getMarkerAlignment(position: number): string {
  if (position <= 0) {
    return "translate-x-0 items-start";
  }

  if (position >= 100) {
    return "-translate-x-full items-end";
  }

  return "-translate-x-1/2 items-center";
}

interface TimelineGridProps {
  axisEndYear: number;
  axisStartYear: number;
  markers: AxisMarker[];
}

function TimelineGrid({
  axisEndYear,
  axisStartYear,
  markers,
}: TimelineGridProps) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0">
      {markers.map((marker) => {
        const position = getPosition(
          marker.year,
          axisStartYear,
          axisEndYear,
        );

        return (
          <span
            className={[
              "absolute inset-y-0",
              marker.isToday
                ? "w-px bg-[#173c2a]"
                : "border-l border-dashed border-[#d9dfdb]",
            ].join(" ")}
            key={marker.year}
            style={{ left: `${position}%` }}
          />
        );
      })}
    </span>
  );
}

interface TimelineAxisProps extends TimelineGridProps {
  currentYear: number;
}

function TimelineAxis({
  axisEndYear,
  axisStartYear,
  currentYear,
  markers,
}: TimelineAxisProps) {
  return (
    <div className="relative h-[52px] min-w-0 bg-white">
      <TimelineGrid
        axisEndYear={axisEndYear}
        axisStartYear={axisStartYear}
        markers={markers}
      />
      {markers.map((marker) => {
        const position = getPosition(
          marker.year,
          axisStartYear,
          axisEndYear,
        );

        return (
          <span
            className={[
              "absolute top-4 flex flex-col text-[11px] font-semibold text-[#26342d] sm:text-xs",
              getMarkerAlignment(position),
              marker.showOnMobile ? "" : "hidden sm:flex",
            ].join(" ")}
            key={marker.year}
            style={{ left: `${position}%` }}
          >
            <span>{marker.year === currentYear ? "Oggi" : marker.year}</span>
            {marker.isToday ? (
              <span className="mt-2 size-2.5 rounded-full bg-[#173c2a]" />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

interface TimelineBarProps extends TimelineGridProps {
  entry: TimelineEntry;
  highlighted: boolean;
}

function TimelineBar({
  axisEndYear,
  axisStartYear,
  entry,
  highlighted,
  markers,
}: TimelineBarProps) {
  const startPosition = getPosition(
    entry.birthYear,
    axisStartYear,
    axisEndYear,
  );
  const endPosition = getPosition(
    entry.endYear,
    axisStartYear,
    axisEndYear,
  );
  const spanPercentage = Math.max(endPosition - startPosition, 0);
  const compactLabels = spanPercentage < 22;
  const pinShortSpanToEnd = spanPercentage < 6 && endPosition > 94;
  const endLabel = entry.isLiving ? "oggi" : entry.endYear;

  return (
    <div className="relative h-14 min-w-0 overflow-hidden sm:h-[51px]">
      <TimelineGrid
        axisEndYear={axisEndYear}
        axisStartYear={axisStartYear}
        markers={markers}
      />
      <span
        aria-hidden="true"
        className={[
          "absolute top-1/2 h-7 -translate-y-1/2 rounded-md",
          entry.isLiving ? "bg-[#4f765f]" : "bg-[#3b3d3c]",
          highlighted
            ? "outline-2 outline-offset-2 outline-[#173c2a]"
            : "",
        ].join(" ")}
        style={{
          left: pinShortSpanToEnd ? "auto" : `${startPosition}%`,
          minWidth: pinShortSpanToEnd ? "80px" : "3px",
          right: pinShortSpanToEnd ? `${100 - endPosition}%` : "auto",
          width: pinShortSpanToEnd ? "80px" : `${spanPercentage}%`,
        }}
      >
        {!compactLabels || pinShortSpanToEnd ? (
          <>
            <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-white sm:text-xs">
              {entry.birthYear}
            </span>
            <span className="absolute inset-y-0 right-2 flex items-center text-[11px] font-semibold text-white sm:text-xs">
              {endLabel}
            </span>
          </>
        ) : null}
      </span>

      {compactLabels && !pinShortSpanToEnd ? (
        <>
          <span
            className="absolute top-1 text-[10px] font-semibold text-[#26342d] sm:text-[11px]"
            style={{
              left: `${startPosition}%`,
              transform:
                startPosition < 8 ? "none" : "translateX(calc(-100% - 6px))",
            }}
          >
            {entry.birthYear}
          </span>
          <span
            className="absolute bottom-1 text-[10px] font-semibold text-[#355e44] sm:text-[11px]"
            style={{
              left: `${endPosition}%`,
              transform:
                endPosition > 92 ? "translateX(-100%)" : "translateX(6px)",
            }}
          >
            {endLabel}
          </span>
        </>
      ) : null}
    </div>
  );
}

interface TimelineRowProps extends TimelineGridProps {
  row: TimelineRow;
  index: number;
  height: number;
  highlightIds: ReadonlySet<string> | null;
  onSelectPerson: (personId: string) => void;
  undatedColumns: number;
}

function TimelineRowContent({
  row,
  index,
  height,
  highlightIds,
  onSelectPerson,
  undatedColumns,
  ...gridProps
}: TimelineRowProps) {
  const isDimmed = (personId: string) => Boolean(highlightIds && !highlightIds.has(personId));
  if (row.kind === "generation") {
    return (
      <div className="grid grid-cols-[var(--timeline-name-column)_minmax(0,1fr)] border-b border-[#d7ddd8] bg-[#f4f7f4]" style={{ height }}>
        <h3 className="sticky left-0 z-20 flex items-center border-r border-[#d7ddd8] bg-[#f4f7f4] px-3 text-xs font-semibold text-[#173c2a] sm:px-5 sm:text-sm">
          {getGenerationLabel(row.generation)}
        </h3>
        <div aria-hidden="true" className="relative">
          <TimelineGrid {...gridProps} />
        </div>
      </div>
    );
  }

  if (row.kind === "undated-heading") {
    return (
      <h3 className="sticky left-0 flex items-center border-t border-[#d7ddd8] bg-[#f7f9f7] px-3 text-xs font-semibold text-[#173c2a] sm:px-5 sm:text-sm" style={{ height }}>
        Data di nascita non disponibile
      </h3>
    );
  }

  if (row.kind === "undated") {
    return (
      <div
        className="sticky left-0 grid w-[var(--timeline-viewport-width)] gap-2 bg-[#f7f9f7] px-3 pb-2 sm:px-5"
        data-virtual-row={index}
        style={{ height, gridTemplateColumns: `repeat(${undatedColumns}, minmax(0, 1fr))` }}
      >
        {row.people.map((person, itemIndex) => {
          const displayName = getPersonDisplayName(person);
          return (
            <button
              className={[
                "min-h-11 min-w-0 rounded-lg border bg-white px-2 text-sm font-medium text-[#26342d] outline-none transition-colors duration-150 hover:border-[#173c2a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173c2a] motion-reduce:transition-none",
                highlightIds?.has(person.id) ? "border-[#173c2a] bg-[#edf4ef]" : "border-[#d7ddd8]",
                isDimmed(person.id) ? "opacity-45 hover:opacity-100 focus-visible:opacity-100" : "",
              ].join(" ")}
              data-virtual-item={itemIndex}
              key={person.id}
              onClick={() => onSelectPerson(person.id)}
              title={displayName}
              type="button"
            >
              <span className="block truncate">{displayName}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const { entry } = row;
  const { person } = entry;
  const highlighted = highlightIds?.has(person.id) ?? false;
  const displayName = getLegalName(person);
  const endLabel = entry.isLiving ? "oggi" : entry.endYear;
  const rowBackground = highlighted ? "bg-[#edf4ef]" : "bg-white";

  return (
    <button
      aria-label={`Apri la scheda di ${displayName}, ${formatDateLabel(person.birthDate)} - ${person.deathDate ? formatDateLabel(person.deathDate) : "oggi"}`}
      className={[
        "group grid w-full grid-cols-[var(--timeline-name-column)_minmax(0,1fr)] text-left outline-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#173c2a] motion-reduce:transition-none",
        rowBackground,
        isDimmed(person.id) ? "opacity-45 hover:opacity-100 focus-visible:opacity-100" : "",
      ].join(" ")}
      data-virtual-row={index}
      onClick={() => onSelectPerson(person.id)}
      style={{ height }}
      title={`${displayName}: ${entry.birthYear} - ${endLabel}`}
      type="button"
    >
      <span
        className={[
          "sticky left-0 z-10 flex h-full min-w-0 items-center gap-2 border-r border-b border-[#d7ddd8] px-2 transition-colors duration-150 group-hover:bg-[#f4f7f4] motion-reduce:transition-none sm:gap-3 sm:px-5",
          rowBackground,
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#b8c7bc] bg-[#e8efe9] text-[#173c2a] sm:size-9"
        >
          <PersonGlyph className="size-[18px] sm:size-5" sex={person.sex} />
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 text-[11px] font-semibold leading-3 text-[#202723] sm:block sm:truncate sm:text-sm sm:leading-normal">
            {displayName}
          </span>
          <span className="mt-0.5 block text-[10px] text-[#66736b] sm:text-xs">
            {entry.birthYear}
          </span>
          {highlighted ? <span className="sr-only">Corrispondenza della ricerca.</span> : null}
        </span>
      </span>
      <div className="border-b border-[#d7ddd8]">
        <TimelineBar {...gridProps} entry={entry} highlighted={highlighted} />
      </div>
    </button>
  );
}

function getTimelineRowKey(row: TimelineRow): string {
  switch (row.kind) {
    case "generation": return `generation:${row.generation}`;
    case "person": return `person:${row.entry.person.id}`;
    case "undated-heading": return "undated-heading";
    case "undated": return `undated:${row.people[0].id}`;
  }
}

export function TimelineView({
  people,
  query,
  onSelectPerson,
}: TimelineViewProps) {
  const {
    currentYear,
    groups,
    maxYear,
    minYear,
    undatedPeople,
  } = useMemo(() => buildTimelineData(people), [people]);
  const [zoom, setZoom] = useState<number>(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const { compact, height, width } = useViewportSize(viewportRef);
  const undatedColumns = Math.max(1, Math.floor(width / 176));
  const { rows, offsets } = useMemo(
    () => buildTimelineRows(groups, undatedPeople, undatedColumns, compact),
    [compact, groups, undatedColumns, undatedPeople],
  );
  const { visibleRows, totalHeight, onRowBlur, onRowFocus, onRowKeyDown } = useVirtualRows(
    viewportRef,
    height,
    offsets,
    AXIS_HEIGHT,
    (index) => {
      const row = rows[index];
      return row.kind === "person" ? 1 : row.kind === "undated" ? row.people.length : 0;
    },
  );
  const titleId = useId();
  const descriptionId = useId();
  const highlightIds = useMemo(() => {
    if (!query.trim()) return null;
    const matches = new Set<string>();
    for (const person of people) {
      if (matchesPersonQuery(person, query)) matches.add(person.id);
    }
    return matches;
  }, [people, query]);
  const axisStartYear = Math.floor(minYear / 10) * 10;
  const markers = useMemo(
    () => getAxisMarkers(axisStartYear, maxYear, currentYear),
    [axisStartYear, currentYear, maxYear],
  );
  const zoomIndex = ZOOM_LEVELS.findIndex((level) => level === zoom);
  const rangeEndLabel = maxYear === currentYear ? "Oggi" : maxYear;

  const updateZoom = (nextZoom: number) => {
    const viewport = viewportRef.current;
    const previousMaxScroll = viewport
      ? Math.max(viewport.scrollWidth - viewport.clientWidth, 0)
      : 0;
    const scrollRatio =
      viewport && previousMaxScroll > 0
        ? viewport.scrollLeft / previousMaxScroll
        : 0.5;

    setZoom(nextZoom);

    window.requestAnimationFrame(() => {
      if (!viewport) {
        return;
      }

      const nextMaxScroll = Math.max(
        viewport.scrollWidth - viewport.clientWidth,
        0,
      );
      viewport.scrollLeft =
        nextZoom === 1 ? 0 : nextMaxScroll * scrollRatio;
    });
  };

  const fitRange = () => {
    updateZoom(1);
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
    }
  };

  return (
    <section
      aria-labelledby={titleId}
      className="flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-[20px] border border-[#d7ddd8] bg-white text-[#232a26]"
    >
      <div className="sr-only">
        <h2 id={titleId}>Cronologia di nascite e decessi</h2>
        <p id={descriptionId}>
          Le persone sono allineate per generazione, dalla nascita più antica
          fino a oggi.
        </p>
        <span>
          Intervallo {minYear} - {currentYear}
        </span>
        {highlightIds ? (
          <span aria-live="polite">{highlightIds.size} corrispondenze evidenziate</span>
        ) : null}
      </div>

      <div
        aria-describedby={descriptionId}
        aria-label={`Timeline familiare, intervallo ${minYear} - ${rangeEndLabel}`}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#173c2a] [overflow-anchor:none] [scrollbar-gutter:stable]"
        onBlurCapture={onRowBlur}
        onFocusCapture={onRowFocus}
        onKeyDown={onRowKeyDown}
        ref={viewportRef}
        tabIndex={0}
      >
        <div
          className="[--timeline-name-column:8.25rem] sm:[--timeline-name-column:13.5rem] lg:[--timeline-name-column:15rem]"
          style={{
            "--timeline-viewport-width": `${width}px`,
            minWidth: "100%",
            width: `${zoom * 100}%`,
          } as CSSProperties}
        >
          <div className="sticky top-0 z-30 grid grid-cols-[var(--timeline-name-column)_minmax(0,1fr)] border-b border-[#d7ddd8] bg-white">
            <div className="sticky left-0 z-40 flex h-[52px] items-center border-r border-[#d7ddd8] bg-white px-3 text-xs font-semibold text-[#173c2a] sm:px-5 sm:text-sm">
              Persona
            </div>
            <TimelineAxis
              axisEndYear={maxYear}
              axisStartYear={axisStartYear}
              currentYear={currentYear}
              markers={markers}
            />
          </div>

          {visibleRows.map((index, position) => {
            const row = rows[index];
            const previous = position === 0 ? 0 : visibleRows[position - 1] + 1;
            const gap = offsets[index] - offsets[previous];
            return (
              <Fragment key={getTimelineRowKey(row)}>
                {gap > 0 ? <div aria-hidden="true" style={{ height: gap }} /> : null}
                <TimelineRowContent
                  axisEndYear={maxYear}
                  axisStartYear={axisStartYear}
                  height={offsets[index + 1] - offsets[index]}
                  highlightIds={highlightIds}
                  index={index}
                  markers={markers}
                  onSelectPerson={onSelectPerson}
                  row={row}
                  undatedColumns={undatedColumns}
                />
              </Fragment>
            );
          })}
          {rows.length > 0 ? (
            <div aria-hidden="true" style={{ height: totalHeight - offsets[(visibleRows.at(-1) ?? -1) + 1] }} />
          ) : (
            <div className="flex min-h-40 items-center justify-center px-5 text-center text-sm text-[#66736b]">
              Nessuna persona disponibile nella timeline.
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-nowrap items-center justify-between gap-2 border-t border-[#d7ddd8] bg-white p-1.5">
        <button
          aria-pressed={zoom === 1}
          className="min-h-11 rounded-lg border border-[#cfd7d2] bg-white px-3 text-xs font-semibold text-[#173c2a] outline-none transition-colors duration-150 hover:bg-[#edf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173c2a] motion-reduce:transition-none sm:px-4 sm:text-sm"
          onClick={fitRange}
          type="button"
        >
          <span className="sm:hidden">Adatta</span>
          <span className="hidden sm:inline">Adatta intervallo</span>
        </button>

        <div
          aria-label="Controlli zoom timeline"
          className="flex min-h-11 items-stretch overflow-hidden rounded-lg border border-[#cfd7d2] bg-white"
          role="group"
        >
          <button
            aria-label="Riduci zoom timeline"
            className="min-h-11 min-w-11 border-r border-[#cfd7d2] px-2 text-xs font-semibold text-[#173c2a] outline-none transition-colors duration-150 hover:bg-[#edf4ef] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#173c2a] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none sm:min-w-12 sm:px-3 sm:text-sm"
            disabled={zoomIndex <= 0}
            onClick={() =>
              updateZoom(ZOOM_LEVELS[Math.max(0, zoomIndex - 1)])
            }
            type="button"
          >
            Meno
          </button>
          <span
            aria-live="polite"
            className="flex min-w-[5.75rem] flex-col items-center justify-center px-1 text-center text-[9px] leading-tight text-[#536159] sm:min-w-[9rem] sm:px-2 sm:text-[11px]"
          >
            <span className="font-semibold text-[#26342d]">
              {minYear}–{rangeEndLabel}
            </span>
            <span>
              Orizzontale · {Math.round(zoom * 100)}%
            </span>
          </span>
          <button
            aria-label="Aumenta zoom timeline"
            className="min-h-11 min-w-11 border-l border-[#cfd7d2] px-2 text-xs font-semibold text-[#173c2a] outline-none transition-colors duration-150 hover:bg-[#edf4ef] focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#173c2a] disabled:cursor-not-allowed disabled:opacity-35 motion-reduce:transition-none sm:min-w-12 sm:px-3 sm:text-sm"
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
            onClick={() =>
              updateZoom(
                ZOOM_LEVELS[
                  Math.min(ZOOM_LEVELS.length - 1, zoomIndex + 1)
                ],
              )
            }
            type="button"
          >
            Più
          </button>
        </div>
      </div>
    </section>
  );
}
