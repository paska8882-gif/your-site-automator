import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bot, 
  FileCode, 
  Eye, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Wand2,
  Files,
  History,
  ChevronLeft
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES_MAP, GEO_MAP } from "@/lib/filterConstants";
import { AiEditorHistory } from "./AiEditorHistory";
import JSZip from "jszip";

interface GeneratedFile {
  path: string;
  content: string;
}

interface GenerationResult {
  status: "idle" | "generating" | "polling" | "completed" | "failed";
  files: GeneratedFile[];
  error?: string;
  technicalPrompt?: string;
  jobId?: string;
  progress?: string;
}

// ========== PREVIEW WITH NAVIGATION ==========
function AiPreviewWithNav({ files }: { files: GeneratedFile[] }) {
  const [currentPage, setCurrentPage] = useState("index.html");
  const [history, setHistory] = useState<string[]>(["index.html"]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const htmlPages = files.filter(f => f.path.endsWith('.html')).map(f => f.path);

  const handleNavigate = useCallback((page: string) => {
    if (htmlPages.includes(page)) {
      const newHistory = [...history.slice(0, historyIndex + 1), page];
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
      setCurrentPage(page);
    }
  }, [htmlPages, history, historyIndex]);

  const canGoBack = historyIndex > 0;

  const handleBack = () => {
    if (canGoBack) {
      setHistoryIndex(historyIndex - 1);
      setCurrentPage(history[historyIndex - 1]);
    }
  };

  // Listen for navigation from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'preview-navigate' && e.data.page) {
        handleNavigate(e.data.page);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [handleNavigate]);

  const currentFile = files.find(f => f.path === currentPage);

  // Build preview HTML with navigation script
  const previewHtml = useMemo(() => {
    if (!currentFile) return '';
    
    let html = currentFile.content;
    
    const navScript = `
      <script data-preview-nav>
        (function() {
          var availablePages = ${JSON.stringify(htmlPages)};
          
          document.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target.tagName !== 'A') {
              target = target.parentElement;
            }
            if (!target) return;
            
            var href = target.getAttribute('href');
            if (!href) return;
            
            if (href.startsWith('http://') || href.startsWith('https://') || 
                href.startsWith('#') || href.startsWith('tel:') || 
                href.startsWith('mailto:') || href.startsWith('javascript:')) {
              return;
            }
            
            var normalized = href.replace(/^\\.\\//g, '').replace(/^\\//, '').toLowerCase();
            var found = null;
            
            for (var i = 0; i < availablePages.length; i++) {
              if (availablePages[i].toLowerCase() === normalized) {
                found = availablePages[i];
                break;
              }
            }
            
            if (!found && !normalized.endsWith('.html')) {
              for (var i = 0; i < availablePages.length; i++) {
                if (availablePages[i].toLowerCase() === normalized + '.html') {
                  found = availablePages[i];
                  break;
                }
              }
            }
            
            if (found) {
              e.preventDefault();
              window.parent.postMessage({ type: 'preview-navigate', page: found }, '*');
            }
          }, true);
        })();
      </script>
    `;
    
    if (html.includes('</body>')) {
      html = html.replace('</body>', navScript + '</body>');
    } else {
      html += navScript;
    }
    
    return html;
  }, [currentFile, htmlPages]);

  if (!currentFile) {
    return (
      <div className="border rounded-md h-[300px] flex items-center justify-center text-muted-foreground bg-white">
        Немає index.html
      </div>
    );
  }

  return (
    <div className="border rounded-md h-[300px] bg-white flex flex-col">
      {/* Navigation bar */}
      <div className="flex items-center gap-2 px-2 py-1 border-b bg-muted/50 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0"
          onClick={handleBack}
          disabled={!canGoBack}
          title="Назад"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground flex-1 truncate">
          {currentPage}
        </span>
        {htmlPages.length > 1 && (
          <Select value={currentPage} onValueChange={handleNavigate}>
            <SelectTrigger className="h-6 w-auto text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {htmlPages.map(page => (
                <SelectItem key={page} value={page} className="text-xs">
                  {page}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Preview iframe */}
      <iframe
        srcDoc={previewHtml}
        className="flex-1 w-full"
        sandbox="allow-scripts"
      />
    </div>
  );
}

const AiEditorTab = () => {
  const { toast } = useToast();
  
  // Form state
  const [domain, setDomain] = useState("");
  const [geo, setGeo] = useState("BE");
  const [languages, setLanguages] = useState<string[]>([]);
  const [theme, setTheme] = useState("");
  const [keywords, setKeywords] = useState("");
  const [prohibitedWords, setProhibitedWords] = useState("");
  
  // Generation state
  const [result, setResult] = useState<GenerationResult>({
    status: "idle",
    files: [],
  });
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [timerInterval]);

  // ✅ REALTIME ПІДПИСКА - замість polling, реагуємо на зміни в БД миттєво
  useEffect(() => {
    if (!currentJobId) return;

    console.log(`[Realtime] Subscribing to job: ${currentJobId}`);

    const channel = supabase
      .channel(`ai-job-${currentJobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_generation_jobs',
          filter: `id=eq.${currentJobId}`
        },
        (payload) => {
          console.log('[Realtime] Job update received:', payload.new);
          const data = payload.new as {
            id: string;
            status: string;
            files_data: { files?: GeneratedFile[] } | null;
            technical_prompt?: string;
            error_message?: string;
          };

          if (data.status === 'completed') {
            // Stop timer
            if (timerInterval) {
              clearInterval(timerInterval);
              setTimerInterval(null);
            }
            
            const files = data.files_data?.files || [];
            setResult({
              status: "completed",
              files,
              technicalPrompt: data.technical_prompt,
              jobId: data.id,
            });

            toast({
              title: "Генерація завершена",
              description: `Створено ${files.length} файлів`,
            });
            
            // Unsubscribe after completion
            supabase.removeChannel(channel);
            setCurrentJobId(null);
            
          } else if (data.status === 'failed') {
            // Stop timer
            if (timerInterval) {
              clearInterval(timerInterval);
              setTimerInterval(null);
            }
            
            setResult({
              status: "failed",
              files: [],
              error: data.error_message || 'Unknown error',
              jobId: data.id,
            });

            toast({
              title: "Помилка генерації",
              description: data.error_message || 'Unknown error',
              variant: "destructive",
            });
            
            // Unsubscribe after failure
            supabase.removeChannel(channel);
            setCurrentJobId(null);
            
          } else if (data.status === 'processing') {
            setResult(prev => ({
              ...prev,
              progress: data.technical_prompt 
                ? 'Генерація файлів сайту...' 
                : 'Генерація технічного промпту...',
            }));
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from job: ${currentJobId}`);
      supabase.removeChannel(channel);
    };
  }, [currentJobId, timerInterval, toast]);

  // Format elapsed time as MM:SS
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  // ✅ pollJobStatus видалено - тепер використовуємо Realtime підписку вище

  const handleGenerate = async () => {
    if (!domain.trim() || languages.length === 0) {
      toast({ title: "Помилка", description: "Вкажіть домен та оберіть мови", variant: "destructive" });
      return;
    }

    // Clear previous timer
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }

    setElapsedTime(0);
    setCurrentJobId(null);
    setResult({ status: "generating", files: [], progress: "Запуск генерації..." });

    // Start elapsed time timer
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);
    setTimerInterval(timer);

    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-website', {
        body: {
          domain,
          geo,
          languages,
          theme,
          keywords,
          prohibitedWords,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Generation failed');
      }

      // ✅ Отримали jobId - підписуємось на Realtime оновлення
      const jobId = data.jobId;
      setCurrentJobId(jobId);
      
      setResult({ 
        status: "polling", 
        files: [], 
        jobId,
        progress: "Очікування на генерацію..." 
      });

      toast({
        title: "Генерація запущена",
        description: "Результат прийде через Realtime коли буде готовий",
      });

    } catch (error) {
      console.error("Generation error:", error);
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setResult({
        status: "failed",
        files: [],
        error: error instanceof Error ? error.message : "Unknown error",
      });
      toast({
        title: "Помилка генерації",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (path: string) => {
    const file = result.files.find(f => f.path === path);
    if (file) {
      setSelectedFile(path);
      setEditedContent(file.content);
      setIsEditing(false);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedFile) return;
    
    setResult(prev => ({
      ...prev,
      files: prev.files.map(f => 
        f.path === selectedFile ? { ...f, content: editedContent } : f
      ),
    }));
    setIsEditing(false);
    toast({ title: "Збережено", description: `Файл ${selectedFile} оновлено` });
  };

  const handleDownloadZip = async () => {
    if (result.files.length === 0) return;

    const zip = new JSZip();
    result.files.forEach(file => {
      zip.file(file.path, file.content);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${domain || "website"}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (path: string) => {
    if (path.endsWith(".html")) return "📄";
    if (path.endsWith(".css")) return "🎨";
    if (path.endsWith(".js")) return "⚡";
    if (path.endsWith(".xml")) return "📋";
    return "📁";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-purple-500" />
        <h2 className="text-lg font-semibold">AI Редактор (Тест)</h2>
        <Badge variant="outline" className="text-purple-600 border-purple-300">
          Експериментальний
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ліва колонка - форма */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Параметри генерації
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Домен *</Label>
                <Input 
                  value={domain} 
                  onChange={e => setDomain(e.target.value)}
                  placeholder="example.com"
                  className="h-9 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Географія</Label>
                <Select value={geo} onValueChange={setGeo}>
                  <SelectTrigger className="h-9 text-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GEO_MAP).map(([code, label]) => (
                      <SelectItem key={code} value={code}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Мови сайту *</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {Object.entries(LANGUAGES_MAP).map(([code, label]) => (
                  <Badge
                    key={code}
                    variant={languages.includes(code) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => {
                      if (languages.includes(code)) {
                        setLanguages(languages.filter(l => l !== code));
                      } else {
                        setLanguages([...languages, code]);
                      }
                    }}
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Тема</Label>
              <Input 
                value={theme} 
                onChange={e => setTheme(e.target.value)}
                placeholder="Digital Wayfinding & Spatial Orientation"
                className="h-9 text-sm mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Ключові слова</Label>
              <Textarea 
                value={keywords} 
                onChange={e => setKeywords(e.target.value)}
                placeholder="Orientation spatiale, Signalétique numérique, Navigation intérieure..."
                className="text-sm min-h-[60px] mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-medium">Заборонені слова</Label>
              <Textarea 
                value={prohibitedWords} 
                onChange={e => setProhibitedWords(e.target.value)}
                placeholder="Crypto, Bitcoin, NFT, Casino..."
                className="text-sm min-h-[40px] mt-1"
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={result.status === "generating" || result.status === "polling" || !domain.trim() || languages.length === 0}
              className="w-full"
              size="lg"
            >
              {(result.status === "generating" || result.status === "polling") ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {result.progress || "Генерація..."}
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Згенерувати сайт
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Права колонка - результат */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Files className="h-4 w-4" />
                Результат
                {result.status === "completed" && (
                  <Badge variant="secondary" className="text-xs">
                    {result.files.length} файлів
                  </Badge>
                )}
              </span>
              {result.files.length > 0 && (
                <Button size="sm" variant="outline" onClick={handleDownloadZip}>
                  <Download className="h-3 w-3 mr-1" />
                  ZIP
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.status === "idle" && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Заповніть форму і натисніть "Згенерувати"
              </div>
            )}

            {(result.status === "generating" || result.status === "polling") && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
                <p className="text-lg font-mono text-purple-600 mt-3">{formatElapsedTime(elapsedTime)}</p>
                <p className="text-sm text-muted-foreground mt-2">{result.progress || "Генерація..."}</p>
                <p className="text-xs text-muted-foreground mt-1">Орієнтовний час: 15-25 хвилин</p>
                {result.jobId && (
                  <p className="text-xs text-muted-foreground mt-1">Job ID: {result.jobId.substring(0, 8)}...</p>
                )}
              </div>
            )}

            {result.status === "failed" && (
              <div className="text-center py-8">
                <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
                <p className="text-sm text-red-600 mt-2">{result.error}</p>
              </div>
            )}

            {result.status === "completed" && (
              <Tabs defaultValue="files" className="w-full">
                <TabsList className="w-full h-8">
                  <TabsTrigger value="files" className="text-xs flex-1">
                    <FileCode className="h-3 w-3 mr-1" />
                    Файли
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs flex-1">
                    <Eye className="h-3 w-3 mr-1" />
                    Превью
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="files" className="mt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {/* Список файлів */}
                    <ScrollArea className="h-[300px] border rounded-md p-2">
                      {result.files.map(file => (
                        <button
                          key={file.path}
                          onClick={() => handleFileSelect(file.path)}
                          className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-muted flex items-center gap-1 ${
                            selectedFile === file.path ? "bg-muted" : ""
                          }`}
                        >
                          <span>{getFileIcon(file.path)}</span>
                          <span className="truncate">{file.path}</span>
                        </button>
                      ))}
                    </ScrollArea>

                    {/* Редактор файлу */}
                    <div className="col-span-2 border rounded-md">
                      {selectedFile ? (
                        <div className="h-[300px] flex flex-col">
                          <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/50">
                            <span className="text-xs font-mono">{selectedFile}</span>
                            <div className="flex gap-1">
                              {isEditing ? (
                                <>
                                  <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setIsEditing(false)}>
                                    Скасувати
                                  </Button>
                                  <Button size="sm" className="h-6 text-xs" onClick={handleSaveEdit}>
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Зберегти
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setIsEditing(true)}>
                                  Редагувати
                                </Button>
                              )}
                            </div>
                          </div>
                          {isEditing ? (
                            <Textarea 
                              value={editedContent}
                              onChange={e => setEditedContent(e.target.value)}
                              className="flex-1 font-mono text-xs resize-none border-0 rounded-none"
                            />
                          ) : (
                            <ScrollArea className="flex-1 p-2">
                              <pre className="text-xs font-mono whitespace-pre-wrap">
                                {editedContent}
                              </pre>
                            </ScrollArea>
                          )}
                        </div>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                          Виберіть файл зліва
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="preview" className="mt-2">
                  <AiPreviewWithNav files={result.files} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Секція для чату з AI редактором */}
      {result.status === "completed" && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-500" />
              AI Редактор — опишіть що потрібно виправити
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Textarea 
                placeholder="Наприклад: Додай форму контактів на contact.html, зміни колір хедера на синій..."
                className="flex-1 min-h-[60px] text-sm"
              />
              <Button className="self-end">
                <Wand2 className="h-4 w-4 mr-2" />
                Виправити
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 AI проаналізує файли і внесе зміни відповідно до вашого запиту
            </p>
          </CardContent>
        </Card>
      )}

      {/* Історія генерацій */}
      <AiEditorHistory />
    </div>
  );
};

export default AiEditorTab;
