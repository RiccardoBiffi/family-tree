import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const archiveMocks = vi.hoisted(() => ({
  importAlberoPackage: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  createAssetFromFile: vi.fn(),
  refreshAssets: vi.fn(async (): Promise<MediaAssetRecord[]> => []),
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
        "user-p1-photo",
        {
          fileName: "ritratto-giovanni.webp",
          id: "user-p1-photo",
          kind: "image",
          mimeType: "image/webp",
          role: "photo",
          url: "blob:user-p1-photo",
        },
      ],
      [
        "user-p1-audio",
        {
          fileName: "intervista-giovanni.wav",
          id: "user-p1-audio",
          kind: "audio",
          mimeType: "audio/wav",
          role: "attachment",
          url: "blob:user-p1-audio",
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
import {
  type MediaAssetRecord,
  type MediaAssetRole,
} from "@/models/MediaAsset";

function withUserMedia(
  snapshot: FamilyTreeSnapshot,
): FamilyTreeSnapshot {
  return {
    ...snapshot,
    people: snapshot.people.map((person, index) =>
      index === 0
        ? {
            ...person,
            photo: "media:user-p1-photo",
            attachments: ["media:user-p1-audio"],
          }
        : person,
    ),
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

function createTestAsset({
  id,
  personId,
  role,
  name,
  mimeType,
}: {
  id: string;
  personId: string;
  role: MediaAssetRole;
  name: string;
  mimeType: string;
}): MediaAssetRecord {
  const blob = new Blob(["test asset"], { type: mimeType });

  return {
    version: 1,
    id,
    personId,
    role,
    name,
    mimeType,
    size: blob.size,
    blob,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
}

describe("FamilyTreeApp user media", () => {
  beforeEach(() => {
    window.localStorage.clear();
    archiveMocks.importAlberoPackage.mockReset();
    mediaMocks.createAssetFromFile.mockReset();
    mediaMocks.refreshAssets.mockReset();
    mediaMocks.refreshAssets.mockResolvedValue([]);
    mediaMocks.replaceAssets.mockReset();
    mediaMocks.replaceAssets.mockResolvedValue(undefined);
  });

  it("removes an existing multimedia item and adds a local PDF in the same atomic save", async () => {
    const user = userEvent.setup();
    const photoAsset = createTestAsset({
      id: "user-p1-photo",
      personId: "p1",
      role: "photo",
      name: "ritratto-giovanni.webp",
      mimeType: "image/webp",
    });
    const audioAsset = createTestAsset({
      id: "user-p1-audio",
      personId: "p1",
      role: "attachment",
      name: "intervista-giovanni.wav",
      mimeType: "audio/wav",
    });
    const pdfAsset = createTestAsset({
      id: "p1-documento",
      personId: "p1",
      role: "attachment",
      name: "documento-rinaldi.pdf",
      mimeType: "application/pdf",
    });
    const pdfFile = new File(["pdf"], "documento-rinaldi.pdf", {
      type: "application/pdf",
    });
    mediaMocks.refreshAssets.mockResolvedValue([
      photoAsset,
      audioAsset,
    ]);
    mediaMocks.createAssetFromFile.mockReturnValue(pdfAsset);
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify(withUserMedia(seedFamilyTree)),
    );

    render(<FamilyTreeApp mode="admin" />);
    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Nanni/i }));
    const personDialog = await screen.findByRole("dialog", {
      name: /Giovanni Rinaldi/i,
    });
    await user.click(
      within(personDialog).getByRole("button", { name: "Modifica" }),
    );

    await user.click(
      await screen.findByRole("button", {
        name: "Rimuovi intervista-giovanni.wav",
      }),
    );
    await user.upload(
      screen.getByLabelText("Aggiungi contenuti multimediali"),
      pdfFile,
    );
    await user.click(
      screen.getByRole("button", { name: "Salva modifiche" }),
    );

    await waitFor(() => {
      expect(storedPerson("p1")?.attachments).toEqual([
        "media:p1-documento",
      ]);
    });
    expect(mediaMocks.createAssetFromFile).toHaveBeenCalledWith(
      "p1",
      "attachment",
      pdfFile,
    );
    expect(mediaMocks.replaceAssets).toHaveBeenLastCalledWith([
      photoAsset,
      pdfAsset,
    ]);
  });

  it("persists local multimedia while creating a person", async () => {
    const user = userEvent.setup();
    const audioFile = new File(["audio"], "intervista.mp3", {
      type: "audio/mpeg",
    });
    let createdAsset: MediaAssetRecord | null = null;
    mediaMocks.createAssetFromFile.mockImplementation(
      (personId: string) => {
        createdAsset = createTestAsset({
          id: "nuova-intervista",
          personId,
          role: "attachment",
          name: audioFile.name,
          mimeType: audioFile.type,
        });
        return createdAsset;
      },
    );
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify(seedFamilyTree),
    );

    render(<FamilyTreeApp mode="admin" />);
    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nuova persona" }));
    await user.type(screen.getByLabelText("Nome"), "Livia");
    await user.type(screen.getByLabelText("Cognome"), "Rinaldi");
    await user.upload(
      screen.getByLabelText("Aggiungi contenuti multimediali"),
      audioFile,
    );
    await user.click(screen.getByRole("button", { name: "Crea persona" }));

    await waitFor(() => {
      const person = readStoredSnapshot().people.find(
        (candidate) => candidate.name === "Livia",
      );
      expect(person?.attachments).toEqual(["media:nuova-intervista"]);
      expect(createdAsset?.personId).toBe(person?.id);
    });
    expect(mediaMocks.replaceAssets).toHaveBeenLastCalledWith([
      createdAsset,
    ]);
  });

  it("imports a media-free archive without inventing multimedia", async () => {
    const user = userEvent.setup();
    const importedSnapshot = {
      ...seedFamilyTree,
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
      expect(storedPerson("p1")?.photo).toBeNull();
      expect(storedPerson("p1")?.attachments).toBeNull();
    });
    expect(mediaMocks.replaceAssets).toHaveBeenCalledWith([]);

    unmount();
    render(<FamilyTreeApp mode="admin" />);
    expect(
      await screen.findByText("Archivio Importata"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(storedPerson("p1")?.photo).toBeNull();
      expect(storedPerson("p1")?.attachments).toBeNull();
    });
  });
});
