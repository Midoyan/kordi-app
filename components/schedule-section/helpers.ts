import { parseTimeString } from "@/lib/schedule-recalculation"
import type { Drive, StopPickupPassengerOption } from "@/lib/drive-plan"

import type { DriveStopRow, RouteTone } from "@/components/schedule-section/types"

function buildInitialArrivalValue(drive: Drive) {
  return drive.scheduledTimeLabel || drive.stops[drive.stops.length - 1]?.pickupTimeLabel || ""
}

export function normalizeTimingSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 0
  }

  return Math.round(value)
}

export function normalizePersistedTimingSeconds(value: number | null | undefined) {
  const normalized = normalizeTimingSeconds(value)
  return normalized > 0 ? normalized : null
}

export function parseTimingInputValue(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null
  }

  return parsed <= 0 ? 0 : Math.round(parsed)
}

export function formatDurationSeconds(value: number | null | undefined) {
  const totalSeconds = normalizeTimingSeconds(value)

  if (totalSeconds === 0) {
    return "0s"
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }

  if (seconds > 0) {
    parts.push(`${seconds}s`)
  }

  return parts.join(" ")
}

export function hasAdvancedTimingValue(
  stop: Pick<DriveStopRow, "stopDurationSec" | "trafficBufferSec">
) {
  return (
    normalizeTimingSeconds(stop.stopDurationSec) > 0 ||
    normalizeTimingSeconds(stop.trafficBufferSec) > 0
  )
}

export function buildAdvancedTimingCaption(
  stop: Pick<DriveStopRow, "stopDurationSec" | "trafficBufferSec">,
  {
    showStopDuration,
    showTrafficBuffer,
  }: {
    showStopDuration: boolean
    showTrafficBuffer: boolean
  }
) {
  const parts: string[] = []

  if (!showStopDuration && normalizeTimingSeconds(stop.stopDurationSec) > 0) {
    parts.push(`+${formatDurationSeconds(stop.stopDurationSec)} boarding`)
  }

  if (!showTrafficBuffer && normalizeTimingSeconds(stop.trafficBufferSec) > 0) {
    parts.push(`+${formatDurationSeconds(stop.trafficBufferSec)} traffic`)
  }

  return parts.length > 0 ? parts.join(" • ") : null
}

export function buildInitialStopRows(drive: Drive) {
  const initialArrival = buildInitialArrivalValue(drive)
  const commonLocationAddress =
    drive.travelType === "pickup" ? drive.destinationAddress : drive.startLocation

  return drive.stops.map((stop) => ({
    id: stop.id,
    driveId: drive.id,
    stopTitle: stop.stopTitle,
    pickupAddress: stop.pickupAddress,
    pickupTime: stop.pickupTimeLabel,
    pickupTimeSource: stop.pickupTime,
    endDestination: commonLocationAddress,
    arrival: initialArrival,
    isFavorite: false,
    notes: stop.notes ?? "",
    createdAt: stop.createdAt,
    stopDurationSec: stop.stopDurationSec,
    trafficBufferSec: stop.trafficBufferSec,
    stopPickupPassengerIds: stop.stopPickupPassengers.map((passenger) => passenger.id),
  }))
}

export function buildNewStopRow(drive: Drive, index: number): DriveStopRow {
  const initialArrival = buildInitialArrivalValue(drive)
  const commonLocationAddress =
    drive.travelType === "pickup" ? drive.destinationAddress : drive.startLocation

  return {
    id: `draft-stop-${drive.id}-${Date.now()}`,
    driveId: drive.id,
    stopTitle: `Stop ${index + 1}`,
    pickupAddress: "",
    pickupTime: "",
    pickupTimeSource: null,
    endDestination: commonLocationAddress,
    arrival: initialArrival,
    isFavorite: false,
    notes: "",
    createdAt: new Date().toISOString(),
    stopDurationSec: null,
    trafficBufferSec: null,
    stopPickupPassengerIds: [],
  }
}

