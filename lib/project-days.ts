export type ProjectDay = {
  id: string;
  projectId: string;
  label: string;
  description: string;
  dateLabel: string;
  status: "Live" | "Upcoming" | "Complete";
};

export const defaultProjectDays: ProjectDay[] = [
  {
    id: "northstar-festival-run-day-1",
    projectId: "northstar-festival-run",
    label: "Day 1",
    description: "Load-in, arrivals, and venue rehearsals.",
    dateLabel: "Tue 8 Apr",
    status: "Complete",
  },
  {
    id: "northstar-festival-run-day-2",
    projectId: "northstar-festival-run",
    label: "Day 2",
    description: "Main show day with live dispatch tracking.",
    dateLabel: "Wed 9 Apr",
    status: "Live",
  },
  {
    id: "northstar-festival-run-day-3",
    projectId: "northstar-festival-run",
    label: "Day 3",
    description: "Strike and outbound transfers.",
    dateLabel: "Thu 10 Apr",
    status: "Upcoming",
  },
  {
    id: "northstar-awards-week-day-1",
    projectId: "northstar-awards-week",
    label: "Day 1",
    description: "Pre-lighting and airport pickups.",
    dateLabel: "Mon 14 Apr",
    status: "Upcoming",
  },
  {
    id: "northstar-awards-week-day-2",
    projectId: "northstar-awards-week",
    label: "Day 2",
    description: "Press and ceremony movements.",
    dateLabel: "Tue 15 Apr",
    status: "Upcoming",
  },
  {
    id: "touring-summer-leg-day-1",
    projectId: "touring-summer-leg",
    label: "Day 1",
    description: "Crew bus and truck coordination.",
    dateLabel: "Fri 11 Apr",
    status: "Live",
  },
  {
    id: "touring-summer-leg-day-2",
    projectId: "touring-summer-leg",
    label: "Day 2",
    description: "Venue shuttles and hotel returns.",
    dateLabel: "Sat 12 Apr",
    status: "Upcoming",
  },
  {
    id: "touring-rehearsals-day-1",
    projectId: "touring-rehearsals",
    label: "Day 1",
    description: "Technical rehearsal arrivals.",
    dateLabel: "Tue 22 Apr",
    status: "Upcoming",
  },
  {
    id: "westcoast-stadium-series-day-1",
    projectId: "westcoast-stadium-series",
    label: "Day 1",
    description: "Advance team and supplier arrivals.",
    dateLabel: "Sun 20 Apr",
    status: "Live",
  },
  {
    id: "westcoast-stadium-series-day-2",
    projectId: "westcoast-stadium-series",
    label: "Day 2",
    description: "Show day routing and VIP movement.",
    dateLabel: "Mon 21 Apr",
    status: "Upcoming",
  },
  {
    id: "westcoast-vip-shuttles-day-1",
    projectId: "westcoast-vip-shuttles",
    label: "Day 1",
    description: "Archived VIP route plan.",
    dateLabel: "Thu 27 Mar",
    status: "Complete",
  },
];

