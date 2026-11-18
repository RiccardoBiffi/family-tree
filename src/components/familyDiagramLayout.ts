import type { PersonRecord } from "@/models/Person";
import { computeDiagramGenerationMap, getDiagramParentIds } from "@/utils/familyTree";
import type { DiagramPosition } from "@/components/familyDiagramRoutes";

export interface DiagramLayout {
  compact: boolean;
  generationGap: number;
  nodeHeight: number;
  nodeWidth: number;
}

export const WIDE_LAYOUT: DiagramLayout = {
  compact: false, generationGap: 150, nodeHeight: 82, nodeWidth: 176,
};

export const COMPACT_LAYOUT: DiagramLayout = {
  compact: true, generationGap: 150, nodeHeight: 86, nodeWidth: 128,
};

// Order both screen sizes in the same units, then scale to the actual card width.
const CARD = 128;
const WITHIN_FAMILY = 10;
const BETWEEN_FAMILIES = 24;

type Relative = { id: string; step: number };

function buildKinshipGraph(people: PersonRecord[]) {
  const graph = new Map(people.map(({ id }) => [id, [] as Relative[]]));
  const connect = (from: string, to: string, step: number) => {
    if (from === to || !graph.has(from) || !graph.has(to)) return;
    graph.get(from)!.push({ id: to, step });
    graph.get(to)!.push({ id: from, step: -step });
  };
  const lateral = new Map(people.map(({ id }) => [id, new Set<string>()]));
  const join = (a: string, b: string) => {
    if (a === b || !lateral.has(a) || !lateral.has(b) || lateral.get(a)!.has(b)) return;
    lateral.get(a)!.add(b);
    lateral.get(b)!.add(a);
    connect(a, b, 0);
  };
  for (const person of people) {
    const parents = getDiagramParentIds(person);
    for (const parent of parents) connect(parent, person.id, 1);
    if (parents.length === 2) join(parents[0], parents[1]);
    for (const other of [...person.partnerIds, ...(person.siblingIds ?? [])]) join(person.id, other);
  }
  return { graph, lateral };
}

// A spouse or co-parent can enter the family several generations after its oldest ancestor.
// Solve the relative levels in both directions before assigning an absolute row.
function assignGenerations(people: PersonRecord[], graph: Map<string, Relative[]>) {
  const ranks = new Map<string, number>();
  let fallback: Map<string, number> | undefined;
  for (const { id } of people) {
    if (ranks.has(id)) continue;
    ranks.set(id, 0);
    const members = [id];
    let minRank = 0;
    let consistent = true;
    for (let index = 0; index < members.length; index++) {
      const current = ranks.get(members[index])!;
      for (const relation of graph.get(members[index])!) {
        const rank = current + relation.step;
        if (ranks.has(relation.id)) {
          if (ranks.get(relation.id) !== rank) consistent = false;
        } else {
          ranks.set(relation.id, rank);
          minRank = Math.min(minRank, rank);
          members.push(relation.id);
        }
      }
    }
    if (!consistent) fallback ??= computeDiagramGenerationMap(people);
    for (const member of members) {
      ranks.set(member, consistent ? ranks.get(member)! - minRank : fallback!.get(member)!);
    }
  }
  return ranks;
}

interface Household {
  members: string[];
  width: number;
  target: number;
  weight: number;
}

function orderHousehold(ids: string[], lateral: Map<string, Set<string>>): string[] {
  if (ids.length <= 2) return ids;
  // Start at the end of the chain, so a person linking a sibling group and a co-parent
  // stays next to both whenever the local graph admits a linear arrangement.
  const pending = new Set([...ids].sort((a, b) => lateral.get(a)!.size - lateral.get(b)!.size));
  const ordered: string[] = [];
  let next: string | undefined;
  while (pending.size) {
    const id: string = next ?? pending.values().next().value!;
    pending.delete(id);
    ordered.push(id);
    next = undefined;
    for (const neighbor of lateral.get(id)!) {
      if (pending.has(neighbor)) { next = neighbor; break; }
    }
  }
  return ordered;
}

function packRow(row: Household[], centers: Map<string, number>) {
  // Isotonic regression places each household as close as possible to its connected
  // relatives subject to the minimum separation from the previous household.
  const pools: { start: number; end: number; moment: number; weight: number }[] = [];
  let cursor = 0;
  for (let i = 0; i < row.length; i++) {
    const block = row[i];
    const weight = block.weight;
    const pool = { start: i, end: i, moment: (block.target - cursor - block.width / 2) * weight, weight };
    while (pools.length) {
      const last = pools[pools.length - 1];
      if (last.moment / last.weight <= pool.moment / pool.weight) break;
      pools.pop();
      pool.start = last.start;
      pool.weight += last.weight;
      pool.moment += last.moment;
    }
    pools.push(pool);
    cursor += block.width + BETWEEN_FAMILIES;
  }
  cursor = 0;
  for (const pool of pools) {
    const shift = pool.moment / pool.weight;
    for (let i = pool.start; i <= pool.end; i++) {
      const block = row[i];
      for (const [index, id] of block.members.entries()) {
        centers.set(id, cursor + shift + CARD / 2 + index * (CARD + WITHIN_FAMILY));
      }
      cursor += block.width + BETWEEN_FAMILIES;
    }
  }
}

