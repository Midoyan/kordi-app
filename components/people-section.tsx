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
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  FileUp,
  PencilLine,
  Plus,
  Search,
} from "lucide-react";

import {
  PersonEditorSheet,
  type PersonDraft,
  type PersonRecord,
  type PersonStatus,
} from "@/components/person-editor-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type CheckboxState = boolean | "indeterminate";
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

const initialPeople: PersonRecord[] = [
  {
    id: "person-1",
    name: "Maya Bennett",
    role: "Lead vocalist",
    address: "145 Spring St, Nashville, TN",
    pickup: "Hotel lobby, 6:30 AM",
    email: "maya@northlane.studio",
    status: "Ready",
  },
  {
    id: "person-2",
    name: "Liam Ortega",
    role: "Production manager",
    address: "48 W 29th St, New York, NY",
    pickup: "Stage door, 11:45 AM",
    email: "liam@showflow.co",
    status: "Pending pickup",
  },
  {
    id: "person-3",
    name: "Sofia Nguyen",
    role: "Wardrobe",
    address: "88 Euclid Ave, Los Angeles, CA",
    pickup: "Crew entrance, 4:15 PM",
    email: "sofia@atelierworks.io",
    status: "Ready",
  },
];

function statusClasses(status: PersonStatus) {
  switch (status) {
    case "Ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Pending pickup":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Draft":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "Imported":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function toDraft(person: PersonRecord): PersonDraft {
  return {
    name: person.name,
    role: person.role,
    address: person.address,
    pickup: person.pickup,
    email: person.email,
    status: person.status,
  };
}

function createEmptyPerson(): PersonDraft {
  return {
    name: "",
    role: "",
    address: "",
    pickup: "",
    email: "",
    status: "Draft",
  };
}

function getSearchText(person: PersonRecord) {
  return [
    person.name,
    person.role,
    person.address,
    person.pickup,
    person.email,
    person.status,
  ]
    .join(" ")
    .toLowerCase();
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

function parseVCardEntry(card: string, index: number) {
  const lines = unfoldVCardLines(card);
  const fn = getFieldValues(lines, "FN")[0];
  const n = getFieldValues(lines, "N")[0];
  const role = getFieldValues(lines, "TITLE")[0] ?? getFieldValues(lines, "ROLE")[0];
  const email = getFieldValues(lines, "EMAIL")[0];
  const address =
    getFieldValues(lines, "ADR")[0] ?? getFieldValues(lines, "LABEL")[0] ?? "Address pending";
  const organization = getFieldValues(lines, "ORG")[0];
  const name = fn || (n ? formatNameFromN(n) : `Imported contact ${index + 1}`);

  return {
    id: `person-import-${Date.now()}-${index}`,
    name,
    role: role || organization || "Unassigned role",
    address: address.includes(";") ? formatAddress(address) : address,
    pickup: "Needs pickup plan",
    email: email || "No email on card",
    status: "Imported" as const,
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
    const text = dataTransfer.getData(transferType);
    appendPayload(text);
  }

  for (const transferType of vCardTransferTypes) {
    const text = dataTransfer.getData(transferType);
    appendPayload(text);
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
  isSorted,
  onClick,
  className,
}: {
  label: string;
  canSort: boolean;
  isSorted: false | "asc" | "desc";
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
      <ArrowUpDown
        size={14}
        className={cn(
          "size-3.5 text-[#a0a09a]",
          isSorted && "text-[#1d1d1b]",
        )}
      />
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
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isDragging, setIsDragging] = useState(false);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [lastImportNote, setLastImportNote] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit" | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [editorDraft, setEditorDraft] = useState<PersonDraft | null>(null);
  const [recentlyInsertedIds, setRecentlyInsertedIds] = useState<string[]>([]);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const insertAnimationTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
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
    setEditorDraft(createEmptyPerson());
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

  const openEditor = (person: PersonRecord) => {
    setEditorMode("edit");
    setEditingPersonId(person.id);
    setEditorDraft(toDraft(person));
  };

  const openCreateEditor = () => {
    setEditorMode("create");
    setEditingPersonId(null);
    setEditorDraft(createEmptyPerson());
    clearAddPersonQuery();
  };

  const columns: ColumnDef<PersonRecord>[] = [
    {
      id: "select",
      size: 4,
      header: ({ table }: HeaderContext<PersonRecord, unknown>) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(checked: CheckboxState) =>
              table.toggleAllPageRowsSelected(checked === true)
            }
            aria-label="Select all visible people"
          />
        </div>
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex items-start justify-center pt-1">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked: CheckboxState) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.name}`}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Name"
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="space-y-1">
          <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1b]">
            {row.original.name}
          </p>
          <p className="text-[12px] text-[#7a7a74]">
            {row.original.role}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "address",
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Address"
          canSort={false}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex items-start gap-2">
          {/* <MapPin size={14} className="mt-1 text-[#91918a]" /> */}
          <p className="whitespace-normal text-[13px] leading-6 text-[#43433f]">{row.original.address}</p>
        </div>
      ),
    },
    {
      accessorKey: "pickup",
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Pickup"
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <p className="whitespace-normal text-[13px] leading-6 text-[#43433f]">
          {row.original.pickup}
        </p>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Contact"
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex items-start gap-2">
          <p className="whitespace-normal text-[13px] leading-6 text-[#43433f]">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }: HeaderContext<PersonRecord, unknown>) => (
        <ColumnHeader
          label="Status"
          canSort={column.getCanSort()}
          isSorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div>
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em]",
              statusClasses(row.original.status),
            )}
          >
            {row.original.status}
          </span>
        </div>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => (
        <div className="text-right text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase">
          Actions
        </div>
      ),
      cell: ({ row }: CellContext<PersonRecord, unknown>) => (
        <div className="flex justify-start">
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

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable<PersonRecord>({
    data: people,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      globalFilter: deferredQuery,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    globalFilterFn: (row: Row<PersonRecord>, _columnId: string, filterValue: string) => {
      const searchValue = String(filterValue ?? "").trim().toLowerCase();

      if (!searchValue) {
        return true;
      }

      return getSearchText(row.original).includes(searchValue);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const visibleRows: Row<PersonRecord>[] = table.getRowModel().rows;

  const mergeImportedPeople = (payloads: string[], insertionIndexOverride?: number | null) => {
    const importedPeople = payloads.flatMap((payload) => parseVCardPayload(payload));

    if (importedPeople.length === 0) {
      setLastImportNote("No readable vCard entries were found in that drop.");
      return;
    }

    const visibleIds = table.getRowModel().rows.map((row) => row.original.id);

    setPeople((currentPeople) =>
      insertAtVisibleIndex(
        currentPeople,
        importedPeople,
        visibleIds,
        insertionIndexOverride ?? dropTargetIndex,
      ),
    );
    setRecentlyInsertedIds(importedPeople.map((person) => person.id));
    setLastImportNote(
      `Imported ${importedPeople.length} contact${importedPeople.length === 1 ? "" : "s"} into the local roster.`,
    );
    setDropTargetIndex(null);
    setIsDragging(false);

    if (insertAnimationTimeoutRef.current) {
      window.clearTimeout(insertAnimationTimeoutRef.current);
    }

    insertAnimationTimeoutRef.current = window.setTimeout(() => {
      setRecentlyInsertedIds([]);
    }, 1400);
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payloads = await readDroppedVCardPayloads(event.dataTransfer);
    mergeImportedPeople(payloads);
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
    mergeImportedPeople(payloads, visibleRows.length);
    event.target.value = "";
  };

  const saveEditedPerson = () => {
    if (!editorDraft) {
      return;
    }

    if (editorMode === "create") {
      setPeople((currentPeople) => [
        {
          id: `person-created-${Date.now()}`,
          ...editorDraft,
        },
        ...currentPeople,
      ]);
      setLastImportNote("Added a new person to the local roster.");
    } else if (editingPersonId) {
      setPeople((currentPeople) =>
        currentPeople.map((person) =>
          person.id === editingPersonId ? { ...person, ...editorDraft } : person,
        ),
      );
    }

    clearAddPersonQuery();
    setEditorMode(null);
    setEditingPersonId(null);
    setEditorDraft(null);
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.38fr_0.62fr]">
        <PeoplePanel
          title="People roster"
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
                  placeholder="Search name, role, pickup, email"
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
                >
                  <FileUp />
                  Import .vcf
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

            <div
              className={cn(
                "rounded-xl border border-[#e7e7e4] bg-white p-2 transition-all",
                isDragging && "border-dashed border-[#90a8ff] bg-[#f7f9ff]",
              )}
              onDrop={onDrop}
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
                  {isDragging ? "Release to import this vCard." : defaultDropPrompt}
                </p>
                {lastImportNote ? (
                  <p className="mt-1 text-[11px] leading-5 text-[#6b6b67]">
                    {lastImportNote}
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
                              header.column.id === "select" && "w-11",
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
                    {visibleRows.length === 0 ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={table.getVisibleLeafColumns().length}
                          className="py-14 text-center text-[13px] text-[#6b6b67]"
                        >
                          No matching people yet. Drop a vCard, import a `.vcf`, or add a draft row.
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
                                      <div className="h-7 rounded-lg border border-dashed border-[#9db1ff] bg-[#eef3ff] animate-in fade-in zoom-in-95" />
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ) : null
                            }
                            row={
                              <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() ? "selected" : undefined}
                                className={cn(
                                  "border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff]",
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
                                      cell.column.id === "select" && "py-4",
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
                                <div className="h-7 rounded-lg border border-dashed border-[#9db1ff] bg-[#eef3ff] animate-in fade-in zoom-in-95" />
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
                  Rows are locally editable through the row action. Sorting, selection, filtering,
                  and drop placement are ready before backend CRUD is connected.
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
            title="Editing flow"
            description="Use the row action rather than inline editing so the table stays readable."
          >
            <div className="grid gap-3">
              <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
                <p className="text-[13px] font-semibold text-[#1d1d1b]">Sheet editor</p>
                <p className="mt-2 text-[13px] leading-6 text-[#6b6b67]">
                  Each row has an `Edit` action. Pressing it opens a sheet where the contact can be
                  updated without breaking the table layout.
                </p>
              </div>
              <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
                <p className="text-[13px] font-semibold text-[#1d1d1b]">Drop placement</p>
                <p className="mt-2 text-[13px] leading-6 text-[#6b6b67]">
                  While dragging a vCard, the table shows an animated landing lane between rows so
                  the insertion point is visible before drop.
                </p>
              </div>
            </div>
          </PeoplePanel>

          <PeoplePanel
            title="Working mode"
            description="No backend required for this design pass."
          >
            <div className="grid gap-3">
              <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
                <p className="text-[13px] font-semibold text-[#1d1d1b]">Local state only</p>
                <p className="mt-2 text-[13px] leading-6 text-[#6b6b67]">
                  Draft rows, sheet edits, selection, and imports all work without a database. The
                  data resets on refresh until persistence is added.
                </p>
              </div>
              <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
                <p className="text-[13px] font-semibold text-[#1d1d1b]">Built for CRUD later</p>
                <p className="mt-2 text-[13px] leading-6 text-[#6b6b67]">
                  The sheet save handler and row model can be connected to create, update, and
                  delete mutations later without redesigning the page.
                </p>
              </div>
            </div>
          </PeoplePanel>
        </div>
      </div>

      <PersonEditorSheet
        draft={editorDraft}
        mode={editorMode}
        open={Boolean(editorDraft)}
        onClose={() => {
          clearAddPersonQuery();
          setEditorMode(null);
          setEditingPersonId(null);
          setEditorDraft(null);
        }}
        onSave={saveEditedPerson}
        setDraft={setEditorDraft}
      />
    </>
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
