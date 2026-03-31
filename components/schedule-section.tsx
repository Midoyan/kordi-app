"use client"

import * as React from "react"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import { restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Star,
  Trash2,
} from "lucide-react"

import type {
  Drive,
  StopPickupPassengerOption,
} from "@/lib/drive-plan"
import {
  parseTimeString,
  type RecalculatedScheduleStop,
} from "@/lib/schedule-recalculation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { ScheduleRoutingControls } from "@/components/schedule-routing-controls"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DriveStopRow = {
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

type PendingDriveStopUpdate = {
  pickupTime: string
  arrival: string
  revealOrder: number
  animationToken: number
}

type PositionChange = {
  from: number
  to: number
}

type RouteTone = {
  rail: string
  wash: string
}

type ScheduleSectionProps = {
  drive: Drive
  stopPickupPassengerOptions: StopPickupPassengerOption[]
  onDriveUpdated?: (drive: Drive) => void
}

const defaultColumnVisibility: VisibilityState = {
  stopDurationSec: false,
  trafficBufferSec: false,
}

function buildInitialArrivalValue(drive: Drive) {
  return drive.stops[drive.stops.length - 1]?.pickupTimeLabel || drive.startTimeLabel || ""
}

function normalizeTimingSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 0
  }

  return Math.round(value)
}

function normalizePersistedTimingSeconds(value: number | null | undefined) {
  const normalized = normalizeTimingSeconds(value)
  return normalized > 0 ? normalized : null
}

function parseTimingInputValue(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return null
  }

  return parsed <= 0 ? 0 : Math.round(parsed)
}

