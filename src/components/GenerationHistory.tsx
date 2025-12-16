import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, History, RefreshCw, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, Eye, Code, Pencil, Search, ChevronRight, RotateCcw, Files, FileCode, FileText, File } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FilePreview } from "./FilePreview";
import { GeneratedFile } from "@/lib/websiteGenerator";

function getFileIcon(path: string) {
  const fileName = path.split("/").pop() || path;
  if (fileName.endsWith(".html")) return <FileCode className="h-4 w-4 text-orange-500" />;
  if (fileName.endsWith(".css")) return <FileCode className="h-4 w-4 text-blue-500" />;
  if (fileName.endsWith(".js") || fileName.endsWith(".jsx")) return <FileCode className="h-4 w-4 text-yellow-500" />;
  if (fileName.endsWith(".json")) return <FileText className="h-4 w-4 text-green-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

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
  ai_model: string | null;
  website_type: string | null;
  site_name: string | null;
}

interface GenerationHistoryProps {
  onUsePrompt?: (siteName: string, prompt: string) => void;
}

export function GenerationHistory({ onUsePrompt }: GenerationHistoryProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [searchQuery, setSearchQuery] = useState("");

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

      // Generate filename: siteName-language-type-aiModel.zip
      const siteName = item.site_name || `website_${item.number}`;
      const lang = item.language?.toUpperCase() || "AUTO";
      const type = item.website_type?.toUpperCase() || "HTML";
      const aiLabel = item.ai_model === "senior" ? "Senior_AI" : "Junior_AI";
      const filename = `${siteName}-${lang}-${type}-${aiLabel}.zip`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
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

  const filteredHistory = history.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.site_name?.toLowerCase().includes(query)) ||
      (item.prompt?.toLowerCase().includes(query))
    );
  });

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
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Пошук за назвою або промптом..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {filteredHistory.map((item) => (
            <Collapsible key={item.id} open={expandedId === item.id}>
              <div className="rounded-md border">
                <CollapsibleTrigger asChild>
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => item.status === "completed" && handleExpand(item)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center" title={getStatusText(item.status)}>
                        {getStatusIcon(item.status)}
                      </div>
                      <span className="font-medium truncate flex-1" title={item.site_name || `Site ${item.number}`}>
                        {item.site_name || `Site ${item.number}`}
                      </span>
                      <Badge variant={item.ai_model === "senior" ? "default" : "secondary"} className="text-xs">
                        {item.ai_model === "senior" ? "Senior AI" : "Junior AI"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {item.website_type === "react" ? "React" : "HTML"}
                      </Badge>
                      <span className="text-sm text-muted-foreground hidden sm:block">
                        {item.language}
                      </span>
                      <span className="text-sm text-muted-foreground hidden md:block">
                        {new Date(item.created_at).toLocaleString("uk-UA")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {onUsePrompt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUsePrompt(item.site_name || "", item.prompt);
                            toast({
                              title: "Промпт завантажено",
                              description: "Назва та опис підтягнуті з історії",
                            });
                          }}
                          title="Використати промпт"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
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
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Expandable details: domain + prompt */}
                <div 
                  className="flex items-start gap-2 px-4 py-2 border-t bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedPromptId(expandedPromptId === item.id ? null : item.id);
                  }}
                >
                  <ChevronRight 
                    className={`h-4 w-4 mt-0.5 text-muted-foreground transition-transform flex-shrink-0 ${
                      expandedPromptId === item.id ? "rotate-90" : ""
                    }`} 
                  />
                  <div className={`text-sm ${expandedPromptId === item.id ? "" : "line-clamp-1"}`}>
                    <span className="font-medium">{item.site_name || `Site ${item.number}`}</span>
                    <span className="text-muted-foreground"> — {item.prompt}</span>
                  </div>
                </div>

                <CollapsibleContent>
                  {item.files_data && item.files_data.length > 0 && (
                    <div className="border-t p-4 space-y-4">
                      {/* Controls row */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-2">
                                <Files className="h-4 w-4" />
                                Файли ({item.files_data.length})
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0" align="start">
                              <ScrollArea className="h-64">
                                <div className="p-2 space-y-1">
                                  {item.files_data.map((file) => (
                                    <div
                                      key={file.path}
                                      onClick={() => setSelectedFile(file)}
                                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                                        selectedFile?.path === file.path
                                          ? "bg-primary/10 text-primary"
                                          : "hover:bg-muted"
                                      }`}
                                    >
                                      {getFileIcon(file.path)}
                                      <span className="truncate">{file.path}</span>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                          {selectedFile && (
                            <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {selectedFile.path}
                            </span>
                          )}
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
                            allFiles={item.files_data || undefined}
                            websiteType={item.website_type || undefined}
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
