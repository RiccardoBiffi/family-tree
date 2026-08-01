import { describe, expect, it } from "vitest";

import { seedFamilyTree } from "@/data/seedFamilyTree";
import { parseMediaAssetReference } from "@/models/MediaAsset";
import { removeLegacyAttachmentValues } from "@/utils/snapshotMigration";

describe("seed media ownership", () => {
  it("does not provide photos or multimedia for demo people", () => {
    for (const person of seedFamilyTree.people) {
      expect(person.photo).toBeNull();
      expect(person.attachments).toBeNull();
    }
  });

  it("removes legacy text attachments without touching user media references", () => {
    const snapshot = {
      ...seedFamilyTree,
      people: seedFamilyTree.people.map((person, index) => ({
        ...person,
        attachments:
          index === 0
            ? ["Album cartaceo", "media:user-p1-audio"]
            : person.attachments,
      })),
    };

    const cleaned = removeLegacyAttachmentValues(snapshot);

    expect(cleaned).not.toBe(snapshot);
    expect(cleaned.people[0]?.attachments).toEqual([
      "media:user-p1-audio",
    ]);
    expect(
      parseMediaAssetReference(cleaned.people[0]?.attachments?.[0]),
    ).toBe("user-p1-audio");
    expect(removeLegacyAttachmentValues(cleaned)).toBe(cleaned);
  });
});
