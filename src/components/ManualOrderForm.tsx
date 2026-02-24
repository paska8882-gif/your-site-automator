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
  FileCode2, Loader2, Upload, Image as ImageIcon, Hand, ChevronDown, Shuffle,
  Building2, Phone, Tag, Hash
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useTeamOwner } from "@/hooks/useTeamOwner";
import { useAdminMode } from "@/contexts/AdminModeContext";
import { useLanguage } from "@/contexts/LanguageContext";
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

const getGeoOptions = (t: (key: string) => string) => [
  { value: "", label: "🌍 " + t("manualOrderForm.geoNotSelected") },
  { value: "uk", label: "🇬🇧 " + t("manualOrderForm.geoUK") },
  { value: "bg", label: "🇧🇬 " + t("manualOrderForm.geoBG") },
  { value: "be", label: "🇧🇪 " + t("manualOrderForm.geoBE") },
  { value: "vn", label: "🇻🇳 " + t("manualOrderForm.geoVN") },
  { value: "gr", label: "🇬🇷 " + t("manualOrderForm.geoGR") },
  { value: "dk", label: "🇩🇰 " + t("manualOrderForm.geoDK") },
  { value: "ee", label: "🇪🇪 " + t("manualOrderForm.geoEE") },
  { value: "id", label: "🇮🇩 " + t("manualOrderForm.geoID") },
  { value: "in", label: "🇮🇳 " + t("manualOrderForm.geoIN") },
  { value: "ie", label: "🇮🇪 " + t("manualOrderForm.geoIE") },
  { value: "es", label: "🇪🇸 " + t("manualOrderForm.geoES") },
  { value: "it", label: "🇮🇹 " + t("manualOrderForm.geoIT") },
  { value: "ca", label: "🇨🇦 " + t("manualOrderForm.geoCA") },
  { value: "lv", label: "🇱🇻 " + t("manualOrderForm.geoLV") },
  { value: "lt", label: "🇱🇹 " + t("manualOrderForm.geoLT") },
  { value: "nl", label: "🇳🇱 " + t("manualOrderForm.geoNL") },
  { value: "de", label: "🇩🇪 " + t("manualOrderForm.geoDE") },
  { value: "ae", label: "🇦🇪 " + t("manualOrderForm.geoAE") },
  { value: "pl", label: "🇵🇱 " + t("manualOrderForm.geoPL") },
  { value: "pt", label: "🇵🇹 " + t("manualOrderForm.geoPT") },
  { value: "ru", label: "🇷🇺 " + t("manualOrderForm.geoRU") },
  { value: "ro", label: "🇷🇴 " + t("manualOrderForm.geoRO") },
  { value: "sk", label: "🇸🇰 " + t("manualOrderForm.geoSK") },
  { value: "si", label: "🇸🇮 " + t("manualOrderForm.geoSI") },
  { value: "us", label: "🇺🇸 " + t("manualOrderForm.geoUS") },
  { value: "th", label: "🇹🇭 " + t("manualOrderForm.geoTH") },
  { value: "tr", label: "🇹🇷 " + t("manualOrderForm.geoTR") },
  { value: "ua", label: "🇺🇦 " + t("manualOrderForm.geoUA") },
  { value: "hu", label: "🇭🇺 " + t("manualOrderForm.geoHU") },
  { value: "fi", label: "🇫🇮 " + t("manualOrderForm.geoFI") },
  { value: "fr", label: "🇫🇷 " + t("manualOrderForm.geoFR") },
  { value: "hr", label: "🇭🇷 " + t("manualOrderForm.geoHR") },
  { value: "cz", label: "🇨🇿 " + t("manualOrderForm.geoCZ") },
  { value: "se", label: "🇸🇪 " + t("manualOrderForm.geoSE") },
  { value: "kz", label: "🇰🇿 " + t("manualOrderForm.geoKZ") },
  { value: "jp", label: "🇯🇵 " + t("manualOrderForm.geoJP") },
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

const randomVipTopics = [
  "🎮 Video Games", "⚖️ Law Services", "🦷 Dental Care", "🏠 Real Estate",
  "🐕 Pet Grooming", "🔧 Auto Repair", "💪 Fitness Training", "📷 Photography",
  "🏗️ Home Renovation", "📊 Accounting", "✈️ Travel Agency", "☕ Coffee Shop",
  "🥐 Bakery", "💐 Flower Delivery", "💻 IT Consulting", "💒 Wedding Planning",
  "🍽️ Restaurant", "💆 Spa & Wellness", "🔩 Plumbing Services", "🛡️ Insurance Agency",
  "💇 Hair Salon", "🧘 Yoga Studio", "🚗 Car Dealership", "🧹 Cleaning Services",
];

// Realistic business name prefixes by geo
const realisticBusinessNames: Record<string, Record<string, string[]>> = {
  "us": {
    "Dental Care": ["Bright Smile Dentistry", "Pacific Dental Group", "Summit Oral Health", "Evergreen Family Dentistry", "Lakewood Dental Studio"],
    "Law Services": ["Mitchell & Partners Law", "Sterling Legal Associates", "Beacon Law Group", "Heritage Legal Advisors", "Pinnacle Justice Firm"],
    "Real Estate": ["Skyline Realty Group", "Cornerstone Properties", "BluePeak Real Estate", "Oakwood Home Advisors", "Meridian Property Solutions"],
    "Auto Repair": ["AutoCare Plus", "Precision Motor Works", "Summit Auto Service", "Eagle Eye Mechanics", "TrueGrip Auto Repair"],
    "Fitness Training": ["CoreFit Athletics", "Elevate Fitness Studio", "Peak Performance Gym", "Ironclad Training", "VitalMove Fitness"],
    "Restaurant": ["The Golden Fork", "Harborview Kitchen", "Ember & Oak Bistro", "Riverstone Grill", "Savory Table Restaurant"],
    "Hair Salon": ["Luxe Locks Studio", "The Style Lounge", "Velvet Touch Salon", "Bliss Hair Studio", "Radiant Beauty Bar"],
    "Cleaning Services": ["SparkClean Pro", "FreshStart Cleaning Co", "PureShine Services", "CrystalClear Cleaning", "TidyHome Solutions"],
    "default": ["Apex Solutions", "Summit Services Group", "Evergreen Enterprises", "Pinnacle Partners", "BlueStar Consulting"],
  },
  "uk": {
    "Dental Care": ["Harley Street Dental", "Royal Smile Clinic", "Thames Dental Practice", "Kensington Oral Care", "Crown Dental Studio"],
    "Law Services": ["Whitmore & Reed Solicitors", "Chambers Legal LLP", "Rothwell Law Associates", "Sterling Barristers", "Graystone Legal"],
    "Real Estate": ["Knight & Willow Estates", "Mayfair Property Group", "Crossland Lettings", "Albion Homes", "Sovereign Realty"],
    "default": ["Albion Group", "Meridian Partners", "Claremont Services", "Whitehall Solutions", "Lancaster Enterprises"],
  },
  "de": {
    "Dental Care": ["Zahnarztpraxis Sonnenberg", "Dental Studio München", "Praxis Dr. Weber", "Zahnklinik am Park", "Berliner Zahnzentrum"],
    "Law Services": ["Kanzlei Richter & Partner", "Rechtsanwälte Bergmann", "Anwaltskanzlei Weber", "Schröder Legal", "Bauer & Koch Recht"],
    "default": ["Schmidt & Partner", "Rheinland Solutions", "Nordwerk GmbH", "Alpina Consulting", "Westfalen Services"],
  },
  "fr": {
    "Dental Care": ["Cabinet Dentaire Lumière", "Clinique du Sourire", "Centre Dental Parisien", "Smile Studio Paris", "Dentiste Saint-Germain"],
    "default": ["Lumière Conseil", "Atelier Parisien", "Loire Solutions", "Provence Services", "Riviera Group"],
  },
  "es": {
    "default": ["Sol y Mar Servicios", "Iberia Consulting", "Costa Solutions", "Meridian Ibérica", "Alhambra Group"],
  },
  "it": {
    "default": ["Studio Milano", "Roma Servizi", "Bella Vista Consulting", "Firenze Solutions", "Adriatica Group"],
  },
  "pl": {
    "default": ["Kraków Solutions", "Warszawa Consulting", "Gdańsk Services", "Polska Group", "Wawel Partners"],
  },
  "ua": {
    "default": ["Київ Сервіс", "Дніпро Консалтинг", "Одеса Партнерс", "Львів Рішення", "Карпати Груп"],
  },
  "nl": {
    "default": ["Amsterdam Partners", "Tulip Consulting", "Oranje Solutions", "Windmill Services", "Dutch Bridge Group"],
  },
  "ro": {
    "default": ["Carpat Solutions", "Dunărea Consulting", "București Partners", "Transylvania Group", "Moldova Services"],
  },
  "default": {
    "default": ["Global Solutions", "Premier Services", "Apex Consulting", "Horizon Partners", "Summit Enterprises"],
  },
};

function getRealisticBusinessName(geo: string, topic: string): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const geoNames = realisticBusinessNames[geo] || realisticBusinessNames["default"];
  const topicNames = geoNames[topic] || geoNames["default"] || realisticBusinessNames["default"]["default"];
  return pick(topicNames);
}

