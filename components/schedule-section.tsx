"use client"

import * as React from "react"
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table"
import {
  Plus,
  Star,
  Trash2,
} from "lucide-react"

import { getTravelTypeLabel } from "@/lib/travels"
import { cn } from "@/lib/utils"
import {
  buildAdvancedTimingCaption,
  getStopPickupPassengerNames,
  shouldIgnoreRowSelectionTarget,
} from "@/components/schedule-section/helpers"
import { ScheduleStopEditorSheet } from "@/components/schedule-section/stop-editor-sheet"
import {
  AnimatedScheduleTime,
  PassengerSummary,
  ScheduleDurationCell,
  SortableHeader,
  SortableRow,
  StackedAddressText,
} from "@/components/schedule-section/table-parts"
import type {
  DriveStopRow,
  ScheduleSectionProps,
} from "@/components/schedule-section/types"
import { useScheduleSectionState } from "@/components/schedule-section/use-schedule-section-state"
import { ScheduleRoutingControls } from "@/components/schedule-routing-controls"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  WorkspaceColumnToggleMenu,
  WorkspaceDataTable,
} from "@/components/workspace-data-table"

export function ScheduleSection({
  drive,
  stopPickupPassengerOptions,
  onDriveUpdated,
  renderHeaderLeading,
  renderHeaderActions,
  renderFooter,
}: ScheduleSectionProps) {
  const travelTypeLabel = getTravelTypeLabel(drive.travelType)
  const stopAddressColumnLabel = drive.travelType === "pickup" ? "Pickup Address" : "Stop Address"
  const stopTimeColumnLabel = drive.travelType === "pickup" ? "PU Time" : "Stop time"
  const scheduleTimeColumnLabel = drive.travelType === "pickup" ? "Arrive by" : "Depart at"
  const commonLocationLabel =
    drive.location?.address || drive.location?.name || drive.destinationAddress || drive.startLocation
  const supportsRoutePlanning = drive.travelType === "pickup"
  const showDefaultDriveSummary = !renderHeaderLeading

  const {
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
    handleDraftPickupTimeChange,
    handleDraftStopPickupPassengersChange,
    handleSheetOpenChange,
    hasPendingChanges,
    isAutoCalculatingStopTime,
    isConfirmingChanges,
    isDeletingSelectedStops,
    isSavingStop,
    isStopDurationColumnVisible,
    isTrafficBufferColumnVisible,
    openCreateStopEditor,
    onConfirmChanges,
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
  } = useScheduleSectionState({
    drive,
    stopPickupPassengerOptions,
    onDriveUpdated,
  })

  const columns = React.useMemo<ColumnDef<DriveStopRow>[]>(
    () => [
      {
        id: "drag",
        header: () => <span className="sr-only">Order</span>,
        enableSorting: false,
        enableHiding: false,
        cell: () => null,
      },
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllRowsSelected() ||
                (table.getIsSomeRowsSelected() ? "indeterminate" : false)
              }
              onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
              aria-label="Select all rows"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
              aria-label={`Select ${getStopPickupPassengerNames(row.original.stopPickupPassengerIds, passengerLookup).join(", ")}`}
            />
          </div>
        ),
      },
      {
        accessorKey: "stopPickupPassengerIds",
        meta: { label: "Passengers" },
        enableSorting: false,
        enableHiding: false,
        header: ({ column }) => (
          <SortableHeader
            label="Passengers"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => openEditor(row.original)}
            className="flex flex-col items-start gap-1 text-left text-[13px] font-medium text-[#1d1d1b] transition-colors hover:text-[#4f6bbd]"
          >
            <span className="flex items-center gap-2">
              <PassengerSummary
                stopPickupPassengerIds={row.original.stopPickupPassengerIds}
                passengerLookup={passengerLookup}
              />
              {row.original.isFavorite ? (
                <Star className="size-3.5 fill-[#b2952f] text-[#b2952f]" />
              ) : null}
            </span>
            {positionChanges[row.original.id] ? (
              <span className="inline-flex items-center rounded-full border border-[#d5dce9] bg-[#f4f7fb] px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-[#5d6b83] uppercase">
                {positionChanges[row.original.id].from} → {positionChanges[row.original.id].to}
              </span>
            ) : null}
          </button>
        ),
      },
      {
        accessorKey: "pickupAddress",
        meta: { label: stopAddressColumnLabel },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label={stopAddressColumnLabel}
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <StackedAddressText value={row.original.pickupAddress} />,
      },
      {
        accessorKey: "pickupTime",
        meta: { label: stopTimeColumnLabel },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label={stopTimeColumnLabel}
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const pendingUpdate = pendingUpdates[row.original.id]
          const timingCaption = buildAdvancedTimingCaption(row.original, {
            showStopDuration: isStopDurationColumnVisible,
            showTrafficBuffer: isTrafficBufferColumnVisible,
          })

          return (
            <div className="flex flex-col gap-1">
              <AnimatedScheduleTime
                confirmedValue={row.original.pickupTime}
                pendingValue={pendingUpdate?.pickupTime}
                revealOrder={pendingUpdate?.revealOrder}
                animationToken={pendingUpdate?.animationToken}
              />
              {timingCaption ? (
                <span className="text-[11px] leading-4 text-[#7a7a74]">
                  {timingCaption}
                </span>
              ) : null}
            </div>
          )
        },
      },
      {
        accessorKey: "stopDurationSec",
        meta: { label: "Boarding time" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Boarding time"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <ScheduleDurationCell value={row.original.stopDurationSec} />,
      },
      {
        accessorKey: "trafficBufferSec",
        meta: { label: "Traffic buffer" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Traffic buffer"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <ScheduleDurationCell value={row.original.trafficBufferSec} />,
      },
      {
        accessorKey: "endDestination",
        meta: { label: "Set location" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Set location"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <StackedAddressText value={row.original.endDestination} muted />
        ),
      },
      {
        accessorKey: "arrival",
        meta: { label: scheduleTimeColumnLabel },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label={scheduleTimeColumnLabel}
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const pendingUpdate = pendingUpdates[row.original.id]

          return (
            <AnimatedScheduleTime
              confirmedValue={row.original.arrival}
              pendingValue={pendingUpdate?.arrival}
              revealOrder={pendingUpdate?.revealOrder}
              animationToken={pendingUpdate?.animationToken}
            />
          )
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: () => null,
      },
    ],
    [
      isStopDurationColumnVisible,
      isTrafficBufferColumnVisible,
      openEditor,
      passengerLookup,
      pendingUpdates,
      positionChanges,
      scheduleTimeColumnLabel,
      stopAddressColumnLabel,
      stopTimeColumnLabel,
    ]
  )

  const table = useReactTable({
    data: displayData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedStopCount = selectedRows.length
  const visibleColumns = table.getAllColumns().filter((column) => column.getCanHide())

  const handleRowClick = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<DriveStopRow>) => {
      if (shouldIgnoreRowSelectionTarget(event.target)) {
        return
      }

      const visibleRows = table.getRowModel().rows
      const clickedRowId = row.id
      const clickedIndex = visibleRows.findIndex((entry) => entry.id === clickedRowId)

      if (clickedIndex === -1) {
        return
      }

      if (event.shiftKey && lastSelectedRowIdRef.current) {
        const anchorIndex = visibleRows.findIndex(
          (entry) => entry.id === lastSelectedRowIdRef.current
        )

        if (anchorIndex !== -1) {
          const start = Math.min(anchorIndex, clickedIndex)
          const end = Math.max(anchorIndex, clickedIndex)

          setRowSelection((current) => {
            const next = event.metaKey || event.ctrlKey ? { ...current } : {}

            for (const entry of visibleRows.slice(start, end + 1)) {
              next[entry.id] = true
            }

            return next
          })

          lastSelectedRowIdRef.current = clickedRowId
          return
        }
      }

      if (event.metaKey || event.ctrlKey) {
        setRowSelection((current) => {
          const next = { ...current }

          if (next[clickedRowId]) {
            delete next[clickedRowId]
          } else {
            next[clickedRowId] = true
          }

          return next
        })
        lastSelectedRowIdRef.current = clickedRowId
        return
      }

      setRowSelection({ [clickedRowId]: true })
      lastSelectedRowIdRef.current = clickedRowId
    },
    [lastSelectedRowIdRef, setRowSelection, table]
  )

  return (
    <>
      <div className="space-y-4">
        <WorkspaceDataTable
          table={table}
          dataIds={dataIds}
          sortable
          onDragEnd={handleDragEnd}
          toolbar={(
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {showDefaultDriveSummary ? (
                  <div>
                    <p className="text-[18px] font-semibold text-[#1d1d1b]">{drive.label}</p>
                    <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
                      {stopCount} stop{stopCount === 1 ? "" : "s"} and {passengerCount} passenger
                      {passengerCount === 1 ? "" : "s"} on this {travelTypeLabel.toLowerCase()} drive.
                      {commonLocationLabel ? ` Set location: ${commonLocationLabel}.` : ""}
                    </p>
                  </div>
                ) : null}
                {renderHeaderLeading ? renderHeaderLeading({ finalArrivalTime }) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {renderHeaderActions ? renderHeaderActions({ finalArrivalTime }) : null}
                {supportsRoutePlanning ? (
                  <ScheduleRoutingControls
                    stops={displayData.map((item) => ({
                      id: item.id,
                      pickupAddress: item.pickupAddress,
                      endDestination: item.endDestination,
                      stopDurationSec: item.stopDurationSec,
                      trafficBufferSec: item.trafficBufferSec,
                    }))}
                    arrivalTime={finalArrivalTime}
                    hasPendingChanges={hasPendingChanges}
                    onConfirmChanges={() => {
                      void onConfirmChanges()
                    }}
                    onErrorChange={setRouteError}
                    onPlanReady={handlePlanReady}
                  />
                ) : (
                  <span className="rounded-full border border-[#dde3d4] bg-[#f7faf2] px-3 py-1.5 text-[11px] font-medium text-[#51614f]">
                    Dropoff routing stays manual for now
                  </span>
                )}
                <WorkspaceColumnToggleMenu columns={visibleColumns} showLabel={false} />

                {selectedStopCount > 0 ? (


                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    disabled={
                      selectedStopCount === 0 ||
                      isSavingStop ||
                      isDeletingSelectedStops ||
                      deletingStopId !== null
                    }
                    onClick={() => {
                      void handleDeleteSelected(selectedRows.map((row) => row.original.id))
                    }}
                  >
                    <Trash2 className="size-4" />
                    {isDeletingSelectedStops
                      ? "Deleting..."
                      : selectedStopCount > 0
                        ? `Delete ${selectedStopCount}`
                        : "Delete"}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-[#dbdbd6] bg-[#fafaf7] text-[#1d1d1b] hover:bg-[#f1f1ed]"
                  disabled={
                    isSavingStop ||
                    isDeletingSelectedStops ||
                    deletingStopId !== null ||
                    hasPendingChanges
                  }
                  onClick={openCreateStopEditor}
                >
                  <Plus className="size-4" />
                  <span className="hidden lg:inline">Add Stop</span>
                  <span className="lg:hidden">Add</span>
                </Button>
              </div>
            </div>
          )}
          containerClassName="overflow-x-auto"
          tableClassName="min-w-[1120px] table-fixed"
          headerClassName="bg-[#f7f7f4]"
          headerRowClassName="border-[#ecece8] hover:bg-transparent"
          getHeadClassName={(columnId) =>
            cn(
              "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-3 align-middle",
              columnId === "drag" && "w-10",
              columnId === "select" && "w-11",
              columnId === "stopPickupPassengerIds" && "w-[18%]",
              columnId === "pickupAddress" && "w-[22%]",
              columnId === "pickupTime" && "w-[13%]",
              columnId === "stopDurationSec" && "w-[10%]",
              columnId === "trafficBufferSec" && "w-[10%]",
              columnId === "endDestination" && "w-[18%]",
              columnId === "arrival" && "w-[9%]",
              columnId === "actions" && "w-14"
            )
          }
          emptyState={(
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={table.getVisibleLeafColumns().length}
                className="py-14 text-center text-[13px] text-[#6b6b67]"
              >
                No stops yet.
              </TableCell>
            </TableRow>
          )}
          renderRow={(row) => (
            <SortableRow
              key={row.id}
              row={row}
              pendingUpdate={pendingUpdates[row.original.id]}
              routeTone={routeTones[row.original.id]}
              showRouteTone={showOptimizedGradient}
              onOpenEditor={openEditor}
              onFavorite={(item) =>
                updateStopRow(item.id, "isFavorite", !item.isFavorite)
              }
              onDelete={(item) => {
                void handleDelete(item)
              }}
              onClearSorting={() => {
                if (sorting.length > 0) {
                  setSorting([])
                }
              }}
              onRowClick={handleRowClick}
            />
          )}
        />

        {hasPendingChanges ? (
          <div className="flex flex-col gap-2 rounded-lg border border-[#dfe7f4] bg-[linear-gradient(180deg,#f8fbff_0%,#f1f6ff_100%)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-[12px] leading-5 text-[#49628d]">
              {pendingSummary}
            </p>
            {isConfirmingChanges ? (
              <p className="text-[12px] font-medium text-[#49628d]">Saving…</p>
            ) : null}
          </div>
        ) : null}

        {routeError ? (
          <div className="rounded-lg border border-[#f3d7d7] bg-[#fff7f7] px-4 py-3">
            <p className="text-[12px] leading-5 text-[#9a4f4f]">{routeError}</p>
          </div>
        ) : null}

        {databaseError ? (
          <div className="rounded-lg border border-[#f3d7d7] bg-[#fff7f7] px-4 py-3">
            <p className="text-[12px] leading-5 text-[#9a4f4f]">{databaseError}</p>
          </div>
        ) : null}

        {renderFooter ? (
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex-1" />
            <div className="min-w-0">
              {renderFooter({ finalArrivalTime })}
            </div>
          </div>
        ) : null}
      </div>

      <ScheduleStopEditorSheet
        open={sheetOpen}
        driveLabel={drive.label}
        travelType={drive.travelType}
        draft={draft}
        draftMode={draftMode}
        handleDraftPickupTimeChange={handleDraftPickupTimeChange}
        handleDraftStopPickupPassengersChange={handleDraftStopPickupPassengersChange}
        passengerLookup={passengerLookup}
        stopPickupPassengerOptions={stopPickupPassengerOptions}
        timingAdjustmentsOpen={timingAdjustmentsOpen}
        isAutoCalculatingStopTime={isAutoCalculatingStopTime}
        isSavingStop={isSavingStop}
        isDeletingSelectedStops={isDeletingSelectedStops}
        deletingStopId={deletingStopId}
        setDraft={setDraft}
        setTimingAdjustmentsOpen={setTimingAdjustmentsOpen}
        onOpenChange={handleSheetOpenChange}
        onDelete={(item) => {
          void handleDelete(item)
        }}
        onSubmit={handleDraftSubmit}
      />
    </>
  )
}
