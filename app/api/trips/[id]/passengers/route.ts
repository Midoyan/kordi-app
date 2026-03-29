import { createClient } from "@/utils/supabase/server";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
    const { id: tripId } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("trip_passengers")
        .select(`
      trip_id,
      crew_member_id,
      crew_members (
        id,
        full_name,
        phone,
        home_address
      )
    `)
        .eq("trip_id", tripId);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    const passengers = data.map((row) => row.crew_members);

    return Response.json(passengers, { status: 200 });
}

export async function POST(req: Request, context: RouteContext) {
    const { id: tripId } = await context.params;
    const supabase = await createClient();
    const body = await req.json();

    const { crew_member_id } = body;

    if (!crew_member_id) {
        return Response.json(
            { error: "crew_member_id is required" },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from("trip_passengers")
        .insert([
            {
                trip_id: tripId,
                crew_member_id,
            },
        ])
        .select()
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 201 });
}