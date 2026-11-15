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

function cleanReferenceList(sourceId: string, ids: string[], validIds: Set<string>, preserveOrder = false): string[] {
  const uniqueIds = uniqueStrings(ids.filter((id) => id !== sourceId && validIds.has(id)));
  return preserveOrder ? uniqueIds : uniqueIds.sort((left, right) => left.localeCompare(right));
}

function cleanParentSelections(person: PersonRecord, parentIds: string[]): PersonRecord {
  const biologicalParentIds = person.biologicalParentIds?.filter((id) => parentIds.includes(id));
  const diagramParentIds = person.diagramParentIds?.filter((id) => parentIds.includes(id));
  return {
    ...person,
    parentIds,
    ...(biologicalParentIds === undefined ? {} : { biologicalParentIds: biologicalParentIds.slice(0, 2) }),
    ...(diagramParentIds === undefined ? {} : { diagramParentIds: diagramParentIds.length <= 2 ? diagramParentIds : [] }),
  };
}

export function getBiologicalParentIds(person: PersonRecord): string[] {
  // Older archives record parent links in order without a separate designation.
  return person.biologicalParentIds ?? person.parentIds.slice(0, 2);
}

export function getDiagramParentIds(person: PersonRecord): string[] {
  if (person.parentIds.length <= 2) {
    return person.parentIds;
  }
  const chosen = person.diagramParentIds;
  return chosen?.length === 2 &&
    chosen[0] !== chosen[1] &&
    chosen.every((id) => person.parentIds.includes(id))
    ? chosen
    : [];
}

function upsertReference(collection: string[], id: string): string[] {
  return collection.includes(id) ? collection : [...collection, id];
}

function removeReference(collection: string[], id: string): string[] {
  return collection.filter((currentId) => currentId !== id);
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

export function reconcilePersonRelationships(
  currentPeople: PersonRecord[],
  nextPerson: PersonRecord,
): PersonRecord[] {
  const validIds = new Set([
    ...currentPeople.map((person) => person.id),
    nextPerson.id,
  ]);
  const parentIds = cleanReferenceList(
    nextPerson.id,
    nextPerson.parentIds,
    validIds,
    true,
  );
  const childIds = cleanReferenceList(
    nextPerson.id,
    nextPerson.childIds,
    validIds,
  );
  const partnerIds = cleanReferenceList(
    nextPerson.id,
    nextPerson.partnerIds,
    validIds,
  );
  const parentIdSet = new Set(parentIds);
  const childIdSet = new Set(childIds);
  const partnerIdSet = new Set(partnerIds);

  const reconciledPeople = currentPeople
    .filter((person) => person.id !== nextPerson.id)
    .map((person) => {
      const parentIdsForPerson = childIdSet.has(person.id)
        ? upsertReference(person.parentIds, nextPerson.id)
        : removeReference(person.parentIds, nextPerson.id);
      const childIdsForPerson = removeReference(
        person.childIds,
        nextPerson.id,
      );
      const partnerIdsForPerson = removeReference(
        person.partnerIds,
        nextPerson.id,
      );

      return {
        ...cleanParentSelections(person, parentIdsForPerson),
        childIds: parentIdSet.has(person.id)
          ? upsertReference(childIdsForPerson, nextPerson.id)
          : childIdsForPerson,
        partnerIds: partnerIdSet.has(person.id)
          ? upsertReference(partnerIdsForPerson, nextPerson.id)
          : partnerIdsForPerson,
      };
    });

  return [
    ...reconciledPeople,
    {
      ...cleanParentSelections(nextPerson, parentIds),
      childIds,
      partnerIds,
    },
  ];
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
    person.parentIds = cleanReferenceList(person.id, person.parentIds, validIds, true);
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
      ...cleanParentSelections(person, cleanReferenceList(person.id, person.parentIds, validIds, true)),
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

function analyzeAncestry(
  people: readonly PersonRecord[],
  parentIdsFor: (person: PersonRecord) => string[] = (person) => person.parentIds,
) {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const generations = new Map<string, number>();
  const active = new Set<string>();
  let hasCycle = false;

  for (const person of peopleById.values()) {
    if (generations.has(person.id)) {
      continue;
    }

    const stack = [{ person, parentIds: parentIdsFor(person), nextParent: 0, generation: 0 }];
    active.add(person.id);
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.nextParent >= frame.parentIds.length) {
        generations.set(frame.person.id, frame.generation);
        active.delete(frame.person.id);
        stack.pop();
        continue;
      }

      const parentId = frame.parentIds[frame.nextParent];
      const recordedGeneration = generations.get(parentId);
      const parent = peopleById.get(parentId);

      if (recordedGeneration !== undefined || !parent || active.has(parentId)) {
        hasCycle ||= active.has(parentId);
        frame.generation = Math.max(frame.generation, (recordedGeneration ?? 0) + 1);
        frame.nextParent += 1;
        continue;
      }

      active.add(parent.id);
      stack.push({ person: parent, parentIds: parentIdsFor(parent), nextParent: 0, generation: 0 });
    }
  }

  return { generations, hasCycle };
}

