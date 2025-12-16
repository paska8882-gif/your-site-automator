import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, Save, DollarSign, TrendingUp, TrendingDown, ChevronDown, Settings, Wallet, Plus } from "lucide-react";
import { toast } from "sonner";

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
  generation_cost_junior: number;
  generation_cost_senior: number;
}

interface GenerationWithFinance {
  id: string;
  site_name: string;
  website_type: string;
  ai_model: string;
  status: string;
  created_at: string;
  sale_price: number | null;
  generation_cost: number | null;
  user_id: string;
  profile?: { display_name: string | null };
  team_name?: string;
}

export function AdminFinanceTab() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPricing, setTeamPricing] = useState<Record<string, TeamPricing>>({});
  const [generations, setGenerations] = useState<GenerationWithFinance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPricing, setSavingPricing] = useState<string | null>(null);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
  const [editingPrices, setEditingPrices] = useState<Record<string, Partial<TeamPricing>>>({});
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isBalanceOpen, setIsBalanceOpen] = useState(false);
  const [topUpAmounts, setTopUpAmounts] = useState<Record<string, string>>({});
  const [savingBalance, setSavingBalance] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name, balance")
        .order("name");

      // Fetch team pricing
      const { data: pricingData } = await supabase
        .from("team_pricing")
        .select("*");

      // Fetch generations with profiles
      const { data: generationsData } = await supabase
        .from("generation_history")
        .select(`
          id, site_name, website_type, ai_model, status, created_at, 
          sale_price, generation_cost, user_id
        `)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      // Fetch profiles for user names
      const userIds = [...new Set(generationsData?.map(g => g.user_id).filter(Boolean) || [])];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      // Fetch team memberships
      const { data: membershipsData } = await supabase
        .from("team_members")
        .select("user_id, team_id")
        .eq("status", "approved")
        .in("user_id", userIds);

      setTeams(teamsData || []);

      // Map pricing by team_id
      const pricingMap: Record<string, TeamPricing> = {};
      pricingData?.forEach(p => {
        pricingMap[p.team_id] = p;
      });
      setTeamPricing(pricingMap);

      // Map profiles by user_id
      const profilesMap: Record<string, { display_name: string | null }> = {};
      profilesData?.forEach(p => {
        profilesMap[p.user_id] = { display_name: p.display_name };
      });

      // Map user to team
      const userTeamMap: Record<string, string> = {};
      membershipsData?.forEach(m => {
        const team = teamsData?.find(t => t.id === m.team_id);
        if (team) userTeamMap[m.user_id] = team.name;
      });

      // Enrich generations
      const enrichedGenerations = generationsData?.map(g => ({
        ...g,
        profile: g.user_id ? profilesMap[g.user_id] : undefined,
        team_name: g.user_id ? userTeamMap[g.user_id] : undefined,
      })) || [];

      setGenerations(enrichedGenerations);
    } catch (error) {
      console.error("Error fetching finance data:", error);
      toast.error("Помилка завантаження даних");
    } finally {
      setLoading(false);
    }
  };

  const handlePricingChange = (teamId: string, field: keyof TeamPricing, value: string) => {
    setEditingPrices(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [field]: parseFloat(value) || 0,
      },
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
        generation_cost_junior: editedValues.generation_cost_junior ?? existingPricing?.generation_cost_junior ?? 0.10,
        generation_cost_senior: editedValues.generation_cost_senior ?? existingPricing?.generation_cost_senior ?? 0.25,
      };

      if (existingPricing) {
        await supabase
          .from("team_pricing")
          .update(pricingData)
          .eq("team_id", teamId);
      } else {
        await supabase
          .from("team_pricing")
          .insert(pricingData);
      }

      toast.success("Ціни збережено");
      fetchData();
      setEditingPrices(prev => {
        const newPrices = { ...prev };
        delete newPrices[teamId];
        return newPrices;
      });
    } catch (error) {
      console.error("Error saving pricing:", error);
      toast.error("Помилка збереження цін");
    } finally {
      setSavingPricing(null);
    }
  };

  const topUpBalance = async (teamId: string) => {
    const amount = parseFloat(topUpAmounts[teamId] || "0");
    if (amount <= 0) {
      toast.error("Введіть суму більше 0");
      return;
    }

    setSavingBalance(teamId);
    try {
      const team = teams.find(t => t.id === teamId);
      const newBalance = (team?.balance || 0) + amount;

      await supabase
        .from("teams")
        .update({ balance: newBalance })
        .eq("id", teamId);

      toast.success(`Баланс поповнено на $${amount.toFixed(2)}`);
      setTopUpAmounts(prev => ({ ...prev, [teamId]: "" }));
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
    const defaults: Record<string, number> = {
      html_price: 7,
      react_price: 9,
      generation_cost_junior: 0.10,
      generation_cost_senior: 0.25,
    };
    return (teamPricing[teamId]?.[field] as number) ?? defaults[field] ?? 0;
  };

  const filteredGenerations = selectedTeamFilter === "all"
    ? generations
    : generations.filter(g => g.team_name === selectedTeamFilter);

  // Calculate totals
  const totalSales = filteredGenerations.reduce((sum, g) => sum + (g.sale_price || 0), 0);
  const totalCosts = filteredGenerations.reduce((sum, g) => sum + (g.generation_cost || 0), 0);
  const totalProfit = totalSales - totalCosts;

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
          <div className="space-y-1">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-1.5 p-1.5 rounded border bg-card">
                <span className="font-medium text-[10px] min-w-16 truncate">{team.name}</span>
                <span className="text-[10px] text-muted-foreground">H:</span>
                <Input type="number" step="0.01" className="w-10 h-5 text-[10px] px-1"
                  value={getPricingValue(team.id, "html_price")}
                  onChange={(e) => handlePricingChange(team.id, "html_price", e.target.value)} />
                <span className="text-[10px] text-muted-foreground">R:</span>
                <Input type="number" step="0.01" className="w-10 h-5 text-[10px] px-1"
                  value={getPricingValue(team.id, "react_price")}
                  onChange={(e) => handlePricingChange(team.id, "react_price", e.target.value)} />
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
          <div className="space-y-1">
            {teams.map((team) => (
              <div key={team.id} className="flex items-center gap-1.5 p-1.5 rounded border bg-card">
                <span className="font-medium text-[10px] min-w-16 truncate">{team.name}</span>
                <span className={`font-bold text-[10px] ${team.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${team.balance.toFixed(2)}
                </span>
                <div className="flex items-center gap-0.5 ml-auto">
                  <Input type="number" step="0.01" min="0" placeholder="$" className="w-12 h-5 text-[10px] px-1"
                    value={topUpAmounts[team.id] || ""}
                    onChange={(e) => setTopUpAmounts(prev => ({ ...prev, [team.id]: e.target.value }))} />
                  <Button size="sm" variant="default" className="h-5 w-5 p-0"
                    onClick={() => topUpBalance(team.id)} disabled={savingBalance === team.id || !topUpAmounts[team.id]}>
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
        <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-medium">Історія генерацій</CardTitle>
          <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
            <SelectTrigger className="w-28 h-6 text-xs">
              <SelectValue placeholder="Команда" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Всі</SelectItem>
              {[...new Set(generations.map(g => g.team_name).filter(Boolean))].map((teamName) => (
                <SelectItem key={teamName} value={teamName!} className="text-xs">{teamName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                <TableHead className="text-[10px] py-1">Витр</TableHead>
                <TableHead className="text-[10px] py-1">Прод</TableHead>
                <TableHead className="text-[10px] py-1">Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGenerations.slice(0, 20).map((gen) => (
                <TableRow key={gen.id}>
                  <TableCell className="text-[10px] py-1 max-w-20 truncate">{gen.site_name || "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.team_name || "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.profile?.display_name || "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.website_type?.toUpperCase()}</TableCell>
                  <TableCell className="text-[10px] py-1">{gen.ai_model === 'senior' ? 'Sr' : 'Jr'}</TableCell>
                  <TableCell className="text-[10px] py-1 text-red-600">{gen.generation_cost ? `$${gen.generation_cost.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-[10px] py-1 text-green-600">{gen.sale_price ? `$${gen.sale_price.toFixed(2)}` : "—"}</TableCell>
                  <TableCell className="text-[10px] py-1">{new Date(gen.created_at).toLocaleDateString("uk-UA")}</TableCell>
                </TableRow>
              ))}
              {filteredGenerations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-4 text-xs">Немає даних</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}