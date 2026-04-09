"use client";

import { GeocodingCore } from "@mapbox/search-js-core";
import { ChevronDown, Route, Users } from "lucide-react";
import {
  startTransition,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import {
  MapCanvas,
  type MapCanvasLine,
  type MapCanvasMarker,
} from "@/components/map-canvas";
import { fetchLocations, type LocationRecord } from "@/lib/locations";
import { fetchPeople, type PersonRecord } from "@/lib/people";
import { cn } from "@/lib/utils";

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
  scheduledTimeLabel: string;
  destinationAddress: string;
  van: {
    label: string | null;
    plate_number: string | null;
    vehicle_type: string | null;
  } | null;
  location: {
    name: string;
    address: string;
  } | null;
  stops: Array<{
    id: string;
    stopTitle: string;
    pickupAddress: string;
    pickupTimeLabel: string;
    stopPickupPassengers: Array<{
      id: string;
      name: string;
      address: string;
    }>;
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
  drives: DriveRecord[];
  peopleMarkers: GeocodedPersonMarker[];
  locationMarkers: GeocodedLocationMarker[];
  driveStopMarkers: GeocodedDriveStopMarker[];
  routeLines: MapCanvasLine[];
};

type LegendView = "drives" | "people";

export function LiveMapPage() {
  const [liveMapState, setLiveMapState] = useState<LiveMapState>({
    drives: [],
    peopleMarkers: [],
    locationMarkers: [],
    driveStopMarkers: [],
    routeLines: [],
  });
  const [expandedDriveIdsState, setExpandedDriveIdsState] = useState<string[]>([]);
  const [legendView, setLegendView] = useState<LegendView | null>(null);
  const [highlightedDriveId, setHighlightedDriveId] = useState<string | null>(null);
  const [highlightedStopId, setHighlightedStopId] = useState<string | null>(null);
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(null);
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
    // Deduplicate geocoding across people, locations, and route stops during one map load.
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
      // Load every dataset together so the live map can render one coherent pass.
      const [people, locations, transportPlan] = await Promise.all([
        fetchPeople(controller.signal),
        fetchLocations({ signal: controller.signal }),
        fetchTransportPlan(controller.signal),
      ]);
      const drives = transportPlan.drives ?? [];

      const [peopleMarkers, locationMarkers, driveStopMarkers, routeLines] = await Promise.all([
        buildPeopleMarkers(people, getCoordinatesForAddress),
        buildLocationMarkers(locations, getCoordinatesForAddress),
        buildDriveStopMarkers(drives, getCoordinatesForAddress),
        buildDriveRouteLines(drives, getCoordinatesForAddress, controller.signal),
      ]);

      if (controller.signal.aborted) {
        return;
      }

      startTransition(() => {
        setLiveMapState({
          drives,
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
          drives: [],
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

  const expandedDriveIds = useMemo(() => {
    if (liveMapState.drives.length === 0) {
      return [];
    }

    const driveIds = new Set(liveMapState.drives.map((drive) => drive.id));
    const validIds = expandedDriveIdsState.filter((id) => driveIds.has(id));

    return validIds.length > 0 ? validIds : [liveMapState.drives[0].id];
  }, [expandedDriveIdsState, liveMapState.drives]);

  const activeDriveId = legendView === "drives" ? highlightedDriveId : null;
  const hasDriveHighlight = Boolean(activeDriveId);
  const activePersonId = legendView === "people" ? highlightedPersonId : null;
  const hasPersonHighlight = Boolean(activePersonId);

  const mapMarkers = useMemo<MapCanvasMarker[]>(
    () => [
      ...liveMapState.peopleMarkers.map((marker) => ({
        id: `person-${marker.id}`,
        coordinates: marker.coordinates,
        createElement: () =>
          createPersonMarkerElement(marker.name, {
            dimmed: hasPersonHighlight && marker.id !== activePersonId,
            emphasized: marker.id === activePersonId,
            selected: marker.id === activePersonId,
          }),
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
        createElement: () =>
          createDriveStopMarkerElement(marker, {
            dimmed: hasDriveHighlight && marker.driveId !== activeDriveId,
            emphasized: marker.driveId === activeDriveId,
            selected: marker.id === highlightedStopId,
          }),
        createPopupElement: () => createDriveStopPopupElement(marker),
        anchor: "center" as const,
        minVisibleZoom: 10.9,
        fullSizeZoom: 13.3,
        minScale: 0.28,
        minOpacity: 0.16,
      })),
    ],
    [
      activeDriveId,
      activePersonId,
      hasDriveHighlight,
      hasPersonHighlight,
      highlightedStopId,
      liveMapState.driveStopMarkers,
      liveMapState.locationMarkers,
      liveMapState.peopleMarkers,
    ],
  );

  const mapLines = useMemo(
    () =>
      liveMapState.routeLines.map((line) => ({
        ...line,
        opacity: !hasDriveHighlight
          ? line.opacity
          : line.id === activeDriveId
            ? 0.96
            : 0.14,
        width: !hasDriveHighlight
          ? line.width
          : line.id === activeDriveId
            ? 6
            : 3,
      })),
    [activeDriveId, hasDriveHighlight, liveMapState.routeLines],
  );

  const toggleDriveExpansion = (driveId: string) => {
    setExpandedDriveIdsState((current) => {
      const driveIds = new Set(liveMapState.drives.map((drive) => drive.id));
      const validIds = current.filter((id) => driveIds.has(id));
      const nextExpandedIds =
        validIds.length > 0 ? validIds : liveMapState.drives[0] ? [liveMapState.drives[0].id] : [];

      return nextExpandedIds.includes(driveId)
        ? nextExpandedIds.filter((id) => id !== driveId)
        : [...nextExpandedIds, driveId];
    });
  };

  return (
    <div className="relative flex h-full min-h-[calc(100svh-3.5rem)] w-full flex-1">
      <MapCanvas
        accessToken={mapboxToken}
        className="h-full w-full flex-1"
        bearing={-14}
        center={liveMapCenter}
        pitch={42}
        lines={mapLines}
        markers={mapMarkers}
        styleUrl="mapbox://styles/mapbox/light-v11"
        zoom={10.55}
        missingTokenTitle="Live map unavailable without a Mapbox token"
        missingTokenDetail="Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to render the interactive map."
      />
      <LiveMapSchedulePanel
        drives={liveMapState.drives}
        people={liveMapState.peopleMarkers}
        expandedDriveIds={expandedDriveIds}
        legendView={legendView}
        highlightedDriveId={highlightedDriveId}
        highlightedPersonId={highlightedPersonId}
        highlightedStopId={highlightedStopId}
        onDriveHover={(driveId) => {
          setHighlightedPersonId(null);
          setHighlightedDriveId(driveId);
          setHighlightedStopId(null);
        }}
        onPanelLeave={() => {
          setHighlightedPersonId(null);
          setHighlightedDriveId(null);
          setHighlightedStopId(null);
        }}
        onPersonHover={(personId) => {
          setHighlightedPersonId(personId);
          setHighlightedDriveId(null);
          setHighlightedStopId(null);
        }}
        onLegendViewChange={(nextView) => {
          setLegendView((current) => (current === nextView ? null : nextView));
          setHighlightedPersonId(null);
          setHighlightedDriveId(null);
          setHighlightedStopId(null);
        }}
        onStopHover={(stopId, driveId) => {
          setHighlightedPersonId(null);
          setHighlightedStopId(stopId);
          setHighlightedDriveId(driveId);
        }}
        onToggleDrive={toggleDriveExpansion}
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

  // Dropoffs run from the shared origin through each stop; pickups end at the shared destination.
  if (drive.travelType === "dropoff") {
    return [drive.startLocation.trim(), ...stopAddresses].filter(Boolean);
  }

  return [...stopAddresses, drive.destinationAddress.trim()].filter(Boolean);
}

async function getStreetRouteCoordinates(
  coordinates: [number, number][],
  signal: AbortSignal,
) {
  // Request each leg separately so long stop chains still render even if we can't batch the full drive.
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
      // Fall back to straight joins if directions fail instead of dropping the drive entirely.
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

function createPersonMarkerElement(
  name: string,
  options?: {
    dimmed?: boolean;
    emphasized?: boolean;
    selected?: boolean;
  },
) {
  const marker = document.createElement("div");
  marker.className = cn(
    "map-cast-marker map-cast-marker--blue",
    options?.dimmed && "map-cast-marker--dimmed",
    options?.emphasized && "map-cast-marker--emphasized",
  );

  const visual = document.createElement("div");
  visual.setAttribute("data-map-marker-visual", "");

  const bubble = document.createElement("div");
  bubble.className = cn(
    "map-cast-marker__bubble",
    options?.selected && "map-cast-marker__bubble--selected",
  );

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

function createDriveStopMarkerElement(
  stop: GeocodedDriveStopMarker,
  options?: {
    dimmed?: boolean;
    emphasized?: boolean;
    selected?: boolean;
  },
) {
  const marker = document.createElement("div");
  marker.className = "map-cast-marker";

  const visual = document.createElement("div");
  visual.setAttribute("data-map-marker-visual", "");

  const bubble = document.createElement("div");
  bubble.className = cn(
    "map-cast-stop-marker",
    options?.dimmed && "map-cast-stop-marker--dimmed",
    options?.emphasized && "map-cast-stop-marker--emphasized",
    options?.selected && "map-cast-stop-marker--selected",
  );
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

function LiveMapSchedulePanel({
  drives,
  people,
  expandedDriveIds,
  legendView,
  highlightedDriveId,
  highlightedPersonId,
  highlightedStopId,
  onDriveHover,
  onLegendViewChange,
  onPanelLeave,
  onPersonHover,
  onStopHover,
  onToggleDrive,
}: {
  drives: DriveRecord[];
  people: GeocodedPersonMarker[];
  expandedDriveIds: string[];
  legendView: LegendView | null;
  highlightedDriveId: string | null;
  highlightedPersonId: string | null;
  highlightedStopId: string | null;
  onDriveHover: (driveId: string | null) => void;
  onLegendViewChange: (view: LegendView) => void;
  onPanelLeave: () => void;
  onPersonHover: (personId: string | null) => void;
  onStopHover: (stopId: string, driveId: string) => void;
  onToggleDrive: (driveId: string) => void;
}) {
  const driveCount = drives.length;
  const stopCount = drives.reduce((count, drive) => count + drive.stops.length, 0);
  const mappedPeople = useMemo(
    () => [...people].sort((left, right) => left.name.localeCompare(right.name)),
    [people],
  );
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = Math.max(8, Math.min(event.clientX - dragOffsetRef.current.x, window.innerWidth - 280));
      const nextY = Math.max(8, Math.min(event.clientY - dragOffsetRef.current.y, window.innerHeight - 120));

      setPosition({
        x: nextX,
        y: nextY,
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setIsDragging(true);
  };

  const legendContent =
    legendView === "drives" ? (
      drives.length === 0 ? (
        <div className="px-4 py-7 text-center">
          <p className="text-[13px] font-medium text-[#1d1d1b]">No drives on the map yet.</p>
          <p className="mt-1 text-[11px] text-[#6b6b67]">
            Add a drive in schedule and it will appear here with its route and stops.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {drives.map((drive, driveIndex) => {
            const isExpanded = expandedDriveIds.includes(drive.id);
            const isHighlighted = highlightedDriveId === drive.id;
            const routeColor = driveRoutePalette[driveIndex % driveRoutePalette.length];
            const driveSummary = getLiveMapDriveSummary(drive);

            return (
              <article
                key={drive.id}
                className={cn(
                  "overflow-hidden rounded-[16px] bg-white/66 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55),0_1px_0_rgba(255,255,255,0.7)_inset] ring-1 ring-[#eadfca]/70 transition-[background-color,box-shadow,transform] duration-200",
                  isHighlighted
                    ? "bg-[rgba(255,246,228,0.95)] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.5),0_1px_0_rgba(255,255,255,0.8)_inset] ring-[#efcf93]"
                    : "hover:bg-[rgba(255,251,243,0.94)]",
                )}
                onMouseEnter={() => {
                  onDriveHover(drive.id);
                }}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                  onClick={() => onToggleDrive(drive.id)}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className="flex min-h-11 w-1.5 shrink-0 rounded-full"
                      style={{
                        background: `linear-gradient(180deg, ${routeColor} 0%, color-mix(in srgb, ${routeColor} 58%, white) 100%)`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[#1d1d1b]">
                            {driveSummary.routeLabel}
                          </p>
                          <p className="mt-0.5 truncate text-[10px] text-[#736a5d]">
                            {driveSummary.routeDetail}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[15px] font-semibold leading-none text-[#1d1d1b] [font-variant-numeric:tabular-nums]">
                            {driveSummary.departureLabel}
                          </p>
                          <p className="mt-1 text-[9px] font-semibold tracking-[0.14em] text-[#8a7d68] uppercase">
                            Start
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-0.5 size-4 shrink-0 text-[#8a7d68] transition-transform",
                      isExpanded && "rotate-180",
                    )}
                  />
                </button>

                {isExpanded ? (
                  <div className="border-t border-[#eadfca]/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.5)_0%,rgba(250,246,238,0.78)_100%)] px-3 py-2.5">
                    <div className="space-y-1.5">
                      {drive.stops.map((stop, stopIndex) => {
                        const isStopHighlighted = highlightedStopId === stop.id;

                        return (
                          <button
                            key={stop.id}
                            type="button"
                            className={cn(
                              "flex w-full items-start gap-2.5 rounded-[12px] px-2 py-2 text-left transition-colors",
                              isStopHighlighted ? "bg-[rgba(255,244,222,0.96)]" : "hover:bg-white/72",
                            )}
                            onMouseEnter={() => {
                              onStopHover(stop.id, drive.id);
                            }}
                          >
                            <span
                              className="inline-flex size-[20px] shrink-0 items-center justify-center rounded-full border bg-white/92 text-[9px] font-semibold [font-variant-numeric:tabular-nums]"
                              style={{
                                borderColor: routeColor,
                                color: routeColor,
                              }}
                            >
                              {stopIndex + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-semibold text-[#232320]">
                                {stop.stopTitle}
                              </p>
                              <p className="mt-0.5 truncate text-[10px] text-[#736a5d]">
                                {getPrimaryAddressLine(stop.pickupAddress || "No address")}
                              </p>
                            </div>
                            <span className="shrink-0 pt-0.5 text-[10px] font-semibold text-[#5d5243] [font-variant-numeric:tabular-nums]">
                              {stop.pickupTimeLabel || "Not set"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )
    ) : legendView === "people" ? (
      mappedPeople.length === 0 ? (
        <div className="px-4 py-7 text-center">
          <p className="text-[13px] font-medium text-[#1d1d1b]">No people mapped yet.</p>
          <p className="mt-1 text-[11px] text-[#6b6b67]">
            Add addresses to the people roster and they will appear here on the map.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {mappedPeople.map((person) => {
            const isHighlighted = highlightedPersonId === person.id;
            const primaryAddress = getPrimaryAddressLine(person.address);
            const secondaryAddress = getSecondaryAddressLine(person.address);

            return (
              <button
                key={person.id}
                type="button"
                className={cn(
                  "flex w-full items-start gap-3 rounded-[16px] bg-white/66 px-3 py-3 text-left shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55),0_1px_0_rgba(255,255,255,0.7)_inset] ring-1 ring-[#eadfca]/70 transition-[background-color,box-shadow] duration-200",
                  isHighlighted
                    ? "bg-[rgba(239,247,255,0.95)] ring-[#b9d9ff] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.46),0_1px_0_rgba(255,255,255,0.82)_inset]"
                    : "hover:bg-[rgba(249,252,255,0.94)]",
                )}
                onMouseEnter={() => {
                  onPersonHover(person.id);
                }}
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(180deg,#68a8ff_0%,#4d8ff3_100%)] text-[10px] font-semibold tracking-[0.04em] text-white shadow-[0_10px_18px_-12px_rgba(37,99,235,0.72),0_0_0_3px_rgba(191,219,254,0.55)]">
                  {getNameInitials(person.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold tracking-[-0.01em] text-[#1d1d1b]">
                        {person.name}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-[#736a5d]">
                        {primaryAddress || "No address"}
                      </p>
                    </div>
                    <span className="rounded-full bg-[rgba(239,246,255,0.92)] px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-[#3567a8] uppercase">
                      Person
                    </span>
                  </div>
                  {secondaryAddress ? (
                    <p className="mt-2 truncate text-[10px] text-[#8a7d68]">
                      {secondaryAddress}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )
    ) : null;

  return (
    <div className="pointer-events-none absolute inset-0 p-3 sm:p-4">
      <div
        className="pointer-events-auto absolute w-[min(20rem,calc(100vw-1rem))] sm:w-[min(21.5rem,calc(100vw-2rem))]"
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        }}
      >
        <section
          className="overflow-hidden rounded-[18px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,253,248,0.82)_0%,rgba(248,243,232,0.84)_100%)] shadow-[0_24px_70px_-36px_rgba(15,23,42,0.52)] backdrop-blur-xl"
          onMouseLeave={onPanelLeave}
        >
          <div
            className={cn(
              "cursor-grab border-b border-[#eadfca]/70 bg-[linear-gradient(180deg,rgba(254,249,239,0.92)_0%,rgba(248,242,231,0.92)_100%)] px-3 py-2.5 active:cursor-grabbing",
              isDragging && "cursor-grabbing",
            )}
            onPointerDown={handleDragStart}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#5c4a2a]">
                  <p className="text-[11px] font-semibold tracking-[0.16em] uppercase">Map legend</p>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#7b6f58]">
                  {legendView === "drives"
                    ? `${driveCount} route${driveCount === 1 ? "" : "s"} and ${stopCount} stop${stopCount === 1 ? "" : "s"}`
                    : legendView === "people"
                      ? `${mappedPeople.length} people`
                      : "Pick Drives or People to open the legend"}
                </p>
              </div>
              <div className="rounded-full bg-[rgba(255,255,255,0.76)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] ring-1 ring-[#e7dbc4]">
                <div className="flex items-center gap-0.5">
                  {[
                    { id: "drives" as const, icon: Route, label: "Drives" },
                    { id: "people" as const, icon: Users, label: "People" },
                  ].map((option) => {
                    const Icon = option.icon;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={cn(
                          "inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10px] font-semibold tracking-[0.08em] uppercase transition-colors",
                          legendView === option.id
                            ? "bg-[#f3e7d1] text-[#5f4d2f] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_5px_12px_-10px_rgba(15,23,42,0.45)]"
                            : "text-[#8a7d68] hover:bg-white/70 hover:text-[#5f4d2f]",
                        )}
                        onClick={() => onLegendViewChange(option.id)}
                      >
                        <Icon className="size-3" />
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "overflow-hidden transition-[max-height,padding,opacity] duration-200",
              legendView
                ? "max-h-[min(22rem,calc(100svh-8rem))] overflow-auto px-2.5 py-2.5 opacity-100"
                : "max-h-0 px-2.5 py-0 opacity-0",
            )}
          >
            {legendContent}
          </div>
        </section>
      </div>
    </div>
  );
}

function getLiveMapDriveSummary(drive: DriveRecord) {
  const setLocationLabel = getPrimaryAddressLine(
    drive.location?.name || drive.location?.address || drive.destinationAddress || drive.startLocation,
  );
  const routeDetail =
    drive.stops.length === 0
      ? `No ${drive.travelType} stops yet`
      : `${drive.stops.length} ${drive.travelType} stop${drive.stops.length === 1 ? "" : "s"}${getDriveViaLabel(drive)}`;
  const routeLabel =
    setLocationLabel
      ? drive.travelType === "pickup"
        ? `Pickup to ${setLocationLabel}`
        : `Dropoff from ${setLocationLabel}`
      : drive.label;
  const departureLabel = drive.scheduledTimeLabel || drive.stops[0]?.pickupTimeLabel || "Not set";
  const departureDetail = drive.scheduledTimeLabel
    ? drive.travelType === "pickup"
      ? "Arrive by set call time"
      : setLocationLabel
        ? `Depart from ${setLocationLabel}`
        : "Wrap departure"
    : drive.stops[0]?.pickupTimeLabel
      ? `First ${drive.travelType} stop`
      : drive.travelType === "pickup"
        ? "Add arrival time"
        : "Add departure time";

  return {
    departureDetail,
    departureLabel,
    routeDetail,
    routeLabel,
  };
}

function getPrimaryAddressLine(value: string) {
  return value.split(",")[0]?.trim() || value.trim();
}

function getSecondaryAddressLine(value: string) {
  return value
    .split(",")
    .slice(1)
    .join(",")
    .trim();
}

function getDriveViaLabel(drive: DriveRecord) {
  const viaAddresses = Array.from(
    new Set(
      drive.stops
        .map((stop) => getPrimaryAddressLine(stop.pickupAddress))
        .filter(Boolean),
    ),
  ).slice(0, 2);

  return viaAddresses.length > 0 ? ` via ${viaAddresses.join(", ")}` : "";
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