export interface FamilyTreeIssue {
  id: "empty" | "ancestry-cycle" | "diagram-parents" | "isolated";
  title: string;
  message: string;
  personIds: string[];
}

export function getFamilyTreeIssues({ people }: FamilyTreeSnapshot): FamilyTreeIssue[] {
  if (people.length === 0) {
    return [{
      id: "empty",
      title: "Archivio vuoto",
      message: "Aggiungi almeno una persona per iniziare.",
      personIds: [],
    }];
  }

  const issues: FamilyTreeIssue[] = [];
  if (analyzeAncestry(people).hasCycle) {
    const indexById = new Map(people.map(({ id }, index) => [id, index]));
    const ancestry = people.map(({ parentIds }) => {
      const parents = new Set<number>();
      for (const id of parentIds) {
        const index = indexById.get(id);
        if (index !== undefined) {
          parents.add(index);
        }
      }
      return parents;
    });
    const cyclic = getDirectedCycles(ancestry);
    issues.push({
      id: "ancestry-cycle",
      title: "Cicli di ascendenza",
      message: "Queste persone fanno parte di relazioni circolari tra antenati e discendenti.",
      personIds: people.filter((_, index) => cyclic.has(index)).map(({ id }) => id),
    });
  }

  const missingDiagramParents = people.filter((person) =>
    person.parentIds.length > 2 && getDiagramParentIds(person).length !== 2,
  );
  if (missingDiagramParents.length > 0) {
    issues.push({
      id: "diagram-parents",
      title: "Genitori da scegliere per il Diagramma",
      message: "Per le persone con più di due genitori registrati, scegli quali due mostrare nel Diagramma.",
      personIds: missingDiagramParents.map(({ id }) => id),
    });
  }

  const isolated = people.filter(({ parentIds, childIds, partnerIds }) =>
    parentIds.length === 0 && childIds.length === 0 && partnerIds.length === 0,
  );
  if (isolated.length > 0) {
    issues.push({
      id: "isolated",
      title: "Persone senza relazioni",
      message: "Queste persone non hanno genitori, figli o partner collegati nell’archivio.",
      personIds: isolated.map(({ id }) => id),
    });
  }

  return issues;
}

