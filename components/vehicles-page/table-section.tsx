"use client";

import { flexRender, type Column, type Table as ReactTable } from "@tanstack/react-table";
import { Plus } from "lucide-react";

import {
  WorkspaceColumnToggleMenu,
  WorkspaceDataTable,
} from "@/components/workspace-data-table";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { type VehicleRecord } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

import { type PersistenceMode } from "@/components/vehicles-page/types";
import { Panel } from "@/components/vehicles-page/ui";

type VehiclesTableSectionProps = {
  table: ReactTable<VehicleRecord>;
  vehicles: VehicleRecord[];
  visibleColumns: Column<VehicleRecord, unknown>[];
  isLoading: boolean;
  loadError: string | null;
  persistenceMode: PersistenceMode;
  onRetry: () => void;
  onOpenCreate: () => void;
};

export function VehiclesTableSection({
  table,
  vehicles,
  visibleColumns,
  isLoading,
  loadError,
  persistenceMode,
  onRetry,
  onOpenCreate,
}: VehiclesTableSectionProps) {
  return (
    <Panel
      title="Vehicles"
      description="Load and manage the vans."
      action={
        <button
          type="button"
          onClick={onOpenCreate}
          className="inline-flex items-center gap-2 rounded-md border border-[#1f1f1d] bg-[#1f1f1d] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#343431]"
        >
          <Plus className="size-4" />
          Add van
        </button>
      }
    >
      <div className="space-y-4">
        {persistenceMode === "local-only" ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            <p className="font-medium">
              A working vans CRUD/load path was not detected on load, so this page is falling back
              to local-only mode until the `vans` table is reachable.
            </p>
            <p className="mt-1 text-[12px] text-amber-800">
              {loadError
                ? loadError
                : "Changes work in the UI, but they reset on refresh until persistence is available."}
            </p>
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-300 bg-white/80 text-amber-900 hover:bg-white"
                onClick={onRetry}
              >
                Retry backend
              </Button>
            </div>
          </div>
        ) : null}

        {persistenceMode === "connected" && loadError ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            {loadError}
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-[#e7e7e4] bg-[#fafaf7] text-[13px] text-[#6b6b67]">
            Loading saved vans...
          </div>
        ) : (
          <WorkspaceDataTable
            table={table}
            dataIds={vehicles.map((vehicle) => vehicle.id)}
            toolbar={
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <p className="text-[13px] leading-6 text-[#6b6b67]">
                  {vehicles.length === 0
                    ? "No vans saved yet."
                    : `${vehicles.length} saved van${vehicles.length === 1 ? "" : "s"} ready for assignment.`}
                </p>
                <WorkspaceColumnToggleMenu columns={visibleColumns} />
              </div>
            }
            containerClassName="overflow-x-auto"
            tableClassName="min-w-[920px] table-fixed"
            headerClassName="bg-[#f7f7f4]"
            headerRowClassName="border-[#ecece8] hover:bg-transparent"
            getHeadClassName={(columnId) =>
              cn(
                "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-0 align-middle",
                columnId === "select" && "w-[56px]",
                columnId === "label" && "w-[24%]",
                columnId === "driver" && "w-[18%]",
                columnId === "vehicleType" && "w-[14%]",
                columnId === "notes" && "w-[28%]",
                columnId === "plateNumber" && "w-[12%]",
                columnId === "seatCapacity" && "w-[12%]",
                columnId === "status" && "w-[12%]",
                columnId === "actions" && "w-[14%]",
              )
            }
            emptyState={
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="py-14 text-center"
                >
                  <div className="flex flex-col items-center gap-3">
                    <div>
                      <p className="text-[14px] font-medium text-[#1d1d1b]">No vans added yet.</p>
                      <p className="mt-1 text-[13px] text-[#6b6b67]">
                        Keep fleet records in one shared table and show only the columns you need.
                      </p>
                    </div>
                    <Button type="button" variant="outline" onClick={onOpenCreate}>
                      Add first van
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            }
            renderRow={(row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className="border-[#f0f0ec] hover:bg-[#fafaf7] data-[state=selected]:bg-[#f7f9ff]"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      "px-0 py-4 align-top",
                      cell.column.id === "select" && "py-4",
                      cell.column.id === "actions" && "py-3",
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            )}
          />
        )}
      </div>
    </Panel>
  );
}
