"use client";

import Link from "next/link";
import { Building2, Check, ChevronsUpDown, Plus, Settings2 } from "lucide-react";

import { useOrganizations } from "@/components/organization-provider";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrganizationSwitcher() {
  const { organizations, activeOrganization, switchOrganization } = useOrganizations();

  if (!activeOrganization) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Switch organization"
          data-kordi-shell="brand-button"
          className="flex w-full items-center gap-2 rounded-lg border border-[#e3e3df] bg-white px-2.5 py-2.5 text-left text-[#1d1d1b] transition-colors outline-none hover:bg-[#f3f3ef] focus-visible:ring-2 focus-visible:ring-[#d8d8d3]/70 aria-expanded:bg-[#f3f3ef]"
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
            <p className="truncate text-[11px] text-[#6b6b67]">{activeOrganization.name}</p>
          </div>
          <ChevronsUpDown className="size-4 text-[#6b6b67] group-data-[collapsible=icon]:hidden" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={10}
        collisionPadding={16}
        className="w-[min(22rem,calc(100vw-2rem))] rounded-[18px] border-[#e4e4e1] bg-[#fbfbf8] p-1.5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.4)]"
      >
        <DropdownMenuLabel className="p-2.5 font-normal">
          <div className="grid gap-1">
            <span className="text-[11px] font-semibold tracking-[0.14em] text-[#7b7b76] uppercase">
              Switch organization
            </span>
            <span className="text-xs leading-5 text-[#6b6b67]">
              Frontend-only state for now. Backend can replace the action handlers later.
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {organizations.map((organization) => (
            <DropdownMenuItem
              key={organization.id}
              onClick={() => switchOrganization(organization.id)}
              className="min-h-12 rounded-[14px] px-3 py-2.5 text-[#2a2a27] data-[highlighted]:bg-white data-[highlighted]:text-[#1d1d1b]"
            >
              <Check
                className={cn(
                  "size-4 text-[#6b6b67] transition-opacity",
                  organization.id === activeOrganization.id ? "opacity-100" : "opacity-0",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium">{organization.name}</span>
                  <span className="rounded-full bg-[#f1f1ec] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#5a5a55] uppercase">
                    {organization.role}
                  </span>
                </div>
                <p className="truncate text-xs text-[#7b7b76]">@{organization.handle}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-[#e4e4e1]" />
        <DropdownMenuItem asChild className="min-h-10 rounded-[14px] px-3 py-2">
          <Link href="/settings">
            <Settings2 />
            Manage organizations
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="min-h-10 rounded-[14px] px-3 py-2">
          <Link href="/settings">
            <Plus />
            New organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
