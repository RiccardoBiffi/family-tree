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

import { familyNodeTypes, type FamilyTimelineNodeData } from "@/components/FamilyFlowNodes";
import type { PersonRecord } from "@/models/Person";
import {
  computeGenerationMap,
  extractYear,
  formatDateLabel,
  getPersonDisplayName,
  matchesPersonQuery,
} from "@/utils/familyTree";

interface TimelineViewProps {
  people: PersonRecord[];
  query: string;
  onSelectPerson: (personId: string) => void;
}

function buildTimelineNodes(people: PersonRecord[], query: string) {
  const currentYear = new Date().getUTCFullYear();
  const availableYears = people.flatMap((person) => [
    extractYear(person.birthDate),
    extractYear(person.deathDate),
  ]);
  const validYears = availableYears.filter((year): year is number => year !== null);
  const minYear = validYears.length > 0 ? Math.min(...validYears) - 2 : currentYear - 10;
  const maxYear = validYears.length > 0 ? Math.max(...validYears, currentYear) + 2 : currentYear + 2;
  const generations = computeGenerationMap(people);
  const generationBuckets = new Map<number, PersonRecord[]>();

  for (const person of people) {
    const generation = generations.get(person.id) ?? 0;
    const bucket = generationBuckets.get(generation) ?? [];
    bucket.push(person);
    generationBuckets.set(generation, bucket);
  }

  const nodes: Node<FamilyTimelineNodeData, "familyTimeline">[] = [];
  const positionById = new Map<string, { x: number; y: number }>();
  const yearScale = 28;

  for (const [generation, bucket] of Array.from(generationBuckets.entries()).sort(([left], [right]) => left - right)) {
    const sortedBucket = [...bucket].sort((left, right) =>
      (left.birthDate ?? "9999-12-31").localeCompare(right.birthDate ?? "9999-12-31"),
    );

    sortedBucket.forEach((person, index) => {
      const birthYear = extractYear(person.birthDate) ?? minYear;
      const deathYear = extractYear(person.deathDate) ?? currentYear;
      const spanYears = Math.max(deathYear - birthYear, 0);
      const x = (birthYear - minYear) * yearScale + 80;
      const y = generation * 210 + index * 110 + 40;
      const barWidth = Math.max(190, spanYears * 12 + 170);

      positionById.set(person.id, { x, y });
      nodes.push({
        id: person.id,
        type: "familyTimeline",
        position: { x, y },
        data: {
          label: getPersonDisplayName(person),
          secondaryLabel:
            person.birthPlace ?? person.profession ?? `Generazione ${generation + 1}`,
          spanLabel: `${formatDateLabel(person.birthDate)} -> ${
            person.deathDate ? formatDateLabel(person.deathDate) : "oggi"
          }`,
          barWidth,
          highlighted: matchesPersonQuery(person, query),
        },
        draggable: false,
        selectable: true,
      });
    });
  }

  return { nodes, positionById, minYear, maxYear };
}

function buildTimelineEdges(people: PersonRecord[]): Edge[] {
  const partnerEdgeIds = new Set<string>();
  const edges: Edge[] = [];

  for (const person of people) {
    for (const parentId of person.parentIds) {
      edges.push({
        id: `timeline-parent-${parentId}-${person.id}`,
        source: parentId,
        target: person.id,
        sourceHandle: "right",
        targetHandle: "left",
        type: "smoothstep",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#48674f",
        },
        style: {
          stroke: "#48674f",
          strokeWidth: 1.6,
        },
      });
    }

    for (const partnerId of person.partnerIds) {
      const edgeId = [person.id, partnerId].sort().join("--");
      if (partnerEdgeIds.has(edgeId)) {
        continue;
      }

      partnerEdgeIds.add(edgeId);
      edges.push({
        id: `timeline-partner-${edgeId}`,
        source: person.id,
        target: partnerId,
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

export function TimelineView({ people, query, onSelectPerson }: TimelineViewProps) {
  const { nodes, positionById, minYear, maxYear } = buildTimelineNodes(people, query);
  const edges = buildTimelineEdges(people);

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d9cfbd] px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Vista timeline</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-900">
            Cronologia con panning e zoom
          </h2>
        </div>
        <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.18em] text-[#5f6d63]">
          <span className="rounded-full bg-white px-3 py-2">
            Intervallo {minYear} - {maxYear}
          </span>
          <span className="rounded-full bg-white px-3 py-2">
            {positionById.size} corsie temporali
          </span>
        </div>
      </div>
      <div className="h-[720px] w-full bg-[radial-gradient(circle_at_top,#ffffff_0%,#f8f1e4_60%,#efe2c8_100%)]">
        <ReactFlow
          colorMode="light"
          edges={edges}
          fitView
          maxZoom={1.5}
          minZoom={0.18}
          nodeTypes={familyNodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          onNodeClick={(_, node) => onSelectPerson(node.id)}
          panOnDrag
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#d6ccb8" gap={36} size={1} />
          <MiniMap
            maskColor="rgba(22, 50, 36, 0.08)"
            nodeBorderRadius={18}
            nodeColor="#c68c2f"
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
