import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Shield, 
  ShieldOff,
  UserPlus,
  Loader2,
  Search,
  Crown
} from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

interface UserProfile {
  user_id: string;
  display_name: string | null;
  created_at: string;
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name, created_at")
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

  const handleToggleAdmin = async (user: UserWithRoles) => {
    try {
      if (user.isAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", user.user_id)
          .eq("role", "admin");

        if (error) throw error;

        toast({
          title: "Успішно",
          description: `Права адміністратора знято з ${user.display_name || user.user_id.slice(0, 8)}`
        });
      } else {
        // Add admin role
        const { error } = await supabase
          .from("user_roles")
          .insert({
            user_id: user.user_id,
            role: "admin"
          });

        if (error) throw error;

        toast({
          title: "Успішно",
          description: `${user.display_name || user.user_id.slice(0, 8)} тепер адміністратор`
        });
      }
      
      fetchData();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося змінити права",
        variant: "destructive"
      });
    }
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

  const openAssignDialog = (user: UserWithRoles) => {
    setSelectedUser(user);
    setAssignDialogOpen(true);
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
    noTeam: users.filter(u => u.teams.length === 0).length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Всього</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold text-primary">{stats.admins}</div>
            <div className="text-xs text-muted-foreground">Адміністраторів</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.withTeam}</div>
            <div className="text-xs text-muted-foreground">В командах</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-muted-foreground">{stats.noTeam}</div>
            <div className="text-xs text-muted-foreground">Без команди</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Пошук користувачів..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Користувачі ({filteredUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Користувач</TableHead>
                  <TableHead>Команди</TableHead>
                  <TableHead>Адмін</TableHead>
                  <TableHead>Реєстрація</TableHead>
                  <TableHead className="text-right">Дії</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => (
                  <TableRow key={user.user_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {user.display_name || "Без імені"}
                          {user.isAdmin && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.user_id.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.teams.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.teams.map(team => (
                            <Badge 
                              key={team.team_id} 
                              variant="secondary"
                              className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleRemoveFromTeam(user, team.team_id)}
                              title="Клікніть щоб видалити"
                            >
                              {team.team_name}
                              <span className="ml-1 text-xs opacity-70">
                                ({roleLabels[team.role]})
                              </span>
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Немає</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge className="bg-primary">Адмін</Badge>
                      ) : (
                        <Badge variant="outline">Користувач</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openAssignDialog(user)}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          До команди
                        </Button>
                        <Button
                          variant={user.isAdmin ? "destructive" : "default"}
                          size="sm"
                          onClick={() => handleToggleAdmin(user)}
                        >
                          {user.isAdmin ? (
                            <>
                              <ShieldOff className="h-4 w-4 mr-1" />
                              Зняти
                            </>
                          ) : (
                            <>
                              <Shield className="h-4 w-4 mr-1" />
                              Адмін
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
