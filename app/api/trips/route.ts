import { createClient } from "@/lib/server";
// Keep API projections explicit so Supabase does not overfetch columns by default.
import { TRIP_SELECT } from "@/lib/supabase-selects";

export async function GET() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("trips")
        .select(TRIP_SELECT)
        .order("created_at", { ascending: false });

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
}

export async function POST(req: Request) {
    const supabase = await createClient()
    const body = await req.json();

    const { data, error } = await supabase
        .from("trips")
        .insert([body])
        .select(TRIP_SELECT)
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 201 });
}
