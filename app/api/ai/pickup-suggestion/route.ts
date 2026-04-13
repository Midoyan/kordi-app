import { applyPickupSuggestion, suggestPickupAssignment } from "@/lib/ai/dispatch";
import {
  applyPickupSuggestionRequestSchema,
  pickupSuggestionRequestSchema,
} from "@/lib/ai/dispatch/schemas";

export async function POST(request: Request) {
  try {
    const body = pickupSuggestionRequestSchema.parse(await request.json());
    const suggestion = await suggestPickupAssignment(body.draft);

    return Response.json({ suggestion }, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to build a pickup suggestion.",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = applyPickupSuggestionRequestSchema.parse(await request.json());
    const result = await applyPickupSuggestion(body.draft, body.suggestion);

    return Response.json(result, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to apply this pickup suggestion.",
      },
      { status: 500 },
    );
  }
}
