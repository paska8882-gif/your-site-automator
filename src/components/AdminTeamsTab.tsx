import { AdminTeamsManager } from "@/components/AdminTeamsManager";
import { InviteCodesManager } from "@/components/InviteCodesManager";

export const AdminTeamsTab = () => {
  return (
    <div className="flex flex-col gap-6">
      <AdminTeamsManager />
      <InviteCodesManager />
    </div>
  );
};
