import { useEffect, useState, useRef } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, History, RefreshCw, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, Eye, Code, Pencil, Search, ChevronRight, RotateCcw, Files, FileCode, FileText, File, AlertTriangle, Upload, X, Layers, Filter, CalendarDays } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  completed_at: string | null;
  ai_model: string | null;
  website_type: string | null;
  site_name: string | null;
  sale_price: number | null;
  image_source: string | null;
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

interface Appeal {
  id: string;
  generation_id: string;
  status: string;
}

interface GenerationHistoryProps {
  onUsePrompt?: (siteName: string, prompt: string) => void;
  defaultDateFilter?: "all" | "today" | "week" | "month";
}

interface SingleHistoryItemProps {
  item: HistoryItem;
  expandedId: string | null;
  expandedPromptId: string | null;
  selectedFile: GeneratedFile | null;
  viewMode: "preview" | "code";
  onExpand: (item: HistoryItem) => void;
  onExpandPrompt: (id: string) => void;
  onDownload: (item: HistoryItem) => void;
  onEdit: (id: string) => void;
  onUsePrompt?: (siteName: string, prompt: string) => void;
  onAppeal: (item: HistoryItem) => void;
  onSelectFile: (file: GeneratedFile) => void;
  onViewModeChange: (mode: "preview" | "code") => void;
  getAppeal: (itemId: string) => Appeal | undefined;
  getCssFile: (files: GeneratedFile[] | null) => GeneratedFile | undefined;
  toast: ReturnType<typeof useToast>["toast"];
  compact?: boolean;
  isAdmin?: boolean;
}

