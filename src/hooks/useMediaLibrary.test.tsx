import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMediaAssetRecord } from "@/models/MediaAsset";

const mediaDBMocks = vi.hoisted(() => ({
  available: true,
  list: vi.fn(),
  replaceAll: vi.fn(),
}));

vi.mock("@/utils/mediaDB", () => ({
  MediaDB: class {
    isAvailable() {
      return mediaDBMocks.available;
    }

    list() {
      return mediaDBMocks.list();
    }

    replaceAll(assets: unknown[]) {
      return mediaDBMocks.replaceAll(assets);
    }
  },
}));

import { useMediaLibrary } from "@/hooks/useMediaLibrary";

function createTestAsset() {
  return createMediaAssetRecord({
    id: "session-asset",
    personId: "p1",
    role: "attachment",
    name: "ricordo.pdf",
    blob: new Blob(["archivio"], { type: "application/pdf" }),
    createdAt: "2026-07-30T08:00:00.000Z",
    updatedAt: "2026-07-30T08:00:00.000Z",
  });
}

function namedError(name: string) {
  const error = new Error(name);
  error.name = name;
  return error;
}

describe("useMediaLibrary persistence resilience", () => {
  beforeEach(() => {
    mediaDBMocks.available = true;
    mediaDBMocks.list.mockReset().mockResolvedValue([]);
    mediaDBMocks.replaceAll.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("starts from IndexedDB without requesting bundled media", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useMediaLibrary());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.assets).toEqual([]);
    expect(mediaDBMocks.list).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores user-provided WebP and WAV files in IndexedDB", async () => {
    const { result } = renderHook(() => useMediaLibrary());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const photoFile = new File(["webp"], "ritratto.webp", {
      type: "image/webp",
    });
    const audioFile = new File(["wav"], "intervista.wav", {
      type: "audio/wav",
    });
    const assets = [
      result.current.createAssetFromFile("p1", "photo", photoFile),
      result.current.createAssetFromFile("p1", "attachment", audioFile),
    ];

    await act(async () => {
      await result.current.replaceAssets(assets);
    });

    expect(mediaDBMocks.replaceAll).toHaveBeenCalledWith(assets);
    expect(result.current.assets).toEqual(assets);
  });

  it("keeps media usable in memory when IndexedDB cannot open", async () => {
    mediaDBMocks.list.mockRejectedValueOnce(
      namedError("MediaDBUnavailableError"),
    );
    const { result } = renderHook(() => useMediaLibrary());

    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.persistenceStatus).toBe("volatile");
    expect(result.current.error).toBeNull();

    const asset = createTestAsset();
    await act(async () => {
      await result.current.replaceAssets([asset]);
    });

    expect(result.current.assets).toEqual([asset]);
    let refreshed = [asset];
    await act(async () => {
      refreshed = await result.current.refreshAssets();
    });
    expect(refreshed).toEqual([asset]);
    expect(mediaDBMocks.replaceAll).not.toHaveBeenCalled();
  });

  it("falls back to memory when durable storage is exhausted", async () => {
    const { result } = renderHook(() => useMediaLibrary());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    mediaDBMocks.replaceAll.mockRejectedValueOnce(
      namedError("QuotaExceededError"),
    );
    const asset = createTestAsset();
    await act(async () => {
      await result.current.replaceAssets([asset]);
    });

    expect(result.current.persistenceStatus).toBe("volatile");
    expect(result.current.assets).toEqual([asset]);
  });

  it("propagates unexpected write failures without mutating memory", async () => {
    const { result } = renderHook(() => useMediaLibrary());
    await waitFor(() => expect(result.current.isReady).toBe(true));

    const failure = namedError("UnknownError");
    mediaDBMocks.replaceAll.mockRejectedValueOnce(failure);
    const asset = createTestAsset();

    await expect(
      act(async () => {
        await result.current.replaceAssets([asset]);
      }),
    ).rejects.toBe(failure);
    expect(result.current.persistenceStatus).toBe("durable");
    expect(result.current.assets).toEqual([]);
  });
});
