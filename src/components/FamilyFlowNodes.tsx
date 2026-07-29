"use client";
/* eslint-disable @next/next/no-img-element */

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { PersonGlyph } from "@/components/PersonGlyph";
import type { PersonSex } from "@/models/Person";

export interface FamilyTreeNodeData extends Record<string, unknown> {
  ariaLabel: string;
  birthPlace: string | null;
  compact: boolean;
  displayLabel: string;
  highlighted: boolean;
  label: string;
  onSelect: () => void;
  photo: string | null;
  profession: string | null;
  secondaryLabel: string;
  sex: PersonSex;
}

export type FamilyJunctionNodeData = Record<string, never>;

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
          "nodrag nopan flex h-full w-full overflow-hidden rounded-xl border bg-white shadow-[0_6px_18px_rgba(20,53,36,0.08)]",
          nodeData.compact
            ? "flex-col items-center justify-center gap-1 px-1.5 py-1.5 text-center"
            : "items-center gap-3 px-3 py-2.5 text-left",
          "transition-[border-color,box-shadow,background-color] hover:border-[#6d8d76] hover:bg-[#fdfefb] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#17452d]/35 motion-reduce:transition-none",
          nodeData.highlighted
            ? "border-[#c8791a] bg-[#fffaf0] shadow-[0_0_0_3px_rgba(200,121,26,0.18),0_8px_22px_rgba(20,53,36,0.1)]"
            : "border-[#315a40]",
        ].join(" ")}
        data-query-match={nodeData.highlighted ? "true" : undefined}
        onClick={(event) => {
          event.stopPropagation();
          nodeData.onSelect();
        }}
        title={nodeData.ariaLabel}
        type="button"
      >
        <PersonAvatar
          compact={nodeData.compact}
          photo={nodeData.photo}
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

export function FamilyJunctionNode() {
  return (
    <span aria-hidden="true" className="block h-0.5 w-0.5">
      <Handle
        className="!h-px !w-px !border-0 !bg-transparent !opacity-0"
        id="left"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-px !w-px !border-0 !bg-transparent !opacity-0"
        id="right"
        position={Position.Right}
        type="source"
      />
      <Handle
        className="!h-px !w-px !border-0 !bg-transparent !opacity-0"
        id="bottom"
        position={Position.Bottom}
        type="source"
      />
    </span>
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
  familyJunction: FamilyJunctionNode,
  familyTimeline: FamilyTimelineNode,
  familyTree: FamilyTreeNode,
};
