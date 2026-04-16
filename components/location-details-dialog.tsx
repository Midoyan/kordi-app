"use client"

import * as React from "react"

import { AddressAutofillInput } from "@/components/address-autofill-input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  locationTypes,
  type LocationDraft,
  type LocationType,
} from "@/lib/locations"

type LocationDetailsDialogProps = {
  open: boolean
  value: LocationDraft
  mode: "create" | "edit"
  errorMessage?: string | null
  isSaving?: boolean
  onClose: () => void
  onSave: (value: LocationDraft) => void
}

type LocationFieldErrors = {
  name?: string
  address?: string
}

function validateLocationDraft(draft: LocationDraft) {
  const errors: LocationFieldErrors = {}
  const trimmedName = draft.name.trim()
  const trimmedAddress = draft.address.trim()

  if (!trimmedName) {
    errors.name = "Enter a location name."
  }

  if (!trimmedAddress) {
    errors.address = "Enter an address."
  }

  return {
    errors,
    normalized: {
      name: trimmedName,
      type: draft.type,
      address: trimmedAddress,
      notes: draft.notes.trim(),
    } satisfies LocationDraft,
    isValid: Object.keys(errors).length === 0,
  }
}

export function LocationDetailsDialog({
  open,
  value,
  mode,
  errorMessage,
  isSaving = false,
  onClose,
  onSave,
}: LocationDetailsDialogProps) {
  const [draft, setDraft] = React.useState<LocationDraft>(value)
  const [fieldErrors, setFieldErrors] = React.useState<LocationFieldErrors>({})

  React.useEffect(() => {
    if (!open) {
      return
    }

    setDraft(value)
    setFieldErrors({})
  }, [open, value])
  

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validation = validateLocationDraft(draft)

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      return
    }

    setFieldErrors({})
    onSave(validation.normalized)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-[480px] rounded-[24px] border-[#e4e5df] bg-[linear-gradient(180deg,#ffffff_0%,#f8f9f4_100%)] p-0 shadow-[0_32px_90px_-40px_rgba(15,23,42,0.45)]">
        <form onSubmit={handleSubmit} className="flex flex-col">
          <DialogHeader className="border-b border-[#ecece7] px-5 py-4">
            <DialogTitle>
              {mode === "create" ? "New location details" : "Edit location details"}
            </DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "This location stays local until you save the drive."
                : "Update the saved location without leaving the drive editor."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-5">
            {errorMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                {errorMessage}
              </div>
            ) : null}

            <Field label="Location name">
              <Input
                autoFocus
                value={draft.name}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, name: event.target.value }))
                  setFieldErrors((current) => ({ ...current, name: undefined }))
                }}
                placeholder="Main venue entrance"
                aria-invalid={!!fieldErrors.name}
                className={fieldErrors.name ? "border-amber-300 focus-visible:border-amber-400" : undefined}
              />
              {fieldErrors.name ? (
                <p className="text-[12px] text-amber-800">{fieldErrors.name}</p>
              ) : null}
            </Field>

            <Field label="Type">
              <select
                value={draft.type}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    type: event.target.value as LocationType,
                  }))
                }
                className="h-10 rounded-xl border border-[#d8dcd2] bg-white px-3 text-[14px] text-[#1d1d1b] outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus:border-[#7d8f78] focus:ring-3 focus:ring-[#d8e2d2]"
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
                mode="search"
                value={draft.address}
                onValueChange={(nextValue) => {
                  setDraft((current) => ({ ...current, address: nextValue }))
                  setFieldErrors((current) => ({ ...current, address: undefined }))
                }}
                onSuggestionSelect={(selection) => {
                  setDraft((current) => ({
                    ...current,
                    name: current.name.trim() ? current.name : (selection.name ?? current.name),
                    address: selection.address,
                    notes: current.notes.trim() ? current.notes : (selection.notes ?? ""),
                  }))
                  setFieldErrors((current) => ({ ...current, address: undefined }))
                }}
                placeholder="123 Main St, Los Angeles, CA"
                aria-invalid={!!fieldErrors.address}
                className={fieldErrors.address ? "border-amber-300 focus-visible:border-amber-400" : undefined}
                helperText={
                  fieldErrors.address
                    ? null
                    : "Search by venue, hotel, landmark, or full address."
                }
              />
              {fieldErrors.address ? (
                <p className="mt-2 text-[12px] text-amber-800">{fieldErrors.address}</p>
              ) : null}
            </Field>

            <Field label="Notes">
              <textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional routing or access notes."
                className="min-h-24 rounded-xl border border-[#d8dcd2] bg-white px-3 py-2.5 text-[14px] text-[#1d1d1b] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] placeholder:text-[#8a8f85] focus:border-[#7d8f78] focus:ring-3 focus:ring-[#d8e2d2]"
              />
            </Field>
          </div>

          <DialogFooter className="border-t border-[#ecece7] bg-[#fcfcfa] px-5 py-4 sm:justify-between">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving
                ? mode === "create"
                  ? "Saving draft..."
                  : "Saving..."
                : mode === "create"
                  ? "Use location"
                  : "Save location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
