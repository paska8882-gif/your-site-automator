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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Загальний дохід</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalSales.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Витрати на генерацію</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">${totalCosts.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Прибуток</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalProfit.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Pricing Configuration - Collapsible */}
      <Collapsible open={isPricingOpen} onOpenChange={setIsPricingOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Ціни для команд</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isPricingOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                    <span className="font-medium min-w-32">{team.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">HTML:</span>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground mr-1">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-16 h-8 text-sm"
                          value={getPricingValue(team.id, "html_price")}
                          onChange={(e) => handlePricingChange(team.id, "html_price", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">React:</span>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground mr-1">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-16 h-8 text-sm"
                          value={getPricingValue(team.id, "react_price")}
                          onChange={(e) => handlePricingChange(team.id, "react_price", e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => savePricing(team.id)}
                      disabled={savingPricing === team.id}
                    >
                      {savingPricing === team.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
                {teams.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Немає команд</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Team Balances - Collapsible */}
      <Collapsible open={isBalanceOpen} onOpenChange={setIsBalanceOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Баланси команд</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isBalanceOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                    <span className="font-medium min-w-32">{team.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Баланс:</span>
                      <span className={`font-bold ${team.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${team.balance.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-muted-foreground">Поповнити:</span>
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground mr-1">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          className="w-20 h-8 text-sm"
                          value={topUpAmounts[team.id] || ""}
                          onChange={(e) => setTopUpAmounts(prev => ({ ...prev, [team.id]: e.target.value }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="h-8"
                        onClick={() => topUpBalance(team.id)}
                        disabled={savingBalance === team.id || !topUpAmounts[team.id]}
                      >
                        {savingBalance === team.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
                {teams.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Немає команд</p>
                )}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Generations Finance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Фінансова історія генерацій</CardTitle>
          <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Фільтр по команді" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Всі команди</SelectItem>
              {[...new Set(generations.map(g => g.team_name).filter(Boolean))].map((teamName) => (
                <SelectItem key={teamName} value={teamName!}>
                  {teamName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сайт</TableHead>
                <TableHead>Команда</TableHead>
                <TableHead>Користувач</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>Вартість ($)</TableHead>
                <TableHead>Продано ($)</TableHead>
                <TableHead>Прибуток ($)</TableHead>
                <TableHead>Дата</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGenerations.map((gen) => {
                const profit = (gen.sale_price || 0) - (gen.generation_cost || 0);
                return (
                  <TableRow key={gen.id}>
                    <TableCell className="font-medium max-w-32 truncate">
                      {gen.site_name || "—"}
                    </TableCell>
                    <TableCell>{gen.team_name || "—"}</TableCell>
                    <TableCell>{gen.profile?.display_name || "—"}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        gen.website_type === 'react' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {gen.website_type?.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${
                        gen.ai_model === 'senior' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {gen.ai_model === 'senior' ? 'Senior' : 'Junior'}
                      </span>
                    </TableCell>
                    <TableCell className="text-red-600">
                      {gen.generation_cost ? `$${gen.generation_cost.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {gen.sale_price ? `$${gen.sale_price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className={profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {gen.sale_price || gen.generation_cost ? `$${profit.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(gen.created_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredGenerations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Немає даних
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}