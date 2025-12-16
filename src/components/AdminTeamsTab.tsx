import { AdminTeamsManager } from "@/components/AdminTeamsManager";
import { InviteCodesManager } from "@/components/InviteCodesManager";

export const AdminTeamsTab = () => {
  return (
    <div className="space-y-6">
      <AdminTeamsManager />
      <InviteCodesManager />
    </div>
  );
};
