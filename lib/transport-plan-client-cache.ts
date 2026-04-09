import type {
  Drive,
  StopPickupPassengerOption,
  TransportPlan,
} from "@/lib/drive-plan"
import { createClientCacheStore } from "@/lib/client-cache-store"
import type { PersonRecord } from "@/lib/people"

const TRANSPORT_PLAN_CACHE_TTL_MS = 5 * 60 * 1000

let cachedTransportPlan: TransportPlan | null = null
let cachedTransportPlanAt = 0
let transportPlanPromise: Promise<TransportPlan> | null = null
const transportPlanCacheStore = createClientCacheStore()

function mapPersonToStopPickupPassengerOption(person: PersonRecord): StopPickupPassengerOption {
  return {
    id: person.id,
    name: person.name,
    detail: person.phone.trim() || "Crew member",
    phone: person.phone.trim() || null,
    address: person.address.trim(),
  }
}

export function getCachedTransportPlan(options?: { includeExpired?: boolean }) {
  if (!cachedTransportPlan) {
    return null
  }

  if (
    !options?.includeExpired &&
    Date.now() - cachedTransportPlanAt > TRANSPORT_PLAN_CACHE_TTL_MS
  ) {
    cachedTransportPlan = null
    cachedTransportPlanAt = 0
    return null
  }

  return cachedTransportPlan
}

export function setCachedTransportPlan(transportPlan: TransportPlan) {
  cachedTransportPlan = transportPlan
  cachedTransportPlanAt = Date.now()
  transportPlanCacheStore.notify()
}

export function clearCachedTransportPlan() {
  cachedTransportPlan = null
  cachedTransportPlanAt = 0
  transportPlanPromise = null
  transportPlanCacheStore.notify()
}

export function primeTransportPlanCache(transportPlan: TransportPlan) {
  setCachedTransportPlan(transportPlan)
  return transportPlan
}

export function replaceDriveInTransportPlan(transportPlan: TransportPlan, nextDrive: Drive) {
  return {
    ...transportPlan,
    drives: transportPlan.drives.map((drive) =>
      drive.id === nextDrive.id ? nextDrive : drive
    ),
  }
}

export function patchCachedTransportPlan(nextDrive: Drive) {
  const currentTransportPlan = getCachedTransportPlan()

  if (!currentTransportPlan) {
    return
  }

  setCachedTransportPlan(replaceDriveInTransportPlan(currentTransportPlan, nextDrive))
}

export function syncTransportPlanPassengerOptionsCache(people: PersonRecord[]) {
  const currentTransportPlan = getCachedTransportPlan({ includeExpired: true })

  if (!currentTransportPlan) {
    return null
  }

  const nextTransportPlan: TransportPlan = {
    ...currentTransportPlan,
    stopPickupPassengerOptions: people.map(mapPersonToStopPickupPassengerOption),
  }

  setCachedTransportPlan(nextTransportPlan)
  return nextTransportPlan
}

export function getTransportPlanPromise() {
  return transportPlanPromise
}

export function setTransportPlanPromise(nextPromise: Promise<TransportPlan> | null) {
  transportPlanPromise = nextPromise
}

export function subscribeTransportPlanCache(listener: () => void) {
  return transportPlanCacheStore.subscribe(listener)
}
