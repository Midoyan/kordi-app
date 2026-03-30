import {
  formatTimeString,
  toReferenceDate,
  type RecalculatedScheduleStop,
  type ScheduleStopInput,
} from "@/lib/schedule-recalculation"

type RecalculateRequest = {
  arrivalTime?: string
  stops?: ScheduleStopInput[]
}

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

const mapboxToken =
  process.env.MAPBOX_ACCESS_TOKEN?.trim() ||
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
  ""

async function geocodeAddress(
  address: string,
  cache: Map<string, [number, number]>
) {
  const normalizedAddress = address.trim()

  if (cache.has(normalizedAddress)) {
    return cache.get(normalizedAddress) ?? null
  }

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(normalizedAddress)}.json?limit=1&autocomplete=false&access_token=${encodeURIComponent(mapboxToken)}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(`Mapbox geocoding failed for "${normalizedAddress}".`)
  }

  const data = (await response.json()) as GeocodingResponse
  const center = data.features?.[0]?.center

  if (!center || center.length < 2) {
    throw new Error(`Unable to resolve "${normalizedAddress}" in Mapbox.`)
  }

  cache.set(normalizedAddress, [center[0], center[1]])

  return [center[0], center[1]] as [number, number]
}

async function getLegDurationSeconds(
  originAddress: string,
  destinationAddress: string,
  cache: Map<string, [number, number]>
) {
  const origin = await geocodeAddress(originAddress, cache)
  const destination = await geocodeAddress(destinationAddress, cache)

  if (!origin || !destination) {
    throw new Error("Missing coordinates for schedule recalculation.")
  }

  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`
  const response = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?alternatives=false&geometries=geojson&overview=false&access_token=${encodeURIComponent(mapboxToken)}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(
      `Mapbox directions failed between "${originAddress}" and "${destinationAddress}".`
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

export async function POST(req: Request) {
  try {
    if (!mapboxToken) {
      return Response.json(
        {
          error:
            "Mapbox access token is missing. Set MAPBOX_ACCESS_TOKEN or NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.",
        },
        { status: 500 }
      )
    }

    const body = (await req.json()) as RecalculateRequest
    const stops = body.stops ?? []
    const arrivalTime = body.arrivalTime?.trim() ?? ""

    if (!arrivalTime) {
      return Response.json({ error: "arrivalTime is required." }, { status: 400 })
    }

    if (stops.length === 0) {
      return Response.json({ error: "At least one stop is required." }, { status: 400 })
    }

    const finalArrival = toReferenceDate(arrivalTime)

    if (!finalArrival) {
      return Response.json(
        { error: 'arrivalTime must use 24-hour "HH:mm" format.' },
        { status: 400 }
      )
    }

    const addressCache = new Map<string, [number, number]>()
    const recalculated: RecalculatedScheduleStop[] = []
    let cursor = finalArrival

    for (let index = stops.length - 1; index >= 0; index -= 1) {
      const currentStop = stops[index]
      const destinationAddress =
        index === stops.length - 1
          ? currentStop.endDestination.trim()
          : stops[index + 1].pickupAddress.trim()

      if (!currentStop.pickupAddress.trim() || !destinationAddress) {
        return Response.json(
          {
            error:
              "Each schedule row needs a pickup address, and the last row needs an end destination.",
          },
          { status: 400 }
        )
      }

      const legDurationSeconds = await getLegDurationSeconds(
        currentStop.pickupAddress,
        destinationAddress,
        addressCache
      )

      cursor = new Date(cursor.getTime() - legDurationSeconds * 1000)

      recalculated.unshift({
        ...currentStop,
        pickupTime: formatTimeString(cursor),
        arrival: arrivalTime,
        legDurationSeconds,
      })
    }

    return Response.json({ stops: recalculated }, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected schedule recalculation error.",
      },
      { status: 500 }
    )
  }
}
