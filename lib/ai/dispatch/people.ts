import "server-only";

import type { TransportPlan } from "@/lib/drive-plan";
import type { PersonRecord } from "@/lib/people";
import { createClient } from "@/lib/server";

import type { PickupSuggestionDraft } from "@/lib/ai/dispatch/types";
import { normalizeAddressKey, normalizeSearchText, readString } from "@/lib/ai/dispatch/utils";

export type CrewMemberRow = {
  id: string;
  full_name: string;
  home_address: string | null;
  phone: string | null;
  default_role_title: string | null;
  created_at: string | null;
};

function findCrewMemberDriveContext(row: CrewMemberRow, transportPlan: TransportPlan) {
  return transportPlan.drives
    .flatMap((drive) =>
      drive.stops.map((stop) => ({
        drive,
        stop,
        hasPassenger: stop.stopPickupPassengers.some((passenger) => passenger.id === row.id),
      })),
    )
    .find((entry) => entry.hasPassenger);
}

export function buildPickupSuggestionDraftFromPerson(person: PersonRecord): PickupSuggestionDraft {
  return {
    personId: person.id,
    name: readString(person.name),
    address: readString(person.address),
    phone: readString(person.phone),
    role: readString(person.role),
  };
}

export function mapCrewMemberRowToCandidatePerson(row: CrewMemberRow): PersonRecord {
  return {
    id: row.id,
    name: readString(row.full_name) || "Unnamed person",
    address: readString(row.home_address),
    phone: readString(row.phone),
    role: readString(row.default_role_title),
    pickupTime: "",
    pickupToLocation: "",
    pickupToLocationName: "",
    pickupToLocationAddress: "",
    createdAt: row.created_at,
  };
}

export function mapCrewMemberRowToAssignmentCandidatePerson(
  row: CrewMemberRow,
  transportPlan: TransportPlan,
): PersonRecord {
  const driveContext = findCrewMemberDriveContext(row, transportPlan);

  return {
    id: row.id,
    name: readString(row.full_name) || "Unnamed person",
    address: readString(row.home_address) || readString(driveContext?.stop.pickupAddress),
    phone: readString(row.phone),
    role: readString(row.default_role_title),
    pickupTime: driveContext?.stop.pickupTimeLabel.trim() || "",
    pickupToLocation:
      [driveContext?.drive.location?.name?.trim(), driveContext?.drive.destinationAddress.trim()]
        .filter(Boolean)
        .join(" · ") || "",
    pickupToLocationName: driveContext?.drive.location?.name?.trim() || "",
    pickupToLocationAddress: driveContext?.drive.destinationAddress.trim() || "",
    createdAt: row.created_at,
  };
}

export function mapCrewMemberRowToPerson(row: CrewMemberRow, transportPlan: TransportPlan): PersonRecord {
  const driveContext = findCrewMemberDriveContext(row, transportPlan);

  return {
    id: row.id,
    name: readString(row.full_name) || "Unnamed person",
    address: readString(row.home_address),
    phone: readString(row.phone),
    role: readString(row.default_role_title),
    pickupTime: driveContext?.stop.pickupTimeLabel.trim() || "",
    pickupToLocation:
      [driveContext?.drive.location?.name?.trim(), driveContext?.drive.destinationAddress.trim()]
        .filter(Boolean)
        .join(" · ") || "",
    pickupToLocationName: driveContext?.drive.location?.name?.trim() || "",
    pickupToLocationAddress: driveContext?.drive.destinationAddress.trim() || "",
    createdAt: row.created_at,
  };
}

export function buildPickupSuggestionDraftFromCrewMemberRow(
  row: CrewMemberRow,
  transportPlan: TransportPlan,
): PickupSuggestionDraft {
  const driveContext = findCrewMemberDriveContext(row, transportPlan);

  return {
    personId: row.id,
    name: readString(row.full_name) || "Unnamed person",
    address: readString(row.home_address) || readString(driveContext?.stop.pickupAddress),
    phone: readString(row.phone),
    role: readString(row.default_role_title),
  };
}

