"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Car,
  Globe,
  LayoutDashboard,
  LogIn,
  MapPin,
  Route,
  Settings,
  UserRound,
  Users,
} from "lucide-react";

import type { AuthUser } from "@/lib/auth";
import { appSections } from "@/lib/app-sections";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
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

type AppSidebarProps = {
  user: AuthUser | null;
};

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <Sidebar className="border-r border-[#e4e4e1] bg-[#f7f7f4]" collapsible="icon">
      <SidebarHeader className="gap-3 px-3 py-3 group-data-[collapsible=icon]:px-2">
        <Link
          href="/dashboard"
          aria-label="Kordi dashboard"
          data-kordi-shell="brand-button"
          className="flex items-center gap-2 rounded-lg border border-[#e3e3df] bg-white px-2.5 py-2.5 transition-colors hover:bg-[#f3f3ef]"
        >
          <div
            data-kordi-shell="brand-icon"
            className="flex size-8 items-center justify-center rounded-md bg-[#1d1d1b] text-white"
          >
            <Route className="size-4" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-[0.8rem] font-semibold tracking-[0.14em] uppercase">
              Kordi
            </p>
            <p className="truncate text-[11px] text-[#6b6b67]">
              Transport control
            </p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator className="bg-[#e4e4e1]" />

      <SidebarContent className="px-2 py-2">
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
      </SidebarContent>

      <SidebarSeparator className="bg-[#e4e4e1]" />

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:px-2">
        {user ? (
          <Link
            href="/settings"
            aria-label="User settings"
            data-kordi-shell="auth-button"
            className="flex items-center gap-2 rounded-lg border border-[#e3e3df] bg-white px-2.5 py-2.5 text-[#1d1d1b] transition-colors hover:bg-[#f3f3ef]"
          >
            <div
              data-kordi-shell="auth-icon"
              className="flex size-8 items-center justify-center rounded-md bg-[#ecece8] text-[#1d1d1b]"
            >
              <UserRound className="size-4" />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="truncate text-[13px] font-medium">{user.name}</p>
              <p className="truncate text-[11px] text-[#6b6b67]">
                {user.email ?? "Signed in"}
              </p>
            </div>
          </Link>
        ) : (
          <Link
            href="/login"
            aria-label="Login"
            data-kordi-shell="auth-button"
            className="flex items-center justify-center gap-2 rounded-lg bg-[#1d1d1b] px-3 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2c2c29]"
          >
            <LogIn data-kordi-shell="login-icon" className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">Login</span>
          </Link>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
