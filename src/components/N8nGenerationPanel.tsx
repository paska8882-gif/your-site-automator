import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Send, Bot, Sparkles, Globe, Wand2, Layers, Code2, FileCode, AlertTriangle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { N8nGenerationHistory } from "./N8nGenerationHistory";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Bot configurations
const N8N_BOTS = [
  {
    id: "2lang_html",
    nameKey: "n8n.htmlBotName",
    descKey: "n8n.htmlBotDesc",
    icon: FileCode,
    webhookUrl: "https://n8n.dragonwhite-n8n.top/webhook/lovable-generate",
    defaultLanguages: ["fr", "en"],
    outputType: "html",
  },
  {
    id: "nextjs_bot",
    nameKey: "n8n.nextjsBotName",
    descKey: "n8n.nextjsBotDesc",
    icon: Code2,
    webhookUrl: "https://n8n.dragonwhite-n8n.top/webhook/d26af941-69aa-4b93-82f8-fd5cd1d1c5ea",
    defaultLanguages: ["en"],
    outputType: "nextjs",
  },
] as const;

type BotId = typeof N8N_BOTS[number]["id"];

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
  { value: "be", label: "🇧🇪 Бельгія", geoName: "Belgium" },
  { value: "nl", label: "🇳🇱 Нідерланди", geoName: "Netherlands" },
  { value: "de", label: "🇩🇪 Німеччина", geoName: "Germany" },
  { value: "fr", label: "🇫🇷 Франція", geoName: "France" },
  { value: "uk", label: "🇬🇧 Великобританія", geoName: "UK" },
  { value: "us", label: "🇺🇸 США", geoName: "USA" },
  { value: "pl", label: "🇵🇱 Польща", geoName: "Poland" },
  { value: "it", label: "🇮🇹 Італія", geoName: "Italy" },
  { value: "es", label: "🇪🇸 Іспанія", geoName: "Spain" },
];

// Topic categories (same as in WebsiteGenerator)
const TOPIC_CATEGORIES: Record<string, string[]> = {
  "💰 Фінанси (Освіта)": ["Ведення бюджету", "Інвестування", "Робота з криптовалютами", "Фінансова грамотність", "Побудова бізнесу", "Краудфандинг", "Фінансовий аналітик", "Трейдинг", "Машинне навчання у фінансах"],
  "❤️ Здоров'я (Освіта)": ["Здоровий спосіб життя", "Правильне харчування", "Гімнастика", "Йога", "Вегетаріанство", "Кросфіт"],
  "💄 Краса (Освіта)": ["Манікюр", "Візажист", "Стиліст", "Перукар"],
  "🌍 Вивчення мов": ["Англійська мова", "Польська мова", "Німецька мова", "Іспанська мова", "Французька мова", "Італійська мова", "Португальська мова", "Арабська мова", "Японська мова"],
  "🧠 Саморозвиток": ["Підвищення мотивації", "Медитація", "Особистісний ріст", "Психологія", "Коучинг", "Сімейні відносини", "Вивчення релігій", "Побудова командної роботи", "Астрологія", "Дейтинг", "Креативність"],
  "📈 Кар'єрний ріст": ["Туроператор", "Маркетолог", "Дизайнер", "Менеджмент", "Журналістика", "Флорист", "Організатор свят", "Акторська майстерність", "Кіберспорт", "Туристичний гід", "Торгівля на маркетплейсах", "Еколог", "Юрист", "Ріелтор", "Соціальний працівник", "Стрімінг", "Нафта", "Газ", "Енергетика"],
  "🎨 Творчість": ["Письменництво", "Кулінарія", "Малювання", "Фотограф", "Музика", "Танці"],
  "💻 IT (Освіта)": ["Розробка мобільних ігор", "Програмування", "Відеомонтаж", "Основи блокчейну", "Веб-дизайн", "Системний адміністратор", "SEO-спеціаліст", "Розробник AR/VR ігор", "3D-дизайн для ігор", "ШІ (штучний інтелект)", "Кібербезпека"],
  "🏦 Фінанси (Послуги)": ["Побудова бізнесу", "Управління бюджетом", "Фінансове консультування", "Фінансова підтримка", "Бухгалтерський облік", "Фінансовий аудит", "Автоматизація фінансових процесів", "ШІ-рішення для управління фінансами"],
  "🩺 Здоров'я (Послуги)": ["Йога", "Гімнастика", "Кросфіт", "Нутриціологія", "Здоров'я людей похилого віку", "Масаж та релаксація", "Антистрес-терапія"],
  "🧘 Саморозвиток (Послуги)": ["Лайф-коучинг", "Психологія", "Сімейне консультування", "Медитація", "Розвиток лідерства"],
  "💅 Краса (Послуги)": ["Манікюр", "Візажист", "Стиліст", "Перукар"],
  "👔 Професійні послуги": ["Туроператор", "Цифровий маркетинг", "Графічний дизайн", "Проектне управління", "Журналістика", "Флористика", "Івент-менеджмент", "Актор", "Торгівля на маркетплейсах", "Екологічне консультування", "Соціальна робота", "Перекладач", "Таргетована реклама", "Контент-менеджмент"],
  "🎭 Креативність (Послуги)": ["Копірайтер", "Кулінар", "Художник", "Фотограф", "Музикант"],
  "🖥️ IT (Послуги)": ["Розробка мобільних додатків", "Програмування", "Відеомонтаж", "Веб-дизайн", "SEO", "Системне адміністрування", "AR/VR розробка", "3D-дизайн", "ШІ (штучний інтелект)", "Кібербезпека", "Розробка ігор", "Тестування ПЗ", "Блокчейн-розробка", "Розробка чат-ботів", "Управління базами даних"]
};