const randomVipAddressesByGeo: Record<string, string[]> = {
  "us": ["123 Main St, New York, NY 10001", "456 Oak Ave, Los Angeles, CA 90001", "789 Pine Rd, Chicago, IL 60601"],
  "uk": ["10 Baker Street, London, W1U 3BW", "25 Queen Road, Manchester, M1 1AB", "42 King Lane, Birmingham, B1 1AA"],
  "de": ["Hauptstraße 15, 10115 Berlin", "Bahnhofstraße 8, 80335 München", "Königstraße 22, 70173 Stuttgart"],
  "fr": ["15 Rue de Rivoli, 75001 Paris", "8 Avenue Jean Médecin, 06000 Nice"],
  "es": ["Calle Gran Vía 28, 28013 Madrid", "Passeig de Gràcia 55, 08007 Barcelona"],
  "it": ["Via del Corso 120, 00186 Roma", "Via Montenapoleone 8, 20121 Milano"],
  "nl": ["Damrak 1, 1012 LG Amsterdam", "Coolsingel 42, 3011 AD Rotterdam"],
  "pl": ["Nowy Świat 25, 00-029 Warszawa", "Rynek Główny 10, 31-042 Kraków"],
  "pt": ["Rua Augusta 100, 1100-053 Lisboa", "Rua Santa Catarina 50, 4000-442 Porto"],
  "ua": ["вул. Хрещатик 22, Київ, 01001", "вул. Дерибасівська 15, Одеса, 65000"],
  "ro": ["Strada Victoriei 10, București, 010061", "Bulevardul Eroilor 5, Cluj-Napoca, 400129"],
  "default": ["123 Business Center, Downtown", "456 Commerce Blvd, City Center"],
};

