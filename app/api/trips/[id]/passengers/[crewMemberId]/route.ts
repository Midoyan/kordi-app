import { createClient } from "@/utils/supabase/server";

type RouteContext = {
    params: Promise<{ id: string; crewMemberId: string }>;
};

export async function DELETE(_: Request, context: RouteContext) {
    const { id: tripId, crewMemberId } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("trip_passengers")
        .delete()
        .eq("trip_id", tripId)
        .eq("crew_member_id", crewMemberId)
        .select();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
        return Response.json(
            { error: "Passenger not found in this trip" },
            { status: 404 }
        );
    }

    return Response.json({ success: true }, { status: 200 });
}