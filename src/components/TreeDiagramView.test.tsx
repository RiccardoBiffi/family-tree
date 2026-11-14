import { render } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TreeDiagramView } from "@/components/TreeDiagramView";
import { Person } from "@/models/Person";

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
});
