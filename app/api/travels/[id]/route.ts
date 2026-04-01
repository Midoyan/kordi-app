import { createClient } from "@/lib/server";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type TripIdRecord = {
    id: string;
};

export async function GET(_: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("travels")
        .select("*")
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
    const body = await req.json();

    const { data, error } = await supabase
        .from("travels")
        .update(body)
        .eq("id", id)
        .select()
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
}

export async function DELETE(_: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data: tripRows, error: tripLookupError } = await supabase
        .from("trips")
        .select("id")
        .eq("travel_id", id);

    if (tripLookupError) {
        return Response.json({ error: tripLookupError.message }, { status: 500 });
    }

    const tripIds = (tripRows ?? [])
        .map((row) => (row as TripIdRecord).id)
        .filter((tripId): tripId is string => typeof tripId === "string" && tripId.length > 0);

    if (tripIds.length > 0) {
        const { error: deleteTripPassengersError } = await supabase
            .from("trip_passengers")
            .delete()
            .in("trip_id", tripIds);

        if (deleteTripPassengersError) {
            return Response.json({ error: deleteTripPassengersError.message }, { status: 500 });
        }

        const { error: deleteTripsError } = await supabase
            .from("trips")
            .delete()
            .in("id", tripIds);

        if (deleteTripsError) {
            return Response.json({ error: deleteTripsError.message }, { status: 500 });
        }
    }

    const { error } = await supabase
        .from("travels")
        .delete()
        .eq("id", id);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true, deletedTripCount: tripIds.length }, { status: 200 });
}
