import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Users, Wallet } from "lucide-react";
import { useBalanceSound } from "@/hooks/useBalanceSound";
import { useLanguage } from "@/contexts/LanguageContext";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

interface TeamMembership {
  team_id: string;
  team_name: string;
  team_balance: number;
  role: TeamRole;
}

export function UserTeamInfo() {
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [animatingTeamId, setAnimatingTeamId] = useState<string | null>(null);
  const [balanceDirection, setBalanceDirection] = useState<"positive" | "negative" | null>(null);
  const prevBalancesRef = useRef<Record<string, number>>({});
  const { playBalanceSound } = useBalanceSound();
  const { t } = useLanguage();

  const roleLabels: Record<TeamRole, string> = {
    owner: t("team.owner"),
    team_lead: t("team.teamLead"),
    buyer: t("team.buyer"),
    tech_dev: t("team.techDev")
  };

  useEffect(() => {
    fetchTeamInfo();

    // Realtime subscription for balance updates
    const channel = supabase
      .channel("user-team-balance")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams" },
        (payload) => {
          const teamId = payload.new.id;
          const newBalance = payload.new.balance;
          const prevBalance = prevBalancesRef.current[teamId];

          setTeams(prev => {
            const teamExists = prev.some(t => t.team_id === teamId);
            if (!teamExists) return prev;

            // Determine if balance increased or decreased
            if (prevBalance !== undefined && prevBalance !== newBalance) {
              const isPositive = newBalance > prevBalance;
              setBalanceDirection(isPositive ? "positive" : "negative");
              setAnimatingTeamId(teamId);
              playBalanceSound(isPositive);
              
              setTimeout(() => {
                setAnimatingTeamId(null);
                setBalanceDirection(null);
              }, 600);
            }

            prevBalancesRef.current[teamId] = newBalance;

            return prev.map(team =>
              team.team_id === teamId
                ? { ...team, team_balance: newBalance }
                : team
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playBalanceSound]);

  const fetchTeamInfo = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: memberships } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "approved");

    if (!memberships || memberships.length === 0) {
      setLoading(false);
      return;
    }

    const teamIds = memberships.map(m => m.team_id);
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name, balance")
      .in("id", teamIds);

    const teamMemberships: TeamMembership[] = memberships.map(m => {
      const team = teamsData?.find(t => t.id === m.team_id);
      const balance = team?.balance || 0;
      prevBalancesRef.current[m.team_id] = balance;
      return {
        team_id: m.team_id,
        team_name: team?.name || "Невідома команда",
        team_balance: balance,
        role: m.role as TeamRole
      };
    });

    setTeams(teamMemberships);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="border border-border p-4 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="border border-border p-4 text-center text-muted-foreground">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t("team.noTeam")}</p>
      </div>
    );
  }

  return (
    <div className="border border-border">
      {teams.map((team, idx) => (
        <div 
          key={team.team_id} 
          className={`flex items-center justify-between p-4 ${idx > 0 ? 'border-t border-border' : ''}`}
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">{team.team_name}</div>
              <div className="text-xs text-muted-foreground">{roleLabels[team.role]}</div>
            </div>
          </div>
          <div 
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded ${
              animatingTeamId === team.team_id 
                ? balanceDirection === "positive" 
                  ? "balance-changed" 
                  : "balance-changed-negative"
                : ""
            }`}
          >
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">${team.team_balance.toFixed(2)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
