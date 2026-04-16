import { createClient } from "@/lib/server";
import {
  normalizeOrganisationPayload,
  validateOrganisationPayload,
} from "@/lib/organisations";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const selectFields = "id, name, slug, created_at";

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organisations")
    .select(selectFields)
    .eq("id", id)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
}

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();
  const payload = normalizeOrganisationPayload(await req.json());
  const validationError = validateOrganisationPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("organisations")
    .update(payload)
    .eq("id", id)
    .select(selectFields)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { error } = await supabase.from("organisations").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
}
