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
import { Loader2, FileCode2, Sparkles, Zap, Crown, Globe, Layers, Languages, Hash, Wand2, Palette, ChevronDown, AlertTriangle, Users, Wallet, RefreshCcw, Info, Image, Save, FolderOpen, Trash2, ChevronUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { startGeneration, AiModel, WebsiteType, SeniorMode, ImageSource, LAYOUT_STYLES } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { GenerationHistory } from "./GenerationHistory";
import { UserTeamInfo } from "./UserTeamInfo";
import { DebtNotificationPopup } from "./DebtNotificationPopup";
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

interface AdminTeam {
  id: string;
  name: string;
  balance: number;
  credit_limit: number;
}

const SUPER_ADMIN_EMAIL = "paska8882@gmail.com";

interface GenerationPreset {
  id: string;
  name: string;
  selectedLanguages: string[];
  customLanguage: string;
  isOtherSelected: boolean;
  selectedStyles: string[];
  customStyle: string;
  isOtherStyleSelected: boolean;
  sitesPerLanguage: number;
  selectedAiModels: AiModel[];
  selectedWebsiteTypes: WebsiteType[];
  selectedImageSources: ImageSource[];
  seniorMode: SeniorMode;
}

interface CostBreakdownItem {
  websiteType: WebsiteType;
  imageSource: ImageSource;
  aiModel: AiModel;
  basePrice: number;
  aiPhotoExtra: number;
  pricePerSite: number;
  count: number;
  subtotal: number;
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
  { value: "kk", label: "Қазақша" },
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
  const { user } = useAuth();
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
  // Multi-select for AI models, website types, image sources
  const [selectedAiModels, setSelectedAiModels] = useState<AiModel[]>(["senior"]);
  const [selectedWebsiteTypes, setSelectedWebsiteTypes] = useState<WebsiteType[]>(["html"]);
  const [selectedImageSources, setSelectedImageSources] = useState<ImageSource[]>(["basic"]);
  const [seniorMode, setSeniorMode] = useState<SeniorMode>(undefined);
  // Admin generation mode: "standard" (all options) vs "senior_direct" (simple Senior mode flow)
  const [adminGenerationMode, setAdminGenerationMode] = useState<"standard" | "senior_direct">("standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [teamPricing, setTeamPricing] = useState<TeamPricing | null>(null);
  
  // Admin team selection
  const [adminTeams, setAdminTeams] = useState<AdminTeam[]>([]);
  const [selectedAdminTeamId, setSelectedAdminTeamId] = useState<string>("");
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;
  
  // Presets
  const [presets, setPresets] = useState<GenerationPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  
  // Debt notification popup
  const [showDebtPopup, setShowDebtPopup] = useState(false);

  // Load presets from localStorage
  useEffect(() => {
    const savedPresets = localStorage.getItem("generationPresets");
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error("Failed to load presets:", e);
      }
    }
  }, []);

  // Fetch teams for admin selection
  useEffect(() => {
    const fetchAdminTeams = async () => {
      if (!isAdmin || !user) return;

      try {
        let query = supabase.from("teams").select("id, name, balance, credit_limit");
        
        // Super admin sees all teams, regular admins only see assigned teams
        if (!isSuperAdmin) {
          query = query.eq("assigned_admin_id", user.id);
        }
        
        const { data: teams } = await query.order("name");
        
        if (teams && teams.length > 0) {
          setAdminTeams(teams);
          // Auto-select first team if not selected
          if (!selectedAdminTeamId) {
            setSelectedAdminTeamId(teams[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch admin teams:", error);
      }
    };

    fetchAdminTeams();
  }, [isAdmin, user, isSuperAdmin]);

  // Update team pricing when admin selects a different team
  useEffect(() => {
    const fetchSelectedTeamPricing = async () => {
      if (!isAdmin || !selectedAdminTeamId) return;

      const selectedTeam = adminTeams.find(t => t.id === selectedAdminTeamId);
      if (!selectedTeam) return;

      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("html_price, react_price")
        .eq("team_id", selectedAdminTeamId)
        .maybeSingle();

      setTeamPricing({
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        balance: selectedTeam.balance || 0,
        htmlPrice: pricing?.html_price || 7,
        reactPrice: pricing?.react_price || 9
      });
    };

    fetchSelectedTeamPricing();
  }, [isAdmin, selectedAdminTeamId, adminTeams]);

  // Save presets to localStorage
  const savePresetsToStorage = (newPresets: GenerationPreset[]) => {
    localStorage.setItem("generationPresets", JSON.stringify(newPresets));
    setPresets(newPresets);
  };

  const saveCurrentPreset = () => {
    if (!presetName.trim()) {
      toast({
        title: "Помилка",
        description: "Введіть назву пресету",
        variant: "destructive",
      });
      return;
    }

    const newPreset: GenerationPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      selectedLanguages,
      customLanguage,
      isOtherSelected,
      selectedStyles,
      customStyle,
      isOtherStyleSelected,
      sitesPerLanguage,
      selectedAiModels,
      selectedWebsiteTypes,
      selectedImageSources,
      seniorMode,
    };

    savePresetsToStorage([...presets, newPreset]);
    setPresetName("");
    toast({
      title: "Пресет збережено",
      description: `"${newPreset.name}" збережено для швидкого використання`,
    });
  };

  const loadPreset = (preset: GenerationPreset) => {
    setSelectedLanguages(preset.selectedLanguages);
    setCustomLanguage(preset.customLanguage);
    setIsOtherSelected(preset.isOtherSelected);
    setSelectedStyles(preset.selectedStyles);
    setCustomStyle(preset.customStyle);
    setIsOtherStyleSelected(preset.isOtherStyleSelected);
    setSitesPerLanguage(preset.sitesPerLanguage);
    setSelectedAiModels(preset.selectedAiModels);
    setSelectedWebsiteTypes(preset.selectedWebsiteTypes);
    setSelectedImageSources(preset.selectedImageSources);
    setSeniorMode(preset.seniorMode);
    toast({
      title: "Пресет завантажено",
      description: `Налаштування "${preset.name}" застосовано`,
    });
  };

  const deletePreset = (presetId: string) => {
    const newPresets = presets.filter(p => p.id !== presetId);
    savePresetsToStorage(newPresets);
    toast({
      title: "Пресет видалено",
    });
  };

  // Fetch team pricing on mount (only for non-admins, admins use team selection)
  useEffect(() => {
    const fetchTeamPricing = async () => {
      // Skip for admins - they use team selection instead
      if (isAdmin) return;
      
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
  }, [isAdmin]);

  // Show debt popup when team balance is negative (only for non-admins)
  useEffect(() => {
    if (!isAdmin && teamPricing && teamPricing.balance < 0) {
      setShowDebtPopup(true);
    }
  }, [teamPricing, isAdmin]);


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

  // Toggle functions for multi-selects
  const toggleAiModel = (model: AiModel) => {
    setSelectedAiModels(prev => 
      prev.includes(model) ? prev.filter(m => m !== model) : [...prev, model]
    );
  };

  const toggleWebsiteType = (type: WebsiteType) => {
    setSelectedWebsiteTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleImageSource = (source: ImageSource) => {
    setSelectedImageSources(prev => 
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  // Calculate total generations: languages × sites × styles × aiModels × websiteTypes × imageSources
  const allLanguages = getAllSelectedLanguages();
  const allStyles = getAllSelectedStyles();
  const styleCount = allStyles.length || 1;
  const aiModelCount = selectedAiModels.length || 1;
  const websiteTypeCount = selectedWebsiteTypes.length || 1;
  const imageSourceCount = selectedImageSources.length || 1;
  const totalGenerations = allLanguages.length * sitesPerLanguage * styleCount * aiModelCount * websiteTypeCount * imageSourceCount;

  // Calculate total cost for current generation (consider all combinations)
  const calculateTotalCost = () => {
    let total = 0;
    const htmlPrice = teamPricing?.htmlPrice || 7;
    const reactPrice = teamPricing?.reactPrice || 9;
    
    const websiteTypesToUse = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : ["html"];
    const imageSourcesToUse = selectedImageSources.length > 0 ? selectedImageSources : ["basic"];
    
    for (const wt of websiteTypesToUse) {
      for (const is of imageSourcesToUse) {
        const basePrice = wt === "react" ? reactPrice : htmlPrice;
        const pricePerSite = basePrice + (is === "ai" ? 2 : 0);
        const count = allLanguages.length * sitesPerLanguage * styleCount * aiModelCount;
        total += count * pricePerSite;
      }
    }
    return total;
  };

  // Get detailed cost breakdown for each combination
  const getCostBreakdown = (): CostBreakdownItem[] => {
    const breakdown: CostBreakdownItem[] = [];
    const htmlPrice = teamPricing?.htmlPrice || 7;
    const reactPrice = teamPricing?.reactPrice || 9;
    
    const websiteTypesToUse = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : ["html" as WebsiteType];
    const imageSourcesToUse = selectedImageSources.length > 0 ? selectedImageSources : ["basic" as ImageSource];
    const aiModelsToUse = selectedAiModels.length > 0 ? selectedAiModels : ["senior" as AiModel];
    
    for (const wt of websiteTypesToUse) {
      for (const is of imageSourcesToUse) {
        for (const ai of aiModelsToUse) {
          const basePrice = wt === "react" ? reactPrice : htmlPrice;
          const aiPhotoExtra = is === "ai" ? 2 : 0;
          const pricePerSite = basePrice + aiPhotoExtra;
          const count = allLanguages.length * sitesPerLanguage * styleCount;
          
          breakdown.push({
            websiteType: wt,
            imageSource: is,
            aiModel: ai,
            basePrice,
            aiPhotoExtra,
            pricePerSite,
            count,
            subtotal: count * pricePerSite,
          });
        }
      }
    }
    return breakdown;
  };

  // Get credit limit for selected team (for admins)
  const selectedTeamCreditLimit = isAdmin && selectedAdminTeamId 
    ? (adminTeams.find(t => t.id === selectedAdminTeamId)?.credit_limit || 0)
    : 0;

  // Admins can generate on credit up to the credit limit
  const insufficientBalance = !isAdmin && teamPricing ? calculateTotalCost() > teamPricing.balance : false;
  const isGeneratingOnCredit = isAdmin && teamPricing ? calculateTotalCost() > teamPricing.balance : false;
  // Check if admin exceeds credit limit (balance can go negative up to -credit_limit)
  const exceedsCreditLimit = isAdmin && teamPricing 
    ? (teamPricing.balance - calculateTotalCost()) < -selectedTeamCreditLimit
    : false;

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

    // Admin must select a team
    if (isAdmin && !selectedAdminTeamId) {
      toast({
        title: "Помилка",
        description: "Оберіть команду для генерації",
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

    // Check balance before generating (admins can generate on credit)
    if (teamPricing && insufficientBalance && !isAdmin) {
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
      // Combinations: languages × sitesPerLanguage × styles × aiModels × websiteTypes × imageSources
      const stylesToUse = allStyles.length > 0 ? allStyles : [undefined];
      const aiModelsToUse = selectedAiModels.length > 0 ? selectedAiModels : ["senior" as AiModel];
      const websiteTypesToUse = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : ["html" as WebsiteType];
      const imageSourcesToUse = selectedImageSources.length > 0 ? selectedImageSources : ["basic" as ImageSource];
      const langs = getAllSelectedLanguages();
      const totalCount = langs.length * sitesPerLanguage * stylesToUse.length * aiModelsToUse.length * websiteTypesToUse.length * imageSourcesToUse.length;
      
      setGenerationProgress({ completed: 0, total: totalCount });

      // Create wrapped promises that update progress on completion
      const createTrackedPromise = async (lang: string, style: string | undefined, model: AiModel, wType: WebsiteType, iSource: ImageSource) => {
        const currentSeniorMode = model === "senior" ? seniorMode : undefined;
        // For admins, pass selected team ID; for regular users, teamId is undefined (uses their membership)
        const teamIdToUse = isAdmin ? selectedAdminTeamId : undefined;
        const result = await startGeneration(prompt, lang, model, wType, style, siteName, currentSeniorMode, iSource, teamIdToUse);
        setGenerationProgress(prev => ({ ...prev, completed: prev.completed + 1 }));
        return result;
      };

      const generationPromises: Promise<any>[] = [];
      for (const lang of langs) {
        for (let i = 0; i < sitesPerLanguage; i++) {
          for (const style of stylesToUse) {
            for (const model of aiModelsToUse) {
              for (const wType of websiteTypesToUse) {
                for (const iSource of imageSourcesToUse) {
                  generationPromises.push(createTrackedPromise(lang, style, model, wType, iSource));
                }
              }
            }
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
              <h1 className="text-xl font-semibold">AI Website Generator</h1>
              <p className="text-muted-foreground text-xs">Опишіть сайт — AI згенерує всі файли</p>
            </div>
          </div>
        </div>

        {/* Team Info */}
        <UserTeamInfo />

        {/* Input Section */}
        <Card className="mb-4">
          <CardHeader className="py-3 px-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileCode2 className="h-4 w-4" />
              Новий сайт
            </CardTitle>
            <CardDescription className="text-xs">
              Введіть назву та опишіть сайт. Можна запускати кілька генерацій паралельно.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 pt-0">
            {/* Mode Selection - Compact toggle for admin */}
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-3">
                {/* Team Selection */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <Select 
                    value={selectedAdminTeamId} 
                    onValueChange={setSelectedAdminTeamId}
                    disabled={isSubmitting || adminTeams.length === 0}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Оберіть команду..." />
                    </SelectTrigger>
                    <SelectContent>
                      {adminTeams.map(team => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name} (${team.balance.toFixed(0)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setAdminGenerationMode("standard")}
                    disabled={isSubmitting}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5 ${
                      adminGenerationMode === "standard"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Внутрішня
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminGenerationMode("senior_direct")}
                    disabled={isSubmitting}
                    className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors flex items-center gap-1.5 ${
                      adminGenerationMode === "senior_direct"
                        ? "bg-amber-500 text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Crown className="h-3.5 w-3.5" />
                    Зовнішня
                  </button>
                </div>
                
                {adminGenerationMode === "senior_direct" && (
                  <>
                    <Select 
                      value={seniorMode || "none"} 
                      onValueChange={(v) => setSeniorMode(v === "none" ? undefined : v as SeniorMode)} 
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Сервіс..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Оберіть сервіс</SelectItem>
                        <SelectItem value="codex">🤖 Кодувальник Кирил</SelectItem>
                        <SelectItem value="onepage">📄 Одноазка</SelectItem>
                        <SelectItem value="v0">⚡ Вова нуляра</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={selectedLanguages[0] || "uk"} 
                      onValueChange={(v) => setSelectedLanguages([v])} 
                      disabled={isSubmitting}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <Languages className="h-3.5 w-3.5 mr-1" />
                        <SelectValue placeholder="Мова..." />
                      </SelectTrigger>
                      <SelectContent>
                        {languages.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}

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

            {/* Standard Mode Options - show for non-admins OR when admin selects standard mode */}
            {(!isAdmin || adminGenerationMode === "standard") && (
              <>
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
                    <div className="space-y-1 max-h-64 overflow-y-auto">
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* AI Model Multi-Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">AI модель</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" disabled={isSubmitting}>
                      <span className="truncate">
                        {selectedAiModels.length === 0 
                          ? "Оберіть" 
                          : selectedAiModels.length === 1 
                            ? (selectedAiModels[0] === "senior" ? "Senior" : "Junior")
                            : `${selectedAiModels.length} моделі`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1">
                      <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedAiModels.includes("senior")}
                          onCheckedChange={() => toggleAiModel("senior")}
                        />
                        <Crown className="h-4 w-4 text-amber-500" />
                        <span className="text-sm">Senior AI</span>
                      </label>
                      <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedAiModels.includes("junior")}
                          onCheckedChange={() => toggleAiModel("junior")}
                        />
                        <Zap className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Junior AI</span>
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Website Type Multi-Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Тип сайту</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" disabled={isSubmitting}>
                      <span className="truncate">
                        {selectedWebsiteTypes.length === 0 
                          ? "Оберіть" 
                          : selectedWebsiteTypes.length === 1 
                            ? (selectedWebsiteTypes[0] === "html" ? "HTML/CSS" : "React")
                            : `${selectedWebsiteTypes.length} типи`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1">
                      <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedWebsiteTypes.includes("html")}
                          onCheckedChange={() => toggleWebsiteType("html")}
                        />
                        <Globe className="h-4 w-4 text-green-500" />
                        <span className="text-sm">HTML/CSS</span>
                      </label>
                      <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedWebsiteTypes.includes("react")}
                          onCheckedChange={() => toggleWebsiteType("react")}
                        />
                        <Layers className="h-4 w-4 text-cyan-500" />
                        <span className="text-sm">React</span>
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Image Source Multi-Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Підбір фото</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between" disabled={isSubmitting}>
                      <span className="truncate">
                        {selectedImageSources.length === 0 
                          ? "Оберіть" 
                          : selectedImageSources.length === 1 
                            ? (selectedImageSources[0] === "basic" ? "Базовий" : "AI фото")
                            : `${selectedImageSources.length} варіанти`}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <div className="space-y-1">
                      <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedImageSources.includes("basic")}
                          onCheckedChange={() => toggleImageSource("basic")}
                        />
                        <Image className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">Базовий</span>
                      </label>
                      <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                        <Checkbox
                          checked={selectedImageSources.includes("ai")}
                          onCheckedChange={() => toggleImageSource("ai")}
                        />
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        <span className="text-sm">AI пошук (+$2)</span>
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Preset Management */}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Пресет..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="h-7 text-xs w-28"
                disabled={isSubmitting}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={saveCurrentPreset}
                disabled={isSubmitting || !presetName.trim()}
              >
                <Save className="h-3 w-3 mr-1" />
                Зберегти
              </Button>
              {presets.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={isSubmitting}>
                      <FolderOpen className="h-3 w-3 mr-1" />
                      ({presets.length})
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {presets.map((preset) => (
                        <div key={preset.id} className="flex items-center justify-between gap-1 px-2 py-1 rounded hover:bg-muted">
                          <button
                            onClick={() => loadPreset(preset)}
                            className="text-xs text-left flex-1 truncate"
                          >
                            {preset.name}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-destructive hover:text-destructive"
                            onClick={() => deletePreset(preset.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
              </>
            )}

            {/* Senior Direct Mode Generate Button */}
            {isAdmin && adminGenerationMode === "senior_direct" && (
              <Button
                onClick={async () => {
                  if (!siteName.trim() || !prompt.trim() || !seniorMode) {
                    toast({
                      title: "Заповніть поля",
                      description: "Введіть назву, опис та оберіть сервіс",
                      variant: "destructive",
                    });
                    return;
                  }

                  setIsSubmitting(true);
                  const externalLanguage = selectedLanguages[0] || "uk";
                  try {
                    // Pass team ID only if selected, otherwise generation is free (no billing)
                    await startGeneration(
                      prompt,
                      externalLanguage,
                      "senior",
                      "html",
                      undefined,
                      siteName,
                      seniorMode,
                      "basic",
                      selectedAdminTeamId || undefined
                    );
                    toast({
                      title: "Генерацію запущено",
                      description: `Запит відправлено на ${seniorMode} (${languages.find((l) => l.value === externalLanguage)?.label || externalLanguage})${selectedAdminTeamId ? "" : " — без списання коштів"}`,
                    });
                  } catch (error) {
                    toast({
                      title: "Помилка",
                      description: error instanceof Error ? error.message : "Не вдалося запустити генерацію",
                      variant: "destructive",
                    });
                  }
                  setIsSubmitting(false);
                }}
                disabled={isSubmitting || !siteName.trim() || !prompt.trim() || !seniorMode}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Відправка...
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-4 w-4" />
                    Запустити {seniorMode || "Senior"}
                  </>
                )}
              </Button>
            )}

            {/* Standard mode generate button */}
            {(!isAdmin || adminGenerationMode === "standard") && (
              <>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleGenerateClick}
                disabled={isSubmitting || !siteName.trim() || !prompt.trim() || getAllSelectedLanguages().length === 0 || selectedAiModels.length === 0 || selectedWebsiteTypes.length === 0 || selectedImageSources.length === 0 || (isAdmin ? exceedsCreditLimit : insufficientBalance) || (isAdmin && !selectedAdminTeamId)}
                className="w-full"
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
              {isGeneratingOnCredit && teamPricing && !exceedsCreditLimit && (
                <p className="text-xs text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Генерація в кредит: потрібно ${calculateTotalCost().toFixed(2)}, на балансі ${teamPricing.balance.toFixed(2)} (ліміт: ${selectedTeamCreditLimit.toFixed(2)})
                </p>
              )}
              {exceedsCreditLimit && teamPricing && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Перевищено ліміт кредиту: баланс ${teamPricing.balance.toFixed(2)}, потрібно ${calculateTotalCost().toFixed(2)}, ліміт ${selectedTeamCreditLimit.toFixed(2)}
                </p>
              )}
            </div>

            {/* Cost breakdown with collapsible table */}
            {teamPricing && totalGenerations > 0 && (
              <Collapsible open={showCostBreakdown} onOpenChange={setShowCostBreakdown}>
                <Alert className="bg-muted/50">
                  <div className="flex items-start justify-between w-full">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 mt-0.5" />
                      <AlertDescription className="text-xs">
                        <span className="font-medium">Комбінацій:</span> {allLanguages.length} мов × {sitesPerLanguage} шт × {styleCount} стилів × {aiModelCount} AI × {websiteTypeCount} типів × {imageSourceCount} фото = <strong>{totalGenerations} сайтів</strong>
                        <br />
                        <span className="font-medium">Загальна вартість:</span> <strong>${calculateTotalCost().toFixed(2)}</strong>
                        <br />
                        <span className="text-muted-foreground">
                          💳 Кошти списуються при старті генерації • 
                          <RefreshCcw className="h-3 w-3 inline mx-1" />
                          Автоматичний рефанд при помилці
                        </span>
                      </AlertDescription>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2">
                        {showCostBreakdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        <span className="ml-1 text-xs">Деталі</span>
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </Alert>
                <CollapsibleContent className="mt-2">
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs py-2 h-auto">Тип</TableHead>
                          <TableHead className="text-xs py-2 h-auto">AI</TableHead>
                          <TableHead className="text-xs py-2 h-auto">Фото</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">Базова</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">+AI фото</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">За сайт</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">Кількість</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">Сума</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getCostBreakdown().map((item, idx) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="py-1.5">
                              <span className={item.websiteType === "react" ? "text-cyan-500" : "text-green-500"}>
                                {item.websiteType === "react" ? "React" : "HTML"}
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <span className={item.aiModel === "senior" ? "text-amber-500" : "text-blue-500"}>
                                {item.aiModel === "senior" ? "Senior" : "Junior"}
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <span className={item.imageSource === "ai" ? "text-violet-500" : "text-muted-foreground"}>
                                {item.imageSource === "ai" ? "AI" : "Базові"}
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5 text-right">${item.basePrice}</TableCell>
                            <TableCell className="py-1.5 text-right">
                              {item.aiPhotoExtra > 0 ? <span className="text-violet-500">+${item.aiPhotoExtra}</span> : "-"}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-medium">${item.pricePerSite}</TableCell>
                            <TableCell className="py-1.5 text-right">{item.count}</TableCell>
                            <TableCell className="py-1.5 text-right font-medium">${item.subtotal.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={6} className="py-2 text-right text-xs">Разом:</TableCell>
                          <TableCell className="py-2 text-right text-xs">{totalGenerations}</TableCell>
                          <TableCell className="py-2 text-right text-xs">${calculateTotalCost().toFixed(2)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
              </>
            )}
          </CardContent>
        </Card>

        {/* History with realtime updates and preview - today only */}
        <GenerationHistory 
          defaultDateFilter="today"
          onUsePrompt={(name, desc) => {
            setSiteName(name);
            setPrompt(desc);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }} 
        />
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

      {/* Debt Notification Popup */}
      {teamPricing && (
        <DebtNotificationPopup
          open={showDebtPopup}
          onClose={() => setShowDebtPopup(false)}
          teamName={teamPricing.teamName}
          balance={teamPricing.balance}
        />
      )}
    </div>
  );
}
