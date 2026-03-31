"use client"

import * as React from "react"

import type { Drive, TransportPlan } from "@/lib/drive-plan"
import { ScheduleSection } from "@/components/schedule-section"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const TRANSPORT_PLAN_CACHE_TTL_MS = 5 * 60 * 1000

let cachedTransportPlan: TransportPlan | null = null
let cachedTransportPlanAt = 0
let transportPlanPromise: Promise<TransportPlan> | null = null

function getCachedTransportPlan() {
  if (!cachedTransportPlan) {
    return null
  }

  if (Date.now() - cachedTransportPlanAt > TRANSPORT_PLAN_CACHE_TTL_MS) {
    cachedTransportPlan = null
    cachedTransportPlanAt = 0
    return null
  }

  return cachedTransportPlan
}

function setCachedTransportPlan(transportPlan: TransportPlan) {
  cachedTransportPlan = transportPlan
  cachedTransportPlanAt = Date.now()
}

function replaceDriveInTransportPlan(transportPlan: TransportPlan, nextDrive: Drive) {
  return {
    ...transportPlan,
    drives: transportPlan.drives.map((drive) =>
      drive.id === nextDrive.id ? nextDrive : drive
    ),
  }
}

function patchCachedTransportPlan(nextDrive: Drive) {
  const currentTransportPlan = getCachedTransportPlan()

  if (!currentTransportPlan) {
    return
  }

  setCachedTransportPlan(replaceDriveInTransportPlan(currentTransportPlan, nextDrive))
}

async function loadTransportPlan(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedTransportPlan()

    if (cached) {
      return cached
    }

    if (transportPlanPromise) {
      return transportPlanPromise
    }
  }

  transportPlanPromise = fetch("/api/transport-plan")
    .then(async (response) => {
      const payload = (await response.json().catch(() => null)) as
        | (Partial<TransportPlan> & { error?: string })
        | null

      if (!response.ok || !payload?.drives || !payload.stopPickupPassengerOptions) {
        throw new Error(payload?.error ?? "Unable to load drives.")
      }

      const nextTransportPlan: TransportPlan = {
        drives: payload.drives,
        stopPickupPassengerOptions: payload.stopPickupPassengerOptions,
      }

      setCachedTransportPlan(nextTransportPlan)
      return nextTransportPlan
    })
    .finally(() => {
      transportPlanPromise = null
    })

  return transportPlanPromise
}

function SchedulePanel({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#e3e3df] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1b]">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ScheduleSkeletonPanel() {
  return (
    <SchedulePanel title="Loading drive…" description="Fetching the latest drive and stop data.">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36 bg-[#ecece8]" />
            <Skeleton className="h-4 w-72 bg-[#f1f1ed]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-36 bg-[#ecece8]" />
            <Skeleton className="h-9 w-28 bg-[#ecece8]" />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#ecece8]">
          <div className="grid h-11 grid-cols-[40px_44px_1.2fr_1.5fr_0.7fr_1.4fr_0.7fr_56px] gap-3 border-b border-[#ecece8] bg-[#f7f7f4] px-3 py-3">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-4 bg-[#ecece8]" />
            ))}
          </div>
          <div className="space-y-0">
            {Array.from({ length: 4 }).map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-[40px_44px_1.2fr_1.5fr_0.7fr_1.4fr_0.7fr_56px] gap-3 border-b border-[#f0f0ec] px-3 py-4 last:border-b-0"
              >
                {Array.from({ length: 8 }).map((_, cellIndex) => (
                  <Skeleton
                    key={cellIndex}
                    className={`h-4 bg-[#f1f1ed] ${cellIndex === 2 || cellIndex === 3 || cellIndex === 5 ? "w-full" : "w-10"}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SchedulePanel>
  )
}

export function ScheduleView() {
  const [transportPlan, setTransportPlan] = React.useState<TransportPlan | null>(() =>
    getCachedTransportPlan()
  )
  const [isLoading, setIsLoading] = React.useState(() => !getCachedTransportPlan())
  const [error, setError] = React.useState<string | null>(null)
  const [retryToken, setRetryToken] = React.useState(0)

  const handleDriveUpdated = React.useCallback((nextDrive: Drive) => {
    patchCachedTransportPlan(nextDrive)

    React.startTransition(() => {
      setTransportPlan((currentTransportPlan) =>
        currentTransportPlan
          ? replaceDriveInTransportPlan(currentTransportPlan, nextDrive)
          : currentTransportPlan
      )
    })
  }, [])

  React.useEffect(() => {
    const cached = getCachedTransportPlan()

    if (cached) {
      React.startTransition(() => {
        setTransportPlan(cached)
        setError(null)
        setIsLoading(false)
      })
      return
    }

    let cancelled = false

    setIsLoading(true)
    setError(null)

    void loadTransportPlan(retryToken > 0)
      .then((nextTransportPlan) => {
        if (cancelled) {
          return
        }

        React.startTransition(() => {
          setTransportPlan(nextTransportPlan)
          setError(null)
          setIsLoading(false)
        })
      })
      .catch((nextError) => {
        if (cancelled) {
          return
        }

        React.startTransition(() => {
          setError(nextError instanceof Error ? nextError.message : "Unable to load drives.")
          setIsLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [retryToken])

  if (isLoading && !transportPlan) {
    return (
      <div className="grid gap-4">
        <ScheduleSkeletonPanel />
      </div>
    )
  }

  if (error && !transportPlan) {
    return (
      <div className="grid gap-4">
        <SchedulePanel title="Drives" description="The schedule could not be loaded right now.">
          <div className="rounded-lg border border-[#f3d7d7] bg-[#fff7f7] px-4 py-4">
            <p className="text-[13px] leading-6 text-[#9a4f4f]">{error}</p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                onClick={() => setRetryToken((current) => current + 1)}
              >
                Retry
              </Button>
            </div>
          </div>
        </SchedulePanel>
      </div>
    )
  }

  if (!transportPlan || transportPlan.drives.length === 0) {
    return (
      <div className="grid gap-4">
        <SchedulePanel
          title="Drives"
          description="Connected to the live Travels and Trips tables, but no drives have been added yet."
        >
          <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
            <div
              className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase"
              style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
            >
              {["Drive", "Stops", "Start", "Destination"].map((column) => (
                <span key={column}>{column}</span>
              ))}
            </div>
            <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
              <p className="text-[14px] font-medium text-[#1d1d1b]">No drives scheduled yet.</p>
              <button
                type="button"
                className="rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-[#f3f3ef]"
              >
                Add first stop
              </button>
            </div>
          </div>
        </SchedulePanel>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {transportPlan.drives.map((drive) => {
        const stopCount = drive.stops.length
        const startSummary = drive.startLocation || "Start location not set"
        const destinationSummary = drive.destinationAddress || "Destination not set"
        const description = `${stopCount} stop${stopCount === 1 ? "" : "s"} from ${startSummary} to ${destinationSummary}.`

        return (
          <SchedulePanel key={drive.id} title={drive.label} description={description}>
            <ScheduleSection
              drive={drive}
              stopPickupPassengerOptions={transportPlan.stopPickupPassengerOptions}
              onDriveUpdated={handleDriveUpdated}
            />
          </SchedulePanel>
        )
      })}
    </div>
  )
}
