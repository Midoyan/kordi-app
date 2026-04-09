"use client"

import * as React from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { flexRender, type Row } from "@tanstack/react-table"
import {
  ChevronRight,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"

import type { StopPickupPassengerOption } from "@/lib/drive-plan"
import { cn } from "@/lib/utils"
import {
  abbreviatePassengerName,
  formatDurationSeconds,
  getStopPickupPassengerNames,
  normalizeTimingSeconds,
  splitAddressLabel,
} from "@/components/schedule-section/helpers"
import type {
  DriveStopRow,
  PendingDriveStopUpdate,
  RouteTone,
} from "@/components/schedule-section/types"
import { Button } from "@/components/ui/button"
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
import {
  TableCell,
  TableRow,
} from "@/components/ui/table"

export function StackedAddressText({
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

export function PassengerSummary({
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

export function StopPickupPassengerCombobox({
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
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const ignoreInitialFocusRef = React.useRef(true)
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [highlightedPassengerId, setHighlightedPassengerId] = React.useState<string | undefined>(
    undefined
  )
  const normalizedQuery = query.trim().toLowerCase()
  const selectedPeople = value
    .map((id) => passengerLookup.get(id))
    .filter((person): person is StopPickupPassengerOption => Boolean(person))
  const filteredPeople = React.useMemo(() => {
    if (!normalizedQuery) {
      return stopPickupPassengerOptions
    }

    return stopPickupPassengerOptions.filter((person) =>
      [person.name, person.detail, person.address].join(" ").toLowerCase().includes(normalizedQuery)
    )
  }, [normalizedQuery, stopPickupPassengerOptions])
  const commitSelection = React.useCallback(
    (nextPassengerId: string) => {
      const dedupedValue = Array.from(new Set([...value, nextPassengerId]))
      const wasFirstSelection = value.length === 0 && dedupedValue.length === 1
      const isAddingMorePassengers = value.length >= 1 && dedupedValue.length > value.length

      onValueChange(dedupedValue)
      setQuery("")

      if (wasFirstSelection) {
        setOpen(false)
        return
      }

      if (isAddingMorePassengers) {
        setOpen(true)
        requestAnimationFrame(() => {
          inputRef.current?.focus()
        })
      }
    },
    [onValueChange, value]
  )

  return (
    <Combobox<string, true>
      multiple
      filter={null}
      autoHighlight
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        setHighlightedPassengerId(undefined)

        if (!nextOpen) {
          setQuery("")
        }
      }}
      value={value}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(nextValue) => {
        const nextPassengerId = nextValue.find((entry) => !value.includes(entry))

        if (nextPassengerId) {
          commitSelection(nextPassengerId)
          return
        }

        onValueChange(Array.from(new Set(nextValue)))
      }}
      onItemHighlighted={(nextValue) => {
        setHighlightedPassengerId(nextValue)
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
          ref={inputRef}
          placeholder={
            selectedPeople.length === 0
              ? "Search passengers to add"
              : "Add another passenger"
          }
          className="min-h-5 text-sm text-[#1d1d1b] placeholder:text-[#8a8a84]"
          onPointerDown={() => {
            ignoreInitialFocusRef.current = false
            setOpen(true)
          }}
          onFocus={() => {
            if (ignoreInitialFocusRef.current) {
              ignoreInitialFocusRef.current = false
              return
            }

            setOpen(true)
          }}
          onKeyDown={(event) => {
            if (
              (event.key === "Tab" || event.key === "Enter") &&
              open &&
              highlightedPassengerId
            ) {
              event.preventDefault()
              commitSelection(highlightedPassengerId)
              return
            }

            if (event.key === "Escape") {
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
          {filteredPeople.length === 0 ? (
            <ComboboxEmpty>No matching passengers found.</ComboboxEmpty>
          ) : null}
          {filteredPeople.map((person) => (
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

export function SortableHeader({
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
        <div className="my-1 h-px bg-[#ecece8]" />
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

export function AnimatedScheduleTime({
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
        className="schedule-time-reveal inline-flex min-w-[3rem] rounded-md bg-[#ecf3ff] px-0.5 py-0.5 text-[12.5px] font-semibold text-[#335f9f] shadow-[inset_0_0_0_1px_rgba(79,107,189,0.12)]"
        style={{ animationDelay: `${(revealOrder ?? 0) * 120}ms` }}
      >
        {pendingValue}
      </span>
    </span>
  )
}

export function ScheduleDurationCell({
  value,
}: {
  value: number | null | undefined
}) {
  const duration = normalizeTimingSeconds(value)

  return (
    <span className={cn("font-[450] tabular-nums", duration === 0 && "text-[#8a8a84]")}>
      {formatDurationSeconds(duration)}
    </span>
  )
}

export function SortableRow({
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