function generateRealisticPhoneByGeo(geo: string): string {
  const rd = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  const r = (min = 1, max = 9) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  switch (geo) {
    case "us": case "ca": return `+1 (${r(2,9)}${rd(2)}) ${r(2,9)}${rd(2)}-${rd(4)}`;
    case "uk": return `+44 ${pick(["20","21","113","131","141","161"])} ${rd(4)} ${rd(4)}`;
    case "de": return `+49 ${pick(["30","40","69","89","221"])} ${rd(8)}`;
    case "fr": return `+33 ${pick(["1","2","3","4","5"])} ${rd(2)} ${rd(2)} ${rd(2)} ${rd(2)}`;
    case "es": return `+34 ${pick(["91","93","94","95"])}${r()} ${rd(3)} ${rd(3)}`;
    case "it": return `+39 ${pick(["02","06","011","055"])} ${rd(4)} ${rd(4)}`;
    case "nl": return `+31 ${pick(["20","10","30","70"])} ${rd(3)} ${rd(4)}`;
    case "pl": return `+48 ${pick(["22","12","71","61"])} ${rd(3)} ${rd(2)} ${rd(2)}`;
    case "ua": return `+380 ${pick(["44","50","67","93","97"])} ${rd(3)} ${rd(2)} ${rd(2)}`;
    case "ro": return `+40 ${pick(["21","31","72","74"])} ${rd(3)} ${rd(2)} ${rd(2)}`;
    case "pt": return `+351 ${pick(["21","22"])}${r()} ${rd(3)} ${rd(3)}`;
    default: return `+1 (${r(2,9)}${rd(2)}) ${r(2,9)}${rd(2)}-${rd(4)}`;
  }
}

