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
  generatedPrompt?: string;
}

const AiEditorTab = () => {
  const { toast } = useToast();
  
  // Form state
  const [domain, setDomain] = useState("");
  const [geo, setGeo] = useState("BE");
  const [languages, setLanguages] = useState<string[]>(["FR", "EN"]);
  const [keyword, setKeyword] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [services, setServices] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [prohibitedWords, setProhibitedWords] = useState("");
  
  // Generation state
  const [result, setResult] = useState<GenerationResult>({
    status: "idle",
    files: [],
  });
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Системний промпт (спрощена версія для тесту)
  const SYSTEM_PROMPT = `# 🧠 AI AGENT — REQUIREMENTS TRANSMISSION & VALIDATION PROMPT
## ROLE: REQUIREMENTS PASS-THROUGH CONTROLLER FOR FULLY STATIC MULTI-PAGE WEBSITES

You are a requirements transmission agent. Your job:
1) Extract structured facts from user input
2) Generate a strict, technical generation prompt
3) Validate that output includes every required block

...`; // Тут буде повний промпт

  const handleGenerate = async () => {
    if (!domain.trim()) {
      toast({ title: "Помилка", description: "Введіть домен", variant: "destructive" });
      return;
    }

    setResult({ status: "generating", files: [] });

    try {
      // Формуємо запит до n8n або напряму до AI
      const userInput = `
domain: ${domain}
geo: ${geo}
language: ${languages.join(", ")}
keyword: ${keyword}
business: ${businessDescription}
services: ${services}
phone: ${phone || "generate belgian format"}
email: ${email || `contact@${domain}`}
prohibited words: ${prohibitedWords}
      `.trim();

      toast({
        title: "Генерація запущена",
        description: "Очікуємо відповідь від AI...",
      });

      // TODO: Тут буде виклик edge function для генерації
      // Поки що симулюємо результат
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Тестові файли
      const testFiles: GeneratedFile[] = [
        { path: "index.html", content: `<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <title>${keyword || domain}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <header>\n    <h1>${keyword || domain}</h1>\n    <nav><!-- nav here --></nav>\n  </header>\n  <main>\n    <section class="hero">\n      <h2>Welcome</h2>\n    </section>\n  </main>\n  <script src="script.js" defer></script>\n</body>\n</html>` },
        { path: "styles.css", content: `/* Main styles */\n* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; }` },
        { path: "script.js", content: `// Main script\nconst I18N = {\n  fr: { welcome: "Bienvenue" },\n  en: { welcome: "Welcome" }\n};` },
      ];

      setResult({
        status: "completed",
        files: testFiles,
        generatedPrompt: userInput,
      });

      toast({
        title: "Генерація завершена",
        description: `Створено ${testFiles.length} файлів`,
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
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Домен *</Label>
                <Input 
                  value={domain} 
                  onChange={e => setDomain(e.target.value)}
                  placeholder="example.com"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Гео</Label>
                <Select value={geo} onValueChange={setGeo}>
                  <SelectTrigger className="h-8 text-sm">
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
              <Label className="text-xs">Ключове слово / Бренд</Label>
              <Input 
                value={keyword} 
                onChange={e => setKeyword(e.target.value)}
                placeholder="Brand Name"
                className="h-8 text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">Опис бізнесу</Label>
              <Textarea 
                value={businessDescription} 
                onChange={e => setBusinessDescription(e.target.value)}
                placeholder="Технічний опис діяльності..."
                className="text-sm min-h-[60px]"
              />
            </div>

            <div>
              <Label className="text-xs">Послуги (через кому)</Label>
              <Input 
                value={services} 
                onChange={e => setServices(e.target.value)}
                placeholder="Service 1, Service 2, Service 3"
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Телефон</Label>
                <Input 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+32 xxx xxx xxx"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input 
                  value={email} 
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contact@..."
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Заборонені слова</Label>
              <Input 
                value={prohibitedWords} 
                onChange={e => setProhibitedWords(e.target.value)}
                placeholder="word1, word2, word3"
                className="h-8 text-sm"
              />
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={result.status === "generating"}
              className="w-full"
            >
              {result.status === "generating" ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Генерація...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Згенерувати через AI
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
