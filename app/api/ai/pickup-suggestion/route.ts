import { z } from "zod";

import { applyPickupSuggestion, suggestPickupAssignment } from "@/lib/dispatch-assistant";

const draftSchema = z.object({
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  role: z.string(),
});

const suggestionSchema = z.object({
  recommendationKey: z.string(),
  assignmentType: z.enum(["existing-stop", "new-stop"]),
  driveId: z.string(),
  driveLabel: z.string(),
  vanId: z.string().nullable(),
  vanLabel: z.string(),
  seatCapacity: z.number().nullable(),
  currentPassengerCount: z.number(),
  remainingSeatsBeforeAssignment: z.number().nullable(),
  stopId: z.string().nullable(),
  stopTitle: z.string(),
  pickupAddress: z.string(),
  pickupTime: z.string(),
  destinationAddress: z.string(),
  routeDeltaMinutes: z.number(),
  reasoning: z.array(z.string()),
  explanation: z.string(),
  stopPlan: z.array(
    z.object({
      id: z.string().nullable(),
      stopTitle: z.string(),
      pickupAddress: z.string(),
      pickupTime: z.string(),
      isNew: z.boolean(),
    }),
  ),
});

const suggestRequestSchema = z.object({
  draft: draftSchema,
});

const applyRequestSchema = z.object({
  draft: draftSchema,
  suggestion: suggestionSchema,
});

export async function POST(request: Request) {
  try {
    const body = suggestRequestSchema.parse(await request.json());
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
    const body = applyRequestSchema.parse(await request.json());
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
