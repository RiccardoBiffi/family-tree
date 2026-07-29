import type { FamilyTreeSnapshot } from "@/models/FamilyTree";

export const DEMO_MEDIA_MIGRATION_STORAGE_KEY =
  "family-tree.migration.demo-media-references.v1";

const demoIdentityByPersonId = new Map([
  ["p1", "Giovanni Rinaldi"],
  ["p2", "Anna Conti"],
  ["p3", "Marco Rinaldi"],
  ["p4", "Lucia Rinaldi"],
  ["p5", "Elena Moretti"],
  ["p6", "Paolo Greco"],
  ["p7", "Sofia Rinaldi"],
  ["p8", "Pietro Rinaldi"],
  ["p9", "Teresa Greco"],
  ["p10", "Matteo Rinaldi"],
]);

function getLocalStorage(): Storage | null {
  if (
    typeof window === "undefined" ||
    typeof window.localStorage === "undefined"
  ) {
    return null;
  }

  return window.localStorage;
}

export function hasCompletedDemoMediaMigration(): boolean {
  return (
    getLocalStorage()?.getItem(DEMO_MEDIA_MIGRATION_STORAGE_KEY) ===
    "complete"
  );
}

export function markDemoMediaMigrationComplete(): void {
  getLocalStorage()?.setItem(
    DEMO_MEDIA_MIGRATION_STORAGE_KEY,
    "complete",
  );
}

export function addMissingDemoMediaReferences(
  snapshot: FamilyTreeSnapshot,
): FamilyTreeSnapshot {
  let changed = false;
  const people = snapshot.people.map((person) => {
    const expectedName = demoIdentityByPersonId.get(person.id);
    if (
      !expectedName ||
      [person.name, person.surname].filter(Boolean).join(" ") !== expectedName
    ) {
      return person;
    }

    const photoReference = `media:demo-${person.id}-photo`;
    const audioReference = `media:demo-${person.id}-audio`;
    const nextPhoto = person.photo ?? photoReference;
    const nextAttachments = person.attachments?.includes(audioReference)
      ? person.attachments
      : [...(person.attachments ?? []), audioReference];

    if (
      nextPhoto === person.photo &&
      nextAttachments === person.attachments
    ) {
      return person;
    }

    changed = true;
    return {
      ...person,
      photo: nextPhoto,
      attachments: nextAttachments,
    };
  });

  return changed ? { ...snapshot, people } : snapshot;
}
