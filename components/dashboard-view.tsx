import { DashboardUpcomingRunsTable } from "@/components/dashboard-upcoming-runs-table";
import { getDrivePlan } from "@/lib/drive-plan";

type DashboardPanelProps = {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
};

function DashboardPanel({ title, description, children, className }: DashboardPanelProps) {
  return (
    <section
      className={`rounded-xl border border-[#e3dfe2] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)] ${className ?? ""}`}
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

export async function DashboardView() {
  const drives = await getDrivePlan();

  return (
    <div className="grid gap-24">
      <DashboardPanel
        title="Upcoming runs"
        description="A route list or dispatch table can live here."
      >
        <DashboardUpcomingRunsTable drives={drives} />
      </DashboardPanel>
    </div>
  );
}
