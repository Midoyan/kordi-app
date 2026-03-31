"use client";

import {
  type ChangeEvent,
  type DragEvent,
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
  type Cell,
  type CellContext,
  type ColumnDef,
  type Header,
  type HeaderContext,
  type HeaderGroup,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { FileUp, PencilLine, Plus, Search } from "lucide-react";

import { PersonEditorSheet } from "@/components/person-editor-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createEmptyPersonDraft,
  createPerson,
  deletePerson,
  fetchPeople,
  getCachedPeopleSnapshot,
  getPersonSearchText,
  type PersonDraft,
  type PersonRecord,
  updatePerson,
} from "@/lib/people";
import { cn } from "@/lib/utils";

type BrowserFileSystemHandle = {
  kind: "file" | "directory";
  getFile?: () => Promise<File>;
};

const defaultDropPrompt = "Drop a contact card from macOS Contacts between rows or import a .vcf file.";
const vCardTransferTypes = [
  "text/vcard",
  "text/x-vcard",
  "text/plain",
  "text",
  "public.vcard",
  "public.utf8-plain-text",
  "com.apple.traditional-mac-plain-text",
] as const;

function toDraft(person: PersonRecord): PersonDraft {
  return {
    name: person.name,
    address: person.address,
    phone: person.phone,
  };
}

function decodeVCardValue(value: string) {
  return value
    .replace(/\\n/gi, ", ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function unfoldVCardLines(source: string) {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseVCardLine(line: string) {
  const separatorIndex = line.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  const metadata = line.slice(0, separatorIndex);
  const property = metadata.split(";")[0]?.split(".").pop()?.toUpperCase();

  if (!property) {
    return null;
  }

  return {
    property,
    value: decodeVCardValue(line.slice(separatorIndex + 1)),
  };
}

function getFieldValues(lines: string[], fieldName: string) {
  const upperFieldName = fieldName.toUpperCase();

  return lines
    .map((line) => parseVCardLine(line))
    .filter((entry) => entry?.property === upperFieldName)
    .map((entry) => entry?.value ?? "")
    .filter(Boolean);
}

function formatNameFromN(value: string) {
  const [lastName, firstName, middleName, prefix, suffix] = value
    .split(";")
    .map((part) => decodeVCardValue(part));

  return [prefix, firstName, middleName, lastName, suffix].filter(Boolean).join(" ");
}

function formatAddress(value: string) {
  return value
    .split(";")
    .map((part) => decodeVCardValue(part))
    .filter(Boolean)
    .join(", ");
}

function parseVCardEntry(card: string, index: number): PersonDraft {
  const lines = unfoldVCardLines(card);
  const fn = getFieldValues(lines, "FN")[0];
  const n = getFieldValues(lines, "N")[0];
  const address = getFieldValues(lines, "ADR")[0] ?? getFieldValues(lines, "LABEL")[0] ?? "";
  const phone = getFieldValues(lines, "TEL")[0] ?? "";
  const name = fn || (n ? formatNameFromN(n) : `Imported contact ${index + 1}`);

  return {
    name,
    address: address.includes(";") ? formatAddress(address) : address,
    phone,
  };
}

function parseVCardPayload(payload: string) {
  const matches = payload.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi);

  if (!matches) {
    return [];
  }

  return matches.map((card, index) => parseVCardEntry(card, index));
}

function extractVCardText(payload: string) {
  const normalizedPayload = payload.trim();

  if (!normalizedPayload) {
    return null;
  }

  return normalizedPayload.toUpperCase().includes("BEGIN:VCARD") ? normalizedPayload : null;
}

