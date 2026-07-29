import { Blob as NodeBlob } from "node:buffer";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  MEDIA_ASSET_RECORD_VERSION,
  MediaAssetValidationError,
  createMediaAssetRecord,
  createMediaAssetReference,
  parseMediaAssetReference,
  validateMediaAssetRecord,
} from "@/models/MediaAsset";

beforeAll(() => {
  vi.stubGlobal("Blob", NodeBlob);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("MediaAssetRecord", () => {
  it("creates a canonical versioned record and stable local reference", () => {
    const record = createMediaAssetRecord({
      id: "asset-p1-photo",
      personId: "p1",
      role: "photo",
      name: "ritratto.png",
      blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
      createdAt: "2026-07-29T10:00:00.000Z",
      updatedAt: "2026-07-29T10:00:00.000Z",
    });

    expect(record).toMatchObject({
      version: MEDIA_ASSET_RECORD_VERSION,
      id: "asset-p1-photo",
      personId: "p1",
      role: "photo",
      name: "ritratto.png",
      mimeType: "image/png",
      size: 3,
    });
    expect(createMediaAssetReference(record.id)).toBe("media:asset-p1-photo");
    expect(parseMediaAssetReference("media:asset-p1-photo")).toBe(record.id);
    expect(parseMediaAssetReference("https://example.com/photo.png")).toBeNull();
  });

  it("rejects unsafe types, oversized blobs, and mismatched metadata", () => {
    expect(() =>
      createMediaAssetRecord({
        personId: "p1",
        role: "attachment",
        name: "unsafe.html",
        blob: new Blob(["<script></script>"], { type: "text/html" }),
      }),
    ).toThrowError(
      expect.objectContaining<Partial<MediaAssetValidationError>>({
        code: "UNSAFE_MEDIA_TYPE",
      }),
    );

    expect(() =>
      createMediaAssetRecord(
        {
          personId: "p1",
          role: "attachment",
          name: "large.pdf",
          blob: new Blob([new Uint8Array([1, 2, 3, 4])], {
            type: "application/pdf",
          }),
        },
        { maxAssetBytes: 3 },
      ),
    ).toThrowError(
      expect.objectContaining<Partial<MediaAssetValidationError>>({
        code: "MEDIA_ASSET_TOO_LARGE",
      }),
    );

    const valid = createMediaAssetRecord({
      personId: "p1",
      role: "attachment",
      name: "documento.pdf",
      blob: new Blob([new Uint8Array([1, 2, 3])], {
        type: "application/pdf",
      }),
    });

    expect(() => validateMediaAssetRecord({ ...valid, size: 2 })).toThrowError(
      expect.objectContaining<Partial<MediaAssetValidationError>>({
        code: "INVALID_MEDIA_ASSET",
      }),
    );
  });
});
