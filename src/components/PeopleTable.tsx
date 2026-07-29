"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnOrderState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import type { PersonRecord } from "@/models/Person";
import {
  formatDateLabel,
  getPartnersLabel,
  getPersonDisplayName,
  matchesPersonQuery,
} from "@/utils/familyTree";
import { PersonGlyph } from "@/components/PersonGlyph";

interface PeopleTableProps {
  people: PersonRecord[];
  query: string;
  onSelectPerson: (personId: string) => void;
}

const INITIAL_COLUMN_ORDER: ColumnOrderState = [
  "displayName",
  "birthDate",
  "birthPlace",
  "profession",
  "childrenCount",
  "parentsCount",
  "deathDate",
  "partners",
  "notes",
];

function countLabel(total: number): string {
  return total === 1 ? "1 persona" : `${total} persone`;
}

function getLegalName(person: PersonRecord): string {
  return (
    [person.name, person.surname].filter(Boolean).join(" ").trim() ||
    getPersonDisplayName(person)
  );
}

function formatTableDate(value: string | null): string {
  return formatDateLabel(value).replace(/^0/, "");
}

function PersonAvatar({ person }: { person: PersonRecord }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#b9c5b8] bg-[#edf2e9] text-[#0c3b24]"
    >
      <PersonGlyph className="h-5 w-5" sex={person.sex} />
    </span>
  );
}

function ColumnsIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
      <rect height="14" rx="2" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="5" />
      <path d="M9 5v14M15 5v14" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SortIcon({ direction }: { direction: false | "asc" | "desc" }) {
  if (!direction) {
    return null;
  }

  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 16 16" width="14">
      <path
        d={direction === "asc" ? "M8 13V3m0 0L4.5 6.5M8 3l3.5 3.5" : "M8 3v10m0 0 3.5-3.5M8 13 4.5 9.5"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MoveIcon({ direction }: { direction: "up" | "down" }) {
  return (
    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 16 16" width="16">
      <path
        d={direction === "up" ? "M8 12.5v-9m0 0L4.5 7M8 3.5 11.5 7" : "M8 3.5v9m0 0 3.5-3.5M8 12.5 4.5 9"}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function PeopleTable({ people, query, onSelectPerson }: PeopleTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "birthDate", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    deathDate: false,
    notes: false,
    parentsCount: false,
    partners: false,
  });
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);
  const [isColumnChooserOpen, setIsColumnChooserOpen] = useState(false);
  const columnChooserRef = useRef<HTMLDivElement>(null);
  const columnChooserButtonRef = useRef<HTMLButtonElement>(null);
  const deferredQuery = useDeferredValue(query);
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const filteredPeople = useMemo(
    () => people.filter((person) => matchesPersonQuery(person, deferredQuery)),
    [deferredQuery, people],
  );

  useEffect(() => {
    if (!isColumnChooserOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (
        target instanceof Node &&
        columnChooserRef.current &&
        !columnChooserRef.current.contains(target)
      ) {
        setIsColumnChooserOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      setIsColumnChooserOpen(false);
      columnChooserButtonRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isColumnChooserOpen]);

  const columns = useMemo<ColumnDef<PersonRecord>[]>(
    () => [
      {
        id: "displayName",
        enableHiding: false,
        header: "Persona",
        accessorFn: (row) => getLegalName(row),
        cell: ({ row }) => (
          <button
            className="group flex min-h-11 items-center gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
            onClick={() => onSelectPerson(row.original.id)}
            type="button"
          >
            <PersonAvatar person={row.original} />
            <span className="font-semibold text-[#152219] transition group-hover:text-[#0c3b24]">
              {getLegalName(row.original)}
            </span>
          </button>
        ),
        sortingFn: (rowA, rowB) =>
          getLegalName(rowA.original).localeCompare(
            getLegalName(rowB.original),
          ),
      },
      {
        accessorKey: "birthDate",
        header: "Nascita",
        cell: ({ row }) => formatTableDate(row.original.birthDate),
        sortingFn: "datetime",
      },
      {
        accessorKey: "birthPlace",
        header: "Luogo",
        cell: ({ row }) => row.original.birthPlace ?? "—",
      },
      {
        accessorKey: "profession",
        header: "Professione",
        cell: ({ row }) => row.original.profession ?? "—",
      },
      {
        id: "childrenCount",
        header: "Figli",
        accessorFn: (row) => row.childIds.length,
        cell: ({ row }) => row.original.childIds.length,
      },
      {
        id: "parentsCount",
        header: "Genitori",
        accessorFn: (row) => row.parentIds.length,
        cell: ({ row }) => row.original.parentIds.length,
      },
      {
        accessorKey: "deathDate",
        header: "Decesso",
        cell: ({ row }) =>
          row.original.deathDate
            ? formatTableDate(row.original.deathDate)
            : "In vita",
        sortingFn: "datetime",
      },
      {
        id: "partners",
        header: "Partner",
        accessorFn: (row) => getPartnersLabel(row, peopleById),
        cell: ({ row }) => getPartnersLabel(row.original, peopleById),
      },
      {
        accessorKey: "notes",
        header: "Note",
        cell: ({ row }) => (
          <span className="block min-w-64 max-w-sm leading-5 text-[#526158]">
            {row.original.notes ?? "—"}
          </span>
        ),
      },
    ],
    [onSelectPerson, peopleById],
  );

  const table = useReactTable({
    data: filteredPeople,
    columns,
    getRowId: (row) => row.id,
    state: {
      columnOrder,
      sorting,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const orderedColumns = table.getAllLeafColumns();

  const moveColumn = (columnId: string, offset: -1 | 1) => {
    setColumnOrder((currentOrder) => {
      const currentIndex = currentOrder.indexOf(columnId);
      const nextIndex = currentIndex + offset;

      if (
        currentIndex === -1 ||
        nextIndex < 0 ||
        nextIndex >= currentOrder.length
      ) {
        return currentOrder;
      }

      const nextOrder = [...currentOrder];
      [nextOrder[currentIndex], nextOrder[nextIndex]] = [
        nextOrder[nextIndex],
        nextOrder[currentIndex],
      ];
      return nextOrder;
    });
  };

  return (
    <section
      aria-label="Tabella delle persone"
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-t border-[#dfe5df] bg-white"
    >
      <div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-[#dfe5df] px-5 sm:px-9">
        <p aria-live="polite" className="text-sm font-medium text-[#34443a]">
          {countLabel(filteredPeople.length)}
        </p>

        <div className="relative" ref={columnChooserRef}>
          <button
            aria-controls="people-table-column-chooser"
            aria-expanded={isColumnChooserOpen}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-[#d5ddd5] bg-white px-4 text-sm font-medium text-[#26372c] outline-none transition hover:border-[#9cac9d] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
            onClick={() => setIsColumnChooserOpen((isOpen) => !isOpen)}
            ref={columnChooserButtonRef}
            type="button"
          >
            <ColumnsIcon />
            Colonne
          </button>
          {isColumnChooserOpen ? (
            <div
              aria-label="Gestisci colonne"
              className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[#d5ddd5] bg-white p-2 shadow-[0_18px_48px_rgba(24,45,31,0.14)]"
              id="people-table-column-chooser"
              role="dialog"
            >
              <p className="px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#65746a]">
                Colonne visibili
              </p>
              {orderedColumns.map((column, columnIndex) => {
                const label =
                  typeof column.columnDef.header === "string"
                    ? column.columnDef.header
                    : column.id;

                return (
                  <div
                    className="flex min-h-11 items-center gap-1 rounded-xl pl-3 text-sm text-[#34443a] transition hover:bg-[#f4f7f3]"
                    key={column.id}
                  >
                    <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
                      <input
                        checked={column.getIsVisible()}
                        className="h-4 w-4 shrink-0 accent-[#0c3b24]"
                        disabled={!column.getCanHide()}
                        onChange={column.getToggleVisibilityHandler()}
                        type="checkbox"
                      />
                      <span className="truncate">{label}</span>
                    </label>
                    <div
                      aria-label={`Riordina ${label}`}
                      className="flex shrink-0"
                      role="group"
                    >
                      <button
                        aria-label={`Sposta ${label} su`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#526158] outline-none transition hover:bg-white hover:text-[#0c3b24] focus-visible:ring-2 focus-visible:ring-[#0c3b24] disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={columnIndex === 0}
                        onClick={() => moveColumn(column.id, -1)}
                        type="button"
                      >
                        <MoveIcon direction="up" />
                      </button>
                      <button
                        aria-label={`Sposta ${label} giù`}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[#526158] outline-none transition hover:bg-white hover:text-[#0c3b24] focus-visible:ring-2 focus-visible:ring-[#0c3b24] disabled:cursor-not-allowed disabled:opacity-30"
                        disabled={columnIndex === orderedColumns.length - 1}
                        onClick={() => moveColumn(column.id, 1)}
                        type="button"
                      >
                        <MoveIcon direction="down" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-left">
          <thead className="sticky top-0 z-10 bg-[#fbfcfb]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const ariaSort =
                    sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";

                  return (
                    <th
                      aria-sort={ariaSort}
                      className="h-14 border-b border-[#dfe5df] px-5 text-sm font-semibold text-[#27362c] first:border-r first:border-[#dfe5df] first:pl-9 last:pr-9"
                      key={header.id}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          className="flex min-h-11 min-w-11 items-center gap-2 rounded-md outline-none transition hover:text-[#0c3b24] focus-visible:ring-2 focus-visible:ring-[#0c3b24]"
                          onClick={header.column.getToggleSortingHandler()}
                          type="button"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted ? (
                            <span className="text-[#0c3b24]">
                              <SortIcon direction={sorted} />
                            </span>
                          ) : null}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white">
            {table.getRowModel().rows.map((row) => (
              <tr className="group transition-colors hover:bg-[#f7f9f6]" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    className="h-[62px] border-b border-[#e5eae5] px-5 text-sm text-[#34443a] first:border-r first:border-[#e0e6e0] first:pl-9 last:pr-9"
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {table.getRowModel().rows.length === 0 ? (
          <div className="flex min-h-72 items-center justify-center px-6 text-center">
            <div>
              <p className="font-[family-name:var(--font-display)] text-2xl text-[#17351f]">
                Nessuna persona trovata
              </p>
              <p className="mt-2 text-sm text-[#65746a]">Prova una ricerca diversa.</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
