import "server-only";

import { createClient } from "@/lib/server";
import {
  normalizeVehicleRecord,
  sortVehicles,
} from "@/lib/vehicles";

export async function getVehicles() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("vans")
    .select("id, label, plate_number, seat_capacity, vehicle_type, notes, is_active, crew_member_id, created_at, crew_members:crew_member_id(id, full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return sortVehicles((data ?? []).map((entry) => normalizeVehicleRecord(entry)));
}
