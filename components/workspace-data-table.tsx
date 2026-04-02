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
import { ChevronDown, FileUp, Settings2 } from "lucide-react"

import { readDroppedVCardPayloads, readSelectedVCardFiles } from "@/lib/vcard"
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
  renderRow: (row: Row<TData>, context: { rowIndex: number }) => React.ReactNode
  renderRowBefore?: (row: Row<TData>, rowIndex: number) => React.ReactNode
  renderTableBodyEnd?: React.ReactNode
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

type WorkspaceVCardToolbarControls = {
  openFilePicker: () => void
  isDragging: boolean
  isImporting: boolean
}

type WorkspaceVCardTableProps<TData> = Omit<
  WorkspaceDataTableProps<TData>,
  "toolbar" | "renderRowBefore" | "renderTableBodyEnd"
> & {
  toolbar?: React.ReactNode | ((controls: WorkspaceVCardToolbarControls) => React.ReactNode)
  importPrompt?: React.ReactNode
  activeImportPrompt?: React.ReactNode
  importNote?: React.ReactNode
  importButtonLabel?: string
  importInProgress?: boolean
  showImportPanel?: boolean
  onImportPayloads: (
    payloads: string[],
    context: { insertionIndex: number | null }
  ) => Promise<void> | void
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
                onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
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
  renderRowBefore,
  renderTableBodyEnd,
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

  const rows = table.getRowModel().rows

  const tableMarkup = (
    <Table className={tableClassName}>
      <TableHeader className={headerClassName}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className={headerRowClassName}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={getHeadClassName?.(header.column.id)}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
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
            {rows.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                {renderRowBefore?.(row, rowIndex)}
                {renderRow(row, { rowIndex })}
              </React.Fragment>
            ))}
            {renderTableBodyEnd}
          </SortableContext>
        ) : (
          <>
            {rows.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                {renderRowBefore?.(row, rowIndex)}
                {renderRow(row, { rowIndex })}
              </React.Fragment>
            ))}
            {renderTableBodyEnd}
          </>
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