export function isPickupAssignmentIntent(question: string) {
  const normalizedQuestion = question.toLowerCase();

  return (
    normalizedQuestion.includes("assign a pickup") ||
    normalizedQuestion.includes("pickup assignment") ||
    normalizedQuestion.includes("create a pickup") ||
    normalizedQuestion.includes("create pickup") ||
    normalizedQuestion.includes("set up a pickup") ||
    normalizedQuestion.includes("setup a pickup") ||
    normalizedQuestion.includes("suggest transportation") ||
    normalizedQuestion.includes("transportation options") ||
    normalizedQuestion.includes("assign transport") ||
    normalizedQuestion.includes("create a transport") ||
    normalizedQuestion.includes("assign him") ||
    normalizedQuestion.includes("assign her") ||
    normalizedQuestion.includes("assign them") ||
    normalizedQuestion.includes("pickup for ") ||
    normalizedQuestion.includes("where would ") ||
    normalizedQuestion.includes("where could ") ||
    normalizedQuestion.includes("where can ") ||
    normalizedQuestion.includes(" fit?")
  );
}

export function extractCandidateNameFromQuestion(question: string) {
  const cleanedQuestion = question.replace(/\s+/g, " ").trim();
  const patterns = [
    /for\s+([A-ZÀ-ÿ][^?.!,]+?)(?:\?|\.|,|$)/i,
    /see\s+([A-ZÀ-ÿ][^?.!,]+?)(?:\?|\.|,|$)/i,
    /added\s+([A-ZÀ-ÿ][^?.!,]+?)(?:\?|\.|,|$)/i,
    /assign(?:\s+a\s+pickup)?\s+to\s+([A-ZÀ-ÿ][^?.!,]+?)(?:\?|\.|,|$)/i,
    /where\s+would\s+([A-ZÀ-ÿ][^?.!,]+?)\s+fit(?:\?|\.|,|$)/i,
    /where\s+(?:could|can)\s+([A-ZÀ-ÿ][^?.!,]+?)\s+fit(?:\?|\.|,|$)/i,
  ];

  for (const pattern of patterns) {
    const match = cleanedQuestion.match(pattern);

    if (match?.[1]) {
      return readString(match[1]);
    }
  }

  return "";
}

function scorePersonAgainstQuestion(person: PersonRecord, question: string) {
  const normalizedQuestion = normalizeSearchText(question);
  const normalizedName = normalizeSearchText(person.name);

  if (!normalizedName) {
    return 0;
  }

  if (normalizedQuestion.includes(normalizedName)) {
    return 100;
  }

  const nameTokens = normalizedName.split(/\s+/).filter((token) => token.length > 1);
  return nameTokens.reduce(
    (score, token) => score + (normalizedQuestion.includes(token) ? 10 : 0),
    0,
  );
}

function scoreAddressAgainstQuestion(person: PersonRecord, question: string) {
  const normalizedQuestion = normalizeSearchText(question);
  const normalizedAddress = normalizeSearchText(person.address);

  if (!normalizedAddress) {
    return 0;
  }

  if (normalizedQuestion.includes(normalizedAddress)) {
    return 60;
  }

  const addressTokens = normalizedAddress.split(/\s+/).filter((token) => token.length > 2);

  return addressTokens.reduce(
    (score, token) => score + (normalizedQuestion.includes(token) ? 5 : 0),
    0,
  );
}

export function pickBestPersonForAssignment(question: string, people: PersonRecord[]) {
  const peopleWithAddress = people.filter((person) => readString(person.address));
  const prefersMostRecent = /\bjust added\b|\brecently added\b|\bnewly added\b/i.test(question);

  if (peopleWithAddress.length === 1) {
    return peopleWithAddress[0];
  }

  const candidateName = normalizeSearchText(extractCandidateNameFromQuestion(question));
  const rankedPeople = peopleWithAddress
    .map((person) => ({
      person,
      score:
        scorePersonAgainstQuestion(person, question) +
        scoreAddressAgainstQuestion(person, question) +
        (candidateName && normalizeSearchText(person.name).includes(candidateName) ? 50 : 0) +
        (prefersMostRecent && person.createdAt ? Math.max(0, Date.parse(person.createdAt) / 1e11) : 0),
    }))
    .sort((first, second) => second.score - first.score);

  if (rankedPeople[0] && rankedPeople[0].score > 0) {
    return rankedPeople[0].person;
  }

  return null;
}

