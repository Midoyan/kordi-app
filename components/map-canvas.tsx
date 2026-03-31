"use client";

import type mapboxgl from "mapbox-gl";
import { type ReactNode, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

type MapCanvasProps = {
  accessToken?: string;
  className?: string;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  styleUrl?: string;
  hideStyleAnnotations?: boolean;
  missingTokenTitle?: string;
  missingTokenDetail?: ReactNode;
};

export function MapCanvas({
  accessToken = "",
  className,
  center = [13.413215, 52.521918],
  zoom = 12.8,
  bearing = 0,
  pitch = 0,
  styleUrl = "mapbox://styles/mapbox/light-v11",
  hideStyleAnnotations = true,
  missingTokenTitle = "Map unavailable without a Mapbox token",
  missingTokenDetail = "Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the interactive map canvas.",
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const hasMapboxToken = Boolean(accessToken.trim());

  useEffect(() => {
    if (!hasMapboxToken || !containerRef.current) {
      return;
    }

    let cancelled = false;

    async function setupMap() {
      const mapboxgl = (await import("mapbox-gl")).default;

      if (cancelled || !containerRef.current) {
        return;
      }

      mapboxgl.accessToken = accessToken;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: styleUrl,
        center,
        zoom,
        pitch,
        bearing,
        attributionControl: false,
      });

      mapRef.current = map;

      map.addControl(
        new mapboxgl.NavigationControl({
          showCompass: true,
          showZoom: true,
          visualizePitch: true,
        }),
        "top-right",
      );
      map.addControl(new mapboxgl.FullscreenControl(), "top-right");
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true,
          },
          trackUserLocation: true,
          showUserHeading: true,
        }),
        "top-right",
      );
      map.addControl(
        new mapboxgl.ScaleControl({
          maxWidth: 120,
          unit: "metric",
        }),
        "bottom-left",
      );
      map.addControl(
        new mapboxgl.AttributionControl({
          compact: true,
        }),
        "bottom-right",
      );

      if (hideStyleAnnotations) {
        const hideAnnotations = () => {
          const layers = map.getStyle().layers ?? [];

          for (const layer of layers) {
            if (layer.type === "symbol") {
              map.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
        };

        map.on("load", hideAnnotations);
        map.on("styledata", hideAnnotations);
      }
    }

    setupMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [accessToken, bearing, center, hasMapboxToken, hideStyleAnnotations, pitch, styleUrl, zoom]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-[#efede4]", className)}>
      {hasMapboxToken ? (
        <div ref={containerRef} className="h-full w-full" />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#fbfbf8_0%,#f2f1eb_48%,#ebe8dd_100%)] text-center">
          <div className="max-w-[280px] px-6">
            <p className="text-[13px] font-medium text-[#1d1d1b]">{missingTokenTitle}</p>
            <p className="mt-1 text-[12px] leading-5 text-[#6b6b67]">{missingTokenDetail}</p>
          </div>
        </div>
      )}
    </div>
  );
}
