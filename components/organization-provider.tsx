"use client";

import * as React from "react";

import { command } from "@/lib/command";
import {
  createOrganizationHandle,
  defaultOrganizations,
  type Organization,
} from "@/lib/organizations";
import { defaultProjectDays, type ProjectDay } from "@/lib/project-days";
import { defaultProjects, type Project } from "@/lib/projects";

const SHELL_STATE_STORAGE_KEY = "kordi.shell-state";

type StoredShellState = {
  activeOrganizationId?: string;
  activeProjectIdsByOrganization?: Record<string, string>;
  activeDayIdsByProject?: Record<string, string>;
  showNavbar?: boolean;
};

type OrganizationContextValue = {
  organizations: Organization[];
  activeOrganization: Organization | null;
  projects: Project[];
  orgProjects: Project[];
  activeProject: Project | null;
  projectDays: ProjectDay[];
  activeDay: ProjectDay | null;
  showNavbar: boolean;
  switchOrganization: (organizationId: string) => void;
  switchProject: (projectId: string) => void;
  switchDay: (dayId: string) => void;
  setShowNavbar: (showNavbar: boolean) => void;
  createOrganization: (name: string) => void;
  renameOrganization: (organizationId: string, name: string) => void;
  deleteOrganization: (organizationId: string) => void;
};

const OrganizationContext = React.createContext<OrganizationContextValue | null>(null);