function SingleHistoryItem({
  item,
  expandedId,
  expandedPromptId,
  selectedFile,
  viewMode,
  onExpand,
  onExpandPrompt,
  onDownload,
  onEdit,
  onUsePrompt,
  onAppeal,
  onSelectFile,
  onViewModeChange,
  getAppeal,
  getCssFile,
  toast,
  compact = false,
  isAdmin = false,
}: SingleHistoryItemProps) {
  const getStatusIcon = (status: string, salePrice?: number | null) => {
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    switch (status) {
      case "pending": return <Clock className="h-4 w-4 text-muted-foreground" />;
      case "generating": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string, salePrice?: number | null) => {
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return "Помилка, кошти повернено";
    }
    switch (status) {
      case "pending": return "Очікує";
      case "generating": return "Генерація...";
      case "completed": return "Готово";
      case "failed": return "Помилка";
      default: return status;
    }
  };

  return (
    <Collapsible open={expandedId === item.id}>
      <div className={`rounded border ${compact ? "bg-background" : ""}`}>
        <CollapsibleTrigger asChild>
          <div
            className={`flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors ${compact ? "px-2 py-1 gap-2" : "px-3 py-2 gap-3"}`}
            onClick={() => item.status === "completed" && onExpand(item)}
          >
            <div className={`flex items-center flex-1 min-w-0 ${compact ? "gap-2" : "gap-2"}`}>
              <div className="flex items-center" title={getStatusText(item.status, item.sale_price)}>
                {getStatusIcon(item.status, item.sale_price)}
              </div>
              {!compact && (
                <span className="text-sm font-medium truncate max-w-[150px]" title={item.site_name || `Site ${item.number}`}>
                  {item.site_name || `Site ${item.number}`}
                </span>
              )}
              <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                {item.website_type === "react" ? "React" : "HTML"}
              </Badge>
              {item.status === "completed" && (() => {
                const duration = getGenerationDuration(item.created_at, item.completed_at);
                if (duration) {
                  return (
                    <span className={`text-xs ${duration.colorClass}`}>
                      ⏱{duration.text}
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <div className="flex items-center gap-1">
              {onUsePrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
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
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(item.id);
                      }}
                      title="Редагувати"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(item);
                    }}
                    disabled={!item.zip_data}
                    title="Завантажити ZIP"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!getAppeal(item.id) && !compact && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppeal(item);
                      }}
                      title="Подати апеляцію"
                    >
                      <AlertTriangle className="h-4 w-4" />
                    </Button>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedId === item.id ? "rotate-180" : ""}`}
                  />
                </>
              )}
            </div>
          </div>
        </CollapsibleTrigger>


        <CollapsibleContent>
          {/* Детальна інформація */}
          <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">AI модель</span>
                <p className="font-medium">{item.ai_model === "senior" ? "Senior" : "Junior"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Мова</span>
                <p className="font-medium">{item.language}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Фото</span>
                <p className="font-medium">{item.image_source === "ai" ? "AI пошук" : "Базові"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">Ціна</span>
                <p className="font-medium">${item.sale_price || 0}</p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Дата створення</span>
              <p className="text-sm">{new Date(item.created_at).toLocaleString("uk-UA")}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Опис</span>
              <p className="text-sm mt-1 whitespace-pre-wrap">{item.prompt}</p>
            </div>
          </div>

          {item.files_data && item.files_data.length > 0 && (
            <div className="border-t p-4 space-y-4">
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
                              onClick={() => onSelectFile(file)}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                                selectedFile?.path === file.path ? "bg-primary/10 text-primary" : "hover:bg-muted"
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
                    onClick={() => onViewModeChange("preview")}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Превью
                  </Button>
                  <Button
                    variant={viewMode === "code" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onViewModeChange("code")}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Код
                  </Button>
                </div>
              </div>

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

              <div className="border-t pt-4 mt-4">
                {(() => {
                  const appeal = getAppeal(item.id);
                  if (appeal) {
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span>Апеляція:</span>
                        <Badge 
                          variant={appeal.status === "approved" ? "default" : appeal.status === "rejected" ? "destructive" : "outline"}
                        >
                          {appeal.status === "pending" ? "На розгляді" : appeal.status === "approved" ? "Схвалено" : "Відхилено"}
                        </Badge>
                      </div>
                    );
                  }
                  return (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAppeal(item)}
                      className="text-yellow-600 border-yellow-500/50 hover:bg-yellow-500/10"
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Подати апеляцію
                    </Button>
                  );
                })()}
              </div>
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
  );
}

export function GenerationHistory({ onUsePrompt, defaultDateFilter = "all" }: GenerationHistoryProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>(defaultDateFilter);
  const [languageFilter, setLanguageFilter] = useState<string>("all");
  const [aiModelFilter, setAiModelFilter] = useState<string>("all");
  
  const hasActiveFilters = statusFilter !== "all" || typeFilter !== "all" || dateFilter !== "all" || languageFilter !== "all" || aiModelFilter !== "all";
  
  // Get unique languages from history
  const uniqueLanguages = [...new Set(history.map(item => item.language).filter(Boolean))].sort();
  
  // Appeal dialog
  const [appealDialogOpen, setAppealDialogOpen] = useState(false);
  const [appealItem, setAppealItem] = useState<HistoryItem | null>(null);
  const [appealReason, setAppealReason] = useState("");
  const [appealScreenshot, setAppealScreenshot] = useState<File | null>(null);
  const [appealScreenshotPreview, setAppealScreenshotPreview] = useState<string | null>(null);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  const fetchHistory = async () => {
    setIsLoading(true);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    // Fetch only current user's generations
    const { data, error } = await supabase
      .from("generation_history")
      .select("*")
      .eq("user_id", user.id)
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

    // Fetch user's appeals
    const { data: appealsData } = await supabase
      .from("appeals")
      .select("id, generation_id, status")
      .eq("user_id", user.id);
    
    setAppeals(appealsData || []);
    setIsLoading(false);
  };

  // Check for stale generations (older than 30 minutes) and mark them as failed with refund
  // NOTE: best-effort; must not spam backend when unhealthy.
  const staleCheckStateRef = useRef({
    failureCount: 0,
    nextAllowedAt: 0,
    lastToastAt: 0,
  });

  const checkStaleGenerations = async () => {
    const state = staleCheckStateRef.current;

    // Backoff guard
    if (Date.now() < state.nextAllowedAt) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.nextAllowedAt = Date.now() + 60_000;
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-stale-generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`cleanup-stale-generations failed: ${response.status}`);
      }

      const result = await response.json();

      state.failureCount = 0;
      state.nextAllowedAt = Date.now() + 5 * 60_000; // success: don't run often

      if (result.processed > 0) {
        console.log(`Stale cleanup: ${result.processed} processed, ${result.refunded} refunded`);
        fetchHistory();
      }
    } catch (error) {
      state.failureCount += 1;
      const backoffMs = Math.min(30 * 60_000, 30_000 * Math.pow(2, state.failureCount - 1));
      state.nextAllowedAt = Date.now() + backoffMs;

      if (Date.now() - state.lastToastAt > 5 * 60_000) {
        state.lastToastAt = Date.now();
        toast({
          title: "Бекенд тимчасово недоступний",
          description: "Деякі дані можуть не завантажуватись. Спробуйте пізніше.",
          variant: "destructive",
        });
      }

      console.error("Error checking stale generations:", error);
    } finally {
      clearTimeout(timeout);
    }
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let staleCheckInterval: NodeJS.Timeout | null = null;

    const setupRealtimeAndFetch = async () => {
      await fetchHistory();
      
      // Check for stale generations on load and every minute
      await checkStaleGenerations();
      staleCheckInterval = setInterval(checkStaleGenerations, 60 * 1000);
      
      // Get current user for realtime filter
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Subscribe to realtime updates for current user only
      channel = supabase
        .channel("generation_history_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "generation_history",
            filter: `user_id=eq.${user.id}`,
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
    };

    setupRealtimeAndFetch();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (staleCheckInterval) {
        clearInterval(staleCheckInterval);
      }
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

  const handleDownloadAll = async (items: HistoryItem[]) => {
    const completedItems = items.filter(item => item.status === "completed" && item.zip_data);
    
    if (completedItems.length === 0) {
      toast({
        title: "Немає файлів",
        description: "Немає завершених генерацій для завантаження",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Завантаження",
      description: `Завантажуємо ${completedItems.length} файлів...`,
    });

    // Download each file with a small delay to prevent browser blocking
    for (let i = 0; i < completedItems.length; i++) {
      const item = completedItems[i];
      try {
        const byteCharacters = atob(item.zip_data!);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/zip" });

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

        // Small delay between downloads
        if (i < completedItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error("Download error for item:", item.id, error);
      }
    }

    toast({
      title: "Готово",
      description: `Завантажено ${completedItems.length} ZIP-архівів`,
    });
  };


  const truncatePrompt = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  const getStatusIcon = (status: string, salePrice?: number | null) => {
    // Check if this is a refunded failed generation
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    
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

  const getStatusText = (status: string, salePrice?: number | null) => {
    // Check if this is a refunded failed generation
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return "Помилка, кошти повернено";
    }
    
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

  const getAppealForItem = (itemId: string) => {
    return appeals.find(a => a.generation_id === itemId);
  };

  const openAppealDialog = (item: HistoryItem) => {
    setAppealItem(item);
    setAppealReason("");
    setAppealScreenshot(null);
    setAppealScreenshotPreview(null);
    setAppealDialogOpen(true);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Файл занадто великий",
          description: "Максимальний розмір файлу 5 МБ",
          variant: "destructive"
        });
        return;
      }
      setAppealScreenshot(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setAppealScreenshotPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setAppealScreenshot(null);
    setAppealScreenshotPreview(null);
  };

  const submitAppeal = async () => {
    if (!appealItem || !appealReason.trim()) return;
    
    setSubmittingAppeal(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get user's team (optional - users without teams can still submit appeals)
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      // Upload screenshot if provided
      let screenshotUrl: string | null = null;
      if (appealScreenshot) {
        const fileExt = appealScreenshot.name.split('.').pop();
        const fileName = `${user.id}/${appealItem.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('appeal-screenshots')
          .upload(fileName, appealScreenshot);

        if (uploadError) {
          console.error("Screenshot upload error:", uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('appeal-screenshots')
            .getPublicUrl(fileName);
          screenshotUrl = publicUrl;
        }
      }

      const { error } = await supabase
        .from("appeals")
        .insert({
          generation_id: appealItem.id,
          user_id: user.id,
          team_id: membership?.team_id || null,
          reason: appealReason.trim(),
          amount_to_refund: appealItem.sale_price || 0,
          screenshot_url: screenshotUrl
        });

      if (error) throw error;

      toast({
        title: "Апеляцію надіслано",
        description: membership 
          ? "Адміністратор розгляне вашу апеляцію найближчим часом" 
          : "Апеляцію прийнято. Адміністратор зв'яжеться з вами для уточнення деталей"
      });

      setAppealDialogOpen(false);
      setAppealItem(null);
      setAppealReason("");
      setAppealScreenshot(null);
      setAppealScreenshotPreview(null);
      fetchHistory();
    } catch (error) {
      console.error("Error submitting appeal:", error);
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося надіслати апеляцію",
        variant: "destructive"
      });
    }
    
    setSubmittingAppeal(false);
  };

  const filteredHistory = history.filter((item) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = (item.site_name?.toLowerCase().includes(query)) ||
        (item.prompt?.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "in_progress") {
        if (item.status !== "pending" && item.status !== "generating") return false;
      } else if (item.status !== statusFilter) {
        return false;
      }
    }
    
    // Type filter
    if (typeFilter !== "all" && item.website_type !== typeFilter) {
      return false;
    }
    
    // Date filter
    if (dateFilter !== "all") {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      
      if (dateFilter === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (itemDate < today) return false;
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (itemDate < weekAgo) return false;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (itemDate < monthAgo) return false;
      }
    }
    
    // Language filter
    if (languageFilter !== "all" && item.language !== languageFilter) {
      return false;
    }
    
    // AI Model filter
    if (aiModelFilter !== "all" && item.ai_model !== aiModelFilter) {
      return false;
    }
    
    return true;
  });

  // Group items by batch (same site_name, created within 60 seconds)
  interface BatchGroup {
    key: string;
    siteName: string;
    items: HistoryItem[];
    createdAt: Date;
  }

  const groupedHistory = (): (HistoryItem | BatchGroup)[] => {
    const groups: Map<string, BatchGroup> = new Map();
    const standalone: HistoryItem[] = [];
    
    // Sort by created_at descending first
    const sorted = [...filteredHistory].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    for (const item of sorted) {
      if (!item.site_name) {
        standalone.push(item);
        continue;
      }
      
      // Find existing group with same site_name within 60 seconds
      let foundGroup = false;
      for (const [, group] of groups) {
        if (group.siteName === item.site_name) {
          const timeDiff = Math.abs(group.createdAt.getTime() - new Date(item.created_at).getTime());
          if (timeDiff < 60000) { // Within 60 seconds
            group.items.push(item);
            foundGroup = true;
            break;
          }
        }
      }
      
      if (!foundGroup) {
        // Create new group or add as standalone
        const key = `${item.site_name}-${item.created_at}`;
        groups.set(key, {
          key,
          siteName: item.site_name,
          items: [item],
          createdAt: new Date(item.created_at)
        });
      }
    }
    
    // Convert groups to array and combine with standalone
    const result: (HistoryItem | BatchGroup)[] = [];
    
    // Collect all items with their original timestamps for sorting
    const allItems: { item: HistoryItem | BatchGroup; timestamp: number }[] = [];
    
    for (const [, group] of groups) {
      if (group.items.length === 1) {
        allItems.push({ item: group.items[0], timestamp: new Date(group.items[0].created_at).getTime() });
      } else {
        allItems.push({ item: group, timestamp: group.createdAt.getTime() });
      }
    }
    
    for (const item of standalone) {
      allItems.push({ item, timestamp: new Date(item.created_at).getTime() });
    }
    
    // Sort by timestamp descending
    allItems.sort((a, b) => b.timestamp - a.timestamp);
    
    return allItems.map(i => i.item);
  };

  const isBatchGroup = (item: HistoryItem | BatchGroup): item is BatchGroup => {
    return 'items' in item && Array.isArray(item.items);
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  if (history.length === 0 && !isLoading) {
    return null;
  }

  return (
    <Card className="mt-4">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Історія генерацій
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              placeholder="Пошук..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-7 text-xs"
            />
          </div>
          
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={`h-7 px-2 text-xs gap-1 ${hasActiveFilters ? "border-primary text-primary" : ""}`}
              >
                <Filter className="h-3 w-3" />
                Фільтри
                {hasActiveFilters && <span className="ml-1 px-1 bg-primary text-primary-foreground rounded text-[10px]">!</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex flex-wrap gap-1.5">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[90px] h-7 text-xs">
                    <SelectValue placeholder="Статус" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі</SelectItem>
                    <SelectItem value="completed">Готово</SelectItem>
                    <SelectItem value="in_progress">В процесі</SelectItem>
                    <SelectItem value="failed">Помилка</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[70px] h-7 text-xs">
                    <SelectValue placeholder="Тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі</SelectItem>
                    <SelectItem value="html">HTML</SelectItem>
                    <SelectItem value="react">React</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger className="w-[90px] h-7 text-xs">
                    <SelectValue placeholder="Дата" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Весь час</SelectItem>
                    <SelectItem value="today">Сьогодні</SelectItem>
                    <SelectItem value="week">Тиждень</SelectItem>
                    <SelectItem value="month">Місяць</SelectItem>
                  </SelectContent>
                </Select>
                
                {uniqueLanguages.length > 1 && (
                  <Select value={languageFilter} onValueChange={setLanguageFilter}>
                    <SelectTrigger className="w-[70px] h-7 text-xs">
                      <SelectValue placeholder="Мова" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі</SelectItem>
                      {uniqueLanguages.map(lang => (
                        <SelectItem key={lang} value={lang}>{lang.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                <Select value={aiModelFilter} onValueChange={setAiModelFilter}>
                  <SelectTrigger className="w-[65px] h-7 text-xs">
                    <SelectValue placeholder="AI" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs mt-2 w-full"
                  onClick={() => {
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setDateFilter("all");
                    setLanguageFilter("all");
                    setAiModelFilter("all");
                  }}
                >
                  <X className="h-3 w-3 mr-1" />
                  Скинути
                </Button>
              )}
            </PopoverContent>
          </Popover>
          
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 py-2">
        <div className="space-y-1.5">
          {groupedHistory().map((entry) => {
            if (isBatchGroup(entry)) {
              // Render batch group
              const group = entry;
              const isGroupExpanded = expandedGroups.has(group.key);
              const completedCount = group.items.filter(i => i.status === "completed").length;
              const pendingCount = group.items.filter(i => i.status === "pending" || i.status === "generating").length;
              const failedCount = group.items.filter(i => i.status === "failed").length;
              const totalCost = group.items.reduce((sum, i) => sum + (i.sale_price || 0), 0);
              
              return (
                <div key={group.key} className="rounded border bg-muted/20">
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Layers className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium truncate">{group.siteName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {group.items.length}
                      </Badge>
                      {completedCount > 0 && (
                        <Badge variant="outline" className="text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {completedCount}
                        </Badge>
                      )}
                      {pendingCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          {pendingCount}
                        </Badge>
                      )}
                      {failedCount > 0 && (
                        <Badge variant="outline" className="text-xs text-destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          {failedCount}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground hidden md:block">
                        {new Date(group.createdAt).toLocaleString("uk-UA")}
                      </span>
                      {totalCost > 0 && (
                        <Badge variant="secondary" className="text-xs font-semibold">
                          ${totalCost.toFixed(0)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {completedCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadAll(group.items);
                          }}
                          title="Завантажити всі ZIP"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          <span className="text-xs">Всі</span>
                        </Button>
                      )}
                      <ChevronDown className={`h-4 w-4 transition-transform ${isGroupExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  
                  {isGroupExpanded && (
                    <div className="border-t space-y-1 p-2">
                      {group.items.map((item) => (
                        <SingleHistoryItem
                          key={item.id}
                          item={item}
                          expandedId={expandedId}
                          expandedPromptId={expandedPromptId}
                          selectedFile={selectedFile}
                          viewMode={viewMode}
                          onExpand={handleExpand}
                          onExpandPrompt={(id) => setExpandedPromptId(expandedPromptId === id ? null : id)}
                          onDownload={handleDownload}
                          onEdit={(id) => navigate(`/edit/${id}`)}
                          onUsePrompt={onUsePrompt}
                          onAppeal={openAppealDialog}
                          onSelectFile={setSelectedFile}
                          onViewModeChange={setViewMode}
                          getAppeal={getAppealForItem}
                          getCssFile={getCssFile}
                          toast={toast}
                          compact
                          isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            } else {
              // Render single item
              const item = entry;
              return (
                <SingleHistoryItem
                  key={item.id}
                  item={item}
                  expandedId={expandedId}
                  expandedPromptId={expandedPromptId}
                  selectedFile={selectedFile}
                  viewMode={viewMode}
                  onExpand={handleExpand}
                  onExpandPrompt={(id) => setExpandedPromptId(expandedPromptId === id ? null : id)}
                  onDownload={handleDownload}
                  onEdit={(id) => navigate(`/edit/${id}`)}
                  onUsePrompt={onUsePrompt}
                  onAppeal={openAppealDialog}
                  onSelectFile={setSelectedFile}
                  onViewModeChange={setViewMode}
                  getAppeal={getAppealForItem}
                  getCssFile={getCssFile}
                  toast={toast}
                  isAdmin={isAdmin}
                />
              );
            }
          })}
        </div>
      </CardContent>

      {/* Appeal Dialog */}
      <Dialog open={appealDialogOpen} onOpenChange={setAppealDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Апеляція на генерацію</DialogTitle>
          </DialogHeader>
          {appealItem && (
            <div className="space-y-4">
              <div className="text-sm">
                <p><span className="text-muted-foreground">Сайт:</span> {appealItem.site_name}</p>
                <p><span className="text-muted-foreground">Сума:</span> ${appealItem.sale_price?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Причина апеляції</label>
                <Textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder="Опишіть, чому ви вважаєте, що генерація не відповідає вашим вимогам..."
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Скріншот помилки (необов'язково)</label>
                {appealScreenshotPreview ? (
                  <div className="mt-2 relative">
                    <img 
                      src={appealScreenshotPreview} 
                      alt="Скріншот" 
                      className="max-h-40 rounded border object-contain"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={removeScreenshot}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Завантажити зображення (до 5 МБ)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAppealDialogOpen(false)}>
                  Скасувати
                </Button>
                <Button 
                  onClick={submitAppeal} 
                  disabled={!appealReason.trim() || submittingAppeal}
                >
                  {submittingAppeal ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mr-2" />
                  )}
                  Надіслати апеляцію
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
