import "server-only";

import { generateText, stepCountIs } from "ai";

import { getDrivePlan, getTransportPlan, type Drive } from "@/lib/drive-plan";
import {
  assertMapboxToken,
  getLegDurationSeconds,
  optimizeScheduleStops,
  recalculateScheduleStops,
  type CoordinateCache,
} from "@/lib/mapbox-schedule";
import { getDispatchModel } from "@/lib/ai/dispatch/model";
import {
  findExistingCrewMemberForDraft,
  mapCrewMemberRowToPerson,
} from "@/lib/ai/dispatch/people";
import {
  buildScheduleInputs,
  countUniquePassengers,
  getDriveArrivalTime,
} from "@/lib/ai/dispatch/transport";
import type {
  DispatchAssistantAction,
  PickupAssignmentSuggestion,
  PickupPlanStop,
  PickupSuggestionDraft,
} from "@/lib/ai/dispatch/types";
import { normalizeAddressKey, readString } from "@/lib/ai/dispatch/utils";
import type { ScheduleStopInput } from "@/lib/schedule-recalculation";
import { createClient } from "@/lib/server";

type CandidateEvaluation = {
  suggestion: PickupAssignmentSuggestion;
  score: number;
};

function normalizeDraft(draft: PickupSuggestionDraft): PickupSuggestionDraft {
  return {
    personId: typeof draft.personId === "string" && draft.personId.trim() ? draft.personId.trim() : null,
    name: readString(draft.name),
    address: readString(draft.address),
    phone: readString(draft.phone),
    role: readString(draft.role),
  };
}

export function buildPickupSuggestionAction(
  draft: PickupSuggestionDraft,
  suggestion: PickupAssignmentSuggestion,
): DispatchAssistantAction {
  return {
    type: "apply-pickup-suggestion",
    label: "Apply suggestion",
    draft: normalizeDraft(draft),
    suggestion,
  };
}

function validateDraft(draft: PickupSuggestionDraft) {
  if (!draft.name) {
    return "Name is required.";
  }

  if (!draft.address) {
    return "Address is required before the assistant can place this pickup.";
  }

  return null;
}

function normalizeTimingSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

async function getRouteDurationSeconds(
  stops: ScheduleStopInput[],
  cache: CoordinateCache,
  token: string,
) {
  if (stops.length === 0) {
    return 0;
  }

  let totalSeconds = 0;

  for (let index = 0; index < stops.length; index += 1) {
    const currentStop = stops[index];
    const destinationAddress =
      index === stops.length - 1 ? currentStop.endDestination.trim() : stops[index + 1].pickupAddress.trim();

    totalSeconds += await getLegDurationSeconds(
      currentStop.pickupAddress,
      destinationAddress,
      cache,
      token,
    );
    totalSeconds += normalizeTimingSeconds(currentStop.stopDurationSec);
    totalSeconds += normalizeTimingSeconds(currentStop.trafficBufferSec);
  }

  return totalSeconds;
}

function buildStopPlan(
  drive: Drive,
  plannedStops: Array<ScheduleStopInput & { pickupTime: string }>,
  recommendationId: string,
): PickupPlanStop[] {
  return plannedStops.map((stop) => {
    const currentStop = drive.stops.find((entry) => entry.id === stop.id);

    return {
      id: currentStop?.id ?? null,
      stopTitle:
        currentStop?.stopTitle ??
        (stop.id === recommendationId ? `Pickup · ${drive.location?.name || "New stop"}` : "New stop"),
      pickupAddress: stop.pickupAddress.trim(),
      pickupTime: stop.pickupTime.trim(),
      isNew: !currentStop,
    };
  });
}

function createDeterministicReasoningParts(suggestion: PickupAssignmentSuggestion) {
  const parts = [
    `${suggestion.vanLabel} is the best-fit vehicle in the current pickup plan.`,
    `This places the stop at ${suggestion.pickupTime || "an unscheduled time"} for ${suggestion.destinationAddress || "the current destination"}.`,
    `${Math.max(0, suggestion.routeDeltaMinutes)} extra route minute${Math.abs(suggestion.routeDeltaMinutes) === 1 ? "" : "s"} keeps the detour low while staying inside the active pickup run.`,
  ];

  if (suggestion.remainingSeatsBeforeAssignment !== null) {
    parts.push(
      `${suggestion.remainingSeatsBeforeAssignment} seat${suggestion.remainingSeatsBeforeAssignment === 1 ? "" : "s"} remain before adding this rider.`,
    );
  }

  return parts;
}

