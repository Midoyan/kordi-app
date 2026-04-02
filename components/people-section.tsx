"use client";

import {
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { PencilLine, Plus, Search } from "lucide-react";

import { PersonEditorSheet } from "@/components/person-editor-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  WorkspaceColumnToggleMenu,
  WorkspaceVCardTable,
} from "@/components/workspace-data-table";
import {
  createEmptyPersonDraft,
  createPerson,
  deletePerson,
  fetchPeople,
  getCachedPeopleSnapshot,
  getPersonSearchText,
  primePeopleCache,
  type PersonDraft,
  type PersonRecord,
  updatePerson,
} from "@/lib/people";
import { parseVCardPayload } from "@/lib/vcard";
import { cn } from "@/lib/utils";

const defaultColumnVisibility: VisibilityState = {
  select: false,
};

function toDraft(person: PersonRecord): PersonDraft {
  return {
    name: person.name,
    address: person.address,
    phone: person.phone,
  };
}

function insertAtVisibleIndex(
  currentPeople: PersonRecord[],
  incomingPeople: PersonRecord[],
  visibleIds: string[],
  insertionIndex: number | null,
) {
  // Drops happen against the filtered/sorted table, so convert that visible insertion point back into the source list.
  if (currentPeople.length === 0) {
    return incomingPeople;
  }

  const boundedIndex =
    insertionIndex === null ? currentPeople.length : Math.max(0, Math.min(insertionIndex, visibleIds.length));

  if (visibleIds.length === 0) {
    return boundedIndex === 0
      ? [...incomingPeople, ...currentPeople]
      : [...currentPeople, ...incomingPeople];
  }

  if (boundedIndex >= visibleIds.length) {
    const anchorId = visibleIds[visibleIds.length - 1];
    const anchorIndex = currentPeople.findIndex((person) => person.id === anchorId);

    if (anchorIndex < 0) {
      return [...currentPeople, ...incomingPeople];
    }

    const nextPeople = [...currentPeople];
    nextPeople.splice(anchorIndex + 1, 0, ...incomingPeople);
    return nextPeople;
  }

  const beforeId = visibleIds[boundedIndex];
  const beforeIndex = currentPeople.findIndex((person) => person.id === beforeId);

  if (beforeIndex < 0) {
    return [...incomingPeople, ...currentPeople];
  }

  const nextPeople = [...currentPeople];
  nextPeople.splice(beforeIndex, 0, ...incomingPeople);
  return nextPeople;
}

