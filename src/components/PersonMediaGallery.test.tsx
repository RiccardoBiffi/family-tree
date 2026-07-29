import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PersonMediaGallery } from "@/components/PersonMediaGallery";
import type { MediaAssetView } from "@/hooks/useMediaLibrary";

const media: MediaAssetView[] = [
  {
    id: "image",
    fileName: "ritratto.webp",
    kind: "image",
    mimeType: "image/webp",
    role: "attachment",
    url: "blob:image",
  },
  {
    id: "audio",
    fileName: "voce.wav",
    kind: "audio",
    mimeType: "audio/wav",
    role: "attachment",
    url: "blob:audio",
  },
  {
    id: "video",
    fileName: "filmato.mp4",
    kind: "video",
    mimeType: "video/mp4",
    role: "attachment",
    url: "blob:video",
  },
  {
    id: "pdf",
    fileName: "documento.pdf",
    kind: "pdf",
    mimeType: "application/pdf",
    role: "attachment",
    url: "blob:pdf",
  },
];

describe("PersonMediaGallery", () => {
  it("renders local media with native playback and download controls", () => {
    const { container } = render(<PersonMediaGallery media={media} />);

    expect(screen.getByRole("img", { name: "ritratto.webp" })).toHaveAttribute(
      "src",
      "blob:image",
    );
    expect(
      container.querySelector("audio[controls][src='blob:audio']"),
    ).toBeInTheDocument();
    expect(
      container.querySelector("video[controls][src='blob:video']"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "documento.pdf" }),
    ).toHaveAttribute("download", "documento.pdf");
  });
});
