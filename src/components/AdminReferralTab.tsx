import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Gift, Settings, Loader2, Check, X, DollarSign, Users, Target, Save, Edit, Plus, Power, ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";

interface Team {
  id: string;
  name: string;
}

interface ReferralSettings {
  id: string;
  invite_reward: number;
  milestone_reward: number;
  milestone_generations: number;
  new_user_bonus: number;
  default_max_referral_invites: number;
}

interface ReferralReward {
  id: string;
  referral_invite_id: string;
  user_id: string;
  team_id: string | null;
  reward_type: string;
  amount: number;
  status: string;
  processed_by: string | null;
  processed_at: string | null;
  admin_comment: string | null;
  created_at: string;
  user_email?: string;
  team_name?: string;
  referral_code?: string;
}

interface ReferralInvite {
  id: string;
  code: string;
  referrer_user_id: string;
  referrer_team_id: string | null;
  invited_user_id: string | null;
  invited_team_id: string | null;
  used_at: string | null;
  created_at: string;
  is_active: boolean;
  milestone_reached: boolean;
  referrer_email?: string;
  referrer_team_name?: string;
  invited_team_name?: string;
  invited_generations?: number;
}

export function AdminReferralTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [editingSettings, setEditingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    invite_reward: 70,
    milestone_reward: 70,
    milestone_generations: 50,
    new_user_bonus: 100,
    default_max_referral_invites: 4
  });
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [selectedReward, setSelectedReward] = useState<ReferralReward | null>(null);
  const [processing, setProcessing] = useState(false);
  const [adminComment, setAdminComment] = useState("");
  
  // New states for admin invite management
  const [teams, setTeams] = useState<Team[]>([]);
  const [showCreateInviteDialog, setShowCreateInviteDialog] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [togglingInvite, setTogglingInvite] = useState<string | null>(null);
  
  // Grouping states for invites
  const [inviteGroupBy, setInviteGroupBy] = useState<"status" | "team">("status");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all teams for the dropdown
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");
    
    if (teamsData) {
      setTeams(teamsData);
    }
    
    // Fetch settings
    const { data: settingsData } = await supabase
      .from("referral_settings")
      .select("*")
      .single();
    
    if (settingsData) {
      setSettings(settingsData);
      setSettingsForm({
        invite_reward: settingsData.invite_reward,
        milestone_reward: settingsData.milestone_reward,
        milestone_generations: settingsData.milestone_generations,
        new_user_bonus: settingsData.new_user_bonus,
        default_max_referral_invites: settingsData.default_max_referral_invites ?? 4
      });
    }

    // Fetch all rewards
    const { data: rewardsData } = await supabase
      .from("referral_rewards")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (rewardsData) {
      // Enrich with user and team info
      const enrichedRewards = await Promise.all(rewardsData.map(async (reward) => {
        // Get user email from profiles
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", reward.user_id)
          .single();

        // Get team name
        let team_name = null;
        if (reward.team_id) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("name")
            .eq("id", reward.team_id)
            .single();
          team_name = teamData?.name || null;
        }

        // Get referral code
        const { data: inviteData } = await supabase
          .from("referral_invites")
          .select("code")
          .eq("id", reward.referral_invite_id)
          .single();

        return {
          ...reward,
          user_email: profileData?.display_name || reward.user_id.slice(0, 8),
          team_name,
          referral_code: inviteData?.code
        };
      }));

      setRewards(enrichedRewards);
    }

    // Fetch all invites
    const { data: invitesData } = await supabase
      .from("referral_invites")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (invitesData) {
      // Enrich with user and team info
      const enrichedInvites = await Promise.all(invitesData.map(async (invite) => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", invite.referrer_user_id)
          .single();

        let referrer_team_name = null;
        if (invite.referrer_team_id) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("name")
            .eq("id", invite.referrer_team_id)
            .single();
          referrer_team_name = teamData?.name || null;
        }

        let invited_team_name = null;
        let invited_generations = 0;
        if (invite.invited_team_id) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("name")
            .eq("id", invite.invited_team_id)
            .single();
          invited_team_name = teamData?.name || null;

          const { count } = await supabase
            .from("generation_history")
            .select("*", { count: "exact", head: true })
            .eq("team_id", invite.invited_team_id)
            .eq("status", "completed");
          invited_generations = count || 0;
        }

        return {
          ...invite,
          referrer_email: profileData?.display_name || invite.referrer_user_id.slice(0, 8),
          referrer_team_name,
          invited_team_name,
          invited_generations
        };
      }));

      setInvites(enrichedInvites);
    }

    setLoading(false);
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("referral_settings")
      .update({
        invite_reward: settingsForm.invite_reward,
        milestone_reward: settingsForm.milestone_reward,
        milestone_generations: settingsForm.milestone_generations,
        new_user_bonus: settingsForm.new_user_bonus,
        default_max_referral_invites: settingsForm.default_max_referral_invites,
        updated_at: new Date().toISOString(),
        updated_by: user?.id
      })
      .eq("id", settings.id);
    
    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти налаштування",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Збережено",
        description: "Налаштування реферальної програми оновлено"
      });
      setEditingSettings(false);
      fetchData();
    }
    
    setSaving(false);
  };

  const processReward = async (action: "approve" | "reject") => {
    if (!selectedReward) return;
    
    setProcessing(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from("referral_rewards")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        processed_by: user?.id,
        processed_at: new Date().toISOString(),
        admin_comment: adminComment || null
      })
      .eq("id", selectedReward.id);
    
    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося обробити винагороду",
        variant: "destructive"
      });
    } else {
      // If approved, add to team balance
      if (action === "approve" && selectedReward.team_id) {
        const { data: teamData } = await supabase
          .from("teams")
          .select("balance")
          .eq("id", selectedReward.team_id)
          .single();
        
        if (teamData) {
          await supabase
            .from("teams")
            .update({ balance: teamData.balance + selectedReward.amount })
            .eq("id", selectedReward.team_id);
          
          // Record transaction
          await supabase
            .from("balance_transactions")
            .insert({
              team_id: selectedReward.team_id,
              amount: selectedReward.amount,
              balance_before: teamData.balance,
              balance_after: teamData.balance + selectedReward.amount,
              admin_id: user?.id,
              note: `Реферальна винагорода: ${getRewardTypeLabel(selectedReward.reward_type)}`
            });
        }
      }
      
      toast({
        title: action === "approve" ? "Схвалено" : "Відхилено",
        description: action === "approve" 
          ? `$${selectedReward.amount} зараховано на баланс команди`
          : "Винагороду відхилено"
      });
      
      setSelectedReward(null);
      setAdminComment("");
      fetchData();
    }
    
    setProcessing(false);
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case "invite":
        return "Запрошення";
      case "milestone":
        return "Досягнення";
      case "new_user_bonus":
        return "Бонус нового користувача";
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">Очікує</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">Схвалено</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">Відхилено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const toggleInviteStatus = async (inviteId: string, currentStatus: boolean) => {
    setTogglingInvite(inviteId);
    
    const { error } = await supabase
      .from("referral_invites")
      .update({ is_active: !currentStatus })
      .eq("id", inviteId);
    
    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося змінити статус коду",
        variant: "destructive"
      });
    } else {
      toast({
        title: currentStatus ? "Деактивовано" : "Активовано",
        description: `Інвайт код ${currentStatus ? "деактивовано" : "активовано"}`
      });
      fetchData();
    }
    
    setTogglingInvite(null);
  };

  const generateRandomCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createInviteForTeam = async () => {
    if (!selectedTeamId) {
      toast({
        title: "Помилка",
        description: "Оберіть команду",
        variant: "destructive"
      });
      return;
    }
    
    setCreatingInvite(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Помилка",
        description: "Користувач не авторизований",
        variant: "destructive"
      });
      setCreatingInvite(false);
      return;
    }

    // Get team owner
    const { data: ownerData } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", selectedTeamId)
      .eq("role", "owner")
      .eq("status", "approved")
      .single();
    
    if (!ownerData) {
      toast({
        title: "Помилка",
        description: "Не вдалося знайти власника команди",
        variant: "destructive"
      });
      setCreatingInvite(false);
      return;
    }

    const code = generateRandomCode();
    
    const { error } = await supabase
      .from("referral_invites")
      .insert({
        code,
        referrer_user_id: ownerData.user_id,
        referrer_team_id: selectedTeamId,
        is_active: true
      });
    
    if (error) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Код створено",
        description: `Реферальний код ${code} створено для команди`
      });
      setShowCreateInviteDialog(false);
      setSelectedTeamId("");
      fetchData();
    }
    
    setCreatingInvite(false);
  };

  const pendingRewards = rewards.filter(r => r.status === "pending");
  const totalPending = pendingRewards.reduce((sum, r) => sum + r.amount, 0);
  const totalApproved = rewards.filter(r => r.status === "approved").reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Gift className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Очікують</p>
                <p className="text-2xl font-bold">{pendingRewards.length}</p>
                <p className="text-xs text-muted-foreground">${totalPending.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Виплачено</p>
                <p className="text-2xl font-bold">${totalApproved.toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Активних кодів</p>
                <p className="text-2xl font-bold">{invites.filter(i => i.is_active && !i.used_at).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Використано</p>
                <p className="text-2xl font-bold">{invites.filter(i => i.used_at).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            Очікують
            {pendingRewards.length > 0 && (
              <Badge variant="secondary">{pendingRewards.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">Всі винагороди</TabsTrigger>
          <TabsTrigger value="invites">Інвайт коди</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Налаштування
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingRewards.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Немає винагород для обробки
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Дата</TableHead>
                      <TableHead>Користувач</TableHead>
                      <TableHead>Команда</TableHead>
                      <TableHead>Тип</TableHead>
                      <TableHead>Сума</TableHead>
                      <TableHead>Код</TableHead>
                      <TableHead>Дії</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingRewards.map((reward) => (
                      <TableRow key={reward.id}>
                        <TableCell className="text-sm">
                          {format(new Date(reward.created_at), "dd.MM.yyyy HH:mm")}
                        </TableCell>
                        <TableCell>{reward.user_email}</TableCell>
                        <TableCell>{reward.team_name || "-"}</TableCell>
                        <TableCell>{getRewardTypeLabel(reward.reward_type)}</TableCell>
                        <TableCell className="font-medium">${reward.amount.toFixed(2)}</TableCell>
                        <TableCell className="font-mono text-sm">{reward.referral_code}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedReward(reward);
                                setAdminComment("");
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Обробити
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Користувач</TableHead>
                    <TableHead>Команда</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Сума</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Коментар</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell className="text-sm">
                        {format(new Date(reward.created_at), "dd.MM.yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{reward.user_email}</TableCell>
                      <TableCell>{reward.team_name || "-"}</TableCell>
                      <TableCell>{getRewardTypeLabel(reward.reward_type)}</TableCell>
                      <TableCell className="font-medium">${reward.amount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(reward.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {reward.admin_comment || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Select value={inviteGroupBy} onValueChange={(value: "status" | "team") => {
                setInviteGroupBy(value);
                setExpandedGroups(new Set());
              }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Групування" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">По статусу</SelectItem>
                  <SelectItem value="team">По команді</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowCreateInviteDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Створити код для команди
            </Button>
          </div>
          
          {inviteGroupBy === "status" ? (
            // Group by status (active/inactive/used)
            <div className="space-y-4">
              {[
                { key: "active", label: "Активні", filter: (i: ReferralInvite) => i.is_active && !i.used_at, color: "bg-blue-500/10 text-blue-500" },
                { key: "used", label: "Використані", filter: (i: ReferralInvite) => !!i.used_at, color: "bg-green-500/10 text-green-500" },
                { key: "inactive", label: "Неактивні", filter: (i: ReferralInvite) => !i.is_active && !i.used_at, color: "bg-muted text-muted-foreground" }
              ].map(group => {
                const groupInvites = invites.filter(group.filter);
                if (groupInvites.length === 0) return null;
                
                const isExpanded = expandedGroups.has(group.key);
                
                return (
                  <Card key={group.key}>
                    <Collapsible open={isExpanded} onOpenChange={(open) => {
                      const newSet = new Set(expandedGroups);
                      if (open) newSet.add(group.key);
                      else newSet.delete(group.key);
                      setExpandedGroups(newSet);
                    }}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              )}
                              <Badge variant="outline" className={group.color}>
                                {group.label}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {groupInvites.length} кодів
                              </span>
                            </div>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Код</TableHead>
                                <TableHead>Реферер</TableHead>
                                <TableHead>Команда рефера</TableHead>
                                <TableHead>Запрошена команда</TableHead>
                                <TableHead>Генерацій</TableHead>
                                <TableHead>Дата</TableHead>
                                <TableHead>Дії</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {groupInvites.map((invite) => (
                                <TableRow key={invite.id}>
                                  <TableCell className="font-mono font-medium whitespace-nowrap">{invite.code}</TableCell>
                                  <TableCell>{invite.referrer_email}</TableCell>
                                  <TableCell>{invite.referrer_team_name || "-"}</TableCell>
                                  <TableCell>{invite.invited_team_name || "-"}</TableCell>
                                  <TableCell>
                                    {invite.invited_team_id ? (
                                      <div className="flex items-center gap-1">
                                        <span>{invite.invited_generations}</span>
                                        <span className="text-muted-foreground">/ {settings?.milestone_generations}</span>
                                        {invite.milestone_reached && (
                                          <Check className="h-4 w-4 text-green-500" />
                                        )}
                                      </div>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    {format(new Date(invite.created_at), "dd.MM.yyyy")}
                                  </TableCell>
                                  <TableCell>
                                    {!invite.used_at && (
                                      <Button
                                        size="sm"
                                        variant={invite.is_active ? "destructive" : "outline"}
                                        onClick={() => toggleInviteStatus(invite.id, invite.is_active)}
                                        disabled={togglingInvite === invite.id}
                                      >
                                        {togglingInvite === invite.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <>
                                            <Power className="h-4 w-4 mr-1" />
                                            {invite.is_active ? "Деактивувати" : "Активувати"}
                                          </>
                                        )}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </CollapsibleContent>
                    </Collapsible>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Group by team
            <div className="space-y-4">
              {(() => {
                const teamGroups = invites.reduce((acc, invite) => {
                  const teamKey = invite.referrer_team_id || "no_team";
                  const teamName = invite.referrer_team_name || "Без команди";
                  if (!acc[teamKey]) {
                    acc[teamKey] = { name: teamName, invites: [] };
                  }
                  acc[teamKey].invites.push(invite);
                  return acc;
                }, {} as Record<string, { name: string; invites: ReferralInvite[] }>);
                
                return Object.entries(teamGroups).map(([teamKey, group]) => {
                  const isExpanded = expandedGroups.has(teamKey);
                  const activeCount = group.invites.filter(i => i.is_active && !i.used_at).length;
                  const usedCount = group.invites.filter(i => i.used_at).length;
                  
                  return (
                    <Card key={teamKey}>
                      <Collapsible open={isExpanded} onOpenChange={(open) => {
                        const newSet = new Set(expandedGroups);
                        if (open) newSet.add(teamKey);
                        else newSet.delete(teamKey);
                        setExpandedGroups(newSet);
                      }}>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {isExpanded ? (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                )}
                                <span className="font-medium">{group.name}</span>
                                <span className="text-sm text-muted-foreground">
                                  {group.invites.length} кодів
                                </span>
                              </div>
                              <div className="flex gap-2">
                                {activeCount > 0 && (
                                  <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                                    {activeCount} активних
                                  </Badge>
                                )}
                                {usedCount > 0 && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                    {usedCount} використано
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Код</TableHead>
                                  <TableHead>Реферер</TableHead>
                                  <TableHead>Запрошена команда</TableHead>
                                  <TableHead>Генерацій</TableHead>
                                  <TableHead>Статус</TableHead>
                                  <TableHead>Дата</TableHead>
                                  <TableHead>Дії</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.invites.map((invite) => (
                                  <TableRow key={invite.id}>
                                    <TableCell className="font-mono font-medium whitespace-nowrap">{invite.code}</TableCell>
                                    <TableCell>{invite.referrer_email}</TableCell>
                                    <TableCell>{invite.invited_team_name || "-"}</TableCell>
                                    <TableCell>
                                      {invite.invited_team_id ? (
                                        <div className="flex items-center gap-1">
                                          <span>{invite.invited_generations}</span>
                                          <span className="text-muted-foreground">/ {settings?.milestone_generations}</span>
                                          {invite.milestone_reached && (
                                            <Check className="h-4 w-4 text-green-500" />
                                          )}
                                        </div>
                                      ) : "-"}
                                    </TableCell>
                                    <TableCell>
                                      {invite.used_at ? (
                                        <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                                          Використано
                                        </Badge>
                                      ) : invite.is_active ? (
                                        <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                                          Активний
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline">Неактивний</Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                      {format(new Date(invite.created_at), "dd.MM.yyyy")}
                                    </TableCell>
                                    <TableCell>
                                      {!invite.used_at && (
                                        <Button
                                          size="sm"
                                          variant={invite.is_active ? "destructive" : "outline"}
                                          onClick={() => toggleInviteStatus(invite.id, invite.is_active)}
                                          disabled={togglingInvite === invite.id}
                                        >
                                          {togglingInvite === invite.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <>
                                              <Power className="h-4 w-4 mr-1" />
                                              {invite.is_active ? "Деактивувати" : "Активувати"}
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                });
              })()}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Налаштування реферальної програми</span>
                {!editingSettings ? (
                  <Button variant="outline" size="sm" onClick={() => setEditingSettings(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Редагувати
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingSettings(false)}>
                      Скасувати
                    </Button>
                    <Button size="sm" onClick={saveSettings} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Зберегти
                    </Button>
                  </div>
                )}
              </CardTitle>
              <CardDescription>
                Налаштуйте суми винагород та умови реферальної програми
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Винагорода за запрошення ($)</Label>
                  <Input
                    type="number"
                    value={settingsForm.invite_reward}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, invite_reward: parseFloat(e.target.value) || 0 }))}
                    disabled={!editingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Сума, яку отримує реферер за кожне успішне запрошення
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Винагорода за досягнення ($)</Label>
                  <Input
                    type="number"
                    value={settingsForm.milestone_reward}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, milestone_reward: parseFloat(e.target.value) || 0 }))}
                    disabled={!editingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Бонус за досягнення цільової кількості генерацій
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Кількість генерацій для досягнення</Label>
                  <Input
                    type="number"
                    value={settingsForm.milestone_generations}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, milestone_generations: parseInt(e.target.value) || 0 }))}
                    disabled={!editingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Скільки генерацій має зробити запрошена команда
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Бонус нового користувача ($)</Label>
                  <Input
                    type="number"
                    value={settingsForm.new_user_bonus}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, new_user_bonus: parseFloat(e.target.value) || 0 }))}
                    disabled={!editingSettings}
                  />
                  <p className="text-xs text-muted-foreground">
                    Бонус на баланс для кожного нового користувача
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Ліміт реферальних кодів за замовчуванням</Label>
                  <Input
                    type="number"
                    value={settingsForm.default_max_referral_invites}
                    onChange={(e) => setSettingsForm(prev => ({ ...prev, default_max_referral_invites: parseInt(e.target.value) || 4 }))}
                    disabled={!editingSettings}
                    min={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Максимальна кількість активних реферальних кодів для нових команд
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Process Reward Dialog */}
      <Dialog open={!!selectedReward} onOpenChange={() => setSelectedReward(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Обробка винагороди</DialogTitle>
          </DialogHeader>
          
          {selectedReward && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Користувач:</span>
                  <p className="font-medium">{selectedReward.user_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Команда:</span>
                  <p className="font-medium">{selectedReward.team_name || "-"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Тип:</span>
                  <p className="font-medium">{getRewardTypeLabel(selectedReward.reward_type)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Сума:</span>
                  <p className="font-medium text-lg">${selectedReward.amount.toFixed(2)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Коментар (необов'язково)</Label>
                <Textarea
                  value={adminComment}
                  onChange={(e) => setAdminComment(e.target.value)}
                  placeholder="Додайте коментар..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => processReward("reject")}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
              Відхилити
            </Button>
            <Button
              onClick={() => processReward("approve")}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Схвалити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invite for Team Dialog */}
      <Dialog open={showCreateInviteDialog} onOpenChange={setShowCreateInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Створити реферальний код для команди</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Оберіть команду</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger>
                  <SelectValue placeholder="Виберіть команду..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Код буде прив'язаний до власника обраної команди
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateInviteDialog(false)}>
              Скасувати
            </Button>
            <Button onClick={createInviteForTeam} disabled={creatingInvite || !selectedTeamId}>
              {creatingInvite ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Створити код
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