const SITE_TYPES: { key: string; uk: string; ru: string; en: string }[] = [
  { key: "blog", uk: "Блог", ru: "Блог", en: "Blog" },
  { key: "portfolio", uk: "Портфоліо", ru: "Портфолио", en: "Portfolio" },
  { key: "landing", uk: "Лендінг", ru: "Лендинг", en: "Landing Page" },
  { key: "corporate", uk: "Корпоративний сайт", ru: "Корпоративный сайт", en: "Corporate Website" },
  { key: "ecommerce", uk: "Інтернет-магазин", ru: "Интернет-магазин", en: "E-commerce" },
  { key: "saas", uk: "SaaS-платформа", ru: "SaaS-платформа", en: "SaaS Platform" },
  { key: "education", uk: "Освітня платформа", ru: "Образовательная платформа", en: "Educational Platform" },
  { key: "news", uk: "Новини / Журнал", ru: "Новости / Журнал", en: "News / Magazine" },
  { key: "community", uk: "Спільнота / Форум", ru: "Сообщество / Форум", en: "Community / Forum" },
  { key: "personal", uk: "Персональний сайт", ru: "Персональный сайт", en: "Personal Website" },
  { key: "agency", uk: "Сайт агенції", ru: "Сайт агентства", en: "Agency Website" },
  { key: "nonprofit", uk: "Благодійність", ru: "Благотворительность", en: "Nonprofit / Charity" },
  { key: "event", uk: "Подія / Конференція", ru: "Событие / Конференция", en: "Event / Conference" },
  { key: "realestate", uk: "Нерухомість", ru: "Недвижимость", en: "Real Estate" },
  { key: "healthcare", uk: "Медицина / Здоров'я", ru: "Медицина / Здоровье", en: "Healthcare / Medical" },
  { key: "restaurant", uk: "Ресторан / Їжа", ru: "Ресторан / Еда", en: "Restaurant / Food" },
  { key: "travel", uk: "Подорожі / Туризм", ru: "Путешествия / Туризм", en: "Travel / Tourism" },
  { key: "fitness", uk: "Фітнес / Велнес", ru: "Фитнес / Велнес", en: "Fitness / Wellness" },
  { key: "legal", uk: "Юридичні послуги", ru: "Юридические услуги", en: "Legal / Law Firm" },
  { key: "finance", uk: "Фінанси / Фінтех", ru: "Финансы / Финтех", en: "Finance / Fintech" },
  { key: "entertainment", uk: "Розваги", ru: "Развлечения", en: "Entertainment" },
  { key: "tech", uk: "Технології / Стартап", ru: "Технологии / Стартап", en: "Technology / Startup" },
  { key: "government", uk: "Державний / Публічний", ru: "Государственный / Публичный", en: "Government / Public" },
  { key: "directory", uk: "Каталог / Лістинг", ru: "Каталог / Листинг", en: "Directory / Listing" },
  { key: "wiki", uk: "Вікі / База знань", ru: "Вики / База знаний", en: "Wiki / Knowledge Base" },
];

