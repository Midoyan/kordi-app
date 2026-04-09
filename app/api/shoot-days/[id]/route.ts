import { createClient } from "@/lib/server";
import {
  normalizeShootDayPayload,
  validateShootDayPayload,
} from "@/lib/shoot-days";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const selectFields =
  "id, org_id, project_id, shoot_date, day_number, title, status, created_at";

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shoot_days")
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
  const payload = normalizeShootDayPayload(await req.json());
  const validationError = validateShootDayPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shoot_days")
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

  const { error } = await supabase.from("shoot_days").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
}
