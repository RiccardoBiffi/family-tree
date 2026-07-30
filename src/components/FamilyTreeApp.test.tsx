import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { FamilyTreeApp } from "@/components/FamilyTreeApp";
import { seedFamilyTree } from "@/data/seedFamilyTree";
import { FAMILY_TREE_STORAGE_KEY } from "@/models/FamilyTree";

describe("FamilyTreeApp", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([0]), { status: 200 })),
    );
    window.localStorage.clear();
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify(seedFamilyTree),
    );
  });

  it("onboards a browser without a snapshot and preserves the family name after reload", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const { unmount } = render(<FamilyTreeApp mode="admin" />);

    expect(
      await screen.findByRole("heading", {
        name: "Crea il tuo archivio di famiglia",
      }),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY)).toBeNull();

    await user.type(screen.getByLabelText("Nome della famiglia"), "Bianchi");
    await user.click(screen.getByRole("button", { name: "Crea l'archivio" }));

    expect(await screen.findByText("Archivio Bianchi")).toBeInTheDocument();

    const storedSnapshot = JSON.parse(
      window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY) ?? "null",
    );
    expect(storedSnapshot.metadata.familyName).toBe("Bianchi");
    expect(storedSnapshot.metadata.title).toBe("Archivio della famiglia Bianchi");
    expect(storedSnapshot.people).toEqual([]);

    unmount();
    render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByText("Archivio Bianchi")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Crea il tuo archivio di famiglia",
      }),
    ).not.toBeInTheDocument();
  });

  it("treats a stored archive with no people as initialized", async () => {
    window.localStorage.setItem(
      FAMILY_TREE_STORAGE_KEY,
      JSON.stringify({
        ...seedFamilyTree,
        metadata: {
          ...seedFamilyTree.metadata,
          title: "Archivio della famiglia Verdi",
          familyName: "Verdi",
        },
        people: [],
      }),
    );

    render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByText("Archivio Verdi")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Crea il tuo archivio di famiglia",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders the seeded archive, opens person details, and switches views", async () => {
    const user = userEvent.setup();
    const currentYear = new Date().getUTCFullYear();

    render(<FamilyTreeApp mode="visitor" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Diagramma" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /Nanni/i }));
    const personDialog = await screen.findByRole("dialog", { name: /Giovanni Rinaldi/i });
    expect(personDialog).toBeInTheDocument();
    expect(within(personDialog).getByText(/Scheda persona/i)).toBeInTheDocument();
    expect(
      within(personDialog).queryByRole("button", { name: /Chiudi/i }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "Tabella" }));
    expect(
      await screen.findByRole("region", { name: "Tabella delle persone" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tabella" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "Timeline" }));
    expect(
      await screen.findByText(/Cronologia di nascite e decessi/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Intervallo 1943 - ${currentYear}`)),
    ).toBeInTheDocument();
  });

  it("allows admin mode to add a person and reveal hidden table columns", async () => {
    const user = userEvent.setup();

    render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nuova persona" }));

    await user.type(screen.getByLabelText("Nome"), "Giulia");
    await user.type(screen.getByLabelText("Cognome"), "Verdi");
    await user.type(screen.getByLabelText("Luogo di nascita"), "Milano");
    await user.click(screen.getByRole("button", { name: "Genitori" }));
    await user.type(screen.getByLabelText("Cerca genitori"), "Nanni");
    await user.click(screen.getByRole("checkbox", { name: /Nanni/i }));
    await user.click(screen.getByRole("button", { name: "Crea persona" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY)).toContain("Giulia");
    });

    const personDialog = await screen.findByRole("dialog");
    expect(within(personDialog).getByText(/Giulia Verdi/i)).toBeInTheDocument();
    expect(within(personDialog).getByText(/Nanni/i)).toBeInTheDocument();

    expect(
      within(personDialog).queryByRole("button", { name: /Chiudi/i }),
    ).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await user.type(screen.getByLabelText("Cerca una persona"), "Giulia");
    await user.click(screen.getByRole("tab", { name: "Tabella" }));

    const tableSection = await screen.findByRole("region", {
      name: "Tabella delle persone",
    });
    expect(within(tableSection).getByText(/Giulia Verdi/i)).toBeInTheDocument();
    expect(within(tableSection).getAllByText("Milano").length).toBeGreaterThan(0);

    await user.click(within(tableSection).getByText("Colonne"));
    const deathDateToggle = within(tableSection).getByRole("checkbox", {
      name: "Decesso",
    });
    expect(deathDateToggle).not.toBeChecked();
    await user.click(deathDateToggle);

    expect(
      await within(tableSection).findByRole("columnheader", {
        name: /Decesso/i,
      }),
    ).toBeInTheDocument();
  });

  it("opens the editor from the person card with the current values pre-filled", async () => {
    const user = userEvent.setup();

    render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nanni/i }));

    const personDialog = await screen.findByRole("dialog");
    expect(within(personDialog).getByText(/Scheda persona/i)).toBeInTheDocument();

    await user.click(within(personDialog).getByRole("button", { name: "Modifica" }));

    expect(await screen.findByRole("button", { name: "Salva modifiche" })).toBeInTheDocument();

    const professionInput = screen.getByLabelText("Professione");
    expect(professionInput).toHaveValue("Falegname");

    await user.clear(professionInput);
    await user.type(professionInput, "Restauratore");
    await user.click(screen.getByRole("button", { name: "Salva modifiche" }));

    await waitFor(() => {
      expect(window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY)).toContain("Restauratore");
    });

    const updatedDialog = await screen.findByRole("dialog");
    expect(within(updatedDialog).getByText(/Restauratore/i)).toBeInTheDocument();
  });

  it("requires confirmation before deleting a person and leaves data untouched on cancel", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    confirm.mockReturnValueOnce(false);

    render(<FamilyTreeApp mode="admin" />);
    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nanni/i }));
    const personDialog = await screen.findByRole("dialog", {
      name: /Giovanni Rinaldi/i,
    });
    await user.click(
      within(personDialog).getByRole("button", { name: "Modifica" }),
    );

    const editor = await screen.findByRole("dialog", {
      name: /Modifica Nanni/i,
    });
    expect(
      within(editor).queryByRole("button", { name: /Chiudi/i }),
    ).not.toBeInTheDocument();

    await user.click(
      within(editor).getByRole("button", { name: "Elimina" }),
    );
    expect(confirm).toHaveBeenCalledWith(
      "Eliminare “Nanni (Giovanni Rinaldi)”? La persona e tutti i suoi contenuti multimediali saranno eliminati definitivamente.",
    );
    expect(screen.getByRole("dialog", {
      name: /Modifica Nanni/i,
    })).toBeInTheDocument();
    expect(
      JSON.parse(
        window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY) ?? "null",
      ).people.some((person: { id: string }) => person.id === "p1"),
    ).toBe(true);

    confirm.mockReturnValueOnce(true);
    await user.click(screen.getByRole("button", { name: "Elimina" }));
    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY) ?? "null",
      );
      expect(stored.people.some((person: { id: string }) => person.id === "p1")).toBe(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    confirm.mockRestore();
  });

  it("keeps access mode out of the visible UI while preserving admin actions", async () => {
    const { unmount } = render(<FamilyTreeApp mode="visitor" />);

    expect(await screen.findByText("Archivio Rinaldi")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gestisci archivio" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nuova persona" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/sola lettura|visitatore|amministrazione/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText("Archiviazione temporanea"),
    ).not.toBeInTheDocument();

    unmount();
    render(<FamilyTreeApp mode="admin" />);

    expect(await screen.findByRole("button", { name: "Nuova persona" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gestisci archivio" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText("Archiviazione temporanea"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/esporta subito un file \.albero/u),
    ).toBeInTheDocument();
    expect(screen.queryByText(/visitatore|modalità admin|amministrazione/i)).not.toBeInTheDocument();
  });
});
