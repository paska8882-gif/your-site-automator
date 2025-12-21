import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Gift, Copy, Check, Users, DollarSign, Loader2, Target } from "lucide-react";
import { format } from "date-fns";

interface ReferralSettings {
  invite_reward: number;
  milestone_reward: number;
  milestone_generations: number;
  new_user_bonus: number;
}

interface ReferralInvite {
  id: string;
  code: string;
  invited_user_id: string | null;
  invited_team_id: string | null;
  used_at: string | null;
  created_at: string;
  is_active: boolean;
  milestone_reached: boolean;
  invited_team_name?: string;
  invited_generations?: number;
}

interface ReferralReward {
  id: string;
  reward_type: string;
  amount: number;
  status: string;
  created_at: string;
  admin_comment: string | null;
}

export function ReferralProgram() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);
  const [invites, setInvites] = useState<ReferralInvite[]>([]);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [userTeamId, setUserTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch settings
    const { data: settingsData } = await supabase
      .from("referral_settings")
      .select("*")
      .single();
    
    if (settingsData) {
      setSettings(settingsData);
    }

    // Fetch user's team
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user!.id)
      .eq("status", "approved")
      .maybeSingle();
    
    if (membership) {
      setUserTeamId(membership.team_id);
    }

    // Fetch user's referral invites
    const { data: invitesData } = await supabase
      .from("referral_invites")
      .select("*")
      .eq("referrer_user_id", user!.id)
      .order("created_at", { ascending: false });
    
    if (invitesData) {
      // Enrich with invited team info
      const enrichedInvites = await Promise.all(invitesData.map(async (invite) => {
        let invited_team_name = null;
        let invited_generations = 0;

        if (invite.invited_team_id) {
          const { data: teamData } = await supabase
            .from("teams")
            .select("name")
            .eq("id", invite.invited_team_id)
            .single();
          invited_team_name = teamData?.name || null;

          // Count generations for milestone tracking
          const { count } = await supabase
            .from("generation_history")
            .select("*", { count: "exact", head: true })
            .eq("team_id", invite.invited_team_id)
            .eq("status", "completed");
          invited_generations = count || 0;
        }

        return { ...invite, invited_team_name, invited_generations };
      }));

      setInvites(enrichedInvites);
    }

    // Fetch user's rewards
    const { data: rewardsData } = await supabase
      .from("referral_rewards")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    
    if (rewardsData) {
      setRewards(rewardsData);
    }

    setLoading(false);
  };

  const generateCode = async () => {
    if (!user) return;
    
    setGenerating(true);
    
    // Generate unique code
    const code = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    
    const { error } = await supabase
      .from("referral_invites")
      .insert({
        code,
        referrer_user_id: user.id,
        referrer_team_id: userTeamId
      });
    
    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося створити код",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Код створено",
        description: `Ваш реферальний код: ${code}`
      });
      fetchData();
    }
    
    setGenerating(false);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({
      title: "Скопійовано",
      description: "Код скопійовано в буфер обміну"
    });
    setTimeout(() => setCopiedCode(null), 2000);
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

  const totalEarned = rewards
    .filter(r => r.status === "approved")
    .reduce((sum, r) => sum + r.amount, 0);

  const pendingRewards = rewards
    .filter(r => r.status === "pending")
    .reduce((sum, r) => sum + r.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gift className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">За запрошення</p>
                <p className="text-2xl font-bold">${settings?.invite_reward || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Target className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">За {settings?.milestone_generations || 0} генерацій</p>
                <p className="text-2xl font-bold">${settings?.milestone_reward || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <DollarSign className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ви заробили</p>
                <p className="text-2xl font-bold">${totalEarned.toFixed(2)}</p>
                {pendingRewards > 0 && (
                  <p className="text-xs text-muted-foreground">+ ${pendingRewards.toFixed(2)} очікує</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Запросити команду
          </CardTitle>
          <CardDescription>
            Згенеруйте унікальний код для запрошення нової команди. 
            Ви отримаєте ${settings?.invite_reward || 0} після схвалення адміністратором.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={generateCode} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Генерація...
              </>
            ) : (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Згенерувати реферальний код
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Active Codes */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Мої реферальні коди</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Код</TableHead>
                  <TableHead>Створено</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Команда</TableHead>
                  <TableHead>Генерацій</TableHead>
                  <TableHead>Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-mono font-medium">{invite.code}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(invite.created_at), "dd.MM.yyyy")}
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
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Неактивний
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {invite.invited_team_name || "-"}
                    </TableCell>
                    <TableCell>
                      {invite.invited_team_id ? (
                        <div className="flex items-center gap-1">
                          <span>{invite.invited_generations}</span>
                          <span className="text-muted-foreground">/ {settings?.milestone_generations}</span>
                          {invite.milestone_reached && (
                            <Check className="h-4 w-4 text-green-500 ml-1" />
                          )}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {!invite.used_at && invite.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyCode(invite.code)}
                        >
                          {copiedCode === invite.code ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rewards History */}
      {rewards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Історія винагород</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Сума</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Коментар</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((reward) => (
                  <TableRow key={reward.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(reward.created_at), "dd.MM.yyyy HH:mm")}
                    </TableCell>
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
      )}
    </div>
  );
}
