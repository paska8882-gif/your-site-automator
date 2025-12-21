import { Users } from "lucide-react";
import { AdminTeamsManager } from "@/components/AdminTeamsManager";
import { InviteCodesManager } from "@/components/InviteCodesManager";
import { AdminPageHeader } from "@/components/AdminPageHeader";

export const AdminTeamsTab = () => {
  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <AdminPageHeader 
        icon={Users} 
        title="Команди" 
        description="Управління командами та інвайт-кодами" 
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0">
        <AdminTeamsManager />
        <InviteCodesManager />
      </div>
    </div>
  );
};
