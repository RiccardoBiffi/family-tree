"use client";
/* eslint-disable @next/next/no-img-element */

import type { MediaAssetView } from "@/hooks/useMediaLibrary";

export function PersonMediaGallery({
  media,
}: {
  media: readonly MediaAssetView[];
}) {
  if (media.length === 0) {
    return null;
  }

  return (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {media.map((asset) => (
        <li
          className="overflow-hidden rounded-2xl border border-[#dfe5df] bg-[#f8faf7] p-3"
          key={asset.id}
        >
          {asset.kind === "image" ? (
            <a
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
              href={asset.url}
              rel="noreferrer"
              target="_blank"
            >
              <img
                alt={asset.fileName}
                className="aspect-[4/3] w-full rounded-xl object-cover"
                src={asset.url}
              />
            </a>
          ) : null}
          {asset.kind === "audio" ? (
            <audio
              aria-label={asset.fileName}
              className="min-h-11 w-full"
              controls
              preload="metadata"
              src={asset.url}
            />
          ) : null}
          {asset.kind === "video" ? (
            <video
              aria-label={asset.fileName}
              className="aspect-video w-full rounded-xl bg-black"
              controls
              preload="metadata"
              src={asset.url}
            />
          ) : null}
          <a
            className="mt-2 flex min-h-11 items-center break-all text-sm font-semibold text-[#17351f] underline decoration-[#a9b8aa] underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
            download={asset.fileName}
            href={asset.url}
          >
            {asset.fileName}
          </a>
        </li>
      ))}
    </ul>
  );
}
