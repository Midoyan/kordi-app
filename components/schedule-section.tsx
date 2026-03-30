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
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Copy,
  GripVertical,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Star,
  Trash2,
} from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"
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

type ScheduleStatus = "Done" | "In Progress" | "Not Started"
type ScheduleView = "outline" | "past-performance" | "key-personnel" | "focus-documents"

type ScheduleItem = {
  id: number
  header: string
  type: string
  status: ScheduleStatus
  target: string
  limit: string
  reviewer: string
  favorite: boolean
}

const typeOptions = [
  "Table of Contents",
  "Executive Summary",
  "Technical Approach",
  "Design",
  "Capabilities",
  "Focus Documents",
  "Narrative",
  "Cover Page",
] as const

const reviewerOptions = [
  "Assign reviewer",
  "Eddie Lake",
  "Jamik Tashpulatov",
  "Emily Whalen",
] as const

const statusOptions: ScheduleStatus[] = ["Done", "In Progress", "Not Started"]

const initialScheduleItems: ScheduleItem[] = [
  {
    id: 1,
    header: "Outline",
    type: "Table of Contents",
    status: "Done",
    target: "1 page",
    limit: "1 page",
    reviewer: "Eddie Lake",
    favorite: false,
  },
  {
    id: 2,
    header: "Executive Summary",
    type: "Executive Summary",
    status: "In Progress",
    target: "2 pages",
    limit: "3 pages",
    reviewer: "Jamik Tashpulatov",
    favorite: false,
  },
  {
    id: 3,
    header: "Technical Approach",
    type: "Technical Approach",
    status: "In Progress",
    target: "8 pages",
    limit: "10 pages",
    reviewer: "Emily Whalen",
    favorite: false,
  },
  {
    id: 4,
    header: "Past Performance",
    type: "Capabilities",
    status: "Not Started",
    target: "3 projects",
    limit: "5 projects",
    reviewer: "Assign reviewer",
    favorite: false,
  },
  {
    id: 5,
    header: "Key Personnel",
    type: "Narrative",
    status: "Done",
    target: "2 resumes",
    limit: "3 resumes",
    reviewer: "Eddie Lake",
    favorite: true,
  },
  {
    id: 6,
    header: "Focus Documents",
    type: "Focus Documents",
    status: "Not Started",
    target: "6 files",
    limit: "8 files",
    reviewer: "Assign reviewer",
    favorite: false,
  },
]

const viewOptions: Array<{
  value: ScheduleView
  label: string
  matchHeader?: ScheduleItem["header"]
}> = [
  { value: "outline", label: "Outline" },
  { value: "past-performance", label: "Past Performance", matchHeader: "Past Performance" },
  { value: "key-personnel", label: "Key Personnel", matchHeader: "Key Personnel" },
  { value: "focus-documents", label: "Focus Documents", matchHeader: "Focus Documents" },
]

