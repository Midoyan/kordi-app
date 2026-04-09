"use client"

import * as React from "react"
import { Check, Plus } from "lucide-react"

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
import type {
  LocationDraft,
  LocationRecord,
} from "@/lib/locations"
import { cn } from "@/lib/utils"

const CREATE_LOCATION_PREFIX = "__create__:"

function getLocationSearchText(location: LocationRecord) {
  return [location.name, location.address, location.type].join(" ").toLowerCase()
}

type LocationPickerInputProps = {
  value: string
  locations: LocationRecord[]
  draftLocation?: LocationDraft | null
  disabled?: boolean
  isLoading?: boolean
  loadingMessage?: string
  placeholder?: string
  searchPlaceholder?: string
  onCreateLocation: (query: string) => Promise<void>
  onValueChange: (value: string) => void | Promise<void>
}

export function LocationPickerInput({
  value,
  locations,
  draftLocation = null,
  disabled = false,
  isLoading = false,
  loadingMessage = "Loading locations…",
  placeholder = "Search or add a location",
  searchPlaceholder = "Search location or paste address",
  onCreateLocation,
  onValueChange,
}: LocationPickerInputProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedLocation = value
    ? locations.find((location) => location.id === value) ?? null
    : null
  const selectedDraftLocation = !value ? draftLocation : null
  const normalizedSearch = search.trim().toLowerCase()

  const filteredLocations = React.useMemo(() => {
    if (!normalizedSearch) {
      return locations
    }

    return locations.filter((location) =>
      getLocationSearchText(location).includes(normalizedSearch)
    )
  }, [locations, normalizedSearch])

  const shouldOfferCreateLocation =
    search.trim().length > 0 &&
    !locations.some((location) => {
      const exactQuery = search.trim().toLowerCase()
      return (
        location.name.trim().toLowerCase() === exactQuery ||
        location.address.trim().toLowerCase() === exactQuery
      )
    })

  const emptyMessage =
    isLoading
      ? "Loading locations..."
      : locations.length === 0
        ? "No locations yet"
        : null

  return (
    <div className="flex flex-col">
      <Combobox<string>
        value={value}
        filter={null}
        onValueChange={(nextValue) => {
          void (async () => {
            if (!nextValue) {
              return
            }

            if (nextValue.startsWith(CREATE_LOCATION_PREFIX)) {
              await onCreateLocation(nextValue.slice(CREATE_LOCATION_PREFIX.length))
              setSearch("")
              setOpen(false)
              return
            }

            await onValueChange(nextValue)
            setSearch("")
            setOpen(false)
          })()
        }}
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen)

          if (!nextOpen) {
            setSearch("")
          }
        }}
        inputValue={search}
        onInputValueChange={setSearch}
        autoHighlight
        itemToStringLabel={(nextValue) => {
          if (nextValue.startsWith(CREATE_LOCATION_PREFIX)) {
            return nextValue.slice(CREATE_LOCATION_PREFIX.length)
          }

          const location = locations.find((entry) => entry.id === nextValue)
          return location ? `${location.name} ${location.address}` : nextValue
        }}
      >
        <ComboboxTrigger
          disabled={disabled || isLoading}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-2xl border border-[#d8dcd2] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcf9_100%)] px-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition-[border-color,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-[#fafcf7] focus-visible:border-[#7d8f78] focus-visible:ring-3 focus-visible:ring-[#d8e2d2] disabled:cursor-not-allowed disabled:opacity-70"
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <ComboboxValue placeholder={placeholder}>
              {(nextValue) => {
                if (!nextValue && !selectedDraftLocation) {
                  return placeholder
                }

                if (selectedDraftLocation) {
                  return (
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-[14px] font-medium text-[#1d1d1b]">
                        {selectedDraftLocation.name || selectedDraftLocation.address || placeholder}
                      </span>
                      <span className="truncate text-[11px] text-[#7a7a74]">
                        {selectedDraftLocation.address || selectedDraftLocation.type}
                      </span>
                    </span>
                  )
                }

                const location = locations.find((entry) => entry.id === nextValue)

                if (!location) {
                  return placeholder
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
        </ComboboxTrigger>
        <ComboboxContent className="border border-[#e3e3df] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]">
          <div className="p-1 pb-0">
            <ComboboxInput
              autoFocus
              placeholder={searchPlaceholder}
              showTrigger={false}
              className="w-full"
            />
          </div>
          <ComboboxList>
            {emptyMessage ? <ComboboxEmpty>{emptyMessage}</ComboboxEmpty> : null}
            {filteredLocations.map((location) => (
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
                  {value === location.id ? (
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4468a8]">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </div>
              </ComboboxItem>
            ))}
            {shouldOfferCreateLocation ? (
              <ComboboxItem
                value={`${CREATE_LOCATION_PREFIX}${search.trim()}`}
                className="items-start gap-3 px-2 py-2.5"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#eef5ff] text-[#4468a8] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <Plus className="size-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                    Add {search.trim()}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                    Use this as a new location. It will be saved with the drive.
                  </p>
                </div>
              </ComboboxItem>
            ) : null}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {selectedDraftLocation ? (
        <p className="mt-2 text-[12px] leading-5 text-[#6b6b67]">
          New location. It will be saved when you save the drive.
        </p>
      ) : null}
      {selectedLocation ? (
        <p className="mt-2 text-[12px] leading-5 text-[#6b6b67]">
          {selectedLocation.address}
        </p>
      ) : null}
      {isLoading ? (
        <p className="mt-2 text-[12px] leading-5 text-[#6b6b67]">
          {loadingMessage}
        </p>
      ) : null}
    </div>
  )
}
