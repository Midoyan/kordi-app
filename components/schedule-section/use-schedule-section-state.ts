"use client"

import * as React from "react"
import { type DragEndEvent, type UniqueIdentifier } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import type {
  RowSelectionState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table"

import { type RecalculatedScheduleStop } from "@/lib/schedule-recalculation"
import {
  areOrdersEqual,
  buildDriveFromStopRows,
  buildNewStopRow,
  buildInitialStopRows,
  buildRouteTone,
  getStopPickupPassengerNames,
  normalizePersistedTimingSeconds,
  orderDriveStops,
  parseMutationResponse,
  toDatabaseTimeValue,
} from "@/components/schedule-section/helpers"
import type {
  DriveStopRow,
  PendingDriveStopUpdate,
  PositionChange,
  RouteTone,
  ScheduleStopDraftMode,
  ScheduleSectionProps,
} from "@/components/schedule-section/types"
import { defaultColumnVisibility } from "@/components/schedule-section/types"

type ScheduleSheetOpenChangeDetails = {
  reason?: string
}

type UseScheduleSectionStateOptions = Pick<
  ScheduleSectionProps,
  "drive" | "stopPickupPassengerOptions" | "onDriveUpdated" | "sharedColumnVisibility" | "onSharedColumnVisibilityChange"
>

export function useScheduleSectionState({
  drive,
  stopPickupPassengerOptions,
  onDriveUpdated,
  sharedColumnVisibility,
  onSharedColumnVisibilityChange,
}: UseScheduleSectionStateOptions) {
  const initialData = React.useMemo(() => buildInitialStopRows(drive), [drive])
  const passengerLookup = React.useMemo(
    () => new Map(stopPickupPassengerOptions.map((person) => [person.id, person])),
    [stopPickupPassengerOptions]
  )
  const currentDriveIdRef = React.useRef(drive.id)
  const lastSelectedRowIdRef = React.useRef<string | null>(null)
  const animationTokenRef = React.useRef(0)
  const isMountedRef = React.useRef(false)

  const [data, setData] = React.useState(initialData)
  const [pendingUpdates, setPendingUpdates] = React.useState<
    Record<string, PendingDriveStopUpdate>
  >({})
  const [pendingOrder, setPendingOrder] = React.useState<string[] | null>(null)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [internalColumnVisibility, setInternalColumnVisibility] = React.useState<VisibilityState>(
    defaultColumnVisibility
  )
  const columnVisibility = sharedColumnVisibility ?? internalColumnVisibility
  const setColumnVisibility = React.useCallback<React.Dispatch<React.SetStateAction<VisibilityState>>>(
    (updater) => {
      if (onSharedColumnVisibilityChange) {
        onSharedColumnVisibilityChange(updater)
        return
      }

      setInternalColumnVisibility(updater)
    },
    [onSharedColumnVisibilityChange]
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DriveStopRow | null>(null)
  const [draftMode, setDraftMode] = React.useState<ScheduleStopDraftMode>("edit")
  const [routeError, setRouteError] = React.useState<string | null>(null)
  const [databaseError, setDatabaseError] = React.useState<string | null>(null)
  const [showOptimizedGradient, setShowOptimizedGradient] = React.useState(false)
  const [isSavingStop, setIsSavingStop] = React.useState(false)
  const [deletingStopId, setDeletingStopId] = React.useState<string | null>(null)
  const [isDeletingSelectedStops, setIsDeletingSelectedStops] = React.useState(false)
  const [isConfirmingChanges, setIsConfirmingChanges] = React.useState(false)
  const [timingAdjustmentsOpen, setTimingAdjustmentsOpen] = React.useState(false)
  const [isAutoCalculatingStopTime, setIsAutoCalculatingStopTime] = React.useState(false)
  const autoCalculationAttemptRef = React.useRef<string | null>(null)
  const autoCalculationAbortControllerRef = React.useRef<AbortController | null>(null)
  const autoCalculationTimeoutRef = React.useRef<number | null>(null)
  const autoCalculationMaxTimeoutRef = React.useRef<number | null>(null)
  const autoCalculationAbortReasonRef = React.useRef<"manual" | "reset" | "timeout" | null>(
    null
  )
  const hasManualPickupTimeOverrideRef = React.useRef(false)

  React.useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  const cancelAutoStopTimeCalculation = React.useCallback(
    (reason: "manual" | "reset" | "timeout" = "reset") => {
      if (autoCalculationTimeoutRef.current !== null) {
        window.clearTimeout(autoCalculationTimeoutRef.current)
        autoCalculationTimeoutRef.current = null
      }

      if (autoCalculationMaxTimeoutRef.current !== null) {
        window.clearTimeout(autoCalculationMaxTimeoutRef.current)
        autoCalculationMaxTimeoutRef.current = null
      }

      const activeController = autoCalculationAbortControllerRef.current

      if (activeController && !activeController.signal.aborted) {
        autoCalculationAbortReasonRef.current = reason
        activeController.abort()
      }

      autoCalculationAbortControllerRef.current = null

      if (isMountedRef.current) {
        setIsAutoCalculatingStopTime(false)
      }
    },
    []
  )

  React.useEffect(() => {
    if (currentDriveIdRef.current === drive.id) {
      return
    }

    currentDriveIdRef.current = drive.id
    const nextData = buildInitialStopRows(drive)

    setData(nextData)
    setPendingUpdates({})
    setPendingOrder(null)
    setRowSelection({})
    if (!onSharedColumnVisibilityChange) {
      setInternalColumnVisibility(defaultColumnVisibility)
    }
    setSorting([])
    setActiveId(null)
    setSheetOpen(false)
    setDraft(null)
    setDraftMode("edit")
    setRouteError(null)
    setDatabaseError(null)
    setShowOptimizedGradient(false)
    setDeletingStopId(null)
    setIsDeletingSelectedStops(false)
    setTimingAdjustmentsOpen(false)
    setIsAutoCalculatingStopTime(false)
    cancelAutoStopTimeCalculation("reset")
    autoCalculationAttemptRef.current = null
    hasManualPickupTimeOverrideRef.current = false
    lastSelectedRowIdRef.current = null
  }, [cancelAutoStopTimeCalculation, drive, onSharedColumnVisibilityChange])

  const displayData = React.useMemo(
    () => (pendingOrder ? orderDriveStops(data, pendingOrder) : data),
    [data, pendingOrder]
  )

  const getVisibleItem = React.useCallback(
    (item: DriveStopRow) => {
      const pendingUpdate = pendingUpdates[item.id]

      if (!pendingUpdate) {
        return item
      }

      return {
        ...item,
        pickupTime: pendingUpdate.pickupTime,
        arrival: pendingUpdate.arrival,
      }
    },
    [pendingUpdates]
  )

  const updateStopRow = React.useCallback(
    <K extends keyof DriveStopRow>(id: string, key: K, value: DriveStopRow[K]) => {
      setData((current) =>
        current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
      )
    },
    []
  )

  const activeItem = React.useMemo(() => {
    const item = data.find((entry) => entry.id === activeId) ?? null
    return item ? getVisibleItem(item) : null
  }, [activeId, data, getVisibleItem])

  React.useEffect(() => {
    if (draftMode === "create") {
      return
    }

    if (activeItem) {
      setDraft(activeItem)
    } else if (!sheetOpen) {
      setDraft(null)
    }
  }, [activeItem, draftMode, sheetOpen])

  const openEditor = React.useCallback(
    (item: DriveStopRow) => {
      setDraftMode("edit")
      setActiveId(item.id)
      setDraft(getVisibleItem(item))
      setSheetOpen(true)
      setDatabaseError(null)
      setTimingAdjustmentsOpen(false)
      cancelAutoStopTimeCalculation("reset")
      autoCalculationAttemptRef.current = null
      hasManualPickupTimeOverrideRef.current = false
    },
    [cancelAutoStopTimeCalculation, getVisibleItem]
  )

  const handleSheetOpenChange = React.useCallback((
    open: boolean,
    eventDetails?: ScheduleSheetOpenChangeDetails
  ) => {
    if (!open && draftMode === "create" && draft) {
      const hasStartedDraft =
        draft.stopPickupPassengerIds.length > 0 ||
        draft.pickupAddress.trim().length > 0 ||
        draft.pickupTime.trim().length > 0 ||
        draft.notes.trim().length > 0 ||
        (draft.stopDurationSec ?? 0) > 0 ||
        (draft.trafficBufferSec ?? 0) > 0

      if (hasStartedDraft && eventDetails?.reason !== "close-press") {
        return
      }
    }

    setSheetOpen(open)

    if (!open) {
      setActiveId(null)
      setDraftMode("edit")
      setTimingAdjustmentsOpen(false)
      cancelAutoStopTimeCalculation("reset")
      autoCalculationAttemptRef.current = null
      hasManualPickupTimeOverrideRef.current = false
    }
  }, [cancelAutoStopTimeCalculation, draft, draftMode])

  const openCreateStopEditor = React.useCallback(() => {
    setDraftMode("create")
    setActiveId(null)
    setDraft(buildNewStopRow(drive, data.length))
    setSheetOpen(true)
    setDatabaseError(null)
    setTimingAdjustmentsOpen(false)
    cancelAutoStopTimeCalculation("reset")
    autoCalculationAttemptRef.current = null
    hasManualPickupTimeOverrideRef.current = false
  }, [cancelAutoStopTimeCalculation, data.length, drive])

  const handleDraftStopPickupPassengersChange = React.useCallback(
    (stopPickupPassengerIds: string[]) => {
      hasManualPickupTimeOverrideRef.current = false
      autoCalculationAttemptRef.current = null
      cancelAutoStopTimeCalculation("reset")

      setDraft((current) => {
        if (!current) {
          return current
        }

        if (draftMode === "create" && stopPickupPassengerIds.length === 0) {
          return {
            ...current,
            stopPickupPassengerIds,
            pickupAddress: "",
            pickupTime: "",
            pickupTimeSource: null,
          }
        }

        return {
          ...current,
          stopPickupPassengerIds,
        }
      })
    },
    [cancelAutoStopTimeCalculation, draftMode]
  )

  const handleDraftPickupTimeChange = React.useCallback(
    (pickupTime: string) => {
      hasManualPickupTimeOverrideRef.current = true
      cancelAutoStopTimeCalculation("manual")

      setDraft((current) =>
        current
          ? {
              ...current,
              pickupTime,
            }
          : current
      )
    },
    [cancelAutoStopTimeCalculation]
  )

  React.useEffect(() => {
    if (!sheetOpen || draftMode !== "create" || !draft) {
      cancelAutoStopTimeCalculation("reset")

      if (!sheetOpen || draftMode !== "create") {
        autoCalculationAttemptRef.current = null
        hasManualPickupTimeOverrideRef.current = false
      }

      return
    }

    const firstPassengerId = draft.stopPickupPassengerIds[0]

    if (!firstPassengerId) {
      cancelAutoStopTimeCalculation("reset")
      autoCalculationAttemptRef.current = null
      hasManualPickupTimeOverrideRef.current = false
      return
    }

    if (hasManualPickupTimeOverrideRef.current) {
      cancelAutoStopTimeCalculation("manual")
      return
    }

    const firstPassenger = passengerLookup.get(firstPassengerId)
    const suggestedAddress = draft.pickupAddress.trim() || firstPassenger?.address.trim() || ""
    const arrivalTime = draft.arrival.trim() || drive.scheduledTimeLabel.trim()
    const destinationAddress = draft.endDestination.trim()

    if (!draft.pickupAddress.trim() && firstPassenger?.address.trim()) {
      setDraft((current) =>
        current && current.id === draft.id
          ? {
              ...current,
              pickupAddress: firstPassenger.address.trim(),
            }
          : current
      )
    }

    if (!suggestedAddress) {
      setIsAutoCalculatingStopTime(false)
      return
    }

    if (!arrivalTime || !destinationAddress) {
      setIsAutoCalculatingStopTime(false)
      return
    }

    const attemptKey = [
      draft.id,
      firstPassengerId,
      suggestedAddress,
      destinationAddress,
      arrivalTime,
      draft.stopDurationSec ?? "",
      draft.trafficBufferSec ?? "",
    ].join("::")

    if (autoCalculationAttemptRef.current === attemptKey) {
      return
    }

    autoCalculationAttemptRef.current = attemptKey
    setIsAutoCalculatingStopTime(true)
    const requestDelayMs = draft.pickupAddress.trim() ? 350 : 0
    autoCalculationTimeoutRef.current = window.setTimeout(() => {
      const controller = new AbortController()
      autoCalculationAbortControllerRef.current = controller
      autoCalculationAbortReasonRef.current = null
      autoCalculationMaxTimeoutRef.current = window.setTimeout(() => {
        autoCalculationAbortReasonRef.current = "timeout"
        controller.abort()
      }, 7000)

      void fetch("/api/schedule/recalculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          arrivalTime,
          stops: [
            {
              id: draft.id,
              pickupAddress: suggestedAddress,
              endDestination: destinationAddress,
              stopDurationSec: draft.stopDurationSec,
              trafficBufferSec: draft.trafficBufferSec,
            },
          ],
        }),
      })
        .then(async (response) => {
          const payload = await parseMutationResponse<{ stops?: RecalculatedScheduleStop[] }>(
            response,
            "Unable to calculate the stop time automatically."
          )
          const nextStop = payload.stops?.[0]

          if (!nextStop?.pickupTime) {
            throw new Error("Unable to calculate the stop time automatically.")
          }

          if (!isMountedRef.current) {
            return
          }

          setDraft((current) =>
            current && current.id === draft.id
              ? {
                  ...current,
                  pickupAddress: current.pickupAddress.trim() || suggestedAddress,
                  pickupTime: nextStop.pickupTime,
                  pickupTimeSource: nextStop.pickupTime,
                  arrival: nextStop.arrival,
                }
              : current
          )
        })
        .catch((error) => {
          const abortReason = autoCalculationAbortReasonRef.current
          const isAbortError =
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && error.name === "AbortError")

          if (isAbortError && abortReason !== "timeout") {
            return
          }

          if (!isMountedRef.current) {
            return
          }

          setDraft((current) =>
            current && current.id === draft.id
              ? {
                  ...current,
                  pickupAddress: current.pickupAddress.trim() || suggestedAddress,
                  pickupTime: "",
                pickupTimeSource: null,
              }
            : current
          )
        })
        .finally(() => {
          if (autoCalculationMaxTimeoutRef.current !== null) {
            window.clearTimeout(autoCalculationMaxTimeoutRef.current)
            autoCalculationMaxTimeoutRef.current = null
          }
          autoCalculationAbortControllerRef.current = null
          autoCalculationAbortReasonRef.current = null

          if (isMountedRef.current) {
            setIsAutoCalculatingStopTime(false)
          }
        })
    }, requestDelayMs)

    return () => {
      cancelAutoStopTimeCalculation("reset")
    }
  }, [
    cancelAutoStopTimeCalculation,
    draft,
    draftMode,
    drive.scheduledTimeLabel,
    passengerLookup,
    setDraft,
    sheetOpen,
  ])

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => displayData.map(({ id }) => id),
    [displayData]
  )

  const finalArrivalTime = React.useMemo(
    () =>
      displayData[displayData.length - 1]?.arrival.trim() ||
      displayData.find((item) => item.arrival.trim())?.arrival.trim() ||
      "",
    [displayData]
  )

  const pendingChangeCount = React.useMemo(
    () => Object.keys(pendingUpdates).length,
    [pendingUpdates]
  )

  const routeTones = React.useMemo<Record<string, RouteTone>>(
    () =>
      data.reduce<Record<string, RouteTone>>((accumulator, item, index) => {
        accumulator[item.id] = buildRouteTone(index, data.length)
        return accumulator
      }, {}),
    [data]
  )

  const positionChanges = React.useMemo<Record<string, PositionChange>>(() => {
    if (!pendingOrder) {
      return {}
    }

    const confirmedOrder = data.map((item) => item.id)

    return pendingOrder.reduce<Record<string, PositionChange>>((accumulator, id, index) => {
      const confirmedIndex = confirmedOrder.indexOf(id)

      if (confirmedIndex === -1 || confirmedIndex === index) {
        return accumulator
      }

      accumulator[id] = {
        from: confirmedIndex + 1,
        to: index + 1,
      }

      return accumulator
    }, {})
  }, [data, pendingOrder])

  const hasPendingRouteChange = pendingOrder !== null
  const hasPendingChanges = pendingChangeCount > 0 || hasPendingRouteChange
  const isStopDurationColumnVisible = columnVisibility.stopDurationSec !== false
  const isTrafficBufferColumnVisible = columnVisibility.trafficBufferSec !== false

  const pendingSummary = React.useMemo(() => {
    const parts: string[] = []

    if (hasPendingRouteChange) {
      parts.push("Optimized stop order staged.")
    }

    if (pendingChangeCount > 0) {
      parts.push(
        `${pendingChangeCount} stop${pendingChangeCount === 1 ? "" : "s"} recalculated.`
      )
    }

    parts.push("Review the staged drive, then confirm when the timing looks right.")

    return parts.join(" ")
  }, [hasPendingRouteChange, pendingChangeCount])

  const syncStopPickupPassengers = React.useCallback(
    async (stopId: string, currentIds: string[], nextIds: string[]) => {
      const currentIdSet = new Set(currentIds)
      const nextIdSet = new Set(nextIds)
      const removals = currentIds.filter((id) => !nextIdSet.has(id))
      const additions = nextIds.filter((id) => !currentIdSet.has(id))

      await Promise.all([
        ...removals.map(async (crewMemberId) => {
          const response = await fetch(
            `/api/trips/${stopId}/passengers/${crewMemberId}`,
            {
              method: "DELETE",
            }
          )

          await parseMutationResponse(response, "Unable to remove a passenger from this stop.")
        }),
        ...additions.map(async (crewMemberId) => {
          const response = await fetch(`/api/trips/${stopId}/passengers`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              crew_member_id: crewMemberId,
            }),
          })

          await parseMutationResponse(response, "Unable to add a passenger to this stop.")
        }),
      ])
    },
    []
  )

  const applyDeletedStops = React.useCallback(
    (stopIds: string[]) => {
      if (stopIds.length === 0) {
        return
      }

      const deletedIdSet = new Set(stopIds)
      const nextData = data.filter((item) => !deletedIdSet.has(item.id))
      const nextDrive = buildDriveFromStopRows(drive, nextData, passengerLookup)

      setData(nextData)
      setPendingOrder((current) =>
        current ? current.filter((id) => !deletedIdSet.has(id)) : current
      )
      setPendingUpdates((current) => {
        const next = { ...current }

        for (const stopId of stopIds) {
          delete next[stopId]
        }

        return next
      })
      setRowSelection((current) => {
        const next = { ...current }

        for (const stopId of stopIds) {
          delete next[stopId]
        }

        return next
      })

      if (activeId && deletedIdSet.has(activeId)) {
        setSheetOpen(false)
        setActiveId(null)
        setDraft(null)
      }

      if (lastSelectedRowIdRef.current && deletedIdSet.has(lastSelectedRowIdRef.current)) {
        lastSelectedRowIdRef.current = null
      }

      onDriveUpdated?.(nextDrive)
    },
    [activeId, data, drive, onDriveUpdated, passengerLookup]
  )

  const confirmPendingChanges = React.useCallback(async () => {
    const nextData = (pendingOrder ? orderDriveStops(data, pendingOrder) : data).map((item) => {
      const pendingUpdate = pendingUpdates[item.id]

      if (!pendingUpdate) {
        return item
      }

      return {
        ...item,
        pickupTime: pendingUpdate.pickupTime,
        pickupTimeSource: toDatabaseTimeValue(pendingUpdate.pickupTime, item.pickupTimeSource),
        arrival: pendingUpdate.arrival,
      }
    })
    const changedStops = nextData.filter((item) => pendingUpdates[item.id])

    if (changedStops.length === 0) {
      setData(nextData)
      setPendingOrder(null)
      setPendingUpdates({})
      setShowOptimizedGradient(false)
      setRouteError(null)
      setDraft((current) => {
        if (!current) {
          return current
        }

        return nextData.find((item) => item.id === current.id) ?? current
      })
      return
    }

    setDatabaseError(null)
    setIsConfirmingChanges(true)

    try {
      for (const item of changedStops) {
        const pickupTimeSource = item.pickupTimeSource?.trim() ?? ""

        if (!pickupTimeSource) {
          throw new Error("One of the recalculated stops is missing a pickup time.")
        }

        const response = await fetch(`/api/trips/${item.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pickup_time: pickupTimeSource,
          }),
        })

        await parseMutationResponse(response, "Unable to save recalculated stop times.")
      }

      const nextDrive = buildDriveFromStopRows(drive, nextData, passengerLookup)

      setData(nextData)
      setPendingOrder(null)
      setPendingUpdates({})
      setShowOptimizedGradient(false)
      setRouteError(null)
      setDraft((current) => {
        if (!current) {
          return current
        }

        return nextData.find((item) => item.id === current.id) ?? current
      })
      onDriveUpdated?.(nextDrive)
    } catch (error) {
      setDatabaseError(
        error instanceof Error ? error.message : "Unable to save the staged drive changes."
      )
    } finally {
      setIsConfirmingChanges(false)
    }
  }, [data, drive, onDriveUpdated, passengerLookup, pendingOrder, pendingUpdates])

  const handlePlanReady = React.useCallback(
    (
      plannedStops: RecalculatedScheduleStop[],
      source: "optimize" | "recalculate"
    ) => {
      animationTokenRef.current += 1

      const nextOrder = plannedStops.map((stop) => stop.id)
      const confirmedOrder = data.map((item) => item.id)
      const hasRouteChange = !areOrdersEqual(nextOrder, confirmedOrder)
      const nextPendingUpdates = plannedStops.reduce<Record<string, PendingDriveStopUpdate>>(
        (accumulator, plannedStop, index) => {
          const currentItem = data.find((item) => item.id === plannedStop.id)

          if (!currentItem) {
            return accumulator
          }

          if (
            currentItem.pickupTime === plannedStop.pickupTime &&
            currentItem.arrival === plannedStop.arrival
          ) {
            return accumulator
          }

          accumulator[plannedStop.id] = {
            pickupTime: plannedStop.pickupTime,
            arrival: plannedStop.arrival,
            revealOrder: index,
            animationToken: animationTokenRef.current,
          }

          return accumulator
        },
        {}
      )

      setPendingOrder(hasRouteChange ? nextOrder : null)
      setPendingUpdates(nextPendingUpdates)
      setShowOptimizedGradient(source === "optimize" && hasRouteChange)

      return hasRouteChange || Object.keys(nextPendingUpdates).length > 0
    },
    [data]
  )

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id) {
        return
      }

      if (pendingOrder) {
        setPendingOrder((current) => {
          if (!current) {
            return current
          }

          const oldIndex = current.indexOf(String(active.id))
          const newIndex = current.indexOf(String(over.id))

          if (oldIndex === -1 || newIndex === -1) {
            return current
          }

          const nextOrder = arrayMove(current, oldIndex, newIndex)
          return areOrdersEqual(
            nextOrder,
            data.map((item) => item.id)
          )
            ? null
            : nextOrder
        })
        return
      }

      setData((current) => {
        const ids = current.map((item) => item.id)
        const oldIndex = ids.indexOf(String(active.id))
        const newIndex = ids.indexOf(String(over.id))

        if (oldIndex === -1 || newIndex === -1) {
          return current
        }

        return arrayMove(current, oldIndex, newIndex)
      })
    },
    [data, pendingOrder]
  )

  const handleDelete = React.useCallback(
    async (item: DriveStopRow) => {
      const confirmed = window.confirm(
        `Delete this stop${item.stopPickupPassengerIds.length > 0 ? ` for ${getStopPickupPassengerNames(item.stopPickupPassengerIds, passengerLookup).join(", ")}` : ""}?`
      )

      if (!confirmed) {
        return
      }

      setDatabaseError(null)
      setDeletingStopId(item.id)

      try {
        const response = await fetch(`/api/trips/${item.id}`, {
          method: "DELETE",
        })

        await parseMutationResponse(response, "Unable to delete this stop.")
        applyDeletedStops([item.id])
      } catch (error) {
        setDatabaseError(error instanceof Error ? error.message : "Unable to delete this stop.")
      } finally {
        setDeletingStopId((current) => (current === item.id ? null : current))
      }
    },
    [applyDeletedStops, passengerLookup]
  )

  const handleDeleteSelected = React.useCallback(
    async (stopIds: string[]) => {
      if (stopIds.length === 0) {
        return
      }

      const confirmed = window.confirm(
        `Delete ${stopIds.length} selected stop${stopIds.length === 1 ? "" : "s"}?`
      )

      if (!confirmed) {
        return
      }

      setDatabaseError(null)
      setIsDeletingSelectedStops(true)

      try {
        await Promise.all(
          stopIds.map(async (stopId) => {
            const response = await fetch(`/api/trips/${stopId}`, {
              method: "DELETE",
            })

            await parseMutationResponse(response, "Unable to delete the selected stops.")
          })
        )

        applyDeletedStops(stopIds)
      } catch (error) {
        setDatabaseError(
          error instanceof Error ? error.message : "Unable to delete the selected stops."
        )
      } finally {
        setIsDeletingSelectedStops(false)
      }
    },
    [applyDeletedStops]
  )

  const stopCount = displayData.length
  const passengerCount = React.useMemo(
    () => new Set(displayData.flatMap((item) => item.stopPickupPassengerIds)).size,
    [displayData]
  )

  const handleDraftSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!draft) {
        return
      }

      const normalizedPassengerIds = Array.from(new Set(draft.stopPickupPassengerIds))
      const currentItem = data.find((item) => item.id === draft.id)
      const pickupTimeSource = toDatabaseTimeValue(
        draft.pickupTime,
        currentItem?.pickupTimeSource ?? draft.pickupTimeSource
      ).trim()
      const persistedStopDurationSec = normalizePersistedTimingSeconds(draft.stopDurationSec)
      const persistedTrafficBufferSec = normalizePersistedTimingSeconds(draft.trafficBufferSec)

      if (draftMode === "create" && normalizedPassengerIds.length === 0) {
        setDatabaseError("Choose at least one passenger before creating a stop.")
        return
      }

      if (!draft.pickupAddress.trim()) {
        setDatabaseError("Pickup address is required.")
        return
      }

      if (!pickupTimeSource) {
        setDatabaseError("Pickup time is required.")
        return
      }

      setDatabaseError(null)
      setIsSavingStop(true)

      try {
        let nextData = data

        if (draftMode === "create") {
          const stopResponse = await fetch("/api/trips", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              travel_id: drive.id,
              pickup_address: draft.pickupAddress.trim(),
              pickup_time: pickupTimeSource,
              trip_title: draft.stopTitle.trim() || `Stop ${data.length + 1}`,
              stop_duration_sec: persistedStopDurationSec,
              traffic_buffer_sec: persistedTrafficBufferSec,
              notes: draft.notes.trim() || null,
            }),
          })

          const createdStop = await parseMutationResponse<{ id: string }>(
            stopResponse,
            "Unable to create this stop."
          )

          await syncStopPickupPassengers(createdStop.id, [], normalizedPassengerIds)

          nextData = [
            ...data,
            {
              ...draft,
              id: createdStop.id,
              stopPickupPassengerIds: normalizedPassengerIds,
              pickupAddress: draft.pickupAddress.trim(),
              pickupTime: draft.pickupTime.trim(),
              pickupTimeSource,
              stopTitle: draft.stopTitle.trim() || `Stop ${data.length + 1}`,
              stopDurationSec: persistedStopDurationSec,
              trafficBufferSec: persistedTrafficBufferSec,
              notes: draft.notes.trim(),
            },
          ]
        } else {
          if (!currentItem) {
            return
          }

          const stopResponse = await fetch(`/api/trips/${draft.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pickup_address: draft.pickupAddress.trim(),
              pickup_time: pickupTimeSource,
              trip_title: draft.stopTitle.trim() || currentItem.stopTitle,
              stop_duration_sec: persistedStopDurationSec,
              traffic_buffer_sec: persistedTrafficBufferSec,
              notes: draft.notes.trim() || null,
            }),
          })

          await parseMutationResponse(stopResponse, "Unable to save this stop.")

          await syncStopPickupPassengers(
            draft.id,
            currentItem.stopPickupPassengerIds,
            normalizedPassengerIds
          )

          nextData = data.map((item) => {
            if (item.id !== draft.id) {
              return item
            }

              return {
                ...item,
                stopPickupPassengerIds: normalizedPassengerIds,
                pickupAddress: draft.pickupAddress.trim(),
                pickupTime: draft.pickupTime.trim(),
                pickupTimeSource,
                stopTitle: draft.stopTitle.trim() || item.stopTitle,
                stopDurationSec: persistedStopDurationSec,
                trafficBufferSec: persistedTrafficBufferSec,
                notes: draft.notes.trim(),
            }
          })
        }

        const nextDrive = buildDriveFromStopRows(drive, nextData, passengerLookup)

        setData(nextData)
        setPendingUpdates((current) => {
          const next = { ...current }
          delete next[draft.id]
          return next
        })
        setSheetOpen(false)
        setActiveId(null)
        setDraftMode("edit")
        onDriveUpdated?.(nextDrive)
      } catch (error) {
        setDatabaseError(error instanceof Error ? error.message : "Unable to save this stop.")
      } finally {
        setIsSavingStop(false)
      }
    },
    [data, draft, draftMode, onDriveUpdated, passengerLookup, syncStopPickupPassengers, drive]
  )

  return {
    columnVisibility,
    dataIds,
    databaseError,
    deletingStopId,
    displayData,
    draft,
    finalArrivalTime,
    handleDelete,
    handleDeleteSelected,
    handleDraftSubmit,
    handleDragEnd,
    handlePlanReady,
    handleSheetOpenChange,
    hasPendingChanges,
    isConfirmingChanges,
    isAutoCalculatingStopTime,
    isDeletingSelectedStops,
    isSavingStop,
    isStopDurationColumnVisible,
    isTrafficBufferColumnVisible,
    openCreateStopEditor,
    onConfirmChanges: confirmPendingChanges,
    handleDraftPickupTimeChange,
    handleDraftStopPickupPassengersChange,
    lastSelectedRowIdRef,
    openEditor,
    passengerCount,
    passengerLookup,
    pendingSummary,
    pendingUpdates,
    positionChanges,
    routeError,
    routeTones,
    rowSelection,
    setColumnVisibility,
    setDraft,
    setRouteError,
    setRowSelection,
    setSorting,
    setTimingAdjustmentsOpen,
    sheetOpen,
    showOptimizedGradient,
    sorting,
    stopCount,
    timingAdjustmentsOpen,
    updateStopRow,
    draftMode,
  }
}
