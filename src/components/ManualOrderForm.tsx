import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  Crown, Globe, Layers, Languages, MapPin, X, Plus, 
  FileCode2, Loader2, Upload, Image as ImageIcon, Hand, ChevronDown 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useGenerationMaintenance } from "@/hooks/useGenerationMaintenance";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { GenerationMaintenanceBanner } from "./GenerationMaintenanceBanner";
import { toast as sonnerToast } from "sonner";

// Reuse language and geo lists
const languages = [
  { value: "uk", label: "🇺🇦 Українська" },
  { value: "en", label: "🇬🇧 English" },
  { value: "de", label: "🇩🇪 Deutsch" },
  { value: "fr", label: "🇫🇷 Français" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "it", label: "🇮🇹 Italiano" },
  { value: "pl", label: "🇵🇱 Polski" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "nl", label: "🇳🇱 Nederlands" },
  { value: "cs", label: "🇨🇿 Čeština" },
  { value: "sk", label: "🇸🇰 Slovenčina" },
  { value: "hu", label: "🇭🇺 Magyar" },
  { value: "ro", label: "🇷🇴 Română" },
  { value: "bg", label: "🇧🇬 Български" },
  { value: "el", label: "🇬🇷 Ελληνικά" },
  { value: "sv", label: "🇸🇪 Svenska" },
  { value: "da", label: "🇩🇰 Dansk" },
  { value: "fi", label: "🇫🇮 Suomi" },
  { value: "no", label: "🇳🇴 Norsk" },
  { value: "hr", label: "🇭🇷 Hrvatski" },
  { value: "sl", label: "🇸🇮 Slovenščina" },
  { value: "lt", label: "🇱🇹 Lietuvių" },
  { value: "lv", label: "🇱🇻 Latviešu" },
  { value: "et", label: "🇪🇪 Eesti" },
  { value: "kk", label: "🇰🇿 Қазақша" },
  { value: "ja", label: "🇯🇵 日本語" },
  { value: "ru", label: "🇷🇺 Русский" },
  { value: "tr", label: "🇹🇷 Türkçe" },
  { value: "vi", label: "🇻🇳 Tiếng Việt" },
  { value: "th", label: "🇹🇭 ไทย" },
  { value: "id", label: "🇮🇩 Bahasa Indonesia" },
  { value: "hi", label: "🇮🇳 हिन्दी" },
  { value: "ar", label: "🇸🇦 العربية" },
];

const geoIsoMap: Record<string, string> = {
  uk: "gb", bg: "bg", be: "be", vn: "vn", gr: "gr", dk: "dk", ee: "ee",
  id: "id", in: "in", ie: "ie", es: "es", it: "it", ca: "ca", lv: "lv",
  lt: "lt", nl: "nl", de: "de", ae: "ae", pl: "pl", pt: "pt", ru: "ru",
  ro: "ro", sk: "sk", si: "si", us: "us", th: "th", tr: "tr", ua: "ua",
  hu: "hu", fi: "fi", fr: "fr", hr: "hr", cz: "cz", se: "se", jp: "jp",
  kz: "kz",
};

const GeoFlag = ({ value, size = 16 }: { value: string; size?: number }) => {
  const iso = geoIsoMap[value];
  if (!iso) return null;
  return <img src={`https://flagcdn.com/w40/${iso}.png`} alt="" width={size} height={Math.round(size * 0.75)} className="inline-block shrink-0" style={{ borderRadius: 2 }} />;
};

