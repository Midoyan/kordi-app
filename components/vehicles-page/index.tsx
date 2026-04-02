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

import { createVehicleColumns } from "@/components/vehicles-page/columns";
import { VehicleEditorSheet } from "@/components/vehicles-page/editor-sheet";
import { VehiclesTableSection } from "@/components/vehicles-page/table";
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
  createLocalVehicleRecord,
  createVehicle,
  deleteVehicle,
  fetchVehicles,
  getCachedVehiclesSnapshot,
  hasFreshVehiclesCache,
  primeVehiclesCache,
  sortVehicles,
  updateVehicle,
  type VehicleRecord,
} from "@/lib/vehicles";

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

  const isSheetOpen = searchParams.get("sheet") === "add-vehicle";

  const loadVehicles = useCallback(
    async (options?: {
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
    },
    [],
  );

  const resetSheetState = useCallback(() => {
    setForm(initialForm);
    setFieldErrors({});
    setSubmitMessage(null);
    setSheetMode("create");
    setEditingVehicleId(null);
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
    setSheetOpen(true);
  }

  function openEditSheet(vehicle: VehicleRecord) {
    setSheetMode("edit");
    setEditingVehicleId(vehicle.id);
    setForm(toVehicleForm(vehicle));
    setFieldErrors({});
    setSubmitMessage(null);
    setSheetOpen(true);
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
      if (persistenceMode === "connected") {
        const savedVehicle =
          sheetMode === "edit" && editingVehicleId
            ? await updateVehicle(editingVehicleId, draft)
            : await createVehicle(draft);

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
            : `${draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
        const localVehicle = createLocalVehicleRecord(localId, draft);

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
    setForm(template);
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
        vehicles={vehicles}
        form={form}
        fieldErrors={fieldErrors}
        submitMessage={submitMessage}
        setForm={setForm}
        setFieldErrors={setFieldErrors}
        setSubmitMessage={setSubmitMessage}
        onOpenChange={setSheetOpen}
        onSubmit={handleSubmit}
        onDeleteVehicle={handleDeleteVehicle}
        onFillSample={fillSampleForm}
      />
    </>
  );
}
