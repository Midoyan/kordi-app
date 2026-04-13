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

// Convert time string HH:MM to ISO time for same day
function createEventTime(timeLabel: string | null, dateString: string): Date | null {
  if (!timeLabel) return null

  const [hours, minutes] = timeLabel.split(":").map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null

  const date = new Date(dateString)
  date.setHours(hours, minutes, 0, 0)
  return date
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  const today = new Date()
  return today.toISOString().split("T")[0]
}

function dateToTemporalZonedDateTime(date: Date): typeof Temporal.ZonedDateTime.prototype {
  // Convert JS Date to Temporal.ZonedDateTime
  const isoString = date.toISOString()
  const plainDateTime = Temporal.PlainDateTime.from(isoString.split(".")[0])
  return plainDateTime.toZonedDateTime("UTC")
}

function createEventsFromDrives(drives: Drive[]): CalendarEventExternal[] {
  const today = getTodayDate()
  const events: CalendarEventExternal[] = []

  for (const drive of drives) {
    // Create main drive event
    const startTime = createEventTime(drive.startTimeLabel, today)
    if (startTime) {
      // Calculate end time based on last stop
      let endTime = new Date(startTime)
      const lastStop = drive.stops[drive.stops.length - 1]
      if (lastStop?.pickupTimeLabel) {
        const stopTime = createEventTime(lastStop.pickupTimeLabel, today)
        if (stopTime) {
          endTime = new Date(stopTime)
          // Add stop duration if available
          if (lastStop.stopDurationSec) {
            endTime.setSeconds(endTime.getSeconds() + lastStop.stopDurationSec)
          } else {
            endTime.setMinutes(endTime.getMinutes() + 30)
          }
        }
      } else {
        endTime.setMinutes(endTime.getMinutes() + 60)
      }

      const stopsList = drive.stops
        .map((stop) => {
          const passengers = stop.stopPickupPassengers.map((p) => p.name).join(", ")
          return `${stop.stopTitle}${passengers ? ` (${passengers})` : ""}`
        })
        .join(" → ")

      events.push({
        id: drive.id,
        title: `${drive.label}`,
        start: dateToTemporalZonedDateTime(startTime),
        end: dateToTemporalZonedDateTime(endTime),
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

      const newCalendar = createCalendar({
        views: [createViewDay(), createViewWeek()],
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
