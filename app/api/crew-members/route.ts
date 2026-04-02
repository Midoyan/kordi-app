import { createClient } from "@/lib/server";
import {
  normalizeCrewMemberPayload,
  validateCrewMemberPayload,
} from "@/lib/people";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    // The canonical shared people source is `crew_members`; trips/call sheets reference it rather than duplicating rows.
    .from("crew_members")
    .select("id, full_name, home_address, phone, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? [], { status: 200 });
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
    .select("id, full_name, home_address, phone, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