function SortableHeader({
  label,
  isSorted,
  onToggle,
  align = "left",
}: {
  label: string
  isSorted: false | "asc" | "desc"
  onToggle: () => void
  align?: "left" | "right"
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase transition-colors hover:text-[#43433f]",
        align === "right" && "justify-end"
      )}
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

function TypePill({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-full border border-[#dddcd7] bg-[#fafaf7] px-2.5 py-1 text-[12px] text-[#5f5f59]">
      {value}
    </span>
  )
}

function StatusPill({ value }: { value: ScheduleStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px]",
        value === "Done"
          ? "border-[#cfe5cb] bg-[#f1f8ef] text-[#35622e]"
          : value === "In Progress"
            ? "border-[#dddcd7] bg-[#fafaf7] text-[#5f5f59]"
            : "border-[#e6ded1] bg-[#fbf7ef] text-[#7a6644]"
      )}
    >
      {value === "Done" ? (
        <CheckCircle2 className="size-3.5" />
      ) : (
        <LoaderCircle className="size-3.5" />
      )}
      {value}
    </span>
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
          Make a copy
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
  disabled,
  onPointerDown,
}: {
  listeners: ReturnType<typeof useSortable>["listeners"]
  attributes: ReturnType<typeof useSortable>["attributes"]
  disabled?: boolean
  onPointerDown?: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-[#b6b6b0] hover:bg-[#f3f3ef] hover:text-[#7a7a74]"
      disabled={disabled}
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

function ScheduleTabs({
  activeView,
  onChange,
  counts,
}: {
  activeView: ScheduleView
  onChange: (view: ScheduleView) => void
  counts: Record<ScheduleView, number>
}) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <div className="w-full max-w-[15rem]">
        <label htmlFor="schedule-view-selector" className="sr-only">
          View
        </label>
        <select
          id="schedule-view-selector"
          value={activeView}
          onChange={(event) => onChange(event.target.value as ScheduleView)}
          className="h-9 w-full rounded-lg border border-[#dbdbd6] bg-white px-3 text-[13px] text-[#1d1d1b] outline-none transition-colors hover:bg-[#fafaf7] focus:border-[#cfcfca]"
        >
          {viewOptions.map((view) => (
            <option key={view.value} value={view.value}>
              {view.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {viewOptions.map((view) => {
        const active = view.value === activeView

        return (
          <button
            key={view.value}
            type="button"
            onClick={() => onChange(view.value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              active
                ? "border-[#1f1f1d] bg-[#1f1f1d] text-white"
                : "border-[#dbdbd6] bg-white text-[#4b4b46] hover:bg-[#f3f3ef]"
            )}
          >
            <span>{view.label}</span>
            {view.value !== "outline" ? (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px]",
                  active ? "bg-white/15 text-white" : "bg-[#efefe9] text-[#6b6b67]"
                )}
              >
                {counts[view.value]}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function ScheduleSection() {
  const [data, setData] = React.useState(initialScheduleItems)
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [activeView, setActiveView] = React.useState<ScheduleView>("outline")
  const [activeId, setActiveId] = React.useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<ScheduleItem | null>(null)
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

  const currentView = React.useMemo(
    () => viewOptions.find((view) => view.value === activeView),
    [activeView]
  )

  const tableData = React.useMemo(() => {
    if (!currentView?.matchHeader) {
      return data
    }

    return data.filter((item) => item.header === currentView.matchHeader)
  }, [currentView, data])

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => tableData.map(({ id }) => id),
    [tableData]
  )

  const viewCounts = React.useMemo(
    () =>
      viewOptions.reduce<Record<ScheduleView, number>>(
        (acc, view) => {
          acc[view.value] = view.matchHeader
            ? data.filter((item) => item.header === view.matchHeader).length
            : data.length
          return acc
        },
        {
          outline: data.length,
          "past-performance": 0,
          "key-personnel": 0,
          "focus-documents": 0,
        }
      ),
    [data]
  )

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (!over || active.id === over.id || activeView !== "outline") {
        return
      }

      setData((current) => {
        const allIds = current.map((item) => item.id)
        const oldIndex = allIds.indexOf(Number(active.id))
        const newIndex = allIds.indexOf(Number(over.id))

        if (oldIndex === -1 || newIndex === -1) {
          return current
        }

        return arrayMove(current, oldIndex, newIndex)
      })
    },
    [activeView]
  )

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
              onCheckedChange={(checked) => table.toggleAllRowsSelected(checked)}
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
              onCheckedChange={(checked) => row.toggleSelected(checked)}
              aria-label={`Select ${row.original.header}`}
            />
          </div>
        ),
      },
      {
        accessorKey: "header",
        enableHiding: false,
        header: ({ column }) => (
          <SortableHeader
            label="Header"
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
            <span>{row.original.header}</span>
            {row.original.favorite ? (
              <Star className="size-3.5 fill-[#b2952f] text-[#b2952f]" />
            ) : null}
          </button>
        ),
      },
      {
        accessorKey: "type",
        header: ({ column }) => (
          <SortableHeader
            label="Section Type"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <TypePill value={row.original.type} />,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <SortableHeader
            label="Status"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => <StatusPill value={row.original.status} />,
      },
      {
        accessorKey: "target",
        header: ({ column }) => (
          <SortableHeader
            label="Target"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Input
              value={row.original.target}
              onChange={(event) => updateItem(row.original.id, "target", event.target.value)}
              className="h-8 w-24 border-transparent bg-transparent text-right shadow-none hover:border-[#d7d7d2] hover:bg-[#f7f7f4] focus-visible:border-[#d2d2cc] focus-visible:ring-0"
              aria-label={`${row.original.header} target`}
            />
          </div>
        ),
      },
      {
        accessorKey: "limit",
        header: ({ column }) => (
          <SortableHeader
            label="Limit"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
            align="right"
          />
        ),
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Input
              value={row.original.limit}
              onChange={(event) => updateItem(row.original.id, "limit", event.target.value)}
              className="h-8 w-24 border-transparent bg-transparent text-right shadow-none hover:border-[#d7d7d2] hover:bg-[#f7f7f4] focus-visible:border-[#d2d2cc] focus-visible:ring-0"
              aria-label={`${row.original.header} limit`}
            />
          </div>
        ),
      },
      {
        accessorKey: "reviewer",
        header: ({ column }) => (
          <SortableHeader
            label="Reviewer"
            isSorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const isAssigned = row.original.reviewer !== "Assign reviewer"

          if (isAssigned) {
            return row.original.reviewer
          }

          return (
            <select
              value={row.original.reviewer}
              onChange={(event) => updateItem(row.original.id, "reviewer", event.target.value)}
              className="h-8 rounded-lg border border-[#dbdbd6] bg-white px-2.5 text-[13px] text-[#1d1d1b] outline-none transition-colors hover:bg-[#fafaf7] focus:border-[#cfcfca]"
              aria-label={`${row.original.header} reviewer`}
            >
              {reviewerOptions.map((reviewer) => (
                <option key={reviewer} value={reviewer}>
                  {reviewer}
                </option>
              ))}
            </select>
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
    [openEditor, updateItem]
  )

  // TanStack Table is an intentional exception to the React Compiler lint rule here.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tableData,
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
          <ScheduleTabs
            activeView={activeView}
            onChange={setActiveView}
            counts={viewCounts}
          />
          <div className="flex items-center gap-2">
            <ColumnToggleMenu columns={visibleColumns} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              className="border-[#dbdbd6] bg-[#fafaf7] text-[#1d1d1b] hover:bg-[#f1f1ed]"
            >
              <Plus className="size-4" />
              <span className="hidden lg:inline">Add Section</span>
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
                          header.column.id === "header" && "w-[20%]",
                          header.column.id === "type" && "w-[18%]",
                          header.column.id === "status" && "w-[14%]",
                          header.column.id === "target" && "w-[11%]",
                          header.column.id === "limit" && "w-[11%]",
                          header.column.id === "reviewer" && "w-[16%]",
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
                              header: `${item.header} Copy`,
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
            This now uses the same center-based DnD pattern as your sample. Pagination is still omitted per your earlier requirement.
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
            <SheetTitle>{draft?.header ?? "Section details"}</SheetTitle>
            <SheetDescription>
              Review and update the copied section details without leaving the schedule table.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            <div className="rounded-xl border border-[#ecece8] bg-[#fbfbf8] p-4">
              <p className="text-[12px] font-semibold tracking-[0.12em] text-[#777772] uppercase">
                Section snapshot
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                  <p className="text-[11px] text-[#777772] uppercase">Status</p>
                  <div className="mt-2">
                    {draft ? <StatusPill value={draft.status} /> : null}
                  </div>
                </div>
                <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                  <p className="text-[11px] text-[#777772] uppercase">Target</p>
                  <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                    {draft?.target ?? "0"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#e7e7e4] bg-white px-3 py-2">
                  <p className="text-[11px] text-[#777772] uppercase">Limit</p>
                  <p className="mt-2 text-[13px] font-medium text-[#1d1d1b]">
                    {draft?.limit ?? "0"}
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
                <label htmlFor="schedule-header" className="text-[13px] font-medium text-[#1d1d1b]">
                  Header
                </label>
                <Input
                  id="schedule-header"
                  value={draft?.header ?? ""}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, header: event.target.value } : current
                    )
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="schedule-type" className="text-[13px] font-medium text-[#1d1d1b]">
                    Type
                  </label>
                  <select
                    id="schedule-type"
                    value={draft?.type ?? typeOptions[0]}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, type: event.target.value } : current
                      )
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-[13px] text-[#1d1d1b] outline-none focus:border-ring"
                  >
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="schedule-status" className="text-[13px] font-medium text-[#1d1d1b]">
                    Status
                  </label>
                  <select
                    id="schedule-status"
                    value={draft?.status ?? statusOptions[0]}
                    onChange={(event) =>
                      setDraft((current) =>
                        current
                          ? { ...current, status: event.target.value as ScheduleStatus }
                          : current
                      )
                    }
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-[13px] text-[#1d1d1b] outline-none focus:border-ring"
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label htmlFor="schedule-target" className="text-[13px] font-medium text-[#1d1d1b]">
                    Target
                  </label>
                  <Input
                    id="schedule-target"
                    value={draft?.target ?? ""}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, target: event.target.value } : current
                      )
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="schedule-limit" className="text-[13px] font-medium text-[#1d1d1b]">
                    Limit
                  </label>
                  <Input
                    id="schedule-limit"
                    value={draft?.limit ?? ""}
                    onChange={(event) =>
                      setDraft((current) =>
                        current ? { ...current, limit: event.target.value } : current
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="schedule-reviewer" className="text-[13px] font-medium text-[#1d1d1b]">
                  Reviewer
                </label>
                <select
                  id="schedule-reviewer"
                  value={draft?.reviewer ?? reviewerOptions[0]}
                  onChange={(event) =>
                    setDraft((current) =>
                      current ? { ...current, reviewer: event.target.value } : current
                    )
                  }
                  className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-[13px] text-[#1d1d1b] outline-none focus:border-ring"
                >
                  {reviewerOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
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
