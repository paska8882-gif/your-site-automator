import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Bot, Sparkles, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { N8nGenerationHistory } from "./N8nGenerationHistory";

// Languages
const languages = [
  { value: "en", label: "🇬🇧 English" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "pl", label: "🇵🇱 Polski" },
  { value: "uk", label: "🇺🇦 Українська" },
  { value: "ru", label: "🇷🇺 Русский" },
];

// Geo options
const geoOptions = [
  { value: "be", label: "🇧🇪 Бельгія" },
  { value: "nl", label: "🇳🇱 Нідерланди" },
  { value: "de", label: "🇩🇪 Німеччина" },
  { value: "fr", label: "🇫🇷 Франція" },
  { value: "uk", label: "🇬🇧 Великобританія" },
  { value: "us", label: "🇺🇸 США" },
  { value: "pl", label: "🇵🇱 Польща" },
  { value: "it", label: "🇮🇹 Італія" },
  { value: "es", label: "🇪🇸 Іспанія" },
];

export function N8nGenerationPanel() {
  const { user } = useAuth();
  
  // Form state
  const [prompt, setPrompt] = useState("");
  const [domain, setDomain] = useState("");
  const [geo, setGeo] = useState("be");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["fr", "en"]);
  const [keywords, setKeywords] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    );
  };

  const buildFullPrompt = () => {
    let result = `Тема: ${prompt}\n`;
    
    if (domain) {
      result += `Домен: ${domain}\n`;
    }
    
    const geoLabel = geoOptions.find(g => g.value === geo)?.label || geo;
    result += `Гео: ${geoLabel}\n`;
    
    const langLabels = selectedLanguages.map(l => 
      languages.find(lang => lang.value === l)?.label || l
    ).join(", ");
    result += `Мови: ${langLabels}\n`;
    
    if (keywords.trim()) {
      result += `\nКлючові слова:\n${keywords}\n`;
    }
    
    if (forbiddenWords.trim()) {
      result += `\nЗаборонені слова:\n${forbiddenWords}\n`;
    }
    
    return result;
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("Потрібна авторизація");
      return;
    }

    if (!prompt.trim()) {
      toast.error("Введіть тему сайту");
      return;
    }

    if (selectedLanguages.length === 0) {
      toast.error("Виберіть хоча б одну мову");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build site name from domain or prompt
      const siteName = domain 
        ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
        : prompt.slice(0, 50);

      // Build full prompt with all parameters
      const fullPrompt = buildFullPrompt();

      // Create generation history record
      const { data: historyData, error: historyError } = await supabase
        .from("generation_history")
        .insert({
          user_id: user.id,
          prompt: fullPrompt,
          language: selectedLanguages.join(", "),
          site_name: siteName,
          geo: geo.toUpperCase(),
          status: "pending",
          ai_model: "senior",
          website_type: "html",
          image_source: "n8n-bot",
        })
        .select("id")
        .single();

      if (historyError) throw historyError;

      // Call n8n-async-proxy
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("n8n-async-proxy", {
        body: { historyId: historyData.id },
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log("📤 n8n request sent:", response.data);
      
      toast.success("🚀 Запит відправлено", {
        description: "Генерація додана в історію. Очікуйте результат.",
      });

      // Reset form for next generation
      setPrompt("");
      setDomain("");
      setKeywords("");
      setForbiddenWords("");
      
      // Trigger history refresh
      setHistoryKey(prev => prev + 1);

    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Помилка відправки", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            n8n Генератор сайтів
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </CardTitle>
          <CardDescription>
            Відправте запит на генерацію через зовнішнього n8n бота. Можна запускати кілька генерацій паралельно.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Параметри генерації
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              {/* Topic/Theme */}
              <div className="space-y-2">
                <Label htmlFor="prompt">Тема сайту *</Label>
                <Textarea
                  id="prompt"
                  placeholder="Digital Wayfinding & Spatial Orientation"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[80px]"
                />
              </div>

              {/* Domain */}
              <div className="space-y-2">
                <Label htmlFor="domain">Домен (опціонально)</Label>
                <Input
                  id="domain"
                  placeholder="example.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Geo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Географія
                </Label>
                <Select value={geo} onValueChange={setGeo} disabled={isSubmitting}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {geoOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Languages */}
              <div className="space-y-2">
                <Label>Мови сайту</Label>
                <div className="flex flex-wrap gap-2">
                  {languages.map(lang => (
                    <Badge
                      key={lang.value}
                      variant={selectedLanguages.includes(lang.value) ? "default" : "outline"}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => !isSubmitting && toggleLanguage(lang.value)}
                    >
                      {lang.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Keywords */}
              <div className="space-y-2">
                <Label htmlFor="keywords">Ключові слова</Label>
                <Textarea
                  id="keywords"
                  placeholder="keyword1, keyword2, keyword3..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[100px]"
                />
              </div>

              {/* Forbidden words */}
              <div className="space-y-2">
                <Label htmlFor="forbidden">Заборонені слова</Label>
                <Textarea
                  id="forbidden"
                  placeholder="crypto, bitcoin, casino..."
                  value={forbiddenWords}
                  onChange={(e) => setForbiddenWords(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[100px]"
                />
              </div>

              {/* Submit button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !prompt.trim()}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Відправка...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Відправити на генерацію
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Section */}
      <N8nGenerationHistory key={historyKey} />
    </div>
  );
}
