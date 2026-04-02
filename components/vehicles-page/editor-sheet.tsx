"use client";

import { type ComponentProps, type Dispatch, type SetStateAction } from "react";

import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { vehicleTypes, type VehicleRecord, type VehicleType } from "@/lib/vehicles";

import {
  type SheetMode,
  type VehicleAvailability,
  type VehicleFieldError,
  type VehicleForm,
} from "@/components/vehicles-page/types";
import { Field } from "@/components/vehicles-page/ui";

type VehicleEditorSheetProps = {
  open: boolean;
  sheetMode: SheetMode;
  editingVehicleId: string | null;
  deletingVehicleId: string | null;
  isSaving: boolean;
  vehicles: VehicleRecord[];
  form: VehicleForm;
  fieldErrors: VehicleFieldError;
  submitMessage: string | null;
  setForm: Dispatch<SetStateAction<VehicleForm>>;
  setFieldErrors: Dispatch<SetStateAction<VehicleFieldError>>;
  setSubmitMessage: Dispatch<SetStateAction<string | null>>;
  onOpenChange: (open: boolean) => void;
  onSubmit: NonNullable<ComponentProps<"form">["onSubmit"]>;
  onDeleteVehicle: (vehicle: VehicleRecord) => Promise<void> | void;
  onFillSample: () => void;
};

export function VehicleEditorSheet({
  open,
  sheetMode,
  editingVehicleId,
  deletingVehicleId,
  isSaving,
  vehicles,
  form,
  fieldErrors,
  submitMessage,
  setForm,
  setFieldErrors,
  setSubmitMessage,
  onOpenChange,
  onSubmit,
  onDeleteVehicle,
  onFillSample,
}: VehicleEditorSheetProps) {
  const isDeletingEditedVehicle =
    sheetMode === "edit" &&
    editingVehicleId !== null &&
    deletingVehicleId === editingVehicleId;

  const saveButtonLabel = isSaving
    ? "Saving..."
    : sheetMode === "edit"
      ? "Save changes"
      : "Save van";

  function updateTextField(field: "label" | "plateNumber" | "seatCapacity", value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitMessage(null);
  }

  return (
    <EditorSheetLayout
      open={open}
      onOpenChange={(nextOpen) => onOpenChange(nextOpen)}
      title={sheetMode === "edit" ? "Edit van" : "Add van"}
      description="Create or update a van record with the fields stored in the backend."
    >
      <form className="flex flex-1 flex-col" onSubmit={onSubmit}>
        <div className="space-y-4 overflow-y-auto px-5 py-5">
          {submitMessage ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
              {submitMessage}
            </div>
          ) : null}

          <Field label="Vehicle name">
            <Input
              value={form.label}
              onChange={(event) => updateTextField("label", event.target.value)}
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
                onChange={(event) => updateTextField("plateNumber", event.target.value)}
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
                onChange={(event) => updateTextField("seatCapacity", event.target.value)}
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
            <Textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Parking bay B, keep fuel above half tank."
              rows={4}
              className="rounded-xl px-3 py-2 text-sm text-[#1d1d1b]"
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

                  void onDeleteVehicle(vehicle);
                }}
              >
                {deletingVehicleId === editingVehicleId ? "Deleting..." : "Delete van"}
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={onFillSample}>
                Fill sample
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
