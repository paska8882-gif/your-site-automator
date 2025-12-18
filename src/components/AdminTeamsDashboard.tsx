import { useState, useEffect, useMemo } from "react";
import { Users, Wallet, TrendingUp, TrendingDown, FileCode2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface AdminTeam {
  id: string;
  name: string;
  balance: number;
}

interface AdminTeamsDashboardProps {
  teams: AdminTeam[];
}

interface GenerationData {
  team_id: string;
  sale_price: number;
  created_at: string;
  status: string;
}

type Period = 7 | 30;

export function AdminTeamsDashboard({ teams }: AdminTeamsDashboardProps) {
  const [generations, setGenerations] = useState<GenerationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(7);

  useEffect(() => {
    const fetchGenerations = async () => {
      setLoading(true);
      const teamIds = teams.map(t => t.id);
      if (teamIds.length === 0) {
        setLoading(false);
        return;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - period);

      const { data } = await supabase
        .from("generation_history")
        .select("team_id, sale_price, created_at, status")
        .in("team_id", teamIds)
        .gte("created_at", startDate.toISOString());

      setGenerations(data || []);
      setLoading(false);
    };

    fetchGenerations();
  }, [teams, period]);

  const metrics = useMemo(() => {
    const totalTeams = teams.length;
    const totalBalance = teams.reduce((sum, t) => sum + t.balance, 0);
    const totalDebt = teams.filter(t => t.balance < 0).reduce((sum, t) => sum + Math.abs(t.balance), 0);
    const completedGens = generations.filter(g => g.status === "completed");
    const totalGenerations = completedGens.length;
    const totalRevenue = completedGens.reduce((sum, g) => sum + (g.sale_price || 0), 0);

    return { totalTeams, totalBalance, totalDebt, totalGenerations, totalRevenue };
  }, [teams, generations]);

  const gensByTeam = useMemo(() => {
    const teamMap = new Map<string, { name: string; count: number; revenue: number }>();
    teams.forEach(t => teamMap.set(t.id, { name: t.name, count: 0, revenue: 0 }));
    
    generations.filter(g => g.status === "completed").forEach(g => {
      const team = teamMap.get(g.team_id);
      if (team) {
        team.count++;
        team.revenue += g.sale_price || 0;
      }
    });

    return Array.from(teamMap.values())
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [teams, generations]);

  const dailyData = useMemo(() => {
    const days: { [key: string]: { date: string; count: number; revenue: number } } = {};
    
    // For 7 days show weekday, for 30 days show date
    for (let i = period - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const label = period === 7 
        ? d.toLocaleDateString("uk", { weekday: "short" })
        : d.toLocaleDateString("uk", { day: "numeric", month: "short" });
      days[key] = { date: label, count: 0, revenue: 0 };
    }

    generations.filter(g => g.status === "completed").forEach(g => {
      const key = g.created_at.split("T")[0];
      if (days[key]) {
        days[key].count++;
        days[key].revenue += g.sale_price || 0;
      }
    });

    return Object.values(days);
  }, [generations, period]);

  if (loading) return null;

  return (
    <div className="border border-border">
      <div className="p-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Дашборд за {period} днів</span>
        <div className="flex gap-1">
          <button
            onClick={() => setPeriod(7)}
            className={`px-2 py-0.5 text-[10px] rounded ${period === 7 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            7д
          </button>
          <button
            onClick={() => setPeriod(30)}
            className={`px-2 py-0.5 text-[10px] rounded ${period === 30 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            30д
          </button>
        </div>
      </div>
      <div className="p-3 space-y-3">
        {/* 5 Metrics */}
        <div className="grid grid-cols-5 gap-2">
          <div className="border border-border p-2 text-center">
            <Users className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
            <div className="text-lg font-bold">{metrics.totalTeams}</div>
            <div className="text-[10px] text-muted-foreground">Команд</div>
          </div>
          <div className="border border-border p-2 text-center">
            <Wallet className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
            <div className={`text-lg font-bold ${metrics.totalBalance < 0 ? "text-destructive" : ""}`}>
              ${metrics.totalBalance.toFixed(0)}
            </div>
            <div className="text-[10px] text-muted-foreground">Баланс</div>
          </div>
          <div className="border border-border p-2 text-center">
            <TrendingDown className="h-3.5 w-3.5 mx-auto text-destructive mb-1" />
            <div className="text-lg font-bold text-destructive">${metrics.totalDebt.toFixed(0)}</div>
            <div className="text-[10px] text-muted-foreground">Борг</div>
          </div>
          <div className="border border-border p-2 text-center">
            <FileCode2 className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
            <div className="text-lg font-bold">{metrics.totalGenerations}</div>
            <div className="text-[10px] text-muted-foreground">Сайтів</div>
          </div>
          <div className="border border-border p-2 text-center">
            <TrendingUp className="h-3.5 w-3.5 mx-auto text-green-500 mb-1" />
            <div className="text-lg font-bold text-green-600">${metrics.totalRevenue.toFixed(0)}</div>
            <div className="text-[10px] text-muted-foreground">Виручка</div>
          </div>
        </div>

        {/* 2 Charts */}
        <div className="grid grid-cols-2 gap-3">
          {/* Generations by team */}
          <div className="border border-border p-2">
            <div className="text-[10px] text-muted-foreground mb-1">Сайти по командах</div>
            {gensByTeam.length > 0 ? (
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={gensByTeam} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9 }} />
                  <Tooltip 
                    formatter={(value: number) => [value, "Сайтів"]}
                    contentStyle={{ fontSize: 10 }}
                  />
                  <Bar dataKey="count" radius={2}>
                    {gensByTeam.map((_, i) => (
                      <Cell key={i} fill={`hsl(var(--primary))`} fillOpacity={0.8 - i * 0.1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[80px] flex items-center justify-center text-xs text-muted-foreground">
                Немає даних
              </div>
            )}
          </div>

          {/* Daily trend */}
          <div className="border border-border p-2">
            <div className="text-[10px] text-muted-foreground mb-1">Генерації по дням</div>
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={dailyData}>
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: period === 30 ? 6 : 8 }} 
                  interval={period === 30 ? 4 : 0}
                />
                <YAxis hide />
                <Tooltip 
                  formatter={(value: number, name: string) => [value, name === "count" ? "Сайтів" : "$"]}
                  contentStyle={{ fontSize: 10 }}
                />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={period === 7 ? { r: 2 } : false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
