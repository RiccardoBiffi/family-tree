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
    await user.click(screen.getByRole("button", { name: "Salva persona" }));

    await waitFor(() => {
      expect(window.localStorage.getItem("family-tree.snapshot.v1")).toContain("Giulia");
    });

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
});
