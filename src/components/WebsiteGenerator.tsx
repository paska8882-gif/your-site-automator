import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileCode2, Sparkles, LogOut, User, Zap, Crown, Globe, Layers } from "lucide-react";
import { startGeneration, AiModel, WebsiteType } from "@/lib/websiteGenerator";
import { GenerationHistory } from "./GenerationHistory";
import { useAuth } from "@/hooks/useAuth";

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
  const { user, signOut } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [language, setLanguage] = useState("auto");
  const [aiModel, setAiModel] = useState<AiModel>("senior");
  const [websiteType, setWebsiteType] = useState<WebsiteType>("html");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Вихід",
      description: "Ви вийшли з акаунту",
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть опис сайту",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await startGeneration(
        prompt,
        language === "auto" ? undefined : language,
        aiModel,
        websiteType
      );

      if (result.success) {
        toast({
          title: "Генерацію розпочато",
          description: "Сайт генерується у фоновому режимі. Слідкуйте за статусом в історії.",
        });
        setPrompt("");
      } else {
        toast({
          title: "Помилка",
          description: result.error || "Не вдалося запустити генерацію",
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Sparkles className="h-10 w-10 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                AI Website Generator
              </h1>
              <p className="text-muted-foreground text-sm">
                Опишіть сайт — AI згенерує HTML, CSS та всі файли
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Вийти
            </Button>
          </div>
        </div>

        {/* Input Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              Опис сайту
            </CardTitle>
            <CardDescription>
              Опишіть тип бізнесу, послуги, стиль дизайну та інші деталі. Можна запускати кілька генерацій паралельно.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Наприклад: Сучасний сайт для IT-компанії з послугами веб-розробки. Темна тема, мінімалістичний дизайн. Сторінки: головна, послуги, портфоліо, контакти..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[150px] resize-none"
              disabled={isSubmitting}
            />

            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={language} onValueChange={setLanguage} disabled={isSubmitting}>
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

              <Select value={aiModel} onValueChange={(v) => setAiModel(v as AiModel)} disabled={isSubmitting}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="AI модель" />
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

              <Select value={websiteType} onValueChange={(v) => setWebsiteType(v as WebsiteType)} disabled={isSubmitting}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Тип сайту" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="html">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-green-500" />
                      HTML/CSS
                    </div>
                  </SelectItem>
                  <SelectItem value="react">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-cyan-500" />
                      React
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleGenerate}
                disabled={isSubmitting || !prompt.trim()}
                className="flex-1"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Відправка...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Згенерувати
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* History with realtime updates and preview */}
        <GenerationHistory />
      </div>
    </div>
  );
}
