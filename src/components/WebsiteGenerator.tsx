import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileCode2, Sparkles, LogOut, User, Zap, Crown, Globe, Layers, Languages, Hash, Wand2, Palette, ChevronDown, AlertTriangle, Shield, Users, Wallet, RefreshCcw, Info, Image } from "lucide-react";
import { startGeneration, AiModel, WebsiteType, SeniorMode, ImageSource, LAYOUT_STYLES } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { GenerationHistory } from "./GenerationHistory";
import { UserTeamInfo } from "./UserTeamInfo";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTeamOwner } from "@/hooks/useTeamOwner";

interface TeamPricing {
  teamId: string;
  teamName: string;
  balance: number;
  htmlPrice: number;
  reactPrice: number;
}

const languages = [
  { value: "uk", label: "Українська" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "es", label: "Español" },
  { value: "it", label: "Italiano" },
  { value: "pl", label: "Polski" },
  { value: "pt", label: "Português" },
  { value: "nl", label: "Nederlands" },
  { value: "cs", label: "Čeština" },
  { value: "sk", label: "Slovenčina" },
  { value: "hu", label: "Magyar" },
  { value: "ro", label: "Română" },
  { value: "bg", label: "Български" },
  { value: "el", label: "Ελληνικά" },
  { value: "sv", label: "Svenska" },
  { value: "da", label: "Dansk" },
  { value: "fi", label: "Suomi" },
  { value: "no", label: "Norsk" },
  { value: "hr", label: "Hrvatski" },
  { value: "sl", label: "Slovenščina" },
  { value: "lt", label: "Lietuvių" },
  { value: "lv", label: "Latviešu" },
  { value: "et", label: "Eesti" },
];

// Play notification sound using Web Audio API
const playCompletionSound = (success: boolean) => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (success) {
      // Success: pleasant two-tone chime
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.15); // E5
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    } else {
      // Error: lower tone
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime); // A3
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    }
  } catch (e) {
    console.log("Audio not supported");
  }
};

