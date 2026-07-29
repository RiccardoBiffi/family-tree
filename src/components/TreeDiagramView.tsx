"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";

import {
  familyNodeTypes,
  type FamilyJunctionNodeData,
  type FamilyTreeNodeData,
} from "@/components/FamilyFlowNodes";
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
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
}

interface PersonCluster {
  members: PersonRecord[];
}

interface PartnerUnion {
  id: string;
  leftId: string;
  rightId: string;
}

interface DiagramLayout {
  compact: boolean;
  coupleGap: number;
  familyGap: number;
  generationGap: number;
  nodeHeight: number;
  nodeWidth: number;
}

const WIDE_LAYOUT: DiagramLayout = {
  compact: false,
  coupleGap: 52,
  familyGap: 96,
  generationGap: 198,
  nodeHeight: 116,
  nodeWidth: 220,
};

const COMPACT_LAYOUT: DiagramLayout = {
  compact: true,
  coupleGap: 10,
  familyGap: 10,
  generationGap: 150,
  nodeHeight: 124,
  nodeWidth: 86,
};

function getLegalName(person: PersonRecord): string {
  return [person.name, person.surname].filter(Boolean).join(" ").trim() || "Persona senza nome";
}

function getPartnerKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("--");
}

function comparePeopleForLayout(left: PersonRecord, right: PersonRecord): number {
  const parentPriority = Number(left.parentIds.length === 0) - Number(right.parentIds.length === 0);

  if (parentPriority !== 0) {
    return parentPriority;
  }

  const dateComparison = (left.birthDate ?? "9999-12-31").localeCompare(
    right.birthDate ?? "9999-12-31",
  );

  return dateComparison || getLegalName(left).localeCompare(getLegalName(right), "it");
}

/**
 * A spouse with no recorded ancestors still belongs beside their partner. The source generation
 * map is ancestry-only, so this derived map aligns couples and then carries that alignment down
 * valid parent-child relationships without changing the stored family data.
 */
function computeDiagramGenerationMap(people: PersonRecord[]): Map<string, number> {
  const baseGenerations = computeGenerationMap(people);
  const diagramGenerations = new Map(baseGenerations);
  const peopleById = new Map(people.map((person) => [person.id, person]));

  for (let pass = 0; pass < Math.max(people.length, 1); pass += 1) {
    let changed = false;

    for (const person of people) {
      for (const partnerId of person.partnerIds) {
        if (!peopleById.has(partnerId)) {
          continue;
        }

        const alignedGeneration = Math.max(
          diagramGenerations.get(person.id) ?? 0,
          diagramGenerations.get(partnerId) ?? 0,
        );

        if ((diagramGenerations.get(person.id) ?? 0) !== alignedGeneration) {
          diagramGenerations.set(person.id, alignedGeneration);
          changed = true;
        }

        if ((diagramGenerations.get(partnerId) ?? 0) !== alignedGeneration) {
          diagramGenerations.set(partnerId, alignedGeneration);
          changed = true;
        }
      }
    }

    for (const child of people) {
      const childBaseGeneration = baseGenerations.get(child.id) ?? 0;
      const validParentGenerations = child.parentIds
        .filter(
          (parentId) =>
            peopleById.has(parentId) &&
            childBaseGeneration > (baseGenerations.get(parentId) ?? 0),
        )
        .map((parentId) => diagramGenerations.get(parentId) ?? 0);

      if (validParentGenerations.length === 0) {
        continue;
      }

      const requiredGeneration = Math.max(...validParentGenerations) + 1;
      if ((diagramGenerations.get(child.id) ?? 0) < requiredGeneration) {
        diagramGenerations.set(child.id, requiredGeneration);
        changed = true;
      }
    }

    if (!changed) {
      break;
    }
  }

  return diagramGenerations;
}

