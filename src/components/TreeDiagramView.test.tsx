import { act, render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildTreeDiagram, TreeDiagramView } from "@/components/TreeDiagramView";
import { WIDE_LAYOUT, COMPACT_LAYOUT } from "@/components/familyDiagramLayout";
import { buildFamilyRoutes } from "@/components/familyDiagramRoutes";
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

  it("centers the previously visited person once when returning to the overview", () => {
    const people = ["a", "b", "c"].map((id) => new Person({ id, name: id }).toRecord());
    const select = vi.fn();
    const { rerender } = render(
      <TreeDiagramView initialPersonId="b" onSelectPerson={select} people={people} query="" selectedPersonId={null} />,
    );
    const props = capture.mock.lastCall![0];
    const center = vi.fn();
    const target = props.nodes.find((node: { data: { personId: string } }) => node.data.personId === "b");
    act(() => props.onInit({ setCenter: center }));
    expect(center).toHaveBeenCalledWith(target.position.x + target.width / 2, target.position.y + target.height / 2, { zoom: 1 });
    rerender(<TreeDiagramView initialPersonId="c" onSelectPerson={select} people={people} query="" selectedPersonId="c" />);
    expect(center).toHaveBeenCalledTimes(1);
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
    expect(initial.nodes.filter((node: { type: string }) => node.type === "familyJunction")
      .map((node: { data: { label: string } }) => node.data.label)).toEqual(["Partner", "Partner"]);
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
      new Person({ id: "carlo", name: "Carlo", surname: "Verdi", partnerIds: ["lucia", "elena", "samira"] }),
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
    expect(junctions.map(({ data }: { data: { title: string } }) => data.title).sort()).toEqual([
      "Carlo Verdi e Elena · 1 figlio", "Carlo Verdi e Lucia · 2 figli", "Carlo Verdi e Samira · 1 figlio",
      "Fabio e Marta · 1 figlio", "Gianni e Lucia · 1 figlio",
    ]);
    expect(junctions.map(({ data }: { data: { label: string } }) => data.label).sort())
      .toEqual(["1 figlio", "1 figlio", "1 figlio", "1 figlio", "2 figli"]);
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
      `${junctions.find(({ data }: { data: { title: string } }) => data.title === "Fabio e Marta · 1 figlio").id}-fork`,
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
    expect(intervals.size).toBeGreaterThan(junctions.length);
  });
});

describe("genealogical diagram geometry", () => {
  it.each([WIDE_LAYOUT, COMPACT_LAYOUT])("aligns the incoming co-parent and labels explicit siblings without a parent junction", layout => {
    const people = [
      new Person({id: "a", name: "Ada"}),
      new Person({id: "b", name: "Bruno", parentIds: ["a"]}),
      new Person({id: "c", name: "Carla", parentIds: ["b"]}),
      new Person({id: "d", name: "Dario", siblingIds: ["e", "f"]}),
      new Person({id: "e", name: "Elia", siblingIds: ["d", "f"]}),
      new Person({id: "f", name: "Flora", siblingIds: ["d", "e"]}),
      new Person({id: "g", name: "Giorgia", parentIds: ["c", "d"]}),
    ].map(person => person.toRecord());
    const {nodes, edges, positionById} = buildTreeDiagram(people, layout);
    const y = (id: string) => positionById.get(id)!.y;
    expect(y("a")).toBeLessThan(y("b"));
    expect(y("b")).toBeLessThan(y("c"));
    expect(y("c")).toBeLessThan(y("g"));
    for (const id of ["d", "e", "f"]) expect(y(id)).toBe(y("c"));
    expect(nodes.filter(node => node.type === "familyTree")).toHaveLength(7);
    expect(nodes.filter(node => node.type === "familyJunction")).toHaveLength(1);
    const siblings = edges.filter(edge => edge.id.startsWith("siblings-"));
    expect(siblings).toHaveLength(2);
    expect(siblings[0].data?.annotation).toMatchObject({ label: "Fratelli e sorelle" });
    expect(new Set(siblings.flatMap(edge => [edge.source, edge.target])))
      .toEqual(new Set(["d", "e", "f"].map(id => positionById.get(id)!.id)));
  });

  it("keeps rank-skipping routes out of intervening cards", () => {
    const people = [
      new Person({id: "upper", name: "Upper"}),
      new Person({id: "other", name: "Other"}),
      new Person({id: "lower", name: "Lower", parentIds: ["upper"]}),
      new Person({id: "shared", name: "Shared", parentIds: ["upper", "other"]}),
      new Person({id: "obstacle", name: "Obstacle"}),
    ].map(person => person.toRecord());
    const positions = new Map([
      ["upper", {id: "upper", row: 0, x: 0}],
      ["obstacle", {id: "obstacle", row: 1, x: 0}],
      ["other", {id: "other", row: 2, x: 320}],
      ["lower", {id: "lower", row: 3, x: 0}],
      ["shared", {id: "shared", row: 3, x: 320}],
    ]);
    const routes = buildFamilyRoutes(people, positions, WIDE_LAYOUT, 4);
    for (const edge of routes.edges) {
      const words = (edge.data as FamilyRouteEdgeData).path.split(" ");
      let x = Number(words[1]);
      let y = Number(words[2]);
      for (let i = 3; i < words.length; i += 2) {
        const nextX = words[i] === "H" ? Number(words[i + 1]) : x;
        const nextY = words[i] === "V" ? Number(words[i + 1]) : y;
        for (const {row, x: left} of positions.values()) {
          const top = routes.rowOffsets[row];
          const right = left + WIDE_LAYOUT.nodeWidth;
          const bottom = top + WIDE_LAYOUT.nodeHeight;
          const verticalHit = x === nextX && left < x && x < right &&
            Math.min(y, nextY) < bottom && Math.max(y, nextY) > top;
          const horizontalHit = y === nextY && top < y && y < bottom &&
            Math.min(x, nextX) < right && Math.max(x, nextX) > left;
          expect(verticalHit || horizontalHit, edge.id).toBe(false);
        }
        x = nextX;
        y = nextY;
      }
    }
  });
});
