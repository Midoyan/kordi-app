"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import type { Drive } from "@/lib/drive-plan"
import { parseTimeString } from "@/lib/schedule-recalculation"
import type { DriveEditorDraft } from "@/components/drive-editor-sheet"

type DriveEditorMode = "create" | "edit" | null

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

export function getDriveCardKey(drive: Drive) {
  return [
    drive.id,
    drive.label,
    drive.startLocation,
    drive.startTime ?? "",
    drive.destinationAddress,
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

  React.useEffect(() => {
    if (driveSheetParam === "add-drive") {
      openCreateDrive(false)
    }
  }, [driveSheetParam, openCreateDrive])

  return {
    activeDrive,
    driveDraft,
    driveEditorMode,
    driveError,
    deletingDriveId,
    isSavingDrive,
    labelPreview: getDriveLabelPreview(activeDrive, driveDraft, drives.length),
    openCreateDrive,
    openEditDrive,
    closeDriveEditor,
    handleDriveSave,
    handleDriveDelete,
    setDriveDraft,
  }
}
