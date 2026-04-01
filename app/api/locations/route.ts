import { createClient } from "@/lib/server";
import {
  normalizeLocationPayload,
  validateLocationPayload,
} from "@/lib/locations";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, label, location_type, address, access_notes, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload = normalizeLocationPayload(await req.json());
  const validationError = validateLocationPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("locations")
    .insert([payload])
    .select("id, label, location_type, address, access_notes, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
