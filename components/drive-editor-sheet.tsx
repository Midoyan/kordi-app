"use client"

import * as React from "react"
import type { Dispatch, SetStateAction } from "react"
import { CarFront, PencilLine, UserRound } from "lucide-react"

import { ButtonGroup } from "@/components/ui/button-group"
import {
  Combobox,
  ComboboxContent,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import { EditorSheetLayout } from "@/components/editor-sheet-layout"
import { LocationDetailsDialog } from "@/components/location-details-dialog"
import { LocationPickerInput } from "@/components/location-picker-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SheetFooter } from "@/components/ui/sheet"
import type {
  LocationDraft,
  LocationRecord,
} from "@/lib/locations"
import {
  getTravelTypeLabel,
  type TravelType,
} from "@/lib/travels"
import type { VehicleRecord } from "@/lib/vehicles"

export type DriveEditorDraft = {
  vanId: string
  travelType: TravelType
  locationId: string
  locationDraft: LocationDraft | null
  scheduledTime: string
  scheduledTimeSource: string | null
  notes: string
}

type DriveEditorSheetProps = {
  draft: DriveEditorDraft | null
  mode: "create" | "edit" | null
  open: boolean
  locationOptions: LocationRecord[]
  vehicleOptions: VehicleRecord[]
  errorMessage?: string | null
  resourceErrorMessage?: string | null
  isSaving?: boolean
  isSavingLocationDetails?: boolean
  isDeleting?: boolean
  isLoadingResources?: boolean
  onClose: () => void
  onCreateLocation: (query: string) => Promise<void>
  onUpdateLocation: (locationId: string, draft: LocationDraft) => Promise<void>
  onDelete?: () => void
  onSave: () => void
  setDraft: Dispatch<SetStateAction<DriveEditorDraft | null>>
}

export function DriveEditorSheet({
  draft,
  mode,
  open,
  locationOptions,
  vehicleOptions,
  errorMessage,
  resourceErrorMessage,
  isSaving = false,
  isSavingLocationDetails = false,
  isDeleting = false,
  isLoadingResources = false,
  onClose,
  onCreateLocation,
  onUpdateLocation,
  onDelete,
  onSave,
  setDraft,
}: DriveEditorSheetProps) {
  const [isLocationDialogOpen, setIsLocationDialogOpen] = React.useState(false)
  const [locationDialogDraft, setLocationDialogDraft] = React.useState<LocationDraft | null>(null)
  const [locationDialogError, setLocationDialogError] = React.useState<string | null>(null)

  const updateDraftField = <TField extends keyof DriveEditorDraft>(
    field: TField,
    value: DriveEditorDraft[TField]
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current))
  }

  const scheduledTimeLabel = draft?.travelType === "dropoff" ? "Depart at" : "Arrive by"
  const locationFieldLabel =
    draft?.travelType === "dropoff" ? "Start from" : "Arrive to"
  const selectedLocation = draft?.locationId
    ? locationOptions.find((location) => location.id === draft.locationId) ?? null
    : null
  const selectedVehicle = draft?.vanId
    ? vehicleOptions.find((vehicle) => vehicle.id === draft.vanId) ?? null
    : null
  const canEditLocation = !!draft?.locationDraft || !!selectedLocation
  const locationDialogMode = draft?.locationDraft ? "create" : "edit"

  const openLocationDialog = React.useCallback(() => {
    if (!draft) {
      return
    }

    if (draft.locationDraft) {
      setLocationDialogDraft(draft.locationDraft)
      setLocationDialogError(null)
      setIsLocationDialogOpen(true)
      return
    }

    if (selectedLocation) {
      setLocationDialogDraft({
        name: selectedLocation.name,
        type: selectedLocation.type,
        address: selectedLocation.address,
        notes: selectedLocation.notes,
      })
      setLocationDialogError(null)
      setIsLocationDialogOpen(true)
    }
  }, [draft, selectedLocation])

  const closeLocationDialog = React.useCallback(() => {
    setIsLocationDialogOpen(false)
    setLocationDialogError(null)
  }, [])

  const handleLocationDialogSave = React.useCallback(
    async (nextDraft: LocationDraft) => {
      if (!draft) {
        return
      }

      if (draft.locationDraft) {
        setDraft((current) =>
          current
            ? {
                ...current,
                locationDraft: nextDraft,
                locationId: "",
              }
            : current
        )
        closeLocationDialog()
        return
      }

      if (!draft.locationId) {
        return
      }

      setLocationDialogError(null)

      try {
        await onUpdateLocation(draft.locationId, nextDraft)
        closeLocationDialog()
      } catch (error) {
        setLocationDialogError(
          error instanceof Error ? error.message : "Unable to update this location."
        )
      }
    },
    [closeLocationDialog, draft, onUpdateLocation, setDraft]
  )

  return (
    <>
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

              <Field label="Travel type">
                <ButtonGroup>
                  {(["pickup", "dropoff"] as const).map((travelType) => {
                    const isActive = draft.travelType === travelType

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

              <Field label="Van">
                <Combobox<string>
                  value={draft.vanId || null}
                  disabled={isLoadingResources}
                  onValueChange={(nextValue) =>
                    updateDraftField("vanId", nextValue ?? "")
                  }
                  itemToStringLabel={(value) =>
                    vehicleOptions.find((vehicle) => vehicle.id === value)?.label ?? value
                  }
                >
                  <ComboboxTrigger
                    disabled={isLoadingResources}
                    className="group flex min-h-16 w-full items-center justify-between rounded-[20px] border border-[#d8dcd2] bg-[linear-gradient(180deg,#ffffff_0%,#fafbf7_100%)] px-3.5 py-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.9),0_14px_30px_-24px_rgba(15,23,42,0.32)] transition-[border-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:border-[#c5cec0] hover:shadow-[0_1px_0_rgba(255,255,255,0.92),0_20px_36px_-28px_rgba(15,23,42,0.38)] active:scale-[0.98] focus-visible:border-[#7d8f78] focus-visible:ring-3 focus-visible:ring-[#d8e2d2] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ComboboxValue placeholder="Select a van">
                      {(value) => {
                        const vehicle =
                          typeof value === "string"
                            ? vehicleOptions.find((entry) => entry.id === value) ?? null
                            : selectedVehicle

                        if (!vehicle) {
                          return (
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef3e7] text-[#5f7158]">
                                <CarFront className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[14px] font-medium text-[#1d1d1b]">
                                  Select a van
                                </p>
                              </div>
                            </div>
                          )
                        }

                        return (
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-2xl bg-[#eef3e7] text-[#5f7158]">
                              <CarFront className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-[#1d1d1b]">
                                {vehicle.label}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#6b6f67]">
                                <span>{vehicle.plateNumber || "No plate"}</span>
                                <span>{vehicle.seatCapacity} seats</span>
                                <span className="inline-flex items-center gap-1">
                                  <UserRound className="size-3.5" />
                                  {vehicle.driverName || "No driver assigned"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }}
                    </ComboboxValue>
                  </ComboboxTrigger>
                  <ComboboxContent className="border border-[#d9ddd2] bg-[linear-gradient(180deg,#ffffff_0%,#fafbf8_100%)] p-1.5 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)]">
                    <ComboboxList className="max-h-72">
                      {vehicleOptions.map((vehicle) => (
                        <ComboboxItem
                          key={vehicle.id}
                          value={vehicle.id}
                          className="rounded-2xl px-2.5 py-2.5 data-highlighted:bg-[#f3f7ed]"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[#edf3e5] text-[#5a6d53] shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                              <CarFront className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="truncate text-[13px] font-semibold text-[#1d1d1b]">
                                  {vehicle.label}
                                </p>
                                <span className="shrink-0 rounded-full bg-[#f0f4eb] px-2 py-0.5 text-[11px] font-medium text-[#58704f]">
                                  {vehicle.seatCapacity} seats
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-[#6f746d]">
                                {vehicle.plateNumber || "No plate"}
                              </p>
                              <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#f7f8f4] px-2 py-1 text-[11px] text-[#5b6258]">
                                <UserRound className="size-3.5" />
                                {vehicle.driverName || "No driver assigned"}
                              </div>
                            </div>
                          </div>
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>

              <Field label={locationFieldLabel}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <LocationPickerInput
                      value={draft.locationId}
                      draftLocation={draft.locationDraft}
                      locations={locationOptions}
                      isLoading={isLoadingResources}
                      loadingMessage="Loading locations and vans…"
                      onCreateLocation={async (query) => {
                        await onCreateLocation(query)
                        setLocationDialogError(null)
                      }}
                      onValueChange={(nextValue) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                locationId: nextValue,
                                locationDraft: null,
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-0.5 h-11 shrink-0 rounded-2xl border-[#d8dcd2] bg-white px-3 text-[#50604c] hover:bg-[#f5f7f1]"
                    disabled={!canEditLocation || isLoadingResources || isSaving || isDeleting}
                    onClick={openLocationDialog}
                  >
                    <PencilLine className="size-3.5" />
                    Edit
                  </Button>
                </div>
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

      {locationDialogDraft ? (
        <LocationDetailsDialog
          open={isLocationDialogOpen}
          value={locationDialogDraft}
          mode={locationDialogMode}
          errorMessage={locationDialogError}
          isSaving={isSavingLocationDetails}
          onClose={closeLocationDialog}
          onSave={(nextDraft) => {
            void handleLocationDialogSave(nextDraft)
          }}
        />
      ) : null}
    </>
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
