"use client";

import {
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { useCacheSnapshot } from "@/hooks/use-cache-snapshot";
import { createVehicleColumns } from "@/components/vehicles-page/columns";
import { VehicleEditorSheet } from "@/components/vehicles-page/editor-sheet";
import { VehiclesTableSection } from "@/components/vehicles-page/table-section";
import {
  defaultColumnVisibility,
  initialForm,
  sampleVehicleForms,
  toVehicleForm,
  validateVehicleForm,
  type PersistenceMode,
  type SheetMode,
  type VehicleFieldError,
  type VehicleForm,
} from "@/components/vehicles-page/types";
import { buildSheetHref } from "@/components/vehicles-page/ui";
import {
  createPerson,
  fetchBasicPeople,
  getCachedPeopleSnapshot,
  subscribePeopleCache,
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
  subscribeVehiclesCache,
  updateVehicle,
  type VehicleDraft,
  type VehicleRecord,
  type VehicleType,
} from "@/lib/vehicles";

export function VehiclesPage({ initialVehicles }: { initialVehicles?: VehicleRecord[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cachedVehiclesSnapshot = useCacheSnapshot(
    subscribeVehiclesCache,
    () => getCachedVehiclesSnapshot({ includeExpired: true }),
    () => initialVehicles ?? null,
  );
  const cachedPeopleSnapshot = useCacheSnapshot(
    subscribePeopleCache,
    () => getCachedPeopleSnapshot({ includeExpired: true }),
    () => null,
  );
  const [vehicles, setVehicles] = useState<VehicleRecord[]>(() => cachedVehiclesSnapshot ?? initialVehicles ?? []);
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
  const [people, setPeople] = useState<PersonRecord[]>(() => cachedPeopleSnapshot ?? []);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [peopleLoadError, setPeopleLoadError] = useState<string | null>(null);
  const [isDriverPickerOpen, setIsDriverPickerOpen] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");

  const isSheetOpen = searchParams.get("sheet") === "add-vehicle";

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
      const nextPeople = await fetchBasicPeople();
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
    if (persistenceMode === "local-only") {
      return;
    }

    if (cachedVehiclesSnapshot !== null) {
      setVehicles(cachedVehiclesSnapshot);
      setIsLoading(false);
      setLoadError(null);

      if (persistenceMode === "checking") {
        setPersistenceMode("connected");
      }

      return;
    }

    if (initialVehicles) {
      setVehicles(initialVehicles);
      setIsLoading(false);
      setLoadError(null);

      if (persistenceMode === "checking") {
        setPersistenceMode("connected");
      }
    }
  }, [cachedVehiclesSnapshot, initialVehicles, persistenceMode]);

  useEffect(() => {
    if (cachedPeopleSnapshot === null) {
      return;
    }

    setPeople(cachedPeopleSnapshot);
    setPeopleLoadError(null);
  }, [cachedPeopleSnapshot]);

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

  function clearSelectedDriver() {
    setForm((current) => ({
      ...current,
      driverCrewMemberId: "",
      driverName: "",
    }));
    clearDriverFieldError();
    setSubmitMessage(null);
    setDriverSearch("");
    setIsDriverPickerOpen(false);
  }

  function updateTextField(field: "label" | "plateNumber" | "seatCapacity", value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitMessage(null);
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

      if (!resolvedDriverId && validation.driverName && persistenceMode === "connected") {
        const createdDriver = await createPerson({
          name: validation.driverName,
          address: "",
          phone: "",
          role: "Driver",
        });

        resolvedDriverId = createdDriver.id;
        resolvedDriverName = createdDriver.name;
        setPeople((current) => [createdDriver, ...current.filter((person) => person.id !== createdDriver.id)]);
      }

      const vehicleDraft: VehicleDraft = {
        ...draft,
        crewMemberId: resolvedDriverId,
      };

      if (persistenceMode === "connected") {
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

  const columns = createVehicleColumns({
    deletingVehicleId,
    onEditVehicle: openEditSheet,
    onDeleteVehicle: handleDeleteVehicle,
  });

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
        <VehiclesTableSection
          table={table}
          vehicles={vehicles}
          visibleColumns={visibleColumns}
          isLoading={isLoading}
          loadError={loadError}
          persistenceMode={persistenceMode}
          onRetry={() => void loadVehicles({ forceRefresh: true })}
          onOpenCreate={openCreateSheet}
        />
      </div>

      <VehicleEditorSheet
        open={isSheetOpen}
        sheetMode={sheetMode}
        editingVehicleId={editingVehicleId}
        deletingVehicleId={deletingVehicleId}
        isSaving={isSaving}
        isDeletingEditedVehicle={isDeletingEditedVehicle}
        saveButtonLabel={saveButtonLabel}
        form={form}
        fieldErrors={fieldErrors}
        submitMessage={submitMessage}
        vehicles={vehicles}
        people={people}
        isLoadingPeople={isLoadingPeople}
        peopleLoadError={peopleLoadError}
        isDriverPickerOpen={isDriverPickerOpen}
        driverSearch={driverSearch}
        onOpenChange={setSheetOpen}
        onSubmit={handleSubmit}
        onDeleteVehicle={handleDeleteVehicle}
        onFillSample={fillSampleForm}
        onDriverPickerOpenChange={(open) => {
          setIsDriverPickerOpen(open);

          if (open) {
            setPeopleLoadError(null);
            void loadPeople();
            return;
          }

          setDriverSearch("");
        }}
        onDriverSearchChange={setDriverSearch}
        onSelectExistingDriver={selectExistingDriver}
        onSelectNewDriver={selectNewDriver}
        onClearDriver={clearSelectedDriver}
        onLabelChange={(value) => updateTextField("label", value)}
        onPlateNumberChange={(value) => updateTextField("plateNumber", value)}
        onSeatCapacityChange={(value) => updateTextField("seatCapacity", value)}
        onVehicleTypeChange={(value: VehicleType) =>
          setForm((current) => ({ ...current, vehicleType: value }))
        }
        onAvailabilityChange={(value) =>
          setForm((current) => ({ ...current, availability: value }))
        }
        onNotesChange={(value) => setForm((current) => ({ ...current, notes: value }))}
      />
    </>
  );
}
