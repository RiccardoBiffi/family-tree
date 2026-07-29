import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const archiveMocks = vi.hoisted(() => ({
  importAlberoPackage: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  createAssetFromFile: vi.fn(),
  ensureDemoAssets: vi.fn(async () => []),
  refreshAssets: vi.fn(async () => []),
  replaceAssets: vi.fn(async () => undefined),
}));

vi.mock("@xyflow/react", async () => {
  return {
    ReactFlow: ({
      children,
      nodes = [],
      onNodeClick,
    }: {
      children?: React.ReactNode;
      nodes?: Array<{ id: string; data?: { label?: string } }>;
      onNodeClick?: (_event: unknown, node: { id: string }) => void;
    }) => (
      <div data-testid="react-flow">
        {nodes.map((node) => (
          <button
            key={node.id}
            onClick={() => onNodeClick?.({}, node)}
            type="button"
          >
            {node.data?.label ?? node.id}
          </button>
        ))}
        {children}
      </div>
    ),
    Background: () => <div data-testid="flow-background" />,
    Controls: () => <div data-testid="flow-controls" />,
    MiniMap: () => <div data-testid="flow-minimap" />,
    Handle: () => <div data-testid="flow-handle" />,
    MarkerType: {
      ArrowClosed: "arrow-closed",
    },
    Position: {
      Top: "top",
      Bottom: "bottom",
      Left: "left",
      Right: "right",
    },
  };
});

vi.mock("@/hooks/useMediaLibrary", () => ({
  useMediaLibrary: () => ({
    ...mediaMocks,
    error: null,
    isReady: true,
    viewsById: new Map([
      [
        "demo-p1-photo",
        {
          fileName: "giovanni-rinaldi.webp",
          id: "demo-p1-photo",
          kind: "image",
          mimeType: "image/webp",
          role: "photo",
          url: "blob:demo-p1-photo",
        },
      ],
      [
        "demo-p1-audio",
        {
          fileName: "cartolina-giovanni-rinaldi.wav",
          id: "demo-p1-audio",
          kind: "audio",
          mimeType: "audio/wav",
          role: "attachment",
          url: "blob:demo-p1-audio",
        },
      ],
    ]),
  }),
}));

vi.mock("@/utils/alberoPackage", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/utils/alberoPackage")>();

  return {
    ...actual,
    importAlberoPackage: archiveMocks.importAlberoPackage,
  };
});

import { FamilyTreeApp } from "@/components/FamilyTreeApp";
import { seedFamilyTree } from "@/data/seedFamilyTree";
import {
  FAMILY_TREE_STORAGE_KEY,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { parseMediaAssetReference } from "@/models/MediaAsset";
import {
  DEMO_MEDIA_MIGRATION_STORAGE_KEY,
} from "@/utils/demoMediaMigration";

function withoutDemoMedia(
  snapshot: FamilyTreeSnapshot,
): FamilyTreeSnapshot {
  return {
    ...snapshot,
    people: snapshot.people.map((person) => {
      const attachments =
        person.attachments?.filter(
          (attachment) => !parseMediaAssetReference(attachment),
        ) ?? [];

      return {
        ...person,
        photo: parseMediaAssetReference(person.photo)
          ? null
          : person.photo,
        attachments: attachments.length > 0 ? attachments : null,
      };
    }),
  };
}

function readStoredSnapshot(): FamilyTreeSnapshot {
  return JSON.parse(
    window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY) ?? "null",
  ) as FamilyTreeSnapshot;
}

function storedPerson(personId: string) {
  return readStoredSnapshot().people.find(
    (person) => person.id === personId,
  );
}

