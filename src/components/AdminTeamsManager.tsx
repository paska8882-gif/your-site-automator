import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  Copy, 
  Check, 
  Loader2,
  RefreshCw
} from "lucide-react";

interface Team {
  id: string;
  name: string;
  created_at: string;
  owner_code?: string;
  members_count?: number;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    
    // Fetch teams
    const { data: teamsData, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching teams:", error);
      setLoading(false);
      return;
    }

    // For each team, get the owner invite code and members count
    const teamsWithDetails = await Promise.all((teamsData || []).map(async (team) => {
      // Get owner invite code
      const { data: codeData } = await supabase
        .from("invite_codes")
        .select("code")
        .eq("team_id", team.id)
        .eq("assigned_role", "owner")
        .is("used_by", null)
        .eq("is_active", true)
        .maybeSingle();

      // Get members count
      const { count } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("team_id", team.id)
        .eq("status", "approved");

      return {
        ...team,
        owner_code: codeData?.code,
        members_count: count || 0
      };
    }));

    setTeams(teamsWithDetails);
    setLoading(false);
  };

  const handleCreateTeam = async () => {
    if (!user || !newTeamName.trim()) return;
    
    setCreating(true);

    // Create team
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
        title: "Помилка",
        description: "Не вдалося створити команду",
        variant: "destructive"
      });
      setCreating(false);
      return;
    }

    // Create owner invite code
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
        title: "Помилка",
        description: "Не вдалося створити інвайт-код для Owner",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Команду створено",
        description: `${newTeamName} - код для Owner: ${ownerCode}`
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
    toast({
      title: "Скопійовано",
      description: code
    });
  };

  const handleGenerateNewOwnerCode = async (teamId: string, teamName: string) => {
    if (!user) return;

    // Deactivate old owner codes
    await supabase
      .from("invite_codes")
      .update({ is_active: false })
      .eq("team_id", teamId)
      .eq("assigned_role", "owner")
      .is("used_by", null);

    // Create new code
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
      toast({
        title: "Помилка",
        description: "Не вдалося створити новий код",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Новий код створено",
        description: `${teamName}: ${newCode}`
      });
      fetchTeams();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Команди
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchTeams}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create new team */}
        <div className="flex gap-2">
          <Input
            placeholder="Назва нової команди"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            disabled={creating}
          />
          <Button onClick={handleCreateTeam} disabled={creating || !newTeamName.trim()}>
            {creating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Створити
          </Button>
        </div>

        {/* Teams list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : teams.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Немає команд
          </p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {teams.map((team) => (
              <div
                key={team.id}
                className="p-3 rounded-lg border bg-card space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{team.name}</span>
                    <Badge variant="secondary">{team.members_count} членів</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(team.created_at).toLocaleDateString("uk-UA")}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Owner код:</span>
                  {team.owner_code ? (
                    <>
                      <code className="font-mono bg-muted px-2 py-0.5 rounded">
                        {team.owner_code}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleCopyCode(team.owner_code!, team.id)}
                      >
                        {copiedId === team.id ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Badge variant="outline">Використано</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() => handleGenerateNewOwnerCode(team.id, team.name)}
                      >
                        Новий код
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
