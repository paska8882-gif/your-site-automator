import { AdminTeamsManager } from "@/components/AdminTeamsManager";
import { InviteCodesManager } from "@/components/InviteCodesManager";

export const AdminTeamsTab = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <AdminTeamsManager />
      <InviteCodesManager />
    </div>
  );
};
