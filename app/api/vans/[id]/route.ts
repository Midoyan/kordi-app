import { createClient } from "@/lib/server";

type RouteContext = {
    params: Promise<{ id: string }>;
};

type TravelIdRecord = {
    id: string;
};

type TripIdRecord = {
    id: string;
};

export async function GET(_: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("vans")
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
        .from("vans")
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

    const { data: travelRows, error: travelLookupError } = await supabase
        .from("travels")
        .select("id")
        .eq("van_id", id);

    if (travelLookupError) {
        return Response.json({ error: travelLookupError.message }, { status: 500 });
    }

    const travelIds = (travelRows ?? [])
        .map((row) => (row as TravelIdRecord).id)
        .filter((travelId): travelId is string => typeof travelId === "string" && travelId.length > 0);

    if (travelIds.length > 0) {
        const { data: tripRows, error: tripLookupError } = await supabase
            .from("trips")
            .select("id")
            .in("travel_id", travelIds);

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

        const { error: deleteTravelsError } = await supabase
            .from("travels")
            .delete()
            .in("id", travelIds);

        if (deleteTravelsError) {
            return Response.json({ error: deleteTravelsError.message }, { status: 500 });
        }
    }

    const { error } = await supabase
        .from("vans")
        .delete()
        .eq("id", id);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(
        {
            success: true,
            deletedTravelCount: travelIds.length,
        },
        { status: 200 }
    );
}
