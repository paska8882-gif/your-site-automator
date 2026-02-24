import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Ticket, Plus, Copy, Check, Loader2, RefreshCw, Users, Wallet, 
  History, Crown, UserCog, Shield
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InviteCode {
  id: string;
  code: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  is_active: boolean;
  assigned_role: string | null;
  user_name?: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  display_name: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface Generation {
  id: string;
  site_name: string | null;
  prompt: string;
  status: string;
  created_at: string;
  sale_price: number | null;
  generation_cost: number | null;
  website_type: string | null;
  ai_model: string | null;
  user_name?: string;
}

interface TeamInfo {
  id: string;
  name: string;
  balance: number;
  credit_limit: number;
}

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isTeamOwner, loading: ownerLoading, teamId } = useTeamOwner();
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const dateLocaleStr = language === "ru" ? "ru-RU" : "uk-UA";

  const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("buyer");
  
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [changingRole, setChangingRole] = useState(false);

  useEffect(() => {
    if (!ownerLoading && !isTeamOwner) {
      navigate("/");
      return;
    }
    if (teamId) {
      fetchAllData();
    }
  }, [ownerLoading, isTeamOwner, teamId]);

  const fetchAllData = async () => {
    if (!teamId) return;
    setLoading(true);
    await Promise.all([
      fetchTeamInfo(),
      fetchInviteCodes(),
      fetchTeamMembers(),
      fetchGenerations()
    ]);
    setLoading(false);
  };

  const fetchTeamInfo = async () => {
    if (!teamId) return;
    const { data } = await supabase
      .from("teams")
      .select("id, name, balance, credit_limit")
      .eq("id", teamId)
      .maybeSingle();
    if (data) setTeamInfo(data);
  };

  const fetchInviteCodes = async () => {
    if (!teamId) return;
    const { data: codes } = await supabase
      .from("invite_codes")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    if (codes) {
      const usedByIds = codes.filter(c => c.used_by).map(c => c.used_by!);
      let profileMap = new Map<string, string>();
      if (usedByIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", usedByIds);
        profiles?.forEach(p => profileMap.set(p.user_id, p.display_name || t("dashboard.noName")));
      }
      setInviteCodes(codes.map(c => ({
        ...c,
        user_name: c.used_by ? profileMap.get(c.used_by) : undefined
      })));
    }
  };

  const fetchTeamMembers = async () => {
    if (!teamId) return;
    const { data: members } = await supabase
      .from("team_members")
      .select("id, user_id, role, status, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: true });

    if (members) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      setTeamMembers(members.map(m => ({
        ...m,
        display_name: profileMap.get(m.user_id) || t("dashboard.noName")
      })));
    }
  };

  const fetchGenerations = async () => {
    if (!teamId) return;
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("status", "approved");

    if (!members || members.length === 0) {
      setGenerations([]);
      return;
    }
    const userIds = members.map(m => m.user_id);
    const { data: gens } = await supabase
      .from("generation_history")
      .select("*")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(100);

    if (gens) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      setGenerations(gens.map(g => ({
        ...g,
        user_name: profileMap.get(g.user_id || "") || t("dashboard.noName")
      })));
    }
  };

  const handleGenerateCode = async () => {
    if (!user || !teamId) return;
    setGenerating(true);
    const newCode = generateCode();
    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode,
        created_by: user.id,
        team_id: teamId,
        assigned_role: selectedRole as "owner" | "team_lead" | "buyer" | "tech_dev"
      });

    if (error) {
      toast({ title: t("common.error"), description: t("common.error"), variant: "destructive" });
    } else {
      toast({ title: t("team.codeCopied"), description: newCode });
      fetchInviteCodes();
    }
    setGenerating(false);
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: t("common.copied"), description: code });
  };

  const handleDeactivateCode = async (id: string) => {
    const { error } = await supabase
      .from("invite_codes")
      .update({ is_active: false })
      .eq("id", id);
    if (error) {
      toast({ title: t("common.error"), description: t("common.error"), variant: "destructive" });
    } else {
      fetchInviteCodes();
    }
  };

  const openRoleDialog = (member: TeamMember) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setShowRoleDialog(true);
  };

  const handleChangeRole = async () => {
    if (!selectedMember || !teamId) return;
    setChangingRole(true);
    if (newRole === "owner") {
      await supabase
        .from("team_members")
        .update({ role: "buyer" })
        .eq("team_id", teamId)
        .eq("role", "owner");
    }
    const { error } = await supabase
      .from("team_members")
      .update({ role: newRole as "owner" | "team_lead" | "buyer" | "tech_dev" })
      .eq("id", selectedMember.id);
    if (error) {
      toast({ title: t("common.error"), description: t("common.error"), variant: "destructive" });
    } else {
      toast({ title: t("common.success"), description: t("dashboard.changeRole") });
      setShowRoleDialog(false);
      fetchTeamMembers();
    }
    setChangingRole(false);
  };

  const handleApproveMember = async (memberId: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ 
        status: "approved" as const, 
        approved_by: user?.id, 
        approved_at: new Date().toISOString() 
      })
      .eq("id", memberId);
    if (error) {
      toast({ title: t("common.error"), description: t("common.error"), variant: "destructive" });
    } else {
      toast({ title: t("team.approved"), description: t("dashboard.approve") });
      fetchTeamMembers();
    }
  };

  const handleRejectMember = async (memberId: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "rejected" as const })
      .eq("id", memberId);
    if (error) {
      toast({ title: t("common.error"), description: t("common.error"), variant: "destructive" });
    } else {
      toast({ title: t("team.rejected"), description: t("dashboard.reject") });
      fetchTeamMembers();
    }
  };

  if (ownerLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isTeamOwner) return null;

  const activeCodes = inviteCodes.filter(c => c.is_active && !c.used_by);
  const usedCodes = inviteCodes.filter(c => c.used_by);
  const approvedMembers = teamMembers.filter(m => m.status === "approved");
  const pendingMembers = teamMembers.filter(m => m.status === "pending");
  const completedGens = generations.filter(g => g.status === "completed");
  const totalSales = completedGens.reduce((sum, g) => sum + (g.sale_price || 0), 0);
  const totalCosts = completedGens.reduce((sum, g) => sum + (g.generation_cost || 0), 0);

  return (
    <AppLayout>
      <div className="p-4 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{t("dashboard.ownerPanel")}</h1>
              <p className="text-sm text-muted-foreground">{teamInfo?.name}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("dashboard.refresh")}
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">${teamInfo?.balance?.toFixed(2) || "0.00"}</p>
                  <p className="text-xs text-muted-foreground">{t("balance.title")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{approvedMembers.length}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.membersCount")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <History className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{completedGens.length}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.generationsCount")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{activeCodes.length}</p>
                  <p className="text-xs text-muted-foreground">{t("dashboard.activeCodes")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="codes" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="codes" className="text-xs">
              <Ticket className="h-3 w-3 mr-1" />
              {t("dashboard.codes")}
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {t("dashboard.teamTab")}
              {pendingMembers.length > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">{pendingMembers.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="h-3 w-3 mr-1" />
              {t("dashboard.historyTab")}
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-xs">
              <Wallet className="h-3 w-3 mr-1" />
              {t("dashboard.balanceTab")}
            </TabsTrigger>
          </TabsList>

          {/* Invite Codes Tab */}
          <TabsContent value="codes">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    {t("dashboard.inviteCodes")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="team_lead" className="text-xs">Team Lead</SelectItem>
                        <SelectItem value="buyer" className="text-xs">Buyer</SelectItem>
                        <SelectItem value="tech_dev" className="text-xs">Tech Dev</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleGenerateCode} disabled={generating} size="sm">
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                      {t("dashboard.createCode")}
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("dashboard.createCodesDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Active Codes */}
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Badge variant="default" className="bg-green-500">{t("dashboard.activeCodesLabel")} ({activeCodes.length})</Badge>
                  </h3>
                  {activeCodes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t("dashboard.noActiveCodes")}</p>
                  ) : (
                    <div className="space-y-2">
                      {activeCodes.map(code => (
                        <div key={code.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                          <div className="flex items-center gap-3">
                            <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{code.code}</code>
                            <Badge variant="outline" className="text-xs capitalize">{code.assigned_role}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(code.created_at).toLocaleDateString(dateLocaleStr)}
                            </span>
                            <Button variant="ghost" size="sm" onClick={() => handleCopyCode(code.code, code.id)}>
                              {copiedId === code.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeactivateCode(code.id)}>
                              {t("dashboard.deactivate")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Used Codes */}
                {usedCodes.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Badge variant="secondary">{t("dashboard.usedCodes")} ({usedCodes.length})</Badge>
                    </h3>
                    <div className="space-y-2">
                      {usedCodes.slice(0, 10).map(code => (
                        <div key={code.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <code className="font-mono text-sm text-muted-foreground">{code.code}</code>
                            <Badge variant="outline" className="text-xs capitalize">{code.assigned_role}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{code.user_name}</span>
                            <span>•</span>
                            <span>{code.used_at ? new Date(code.used_at).toLocaleDateString(dateLocaleStr) : ""}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Members Tab */}
          <TabsContent value="members">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {t("dashboard.teamMembers")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingMembers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Badge variant="destructive">{t("dashboard.awaitingApproval")} ({pendingMembers.length})</Badge>
                    </h3>
                    <div className="space-y-2">
                      {pendingMembers.map(member => (
                        <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-amber-500/10 border-amber-500/30">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{member.display_name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{member.role}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" onClick={() => handleApproveMember(member.id)}>
                              <Check className="h-4 w-4 mr-1" />
                              {t("dashboard.approve")}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleRejectMember(member.id)}>
                              {t("dashboard.reject")}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Badge variant="default">{t("dashboard.activeMembersLabel")} ({approvedMembers.length})</Badge>
                  </h3>
                  <div className="space-y-2">
                    {approvedMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{member.display_name}</span>
                          <Badge 
                            variant={member.role === "owner" ? "default" : "outline"} 
                            className={`text-xs capitalize ${member.role === "owner" ? "bg-amber-500" : ""}`}
                          >
                            {member.role === "owner" && <Crown className="h-3 w-3 mr-1" />}
                            {member.role}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(member.created_at).toLocaleDateString(dateLocaleStr)}
                          </span>
                          {member.role !== "owner" && (
                            <Button variant="ghost" size="sm" onClick={() => openRoleDialog(member)}>
                              <UserCog className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  {t("dashboard.generationHistory")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("dashboard.totalLabel")}: {completedGens.length} • {t("dashboard.sales")}: ${totalSales.toFixed(2)} • {t("dashboard.costs")}: ${totalCosts.toFixed(2)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {generations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">{t("dashboard.noGenerations")}</p>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {generations.map(gen => (
                      <div key={gen.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{gen.site_name || t("dashboard.noName")}</span>
                            <Badge 
                              variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"} 
                              className="text-[10px]"
                            >
                              {gen.status}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{gen.website_type}</Badge>
                            <Badge variant="outline" className="text-[10px]">{gen.ai_model}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate">{gen.prompt}</p>
                          <p className="text-xs text-muted-foreground">{gen.user_name}</p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-medium text-green-600">${gen.sale_price?.toFixed(2) || "0.00"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(gen.created_at).toLocaleDateString(dateLocaleStr)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Tab */}
          <TabsContent value="balance">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  {t("dashboard.teamBalance")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
                    <p className="text-sm text-muted-foreground">{t("dashboard.currentBalance")}</p>
                    <p className="text-3xl font-bold text-green-600">${teamInfo?.balance?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/30">
                    <p className="text-sm text-muted-foreground">{t("dashboard.creditLimit")}</p>
                    <p className="text-3xl font-bold text-blue-600">${teamInfo?.credit_limit?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="p-4 rounded-lg border bg-purple-500/10 border-purple-500/30">
                    <p className="text-sm text-muted-foreground">{t("dashboard.availableForSpending")}</p>
                    <p className="text-3xl font-bold text-purple-600">
                      ${((teamInfo?.balance || 0) + (teamInfo?.credit_limit || 0)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg border">
                  <h3 className="font-medium mb-2">{t("dashboard.generationStats")}</h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{completedGens.length}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.completed")}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-green-600">${totalSales.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.salesAmount")}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">${totalCosts.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{t("dashboard.aiCosts")}</p>
                    </div>
                  </div>
                </div>

                <div className="text-center">
                  <Button onClick={() => navigate("/balance")}>
                    {t("dashboard.requestTopUp")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Role Change Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              {t("dashboard.changeRole")}: {selectedMember?.display_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="team_lead">Team Lead</SelectItem>
                <SelectItem value="buyer">Buyer</SelectItem>
                <SelectItem value="tech_dev">Tech Dev</SelectItem>
              </SelectContent>
            </Select>
            
            {newRole === "owner" && (
              <p className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                {t("dashboard.ownerWarning")}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={changingRole}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleChangeRole} disabled={changingRole || newRole === selectedMember?.role}>
                {changingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : t("dashboard.save")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Dashboard;
