import { createClient } from "@/utils/supabase/server";

type CrewMember = {
    id: string;
    full_name: string;
    phone: string;
    home_address: string;
};

type TripPassenger = {
    crew_members: CrewMember;
};

type Trip = {
    id: string;
    trip_passengers?: TripPassenger[];
};

export async function GET() {
    try {
        const supabase = await createClient();

        const { data, error } = await supabase
            .from("travels")
            .select(`
        *,
        vans (*),
        driver:crew_members!travels_driver_crew_id_fkey (
          id,
          full_name,
          phone,
          home_address
        ),
        trips (
          *,
          trip_passengers (
            crew_members (
              id,
              full_name,
              phone,
              home_address
            )
          )
        )
      `);

        if (error) throw error;

        const travels =
            data?.map((travel) => {
                const { vans, trips, ...travelRest } = travel;

                return {
                    ...travelRest,
                    van: vans ?? null,
                    trips:
                        trips?.map((trip: Trip) => {
                            const { trip_passengers, ...tripRest } = trip;

                            return {
                                ...tripRest,
                                passengers:
                                    trip_passengers
                                        ?.map((tp: TripPassenger) => tp.crew_members)
                                        .filter(Boolean) ?? [],
                            };
                        }) ?? [],
                };
            }) ?? [];

        return Response.json({ travels }, { status: 200 });
    } catch (error) {
        return Response.json(
            {
                error:
                    error instanceof Error ? error.message : "Unexpected server error",
            },
            { status: 500 }
        );
    }
}