import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Users, 
  Wallet, 
  Calendar, 
  UserCog,
  TrendingUp,
  TrendingDown,
  Download,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Crown,
  Shield,
  ShoppingCart,
  Code,
  Clock,
  BarChart3,
  FileText
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  balance: number;
  credit_limit: number;
  created_at: string;
  created_by: string;
  assigned_admin_id: string | null;
}

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  display_name: string | null;
  email?: string;
}

interface Admin {
  user_id: string;
  display_name: string | null;
}

interface Generation {
  id: string;
  site_name: string | null;
  sale_price: number | null;
  generation_cost: number | null;
  created_at: string;
  status: string;
  website_type: string | null;
  ai_model: string | null;
  user_id: string | null;
  user_name?: string;
}

interface BalanceTransaction {
  id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string;
  created_at: string;
  admin_name?: string;
}

interface TeamPricing {
  html_price: number;
  react_price: number;
  generation_cost_junior: number;
  generation_cost_senior: number;
  external_price: number | null;
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  team_lead: Shield,
  buyer: ShoppingCart,
  tech_dev: Code
};

const roleLabels: Record<string, string> = {
  owner: "Власник",
  team_lead: "Тімлід",
  buyer: "Баєр",
  tech_dev: "Техдев"
};

const AdminTeamDetails = () => {
  const { teamId } = useParams<{ teamId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { toast } = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [pricing, setPricing] = useState<TeamPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savingCreditLimit, setSavingCreditLimit] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!adminLoading && !isAdmin) {
      navigate("/");
    }
  }, [user, authLoading, isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (teamId && isAdmin) {
      fetchAllData();
    }
  }, [teamId, isAdmin]);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchTeam(),
      fetchMembers(),
      fetchAdmins(),
      fetchGenerations(),
      fetchTransactions(),
      fetchPricing()
    ]);
    setLoading(false);
  };

  const fetchTeam = async () => {
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("id", teamId)
      .single();

    if (!error && data) {
      setTeam(data);
      setCreditLimitInput(data.credit_limit?.toString() || "0");
    }
  };

  const fetchMembers = async () => {
    const { data: membersData } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .order("role", { ascending: true });

    if (membersData) {
      const userIds = membersData.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setMembers(membersData.map(m => ({
        ...m,
        display_name: profileMap.get(m.user_id) || "Невідомий"
      })));
    }
  };

  const fetchAdmins = async () => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const adminUserIds = adminRoles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", adminUserIds);

      setAdmins(profiles?.map(p => ({ user_id: p.user_id, display_name: p.display_name })) || []);
    }
  };

  const fetchGenerations = async () => {
    const { data: membersData } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("status", "approved");

    if (!membersData || membersData.length === 0) {
      setGenerations([]);
      return;
    }

    const userIds = membersData.map(m => m.user_id);

    const { data: genData } = await supabase
      .from("generation_history")
      .select("*")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    setGenerations((genData || []).map(g => ({
      ...g,
      user_name: profileMap.get(g.user_id || "") || "Невідомий"
    })));
  };

  const fetchTransactions = async () => {
    const { data: txData } = await supabase
      .from("balance_transactions")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (txData) {
      const adminIds = [...new Set(txData.map(t => t.admin_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", adminIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

      setTransactions(txData.map(t => ({
        ...t,
        admin_name: profileMap.get(t.admin_id) || "Невідомий"
      })));
    }
  };

  const fetchPricing = async () => {
    const { data } = await supabase
      .from("team_pricing")
      .select("*")
      .eq("team_id", teamId)
      .maybeSingle();

    setPricing(data);
  };

  const handleAssignAdmin = async (adminId: string | null) => {
    const { error } = await supabase
      .from("teams")
      .update({ assigned_admin_id: adminId === "none" ? null : adminId })
      .eq("id", teamId);

    if (error) {
      toast({ title: "Помилка", description: "Не вдалося призначити адміністратора", variant: "destructive" });
    } else {
      toast({ title: "Збережено", description: "Адміністратора призначено" });
      fetchTeam();
    }
  };

  const handleUpdateCreditLimit = async () => {
    const newLimit = parseFloat(creditLimitInput) || 0;
    setSavingCreditLimit(true);
    
    const { error } = await supabase
      .from("teams")
      .update({ credit_limit: newLimit })
      .eq("id", teamId);

    if (error) {
      toast({ title: "Помилка", description: "Не вдалося оновити ліміт", variant: "destructive" });
    } else {
      toast({ title: "Збережено", description: `Ліміт кредиту: $${newLimit}` });
      fetchTeam();
    }
    setSavingCreditLimit(false);
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Скопійовано" });
  };

  // Stats
  const totalSales = generations.reduce((sum, g) => sum + (g.sale_price || 0), 0);
  const totalCosts = generations.reduce((sum, g) => sum + (g.generation_cost || 0), 0);
  const completedCount = generations.filter(g => g.status === "completed").length;
  const failedCount = generations.filter(g => g.status === "failed").length;

  // Members by role
  const membersByRole = members.reduce((acc, m) => {
    if (!acc[m.role]) acc[m.role] = [];
    acc[m.role].push(m);
    return acc;
  }, {} as Record<string, TeamMember[]>);

  if (authLoading || adminLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!team) {
    return (
      <AppLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate("/admin?tab=teams")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <p className="text-center text-muted-foreground mt-8">Команду не знайдено</p>
        </div>
      </AppLayout>
    );
  }

  const assignedAdmin = admins.find(a => a.user_id === team.assigned_admin_id);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin?tab=teams")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6" />
                {team.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Створено: {new Date(team.created_at).toLocaleDateString("uk-UA")}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Оновити
          </Button>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wallet className="h-4 w-4" />
                Баланс
              </div>
              <div className={`text-2xl font-bold ${team.balance < 0 ? "text-red-500" : "text-green-500"}`}>
                ${team.balance?.toFixed(2)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingUp className="h-4 w-4" />
                Продажі
              </div>
              <div className="text-2xl font-bold text-green-500">${totalSales.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <TrendingDown className="h-4 w-4" />
                Витрати AI
              </div>
              <div className="text-2xl font-bold text-orange-500">${totalCosts.toFixed(2)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Users className="h-4 w-4" />
                Учасників
              </div>
              <div className="text-2xl font-bold">{members.filter(m => m.status === "approved").length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Settings */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Налаштування команди
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Призначений адміністратор</label>
                <Select
                  value={team.assigned_admin_id || "none"}
                  onValueChange={handleAssignAdmin}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Не призначено" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не призначено</SelectItem>
                    {admins.map((admin) => (
                      <SelectItem key={admin.user_id} value={admin.user_id}>
                        {admin.display_name || admin.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ліміт кредиту ($)</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={creditLimitInput}
                    onChange={(e) => setCreditLimitInput(e.target.value)}
                    className="h-9"
                    min={0}
                    step={10}
                  />
                  <Button 
                    size="sm" 
                    className="h-9"
                    onClick={handleUpdateCreditLimit}
                    disabled={savingCreditLimit}
                  >
                    {savingCreditLimit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Зберегти"}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Поточний ліміт</label>
                <div className="h-9 flex items-center">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    ${team.credit_limit?.toFixed(2) || "0.00"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="members" className="text-xs">
              <Users className="h-4 w-4 mr-1" />
              Команда
            </TabsTrigger>
            <TabsTrigger value="generations" className="text-xs">
              <BarChart3 className="h-4 w-4 mr-1" />
              Генерації
            </TabsTrigger>
            <TabsTrigger value="transactions" className="text-xs">
              <Wallet className="h-4 w-4 mr-1" />
              Транзакції
            </TabsTrigger>
            <TabsTrigger value="pricing" className="text-xs">
              <FileText className="h-4 w-4 mr-1" />
              Тарифи
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="space-y-4">
            {["owner", "team_lead", "buyer", "tech_dev"].map((role) => {
              const roleMembers = membersByRole[role] || [];
              if (roleMembers.length === 0) return null;
              const RoleIcon = roleIcons[role] || Users;
              
              return (
                <Card key={role}>
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <RoleIcon className="h-4 w-4" />
                      {roleLabels[role] || role}
                      <Badge variant="secondary" className="text-xs">{roleMembers.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-3">
                    <div className="space-y-2">
                      {roleMembers.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-2 rounded border bg-muted/30">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{member.display_name}</span>
                            <Badge 
                              variant={member.status === "approved" ? "default" : member.status === "pending" ? "secondary" : "destructive"}
                              className="text-[10px]"
                            >
                              {member.status === "approved" ? "Активний" : member.status === "pending" ? "Очікує" : "Відхилено"}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(member.created_at).toLocaleDateString("uk-UA")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {members.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Немає учасників</p>
            )}
          </TabsContent>

          {/* Generations Tab */}
          <TabsContent value="generations">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Історія генерацій
                  </span>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="default">{completedCount} успішних</Badge>
                    <Badge variant="destructive">{failedCount} невдалих</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {generations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Немає генерацій</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Сайт</TableHead>
                        <TableHead className="text-xs">Користувач</TableHead>
                        <TableHead className="text-xs">Тип</TableHead>
                        <TableHead className="text-xs">Модель</TableHead>
                        <TableHead className="text-xs">Ціна</TableHead>
                        <TableHead className="text-xs">Витрати</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="text-xs">Дата</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {generations.slice(0, 50).map((gen) => (
                        <TableRow key={gen.id}>
                          <TableCell className="text-xs font-medium max-w-[150px] truncate">
                            {gen.site_name || "Без назви"}
                          </TableCell>
                          <TableCell className="text-xs">{gen.user_name}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">{gen.website_type}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{gen.ai_model}</TableCell>
                          <TableCell className="text-xs text-green-600 font-medium">
                            ${gen.sale_price?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell className="text-xs text-orange-600">
                            ${gen.generation_cost?.toFixed(2) || "0.00"}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {gen.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(gen.created_at).toLocaleDateString("uk-UA")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Історія транзакцій балансу
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">Немає транзакцій</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Дата</TableHead>
                        <TableHead className="text-xs">Сума</TableHead>
                        <TableHead className="text-xs">До</TableHead>
                        <TableHead className="text-xs">Після</TableHead>
                        <TableHead className="text-xs">Примітка</TableHead>
                        <TableHead className="text-xs">Адмін</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs">
                            {new Date(tx.created_at).toLocaleString("uk-UA")}
                          </TableCell>
                          <TableCell className={`text-xs font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-xs">${tx.balance_before.toFixed(2)}</TableCell>
                          <TableCell className="text-xs">${tx.balance_after.toFixed(2)}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{tx.note}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{tx.admin_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pricing Tab */}
          <TabsContent value="pricing">
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Тарифи команди
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {pricing ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">HTML ціна</div>
                      <div className="text-lg font-bold">${pricing.html_price.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">React ціна</div>
                      <div className="text-lg font-bold">${pricing.react_price.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Зовнішня ціна</div>
                      <div className="text-lg font-bold">${pricing.external_price?.toFixed(2) || "—"}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Витрати Junior AI</div>
                      <div className="text-lg font-bold">${pricing.generation_cost_junior.toFixed(2)}</div>
                    </div>
                    <div className="p-3 rounded border bg-muted/30">
                      <div className="text-xs text-muted-foreground mb-1">Витрати Senior AI</div>
                      <div className="text-lg font-bold">${pricing.generation_cost_senior.toFixed(2)}</div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">Тарифи не налаштовані (використовуються стандартні)</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminTeamDetails;
