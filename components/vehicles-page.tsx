"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Car, Plus, UserRound, Wrench } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { demoPeople } from "@/lib/demo-people";

type VehicleStatus = "Ready" | "Standby" | "Needs service";

type VehicleRecord = {
  id: string;
  name: string;
  make: string;
  color: string;
  licensePlate: string;
  type: string;
  capacity: number;
  driver: string;
  status: VehicleStatus;
  notes: string;
};

type VehicleForm = {
  name: string;
  make: string;
  color: string;
  licensePlate: string;
  type: string;
  capacity: string;
  driverId: string;
  status: VehicleStatus;
  notes: string;
};

type VehicleFieldError = {
  name?: string;
  make?: string;
  color?: string;
  licensePlate?: string;
  capacity?: string;
};

const initialForm: VehicleForm = {
  name: "",
  make: "",
  color: "",
  licensePlate: "",
  type: "Van",
  capacity: "6",
  driverId: "",
  status: "Ready",
  notes: "",
};

function statusTone(status: VehicleStatus) {
  switch (status) {
    case "Ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Standby":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "Needs service":
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
  const trimmedName = form.name.trim();
  const trimmedMake = form.make.trim();
  const trimmedColor = form.color.trim();
  const trimmedLicensePlate = form.licensePlate.trim();
  const capacity = Number(form.capacity);

  if (!trimmedName) {
    errors.name = "Enter a vehicle title.";
  }

  if (!trimmedMake) {
    errors.make = "Enter the vehicle make.";
  }

  if (!trimmedColor) {
    errors.color = "Enter the vehicle color.";
  }

  if (!trimmedLicensePlate) {
    errors.licensePlate = "Enter the license plate.";
  }

  if (!form.capacity.trim()) {
    errors.capacity = "Enter a seat count.";
  } else if (!Number.isFinite(capacity) || capacity < 1) {
    errors.capacity = "Capacity must be greater than 0.";
  }

  return {
    errors,
    trimmedName,
    trimmedMake,
    trimmedColor,
    trimmedLicensePlate,
    capacity,
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

function EmptyFleetState({ onAddVehicle }: { onAddVehicle: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
      >
        {["Vehicle", "Type", "Capacity", "Driver", "Status"].map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <p className="text-[14px] font-medium text-[#1d1d1b]">No vehicles added yet.</p>
        <button
          type="button"
          onClick={onAddVehicle}
          className="rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-[#f3f3ef]"
        >
          Add first vehicle
        </button>
      </div>
    </div>
  );
}

function FleetTable({
  vehicles,
}: {
  vehicles: VehicleRecord[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div
        className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
        style={{ gridTemplateColumns: "minmax(0,1.2fr) repeat(4, minmax(0, 1fr))" }}
      >
        {["Vehicle", "Type", "Capacity", "Driver", "Status"].map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[#ecece8]">
        {vehicles.map((vehicle) => (
          <div
            key={vehicle.id}
            className="grid items-center gap-3 px-4 py-4 text-[13px] text-[#3d3d39]"
            style={{ gridTemplateColumns: "minmax(0,1.2fr) repeat(4, minmax(0, 1fr))" }}
          >
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{vehicle.name}</p>
              <p className="mt-1 truncate text-[12px] text-[#6b6b67]">
                {[vehicle.make, vehicle.color, vehicle.licensePlate].join(" · ")}
              </p>
            </div>
            <span>{vehicle.type}</span>
            <span>{vehicle.capacity} seats</span>
            <span className="truncate">{vehicle.driver || "Unassigned"}</span>
            <span>
              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${statusTone(vehicle.status)}`}
              >
                {vehicle.status}
              </span>
            </span>
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

function DriverCombobox({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  const anchorRef = useComboboxAnchor();
  const selectedValues = value ? [value] : [];
  const selectedPerson = demoPeople.find((person) => person.id === value) ?? null;
  const [open, setOpen] = useState(false);

  return (
    <Combobox
      multiple
      open={selectedPerson ? false : open}
      onOpenChange={setOpen}
      value={selectedValues}
      onValueChange={(nextValue) => {
        onValueChange(nextValue.at(-1) ?? "");
        setOpen(false);
      }}
      itemToStringLabel={(personId) => {
        const person = demoPeople.find((entry) => entry.id === personId);
        return person ? `${person.name} ${person.role} ${person.address}` : personId;
      }}
    >
      <ComboboxChips
        ref={anchorRef}
        className="min-h-8 gap-1 rounded-lg border-[#dcdcd7] bg-white px-2 py-1"
      >
        {selectedPerson ? (
          <ComboboxChip className="h-5 rounded-sm px-1.5 text-[11px]">
            {selectedPerson.name}
          </ComboboxChip>
        ) : (
          <ComboboxChipsInput
            placeholder="Search people to assign as driver"
            className="min-h-5 text-sm text-[#1d1d1b] placeholder:text-[#8a8a84]"
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                setOpen(false);
              }
            }}
          />
        )}
      </ComboboxChips>
      <ComboboxContent anchor={anchorRef} className="border border-[#e3e3df] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]">
        <ComboboxList>
          <ComboboxEmpty>No matching people found.</ComboboxEmpty>
          {demoPeople.map((person) => (
            <ComboboxItem key={person.id} value={person.id} className="items-start gap-3 px-2 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#1d1d1b]">{person.name}</p>
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">{person.role}</p>
                <p className="mt-1 truncate text-[11px] text-[#8a8a84]">{person.address}</p>
              </div>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
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

  const isSheetOpen = searchParams.get("sheet") === "add-vehicle";
  const readyCount = vehicles.filter((vehicle) => vehicle.status === "Ready").length;
  const unassignedCount = vehicles.filter((vehicle) => !vehicle.driver.trim()).length;
  const totalSeats = vehicles.reduce((sum, vehicle) => sum + vehicle.capacity, 0);

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
    const validation = validateVehicleForm(form);

    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      setSubmitMessage("Fill in the required fields before saving the vehicle.");
      return;
    }

    setFieldErrors({});
    setSubmitMessage(null);

    setVehicles((current) => [
      {
        id: `${validation.trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${current.length + 1}`,
        name: validation.trimmedName,
        make: validation.trimmedMake,
        color: validation.trimmedColor,
        licensePlate: validation.trimmedLicensePlate,
        type: form.type,
        capacity: validation.capacity,
        driver: demoPeople.find((person) => person.id === form.driverId)?.name ?? "",
        status: form.status,
        notes: form.notes.trim(),
      },
      ...current,
    ]);

    setSheetOpen(false);
  }

  const latestVehicle = vehicles[0];

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <Panel
          title="Vehicles"
          description="Store fleet details, seating, and readiness in one place."
          action={
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-[#1f1f1d] bg-[#1f1f1d] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#343431]"
            >
              <Plus className="size-4" />
              Add vehicle
            </button>
          }
        >
          {vehicles.length === 0 ? (
            <EmptyFleetState onAddVehicle={() => setSheetOpen(true)} />
          ) : (
            <FleetTable vehicles={vehicles} />
          )}
        </Panel>

        <Panel
          title="Fleet snapshot"
          description="A quick read on seats, driver coverage, and service status."
        >
          <div className="space-y-3">
            <MetricCard
              icon={Car}
              label="Fleet"
              value={String(vehicles.length)}
              detail={vehicles.length === 0 ? "No vehicles in the list yet." : "Vehicles currently tracked."}
            />
            <MetricCard
              icon={UserRound}
              label="Drivers"
              value={String(Math.max(vehicles.length - unassignedCount, 0))}
              detail={
                vehicles.length === 0
                  ? "Driver assignments will appear here."
                  : unassignedCount === 0
                    ? "Every vehicle has a named driver."
                    : `${unassignedCount} vehicle${unassignedCount === 1 ? "" : "s"} still need a driver.`
              }
            />
            <MetricCard
              icon={Wrench}
              label="Capacity"
              value={String(totalSeats)}
              detail={
                vehicles.length === 0
                  ? "Total seat count will update as you add vehicles."
                  : `${readyCount} vehicle${readyCount === 1 ? "" : "s"} marked ready right now.`
              }
            />
            {latestVehicle ? (
              <div className="rounded-lg border border-[#e7e7e4] px-4 py-3">
                <p className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
                  Latest vehicle
                </p>
                <p className="mt-2 text-[14px] font-medium text-[#1d1d1b]">{latestVehicle.name}</p>
                <p className="mt-1 text-[13px] text-[#6b6b67]">
                  {[latestVehicle.make, latestVehicle.color, latestVehicle.licensePlate].join(" · ")}
                </p>
                <p className="mt-1 text-[13px] text-[#6b6b67]">
                  {latestVehicle.driver
                    ? `${latestVehicle.driver} · ${latestVehicle.capacity} seats`
                    : `${latestVehicle.capacity} seats · driver not assigned yet`}
                </p>
              </div>
            ) : null}
          </div>
        </Panel>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          className="w-full border-[#e4e4e1] bg-[#fbfbf8] sm:max-w-[420px]"
        >
          <SheetHeader className="border-b border-[#e7e7e4] px-5 py-5">
            <SheetTitle className="text-[20px] font-semibold tracking-tight text-[#1d1d1b]">
              Add vehicle
            </SheetTitle>
            <SheetDescription className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
              Create a fleet record with capacity, driver ownership, and readiness status.
            </SheetDescription>
          </SheetHeader>

          <form className="flex flex-1 flex-col" onSubmit={handleSubmit}>
            <div className="space-y-4 overflow-y-auto px-5 py-5">
              {submitMessage ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                  {submitMessage}
                </div>
              ) : null}

              <Field label="Vehicle name">
                <Input
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, name: event.target.value }));
                    setFieldErrors((current) => ({ ...current, name: undefined }));
                    setSubmitMessage(null);
                  }}
                  placeholder="Sprinter 01"
                  autoFocus
                  aria-invalid={!!fieldErrors.name}
                  className={fieldErrors.name ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                />
                {fieldErrors.name ? (
                  <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.name}</p>
                ) : null}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Make">
                  <Input
                    value={form.make}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, make: event.target.value }));
                      setFieldErrors((current) => ({ ...current, make: undefined }));
                      setSubmitMessage(null);
                    }}
                    placeholder="Mercedes-Benz"
                    aria-invalid={!!fieldErrors.make}
                    className={fieldErrors.make ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                  />
                  {fieldErrors.make ? (
                    <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.make}</p>
                  ) : null}
                </Field>

                <Field label="Color">
                  <Input
                    value={form.color}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, color: event.target.value }));
                      setFieldErrors((current) => ({ ...current, color: undefined }));
                      setSubmitMessage(null);
                    }}
                    placeholder="Black"
                    aria-invalid={!!fieldErrors.color}
                    className={fieldErrors.color ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                  />
                  {fieldErrors.color ? (
                    <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.color}</p>
                  ) : null}
                </Field>
              </div>

              <Field label="License plate">
                <Input
                  value={form.licensePlate}
                  onChange={(event) => {
                    setForm((current) => ({ ...current, licensePlate: event.target.value }));
                    setFieldErrors((current) => ({ ...current, licensePlate: undefined }));
                    setSubmitMessage(null);
                  }}
                  placeholder="ABC-1234"
                  aria-invalid={!!fieldErrors.licensePlate}
                  className={fieldErrors.licensePlate ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                />
                {fieldErrors.licensePlate ? (
                  <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.licensePlate}</p>
                ) : null}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type">
                  <select
                    value={form.type}
                    onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
                    className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-[#1d1d1b] outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                  >
                    <option>Van</option>
                    <option>Car</option>
                    <option>Shuttle</option>
                    <option>SUV</option>
                  </select>
                </Field>

                <Field label="Capacity">
                  <Input
                    type="number"
                    min="1"
                    value={form.capacity}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, capacity: event.target.value }));
                      setFieldErrors((current) => ({ ...current, capacity: undefined }));
                      setSubmitMessage(null);
                    }}
                    placeholder="6"
                    aria-invalid={!!fieldErrors.capacity}
                    className={fieldErrors.capacity ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                  />
                  {fieldErrors.capacity ? (
                    <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.capacity}</p>
                  ) : null}
                </Field>
              </div>

              <Field label="Driver">
                <div className="flex flex-col gap-2">
                  <DriverCombobox
                    value={form.driverId}
                    onValueChange={(driverId) =>
                      setForm((current) => ({
                        ...current,
                        driverId,
                      }))
                    }
                  />
                  <p className="text-[12px] leading-5 text-[#7c7c75]">
                    Demo people for now. Swap the source in <code>/Users/dovydas/Library/CloudStorage/Dropbox/Xdev/kordi-app/lib/demo-people.ts</code> for real People data when that source is wired up.
                  </p>
                </div>
              </Field>

              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as VehicleStatus,
                    }))
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-[#1d1d1b] outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/50"
                >
                  <option value="Ready">Ready</option>
                  <option value="Standby">Standby</option>
                  <option value="Needs service">Needs service</option>
                </select>
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
              <div className="flex w-full items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save vehicle</Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
