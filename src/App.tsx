import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { UserDataProvider } from "@/contexts/UserDataContext";
import { RealtimeProvider } from "@/contexts/RealtimeContext";
import { AdminModeProvider } from "@/contexts/AdminModeContext";
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
