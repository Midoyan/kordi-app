export const appSections = [
  {
    slug: "dashboard",
    label: "Dashboard",
    eyebrow: "Overview",
    title: "Daily transport control",
    description:
      "Track route health, vehicle readiness, and pickup pressure from one place.",
  },
  {
    slug: "route-builder",
    label: "Route Builder",
    eyebrow: "Planning",
    title: "Shape runs before dispatch",
    description:
      "Build efficient pickup sequences, check travel load, and prepare routes for the day.",
  },
  {
    slug: "people",
    label: "People",
    eyebrow: "Crew",
    title: "Keep assignments visible",
    description:
      "Organize riders, confirm availability, and spot gaps before they affect the schedule.",
  },
  {
    slug: "vehicles",
    label: "Vehicles",
    eyebrow: "Fleet",
    title: "Monitor capacity and readiness",
    description:
      "Keep every van, car, or shuttle mapped to the jobs that need it most.",
  },
  {
    slug: "locations",
    label: "Locations",
    eyebrow: "Map",
    title: "Coordinate every stop",
    description:
      "Store pickup points, venue addresses, and recurring destinations in one shared view.",
  },
  {
    slug: "schedule",
    label: "Schedule",
    eyebrow: "Timing",
    title: "See today as a single timeline",
    description:
      "Align transport windows, call times, and route changes without juggling multiple tools.",
  },
  {
    slug: "settings",
    label: "Settings",
    eyebrow: "Workspace",
    title: "Tune the control room",
    description:
      "Adjust defaults, team preferences, and operational rules for the whole workspace.",
  },
] as const;

export type AppSection = (typeof appSections)[number];
export type AppSectionSlug = AppSection["slug"];

export const appSectionMap = new Map(
  appSections.map((section) => [section.slug, section]),
);
