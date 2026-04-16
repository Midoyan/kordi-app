import "server-only";

import type { Drive, TransportPlan } from "@/lib/drive-plan";
import type { ScheduleStopInput } from "@/lib/schedule-recalculation";

export type RouteConflict = {
  driveId: string;
  driveLabel: string;
  issue: string;
};

export function countUniquePassengers(drive: Drive) {
  return new Set(
    drive.stops.flatMap((stop) => stop.stopPickupPassengers.map((passenger) => passenger.id)),
  ).size;
}

export function getDriveArrivalTime(drive: Drive) {
  return drive.scheduledTimeLabel.trim() || drive.stops[drive.stops.length - 1]?.pickupTimeLabel.trim() || "";
}

export function buildScheduleInputs(drive: Drive): ScheduleStopInput[] {
  return drive.stops.map((stop) => ({
    id: stop.id,
    pickupAddress: stop.pickupAddress.trim(),
    endDestination: drive.destinationAddress.trim(),
    stopDurationSec: stop.stopDurationSec,
    trafficBufferSec: stop.trafficBufferSec,
  }));
}

export function buildTransportOverview(transportPlan: TransportPlan) {
  return {
    driveCount: transportPlan.drives.length,
    stopCount: transportPlan.drives.reduce((total, drive) => total + drive.stops.length, 0),
    passengerCount: new Set(
      transportPlan.drives.flatMap((drive) =>
        drive.stops.flatMap((stop) => stop.stopPickupPassengers.map((passenger) => passenger.id)),
      ),
    ).size,
    drives: transportPlan.drives.map((drive) => ({
      id: drive.id,
      label: drive.label,
      vanLabel: drive.van?.label?.trim() || "No van",
      destination: drive.destinationAddress.trim() || drive.startLocation.trim() || "No destination",
      scheduledTime: getDriveArrivalTime(drive),
      stopCount: drive.stops.length,
      passengerCount: countUniquePassengers(drive),
    })),
  };
}

export function detectTransportConflicts(transportPlan: TransportPlan) {
  const conflicts: RouteConflict[] = [];

  for (const drive of transportPlan.drives) {
    const passengerCount = countUniquePassengers(drive);
    const seatCapacity = typeof drive.van?.seat_capacity === "number" ? drive.van.seat_capacity : null;

    if (!drive.vanId) {
      conflicts.push({
        driveId: drive.id,
        driveLabel: drive.label,
        issue: "No van is assigned.",
      });
    }

    if (drive.travelType === "pickup" && !drive.destinationAddress.trim()) {
      conflicts.push({
        driveId: drive.id,
        driveLabel: drive.label,
        issue: "Pickup drive is missing a destination address.",
      });
    }

    if (!getDriveArrivalTime(drive)) {
      conflicts.push({
        driveId: drive.id,
        driveLabel: drive.label,
        issue: "No final schedule time is set.",
      });
    }

    if (seatCapacity !== null && passengerCount > seatCapacity) {
      conflicts.push({
        driveId: drive.id,
        driveLabel: drive.label,
        issue: `Capacity exceeded by ${passengerCount - seatCapacity}.`,
      });
    }

    for (const stop of drive.stops) {
      if (!stop.pickupAddress.trim()) {
        conflicts.push({
          driveId: drive.id,
          driveLabel: drive.label,
          issue: `Stop "${stop.stopTitle}" has no pickup address.`,
        });
      }

      if (stop.stopPickupPassengers.length === 0) {
        conflicts.push({
          driveId: drive.id,
          driveLabel: drive.label,
          issue: `Stop "${stop.stopTitle}" has no passengers assigned.`,
        });
      }
    }
  }

  return conflicts;
}
