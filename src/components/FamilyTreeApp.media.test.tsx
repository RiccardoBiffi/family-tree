import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const archiveMocks = vi.hoisted(() => ({
  importAlberoPackage: vi.fn(),
}));

vi.mock("@xyflow/react", async () => {
  return {
    ReactFlow: ({
      children,
      nodes = [],
      onNodeClick,
    }: {
      children?: React.ReactNode;
      nodes?: Array<{ id: string; type?: string; data?: { label?: string } }>;
      onNodeClick?: (_event: unknown, node: { id: string }) => void;
    }) => (
      <div data-testid="react-flow">
        {nodes.filter(({ type }) => type === "familyTree").map((node) => (
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
    ControlButton: () => null,
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
import { mockArchiveDB } from "@/test/mockArchiveDB";

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
  let database: ReturnType<typeof mockArchiveDB>;
  beforeEach(() => {
    database = mockArchiveDB();
    archiveMocks.importAlberoPackage.mockReset();
    vi.stubGlobal("URL", Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
    const pdfFile = new File(["pdf"], "documento-rinaldi.pdf", {
      type: "application/pdf",
    });
    database.assets.set(photoAsset.id, photoAsset);
    database.assets.set(audioAsset.id, audioAsset);
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


    const details = await screen.findByRole("dialog", { name: /Giovanni Rinaldi/i });
    expect(await within(details).findByText(pdfFile.name)).toBeInTheDocument();
    const stored = database.snapshot?.people.find(({ id }) => id === "p1");
    const pdf = [...database.assets.values()].find(({ name }) => name === pdfFile.name);
    expect(pdf?.blob).toBe(pdfFile);
    expect(stored?.attachments).toEqual([`media:${pdf?.id}`]);
    expect(database.commit.mock.lastCall?.[2]).toEqual({ put: [pdf], remove: [audioAsset.id] });
    expect(database.assets.get(photoAsset.id)).toBe(photoAsset);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(3);
  });

  it("persists local multimedia while creating a person", async () => {
    const user = userEvent.setup();
    const audioFile = new File(["audio"], "intervista.mp3", {
      type: "audio/mpeg",
    });
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


    const details = await screen.findByRole("dialog", { name: "Livia Rinaldi" });
    expect(await within(details).findByText(audioFile.name)).toBeInTheDocument();
    const person = database.snapshot?.people.find(({ name }) => name === "Livia");
    const [storedAsset] = database.assets.values();
    expect(person?.attachments).toEqual([`media:${storedAsset.id}`]);
    expect(storedAsset.personId).toBe(person?.id);
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

    expect(await screen.findByText("Archivio importato.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Archivio Importata")).toBeInTheDocument();
      expect(database.snapshot?.people.find(({ id }) => id === "p1")?.photo).toBeNull();
      expect(database.snapshot?.people.find(({ id }) => id === "p1")?.attachments).toBeNull();
    });
    expect(database.commit.mock.lastCall?.[2]).toEqual({ replace: [] });

    unmount();
    render(<FamilyTreeApp mode="admin" />);
    expect(
      await screen.findByText("Archivio Importata"),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(database.snapshot?.people.find(({ id }) => id === "p1")?.photo).toBeNull();
      expect(database.snapshot?.people.find(({ id }) => id === "p1")?.attachments).toBeNull();
    });
  });

  it("keeps first setup open for an invalid import, then restores a backup directly", async () => {
    const user = userEvent.setup();
    const file = new File(["archive"], "famiglia.albero", {
      type: "application/vnd.family-tree.albero+gzip",
    });
    const snapshot = {
      ...seedFamilyTree,
      metadata: { ...seedFamilyTree.metadata, familyName: "Importata" },
      people: [],
    };
    archiveMocks.importAlberoPackage
      .mockRejectedValueOnce(new Error("Invalid archive"))
      .mockResolvedValue({ assets: [], snapshot });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { unmount } = render(<FamilyTreeApp mode="visitor" />);

    await screen.findByRole("button", { name: "Importa archivio .albero" });
    const input = screen.getByLabelText("Seleziona archivio da importare");
    await user.upload(input, file);
    expect(await screen.findByText("Importazione non riuscita. Controlla il file.")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(database.commit).not.toHaveBeenCalled();

    await user.upload(input, file);
    expect(await screen.findByRole("heading", { name: "Archivio Importata" })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(database.commit).toHaveBeenCalledTimes(1);
    expect(database.snapshot?.people).toEqual([]);
    expect(window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY)).toBeNull();
    unmount();
    render(<FamilyTreeApp mode="admin" />);
    expect(await screen.findByRole("heading", { name: "Archivio Importata" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Importa archivio .albero" })).not.toBeInTheDocument();
  });
});
