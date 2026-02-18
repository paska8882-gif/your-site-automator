import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  Plus, 
  Copy, 
  Check, 
  Loader2,
  RefreshCw,
  Eye,
  Wallet,
  UserCog,
  ExternalLink,
  Search,
  Crown,
  UserPlus,
  Ticket,
  Star
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Admin {
  user_id: string;
  display_name: string | null;
}

interface TeamMember {
  user_id: string;
  display_name: string | null;
  role: string;
}

interface Team {
  id: string;
  name: string;
  balance: number;
  credit_limit: number;
  created_at: string;
  owner_code?: string;
  members_count?: number;
  assigned_admin_ids?: string[];
  assigned_admin_names?: string[];
  owner_name?: string | null;
  has_owner?: boolean;
}

interface Transaction {
  id: string;
  site_name: string | null;
  sale_price: number | null;
  generation_cost: number | null;
  created_at: string;
  status: string;
  website_type: string | null;
  ai_model: string | null;
  user_email?: string;
}

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const AdminTeamsManager = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [teams, setTeams] = useState<Team[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [favoriteTeams, setFavoriteTeams] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("admin-favorite-teams");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOwnerDialog, setShowOwnerDialog] = useState(false);
  const [ownerDialogTeam, setOwnerDialogTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigningOwner, setAssigningOwner] = useState(false);
  
  // Add member states
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [addMemberTeam, setAddMemberTeam] = useState<Team | null>(null);
  const [allUsers, setAllUsers] = useState<{ user_id: string; display_name: string | null; email?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("buyer");
  
  // Invite code generation states
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteDialogTeam, setInviteDialogTeam] = useState<Team | null>(null);
  const [inviteRole, setInviteRole] = useState<string>("buyer");
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [generatedInviteCode, setGeneratedInviteCode] = useState<string | null>(null);

  const filteredTeams = teams
    .filter(team => team.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aFav = favoriteTeams.has(a.id);
      const bFav = favoriteTeams.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const toggleFavorite = (teamId: string) => {
    setFavoriteTeams(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      localStorage.setItem("admin-favorite-teams", JSON.stringify([...next]));
      return next;
    });
  };

  useEffect(() => {
    fetchTeams();
    fetchAdmins();

    // Realtime subscription for team balance updates
    const channel = supabase
      .channel("admin-teams-balance")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams" },
        (payload) => {
          setTeams(prev => prev.map(team =>
            team.id === payload.new.id
              ? { ...team, balance: payload.new.balance, credit_limit: payload.new.credit_limit }
              : team
          ));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAdmins = async () => {
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles || adminRoles.length === 0) {
      setAdmins([]);
      return;
    }

    const adminUserIds = adminRoles.map(r => r.user_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", adminUserIds);

    setAdmins(profiles?.map(p => ({ user_id: p.user_id, display_name: p.display_name })) || []);
  };

  const fetchTeams = async () => {
    setLoading(true);
    
    const { data: teamsData, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching teams:", error);
      setLoading(false);
      return;
    }

    if (!teamsData || teamsData.length === 0) {
      setTeams([]);
      setLoading(false);
      return;
    }

    const teamIds = teamsData.map(t => t.id);

    // Batch fetch all data in parallel
    const [
      teamAdminsResult,
      inviteCodesResult,
      teamMembersResult
    ] = await Promise.all([
      // Team admins from junction table
      supabase.from("team_admins").select("team_id, admin_id").in("team_id", teamIds),
      // Invite codes for all teams
      supabase.from("invite_codes")
        .select("team_id, code")
        .in("team_id", teamIds)
        .eq("assigned_role", "owner")
        .is("used_by", null)
        .eq("is_active", true),
      // All team members with their profiles
      supabase.from("team_members")
        .select("team_id, user_id, role")
        .in("team_id", teamIds)
        .eq("status", "approved")
    ]);

    // Get admin profiles
    const allAdminIds = [...new Set((teamAdminsResult.data || []).map(r => r.admin_id))];
    let adminProfilesMap = new Map<string, string>();
    if (allAdminIds.length > 0) {
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", allAdminIds);
      (adminProfiles || []).forEach(p =>
        adminProfilesMap.set(p.user_id, p.display_name || "Без імені")
      );
    }

    // Group team admins by team
    const adminsByTeam = new Map<string, string[]>();
    (teamAdminsResult.data || []).forEach(r => {
      const existing = adminsByTeam.get(r.team_id) || [];
      existing.push(r.admin_id);
      adminsByTeam.set(r.team_id, existing);
    });

    const inviteCodesMap = new Map<string, string>();
    (inviteCodesResult.data || []).forEach(c => {
      if (c.team_id && !inviteCodesMap.has(c.team_id)) {
        inviteCodesMap.set(c.team_id, c.code);
      }
    });

    // Group members by team
    const membersByTeam = new Map<string, { user_id: string; role: string }[]>();
    (teamMembersResult.data || []).forEach(m => {
      const existing = membersByTeam.get(m.team_id) || [];
      existing.push({ user_id: m.user_id, role: m.role });
      membersByTeam.set(m.team_id, existing);
    });

    // Get owner profiles
    const ownerUserIds = [...membersByTeam.values()]
      .flat()
      .filter(m => m.role === "owner")
      .map(m => m.user_id);

    let ownerProfilesMap = new Map<string, string>();
    if (ownerUserIds.length > 0) {
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", ownerUserIds);
      
      (ownerProfiles || []).forEach(p => 
        ownerProfilesMap.set(p.user_id, p.display_name || t("admin.teamsNoName"))
      );
    }

    // Build final teams array
    const teamsWithDetails = teamsData.map(team => {
      const members = membersByTeam.get(team.id) || [];
      const owner = members.find(m => m.role === "owner");
      
      return {
        ...team,
        owner_code: inviteCodesMap.get(team.id),
        members_count: members.length,
        assigned_admin_ids: adminsByTeam.get(team.id) || [],
        assigned_admin_names: (adminsByTeam.get(team.id) || []).map(id => adminProfilesMap.get(id) || "Без імені"),
        owner_name: owner ? ownerProfilesMap.get(owner.user_id) : null,
        has_owner: !!owner
      };
    });

    setTeams(teamsWithDetails);
    setLoading(false);
  };

  const handleAssignAdmin = async (teamId: string, adminId: string, add: boolean) => {
    if (add) {
      const { error } = await supabase
        .from("team_admins")
        .insert({ team_id: teamId, admin_id: adminId });
      if (error) {
        toast({ title: t("common.error"), description: t("admin.teamsAssignAdminError"), variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("team_admins")
        .delete()
        .eq("team_id", teamId)
        .eq("admin_id", adminId);
      if (error) {
        toast({ title: t("common.error"), description: t("admin.teamsAssignAdminError"), variant: "destructive" });
        return;
      }
    }
    toast({ title: t("common.saved"), description: t("admin.teamsAdminAssigned") });
    fetchTeams();
  };

  const handleUpdateCreditLimit = async (teamId: string, creditLimit: number) => {
    const { error } = await supabase
      .from("teams")
      .update({ credit_limit: creditLimit })
      .eq("id", teamId);

    if (error) {
      toast({ title: t("common.error"), description: t("admin.teamsCreditLimitError"), variant: "destructive" });
    } else {
      // Update local state
      setTeams(teams.map(t => t.id === teamId ? { ...t, credit_limit: creditLimit } : t));
      toast({ title: t("common.saved"), description: t("admin.teamsCreditLimitSaved").replace("{amount}", creditLimit.toString()) });
    }
  };

  const fetchTeamTransactions = async (teamId: string) => {
    setLoadingTransactions(true);
    
    // Get team members
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", teamId)
      .eq("status", "approved");

    if (!members || members.length === 0) {
      setTransactions([]);
      setLoadingTransactions(false);
      return;
    }

    const userIds = members.map(m => m.user_id);

    // Get generations for team members
    const { data: generations } = await supabase
      .from("generation_history")
      .select("*")
      .in("user_id", userIds)
      .order("created_at", { ascending: false })
      .limit(100);

    // Get user emails
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);

    const transactionsWithUsers = (generations || []).map(g => ({
      ...g,
      user_email: profileMap.get(g.user_id || "") || "Unknown"
    }));

    setTransactions(transactionsWithUsers);
    setLoadingTransactions(false);
  };

  const handleViewTeam = (team: Team) => {
    // Одразу переходимо на сторінку деталей команди без проміжного діалогу
    navigate(`/admin/team/${team.id}`);
  };

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return;
    
    setCreating(true);

    const { data: team, error: teamError } = await supabase
      .from("teams")
      .insert({
        name: newTeamName.trim(),
        created_by: user.id
      })
      .select()
      .single();

    if (teamError || !team) {
      toast({
        title: t("common.error"),
        description: t("admin.teamsCreateError"),
        variant: "destructive"
      });
      setCreating(false);
      return;
    }

    const ownerCode = generateCode();
    const { error: codeError } = await supabase
      .from("invite_codes")
      .insert({
        code: ownerCode,
        created_by: user.id,
        team_id: team.id,
        assigned_role: "owner"
      });

    if (codeError) {
      toast({
        title: t("common.error"),
        description: t("admin.teamsOwnerCodeError"),
        variant: "destructive"
      });
    } else {
      toast({
        title: t("admin.teamsCreated"),
        description: t("admin.teamsOwnerCodeCreated").replace("{name}", newTeamName).replace("{code}", ownerCode)
      });
      setNewTeamName("");
      fetchTeams();
    }
    setCreating(false);
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: t("common.copied"), description: code });
  };

  const handleGenerateNewOwnerCode = async (teamId: string, teamName: string) => {
    if (!user) return;

    await supabase
      .from("invite_codes")
      .update({ is_active: false })
      .eq("team_id", teamId)
      .eq("assigned_role", "owner")
      .is("used_by", null);

    const newCode = generateCode();
    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode,
        created_by: user.id,
        team_id: teamId,
        assigned_role: "owner"
      });

    if (error) {
      toast({ title: t("common.error"), description: t("admin.teamsNewCodeError"), variant: "destructive" });
    } else {
      toast({ title: t("admin.teamsNewCodeCreated"), description: `${teamName}: ${newCode}` });
      fetchTeams();
    }
  };

  const openOwnerDialog = async (team: Team) => {
    setOwnerDialogTeam(team);
    setShowOwnerDialog(true);
    setLoadingMembers(true);
    
    // Fetch team members
    const { data: members } = await supabase
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", team.id)
      .eq("status", "approved");
    
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      
      setTeamMembers(members.map(m => ({
        user_id: m.user_id,
        display_name: profileMap.get(m.user_id) || t("admin.teamsNoName"),
        role: m.role
      })));
    } else {
      setTeamMembers([]);
    }
    
    setLoadingMembers(false);
  };

  const handleAssignOwner = async (userId: string) => {
    if (!ownerDialogTeam) return;
    
    setAssigningOwner(true);
    
    // Remove owner role from all current owners
    await supabase
      .from("team_members")
      .update({ role: "buyer" })
      .eq("team_id", ownerDialogTeam.id)
      .eq("role", "owner");
    
    // Set new owner
    const { error } = await supabase
      .from("team_members")
      .update({ role: "owner" })
      .eq("team_id", ownerDialogTeam.id)
      .eq("user_id", userId);
    
    if (error) {
      toast({ title: t("common.error"), description: t("admin.teamsAssignOwnerError"), variant: "destructive" });
    } else {
      toast({ title: t("common.saved"), description: t("admin.teamsOwnerAssigned") });
      setShowOwnerDialog(false);
      setOwnerDialogTeam(null);
      fetchTeams();
    }
    
    setAssigningOwner(false);
  };

  const openAddMemberDialog = async (team: Team) => {
    setAddMemberTeam(team);
    setShowAddMemberDialog(true);
    setLoadingUsers(true);
    setSelectedUserId("");
    setSelectedRole("buyer");
    setUserSearchQuery("");
    
    // Fetch all users from profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .order("display_name", { ascending: true });
    
    // Fetch existing team members to exclude them
    const { data: existingMembers } = await supabase
      .from("team_members")
      .select("user_id")
      .eq("team_id", team.id)
      .neq("status", "rejected");
    
    const existingUserIds = new Set(existingMembers?.map(m => m.user_id) || []);
    
    // Filter out users already in the team
    const availableUsers = (profiles || []).filter(p => !existingUserIds.has(p.user_id));
    
    setAllUsers(availableUsers);
    setLoadingUsers(false);
  };

  const handleAddMember = async () => {
    if (!addMemberTeam || !selectedUserId) return;
    
    setAddingMember(true);
    
    const { error } = await supabase
      .from("team_members")
      .insert({
        team_id: addMemberTeam.id,
        user_id: selectedUserId,
        role: selectedRole as "owner" | "team_lead" | "buyer" | "tech_dev",
        status: "approved" as const,
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      });
    
    if (error) {
      toast({ title: t("common.error"), description: t("admin.teamsAddMemberError"), variant: "destructive" });
    } else {
      toast({ title: t("common.saved"), description: t("admin.teamsAddMemberSuccess") });
      setShowAddMemberDialog(false);
      setAddMemberTeam(null);
      fetchTeams();
    }
    
    setAddingMember(false);
  };

  const openInviteDialog = (team: Team) => {
    setInviteDialogTeam(team);
    setShowInviteDialog(true);
    setInviteRole("buyer");
    setGeneratedInviteCode(null);
  };

  const handleGenerateInviteCode = async () => {
    if (!user || !inviteDialogTeam) return;
    
    setGeneratingInvite(true);
    const newCode = generateCode();

    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode,
        created_by: user.id,
        team_id: inviteDialogTeam.id,
        assigned_role: inviteRole as "owner" | "team_lead" | "buyer" | "tech_dev"
      });

    if (error) {
      toast({ title: t("common.error"), description: t("admin.teamsInviteError"), variant: "destructive" });
    } else {
      setGeneratedInviteCode(newCode);
      toast({ title: t("admin.teamsInviteCreated"), description: `${newCode} (${inviteRole})` });
    }
    setGeneratingInvite(false);
  };

  const filteredUsers = allUsers.filter(u => 
    (u.display_name || "").toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.user_id.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const totalSales = transactions.reduce((sum, t) => sum + (t.sale_price || 0), 0);
  const totalCosts = transactions.reduce((sum, t) => sum + (t.generation_cost || 0), 0);

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="py-3 px-4 flex-shrink-0">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {t("sidebar.teams")}
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchTeams} disabled={loading}>
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 flex-1 flex flex-col min-h-0">
          <div className="flex gap-2 flex-shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder={t("admin.teamsSearch")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-7"
              />
            </div>
            <Button onClick={() => setShowCreateDialog(true)} size="sm" className="h-8 text-xs">
              <Plus className="h-3 w-3 mr-1" />
              {t("common.create")}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : filteredTeams.length === 0 ? (
            <p className="text-center text-muted-foreground py-3 text-xs">
              {searchQuery ? t("admin.teamsNoTeamsFound") : t("admin.teamsNoTeams")}
            </p>
          ) : (
            <div className="space-y-1.5 flex-1 overflow-y-auto">
              {filteredTeams.map((team) => (
                <div key={team.id} className={`p-2 rounded-md border bg-card space-y-1 ${favoriteTeams.has(team.id) ? "border-amber-500/50 bg-amber-500/5" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleFavorite(team.id)}
                        className="p-0.5 hover:bg-muted rounded transition-colors"
                        title={favoriteTeams.has(team.id) ? "Видалити з улюблених" : "Додати до улюблених"}
                      >
                        <Star 
                          className={`h-3.5 w-3.5 ${favoriteTeams.has(team.id) ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} 
                        />
                      </button>
                      <span className="font-medium text-xs">{team.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{team.members_count} {t("admin.teamsMembers")}</Badge>
                      <Badge 
                        variant={team.balance < 0 ? "destructive" : "outline"} 
                        className="text-[10px] px-1.5 py-0"
                      >
                        <Wallet className="h-2.5 w-2.5 mr-0.5" />
                        ${team.balance?.toFixed(2) || "0.00"}
                        {team.balance < 0 && team.credit_limit > 0 && (
                          <span className="ml-1 opacity-70">/ ${team.credit_limit?.toFixed(0)}</span>
                        )}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openInviteDialog(team)} title={t("admin.teamsCreateInvite")}>
                        <Ticket className="h-3.5 w-3.5 mr-1" />
                        {t("admin.teamsInvite")}
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openAddMemberDialog(team)} title={t("admin.teamsAddMember")}>
                        <UserPlus className="h-3.5 w-3.5 mr-1" />
                        {t("admin.teamsAdd")}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleViewTeam(team)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(team.created_at).toLocaleDateString("uk-UA")}
                      </span>
                    </div>
                  </div>
                  
                  {/* Owner section */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <Crown className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("admin.teamsOwner")}:</span>
                    {team.has_owner ? (
                      <>
                        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 border-amber-500/30">
                          {team.owner_name}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => openOwnerDialog(team)}>
                          {t("admin.teamsChange")}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 text-destructive border-destructive/30">{t("admin.teamsNotAssigned")}</Badge>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => openOwnerDialog(team)}>
                          {t("admin.teamsAssign")}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Owner code section */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">{t("admin.teamsOwnerCode")}:</span>
                    {team.owner_code ? (
                      <>
                        <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">{team.owner_code}</code>
                        <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleCopyCode(team.owner_code!, team.id)}>
                          {copiedId === team.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline" className="text-[10px] px-1 py-0">{t("admin.teamsUsed")}</Badge>
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => handleGenerateNewOwnerCode(team.id, team.name)}>
                          {t("admin.teamsNewCode")}
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex items-start gap-1.5 text-xs">
                    <UserCog className="h-3 w-3 text-muted-foreground mt-0.5" />
                    <span className="text-muted-foreground">{t("admin.teamsAdmin")}:</span>
                    <div className="flex flex-wrap gap-1">
                      {(team.assigned_admin_ids || []).map((adminId, idx) => (
                        <Badge key={adminId} variant="secondary" className="text-[10px] px-1 py-0 gap-0.5">
                          {team.assigned_admin_names?.[idx] || adminId.slice(0, 8)}
                          <button
                            className="ml-0.5 hover:text-destructive"
                            onClick={() => handleAssignAdmin(team.id, adminId, false)}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                      <Select
                        value=""
                        onValueChange={(value) => handleAssignAdmin(team.id, value, true)}
                      >
                        <SelectTrigger className="h-5 w-[100px] text-[10px]">
                          <SelectValue placeholder="+ Додати" />
                        </SelectTrigger>
                        <SelectContent>
                          {admins
                            .filter(a => !(team.assigned_admin_ids || []).includes(a.user_id))
                            .map((admin) => (
                              <SelectItem key={admin.user_id} value={admin.user_id} className="text-xs">
                                {admin.display_name || admin.user_id.slice(0, 8)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <Wallet className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{t("admin.teamsCreditLimit")}:</span>
                    <Input
                      type="number"
                      defaultValue={team.credit_limit || 0}
                      onBlur={(e) => {
                        const newValue = parseFloat(e.target.value) || 0;
                        if (newValue !== team.credit_limit) {
                          handleUpdateCreditLimit(team.id, newValue);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="h-6 w-20 text-[10px]"
                      min={0}
                      step={10}
                    />
                    <span className="text-[10px] text-muted-foreground">$</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTeam} onOpenChange={(open) => !open && setSelectedTeam(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedTeam?.name}
                <Badge variant="outline" className="text-xs">
                  <Wallet className="h-3 w-3 mr-1" />
                  Баланс: ${selectedTeam?.balance?.toFixed(2) || "0.00"}
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setSelectedTeam(null);
                  navigate(`/admin/team/${selectedTeam?.id}`);
                }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Відкрити повністю
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Генерацій</div>
                <div className="text-sm font-medium">{transactions.length}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Сума продажів</div>
                <div className="text-sm font-medium">${totalSales.toFixed(2)}</div>
              </div>
              <div className="p-2 rounded border bg-muted/50 text-center">
                <div className="text-[10px] text-muted-foreground">Витрати AI</div>
                <div className="text-sm font-medium">${totalCosts.toFixed(2)}</div>
              </div>
            </div>

            <div className="text-xs font-medium mb-2">Історія транзакцій</div>
            
            {loadingTransactions ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">Немає транзакцій</p>
            ) : (
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {transactions.map((t) => (
                  <div key={t.id} className="p-2 rounded border bg-card text-xs flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium truncate">{t.site_name || "Без назви"}</span>
                        <Badge variant={t.status === "completed" ? "default" : t.status === "failed" ? "destructive" : "secondary"} className="text-[9px] px-1 py-0">
                          {t.status}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                        <span>{t.user_email}</span>
                        <span>•</span>
                        <span>{t.website_type}</span>
                        <span>•</span>
                        <span>{t.ai_model}</span>
                      </div>
                    </div>
                    <div className="text-right ml-2">
                      <div className="font-medium text-green-600">+${t.sale_price?.toFixed(2) || "0.00"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(t.created_at).toLocaleDateString("uk-UA")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Створити нову команду</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Назва команди"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              disabled={creating}
              className="h-9"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowCreateDialog(false);
                  setNewTeamName("");
                }}
                disabled={creating}
              >
                Скасувати
              </Button>
              <Button 
                onClick={async () => {
                  await handleCreateTeam();
                  setShowCreateDialog(false);
                }} 
                disabled={creating || !newTeamName.trim()} 
                size="sm"
              >
                {creating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                Створити
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Owner Dialog */}
      <Dialog open={showOwnerDialog} onOpenChange={(open) => {
        if (!open) {
          setShowOwnerDialog(false);
          setOwnerDialogTeam(null);
          setTeamMembers([]);
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Призначити власника: {ownerDialogTeam?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : teamMembers.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-xs">
                Команда не має затверджених членів
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {teamMembers.map((member) => (
                  <div 
                    key={member.user_id} 
                    className={`p-2 rounded-md border flex items-center justify-between ${
                      member.role === "owner" ? "bg-amber-500/10 border-amber-500/30" : "bg-card"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{member.display_name}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {member.role}
                      </Badge>
                    </div>
                    {member.role === "owner" ? (
                      <Badge className="text-[10px] bg-amber-500">
                        <Crown className="h-3 w-3 mr-1" />
                        Власник
                      </Badge>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="h-6 text-[10px]"
                        onClick={() => handleAssignOwner(member.user_id)}
                        disabled={assigningOwner}
                      >
                        {assigningOwner ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Crown className="h-3 w-3 mr-1" />
                            Призначити
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowOwnerDialog(false);
                  setOwnerDialogTeam(null);
                }}
              >
                Закрити
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddMemberDialog(false);
          setAddMemberTeam(null);
          setAllUsers([]);
          setSelectedUserId("");
          setSelectedRole("buyer");
          setUserSearchQuery("");
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Додати члена до команди: {addMemberTeam?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Пошук користувача..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-7"
                  />
                </div>
                
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                    <p className="text-center text-muted-foreground py-2 text-xs">
                      {userSearchQuery ? "Користувачів не знайдено" : "Немає доступних користувачів"}
                    </p>
                  ) : (
                    filteredUsers.map((u) => (
                      <div 
                        key={u.user_id} 
                        className={`p-2 rounded-md border cursor-pointer transition-colors ${
                          selectedUserId === u.user_id ? "bg-primary/10 border-primary" : "bg-card hover:bg-muted"
                        }`}
                        onClick={() => setSelectedUserId(u.user_id)}
                      >
                        <span className="text-sm font-medium">{u.display_name || u.user_id.slice(0, 8)}</span>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Роль</label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner" className="text-xs">Owner (Власник)</SelectItem>
                      <SelectItem value="team_lead" className="text-xs">Team Lead</SelectItem>
                      <SelectItem value="buyer" className="text-xs">Buyer</SelectItem>
                      <SelectItem value="tech_dev" className="text-xs">Tech Dev</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowAddMemberDialog(false);
                  setAddMemberTeam(null);
                }}
                disabled={addingMember}
              >
                Скасувати
              </Button>
              <Button 
                size="sm"
                onClick={handleAddMember}
                disabled={addingMember || !selectedUserId}
              >
                {addingMember ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <UserPlus className="h-3 w-3 mr-1" />}
                Додати
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Generate Invite Code Dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(open) => {
        if (!open) {
          setShowInviteDialog(false);
          setInviteDialogTeam(null);
          setGeneratedInviteCode(null);
          setInviteRole("buyer");
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Створити інвайт-код: {inviteDialogTeam?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Роль для інвайту</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Owner (Власник)</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  <SelectItem value="buyer">Buyer</SelectItem>
                  <SelectItem value="tech_dev">Tech Dev</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {generatedInviteCode && (
              <div className="p-3 rounded-lg bg-muted border space-y-2">
                <div className="text-xs text-muted-foreground">Згенерований код:</div>
                <div className="flex items-center justify-between">
                  <code className="font-mono text-lg font-bold">{generatedInviteCode}</code>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => handleCopyCode(generatedInviteCode, "invite-dialog")}
                  >
                    {copiedId === "invite-dialog" ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setShowInviteDialog(false);
                  setInviteDialogTeam(null);
                  setGeneratedInviteCode(null);
                }}
              >
                Закрити
              </Button>
              <Button 
                size="sm"
                onClick={handleGenerateInviteCode}
                disabled={generatingInvite}
              >
                {generatingInvite ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3 mr-1" />
                )}
                {generatedInviteCode ? "Новий код" : "Створити"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
