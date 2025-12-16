import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  ArrowLeft, 
  Loader2, 
  Users,
  FileCode,
  LogOut,
  Settings,
  UserCog,
  DollarSign
} from "lucide-react";
import { AdminTeamsTab } from "@/components/AdminTeamsTab";
import { AdminSitesTab } from "@/components/AdminSitesTab";
import { AdminAdministratorsTab } from "@/components/AdminAdministratorsTab";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { AdminFinanceTab } from "@/components/AdminFinanceTab";

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/admin-login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      navigate("/admin-login");
    }
  }, [isAdmin, adminLoading, user, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold">Адмін-панель</h1>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/admin-login");
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Вийти
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="teams" className="space-y-6">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Команди
            </TabsTrigger>
            <TabsTrigger value="sites" className="flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              Сайти
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Користувачі
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Фінанси
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Адміни
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            <AdminTeamsTab />
          </TabsContent>

          <TabsContent value="sites">
            <AdminSitesTab />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsersManager />
          </TabsContent>

          <TabsContent value="finance">
            <AdminFinanceTab />
          </TabsContent>

          <TabsContent value="admin">
            <AdminAdministratorsTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
