import { createClient } from "@/lib/server";
import {
  normalizeShootDayPayload,
  validateShootDayPayload,
} from "@/lib/shoot-days";

const selectFields =
  "id, org_id, project_id, shoot_date, day_number, title, status, created_at";

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shoot_days")
    .select(selectFields)
    .order("shoot_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const payload = normalizeShootDayPayload(await req.json());
  const validationError = validateShootDayPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("shoot_days")
    .insert([payload])
    .select(selectFields)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 201 });
}
