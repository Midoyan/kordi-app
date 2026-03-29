"use client";

import type { Dispatch, KeyboardEvent as ReactKeyboardEvent, ReactNode, SetStateAction } from "react";
import dynamic from "next/dynamic";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type PersonStatus = "Ready" | "Pending pickup" | "Draft" | "Imported";

export type PersonRecord = {
  id: string;
  name: string;
  role: string;
  address: string;
  pickup: string;
  email: string;
  status: PersonStatus;
};

export type PersonDraft = Omit<PersonRecord, "id">;

type PersonEditorMode = "create" | "edit" | null;

type PersonEditorSheetProps = {
  draft: PersonDraft | null;
  mode: PersonEditorMode;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  setDraft: Dispatch<SetStateAction<PersonDraft | null>>;
};

const statusOptions: PersonStatus[] = ["Ready", "Pending pickup", "Draft", "Imported"];
const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
const hasMapboxToken = Boolean(mapboxToken);
const AddressAutofill = dynamic(
  () => import("@mapbox/search-js-react").then((module) => module.AddressAutofill),
  { ssr: false },
);

function getHighlightedMapboxOption() {
  return document.querySelector<HTMLElement>(
    'mapbox-search-listbox [role="option"][aria-selected="true"]',
  );
}

function getFirstMapboxOption() {
  return document.querySelector<HTMLElement>("mapbox-search-listbox [role='option']");
}

export function PersonEditorSheet({
  draft,
  mode,
  open,
  onClose,
  onSave,
  setDraft,
}: PersonEditorSheetProps) {
  const updateDraftField = <TField extends keyof PersonDraft>(
    field: TField,
    value: PersonDraft[TField],
  ) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const primeFirstSuggestion = () => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (!(activeElement instanceof HTMLInputElement) || activeElement.name !== "address") {
        return;
      }

      if (getHighlightedMapboxOption()) {
        return;
      }

      activeElement.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
  };

  const acceptSuggestion = () => {
    const option = getHighlightedMapboxOption() ?? getFirstMapboxOption();

    if (!option) {
      return false;
    }

    option.click();
    return true;
  };

  const focusNextField = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    const form = event.currentTarget.form;

    if (!form) {
      return;
    }

    const focusableElements = Array.from(form.elements).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        !element.hasAttribute("disabled") &&
        element.tabIndex !== -1,
    );
    const currentIndex = focusableElements.indexOf(event.currentTarget);
    const nextField = focusableElements[currentIndex + 1];

    window.requestAnimationFrame(() => {
      nextField?.focus();
    });
  };

  const onAddressKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Tab" && event.key !== "Enter") {
      return;
    }

    if (!acceptSuggestion()) {
      return;
    }

    event.preventDefault();

    if (event.key === "Tab") {
      focusNextField(event);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Add person" : "Edit person"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Create a local person record. This will become the create flow later."
              : "Update the selected contact in local state. This will become the CRUD surface later."}
          </SheetDescription>
        </SheetHeader>

        {draft ? (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              onSave();
            }}
          >
            <div className="flex flex-1 flex-col gap-5 px-4 pb-4">
              <Field label="Name">
                <Input
                  name="name"
                  value={draft.name}
                  onChange={(event) => updateDraftField("name", event.target.value)}
                />
              </Field>
              <Field label="Role">
                <Input
                  name="role"
                  value={draft.role}
                  onChange={(event) => updateDraftField("role", event.target.value)}
                />
              </Field>
              <Field label="Address">
                {hasMapboxToken ? (
                  <AddressAutofill
                    accessToken={mapboxToken}
                    onSuggest={(result) => {
                      if (result.suggestions?.length) {
                        primeFirstSuggestion();
                      }
                    }}
                  >
                    <Input
                      autoComplete="street-address"
                      name="address"
                      value={draft.address}
                      onKeyDown={onAddressKeyDown}
                      onChange={(event) => updateDraftField("address", event.target.value)}
                    />
                  </AddressAutofill>
                ) : (
                  <Input
                    autoComplete="street-address"
                    name="address"
                    value={draft.address}
                    onKeyDown={onAddressKeyDown}
                    onChange={(event) => updateDraftField("address", event.target.value)}
                  />
                )}
              </Field>
              <Field label="Pickup">
                <Input
                  name="pickup"
                  value={draft.pickup}
                  onChange={(event) => updateDraftField("pickup", event.target.value)}
                />
              </Field>
              <Field label="Email">
                <Input
                  autoComplete="email"
                  name="email"
                  value={draft.email}
                  onChange={(event) => updateDraftField("email", event.target.value)}
                />
              </Field>

              <div>
                <p className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
                  Status
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {statusOptions.map((status) => (
                    <Button
                      key={status}
                      type="button"
                      variant={draft.status === status ? "default" : "outline"}
                      size="sm"
                      className={cn(
                        draft.status !== status &&
                          "border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]",
                      )}
                      onClick={() => updateDraftField("status", status)}
                    >
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <SheetFooter className="border-t border-[#ecece8] bg-[#fcfcfa]">
              <Button
                type="button"
                variant="outline"
                className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button type="submit">{mode === "create" ? "Add person" : "Save changes"}</Button>
            </SheetFooter>
          </form>
        ) : null}
      </SheetContent>
    </Sheet>
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
