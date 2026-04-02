import Link from "next/link";
import { LogIn, Route } from "lucide-react";

import { AppSidebarNav } from "@/components/app-sidebar-nav";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import type { AuthUser } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  user: AuthUser | null;
};

export function AppSidebar({ user }: AppSidebarProps) {
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
        <AppSidebarNav />
      </SidebarContent>

      <SidebarSeparator className="bg-[#e4e4e1]" />

      <SidebarFooter className="group-data-[collapsible=icon]">
        {user ? (
          <SidebarUserNav user={user} />
        ) : (
          <Link
            href="/auth/login"
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
