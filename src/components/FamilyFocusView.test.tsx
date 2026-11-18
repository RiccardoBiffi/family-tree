import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FamilyFocusView } from "@/components/FamilyFocusView";
import { Person, type PersonInput } from "@/models/Person";

function record(id: string, name: string, input: Partial<PersonInput> = {}) {
  return new Person({ ...input, id, name }).toRecord();
}

const family = [
  record("a", "Ada", { siblingIds: ["b", "c"], childIds: ["x", "y"] }),
  record("b", "Bruno", { siblingIds: ["a", "c"] }),
  record("c", "Cecilia", { siblingIds: ["a", "b"] }),
  record("d", "Dario", { childIds: ["x"] }),
  record("x", "Elda", { parentIds: ["a", "d"], siblingIds: ["y"] }),
  record("y", "Fabio", { parentIds: ["a"] }),
];
const peopleById = new Map(family.map((p) => [p.id, p]));

describe("FamilyFocusView", () => {
  it("displays siblings without creating parents, and names the documented co-parent within their children's group", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onOpenPerson = vi.fn();
    render(<FamilyFocusView onNavigate={onNavigate} onOpenPerson={onOpenPerson} peopleById={peopleById} personId="a" query="" />);

    expect(screen.queryByRole("region", { name: "Genitori" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Partner" })).toBeNull();
    const siblings = screen.getByRole("region", { name: "Fratelli e sorelle" });
    expect(within(siblings).getAllByRole("button")).toHaveLength(2);
    await user.click(within(siblings).getByRole("button", { name: "Mostra la famiglia di Bruno" }));
    expect(onNavigate).toHaveBeenCalledWith("b");
    const children = screen.getByRole("region", { name: "Figli" });
    const secondParent = within(children).getByRole("group", { name: "Figli di Ada e Dario" });
    expect(secondParent).toHaveTextContent("Elda");
    expect(secondParent).not.toHaveTextContent("Fabio");
    await user.click(screen.getByRole("button", { name: "Apri scheda" }));
    expect(onOpenPerson).toHaveBeenCalledWith("a");
  });

  it("deduplicates a sibling identified both explicitly and by a shared parent", () => {
    render(<FamilyFocusView onNavigate={vi.fn()} onOpenPerson={vi.fn()} peopleById={peopleById} personId="x" query="" />);
    const siblings = screen.getByRole("region", { name: "Fratelli e sorelle" });
    expect(within(siblings).getAllByRole("button")).toHaveLength(1);
    expect(siblings).toHaveTextContent("Fabio");
  });

  it("uses archive search to navigate to another branch", async () => {
    const onNavigate = vi.fn();
    render(<FamilyFocusView onNavigate={onNavigate} onOpenPerson={vi.fn()} peopleById={peopleById} personId="a" query="Dario" />);
    await userEvent.click(screen.getByRole("button", { name: "Mostra la famiglia di Dario" }));
    expect(onNavigate).toHaveBeenCalledWith("d");
  });
});
