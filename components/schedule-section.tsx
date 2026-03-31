"use client"

import * as React from "react"
import {
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import {
  ChevronRight,
  Copy,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react"

import type { RecalculatedScheduleStop } from "@/lib/schedule-recalculation"
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
import { TableCell, TableRow } from "@/components/ui/table"
import {
  WorkspaceColumnToggleMenu,
  WorkspaceDataTable,
} from "@/components/workspace-data-table"

type ScheduleItem = {
  id: number
  passengerIds: string[]
  pickupAddress: string
  pickupTime: string
  endDestination: string
  arrival: string
  favorite: boolean
}

type SchedulePassengerOption = {
  id: string
  name: string
  role: string
  address: string
}

type PendingScheduleUpdate = {
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

type ContextMenuState = {
  x: number
  y: number
}

const festivalDestination = "Festival Grounds, Flughafen Tempelhof, 12101 Berlin"

const schedulePassengerOptions: SchedulePassengerOption[] = [
  {
    id: "lena-fischer",
    name: "Lena Fischer",
    role: "Lighting tech",
    address: "Oderberger Str. 24, 10435 Berlin",
  },
  {
    id: "noah-becker",
    name: "Noah Becker",
    role: "Stage manager",
    address: "Oderberger Str. 24, 10435 Berlin",
  },
  {
    id: "jonas-weber",
    name: "Jonas Weber",
    role: "Production coordinator",
    address: "Skalitzer Str. 134, 10999 Berlin",
  },
  {
    id: "mia-schneider",
    name: "Mia Schneider",
    role: "Wardrobe",
    address: "Warschauer Str. 43, 10243 Berlin",
  },
  {
    id: "emil-hartmann",
    name: "Emil Hartmann",
    role: "Audio tech",
    address: "Warschauer Str. 43, 10243 Berlin",
  },
  {
    id: "paul-neumann",
    name: "Paul Neumann",
    role: "Backline",
    address: "Turmstr. 75, 10551 Berlin",
  },
  {
    id: "sofia-krause",
    name: "Sofia Krause",
    role: "Artist liaison",
    address: "Schloßstr. 110, 12163 Berlin",
  },
  {
    id: "clara-vogel",
    name: "Clara Vogel",
    role: "Guest services",
    address: "Schloßstr. 110, 12163 Berlin",
  },
]

const initialScheduleItems: ScheduleItem[] = [
  {
    id: 1,
    passengerIds: ["lena-fischer", "noah-becker"],
    pickupAddress: "Oderberger Str. 24, 10435 Berlin",
    pickupTime: "14:05",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
  {
    id: 2,
    passengerIds: ["jonas-weber"],
    pickupAddress: "Skalitzer Str. 134, 10999 Berlin",
    pickupTime: "14:14",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: true,
  },
  {
    id: 3,
    passengerIds: ["mia-schneider", "emil-hartmann"],
    pickupAddress: "Warschauer Str. 43, 10243 Berlin",
    pickupTime: "14:22",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
  {
    id: 4,
    passengerIds: ["paul-neumann"],
    pickupAddress: "Turmstr. 75, 10551 Berlin",
    pickupTime: "14:31",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
  {
    id: 5,
    passengerIds: ["sofia-krause", "clara-vogel"],
    pickupAddress: "Schloßstr. 110, 12163 Berlin",
    pickupTime: "14:42",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
]

function orderScheduleItems(items: ScheduleItem[], orderIds: number[]) {
  const itemById = new Map(items.map((item) => [item.id, item]))

  return orderIds
    .map((id) => itemById.get(id))
    .filter((item): item is ScheduleItem => Boolean(item))
}

function areOrdersEqual(first: number[], second: number[]) {
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

function getPassengerById(id: string) {
  return schedulePassengerOptions.find((person) => person.id === id) ?? null
}

function getPassengerNames(passengerIds: string[]) {
  return passengerIds
    .map((id) => getPassengerById(id)?.name ?? id)
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

function getAddressLabelUntilComma(address: string) {
  return address.split(",")[0]?.trim() ?? address
}

function PassengerSummary({ passengerIds }: { passengerIds: string[] }) {
  const names = getPassengerNames(passengerIds)
  const abbreviatedNames =
    names.length > 2 ? names.map((name) => abbreviatePassengerName(name)) : names
  const displayLabel = abbreviatedNames.join(", ")

  if (names.length <= 2) {
    return (
      <span className="block whitespace-normal break-words leading-5 text-[#1d1d1b] line-clamp-2">
        {displayLabel}
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
          {passengerIds.map((id) => {
            const passenger = getPassengerById(id)

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
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">{passenger.role}</p>
              </div>
            )
          })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

function PassengerCombobox({
  value,
  onValueChange,
}: {
  value: string[]
  onValueChange: (value: string[]) => void
}) {
  const anchorRef = useComboboxAnchor()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const selectedPeople = value
    .map((id) => getPassengerById(id))
    .filter((person): person is SchedulePassengerOption => Boolean(person))

  return (
    <Combobox
      multiple
      open={open}
      onOpenChange={setOpen}
      value={value}
      onValueChange={(nextValue) => {
        onValueChange(nextValue)
        setQuery("")
        setOpen(false)
      }}
      itemToStringLabel={(personId) => {
        const person = getPassengerById(personId)
        return person ? `${person.name} ${person.role} ${person.address}` : personId
      }}
    >
      <ComboboxChips
        ref={anchorRef}
        className="min-h-8 gap-1 rounded-lg border-[#dcdcd7] bg-white px-2 py-1"
      >
        {selectedPeople.map((person) => (
          <ComboboxChip
            key={person.id}
            className="h-5 rounded-sm px-1.5 text-[11px]"
          >
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
            if (event.key === "Tab") {
              setOpen(false)
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
          <ComboboxEmpty>No matching passengers found.</ComboboxEmpty>
          {schedulePassengerOptions.map((person) => (
            <ComboboxItem
              key={person.id}
              value={person.id}
              className="items-start gap-3 px-2 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#1d1d1b]">
                  {person.name}
                </p>
                <p className="mt-0.5 text-[11px] text-[#6b6b67]">{person.role}</p>
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

function ContextMenu({
  position,
  selectedItems,
  menuRef,
  onClose,
  onMerge,
}: {
  position: ContextMenuState
  selectedItems: ScheduleItem[]
  menuRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onMerge: (targetId: number) => void
}) {
  const [mergeOpen, setMergeOpen] = React.useState(false)

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-44 rounded-xl border border-[#e3e3df] bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <button
        type="button"
        disabled
        className="flex w-full cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#a2a29c] disabled:opacity-100"
      >
        <Copy className="size-3.5" />
        Copy
      </button>

      {selectedItems.length > 1 ? (
        <div
          className="relative mt-1"
          onMouseEnter={() => setMergeOpen(true)}
          onMouseLeave={() => setMergeOpen(false)}
        >
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1b] hover:bg-[#f7f7f4]"
            onClick={() => setMergeOpen((current) => !current)}
          >
            <span>Merge</span>
            <ChevronRight className="size-3.5" />
          </button>
          {mergeOpen ? (
            <div className="absolute top-0 left-full ml-1 min-w-52 rounded-xl border border-[#e3e3df] bg-white p-1.5 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)]">
              {selectedItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1b] hover:bg-[#f7f7f4]"
                  onClick={() => {
                    onMerge(item.id)
                    onClose()
                  }}
                >
                  Meet at {getAddressLabelUntilComma(item.pickupAddress)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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

function ActionMenu({
  item,
  onEdit,
  onCopy,
  onFavorite,
  onDelete,
}: {
  item: ScheduleItem
  onEdit: () => void
  onCopy: () => void
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
          <span className="sr-only">Open row actions</span>
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
            onCopy()
            closeMenu(event.currentTarget)
          }}
        >
          <Copy className="size-3.5" />
          Duplicate
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-[#1d1d1b] hover:bg-[#f7f7f4]"
          onClick={(event) => {
            onFavorite()
            closeMenu(event.currentTarget)
          }}
        >
          <Star className={cn("size-3.5", item.favorite && "fill-current")} />
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
        {confirmedValue}
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
        {confirmedValue}
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
  onCopy,
  onFavorite,
  onDelete,
  onClearSorting,
  onRowClick,
  onRowContextMenu,
  pendingUpdate,
  routeTone,
  showRouteTone,
}: {
  row: Row<ScheduleItem>
  onOpenEditor: (item: ScheduleItem) => void
  onCopy: (item: ScheduleItem) => void
  onFavorite: (item: ScheduleItem) => void
  onDelete: (item: ScheduleItem) => void
  onClearSorting: () => void
  onRowClick: (event: React.MouseEvent<HTMLTableRowElement>, row: Row<ScheduleItem>) => void
  onRowContextMenu: (
    event: React.MouseEvent<HTMLTableRowElement>,
    row: Row<ScheduleItem>
  ) => void
  pendingUpdate?: PendingScheduleUpdate
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
      onContextMenu={(event) => onRowContextMenu(event, row)}
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
                onCopy={() => onCopy(row.original)}
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

export function ScheduleSection() {
  const [data, setData] = React.useState(initialScheduleItems)
  const [pendingUpdates, setPendingUpdates] = React.useState<Record<number, PendingScheduleUpdate>>(
    {}
  )
  const [pendingOrder, setPendingOrder] = React.useState<number[] | null>(null)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [activeId, setActiveId] = React.useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<ScheduleItem | null>(null)
  const [recalculateError, setRecalculateError] = React.useState<string | null>(null)
  const [showOptimizedGradient, setShowOptimizedGradient] = React.useState(false)
  const [contextMenu, setContextMenu] = React.useState<ContextMenuState | null>(null)
  const sortableId = React.useId()
  const animationTokenRef = React.useRef(0)
  const lastSelectedRowIdRef = React.useRef<string | null>(null)
  const contextMenuRef = React.useRef<HTMLDivElement | null>(null)

  const displayData = React.useMemo(
    () => (pendingOrder ? orderScheduleItems(data, pendingOrder) : data),
    [data, pendingOrder]
  )

  const getVisibleItem = React.useCallback(
    (item: ScheduleItem) => {
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

  const updateItem = React.useCallback(
    <K extends keyof ScheduleItem>(id: number, key: K, value: ScheduleItem[K]) => {
      setData((current) =>
        current.map((item) => (item.id === id ? { ...item, [key]: value } : item))
      )
    },
    []
  )

  const activeItem = React.useMemo(
    () => {
      const item = data.find((entry) => entry.id === activeId) ?? null
      return item ? getVisibleItem(item) : null
    },
    [activeId, data, getVisibleItem]
  )

  React.useEffect(() => {
    if (activeItem) {
      setDraft(activeItem)
    } else if (!sheetOpen) {
      setDraft(null)
    }
  }, [activeItem, sheetOpen])

  const openEditor = React.useCallback((item: ScheduleItem) => {
    setActiveId(item.id)
    setDraft(getVisibleItem(item))
    setSheetOpen(true)
  }, [getVisibleItem])

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

  const selectedItems = React.useMemo(
    () => displayData.filter((item) => rowSelection[item.id.toString()]),
    [displayData, rowSelection]
  )

  const pendingChangeCount = React.useMemo(
    () => Object.keys(pendingUpdates).length,
    [pendingUpdates]
  )
  const routeTones = React.useMemo<Record<number, RouteTone>>(
    () =>
      data.reduce<Record<number, RouteTone>>((accumulator, item, index) => {
        accumulator[item.id] = buildRouteTone(index, data.length)
        return accumulator
      }, {}),
    [data]
  )
  const positionChanges = React.useMemo<Record<number, PositionChange>>(() => {
    if (!pendingOrder) {
      return {}
    }

    const confirmedOrder = data.map((item) => item.id)

    return pendingOrder.reduce<Record<number, PositionChange>>((accumulator, id, index) => {
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
  const pendingSummary = React.useMemo(() => {
    const parts: string[] = []

    if (hasPendingRouteChange) {
      parts.push("Optimized route order staged.")
    }

    if (pendingChangeCount > 0) {
      parts.push(
        `${pendingChangeCount} stop${pendingChangeCount === 1 ? "" : "s"} recalculated.`
      )
    }

    parts.push("Review the staged route, then confirm when the run looks right.")

    return parts.join(" ")
  }, [hasPendingRouteChange, pendingChangeCount])

  const confirmPendingChanges = React.useCallback(() => {
    setData((current) =>
      (pendingOrder ? orderScheduleItems(current, pendingOrder) : current).map((item) => {
        const pendingUpdate = pendingUpdates[item.id]

        if (!pendingUpdate) {
          return item
        }

        return {
          ...item,
          pickupTime: pendingUpdate.pickupTime,
          arrival: pendingUpdate.arrival,
        }
      })
    )
    setPendingOrder(null)
    setPendingUpdates({})
    setShowOptimizedGradient(false)
    setRecalculateError(null)
    setDraft((current) => {
      if (!current) {
        return current
      }

      const pendingUpdate = pendingUpdates[current.id]

      if (!pendingUpdate) {
        return current
      }

      return {
        ...current,
        pickupTime: pendingUpdate.pickupTime,
        arrival: pendingUpdate.arrival,
      }
    })
  }, [pendingOrder, pendingUpdates])

  const handlePlanReady = React.useCallback(
    (
      plannedStops: RecalculatedScheduleStop[],
      source: "optimize" | "recalculate"
    ) => {
      animationTokenRef.current += 1

      const nextOrder = plannedStops.map((stop) => stop.id)
      const confirmedOrder = data.map((item) => item.id)
      const hasRouteChange = !areOrdersEqual(nextOrder, confirmedOrder)
      const nextPendingUpdates = plannedStops.reduce<Record<number, PendingScheduleUpdate>>(
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

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    if (pendingOrder) {
      setPendingOrder((current) => {
        if (!current) {
          return current
        }

        const oldIndex = current.indexOf(Number(active.id))
        const newIndex = current.indexOf(Number(over.id))

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
      const oldIndex = ids.indexOf(Number(active.id))
      const newIndex = ids.indexOf(Number(over.id))

      if (oldIndex === -1 || newIndex === -1) {
        return current
      }

      return arrayMove(current, oldIndex, newIndex)
    })
  }, [data, pendingOrder])

  const columns = React.useMemo<ColumnDef<ScheduleItem>[]>(
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
              aria-label={`Select ${getPassengerNames(row.original.passengerIds).join(", ")}`}
            />
          </div>
        ),
      },
      {
        accessorKey: "passengerIds",
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
              <PassengerSummary passengerIds={row.original.passengerIds} />
              {row.original.favorite ? (
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

          return (
            <AnimatedScheduleTime
              confirmedValue={row.original.pickupTime}
              pendingValue={pendingUpdate?.pickupTime}
              revealOrder={pendingUpdate?.revealOrder}
              animationToken={pendingUpdate?.animationToken}
            />
          )
        },
      },
      {
        accessorKey: "endDestination",
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
    [openEditor, pendingUpdates, positionChanges]
  )

  // TanStack Table is an intentional exception to the React Compiler lint rule here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: displayData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const handleRowClick = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<ScheduleItem>) => {
      setContextMenu(null)

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

  const handleRowContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<ScheduleItem>) => {
      if (shouldIgnoreRowSelectionTarget(event.target)) {
        return
      }

      event.preventDefault()

      if (!row.getIsSelected()) {
        setRowSelection({ [row.id]: true })
        lastSelectedRowIdRef.current = row.id
      }

      setContextMenu({
        x: Math.min(event.clientX, window.innerWidth - 240),
        y: Math.min(event.clientY, window.innerHeight - 180),
      })
    },
    []
  )

  const handleMerge = React.useCallback(
    (targetId: number) => {
      if (selectedItems.length < 2) {
        return
      }

      setData((current) => {
        const selectedIds = new Set(selectedItems.map((item) => item.id))
        const targetItem = current.find((item) => item.id === targetId)

        if (!targetItem) {
          return current
        }

        const mergedPassengerIds = Array.from(
          new Set(
            current
              .filter((item) => selectedIds.has(item.id))
              .flatMap((item) => item.passengerIds)
          )
        )

        return current
          .filter((item) => !selectedIds.has(item.id) || item.id === targetId)
          .map((item) =>
            item.id === targetId
              ? {
                  ...item,
                  passengerIds: mergedPassengerIds,
                  pickupAddress: targetItem.pickupAddress,
                  favorite: current
                    .filter((entry) => selectedIds.has(entry.id))
                    .some((entry) => entry.favorite),
                }
              : item
          )
      })

      const keptId = targetId.toString()
      setRowSelection({ [keptId]: true })
      lastSelectedRowIdRef.current = keptId
      setPendingOrder(null)
      setPendingUpdates({})
      setShowOptimizedGradient(false)
      setRecalculateError(null)

      if (activeId !== null && selectedItems.some((item) => item.id === activeId)) {
        setActiveId(targetId)
      }
    },
    [activeId, selectedItems]
  )

  React.useEffect(() => {
    if (!contextMenu) {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (target instanceof Node && contextMenuRef.current?.contains(target)) {
        return
      }

      setContextMenu(null)
    }
    const handleScroll = () => {
      setContextMenu(null)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setContextMenu(null)
      }
    }

    window.addEventListener("mousedown", handlePointerDown)
    window.addEventListener("keydown", handleEscape)
    window.addEventListener("scroll", handleScroll, true)

    return () => {
      window.removeEventListener("mousedown", handlePointerDown)
      window.removeEventListener("keydown", handleEscape)
      window.removeEventListener("scroll", handleScroll, true)
    }
  }, [contextMenu])

  const visibleColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())

  return (
    <>
      <WorkspaceDataTable
        table={table}
        dataIds={dataIds}
        sortable
        sortableId={sortableId}
        onDragEnd={handleDragEnd}
        tableClassName="table-fixed"
        headerClassName="bg-[#f7f7f4]"
        headerRowClassName="border-[#ecece8] hover:bg-transparent"
        getHeadClassName={(columnId) =>
          cn(
            "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-3 align-middle",
            columnId === "drag" && "w-10",
            columnId === "select" && "w-11",
            columnId === "passengerIds" && "w-[18%]",
            columnId === "pickupAddress" && "w-[27%]",
            columnId === "pickupTime" && "w-[11%]",
            columnId === "endDestination" && "w-[26%]",
            columnId === "arrival" && "w-[10%]",
            columnId === "actions" && "w-14"
          )
        }
        toolbar={(
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[18px] font-semibold text-[#1d1d1b]">Van 1</p>
              <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
                Berlin pickup run for 5 passengers headed to the same festival destination.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ScheduleRoutingControls
                stops={displayData.map((item) => ({
                  id: item.id,
                  pickupAddress: item.pickupAddress,
                  endDestination: item.endDestination,
                }))}
                arrivalTime={finalArrivalTime}
                hasPendingChanges={hasPendingChanges}
                onConfirmChanges={confirmPendingChanges}
                onErrorChange={setRecalculateError}
                onPlanReady={handlePlanReady}
              />
              <WorkspaceColumnToggleMenu columns={visibleColumns} />
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
        )}
        footer={(
          <>
            <div className="flex flex-col gap-3 rounded-lg border border-[#f1f1ed] bg-[#fcfcfa] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[12px] leading-5 text-[#6b6b67]">
                {table.getSelectedRowModel().rows.length} of {table.getRowModel().rows.length} row(s) selected.
              </p>
              <p className="text-[12px] leading-5 text-[#6b6b67]">
                Drag to set stop order, then recalculate to backfill pickup times from the final arrival.
              </p>
            </div>

            {hasPendingChanges ? (
              <div className="flex flex-col gap-2 rounded-lg border border-[#dfe7f4] bg-[linear-gradient(180deg,#f8fbff_0%,#f1f6ff_100%)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-[12px] leading-5 text-[#49628d]">
                  {pendingSummary}
                </p>
              </div>
            ) : null}

            {recalculateError ? (
              <div className="rounded-lg border border-[#f3d7d7] bg-[#fff7f7] px-4 py-3">
                <p className="text-[12px] leading-5 text-[#9a4f4f]">{recalculateError}</p>
              </div>
            ) : null}
          </>
        )}
        renderRow={(row) => (
          <SortableRow
            key={row.id}
            row={row}
            pendingUpdate={pendingUpdates[row.original.id]}
            routeTone={routeTones[row.original.id]}
            showRouteTone={showOptimizedGradient}
            onOpenEditor={openEditor}
            onCopy={(item) => {
              const nextId = Math.max(0, ...data.map((entry) => entry.id)) + 1
              setData((current) => [
                ...current,
                {
                  ...item,
                  id: nextId,
                  passengerIds: [...item.passengerIds],
                  favorite: false,
                },
              ])
              setPendingOrder((current) =>
                current ? [...current, nextId] : current
              )
            }}
            onFavorite={(item) =>
              updateItem(item.id, "favorite", !item.favorite)
            }
            onDelete={(item) => {
              setData((current) => current.filter((entry) => entry.id !== item.id))
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
                delete next[item.id.toString()]
                return next
              })
              if (activeId === item.id) {
                setSheetOpen(false)
                setActiveId(null)
                setDraft(null)
              }
              if (lastSelectedRowIdRef.current === item.id.toString()) {
                lastSelectedRowIdRef.current = null
              }
            }}
            onClearSorting={() => {
              if (sorting.length > 0) {
                setSorting([])
              }
            }}
            onRowClick={handleRowClick}
            onRowContextMenu={handleRowContextMenu}
          />
        )}
      />

      {contextMenu ? (
        <ContextMenu
          position={contextMenu}
          selectedItems={selectedItems}
          menuRef={contextMenuRef}
          onClose={() => setContextMenu(null)}
          onMerge={handleMerge}
        />
      ) : null}

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
                ? `${getPassengerNames(draft.passengerIds).length} passenger${getPassengerNames(draft.passengerIds).length === 1 ? "" : "s"}`
                : "Passenger details"}
            </SheetTitle>
            <SheetDescription>
              Edit the pickup stop for Van 1 without leaving the schedule table.
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
                    {draft?.pickupTime ?? "--:--"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                  <p className="text-[11px] text-[#777772] uppercase">Arrival</p>
                  <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                    {draft?.arrival ?? "--:--"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                  <p className="text-[11px] text-[#777772] uppercase">Destination</p>
                  <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                    Tempelhof
                  </p>
                </div>
              </div>
            </div>

            <Separator className="bg-[#ecece8]" />

            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (!draft) {
                  return
                }

                setData((current) =>
                  current.map((item) => (item.id === draft.id ? draft : item))
                )
                setPendingUpdates((current) => {
                  const next = { ...current }
                  delete next[draft.id]
                  return next
                })
                setSheetOpen(false)
                setActiveId(null)
              }}
            >
              <div className="flex flex-col gap-2">
                <label className="text-[13px] font-medium text-[#1d1d1b]">
                  Passengers
                </label>
                <PassengerCombobox
                  value={draft?.passengerIds ?? []}
                  onValueChange={(passengerIds) =>
                    setDraft((current) =>
                      current ? { ...current, passengerIds } : current
                    )
                  }
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

              <SheetFooter className="px-0 pt-2">
                <Button type="submit">Submit</Button>
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