async function readDroppedVCardPayloads(dataTransfer: DataTransfer) {
  const payloadSet = new Set<string>();

  const appendPayload = (payload: string | null | undefined) => {
    const normalizedPayload = payload ? extractVCardText(payload) : null;

    if (normalizedPayload) {
      payloadSet.add(normalizedPayload);
    }
  };

  const fileReadTasks: Array<Promise<string>> = [];
  const stringReadTasks: Array<Promise<string>> = [];
  const handleReadTasks: Array<Promise<string | null>> = [];

  for (const transferType of dataTransfer.types) {
    appendPayload(dataTransfer.getData(transferType));
  }

  for (const transferType of vCardTransferTypes) {
    appendPayload(dataTransfer.getData(transferType));
  }

  for (const file of Array.from(dataTransfer.files)) {
    if (
      file.type === "text/vcard" ||
      file.type === "public.vcard" ||
      file.name.toLowerCase().endsWith(".vcf") ||
      file.type === "text/x-vcard"
    ) {
      fileReadTasks.push(file.text());
    }
  }

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind === "file") {
      const file = item.getAsFile();

      if (
        file &&
        (file.name.toLowerCase().endsWith(".vcf") ||
          /vcard/i.test(file.type) ||
          /vcard/i.test(item.type))
      ) {
        fileReadTasks.push(file.text());
      }

      if ("getAsFileSystemHandle" in item && typeof item.getAsFileSystemHandle === "function") {
        const handlePromise = item
          .getAsFileSystemHandle()
          .then(async (handle: BrowserFileSystemHandle | null) => {
            if (!handle || handle.kind !== "file" || typeof handle.getFile !== "function") {
              return null;
            }

            const handleFile = await handle.getFile();

            if (
              handleFile.name.toLowerCase().endsWith(".vcf") ||
              /vcard/i.test(handleFile.type) ||
              /vcard/i.test(item.type)
            ) {
              return handleFile.text();
            }

            return null;
          })
          .catch(() => null);

        handleReadTasks.push(handlePromise);
      }
    }

    if (item.kind === "string") {
      stringReadTasks.push(new Promise<string>((resolve) => {
        item.getAsString((value) => resolve(value));
      }));
    }
  }

  for (const payload of await Promise.all(fileReadTasks)) {
    appendPayload(payload);
  }

  for (const payload of await Promise.all(stringReadTasks)) {
    appendPayload(payload);
  }

  for (const payload of await Promise.all(handleReadTasks)) {
    appendPayload(payload);
  }

  return Array.from(payloadSet);
}

