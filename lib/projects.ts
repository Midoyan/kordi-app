export type Project = {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  status: "Active" | "Draft" | "Archived";
};

export const defaultProjects: Project[] = [
  {
    id: "northstar-festival-run",
    organizationId: "northstar-studio",
    name: "Festival Run",
    description: "Primary dispatch board for the current festival cycle.",
    status: "Active",
  },
  {
    id: "northstar-awards-week",
    organizationId: "northstar-studio",
    name: "Awards Week",
    description: "Vehicles, crew, and routes for the awards program.",
    status: "Draft",
  },
  {
    id: "touring-summer-leg",
    organizationId: "touring-unit",
    name: "Summer Leg",
    description: "Tour routing and crew movement for the summer dates.",
    status: "Active",
  },
  {
    id: "touring-rehearsals",
    organizationId: "touring-unit",
    name: "Rehearsals",
    description: "Prep week transport plan before the show leaves base.",
    status: "Draft",
  },
  {
    id: "westcoast-stadium-series",
    organizationId: "west-coast-logistics",
    name: "Stadium Series",
    description: "Large-capacity movement plan across west coast stadium stops.",
    status: "Active",
  },
  {
    id: "westcoast-vip-shuttles",
    organizationId: "west-coast-logistics",
    name: "VIP Shuttles",
    description: "Smaller premium transport layer for guests and production leads.",
    status: "Archived",
  },
];

