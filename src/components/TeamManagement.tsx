import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  Copy, 
  Check, 
  Loader2,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
  Ticket
} from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";
type MemberStatus = "pending" | "approved" | "rejected";

interface Team {
  id: string;
  name: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  status: MemberStatus;
  created_at: string;
  approved_at: string | null;
  profile?: {
    display_name: string | null;
  };
}

interface InviteCode {
  id: string;
  code: string;
  team_id: string;
  assigned_role: TeamRole;
  used_by: string | null;
  is_active: boolean;
  created_at: string;
}

const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  team_lead: "Team Lead",
  buyer: "Buyer",
  tech_dev: "Tech Dev"
};

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const TeamManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newInviteRole, setNewInviteRole] = useState<TeamRole>("team_lead");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyTeams();
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      fetchTeamData(selectedTeam);
    }
  }, [selectedTeam]);

  const fetchMyTeams = async () => {
    if (!user) return;
    
    // Get teams where user is owner
    const { data: memberData } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .eq("status", "approved");

    if (memberData && memberData.length > 0) {
      const teamIds = memberData.map(m => m.team_id);
      const { data: teamsData } = await supabase
        .from("teams")
        .select("*")
        .in("id", teamIds);

      setTeams(teamsData || []);
      if (teamsData && teamsData.length > 0 && !selectedTeam) {
        setSelectedTeam(teamsData[0].id);
      }
    }
    setLoading(false);
  };

  const fetchTeamData = async (teamId: string) => {
    // Fetch members
    const { data: membersData } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    // Fetch profiles for members
    if (membersData) {
      const userIds = membersData.map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const membersWithProfiles = membersData.map(m => ({
        ...m,
        profile: profilesMap.get(m.user_id)
      })) as TeamMember[];

      setMembers(membersWithProfiles);
    }

    // Fetch invite codes
    const { data: codesData } = await supabase
      .from("invite_codes")
      .select("*")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });

    setInviteCodes((codesData || []) as InviteCode[]);
  };

  const handleGenerateInvite = async () => {
    if (!user || !selectedTeam) return;
    
    setGenerating(true);
    const newCode = generateCode();

    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode,
        created_by: user.id,
        team_id: selectedTeam,
        assigned_role: newInviteRole
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
        description: `${newCode} (${roleLabels[newInviteRole]})`
      });
      fetchTeamData(selectedTeam);
    }
    setGenerating(false);
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Скопійовано",
      description: code
    });
  };

  const handleApproveMember = async (memberId: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("team_members")
      .update({ 
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user.id
      })
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося затвердити",
        variant: "destructive"
      });
    } else {
      toast({ title: "Члена команди затверджено" });
      if (selectedTeam) fetchTeamData(selectedTeam);
    }
  };

  const handleRejectMember = async (memberId: string) => {
    const { error } = await supabase
      .from("team_members")
      .update({ status: "rejected" })
      .eq("id", memberId);

    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося відхилити",
        variant: "destructive"
      });
    } else {
      toast({ title: "Заявку відхилено" });
      if (selectedTeam) fetchTeamData(selectedTeam);
    }
  };

  const pendingMembers = members.filter(m => m.status === "pending");
  const approvedMembers = members.filter(m => m.status === "approved");
  const activeInvites = inviteCodes.filter(c => c.is_active && !c.used_by);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>У вас немає команд</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team selector */}
      {teams.length > 1 && (
        <Select value={selectedTeam || ""} onValueChange={setSelectedTeam}>
          <SelectTrigger>
            <SelectValue placeholder="Виберіть команду" />
          </SelectTrigger>
          <SelectContent>
            {teams.map(team => (
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {selectedTeam && (
        <>
          {/* Team header */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {teams.find(t => t.id === selectedTeam)?.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg bg-muted">
                  <div className="text-lg font-bold">{approvedMembers.length}</div>
                  <div className="text-xs text-muted-foreground">Членів</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted">
                  <div className="text-lg font-bold text-yellow-500">{pendingMembers.length}</div>
                  <div className="text-xs text-muted-foreground">Очікують</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted">
                  <div className="text-lg font-bold text-green-500">{activeInvites.length}</div>
                  <div className="text-xs text-muted-foreground">Активних інвайтів</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pending members */}
          {pendingMembers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-500">
                  <Clock className="h-5 w-5" />
                  Очікують затвердження ({pendingMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingMembers.map(member => (
                  <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">
                        {member.profile?.display_name || member.user_id.slice(0, 8) + "..."}
                      </p>
                      <Badge variant="outline">{roleLabels[member.role]}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleApproveMember(member.id)}
                      >
                        <UserCheck className="h-4 w-4 mr-1" />
                        Прийняти
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectMember(member.id)}
                      >
                        <UserX className="h-4 w-4 mr-1" />
                        Відхилити
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Team members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Члени команди
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => selectedTeam && fetchTeamData(selectedTeam)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {approvedMembers.map(member => (
                <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {member.profile?.display_name || member.user_id.slice(0, 8) + "..."}
                    </span>
                    <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                      {roleLabels[member.role]}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Invite codes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Інвайт-коди
                </span>
                <div className="flex items-center gap-2">
                  <Select value={newInviteRole} onValueChange={(v) => setNewInviteRole(v as TeamRole)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team_lead">Team Lead</SelectItem>
                      <SelectItem value="buyer">Buyer</SelectItem>
                      <SelectItem value="tech_dev">Tech Dev</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleGenerateInvite} disabled={generating} size="sm">
                    {generating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Створити
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inviteCodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">Немає кодів</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {inviteCodes.map(code => (
                    <div key={code.id} className="flex items-center justify-between p-2 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <code className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {code.code}
                        </code>
                        <Badge variant="outline">{roleLabels[code.assigned_role]}</Badge>
                        {code.used_by ? (
                          <Badge variant="secondary">Використано</Badge>
                        ) : code.is_active ? (
                          <Badge variant="default" className="bg-green-500">Активний</Badge>
                        ) : (
                          <Badge variant="outline">Неактивний</Badge>
                        )}
                      </div>
                      {!code.used_by && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleCopyCode(code.code, code.id)}
                        >
                          {copiedId === code.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
