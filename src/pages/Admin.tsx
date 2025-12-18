import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Users,
  FileCode,
  Settings,
  UserCog,
  DollarSign,
  MessageSquare,
  Bell,
  Headphones
} from "lucide-react";
import { AdminTeamsTab } from "@/components/AdminTeamsTab";
import { AdminSitesTab } from "@/components/AdminSitesTab";
import { AdminAdministratorsTab } from "@/components/AdminAdministratorsTab";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { AdminFinanceTab } from "@/components/AdminFinanceTab";
import { AdminAppealsTab } from "@/components/AdminAppealsTab";
import { AdminSupportTab } from "@/components/AdminSupportTab";
import { AdminNotificationsManager } from "@/components/AdminNotificationsManager";
import { AppLayout } from "@/components/AppLayout";

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
    <AppLayout>
      <div className="p-4">
        <Tabs defaultValue="teams" className="space-y-3">
          <TabsList className="grid w-full max-w-4xl grid-cols-8 h-8">
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
            <TabsTrigger value="support" className="flex items-center gap-1 text-xs h-7">
              <Headphones className="h-3 w-3" />
              Підтримка
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1 text-xs h-7">
              <Bell className="h-3 w-3" />
              Сповіщення
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

          <TabsContent value="support">
            <AdminSupportTab />
          </TabsContent>

          <TabsContent value="notifications">
            <div className="max-w-md">
              <AdminNotificationsManager />
            </div>
          </TabsContent>

          <TabsContent value="finance">
            <AdminFinanceTab />
          </TabsContent>

          <TabsContent value="admin">
            <AdminAdministratorsTab />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;
