export const vehicleTypes = [
  "Van",
  "Car",
  "Shuttle",
  "SUV",
] as const;

export type VehicleType = (typeof vehicleTypes)[number];
export type VehicleTypeValue = "van" | "car" | "shuttle" | "suv";

export type VehicleRecord = {
  id: string;
  label: string;
  plateNumber: string;
  seatCapacity: number;
  vehicleType: VehicleType;
  notes: string;
  isActive: boolean;
  crewMemberId: string | null;
  driverName: string;
  createdAt: string | null;
};

export type VehicleDraft = {
  label: string;
  plateNumber: string;
  seatCapacity: number;
  vehicleType: VehicleType;
  notes: string;
  isActive: boolean;
  crewMemberId: string | null;
};

export type VehiclePayload = {
  label: string;
  plate_number: string;
  seat_capacity: number;
  vehicle_type: VehicleTypeValue;
  notes: string;
  is_active: boolean;
  crew_member_id: string | null;
};

type VehicleCachePayload = {
  vehicles: VehicleRecord[];
  savedAt: number;
  version: 2;
};

type FetchVehiclesOptions = {
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

const VEHICLE_CACHE_STORAGE_KEY = "kordi.vehicles-cache.v2";
const VEHICLE_CACHE_TTL_MS = 5 * 60 * 1000;
const VEHICLE_CACHE_VERSION = 2;
const vehicleTypeValueByType: Record<VehicleType, VehicleTypeValue> = {
  Van: "van",
  Car: "car",
  Shuttle: "shuttle",
  SUV: "suv",
};
const vehicleTypeByAlias = new Map<string, VehicleType>([
  ["van", "Van"],
  ["Van", "Van"],
  ["car", "Car"],
  ["Car", "Car"],
  ["shuttle", "Shuttle"],
  ["Shuttle", "Shuttle"],
  ["suv", "SUV"],
  ["SUV", "SUV"],
]);

let vehiclesCache: VehicleCachePayload | null = null;
let vehiclesRequest: Promise<VehicleRecord[]> | null = null;

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
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

function parseSeatCapacity(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }

  return 0;
}

function normalizeVehicleType(value: unknown): VehicleType {
  const type = readString(value);
  return vehicleTypeByAlias.get(type) ?? "Van";
}

