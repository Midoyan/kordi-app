"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import type { StopPickupPassengerOption } from "@/lib/drive-plan"
import { cn } from "@/lib/utils"
import {
  getStopPickupPassengerNames,
  parseTimingInputValue,
} from "@/components/schedule-section/helpers"
import { StopPickupPassengerCombobox } from "@/components/schedule-section/table-parts"
import type { DriveStopRow } from "@/components/schedule-section/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type ScheduleStopEditorSheetProps = {
  open: boolean
  driveLabel: string
  draft: DriveStopRow | null
  passengerLookup: Map<string, StopPickupPassengerOption>
  stopPickupPassengerOptions: StopPickupPassengerOption[]
  timingAdjustmentsOpen: boolean
  isSavingStop: boolean
  isDeletingSelectedStops: boolean
  deletingStopId: string | null
  setDraft: React.Dispatch<React.SetStateAction<DriveStopRow | null>>
  setTimingAdjustmentsOpen: React.Dispatch<React.SetStateAction<boolean>>
  onOpenChange: (open: boolean) => void
  onDelete: (item: DriveStopRow) => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
}

export function ScheduleStopEditorSheet({
  open,
  driveLabel,
  draft,
  passengerLookup,
  stopPickupPassengerOptions,
  timingAdjustmentsOpen,
  isSavingStop,
  isDeletingSelectedStops,
  deletingStopId,
  setDraft,
  setTimingAdjustmentsOpen,
  onOpenChange,
  onDelete,
  onSubmit,
}: ScheduleStopEditorSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-l border-[#ecece8] bg-white sm:max-w-xl">
        <SheetHeader className="gap-1 border-b border-[#ecece8] px-6 py-5">
          <SheetTitle>
            {draft
              ? `${getStopPickupPassengerNames(draft.stopPickupPassengerIds, passengerLookup).length} passenger${getStopPickupPassengerNames(draft.stopPickupPassengerIds, passengerLookup).length === 1 ? "" : "s"}`
              : "Stop details"}
          </SheetTitle>
          <SheetDescription>
            Edit the selected stop in {driveLabel} without leaving the schedule table.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-[#ecece8] bg-[#fbfbf8] p-4">
            <p className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
              Stop snapshot
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                <p className="text-[11px] text-[#777772] uppercase">Pickup</p>
                <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                  {draft?.pickupTime || "--:--"}
                </p>
              </div>
              <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                <p className="text-[11px] text-[#777772] uppercase">Arrival</p>
                <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                  {draft?.arrival || "--:--"}
                </p>
              </div>
              <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                <p className="text-[11px] text-[#777772] uppercase">Destination</p>
                <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                  {draft?.endDestination || "--"}
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-[#ecece8]" />

          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-medium text-[#1d1d1b]">
                Stop pickup passengers
              </label>
              <StopPickupPassengerCombobox
                value={draft?.stopPickupPassengerIds ?? []}
                onValueChange={(stopPickupPassengerIds) =>
                  setDraft((current) =>
                    current ? { ...current, stopPickupPassengerIds } : current
                  )
                }
                stopPickupPassengerOptions={stopPickupPassengerOptions}
                passengerLookup={passengerLookup}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="schedule-pickup-address" className="text-[13px] font-medium text-[#1d1d1b]">
                Pickup Address
              </label>
              <Input
                id="schedule-pickup-address"
                value={draft?.pickupAddress ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, pickupAddress: event.target.value } : current
                  )
                }
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="schedule-pickup-time" className="text-[13px] font-medium text-[#1d1d1b]">
                  PU Time
                </label>
                <Input
                  id="schedule-pickup-time"
                  value={draft?.pickupTime ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, pickupTime: event.target.value } : current
                    )
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="schedule-arrival" className="text-[13px] font-medium text-[#1d1d1b]">
                  Arrival
                </label>
                <Input
                  id="schedule-arrival"
                  value={draft?.arrival ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, arrival: event.target.value } : current
                    )
                  }
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="schedule-end-destination" className="text-[13px] font-medium text-[#1d1d1b]">
                Drop off
              </label>
              <Input
                id="schedule-end-destination"
                value={draft?.endDestination ?? ""}
                onChange={(event) =>
                  setDraft((current) =>
                    current ? { ...current, endDestination: event.target.value } : current
                  )
                }
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-[#ecece8] bg-[#fbfbf8]">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setTimingAdjustmentsOpen((current) => !current)}
              >
                <div>
                  <p className="text-[13px] font-medium text-[#1d1d1b]">Timing adjustments</p>
                  <p className="mt-1 text-[12px] text-[#6b6b67]">
                    Optional per-stop timing inputs for longer pickups or extra traffic slack.
                  </p>
                </div>
                <ChevronRight
                  className={cn(
                    "size-4 text-[#6b6b67] transition-transform",
                    timingAdjustmentsOpen && "rotate-90"
                  )}
                />
              </button>
              {timingAdjustmentsOpen ? (
                <div className="grid gap-4 border-t border-[#ecece8] px-4 py-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="schedule-stop-duration" className="text-[13px] font-medium text-[#1d1d1b]">
                      Stop duration (sec)
                    </label>
                    <Input
                      id="schedule-stop-duration"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={draft?.stopDurationSec ?? ""}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                stopDurationSec: parseTimingInputValue(event.target.value),
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="schedule-traffic-buffer" className="text-[13px] font-medium text-[#1d1d1b]">
                      Traffic buffer (sec)
                    </label>
                    <Input
                      id="schedule-traffic-buffer"
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={draft?.trafficBufferSec ?? ""}
                      onChange={(event) =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                trafficBufferSec: parseTimingInputValue(event.target.value),
                              }
                            : current
                        )
                      }
                    />
                  </div>
                  <p className="text-[11px] leading-5 text-[#777772] sm:col-span-2">
                    Leave blank or set 0 to ignore these adjustments.
                  </p>
                </div>
              ) : null}
            </div>

            <SheetFooter className="px-0 pt-2">
              <div className="flex w-full items-center justify-between gap-2">
                {draft ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                    disabled={
                      isSavingStop ||
                      isDeletingSelectedStops ||
                      deletingStopId === draft.id
                    }
                    onClick={() => {
                      onDelete(draft)
                    }}
                  >
                    {deletingStopId === draft.id ? "Deleting..." : "Delete stop"}
                  </Button>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={
                      isSavingStop ||
                      isDeletingSelectedStops ||
                      (draft ? deletingStopId === draft.id : false)
                    }
                  >
                    Done
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isSavingStop ||
                      isDeletingSelectedStops ||
                      (draft ? deletingStopId === draft.id : false)
                    }
                  >
                    {isSavingStop ? "Saving…" : "Save stop"}
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}