function buildGenerationClusters(bucket: PersonRecord[]): PersonCluster[] {
  const sortedBucket = [...bucket].sort(comparePeopleForLayout);
  const peopleById = new Map(sortedBucket.map((person) => [person.id, person]));
  const visited = new Set<string>();
  const clusters: PersonCluster[] = [];

  for (const person of sortedBucket) {
    if (visited.has(person.id)) {
      continue;
    }

    const partner = person.partnerIds
      .map((partnerId) => peopleById.get(partnerId))
      .find((candidate): candidate is PersonRecord => Boolean(candidate && !visited.has(candidate.id)));

    const members = partner ? [person, partner] : [person];
    members.forEach((member) => visited.add(member.id));
    clusters.push({ members });
  }

  return clusters.map((cluster, clusterIndex) => {
    if (cluster.members.length !== 2) {
      return cluster;
    }

    const [first, second] = cluster.members;
    const lineageMembers = cluster.members.filter((member) => member.parentIds.length > 0);

    if (lineageMembers.length !== 1) {
      return {
        members: [...cluster.members].sort(comparePeopleForLayout),
      };
    }

    const lineageMember = lineageMembers[0];
    const partner = lineageMember.id === first.id ? second : first;
    const lineageFacesRight = clusterIndex < clusters.length / 2;

    return {
      members: lineageFacesRight ? [partner, lineageMember] : [lineageMember, partner],
    };
  });
}

function getClusterWidth(
  cluster: PersonCluster,
  layout: DiagramLayout,
): number {
  return (
    cluster.members.length * layout.nodeWidth +
    Math.max(cluster.members.length - 1, 0) * layout.coupleGap
  );
}

function getRowWidth(
  clusters: PersonCluster[],
  layout: DiagramLayout,
): number {
  return (
    clusters.reduce(
      (width, cluster) => width + getClusterWidth(cluster, layout),
      0,
    ) +
    Math.max(clusters.length - 1, 0) * layout.familyGap
  );
}

function buildPersonAriaLabel(person: PersonRecord): string {
  const details = [
    getLegalName(person),
    person.knownAs ? `conosciuto come ${person.knownAs}` : null,
    getLifeSpanLabel(person),
    person.profession,
    person.birthPlace,
  ].filter(Boolean);

  return `${details.join(", ")}. Apri la scheda personale`;
}