const randomVipKeywordsByTopic: Record<string, string> = {
  "Video Games": "gaming reviews, gameplay tips, PC games, console gaming, esports",
  "Law Services": "legal advice, attorney consultation, court representation",
  "Dental Care": "teeth cleaning, dental implants, cosmetic dentistry",
  "Real Estate": "property listings, home buying, real estate investment",
  "Pet Grooming": "dog grooming, cat care, pet spa, animal styling",
  "Auto Repair": "car maintenance, engine repair, brake service, oil change",
  "Fitness Training": "personal training, weight loss, muscle building",
  "Photography": "portrait photography, event photos, wedding photographer",
  "Home Renovation": "kitchen remodeling, bathroom renovation, interior design",
  "Accounting": "tax preparation, bookkeeping, financial planning",
  "Travel Agency": "vacation packages, flight booking, hotel reservations",
  "Coffee Shop": "specialty coffee, espresso drinks, pastries, cafe",
  "Bakery": "fresh bread, custom cakes, pastries, artisan baking",
  "Flower Delivery": "fresh flowers, bouquet arrangements, same-day delivery",
  "IT Consulting": "tech solutions, network security, cloud services",
  "Wedding Planning": "event coordination, venue selection, bridal services",
  "Restaurant": "fine dining, local cuisine, food delivery, catering",
  "Spa & Wellness": "massage therapy, facial treatments, wellness programs",
  "Plumbing Services": "pipe repair, drain cleaning, emergency plumbing",
  "Insurance Agency": "life insurance, auto insurance, home insurance",
  "Hair Salon": "haircuts, hair coloring, styling, beauty salon",
  "Yoga Studio": "yoga classes, meditation, mindfulness, wellness",
  "Car Dealership": "new cars, used vehicles, car financing",
  "Cleaning Services": "house cleaning, office cleaning, deep cleaning",
};

const RANDOM_TLDS = [".com", ".net", ".org", ".co", ".io", ".pro"];

