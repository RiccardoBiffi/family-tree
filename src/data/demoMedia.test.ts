import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { demoMediaDefinitions } from "@/data/demoMedia";
import { seedFamilyTree } from "@/data/seedFamilyTree";
import { parseMediaAssetReference } from "@/models/MediaAsset";
import {
  addMissingDemoMediaReferences,
  removeLegacyAttachmentValues,
} from "@/utils/demoMediaMigration";

describe("demo media", () => {
  it("ships one local portrait and one local audio postcard for every demo person", () => {
    expect(demoMediaDefinitions).toHaveLength(seedFamilyTree.people.length * 2);
    expect(new Set(demoMediaDefinitions.map((asset) => asset.id)).size).toBe(
      demoMediaDefinitions.length,
    );

    for (const person of seedFamilyTree.people) {
      const personAssets = demoMediaDefinitions.filter(
        (asset) => asset.personId === person.id,
      );
      expect(personAssets.map((asset) => asset.role).sort()).toEqual([
        "attachment",
        "photo",
      ]);
      expect(parseMediaAssetReference(person.photo)).toBe(
        `demo-${person.id}-photo`,
      );
      expect(
        person.attachments
          ?.map((attachment) => parseMediaAssetReference(attachment))
          .filter(Boolean),
      ).toContain(`demo-${person.id}-audio`);

      for (const asset of personAssets) {
        const absolutePath = join(process.cwd(), "public", asset.path);
        expect(statSync(absolutePath).size).toBeGreaterThan(1_000);
        const header = readFileSync(absolutePath).subarray(0, 12);
        expect(header.toString("ascii", 0, 4)).toBe("RIFF");
        expect(header.toString("ascii", 8, 12)).toBe(
          asset.mimeType === "image/webp" ? "WEBP" : "WAVE",
        );
      }
    }
  });

  it("migrates the legacy demo once without replacing an existing photo", () => {
    const legacySnapshot = {
      ...seedFamilyTree,
      people: seedFamilyTree.people.map((person, index) => ({
        ...person,
        photo: index === 0 ? "https://example.test/legacy.jpg" : null,
        attachments:
          person.attachments?.filter(
            (attachment) => !parseMediaAssetReference(attachment),
          ) ?? null,
      })),
    };

    const migrated = addMissingDemoMediaReferences(legacySnapshot);

    expect(migrated.people[0]?.photo).toBe(
      "https://example.test/legacy.jpg",
    );
    expect(migrated.people[1]?.photo).toBe("media:demo-p2-photo");
    for (const person of migrated.people) {
      expect(person.attachments).toContain(
        `media:demo-${person.id}-audio`,
      );
    }
  });

  it("removes legacy text attachment values without touching media references", () => {
    const snapshot = {
      ...seedFamilyTree,
      people: seedFamilyTree.people.map((person, index) => ({
        ...person,
        attachments:
          index === 0
            ? ["Album cartaceo", "media:demo-p1-audio"]
            : person.attachments,
      })),
    };

    const cleaned = removeLegacyAttachmentValues(snapshot);

    expect(cleaned).not.toBe(snapshot);
    expect(cleaned.people[0]?.attachments).toEqual([
      "media:demo-p1-audio",
    ]);
    expect(removeLegacyAttachmentValues(cleaned)).toBe(cleaned);
  });
});
