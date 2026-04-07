"use client";

import { Building2, FolderKanban, Users } from "lucide-react";

import { useOrganizations } from "@/components/organization-provider";

export function OrganizationScopeBanner({ sectionLabel }: { sectionLabel: string }) {
  const { activeOrganization } = useOrganizations();

  if (!activeOrganization) {
    return null;
  }

  return (
    <section className="mb-4 rounded-[24px] border border-[#e3e3df] bg-[linear-gradient(135deg,#ffffff_0%,#f5f4ef_100%)] p-4 shadow-[0_14px_40px_-30px_rgba(15,23,42,0.45)] md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e0dfd8] bg-white/80 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[#676760] uppercase">
            <Building2 className="size-3.5" />
            Current organization
          </div>
          <h1 className="mt-3 text-[22px] font-semibold tracking-[-0.02em] text-[#1d1d1b]">
            {sectionLabel} for {activeOrganization.name}
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-[#5f5f5a]">
            This section is scoped to <span className="font-medium text-[#1d1d1b]">@{activeOrganization.handle}</span>.
            Keep the wiring here and your backend can later swap in org-specific records.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#e5e4de] bg-white/90 px-3 py-3">
            <div className="flex items-center gap-2 text-[#6a6a65]">
              <Users className="size-4" />
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">
                Team
              </span>
            </div>
            <p className="mt-2 text-[18px] font-semibold text-[#1d1d1b]">
              {activeOrganization.members}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e5e4de] bg-white/90 px-3 py-3">
            <div className="flex items-center gap-2 text-[#6a6a65]">
              <FolderKanban className="size-4" />
              <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">
                Projects
              </span>
            </div>
            <p className="mt-2 text-[18px] font-semibold text-[#1d1d1b]">
              {activeOrganization.projects}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

