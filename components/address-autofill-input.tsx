"use client";

import dynamic from "next/dynamic";
import type { ComponentProps, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AddressProximity =
  | "ip"
  | { lng: number; lat: number }
  | { lon: number; lat: number }
  | [number, number];

type AddressAutofillInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  proximity?: AddressProximity;
  helperText?: ReactNode;
  helperTextClassName?: string;
};

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

export function AddressAutofillInput({
  value,
  onValueChange,
  proximity,
  helperText,
  helperTextClassName,
  autoComplete = "street-address",
  name = "address",
  onKeyDown,
  className,
  ...inputProps
}: AddressAutofillInputProps) {
  const primeFirstSuggestion = () => {
    window.requestAnimationFrame(() => {
      const activeElement = document.activeElement;

      if (!(activeElement instanceof HTMLInputElement) || activeElement.name !== name) {
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

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);

    if (event.defaultPrevented || (event.key !== "Tab" && event.key !== "Enter")) {
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

  const input = (
    <Input
      {...inputProps}
      autoComplete={autoComplete}
      name={name}
      value={value}
      onKeyDown={handleKeyDown}
      onChange={(event) => onValueChange(event.target.value)}
      className={className}
    />
  );

  return (
    <>
      {hasMapboxToken ? (
        <AddressAutofill
          accessToken={mapboxToken}
          options={proximity ? { proximity } : undefined}
          onSuggest={(result) => {
            if (result.suggestions?.length) {
              primeFirstSuggestion();
            }
          }}
        >
          {input}
        </AddressAutofill>
      ) : (
        input
      )}
      {helperText ? (
        <p className={cn("mt-2 text-[12px] leading-5 text-[#7c7c75]", helperTextClassName)}>
          {helperText}
        </p>
      ) : null}
    </>
  );
}