function buildTreeNodes(
  people: PersonRecord[],
  query: string,
  selectedPersonId: string | null,
  onSelectPerson: (personId: string) => void,
  layout: DiagramLayout,
) {
  const generations = computeDiagramGenerationMap(people);
  const generationBuckets = new Map<number, PersonRecord[]>();

  for (const person of people) {
    const generation = generations.get(person.id) ?? 0;
    const bucket = generationBuckets.get(generation) ?? [];
    bucket.push(person);
    generationBuckets.set(generation, bucket);
  }

  const rows = Array.from(generationBuckets.entries())
    .sort(([left], [right]) => left - right)
    .map(([generation, bucket]) => ({
      generation,
      clusters: buildGenerationClusters(bucket),
    }));
  const graphWidth = Math.max(
    ...rows.map((row) => getRowWidth(row.clusters, layout)),
    layout.nodeWidth,
  );
  const nodes: Node[] = [];
  const positionById = new Map<string, { x: number; y: number }>();
  const unionsByPartnerKey = new Map<string, PartnerUnion>();
  const hasQuery = query.trim().length > 0;

  rows.forEach((row, rowIndex) => {
    const rowWidth = getRowWidth(row.clusters, layout);
    let cursorX = (graphWidth - rowWidth) / 2;
    const y = rowIndex * layout.generationGap;

    row.clusters.forEach((cluster) => {
      cluster.members.forEach((person, memberIndex) => {
        const x =
          cursorX +
          memberIndex * (layout.nodeWidth + layout.coupleGap);
        const isHighlighted = hasQuery && matchesPersonQuery(person, query);
        const legalName = getLegalName(person);

        positionById.set(person.id, { x, y });
        nodes.push({
          id: person.id,
          type: "familyTree",
          position: { x, y },
          width: layout.nodeWidth,
          height: layout.nodeHeight,
          data: {
            ariaLabel: buildPersonAriaLabel(person),
            birthPlace: person.birthPlace,
            compact: layout.compact,
            displayLabel: legalName,
            highlighted: isHighlighted,
            label: getPersonDisplayName(person),
            onSelect: () => onSelectPerson(person.id),
            photo: person.photo,
            profession: person.profession,
            secondaryLabel: getLifeSpanLabel(person).replace(" - ", "–"),
            selected: selectedPersonId === person.id,
            sex: person.sex,
          } satisfies FamilyTreeNodeData,
          ariaLabel: buildPersonAriaLabel(person),
          draggable: false,
          focusable: false,
          selectable: false,
        });
      });

      if (cluster.members.length === 2) {
        const [leftPerson, rightPerson] = cluster.members;
        const partnerKey = getPartnerKey(leftPerson.id, rightPerson.id);
        const junctionId = `family-union-${partnerKey}`;
        const junctionX =
          cursorX + layout.nodeWidth + layout.coupleGap / 2;
        const junctionY = y + layout.nodeHeight / 2;

        unionsByPartnerKey.set(partnerKey, {
          id: junctionId,
          leftId: leftPerson.id,
          rightId: rightPerson.id,
        });
        nodes.push({
          id: junctionId,
          type: "familyJunction",
          position: { x: junctionX, y: junctionY },
          width: 2,
          height: 2,
          data: {} satisfies FamilyJunctionNodeData,
          draggable: false,
          focusable: false,
          selectable: false,
          connectable: false,
        });
      }

      cursorX += getClusterWidth(cluster, layout) + layout.familyGap;
    });
  });

  return {
    generations,
    nodes,
    positionById,
    unionsByPartnerKey,
  };
}

