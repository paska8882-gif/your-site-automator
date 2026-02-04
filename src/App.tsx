import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserDataProvider } from "@/contexts/UserDataContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { MaintenanceOverlay } from "@/components/MaintenanceOverlay";
import { useAdmin } from "@/hooks/useAdmin";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Edit from "./pages/Edit";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";
import AdminTeamDetails from "./pages/AdminTeamDetails";
import Team from "./pages/Team";
import History from "./pages/History";
import Balance from "./pages/Balance";
import Dashboard from "./pages/Dashboard";
import Spends from "./pages/Spends";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Inner component that can use hooks
function AppContent() {
  const { maintenance, loading: maintenanceLoading } = useMaintenanceMode();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const roleReady = !authLoading && !adminLoading;
  const canBypassMaintenance = roleReady && !!user && isAdmin;

  // During maintenance mode, only allow access to /admin-login
  // All other routes are completely blocked - no exceptions
  if (!maintenanceLoading && maintenance?.enabled) {
    // Avoid flashing the maintenance screen for admins while role is still loading.
    if (!roleReady) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    // Admins bypass global maintenance overlay.
    if (canBypassMaintenance) {
      return (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/edit/:id" element={<Edit />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin/team/:teamId" element={<AdminTeamDetails />} />
            <Route path="/team" element={<Team />} />
            <Route path="/history" element={<History />} />
            <Route path="/balance" element={<Balance />} />
            <Route path="/spends" element={<Spends />} />
            <Route path="/dashboard" element={<Dashboard />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      );
    }

    return (
      <BrowserRouter>
        <Routes>
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="*" element={
            <MaintenanceOverlay 
              message={maintenance.message} 
              supportLink={maintenance.support_link} 
            />
          } />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/edit/:id" element={<Edit />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="/admin/team/:teamId" element={<AdminTeamDetails />} />
        <Route path="/team" element={<Team />} />
        <Route path="/history" element={<History />} />
        <Route path="/balance" element={<Balance />} />
        <Route path="/spends" element={<Spends />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <UserDataProvider>
            <RealtimeProvider>
              <AdminModeProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  <AppContent />
                </TooltipProvider>
              </AdminModeProvider>
            </RealtimeProvider>
          </UserDataProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
