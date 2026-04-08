import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
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
      <AppSidebar user={user} />
      <SidebarInset className="min-h-svh bg-[#fbfbf8]">
        <header className="sticky top-2 z-30 mx-2 mt-2 flex min-h-14 items-center gap-3 rounded-[16px] border border-white/70 bg-[rgba(251,251,248,0.92)] px-4 shadow-[0_12px_32px_-24px_rgba(15,23,42,0.42),0_1px_0_rgba(255,255,255,0.82)_inset] backdrop-blur-xl supports-[backdrop-filter]:bg-[rgba(251,251,248,0.78)] md:mx-3 md:px-6">
          <SidebarTrigger />
          <AppBreadcrumb />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
