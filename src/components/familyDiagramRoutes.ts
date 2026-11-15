import { Position, type Edge, type Node } from "@xyflow/react";

import type { FamilyJunctionNodeData, FamilyRouteEdgeData } from "@/components/FamilyFlowNodes";
import type { PersonRecord } from "@/models/Person";
import { getDiagramParentIds, getPersonDisplayName, getPersonShortName } from "@/utils/familyTree";

export interface DiagramPosition {
  id: string;
  row: number;
  x: number;
}

interface Relationship {
  id: string;
  parents: string[];
  children: string[];
  partners: boolean;
}

interface RoutedRelationship extends Relationship {
  parentXs: number[];
  childXs: number[];
  row: number;
  markerX: number;
  left: number;
  right: number;
  lane: number;
}

const JUNCTION_HEIGHT = 22;
const TRACK_HEIGHT = 51;
const TRACK_PADDING = 7;
const SINGLE_PARENT_COLOR = "#17452d";
const BRANCH_COLORS = ["#1f624d", "#664399", "#1c608a", "#984532", "#745916", "#a14976"];

export function getPartnerKey(left: string, right: string): string {
  return JSON.stringify(left <= right ? [left, right] : [right, left]);
}

export function getDiagramParentGroup(person: PersonRecord): string {
  const ids = getDiagramParentIds(person);
  if (ids.length === 2) {
    return getPartnerKey(ids[0], ids[1]);
  }
  return ids.length === 1 ? JSON.stringify(ids) : "";
}

function collectRelationships(people: PersonRecord[], positions: Map<string, DiagramPosition>) {
  const couples = new Map<string, Relationship>();
  const direct: Relationship[] = [];
  const getCouple = (left: string, right: string) => {
    const key = getPartnerKey(left, right);
    let pair = couples.get(key);
    if (!pair) {
      pair = {
        id: `family-${encodeURIComponent(key)}`,
        parents: left <= right ? [left, right] : [right, left],
        children: [],
        partners: false,
      };
      couples.set(key, pair);
    }
    return pair;
  };

  for (const person of people) {
    for (const partnerId of person.partnerIds) {
      if (partnerId !== person.id && positions.has(partnerId)) {
        getCouple(person.id, partnerId).partners = true;
      }
    }
    const parents = getDiagramParentIds(person).filter((id) => id !== person.id && positions.has(id));
    if (parents.length === 2) {
      getCouple(parents[0], parents[1]).children.push(person.id);
    } else if (parents.length === 1) {
      direct.push({
        id: `direct-${encodeURIComponent(JSON.stringify([parents[0], person.id]))}`,
        parents,
        children: [person.id],
        partners: false,
      });
    }
  }
  return [...couples.values(), ...direct];
}

function reserveLanes(routes: RoutedRelationship[]): number {
  routes.sort((a, b) => a.left - b.left || a.right - b.right || a.id.localeCompare(b.id));
  const ends: { lane: number; end: number }[] = [];

  // The earliest-ending lane can be reused if its previous route no longer occupies the band.
  for (const route of routes) {
    if (ends.length === 0 || ends[0].end + TRACK_PADDING >= route.left) {
      route.lane = ends.length;
      let child = ends.length;
      ends.push({ lane: route.lane, end: route.right });
      while (child > 0) {
        const parent = (child - 1) >> 1;
        if (ends[parent].end <= ends[child].end) {
          break;
        }
        [ends[parent], ends[child]] = [ends[child], ends[parent]];
        child = parent;
      }
      continue;
    }

    route.lane = ends[0].lane;
    ends[0].end = route.right;
    let parent = 0;
    while (parent * 2 + 1 < ends.length) {
      const left = parent * 2 + 1;
      const right = left + 1;
      const child = right < ends.length && ends[right].end < ends[left].end ? right : left;
      if (ends[parent].end <= ends[child].end) {
        break;
      }
      [ends[parent], ends[child]] = [ends[child], ends[parent]];
      parent = child;
    }
  }
  return ends.length;
}

function fixedHandles(width: number, height: number): NonNullable<Node["handles"]> {
  return [
    { id: "top", x: width / 2, y: 0, position: Position.Top, type: "target", width: 0, height: 0 },
    { id: "bottom", x: width / 2, y: height, position: Position.Bottom, type: "source", width: 0, height: 0 },
  ];
}

