import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, CheckCircle2, XCircle, Clock, Eye, RefreshCw, Bot, Sparkles, Globe, FileCode2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { SimplePreview } from "./SimplePreview";
import { GeneratedFile } from "@/lib/websiteGenerator";
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

interface GenerationState {
  id: string;
  status: string;
  site_name: string | null;
  files_data: GeneratedFile[] | null;
  error_message: string | null;
  created_at: string;
}

export function N8nGenerationPanel() {
  const { user } = useAuth();
  
  // Form state
  const [prompt, setPrompt] = useState("");
  const [domain, setDomain] = useState("");
  const [geo, setGeo] = useState("be");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["fr", "en"]);
  const [keywords, setKeywords] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  
  // Generation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentGeneration, setCurrentGeneration] = useState<GenerationState | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (currentGeneration?.status === "generating") {
      interval = setInterval(() => {
        const startTime = new Date(currentGeneration.created_at).getTime();
        const now = Date.now();
        setElapsedTime(Math.floor((now - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentGeneration?.status, currentGeneration?.created_at]);

  // Realtime subscription for generation updates
  useEffect(() => {
    if (!currentGeneration?.id) return;

    const channel = supabase
      .channel(`generation-${currentGeneration.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generation_history",
          filter: `id=eq.${currentGeneration.id}`,
        },
        (payload) => {
          console.log("📡 Realtime update:", payload.new);
          const updated = payload.new as any;
          
          setCurrentGeneration(prev => ({
            ...prev!,
            status: updated.status,
            files_data: updated.files_data as GeneratedFile[] | null,
            error_message: updated.error_message,
          }));
          
          if (updated.status === "completed") {
            toast.success("🎉 Сайт згенеровано!", {
              description: `${updated.site_name || "Website"} готовий до перегляду`,
            });
            // Play success sound
            playNotificationSound(true);
          } else if (updated.status === "failed") {
            toast.error("❌ Помилка генерації", {
              description: updated.error_message || "Невідома помилка",
            });
            playNotificationSound(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentGeneration?.id]);

  const playNotificationSound = (success: boolean) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      if (success) {
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.4);
      } else {
        oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
      }
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    );
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
    setShowPreview(false);

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
        .select("id, status, site_name, created_at")
        .single();

      if (historyError) throw historyError;

      setCurrentGeneration({
        id: historyData.id,
        status: "pending",
        site_name: historyData.site_name,
        files_data: null,
        error_message: null,
        created_at: historyData.created_at,
      });

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
      
      setCurrentGeneration(prev => ({
        ...prev!,
        status: "generating",
      }));

      toast.success("🚀 Запит відправлено", {
        description: "Очікуємо відповідь від n8n бота...",
      });

    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error("Помилка відправки", {
        description: error.message,
      });
      setCurrentGeneration(null);
    } finally {
      setIsSubmitting(false);
    }
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

  const handleReset = () => {
    setCurrentGeneration(null);
    setShowPreview(false);
    setElapsedTime(0);
  };

  const getStatusBadge = () => {
    if (!currentGeneration) return null;
    
    switch (currentGeneration.status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Очікування
          </Badge>
        );
      case "generating":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Генерація... {formatTime(elapsedTime)}
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Готово
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Помилка
          </Badge>
        );
      default:
        return null;
    }
  };

  const isGenerating = currentGeneration?.status === "generating" || currentGeneration?.status === "pending";
  const isCompleted = currentGeneration?.status === "completed";
  const isFailed = currentGeneration?.status === "failed";

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
            Відправте запит на генерацію через зовнішнього n8n бота
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Параметри генерації
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Topic/Theme */}
            <div className="space-y-2">
              <Label htmlFor="prompt">Тема сайту *</Label>
              <Textarea
                id="prompt"
                placeholder="Digital Wayfinding & Spatial Orientation"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
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
                disabled={isGenerating}
              />
            </div>

            {/* Geo */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Географія
              </Label>
              <Select value={geo} onValueChange={setGeo} disabled={isGenerating}>
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
                    onClick={() => !isGenerating && toggleLanguage(lang.value)}
                  >
                    {lang.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label htmlFor="keywords">Ключові слова</Label>
              <Textarea
                id="keywords"
                placeholder="keyword1, keyword2, keyword3..."
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={isGenerating}
                className="min-h-[60px]"
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
                disabled={isGenerating}
                className="min-h-[60px]"
              />
            </div>

            {/* Submit button */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || isGenerating || !prompt.trim()}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Відправка...
                  </>
                ) : isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Генерація...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Відправити на генерацію
                  </>
                )}
              </Button>
              
              {currentGeneration && (
                <Button variant="outline" onClick={handleReset}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status & Preview */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4" />
                Статус генерації
              </div>
              {getStatusBadge()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!currentGeneration ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <Bot className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-center">
                  Заповніть форму та відправте запит на генерацію
                </p>
              </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center justify-center h-[400px]">
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-full border-4 border-primary/20 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-background px-2">
                    <span className="text-2xl font-mono font-bold text-primary">
                      {formatTime(elapsedTime)}
                    </span>
                  </div>
                </div>
                
                <h3 className="text-lg font-medium mb-2">
                  {currentGeneration.site_name || "Генерація сайту"}
                </h3>
                
                <p className="text-sm text-muted-foreground text-center max-w-xs mb-4">
                  n8n бот обробляє ваш запит. Це може зайняти 10-15 хвилин...
                </p>
                
                <div className="w-full max-w-xs">
                  <Progress 
                    value={Math.min((elapsedTime / 900) * 100, 95)} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Очікувана тривалість: ~15 хв
                  </p>
                </div>
              </div>
            ) : isFailed ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-red-500">
                <XCircle className="h-16 w-16 mb-4" />
                <h3 className="text-lg font-medium mb-2">Помилка генерації</h3>
                <p className="text-sm text-center max-w-xs">
                  {currentGeneration.error_message || "Невідома помилка"}
                </p>
                <Button variant="outline" className="mt-4" onClick={handleReset}>
                  Спробувати знову
                </Button>
              </div>
            ) : isCompleted && currentGeneration.files_data ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{currentGeneration.site_name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {currentGeneration.files_data.length} файлів
                    </p>
                  </div>
                  <Button 
                    variant={showPreview ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowPreview(!showPreview)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    {showPreview ? "Сховати" : "Превью"}
                  </Button>
                </div>
                
                {showPreview ? (
                  <div className="border rounded-lg overflow-hidden h-[450px]">
                    <SimplePreview 
                      files={currentGeneration.files_data} 
                      websiteType="html"
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg p-4 h-[350px] overflow-auto">
                    <h4 className="text-sm font-medium mb-2">Згенеровані файли:</h4>
                    <div className="space-y-1">
                      {currentGeneration.files_data.map((file, i) => (
                        <div 
                          key={i} 
                          className="text-xs px-2 py-1.5 bg-muted rounded flex items-center justify-between"
                        >
                          <span className="font-mono">{file.path}</span>
                          <span className="text-muted-foreground">
                            {(file.content.length / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                <p>Завантаження...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* History Section */}
      <N8nGenerationHistory />
    </div>
  );
}
