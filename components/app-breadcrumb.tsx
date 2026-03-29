"use client";

import { Check, Plus } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { appSectionMap, type AppSectionSlug } from "@/lib/app-sections";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const demoWorkspaces = [
  {
    id: "kordi",
    name: "New Project",
    description: "Main transport control",
  },
] as const;

export function AppBreadcrumb() {
  const pathname = usePathname();
  const [workspaceId, setWorkspaceId] = useState<(typeof demoWorkspaces)[number]["id"]>("kordi");
  const sectionSlug = pathname.split("/").filter(Boolean)[0] as AppSectionSlug | undefined;
  const appSection = sectionSlug ? appSectionMap.get(sectionSlug) : undefined;
  const activeWorkspace =
    demoWorkspaces.find((workspace) => workspace.id === workspaceId) ?? demoWorkspaces[0];


  const workspaceMenuContent = (
    <DropdownMenuContent
      align="start"
      sideOffset={8}
      collisionPadding={16}
      className="w-72 border-[#e4e4e1] bg-[#fbfbf8] p-1.5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.4)]"
    >
      <DropdownMenuLabel className="m-2 p-2 font-normal">
        <div className="grid gap-0.5">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-[#7b7b76] uppercase">
            Switch workspace
          </span>
          <span className="text-xs text-[#6b6b67]">
            Demo workspaces for navbar states.
          </span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuGroup>
        {demoWorkspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => setWorkspaceId(workspace.id)}
            className="min-h-11 rounded-lg px-2.5 py-2 text-[#2a2a27] data-[highlighted]:bg-white data-[highlighted]:text-[#1d1d1b]"
          >
            <Check
              className={cn(
                "text-[#6b6b67] transition-opacity",
                workspace.id === workspaceId ? "opacity-100" : "opacity-0",
              )}
            />
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
              <div className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{workspace.name}</span>
                <span className="truncate text-xs text-[#7b7b76]">
                  {workspace.description}
                </span>
              </div>
              {workspace.id === workspaceId ? (
                <span className="rounded-full bg-[#ecece8] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#5a5a55] uppercase">
                  Current
                </span>
              ) : null}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator className="bg-[#e4e4e1]" />
      <DropdownMenuItem
        disabled
        className="min-h-10 rounded-lg px-2.5 py-2 text-[#8a8a85] data-[highlighted]:bg-transparent data-[highlighted]:text-[#8a8a85]"
      >
        <Plus />
        Add workspace
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (!appSection) {
    return null;
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-[12px]">
        <BreadcrumbItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-9 max-w-[15rem] items-center rounded-[7px] px-2.5 text-[12px] font-medium text-[#5c5c57] transition-colors outline-none hover:bg-[#ecece8] hover:text-[#181816] focus-visible:ring-2 focus-visible:ring-[#d8d8d3]/70 aria-expanded:bg-[#d8d8d3] aria-expanded:text-[#181816]"
              >
                <span className="truncate">{activeWorkspace.name}</span>
              </button>
            </DropdownMenuTrigger>
            {workspaceMenuContent}
          </DropdownMenu>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="text-[#8a8a85]" />
        <BreadcrumbItem>
          <BreadcrumbPage className="text-[#6b6b67]">
            {appSection.label}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
