"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  PencilLine,
  Plus,
} from "lucide-react"

import type { Drive, TransportPlan } from "@/lib/drive-plan"
import { parseTimeString } from "@/lib/schedule-recalculation"
import { DriveEditorSheet, type DriveEditorDraft } from "@/components/drive-editor-sheet"
import { ScheduleSection } from "@/components/schedule-section"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

const TRANSPORT_PLAN_CACHE_TTL_MS = 5 * 60 * 1000

let cachedTransportPlan: TransportPlan | null = null
let cachedTransportPlanAt = 0
let transportPlanPromise: Promise<TransportPlan> | null = null

type DriveEditorMode = "create" | "edit" | null

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

function buildDriveDraft(drive?: Drive): DriveEditorDraft {
  return {
    startLocation: drive?.startLocation ?? "",
    startTime: drive?.startTimeLabel ?? "",
    destinationAddress: drive?.destinationAddress ?? "",
    notes: drive?.notes ?? "",
  }
}

function formatDatabaseTimeValue(value: string) {
  const parsed = parseTimeString(value.trim())

  if (!parsed) {
    return null
  }

  const hours = parsed.hours.toString().padStart(2, "0")
  const minutes = parsed.minutes.toString().padStart(2, "0")
  return `${hours}:${minutes}:00`
}

