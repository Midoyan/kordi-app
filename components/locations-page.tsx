"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  MapPin,
  PencilLine,
  Plus,
  Route,
  Trash2,
  X,
} from "lucide-react";
import { type FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

import { AddressAutofillInput } from "@/components/address-autofill-input";
import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { LocationMapPreview } from "@/components/location-map-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";

const locationTypes = [
  "Pickup point",
  "Venue",
  "Hotel",
  "Airport",
  "Other",
] as const;

type LocationType = (typeof locationTypes)[number];
type SheetMode = "create" | "edit";
type PersistenceMode = "checking" | "connected" | "local-only";

type LocationRecord = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  zone: string;
  notes: string;
  createdAt: string | null;
};

type LocationApiRecord = {
  id: string | number;
  name: string | null;
  type: string | null;
  address: string | null;
  zone: string | null;
  notes: string | null;
  created_at?: string | null;
};

type LocationForm = {
  name: string;
  type: LocationType;
  address: string;
  zone: string;
  notes: string;
};

type LocationFieldError = {
  name?: string;
  address?: string;
};

const initialForm: LocationForm = {
  name: "",
  type: "Pickup point",
  address: "",
  zone: "",
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
    zone: "Mitte",
    notes: "Front canopy pickup only. Hold curbside no longer than 3 minutes.",
  },
  {
    name: "Venue East Gate",
    type: "Venue",
    address: "Karl-Liebknecht-Strasse 8, 10178 Berlin",
    zone: "Alexanderplatz",
    notes: "Use gate C after load-in starts.",
  },
  {
    name: "Crew Meetup Point",
    type: "Pickup point",
    address: "Dircksenstrasse 2, 10179 Berlin",
    zone: "Mitte",
    notes: "Meet beside the station taxi stand.",
  },
];

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

function isLocationType(value: string): value is LocationType {
  return locationTypes.includes(value as LocationType);
}

function normalizeLocationRecord(record: LocationApiRecord): LocationRecord {
  return {
    id: String(record.id),
    name: typeof record.name === "string" && record.name.trim() ? record.name.trim() : "Untitled location",
    type:
      typeof record.type === "string" && isLocationType(record.type) ? record.type : "Other",
    address: typeof record.address === "string" ? record.address : "",
    zone: typeof record.zone === "string" ? record.zone : "",
    notes: typeof record.notes === "string" ? record.notes : "",
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
  };
}

function createLocalLocationRecord(
  id: string,
  payload: Pick<LocationForm, "name" | "type" | "address" | "zone" | "notes">,
) {
  return {
    id,
    name: payload.name.trim(),
    type: payload.type,
    address: payload.address.trim(),
    zone: payload.zone.trim(),
    notes: payload.notes.trim(),
    createdAt: new Date().toISOString(),
  } satisfies LocationRecord;
}

function sortLocations(records: LocationRecord[]) {
  return [...records].sort((first, second) => {
    const firstTimestamp = first.createdAt ? Date.parse(first.createdAt) : Number.NEGATIVE_INFINITY;
    const secondTimestamp = second.createdAt
      ? Date.parse(second.createdAt)
      : Number.NEGATIVE_INFINITY;

    if (Number.isFinite(firstTimestamp) || Number.isFinite(secondTimestamp)) {
      return secondTimestamp - firstTimestamp;
    }

    return first.name.localeCompare(second.name);
  });
}

function toLocationForm(location: LocationRecord): LocationForm {
  return {
    name: location.name,
    type: location.type,
    address: location.address,
    zone: location.zone,
    notes: location.notes,
  };
}

