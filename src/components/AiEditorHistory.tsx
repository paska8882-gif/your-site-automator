import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Eye, Clock, CheckCircle2, XCircle, Bot, RefreshCw, Download, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SimplePreview } from "./SimplePreview";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getLanguageLabel, getGeoLabel } from "@/lib/filterConstants";

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
  error_message: string | null;
  geo: string | null;
  language: string;
  website_type: string | null;
  ai_model: string | null;
}

export function AiEditorHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("generation_history")
        .select("id, number, site_name, prompt, status, created_at, completed_at, files_data, zip_data, error_message, geo, language, website_type, ai_model")
        .eq("ai_model", "openai")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        files_data: item.files_data as GeneratedFile[] | null,
      }));

      setHistory(mapped);
    } catch (error) {
      console.error("Error fetching AI editor history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel("ai-editor-history")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_history",
          filter: "ai_model=eq.openai",
        },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5">
            <Clock className="w-2.5 h-2.5 mr-0.5" />
            Очікування
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-[10px] px-1.5">
            <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" />
            Генерація
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px] px-1.5">
            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
            Готово
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-[10px] px-1.5">
            <XCircle className="w-2.5 h-2.5 mr-0.5" />
            Помилка
          </Badge>
        );
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
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
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleEdit = (item: HistoryItem) => {
    navigate(`/edit/${item.id}`);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-500" />
              Історія AI генерацій
            </div>
            <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && history.length === 0 ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Bot className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">Ще немає AI генерацій</p>
            </div>
          ) : (
            <ScrollArea className="h-[350px] pr-2">
              <div className="space-y-1.5">
                {history.map((item) => {
                  const isCompleted = item.status === "completed";
                  const hasFiles = !!item.files_data || !!item.zip_data;
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1.5 px-2 border rounded hover:bg-muted/50 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-mono text-muted-foreground w-10 shrink-0">
                          #{item.number}
                        </span>
                        <span className="font-medium truncate max-w-[120px]" title={item.site_name || "—"}>
                          {item.site_name || "—"}
                        </span>
                        {getStatusBadge(item.status)}
                        <span className="text-muted-foreground">
                          {format(new Date(item.created_at), "dd.MM.yy HH:mm")}
                        </span>
                        {item.geo && (
                          <span className="text-muted-foreground text-[10px]">{getGeoLabel(item.geo)}</span>
                        )}
                        {item.language && (
                          <span className="text-muted-foreground truncate max-w-[100px] text-[10px]">
                            {item.language.split(",").map(l => getLanguageLabel(l.trim())).join(", ")}
                          </span>
                        )}
                        {getDuration(item) && (
                          <span className="text-green-600 text-[10px]">⏱ {getDuration(item)}</span>
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
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {selectedItem?.site_name || `Сайт #${selectedItem?.number}`}
              {selectedItem?.geo && (
                <Badge variant="outline" className="text-xs">{getGeoLabel(selectedItem.geo)}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {selectedItem?.files_data && (
              <SimplePreview files={selectedItem.files_data} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
