"use client"

import type { Dispatch, SetStateAction } from "react"

import { ButtonGroup } from "@/components/ui/button-group"
import { EditorSheetLayout } from "@/components/editor-sheet-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SheetFooter } from "@/components/ui/sheet"
import type { LocationRecord } from "@/lib/locations"
import {
  getTravelTypeLabel,
  type TravelType,
} from "@/lib/travels"
import type { VehicleRecord } from "@/lib/vehicles"

export type DriveEditorDraft = {
  vanId: string
  travelType: TravelType
  locationId: string
  scheduledTime: string
  scheduledTimeSource: string | null
  notes: string
}

type DriveEditorSheetProps = {
  draft: DriveEditorDraft | null
  mode: "create" | "edit" | null
  open: boolean
  labelPreview: string
  locationOptions: LocationRecord[]
  vehicleOptions: VehicleRecord[]
  vanLabel?: string | null
  errorMessage?: string | null
  resourceErrorMessage?: string | null
  isSaving?: boolean
  isDeleting?: boolean
  isLoadingResources?: boolean
  onClose: () => void
  onDelete?: () => void
  onSave: () => void
  setDraft: Dispatch<SetStateAction<DriveEditorDraft | null>>
}

export function DriveEditorSheet({
  draft,
  mode,
  open,
  labelPreview,
  locationOptions,
  vehicleOptions,
  vanLabel,
  errorMessage,
  resourceErrorMessage,
  isSaving = false,
  isDeleting = false,
  isLoadingResources = false,
  onClose,
  onDelete,
  onSave,
  setDraft,
}: DriveEditorSheetProps) {
  const updateDraftField = <TField extends keyof DriveEditorDraft>(
    field: TField,
    value: DriveEditorDraft[TField]
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  const selectedLocation =
    draft?.locationId
      ? locationOptions.find((location) => location.id === draft.locationId) ?? null
      : null
  const selectedVan =
    draft?.vanId
      ? vehicleOptions.find((vehicle) => vehicle.id === draft.vanId) ?? null
      : null
  const travelTypeLabel = getTravelTypeLabel(draft?.travelType ?? "pickup")
  const scheduledTimeLabel = draft?.travelType === "dropoff" ? "Depart at" : "Arrive by"

  return (
    <EditorSheetLayout
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose()
        }
      }}
      title={mode === "create" ? "Add drive" : "Drive settings"}
      description={
        mode === "create"
          ? "Create a pickup or dropoff drive first, then add stops inside its table."
          : "Update the drive-level settings shared by every stop in this drive."
      }
      contentClassName="sm:max-w-[500px]"
      headerClassName="px-4 py-4"
      titleClassName="text-base font-semibold tracking-normal"
      descriptionClassName="mt-0 text-sm"
    >
      {draft ? (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            onSave()
          }}
        >
          <div className="flex flex-1 flex-col gap-5 px-4 pb-4">
            {errorMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                {errorMessage}
              </div>
            ) : null}
            {resourceErrorMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                {resourceErrorMessage}
              </div>
            ) : null}

            {/* <div className="rounded-[20px] border border-[#e6e8e1] bg-[linear-gradient(180deg,rgba(250,252,247,0.98)_0%,rgba(244,246,240,0.98)_100%)] p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.26)]">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#75816f] uppercase">
                Drive preview
              </p>
              <p className="mt-2 text-[18px] font-semibold tracking-tight text-[#1d1d1b]">
                {labelPreview}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f]">
                  {travelTypeLabel}
                </span>
                <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f]">
                  {selectedVan?.label || vanLabel || "No van assigned"}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#6b6b67]">
                {selectedLocation?.address || "Choose the van, run type, and set location for this drive."}
              </p>
            </div> */}

            <Field label="Travel type">
              <ButtonGroup>
                {(["pickup", "dropoff"] as const).map((travelType) => {
                  const isActive = draft?.travelType === travelType

                  return (
                    <Button
                      key={travelType}
                      type="button"
                      variant="outline"
                      className={
                        isActive
                          ? "border-[#7d8f78] bg-[#edf5e2] text-[#244226] hover:bg-[#e5f0d6]"
                          : "border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                      }
                      onClick={() => updateDraftField("travelType", travelType)}
                    >
                      {getTravelTypeLabel(travelType)}
                    </Button>
                  )
                })}
              </ButtonGroup>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Van">
                <select
                  value={draft.vanId}
                  disabled={isLoadingResources}
                  onChange={(event) => updateDraftField("vanId", event.target.value)}
                  className="h-10 rounded-xl border border-[#d8dcd2] bg-white px-3 text-[14px] text-[#1d1d1b] outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus:border-[#7d8f78] focus:ring-3 focus:ring-[#d8e2d2]"
                >
                  <option value="">Select a van</option>
                  {vehicleOptions.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                      {vehicle.plateNumber ? ` · ${vehicle.plateNumber}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={scheduledTimeLabel}>
                <Input
                  autoComplete="off"
                  inputMode="numeric"
                  placeholder="HH:mm"
                  value={draft.scheduledTime}
                  onChange={(event) => updateDraftField("scheduledTime", event.target.value)}
                />
              </Field>
            </div>

            <Field label="Set / filming location">
              <select
                value={draft.locationId}
                disabled={isLoadingResources}
                onChange={(event) => updateDraftField("locationId", event.target.value)}
                className="h-10 rounded-xl border border-[#d8dcd2] bg-white px-3 text-[14px] text-[#1d1d1b] outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus:border-[#7d8f78] focus:ring-3 focus:ring-[#d8e2d2]"
              >
                <option value="">Select a location</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
              {selectedLocation ? (
                <p className="mt-2 text-[12px] leading-5 text-[#6b6b67]">
                  {selectedLocation.address}
                </p>
              ) : null}
              {isLoadingResources ? (
                <p className="mt-2 text-[12px] leading-5 text-[#6b6b67]">
                  Loading locations and vans…
                </p>
              ) : null}
            </Field>

            <Field label="Notes">
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraftField("notes", event.target.value)}
                placeholder="Dispatch notes, curbside constraints, access reminders..."
                className="min-h-24 rounded-xl border border-[#d8dcd2] bg-white px-3 py-2.5 text-[14px] text-[#1d1d1b] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] placeholder:text-[#8a8f85] focus:border-[#7d8f78] focus:ring-3 focus:ring-[#d8e2d2]"
              />
            </Field>
          </div>

          <SheetFooter className="border-t border-[#ecece8] bg-[#fcfcfa]">
            <div className="flex w-full items-center justify-between gap-2">
              {mode === "edit" && onDelete ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={isSaving || isDeleting}
                  onClick={onDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete drive"}
                </Button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                  disabled={isSaving || isDeleting || isLoadingResources}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || isDeleting || isLoadingResources}>
                  {isSaving
                    ? mode === "create"
                      ? "Adding..."
                      : "Saving..."
                    : mode === "create"
                      ? "Add drive"
                      : "Save drive"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      ) : null}
    </EditorSheetLayout>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
