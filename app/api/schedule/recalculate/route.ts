import { recalculateScheduleStops } from "@/lib/mapbox-schedule"
import type { ScheduleStopInput } from "@/lib/schedule-recalculation"

type RecalculateRequest = {
  arrivalTime?: string
  stops?: ScheduleStopInput[]
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RecalculateRequest
    const stops = body.stops ?? []
    const arrivalTime = body.arrivalTime?.trim() ?? ""

    const recalculated = await recalculateScheduleStops(stops, arrivalTime)

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
