"use client";

import * as React from "react";

import { command } from "@/lib/command";
import {
  createOrganizationHandle,
  defaultOrganizations,
  type Organization,
} from "@/lib/organizations";
import { defaultProjects, type Project } from "@/lib/projects";

const ORGANIZATIONS_STORAGE_KEY = "kordi.organizations";
const ACTIVE_ORGANIZATION_STORAGE_KEY = "kordi.active-organization";
const ACTIVE_PROJECTS_STORAGE_KEY = "kordi.active-projects";

type OrganizationContextValue = {
  organizations: Organization[];
  activeOrganization: Organization | null;
  projects: Project[];
  orgProjects: Project[];
  activeProject: Project | null;
  switchOrganization: (organizationId: string) => void;
  switchProject: (projectId: string) => void;
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
  const [activeOrganizationId, setActiveOrganizationId] = React.useState(
    defaultOrganizations[0]?.id ?? "",
  );
  const [activeProjectIdsByOrganization, setActiveProjectIdsByOrganization] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    const storedOrganizations = window.localStorage.getItem(ORGANIZATIONS_STORAGE_KEY);
    const storedActiveOrganization = window.localStorage.getItem(
      ACTIVE_ORGANIZATION_STORAGE_KEY,
    );
    const storedActiveProjects = window.localStorage.getItem(ACTIVE_PROJECTS_STORAGE_KEY);

    if (storedOrganizations) {
      try {
        const parsedOrganizations = JSON.parse(storedOrganizations) as Organization[];

        if (Array.isArray(parsedOrganizations) && parsedOrganizations.length > 0) {
          setOrganizations(parsedOrganizations);
        }
      } catch {
        window.localStorage.removeItem(ORGANIZATIONS_STORAGE_KEY);
      }
    }

    if (storedActiveOrganization) {
      setActiveOrganizationId(storedActiveOrganization);
    }

    if (storedActiveProjects) {
      try {
        const parsedActiveProjects = JSON.parse(storedActiveProjects) as Record<string, string>;

        if (parsedActiveProjects && typeof parsedActiveProjects === "object") {
          setActiveProjectIdsByOrganization(parsedActiveProjects);
        }
      } catch {
        window.localStorage.removeItem(ACTIVE_PROJECTS_STORAGE_KEY);
      }
    }
  }, []);

  React.useEffect(() => {
    window.localStorage.setItem(ORGANIZATIONS_STORAGE_KEY, JSON.stringify(organizations));
  }, [organizations]);

  React.useEffect(() => {
    if (!activeOrganizationId) {
      return;
    }

    window.localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, activeOrganizationId);
  }, [activeOrganizationId]);

  React.useEffect(() => {
    window.localStorage.setItem(
      ACTIVE_PROJECTS_STORAGE_KEY,
      JSON.stringify(activeProjectIdsByOrganization),
    );
  }, [activeProjectIdsByOrganization]);

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
        switchOrganization,
        switchProject,
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
