import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";
import { AdminTeamsTab } from "@/components/AdminTeamsTab";
import { AdminSitesTab } from "@/components/AdminSitesTab";
import { AdminAdministratorsTab } from "@/components/AdminAdministratorsTab";
import { AdminUsersManager } from "@/components/AdminUsersManager";
import { AdminFinanceTab } from "@/components/AdminFinanceTab";
import { AdminAppealsTab } from "@/components/AdminAppealsTab";
import { AdminCommunicationTab } from "@/components/AdminCommunicationTab";
import { AdminBalanceRequestsTab } from "@/components/AdminBalanceRequestsTab";
import { AdminPaymentDetailsTab } from "@/components/AdminPaymentDetailsTab";
import { AdminReferralTab } from "@/components/AdminReferralTab";
import { AdminTasksTab } from "@/components/AdminTasksTab";
import { AdminDatabaseTab } from "@/components/AdminDatabaseTab";
import { ManualRequestsTab } from "@/components/ManualRequestsTab";
import { AdminMaintenanceToggle } from "@/components/AdminMaintenanceToggle";
import { AppLayout } from "@/components/AppLayout";

const Admin = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { isSuperAdmin } = useSuperAdmin();

  const currentTab = searchParams.get("tab") || "teams";

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

  const renderContent = () => {
    switch (currentTab) {
      case "teams":
        return <AdminTeamsTab />;
      case "sites":
        return <AdminSitesTab />;
      case "manual-requests":
        return <ManualRequestsTab />;
      case "users":
        return <AdminUsersManager />;
      case "appeals":
        return <AdminAppealsTab />;
      case "communication":
        return <AdminCommunicationTab />;
      case "balance-requests":
        return <AdminBalanceRequestsTab />;
      case "finance":
        return <AdminFinanceTab />;
      case "admin":
        return <AdminAdministratorsTab />;
      case "referral":
        return <AdminReferralTab />;
      case "payment-details":
        return isSuperAdmin ? <AdminPaymentDetailsTab /> : <AdminTeamsTab />;
      case "database":
        return isSuperAdmin ? <AdminDatabaseTab /> : <AdminTeamsTab />;
      case "tasks":
        return <AdminTasksTab />;
      default:
        return <AdminTeamsTab />;
    }
  };

  return (
    <AppLayout>
      <div className="p-4">
        <AdminMaintenanceToggle />
        {renderContent()}
      </div>
    </AppLayout>
  );
};

export default Admin;
