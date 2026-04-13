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
    slug: "map",
    label: "Live Map",
    eyebrow: "LiveMap",
    title: "Daily transport controlsd",
    description:
      "Track route health, vesdhicle readiness, and pickup pressure from one place.",
  },
  // {
  //   slug: "route-builder",
  //   label: "Route Builder",
  //   eyebrow: "Planning",
  //   title: "Shape runs before dispatch",
  //   description:
  //     "Build efficient pickup sequences, check travel load, and prepare routes for the day.",
  // },
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
    eyebrow: "Vehicles",
    title: "Keep project vehicles visible",
    description:
      "Track rental capacity, assigned drivers, and readiness without cluttering the route workflow.",
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
    slug: "calendar",
    label: "Calendar",
    eyebrow: "Calendar View",
    title: "View transport timetable on calendar",
    description:
      "See all daily transport routes and stops displayed as events on a calendar timeline.",
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

export const sectionActionLabels: Partial<Record<AppSectionSlug, string>> = {
  dashboard: "Create route",
  // "route-builder": "Add route",
  people: "Add person",
  vehicles: "Add vehicle",
  map: "Start tracking",
  locations: "Add location",
  schedule: "Add drive",
};

export function getSectionActionHref(section: AppSectionSlug) {
  switch (section) {
    case "people":
      return `/${section}?add-person=1`;
    case "vehicles":
      return `/${section}?sheet=add-vehicle`;
    case "locations":
      return `/${section}?sheet=add-location`;
    case "schedule":
      return `/${section}?sheet=add-drive`;
    default:
      return undefined;
  }
}
