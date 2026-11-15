"use client";
/* eslint-disable @next/next/no-img-element */

import { BaseEdge, Handle, Position, type EdgeProps, type NodeProps } from "@xyflow/react";
import { createContext, useContext } from "react";

import { PersonGlyph } from "@/components/PersonGlyph";
import type { PersonSex } from "@/models/Person";

export interface FamilyTreeNodeData extends Record<string, unknown> {
  ariaLabel: string;
  birthPlace: string | null;
  compact: boolean;
  displayLabel: string;
  label: string;
  personId: string;
  photo: string | null;
  profession: string | null;
  secondaryLabel: string;
  sex: PersonSex;
}

export const FamilyTreeNodeContext = createContext<{
  activeBranchId?: string | null;
  highlightedBranchId?: string | null;
  highlightedIds: ReadonlySet<string>;
  onFocusBranch?: (branchId: string | null) => void;
  onSelectBranch?: (branchId: string) => void;
  onSelectPerson: (personId: string) => void;
  photoUrls?: ReadonlyMap<string, string>;
  selectedPersonId: string | null;
} | null>(null);

export interface FamilyJunctionNodeData extends Record<string, unknown> {
  branchId: string;
  color: string;
  label: string;
  title: string;
}

export interface FamilyRouteEdgeData extends Record<string, unknown> {
  branchId: string;
  path: string;
}

export interface FamilyTimelineNodeData extends Record<string, unknown> {
  label: string;
  secondaryLabel: string;
  spanLabel: string;
  barWidth: number;
  highlighted: boolean;
}

function PersonAvatar({
  compact,
  photo,
  sex,
}: {
  compact: boolean;
  photo: string | null;
  sex: PersonSex;
}) {
  if (photo) {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={[
          "shrink-0 rounded-full border border-[#aab7a9] object-cover",
          compact ? "h-8 w-8" : "h-11 w-11",
        ].join(" ")}
        decoding="async"
        src={photo}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={[
        "flex shrink-0 items-center justify-center rounded-full border border-[#aab7a9] bg-[#eef2e8] font-bold tracking-[0.08em] text-[#17452d]",
        compact ? "h-8 w-8 text-[9px]" : "h-11 w-11 text-xs",
      ].join(" ")}
    >
      <PersonGlyph
        className={compact ? "h-[18px] w-[18px]" : "h-6 w-6"}
        sex={sex}
      />
    </span>
  );
}

export function FamilyTreeNode({ data }: NodeProps) {
  const nodeData = data as unknown as FamilyTreeNodeData;
  const interaction = useContext(FamilyTreeNodeContext);
  const selected = interaction?.selectedPersonId === nodeData.personId;
  const highlighted = interaction?.highlightedIds.has(nodeData.personId);

  return (
    <>
      <Handle
        className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        id="top"
        position={Position.Top}
        type="target"
      />
      <Handle
        className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        id="left"
        position={Position.Left}
        type="target"
      />
      <button
        aria-label={nodeData.ariaLabel}
        className={[
          "nodrag nopan flex h-full w-full overflow-hidden rounded-xl border shadow-[0_6px_18px_rgba(20,53,36,0.08)]",
          nodeData.compact
            ? "flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-center"
            : "items-center gap-3 px-3 py-2.5 text-left",
          "transition-[border-color,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#17452d]/35 motion-reduce:transition-none",
          selected
            ? "border-2 border-[#17452d] bg-[#f1f6ef] shadow-[0_0_0_3px_rgba(23,69,45,0.18),0_8px_22px_rgba(20,53,36,0.1)]"
            : highlighted
            ? "border-2 border-[#c8791a] bg-[#fff0d6] hover:bg-[#ffe8c0] shadow-[0_0_0_3px_rgba(200,121,26,0.18),0_8px_22px_rgba(20,53,36,0.1)]"
            : "border-[#315a40] bg-white hover:border-[#6d8d76] hover:bg-[#fdfefb]",
        ].join(" ")}
        data-query-match={highlighted ? "true" : undefined}
        data-selected={selected ? "true" : undefined}
        onClick={(event) => {
          event.stopPropagation();
          interaction?.onSelectPerson(nodeData.personId);
        }}
        title={nodeData.ariaLabel}
        type="button"
      >
        <PersonAvatar
          compact={nodeData.compact}
          photo={interaction?.photoUrls?.get(nodeData.personId) ?? nodeData.photo}
          sex={nodeData.sex}
        />
        <span className="min-w-0 flex-1">
          <span
            className={[
              "block font-bold text-[#101712]",
              nodeData.compact
                ? "line-clamp-2 text-[11px] leading-[13px]"
                : "truncate text-[15px] leading-5",
            ].join(" ")}
          >
            {nodeData.displayLabel}
          </span>
          <span
            className={[
              "block text-[#354239]",
              nodeData.compact
                ? "truncate text-[9px] leading-3"
                : "truncate text-[11px] leading-4",
            ].join(" ")}
          >
            {nodeData.secondaryLabel}
          </span>
          {nodeData.profession ? (
            <span
              className={[
                "block text-[#28342c]",
                nodeData.compact
                  ? "line-clamp-2 text-[9px] leading-[11px]"
                  : "truncate text-xs leading-4",
              ].join(" ")}
            >
              {nodeData.profession}
            </span>
          ) : null}
          {nodeData.birthPlace ? (
            <span
              className={[
                "block truncate text-[#4b584f]",
                nodeData.compact
                  ? "text-[9px] leading-[11px]"
                  : "text-[11px] leading-4",
              ].join(" ")}
            >
              {nodeData.birthPlace}
            </span>
          ) : null}
        </span>
      </button>
      <Handle
        className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        id="bottom"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="!h-1 !w-1 !border-0 !bg-transparent !opacity-0"
        id="right"
        position={Position.Right}
        type="source"
      />
    </>
  );
}

