"use client";

import Link from "next/link";
import { Check, FolderKanban, Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { useOrganizations } from "@/components/organization-provider";
import {
  appSectionMap,
  getSectionActionHref,
  sectionActionLabels,
  type AppSectionSlug,
} from "@/lib/app-sections";
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
import { cn } from "@/lib/utils";

export function AppBreadcrumbClient() {
  const pathname = usePathname();
  const { activeOrganization, activeProject, orgProjects, switchProject } = useOrganizations();
  const sectionSlug = pathname.split("/").filter(Boolean)[0] as AppSectionSlug | undefined;
  const appSection = sectionSlug ? appSectionMap.get(sectionSlug) : undefined;
  const actionHref = appSection ? getSectionActionHref(appSection.slug) : undefined;
  const actionLabel = appSection ? sectionActionLabels[appSection.slug] : undefined;

  if (!appSection || !activeOrganization || !activeProject) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <Breadcrumb>
        <BreadcrumbList className="text-[12px]">
          <BreadcrumbItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 max-w-[18rem] items-center gap-2 rounded-[8px] border border-[#e2e2dc] bg-white px-3 text-[12px] font-medium text-[#4e4e49] transition-colors outline-none hover:bg-[#f3f3ef] hover:text-[#181816] focus-visible:ring-2 focus-visible:ring-[#d8d8d3]/70 aria-expanded:bg-[#ecece8]"
                >
                  <FolderKanban className="size-4 text-[#666661]" />
                  <span className="truncate">{activeProject.name}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={8}
                collisionPadding={16}
                className="w-72 border-[#e4e4e1] bg-[#fbfbf8] p-1.5 shadow-[0_18px_48px_-28px_rgba(15,23,42,0.4)]"
              >
                <DropdownMenuLabel className="m-2 p-2 font-normal">
                  <div className="grid gap-0.5">
                    <span className="text-[11px] font-semibold tracking-[0.12em] text-[#7b7b76] uppercase">
                      Switch project
                    </span>
                    <span className="text-xs text-[#6b6b67]">
                      {activeOrganization.name} projects in the current organization.
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuGroup>
                  {orgProjects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => switchProject(project.id)}
                      className="min-h-11 rounded-lg px-2.5 py-2 text-[#2a2a27] data-[highlighted]:bg-white data-[highlighted]:text-[#1d1d1b]"
                    >
                      <Check
                        className={cn(
                          "text-[#6b6b67] transition-opacity",
                          project.id === activeProject.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                        <div className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium">{project.name}</span>
                          <span className="truncate text-xs text-[#7b7b76]">
                            {project.description}
                          </span>
                        </div>
                        <span className="rounded-full bg-[#ecece8] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#5a5a55] uppercase">
                          {project.status}
                        </span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-[#e4e4e1]" />
                <DropdownMenuItem asChild className="min-h-10 rounded-lg px-2.5 py-2">
                  <Link href="/settings">
                    <Plus />
                    Manage projects
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
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
      {actionLabel ? (
        actionHref ? (
          <Link
            href={actionHref}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-[#d6d6d1] bg-white px-3 text-[12px] font-medium text-[#3d3d39] transition-colors hover:bg-[#f3f3ef]"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{actionLabel}</span>
          </Link>
        ) : (
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-[#d6d6d1] bg-white px-3 text-[12px] font-medium text-[#3d3d39] transition-colors hover:bg-[#f3f3ef]"
          >
            <Plus className="size-4" />
            <span className="hidden sm:inline">{actionLabel}</span>
          </button>
        )
      ) : null}
    </div>
  );
}