export function N8nGenerationPanel() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const { t } = useLanguage();
  
  // Selected bot
  const [selectedBot, setSelectedBot] = useState<BotId>("2lang_html");
  
  // Prompt mode: manual or theme-based
  const [promptMode, setPromptMode] = useState<"manual" | "theme">("manual");
  
  // Form state
  const [prompt, setPrompt] = useState("");
  const [domain, setDomain] = useState("");
  const [geo, setGeo] = useState("be");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["fr", "en"]);
  const [keywords, setKeywords] = useState("");
  const [forbiddenWords, setForbiddenWords] = useState("");
  
  // Next.js bot specific fields
  const [siteName, setSiteName] = useState("");
  const [siteTopic, setSiteTopic] = useState("");
  const [siteType, setSiteType] = useState("");
  const [siteDescription, setSiteDescription] = useState("");
  
  // Theme selection state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  
  // Quantity state
  const [siteCount, setSiteCount] = useState(1);
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState({ current: 0, total: 0 });
  const [historyKey, setHistoryKey] = useState(0);

  // Team pricing state
  const [teamPricing, setTeamPricing] = useState<{
    teamId: string;
    teamName: string;
    balance: number;
    creditLimit: number;
    externalPrice: number;
  } | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);

  // Load team pricing for the current user
  useEffect(() => {
    const fetchTeamPricing = async () => {
      if (!user) { setTeamLoading(false); return; }
      
      // Admins in admin panel don't need team binding (legacy behavior)
      // But on the standalone page they do need it
      
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .limit(1)
        .maybeSingle();

      if (!membership) { setTeamLoading(false); return; }

      const { data: team } = await supabase
        .from("teams")
        .select("id, name, balance, credit_limit")
        .eq("id", membership.team_id)
        .maybeSingle();

      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("external_price")
        .eq("team_id", membership.team_id)
        .maybeSingle();

      if (team) {
        setTeamPricing({
          teamId: team.id,
          teamName: team.name,
          balance: team.balance || 0,
          creditLimit: team.credit_limit || 0,
          externalPrice: pricing?.external_price || 7,
        });
      }
      setTeamLoading(false);
    };

    fetchTeamPricing();

    // Subscribe to team balance changes
    const channel = supabase
      .channel("n8n_team_balance")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teams" }, (payload) => {
        if (teamPricing && payload.new.id === teamPricing.teamId) {
          setTeamPricing(prev => prev ? {
            ...prev,
            balance: payload.new.balance,
            creditLimit: payload.new.credit_limit ?? prev.creditLimit,
          } : null);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Fixed prices per bot type
  const getBotPrice = (): number => {
    return selectedBot === "nextjs_bot" ? 8 : 9;
  };

  // Cost calculation
  const calculateTotalCost = () => {
    return getBotPrice() * siteCount;
  };

  const insufficientBalance = teamPricing
    ? (teamPricing.balance - calculateTotalCost()) < -(teamPricing.creditLimit)
    : false;

  // Get current bot config
  const currentBot = N8N_BOTS.find(b => b.id === selectedBot) || N8N_BOTS[0];

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages(prev => 
      prev.includes(lang) 
        ? prev.filter(l => l !== lang)
        : [...prev, lang]
    );
  };

  const buildFullPrompt = () => {
    // Next.js bot: structured format matching n8n expectations
    if (selectedBot === "nextjs_bot") {
      let result = "";
      if (domain) result += `Domain: ${domain}\n\n`;
      if (siteName) result += `Name: ${siteName}\n\n`;
      
      const geoOption = geoOptions.find(g => g.value === geo);
      result += `Geo: ${geoOption?.geoName || geo}\n\n`;
      
      const langLabel = languages.find(l => l.value === selectedLanguages[0])?.label?.replace(/^..\s/, "") || selectedLanguages[0];
      result += `Language: ${langLabel}\n\n`;
      
      if (siteTopic) result += `Topic: ${siteTopic}\n\n`;
      if (siteType) {
        const typeObj = SITE_TYPES.find(st => st.key === siteType);
        result += `Type: ${typeObj?.en || siteType}\n\n`;
      }
      if (siteDescription.trim()) result += `Description:\n\n${siteDescription}\n\n`;
      if (keywords.trim()) result += `Keywords:\n\n${keywords}\n\n`;
      if (forbiddenWords.trim()) result += `Banned words:\n\n${forbiddenWords}\n`;
      
      return result;
    }

    // HTML bot: original format
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

  // Generate a single site with unique prompt
  const generateSingleSite = async (index: number, session: any): Promise<boolean> => {
    try {
      let finalPrompt: string;
      let generatedSiteName: string;
      let themeGeneratedPrompt: string | null = null;

      if (promptMode === "theme" && selectedTopic) {
        // Generate unique prompt from theme using edge function
        const geoName = geoOptions.find(g => g.value === geo)?.geoName || "USA";
        
        const { data, error } = await supabase.functions.invoke('generate-theme-prompt', {
          body: { 
            topic: selectedTopic,
            geo: geoName,
            language: selectedLanguages[0] || "en",
            batchIndex: siteCount > 1 ? index + 1 : undefined,
            batchTotal: siteCount > 1 ? siteCount : undefined,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;
        
        if (data.generatedPrompt) {
          themeGeneratedPrompt = data.generatedPrompt;
          finalPrompt = `[Тема: ${selectedTopic}]\n\n${themeGeneratedPrompt}`;
          
          const baseName = domain 
            ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
            : selectedTopic.slice(0, 40);
          generatedSiteName = siteCount > 1 ? `${baseName} (${index + 1})` : baseName;
        } else {
          throw new Error("Не вдалось згенерувати промпт");
        }
      } else {
        // Manual mode
        const basePrompt = buildFullPrompt();
        finalPrompt = siteCount > 1 
          ? `${basePrompt}\n\n[Варіація ${index + 1} з ${siteCount} - зроби унікальний дизайн та контент]`
          : basePrompt;
        
        const baseName = selectedBot === "nextjs_bot"
          ? (siteName || domain || prompt.slice(0, 40))
          : (domain 
            ? domain.replace(/^https?:\/\//, "").replace(/\/$/, "")
            : prompt.slice(0, 40));
        generatedSiteName = siteCount > 1 ? `${baseName} (${index + 1})` : baseName;
      }

      // Calculate sale price per site
      const salePrice = getBotPrice();

      // Create generation history record
      const { data: historyData, error: historyError } = await supabase
        .from("generation_history")
        .insert({
          user_id: user!.id,
          prompt: selectedBot === "nextjs_bot" 
            ? finalPrompt 
            : (promptMode === "theme" ? `Тематика: ${selectedTopic}` : prompt.slice(0, 200)),
          improved_prompt: themeGeneratedPrompt,
          language: selectedLanguages.join(", "),
          site_name: generatedSiteName,
          geo: geo.toUpperCase(),
          status: "pending",
          ai_model: "senior",
          website_type: currentBot.outputType,
          image_source: selectedBot === "nextjs_bot" ? "nextjs" : `n8n-bot-${currentBot.id}`,
          team_id: teamPricing?.teamId || null,
          sale_price: teamPricing ? salePrice : null,
        })
        .select("id")
        .single();

      if (historyError) throw historyError;

      // Deduct balance from team
      if (teamPricing) {
        const newBalance = teamPricing.balance - salePrice;
        await supabase
          .from("teams")
          .update({ balance: newBalance })
          .eq("id", teamPricing.teamId);
        
        setTeamPricing(prev => prev ? { ...prev, balance: newBalance } : null);
      }

      // Call n8n-async-proxy
      const response = await supabase.functions.invoke("n8n-async-proxy", {
        body: { 
          historyId: historyData.id,
          fullPrompt: finalPrompt,
          botId: selectedBot,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      console.log(`📤 n8n request ${index + 1}/${siteCount} sent:`, response.data);
      return true;
    } catch (error: any) {
      console.error(`Error generating site ${index + 1}:`, error);
      toast.error(`Помилка генерації ${index + 1}`, {
        description: error.message,
      });
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error(t("n8n.authRequired"));
      return;
    }

    // Validation based on bot and mode
    if (selectedBot === "nextjs_bot") {
      if (!domain.trim() || !siteName.trim() || !siteTopic.trim() || !siteDescription.trim()) {
        toast.error(t("n8n.fillRequired"));
        return;
      }
    } else if (promptMode === "manual") {
      if (!prompt.trim()) {
        toast.error(t("n8n.enterSiteTopic"));
        return;
      }
    } else {
      if (!selectedTopic) {
        toast.error(t("n8n.selectTopicRequired"));
        return;
      }
    }

    if (selectedLanguages.length === 0) {
      toast.error(t("n8n.selectLanguage"));
      return;
    }

    // Balance check (skip for admins without team)
    if (teamPricing && insufficientBalance) {
      const totalCost = calculateTotalCost();
      toast.error(t("n8n.insufficientBalance"), {
        description: `${t("n8n.total")}: $${totalCost.toFixed(2)}, ${t("sidebar.balance")}: $${teamPricing.balance.toFixed(2)}, Limit: $${teamPricing.creditLimit.toFixed(2)}`,
      });
      return;
    }

    if (!isAdmin && !teamPricing) {
      toast.error(t("n8n.noTeamError"));
      return;
    }

    setIsSubmitting(true);
    setSubmissionProgress({ current: 0, total: siteCount });

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        toast.error(t("n8n.sessionExpired"));
        setIsSubmitting(false);
        return;
      }

      let successCount = 0;

      // Generate sites sequentially with unique prompts
      for (let i = 0; i < siteCount; i++) {
        setSubmissionProgress({ current: i + 1, total: siteCount });
        
        const success = await generateSingleSite(i, session.session);
        if (success) {
          successCount++;
        }
        
        // Trigger history refresh after each successful generation
        setHistoryKey(prev => prev + 1);
        
        // Small delay between requests to avoid rate limiting
        if (i < siteCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      if (successCount === siteCount) {
        toast.success(`🚀 ${siteCount > 1 ? `${siteCount} ${t("n8n.requestsSent")}` : t("n8n.requestSent")}`, {
          description: promptMode === "theme" 
            ? `${t("n8n.aiGeneratedDesc")} "${selectedTopic}".`
            : t("n8n.addedToHistory"),
        });
      } else if (successCount > 0) {
        toast.warning(t("n8n.partiallySent"), {
          description: `${successCount} / ${siteCount}`,
        });
      }

      // Reset form for next generation
      setPrompt("");
      setDomain("");
      setKeywords("");
      setForbiddenWords("");
      setSelectedCategory("");
      setSelectedTopic("");
      setSiteCount(1);
      setSiteName("");
      setSiteTopic("");
      setSiteType("");
      setSiteDescription("");

    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(t("n8n.sendError"), {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
      setSubmissionProgress({ current: 0, total: 0 });
    }
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setSelectedTopic(""); // Reset topic when category changes
  };

  // Handle bot change - reset languages to bot defaults
  const handleBotChange = (botId: BotId) => {
    setSelectedBot(botId);
    const bot = N8N_BOTS.find(b => b.id === botId);
    if (bot) {
      setSelectedLanguages(bot.defaultLanguages as unknown as string[]);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            {t("n8n.title")}
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </CardTitle>
          <CardDescription>
            {t("n8n.description")}
          </CardDescription>
          {/* Balance info */}
          {teamPricing && (
            <div className="flex items-center gap-3 mt-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                {teamPricing.teamName}: ${teamPricing.balance.toFixed(2)}
              </Badge>
              <Badge variant="outline" className="text-muted-foreground">
                {t("n8n.price")}: ${getBotPrice()}{t("n8n.perSite")}
              </Badge>
              {siteCount > 1 && (
                <Badge variant="secondary">
                  {t("n8n.total")}: ${calculateTotalCost().toFixed(2)}
                </Badge>
              )}
              {insufficientBalance && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {t("n8n.insufficientFunds")}
                </Badge>
              )}
            </div>
          )}
          {!teamPricing && !teamLoading && !isAdmin && (
            <Alert variant="destructive" className="mt-2">
               <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t("n8n.noTeam")}</AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {/* Bot Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t("n8n.selectBot")}</Label>
            <Tabs value={selectedBot} onValueChange={(v) => handleBotChange(v as BotId)} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${N8N_BOTS.length}, 1fr)` }}>
                {N8N_BOTS.map((bot) => {
                  const Icon = bot.icon;
                  return (
                    <TabsTrigger key={bot.id} value={bot.id} className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{t(bot.nameKey)}</span>
                      <span className="sm:hidden">{t(bot.nameKey).split(" ")[0]}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {t(currentBot.descKey)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {t("n8n.generationParams")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedBot === "nextjs_bot" ? (
            /* ===== NEXT.JS BOT FORM ===== */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left column */}
              <div className="space-y-4">
                {/* Domain */}
                <div className="space-y-2">
                  <Label htmlFor="nx-domain">{t("n8n.nxDomain")} *</Label>
                  <Input
                    id="nx-domain"
                    placeholder={t("n8n.nxDomainPlaceholder")}
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="nx-name">{t("n8n.nxName")} *</Label>
                  <Input
                    id="nx-name"
                    placeholder={t("n8n.nxNamePlaceholder")}
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Geo */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    {t("n8n.nxGeo")}
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

                {/* Language (single select for Next.js) */}
                <div className="space-y-2">
                  <Label>{t("n8n.nxLanguage")}</Label>
                  <Select 
                    value={selectedLanguages[0] || "en"} 
                    onValueChange={(v) => setSelectedLanguages([v])} 
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Topic */}
                <div className="space-y-2">
                  <Label htmlFor="nx-topic">{t("n8n.nxTopic")} *</Label>
                  <Input
                    id="nx-topic"
                    placeholder={t("n8n.nxTopicPlaceholder")}
                    value={siteTopic}
                    onChange={(e) => setSiteTopic(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Type */}
                <div className="space-y-2">
                  <Label>{t("n8n.nxType")}</Label>
                  <Select value={siteType} onValueChange={setSiteType} disabled={isSubmitting}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("n8n.nxTypePlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {SITE_TYPES.map(type => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="nx-description">{t("n8n.nxDescription")} *</Label>
                  <Textarea
                    id="nx-description"
                    placeholder={t("n8n.nxDescriptionPlaceholder")}
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    disabled={isSubmitting}
                    className="min-h-[120px]"
                  />
                </div>

                {/* Keywords */}
                <div className="space-y-2">
                  <Label htmlFor="nx-keywords">{t("n8n.nxKeywords")}</Label>
                  <Textarea
                    id="nx-keywords"
                    placeholder={t("n8n.nxKeywordsPlaceholder")}
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    disabled={isSubmitting}
                    className="min-h-[80px]"
                  />
                </div>

                {/* Banned words */}
                <div className="space-y-2">
                  <Label htmlFor="nx-banned">{t("n8n.nxBannedWords")}</Label>
                  <Textarea
                    id="nx-banned"
                    placeholder={t("n8n.nxBannedPlaceholder")}
                    value={forbiddenWords}
                    onChange={(e) => setForbiddenWords(e.target.value)}
                    disabled={isSubmitting}
                    className="min-h-[80px]"
                  />
                </div>

                {/* Site count */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                   <Layers className="h-4 w-4" />
                   {t("n8n.siteCount")}
                  </Label>
                  <Select 
                    value={siteCount.toString()} 
                    onValueChange={(v) => setSiteCount(parseInt(v))} 
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? t("n8n.site1") : n < 5 ? t("n8n.sites2to4") : t("n8n.sites5plus")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || insufficientBalance || (!isAdmin && !teamPricing) || !domain.trim() || !siteName.trim() || !siteTopic.trim() || !siteDescription.trim()}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {submissionProgress.total > 1 
                        ? `${t("n8n.submitting")} ${submissionProgress.current}/${submissionProgress.total}`
                        : t("n8n.submitting")}
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      {siteCount > 1 
                        ? `${t("n8n.submit")} (${siteCount}) — $${calculateTotalCost()}`
                        : `${t("n8n.submit")} — $${getBotPrice()}`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            /* ===== HTML BOT FORM (original) ===== */
            <>
          {/* Prompt Mode Selector */}
          <div className="mb-6">
            <Label className="mb-3 block">{t("n8n.promptMode")}</Label>
            <RadioGroup 
              value={promptMode} 
              onValueChange={(v) => setPromptMode(v as "manual" | "theme")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="manual" id="manual" />
                <Label htmlFor="manual" className="cursor-pointer">{t("n8n.manualMode")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="theme" id="theme" />
                <Label htmlFor="theme" className="cursor-pointer flex items-center gap-1">
                  <Wand2 className="h-4 w-4" />
                  {t("n8n.themeMode")}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="space-y-4">
              {promptMode === "manual" ? (
                <div className="space-y-2">
                  <Label htmlFor="prompt">{t("n8n.siteTopic")} *</Label>
                  <Textarea
                    id="prompt"
                    placeholder="Digital Wayfinding & Spatial Orientation"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isSubmitting}
                    className="min-h-[80px]"
                  />
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>{t("n8n.category")} *</Label>
                    <Select 
                      value={selectedCategory} 
                      onValueChange={handleCategoryChange}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("n8n.selectCategory")} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(TOPIC_CATEGORIES).map((category) => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t("n8n.topic")} *</Label>
                    <Select 
                      value={selectedTopic} 
                      onValueChange={setSelectedTopic}
                      disabled={isSubmitting || !selectedCategory}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedCategory ? t("n8n.selectTopic") : t("n8n.selectCategoryFirst")} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCategory && TOPIC_CATEGORIES[selectedCategory]?.map((topic) => (
                          <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedTopic && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        <Wand2 className="h-4 w-4 inline mr-1" />
                        {t("n8n.aiAutoGenerate")} <strong>{selectedTopic}</strong>
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Domain */}
              <div className="space-y-2">
                <Label htmlFor="domain">{t("n8n.domainOptional")}</Label>
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
                  {t("n8n.geography")}
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
                <Label>{t("n8n.siteLanguages")}</Label>
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
              {/* Site count selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                   <Layers className="h-4 w-4" />
                  {t("n8n.siteCount")}
                </Label>
                <Select 
                  value={siteCount.toString()} 
                  onValueChange={(v) => setSiteCount(parseInt(v))} 
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {n === 1 ? t("n8n.site1") : n < 5 ? t("n8n.sites2to4") : t("n8n.sites5plus")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {siteCount > 1 && (
                  <p className="text-xs text-muted-foreground">
                    {t("n8n.uniquePromptNote")}
                  </p>
                )}
              </div>

              {/* Keywords */}
              <div className="space-y-2">
                <Label htmlFor="keywords">{t("n8n.keywords")}</Label>
                <Textarea
                  id="keywords"
                  placeholder="keyword1, keyword2, keyword3..."
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[80px]"
                />
              </div>

              {/* Forbidden words */}
              <div className="space-y-2">
                <Label htmlFor="forbidden">{t("n8n.forbiddenWords")}</Label>
                <Textarea
                  id="forbidden"
                  placeholder="crypto, bitcoin, casino..."
                  value={forbiddenWords}
                  onChange={(e) => setForbiddenWords(e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[80px]"
                />
              </div>

              {/* Submit button */}
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || insufficientBalance || (!isAdmin && !teamPricing) || (promptMode === "manual" ? !prompt.trim() : !selectedTopic)}
                className="w-full"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {submissionProgress.total > 1 
                      ? `${t("n8n.submitting")} ${submissionProgress.current}/${submissionProgress.total}`
                      : promptMode === "theme" ? t("n8n.generatingDescription") : t("n8n.submitting")}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    {siteCount > 1 
                      ? `${t("n8n.submit")} (${siteCount}) — $${calculateTotalCost()}`
                      : `${t("n8n.submit")} — $${getBotPrice()}`}
                  </>
                )}
              </Button>
            </div>
          </div>
          </>
          )}
        </CardContent>
      </Card>

      {/* History Section */}
      <N8nGenerationHistory key={historyKey} />
    </div>
  );
}
