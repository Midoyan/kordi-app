import type { ReactNode } from "react"
import type { VisibilityState } from "@tanstack/react-table"

import type { Drive, StopPickupPassengerOption } from "@/lib/drive-plan"

export type DriveStopRow = {
  id: string
  driveId: string
  stopTitle: string
  pickupAddress: string
  pickupTime: string
  pickupTimeSource: string | null
  endDestination: string
  arrival: string
  isFavorite: boolean
  notes: string
  createdAt: string
  stopDurationSec: number | null
  trafficBufferSec: number | null
  stopPickupPassengerIds: string[]
}

export type ScheduleStopDraftMode = "create" | "edit"

export type PendingDriveStopUpdate = {
  pickupTime: string
  arrival: string
  revealOrder: number
  animationToken: number
}

export type PositionChange = {
  from: number
  to: number
}

export type RouteTone = {
  rail: string
  wash: string
}

export type ScheduleSectionProps = {
  drive: Drive
  stopPickupPassengerOptions: StopPickupPassengerOption[]
  onDriveUpdated?: (drive: Drive) => void
  renderHeaderLeading?: (context: { finalArrivalTime: string }) => ReactNode
  renderHeaderActions?: (context: { finalArrivalTime: string }) => ReactNode
  renderFooter?: (context: { finalArrivalTime: string }) => ReactNode
}

export const defaultColumnVisibility: VisibilityState = {
  stopDurationSec: false,
  trafficBufferSec: false,
}