export function layoutFamilyPeople(people: PersonRecord[], layout: DiagramLayout) {
  const { graph, lateral } = buildKinshipGraph(people);
  const ranks = assignGenerations(people, graph);
  // Place children of the same parents together without adding sibling relationships
  // to the data. A chain keeps even very large sibling sets linear in memory.
  const siblingSets = new Map<string, string[]>();
  for (const person of people) {
    const parents = getDiagramParentIds(person);
    if (!parents.length) continue;
    const key = JSON.stringify([ranks.get(person.id), ...[...parents].sort()]);
    const members = siblingSets.get(key) ?? [];
    members.push(person.id);
    siblingSets.set(key, members);
  }
  for (const members of siblingSets.values()) {
    const ordered = [...members].sort((a, b) => lateral.get(b)!.size - lateral.get(a)!.size);
    // Adults who connect to another household go on the outside of their sibling set.
    if (ordered.length > 2) ordered.push(ordered.splice(1, 1)[0]);
    for (let i = 1; i < ordered.length; i++) {
      lateral.get(ordered[i - 1])!.add(ordered[i]);
      lateral.get(ordered[i])!.add(ordered[i - 1]);
    }
  }
  // Conflicting multi-generation relationships can leave unused ranks in the fallback.
  const levels = [...new Set(ranks.values())].sort((a, b) => a - b);
  const rowFor = new Map(levels.map((level, index) => [level, index]));
  for (const [id, level] of ranks) ranks.set(id, rowFor.get(level)!);
  const rows: Household[][] = [];
  const visited = new Set<string>();
  for (const { id } of people) {
    if (visited.has(id)) continue;
    const rank = ranks.get(id)!;
    const group = [id];
    visited.add(id);
    for (let i = 0; i < group.length; i++) {
      for (const other of lateral.get(group[i])!) {
        if (visited.has(other) || ranks.get(other) !== rank) continue;
        visited.add(other);
        group.push(other);
      }
    }
    const members = orderHousehold(group, lateral);
    (rows[rank] ??= []).push({
      members, width: members.length * (CARD + WITHIN_FAMILY) - WITHIN_FAMILY,
      target: 0, weight: 1,
    });
  }

  const centers = new Map<string, number>();
  for (const row of rows) packRow(row, centers);
  // Alternate parent and child sweeps. A household can turn around as a unit to
  // keep the incoming branches on their respective sides.
  for (let pass = 0; pass < 8; pass++) {
    const topDown = pass % 2 === 0;
    for (let i = 0; i < rows.length; i++) {
      const rank = topDown ? i : rows.length - 1 - i;
      const row = rows[rank];
      for (const block of row) {
        let sum = 0;
        let total = 0;
        let alignment = 0;
        const mid = (block.members.length - 1) / 2;
        const anchors: { slot: number; center: number }[] = [];
        for (const [slot, id] of block.members.entries()) {
          for (const { id: other } of graph.get(id)!) {
            if (topDown ? ranks.get(other)! >= rank : ranks.get(other)! <= rank) continue;
            const x = centers.get(other)!;
            sum += x;
            total++;
            anchors.push({ slot, center: x });
          }
        }
        if (total) {
          const mean = sum / total;
          for (const {slot, center} of anchors) alignment += (slot - mid) * (center - mean);
          const reverse = alignment < 0;
          if (reverse) block.members.reverse();
          const pitch = CARD + WITHIN_FAMILY;
          for (const { slot } of anchors) sum -= (reverse ? mid - slot : slot - mid) * pitch;
          block.target = sum / total;
          block.weight = total;
        } else {
          block.target = (centers.get(block.members[0])! + centers.get(block.members.at(-1)!)!) / 2;
          block.weight = 0.25;
        }
      }
      row.sort((a, b) => a.target - b.target);
      packRow(row, centers);
    }
  }

  let minimum = 0;
  for (const x of centers.values()) minimum = Math.min(minimum, x - CARD / 2);
  let width = 0;
  const positions = new Map<string, DiagramPosition>();
  for (const { id } of people) {
    const x = Math.round((centers.get(id)! - CARD / 2 - minimum) * layout.nodeWidth / CARD);
    width = Math.max(width, x + layout.nodeWidth);
    positions.set(id, { id: `person-${encodeURIComponent(JSON.stringify(id))}`, row: ranks.get(id)!, x });
  }
  return { positions, graphWidth: width, rowCount: rows.length };
}
