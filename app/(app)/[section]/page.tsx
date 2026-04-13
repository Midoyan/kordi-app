import { notFound } from "next/navigation";

import { LiveMapPage } from "@/components/live-map-page";
import { LocationsPage } from "@/components/locations-page";
import { OrganizationScopeBanner } from "@/components/organization-scope-banner";
import { OrganizationsSettings } from "@/components/organizations-settings";
import { PeopleSection } from "@/components/people-section";
import { ScheduleView as ScheduleViewContent } from "@/components/schedule-view";
import { TransportCalendar } from "@/components/transport-calendar";
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
  children?: React.ReactNode;
  className?: string;
};

function Panel({ title, description, children, className }: PanelProps) {
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
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

async function DashboardView() {
  const drives = await getDrivePlan();

  return (
    <div className="grid gap-4">
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

function CalendarView() {
  return <TransportCalendar />;
}

function SettingsView() {
  return <OrganizationsSettings />;
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
    case "calendar":
      return <CalendarView />;
    case "settings":
      return <SettingsView />;
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
        <OrganizationScopeBanner sectionLabel={currentSection.label} />
        {renderSectionBody(currentSection.slug)}
      </div>
    </section>
  );
}
