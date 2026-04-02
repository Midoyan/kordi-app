"use client";

import { GeocodingCore } from "@mapbox/search-js-core";
import { startTransition, useEffect, useMemo, useState } from "react";

import {
  MapCanvas,
  type MapCanvasLine,
  type MapCanvasMarker,
} from "@/components/map-canvas";
import { fetchPeople, type PersonRecord } from "@/lib/people";
import { fetchLocations, type LocationRecord } from "@/lib/locations";

const mapboxToken = (process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "").trim();
const liveMapCenter: [number, number] = [13.325, 52.49];
const driveRoutePalette = ["#2563eb", "#f97316", "#0f766e", "#7c3aed", "#dc2626", "#ca8a04"];

type TransportPlanResponse = {
  drives?: DriveRecord[];
};

type DriveRecord = {
  id: string;
  label: string;
  travelType: string;
  startLocation: string;
  destinationAddress: string;
  stops: Array<{
    id: string;
    stopTitle: string;
    pickupAddress: string;
  }>;
};

type GeocodedPersonMarker = {
  id: string;
  name: string;
  address: string;
  phone: string;
  coordinates: [number, number];
};

type GeocodedLocationMarker = {
  id: string;
  name: string;
  type: string;
  address: string;
  notes: string;
  coordinates: [number, number];
};

type GeocodedDriveStopMarker = {
  id: string;
  driveId: string;
  driveLabel: string;
  stopTitle: string;
  address: string;
  order: number;
  color: string;
  coordinates: [number, number];
};

type LiveMapState = {
  peopleMarkers: GeocodedPersonMarker[];
  locationMarkers: GeocodedLocationMarker[];
  driveStopMarkers: GeocodedDriveStopMarker[];
  routeLines: MapCanvasLine[];
};

