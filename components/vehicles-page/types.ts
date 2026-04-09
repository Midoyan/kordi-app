"use client";

import { type VisibilityState } from "@tanstack/react-table";

import { type VehicleDraft, type VehicleRecord, type VehicleType } from "@/lib/vehicles";

export type VehicleAvailability = "Active" | "Inactive";
export type PersistenceMode = "checking" | "connected" | "local-only";
export type SheetMode = "create" | "edit";

export type VehicleForm = {
  label: string;
  plateNumber: string;
  seatCapacity: string;
  vehicleType: VehicleType;
  availability: VehicleAvailability;
  driverCrewMemberId: string;
  driverName: string;
  notes: string;
};

export type VehicleFieldError = {
  label?: string;
  plateNumber?: string;
  seatCapacity?: string;
  driver?: string;
};

export const CREATE_DRIVER_VALUE_PREFIX = "__create-driver__:";
export const CLEAR_DRIVER_VALUE = "__clear-driver__";

export const initialForm: VehicleForm = {
  label: "",
  plateNumber: "",
  seatCapacity: "6",
  vehicleType: "Van",
  availability: "Active",
  driverCrewMemberId: "",
  driverName: "",
  notes: "",
};

export const defaultColumnVisibility: VisibilityState = {
  select: false,
  driver: false,
  status: false,
  plateNumber: false,
  seatCapacity: false,
};

export const sampleVehicleForms: VehicleForm[] = [
  {
    label: "Sprinter 12",
    plateNumber: "8TRN214",
    seatCapacity: "8",
    vehicleType: "Van",
    availability: "Active",
    driverCrewMemberId: "",
    driverName: "",
    notes: "Stage door pickup. Keep rear cargo lane clear.",
  },
  {
    label: "Shuttle North",
    plateNumber: "9LAX552",
    seatCapacity: "12",
    vehicleType: "Shuttle",
    availability: "Active",
    driverCrewMemberId: "",
    driverName: "",
    notes: "Hotel loop until 11:00 AM.",
  },
  {
    label: "Runner 03",
    plateNumber: "7KRD118",
    seatCapacity: "5",
    vehicleType: "SUV",
    availability: "Inactive",
    driverCrewMemberId: "",
    driverName: "",
    notes: "Inspection due before next dispatch.",
  },
];

export function toVehicleForm(vehicle: VehicleRecord): VehicleForm {
  return {
    label: vehicle.label,
    plateNumber: vehicle.plateNumber,
    seatCapacity: String(vehicle.seatCapacity || ""),
    vehicleType: vehicle.vehicleType,
    availability: vehicle.isActive ? "Active" : "Inactive",
    driverCrewMemberId: vehicle.crewMemberId ?? "",
    driverName: vehicle.driverName,
    notes: vehicle.notes,
  };
}

export function validateVehicleForm(form: VehicleForm) {
  const errors: VehicleFieldError = {};
  const seatCapacity = Number(form.seatCapacity);
  const driverName = form.driverName.trim();

  if (!form.label.trim()) {
    errors.label = "Enter a vehicle title.";
  }

  if (!form.plateNumber.trim()) {
    errors.plateNumber = "Enter the license plate.";
  }

  if (!form.seatCapacity.trim()) {
    errors.seatCapacity = "Enter a seat count.";
  } else if (!Number.isFinite(seatCapacity) || seatCapacity < 1) {
    errors.seatCapacity = "Capacity must be greater than 0.";
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    driverName,
    draft: {
      label: form.label.trim(),
      plateNumber: form.plateNumber.trim(),
      seatCapacity,
      vehicleType: form.vehicleType,
      notes: form.notes.trim(),
      isActive: form.availability === "Active",
      crewMemberId: form.driverCrewMemberId.trim() || null,
    } satisfies VehicleDraft,
  };
}
