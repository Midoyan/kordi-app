import { createClient } from "@/lib/server";
import {
  normalizeCrewMemberPayload,
  validateCrewMemberPayload,
} from "@/lib/people";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("crew_members")
    .select("id, full_name, home_address, phone, default_role_title, created_at")
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
  const payload = normalizeCrewMemberPayload(await req.json());
  const validationError = validateCrewMemberPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("crew_members")
    .update(payload)
    .eq("id", id)
    .select("id, full_name, home_address, phone, default_role_title, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { error: tripPassengersError } = await supabase
    .from("trip_passengers")
    .delete()
    .eq("crew_member_id", id);

  if (tripPassengersError) {
    return Response.json({ error: tripPassengersError.message }, { status: 500 });
  }

  const { error: vansError } = await supabase
    .from("vans")
    .update({ crew_member_id: null })
    .eq("crew_member_id", id);

  if (vansError) {
    return Response.json({ error: vansError.message }, { status: 500 });
  }

  const { error } = await supabase
    .from("crew_members")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
}
