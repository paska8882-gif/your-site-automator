import { Users } from "lucide-react";
import { AdminTeamsManager } from "@/components/AdminTeamsManager";
import { InviteCodesManager } from "@/components/InviteCodesManager";
import { AdminSystemMonitor } from "@/components/AdminSystemMonitor";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";

export const AdminTeamsTab = () => {
  const { t } = useLanguage();
  
  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <AdminPageHeader 
        icon={Users} 
        title={t("admin.teamsTitle")} 
        description={t("admin.teamsDescription")} 
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        <AdminTeamsManager />
        <div className="flex flex-col gap-3">
          <AdminSystemMonitor />
          <div className="flex-1 min-h-0">
            <InviteCodesManager />
          </div>
        </div>
      </div>
    </div>
  );
};
