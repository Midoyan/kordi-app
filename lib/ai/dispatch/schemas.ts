import { z } from "zod";

export const dispatchQuestionRequestSchema = z.object({
  question: z.string(),
  model: z.string().trim().optional(),
});

export const pickupSuggestionDraftSchema = z.object({
  personId: z.string().nullable().optional(),
  name: z.string(),
  address: z.string(),
  phone: z.string(),
  role: z.string(),
});

export const pickupSuggestionConstraintsSchema = z.object({
  destinationQuery: z.string().default(""),
  latestArrivalTime: z.string().default(""),
  latestArrivalTimeRaw: z.string().default(""),
  latestArrivalTimeIsAmbiguous: z.boolean().default(false),
  latestArrivalIsRequired: z.boolean().default(false),
  preferredVan: z.string().default(""),
  requirePreferredVan: z.boolean().default(false),
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
  arrivalTime: z.string(),
  currentFirstPickupTime: z.string(),
  updatedFirstPickupTime: z.string(),
  firstPickupShiftMinutes: z.number(),
  destinationAddress: z.string(),
  routeDeltaMinutes: z.number(),
  reasoning: z.array(z.string()),
  explanation: z.string(),
  stopPlan: z.array(pickupPlanStopSchema),
});

export const pickupSuggestionRequestSchema = z.object({
  draft: pickupSuggestionDraftSchema,
  constraints: pickupSuggestionConstraintsSchema.nullable().optional(),
  model: z.string().trim().optional(),
});

export const applyPickupSuggestionRequestSchema = z.object({
  draft: pickupSuggestionDraftSchema,
  constraints: pickupSuggestionConstraintsSchema.nullable().optional(),
  suggestion: pickupAssignmentSuggestionSchema,
  model: z.string().trim().optional(),
});