function getRecommendationKey(
  driveId: string,
  assignmentType: PickupAssignmentSuggestion["assignmentType"],
  stopId: string | null,
  pickupAddress: string,
) {
  return [driveId, assignmentType, stopId ?? "new", normalizeAddressKey(pickupAddress)].join("::");
}

async function maybeGeneratePickupExplanation(
  suggestion: PickupAssignmentSuggestion,
  alternatives: PickupAssignmentSuggestion[],
) {
  if (!process.env.OPENAI_API_KEY) {
    return {
      explanation: suggestion.explanation,
      reasoning: suggestion.reasoning,
    };
  }

  try {
    const result = await generateText({
      model: getDispatchModel(),
      system:
        "You are an operations copilot for a transport scheduling app. Explain the single best pickup assignment in 2-3 short sentences and give exactly 3 concise bullet-style reasons separated by newline characters. Stay concrete and operational.",
      prompt: JSON.stringify({
        recommendation: suggestion,
        alternatives: alternatives.map((item) => ({
          driveLabel: item.driveLabel,
          vanLabel: item.vanLabel,
          pickupTime: item.pickupTime,
          routeDeltaMinutes: item.routeDeltaMinutes,
          assignmentType: item.assignmentType,
        })),
      }),
      stopWhen: stepCountIs(1),
      temperature: 0.2,
    });

    const lines = result.text
      .split("\n")
      .map((line) => line.replace(/^[\s*-]+/, "").trim())
      .filter(Boolean);

    return {
      explanation: lines[0] ?? suggestion.explanation,
      reasoning: lines.slice(1, 4).length > 0 ? lines.slice(1, 4) : suggestion.reasoning,
    };
  } catch {
    return {
      explanation: suggestion.explanation,
      reasoning: suggestion.reasoning,
    };
  }
}

export function buildPickupSuggestionAnswer(
  draft: PickupSuggestionDraft,
  suggestion: PickupAssignmentSuggestion,
) {
  const subject = draft.name || "This person";
  const routeDeltaPrefix = suggestion.routeDeltaMinutes > 0 ? "adds" : "keeps";
  const routeDeltaDetail =
    suggestion.routeDeltaMinutes > 0
      ? `This ${routeDeltaPrefix} only ${suggestion.routeDeltaMinutes} extra minute${suggestion.routeDeltaMinutes === 1 ? "" : "s"} to the route`
      : "This keeps the route unchanged";
  const seatDetail =
    suggestion.remainingSeatsBeforeAssignment !== null
      ? ` and ${suggestion.remainingSeatsBeforeAssignment} seat${suggestion.remainingSeatsBeforeAssignment === 1 ? "" : "s"} remain before assignment.`
      : ".";

  return `${subject} can be assigned to ${suggestion.vanLabel} on the "${suggestion.driveLabel}" drive. The pickup will be at ${suggestion.pickupAddress}, scheduled for ${suggestion.pickupTime}. ${routeDeltaDetail}${seatDetail}\n\nDo you want me to apply this for you?`;
}

