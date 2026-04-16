import { DashboardView } from "@/components/dashboard-view";
import { LiveMapPage } from "@/components/live-map-page";
import { LocationsPage } from "@/components/locations-page";
import { PeopleSection } from "@/components/people-section";
import { PreviewSettings } from "@/components/preview-settings";
import { ScheduleView as ScheduleViewContent } from "@/components/schedule-view";
import { TransportCalendar } from "./transport-calendar";
import { VehiclesPage } from "@/components/vehicles-page";
import { type AppSectionSlug } from "@/lib/app-sections";

type AppSectionContentProps = {
  section: AppSectionSlug;
};

export function AppSectionContent({ section }: AppSectionContentProps) {
  switch (section) {
    case "dashboard":
      return <DashboardView />;
    case "people":
      return <PeopleSection />;
    case "vehicles":
      return <VehiclesPage />;
    case "map":
      return <LiveMapPage />;
      case "calendar":
        return <TransportCalendar />;
    case "locations":
      return <LocationsPage />;
    case "schedule":
      return <ScheduleViewContent />;
    case "settings":
      return <PreviewSettings />;
    default:
      return null;
  }
}
