import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { Separator } from "@/components/ui/separator";
import { useBackendHealth } from "@/hooks/useBackendHealth";
import { BackendStatusBanner } from "@/components/BackendStatusBanner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { status, retry, isRetrying, lastErrorAt, consecutiveFailures } = useBackendHealth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          <BackendStatusBanner
            isDown={status === "degraded"}
            onRetry={retry}
            isRetrying={isRetrying}
            lastErrorAt={lastErrorAt}
            consecutiveFailures={consecutiveFailures}
          />

          {/* Top Header */}
          <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/50 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-auto">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

