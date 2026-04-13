import { z } from "zod";

export const dispatchQuestionRequestSchema = z.object({
  question: z.string(),
});

export const pickupSuggestionDraftSchema = z.object({
  personId: z.string().nullable().optional(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  role: z.string(),
});

export const pickupPlanStopSchema = z.object({
  id: z.string().nullable(),
  stopTitle: z.string(),
  pickupAddress: z.string(),
  pickupTime: z.string(),
  isNew: z.boolean(),
});

export const pickupAssignmentSuggestionSchema = z.object({
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
  stopPlan: z.array(pickupPlanStopSchema),
});

export const pickupSuggestionRequestSchema = z.object({
  draft: pickupSuggestionDraftSchema,
});

export const applyPickupSuggestionRequestSchema = z.object({
  draft: pickupSuggestionDraftSchema,
  suggestion: pickupAssignmentSuggestionSchema,
});
