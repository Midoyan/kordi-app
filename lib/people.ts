import { createClientCacheStore } from "@/lib/client-cache-store";
import { syncTransportPlanPassengerOptionsCache } from "@/lib/transport-plan-client-cache";

export type CrewMemberRecord = {
  id: string;
  full_name: string;
  home_address: string;
  phone: string;
  default_role_title?: string | null;
  pickup_time?: string | null;
  pickup_to_location?: string | null;
  pickup_to_location_name?: string | null;
  pickup_to_location_address?: string | null;
  created_at?: string | null;
};

export type CrewMemberPayload = {
  full_name: string;
  home_address: string;
  phone: string;
  default_role_title: string;
};

export type PersonRecord = {
  id: string;
  name: string;
  address: string;
  phone: string;
  role: string;
  pickupTime: string;
  pickupToLocation: string;
  pickupToLocationName: string;
  pickupToLocationAddress: string;
  createdAt: string | null;
};

export type PersonDraft = Omit<
  PersonRecord,
  "id" | "createdAt" | "pickupTime" | "pickupToLocation" | "pickupToLocationName" | "pickupToLocationAddress"
>;

type PeopleCachePayload = {
  people: PersonRecord[];
  savedAt: number;
  version: 3;
};

type MemoryPeopleCachePayload = {
  people: PersonRecord[];
  savedAt: number;
};

const PEOPLE_CACHE_STORAGE_KEY = "kordi.people-cache.v3";
const PEOPLE_CACHE_TTL_MS = 5 * 60 * 1000;
const PEOPLE_CACHE_VERSION = 3;

let peopleCache: PeopleCachePayload | null = null;
let peopleRequest: Promise<PersonRecord[]> | null = null;
let basicPeopleCache: MemoryPeopleCachePayload | null = null;
let basicPeopleRequest: Promise<PersonRecord[]> | null = null;
const peopleCacheStore = createClientCacheStore({
  storageKey: PEOPLE_CACHE_STORAGE_KEY,
  onStorageChange: () => {
    peopleCache = null;

    const syncedPeople = getCachedPeopleSnapshot({ includeExpired: true });

    if (syncedPeople !== null) {
      writeBasicPeopleCache(syncedPeople);
      syncTransportPlanPassengerOptionsCache(syncedPeople);
      return;
    }

    basicPeopleCache = null;
  },
});

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

export function createEmptyPersonDraft(): PersonDraft {
  return {
    name: "",
    address: "",
    phone: "",
    role: "",
  };
}

export function getPersonSearchText(person: PersonRecord) {
  return [
    person.name,
    person.role,
    person.address,
    person.phone,
    person.pickupTime,
    person.pickupToLocation,
    person.pickupToLocationName,
    person.pickupToLocationAddress,
  ].join(" ").toLowerCase();
}

function normalizePersonRecord(payload: unknown): PersonRecord {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  return {
    id: readString(record.id),
    name: readString(record.name) || "Unnamed person",
    address: readString(record.address),
    phone: readString(record.phone),
    role: readString(record.role),
    pickupTime: readString(record.pickupTime ?? record.pickup_time),
    pickupToLocation: readString(record.pickupToLocation ?? record.pickup_to_location),
    pickupToLocationName: readString(record.pickupToLocationName ?? record.pickup_to_location_name),
    pickupToLocationAddress: readString(record.pickupToLocationAddress ?? record.pickup_to_location_address),
    createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
  };
}

function normalizePeopleCachePayload(payload: unknown): PeopleCachePayload | null {
  const source = payload && typeof payload === "object" ? payload : null;

  if (!source) {
    return null;
  }

  const record = source as Record<string, unknown>;

  if (record.version !== PEOPLE_CACHE_VERSION || !isFiniteNumber(record.savedAt) || !Array.isArray(record.people)) {
    return null;
  }

  return {
    people: record.people.map((person) => normalizePersonRecord(person)),
    savedAt: record.savedAt,
    version: PEOPLE_CACHE_VERSION,
  };
}

function isPeopleCacheFresh(cache: { savedAt: number }) {
  return Date.now() - cache.savedAt <= PEOPLE_CACHE_TTL_MS;
}

function writeBasicPeopleCache(people: PersonRecord[]) {
  const cache: MemoryPeopleCachePayload = {
    people: people.map((person) => normalizePersonRecord(person)),
    savedAt: Date.now(),
  };

  basicPeopleCache = cache;
  return cache.people;
}

function getCachedBasicPeopleSnapshot(options?: { includeExpired?: boolean }) {
  const sharedCache = readPeopleCache();

  if (sharedCache && (options?.includeExpired || isPeopleCacheFresh(sharedCache))) {
    return sharedCache.people;
  }

  if (!basicPeopleCache) {
    return null;
  }

  if (!options?.includeExpired && !isPeopleCacheFresh(basicPeopleCache)) {
    return null;
  }

  return basicPeopleCache.people;
}