export function LiveMapPage() {
  const [liveMapState, setLiveMapState] = useState<LiveMapState>({
    peopleMarkers: [],
    locationMarkers: [],
    driveStopMarkers: [],
    routeLines: [],
  });
  const geocoder = useMemo(
    () =>
      mapboxToken
        ? new GeocodingCore({
            accessToken: mapboxToken,
            language: "en",
            country: "DE",
          })
        : null,
    [],
  );

  useEffect(() => {
    if (!mapboxToken || !geocoder) {
      return;
    }

    const controller = new AbortController();
    const activeGeocoder = geocoder;
    const geocodeCache = new Map<string, Promise<[number, number] | null>>();

    const getCoordinatesForAddress = (address: string) => {
      const normalizedAddress = address.trim();

      if (!normalizedAddress) {
        return Promise.resolve(null);
      }

      const cachedCoordinates = geocodeCache.get(normalizedAddress);

      if (cachedCoordinates) {
        return cachedCoordinates;
      }

      const request = activeGeocoder
        .forward(normalizedAddress, {
          autocomplete: false,
          limit: 1,
          signal: controller.signal,
        })
        .then((response) => {
          const feature = response.features[0];
          return feature ? (feature.geometry.coordinates as [number, number]) : null;
        })
        .catch(() => null);

      geocodeCache.set(normalizedAddress, request);
      return request;
    };

    async function loadLiveMapState() {
      const [people, locations, transportPlan] = await Promise.all([
        fetchPeople(controller.signal),
        fetchLocations({ signal: controller.signal }),
        fetchTransportPlan(controller.signal),
      ]);

      const [peopleMarkers, locationMarkers, driveStopMarkers, routeLines] = await Promise.all([
        buildPeopleMarkers(people, getCoordinatesForAddress),
        buildLocationMarkers(locations, getCoordinatesForAddress),
        buildDriveStopMarkers(transportPlan.drives ?? [], getCoordinatesForAddress),
        buildDriveRouteLines(transportPlan.drives ?? [], getCoordinatesForAddress, controller.signal),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      startTransition(() => {
        setLiveMapState({
          peopleMarkers,
          locationMarkers,
          driveStopMarkers,
          routeLines,
        });
      });
    }

    void loadLiveMapState().catch(() => {
      if (controller.signal.aborted) {
        return;
      }

      startTransition(() => {
        setLiveMapState({
          peopleMarkers: [],
          locationMarkers: [],
          driveStopMarkers: [],
          routeLines: [],
        });
      });
    });

    return () => {
      controller.abort();
    };
  }, [geocoder]);

  const mapMarkers = useMemo<MapCanvasMarker[]>(
    () => [
      ...liveMapState.peopleMarkers.map((marker) => ({
        id: `person-${marker.id}`,
        coordinates: marker.coordinates,
        createElement: () => createPersonMarkerElement(marker.name),
        createPopupElement: () => createPersonPopupElement(marker),
        hoverOpenDelayMs: 500,
        anchor: "bottom" as const,
        minVisibleZoom: 10.8,
        fullSizeZoom: 13.4,
        minScale: 0.22,
        minOpacity: 0.12,
      })),
      ...liveMapState.locationMarkers.map((marker) => ({
        id: `location-${marker.id}`,
        coordinates: marker.coordinates,
        createElement: () => createLocationMarkerElement(marker.name),
        createPopupElement: () => createLocationPopupElement(marker),
        anchor: "bottom" as const,
        minVisibleZoom: 10.2,
        fullSizeZoom: 12.6,
        minScale: 0.32,
        minOpacity: 0.2,
      })),
      ...liveMapState.driveStopMarkers.map((marker) => ({
        id: `drive-stop-${marker.id}`,
        coordinates: marker.coordinates,
        createElement: () => createDriveStopMarkerElement(marker),
        createPopupElement: () => createDriveStopPopupElement(marker),
        anchor: "center" as const,
        minVisibleZoom: 10.9,
        fullSizeZoom: 13.3,
        minScale: 0.28,
        minOpacity: 0.16,
      })),
    ],
    [liveMapState.driveStopMarkers, liveMapState.locationMarkers, liveMapState.peopleMarkers],
  );

  return (
    <div className="flex h-full min-h-[calc(100svh-3.5rem)] w-full flex-1">
      <MapCanvas
        accessToken={mapboxToken}
        className="h-full w-full flex-1"
        bearing={-14}
        center={liveMapCenter}
        pitch={42}
        lines={liveMapState.routeLines}
        markers={mapMarkers}
        styleUrl="mapbox://styles/mapbox/light-v11"
        zoom={10.55}
        missingTokenTitle="Live map unavailable without a Mapbox token"
        missingTokenDetail="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the interactive map."
      />
    </div>
  );
}

async function fetchTransportPlan(signal: AbortSignal) {
  const response = await fetch("/api/transport-plan", {
    cache: "no-store",
    method: "GET",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as TransportPlanResponse | null;

  if (!response.ok) {
    throw new Error("Unable to load drives.");
  }

  return payload ?? {};
}

async function buildPeopleMarkers(
  people: PersonRecord[],
  getCoordinatesForAddress: (address: string) => Promise<[number, number] | null>,
): Promise<GeocodedPersonMarker[]> {
  const peopleWithAddresses = people.filter((person) => person.address.trim());
  const geocodedMarkers = await Promise.all(
    peopleWithAddresses.map(async (person) => ({
      person,
      coordinates: await getCoordinatesForAddress(person.address),
    })),
  );

  const markers: GeocodedPersonMarker[] = [];

  for (const entry of geocodedMarkers) {
    if (!entry.coordinates) {
      continue;
    }

    markers.push({
      id: entry.person.id,
      name: entry.person.name,
      address: entry.person.address,
      phone: entry.person.phone,
      coordinates: entry.coordinates,
    });
  }

  return markers;
}

async function buildLocationMarkers(
  locations: LocationRecord[],
  getCoordinatesForAddress: (address: string) => Promise<[number, number] | null>,
): Promise<GeocodedLocationMarker[]> {
  const locationsWithAddresses = locations.filter((location) => location.address.trim());
  const geocodedMarkers = await Promise.all(
    locationsWithAddresses.map(async (location) => ({
      location,
      coordinates: await getCoordinatesForAddress(location.address),
    })),
  );

  const markers: GeocodedLocationMarker[] = [];

  for (const entry of geocodedMarkers) {
    if (!entry.coordinates) {
      continue;
    }

    markers.push({
      id: entry.location.id,
      name: entry.location.name,
      type: entry.location.type,
      address: entry.location.address,
      notes: entry.location.notes,
      coordinates: entry.coordinates,
    });
  }

  return markers;
}

async function buildDriveRouteLines(
  drives: DriveRecord[],
  getCoordinatesForAddress: (address: string) => Promise<[number, number] | null>,
  signal: AbortSignal,
): Promise<MapCanvasLine[]> {
  const routeLineEntries = await Promise.all(
    drives.map(async (drive, index) => {
      const routeStops = getDriveRouteAddresses(drive);

      if (routeStops.length < 2) {
        return null;
      }

      const waypoints = await Promise.all(routeStops.map((address) => getCoordinatesForAddress(address)));
      const validWaypoints = waypoints.filter((waypoint): waypoint is [number, number] => waypoint !== null);

      if (validWaypoints.length < 2) {
        return null;
      }

      const routedCoordinates = await getStreetRouteCoordinates(validWaypoints, signal);

      if (routedCoordinates.length < 2) {
        return null;
      }

      return {
        id: drive.id,
        coordinates: routedCoordinates,
        color: driveRoutePalette[index % driveRoutePalette.length],
        width: 4,
        opacity: 0.58,
      } satisfies MapCanvasLine;
    }),
  );

  const routeLines: MapCanvasLine[] = [];

  for (const routeLine of routeLineEntries) {
    if (!routeLine) {
      continue;
    }

    routeLines.push(routeLine);
  }

  return routeLines;
}

async function buildDriveStopMarkers(
  drives: DriveRecord[],
  getCoordinatesForAddress: (address: string) => Promise<[number, number] | null>,
): Promise<GeocodedDriveStopMarker[]> {
  const markerEntries = await Promise.all(
    drives.flatMap((drive, driveIndex) =>
      drive.stops.map(async (stop, stopIndex) => ({
        drive,
        color: driveRoutePalette[driveIndex % driveRoutePalette.length],
        stop,
        order: stopIndex + 1,
        coordinates: await getCoordinatesForAddress(stop.pickupAddress),
      })),
    ),
  );

  const markers: GeocodedDriveStopMarker[] = [];

  for (const entry of markerEntries) {
    if (!entry.coordinates) {
      continue;
    }

    markers.push({
      id: entry.stop.id,
      driveId: entry.drive.id,
      driveLabel: entry.drive.label,
      stopTitle: entry.stop.stopTitle,
      address: entry.stop.pickupAddress,
      order: entry.order,
      color: entry.color,
      coordinates: entry.coordinates,
    });
  }

  return markers;
}

function getDriveRouteAddresses(drive: DriveRecord) {
  const stopAddresses = drive.stops
    .map((stop) => stop.pickupAddress.trim())
    .filter(Boolean);

  if (drive.travelType === "dropoff") {
    return [drive.startLocation.trim(), ...stopAddresses].filter(Boolean);
  }

  return [...stopAddresses, drive.destinationAddress.trim()].filter(Boolean);
}

async function getStreetRouteCoordinates(
  coordinates: [number, number][],
  signal: AbortSignal,
) {
  const segments: [number, number][][] = [];

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const origin = coordinates[index];
    const destination = coordinates[index + 1];
    const segment = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
    const response = await fetch(
      `https://api.mapbox.com/directions/v5/mapbox/driving/${segment}?alternatives=false&geometries=geojson&overview=full&access_token=${encodeURIComponent(mapboxToken)}`,
      { cache: "no-store", signal },
    );

    if (!response.ok) {
      return coordinates;
    }

    const payload = (await response.json().catch(() => null)) as {
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    } | null;
    const segmentCoordinates = payload?.routes?.[0]?.geometry?.coordinates;

    if (!segmentCoordinates || segmentCoordinates.length < 2) {
      return coordinates;
    }

    segments.push(segmentCoordinates);
  }

  return segments.flatMap((segment, index) =>
    index === 0 ? segment : segment.slice(1),
  );
}

function createPersonMarkerElement(name: string) {
  const marker = document.createElement("div");
  marker.className = "map-cast-marker map-cast-marker--blue";

  const visual = document.createElement("div");
  visual.setAttribute("data-map-marker-visual", "");

  const bubble = document.createElement("div");
  bubble.className = "map-cast-marker__bubble";

  const label = document.createElement("span");
  label.className = "map-cast-marker__label";
  label.textContent = getNameInitials(name);

  bubble.append(label);
  visual.append(bubble);
  marker.append(visual);
  return marker;
}

function createLocationMarkerElement(name: string) {
  const marker = document.createElement("div");
  marker.className = "map-cast-marker map-cast-marker--location";

  const visual = document.createElement("div");
  visual.setAttribute("data-map-marker-visual", "");

  const bubble = document.createElement("div");
  bubble.className = "map-cast-location-marker";

  const label = document.createElement("span");
  label.className = "map-cast-location-marker__label";
  label.textContent = getNameInitials(name);

  bubble.append(label);
  visual.append(bubble);
  marker.append(visual);
  return marker;
}

function createDriveStopMarkerElement(stop: GeocodedDriveStopMarker) {
  const marker = document.createElement("div");
  marker.className = "map-cast-marker";

  const visual = document.createElement("div");
  visual.setAttribute("data-map-marker-visual", "");

  const bubble = document.createElement("div");
  bubble.className = "map-cast-stop-marker";
  bubble.style.setProperty("--map-stop-marker-color", stop.color);

  const label = document.createElement("span");
  label.className = "map-cast-stop-marker__label";
  label.textContent = String(stop.order);

  bubble.append(label);
  visual.append(bubble);
  marker.append(visual);
  return marker;
}

function createPersonPopupElement(person: GeocodedPersonMarker) {
  const popup = document.createElement("div");
  popup.className = "map-cast-popup";

  const title = document.createElement("p");
  title.className = "map-cast-popup__title";
  title.textContent = person.name;

  const initials = document.createElement("span");
  initials.className = "map-cast-popup__badge";
  initials.textContent = getNameInitials(person.name);

  const header = document.createElement("div");
  header.className = "map-cast-popup__header";
  header.append(initials, title);

  const address = document.createElement("p");
  address.className = "map-cast-popup__detail";
  address.textContent = person.address;

  popup.append(header, address);

  if (person.phone.trim()) {
    const phone = document.createElement("p");
    phone.className = "map-cast-popup__detail map-cast-popup__detail--muted";
    phone.textContent = person.phone;
    popup.append(phone);
  }

  return popup;
}

function createLocationPopupElement(location: GeocodedLocationMarker) {
  const popup = document.createElement("div");
  popup.className = "map-cast-popup";

  const title = document.createElement("p");
  title.className = "map-cast-popup__title";
  title.textContent = location.name;

  const badge = document.createElement("span");
  badge.className = "map-cast-popup__badge map-cast-popup__badge--location";
  badge.textContent = location.type.slice(0, 2).toUpperCase();

  const header = document.createElement("div");
  header.className = "map-cast-popup__header";
  header.append(badge, title);

  const address = document.createElement("p");
  address.className = "map-cast-popup__detail";
  address.textContent = location.address;

  popup.append(header, address);

  if (location.notes.trim()) {
    const notes = document.createElement("p");
    notes.className = "map-cast-popup__detail map-cast-popup__detail--muted";
    notes.textContent = location.notes;
    popup.append(notes);
  }

  return popup;
}

function createDriveStopPopupElement(stop: GeocodedDriveStopMarker) {
  const popup = document.createElement("div");
  popup.className = "map-cast-popup";

  const title = document.createElement("p");
  title.className = "map-cast-popup__title";
  title.textContent = stop.stopTitle;

  const badge = document.createElement("span");
  badge.className = "map-cast-popup__badge map-cast-popup__badge--stop";
  badge.textContent = String(stop.order);
  badge.style.setProperty("--map-stop-badge-color", stop.color);

  const header = document.createElement("div");
  header.className = "map-cast-popup__header";
  header.append(badge, title);

  const driveLabel = document.createElement("p");
  driveLabel.className = "map-cast-popup__detail map-cast-popup__detail--muted";
  driveLabel.textContent = stop.driveLabel;

  const address = document.createElement("p");
  address.className = "map-cast-popup__detail";
  address.textContent = stop.address;

  popup.append(header, driveLabel, address);
  return popup;
}

function getNameInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "?";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}
