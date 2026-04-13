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

import { useCacheSnapshot } from "@/hooks/use-cache-snapshot";
import { DispatchAssistantCard } from "@/components/dispatch-assistant-card";
import { PersonEditorSheet } from "@/components/person-editor-sheet";
import { StackedAddressText } from "@/components/schedule-section/table-parts";
import { splitAddressLabel } from "@/components/schedule-section/helpers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  hasFreshPeopleCache,
  getPersonSearchText,
  primePeopleCache,
  subscribePeopleCache,
  upsertPersonInPeopleCache,
  type PersonDraft,
  type PersonRecord,
  updatePerson,
} from "@/lib/people";
import type {
  PickupAssignmentSuggestion,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";
import { primeTransportPlanCache } from "@/lib/transport-plan-client-cache";
import { parseVCardPayload } from "@/lib/vcard";
import { cn } from "@/lib/utils";

const defaultColumnVisibility: VisibilityState = {
  select: false,
  role: false,
  createdAt: false,
};

function formatDateAdded(value: string | null) {
  if (!value) {
    return "Date not available";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Date not available";
  }

  return parsedDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatPickupTime(value: string) {
  return value.trim() || "-";
}

function PickupToLocationText({
  name,
  address,
  fallback,
}: {
  name: string;
  address: string;
  fallback: string;
}) {
  const trimmedName = name.trim();
  const trimmedAddress = address.trim();
  const { primary, secondary } = splitAddressLabel(trimmedAddress);
  const label = trimmedName || primary || fallback;
  const hasLocationTitle = Boolean(trimmedName);
  const tooltipText = [trimmedName && primary ? primary : null, secondary || null]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(", ");

  if (!tooltipText) {
    return (
      <p
        className={cn(
          "text-[13px] leading-6",
          hasLocationTitle ? "font-semibold text-[#1d1d1b]" : "text-[#43433f]"
        )}
      >
        {label}
      </p>
    );
  }

  return (
    <TooltipProvider delay={900}>
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn(
                "inline-block max-w-full truncate text-[13px] leading-6",
                hasLocationTitle ? "font-semibold text-[#1d1d1b]" : "text-[#43433f]"
              )}
            >
              {label}
            </span>
          }
        />
        <TooltipContent
          side="bottom"
          align="start"
          alignOffset={-2}
          arrowClassName="data-[side=bottom]:left-3.5!"
          className="max-w-[18rem] rounded-md bg-[#1f1f1d] px-2.5 py-2 text-[11px] leading-4 text-white"
        >
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function toDraft(person: PersonRecord): PersonDraft {
  return {
    name: person.name,
    address: person.address,
    phone: person.phone,
    role: person.role,
  };
}

function toPickupSuggestionDraft(draft: PersonDraft): PickupSuggestionDraft {
  return {
    name: draft.name.trim(),
    address: draft.address.trim(),
    phone: draft.phone.trim(),
    role: draft.role.trim(),
  };
}

function getDraftSuggestionKey(draft: PersonDraft | null) {
  if (!draft) {
    return "";
  }

  return [draft.name.trim(), draft.address.trim(), draft.phone.trim(), draft.role.trim()].join("::");
}

function insertAtVisibleIndex(
  currentPeople: PersonRecord[],
  incomingPeople: PersonRecord[],
  visibleIds: string[],
  insertionIndex: number | null,
) {
  const dedupedIncomingPeople = Array.from(
    new Map(incomingPeople.map((person) => [person.id, person])).values(),
  );
  const incomingIds = new Set(dedupedIncomingPeople.map((person) => person.id));
  const nextCurrentPeople = currentPeople.filter((person) => !incomingIds.has(person.id));

  if (nextCurrentPeople.length === 0) {
    return dedupedIncomingPeople;
  }

  const boundedIndex =
    insertionIndex === null ? nextCurrentPeople.length : Math.max(0, Math.min(insertionIndex, visibleIds.length));

  if (visibleIds.length === 0) {
    return boundedIndex === 0
      ? [...dedupedIncomingPeople, ...nextCurrentPeople]
      : [...nextCurrentPeople, ...dedupedIncomingPeople];
  }

  if (boundedIndex >= visibleIds.length) {
    const anchorId = visibleIds[visibleIds.length - 1];
    const anchorIndex = nextCurrentPeople.findIndex((person) => person.id === anchorId);

    if (anchorIndex < 0) {
      return [...nextCurrentPeople, ...dedupedIncomingPeople];
    }

    const nextPeople = [...nextCurrentPeople];
    nextPeople.splice(anchorIndex + 1, 0, ...dedupedIncomingPeople);
    return nextPeople;
  }

  const beforeId = visibleIds[boundedIndex];
  const beforeIndex = nextCurrentPeople.findIndex((person) => person.id === beforeId);

  if (beforeIndex < 0) {
    return [...dedupedIncomingPeople, ...nextCurrentPeople];
  }

  const nextPeople = [...nextCurrentPeople];
  nextPeople.splice(beforeIndex, 0, ...dedupedIncomingPeople);
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
  const cachedPeopleSnapshot = useCacheSnapshot(
    subscribePeopleCache,
    () => getCachedPeopleSnapshot({ includeExpired: true }),
    () => initialPeople ?? null,
  );
  const [people, setPeople] = useState<PersonRecord[]>(() => cachedPeopleSnapshot ?? initialPeople ?? []);
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
  const [assignmentSuggestion, setAssignmentSuggestion] = useState<PickupAssignmentSuggestion | null>(null);
  const [assignmentSuggestionError, setAssignmentSuggestionError] = useState<string | null>(null);
  const [isSuggestingAssignment, setIsSuggestingAssignment] = useState(false);
  const [isApplyingAssignment, setIsApplyingAssignment] = useState(false);
  const [assignmentSuggestionDraftKey, setAssignmentSuggestionDraftKey] = useState("");
  const [recentlyInsertedIds, setRecentlyInsertedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const insertAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!initialPeople) {
      return;
    }

    // Seed an empty client cache from the server snapshot, but never let an older
    // server render overwrite live client mutations like create/update/delete.
    if (getCachedPeopleSnapshot({ includeExpired: true }) === null) {
      primePeopleCache(initialPeople);
    }
  }, [initialPeople]);

  useEffect(() => {
    if (cachedPeopleSnapshot !== null) {
      setPeople(cachedPeopleSnapshot);
      setIsLoading(false);
      setLoadError(null);
      return;
    }

    if (initialPeople) {
      setPeople(initialPeople);
      setIsLoading(false);
      setLoadError(null);
    }
  }, [cachedPeopleSnapshot, initialPeople]);

  useEffect(() => {
    const controller = new AbortController();
    const hasFreshCache = hasFreshPeopleCache();

    if (hasFreshCache) {
      return () => {
        controller.abort();

        if (insertAnimationTimeoutRef.current) {
          window.clearTimeout(insertAnimationTimeoutRef.current);
        }
      };
    }

    const load = async () => {
      if (cachedPeopleSnapshot === null && !initialPeople) {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const nextPeople = await fetchPeople(controller.signal);
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
  }, [cachedPeopleSnapshot, initialPeople]);

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
    setAssignmentSuggestion(null);
    setAssignmentSuggestionError(null);
    setAssignmentSuggestionDraftKey("");
  };

  const openEditor = (person: PersonRecord) => {
    setEditorMode("edit");
    setEditingPersonId(person.id);
    setEditorError(null);
    setAssignmentSuggestion(null);
    setAssignmentSuggestionError(null);
    setAssignmentSuggestionDraftKey("");
    setEditorDraft(toDraft(person));
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setEditingPersonId(null);
    setEditorError(null);
    setAssignmentSuggestion(null);
    setAssignmentSuggestionError(null);
    setAssignmentSuggestionDraftKey("");
    setEditorDraft(createEmptyPersonDraft());
    clearAddPersonQuery();
  };

  useEffect(() => {
    const draftKey = getDraftSuggestionKey(editorDraft);

    if (!assignmentSuggestion || !assignmentSuggestionDraftKey || !draftKey) {
      return;
    }

    if (draftKey !== assignmentSuggestionDraftKey) {
      setAssignmentSuggestion(null);
    }
  }, [assignmentSuggestion, assignmentSuggestionDraftKey, editorDraft]);

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
      accessorKey: "role",
      meta: { label: "Role" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Role"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <p className="whitespace-normal px-3 text-[13px] leading-6 text-[#43433f]">
          { row.original.role }
        </p>
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
      cell: ({ row, table }: CellContext<PersonRecord, unknown>) => {
        const isRoleColumnVisible = table.getColumn("role")?.getIsVisible() ?? false;

        return (
          <div className="space-y-1 px-3">
            <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1b]">
              {row.original.name}
            </p>
            {!isRoleColumnVisible ? (
              <p className="text-[12px] text-[#7a7a74]">
                { row.original.role }
              </p>
            ) : null}
          </div>
        );
      },
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
        <div className="px-3 text-[13px] leading-6 text-[#43433f]">
          {row.original.address ? (
            <StackedAddressText value={row.original.address} muted />
          ) : (
            "-" // Address Not Added
          )}
        </div>
      ),
    },
    {
      accessorKey: "pickupTime",
      meta: { label: "Pickup time" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Pickup time"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <p className="whitespace-normal px-3 text-[13px] leading-6 text-[#43433f]">
          {formatPickupTime(row.original.pickupTime)}
        </p>
      ),
    },
    {
      accessorKey: "pickupToLocation",
      meta: { label: "Pickup to location" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Pickup to"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        row.original.pickupToLocationName || row.original.pickupToLocationAddress ? (
          <div className="px-3">
            <PickupToLocationText
              name={row.original.pickupToLocationName}
              address={row.original.pickupToLocationAddress}
              fallback={row.original.pickupToLocation || "Not assigned"}
            />
          </div>
        ) : (
          <p className="whitespace-normal px-3 text-[13px] leading-6 text-[#43433f]">
            {row.original.pickupToLocation || "Not assigned"}
          </p>
        )
      ),
    },
    {
      accessorKey: "createdAt",
      meta: { label: "Date added" },
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Date added"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <p className="whitespace-normal px-3 text-[13px] leading-6 text-[#43433f]">
          {formatDateAdded(row.original.createdAt)}
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
        setPeople((currentPeople) => [
          createdPerson,
          ...currentPeople.filter((person) => person.id !== createdPerson.id),
        ]);
        setNotice("Added a new person to the shared roster.");
      } else if (editingPersonId) {
        const updatedPerson = await updatePerson(editingPersonId, editorDraft);
        setPeople((currentPeople) =>
          currentPeople.map((person) =>
            person.id === editingPersonId
              ? {
                  ...person,
                  ...updatedPerson,
                }
              : person,
          ),
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

  const requestAssignmentSuggestion = async () => {
    if (!editorDraft || editorMode !== "create") {
      return;
    }

    setIsSuggestingAssignment(true);
    setAssignmentSuggestionError(null);

    try {
      const response = await fetch("/api/ai/pickup-suggestion", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: toPickupSuggestionDraft(editorDraft),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { suggestion?: PickupAssignmentSuggestion | null; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to suggest a pickup assignment.");
      }

      if (!payload?.suggestion) {
        throw new Error("No eligible pickup route is available for this address.");
      }

      setAssignmentSuggestion(payload.suggestion);
      setAssignmentSuggestionDraftKey(getDraftSuggestionKey(editorDraft));
    } catch (error) {
      setAssignmentSuggestion(null);
      setAssignmentSuggestionError(
        error instanceof Error ? error.message : "Unable to suggest a pickup assignment.",
      );
    } finally {
      setIsSuggestingAssignment(false);
    }
  };

  const applyAssignmentSuggestion = async () => {
    if (!editorDraft || editorMode !== "create" || !assignmentSuggestion) {
      return;
    }

    setIsApplyingAssignment(true);
    setEditorError(null);
    setAssignmentSuggestionError(null);

    try {
      const response = await fetch("/api/ai/pickup-suggestion", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          draft: toPickupSuggestionDraft(editorDraft),
          suggestion: assignmentSuggestion,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            person?: PersonRecord;
            transportPlan?: import("@/lib/drive-plan").TransportPlan;
            error?: string;
          }
        | null;

      if (!response.ok || !payload?.person || !payload.transportPlan) {
        throw new Error(payload?.error ?? "Unable to apply the suggested pickup.");
      }

      const person = payload.person;
      const transportPlan = payload.transportPlan;

      upsertPersonInPeopleCache(person);
      primeTransportPlanCache(transportPlan);
      setPeople((currentPeople) => [
        person,
        ...currentPeople.filter((currentPerson) => currentPerson.id !== person.id),
      ]);
      setNotice("Added the person and placed them into the suggested pickup run.");
      closeEditor();
    } catch (error) {
      setAssignmentSuggestionError(
        error instanceof Error ? error.message : "Unable to apply the suggested pickup.",
      );
    } finally {
      setIsApplyingAssignment(false);
    }
  };

  return (
    <>
      <div className="grid gap-4">
        <DispatchAssistantCard />
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
                        placeholder="Search name, role, phone, address, or destination"
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
                tableClassName="min-w-[1160px] table-fixed"
                headerClassName="bg-[#f7f7f4]"
                headerRowClassName="border-[#ecece8] hover:bg-transparent"
                getHeadClassName={(columnId) =>
                  cn(
                    "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-0 align-middle",
                    columnId === "select" && "w-[56px]",
                    columnId === "role" && "w-[14%]",
                    columnId === "name" && "w-[18%]",
                    columnId === "phone" && "w-[16%]",
                    columnId === "address" && "w-[22%]",
                    columnId === "pickupTime" && "w-[12%]",
                    columnId === "pickupToLocation" && "w-[22%]",
                    columnId === "createdAt" && "w-[14%]",
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
        suggestionErrorMessage={assignmentSuggestionError}
        isDeleting={isDeleting}
        isSaving={isSaving}
        isSuggestingAssignment={isSuggestingAssignment}
        isApplyingSuggestion={isApplyingAssignment}
        suggestion={assignmentSuggestion}
        onSuggestAssignment={() => {
          void requestAssignmentSuggestion();
        }}
        onApplySuggestion={() => {
          void applyAssignmentSuggestion();
        }}
        setDraft={setEditorDraft}
      />
    </>
  );
}