function readPeopleCache() {
  if (peopleCache) {
    return peopleCache;
  }

  if (!canUseStorage()) {
    return null;
  }

  try {
    const serializedCache = window.localStorage.getItem(PEOPLE_CACHE_STORAGE_KEY);

    if (!serializedCache) {
      return null;
    }

    const parsedCache = normalizePeopleCachePayload(JSON.parse(serializedCache));

    if (!parsedCache) {
      window.localStorage.removeItem(PEOPLE_CACHE_STORAGE_KEY);
      return null;
    }

    peopleCache = parsedCache;
    return parsedCache;
  } catch {
    return null;
  }
}

function writePeopleCache(cache: PeopleCachePayload) {
  peopleCache = cache;

  if (!canUseStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(PEOPLE_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota and serialization failures.
  }
}

function storePeopleCache(people: PersonRecord[]) {
  const cache: PeopleCachePayload = {
    people: people.map((person) => normalizePersonRecord(person)),
    savedAt: Date.now(),
    version: PEOPLE_CACHE_VERSION,
  };

  writePeopleCache(cache);
  writeBasicPeopleCache(cache.people);
  syncTransportPlanPassengerOptionsCache(cache.people);
  peopleCacheStore.notify();

  return cache.people;
}

export function primePeopleCache(people: PersonRecord[]) {
  return storePeopleCache(people);
}

export function upsertPersonInPeopleCache(person: PersonRecord) {
  return updatePeopleCache((currentPeople) => [
    person,
    ...currentPeople.filter((entry) => entry.id !== person.id),
  ]);
}

function updatePeopleCache(
  update: (currentPeople: PersonRecord[]) => PersonRecord[],
) {
  const currentPeople = getCachedPeopleSnapshot({ includeExpired: true }) ?? [];
  return storePeopleCache(update(currentPeople));
}

export function getCachedPeopleSnapshot(options?: { includeExpired?: boolean }) {
  const cache = readPeopleCache();

  if (!cache) {
    return null;
  }

  if (!options?.includeExpired && !isPeopleCacheFresh(cache)) {
    return null;
  }

  return cache.people;
}

export function hasFreshPeopleCache() {
  const cache = readPeopleCache();
  return cache ? isPeopleCacheFresh(cache) : false;
}

export function subscribePeopleCache(listener: () => void) {
  return peopleCacheStore.subscribe(listener);
}

function buildPickupToLocationLabel(name: string, address: string) {
  return [name.trim(), address.trim()].filter(Boolean).join(" · ") || name.trim() || address.trim();
}

export function syncPeoplePickupLocationCache(
  previousLocation: { name: string; address: string },
  nextLocation: { name: string; address: string },
) {
  const previousName = readString(previousLocation.name);
  const previousAddress = readString(previousLocation.address);
  const previousLabel = buildPickupToLocationLabel(previousName, previousAddress);
  const nextName = readString(nextLocation.name);
  const nextAddress = readString(nextLocation.address);
  const nextLabel = buildPickupToLocationLabel(nextName, nextAddress);

  updatePeopleCache((currentPeople) =>
    currentPeople.map((person) => {
      const matchesPreviousLocation =
        person.pickupToLocationName === previousName ||
        person.pickupToLocationAddress === previousAddress ||
        person.pickupToLocation === previousLabel;

      if (!matchesPreviousLocation) {
        return person;
      }

      return {
        ...person,
        pickupToLocationName: nextName,
        pickupToLocationAddress: nextAddress,
        pickupToLocation: nextLabel,
      };
    }),
  );
}

export function normalizeCrewMemberPayload(payload: unknown): CrewMemberPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  return {
    full_name: readString(record.full_name),
    home_address: readString(record.home_address),
    phone: readString(record.phone),
    default_role_title: readString(record.default_role_title),
  };
}

export function validateCrewMemberPayload(payload: CrewMemberPayload) {
  if (!payload.full_name) {
    return "Name is required.";
  }

  return null;
}

export function mapCrewMemberToPerson(record: CrewMemberRecord): PersonRecord {
  return {
    id: record.id,
    name: readString(record.full_name) || "Unnamed person",
    address: readString(record.home_address),
    phone: readString(record.phone),
    role: readString(record.default_role_title),
    pickupTime: readString(record.pickup_time),
    pickupToLocation: readString(record.pickup_to_location),
    pickupToLocationName: readString(record.pickup_to_location_name),
    pickupToLocationAddress: readString(record.pickup_to_location_address),
    createdAt: typeof record.created_at === "string" ? record.created_at : null,
  };
}

