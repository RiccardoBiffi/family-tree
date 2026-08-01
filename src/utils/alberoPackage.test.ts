import { Blob as NodeBlob } from "node:buffer";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { seedFamilyTree } from "@/data/seedFamilyTree";
import {
  MEDIA_ASSET_REFERENCE_PREFIX,
  createMediaAssetRecord,
  createMediaAssetReference,
  type MediaAssetRecord,
} from "@/models/MediaAsset";
import type { FamilyTreeSnapshot } from "@/models/FamilyTree";
import {
  ALBERO_MIME_TYPE,
  ALBERO_PACKAGE_FORMAT,
  ALBERO_PACKAGE_VERSION,
  exportAlberoPackage,
  importAlberoPackage,
} from "@/utils/alberoPackage";

beforeAll(() => {
  vi.stubGlobal("Blob", NodeBlob);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readBlob(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

async function gzipText(value: string): Promise<Blob> {
  const source = new NodeBlob([value]).stream() as unknown as ReadableStream<Uint8Array>;
  const compression = new CompressionStream(
    "gzip",
  ) as unknown as TransformStream<Uint8Array, Uint8Array>;
  const stream = source.pipeThrough(compression);
  const bytes = await readStream(stream);
  return new Blob([bytes], { type: ALBERO_MIME_TYPE });
}

async function gzipJson(value: unknown): Promise<Blob> {
  return gzipText(JSON.stringify(value));
}

function snapshotWithoutMediaReferences(): FamilyTreeSnapshot {
  return {
    ...seedFamilyTree,
    people: seedFamilyTree.people.map((person) => {
      const attachments = (person.attachments ?? []).filter(
        (attachment) =>
          !attachment.startsWith(MEDIA_ASSET_REFERENCE_PREFIX),
      );

      return {
        ...person,
        photo:
          person.photo?.startsWith(MEDIA_ASSET_REFERENCE_PREFIX) === true
            ? null
            : person.photo,
        attachments: attachments.length > 0 ? attachments : null,
      };
    }),
  };
}

function createClosedSnapshot(): FamilyTreeSnapshot {
  const snapshot = snapshotWithoutMediaReferences();

  return {
    ...snapshot,
    people: snapshot.people.map((person) => {
      const attachments = [...(person.attachments ?? [])];
      if (person.id === "p3") {
        attachments.push(createMediaAssetReference("asset-p3-audio"));
      }

      return {
        ...person,
        photo:
          person.id === "p1"
            ? createMediaAssetReference("asset-p1-photo")
            : person.photo,
        attachments: attachments.length > 0 ? attachments : null,
      };
    }),
  };
}

function createClosedAssets(): MediaAssetRecord[] {
  return [
    createMediaAssetRecord({
      id: "asset-p1-photo",
      personId: "p1",
      role: "photo",
      name: "giovanni.png",
      blob: new Blob([new Uint8Array([137, 80, 78, 71])], {
        type: "image/png",
      }),
      createdAt: "2026-07-29T09:00:00.000Z",
      updatedAt: "2026-07-29T09:00:00.000Z",
    }),
    createMediaAssetRecord({
      id: "asset-p3-audio",
      personId: "p3",
      role: "attachment",
      name: "intervista.mp3",
      blob: new Blob([new Uint8Array([73, 68, 51, 4, 0])], {
        type: "audio/mpeg",
      }),
      createdAt: "2026-07-29T09:30:00.000Z",
      updatedAt: "2026-07-29T09:30:00.000Z",
    }),
  ];
}

function packageDocument(overrides: Record<string, unknown> = {}) {
  return {
    format: ALBERO_PACKAGE_FORMAT,
    version: ALBERO_PACKAGE_VERSION,
    exportedAt: "2026-07-29T10:00:00.000Z",
    snapshot: snapshotWithoutMediaReferences(),
    assets: [],
    ...overrides,
  };
}

function withoutBlob(asset: MediaAssetRecord) {
  const { blob, ...metadata } = asset;
  void blob;
  return metadata;
}

async function serializeAsset(asset: MediaAssetRecord) {
  const bytes = await readBlob(asset.blob);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return {
    ...withoutBlob(asset),
    data: btoa(binary),
  };
}

describe(".albero package", () => {
  it("round-trips a media-free snapshot with zero assets", async () => {
    const snapshot = snapshotWithoutMediaReferences();

    const archive = await exportAlberoPackage(snapshot, [], {
      exportedAt: "2026-07-29T10:00:00.000Z",
    });
    const imported = await importAlberoPackage(archive);

    expect(imported.snapshot).toEqual(snapshot);
    expect(imported.assets).toEqual([]);
  });

  it("round-trips a realistic closed snapshot and every media Blob", async () => {
    const snapshot = createClosedSnapshot();
    const assets = createClosedAssets();

    const archive = await exportAlberoPackage(snapshot, assets, {
      exportedAt: "2026-07-29T10:00:00.000Z",
    });
    const compressed = await readBlob(archive);
    const imported = await importAlberoPackage(archive);

    expect(archive.type).toBe(ALBERO_MIME_TYPE);
    expect(Array.from(compressed.slice(0, 2))).toEqual([0x1f, 0x8b]);
    expect(imported.exportedAt).toBe("2026-07-29T10:00:00.000Z");
    expect(imported.snapshot).toEqual(snapshot);
    expect(imported.assets.map(withoutBlob)).toEqual(
      assets.map(withoutBlob),
    );
    expect(Array.from(await readBlob(imported.assets[0].blob))).toEqual([
      137,
      80,
      78,
      71,
    ]);
    expect(imported.assets[0].blob.type).toBe("image/png");
    expect(Array.from(await readBlob(imported.assets[1].blob))).toEqual([
      73,
      68,
      51,
      4,
      0,
    ]);
  });

  it("rejects missing and malformed media references on export and import", async () => {
    const snapshot = createClosedSnapshot();
    const [, attachment] = createClosedAssets();
    const remainingAssets = [attachment];
    const serializedAssets = await Promise.all(
      remainingAssets.map(serializeAsset),
    );

    await expect(
      exportAlberoPackage(snapshot, remainingAssets),
    ).rejects.toMatchObject({
      code: "INVALID_ASSET",
      message: expect.stringContaining("is missing media asset"),
    });
    await expect(
      importAlberoPackage(
        await gzipJson(packageDocument({ snapshot, assets: serializedAssets })),
      ),
    ).rejects.toMatchObject({
      code: "INVALID_ASSET",
      message: expect.stringContaining("is missing media asset"),
    });

    const malformedSnapshot = snapshotWithoutMediaReferences();
    malformedSnapshot.people[0] = {
      ...malformedSnapshot.people[0],
      photo: "media:%",
    };

    await expect(
      exportAlberoPackage(malformedSnapshot, []),
    ).rejects.toMatchObject({
      code: "INVALID_ASSET",
      message: expect.stringContaining("invalid media asset reference"),
    });
    await expect(
      importAlberoPackage(
        await gzipJson(packageDocument({ snapshot: malformedSnapshot })),
      ),
    ).rejects.toMatchObject({
      code: "INVALID_ASSET",
      message: expect.stringContaining("invalid media asset reference"),
    });
  });

  it("rejects person and role mismatches on export and import", async () => {
    const snapshot = createClosedSnapshot();
    const assets = createClosedAssets();
    const mismatchedPhotos: MediaAssetRecord[] = [
      { ...assets[0], personId: "p2" },
      { ...assets[0], role: "attachment" },
    ];

    for (const mismatchedPhoto of mismatchedPhotos) {
      const mismatchedAssets = [mismatchedPhoto, assets[1]];

      await expect(
        exportAlberoPackage(snapshot, mismatchedAssets),
      ).rejects.toMatchObject({
        code: "INVALID_ASSET",
        message: expect.stringContaining("does not match"),
      });

      const serializedAssets = await Promise.all(
        mismatchedAssets.map(serializeAsset),
      );
      await expect(
        importAlberoPackage(
          await gzipJson(
            packageDocument({ snapshot, assets: serializedAssets }),
          ),
        ),
      ).rejects.toMatchObject({
        code: "INVALID_ASSET",
        message: expect.stringContaining("does not match"),
      });
    }
  });

  it("rejects orphaned media assets on export and import", async () => {
    const snapshot = createClosedSnapshot();
    const orphan = createMediaAssetRecord({
      id: "asset-p1-orphan",
      personId: "p1",
      role: "attachment",
      name: "documento-orfano.pdf",
      blob: new Blob([new Uint8Array([37, 80, 68, 70])], {
        type: "application/pdf",
      }),
      createdAt: "2026-07-29T09:45:00.000Z",
      updatedAt: "2026-07-29T09:45:00.000Z",
    });
    const assets = [...createClosedAssets(), orphan];

    await expect(exportAlberoPackage(snapshot, assets)).rejects.toMatchObject({
      code: "INVALID_ASSET",
      message: expect.stringContaining("is not referenced by the snapshot"),
    });

    const serializedAssets = await Promise.all(assets.map(serializeAsset));
    await expect(
      importAlberoPackage(
        await gzipJson(packageDocument({ snapshot, assets: serializedAssets })),
      ),
    ).rejects.toMatchObject({
      code: "INVALID_ASSET",
      message: expect.stringContaining("is not referenced by the snapshot"),
    });
  });

  it("rejects non-gzip, malformed JSON, wrong format, and unsupported versions", async () => {
    await expect(
      importAlberoPackage(new Blob(["plain json"], { type: "application/json" })),
    ).rejects.toMatchObject({ code: "INVALID_COMPRESSION" });

    await expect(importAlberoPackage(await gzipText("{not-json"))).rejects.toMatchObject({
      code: "INVALID_JSON",
    });

    await expect(
      importAlberoPackage(
        await gzipJson(packageDocument({ format: "not-an-albero-file" })),
      ),
    ).rejects.toMatchObject({ code: "WRONG_FORMAT" });

    await expect(
      importAlberoPackage(
        await gzipJson(packageDocument({ version: 999 })),
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_VERSION" });

    await expect(
      importAlberoPackage(
        await gzipJson(
          packageDocument({
            snapshot: { ...seedFamilyTree, version: 999 },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_VERSION" });
  });

  it("rejects malformed base64, unsafe media types, and configured size overflows", async () => {
    const serializedAsset = {
      version: 1,
      id: "asset-p1",
      personId: "p1",
      role: "attachment",
      name: "documento.pdf",
      mimeType: "application/pdf",
      size: 1,
      createdAt: "2026-07-29T10:00:00.000Z",
      updatedAt: "2026-07-29T10:00:00.000Z",
      data: "AQ==",
    };

    await expect(
      importAlberoPackage(
        await gzipJson(
          packageDocument({
            assets: [{ ...serializedAsset, data: "###=" }],
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "INVALID_ASSET" });

    await expect(
      importAlberoPackage(
        await gzipJson(
          packageDocument({
            assets: [
              {
                ...serializedAsset,
                name: "unsafe.html",
                mimeType: "text/html",
              },
            ],
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "UNSAFE_MEDIA" });

    const validArchive = await gzipJson(packageDocument());
    await expect(
      importAlberoPackage(validArchive, { maxCompressedBytes: 1 }),
    ).rejects.toMatchObject({ code: "PACKAGE_TOO_LARGE" });
    await expect(
      importAlberoPackage(validArchive, { maxUncompressedBytes: 32 }),
    ).rejects.toMatchObject({ code: "PACKAGE_TOO_LARGE" });
  });
});
