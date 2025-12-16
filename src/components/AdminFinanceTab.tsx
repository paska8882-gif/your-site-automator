import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Loader2, Save, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

interface Team {
  id: string;
  name: string;
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch teams
      const { data: teamsData } = await supabase
        .from("teams")
        .select("id, name")
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
        html_price: editedValues.html_price ?? existingPricing?.html_price ?? 0,
        react_price: editedValues.react_price ?? existingPricing?.react_price ?? 0,
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

  const getPricingValue = (teamId: string, field: keyof TeamPricing): number => {
    if (editingPrices[teamId]?.[field] !== undefined) {
      return editingPrices[teamId][field] as number;
    }
    return (teamPricing[teamId]?.[field] as number) ?? 0;
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

      {/* Team Pricing Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Ціни для команд</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Команда</TableHead>
                <TableHead>HTML ціна ($)</TableHead>
                <TableHead>React ціна ($)</TableHead>
                <TableHead>Вартість Junior ($)</TableHead>
                <TableHead>Вартість Senior ($)</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={getPricingValue(team.id, "html_price")}
                      onChange={(e) => handlePricingChange(team.id, "html_price", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={getPricingValue(team.id, "react_price")}
                      onChange={(e) => handlePricingChange(team.id, "react_price", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={getPricingValue(team.id, "generation_cost_junior")}
                      onChange={(e) => handlePricingChange(team.id, "generation_cost_junior", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      className="w-24"
                      value={getPricingValue(team.id, "generation_cost_senior")}
                      onChange={(e) => handlePricingChange(team.id, "generation_cost_senior", e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => savePricing(team.id)}
                      disabled={savingPricing === team.id}
                    >
                      {savingPricing === team.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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