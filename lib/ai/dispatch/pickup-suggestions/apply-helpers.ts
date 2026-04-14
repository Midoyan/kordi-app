import type { Drive } from "@/lib/drive-plan";
import { getDrivePlan } from "@/lib/drive-plan";
import {
  assertMapboxToken,
  optimizeScheduleStops,
  recalculateScheduleStops,
  type CoordinateCache,
} from "@/lib/mapbox-schedule";
import { buildScheduleInputs, getDriveArrivalTime } from "@/lib/ai/dispatch/transport";
import { createClient } from "@/lib/server";

import type { ExistingPickupAssignment } from "@/lib/ai/dispatch/pickup-suggestions/shared";

export async function attachPassengerToStop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stopId: string,
  crewMemberId: string,
) {
  const { data: existingPassengerLink, error: existingPassengerError } = await supabase
    .from("trip_passengers")
    .select("trip_id")
    .eq("trip_id", stopId)
    .eq("crew_member_id", crewMemberId)
    .maybeSingle();

  if (existingPassengerError) {
    throw new Error(existingPassengerError.message);
  }

  if (existingPassengerLink) {
    return false;
  }

  const { error: passengerError } = await supabase.from("trip_passengers").insert([
    {
      trip_id: stopId,
      crew_member_id: crewMemberId,
    },
  ]);

  if (passengerError) {
    throw new Error(passengerError.message);
  }

  return true;
}

export function findExistingPickupAssignments(drives: Drive[], crewMemberId: string): ExistingPickupAssignment[] {
  return drives
    .filter((drive) => drive.travelType === "pickup")
    .flatMap((drive) =>
      drive.stops.flatMap((stop) => {
        const isAssigned = stop.stopPickupPassengers.some((passenger) => passenger.id === crewMemberId);

        if (!isAssigned) {
          return [];
        }

        return [
          {
            driveId: drive.id,
            stopId: stop.id,
            stopDeleted: false,
            stopSnapshot: {
              id: stop.id,
              driveId: drive.id,
              pickupAddress: stop.pickupAddress.trim(),
              pickupTime: stop.pickupTime,
              stopTitle: stop.stopTitle,
              stopDurationSec: stop.stopDurationSec,
              trafficBufferSec: stop.trafficBufferSec,
              notes: stop.notes,
            },
            remainingPassengerCount: stop.stopPickupPassengers.filter((passenger) => passenger.id !== crewMemberId)
              .length,
          },
        ];
      }),
    );
}

export function captureOriginalStopTimes(drives: Drive[], driveIds: Iterable<string>) {
  const targetDriveIds = new Set(Array.from(driveIds));
  const originalStopTimeById = new Map<string, string | null>();

  for (const drive of drives) {
    if (!targetDriveIds.has(drive.id)) {
      continue;
    }

    for (const stop of drive.stops) {
      originalStopTimeById.set(stop.id, stop.pickupTime);
    }
  }

  return originalStopTimeById;
}

export async function recalculateAffectedPickupDrives(
  supabase: Awaited<ReturnType<typeof createClient>>,
  driveIds: Iterable<string>,
) {
  const targetDriveIds = new Set(Array.from(driveIds));

  if (targetDriveIds.size === 0) {
    return;
  }

  const refreshedDrivePlan = await getDrivePlan();
  const token = assertMapboxToken();
  const cache: CoordinateCache = new Map();

  for (const drive of refreshedDrivePlan) {
    if (!targetDriveIds.has(drive.id) || drive.travelType !== "pickup") {
      continue;
    }

    const updatedStops = buildScheduleInputs(drive);

    if (updatedStops.length === 0) {
      continue;
    }

    const { orderedStops } = await optimizeScheduleStops(updatedStops, token);
    const recalculatedStops = await recalculateScheduleStops(orderedStops, getDriveArrivalTime(drive), cache, token);
    const updateResults = await Promise.all(
      recalculatedStops.map((stop) =>
        supabase
          .from("trips")
          .update({ pickup_time: `${stop.pickupTime}:00` })
          .eq("id", stop.id),
      ),
    );
    const failedUpdate = updateResults.find((result) => result.error);

    if (failedUpdate?.error) {
      throw new Error(failedUpdate.error.message);
    }
  }
}