function formatDurationSeconds(value: number | null | undefined) {
  const totalSeconds = normalizeTimingSeconds(value)

  if (totalSeconds === 0) {
    return "0s"
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []

  if (hours > 0) {
    parts.push(`${hours}h`)
  }

  if (minutes > 0) {
    parts.push(`${minutes}m`)
  }

  if (seconds > 0) {
    parts.push(`${seconds}s`)
  }

  return parts.join(" ")
}

function hasAdvancedTimingValue(stop: Pick<DriveStopRow, "stopDurationSec" | "trafficBufferSec">) {
  return (
    normalizeTimingSeconds(stop.stopDurationSec) > 0 ||
    normalizeTimingSeconds(stop.trafficBufferSec) > 0
  )
}

function buildAdvancedTimingCaption(
  stop: Pick<DriveStopRow, "stopDurationSec" | "trafficBufferSec">,
  {
    showStopDuration,
    showTrafficBuffer,
  }: {
    showStopDuration: boolean
    showTrafficBuffer: boolean
  }
) {
  const parts: string[] = []

  if (!showStopDuration && normalizeTimingSeconds(stop.stopDurationSec) > 0) {
    parts.push(`+${formatDurationSeconds(stop.stopDurationSec)} stop`)
  }

  if (!showTrafficBuffer && normalizeTimingSeconds(stop.trafficBufferSec) > 0) {
    parts.push(`+${formatDurationSeconds(stop.trafficBufferSec)} traffic`)
  }

  return parts.length > 0 ? parts.join(" • ") : null
}

function buildInitialStopRows(drive: Drive) {
  const initialArrival = buildInitialArrivalValue(drive)

  return drive.stops.map((stop) => ({
    id: stop.id,
    driveId: drive.id,
    stopTitle: stop.stopTitle,
    pickupAddress: stop.pickupAddress,
    pickupTime: stop.pickupTimeLabel,
    pickupTimeSource: stop.pickupTime,
    endDestination: drive.destinationAddress,
    arrival: initialArrival,
    isFavorite: false,
    notes: stop.notes ?? "",
    createdAt: stop.createdAt,
    stopDurationSec: stop.stopDurationSec,
    trafficBufferSec: stop.trafficBufferSec,
    stopPickupPassengerIds: stop.stopPickupPassengers.map((passenger) => passenger.id),
  }))
}

function buildDriveFromStopRows(
  drive: Drive,
  rows: DriveStopRow[],
  passengerLookup: Map<string, StopPickupPassengerOption>
): Drive {
  const destinationAddress =
    rows[0]?.endDestination.trim() || drive.destinationAddress

  return {
    ...drive,
    destinationAddress,
    stops: rows.map((row) => ({
      id: row.id,
      driveId: drive.id,
      stopTitle: row.stopTitle,
      pickupAddress: row.pickupAddress,
      pickupTime: row.pickupTimeSource,
      pickupTimeLabel: row.pickupTime,
      stopDurationSec: normalizePersistedTimingSeconds(row.stopDurationSec),
      trafficBufferSec: normalizePersistedTimingSeconds(row.trafficBufferSec),
      notes: row.notes.trim() || null,
      createdAt: row.createdAt,
      stopPickupPassengers: row.stopPickupPassengerIds.map((passengerId) => {
        const passenger = passengerLookup.get(passengerId)

        return passenger
          ? {
              id: passenger.id,
              name: passenger.name,
              phone: passenger.phone,
              address: passenger.address,
            }
          : {
              id: passengerId,
              name: passengerId,
              phone: null,
              address: "",
            }
      }),
    })),
  }
}

function toDatabaseTimeValue(value: string, source: string | null) {
  const parsed = parseTimeString(value)

  if (!parsed) {
    return source ?? value.trim()
  }

  const hours = parsed.hours.toString().padStart(2, "0")
  const minutes = parsed.minutes.toString().padStart(2, "0")
  const match = source?.match(/^\d{2}:\d{2}(:\d{2})?(.*)$/)
  const seconds = match?.[1] ?? ":00"
  const suffix = match?.[2] ?? ""

  return `${hours}:${minutes}${seconds}${suffix}`
}

async function parseMutationResponse<T>(
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

function orderDriveStops(items: DriveStopRow[], orderIds: string[]) {
  const itemById = new Map(items.map((item) => [item.id, item]))

  return orderIds
    .map((id) => itemById.get(id))
    .filter((item): item is DriveStopRow => Boolean(item))
}

function areOrdersEqual(first: string[], second: string[]) {
  if (first.length !== second.length) {
    return false
  }

  return first.every((id, index) => id === second[index])
}

function buildRouteTone(index: number, total: number): RouteTone {
  const denominator = Math.max(total - 1, 1)
  const progress = index / denominator
  const lightness = 84 - progress * 24

  return {
    rail: `hsl(214 44% ${Math.round(lightness)}%)`,
    wash: `hsl(214 48% ${Math.round(lightness + 8)}% / 0.24)`,
  }
}

function splitAddressLabel(value: string) {
  const [primaryPart, ...secondaryParts] = value.split(",")

  return {
    primary: primaryPart?.trim() ?? value,
    secondary: secondaryParts.join(",").trim(),
  }
}

function StackedAddressText({
  value,
  muted = false,
}: {
  value: string
  muted?: boolean
}) {
  const { primary, secondary } = splitAddressLabel(value)

  return (
    <span className="block min-w-0">
      <span className={cn("block truncate text-[#000000]", muted && "text-[#5f5f59]")}>
        {primary}
      </span>
      {secondary ? (
        <span className="mt-0 block truncate text-[11px] leading-4 text-[#5b5b55]">
          {secondary}
        </span>
      ) : null}
    </span>
  )
}

function getStopPickupPassengerNames(
  stopPickupPassengerIds: string[],
  passengerLookup: Map<string, StopPickupPassengerOption>
) {
  return stopPickupPassengerIds
    .map((id) => passengerLookup.get(id)?.name ?? id)
    .filter(Boolean)
}

function abbreviatePassengerName(fullName: string) {
  const parts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length <= 1) {
    return fullName
  }

  const [firstName, ...rest] = parts
  const abbreviatedRest = rest.map((part) => `${part[0]?.toLowerCase() ?? ""}.`)

  if (abbreviatedRest.length === 0) {
    return firstName
  }

  const lastIndex = abbreviatedRest.length - 1
  abbreviatedRest[lastIndex] = abbreviatedRest[lastIndex].toUpperCase()

  return [firstName, ...abbreviatedRest].join(" ")
}

function PassengerSummary({
  stopPickupPassengerIds,
  passengerLookup,
}: {
  stopPickupPassengerIds: string[]
  passengerLookup: Map<string, StopPickupPassengerOption>
}) {
  const names = getStopPickupPassengerNames(stopPickupPassengerIds, passengerLookup)
  const abbreviatedNames =
    names.length > 2 ? names.map((name) => abbreviatePassengerName(name)) : names
  const displayLabel = abbreviatedNames.join(", ")

  if (names.length <= 2) {
    return (
      <span className="block whitespace-normal break-words leading-5 text-[#1d1d1b] line-clamp-2">
        {displayLabel || "No passengers"}
      </span>
    )
  }

  return (
    <HoverCard>
      <HoverCardTrigger>
        <span className="block cursor-default whitespace-normal break-words leading-5 text-[#1d1d1b] line-clamp-2">
          {displayLabel}
        </span>
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-72 rounded-xl border border-[#e3e3df] bg-white p-3 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
      >
        <p className="text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
          Full Passenger List
        </p>
        <div className="mt-3 space-y-2">
          {stopPickupPassengerIds.map((id) => {
            const passenger = passengerLookup.get(id)

            if (!passenger) {
              return null
            }

            return (
              <div
                key={passenger.id}
                className="rounded-lg border border-[#ecece8] bg-[#fafaf7] px-3 py-2"
              >
                <p className="text-[13px] font-medium text-[#1d1d1b]">
                  {passenger.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">{passenger.detail}</p>
              </div>
            )
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function StopPickupPassengerCombobox({
  value,
  onValueChange,
  stopPickupPassengerOptions,
  passengerLookup,
}: {
  value: string[]
  onValueChange: (value: string[]) => void
  stopPickupPassengerOptions: StopPickupPassengerOption[]
  passengerLookup: Map<string, StopPickupPassengerOption>
}) {
  const anchorRef = useComboboxAnchor()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const selectedPeople = value
    .map((id) => passengerLookup.get(id))
    .filter((person): person is StopPickupPassengerOption => Boolean(person))

  return (
    <Combobox
      multiple
      open={open}
      onOpenChange={setOpen}
      value={value}
      onValueChange={(nextValue) => {
        onValueChange(Array.from(new Set(nextValue)))
        setQuery("")
        setOpen(false)
      }}
      itemToStringLabel={(personId) => {
        const person = passengerLookup.get(personId)
        return person ? `${person.name} ${person.detail} ${person.address}` : personId
      }}
    >
      <ComboboxChips
        ref={anchorRef}
        className="min-h-8 gap-1 rounded-lg border-[#dcdcd7] bg-white px-2 py-1"
      >
        {selectedPeople.map((person) => (
          <ComboboxChip key={person.id} className="h-5 rounded-sm px-1.5 text-[11px]">
            {person.name}
          </ComboboxChip>
        ))}
        <ComboboxChipsInput
          placeholder={
            selectedPeople.length === 0
              ? "Search passengers to add"
              : "Add another passenger"
          }
          className="min-h-5 text-sm text-[#1d1d1b] placeholder:text-[#8a8a84]"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value
            setQuery(nextQuery)
            setOpen(nextQuery.trim().length > 0)
          }}
          onKeyDown={(event) => {
            if (event.key === "Tab" || event.key === "Escape") {
              setOpen(false)
            }
          }}
        />
      </ComboboxChips>
      <ComboboxContent
        anchor={anchorRef}
        className="border border-[#e3e3df] bg-white shadow-[0_18px_38px_-24px_rgba(15,23,42,0.45)]"
      >
        <ComboboxList>
          <ComboboxEmpty>No matching passengers found.</ComboboxEmpty>
          {stopPickupPassengerOptions.map((person) => (
            <ComboboxItem
              key={person.id}
              value={person.id}
              className="items-start gap-3 px-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                  {person.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">{person.detail}</p>
                <p className="mt-1 truncate text-[11px] text-[#8a8a84]">
                  {person.address}
                </p>
              </div>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

function shouldIgnoreRowSelectionTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(
    target.closest(
      "button, input, select, textarea, a, label, summary, [role='checkbox'], [data-prevent-row-select='true']"
    )
  )
}

function SortableHeader({
  label,
  isSorted,
  onToggle,
}: {
  label: string
  isSorted: false | "asc" | "desc"
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase transition-colors hover:text-[#43433f]"
    >
      <span>{label}</span>
      {isSorted === "asc" ? (
        <ChevronRight className="size-3.5 rotate-[-90deg]" />
      ) : isSorted === "desc" ? (
        <ChevronRight className="size-3.5 rotate-90" />
      ) : null}
    </button>
  )
}

function getColumnToggleLabel(column: Column<DriveStopRow, unknown>) {
  const meta = column.columnDef.meta as { label?: string } | undefined

  if (meta?.label) {
    return meta.label
  }

  return column.id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
}

function ColumnToggleMenu({
  columns,
}: {
  columns: Column<DriveStopRow, unknown>[]
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings2 className="size-4" />
        <span className="hidden lg:inline">Customize Columns</span>
        <span className="lg:hidden">Columns</span>
        <ChevronDown className="size-4" />
      </Button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 min-w-52 rounded-xl border border-[#e3e3df] bg-white p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]">
          {columns.map((column) => (
            <label
              key={column.id}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[13px] text-[#1d1d1b] hover:bg-[#f7f7f4]"
            >
              <span>{getColumnToggleLabel(column)}</span>
              <Checkbox
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => column.toggleVisibility(checked)}
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ActionMenu({
  item,
  onEdit,
  onFavorite,
  onDelete,
}: {
  item: DriveStopRow
  onEdit: () => void
  onFavorite: () => void
  onDelete: () => void
}) {
  const closeMenu = (target: EventTarget | null) => {
    const details = target instanceof HTMLElement ? target.closest("details") : null
    if (details instanceof HTMLDetailsElement) {
      details.open = false
    }
  }

  return (
    <details className="relative">
      <summary className="list-none">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-[#6b6b67] hover:bg-[#f3f3ef] hover:text-[#1d1d1b]"
        >
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open stop actions</span>
        </Button>
      </summary>
      <div className="absolute right-0 z-20 mt-2 min-w-40 rounded-xl border border-[#e3e3df] bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1b] hover:bg-[#f7f7f4]"
          onClick={(event) => {
            onEdit()
            closeMenu(event.currentTarget)
          }}
        >
          <Pencil className="size-3.5" />
          Edit
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1b] hover:bg-[#f7f7f4]"
          onClick={(event) => {
            onFavorite()
            closeMenu(event.currentTarget)
          }}
        >
          <Star className={cn("size-3.5", item.isFavorite && "fill-current")} />
          Favorite
        </button>
        <Separator className="my-1 bg-[#ecece8]" />
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#a54a4a] hover:bg-[#fff4f4]"
          onClick={(event) => {
            onDelete()
            closeMenu(event.currentTarget)
          }}
        >
          <Trash2 className="size-3.5" />
          Delete
        </button>
      </div>
    </details>
  )
}

function DragHandle({
  listeners,
  attributes,
  onPointerDown,
}: {
  listeners: ReturnType<typeof useSortable>["listeners"]
  attributes: ReturnType<typeof useSortable>["attributes"]
  onPointerDown?: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-[#b6b6b0] hover:bg-[#f3f3ef] hover:text-[#7a7a74]"
      onPointerDown={onPointerDown}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="size-4" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  )
}

function AnimatedScheduleTime({
  confirmedValue,
  pendingValue,
  revealOrder,
  animationToken,
}: {
  confirmedValue: string
  pendingValue?: string
  revealOrder?: number
  animationToken?: number
}) {
  if (!pendingValue || pendingValue === confirmedValue) {
    return (
      <span className="font-[450] tabular-nums text-[#1d1d1b]">
        {confirmedValue || "--:--"}
      </span>
    )
  }

  return (
    <span
      key={`${animationToken ?? 0}-${pendingValue}`}
      className="inline-flex min-w-0 items-center gap-2 whitespace-nowrap tabular-nums"
    >
      <span
        className="schedule-time-strike text-[#30302c] line-through decoration-[#b8b4aa]"
        style={{ animationDelay: `${(revealOrder ?? 0) * 120}ms` }}
      >
        {confirmedValue || "--:--"}
      </span>
      <span
        className="schedule-time-reveal inline-flex min-w-[3rem] rounded-md bg-[#ecf3ff] px-.5 py-0.5 text-[12.5px] font-semibold text-[#335f9f] shadow-[inset_0_0_0_1px_rgba(79,107,189,0.12)]"
        style={{ animationDelay: `${(revealOrder ?? 0) * 120}ms` }}
      >
        {pendingValue}
      </span>
    </span>
  )
}

function SortableRow({
  row,
  onOpenEditor,
  onFavorite,
  onDelete,
  onClearSorting,
  onRowClick,
  pendingUpdate,
  routeTone,
  showRouteTone,
}: {
  row: Row<DriveStopRow>
  onOpenEditor: (item: DriveStopRow) => void
  onFavorite: (item: DriveStopRow) => void
  onDelete: (item: DriveStopRow) => void
  onClearSorting: () => void
  onRowClick: (event: React.MouseEvent<HTMLTableRowElement>, row: Row<DriveStopRow>) => void
  pendingUpdate?: PendingDriveStopUpdate
  routeTone?: RouteTone
  showRouteTone?: boolean
}) {
  const { transform, transition, setNodeRef, isDragging, attributes, listeners } =
    useSortable({
      id: row.original.id,
    })

  return (
    <TableRow
      ref={setNodeRef}
      data-state={row.getIsSelected() ? "selected" : undefined}
      data-dragging={isDragging}
      data-recalculated={pendingUpdate ? "true" : undefined}
      onClick={(event) => onRowClick(event, row)}
      className="relative border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff] data-[dragging=true]:z-10 data-[dragging=true]:opacity-85 data-[recalculated=true]:bg-[#f8fbff]"
      style={{
        backgroundImage: showRouteTone && routeTone
          ? `linear-gradient(90deg, ${routeTone.rail} 0px, ${routeTone.rail} 6px, ${routeTone.wash} 6px, ${routeTone.wash} 74px, transparent 150px)`
          : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {row.getVisibleCells().map((cell) => {
        if (cell.column.id === "drag") {
          return (
            <TableCell key={cell.id} className="px-3 py-3 text-center">
              <DragHandle
                attributes={attributes}
                listeners={listeners}
                onPointerDown={onClearSorting}
              />
            </TableCell>
          )
        }

        if (cell.column.id === "actions") {
          return (
            <TableCell key={cell.id} className="px-3 py-3 align-middle text-[13px] text-[#1d1d1b]">
              <ActionMenu
                item={row.original}
                onEdit={() => onOpenEditor(row.original)}
                onFavorite={() => onFavorite(row.original)}
                onDelete={() => onDelete(row.original)}
              />
            </TableCell>
          )
        }

        return (
          <TableCell
            key={cell.id}
            className={cn(
              "px-3 py-3 align-middle text-[13px] text-[#1d1d1b]",
              cell.column.id === "select" && "text-center"
            )}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        )
      })}
    </TableRow>
  )
}

export function ScheduleSection({
  drive,
  stopPickupPassengerOptions,
  onDriveUpdated,
}: ScheduleSectionProps) {
  const initialData = React.useMemo(() => buildInitialStopRows(drive), [drive])
  const passengerLookup = React.useMemo(
    () => new Map(stopPickupPassengerOptions.map((person) => [person.id, person])),
    [stopPickupPassengerOptions]
  )
  const currentDriveIdRef = React.useRef(drive.id)
  const [data, setData] = React.useState(initialData)
  const [pendingUpdates, setPendingUpdates] = React.useState<
    Record<string, PendingDriveStopUpdate>
  >({})
  const [pendingOrder, setPendingOrder] = React.useState<string[] | null>(null)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(
    defaultColumnVisibility
  )
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DriveStopRow | null>(null)
  const [routeError, setRouteError] = React.useState<string | null>(null)
  const [databaseError, setDatabaseError] = React.useState<string | null>(null)
  const [showOptimizedGradient, setShowOptimizedGradient] = React.useState(false)
  const [isSavingStop, setIsSavingStop] = React.useState(false)
  const [isConfirmingChanges, setIsConfirmingChanges] = React.useState(false)
  const [timingAdjustmentsOpen, setTimingAdjustmentsOpen] = React.useState(false)
  const sortableId = React.useId()
  const animationTokenRef = React.useRef(0)
  const lastSelectedRowIdRef = React.useRef<string | null>(null)

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
    setColumnVisibility(defaultColumnVisibility)
    setSorting([])
    setActiveId(null)
    setSheetOpen(false)
    setDraft(null)
    setRouteError(null)
    setDatabaseError(null)
    setShowOptimizedGradient(false)
    setTimingAdjustmentsOpen(false)
    lastSelectedRowIdRef.current = null
  }, [drive])

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

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
    if (activeItem) {
      setDraft(activeItem)
    } else if (!sheetOpen) {
      setDraft(null)
    }
  }, [activeItem, sheetOpen])

  React.useEffect(() => {
    if (!sheetOpen || !activeItem) {
      setTimingAdjustmentsOpen(false)
      return
    }

    setTimingAdjustmentsOpen(hasAdvancedTimingValue(activeItem))
  }, [activeId, activeItem, sheetOpen])

  const openEditor = React.useCallback(
    (item: DriveStopRow) => {
      setActiveId(item.id)
      setDraft(getVisibleItem(item))
      setSheetOpen(true)
      setDatabaseError(null)
    },
    [getVisibleItem]
  )

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
      await Promise.all(
        changedStops.map(async (item) => {
          const response = await fetch(`/api/trips/${item.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              pickup_time: item.pickupTimeSource,
            }),
          })

          await parseMutationResponse(response, "Unable to save recalculated stop times.")
        })
      )

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
        meta: { label: "Pickup Address" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Pickup Address"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <StackedAddressText value={row.original.pickupAddress} />,
      },
      {
        accessorKey: "pickupTime",
        meta: { label: "PU Time" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="PU Time"
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
        meta: { label: "Stop duration" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Stop duration"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const duration = normalizeTimingSeconds(row.original.stopDurationSec)

          return (
            <span className={cn("font-[450] tabular-nums", duration === 0 && "text-[#8a8a84]")}>
              {formatDurationSeconds(duration)}
            </span>
          )
        },
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
        cell: ({ row }) => {
          const duration = normalizeTimingSeconds(row.original.trafficBufferSec)

          return (
            <span className={cn("font-[450] tabular-nums", duration === 0 && "text-[#8a8a84]")}>
              {formatDurationSeconds(duration)}
            </span>
          )
        },
      },
      {
        accessorKey: "endDestination",
        meta: { label: "Drop off" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Drop off"
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
        meta: { label: "Arrival" },
        enableSorting: false,
        header: ({ column }) => (
          <SortableHeader
            label="Arrival"
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
    [table]
  )

  const handleDelete = React.useCallback(
    async (item: DriveStopRow) => {
      setDatabaseError(null)

      try {
        const response = await fetch(`/api/trips/${item.id}`, {
          method: "DELETE",
        })

        await parseMutationResponse(response, "Unable to delete this stop.")

        const nextData = data.filter((entry) => entry.id !== item.id)
        const nextDrive = buildDriveFromStopRows(drive, nextData, passengerLookup)

        setData(nextData)
        setPendingOrder((current) =>
          current ? current.filter((id) => id !== item.id) : current
        )
        setPendingUpdates((current) => {
          const next = { ...current }
          delete next[item.id]
          return next
        })
        setRowSelection((current) => {
          const next = { ...current }
          delete next[item.id]
          return next
        })

        if (activeId === item.id) {
          setSheetOpen(false)
          setActiveId(null)
          setDraft(null)
        }

        if (lastSelectedRowIdRef.current === item.id) {
          lastSelectedRowIdRef.current = null
        }

        onDriveUpdated?.(nextDrive)
      } catch (error) {
        setDatabaseError(error instanceof Error ? error.message : "Unable to delete this stop.")
      }
    },
    [activeId, data, drive, onDriveUpdated, passengerLookup]
  )

  const visibleColumns = table.getAllColumns().filter((column) => column.getCanHide())
  const stopCount = displayData.length
  const passengerCount = React.useMemo(
    () =>
      new Set(displayData.flatMap((item) => item.stopPickupPassengerIds)).size,
    [displayData]
  )

  const handleDraftSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!draft) {
        return
      }

      const currentItem = data.find((item) => item.id === draft.id)

      if (!currentItem) {
        return
      }

      const normalizedPassengerIds = Array.from(new Set(draft.stopPickupPassengerIds))
      const nextDestination = draft.endDestination.trim()
      const nextArrival = draft.arrival.trim()
      const pickupTimeSource = toDatabaseTimeValue(draft.pickupTime, currentItem.pickupTimeSource)
      const persistedStopDurationSec = normalizePersistedTimingSeconds(draft.stopDurationSec)
      const persistedTrafficBufferSec = normalizePersistedTimingSeconds(draft.trafficBufferSec)

      setDatabaseError(null)
      setIsSavingStop(true)

      try {
        const [stopResponse, travelResponse] = await Promise.all([
          fetch(`/api/trips/${draft.id}`, {
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
          }),
          nextDestination !== currentItem.endDestination
            ? fetch(`/api/travels/${drive.id}`, {
                method: "PATCH",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  destination_address: nextDestination,
                }),
              })
            : Promise.resolve(null),
        ])

        await parseMutationResponse(stopResponse, "Unable to save this stop.")

        if (travelResponse) {
          await parseMutationResponse(
            travelResponse,
            "Unable to update the drive destination."
          )
        }

        await syncStopPickupPassengers(
          draft.id,
          currentItem.stopPickupPassengerIds,
          normalizedPassengerIds
        )

        const nextData = data.map((item) => {
          const sharedFields = {
            endDestination: nextDestination,
            arrival: nextArrival,
          }

          if (item.id !== draft.id) {
            return {
              ...item,
              ...sharedFields,
            }
          }

          return {
            ...item,
            ...sharedFields,
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
        const nextDrive = buildDriveFromStopRows(drive, nextData, passengerLookup)

        setData(nextData)
        setPendingUpdates((current) => {
          const next = { ...current }
          delete next[draft.id]
          return next
        })
        setSheetOpen(false)
        setActiveId(null)
        onDriveUpdated?.(nextDrive)
      } catch (error) {
        setDatabaseError(error instanceof Error ? error.message : "Unable to save this stop.")
      } finally {
        setIsSavingStop(false)
      }
    },
    [data, draft, drive, onDriveUpdated, passengerLookup, syncStopPickupPassengers]
  )

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[18px] font-semibold text-[#1d1d1b]">{drive.label}</p>
            <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
              {stopCount} stop{stopCount === 1 ? "" : "s"} and {passengerCount} passenger
              {passengerCount === 1 ? "" : "s"} on this drive.
              {drive.startLocation ? ` Starting from ${drive.startLocation}.` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                void confirmPendingChanges()
              }}
              onErrorChange={setRouteError}
              onPlanReady={handlePlanReady}
            />
            <ColumnToggleMenu columns={visibleColumns} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="border-[#dbdbd6] bg-[#fafaf7] text-[#1d1d1b] hover:bg-[#f1f1ed]"
            >
              <Plus className="size-4" />
              <span className="hidden lg:inline">Add Stop</span>
              <span className="lg:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#ecece8]">
          <DndContext
            id={sortableId}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <Table className="min-w-[1120px] table-fixed">
              <TableHeader className="bg-[#f7f7f4]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="border-[#ecece8] hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-3 align-middle",
                          header.column.id === "drag" && "w-10",
                          header.column.id === "select" && "w-11",
                          header.column.id === "stopPickupPassengerIds" && "w-[18%]",
                          header.column.id === "pickupAddress" && "w-[22%]",
                          header.column.id === "pickupTime" && "w-[13%]",
                          header.column.id === "stopDurationSec" && "w-[10%]",
                          header.column.id === "trafficBufferSec" && "w-[10%]",
                          header.column.id === "endDestination" && "w-[18%]",
                          header.column.id === "arrival" && "w-[9%]",
                          header.column.id === "actions" && "w-14"
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={table.getVisibleLeafColumns().length}
                      className="py-14 text-center text-[13px] text-[#6b6b67]"
                    >
                      No stops yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
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
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-[#f1f1ed] bg-[#fcfcfa] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-[12px] leading-5 text-[#6b6b67]">
            {table.getSelectedRowModel().rows.length} of {table.getRowModel().rows.length} stop
            {table.getRowModel().rows.length === 1 ? "" : "s"} selected.
          </p>
          <p className="text-[12px] leading-5 text-[#6b6b67]">
            Drag to sketch a stop order, then recalculate to backfill pickup times from the final arrival.
          </p>
        </div>

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
      </div>

      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) {
            setActiveId(null)
          }
        }}
      >
        <SheetContent side="right" className="w-full border-l border-[#ecece8] bg-white sm:max-w-xl">
          <SheetHeader className="gap-1 border-b border-[#ecece8] px-6 py-5">
            <SheetTitle>
              {draft
                ? `${getStopPickupPassengerNames(draft.stopPickupPassengerIds, passengerLookup).length} passenger${getStopPickupPassengerNames(draft.stopPickupPassengerIds, passengerLookup).length === 1 ? "" : "s"}`
                : "Stop details"}
            </SheetTitle>
            <SheetDescription>
              Edit the selected stop in {drive.label} without leaving the schedule table.
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

            <form className="flex flex-col gap-4" onSubmit={handleDraftSubmit}>
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
                <Button type="submit" disabled={isSavingStop}>
                  {isSavingStop ? "Saving…" : "Save stop"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                  Done
                </Button>
              </SheetFooter>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
