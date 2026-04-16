"use client";

import { useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type CellContext,
  type ColumnDef,
  type HeaderContext,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  useReactTable,
} from "@tanstack/react-table";

import {
  WorkspaceColumnToggleMenu,
  WorkspaceVCardTable,
} from "@/components/workspace-data-table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { type Drive } from "@/lib/drive-plan";
import { getTravelTypeLabel } from "@/lib/travels";
import { cn } from "@/lib/utils";

type DashboardRunRow = {
  id: string;
  routeLabel: string;
  routeDetail: string;
  vehicleLabel: string;
  vehicleDetail: string;
  peopleLabel: string;
  peopleDetail: string;
  peopleCount: number;
  departureLabel: string;
  departureDetail: string;
  departureSort: number;
  statusLabel: string;
  statusTone: string;
  statusRank: number;
};

const defaultColumnVisibility: VisibilityState = {
  select: false,
};

function ColumnHeader({
  label,
  canSort,
  onClick,
  className,
}: {
  label: string;
  canSort: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (!canSort) {
    return (
      <div
        className={cn(
          "px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase",
          className,
        )}
      >
        {label}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-7 px-3 text-[11px] font-semibold tracking-[0.14em] text-[#777772] uppercase hover:bg-[#f3f3ef] hover:text-[#1d1d1b]",
        className,
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function getPrimaryAddressLine(value: string) {
  return value.split(",")[0]?.trim() || value.trim();
}

function getDriveViaLabel(drive: Drive) {
  const viaAddresses = Array.from(
    new Set(
      drive.stops
        .map((stop) => getPrimaryAddressLine(stop.pickupAddress))
        .filter(Boolean),
    ),
  ).slice(0, 2);

  return viaAddresses.length > 0 ? ` via ${viaAddresses.join(", ")}` : "";
}

function getDrivePassengerSummary(drive: Drive) {
  const uniquePassengers = new Map<string, string>();

  for (const stop of drive.stops) {
    for (const passenger of stop.stopPickupPassengers) {
      const key = passenger.id || `${passenger.name}:${passenger.address}`;

      if (!uniquePassengers.has(key)) {
        uniquePassengers.set(key, passenger.name);
      }
    }
  }

  const names = Array.from(uniquePassengers.values());
  const previewNames = names.slice(0, 2).join(", ");
  const remainingCount = names.length - 2;

  return {
    count: names.length,
    detail:
      names.length === 0
        ? drive.driver?.name
          ? `Driver: ${drive.driver.name}`
          : "No riders assigned"
        : remainingCount > 0
          ? `${previewNames} +${remainingCount}`
          : previewNames,
  };
}

function getDriveDepartureMinutes(drive: Drive) {
  const timeLabel = drive.scheduledTimeLabel || drive.stops[0]?.pickupTimeLabel || "";
  const match = timeLabel.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function getDashboardStatus(drive: Drive, passengerCount: number) {
  if (!drive.location && drive.stops.length === 0 && !drive.van && !drive.scheduledTimeLabel) {
    return {
      label: "Draft",
      tone: "border-[#d7d7d2] bg-[#f3f3ef] text-[#6b6b67]",
      rank: 0,
    };
  }

  if (!drive.van) {
    return {
      label: "Needs vehicle",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 1,
    };
  }

  if (drive.travelType === "pickup" && !drive.scheduledTimeLabel) {
    return {
      label: "Needs arrival",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 2,
    };
  }

  if (drive.stops.length === 0) {
    return {
      label: "Needs stops",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 3,
    };
  }

  if (passengerCount === 0) {
    return {
      label: "Needs people",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      rank: 4,
    };
  }

  return {
    label: "Ready",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rank: 5,
  };
}

function mapDriveToDashboardRun(drive: Drive): DashboardRunRow {
  const passengerSummary = getDrivePassengerSummary(drive);
  const status = getDashboardStatus(drive, passengerSummary.count);
  const travelTypeLabel = getTravelTypeLabel(drive.travelType);
  const setLocationLabel = getPrimaryAddressLine(
    drive.location?.name || drive.location?.address || drive.destinationAddress || drive.startLocation,
  );
  const viaLabel = getDriveViaLabel(drive);
  const routeDetail =
    drive.stops.length === 0
      ? `No ${drive.travelType} stops yet`
      : `${drive.stops.length} ${drive.travelType} stop${drive.stops.length === 1 ? "" : "s"}${viaLabel}`;
  const routeLabel =
    setLocationLabel
      ? drive.travelType === "pickup"
        ? `Pickup to ${setLocationLabel}`
        : `Dropoff from ${setLocationLabel}`
      : drive.label;
  const vehicleLabel = drive.van?.label?.trim() || drive.van?.plate_number?.trim() || "Unassigned";
  const vehicleDetail = drive.van
    ? [drive.van.vehicle_type?.trim(), `${travelTypeLabel} drive`]
        .filter(Boolean)
        .join(" / ") || "Vehicle assigned"
    : "Assign a vehicle";
  const departureLabel = drive.scheduledTimeLabel || drive.stops[0]?.pickupTimeLabel || "Not set";
  const departureDetail = drive.scheduledTimeLabel
    ? drive.travelType === "pickup"
      ? "Arrive by set call time"
      : setLocationLabel
        ? `Depart from ${setLocationLabel}`
        : "Wrap departure"
    : drive.stops[0]?.pickupTimeLabel
      ? `First ${drive.travelType} stop`
      : drive.travelType === "pickup"
        ? "Add arrival time"
        : "Add departure time";

  return {
    id: drive.id,
    routeLabel,
    routeDetail,
    vehicleLabel,
    vehicleDetail,
    peopleLabel: `${passengerSummary.count} rider${passengerSummary.count === 1 ? "" : "s"}`,
    peopleDetail: passengerSummary.detail,
    peopleCount: passengerSummary.count,
    departureLabel,
    departureDetail,
    departureSort: getDriveDepartureMinutes(drive),
    statusLabel: status.label,
    statusTone: status.tone,
    statusRank: status.rank,
  };
}

export function DashboardUpcomingRunsTable({ drives }: { drives: Drive[] }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "departure", desc: false }]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultColumnVisibility);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const rows = drives.map(mapDriveToDashboardRun);

  const columns: ColumnDef<DashboardRunRow>[] = [
    {
      id: "select",
      meta: { label: "Select" },
      enableSorting: false,
      header: ({ table }: HeaderContext<DashboardRunRow, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={
              table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            aria-label="Select all upcoming runs"
          />
        </div>
      ),
      cell: ({ row }: CellContext<DashboardRunRow, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.routeLabel}`}
          />
        </div>
      ),
    },
    {
      accessorKey: "routeLabel",
      id: "route",
      meta: { label: "Route" },
      header: ({ column }: HeaderContext<DashboardRunRow, unknown>) => (
        <ColumnHeader
          label="Route"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<DashboardRunRow, unknown>) => (
        <div className="px-3">
          <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{row.original.routeLabel}</p>
          <p className="mt-1 text-[12px] text-[#6b6b67]">{row.original.routeDetail}</p>
        </div>
      ),
    },
    {
      accessorKey: "vehicleLabel",
      id: "vehicle",
      meta: { label: "Vehicle" },
      header: ({ column }: HeaderContext<DashboardRunRow, unknown>) => (
        <ColumnHeader
          label="Vehicle"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<DashboardRunRow, unknown>) => (
        <div className="px-3">
          <p className="truncate text-[14px] font-medium text-[#1d1d1b]">{row.original.vehicleLabel}</p>
          <p className="mt-1 truncate text-[12px] text-[#6b6b67]">{row.original.vehicleDetail}</p>
        </div>
      ),
    },
    {
      accessorKey: "peopleCount",
      id: "people",
      meta: { label: "People" },
      header: ({ column }: HeaderContext<DashboardRunRow, unknown>) => (
        <ColumnHeader
          label="People"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<DashboardRunRow, unknown>) => (
        <div className="px-3">
          <p className="text-[14px] font-medium text-[#1d1d1b]">{row.original.peopleLabel}</p>
          <p className="mt-1 truncate text-[12px] text-[#6b6b67]">{row.original.peopleDetail}</p>
        </div>
      ),
    },
    {
      accessorKey: "departureSort",
      id: "departure",
      meta: { label: "Departure" },
      header: ({ column }: HeaderContext<DashboardRunRow, unknown>) => (
        <ColumnHeader
          label="Departure"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<DashboardRunRow, unknown>) => (
        <div className="px-3">
          <p className="text-[14px] font-medium text-[#1d1d1b]">{row.original.departureLabel}</p>
          <p className="mt-1 truncate text-[12px] text-[#6b6b67]">{row.original.departureDetail}</p>
        </div>
      ),
    },
    {
      accessorKey: "statusRank",
      id: "status",
      meta: { label: "Status" },
      header: ({ column }: HeaderContext<DashboardRunRow, unknown>) => (
        <ColumnHeader
          label="Status"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<DashboardRunRow, unknown>) => (
        <div className="px-3">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${row.original.statusTone}`}
          >
            {row.original.statusLabel}
          </span>
        </div>
      ),
    },
  ];

  const table = useReactTable<DashboardRunRow>({
    data: rows,
    columns,
    state: {
      rowSelection,
      sorting,
      columnVisibility,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const visibleColumns = table.getAllColumns().filter((column) => column.getCanHide());

  return (
    <WorkspaceVCardTable
      table={table}
      dataIds={rows.map((row) => row.id)}
      showImportPanel={false}
      toolbar={
        <div className="flex items-center justify-end">
          <WorkspaceColumnToggleMenu columns={visibleColumns} />
        </div>
      }
      onImportPayloads={() => {}}
      containerClassName="overflow-x-auto"
      tableClassName="min-w-[920px] table-fixed"
      headerClassName="bg-[#f7f7f4]"
      headerRowClassName="border-[#ecece8] hover:bg-transparent"
      getHeadClassName={(columnId) =>
        cn(
          "h-11 border-b border-[#ecece8] bg-[#f7f7f4] px-0 align-middle",
          columnId === "select" && "w-[56px]",
          columnId === "route" && "w-[28%]",
          columnId === "vehicle" && "w-[24%]",
          columnId === "people" && "w-[18%]",
          columnId === "departure" && "w-[14%]",
          columnId === "status" && "w-[16%]",
        )
      }
      emptyState={
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={table.getVisibleLeafColumns().length} className="py-14 text-center">
            <div className="flex flex-col items-center gap-3">
              <div>
                <p className="text-[14px] font-medium text-[#1d1d1b]">No runs have been created yet.</p>
                <p className="mt-1 text-[13px] text-[#6b6b67]">
                  Create the first route to start building upcoming dispatches.
                </p>
              </div>
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
              )}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </TableCell>
          ))}
        </TableRow>
      )}
    />
  );
}
