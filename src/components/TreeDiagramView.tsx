"use client";

import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import { familyNodeTypes, type FamilyTreeNodeData } from "@/components/FamilyFlowNodes";
import type { PersonRecord } from "@/models/Person";
import {
  computeGenerationMap,
  getLifeSpanLabel,
  getPersonDisplayName,
  matchesPersonQuery,
} from "@/utils/familyTree";

interface TreeDiagramViewProps {
  people: PersonRecord[];
  query: string;
  onSelectPerson: (personId: string) => void;
}

function buildTreeNodes(people: PersonRecord[], query: string) {
  const generations = computeGenerationMap(people);
  const generationBuckets = new Map<number, PersonRecord[]>();

  for (const person of people) {
    const generation = generations.get(person.id) ?? 0;
    const bucket = generationBuckets.get(generation) ?? [];
    bucket.push(person);
    generationBuckets.set(generation, bucket);
  }

  const orderedGenerations = Array.from(generationBuckets.entries()).sort(([left], [right]) => left - right);
  const nodes: Node<FamilyTreeNodeData, "familyTree">[] = [];
  const positionById = new Map<string, { x: number; y: number }>();

  for (const [generation, bucket] of orderedGenerations) {
    const sortedBucket = [...bucket].sort((left, right) =>
      (left.birthDate ?? "9999-12-31").localeCompare(right.birthDate ?? "9999-12-31"),
    );
    const visitedPartners = new Set<string>();
    const clusters: PersonRecord[][] = [];

    for (const person of sortedBucket) {
      if (visitedPartners.has(person.id)) {
        continue;
      }

      const sameGenerationPartner = person.partnerIds
        .map((partnerId) => sortedBucket.find((candidate) => candidate.id === partnerId))
        .find((partner): partner is PersonRecord => Boolean(partner));

      if (sameGenerationPartner && !visitedPartners.has(sameGenerationPartner.id)) {
        clusters.push([person, sameGenerationPartner]);
        visitedPartners.add(person.id);
        visitedPartners.add(sameGenerationPartner.id);
      } else {
        clusters.push([person]);
        visitedPartners.add(person.id);
      }
    }

    let cursorX = 40;
    const y = generation * 270;

    for (const cluster of clusters) {
      cluster.forEach((person, index) => {
        const x = cursorX + index * 300;
        positionById.set(person.id, { x, y });
        nodes.push({
          id: person.id,
          type: "familyTree",
          position: { x, y },
          data: {
            label: getPersonDisplayName(person),
            secondaryLabel: getLifeSpanLabel(person),
            tertiaryLabel: person.profession ?? person.birthPlace ?? "Scheda in costruzione",
            photo: person.photo,
            highlighted: matchesPersonQuery(person, query),
            tags: person.tags ?? [],
          },
          draggable: false,
          selectable: true,
        });
      });

      cursorX += cluster.length === 2 ? 680 : 360;
    }
  }

  return { nodes, positionById, generations };
}

function buildTreeEdges(
  people: PersonRecord[],
  positionById: Map<string, { x: number; y: number }>,
): Edge[] {
  const partnerEdgeIds = new Set<string>();
  const edges: Edge[] = [];

  for (const person of people) {
    for (const parentId of person.parentIds) {
      edges.push({
        id: `parent-${parentId}-${person.id}`,
        source: parentId,
        target: person.id,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "smoothstep",
        animated: false,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#48674f",
        },
        style: {
          stroke: "#48674f",
          strokeWidth: 1.8,
        },
      });
    }

    for (const partnerId of person.partnerIds) {
      const edgeId = [person.id, partnerId].sort().join("--");
      if (partnerEdgeIds.has(edgeId)) {
        continue;
      }

      partnerEdgeIds.add(edgeId);
      const sourcePosition = positionById.get(person.id);
      const targetPosition = positionById.get(partnerId);

      if (!sourcePosition || !targetPosition) {
        continue;
      }

      const [sourceId, targetId] =
        sourcePosition.x <= targetPosition.x ? [person.id, partnerId] : [partnerId, person.id];

      edges.push({
        id: `partner-${edgeId}`,
        source: sourceId,
        target: targetId,
        sourceHandle: "right",
        targetHandle: "left",
        type: "straight",
        style: {
          stroke: "#c68c2f",
          strokeDasharray: "8 6",
          strokeWidth: 2,
        },
      });
    }
  }

  return edges;
}

export function TreeDiagramView({ people, query, onSelectPerson }: TreeDiagramViewProps) {
  const { nodes, positionById, generations } = buildTreeNodes(people, query);
  const edges = buildTreeEdges(people, positionById);
  const totalGenerations =
    generations.size > 0 ? Math.max(...Array.from(generations.values())) + 1 : 0;

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9cfbd] px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Vista diagramma</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-900">
            Albero genealogico interattivo
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[#5f6d63]">
          <span className="rounded-full bg-white px-3 py-2">{people.length} persone</span>
          <span className="rounded-full bg-white px-3 py-2">{edges.length} relazioni</span>
          <span className="rounded-full bg-white px-3 py-2">{totalGenerations} generazioni</span>
        </div>
      </div>
      <div className="h-[720px] w-full bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8f1e4_62%,#efe2c8_100%)]">
        <ReactFlow
          colorMode="light"
          defaultEdgeOptions={{ type: "smoothstep" }}
          edges={edges}
          fitView
          maxZoom={1.4}
          minZoom={0.2}
          nodeTypes={familyNodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeClick={(_, node) => onSelectPerson(node.id)}
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d6ccb8" gap={24} size={1.2} />
          <MiniMap
            maskColor="rgba(22, 50, 36, 0.08)"
            nodeBorderRadius={18}
            nodeColor="#5f8f63"
            pannable
            position="bottom-left"
            zoomable
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
