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
  RefreshCcw,
  Settings2,
  Star,
  Trash2,
} from "lucide-react"

import type { RecalculatedScheduleStop, ScheduleStopInput } from "@/lib/schedule-recalculation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

function SortableRow({
  row,
  onOpenEditor,
  onCopy,
  onFavorite,
  onDelete,
  onClearSorting,
}: {
  row: Row<ScheduleItem>
  onOpenEditor: (item: ScheduleItem) => void
  onCopy: (item: ScheduleItem) => void
  onFavorite: (item: ScheduleItem) => void
  onDelete: (item: ScheduleItem) => void
  onClearSorting: () => void
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
      className="relative border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff] data-[dragging=true]:z-10 data-[dragging=true]:opacity-85"
      style={{
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
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [activeId, setActiveId] = React.useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<ScheduleItem | null>(null)
  const [recalculateError, setRecalculateError] = React.useState<string | null>(null)
  const [isRecalculating, setIsRecalculating] = React.useState(false)
  const sortableId = React.useId()

  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
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
    () => data.find((item) => item.id === activeId) ?? null,
    [activeId, data]
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
    setDraft(item)
    setSheetOpen(true)
  }, [])

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data.map(({ id }) => id),
    [data]
  )

  const routeDebugText = React.useMemo(() => {
    const pickupChain = data.map((item) => item.pickupAddress).join(" > ")
    const finalDestination = data[data.length - 1]?.endDestination || festivalDestination
    return `${pickupChain} > ${finalDestination}`
  }, [data])

  const finalArrivalTime = React.useMemo(
    () =>
      data[data.length - 1]?.arrival.trim() ||
      data.find((item) => item.arrival.trim())?.arrival.trim() ||
      "",
    [data]
  )

  const handleRecalculate = React.useCallback(() => {
    const stops: ScheduleStopInput[] = data.map((item) => ({
      id: item.id,
      pickupAddress: item.pickupAddress,
      endDestination: item.endDestination,
    }))

    setRecalculateError(null)
    setIsRecalculating(true)

    void (async () => {
      try {
        const response = await fetch("/api/schedule/recalculate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            arrivalTime: finalArrivalTime,
            stops,
          }),
        })

        const payload = (await response.json()) as
          | { error?: string; stops?: RecalculatedScheduleStop[] }
          | undefined

        if (!response.ok || !payload?.stops) {
          throw new Error(payload?.error ?? "Unable to recalculate pickup times.")
        }

        setData((current) =>
          current.map((item) => {
            const recalculatedStop = payload.stops?.find((stop) => stop.id === item.id)

            if (!recalculatedStop) {
              return item
            }

            return {
              ...item,
              pickupTime: recalculatedStop.pickupTime,
              arrival: recalculatedStop.arrival,
              endDestination: recalculatedStop.endDestination,
            }
          })
        )
      } catch (error) {
        setRecalculateError(
          error instanceof Error ? error.message : "Unable to recalculate pickup times."
        )
      } finally {
        setIsRecalculating(false)
      }
    })()
  }, [data, finalArrivalTime])

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) {
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
  }, [])

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
            className="flex items-center gap-2 text-left text-[13px] font-medium text-[#1d1d1b] transition-colors hover:text-[#4f6bbd]"
          >
            <span>{row.original.passenger}</span>
            {row.original.favorite ? (
              <Star className="size-3.5 fill-[#b2952f] text-[#b2952f]" />
            ) : null}
          </button>
        ),
      },
      {
        accessorKey: "pickupAddress",
        header: ({ column }) => (
          <SortableHeader
            label="Pickup Address"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
      },
      {
        accessorKey: "pickupTime",
        header: ({ column }) => (
          <SortableHeader
            label="PU Time"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
      },
      {
        accessorKey: "endDestination",
        header: ({ column }) => (
          <SortableHeader
            label="End Destination"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <span className="text-[#5f5f59]">{row.original.endDestination}</span>
        ),
      },
      {
        accessorKey: "arrival",
        header: ({ column }) => (
          <SortableHeader
            label="Arrival"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: () => null,
      },
    ],
    [openEditor]
  )

  const table = useReactTable({
    data,
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isRecalculating || data.length === 0 || !finalArrivalTime}
              className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
              onClick={handleRecalculate}
            >
              <RefreshCcw className={cn("size-4", isRecalculating && "animate-spin")} />
              <span>Recalculate</span>
            </Button>
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
                        }}
                        onFavorite={(item) =>
                          updateItem(item.id, "favorite", !item.favorite)
                        }
                        onDelete={(item) => {
                          setData((current) => current.filter((entry) => entry.id !== item.id))
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

        {recalculateError ? (
          <div className="rounded-lg border border-[#f3d7d7] bg-[#fff7f7] px-4 py-3">
            <p className="text-[12px] leading-5 text-[#9a4f4f]">{recalculateError}</p>
          </div>
        ) : null}

        <div className="rounded-lg border border-dashed border-[#dddcd7] bg-[#fcfcfa] px-4 py-3">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
            Debug Route
          </p>
          <p className="mt-2 text-[12px] leading-6 text-[#4b4b46]">
            {routeDebugText}
          </p>
        </div>
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
                  End Destination
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
