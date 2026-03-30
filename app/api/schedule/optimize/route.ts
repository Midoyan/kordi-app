import { optimizeScheduleStops, recalculateScheduleStops } from "@/lib/mapbox-schedule"
import type { ScheduleStopInput } from "@/lib/schedule-recalculation"

type OptimizeRequest = {
  arrivalTime?: string
  stops?: ScheduleStopInput[]
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OptimizeRequest
    const stops = body.stops ?? []
    const arrivalTime = body.arrivalTime?.trim() ?? ""

    const { orderedStops, cache } = await optimizeScheduleStops(stops)
    const recalculatedStops = await recalculateScheduleStops(orderedStops, arrivalTime, cache)

    return Response.json({ stops: recalculatedStops }, { status: 200 })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected schedule optimization error.",
      },
      { status: 500 }
    )
  }
}
