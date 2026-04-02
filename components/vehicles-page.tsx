"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Car, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
import {
  createLocalVehicleRecord,
  createVehicle,
  deleteVehicle,
  fetchVehicles,
  getCachedVehiclesSnapshot,
  sortVehicles,
  updateVehicle,
  vehicleTypes,
  type VehicleDraft,
  type VehicleRecord,
  type VehicleType,
} from "@/lib/vehicles";

type VehicleAvailability = "Active" | "Inactive";
type PersistenceMode = "checking" | "connected" | "local-only";
type SheetMode = "create" | "edit";

type VehicleForm = {
  label: string;
  plateNumber: string;
  seatCapacity: string;
  vehicleType: VehicleType;
  availability: VehicleAvailability;
  notes: string;
};

type VehicleFieldError = {
  label?: string;
  plateNumber?: string;
  seatCapacity?: string;
};

const initialForm: VehicleForm = {
  label: "",
  plateNumber: "",
  seatCapacity: "6",
  vehicleType: "Van",
  availability: "Active",
  notes: "",
};

const sampleVehicleForms: VehicleForm[] = [
  {
    label: "Sprinter 12",
    plateNumber: "8TRN214",
    seatCapacity: "8",
    vehicleType: "Van",
    availability: "Active",
    notes: "Stage door pickup. Keep rear cargo lane clear.",
  },
  {
    label: "Shuttle North",
    plateNumber: "9LAX552",
    seatCapacity: "12",
    vehicleType: "Shuttle",
    availability: "Active",
    notes: "Hotel loop until 11:00 AM.",
  },
  {
    label: "Runner 03",
    plateNumber: "7KRD118",
    seatCapacity: "5",
    vehicleType: "SUV",
    availability: "Inactive",
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

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    draft: {
      label: form.label.trim(),
      plateNumber: form.plateNumber.trim(),
      seatCapacity,
      vehicleType: form.vehicleType,
      notes: form.notes.trim(),
      isActive: form.availability === "Active",
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

function EmptyFleetState({ onAddVehicle }: { onAddVehicle: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) repeat(4, minmax(0, 1fr))" }}
      >
        {["Vehicle", "Plate", "Type", "Capacity", "Status"].map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <p className="text-[14px] font-medium text-[#1d1d1b]">No vans added yet.</p>
        <button
          type="button"
          onClick={onAddVehicle}
          className="rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-[#f3f3ef]"
        >
          Add first van
        </button>
      </div>
    </div>
  );
}

function FleetTable({
  vehicles,
  deletingVehicleId,
  onEditVehicle,
  onDeleteVehicle,
}: {
  vehicles: VehicleRecord[];
  deletingVehicleId: string | null;
  onEditVehicle: (vehicle: VehicleRecord) => void;
  onDeleteVehicle: (vehicle: VehicleRecord) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) repeat(4, minmax(0, 1fr)) 112px" }}
      >
        {["Vehicle", "Plate", "Type", "Capacity", "Status", ""].map((column, index) => (
          <span key={`${column}-${index}`}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[#ecece8]">
        {vehicles.map((vehicle) => {
          const availability: VehicleAvailability = vehicle.isActive ? "Active" : "Inactive";

          return (
            <div
              key={vehicle.id}
              className="grid items-center gap-3 px-4 py-4 text-[13px] text-[#3d3d39]"
              style={{ gridTemplateColumns: "minmax(0,1.2fr) repeat(4, minmax(0, 1fr)) 112px" }}
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{vehicle.label}</p>
                <p className="mt-1 truncate text-[12px] text-[#6b6b67]">
                  {vehicle.notes || "No notes added"}
                </p>
              </div>
              <span className="truncate">{vehicle.plateNumber || "No plate"}</span>
              <span>{vehicle.vehicleType}</span>
              <span>{vehicle.seatCapacity} seats</span>
              <span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${availabilityTone(availability)}`}
                >
                  {availability}
                </span>
              </span>
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-[#5f5f59]"
                  onClick={() => onEditVehicle(vehicle)}
                  aria-label={`Edit ${vehicle.label}`}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-[#8a3b34] hover:text-[#8a3b34]"
                  onClick={() => onDeleteVehicle(vehicle)}
                  disabled={deletingVehicleId === vehicle.id}
                  aria-label={`Delete ${vehicle.label}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
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

export function VehiclesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
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

  const isSheetOpen = searchParams.get("sheet") === "add-vehicle";
  const activeCount = vehicles.filter((vehicle) => vehicle.isActive).length;
  const inactiveCount = vehicles.length - activeCount;
  const totalSeats = vehicles.reduce((sum, vehicle) => sum + vehicle.seatCapacity, 0);
  const latestVehicle = vehicles[0];

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
    const controller = new AbortController();
    const cachedVehicles = getCachedVehiclesSnapshot();

    if (cachedVehicles !== null) {
      setVehicles(cachedVehicles);
      setIsLoading(false);
    }

    void loadVehicles({
      background: cachedVehicles !== null,
      forceRefresh: cachedVehicles !== null,
      signal: controller.signal,
    });

    return () => controller.abort();
  }, [loadVehicles]);

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
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Panel
          title="Vehicles"
          description="Load and manage the vans table with real backend CRUD."
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
            ) : vehicles.length === 0 ? (
              <EmptyFleetState onAddVehicle={openCreateSheet} />
            ) : (
              <FleetTable
                vehicles={vehicles}
                deletingVehicleId={deletingVehicleId}
                onEditVehicle={openEditSheet}
                onDeleteVehicle={handleDeleteVehicle}
              />
            )}
          </div>
        </Panel>

        <Panel
          title="Fleet snapshot"
          description="Seat count and availability are now derived from the vans backend."
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
            {latestVehicle ? (
              <div className="rounded-lg border border-[#e7e7e4] px-4 py-3">
                <p className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
                  Latest van
                </p>
                <p className="mt-2 text-[14px] font-medium text-[#1d1d1b]">{latestVehicle.label}</p>
                <p className="mt-1 text-[13px] text-[#6b6b67]">
                  {[latestVehicle.vehicleType, latestVehicle.plateNumber].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-1 text-[13px] text-[#6b6b67]">
                  {latestVehicle.seatCapacity} seats · {latestVehicle.isActive ? "active" : "inactive"}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>
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
