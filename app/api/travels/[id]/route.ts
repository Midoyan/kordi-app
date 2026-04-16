import { createClient } from "@/lib/server";
// Shared select lists keep route responses stable and avoid wildcard column reads.
import { TRAVEL_SELECT } from "@/lib/supabase-selects";
import { deleteTravelCascade } from "@/lib/transport-cascade";
import {
    normalizeTravelPayload,
    validateTravelPayload,
} from "@/lib/travels";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("travels2")
        .select(TRAVEL_SELECT)
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
    const payload = normalizeTravelPayload(await req.json());
    const validationError = validateTravelPayload(payload);

    if (validationError) {
        return Response.json({ error: validationError }, { status: 400 });
    }

    const { data, error } = await supabase
        .from("travels2")
        .update(payload)
        .eq("id", id)
        .select(TRAVEL_SELECT)
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 200 });
}

export async function DELETE(_: Request, context: RouteContext) {
    const { id } = await context.params;
    
    try {
        const result = await deleteTravelCascade(id);
        return Response.json(result, { status: 200 });
    } catch (error) {
        return Response.json(
            { error: error instanceof Error ? error.message : "Unexpected server error" },
            { status: 500 }
        );
    }
}