function mapVehicleTypeToValue(type: VehicleType) {
  return vehicleTypeValueByType[type];
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

export function sortVehicles(records: VehicleRecord[]) {
  return [...records].sort((first, second) => {
    const firstTimestamp = first.createdAt ? Date.parse(first.createdAt) : Number.NEGATIVE_INFINITY;
    const secondTimestamp = second.createdAt
      ? Date.parse(second.createdAt)
      : Number.NEGATIVE_INFINITY;

    if (Number.isFinite(firstTimestamp) || Number.isFinite(secondTimestamp)) {
      return secondTimestamp - firstTimestamp;
    }

    return first.label.localeCompare(second.label);
  });
}

export function normalizeVehicleRecord(payload: unknown): VehicleRecord {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;
  const rawCrewMember = Array.isArray(record.crew_members)
    ? record.crew_members[0]
    : record.crew_members;
  const crewMemberRecord =
    rawCrewMember && typeof rawCrewMember === "object"
      ? (rawCrewMember as Record<string, unknown>)
      : null;

  return {
    id: readString(record.id),
    label: readString(record.label) || "Untitled van",
    plateNumber: readString(record.plateNumber) || readString(record.plate_number),
    seatCapacity: parseSeatCapacity(record.seatCapacity ?? record.seat_capacity),
    vehicleType: normalizeVehicleType(record.vehicleType ?? record.vehicle_type),
    notes: readString(record.notes),
    isActive: typeof record.isActive === "boolean" ? record.isActive : record.is_active !== false,
    crewMemberId: readString(record.crewMemberId ?? record.crew_member_id) || null,
    driverName:
      readString(crewMemberRecord?.full_name) ||
      readString(record.driverName) ||
      readString(record.driver_name),
    createdAt:
      typeof record.createdAt === "string"
        ? record.createdAt
        : typeof record.created_at === "string"
          ? record.created_at
          : null,
  };
}

export function createLocalVehicleRecord(
  id: string,
  draft: VehicleDraft,
  options?: { driverName?: string },
) {
  return {
    id,
    label: readString(draft.label) || "Untitled van",
    plateNumber: readString(draft.plateNumber),
    seatCapacity: parseSeatCapacity(draft.seatCapacity),
    vehicleType: normalizeVehicleType(draft.vehicleType),
    notes: readString(draft.notes),
    isActive: draft.isActive,
    crewMemberId: draft.crewMemberId,
    driverName: readString(options?.driverName),
    createdAt: new Date().toISOString(),
  } satisfies VehicleRecord;
}

function hydrateVehicleFromDraft(vehicle: VehicleRecord, draft: VehicleDraft) {
  return {
    ...vehicle,
    label: readString(draft.label) || vehicle.label,
    plateNumber: readString(draft.plateNumber),
    seatCapacity: parseSeatCapacity(draft.seatCapacity),
    vehicleType: normalizeVehicleType(draft.vehicleType),
    notes: readString(draft.notes),
    isActive: draft.isActive,
    crewMemberId: draft.crewMemberId,
  };
}

function normalizeVehiclesCachePayload(payload: unknown): VehicleCachePayload | null {
  const source = payload && typeof payload === "object" ? payload : null;

  if (!source) {
    return null;
  }

  const record = source as Record<string, unknown>;

  if (
    record.version !== VEHICLE_CACHE_VERSION ||
    !isFiniteNumber(record.savedAt) ||
    !Array.isArray(record.vehicles)
  ) {
    return null;
  }

  return {
    vehicles: sortVehicles(record.vehicles.map((vehicle) => normalizeVehicleRecord(vehicle))),
    savedAt: record.savedAt,
    version: VEHICLE_CACHE_VERSION,
  };
}

function isVehicleCacheFresh(cache: VehicleCachePayload) {
  return Date.now() - cache.savedAt <= VEHICLE_CACHE_TTL_MS;
}

function readVehiclesCache() {
  if (vehiclesCache) {
    return vehiclesCache;
  }

  if (!canUseStorage()) {
    return null;
  }

  try {
    const serializedCache = window.localStorage.getItem(VEHICLE_CACHE_STORAGE_KEY);

    if (!serializedCache) {
      return null;
    }

    const parsedCache = normalizeVehiclesCachePayload(JSON.parse(serializedCache));

    if (!parsedCache) {
      window.localStorage.removeItem(VEHICLE_CACHE_STORAGE_KEY);
      return null;
    }

    vehiclesCache = parsedCache;
    return parsedCache;
  } catch {
    return null;
  }
}

function writeVehiclesCache(cache: VehicleCachePayload) {
  vehiclesCache = cache;

  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(VEHICLE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota and serialization failures.
  }
}

function storeVehiclesCache(vehicles: VehicleRecord[]) {
  const cache: VehicleCachePayload = {
    vehicles: sortVehicles(vehicles.map((vehicle) => normalizeVehicleRecord(vehicle))),
    savedAt: Date.now(),
    version: VEHICLE_CACHE_VERSION,
  };

  writeVehiclesCache(cache);

  return cache.vehicles;
}

export function primeVehiclesCache(vehicles: VehicleRecord[]) {
  return storeVehiclesCache(vehicles);
}

function updateVehiclesCache(update: (currentVehicles: VehicleRecord[]) => VehicleRecord[]) {
  const currentVehicles = getCachedVehiclesSnapshot({ includeExpired: true }) ?? [];
  return storeVehiclesCache(update(currentVehicles));
}

function normalizeVehiclesResponse(payload: unknown) {
  if (!Array.isArray(payload)) {
    return storeVehiclesCache([]);
  }

  return storeVehiclesCache(payload.map((entry) => normalizeVehicleRecord(entry)));
}

export function getCachedVehiclesSnapshot(options?: { includeExpired?: boolean }) {
  const cache = readVehiclesCache();

  if (!cache) {
    return null;
  }

  if (!options?.includeExpired && !isVehicleCacheFresh(cache)) {
    return null;
  }

  return cache.vehicles;
}

export function hasFreshVehiclesCache() {
  const cache = readVehiclesCache();
  return cache ? isVehicleCacheFresh(cache) : false;
}

export function normalizeVehiclePayload(payload: unknown): VehiclePayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  const label = readString(record.label);
  const plateNumber = readString(record.plate_number) || readString(record.plateNumber);
  const seatCapacity = parseSeatCapacity(record.seat_capacity ?? record.seatCapacity);
  const vehicleType = normalizeVehicleType(record.vehicle_type ?? record.vehicleType);
  const notes = readString(record.notes);
  const crewMemberId = readString(record.crew_member_id) || readString(record.crewMemberId) || null;

  let isActive: boolean;
  if (typeof record.is_active === "boolean") {
    isActive = record.is_active;
  } else if (typeof record.isActive === "boolean") {
    isActive = record.isActive;
  } else {
    throw new Error("Vehicle payload must include a boolean 'is_active' field.");
  }
  return {
    label,
    plate_number: plateNumber,
    seat_capacity: seatCapacity,
    vehicle_type: mapVehicleTypeToValue(vehicleType),
    notes,
    is_active: isActive,
    crew_member_id: crewMemberId,
  };
}

