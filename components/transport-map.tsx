"use client";

import { GeocodingCore, type GeocodingFeature } from "@mapbox/search-js-core";
import { MapPin, Satellite } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TransportMapProps = {
  accessToken?: string;
  address?: string;
  feature?: GeocodingFeature | null;
  proximity?: { lng: number; lat: number };
  className?: string;
  children?: ReactNode;
  satelliteToggle?: boolean;
  keepMarkerCentered?: boolean;
  canAdjustMarker?: boolean;
  footer?: boolean | string;
  defaultMapStyle?: [string, string];
  emptyTitle?: string;
  emptyDetail?: ReactNode;
  loadingTitle?: string;
  loadingDetail?: ReactNode;
  missingTokenTitle?: string;
  missingTokenDetail?: ReactNode;
  errorTitle?: string;
  errorDetail?: ReactNode;
};

type ResolvedFeatureState = {
  address: string;
  feature: GeocodingFeature | null;
  status: "idle" | "loading" | "ready" | "error";
};

type MapStyleMode = "default" | "satellite";

const MAX_IMAGE_DIMENSION = 1280;
const FALLBACK_SIZE = { width: 640, height: 320 };

export function TransportMap({
  accessToken = "",
  address = "",
  feature = null,
  proximity,
  className,
  children,
  satelliteToggle = true,
  keepMarkerCentered = false,
  canAdjustMarker = false,
  footer = false,
  defaultMapStyle = ["mapbox", "light-v11"],
  emptyTitle = "Enter an address to preview the exact point",
  emptyDetail = "The pin will lock onto the selected address and add orientation for dispatch.",
  loadingTitle = "Resolving map preview",
  loadingDetail = "Looking up the current point on the map.",
  missingTokenTitle = "Map preview unavailable without a Mapbox token",
  missingTokenDetail = "Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the shared map surface.",
  errorTitle = "We couldn't resolve this address yet",
  errorDetail = "Try a more complete address to lock the pin.",
}: TransportMapProps) {
  const trimmedAddress = address.trim();
  const hasMapboxToken = Boolean(accessToken.trim());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(FALLBACK_SIZE);
  const [mapStyleMode, setMapStyleMode] = useState<MapStyleMode>("default");
  const [resolvedFeature, setResolvedFeature] = useState<ResolvedFeatureState>({
    address: "",
    feature: null,
    status: "idle",
  });

  const geocoder = useMemo(() => {
    if (!hasMapboxToken || feature || !trimmedAddress) {
      return null;
    }

    return new GeocodingCore({
      accessToken,
      language: "en",
      proximity,
    });
  }, [accessToken, feature, hasMapboxToken, proximity, trimmedAddress]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const updateSize = () => {
      const nextWidth = Math.max(Math.round(container.clientWidth), FALLBACK_SIZE.width);
      const nextHeight = Math.max(Math.round(container.clientHeight), FALLBACK_SIZE.height);

      setSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    };

    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!hasMapboxToken || !trimmedAddress || !geocoder) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setResolvedFeature({
        address: trimmedAddress,
        feature: null,
        status: "loading",
      });

      try {
        const response = await geocoder.forward(trimmedAddress, {
          autocomplete: true,
          limit: 1,
          signal: controller.signal,
        });

        setResolvedFeature({
          address: trimmedAddress,
          feature: response.features[0] ?? null,
          status: response.features[0] ? "ready" : "error",
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setResolvedFeature({
          address: trimmedAddress,
          feature: null,
          status: "error",
        });
      }
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [feature, geocoder, hasMapboxToken, trimmedAddress]);

  const hasResolvedMatch = resolvedFeature.address === trimmedAddress;
  const currentFeature =
    feature ?? (hasMapboxToken && trimmedAddress && hasResolvedMatch ? resolvedFeature.feature : null);
  const currentStatus =
    feature
      ? "ready"
      : !hasMapboxToken || !trimmedAddress || !geocoder
        ? "idle"
        : hasResolvedMatch
          ? resolvedFeature.status
          : "loading";

  const mapImageUrl = useMemo(() => {
    if (!hasMapboxToken || !currentFeature) {
      return null;
    }

    const [lng, lat] = currentFeature.geometry.coordinates;
    const style = mapStyleMode === "satellite" ? ["mapbox", "satellite-streets-v12"] : defaultMapStyle;
    const width = Math.min(Math.max(size.width, FALLBACK_SIZE.width), MAX_IMAGE_DIMENSION);
    const height = Math.min(Math.max(size.height, FALLBACK_SIZE.height), MAX_IMAGE_DIMENSION);
    const zoom = getFeatureZoom(currentFeature);
    const markerColor = "1d1d1b";

    return `https://api.mapbox.com/styles/v1/${style[0]}/${style[1]}/static/pin-s+${markerColor}(${lng},${lat})/${lng},${lat},${zoom},0/${width}x${height}@2x?access_token=${encodeURIComponent(accessToken)}`;
  }, [accessToken, currentFeature, defaultMapStyle, hasMapboxToken, mapStyleMode, size.height, size.width]);

  const footerContent =
    typeof footer === "string"
      ? footer
      : footer
        ? "Static preview powered by Mapbox. Marker dragging is disabled in this build."
        : null;

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden rounded-[inherit] bg-[#f2f1eb]", className)}
      data-keep-marker-centered={keepMarkerCentered ? "" : undefined}
      data-can-adjust-marker={canAdjustMarker ? "" : undefined}
    >
      {hasMapboxToken && currentFeature && mapImageUrl ? (
        <>
          <img
            src={mapImageUrl}
            alt="Address map preview"
            className="block h-full min-h-[12rem] w-full object-cover"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/45 via-black/10 to-transparent px-3 pb-2 pt-8">
            <p className="text-[11px] font-medium text-white/90">Static address preview</p>
            <p className="text-[10px] text-white/75">Mapbox</p>
          </div>
          {satelliteToggle ? (
            <div className="absolute right-3 top-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-white/70 bg-white/92 text-[#1d1d1b] shadow-sm hover:bg-white"
                onClick={() =>
                  setMapStyleMode((current) => (current === "default" ? "satellite" : "default"))
                }
              >
                <Satellite className="size-4" />
                {mapStyleMode === "default" ? "Satellite" : "Default"}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <MapPlaceholder
          hasMapboxToken={hasMapboxToken}
          status={currentStatus}
          emptyTitle={emptyTitle}
          emptyDetail={emptyDetail}
          loadingTitle={loadingTitle}
          loadingDetail={loadingDetail}
          missingTokenTitle={missingTokenTitle}
          missingTokenDetail={missingTokenDetail}
          errorTitle={errorTitle}
          errorDetail={errorDetail}
        />
      )}

      {footerContent ? (
        <div className="border-t border-[#e1dfd6] bg-[#faf9f4] px-3 py-2 text-[11px] text-[#6b6b67]">
          {footerContent}
        </div>
      ) : null}

      {children ? <div className="pointer-events-none absolute inset-0">{children}</div> : null}
    </div>
  );
}

function getFeatureZoom(feature: GeocodingFeature) {
  const placeType = (feature.properties as { place_type?: string[] }).place_type;
  const featureType =
    feature.properties.feature_type ?? (Array.isArray(placeType) ? placeType[0] : undefined);

  switch (featureType) {
    case "street":
      return 15;
    case "neighborhood":
    case "postcode":
    case "locality":
    case "oaza":
      return 14;
    case "place":
    case "city":
      return 13;
    case "district":
      return 10;
    case "region":
    case "prefecture":
      return 7;
    case "country":
      return 5;
    default:
      return 15;
  }
}

function MapPlaceholder({
  hasMapboxToken,
  status,
  emptyTitle,
  emptyDetail,
  loadingTitle,
  loadingDetail,
  missingTokenTitle,
  missingTokenDetail,
  errorTitle,
  errorDetail,
}: {
  hasMapboxToken: boolean;
  status: ResolvedFeatureState["status"];
  emptyTitle: string;
  emptyDetail: ReactNode;
  loadingTitle: string;
  loadingDetail: ReactNode;
  missingTokenTitle: string;
  missingTokenDetail: ReactNode;
  errorTitle: string;
  errorDetail: ReactNode;
}) {
  let title = emptyTitle;
  let detail = emptyDetail;

  if (!hasMapboxToken) {
    title = missingTokenTitle;
    detail = missingTokenDetail;
  } else if (status === "loading") {
    title = loadingTitle;
    detail = loadingDetail;
  } else if (status === "error") {
    title = errorTitle;
    detail = errorDetail;
  }

  return (
    <div className="flex h-full min-h-[12rem] w-full items-center justify-center bg-[radial-gradient(circle_at_top,#fbfbf8_0%,#f2f1eb_48%,#ebe8dd_100%)] text-center">
      <div className="max-w-[280px] px-6">
        <MapPin className="mx-auto size-5 text-[#62625d]" />
        <p className="mt-3 text-[13px] font-medium text-[#1d1d1b]">{title}</p>
        <p className="mt-1 text-[12px] leading-5 text-[#6b6b67]">{detail}</p>
      </div>
    </div>
  );
}
