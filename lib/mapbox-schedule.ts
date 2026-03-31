import {
  formatTimeString,
  toReferenceDate,
  type RecalculatedScheduleStop,
  type ScheduleStopInput,
} from "@/lib/schedule-recalculation"

type GeocodingFeature = {
  center?: [number, number]
}

type GeocodingResponse = {
  features?: GeocodingFeature[]
}

type DirectionsRoute = {
  duration?: number
}

type DirectionsResponse = {
  routes?: DirectionsRoute[]
}

type OptimizationV1Trip = {
  duration?: number
}

type OptimizationV1Waypoint = {
  waypoint_index?: number
}

type OptimizationV1Response = {
  code?: string
  trips?: OptimizationV1Trip[]
  waypoints?: OptimizationV1Waypoint[]
}

export type CoordinateCache = Map<string, [number, number]>

const optimizationV1BaseUrl = "https://api.mapbox.com/optimized-trips/v1/mapbox/driving"

function normalizeTimingSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 0
  }

  return Math.round(value)
}

export function getMapboxToken() {
  return (
    process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
    ""
  )
}

export function assertMapboxToken() {
  const token = getMapboxToken()

  if (!token) {
    throw new Error(
      "Mapbox access token is missing. Set MAPBOX_ACCESS_TOKEN or NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN."
    )
  }

  return token
}

async function readMapboxError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string; error?: string }
    return body.message ?? body.error ?? response.statusText
  } catch {
    return response.statusText
  }
}

export async function geocodeAddress(
  address: string,
  cache: CoordinateCache,
  token = assertMapboxToken()
): Promise<[number, number]> {
  const normalizedAddress = address.trim()

  if (cache.has(normalizedAddress)) {
    return cache.get(normalizedAddress) as [number, number]
  }

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedAddress)}.json?limit=1&autocomplete=false&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(
      `Mapbox geocoding failed for "${normalizedAddress}": ${await readMapboxError(response)}.`
    )
  }

  const data = (await response.json()) as GeocodingResponse
  const center = data.features?.[0]?.center

  if (!center || center.length < 2) {
    throw new Error(`Unable to resolve "${normalizedAddress}" in Mapbox.`)
  }

  const coordinates: [number, number] = [center[0], center[1]]
  cache.set(normalizedAddress, coordinates)

  return coordinates
}

export async function getLegDurationSeconds(
  originAddress: string,
  destinationAddress: string,
  cache: CoordinateCache,
  token = assertMapboxToken()
) {
  const origin = await geocodeAddress(originAddress, cache, token)
  const destination = await geocodeAddress(destinationAddress, cache, token)

  if (!origin || !destination) {
    throw new Error("Missing coordinates for schedule recalculation.")
  }

  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?alternatives=false&geometries=geojson&overview=false&access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(
      `Mapbox directions failed between "${originAddress}" and "${destinationAddress}": ${await readMapboxError(response)}.`
    )
  }

  const data = (await response.json()) as DirectionsResponse
  const duration = data.routes?.[0]?.duration

  if (typeof duration !== "number" || Number.isNaN(duration)) {
    throw new Error(
      `Mapbox did not return a route duration between "${originAddress}" and "${destinationAddress}".`
    )
  }

  return duration
}

export async function recalculateScheduleStops(
  stops: ScheduleStopInput[],
  arrivalTime: string,
  cache: CoordinateCache = new Map(),
  token = assertMapboxToken()
) {
  if (!arrivalTime) {
    throw new Error("arrivalTime is required.")
  }

  if (stops.length === 0) {
    throw new Error("At least one stop is required.")
  }

  const finalArrival = toReferenceDate(arrivalTime)

  if (!finalArrival) {
    throw new Error('arrivalTime must use 24-hour "HH:mm" format.')
  }

  const recalculated: RecalculatedScheduleStop[] = []
  let cursor = finalArrival

  for (let index = stops.length - 1; index >= 0; index -= 1) {
    const currentStop = stops[index]
    const destinationAddress =
      index === stops.length - 1
        ? currentStop.endDestination.trim()
        : stops[index + 1].pickupAddress.trim()

    if (!currentStop.pickupAddress.trim() || !destinationAddress) {
      throw new Error(
        "Each schedule row needs a pickup address, and the last row needs an end destination."
      )
    }

    const legDurationSeconds = await getLegDurationSeconds(
      currentStop.pickupAddress,
      destinationAddress,
      cache,
      token
    )
    const stopDurationSeconds = normalizeTimingSeconds(currentStop.stopDurationSec)
    const trafficBufferSeconds = normalizeTimingSeconds(currentStop.trafficBufferSec)
    const totalBacktrackedSeconds =
      legDurationSeconds + stopDurationSeconds + trafficBufferSeconds

    cursor = new Date(cursor.getTime() - totalBacktrackedSeconds * 1000)

    recalculated.unshift({
      ...currentStop,
      pickupTime: formatTimeString(cursor),
      arrival: arrivalTime,
      legDurationSeconds,
    })
  }

  return recalculated
}

