import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Shield, 
  ArrowLeft, 
  Search, 
  Download, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronRight,
  Users,
  FileCode
} from "lucide-react";

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

const Admin = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!adminLoading && !isAdmin && user) {
      navigate("/");
    }
  }, [isAdmin, adminLoading, user, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllGenerations();
    }
  }, [isAdmin]);

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
      
      // Fetch user profiles
      const userIds = [...new Set((data || []).map(item => item.user_id).filter(Boolean))];
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

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
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

  const filteredHistory = history.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.prompt.toLowerCase().includes(query) ||
      (item.site_name && item.site_name.toLowerCase().includes(query)) ||
      getUserName(item.user_id).toLowerCase().includes(query)
    );
  });

  const stats = {
    total: history.length,
    completed: history.filter(h => h.status === "completed").length,
    failed: history.filter(h => h.status === "failed").length,
    pending: history.filter(h => h.status === "pending" || h.status === "generating").length,
    uniqueUsers: new Set(history.map(h => h.user_id).filter(Boolean)).size
  };

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Адмін-панель</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <CardContent className="p-4 text-center flex items-center justify-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.uniqueUsers}</div>
                <div className="text-sm text-muted-foreground">Користувачів</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Пошук за назвою, промптом або користувачем..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* History List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              Всі генерації ({filteredHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery ? "Нічого не знайдено" : "Немає генерацій"}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => (
                  <Collapsible key={item.id}>
                    <CollapsibleTrigger asChild>
                      <div
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ChevronRight 
                            className={`h-4 w-4 shrink-0 transition-transform ${
                              expandedItems.has(item.id) ? "rotate-90" : ""
                            }`}
                          />
                          {getStatusIcon(item.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">
                                {item.site_name || `Site ${item.number}`}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {getUserName(item.user_id)}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(item.created_at).toLocaleString("uk-UA")}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {getStatusBadge(item.status)}
                          <Badge variant="outline">{item.language}</Badge>
                          <Badge variant="secondary">{item.website_type || "html"}</Badge>
                          <Badge variant={item.ai_model === "senior" ? "default" : "outline"}>
                            {item.ai_model === "senior" ? "Senior" : "Junior"}
                          </Badge>
                          {item.status === "completed" && item.zip_data && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(item);
                              }}
                              title="Завантажити ZIP"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-8 mt-2 p-3 rounded-lg bg-muted/50 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Назва:</span>
                          <p className="text-sm">{item.site_name || "—"}</p>
                        </div>
                        <div>
                          <span className="text-xs font-medium text-muted-foreground">Промпт:</span>
                          <p className="text-sm whitespace-pre-wrap">{item.prompt}</p>
                        </div>
                        {item.error_message && (
                          <div>
                            <span className="text-xs font-medium text-destructive">Помилка:</span>
                            <p className="text-sm text-destructive">{item.error_message}</p>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          User ID: {item.user_id || "—"}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
