"use client";
/* eslint-disable @next/next/no-img-element */

import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface FamilyTreeNodeData extends Record<string, unknown> {
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  photo: string | null;
  highlighted: boolean;
  tags: string[];
}

export interface FamilyTimelineNodeData extends Record<string, unknown> {
  label: string;
  secondaryLabel: string;
  spanLabel: string;
  barWidth: number;
  highlighted: boolean;
}

function InitialsAvatar({ label, photo }: { label: string; photo: string | null }) {
  if (photo) {
    return <img alt={label} className="h-12 w-12 rounded-2xl object-cover" src={photo} />;
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#153524] text-sm font-semibold text-white">
      {label
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </div>
  );
}

export function FamilyTreeNode({ data }: NodeProps) {
  const nodeData = data as unknown as FamilyTreeNodeData;

  return (
    <div
      className={[
        "w-64 rounded-[24px] border bg-[#fffaf1] p-4 shadow-[0_18px_60px_rgba(15,23,42,0.14)] transition",
        nodeData.highlighted
          ? "border-[#d1a04f] ring-4 ring-[#d1a04f]/20"
          : "border-[#d9cfbd] hover:border-[#8ea684]",
      ].join(" ")}
    >
      <Handle
        className="!h-3 !w-3 !border-2 !border-[#153524] !bg-[#fffaf1]"
        id="top"
        position={Position.Top}
        type="target"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-[#153524] !bg-[#fffaf1]"
        id="left"
        position={Position.Left}
        type="target"
      />
      <div className="flex items-start gap-3">
        <InitialsAvatar label={nodeData.label} photo={nodeData.photo} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-slate-900">{nodeData.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#5f6d63]">
            {nodeData.secondaryLabel}
          </p>
          <p className="mt-2 text-sm text-slate-600">{nodeData.tertiaryLabel}</p>
        </div>
      </div>
      {nodeData.tags.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {nodeData.tags.slice(0, 3).map((tag) => (
            <span
              className="rounded-full bg-[#153524]/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[#153524]"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
      <Handle
        className="!h-3 !w-3 !border-2 !border-[#153524] !bg-[#fffaf1]"
        id="bottom"
        position={Position.Bottom}
        type="source"
      />
      <Handle
        className="!h-3 !w-3 !border-2 !border-[#153524] !bg-[#fffaf1]"
        id="right"
        position={Position.Right}
        type="source"
      />
    </div>
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
  familyTimeline: FamilyTimelineNode,
  familyTree: FamilyTreeNode,
};