function areAllDestinationsEqual(stops: ScheduleStopInput[]) {
  const trimmedDestinations = stops
    .map((stop) => stop.endDestination.trim())
    .filter(Boolean)

  if (trimmedDestinations.length === 0) {
    return null
  }

  const [firstDestination] = trimmedDestinations
  return trimmedDestinations.every((destination) => destination === firstDestination)
    ? firstDestination
    : null
}

export async function optimizeScheduleStops(
  stops: ScheduleStopInput[],
  token = assertMapboxToken()
) {
  if (stops.length === 0) {
    throw new Error("At least one stop is required.")
  }

  if (stops.length > 11) {
    throw new Error(
      "Mapbox Optimization v1 supports up to 11 pickup stops plus one destination."
    )
  }

  const sharedDestination = areAllDestinationsEqual(stops)

  if (!sharedDestination) {
    throw new Error(
      "Optimization currently expects every stop to share the same final destination."
    )
  }

  const cache: CoordinateCache = new Map()
  const stopLocations = await Promise.all(
    stops.map(async (stop) => {
      return {
        stop,
        coordinates: await geocodeAddress(stop.pickupAddress, cache, token),
      }
    })
  )
  const destinationCoordinates = await geocodeAddress(sharedDestination, cache, token)
  let bestResult: { duration: number; orderedStops: ScheduleStopInput[] } | null = null

  for (let startIndex = 0; startIndex < stopLocations.length; startIndex += 1) {
    const orderedCandidates = [
      stopLocations[startIndex],
      ...stopLocations.filter((_, index) => index !== startIndex),
    ]
    const coordinateList = [
      ...orderedCandidates.map(
        ({ coordinates }) => `${coordinates[0]},${coordinates[1]}`
      ),
      `${destinationCoordinates[0]},${destinationCoordinates[1]}`,
    ].join(";")

    const response = await fetch(
      `${optimizationV1BaseUrl}/${coordinateList}?access_token=${encodeURIComponent(token)}&roundtrip=false&source=first&destination=last&steps=false&overview=false`,
      {
        cache: "no-store",
      }
    )

    if (!response.ok) {
      throw new Error(
        `Mapbox optimization failed: ${await readMapboxError(response)}.`
      )
    }

    const solution = (await response.json()) as OptimizationV1Response

    if (solution.code !== "Ok") {
      continue
    }

    const duration = solution.trips?.[0]?.duration

    if (typeof duration !== "number") {
      continue
    }

    const optimizedStops = (solution.waypoints ?? [])
      .map((waypoint, inputIndex) => ({
        inputIndex,
        waypointIndex: waypoint.waypoint_index ?? Number.MAX_SAFE_INTEGER,
      }))
      .filter(({ inputIndex }) => inputIndex < orderedCandidates.length)
      .sort((first, second) => first.waypointIndex - second.waypointIndex)
      .map(({ inputIndex }) => orderedCandidates[inputIndex].stop)

    if (optimizedStops.length !== stops.length) {
      continue
    }

    if (!bestResult || duration < bestResult.duration) {
      bestResult = {
        duration,
        orderedStops: optimizedStops,
      }
    }
  }

  if (!bestResult) {
    throw new Error("Mapbox optimization v1 did not return a valid route.")
  }

  return {
    orderedStops: bestResult.orderedStops,
    cache,
  }
}