function ColumnHeader({
  label,
  canSort,
  onClick,
  className,
}: {
  label: string;
  canSort: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (!canSort) {
    return (
      <div className={cn("px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase", className)}>
        {label}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase hover:bg-[#f3f3ef] hover:text-[#1d1d1b]",
        className,
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function PeoplePanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#e3e3df] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1b]">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function PeopleSection({ initialPeople }: { initialPeople?: PersonRecord[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [people, setPeople] = useState<PersonRecord[]>(initialPeople ?? []);
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<PersonDraft | null>(null);
  const [recentlyInsertedIds, setRecentlyInsertedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const insertAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (initialPeople) {
      primePeopleCache(initialPeople);
    }
  }, [initialPeople]);

  useEffect(() => {
    const controller = new AbortController();
    const cachedPeople = getCachedPeopleSnapshot();

    if (cachedPeople !== null) {
      setPeople(cachedPeople);
      setIsLoading(false);
    } else if (initialPeople) {
      setPeople(initialPeople);
      setIsLoading(false);
      setLoadError(null);
    }

    const load = async () => {
      if (cachedPeople === null && !initialPeople) {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const nextPeople =
          cachedPeople !== null
            ? await fetchPeople(controller.signal)
            : initialPeople ?? await fetchPeople(controller.signal);
        setPeople(nextPeople);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Failed to load people.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();

      if (insertAnimationTimeoutRef.current) {
        window.clearTimeout(insertAnimationTimeoutRef.current);
      }
    };
  }, [initialPeople]);

  useEffect(() => {
    if (searchParams.get("add-person") !== "1") {
      return;
    }

    setEditorMode("create");
    setEditingPersonId(null);
    setEditorError(null);
    setEditorDraft(createEmptyPersonDraft());
  }, [searchParams]);

  const clearAddPersonQuery = () => {
    if (searchParams.get("add-person") !== "1") {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("add-person");
    const nextQuery = nextSearchParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const closeEditor = () => {
    clearAddPersonQuery();
    setEditorMode(null);
    setEditingPersonId(null);
    setEditorDraft(null);
    setEditorError(null);
  };

  const openEditor = (person: PersonRecord) => {
    setEditorMode("edit");
    setEditingPersonId(person.id);
    setEditorError(null);
    setEditorDraft(toDraft(person));
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setEditingPersonId(null);
    setEditorError(null);
    setEditorDraft(createEmptyPersonDraft());
    clearAddPersonQuery();
  };

  const columns: ColumnDef<PersonRecord>[] = [
    {
      id: "select",
      meta: { label: "Select" },
      enableSorting: false,
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.name}`}
          />
        </div>
      ),
      header: ({ table }: HeaderContext<PersonRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
            aria-label="Select all visible people"
          />
        </div>
      ),
    },
    {
      accessorKey: "name",
      meta: { label: "Name" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Name"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="space-y-1 px-3">
          <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1b]">
            {row.original.name}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "address",
      meta: { label: "Address" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Address"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <p className="whitespace-normal px-3 text-[13px] leading-6 text-[#43433f]">
          {row.original.address || "Address not added"}
        </p>
      ),
    },
    {
      accessorKey: "phone",
      meta: { label: "Phone" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Phone"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <p className="whitespace-normal px-3 text-[13px] leading-6 text-[#43433f]">
          {row.original.phone || "Phone not added"}
        </p>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => (
        <span className="sr-only">Actions</span>
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex items-center justify-end px-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#5d5d58] hover:bg-[#f3f3ef] hover:text-[#1d1d1b]"
            onClick={() => openEditor(row.original)}
          >
            <PencilLine />
            Edit
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable<PersonRecord>({
    data: people,
    columns,
    state: {
      rowSelection,
      sorting,
      columnVisibility,
      globalFilter: deferredQuery,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: (row: Row<PersonRecord>, _columnId: string, filterValue: string) => {
      const searchValue = String(filterValue ?? "").trim().toLowerCase();

      if (!searchValue) {
        return true;
      }

      return getPersonSearchText(row.original).includes(searchValue);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const visibleColumns = table.getAllColumns().filter((column) => column.getCanHide());

  const mergeImportedPeople = async (
    payloads: string[],
    insertionIndex: number | null,
  ) => {
    // Table drops may contain multiple contacts; keep them in payload order when creating crew members.
    const importedDrafts = payloads.flatMap((payload) => parseVCardPayload(payload));

    if (importedDrafts.length === 0) {
      setNotice("No readable vCard entries were found in that drop.");
      return;
    }

    const visibleIds = table.getRowModel().rows.map((row) => row.original.id);
    setIsImporting(true);
    setNotice(null);

    try {
      const createdPeople = await Promise.all(importedDrafts.map((draft) => createPerson(draft)));

      setPeople((currentPeople) =>
        insertAtVisibleIndex(
          currentPeople,
          createdPeople,
          visibleIds,
          insertionIndex,
        ),
      );
      setRecentlyInsertedIds(createdPeople.map((person) => person.id));
      setNotice(
        `Imported ${createdPeople.length} contact${createdPeople.length === 1 ? "" : "s"} into the shared roster.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to import contacts.");
    } finally {
      setIsImporting(false);

      if (insertAnimationTimeoutRef.current) {
        window.clearTimeout(insertAnimationTimeoutRef.current);
      }

      insertAnimationTimeoutRef.current = window.setTimeout(() => {
        setRecentlyInsertedIds([]);
      }, 1400);
    }
  };

  const saveEditedPerson = async () => {
    if (!editorDraft) {
      return;
    }

    setIsSaving(true);
    setEditorError(null);

    try {
      if (editorMode === "create") {
        const createdPerson = await createPerson(editorDraft);
        setPeople((currentPeople) => [createdPerson, ...currentPeople]);
        setNotice("Added a new person to the shared roster.");
      } else if (editingPersonId) {
        const updatedPerson = await updatePerson(editingPersonId, editorDraft);
        setPeople((currentPeople) =>
          currentPeople.map((person) => (person.id === editingPersonId ? updatedPerson : person)),
        );
        setNotice("Saved changes to the selected person.");
      }

      closeEditor();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to save person.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteEditedPerson = async () => {
    if (!editingPersonId) {
      return;
    }

    const personName =
      people.find((person) => person.id === editingPersonId)?.name ?? "this person";

    if (typeof window !== "undefined" && !window.confirm(`Delete ${personName}?`)) {
      return;
    }

    setIsDeleting(true);
    setEditorError(null);

    try {
      await deletePerson(editingPersonId);
      setPeople((currentPeople) =>
        currentPeople.filter((person) => person.id !== editingPersonId),
      );
      setNotice(`Deleted ${personName} from the shared roster.`);
      closeEditor();
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : "Failed to delete person.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="grid">
        <PeoplePanel
          title="People roster"
          description="Load, search, edit, and import crew members from the shared people source."
        >
          <div className="flex flex-col gap-4">
            {loadError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
                {loadError}
              </div>
            ) : null}

            {notice ? (
              <div className="rounded-xl border border-[#d8e2ff] bg-[#f5f8ff] px-4 py-3 text-[13px] text-[#3556a8]">
                {notice}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-[#e7e7e4] bg-[#fafaf7] text-[13px] text-[#6b6b67]">
                Loading people from `crew_members`...
              </div>
            ) : (
              <WorkspaceVCardTable
                table={table}
                dataIds={people.map((person) => person.id)}
                showImportPanel={false}
                toolbar={() => (
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#72726d]" />
                      <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search name, address, or phone"
                        className="h-10 border-[#dbdbd6] bg-white pl-9 text-[13px] shadow-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#dbdbd6] bg-[#fafaf7] text-[#1d1d1b] hover:bg-[#f1f1ed]"
                        onClick={openCreateEditor}
                      >
                        <Plus />
                        Add person
                      </Button>
                      <WorkspaceColumnToggleMenu columns={visibleColumns} />
                    </div>
                  </div>
                )}
                importInProgress={isImporting}
                onImportPayloads={(payloads, context) =>
                  mergeImportedPeople(payloads, context.insertionIndex)
                }
                containerClassName="overflow-x-auto"
                tableClassName="min-w-[820px] table-fixed"
                headerClassName="bg-[#f7f7f4]"
                headerRowClassName="border-[#ecece8] hover:bg-transparent"
                getHeadClassName={(columnId) =>
                  cn(
                    "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-0 align-middle",
                    columnId === "select" && "w-[56px]",
                    columnId === "name" && "w-[26%]",
                    columnId === "address" && "w-[40%]",
                    columnId === "phone" && "w-[20%]",
                    columnId === "actions" && "w-[14%]",
                  )
                }
                emptyState={
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="py-14 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <div>
                          <p className="text-[14px] font-medium text-[#1d1d1b]">
                            {people.length === 0
                              ? "No people saved yet."
                              : "No matching people found for this filter."}
                          </p>
                          <p className="mt-1 text-[13px] text-[#6b6b67]">
                            {people.length === 0
                              ? "Import a `.vcf` or add someone to create the first record."
                              : "Try a different search or adjust the visible columns."}
                          </p>
                        </div>
                        {people.length === 0 ? (
                          <Button type="button" variant="outline" onClick={openCreateEditor}>
                            Add first person
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                }
                footer={
                  <div className="flex flex-col gap-3 rounded-lg border border-[#f1f1ed] bg-[#fcfcfa] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[12px] leading-5 text-[#6b6b67]">
                      {people.length === 0
                        ? "No people in the roster yet."
                        : `${table.getRowModel().rows.length} visible row${table.getRowModel().rows.length === 1 ? "" : "s"} of ${people.length} total people.`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                }
                renderRow={(row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className={cn(
                      "border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff]",
                      recentlyInsertedIds.includes(row.original.id) &&
                        "animate-in fade-in slide-in-from-top-2 duration-300",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          "px-0 py-4 align-top",
                          cell.column.id === "select" && "py-4",
                          cell.column.id === "actions" && "py-3",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )}
              />
            )}
          </div>
        </PeoplePanel>

      </div>

      <PersonEditorSheet
        draft={editorDraft}
        mode={editorMode}
        open={Boolean(editorDraft)}
        onClose={closeEditor}
        onDelete={editorMode === "edit" ? deleteEditedPerson : undefined}
        onSave={() => {
          void saveEditedPerson();
        }}
        errorMessage={editorError}
        isDeleting={isDeleting}
        isSaving={isSaving}
        setDraft={setEditorDraft}
      />
    </>
  );
}
