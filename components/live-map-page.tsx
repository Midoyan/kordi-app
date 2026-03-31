"use client";

import { MapCanvas } from "@/components/map-canvas";

const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
const liveMapCenter: [number, number] = [13.413215, 52.521918];

export function LiveMapPage() {
  return (
    <div className="flex h-full min-h-[calc(100svh-3.5rem)] w-full flex-1">
      <MapCanvas
        accessToken={mapboxToken}
        className="h-full w-full flex-1"
        center={liveMapCenter}
        zoom={12.8}
        missingTokenTitle="Live map unavailable without a Mapbox token"
        missingTokenDetail="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the interactive map."
      />
    </div>
  );
}
