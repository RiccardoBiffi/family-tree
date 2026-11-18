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
      deathDate: null,
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
    await user.click(screen.getByRole("button", { name: "Aumenta zoom cronologia" }));
    expect(screen.getByText("Orizzontale · 125%")).toBeVisible();
    expect(container.querySelectorAll("[data-virtual-row]").length).toBeLessThan(50);
  });
});

describe("TimelineView dates", () => {
  const currentYear = new Date().getUTCFullYear();
  const prototypePerson = {
    ...seedFamilyTree.people[0],
    knownAs: null,
    surname: "Ferraro",
    parentIds: [],
    childIds: [],
    partnerIds: [],
  };
  const people = [
    { ...prototypePerson, id: "antonino", name: "Antonino", birthDate: "1918", deathDate: "1982" },
    { ...prototypePerson, id: "amir", name: "Amir", birthDate: `${currentYear - 22}-01-01`, deathDate: null },
    { ...prototypePerson, id: "maria", name: "Maria", birthDate: null, deathDate: "1950" },
  ];

  it("shows death year below the person's name, including when birth is unknown", () => {
    render(<TimelineView people={people} onSelectPerson={vi.fn()} query="" />);

    const antonino = screen.getByRole("button", { name: "Apri la scheda di Antonino Ferraro, 1918, decesso 1982" });
    expect(antonino.querySelector("[data-timeline-lifespan]")).toHaveTextContent("1918 – 1982");
    expect(screen.getByRole("button", { name: "Maria Ferraro, decesso 1950" })).toHaveTextContent("Decesso 1950");
  });

  it("shows only the birth year on an open-ended bar when death is undocumented", () => {
    render(<TimelineView people={people} onSelectPerson={vi.fn()} query="" />);

    const amir = screen.getByRole("button", { name: /Apri la scheda di Amir Ferraro/ });
    expect(amir).toHaveAttribute("title", expect.stringContaining("decesso non indicato"));
    expect(amir.querySelector("[data-timeline-bar] [data-timeline-birth]")).toHaveTextContent(String(currentYear - 22));
    expect(amir.querySelector("[data-timeline-bar] [data-timeline-end]")).toBeNull();
    expect(amir.querySelector("[data-timeline-lifespan]")).toHaveTextContent(new RegExp(`^${currentYear - 22}$`));
    expect(amir).not.toHaveAccessibleName(/oggi/i);
  });
});
