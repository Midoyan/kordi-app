import { createClient } from "@/lib/server";
import { deleteVanCascade } from "@/lib/transport-cascade";
import {
    normalizeVehiclePayload,
    validateVehiclePayload,
} from "@/lib/vehicles";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("vans")
        .select("id, label, plate_number, seat_capacity, vehicle_type, notes, is_active, crew_member_id, created_at, crew_members:crew_member_id(id, full_name)")
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
    const payload = normalizeVehiclePayload(await req.json());
    const validationError = validateVehiclePayload(payload);

    if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("vans")
        .update(payload)
        .eq("id", id)
        .select("id, label, plate_number, seat_capacity, vehicle_type, notes, is_active, crew_member_id, created_at, crew_members:crew_member_id(id, full_name)")
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
}

export async function DELETE(_: Request, context: RouteContext) {
    const { id } = await context.params;
    
    try {
        const result = await deleteVanCascade(id);
        return Response.json(result, { status: 200 });
    } catch (error) {
        return Response.json(
            { error: error instanceof Error ? error.message : "Unexpected server error" },
            { status: 500 }
        );
    }
}
