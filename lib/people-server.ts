import "server-only";

import { createClient } from "@/lib/server";
import {
  mapCrewMemberToPerson,
  normalizeCrewMemberRecord,
} from "@/lib/people";

export async function getPeople() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crew_members")
    .select("id, full_name, home_address, phone, default_role_title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) =>
    mapCrewMemberToPerson(normalizeCrewMemberRecord(entry)),
  );
}
