import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { Loader2 } from "lucide-react";
import { TeamManagement } from "@/components/TeamManagement";
import { UserTeamInfo } from "@/components/UserTeamInfo";
import { ReferralProgram } from "@/components/ReferralProgram";
import { BlockedUserOverlay } from "@/components/BlockedUserOverlay";
import { AppLayout } from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Team() {
  const navigate = useNavigate();
  const { user, loading, isBlocked } = useAuth();
  const { isTeamOwner, loading: teamLoading } = useTeamOwner();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading || teamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <h1 className="text-xl font-semibold">Моя команда</h1>
        
        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team">Команда</TabsTrigger>
            <TabsTrigger value="referral">Реферальна програма</TabsTrigger>
          </TabsList>
          
          <TabsContent value="team" className="space-y-4">
            {/* Team Info for all users */}
            <UserTeamInfo />
            
            {/* Team Management only for owners */}
            {isTeamOwner && (
              <div className="mt-6">
                <h2 className="text-lg font-medium mb-4">Управління командою</h2>
                <TeamManagement />
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="referral">
            <ReferralProgram />
          </TabsContent>
        </Tabs>
      </div>
      {isBlocked && <BlockedUserOverlay />}
    </AppLayout>
  );
}