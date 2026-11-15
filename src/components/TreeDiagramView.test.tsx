import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TreeDiagramView } from "@/components/TreeDiagramView";
import { Person } from "@/models/Person";
import type { FamilyRouteEdgeData } from "@/components/FamilyFlowNodes";

const capture = vi.hoisted(() => vi.fn());

vi.mock("@xyflow/react", async (loadOriginal) => ({
  ...await loadOriginal<typeof import("@xyflow/react")>(),
  ReactFlow: (props: Record<string, unknown>) => {
    capture(props);
    return <div />;
  },
}));

describe("TreeDiagramView", () => {
  beforeEach(() => {
    capture.mockClear();
  });

  it("keeps layout stable while highlighting and uses unique IDs for similarly named relationships", () => {
    const people = [
      ["a", "b--c"],
      ["b--c", "a"],
      ["a--b", "c"],
      ["c", "a--b"],
      ['a" quote', ""],
    ].map(([id, partner]) => new Person({
      id,
      name: id,
      partnerIds: partner ? [partner] : [],
    }).toRecord());
    const select = vi.fn();
    const { rerender } = render(
      <TreeDiagramView onSelectPerson={select} people={people} query="" selectedPersonId={null} />,
    );
    const initial = capture.mock.lastCall?.[0];
    expect(initial.onlyRenderVisibleElements).toBe(true);
    expect(initial.nodes).toHaveLength(7);
    expect(initial.edges).toHaveLength(4);
    const nodeIds = new Set(initial.nodes.map(({ id }: { id: string }) => id));
    const edgeIds = new Set(initial.edges.map(({ id }: { id: string }) => id));
    expect(nodeIds.size).toBe(initial.nodes.length);
    expect(edgeIds.size).toBe(initial.edges.length);
    for (const edge of initial.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
    const quoted = initial.nodes.find(({ data }: { data: { personId?: string } }) =>
      data.personId?.includes("quote"),
    );
    expect(quoted.id).not.toMatch(/["\\]/);
    initial.onNodeClick({}, quoted);
    expect(select).toHaveBeenCalledWith('a" quote');

    rerender(
      <TreeDiagramView
        onSelectPerson={select}
        people={people}
        photoUrls={new Map([["a", "blob:portrait"]])}
        query="a--b"
        selectedPersonId="a"
      />,
    );
    const updated = capture.mock.lastCall?.[0];
    expect(updated.nodes).toBe(initial.nodes);
    expect(updated.edges).toBe(initial.edges);
  });

  it("draws one branch for confirmed parents, groups siblings and routes disjoint horizontal segments", () => {
    const people = [
      new Person({ id: "carlo", name: "Carlo", partnerIds: ["lucia", "elena", "samira"] }),
      new Person({ id: "lucia", name: "Lucia", partnerIds: ["carlo", "gianni"] }),
      new Person({ id: "elena", name: "Elena", partnerIds: ["carlo"] }),
      new Person({ id: "samira", name: "Samira", partnerIds: ["carlo"] }),
      new Person({ id: "gianni", name: "Gianni", partnerIds: ["lucia"] }),
      new Person({ id: "marta", name: "Marta", parentIds: ["carlo", "lucia"] }),
      new Person({ id: "dario", name: "Dario", parentIds: ["carlo", "elena"] }),
      new Person({ id: "fabio", name: "Fabio", parentIds: ["carlo", "lucia"] }),
      new Person({ id: "amir", name: "Amir", parentIds: ["carlo", "samira"] }),
      new Person({ id: "isabella", name: "Isabella", parentIds: ["gianni", "lucia"] }),
      new Person({ id: "adele", name: "Adele", parentIds: ["marta"] }),
      new Person({ id: "unresolved", name: "Mia", parentIds: ["marta", "dario", "fabio"] }),
      new Person({
        id: "resolved", name: "Chosen", parentIds: ["marta", "dario", "fabio"],
        diagramParentIds: ["marta", "fabio"],
      }),
    ].map((person) => person.toRecord());
    render(<TreeDiagramView onSelectPerson={vi.fn()} people={people} query="" selectedPersonId={null} />);
    const props = capture.mock.lastCall?.[0];
    const junctions = props.nodes.filter(({ type }: { type: string }) => type === "familyJunction");
    expect(junctions.map(({ data }: { data: { label: string } }) => data.label).sort()).toEqual([
      "Carlo + Elena", "Carlo + Lucia", "Carlo + Samira", "Fabio + Marta", "Gianni + Lucia",
    ]);
    const nodeFor = (personId: string) => props.nodes.find(({ data }: { data: { personId: string } }) =>
      data.personId === personId,
    );
    const [marta, fabio, dario, adele, unresolved, resolved] =
      ["marta", "fabio", "dario", "adele", "unresolved", "resolved"].map(nodeFor);
    expect(Math.abs(marta.position.x - fabio.position.x)).toBeLessThan(
      Math.abs(marta.position.x - dario.position.x) + Math.abs(fabio.position.x - dario.position.x),
    );
    const incoming = (nodeId: string) => props.edges.filter(({ target }: { target: string }) => target === nodeId);
    expect(incoming(marta.id)[0].source).toBe(incoming(fabio.id)[0].source);
    expect(incoming(marta.id)[0].source).not.toBe(incoming(dario.id)[0].source);
    expect(incoming(adele.id)[0].source).toBe(marta.id);
    expect(incoming(unresolved.id)).toHaveLength(0);
    expect(incoming(resolved.id)[0].source).toBe(
      `${junctions.find(({ data }: { data: { label: string } }) => data.label === "Fabio + Marta").id}-fork`,
    );

    const intervals = new Map<number, [number, number][]>();
    for (const { data } of props.edges as Array<{ data: FamilyRouteEdgeData }>) {
      const [move, x, y, ...commands] = data.path.split(" ");
      expect(move).toBe("M");
      let positionX = Number(x);
      let positionY = Number(y);
      for (let index = 0; index < commands.length; index += 2) {
        const coordinate = Number(commands[index + 1]);
        if (commands[index] === "V") {
          positionY = coordinate;
        } else if (positionX !== coordinate) {
          const start = Math.min(positionX, coordinate);
          const end = Math.max(positionX, coordinate);
          const row = intervals.get(positionY) ?? [];
          for (const [otherStart, otherEnd] of row) {
            expect(Math.max(start, otherStart)).toBeGreaterThanOrEqual(Math.min(end, otherEnd));
          }
          row.push([start, end]);
          intervals.set(positionY, row);
          positionX = coordinate;
        }
      }
    }
    expect(intervals.size).toBeGreaterThan(10);
  });
});
