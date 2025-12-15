import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileCode2, Sparkles, LogOut, User, Zap, Crown, Globe, Layers, Languages, Hash } from "lucide-react";
import { startGeneration, AiModel, WebsiteType } from "@/lib/websiteGenerator";
import { GenerationHistory } from "./GenerationHistory";
import { useAuth } from "@/hooks/useAuth";

const languages = [
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
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["uk"]);
  const [sitesPerLanguage, setSitesPerLanguage] = useState(1);
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

  const toggleLanguage = (langValue: string) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(langValue)) {
        // Don't allow deselecting if it's the last one
        if (prev.length === 1) return prev;
        return prev.filter((l) => l !== langValue);
      }
      return [...prev, langValue];
    });
  };

  const totalGenerations = selectedLanguages.length * sitesPerLanguage;

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть опис сайту",
        variant: "destructive",
      });
      return;
    }

    if (selectedLanguages.length === 0) {
      toast({
        title: "Помилка",
        description: "Оберіть хоча б одну мову",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create all generation requests in parallel
      const generationPromises: Promise<any>[] = [];

      for (const lang of selectedLanguages) {
        for (let i = 0; i < sitesPerLanguage; i++) {
          generationPromises.push(
            startGeneration(prompt, lang, aiModel, websiteType)
          );
        }
      }

      // Execute all in parallel
      const results = await Promise.all(generationPromises);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast({
          title: "Генерації розпочато",
          description: `Запущено ${successCount} генерацій${failCount > 0 ? `, ${failCount} помилок` : ""}. Слідкуйте за статусом в історії.`,
        });
        setPrompt("");
      } else {
        toast({
          title: "Помилка",
          description: "Не вдалося запустити жодну генерацію",
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

            {/* Languages Multi-Select */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Мови сайту (оберіть одну або кілька)
              </Label>
              <div className="flex flex-wrap gap-3">
                {languages.map((lang) => (
                  <div key={lang.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang.value}`}
                      checked={selectedLanguages.includes(lang.value)}
                      onCheckedChange={() => toggleLanguage(lang.value)}
                      disabled={isSubmitting}
                    />
                    <label
                      htmlFor={`lang-${lang.value}`}
                      className="text-sm cursor-pointer select-none"
                    >
                      {lang.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Sites per language */}
            <div className="space-y-2">
              <Label htmlFor="sites-count" className="flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Кількість сайтів на кожну мову
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="sites-count"
                  type="number"
                  min={1}
                  max={10}
                  value={sitesPerLanguage}
                  onChange={(e) => setSitesPerLanguage(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                  className="w-24"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-muted-foreground">
                  Всього генерацій: <strong className="text-primary">{totalGenerations}</strong>
                  {selectedLanguages.length > 1 && (
                    <span className="ml-1">
                      ({selectedLanguages.length} мов × {sitesPerLanguage} сайтів)
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
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
                disabled={isSubmitting || !prompt.trim() || selectedLanguages.length === 0}
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
                    Згенерувати {totalGenerations > 1 ? `(${totalGenerations})` : ""}
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
