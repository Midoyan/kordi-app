"use client";

import dynamic from "next/dynamic";
import {
  SearchBoxCore,
  SessionToken,
  type AddressAutofillRetrieveResponse,
  type SearchBoxRetrieveResponse,
  type SearchBoxSuggestion,
} from "@mapbox/search-js-core";
import {
  type ComponentProps,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  mode?: "address" | "search";
  onSuggestionSelect?: (selection: {
    address: string;
    name: string | null;
    notes: string | null;
  }) => void;
};

const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
const hasMapboxToken = Boolean(mapboxToken);
const AddressAutofill = dynamic(
  () => import("@mapbox/search-js-react").then((module) => module.AddressAutofill),
  { ssr: false },
);
const SEARCH_DEBOUNCE_MS = 180;
const MIN_SEARCH_CHARACTERS = 2;

function stripTrailingCountry(address: string, country?: string) {
  if (!country) {
    return address;
  }

  const suffix = `, ${country}`;

  if (address.toLowerCase().endsWith(suffix.toLowerCase())) {
    return address.slice(0, -suffix.length);
  }

  return address;
}

function getRetrievedAddress(result: AddressAutofillRetrieveResponse) {
  const feature = result.features?.[0];

  if (!feature) {
    return null;
  }

  const properties = feature.properties;
  const fullAddress =
    typeof properties.full_address === "string" ? properties.full_address.trim() : "";

  if (fullAddress) {
    return stripTrailingCountry(fullAddress, properties.country).trim();
  }

  const locality = [properties.postcode, properties.address_level2]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  const fallback = [properties.address_line1, locality]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(", ");

  return fallback || null;
}

function toSentenceCase(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function joinAddressParts(parts: Array<string | null | undefined>) {
  return parts
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .filter((value, index, values) => values.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index)
    .join(", ");
}

function getSuggestionArea(suggestion: SearchBoxSuggestion) {
  const areaCandidates = [
    suggestion.context?.locality?.name,
    suggestion.context?.neighborhood?.name,
    suggestion.context?.district?.name,
  ]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);

  const place = suggestion.context?.place?.name?.trim() || "";

  return (
    areaCandidates.find((value) => value.toLowerCase() !== place.toLowerCase()) ?? null
  );
}

function getSuggestionDisplayAddress(suggestion: SearchBoxSuggestion) {
  const addressLine = suggestion.address?.trim() || suggestion.name?.trim() || "";
  const postcode = suggestion.context?.postcode?.name?.trim() || "";
  const place = suggestion.context?.place?.name?.trim() || "";
  const country = suggestion.context?.country?.name?.trim() || "";
  const area = getSuggestionArea(suggestion);
  const locality = [postcode, place].filter(Boolean).join(" ").trim();
  const localityWithArea =
    locality && area ? `${locality} (${area})` : locality || area || "";

  return joinAddressParts([addressLine, localityWithArea, country]);
}

function getSuggestionPrimaryLabel(suggestion: SearchBoxSuggestion) {
  const preferredName =
    suggestion.name_preferred?.trim() || suggestion.name?.trim() || "";
  const formattedAddress = getSuggestionDisplayAddress(suggestion);

  if (
    preferredName &&
    suggestion.feature_type === "poi" &&
    preferredName.toLowerCase() !== formattedAddress.toLowerCase()
  ) {
    return preferredName;
  }

  return formattedAddress || preferredName;
}

function getSuggestionSecondaryLabel(suggestion: SearchBoxSuggestion) {
  const formattedAddress = getSuggestionDisplayAddress(suggestion);
  const primaryLabel = getSuggestionPrimaryLabel(suggestion);

  if (
    !formattedAddress ||
    !primaryLabel ||
    formattedAddress.toLowerCase() === primaryLabel.toLowerCase()
  ) {
    return null;
  }

  return formattedAddress;
}