export function validateFamilyTree(snapshot: FamilyTreeSnapshot): string[] {
  return getFamilyTreeIssues(snapshot).map(({ message }) => message);
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

const personDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDateLabel(date: string | null): string {
  const time = date ? Date.parse(date) : NaN;
  return Number.isNaN(time) ? "Data sconosciuta" : personDateFormatter.format(time);
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

export function computeGenerationMap(people: readonly PersonRecord[]): Map<string, number> {
  return analyzeAncestry(people).generations;
}

export function getPartnerComponents(people: readonly PersonRecord[]): string[][] {
  const neighbors = new Map<string, string[]>(people.map(({ id }) => [id, []]));
  for (const person of people) {
    const personNeighbors = neighbors.get(person.id)!;
    for (const partnerId of person.partnerIds) {
      const partnerNeighbors = neighbors.get(partnerId);
      if (partnerNeighbors && partnerId !== person.id) {
        personNeighbors.push(partnerId);
        partnerNeighbors.push(person.id);
      }
    }
  }

  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const id of neighbors.keys()) {
    if (visited.has(id)) {
      continue;
    }
    const group = [id];
    groups.push(group);
    visited.add(id);
    for (let cursor = 0; cursor < group.length; cursor += 1) {
      for (const partnerId of neighbors.get(group[cursor])!) {
        if (!visited.has(partnerId)) {
          group.push(partnerId);
          visited.add(partnerId);
        }
      }
    }
  }
  return groups;
}

function getDirectedCycles(outgoing: readonly ReadonlySet<number>[]): Set<number> {
  const incoming = outgoing.map((): number[] => []);
  outgoing.forEach((children, parent) => {
    for (const child of children) {
      incoming[child].push(parent);
    }
  });

  // Complete an iterative depth-first traversal before following the reverse edges.
  const finished: number[] = [];
  const visited = new Set<number>();
  outgoing.forEach((_, index) => {
    if (visited.has(index)) {
      return;
    }
    visited.add(index);
    const stack = [{ index, children: outgoing[index].values() }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const child = frame.children.next();
      if (child.done) {
        finished.push(frame.index);
        stack.pop();
      } else if (!visited.has(child.value)) {
        visited.add(child.value);
        stack.push({ index: child.value, children: outgoing[child.value].values() });
      }
    }
  });

  visited.clear();
  const cyclic = new Set<number>();
  for (let index = finished.length - 1; index >= 0; index -= 1) {
    const root = finished[index];
    if (visited.has(root)) {
      continue;
    }
    visited.add(root);
    const component = [root];
    for (let cursor = 0; cursor < component.length; cursor += 1) {
      for (const neighbor of incoming[component[cursor]]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          component.push(neighbor);
        }
      }
    }
    if (component.length > 1 || outgoing[root].has(root)) {
      for (const member of component) {
        cyclic.add(member);
      }
    }
  }
  return cyclic;
}

export function computeDiagramGenerationMap(people: readonly PersonRecord[]): Map<string, number> {
  const baseGenerations = analyzeAncestry(people, getDiagramParentIds).generations;
  const groups = getPartnerComponents(people);
  if (groups.length === people.length) {
    return baseGenerations;
  }

  const ancestryEdges: [string, string][] = [];
  for (const child of people) {
    const generation = baseGenerations.get(child.id) ?? 0;
    for (const parentId of getDiagramParentIds(child)) {
      const parentGeneration = baseGenerations.get(parentId);
      if (parentGeneration !== undefined && parentGeneration < generation) {
        ancestryEdges.push([parentId, child.id]);
      }
    }
  }

  const buildGraph = (groups: string[][]) => {
    const groupByPerson = new Map<string, number>();
    const levels = groups.map((group, groupId) => {
      let level = 0;
      for (const id of group) {
        groupByPerson.set(id, groupId);
        level = Math.max(level, baseGenerations.get(id) ?? 0);
      }
      return level;
    });
    const outgoing = groups.map(() => new Set<number>());
    const indegree = groups.map(() => 0);
    for (const [parent, child] of ancestryEdges) {
      const from = groupByPerson.get(parent)!;
      const to = groupByPerson.get(child)!;
      if (!outgoing[from].has(to)) {
        outgoing[from].add(to);
        indegree[to] += 1;
      }
    }
    return { groupByPerson, indegree, levels, outgoing };
  };

  let graph = buildGraph(groups);
  const cyclic = getDirectedCycles(graph.outgoing);
  if (cyclic.size > 0) {
    // Splitting only contradictory partner groups preserves alignments elsewhere.
    graph = buildGraph(
      groups.flatMap((group, index) => cyclic.has(index) ? group.map((id) => [id]) : [group]),
    );
  }

  const queue: number[] = [];
  graph.indegree.forEach((degree, index) => {
    if (degree === 0) {
      queue.push(index);
    }
  });
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor];
    for (const child of graph.outgoing[index]) {
      graph.levels[child] = Math.max(graph.levels[child], graph.levels[index] + 1);
      graph.indegree[child] -= 1;
      if (graph.indegree[child] === 0) {
        queue.push(child);
      }
    }
  }

  return new Map(people.map(({ id }) => [id, graph.levels[graph.groupByPerson.get(id)!]]));
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
