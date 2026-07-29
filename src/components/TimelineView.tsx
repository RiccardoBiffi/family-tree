"use client";

import { useId, useMemo, useRef, useState } from "react";

import type { PersonRecord } from "@/models/Person";
import { PersonGlyph } from "@/components/PersonGlyph";
import {
  computeGenerationMap,
  extractYear,
  formatDateLabel,
  getPersonDisplayName,
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
  generation: number;
  highlighted: boolean;
  isLiving: boolean;
}

interface TimelineGroup {
  generation: number;
  entries: TimelineEntry[];
}

interface AxisMarker {
  year: number;
  isToday: boolean;
  showOnMobile: boolean;
}

const ZOOM_LEVELS = [1, 1.25, 1.5, 2, 2.5] as const;
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
  const peopleById = new Map(people.map((person) => [person.id, person]));

  for (let pass = 0; pass < people.length; pass += 1) {
    let changed = false;

    for (const person of people) {
      for (const partnerId of person.partnerIds) {
        if (!peopleById.has(partnerId)) {
          continue;
        }

        const sharedGeneration = Math.max(
          generations.get(person.id) ?? 0,
          generations.get(partnerId) ?? 0,
        );

        if ((generations.get(person.id) ?? 0) !== sharedGeneration) {
          generations.set(person.id, sharedGeneration);
          changed = true;
        }

        if ((generations.get(partnerId) ?? 0) !== sharedGeneration) {
          generations.set(partnerId, sharedGeneration);
          changed = true;
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  return generations;
}

function buildTimelineData(people: PersonRecord[], query: string) {
  const currentYear = new Date().getUTCFullYear();
  const hasQuery = query.trim().length > 0;
  const generations = alignPartnerGenerations(people);
  const sourceOrder = new Map(
    people.map((person, index) => [person.id, index]),
  );
  const entries: TimelineEntry[] = [];
  const undatedPeople: PersonRecord[] = [];

  for (const person of people) {
    const birthYear = extractYear(person.birthDate);

    if (birthYear === null) {
      undatedPeople.push(person);
      continue;
    }

    entries.push({
      person,
      birthYear,
      endYear: Math.max(extractYear(person.deathDate) ?? currentYear, birthYear),
      generation: generations.get(person.id) ?? 0,
      highlighted: hasQuery && matchesPersonQuery(person, query),
      isLiving: person.deathDate === null,
    });
  }

  const groupedEntries = new Map<number, TimelineEntry[]>();

  for (const entry of entries) {
    const generationEntries = groupedEntries.get(entry.generation) ?? [];
    generationEntries.push(entry);
    groupedEntries.set(entry.generation, generationEntries);
  }

  const groups: TimelineGroup[] = Array.from(groupedEntries.entries())
    .sort(([left], [right]) => left - right)
    .map(([generation, generationEntries]) => ({
      generation,
      entries: generationEntries.sort((left, right) => {
        const lineagePriority =
          Number(right.person.parentIds.length > 0) -
          Number(left.person.parentIds.length > 0);

        return (
          lineagePriority ||
          (sourceOrder.get(left.person.id) ?? 0) -
            (sourceOrder.get(right.person.id) ?? 0)
        );
      }),
    }));
  const minYear =
    entries.length > 0
      ? Math.min(...entries.map((entry) => entry.birthYear))
      : currentYear;
  const maxYear = Math.max(
    currentYear,
    entries.length > 0
      ? Math.max(...entries.map((entry) => entry.endYear))
      : currentYear,
  );

  return {
    currentYear,
    entries,
    groups,
    maxYear,
    minYear,
    undatedPeople,
  };
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
}

function TimelineBar({
  axisEndYear,
  axisStartYear,
  entry,
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
          entry.highlighted
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

export function TimelineView({
  people,
  query,
  onSelectPerson,
}: TimelineViewProps) {
  const {
    currentYear,
    entries,
    groups,
    maxYear,
    minYear,
    undatedPeople,
  } = useMemo(() => buildTimelineData(people, query), [people, query]);
  const [zoom, setZoom] = useState<number>(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const hasQuery = query.trim().length > 0;
  const highlightedCount = entries.filter((entry) => entry.highlighted).length;
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
        {hasQuery ? (
          <span>{highlightedCount} corrispondenze evidenziate</span>
        ) : null}
      </div>

      <div
        aria-describedby={descriptionId}
        aria-label={`Timeline familiare, intervallo ${minYear} - ${rangeEndLabel}`}
        className="relative min-h-0 flex-1 overflow-auto overscroll-contain bg-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#173c2a] [scrollbar-gutter:stable]"
        ref={viewportRef}
        tabIndex={0}
      >
        <div
          className="[--timeline-name-column:8.25rem] sm:[--timeline-name-column:13.5rem] lg:[--timeline-name-column:15rem]"
          style={{
            minWidth: "100%",
            width: `${zoom * 100}%`,
          }}
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

          {groups.map((group) => {
            const groupTitleId = `${titleId}-generation-${group.generation}`;

            return (
              <section aria-labelledby={groupTitleId} key={group.generation}>
                <div className="grid grid-cols-[var(--timeline-name-column)_minmax(0,1fr)] border-b border-[#d7ddd8] bg-[#f4f7f4]">
                  <h3
                    className="sticky left-0 z-20 flex min-h-9 items-center border-r border-[#d7ddd8] bg-[#f4f7f4] px-3 text-xs font-semibold text-[#173c2a] sm:min-h-[34px] sm:px-5 sm:text-sm"
                    id={groupTitleId}
                  >
                    {getGenerationLabel(group.generation)}
                  </h3>
                  <div
                    aria-hidden="true"
                    className="relative min-h-9 sm:min-h-[34px]"
                  >
                    <TimelineGrid
                      axisEndYear={maxYear}
                      axisStartYear={axisStartYear}
                      markers={markers}
                    />
                  </div>
                </div>

                {group.entries.map((entry) => {
                  const displayName = getLegalName(entry.person);
                  const endLabel = entry.isLiving ? "oggi" : entry.endYear;
                  const highlighted = hasQuery && entry.highlighted;
                  const rowBackground = highlighted
                    ? "bg-[#edf4ef]"
                    : "bg-white";

                  return (
                    <button
                      aria-label={`Apri la scheda di ${displayName}, ${formatDateLabel(entry.person.birthDate)} - ${
                        entry.person.deathDate
                          ? formatDateLabel(entry.person.deathDate)
                          : "oggi"
                      }`}
                      className={[
                        "group grid w-full grid-cols-[var(--timeline-name-column)_minmax(0,1fr)] text-left outline-none transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#173c2a] motion-reduce:transition-none",
                        rowBackground,
                        hasQuery && !entry.highlighted
                          ? "opacity-45 hover:opacity-100 focus-visible:opacity-100"
                          : "",
                      ].join(" ")}
                      key={entry.person.id}
                      onClick={() => onSelectPerson(entry.person.id)}
                      title={`${displayName}: ${entry.birthYear} - ${endLabel}`}
                      type="button"
                    >
                      <span
                        className={[
                          "sticky left-0 z-10 flex h-14 min-w-0 items-center gap-2 border-r border-b border-[#d7ddd8] px-2 transition-colors duration-150 group-hover:bg-[#f4f7f4] motion-reduce:transition-none sm:h-[51px] sm:gap-3 sm:px-5",
                          rowBackground,
                        ].join(" ")}
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#b8c7bc] bg-[#e8efe9] text-[#173c2a] sm:size-9"
                        >
                          <PersonGlyph
                            className="size-[18px] sm:size-5"
                            sex={entry.person.sex}
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-[11px] font-semibold leading-3 text-[#202723] sm:block sm:truncate sm:text-sm sm:leading-normal">
                            {displayName}
                          </span>
                          <span className="mt-0.5 block text-[10px] text-[#66736b] sm:text-xs">
                            {entry.birthYear}
                          </span>
                          {highlighted ? (
                            <span className="sr-only">
                              Corrispondenza della ricerca.
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <div className="border-b border-[#d7ddd8]">
                        <TimelineBar
                          axisEndYear={maxYear}
                          axisStartYear={axisStartYear}
                          entry={entry}
                          markers={markers}
                        />
                      </div>
                    </button>
                  );
                })}
              </section>
            );
          })}

          {entries.length === 0 && undatedPeople.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center px-5 text-center text-sm text-[#66736b]">
              Nessuna persona disponibile nella timeline.
            </div>
          ) : null}

          {undatedPeople.length > 0 ? (
            <section className="border-t border-[#d7ddd8] bg-[#f7f9f7] px-3 py-4 sm:px-5">
              <h3 className="text-xs font-semibold text-[#173c2a] sm:text-sm">
                Data di nascita non disponibile
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {undatedPeople.map((person) => {
                  const highlighted =
                    hasQuery && matchesPersonQuery(person, query);

                  return (
                    <button
                      className={[
                        "min-h-11 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-[#26342d] outline-none transition-colors duration-150 hover:border-[#6f9a7d] hover:bg-[#edf4ef] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173c2a] motion-reduce:transition-none",
                        highlighted
                          ? "border-[#173c2a] bg-[#edf4ef]"
                          : "border-[#d7ddd8]",
                        hasQuery && !highlighted ? "opacity-45" : "",
                      ].join(" ")}
                      key={person.id}
                      onClick={() => onSelectPerson(person.id)}
                      type="button"
                    >
                      {getPersonDisplayName(person)}
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
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