function getRetrievedSearchSelection(result: SearchBoxRetrieveResponse) {
  const feature = result.features?.[0];

  if (!feature) {
    return null;
  }

  const properties = feature.properties;
  const fullAddress =
    typeof properties.full_address === "string" ? properties.full_address.trim() : "";
  const normalizedFullAddress = fullAddress || joinAddressParts([
    typeof properties.address === "string" ? properties.address : null,
    properties.place_formatted,
  ]);
  const address = normalizedFullAddress.trim();

  if (!address) {
    return null;
  }

  const category =
    Array.isArray(properties.poi_category) && properties.poi_category[0]
      ? toSentenceCase(properties.poi_category[0])
      : typeof properties.feature_type === "string" && properties.feature_type.trim()
        ? toSentenceCase(properties.feature_type.replace(/_/g, " "))
        : null;
  const area =
    properties.context?.neighborhood?.name ??
    properties.context?.district?.name ??
    properties.context?.locality?.name ??
    properties.context?.place?.name ??
    null;
  const notes = [category, area ? `Area: ${area}` : null]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" · ");

  return {
    address,
    name: typeof properties.name === "string" && properties.name.trim() ? properties.name.trim() : null,
    notes: notes || null,
  };
}

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
  mode = "address",
  onSuggestionSelect,
  autoComplete = "street-address",
  name = "address",
  onBlur,
  onFocus,
  onKeyDown,
  className,
  ...inputProps
}: AddressAutofillInputProps) {
  const search = useMemo(
    () =>
      hasMapboxToken && mode === "search"
        ? new SearchBoxCore({
            accessToken: mapboxToken,
            proximity,
            limit: 6,
          })
        : null,
    [mode, proximity],
  );
  const [suggestions, setSuggestions] = useState<SearchBoxSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const sessionTokenRef = useRef<SessionToken | null>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(false);
  const suppressNextSuggestRef = useRef(false);
  const isSearchMode = mode === "search" && hasMapboxToken;
  const trimmedValue = value.trim();

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isSearchMode || !search) {
      return;
    }

    if (suppressNextSuggestRef.current) {
      suppressNextSuggestRef.current = false;
      return;
    }

    if (trimmedValue.length < MIN_SEARCH_CHARACTERS) {
      sessionTokenRef.current = null;
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new SessionToken();
      }

      try {
        const response = await search.suggest(trimmedValue, {
          proximity,
          sessionToken: sessionTokenRef.current,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        setSuggestions(response.suggestions);
        setHighlightedIndex(0);
        setIsSuggestionsOpen(response.suggestions.length > 0);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setHighlightedIndex(0);
        setIsSuggestionsOpen(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [isSearchMode, proximity, search, trimmedValue]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const primeFirstSuggestion = () => {
    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = null;

      if (!isMountedRef.current) {
        return;
      }

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

    if (event.defaultPrevented) {
      return;
    }

    if (isSearchMode) {
      if (event.key === "ArrowDown") {
        if (!suggestions.length) {
          return;
        }

        event.preventDefault();
        setIsSuggestionsOpen(true);
        setHighlightedIndex((current) => (current + 1) % suggestions.length);
        return;
      }

      if (event.key === "ArrowUp") {
        if (!suggestions.length) {
          return;
        }

        event.preventDefault();
        setIsSuggestionsOpen(true);
        setHighlightedIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
        return;
      }

      if (event.key === "Escape") {
        setIsSuggestionsOpen(false);
        return;
      }

      if ((event.key === "Tab" || event.key === "Enter") && suggestions[highlightedIndex]) {
        event.preventDefault();
        void selectSearchSuggestion(suggestions[highlightedIndex], event.key === "Tab", event);
      }
      return;
    }

    if (event.key === "Tab" || event.key === "Enter") {
      if (!acceptSuggestion()) {
        return;
      }

      event.preventDefault();

      if (event.key === "Tab") {
        focusNextField(event);
      }
    }
  };

  const clearSearchSuggestions = () => {
    setSuggestions([]);
    setHighlightedIndex(0);
    setIsSuggestionsOpen(false);
    sessionTokenRef.current = null;
  };

  const selectSearchSuggestion = async (
    suggestion: SearchBoxSuggestion,
    moveFocus: boolean,
    event: ReactKeyboardEvent<HTMLInputElement> | null,
  ) => {
    if (!search) {
      return;
    }

    const sessionToken = sessionTokenRef.current ?? new SessionToken();

    try {
      const result = await search.retrieve(suggestion, {
        sessionToken,
      });
      const selection = getRetrievedSearchSelection(result);

      if (!selection) {
        return;
      }

      clearSearchSuggestions();
      suppressNextSuggestRef.current = true;
      onValueChange(selection.address);
      onSuggestionSelect?.(selection);

      if (moveFocus && event) {
        focusNextField(event);
      }
    } catch {
      // Keep the typed value if retrieval fails.
    }
  };

  const inputClassName = cn(isSearchMode && "pr-9", className);
  const showSearchSuggestions =
    isSearchMode &&
    isSuggestionsOpen &&
    trimmedValue.length >= MIN_SEARCH_CHARACTERS &&
    suggestions.length > 0;

  const input = (
    <Input
      {...inputProps}
      autoComplete={autoComplete}
      name={name}
      value={value}
      onFocus={(event) => {
        onFocus?.(event);

        if (isSearchMode && trimmedValue.length >= MIN_SEARCH_CHARACTERS && suggestions.length > 0) {
          setIsSuggestionsOpen(true);
        }
      }}
      onBlur={(event) => {
        onBlur?.(event);

        if (!isSearchMode) {
          return;
        }

        blurTimeoutRef.current = window.setTimeout(() => {
          setIsSuggestionsOpen(false);
        }, 120);
      }}
      onKeyDown={handleKeyDown}
      onChange={(event) => {
        if (isSearchMode) {
          const nextValue = event.target.value;

          suppressNextSuggestRef.current = false;
          if (nextValue.trim().length < MIN_SEARCH_CHARACTERS) {
            clearSearchSuggestions();
          } else {
            setIsSuggestionsOpen(true);
          }

          onValueChange(nextValue);
          return;
        }

        onValueChange(event.target.value);
      }}
      className={inputClassName}
    />
  );

  if (isSearchMode) {
    return (
      <>
        <div className="relative">
          {input}
          {showSearchSuggestions ? (
            <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-[#dddcd4] bg-white p-1 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.4)]">
              {suggestions.map((suggestion, index) => {
                const isHighlighted = index === highlightedIndex;
                const primaryLabel = getSuggestionPrimaryLabel(suggestion);
                const detail = getSuggestionSecondaryLabel(suggestion);

                return (
                  <button
                    key={`${suggestion.mapbox_id}-${index}`}
                    type="button"
                    className={cn(
                      "flex w-full flex-col rounded-lg px-2 py-1.5 text-left transition-colors",
                      isHighlighted ? "bg-[rgb(243,243,239)]" : "hover:bg-[#f7f7f4]",
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    onMouseEnter={() => {
                      setHighlightedIndex(index);
                    }}
                    onClick={() => {
                      void selectSearchSuggestion(suggestion, false, null);
                    }}
                  >
                    <span className="text-[13px] font-medium text-[#1d1d1b]">
                      {primaryLabel}
                    </span>
                    {detail ? (
                      <span className="mt-1 text-[12px] leading-3 text-[#6b6b67]">{detail}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {helperText ? (
          <p className={cn("mt-2 text-[12px] leading-5 text-[#7c7c75]", helperTextClassName)}>
            {helperText}
          </p>
        ) : null}
      </>
    );
  }

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
          onRetrieve={(result) => {
            const nextAddress = getRetrievedAddress(result);

            if (!nextAddress) {
              return;
            }

            animationFrameRef.current = window.requestAnimationFrame(() => {
              animationFrameRef.current = null;

              if (!isMountedRef.current) {
                return;
              }

              onValueChange(nextAddress);
            });
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
