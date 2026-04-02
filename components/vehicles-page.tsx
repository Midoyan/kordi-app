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
import { Car, PencilLine, Plus, Search, Trash2, Wrench } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
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
  createPerson,
  fetchPeople,
  getCachedPeopleSnapshot,
  getPersonSearchText,
  type PersonRecord,
} from "@/lib/people";
import {
  createLocalVehicleRecord,
  createVehicle,
  deleteVehicle,
  fetchVehicles,
  getCachedVehiclesSnapshot,
  hasFreshVehiclesCache,
  primeVehiclesCache,
  sortVehicles,
  updateVehicle,
  vehicleTypes,
  type VehicleDraft,
  type VehicleRecord,
  type VehicleType,
} from "@/lib/vehicles";
import { cn } from "@/lib/utils";

type VehicleAvailability = "Active" | "Inactive";
type PersistenceMode = "checking" | "connected" | "local-only";
type SheetMode = "create" | "edit";

type VehicleForm = {
  label: string;
  plateNumber: string;
  seatCapacity: string;
  vehicleType: VehicleType;
  availability: VehicleAvailability;
  driverCrewMemberId: string;
  driverName: string;
  notes: string;
};

type VehicleFieldError = {
  label?: string;
  plateNumber?: string;
  seatCapacity?: string;
  driver?: string;
};

const CREATE_DRIVER_VALUE_PREFIX = "__create-driver__:";

const initialForm: VehicleForm = {
  label: "",
  plateNumber: "",
  seatCapacity: "6",
  vehicleType: "Van",
  availability: "Active",
  driverCrewMemberId: "",
  driverName: "",
  notes: "",
};

const defaultColumnVisibility: VisibilityState = {
  select: false,
  status: false,
  plateNumber: false,
  seatCapacity: false,
};

const sampleVehicleForms: VehicleForm[] = [
  {
    label: "Sprinter 12",
    plateNumber: "8TRN214",
    seatCapacity: "8",
    vehicleType: "Van",
    availability: "Active",
    driverCrewMemberId: "",
    driverName: "",
    notes: "Stage door pickup. Keep rear cargo lane clear.",
  },
  {
    label: "Shuttle North",
    plateNumber: "9LAX552",
    seatCapacity: "12",
    vehicleType: "Shuttle",
    availability: "Active",
    driverCrewMemberId: "",
    driverName: "",
    notes: "Hotel loop until 11:00 AM.",
  },
  {
    label: "Runner 03",
    plateNumber: "7KRD118",
    seatCapacity: "5",
    vehicleType: "SUV",
    availability: "Inactive",
    driverCrewMemberId: "",
    driverName: "",
    notes: "Inspection due before next dispatch.",
  },
];

function toVehicleForm(vehicle: VehicleRecord): VehicleForm {
  return {
    label: vehicle.label,
    plateNumber: vehicle.plateNumber,
    seatCapacity: String(vehicle.seatCapacity || ""),
    vehicleType: vehicle.vehicleType,
    availability: vehicle.isActive ? "Active" : "Inactive",
    driverCrewMemberId: vehicle.crewMemberId ?? "",
    driverName: vehicle.driverName,
    notes: vehicle.notes,
  };
}

