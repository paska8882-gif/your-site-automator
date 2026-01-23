import { useEffect, useState, useRef, useCallback, type MouseEvent } from "react";
import { useAdmin } from "@/hooks/useAdmin";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Download, History, RefreshCw, Loader2, CheckCircle2, XCircle, Clock, ChevronDown, Eye, Code, Pencil, Search, ChevronRight, RotateCcw, Files, FileCode, FileText, File, AlertTriangle, Upload, X, Layers, Filter, CalendarDays, MonitorPlay, Ban, Send, User, Bot, Crown, Zap, Maximize2, Minimize2, Folder, FolderOpen, Copy, Play, StopCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FilePreview } from "./FilePreview";
import { PhpPreviewDialog } from "./PhpPreviewDialog";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { useAutoRetry } from "@/hooks/useAutoRetry";

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
  geo: string | null;
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

// Language code to label mapping
const LANGUAGE_LABELS: Record<string, string> = {
  uk: "Українська",
  en: "English",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  pl: "Polski",
  pt: "Português",
  nl: "Nederlands",
  cs: "Čeština",
  sk: "Slovenčina",
  hu: "Magyar",
  ro: "Română",
  bg: "Български",
  el: "Ελληνικά",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  no: "Norsk",
  hr: "Hrvatski",
  sl: "Slovenščina",
  lt: "Lietuvių",
  lv: "Latviešu",
  et: "Eesti",
  kk: "Қазақша",
  ja: "日本語",
  ru: "Русский",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Bahasa Indonesia",
  hi: "हिन्दी",
  ar: "العربية",
};

function getLanguageLabel(langCode: string): string {
  return LANGUAGE_LABELS[langCode] || langCode;
}

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

interface Appeal {
  id: string;
  generation_id: string;
  status: string;
}

