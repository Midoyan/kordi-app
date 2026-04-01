"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { AddressAutofillInput } from "@/components/address-autofill-input";
import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { LocationMapPreview } from "@/components/location-map-preview";
import {
  WorkspaceColumnToggleMenu,
  WorkspaceDataTable,
} from "@/components/workspace-data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  createLocation,
  deleteLocation,
  fetchLocations,
  getCachedLocationsSnapshot,
  locationTypes,
  sortLocations,
  type LocationDraft,
  type LocationRecord,
  type LocationType,
  updateLocation,
} from "@/lib/locations";
import { cn } from "@/lib/utils";

type SheetMode = "create" | "edit";
type PersistenceMode = "checking" | "connected" | "local-only";
type LocationForm = LocationDraft;

type LocationFieldError = {
  name?: string;
  address?: string;
};

const initialForm: LocationForm = {
  name: "",
  type: "Pickup point",
  address: "",
  notes: "",
};

const demoSuggestionBias = {
  label: "Alexanderplatz 10178 Berlin",
  proximity: {
    lng: 13.413215,
    lat: 52.521918,
  },
} as const;

const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();

const demoLocationForms: LocationForm[] = [
  {
    name: "Artist Hotel Lobby",
    type: "Hotel",
    address: "Alexanderplatz 7, 10178 Berlin",
    notes: "Front canopy pickup only. Hold curbside no longer than 3 minutes.",
  },
  {
    name: "Venue East Gate",
    type: "Venue",
    address: "Karl-Liebknecht-Strasse 8, 10178 Berlin",
    notes: "Use gate C after load-in starts.",
  },
  {
    name: "Crew Meetup Point",
    type: "Pickup point",
    address: "Dircksenstrasse 2, 10179 Berlin",
    notes: "Meet beside the station taxi stand.",
  },
];

const defaultColumnVisibility: VisibilityState = {
  select: false,
};

