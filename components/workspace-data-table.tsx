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
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { flexRender, type Column, type Row, type Table as ReactTable } from "@tanstack/react-table"
import { ChevronDown, Settings2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type WorkspaceDataTableProps<TData> = {
  table: ReactTable<TData>
  dataIds: UniqueIdentifier[]
  renderRow: (row: Row<TData>) => React.ReactNode
  toolbar?: React.ReactNode
  footer?: React.ReactNode
  emptyState?: React.ReactNode
  sortable?: boolean
  sortableId?: string
  onDragEnd?: (event: DragEndEvent) => void
  containerClassName?: string
  tableClassName?: string
  headerClassName?: string
  headerRowClassName?: string
  getHeadClassName?: (columnId: string) => string | undefined
}

type WorkspaceColumnToggleMenuProps<TData> = {
  columns: Column<TData, unknown>[]
  className?: string
}

function getColumnToggleLabel<TData>(column: Column<TData, unknown>) {
  const meta = column.columnDef.meta as { label?: string } | undefined

  if (meta?.label) {
    return meta.label
  }

  return column.id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll("-", " ")
}

export function WorkspaceColumnToggleMenu<TData>({
  columns,
  className,
}: WorkspaceColumnToggleMenuProps<TData>) {
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
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings2 className="size-4" />
        <span className="hidden lg:inline">Columns</span>
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

export function WorkspaceDataTable<TData>({
  table,
  dataIds,
  renderRow,
  toolbar,
  footer,
  emptyState,
  sortable = false,
  sortableId,
  onDragEnd,
  containerClassName,
  tableClassName,
  headerClassName,
  headerRowClassName,
  getHeadClassName,
}: WorkspaceDataTableProps<TData>) {
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  const tableMarkup = (
    <Table className={tableClassName}>
      <TableHeader className={headerClassName}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className={headerRowClassName}
          >
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={getHeadClassName?.(header.column.id)}
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
          emptyState ?? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={table.getVisibleLeafColumns().length}
                className="py-14 text-center text-[13px] text-[#6b6b67]"
              >
                No results.
              </TableCell>
            </TableRow>
          )
        ) : sortable ? (
          <SortableContext items={dataIds} strategy={verticalListSortingStrategy}>
            {table.getRowModel().rows.map((row) => renderRow(row))}
          </SortableContext>
        ) : (
          table.getRowModel().rows.map((row) => renderRow(row))
        )}
      </TableBody>
    </Table>
  )

  return (
    <div className="space-y-4">
      {toolbar}
      <div className={cn("overflow-hidden rounded-xl border border-[#ecece8]", containerClassName)}>
        {sortable ? (
          <DndContext
            id={sortableId}
            autoScroll={false}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            sensors={sensors}
            onDragEnd={onDragEnd}
          >
            {tableMarkup}
          </DndContext>
        ) : (
          tableMarkup
        )}
      </div>
      {footer}
    </div>
  )
}