interface GenerationHistoryProps {
  onUsePrompt?: (siteName: string, prompt: string) => void;
  defaultDateFilter?: "all" | "today" | "week" | "month" | "last24h";
  compactMode?: boolean; // For generator page - hides filters, shows only last 24h
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
  onPhpPreview?: (item: HistoryItem) => void;
  onCancel: (item: HistoryItem) => void;
  onRetry: (item: HistoryItem) => void;
  onCancelRetry: (itemId: string) => void;
  onSelectFile: (file: GeneratedFile) => void;
  onViewModeChange: (mode: "preview" | "code") => void;
  getAppeal: (itemId: string) => Appeal | undefined;
  getCssFile: (files: GeneratedFile[] | null) => GeneratedFile | undefined;
  getRetryState: (itemId: string) => { countdown: number; isActive: boolean; isCancelled: boolean; isRetrying: boolean };
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
  onPhpPreview,
  onCancel,
  onRetry,
  onCancelRetry,
  onSelectFile,
  onViewModeChange,
  getAppeal,
  getCssFile,
  getRetryState,
  toast,
  compact = false,
  isAdmin = false,
}: SingleHistoryItemProps) {
  const { t } = useLanguage();
  const retryState = getRetryState(item.id);

  const copyIdToClipboard = async (e: MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.id);
      } else {
        const ta = document.createElement("textarea");
        ta.value = item.id;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      toast({
        title: "ID скопійовано",
        description: item.id,
      });
    } catch {
      toast({
        title: "Не вдалося скопіювати",
        description: item.id,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string, salePrice?: number | null) => {
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    switch (status) {
      case "pending": return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case "generating": return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string, salePrice?: number | null, t?: (key: string) => string) => {
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return t ? t("history.refunded") : "Помилка, кошти повернено";
    }
    switch (status) {
      case "pending": return t ? t("history.pending") : "Очікує";
      case "generating": return t ? t("history.generating") : "Генерація...";
      case "completed": return t ? t("history.completed") : "Готово";
      case "failed": return t ? t("history.failed") : "Помилка";
      default: return status;
    }
  };

  const isProcessing = item.status === "pending" || item.status === "generating";
  
  return (
    <Collapsible open={expandedId === item.id}>
      <div className={`rounded border transition-all duration-300 ${compact ? "bg-background" : ""} ${isProcessing ? "border-yellow-500/50 bg-yellow-500/10" : ""}`}>
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
                onClick={copyIdToClipboard}
                title="Скопіювати ID"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {onUsePrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
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
              {(item.status === "pending" || item.status === "generating") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCancel(item);
                  }}
                  title={t("historyExtra.cancelGeneration")}
                >
                  <Ban className="h-4 w-4" />
                </Button>
              )}
              {/* Failed item - show retry button with countdown */}
              {item.status === "failed" && (
                <>
                  {retryState.isRetrying ? (
                    <Badge variant="secondary" className="text-xs h-6 gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Retry...
                    </Badge>
                  ) : retryState.isActive && !retryState.isCancelled ? (
                    <>
                      <Badge variant="outline" className="text-xs h-6 tabular-nums">
                        {retryState.countdown}с
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelRetry(item.id);
                        }}
                        title="Скасувати auto-retry"
                      >
                        <StopCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-primary hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(item);
                        }}
                        title="Retry зараз"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1">
                      {item.error_message && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs">
                              <p className="text-xs font-medium mb-1">Причина помилки:</p>
                              <p className="text-xs text-muted-foreground break-words">{item.error_message}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-primary hover:text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(item);
                        }}
                        title={item.error_message ? `Повторити: ${item.error_message.substring(0, 50)}...` : "Повторити генерацію"}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Retry
                      </Button>
                    </div>
                  )}
                </>
              )}
              {item.status === "completed" && (
                  <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(item.id);
                    }}
                    title={t("historyExtra.editButton")}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {/* PHP Preview button */}
                  {item.website_type === "php" && item.files_data && onPhpPreview && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPhpPreview(item);
                      }}
                      title={t("historyExtra.phpPreview")}
                    >
                      <MonitorPlay className="h-4 w-4" />
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
                    title={t("historyExtra.downloadZip")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {(() => {
                    const appeal = getAppeal(item.id);
                    if (appeal) {
                      const statusText = appeal.status === "pending" ? t("historyExtra.appealPending") : appeal.status === "approved" ? t("historyExtra.appealApproved") : t("historyExtra.appealRejected");
                      return (
                        <Badge 
                          variant={appeal.status === "approved" ? "default" : appeal.status === "rejected" ? "destructive" : "outline"}
                          className="text-xs h-6"
                          title={`${t("historyExtra.appealStatus")}: ${statusText}`}
                        >
                          {appeal.status === "pending" ? "⏳" : appeal.status === "approved" ? "✓" : "✗"}
                        </Badge>
                      );
                    }
                    return (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAppeal(item);
                        }}
                        title={t("historyExtra.submitAppeal")}
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                    );
                  })()}
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs">{t("historyExtra.aiModel")}</span>
                <p className="font-medium">{item.ai_model === "senior" ? "Senior" : "Junior"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">{t("historyExtra.contentLanguage")}</span>
                <p className="font-medium">{getLanguageLabel(item.language)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">{t("historyExtra.geo")}</span>
                <p className="font-medium">{item.geo ? getGeoLabel(item.geo) : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">{t("historyExtra.photos")}</span>
                <p className="font-medium">{item.image_source === "ai" ? t("historyExtra.aiPhotos") : t("historyExtra.basicPhotos")}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs">{t("historyExtra.price")}</span>
                <p className="font-medium">${item.sale_price || 0}</p>
              </div>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t("historyExtra.creationDate")}</span>
              <p className="text-sm">{new Date(item.created_at).toLocaleString("uk-UA")}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t("historyExtra.description")}</span>
              <p className="text-sm mt-1 whitespace-pre-wrap">{item.prompt}</p>
            </div>
            {/* Improved prompt is only visible in admin panel Sites tab */}
          </div>

          {item.files_data && item.files_data.length > 0 && (
            <div className="border-t p-4 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Files className="h-4 w-4" />
                        {t("generator.files")} ({item.files_data.length})
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
                    {t("historyExtra.previewTab")}
                  </Button>
                  <Button
                    variant={viewMode === "code" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onViewModeChange("code")}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    {t("historyExtra.codeTab")}
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
                    const statusText = appeal.status === "pending" ? t("historyExtra.appealPending") : appeal.status === "approved" ? t("historyExtra.appealApproved") : t("historyExtra.appealRejected");
                    return (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        <span>{t("historyExtra.appealStatus")}:</span>
                        <Badge 
                          variant={appeal.status === "approved" ? "default" : appeal.status === "rejected" ? "destructive" : "outline"}
                        >
                          {statusText}
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
                      {t("historyExtra.submitAppeal")}
                    </Button>
                  );
                })()}
              </div>
            </div>
          )}

          {item.error_message && (
            <div className="border-t p-4">
              <p className="text-sm text-destructive">
                {t("historyExtra.errorPrefix")}: {item.error_message}
              </p>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function GenerationHistory({ onUsePrompt, defaultDateFilter = "all", compactMode = false }: GenerationHistoryProps) {
  const { t } = useLanguage();
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
  const [appealScreenshots, setAppealScreenshots] = useState<File[]>([]);
  const [appealScreenshotPreviews, setAppealScreenshotPreviews] = useState<string[]>([]);
  const [submittingAppeal, setSubmittingAppeal] = useState(false);

  // PHP Preview dialog
  const [phpPreviewOpen, setPhpPreviewOpen] = useState(false);
  const [phpPreviewItem, setPhpPreviewItem] = useState<HistoryItem | null>(null);

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<HistoryItem | null>(null);
  const [editFiles, setEditFiles] = useState<GeneratedFile[]>([]);
  const [editSelectedFile, setEditSelectedFile] = useState<GeneratedFile | null>(null);
  const [editMessages, setEditMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [editInput, setEditInput] = useState("");
  const [editAiModel, setEditAiModel] = useState<"junior" | "senior">("senior");
  const [isEditing, setIsEditing] = useState(false);
  const [editViewMode, setEditViewMode] = useState<"preview" | "code">("preview");
  const [editFullscreen, setEditFullscreen] = useState(false);
  const editScrollRef = useRef<HTMLDivElement>(null);

  // Retry failed generation handler - uses retryHistoryId to update existing record
  const handleRetryGeneration = useCallback(async (itemId: string) => {
    const item = history.find(i => i.id === itemId);
    if (!item) return;

    toast({
      title: "Повторна генерація",
      description: `Перегенеруємо "${item.site_name || 'сайт'}"...`,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Необхідна авторизація");
      }

      // Get user's team for pricing
      const { data: teamMember } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .maybeSingle();

      const functionName = item.website_type === "react" 
        ? "generate-react-website" 
        : item.website_type === "php" 
          ? "generate-php-website" 
          : "generate-website";

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: item.prompt,
          language: item.language,
          aiModel: item.ai_model || "senior",
          siteName: item.site_name,
          imageSource: item.image_source || "basic",
          teamId: teamMember?.team_id,
          geo: item.geo,
          retryHistoryId: item.id, // Pass existing record ID for in-place retry
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Генерацію перезапущено",
          description: "Повторна генерація почалась. Слідкуйте за прогресом.",
        });
        // The existing record will be updated via realtime, no need to refetch
      } else {
        throw new Error(data.error || "Помилка генерації");
      }
    } catch (error) {
      console.error("Retry error:", error);
      toast({
        title: "Помилка retry",
        description: error instanceof Error ? error.message : "Невідома помилка",
        variant: "destructive",
      });
    }
  }, [history, toast]);

  // Auto-retry hook for failed generations
  const { startAutoRetry, cancelAutoRetry, manualRetry, getRetryState } = useAutoRetry({
    autoRetryDelay: 30,
    onRetry: handleRetryGeneration,
  });

  // Start auto-retry for newly failed items
  useEffect(() => {
    const failedItems = history.filter(item => item.status === "failed");
    failedItems.forEach(item => {
      // Only start auto-retry for recent failures (last 5 minutes)
      const failedAt = new Date(item.created_at).getTime();
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      if (failedAt > fiveMinutesAgo) {
        startAutoRetry(item.id);
      }
    });
  }, [history, startAutoRetry]);

  // Manual retry handler
  const handleRetry = useCallback((item: HistoryItem) => {
    manualRetry(item.id);
  }, [manualRetry]);

  const fetchHistory = async () => {
    setIsLoading(true);
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    // Fetch only current user's generations (without improved_prompt - commercial secret)
    const { data, error } = await supabase
      .from("generation_history")
      .select("id, number, prompt, language, zip_data, files_data, status, error_message, created_at, completed_at, ai_model, website_type, site_name, sale_price, image_source, geo")
      .eq("user_id", user.id)
      .order("number", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
      toast({
        title: t("common.error"),
        description: t("historyExtra.loadError"),
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

  // Check for stale generations (older than 20 minutes) and mark them as failed with refund
  // NOTE: best-effort; must not spam backend when unhealthy.
  const staleCheckStateRef = useRef({
    failureCount: 0,
    nextAllowedAt: 0,
    lastToastAt: 0,
  });

  const checkStaleGenerations = async () => {
    const state = staleCheckStateRef.current;

    // Backoff guard - wait longer between retries after failures
    if (Date.now() < state.nextAllowedAt) return;

    // Skip if offline
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      state.nextAllowedAt = Date.now() + 120_000; // 2 min offline backoff
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-stale-generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        signal: controller.signal,
      });

      // 503 = backend temporarily down, don't count as hard failure
      if (response.status === 503) {
        state.failureCount += 1;
        const backoffMs = Math.min(30 * 60_000, 60_000 * state.failureCount); // max 30 min
        state.nextAllowedAt = Date.now() + backoffMs;
        console.log(`Backend unavailable (503), backing off for ${backoffMs / 1000}s`);
        return;
      }

      if (!response.ok) {
        throw new Error(`cleanup-stale-generations failed: ${response.status}`);
      }

      const result = await response.json();

      // Success - reset failure count and set normal interval
      state.failureCount = 0;
      state.nextAllowedAt = Date.now() + 5 * 60_000; // 5 min after success

      if (result.processed > 0) {
        console.log(`Stale cleanup: ${result.processed} processed, ${result.refunded} refunded`);
        fetchHistory();
      }
    } catch (error) {
      state.failureCount += 1;
      // Exponential backoff: 1min, 2min, 4min, 8min, ... max 30min
      const backoffMs = Math.min(30 * 60_000, 60_000 * Math.pow(2, state.failureCount - 1));
      state.nextAllowedAt = Date.now() + backoffMs;

      // Show toast only once every 10 minutes max
      if (Date.now() - state.lastToastAt > 10 * 60_000) {
        state.lastToastAt = Date.now();
        toast({
          title: t("historyExtra.backendUnavailable"),
          description: t("historyExtra.backendUnavailableDesc"),
          variant: "destructive",
        });
      }

      console.error("Error checking stale generations:", error);
    } finally {
      clearTimeout(timeout);
    }
  };

  // Refs for realtime status tracking
  const realtimeActiveRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRef = useRef<number>(0);

  // Fallback polling for when realtime is not working
  const startFallbackPolling = () => {
    if (pollingIntervalRef.current) return; // Already polling
    
    console.log("[GenerationHistory] Starting fallback polling (realtime inactive)");
    pollingIntervalRef.current = setInterval(async () => {
      // Only poll if we have generating items
      const hasGenerating = history.some(item => item.status === "generating");
      if (hasGenerating && Date.now() - lastFetchRef.current > 5000) {
        console.log("[GenerationHistory] Polling for updates...");
        await fetchHistory();
        lastFetchRef.current = Date.now();
      }
    }, 10_000); // Poll every 10 seconds when there are generating items
  };

  const stopFallbackPolling = () => {
    if (pollingIntervalRef.current) {
      console.log("[GenerationHistory] Stopping fallback polling (realtime active)");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let staleCheckInterval: NodeJS.Timeout | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const setupRealtimeAndFetch = async () => {
      await fetchHistory();
      lastFetchRef.current = Date.now();
      
      // Check for stale generations on load and every minute
      await checkStaleGenerations();
      staleCheckInterval = setInterval(checkStaleGenerations, 60 * 1000);
      
      // Get current user for realtime filter
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const setupChannel = () => {
        // Clean up existing channel if any
        if (channel) {
          supabase.removeChannel(channel);
        }

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
              const newRecord = payload.new as Record<string, any> | undefined;
              const oldRecord = payload.old as Record<string, any> | undefined;
              console.log("[GenerationHistory] Realtime update:", payload.eventType, newRecord?.id);
              
              if (payload.eventType === "INSERT" && newRecord) {
                const newItem = {
                  ...newRecord,
                  files_data: newRecord.files_data as GeneratedFile[] | null
                } as HistoryItem;
                setHistory((prev) => [newItem, ...prev]);
              } else if (payload.eventType === "UPDATE" && newRecord) {
                // For completed status, refetch full record including zip_data which may not be in realtime payload
                if (newRecord.status === "completed") {
                  supabase
                    .from("generation_history")
                    .select("*")
                    .eq("id", newRecord.id)
                    .single()
                    .then(({ data: fullRecord }) => {
                      if (fullRecord) {
                        setHistory((prev) =>
                          prev.map((item) => {
                            if (item.id === fullRecord.id) {
                              return {
                                ...item,
                                ...fullRecord,
                                files_data: fullRecord.files_data as unknown as GeneratedFile[] | null
                              };
                            }
                            return item;
                          })
                        );
                      }
                    });
                } else {
                  setHistory((prev) =>
                    prev.map((item) => {
                      if (item.id === newRecord.id) {
                        return {
                          ...item,
                          ...newRecord,
                          files_data: (newRecord.files_data as GeneratedFile[] | null) ?? item.files_data
                        };
                      }
                      return item;
                    })
                  );
                }
              } else if (payload.eventType === "DELETE" && oldRecord) {
                setHistory((prev) =>
                  prev.filter((item) => item.id !== oldRecord.id)
                );
              }
            }
          )
          .subscribe((status, err) => {
            console.log("[GenerationHistory] Realtime status:", status, err?.message);
            
            if (status === "SUBSCRIBED") {
              realtimeActiveRef.current = true;
              stopFallbackPolling();
            } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
              realtimeActiveRef.current = false;
              startFallbackPolling();
              
              // Attempt to reconnect after a delay
              if (reconnectTimeout) clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(() => {
                console.log("[GenerationHistory] Attempting to reconnect realtime...");
                setupChannel();
              }, 5000);
            } else if (status === "TIMED_OUT") {
              realtimeActiveRef.current = false;
              startFallbackPolling();
              
              // Attempt to reconnect after longer delay for timeout
              if (reconnectTimeout) clearTimeout(reconnectTimeout);
              reconnectTimeout = setTimeout(() => {
                console.log("[GenerationHistory] Reconnecting after timeout...");
                setupChannel();
              }, 10000);
            }
          });
      };

      setupChannel();
      
      // Initial fallback polling check - if realtime doesn't connect within 3 seconds
      setTimeout(() => {
        if (!realtimeActiveRef.current) {
          startFallbackPolling();
        }
      }, 3000);
    };

    setupRealtimeAndFetch();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
      if (staleCheckInterval) {
        clearInterval(staleCheckInterval);
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      stopFallbackPolling();
    };
  }, []);

  const handleDownload = (item: HistoryItem) => {
    if (!item.zip_data) {
      toast({
        title: t("common.error"),
        description: t("historyExtra.zipNotAvailable"),
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
        title: t("historyExtra.downloadTitle"),
        description: t("historyExtra.downloadDesc"),
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: t("common.error"),
        description: t("historyExtra.downloadError"),
        variant: "destructive",
      });
    }
  };

  const handleDownloadAll = async (items: HistoryItem[]) => {
    const completedItems = items.filter(item => item.status === "completed" && item.zip_data);
    
    if (completedItems.length === 0) {
      toast({
        title: t("historyExtra.noCompletedItems"),
        description: t("historyExtra.noCompletedDesc"),
        variant: "destructive",
      });
      return;
    }

    toast({
      title: t("historyExtra.downloadTitle"),
      description: `${t("historyExtra.downloadingFiles")} ${completedItems.length}...`,
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
      title: t("historyExtra.downloadComplete"),
      description: `${t("historyExtra.downloadCompleteDesc")} ${completedItems.length}`,
    });
  };

  const handleCancel = async (item: HistoryItem) => {
    try {
      // First, refund balance if there was a sale_price
      if (item.sale_price && item.sale_price > 0) {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Get user's team membership
          const { data: membership } = await supabase
            .from("team_members")
            .select("team_id")
            .eq("user_id", user.id)
            .single();

          if (membership) {
            // Get current team balance
            const { data: team } = await supabase
              .from("teams")
              .select("balance")
              .eq("id", membership.team_id)
              .single();

            if (team) {
              // Refund the balance
              await supabase
                .from("teams")
                .update({ balance: (team.balance || 0) + item.sale_price })
                .eq("id", membership.team_id);
              
              console.log(`Refunded $${item.sale_price} to team ${membership.team_id} for cancelled generation ${item.id}`);
            }
          }
        }
      }

      // Update generation status and reset sale_price to indicate refund
      const { error } = await supabase
        .from("generation_history")
        .update({ 
          status: "failed", 
          error_message: t("historyExtra.cancelledByUser"),
          completed_at: new Date().toISOString(),
          sale_price: 0 // Reset to show as refunded
        })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: t("historyExtra.generationCancelled"),
        description: `"${item.site_name || `Site ${item.number}`}" ${t("historyExtra.generationCancelledDesc")}`,
      });
    } catch (error) {
      console.error("Cancel error:", error);
      toast({
        title: t("common.error"),
        description: t("historyExtra.cancelError"),
        variant: "destructive",
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (item: HistoryItem) => {
    setEditItem(item);
    setEditFiles(item.files_data || []);
    setEditAiModel((item.ai_model as "junior" | "senior") || "senior");
    setEditMessages([]);
    setEditInput("");
    setIsEditing(false);
    setEditViewMode("preview");
    setEditFullscreen(false);
    
    // Select index.html or first file
    if (item.files_data && item.files_data.length > 0) {
      const indexFile = item.files_data.find(f => f.path === "index.html");
      setEditSelectedFile(indexFile || item.files_data[0]);
    } else {
      setEditSelectedFile(null);
    }
    
    // Load saved messages from localStorage
    const saved = localStorage.getItem(`edit-chat-${item.id}`);
    if (saved) {
      try {
        setEditMessages(JSON.parse(saved));
      } catch {}
    }
    
    setEditDialogOpen(true);
  };

  // Send edit request
  const handleEditSend = async () => {
    if (!editInput.trim() || isEditing || !editItem) return;

    const userMessage = editInput.trim();
    setEditInput("");
    setEditMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsEditing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error(t("historyExtra.authRequired"));
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-website`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            generationId: editItem.id,
            editRequest: userMessage,
            currentFiles: editFiles,
            aiModel: editAiModel,
            websiteType: editItem.website_type,
            originalPrompt: editItem.prompt,
          }),
        }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.files) {
        setEditFiles(data.files);
        
        // Update selected file
        if (editSelectedFile) {
          const updated = data.files.find((f: GeneratedFile) => f.path === editSelectedFile.path);
          if (updated) setEditSelectedFile(updated);
        }
        
        const newMessages = [...editMessages, { role: "user" as const, content: userMessage }, { role: "assistant" as const, content: data.message || t("historyExtra.editSuccess") }];
        setEditMessages(prev => [...prev, { role: "assistant", content: data.message || t("historyExtra.editSuccess") }]);
        
        // Save to localStorage
        localStorage.setItem(`edit-chat-${editItem.id}`, JSON.stringify(newMessages));
        
        // Update history item
        setHistory(prev => prev.map(h => h.id === editItem.id ? { ...h, files_data: data.files } : h));

        toast({
          title: t("historyExtra.siteUpdated"),
          description: t("historyExtra.siteUpdatedDesc"),
        });
      } else {
        throw new Error(data.error || t("historyExtra.unknownError"));
      }
    } catch (error) {
      console.error("Edit error:", error);
      setEditMessages(prev => [
        ...prev,
        { role: "assistant", content: `${t("historyExtra.errorPrefix")}: ${error instanceof Error ? error.message : t("historyExtra.unknownError")}` },
      ]);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("historyExtra.unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  // Build preview HTML for edit dialog
  const buildEditPreviewHtml = (): string => {
    if (!editItem) return "";
    
    if (editItem.website_type === "react") {
      // Build React preview
      const globalCss = editFiles.find(f => f.path.includes("global.css") || f.path.includes("index.css"));
      const jsFiles = editFiles.filter(f => 
        (f.path.endsWith(".js") || f.path.endsWith(".jsx")) && 
        !f.path.includes("index.js") &&
        !f.path.includes("reportWebVitals")
      );
      
      const processFile = (file: GeneratedFile): string => {
        let content = file.content;
        const componentName = file.path.split("/").pop()?.replace(/\.(js|jsx)$/, "") || "";
        content = content.replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*/g, '');
        content = content.replace(/import\s+['"][^'"]+['"];?\s*/g, '');
        content = content.replace(/export\s+default\s+function\s+(\w+)/g, (_, name) => `window.${name} = function ${name}`);
        content = content.replace(/export\s+default\s+(\w+)\s*;?/g, (_, name) => `window.${name} = ${name};`);
        content = content.replace(/export\s+function\s+(\w+)/g, (_, name) => `window.${name} = function ${name}`);
        content = content.replace(/export\s+const\s+(\w+)/g, (_, name) => `window.${name} = window.${name} || {}; const ${name}`);
        if (!content.includes(`window.${componentName}`)) {
          content = content.replace(new RegExp(`function\\s+${componentName}\\s*\\(`), `window.${componentName} = function ${componentName}(`);
          content = content.replace(new RegExp(`const\\s+${componentName}\\s*=\\s*\\(`), `window.${componentName} = (`);
        }
        return `// === ${file.path} ===\n${content}`;
      };
      
      const sortedFiles = [...jsFiles].sort((a, b) => {
        if (a.path.includes("App.")) return 1;
        if (b.path.includes("App.")) return -1;
        return 0;
      });
      
      const processedCode = sortedFiles.map(processFile).join('\n\n');
      
      return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"></script>
  <style>${globalCss?.content || '* { margin: 0; padding: 0; box-sizing: border-box; }'}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, Fragment } = React;
    const BrowserRouter = ({ children }) => children;
    const Routes = ({ children }) => children;
    const Route = () => null;
    const Link = ({ to, children, ...props }) => React.createElement('a', { href: '#', ...props }, children);
    const NavLink = Link;
    const useNavigate = () => () => {};
    const useLocation = () => ({ pathname: '/', search: '', hash: '' });
    const useParams = () => ({});
    window.BrowserRouter = BrowserRouter;
    window.Routes = Routes;
    window.Route = Route;
    window.Link = Link;
    window.NavLink = NavLink;
    window.useNavigate = useNavigate;
    window.useLocation = useLocation;
    window.useParams = useParams;
    
    ${processedCode}
    
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      const AppComponent = window.App;
      if (AppComponent) {
        root.render(React.createElement(AppComponent));
      } else {
        document.getElementById('root').innerHTML = '<p style="padding:20px;color:red;">App component not found</p>';
      }
    } catch (err) {
      document.getElementById('root').innerHTML = '<pre style="padding:20px;color:red;">' + err.message + '</pre>';
    }
  </script>
</body>
</html>`;
    }
    
    // HTML preview
    if (!editSelectedFile?.path.endsWith(".html")) return editSelectedFile?.content || "";
    
    let html = editSelectedFile.content;
    const cssFile = editFiles.find(f => f.path === "styles.css" || f.path.endsWith("/styles.css"));
    
    if (cssFile) {
      const styleTag = `<style>${cssFile.content}</style>`;
      if (html.includes("</head>")) {
        html = html.replace("</head>", `${styleTag}</head>`);
      } else if (html.includes("<body")) {
        html = html.replace("<body", `${styleTag}<body`);
      } else {
        html = styleTag + html;
      }
    }
    
    return html;
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

  const getStatusTextLocal = (status: string, salePrice?: number | null) => {
    if (status === "failed" && (salePrice === 0 || salePrice === null)) {
      return t("history.refunded");
    }
    switch (status) {
      case "pending": return t("history.pending");
      case "generating": return t("history.generating");
      case "completed": return t("history.completed");
      case "failed": return t("history.failed");
      default: return status;
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
    setAppealScreenshots([]);
    setAppealScreenshotPreviews([]);
    setAppealDialogOpen(true);
  };

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxFiles = 5;
    const currentCount = appealScreenshots.length;
    const remainingSlots = maxFiles - currentCount;
    
    if (remainingSlots <= 0) {
      toast({
        title: "Досягнуто ліміт",
        description: `Максимум ${maxFiles} зображень`,
        variant: "destructive"
      });
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    const validFiles: File[] = [];
    const newPreviews: string[] = [];

    filesToAdd.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Файл занадто великий",
          description: `${file.name}: максимальний розмір 5 МБ`,
          variant: "destructive"
        });
        return;
      }
      validFiles.push(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target?.result as string);
        if (newPreviews.length === validFiles.length) {
          setAppealScreenshots(prev => [...prev, ...validFiles]);
          setAppealScreenshotPreviews(prev => [...prev, ...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    e.target.value = '';
  };

  const removeScreenshot = (index: number) => {
    setAppealScreenshots(prev => prev.filter((_, i) => i !== index));
    setAppealScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
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

      // Upload screenshots if provided
      const screenshotUrls: string[] = [];
      for (const screenshot of appealScreenshots) {
        const fileExt = screenshot.name.split('.').pop();
        const fileName = `${user.id}/${appealItem.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('appeal-screenshots')
          .upload(fileName, screenshot);

        if (uploadError) {
          console.error("Screenshot upload error:", uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('appeal-screenshots')
            .getPublicUrl(fileName);
          screenshotUrls.push(publicUrl);
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
          screenshot_url: screenshotUrls.length > 0 ? screenshotUrls[0] : null,
          screenshot_urls: screenshotUrls
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
      setAppealScreenshots([]);
      setAppealScreenshotPreviews([]);
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
    
    // Date filter - in compactMode always filter last 24h
    const effectiveDateFilter = compactMode ? "last24h" : dateFilter;
    if (effectiveDateFilter !== "all") {
      const itemDate = new Date(item.created_at);
      const now = new Date();
      
      if (effectiveDateFilter === "last24h") {
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        if (itemDate < oneDayAgo) return false;
      } else if (effectiveDateFilter === "today") {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (itemDate < today) return false;
      } else if (effectiveDateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (itemDate < weekAgo) return false;
      } else if (effectiveDateFilter === "month") {
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
            {compactMode ? t("history.recentGenerations") : t("history.title")}
            {compactMode && (
              <span className="text-xs font-normal text-muted-foreground">(24h)</span>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={fetchHistory} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {!compactMode && (
          <div className="flex items-center gap-2 mt-2">
            <div className="relative flex-1 max-w-[200px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder={t("common.search") + "..."}
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
                  {t("common.filter")}
                  {hasActiveFilters && <span className="ml-1 px-1 bg-primary text-primary-foreground rounded text-[10px]">!</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-wrap gap-1.5">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[90px] h-7 text-xs">
                      <SelectValue placeholder={t("history.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all")}</SelectItem>
                      <SelectItem value="completed">{t("history.completed")}</SelectItem>
                      <SelectItem value="in_progress">{t("history.inProgress")}</SelectItem>
                      <SelectItem value="failed">{t("history.failed")}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[70px] h-7 text-xs">
                      <SelectValue placeholder={t("history.type")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all")}</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                      <SelectItem value="react">React</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[90px] h-7 text-xs">
                      <SelectValue placeholder={t("history.date")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("common.all")}</SelectItem>
                      <SelectItem value="last24h">24h</SelectItem>
                      <SelectItem value="today">{t("balance.today")}</SelectItem>
                      <SelectItem value="week">{t("balance.week")}</SelectItem>
                      <SelectItem value="month">{t("balance.month")}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {uniqueLanguages.length > 1 && (
                    <Select value={languageFilter} onValueChange={setLanguageFilter}>
                      <SelectTrigger className="w-[70px] h-7 text-xs">
                        <SelectValue placeholder={t("history.language")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("common.all")}</SelectItem>
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
                      <SelectItem value="all">{t("common.all")}</SelectItem>
                      <SelectItem value="junior">{t("generator.junior")}</SelectItem>
                      <SelectItem value="senior">{t("generator.senior")}</SelectItem>
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
                    {t("common.reset")}
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
        )}
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
                          onEdit={(id) => {
                            const item = group.items.find(i => i.id === id);
                            if (item) openEditDialog(item);
                          }}
                          onUsePrompt={onUsePrompt}
                          onAppeal={openAppealDialog}
                          onPhpPreview={(item) => {
                            setPhpPreviewItem(item);
                            setPhpPreviewOpen(true);
                          }}
                          onCancel={handleCancel}
                          onRetry={handleRetry}
                          onCancelRetry={cancelAutoRetry}
                          onSelectFile={setSelectedFile}
                          onViewModeChange={setViewMode}
                          getAppeal={getAppealForItem}
                          getCssFile={getCssFile}
                          getRetryState={getRetryState}
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
                  onEdit={(id) => {
                    const item = history.find(i => i.id === id);
                    if (item) openEditDialog(item);
                  }}
                  onUsePrompt={onUsePrompt}
                  onAppeal={openAppealDialog}
                  onPhpPreview={(item) => {
                    setPhpPreviewItem(item);
                    setPhpPreviewOpen(true);
                  }}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onCancelRetry={cancelAutoRetry}
                  onSelectFile={setSelectedFile}
                  onViewModeChange={setViewMode}
                  getAppeal={getAppealForItem}
                  getCssFile={getCssFile}
                  getRetryState={getRetryState}
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
            <DialogTitle>{t("history.appeal")}</DialogTitle>
          </DialogHeader>
          {appealItem && (
            <div className="space-y-4">
              <div className="text-sm">
                <p><span className="text-muted-foreground">{t("generator.siteName")}:</span> {appealItem.site_name}</p>
                <p><span className="text-muted-foreground">{t("history.refundAmount")}:</span> ${appealItem.sale_price?.toFixed(2) || "0.00"}</p>
              </div>
              <div>
                <label className="text-sm font-medium">{t("history.appealReason")}</label>
                <Textarea
                  value={appealReason}
                  onChange={(e) => setAppealReason(e.target.value)}
                  placeholder={t("history.appealReasonPlaceholder")}
                  className="mt-1"
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t("history.screenshotOptional")}</label>
                {appealScreenshotPreviews.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {appealScreenshotPreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={preview} 
                          alt={`Скріншот ${index + 1}`} 
                          className="h-24 w-full rounded border object-cover"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-5 w-5"
                          onClick={() => removeScreenshot(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {appealScreenshotPreviews.length < 5 && (
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {appealScreenshotPreviews.length > 0 
                          ? `Додати ще (${5 - appealScreenshotPreviews.length} залишилось)` 
                          : "Завантажити зображення (до 5 МБ кожне)"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleScreenshotChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAppealDialogOpen(false)}>
                  {t("common.cancel")}
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
                  {t("history.sendAppeal")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PHP Preview Dialog */}
      <PhpPreviewDialog
        open={phpPreviewOpen}
        onOpenChange={setPhpPreviewOpen}
        files={phpPreviewItem?.files_data || []}
        siteName={phpPreviewItem?.site_name || undefined}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        if (!open && !isEditing) setEditDialogOpen(false);
      }}>
        <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                Редагування: {editItem?.site_name || `Site ${editItem?.number}`}
              </DialogTitle>
              {isEditing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Редагування...
                </div>
              )}
            </div>
          </DialogHeader>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Chat panel */}
            <div className="w-[350px] border-r flex flex-col shrink-0">
              {/* AI Model selector */}
              <div className="p-3 border-b">
                <Select 
                  value={editAiModel} 
                  onValueChange={(v) => setEditAiModel(v as "junior" | "senior")}
                  disabled={isEditing}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="senior">
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-500" />
                        Senior AI
                      </div>
                    </SelectItem>
                    <SelectItem value="junior">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        Junior AI
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Messages */}
              <ScrollArea className="flex-1 p-3" ref={editScrollRef}>
                <div className="space-y-3">
                  {editMessages.length === 0 && (
                    <div className="text-center text-muted-foreground py-6">
                      <Bot className="h-10 w-10 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Опишіть які зміни потрібно внести</p>
                      <p className="text-xs mt-1">Наприклад: "Зміни колір кнопок на синій"</p>
                    </div>
                  )}
                  {editMessages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                      {msg.role === "assistant" && (
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Bot className="h-3.5 w-3.5 text-primary" />
                        </div>
                      )}
                      <div className={`rounded-lg px-3 py-2 max-w-[85%] text-sm ${
                        msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.role === "user" && (
                        <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
                          <User className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>
                  ))}
                  {isEditing && (
                    <div className="flex gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Редагую...
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              {/* Input */}
              <div className="p-3 border-t">
                <div className="flex gap-2">
                  <Textarea
                    value={editInput}
                    onChange={(e) => setEditInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleEditSend();
                      }
                    }}
                    placeholder="Опишіть зміни..."
                    className="min-h-[50px] max-h-[100px] resize-none text-sm"
                    disabled={isEditing}
                  />
                  <Button
                    onClick={handleEditSend}
                    disabled={!editInput.trim() || isEditing}
                    size="icon"
                    className="h-[50px] w-[50px]"
                  >
                    {isEditing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Preview panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="border-b px-3 py-2 flex items-center justify-between shrink-0 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Button
                    variant={editViewMode === "preview" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEditViewMode("preview")}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Перегляд
                  </Button>
                  <Button
                    variant={editViewMode === "code" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setEditViewMode("code")}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Код
                  </Button>
                </div>
                {editViewMode === "preview" && (
                  <Button variant="ghost" size="sm" onClick={() => setEditFullscreen(!editFullscreen)}>
                    {editFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                )}
              </div>
              
              <div className="flex-1 flex overflow-hidden">
                {/* File tree */}
                <div className="w-48 border-r bg-muted/30 flex flex-col shrink-0">
                  <div className="p-2 border-b">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Файли</span>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="py-1">
                      {editFiles.map(file => (
                        <div
                          key={file.path}
                          onClick={() => setEditSelectedFile(file)}
                          className={`flex items-center gap-2 px-2 py-1 text-sm cursor-pointer transition-colors ${
                            editSelectedFile?.path === file.path ? "bg-primary/10 text-primary" : "hover:bg-muted"
                          }`}
                        >
                          {getFileIcon(file.path)}
                          <span className="truncate">{file.path.split("/").pop()}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                
                {/* Content */}
                <div className="flex-1 overflow-hidden">
                  {editViewMode === "preview" ? (
                    <iframe
                      srcDoc={buildEditPreviewHtml()}
                      className="w-full h-full border-0 bg-white"
                      title="Preview"
                      sandbox="allow-scripts allow-same-origin"
                    />
                  ) : (
                    <ScrollArea className="h-full">
                      <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-all">
                        {editSelectedFile?.content || "Виберіть файл"}
                      </pre>
                    </ScrollArea>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
