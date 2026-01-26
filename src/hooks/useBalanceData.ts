import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useAdmin } from "@/hooks/useAdmin";
import { format, subDays, eachDayOfInterval, Locale } from "date-fns";
import { uk as ukLocale, ru as ruLocale } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

export interface Transaction {
  id: string;
  type: "generation" | "refund" | "appeal_pending" | "appeal_approved" | "appeal_rejected";
  amount: number;
  description: string;
  date: string;
  status?: string;
  site_name?: string;
  user_email?: string;
}

export interface TeamInfo {
  id: string;
  name: string;
  balance: number;
}

export interface DailyData {
  date: string;
  amount: number;
  count: number;
}

export interface BuyerData {
  name: string;
  email: string;
  amount: number;
  count: number;
}

export interface TeamSpendingData {
  name: string;
  amount: number;
  count: number;
}

export interface BalanceRequest {
  id: string;
  amount: number;
  note: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
  processed_at: string | null;
  user_display_name?: string;
}

interface BalanceDataResult {
  teamInfo: TeamInfo | null;
  transactions: Transaction[];
  dailyData: DailyData[];
  buyerData: BuyerData[];
  teamSpendingData: TeamSpendingData[];
}

async function fetchFinancialData(
  userId: string, 
  isTeamOwner: boolean, 
  isAdmin: boolean,
  dateLocale: Locale
): Promise<BalanceDataResult> {
  // Get user's team
  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id, teams(id, name, balance)")
    .eq("user_id", userId)
    .eq("status", "approved")
    .limit(1)
    .maybeSingle();

  let teamId: string | null = null;
  let teamInfo: TeamInfo | null = null;
  
  if (membership?.teams) {
    const team = membership.teams as unknown as TeamInfo;
    teamId = team.id;
    teamInfo = {
      id: team.id,
      name: team.name,
      balance: team.balance
    };
  }

  // Get generation history
  let generationsQuery = supabase
    .from("generation_history")
    .select("id, site_name, sale_price, status, created_at, user_id")
    .not("sale_price", "is", null)
    .order("created_at", { ascending: false });

  if (!isTeamOwner) {
    generationsQuery = generationsQuery.eq("user_id", userId);
  }

  const { data: generations } = await generationsQuery;

  // Get team members for buyer chart (only for team owners)
  let teamMembersMap: Map<string, { email: string; name: string }> = new Map();
  if (isTeamOwner && teamId) {
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("status", "approved");

    if (teamMembers) {
      const userIds = teamMembers.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      profiles?.forEach(p => {
        teamMembersMap.set(p.user_id, { 
          email: p.display_name || p.user_id.slice(0, 8), 
          name: p.display_name || "Користувач" 
        });
      });
    }
  }

  // Get appeals
  let appealsQuery = supabase
    .from("appeals")
    .select("id, generation_id, amount_to_refund, status, created_at, resolved_at")
    .order("created_at", { ascending: false });

  if (!isTeamOwner) {
    appealsQuery = appealsQuery.eq("user_id", userId);
  }

  const { data: appeals } = await appealsQuery;

  // Build transactions list
  const txList: Transaction[] = [];

  generations?.forEach(gen => {
    if (gen.sale_price && gen.sale_price > 0) {
      const userInfo = teamMembersMap.get(gen.user_id || "");
      txList.push({
        id: gen.id,
        type: "generation",
        amount: -gen.sale_price,
        description: gen.site_name || "Генерація сайту",
        date: gen.created_at,
        status: gen.status,
        site_name: gen.site_name || undefined,
        user_email: userInfo?.email
      });
    }
  });

  appeals?.forEach(appeal => {
    if (appeal.status === "approved") {
      txList.push({
        id: appeal.id,
        type: "appeal_approved",
        amount: appeal.amount_to_refund,
        description: "Повернення за апеляцією",
        date: appeal.resolved_at || appeal.created_at
      });
    } else if (appeal.status === "rejected") {
      txList.push({
        id: appeal.id,
        type: "appeal_rejected",
        amount: 0,
        description: "Апеляція відхилена",
        date: appeal.resolved_at || appeal.created_at
      });
    } else {
      txList.push({
        id: appeal.id,
        type: "appeal_pending",
        amount: appeal.amount_to_refund,
        description: "Апеляція на розгляді",
        date: appeal.created_at
      });
    }
  });

  txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Build daily chart data (last 14 days)
  const last14Days = eachDayOfInterval({
    start: subDays(new Date(), 13),
    end: new Date()
  });

  const dailyMap = new Map<string, { amount: number; count: number }>();
  last14Days.forEach(day => {
    dailyMap.set(format(day, "yyyy-MM-dd"), { amount: 0, count: 0 });
  });

  generations?.forEach(gen => {
    if (gen.sale_price && gen.sale_price > 0) {
      const dateKey = format(new Date(gen.created_at), "yyyy-MM-dd");
      if (dailyMap.has(dateKey)) {
        const current = dailyMap.get(dateKey)!;
        dailyMap.set(dateKey, {
          amount: current.amount + gen.sale_price,
          count: current.count + 1
        });
      }
    }
  });

  const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
    date: format(new Date(date), "d MMM", { locale: dateLocale }),
    amount: data.amount,
    count: data.count
  }));

  // Build buyer chart data
  let buyerData: BuyerData[] = [];
  if (isTeamOwner && generations) {
    const buyerMap = new Map<string, { email: string; name: string; amount: number; count: number }>();
    
    generations.forEach(gen => {
      if (gen.sale_price && gen.sale_price > 0 && gen.user_id) {
        const userInfo = teamMembersMap.get(gen.user_id) || { email: gen.user_id.slice(0, 8), name: "Невідомий" };
        const current = buyerMap.get(gen.user_id) || { ...userInfo, amount: 0, count: 0 };
        buyerMap.set(gen.user_id, {
          ...current,
          amount: current.amount + gen.sale_price,
          count: current.count + 1
        });
      }
    });

    buyerData = Array.from(buyerMap.values())
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }

  // Build team spending chart data
  let teamSpendingData: TeamSpendingData[] = [];
  if (isAdmin || isTeamOwner) {
    const { data: allTeams } = await supabase
      .from("teams")
      .select("id, name");

    if (allTeams) {
      const teamSpendingMap = new Map<string, { name: string; amount: number; count: number }>();
      
      allTeams.forEach(team => {
        teamSpendingMap.set(team.id, { name: team.name, amount: 0, count: 0 });
      });

      const { data: allGenerations } = await supabase
        .from("generation_history")
        .select("user_id, sale_price")
        .not("sale_price", "is", null);

      if (allGenerations) {
        const { data: allMemberships } = await supabase
          .from("team_members")
          .select("user_id, team_id")
          .eq("status", "approved");

        const userTeamMap = new Map<string, string>();
        allMemberships?.forEach(m => {
          userTeamMap.set(m.user_id, m.team_id);
        });

        allGenerations.forEach(gen => {
          if (gen.sale_price && gen.sale_price > 0 && gen.user_id) {
            const teamId = userTeamMap.get(gen.user_id);
            if (teamId && teamSpendingMap.has(teamId)) {
              const current = teamSpendingMap.get(teamId)!;
              teamSpendingMap.set(teamId, {
                ...current,
                amount: current.amount + gen.sale_price,
                count: current.count + 1
              });
            }
          }
        });
      }

      teamSpendingData = Array.from(teamSpendingMap.values())
        .filter(t => t.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
    }
  }

  return {
    teamInfo,
    transactions: txList,
    dailyData,
    buyerData,
    teamSpendingData,
  };
}

