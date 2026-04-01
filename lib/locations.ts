export const locationTypes = [
  "Pickup point",
  "Venue",
  "Hotel",
  "Airport",
  "Other",
] as const;

export type LocationType = (typeof locationTypes)[number];

export type LocationRecord = {
  id: string;
  name: string;
  type: LocationType;
  address: string;
  zone: string;
  notes: string;
  createdAt: string | null;
};

export type LocationDraft = Omit<LocationRecord, "id" | "createdAt">;

export type LocationPayload = {
  label: string;
  location_type: string;
  address: string;
  access_notes: string;
};

type LocationCachePayload = {
  locations: LocationRecord[];
  savedAt: number;
  version: 1;
};

type FetchLocationsOptions = {
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

const LOCATION_CACHE_STORAGE_KEY = "kordi.locations-cache.v1";
const LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
const LOCATION_CACHE_VERSION = 1;
const locationTypesSet = new Set<string>(locationTypes);

let locationsCache: LocationCachePayload | null = null;
let locationsRequest: Promise<LocationRecord[]> | null = null;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function createAbortError() {
  try {
    return new DOMException("Request aborted", "AbortError");
  } catch {
    const error = new Error("Request aborted");
    error.name = "AbortError";
    return error;
  }
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function waitForPromiseWithSignal<T>(promise: Promise<T>, signal?: AbortSignal) {
  if (!signal) {
    return promise;
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(createAbortError());
    };

    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function getResponseErrorMessage(payload: unknown, fallbackMessage: string) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: unknown }).error;

    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return fallbackMessage;
}

async function parseResponseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function sortLocations(records: LocationRecord[]) {
  return [...records].sort((first, second) => {
    const firstTimestamp = first.createdAt ? Date.parse(first.createdAt) : Number.NEGATIVE_INFINITY;
    const secondTimestamp = second.createdAt
      ? Date.parse(second.createdAt)
      : Number.NEGATIVE_INFINITY;

    if (Number.isFinite(firstTimestamp) || Number.isFinite(secondTimestamp)) {
      return secondTimestamp - firstTimestamp;
    }

    return first.name.localeCompare(second.name);
  });
}

function normalizeLocationType(value: unknown): LocationType {
  const type = readString(value);
  return locationTypesSet.has(type) ? (type as LocationType) : "Other";
}

export function normalizeLocationRecord(payload: unknown): LocationRecord {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;
  const id = record.id;
  const normalizedType = readString(record.type) || readString(record.location_type);

  return {
    id:
      typeof id === "string"
        ? id.trim()
        : typeof id === "number" && Number.isFinite(id)
          ? String(id)
          : "",
    name: readString(record.name) || readString(record.label) || "Untitled location",
    type: normalizeLocationType(normalizedType),
    address: readString(record.address),
    zone: readString(record.zone),
    notes: readString(record.notes) || readString(record.access_notes),
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : typeof record.created_at === "string"
          ? record.created_at
          : null,
  };
}

function normalizeLocationCachePayload(payload: unknown): LocationCachePayload | null {
  const source = payload && typeof payload === "object" ? payload : null;

  if (!source) {
    return null;
  }

  const record = source as Record<string, unknown>;

  if (
    record.version !== LOCATION_CACHE_VERSION ||
    !isFiniteNumber(record.savedAt) ||
    !Array.isArray(record.locations)
  ) {
    return null;
  }

  return {
    locations: sortLocations(record.locations.map((location) => normalizeLocationRecord(location))),
    savedAt: record.savedAt,
    version: LOCATION_CACHE_VERSION,
  };
}

function isLocationCacheFresh(cache: LocationCachePayload) {
  return Date.now() - cache.savedAt <= LOCATION_CACHE_TTL_MS;
}

function readLocationsCache() {
  if (locationsCache) {
    return locationsCache;
  }

  if (!canUseStorage()) {
    return null;
  }

  try {
    const serializedCache = window.localStorage.getItem(LOCATION_CACHE_STORAGE_KEY);

    if (!serializedCache) {
      return null;
    }

    const parsedCache = normalizeLocationCachePayload(JSON.parse(serializedCache));

    if (!parsedCache) {
      window.localStorage.removeItem(LOCATION_CACHE_STORAGE_KEY);
      return null;
    }

    locationsCache = parsedCache;
    return parsedCache;
  } catch {
    return null;
  }
}

