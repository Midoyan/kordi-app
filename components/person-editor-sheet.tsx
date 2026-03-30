"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";

import { AddressAutofillInput } from "@/components/address-autofill-input";
import { EditorSheetLayout } from "@/components/editor-sheet-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SheetFooter } from "@/components/ui/sheet";
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

type PersonEditorSheetProps = {
  draft: PersonDraft | null;
  mode: "create" | "edit" | null;
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  setDraft: Dispatch<SetStateAction<PersonDraft | null>>;
};

const statusOptions: PersonStatus[] = ["Ready", "Pending pickup", "Draft", "Imported"];
const demoPeopleDrafts: PersonDraft[] = [
  {
    name: "Marlene Vogel",
    role: "Produktionskoordinatorin",
    address: "Friedrichstraße 43, 10969 Berlin",
    pickup: "6:45 Uhr – Hotel Arcotel John F",
    email: "marlene.vogel@example.com",
    status: "Ready",
  },
  {
    name: "Tobias Krämer",
    role: "Lichttechniker",
    address: "Boxhagener Straße 27, 10245 Berlin",
    pickup: "7:10 Uhr – Warschauer Straße",
    email: "tobias.kraemer@example.com",
    status: "Pending pickup",
  },
  {
    name: "Svenja Richter",
    role: "Künstlerbetreuung",
    address: "Kurfürstendamm 55, 10707 Berlin",
    pickup: "7:25 Uhr – Adenauerplatz",
    email: "svenja.richter@example.com",
    status: "Draft",
  },
  {
    name: "Lukas Brandt",
    role: "Tonassistent",
    address: "Torstraße 98, 10119 Berlin",
    pickup: "6:55 Uhr – Rosenthaler Platz",
    email: "lukas.brandt@example.com",
    status: "Ready",
  },
  {
    name: "Hannah Weiss",
    role: "Set-Assistenz",
    address: "Potsdamer Straße 120, 10785 Berlin",
    pickup: "7:40 Uhr – Potsdamer Platz",
    email: "hannah.weiss@example.com",
    status: "Pending pickup",
  },
];

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

  const randomizeDraft = () => {
    const template = demoPeopleDrafts[Math.floor(Math.random() * demoPeopleDrafts.length)];
    setDraft((current) => (current ? { ...current, ...template } : current));
  };

  return (
    <EditorSheetLayout
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      title={mode === "create" ? "Add person" : "Edit person"}
      description={
        mode === "create"
          ? "Create a local person record. This will become the create flow later."
          : "Update the selected contact in local state. This will become the CRUD surface later."
      }
      contentClassName="sm:max-w-[480px]"
      headerClassName="px-4 py-4"
      titleClassName="text-base font-semibold tracking-normal"
      descriptionClassName="mt-0 text-sm"
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
              <AddressAutofillInput
                value={draft.address}
                onValueChange={(value) => updateDraftField("address", value)}
              />
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
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                onClick={randomizeDraft}
              >
                Randomize demo
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button type="submit">{mode === "create" ? "Add person" : "Save changes"}</Button>
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