const geoOptions = [
  { value: "", label: "🌍 Не вибрано" },
  { value: "uk", label: "🇬🇧 Великобританія" },
  { value: "bg", label: "🇧🇬 Болгарія" },
  { value: "be", label: "🇧🇪 Бельгія" },
  { value: "vn", label: "🇻🇳 В'єтнам" },
  { value: "gr", label: "🇬🇷 Греція" },
  { value: "dk", label: "🇩🇰 Данія" },
  { value: "ee", label: "🇪🇪 Естонія" },
  { value: "id", label: "🇮🇩 Індонезія" },
  { value: "in", label: "🇮🇳 Індія" },
  { value: "ie", label: "🇮🇪 Ірландія" },
  { value: "es", label: "🇪🇸 Іспанія" },
  { value: "it", label: "🇮🇹 Італія" },
  { value: "ca", label: "🇨🇦 Канада" },
  { value: "lv", label: "🇱🇻 Латвія" },
  { value: "lt", label: "🇱🇹 Литва" },
  { value: "nl", label: "🇳🇱 Нідерланди" },
  { value: "de", label: "🇩🇪 Німеччина" },
  { value: "ae", label: "🇦🇪 ОАЕ" },
  { value: "pl", label: "🇵🇱 Польща" },
  { value: "pt", label: "🇵🇹 Португалія" },
  { value: "ru", label: "🇷🇺 Росія" },
  { value: "ro", label: "🇷🇴 Румунія" },
  { value: "sk", label: "🇸🇰 Словаччина" },
  { value: "si", label: "🇸🇮 Словенія" },
  { value: "us", label: "🇺🇸 США" },
  { value: "th", label: "🇹🇭 Таїланд" },
  { value: "tr", label: "🇹🇷 Туреччина" },
  { value: "ua", label: "🇺🇦 Україна" },
  { value: "hu", label: "🇭🇺 Угорщина" },
  { value: "fi", label: "🇫🇮 Фінляндія" },
  { value: "fr", label: "🇫🇷 Франція" },
  { value: "hr", label: "🇭🇷 Хорватія" },
  { value: "cz", label: "🇨🇿 Чехія" },
  { value: "se", label: "🇸🇪 Швеція" },
  { value: "kz", label: "🇰🇿 Казахстан" },
  { value: "jp", label: "🇯🇵 Японія" },
];

const getGeoText = (label: string) => {
  return label.replace(/[\u{1F1E0}-\u{1F1FF}]{2}\s*/gu, '').replace(/🌍\s*/, '').trim();
};