function buildDriveSheetHref(pathname: string, searchParams: URLSearchParams, open: boolean) {
  const params = new URLSearchParams(searchParams.toString())

  if (open) {
    params.set("sheet", "add-drive")
  } else if (params.get("sheet") === "add-drive") {
    params.delete("sheet")
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

async function parseDriveMutationResponse<T>(
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

function getDriveCardKey(drive: Drive) {
  return [
    drive.id,
    drive.label,
    drive.startLocation,
    drive.startTime ?? "",
    drive.destinationAddress,
  ].join("::")
}

function getPrimaryAddressLine(value: string) {
  return value.split(",")[0]?.trim() || value || "Not set"
}

function getDriveLabelPreview(
  drive: Drive | null,
  draft: DriveEditorDraft | null,
  driveCount: number
) {
  if (drive) {
    return drive.label
  }

  const primaryDestination = getPrimaryAddressLine(draft?.destinationAddress?.trim() || "")

  if (primaryDestination && primaryDestination !== "Not set") {
    return `Drive to ${primaryDestination}`
  }

  return `Drive ${driveCount + 1}`
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
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const driveSheetParam = searchParams.get("sheet")

  const [transportPlan, setTransportPlan] = React.useState<TransportPlan | null>(() =>
    getCachedTransportPlan()
  )
  const [isLoading, setIsLoading] = React.useState(() => !getCachedTransportPlan())
  const [error, setError] = React.useState<string | null>(null)
  const [retryToken, setRetryToken] = React.useState(0)
  const [driveEditorMode, setDriveEditorMode] = React.useState<DriveEditorMode>(null)
  const [editingDriveId, setEditingDriveId] = React.useState<string | null>(null)
  const [driveDraft, setDriveDraft] = React.useState<DriveEditorDraft | null>(null)
  const [driveError, setDriveError] = React.useState<string | null>(null)
  const [isSavingDrive, setIsSavingDrive] = React.useState(false)

  const activeDrive = React.useMemo(
    () => transportPlan?.drives.find((drive) => drive.id === editingDriveId) ?? null,
    [editingDriveId, transportPlan]
  )

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

  const refreshTransportPlan = React.useCallback(async () => {
    const nextTransportPlan = await loadTransportPlan(true)

    React.startTransition(() => {
      setTransportPlan(nextTransportPlan)
      setError(null)
      setIsLoading(false)
    })

    return nextTransportPlan
  }, [])

  const closeDriveEditor = React.useCallback(() => {
    setDriveEditorMode(null)
    setEditingDriveId(null)
    setDriveDraft(null)
    setDriveError(null)

    if (driveSheetParam === "add-drive") {
      router.replace(
        buildDriveSheetHref(pathname, new URLSearchParams(searchParams.toString()), false),
        { scroll: false }
      )
    }
  }, [driveSheetParam, pathname, router, searchParams])

  const openCreateDrive = React.useCallback(
    (syncUrl = false) => {
      setDriveEditorMode("create")
      setEditingDriveId(null)
      setDriveDraft(buildDriveDraft())
      setDriveError(null)

      if (syncUrl) {
        router.replace(
          buildDriveSheetHref(pathname, new URLSearchParams(searchParams.toString()), true),
          { scroll: false }
        )
      }
    },
    [pathname, router, searchParams]
  )

  const openEditDrive = React.useCallback((drive: Drive) => {
    setDriveEditorMode("edit")
    setEditingDriveId(drive.id)
    setDriveDraft(buildDriveDraft(drive))
    setDriveError(null)
  }, [])

  const handleDriveSave = React.useCallback(async () => {
    if (!driveDraft || !driveEditorMode) {
      return
    }

    const trimmedStartTime = driveDraft.startTime.trim()

    if (trimmedStartTime && !parseTimeString(trimmedStartTime)) {
      setDriveError('Start time must use 24-hour "HH:mm" format.')
      return
    }

    const payload = {
      start_location: driveDraft.startLocation.trim() || null,
      start_time: trimmedStartTime ? formatDatabaseTimeValue(trimmedStartTime) : null,
      destination_address: driveDraft.destinationAddress.trim() || null,
      notes: driveDraft.notes.trim() || null,
    }

    setDriveError(null)
    setIsSavingDrive(true)

    try {
      if (driveEditorMode === "create") {
        const response = await fetch("/api/travels", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        await parseDriveMutationResponse(response, "Unable to create a new drive.")
      } else if (editingDriveId) {
        const response = await fetch(`/api/travels/${editingDriveId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        await parseDriveMutationResponse(response, "Unable to update this drive.")
      }

      await refreshTransportPlan()
      closeDriveEditor()
    } catch (nextError) {
      setDriveError(nextError instanceof Error ? nextError.message : "Unable to save this drive.")
    } finally {
      setIsSavingDrive(false)
    }
  }, [closeDriveEditor, driveDraft, driveEditorMode, editingDriveId, refreshTransportPlan])

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

  React.useEffect(() => {
    if (driveSheetParam === "add-drive") {
      openCreateDrive(false)
    }
  }, [driveSheetParam, openCreateDrive])

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

  const driveCount = transportPlan?.drives.length ?? 0
  const totalStopCount = transportPlan?.drives.reduce((count, drive) => count + drive.stops.length, 0) ?? 0
  const labelPreview = getDriveLabelPreview(activeDrive, driveDraft, driveCount)

  return (
    <>
      <div className="rounded-[30px] border border-[#e2e5dd] bg-[linear-gradient(180deg,rgba(248,249,244,0.98)_0%,rgba(242,244,237,0.98)_100%)] p-3 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.32)] sm:p-4">
        <div className="rounded-[24px] border border-[#e6e9e2] bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-[#dbe1d3] bg-[#f7faf2] px-3 py-1 text-[12px] font-medium text-[#4f5d4b]">
                {driveCount} drive{driveCount === 1 ? "" : "s"}
              </div>
              <div className="rounded-full border border-[#dbe1d3] bg-[#f7faf2] px-3 py-1 text-[12px] font-medium text-[#4f5d4b]">
                {totalStopCount} stop{totalStopCount === 1 ? "" : "s"}
              </div>
              <Button
                type="button"
                className="h-9 bg-[#1f3523] px-4 text-white hover:bg-[#29472d]"
                disabled={isSavingDrive}
                onClick={() => openCreateDrive()}
              >
                <Plus className="size-4" />
                Add drive
              </Button>
            </div>
          </div>
        </div>

        {error && transportPlan ? (
          <div className="mt-4 rounded-[18px] border border-[#f3d7d7] bg-[#fff7f7] px-4 py-3">
            <p className="text-[13px] leading-6 text-[#9a4f4f]">{error}</p>
          </div>
        ) : null}

        {transportPlan && transportPlan.drives.length === 0 ? (
          <div className="mt-4 rounded-[24px] border border-dashed border-[#d8ddd1] bg-white/84 px-6 py-10 text-center shadow-[0_18px_50px_-40px_rgba(15,23,42,0.25)]">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-[#75816f] uppercase">
              No drives yet
            </p>
            <h3 className="mt-3 text-[22px] font-semibold tracking-tight text-[#1d1d1b] text-balance">
              Start with the drive, then add stops inside it.
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-[14px] leading-6 text-[#61685d] text-pretty">
              A drive owns the final destination and route settings. Once it exists, the familiar stop table underneath can take over.
            </p>
            <div className="mt-5">
              <Button
                type="button"
                className="h-9 bg-[#1f3523] px-4 text-white hover:bg-[#29472d]"
                onClick={() => openCreateDrive()}
              >
                <Plus className="size-4" />
                Add first drive
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-5">
            {transportPlan?.drives.map((drive) => {
              const driverSummary = drive.driver?.name || "No driver assigned"
              const vanSummary =
                drive.van?.label?.trim() ||
                drive.van?.plate_number?.trim() ||
                "No van assigned"

              return (
                <article
                  key={getDriveCardKey(drive)}
                  className="rounded-[26px] border border-[#dde2d7] bg-white p-4 shadow-[0_24px_70px_-44px_rgba(15,23,42,0.3)] sm:p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <h3 className="text-[22px] font-semibold tracking-tight text-[#1d1d1b] text-balance">
                        {drive.label}
                      </h3>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-[#d8ddd1] bg-white/92 px-3 text-[#1d1d1b] hover:bg-[#f4f7ef]"
                      onClick={() => openEditDrive(drive)}
                    >
                      <PencilLine className="size-4" />
                      Drive settings
                    </Button>
                  </div>
                  <ScheduleSection
                    drive={drive}
                    stopPickupPassengerOptions={transportPlan.stopPickupPassengerOptions}
                    onDriveUpdated={handleDriveUpdated}
                    showDriveSummary={false}
                    renderHeaderLeading={({ finalArrivalTime }) => (
                      <>
                        <span className="text-[11px] font-semibold tracking-[0.14em] text-[#75816f] uppercase">
                          Drive to
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-7 max-w-[18rem] justify-start overflow-hidden rounded-full border-[#d8ddd1] bg-white/94 px-2.5 text-[#29402d] hover:bg-[#f4f7ef]"
                          onClick={() => openEditDrive(drive)}
                        >
                          <span className="truncate">
                            {drive.destinationAddress || "Set destination"}
                          </span>
                        </Button>
                        <span className="text-[11px] font-semibold tracking-[0.14em] text-[#75816f] uppercase">
                          arrives
                        </span>
                        <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)]">
                          {finalArrivalTime || "Unset"}
                        </span>
                        <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)]">
                          {vanSummary}
                        </span>
                        <span className="rounded-full border border-[#dde3d4] bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#51614f] shadow-[0_10px_20px_-18px_rgba(15,23,42,0.35)]">
                          {driverSummary}
                        </span>
                      </>
                    )}
                  />

                </article>
              )
            })}
          </div>
        )}
      </div>

      <DriveEditorSheet
        draft={driveDraft}
        mode={driveEditorMode}
        open={driveEditorMode !== null}
        labelPreview={labelPreview}
        driverLabel={activeDrive?.driver?.name ?? null}
        vanLabel={activeDrive?.van?.label ?? activeDrive?.van?.plate_number ?? null}
        errorMessage={driveError}
        isSaving={isSavingDrive}
        onClose={closeDriveEditor}
        onSave={handleDriveSave}
        setDraft={setDriveDraft}
      />
    </>
  )
}