export function useBalanceData() {
  const { user } = useAuth();
  const { isTeamOwner } = useTeamOwner();
  const { isAdmin } = useAdmin();
  const { language } = useLanguage();
  const dateLocale = language === "uk" ? ukLocale : ruLocale;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["balanceData", user?.id, isTeamOwner, isAdmin],
    queryFn: () => fetchFinancialData(user!.id, isTeamOwner, isAdmin, dateLocale),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return {
    teamInfo: data?.teamInfo ?? null,
    transactions: data?.transactions ?? [],
    dailyData: data?.dailyData ?? [],
    buyerData: data?.buyerData ?? [],
    teamSpendingData: data?.teamSpendingData ?? [],
    isLoading,
    refetch,
  };
}

export function useBalanceRequests(teamInfo: TeamInfo | null) {
  const { user } = useAuth();
  const { isTeamOwner } = useTeamOwner();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["balanceRequests", user?.id, teamInfo?.id, isTeamOwner],
    queryFn: async () => {
      const { data: ownRequests } = await supabase
        .from("balance_requests")
        .select("id, amount, note, status, admin_comment, created_at, processed_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      let teamRequests: BalanceRequest[] = [];

      if (isTeamOwner && teamInfo) {
        const { data: teamData } = await supabase
          .from("balance_requests")
          .select("id, user_id, amount, note, status, admin_comment, created_at, processed_at")
          .eq("team_id", teamInfo.id)
          .neq("user_id", user!.id)
          .order("created_at", { ascending: false });

        if (teamData && teamData.length > 0) {
          const userIds = [...new Set(teamData.map(r => r.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", userIds);

          const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

          teamRequests = teamData.map(r => ({
            ...r,
            user_display_name: profileMap.get(r.user_id) || "Невідомий"
          }));
        }
      }

      return {
        ownRequests: ownRequests || [],
        teamRequests,
      };
    },
    enabled: !!user && !!teamInfo,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  return {
    balanceRequests: data?.ownRequests ?? [],
    teamBalanceRequests: data?.teamRequests ?? [],
    isLoading,
    refetch,
  };
}
