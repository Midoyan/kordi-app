"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";

import { AddressAutofillInput } from "@/components/address-autofill-input";
import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
import type { PersonDraft } from "@/lib/people";

type PersonEditorSheetProps = {
  draft: PersonDraft | null;
  mode: "create" | "edit" | null;
  open: boolean;
  onClose: () => void;
  onDelete?: () => void;
  onSave: () => void;
  errorMessage?: string | null;
  isDeleting?: boolean;
  isSaving?: boolean;
  setDraft: Dispatch<SetStateAction<PersonDraft | null>>;
};

export function PersonEditorSheet({
  draft,
  mode,
  open,
  onClose,
  onDelete,
  onSave,
  errorMessage,
  isDeleting = false,
  isSaving = false,
  setDraft,
}: PersonEditorSheetProps) {
  const updateDraftField = <TField extends keyof PersonDraft>(
    field: TField,
    value: PersonDraft[TField],
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const hasEnteredInput = Boolean(
    draft && [draft.name, draft.address, draft.phone].some((value) => value.trim()),
  );

  return (
    <EditorSheetLayout
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) {
          return;
        }

        if (eventDetails?.reason === "escape-key" || !hasEnteredInput) {
          onClose();
        }
      }}
      title={mode === "create" ? "Add person" : "Edit person"}
      description={
        mode === "create"
          ? "Create a crew member in the shared people roster."
          : "Update or remove the selected crew member."
      }
      contentClassName="sm:max-w-[480px]"
      headerClassName="px-4 py-4"
      titleClassName="text-base font-semibold tracking-normal"
      descriptionClassName="mt-0 text-sm"
      showCloseButton={false}
      disablePointerDismissal={hasEnteredInput}
    >
      {draft ? (
        <form
          className="flex flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <div className="flex flex-1 flex-col gap-5 px-4 pb-4">
            {errorMessage ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                {errorMessage}
              </div>
            ) : null}

            <Field label="Name">
              <Input
                autoFocus
                autoComplete="name"
                name="name"
                value={draft.name}
                onChange={(event) => updateDraftField("name", event.target.value)}
              />
            </Field>

            <Field label="Phone">
              <Input
                autoComplete="tel"
                name="phone"
                value={draft.phone}
                onChange={(event) => updateDraftField("phone", event.target.value)}
              />
            </Field>

            <Field label="Address">
              <AddressAutofillInput
                value={draft.address}
                onValueChange={(value) => updateDraftField("address", value)}
              />
            </Field>
          </div>

          <SheetFooter className="border-t border-[#ecece8] bg-[#fcfcfa]">
            <div className="flex w-full items-center justify-between gap-2">
              {mode === "edit" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={isDeleting || isSaving}
                  onClick={onDelete}
                >
                  {isDeleting ? "Deleting..." : "Delete person"}
                </Button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                  disabled={isDeleting || isSaving}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isDeleting || isSaving}>
                  {isSaving
                    ? mode === "create"
                      ? "Adding..."
                      : "Saving..."
                    : mode === "create"
                      ? "Add person"
                      : "Save changes"}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </form>
      ) : null}
    </EditorSheetLayout>
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
    <label className="flex flex-col gap-2">
      <span className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
