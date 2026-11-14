import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaViews } from "@/hooks/useMediaLibrary";
import { createMediaAssetRecord } from "@/models/MediaAsset";

const asset = (id: string) => createMediaAssetRecord({
  id,
  personId: "p1",
  role: "attachment",
  name: `${id}.pdf`,
  blob: new Blob([id], { type: "application/pdf" }),
});

describe("useMediaViews", () => {
  beforeEach(() => {
    let index = 0;
    vi.stubGlobal("URL", Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => `blob:test-${++index}`),
      revokeObjectURL: vi.fn(),
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("loads only requested IDs and keeps URLs for unchanged records", async () => {
    const readAssets = vi.fn(async (ids: readonly string[]) => ids.map(asset));
    const { result, rerender, unmount } = renderHook(
      ({ ids }) => useMediaViews(ids, readAssets, 0),
      { initialProps: { ids: ["one", "two"] } },
    );
    await waitFor(() => expect(result.current.viewsById.size).toBe(2));
    const second = result.current.viewsById.get("two");
    expect(readAssets).toHaveBeenCalledTimes(1);
    expect(readAssets).toHaveBeenCalledWith(["one", "two"]);

    rerender({ ids: ["two", "three"] });
    await waitFor(() => expect(result.current.viewsById.has("three")).toBe(true));
    expect(readAssets).toHaveBeenLastCalledWith(["three"]);
    expect(result.current.viewsById.get("two")).toBe(second);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-1");
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3);
  });

  it("replaces URLs when an import reuses IDs with different content", async () => {
    const readAssets = vi.fn(async (ids: readonly string[]) => ids.map(asset));
    const ids = ["a"];
    const { result, rerender } = renderHook(
      ({ epoch }) => useMediaViews(ids, readAssets, epoch),
      { initialProps: { epoch: 0 } },
    );
    await waitFor(() => expect(result.current.viewsById.get("a")?.url).toBe("blob:test-1"));
    rerender({ epoch: 1 });
    await waitFor(() => expect(result.current.viewsById.get("a")?.url).toBe("blob:test-2"));
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-1");
  });

  it("waits for an attachment to be requested before reading it", async () => {
    const readAssets = vi.fn(async (ids: readonly string[]) => ids.map(asset));
    const { result, rerender } = renderHook(
      ({ ids }) => useMediaViews(ids, readAssets, 0),
      { initialProps: { ids: [] as string[] } },
    );
    expect(readAssets).not.toHaveBeenCalled();
    rerender({ ids: ["attachment"] });
    await waitFor(() => expect(result.current.viewsById.get("attachment")?.kind).toBe("pdf"));
    expect(readAssets).toHaveBeenCalledTimes(1);
    expect(readAssets).toHaveBeenCalledWith(["attachment"]);
  });
});
