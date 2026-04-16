"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EllipsisVertical,
  LogOut,
  Settings2,
} from "lucide-react";

import { createClient } from "@/lib/client";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AuthUser } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type SidebarUserNavProps = {
  user: AuthUser;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SidebarUserNav({ user }: SidebarUserNavProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const initials = getInitials(user.name);

  const handleSignOut = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-kordi-shell="auth-button"
              className="h-auto min-h-12 rounded-lg border border-[#e3e3df] bg-white px-2.5 py-2.5 text-[#1d1d1b] shadow-none hover:bg-[#f3f3ef] aria-expanded:bg-[#f3f3ef] aria-expanded:text-[#1d1d1b] [&_svg:not([class*='size-'])]:size-4"
            >
              <Avatar className="rounded-lg border border-[#ecece8] bg-[#f3f3ef]">
                <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                <AvatarFallback className="rounded-lg bg-[#ecece8] text-[11px] font-semibold tracking-[0.08em] text-[#3f3f3a]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-[#6b6b67]">
                  {user.email ?? "Signed in"}
                </span>
              </div>
              <EllipsisVertical className="ml-auto text-[#6b6b67] group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[var(--anchor-width)] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="rounded-lg border border-[#ecece8] bg-[#f3f3ef]">
                  <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg bg-[#ecece8] text-[11px] font-semibold tracking-[0.08em] text-[#3f3f3a]">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email ?? "Signed in"}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings2 />
                Settings
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => void handleSignOut()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
