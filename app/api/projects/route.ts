import { createClient } from "@/lib/server";
import {
  normalizeProjectPayload,
  validateProjectPayload,
} from "@/lib/projects-api";

const selectFields = "id, org_id, name, client, status, created_at";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(selectFields)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload = normalizeProjectPayload(await req.json());
  const validationError = validateProjectPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("projects")
    .insert([payload])
    .select(selectFields)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
