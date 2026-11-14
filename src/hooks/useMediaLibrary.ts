"use client";

import { useEffect, useRef, useState } from "react";

import type { MediaAssetRecord, MediaAssetRole } from "@/models/MediaAsset";

export type MediaAssetKind = "image" | "audio" | "video" | "pdf" | "file";

export interface MediaAssetView {
  id: string;
  fileName: string;
  kind: MediaAssetKind;
  mimeType: string;
  role: MediaAssetRole;
  url: string;
}

function getMediaKind(mimeType: string): MediaAssetKind {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return mimeType === "application/pdf" ? "pdf" : "file";
}

const emptyViews: ReadonlyMap<string, MediaAssetView> = new Map();

export function useMediaViews(
  ids: readonly string[],
  readAssets: (ids: readonly string[]) => Promise<MediaAssetRecord[]>,
  epoch: number,
) {
  const views = useRef(new Map<string, MediaAssetView>());
  const previousEpoch = useRef(epoch);
  const [result, setResult] = useState({ epoch, views: emptyViews });
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const cache = views.current;
    const revoke = URL.revokeObjectURL?.bind(URL);
    return () => {
      for (const view of cache.values()) {
        revoke?.(view.url);
      }
      cache.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") {
      return;
    }
    const cache = views.current;
    const desired = new Set(ids);
    const reset = previousEpoch.current !== epoch;
    previousEpoch.current = epoch;
    let changed = reset;
    for (const [id, view] of cache) {
      if (reset || !desired.has(id)) {
        URL.revokeObjectURL?.(view.url);
        cache.delete(id);
        changed = true;
      }
    }
    if (changed) {
      setResult({ epoch, views: new Map(cache) });
    }
    const missing = [...desired].filter((id) => !cache.has(id));
    if (missing.length === 0) {
      setError(null);
      return;
    }
    let active = true;
    void readAssets(missing).then((assets) => {
      if (!active) {
        return;
      }
      for (const asset of assets) {
        cache.set(asset.id, {
          id: asset.id,
          fileName: asset.name,
          kind: getMediaKind(asset.mimeType),
          mimeType: asset.mimeType,
          role: asset.role,
          url: URL.createObjectURL(asset.blob),
        });
      }
      setError(null);
      setResult({ epoch, views: new Map(cache) });
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
    return () => { active = false; };
  }, [epoch, ids, readAssets]);

  return { viewsById: result.epoch === epoch ? result.views : emptyViews, error };
}
