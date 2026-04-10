import { OrganizationScopeBanner } from "@/components/organization-scope-banner";

type AppSectionShellProps = {
  sectionLabel: string;
  fullscreen?: boolean;
  children: React.ReactNode;
};

export function AppSectionShell({
  sectionLabel,
  fullscreen = false,
  children,
}: AppSectionShellProps) {
  if (fullscreen) {
    return (
      <section className="flex h-[calc(100svh-3.5rem)] min-h-0 w-full flex-1 flex-col">
        {children}
      </section>
    );
  }

  return (
    <section className="flex flex-1 flex-col px-4 py-5 md:px-6 md:py-6">
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col">
        <OrganizationScopeBanner sectionLabel={sectionLabel} />
        {children}
      </div>
    </section>
  );
}
