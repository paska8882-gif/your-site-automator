import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Ticket, 
  Plus, 
  Copy, 
  Check, 
  Loader2,
  RefreshCw,
  XCircle,
  Users,
  User,
  Filter,
  Layers
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface InviteCode {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  is_active: boolean;
  team_id: string | null;
  assigned_role: string | null;
  // Joined data
  creator_name?: string;
  user_name?: string;
  team_name?: string;
}

const generateCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const InviteCodesManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deactivating, setDeactivating] = useState(false);
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [groupByTeam, setGroupByTeam] = useState(false);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set(["no-team"]));

  useEffect(() => {
    fetchCodes();
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");
    setTeams(data || []);
  };

  const fetchCodes = async () => {
    setLoading(true);
    
    // Fetch invite codes
    const { data: codesData, error } = await supabase
      .from("invite_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching codes:", error);
      setLoading(false);
      return;
    }

    // Get unique user IDs (creators and users)
    const creatorIds = [...new Set((codesData || []).map(c => c.created_by))];
    const userIds = [...new Set((codesData || []).filter(c => c.used_by).map(c => c.used_by!))];
    const allUserIds = [...new Set([...creatorIds, ...userIds])];
    const teamIds = [...new Set((codesData || []).filter(c => c.team_id).map(c => c.team_id!))];

    // Fetch profiles
    let profilesMap = new Map<string, string>();
    if (allUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", allUserIds);
      profiles?.forEach(p => profilesMap.set(p.user_id, p.display_name || "Без імені"));
    }

    // Fetch teams
    let teamsMap = new Map<string, string>();
    if (teamIds.length > 0) {
      const { data: teams } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", teamIds);
      teams?.forEach(t => teamsMap.set(t.id, t.name));
    }

    // Combine data
    const codesWithDetails = (codesData || []).map(code => ({
      ...code,
      creator_name: profilesMap.get(code.created_by) || code.created_by.slice(0, 8),
      user_name: code.used_by ? profilesMap.get(code.used_by) || code.used_by.slice(0, 8) : null,
      team_name: code.team_id ? teamsMap.get(code.team_id) || null : null
    }));

    setCodes(codesWithDetails);
    setSelectedIds(new Set());
    setLoading(false);
  };

  const handleGenerateCode = async () => {
    if (!user) return;
    
    setGenerating(true);
    const newCode = generateCode();

    const { error } = await supabase
      .from("invite_codes")
      .insert({
        code: newCode,
        created_by: user.id
      });

    if (error) {
      toast({
        title: t("common.error"),
        description: t("admin.inviteCodesCreateError"),
        variant: "destructive"
      });
    } else {
      toast({
        title: t("admin.inviteCodesCreated"),
        description: newCode
      });
      fetchCodes();
    }
    setGenerating(false);
  };

  const handleCopyCode = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: t("common.copied"),
      description: code
    });
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    const { error } = await supabase
      .from("invite_codes")
      .update({ is_active: !currentActive })
      .eq("id", id);

    if (error) {
      toast({
        title: t("common.error"),
        description: t("admin.inviteCodesUpdateError"),
        variant: "destructive"
      });
    } else {
      fetchCodes();
    }
  };

  const handleMassDeactivate = async () => {
    if (selectedIds.size === 0) return;
    
    setDeactivating(true);
    
    const { error } = await supabase
      .from("invite_codes")
      .update({ is_active: false })
      .in("id", Array.from(selectedIds));

    if (error) {
      toast({
        title: t("common.error"),
        description: t("admin.inviteCodesDeactivateError"),
        variant: "destructive"
      });
    } else {
      toast({
        title: t("common.success"),
        description: t("admin.inviteCodesDeactivated").replace("{count}", selectedIds.size.toString())
      });
      fetchCodes();
    }
    setDeactivating(false);
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAllActive = () => {
    const activeCodes = codes.filter(c => c.is_active && !c.used_by);
    if (selectedIds.size === activeCodes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeCodes.map(c => c.id)));
    }
  };

  // Apply filters
  const filteredCodes = codes.filter(code => {
    if (filterTeam === "none" && code.team_id !== null) return false;
    if (filterTeam !== "all" && filterTeam !== "none" && code.team_id !== filterTeam) return false;
    if (filterRole !== "all" && code.assigned_role !== filterRole) return false;
    return true;
  });

  // Separate active and inactive codes
  const activeCodes = filteredCodes.filter(c => c.is_active && !c.used_by);
  const inactiveCodes = filteredCodes.filter(c => !c.is_active || c.used_by);

  // Unique roles from codes
  const uniqueRoles = [...new Set(codes.filter(c => c.assigned_role).map(c => c.assigned_role!))];

  // Group codes by team
  const groupCodesByTeam = (codesToGroup: InviteCode[]) => {
    const groups: { [key: string]: { name: string; codes: InviteCode[] } } = {};
    
    codesToGroup.forEach(code => {
      const key = code.team_id || "no-team";
      const name = code.team_name || t("admin.inviteCodesNoTeam");
      
      if (!groups[key]) {
        groups[key] = { name, codes: [] };
      }
      groups[key].codes.push(code);
    });
    
    return groups;
  };

  const toggleTeamExpanded = (teamId: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(teamId)) {
      newExpanded.delete(teamId);
    } else {
      newExpanded.add(teamId);
    }
    setExpandedTeams(newExpanded);
  };

  const stats = {
    total: codes.length,
    active: activeCodes.length,
    used: codes.filter(c => c.used_by).length
  };

  const renderCodeItem = (code: InviteCode, showCheckbox: boolean = false) => (
    <div key={code.id} className="p-2 rounded-md border bg-card space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {showCheckbox && (
            <Checkbox
              checked={selectedIds.has(code.id)}
              onCheckedChange={() => toggleSelect(code.id)}
              className="h-3.5 w-3.5"
            />
          )}
          <code className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{code.code}</code>
          {code.used_by ? (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">{t("admin.inviteCodesUsed")}</Badge>
          ) : code.is_active ? (
            <Badge variant="default" className="bg-green-500 text-[10px] px-1 py-0">{t("admin.inviteCodesActive")}</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1 py-0">{t("admin.inviteCodesInactive")}</Badge>
          )}
          {code.assigned_role && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 capitalize">{code.assigned_role}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground">{new Date(code.created_at).toLocaleDateString("uk-UA")}</span>
          {!code.used_by && code.is_active && (
            <>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleCopyCode(code.code, code.id)}>
                {copiedId === code.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1" onClick={() => handleToggleActive(code.id, code.is_active)}>
                {t("admin.inviteCodesDeactivate")}
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Details row */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="h-2.5 w-2.5" />
          <span>{t("admin.inviteCodesCreatedBy")}: {code.creator_name}</span>
        </div>
        {code.team_name && (
          <div className="flex items-center gap-1">
            <Users className="h-2.5 w-2.5" />
            <span>{t("admin.inviteCodesTeam")}: {code.team_name}</span>
          </div>
        )}
        {code.used_by && (
          <div className="flex items-center gap-1 text-blue-500">
            <Check className="h-2.5 w-2.5" />
            <span>{t("admin.inviteCodesUsedBy")}: {code.user_name}</span>
            {code.used_at && (
              <span>({new Date(code.used_at).toLocaleDateString("uk-UA")})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderGroupedCodes = (codesToRender: InviteCode[], showCheckbox: boolean) => {
    const groups = groupCodesByTeam(codesToRender);
    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === "no-team") return 1;
      if (b === "no-team") return -1;
      return groups[a].name.localeCompare(groups[b].name);
    });

    return (
      <div className="space-y-2">
        {sortedKeys.map(key => (
          <Collapsible
            key={key}
            open={expandedTeams.has(key)}
            onOpenChange={() => toggleTeamExpanded(key)}
          >
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md bg-muted/50 hover:bg-muted text-xs font-medium">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>{groups[key].name}</span>
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  {groups[key].codes.length}
                </Badge>
              </div>
              <ChevronDown className={`h-3 w-3 transition-transform ${expandedTeams.has(key) ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1 space-y-1 pl-2">
              {groups[key].codes.map(code => renderCodeItem(code, showCheckbox))}
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="py-2 px-3 flex-shrink-0">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <Ticket className="h-3.5 w-3.5" />
            {t("admin.inviteCodesTitle")}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant={groupByTeam ? "default" : "ghost"} 
              size="sm" 
              className="h-6 w-6 p-0" 
              onClick={() => setGroupByTeam(!groupByTeam)}
              title="Групувати по командах"
            >
              <Layers className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchCodes} disabled={loading}>
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button onClick={handleGenerateCode} disabled={generating} size="sm" className="h-6 text-xs px-2">
              {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              {t("admin.inviteCodesCreate")}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 flex-1 flex flex-col min-h-0">
        {/* Filters */}
        <div className="flex gap-2 flex-shrink-0">
          <div className="flex-1">
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="h-7 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Команда" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{t("admin.inviteCodesAllTeams")}</SelectItem>
                <SelectItem value="none" className="text-xs">{t("admin.inviteCodesNoTeam")}</SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id} className="text-xs">{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="h-7 text-xs">
                <User className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">{t("admin.inviteCodesAllRoles")}</SelectItem>
                {uniqueRoles.map(role => (
                  <SelectItem key={role} value={role} className="text-xs capitalize">{role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 flex-shrink-0">
          <div className="text-center p-1.5 rounded-md bg-muted">
            <div className="text-sm font-bold">{filteredCodes.length}</div>
            <div className="text-[10px] text-muted-foreground">{t("admin.inviteCodesTotal")}</div>
          </div>
          <div className="text-center p-1.5 rounded-md bg-muted">
            <div className="text-sm font-bold text-green-500">{activeCodes.length}</div>
            <div className="text-[10px] text-muted-foreground">{t("admin.inviteCodesActiveCount")}</div>
          </div>
          <div className="text-center p-1.5 rounded-md bg-muted">
            <div className="text-sm font-bold text-blue-500">{inactiveCodes.length}</div>
            <div className="text-[10px] text-muted-foreground">{t("admin.inviteCodesUsedCount")}</div>
          </div>
        </div>

        {/* Codes list with tabs */}
        {loading ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : codes.length === 0 ? (
          <p className="text-center text-muted-foreground py-2 text-xs">{t("admin.inviteCodesNoCodes")}</p>
        ) : (
          <Tabs defaultValue="active" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2 h-7 flex-shrink-0">
              <TabsTrigger value="active" className="text-xs h-6">
                {t("admin.inviteCodesActiveTab")} ({activeCodes.length})
              </TabsTrigger>
              <TabsTrigger value="inactive" className="text-xs h-6">
                {t("admin.inviteCodesInactiveTab")} ({inactiveCodes.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="active" className="flex-1 overflow-hidden flex flex-col mt-2">
              {activeCodes.length > 0 && (
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.size === activeCodes.length && activeCodes.length > 0}
                      onCheckedChange={selectAllActive}
                      className="h-3.5 w-3.5"
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {selectedIds.size > 0 ? `Вибрано: ${selectedIds.size}` : "Вибрати всі"}
                    </span>
                  </div>
                  {selectedIds.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 text-xs px-2"
                      onClick={handleMassDeactivate}
                      disabled={deactivating}
                    >
                      {deactivating ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      Деактивувати ({selectedIds.size})
                    </Button>
                  )}
                </div>
              )}
              <div className="space-y-1 flex-1 overflow-y-auto">
                {activeCodes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-2 text-xs">Немає активних кодів</p>
                ) : groupByTeam ? (
                  renderGroupedCodes(activeCodes, true)
                ) : (
                  activeCodes.map(code => renderCodeItem(code, true))
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="inactive" className="flex-1 overflow-hidden mt-2">
              <div className="space-y-1 flex-1 overflow-y-auto h-full">
                {inactiveCodes.length === 0 ? (
                  <p className="text-center text-muted-foreground py-2 text-xs">Немає неактивних кодів</p>
                ) : groupByTeam ? (
                  renderGroupedCodes(inactiveCodes, false)
                ) : (
                  inactiveCodes.map(code => renderCodeItem(code, false))
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};