function insertAtVisibleIndex(
  currentPeople: PersonRecord[],
  incomingPeople: PersonRecord[],
  visibleIds: string[],
  insertionIndex: number | null,
) {
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

export function PeopleSection() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<PersonDraft | null>(null);
  const [recentlyInsertedIds, setRecentlyInsertedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const cachedPeople = getCachedPeopleSnapshot();

    if (cachedPeople !== null) {
      setPeople(cachedPeople);
      setIsLoading(false);
    }

    const load = async () => {
      if (cachedPeople === null) {
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
  }, []);

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
      accessorKey: "name",
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
          <p className="text-[12px] text-[#7a7a74]">
            {row.original.phone || "Phone not added"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "address",
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
      header: () => (
        <div className="px-3 text-right text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase">
          Actions
        </div>
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex justify-start px-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-[#5d5d58] hover:bg-[#f3f3ef] hover:text-[#1d1d1b]"
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
      sorting,
      globalFilter: deferredQuery,
    },
    onSortingChange: setSorting,
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

  const visibleRows = table.getRowModel().rows;
  const missingAddressCount = people.filter((person) => !person.address.trim()).length;
  const missingPhoneCount = people.filter((person) => !person.phone.trim()).length;

  const mergeImportedPeople = async (payloads: string[], insertionIndexOverride?: number | null) => {
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
          insertionIndexOverride ?? dropTargetIndex,
        ),
      );
      setRecentlyInsertedIds(createdPeople.map((person) => person.id));
      setNotice(
        `Imported ${createdPeople.length} contact${createdPeople.length === 1 ? "" : "s"} into the shared roster.`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to import contacts.");
    } finally {
      setDropTargetIndex(null);
      setIsDragging(false);
      setIsImporting(false);

      if (insertAnimationTimeoutRef.current) {
        window.clearTimeout(insertAnimationTimeoutRef.current);
      }

      insertAnimationTimeoutRef.current = window.setTimeout(() => {
        setRecentlyInsertedIds([]);
      }, 1400);
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payloads = await readDroppedVCardPayloads(event.dataTransfer);
    await mergeImportedPeople(payloads);
  };

  const onDragOverTable = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);

    if (visibleRows.length === 0) {
      setDropTargetIndex(0);
      return;
    }

    if (dropTargetIndex === null) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const insertionIndex = event.clientY < bounds.top + bounds.height / 2 ? 0 : visibleRows.length;
      setDropTargetIndex(insertionIndex);
    }
  };

  const onDragLeaveTable = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDragging(false);
    setDropTargetIndex(null);
  };

  const onDragOverRow = (event: DragEvent<HTMLTableRowElement>, rowIndex: number) => {
    event.preventDefault();
    event.stopPropagation();

    const bounds = event.currentTarget.getBoundingClientRect();
    const insertionIndex = event.clientY < bounds.top + bounds.height / 2 ? rowIndex : rowIndex + 1;
    setDropTargetIndex(insertionIndex);
    setIsDragging(true);
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const payloads = await Promise.all(files.map((file) => file.text()));
    setDropTargetIndex(visibleRows.length);
    await mergeImportedPeople(payloads, visibleRows.length);
    event.target.value = "";
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
      <div className="grid gap-4 lg:grid-cols-[1.38fr_0.62fr]">
        <PeoplePanel
          title="People roster"
          description="Load, search, edit, and import crew members from the shared people source."
          className={cn(
            "transition-colors",
            isDragging && "border-[#bed0ff] bg-[#fbfcff] shadow-[0_12px_35px_-28px_rgba(59,130,246,0.65)]",
          )}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 rounded-xl border border-[#ecece8] bg-[#fafaf7] p-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#72726d]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name, address, or phone"
                  className="h-10 border-[#ff00ae] bg-white pl-9 text-[13px] shadow-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".vcf,text/vcard,text/x-vcard"
                  multiple
                  className="hidden"
                  onChange={onFileSelected}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <FileUp />
                  {isImporting ? "Importing..." : "Import .vcf"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#dbdbd6] bg-[#fafaf7] text-[#1d1d1b] hover:bg-[#f1f1ed]"
                  onClick={openCreateEditor}
                >
                  <Plus />
                  Add person
                </Button>
              </div>
            </div>

            {loadError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800">
                {loadError}
              </div>
            ) : null}

            <div
              className={cn(
                "rounded-xl border border-[#e7e7e4] bg-white p-2 transition-all",
                isDragging && "border-dashed border-[#90a8ff] bg-[#f7f9ff]",
              )}
              onDrop={(event) => {
                void onDrop(event);
              }}
              onDragOver={onDragOverTable}
              onDragLeave={onDragLeaveTable}
            >
              <div
                className={cn(
                  "rounded-lg border border-dashed px-4 py-3 text-[12px] leading-5 transition-colors",
                  isDragging
                    ? "border-[#90a8ff] bg-[#eef3ff] text-[#3556a8]"
                    : "border-[#d8d8d3] bg-[#fcfcfa] text-[#6b6b67]",
                )}
              >
                <p className="font-medium text-[#1d1d1b]">
                  {isDragging ? "Release to import these contacts." : defaultDropPrompt}
                </p>
                {notice ? (
                  <p className="mt-1 text-[11px] leading-5 text-[#6b6b67]">
                    {notice}
                  </p>
                ) : null}
              </div>

              <div className="mt-3 overflow-hidden rounded-xl border border-[#ecece8]">
                <Table className="table-fixed">
                  <TableHeader className="bg-[#a0a01e]">
                    {table.getHeaderGroups().map((headerGroup: HeaderGroup<PersonRecord>) => (
                      <TableRow key={headerGroup.id} className="border-[#ecece8] hover:bg-transparent">
                        {headerGroup.headers.map((header: Header<PersonRecord, unknown>) => (
                          <TableHead
                            key={header.id}
                            className={cn(
                              "h-11 border-b border-[#ece8e8] bg-[#faf7f9] px-0 align-middle",
                              header.column.id === "actions" && "w-28",
                            )}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={table.getVisibleLeafColumns().length}
                          className="py-14 text-center text-[13px] text-[#6b6b67]"
                        >
                          Loading people from `crew_members`...
                        </TableCell>
                      </TableRow>
                    ) : visibleRows.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={table.getVisibleLeafColumns().length}
                          className="py-14 text-center text-[13px] text-[#6b6b67]"
                        >
                          {people.length === 0
                            ? "No people saved yet. Import a `.vcf` or add someone to create the first record."
                            : "No matching people found for this filter."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      <>
                        {visibleRows.map((row: Row<PersonRecord>, rowIndex: number) => (
                          <FragmentRow
                            key={row.id}
                            before={
                              isDragging && dropTargetIndex === rowIndex ? (
                                <TableRow className="border-0 hover:bg-transparent">
                                  <TableCell
                                    colSpan={table.getVisibleLeafColumns().length}
                                    className="p-0"
                                  >
                                    <div className="px-3 py-1">
                                      <div className="h-7 animate-in fade-in zoom-in-95 rounded-lg border border-dashed border-[#9db1ff] bg-[#eef3ff]" />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : null
                            }
                            row={
                              <TableRow
                                key={row.id}
                                className={cn(
                                  "border-[#f0f0ec] hover:bg-[#fafaf7]",
                                  recentlyInsertedIds.includes(row.original.id) &&
                                  "animate-in fade-in slide-in-from-top-2 duration-300",
                                )}
                                onDragOver={(event) => onDragOverRow(event, rowIndex)}
                              >
                                {row.getVisibleCells().map((cell: Cell<PersonRecord, unknown>) => (
                                  <TableCell
                                    key={cell.id}
                                    className={cn(
                                      "px-0 py-4 align-top",
                                      cell.column.id === "actions" && "py-3",
                                    )}
                                  >
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                  </TableCell>
                                ))}
                              </TableRow>
                            }
                          />
                        ))}
                        {isDragging && dropTargetIndex === visibleRows.length ? (
                          <TableRow className="border-0 hover:bg-transparent">
                            <TableCell
                              colSpan={table.getVisibleLeafColumns().length}
                              className="p-0"
                            >
                              <div className="px-3 py-1">
                                <div className="h-7 animate-in fade-in zoom-in-95 rounded-lg border border-dashed border-[#9db1ff] bg-[#eef3ff]" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-3 flex flex-col gap-3 rounded-lg border border-[#f1f1ed] bg-[#fcfcfa] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-[12px] leading-5 text-[#6b6b67]">
                  People load from and save to `/api/crew-members`. vCard imports create real crew
                  member records instead of demo rows.
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
            </div>
          </div>
        </PeoplePanel>

        <div className="grid gap-4">
          <PeoplePanel
            title="Connected source"
            description="The People page is now backed by the same crew-member API used elsewhere in the app."
          >
            <div className="grid gap-3">
              <InfoCard
                title="Loaded records"
                detail={`${people.length} crew member${people.length === 1 ? "" : "s"} currently in the shared roster.`}
              />
              <InfoCard
                title="Missing address"
                detail={`${missingAddressCount} ${missingAddressCount === 1 ? "record is" : "records are"} missing a saved address.`}
              />
              <InfoCard
                title="Missing phone"
                detail={`${missingPhoneCount} ${missingPhoneCount === 1 ? "record is" : "records are"} missing a phone number.`}
              />
            </div>
          </PeoplePanel>
        </div>
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

function InfoCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
      <p className="text-[13px] font-semibold text-[#1d1d1b]">{title}</p>
      <p className="mt-2 text-[13px] leading-6 text-[#6b6b67]">{detail}</p>
    </div>
  );
}

function FragmentRow({
  before,
  row,
}: {
  before: React.ReactNode;
  row: React.ReactNode;
}) {
  return (
    <>
      {before}
      {row}
    </>
  );
}