async function evaluateDriveCandidate(
  drive: Drive,
  draft: PickupSuggestionDraft,
  cache: CoordinateCache,
  token: string,
): Promise<CandidateEvaluation | null> {
  if (drive.travelType !== "pickup") {
    return null;
  }

  const destinationAddress = drive.destinationAddress.trim();
  const arrivalTime = getDriveArrivalTime(drive);

  if (!destinationAddress || !arrivalTime) {
    return null;
  }

  const currentPassengerCount = countUniquePassengers(drive);
  const seatCapacity = typeof drive.van?.seat_capacity === "number" ? drive.van.seat_capacity : null;
  const remainingSeatsBeforeAssignment =
    seatCapacity === null ? null : Math.max(0, seatCapacity - currentPassengerCount);

  if (remainingSeatsBeforeAssignment !== null && remainingSeatsBeforeAssignment < 1) {
    return null;
  }

  const normalizedAddress = normalizeAddressKey(draft.address);
  const existingStop = drive.stops.find((stop) => normalizeAddressKey(stop.pickupAddress) === normalizedAddress);

  if (existingStop) {
    const recommendationKey = getRecommendationKey(
      drive.id,
      "existing-stop",
      existingStop.id,
      existingStop.pickupAddress,
    );

    return {
      suggestion: {
        recommendationKey,
        assignmentType: "existing-stop",
        driveId: drive.id,
        driveLabel: drive.label,
        vanId: drive.vanId,
        vanLabel: drive.van?.label?.trim() || drive.driver?.name || "Unlabeled van",
        seatCapacity,
        currentPassengerCount,
        remainingSeatsBeforeAssignment,
        stopId: existingStop.id,
        stopTitle: existingStop.stopTitle,
        pickupAddress: existingStop.pickupAddress.trim(),
        pickupTime: existingStop.pickupTimeLabel.trim(),
        destinationAddress,
        routeDeltaMinutes: 0,
        reasoning: [
          "The address already exists in the current route.",
          "No extra stop needs to be inserted.",
          "This keeps the existing schedule intact.",
        ],
        explanation:
          "This rider can be attached to an existing stop at the same address, so the route stays unchanged.",
        stopPlan: drive.stops.map((stop) => ({
          id: stop.id,
          stopTitle: stop.stopTitle,
          pickupAddress: stop.pickupAddress.trim(),
          pickupTime: stop.pickupTimeLabel.trim(),
          isNew: false,
        })),
      },
      score: 0,
    };
  }

  const currentStops = buildScheduleInputs(drive);

  if (currentStops.length >= 11) {
    return null;
  }

  const baselineDurationSeconds = await getRouteDurationSeconds(currentStops, cache, token);
  const insertedStopId = `suggested-stop:${drive.id}`;
  const candidateStops = [
    ...currentStops,
    {
      id: insertedStopId,
      pickupAddress: draft.address,
      endDestination: destinationAddress,
      stopDurationSec: null,
      trafficBufferSec: null,
    },
  ];
  const { orderedStops } = await optimizeScheduleStops(candidateStops, token);
  const recalculatedStops = await recalculateScheduleStops(orderedStops, arrivalTime, cache, token);
  const candidateDurationSeconds = await getRouteDurationSeconds(orderedStops, cache, token);
  const insertedStop = recalculatedStops.find((stop) => stop.id === insertedStopId);

  if (!insertedStop) {
    return null;
  }

  const routeDeltaMinutes = Math.max(0, Math.round((candidateDurationSeconds - baselineDurationSeconds) / 60));
  const vanLabel = drive.van?.label?.trim() || drive.driver?.name || "Unlabeled van";
  const recommendationKey = getRecommendationKey(drive.id, "new-stop", null, insertedStop.pickupAddress);
  const suggestion: PickupAssignmentSuggestion = {
    recommendationKey,
    assignmentType: "new-stop",
    driveId: drive.id,
    driveLabel: drive.label,
    vanId: drive.vanId,
    vanLabel,
    seatCapacity,
    currentPassengerCount,
    remainingSeatsBeforeAssignment,
    stopId: null,
    stopTitle: `Pickup · ${draft.name || "New rider"}`,
    pickupAddress: insertedStop.pickupAddress.trim(),
    pickupTime: insertedStop.pickupTime.trim(),
    destinationAddress,
    routeDeltaMinutes,
    reasoning: createDeterministicReasoningParts({
      recommendationKey,
      assignmentType: "new-stop",
      driveId: drive.id,
      driveLabel: drive.label,
      vanId: drive.vanId,
      vanLabel,
      seatCapacity,
      currentPassengerCount,
      remainingSeatsBeforeAssignment,
      stopId: null,
      stopTitle: `Pickup · ${draft.name || "New rider"}`,
      pickupAddress: insertedStop.pickupAddress.trim(),
      pickupTime: insertedStop.pickupTime.trim(),
      destinationAddress,
      routeDeltaMinutes,
      reasoning: [],
      explanation: "",
      stopPlan: [],
    }),
    explanation:
      "This drive adds the lowest route cost while keeping the passenger inside an active pickup run with available seats.",
    stopPlan: buildStopPlan(
      drive,
      recalculatedStops.map((stop) => ({
        ...stop,
        pickupTime: stop.pickupTime,
      })),
      insertedStopId,
    ),
  };
  const pickupMinutes = insertedStop.pickupTime
    .split(":")
    .slice(0, 2)
    .reduce((total, value, index) => total + Number(value || 0) * (index === 0 ? 60 : 1), 0);

  return {
    suggestion,
    score:
      routeDeltaMinutes * 100 +
      currentPassengerCount * 5 -
      (remainingSeatsBeforeAssignment ?? 0) * 2 -
      pickupMinutes / 60,
  };
}

