import { seedFamilyTree } from "@/data/seedFamilyTree";
import {
  FAMILY_TREE_VERSION,
  type FamilyTreeMetadata,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { Person, type PersonId, type PersonInput, type PersonRecord } from "@/models/Person";

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeMetadata(metadata?: Partial<FamilyTreeMetadata>): FamilyTreeMetadata {
  const fallback = seedFamilyTree.metadata;

  return {
    title: metadata?.title?.trim() || fallback.title,
    description: metadata?.description?.trim() || fallback.description,
    familyName: metadata?.familyName?.trim() || fallback.familyName,
    updatedAt: metadata?.updatedAt || new Date().toISOString(),
  };
}

export function createPersonId(index = 0): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `person-${crypto.randomUUID()}`;
  }

  return `person-${Date.now()}-${index + 1}`;
}

function cleanReferenceList(sourceId: string, ids: string[], validIds: Set<string>): string[] {
  return uniqueStrings(
    ids.filter((id) => id !== sourceId && validIds.has(id)),
  ).sort((left, right) => left.localeCompare(right));
}

function upsertReference(collection: string[], id: string): string[] {
  return collection.includes(id) ? collection : [...collection, id];
}

function sortPeople(people: PersonRecord[]): PersonRecord[] {
  return [...people].sort((left, right) => {
    const leftDate = left.birthDate ?? "9999-12-31";
    const rightDate = right.birthDate ?? "9999-12-31";

    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }

    return getPersonDisplayName(left).localeCompare(getPersonDisplayName(right));
  });
}

export function normalizeFamilyTree(
  snapshot?: Partial<FamilyTreeSnapshot> | null,
): FamilyTreeSnapshot {
  const source = snapshot ?? seedFamilyTree;
  const rawPeople = Array.isArray(source.people) ? source.people : [];

  const materialized = rawPeople.map((rawPerson, index) => {
    const person = new Person({
      ...(rawPerson as PersonInput),
      id: rawPerson?.id?.trim() || createPersonId(index),
    });

    return person.toRecord();
  });

  const peopleById = new Map<PersonId, PersonRecord>(
    materialized.map((person) => [
      person.id,
      {
        ...person,
        parentIds: [...person.parentIds],
        childIds: [...person.childIds],
        partnerIds: [...person.partnerIds],
      },
    ]),
  );
  const validIds = new Set(peopleById.keys());

  for (const person of peopleById.values()) {
    person.parentIds = cleanReferenceList(person.id, person.parentIds, validIds);
    person.childIds = cleanReferenceList(person.id, person.childIds, validIds);
    person.partnerIds = cleanReferenceList(person.id, person.partnerIds, validIds);
  }

  for (const person of peopleById.values()) {
    for (const childId of person.childIds) {
      const child = peopleById.get(childId);
      if (child) {
        child.parentIds = upsertReference(child.parentIds, person.id);
      }
    }

    for (const parentId of person.parentIds) {
      const parent = peopleById.get(parentId);
      if (parent) {
        parent.childIds = upsertReference(parent.childIds, person.id);
      }
    }

    for (const partnerId of person.partnerIds) {
      const partner = peopleById.get(partnerId);
      if (partner) {
        partner.partnerIds = upsertReference(partner.partnerIds, person.id);
      }
    }
  }

  const people = sortPeople(
    Array.from(peopleById.values()).map((person) => ({
      ...person,
      parentIds: cleanReferenceList(person.id, person.parentIds, validIds),
      childIds: cleanReferenceList(person.id, person.childIds, validIds),
      partnerIds: cleanReferenceList(person.id, person.partnerIds, validIds),
    })),
  );

  return {
    version: FAMILY_TREE_VERSION,
    metadata: normalizeMetadata(source.metadata),
    people,
  };
}

function detectAncestryCycle(peopleById: Map<string, PersonRecord>): boolean {
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function dfs(personId: string): boolean {
    if (visiting.has(personId)) {
      return true;
    }

    if (visited.has(personId)) {
      return false;
    }

    visiting.add(personId);
    const person = peopleById.get(personId);

    for (const parentId of person?.parentIds ?? []) {
      if (dfs(parentId)) {
        return true;
      }
    }

    visiting.delete(personId);
    visited.add(personId);
    return false;
  }

  for (const personId of peopleById.keys()) {
    if (dfs(personId)) {
      return true;
    }
  }

  return false;
}

