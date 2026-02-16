import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Eye, Clock, CheckCircle2, XCircle, Bot, FileCode2, RefreshCw, Download, Pencil, AlertTriangle, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SimplePreview } from "./SimplePreview";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getLanguageLabel, getGeoLabel } from "@/lib/filterConstants";


// Bot options for filtering
const BOT_OPTIONS = [
  { id: "all", label: "Всі боти" },
  { id: "n8n-bot-2lang_html", label: "2lang HTML" },
  { id: "nextjs", label: "Next.js" },
  { id: "n8n-bot", label: "Legacy" },
] as const;

// All image_source values used by n8n/beta generators
const ALL_N8N_IMAGE_SOURCES = ["n8n-bot-2lang_html", "n8n-bot-nextjs_bot", "n8n-bot", "nextjs"];

interface HistoryItem {
  id: string;
  number: number;
  site_name: string | null;
  prompt: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  files_data: GeneratedFile[] | null;
  zip_data: string | null;
  download_url: string | null;
  error_message: string | null;
  geo: string | null;
  language: string;
  website_type: string | null;
  ai_model: string | null;
  sale_price: number | null;
  team_id: string | null;
  image_source: string | null;
}

interface Appeal {
  id: string;
  status: string;
  reason: string;
  admin_comment: string | null;
}