export function WebsiteGenerator() {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { isAdmin } = useAdmin();
  const { isTeamOwner } = useTeamOwner();
  const navigate = useNavigate();
  const [siteName, setSiteName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["uk"]);
  const [customLanguage, setCustomLanguage] = useState("");
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [customStyle, setCustomStyle] = useState("");
  const [isOtherStyleSelected, setIsOtherStyleSelected] = useState(false);
  const [sitesPerLanguage, setSitesPerLanguage] = useState(1);
  const [aiModel, setAiModel] = useState<AiModel>("senior");
  const [seniorMode, setSeniorMode] = useState<SeniorMode>(undefined);
  const [websiteType, setWebsiteType] = useState<WebsiteType>("html");
  const [imageSource, setImageSource] = useState<ImageSource>("basic");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [teamPricing, setTeamPricing] = useState<TeamPricing | null>(null);

  // Fetch team pricing on mount
  useEffect(() => {
    const fetchTeamPricing = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's team membership
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      if (!membership) return;

      // Get team details
      const { data: team } = await supabase
        .from("teams")
        .select("id, name, balance")
        .eq("id", membership.team_id)
        .maybeSingle();

      // Get team pricing
      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("html_price, react_price")
        .eq("team_id", membership.team_id)
        .maybeSingle();

      if (team) {
        setTeamPricing({
          teamId: team.id,
          teamName: team.name,
          balance: team.balance || 0,
          htmlPrice: pricing?.html_price || 7,
          reactPrice: pricing?.react_price || 9
        });
      }
    };

    fetchTeamPricing();

    // Subscribe to team balance changes
    const channel = supabase
      .channel("team_balance_changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "teams" },
        (payload) => {
          if (teamPricing && payload.new.id === teamPricing.teamId) {
            setTeamPricing(prev => prev ? { ...prev, balance: payload.new.balance } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  const handleImprovePrompt = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: "Спочатку введіть опис сайту",
        variant: "destructive",
      });
      return;
    }

    setIsImproving(true);
    try {
      // Перевіряємо сесію перед викликом
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session) {
        toast({
          title: "Помилка авторизації",
          description: "Будь ласка, перезавантажте сторінку або увійдіть знову",
          variant: "destructive",
        });
        setIsImproving(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('improve-prompt', {
        body: { prompt },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        // Якщо помилка авторизації - показуємо відповідне повідомлення
        if (error.message?.includes('401') || error.message?.includes('JWT')) {
          throw new Error('Сесія застаріла. Перезавантажте сторінку.');
        }
        throw error;
      }

      if (data.improvedPrompt) {
        setPrompt(data.improvedPrompt);
        toast({
          title: "Промпт покращено",
          description: "AI покращив ваш опис сайту",
        });
      }
    } catch (error: any) {
      console.error("Error improving prompt:", error);
      toast({
        title: "Помилка",
        description: error instanceof Error ? error.message : "Не вдалося покращити промпт",
        variant: "destructive",
      });
    } finally {
      setIsImproving(false);
    }
  };

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
        // Always allow deselecting
        return prev.filter((l) => l !== langValue);
      }
      return [...prev, langValue];
    });
  };

  const toggleOther = () => {
    setIsOtherSelected((prev) => {
      if (prev) {
        setCustomLanguage("");
      }
      return !prev;
    });
  };

  // Calculate all languages including custom
  const getAllSelectedLanguages = () => {
    const langs = [...selectedLanguages];
    if (isOtherSelected && customLanguage.trim()) {
      langs.push(customLanguage.trim());
    }
    return langs;
  };

  const toggleStyle = (styleId: string) => {
    setSelectedStyles((prev) => {
      if (prev.includes(styleId)) {
        return prev.filter((s) => s !== styleId);
      }
      return [...prev, styleId];
    });
  };

  const toggleOtherStyle = () => {
    setIsOtherStyleSelected((prev) => {
      if (prev) {
        setCustomStyle("");
      }
      return !prev;
    });
  };

  // Calculate all styles including custom
  const getAllSelectedStyles = () => {
    const styles = [...selectedStyles];
    if (isOtherStyleSelected && customStyle.trim()) {
      styles.push(customStyle.trim());
    }
    return styles;
  };

  // Calculate total generations: languages × sites × (styles or 1 if random)
  const allLanguages = getAllSelectedLanguages();
  const allStyles = getAllSelectedStyles();
  const styleCount = allStyles.length || 1; // If no styles selected, it's random (counts as 1)
  const totalGenerations = allLanguages.length * sitesPerLanguage * styleCount;

  // Calculate total cost for current generation
  const pricePerSite = websiteType === "react" 
    ? (teamPricing?.reactPrice || 9) 
    : (teamPricing?.htmlPrice || 7);
  
  const calculateTotalCost = () => {
    return allLanguages.length * sitesPerLanguage * styleCount * pricePerSite;
  };

  const insufficientBalance = teamPricing ? calculateTotalCost() > teamPricing.balance : false;

  const handleGenerateClick = () => {
    if (!siteName.trim()) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть назву/домен сайту",
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть опис сайту",
        variant: "destructive",
      });
      return;
    }

    if (allLanguages.length === 0) {
      toast({
        title: "Помилка",
        description: "Оберіть хоча б одну мову",
        variant: "destructive",
      });
      return;
    }

    // Check balance before generating
    if (teamPricing && insufficientBalance) {
      const totalCost = calculateTotalCost();
      toast({
        title: "Недостатньо коштів",
        description: `Потрібно $${totalCost.toFixed(2)}, а на балансі $${teamPricing.balance.toFixed(2)}. Зверніться до власника команди для поповнення.`,
        variant: "destructive",
      });
      return;
    }

    // Show confirmation if more than 10 sites
    if (totalGenerations > 10) {
      setShowConfirmDialog(true);
      return;
    }

    executeGeneration();
  };

  const executeGeneration = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      // Create all generation requests in parallel
      // Combinations: languages × sitesPerLanguage × styles (or random if no styles)
      const stylesToUse = allStyles.length > 0 ? allStyles : [undefined]; // undefined = random
      const langs = getAllSelectedLanguages();
      const totalCount = langs.length * sitesPerLanguage * stylesToUse.length;
      
      setGenerationProgress({ completed: 0, total: totalCount });

      // Create wrapped promises that update progress on completion
      const createTrackedPromise = async (lang: string, style: string | undefined) => {
        const currentSeniorMode = aiModel === "senior" ? seniorMode : undefined;
        const result = await startGeneration(prompt, lang, aiModel, websiteType, style, siteName, currentSeniorMode, imageSource);
        setGenerationProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        return result;
      };

      const generationPromises: Promise<any>[] = [];
      for (const lang of langs) {
        for (let i = 0; i < sitesPerLanguage; i++) {
          for (const style of stylesToUse) {
            generationPromises.push(createTrackedPromise(lang, style));
          }
        }
      }

      // Execute all in parallel
      const results = await Promise.all(generationPromises);

      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      // Play completion sound
      playCompletionSound(successCount > 0);

      if (successCount > 0) {
        toast({
          title: "Генерації розпочато",
          description: `Запущено ${successCount} генерацій${failCount > 0 ? `, ${failCount} помилок` : ""}. Слідкуйте за статусом в історії.`,
        });
        setSiteName("");
        setPrompt("");
      } else {
        const firstError = results.find((r) => !r.success)?.error;
        toast({
          title: "Помилка",
          description: firstError || "Не вдалося запустити жодну генерацію",
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
      setGenerationProgress({ completed: 0, total: 0 });
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
            {isTeamOwner && (
              <Button variant="outline" size="sm" onClick={() => navigate("/team")}>
                <Users className="h-4 w-4 mr-1" />
                Команда
              </Button>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Shield className="h-4 w-4 mr-1" />
                Адмін
              </Button>
            )}
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

        {/* Team Info */}
        <UserTeamInfo />

        {/* Input Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCode2 className="h-5 w-5" />
              Новий сайт
            </CardTitle>
            <CardDescription>
              Введіть назву та опишіть сайт. Можна запускати кілька генерацій паралельно.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Site Name Field */}
            <div className="space-y-2">
              <Label htmlFor="siteName" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Назва / Домен <span className="text-destructive">*</span>
              </Label>
              <Input
                id="siteName"
                placeholder="Наприклад: my-company, techsolutions, coffee-shop"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                disabled={isSubmitting || isImproving}
              />
            </div>

            {/* Description Field */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <FileCode2 className="h-4 w-4" />
                Опис сайту <span className="text-destructive">*</span>
              </Label>
              <Textarea
                placeholder="Наприклад: Сучасний сайт для IT-компанії з послугами веб-розробки. Темна тема, мінімалістичний дизайн. Сторінки: головна, послуги, портфоліо, контакти..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[150px] resize-none"
                disabled={isSubmitting || isImproving}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprovePrompt}
                disabled={isImproving || isSubmitting || !prompt.trim()}
              >
                {isImproving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Покращення...
                  </>
                ) : (
                  <>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Покращити промпт
                  </>
                )}
              </Button>
            </div>

            {/* Compact row: Language, Style, Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Language Multi-Select Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Мова</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" disabled={isSubmitting}>
                      <span className="truncate">
                        {allLanguages.length === 0 
                          ? "Оберіть мови" 
                          : allLanguages.length === 1 
                            ? languages.find(l => l.value === allLanguages[0])?.label || allLanguages[0]
                            : `${allLanguages.length} мов`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-1">
                      {languages.map((lang) => (
                        <label 
                          key={lang.value} 
                          className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedLanguages.includes(lang.value)}
                            onCheckedChange={() => toggleLanguage(lang.value)}
                          />
                          <span className="text-sm">{lang.label}</span>
                        </label>
                      ))}
                      <label 
                        className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer border-t mt-1 pt-2"
                      >
                        <Checkbox 
                          checked={isOtherSelected} 
                          onCheckedChange={() => toggleOther()} 
                        />
                        <span className="text-sm">Інша...</span>
                      </label>
                      {isOtherSelected && (
                        <Input
                          placeholder="Назва мови"
                          value={customLanguage}
                          onChange={(e) => setCustomLanguage(e.target.value)}
                          className="mt-2"
                          autoFocus
                        />
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Style Multi-Select Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Стиль</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" disabled={isSubmitting}>
                      <span className="truncate">
                        {allStyles.length === 0 
                          ? "Рандом" 
                          : allStyles.length === 1 
                            ? LAYOUT_STYLES.find(s => s.id === allStyles[0])?.name || allStyles[0]
                            : `${allStyles.length} стилів`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="start">
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {LAYOUT_STYLES.map((style) => (
                        <label 
                          key={style.id} 
                          className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedStyles.includes(style.id)}
                            onCheckedChange={() => toggleStyle(style.id)}
                          />
                          <span className="text-sm">{style.name}</span>
                        </label>
                      ))}
                      <label 
                        className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer border-t mt-1 pt-2"
                      >
                        <Checkbox 
                          checked={isOtherStyleSelected} 
                          onCheckedChange={() => toggleOtherStyle()} 
                        />
                        <span className="text-sm">Інший...</span>
                      </label>
                      {isOtherStyleSelected && (
                        <Input
                          placeholder="Назва стилю"
                          value={customStyle}
                          onChange={(e) => setCustomStyle(e.target.value)}
                          className="mt-2"
                          autoFocus
                        />
                      )}
                    </div>
                    {(selectedStyles.length > 0 || isOtherStyleSelected) && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-2 text-xs"
                        onClick={() => {
                          setSelectedStyles([]);
                          setIsOtherStyleSelected(false);
                          setCustomStyle("");
                        }}
                      >
                        Скинути (рандом)
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Quantity */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Кількість</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={sitesPerLanguage}
                    onChange={(e) => setSitesPerLanguage(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-20"
                    disabled={isSubmitting}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    = <strong className="text-primary">{totalGenerations}</strong> сайтів
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
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

              {/* Senior Mode - тільки для адміністраторів */}
              {aiModel === "senior" && isAdmin && (
                <Select value={seniorMode || "none"} onValueChange={(v) => setSeniorMode(v === "none" ? undefined : v as SeniorMode)} disabled={isSubmitting}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Режим Senior AI" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-gray-400" />
                        Без режиму
                      </div>
                    </SelectItem>
                    <SelectItem value="codex">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-purple-500" />
                        Генерация на кодексе
                      </div>
                    </SelectItem>
                    <SelectItem value="onepage">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-orange-500" />
                        Одностраничник
                      </div>
                    </SelectItem>
                    <SelectItem value="v0">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-pink-500" />
                        Генерация на v0
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}

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

              <Select value={imageSource} onValueChange={(v) => setImageSource(v as ImageSource)} disabled={isSubmitting}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Підбір фото" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">
                    <div className="flex items-center gap-2">
                      <Image className="h-4 w-4 text-gray-500" />
                      Базовий
                    </div>
                  </SelectItem>
                  <SelectItem value="ai">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      AI пошук фото
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleGenerateClick}
                  disabled={isSubmitting || !siteName.trim() || !prompt.trim() || getAllSelectedLanguages().length === 0 || insufficientBalance}
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
                      {teamPricing && (
                        <span className="ml-2 text-xs opacity-80">
                          = ${calculateTotalCost().toFixed(2)}
                        </span>
                      )}
                    </>
                  )}
                </Button>
                {insufficientBalance && teamPricing && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Недостатньо коштів: потрібно ${calculateTotalCost().toFixed(2)}, на балансі ${teamPricing.balance.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Cost info alert */}
            {teamPricing && totalGenerations > 0 && (
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <span className="font-medium">Вартість:</span> ${pricePerSite} за {websiteType === "react" ? "React" : "HTML"} сайт × {totalGenerations} = <strong>${calculateTotalCost().toFixed(2)}</strong>
                  <br />
                  <span className="text-muted-foreground">
                    💳 Кошти списуються при старті генерації • 
                    <RefreshCcw className="h-3 w-3 inline mx-1" />
                    Автоматичний рефанд при помилці
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {/* Progress bar for bulk generation */}
            {isSubmitting && generationProgress.total > 1 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Прогрес генерації</span>
                  <span>{generationProgress.completed} / {generationProgress.total}</span>
                </div>
                <Progress 
                  value={(generationProgress.completed / generationProgress.total) * 100} 
                  className="h-2"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* History with realtime updates and preview */}
        <GenerationHistory onUsePrompt={(name, desc) => {
          setSiteName(name);
          setPrompt(desc);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} />
      </div>

      {/* Confirmation Dialog for large orders */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Підтвердження замовлення
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Ви збираєтесь запустити <strong className="text-foreground">{totalGenerations} генерацій</strong> одночасно.
              </p>
              {teamPricing && (
                <p className="flex items-center gap-2 text-foreground bg-muted p-2 rounded">
                  <Wallet className="h-4 w-4" />
                  <span>Вартість: <strong>${calculateTotalCost().toFixed(2)}</strong></span>
                  <span className="text-muted-foreground">|</span>
                  <span>Баланс: <strong>${teamPricing.balance.toFixed(2)}</strong></span>
                </p>
              )}
              <p className="text-amber-600 dark:text-amber-400">
                Ця дія запустить всі процеси одразу і є невідворотньою.
              </p>
              <p className="text-xs text-muted-foreground">
                💳 Кошти списуються одразу при старті • Автоматичний рефанд при помилці
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={executeGeneration}>
              Так, запустити за ${calculateTotalCost().toFixed(2)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