export function buildFamilyRoutes(
  people: PersonRecord[],
  positions: Map<string, DiagramPosition>,
  layout: { nodeWidth: number; nodeHeight: number; generationGap: number; compact: boolean },
  rowCount: number,
) {
  const byId = new Map(people.map((person) => [person.id, person]));
  const relationships = collectRelationships(people, positions);
  const { nodeWidth, nodeHeight, generationGap } = layout;
  const markerWidth = layout.compact ? 136 : 152;
  const outgoing = new Map<string, string[]>();
  for (const relation of relationships) {
    for (const parentId of relation.parents) {
      const siblings = outgoing.get(parentId) ?? [];
      siblings.push(relation.id);
      outgoing.set(parentId, siblings);
    }
  }
  const ports = new Map<string, Map<string, number>>();
  for (const [personId, relationIds] of outgoing) {
    const index = new Map<string, number>();
    const origin = positions.get(personId)!.x;
    relationIds.forEach((id, slot) => index.set(id, origin + nodeWidth * (slot + 1) / (relationIds.length + 1)));
    ports.set(personId, index);
  }

  const routesByRow: RoutedRelationship[][] = Array.from({ length: rowCount }, () => []);
  const childCenter = (id: string) => positions.get(id)!.x + nodeWidth / 2;
  for (const relationship of relationships) {
    const parentXs = relationship.parents.map((id) => ports.get(id)!.get(relationship.id)!);
    const childXs = relationship.children.map(childCenter);
    const row = Math.max(...relationship.parents.map((id) => positions.get(id)!.row));
    const joined = parentXs.length === 2;
    const markerX = joined ? (parentXs[0] + parentXs[1]) / 2 : parentXs[0];
    let left = markerX - (joined ? markerWidth / 2 : 0);
    let right = markerX + (joined ? markerWidth / 2 : 0);
    for (const x of [...parentXs, ...childXs]) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
    routesByRow[row].push({ ...relationship, row, parentXs, childXs, markerX, left, right, lane: 0 });
  }

  const rowOffsets: number[] = [];
  let y = 0;
  let bottom = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let leftBound = 0;
  let rightBound = 0;

  for (const routes of routesByRow) {
    rowOffsets.push(y);
    const lanes = reserveLanes(routes);
    const occupied = nodeHeight + (lanes ? TRACK_PADDING + lanes * TRACK_HEIGHT : 0);
    bottom = y + occupied;
    y += Math.max(occupied + TRACK_PADDING, generationGap);
  }

  const yFor = (id: string) => rowOffsets[positions.get(id)!.row];
  const edge = (
    route: RoutedRelationship,
    name: string,
    source: string,
    target: string,
    path: string,
    color: string,
    dashed = false,
  ) => {
    edges.push({
      id: `${route.id}-${name}`,
      type: "familyRoute",
      source,
      target,
      sourceHandle: "bottom",
      targetHandle: "top",
      style: { stroke: color, strokeWidth: 2.3, strokeDasharray: dashed ? "5 4" : undefined },
      data: { branchId: route.id, path } satisfies FamilyRouteEdgeData,
      focusable: false,
    });
  };
  const branchHandles = fixedHandles(markerWidth, JUNCTION_HEIGHT);
  const forkHandles = fixedHandles(1, 1);

  for (const routes of routesByRow) {
    routes.forEach((route, index) => {
      const trackY = rowOffsets[route.row] + nodeHeight + TRACK_PADDING + route.lane * TRACK_HEIGHT;
      if (route.parents.length === 1) {
        const [parent] = route.parents;
        const [child] = route.children;
        const [startX] = route.parentXs;
        const [targetX] = route.childXs;
        edge(route, "parent", positions.get(parent)!.id, positions.get(child)!.id,
          `M ${startX} ${yFor(parent) + nodeHeight} V ${trackY + 19} H ${targetX} V ${yFor(child)}`,
          SINGLE_PARENT_COLOR);
        return;
      }

      const markerY = trackY + 15;
      const railY = trackY + 46;
      const { markerX } = route;
      const color = BRANCH_COLORS[index % BRANCH_COLORS.length];
      const parentRecords = route.parents.map((id) => byId.get(id)!);
      const parentNames = parentRecords.map(getPersonDisplayName);
      const childLabel = route.children.length
        ? ` · ${route.children.length} ${route.children.length === 1 ? "figlio" : "figli"}`
        : "";
      const forkId = `${route.id}-fork`;
      const branchSize = { width: markerWidth, height: JUNCTION_HEIGHT };
      const markerLeft = markerX - markerWidth / 2;
      leftBound = Math.min(leftBound, markerLeft);
      rightBound = Math.max(rightBound, markerLeft + markerWidth);

      nodes.push({
        id: route.id,
        type: "familyJunction",
        position: { x: markerLeft, y: markerY },
        ...branchSize,
        measured: branchSize,
        handles: branchHandles,
        data: {
          branchId: route.id,
          color,
          label: parentRecords.map(getPersonShortName).join(" + "),
          title: `${parentNames.join(" e ")}${childLabel}`,
        } satisfies FamilyJunctionNodeData,
      });
      // The two parent feeds have their own heights even when their projections overlap.
      route.parents.forEach((parent, parentIndex) => {
        const parentX = route.parentXs[parentIndex];
        const incomingX = markerX + (parentIndex === 0 ? -markerWidth / 4 : markerWidth / 4);
        const fromY = yFor(parent) + nodeHeight;
        const incomingY = trackY + (parentIndex === 0 ? 2 : 9);
        edge(route, `feed-${parentIndex}`, positions.get(parent)!.id, route.id,
          `M ${parentX} ${fromY} V ${incomingY} H ${incomingX} V ${markerY}`,
          route.partners ? "#a66213" : color, route.partners);
      });

      if (route.children.length === 0) {
        return;
      }
      const forkSize = { width: 1, height: 1 };
      nodes.push({
        id: forkId,
        type: "familyFork",
        position: { x: markerX, y: railY },
        ...forkSize,
        measured: forkSize,
        handles: forkHandles,
        data: {},
      });
      edge(route, "stem", route.id, forkId, `M ${markerX} ${markerY + JUNCTION_HEIGHT} V ${railY}`, color);

      let leftChild = -1;
      let rightChild = -1;
      route.childXs.forEach((x, index) => {
        if (x < markerX && (leftChild < 0 || x < route.childXs[leftChild])) {
          leftChild = index;
        }
        if (x > markerX && (rightChild < 0 || x > route.childXs[rightChild])) {
          rightChild = index;
        }
      });
      route.children.forEach((child, childIndex) => {
        const x = route.childXs[childIndex];
        const begin = childIndex === leftChild || childIndex === rightChild
          ? `M ${markerX} ${railY} H ${x}`
          : `M ${x} ${railY}`;
        edge(route, `child-${childIndex}`, forkId, positions.get(child)!.id, `${begin} V ${yFor(child)}`, color);
      });
    });
  }
  return { bottom, edges, leftBound, nodes, rightBound, rowOffsets };
}