function compareCandidates(first: CandidateEvaluation, second: CandidateEvaluation) {
  if (first.score !== second.score) {
    return first.score - second.score;
  }

  if (first.suggestion.routeDeltaMinutes !== second.suggestion.routeDeltaMinutes) {
    return first.suggestion.routeDeltaMinutes - second.suggestion.routeDeltaMinutes;
  }

  return first.suggestion.pickupTime.localeCompare(second.suggestion.pickupTime);
}

export async function suggestPickupAssignment(draftInput: PickupSuggestionDraft) {
  const draft = normalizeDraft(draftInput);
  const validationError = validateDraft(draft);

  if (validationError) {
    throw new Error(validationError);
  }

  const drives = await getDrivePlan();
  const token = assertMapboxToken();
  const cache: CoordinateCache = new Map();
  const candidateResults = await Promise.all(
    drives.map((drive) => evaluateDriveCandidate(drive, draft, cache, token).catch(() => null)),
  );
  const candidates = candidateResults.filter((entry): entry is CandidateEvaluation => Boolean(entry));

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort(compareCandidates);
  const bestSuggestion = candidates[0].suggestion;
  const explanation = await maybeGeneratePickupExplanation(
    bestSuggestion,
    candidates.slice(1, 4).map((candidate) => candidate.suggestion),
  );

  return {
    ...bestSuggestion,
    explanation: explanation.explanation,
    reasoning: explanation.reasoning,
  } satisfies PickupAssignmentSuggestion;
}

async function attachPassengerToStop(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stopId: string,
  crewMemberId: string,
) {
  const { data: existingPassengerLink, error: existingPassengerError } = await supabase
    .from("trip_passengers")
    .select("trip_id")
    .eq("trip_id", stopId)
    .eq("crew_member_id", crewMemberId)
    .maybeSingle();

  if (existingPassengerError) {
    throw new Error(existingPassengerError.message);
  }

  if (existingPassengerLink) {
    return;
  }

  const { error: passengerError } = await supabase.from("trip_passengers").insert([
    {
      trip_id: stopId,
      crew_member_id: crewMemberId,
    },
  ]);

  if (passengerError) {
    throw new Error(passengerError.message);
  }
}

