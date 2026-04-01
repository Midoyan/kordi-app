"use client"

import type { Dispatch, SetStateAction } from "react"

import { AddressAutofillInput } from "@/components/address-autofill-input"
import { EditorSheetLayout } from "@/components/editor-sheet-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SheetFooter } from "@/components/ui/sheet"

export type DriveEditorDraft = {
  startLocation: string
  startTime: string
  destinationAddress: string
  notes: string
}

type DriveEditorSheetProps = {
  draft: DriveEditorDraft | null
  mode: "create" | "edit" | null
  open: boolean
  labelPreview: string
  driverLabel?: string | null
  vanLabel?: string | null
  errorMessage?: string | null
  isSaving?: boolean
  isDeleting?: boolean
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
  driverLabel,
  vanLabel,
  errorMessage,
  isSaving = false,
  isDeleting = false,
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
          ? "Create a new drive shell first, then add stops inside its table."
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

            <div className="rounded-[20px] border border-[#e6e8e1] bg-[linear-gradient(180deg,rgba(250,252,247,0.98)_0%,rgba(244,246,240,0.98)_100%)] p-4 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.26)]">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-[#75816f] uppercase">
                Drive preview
              </p>
              <p className="mt-2 text-[18px] font-semibold tracking-tight text-[#1d1d1b]">
                {labelPreview}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f]">
                  {driverLabel || "No driver assigned"}
                </span>
                <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f]">
                  {vanLabel || "No van assigned"}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-[#6b6b67]">
                Drive naming is currently derived from the assigned van or driver, so this sheet focuses on route-level settings.
              </p>
            </div>

            <Field label="Start location">
              <AddressAutofillInput
                value={draft.startLocation}
                onValueChange={(value) => updateDraftField("startLocation", value)}
                placeholder="Where does this drive begin?"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start time">
                <Input
                  autoComplete="off"
                  inputMode="numeric"
                  placeholder="HH:mm"
                  value={draft.startTime}
                  onChange={(event) => updateDraftField("startTime", event.target.value)}
                />
              </Field>

              <Field label="Final destination">
                <AddressAutofillInput
                  value={draft.destinationAddress}
                  onValueChange={(value) => updateDraftField("destinationAddress", value)}
                  placeholder="Where does this drive end?"
                />
              </Field>
            </div>

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
                  disabled={isSaving || isDeleting}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving || isDeleting}>
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
