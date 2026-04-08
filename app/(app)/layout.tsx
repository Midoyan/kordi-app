import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { OrganizationProvider } from "@/components/organization-provider";
import { getCurrentUser } from "@/lib/auth";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <SidebarProvider>
      <OrganizationProvider>
        <AppSidebar user={user} />
        <SidebarInset className="min-h-svh bg-[#fbfbf8]">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#e4e4e1] bg-[#fbfbf8] px-4 md:px-6">
            <SidebarTrigger />
            <AppBreadcrumb />
          </header>
          {children}
        </SidebarInset>
      </OrganizationProvider>
    </SidebarProvider>
  );
}
