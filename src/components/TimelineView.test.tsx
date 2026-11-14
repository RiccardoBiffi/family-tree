import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TimelineView } from "@/components/TimelineView";
import { seedFamilyTree } from "@/data/seedFamilyTree";

describe("TimelineView scrolling", () => {
  it("virtualizes dated and undated people and preserves navigation, search and zoom", async () => {
    const user = userEvent.setup();
    const onSelectPerson = vi.fn();
    const people = Array.from({ length: 3000 }, (_, index) => ({
      ...seedFamilyTree.people[0],
      id: `timeline-person-${index}`,
      name: `Persona ${index.toString().padStart(4, "0")}`,
      surname: null,
      knownAs: null,
      birthDate: index < 1500 ? "2000-01-01" : null,
      parentIds: [],
      childIds: [],
      partnerIds: [],
    }));
    const { container, rerender } = render(
      <TimelineView onSelectPerson={onSelectPerson} people={people} query="" />,
    );

    expect(container.querySelectorAll("[data-virtual-row]").length).toBeLessThan(50);
    expect(screen.queryByRole("button", { name: /Persona 2999/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Persona 0000/ }));
    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Persona 2999" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Persona 2998" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onSelectPerson).toHaveBeenLastCalledWith("timeline-person-2998");

    rerender(<TimelineView onSelectPerson={onSelectPerson} people={people} query="Persona 2998" />);
    expect(screen.getByText("1 corrispondenze evidenziate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Persona 2998" })).toHaveClass("bg-[#edf4ef]");
    await user.click(screen.getByRole("button", { name: "Aumenta zoom timeline" }));
    expect(screen.getByText("Orizzontale · 125%")).toBeVisible();
    expect(container.querySelectorAll("[data-virtual-row]").length).toBeLessThan(50);
  });
});
