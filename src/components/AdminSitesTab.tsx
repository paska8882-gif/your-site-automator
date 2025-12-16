import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Search, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Users,
  FileCode,
  Filter,
  User,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";

type SortColumn = "site_name" | "team" | "user" | "language" | "website_type" | "ai_model" | "created_at" | "status";
type SortDirection = "asc" | "desc";

interface GenerationItem {
  id: string;
  number: number;
  prompt: string;
  language: string;
  created_at: string;
  zip_data: string | null;
  files_data: unknown;
  website_type: string | null;
  site_name: string | null;
  status: string;
  error_message: string | null;
  ai_model: string | null;
  user_id: string | null;
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
}

interface TeamInfo {
  team_id: string;
  team_name: string;
  role: string;
}

interface UserTeamMap {
  [userId: string]: TeamInfo | null;
}

export const AdminSitesTab = () => {
  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [userTeams, setUserTeams] = useState<UserTeamMap>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sorting
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [aiModelFilter, setAiModelFilter] = useState<string>("all");
  const [websiteTypeFilter, setWebsiteTypeFilter] = useState<string>("all");
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  useEffect(() => {
    fetchAllGenerations();
  }, []);

  const fetchAllGenerations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("generation_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching generations:", error);
    } else {
      setHistory(data || []);
      
      const userIds = [...new Set((data || []).map(item => item.user_id).filter(Boolean))] as string[];
      
      if (userIds.length > 0) {
        // Fetch user profiles
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        
        const profilesMap: Record<string, UserProfile> = {};
        (profilesData || []).forEach(profile => {
          profilesMap[profile.user_id] = profile;
        });
        setProfiles(profilesMap);

        // Fetch team memberships with team names
        const { data: membershipsData } = await supabase
          .from("team_members")
          .select("user_id, team_id, role")
          .in("user_id", userIds)
          .eq("status", "approved");

        if (membershipsData && membershipsData.length > 0) {
          const teamIds = [...new Set(membershipsData.map(m => m.team_id))];
          const { data: teamsData } = await supabase
            .from("teams")
            .select("id, name")
            .in("id", teamIds);

          const teamsMap = new Map(teamsData?.map(t => [t.id, t.name]) || []);
          
          const userTeamsMap: UserTeamMap = {};
          membershipsData.forEach(m => {
            userTeamsMap[m.user_id] = {
              team_id: m.team_id,
              team_name: teamsMap.get(m.team_id) || "Невідома команда",
              role: m.role
            };
          });
          setUserTeams(userTeamsMap);
        }
      }
    }
    setLoading(false);
  };

  const handleDownload = async (item: GenerationItem) => {
    if (!item.zip_data) return;

    const byteCharacters = atob(item.zip_data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/zip" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const siteName = item.site_name || `site-${item.number}`;
    const lang = item.language || "en";
    const type = item.website_type || "html";
    const model = item.ai_model || "junior";
    a.download = `${siteName}-${lang}-${type}-${model}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      case "pending":
      case "generating":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Готово</Badge>;
      case "failed":
        return <Badge variant="destructive">Помилка</Badge>;
      case "pending":
        return <Badge variant="secondary">Очікує</Badge>;
      case "generating":
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Генерується</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "Анонім";
    const profile = profiles[userId];
    return profile?.display_name || userId.slice(0, 8) + "...";
  };

  const getTeamName = (userId: string | null) => {
    if (!userId) return "—";
    const teamInfo = userTeams[userId];
    return teamInfo?.team_name || "—";
  };

  const getRoleBadge = (userId: string | null) => {
    if (!userId) return null;
    const teamInfo = userTeams[userId];
    if (!teamInfo) return null;
    
    const roleLabels: Record<string, string> = {
      owner: "Owner",
      team_lead: "Team Lead",
      buyer: "Buyer",
      tech_dev: "Tech Dev"
    };
    
    return (
      <Badge variant="outline" className="text-xs">
        {roleLabels[teamInfo.role] || teamInfo.role}
      </Badge>
    );
  };

  // Get unique values for filters
  const uniqueLanguages = [...new Set(history.map(h => h.language))].filter(Boolean);
  const uniqueUsers = [...new Set(history.map(h => h.user_id).filter(Boolean))] as string[];
  const uniqueTeams = [...new Set(Object.values(userTeams).filter(Boolean).map(t => t!.team_name))];

  const filteredHistory = history.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (aiModelFilter !== "all" && (item.ai_model || "junior") !== aiModelFilter) return false;
    if (websiteTypeFilter !== "all" && (item.website_type || "html") !== websiteTypeFilter) return false;
    if (languageFilter !== "all" && item.language !== languageFilter) return false;
    if (teamFilter !== "all") {
      const teamName = getTeamName(item.user_id);
      if (teamName !== teamFilter) return false;
    }
    if (userFilter !== "all" && item.user_id !== userFilter) return false;
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.prompt.toLowerCase().includes(query) ||
      (item.site_name && item.site_name.toLowerCase().includes(query)) ||
      getUserName(item.user_id).toLowerCase().includes(query) ||
      getTeamName(item.user_id).toLowerCase().includes(query)
    );
  });

  // Sorting logic
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    switch (sortColumn) {
      case "site_name":
        aVal = a.site_name || `site-${a.number}`;
        bVal = b.site_name || `site-${b.number}`;
        break;
      case "team":
        aVal = getTeamName(a.user_id);
        bVal = getTeamName(b.user_id);
        break;
      case "user":
        aVal = getUserName(a.user_id);
        bVal = getUserName(b.user_id);
        break;
      case "language":
        aVal = a.language;
        bVal = b.language;
        break;
      case "website_type":
        aVal = a.website_type || "html";
        bVal = b.website_type || "html";
        break;
      case "ai_model":
        aVal = a.ai_model || "junior";
        bVal = b.ai_model || "junior";
        break;
      case "created_at":
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      case "status":
        aVal = a.status;
        bVal = b.status;
        break;
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return sortDirection === "asc" 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const stats = {
    total: history.length,
    completed: history.filter(h => h.status === "completed").length,
    failed: history.filter(h => h.status === "failed").length,
    pending: history.filter(h => h.status === "pending" || h.status === "generating").length,
    uniqueUsers: new Set(history.map(h => h.user_id).filter(Boolean)).size,
    uniqueTeams: uniqueTeams.length
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">Всього</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
            <div className="text-sm text-muted-foreground">Готово</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
            <div className="text-sm text-muted-foreground">Помилки</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
            <div className="text-sm text-muted-foreground">В процесі</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <User className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
            <div className="text-sm text-muted-foreground">Користувачів</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.uniqueTeams}</div>
            <div className="text-sm text-muted-foreground">Команд</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Фільтри</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
            <div className="relative col-span-2 md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Пошук..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Команда" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі команди</SelectItem>
                {uniqueTeams.map(team => (
                  <SelectItem key={team} value={team}>{team}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Користувач" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі користувачі</SelectItem>
                {uniqueUsers.map(userId => (
                  <SelectItem key={userId} value={userId}>{getUserName(userId)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі статуси</SelectItem>
                <SelectItem value="completed">Готово</SelectItem>
                <SelectItem value="generating">Генерується</SelectItem>
                <SelectItem value="pending">Очікує</SelectItem>
                <SelectItem value="failed">Помилка</SelectItem>
              </SelectContent>
            </Select>
            <Select value={aiModelFilter} onValueChange={setAiModelFilter}>
              <SelectTrigger>
                <SelectValue placeholder="AI модель" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі моделі</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
              </SelectContent>
            </Select>
            <Select value={websiteTypeFilter} onValueChange={setWebsiteTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Тип сайту" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі типи</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
                <SelectItem value="react">React</SelectItem>
              </SelectContent>
            </Select>
            <Select value={languageFilter} onValueChange={setLanguageFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Мова" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі мови</SelectItem>
                {uniqueLanguages.map(lang => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Всі генерації ({sortedHistory.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : sortedHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? "Нічого не знайдено" : "Немає генерацій"}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="w-[50px] cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("status")}
                    >
                      <div className="flex items-center">
                        Статус
                        {getSortIcon("status")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("site_name")}
                    >
                      <div className="flex items-center">
                        Назва сайту
                        {getSortIcon("site_name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("team")}
                    >
                      <div className="flex items-center">
                        Команда
                        {getSortIcon("team")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("user")}
                    >
                      <div className="flex items-center">
                        Користувач
                        {getSortIcon("user")}
                      </div>
                    </TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("language")}
                    >
                      <div className="flex items-center">
                        Мова
                        {getSortIcon("language")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("website_type")}
                    >
                      <div className="flex items-center">
                        Тип
                        {getSortIcon("website_type")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("ai_model")}
                    >
                      <div className="flex items-center">
                        AI
                        {getSortIcon("ai_model")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => handleSort("created_at")}
                    >
                      <div className="flex items-center">
                        Дата
                        {getSortIcon("created_at")}
                      </div>
                    </TableHead>
                    <TableHead className="w-[80px]">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map((item) => (
                    <Collapsible key={item.id} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-accent/50">
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(item.status)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.site_name || `Site ${item.number}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {getTeamName(item.user_id)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{getUserName(item.user_id)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getRoleBadge(item.user_id)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.language}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.website_type || "html"}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={item.ai_model === "senior" ? "default" : "outline"}>
                              {item.ai_model === "senior" ? "Senior" : "Junior"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleString("uk-UA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </TableCell>
                          <TableCell>
                            {item.status === "completed" && item.zip_data && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(item)}
                                title="Завантажити ZIP"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
