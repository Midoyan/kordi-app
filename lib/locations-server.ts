import "server-only";

import { createClient } from "@/lib/server";
import {
  normalizeLocationRecord,
  sortLocations,
} from "@/lib/locations";

export async function getLocations() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, label, location_type, address, access_notes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return sortLocations((data ?? []).map((entry) => normalizeLocationRecord(entry)));
}