function buildSheetHref(pathname: string, searchParams: URLSearchParams, open: boolean) {
  const params = new URLSearchParams(searchParams.toString());

  if (open) {
    params.set("sheet", "add-location");
  } else {
    params.delete("sheet");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function validateLocationForm(form: LocationForm) {
  const errors: LocationFieldError = {};
  const trimmedName = form.name.trim();
  const trimmedAddress = form.address.trim();

  if (!trimmedName) {
    errors.name = "Enter a location name.";
  }

  if (!trimmedAddress) {
    errors.address = "Enter an address.";
  }

  return {
    errors,
    trimmedAddress,
    trimmedName,
    isValid: Object.keys(errors).length === 0,
  };
}

function createLocalLocationRecord(
  id: string,
  payload: Pick<LocationForm, "name" | "type" | "address" | "notes">,
) {
  return {
    id,
    name: payload.name.trim(),
    type: payload.type,
    address: payload.address.trim(),
    notes: payload.notes.trim(),
    createdAt: new Date().toISOString(),
  } satisfies LocationRecord;
}

function toLocationForm(location: LocationRecord): LocationForm {
  return {
    name: location.name,
    type: location.type,
    address: location.address,
    notes: location.notes,
  };
}

function Panel({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#e3e3df] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
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
      <div
        className={cn(
          "px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase",
          className,
        )}
      >
        {label}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase hover:bg-[#f3f3ef] hover:text-[#1d1d1b]",
        className,
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

export function LocationsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [form, setForm] = useState<LocationForm>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<LocationFieldError>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>("checking");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const isSheetOpen = searchParams.get("sheet") === "add-location";
  const isDirty = Object.values(form).some((value) => value.trim().length > 0);

  const loadLocations = useCallback(async (options?: { forceRefresh?: boolean; signal?: AbortSignal }) => {
    const { forceRefresh = false, signal } = options ?? {};

    setIsLoading(true);
    setLoadError(null);

    try {
      const nextLocations = await fetchLocations({
        forceRefresh,
        signal,
      });

      if (signal?.aborted) {
        return;
      }

      setLocations(nextLocations);
      setPersistenceMode("connected");
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setPersistenceMode("local-only");
      setLoadError(
        error instanceof Error ? error.message : "Unable to load locations from the backend.",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const setSheetOpen = useCallback(
    (open: boolean, forceClose = false) => {
      if (!open && !forceClose && isDirty) {
        return;
      }

      router.replace(buildSheetHref(pathname, new URLSearchParams(searchParams.toString()), open), {
        scroll: false,
      });

      if (!open) {
        setForm(initialForm);
        setFieldErrors({});
        setSubmitMessage(null);
        setSheetMode("create");
        setEditingLocationId(null);
        setIsSaving(false);
      }
    },
    [isDirty, pathname, router, searchParams],
  );

  useEffect(() => {
    const controller = new AbortController();
    const cachedLocations = getCachedLocationsSnapshot();

    if (cachedLocations !== null) {
      setLocations(cachedLocations);
      setIsLoading(false);
    }

    void loadLocations({
      forceRefresh: cachedLocations !== null,
      signal: controller.signal,
    });

    return () => {
      controller.abort();
    };
  }, [loadLocations]);

  function openCreateSheet() {
    setSheetMode("create");
    setEditingLocationId(null);
    setForm(initialForm);
    setFieldErrors({});
    setSubmitMessage(null);
    setSheetOpen(true);
  }

  function openEditSheet(location: LocationRecord) {
    setSheetMode("edit");
    setEditingLocationId(location.id);
    setForm(toLocationForm(location));
    setFieldErrors({});
    setSubmitMessage(null);
    setSheetOpen(true);
  }

  const columns: ColumnDef<LocationRecord>[] = [
    {
      id: "select",
      meta: { label: "Select" },
      enableSorting: false,
      cell: ({ row }: CellContext<LocationRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.name}`}
          />
        </div>
      ),
      header: ({ table }: HeaderContext<LocationRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={
              table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            aria-label="Select all locations"
          />
        </div>
      ),
    },
    {
      accessorKey: "name",
      meta: { label: "Name" },
      header: ({ column }: HeaderContext<LocationRecord, unknown>) => (
        <ColumnHeader
          label="Name"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<LocationRecord, unknown>) => (
        <div className="space-y-1 px-3">
          <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1b]">
            {row.original.name}
          </p>
          <p className="text-[12px] text-[#7a7a74]">
            Added {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "recently"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "type",
      meta: { label: "Type" },
      header: ({ column }: HeaderContext<LocationRecord, unknown>) => (
        <ColumnHeader
          label="Type"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<LocationRecord, unknown>) => (
        <div className="px-3">
          <span className="inline-flex rounded-full border border-[#e2e2de] bg-[#f7f7f4] px-2.5 py-1 text-[11px] font-medium text-[#4b4b46]">
            {row.original.type}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "address",
      meta: { label: "Address" },
      enableSorting: false,
      header: ({ column }: HeaderContext<LocationRecord, unknown>) => (
        <ColumnHeader
          label="Address"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<LocationRecord, unknown>) => (
        <div className="px-3">
          <p className="whitespace-normal text-[13px] leading-6 text-[#43433f]">
            {row.original.address}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "notes",
      meta: { label: "Notes" },
      enableSorting: false,
      header: ({ column }: HeaderContext<LocationRecord, unknown>) => (
        <ColumnHeader
          label="Notes"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<LocationRecord, unknown>) => (
        <div className="px-3">
          <p className="whitespace-normal text-[13px] leading-6 text-[#6b6b67]">
            {row.original.notes || "No notes"}
          </p>
        </div>
      ),
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }: CellContext<LocationRecord, unknown>) => (
        <div className="flex items-center justify-end gap-1 px-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#5d5d58] hover:bg-[#f3f3ef] hover:text-[#1d1d1b]"
            onClick={() => openEditSheet(row.original)}
          >
            <PencilLine />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#8a4d42] hover:bg-[#fff3f0] hover:text-[#6f2f24]"
            onClick={() => {
              void handleDeleteLocation(row.original);
            }}
            disabled={deletingLocationId === row.original.id}
          >
            <Trash2 />
            {deletingLocationId === row.original.id ? "Removing..." : "Remove"}
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: locations,
    columns,
    state: {
      rowSelection,
      sorting,
      columnVisibility,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleColumns = table.getAllColumns().filter((column) => column.getCanHide());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateLocationForm(form);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSubmitMessage("Fill in the required fields before saving the location.");
      return;
    }

    setFieldErrors({});
    setSubmitMessage(null);
    setIsSaving(true);

      const payload: LocationDraft = {
        name: validation.trimmedName,
        type: form.type,
        address: validation.trimmedAddress,
        notes: form.notes.trim(),
      };

    try {
      if (persistenceMode === "connected") {
        const isEditing = sheetMode === "edit" && editingLocationId;
        const savedLocation = isEditing
          ? await updateLocation(editingLocationId, payload)
          : await createLocation(payload);

        setLocations((current) => {
          if (isEditing) {
            return sortLocations(
              current.map((location) =>
                location.id === savedLocation.id ? savedLocation : location,
              ),
            );
          }

          return sortLocations(
            [savedLocation, ...current.filter((location) => location.id !== savedLocation.id)],
          );
        });
      } else {
        const localId =
          sheetMode === "edit" && editingLocationId
            ? editingLocationId
            : `${validation.trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
        const localLocation = createLocalLocationRecord(localId, {
          name: validation.trimmedName,
          type: form.type,
          address: validation.trimmedAddress,
          notes: form.notes.trim(),
        });

        setLocations((current) => {
          if (sheetMode === "edit" && editingLocationId) {
            return sortLocations(
              current.map((location) =>
                location.id === editingLocationId ? localLocation : location,
              ),
            );
          }

          return sortLocations([localLocation, ...current]);
        });
      }

      setSheetOpen(false, true);
    } catch (error) {
      setSubmitMessage(
        error instanceof Error ? error.message : "Unable to save location right now.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteLocation(location: LocationRecord) {
    const confirmed = window.confirm(`Remove ${location.name}?`);

    if (!confirmed) {
      return;
    }

    if (persistenceMode !== "connected") {
      setLocations((current) => current.filter((entry) => entry.id !== location.id));

      if (editingLocationId === location.id) {
        setSheetOpen(false, true);
      }

      return;
    }

    setDeletingLocationId(location.id);
    setLoadError(null);

    try {
      await deleteLocation(location.id);

      setLocations((current) => current.filter((entry) => entry.id !== location.id));

      if (editingLocationId === location.id) {
        setSheetOpen(false, true);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Unable to delete location right now.",
      );
    } finally {
      setDeletingLocationId(null);
    }
  }

  function randomizeForm() {
    const template = demoLocationForms[Math.floor(Math.random() * demoLocationForms.length)];
    setForm(template);
    setFieldErrors({});
    setSubmitMessage(null);
  }

  const saveButtonLabel = isSaving
    ? "Saving..."
    : sheetMode === "edit"
      ? "Save changes"
      : "Save location";

  return (
    <>
      <div className="grid ">
        <Panel
          title="Locations"
          description="Save pickup points, venues, and shared destination records."
          action={
            <button
              type="button"
              onClick={openCreateSheet}
              className="inline-flex items-center gap-2 rounded-md border border-[#1f1f1d] bg-[#1f1f1d] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#343431]"
            >
              <Plus className="size-4" />
              Add location
            </button>
          }
        >
          <div className="space-y-4">
            {persistenceMode === "local-only" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                <p className="font-medium">
                  A working locations CRUD/load path was not detected on load, so this page is
                  falling back to local-only mode until the `locations` table is reachable.
                </p>
                <p className="mt-1 text-[12px] text-amber-800">
                  {loadError
                    ? loadError
                    : "Changes work in the UI, but they reset on refresh until persistence is available."}
                </p>
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-amber-300 bg-white/80 text-amber-900 hover:bg-white"
                    onClick={() => void loadLocations({ forceRefresh: true })}
                  >
                    Retry backend
                  </Button>
                </div>
              </div>
            ) : null}

            {persistenceMode === "connected" && loadError ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                {loadError}
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center rounded-lg border border-[#e7e7e4] bg-[#fafaf7] text-[13px] text-[#6b6b67]">
                Loading saved locations...
              </div>
            ) : (
              <WorkspaceDataTable
                table={table}
                dataIds={locations.map((location) => location.id)}
                toolbar={
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[13px] leading-6 text-[#6b6b67]">
                      {locations.length === 0
                        ? "No locations saved yet."
                        : `${locations.length} saved location${locations.length === 1 ? "" : "s"} ready for routing and reuse.`}
                    </p>
                    <WorkspaceColumnToggleMenu columns={visibleColumns} />
                  </div>
                }
                containerClassName="overflow-x-auto"
                tableClassName="min-w-[920px] table-fixed"
                headerClassName="bg-[#f7f7f4]"
                headerRowClassName="border-[#ecece8] hover:bg-transparent"
                getHeadClassName={(columnId) =>
                  cn(
                    "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-0 align-middle",
                    columnId === "select" && "w-[56px]",
                    columnId === "name" && "w-[20%]",
                    columnId === "type" && "w-[14%]",
                    columnId === "address" && "w-[34%]",
                    columnId === "notes" && "w-[22%]",
                    columnId === "actions" && "w-[10%]",
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
                            No locations added yet.
                          </p>
                          <p className="mt-1 text-[13px] text-[#6b6b67]">
                            Save pickup points, venues, and recurring stops in one shared table.
                          </p>
                        </div>
                        <Button type="button" variant="outline" onClick={openCreateSheet}>
                          Add first location
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                }
                renderRow={(row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? "selected" : undefined}
                    className="border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff]"
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
        </Panel>

      </div>

      <EditorSheetLayout
        open={isSheetOpen}
        onOpenChange={(open, eventDetails) =>
          setSheetOpen(open, !open && eventDetails?.reason === "close-press")
        }
        title={sheetMode === "edit" ? "Edit location" : "Add location"}
        description={
          sheetMode === "edit"
            ? "Update the saved stop, address, and routing notes."
            : "Save a reusable stop with type, address, and routing notes for the team."
        }
      >
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
            {submitMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                {submitMessage}
              </div>
            ) : null}

            <Field label="Location name">
              <Input
                value={form.name}
                onChange={(event) => {
                  setForm((current) => ({ ...current, name: event.target.value }));
                  setFieldErrors((current) => ({ ...current, name: undefined }));
                  setSubmitMessage(null);
                }}
                placeholder="Main venue entrance"
                autoFocus
                aria-invalid={!!fieldErrors.name}
                className={fieldErrors.name ? "border-amber-300 focus-visible:border-amber-400" : undefined}
              />
              {fieldErrors.name ? (
                <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.name}</p>
              ) : null}
            </Field>

            <Field label="Type">
              <select
                value={form.type}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    type: event.target.value as LocationType,
                  }))
                }
                className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-[#1d1d1b] outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
              >
                {locationTypes.map((locationType) => (
                  <option key={locationType} value={locationType}>
                    {locationType}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Address">
              <AddressAutofillInput
                value={form.address}
                onValueChange={(value) => {
                  setForm((current) => ({ ...current, address: value }));
                  setFieldErrors((current) => ({ ...current, address: undefined }));
                  setSubmitMessage(null);
                }}
                proximity={demoSuggestionBias.proximity}
                placeholder="123 Main St, Los Angeles, CA"
                aria-invalid={!!fieldErrors.address}
                className={fieldErrors.address ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                helperText={
                  fieldErrors.address
                    ? null
                    : `Demo bias enabled. Suggestions are weighted near ${demoSuggestionBias.label}.`
                }
              />
              {fieldErrors.address ? (
                <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.address}</p>
              ) : null}
            </Field>

            <Field label="Map">
              <LocationMapPreview
                address={form.address}
                accessToken={mapboxToken}
                proximity={demoSuggestionBias.proximity}
              />
            </Field>

            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => {
                  setForm((current) => ({ ...current, notes: event.target.value }));
                  setSubmitMessage(null);
                }}
                placeholder="Use side entrance after 6 PM, bus lane pickup only."
                rows={4}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
            </Field>
          </div>

          <SheetFooter className="border-t border-[#e7e7e4] bg-white/80 px-5 py-4">
            <div className="flex w-full items-center justify-between gap-2">
              <Button type="button" variant="outline" onClick={randomizeForm} disabled={isSaving}>
                Randomize demo
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSheetOpen(false, true)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {saveButtonLabel}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      </EditorSheetLayout>
    </>
  );
}
