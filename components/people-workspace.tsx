"use client";

import { useCallback, useDeferredValue, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, MapPin, Plus, Search, Users } from "lucide-react";

import {
  PersonEditorSheet,
  type PersonDraft,
} from "@/components/person-editor-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PersonStatus = "Ready" | "Pending pickup" | "Draft" | "Imported";
type SavedFilterKey = "ready" | "missing-address" | "needs-pickup" | "imported";

type Person = {
  id: string;
  name: string;
  role: string;
  address: string;
  pickup: string;
  email: string;
  status: PersonStatus;
  source: "seed" | "import" | "manual";
  addedBy: "you" | "team";
  addedAt: number;
  updatedAt: number;
  timeLabel: string;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timeLabel: string;
  sortKey: number;
};

const initialPeople: Person[] = [
  {
    id: "maya-bennett",
    name: "Maya Bennett",
    role: "Lead vocalist",
    address: "145 Spring St, Nashville, TN",
    pickup: "Hotel lobby, 6:30 AM",
    email: "maya@northlane.studio",
    status: "Ready",
    source: "seed",
    addedBy: "team",
    addedAt: 1000,
    updatedAt: 1000,
    timeLabel: "08:40",
  },
  {
    id: "liam-ortega",
    name: "Liam Ortega",
    role: "Production manager",
    address: "48 W 29th St, New York, NY",
    pickup: "Stage door, 11:45 AM",
    email: "liam@showflow.co",
    status: "Pending pickup",
    source: "seed",
    addedBy: "team",
    addedAt: 900,
    updatedAt: 900,
    timeLabel: "08:32",
  },
  {
    id: "sofia-nguyen",
    name: "Sofia Nguyen",
    role: "Wardrobe",
    address: "88 Euclid Ave, Los Angeles, CA",
    pickup: "Crew entrance, 4:15 PM",
    email: "sofia@atelierworks.io",
    status: "Ready",
    source: "seed",
    addedBy: "team",
    addedAt: 800,
    updatedAt: 800,
    timeLabel: "08:18",
  },
  {
    id: "elias-price",
    name: "Elias Price",
    role: "Lighting tech",
    address: "Address pending",
    pickup: "Needs pickup plan",
    email: "No email on card",
    status: "Imported",
    source: "import",
    addedBy: "you",
    addedAt: 2300,
    updatedAt: 2300,
    timeLabel: "09:12",
  },
  {
    id: "rina-park",
    name: "Rina Park",
    role: "Stylist assistant",
    address: "",
    pickup: "North loading dock, 9:10 AM",
    email: "rina@atelierworks.io",
    status: "Draft",
    source: "manual",
    addedBy: "you",
    addedAt: 2100,
    updatedAt: 2100,
    timeLabel: "09:05",
  },
];

const initialActivity: ActivityItem[] = [
  {
    id: "activity-import-1",
    title: "Imported Elias Price",
    detail: "Added by you from vCard",
    timeLabel: "09:12",
    sortKey: 2300,
  },
  {
    id: "activity-create-1",
    title: "Added Rina Park",
    detail: "Draft row created by you",
    timeLabel: "09:05",
    sortKey: 2100,
  },
  {
    id: "activity-ready-1",
    title: "Marked Maya Bennett ready",
    detail: "Pickup is confirmed",
    timeLabel: "08:44",
    sortKey: 1040,
  },
];

const savedFilters: Array<{
  key: SavedFilterKey;
  label: string;
  description: string;
  predicate: (person: Person) => boolean;
}> = [
  {
    key: "ready",
    label: "Ready today",
    description: "Confirmed and ready to roll",
    predicate: (person) => person.status === "Ready",
  },
  {
    key: "missing-address",
    label: "Missing address",
    description: "Needs a real destination",
    predicate: (person) => isAddressMissing(person.address),
  },
  {
    key: "needs-pickup",
    label: "Needs pickup",
    description: "No pickup plan locked in",
    predicate: (person) => isPickupMissing(person.pickup),
  },
  {
    key: "imported",
    label: "Imported recently",
    description: "Review recent vCard adds",
    predicate: (person) => person.status === "Imported",
  },
];

type PickupPreview = {
  person: Person;
  sortMinutes: number;
  timeLabel: string;
  location: string;
};

type AttentionPreview = {
  person: Person;
  issues: string[];
};

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

function normalizeValue(value: string) {
  return value.trim().toLowerCase();
}

function isAddressMissing(address: string) {
  const normalized = normalizeValue(address);
  return !normalized || normalized === "address pending";
}

