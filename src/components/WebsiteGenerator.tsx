import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Eye, Code, FileCode2, Sparkles } from "lucide-react";
import { generateWebsite, createZipFromFiles, downloadBlob, GeneratedFile } from "@/lib/websiteGenerator";
import { FilePreview } from "./FilePreview";

const languages = [
  { value: "auto", label: "Авто-визначення" },
  { value: "uk", label: "Українська" },
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "pl", label: "Polski" },
];

export function WebsiteGenerator() {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("auto");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть опис сайту",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedFiles([]);
    setSelectedFile(null);

    try {
      const result = await generateWebsite(prompt, language === "auto" ? undefined : language);

      if (result.success && result.files) {
        setGeneratedFiles(result.files);
        const indexFile = result.files.find((f) => f.path === "index.html");
        setSelectedFile(indexFile || result.files[0]);
        
        toast({
          title: "Успіх!",
          description: `Згенеровано ${result.totalFiles} файлів`,
        });
      } else {
        toast({
          title: "Помилка генерації",
          description: result.error || "Не вдалося згенерувати сайт",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Невідома помилка",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (generatedFiles.length === 0) return;

    try {
      const blob = await createZipFromFiles(generatedFiles);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      downloadBlob(blob, `website_${timestamp}.zip`);
      
      toast({
        title: "Завантаження",
        description: "ZIP-архів завантажено",
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося створити архів",
        variant: "destructive",
      });
    }
  };

  const getCssFile = () => generatedFiles.find((f) => f.path === "styles.css");

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight">
              AI Website Generator
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Опишіть сайт, який хочете створити, і AI згенерує повний багатосторінковий сайт з HTML, CSS та всіма необхідними файлами
          </p>
        </div>

        <div className={`flex flex-col ${generatedFiles.length > 0 ? 'lg:flex-row' : ''} gap-6`}>
          {/* Left Column - Input + Files */}
          <div className={`space-y-4 ${generatedFiles.length > 0 ? 'lg:w-[30%]' : 'w-full max-w-2xl mx-auto'}`}>
            {/* Input Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode2 className="h-5 w-5" />
                  Опис сайту
                </CardTitle>
                <CardDescription>
                  Опишіть тип бізнесу, послуги, стиль дизайну та інші деталі
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Наприклад: Сучасний сайт для IT-компанії з послугами веб-розробки. Темна тема, мінімалістичний дизайн. Сторінки: головна, послуги, портфоліо, контакти..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[150px] resize-none"
                  disabled={isLoading}
                />

                <div className="flex flex-col sm:flex-row gap-4">
                  <Select value={language} onValueChange={setLanguage} disabled={isLoading}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Мова сайту" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleGenerate}
                    disabled={isLoading || !prompt.trim()}
                    className="flex-1"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Генерація...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Згенерувати
                      </>
                    )}
                  </Button>
                </div>

                {generatedFiles.length > 0 && (
                  <Button onClick={handleDownload} variant="outline" className="w-full" size="lg">
                    <Download className="mr-2 h-4 w-4" />
                    Завантажити ZIP ({generatedFiles.length} файлів)
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* File Tabs - Below Input */}
            {generatedFiles.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-sm font-medium">Файли</CardTitle>
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
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {generatedFiles.map((file) => (
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
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Preview (70%) */}
          {generatedFiles.length > 0 ? (
            <div className="lg:w-[70%]">
              {selectedFile && (
                <FilePreview
                  file={selectedFile}
                  cssFile={getCssFile()}
                  viewMode={viewMode}
                />
              )}
            </div>
          ) : (
            <Card className="h-[400px] flex items-center justify-center max-w-2xl mx-auto w-full">
              <div className="text-center text-muted-foreground">
                <FileCode2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                <p>Результат генерації з'явиться тут</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
