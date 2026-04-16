import { createClient } from "@/lib/server";
import { getDrivePlan } from "@/lib/drive-plan";
import {
  normalizeCrewMemberPayload,
  validateCrewMemberPayload,
} from "@/lib/people";

type CrewMemberDriveContext = {
  pickup_time: string | null;
  pickup_to_location: string | null;
  pickup_to_location_name: string | null;
  pickup_to_location_address: string | null;
  driveSortOrder: number;
  stopSortLabel: string;
  stopCreatedAt: string;
};

function getDriveFinalDestination(drive: Awaited<ReturnType<typeof getDrivePlan>>[number]) {
  const lastStopAddress = [...drive.stops]
    .reverse()
    .find((stop) => stop.pickupAddress.trim())?.pickupAddress.trim();
  const locationName = drive.location?.name.trim() || null;
  const address =
    drive.destinationAddress.trim() ||
    lastStopAddress ||
    drive.startLocation.trim() ||
    drive.location?.address.trim() ||
    null;

  return {
    name: locationName,
    address,
    label: [locationName, address].filter(Boolean).join(" · ") || locationName || address || null,
  };
}

function isEarlierContext(nextContext: CrewMemberDriveContext, currentContext: CrewMemberDriveContext) {
  const nextHasPickupTime = Boolean(nextContext.pickup_time);
  const currentHasPickupTime = Boolean(currentContext.pickup_time);

  if (nextHasPickupTime && currentHasPickupTime && nextContext.stopSortLabel !== currentContext.stopSortLabel) {
    return nextContext.stopSortLabel < currentContext.stopSortLabel;
  }

  if (nextHasPickupTime !== currentHasPickupTime) {
    return nextHasPickupTime;
  }

  if (nextContext.driveSortOrder !== currentContext.driveSortOrder) {
    return nextContext.driveSortOrder < currentContext.driveSortOrder;
  }

  return nextContext.stopCreatedAt < currentContext.stopCreatedAt;
}

function buildCrewMemberDriveLookup(drives: Awaited<ReturnType<typeof getDrivePlan>>) {
  const lookup = new Map<string, CrewMemberDriveContext>();

  for (const drive of drives) {
    const pickupToLocation = getDriveFinalDestination(drive);

    for (const stop of drive.stops) {
      for (const passenger of stop.stopPickupPassengers) {
        const nextContext: CrewMemberDriveContext = {
          pickup_time: stop.pickupTimeLabel || null,
          pickup_to_location: pickupToLocation.label,
          pickup_to_location_name: pickupToLocation.name,
          pickup_to_location_address: pickupToLocation.address,
          driveSortOrder: drive.sortOrder,
          stopSortLabel: stop.pickupTimeLabel,
          stopCreatedAt: stop.createdAt,
        };
        const currentContext = lookup.get(passenger.id);

        if (!currentContext || isEarlierContext(nextContext, currentContext)) {
          lookup.set(passenger.id, nextContext);
        }
      }
    }
  }

  return lookup;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const includeDriveContext =
    new URL(request.url).searchParams.get("includeDriveContext") === "1";

  if (!includeDriveContext) {
    const { data, error } = await supabase
      .from("crew_members")
      .select("id, full_name, home_address, phone, default_role_title, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data ?? [], { status: 200 });
  }

  const [{ data, error }, drivePlanResult] = await Promise.all([
    supabase
      .from("crew_members")
      .select("id, full_name, home_address, phone, default_role_title, created_at")
      .order("created_at", { ascending: false }),
    getDrivePlan().catch((drivePlanError) => {
      console.error("[crew-members] Failed to load drive plan enrichment", {
        error:
          drivePlanError instanceof Error
            ? drivePlanError.message
            : drivePlanError,
      });

      return null;
    }),
  ]);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const driveLookup = drivePlanResult ? buildCrewMemberDriveLookup(drivePlanResult) : new Map();
  const enrichedData = (data ?? []).map((crewMember) => {
    const driveContext = driveLookup.get(crewMember.id);

    return {
      ...crewMember,
      pickup_time: driveContext?.pickup_time ?? null,
      pickup_to_location: driveContext?.pickup_to_location ?? null,
      pickup_to_location_name: driveContext?.pickup_to_location_name ?? null,
      pickup_to_location_address: driveContext?.pickup_to_location_address ?? null,
    };
  });

  return Response.json(enrichedData, { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload = normalizeCrewMemberPayload(await req.json());
  const validationError = validateCrewMemberPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crew_members")
    .insert([payload])
    .select("id, full_name, home_address, phone, default_role_title, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
