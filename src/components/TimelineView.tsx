"use client";

import { useMemo } from "react";

import type { PersonRecord } from "@/models/Person";
import {
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
  deathYear: number;
  visualEndYear: number;
  highlighted: boolean;
}

const YEAR_WIDTH = 42;
const TIMELINE_PADDING = 40;
const CARD_MIN_WIDTH = 220;
const LANE_HEIGHT = 112;

function getMinVisualSpanYears(): number {
  return Math.max(1, Math.ceil(CARD_MIN_WIDTH / YEAR_WIDTH));
}

function buildTimelineData(people: PersonRecord[], query: string) {
  const currentYear = new Date().getUTCFullYear();
  const highlightedMatches = new Set(
    people.filter((person) => matchesPersonQuery(person, query)).map((person) => person.id),
  );
  const entries: TimelineEntry[] = people
    .map((person) => {
      const birthYear = extractYear(person.birthDate);

      if (birthYear === null) {
        return null;
      }

      const deathYear = Math.max(extractYear(person.deathDate) ?? currentYear, birthYear);
      const visualEndYear = Math.max(
        deathYear,
        birthYear + getMinVisualSpanYears() - 1,
      );

      return {
        person,
        birthYear,
        deathYear,
        visualEndYear,
        highlighted: highlightedMatches.has(person.id),
      };
    })
    .filter((entry): entry is TimelineEntry => Boolean(entry))
    .sort((left, right) => {
      if (left.birthYear !== right.birthYear) {
        return left.birthYear - right.birthYear;
      }

      if (left.deathYear !== right.deathYear) {
        return right.deathYear - left.deathYear;
      }

      return getPersonDisplayName(left.person).localeCompare(getPersonDisplayName(right.person));
    });

  const undatedPeople = people.filter((person) => extractYear(person.birthDate) === null);
  const minYear = entries.length > 0 ? Math.min(...entries.map((entry) => entry.birthYear)) : currentYear;
  const maxYear = Math.max(
    currentYear,
    entries.length > 0 ? Math.max(...entries.map((entry) => entry.deathYear)) : currentYear,
  );
  const laneEnds: number[] = [];
  const lanes: TimelineEntry[][] = [];

  for (const entry of entries) {
    let laneIndex = laneEnds.findIndex((laneEnd) => entry.birthYear > laneEnd);

    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push([]);
      laneEnds.push(Number.NEGATIVE_INFINITY);
    }

    lanes[laneIndex].push(entry);
    laneEnds[laneIndex] = entry.visualEndYear;
  }

  return {
    currentYear,
    lanes,
    maxYear,
    minYear,
    undatedPeople,
  };
}

function getYearMarkers(minYear: number, maxYear: number) {
  const years: number[] = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    if (year === minYear || year === maxYear || year % 5 === 0) {
      years.push(year);
    }
  }

  return years;
}

