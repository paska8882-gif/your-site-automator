import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wallet, TrendingDown, TrendingUp, Clock, XCircle, Loader2, Users, CalendarDays, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { uk as ukLocale, ru as ruLocale } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { BalanceRequestForm } from "@/components/BalanceRequestForm";
import { BalanceRequestsList } from "@/components/BalanceRequestsList";
import { useBalanceData, useBalanceRequests, Transaction } from "@/hooks/useBalanceData";

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
  const { t, language } = useLanguage();
  const dateLocale = language === "uk" ? ukLocale : ruLocale;

  const { 
    teamInfo, 
    transactions, 
    dailyData, 
    buyerData, 
    teamSpendingData, 
    isLoading 
  } = useBalanceData();

  const { 
    balanceRequests, 
    teamBalanceRequests, 
    refetch: refetchRequests 
  } = useBalanceRequests(teamInfo);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
          <h1 className="text-xl font-bold">{t("balance.title")}</h1>
          <p className="text-muted-foreground text-xs">
            {isTeamOwner ? t("balance.teamBalance") : t("balance.title")}
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
                  {t("balance.title")}
                </div>
                <div className={`text-lg font-bold ${teamInfo && teamInfo.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                  ${teamInfo?.balance.toFixed(2) || "0.00"}
                </div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingDown className="h-3 w-3" />
                  {t("balance.totalSpent")}
                </div>
                <div className="text-lg font-bold">${totalSpent.toFixed(2)}</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3 w-3" />
                  {t("balance.refunded")}
                </div>
                <div className="text-lg font-bold text-green-500">${totalRefunded.toFixed(2)}</div>
              </Card>

              <Card className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3 w-3" />
                  {t("balance.pendingRefund")}
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
                  {t("balance.dailyActivity")}
                </div>
                {dailyData.some(d => d.amount > 0) ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} interval={2} />
                      <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}`} width={35} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, t("balance.amount")]}
                        contentStyle={{ fontSize: 11, backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                      />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[140px] flex items-center justify-center text-muted-foreground text-xs">
                    {t("balance.empty")}
                  </div>
                )}
              </Card>

              {/* Buyer Chart */}
              {isTeamOwner && (
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
                    <Users className="h-3 w-3" />
                    {t("balance.buyerContributions")}
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
                      {t("balance.empty")}
                    </div>
                  )}
                </Card>
              )}

              {/* Team Spending Chart */}
              {teamSpendingData.length > 0 && (
                <Card className="p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-2">
                    <Building2 className="h-3 w-3" />
                    {t("balance.teamSpending")}
                  </div>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={teamSpendingData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={60} />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, t("balance.totalSpent")]}
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
                  onSuccess={refetchRequests}
                />
                <BalanceRequestsList 
                  requests={balanceRequests}
                  loading={false}
                  title={t("balance.myRequests")}
                />
                {isTeamOwner && (
                  <BalanceRequestsList 
                    requests={teamBalanceRequests}
                    loading={false}
                    showUserName={true}
                    title={t("balance.teamRequests")}
                  />
                )}
              </div>
            )}

            {/* Transactions List */}
            <Card className="p-3">
              <div className="text-sm font-medium mb-2">{t("balance.transactionsHistory")}</div>
              {transactions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <Wallet className="h-8 w-8 mx-auto mb-1 opacity-50" />
                  {t("balance.empty")}
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
                            {format(new Date(tx.date), "d MMM, HH:mm", { locale: dateLocale })}
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
                            <Badge variant="outline" className="text-muted-foreground text-[10px] px-1 py-0">{t("balance.rejected")}</Badge>
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
