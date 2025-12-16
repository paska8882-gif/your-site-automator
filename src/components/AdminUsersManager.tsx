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
  X
} from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  created_at: string;
  is_blocked: boolean;
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

const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  team_lead: "Team Lead",
  buyer: "Buyer",
  tech_dev: "Tech Dev"
};

export const AdminUsersManager = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name, created_at, is_blocked")
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

    // Fetch all team memberships
    const { data: membershipsData } = await supabase
      .from("team_members")
      .select("user_id, team_id, role")
      .eq("status", "approved");

    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const teamsMap = new Map(teamsData?.map(t => [t.id, t.name]) || []);
    
    // Group memberships by user
    const userMemberships: Record<string, TeamMembership[]> = {};
    membershipsData?.forEach(m => {
      if (!userMemberships[m.user_id]) {
        userMemberships[m.user_id] = [];
      }
      userMemberships[m.user_id].push({
        team_id: m.team_id,
        team_name: teamsMap.get(m.team_id) || "Невідома команда",
        role: m.role as TeamRole
      });
    });

    const usersWithRoles: UserWithRoles[] = (profilesData || []).map(profile => ({
      ...profile,
      isAdmin: adminUserIds.has(profile.user_id),
      teams: userMemberships[profile.user_id] || []
    }));

    setUsers(usersWithRoles);
    setTeams(teamsData || []);
    setLoading(false);
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
          title: "Успішно",
          description: `Роль оновлено на ${roleLabels[selectedRole]}`
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
          title: "Успішно",
          description: `Користувача додано до команди з роллю ${roleLabels[selectedRole]}`
        });
      }

      setAssignDialogOpen(false);
      setSelectedUser(null);
      setSelectedTeam("");
      setSelectedRole("buyer");
      fetchData();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося призначити до команди",
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
        title: "Успішно",
        description: "Користувача видалено з команди"
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити з команди",
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
        title: "Успішно",
        description: user.is_blocked 
          ? "Користувача розблоковано" 
          : "Користувача заблоковано"
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося змінити статус блокування",
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
        title: "Успішно",
        description: "Ім'я користувача оновлено"
      });

      setEditingUserId(null);
      setEditDisplayName("");
      fetchData();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося оновити ім'я",
        variant: "destructive"
      });
    }
    setSavingName(false);
  };

  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (user.display_name && user.display_name.toLowerCase().includes(query)) ||
      user.user_id.toLowerCase().includes(query)
    );
  });

  const stats = {
    total: users.length,
    admins: users.filter(u => u.isAdmin).length,
    withTeam: users.filter(u => u.teams.length > 0).length,
    blocked: users.filter(u => u.is_blocked).length
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
      {/* Stats + Search row */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Всього:</span>
          <span className="text-sm font-bold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <Crown className="h-3 w-3 text-yellow-500" />
          <span className="text-xs text-muted-foreground">Адмінів:</span>
          <span className="text-sm font-bold text-yellow-500">{stats.admins}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span className="text-xs text-muted-foreground">В командах:</span>
          <span className="text-sm font-bold text-green-500">{stats.withTeam}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <Ban className="h-3 w-3 text-destructive" />
          <span className="text-xs text-muted-foreground">Заблок:</span>
          <span className="text-sm font-bold text-destructive">{stats.blocked}</span>
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Пошук..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs w-40"
          />
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium">Користувачі ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px] py-1">Користувач</TableHead>
                  <TableHead className="text-[10px] py-1">Команди</TableHead>
                  <TableHead className="text-[10px] py-1">Статус</TableHead>
                  <TableHead className="text-[10px] py-1">Дата</TableHead>
                  <TableHead className="text-[10px] py-1 text-right">Дії</TableHead>
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
                            {user.display_name || "Без імені"}
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
                          {user.user_id.slice(0, 8)}...
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
                        <span className="text-muted-foreground text-[10px]">Немає</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1">
                        {user.isAdmin && (
                          <Badge className="bg-yellow-500 text-black text-[10px] px-1 py-0">Адмін</Badge>
                        )}
                        {user.is_blocked && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">Заблок</Badge>
                        )}
                        {!user.isAdmin && !user.is_blocked && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">Актив</Badge>
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
                          onClick={() => openAssignDialog(user)}
                        >
                          <UserPlus className="h-3 w-3 mr-0.5" />
                          Команда
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
                              Розблок
                            </>
                          ) : (
                            <>
                              <Ban className="h-3 w-3 mr-0.5" />
                              Блок
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
              Призначити до команди: {selectedUser?.display_name || selectedUser?.user_id.slice(0, 8)}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Команда</label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Виберіть команду" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                      {selectedUser?.teams.find(t => t.team_id === team.id) && (
                        <span className="ml-2 text-muted-foreground">(вже член)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Роль</label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TeamRole)}>
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
                ? "Оновити роль" 
                : "Призначити"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
