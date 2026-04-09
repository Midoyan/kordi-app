import { createClient } from "@/lib/server";
// Keep API projections explicit so Supabase does not overfetch columns by default.
import { TRAVEL_SELECT } from "@/lib/supabase-selects";
import {
    normalizeTravelPayload,
    validateTravelPayload,
} from "@/lib/travels";

export async function GET() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("travels2")
        .select(TRAVEL_SELECT)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const payload = normalizeTravelPayload(await req.json());
    const validationError = validateTravelPayload(payload);

    if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("travels2")
        .insert([payload])
        .select(TRAVEL_SELECT)
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 201 });
}