export function validateFamilyTree(snapshot: FamilyTreeSnapshot): string[] {
  const warnings: string[] = [];
  const peopleById = new Map(snapshot.people.map((person) => [person.id, person]));

  if (snapshot.people.length === 0) {
    warnings.push("L'albero e' vuoto. Aggiungi almeno una persona per iniziare.");
  }

  if (detectAncestryCycle(peopleById)) {
    warnings.push("Sono state rilevate dipendenze circolari tra antenati e discendenti.");
  }

  const peopleWithManyParents = snapshot.people.filter((person) => person.parentIds.length > 2);
  if (peopleWithManyParents.length > 0) {
    warnings.push("Alcune persone hanno piu' di due genitori associati: verifica la coerenza genealogica.");
  }

  const isolatedPeople = snapshot.people.filter(
    (person) =>
      person.parentIds.length === 0 &&
      person.childIds.length === 0 &&
      person.partnerIds.length === 0,
  );
  if (isolatedPeople.length > 0) {
    warnings.push(
      `${isolatedPeople.length} persona/e non hanno ancora relazioni collegate nell'albero.`,
    );
  }

  return warnings;
}

export function createEmptyPersonDraft(): PersonRecord {
  return new Person({
    id: "",
    name: "",
    sex: null,
    parentIds: [],
    childIds: [],
    partnerIds: [],
  }).toRecord();
}

export function getPersonDisplayName(person: Pick<PersonRecord, "name" | "knownAs" | "surname">): string {
  const legalName = [person.name, person.surname].filter(Boolean).join(" ").trim();
  if (person.knownAs) {
    return `${person.knownAs} (${legalName || person.knownAs})`;
  }

  return legalName || "Persona senza nome";
}

export function getPersonShortName(
  person: Pick<PersonRecord, "name" | "knownAs" | "surname">,
): string {
  if (person.knownAs) {
    return person.knownAs;
  }

  return person.name || person.surname || "Sconosciuto";
}

export function formatDateLabel(date: string | null): string {
  if (!date) {
    return "Data sconosciuta";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function extractYear(date: string | null): number | null {
  if (!date) {
    return null;
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getUTCFullYear();
}

export function getLifeSpanLabel(person: PersonRecord): string {
  const birthYear = extractYear(person.birthDate);
  const deathYear = extractYear(person.deathDate);

  if (!birthYear && !deathYear) {
    return "Date sconosciute";
  }

  return `${birthYear ?? "?"} - ${deathYear ?? "oggi"}`;
}

export function computeGenerationMap(people: PersonRecord[]): Map<string, number> {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const memo = new Map<string, number>();
  const active = new Set<string>();

  const getGeneration = (personId: string): number => {
    if (memo.has(personId)) {
      return memo.get(personId) ?? 0;
    }

    if (active.has(personId)) {
      return 0;
    }

    active.add(personId);
    const person = peopleById.get(personId);

    if (!person || person.parentIds.length === 0) {
      memo.set(personId, 0);
      active.delete(personId);
      return 0;
    }

    const generation =
      Math.max(
        ...person.parentIds.map((parentId) => getGeneration(parentId)),
      ) + 1;

    memo.set(personId, generation);
    active.delete(personId);
    return generation;
  };

  for (const person of people) {
    getGeneration(person.id);
  }

  return memo;
}

export function getPartnersLabel(person: PersonRecord, peopleById: Map<string, PersonRecord>): string {
  if (person.partnerIds.length === 0) {
    return "Nessun partner";
  }

  return person.partnerIds
    .map((partnerId) => peopleById.get(partnerId))
    .filter((partner): partner is PersonRecord => Boolean(partner))
    .map((partner) => getPersonShortName(partner))
    .join(", ");
}

export function matchesPersonQuery(person: PersonRecord, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const haystack = [
    person.name,
    person.knownAs,
    person.surname,
    person.birthPlace,
    person.deathPlace,
    person.profession,
    person.notes,
    ...(person.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}
