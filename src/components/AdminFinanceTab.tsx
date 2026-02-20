import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { AdminPageHeader } from "@/components/AdminPageHeader";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Save, DollarSign, TrendingUp, TrendingDown, Settings, Wallet, Plus, Minus, Eye, BarChart3, Receipt, ExternalLink, CalendarIcon, X, Filter } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { uk } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

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
  php_price: number;
  external_price: number;
  manual_price: number;
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
  total_generation_cost: number | null;
  user_id: string;
  profile?: { display_name: string | null };
  team_name?: string;
}

interface TeamTransaction {
  id: string;
  site_name: string | null;
  sale_price: number | null;
  generation_cost: number | null;
  total_generation_cost: number | null;
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
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPricing, setTeamPricing] = useState<Record<string, TeamPricing>>({});
  const [generations, setGenerations] = useState<GenerationWithFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState<string | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [selectedAiFilter, setSelectedAiFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  
  // Date filter with presets
  type DatePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [dateFromFilter, setDateFromFilter] = useState<Date | undefined>(undefined);
  const [dateToFilter, setDateToFilter] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;
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
  const [bulkPrices, setBulkPrices] = useState({ html: "", react: "", php: "", external: "", manual: "" });
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

      const enrichedGenerations: GenerationWithFinance[] = generationsData?.map(g => ({
        ...g,
        profile: g.user_id ? profilesMap[g.user_id] : undefined,
        team_name: g.team_id ? teamIdToName[g.team_id] : undefined,
        total_generation_cost: (g as any).total_generation_cost ?? null,
      })) || [];

      setGenerations(enrichedGenerations);
    } catch (error) {
      console.error("Error fetching finance data:", error);
      toast.error(t("admin.financeLoadError"));
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

    const enrichedBalanceTx = (balanceTxData || []).map(balanceTx => ({
      ...balanceTx,
      admin_display_name: adminProfileMap.get(balanceTx.admin_id) || t("admin.financeAdminFallback")
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
      total_generation_cost: (g as any).total_generation_cost ?? null,
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
        php_price: editedValues.php_price ?? existingPricing?.php_price ?? 0,
        external_price: editedValues.external_price ?? existingPricing?.external_price ?? 7,
        manual_price: editedValues.manual_price ?? existingPricing?.manual_price ?? 0,
        generation_cost_junior: editedValues.generation_cost_junior ?? existingPricing?.generation_cost_junior ?? 0.10,
        generation_cost_senior: editedValues.generation_cost_senior ?? existingPricing?.generation_cost_senior ?? 0.25,
      };

      if (existingPricing) {
        await supabase.from("team_pricing").update(pricingData).eq("team_id", teamId);
      } else {
        await supabase.from("team_pricing").insert(pricingData);
      }

      toast.success(t("admin.financePricesSaved"));
      fetchData();
      setEditingPrices(prev => { const newPrices = { ...prev }; delete newPrices[teamId]; return newPrices; });
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast.error(t("admin.financePricesSaveError"));
    } finally {
      setSavingPricing(null);
    }
  };

  const saveBulkPricing = async () => {
    const htmlPrice = bulkPrices.html ? parseFloat(bulkPrices.html) : null;
    const reactPrice = bulkPrices.react ? parseFloat(bulkPrices.react) : null;
    const phpPrice = bulkPrices.php ? parseFloat(bulkPrices.php) : null;
    const externalPrice = bulkPrices.external ? parseFloat(bulkPrices.external) : null;
    const manualPrice = bulkPrices.manual ? parseFloat(bulkPrices.manual) : null;

    if (htmlPrice === null && reactPrice === null && phpPrice === null && externalPrice === null && manualPrice === null) {
      toast.error(t("admin.financeEnterPrice"));
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
          php_price: phpPrice ?? existingPricing?.php_price ?? 0,
          external_price: externalPrice ?? existingPricing?.external_price ?? 7,
          manual_price: manualPrice ?? existingPricing?.manual_price ?? 0,
          generation_cost_junior: existingPricing?.generation_cost_junior ?? 0.10,
          generation_cost_senior: existingPricing?.generation_cost_senior ?? 0.25,
        };

        if (existingPricing) {
          await supabase.from("team_pricing").update(pricingData).eq("team_id", team.id);
        } else {
          await supabase.from("team_pricing").insert(pricingData);
        }
      }

      toast.success(t("admin.financeBulkPricesUpdated").replace("{count}", teams.length.toString()));
      setBulkPrices({ html: "", react: "", php: "", external: "", manual: "" });
      fetchData();
    } catch (error) {
      console.error("Error saving bulk pricing:", error);
      toast.error(t("admin.financeBulkPricesError"));
    } finally {
      setSavingBulk(false);
    }
  };

  const adjustBalance = async (teamId: string, direction: "add" | "subtract") => {
    const amount = parseFloat(topUpAmounts[teamId] || "0");
    const note = topUpNotes[teamId]?.trim() || "";
    
    if (amount <= 0) {
      toast.error(t("admin.financeEnterAmountGreater"));
      return;
    }

    if (!note) {
      toast.error(t("admin.financeEnterNote"));
      return;
    }

    if (!user) {
      toast.error(t("admin.financeAuthError"));
      return;
    }

    const actualAmount = direction === "subtract" ? -amount : amount;

    setSavingBalance(teamId);
    try {
      const team = teams.find(t => t.id === teamId);
      const balanceBefore = team?.balance || 0;
      const newBalance = balanceBefore + actualAmount;

      const { error: txError } = await supabase.from("balance_transactions").insert({
        team_id: teamId,
        amount: actualAmount,
        balance_before: balanceBefore,
        balance_after: newBalance,
        note: direction === "subtract" ? `[Списання] ${note}` : note,
        admin_id: user.id,
      });

      if (txError) throw txError;

      const { error: updateError } = await supabase.from("teams").update({ balance: newBalance }).eq("id", teamId);

      if (updateError) throw updateError;

      const msg = direction === "subtract" 
        ? `Списано $${amount.toFixed(2)}`
        : t("admin.financeBalanceTopUp").replace("{amount}", amount.toFixed(2));
      toast.success(msg);
      setTopUpAmounts(prev => ({ ...prev, [teamId]: "" }));
      setTopUpNotes(prev => ({ ...prev, [teamId]: "" }));
      fetchData();
    } catch (error) {
      console.error("Error adjusting balance:", error);
      toast.error(t("admin.financeBalanceTopUpError"));
    } finally {
      setSavingBalance(null);
    }
  };

  const getPricingValue = (teamId: string, field: keyof TeamPricing): number => {
    if (editingPrices[teamId]?.[field] !== undefined) {
      return editingPrices[teamId][field] as number;
    }
    const defaults: Record<string, number> = { html_price: 7, react_price: 9, php_price: 0, external_price: 7, manual_price: 0, generation_cost_junior: 0.10, generation_cost_senior: 0.25 };
    return (teamPricing[teamId]?.[field] as number) ?? defaults[field] ?? 0;
  };

  const filteredGenerations = useMemo(() => {
    return generations.filter(g => {
      if (selectedTeamFilter !== "all" && g.team_name !== selectedTeamFilter) return false;
      if (selectedUserFilter !== "all" && g.profile?.display_name !== selectedUserFilter) return false;
      if (selectedTypeFilter !== "all" && g.website_type !== selectedTypeFilter) return false;
      if (selectedAiFilter !== "all" && g.ai_model !== selectedAiFilter) return false;
      
      // Date filter using presets
      if (datePreset !== "all") {
        const genDate = new Date(g.created_at);
        const now = new Date();
        
        let from: Date | undefined;
        let to: Date | undefined;
        
        switch (datePreset) {
          case "today":
            from = startOfDay(now);
            to = endOfDay(now);
            break;
          case "yesterday":
            const yesterday = subDays(now, 1);
            from = startOfDay(yesterday);
            to = endOfDay(yesterday);
            break;
          case "week":
            from = startOfWeek(now, { weekStartsOn: 1 });
            to = endOfWeek(now, { weekStartsOn: 1 });
            break;
          case "month":
            from = startOfMonth(now);
            to = endOfMonth(now);
            break;
          case "custom":
            from = dateFromFilter ? startOfDay(dateFromFilter) : undefined;
            to = dateToFilter ? endOfDay(dateToFilter) : undefined;
            break;
        }
        
        if (from && genDate < from) return false;
        if (to && genDate > to) return false;
      }
      
      return true;
    });
  }, [generations, selectedTeamFilter, selectedUserFilter, selectedTypeFilter, selectedAiFilter, datePreset, dateFromFilter, dateToFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTeamFilter, selectedUserFilter, selectedTypeFilter, selectedAiFilter, datePreset, dateFromFilter, dateToFilter]);

  const totalPages = Math.ceil(filteredGenerations.length / itemsPerPage);
  const paginatedGenerations = filteredGenerations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const uniqueUsers = useMemo(() => 
    [...new Set(generations.map(g => g.profile?.display_name).filter(Boolean))] as string[]
  , [generations]);

  const totalSales = filteredGenerations.reduce((sum, g) => sum + (g.sale_price || 0), 0);
  // Use total_generation_cost (accumulated across retries) for accurate cost tracking
  const totalCosts = filteredGenerations.reduce((sum, g) => sum + (g.total_generation_cost || g.generation_cost || 0), 0);
  const totalProfit = totalSales - totalCosts;
  const externalCount = filteredGenerations.filter(g => g.specific_ai_model === 'codex-external').length;
  const internalCount = filteredGenerations.filter(g => g.specific_ai_model !== 'codex-external').length;


  const teamTotalSales = teamTransactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
  const teamTotalCosts = teamTransactions.reduce((sum, t) => sum + (t.total_generation_cost || t.generation_cost || 0), 0);

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
      const teamName = g.team_name || t("admin.financeUnknownTeam");
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
      { name: t("admin.financeExternalModel"), cost: externalCost, count: externalCount, avgCost: externalCount > 0 ? externalCost / externalCount : 0 }
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
      <AdminPageHeader 
        icon={DollarSign} 
        title={t("admin.financeTitle")} 
        description={t("admin.financeDescription")} 
      />
      {/* Summary inline */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <DollarSign className="h-3 w-3 text-green-600" />
          <span className="text-xs text-muted-foreground">{t("admin.financeIncome")}:</span>
          <span className="text-sm font-bold text-green-600">${totalSales.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <TrendingDown className="h-3 w-3 text-red-600" />
          <span className="text-xs text-muted-foreground">{t("admin.financeExpenses")}:</span>
          <span className="text-sm font-bold text-red-600">${totalCosts.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <TrendingUp className="h-3 w-3" />
          <span className="text-xs text-muted-foreground">{t("admin.financeProfit")}:</span>
          <span className={`text-sm font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${totalProfit.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-amber-500/10 border-amber-500/30">
          <span className="text-xs text-amber-600">{t("admin.financeExternal")}:</span>
          <span className="text-sm font-bold text-amber-600">{externalCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">{t("admin.financeInternal")}:</span>
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
              <CardTitle className="text-xs font-medium">{t("admin.financeDailyDynamics")}</CardTitle>
            </div>
            <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as "7" | "14" | "30")}>
              <SelectTrigger className="w-20 h-5 text-[10px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7" className="text-xs">{t("admin.finance7Days")}</SelectItem>
                <SelectItem value="14" className="text-xs">{t("admin.finance14Days")}</SelectItem>
                <SelectItem value="30" className="text-xs">{t("admin.finance30Days")}</SelectItem>
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
                  <Bar dataKey="income" name={t("admin.financeIncome")} fill="#22c55e" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expenses" name={t("admin.financeExpenses")} fill="#ef4444" radius={[2, 2, 0, 0]} />
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
              <CardTitle className="text-xs font-medium">{t("admin.financeByTeams")}</CardTitle>
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
                  <Bar dataKey="income" name={t("admin.financeIncome")} fill="#22c55e" radius={[0, 2, 2, 0]} />
                  <Bar dataKey="expenses" name={t("admin.financeExpenses")} fill="#ef4444" radius={[0, 2, 2, 0]} />
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
              <CardTitle className="text-xs font-medium">{t("admin.financeAICostsByDay")}</CardTitle>
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
                  <Bar dataKey="external" name={t("admin.financeExternal")} fill="#f59e0b" radius={[2, 2, 0, 0]} />
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
              <CardTitle className="text-xs font-medium">{t("admin.financeByModels")}</CardTitle>
            </div>
            <Button
              size="sm"
              variant={detailedModelView ? "default" : "outline"}
              className="h-5 text-[10px] px-2"
              onClick={() => setDetailedModelView(!detailedModelView)}
            >
              {detailedModelView ? t("admin.financeDetailed") : t("admin.financeSimple")}
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
                      name === 'cost' ? `$${value.toFixed(4)}` : name === 'avgCost' ? `$${value.toFixed(4)}/${t("admin.financePerPiece")}` : value,
                      name === 'cost' ? t("admin.financeTotal") : name === 'count' ? t("admin.financeQuantity") : t("admin.financeAverage")
                    ]}
                  />
                  <Bar dataKey="cost" name={t("admin.financeTotal")} fill="#f59e0b" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`grid ${detailedModelView ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'} gap-2 mt-2 text-[10px]`}>
              {(detailedModelView ? aiCostsBySpecificModelData : aiCostsByModelData).map(m => (
                <div key={m.name} className="text-center p-1 rounded bg-muted/30">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-muted-foreground">{m.count} {t("admin.financePcs")} • ${m.cost.toFixed(4)}</div>
                  <div className="text-muted-foreground">~${m.avgCost.toFixed(4)}/{t("admin.financePcs")}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two column layout for pricing and balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Team Pricing */}
        <Card className="flex flex-col max-h-[420px]">
          <CardHeader className="py-3 px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">{t("admin.financeTeamPrices")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            {/* Header row with labels */}
            <div className="grid grid-cols-[1fr_repeat(5,48px)_32px] gap-1.5 items-center mb-2 pb-1.5 border-b border-border sticky top-0 bg-card z-10">
              <span className="text-xs font-medium text-muted-foreground">Команда</span>
              <span className="text-[10px] font-semibold text-center">HTML</span>
              <span className="text-[10px] font-semibold text-center">React</span>
              <span className="text-[10px] font-semibold text-center">PHP</span>
              <span className="text-[10px] font-semibold text-center text-amber-600">Зовн.</span>
              <span className="text-[10px] font-semibold text-center text-blue-600">Ручна</span>
              <span></span>
            </div>

            {/* Bulk pricing row */}
            <div className="grid grid-cols-[1fr_repeat(5,48px)_32px] gap-1.5 items-center py-1.5 mb-2 px-2 rounded-md border-2 border-dashed border-primary/30 bg-primary/5">
              <span className="text-xs font-semibold text-primary">{t("admin.financeAll")}</span>
              <Input type="number" step="0.01" placeholder="7" className="h-7 text-xs px-1.5 text-center"
                value={bulkPrices.html}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, html: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="9" className="h-7 text-xs px-1.5 text-center"
                value={bulkPrices.react}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, react: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="0" className="h-7 text-xs px-1.5 text-center"
                value={bulkPrices.php}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, php: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="7" className="h-7 text-xs px-1.5 text-center"
                value={bulkPrices.external}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, external: e.target.value }))} />
              <Input type="number" step="0.01" placeholder="0" className="h-7 text-xs px-1.5 text-center"
                value={bulkPrices.manual}
                onChange={(e) => setBulkPrices(prev => ({ ...prev, manual: e.target.value }))} />
              <Button size="sm" variant="default" className="h-7 px-2 text-xs"
                onClick={saveBulkPricing} disabled={savingBulk}>
                {savingBulk ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
              </Button>
            </div>
            
            <div className="space-y-1">
              {teams.map((team) => (
                <div key={team.id} className="grid grid-cols-[1fr_repeat(5,48px)_32px] gap-1.5 items-center py-1 hover:bg-muted/50 rounded-md px-1">
                  <span className="text-xs font-medium truncate">{team.name}</span>
                  <Input type="number" step="0.01" className="h-7 text-xs px-1.5 text-center"
                    value={getPricingValue(team.id, "html_price")}
                    onChange={(e) => handlePricingChange(team.id, "html_price", e.target.value)} />
                  <Input type="number" step="0.01" className="h-7 text-xs px-1.5 text-center"
                    value={getPricingValue(team.id, "react_price")}
                    onChange={(e) => handlePricingChange(team.id, "react_price", e.target.value)} />
                  <Input type="number" step="0.01" className="h-7 text-xs px-1.5 text-center"
                    value={getPricingValue(team.id, "php_price")}
                    onChange={(e) => handlePricingChange(team.id, "php_price", e.target.value)} />
                  <Input type="number" step="0.01" className="h-7 text-xs px-1.5 text-center"
                    value={getPricingValue(team.id, "external_price")}
                    onChange={(e) => handlePricingChange(team.id, "external_price", e.target.value)} />
                  <Input type="number" step="0.01" className="h-7 text-xs px-1.5 text-center"
                    value={getPricingValue(team.id, "manual_price")}
                    onChange={(e) => handlePricingChange(team.id, "manual_price", e.target.value)} />
                  <Button size="sm" variant="ghost" className="h-7 w-8 p-0"
                    onClick={() => savePricing(team.id)} disabled={savingPricing === team.id}>
                    {savingPricing === team.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Balances */}
        <Card className="flex flex-col max-h-[420px]">
          <CardHeader className="py-3 px-4 shrink-0">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">{t("admin.financeBalances")}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{team.name}</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${team.balance >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        ${team.balance.toFixed(2)}
                      </span>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleViewTeam(team)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" step="0.01" min="0" placeholder="Сума" 
                      className="w-20 h-8 text-xs"
                      value={topUpAmounts[team.id] || ""}
                      onChange={(e) => setTopUpAmounts(prev => ({ ...prev, [team.id]: e.target.value }))} />
                    <Input type="text" placeholder="Примітка (обов'язково)" 
                      className="flex-1 h-8 text-xs"
                      value={topUpNotes[team.id] || ""}
                      onChange={(e) => setTopUpNotes(prev => ({ ...prev, [team.id]: e.target.value }))} />
                    <Button size="sm" variant="default" className="h-8 w-8 p-0"
                      onClick={() => adjustBalance(team.id, "add")} 
                      disabled={savingBalance === team.id || !topUpAmounts[team.id] || !topUpNotes[team.id]?.trim()}
                      title="Поповнити">
                      {savingBalance === team.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 w-8 p-0"
                      onClick={() => adjustBalance(team.id, "subtract")} 
                      disabled={savingBalance === team.id || !topUpAmounts[team.id] || !topUpNotes[team.id]?.trim()}
                      title="Списати">
                      <Minus className="h-3.5 w-3.5" />
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
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-xs font-medium">{t("admin.financeGenerationHistory")}</CardTitle>
            <Badge variant="secondary" className="text-[10px]">
              {filteredGenerations.length}/{generations.length}
            </Badge>
          </div>
          
          {/* Filter Toggle Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Filters */}
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-1" />
              {t("admin.filters")}
              {(selectedTeamFilter !== "all" || selectedUserFilter !== "all" || selectedTypeFilter !== "all" || selectedAiFilter !== "all" || datePreset !== "all") && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                  !
                </Badge>
              )}
            </Button>

            {/* Clear Filters */}
            {(selectedTeamFilter !== "all" || selectedUserFilter !== "all" || selectedTypeFilter !== "all" || selectedAiFilter !== "all" || datePreset !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-destructive hover:text-destructive"
                onClick={() => {
                  setSelectedTeamFilter("all");
                  setSelectedUserFilter("all");
                  setSelectedTypeFilter("all");
                  setSelectedAiFilter("all");
                  setDatePreset("all");
                  setDateFromFilter(undefined);
                  setDateToFilter(undefined);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                {t("admin.clearFilters")}
              </Button>
            )}
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <Card className="p-4 mt-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* Team Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("admin.financeTeam")}</Label>
                  <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("admin.financeAllTeams")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.financeAllTeams")}</SelectItem>
                      {[...new Set(generations.map(g => g.team_name).filter(Boolean))].map((teamName) => (
                        <SelectItem key={teamName} value={teamName!}>{teamName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* User Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("admin.financeUser")}</Label>
                  <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("admin.financeAllUsers")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.financeAllUsers")}</SelectItem>
                      {uniqueUsers.map((userName) => (
                        <SelectItem key={userName} value={userName}>{userName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("admin.financeType")}</Label>
                  <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("admin.financeAllTypes")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.financeAllTypes")}</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="react">React</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* AI Model Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">AI</Label>
                  <Select value={selectedAiFilter} onValueChange={setSelectedAiFilter}>
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("admin.financeAllTypes")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.financeAllTypes")}</SelectItem>
                      <SelectItem value="junior">Jr</SelectItem>
                      <SelectItem value="senior">Sr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("admin.dateFilter")}</Label>
                  <Select 
                    value={datePreset} 
                    onValueChange={(v) => {
                      setDatePreset(v as DatePreset);
                      if (v !== "custom") {
                        setDateFromFilter(undefined);
                        setDateToFilter(undefined);
                      }
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder={t("admin.allDates")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("admin.allDates")}</SelectItem>
                      <SelectItem value="today">{t("admin.dateToday")}</SelectItem>
                      <SelectItem value="yesterday">{t("admin.dateYesterday")}</SelectItem>
                      <SelectItem value="week">{t("admin.dateWeek")}</SelectItem>
                      <SelectItem value="month">{t("admin.dateMonth")}</SelectItem>
                      <SelectItem value="custom">{t("admin.dateCustom")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Custom Date Range */}
              {datePreset === "custom" && (
                <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("admin.dateFrom")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 w-[180px] justify-start text-left font-normal",
                            !dateFromFilter && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFromFilter ? format(dateFromFilter, "dd.MM.yyyy") : t("admin.selectDate")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFromFilter}
                          onSelect={setDateFromFilter}
                          initialFocus
                          className="p-3 pointer-events-auto"
                          locale={uk}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("admin.dateTo")}</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 w-[180px] justify-start text-left font-normal",
                            !dateToFilter && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateToFilter ? format(dateToFilter, "dd.MM.yyyy") : t("admin.selectDate")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateToFilter}
                          onSelect={setDateToFilter}
                          initialFocus
                          className="p-3 pointer-events-auto"
                          locale={uk}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </Card>
          )}
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[11px] py-1.5">{t("admin.financeSite")}</TableHead>
                <TableHead className="text-[11px] py-1.5">{t("admin.financeTeam")}</TableHead>
                <TableHead className="text-[11px] py-1.5">{t("admin.financeUser")}</TableHead>
                <TableHead className="text-[11px] py-1.5">{t("admin.financeType")}</TableHead>
                <TableHead className="text-[11px] py-1.5">AI</TableHead>
                <TableHead className="text-[11px] py-1.5 text-right">{t("admin.financeCost")}</TableHead>
                <TableHead className="text-[11px] py-1.5 text-right">{t("admin.financeSale")}</TableHead>
                <TableHead className="text-[11px] py-1.5">{t("admin.financeDate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedGenerations.map((gen) => (
                <TableRow key={gen.id}>
                  <TableCell className="text-[11px] py-1 max-w-24 truncate">{gen.site_name || "—"}</TableCell>
                  <TableCell className="text-[11px] py-1">{gen.team_name || "—"}</TableCell>
                  <TableCell className="text-[11px] py-1">{gen.profile?.display_name || "—"}</TableCell>
                  <TableCell className="text-[11px] py-1">{gen.website_type?.toUpperCase()}</TableCell>
                  <TableCell className="text-[11px] py-1">{gen.ai_model === 'senior' ? 'Sr' : 'Jr'}</TableCell>
                  <TableCell className="text-[11px] py-1 text-right text-red-600" title={gen.total_generation_cost && gen.total_generation_cost !== gen.generation_cost ? `Останній: $${gen.generation_cost?.toFixed(2)}, Всього: $${gen.total_generation_cost?.toFixed(2)}` : undefined}>
                    {gen.total_generation_cost ? `$${gen.total_generation_cost.toFixed(2)}` : gen.generation_cost ? `$${gen.generation_cost.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-[11px] py-1 text-right text-green-600">
                    {gen.sale_price ? `$${gen.sale_price.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-[11px] py-1 text-muted-foreground">
                    {format(new Date(gen.created_at), "dd.MM.yy")}
                  </TableCell>
                </TableRow>
              ))}
              {paginatedGenerations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-4 text-[11px]">
                    {t("admin.noData")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {filteredGenerations.length > 0 && (
              <tfoot>
                <tr className="border-t bg-muted/50">
                  <td colSpan={5} className="text-[11px] py-1.5 px-3 font-medium">
                    {t("admin.financeTotal")}: {filteredGenerations.length}
                  </td>
                  <td className="text-[11px] py-1.5 px-3 text-right font-medium text-red-600">
                    ${totalCosts.toFixed(2)}
                  </td>
                  <td className="text-[11px] py-1.5 px-3 text-right font-medium text-green-600">
                    ${totalSales.toFixed(2)}
                  </td>
                  <td className="text-[11px] py-1.5 px-3 font-medium">
                    <span className={totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      =${totalProfit.toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </Table>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <span className="text-[10px] text-muted-foreground">
                {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredGenerations.length)} {t("admin.financeOf")} {filteredGenerations.length}
              </span>
              <Pagination>
                <PaginationContent className="gap-0.5">
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={cn("h-6 text-[10px] px-2", currentPage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="h-6 w-6 text-[10px] p-0"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={cn("h-6 text-[10px] px-2", currentPage === totalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
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
                <div className="text-[10px] text-muted-foreground">{t("admin.financeGenerations")}</div>
                <div className="text-sm font-medium">{teamTransactions.length}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">{t("admin.financeSales")}</div>
                <div className="text-sm font-medium text-green-600">${teamTotalSales.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">{t("admin.financeAICosts")}</div>
                <div className="text-sm font-medium text-red-600">${teamTotalCosts.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">{t("admin.financeDeposits")}</div>
                <div className="text-sm font-medium text-blue-600">{balanceTransactions.length}</div>
              </div>
            </div>

            {/* Balance Transactions (Deposits) */}
            {balanceTransactions.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  <Receipt className="h-3 w-3" />
                  {t("admin.financeDepositHistory")}
                </div>
                <div className="space-y-1 max-h-[150px] overflow-y-auto">
                  {balanceTransactions.map((tx) => (
                    <div key={tx.id} className="p-2 rounded border bg-blue-50 dark:bg-blue-950/30 text-xs flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-blue-600">+${tx.amount.toFixed(2)}</span>
                          <span className="text-muted-foreground text-[10px]">
                            ${tx.balance_before.toFixed(2)} → ${tx.balance_after.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          {tx.note.startsWith('http') ? (
                            <a 
                              href={tx.note} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              {t("admin.financeReceipt")}
                            </a>
                          ) : (
                            <span className="truncate">{tx.note}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-2">
                        <div className="text-[10px] text-muted-foreground">{tx.admin_display_name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("uk-UA")}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs font-medium mb-2">{t("admin.financeGenerationHistory")}</div>
            
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : teamTransactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">{t("admin.financeNoGenerations")}</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {teamTransactions.map((tx) => (
                  <div key={tx.id} className="p-2 rounded border bg-card text-xs flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{tx.site_name || t("admin.financeNoName")}</span>
                        <Badge variant={tx.status === "completed" ? "default" : tx.status === "failed" ? "destructive" : "secondary"} className="text-[9px] px-1 py-0">
                          {tx.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{tx.user_display_name}</span>
                        <span>•</span>
                        <span>{tx.website_type}</span>
                        <span>•</span>
                        <span>{tx.ai_model}</span>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="font-medium text-green-600">+${tx.sale_price?.toFixed(2) || "0.00"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("uk-UA")}
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