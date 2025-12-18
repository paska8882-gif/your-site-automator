import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditPreview } from "@/components/EditPreview";
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
  ArrowDown,
  RefreshCw,
  Eye,
  Pencil
} from "lucide-react";

interface GeneratedFile {
  path: string;
  content: string;
}

type SortColumn = "site_name" | "team" | "user" | "language" | "website_type" | "ai_model" | "created_at" | "status";
type SortDirection = "asc" | "desc";

interface GenerationItem {
  id: string;
  number: number;
  prompt: string;
  language: string;
  created_at: string;
  completed_at: string | null;
  zip_data: string | null;
  files_data: unknown;
  website_type: string | null;
  site_name: string | null;
  status: string;
  error_message: string | null;
  ai_model: string | null;
  user_id: string | null;
  team_id: string | null;
  sale_price: number | null;
}

// Helper function to calculate and format generation duration
function getGenerationDuration(createdAt: string, completedAt: string | null): { text: string; colorClass: string } | null {
  if (!completedAt) return null;
  
  const start = new Date(createdAt).getTime();
  const end = new Date(completedAt).getTime();
  const durationMs = end - start;
  
  if (durationMs < 0) return null;
  
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  
  let text: string;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    text = `${hours}г ${mins}хв`;
  } else if (minutes > 0) {
    text = `${minutes}хв ${seconds}с`;
  } else {
    text = `${seconds}с`;
  }
  
  // Color coding: <5min green, 5-10min yellow, 10+ red
  let colorClass: string;
  if (minutes < 5) {
    colorClass = "text-green-500";
  } else if (minutes < 10) {
    colorClass = "text-yellow-500";
  } else {
    colorClass = "text-red-500";
  }
  
  return { text, colorClass };
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
}

interface UserRoleInfo {
  role: string;
}

interface UserRoleMap {
  [userId: string]: UserRoleInfo | null;
}

