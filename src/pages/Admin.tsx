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
  DollarSign,
  MessageSquare
} from "lucide-react";
import { AdminTeamsTab } from "@/components/AdminTeamsTab";
import { AdminSitesTab } from "@/components/AdminSitesTab";
import { AdminAdministratorsTab } from "@/components/AdminAdministratorsTab";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { AdminFinanceTab } from "@/components/AdminFinanceTab";
import { AdminAppealsTab } from "@/components/AdminAppealsTab";

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
        <div className="container mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              <h1 className="text-sm font-semibold">Адмін-панель</h1>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            className="h-7 text-xs"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/admin-login");
            }}
          >
            <LogOut className="h-3 w-3 mr-1" />
            Вийти
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-3 py-3">
        <Tabs defaultValue="teams" className="space-y-3">
          <TabsList className="grid w-full max-w-3xl grid-cols-6 h-8">
            <TabsTrigger value="teams" className="flex items-center gap-1 text-xs h-7">
              <Users className="h-3 w-3" />
              Команди
            </TabsTrigger>
            <TabsTrigger value="sites" className="flex items-center gap-1 text-xs h-7">
              <FileCode className="h-3 w-3" />
              Сайти
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1 text-xs h-7">
              <UserCog className="h-3 w-3" />
              Користувачі
            </TabsTrigger>
            <TabsTrigger value="appeals" className="flex items-center gap-1 text-xs h-7">
              <MessageSquare className="h-3 w-3" />
              Апеляції
            </TabsTrigger>
            <TabsTrigger value="finance" className="flex items-center gap-1 text-xs h-7">
              <DollarSign className="h-3 w-3" />
              Фінанси
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-1 text-xs h-7">
              <Settings className="h-3 w-3" />
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

          <TabsContent value="appeals">
            <AdminAppealsTab />
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