function formatApiError(payload: unknown, fallbackMessage: string) {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  const errorMessage =
    "error" in payload && typeof payload.error === "string" ? payload.error : null;

  return errorMessage?.trim() || fallbackMessage;
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

function EmptyLocationsState({ onAddLocation }: { onAddLocation: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{
          gridTemplateColumns:
            "minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,0.8fr)",
        }}
      >
        {["Name", "Type", "Address", "Zone", "Notes", "Actions"].map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <p className="text-[14px] font-medium text-[#1d1d1b]">No locations added yet.</p>
        <button
          type="button"
          onClick={onAddLocation}
          className="rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-[#f3f3ef]"
        >
          Add first location
        </button>
      </div>
    </div>
  );
}

function LocationsTable({
  locations,
  deletingLocationId,
  onDeleteLocation,
  onEditLocation,
}: {
  locations: LocationRecord[];
  deletingLocationId: string | null;
  onDeleteLocation: (location: LocationRecord) => void;
  onEditLocation: (location: LocationRecord) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{
          gridTemplateColumns:
            "minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,0.8fr)",
        }}
      >
        {["Name", "Type", "Address", "Zone", "Notes", "Actions"].map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[#ecece8]">
        {locations.map((location) => (
          <div
            key={location.id}
            className="grid items-center gap-3 px-4 py-4 text-[13px] text-[#3d3d39]"
            style={{
              gridTemplateColumns:
                "minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,0.8fr) minmax(0,1fr) minmax(0,0.8fr)",
            }}
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{location.name}</p>
            </div>
            <span>{location.type}</span>
            <span className="truncate">{location.address}</span>
            <span className="truncate">{location.zone || "Unassigned"}</span>
            <span className="truncate text-[#6b6b67]">{location.notes || "No notes"}</span>
            <div className="flex items-center justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[#5d5d58] hover:bg-[#f3f3ef] hover:text-[#1d1d1b]"
                onClick={() => onEditLocation(location)}
              >
                <PencilLine />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[#8a4d42] hover:bg-[#fff3f0] hover:text-[#6f2f24]"
                onClick={() => onDeleteLocation(location)}
                disabled={deletingLocationId === location.id}
              >
                <Trash2 />
                {deletingLocationId === location.id ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        ))}
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
  icon: typeof MapPin;
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

  const isSheetOpen = searchParams.get("sheet") === "add-location";
  const pickupPointCount = locations.filter((location) => location.type === "Pickup point").length;
  const uniqueZonesCount = new Set(
    locations.map((location) => location.zone.trim()).filter(Boolean),
  ).size;
  const latestLocation = locations[0];
  const isDirty = Object.values(form).some((value) => value.trim().length > 0);

  const loadLocations = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/locations", {
        cache: "no-store",
        signal,
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          formatApiError(payload, "Unable to load locations from the backend."),
        );
      }

      if (signal?.aborted) {
        return;
      }

      const nextLocations = Array.isArray(payload)
        ? sortLocations(payload.map((record) => normalizeLocationRecord(record as LocationApiRecord)))
        : [];

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

    void loadLocations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadLocations]);

  useEffect(() => {
    if (!isSheetOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheetOpen(false, true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isSheetOpen, setSheetOpen]);

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

    const payload = {
      name: validation.trimmedName,
      type: form.type,
      address: validation.trimmedAddress,
      zone: form.zone.trim(),
      notes: form.notes.trim(),
    };

    try {
      if (persistenceMode === "connected") {
        const isEditing = sheetMode === "edit" && editingLocationId;
        const response = await fetch(
          isEditing ? `/api/locations/${editingLocationId}` : "/api/locations",
          {
            method: isEditing ? "PATCH" : "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          },
        );
        const result = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            formatApiError(
              result,
              isEditing ? "Unable to update location." : "Unable to save location.",
            ),
          );
        }

        const savedLocation = normalizeLocationRecord(result as LocationApiRecord);

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
            : `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
        const localLocation = createLocalLocationRecord(localId, payload);

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
      const response = await fetch(`/api/locations/${location.id}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(formatApiError(payload, "Unable to delete location."));
      }

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
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
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
                    onClick={() => void loadLocations()}
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
            ) : locations.length === 0 ? (
              <EmptyLocationsState onAddLocation={openCreateSheet} />
            ) : (
              <LocationsTable
                locations={locations}
                deletingLocationId={deletingLocationId}
                onDeleteLocation={handleDeleteLocation}
                onEditLocation={openEditSheet}
              />
            )}
          </div>
        </Panel>

        <Panel
          title="Location snapshot"
          description="Quick coverage for pickup points, shared zones, and the latest saved stop."
        >
          <div className="flex flex-col gap-3">
            <MetricCard
              icon={MapPin}
              label="Locations"
              value={String(locations.length)}
              detail={
                isLoading
                  ? "Loading saved places..."
                  : locations.length === 0
                    ? "No saved places yet."
                    : "Saved pickup points and shared destinations."
              }
            />
            <MetricCard
              icon={Route}
              label="Pickup points"
              value={String(pickupPointCount)}
              detail={
                isLoading
                  ? "Loading pickup coverage..."
                  : locations.length === 0
                    ? "Pickup count updates as you add places."
                    : `${pickupPointCount} location${pickupPointCount === 1 ? "" : "s"} ready for route planning.`
              }
            />
            <MetricCard
              icon={Building2}
              label="Zones"
              value={String(uniqueZonesCount)}
              detail={
                isLoading
                  ? "Loading zone coverage..."
                  : locations.length === 0
                    ? "Zone coverage will appear here."
                    : uniqueZonesCount === 0
                      ? "No zones assigned yet."
                      : `${uniqueZonesCount} zone${uniqueZonesCount === 1 ? "" : "s"} currently represented.`
              }
            />
            <div className="rounded-lg border border-[#e7e7e4] bg-[#fafaf7] p-4">
              {isLoading ? (
                <div className="flex min-h-40 flex-col items-center justify-center text-center">
                  <MapPin className="size-5 text-[#4b4b46]" />
                  <p className="mt-3 text-[14px] font-medium text-[#1d1d1b]">
                    Loading latest location
                  </p>
                </div>
              ) : latestLocation ? (
                <>
                  <p className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
                    Latest location
                  </p>
                  <p className="mt-2 text-[14px] font-medium text-[#1d1d1b]">{latestLocation.name}</p>
                  <p className="mt-1 text-[13px] text-[#6b6b67]">{latestLocation.address}</p>
                  <p className="mt-1 text-[13px] text-[#6b6b67]">
                    {[latestLocation.type, latestLocation.zone || "No zone"].join(" · ")}
                  </p>
                  {latestLocation.notes ? (
                    <p className="mt-2 text-[13px] text-[#6b6b67]">{latestLocation.notes}</p>
                  ) : null}
                </>
              ) : (
                <div className="flex min-h-40 flex-col items-center justify-center text-center">
                  <MapPin className="size-5 text-[#4b4b46]" />
                  <p className="mt-3 text-[14px] font-medium text-[#1d1d1b]">No locations to show yet</p>
                  <p className="mt-1 text-[13px] text-[#6b6b67]">
                    Add a location to start building the map view.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <EditorSheetLayout
        open={isSheetOpen}
        onOpenChange={(open) => setSheetOpen(open)}
        title={sheetMode === "edit" ? "Edit location" : "Add location"}
        description={
          sheetMode === "edit"
            ? "Update the saved stop, address, and routing notes."
            : "Save a reusable stop with type, address, and routing notes for the team."
        }
        showCloseButton={false}
        headerActions={
          <Button
            type="button"
            variant="ghost"
            className="shrink-0"
            size="icon-sm"
            onClick={() => setSheetOpen(false, true)}
          >
            <X />
            <span className="sr-only">Close</span>
          </Button>
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

            <Field label="Zone">
              <Input
                value={form.zone}
                onChange={(event) => {
                  setForm((current) => ({ ...current, zone: event.target.value }));
                  setSubmitMessage(null);
                }}
                placeholder="Downtown"
              />
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