export function buildDriveFromStopRows(
  drive: Drive,
  rows: DriveStopRow[],
  passengerLookup: Map<string, StopPickupPassengerOption>
): Drive {
  return {
    ...drive,
    stops: rows.map((row) => ({
      id: row.id,
      driveId: drive.id,
      stopTitle: row.stopTitle,
      pickupAddress: row.pickupAddress,
      pickupTime: row.pickupTimeSource,
      pickupTimeLabel: row.pickupTime,
      stopDurationSec: normalizePersistedTimingSeconds(row.stopDurationSec),
      trafficBufferSec: normalizePersistedTimingSeconds(row.trafficBufferSec),
      notes: row.notes.trim() || null,
      createdAt: row.createdAt,
      stopPickupPassengers: row.stopPickupPassengerIds.map((passengerId) => {
        const passenger = passengerLookup.get(passengerId)

        return passenger
          ? {
              id: passenger.id,
              name: passenger.name,
              phone: passenger.phone,
              address: passenger.address,
            }
          : {
              id: passengerId,
              name: passengerId,
              phone: null,
              address: "",
            }
      }),
    })),
  }
}

export function toDatabaseTimeValue(value: string, source: string | null) {
  const parsed = parseTimeString(value)

  if (!parsed) {
    return source ?? value.trim()
  }

  const hours = parsed.hours.toString().padStart(2, "0")
  const minutes = parsed.minutes.toString().padStart(2, "0")
  const match = source?.match(/^\d{2}:\d{2}(:\d{2})?(.*)$/)
  const seconds = match?.[1] ?? ":00"
  const suffix = match?.[2] ?? ""

  return `${hours}:${minutes}${seconds}${suffix}`
}

export async function parseMutationResponse<T>(
  response: Response,
  fallbackMessage: string
) {
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string
      }
    | T
    | null

  if (!response.ok) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload
        ? payload.error || fallbackMessage
        : fallbackMessage
    )
  }

  return payload as T
}

export function orderDriveStops(items: DriveStopRow[], orderIds: string[]) {
  const itemById = new Map(items.map((item) => [item.id, item]))

  return orderIds
    .map((id) => itemById.get(id))
    .filter((item): item is DriveStopRow => Boolean(item))
}

export function areOrdersEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false
  }

  return first.every((id, index) => id === second[index])
}

export function buildRouteTone(index: number, total: number): RouteTone {
  const denominator = Math.max(total - 1, 1)
  const progress = index / denominator
  const lightness = 84 - progress * 24

  return {
    rail: `hsl(214 44% ${Math.round(lightness)}%)`,
    wash: `hsl(214 48% ${Math.round(lightness + 8)}% / 0.24)`,
  }
}

export function splitAddressLabel(value: string) {
  const [primaryPart, ...secondaryParts] = value.split(",")

  return {
    primary: primaryPart?.trim() ?? value,
    secondary: secondaryParts.join(",").trim(),
  }
}

export function getStopPickupPassengerNames(
  stopPickupPassengerIds: string[],
  passengerLookup: Map<string, StopPickupPassengerOption>
) {
  return stopPickupPassengerIds
    .map((id) => passengerLookup.get(id)?.name ?? id)
    .filter(Boolean)
}

export function abbreviatePassengerName(fullName: string) {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    return fullName
  }

  const [firstName, ...rest] = parts
  const abbreviatedRest = rest.map((part) => `${part[0]?.toLowerCase() ?? ""}.`)

  if (abbreviatedRest.length === 0) {
    return firstName
  }

  const lastIndex = abbreviatedRest.length - 1
  abbreviatedRest[lastIndex] = abbreviatedRest[lastIndex].toUpperCase()

  return [firstName, ...abbreviatedRest].join(" ")
}

export function shouldIgnoreRowSelectionTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      "button, input, select, textarea, a, label, summary, [role='checkbox'], [data-prevent-row-select='true']"
    )
  )
}
