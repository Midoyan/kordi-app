import {
  type CellContext,
  type ColumnDef,
  type HeaderContext,
} from "@tanstack/react-table";
import { PencilLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { type VehicleRecord } from "@/lib/vehicles";

import { ColumnHeader, availabilityTone } from "@/components/vehicles-page/ui";

type CreateVehicleColumnsOptions = {
  deletingVehicleId: string | null;
  onEditVehicle: (vehicle: VehicleRecord) => void;
  onDeleteVehicle: (vehicle: VehicleRecord) => Promise<void> | void;
};

export function createVehicleColumns({
  deletingVehicleId,
  onEditVehicle,
  onDeleteVehicle,
}: CreateVehicleColumnsOptions): ColumnDef<VehicleRecord>[] {
  return [
    {
      id: "select",
      meta: { label: "Select" },
      enableSorting: false,
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            aria-label={`Select ${row.original.label}`}
          />
        </div>
      ),
      header: ({ table }: HeaderContext<VehicleRecord, unknown>) => (
        <div className="flex items-center justify-center px-3">
          <Checkbox
            checked={
              table.getIsAllRowsSelected() || (table.getIsSomeRowsSelected() ? "indeterminate" : false)
            }
            onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
            aria-label="Select all vehicles"
          />
        </div>
      ),
    },
    {
      accessorKey: "label",
      meta: { label: "Vehicle" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Vehicle"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="space-y-1 px-3">
          <p className="text-[15px] font-semibold tracking-tight text-[#1d1d1b]">
            {row.original.label}
          </p>
          <p className="text-[12px] text-[#7a7a74]">
            Added {row.original.createdAt ? new Date(row.original.createdAt).toLocaleDateString() : "recently"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "vehicleType",
      meta: { label: "Type" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Type"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3">
          <span className="text-[12px] text-[#000000]">{row.original.vehicleType}</span>
        </div>
      ),
    },
    {
      accessorKey: "notes",
      meta: { label: "Notes" },
      enableSorting: false,
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Notes"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3">
          <p className="whitespace-normal text-[13px] leading-6 text-[#6b6b67]">
            {row.original.notes || "No notes"}
          </p>
        </div>
      ),
    },
    {
      id: "plateNumber",
      accessorFn: (row) => row.plateNumber,
      meta: { label: "Plate" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Plate"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3 text-[13px] text-[#43433f]">
          {row.original.plateNumber || "No plate"}
        </div>
      ),
    },
    {
      id: "seatCapacity",
      accessorFn: (row) => row.seatCapacity,
      meta: { label: "Capacity" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Capacity"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="px-3 text-[13px] text-[#43433f]">{row.original.seatCapacity} seats</div>
      ),
    },
    {
      id: "status",
      accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
      meta: { label: "Status" },
      header: ({ column }: HeaderContext<VehicleRecord, unknown>) => (
        <ColumnHeader
          label="Status"
          canSort={column.getCanSort()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      ),
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => {
        const availability = row.original.isActive ? "Active" : "Inactive";

        return (
          <div className="px-3">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-[12px] font-medium ${availabilityTone(availability)}`}
            >
              {availability}
            </span>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }: CellContext<VehicleRecord, unknown>) => (
        <div className="flex items-center justify-end gap-1 px-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#5d5d58] hover:bg-[#f3f3ef] hover:text-[#1d1d1b]"
            onClick={() => onEditVehicle(row.original)}
          >
            <PencilLine />
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-[#8a4d42] hover:bg-[#fff3f0] hover:text-[#6f2f24]"
            onClick={() => {
              void onDeleteVehicle(row.original);
            }}
            disabled={deletingVehicleId === row.original.id}
          >
            <Trash2 />
            {deletingVehicleId === row.original.id ? "Removing..." : "Remove"}
          </Button>
        </div>
      ),
    },
  ];
}
