import { createClient } from "@/utils/supabase/server";

type RouteContext = {
    params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("crew_members")
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
        .from("crew_members")
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

    const { error } = await supabase
        .from("crew_members")
        .delete()
        .eq("id", id);

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ success: true }, { status: 200 });
}
