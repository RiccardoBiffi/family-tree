import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi } from "vitest";

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
import { FAMILY_TREE_STORAGE_KEY } from "@/models/FamilyTree";

describe("FamilyTreeApp", () => {
  it("renders the seeded archive, opens person details, and switches views", async () => {
    const user = userEvent.setup();

    render(<FamilyTreeApp />);

    expect(await screen.findByText("Archivio della famiglia Rinaldi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Nanni/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Scheda persona/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chiudi" }));

    await user.click(screen.getByRole("button", { name: /^Tabella/i }));
    expect(await screen.findByText(/Elenco ordinabile e filtrabile/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Timeline/i }));
    expect(await screen.findByText(/Cronologia con panning e zoom/i)).toBeInTheDocument();
  });

  it("allows admin mode to add a person and reveal hidden table columns", async () => {
    const user = userEvent.setup();

    render(<FamilyTreeApp />);

    expect(await screen.findByText("Archivio della famiglia Rinaldi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Amministratore" }));
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

    await user.click(screen.getByRole("button", { name: "Chiudi" }));
    await user.type(screen.getByLabelText("Ricerca trasversale"), "Giulia");
    await user.click(screen.getByRole("button", { name: /^Tabella/i }));

    const tableTitle = await screen.findByText(/Elenco ordinabile e filtrabile/i);
    const tableSection = tableTitle.closest("section");

    expect(tableSection).not.toBeNull();
    expect(within(tableSection as HTMLElement).getByText(/Giulia Verdi/i)).toBeInTheDocument();

    const birthPlaceToggle = within(tableSection as HTMLElement).getByRole("checkbox", {
      name: "Luogo di nascita",
    });
    await user.click(birthPlaceToggle);

    expect(
      await within(tableSection as HTMLElement).findByRole("columnheader", {
        name: /Luogo di nascita/i,
      }),
    ).toBeInTheDocument();
    expect(within(tableSection as HTMLElement).getAllByText("Milano").length).toBeGreaterThan(0);
  });

  it("opens the editor from the person card with the current values pre-filled", async () => {
    const user = userEvent.setup();

    render(<FamilyTreeApp />);

    expect(await screen.findByText("Archivio della famiglia Rinaldi")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Amministratore" }));
    const adminPanel = screen.getByText(/Apri una scheda/i).closest("section");

    expect(adminPanel).not.toBeNull();
    await user.click(
      within(adminPanel as HTMLElement).getByRole("button", { name: /Nanni/i }),
    );

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
});
