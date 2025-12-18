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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
      <div className="p-4 md:p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Баланс</h1>
          <p className="text-muted-foreground text-sm">
            {isTeamOwner ? "Фінансова діяльність команди" : "Ваша фінансова діяльність"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Balance Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Wallet className="h-4 w-4" />
                    Поточний баланс
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${teamInfo && teamInfo.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                    ${teamInfo?.balance.toFixed(2) || "0.00"}
                  </div>
                  {teamInfo && (
                    <p className="text-xs text-muted-foreground mt-1">{teamInfo.name}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Витрачено
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">За весь час</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Повернено
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-500">${totalRefunded.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Схвалені апеляції</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    На розгляді
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">${pendingRefunds.toFixed(2)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Очікують рішення</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Daily Chart */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Витрати по днях
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dailyData.some(d => d.amount > 0) ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="date" 
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          tickFormatter={(value) => `$${value}`}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`$${value.toFixed(2)}`, "Сума"]}
                          labelFormatter={(label) => `Дата: ${label}`}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--popover))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar 
                          dataKey="amount" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      <p>Немає даних за останні 14 днів</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Buyer Chart (only for team owners) */}
              {isTeamOwner && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Витрати по баєрах
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {buyerData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={buyerData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="amount"
                            nameKey="name"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                          >
                            {buyerData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string, props: any) => [
                              `$${value.toFixed(2)} (${props.payload.count} сайтів)`, 
                              props.payload.name
                            ]}
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--popover))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                        <p>Немає даних по баєрах</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Team Spending Chart (for admins or team owners) */}
              {(isAdmin || isTeamOwner) && teamSpendingData.length > 0 && (
                <Card className={isTeamOwner && !isAdmin ? "" : "lg:col-span-2"}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Витрати по командах
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={teamSpendingData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          type="number"
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          tickFormatter={(value) => `$${value}`}
                        />
                        <YAxis 
                          type="category"
                          dataKey="name" 
                          tick={{ fontSize: 11 }} 
                          className="text-muted-foreground"
                          width={100}
                        />
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `$${value.toFixed(2)} (${props.payload.count} сайтів)`, 
                            "Витрати"
                          ]}
                          contentStyle={{ 
                            backgroundColor: "hsl(var(--popover))", 
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px"
                          }}
                        />
                        <Bar 
                          dataKey="amount" 
                          fill="hsl(var(--chart-2))" 
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Transactions List */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Історія транзакцій</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Немає транзакцій</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[300px]">
                    <div className="divide-y divide-border">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
                          <div className="shrink-0">
                            {getTransactionIcon(tx.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{tx.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), "d MMM yyyy, HH:mm", { locale: uk })}
                              {tx.user_email && isTeamOwner && (
                                <span className="ml-2 text-primary">• {tx.user_email}</span>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {tx.type === "generation" ? (
                              <span className="text-sm font-medium text-destructive">
                                -${Math.abs(tx.amount).toFixed(2)}
                              </span>
                            ) : tx.type === "appeal_approved" ? (
                              <span className="text-sm font-medium text-green-500">
                                +${tx.amount.toFixed(2)}
                              </span>
                            ) : tx.type === "appeal_pending" ? (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/50">
                                ${tx.amount.toFixed(2)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                Відхилено
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Balance;
