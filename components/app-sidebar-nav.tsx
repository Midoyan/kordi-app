"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Car,
  Globe,
  LayoutDashboard,
  MapPin,
  Route,
  Settings,
  Users,
} from "lucide-react";

import { appSections } from "@/lib/app-sections";
import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const sectionIcons = {
  dashboard: LayoutDashboard,
  "route-builder": Route,
  people: Users,
  vehicles: Car,
  map: Globe,
  locations: MapPin,
  schedule: CalendarDays,
  settings: Settings,
} as const;

export function AppSidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarMenu>
      {appSections.map((section) => {
        const Icon = sectionIcons[section.slug];
        const href = `/${section.slug}`;
        const isActive = pathname === href;

        return (
          <SidebarMenuItem key={section.slug}>
            <SidebarMenuButton
              isActive={isActive}
              tooltip={section.label}
              render={<Link href={href} />}
              className={cn(
                "h-8 rounded-[10px] px-2.5 text-[13px] font-medium text-[#5c5c57] shadow-none hover:bg-[#ecece8] hover:text-[#181816] data-active:bg-[#d8d8d3] data-active:text-[#181816] data-active:hover:bg-[#d2d2cd] [&_svg]:size-[15px]",
              )}
            >
              <Icon />
              <span>{section.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
