"use client"

import * as React from "react"
import type { Dispatch, SetStateAction } from "react"
import { Check, Search } from "lucide-react"

import { ButtonGroup } from "@/components/ui/button-group"
import { EditorSheetLayout } from "@/components/editor-sheet-layout"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { SheetFooter } from "@/components/ui/sheet"
import type { LocationRecord } from "@/lib/locations"
import {
  getTravelTypeLabel,
  type TravelType,
} from "@/lib/travels"
import { cn } from "@/lib/utils"
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
  locationOptions: LocationRecord[]
  vehicleOptions: VehicleRecord[]
  errorMessage?: string | null
  resourceErrorMessage?: string | null
  isSaving?: boolean
  isDeleting?: boolean
  isLoadingResources?: boolean
  isCreatingLocation?: boolean
  onClose: () => void
  onCreateLocation: (query: string) => Promise<void>
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
  isDeleting = false,
  isLoadingResources = false,
  isCreatingLocation = false,
  onClose,
  onCreateLocation,
  onDelete,
  onSave,
  setDraft,
}: DriveEditorSheetProps) {
  const [isLocationPickerOpen, setIsLocationPickerOpen] = React.useState(false)
  const [locationSearch, setLocationSearch] = React.useState("")

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
  const scheduledTimeLabel = draft?.travelType === "dropoff" ? "Depart at" : "Arrive by"
  const locationFieldLabel =
    draft?.travelType === "dropoff" ? "Start from" : "Final destination"
  const normalizedLocationSearch = locationSearch.trim().toLowerCase()
  const filteredLocationOptions = React.useMemo(() => {
    if (!normalizedLocationSearch) {
      return locationOptions
    }

    return locationOptions.filter((location) => {
      const haystack = [
        location.name,
        location.address,
        location.type,
      ]
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedLocationSearch)
    })
  }, [locationOptions, normalizedLocationSearch])
  const shouldOfferCreateLocation =
    locationSearch.trim().length > 0 &&
    !locationOptions.some((location) => {
      const exactQuery = locationSearch.trim().toLowerCase()
      return (
        location.name.trim().toLowerCase() === exactQuery ||
        location.address.trim().toLowerCase() === exactQuery
      )
    })

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

            <Field label={locationFieldLabel}>
              <Combobox<string>
                value={draft.locationId}
                onValueChange={(nextValue) => {
                  void (async () => {
                    if (!nextValue) {
                      return
                    }

                    if (nextValue.startsWith("__create__:")) {
                      await onCreateLocation(nextValue.slice("__create__:".length))
                      setLocationSearch("")
                      setIsLocationPickerOpen(false)
                      return
                    }

                    updateDraftField("locationId", nextValue)
                    setLocationSearch("")
                    setIsLocationPickerOpen(false)
                  })()
                }}
                open={isLocationPickerOpen}
                onOpenChange={(open) => {
                  setIsLocationPickerOpen(open)

                  if (!open) {
                    setLocationSearch("")
                  }
                }}
                inputValue={locationSearch}
                onInputValueChange={setLocationSearch}
                autoHighlight
                itemToStringLabel={(value) => {
                  if (value.startsWith("__create__:")) {
                    return value.slice("__create__:".length)
                  }

                  const location = locationOptions.find((entry) => entry.id === value)
                  return location ? `${location.name} ${location.address}` : value
                }}
              >
                <ComboboxTrigger
                  disabled={isLoadingResources || isCreatingLocation}
                  className={cn(
                    "flex h-11 w-full items-center justify-between rounded-2xl border border-[#d8dcd2] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcf9_100%)] px-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[#fafcf7] focus-visible:border-[#7d8f78] focus-visible:ring-3 focus-visible:ring-[#d8e2d2] disabled:cursor-not-allowed disabled:opacity-70"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <ComboboxValue placeholder="Search or add a location">
                      {(value) => {
                        if (!value) {
                          return "Search or add a location"
                        }

                        const location = locationOptions.find((entry) => entry.id === value)

                        if (!location) {
                          return "Search or add a location"
                        }

                        return (
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-[14px] font-medium text-[#1d1d1b]">
                              {location.name}
                            </span>
                            <span className="truncate text-[11px] text-[#7a7a74]">
                              {location.address || location.type}
                            </span>
                          </span>
                        )
                      }}
                    </ComboboxValue>
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-1 rounded-full border border-[#d9e4f7] bg-[#f1f6ff] px-2.5 py-1 text-[11px] font-medium text-[#4468a8]">
                    <Search className="size-3.5" />
                    Search
                  </span>
                </ComboboxTrigger>
                <ComboboxContent className="border border-[#e3e3df] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]">
                  <div className="p-1 pb-0">
                    <ComboboxInput
                      autoFocus
                      placeholder="Search location or paste address"
                      showTrigger={false}
                      className="w-full"
                    />
                  </div>
                  <ComboboxList>
                    <ComboboxEmpty>
                      {isLoadingResources
                        ? "Loading locations..."
                        : isCreatingLocation
                          ? "Creating location..."
                          : "No matching locations."}
                    </ComboboxEmpty>
                    {shouldOfferCreateLocation ? (
                      <ComboboxItem
                        value={`__create__:${locationSearch.trim()}`}
                        className="items-start gap-3 px-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                            Add {locationSearch.trim()}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                            Create this location and select it for the drive.
                          </p>
                        </div>
                      </ComboboxItem>
                    ) : null}
                    {filteredLocationOptions.map((location) => (
                      <ComboboxItem
                        key={location.id}
                        value={location.id}
                        className="items-start gap-3 px-2 py-2.5"
                      >
                        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                              {location.name}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                              {location.type}
                            </p>
                            <p className="mt-1 truncate text-[11px] text-[#8a8a84]">
                              {location.address}
                            </p>
                          </div>
                          {draft.locationId === location.id ? (
                            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4468a8]">
                              <Check className="size-3.5" />
                            </span>
                          ) : null}
                        </div>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
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
