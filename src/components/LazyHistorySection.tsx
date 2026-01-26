import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Download, 
  History, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  Eye, 
  Pencil, 
  RotateCcw, 
  Copy,
  FileCode,
  MonitorPlay,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { useNavigate } from "react-router-dom";

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
  geo: string | null;
}

interface CachedHistory {
  items: HistoryItem[];
  offset: number;
  hasMore: boolean;
  timestamp: number;
}

const PAGE_SIZE = 10;
const CACHE_KEY_PREFIX = "lazy_history_cache_";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Geo code to label mapping
const GEO_LABELS: Record<string, string> = {
  uk: "Великобританія",
  bg: "Болгарія",
  ca: "Канада",
  cz: "Чехія",
  de: "Німеччина",
  es: "Іспанія",
  fr: "Франція",
  hu: "Угорщина",
  it: "Італія",
  pl: "Польща",
  pt: "Португалія",
  ro: "Румунія",
  tr: "Туреччина",
  nl: "Нідерланди",
  ru: "Росія",
  jp: "Японія",
  ua: "Україна",
  hr: "Хорватія",
  dk: "Данія",
  ee: "Естонія",
  fi: "Фінляндія",
  gr: "Греція",
  lv: "Латвія",
  lt: "Литва",
  sk: "Словаччина",
  si: "Словенія",
  se: "Швеція",
  vn: "В'єтнам",
  th: "Таїланд",
  id: "Індонезія",
  in: "Індія",
  ae: "ОАЕ",
  us: "США",
};

function getGeoLabel(geoCode: string): string {
  return GEO_LABELS[geoCode] || geoCode.toUpperCase();
}

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

// Cache helpers
function getCache(userId: string): CachedHistory | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as CachedHistory;
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    // Don't cache zip_data - it's too large
    return {
      ...data,
      items: data.items.map(item => ({ ...item, zip_data: null }))
    };
  } catch {
    return null;
  }
}

function setCache(userId: string, items: HistoryItem[], offset: number, hasMore: boolean) {
  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    // Store without zip_data to save space
    const trimmedItems = items.map(item => ({ ...item, zip_data: null }));
    const data: CachedHistory = {
      items: trimmedItems,
      offset,
      hasMore,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to cache lazy history:", e);
  }
}

function clearCache(userId: string) {
  try {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${userId}`);
  } catch {}
}

interface LazyHistorySectionProps {
  onUsePrompt?: (siteName: string, prompt: string) => void;
}

export function LazyHistorySection({ onUsePrompt }: LazyHistorySectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Initialize from cache
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    if (!user?.id) return [];
    const cached = getCache(user.id);
    return cached?.items || [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(() => {
    if (!user?.id) return false;
    const cached = getCache(user.id);
    return cached !== null;
  });
  const [hasMore, setHasMore] = useState(() => {
    if (!user?.id) return true;
    const cached = getCache(user.id);
    return cached?.hasMore ?? true;
  });
  const [offset, setOffset] = useState(() => {
    if (!user?.id) return 0;
    const cached = getCache(user.id);
    return cached?.offset ?? 0;
  });
  
  const loadHistory = useCallback(async (isLoadMore = false) => {
    if (!user?.id || isLoading) return;
    
    setIsLoading(true);
    
    try {
      const currentOffset = isLoadMore ? offset : 0;
      
      const { data, error } = await supabase
        .from("generation_history")
        .select("id, number, prompt, language, zip_data, files_data, status, error_message, created_at, completed_at, ai_model, website_type, site_name, sale_price, image_source, geo")
        .eq("user_id", user.id)
        .in("status", ["completed", "failed"]) // Only completed/failed, not active
        .order("number", { ascending: false })
        .range(currentOffset, currentOffset + PAGE_SIZE - 1);
      
      if (error) {
        console.error("Error loading history:", error);
        toast({
          title: "Помилка",
          description: "Не вдалося завантажити історію",
          variant: "destructive"
        });
        return;
      }
      
      const typedData = (data || []).map(item => ({
        ...item,
        files_data: item.files_data as unknown as GeneratedFile[] | null
      }));
      
      let newHistory: HistoryItem[];
      let newOffset: number;
      let newHasMore: boolean;
      
      if (isLoadMore) {
        const existingIds = new Set(history.map(item => item.id));
        const newItems = typedData.filter(item => !existingIds.has(item.id));
        newHistory = [...history, ...newItems];
      } else {
        newHistory = typedData;
        setHasLoaded(true);
      }
      
      newOffset = currentOffset + typedData.length;
      newHasMore = typedData.length === PAGE_SIZE;
      
      setHistory(newHistory);
      setOffset(newOffset);
      setHasMore(newHasMore);
      
      // Save to cache
      if (user.id) {
        setCache(user.id, newHistory, newOffset, newHasMore);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, offset, history, isLoading, toast]);
  
  // Force refresh - clears cache and reloads
  const handleRefresh = useCallback(() => {
    if (!user?.id) return;
    clearCache(user.id);
    setHistory([]);
    setOffset(0);
    setHasMore(true);
    setHasLoaded(false);
  }, [user?.id]);
  
  const handleDownload = async (item: HistoryItem) => {
    if (!item.zip_data) {
      toast({
        title: "Помилка",
        description: "ZIP дані недоступні",
        variant: "destructive"
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
      a.download = `${item.site_name || `site-${item.number}`}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити ZIP",
        variant: "destructive"
      });
    }
  };
  
  const copyIdToClipboard = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      toast({
        title: "ID скопійовано",
        description: id,
      });
    } catch {
      toast({
        title: "Не вдалося скопіювати",
        description: id,
        variant: "destructive",
      });
    }
  };
  
  const getStatusIcon = (status: string, salePrice?: number | null) => {
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };
  
  if (!user) return null;
  
  return (
    <Card className="mt-4">
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Історія генерацій
            {history.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {history.length}
              </Badge>
            )}
          </div>
          {hasLoaded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Оновити історію"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {!hasLoaded ? (
          <div className="flex justify-center py-4">
            <Button 
              onClick={() => loadHistory(false)} 
              disabled={isLoading}
              variant="outline"
              className="gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Завантажити історію
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Історія порожня
              </p>
            ) : (
              <>
                {history.map(item => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusIcon(item.status, item.sale_price)}
                      <span className="text-sm font-medium truncate max-w-[150px]" title={item.site_name || `Site ${item.number}`}>
                        {item.site_name || `Site ${item.number}`}
                      </span>
                      <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                        {item.website_type === "react" ? "React" : item.website_type === "php" ? "PHP" : "HTML"}
                      </Badge>
                      {item.geo && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
                          {getGeoLabel(item.geo)}
                        </Badge>
                      )}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => copyIdToClipboard(item.id)}
                        title="Скопіювати ID"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {onUsePrompt && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            onUsePrompt(item.site_name || "", item.prompt);
                            toast({
                              title: t("historyExtra.promptLoaded"),
                              description: t("historyExtra.promptLoadedDesc"),
                            });
                          }}
                          title={t("historyExtra.usePrompt")}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {item.status === "completed" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => navigate(`/edit/${item.id}`)}
                            title={t("historyExtra.editButton")}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleDownload(item)}
                            disabled={!item.zip_data}
                            title={t("historyExtra.downloadZip")}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Load more button */}
                {hasMore && (
                  <div className="flex justify-center pt-2">
                    <Button 
                      onClick={() => loadHistory(true)} 
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Завантажити ще
                    </Button>
                  </div>
                )}
                
                {!hasMore && history.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Всі генерації завантажено
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
