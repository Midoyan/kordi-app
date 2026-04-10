import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { OrganizationProvider } from "@/components/organization-provider";
import { getCurrentUser } from "@/lib/auth";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

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
          <AppTopbar />
          {children}
        </SidebarInset>
      </OrganizationProvider>
    </SidebarProvider>
  );
}
