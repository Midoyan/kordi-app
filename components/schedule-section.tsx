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
  Copy,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Star,
  Trash2,
} from "lucide-react"

import type { RecalculatedScheduleStop } from "@/lib/schedule-recalculation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

type ScheduleItem = {
  id: number
  passenger: string
  pickupAddress: string
  pickupTime: string
  endDestination: string
  arrival: string
  favorite: boolean
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

const festivalDestination = "Festival Grounds, Flughafen Tempelhof, 12101 Berlin"

const initialScheduleItems: ScheduleItem[] = [
  {
    id: 1,
    passenger: "Lena Fischer",
    pickupAddress: "Oderberger Str. 24, 10435 Berlin",
    pickupTime: "14:05",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
  {
    id: 2,
    passenger: "Jonas Weber",
    pickupAddress: "Skalitzer Str. 134, 10999 Berlin",
    pickupTime: "14:14",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: true,
  },
  {
    id: 3,
    passenger: "Mia Schneider",
    pickupAddress: "Warschauer Str. 43, 10243 Berlin",
    pickupTime: "14:22",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
  {
    id: 4,
    passenger: "Paul Neumann",
    pickupAddress: "Turmstr. 75, 10551 Berlin",
    pickupTime: "14:31",
    endDestination: festivalDestination,
    arrival: "15:00",
    favorite: false,
  },
  {
    id: 5,
    passenger: "Sofia Krause",
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

function ColumnToggleMenu({
  columns,
}: {
  columns: Column<ScheduleItem, unknown>[]
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
              <span className="capitalize">{column.id.replaceAll("-", " ")}</span>
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
  pendingUpdate,
  routeTone,
}: {
  row: Row<ScheduleItem>
  onOpenEditor: (item: ScheduleItem) => void
  onCopy: (item: ScheduleItem) => void
  onFavorite: (item: ScheduleItem) => void
  onDelete: (item: ScheduleItem) => void
  onClearSorting: () => void
  pendingUpdate?: PendingScheduleUpdate
  routeTone?: RouteTone
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
      className="relative border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff] data-[dragging=true]:z-10 data-[dragging=true]:opacity-85 data-[recalculated=true]:bg-[#f8fbff]"
      style={{
        backgroundImage: routeTone
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
  const sortableId = React.useId()
  const animationTokenRef = React.useRef(0)

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

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
              aria-label={`Select ${row.original.passenger}`}
            />
          </div>
        ),
      },
      {
        accessorKey: "passenger",
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
              <span>{row.original.passenger}</span>
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

  const visibleColumns = table
    .getAllColumns()
    .filter((column) => column.getCanHide())

  return (
    <>
      <div className="space-y-4">
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

        <div className="overflow-hidden rounded-xl border border-[#ecece8]">
          <DndContext
            id={sortableId}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          >
            <Table className="table-fixed">
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
                          header.column.id === "passenger" && "w-[16%]",
                          header.column.id === "pickupAddress" && "w-[27%]",
                          header.column.id === "pickupTime" && "w-[11%]",
                          header.column.id === "endDestination" && "w-[28%]",
                          header.column.id === "arrival" && "w-[10%]",
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
                      No schedule items yet.
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
                        onOpenEditor={openEditor}
                        onCopy={(item) => {
                          const nextId = Math.max(0, ...data.map((entry) => entry.id)) + 1
                          setData((current) => [
                            ...current,
                            {
                              ...item,
                              id: nextId,
                              passenger: `${item.passenger} Copy`,
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
                        }}
                        onClearSorting={() => {
                          if (sorting.length > 0) {
                            setSorting([])
                          }
                        }}
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
            <SheetTitle>{draft?.passenger ?? "Passenger details"}</SheetTitle>
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
                <label htmlFor="schedule-passenger" className="text-[13px] font-medium text-[#1d1d1b]">
                  Passenger
                </label>
                <Input
                  id="schedule-passenger"
                  value={draft?.passenger ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, passenger: event.target.value } : current
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
