"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
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

interface PeopleTableProps {
  people: PersonRecord[];
  query: string;
  onSelectPerson: (personId: string) => void;
}

function countLabel(total: number): string {
  if (total === 1) {
    return "1 persona";
  }

  return `${total} persone`;
}

export function PeopleTable({ people, query, onSelectPerson }: PeopleTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "birthDate", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    deathDate: false,
    notes: false,
    birthPlace: false,
  });
  const deferredQuery = useDeferredValue(query);
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const filteredPeople = useMemo(
    () => people.filter((person) => matchesPersonQuery(person, deferredQuery)),
    [deferredQuery, people],
  );

  const columns = useMemo<ColumnDef<PersonRecord>[]>(
    () => [
      {
        accessorKey: "displayName",
        enableHiding: false,
        header: "Persona",
        cell: ({ row }) => (
          <button
            className="text-left"
            onClick={() => onSelectPerson(row.original.id)}
            type="button"
          >
            <span className="block font-semibold text-slate-900">
              {getPersonDisplayName(row.original)}
            </span>
            <span className="block text-xs uppercase tracking-[0.18em] text-slate-500">
              {row.original.sex ?? "non indicato"}
            </span>
          </button>
        ),
        sortingFn: (rowA, rowB) =>
          getPersonDisplayName(rowA.original).localeCompare(getPersonDisplayName(rowB.original)),
      },
      {
        accessorKey: "birthDate",
        header: "Nascita",
        cell: ({ row }) => (
          <div>
            <span className="block">{formatDateLabel(row.original.birthDate)}</span>
            <span className="block text-xs text-slate-500">{row.original.birthPlace ?? "-"}</span>
          </div>
        ),
        sortingFn: "datetime",
      },
      {
        accessorKey: "deathDate",
        header: "Decesso",
        cell: ({ row }) => (
          <div>
            <span className="block">
              {row.original.deathDate ? formatDateLabel(row.original.deathDate) : "Ancora in vita"}
            </span>
            <span className="block text-xs text-slate-500">{row.original.deathPlace ?? "-"}</span>
          </div>
        ),
        sortingFn: "datetime",
      },
      {
        id: "partners",
        header: "Partner",
        accessorFn: (row) => getPartnersLabel(row, peopleById),
        cell: ({ row }) => (
          <span className="text-sm text-slate-700">
            {getPartnersLabel(row.original, peopleById)}
          </span>
        ),
      },
      {
        id: "parentsCount",
        header: "Genitori",
        accessorFn: (row) => row.parentIds.length,
        cell: ({ row }) => row.original.parentIds.length,
      },
      {
        id: "childrenCount",
        header: "Figli",
        accessorFn: (row) => row.childIds.length,
        cell: ({ row }) => row.original.childIds.length,
      },
      {
        accessorKey: "birthPlace",
        header: "Luogo di nascita",
        cell: ({ row }) => row.original.birthPlace ?? "-",
      },
      {
        accessorKey: "profession",
        header: "Professione",
        cell: ({ row }) => row.original.profession ?? "-",
      },
      {
        accessorKey: "notes",
        header: "Note",
        cell: ({ row }) => (
          <span className="block max-w-xs text-sm text-slate-700">
            {row.original.notes ?? "-"}
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
      sorting,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#d9cfbd] px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Vista tabella</p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-900">
            Elenco ordinabile e filtrabile
          </h2>
          <p className="mt-1 text-sm text-slate-600">{countLabel(filteredPeople.length)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {table.getAllLeafColumns().map((column) => (
            <label
              className="flex items-center gap-2 rounded-full border border-[#d9cfbd] bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-600"
              key={column.id}
            >
              <input
                checked={column.getIsVisible()}
                className="h-3.5 w-3.5 rounded border-[#b9ab90] text-[#153524]"
                disabled={!column.getCanHide()}
                onChange={column.getToggleVisibilityHandler()}
                type="checkbox"
              />
              {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr className="bg-[#efe2c8]" key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className="border-b border-[#d9cfbd] px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-slate-600"
                    key={header.id}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        className="flex items-center gap-2"
                        onClick={header.column.getToggleSortingHandler()}
                        type="button"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-[10px] text-slate-400">
                          {{
                            asc: "↑",
                            desc: "↓",
                          }[header.column.getIsSorted() as string] ?? "↕"}
                        </span>
                      </button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-[#fffaf1]">
            {table.getRowModel().rows.map((row) => (
              <tr className="transition hover:bg-white" key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    className="border-b border-[#efe2c8] px-4 py-4 align-top text-sm text-slate-700"
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
