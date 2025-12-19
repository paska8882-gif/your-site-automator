import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, TrendingDown, TrendingUp, Clock, XCircle, Loader2, Users, CalendarDays, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useAdmin } from "@/hooks/useAdmin";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { uk } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BalanceRequestForm } from "@/components/BalanceRequestForm";
import { BalanceRequestsList } from "@/components/BalanceRequestsList";

interface Transaction {
  id: string;
  type: "generation" | "refund" | "appeal_pending" | "appeal_approved" | "appeal_rejected";
  amount: number;
  description: string;
  date: string;
  status?: string;
  site_name?: string;
  user_email?: string;
}

interface TeamInfo {
  id: string;
  name: string;
  balance: number;
}

interface DailyData {
  date: string;
  amount: number;
  count: number;
}

interface BuyerData {
  name: string;
  email: string;
  amount: number;
  count: number;
}

interface TeamSpendingData {
  name: string;
  amount: number;
  count: number;
}

interface BalanceRequest {
  id: string;
  amount: number;
  note: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
  processed_at: string | null;
  user_display_name?: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#8884d8",
  "#82ca9d",
  "#ffc658",
];

const Balance = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isTeamOwner } = useTeamOwner();
  const { isAdmin } = useAdmin();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [buyerData, setBuyerData] = useState<BuyerData[]>([]);
  const [teamSpendingData, setTeamSpendingData] = useState<TeamSpendingData[]>([]);
  const [balanceRequests, setBalanceRequests] = useState<BalanceRequest[]>([]);
  const [teamBalanceRequests, setTeamBalanceRequests] = useState<BalanceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFinancialData();
    }
  }, [user, isTeamOwner, isAdmin]);

  useEffect(() => {
    if (user && teamInfo) {
      fetchBalanceRequests();
    }
  }, [user, teamInfo, isTeamOwner]);

  const fetchBalanceRequests = async () => {
    try {
      // Fetch user's own requests
      const { data: ownRequests } = await supabase
        .from("balance_requests")
        .select("id, amount, note, status, admin_comment, created_at, processed_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      
      setBalanceRequests(ownRequests || []);

      // If team owner, fetch all team requests
      if (isTeamOwner && teamInfo) {
        const { data: teamRequests } = await supabase
          .from("balance_requests")
          .select("id, user_id, amount, note, status, admin_comment, created_at, processed_at")
          .eq("team_id", teamInfo.id)
          .neq("user_id", user!.id)
          .order("created_at", { ascending: false });

        if (teamRequests && teamRequests.length > 0) {
          // Get user names
          const userIds = [...new Set(teamRequests.map(r => r.user_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, display_name")
            .in("user_id", userIds);

          const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

          const enrichedRequests = teamRequests.map(r => ({
            ...r,
            user_display_name: profileMap.get(r.user_id) || "Невідомий"
          }));

          setTeamBalanceRequests(enrichedRequests);
        } else {
          setTeamBalanceRequests([]);
        }
      }
    } catch (error) {
      console.error("Error fetching balance requests:", error);
    }
  };

  const fetchFinancialData = async () => {
    setIsLoading(true);
    
    try {
      // Get user's team
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id, teams(id, name, balance)")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      let teamId: string | null = null;
      if (membership?.teams) {
        const team = membership.teams as unknown as TeamInfo;
        teamId = team.id;
        setTeamInfo({
          id: team.id,
          name: team.name,
          balance: team.balance
        });
      }

      // Get generation history - for team owners, get all team members' data
      let generationsQuery = supabase
        .from("generation_history")
        .select("id, site_name, sale_price, status, created_at, user_id")
        .not("sale_price", "is", null)
        .order("created_at", { ascending: false });

      if (!isTeamOwner) {
        generationsQuery = generationsQuery.eq("user_id", user!.id);
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
          
          // Get profiles for these users
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
        appealsQuery = appealsQuery.eq("user_id", user!.id);
      }

      const { data: appeals } = await appealsQuery;

      // Build transactions list
      const txList: Transaction[] = [];

      // Add generations as transactions
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

      // Add appeals as transactions
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

      // Sort by date descending
      txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txList);

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

      const dailyChartData = Array.from(dailyMap.entries()).map(([date, data]) => ({
        date: format(new Date(date), "d MMM", { locale: uk }),
        amount: data.amount,
        count: data.count
      }));
      setDailyData(dailyChartData);

      // Build buyer chart data (only for team owners)
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

        const buyerChartData = Array.from(buyerMap.values())
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);
        setBuyerData(buyerChartData);
      }

      // Build team spending chart data (for admins or team owners)
      if (isAdmin || isTeamOwner) {
        // Get all teams with their generation totals
        const { data: allTeams } = await supabase
          .from("teams")
          .select("id, name");

        if (allTeams) {
          const teamSpendingMap = new Map<string, { name: string; amount: number; count: number }>();
          
          allTeams.forEach(team => {
            teamSpendingMap.set(team.id, { name: team.name, amount: 0, count: 0 });
          });

          // Get all generations with team info via team_members
          const { data: allGenerations } = await supabase
            .from("generation_history")
            .select("user_id, sale_price")
            .not("sale_price", "is", null);

          if (allGenerations) {
            // Get user to team mapping
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

          const teamChartData = Array.from(teamSpendingMap.values())
            .filter(t => t.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 10);
          setTeamSpendingData(teamChartData);
        }
      }

    } catch (error) {
      console.error("Error fetching financial data:", error);
    }
    
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const totalSpent = transactions
    .filter(t => t.type === "generation")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  const totalRefunded = transactions
    .filter(t => t.type === "appeal_approved")
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingRefunds = transactions
    .filter(t => t.type === "appeal_pending")
    .reduce((sum, t) => sum + t.amount, 0);

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "generation":
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      case "appeal_approved":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "appeal_rejected":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case "appeal_pending":
        return <Clock className="h-4 w-4 text-amber-500" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  return (
    <AppLayout>
      <div className="p-3 md:p-4 space-y-3">
        <div className="space-y-0.5">
          <h1 className="text-xl font-bold">Баланс</h1>
          <p className="text-muted-foreground text-xs">
            {isTeamOwner ? "Фінансова діяльність команди" : "Ваша фінансова діяльність"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Balance Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Wallet className="h-3 w-3" />
                  Баланс
                </div>
                <div className={`text-lg font-bold ${teamInfo && teamInfo.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                  ${teamInfo?.balance.toFixed(2) || "0.00"}
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingDown className="h-3 w-3" />
                  Витрачено
                </div>
                <div className="text-lg font-bold">${totalSpent.toFixed(2)}</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  Повернено
                </div>
                <div className="text-lg font-bold text-green-500">${totalRefunded.toFixed(2)}</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3 w-3" />
                  На розгляді
                </div>
                <div className="text-lg font-bold text-amber-500">${pendingRefunds.toFixed(2)}</div>
              </Card>
            </div>

            {/* Charts - all in one row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {/* Daily Chart */}
              <Card className="p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
                  <CalendarDays className="h-3 w-3" />
                  По днях
                </div>
                {dailyData.some(d => d.amount > 0) ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={2} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}`} width={35} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, "Сума"]}
                        contentStyle={{ fontSize: 11, backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[140px] flex items-center justify-center text-muted-foreground text-xs">
                    Немає даних
                  </div>
                )}
              </Card>

              {/* Buyer Chart */}
              {isTeamOwner && (
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
                    <Users className="h-3 w-3" />
                    По баєрах
                  </div>
                  {buyerData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie
                          data={buyerData}
                          cx="30%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={50}
                          paddingAngle={2}
                          dataKey="amount"
                          nameKey="name"
                        >
                          {buyerData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend 
                          layout="vertical" 
                          align="right" 
                          verticalAlign="middle"
                          wrapperStyle={{ fontSize: 10, right: 0 }}
                          formatter={(value, entry: any) => <span className="text-foreground">{entry.payload.name}</span>}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [`$${value.toFixed(2)}`, props.payload.name]}
                          contentStyle={{ fontSize: 11, backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[140px] flex items-center justify-center text-muted-foreground text-xs">
                      Немає даних
                    </div>
                  )}
                </Card>
              )}

              {/* Team Spending Chart */}
              {(isAdmin || isTeamOwner) && teamSpendingData.length > 0 && (
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
                    <Building2 className="h-3 w-3" />
                    По командах
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={teamSpendingData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={60} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, "Витрати"]}
                        contentStyle={{ fontSize: 11, backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              )}
            </div>

            {/* Balance Requests Section */}
            {teamInfo && (
              <div className={`grid grid-cols-1 ${isTeamOwner ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3`}>
                <BalanceRequestForm 
                  userId={user.id} 
                  teamId={teamInfo.id}
                  onSuccess={fetchBalanceRequests}
                />
                <BalanceRequestsList 
                  requests={balanceRequests}
                  loading={false}
                  title="Мої запити"
                />
                {isTeamOwner && (
                  <BalanceRequestsList 
                    requests={teamBalanceRequests}
                    loading={false}
                    showUserName={true}
                    title="Запити команди"
                  />
                )}
              </div>
            )}

            {/* Transactions List */}
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">Історія транзакцій</div>
              {transactions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <Wallet className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  Немає транзакцій
                </div>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center gap-2 py-2 hover:bg-muted/50 transition-colors">
                        <div className="shrink-0">{getTransactionIcon(tx.type)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{tx.description}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {format(new Date(tx.date), "d MMM, HH:mm", { locale: uk })}
                            {tx.user_email && isTeamOwner && <span className="ml-1 text-primary">• {tx.user_email}</span>}
                          </p>
                        </div>
                        <div className="text-right shrink-0 text-xs">
                          {tx.type === "generation" ? (
                            <span className="font-medium text-destructive">-${Math.abs(tx.amount).toFixed(2)}</span>
                          ) : tx.type === "appeal_approved" ? (
                            <span className="font-medium text-green-500">+${tx.amount.toFixed(2)}</span>
                          ) : tx.type === "appeal_pending" ? (
                            <Badge variant="outline" className="text-amber-500 border-amber-500/50 text-[10px] px-1 py-0">${tx.amount.toFixed(2)}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1 py-0">Відхилено</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Balance;