export function FamilyJunctionNode({ data }: NodeProps) {
  const branch = data as FamilyJunctionNodeData;
  const interaction = useContext(FamilyTreeNodeContext);
  const pressed = interaction?.activeBranchId === branch.branchId;
  const highlighted = interaction?.highlightedBranchId === branch.branchId;
  return (
    <>
      <FamilyVerticalHandles />
      <button
        aria-label={branch.title}
        aria-pressed={pressed}
        className="nodrag nopan flex h-full w-full items-center justify-center gap-1 rounded-md border bg-white px-1 text-[11px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-current"
        data-family-branch={branch.branchId}
        onBlur={() => interaction?.onFocusBranch?.(null)}
        onClick={() => interaction?.onSelectBranch?.(branch.branchId)}
        onFocus={() => interaction?.onFocusBranch?.(branch.branchId)}
        style={{ color: branch.color, background: highlighted ? "#eef4ee" : undefined }}
        title={branch.title}
        type="button"
      >
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />
        <span className="truncate">{branch.label}</span>
      </button>
    </>
  );
}

export function FamilyRouteEdge({ data, id, style }: EdgeProps) {
  const interaction = useContext(FamilyTreeNodeContext);
  const route = data as FamilyRouteEdgeData | undefined;
  if (!route) {
    return null;
  }
  const active = interaction?.highlightedBranchId === route.branchId;
  return (
    <BaseEdge
      id={id}
      interactionWidth={0}
      path={route.path}
      style={active ? { ...style, strokeWidth: 4 } : style}
    />
  );
}

function FamilyVerticalHandles() {
  return (
    <>
      <Handle className="!h-px !w-px !border-0 !opacity-0" id="top" position={Position.Top} type="target" />
      <Handle className="!h-px !w-px !border-0 !opacity-0" id="bottom" position={Position.Bottom} type="source" />
    </>
  );
}

export function FamilyTimelineNode({ data }: NodeProps) {
  const nodeData = data as unknown as FamilyTimelineNodeData;

  return (
    <div
      className={[
        "rounded-[22px] border bg-[#fffaf1] p-3 shadow-[0_18px_60px_rgba(15,23,42,0.12)] transition",
        nodeData.highlighted
          ? "border-[#d1a04f] ring-4 ring-[#d1a04f]/20"
          : "border-[#d9cfbd] hover:border-[#8ea684]",
      ].join(" ")}
      style={{ width: nodeData.barWidth }}
    >
      <Handle
        className="!h-3 !w-3 !border-2 !border-[#153524] !bg-[#fffaf1]"
        id="left"
        position={Position.Left}
        type="target"
      />
      <div className="rounded-2xl bg-[linear-gradient(90deg,#153524_0%,#2f6b47_55%,#d9b56d_100%)] px-3 py-3 text-white">
        <p className="truncate text-sm font-semibold">{nodeData.label}</p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/80">
          {nodeData.secondaryLabel}
        </p>
      </div>
      <p className="mt-2 text-xs text-slate-600">{nodeData.spanLabel}</p>
      <Handle
        className="!h-3 !w-3 !border-2 !border-[#153524] !bg-[#fffaf1]"
        id="right"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

export const familyNodeTypes = {
  familyFork: FamilyVerticalHandles,
  familyJunction: FamilyJunctionNode,
  familyTimeline: FamilyTimelineNode,
  familyTree: FamilyTreeNode,
};

export const familyEdgeTypes = { familyRoute: FamilyRouteEdge };