function availabilityTone(availability: VehicleAvailability) {
  switch (availability) {
    case "Active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Inactive":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-[#d7d7d2] bg-[#f3f3ef] text-[#6b6b67]";
  }
}

function buildSheetHref(pathname: string, searchParams: URLSearchParams, open: boolean) {
  const params = new URLSearchParams(searchParams.toString());

  if (open) {
    params.set("sheet", "add-vehicle");
  } else {
    params.delete("sheet");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function validateVehicleForm(form: VehicleForm) {
  const errors: VehicleFieldError = {};
  const seatCapacity = Number(form.seatCapacity);
  const driverName = form.driverName.trim();

  if (!form.label.trim()) {
    errors.label = "Enter a vehicle title.";
  }

  if (!form.plateNumber.trim()) {
    errors.plateNumber = "Enter the license plate.";
  }

  if (!form.seatCapacity.trim()) {
    errors.seatCapacity = "Enter a seat count.";
  } else if (!Number.isFinite(seatCapacity) || seatCapacity < 1) {
    errors.seatCapacity = "Capacity must be greater than 0.";
  }

  if (!driverName) {
    errors.driver = "Select or add a driver.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    driverName,
    draft: {
      label: form.label.trim(),
      plateNumber: form.plateNumber.trim(),
      seatCapacity,
      vehicleType: form.vehicleType,
      notes: form.notes.trim(),
      isActive: form.availability === "Active",
      crewMemberId: form.driverCrewMemberId.trim() || null,
    } satisfies VehicleDraft,
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

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Car;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
      <Icon className="size-4 text-[#4b4b46]" />
      <p className="mt-3 text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tracking-tight text-[#1d1d1b]">{value}</p>
      <p className="mt-1 text-[13px] text-[#6b6b67]">{detail}</p>
    </div>
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

export function VehiclesPage({ initialVehicles }: { initialVehicles?: VehicleRecord[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(initialVehicles ?? []);
  const [form, setForm] = useState<VehicleForm>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldError>({});
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [persistenceMode, setPersistenceMode] = useState<PersistenceMode>("checking");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [people, setPeople] = useState<PersonRecord[]>(() => getCachedPeopleSnapshot({ includeExpired: true }) ?? []);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [peopleLoadError, setPeopleLoadError] = useState<string | null>(null);
  const [isDriverPickerOpen, setIsDriverPickerOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  const isSheetOpen = searchParams.get("sheet") === "add-vehicle";
  const activeCount = vehicles.filter((vehicle) => vehicle.isActive).length;
  const inactiveCount = vehicles.length - activeCount;
  const totalSeats = vehicles.reduce((sum, vehicle) => sum + vehicle.seatCapacity, 0);
  const latestVehicle = vehicles[0];
  const normalizedDriverSearch = driverSearch.trim().toLowerCase();
  const filteredDriverOptions =
    normalizedDriverSearch.length === 0
      ? people.slice(0, 8)
      : people.filter((person) => getPersonSearchText(person).includes(normalizedDriverSearch)).slice(0, 8);
  const exactDriverMatch =
    normalizedDriverSearch.length === 0
      ? null
      : people.find((person) => person.name.trim().toLowerCase() === normalizedDriverSearch) ?? null;
  const shouldOfferCreateDriver = normalizedDriverSearch.length > 0 && exactDriverMatch === null;
  const selectedDriverValue =
    form.driverCrewMemberId ||
    (form.driverName.trim() ? `${CREATE_DRIVER_VALUE_PREFIX}${form.driverName.trim()}` : null);

  const loadVehicles = useCallback(async (options?: {
    background?: boolean;
    forceRefresh?: boolean;
    signal?: AbortSignal;
  }) => {
    const { background = false, forceRefresh = false, signal } = options ?? {};

    if (!background) {
      setIsLoading(true);
    }

    setLoadError(null);

    try {
      const nextVehicles = await fetchVehicles({
        forceRefresh,
        signal,
      });

      if (signal?.aborted) {
        return;
      }

      setVehicles(nextVehicles);
      setPersistenceMode("connected");
    } catch (error) {
      if (signal?.aborted) {
        return;
      }

      setPersistenceMode("local-only");
      setLoadError(error instanceof Error ? error.message : "Unable to load vans from the backend.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadPeople = useCallback(async () => {
    setPeopleLoadError(null);
    setIsLoadingPeople(true);

    try {
      const nextPeople = await fetchPeople();
      setPeople(nextPeople);
    } catch (error) {
      setPeopleLoadError(error instanceof Error ? error.message : "Unable to load crew members.");
    } finally {
      setIsLoadingPeople(false);
    }
  }, []);

  const resetSheetState = useCallback(() => {
    setForm(initialForm);
    setFieldErrors({});
    setSubmitMessage(null);
    setSheetMode("create");
    setEditingVehicleId(null);
    setDriverSearch("");
    setIsDriverPickerOpen(false);
    setIsSaving(false);
  }, []);

  const setSheetOpen = useCallback(
    (open: boolean) => {
      router.replace(buildSheetHref(pathname, new URLSearchParams(searchParams.toString()), open), {
        scroll: false,
      });

      if (!open) {
        resetSheetState();
      }
    },
    [pathname, resetSheetState, router, searchParams],
  );

  useEffect(() => {
    if (initialVehicles) {
      primeVehiclesCache(initialVehicles);
    }
  }, [initialVehicles]);

  useEffect(() => {
    const controller = new AbortController();
    const cachedVehicles = getCachedVehiclesSnapshot({ includeExpired: true });
    const hasFreshCache = hasFreshVehiclesCache();

    if (cachedVehicles !== null) {
      setVehicles(cachedVehicles);
      setIsLoading(false);
      setPersistenceMode("connected");
    } else if (initialVehicles) {
      setVehicles(initialVehicles);
      setIsLoading(false);
      setLoadError(null);
      setPersistenceMode("connected");
    }

    if (hasFreshCache) {
      return () => controller.abort();
    }

    void loadVehicles({
      background: cachedVehicles !== null || Boolean(initialVehicles),
      forceRefresh: true,
      signal: controller.signal,
    });

    return () => controller.abort();
  }, [initialVehicles, loadVehicles]);

  function openCreateSheet() {
    setSheetMode("create");
    setEditingVehicleId(null);
    setForm(initialForm);
    setFieldErrors({});
    setSubmitMessage(null);
    setDriverSearch("");
    setPeopleLoadError(null);
    void loadPeople();
    setSheetOpen(true);
  }

  function openEditSheet(vehicle: VehicleRecord) {
    setSheetMode("edit");
    setEditingVehicleId(vehicle.id);
    setForm(toVehicleForm(vehicle));
    setFieldErrors({});
    setSubmitMessage(null);
    setDriverSearch("");
    setPeopleLoadError(null);
    void loadPeople();
    setSheetOpen(true);
  }

  const columns: ColumnDef<VehicleRecord>[] = [
    {
      id: "select",
      meta: { label: "Select" },
      enableSorting: false,
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.label}`}
          />
        </div>
      ),
      header: ({ table }: HeaderContext<VehicleRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={
              table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            aria-label="Select all vehicles"
          />
        </div>
      ),
    },
    {
      accessorKey: "label",
      meta: { label: "Vehicle" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Vehicle"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="space-y-1 px-3">
          <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1b]">
            {row.original.label}
          </p>
          <p className="text-[12px] text-[#7a7a74]">
            Added {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "recently"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "vehicleType",
      meta: { label: "Type" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Type"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3">
          <span className="text-[12px] text-[#000000]">
            {row.original.vehicleType}
          </span>
        </div>
      ),
    },
    {
      accessorKey: "notes",
      meta: { label: "Notes" },
      enableSorting: false,
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Notes"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3">
          <p className="whitespace-normal text-[13px] leading-6 text-[#6b6b67]">
            {row.original.notes || "No notes"}
          </p>
        </div>
      ),
    },
    {
      id: "plateNumber",
      accessorFn: (row) => row.plateNumber,
      meta: { label: "Plate" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Plate"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3 text-[13px] text-[#43433f]">
          {row.original.plateNumber || "No plate"}
        </div>
      ),
    },
    {
      id: "seatCapacity",
      accessorFn: (row) => row.seatCapacity,
      meta: { label: "Capacity" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Capacity"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3 text-[13px] text-[#43433f]">
          {row.original.seatCapacity} seats
        </div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
      meta: { label: "Status" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Status"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => {
        const availability: VehicleAvailability = row.original.isActive ? "Active" : "Inactive";

        return (
          <div className="px-3">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${availabilityTone(availability)}`}
            >
              {availability}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
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
              void handleDeleteVehicle(row.original);
            }}
            disabled={deletingVehicleId === row.original.id}
          >
            <Trash2 />
            {deletingVehicleId === row.original.id ? "Removing..." : "Remove"}
          </Button>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: vehicles,
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

  function clearDriverFieldError() {
    setFieldErrors((current) => ({ ...current, driver: undefined }));
  }

  function selectExistingDriver(person: PersonRecord) {
    setForm((current) => ({
      ...current,
      driverCrewMemberId: person.id,
      driverName: person.name,
    }));
    clearDriverFieldError();
    setSubmitMessage(null);
    setDriverSearch("");
    setIsDriverPickerOpen(false);
  }

  function selectNewDriver(name: string) {
    const nextName = name.trim();

    setForm((current) => ({
      ...current,
      driverCrewMemberId: "",
      driverName: nextName,
    }));
    clearDriverFieldError();
    setSubmitMessage(null);
    setDriverSearch("");
    setIsDriverPickerOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateVehicleForm(form);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSubmitMessage("Fill in the required fields before saving the van.");
      return;
    }

    setFieldErrors({});
    setSubmitMessage(null);
    setIsSaving(true);
    const draft = validation.draft;

    try {
      const existingDriverMatch =
        validation.driverName.length === 0
          ? null
          : people.find((person) => person.name.trim().toLowerCase() === validation.driverName.toLowerCase()) ?? null;
      let resolvedDriverId = draft.crewMemberId ?? existingDriverMatch?.id ?? null;
      let resolvedDriverName = validation.driverName;

      if (!resolvedDriverId && persistenceMode === "connected") {
        const createdDriver = await createPerson({
          name: validation.driverName,
          address: "",
          phone: "",
        });

        resolvedDriverId = createdDriver.id;
        resolvedDriverName = createdDriver.name;
        setPeople((current) => [createdDriver, ...current.filter((person) => person.id !== createdDriver.id)]);
      }

      const vehicleDraft: VehicleDraft = {
        ...draft,
        crewMemberId:
          resolvedDriverId ??
          (persistenceMode === "connected"
            ? null
            : `local-driver-${validation.driverName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`),
      };

      if (persistenceMode === "connected") {
        if (!vehicleDraft.crewMemberId) {
          throw new Error("Select or add a driver before saving the van.");
        }

        const savedVehicle =
          sheetMode === "edit" && editingVehicleId
            ? await updateVehicle(editingVehicleId, vehicleDraft)
            : await createVehicle(vehicleDraft);

        setVehicles((current) => {
          if (sheetMode === "edit" && editingVehicleId) {
            return sortVehicles(
              current.map((vehicle) => (vehicle.id === savedVehicle.id ? savedVehicle : vehicle)),
            );
          }

          return sortVehicles([savedVehicle, ...current.filter((vehicle) => vehicle.id !== savedVehicle.id)]);
        });
      } else {
        const localId =
          sheetMode === "edit" && editingVehicleId
            ? editingVehicleId
            : `${vehicleDraft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
        const localVehicle = createLocalVehicleRecord(localId, vehicleDraft, {
          driverName: resolvedDriverName,
        });

        setVehicles((current) => {
          if (sheetMode === "edit" && editingVehicleId) {
            return sortVehicles(
              current.map((vehicle) => (vehicle.id === editingVehicleId ? localVehicle : vehicle)),
            );
          }

          return sortVehicles([localVehicle, ...current]);
        });
      }

      setSheetOpen(false);
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Unable to save van right now.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteVehicle(vehicle: VehicleRecord) {
    const confirmed = window.confirm(
      `Remove ${vehicle.label}? This also deletes any linked drives and pickup stops.`,
    );

    if (!confirmed) {
      return;
    }

    if (persistenceMode !== "connected") {
      setVehicles((current) => current.filter((entry) => entry.id !== vehicle.id));

      if (editingVehicleId === vehicle.id) {
        setSheetOpen(false);
      }

      return;
    }

    setDeletingVehicleId(vehicle.id);
    setLoadError(null);

    try {
      await deleteVehicle(vehicle.id);

      setVehicles((current) => current.filter((entry) => entry.id !== vehicle.id));

      if (editingVehicleId === vehicle.id) {
        setSheetOpen(false);
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to delete van right now.");
    } finally {
      setDeletingVehicleId(null);
    }
  }

  function fillSampleForm() {
    const template = sampleVehicleForms[Math.floor(Math.random() * sampleVehicleForms.length)];
    setForm((current) => ({
      ...template,
      driverCrewMemberId: current.driverCrewMemberId,
      driverName: current.driverName,
    }));
    setFieldErrors({});
    setSubmitMessage(null);
  }

  const saveButtonLabel = isSaving
    ? "Saving..."
    : sheetMode === "edit"
      ? "Save changes"
      : "Save van";
  const isDeletingEditedVehicle =
    sheetMode === "edit" &&
    editingVehicleId !== null &&
    deletingVehicleId === editingVehicleId;

  return (
    <>
      <div className="grid">
        <Panel
          title="Vehicles"
          description="Load and manage the vans."
          action={
            <button
              type="button"
              onClick={openCreateSheet}
              className="inline-flex items-center gap-2 rounded-md border border-[#1f1f1d] bg-[#1f1f1d] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#343431]"
            >
              <Plus className="size-4" />
              Add van
            </button>
          }
        >
          <div className="space-y-4">
            {persistenceMode === "local-only" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                <p className="font-medium">
                  A working vans CRUD/load path was not detected on load, so this page is falling
                  back to local-only mode until the `vans` table is reachable.
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
                    onClick={() => void loadVehicles({ forceRefresh: true })}
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
                Loading saved vans...
              </div>
            ) : (
              <WorkspaceDataTable
                table={table}
                dataIds={vehicles.map((vehicle) => vehicle.id)}
                toolbar={
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[13px] leading-6 text-[#6b6b67]">
                      {vehicles.length === 0
                        ? "No vans saved yet."
                        : `${vehicles.length} saved van${vehicles.length === 1 ? "" : "s"} ready for assignment.`}
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
                    columnId === "label" && "w-[24%]",
                    columnId === "vehicleType" && "w-[14%]",
                    columnId === "notes" && "w-[28%]",
                    columnId === "plateNumber" && "w-[12%]",
                    columnId === "seatCapacity" && "w-[12%]",
                    columnId === "status" && "w-[12%]",
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
                            No vans added yet.
                          </p>
                          <p className="mt-1 text-[13px] text-[#6b6b67]">
                            Keep fleet records in one shared table and show only the columns you need.
                          </p>
                        </div>
                        <Button type="button" variant="outline" onClick={openCreateSheet}>
                          Add first van
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

        {/* <Panel
          title="Fleet snapshot"
          description="Seat count and availability from the current vans list."
        >
          <div className="space-y-3">
            <MetricCard
              icon={Car}
              label="Fleet"
              value={String(vehicles.length)}
              detail={vehicles.length === 0 ? "No vans in the list yet." : "Vans currently tracked."}
            />
            <MetricCard
              icon={Wrench}
              label="Active"
              value={String(activeCount)}
              detail={
                vehicles.length === 0
                  ? "Availability will appear after vans are added."
                  : inactiveCount === 0
                    ? "Every van is marked active."
                    : `${inactiveCount} van${inactiveCount === 1 ? "" : "s"} currently inactive.`
              }
            />
            <MetricCard
              icon={Car}
              label="Capacity"
              value={String(totalSeats)}
              detail={
                vehicles.length === 0
                  ? "Total seat count will update as you add vans."
                  : `${totalSeats} total seat${totalSeats === 1 ? "" : "s"} across the fleet.`
              }
            />
          </div>
        </Panel> */}
      </div>

      <EditorSheetLayout
        open={isSheetOpen}
        onOpenChange={(open) => setSheetOpen(open)}
        title={sheetMode === "edit" ? "Edit van" : "Add van"}
        description="Create or update a van record with the fields stored in the backend."
      >
        <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="space-y-4 overflow-y-auto px-5 py-5">
            {submitMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                {submitMessage}
              </div>
            ) : null}

            <Field label="Vehicle name">
              <Input
                value={form.label}
                onChange={(event) => {
                  setForm((current) => ({ ...current, label: event.target.value }));
                  setFieldErrors((current) => ({ ...current, label: undefined }));
                  setSubmitMessage(null);
                }}
                placeholder="Sprinter 01"
                autoFocus
                aria-invalid={!!fieldErrors.label}
                className={fieldErrors.label ? "border-amber-300 focus-visible:border-amber-400" : undefined}
              />
              {fieldErrors.label ? (
                <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.label}</p>
              ) : null}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="License plate">
                <Input
                  value={form.plateNumber}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, plateNumber: event.target.value }));
                    setFieldErrors((current) => ({ ...current, plateNumber: undefined }));
                    setSubmitMessage(null);
                  }}
                  placeholder="ABC-1234"
                  aria-invalid={!!fieldErrors.plateNumber}
                  className={
                    fieldErrors.plateNumber ? "border-amber-300 focus-visible:border-amber-400" : undefined
                  }
                />
                {fieldErrors.plateNumber ? (
                  <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.plateNumber}</p>
                ) : null}
              </Field>

              <Field label="Type">
                <select
                  value={form.vehicleType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      vehicleType: event.target.value as VehicleType,
                    }))
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-[#1d1d1b] outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  {vehicleTypes.map((vehicleType) => (
                    <option key={vehicleType} value={vehicleType}>
                      {vehicleType}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Capacity">
                <Input
                  type="number"
                  min="1"
                  value={form.seatCapacity}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, seatCapacity: event.target.value }));
                    setFieldErrors((current) => ({ ...current, seatCapacity: undefined }));
                    setSubmitMessage(null);
                  }}
                  placeholder="6"
                  aria-invalid={!!fieldErrors.seatCapacity}
                  className={
                    fieldErrors.seatCapacity ? "border-amber-300 focus-visible:border-amber-400" : undefined
                  }
                />
                {fieldErrors.seatCapacity ? (
                  <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.seatCapacity}</p>
                ) : null}
              </Field>

              <Field label="Availability">
                <select
                  value={form.availability}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      availability: event.target.value as VehicleAvailability,
                    }))
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-[#1d1d1b] outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </Field>
            </div>

            <Field label="Driver">
              <Combobox<string>
                value={selectedDriverValue}
                onValueChange={(nextValue) => {
                  if (!nextValue) {
                    return;
                  }

                  if (nextValue.startsWith(CREATE_DRIVER_VALUE_PREFIX)) {
                    selectNewDriver(nextValue.slice(CREATE_DRIVER_VALUE_PREFIX.length));
                    return;
                  }

                  const person = people.find((entry) => entry.id === nextValue);

                  if (!person) {
                    return;
                  }

                  selectExistingDriver(person);
                }}
                open={isDriverPickerOpen}
                onOpenChange={(open) => {
                  setIsDriverPickerOpen(open);

                  if (open) {
                    setPeopleLoadError(null);
                    void loadPeople();
                    return;
                  }

                  setDriverSearch("");
                }}
                inputValue={driverSearch}
                onInputValueChange={(nextValue) => setDriverSearch(nextValue)}
                autoHighlight
                itemToStringLabel={(value) => {
                  if (value.startsWith(CREATE_DRIVER_VALUE_PREFIX)) {
                    return value.slice(CREATE_DRIVER_VALUE_PREFIX.length);
                  }

                  return people.find((person) => person.id === value)?.name ?? form.driverName;
                }}
              >
                <ComboboxTrigger
                  aria-invalid={fieldErrors.driver ? "true" : undefined}
                  className={cn(
                    "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-left text-sm text-[#1d1d1b] outline-none transition-colors hover:bg-[#fafaf7] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                    fieldErrors.driver ? "border-amber-300 focus-visible:border-amber-400" : undefined,
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <ComboboxValue placeholder="Select or add a driver">
                      {(value) => {
                        if (!value) {
                          return "Select or add a driver";
                        }

                        if (typeof value === "string" && value.startsWith(CREATE_DRIVER_VALUE_PREFIX)) {
                          return `New driver: ${value.slice(CREATE_DRIVER_VALUE_PREFIX.length)}`;
                        }

                        return people.find((person) => person.id === value)?.name ?? form.driverName;
                      }}
                    </ComboboxValue>
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#6b6b67]">
                    <Search className="size-3.5" />
                    Search
                  </span>
                </ComboboxTrigger>
                <ComboboxContent className="border border-[#e3e3df] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]">
                  <div className="p-1 pb-0">
                    <ComboboxInput
                      autoFocus
                      placeholder="Search crew members"
                      showTrigger={false}
                      className="w-full"
                    />
                  </div>
                  <ComboboxList>
                    <ComboboxEmpty>
                      {isLoadingPeople
                        ? "Loading crew members..."
                        : peopleLoadError
                          ? "Unable to load crew members."
                          : "No matching crew members."}
                    </ComboboxEmpty>
                    {shouldOfferCreateDriver ? (
                      <ComboboxItem
                        value={`${CREATE_DRIVER_VALUE_PREFIX}${driverSearch.trim()}`}
                        className="items-start gap-3 px-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                            Add {driverSearch.trim()}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                            Create this driver in the crew roster when the van is saved.
                          </p>
                        </div>
                      </ComboboxItem>
                    ) : null}
                    {filteredDriverOptions.map((person) => (
                      <ComboboxItem
                        key={person.id}
                        value={person.id}
                        className="items-start gap-3 px-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                            {person.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                            {person.phone || "No phone"}
                          </p>
                          {person.address ? (
                            <p className="mt-1 truncate text-[11px] text-[#8a8a84]">
                              {person.address}
                            </p>
                          ) : null}
                        </div>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {fieldErrors.driver ? (
                <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.driver}</p>
              ) : null}
              {!fieldErrors.driver && peopleLoadError ? (
                <p className="mt-2 text-[12px] text-amber-800">{peopleLoadError}</p>
              ) : null}
            </Field>

            <Field label="Notes">
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Parking bay B, keep fuel above half tank."
                rows={4}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm text-[#1d1d1b] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/50"
              />
            </Field>
          </div>

          <SheetFooter className="border-t border-[#e7e7e4] bg-white/80 px-5 py-4">
            <div className="flex w-full items-center justify-between gap-2">
              {sheetMode === "edit" && editingVehicleId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={isSaving || isDeletingEditedVehicle}
                  onClick={() => {
                    const vehicle = vehicles.find((entry) => entry.id === editingVehicleId);

                    if (!vehicle) {
                      return;
                    }

                    void handleDeleteVehicle(vehicle);
                  }}
                >
                  {deletingVehicleId === editingVehicleId ? "Deleting..." : "Delete van"}
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={fillSampleForm}>
                  Fill sample
                </Button>
              )}
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || isDeletingEditedVehicle}>
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
