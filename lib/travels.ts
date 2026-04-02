export const travelTypes = ["pickup", "dropoff"] as const

export type TravelType = (typeof travelTypes)[number]

export type TravelPayload = {
  van_id: string
  travel_type: TravelType
  location_id: string
  scheduled_time: string | null
  sort_order: number
  notes: string
}

const travelTypesSet = new Set<string>(travelTypes)

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function parseInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0
  }

  return 0
}

export function normalizeTravelType(value: unknown): TravelType {
  const normalized = readString(value).toLowerCase()
  return travelTypesSet.has(normalized) ? (normalized as TravelType) : "pickup"
}

export function getTravelTypeLabel(value: TravelType) {
  return value === "dropoff" ? "Dropoff" : "Pickup"
}

export function normalizeTravelPayload(payload: unknown): TravelPayload {
  const source = payload && typeof payload === "object" ? payload : {}
  const record = source as Record<string, unknown>

  return {
    van_id: readString(record.van_id) || readString(record.vanId),
    travel_type: normalizeTravelType(record.travel_type ?? record.travelType),
    location_id: readString(record.location_id) || readString(record.locationId),
    scheduled_time:
      readString(record.scheduled_time) || readString(record.scheduledTime) || null,
    sort_order: parseInteger(record.sort_order ?? record.sortOrder),
    notes: readString(record.notes),
  }
}

export function validateTravelPayload(payload: TravelPayload) {
  if (!payload.van_id) {
    return "Van is required."
  }

  if (!payload.location_id) {
    return "Set location is required."
  }

  if (!travelTypesSet.has(payload.travel_type)) {
    return "Travel type is required."
  }

  if (payload.travel_type === "pickup" && !payload.scheduled_time) {
    return "Scheduled time is required for pickup drives."
  }

  return null
}
