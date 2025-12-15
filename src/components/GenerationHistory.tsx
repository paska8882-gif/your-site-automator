import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Download, Trash2, History, RefreshCw, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, Eye, Code, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FilePreview } from "./FilePreview";
import { GeneratedFile } from "@/lib/websiteGenerator";

interface HistoryItem {
  id: string;
  number: number;
  prompt: string;
  language: string;
  zip_data: string | null;
  files_data: GeneratedFile[] | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function GenerationHistory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("generation_history")
      .select("*")
      .order("number", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити історію",
        variant: "destructive",
      });
    } else {
      const typedData = (data || []).map(item => ({
        ...item,
        files_data: item.files_data as unknown as GeneratedFile[] | null
      }));
      setHistory(typedData);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchHistory();

    // Subscribe to realtime updates
    const channel = supabase
      .channel("generation_history_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "generation_history",
        },
        (payload) => {
          console.log("Realtime update:", payload);
          
          if (payload.eventType === "INSERT") {
            const newItem = {
              ...payload.new,
              files_data: payload.new.files_data as GeneratedFile[] | null
            } as HistoryItem;
            setHistory((prev) => [newItem, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setHistory((prev) =>
              prev.map((item) => {
                if (item.id === payload.new.id) {
                  return {
                    ...item,
                    ...payload.new,
                    files_data: (payload.new.files_data as GeneratedFile[] | null) ?? item.files_data
                  };
                }
                return item;
              })
            );
          } else if (payload.eventType === "DELETE") {
            setHistory((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDownload = (item: HistoryItem) => {
    if (!item.zip_data) {
      toast({
        title: "Помилка",
        description: "ZIP-файл недоступний",
        variant: "destructive",
      });
      return;
    }

    try {
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
      a.download = `website_${item.number}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Завантаження",
        description: "ZIP-архів завантажено",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити файл",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("generation_history")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити запис",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Видалено",
        description: "Запис успішно видалено",
      });
    }
  };

  const truncatePrompt = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "generating":
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Очікує";
      case "generating":
        return "Генерація...";
      case "completed":
        return "Готово";
      case "failed":
        return "Помилка";
      default:
        return status;
    }
  };

  const handleExpand = (item: HistoryItem) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setSelectedFile(null);
    } else {
      setExpandedId(item.id);
      if (item.files_data && item.files_data.length > 0) {
        const indexFile = item.files_data.find((f) => f.path === "index.html");
        setSelectedFile(indexFile || item.files_data[0]);
      }
    }
  };

  const getCssFile = (files: GeneratedFile[] | null) => {
    if (!files) return undefined;
    return files.find((f) => f.path === "styles.css");
  };

  if (history.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Історія генерацій
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {history.map((item) => (
            <Collapsible key={item.id} open={expandedId === item.id}>
              <div className="rounded-md border">
                <CollapsibleTrigger asChild>
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => item.status === "completed" && handleExpand(item)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <span className="font-medium text-muted-foreground w-8">
                        #{item.number}
                      </span>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(item.status)}
                        <span className="text-sm">{getStatusText(item.status)}</span>
                      </div>
                      <span className="truncate flex-1" title={item.prompt}>
                        {truncatePrompt(item.prompt, 60)}
                      </span>
                      <span className="text-sm text-muted-foreground hidden sm:block">
                        {item.language}
                      </span>
                      <span className="text-sm text-muted-foreground hidden md:block">
                        {new Date(item.created_at).toLocaleString("uk-UA")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {item.status === "completed" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/edit/${item.id}`);
                            }}
                            title="Редагувати"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(item);
                            }}
                            disabled={!item.zip_data}
                            title="Завантажити ZIP"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              expandedId === item.id ? "rotate-180" : ""
                            }`}
                          />
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        title="Видалити"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  {item.files_data && item.files_data.length > 0 && (
                    <div className="border-t p-4 space-y-4">
                      {/* File tabs */}
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex flex-wrap gap-2">
                          {item.files_data.map((file) => (
                            <Button
                              key={file.path}
                              variant={selectedFile?.path === file.path ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedFile(file)}
                            >
                              {file.path}
                            </Button>
                          ))}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant={viewMode === "preview" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("preview")}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Превью
                          </Button>
                          <Button
                            variant={viewMode === "code" ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setViewMode("code")}
                          >
                            <Code className="h-4 w-4 mr-1" />
                            Код
                          </Button>
                        </div>
                      </div>

                      {/* Preview */}
                      {selectedFile && (
                        <div className="h-[500px]">
                          <FilePreview
                            file={selectedFile}
                            cssFile={getCssFile(item.files_data)}
                            viewMode={viewMode}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {item.error_message && (
                    <div className="border-t p-4">
                      <p className="text-sm text-destructive">
                        Помилка: {item.error_message}
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
