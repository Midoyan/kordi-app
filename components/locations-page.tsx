"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, MapPin, Plus, Route } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { AddressAutofillInput } from "@/components/address-autofill-input";
import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";

type LocationType = "Pickup point" | "Venue" | "Hotel" | "Airport" | "Other";

type LocationRecord = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  zone: string;
  notes: string;
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
        style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,0.8fr) minmax(0,1fr)" }}
      >
        {["Name", "Type", "Address", "Zone", "Notes"].map((column) => (
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
}: {
  locations: LocationRecord[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,0.8fr) minmax(0,1fr)" }}
      >
        {["Name", "Type", "Address", "Zone", "Notes"].map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[#ecece8]">
        {locations.map((location) => (
          <div
            key={location.id}
            className="grid items-center gap-3 px-4 py-4 text-[13px] text-[#3d3d39]"
            style={{ gridTemplateColumns: "minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,1.5fr) minmax(0,0.8fr) minmax(0,1fr)" }}
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{location.name}</p>
            </div>
            <span>{location.type}</span>
            <span className="truncate">{location.address}</span>
            <span className="truncate">{location.zone || "Unassigned"}</span>
            <span className="truncate text-[#6b6b67]">{location.notes || "No notes"}</span>
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

  const isSheetOpen = searchParams.get("sheet") === "add-location";
  const pickupPointCount = locations.filter((location) => location.type === "Pickup point").length;
  const uniqueZonesCount = new Set(
    locations.map((location) => location.zone.trim()).filter(Boolean),
  ).size;
  const latestLocation = locations[0];

  function setSheetOpen(open: boolean) {
    router.replace(buildSheetHref(pathname, new URLSearchParams(searchParams.toString()), open), {
      scroll: false,
    });

    if (!open) {
      setForm(initialForm);
      setFieldErrors({});
      setSubmitMessage(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateLocationForm(form);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSubmitMessage("Fill in the required fields before saving the location.");
      return;
    }

    setFieldErrors({});
    setSubmitMessage(null);

    setLocations((current) => [
      {
        id: `${validation.trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${current.length + 1}`,
        name: validation.trimmedName,
        type: form.type,
        address: validation.trimmedAddress,
        zone: form.zone.trim(),
        notes: form.notes.trim(),
      },
      ...current,
    ]);

    setSheetOpen(false);
  }

  function randomizeForm() {
    const template = demoLocationForms[Math.floor(Math.random() * demoLocationForms.length)];
    setForm(template);
    setFieldErrors({});
    setSubmitMessage(null);
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title="Locations"
          description="Save pickup points, venues, and shared destination records."
          action={
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[#1f1f1d] bg-[#1f1f1d] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#343431]"
            >
              <Plus className="size-4" />
              Add location
            </button>
          }
        >
          {locations.length === 0 ? (
            <EmptyLocationsState onAddLocation={() => setSheetOpen(true)} />
          ) : (
            <LocationsTable locations={locations} />
          )}
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
                locations.length === 0
                  ? "No saved places yet."
                  : "Saved pickup points and shared destinations."
              }
            />
            <MetricCard
              icon={Route}
              label="Pickup points"
              value={String(pickupPointCount)}
              detail={
                locations.length === 0
                  ? "Pickup count updates as you add places."
                  : `${pickupPointCount} location${pickupPointCount === 1 ? "" : "s"} ready for route planning.`
              }
            />
            <MetricCard
              icon={Building2}
              label="Zones"
              value={String(uniqueZonesCount)}
              detail={
                locations.length === 0
                  ? "Zone coverage will appear here."
                  : uniqueZonesCount === 0
                    ? "No zones assigned yet."
                    : `${uniqueZonesCount} zone${uniqueZonesCount === 1 ? "" : "s"} currently represented.`
              }
            />
            <div className="rounded-lg border border-[#e7e7e4] bg-[#fafaf7] p-4">
              {latestLocation ? (
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
        onOpenChange={setSheetOpen}
        title="Add location"
        description="Save a reusable stop with type, address, and routing notes for the team."
      >
          <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
            <div className="space-y-4 overflow-y-auto px-5 py-5">
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
                  <option value="Pickup point">Pickup point</option>
                  <option value="Venue">Venue</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Airport">Airport</option>
                  <option value="Other">Other</option>
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
                    fieldErrors.address ? null : `Demo bias enabled. Suggestions are weighted near ${demoSuggestionBias.label}.`
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
                <Button type="button" variant="outline" onClick={randomizeForm}>
                  Randomize demo
                </Button>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Save location</Button>
                </div>
              </div>
            </SheetFooter>
          </form>
      </EditorSheetLayout>
    </>
  );
}
