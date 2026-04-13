import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { getTransportPlan } from "@/lib/drive-plan";
import {
  fetchPeopleRecords,
  mapCrewMemberRowToPerson,
} from "@/lib/ai/dispatch/people";
import { suggestPickupAssignment } from "@/lib/ai/dispatch/pickups";
import {
  buildTransportOverview,
  detectTransportConflicts,
} from "@/lib/ai/dispatch/transport";
import { normalizeAddressKey } from "@/lib/ai/dispatch/utils";

export function createDispatchTools() {
  return {
    get_transport_overview: tool({
      description: "Summarize the live transport plan.",
      inputSchema: z.object({}),
      execute: async () => buildTransportOverview(await getTransportPlan()),
    }),
    find_people: tool({
      description: "Find crew members by name, role, phone, address, or pickup context.",
      inputSchema: z.object({
        query: z.string().min(1),
      }),
      execute: async ({ query }) => {
        const normalizedQuery = normalizeAddressKey(query);
        const transportPlan = await getTransportPlan();
        const people = await fetchPeopleRecords();

        return people
          .map((row) => mapCrewMemberRowToPerson(row, transportPlan))
          .filter((person) =>
            [
              person.name,
              person.role,
              person.phone,
              person.address,
              person.pickupTime,
              person.pickupToLocation,
              person.pickupToLocationName,
              person.pickupToLocationAddress,
            ]
              .join(" ")
              .toLowerCase()
              .includes(normalizedQuery),
          )
          .slice(0, 10);
      },
    }),
    detect_transport_conflicts: tool({
      description: "Inspect the current plan for missing assignments, capacity issues, or route gaps.",
      inputSchema: z.object({}),
      execute: async () => detectTransportConflicts(await getTransportPlan()),
    }),
    suggest_pickup_assignment: tool({
      description: "Suggest the best pickup van and slot for a new rider.",
      inputSchema: z.object({
        name: z.string(),
        address: z.string(),
        phone: z.string().optional().default(""),
        role: z.string().optional().default(""),
      }),
      execute: async (input) => suggestPickupAssignment(input),
    }),
  };
}
