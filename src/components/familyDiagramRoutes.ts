import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import type { FamilyJunctionNodeData, FamilyRouteEdgeData } from "@/components/FamilyFlowNodes";
import type { PersonRecord } from "@/models/Person";
import { getDiagramParentIds, getPersonDisplayName } from "@/utils/familyTree";

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

function getSiblingGroups(people: PersonRecord[], positions: Map<string, DiagramPosition>): string[][] {
  const neighbors = new Map<string, Set<string>>();
  for (const person of people) {
    for (const sibling of person.siblingIds ?? []) {
      if (person.id === sibling || !positions.has(sibling)) continue;
      const own = neighbors.get(person.id) ?? new Set<string>();
      const other = neighbors.get(sibling) ?? new Set<string>();
      own.add(sibling);
      other.add(person.id);
      neighbors.set(person.id, own);
      neighbors.set(sibling, other);
    }
  }
  const groups: string[][] = [];
  const visited = new Set<string>();
  for (const id of neighbors.keys()) {
    if (visited.has(id)) continue;
    const group = [id];
    visited.add(id);
    for (let i = 0; i < group.length; i++) {
      for (const sibling of neighbors.get(group[i])!) {
        if (!visited.has(sibling)) { group.push(sibling); visited.add(sibling); }
      }
    }
    if (group.every(member => neighbors.get(member)!.size === group.length - 1)) {
      groups.push(group);
    } else {
      // Two half-siblings of one person need not be siblings of each other.
      for (const member of group) {
        for (const sibling of neighbors.get(member)!) {
          if (member < sibling) groups.push([member, sibling]);
        }
      }
    }
  }
  return groups;
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

function reserveLanes(routes: { id: string; left: number; right: number; lane: number }[]): number {
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
  const markerWidth = 70;
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

  const siblingBands = Array.from({length: rowCount}, () =>
    [] as {id: string; members: string[]; left: number; right: number; lane: number}[],
  );
  for (const group of getSiblingGroups(people, positions)) {
    const row = group.reduce((first, id) => Math.min(first, positions.get(id)!.row), Infinity);
    const members = [...group].sort((a, b) => childCenter(a) - childCenter(b));
    const id = `siblings-${encodeURIComponent(JSON.stringify([...members].sort()))}`;
    siblingBands[row].push({
      id, members, left: childCenter(members[0]), right: childCenter(members[members.length - 1]), lane: 0,
    });
  }
  const cardsByRow = Array.from({length: rowCount}, () => [] as number[]);
  for (const position of positions.values()) cardsByRow[position.row].push(position.x);
  const rowOffsets: number[] = [];
  let y = 0;
  let bottom = 0;
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let leftBound = 0;
  let rightBound = 0;

  for (const [rank, routes] of routesByRow.entries()) {
    y += reserveLanes(siblingBands[rank]) * 28;
    rowOffsets.push(y);
    const lanes = reserveLanes(routes);
    const occupied = nodeHeight + (lanes ? TRACK_PADDING + lanes * TRACK_HEIGHT : 0);
    bottom = y + occupied;
    y += Math.max(occupied + TRACK_PADDING, generationGap);
  }

  const yFor = (id: string) => rowOffsets[positions.get(id)!.row];
  // Most edges lie entirely in the band between two consecutive generations.
  // For a rank-skipping edge use a clear vertical gutter across the intervening rows.
  function vertical(x: number, start: number, end: number, exitY = start, entryY = end): string {
    const top = Math.min(exitY, entryY);
    const bottom = Math.max(exitY, entryY);
    let lo = 0, hi = rowOffsets.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (rowOffsets[mid] + nodeHeight <= top) lo = mid + 1;
      else hi = mid;
    }
    if (lo === rowOffsets.length || rowOffsets[lo] >= bottom) return `V ${end}`;
    const occupied: number[] = [];
    for (let row = lo; row < rowCount && rowOffsets[row] < bottom; row++) {
      for (const left of cardsByRow[row]) occupied.push(left);
    }
    if (!occupied.some(left => x > left - 5 && x < left + nodeWidth + 5)) return `V ${end}`;
    occupied.sort((a, b) => a - b);
    let left = occupied[0] - 5;
    let right = occupied[0] + nodeWidth + 5;
    for (const edge of occupied) {
      if (edge - 5 > right) {
        if (left <= x && x <= right) break;
        left = edge - 5;
      }
      right = Math.max(right, edge + nodeWidth + 5);
    }
    const gutter = x - left < right - x ? left : right;
    leftBound = Math.min(leftBound, gutter);
    rightBound = Math.max(rightBound, gutter);
    return `V ${exitY} H ${gutter} V ${entryY} H ${x} V ${end}`;
  }
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
      markerEnd: name === "parent" || name.startsWith("child-")
        ? { type: MarkerType.ArrowClosed, width: 5, height: 5, color }
        : undefined,
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
          `M ${startX} ${yFor(parent) + nodeHeight} V ${trackY + 19} H ${targetX} ${vertical(targetX, trackY + 19, yFor(child), trackY + 19, yFor(child) - 4)}`,
          SINGLE_PARENT_COLOR);
        return;
      }

      const markerY = trackY + 15;
      const railY = trackY + 46;
      const { markerX } = route;
      const color = BRANCH_COLORS[index % BRANCH_COLORS.length];
      const parentNames = route.parents.map(id => getPersonDisplayName(byId.get(id)!));
      const label = route.children.length
        ? `${route.children.length} ${route.children.length === 1 ? "figlio" : "figli"}`
        : "Partner";
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
          label,
          title: `${parentNames.join(" e ")} · ${label}`,
        } satisfies FamilyJunctionNodeData,
      });
      // The two parent feeds have their own heights even when their projections overlap.
      route.parents.forEach((parent, parentIndex) => {
        const parentX = route.parentXs[parentIndex];
        const incomingX = markerX + (parentX < route.parentXs[1 - parentIndex] ? -markerWidth / 4 : markerWidth / 4);
        const fromY = yFor(parent) + nodeHeight;
        const incomingY = trackY + (parentIndex === 0 ? 2 : 9);
        edge(route, `feed-${parentIndex}`, positions.get(parent)!.id, route.id,
          `M ${parentX} ${fromY} ${vertical(parentX, fromY, incomingY, fromY + 4)} H ${incomingX} V ${markerY}`,
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
        edge(route, `child-${childIndex}`, forkId, positions.get(child)!.id, `${begin} ${vertical(x, railY, yFor(child), railY, yFor(child) - 4)}`, color);
      });
    });
  }
  for (const [row, bands] of siblingBands.entries()) {
    for (const { id: branchId, lane, members: ordered } of bands) {
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const railY = rowOffsets[row] - 10 - lane * 28;
      const color = "#176879";
      for (let i = 1; i < ordered.length; i++) {
        const other = ordered[i];
        const x = childCenter(other);
        const start = i === 1
          ? `M ${childCenter(first)} ${yFor(first)} ${vertical(childCenter(first), yFor(first), railY, yFor(first) - 4)}`
          : `M ${childCenter(ordered[i - 1])} ${railY}`;
        const path = `${start} H ${x} ${vertical(x, railY, yFor(other), railY, yFor(other) - 4)}`;
        edges.push({
          id: `${branchId}-${i}`, type: "familyRoute",
          source: positions.get(first)!.id, target: positions.get(other)!.id,
          sourceHandle: "bottom", targetHandle: "top", focusable: false,
          style: {stroke: color, strokeWidth: 2.2, strokeDasharray: "2 4", strokeLinecap: "round"},
          data: {
            branchId, path,
            ...(i === 1 ? { annotation: {
              x: (childCenter(first) + childCenter(last)) / 2, y: railY - 4,
              label: "Fratelli e sorelle",
            } } : {}),
          } satisfies FamilyRouteEdgeData,
        });
      }
    }
  }
  return { bottom, edges, leftBound, nodes, rightBound, rowOffsets };
}
