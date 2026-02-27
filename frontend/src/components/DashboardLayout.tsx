import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "react-router-dom";
import type { ReactNode } from "react";

const pageTitles: Record<string, string> = {
  "/citizen/report": "Report Missing Person",
  "/citizen/requests": "My Requests",
  "/police/dashboard": "Police Dashboard",
  "/case-map": "Case Map",
  "/chat": "AI Assistant",
  "/bounty/result": "Payment Result",
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Pattern match for dynamic routes
  if (pathname.startsWith("/police/requests/")) return "Case Details";
  return "REUNITE";
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 !h-4" />
          <h1 className="text-sm font-semibold tracking-tight">{title}</h1>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
