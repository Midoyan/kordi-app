import Link from "next/link";
import { LogIn } from "lucide-react";

import { OrganizationSwitcher } from "@/components/organization-switcher";
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
        <OrganizationSwitcher />
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
