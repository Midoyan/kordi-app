import { Route } from "lucide-react";

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
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#e4e4e1] bg-[#fbfbf8]/95 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <div className="flex items-center gap-2 text-[13px] text-[#6b6b67]">
            <Route className="size-4" />
            <span>Kordi workspace</span>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
