"use client"

import * as React from "react"
import {
  PencilLine,
  Plus,
} from "lucide-react"

import { DriveEditorSheet } from "@/components/drive-editor-sheet"
import { ScheduleSection } from "@/components/schedule-section"
import {
  getDriveCardKey,
  useDriveEditorState,
} from "@/components/schedule-view/use-drive-editor"
import { useTransportPlanState } from "@/components/schedule-view/use-transport-plan"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

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
  const {
    transportPlan,
    isLoading,
    error,
    retryLoad,
    refreshTransportPlan,
    handleDriveUpdated,
  } = useTransportPlanState()
  const drives = transportPlan?.drives ?? []
  const stopPickupPassengerOptions = transportPlan?.stopPickupPassengerOptions ?? []
  const {
    activeDrive,
    driveDraft,
    driveEditorMode,
    driveError,
    deletingDriveId,
    isSavingDrive,
    labelPreview,
    openCreateDrive,
    openEditDrive,
    closeDriveEditor,
    handleDriveSave,
    handleDriveDelete,
    setDriveDraft,
  } = useDriveEditorState({
    drives,
    refreshTransportPlan,
  })

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
                onClick={retryLoad}
              >
                Retry
              </Button>
            </div>
          </div>
        </SchedulePanel>
      </div>
    )
  }

  const driveCount = drives.length
  const totalStopCount = drives.reduce((count, drive) => count + drive.stops.length, 0)

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
            {drives.map((drive) => {
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

                    <div className="flex flex-wrap items-center justify-start gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-[#d8ddd1] bg-white/92 px-3 text-[#1d1d1b] hover:bg-[#f4f7ef]"
                        onClick={() => openEditDrive(drive)}
                        disabled={deletingDriveId === drive.id}
                      >
                        <PencilLine className="size-4" />
                        Drive settings
                      </Button>
                    </div>
                  </div>
                  <ScheduleSection
                    drive={drive}
                    stopPickupPassengerOptions={stopPickupPassengerOptions}
                    onDriveUpdated={handleDriveUpdated}
                    showDriveSummary={false}
                    renderHeaderLeading={({ finalArrivalTime }) => (
                      <>
                        <div className="inline-flex min-w-0 items-center gap-0">
                          <span className="text-[12px] font-semibold text-[#75816f]">
                            Drive to
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="kordi-inline-button"
                            onClick={() => openEditDrive(drive)}
                          >
                            <span className="truncate">
                              {drive.destinationAddress || "Set destination"}
                            </span>
                          </Button>
                          <span className="text-[12px] font-semibold text-[#75816f]">
                            arrive by
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            className="kordi-inline-button"
                            onClick={() => openEditDrive(drive)}
                          >
                            <span className="truncate">
                              {finalArrivalTime || "Unset"}
                            </span>
                          </Button>
                        </div>
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
        isDeleting={activeDrive !== null && deletingDriveId === activeDrive.id}
        onClose={closeDriveEditor}
        onDelete={
          activeDrive
            ? () => {
                void handleDriveDelete(activeDrive)
              }
            : undefined
        }
        onSave={handleDriveSave}
        setDraft={setDriveDraft}
      />
    </>
  )
}
