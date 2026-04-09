import { createClient } from "@/lib/server";
import {
  normalizeOrganisationPayload,
  validateOrganisationPayload,
} from "@/lib/organisations";

const selectFields = "id, name, slug, created_at";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organisations")
    .select(selectFields)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload = normalizeOrganisationPayload(await req.json());
  const validationError = validateOrganisationPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("organisations")
    .insert([payload])
    .select(selectFields)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
