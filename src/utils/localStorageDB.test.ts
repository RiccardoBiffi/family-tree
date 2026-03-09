import { describe, expect, it } from "vitest";

import { FAMILY_TREE_VERSION } from "@/models/FamilyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";

describe("LocalStorageDB", () => {
  it("loads the demo tree and persists it when storage is empty", () => {
    const db = new LocalStorageDB("family-tree.test.load");

    const snapshot = db.load();

    expect(snapshot.version).toBe(FAMILY_TREE_VERSION);
    expect(snapshot.people.length).toBeGreaterThan(0);
    expect(window.localStorage.getItem("family-tree.test.load")).not.toBeNull();
  });

  it("normalizes parent-child and partner references before saving", () => {
    const db = new LocalStorageDB("family-tree.test.normalize");

    const saved = db.save({
      version: FAMILY_TREE_VERSION,
      metadata: {
        title: "Test",
        description: "Snapshot di prova",
        familyName: "Test",
        updatedAt: "2026-03-09T00:00:00.000Z",
      },
      people: [
        {
          id: "p1",
          name: "Mario",
          knownAs: null,
          surname: "Rossi",
          sex: "male",
          birthDate: "1980-01-01",
          birthPlace: null,
          deathDate: null,
          deathPlace: null,
          photo: null,
          distinguishingMarks: null,
          attachments: null,
          notes: null,
          profession: null,
          instruction: null,
          tags: null,
          parentIds: [],
          childIds: ["p2"],
          partnerIds: ["p2"],
          createdAt: "2026-03-09T00:00:00.000Z",
          updatedAt: "2026-03-09T00:00:00.000Z",
        },
        {
          id: "p2",
          name: "Giulia",
          knownAs: null,
          surname: "Bianchi",
          sex: "female",
          birthDate: "2005-01-01",
          birthPlace: null,
          deathDate: null,
          deathPlace: null,
          photo: null,
          distinguishingMarks: null,
          attachments: null,
          notes: null,
          profession: null,
          instruction: null,
          tags: null,
          parentIds: [],
          childIds: [],
          partnerIds: [],
          createdAt: "2026-03-09T00:00:00.000Z",
          updatedAt: "2026-03-09T00:00:00.000Z",
        },
      ],
    });

    const mario = saved.people.find((person) => person.id === "p1");
    const giulia = saved.people.find((person) => person.id === "p2");

    expect(mario?.childIds).toContain("p2");
    expect(mario?.partnerIds).toContain("p2");
    expect(giulia?.parentIds).toContain("p1");
    expect(giulia?.partnerIds).toContain("p1");
  });
});
