import { createClient } from "@/lib/server";

const locationTypes = new Set([
  "Pickup point",
  "Venue",
  "Hotel",
  "Airport",
  "Other",
]);

type LocationPayload = {
  label: string;
  location_type: string;
  address: string;
  access_notes: string;
};

function normalizeLocationPayload(payload: unknown): LocationPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const record = source as Record<string, unknown>;

  const label = typeof record.label === "string" ? record.label.trim() : "";
  const location_type = typeof record.location_type === "string" ? record.location_type.trim() : "";
  const address = typeof record.address === "string" ? record.address.trim() : "";
  const access_notes = typeof record.access_notes === "string" ? record.access_notes.trim() : "";

  return {
    label,
    location_type: locationTypes.has(location_type) ? location_type : "Other",
    address,
    access_notes,
  };
}

function validateLocationPayload(payload: LocationPayload) {
  if (!payload.label) {
    return "label is required.";
  }

  if (!payload.address) {
    return "Address is required.";
  }

  return null;
}

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("locations")
    .select("id, label, location_type, address, access_notes, created_at");

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