export function N8nGenerationHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState<string>("all");
  
  // Appeal state
  const [appealItem, setAppealItem] = useState<HistoryItem | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [appealScreenshots, setAppealScreenshots] = useState<File[]>([]);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appeals, setAppeals] = useState<Map<string, Appeal>>(new Map());


  const fetchHistory = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("generation_history")
        .select("id, number, site_name, prompt, status, created_at, completed_at, files_data, zip_data, download_url, error_message, geo, language, website_type, ai_model, sale_price, team_id, image_source")
        .order("created_at", { ascending: false })
        .limit(50);

      // Filter by bot
      if (botFilter === "all") {
        query = query.in("image_source", ALL_N8N_IMAGE_SOURCES);
      } else {
        query = query.eq("image_source", botFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        files_data: item.files_data as GeneratedFile[] | null,
      }));

      setHistory(mapped);
      
      // Fetch appeals for completed items
      const completedIds = mapped.filter(i => i.status === "completed").map(i => i.id);
      if (completedIds.length > 0) {
        const { data: appealsData } = await supabase
          .from("appeals")
          .select("id, status, reason, admin_comment, generation_id")
          .in("generation_id", completedIds);
        
        if (appealsData) {
          const appealsMap = new Map<string, Appeal>();
          appealsData.forEach((a: any) => {
            appealsMap.set(a.generation_id, {
              id: a.id,
              status: a.status,
              reason: a.reason,
              admin_comment: a.admin_comment,
            });
          });
          setAppeals(appealsMap);
        }
      }
    } catch (error) {
      console.error("Error fetching n8n history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel("n8n-history")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_history",
        },
        (payload: any) => {
          // Only refetch if the change is relevant to n8n/beta generators
          const source = payload?.new?.image_source || payload?.old?.image_source;
          if (!source || ALL_N8N_IMAGE_SOURCES.some(s => source.startsWith(s))) {
            fetchHistory();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [botFilter]);

  // Refetch when filter changes
  useEffect(() => {
    fetchHistory();
  }, [botFilter]);

  const getBotLabel = (imageSource: string | null) => {
    if (!imageSource) return null;
    if (imageSource === "n8n-bot-2lang_html") return "HTML";
    if (imageSource === "n8n-bot-nextjs_bot") return "Next.js";
    if (imageSource === "n8n-bot") return "Legacy";
    return null;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Очікування
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Генерація
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Готово
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Помилка
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  const getDuration = (item: HistoryItem) => {
    if (!item.completed_at) return null;
    const start = new Date(item.created_at).getTime();
    const end = new Date(item.completed_at).getTime();
    const seconds = Math.floor((end - start) / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDownload = async (item: HistoryItem) => {
    // Direct download URL (ZIP passthrough from n8n)
    if (item.download_url) {
      const a = document.createElement("a");
      a.href = item.download_url;
      a.download = `${item.site_name || `site-${item.number}`}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({
        title: "Завантажено",
        description: `${item.site_name || `Site ${item.number}`}.zip`,
      });
      return;
    }

    if (!item.zip_data && !item.files_data) {
      toast({
        title: "Помилка",
        description: "Немає даних для завантаження",
        variant: "destructive",
      });
      return;
    }

    setDownloadingId(item.id);
    try {
      let blob: Blob;
      
      if (item.zip_data) {
        const binary = atob(item.zip_data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: "application/zip" });
      } else if (item.files_data) {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        item.files_data.forEach((file) => zip.file(file.path, file.content));
        blob = await zip.generateAsync({ type: "blob" });
      } else {
        throw new Error("No data available");
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.site_name || `site-${item.number}`}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Завантажено",
        description: `${item.site_name || `Site ${item.number}`}.zip`,
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Помилка завантаження",
        description: "Не вдалося завантажити архів",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEdit = (item: HistoryItem) => {
    navigate(`/edit/${item.id}`);
  };

  const handleAppealOpen = (item: HistoryItem) => {
    setAppealItem(item);
    setAppealReason("");
    setAppealScreenshots([]);
  };

  const handleAppealSubmit = async () => {
    if (!appealItem || !appealReason.trim()) return;

    setSubmittingAppeal(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload screenshots if any
      let screenshotUrls: string[] = [];
      if (appealScreenshots.length > 0) {
        for (const file of appealScreenshots) {
          const fileName = `${appealItem.id}/${Date.now()}-${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("appeal-screenshots")
            .upload(fileName, file);
          
          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from("appeal-screenshots")
              .getPublicUrl(fileName);
            screenshotUrls.push(urlData.publicUrl);
          }
        }
      }

      // Create appeal
      const { error } = await supabase.from("appeals").insert({
        generation_id: appealItem.id,
        user_id: user.id,
        team_id: appealItem.team_id,
        reason: appealReason,
        amount_to_refund: appealItem.sale_price || 0,
        screenshot_urls: screenshotUrls.length > 0 ? screenshotUrls : null,
      });

      if (error) throw error;

      toast({
        title: "Апеляцію подано",
        description: "Адміністратор розгляне вашу апеляцію найближчим часом",
      });

      setAppealItem(null);
      fetchHistory();
    } catch (error) {
      console.error("Appeal error:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося подати апеляцію",
        variant: "destructive",
      });
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const getAppealStatus = (itemId: string) => {
    return appeals.get(itemId);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Історія n8n генерацій
            </div>
            <div className="flex items-center gap-2">
              <select 
                value={botFilter} 
                onChange={(e) => setBotFilter(e.target.value)}
                className="text-xs border rounded px-2 py-1 bg-background"
              >
                {BOT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bot className="h-12 w-12 mb-3 opacity-20" />
              <p>Ще немає генерацій через n8n</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2">
                {history.map((item) => {
                  const existingAppeal = getAppealStatus(item.id);
                  const isCompleted = item.status === "completed";
                  const hasFiles = !!item.download_url || !!item.files_data || !!item.zip_data;
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 border rounded hover:bg-muted/50 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-mono text-muted-foreground w-12 shrink-0">
                          #{item.number}
                        </span>
                        <span className="font-medium truncate max-w-[140px]">
                          {item.site_name || "—"}
                        </span>
                        {getStatusBadge(item.status)}
                        {item.website_type && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {item.website_type.toUpperCase()}
                          </Badge>
                        )}
                        {getBotLabel(item.image_source) && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {getBotLabel(item.image_source)}
                          </Badge>
                        )}
                        <span className="text-muted-foreground">{format(new Date(item.created_at), "dd.MM.yy HH:mm")}</span>
                        {item.geo && (
                          <span className="text-muted-foreground">{getGeoLabel(item.geo)}</span>
                        )}
                        {item.language && (
                          <span className="text-muted-foreground truncate max-w-[120px]">
                            {item.language.split(",").map(l => getLanguageLabel(l.trim())).join(", ")}
                          </span>
                        )}
                        {getDuration(item) && (
                          <span className="text-green-600">⏱ {getDuration(item)}</span>
                        )}
                        {existingAppeal && (
                          <Badge 
                            variant={existingAppeal.status === "approved" ? "default" : existingAppeal.status === "rejected" ? "destructive" : "secondary"}
                            className="text-[10px] px-1 py-0"
                          >
                            {existingAppeal.status === "approved" ? "✓" : 
                             existingAppeal.status === "rejected" ? "✗" : "⏳"}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => {
                                  setSelectedItem(item);
                                  setShowPreview(true);
                                }}
                                disabled={!isCompleted || !item.files_data}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Превью</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleDownload(item)}
                                disabled={!isCompleted || !hasFiles || downloadingId === item.id}
                              >
                                {downloadingId === item.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ZIP</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleEdit(item)}
                                disabled={!isCompleted || !item.files_data}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Редагувати</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-6 w-6 ${existingAppeal ? "text-muted-foreground" : "text-orange-500 hover:text-orange-600"}`}
                                onClick={() => handleAppealOpen(item)}
                                disabled={!isCompleted || !!existingAppeal}
                              >
                                <AlertTriangle className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {existingAppeal ? "Апеляція подана" : "Апеляція"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview && !!selectedItem} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              {selectedItem?.site_name || "Превью сайту"}
              <Badge variant="secondary" className="ml-2">
                #{selectedItem?.number}
              </Badge>
              {selectedItem?.files_data && (
                <span className="text-sm text-muted-foreground font-normal">
                  ({selectedItem.files_data.length} файлів)
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedItem?.files_data ? (
            <div className="flex-1 h-[calc(90vh-100px)] border rounded-lg overflow-hidden">
              <SimplePreview
                files={selectedItem.files_data}
                websiteType={selectedItem.website_type as "html" | "react" | "php" || "html"}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Дані недоступні
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Appeal Dialog */}
      <Dialog open={!!appealItem} onOpenChange={(open) => !open && setAppealItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Подати апеляцію
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Генерація</Label>
              <p className="text-sm text-muted-foreground">
                #{appealItem?.number} - {appealItem?.site_name || "Без назви"}
              </p>
            </div>
            
            <div>
              <Label htmlFor="reason">Причина апеляції *</Label>
              <Textarea
                id="reason"
                placeholder="Опишіть проблему з генерацією..."
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                rows={4}
              />
            </div>

            <div>
              <Label>Скріншоти (необов'язково)</Label>
              <Input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  if (e.target.files) {
                    setAppealScreenshots(Array.from(e.target.files));
                  }
                }}
              />
              {appealScreenshots.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Вибрано: {appealScreenshots.length} файл(ів)
                </p>
              )}
            </div>

            {appealItem?.sale_price && appealItem.sale_price > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  Сума до повернення: <strong>${appealItem.sale_price.toFixed(2)}</strong>
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAppealItem(null)}>
              Скасувати
            </Button>
            <Button 
              onClick={handleAppealSubmit} 
              disabled={!appealReason.trim() || submittingAppeal}
            >
              {submittingAppeal ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Відправка...
                </>
              ) : (
                "Подати апеляцію"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}