export const AdminSitesTab = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [teamsMap, setTeamsMap] = useState<Record<string, string>>({});
  const [userRoles, setUserRoles] = useState<UserRoleMap>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<GenerationItem | null>(null);
  const [previewFiles, setPreviewFiles] = useState<GeneratedFile[]>([]);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<GeneratedFile | null>(null);
  
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
  const [dateFilter, setDateFilter] = useState<string>("all");

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
      const teamIds = [...new Set((data || []).map(item => item.team_id).filter(Boolean))] as string[];
      
      // Fetch user profiles
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .in("user_id", userIds);
        
        const profilesMap: Record<string, UserProfile> = {};
        (profilesData || []).forEach(profile => {
          profilesMap[profile.user_id] = profile;
        });
        setProfiles(profilesMap);

        // Fetch user roles from team_members for role badges
        const { data: membershipsData } = await supabase
          .from("team_members")
          .select("user_id, role")
          .in("user_id", userIds)
          .eq("status", "approved");

        const rolesMap: UserRoleMap = {};
        (membershipsData || []).forEach(m => {
          rolesMap[m.user_id] = { role: m.role };
        });
        setUserRoles(rolesMap);
      }

      // Fetch team names by team_id from generation_history
      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", teamIds);

        const teamsNameMap: Record<string, string> = {};
        (teamsData || []).forEach(t => {
          teamsNameMap[t.id] = t.name;
        });
        setTeamsMap(teamsNameMap);
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

  const handlePreview = (item: GenerationItem) => {
    if (!item.files_data) return;
    
    const filesData = item.files_data as GeneratedFile[];
    if (filesData && filesData.length > 0) {
      setPreviewFiles(filesData);
      setSelectedPreviewFile(filesData[0]);
      setPreviewItem(item);
      setPreviewOpen(true);
    }
  };

  const handleEdit = (item: GenerationItem) => {
    navigate(`/edit/${item.id}`);
  };

  const getStatusIcon = (status: string, salePrice?: number | null) => {
    // Check if this is a refunded failed generation
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <RefreshCw className="h-4 w-4 text-amber-500" />;
    }
    
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

  const getStatusBadge = (status: string, salePrice?: number | null) => {
    // Check if this is a refunded failed generation
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <Badge variant="destructive">Помилка, кошти повернено</Badge>;
    }
    
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

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return "—";
    return teamsMap[teamId] || "—";
  };

  const getRoleBadge = (userId: string | null) => {
    if (!userId) return null;
    const roleInfo = userRoles[userId];
    if (!roleInfo) return null;
    
    const roleLabels: Record<string, string> = {
      owner: "Owner",
      team_lead: "Team Lead",
      buyer: "Buyer",
      tech_dev: "Tech Dev"
    };
    
    return (
      <Badge variant="outline" className="text-xs">
        {roleLabels[roleInfo.role] || roleInfo.role}
      </Badge>
    );
  };

  // Get unique values for filters
  const uniqueLanguages = [...new Set(history.map(h => h.language))].filter(Boolean);
  const uniqueUsers = [...new Set(history.map(h => h.user_id).filter(Boolean))] as string[];
  const uniqueTeams = Object.values(teamsMap);

  const filteredHistory = history.filter(item => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (aiModelFilter !== "all" && (item.ai_model || "junior") !== aiModelFilter) return false;
    if (websiteTypeFilter !== "all" && (item.website_type || "html") !== websiteTypeFilter) return false;
    if (languageFilter !== "all" && item.language !== languageFilter) return false;
    if (teamFilter !== "all") {
      const teamName = getTeamName(item.team_id);
      if (teamName !== teamFilter) return false;
    }
    if (userFilter !== "all" && item.user_id !== userFilter) return false;
    
    // Date filter
    if (dateFilter !== "all") {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateFilter === "today") {
        if (itemDate < today) return false;
      } else if (dateFilter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (itemDate < weekAgo) return false;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (itemDate < monthAgo) return false;
      }
    }
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.prompt.toLowerCase().includes(query) ||
      (item.site_name && item.site_name.toLowerCase().includes(query)) ||
      getUserName(item.user_id).toLowerCase().includes(query) ||
      getTeamName(item.team_id).toLowerCase().includes(query)
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
        aVal = getTeamName(a.team_id);
        bVal = getTeamName(b.team_id);
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

  // Calculate average generation times for HTML and React
  const calculateAvgTime = (items: GenerationItem[]): string => {
    const completedItems = items.filter(h => h.status === "completed" && h.completed_at);
    if (completedItems.length === 0) return "—";
    
    const totalMs = completedItems.reduce((sum, item) => {
      const start = new Date(item.created_at).getTime();
      const end = new Date(item.completed_at!).getTime();
      return sum + (end - start);
    }, 0);
    
    const avgMs = totalMs / completedItems.length;
    const minutes = Math.floor(avgMs / 60000);
    const seconds = Math.floor((avgMs % 60000) / 1000);
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}г ${mins}хв`;
    } else if (minutes > 0) {
      return `${minutes}хв ${seconds}с`;
    }
    return `${seconds}с`;
  };

  const htmlGenerations = history.filter(h => (h.website_type || "html") === "html");
  const reactGenerations = history.filter(h => h.website_type === "react");

  const stats = {
    total: history.length,
    completed: history.filter(h => h.status === "completed").length,
    failed: history.filter(h => h.status === "failed").length,
    pending: history.filter(h => h.status === "pending" || h.status === "generating").length,
    uniqueUsers: new Set(history.map(h => h.user_id).filter(Boolean)).size,
    uniqueTeams: uniqueTeams.length,
    avgTimeHtml: calculateAvgTime(htmlGenerations),
    avgTimeReact: calculateAvgTime(reactGenerations),
    htmlCount: htmlGenerations.filter(h => h.status === "completed").length,
    reactCount: reactGenerations.filter(h => h.status === "completed").length
  };

  return (
    <div className="space-y-3">
      {/* Stats - compact row */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">Всього:</span>
          <span className="text-sm font-bold">{stats.total}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">Готово:</span>
          <span className="text-sm font-bold text-green-500">{stats.completed}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">Помилки:</span>
          <span className="text-sm font-bold text-destructive">{stats.failed}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">В процесі:</span>
          <span className="text-sm font-bold text-yellow-500">{stats.pending}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">Юзерів:</span>
          <span className="text-sm font-bold">{stats.uniqueUsers}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">Команд:</span>
          <span className="text-sm font-bold">{stats.uniqueTeams}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">⏱ HTML ({stats.htmlCount}):</span>
          <span className="text-sm font-bold">{stats.avgTimeHtml}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border bg-card">
          <span className="text-xs text-muted-foreground">⏱ React ({stats.reactCount}):</span>
          <span className="text-sm font-bold">{stats.avgTimeReact}</span>
        </div>
      </div>

      {/* Filters - compact inline */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Пошук..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs w-32"
          />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="Команда" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Всі команди</SelectItem>
            {uniqueTeams.map(team => (
              <SelectItem key={team} value={team} className="text-xs">{team}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="Юзер" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Всі</SelectItem>
            {uniqueUsers.map(userId => (
              <SelectItem key={userId} value={userId} className="text-xs">{getUserName(userId)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Всі</SelectItem>
            <SelectItem value="completed" className="text-xs">Готово</SelectItem>
            <SelectItem value="generating" className="text-xs">Генерується</SelectItem>
            <SelectItem value="pending" className="text-xs">Очікує</SelectItem>
            <SelectItem value="failed" className="text-xs">Помилка</SelectItem>
          </SelectContent>
        </Select>
        <Select value={aiModelFilter} onValueChange={setAiModelFilter}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="AI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Всі</SelectItem>
            <SelectItem value="junior" className="text-xs">Jr</SelectItem>
            <SelectItem value="senior" className="text-xs">Sr</SelectItem>
          </SelectContent>
        </Select>
        <Select value={websiteTypeFilter} onValueChange={setWebsiteTypeFilter}>
          <SelectTrigger className="h-7 text-xs w-20">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Всі</SelectItem>
            <SelectItem value="html" className="text-xs">HTML</SelectItem>
            <SelectItem value="react" className="text-xs">React</SelectItem>
          </SelectContent>
        </Select>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue placeholder="Мова" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Всі</SelectItem>
            {uniqueLanguages.map(lang => (
              <SelectItem key={lang} value={lang} className="text-xs">{lang}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-7 text-xs w-24">
            <SelectValue placeholder="Дата" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Весь час</SelectItem>
            <SelectItem value="today" className="text-xs">Сьогодні</SelectItem>
            <SelectItem value="week" className="text-xs">Тиждень</SelectItem>
            <SelectItem value="month" className="text-xs">Місяць</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            <FileCode className="h-3.5 w-3.5" />
            Всі генерації ({sortedHistory.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : sortedHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-xs">
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
                    <TableHead>Час</TableHead>
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
                              {getStatusIcon(item.status, item.sale_price)}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.site_name || `Site ${item.number}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {getTeamName(item.team_id)}
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
                            {item.status === "completed" && (() => {
                              const duration = getGenerationDuration(item.created_at, item.completed_at);
                              if (duration) {
                                return (
                                  <Badge variant="outline" className={`text-xs ${duration.colorClass}`}>
                                    ⏱ {duration.text}
                                  </Badge>
                                );
                              }
                              return <span className="text-xs text-muted-foreground">—</span>;
                            })()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {item.status === "completed" && item.files_data && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handlePreview(item)}
                                    title="Превью"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0"
                                    onClick={() => handleEdit(item)}
                                    title="Редагувати"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                              {item.status === "completed" && item.zip_data && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => handleDownload(item)}
                                  title="Завантажити ZIP"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
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

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 py-2 border-b">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              Превью: {previewItem?.site_name || `Site ${previewItem?.number}`}
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-7 text-xs"
                onClick={() => {
                  setPreviewOpen(false);
                  if (previewItem) handleEdit(previewItem);
                }}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Редагувати
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewFiles.length > 0 && selectedPreviewFile && (
              <EditPreview
                files={previewFiles}
                selectedFile={selectedPreviewFile}
                onSelectFile={setSelectedPreviewFile}
                websiteType={previewItem?.website_type || "html"}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