export function extractPickupSuggestionDraftFromQuestion(question: string): PickupSuggestionDraft | null {
  const trimmedQuestion = question.trim();
  const addressMatch = trimmedQuestion.match(/their address is\s+(.+)$/i);

  if (!addressMatch) {
    return null;
  }

  const address = readString(addressMatch[1]);

  if (!address) {
    return null;
  }

  const beforeAddress = trimmedQuestion.slice(0, addressMatch.index).trim();
  const nameCandidate = beforeAddress
    .replace(/^can you\s+/i, "")
    .replace(/^(please\s+)?(suggest|recommend|find|choose)\s+/i, "")
    .replace(/^(transportation|transport|pickup)\s+(options?|assignment|slot|plan)\s+/i, "")
    .replace(/^options?\s+/i, "")
    .replace(/^for\s+/i, "")
    .replace(/[?.!,:\s]+$/g, "")
    .trim();

  if (!nameCandidate) {
    return null;
  }

  return {
    personId: null,
    name: nameCandidate,
    address,
    phone: "",
    role: "",
  };
}

export async function fetchPeopleRecords() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crew_members")
    .select("id, full_name, home_address, phone, default_role_title, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as CrewMemberRow[];
}

function findBestCrewMemberMatchForDraft(draft: PickupSuggestionDraft, people: CrewMemberRow[]) {
  const normalizedName = normalizeSearchText(readString(draft.name));
  const normalizedAddress = normalizeAddressKey(draft.address);

  if (!normalizedName && !normalizedAddress) {
    return null;
  }

  const rankedPeople = people
    .map((row) => {
      const rowName = readString(row.full_name).toLowerCase();
      const normalizedRowName = normalizeSearchText(rowName);
      const rowAddress = normalizeAddressKey(readString(row.home_address));
      let score = 0;

      if (normalizedName && normalizedRowName === normalizedName) {
        score += 100;
      } else if (normalizedName && normalizedRowName.includes(normalizedName)) {
        score += 40;
      }

      if (normalizedAddress && rowAddress === normalizedAddress) {
        score += 100;
      } else if (normalizedAddress && rowAddress && normalizedAddress.includes(rowAddress)) {
        score += 30;
      }

      return {
        row,
        score,
      };
    })
    .sort((first, second) => second.score - first.score);

  return rankedPeople[0] && rankedPeople[0].score >= 100 ? rankedPeople[0].row : null;
}

export async function findCrewMemberById(id: string) {
  const normalizedId = readString(id);

  if (!normalizedId) {
    return null;
  }

  const people = await fetchPeopleRecords();
  return people.find((row) => row.id === normalizedId) ?? null;
}

export async function resolveExistingCrewMemberForDraft(draft: PickupSuggestionDraft) {
  if (draft.personId) {
    const crewMemberById = await findCrewMemberById(draft.personId);

    if (crewMemberById) {
      return crewMemberById;
    }
  }

  const people = await fetchPeopleRecords();
  return findBestCrewMemberMatchForDraft(draft, people);
}

export async function findExistingCrewMemberForDraft(draft: PickupSuggestionDraft) {
  const people = await fetchPeopleRecords();
  return findBestCrewMemberMatchForDraft(draft, people);
}

export function canonicalizePickupSuggestionDraft(
  draft: PickupSuggestionDraft,
  crewMember: CrewMemberRow,
): PickupSuggestionDraft {
  return {
    personId: crewMember.id,
    name: readString(crewMember.full_name) || readString(draft.name),
    address: readString(draft.address) || readString(crewMember.home_address),
    phone: readString(draft.phone) || readString(crewMember.phone),
    role: readString(draft.role) || readString(crewMember.default_role_title),
  };
}