function createOrganizationId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `org-${Date.now()}`;
}

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organizations, setOrganizations] = React.useState<Organization[]>(defaultOrganizations);
  const [projects] = React.useState<Project[]>(defaultProjects);
  const [days] = React.useState<ProjectDay[]>(defaultProjectDays);
  const [activeOrganizationId, setActiveOrganizationId] = React.useState(
    defaultOrganizations[0]?.id ?? "",
  );
  const [activeProjectIdsByOrganization, setActiveProjectIdsByOrganization] = React.useState<
    Record<string, string>
  >({});
  const [activeDayIdsByProject, setActiveDayIdsByProject] = React.useState<Record<string, string>>(
    {},
  );
  const [showNavbar, setShowNavbar] = React.useState(true);

  React.useEffect(() => {
    const storedShellState = window.localStorage.getItem(SHELL_STATE_STORAGE_KEY);

    // Older demo versions persisted org mutations locally. Drop that cache and
    // always start from the seeded/frontend-loaded org list until the backend owns it.
    window.localStorage.removeItem("kordi.organizations");

    if (storedShellState) {
      try {
        const parsedShellState = JSON.parse(storedShellState) as StoredShellState;

        if (parsedShellState.activeOrganizationId) {
          setActiveOrganizationId(parsedShellState.activeOrganizationId);
        }

        if (
          parsedShellState.activeProjectIdsByOrganization &&
          typeof parsedShellState.activeProjectIdsByOrganization === "object"
        ) {
          setActiveProjectIdsByOrganization(parsedShellState.activeProjectIdsByOrganization);
        }

        if (
          parsedShellState.activeDayIdsByProject &&
          typeof parsedShellState.activeDayIdsByProject === "object"
        ) {
          setActiveDayIdsByProject(parsedShellState.activeDayIdsByProject);
        }

        if (typeof parsedShellState.showNavbar === "boolean") {
          setShowNavbar(parsedShellState.showNavbar);
        }
      } catch {
        window.localStorage.removeItem(SHELL_STATE_STORAGE_KEY);
      }
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(
      SHELL_STATE_STORAGE_KEY,
      JSON.stringify({
        activeOrganizationId,
        activeProjectIdsByOrganization,
        activeDayIdsByProject,
        showNavbar,
      } satisfies StoredShellState),
    );
  }, [activeDayIdsByProject, activeOrganizationId, activeProjectIdsByOrganization, showNavbar]);

  React.useEffect(() => {
    if (organizations.some((organization) => organization.id === activeOrganizationId)) {
      return;
    }

    setActiveOrganizationId(organizations[0]?.id ?? "");
  }, [activeOrganizationId, organizations]);

  const activeOrganization =
    organizations.find((organization) => organization.id === activeOrganizationId) ?? null;
  const orgProjects = React.useMemo(
    () =>
      projects.filter((project) => project.organizationId === activeOrganizationId),
    [activeOrganizationId, projects],
  );
  const activeProjectId = activeOrganizationId
    ? activeProjectIdsByOrganization[activeOrganizationId]
    : undefined;
  const activeProject =
    orgProjects.find((project) => project.id === activeProjectId) ?? orgProjects[0] ?? null;
  const projectDays = React.useMemo(
    () => days.filter((day) => day.projectId === activeProject?.id),
    [activeProject?.id, days],
  );
  const activeDayId = activeProject?.id ? activeDayIdsByProject[activeProject.id] : undefined;
  const activeDay =
    projectDays.find((day) => day.id === activeDayId) ?? projectDays[0] ?? null;

  React.useEffect(() => {
    if (!activeOrganizationId || orgProjects.length === 0) {
      return;
    }

    const storedProjectId = activeProjectIdsByOrganization[activeOrganizationId];

    if (storedProjectId && orgProjects.some((project) => project.id === storedProjectId)) {
      return;
    }

    setActiveProjectIdsByOrganization((current) => ({
      ...current,
      [activeOrganizationId]: orgProjects[0].id,
    }));
  }, [activeOrganizationId, activeProjectIdsByOrganization, orgProjects]);

  React.useEffect(() => {
    if (!activeProject?.id || projectDays.length === 0) {
      return;
    }

    const storedDayId = activeDayIdsByProject[activeProject.id];

    if (storedDayId && projectDays.some((day) => day.id === storedDayId)) {
      return;
    }

    setActiveDayIdsByProject((current) => ({
      ...current,
      [activeProject.id]: projectDays[0].id,
    }));
  }, [activeDayIdsByProject, activeProject?.id, projectDays]);

  const switchOrganization = (organizationId: string) => {
    setActiveOrganizationId(organizationId);
    command.log("replace with some action", {
      type: "organization.switch",
      organizationId,
    });
  };

  const switchProject = (projectId: string) => {
    if (!activeOrganizationId) {
      return;
    }

    setActiveProjectIdsByOrganization((current) => ({
      ...current,
      [activeOrganizationId]: projectId,
    }));

    command.log("replace with some action", {
      type: "project.switch",
      organizationId: activeOrganizationId,
      projectId,
    });
  };

  const switchDay = (dayId: string) => {
    if (!activeProject?.id) {
      return;
    }

    setActiveDayIdsByProject((current) => ({
      ...current,
      [activeProject.id]: dayId,
    }));

    command.log("replace with some action", {
      type: "project-day.switch",
      organizationId: activeOrganizationId,
      projectId: activeProject.id,
      dayId,
    });
  };

  const createOrganization = (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    const nextOrganization: Organization = {
      id: createOrganizationId(),
      name: trimmedName,
      handle: createOrganizationHandle(trimmedName),
      description: "Fresh org shell ready for backend data wiring.",
      members: 1,
      projects: 0,
      role: "Owner",
    };

    setOrganizations((currentOrganizations) => [...currentOrganizations, nextOrganization]);
    setActiveOrganizationId(nextOrganization.id);

    command.log("replace with some action", {
      type: "organization.create",
      organization: nextOrganization,
    });
  };

  const renameOrganization = (organizationId: string, name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return;
    }

    setOrganizations((currentOrganizations) =>
      currentOrganizations.map((organization) =>
        organization.id === organizationId
          ? {
              ...organization,
              name: trimmedName,
              handle: createOrganizationHandle(trimmedName),
            }
          : organization,
      ),
    );

    command.log("replace with some action", {
      type: "organization.rename",
      organizationId,
      name: trimmedName,
    });
  };

  const deleteOrganization = (organizationId: string) => {
    setOrganizations((currentOrganizations) => {
      if (currentOrganizations.length <= 1) {
        return currentOrganizations;
      }

      const nextOrganizations = currentOrganizations.filter(
        (organization) => organization.id !== organizationId,
      );

      if (organizationId === activeOrganizationId) {
        setActiveOrganizationId(nextOrganizations[0]?.id ?? "");
      }

      return nextOrganizations;
    });

    command.log("replace with some action", {
      type: "organization.delete",
      organizationId,
    });
  };

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrganization,
        projects,
        orgProjects,
        activeProject,
        projectDays,
        activeDay,
        showNavbar,
        switchOrganization,
        switchProject,
        switchDay,
        setShowNavbar,
        createOrganization,
        renameOrganization,
        deleteOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizations() {
  const context = React.useContext(OrganizationContext);

  if (!context) {
    throw new Error("useOrganizations must be used within an OrganizationProvider.");
  }

  return context;
}