export function TimelineView({ people, query, onSelectPerson }: TimelineViewProps) {
  const { currentYear, lanes, maxYear, minYear, undatedPeople } = useMemo(
    () => buildTimelineData(people, query),
    [people, query],
  );
  const hasQuery = query.trim().length > 0;
  const minVisualSpanYears = getMinVisualSpanYears();
  const yearMarkers = useMemo(() => getYearMarkers(minYear, maxYear), [maxYear, minYear]);
  const totalWidth = (maxYear - minYear + 1) * YEAR_WIDTH + TIMELINE_PADDING * 2;
  const displayWidth = Math.max(totalWidth, 960);
  const timelineHeight = lanes.length * LANE_HEIGHT + 72;
  const highlightedCount = lanes.flat().filter((entry) => entry.highlighted).length;

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9cfbd] px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Vista timeline</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-900">
            Cronologia di nascite e decessi
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Scorri in orizzontale dalla nascita piu&apos; antica disponibile fino a oggi. Le persone sono distribuite su corsie separate per evitare sovrapposizioni.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[#5f6d63]">
          <span className="rounded-full bg-white px-3 py-2">
            Intervallo {minYear} - {currentYear}
          </span>
          <span className="rounded-full bg-white px-3 py-2">{lanes.length} corsie</span>
          <span className="rounded-full bg-white px-3 py-2">
            {hasQuery ? `${highlightedCount} evidenziate` : `${lanes.flat().length} schede`}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8f1e4_60%,#efe2c8_100%)]">
        <div className="relative px-5 py-5" style={{ minWidth: `${displayWidth}px` }}>
          <div
            className="relative overflow-hidden rounded-[24px] border border-[#d9cfbd] bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(248,241,228,0.92)_100%)]"
            style={{ height: `${timelineHeight}px`, width: `${displayWidth}px` }}
          >
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage: [
                  `repeating-linear-gradient(90deg, rgba(188,173,142,0.2) 0, rgba(188,173,142,0.2) 1px, transparent 1px, transparent ${YEAR_WIDTH}px)`,
                  `repeating-linear-gradient(90deg, rgba(126,147,111,0.18) 0, rgba(126,147,111,0.18) 2px, transparent 2px, transparent ${YEAR_WIDTH * 5}px)`,
                ].join(","),
              }}
            />

            <div className="relative h-full">
              <div className="absolute left-0 right-0 top-0 h-[72px] border-b border-[#d9cfbd] bg-white/80">
                <div className="relative h-full px-10">
                  <div className="absolute bottom-0 left-10 right-10 h-px bg-[#d9cfbd]" />
                  {yearMarkers.map((year) => (
                    <div
                      className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center"
                      key={year}
                      style={{
                        left: `${TIMELINE_PADDING + (year - minYear) * YEAR_WIDTH}px`,
                      }}
                    >
                      <span className="mb-3 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f6d63]">
                        {year}
                      </span>
                      <span className="h-3 w-px bg-[#8ea684]" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 top-[72px]">
                {lanes.map((lane, laneIndex) => (
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-[#d9cfbd]/80"
                    key={`lane-${laneIndex}`}
                    style={{ top: `${laneIndex * LANE_HEIGHT + 24}px` }}
                  >
                    {lane.map((entry) => {
                      const left = TIMELINE_PADDING + (entry.birthYear - minYear) * YEAR_WIDTH;
                      const width =
                        Math.max(entry.deathYear - entry.birthYear + 1, minVisualSpanYears) *
                        YEAR_WIDTH;

                      return (
                        <button
                          className={[
                            "absolute top-3 rounded-[22px] border px-4 py-3 text-left shadow-[0_18px_60px_rgba(15,23,42,0.12)] transition",
                            entry.highlighted
                              ? "border-[#d1a04f] bg-[#fffaf1] ring-4 ring-[#d1a04f]/20"
                              : hasQuery
                                ? "border-[#d9cfbd] bg-[#fffaf1]/70 opacity-60 hover:border-[#8ea684] hover:opacity-100"
                                : "border-[#d9cfbd] bg-[#fffaf1]/88 hover:border-[#8ea684]",
                          ].join(" ")}
                          key={entry.person.id}
                          onClick={() => onSelectPerson(entry.person.id)}
                          style={{
                            left: `${left}px`,
                            width: `${width}px`,
                          }}
                          type="button"
                        >
                          <span className="block truncate text-sm font-semibold text-slate-900">
                            {getPersonDisplayName(entry.person)}
                          </span>
                          <span className="mt-1 block text-[11px] uppercase tracking-[0.18em] text-[#5f6d63]">
                            {entry.person.birthPlace ?? entry.person.profession ?? "Scheda persona"}
                          </span>
                          <span className="mt-3 block h-2 rounded-full bg-[linear-gradient(90deg,#153524_0%,#2f6b47_55%,#d9b56d_100%)]" />
                          <span className="mt-2 block text-xs text-slate-600">
                            {formatDateLabel(entry.person.birthDate)} -{" "}
                            {entry.person.deathDate ? formatDateLabel(entry.person.deathDate) : "oggi"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {undatedPeople.length > 0 ? (
        <div className="border-t border-[#d9cfbd] px-5 py-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#5f6d63]">
            Persone fuori scala temporale
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {undatedPeople.map((person) => (
              <button
                className="rounded-full border border-[#d9cfbd] bg-white px-3 py-2 text-sm text-slate-700 transition hover:border-[#5f8f63] hover:text-[#153524]"
                key={person.id}
                onClick={() => onSelectPerson(person.id)}
                type="button"
              >
                {getPersonDisplayName(person)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
