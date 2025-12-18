import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Wallet, TrendingDown, TrendingUp, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface Transaction {
  id: string;
  type: "generation" | "refund" | "appeal_pending" | "appeal_approved" | "appeal_rejected";
  amount: number;
  description: string;
  date: string;
  status?: string;
  site_name?: string;
}

interface TeamInfo {
  id: string;
  name: string;
  balance: number;
}

const Balance = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
  }, [user]);

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

      if (membership?.teams) {
        const team = membership.teams as unknown as TeamInfo;
        setTeamInfo({
          id: team.id,
          name: team.name,
          balance: team.balance
        });
      }

      // Get generation history with sale prices
      const { data: generations } = await supabase
        .from("generation_history")
        .select("id, site_name, sale_price, status, created_at")
        .eq("user_id", user!.id)
        .not("sale_price", "is", null)
        .order("created_at", { ascending: false });

      // Get appeals
      const { data: appeals } = await supabase
        .from("appeals")
        .select("id, generation_id, amount_to_refund, status, created_at, resolved_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      // Build transactions list
      const txList: Transaction[] = [];

      // Add generations as transactions
      generations?.forEach(gen => {
        if (gen.sale_price && gen.sale_price > 0) {
          txList.push({
            id: gen.id,
            type: "generation",
            amount: -gen.sale_price,
            description: gen.site_name || "Генерація сайту",
            date: gen.created_at,
            status: gen.status,
            site_name: gen.site_name || undefined
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
          <p className="text-muted-foreground text-sm">Фінансова діяльність команди</p>
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
                  <ScrollArea className="h-[400px]">
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
