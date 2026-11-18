"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { PersonRecord } from "@/models/Person";
import { extractYear, getPersonDisplayName, getSiblingIds, matchesPersonQuery } from "@/utils/familyTree";

interface FamilyFocusViewProps {
  peopleById: ReadonlyMap<string, PersonRecord>;
  personId: string | null;
  query: string;
  onNavigate: (id: string) => void;
  onOpenPerson: (id: string) => void;
}

export function getDefaultFamilyPerson(people: readonly PersonRecord[]) {
  return people.find((person) => person.parentIds.length > 0 && person.childIds.length > 0) ?? people[0];
}

function dateLabel(person: PersonRecord) {
  const birth = extractYear(person.birthDate);
  const death = extractYear(person.deathDate);
  if (birth !== null && death !== null) return `${birth} – ${death}`;
  if (birth !== null) return `Nascita ${birth}`;
  return death !== null ? `Decesso ${death}` : null;
}

function RelativeList({ people, onNavigate }: {
  people: PersonRecord[];
  onNavigate: (id: string) => void;
}) {
  const [limit, setLimit] = useState(24);
  return (
    <>
      <ul className="grid list-none gap-1.5">
        {people.slice(0, limit).map((person) => {
          const name = getPersonDisplayName(person);
          const dates = dateLabel(person);
          return (
            <li key={person.id}>
              <button
                aria-label={`Mostra la famiglia di ${name}`}
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[#d9e1da] bg-white px-3 py-2 text-left text-[#193e29] transition-colors hover:border-[#789781] hover:bg-[#f3f7f2] focus-visible:outline-2 focus-visible:outline-offset-2"
                onClick={() => onNavigate(person.id)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block font-semibold [overflow-wrap:anywhere]">{name}</span>
                  {dates ? <span className="block text-xs text-[#526759]">{dates}</span> : null}
                </span>
                <span aria-hidden="true" className="shrink-0 text-xl leading-none text-[#627a68]">›</span>
              </button>
            </li>
          );
        })}
      </ul>
      {people.length > limit ? (
        <button className="min-h-11 text-sm font-semibold text-[#285c40] underline" onClick={() => setLimit(limit + 24)} type="button">
          Mostra altre {Math.min(24, people.length - limit)} persone
        </button>
      ) : null}
    </>
  );
}

const groupClass = "rounded-2xl border border-[#d8e1d7] bg-[#f5f8f3] p-3 sm:p-4";
const titleClass = "mb-2 text-sm font-bold text-[#294e36]";

export function FamilyFocusView({ peopleById, personId, query, onNavigate, onOpenPerson }: FamilyFocusViewProps) {
  const people = useMemo(() => Array.from(peopleById.values()), [peopleById]);
  const search = query.trim();
  const matches = useMemo(
    () => search ? people.filter((candidate) => matchesPersonQuery(candidate, search)) : [],
    [people, search],
  );
  const person = (personId && peopleById.get(personId)) || getDefaultFamilyPerson(people);

  const heading = useRef<HTMLHeadingElement>(null);
  const scrollingPanel = useRef<HTMLElement>(null);
  const shouldFocus = useRef(personId !== null && !search);
  const navigate = (id: string) => {
    shouldFocus.current = true;
    onNavigate(id);
  };
  useEffect(() => {
    if (shouldFocus.current && !search) {
      shouldFocus.current = false;
      if (scrollingPanel.current) scrollingPanel.current.scrollTop = 0;
      heading.current?.focus({ preventScroll: true });
    }
  }, [person?.id, search]);

  if (search) {
    return (
      <section aria-label="Persone trovate" className="overflow-y-auto bg-[#fbfcfa] px-4 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="mb-3 text-lg font-semibold text-[#193e29]">
            {matches.length === 0 ? "Nessuna persona trovata" : `Scegli una persona (${matches.length})`}
          </h2>
          <RelativeList key={search} onNavigate={navigate} people={matches} />
        </div>
      </section>
    );
  }
  if (!person) {
    return <section className="grid place-content-center text-[#536159]">Nessuna persona nell’archivio.</section>;
  }

  const resolve = (ids: string[]) => ids.flatMap((id) => {
    const relative = peopleById.get(id);
    return relative ? [relative] : [];
  });
  const parents = resolve(person.parentIds);
  const children = resolve(person.childIds);
  const siblings = resolve(getSiblingIds(person, peopleById));
  const partners = resolve(person.partnerIds);
  const childrenByParents = new Map<string, { others: PersonRecord[]; children: PersonRecord[] }>();
  for (const child of children) {
    const others = child.parentIds.filter((id) => id !== person.id).sort();
    const key = JSON.stringify(others);
    const group = childrenByParents.get(key);
    if (group) group.children.push(child);
    else childrenByParents.set(key, { others: resolve(others), children: [child] });
  }
  const hasSide = siblings.length > 0 || partners.length > 0;
  const name = getPersonDisplayName(person);
  const dates = dateLabel(person);
  return (
    <section aria-label={`Famiglia di ${name}`} className="overflow-y-auto bg-[#fbfcfa] px-3 py-4 sm:px-7 sm:py-6" ref={scrollingPanel}>
      <div className={`mx-auto grid w-full items-start gap-4 sm:gap-5 ${hasSide ? "max-w-5xl md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "max-w-2xl"}`} key={person.id}>
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#173e29] p-4 text-white sm:p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[#d1e0ce]">Famiglia di</p>
              <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl leading-tight [overflow-wrap:anywhere] outline-none sm:text-4xl" ref={heading} tabIndex={-1}>{name}</h2>
              {dates ? <p className="mt-1 text-sm text-[#d9e6d8]">{dates}</p> : null}
            </div>
            <button className="min-h-11 rounded-lg border border-[#92ac97] px-3 text-sm font-semibold hover:bg-[#295239] focus-visible:outline-2" onClick={() => onOpenPerson(person.id)} type="button">Apri scheda</button>
          </div>
          {parents.length > 0 ? (
            <section aria-label="Genitori" className="mt-4 border-l-2 border-[#8da387] pl-3 md:order-first md:mt-0 md:mb-4">
              <h3 className={titleClass}>Genitori di {person.name}</h3>
              <RelativeList onNavigate={navigate} people={parents} />
            </section>
          ) : null}
          {children.length > 0 ? (
            <section aria-label="Figli" className="mt-4 border-l-2 border-[#8da387] pl-3">
              <h3 className={titleClass}>Figli di {person.name}</h3>
              <div className="grid gap-3">
                {Array.from(childrenByParents, ([key, group]) => (
                  <div
                    aria-label={group.others.length ? `Figli di ${[person, ...group.others].map(getPersonDisplayName).join(" e ")}` : `Figli di ${name} con il solo genitore indicato`}
                    key={key}
                    role="group"
                  >
                    {group.others.length > 0 ? (
                      <p className="mb-1.5 text-sm text-[#4c6051]">
                        {group.others.length === 1 ? "Altro genitore" : "Altri genitori"}{" · "}
                        {group.others.map((other, index) => (
                          <span key={other.id}>
                            {index > 0 ? ", " : ""}
                            <button className="min-h-8 font-medium underline decoration-[#94ab99] underline-offset-2 hover:text-[#173e29]" onClick={() => navigate(other.id)} type="button">
                              {getPersonDisplayName(other)}
                            </button>
                          </span>
                        ))}
                      </p>
                    ) : childrenByParents.size > 1 ? (
                      <p className="mb-1.5 text-sm text-[#4c6051]">Altro genitore non indicato</p>
                    ) : null}
                    <RelativeList onNavigate={navigate} people={group.children} />
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {parents.length + children.length === 0 && !hasSide ? (
            <p className="mt-3 text-sm text-[#536159]">Nessun familiare registrato per questa persona.</p>
          ) : null}
        </div>
        {hasSide ? (
          <div className="grid min-w-0 gap-3">
            {siblings.length > 0 ? (
              <section aria-label="Fratelli e sorelle" className={groupClass}>
                <h3 className={titleClass}>Fratelli e sorelle di {person.name}</h3>
                <RelativeList onNavigate={navigate} people={siblings} />
              </section>
            ) : null}
            {partners.length > 0 ? (
              <section aria-label="Partner" className={groupClass}>
                <h3 className={titleClass}>Partner di {person.name}</h3>
                <RelativeList onNavigate={navigate} people={partners} />
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
