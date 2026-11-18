"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import {
  Background,
  ControlButton,
  Controls,
  getViewportForBounds,
  MiniMap,
  Position,
  ReactFlow,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";

import {
  familyEdgeTypes,
  familyNodeTypes,
  type FamilyTreeNodeData,
  FamilyTreeNodeContext,
} from "@/components/FamilyFlowNodes";
import { buildFamilyRoutes } from "@/components/familyDiagramRoutes";
import { layoutFamilyPeople, WIDE_LAYOUT, COMPACT_LAYOUT, type DiagramLayout } from "@/components/familyDiagramLayout";
import { parseMediaAssetReference } from "@/models/MediaAsset";
import type { PersonRecord } from "@/models/Person";
import {
  getLifeSpanLabel,
  getPersonDisplayName,
  matchesPersonQuery,
} from "@/utils/familyTree";

interface TreeDiagramViewProps {
  people: PersonRecord[];
  photoUrls?: ReadonlyMap<string, string>;
  query: string;
  selectedPersonId: string | null;
  initialPersonId?: string | null;
  onSelectPerson: (personId: string) => void;
}

interface DiagramPersonPosition {
  id: string;
  x: number;
  y: number;
}

const READING_ZOOM = 1;
const COMPACT_BREAKPOINT = "(max-width: 639px)";
const WIDE_PADDING = { bottom: "72px", left: "36px", right: "36px", top: "28px" } as const;
const COMPACT_PADDING = { bottom: "68px", left: "8px", right: "8px", top: "8px" } as const;
const EMPTY_IDS: ReadonlySet<string> = new Set();
const PRO_OPTIONS = { hideAttribution: true };
const ARIA_LABELS = {
  "controls.ariaLabel": "Controlli del diagramma",
  "controls.fitView.ariaLabel": "Adatta tutto il diagramma",
  "controls.zoomIn.ariaLabel": "Ingrandisci il diagramma",
  "controls.zoomOut.ariaLabel": "Riduci il diagramma",
  "minimap.ariaLabel": "Minimappa del diagramma genealogico",
  "node.a11yDescription.default": "Premi Invio per aprire la scheda della persona o evidenziare il ramo.",
  "node.a11yDescription.keyboardDisabled": "Seleziona una persona per aprire la scheda.",
  "edge.a11yDescription.default": "Collegamento tra persone nel diagramma.",
};