function buildTreeEdges(
  people: PersonRecord[],
  positionById: Map<string, { x: number; y: number }>,
  unionsByPartnerKey: Map<string, PartnerUnion>,
): Edge[] {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const partnerEdgeIds = new Set<string>();
  const edges: Edge[] = [];
  const partnerStyle = {
    stroke: "#c8791a",
    strokeDasharray: "8 7",
    strokeLinecap: "butt" as const,
    strokeWidth: 2.4,
  };
  const parentStyle = {
    stroke: "#17452d",
    strokeLinecap: "round" as const,
    strokeWidth: 2.2,
  };

  for (const person of people) {
    for (const partnerId of person.partnerIds) {
      if (!peopleById.has(partnerId)) {
        continue;
      }

      const partnerKey = getPartnerKey(person.id, partnerId);
      if (partnerEdgeIds.has(partnerKey)) {
        continue;
      }

      partnerEdgeIds.add(partnerKey);
      const sourcePosition = positionById.get(person.id);
      const targetPosition = positionById.get(partnerId);

      if (!sourcePosition || !targetPosition) {
        continue;
      }

      const [leftId, rightId] =
        sourcePosition.x <= targetPosition.x ? [person.id, partnerId] : [partnerId, person.id];
      const union = unionsByPartnerKey.get(partnerKey);
      const leftName = getLegalName(peopleById.get(leftId) as PersonRecord);
      const rightName = getLegalName(peopleById.get(rightId) as PersonRecord);

      if (union) {
        edges.push(
          {
            id: `partner-${partnerKey}-left`,
            source: leftId,
            target: union.id,
            sourceHandle: "right",
            targetHandle: "left",
            type: "straight",
            style: partnerStyle,
            ariaLabel: `Relazione di coppia tra ${leftName} e ${rightName}`,
            focusable: false,
          },
          {
            id: `partner-${partnerKey}-right`,
            source: union.id,
            target: rightId,
            sourceHandle: "right",
            targetHandle: "left",
            type: "straight",
            style: partnerStyle,
            ariaLabel: `Relazione di coppia tra ${leftName} e ${rightName}`,
            focusable: false,
          },
        );
      } else {
        edges.push({
          id: `partner-${partnerKey}`,
          source: leftId,
          target: rightId,
          sourceHandle: "right",
          targetHandle: "left",
          type: sourcePosition.y === targetPosition.y ? "straight" : "smoothstep",
          style: partnerStyle,
          ariaLabel: `Relazione di coppia tra ${leftName} e ${rightName}`,
          focusable: false,
        });
      }
    }
  }

  for (const child of people) {
    const validParentIds = child.parentIds.filter((parentId) => peopleById.has(parentId));
    let representedParentIds = new Set<string>();
    let familyUnion: PartnerUnion | undefined;

    for (let leftIndex = 0; leftIndex < validParentIds.length && !familyUnion; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < validParentIds.length && !familyUnion;
        rightIndex += 1
      ) {
        familyUnion = unionsByPartnerKey.get(
          getPartnerKey(validParentIds[leftIndex], validParentIds[rightIndex]),
        );
      }
    }

    if (familyUnion) {
      const parentNames = [familyUnion.leftId, familyUnion.rightId]
        .map((parentId) => peopleById.get(parentId))
        .filter((parent): parent is PersonRecord => Boolean(parent))
        .map(getLegalName);

      representedParentIds = new Set([familyUnion.leftId, familyUnion.rightId]);
      edges.push({
        id: `parent-union-${familyUnion.id}-${child.id}`,
        source: familyUnion.id,
        target: child.id,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "smoothstep",
        style: parentStyle,
        ariaLabel: `Relazione genitore-figlio da ${parentNames.join(" e ")} a ${getLegalName(child)}`,
        focusable: false,
      });
    }

    for (const parentId of validParentIds) {
      if (representedParentIds.has(parentId)) {
        continue;
      }

      const parent = peopleById.get(parentId);
      if (!parent) {
        continue;
      }

      edges.push({
        id: `parent-${parentId}-${child.id}`,
        source: parentId,
        target: child.id,
        sourceHandle: "bottom",
        targetHandle: "top",
        type: "smoothstep",
        style: parentStyle,
        ariaLabel: `Relazione genitore-figlio da ${getLegalName(parent)} a ${getLegalName(child)}`,
        focusable: false,
      });
    }
  }

  return edges;
}

