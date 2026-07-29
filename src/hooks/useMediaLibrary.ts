"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { demoMediaById } from "@/data/demoMedia";
import {
  createMediaAssetRecord,
  type MediaAssetRecord,
  type MediaAssetRole,
} from "@/models/MediaAsset";
import { MediaDB } from "@/utils/mediaDB";

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
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  return "file";
}

export function useMediaLibrary() {
  const dbRef = useRef<MediaDB | null>(null);
  const assetsRef = useRef<MediaAssetRecord[]>([]);
  const [assets, setAssets] = useState<MediaAssetRecord[]>([]);
  const [assetUrls, setAssetUrls] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  if (!dbRef.current) {
    dbRef.current = new MediaDB();
  }

  const updateAssets = useCallback(
    (nextAssets: readonly MediaAssetRecord[]) => {
      const copiedAssets = Array.from(nextAssets);
      assetsRef.current = copiedAssets;
      setAssets(copiedAssets);
    },
    [],
  );

  const refreshAssets = useCallback(async () => {
    if (!dbRef.current!.isAvailable()) {
      return assetsRef.current;
    }

    const nextAssets = await dbRef.current!.list();
    updateAssets(nextAssets);
    setError(null);
    setIsReady(true);
    return nextAssets;
  }, [updateAssets]);

  useEffect(() => {
    let cancelled = false;

    void dbRef.current!
      .list()
      .then((nextAssets) => {
        if (!cancelled) {
          updateAssets(nextAssets);
          setIsReady(true);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
          setIsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [updateAssets]);

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") {
      setAssetUrls(new Map());
      return;
    }

    const urls = new Map(
      assets.map((asset) => [asset.id, URL.createObjectURL(asset.blob)]),
    );
    setAssetUrls(urls);

    return () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [assets]);

  const viewsById = useMemo(() => {
    const views = new Map<string, MediaAssetView>();

    for (const asset of assets) {
      const url = assetUrls.get(asset.id);
      if (!url) {
        continue;
      }

      views.set(asset.id, {
        id: asset.id,
        fileName: asset.name,
        kind: getMediaKind(asset.mimeType),
        mimeType: asset.mimeType,
        role: asset.role,
        url,
      });
    }

    return views;
  }, [assets, assetUrls]);

  const replaceAssets = useCallback(
    async (nextAssets: readonly MediaAssetRecord[]) => {
      if (dbRef.current!.isAvailable()) {
        await dbRef.current!.replaceAll(nextAssets);
        setError(null);
      }
      updateAssets(nextAssets);
    },
    [updateAssets],
  );

  const ensureDemoAssets = useCallback(
    async (requiredAssetIds: readonly string[]) => {
      const currentAssets = dbRef.current!.isAvailable()
        ? await dbRef.current!.list()
        : assetsRef.current;
      const currentIds = new Set(currentAssets.map((asset) => asset.id));
      const missingDefinitions = Array.from(new Set(requiredAssetIds))
        .filter((assetId) => !currentIds.has(assetId))
        .map((assetId) => demoMediaById.get(assetId))
        .filter((definition) => definition !== undefined);

      if (missingDefinitions.length === 0) {
        updateAssets(currentAssets);
        return currentAssets;
      }

      const newAssets = await Promise.all(
        missingDefinitions.map(async (definition) => {
          const response = await fetch(definition.path);
          if (!response.ok) {
            throw new Error(
              `Impossibile caricare il media demo “${definition.name}”.`,
            );
          }

          const bytes = await response.arrayBuffer();
          return createMediaAssetRecord({
            id: definition.id,
            personId: definition.personId,
            role: definition.role,
            name: definition.name,
            blob: new Blob([bytes], { type: definition.mimeType }),
            createdAt: "2026-03-09T09:00:00.000Z",
            updatedAt: "2026-03-09T09:00:00.000Z",
          });
        }),
      );
      const nextAssets = [...currentAssets, ...newAssets];

      if (dbRef.current!.isAvailable()) {
        await dbRef.current!.replaceAll(nextAssets);
        setError(null);
      }
      updateAssets(nextAssets);
      return nextAssets;
    },
    [updateAssets],
  );

  const createAssetFromFile = useCallback(
    (personId: string, role: MediaAssetRole, file: File) =>
      createMediaAssetRecord({
        personId,
        role,
        name: file.name,
        blob: file,
      }),
    [],
  );

  return {
    assets,
    viewsById,
    isReady,
    error,
    refreshAssets,
    replaceAssets,
    ensureDemoAssets,
    createAssetFromFile,
  };
}
