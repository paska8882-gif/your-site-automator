import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Wallet, User } from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

interface TeamMembership {
  team_id: string;
  team_name: string;
  team_balance: number;
  role: TeamRole;
}

const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  team_lead: "Team Lead",
  buyer: "Buyer",
  tech_dev: "Tech Dev"
};

const roleColors: Record<TeamRole, string> = {
  owner: "bg-yellow-500 text-black",
  team_lead: "bg-blue-500 text-white",
  buyer: "bg-green-500 text-white",
  tech_dev: "bg-purple-500 text-white"
};

export function UserTeamInfo() {
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTeamInfo();
  }, []);

  const fetchTeamInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // Get user's team memberships
    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    // Get team details
    const teamIds = memberships.map(m => m.team_id);
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, balance")
      .in("id", teamIds);

    const teamMemberships: TeamMembership[] = memberships.map(m => {
      const team = teamsData?.find(t => t.id === m.team_id);
      return {
        team_id: m.team_id,
        team_name: team?.name || "Невідома команда",
        team_balance: team?.balance || 0,
        role: m.role as TeamRole
      };
    });

    setTeams(teamMemberships);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (teams.length === 0) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <div className="flex flex-wrap gap-4">
          {teams.map(team => (
            <div key={team.team_id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{team.team_name}</div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge className={roleColors[team.role]}>
                    <User className="h-3 w-3 mr-1" />
                    {roleLabels[team.role]}
                  </Badge>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Wallet className="h-3 w-3" />
                    <span className="font-semibold">${team.team_balance.toFixed(2)}</span>
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