function isPickupMissing(pickup: string) {
  const normalized = normalizeValue(pickup);
  return !normalized || normalized === "needs pickup plan";
}

function isEmailMissing(email: string) {
  const normalized = normalizeValue(email);
  return !normalized || normalized === "no email on card";
}

function parsePickup(pickup: string) {
  const match = pickup.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) {
    return null;
  }

  const rawHours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();
  const hours = rawHours % 12 + (meridiem === "PM" ? 12 : 0);
  const location = pickup.slice(0, match.index).replace(/[,\-]\s*$/, "").trim() || "Pickup point";

  return {
    sortMinutes: hours * 60 + minutes,
    timeLabel: `${rawHours}:${match[2]} ${meridiem}`,
    location,
  };
}

function statusTone(status: PersonStatus) {
  switch (status) {
    case "Ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Pending pickup":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "Draft":
      return "border-slate-200 bg-slate-100 text-slate-600";
    case "Imported":
      return "border-sky-200 bg-sky-50 text-sky-700";
    default:
      return "border-[#d7d7d2] bg-[#f3f3ef] text-[#6b6b67]";
  }
}

function buildSearchText(person: Person) {
  return [person.name, person.role, person.address, person.pickup, person.email, person.status]
    .join(" ")
    .toLowerCase();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function PeopleWorkspace() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [people, setPeople] = useState(initialPeople);
  const [activity, setActivity] = useState(initialActivity);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<SavedFilterKey | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | null>(null);
  const [editorDraft, setEditorDraft] = useState<PersonDraft | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredPeople = people.filter((person) => {
    const matchesFilter = activeFilter
      ? savedFilters.find((filter) => filter.key === activeFilter)?.predicate(person) ?? true
      : true;
    const matchesQuery = deferredQuery ? buildSearchText(person).includes(deferredQuery) : true;

    return matchesFilter && matchesQuery;
  });

  const selectedPeople = people.filter((person) => selectedIds[person.id]);
  const nextPickups = [...people]
    .map((person) => {
      const pickup = parsePickup(person.pickup);
      return pickup ? { person, ...pickup } : null;
    })
    .filter((item): item is PickupPreview => item !== null)
    .sort((left, right) => left.sortMinutes - right.sortMinutes)
    .slice(0, 4);

  const attentionItems = [...people]
    .map((person) => {
      const issues = [
        isAddressMissing(person.address) ? "Address missing" : null,
        isPickupMissing(person.pickup) ? "Pickup plan missing" : null,
        isEmailMissing(person.email) ? "Email missing" : null,
        person.status === "Draft" ? "Still in draft" : null,
        person.status === "Imported" ? "Imported row needs review" : null,
      ].filter(isPresent);

      return issues.length > 0 ? { person, issues } : null;
    })
    .filter((item): item is AttentionPreview => item !== null)
    .sort((left, right) => right.issues.length - left.issues.length)
    .slice(0, 4);

  const pickupGroups = Array.from(
    people.reduce((groups, person) => {
      const parsedPickup = parsePickup(person.pickup);

      if (!parsedPickup) {
        return groups;
      }

      const current = groups.get(parsedPickup.location) ?? {
        location: parsedPickup.location,
        people: [] as Person[],
        earliestPickup: parsedPickup.timeLabel,
        earliestMinutes: parsedPickup.sortMinutes,
      };

      current.people.push(person);

      if (parsedPickup.sortMinutes < current.earliestMinutes) {
        current.earliestMinutes = parsedPickup.sortMinutes;
        current.earliestPickup = parsedPickup.timeLabel;
      }

      groups.set(parsedPickup.location, current);
      return groups;
    }, new Map<string, { location: string; people: Person[]; earliestPickup: string; earliestMinutes: number }>()),
  )
    .map(([, group]) => group)
    .sort((left, right) => right.people.length - left.people.length || left.earliestMinutes - right.earliestMinutes)
    .slice(0, 4);

  const recentImports = [...people]
    .filter((person) => person.source === "import")
    .sort((left, right) => right.addedAt - left.addedAt)
    .slice(0, 4);

  const recentActivity = [...activity].sort((left, right) => right.sortKey - left.sortKey).slice(0, 5);
  const allVisibleSelected = filteredPeople.length > 0 && filteredPeople.every((person) => selectedIds[person.id]);

  const appendActivity = (title: string, detail: string) => {
    const sortKey = Date.now();
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(sortKey));

    setActivity((current) => [
      {
        id: `activity-${sortKey}`,
        title,
        detail,
        timeLabel,
        sortKey,
      },
      ...current,
    ]);
  };

  const togglePersonSelection = (personId: string) => {
    setSelectedIds((current) => ({
      ...current,
      [personId]: !current[personId],
    }));
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      const next = { ...current };

      filteredPeople.forEach((person) => {
        next[person.id] = !allVisibleSelected;
      });

      return next;
    });
  };

  const applyStatusToSelection = (status: PersonStatus) => {
    if (selectedPeople.length === 0) {
      return;
    }

    const selectedSet = new Set(selectedPeople.map((person) => person.id));

    setPeople((current) =>
      current.map((person) => (selectedSet.has(person.id) ? { ...person, status, updatedAt: Date.now() } : person)),
    );
    appendActivity(
      `Marked ${selectedPeople.length} ${selectedPeople.length === 1 ? "person" : "people"} ${status.toLowerCase()}`,
      "Bulk update applied by you",
    );
  };

  const openCreateEditor = useCallback(() => {
    setEditorMode("create");
    setEditorDraft({
      name: "",
      role: "",
      address: "",
      pickup: "",
      email: "",
      status: "Draft",
    });
  }, []);

  const clearAddPersonQuery = useCallback(() => {
    if (searchParams.get("add-person") !== "1") {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.delete("add-person");
    const nextQuery = nextSearchParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (searchParams.get("add-person") !== "1") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      openCreateEditor();
      clearAddPersonQuery();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [clearAddPersonQuery, openCreateEditor, searchParams]);

  const closeEditor = useCallback(() => {
    clearAddPersonQuery();
    setEditorMode(null);
    setEditorDraft(null);
  }, [clearAddPersonQuery]);

  const savePerson = useCallback(() => {
    if (!editorDraft) {
      return;
    }

    const sortKey = Date.now();
    const timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(sortKey));
    const normalizedName = editorDraft.name.trim() || "New person";

    const nextPerson: Person = {
      id: `${slugify(normalizedName)}-${sortKey}`,
      name: normalizedName,
      role: editorDraft.role.trim() || "Role pending",
      address: editorDraft.address.trim() || "Address pending",
      pickup: editorDraft.pickup.trim() || "Needs pickup plan",
      email: editorDraft.email.trim() || "No email on card",
      status: editorDraft.status,
      source: "manual",
      addedBy: "you",
      addedAt: sortKey,
      updatedAt: sortKey,
      timeLabel,
    };

    setPeople((current) => [nextPerson, ...current]);
    setFocusedPersonId(nextPerson.id);
    appendActivity(`Added ${nextPerson.name}`, "Created by you from the people sheet");
    closeEditor();
  }, [closeEditor, editorDraft]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.34fr_0.66fr]">
      <SurfacePanel title="People roster" description="Compact roster controls for pickups, imports, and day-of coordination.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[#ecece8] bg-[#fafaf7] p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[#72726d]" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, role, pickup, address"
                className="h-9 border-[#dddcd7] bg-white pl-8 text-[12px] shadow-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-[#dbdbd6] bg-[#fafaf7] text-[#1d1d1b] hover:bg-[#f1f1ed]"
                onClick={openCreateEditor}
              >
                <Plus data-icon="inline-start" />
                Add person
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#e7e7e4] bg-white">
            <div className="grid grid-cols-[40px_1.1fr_1fr_0.9fr_0.85fr_92px] border-b border-[#ecece8] bg-[#f7f7f4] px-3 py-2 text-[10px] font-semibold tracking-[0.14em] text-[#777772] uppercase">
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSelection}
                  className="size-3.5 rounded border border-[#c7c7c1] accent-[#1d1d1b]"
                />
              </label>
              <span>Name</span>
              <span>Address</span>
              <span>Pickup</span>
              <span>Contact</span>
              <span>Status</span>
            </div>

            <div className="divide-y divide-[#f0f0ec]">
              {filteredPeople.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-[12px] font-medium text-[#1d1d1b]">No people match this view.</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#6b6b67]">
                    Clear the filter or search term to bring the roster back.
                  </p>
                </div>
              ) : (
                filteredPeople.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setFocusedPersonId(person.id)}
                    className={cn(
                      "grid w-full grid-cols-[40px_1.1fr_1fr_0.9fr_0.85fr_92px] items-start px-3 py-3 text-left transition-colors hover:bg-[#fafaf7]",
                      focusedPersonId === person.id && "bg-[#f8fbff]",
                    )}
                  >
                    <span className="flex items-start justify-center pt-0.5">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds[person.id])}
                        onChange={() => togglePersonSelection(person.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="size-3.5 rounded border border-[#c7c7c1] accent-[#1d1d1b]"
                      />
                    </span>
                    <span className="pr-3">
                      <span className="block text-[12px] font-semibold text-[#1d1d1b]">{person.name}</span>
                      <span className="mt-1 block text-[11px] text-[#6f6f69]">{person.role}</span>
                    </span>
                    <span className="pr-3 text-[11px] leading-5 text-[#43433f]">{person.address || "Address missing"}</span>
                    <span className="pr-3 text-[11px] leading-5 text-[#43433f]">{person.pickup}</span>
                    <span className="pr-3 text-[11px] leading-5 text-[#43433f]">{person.email || "Email missing"}</span>
                    <span>
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.04em]",
                          statusTone(person.status),
                        )}
                      >
                        {person.status}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-[#f1f1ed] bg-[#fcfcfa] px-4 py-3 text-[11px] text-[#6b6b67]">
            <div className="flex items-center justify-between gap-3">
              <p>
                {filteredPeople.length} visible of {people.length} total people.
              </p>
              <p className="font-medium text-[#43433f]">{selectedPeople.length} selected</p>
            </div>
            <p>Use the utility rail to jump to issues, apply saved filters, and bulk-update selection without leaving the roster.</p>
          </div>
        </div>
      </SurfacePanel>

      <div className="grid gap-4">
        <SurfacePanel title="Today" description="Live counts and pickup timing.">
          <div className="grid gap-3">
            <MiniCard title="Roster stats">
              <div className="grid grid-cols-2 gap-2">
                <StatPill label="Total" value={people.length} />
                <StatPill label="Ready" value={people.filter((person) => person.status === "Ready").length} />
                <StatPill label="Pending" value={people.filter((person) => person.status === "Pending pickup").length} />
                <StatPill label="Imported" value={people.filter((person) => person.status === "Imported").length} />
              </div>
            </MiniCard>
            <MiniCard title="Next pickups">
              <CompactList
                items={nextPickups.map(({ person, timeLabel, location }) => ({
                  id: person.id,
                  title: `${timeLabel} · ${person.name}`,
                  detail: `${location} · ${person.role}`,
                  onClick: () => setFocusedPersonId(person.id),
                }))}
                emptyTitle="No pickup windows yet"
                emptyDetail="As pickup plans are added, the nearest handoffs will surface here."
              />
            </MiniCard>
          </div>
        </SurfacePanel>

        <SurfacePanel title="Workflow" description="What needs action right now.">
          <div className="grid gap-3">
            <MiniCard title="Needs attention">
              <CompactList
                items={attentionItems.map(({ person, issues }) => ({
                  id: person.id,
                  title: person.name,
                  detail: issues.slice(0, 2).join(" · "),
                  onClick: () => setFocusedPersonId(person.id),
                  tone: "warning",
                }))}
                emptyTitle="No blockers"
                emptyDetail="Missing addresses, pickups, and imported rows will show up here."
              />
            </MiniCard>
            <MiniCard title="Selection summary">
              <div className="flex flex-col gap-3">
                <p className="text-[11px] leading-5 text-[#6b6b67]">
                  {selectedPeople.length === 0
                    ? "Select rows to bulk-update status or jump straight into the most important contact."
                    : `${selectedPeople.length} people selected. Apply a quick status update or clear the selection.`}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                    onClick={() => applyStatusToSelection("Ready")}
                    disabled={selectedPeople.length === 0}
                  >
                    Ready
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                    onClick={() => applyStatusToSelection("Pending pickup")}
                    disabled={selectedPeople.length === 0}
                  >
                    Pending
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                    onClick={() => setSelectedIds({})}
                    disabled={selectedPeople.length === 0}
                  >
                    Clear
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    className="border-[#dbdbd6] bg-white text-[#1d1d1b] hover:bg-[#f3f3ef]"
                    onClick={() => {
                      if (selectedPeople[0]) {
                        setFocusedPersonId(selectedPeople[0].id);
                      }
                    }}
                    disabled={selectedPeople.length === 0}
                  >
                    Focus first
                  </Button>
                </div>
              </div>
            </MiniCard>
          </div>
        </SurfacePanel>

        <SurfacePanel title="Coordination" description="Fast views for dispatching the day.">
          <div className="grid gap-3">
            <MiniCard title="Pickup coordination">
              <CompactList
                items={pickupGroups.map((group) => ({
                  id: group.location,
                  title: `${group.location} · ${group.people.length}`,
                  detail: `${group.earliestPickup} first pickup · ${group.people.map((person) => person.name.split(" ")[0]).join(", ")}`,
                  onClick: () => setQuery(group.location),
                }))}
                emptyTitle="No shared pickup zones"
                emptyDetail="Once pickup plans are set, grouped handoffs will appear here."
              />
            </MiniCard>
            <MiniCard title="Saved filters">
              <div className="grid gap-2">
                {savedFilters.map((filter) => {
                  const count = people.filter(filter.predicate).length;
                  const isActive = filter.key === activeFilter;

                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setActiveFilter(isActive ? null : filter.key)}
                      className={cn(
                        "flex items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-[#bbc9f8] bg-[#f6f9ff]"
                          : "border-[#e7e7e4] bg-[#fbfbf8] hover:bg-white",
                      )}
                    >
                      <span>
                        <span className="block text-[11px] font-semibold text-[#1d1d1b]">{filter.label}</span>
                        <span className="mt-0.5 block text-[10px] text-[#6b6b67]">{filter.description}</span>
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#43433f] shadow-[inset_0_0_0_1px_rgba(219,219,214,0.9)]">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </MiniCard>
          </div>
        </SurfacePanel>

        <SurfacePanel title="Intake" description="Keep new additions visible until they settle in.">
          <div className="grid gap-3">
            <MiniCard title="Recent imports">
              <CompactList
                items={recentImports.map((person) => ({
                  id: person.id,
                  title: person.name,
                  detail: `${person.role} · added by you · ${person.timeLabel}`,
                  meta: person.address,
                  onClick: () => setFocusedPersonId(person.id),
                }))}
                emptyTitle="No imports yet"
                emptyDetail="Imported contacts will land here so you can review them quickly."
              />
            </MiniCard>
            <MiniCard title="Activity">
              <CompactList
                items={recentActivity.map((item) => ({
                  id: item.id,
                  title: item.title,
                  detail: item.detail,
                  meta: item.timeLabel,
                }))}
                emptyTitle="No recent activity"
                emptyDetail="Edits, imports, and bulk changes will show up here."
              />
            </MiniCard>
          </div>
        </SurfacePanel>
      </div>

      <PersonEditorSheet
        draft={editorDraft}
        mode={editorMode}
        open={Boolean(editorDraft)}
        onClose={closeEditor}
        onSave={savePerson}
        setDraft={setEditorDraft}
      />
    </div>
  );
}

function SurfacePanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#e3e3df] bg-white p-4 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
      <div>
        <h2 className="text-[13px] font-semibold text-[#1d1d1b]">{title}</h2>
        <p className="mt-1 text-[11px] leading-5 text-[#6b6b67]">{description}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MiniCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[#5d5d58] uppercase">{title}</p>
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[#e1e1dc] bg-white px-3 py-2">
      <p className="text-[10px] font-semibold tracking-[0.1em] text-[#777772] uppercase">{label}</p>
      <p className="mt-1 text-[14px] font-semibold text-[#1d1d1b] [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}

function CompactList({
  items,
  emptyTitle,
  emptyDetail,
}: {
  items: Array<{
    id: string;
    title: string;
    detail: string;
    meta?: string;
    tone?: "warning";
    onClick?: () => void;
  }>;
  emptyTitle: string;
  emptyDetail: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#dddcd7] px-3 py-4 text-center">
        <p className="text-[11px] font-medium text-[#1d1d1b]">{emptyTitle}</p>
        <p className="mt-1 text-[10px] leading-5 text-[#6b6b67]">{emptyDetail}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold text-[#1d1d1b]">{item.title}</p>
                <p className="mt-0.5 text-[10px] leading-5 text-[#6b6b67]">{item.detail}</p>
                {item.meta ? (
                  <p className="mt-0.5 truncate text-[10px] leading-5 text-[#8a8a84]">{item.meta}</p>
                ) : null}
              </div>
              {item.tone === "warning" ? (
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-[#a87400]" />
              ) : item.meta && item.meta.includes("added by you") ? (
                <Users className="mt-0.5 size-3.5 shrink-0 text-[#5b6bb3]" />
              ) : item.meta && item.meta.includes(",") ? (
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#91918a]" />
              ) : null}
            </div>
          </>
        );

        if (!item.onClick) {
          return (
            <div key={item.id} className="rounded-lg border border-[#e6e6e1] bg-white px-3 py-2.5">
              {content}
            </div>
          );
        }

        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className="rounded-lg border border-[#e6e6e1] bg-white px-3 py-2.5 text-left transition-colors hover:bg-[#fcfcfa]"
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
