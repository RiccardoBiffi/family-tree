import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PeopleTable } from "@/components/PeopleTable";
import { seedFamilyTree } from "@/data/seedFamilyTree";

const savedColumnsKey = "family-tree.table-columns.v1";

function getHeaderLabels() {
  return screen
    .getAllByRole("columnheader")
    .map((header) => header.textContent?.trim() ?? "");
}

function expectAdjacent(labels: string[], first: string, second: string) {
  expect(labels.indexOf(first)).toBeGreaterThanOrEqual(0);
  expect(labels.indexOf(second)).toBe(labels.indexOf(first) + 1);
}

describe("PeopleTable column chooser", () => {
  it("starts with Genitori hidden after Figli and applies accessible reordering immediately", async () => {
    const user = userEvent.setup();

    render(
      <PeopleTable
        onSelectPerson={vi.fn()}
        people={seedFamilyTree.people}
        query=""
      />,
    );

    expect(
      screen.queryByRole("columnheader", { name: /Genitori/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Colonne" }));
    const chooser = screen.getByRole("dialog", { name: "Gestisci colonne" });
    const chooserLabels = within(chooser)
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.closest("label")?.textContent?.trim() ?? "");

    expectAdjacent(chooserLabels, "Figli", "Genitori");
    chooserLabels.forEach((label) => {
      const moveUp = within(chooser).getByRole("button", {
        name: `Sposta ${label} su`,
      });
      const moveDown = within(chooser).getByRole("button", {
        name: `Sposta ${label} giù`,
      });

      expect(moveUp).toHaveClass("min-h-11", "min-w-11");
      expect(moveDown).toHaveClass("min-h-11", "min-w-11");
    });

    await user.click(
      within(chooser).getByRole("checkbox", { name: "Genitori" }),
    );
    expectAdjacent(getHeaderLabels(), "Figli", "Genitori");

    await user.click(
      within(chooser).getByRole("button", { name: "Sposta Genitori su" }),
    );
    expectAdjacent(getHeaderLabels(), "Genitori", "Figli");

    const reorderedChooserLabels = within(chooser)
      .getAllByRole("checkbox")
      .map((checkbox) => checkbox.closest("label")?.textContent?.trim() ?? "");
    expectAdjacent(reorderedChooserLabels, "Genitori", "Figli");
  });

  it("closes on Escape and outside pointer interaction", async () => {
    const user = userEvent.setup();

    render(
      <PeopleTable
        onSelectPerson={vi.fn()}
        people={seedFamilyTree.people}
        query=""
      />,
    );

    const trigger = screen.getByRole("button", { name: "Colonne" });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("dialog", { name: "Gestisci colonne" }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("dialog", { name: "Gestisci colonne" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByText("10 persone"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("dialog", { name: "Gestisci colonne" }),
    ).not.toBeInTheDocument();
  });

  it("restores column visibility and order after the table is remounted", async () => {
    const user = userEvent.setup();
    const table = <PeopleTable onSelectPerson={vi.fn()} people={seedFamilyTree.people} query="" />;
    const { unmount } = render(table);
    await user.click(screen.getByRole("button", { name: "Colonne" }));
    const chooser = within(screen.getByRole("dialog", { name: "Gestisci colonne" }));
    await user.click(chooser.getByRole("checkbox", { name: "Genitori" }));
    await user.click(chooser.getByRole("button", { name: "Sposta Genitori su" }));
    await user.click(chooser.getByRole("checkbox", { name: "Professione" }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Persona" }));

    unmount();
    render(table);

    expectAdjacent(getHeaderLabels(), "Genitori", "Figli");
    expect(screen.queryByRole("columnheader", { name: "Professione" })).not.toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Nascita" })).toHaveAttribute("aria-sort", "ascending");
  });

  it("ignores invalid preference values and keeps Persona visible", () => {
    localStorage.setItem(savedColumnsKey, JSON.stringify({
      order: ["parentsCount", "parentsCount", "not-a-column", 42],
      visibility: { displayName: false, notes: "visible", parentsCount: true },
    }));
    render(<PeopleTable onSelectPerson={vi.fn()} people={seedFamilyTree.people} query="" />);

    expect(getHeaderLabels().slice(0, 3)).toEqual(["Genitori", "Persona", "Nascita"]);
    expect(screen.queryByRole("columnheader", { name: "Note" })).not.toBeInTheDocument();
  });

  it("still updates columns when local storage refuses reads and writes", async () => {
    const user = userEvent.setup();
    const denied = () => { throw new DOMException("Storage denied", "SecurityError"); };
    const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
    try {
      render(<PeopleTable onSelectPerson={vi.fn()} people={seedFamilyTree.people} query="" />);
      expect(screen.queryByRole("columnheader", { name: "Genitori" })).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Colonne" }));
      await user.click(screen.getByRole("checkbox", { name: "Genitori" }));
      expect(screen.getByRole("columnheader", { name: "Genitori" })).toBeInTheDocument();
    } finally {
      read.mockRestore();
      write.mockRestore();
    }
  });
});

describe("PeopleTable scrolling", () => {
  it("keeps a small DOM window and can focus, open and filter a person outside it", async () => {
    const user = userEvent.setup();
    const onSelectPerson = vi.fn();
    const people = Array.from({ length: 3000 }, (_, index) => ({
      ...seedFamilyTree.people[0],
      id: `table-person-${index}`,
      name: `Persona ${index.toString().padStart(4, "0")}`,
      surname: null,
    }));
    const { rerender } = render(
      <PeopleTable onSelectPerson={onSelectPerson} people={people} query="" />,
    );
    const table = screen.getByRole("table");

    expect(table).toHaveAttribute("aria-rowcount", "3001");
    expect(within(table).getAllByRole("row").length).toBeLessThan(50);
    expect(within(table).queryByRole("button", { name: "Persona 2999" })).not.toBeInTheDocument();

    await user.click(within(table).getByRole("button", { name: "Persona 0000" }));
    await user.keyboard("{End}");
    const lastPerson = within(table).getByRole("button", { name: "Persona 2999" });
    expect(lastPerson).toHaveFocus();
    expect(lastPerson.closest("tr")).toHaveAttribute("aria-rowindex", "3001");
    await user.tab({ shift: true });
    expect(within(table).getByRole("button", { name: "Persona 2998" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectPerson).toHaveBeenLastCalledWith("table-person-2998");

    rerender(<PeopleTable onSelectPerson={onSelectPerson} people={people} query="Persona 0256" />);
    expect(await within(table).findByRole("button", { name: "Persona 0256" })).toBeVisible();
    expect(table).toHaveAttribute("aria-rowcount", "2");
  });
});
