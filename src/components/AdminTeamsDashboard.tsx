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
    <div className="border border-border h-full">
      <div className="p-1.5 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{period}д</span>
        <div className="flex gap-0.5">
          <button
            onClick={() => setPeriod(7)}
            className={`px-1.5 py-0.5 text-[9px] rounded ${period === 7 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            7
          </button>
          <button
            onClick={() => setPeriod(30)}
            className={`px-1.5 py-0.5 text-[9px] rounded ${period === 30 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            30
          </button>
        </div>
      </div>
      <div className="p-2 space-y-2">
        {/* 5 Metrics - vertical compact */}
        <div className="grid grid-cols-5 gap-1">
          <div className="text-center">
            <div className="text-sm font-bold">{metrics.totalTeams}</div>
            <div className="text-[8px] text-muted-foreground">Команд</div>
          </div>
          <div className="text-center">
            <div className={`text-sm font-bold ${metrics.totalBalance < 0 ? "text-destructive" : ""}`}>
              ${metrics.totalBalance.toFixed(0)}
            </div>
            <div className="text-[8px] text-muted-foreground">Баланс</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-destructive">${metrics.totalDebt.toFixed(0)}</div>
            <div className="text-[8px] text-muted-foreground">Борг</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold">{metrics.totalGenerations}</div>
            <div className="text-[8px] text-muted-foreground">Сайти</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-green-600">${metrics.totalRevenue.toFixed(0)}</div>
            <div className="text-[8px] text-muted-foreground">Дохід</div>
          </div>
        </div>

        {/* Chart - single compact */}
        <div className="border border-border p-1.5">
          <div className="text-[8px] text-muted-foreground mb-1">По дням</div>
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={dailyData}>
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 6 }} 
                interval={period === 30 ? 6 : 0}
              />
              <YAxis hide />
              <Tooltip 
                formatter={(value: number) => [value, "Сайтів"]}
                contentStyle={{ fontSize: 9 }}
              />
              <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Teams chart */}
        {gensByTeam.length > 0 && (
          <div className="border border-border p-1.5">
            <div className="text-[8px] text-muted-foreground mb-1">По командах</div>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={gensByTeam.slice(0, 4)} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={50} tick={{ fontSize: 7 }} />
                <Tooltip 
                  formatter={(value: number) => [value, "Сайтів"]}
                  contentStyle={{ fontSize: 9 }}
                />
                <Bar dataKey="count" radius={1} fill="hsl(var(--primary))" fillOpacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