export function validateVehiclePayload(payload: VehiclePayload) {
  if (!payload.label) {
    return "Vehicle name is required.";
  }

  if (!payload.plate_number) {
    return "License plate is required.";
  }

  if (!Number.isFinite(payload.seat_capacity) || payload.seat_capacity < 1) {
    return "Seat capacity must be greater than 0.";
  }

  return null;
}

function mapVehicleDraftToPayload(draft: VehicleDraft): VehiclePayload {
  return normalizeVehiclePayload(draft);
}

export async function fetchVehicles(options: FetchVehiclesOptions = {}) {
  const { forceRefresh = false, signal } = options;
  const cachedVehicles = !forceRefresh ? getCachedVehiclesSnapshot() : null;
  const staleCachedVehicles = getCachedVehiclesSnapshot({ includeExpired: true });

  if (cachedVehicles !== null) {
    return cachedVehicles;
  }

  if (!forceRefresh && vehiclesRequest) {
    return waitForPromiseWithSignal(vehiclesRequest, signal);
  }

  const request = (async () => {
    const response = await fetch("/api/vans", {
      cache: "no-store",
      method: "GET",
    });
    const payload = await parseResponseJson(response);

    if (!response.ok) {
      throw new Error(getResponseErrorMessage(payload, "Unable to load vans."));
    }

    return normalizeVehiclesResponse(payload);
  })();

  vehiclesRequest = request;
  void request.finally(() => {
    if (vehiclesRequest === request) {
      vehiclesRequest = null;
    }
  });

  try {
    return await waitForPromiseWithSignal(request, signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (staleCachedVehicles !== null) {
      return staleCachedVehicles;
    }

    throw error;
  }
}

export async function createVehicle(draft: VehicleDraft) {
  const response = await fetch("/api/vans", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(mapVehicleDraftToPayload(draft)),
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Unable to save van."));
  }

  const createdVehicle = hydrateVehicleFromDraft(normalizeVehicleRecord(payload), draft);

  updateVehiclesCache((currentVehicles) =>
    sortVehicles([
      createdVehicle,
      ...currentVehicles.filter((vehicle) => vehicle.id !== createdVehicle.id),
    ]),
  );

  return createdVehicle;
}

export async function updateVehicle(id: string, draft: VehicleDraft) {
  const response = await fetch(`/api/vans/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(mapVehicleDraftToPayload(draft)),
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Unable to update van."));
  }

  const updatedVehicle = hydrateVehicleFromDraft(normalizeVehicleRecord(payload), draft);

  updateVehiclesCache((currentVehicles) =>
    sortVehicles(
      currentVehicles.some((vehicle) => vehicle.id === id)
        ? currentVehicles.map((vehicle) => (vehicle.id === id ? updatedVehicle : vehicle))
        : [updatedVehicle, ...currentVehicles],
    ),
  );

  return updatedVehicle;
}

export async function deleteVehicle(id: string) {
  const response = await fetch(`/api/vans/${id}`, {
    method: "DELETE",
  });

  if (response.ok) {
    updateVehiclesCache((currentVehicles) =>
      currentVehicles.filter((vehicle) => vehicle.id !== id),
    );
    return;
  }

  const payload = await parseResponseJson(response);
  throw new Error(getResponseErrorMessage(payload, "Unable to delete van."));
}
