import Link from "next/link";
import { notFound } from "next/navigation";
import { Car, Plus, Route, Users } from "lucide-react";

import { LiveMapPage } from "@/components/live-map-page";
import { LocationsPage } from "@/components/locations-page";
import { PeopleSection } from "@/components/people-section";
import { ScheduleView as ScheduleViewContent } from "@/components/schedule-view";
import { VehiclesPage } from "@/components/vehicles-page";
import { DashboardUpcomingRunsTable } from "@/components/dashboard-upcoming-runs-table";
import { appSectionMap, appSections, type AppSectionSlug } from "@/lib/app-sections";
import { getDrivePlan } from "@/lib/drive-plan";

type SectionPageProps = {
  params: Promise<{
    section: string;
  }>;
};

export function generateStaticParams() {
  return appSections.map((section) => ({
    section: section.slug,
  }));
}

type PanelProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  children?: React.ReactNode;
  className?: string;
};

function ActionButton({ label, href }: { label: string; href?: string }) {
  const className =
    "inline-flex items-center gap-2 rounded-md border border-[#1f1f1d] bg-[#1f1f1d] px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#343431]";

  if (href) {
    return (
      <Link href={href} className={className}>
        <Plus className="size-4" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" className={className}>
      <Plus className="size-4" />
      {label}
    </button>
  );
}

function Panel({ title, description, actionLabel, children, className }: PanelProps) {
  return (
    <section
      className={`rounded-xl border border-[#e3e3df] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)] ${className ?? ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1d1d1b]">{title}</h2>
          {description ? (
            <p className="mt-1 text-[13px] leading-6 text-[#6b6b67]">{description}</p>
          ) : null}
        </div>
        {actionLabel ? <ActionButton label={actionLabel} /> : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function EmptyTable({
  columns,
  message,
  cta,
}: {
  columns: string[];
  message: string;
  cta: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#e7e7e4]">
      <div className="grid min-h-10 items-center border-b border-[#ecece8] bg-[#f7f7f4] px-4 text-[11px] font-semibold tracking-[0.12em] text-[#777772] uppercase" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <p className="text-[14px] font-medium text-[#1d1d1b]">{message}</p>
        <button
          type="button"
          className="rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-[#f3f3ef]"
        >
          {cta}
        </button>
      </div>
    </div>
  );
}

function StatTile({
  icon: Icon,
  title,
  cta,
}: {
  icon: typeof Route;
  title: string;
  cta: string;
}) {
  return (
    <div className="rounded-lg border border-[#e7e7e4] bg-[#fbfbf8] p-4">
      <Icon className="size-4 text-[#4b4b46]" />
      <p className="mt-3 text-[14px] font-medium text-[#1d1d1b]">{title}</p>
      <button
        type="button"
        className="mt-4 rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-white"
      >
        {cta}
      </button>
    </div>
  );
}

function EmptyList({
  items,
}: {
  items: Array<{
    title: string;
    description: string;
    cta?: string;
  }>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex items-center justify-between gap-3 rounded-lg border border-[#e7e7e4] px-4 py-3"
        >
          <div>
            <p className="text-[14px] font-medium text-[#1d1d1b]">{item.title}</p>
            <p className="mt-1 text-[13px] text-[#6b6b67]">{item.description}</p>
          </div>
          {item.cta ? (
            <button
              type="button"
              className="rounded-md border border-[#dbdbd6] px-3 py-1.5 text-[13px] text-[#43433f] transition-colors hover:bg-[#f3f3ef]"
            >
              {item.cta}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

async function DashboardView() {
  const drives = await getDrivePlan();

  return (
    <div className="grid gap-4">
      {/* <Panel
        title="Workspace setup"
        description="Start building the workspace by adding the first route, rider, and vehicle."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile icon={Route} title="Routes" cta="Add route" />
          <StatTile icon={Users} title="People" cta="Add person" />
          <StatTile icon={Car} title="Vehicles" cta="Add vehicle" />
        </div>
      </Panel> */}
      <Panel
        title="Upcoming runs"
        description="A route list or dispatch table can live here."
        className="lg:col-span-2"
      >
        <DashboardUpcomingRunsTable drives={drives} />
      </Panel>
    </div>
  );
}

function RouteBuilderView() {
  return (
    <div className="grid gap-4">
      <Panel
        title="Routes"
        description="Build routes, then connect stops, vehicles, and pickup order."
        actionLabel="Add route"
      >
        <EmptyTable
          columns={["Route", "Stops", "Vehicle", "Window", "Status"]}
          message="No routes yet."
          cta="Add route"
        />
      </Panel>
      <Panel
        title="Route details"
        description="Pick a route or create one to start shaping its stop sequence."
      >
        <EmptyList
          items={[
            {
              title: "No route selected",
              description: "Choose a route from the list or add a new one.",
            },
            {
              title: "Pickup sequence",
              description: "Stops and timing details will appear here.",
              cta: "Add pickup stop",
            },
          ]}
        />
      </Panel>
      <Panel
        title="Stops"
        description="Use this list for pickup points, order, and timing constraints."
        className="lg:col-span-2"
      >
        <EmptyTable
          columns={["Stop", "Location", "Pickup window", "Assigned people", "Notes"]}
          message="No stops added yet."
          cta="Add pickup stop"
        />
      </Panel>
    </div>
  );
}

function PeopleView() {
  return <PeopleSection />;
}

function VehiclesView() {
  return <VehiclesPage />;
}

function MapView() {
  return <LiveMapPage />;
}

function LocationsView() {
  return <LocationsPage />;
}

function ScheduleView() {
  return <ScheduleViewContent />;
}

function SettingsView() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <Panel title="Workspace" description="Basic workspace settings and operational defaults.">
        <EmptyList
          items={[
            {
              title: "General settings",
              description: "Set workspace name, timezone, and dispatch defaults.",
              cta: "Configure",
            },
          ]}
        />
      </Panel>
      <Panel title="Roles & access" description="Permissions and team access can be managed here.">
        <EmptyList
          items={[
            {
              title: "No custom roles yet",
              description: "Create access levels for dispatchers, drivers, and coordinators.",
              cta: "Add role",
            },
          ]}
        />
      </Panel>
      <Panel title="Notifications" description="Choose how alerts and updates should be delivered.">
        <EmptyList
          items={[
            {
              title: "No notification rules",
              description: "Set up reminders and transport alerts for the team.",
              cta: "Add rule",
            },
          ]}
        />
      </Panel>
    </div>
  );
}

function renderSectionBody(section: AppSectionSlug) {
  switch (section) {
    case "dashboard":
      return <DashboardView />;
    // case "route-builder":
    //   return <RouteBuilderView />;
    case "people":
      return <PeopleView />;
    case "vehicles":
      return <VehiclesView />;
    case "map":
      return <MapView />;
    case "locations":
      return <LocationsView />;
    case "schedule":
      return <ScheduleView />;
    // case "settings":
    //   return <SettingsView />;
    default:
      return null;
  }
}

export default async function SectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const currentSection = appSectionMap.get(section as AppSectionSlug);

  if (!currentSection) {
    notFound();
  }

  if (currentSection.slug === "map") {
    return <section className="flex h-[calc(100svh-3.5rem)] min-h-0 w-full flex-1 flex-col">{renderSectionBody(currentSection.slug)}</section>;
  }

  return (
    <section className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        {renderSectionBody(currentSection.slug)}
      </div>
    </section>
  );
}
