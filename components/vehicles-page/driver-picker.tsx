"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { type PersonRecord, getPersonSearchText } from "@/lib/people";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

import {
  CLEAR_DRIVER_VALUE,
  CREATE_DRIVER_VALUE_PREFIX,
} from "@/components/vehicles-page/types";

type DriverPickerProps = {
  driverCrewMemberId: string;
  driverName: string;
  people: PersonRecord[];
  isLoadingPeople: boolean;
  peopleLoadError: string | null;
  isOpen: boolean;
  search: string;
  fieldError?: string;
  onOpenChange: (open: boolean) => void;
  onSearchChange: (value: string) => void;
  onSelectExisting: (person: PersonRecord) => void;
  onSelectNew: (name: string) => void;
  onClear: () => void;
};

export function DriverPicker({
  driverCrewMemberId,
  driverName,
  people,
  isLoadingPeople,
  peopleLoadError,
  isOpen,
  search,
  fieldError,
  onOpenChange,
  onSearchChange,
  onSelectExisting,
  onSelectNew,
  onClear,
}: DriverPickerProps) {
  const normalizedDriverSearch = search.trim().toLowerCase();
  const filteredDriverOptions =
    normalizedDriverSearch.length === 0
      ? people.slice(0, 8)
      : people.filter((person) => getPersonSearchText(person).includes(normalizedDriverSearch)).slice(0, 8);
  const exactDriverMatch =
    normalizedDriverSearch.length === 0
      ? null
      : people.find((person) => person.name.trim().toLowerCase() === normalizedDriverSearch) ?? null;
  const shouldOfferCreateDriver = normalizedDriverSearch.length > 0 && exactDriverMatch === null;
  const showDriverEmptyState =
    !isLoadingPeople &&
    !peopleLoadError &&
    filteredDriverOptions.length === 0 &&
    !shouldOfferCreateDriver;
  const selectedDriverValue =
    driverCrewMemberId || (driverName.trim() ? `${CREATE_DRIVER_VALUE_PREFIX}${driverName.trim()}` : null);

  return (
    <Combobox<string>
      value={selectedDriverValue}
      onValueChange={(nextValue) => {
        if (!nextValue) {
          return;
        }

        if (nextValue === CLEAR_DRIVER_VALUE) {
          onClear();
          return;
        }

        if (nextValue.startsWith(CREATE_DRIVER_VALUE_PREFIX)) {
          onSelectNew(nextValue.slice(CREATE_DRIVER_VALUE_PREFIX.length));
          return;
        }

        const person = people.find((entry) => entry.id === nextValue);

        if (!person) {
          return;
        }

        onSelectExisting(person);
      }}
      open={isOpen}
      onOpenChange={onOpenChange}
      inputValue={search}
      onInputValueChange={onSearchChange}
      autoHighlight
      itemToStringLabel={(value) => {
        if (value.startsWith(CREATE_DRIVER_VALUE_PREFIX)) {
          return value.slice(CREATE_DRIVER_VALUE_PREFIX.length);
        }

        return people.find((person) => person.id === value)?.name ?? driverName;
      }}
    >
      <ComboboxTrigger
        aria-invalid={fieldError ? "true" : undefined}
        className={cn(
          "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 text-left text-sm text-[#1d1d1b] outline-none transition-colors hover:bg-[#fafaf7] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          fieldError ? "border-amber-300 focus-visible:border-amber-400" : undefined,
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          <ComboboxValue placeholder="Select or add a driver">
            {(value) => {
              if (!value) {
                return "Select or add a driver";
              }

              if (typeof value === "string" && value.startsWith(CREATE_DRIVER_VALUE_PREFIX)) {
                return `New driver: ${value.slice(CREATE_DRIVER_VALUE_PREFIX.length)}`;
              }

              return people.find((person) => person.id === value)?.name ?? driverName;
            }}
          </ComboboxValue>
        </span>
        <span className="ml-3 flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#6b6b67]">
          <Search className="size-3.5" />
          Search
        </span>
      </ComboboxTrigger>
      <ComboboxContent className="border border-[#e3e3df] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]">
        <div className="p-1 pb-0">
          <ComboboxInput
            autoFocus
            placeholder="Search crew members"
            showTrigger={false}
            className="w-full"
          />
        </div>
        <ComboboxList>
          {filteredDriverOptions.map((person) => (
            <ComboboxItem
              key={person.id}
              value={person.id}
              className="items-start gap-3 px-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                  {person.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">{person.phone || "No phone"}</p>
                {person.address ? (
                  <p className="mt-1 truncate text-[11px] text-[#8a8a84]">
                    {person.address}
                  </p>
                ) : null}
              </div>
            </ComboboxItem>
          ))}
          {shouldOfferCreateDriver ? (
            <ComboboxItem
              value={`${CREATE_DRIVER_VALUE_PREFIX}${search.trim()}`}
              className="items-start gap-3 px-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                  Add {search.trim()}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                  Create this driver in the crew roster when the van is saved.
                </p>
              </div>
            </ComboboxItem>
          ) : null}
          {isLoadingPeople ? (
            <div className="px-2 py-2.5 text-[13px] text-[#6b6b67]">Loading crew members...</div>
          ) : null}
          {peopleLoadError ? (
            <div className="px-2 py-2.5 text-[13px] text-amber-800">
              Unable to load crew members.
            </div>
          ) : null}
          {showDriverEmptyState ? (
            <div className="px-2 py-2.5 text-[13px] text-[#6b6b67]">No matching crew members.</div>
          ) : null}
          <ComboboxItem value={CLEAR_DRIVER_VALUE} className="items-start gap-3 px-2 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                No driver assigned
              </p>
              <p className="mt-0.5 text-[11px] text-[#6b6b67]">
                Save the van with a null `crew_member_id`.
              </p>
            </div>
          </ComboboxItem>
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
