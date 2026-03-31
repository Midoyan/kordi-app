import { createClient } from "@/lib/server";

export async function GET() {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from("vans")
        .select("*")
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
        .from("vans")
        .insert([body])
        .select()
        .single();

    if (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json(data, { status: 201 });
}