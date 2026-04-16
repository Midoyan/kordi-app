export type Organization = {
  id: string;
  name: string;
  handle: string;
  description: string;
  members: number;
  projects: number;
  role: "Owner" | "Admin" | "Member";
};

export const defaultOrganizations: Organization[] = [
  {
    id: "northstar-studio",
    name: "Northstar Studio",
    handle: "northstar",
    description: "Main production workspace for active transport planning.",
    members: 12,
    projects: 4,
    role: "Owner",
  },
  {
    id: "touring-unit",
    name: "Touring Unit",
    handle: "touring",
    description: "Separate org for temporary runs, rehearsals, and guest crews.",
    members: 6,
    projects: 2,
    role: "Admin",
  },
  {
    id: "west-coast-logistics",
    name: "West Coast Logistics",
    handle: "west-coast",
    description: "Region-specific org to keep dispatch data clean and isolated.",
    members: 18,
    projects: 7,
    role: "Member",
  },
];

export function createOrganizationHandle(name: string) {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return sanitized || "new-org";
}

