import { useState, useEffect, useRef } from "react";
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
import { Loader2, FileCode2, Sparkles, Zap, Crown, Globe, Layers, Languages, Hash, Palette, ChevronDown, AlertTriangle, Users, Wallet, RefreshCcw, Info, Image, Save, FolderOpen, Trash2, ChevronUp, Filter, Newspaper, MapPin, X, Plus, Star, Phone, Building2, Tag, Shuffle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { startGeneration, AiModel, WebsiteType, SeniorMode, ImageSource, LAYOUT_STYLES } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { GenerationHistory } from "./GenerationHistory";
import { DebtNotificationPopup } from "./DebtNotificationPopup";
import { AdminTeamsDashboard } from "./AdminTeamsDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useBalanceSound } from "@/hooks/useBalanceSound";

// News images
import newsAiNeuralNetwork from "@/assets/news/ai-neural-network.jpg";
import newsWebDevelopment from "@/assets/news/web-development.jpg";
import newsAiCollaboration from "@/assets/news/ai-collaboration.jpg";

interface TeamPricing {
  teamId: string;
  teamName: string;
  balance: number;
  htmlPrice: number;
  reactPrice: number;
  vipExtraPrice: number;
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
  { value: "ja", label: "日本語" },
  { value: "ru", label: "Русский" },
  { value: "tr", label: "Türkçe" },
  { value: "vi", label: "Tiếng Việt" },
  { value: "th", label: "ไทย" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "hi", label: "हिन्दी" },
  { value: "ar", label: "العربية" },
];

// Countries/Geo list
const geoOptions = [
  { value: "", label: "Не вибрано" },
  { value: "uk", label: "Великобританія" },
  { value: "bg", label: "Болгарія" },
  { value: "be", label: "Бельгія" },
  { value: "vn", label: "В'єтнам" },
  { value: "gr", label: "Греція" },
  { value: "dk", label: "Данія" },
  { value: "ee", label: "Естонія" },
  { value: "id", label: "Індонезія" },
  { value: "in", label: "Індія" },
  { value: "ie", label: "Ірландія" },
  { value: "es", label: "Іспанія" },
  { value: "it", label: "Італія" },
  { value: "ca", label: "Канада" },
  { value: "lv", label: "Латвія" },
  { value: "lt", label: "Литва" },
  { value: "nl", label: "Нідерланди" },
  { value: "de", label: "Німеччина" },
  { value: "ae", label: "ОАЕ" },
  { value: "pl", label: "Польща" },
  { value: "pt", label: "Португалія" },
  { value: "ru", label: "Росія" },
  { value: "ro", label: "Румунія" },
  { value: "sk", label: "Словаччина" },
  { value: "si", label: "Словенія" },
  { value: "us", label: "США" },
  { value: "th", label: "Таїланд" },
  { value: "tr", label: "Туреччина" },
  { value: "ua", label: "Україна" },
  { value: "hu", label: "Угорщина" },
  { value: "fi", label: "Фінляндія" },
  { value: "fr", label: "Франція" },
  { value: "hr", label: "Хорватія" },
  { value: "cz", label: "Чехія" },
  { value: "se", label: "Швеція" },
  { value: "jp", label: "Японія" },
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

const DRAFT_STORAGE_KEY = "website_generator_draft";

// Random VIP data arrays
const randomVipTopics = [
  "Video Games", "Law Services", "Dental Care", "Real Estate",
  "Pet Grooming", "Auto Repair", "Fitness Training", "Photography",
  "Home Renovation", "Accounting", "Travel Agency", "Coffee Shop",
  "Bakery", "Flower Delivery", "IT Consulting", "Wedding Planning",
  "Restaurant", "Spa & Wellness", "Plumbing Services", "Insurance Agency",
  "Hair Salon", "Yoga Studio", "Car Dealership", "Cleaning Services"
];

const randomVipAddressesByGeo: Record<string, string[]> = {
  "us": ["123 Main St, New York, NY 10001", "456 Oak Ave, Los Angeles, CA 90001", "789 Pine Rd, Chicago, IL 60601", "321 Elm Blvd, Houston, TX 77001"],
  "uk": ["10 Baker Street, London, W1U 3BW", "25 Queen Road, Manchester, M1 1AB", "42 King Lane, Birmingham, B1 1AA"],
  "de": ["Hauptstraße 15, 10115 Berlin", "Bahnhofstraße 8, 80335 München", "Königstraße 22, 70173 Stuttgart"],
  "ca": ["100 Maple Ave, Toronto, ON M5H 2N2", "200 Cedar St, Vancouver, BC V6B 1A1", "50 Oak Blvd, Montreal, QC H2Y 1C6"],
  "au": ["1 George St, Sydney NSW 2000", "25 Collins St, Melbourne VIC 3000", "10 Queen St, Brisbane QLD 4000"],
  "fr": ["15 Rue de Rivoli, 75001 Paris", "8 Avenue Jean Médecin, 06000 Nice"],
  "es": ["Calle Gran Vía 28, 28013 Madrid", "Passeig de Gràcia 55, 08007 Barcelona"],
  "it": ["Via del Corso 120, 00186 Roma", "Via Montenapoleone 8, 20121 Milano"],
  "default": ["123 Business Center, Downtown", "456 Commerce Blvd, City Center", "789 Enterprise Ave, Business District"]
};

const randomVipPhonesByGeo: Record<string, string[]> = {
  "us": ["+1 (555) 123-4567", "+1 (212) 555-7890", "+1 (310) 555-2345", "+1 (312) 555-6789"],
  "uk": ["+44 20 7946 0958", "+44 161 555 1234", "+44 121 555 5678"],
  "de": ["+49 30 12345678", "+49 89 87654321", "+49 711 55512345"],
  "ca": ["+1 (416) 555-1234", "+1 (604) 555-5678", "+1 (514) 555-9012"],
  "au": ["+61 2 9876 5432", "+61 3 8765 4321", "+61 7 5555 1234"],
  "fr": ["+33 1 42 86 82 00", "+33 4 93 16 64 00"],
  "es": ["+34 91 123 4567", "+34 93 987 6543"],
  "it": ["+39 06 1234 5678", "+39 02 8765 4321"],
  "default": ["+1 (555) 000-1234", "+44 20 1234 5678", "+49 30 55512345"]
};

const randomVipKeywordsByTopic: Record<string, string> = {
  "Video Games": "gaming reviews, gameplay tips, PC games, console gaming, esports",
  "Law Services": "legal advice, attorney consultation, court representation, legal documents",
  "Dental Care": "teeth cleaning, dental implants, cosmetic dentistry, oral health",
  "Real Estate": "property listings, home buying, real estate investment, property management",
  "Pet Grooming": "dog grooming, cat care, pet spa, animal styling, pet hygiene",
  "Auto Repair": "car maintenance, engine repair, brake service, oil change, auto diagnostics",
  "Fitness Training": "personal training, weight loss, muscle building, workout plans",
  "Photography": "portrait photography, event photos, wedding photographer, photo editing",
  "Home Renovation": "kitchen remodeling, bathroom renovation, home improvement, interior design",
  "Accounting": "tax preparation, bookkeeping, financial planning, business accounting",
  "Travel Agency": "vacation packages, flight booking, hotel reservations, travel planning",
  "Coffee Shop": "specialty coffee, espresso drinks, pastries, cafe atmosphere",
  "Bakery": "fresh bread, custom cakes, pastries, wedding cakes, artisan baking",
  "Flower Delivery": "fresh flowers, bouquet arrangements, wedding flowers, same-day delivery",
  "IT Consulting": "tech solutions, network security, cloud services, IT support",
  "Wedding Planning": "event coordination, venue selection, wedding decoration, bridal services",
  "Restaurant": "fine dining, local cuisine, food delivery, catering services",
  "Spa & Wellness": "massage therapy, facial treatments, relaxation, wellness programs",
  "Plumbing Services": "pipe repair, drain cleaning, water heater, emergency plumbing",
  "Insurance Agency": "life insurance, auto insurance, home insurance, insurance quotes",
  "Hair Salon": "haircuts, hair coloring, styling, hair treatments, beauty salon",
  "Yoga Studio": "yoga classes, meditation, mindfulness, wellness retreats",
  "Car Dealership": "new cars, used vehicles, car financing, auto sales",
  "Cleaning Services": "house cleaning, office cleaning, deep cleaning, maid service"
};

interface GeneratorDraft {
  siteNames: string[];
  prompt: string;
  selectedLanguages: string[];
  selectedGeo: string;
  customGeo: string;
  isOtherGeoSelected: boolean;
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
  adminGenerationMode: "standard" | "senior_direct";
}

const loadDraft = (): Partial<GeneratorDraft> => {
  try {
    const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const saveDraft = (draft: GeneratorDraft) => {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage errors
  }
};

export function WebsiteGenerator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { isTeamOwner } = useTeamOwner();
  const navigate = useNavigate();
  
  // Load draft on mount
  const draft = useRef(loadDraft()).current;
  
  const [siteNames, setSiteNames] = useState<string[]>(draft.siteNames || []);
  const [currentSiteNameInput, setCurrentSiteNameInput] = useState("");
  const [prompt, setPrompt] = useState(draft.prompt || "");
  const [originalPrompt, setOriginalPrompt] = useState<string | null>(null); // Stores original prompt before improvement
  const [improvedPromptValue, setImprovedPromptValue] = useState<string | null>(null); // Stores improved prompt
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(draft.selectedLanguages || []);
  const [selectedGeo, setSelectedGeo] = useState(draft.selectedGeo || "");
  const [customGeo, setCustomGeo] = useState(draft.customGeo || "");
  const [isOtherGeoSelected, setIsOtherGeoSelected] = useState(draft.isOtherGeoSelected || false);
  const [customLanguage, setCustomLanguage] = useState(draft.customLanguage || "");
  const [isOtherSelected, setIsOtherSelected] = useState(draft.isOtherSelected || false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(draft.selectedStyles || []);
  const [customStyle, setCustomStyle] = useState(draft.customStyle || "");
  const [isOtherStyleSelected, setIsOtherStyleSelected] = useState(draft.isOtherStyleSelected || false);
  const [sitesPerLanguage, setSitesPerLanguage] = useState(draft.sitesPerLanguage || 1);
  // Multi-select for AI models, website types, image sources
  const [selectedAiModels, setSelectedAiModels] = useState<AiModel[]>(draft.selectedAiModels || ["senior"]);
  const [selectedWebsiteTypes, setSelectedWebsiteTypes] = useState<WebsiteType[]>(draft.selectedWebsiteTypes || ["html"]);
  const [selectedImageSources, setSelectedImageSources] = useState<ImageSource[]>(draft.selectedImageSources || ["basic"]);
  const [seniorMode, setSeniorMode] = useState<SeniorMode>(draft.seniorMode || undefined);
  // Admin generation mode: "standard" (all options) vs "senior_direct" (simple Senior mode flow)
  const [adminGenerationMode, setAdminGenerationMode] = useState<"standard" | "senior_direct">(draft.adminGenerationMode || "standard");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImproving, setIsImproving] = useState(false);
  
  // VIP mode state
  const [isVipMode, setIsVipMode] = useState(false);
  const [isGeneratingVip, setIsGeneratingVip] = useState(false);
  const [vipPromptValue, setVipPromptValue] = useState<string | null>(null);
  const [vipDomain, setVipDomain] = useState("");
  const [vipAddress, setVipAddress] = useState("");
  const [vipPhone, setVipPhone] = useState("");
  const [vipKeywords, setVipKeywords] = useState("");
  const [vipTopic, setVipTopic] = useState("");
  
  const [generationProgress, setGenerationProgress] = useState({ completed: 0, total: 0 });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [teamPricing, setTeamPricing] = useState<TeamPricing | null>(null);
  
  // Admin team selection - persist in localStorage
  const [adminTeams, setAdminTeams] = useState<AdminTeam[]>([]);
  const [selectedAdminTeamId, setSelectedAdminTeamId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin_selected_team_id") || "";
    }
    return "";
  });
  const [animatingTeamId, setAnimatingTeamId] = useState<string | null>(null);
  const [showTeamFilters, setShowTeamFilters] = useState(false);
  const prevAdminBalancesRef = useRef<Record<string, number>>({});
  const { playBalanceSound } = useBalanceSound();
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL;

  // Save selected team to localStorage when changed
  useEffect(() => {
    if (selectedAdminTeamId) {
      localStorage.setItem("admin_selected_team_id", selectedAdminTeamId);
    }
  }, [selectedAdminTeamId]);

  // Auto-resize textarea when prompt changes (e.g., after AI improvement)
  useEffect(() => {
    if (promptTextareaRef.current) {
      promptTextareaRef.current.style.height = 'auto';
      promptTextareaRef.current.style.height = `${Math.max(60, promptTextareaRef.current.scrollHeight)}px`;
    }
  }, [prompt]);

  // Save draft to localStorage when form fields change
  useEffect(() => {
    saveDraft({
      siteNames,
      prompt,
      selectedLanguages,
      selectedGeo,
      customGeo,
      isOtherGeoSelected,
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
      adminGenerationMode,
    });
  }, [
    siteNames, prompt, selectedLanguages, selectedGeo, customGeo, isOtherGeoSelected,
    customLanguage, isOtherSelected,
    selectedStyles, customStyle, isOtherStyleSelected, sitesPerLanguage,
    selectedAiModels, selectedWebsiteTypes, selectedImageSources,
    seniorMode, adminGenerationMode
  ]);
  
  // Presets
  const [presets, setPresets] = useState<GenerationPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  
  // Debt notification popup
  const [showDebtPopup, setShowDebtPopup] = useState(false);

  // Random quote for team selection page
  const [randomQuote, setRandomQuote] = useState<{ text: string; author: string | null } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

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

  // Fetch random quote
  useEffect(() => {
    const fetchRandomQuote = async () => {
      try {
        const { data, error } = await supabase
          .from("quotes")
          .select("text, author")
          .eq("is_active", true);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          const randomIndex = Math.floor(Math.random() * data.length);
          setRandomQuote(data[randomIndex]);
        }
      } catch (error) {
        console.error("Failed to fetch quote:", error);
        // Fallback quote
        setRandomQuote({ text: "Код — це поезія, яку розуміють машини", author: "Генератор мудростей v2.0" });
      }
    };

    fetchRandomQuote();
  }, []);

  // Submit feedback
  const submitFeedback = async () => {
    if (!feedbackText.trim() || !user) return;

    setSendingFeedback(true);
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        message: feedbackText.trim(),
      });

      if (error) throw error;

      toast({
        title: "Дякуємо за фідбек!",
        description: "Ми обов'язково його розглянемо",
      });
      setFeedbackText("");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося надіслати фідбек",
        variant: "destructive",
      });
    } finally {
      setSendingFeedback(false);
    }
  };

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
          // Initialize balance tracking for animation
          teams.forEach(team => {
            prevAdminBalancesRef.current[team.id] = team.balance;
          });
          // Validate cached team exists, otherwise clear cache
          const cachedTeamId = localStorage.getItem("admin_selected_team_id");
          if (cachedTeamId && !teams.find(t => t.id === cachedTeamId)) {
            localStorage.removeItem("admin_selected_team_id");
            setSelectedAdminTeamId("");
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
        .select("html_price, react_price, vip_extra_price")
        .eq("team_id", selectedAdminTeamId)
        .maybeSingle();

      setTeamPricing({
        teamId: selectedTeam.id,
        teamName: selectedTeam.name,
        balance: selectedTeam.balance || 0,
        htmlPrice: pricing?.html_price || 7,
        reactPrice: pricing?.react_price || 9,
        vipExtraPrice: pricing?.vip_extra_price || 2
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

  const clearAllParameters = () => {
    setSelectedLanguages([]);
    setSelectedGeo("");
    setCustomGeo("");
    setIsOtherGeoSelected(false);
    setCustomLanguage("");
    setIsOtherSelected(false);
    setSelectedStyles([]);
    setCustomStyle("");
    setIsOtherStyleSelected(false);
    setSitesPerLanguage(1);
    setSelectedAiModels([]);
    setSelectedWebsiteTypes([]);
    setSelectedImageSources([]);
    setSeniorMode(null);
    toast({
      title: "Параметри очищено",
      description: "Всі налаштування генерації скинуто",
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
        .select("html_price, react_price, vip_extra_price")
        .eq("team_id", membership.team_id)
        .maybeSingle();

      if (team) {
        setTeamPricing({
          teamId: team.id,
          teamName: team.name,
          balance: team.balance || 0,
          htmlPrice: pricing?.html_price || 7,
          reactPrice: pricing?.react_price || 9,
          vipExtraPrice: pricing?.vip_extra_price || 2
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
          const teamId = payload.new.id;
          const newBalance = payload.new.balance;
          const prevBalance = prevAdminBalancesRef.current[teamId];

          // Update teamPricing for non-admin users
          if (teamPricing && teamId === teamPricing.teamId) {
            setTeamPricing(prev => prev ? { ...prev, balance: newBalance } : null);
          }

          // Update adminTeams array for admin users with animation
          setAdminTeams(prev => {
            const teamExists = prev.some(t => t.id === teamId);
            if (!teamExists) return prev;

            // Trigger animation and sound if balance changed
            if (prevBalance !== undefined && prevBalance !== newBalance) {
              const isPositive = newBalance > prevBalance;
              setAnimatingTeamId(teamId);
              playBalanceSound(isPositive);
              
              setTimeout(() => setAnimatingTeamId(null), 600);
            }

            prevAdminBalancesRef.current[teamId] = newBalance;

            return prev.map(team => 
              team.id === teamId 
                ? { ...team, balance: newBalance, credit_limit: payload.new.credit_limit } 
                : team
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, playBalanceSound]);

  // Show debt popup when team balance is negative (only for non-admins)
  useEffect(() => {
    if (!isAdmin && teamPricing && teamPricing.balance < 0) {
      setShowDebtPopup(true);
    }
  }, [teamPricing, isAdmin]);

  const sanitizeImprovedPrompt = (text: string) => {
    let t = (text || "").replace(/\r\n/g, "\n");

    // Strip common markdown syntax noise
    t = t.replace(/^\s*---+\s*$/gm, "");
    t = t.replace(/^\s*\*\*+\s*$/gm, "");
    t = t.replace(/\*\*(.*?)\*\*/g, "$1");
    t = t.replace(/^\s*#{1,6}\s+/gm, "");

    // Normalize bullet lists
    t = t.replace(/^\s*[*•]\s+/gm, "- ");
    t = t.replace(/^\s*-\s+/gm, "- ");

    // Trim trailing spaces per line and collapse excessive blank lines
    t = t.replace(/[ \t]+$/gm, "");
    t = t.replace(/\n{3,}/g, "\n\n");

    return t.trim();
  };

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

      // Save the original prompt before improving
      const currentOriginal = originalPrompt || prompt;
      
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
        // Якщо помилка 402 - показуємо повідомлення про кредити
        if (error.message?.includes('402')) {
          throw new Error('Недостатньо кредитів Lovable AI. Зверніться до адміністратора.');
        }
        throw error;
      }

      // Check if response contains error (edge function returned error in body)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data.improvedPrompt) {
        const sanitizedImproved = sanitizeImprovedPrompt(data.improvedPrompt);
        // Store original prompt and improved prompt separately
        setOriginalPrompt(currentOriginal);
        setImprovedPromptValue(sanitizedImproved);
        // Don't show improved prompt in textarea - keep the original visible for everyone
        // The improved prompt is used internally for generation but hidden from all users
        // Admins can see improved prompt only in generation history
        toast({
          title: "Промпт покращено",
          description: "AI покращив ваш опис сайту. Оригінал збережено для історії.",
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

  const selectWebsiteType = (type: WebsiteType) => {
    setSelectedWebsiteTypes([type]);
  };

  const selectImageSource = (source: ImageSource) => {
    setSelectedImageSources([source]);
  };

  // Get all site names (already an array)
  const getAllSiteNames = () => siteNames;

  // Add a new site name from input
  const addSiteName = () => {
    const trimmed = currentSiteNameInput.trim();
    if (trimmed && !siteNames.includes(trimmed)) {
      setSiteNames(prev => [...prev, trimmed]);
      setCurrentSiteNameInput("");
    }
  };

  // Remove a site name
  const removeSiteName = (name: string) => {
    setSiteNames(prev => prev.filter(n => n !== name));
  };

  // Calculate total generations: siteNames × languages × sites × styles × aiModels × websiteTypes × imageSources
  const allLanguages = getAllSelectedLanguages();
  const allStyles = getAllSelectedStyles();
  const allSiteNames = getAllSiteNames();
  const siteNamesCount = allSiteNames.length || 1;
  const styleCount = allStyles.length || 1;
  const aiModelCount = selectedAiModels.length || 1;
  const websiteTypeCount = selectedWebsiteTypes.length || 1;
  const imageSourceCount = selectedImageSources.length || 1;
  const totalGenerations = siteNamesCount * allLanguages.length * sitesPerLanguage * styleCount * aiModelCount * websiteTypeCount * imageSourceCount;

  // Calculate total cost for current generation (consider all combinations)
  const calculateTotalCost = () => {
    let total = 0;
    const htmlPrice = teamPricing?.htmlPrice || 7;
    const reactPrice = teamPricing?.reactPrice || 9;
    const vipExtra = isVipMode ? (teamPricing?.vipExtraPrice || 2) : 0;
    
    const websiteTypesToUse = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : ["html"];
    const imageSourcesToUse = selectedImageSources.length > 0 ? selectedImageSources : ["basic"];
    
    for (const wt of websiteTypesToUse) {
      for (const is of imageSourcesToUse) {
        const basePrice = wt === "react" ? reactPrice : htmlPrice;
        const pricePerSite = basePrice + (is === "ai" ? 2 : 0) + vipExtra;
        const count = siteNamesCount * allLanguages.length * sitesPerLanguage * styleCount * aiModelCount;
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
          const count = siteNamesCount * allLanguages.length * sitesPerLanguage * styleCount;
          
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

  // Maximum concurrent generations limit per user (default 30, can be customized per user)
  const [userMaxGenerations, setUserMaxGenerations] = useState(30);
  const [activeGenerationsCount, setActiveGenerationsCount] = useState(0);

  // Fetch user's max generations limit from profile
  useEffect(() => {
    const fetchUserLimit = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("max_concurrent_generations")
          .eq("user_id", user.id)
          .single();
        
        if (!error && data?.max_concurrent_generations) {
          setUserMaxGenerations(data.max_concurrent_generations);
        }
      } catch (e) {
        console.error("Failed to fetch user limit:", e);
      }
    };

    fetchUserLimit();
  }, [user]);

  // Fetch active generations count for current user
  useEffect(() => {
    const fetchActiveGenerations = async () => {
      if (!user) return;
      
      try {
        const { count, error } = await supabase
          .from("generation_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "generating");
        
        if (!error && count !== null) {
          setActiveGenerationsCount(count);
        }
      } catch (e) {
        console.error("Failed to fetch active generations:", e);
      }
    };

    fetchActiveGenerations();
    // Poll every 5 seconds to keep count updated
    const interval = setInterval(fetchActiveGenerations, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // Calculate available slots
  const availableSlots = userMaxGenerations - activeGenerationsCount;
  const wouldExceedLimit = totalGenerations > availableSlots;

  const handleGenerateClick = async () => {
    const siteNames = getAllSiteNames();
    if (siteNames.length === 0) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть хоча б одну назву/домен сайту",
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

    // Re-check active generations count before starting
    if (user) {
      const { count, error } = await supabase
        .from("generation_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "generating");
      
      if (!error && count !== null) {
        setActiveGenerationsCount(count);
        const currentAvailableSlots = userMaxGenerations - count;
        
        if (totalGenerations > currentAvailableSlots) {
          toast({
            title: "Перевищено ліміт одночасних генерацій",
            description: `У вас зараз ${count} активних генерацій. Доступно ще ${currentAvailableSlots} слотів (ваш ліміт: ${userMaxGenerations}), а ви хочете запустити ${totalGenerations}. Зачекайте завершення або зменшіть кількість.`,
            variant: "destructive",
          });
          return;
        }
      }
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

    // Snapshot current inputs so we can clear the UI immediately without affecting the in-flight generation
    const promptSnapshot = prompt;
    const originalPromptSnapshot = originalPrompt;
    const improvedPromptSnapshot = improvedPromptValue;
    const langsSnapshot = getAllSelectedLanguages();
    const siteNamesSnapshot = getAllSiteNames();
    const stylesSnapshot = allStyles.length > 0 ? allStyles : [undefined];
    const aiModelsSnapshot = selectedAiModels.length > 0 ? selectedAiModels : (["senior"] as AiModel[]);
    const websiteTypesSnapshot = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : (["html"] as WebsiteType[]);
    const imageSourcesSnapshot = selectedImageSources.length > 0 ? selectedImageSources : (["basic"] as ImageSource[]);
    const vipPromptSnapshot = vipPromptValue;

    // Clear inputs immediately so user can start preparing the next website while generation runs
    setSiteNames([]);
    setCurrentSiteNameInput("");
    setPrompt("");
    setOriginalPrompt(null);
    setImprovedPromptValue(null);
    setVipPromptValue(null);
    setIsVipMode(false);
    setVipDomain("");
    setVipAddress("");
    setVipPhone("");
    setVipKeywords("");
    setVipTopic("");

    try {
      // Create all generation requests in parallel
      // Combinations: siteNames × languages × sitesPerLanguage × styles × aiModels × websiteTypes × imageSources
      const totalCount =
        siteNamesSnapshot.length *
        langsSnapshot.length *
        sitesPerLanguage *
        stylesSnapshot.length *
        aiModelsSnapshot.length *
        websiteTypesSnapshot.length *
        imageSourcesSnapshot.length;

      setGenerationProgress({ completed: 0, total: totalCount });

      // Create wrapped promises that update progress on completion
      const createTrackedPromise = async (
        currentSiteName: string,
        lang: string,
        style: string | undefined,
        model: AiModel,
        wType: WebsiteType,
        iSource: ImageSource
      ) => {
        const currentSeniorMode = model === "senior" ? seniorMode : undefined;
        // For admins, pass selected team ID; for regular users, teamId is undefined (uses their membership)
        const teamIdToUse = isAdmin ? selectedAdminTeamId : undefined;
        // Use original prompt for display, improved prompt for generation (if available)
        const promptForDisplay = originalPromptSnapshot || promptSnapshot;
        const geoToUse = isOtherGeoSelected && customGeo ? customGeo : (selectedGeo && selectedGeo !== "none" ? selectedGeo : undefined);
        const result = await startGeneration(
          promptForDisplay,
          lang,
          model,
          wType,
          style,
          currentSiteName,
          currentSeniorMode,
          iSource,
          teamIdToUse,
          improvedPromptSnapshot || undefined,
          geoToUse,
          vipPromptSnapshot || undefined
        );
        setGenerationProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
        return result;
      };

      const generationPromises: Promise<any>[] = [];
      for (const currentSiteName of siteNamesSnapshot) {
        for (const lang of langsSnapshot) {
          for (let i = 0; i < sitesPerLanguage; i++) {
            for (const style of stylesSnapshot) {
              for (const model of aiModelsSnapshot) {
                for (const wType of websiteTypesSnapshot) {
                  for (const iSource of imageSourcesSnapshot) {
                    generationPromises.push(
                      createTrackedPromise(currentSiteName, lang, style, model, wType, iSource)
                    );
                  }
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

  // Admin must select team first
  if (isAdmin && !selectedAdminTeamId) {
    const positiveTeams = adminTeams.filter(team => team.balance >= 0).sort((a, b) => b.balance - a.balance);
    const negativeTeams = adminTeams.filter(team => team.balance < 0).sort((a, b) => a.balance - b.balance);
    
    return (
      <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8 lg:p-8 lg:pt-12">
        <div className="w-full max-w-4xl lg:max-w-6xl xl:max-w-7xl space-y-4">
          {/* Inspirational quote */}
          {randomQuote && (
            <div className="text-center py-4">
              <blockquote className="text-lg italic text-muted-foreground">
                "{randomQuote.text}"
              </blockquote>
              {randomQuote.author && (
                <p className="text-xs text-muted-foreground/60 mt-1">— {randomQuote.author}</p>
              )}
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Dashboard - responsive width */}
            {adminTeams.length > 0 && (
              <div className="w-full lg:w-72 xl:w-80 shrink-0">
                <AdminTeamsDashboard teams={adminTeams} />
              </div>
            )}
            
            {/* Team selection */}
            <div className="flex-1 border border-border">
              <div className="p-2 border-b border-border flex items-center justify-between">
                <h1 className="text-sm font-medium">Оберіть команду</h1>
                <button
                  onClick={() => setShowTeamFilters(!showTeamFilters)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Filter className="h-3 w-3" />
                  <span>Фільтри</span>
                  {showTeamFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              
              {/* Collapsible filters */}
              {showTeamFilters && (
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-green-500">●</span>
                      <span className="text-muted-foreground">Плюс: {positiveTeams.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-destructive">●</span>
                      <span className="text-muted-foreground">Мінус: {negativeTeams.length}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="p-2">
                {adminTeams.length === 0 ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {/* Positive balance column */}
                    <div className="space-y-1 lg:col-span-1">
                      <div className="text-[10px] text-muted-foreground font-medium px-1 flex items-center gap-1">
                        <span className="text-green-500">●</span> Плюс ({positiveTeams.length})
                      </div>
                      <div className="max-h-[280px] lg:max-h-[400px] overflow-y-auto space-y-1.5">
                        {positiveTeams.map(team => (
                          <button
                            key={team.id}
                            onClick={() => setSelectedAdminTeamId(team.id)}
                            className="w-full flex items-center justify-between p-1.5 border border-border rounded text-xs hover:bg-muted/50 transition-colors"
                          >
                            <span className="font-medium truncate">{team.name}</span>
                            <span className="text-green-600 font-semibold ml-1">${team.balance.toFixed(0)}</span>
                          </button>
                        ))}
                        {positiveTeams.length === 0 && (
                          <p className="text-[10px] text-muted-foreground text-center py-2">Немає</p>
                        )}
                      </div>
                    </div>
                    {/* Negative balance column */}
                    <div className="space-y-1 lg:col-span-1">
                      <div className="text-[10px] text-muted-foreground font-medium px-1 flex items-center gap-1">
                        <span className="text-destructive">●</span> Мінус ({negativeTeams.length})
                      </div>
                      <div className="max-h-[280px] lg:max-h-[400px] overflow-y-auto space-y-1.5">
                        {negativeTeams.map(team => (
                          <button
                            key={team.id}
                            onClick={() => setSelectedAdminTeamId(team.id)}
                            className="w-full flex items-center justify-between p-1.5 border border-border rounded text-xs hover:bg-muted/50 transition-colors"
                          >
                            <span className="font-medium truncate">{team.name}</span>
                            <span className="text-destructive font-semibold ml-1">${team.balance.toFixed(0)}</span>
                          </button>
                        ))}
                        {negativeTeams.length === 0 && (
                          <p className="text-[10px] text-muted-foreground text-center py-2">Немає</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback section */}
          <div className="border border-border rounded p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Залишити фідбек</span>
            </div>
            <Textarea 
              placeholder="Напишіть свої побажання, ідеї або скарги..."
              className="min-h-[60px] text-sm resize-none"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="flex justify-end mt-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs"
                onClick={submitFeedback}
                disabled={!feedbackText.trim() || sendingFeedback}
              >
                {sendingFeedback ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : null}
                Надіслати
              </Button>
            </div>
          </div>

          {/* News section */}
          <div className="border border-border rounded p-3">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Новини</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Article 1 */}
              <article className="group cursor-pointer border border-border rounded overflow-hidden hover:border-primary/50 transition-colors">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={newsAiNeuralNetwork} 
                    alt="AI Neural Networks" 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                  />
                </div>
                <div className="p-2.5">
                  <span className="text-[9px] text-muted-foreground/60">21 грудня 2025</span>
                  <h3 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary transition-colors">
                    Нейромережі навчились писати код краще
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    Останні дослідження показують значний прогрес у автоматичній генерації веб-сторінок.
                  </p>
                </div>
              </article>

              {/* Article 2 */}
              <article className="group cursor-pointer border border-border rounded overflow-hidden hover:border-primary/50 transition-colors">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={newsWebDevelopment} 
                    alt="Web Development" 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                  />
                </div>
                <div className="p-2.5">
                  <span className="text-[9px] text-muted-foreground/60">19 грудня 2025</span>
                  <h3 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary transition-colors">
                    React 20: що нового для AI-генерації
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    Нові хуки та серверні компоненти спрощують інтеграцію з генеративними моделями.
                  </p>
                </div>
              </article>

              {/* Article 3 */}
              <article className="group cursor-pointer border border-border rounded overflow-hidden hover:border-primary/50 transition-colors">
                <div className="aspect-video overflow-hidden">
                  <img 
                    src={newsAiCollaboration} 
                    alt="AI Collaboration" 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-500"
                  />
                </div>
                <div className="p-2.5">
                  <span className="text-[9px] text-muted-foreground/60">17 грудня 2025</span>
                  <h3 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary transition-colors">
                    Модерація контенту: AI vs людина
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    Дослідження показало, що AI-модератори працюють у 5 разів швидше при тій же точності.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedTeamForHeader = adminTeams.find(t => t.id === selectedAdminTeamId);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 max-w-4xl lg:max-w-5xl xl:max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-medium">Генератор сайтів</h1>
          {/* Admin: Show selected team with change button */}
          {isAdmin && selectedTeamForHeader && (
            <div className={`flex items-center gap-2 px-3 py-1.5 border border-border rounded ${animatingTeamId === selectedAdminTeamId ? "balance-changed" : ""}`}>
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{selectedTeamForHeader.name}</span>
              <span className={`text-sm ${selectedTeamForHeader.balance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                (${selectedTeamForHeader.balance.toFixed(0)})
              </span>
              <button
                onClick={() => setSelectedAdminTeamId("")}
                className="ml-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Змінити
              </button>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="border border-border mb-4">
          <div className="p-3 border-b border-border">
            <div className="text-sm font-medium">Новий сайт</div>
          </div>
          <div className="p-3 space-y-3">
            {/* Site Name + Mode Selection - in one row for admin */}
            {isAdmin && (
              <div className="flex flex-wrap items-end gap-3">
                {/* Site Names - left side */}
                <div className="min-w-[280px] flex-1">
                  <Label htmlFor="siteName" className="text-xs mb-1 block">
                    Назви сайтів <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      id="siteName"
                      placeholder="my-company"
                      value={currentSiteNameInput}
                      onChange={(e) => setCurrentSiteNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSiteName();
                        }
                      }}
                      disabled={isImproving}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSiteName}
                      disabled={isImproving || !currentSiteNameInput.trim()}
                      className="h-8 px-2"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {siteNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {siteNames.map((name) => (
                        <Badge key={name} variant="secondary" className="text-xs gap-1 pr-1">
                          {name}
                          <button
                            type="button"
                            onClick={() => removeSiteName(name)}
                            className="ml-0.5 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Mode toggle - right side */}
                <div className="inline-flex rounded-md border border-border p-0.5 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setAdminGenerationMode("standard")}
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
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Сервіс..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>Оберіть сервіс</SelectItem>
                        <SelectItem value="codex">🤖 Кодувальник Кирил</SelectItem>
                        <SelectItem value="onepage">📄 Одноазка</SelectItem>
                        <SelectItem value="v0">⚡ Вова нуляра</SelectItem>
                        <SelectItem value="reaktiv">🚀 Реактивний Михайло</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={selectedLanguages[0] || "uk"} 
                      onValueChange={(v) => setSelectedLanguages([v])} 
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
                    
                    <Select 
                      value={selectedGeo || "none"} 
                      onValueChange={(v) => setSelectedGeo(v === "none" ? "" : v)} 
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs">
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        <SelectValue placeholder="Гео..." />
                      </SelectTrigger>
                      <SelectContent>
                        {geoOptions.map((geo) => (
                          <SelectItem key={geo.value || "none"} value={geo.value || "none"}>
                            {geo.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
            )}

            {/* Site Name Field - for non-admin users */}
            {!isAdmin && (
              <div className="space-y-1">
                <Label htmlFor="siteName" className="text-xs">
                  Назви сайтів <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-1">
                  <Input
                    id="siteName"
                    placeholder="my-company"
                    value={currentSiteNameInput}
                    onChange={(e) => setCurrentSiteNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSiteName();
                      }
                    }}
                    disabled={isImproving}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSiteName}
                    disabled={isImproving || !currentSiteNameInput.trim()}
                    className="h-8 px-2"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {siteNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {siteNames.map((name) => (
                      <Badge key={name} variant="secondary" className="text-xs gap-1 pr-1">
                        {name}
                        <button
                          type="button"
                          onClick={() => removeSiteName(name)}
                          className="ml-0.5 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Description Field */}
            <div className="space-y-1">
              <Label className="text-xs">
                Опис сайту <span className="text-destructive">*</span>
              </Label>
              <Textarea
                ref={promptTextareaRef}
                placeholder="Сучасний сайт для IT-компанії. Темна тема, мінімалізм. Сторінки: головна, послуги, портфоліо, контакти..."
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  // Reset improved prompt state when user manually changes prompt
                  // For regular users, if they edit the original prompt, reset the improved state
                  if (improvedPromptValue && !isAdmin) {
                    // User is editing their original prompt, reset improved state
                    setOriginalPrompt(null);
                    setImprovedPromptValue(null);
                  } else if (improvedPromptValue && isAdmin && e.target.value !== improvedPromptValue) {
                    // Admin is editing, reset if changed from improved prompt
                    setOriginalPrompt(null);
                    setImprovedPromptValue(null);
                  }
                }}
                className="min-h-[60px] text-sm overflow-hidden"
                style={{ resize: 'none' }}
                disabled={isImproving}
              />
              {improvedPromptValue && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Промпт покращено AI{!isAdmin && " (внутрішньо)"}. Оригінал збережеться в історії.
                </div>
              )}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Improve prompt button - $1 extra */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImprovePrompt}
                    disabled={isImproving || isGeneratingVip || !prompt.trim() || isVipMode}
                    className="h-7 text-xs px-2"
                  >
                    {isImproving ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3" />
                    )}
                    Покращити промпт (+$1)
                  </Button>
                  
                  {/* VIP button */}
                  <Button
                    variant={isVipMode ? "default" : "outline"}
                    size="sm"
                    onClick={async () => {
                      if (isVipMode) {
                        // Turn off VIP
                        setIsVipMode(false);
                        setVipPromptValue(null);
                      } else {
                        // Turn on VIP
                        setIsVipMode(true);
                        setImprovedPromptValue(null); // Clear improved prompt when switching to VIP
                        setOriginalPrompt(null);
                      }
                    }}
                    disabled={isImproving || isGeneratingVip}
                    className={`h-7 text-xs px-2 ${isVipMode ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                  >
                    <Star className={`mr-1 h-3 w-3 ${isVipMode ? "fill-current" : ""}`} />
                    VIP (+${teamPricing?.vipExtraPrice || 2})
                    {isVipMode && <span className="ml-1">✓</span>}
                  </Button>
                </div>
                
                {/* Clear button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPrompt('');
                    setOriginalPrompt(null);
                    setImprovedPromptValue(null);
                    setVipPromptValue(null);
                    setIsVipMode(false);
                    setVipDomain("");
                    setVipAddress("");
                    setVipPhone("");
                    setVipKeywords("");
                    setVipTopic("");
                  }}
                  disabled={!prompt.trim()}
                  className="h-7 text-xs px-2"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  Очистити
                </Button>
              </div>

              {/* VIP Mode - Language & Geo REQUIRED (shown above VIP fields for better UX) */}
              {isVipMode && (
                <div className="space-y-3">
                  {/* Language & Geo Required Row */}
                  <div className="p-3 border border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-3">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">Обов'язкові поля для VIP генерації</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Language Select for VIP */}
                      <div className="space-y-1.5">
                        <Label className={`text-xs flex items-center gap-1 ${selectedLanguages.length === 0 && !isOtherSelected ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Languages className="h-3 w-3" />
                          Мова <span className="text-destructive">*</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className={`w-full justify-between h-9 text-sm ${selectedLanguages.length === 0 && !isOtherSelected ? 'border-destructive/50 bg-destructive/5' : ''}`}
                            >
                              <span className="truncate">
                                {(() => {
                                  const allLangs = [...selectedLanguages];
                                  if (isOtherSelected && customLanguage) allLangs.push(customLanguage);
                                  return allLangs.length === 0 
                                    ? "Оберіть мову" 
                                    : allLangs.length === 1 
                                      ? languages.find(l => l.value === allLangs[0])?.label || allLangs[0]
                                      : `${allLangs.length} мов`;
                                })()}
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
                              <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer border-t mt-1 pt-2">
                                <Checkbox checked={isOtherSelected} onCheckedChange={() => toggleOther()} />
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

                      {/* Geo Select for VIP */}
                      <div className="space-y-1.5">
                        <Label className={`text-xs flex items-center gap-1 ${!selectedGeo && !isOtherGeoSelected ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <MapPin className="h-3 w-3" />
                          Гео/Регіон <span className="text-destructive">*</span>
                        </Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              className={`w-full justify-between h-9 text-sm ${!selectedGeo && !isOtherGeoSelected ? 'border-destructive/50 bg-destructive/5' : ''}`}
                            >
                              <div className="flex items-center">
                                <MapPin className="h-3.5 w-3.5 mr-1" />
                                <span className="truncate">
                                  {isOtherGeoSelected && customGeo 
                                    ? customGeo 
                                    : selectedGeo 
                                      ? geoOptions.find(g => g.value === selectedGeo)?.label || selectedGeo
                                      : "Оберіть регіон"}
                                </span>
                              </div>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2 max-h-64 overflow-y-auto" align="start">
                            <div className="space-y-1">
                              {geoOptions.map((geo) => (
                                <label key={geo.value || "none"} className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                  <Checkbox
                                    checked={!isOtherGeoSelected && selectedGeo === geo.value}
                                    onCheckedChange={() => {
                                      setSelectedGeo(geo.value);
                                      setIsOtherGeoSelected(false);
                                      setCustomGeo("");
                                    }}
                                  />
                                  <span className="text-xs">{geo.label}</span>
                                </label>
                              ))}
                              <div className="border-t my-1 pt-1">
                                <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                                  <Checkbox
                                    checked={isOtherGeoSelected}
                                    onCheckedChange={(checked) => {
                                      setIsOtherGeoSelected(!!checked);
                                      if (checked) setSelectedGeo("");
                                    }}
                                  />
                                  <span className="text-xs">Інше</span>
                                </label>
                                {isOtherGeoSelected && (
                                  <Input
                                    placeholder="Введіть своє гео..."
                                    value={customGeo}
                                    onChange={(e) => setCustomGeo(e.target.value)}
                                    className="mt-1 h-8 text-xs"
                                  />
                                )}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  {/* VIP Mode Fields */}
                  <div className="p-3 border border-amber-500/50 bg-amber-500/5 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-sm font-medium">VIP режим генерації</span>
                        <Badge variant="outline" className="text-amber-600 border-amber-500/50">+${teamPricing?.vipExtraPrice || 2}/сайт</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Pick random topic
                          const topic = randomVipTopics[Math.floor(Math.random() * randomVipTopics.length)];
                          
                          // Generate domain from topic
                          const domainBase = topic.toLowerCase().replace(/[^a-z0-9]/g, '');
                          const randomNum = Math.floor(Math.random() * 900) + 100;
                          const domain = `${domainBase}${randomNum}.com`;
                          
                          // Get geo-specific data
                          const geoKey = selectedGeo || "default";
                          const addresses = randomVipAddressesByGeo[geoKey] || randomVipAddressesByGeo["default"];
                          const phones = randomVipPhonesByGeo[geoKey] || randomVipPhonesByGeo["default"];
                          
                          const address = addresses[Math.floor(Math.random() * addresses.length)];
                          const phone = phones[Math.floor(Math.random() * phones.length)];
                          const keywords = randomVipKeywordsByTopic[topic] || "professional services, quality, expert, trusted";
                          
                          setVipDomain(domain);
                          setVipAddress(address);
                          setVipPhone(phone);
                          setVipTopic(topic);
                          setVipKeywords(keywords);
                        }}
                        className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
                      >
                        <Shuffle className="h-3 w-3 mr-1" />
                        Рандом
                      </Button>
                    </div>
                  
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Domain - required */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Домен <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          placeholder="example.com"
                          value={vipDomain}
                          onChange={(e) => setVipDomain(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      
                      {/* Address - required */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          Адреса <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          placeholder="100 Main Street, City, Country"
                          value={vipAddress}
                          onChange={(e) => setVipAddress(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      
                      {/* Phone - required */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          Телефон <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          placeholder="+1 (555) 123-4567"
                          value={vipPhone}
                          onChange={(e) => setVipPhone(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      
                      {/* Topic - optional */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          Тема/Ніша
                        </Label>
                        <Input
                          placeholder="Video Games, Law Services..."
                          value={vipTopic}
                          onChange={(e) => setVipTopic(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* Keywords - optional, full width */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        Ключові слова
                      </Label>
                      <Input
                        placeholder="keyword1, keyword2, keyword3..."
                        value={vipKeywords}
                        onChange={(e) => setVipKeywords(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    {/* Generate VIP prompt button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        // Validate language and geo are selected
                        const hasLanguage = selectedLanguages.length > 0 || (isOtherSelected && customLanguage);
                        const hasGeo = selectedGeo || (isOtherGeoSelected && customGeo);
                        
                        if (!hasLanguage || !hasGeo) {
                          toast({
                            title: "Заповніть обов'язкові поля",
                            description: "Для VIP генерації потрібно обрати мову та регіон",
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (!vipDomain || !vipAddress || !vipPhone || !prompt.trim()) {
                          return;
                        }
                        
                        setIsGeneratingVip(true);
                        try {
                          const siteName = siteNames[0] || vipDomain.split('.')[0];
                          const geoValue = isOtherGeoSelected && customGeo ? customGeo : selectedGeo;
                          const langValue = selectedLanguages[0] || customLanguage || "en";
                          const langLabel = languages.find(l => l.value === langValue)?.label || langValue;
                          const geoLabel = geoOptions.find(g => g.value === geoValue)?.label || geoValue || "International";
                          
                          const { data, error } = await supabase.functions.invoke('generate-vip-prompt', {
                            body: {
                              domain: vipDomain,
                              siteName,
                              geo: geoLabel,
                              language: langLabel,
                              address: vipAddress,
                              phone: vipPhone,
                              topic: vipTopic || undefined,
                              description: prompt,
                              keywords: vipKeywords || undefined,
                            }
                          });
                          
                          if (error) throw error;
                          
                          if (data?.vipPrompt) {
                            setVipPromptValue(data.vipPrompt);
                            toast({
                              title: "VIP промт згенеровано",
                              description: "Детальний промт готовий для генерації",
                            });
                          }
                        } catch (error) {
                          console.error("VIP prompt error:", error);
                          toast({
                            title: "Помилка",
                            description: "Не вдалося згенерувати VIP промт",
                            variant: "destructive",
                          });
                        } finally {
                          setIsGeneratingVip(false);
                        }
                      }}
                      disabled={isGeneratingVip || !vipDomain || !vipAddress || !vipPhone || !prompt.trim() || (selectedLanguages.length === 0 && !isOtherSelected) || (!selectedGeo && !isOtherGeoSelected)}
                      className="w-full h-8 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    >
                      {isGeneratingVip ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      Згенерувати VIP промт
                    </Button>
                    
                    {vipPromptValue && (
                      <div className="text-xs text-green-600 flex items-center gap-1 mt-2">
                        <Star className="h-3 w-3 fill-current" />
                        VIP промт згенеровано! Буде використано при генерації сайту.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Standard Mode Options - show for non-admins OR when admin selects standard mode */}
            {(!isAdmin || adminGenerationMode === "standard") && (
              <>
            {/* Compact row: Language, Style, Geo, Quantity - hide Language & Geo when VIP mode is active */}
            <div className={`grid grid-cols-1 gap-2 ${isVipMode ? 'sm:grid-cols-2' : 'sm:grid-cols-4'}`}>
              {/* Language Multi-Select Dropdown - hide in VIP mode */}
              {!isVipMode && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Мова</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs">
                      <span className="truncate">
                        {allLanguages.length === 0 
                          ? "Оберіть мови" 
                          : allLanguages.length === 1 
                            ? languages.find(l => l.value === allLanguages[0])?.label || allLanguages[0]
                            : `${allLanguages.length} мов`}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
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
              )}

              {/* Style Multi-Select Dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Стиль</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs">
                      <span className="truncate">
                        {allStyles.length === 0 
                          ? "Рандом" 
                          : allStyles.length === 1 
                            ? LAYOUT_STYLES.find(s => s.id === allStyles[0])?.name || allStyles[0]
                            : `${allStyles.length} стилів`}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
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

              {/* Geo Select - hide in VIP mode */}
              {!isVipMode && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Гео</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs">
                      <div className="flex items-center">
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        <span className="truncate">
                          {isOtherGeoSelected && customGeo 
                            ? customGeo 
                            : selectedGeo 
                              ? geoOptions.find(g => g.value === selectedGeo)?.label || selectedGeo
                              : "Не вибрано"}
                        </span>
                      </div>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2 max-h-64 overflow-y-auto" align="start">
                    <div className="space-y-1">
                      {geoOptions.map((geo) => (
                        <label key={geo.value || "none"} className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={!isOtherGeoSelected && selectedGeo === geo.value}
                            onCheckedChange={() => {
                              setSelectedGeo(geo.value);
                              setIsOtherGeoSelected(false);
                              setCustomGeo("");
                            }}
                          />
                          <span className="text-xs">{geo.label}</span>
                        </label>
                      ))}
                      <div className="border-t my-1 pt-1">
                        <label className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                          <Checkbox
                            checked={isOtherGeoSelected}
                            onCheckedChange={(checked) => {
                              setIsOtherGeoSelected(!!checked);
                              if (checked) {
                                setSelectedGeo("");
                              }
                            }}
                          />
                          <span className="text-xs">Інше</span>
                        </label>
                        {isOtherGeoSelected && (
                          <Input
                            placeholder="Введіть своє гео..."
                            value={customGeo}
                            onChange={(e) => setCustomGeo(e.target.value)}
                            className="mt-1 h-7 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              )}

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
                    className="w-16 h-8 text-xs"
                  />
                  <span className={`text-xs whitespace-nowrap ${wouldExceedLimit ? 'text-destructive font-medium' : activeGenerationsCount > 20 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                    = <strong>{totalGenerations}</strong> сайтів {activeGenerationsCount > 0 && <span className="opacity-70">(активних: {activeGenerationsCount}/{userMaxGenerations})</span>}
                    {wouldExceedLimit && " ⚠️"}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* AI Model Multi-Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">AI модель</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs">
                      <span className="truncate">
                        {selectedAiModels.length === 0 
                          ? "Оберіть" 
                          : selectedAiModels.length === 1 
                            ? (selectedAiModels[0] === "senior" ? "Senior" : "Junior")
                            : `${selectedAiModels.length} моделі`}
                      </span>
                      <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
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
                <Select 
                  value={selectedWebsiteTypes[0] || "html"} 
                  onValueChange={(value) => selectWebsiteType(value as WebsiteType)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Оберіть тип" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="html">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-green-500" />
                        <span>HTML/CSS</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="react">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-cyan-500" />
                        <span>React</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="php">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-indigo-500" />
                        <span>PHP</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Image Source Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Підбір фото</Label>
                <Select 
                  value={selectedImageSources[0] || "basic"} 
                  onValueChange={(value) => selectImageSource(value as ImageSource)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Оберіть" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-gray-500" />
                        <span>Базовий</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ai">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        <span>AI пошук (+$2)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

              </>
            )}

            {/* Senior Direct Mode Generate Button */}
            {isAdmin && adminGenerationMode === "senior_direct" && (
              <Button
                onClick={async () => {
                  if (siteNames.length === 0 || !prompt.trim() || !seniorMode) {
                    toast({
                      title: "Заповніть поля",
                      description: "Введіть назву, опис та оберіть сервіс",
                      variant: "destructive",
                    });
                    return;
                  }

                  setIsSubmitting(true);
                  const promptSnapshot = prompt;
                  const externalLanguage = selectedLanguages[0] || "uk";
                  // Determine geo value to pass
                  const geoToUse = isOtherGeoSelected && customGeo
                    ? customGeo
                    : (selectedGeo && selectedGeo !== "none" ? selectedGeo : undefined);
                  try {
                    // Generate for each site name
                    for (const name of siteNames) {
                      await startGeneration(
                        promptSnapshot,
                        externalLanguage,
                        "senior",
                        "html",
                        undefined,
                        name,
                        seniorMode,
                        "basic",
                        selectedAdminTeamId || undefined,
                        undefined, // improvedPrompt
                        geoToUse // geo
                      );
                    }
                    toast({
                      title: "Генерацію запущено",
                      description: `Запущено ${siteNames.length} генерацій на ${seniorMode}${selectedAdminTeamId ? "" : " — без списання коштів"}`,
                    });
                    // Don't clear inputs — let users start another generation immediately
                  } catch (error) {
                    toast({
                      title: "Помилка",
                      description: error instanceof Error ? error.message : "Не вдалося запустити генерацію",
                      variant: "destructive",
                    });
                  }
                  setIsSubmitting(false);
                }}
                disabled={siteNames.length === 0 || !prompt.trim() || !seniorMode}
                className="w-full h-9 text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Відправка...
                  </>
                ) : (
                  <>
                    <Crown className="mr-1 h-3 w-3" />
                    Запустити {seniorMode || "Senior"}
                  </>
                )}
              </Button>
            )}

            {/* Standard mode: Preset + Generate Button in one row */}
            {(!isAdmin || adminGenerationMode === "standard") && (
              <>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {/* Generate Button - left side */}
                <Button
                  onClick={handleGenerateClick}
                  disabled={siteNames.length === 0 || !prompt.trim() || getAllSelectedLanguages().length === 0 || selectedAiModels.length === 0 || selectedWebsiteTypes.length === 0 || selectedImageSources.length === 0 || (isAdmin ? exceedsCreditLimit : insufficientBalance) || (isAdmin && !selectedAdminTeamId)}
                  className="h-9 text-sm"
                >
                  {isSubmitting ? (
                    isImproving ? (
                      <>
                        <Sparkles className="mr-1 h-3 w-3 animate-pulse" />
                        Покращуємо промт...
                      </>
                    ) : (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Генеруємо... {generationProgress.total > 0 && `${generationProgress.completed}/${generationProgress.total}`}
                      </>
                    )
                  ) : (
                    <>
                      Згенерувати {totalGenerations > 1 ? `(${totalGenerations})` : ""}
                      {teamPricing && (
                        <span className="ml-1 text-xs opacity-80">
                          ${calculateTotalCost().toFixed(2)}
                        </span>
                      )}
                    </>
                  )}
                </Button>

                {/* Preset Management - same row */}
                <Input
                  placeholder="Пресет..."
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  className="h-9 text-xs w-24"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 text-xs"
                  onClick={saveCurrentPreset}
                  disabled={!presetName.trim()}
                >
                  <Save className="h-3 w-3" />
                </Button>
                {presets.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-9 px-2 text-xs">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        {presets.length}
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

                {/* Clear all parameters button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={clearAllParameters}
                  disabled={isSubmitting}
                  title="Очистити всі параметри"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Credit warnings - right side */}
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
            </div>

            {/* Cost breakdown */}
            {teamPricing && totalGenerations > 0 && (
              <Collapsible open={showCostBreakdown} onOpenChange={setShowCostBreakdown}>
                <div className={`flex items-center justify-between text-xs border p-2 ${wouldExceedLimit ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
                  <span className={wouldExceedLimit ? 'text-destructive' : 'text-muted-foreground'}>
                    {allLanguages.length}×{sitesPerLanguage}×{styleCount}×{aiModelCount}×{websiteTypeCount}×{imageSourceCount} = <strong className={wouldExceedLimit ? 'text-destructive' : 'text-foreground'}>{totalGenerations}</strong> сайтів • <strong className="text-foreground">${calculateTotalCost().toFixed(2)}</strong>
                    {activeGenerationsCount > 0 && <span className="ml-2 opacity-70">(активних: {activeGenerationsCount}, доступно: {availableSlots})</span>}
                    {wouldExceedLimit && " (перевищено ліміт!)"}
                  </span>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-5 px-1 text-xs">
                      {showCostBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="mt-1">
                  <div className="border border-border overflow-hidden">
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
          </div>
        </div>

        {/* History with realtime updates and preview - today only */}
        <GenerationHistory 
          defaultDateFilter="today"
          onUsePrompt={(name, desc) => {
            setSiteNames(name ? [name] : []);
            setCurrentSiteNameInput("");
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
