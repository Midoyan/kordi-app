import "server-only";

import { createClient } from "@/lib/server";

type IdRecord = {
  id: string;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type DeleteTripCascadeResult = {
  success: true;
};

export type DeleteTravelCascadeResult = {
  success: true;
  deletedTripCount: number;
};

export type DeleteVanCascadeResult = {
  success: true;
  deletedTravelCount: number;
  deletedTripCount: number;
};

function extractIds(rows: unknown) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => (row as IdRecord).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

async function deleteTripPassengersByTripIds(supabase: SupabaseClient, tripIds: string[]) {
  if (tripIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("trip_passengers")
    .delete()
    .in("trip_id", tripIds);

  if (error) {
    throw new Error(error.message);
  }
}

async function deleteTripsByIds(supabase: SupabaseClient, tripIds: string[]) {
  if (tripIds.length === 0) {
    return;
  }

  await deleteTripPassengersByTripIds(supabase, tripIds);

  const { error } = await supabase
    .from("trips")
    .delete()
    .in("id", tripIds);

  if (error) {
    throw new Error(error.message);
  }
}

async function getTripIdsForTravelIds(supabase: SupabaseClient, travelIds: string[]) {
  if (travelIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("trips")
    .select("id")
    .in("travel_id", travelIds);

  if (error) {
    throw new Error(error.message);
  }

  return extractIds(data);
}

async function deleteTravelsByIds(supabase: SupabaseClient, travelIds: string[]) {
  if (travelIds.length === 0) {
    return { deletedTripCount: 0 };
  }

  const tripIds = await getTripIdsForTravelIds(supabase, travelIds);
  await deleteTripsByIds(supabase, tripIds);

  const { error } = await supabase
    .from("travels2")
    .delete()
    .in("id", travelIds);

  if (error) {
    throw new Error(error.message);
  }

  return {
    deletedTripCount: tripIds.length,
  };
}

async function getTravelIdsForVanId(supabase: SupabaseClient, vanId: string) {
  const { data, error } = await supabase
    .from("travels2")
    .select("id")
    .eq("van_id", vanId);

  if (error) {
    throw new Error(error.message);
  }

  return extractIds(data);
}

export async function deleteTripCascade(id: string): Promise<DeleteTripCascadeResult> {
  const supabase = await createClient();

  await deleteTripPassengersByTripIds(supabase, [id]);

  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return { success: true };
}

export async function deleteTravelCascade(id: string): Promise<DeleteTravelCascadeResult> {
  const supabase = await createClient();
  const { deletedTripCount } = await deleteTravelsByIds(supabase, [id]);

  return {
    success: true,
    deletedTripCount,
  };
}

export async function deleteVanCascade(id: string): Promise<DeleteVanCascadeResult> {
  const supabase = await createClient();
  const travelIds = await getTravelIdsForVanId(supabase, id);
  const { deletedTripCount } = await deleteTravelsByIds(supabase, travelIds);

  const { error } = await supabase
    .from("vans")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return {
    success: true,
    deletedTravelCount: travelIds.length,
    deletedTripCount,
  };
}
