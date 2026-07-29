import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PeopleTable } from "@/components/PeopleTable";
import { seedFamilyTree } from "@/data/seedFamilyTree";

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
});