export function mapPersonDraftToCrewMemberPayload(draft: PersonDraft): CrewMemberPayload {
  return {
    full_name: readString(draft.name),
    home_address: readString(draft.address),
    phone: readString(draft.phone),
    default_role_title: readString(draft.role),
  };
}

export function normalizeCrewMemberRecord(payload: unknown): CrewMemberRecord {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  return {
    id: readString(record.id),
    full_name: readString(record.full_name),
    home_address: readString(record.home_address),
    phone: readString(record.phone),
    default_role_title: readString(record.default_role_title),
    pickup_time: readString(record.pickup_time),
    pickup_to_location: readString(record.pickup_to_location),
    pickup_to_location_name: readString(record.pickup_to_location_name),
    pickup_to_location_address: readString(record.pickup_to_location_address),
    created_at: typeof record.created_at === "string" ? record.created_at : null,
  };
}

async function fetchPeopleFromApi(options?: {
  includeDriveContext?: boolean;
}) {
  const response = await fetch(
    options?.includeDriveContext
      ? "/api/crew-members?includeDriveContext=1"
      : "/api/crew-members",
    {
      cache: "no-store",
      method: "GET",
    },
  );
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Failed to load people."));
  }

  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((entry) => mapCrewMemberToPerson(normalizeCrewMemberRecord(entry)));
}

export async function fetchPeople(signal?: AbortSignal) {
  const cachedPeople = getCachedPeopleSnapshot();

  if (cachedPeople !== null) {
    return cachedPeople;
  }

  const staleCachedPeople = getCachedPeopleSnapshot({ includeExpired: true });

  if (!peopleRequest) {
    const request = fetchPeopleFromApi({ includeDriveContext: true }).then((people) =>
      storePeopleCache(people),
    );

    peopleRequest = request;
    void request.finally(() => {
      if (peopleRequest === request) {
        peopleRequest = null;
      }
    });
  }

  try {
    return await waitForPromiseWithSignal(peopleRequest, signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (staleCachedPeople !== null) {
      return staleCachedPeople;
    }

    throw error;
  }
}

export async function fetchBasicPeople(signal?: AbortSignal) {
  const cachedPeople = getCachedBasicPeopleSnapshot();

  if (cachedPeople !== null) {
    return cachedPeople;
  }

  const staleCachedPeople = getCachedBasicPeopleSnapshot({ includeExpired: true });

  if (!basicPeopleRequest) {
    const request = fetchPeopleFromApi().then((people) => writeBasicPeopleCache(people));

    basicPeopleRequest = request;
    void request.finally(() => {
      if (basicPeopleRequest === request) {
        basicPeopleRequest = null;
      }
    });
  }

  try {
    return await waitForPromiseWithSignal(basicPeopleRequest, signal);
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (staleCachedPeople !== null) {
      return staleCachedPeople;
    }

    throw error;
  }
}

export async function createPerson(draft: PersonDraft) {
  const response = await fetch("/api/crew-members", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(mapPersonDraftToCrewMemberPayload(draft)),
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Failed to create person."));
  }

  const createdPerson = mapCrewMemberToPerson(normalizeCrewMemberRecord(payload));

  updatePeopleCache((currentPeople) => [
    createdPerson,
    ...currentPeople.filter((person) => person.id !== createdPerson.id),
  ]);

  return createdPerson;
}

export async function updatePerson(id: string, draft: PersonDraft) {
  const response = await fetch(`/api/crew-members/${id}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(mapPersonDraftToCrewMemberPayload(draft)),
  });
  const payload = await parseResponseJson(response);

  if (!response.ok) {
    throw new Error(getResponseErrorMessage(payload, "Failed to update person."));
  }

  const updatedPerson = mapCrewMemberToPerson(normalizeCrewMemberRecord(payload));
  let mergedUpdatedPerson = updatedPerson;

  updatePeopleCache((currentPeople) =>
    currentPeople.some((person) => person.id === id)
      ? currentPeople.map((person) => {
          if (person.id !== id) {
            return person;
          }

          mergedUpdatedPerson = {
            ...person,
            ...updatedPerson,
          };

          return mergedUpdatedPerson;
        })
      : [updatedPerson, ...currentPeople],
  );

  return mergedUpdatedPerson;
}

export async function deletePerson(id: string) {
  const response = await fetch(`/api/crew-members/${id}`, {
    method: "DELETE",
  });

  if (response.ok) {
    updatePeopleCache((currentPeople) =>
      currentPeople.filter((person) => person.id !== id),
    );
    return;
  }

  const payload = await parseResponseJson(response);
  throw new Error(getResponseErrorMessage(payload, "Failed to delete person."));
}
