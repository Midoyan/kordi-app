"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { Drive } from "@/lib/drive-plan"
import {
  createLocation,
  fetchLocations,
  getCachedLocationsSnapshot,
  type LocationRecord,
} from "@/lib/locations"
import { parseTimeString } from "@/lib/schedule-recalculation"
import {
  getTravelTypeLabel,
} from "@/lib/travels"
import {
  fetchVehicles,
  getCachedVehiclesSnapshot,
  type VehicleRecord,
} from "@/lib/vehicles"
import type { DriveEditorDraft } from "@/components/drive-editor-sheet"

type DriveEditorMode = "create" | "edit" | null

function buildDriveDraft(drive?: Drive): DriveEditorDraft {
  return {
    vanId: drive?.vanId ?? "",
    travelType: drive?.travelType ?? "pickup",
    locationId: drive?.locationId ?? "",
    scheduledTime: drive?.scheduledTimeLabel ?? "",
    scheduledTimeSource: drive?.scheduledTime ?? null,
    notes: drive?.notes ?? "",
  }
}

function formatScheduledTimestampValue(value: string, source: string | null) {
  const parsed = parseTimeString(value.trim())

  if (!parsed) {
    return null
  }

  const hours = parsed.hours.toString().padStart(2, "0")
  const minutes = parsed.minutes.toString().padStart(2, "0")
  const existingMatch = source?.match(
    /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/
  )

  if (existingMatch) {
    return `${existingMatch[1]}T${hours}:${minutes}${existingMatch[2] ?? ":00"}${existingMatch[3] ?? "Z"}`
  }

  const now = new Date()
  const datePart = [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-")

  return `${datePart}T${hours}:${minutes}:00Z`
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

function getPrimaryAddressLine(value: string) {
  return value.split(",")[0]?.trim() || value || "Not set"
}

function getDriveLabelPreview(
  drive: Drive | null,
  draft: DriveEditorDraft | null,
  driveCount: number,
  locationOptions: LocationRecord[]
) {
  if (drive) {
    return drive.label
  }

  const selectedLocation =
    draft?.locationId
      ? locationOptions.find((location) => location.id === draft.locationId) ?? null
      : null
  const locationLabel = getPrimaryAddressLine(
    selectedLocation?.name || selectedLocation?.address || ""
  )

  if (locationLabel && locationLabel !== "Not set") {
    return `${getTravelTypeLabel(draft?.travelType ?? "pickup")} · ${locationLabel}`
  }

  return `Drive ${driveCount + 1}`
}

export function getDriveCardKey(drive: Drive) {
  return [
    drive.id,
    drive.label,
    drive.travelType,
    drive.locationId,
    drive.scheduledTime ?? "",
    drive.vanId ?? "",
  ].join("::")
}

export function useDriveEditorState({
  drives,
  refreshTransportPlan,
}: {
  drives: Drive[]
  refreshTransportPlan: () => Promise<unknown>
}) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const driveSheetParam = searchParams.get("sheet")

  const [driveEditorMode, setDriveEditorMode] = React.useState<DriveEditorMode>(null)
  const [editingDriveId, setEditingDriveId] = React.useState<string | null>(null)
  const [driveDraft, setDriveDraft] = React.useState<DriveEditorDraft | null>(null)
  const [driveError, setDriveError] = React.useState<string | null>(null)
  const [isSavingDrive, setIsSavingDrive] = React.useState(false)
  const [deletingDriveId, setDeletingDriveId] = React.useState<string | null>(null)
  const [locationOptions, setLocationOptions] = React.useState<LocationRecord[]>(() =>
    getCachedLocationsSnapshot() ?? []
  )
  const [vehicleOptions, setVehicleOptions] = React.useState<VehicleRecord[]>(() =>
    getCachedVehiclesSnapshot() ?? []
  )
  const [isLoadingResources, setIsLoadingResources] = React.useState(false)
  const [isCreatingLocation, setIsCreatingLocation] = React.useState(false)
  const [resourceErrorMessage, setResourceErrorMessage] = React.useState<string | null>(null)

  const activeDrive = React.useMemo(
    () => drives.find((drive) => drive.id === editingDriveId) ?? null,
    [drives, editingDriveId]
  )

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

    const trimmedScheduledTime = driveDraft.scheduledTime.trim()

    if (!driveDraft.vanId) {
      setDriveError("Choose a van for this drive.")
      return
    }

    if (!driveDraft.locationId) {
      setDriveError("Choose a set location for this drive.")
      return
    }

    if (driveDraft.travelType === "pickup" && !trimmedScheduledTime) {
      setDriveError("Pickup drives need an arrival time.")
      return
    }

    if (trimmedScheduledTime && !parseTimeString(trimmedScheduledTime)) {
      setDriveError('Scheduled time must use 24-hour "HH:mm" format.')
      return
    }

    const payload = {
      van_id: driveDraft.vanId,
      travel_type: driveDraft.travelType,
      location_id: driveDraft.locationId,
      scheduled_time: trimmedScheduledTime
        ? formatScheduledTimestampValue(trimmedScheduledTime, driveDraft.scheduledTimeSource)
        : null,
      sort_order: driveEditorMode === "create" ? drives.length : activeDrive?.sortOrder ?? 0,
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
  }, [
    activeDrive?.sortOrder,
    closeDriveEditor,
    driveDraft,
    driveEditorMode,
    drives.length,
    editingDriveId,
    refreshTransportPlan,
  ])

  const handleDriveDelete = React.useCallback(
    async (drive: Drive) => {
      const confirmed = window.confirm(
        `Delete ${drive.label}? This also deletes every pickup stop in the drive.`
      )

      if (!confirmed) {
        return
      }

      setDriveError(null)
      setDeletingDriveId(drive.id)

      try {
        const response = await fetch(`/api/travels/${drive.id}`, {
          method: "DELETE",
        })

        await parseDriveMutationResponse(response, "Unable to delete this drive.")
        await refreshTransportPlan()

        if (editingDriveId === drive.id) {
          closeDriveEditor()
        }
      } catch (nextError) {
        setDriveError(
          nextError instanceof Error ? nextError.message : "Unable to delete this drive."
        )
      } finally {
        setDeletingDriveId(null)
      }
    },
    [closeDriveEditor, editingDriveId, refreshTransportPlan]
  )

  const handleCreateLocation = React.useCallback(async (query: string) => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      return
    }

    setResourceErrorMessage(null)
    setIsCreatingLocation(true)

    try {
      const createdLocation = await createLocation({
        name: trimmedQuery,
        type: "Other",
        address: trimmedQuery,
        notes: "",
      })

      setLocationOptions((current) => {
        const next = [createdLocation, ...current.filter((location) => location.id !== createdLocation.id)]
        return next
      })
      setDriveDraft((current) =>
        current
          ? {
              ...current,
              locationId: createdLocation.id,
            }
          : current
      )
    } catch (error) {
      setResourceErrorMessage(
        error instanceof Error ? error.message : "Unable to create location."
      )
    } finally {
      setIsCreatingLocation(false)
    }
  }, [])

  React.useEffect(() => {
    if (driveSheetParam === "add-drive") {
      openCreateDrive(false)
    }
  }, [driveSheetParam, openCreateDrive])

  React.useEffect(() => {
    if (driveEditorMode === null) {
      return
    }

    let cancelled = false

    setIsLoadingResources(true)
    setResourceErrorMessage(null)

    Promise.all([
      fetchLocations(),
      fetchVehicles(),
    ])
      .then(([nextLocations, nextVehicles]) => {
        if (cancelled) {
          return
        }

        setLocationOptions(nextLocations)
        setVehicleOptions(nextVehicles)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        setResourceErrorMessage(
          error instanceof Error ? error.message : "Unable to load drive options."
        )
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingResources(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [driveEditorMode])

  return {
    activeDrive,
    driveDraft,
    driveEditorMode,
    driveError,
    deletingDriveId,
    isSavingDrive,
    isLoadingResources,
    isCreatingLocation,
    labelPreview: getDriveLabelPreview(activeDrive, driveDraft, drives.length, locationOptions),
    locationOptions,
    openCreateDrive,
    openEditDrive,
    closeDriveEditor,
    handleDriveSave,
    handleDriveDelete,
    handleCreateLocation,
    resourceErrorMessage,
    setDriveDraft,
    vehicleOptions,
  }
}