function writeLocationsCache(cache: LocationCachePayload) {
  locationsCache = cache;

  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(LOCATION_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota and serialization failures.
  }
}

function storeLocationsCache(locations: LocationRecord[]) {
  const cache: LocationCachePayload = {
    locations: sortLocations(locations.map((location) => normalizeLocationRecord(location))),
    savedAt: Date.now(),
    version: LOCATION_CACHE_VERSION,
  };

  writeLocationsCache(cache);

  return cache.locations;
}

function updateLocationsCache(update: (currentLocations: LocationRecord[]) => LocationRecord[]) {
  const currentLocations = getCachedLocationsSnapshot({ includeExpired: true }) ?? [];
  return storeLocationsCache(update(currentLocations));
}

function hydrateLocationFromDraft(location: LocationRecord, draft: LocationDraft) {
  return {
    ...location,
    name: readString(draft.name) || location.name,
    type: draft.type,
    address: readString(draft.address),
    zone: readString(draft.zone),
    notes: readString(draft.notes),
  };
}

function normalizeLocationsResponse(payload: unknown) {
  if (!Array.isArray(payload)) {
    return storeLocationsCache([]);
  }

  return storeLocationsCache(payload.map((entry) => normalizeLocationRecord(entry)));
}

export function getCachedLocationsSnapshot(options?: { includeExpired?: boolean }) {
  const cache = readLocationsCache();

  if (!cache) {
    return null;
  }

  if (!options?.includeExpired && !isLocationCacheFresh(cache)) {
    return null;
  }

  return cache.locations;
}

export function normalizeLocationPayload(payload: unknown): LocationPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  const label = readString(record.name) || readString(record.label);
  const locationType = readString(record.type) || readString(record.location_type);

  return {
    label,
    location_type: normalizeLocationType(locationType),
    address: readString(record.address),
    access_notes: readString(record.notes) || readString(record.access_notes),
  };
}

export function validateLocationPayload(payload: LocationPayload) {
  if (!payload.label) {
    return "Location name is required.";
  }

  if (!payload.address) {
    return "Address is required.";
  }

  return null;
}

export async function fetchLocations(options: FetchLocationsOptions = {}) {
  const { forceRefresh = false, signal } = options;
  const cachedLocations = !forceRefresh ? getCachedLocationsSnapshot() : null;

  if (cachedLocations !== null) {
    return cachedLocations;
  }

  if (!forceRefresh && locationsRequest) {
    return waitForPromiseWithSignal(locationsRequest, signal);
  }

  const request = (async () => {
    const response = await fetch("/api/locations", {
      cache: "no-store",
      method: "GET",
    });
    const payload = await parseResponseJson(response);

    if (!response.ok) {
      throw new Error(getResponseErrorMessage(payload, "Unable to load locations."));
    }

    return normalizeLocationsResponse(payload);
  })();

  locationsRequest = request;
  void request.finally(() => {
    if (locationsRequest === request) {
      locationsRequest = null;
    }
  });

  try {
    return await waitForPromiseWithSignal(request, signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    throw error;
  }
}

export async function createLocation(draft: LocationDraft) {
  const response = await fetch("/api/locations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(draft),
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Unable to save location."));
  }

  const createdLocation = hydrateLocationFromDraft(normalizeLocationRecord(payload), draft);

  updateLocationsCache((currentLocations) =>
    sortLocations([
      createdLocation,
      ...currentLocations.filter((location) => location.id !== createdLocation.id),
    ]),
  );

  return createdLocation;
}

export async function updateLocation(id: string, draft: LocationDraft) {
  const response = await fetch(`/api/locations/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(draft),
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Unable to update location."));
  }

  const updatedLocation = hydrateLocationFromDraft(normalizeLocationRecord(payload), draft);

  updateLocationsCache((currentLocations) =>
    sortLocations(
      currentLocations.some((location) => location.id === id)
        ? currentLocations.map((location) => (location.id === id ? updatedLocation : location))
        : [updatedLocation, ...currentLocations],
    ),
  );

  return updatedLocation;
}

export async function deleteLocation(id: string) {
  const response = await fetch(`/api/locations/${id}`, {
    method: "DELETE",
  });

  if (response.ok) {
    updateLocationsCache((currentLocations) =>
      currentLocations.filter((location) => location.id !== id),
    );
    return;
  }

  const payload = await parseResponseJson(response);
  throw new Error(getResponseErrorMessage(payload, "Unable to delete location."));
}
