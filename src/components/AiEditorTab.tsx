import { useState } from "react";
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
  Send, 
  FileCode, 
  Eye, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Wand2,
  Files
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES_MAP, GEO_MAP } from "@/lib/filterConstants";
import JSZip from "jszip";

interface GeneratedFile {
  path: string;
  content: string;
}

interface GenerationResult {
  status: "idle" | "generating" | "completed" | "failed";
  files: GeneratedFile[];
  error?: string;
  technicalPrompt?: string;
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
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const handleGenerate = async () => {
    if (!domain.trim() || languages.length === 0) {
      toast({ title: "Помилка", description: "Вкажіть домен та оберіть мови", variant: "destructive" });
      return;
    }

    setResult({ status: "generating", files: [] });

    try {
      toast({
        title: "Генерація запущена",
        description: "Створення технічного промпту...",
      });

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

      setResult({
        status: "completed",
        files: data.files,
        technicalPrompt: data.technicalPrompt,
      });

      toast({
        title: "Генерація завершена",
        description: `Створено ${data.files.length} файлів`,
      });

    } catch (error) {
      console.error("Generation error:", error);
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
              disabled={result.status === "generating" || !domain.trim() || languages.length === 0}
              className="w-full"
              size="lg"
            >
              {result.status === "generating" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Генерація...
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

            {result.status === "generating" && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
                <p className="text-sm text-muted-foreground mt-2">Генерація...</p>
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
                  <div className="border rounded-md h-[300px] bg-white">
                    {result.files.find(f => f.path === "index.html") ? (
                      <iframe
                        srcDoc={result.files.find(f => f.path === "index.html")?.content}
                        className="w-full h-full"
                        sandbox="allow-scripts"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Немає index.html
                      </div>
                    )}
                  </div>
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
    </div>
  );
};

export default AiEditorTab;