export async function applyPickupSuggestion(
  draftInput: PickupSuggestionDraft,
  suggestion: PickupAssignmentSuggestion,
) {
  const draft = normalizeDraft(draftInput);
  const validationError = validateDraft(draft);

  if (validationError) {
    throw new Error(validationError);
  }

  const freshSuggestion = await suggestPickupAssignment(draft);

  if (!freshSuggestion) {
    throw new Error("No eligible pickup route is available for this address.");
  }

  if (freshSuggestion.recommendationKey !== suggestion.recommendationKey) {
    throw new Error("The suggested pickup changed. Refresh the recommendation and try again.");
  }

  const supabase = await createClient();
  let createdCrewMemberId: string | null = null;
  let createdTripId: string | null = null;
  let attachedStopId: string | null = null;
  let originalStopTimeById = new Map<string, string | null>();
  let targetCrewMemberId: string | null = null;
  let targetCrewMemberRow: Awaited<ReturnType<typeof findExistingCrewMemberForDraft>> | null = null;

  try {
    const matchedExistingCrewMember = draft.personId ? null : await findExistingCrewMemberForDraft(draft);

    if (draft.personId || matchedExistingCrewMember) {
      const targetPersonId = draft.personId ?? matchedExistingCrewMember?.id ?? null;
      const { data: updatedCrewMember, error: updateError } = await supabase
        .from("crew_members")
        .update({
          full_name: draft.name,
          home_address: draft.address,
          phone: draft.phone || null,
          default_role_title: draft.role || null,
        })
        .eq("id", targetPersonId)
        .select("id, full_name, home_address, phone, default_role_title, created_at")
        .single();

      if (updateError || !updatedCrewMember) {
        throw new Error(updateError?.message || "Failed to update this person.");
      }

      targetCrewMemberId = updatedCrewMember.id;
      targetCrewMemberRow = updatedCrewMember;
    } else {
      const { data: createdCrewMember, error: createError } = await supabase
        .from("crew_members")
        .insert([
          {
            full_name: draft.name,
            home_address: draft.address,
            phone: draft.phone || null,
            default_role_title: draft.role || null,
          },
        ])
        .select("id, full_name, home_address, phone, default_role_title, created_at")
        .single();

      if (createError || !createdCrewMember) {
        throw new Error(createError?.message || "Failed to create this person.");
      }

      createdCrewMemberId = createdCrewMember.id;
      targetCrewMemberId = createdCrewMember.id;
      targetCrewMemberRow = createdCrewMember;
    }

    if (!targetCrewMemberId || !targetCrewMemberRow) {
      throw new Error("Unable to resolve the person to assign.");
    }

    if (freshSuggestion.assignmentType === "existing-stop" && freshSuggestion.stopId) {
      attachedStopId = freshSuggestion.stopId;
      await attachPassengerToStop(supabase, freshSuggestion.stopId, targetCrewMemberId);
    } else {
      const newStop = freshSuggestion.stopPlan.find((stop) => stop.isNew);

      if (!newStop) {
        throw new Error("The assistant could not find the inserted stop to apply.");
      }

      const { data: createdTrip, error: tripError } = await supabase
        .from("trips")
        .insert([
          {
            travel_id: freshSuggestion.driveId,
            pickup_address: newStop.pickupAddress,
            pickup_time: `${newStop.pickupTime}:00`,
            trip_title: freshSuggestion.stopTitle,
          },
        ])
        .select("id")
        .single();

      if (tripError || !createdTrip) {
        throw new Error(tripError?.message || "Failed to create the suggested stop.");
      }

      createdTripId = createdTrip.id;
      attachedStopId = createdTrip.id;
      await attachPassengerToStop(supabase, createdTrip.id, targetCrewMemberId);
    }

    const refreshedDrivePlan = await getDrivePlan();
    const updatedDrive = refreshedDrivePlan.find((drive) => drive.id === freshSuggestion.driveId);

    if (updatedDrive && updatedDrive.travelType === "pickup") {
      const token = assertMapboxToken();
      const cache: CoordinateCache = new Map();
      const updatedStops = buildScheduleInputs(updatedDrive);
      originalStopTimeById = new Map(updatedDrive.stops.map((stop) => [stop.id, stop.pickupTime]));

      if (updatedStops.length > 0) {
        const { orderedStops } = await optimizeScheduleStops(updatedStops, token);
        const recalculatedStops = await recalculateScheduleStops(
          orderedStops,
          getDriveArrivalTime(updatedDrive),
          cache,
          token,
        );
        const updateResults = await Promise.all(
          recalculatedStops.map((stop) =>
            supabase
              .from("trips")
              .update({ pickup_time: `${stop.pickupTime}:00` })
              .eq("id", stop.id),
          ),
        );
        const failedUpdate = updateResults.find((result) => result.error);

        if (failedUpdate?.error) {
          throw new Error(failedUpdate.error.message);
        }
      }
    }

    const transportPlan = await getTransportPlan();
    const person = mapCrewMemberRowToPerson(targetCrewMemberRow, transportPlan);

    return {
      person,
      transportPlan,
    };
  } catch (error) {
    if (originalStopTimeById.size > 0) {
      await Promise.all(
        Array.from(originalStopTimeById.entries()).map(([stopId, pickupTime]) =>
          supabase.from("trips").update({ pickup_time: pickupTime }).eq("id", stopId),
        ),
      );
    }

    if (createdCrewMemberId && attachedStopId) {
      await supabase
        .from("trip_passengers")
        .delete()
        .eq("trip_id", attachedStopId)
        .eq("crew_member_id", createdCrewMemberId);
    }

    if (createdTripId) {
      await supabase.from("trips").delete().eq("id", createdTripId);
    }

    if (createdCrewMemberId) {
      await supabase.from("crew_members").delete().eq("id", createdCrewMemberId);
    }

    throw error;
  }
}
