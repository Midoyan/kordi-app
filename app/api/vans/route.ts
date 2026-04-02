import { createClient } from "@/lib/server";
import {
  normalizeVehiclePayload,
  validateVehiclePayload,
} from "@/lib/vehicles";

export async function GET() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("vans")
        .select("id, label, plate_number, seat_capacity, vehicle_type, notes, is_active, crew_member_id, created_at, crew_members:crew_member_id(id, full_name)")
        .order("created_at", { ascending: false });

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data ?? [], { status: 200 });
}

export async function POST(req: Request) {
    const supabase = await createClient();
    const payload = normalizeVehiclePayload(await req.json());
    const validationError = validateVehiclePayload(payload);

    if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("vans")
        .insert([payload])
        .select("id, label, plate_number, seat_capacity, vehicle_type, notes, is_active, crew_member_id, created_at, crew_members:crew_member_id(id, full_name)")
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 201 });
}
