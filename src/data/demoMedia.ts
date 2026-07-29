import type { MediaAssetRole } from "@/models/MediaAsset";

export interface DemoMediaDefinition {
  id: string;
  personId: string;
  role: MediaAssetRole;
  name: string;
  mimeType: string;
  path: string;
}

const demoPeople = [
  ["p1", "giovanni-rinaldi", "Giovanni Rinaldi"],
  ["p2", "anna-conti", "Anna Conti"],
  ["p3", "marco-rinaldi", "Marco Rinaldi"],
  ["p4", "lucia-rinaldi", "Lucia Rinaldi"],
  ["p5", "elena-moretti", "Elena Moretti"],
  ["p6", "paolo-greco", "Paolo Greco"],
  ["p7", "sofia-rinaldi", "Sofia Rinaldi"],
  ["p8", "pietro-rinaldi", "Pietro Rinaldi"],
  ["p9", "teresa-greco", "Teresa Greco"],
  ["p10", "matteo-rinaldi", "Matteo Rinaldi"],
] as const;

export const demoMediaDefinitions: readonly DemoMediaDefinition[] = demoPeople.flatMap(
  ([personId, slug, displayName]) => [
    {
      id: `demo-${personId}-photo`,
      personId,
      role: "photo",
      name: `Ritratto di ${displayName}.webp`,
      mimeType: "image/webp",
      path: `/demo-media/portraits/${slug}.webp`,
    },
    {
      id: `demo-${personId}-audio`,
      personId,
      role: "attachment",
      name: `Cartolina sonora di ${displayName}.wav`,
      mimeType: "audio/wav",
      path: `/demo-media/audio/cartolina-${slug}.wav`,
    },
  ],
);

export const demoMediaById = new Map(
  demoMediaDefinitions.map((definition) => [definition.id, definition]),
);
