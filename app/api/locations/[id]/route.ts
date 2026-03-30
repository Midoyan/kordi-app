import { createClient } from "@/lib/server";

const locationTypes = new Set([
  "Pickup point",
  "Venue",
  "Hotel",
  "Airport",
  "Other",
]);

type RouteContext = {
  params: Promise<{ id: string }>;
};

type LocationPayload = {
  name: string;
  type: string;
  address: string;
  zone: string;
  notes: string;
};

function normalizeLocationPayload(payload: unknown): LocationPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  const name = typeof record.name === "string" ? record.name.trim() : "";
  const type = typeof record.type === "string" ? record.type.trim() : "";
  const address = typeof record.address === "string" ? record.address.trim() : "";
  const zone = typeof record.zone === "string" ? record.zone.trim() : "";
  const notes = typeof record.notes === "string" ? record.notes.trim() : "";

  return {
    name,
    type: locationTypes.has(type) ? type : "Other",
    address,
    zone,
    notes,
  };
}

function validateLocationPayload(payload: LocationPayload) {
  if (!payload.name) {
    return "Name is required.";
  }

  if (!payload.address) {
    return "Address is required.";
  }

  return null;
}

export async function GET(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, name, type, address, zone, notes, created_at")
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
  const payload = normalizeLocationPayload(await req.json());
  const validationError = validateLocationPayload(payload);

  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("locations")
    .update(payload)
    .eq("id", id)
    .select("id, name, type, address, zone, notes, created_at")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data, { status: 200 });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true }, { status: 200 });
}
