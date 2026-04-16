"use client";

import { Building2, PanelLeft } from "lucide-react";

import { useSidebar } from "@/components/ui/sidebar";

export function OrganizationSwitcher() {
  const { state, toggleSidebar } = useSidebar();

  return (
    <button
      type="button"
      aria-label={state === "expanded" ? "Collapse sidebar" : "Expand sidebar"}
      data-kordi-shell="brand-button"
      onClick={toggleSidebar}
      className="flex w-full items-center gap-2 rounded-lg border border-[#e3e3df] bg-white px-2.5 py-2.5 text-left text-[#1d1d1b] transition-colors outline-none hover:bg-[#f3f3ef] focus-visible:ring-2 focus-visible:ring-[#d8d8d3]/70"
    >
      <div
        data-kordi-shell="brand-icon"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#1d1d1b] text-white"
      >
        <Building2 className="size-4" />
      </div>
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <p className="truncate text-[0.8rem] font-semibold tracking-[0.14em] uppercase">
          Kordi
        </p>
        {/* Preview release hides the organization label until org switching returns. */}
      </div>
      <PanelLeft className="size-4 text-[#6b6b67] group-data-[collapsible=icon]:hidden" />
    </button>
  );
}
