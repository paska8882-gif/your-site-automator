import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { Switch } from "@/components/ui/switch";
import { 
  Users, 
  UserPlus,
  Loader2,
  Search,
  Crown,
  Ban,
  ShieldCheck,
  Pencil,
  Check,
  X,
  UserCog,
  KeyRound,
  Zap,
  Clock,
  UserCheck,
  UserX,
  Ticket,
  LayoutGrid
} from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email?: string;
  created_at: string;
  is_blocked: boolean;
  max_concurrent_generations: number;
}

interface Team {
  id: string;
  name: string;
}

interface TeamMembership {
  team_id: string;
  team_name: string;
  role: TeamRole;
}

interface UserWithRoles extends UserProfile {
  isAdmin: boolean;
  teams: TeamMembership[];
}

interface PendingMember {
  id: string;
  user_id: string;
  team_id: string;
  team_name: string;
  display_name: string | null;
  role: TeamRole;
  invite_code: string | null;
  created_at: string;
}

export const AdminUsersManager = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  
  const roleLabels: Record<TeamRole, string> = {
    owner: t("team.owner"),
    team_lead: t("team.teamLead"),
    buyer: t("team.buyer"),
    tech_dev: t("team.techDev")
  };
  const [teams, setTeams] = useState<Team[]>([]);
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTeamId, setFilterTeamId] = useState<string>("all");
  const [groupByTeam, setGroupByTeam] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  
  // Approve pending dialog
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [pendingToApprove, setPendingToApprove] = useState<PendingMember | null>(null);
  const [approveTeam, setApproveTeam] = useState<string>("");
  const [approveRole, setApproveRole] = useState<TeamRole>("buyer");
  
  // Assign to team dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("buyer");
  const [assigning, setAssigning] = useState(false);

  // Edit display name
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Edit max concurrent generations
  const [editingGenLimitUserId, setEditingGenLimitUserId] = useState<string | null>(null);
  const [editGenLimit, setEditGenLimit] = useState(30);
  const [savingGenLimit, setSavingGenLimit] = useState(false);

  // Reset password dialog
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserWithRoles | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch user emails from edge function
  const fetchUserEmails = async (userIds: string[]): Promise<Record<string, string>> => {
    if (userIds.length === 0) return {};
    
    try {
      const { data, error } = await supabase.functions.invoke("get-user-emails", {
        body: { user_ids: userIds }
      });
      
      if (error) {
        console.error("Error fetching emails:", error);
        return {};
      }
      
      return data?.emails || {};
    } catch (e) {
      console.error("Failed to fetch emails:", e);
      return {};
    }
  };

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name, created_at, is_blocked, max_concurrent_generations")
      .order("created_at", { ascending: false });

    // Fetch all admin roles
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");

    // Fetch all teams
    const { data: teamsData } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");

    // Fetch all team memberships (approved)
    const { data: membershipsData } = await supabase
      .from("team_members")
      .select("user_id, team_id, role")
      .eq("status", "approved");

    // Fetch pending team members with invite codes
    const { data: pendingData } = await supabase
      .from("team_members")
      .select("id, user_id, team_id, role, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const teamsMap = new Map(teamsData?.map(t => [t.id, t.name]) || []);
    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p.display_name]) || []);
    
    // Fetch invite codes for pending members
    const pendingUserIds = pendingData?.map(p => p.user_id) || [];
    
    const { data: inviteCodesData } = await supabase
      .from("invite_codes")
      .select("used_by, team_id, code")
      .in("used_by", pendingUserIds.length > 0 ? pendingUserIds : ['00000000-0000-0000-0000-000000000000']);

    // Create map of user+team -> invite code
    const inviteCodeMap = new Map<string, string>();
    inviteCodesData?.forEach(ic => {
      if (ic.used_by && ic.team_id) {
        inviteCodeMap.set(`${ic.used_by}_${ic.team_id}`, ic.code);
      }
    });

    // Fetch emails for all users
    const allUserIds = profilesData?.map(p => p.user_id) || [];
    const emailsMap = await fetchUserEmails(allUserIds);

    // Build pending members list
    const pendingMembersList: PendingMember[] = (pendingData || []).map(pm => ({
      id: pm.id,
      user_id: pm.user_id,
      team_id: pm.team_id,
      team_name: teamsMap.get(pm.team_id) || t("admin.unknownTeam"),
      display_name: profilesMap.get(pm.user_id) || null,
      role: pm.role as TeamRole,
      invite_code: inviteCodeMap.get(`${pm.user_id}_${pm.team_id}`) || null,
      created_at: pm.created_at
    }));

    // Group memberships by user
    const userMemberships: Record<string, TeamMembership[]> = {};
    membershipsData?.forEach(m => {
      if (!userMemberships[m.user_id]) {
        userMemberships[m.user_id] = [];
      }
      userMemberships[m.user_id].push({
        team_id: m.team_id,
        team_name: teamsMap.get(m.team_id) || t("admin.unknownTeam"),
        role: m.role as TeamRole
      });
    });

    const usersWithRoles: UserWithRoles[] = (profilesData || []).map(profile => ({
      ...profile,
      email: emailsMap[profile.user_id] || undefined,
      max_concurrent_generations: (profile as any).max_concurrent_generations ?? 30,
      isAdmin: adminUserIds.has(profile.user_id),
      teams: userMemberships[profile.user_id] || []
    }));

    setUsers(usersWithRoles);
    setTeams(teamsData || []);
    setPendingMembers(pendingMembersList);
    setLoading(false);
  };

  const openApproveDialog = (member: PendingMember) => {
    setPendingToApprove(member);
    setApproveTeam(member.team_id);
    setApproveRole(member.role);
    setApproveDialogOpen(true);
  };

  const handleApprovePending = async () => {
    if (!pendingToApprove) return;
    
    setApprovingId(pendingToApprove.id);
    try {
      // If team changed, need to update team_id as well
      const updateData: any = { 
        status: "approved",
        approved_at: new Date().toISOString(),
        role: approveRole
      };
      
      if (approveTeam !== pendingToApprove.team_id) {
        updateData.team_id = approveTeam;
      }
      
      const { error } = await supabase
        .from("team_members")
        .update(updateData)
        .eq("id", pendingToApprove.id);

      if (error) throw error;

      const teamName = teams.find(t => t.id === approveTeam)?.name || t("admin.unknownTeam");
      
      toast({
        title: t("common.success"),
        description: `${pendingToApprove.display_name || pendingToApprove.user_id.slice(0, 8)} ${t("admin.addedTo")} ${teamName} ${t("admin.asRole")} ${roleLabels[approveRole]}`
      });
      
      setApproveDialogOpen(false);
      setPendingToApprove(null);
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.approveError"),
        variant: "destructive"
      });
    }
    setApprovingId(null);
  };

  const handleRejectPending = async (member: PendingMember) => {
    setRejectingId(member.id);
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("id", member.id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: `${t("admin.requestRejected")}: ${member.display_name || member.user_id.slice(0, 8)}`
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.rejectError"),
        variant: "destructive"
      });
    }
    setRejectingId(null);
  };

  const handleAssignToTeam = async () => {
    if (!selectedUser || !selectedTeam) return;

    setAssigning(true);
    try {
      // Check if already a member
      const existingMembership = selectedUser.teams.find(t => t.team_id === selectedTeam);
      
      if (existingMembership) {
        // Update role
        const { error } = await supabase
          .from("team_members")
          .update({ role: selectedRole })
          .eq("user_id", selectedUser.user_id)
          .eq("team_id", selectedTeam);

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: `${t("admin.roleUpdated")} ${roleLabels[selectedRole]}`
        });
      } else {
        // Add to team
        const { error } = await supabase
          .from("team_members")
          .insert({
            user_id: selectedUser.user_id,
            team_id: selectedTeam,
            role: selectedRole,
            status: "approved",
            approved_at: new Date().toISOString()
          });

        if (error) throw error;

        toast({
          title: t("common.success"),
          description: `${t("admin.userAddedToTeam")} ${roleLabels[selectedRole]}`
        });
      }

      setAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedTeam("");
      setSelectedRole("buyer");
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.assignError"),
        variant: "destructive"
      });
    }
    setAssigning(false);
  };

  const handleRemoveFromTeam = async (user: UserWithRoles, teamId: string) => {
    try {
      const { error } = await supabase
        .from("team_members")
        .delete()
        .eq("user_id", user.user_id)
        .eq("team_id", teamId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.userRemovedFromTeam")
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.removeError"),
        variant: "destructive"
      });
    }
  };

  const toggleBlockUser = async (user: UserWithRoles) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_blocked: !user.is_blocked })
        .eq("user_id", user.user_id);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: user.is_blocked 
          ? t("admin.userUnblocked") 
          : t("admin.userBlocked")
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.blockError"),
        variant: "destructive"
      });
    }
  };

  const openAssignDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setAssignDialogOpen(true);
  };

  const startEditName = (user: UserWithRoles) => {
    setEditingUserId(user.user_id);
    setEditDisplayName(user.display_name || "");
  };

  const cancelEditName = () => {
    setEditingUserId(null);
    setEditDisplayName("");
  };

  const saveDisplayName = async (userId: string) => {
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: editDisplayName.trim() || null })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.nameUpdated")
      });

      setEditingUserId(null);
      setEditDisplayName("");
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.nameError"),
        variant: "destructive"
      });
    }
    setSavingName(false);
  };

  const startEditGenLimit = (user: UserWithRoles) => {
    setEditingGenLimitUserId(user.user_id);
    setEditGenLimit(user.max_concurrent_generations);
  };

  const cancelEditGenLimit = () => {
    setEditingGenLimitUserId(null);
    setEditGenLimit(30);
  };

  const saveGenLimit = async (userId: string) => {
    setSavingGenLimit(true);
    try {
      const limitValue = Math.max(1, Math.min(100, editGenLimit));
      const { error } = await supabase
        .from("profiles")
        .update({ max_concurrent_generations: limitValue })
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: `${t("admin.limitUpdated")} ${limitValue}`
      });

      setEditingGenLimitUserId(null);
      setEditGenLimit(30);
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.limitError"),
        variant: "destructive"
      });
    }
    setSavingGenLimit(false);
  };

  const openResetPasswordDialog = (user: UserWithRoles) => {
    setResetPasswordUser(user);
    setNewPassword("");
    setResetPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUser || !newPassword) return;
    
    if (newPassword.length < 6) {
      toast({
        title: t("common.error"),
        description: t("admin.passwordMinLength"),
        variant: "destructive"
      });
      return;
    }

    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error(t("admin.loginFirst"));
      }

      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: {
          userId: resetPasswordUser.user_id,
          newPassword,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        throw error;
      }

      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || "Failed to reset password");
      }

      toast({
        title: t("common.success"),
        description: `${t("admin.passwordChanged")}: ${resetPasswordUser.display_name || resetPasswordUser.user_id.slice(0, 8)}`
      });

      setResetPasswordDialogOpen(false);
      setResetPasswordUser(null);
      setNewPassword("");
    } catch (error) {
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("admin.passwordError"),
        variant: "destructive"
      });
    }
    setResettingPassword(false);
  };

  const filteredUsers = users.filter(user => {
    // Team filter
    if (filterTeamId === "no_team") {
      if (user.teams.length > 0) return false;
    } else if (filterTeamId !== "all") {
      if (!user.teams.some(t => t.team_id === filterTeamId)) return false;
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !(user.display_name && user.display_name.toLowerCase().includes(query)) &&
        !user.user_id.toLowerCase().includes(query) &&
        !(user.email && user.email.toLowerCase().includes(query))
      ) return false;
    }
    return true;
  });

  // Group users by team for grouped view
  const groupedUsers = groupByTeam ? (() => {
    const groups: Record<string, { teamName: string; users: UserWithRoles[] }> = {};
    const noTeamUsers: UserWithRoles[] = [];
    
    filteredUsers.forEach(user => {
      if (user.teams.length === 0) {
        noTeamUsers.push(user);
      } else {
        user.teams.forEach(team => {
          if (filterTeamId !== "all" && filterTeamId !== "no_team" && team.team_id !== filterTeamId) return;
          if (!groups[team.team_id]) {
            groups[team.team_id] = { teamName: team.team_name, users: [] };
          }
          if (!groups[team.team_id].users.find(u => u.user_id === user.user_id)) {
            groups[team.team_id].users.push(user);
          }
        });
      }
    });
    
    return { groups, noTeamUsers };
  })() : null;

  const stats = {
    total: users.length,
    admins: users.filter(u => u.isAdmin).length,
    withTeam: users.filter(u => u.teams.length > 0).length,
    blocked: users.filter(u => u.is_blocked).length,
    pending: pendingMembers.length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AdminPageHeader 
        icon={UserCog} 
        title={t("admin.usersTitle")} 
        description={t("admin.usersDescription")} 
      />
      {/* Stats + Search row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{t("admin.usersStats.total")}:</span>
          <span className="text-sm font-bold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <Crown className="h-3 w-3 text-yellow-500" />
          <span className="text-xs text-muted-foreground">{t("admin.usersStats.admins")}:</span>
          <span className="text-sm font-bold text-yellow-500">{stats.admins}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span className="text-xs text-muted-foreground">{t("admin.usersStats.inTeams")}:</span>
          <span className="text-sm font-bold text-green-500">{stats.withTeam}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <Ban className="h-3 w-3 text-destructive" />
          <span className="text-xs text-muted-foreground">{t("admin.usersStats.blocked")}:</span>
          <span className="text-sm font-bold text-destructive">{stats.blocked}</span>
        </div>
        {stats.pending > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-orange-500/10 border-orange-500/30">
            <Clock className="h-3 w-3 text-orange-500" />
            <span className="text-xs text-muted-foreground">{t("admin.usersStats.pending")}:</span>
            <span className="text-sm font-bold text-orange-500">{stats.pending}</span>
          </div>
        )}
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder={t("admin.searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs w-40"
          />
        </div>
      </div>

      {/* Pending Members Section */}
      {pendingMembers.length > 0 && (
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              {t("admin.usersPendingSection")} ({pendingMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.user")}</TableHead>
                    <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.team")}</TableHead>
                    <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.role")}</TableHead>
                    <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.inviteCode")}</TableHead>
                    <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.requestDate")}</TableHead>
                    <TableHead className="text-[10px] py-1 text-right">{t("admin.usersTableHeaders.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingMembers.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="py-1.5">
                        <div>
                          <div className="font-medium text-xs">
                            {member.display_name || t("admin.usersNoName")}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {member.user_id.slice(0, 8)}...
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {member.team_name}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1.5">
                        <span className="text-xs">{roleLabels[member.role]}</span>
                      </TableCell>
                      <TableCell className="py-1.5">
                        {member.invite_code ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            <Ticket className="h-2.5 w-2.5 mr-1" />
                            {member.invite_code}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-[10px]">
                        {new Date(member.created_at).toLocaleDateString("uk-UA")}
                      </TableCell>
                      <TableCell className="py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-6 text-[10px] px-1.5 bg-green-600 hover:bg-green-700"
                            onClick={() => openApproveDialog(member)}
                            disabled={approvingId === member.id || rejectingId === member.id}
                          >
                            <UserCheck className="h-3 w-3 mr-0.5" />
                            {t("admin.usersApprove")}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-6 text-[10px] px-1.5"
                            onClick={() => handleRejectPending(member)}
                            disabled={approvingId === member.id || rejectingId === member.id}
                          >
                            {rejectingId === member.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <UserX className="h-3 w-3 mr-0.5" />
                                {t("admin.usersReject")}
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users Table */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">{t("admin.users")} ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.user")}</TableHead>
                  <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.teams")}</TableHead>
                  <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.limit")}</TableHead>
                  <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.status")}</TableHead>
                  <TableHead className="text-[10px] py-1">{t("admin.usersTableHeaders.date")}</TableHead>
                  <TableHead className="text-[10px] py-1 text-right">{t("admin.usersTableHeaders.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.user_id}>
                    <TableCell className="py-1.5">
                      <div>
                        {editingUserId === user.user_id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editDisplayName}
                              onChange={(e) => setEditDisplayName(e.target.value)}
                              className="h-6 w-32 text-xs"
                              placeholder="Ім'я"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveDisplayName(user.user_id);
                                if (e.key === "Escape") cancelEditName();
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => saveDisplayName(user.user_id)}
                              disabled={savingName}
                            >
                              {savingName ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3 text-green-500" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={cancelEditName}
                              disabled={savingName}
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="font-medium text-xs flex items-center gap-1">
                            {user.display_name || t("admin.usersNoName")}
                            {user.isAdmin && (
                              <Crown className="h-3 w-3 text-yellow-500" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0"
                              onClick={() => startEditName(user)}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {user.email || user.user_id.slice(0, 8) + "..."}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {user.teams.length > 0 ? (
                        <div className="flex flex-wrap gap-0.5">
                          {user.teams.map(team => (
                            <Badge 
                              key={team.team_id} 
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground text-[10px] px-1 py-0"
                              onClick={() => handleRemoveFromTeam(user, team.team_id)}
                              title="Видалити"
                            >
                              {team.team_name}
                              <span className="ml-0.5 opacity-70">
                                ({roleLabels[team.role]})
                              </span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">{t("admin.usersNoTeams")}</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      {editingGenLimitUserId === user.user_id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            value={editGenLimit}
                            onChange={(e) => setEditGenLimit(parseInt(e.target.value) || 1)}
                            min={1}
                            max={100}
                            className="h-6 w-14 text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveGenLimit(user.user_id);
                              if (e.key === "Escape") cancelEditGenLimit();
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={() => saveGenLimit(user.user_id)}
                            disabled={savingGenLimit}
                          >
                            {savingGenLimit ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 p-0"
                            onClick={cancelEditGenLimit}
                            disabled={savingGenLimit}
                          >
                            <X className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium">{user.max_concurrent_generations}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0"
                            onClick={() => startEditGenLimit(user)}
                          >
                            <Pencil className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1">
                        {user.isAdmin && (
                          <Badge className="bg-yellow-500 text-black text-[10px] px-1 py-0">{t("admin.usersStatusAdmin")}</Badge>
                        )}
                        {user.is_blocked && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">{t("admin.usersStatusBlocked")}</Badge>
                        )}
                        {!user.isAdmin && !user.is_blocked && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{t("admin.usersStatusActive")}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 text-[10px]">
                      {new Date(user.created_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                    <TableCell className="py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-1.5"
                          onClick={() => openResetPasswordDialog(user)}
                          title={t("admin.usersResetPassword")}
                        >
                          <KeyRound className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-1.5"
                          onClick={() => openAssignDialog(user)}
                        >
                          <UserPlus className="h-3 w-3 mr-0.5" />
                          {t("admin.usersTeam")}
                        </Button>
                        <Button
                          variant={user.is_blocked ? "default" : "destructive"}
                          size="sm"
                          className="h-6 text-[10px] px-1.5"
                          onClick={() => toggleBlockUser(user)}
                        >
                          {user.is_blocked ? (
                            <>
                              <ShieldCheck className="h-3 w-3 mr-0.5" />
                              {t("admin.usersUnblock")}
                            </>
                          ) : (
                            <>
                              <Ban className="h-3 w-3 mr-0.5" />
                              {t("admin.usersBlock")}
                            </>
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Assign to Team Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.usersAssignDialog.title")}: {selectedUser?.display_name || selectedUser?.user_id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("admin.usersAssignDialog.team")}</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.usersAssignDialog.selectTeam")} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                      {selectedUser?.teams.find(t => t.team_id === team.id) && (
                        <span className="ml-2 text-muted-foreground">({t("admin.usersAssignDialog.alreadyMember")})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("admin.usersAssignDialog.role")}</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{t("team.owner")}</SelectItem>
                  <SelectItem value="team_lead">{t("team.teamLead")}</SelectItem>
                  <SelectItem value="buyer">{t("team.buyer")}</SelectItem>
                  <SelectItem value="tech_dev">{t("team.techDev")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleAssignToTeam} 
              disabled={!selectedTeam || assigning}
              className="w-full"
            >
              {assigning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              {selectedUser?.teams.find(t => t.team_id === selectedTeam) 
                ? t("admin.usersAssignDialog.updateRole") 
                : t("admin.usersAssignDialog.assign")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve Pending Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.usersApproveDialog.title")}: {pendingToApprove?.display_name || pendingToApprove?.user_id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {pendingToApprove?.invite_code && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <Ticket className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{t("admin.usersApproveDialog.inviteCode")}: <span className="font-mono font-medium">{pendingToApprove.invite_code}</span></span>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{t("admin.usersApproveDialog.team")}</label>
              <Select value={approveTeam} onValueChange={setApproveTeam}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.usersApproveDialog.selectTeam")} />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                      {team.id === pendingToApprove?.team_id && (
                        <span className="ml-2 text-muted-foreground">({t("admin.usersApproveDialog.original")})</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">{t("admin.usersApproveDialog.role")}</label>
              <Select value={approveRole} onValueChange={(v) => setApproveRole(v as TeamRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">{t("team.owner")}</SelectItem>
                  <SelectItem value="team_lead">{t("team.teamLead")}</SelectItem>
                  <SelectItem value="buyer">{t("team.buyer")}</SelectItem>
                  <SelectItem value="tech_dev">{t("team.techDev")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleApprovePending} 
              disabled={!approveTeam || approvingId === pendingToApprove?.id}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {approvingId === pendingToApprove?.id ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserCheck className="h-4 w-4 mr-2" />
              )}
              {t("admin.usersApproveDialog.approve")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin.usersResetPassword")}: {resetPasswordUser?.display_name || resetPasswordUser?.user_id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("admin.usersNewPassword")}</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("admin.usersMinPassword")}
                className="mt-1"
              />
            </div>
            <Button 
              onClick={handleResetPassword} 
              disabled={!newPassword || newPassword.length < 6 || resettingPassword}
              className="w-full"
            >
              {resettingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              {t("admin.usersResetPassword")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
