"use client";

import { useId } from "react";

import { ArchiveIcon } from "@/components/ArchiveIcon";

interface ArchiveActionsProps {
  mode: "visitor" | "admin";
  query: string;
  onCreatePerson: () => void;
  onQueryChange: (value: string) => void;
  onResetDemoData: () => void;
}

export function ArchiveActions({
  mode,
  query,
  onCreatePerson,
  onQueryChange,
  onResetDemoData,
}: ArchiveActionsProps) {
  const isAdmin = mode === "admin";
  const searchInputId = useId();

  return (
    <div className={isAdmin ? "archive-actions archive-actions--admin" : "archive-actions"}>
      <label className="archive-search" htmlFor={searchInputId}>
        <span className="sr-only">Cerca una persona</span>
        <ArchiveIcon className="archive-search__icon" name="search" />
        <input
          aria-label="Cerca una persona"
          id={searchInputId}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Cerca una persona"
          type="search"
          value={query}
        />
      </label>

      {isAdmin ? (
        <div aria-label="Azioni archivio" className="archive-admin-toolbar" role="toolbar">
          <button onClick={onCreatePerson} type="button">
            <ArchiveIcon className="archive-action-icon" name="plus" />
            <span>Nuova persona</span>
          </button>
          <button onClick={onResetDemoData} type="button">
            <ArchiveIcon className="archive-action-icon" name="reset" />
            <span>Ripristina demo</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