const fillRandomData = (
  setSiteNames: (v: string[]) => void,
  setCurrentSiteNameInput: (v: string) => void,
  setPrompt: (v: string) => void,
  setSelectedGeo: (v: string) => void,
  setIsOtherGeoSelected: (v: boolean) => void,
  setSelectedLanguages: (v: string[]) => void,
  setIsBilingualMode: (v: boolean) => void,
  setBilingualLang1: (v: string) => void,
  setBilingualLang2: (v: string) => void,
  setWebsiteType: (v: "html" | "react" | "php") => void,
  setVipDomain: (v: string) => void,
  setVipAddress: (v: string) => void,
  setVipPhone: (v: string) => void,
  setVipTopic: (v: string) => void,
  setVipKeywords: (v: string) => void,
  setVipBannedWords: (v: string) => void,
) => {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  
  // Random geo first (affects everything)
  const geos = getGeoOptions((k: string) => k).filter(g => g.value !== "");
  const geo = pick(geos);
  setSelectedGeo(geo.value);
  setIsOtherGeoSelected(false);
  
  // Random topic
  const topicRaw = pick(randomVipTopics);
  const topicClean = topicRaw.replace(/[\u{1F000}-\u{1FFFF}]\s*/gu, '').trim();
  setVipTopic(topicClean);
  setPrompt(topicClean);
  
  // Domain from realistic business name
  const bizName = getRealisticBusinessName(geo.value || "default", topicClean);
  const domainBase = bizName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
  setVipDomain(`${domainBase}${pick(RANDOM_TLDS)}`);
  setSiteNames([]);
  setCurrentSiteNameInput("");
  
  // Address & phone based on geo
  const addresses = randomVipAddressesByGeo[geo.value] || randomVipAddressesByGeo["default"];
  setVipAddress(pick(addresses));
  setVipPhone(generateRealisticPhoneByGeo(geo.value));
  
  // Keywords & banned words
  setVipKeywords(randomVipKeywordsByTopic[topicClean] || "professional services, quality, expert, trusted");
  setVipBannedWords("crypto, free, miracle, profit, investment, quick gain, guaranteed, 100%, risk-free");
  
  // Language matching geo
  const geoLangMap: Record<string, string> = {
    uk: "en", bg: "bg", be: "fr", vn: "vi", gr: "el", dk: "da", ee: "et",
    id: "id", in: "hi", ie: "en", es: "es", it: "it", ca: "en", lv: "lv",
    lt: "lt", nl: "nl", de: "de", ae: "ar", pl: "pl", pt: "pt", ru: "ru",
    ro: "ro", sk: "sk", si: "sl", us: "en", th: "th", tr: "tr", ua: "uk",
    hu: "hu", fi: "fi", fr: "fr", hr: "hr", cz: "cs", se: "sv", jp: "ja", kz: "kk",
  };
  const matchedLang = geoLangMap[geo.value] || "en";
  
  if (Math.random() < 0.2) {
    setIsBilingualMode(true);
    setBilingualLang1(matchedLang);
    const otherLangs = languages.filter(l => l.value !== matchedLang).map(l => l.value);
    setBilingualLang2(pick(otherLangs));
    setSelectedLanguages([]);
  } else {
    setIsBilingualMode(false);
    setSelectedLanguages([matchedLang]);
    setBilingualLang1("");
    setBilingualLang2("");
  }
  
  const r = Math.random();
  setWebsiteType(r < 0.8 ? "html" : r < 0.95 ? "react" : "php");
};

