"use client"

import * as React from "react"
import { createCalendar } from "@schedule-x/calendar"
import { createViewWeek } from "@schedule-x/calendar"
import { createViewDay } from "@schedule-x/calendar"
import type { CalendarEventExternal } from "@schedule-x/calendar"
import { ScheduleXCalendar } from "@schedule-x/react"
import "@schedule-x/theme-default/dist/index.css"
import "temporal-polyfill/global"

import type { Drive, TransportPlan } from "@/lib/drive-plan"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

const TRANSPORT_PLAN_REQUEST_RETRY_DELAY_MS = 500
const TRANSPORT_PLAN_REQUEST_MAX_ATTEMPTS = 2
const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
const DAY_BOUNDARY_PADDING_HOURS_BEFORE = 2
const DAY_BOUNDARY_PADDING_HOURS_AFTER = 4

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchTransportPlanWithRetry(): Promise<TransportPlan> {
  let lastError: unknown = null

  for (let attempt = 1; attempt <= TRANSPORT_PLAN_REQUEST_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch("/api/transport-plan", {
        cache: "no-store",
      })
      const payload = (await response.json().catch(() => null)) as
        | (Partial<TransportPlan> & { error?: string })
        | null

      if (!response.ok || !payload?.drives || !payload.stopPickupPassengerOptions) {
        throw new Error(payload?.error ?? "Unable to load drives.")
      }

      return {
        drives: payload.drives,
        stopPickupPassengerOptions: payload.stopPickupPassengerOptions,
      } satisfies TransportPlan
    } catch (error) {
      lastError = error

      if (attempt < TRANSPORT_PLAN_REQUEST_MAX_ATTEMPTS) {
        await wait(TRANSPORT_PLAN_REQUEST_RETRY_DELAY_MS)
        continue
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to load drives.")
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseTimeLabel(timeLabel: string | null) {
  if (!timeLabel) {
    return null
  }

  const [hours, minutes] = timeLabel.split(":").map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null
  }

  return { hours, minutes }
}

function toZonedDateTime(dateString: string, timeLabel: string | null) {
  const time = parseTimeLabel(timeLabel)

  if (!time) {
    return null
  }

  const plainDateTime = Temporal.PlainDateTime.from(
    `${dateString}T${String(time.hours).padStart(2, "0")}:${String(time.minutes).padStart(2, "0")}:00`,
  )

  return plainDateTime.toZonedDateTime(LOCAL_TIME_ZONE)
}

function addMinimumDuration(
  start: Temporal.ZonedDateTime,
  end: Temporal.ZonedDateTime | null,
  minimumMinutes: number,
) {
  if (!end || end.epochMilliseconds <= start.epochMilliseconds) {
    return start.add({ minutes: minimumMinutes })
  }

  const actualMinutes = Math.ceil((end.epochMilliseconds - start.epochMilliseconds) / 60000)
  return start.add({ minutes: Math.max(minimumMinutes, actualMinutes) })
}

function isZonedDateTime(value: Temporal.ZonedDateTime | Temporal.PlainDate): value is Temporal.ZonedDateTime {
  return "epochMilliseconds" in value
}

function formatBoundaryHour(hour: number) {
  return `${String(Math.max(0, Math.min(24, hour))).padStart(2, "0")}:00`
}

function computeDayBoundaries(events: CalendarEventExternal[]) {
  if (events.length === 0) {
    return {
      start: "03:00",
      end: "12:00",
    }
  }

  const earliestStart = events.reduce((currentEarliest, event) => {
    if (!isZonedDateTime(event.start) || !isZonedDateTime(currentEarliest)) {
      return currentEarliest
    }

    return event.start.epochMilliseconds < currentEarliest.epochMilliseconds ? event.start : currentEarliest
  }, events[0].start)

  const latestEnd = events.reduce((currentLatest, event) => {
    if (!isZonedDateTime(event.end) || !isZonedDateTime(currentLatest)) {
      return currentLatest
    }

    return event.end.epochMilliseconds > currentLatest.epochMilliseconds ? event.end : currentLatest
  }, events[0].end)

  if (!isZonedDateTime(earliestStart) || !isZonedDateTime(latestEnd)) {
    return {
      start: "03:00",
      end: "12:00",
    }
  }

  const startHour = Math.max(0, earliestStart.hour - DAY_BOUNDARY_PADDING_HOURS_BEFORE)
  const endHour = Math.min(24, latestEnd.hour + DAY_BOUNDARY_PADDING_HOURS_AFTER + (latestEnd.minute > 0 || latestEnd.second > 0 ? 1 : 0))

  return {
    start: formatBoundaryHour(startHour),
    end: formatBoundaryHour(endHour),
  }
}

function createEventsFromDrives(drives: Drive[]): CalendarEventExternal[] {
  const today = getTodayDate()
  const events: CalendarEventExternal[] = []

  for (const drive of drives) {
    const startTime = toZonedDateTime(today, drive.startTimeLabel)

    if (startTime) {
      const lastStop = drive.stops[drive.stops.length - 1]
      const lastStopTime = toZonedDateTime(today, lastStop?.pickupTimeLabel ?? null)
      const minimumMinutes = lastStop?.stopDurationSec
        ? Math.max(30, Math.ceil(lastStop.stopDurationSec / 60))
        : 30
      const endTime = addMinimumDuration(startTime, lastStopTime, minimumMinutes)

      const stopsList = drive.stops
        .map((stop) => {
          const passengers = stop.stopPickupPassengers.map((p) => p.name).join(", ")
          return `${stop.stopTitle}${passengers ? ` (${passengers})` : ""}`
        })
        .join(" → ")

      events.push({
        id: drive.id,
        title: `${drive.label}`,
        start: startTime,
        end: endTime,
        description: `Driver: ${drive.driver?.name || "Unassigned"}\nVehicle: ${drive.van?.label || "Unassigned"}\nStops: ${stopsList}`,
      })
    }
  }

  return events
}

function CalendarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-48 bg-[#ecece8]" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-20 bg-[#ecece8]" />
          <Skeleton className="h-9 w-20 bg-[#ecece8]" />
        </div>
      </div>
      <Skeleton className="h-96 w-full bg-[#ecece8]" />
    </div>
  )
}

function ErrorDisplay({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6">
      <AlertCircle className="size-8 text-red-600" />
      <div className="text-center">
        <h3 className="font-semibold text-red-900">Unable to load calendar</h3>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
      <Button onClick={onRetry} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  )
}

export function TransportCalendar() {
  const [calendar, setCalendar] = React.useState<ReturnType<typeof createCalendar> | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const calendarRef = React.useRef<HTMLDivElement>(null)

  const loadCalendar = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const transportPlan = await fetchTransportPlanWithRetry()
      const events = createEventsFromDrives(transportPlan.drives)
      const dayBoundaries = computeDayBoundaries(events)

      const newCalendar = createCalendar({
        views: [createViewDay(), createViewWeek()],
        defaultView: "day",
        dayBoundaries,
        events: events,
        callbacks: {
          onEventClick(calendarEvent) {
            console.log("Event clicked:", calendarEvent)
          },
        },
      })

      setCalendar(newCalendar)
      setIsLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load calendar")
      setIsLoading(false)
    }
  }, [])

  // Initialize calendar on mount
  React.useEffect(() => {
    loadCalendar()
  }, [loadCalendar])

  if (isLoading) {
    return <CalendarSkeleton />
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={loadCalendar} />
  }

  if (!calendar) {
    return (
      <div className="text-center text-[#6b6b67]">
        <p>Unable to initialize calendar. Please refresh the page.</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <div
        ref={calendarRef}
        className="h-full w-full rounded-lg border border-[#e3e3df] bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]"
      >
        {calendar && <ScheduleXCalendar calendarApp={calendar} />}
      </div>
    </div>
  )
}
