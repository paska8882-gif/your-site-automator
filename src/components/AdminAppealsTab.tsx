import { useState, useEffect, useCallback } from "react";
import { useRealtimeTable } from "@/contexts/RealtimeContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
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
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Bot,
  PenLine
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
  screenshot_urls: string[] | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  user_name?: string;
  team_name?: string;
  site_name?: string;
  prompt?: string;
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

const isAutoAppeal = (reason: string) =>
  reason.startsWith("Автоповідомлення:") || reason === "-";

export function AdminAppealsTab() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [adminComment, setAdminComment] = useState("");
  const [processing, setProcessing] = useState(false);
  
  // Teams and balances
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(
    searchParams.get("teamId")
  );
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Type filter
  const [typeFilter, setTypeFilter] = useState<"all" | "auto" | "manual">("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });
  const [bulkConfirmAction, setBulkConfirmAction] = useState<"approve" | "reject" | null>(null);

  // Collapsible group states
  const [pendingGroupOpen, setPendingGroupOpen] = useState(true);
  const [historicalGroupOpen, setHistoricalGroupOpen] = useState(true);
  const [noAppealsGroupOpen, setNoAppealsGroupOpen] = useState(false);

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (images: string[], startIndex: number = 0) => {
    setLightboxImages(images);
    setLightboxIndex(startIndex);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
    setLightboxImages([]);
    setLightboxIndex(0);
  };

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % lightboxImages.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + lightboxImages.length) % lightboxImages.length);
  };

  const handleTeamSelect = (teamId: string | null) => {
    setSelectedTeamId(teamId);
    setSelectedIds(new Set());
    const newParams = new URLSearchParams(searchParams);
    if (teamId) {
      newParams.set("teamId", teamId);
    } else {
      newParams.delete("teamId");
    }
    setSearchParams(newParams, { replace: true });
  };

  useEffect(() => {
    fetchAppeals();
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedTeamId) {
      fetchTransactions(selectedTeamId);
    } else {
      setTransactions([]);
    }
  }, [selectedTeamId]);

  // Use shared RealtimeContext channel for team balance updates
  useRealtimeTable("teams", useCallback((event) => {
    if (event.eventType === "UPDATE" && event.new) {
      const updatedTeam = event.new as any;
      setTeams(prev => prev.map(t => 
        t.id === updatedTeam.id ? { ...t, balance: updatedTeam.balance } : t
      ));
    }
  }, []), []);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [typeFilter]);

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

    const userIds = [...new Set(appealsData.map(a => a.user_id))];
    const generationIds = [...new Set(appealsData.map(a => a.generation_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const { data: generations } = await supabase
      .from("generation_history")
      .select("id, site_name, prompt, team_id, zip_data, website_type, ai_model, language")
      .in("id", generationIds);

    const generationTeamIds = [...new Set(generations?.map(g => g.team_id).filter(Boolean) || [])];

    const { data: teams } = await supabase
      .from("teams")
      .select("id, name")
      .in("id", generationTeamIds);

    const enrichedAppeals: Appeal[] = appealsData.map(appeal => {
      const generation = generations?.find(g => g.id === appeal.generation_id);
      const actualTeamId = generation?.team_id || appeal.team_id;
      return {
        ...appeal,
        screenshot_urls: (appeal.screenshot_urls as string[] | null) || null,
        team_id: actualTeamId,
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

      if (approved && selectedAppeal.amount_to_refund > 0 && selectedAppeal.team_id) {
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

          await supabase.from("balance_transactions").insert({
            team_id: selectedAppeal.team_id,
            amount: selectedAppeal.amount_to_refund,
            balance_before: balanceBefore,
            balance_after: newBalance,
            admin_id: user?.id,
            note: `Апеляція: повернення за ${selectedAppeal.site_name || "сайт"}`
          });

          setTeams(prev => prev.map(t => 
            t.id === selectedAppeal.team_id ? { ...t, balance: newBalance } : t
          ));

          if (selectedTeamId === selectedAppeal.team_id) {
            fetchTransactions(selectedAppeal.team_id);
          }
          
          console.log(`Refunded $${selectedAppeal.amount_to_refund} to team ${selectedAppeal.team_id}. New balance: $${newBalance}`);
        }
      }

      await supabase.functions.invoke('create-notification', {
        body: {
          notifications: [{
            user_id: selectedAppeal.user_id,
            type: approved ? "appeal_approved" : "appeal_rejected",
            title: approved ? "Апеляцію схвалено" : "Апеляцію відхилено",
            message: approved 
              ? `Вашу апеляцію схвалено. Повернено $${selectedAppeal.amount_to_refund.toFixed(2)}`
              : "Вашу апеляцію відхилено",
            data: { appealId: selectedAppeal.id, approved, amount: approved ? selectedAppeal.amount_to_refund : 0 }
          }]
        }
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
      fetchTeams();
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

  // Bulk resolve
  const handleBulkResolve = async (approved: boolean) => {
    setBulkConfirmAction(null);
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    const appealsToProcess = filteredAppeals.filter(a => ids.includes(a.id) && a.status === "pending");
    setBulkProgress({ current: 0, total: appealsToProcess.length });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const notifications: Array<{user_id: string; type: string; title: string; message: string; data: Record<string, unknown>}> = [];

      for (let i = 0; i < appealsToProcess.length; i++) {
        const appeal = appealsToProcess[i];
        setBulkProgress({ current: i + 1, total: appealsToProcess.length });

        // Update appeal status
        await supabase
          .from("appeals")
          .update({
            status: approved ? "approved" : "rejected",
            admin_comment: approved ? "Масове схвалення" : "Масове відхилення",
            resolved_at: new Date().toISOString(),
            resolved_by: user?.id
          })
          .eq("id", appeal.id);

        // If approved, refund
        if (approved && appeal.amount_to_refund > 0 && appeal.team_id) {
          const { data: team } = await supabase
            .from("teams")
            .select("balance")
            .eq("id", appeal.team_id)
            .single();

          if (team) {
            const balanceBefore = Number(team.balance || 0);
            const newBalance = balanceBefore + Number(appeal.amount_to_refund);
            
            await supabase
              .from("teams")
              .update({ balance: newBalance })
              .eq("id", appeal.team_id);

            await supabase.from("balance_transactions").insert({
              team_id: appeal.team_id,
              amount: appeal.amount_to_refund,
              balance_before: balanceBefore,
              balance_after: newBalance,
              admin_id: user?.id,
              note: `Апеляція (масова): повернення за ${appeal.site_name || "сайт"}`
            });
          }
        }

        notifications.push({
          user_id: appeal.user_id,
          type: approved ? "appeal_approved" : "appeal_rejected",
          title: approved ? "Апеляцію схвалено" : "Апеляцію відхилено",
          message: approved 
            ? `Вашу апеляцію схвалено. Повернено $${appeal.amount_to_refund.toFixed(2)}`
            : "Вашу апеляцію відхилено",
          data: { appealId: appeal.id, approved, amount: approved ? appeal.amount_to_refund : 0 }
        });
      }

      // Send all notifications in one batch
      if (notifications.length > 0) {
        await supabase.functions.invoke('create-notification', {
          body: { notifications }
        });
      }

      toast({
        title: "Успішно",
        description: approved 
          ? `Схвалено ${appealsToProcess.length} апеляцій`
          : `Відхилено ${appealsToProcess.length} апеляцій`
      });

      setSelectedIds(new Set());
      fetchAppeals();
      fetchTeams();
    } catch (error) {
      console.error("Bulk resolve error:", error);
      toast({
        title: "Помилка",
        description: "Помилка при масовій обробці",
        variant: "destructive"
      });
    }
    
    setBulkProcessing(false);
    setBulkProgress({ current: 0, total: 0 });
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
  
  // Apply both team and type filters
  const filteredAppeals = appeals
    .filter(a => !selectedTeamId || a.team_id === selectedTeamId)
    .filter(a => {
      if (typeFilter === "auto") return isAutoAppeal(a.reason);
      if (typeFilter === "manual") return !isAutoAppeal(a.reason);
      return true;
    });

  // Pending appeals in current filtered view (for bulk actions)
  const pendingFiltered = filteredAppeals.filter(a => a.status === "pending");
  const selectedPendingAppeals = filteredAppeals.filter(a => selectedIds.has(a.id) && a.status === "pending");
  const selectedRefundTotal = selectedPendingAppeals.reduce((sum, a) => sum + a.amount_to_refund, 0);
  const allPendingSelected = pendingFiltered.length > 0 && pendingFiltered.every(a => selectedIds.has(a.id));

  // Stats counts
  const autoCount = filteredAppeals.filter(a => isAutoAppeal(a.reason)).length;
  const manualCount = filteredAppeals.filter(a => !isAutoAppeal(a.reason)).length;

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingFiltered.map(a => a.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <AdminPageHeader 
        icon={MessageSquare} 
        title={t("admin.appealsTitle")} 
        description={t("admin.appealsDescription")} 
      />
      
      {/* Two column layout: Teams + Appeals */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        {/* Left: Team balances panel */}
        <div className="lg:col-span-1 space-y-3">
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Wallet className="h-3.5 w-3.5" />
                {t("admin.teamBalances")}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <ScrollArea className="h-[300px]">
                <div className="space-y-1">
                  <button
                    onClick={() => handleTeamSelect(null)}
                    className={`w-full flex items-center justify-between p-2 rounded text-xs transition-colors ${
                      !selectedTeamId ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">{t("admin.allTeams")}</span>
                    <span className="text-muted-foreground">{appeals.length}</span>
                  </button>
                  
                  {/* Group teams by appeal status */}
                  {(() => {
                    // Teams with pending appeals
                    const teamsWithPending = teams.filter(team => 
                      appeals.some(a => a.team_id === team.id && a.status === "pending")
                    );
                    // Teams with only historical appeals (no pending)
                    const teamsWithHistorical = teams.filter(team => 
                      appeals.some(a => a.team_id === team.id) && 
                      !appeals.some(a => a.team_id === team.id && a.status === "pending")
                    );
                    // Teams with no appeals
                    const teamsWithNoAppeals = teams.filter(team => 
                      !appeals.some(a => a.team_id === team.id)
                    );

                    const renderTeam = (team: Team) => {
                      const pendingTeamAppeals = appeals.filter(a => a.team_id === team.id && a.status === "pending").length;
                      const totalTeamAppeals = appeals.filter(a => a.team_id === team.id).length;
                      return (
                        <button
                          key={team.id}
                          onClick={() => handleTeamSelect(team.id)}
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
                            {totalTeamAppeals > 0 && pendingTeamAppeals === 0 && (
                              <span className="text-muted-foreground text-[9px]">({totalTeamAppeals})</span>
                            )}
                          </div>
                          <span className={`font-semibold shrink-0 ${team.balance < 0 ? "text-destructive" : "text-green-600"}`}>
                            ${team.balance.toFixed(0)}
                          </span>
                        </button>
                      );
                    };

                    return (
                      <>
                        {teamsWithPending.length > 0 && (
                          <Collapsible open={pendingGroupOpen} onOpenChange={setPendingGroupOpen}>
                            <CollapsibleTrigger className="w-full text-[10px] text-yellow-600 font-medium px-2 pt-2 pb-1 flex items-center gap-1 hover:bg-muted/30 rounded cursor-pointer">
                              {pendingGroupOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Clock className="h-3 w-3" />
                              {t("admin.activeAppeals")} ({teamsWithPending.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {teamsWithPending.map(renderTeam)}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        
                        {teamsWithHistorical.length > 0 && (
                          <Collapsible open={historicalGroupOpen} onOpenChange={setHistoricalGroupOpen}>
                            <CollapsibleTrigger className="w-full text-[10px] text-muted-foreground font-medium px-2 pt-2 pb-1 flex items-center gap-1 hover:bg-muted/30 rounded cursor-pointer">
                              {historicalGroupOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <CheckCircle className="h-3 w-3" />
                              {t("admin.historicalAppeals")} ({teamsWithHistorical.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {teamsWithHistorical.map(renderTeam)}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                        
                        {teamsWithNoAppeals.length > 0 && (
                          <Collapsible open={noAppealsGroupOpen} onOpenChange={setNoAppealsGroupOpen}>
                            <CollapsibleTrigger className="w-full text-[10px] text-muted-foreground/60 font-medium px-2 pt-2 pb-1 flex items-center gap-1 hover:bg-muted/30 rounded cursor-pointer">
                              {noAppealsGroupOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Users className="h-3 w-3" />
                              {t("admin.noAppeals")} ({teamsWithNoAppeals.length})
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {teamsWithNoAppeals.map(renderTeam)}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </>
                    );
                  })()}
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
                <div className="text-[10px] text-muted-foreground mb-2">{t("admin.lastTransactions")}:</div>
                {loadingTransactions ? (
                  <div className="flex justify-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-2 text-muted-foreground text-[10px]">
                    {t("admin.noTransactions")}
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
          {/* Stats inline + Type filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <Clock className="h-3 w-3 text-yellow-500" />
              <span className="text-xs text-muted-foreground">{t("admin.pendingAppeals")}:</span>
              <span className="text-sm font-bold text-yellow-500">{filteredAppeals.filter(a => a.status === "pending").length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">{t("admin.approvedAppeals")}:</span>
              <span className="text-sm font-bold text-green-500">{filteredAppeals.filter(a => a.status === "approved").length}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <XCircle className="h-3 w-3 text-destructive" />
              <span className="text-xs text-muted-foreground">{t("admin.rejectedAppeals")}:</span>
              <span className="text-sm font-bold text-destructive">{filteredAppeals.filter(a => a.status === "rejected").length}</span>
            </div>
            
            {/* Auto/Manual counts */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <Bot className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">Авто:</span>
              <span className="text-sm font-bold text-blue-500">{autoCount}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
              <PenLine className="h-3 w-3 text-orange-500" />
              <span className="text-xs text-muted-foreground">Ручні:</span>
              <span className="text-sm font-bold text-orange-500">{manualCount}</span>
            </div>

            {/* Type filter buttons */}
            <div className="flex items-center gap-0.5 ml-auto border rounded-md p-0.5 bg-muted/30">
              {([
                { key: "all" as const, label: "Всі" },
                { key: "auto" as const, label: "Авто", icon: Bot },
                { key: "manual" as const, label: "Ручні", icon: PenLine },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    typeFilter === key 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3" />}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 p-2 rounded-md border bg-primary/5 border-primary/20">
              <span className="text-xs font-medium">
                Вибрано: {selectedPendingAppeals.length} апеляцій (${selectedRefundTotal.toFixed(2)})
              </span>
              <div className="flex items-center gap-1.5 ml-auto">
                <Button
                  size="sm"
                  className="h-7 text-xs bg-green-600 hover:bg-green-700"
                  onClick={() => setBulkConfirmAction("approve")}
                  disabled={selectedPendingAppeals.length === 0 || bulkProcessing}
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Схвалити ({selectedPendingAppeals.length})
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs"
                  onClick={() => setBulkConfirmAction("reject")}
                  disabled={selectedPendingAppeals.length === 0 || bulkProcessing}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  Відхилити ({selectedPendingAppeals.length})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Зняти вибір
                </Button>
              </div>
            </div>
          )}

          {/* Bulk progress */}
          {bulkProcessing && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Обробка {bulkProgress.current} з {bulkProgress.total}...
              </div>
              <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="h-2" />
            </div>
          )}

          {/* Appeals Table */}
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <MessageSquare className="h-3.5 w-3.5" />
                {t("admin.appeals")} ({filteredAppeals.length})
                {selectedTeam && <span className="text-muted-foreground font-normal ml-1">— {selectedTeam.name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              {filteredAppeals.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-xs">
                  {t("admin.noAppeals")}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs py-1.5 w-8">
                          <Checkbox
                            checked={allPendingSelected && pendingFiltered.length > 0}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Вибрати всі"
                          />
                        </TableHead>
                        <TableHead className="text-xs py-1.5 w-16">Тип</TableHead>
                        <TableHead className="text-xs py-1.5">{t("admin.status")}</TableHead>
                        <TableHead className="text-xs py-1.5">{t("admin.user")}</TableHead>
                        <TableHead className="text-xs py-1.5">{t("admin.userTeam")}</TableHead>
                        <TableHead className="text-xs py-1.5">{t("admin.siteName")}</TableHead>
                        <TableHead className="text-xs py-1.5">{t("admin.amount")}</TableHead>
                        <TableHead className="text-xs py-1.5">{t("admin.date")}</TableHead>
                        <TableHead className="text-xs py-1.5 text-right">{t("admin.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAppeals.map(appeal => {
                        const isAuto = isAutoAppeal(appeal.reason);
                        return (
                          <TableRow key={appeal.id} className={selectedIds.has(appeal.id) ? "bg-primary/5" : undefined}>
                            <TableCell className="py-1.5">
                              {appeal.status === "pending" ? (
                                <Checkbox
                                  checked={selectedIds.has(appeal.id)}
                                  onCheckedChange={() => toggleSelect(appeal.id)}
                                />
                              ) : (
                                <div className="w-4" />
                              )}
                            </TableCell>
                            <TableCell className="py-1.5">
                              {isAuto ? (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30 gap-0.5">
                                  <Bot className="h-2.5 w-2.5" />
                                  Авто
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-500/10 text-orange-600 border-orange-500/30 gap-0.5">
                                  <PenLine className="h-2.5 w-2.5" />
                                  Ручна
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="py-1.5">{getStatusBadge(appeal.status)}</TableCell>
                            <TableCell className="py-1.5 text-xs">{appeal.user_name}</TableCell>
                            <TableCell className="py-1.5 text-xs">{appeal.team_name}</TableCell>
                            <TableCell className="py-1.5 text-xs max-w-[120px] truncate" title={appeal.site_name}>
                              <div className="flex items-center gap-1">
                                {appeal.site_name}
                                {(appeal.screenshot_urls?.length || appeal.screenshot_url) && (
                                  <span title={`${appeal.screenshot_urls?.length || 1} скріншот(ів)`} className="flex items-center">
                                    <Image className="h-3 w-3 text-muted-foreground" />
                                    {(appeal.screenshot_urls?.length || 0) > 1 && (
                                      <span className="text-[10px] text-muted-foreground ml-0.5">
                                        {appeal.screenshot_urls?.length}
                                      </span>
                                    )}
                                  </span>
                                )}
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
                                {t("common.details")}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bulk confirm dialog */}
      <Dialog open={!!bulkConfirmAction} onOpenChange={() => setBulkConfirmAction(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkConfirmAction === "approve" ? "Масове схвалення" : "Масове відхилення"}
            </DialogTitle>
            <DialogDescription>
              {bulkConfirmAction === "approve" 
                ? `Ви збираєтесь схвалити ${selectedPendingAppeals.length} апеляцій і повернути $${selectedRefundTotal.toFixed(2)} на баланси команд.`
                : `Ви збираєтесь відхилити ${selectedPendingAppeals.length} апеляцій без повернення коштів.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between p-2 bg-muted rounded">
              <span className="text-muted-foreground">Кількість:</span>
              <span className="font-medium">{selectedPendingAppeals.length}</span>
            </div>
            {bulkConfirmAction === "approve" && (
              <div className="flex justify-between p-2 bg-muted rounded">
                <span className="text-muted-foreground">Загальне повернення:</span>
                <span className="font-bold text-green-600">${selectedRefundTotal.toFixed(2)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkConfirmAction(null)}>
              Скасувати
            </Button>
            <Button 
              onClick={() => handleBulkResolve(bulkConfirmAction === "approve")}
              className={bulkConfirmAction === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
              variant={bulkConfirmAction === "reject" ? "destructive" : "default"}
            >
              {bulkConfirmAction === "approve" ? "Підтвердити схвалення" : "Підтвердити відхилення"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appeal Detail Dialog */}
      <Dialog open={!!selectedAppeal} onOpenChange={() => setSelectedAppeal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("admin.appealDetails")}</DialogTitle>
          </DialogHeader>
          
          {selectedAppeal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t("admin.user")}:</span>
                  <p className="font-medium">{selectedAppeal.user_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.userTeam")}:</span>
                  <p className="font-medium">{selectedAppeal.team_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.siteName")}:</span>
                  <p className="font-medium">{selectedAppeal.site_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">{t("admin.refundAmount")}:</span>
                  <p className="font-medium text-lg">${selectedAppeal.amount_to_refund.toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Тип:</span>
                  <div className="mt-0.5">
                    {isAutoAppeal(selectedAppeal.reason) ? (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 gap-1">
                        <Bot className="h-3 w-3" />
                        Автоапеляція
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/30 gap-1">
                        <PenLine className="h-3 w-3" />
                        Ручна апеляція
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">ID сайту:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="font-mono text-xs bg-muted/50 px-2 py-1 rounded select-all break-all flex-1">{selectedAppeal.generation_id}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedAppeal.generation_id);
                        toast({ title: "Скопійовано", description: "ID сайту скопійовано" });
                      }}
                    >
                      ID
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2 shrink-0"
                      onClick={() => {
                        const text = `ID: ${selectedAppeal.generation_id}\nПричина: ${selectedAppeal.reason}`;
                        navigator.clipboard.writeText(text);
                        toast({ title: "Скопійовано", description: "ID + причина скопійовано" });
                      }}
                    >
                      ID + Причина
                    </Button>
                  </div>
                </div>
              </div>

              {/* Site actions */}
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-md">
                <span className="text-sm text-muted-foreground w-full mb-1">{t("admin.siteActions")}:</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => navigate(`/edit/${selectedAppeal.generation_id}`)}
                >
                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                  {t("admin.viewSite")}
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
                  {t("admin.editSite")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => handleDownload(selectedAppeal)}
                  disabled={!selectedAppeal.zip_data}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  {t("admin.downloadZip")}
                </Button>
              </div>

              <div>
                <span className="text-muted-foreground text-sm">{t("admin.appealReason")}:</span>
                <p className="p-3 bg-muted rounded-md mt-1">{selectedAppeal.reason}</p>
              </div>

              {(selectedAppeal.screenshot_urls?.length || selectedAppeal.screenshot_url) && (
                <div>
                  <span className="text-muted-foreground text-sm flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    {t("admin.screenshots")} ({selectedAppeal.screenshot_urls?.length || 1}):
                  </span>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {(() => {
                      const images = (selectedAppeal.screenshot_urls?.length ? selectedAppeal.screenshot_urls : [selectedAppeal.screenshot_url]).filter(Boolean) as string[];
                      return images.map((url, index) => (
                        <div
                          key={index}
                          className="cursor-pointer"
                          onClick={() => openLightbox(images, index)}
                        >
                          <img 
                            src={url} 
                            alt={`Скріншот ${index + 1}`} 
                            className="max-h-32 rounded border object-cover hover:opacity-80 transition-opacity w-full"
                          />
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}

              {selectedAppeal.prompt && (
                <div>
                  <span className="text-muted-foreground text-sm">{t("admin.prompt")}:</span>
                  <p className="p-3 bg-muted rounded-md mt-1 text-sm max-h-32 overflow-y-auto">
                    {selectedAppeal.prompt}
                  </p>
                </div>
              )}

              {selectedAppeal.status === "pending" ? (
                <>
                  <div>
                    <span className="text-muted-foreground text-sm">{t("admin.adminComment")}:</span>
                    <Textarea
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      placeholder={t("admin.commentPlaceholder")}
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
                      {t("admin.rejectAppeal")}
                    </Button>
                    <Button
                      onClick={() => handleResolve(true)}
                      disabled={processing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                      {t("admin.approveAppeal")} ${selectedAppeal.amount_to_refund.toFixed(2)}
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(selectedAppeal.status)}
                    <span className="font-medium">
                      {selectedAppeal.status === "approved" ? t("admin.approved") : t("admin.rejected")}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {selectedAppeal.resolved_at && new Date(selectedAppeal.resolved_at).toLocaleString("uk-UA")}
                    </span>
                  </div>
                  {selectedAppeal.admin_comment && (
                    <div>
                      <span className="text-muted-foreground text-sm">{t("admin.adminComment")}:</span>
                      <p className="p-3 bg-muted rounded-md mt-1">{selectedAppeal.admin_comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Lightbox for full-size image viewing */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <div className="relative flex items-center justify-center min-h-[80vh]">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
              onClick={closeLightbox}
            >
              <X className="h-6 w-6" />
            </Button>
            
            {lightboxImages.length > 1 && (
              <div className="absolute top-2 left-2 z-50 text-white text-sm bg-black/50 px-2 py-1 rounded">
                {lightboxIndex + 1} / {lightboxImages.length}
              </div>
            )}
            
            {lightboxImages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={prevImage}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}
            
            {lightboxImages[lightboxIndex] && (
              <img
                src={lightboxImages[lightboxIndex]}
                alt={`Скріншот ${lightboxIndex + 1}`}
                className="max-w-full max-h-[90vh] object-contain"
              />
            )}
            
            {lightboxImages.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 z-50 text-white hover:bg-white/20 h-12 w-12"
                onClick={nextImage}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}
            
            {lightboxImages.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/50 p-2 rounded">
                {lightboxImages.map((url, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer rounded overflow-hidden border-2 transition-all ${
                      index === lightboxIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                    onClick={() => setLightboxIndex(index)}
                  >
                    <img
                      src={url}
                      alt={`Мініатюра ${index + 1}`}
                      className="h-12 w-16 object-cover"
                    />
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
