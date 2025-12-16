import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  ArrowLeft,
  ChevronRight,
  Loader2,
  FileCode,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  BarChart3
} from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

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
  status: string;
  profile?: {
    display_name: string | null;
  };
}

interface GenerationItem {
  id: string;
  number: number;
  prompt: string;
  language: string;
  created_at: string;
  zip_data: string | null;
  website_type: string | null;
  site_name: string | null;
  status: string;
  error_message: string | null;
  ai_model: string | null;
  user_id: string | null;
}

const roleLabels: Record<TeamRole, string> = {
  owner: "Owner",
  team_lead: "Team Lead",
  buyer: "Buyer",
  tech_dev: "Tech Dev"
};

export const AdminAdministratorsTab = () => {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamGenerations, setTeamGenerations] = useState<GenerationItem[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Upload form state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    siteName: "",
    prompt: "",
    language: "uk",
    websiteType: "html" as "html" | "react",
    aiModel: "junior" as "junior" | "senior",
    userId: ""
  });
  const [zipFile, setZipFile] = useState<File | null>(null);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) {
      setTeams(data || []);
    }
    setLoading(false);
  };

  const fetchTeamDetails = async (team: Team) => {
    setSelectedTeam(team);
    setSelectedMember(null);

    // Fetch team members
    const { data: membersData } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", team.id)
      .eq("status", "approved");

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

      setTeamMembers(membersWithProfiles);

      // Fetch generations for all team members
      if (userIds.length > 0) {
        const { data: generationsData } = await supabase
          .from("generation_history")
          .select("*")
          .in("user_id", userIds)
          .order("created_at", { ascending: false });

        setTeamGenerations(generationsData || []);
      } else {
        setTeamGenerations([]);
      }
    }
  };

  const filterGenerationsByMember = (memberId: string | null) => {
    if (!memberId) return teamGenerations;
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return teamGenerations;
    return teamGenerations.filter(g => g.user_id === member.user_id);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-green-500">Готово</Badge>;
      case "failed":
        return <Badge variant="destructive">Помилка</Badge>;
      case "generating":
        return <Badge variant="secondary" className="bg-yellow-500 text-black">Генерується</Badge>;
      default:
        return <Badge variant="secondary">Очікує</Badge>;
    }
  };

  const getMemberName = (userId: string) => {
    const member = teamMembers.find(m => m.user_id === userId);
    return member?.profile?.display_name || userId.slice(0, 8) + "...";
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
    a.download = `${item.site_name || `site-${item.number}`}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadSite = async () => {
    if (!uploadForm.siteName || !uploadForm.prompt || !uploadForm.userId || !zipFile) {
      toast({
        title: "Помилка",
        description: "Заповніть всі обов'язкові поля та виберіть ZIP файл",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);

    try {
      // Convert file to base64
      const arrayBuffer = await zipFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      bytes.forEach(b => binary += String.fromCharCode(b));
      const base64 = btoa(binary);

      const { error } = await supabase
        .from("generation_history")
        .insert({
          site_name: uploadForm.siteName,
          prompt: uploadForm.prompt,
          language: uploadForm.language,
          website_type: uploadForm.websiteType,
          ai_model: uploadForm.aiModel,
          user_id: uploadForm.userId,
          zip_data: base64,
          status: "completed"
        });

      if (error) throw error;

      toast({
        title: "Успішно",
        description: "Сайт додано до історії генерацій"
      });

      setUploadDialogOpen(false);
      setUploadForm({
        siteName: "",
        prompt: "",
        language: "uk",
        websiteType: "html",
        aiModel: "junior",
        userId: ""
      });
      setZipFile(null);

      // Refresh data if viewing a team
      if (selectedTeam) {
        fetchTeamDetails(selectedTeam);
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося додати сайт",
        variant: "destructive"
      });
    }

    setUploading(false);
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

  const displayedGenerations = filterGenerationsByMember(selectedMember?.id || null);

  const teamStats = selectedTeam ? {
    members: teamMembers.length,
    totalSites: teamGenerations.length,
    completed: teamGenerations.filter(g => g.status === "completed").length,
    failed: teamGenerations.filter(g => g.status === "failed").length
  } : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  // Team detail view
  if (selectedTeam) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedTeam(null); setSelectedMember(null); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold">{selectedTeam.name}</h2>
              <p className="text-sm text-muted-foreground">
                Створено: {new Date(selectedTeam.created_at).toLocaleDateString("uk-UA")}
              </p>
            </div>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="h-4 w-4 mr-2" />
                Завантажити сайт
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Завантажити сайт вручну</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Назва сайту *</Label>
                  <Input
                    value={uploadForm.siteName}
                    onChange={(e) => setUploadForm(f => ({ ...f, siteName: e.target.value }))}
                    placeholder="my-website"
                  />
                </div>
                <div>
                  <Label>Опис/Промпт *</Label>
                  <Textarea
                    value={uploadForm.prompt}
                    onChange={(e) => setUploadForm(f => ({ ...f, prompt: e.target.value }))}
                    placeholder="Опис сайту..."
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Мова</Label>
                    <Select value={uploadForm.language} onValueChange={(v) => setUploadForm(f => ({ ...f, language: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="uk">Українська</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="ru">Русский</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Тип</Label>
                    <Select value={uploadForm.websiteType} onValueChange={(v) => setUploadForm(f => ({ ...f, websiteType: v as "html" | "react" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="html">HTML</SelectItem>
                        <SelectItem value="react">React</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>AI Модель</Label>
                    <Select value={uploadForm.aiModel} onValueChange={(v) => setUploadForm(f => ({ ...f, aiModel: v as "junior" | "senior" }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Користувач *</Label>
                    <Select value={uploadForm.userId} onValueChange={(v) => setUploadForm(f => ({ ...f, userId: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Виберіть" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.map(m => (
                          <SelectItem key={m.id} value={m.user_id}>
                            {m.profile?.display_name || m.user_id.slice(0, 8)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>ZIP файл *</Label>
                  <Input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setZipFile(e.target.files?.[0] || null)}
                  />
                </div>
                <Button onClick={handleUploadSite} disabled={uploading} className="w-full">
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Завантажити
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        {teamStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{teamStats.members}</div>
                <div className="text-xs text-muted-foreground">Членів</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <FileCode className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-2xl font-bold">{teamStats.totalSites}</div>
                <div className="text-xs text-muted-foreground">Сайтів</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-500">{teamStats.completed}</div>
                <div className="text-xs text-muted-foreground">Готово</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-destructive">{teamStats.failed}</div>
                <div className="text-xs text-muted-foreground">Помилки</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Members filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Члени команди
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedMember === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMember(null)}
              >
                Всі ({teamGenerations.length})
              </Button>
              {teamMembers.map(member => {
                const memberGenerations = teamGenerations.filter(g => g.user_id === member.user_id);
                return (
                  <Button
                    key={member.id}
                    variant={selectedMember?.id === member.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedMember(member)}
                  >
                    <User className="h-3 w-3 mr-1" />
                    {member.profile?.display_name || member.user_id.slice(0, 8)}
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {roleLabels[member.role]}
                    </Badge>
                    <span className="ml-1 text-xs">({memberGenerations.length})</span>
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Generations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Історія генерацій ({displayedGenerations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayedGenerations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Немає генерацій</p>
            ) : (
              <div className="space-y-2">
                {displayedGenerations.map((item) => (
                  <Collapsible key={item.id}>
                    <CollapsibleTrigger asChild>
                      <div
                        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer"
                        onClick={() => toggleExpanded(item.id)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform ${expandedItems.has(item.id) ? "rotate-90" : ""}`} />
                          {getStatusIcon(item.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{item.site_name || `Site ${item.number}`}</span>
                              <Badge variant="outline" className="text-xs">{getMemberName(item.user_id!)}</Badge>
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
                          {item.zip_data && (
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-8 mt-2 p-3 rounded-lg bg-muted/50 space-y-2">
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
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Teams list view
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Всі команди ({teams.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">Немає команд</p>
          ) : (
            <div className="space-y-2">
              {teams.map(team => (
                <div
                  key={team.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => fetchTeamDetails(team)}
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(team.created_at).toLocaleDateString("uk-UA")}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
