import "server-only";

import { generateObject } from "ai";
import { z } from "zod";

import { dispatchDebugLog } from "@/lib/ai/dispatch/debug";
import { getDispatchModel } from "@/lib/ai/dispatch/model";
import type {
  PickupSuggestionConstraints,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";
import { normalizeClockTime, readString } from "@/lib/ai/dispatch/utils";

const dispatchIntentSchema = z.object({
  intent: z.enum(["pickup-assignment", "general"]),
  confidence: z.number().min(0).max(1),
  personName: z.string(),
  personAddress: z.string(),
  destinationQuery: z.string(),
  latestArrivalTime: z.string(),
  latestArrivalTimeRaw: z.string(),
  latestArrivalTimeIsAmbiguous: z.boolean(),
  latestArrivalIsRequired: z.boolean(),
  preferredVan: z.string(),
  requirePreferredVan: z.boolean(),
});

export type DispatchIntent = z.infer<typeof dispatchIntentSchema>;

export function normalizePickupSuggestionConstraints(
  input?: Partial<PickupSuggestionConstraints> | null,
): PickupSuggestionConstraints {
  const latestArrivalTimeRaw = readString(input?.latestArrivalTimeRaw);
  const latestArrivalTime = normalizeClockTime(readString(input?.latestArrivalTime) || latestArrivalTimeRaw);
  const preferredVan = readString(input?.preferredVan);

  return {
    destinationQuery: readString(input?.destinationQuery),
    latestArrivalTime,
    latestArrivalTimeRaw,
    latestArrivalTimeIsAmbiguous: Boolean(input?.latestArrivalTimeIsAmbiguous && latestArrivalTimeRaw),
    latestArrivalIsRequired: Boolean(input?.latestArrivalIsRequired && latestArrivalTime),
    preferredVan,
    requirePreferredVan: Boolean(input?.requirePreferredVan && preferredVan),
  };
}

export function hasPickupSuggestionConstraints(input?: Partial<PickupSuggestionConstraints> | null) {
  const constraints = normalizePickupSuggestionConstraints(input);

  return Boolean(constraints.destinationQuery || constraints.latestArrivalTime || constraints.preferredVan);
}

export function buildPickupSuggestionConstraintsFromIntent(intent: DispatchIntent | null | undefined) {
  return normalizePickupSuggestionConstraints(
    intent
      ? {
          destinationQuery: intent.destinationQuery,
          latestArrivalTime: intent.latestArrivalTime,
          latestArrivalTimeRaw: intent.latestArrivalTimeRaw,
          latestArrivalTimeIsAmbiguous: intent.latestArrivalTimeIsAmbiguous,
          latestArrivalIsRequired: intent.latestArrivalIsRequired,
          preferredVan: intent.preferredVan,
          requirePreferredVan: intent.requirePreferredVan,
        }
      : null,
  );
}

export function buildPickupSuggestionDraftFromIntent(intent: DispatchIntent | null | undefined) {
  if (!intent) {
    return null;
  }

  const name = readString(intent.personName);
  const address = readString(intent.personAddress);

  if (!name && !address) {
    return null;
  }

  return {
    personId: null,
    name,
    address,
    phone: "",
    role: "",
  } satisfies PickupSuggestionDraft;
}

export function isStructuredPickupAssignmentIntent(intent: DispatchIntent | null | undefined) {
  return Boolean(
    intent &&
      intent.intent === "pickup-assignment" &&
      intent.confidence >= 0.55 &&
      (readString(intent.personName) || readString(intent.personAddress)),
  );
}

function normalizeDispatchIntent(intent: DispatchIntent): DispatchIntent {
  const latestArrivalTimeRaw = readString(intent.latestArrivalTimeRaw);
  const normalizedLatestArrivalTime = normalizeClockTime(readString(intent.latestArrivalTime) || latestArrivalTimeRaw);
  const normalizedPreferredVan = readString(intent.preferredVan);

  return {
    intent: intent.intent,
    confidence: Number.isFinite(intent.confidence) ? Math.max(0, Math.min(1, intent.confidence)) : 0,
    personName: readString(intent.personName),
    personAddress: readString(intent.personAddress),
    destinationQuery: readString(intent.destinationQuery),
    latestArrivalTime: normalizedLatestArrivalTime,
    latestArrivalTimeRaw,
    latestArrivalTimeIsAmbiguous: Boolean(intent.latestArrivalTimeIsAmbiguous && latestArrivalTimeRaw),
    latestArrivalIsRequired: Boolean(intent.latestArrivalIsRequired && normalizedLatestArrivalTime),
    preferredVan: normalizedPreferredVan,
    requirePreferredVan: Boolean(intent.requirePreferredVan && normalizedPreferredVan),
  };
}

export async function extractDispatchIntent(question: string) {
  const trimmedQuestion = question.trim();

  if (!trimmedQuestion) {
    return null;
  }

  const result = await generateObject({
    model: getDispatchModel(),
    schema: dispatchIntentSchema,
    schemaName: "dispatch_intent",
    schemaDescription:
      "Normalized dispatch intent for transport scheduling, extracted from messages in any language.",
    temperature: 0,
    system: [
      "You extract structured dispatch intent from transport scheduling messages in any language.",
      "Classify as pickup-assignment only when the user is asking to add, move, reassign, or suggest a transport slot for a specific person.",
      "Treat pickup-assignment as including requests to deliver someone to a different destination, change vans, or fit them into a time window.",
      "personAddress should be the rider's pickup or home address, not the destination.",
      "destinationQuery should be the requested destination name or address, not the pickup address.",
      "Copy the user's arrival-time wording into latestArrivalTimeRaw when present.",
      "If the user gives an explicit time like 6am, 18:00, 06:30, or 18.30, normalize latestArrivalTime to HH:MM 24-hour time.",
      "If the user gives an ambiguous bare time like 6 or 6:30 without am/pm or clear 24-hour context, set latestArrivalTimeRaw to that wording, set latestArrivalTimeIsAmbiguous to true, and leave latestArrivalTime empty instead of guessing am or pm.",
      "If there is no arrival-time request, use empty strings and set latestArrivalTimeIsAmbiguous to false.",
      "Set latestArrivalIsRequired to true only for hard deadlines. Use false for soft phrasing like ideally, preferably, if possible, am liebsten, idealerweise, wenn moeglich, or similar wording.",
      "Set requirePreferredVan to true only when the user insists on a specific van. Use false for soft preferences like prefer, ideally, if possible, can we use, is van x available, or similar wording that is checking feasibility rather than demanding that van only.",
      "Use empty strings for unknown fields and keep confidence conservative.",
    ].join(" "),
    prompt: trimmedQuestion,
  });

  const normalizedIntent = normalizeDispatchIntent(result.object);
  dispatchDebugLog("intent.extracted", {
    question: trimmedQuestion,
    intent: normalizedIntent,
  });

  return normalizedIntent;
}