export function ManualOrderForm() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin: isAdminRole } = useAdmin();
  const { isTeamOwner } = useTeamOwner();
  const { isAdminModeEnabled } = useAdminMode();
  const { maintenance, generationDisabled, generationMessage } = useMaintenanceMode();

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

  // VIP-style fields
  const [vipDomain, setVipDomain] = useState("");
  const [vipAddress, setVipAddress] = useState("");
  const [vipPhone, setVipPhone] = useState("");
  const [vipTopic, setVipTopic] = useState("");
  const [vipKeywords, setVipKeywords] = useState("");
  const [vipBannedWords, setVipBannedWords] = useState("");
  
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
        sonnerToast.error(t("manualOrderForm.fileTooLarge"));
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
      toast({ title: "🔧 " + t("maintenanceBanner.title"), description: t("manualOrder.maintenanceBlocked"), variant: "destructive" });
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
        toast({ title: t("common.error"), description: t("manualOrderForm.selectBothLanguages"), variant: "destructive" });
        return;
      }
    } else {
      if (selectedLanguages.length === 0 && !customLanguage.trim()) {
        toast({ title: t("common.error"), description: t("genForm.selectLanguage"), variant: "destructive" });
        return;
      }
    }

    if (insufficientBalance) {
      toast({ title: t("common.error"), description: t("manualOrderForm.insufficientBalance"), variant: "destructive" });
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

      // Build VIP prompt text from fields
      const vipPromptParts = [
        vipDomain && `Domain: ${vipDomain}`,
        vipAddress && `Address: ${vipAddress}`,
        vipPhone && `Phone: ${vipPhone}`,
        vipTopic && `Topic: ${vipTopic}`,
        vipKeywords && `Keywords: ${vipKeywords}`,
        vipBannedWords && `Banned words: ${vipBannedWords}`,
      ].filter(Boolean).join('\n');

      for (const siteName of names) {
        const { error } = await supabase.from("generation_history").insert({
          prompt: prompt.trim(),
          site_name: vipDomain || siteName,
          language,
          website_type: websiteType,
          ai_model: "senior",
          status: "manual_request",
          team_id: teamPricing.teamId,
          user_id: user?.id,
          image_source: "manual",
          admin_note: [note, vipPromptParts].filter(Boolean).join('\n\n') || null,
          vip_images: imageUrls.length > 0 ? imageUrls : null,
          geo: effectiveGeo || null,
          sale_price: price,
          vip_prompt: vipPromptParts || null,
        });

        if (error) throw error;
      }

      // Deduct balance
      if (totalPrice > 0) {
        const newBalance = teamPricing.balance - totalPrice;
        await supabase.from("teams").update({ balance: newBalance }).eq("id", teamPricing.teamId);
      }

      toast({
        title: t("manualOrderForm.orderSent"),
        description: t("manualOrderForm.orderSentDesc").replace("{count}", String(names.length)).replace("{total}", totalPrice.toFixed(2)),
      });

      // Reset form
      setSiteNames([]);
      setCurrentSiteNameInput("");
      setPrompt("");
      setNote("");
      setVipDomain("");
      setVipAddress("");
      setVipPhone("");
      setVipTopic("");
      setVipKeywords("");
      setVipBannedWords("");
      images.forEach(img => URL.revokeObjectURL(img.preview));
      setImages([]);

    } catch (error) {
      console.error("Manual order error:", error);
      toast({ title: t("common.error"), description: t("manualOrderForm.orderError"), variant: "destructive" });
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
          <CardTitle className="text-lg">{t("manualOrderForm.selectTeamForOrder")}</CardTitle>
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
        <GenerationMaintenanceBanner message={generationMessage || maintenance.message || t("manualOrderForm.orderUnavailable")} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Hand className="h-5 w-5 text-purple-500" />
            {t("manualOrderForm.orderSiteManually")}
            {teamPricing && (
              <Badge variant="outline" className="ml-auto font-normal">
                {teamPricing.teamName} · ${teamPricing.balance.toFixed(2)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Admin team switch + Random fill */}
          <div className="flex items-center justify-between">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAdminTeamId("")}
                className="text-xs text-muted-foreground"
              >
                ← {t("manualOrderForm.changeTeam").replace("← ", "")}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fillRandomData(
                setSiteNames, setCurrentSiteNameInput, setPrompt,
                setSelectedGeo, setIsOtherGeoSelected, setSelectedLanguages,
                setIsBilingualMode, setBilingualLang1, setBilingualLang2, setWebsiteType,
                setVipDomain, setVipAddress, setVipPhone, setVipTopic, setVipKeywords, setVipBannedWords
              )}
              className="h-7 text-xs px-3 ml-auto"
            >
              <Shuffle className="mr-1 h-3 w-3" />
              {t("manualOrderForm.random")}
            </Button>
          </div>

          {/* Site names */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("manualOrderForm.siteNames")} <span className="text-destructive">*</span>
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
              {t("manualOrderForm.description")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={t("manualOrderForm.descriptionPlaceholder")}
              rows={4}
              className="resize-none text-sm"
            />
          </div>

          {/* Geo */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {t("manualOrderForm.geography")}
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {selectedGeo && <GeoFlag value={selectedGeo} />}
                    {isOtherGeoSelected ? customGeo || t("manualOrderForm.customValue") : 
                      selectedGeo ? getGeoText(getGeoOptions(t).find(g => g.value === selectedGeo)?.label || "") : t("manualOrderForm.selectCountry")}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto">
                <Input
                  placeholder={t("manualOrderForm.searchPlaceholder")}
                  value={geoSearch}
                  onChange={e => setGeoSearch(e.target.value)}
                  onKeyDown={e => e.stopPropagation()}
                  className="h-8 text-xs mb-2"
                />
                {getGeoOptions(t)
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
                  ✏️ {t("manualOrderForm.customValue")}
                </button>
                {isOtherGeoSelected && (
                  <Input
                    value={customGeo}
                    onChange={e => setCustomGeo(e.target.value)}
                    placeholder={t("manualOrderForm.enterCountry")}
                    className="h-8 text-xs mt-1"
                  />
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* VIP-style fields */}
          <div className="p-3 border border-amber-500/30 bg-amber-500/5 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Crown className="h-3 w-3" /> {t("manualOrderForm.siteDetails")}
              </span>
              {(() => {
                const hasAllFilled = vipDomain.trim() && vipAddress.trim() && vipPhone.trim() && vipTopic.trim() && vipKeywords.trim() && vipBannedWords.trim();
                const effectiveGeo = isOtherGeoSelected ? "default" : (selectedGeo || "default");
                
                const fillEmpty = () => {
                  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
                  const addresses = randomVipAddressesByGeo[effectiveGeo] || randomVipAddressesByGeo["default"];
                  if (!vipTopic.trim()) {
                    const t = pick(randomVipTopics).replace(/[\u{1F000}-\u{1FFFF}]\s*/gu, '').trim();
                    setVipTopic(t);
                    if (!vipKeywords.trim()) setVipKeywords(randomVipKeywordsByTopic[t] || "professional services, quality, expert");
                    if (!vipDomain.trim()) {
                      const bizName = getRealisticBusinessName(effectiveGeo, t);
                      const domainBase = bizName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
                      setVipDomain(`${domainBase}${pick(RANDOM_TLDS)}`);
                    }
                  } else {
                    if (!vipKeywords.trim()) setVipKeywords(randomVipKeywordsByTopic[vipTopic.trim()] || "professional services, quality, expert");
                    if (!vipDomain.trim()) {
                      const bizName = getRealisticBusinessName(effectiveGeo, vipTopic.trim());
                      const domainBase = bizName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
                      setVipDomain(`${domainBase}${pick(RANDOM_TLDS)}`);
                    }
                  }
                  if (!vipAddress.trim()) setVipAddress(pick(addresses));
                  if (!vipPhone.trim()) setVipPhone(generateRealisticPhoneByGeo(effectiveGeo));
                  if (!vipBannedWords.trim()) setVipBannedWords("crypto, free, miracle, profit, guaranteed, 100%, risk-free");
                };

                const refreshAll = () => {
                  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
                  const addresses = randomVipAddressesByGeo[effectiveGeo] || randomVipAddressesByGeo["default"];
                  const topicRaw = pick(randomVipTopics);
                  const topicClean = topicRaw.replace(/[\u{1F000}-\u{1FFFF}]\s*/gu, '').trim();
                  setVipTopic(topicClean);
                  setVipKeywords(randomVipKeywordsByTopic[topicClean] || "professional services, quality, expert");
                  const bizName = getRealisticBusinessName(effectiveGeo, topicClean);
                  const domainBase = bizName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14);
                  setVipDomain(`${domainBase}${pick(RANDOM_TLDS)}`);
                  setVipAddress(pick(addresses));
                  setVipPhone(generateRealisticPhoneByGeo(effectiveGeo));
                  setVipBannedWords("crypto, free, miracle, profit, guaranteed, 100%, risk-free");
                };

                return hasAllFilled ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshAll}
                    className="h-6 text-xs px-2 text-amber-600 hover:text-amber-700"
                  >
                    <Shuffle className="h-3 w-3 mr-1" />
                    {t("manualOrderForm.random")}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fillEmpty}
                    className="h-6 text-xs px-2 text-amber-600 hover:text-amber-700"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {t("manualOrderForm.fillEmpty")}
                  </Button>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Globe className="h-3 w-3" /> {t("manualOrderForm.domain")}
                </Label>
                <Input
                  placeholder="example.com"
                  value={vipDomain}
                  onChange={e => setVipDomain(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {t("manualOrderForm.address")}
                </Label>
                <Input
                  placeholder="100 Main Street, City, Country"
                  value={vipAddress}
                  onChange={e => setVipAddress(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {t("manualOrderForm.phone")}
                </Label>
                <Input
                  placeholder="+1 (555) 123-4567"
                  value={vipPhone}
                  onChange={e => setVipPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Tag className="h-3 w-3" /> {t("manualOrderForm.topic")}
                </Label>
                <Input
                  placeholder="Dental Care, Law Services..."
                  value={vipTopic}
                  onChange={e => setVipTopic(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <Hash className="h-3 w-3" /> {t("manualOrderForm.keywords")}
              </Label>
              <Input
                placeholder="keyword1, keyword2, keyword3..."
                value={vipKeywords}
                onChange={e => setVipKeywords(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1">
                <X className="h-3 w-3 text-destructive" /> {t("manualOrderForm.bannedWords")}
              </Label>
              <Input
                placeholder="crypto, free, miracle, profit..."
                value={vipBannedWords}
                onChange={e => setVipBannedWords(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("manualOrderForm.siteType")}</Label>
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
              {t("manualOrderForm.bilingualSite")}
              {isBilingualMode && <span className="ml-1">✓</span>}
            </Button>
          </div>

          {/* Bilingual language selection */}
          {isBilingualMode ? (
            <div className="p-3 border border-blue-500/50 bg-blue-500/5 rounded-lg space-y-3">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Languages className="h-4 w-4" />
                <span className="text-sm font-medium">{t("manualOrderForm.selectTwoLanguages")}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("manualOrderForm.language1")} <span className="text-destructive">*</span></Label>
                  <Select value={bilingualLang1} onValueChange={setBilingualLang1}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("manualOrderForm.selectLanguage")} />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.filter(l => l.value !== bilingualLang2).map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{t("manualOrderForm.language2")} <span className="text-destructive">*</span></Label>
                  <Select value={bilingualLang2} onValueChange={setBilingualLang2}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={t("manualOrderForm.selectLanguage")} />
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
                {t("manualOrderForm.siteLanguage")} <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-between text-sm">
                    {selectedLanguages.length > 0 
                      ? languages.find(l => l.value === selectedLanguages[0])?.label || selectedLanguages[0]
                      : t("manualOrderForm.selectLanguage")}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2 max-h-64 overflow-y-auto">
                  <Input
                    placeholder={t("manualOrderForm.searchPlaceholder")}
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
                    {t("manualOrderForm.customLanguage")}
                  </button>
                  {isOtherSelected && (
                    <Input
                      value={customLanguage}
                      onChange={e => setCustomLanguage(e.target.value)}
                      placeholder={t("manualOrderForm.enterLanguage")}
                      className="h-8 text-xs mt-1"
                    />
                  )}
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("manualOrderForm.orderNote")}</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t("manualOrderForm.orderNotePlaceholder")}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {t("manualOrderForm.images")} ({images.length}/{MAX_IMAGES})
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
                  {t("manualOrderForm.ordering")}
                </>
              ) : (
                <>
                  <Hand className="mr-2 h-4 w-4" />
                  {t("manualOrderForm.orderSite")}
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
              <span className="text-xs text-destructive">{t("manualOrderForm.insufficientBalance")}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
