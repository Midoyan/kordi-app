"use client";

import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { useOrganizations } from "@/components/organization-provider";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppTopbar() {
  const { showNavbar } = useOrganizations();

  if (!showNavbar) {
    return null;
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#e4e4e1] bg-[#fbfbf8] px-4 md:px-6">
      <SidebarTrigger />
      <AppBreadcrumb />
    </header>
  );
}

