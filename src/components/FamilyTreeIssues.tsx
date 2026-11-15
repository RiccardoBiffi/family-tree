"use client";

import { useId } from "react";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { PersonRecord } from "@/models/Person";
import { getPersonDisplayName, type FamilyTreeIssue } from "@/utils/familyTree";

interface FamilyTreeIssuesProps {
  issues: readonly FamilyTreeIssue[];
  peopleById: ReadonlyMap<string, PersonRecord>;
  onClose: () => void;
  onSelectPerson: (personId: string) => void;
}

export function FamilyTreeIssues({
  issues,
  peopleById,
  onClose,
  onSelectPerson,
}: FamilyTreeIssuesProps) {
  const titleId = useId();
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#06150d]/50 p-3 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[85dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-2xl border border-[#d7ded8] bg-white text-[#152019] shadow-xl outline-none"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#d7ded8] bg-white px-4 py-2 sm:px-6">
          <h2 className="text-xl font-semibold" id={titleId}>Controlli di coerenza</h2>
          <button
            aria-label="Chiudi dettagli dei controlli"
            className="min-h-11 min-w-11 rounded-lg text-2xl hover:bg-[#f4f7f4] focus-visible:outline-2"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="divide-y divide-[#d7ded8] px-4 sm:px-6">
          {issues.map((issue) => (
            <section className="py-4" key={issue.id}>
              <h3 className="font-semibold">{issue.title}</h3>
              <p className="mt-1 text-sm text-[#45554b]">{issue.message}</p>
              {issue.personIds.length > 0 ? (
                <ul className="mt-2 list-none">
                  {issue.personIds.map((id) => {
                    const person = peopleById.get(id);
                    return person ? (
                      <li key={id}>
                        <button
                          className="min-h-11 max-w-full rounded px-1 text-left font-medium text-[#0c3b24] underline underline-offset-2 [overflow-wrap:anywhere] hover:bg-[#f4f7f4] focus-visible:outline-2"
                          onClick={() => onSelectPerson(id)}
                          type="button"
                        >
                          {getPersonDisplayName(person)}
                          {issue.id === "diagram-parents" ? (
                            <span className="ml-2 inline-block text-sm font-normal">
                              ({person.parentIds.length} genitori)
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
