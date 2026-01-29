import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ShoppingCart, Calendar, FileCode2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
}

interface BuyerGenerationsAnalyticsProps {
  members: TeamMember[];
  teamId: string;
}

type PeriodOption = "7" | "14" | "30" | "90" | "all";

const periodLabels: Record<PeriodOption, string> = {
  "7": "7 днів",
  "14": "14 днів",
  "30": "30 днів",
  "90": "90 днів",
  "all": "Весь час"
};

interface GenerationStat {
  user_id: string;
  status: string;
  sale_price: number | null;
  generation_cost: number | null;
}

export function BuyerGenerationsAnalytics({ members, teamId }: BuyerGenerationsAnalyticsProps) {
  const [period, setPeriod] = useState<PeriodOption>("30");
  const [generations, setGenerations] = useState<GenerationStat[]>([]);
  const [loading, setLoading] = useState(true);

  // Get buyers only
  const buyers = useMemo(() => 
    members.filter(m => m.role === "buyer" && m.status === "approved"),
    [members]
  );

  // Fetch generations based on period - прямий запит до БД
  useEffect(() => {
    const fetchGenerations = async () => {
      setLoading(true);
      
      let query = supabase
        .from("generation_history")
        .select("user_id, status, sale_price, generation_cost")
        .eq("team_id", teamId);

      // Фільтрація по періоду
      if (period !== "all") {
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);
        query = query.gte("created_at", startDate.toISOString());
      }

      const { data } = await query;
      setGenerations(data || []);
      setLoading(false);
    };

    if (teamId && buyers.length > 0) {
      fetchGenerations();
    } else {
      setLoading(false);
    }
  }, [teamId, period, buyers.length]);

  // Calculate stats per buyer
  const buyerStats = useMemo(() => {
    const buyerUserIds = new Set(buyers.map(b => b.user_id));
    
    const stats = new Map<string, {
      user_id: string;
      name: string;
      total: number;
      completed: number;
      failed: number;
      inProgress: number;
      revenue: number;
      costs: number;
    }>();

    // Initialize all buyers with zero stats
    buyers.forEach(b => {
      stats.set(b.user_id, {
        user_id: b.user_id,
        name: b.display_name || "Невідомий",
        total: 0,
        completed: 0,
        failed: 0,
        inProgress: 0,
        revenue: 0,
        costs: 0
      });
    });

    // Aggregate generation stats (тільки для баєрів цієї команди)
    generations.forEach(g => {
      if (!g.user_id || !buyerUserIds.has(g.user_id)) return;
      const buyerStat = stats.get(g.user_id);
      if (!buyerStat) return;

      buyerStat.total += 1;
      if (g.status === "completed") {
        buyerStat.completed += 1;
        buyerStat.revenue += g.sale_price || 0;
        buyerStat.costs += g.generation_cost || 0;
      } else if (g.status === "failed") {
        buyerStat.failed += 1;
      } else if (g.status === "pending" || g.status === "generating") {
        buyerStat.inProgress += 1;
      }
    });

    return Array.from(stats.values()).sort((a, b) => b.completed - a.completed);
  }, [buyers, generations]);

  // Chart data
  const chartData = useMemo(() => 
    buyerStats.map(b => ({
      name: b.name.length > 12 ? b.name.slice(0, 12) + "…" : b.name,
      fullName: b.name,
      completed: b.completed,
      failed: b.failed
    })),
    [buyerStats]
  );

  // Total stats for period
  const totals = useMemo(() => {
    return buyerStats.reduce((acc, b) => ({
      total: acc.total + b.total,
      completed: acc.completed + b.completed,
      failed: acc.failed + b.failed,
      revenue: acc.revenue + b.revenue,
      costs: acc.costs + b.costs
    }), { total: 0, completed: 0, failed: 0, revenue: 0, costs: 0 });
  }, [buyerStats]);

  if (buyers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Генерації по баєрах
          </CardTitle>
          <Select value={period} onValueChange={(v: PeriodOption) => setPeriod(v)}>
            <SelectTrigger className="w-[120px] h-8 text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(periodLabels) as PeriodOption[]).map(p => (
                <SelectItem key={p} value={p}>{periodLabels[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-lg font-bold">{totals.completed}</div>
                <div className="text-[10px] text-muted-foreground">Успішних</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-lg font-bold text-destructive">{totals.failed}</div>
                <div className="text-[10px] text-muted-foreground">Невдалих</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-lg font-bold text-green-600">${totals.revenue.toFixed(0)}</div>
                <div className="text-[10px] text-muted-foreground">Дохід</div>
              </div>
              <div className="p-2 bg-muted/50 rounded">
                <div className="text-lg font-bold text-orange-500">${totals.costs.toFixed(2)}</div>
                <div className="text-[10px] text-muted-foreground">Витрати AI</div>
              </div>
            </div>

            {/* Bar Chart */}
            {chartData.length > 0 && (
              <div className="h-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={80} 
                      tick={{ fontSize: 10 }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--popover))", 
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px"
                      }}
                      formatter={(value: number, name: string) => [
                        value, 
                        name === "completed" ? "Успішних" : "Невдалих"
                      ]}
                      labelFormatter={(label) => {
                        const item = chartData.find(d => d.name === label);
                        return item?.fullName || label;
                      }}
                    />
                    <Bar dataKey="completed" name="completed" fill="hsl(var(--chart-2))" radius={[0, 2, 2, 0]} stackId="a" />
                    <Bar dataKey="failed" name="failed" fill="hsl(var(--destructive))" radius={[0, 2, 2, 0]} stackId="a" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Detailed List */}
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {buyerStats.map((buyer, idx) => (
                <div 
                  key={buyer.user_id} 
                  className="flex items-center justify-between p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{buyer.name}</div>
                      <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                        <span className="text-green-600">${buyer.revenue.toFixed(0)}</span>
                        <span>•</span>
                        <span className="text-orange-500">${buyer.costs.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs h-5">
                      <FileCode2 className="h-3 w-3 mr-1" />
                      {buyer.completed}
                    </Badge>
                    {buyer.failed > 0 && (
                      <Badge variant="destructive" className="text-xs h-5">
                        {buyer.failed}
                      </Badge>
                    )}
                    {buyer.inProgress > 0 && (
                      <Badge variant="outline" className="text-xs h-5 text-blue-500 border-blue-500">
                        {buyer.inProgress}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