export function WorkspaceVCardTable<TData>({
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
  importPrompt,
  activeImportPrompt = "Release to import these contacts.",
  importNote,
  importButtonLabel = "Import .vcf",
  importInProgress = false,
  showImportPanel = true,
  onImportPayloads,
}: WorkspaceVCardTableProps<TData>) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [dropTargetIndex, setDropTargetIndex] = React.useState<number | null>(null)
  const rows = table.getRowModel().rows

  const clearDragState = React.useCallback(() => {
    setIsDragging(false)
    setDropTargetIndex(null)
  }, [])

  const openFilePicker = React.useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const completeImport = React.useCallback(
    async (payloads: string[], insertionIndex: number | null) => {
      try {
        await onImportPayloads(payloads, { insertionIndex })
      } finally {
        clearDragState()
      }
    },
    [clearDragState, onImportPayloads]
  )

  const handleFileSelected = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? [])
      const payloads = await readSelectedVCardFiles(files)
      event.target.value = ""

      if (payloads.length === 0) {
        return
      }

      await completeImport(payloads, rows.length)
    },
    [completeImport, rows.length]
  )

  const handleDrop = React.useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      const payloads = await readDroppedVCardPayloads(event.dataTransfer)

      if (payloads.length === 0) {
        clearDragState()
        return
      }

      await completeImport(payloads, dropTargetIndex)
    },
    [clearDragState, completeImport, dropTargetIndex]
  )

  const handleDragOverContainer = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = "copy"
      setIsDragging(true)

      if (rows.length === 0) {
        setDropTargetIndex(0)
        return
      }

      if (dropTargetIndex === null) {
        const bounds = event.currentTarget.getBoundingClientRect()
        const insertionIndex =
          event.clientY < bounds.top + bounds.height / 2 ? 0 : rows.length

        setDropTargetIndex(insertionIndex)
      }
    },
    [dropTargetIndex, rows.length]
  )

  const handleDragLeaveContainer = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
        return
      }

      clearDragState()
    },
    [clearDragState]
  )

  const handleDragOverRow = React.useCallback((event: React.DragEvent<HTMLTableRowElement>, rowIndex: number) => {
    event.preventDefault()
    event.stopPropagation()

    const bounds = event.currentTarget.getBoundingClientRect()
    const insertionIndex =
      event.clientY < bounds.top + bounds.height / 2 ? rowIndex : rowIndex + 1

    setDropTargetIndex(insertionIndex)
    setIsDragging(true)
  }, [])

  const resolvedToolbar =
    typeof toolbar === "function"
      ? toolbar({
          openFilePicker,
          isDragging,
          isImporting: importInProgress,
        })
      : toolbar

  return (
    <div className="space-y-4">
      {resolvedToolbar}
      <input
        ref={fileInputRef}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleFileSelected(event)
        }}
      />
      <div
        className={cn(
          "rounded-xl border border-[#e7e7e4] bg-white p-2 transition-all",
          isDragging && "border-dashed border-[#90a8ff] bg-[#f7f9ff]"
        )}
        onDrop={(event) => {
          void handleDrop(event)
        }}
        onDragOver={handleDragOverContainer}
        onDragLeave={handleDragLeaveContainer}
      >
        {showImportPanel ? (
          <div
            className={cn(
              "flex flex-col gap-3 rounded-lg border border-dashed px-4 py-3 text-[12px] leading-5 transition-colors lg:flex-row lg:items-center lg:justify-between",
              isDragging
                ? "border-[#90a8ff] bg-[#eef3ff] text-[#3556a8]"
                : "border-[#d8d8d3] bg-[#fcfcfa] text-[#6b6b67]"
            )}
          >
            <div>
              {importPrompt ? (
                <p className="font-medium text-[#1d1d1b]">
                  {isDragging ? activeImportPrompt : importPrompt}
                </p>
              ) : null}
              {importNote ? (
                <div className={cn(importPrompt ? "mt-1" : undefined, "text-[11px] leading-5 text-[#6b6b67]")}>
                  {importNote}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
              onClick={openFilePicker}
              disabled={importInProgress}
            >
              <FileUp className="size-4" />
              {importButtonLabel}
            </Button>
          </div>
        ) : null}

        <WorkspaceDataTable
          table={table}
          dataIds={dataIds}
          renderRow={(row, context) => {
            const renderedRow = renderRow(row, context)

            if (!React.isValidElement(renderedRow)) {
              return renderedRow
            }

            const rowElement = renderedRow as React.ReactElement<{
              onDragOver?: (event: React.DragEvent<HTMLTableRowElement>) => void
            }>
            const existingOnDragOver = rowElement.props.onDragOver

            return React.cloneElement(rowElement, {
              onDragOver: (event: React.DragEvent<HTMLTableRowElement>) => {
                existingOnDragOver?.(event)
                handleDragOverRow(event, context.rowIndex)
              },
            })
          }}
          renderRowBefore={(row, rowIndex) =>
            isDragging && dropTargetIndex === rowIndex ? (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                  <div className="px-3 py-1">
                    <div className="h-7 animate-in fade-in zoom-in-95 rounded-lg border border-dashed border-[#9db1ff] bg-[#eef3ff]" />
                  </div>
                </TableCell>
              </TableRow>
            ) : null
          }
          renderTableBodyEnd={
            isDragging && dropTargetIndex === rows.length ? (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={table.getVisibleLeafColumns().length} className="p-0">
                  <div className="px-3 py-1">
                    <div className="h-7 animate-in fade-in zoom-in-95 rounded-lg border border-dashed border-[#9db1ff] bg-[#eef3ff]" />
                  </div>
                </TableCell>
              </TableRow>
            ) : null
          }
          emptyState={emptyState}
          sortable={sortable}
          sortableId={sortableId}
          onDragEnd={onDragEnd}
          containerClassName={cn(showImportPanel && "mt-3", containerClassName)}
          tableClassName={tableClassName}
          headerClassName={headerClassName}
          headerRowClassName={headerRowClassName}
          getHeadClassName={getHeadClassName}
        />
        {footer ? <div className="mt-3">{footer}</div> : null}
      </div>
    </div>
  )
}
