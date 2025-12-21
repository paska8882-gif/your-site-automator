import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  Clock,
  MessageSquare,
  Eye,
  Image,
  Wallet,
  TrendingUp,
  TrendingDown,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Pencil,
  ExternalLink
} from "lucide-react";

interface Appeal {
  id: string;
  generation_id: string;
  user_id: string;
  team_id: string;
  reason: string;
  status: string;
  amount_to_refund: number;
  admin_comment: string | null;
  screenshot_url: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  // Joined data
  user_name?: string;
  team_name?: string;
  site_name?: string;
  prompt?: string;
  // Generation data for download
  zip_data?: string | null;
  website_type?: string | null;
  ai_model?: string | null;
  language?: string;
}

interface Team {
  id: string;
  name: string;
  balance: number;
}

interface BalanceTransaction {
  id: string;
  team_id: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string;
  created_at: string;
}

export function AdminAppealsTab() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Teams and balances
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  useEffect(() => {
    fetchAppeals();
    fetchTeams();
  }, []);

  // Fetch transactions when team is selected
  useEffect(() => {
    if (selectedTeamId) {
      fetchTransactions(selectedTeamId);
    } else {
      setTransactions([]);
    }
  }, [selectedTeamId]);

  // Real-time subscription for team balance updates
  useEffect(() => {
    const channel = supabase
      .channel('teams-balance-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'teams' },
        (payload) => {
          const updatedTeam = payload.new as Team;
          setTeams(prev => prev.map(t => 
            t.id === updatedTeam.id ? { ...t, balance: updatedTeam.balance } : t
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select("id, name, balance")
      .order("name");
    
    if (data) {
      setTeams(data);
    }
  };

  const fetchTransactions = async (teamId: string) => {
    setLoadingTransactions(true);
    const { data } = await supabase
      .from("balance_transactions")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (data) {
      setTransactions(data);
    }
    setLoadingTransactions(false);
  };

  const fetchAppeals = async () => {
    setLoading(true);

    // Fetch appeals
    const { data: appealsData, error } = await supabase
      .from("appeals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching appeals:", error);
      setLoading(false);
      return;
    }

    if (!appealsData || appealsData.length === 0) {
      setAppeals([]);
      setLoading(false);
      return;
    }

    // Get unique IDs for joins
    const userIds = [...new Set(appealsData.map(a => a.user_id))];
    const generationIds = [...new Set(appealsData.map(a => a.generation_id))];

    // Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    // Fetch generations with team_id and zip_data for download
    const { data: generations } = await supabase
      .from("generation_history")
      .select("id, site_name, prompt, team_id, zip_data, website_type, ai_model, language")
      .in("id", generationIds);

    // Get team IDs from generations (the actual team that paid for the site)
    const generationTeamIds = [...new Set(generations?.map(g => g.team_id).filter(Boolean) || [])];

    // Fetch teams based on generation team_ids
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", generationTeamIds);

    // Combine data - use team from generation_history, not from appeal
    const enrichedAppeals: Appeal[] = appealsData.map(appeal => {
      const generation = generations?.find(g => g.id === appeal.generation_id);
      const actualTeamId = generation?.team_id || appeal.team_id;
      return {
        ...appeal,
        team_id: actualTeamId, // Override with the actual team that paid
        user_name: profiles?.find(p => p.user_id === appeal.user_id)?.display_name || "Невідомий",
        team_name: teams?.find(t => t.id === actualTeamId)?.name || "Невідома команда",
        site_name: generation?.site_name || "Невідомий сайт",
        prompt: generation?.prompt,
        zip_data: generation?.zip_data,
        website_type: generation?.website_type,
        ai_model: generation?.ai_model,
        language: generation?.language
      };
    });

    setAppeals(enrichedAppeals);
    setLoading(false);
  };

  const handleResolve = async (approved: boolean) => {
    if (!selectedAppeal) return;
    
    setProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Update appeal status
      const { error: appealError } = await supabase
        .from("appeals")
        .update({
          status: approved ? "approved" : "rejected",
          admin_comment: adminComment || null,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id
        })
        .eq("id", selectedAppeal.id);

      if (appealError) throw appealError;

      // If approved, refund the amount to team balance
      if (approved && selectedAppeal.amount_to_refund > 0 && selectedAppeal.team_id) {
        // Get current team balance
        const { data: team, error: teamFetchError } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", selectedAppeal.team_id)
          .single();

        if (teamFetchError) {
          console.error("Error fetching team balance:", teamFetchError);
          throw new Error("Не вдалося отримати баланс команди");
        }

        if (team) {
          const balanceBefore = Number(team.balance || 0);
          const newBalance = balanceBefore + Number(selectedAppeal.amount_to_refund);
          
          const { error: balanceUpdateError } = await supabase
            .from("teams")
            .update({ balance: newBalance })
            .eq("id", selectedAppeal.team_id);

          if (balanceUpdateError) {
            console.error("Error updating team balance:", balanceUpdateError);
            throw new Error("Не вдалося оновити баланс команди");
          }

          // Log the transaction
          await supabase.from("balance_transactions").insert({
            team_id: selectedAppeal.team_id,
            amount: selectedAppeal.amount_to_refund,
            balance_before: balanceBefore,
            balance_after: newBalance,
            admin_id: user?.id,
            note: `Апеляція: повернення за ${selectedAppeal.site_name || "сайт"}`
          });

          // Update local teams state immediately
          setTeams(prev => prev.map(t => 
            t.id === selectedAppeal.team_id ? { ...t, balance: newBalance } : t
          ));

          // Refresh transactions if this team is selected
          if (selectedTeamId === selectedAppeal.team_id) {
            fetchTransactions(selectedAppeal.team_id);
          }
          
          console.log(`Refunded $${selectedAppeal.amount_to_refund} to team ${selectedAppeal.team_id}. New balance: $${newBalance}`);
        }
      }

      // Create notification for user about appeal resolution
      await supabase.from("notifications").insert({
        user_id: selectedAppeal.user_id,
        type: approved ? "appeal_approved" : "appeal_rejected",
        title: approved ? "Апеляцію схвалено" : "Апеляцію відхилено",
        message: approved 
          ? `Вашу апеляцію схвалено. Повернено $${selectedAppeal.amount_to_refund.toFixed(2)}`
          : `Вашу апеляцію відхилено${adminComment ? `: ${adminComment}` : ""}`,
        data: { appealId: selectedAppeal.id, approved, amount: approved ? selectedAppeal.amount_to_refund : 0 }
      });

      toast({
        title: "Успішно",
        description: approved 
          ? `Апеляцію схвалено. Повернено $${selectedAppeal.amount_to_refund.toFixed(2)}`
          : "Апеляцію відхилено"
      });

      setSelectedAppeal(null);
      setAdminComment("");
      fetchAppeals();
      fetchTeams(); // Refresh team balances
    } catch (error) {
      console.error("Error resolving appeal:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося обробити апеляцію",
        variant: "destructive"
      });
    }
    
    setProcessing(false);
  };

  // Download ZIP handler
  const handleDownload = (appeal: Appeal) => {
    if (!appeal.zip_data) {
      toast({
        title: "Помилка",
        description: "ZIP-файл недоступний",
        variant: "destructive",
      });
      return;
    }

    try {
      const byteCharacters = atob(appeal.zip_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });

      const siteName = appeal.site_name || "website";
      const lang = appeal.language?.toUpperCase() || "AUTO";
      const type = appeal.website_type?.toUpperCase() || "HTML";
      const aiLabel = appeal.ai_model === "senior" ? "Senior_AI" : "Junior_AI";
      const filename = `${siteName}-${lang}-${type}-${aiLabel}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Завантаження",
        description: "ZIP-архів завантажено",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити файл",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">Очікує</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">Схвалено</Badge>;
      case "rejected":
        return <Badge variant="destructive">Відхилено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = appeals.filter(a => a.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const selectedTeam = teams.find(t => t.id === selectedTeamId);
  const filteredAppeals = selectedTeamId 
    ? appeals.filter(a => a.team_id === selectedTeamId)
    : appeals;

  return (
    <div className="space-y-3">
      <AdminPageHeader 
        icon={MessageSquare} 
        title="Апеляції" 
        description="Розгляд скарг та повернення коштів" 
      />
      
      {/* Two column layout: Teams + Appeals */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Left: Team balances panel */}
        <div className="lg:col-span-1 space-y-3">
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Wallet className="h-3.5 w-3.5" />
                Баланси команд
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <ScrollArea className="h-[300px]">
                <div className="space-y-1">
                  <button
                    onClick={() => setSelectedTeamId(null)}
                    className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                      !selectedTeamId ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">Всі команди</span>
                    <span className="text-muted-foreground">{appeals.length}</span>
                  </button>
                  {teams.map(team => {
                    const teamAppealsCount = appeals.filter(a => a.team_id === team.id).length;
                    const pendingTeamAppeals = appeals.filter(a => a.team_id === team.id && a.status === "pending").length;
                    return (
                      <button
                        key={team.id}
                        onClick={() => setSelectedTeamId(team.id)}
                        className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                          selectedTeamId === team.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="font-medium truncate">{team.name}</span>
                          {pendingTeamAppeals > 0 && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                              {pendingTeamAppeals}
                            </Badge>
                          )}
                        </div>
                        <span className={`font-semibold shrink-0 ${team.balance < 0 ? "text-destructive" : "text-green-600"}`}>
                          ${team.balance.toFixed(0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Selected team details */}
          {selectedTeam && (
            <Card>
              <CardHeader className="py-2 px-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {selectedTeam.name}
                  </span>
                  <span className={`text-lg font-bold ${selectedTeam.balance < 0 ? "text-destructive" : "text-green-600"}`}>
                    ${selectedTeam.balance.toFixed(2)}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-2">
                <div className="text-[10px] text-muted-foreground mb-2">Останні транзакції:</div>
                {loadingTransactions ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground text-[10px]">
                    Немає транзакцій
                  </div>
                ) : (
                  <ScrollArea className="h-[150px]">
                    <div className="space-y-1">
                      {transactions.map(tx => (
                        <div key={tx.id} className="flex items-center justify-between p-1.5 rounded bg-muted/30 text-[10px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {tx.amount > 0 ? (
                              <ArrowUpRight className="h-3 w-3 text-green-500 shrink-0" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-destructive shrink-0" />
                            )}
                            <span className="truncate">{tx.note}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-semibold ${tx.amount > 0 ? "text-green-600" : "text-destructive"}`}>
                              {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString("uk-UA")}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Appeals and stats */}
        <div className="lg:col-span-3 space-y-3">
          {/* Stats inline */}
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <Clock className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Очікують:</span>
              <span className="text-sm font-bold text-yellow-500">{filteredAppeals.filter(a => a.status === "pending").length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Схвалено:</span>
              <span className="text-sm font-bold text-green-500">{filteredAppeals.filter(a => a.status === "approved").length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <XCircle className="h-3 w-3 text-destructive" />
              <span className="text-xs text-muted-foreground">Відхилено:</span>
              <span className="text-sm font-bold text-destructive">{filteredAppeals.filter(a => a.status === "rejected").length}</span>
            </div>
          </div>

          {/* Appeals Table */}
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <MessageSquare className="h-3.5 w-3.5" />
                Апеляції ({filteredAppeals.length})
                {selectedTeam && <span className="text-muted-foreground font-normal ml-1">— {selectedTeam.name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {filteredAppeals.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  Немає апеляцій
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1.5">Статус</TableHead>
                        <TableHead className="text-xs py-1.5">Користувач</TableHead>
                        <TableHead className="text-xs py-1.5">Команда</TableHead>
                        <TableHead className="text-xs py-1.5">Сайт</TableHead>
                        <TableHead className="text-xs py-1.5">Сума</TableHead>
                        <TableHead className="text-xs py-1.5">Дата</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">Дії</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppeals.map(appeal => (
                        <TableRow key={appeal.id}>
                          <TableCell className="py-1.5">{getStatusBadge(appeal.status)}</TableCell>
                          <TableCell className="py-1.5 text-xs">{appeal.user_name}</TableCell>
                          <TableCell className="py-1.5 text-xs">{appeal.team_name}</TableCell>
                          <TableCell className="py-1.5 text-xs max-w-[120px] truncate" title={appeal.site_name}>
                            <div className="flex items-center gap-1">
                              {appeal.site_name}
                              {appeal.screenshot_url && <span title="Є скріншот"><Image className="h-3 w-3 text-muted-foreground" /></span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5 text-xs font-medium">
                            ${appeal.amount_to_refund.toFixed(2)}
                          </TableCell>
                          <TableCell className="py-1.5 text-[10px]">
                            {new Date(appeal.created_at).toLocaleDateString("uk-UA")}
                          </TableCell>
                          <TableCell className="py-1.5 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-[10px] px-1.5"
                              onClick={() => {
                                setSelectedAppeal(appeal);
                                setAdminComment(appeal.admin_comment || "");
                              }}
                            >
                              <Eye className="h-3 w-3 mr-0.5" />
                              Деталі
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Appeal Detail Dialog */}
      <Dialog open={!!selectedAppeal} onOpenChange={() => setSelectedAppeal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Деталі апеляції</DialogTitle>
          </DialogHeader>
          
          {selectedAppeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Користувач:</span>
                  <p className="font-medium">{selectedAppeal.user_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Команда:</span>
                  <p className="font-medium">{selectedAppeal.team_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Сайт:</span>
                  <p className="font-medium">{selectedAppeal.site_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Сума до повернення:</span>
                  <p className="font-medium text-lg">${selectedAppeal.amount_to_refund.toFixed(2)}</p>
                </div>
              </div>

              {/* Site actions */}
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md">
                <span className="text-sm text-muted-foreground w-full mb-1">Дії з сайтом:</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => navigate(`/edit/${selectedAppeal.generation_id}`)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  Переглянути
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    navigate(`/edit/${selectedAppeal.generation_id}`);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Редагувати
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleDownload(selectedAppeal)}
                  disabled={!selectedAppeal.zip_data}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Завантажити ZIP
                </Button>
              </div>

              <div>
                <span className="text-muted-foreground text-sm">Причина апеляції:</span>
                <p className="p-3 bg-muted rounded-md mt-1">{selectedAppeal.reason}</p>
              </div>

              {selectedAppeal.screenshot_url && (
                <div>
                  <span className="text-muted-foreground text-sm flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Скріншот:
                  </span>
                  <a 
                    href={selectedAppeal.screenshot_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block mt-1"
                  >
                    <img 
                      src={selectedAppeal.screenshot_url} 
                      alt="Скріншот помилки" 
                      className="max-h-48 rounded border object-contain hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  </a>
                </div>
              )}

              {selectedAppeal.prompt && (
                <div>
                  <span className="text-muted-foreground text-sm">Оригінальний промпт:</span>
                  <p className="p-3 bg-muted rounded-md mt-1 text-sm max-h-32 overflow-y-auto">
                    {selectedAppeal.prompt}
                  </p>
                </div>
              )}

              {selectedAppeal.status === "pending" ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-sm">Коментар адміністратора:</span>
                    <Textarea
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      placeholder="Додати коментар (необов'язково)..."
                      className="mt-1"
                    />
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => handleResolve(false)}
                      disabled={processing}
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Відхилити
                    </Button>
                    <Button
                      onClick={() => handleResolve(true)}
                      disabled={processing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      Схвалити і повернути ${selectedAppeal.amount_to_refund.toFixed(2)}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedAppeal.status)}
                    <span className="font-medium">
                      {selectedAppeal.status === "approved" ? "Схвалено" : "Відхилено"}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {selectedAppeal.resolved_at && new Date(selectedAppeal.resolved_at).toLocaleString("uk-UA")}
                    </span>
                  </div>
                  {selectedAppeal.admin_comment && (
                    <div>
                      <span className="text-muted-foreground text-sm">Коментар адміністратора:</span>
                      <p className="p-3 bg-muted rounded-md mt-1">{selectedAppeal.admin_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
