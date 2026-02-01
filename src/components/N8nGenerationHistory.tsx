import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Eye, Clock, CheckCircle2, XCircle, Bot, FileCode2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SimplePreview } from "./SimplePreview";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { format } from "date-fns";

interface HistoryItem {
  id: string;
  number: number;
  site_name: string | null;
  prompt: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  files_data: GeneratedFile[] | null;
  error_message: string | null;
  geo: string | null;
  language: string;
}

export function N8nGenerationHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<HistoryItem | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("generation_history")
        .select("id, number, site_name, prompt, status, created_at, completed_at, files_data, error_message, geo, language")
        .eq("image_source", "n8n-bot")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const mapped = (data || []).map((item: any) => ({
        ...item,
        files_data: item.files_data as GeneratedFile[] | null,
      }));

      setHistory(mapped);
    } catch (error) {
      console.error("Error fetching n8n history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    // Realtime subscription for new generations
    const channel = supabase
      .channel("n8n-history")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_history",
          filter: "image_source=eq.n8n-bot",
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

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Історія n8n генерацій
            </div>
            <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
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
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{item.number}
                        </span>
                        <span className="font-medium truncate">
                          {item.site_name || "Без назви"}
                        </span>
                        {getStatusBadge(item.status)}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{format(new Date(item.created_at), "dd.MM.yy HH:mm")}</span>
                        {item.geo && <Badge variant="secondary" className="text-xs">{item.geo}</Badge>}
                        {item.language && (
                          <span className="truncate max-w-[100px]">{item.language}</span>
                        )}
                        {getDuration(item) && (
                          <span className="text-green-600">⏱ {getDuration(item)}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item);
                        setShowPreview(true);
                      }}
                      disabled={item.status !== "completed" || !item.files_data}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
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
                websiteType="html"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Дані недоступні
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
