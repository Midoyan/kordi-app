"use client";

import { GeocodingCore, SearchBoxCore, type GeocodingFeature, type SearchBoxCategorySuggestion } from "@mapbox/search-js-core";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { TransportMap } from "./transport-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LocationMapPreviewProps = {
  address: string;
  accessToken?: string;
  proximity?: { lng: number; lat: number };
  className?: string;
};

type PreviewState = {
  feature: GeocodingFeature | null;
  nearbyPoi: SearchBoxCategorySuggestion | null;
  kiez: string | null;
  status: "idle" | "loading" | "ready" | "error";
};

const nearbyPoiCategories = ["landmark", "tourist attraction", "museum", "monument", "cafe", "hotel"] as const;

function getKiezLabel(feature: GeocodingFeature | null) {
  if (!feature) {
    return null;
  }

  const context = feature.properties.context;
  return (
    context.neighborhood?.name ??
    context.locality?.name ??
    context.place?.name ??
    context.district?.name ??
    null
  );
}

function buildPoiDetail(poi: SearchBoxCategorySuggestion | null) {
  if (!poi) {
    return null;
  }

  return [
    poi.properties.poi_category?.[0] ?? poi.properties.feature_type,
    poi.properties.full_address || poi.properties.place_formatted,
  ]
    .filter(Boolean)
    .join(" · ");
}

async function findNearbyPoi(
  search: SearchBoxCore,
  feature: GeocodingFeature,
  signal: AbortSignal,
) {
  const proximity = {
    lng: feature.properties.coordinates.longitude,
    lat: feature.properties.coordinates.latitude,
  };

  for (const category of nearbyPoiCategories) {
    const response = await search.category(category, {
      proximity,
      limit: 5,
      language: "en",
      signal,
    });

    const candidate =
      response.features.find((item) => item.properties.name && item.properties.name !== feature.properties.name) ??
      response.features[0] ??
      null;

    if (candidate?.properties.name) {
      return candidate;
    }
  }

  return null;
}

export function LocationMapPreview({
  address,
  accessToken = "",
  proximity,
  className,
}: LocationMapPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({
    feature: null,
    nearbyPoi: null,
    kiez: null,
    status: "idle",
  });
  const hasMapboxToken = Boolean(accessToken.trim());
  const trimmedAddress = address.trim();
  const geocoder = useMemo(
    () =>
      hasMapboxToken
        ? new GeocodingCore({
            accessToken,
            language: "en",
            country: "DE",
            proximity,
          })
        : null,
    [accessToken, hasMapboxToken, proximity],
  );
  const searchBox = useMemo(
    () =>
      hasMapboxToken
        ? new SearchBoxCore({
            accessToken,
            language: "en",
            country: "DE",
          })
        : null,
    [accessToken, hasMapboxToken],
  );

  useEffect(() => {
    if (!hasMapboxToken || !trimmedAddress || !geocoder || !searchBox) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setPreview((current) => ({ ...current, status: "loading" }));

      try {
        const response = await geocoder.forward(trimmedAddress, {
          autocomplete: true,
          limit: 1,
          signal: controller.signal,
        });
        const feature = response.features[0] ?? null;

        if (!feature) {
          setPreview({
            feature: null,
            nearbyPoi: null,
            kiez: null,
            status: "error",
          });
          return;
        }

        const nearbyPoi = await findNearbyPoi(searchBox, feature, controller.signal);

        setPreview({
          feature,
          nearbyPoi,
          kiez: getKiezLabel(feature),
          status: "ready",
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setPreview({
          feature: null,
          nearbyPoi: null,
          kiez: null,
          status: "error",
        });
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [geocoder, hasMapboxToken, searchBox, trimmedAddress]);

  const resolvedPreview =
    hasMapboxToken && trimmedAddress
      ? preview
      : {
          feature: null,
          nearbyPoi: null,
          kiez: null,
          status: "idle" as const,
        };
  const detail = buildPoiDetail(resolvedPreview.nearbyPoi);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[18px] border border-[#e4e4de] bg-[linear-gradient(180deg,#f9f9f6_0%,#f1f0ea_100%)]",
        className,
      )}
    >
      <div className="border-b border-[#e4e4de] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium",
                  resolvedPreview.kiez
                    ? "border-[#d9d6cb] bg-white text-[#33312d]"
                    : "border-[#e4e4de] bg-[#f6f5ef] text-[#7a7a74]",
                )}
              >
                Kiez · {resolvedPreview.kiez ?? "Resolving"}
              </span>
              {resolvedPreview.feature?.properties.coordinates.accuracy ? (
                <span className="inline-flex rounded-full border border-[#e4e4de] bg-[#f6f5ef] px-2.5 py-1 text-[11px] font-medium text-[#6b6b67]">
                  Pin · {resolvedPreview.feature.properties.coordinates.accuracy}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-[13px] leading-6 text-[#3b3935]">
              {resolvedPreview.nearbyPoi
                ? `This point is nearby ${resolvedPreview.nearbyPoi.properties.name}.`
                : resolvedPreview.status === "loading"
                  ? "Finding a nearby point of interest for quick orientation."
                  : resolvedPreview.feature
                    ? "No nearby point of interest found yet, but the pin is locked to the entered address."
                    : hasMapboxToken
                      ? "Use the address field to anchor this location against a recognizable nearby place."
                      : "Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the minimap and nearby-place context."}
            </p>
            {detail ? (
              <p className="mt-1 text-[12px] leading-5 text-[#6b6b67]">{detail}</p>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-[#d8d6cd] bg-white/85 text-[#2f2d2a] hover:bg-white"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? (
              <>
                <ChevronUp data-icon="inline-start" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown data-icon="inline-start" />
                Expand
              </>
            )}
          </Button>
        </div>
      </div>

      {expanded ? (
        <TransportMap
          accessToken={accessToken}
          feature={resolvedPreview.feature}
          className="h-[150px] w-full"
          footer={false}
          emptyTitle="Enter an address to preview the exact point"
          emptyDetail="The pin will lock onto the selected address and add a nearby landmark for orientation."
          loadingTitle="Resolving address preview"
          loadingDetail="Finding a stable pin position for this stop."
          missingTokenTitle="Map preview unavailable without a Mapbox token"
          missingTokenDetail="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the minimap and nearby-place context."
          errorTitle="We couldn't resolve this address yet"
          errorDetail="Try a more complete address to lock the pin."
        />
      ) : null}
    </div>
  );
}
