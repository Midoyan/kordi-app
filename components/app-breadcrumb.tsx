import { AppBreadcrumbClient } from "@/components/app-breadcrumb-client";

const demoWorkspaces = [
  {
    id: "kordi",
    name: "New Project",
    description: "Main transport control",
  },
] as const;

export function AppBreadcrumb() {
  return <AppBreadcrumbClient workspaces={demoWorkspaces} />;
}