describe("FamilyTreeApp demo media migration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    archiveMocks.importAlberoPackage.mockReset();
    mediaMocks.createAssetFromFile.mockClear();
    mediaMocks.ensureDemoAssets.mockClear();
    mediaMocks.refreshAssets.mockClear();
    mediaMocks.replaceAssets.mockClear();
  });

  it("upgrades a legacy demo snapshot once without changing the snapshot schema", async () => {
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify(withoutDemoMedia(seedFamilyTree)),
    );

    render(<FamilyTreeApp mode="visitor" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          DEMO_MEDIA_MIGRATION_STORAGE_KEY,
        ),
      ).toBe("complete");
      expect(storedPerson("p1")?.photo).toBe("media:demo-p1-photo");
      expect(storedPerson("p1")?.attachments).toContain(
        "media:demo-p1-audio",
      );
    });

    const stored = readStoredSnapshot() as FamilyTreeSnapshot &
      Record<string, unknown>;
    expect(stored.version).toBe(1);
    expect(stored).not.toHaveProperty("migrations");
  });

  it("does not restore demo media after an admin removes it and reloads", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify(seedFamilyTree),
    );
    const { unmount } = render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          DEMO_MEDIA_MIGRATION_STORAGE_KEY,
        ),
      ).toBe("complete");
    });

    await user.click(screen.getByRole("button", { name: /Nanni/i }));
    const personDialog = await screen.findByRole("dialog", {
      name: /Giovanni Rinaldi/i,
    });
    await user.click(
      within(personDialog).getByRole("button", { name: "Modifica" }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Rimuovi foto esistente",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Rimuovi cartolina-giovanni-rinaldi.wav",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Salva modifiche" }),
    );

    await waitFor(() => {
      expect(storedPerson("p1")?.photo).toBeNull();
      expect(storedPerson("p1")?.attachments).not.toContain(
        "media:demo-p1-audio",
      );
    });

    unmount();
    render(<FamilyTreeApp mode="admin" />);
    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    await waitFor(() => {
      expect(storedPerson("p1")?.photo).toBeNull();
      expect(storedPerson("p1")?.attachments).not.toContain(
        "media:demo-p1-audio",
      );
    });
  });

  it("marks a successful import so missing demo media stay missing after reload", async () => {
    const user = userEvent.setup();
    const importedSnapshot = {
      ...withoutDemoMedia(seedFamilyTree),
      metadata: {
        ...seedFamilyTree.metadata,
        familyName: "Importata",
        title: "Archivio della famiglia Importata",
      },
    };
    archiveMocks.importAlberoPackage.mockResolvedValue({
      assets: [],
      exportedAt: "2026-07-29T12:00:00.000Z",
      snapshot: importedSnapshot,
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify(seedFamilyTree),
    );
    const { unmount } = render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        window.localStorage.getItem(
          DEMO_MEDIA_MIGRATION_STORAGE_KEY,
        ),
      ).toBe("complete");
    });
    window.localStorage.removeItem(DEMO_MEDIA_MIGRATION_STORAGE_KEY);

    await user.click(
      screen.getByRole("button", { name: "Gestisci archivio" }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Importa archivio" }),
    );
    await user.upload(
      screen.getByLabelText("Seleziona archivio da importare"),
      new File(["archive"], "famiglia.albero", {
        type: "application/vnd.family-tree.albero+gzip",
      }),
    );

    expect(
      await screen.findByRole("status", {
        name: "",
      }),
    ).toHaveTextContent("Archivio importato.");
    await waitFor(() => {
      expect(screen.getByText("Archivio Importata")).toBeInTheDocument();
      expect(
        window.localStorage.getItem(
          DEMO_MEDIA_MIGRATION_STORAGE_KEY,
        ),
      ).toBe("complete");
      expect(storedPerson("p1")?.photo).toBeNull();
      expect(storedPerson("p1")?.attachments).not.toContain(
        "media:demo-p1-audio",
      );
    });

    unmount();
    render(<FamilyTreeApp mode="admin" />);
    expect(
      await screen.findByText("Archivio Importata"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(storedPerson("p1")?.photo).toBeNull();
      expect(storedPerson("p1")?.attachments).not.toContain(
        "media:demo-p1-audio",
      );
    });
  });
});
