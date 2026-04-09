"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { FileUp } from "lucide-react";

import { AddressAutofillInput } from "@/components/address-autofill-input";
import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
import type { PersonDraft } from "@/lib/people";
import {
  parseVCardPayload,
  readDroppedVCardPayloads,
  readSelectedVCardFiles,
} from "@/lib/vcard";
import { cn } from "@/lib/utils";

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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingImport, setIsDraggingImport] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const canImportFromVCard = mode === "create" && Boolean(draft);

  const updateDraftField = <TField extends keyof PersonDraft>(
    field: TField,
    value: PersonDraft[TField],
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const resetImportState = () => {
    setIsDraggingImport(false);
    setImportMessage(null);
  };

  const handleClose = () => {
    resetImportState();
    onClose();
  };

  const mergeImportedContact = (importedContact: PersonDraft) => {
    setDraft((current) => {
      if (!current) {
        return importedContact;
      }

      return {
        name: current.name.trim() ? current.name : importedContact.name,
        address: current.address.trim() ? current.address : importedContact.address,
        phone: current.phone.trim() ? current.phone : importedContact.phone,
        role: current.role,
      };
    });
  };

  const importPayloadsIntoDraft = async (payloads: string[]) => {
    const importedContacts = payloads.flatMap((payload) => parseVCardPayload(payload));

    if (importedContacts.length === 0) {
      setImportMessage("No readable vCard entries were found in that drop.");
      return;
    }

    mergeImportedContact(importedContacts[0]);
    setImportMessage(
      importedContacts.length > 1
        ? "Imported the first contact into the form. Existing typed values were preserved."
        : "Imported contact details into the form. Existing typed values were preserved.",
    );
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const payloads = await readSelectedVCardFiles(files);
    event.target.value = "";

    if (payloads.length === 0) {
      setImportMessage("No readable vCard entries were found in that file selection.");
      return;
    }

    await importPayloadsIntoDraft(payloads);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!canImportFromVCard) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingImport(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingImport(false);
  };

  const demoSuggestionBias = {
    label: "Alexanderplatz 10178 Berlin",
    proximity: {
      lng: 13.413215,
      lat: 52.521918,
    },
  } as const;

  const handleDrop = async (event: DragEvent<HTMLElement>) => {
    if (!canImportFromVCard) {
      return;
    }

    event.preventDefault();
    setIsDraggingImport(false);

    const payloads = await readDroppedVCardPayloads(event.dataTransfer);
    await importPayloadsIntoDraft(payloads);
  };

  return (
    <EditorSheetLayout
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          return;
        }

        handleClose();
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
      contentWrapperProps={{
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: (event) => {
          void handleDrop(event);
        },
        className: cn(
          "relative",
          canImportFromVCard && isDraggingImport && "border-[#b8c8ff] bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,248,255,0.98)_52%,rgba(238,243,255,0.98)_100%)]",
        ),
      }}
    >
      {draft ? (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept=".vcf,text/vcard,text/x-vcard"
            multiple
            className="hidden"
            onChange={(event) => {
              void handleFileSelection(event);
            }}
          />
          <form
            className="relative flex flex-1 flex-col"
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

              {canImportFromVCard ? (
                <div className="space-y-2 border-b border-[#ecece8] pb-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[13px] leading-6 text-[#4b4b46]">
                      {isDraggingImport
                        ? "Release to import this contact into the form."
                        : "Drop a contact from your Contacts here, or directly into the table."}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                      onClick={handleImportButtonClick}
                    >
                      <FileUp className="size-4" />
                      Import .vcf
                    </Button>
                  </div>
                  {importMessage ? (
                    <p className="text-[11px] leading-5 text-[#3556a8]">{importMessage}</p>
                  ) : null}
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

              <Field label="Role">
                <Input
                  autoComplete="organization-title"
                  name="role"
                  value={draft.role}
                  onChange={(event) => updateDraftField("role", event.target.value)}
                />
              </Field>

              <Field label="Address">
                <AddressAutofillInput
                  mode="search"
                  value={draft.address}
                  proximity={demoSuggestionBias.proximity}
                  onValueChange={(value) => updateDraftField("address", value)}
                  placeholder="123 Main St, Los Angeles, CA"
                  helperText="Search by venue, hotel, landmark, or full address."
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
                    onClick={handleClose}
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
          {canImportFromVCard && isDraggingImport ? (
            <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] border-2 border-dashed border-[#90a8ff] bg-[#eef3ff]/35" />
          ) : null}
        </>
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