interface TeamPricing {
  teamId: string;
  teamName: string;
  balance: number;
  creditLimit: number;
  htmlPrice: number;
  reactPrice: number;
  manualPrice: number;
  vipExtraPrice: number;
}

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ManualOrderForm() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin: isAdminRole } = useAdmin();
  const { isTeamOwner } = useTeamOwner();
  const { isAdminModeEnabled } = useAdminMode();
  const { generationDisabled, generationMessage } = useGenerationMaintenance();
  const { maintenance } = useMaintenanceMode();

  const isGenerationBlocked = maintenance.enabled || generationDisabled;
  const isAdmin = isAdminRole && isAdminModeEnabled;

  // Form state
  const [siteNames, setSiteNames] = useState<string[]>([]);
  const [currentSiteNameInput, setCurrentSiteNameInput] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedGeo, setSelectedGeo] = useState("");
  const [customGeo, setCustomGeo] = useState("");
  const [isOtherGeoSelected, setIsOtherGeoSelected] = useState(false);
  const [geoSearch, setGeoSearch] = useState("");
  
  // Language - single or bilingual
  const [isBilingualMode, setIsBilingualMode] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [bilingualLang1, setBilingualLang1] = useState("");
  const [bilingualLang2, setBilingualLang2] = useState("");
  const [langSearch, setLangSearch] = useState("");
  const [customLanguage, setCustomLanguage] = useState("");
  const [isOtherSelected, setIsOtherSelected] = useState(false);
  
  // Website type - React unlocked
  const [websiteType, setWebsiteType] = useState<"html" | "react" | "php">("html");
  
  // Note & images (VIP-style)
  const [note, setNote] = useState("");
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teamPricing, setTeamPricing] = useState<TeamPricing | null>(null);
  
  // Admin team selection
  const [adminTeams, setAdminTeams] = useState<{ id: string; name: string; balance: number; credit_limit: number }[]>([]);
  const [selectedAdminTeamId, setSelectedAdminTeamId] = useState<string>(() => {
    return localStorage.getItem("admin_selected_team_id") || "";
  });

  // Fetch team pricing for current user
  useEffect(() => {
    const fetchTeamPricing = async () => {
      if (!user) return;

      if (isAdmin) {
        // Admin flow - fetch all teams
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name, balance, credit_limit")
          .order("name");
        if (teams) setAdminTeams(teams);
      }

      // Determine team_id
      let teamId = "";
      if (isAdmin && selectedAdminTeamId) {
        teamId = selectedAdminTeamId;
      } else if (!isAdmin) {
        const { data: membership } = await supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .eq("status", "approved")
          .maybeSingle();
        if (membership) teamId = membership.team_id;
      }

      if (!teamId) return;

      const { data: team } = await supabase
        .from("teams")
        .select("id, name, balance, credit_limit")
        .eq("id", teamId)
        .single();

      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("*")
        .eq("team_id", teamId)
        .single();

      if (team) {
        setTeamPricing({
          teamId: team.id,
          teamName: team.name,
          balance: team.balance,
          creditLimit: team.credit_limit,
          htmlPrice: pricing?.html_price || 5,
          reactPrice: pricing?.react_price || 9,
          manualPrice: pricing?.manual_price || 0,
          vipExtraPrice: pricing?.vip_extra_price || 2,
        });
      }
    };

    fetchTeamPricing();
  }, [user, isAdmin, selectedAdminTeamId]);

  // Site name management
  const addSiteName = () => {
    const name = currentSiteNameInput.trim();
    if (name && !siteNames.includes(name)) {
      setSiteNames([...siteNames, name]);
      setCurrentSiteNameInput("");
    }
  };

  const removeSiteName = (index: number) => {
    setSiteNames(siteNames.filter((_, i) => i !== index));
  };

  const handleSiteNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSiteName();
    }
  };

  const getAllSiteNames = () => {
    const names = [...siteNames];
    if (currentSiteNameInput.trim() && !names.includes(currentSiteNameInput.trim())) {
      names.push(currentSiteNameInput.trim());
    }
    return names;
  };

  // Language selection
  const toggleLanguage = (value: string) => {
    setSelectedLanguages(prev =>
      prev.includes(value) ? prev.filter(l => l !== value) : [...prev, value]
    );
  };

  // Image handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > MAX_FILE_SIZE) {
        sonnerToast.error("Файл занадто великий (макс. 5MB)");
        continue;
      }
      if (images.length >= MAX_IMAGES) break;
      const preview = URL.createObjectURL(file);
      setImages(prev => [...prev, { file, preview }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];
    const urls: string[] = [];
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error("Not authenticated");
    
    for (const { file } of images) {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("manual-request-images").upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("manual-request-images").getPublicUrl(fileName);
      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  // Calculate price
  const calculatePrice = () => {
    if (!teamPricing) return 0;
    const basePrice = teamPricing.manualPrice || 0;
    if (basePrice > 0) return basePrice;
    // Fallback to type-based pricing
    return websiteType === "react" ? teamPricing.reactPrice : teamPricing.htmlPrice;
  };

  const price = calculatePrice();
  const allSiteNames = getAllSiteNames();
  const totalPrice = price * allSiteNames.length;
  const insufficientBalance = teamPricing 
    ? teamPricing.balance + teamPricing.creditLimit < totalPrice 
    : false;

  // Submit manual order
  const handleSubmit = async () => {
    if (isGenerationBlocked) {
      toast({ title: "🔧 Технічне обслуговування", description: "Замовлення тимчасово недоступне.", variant: "destructive" });
      return;
    }

    const names = getAllSiteNames();
    if (names.length === 0) {
      toast({ title: t("common.error"), description: t("genForm.enterSiteName"), variant: "destructive" });
      return;
    }
    if (!prompt.trim()) {
      toast({ title: t("common.error"), description: t("genForm.enterDescription"), variant: "destructive" });
      return;
    }
    if (!teamPricing) {
      toast({ title: t("common.error"), description: t("genForm.noTeam"), variant: "destructive" });
      return;
    }

    // Language validation
    if (isBilingualMode) {
      if (!bilingualLang1 || !bilingualLang2) {
        toast({ title: t("common.error"), description: "Оберіть обидві мови для двомовного сайту", variant: "destructive" });
        return;
      }
    } else {
      if (selectedLanguages.length === 0 && !customLanguage.trim()) {
        toast({ title: t("common.error"), description: t("genForm.selectLanguage"), variant: "destructive" });
        return;
      }
    }

    if (insufficientBalance) {
      toast({ title: t("common.error"), description: "Недостатній баланс", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);

    try {
      const imageUrls = await uploadImages();
      
      // Build language string
      let language: string;
      if (isBilingualMode) {
        language = `${bilingualLang1}+${bilingualLang2}`;
      } else if (selectedLanguages.length > 0) {
        language = selectedLanguages[0];
      } else {
        language = customLanguage.trim() || "uk";
      }

      const effectiveGeo = isOtherGeoSelected ? customGeo : selectedGeo;

      for (const siteName of names) {
        const { error } = await supabase.from("generation_history").insert({
          prompt: prompt.trim(),
          site_name: siteName,
          language,
          website_type: websiteType,
          ai_model: "senior",
          status: "manual_request",
          team_id: teamPricing.teamId,
          user_id: user?.id,
          image_source: "manual",
          admin_note: note || null,
          vip_images: imageUrls.length > 0 ? imageUrls : null,
          geo: effectiveGeo || null,
          sale_price: price,
        });

        if (error) throw error;
      }

      // Deduct balance
      if (totalPrice > 0) {
        const newBalance = teamPricing.balance - totalPrice;
        await supabase.from("teams").update({ balance: newBalance }).eq("id", teamPricing.teamId);
      }

      toast({
        title: "✅ Замовлення відправлено",
        description: `${names.length} сайт(ів) замовлено на суму $${totalPrice.toFixed(2)}`,
      });

      // Reset form
      setSiteNames([]);
      setCurrentSiteNameInput("");
      setPrompt("");
      setNote("");
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);

    } catch (error) {
      console.error("Manual order error:", error);
      toast({ title: t("common.error"), description: "Помилка замовлення", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // No team check for non-admins
  if (!isAdmin && !teamPricing && user) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">{t("genForm.noTeam")}</p>
        </CardContent>
      </Card>
    );
  }

  // Admin team selection
  if (isAdmin && !selectedAdminTeamId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Оберіть команду для замовлення</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {adminTeams.map(team => (
              <Button
                key={team.id}
                variant="outline"
                className="h-auto py-3 flex flex-col gap-1"
                onClick={() => setSelectedAdminTeamId(team.id)}
              >
                <span className="font-medium text-sm">{team.name}</span>
                <span className="text-xs text-muted-foreground">${team.balance.toFixed(2)}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {isGenerationBlocked && (
        <GenerationMaintenanceBanner message={generationMessage || maintenance.message || "Замовлення тимчасово недоступне"} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hand className="h-5 w-5 text-purple-500" />
            Замовити сайт вручну
            {teamPricing && (
              <Badge variant="outline" className="ml-auto font-normal">
                {teamPricing.teamName} · ${teamPricing.balance.toFixed(2)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Admin team switch */}
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedAdminTeamId("")}
              className="text-xs text-muted-foreground"
            >
              ← Змінити команду
            </Button>
          )}

          {/* Site names */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Назви сайтів <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Input
                value={currentSiteNameInput}
                onChange={e => setCurrentSiteNameInput(e.target.value)}
                onKeyDown={handleSiteNameKeyDown}
                placeholder="example.com"
                className="h-9 text-sm"
              />
              <Button variant="outline" size="sm" onClick={addSiteName} className="h-9 px-3">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {siteNames.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {siteNames.map((name, i) => (
                  <Badge key={i} variant="secondary" className="text-xs gap-1">
                    {name}
                    <button onClick={() => removeSiteName(i)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Description/Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Опис / ТЗ <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Опишіть сайт, який потрібно створити..."
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {/* Geo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Географія
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {selectedGeo && <GeoFlag value={selectedGeo} />}
                    {isOtherGeoSelected ? customGeo || "Своє значення" : 
                      selectedGeo ? getGeoText(geoOptions.find(g => g.value === selectedGeo)?.label || "") : "Оберіть країну"}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto">
                <Input
                  placeholder="Пошук..."
                  value={geoSearch}
                  onChange={e => setGeoSearch(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  className="h-8 text-xs mb-2"
                />
                {geoOptions
                  .filter(g => !geoSearch || g.label.toLowerCase().includes(geoSearch.toLowerCase()))
                  .map(geo => (
                    <button
                      key={geo.value}
                      className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent flex items-center gap-2 ${selectedGeo === geo.value && !isOtherGeoSelected ? "bg-accent" : ""}`}
                      onClick={() => {
                        setSelectedGeo(geo.value);
                        setIsOtherGeoSelected(false);
                        setGeoSearch("");
                      }}
                    >
                      {geo.value && <GeoFlag value={geo.value} />}
                      <span>{getGeoText(geo.label)}</span>
                    </button>
                  ))}
                <button
                  className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent ${isOtherGeoSelected ? "bg-accent" : ""}`}
                  onClick={() => {
                    setIsOtherGeoSelected(true);
                    setSelectedGeo("");
                  }}
                >
                  ✏️ Своє значення
                </button>
                {isOtherGeoSelected && (
                  <Input
                    value={customGeo}
                    onChange={e => setCustomGeo(e.target.value)}
                    placeholder="Введіть країну..."
                    className="h-8 text-xs mt-1"
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Website Type - React UNLOCKED */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Тип сайту</Label>
            <Select value={websiteType} onValueChange={v => setWebsiteType(v as typeof websiteType)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
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

          {/* Bilingual toggle */}
          <div className="flex items-center gap-3">
            <Button
              variant={isBilingualMode ? "default" : "outline"}
              size="sm"
              onClick={() => setIsBilingualMode(!isBilingualMode)}
              className={`h-7 text-xs px-2 ${isBilingualMode ? "bg-blue-500 hover:bg-blue-600" : ""}`}
            >
              <Languages className="mr-1 h-3 w-3" />
              Двомовний сайт
              {isBilingualMode && <span className="ml-1">✓</span>}
            </Button>
          </div>

          {/* Bilingual language selection */}
          {isBilingualMode ? (
            <div className="p-3 border border-blue-500/50 bg-blue-500/5 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Languages className="h-4 w-4" />
                <span className="text-sm font-medium">Оберіть дві мови</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Мова 1 <span className="text-destructive">*</span></Label>
                  <Select value={bilingualLang1} onValueChange={setBilingualLang1}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Оберіть мову" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.filter(l => l.value !== bilingualLang2).map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Мова 2 <span className="text-destructive">*</span></Label>
                  <Select value={bilingualLang2} onValueChange={setBilingualLang2}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Оберіть мову" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.filter(l => l.value !== bilingualLang1).map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            /* Single language selection */
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Мова сайту <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-between text-sm">
                    {selectedLanguages.length > 0 
                      ? languages.find(l => l.value === selectedLanguages[0])?.label || selectedLanguages[0]
                      : "Оберіть мову"}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto">
                  <Input
                    placeholder="Пошук..."
                    value={langSearch}
                    onChange={e => setLangSearch(e.target.value)}
                    onKeyDown={e => e.stopPropagation()}
                    className="h-8 text-xs mb-2"
                  />
                  {languages
                    .filter(l => !langSearch || l.label.toLowerCase().includes(langSearch.toLowerCase()))
                    .map(lang => (
                      <button
                        key={lang.value}
                        className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent ${selectedLanguages.includes(lang.value) ? "bg-accent" : ""}`}
                        onClick={() => {
                          setSelectedLanguages([lang.value]);
                          setLangSearch("");
                        }}
                      >
                        {lang.label}
                      </button>
                    ))}
                  <button
                    className={`w-full text-left px-2 py-1.5 text-sm rounded hover:bg-accent ${isOtherSelected ? "bg-accent" : ""}`}
                    onClick={() => setIsOtherSelected(true)}
                  >
                    ✏️ Своя мова
                  </button>
                  {isOtherSelected && (
                    <Input
                      value={customLanguage}
                      onChange={e => setCustomLanguage(e.target.value)}
                      placeholder="Введіть мову..."
                      className="h-8 text-xs mt-1"
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Примітка до замовлення</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Додаткові вимоги, побажання..."
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              Зображення ({images.length}/{MAX_IMAGES})
            </Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative w-16 h-16 group">
                  <img src={img.preview} alt="" className="w-full h-full object-cover rounded-lg border" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute -top-1 -right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                >
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Price & Submit */}
          <div className="flex items-center gap-3 pt-2 border-t">
            <Button
              onClick={handleSubmit}
              disabled={
                isGenerationBlocked ||
                allSiteNames.length === 0 ||
                !prompt.trim() ||
                (isBilingualMode ? (!bilingualLang1 || !bilingualLang2) : (selectedLanguages.length === 0 && !customLanguage.trim())) ||
                insufficientBalance ||
                isSubmitting ||
                (isAdmin && !selectedAdminTeamId)
              }
              className="h-10 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Замовлення...
                </>
              ) : (
                <>
                  <Hand className="mr-2 h-4 w-4" />
                  Замовити сайт
                  {allSiteNames.length > 1 && ` (${allSiteNames.length})`}
                  {teamPricing && (
                    <span className="ml-1 text-xs opacity-80">
                      ${totalPrice.toFixed(2)}
                    </span>
                  )}
                </>
              )}
            </Button>

            {insufficientBalance && (
              <span className="text-xs text-destructive">Недостатній баланс</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
