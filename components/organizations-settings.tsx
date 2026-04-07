"use client";

import * as React from "react";
import {
  Building2,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

import { useOrganizations } from "@/components/organization-provider";
import { type Organization } from "@/lib/organizations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

type DialogState =
  | { type: "create" }
  | { type: "rename"; organization: Organization }
  | { type: "delete"; organization: Organization }
  | null;

export function OrganizationsSettings() {
  const {
    organizations,
    activeOrganization,
    switchOrganization,
    createOrganization,
    renameOrganization,
    deleteOrganization,
  } = useOrganizations();
  const [dialogState, setDialogState] = React.useState<DialogState>(null);
  const [draftName, setDraftName] = React.useState("");

  const openCreateDialog = () => {
    setDraftName("");
    setDialogState({ type: "create" });
  };

  const openRenameDialog = (organization: Organization) => {
    setDraftName(organization.name);
    setDialogState({ type: "rename", organization });
  };

  const closeDialog = () => {
    setDialogState(null);
    setDraftName("");
  };

  const handleCreate = () => {
    createOrganization(draftName);
    closeDialog();
  };

  const handleRename = () => {
    if (dialogState?.type !== "rename") {
      return;
    }

    renameOrganization(dialogState.organization.id, draftName);
    closeDialog();
  };

  const handleDelete = () => {
    if (dialogState?.type !== "delete") {
      return;
    }

    deleteOrganization(dialogState.organization.id);
    closeDialog();
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)]">
      <Card className="border border-[#e3e3df] bg-white py-0 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)]">
        <CardHeader className="border-b border-[#ecece8] px-5 py-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-[17px] text-[#1d1d1b]">Organizations</CardTitle>
              <CardDescription className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
                Basic frontend shell for switching, creating, renaming, and deleting orgs.
              </CardDescription>
            </div>
            <Button
              onClick={openCreateDialog}
              className="h-9 rounded-[10px] border border-[#1f1f1d] bg-[#1f1f1d] px-3 text-[13px] text-white hover:bg-[#343431]"
            >
              <Plus className="size-4" />
              New organization
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 py-3">
          <div className="space-y-2">
            {organizations.map((organization) => {
              const isActive = organization.id === activeOrganization?.id;

              return (
                <div
                  key={organization.id}
                  className="rounded-[18px] border border-[#ebeae4] bg-[#fcfcfa] p-3 transition-colors hover:border-[#e1dfd7]"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <button
                      type="button"
                      onClick={() => switchOrganization(organization.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-[#1d1d1b]">
                          {organization.name}
                        </span>
                        {isActive ? (
                          <span className="rounded-full bg-[#ecece8] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#5a5a55] uppercase">
                            Current
                          </span>
                        ) : null}
                        <span className="rounded-full border border-[#e5e4de] bg-white px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#686863] uppercase">
                          {organization.role}
                        </span>
                      </div>
                      <p className="mt-1 text-[13px] text-[#61615c]">@{organization.handle}</p>
                      <p className="mt-2 max-w-2xl text-[13px] leading-6 text-[#6b6b67]">
                        {organization.description}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[#62625d]">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e5df] bg-white px-2.5 py-1">
                          <Users className="size-3.5" />
                          {organization.members} members
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e6e5df] bg-white px-2.5 py-1">
                          <FolderKanban className="size-3.5" />
                          {organization.projects} projects
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => switchOrganization(organization.id)}
                          className="border-[#dbdbd6] bg-white text-[#3d3d39] hover:bg-[#f3f3ef]"
                        >
                          Switch
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-[#666661] hover:bg-[#f0f0ea] hover:text-[#1d1d1b]"
                          >
                            <MoreHorizontal className="size-4" />
                            <span className="sr-only">Organization actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          sideOffset={8}
                          className="w-44 rounded-[14px] border-[#e4e4e1] bg-[#fbfbf8] p-1.5"
                        >
                          <DropdownMenuItem onClick={() => openRenameDialog(organization)}>
                            <Pencil className="size-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDialogState({ type: "delete", organization })}
                            className="text-[#b23a32] data-[highlighted]:bg-[#fff1ef] data-[highlighted]:text-[#982f28]"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card className="border border-[#e3e3df] bg-[linear-gradient(180deg,#ffffff_0%,#f8f7f2_100%)] py-0 shadow-[0_12px_30px_-26px_rgba(15,23,42,0.45)]">
          <CardHeader className="px-5 py-5">
            <CardTitle className="text-[17px] text-[#1d1d1b]">Current org</CardTitle>
            <CardDescription className="mt-1 text-[13px] leading-6 text-[#6b6b67]">
              Simple preview of what the active workspace state can drive across the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {activeOrganization ? (
              <div className="space-y-4">
                <div className="rounded-[20px] border border-[#e6e5df] bg-white p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-[14px] bg-[#1d1d1b] text-white">
                      <Building2 className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-semibold text-[#1d1d1b]">
                        {activeOrganization.name}
                      </p>
                      <p className="truncate text-[13px] text-[#6b6b67]">
                        @{activeOrganization.handle}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-[13px] leading-6 text-[#666661]">
                    {activeOrganization.description}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[18px] border border-[#e6e5df] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-[#7b7b76] uppercase">
                      Scoped content
                    </p>
                    <p className="mt-2 text-[14px] font-medium text-[#1d1d1b]">
                      Pages can now read the active org and label content accordingly.
                    </p>
                  </div>
                  <div className="rounded-[18px] border border-[#e6e5df] bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold tracking-[0.14em] text-[#7b7b76] uppercase">
                      Backend handoff
                    </p>
                    <p className="mt-2 text-[14px] font-medium text-[#1d1d1b]">
                      Replace the placeholder `command.log(...)` calls with real API actions.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogState?.type === "create"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create organization</DialogTitle>
            <DialogDescription>
              Extremely basic modal for the first CRUD pass. Your backend can later own the submit action.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="organization-name" className="text-[12px] font-medium text-[#4d4d48]">
              Organization name
            </label>
            <Input
              id="organization-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Acme Touring"
              className="h-10 border-[#d9d8d2] bg-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="border-[#dbdbd6] bg-white">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!draftName.trim()}
              className="bg-[#1f1f1d] text-white hover:bg-[#343431]"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState?.type === "rename"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename organization</DialogTitle>
            <DialogDescription>
              This is the lightweight rename flow you asked for. It only updates local frontend state for now.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="rename-organization-name" className="text-[12px] font-medium text-[#4d4d48]">
              New name
            </label>
            <Input
              id="rename-organization-name"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="Renamed organization"
              className="h-10 border-[#d9d8d2] bg-white"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="border-[#dbdbd6] bg-white">
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={!draftName.trim()}
              className="bg-[#1f1f1d] text-white hover:bg-[#343431]"
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogState?.type === "delete"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete organization</DialogTitle>
            <DialogDescription>
              This removes the org from local state only. Keep at least one org around so the switcher still has a home.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-[18px] border border-[#f0d5d0] bg-[#fff7f5] p-4 text-[14px] leading-6 text-[#7a4038]">
            {dialogState?.type === "delete" ? (
              <span>
                Delete <span className="font-semibold">{dialogState.organization.name}</span>?
              </span>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} className="border-[#dbdbd6] bg-white">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={organizations.length <= 1}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