function subscribeToCompactLayout(onChange: () => void) {
  const mediaQuery = window.matchMedia(COMPACT_BREAKPOINT);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function isCompactScreen() {
  return window.matchMedia(COMPACT_BREAKPOINT).matches;
}

function getLegalName(person: PersonRecord): string {
  return [person.name, person.surname].filter(Boolean).join(" ").trim() || "Persona senza nome";
}

function makeHandles(width: number, height: number): NonNullable<Node["handles"]> {
  return [
    { id: "top", x: width / 2, y: 0, position: Position.Top, type: "target", width: 0, height: 0 },
    { id: "bottom", x: width / 2, y: height, position: Position.Bottom, type: "source", width: 0, height: 0 },
  ];
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

export function buildTreeDiagram(people: PersonRecord[], layout: DiagramLayout) {
  const { positions, graphWidth, rowCount } = layoutFamilyPeople(people, layout);
  const routes = buildFamilyRoutes(people, positions, layout, rowCount);
  const nodes: Node[] = [];
  const positionById = new Map<string, DiagramPersonPosition>();
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const measured = { width: layout.nodeWidth, height: layout.nodeHeight };
  const handles = makeHandles(layout.nodeWidth, layout.nodeHeight);

  for (const [id, position] of positions) {
    const person = peopleById.get(id)!;
    const x = position.x;
    const y = routes.rowOffsets[position.row];
    const ariaLabel = buildPersonAriaLabel(person);
    positionById.set(id, { id: position.id, x, y });
    nodes.push({
      id: position.id,
      type: "familyTree",
      position: { x, y },
      ...measured,
      measured,
      handles,
      data: {
        ariaLabel,
        birthPlace: person.birthPlace,
        compact: layout.compact,
        displayLabel: getLegalName(person),
        label: getPersonDisplayName(person),
        personId: person.id,
        photo: parseMediaAssetReference(person.photo) ? null : person.photo,
        profession: person.profession,
        secondaryLabel: getLifeSpanLabel(person).replace(" - ", "–"),
        sex: person.sex,
      } satisfies FamilyTreeNodeData,
      ariaLabel,
      draggable: false,
      focusable: false,
      selectable: false,
    });
  }
  for (const node of routes.nodes) {
    nodes.push(node);
  }

  return {
    bounds: {
      x: routes.leftBound,
      y: 0,
      width: Math.max(graphWidth, routes.rightBound) - routes.leftBound,
      height: routes.bottom,
    },
    edges: routes.edges,
    nodes,
    positionById,
    totalGenerations: rowCount,
  };
}

export function TreeDiagramView({
  people,
  photoUrls,
  query,
  selectedPersonId,
  initialPersonId = null,
  onSelectPerson,
}: TreeDiagramViewProps) {
  const isCompactLayout = useSyncExternalStore(subscribeToCompactLayout, isCompactScreen, () => false);
  const layout = isCompactLayout ? COMPACT_LAYOUT : WIDE_LAYOUT;
  const canvasRef = useRef<HTMLDivElement>(null);
  const openingPersonId = useRef(initialPersonId);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [focusedBranchId, setFocusedBranchId] = useState<string | null>(null);
  const { bounds, edges, nodes, positionById, totalGenerations } = useMemo(
    () => buildTreeDiagram(people, layout),
    [layout, people],
  );

  const normalizedQuery = query.trim().toLowerCase();
  const highlightedIds = useMemo(
    () => normalizedQuery
      ? new Set(people.filter((person) => matchesPersonQuery(person, normalizedQuery)).map(({ id }) => id))
      : EMPTY_IDS,
    [normalizedQuery, people],
  );
  const onSelectBranch = useCallback((branchId: string) => {
    setActiveBranchId((current) => current === branchId ? null : branchId);
  }, []);
  const interaction = useMemo(
    () => ({
      activeBranchId, highlightedBranchId: focusedBranchId ?? activeBranchId, highlightedIds,
      onFocusBranch: setFocusedBranchId, onSelectBranch, onSelectPerson, photoUrls, selectedPersonId,
    }),
    [activeBranchId, focusedBranchId, highlightedIds, onSelectBranch, onSelectPerson, photoUrls, selectedPersonId],
  );
  const handleSelectNode = useCallback((_: unknown, node: Node) => {
    if (node.type === "familyTree") {
      onSelectPerson((node.data as FamilyTreeNodeData).personId);
    }
  }, [onSelectPerson]);

  const fitViewPadding = isCompactLayout ? COMPACT_PADDING : WIDE_PADDING;
  const minZoom = nodes.length > 500 ? 0.24 : 0.04;
  const fitDiagram = useCallback((flow: ReactFlowInstance, opening = false) => {
    const canvas = canvasRef.current;
    const firstNode = nodes[0];
    if (!canvas || !firstNode) {
      return;
    }

    const { clientWidth, clientHeight } = canvas;
    const viewport = getViewportForBounds(
      bounds, clientWidth, clientHeight, minZoom, 1.05, fitViewPadding,
    );
    if (opening && viewport.zoom < READING_ZOOM) {
      // Start where a family can be read at its natural text size. The separate
      // Fit control always requests the overview, including the peripheral branches.
      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.height / 2;
      let nearest = firstNode;
      let best = Infinity;
      for (const node of nodes) {
        if (node.type !== "familyTree") continue;
        const distance = Math.hypot(node.position.x + layout.nodeWidth / 2 - centerX,
          node.position.y + layout.nodeHeight / 2 - centerY);
        if (distance < best) { best = distance; nearest = node; }
      }
      void flow.setCenter(nearest.position.x + layout.nodeWidth / 2,
        nearest.position.y + layout.nodeHeight / 2, { zoom: READING_ZOOM });
    } else {
      void flow.setViewport(viewport);
    }
  }, [bounds, fitViewPadding, layout, minZoom, nodes]);

  const handleInit = useCallback((flow: ReactFlowInstance) => {
    setFlowInstance(flow);
    const target = openingPersonId.current && positionById.get(openingPersonId.current);
    openingPersonId.current = null;
    if (target) {
      void flow.setCenter(target.x + layout.nodeWidth / 2, target.y + layout.nodeHeight / 2, { zoom: READING_ZOOM });
    } else {
      fitDiagram(flow, true);
    }
  }, [fitDiagram, layout, positionById]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!flowInstance || !canvas || highlightedIds.size === 0) {
      return;
    }

    const { x, y, zoom } = flowInstance.getViewport();
    const exact = people.find(person => getPersonDisplayName(person).toLowerCase() === normalizedQuery
      || getLegalName(person).toLowerCase() === normalizedQuery);
    const matches = exact ? [exact.id] : highlightedIds;
    let firstMatch: DiagramPersonPosition | undefined;
    for (const id of matches) {
      const position = positionById.get(id);
      if (!position) continue;
      firstMatch ??= position;
      const left = position.x * zoom + x;
      const top = position.y * zoom + y;
      if (zoom >= READING_ZOOM && left >= 0 && left + layout.nodeWidth * zoom <= canvas.clientWidth &&
          top >= 0 && top + layout.nodeHeight * zoom <= canvas.clientHeight) return;
    }
    if (firstMatch) {
      void flowInstance.setCenter(firstMatch.x + layout.nodeWidth / 2,
        firstMatch.y + layout.nodeHeight / 2, { zoom: Math.max(zoom, READING_ZOOM) });
    }
  }, [flowInstance, highlightedIds, layout, normalizedQuery, people, positionById]);

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
            Genitori in alto, figli in basso
          </span>
          <span className="inline-flex items-center gap-2 whitespace-nowrap">
            <span
              aria-hidden="true"
              className="h-0 w-9 border-t-2 border-dashed border-[#c8791a]"
            />
            Relazione di coppia
          </span>
          {people.some(person => person.siblingIds?.length) ? (
            <span className="inline-flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden="true" className="w-8 border-t-2 border-dotted border-[#176879]" />
              Fratelli e sorelle
            </span>
          ) : null}
        </div>
        <p className="hidden whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.12em] text-[#66746b] sm:block">
          {people.length} persone · {totalGenerations} generazioni
        </p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#fbfaf7]" ref={canvasRef}>
        <FamilyTreeNodeContext.Provider value={interaction}>
          <ReactFlow
            key={isCompactLayout ? "compact" : "wide"}
            aria-label="Albero genealogico. Usa i controlli per adattare, ingrandire o ridurre la vista."
            ariaLabelConfig={ARIA_LABELS}
            colorMode="light"
          edgeTypes={familyEdgeTypes}
            edges={edges}
            edgesFocusable={false}
            elementsSelectable={false}
            maxZoom={1.45}
            minZoom={minZoom}
            nodeTypes={familyNodeTypes}
            nodes={nodes}
            nodesConnectable={false}
            nodesDraggable={false}
            nodesFocusable={false}
            onInit={handleInit}
            onNodeClick={handleSelectNode}
            onlyRenderVisibleElements
            panOnDrag
            proOptions={PRO_OPTIONS}
            zoomOnDoubleClick={false}
          >
            <Background color="#d7ded7" gap={28} size={1} />
            <MiniMap
              ariaLabel="Minimappa del diagramma genealogico"
              className="!right-3 !bottom-3 !m-0 !h-20 !w-28 !rounded-xl !border !border-[#ccd5cc] !bg-white/95 !shadow-[0_8px_24px_rgba(20,53,36,0.1)] sm:!h-28 sm:!w-44"
              maskColor="rgba(23, 69, 45, 0.09)"
              nodeBorderRadius={8}
            nodeColor={(node) => (node.type === "familyTree" ? "#7fa08a" : "transparent")}
              nodeStrokeColor={(node) =>
              node.type === "familyTree" ? "#17452d" : "transparent"
              }
              nodeStrokeWidth={1.5}
              pannable
              position="bottom-right"
              zoomable
            />
            <Controls
              aria-label="Controlli del diagramma"
              className="!m-3 !overflow-hidden !rounded-xl !border !border-[#ccd5cc] !bg-white !shadow-[0_8px_24px_rgba(20,53,36,0.12)] [&>button]:!h-11 [&>button]:!w-11 [&>button]:!border-[#dce2dc] [&>button]:!bg-white [&>button]:!text-[#173c28] [&>button:hover]:!bg-[#f0f5ef] [&>button:focus-visible]:!relative [&>button:focus-visible]:!z-10 [&>button:focus-visible]:!outline-2 [&>button:focus-visible]:!outline-offset-[-3px] [&>button:focus-visible]:!outline-[#17452d]"
              orientation="vertical"
              position="bottom-left"
            showFitView={false}
              showInteractive={false}
          >
            <ControlButton
              aria-label={ARIA_LABELS["controls.fitView.ariaLabel"]}
              className="react-flow__controls-fitview"
              onClick={() => flowInstance && fitDiagram(flowInstance)}
              title={ARIA_LABELS["controls.fitView.ariaLabel"]}
            >
              <svg aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                <path d="M2 7V2h5m6 0h5v5m0 6v5h-5m-6 0H2v-5" />
              </svg>
            </ControlButton>
          </Controls>
          </ReactFlow>
        </FamilyTreeNodeContext.Provider>

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