export function TreeDiagramView({
  people,
  query,
  selectedPersonId,
  onSelectPerson,
}: TreeDiagramViewProps) {
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const layout = isCompactLayout ? COMPACT_LAYOUT : WIDE_LAYOUT;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncLayout = () => setIsCompactLayout(mediaQuery.matches);

    syncLayout();
    mediaQuery.addEventListener("change", syncLayout);

    return () => mediaQuery.removeEventListener("change", syncLayout);
  }, []);

  const { edges, nodes, totalGenerations } = useMemo(() => {
    const {
      generations,
      nodes: nextNodes,
      positionById,
      unionsByPartnerKey,
    } = buildTreeNodes(
      people,
      query,
      selectedPersonId,
      onSelectPerson,
      layout,
    );

    return {
      nodes: nextNodes,
      edges: buildTreeEdges(people, positionById, unionsByPartnerKey),
      totalGenerations: new Set(generations.values()).size,
    };
  }, [layout, onSelectPerson, people, query, selectedPersonId]);

  const fitViewPadding = isCompactLayout
    ? {
        bottom: "68px" as const,
        left: "8px" as const,
        right: "8px" as const,
        top: "8px" as const,
      }
    : {
        bottom: "72px" as const,
        left: "36px" as const,
        right: "36px" as const,
        top: "28px" as const,
      };

  return (
    <section
      aria-label="Diagramma genealogico interattivo"
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#d7ddd6] bg-white shadow-[0_12px_36px_rgba(20,53,36,0.07)]"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-[#e1e5df] bg-[#fbfcf9] px-3 py-2.5 sm:px-4">
        <div
          aria-label="Legenda delle relazioni"
          className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#435249] sm:text-sm"
        >
          <span className="font-semibold text-[#193c28]">Legenda</span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span aria-hidden="true" className="h-0.5 w-9 bg-[#17452d]" />
            Genitore – figlio
          </span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span
              aria-hidden="true"
              className="h-0 w-9 border-t-2 border-dashed border-[#c8791a]"
            />
            Relazione di coppia
          </span>
        </div>
        <p className="hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.12em] text-[#66746b] sm:block">
          {people.length} persone · {totalGenerations} generazioni
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#fbfaf7]">
        <ReactFlow
          key={isCompactLayout ? "compact" : "wide"}
          aria-label="Albero genealogico. Usa i controlli per adattare, ingrandire o ridurre la vista."
          ariaLabelConfig={{
            "controls.ariaLabel": "Controlli del diagramma",
            "controls.fitView.ariaLabel": "Adatta tutto il diagramma",
            "controls.zoomIn.ariaLabel": "Ingrandisci il diagramma",
            "controls.zoomOut.ariaLabel": "Riduci il diagramma",
            "minimap.ariaLabel": "Minimappa del diagramma genealogico",
          }}
          colorMode="light"
          defaultEdgeOptions={{ type: "smoothstep" }}
          edges={edges}
          edgesFocusable={false}
          elementsSelectable={false}
          fitView
          fitViewOptions={{
            duration: 0,
            maxZoom: 1.05,
            minZoom: 0.28,
            padding: fitViewPadding,
          }}
          maxZoom={1.45}
          minZoom={0.24}
          nodeTypes={familyNodeTypes}
          nodes={nodes}
          nodesConnectable={false}
          nodesDraggable={false}
          nodesFocusable={false}
          onNodeClick={(_, node) => {
            if (node.type === "familyTree") {
              onSelectPerson(node.id);
            }
          }}
          panOnDrag
          proOptions={{ hideAttribution: true }}
          zoomOnDoubleClick={false}
        >
          <Background color="#d7ded7" gap={28} size={1} />
          <MiniMap
            ariaLabel="Minimappa del diagramma genealogico"
            className="!right-3 !bottom-3 !m-0 !h-20 !w-28 !rounded-xl !border !border-[#ccd5cc] !bg-white/95 !shadow-[0_8px_24px_rgba(20,53,36,0.1)] sm:!h-28 sm:!w-44"
            maskColor="rgba(23, 69, 45, 0.09)"
            nodeBorderRadius={8}
            nodeColor={(node) => (node.type === "familyJunction" ? "transparent" : "#7fa08a")}
            nodeStrokeColor={(node) =>
              node.type === "familyJunction" ? "transparent" : "#17452d"
            }
            nodeStrokeWidth={1.5}
            pannable
            position="bottom-right"
            zoomable
          />
          <Controls
            aria-label="Controlli del diagramma"
            className="!m-3 !overflow-hidden !rounded-xl !border !border-[#ccd5cc] !bg-white !shadow-[0_8px_24px_rgba(20,53,36,0.12)] [&>button]:!h-11 [&>button]:!w-11 [&>button]:!border-[#dce2dc] [&>button]:!bg-white [&>button]:!text-[#173c28] [&>button:hover]:!bg-[#f0f5ef] [&>button:focus-visible]:!relative [&>button:focus-visible]:!z-10 [&>button:focus-visible]:!outline-2 [&>button:focus-visible]:!outline-offset-[-3px] [&>button:focus-visible]:!outline-[#17452d]"
            fitViewOptions={{
              duration: 0,
              maxZoom: 1.05,
              minZoom: 0.24,
              padding: fitViewPadding,
            }}
            orientation="vertical"
            position="bottom-left"
            showInteractive={false}
          />
        </ReactFlow>

        {people.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6 text-center">
            <p className="rounded-xl border border-[#d7ddd6] bg-white px-5 py-4 text-sm text-[#56645b] shadow-sm">
              Nessuna persona da mostrare nel diagramma.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
