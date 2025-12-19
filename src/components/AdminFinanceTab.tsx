import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Save, DollarSign, TrendingUp, TrendingDown, Settings, Wallet, Plus, Eye, BarChart3, Receipt, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { uk } from "date-fns/locale";

interface Team {
  id: string;
  name: string;
  balance: number;
}

interface TeamPricing {
  id: string;
  team_id: string;
  html_price: number;
  react_price: number;
  external_price: number;
  generation_cost_junior: number;
  generation_cost_senior: number;
}

interface GenerationWithFinance {
  id: string;
  site_name: string;
  website_type: string;
  ai_model: string;
  specific_ai_model: string | null;
  status: string;
  created_at: string;
  sale_price: number | null;
  generation_cost: number | null;
  user_id: string;
  profile?: { display_name: string | null };
  team_name?: string;
}

interface TeamTransaction {
  id: string;
  site_name: string | null;
  sale_price: number | null;
  generation_cost: number | null;
  created_at: string;
  status: string;
  website_type: string | null;
  ai_model: string | null;
  user_display_name?: string;
}

interface BalanceTransaction {
  id: string;
  team_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string;
  admin_id: string;
  created_at: string;
  admin_display_name?: string;
}

export function AdminFinanceTab() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPricing, setTeamPricing] = useState<Record<string, TeamPricing>>({});
  const [generations, setGenerations] = useState<GenerationWithFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState<string | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedAiFilter, setSelectedAiFilter] = useState<string>("all");
  const [dateFromFilter, setDateFromFilter] = useState<string>("");
  const [dateToFilter, setDateToFilter] = useState<string>("");
  const [editingPrices, setEditingPrices] = useState<Record<string, Partial<TeamPricing>>>({});
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({});
  const [topUpNotes, setTopUpNotes] = useState<Record<string, string>>({});
  const [savingBalance, setSavingBalance] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamTransactions, setTeamTransactions] = useState<TeamTransaction[]>([]);
  const [balanceTransactions, setBalanceTransactions] = useState<BalanceTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [chartPeriod, setChartPeriod] = useState<"7" | "14" | "30">("7");
  const [detailedModelView, setDetailedModelView] = useState(false);
  const [bulkPrices, setBulkPrices] = useState({ html: "", react: "", external: "" });
  const [savingBulk, setSavingBulk] = useState(false);

  useEffect(() => {
    fetchData();

    // Realtime subscription for team balance updates
    const channel = supabase
      .channel("admin-finance-balance")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams" },
        (payload) => {
          setTeams(prev => prev.map(team =>
            team.id === payload.new.id
              ? { ...team, balance: payload.new.balance }
              : team
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name, balance")
        .order("name");

      const { data: pricingData } = await supabase
        .from("team_pricing")
        .select("*");

      const { data: generationsData } = await supabase
        .from("generation_history")
        .select(`id, site_name, website_type, ai_model, specific_ai_model, status, created_at, sale_price, generation_cost, user_id, team_id`)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      const userIds = [...new Set(generationsData?.map(g => g.user_id).filter(Boolean) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      setTeams(teamsData || []);

      const pricingMap: Record<string, TeamPricing> = {};
      pricingData?.forEach(p => { pricingMap[p.team_id] = p; });
      setTeamPricing(pricingMap);

      const profilesMap: Record<string, { display_name: string | null }> = {};
      profilesData?.forEach(p => { profilesMap[p.user_id] = { display_name: p.display_name }; });

      // Map team_id to team name directly from generations
      const teamIdToName: Record<string, string> = {};
      teamsData?.forEach(t => { teamIdToName[t.id] = t.name; });

      const enrichedGenerations = generationsData?.map(g => ({
        ...g,
        profile: g.user_id ? profilesMap[g.user_id] : undefined,
        team_name: g.team_id ? teamIdToName[g.team_id] : undefined,
      })) || [];

      setGenerations(enrichedGenerations);
    } catch (error) {
      console.error("Error fetching finance data:", error);
      toast.error("Помилка завантаження даних");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamTransactions = async (teamId: string) => {
    setLoadingTransactions(true);
    
    // Fetch balance transactions (deposits)
    const { data: balanceTxData } = await supabase
      .from("balance_transactions")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    // Fetch admin names for balance transactions
    const adminIds = [...new Set(balanceTxData?.map(t => t.admin_id).filter(Boolean) || [])];
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", adminIds);
    
    const adminProfileMap = new Map(adminProfiles?.map(p => [p.user_id, p.display_name]) || []);

    const enrichedBalanceTx = (balanceTxData || []).map(t => ({
      ...t,
      admin_display_name: adminProfileMap.get(t.admin_id) || "Адмін"
    }));
    setBalanceTransactions(enrichedBalanceTx);

    // Fetch generation transactions directly by team_id (not through team_members)
    // This ensures generations are shown for the correct team even if a user is in multiple teams
    const { data: gens } = await supabase
      .from("generation_history")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Get user IDs from generations to fetch their profiles
    const userIds = [...new Set(gens?.map(g => g.user_id).filter(Boolean) || [])];
    
    const { data: profiles } = userIds.length > 0 
      ? await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds)
      : { data: [] };

    const profileMap = new Map<string, string>(
      (profiles || []).map(p => [p.user_id, p.display_name || "Unknown"])
    );

    const transactions: TeamTransaction[] = (gens || []).map(g => ({
      id: g.id,
      site_name: g.site_name,
      sale_price: g.sale_price,
      generation_cost: g.generation_cost,
      created_at: g.created_at,
      status: g.status,
      website_type: g.website_type,
      ai_model: g.ai_model,
      user_display_name: profileMap.get(g.user_id || "") || "Unknown"
    }));

    setTeamTransactions(transactions);
    setLoadingTransactions(false);
  };

  const handleViewTeam = (team: Team) => {
    setSelectedTeam(team);
    fetchTeamTransactions(team.id);
  };

  const handlePricingChange = (teamId: string, field: keyof TeamPricing, value: string) => {
    setEditingPrices(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: parseFloat(value) || 0 },
    }));
  };

  const savePricing = async (teamId: string) => {
    setSavingPricing(teamId);
    try {
      const existingPricing = teamPricing[teamId];
      const editedValues = editingPrices[teamId] || {};
      
      const pricingData = {
        team_id: teamId,
        html_price: editedValues.html_price ?? existingPricing?.html_price ?? 7,
        react_price: editedValues.react_price ?? existingPricing?.react_price ?? 9,
        external_price: editedValues.external_price ?? existingPricing?.external_price ?? 7,
        generation_cost_junior: editedValues.generation_cost_junior ?? existingPricing?.generation_cost_junior ?? 0.10,
        generation_cost_senior: editedValues.generation_cost_senior ?? existingPricing?.generation_cost_senior ?? 0.25,
      };

      if (existingPricing) {
        await supabase.from("team_pricing").update(pricingData).eq("team_id", teamId);
      } else {
        await supabase.from("team_pricing").insert(pricingData);
      }

      toast.success("Ціни збережено");
      fetchData();
      setEditingPrices(prev => { const newPrices = { ...prev }; delete newPrices[teamId]; return newPrices; });
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast.error("Помилка збереження цін");
    } finally {
      setSavingPricing(null);
    }
  };

  const saveBulkPricing = async () => {
    const htmlPrice = bulkPrices.html ? parseFloat(bulkPrices.html) : null;
    const reactPrice = bulkPrices.react ? parseFloat(bulkPrices.react) : null;
    const externalPrice = bulkPrices.external ? parseFloat(bulkPrices.external) : null;

    if (htmlPrice === null && reactPrice === null && externalPrice === null) {
      toast.error("Введіть хоча б одну ціну");
      return;
    }

    setSavingBulk(true);
    try {
      for (const team of teams) {
        const existingPricing = teamPricing[team.id];
        const pricingData = {
          team_id: team.id,
          html_price: htmlPrice ?? existingPricing?.html_price ?? 7,
          react_price: reactPrice ?? existingPricing?.react_price ?? 9,
          external_price: externalPrice ?? existingPricing?.external_price ?? 7,
          generation_cost_junior: existingPricing?.generation_cost_junior ?? 0.10,
          generation_cost_senior: existingPricing?.generation_cost_senior ?? 0.25,
        };

        if (existingPricing) {
          await supabase.from("team_pricing").update(pricingData).eq("team_id", team.id);
        } else {
          await supabase.from("team_pricing").insert(pricingData);
        }
      }

      toast.success(`Ціни оновлено для ${teams.length} команд`);
      setBulkPrices({ html: "", react: "", external: "" });
      fetchData();
    } catch (error) {
      console.error("Error saving bulk pricing:", error);
      toast.error("Помилка масового оновлення цін");
    } finally {
      setSavingBulk(false);
    }
  };

  const topUpBalance = async (teamId: string) => {
    const amount = parseFloat(topUpAmounts[teamId] || "0");
    const note = topUpNotes[teamId]?.trim() || "";
    
    if (amount <= 0) {
      toast.error("Введіть суму більше 0");
      return;
    }

    if (!note) {
      toast.error("Введіть примітку (посилання на квитанцію)");
      return;
    }

    if (!user) {
      toast.error("Помилка авторизації");
      return;
    }

    setSavingBalance(teamId);
    try {
      const team = teams.find(t => t.id === teamId);
      const balanceBefore = team?.balance || 0;
      const newBalance = balanceBefore + amount;

      // Create balance transaction record
      const { error: txError } = await supabase.from("balance_transactions").insert({
        team_id: teamId,
        amount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        note,
        admin_id: user.id,
      });

      if (txError) throw txError;

      // Update team balance
      const { error: updateError } = await supabase.from("teams").update({ balance: newBalance }).eq("id", teamId);

      if (updateError) throw updateError;

      toast.success(`Баланс поповнено на $${amount.toFixed(2)}`);
      setTopUpAmounts(prev => ({ ...prev, [teamId]: "" }));
      setTopUpNotes(prev => ({ ...prev, [teamId]: "" }));
      fetchData();
    } catch (error) {
      console.error("Error topping up balance:", error);
      toast.error("Помилка поповнення балансу");
    } finally {
      setSavingBalance(null);
    }
  };

  const getPricingValue = (teamId: string, field: keyof TeamPricing): number => {
    if (editingPrices[teamId]?.[field] !== undefined) {
      return editingPrices[teamId][field] as number;
    }
    const defaults: Record<string, number> = { html_price: 7, react_price: 9, external_price: 7, generation_cost_junior: 0.10, generation_cost_senior: 0.25 };
    return (teamPricing[teamId]?.[field] as number) ?? defaults[field] ?? 0;
  };

  const filteredGenerations = useMemo(() => {
    return generations.filter(g => {
      if (selectedTeamFilter !== "all" && g.team_name !== selectedTeamFilter) return false;
      if (selectedUserFilter !== "all" && g.profile?.display_name !== selectedUserFilter) return false;
      if (selectedTypeFilter !== "all" && g.website_type !== selectedTypeFilter) return false;
      if (selectedAiFilter !== "all" && g.ai_model !== selectedAiFilter) return false;
      if (dateFromFilter) {
        const genDate = new Date(g.created_at);
        const fromDate = new Date(dateFromFilter);
        if (genDate < fromDate) return false;
      }
      if (dateToFilter) {
        const genDate = new Date(g.created_at);
        const toDate = new Date(dateToFilter);
        toDate.setHours(23, 59, 59, 999);
        if (genDate > toDate) return false;
      }
      return true;
    });
  }, [generations, selectedTeamFilter, selectedUserFilter, selectedTypeFilter, selectedAiFilter, dateFromFilter, dateToFilter]);

  const uniqueUsers = useMemo(() => 
    [...new Set(generations.map(g => g.profile?.display_name).filter(Boolean))] as string[]
  , [generations]);

  const totalSales = filteredGenerations.reduce((sum, g) => sum + (g.sale_price || 0), 0);
  const totalCosts = filteredGenerations.reduce((sum, g) => sum + (g.generation_cost || 0), 0);
  const totalProfit = totalSales - totalCosts;
  const externalCount = filteredGenerations.filter(g => g.specific_ai_model === 'codex-external').length;
  const internalCount = filteredGenerations.filter(g => g.specific_ai_model !== 'codex-external').length;

  const teamTotalSales = teamTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
  const teamTotalCosts = teamTransactions.reduce((sum, t) => sum + (t.generation_cost || 0), 0);

  // Chart data by date
  const chartData = useMemo(() => {
    const days = parseInt(chartPeriod);
    const now = new Date();
    const data: { date: string; income: number; expenses: number; profit: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const dayGens = filteredGenerations.filter(g => {
        const genDate = new Date(g.created_at);
        return genDate >= dayStart && genDate <= dayEnd;
      });
      
      const income = dayGens.reduce((sum, g) => sum + (g.sale_price || 0), 0);
      const expenses = dayGens.reduce((sum, g) => sum + (g.generation_cost || 0), 0);
      
      data.push({
        date: format(day, "dd.MM", { locale: uk }),
        income,
        expenses,
        profit: income - expenses
      });
    }
    
    return data;
  }, [filteredGenerations, chartPeriod]);

  // Chart data by team
  const teamChartData = useMemo(() => {
    const teamStats: Record<string, { name: string; income: number; expenses: number }> = {};
    
    filteredGenerations.forEach(g => {
      const teamName = g.team_name || "Невідома";
      if (!teamStats[teamName]) {
        teamStats[teamName] = { name: teamName, income: 0, expenses: 0 };
      }
      teamStats[teamName].income += g.sale_price || 0;
      teamStats[teamName].expenses += g.generation_cost || 0;
    });
    
    return Object.values(teamStats);
  }, [filteredGenerations]);

  // AI costs by day
  const aiCostsByDayData = useMemo(() => {
    const days = parseInt(chartPeriod);
    const now = new Date();
    const data: { date: string; junior: number; senior: number; external: number; total: number }[] = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const dayGens = filteredGenerations.filter(g => {
        const genDate = new Date(g.created_at);
        return genDate >= dayStart && genDate <= dayEnd;
      });
      
      const junior = dayGens.filter(g => g.ai_model === 'junior').reduce((sum, g) => sum + (g.generation_cost || 0), 0);
      const senior = dayGens.filter(g => g.ai_model === 'senior' && g.specific_ai_model !== 'codex-external').reduce((sum, g) => sum + (g.generation_cost || 0), 0);
      const external = dayGens.filter(g => g.specific_ai_model === 'codex-external').reduce((sum, g) => sum + (g.generation_cost || 0), 0);
      
      data.push({
        date: format(day, "dd.MM", { locale: uk }),
        junior,
        senior,
        external,
        total: junior + senior + external
      });
    }
    
    return data;
  }, [filteredGenerations, chartPeriod]);

  // AI costs by model summary (simple view)
  const aiCostsByModelData = useMemo(() => {
    const juniorCost = filteredGenerations.filter(g => g.ai_model === 'junior').reduce((sum, g) => sum + (g.generation_cost || 0), 0);
    const seniorCost = filteredGenerations.filter(g => g.ai_model === 'senior' && g.specific_ai_model !== 'codex-external').reduce((sum, g) => sum + (g.generation_cost || 0), 0);
    const externalCost = filteredGenerations.filter(g => g.specific_ai_model === 'codex-external').reduce((sum, g) => sum + (g.generation_cost || 0), 0);
    const juniorCount = filteredGenerations.filter(g => g.ai_model === 'junior').length;
    const seniorCount = filteredGenerations.filter(g => g.ai_model === 'senior' && g.specific_ai_model !== 'codex-external').length;
    const externalCount = filteredGenerations.filter(g => g.specific_ai_model === 'codex-external').length;
    
    return [
      { name: 'Junior AI', cost: juniorCost, count: juniorCount, avgCost: juniorCount > 0 ? juniorCost / juniorCount : 0 },
      { name: 'Senior AI', cost: seniorCost, count: seniorCount, avgCost: seniorCount > 0 ? seniorCost / seniorCount : 0 },
      { name: 'Зовнішня', cost: externalCost, count: externalCount, avgCost: externalCount > 0 ? externalCost / externalCount : 0 }
    ];
  }, [filteredGenerations]);

  // AI costs by specific model (detailed view)
  const aiCostsBySpecificModelData = useMemo(() => {
    const modelStats: Record<string, { cost: number; count: number }> = {};
    
    filteredGenerations.forEach(g => {
      const model = g.specific_ai_model || (g.ai_model === 'junior' ? 'gpt-4o' : 'gemini-2.5-pro');
      if (!modelStats[model]) {
        modelStats[model] = { cost: 0, count: 0 };
      }
      modelStats[model].cost += g.generation_cost || 0;
      modelStats[model].count += 1;
    });
    
    const modelLabels: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'google/gemini-2.5-pro': 'Gemini 2.5 Pro',
      'google/gemini-2.5-flash': 'Gemini 2.5 Flash',
    };
    
    return Object.entries(modelStats).map(([model, stats]) => ({
      name: modelLabels[model] || model,
      cost: stats.cost,
      count: stats.count,
      avgCost: stats.count > 0 ? stats.cost / stats.count : 0
    })).sort((a, b) => b.cost - a.cost);
  }, [filteredGenerations]);
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary inline */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <DollarSign className="h-3 w-3 text-green-600" />
          <span className="text-xs text-muted-foreground">Дохід:</span>
          <span className="text-sm font-bold text-green-600">${totalSales.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <TrendingDown className="h-3 w-3 text-red-600" />
          <span className="text-xs text-muted-foreground">Витрати:</span>
          <span className="text-sm font-bold text-red-600">${totalCosts.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs text-muted-foreground">Прибуток:</span>
          <span className={`text-sm font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${totalProfit.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-amber-500/10 border-amber-500/30">
          <span className="text-xs text-amber-600">Зовн:</span>
          <span className="text-sm font-bold text-amber-600">{externalCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">Внутр:</span>
          <span className="text-sm font-bold">{internalCount}</span>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Daily Chart */}
        <Card>
          <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">Динаміка по днях</CardTitle>
            </div>
            <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as "7" | "14" | "30")}>
              <SelectTrigger className="w-20 h-5 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" className="text-xs">7 днів</SelectItem>
                <SelectItem value="14" className="text-xs">14 днів</SelectItem>
                <SelectItem value="30" className="text-xs">30 днів</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="income" name="Дохід" fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expenses" name="Витрати" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Team Chart */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">По командах</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamChartData} layout="vertical" margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={60} />
                  <Tooltip 
                    contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, '']}
                  />
                  <Bar dataKey="income" name="Дохід" fill="#22c55e" radius={[0, 2, 2, 0]} />
                  <Bar dataKey="expenses" name="Витрати" fill="#ef4444" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* AI Costs by Day */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">Витрати AI по днях</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aiCostsByDayData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip 
                    contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, '']}
                  />
                  <Bar dataKey="junior" name="Junior AI" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="senior" name="Senior AI" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="external" name="Зовнішня" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* AI Costs by Model */}
        <Card>
          <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">Витрати по моделях</CardTitle>
            </div>
            <Button
              size="sm"
              variant={detailedModelView ? "default" : "outline"}
              className="h-5 text-[10px] px-2"
              onClick={() => setDetailedModelView(!detailedModelView)}
            >
              {detailedModelView ? "Детально" : "Простий"}
            </Button>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className={detailedModelView && aiCostsBySpecificModelData.length > 2 ? "h-40" : "h-32"}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={detailedModelView ? aiCostsBySpecificModelData : aiCostsByModelData} 
                  layout="vertical" 
                  margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
                >
                  <XAxis type="number" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={detailedModelView ? 100 : 60} />
                  <Tooltip 
                    contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                    formatter={(value: number, name: string) => [
                      name === 'cost' ? `$${value.toFixed(4)}` : name === 'avgCost' ? `$${value.toFixed(4)}/шт` : value,
                      name === 'cost' ? 'Загалом' : name === 'count' ? 'Кількість' : 'Середня'
                    ]}
                  />
                  <Bar dataKey="cost" name="Загалом" fill="#f59e0b" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`grid ${detailedModelView ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'} gap-2 mt-2 text-[10px]`}>
              {(detailedModelView ? aiCostsBySpecificModelData : aiCostsByModelData).map(m => (
                <div key={m.name} className="text-center p-1 rounded bg-muted/30">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-muted-foreground">{m.count} шт • ${m.cost.toFixed(4)}</div>
                  <div className="text-muted-foreground">~${m.avgCost.toFixed(4)}/шт</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two column layout for pricing and balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Team Pricing */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center gap-1.5">
              <Settings className="h-3 w-3 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">Ціни команд</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {/* Bulk pricing row */}
            <div className="flex items-center gap-1.5 p-1.5 mb-2 rounded border-2 border-dashed border-primary/30 bg-primary/5">
              <span className="font-medium text-[10px] min-w-14 text-primary">Всі:</span>
              <span className="text-[10px] text-muted-foreground">H:</span>
              <Input type="number" step="0.01" placeholder="7" className="w-10 h-5 text-[10px] px-1"
                value={bulkPrices.html}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, html: e.target.value }))} />
              <span className="text-[10px] text-muted-foreground">R:</span>
              <Input type="number" step="0.01" placeholder="9" className="w-10 h-5 text-[10px] px-1"
                value={bulkPrices.react}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, react: e.target.value }))} />
              <span className="text-[10px] text-amber-600">E:</span>
              <Input type="number" step="0.01" placeholder="7" className="w-10 h-5 text-[10px] px-1"
                value={bulkPrices.external}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, external: e.target.value }))} />
              <Button size="sm" variant="default" className="h-5 px-2 text-[10px] ml-auto"
                onClick={saveBulkPricing} disabled={savingBulk}>
                {savingBulk ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Застосувати"}
              </Button>
            </div>
            
            <div className="space-y-1">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center gap-1.5 p-1.5 rounded border bg-card">
                  <span className="font-medium text-[10px] min-w-14 truncate">{team.name}</span>
                  <span className="text-[10px] text-muted-foreground">H:</span>
                  <Input type="number" step="0.01" className="w-10 h-5 text-[10px] px-1"
                    value={getPricingValue(team.id, "html_price")}
                    onChange={(e) => handlePricingChange(team.id, "html_price", e.target.value)} />
                  <span className="text-[10px] text-muted-foreground">R:</span>
                  <Input type="number" step="0.01" className="w-10 h-5 text-[10px] px-1"
                    value={getPricingValue(team.id, "react_price")}
                    onChange={(e) => handlePricingChange(team.id, "react_price", e.target.value)} />
                  <span className="text-[10px] text-amber-600">E:</span>
                  <Input type="number" step="0.01" className="w-10 h-5 text-[10px] px-1"
                    value={getPricingValue(team.id, "external_price")}
                    onChange={(e) => handlePricingChange(team.id, "external_price", e.target.value)} />
                  <Button size="sm" variant="ghost" className="h-5 w-5 p-0 ml-auto"
                    onClick={() => savePricing(team.id)} disabled={savingPricing === team.id}>
                    {savingPricing === team.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Save className="h-2.5 w-2.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Balances */}
        <Card>
          <CardHeader className="py-2 px-3">
            <div className="flex items-center gap-1.5">
              <Wallet className="h-3 w-3 text-muted-foreground" />
              <CardTitle className="text-xs font-medium">Баланси</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="p-2 rounded border bg-card space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[10px] truncate flex-1">{team.name}</span>
                    <span className={`font-bold text-[10px] ${team.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${team.balance.toFixed(2)}
                    </span>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => handleViewTeam(team)}>
                      <Eye className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      placeholder="Сума $" 
                      className="w-16 h-5 text-[10px] px-1"
                      value={topUpAmounts[team.id] || ""}
                      onChange={(e) => setTopUpAmounts(prev => ({ ...prev, [team.id]: e.target.value }))} 
                    />
                    <Input 
                      type="text" 
                      placeholder="Посилання на квитанцію *" 
                      className="flex-1 h-5 text-[10px] px-1"
                      value={topUpNotes[team.id] || ""}
                      onChange={(e) => setTopUpNotes(prev => ({ ...prev, [team.id]: e.target.value }))} 
                    />
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="h-5 px-2 text-[10px]"
                      onClick={() => topUpBalance(team.id)} 
                      disabled={savingBalance === team.id || !topUpAmounts[team.id] || !topUpNotes[team.id]?.trim()}
                    >
                      {savingBalance === team.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Plus className="h-2.5 w-2.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generations Finance Table */}
      <Card>
        <CardHeader className="py-2 px-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xs font-medium">Історія генерацій</CardTitle>
            <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
              <SelectTrigger className="w-24 h-6 text-[10px]">
                <SelectValue placeholder="Команда" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Всі команди</SelectItem>
                {[...new Set(generations.map(g => g.team_name).filter(Boolean))].map((teamName) => (
                  <SelectItem key={teamName} value={teamName!} className="text-xs">{teamName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
              <SelectTrigger className="w-24 h-6 text-[10px]">
                <SelectValue placeholder="Юзер" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Всі юзери</SelectItem>
                {uniqueUsers.map((userName) => (
                  <SelectItem key={userName} value={userName} className="text-xs">{userName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
              <SelectTrigger className="w-20 h-6 text-[10px]">
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Всі типи</SelectItem>
                <SelectItem value="html" className="text-xs">HTML</SelectItem>
                <SelectItem value="react" className="text-xs">React</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedAiFilter} onValueChange={setSelectedAiFilter}>
              <SelectTrigger className="w-20 h-6 text-[10px]">
                <SelectValue placeholder="AI" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Всі AI</SelectItem>
                <SelectItem value="junior" className="text-xs">Junior</SelectItem>
                <SelectItem value="senior" className="text-xs">Senior</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">З:</span>
              <Input 
                type="date" 
                className="w-28 h-6 text-[10px] px-1" 
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground">По:</span>
              <Input 
                type="date" 
                className="w-28 h-6 text-[10px] px-1" 
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
              />
            </div>
            {(selectedTeamFilter !== "all" || selectedUserFilter !== "all" || selectedTypeFilter !== "all" || selectedAiFilter !== "all" || dateFromFilter || dateToFilter) && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] px-2"
                onClick={() => {
                  setSelectedTeamFilter("all");
                  setSelectedUserFilter("all");
                  setSelectedTypeFilter("all");
                  setSelectedAiFilter("all");
                  setDateFromFilter("");
                  setDateToFilter("");
                }}
              >
                Скинути
              </Button>
            )}
            <Badge variant="outline" className="text-[10px] ml-auto">
              {filteredGenerations.length} з {generations.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] py-1">Сайт</TableHead>
                <TableHead className="text-[10px] py-1">Команда</TableHead>
                <TableHead className="text-[10px] py-1">Юзер</TableHead>
                <TableHead className="text-[10px] py-1">Тип</TableHead>
                <TableHead className="text-[10px] py-1">AI</TableHead>
                <TableHead className="text-[10px] py-1 text-right">Витр</TableHead>
                <TableHead className="text-[10px] py-1 text-right">Прод</TableHead>
                <TableHead className="text-[10px] py-1">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGenerations.slice(0, 50).map((gen) => (
                <TableRow key={gen.id}>
                  <TableCell className="text-[10px] py-1 max-w-20 truncate">{gen.site_name || "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.team_name || "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.profile?.display_name || "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.website_type?.toUpperCase()}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.ai_model === 'senior' ? 'Sr' : 'Jr'}</TableCell>
                  <TableCell className="text-[10px] py-1 text-right text-red-600">{gen.generation_cost ? `$${gen.generation_cost.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-[10px] py-1 text-right text-green-600">{gen.sale_price ? `$${gen.sale_price.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{new Date(gen.created_at).toLocaleDateString("uk-UA")}</TableCell>
                </TableRow>
              ))}
              {filteredGenerations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4 text-xs">Немає даних</TableCell>
                </TableRow>
              )}
            </TableBody>
            {filteredGenerations.length > 0 && (
              <tfoot>
                <tr className="border-t-2 bg-muted/50">
                  <td colSpan={5} className="text-[10px] py-1.5 px-3 font-bold">
                    ВСЬОГО ({filteredGenerations.length} генерацій)
                  </td>
                  <td className="text-[10px] py-1.5 px-3 text-right font-bold text-red-600">
                    ${totalCosts.toFixed(2)}
                  </td>
                  <td className="text-[10px] py-1.5 px-3 text-right font-bold text-green-600">
                    ${totalSales.toFixed(2)}
                  </td>
                  <td className="text-[10px] py-1.5 px-3 font-bold">
                    <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      =${totalProfit.toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </Table>
        </CardContent>
      </Card>

      {/* Team Detail Dialog */}
      <Dialog open={!!selectedTeam} onOpenChange={(open) => !open && setSelectedTeam(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              {selectedTeam?.name}
              <Badge variant="outline" className="text-xs">
                <Wallet className="h-3 w-3 mr-1" />
                ${selectedTeam?.balance?.toFixed(2) || "0.00"}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Генерацій</div>
                <div className="text-sm font-medium">{teamTransactions.length}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Продажі</div>
                <div className="text-sm font-medium text-green-600">${teamTotalSales.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Витрати AI</div>
                <div className="text-sm font-medium text-red-600">${teamTotalCosts.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Поповнень</div>
                <div className="text-sm font-medium text-blue-600">{balanceTransactions.length}</div>
              </div>
            </div>

            {/* Balance Transactions (Deposits) */}
            {balanceTransactions.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  <Receipt className="h-3 w-3" />
                  Історія поповнень
                </div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {balanceTransactions.map((t) => (
                    <div key={t.id} className="p-2 rounded border bg-blue-50 dark:bg-blue-950/30 text-xs flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-blue-600">+${t.amount.toFixed(2)}</span>
                          <span className="text-muted-foreground text-[10px]">
                            ${t.balance_before.toFixed(2)} → ${t.balance_after.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {t.note.startsWith('http') ? (
                            <a 
                              href={t.note} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              Квитанція
                            </a>
                          ) : (
                            <span className="truncate">{t.note}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-[10px] text-muted-foreground">{t.admin_display_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(t.created_at).toLocaleDateString("uk-UA")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs font-medium mb-2">Історія генерацій</div>
            
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : teamTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">Немає генерацій</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {teamTransactions.map((t) => (
                  <div key={t.id} className="p-2 rounded border bg-card text-xs flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{t.site_name || "Без назви"}</span>
                        <Badge variant={t.status === "completed" ? "default" : t.status === "failed" ? "destructive" : "secondary"} className="text-[9px] px-1 py-0">
                          {t.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{t.user_display_name}</span>
                        <span>•</span>
                        <span>{t.website_type}</span>
                        <span>•</span>
                        <span>{t.ai_model}</span>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="font-medium text-green-600">+${t.sale_price?.toFixed(2) || "0.00"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("uk-UA")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}