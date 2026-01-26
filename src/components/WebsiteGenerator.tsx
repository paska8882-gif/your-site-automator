import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

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
import { Loader2, FileCode2, Sparkles, Zap, Crown, Globe, Layers, Languages, Hash, Palette, ChevronDown, AlertTriangle, Users, Wallet, RefreshCcw, Info, Image, Save, FolderOpen, Trash2, ChevronUp, Filter, Newspaper, MapPin, X, Plus, Star, Phone, Building2, Tag, Shuffle, Hand } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { startGeneration, AiModel, WebsiteType, SeniorMode, ImageSource, LAYOUT_STYLES, COLOR_SCHEMES_UI, ColorScheme } from "@/lib/websiteGenerator";
import { supabase } from "@/integrations/supabase/client";
import { GenerationHistory } from "./GenerationHistory";
import { LazyHistorySection } from "./LazyHistorySection";
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

// Super admin email is now stored securely in edge function environment

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

// Countries/Geo list with flags
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
  { value: "jp", label: "🇯🇵 Японія" },
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
  "🎮 Video Games", "⚖️ Law Services", "🦷 Dental Care", "🏠 Real Estate",
  "🐕 Pet Grooming", "🔧 Auto Repair", "💪 Fitness Training", "📷 Photography",
  "🏗️ Home Renovation", "📊 Accounting", "✈️ Travel Agency", "☕ Coffee Shop",
  "🥐 Bakery", "💐 Flower Delivery", "💻 IT Consulting", "💒 Wedding Planning",
  "🍽️ Restaurant", "💆 Spa & Wellness", "🔩 Plumbing Services", "🛡️ Insurance Agency",
  "💇 Hair Salon", "🧘 Yoga Studio", "🚗 Car Dealership", "🧹 Cleaning Services",
  "📰 News Portal", "🛒 E-commerce", "📚 Education", "🏥 Healthcare", "👗 Fashion",
  "⚽ Sports", "🎵 Music", "🎨 Art Gallery", "🪙 Crypto", "📢 Marketing Agency"
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
  "nl": ["Damrak 1, 1012 LG Amsterdam", "Coolsingel 42, 3011 AD Rotterdam", "Oudegracht 120, 3511 AX Utrecht", "Grote Markt 15, 9711 LV Groningen"],
  "be": ["Grand Place 1, 1000 Bruxelles", "Meir 50, 2000 Antwerpen"],
  "at": ["Kärntner Straße 10, 1010 Wien", "Getreidegasse 5, 5020 Salzburg"],
  "ch": ["Bahnhofstrasse 15, 8001 Zürich", "Rue du Rhône 42, 1204 Genève"],
  "pl": ["Nowy Świat 25, 00-029 Warszawa", "Rynek Główny 10, 31-042 Kraków"],
  "se": ["Drottninggatan 50, 111 21 Stockholm", "Avenyn 15, 411 36 Göteborg"],
  "no": ["Karl Johans gate 10, 0154 Oslo", "Bryggen 5, 5003 Bergen"],
  "dk": ["Strøget 20, 1160 København", "Søndergade 15, 8000 Aarhus"],
  "pt": ["Rua Augusta 100, 1100-053 Lisboa", "Rua Santa Catarina 50, 4000-442 Porto"],
  "default": ["123 Business Center, Downtown", "456 Commerce Blvd, City Center", "789 Enterprise Ave, Business District"]
};

// Generate realistic phone number by geo
function generateRealisticPhoneByGeo(geo: string): string {
  const randomDigits = (count: number) => Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
  const randomDigit = (min = 1, max = 9) => Math.floor(Math.random() * (max - min + 1)) + min;
  
  switch (geo) {
    case "us":
    case "ca": {
      // North America: +1 (XXX) XXX-XXXX - area codes don't start with 0 or 1
      const areaCode = `${randomDigit(2, 9)}${randomDigits(2)}`;
      const exchange = `${randomDigit(2, 9)}${randomDigits(2)}`;
      return `+1 (${areaCode}) ${exchange}-${randomDigits(4)}`;
    }
    case "uk": {
      // UK: +44 XX XXXX XXXX
      const areaCodes = ["20", "21", "23", "24", "28", "29", "113", "114", "115", "116", "117", "118", "121", "131", "141", "151", "161"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+44 ${areaCode} ${randomDigits(4)} ${randomDigits(4)}`;
    }
    case "de": {
      // Germany: +49 XXX XXXXXXXX
      const areaCodes = ["30", "40", "69", "89", "221", "211", "711", "621", "511"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+49 ${areaCode} ${randomDigits(8)}`;
    }
    case "au": {
      // Australia: +61 X XXXX XXXX
      const areaCodes = ["2", "3", "7", "8"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+61 ${areaCode} ${randomDigits(4)} ${randomDigits(4)}`;
    }
    case "fr": {
      // France: +33 X XX XX XX XX
      const prefixes = ["1", "2", "3", "4", "5"];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return `+33 ${prefix} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "es": {
      // Spain: +34 XXX XXX XXX
      const prefixes = ["91", "93", "94", "95", "96"];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return `+34 ${prefix}${randomDigit()} ${randomDigits(3)} ${randomDigits(3)}`;
    }
    case "it": {
      // Italy: +39 XX XXXX XXXX
      const areaCodes = ["02", "06", "011", "041", "055", "081"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+39 ${areaCode} ${randomDigits(4)} ${randomDigits(4)}`;
    }
    case "nl": {
      // Netherlands: +31 XX XXX XXXX
      const areaCodes = ["20", "10", "30", "70", "40"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+31 ${areaCode} ${randomDigits(3)} ${randomDigits(4)}`;
    }
    case "be": {
      // Belgium: +32 X XXX XX XX
      const areaCodes = ["2", "3", "4", "9"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+32 ${areaCode} ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "at": {
      // Austria: +43 X XXXXXXXX
      const areaCodes = ["1", "662", "512", "732", "316"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+43 ${areaCode} ${randomDigits(7)}`;
    }
    case "ch": {
      // Switzerland: +41 XX XXX XX XX
      const areaCodes = ["44", "22", "31", "61", "21"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+41 ${areaCode} ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "pl": {
      // Poland: +48 XX XXX XX XX
      const areaCodes = ["22", "12", "71", "61", "58"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+48 ${areaCode} ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "se": {
      // Sweden: +46 X XXX XXX XX
      const areaCodes = ["8", "31", "40", "46", "90"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+46 ${areaCode} ${randomDigits(3)} ${randomDigits(3)} ${randomDigits(2)}`;
    }
    case "no": {
      // Norway: +47 XX XX XX XX
      return `+47 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "dk": {
      // Denmark: +45 XX XX XX XX
      return `+45 ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "pt": {
      // Portugal: +351 XXX XXX XXX
      const areaCodes = ["21", "22", "23", "24", "25"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+351 ${areaCode}${randomDigit()} ${randomDigits(3)} ${randomDigits(3)}`;
    }
    case "ua": {
      // Ukraine: +380 XX XXX XX XX
      const areaCodes = ["44", "50", "66", "67", "68", "73", "93", "95", "96", "97", "98", "99"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+380 ${areaCode} ${randomDigits(3)} ${randomDigits(2)} ${randomDigits(2)}`;
    }
    case "ru": {
      // Russia: +7 XXX XXX-XX-XX
      const areaCodes = ["495", "499", "812", "383", "343", "846", "831"];
      const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)];
      return `+7 ${areaCode} ${randomDigits(3)}-${randomDigits(2)}-${randomDigits(2)}`;
    }
    default: {
      // Default: random international format
      const formats = [
        () => `+1 (${randomDigit(2, 9)}${randomDigits(2)}) ${randomDigit(2, 9)}${randomDigits(2)}-${randomDigits(4)}`,
        () => `+44 ${randomDigit(1, 2)}${randomDigits(1)} ${randomDigits(4)} ${randomDigits(4)}`,
        () => `+49 ${randomDigit(2, 9)}${randomDigits(1)} ${randomDigits(8)}`,
      ];
      return formats[Math.floor(Math.random() * formats.length)]();
    }
  }
}

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
  "Cleaning Services": "house cleaning, office cleaning, deep cleaning, maid service",
  "News Portal": "breaking news, latest headlines, world news, local news, journalism",
  "E-commerce": "online shopping, product catalog, secure checkout, fast delivery",
  "Education": "online courses, learning platform, tutorials, certifications, e-learning",
  "Healthcare": "medical services, patient care, health clinic, doctors, appointments",
  "Fashion": "clothing, style trends, designer wear, accessories, fashion boutique",
  "Sports": "sports news, team updates, live scores, athletic training, fitness",
  "Music": "music streaming, albums, concerts, artists, playlists, music production",
  "Art Gallery": "art exhibitions, paintings, sculptures, contemporary art, artists",
  "Crypto": "cryptocurrency, blockchain, bitcoin, trading, digital assets, DeFi",
  "Marketing Agency": "digital marketing, SEO, social media, branding, advertising"
};

const randomVipBannedWordsByTopic: Record<string, string> = {
  "Video Games": "cheat, hack, pirate, crack, keygen, torrent, warez, illegal download",
  "Law Services": "guaranteed outcome, 100% win, free lawyer, no-risk, miracle verdict, instant settlement",
  "Dental Care": "painless guarantee, miracle cure, instant whitening, free treatment, no side effects",
  "Real Estate": "guaranteed profit, risk-free investment, instant equity, free property, miracle deal",
  "Pet Grooming": "miracle cure, instant results, free service, guaranteed transformation",
  "Auto Repair": "free repair, guaranteed fix, miracle solution, instant repair, no cost",
  "Fitness Training": "instant results, miracle diet, guaranteed weight loss, free program, no effort",
  "Photography": "free photoshoot, guaranteed masterpiece, instant delivery, miracle editing",
  "Home Renovation": "free renovation, guaranteed savings, instant completion, miracle transformation",
  "Accounting": "tax evasion, guaranteed refund, free audit, instant savings, miracle deduction",
  "Travel Agency": "free vacation, guaranteed booking, instant visa, miracle price, risk-free travel",
  "Coffee Shop": "free coffee, miracle blend, instant energy, guaranteed freshness",
  "Bakery": "free cake, miracle recipe, instant baking, guaranteed taste",
  "Flower Delivery": "free flowers, guaranteed freshness, instant delivery, miracle blooms",
  "IT Consulting": "free service, guaranteed uptime, instant fix, miracle solution, unhackable",
  "Wedding Planning": "free wedding, guaranteed success, instant booking, miracle planning",
  "Restaurant": "free meal, guaranteed taste, instant service, miracle recipe",
  "Spa & Wellness": "miracle cure, instant relaxation, free treatment, guaranteed results",
  "Plumbing Services": "free repair, guaranteed fix, instant service, miracle solution",
  "Insurance Agency": "guaranteed payout, free coverage, instant approval, miracle policy, risk-free",
  "Hair Salon": "miracle treatment, instant results, free styling, guaranteed transformation",
  "Yoga Studio": "instant enlightenment, miracle healing, free classes, guaranteed results",
  "Car Dealership": "free car, guaranteed approval, instant financing, miracle deal, no credit check",
  "Cleaning Services": "free cleaning, guaranteed spotless, instant service, miracle results",
  "News Portal": "fake news, clickbait, sensational, unverified, rumor, conspiracy, propaganda",
  "E-commerce": "free shipping forever, guaranteed lowest price, instant refund, miracle product",
  "Education": "instant diploma, guaranteed degree, free certification, miracle learning",
  "Healthcare": "miracle cure, instant healing, guaranteed treatment, free diagnosis, no side effects",
  "Fashion": "free designer, guaranteed authentic, instant delivery, miracle fabric",
  "Sports": "guaranteed win, instant muscles, free gear, miracle performance, doping",
  "Music": "free downloads, guaranteed hits, instant fame, miracle sound, pirated",
  "Art Gallery": "guaranteed appreciation, instant value, free artwork, miracle investment",
  "Crypto": "guaranteed returns, risk-free investment, instant profit, moon, lambo, 100x gains",
  "Marketing Agency": "guaranteed viral, instant followers, free marketing, miracle growth, spam"
};

const defaultBannedWords = "crypto, free, miracle, health, profit, investment, quick gain, earnings, money, price, cost, guarantee, exclusive, top, bonus, 100%, risk-free";

interface GeneratorDraft {
  siteNames: string[];
  prompt: string;
  exactPhone: string;
  selectedLanguages: string[];
  selectedGeo: string;
  customGeo: string;
  isOtherGeoSelected: boolean;
  customLanguage: string;
  isOtherSelected: boolean;
  selectedStyles: string[];
  customStyle: string;
  isOtherStyleSelected: boolean;
  selectedColorScheme: ColorScheme;
  // sitesPerLanguage removed - always 1 site per name now
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
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { isTeamOwner } = useTeamOwner();
  const navigate = useNavigate();
  
  // Load draft on mount
  const draft = useRef(loadDraft()).current;
  
  const [siteNames, setSiteNames] = useState<string[]>(draft.siteNames || []);
  const [currentSiteNameInput, setCurrentSiteNameInput] = useState("");
  const [prompt, setPrompt] = useState(draft.prompt || "");
  const [exactPhone, setExactPhone] = useState(draft.exactPhone || "");
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
  const [selectedColorScheme, setSelectedColorScheme] = useState<ColorScheme>(draft.selectedColorScheme || "random");
  // Removed: sitesPerLanguage selector - now always 1 site per name (each request is unique)
  const sitesPerLanguage = 1;
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
  const [vipBannedWords, setVipBannedWords] = useState("");
  const [vipTopic, setVipTopic] = useState("");
  
  // Bilingual site mode state (+$3 extra)
  const [isBilingualMode, setIsBilingualMode] = useState(false);
  const [bilingualLang1, setBilingualLang1] = useState("");
  const [bilingualLang2, setBilingualLang2] = useState("");
  
  // Image bundling mode: true = download images to ZIP (slower), false = keep as URLs (faster)
  const [bundleImages, setBundleImages] = useState(false);
  
  // Theme-based prompt generation state
  const [promptMode, setPromptMode] = useState<"manual" | "theme">("manual");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [isGeneratingThemePrompt, setIsGeneratingThemePrompt] = useState(false);
  
  // Topic categories from edge function (loaded on component mount)
  const TOPIC_CATEGORIES: Record<string, string[]> = {
    // Финансы (Education)
    "Фінанси (Освіта)": [
      "Ведення бюджету", "Інвестування", "Робота з криптовалютами", "Фінансова грамотність",
      "Побудова бізнесу", "Краудфандинг", "Фінансовий аналітик", "Трейдинг", "Машинне навчання у фінансах"
    ],
    "Здоров'я (Освіта)": [
      "Здоровий спосіб життя", "Правильне харчування", "Гімнастика", "Йога", "Вегетаріанство", "Кросфіт"
    ],
    "Краса (Освіта)": ["Манікюр", "Візажист", "Стиліст", "Перукар"],
    "Вивчення іноземних мов": [
      "Англійська мова", "Польська мова", "Німецька мова", "Іспанська мова", "Французька мова",
      "Італійська мова", "Португальська мова", "Арабська мова", "Японська мова"
    ],
    "Саморозвиток": [
      "Підвищення мотивації", "Медитація", "Особистісний ріст", "Психологія", "Коучинг",
      "Сімейні відносини", "Вивчення релігій", "Побудова командної роботи", "Астрологія", "Дейтинг", "Креативність"
    ],
    "Кар'єрний ріст": [
      "Туроператор", "Маркетолог", "Дизайнер", "Менеджмент", "Журналістика", "Флорист",
      "Організатор свят", "Акторська майстерність", "Кіберспорт", "Туристичний гід",
      "Торгівля на маркетплейсах", "Еколог", "Юрист", "Ріелтор", "Соціальний працівник",
      "Стрімінг", "Нафта", "Газ", "Енергетика"
    ],
    "Творчість": ["Письменництво", "Кулінарія", "Малювання", "Фотограф", "Музика", "Танці"],
    "IT (Освіта)": [
      "Розробка мобільних ігор", "Програмування", "Відеомонтаж", "Основи блокчейну", "Веб-дизайн",
      "Системний адміністратор", "SEO-спеціаліст", "Розробник AR/VR ігор", "3D-дизайн для ігор",
      "ШІ (штучний інтелект)", "Кібербезпека"
    ],
    // === ПОСЛУГИ ===
    "Фінанси (Послуги)": [
      "Побудова бізнесу", "Управління бюджетом", "Фінансове консультування", "Фінансова підтримка",
      "Бухгалтерський облік", "Фінансовий аудит", "Автоматизація фінансових процесів",
      "ШІ-рішення для управління фінансами"
    ],
    "Здоров'я (Послуги)": [
      "Йога", "Гімнастика", "Кросфіт", "Нутриціологія", "Здоров'я людей похилого віку",
      "Масаж та релаксація", "Антистрес-терапія"
    ],
    "Саморозвиток (Послуги)": [
      "Лайф-коучинг", "Психологія", "Сімейне консультування", "Медитація", "Розвиток лідерства"
    ],
    "Краса (Послуги)": ["Манікюр", "Візажист", "Стиліст", "Перукар"],
    "Професійні послуги": [
      "Туроператор", "Цифровий маркетинг", "Графічний дизайн", "Проектне управління", "Журналістика",
      "Флористика", "Івент-менеджмент", "Актор", "Торгівля на маркетплейсах",
      "Екологічне консультування", "Соціальна робота", "Перекладач", "Таргетована реклама", "Контент-менеджмент"
    ],
    "Креативність (Послуги)": ["Копірайтер", "Кулінар", "Художник", "Фотограф", "Музикант"],
    "IT (Послуги)": [
      "Розробка мобільних додатків", "Програмування", "Відеомонтаж", "Веб-дизайн", "SEO",
      "Системне адміністрування", "AR/VR розробка", "3D-дизайн", "ШІ (штучний інтелект)",
      "Кібербезпека", "Розробка ігор", "Тестування ПЗ", "Блокчейн-розробка",
      "Розробка чат-ботів", "Управління базами даних"
    ]
  };
  
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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  // Reference to addOptimisticItem function from GenerationHistory
  const addOptimisticItemRef = useRef<((item: { id: string; site_name?: string | null; prompt?: string; language?: string; status?: string; ai_model?: string | null; website_type?: string | null; image_source?: string | null; geo?: string | null; created_at?: string }) => void) | null>(null);
  
  // Callback to receive addOptimisticItem from GenerationHistory
  const handleAddOptimistic = useCallback((fn: (item: { id: string; site_name?: string | null; prompt?: string; language?: string; status?: string; ai_model?: string | null; website_type?: string | null; image_source?: string | null; geo?: string | null; created_at?: string }) => void) => {
    addOptimisticItemRef.current = fn;
  }, []);

  // Check super admin status via edge function
  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        return;
      }
      
      try {
        const session = await supabase.auth.getSession();
        const accessToken = session.data.session?.access_token;
        
        if (!accessToken) {
          setIsSuperAdmin(false);
          return;
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-super-admin`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          setIsSuperAdmin(data.isSuperAdmin === true);
        } else {
          setIsSuperAdmin(false);
        }
      } catch (error) {
        console.error("Error checking super admin status:", error);
        setIsSuperAdmin(false);
      }
    };

    checkSuperAdmin();
  }, [user]);

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
      exactPhone,
      selectedLanguages,
      selectedGeo,
      customGeo,
      isOtherGeoSelected,
      customLanguage,
      isOtherSelected,
      selectedStyles,
      customStyle,
      isOtherStyleSelected,
      selectedColorScheme,
      // sitesPerLanguage removed - always 1
      selectedAiModels,
      selectedWebsiteTypes,
      selectedImageSources,
      seniorMode,
      adminGenerationMode,
    });
  }, [
    siteNames, prompt, exactPhone, selectedLanguages, selectedGeo, customGeo, isOtherGeoSelected,
    customLanguage, isOtherSelected,
    selectedStyles, customStyle, isOtherStyleSelected, selectedColorScheme,
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

  // Auto-generate phone when geo changes (only if vipPhone is empty or was auto-generated)
  const [lastAutoGeneratedPhone, setLastAutoGeneratedPhone] = useState<string>("");
  
  useEffect(() => {
    // Get effective geo
    const effectiveGeo = isOtherGeoSelected && customGeo 
      ? customGeo.toLowerCase()
      : selectedGeo;
    
    // Only auto-generate if:
    // 1. There's a geo selected
    // 2. VIP phone is empty OR equals the last auto-generated phone (not manually edited)
    if (effectiveGeo && (vipPhone === "" || vipPhone === lastAutoGeneratedPhone)) {
      // Map custom geo to country code if possible
      let geoCode = effectiveGeo;
      if (isOtherGeoSelected && customGeo) {
        // Try to match custom geo to a known country code
        const matchedGeo = geoOptions.find(g => 
          g.label.toLowerCase() === customGeo.toLowerCase() ||
          g.value === customGeo.toLowerCase()
        );
        geoCode = matchedGeo?.value || "default";
      }
      
      const newPhone = generateRealisticPhoneByGeo(geoCode);
      setVipPhone(newPhone);
      setLastAutoGeneratedPhone(newPhone);
    }
  }, [selectedGeo, customGeo, isOtherGeoSelected]);

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
        setRandomQuote({ text: t("genForm.fallbackQuote"), author: t("genForm.fallbackAuthor") });
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
        title: t("generatorExtra.feedbackTitle"),
        description: t("generatorExtra.feedbackDesc"),
      });
      setFeedbackText("");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast({
        title: t("common.error"),
        description: t("generatorExtra.feedbackError"),
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
        title: t("common.error"),
        description: t("generatorExtra.presetError"),
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
      sitesPerLanguage: 1, // Always 1, kept for backward compatibility
      selectedAiModels,
      selectedWebsiteTypes,
      selectedImageSources,
      seniorMode,
    };

    savePresetsToStorage([...presets, newPreset]);
    setPresetName("");
    toast({
      title: t("generatorExtra.presetSaved"),
      description: `"${newPreset.name}" ${t("generatorExtra.presetSavedDesc")}`,
    });
  };

  const loadPreset = (preset: GenerationPreset) => {
    setSelectedLanguages(preset.selectedLanguages);
    setCustomLanguage(preset.customLanguage);
    setIsOtherSelected(preset.isOtherSelected);
    setSelectedStyles(preset.selectedStyles);
    setCustomStyle(preset.customStyle);
    setIsOtherStyleSelected(preset.isOtherStyleSelected);
    // sitesPerLanguage is now always 1 (removed from presets)
    setSelectedAiModels(preset.selectedAiModels);
    setSelectedWebsiteTypes(preset.selectedWebsiteTypes);
    setSelectedImageSources(preset.selectedImageSources);
    setSeniorMode(preset.seniorMode);
    toast({
      title: t("generatorExtra.presetLoaded"),
      description: `${t("generatorExtra.presetLoadedDesc")} "${preset.name}"`,
    });
  };

  const deletePreset = (presetId: string) => {
    const newPresets = presets.filter(p => p.id !== presetId);
    savePresetsToStorage(newPresets);
    toast({
      title: t("generatorExtra.presetDeleted"),
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
    // sitesPerLanguage is now always 1
    setSelectedAiModels([]);
    setSelectedWebsiteTypes([]);
    setSelectedImageSources([]);
    setSeniorMode(null);
    toast({
      title: t("generatorExtra.paramsClear"),
      description: t("generatorExtra.paramsClearDesc"),
    });
  };

  // Fetch team pricing on mount (only for non-admins, admins use team selection)
  useEffect(() => {
    const fetchTeamPricing = async () => {
      // Wait for admin loading to complete before deciding
      if (adminLoading) return;
      
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
  }, [isAdmin, adminLoading, playBalanceSound]);

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
        title: t("common.error"),
        description: t("generatorExtra.promptError"),
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
          title: t("generatorExtra.authError"),
          description: t("generatorExtra.authErrorDesc"),
          variant: "destructive",
        });
        setIsImproving(false);
        return;
      }

      // Save the original prompt before improving
      const currentOriginal = originalPrompt || prompt;
      
      // Get effective geo and phone for improved prompt
      const effectiveGeo = isOtherGeoSelected && customGeo 
        ? customGeo 
        : (selectedGeo ? geoOptions.find(g => g.value === selectedGeo)?.label || selectedGeo : undefined);
      const effectivePhone = vipPhone || undefined;
      
      const { data, error } = await supabase.functions.invoke('improve-prompt', {
        body: { 
          prompt,
          geo: effectiveGeo,
          phone: effectivePhone,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        // Якщо помилка авторизації - показуємо відповідне повідомлення
        if (error.message?.includes('401') || error.message?.includes('JWT')) {
          throw new Error(t("generatorExtra.sessionExpired"));
        }
        // Якщо помилка 402 - показуємо повідомлення про кредити
        if (error.message?.includes('402')) {
          throw new Error(t("generatorExtra.notEnoughCredits"));
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
          title: t("generatorExtra.promptImproved"),
          description: t("generatorExtra.promptImprovedDesc"),
        });
      }
    } catch (error: any) {
      console.error("Error improving prompt:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("generatorExtra.improveError"),
        variant: "destructive",
      });
    } finally {
      setIsImproving(false);
    }
  };

  // Note: Theme prompt generation is now integrated into executeGeneration()

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

  // Parse multiple site names from a string (comma, space, newline, semicolon separated)
  const parseSiteNames = (input: string): string[] => {
    // Split by common delimiters: comma, semicolon, newline, tab, multiple spaces
    const names = input
      .split(/[,;\n\t]+/)
      .map(name => name.trim())
      .filter(name => name.length > 0);
    return names;
  };

  // Add a new site name from input
  const addSiteName = () => {
    const trimmed = currentSiteNameInput.trim();
    if (trimmed && !siteNames.includes(trimmed)) {
      setSiteNames(prev => [...prev, trimmed]);
      setCurrentSiteNameInput("");
    }
  };

  // Add multiple site names at once (for paste functionality)
  const addMultipleSiteNames = (names: string[]) => {
    const uniqueNewNames = names.filter(name => name && !siteNames.includes(name));
    if (uniqueNewNames.length > 0) {
      setSiteNames(prev => [...prev, ...uniqueNewNames]);
      setCurrentSiteNameInput("");
    }
  };

  // Handle paste event to detect and parse multiple site names
  const handleSiteNamePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    const parsedNames = parseSiteNames(pastedText);
    
    // If pasted text contains multiple items, handle them all at once
    if (parsedNames.length > 1) {
      e.preventDefault();
      addMultipleSiteNames(parsedNames);
    }
    // If single item, let default paste behavior work
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
  // For bilingual mode, we generate 1 site (with 2 languages inside), not per-language
  const effectiveLangCount = isBilingualMode ? 1 : allLanguages.length;
  const totalGenerations = siteNamesCount * effectiveLangCount * sitesPerLanguage * styleCount * aiModelCount * websiteTypeCount * imageSourceCount;

  // Calculate total cost for current generation (consider all combinations)
  const calculateTotalCost = () => {
    let total = 0;
    const htmlPrice = teamPricing?.htmlPrice || 7;
    const reactPrice = teamPricing?.reactPrice || 9;
    const vipExtra = isVipMode ? (teamPricing?.vipExtraPrice || 2) : 0;
    const bilingualExtra = isBilingualMode ? 3 : 0; // +$3 for bilingual sites
    const themeExtra = (promptMode === "theme" && selectedTopic) ? 1 : 0; // +$1 for theme-based prompt generation
    
    const websiteTypesToUse = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : ["html"];
    const imageSourcesToUse = selectedImageSources.length > 0 ? selectedImageSources : ["basic"];
    
    // For bilingual mode, we generate 1 site per combination (not per language)
    const langCount = isBilingualMode ? 1 : allLanguages.length;
    
    for (const wt of websiteTypesToUse) {
      for (const is of imageSourcesToUse) {
        const basePrice = wt === "react" ? reactPrice : htmlPrice;
        const pricePerSite = basePrice + (is === "ai" ? 2 : 0) + vipExtra + bilingualExtra + themeExtra;
        const count = siteNamesCount * langCount * sitesPerLanguage * styleCount * aiModelCount;
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
  const fetchActiveGenerationsInFlight = useRef(false);

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
      if (fetchActiveGenerationsInFlight.current) return;

      fetchActiveGenerationsInFlight.current = true;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      try {
        const { count, error } = await supabase
          .from("generation_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("status", "generating")
          // supabase-js supports abortSignal in v2
          .abortSignal(controller.signal as any);

        if (!error && count !== null) {
          setActiveGenerationsCount(count);
        }
      } catch (e) {
        // Network hiccups shouldn't freeze UI; we'll retry on next poll
        console.error("Failed to fetch active generations:", e);
      } finally {
        clearTimeout(timeout);
        fetchActiveGenerationsInFlight.current = false;
      }
    };

    fetchActiveGenerations();
    // Poll every 20 seconds - reduces Cloud costs while keeping UI responsive
    const interval = setInterval(fetchActiveGenerations, 20_000);
    return () => clearInterval(interval);
  }, [user]);

  // Calculate available slots
  const availableSlots = userMaxGenerations - activeGenerationsCount;
  const wouldExceedLimit = totalGenerations > availableSlots;

  const handleGenerateClick = async () => {
    const siteNames = getAllSiteNames();
    if (siteNames.length === 0) {
      toast({
        title: t("common.error"),
        description: t("genForm.enterSiteName"),
        variant: "destructive",
      });
      return;
    }

    // For theme mode, topic selection is required instead of prompt
    if (promptMode === "theme") {
      if (!selectedTopic) {
        toast({
          title: t("common.error"),
          description: t("genForm.selectTopicRequired"),
          variant: "destructive",
        });
        return;
      }
    } else if (!prompt.trim()) {
      toast({
        title: t("common.error"),
        description: t("genForm.enterDescription"),
        variant: "destructive",
      });
      return;
    }

    // Admin must select a team
    if (isAdmin && !selectedAdminTeamId) {
      toast({
        title: t("common.error"),
        description: t("genForm.selectTeamForGeneration"),
        variant: "destructive",
      });
      return;
    }

    // For bilingual mode, check both languages are selected; otherwise check regular languages
    if (isBilingualMode) {
      if (!bilingualLang1 || !bilingualLang2) {
        toast({
          title: t("common.error"),
          description: t("genForm.selectTwoLanguages"),
          variant: "destructive",
        });
        return;
      }
    } else if (allLanguages.length === 0) {
      toast({
        title: t("common.error"),
        description: t("genForm.selectAtLeastOneLanguage"),
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
            title: t("genForm.concurrentLimitExceeded"),
            description: t("genForm.concurrentLimitDesc")
              .replace("{active}", String(count))
              .replace("{available}", String(currentAvailableSlots))
              .replace("{max}", String(userMaxGenerations))
              .replace("{requested}", String(totalGenerations)),
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
        title: t("genForm.insufficientFunds"),
        description: `${t("genForm.fundsNeeded")} $${totalCost.toFixed(2)}, ${t("genForm.fundsBalance")} $${teamPricing.balance.toFixed(2)}. ${t("genForm.insufficientFundsDesc")}`,
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

    // If in theme mode with topic selected, generate theme prompt first (silently)
    let themeGeneratedPrompt: string | null = null;
    if (promptMode === "theme" && selectedTopic) {
      try {
        setIsGeneratingThemePrompt(true);
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          toast({
            title: t("generatorExtra.authError"),
            description: t("generatorExtra.authErrorDesc"),
            variant: "destructive",
          });
          setIsSubmitting(false);
          setIsGeneratingThemePrompt(false);
          return;
        }

        // Get effective geo
        const effectiveGeo = isOtherGeoSelected && customGeo 
          ? customGeo 
          : (selectedGeo ? geoOptions.find(g => g.value === selectedGeo)?.label || selectedGeo : undefined);
        
        // Get effective language
        const allLangs = getAllSelectedLanguages();
        const effectiveLang = allLangs.length > 0 
          ? languages.find(l => l.value === allLangs[0])?.label || allLangs[0] 
          : undefined;
        
        // Get site name if provided
        const siteName = siteNames.length > 0 ? siteNames[0] : undefined;

        const { data, error } = await supabase.functions.invoke('generate-theme-prompt', {
          body: { 
            topic: selectedTopic,
            siteName,
            geo: effectiveGeo,
            phone: vipPhone || undefined,
            language: effectiveLang,
          },
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`,
          },
        });

        if (error) {
          if (error.message?.includes('401') || error.message?.includes('JWT')) {
            throw new Error(t("generatorExtra.sessionExpired"));
          }
          if (error.message?.includes('402')) {
            throw new Error(t("generatorExtra.notEnoughCredits"));
          }
          throw error;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data.generatedPrompt) {
          themeGeneratedPrompt = data.generatedPrompt;
        }
      } catch (error: any) {
        console.error("Error generating theme prompt:", error);
        toast({
          title: t("common.error"),
          description: error instanceof Error ? error.message : t("genForm.themePromptError"),
          variant: "destructive",
        });
        setIsSubmitting(false);
        setIsGeneratingThemePrompt(false);
        return;
      } finally {
        setIsGeneratingThemePrompt(false);
      }
    }

    // Snapshot current inputs so we can clear the UI immediately without affecting the in-flight generation
    // For theme mode: use topic as original prompt, generated prompt as improved prompt
    const promptSnapshot = themeGeneratedPrompt ? selectedTopic : prompt;
    const originalPromptSnapshot = themeGeneratedPrompt ? selectedTopic : originalPrompt;
    const improvedPromptSnapshot = themeGeneratedPrompt || improvedPromptValue;
    // For bilingual mode, use the two selected languages
    const langsSnapshot = isBilingualMode 
      ? [`${bilingualLang1}+${bilingualLang2}`] // Pass as combined string for bilingual
      : getAllSelectedLanguages();
    const bilingualLanguagesSnapshot = isBilingualMode ? [bilingualLang1, bilingualLang2] : null;
    const siteNamesSnapshot = getAllSiteNames();
    const stylesSnapshot = allStyles.length > 0 ? allStyles : [undefined];
    const aiModelsSnapshot = selectedAiModels.length > 0 ? selectedAiModels : (["senior"] as AiModel[]);
    const websiteTypesSnapshot = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes : (["html"] as WebsiteType[]);
    const imageSourcesSnapshot = selectedImageSources.length > 0 ? selectedImageSources : (["basic"] as ImageSource[]);
    const vipPromptSnapshot = vipPromptValue;
    const isBilingualSnapshot = isBilingualMode;

    // Clear only inputs that should be reset, keep selections (languages, styles, AI models, etc.)
    setSiteNames([]);
    setCurrentSiteNameInput("");
    setPrompt("");
    setExactPhone("");
    setOriginalPrompt(null);
    setImprovedPromptValue(null);
    setVipPromptValue(null);
    // Clear theme selection
    setSelectedCategory("");
    setSelectedTopic("");
    // Keep VIP mode, languages, styles, AI models, website types, and image sources as user selected
    setVipDomain("");
    setVipAddress("");
    setVipPhone("");
    setVipKeywords("");
    setVipBannedWords("");
    setVipTopic("");

    try {
      // Create all generation requests in parallel
      // For bilingual mode, we generate 1 site (with 2 languages), not separate sites per language
      const effectiveLangCount = isBilingualSnapshot ? 1 : langsSnapshot.length;
      const totalCount =
        siteNamesSnapshot.length *
        effectiveLangCount *
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
        
        // Add optimistic item IMMEDIATELY before API call for instant UI feedback
        const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        if (addOptimisticItemRef.current) {
          addOptimisticItemRef.current({
            id: optimisticId,
            site_name: currentSiteName,
            prompt: promptForDisplay,
            language: lang,
            status: "pending",
            ai_model: model,
            website_type: wType,
            image_source: iSource,
            geo: geoToUse || null,
            created_at: new Date().toISOString(),
          });
        }
        
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
          vipPromptSnapshot || undefined,
          exactPhone || undefined,
          bilingualLanguagesSnapshot || undefined, // Pass bilingual languages if in bilingual mode
          bundleImages, // Whether to bundle images into ZIP
          selectedColorScheme // Pass color scheme selection
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
          title: t("genForm.generationsStarted"),
          description: `${t("genForm.generationsLaunched")} ${successCount} ${t("genForm.generations")}${failCount > 0 ? `, ${failCount} ${t("genForm.errors")}` : ""}. ${t("genForm.trackInHistory")}`,
        });
      }
      
      if (failCount > 0 && successCount === 0) {
        const firstError = results.find((r) => !r.success)?.error;
        toast({
          title: t("common.error"),
          description: firstError || t("genForm.noGenerationStarted"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("genForm.unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setGenerationProgress({ completed: 0, total: 0 });
    }
  };

  // Handle manual request (user sends request to admin)
  const handleManualRequest = async () => {
    const siteNames = getAllSiteNames();
    if (siteNames.length === 0) {
      toast({
        title: t("common.error"),
        description: t("genForm.enterSiteName"),
        variant: "destructive",
      });
      return;
    }

    if (!prompt.trim()) {
      toast({
        title: t("common.error"),
        description: t("genForm.enterDescription"),
        variant: "destructive",
      });
      return;
    }

    // Non-admin users need to have a team
    if (!teamPricing) {
      toast({
        title: t("common.error"),
        description: t("genForm.noTeam"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const allLangs = getAllSelectedLanguages();
      const language = allLangs.length > 0 ? allLangs[0] : "uk";
      const websiteType = selectedWebsiteTypes.length > 0 ? selectedWebsiteTypes[0] : "html";
      const aiModel = selectedAiModels.length > 0 ? selectedAiModels[0] : "senior";
      
      // Create manual request records
      for (const siteName of siteNames) {
        const { error } = await supabase.from("generation_history").insert({
          prompt: prompt.trim(),
          improved_prompt: improvedPromptValue || null,
          vip_prompt: vipPromptValue || null,
          site_name: siteName,
          language,
          website_type: websiteType,
          ai_model: aiModel,
          status: "manual_request",
          team_id: teamPricing.teamId,
          user_id: user?.id,
          image_source: "manual"
        });

        if (error) throw error;
      }

      toast({
        title: t("genForm.manualRequestSent"),
        description: t("genForm.manualRequestSentDesc"),
      });

      // Clear inputs
      setSiteNames([]);
      setPrompt("");
      setOriginalPrompt("");
      setImprovedPromptValue("");
      
    } catch (error) {
      console.error("Manual request error:", error);
      toast({
        title: t("common.error"),
        description: error instanceof Error ? error.message : t("common.error"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
                <h1 className="text-sm font-medium">{t("genForm.teamSelection")}</h1>
                <button
                  onClick={() => setShowTeamFilters(!showTeamFilters)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Filter className="h-3 w-3" />
                  <span>{t("genForm.filters")}</span>
                  {showTeamFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              </div>
              
              {/* Collapsible filters */}
              {showTeamFilters && (
                <div className="p-2 border-b border-border bg-muted/30">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-green-500">●</span>
                      <span className="text-muted-foreground">{t("genForm.positive")}: {positiveTeams.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-destructive">●</span>
                      <span className="text-muted-foreground">{t("genForm.negative")}: {negativeTeams.length}</span>
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
                        <span className="text-green-500">●</span> {t("genForm.positive")} ({positiveTeams.length})
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
                          <p className="text-[10px] text-muted-foreground text-center py-2">{t("common.none")}</p>
                        )}
                      </div>
                    </div>
                    {/* Negative balance column */}
                    <div className="space-y-1 lg:col-span-1">
                      <div className="text-[10px] text-muted-foreground font-medium px-1 flex items-center gap-1">
                        <span className="text-destructive">●</span> {t("genForm.negative")} ({negativeTeams.length})
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
                          <p className="text-[10px] text-muted-foreground text-center py-2">{t("common.none")}</p>
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
              <span className="text-sm font-medium">{t("support.newMessage")}</span>
            </div>
            <Textarea 
              placeholder={t("support.messagePlaceholder")}
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
                {t("genForm.sendFeedback")}
              </Button>
            </div>
          </div>

          {/* News section */}
          <div className="border border-border rounded p-3">
            <div className="flex items-center gap-2 mb-3">
              <Newspaper className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t("genForm.news")}</span>
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
                  <span className="text-[9px] text-muted-foreground/60">{t("genForm.newsDate1")}</span>
                  <h3 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary transition-colors">
                    {t("genForm.newsTitle1")}
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    {t("genForm.newsDesc1")}
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
                  <span className="text-[9px] text-muted-foreground/60">{t("genForm.newsDate2")}</span>
                  <h3 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary transition-colors">
                    {t("genForm.newsTitle2")}
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    {t("genForm.newsDesc2")}
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
                  <span className="text-[9px] text-muted-foreground/60">{t("genForm.newsDate3")}</span>
                  <h3 className="text-xs font-medium line-clamp-2 mt-1 group-hover:text-primary transition-colors">
                    {t("genForm.newsTitle3")}
                  </h3>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-1">
                    {t("genForm.newsDesc3")}
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
          <h1 className="text-lg font-medium">{t("generator.title")}</h1>
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
                {t("common.edit")}
              </button>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="border border-border mb-4">
          <div className="p-3 border-b border-border">
            <div className="text-sm font-medium">{t("generator.newGeneration")}</div>
          </div>
          <div className="p-3 space-y-3">
            {/* Site Name + Mode Selection - in one row for admin */}
            {isAdmin && (
              <div className="flex flex-wrap items-end gap-3">
                {/* Site Names - left side */}
                <div className="min-w-[280px] flex-1">
                  <Label htmlFor="siteName" className="text-xs mb-1 block">
                    {t("generator.siteName")} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      id="siteName"
                      placeholder="my-company (можна вставити список)"
                      value={currentSiteNameInput}
                      onChange={(e) => setCurrentSiteNameInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSiteName();
                        }
                      }}
                      onPaste={handleSiteNamePaste}
                      disabled={isImproving}
                      className="h-8 text-sm flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addSiteName}
                      disabled={isImproving || !currentSiteNameInput.trim()}
                      className={`h-8 px-2 ${siteNames.length === 0 && currentSiteNameInput.trim() ? "animate-pulse ring-2 ring-primary/50 bg-primary/10" : ""}`}
                    >
                      <Plus className={`h-4 w-4 ${siteNames.length === 0 && currentSiteNameInput.trim() ? "text-primary" : ""}`} />
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
                    {t("genForm.internalMode")}
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
                    {t("genForm.externalMode")}
                  </button>
                </div>
                
                {adminGenerationMode === "senior_direct" && (
                  <>
                    <Select 
                      value={seniorMode || "none"} 
                      onValueChange={(v) => setSeniorMode(v === "none" ? undefined : v as SeniorMode)} 
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue placeholder={t("genForm.selectService")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none" disabled>{t("genForm.selectService")}</SelectItem>
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
                  {t("generator.siteName")} <span className="text-destructive">*</span>
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

            {/* Description Field with Mode Toggle */}
            <div className="space-y-2">
              {/* Mode Toggle: Manual vs Theme */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  {t("genForm.siteDescription")} <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted">
                  <Button
                    type="button"
                    variant={promptMode === "manual" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPromptMode("manual")}
                    className="h-6 px-2 text-xs"
                    disabled={isImproving || isGeneratingThemePrompt}
                  >
                    ✏️ {t("genForm.promptModeManual")}
                  </Button>
                  <Button
                    type="button"
                    variant={promptMode === "theme" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setPromptMode("theme")}
                    className="h-6 px-2 text-xs"
                    disabled={isImproving || isGeneratingThemePrompt}
                  >
                    🎯 {t("genForm.promptModeTheme")} (+$1)
                  </Button>
                </div>
              </div>

              {/* Theme Selection Mode */}
              {promptMode === "theme" && (
                <div className="p-3 border border-primary/30 bg-primary/5 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Category Select */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t("genForm.selectCategory")}</Label>
                      <Select 
                        value={selectedCategory} 
                        onValueChange={(v) => {
                          setSelectedCategory(v);
                          setSelectedTopic(""); // Reset topic when category changes
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={t("genForm.selectCategory")} />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.keys(TOPIC_CATEGORIES).map((category) => (
                            <SelectItem key={category} value={category}>{category}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Topic Select */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{t("genForm.selectTopic")}</Label>
                      <Select 
                        value={selectedTopic} 
                        onValueChange={setSelectedTopic}
                        disabled={!selectedCategory}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder={selectedCategory ? t("genForm.selectTopic") : t("genForm.selectCategoryFirst")} />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedCategory && TOPIC_CATEGORIES[selectedCategory]?.map((topic) => (
                            <SelectItem key={topic} value={topic}>{topic}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Info about theme mode */}
                  {selectedTopic && (
                    <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <Tag className="h-3.5 w-3.5" />
                      <span>{t("genForm.themeSelected")}: <strong>{selectedTopic}</strong></span>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground text-center">
                    {t("genForm.themePromptCostAuto")}
                  </p>
                </div>
              )}

              {/* Manual Input Mode - Textarea */}
              {(promptMode === "manual" || prompt.trim()) && (
                <>
                  <Textarea
                    ref={promptTextareaRef}
                    placeholder={t("genForm.siteDescriptionPlaceholder")}
                    value={prompt}
                    onChange={(e) => {
                      setPrompt(e.target.value);
                      // Reset improved prompt state when user manually changes prompt
                      if (improvedPromptValue && !isAdmin) {
                        setOriginalPrompt(null);
                        setImprovedPromptValue(null);
                      } else if (improvedPromptValue && isAdmin && e.target.value !== improvedPromptValue) {
                        setOriginalPrompt(null);
                        setImprovedPromptValue(null);
                      }
                    }}
                    className="min-h-[60px] text-sm overflow-hidden"
                    style={{ resize: 'none' }}
                    disabled={isImproving || isGeneratingThemePrompt}
                  />
                  {improvedPromptValue && (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      {t("genForm.promptImprovedInternal")}
                    </div>
                  )}
                </>
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
                    {t("genForm.improvePromptCost")}
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
                  
                  {/* Bilingual mode toggle */}
                  <Button
                    variant={isBilingualMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsBilingualMode(!isBilingualMode);
                      if (!isBilingualMode) {
                        // When activating bilingual mode, clear regular language selection
                        setSelectedLanguages([]);
                        setIsOtherSelected(false);
                        setCustomLanguage("");
                      } else {
                        // When deactivating, clear bilingual languages
                        setBilingualLang1("");
                        setBilingualLang2("");
                      }
                    }}
                    disabled={isImproving || isGeneratingVip}
                    className={`h-7 text-xs px-2 ${isBilingualMode ? "bg-blue-500 hover:bg-blue-600" : ""}`}
                  >
                    <Languages className={`mr-1 h-3 w-3`} />
                    {t("genForm.bilingualMode")} (+$3)
                    {isBilingualMode && <span className="ml-1">✓</span>}
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
                    setVipBannedWords("");
                    setVipTopic("");
                  }}
                  disabled={!prompt.trim()}
                  className="h-7 text-xs px-2"
                >
                  <Trash2 className="mr-1 h-3 w-3" />
                  {t("genForm.clearPrompt")}
                </Button>
              </div>

              {/* Bilingual Mode - Two Language Selection */}
              {isBilingualMode && (
                <div className="p-3 border border-blue-500/50 bg-blue-500/5 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Languages className="h-4 w-4" />
                    <span className="text-sm font-medium">{t("genForm.selectTwoLanguages")}</span>
                    <Badge variant="outline" className="text-blue-600 border-blue-500/50">{t("genForm.bilingualExtra")}</Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* First Language */}
                    <div className="space-y-1.5">
                      <Label className={`text-xs flex items-center gap-1 ${!bilingualLang1 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {t("genForm.bilingualLanguage1")} <span className="text-destructive">*</span>
                      </Label>
                      <Select value={bilingualLang1} onValueChange={setBilingualLang1}>
                        <SelectTrigger className={`h-9 ${!bilingualLang1 ? 'border-destructive/50' : ''}`}>
                          <SelectValue placeholder={t("genForm.selectLanguages")} />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.filter(l => l.value !== bilingualLang2).map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Second Language */}
                    <div className="space-y-1.5">
                      <Label className={`text-xs flex items-center gap-1 ${!bilingualLang2 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {t("genForm.bilingualLanguage2")} <span className="text-destructive">*</span>
                      </Label>
                      <Select value={bilingualLang2} onValueChange={setBilingualLang2}>
                        <SelectTrigger className={`h-9 ${!bilingualLang2 ? 'border-destructive/50' : ''}`}>
                          <SelectValue placeholder={t("genForm.selectLanguages")} />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.filter(l => l.value !== bilingualLang1).map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {bilingualLang1 && bilingualLang2 && (
                    <div className="text-xs text-green-600 flex items-center gap-1">
                      <Languages className="h-3 w-3" />
                      {t("genForm.bilingualReady")}: {languages.find(l => l.value === bilingualLang1)?.label} + {languages.find(l => l.value === bilingualLang2)?.label}
                    </div>
                  )}
                </div>
              )}

              {/* VIP Mode - Language & Geo REQUIRED (shown above VIP fields for better UX) */}
              {isVipMode && (
                <div className="space-y-3">
                  {/* Language & Geo Required Row */}
                  <div className="p-3 border border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">
                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-3">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs font-medium">{t("genForm.requiredVipFields")}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Language Select for VIP */}
                      <div className="space-y-1.5">
                        <Label className={`text-xs flex items-center gap-1 ${selectedLanguages.length === 0 && !isOtherSelected ? 'text-destructive' : 'text-muted-foreground'}`}>
                          <Languages className="h-3 w-3" />
                          {t("genForm.selectLanguageRequired")} <span className="text-destructive">*</span>
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
                                    ? t("genForm.selectLanguages")
                                    : allLangs.length === 1 
                                      ? languages.find(l => l.value === allLangs[0])?.label || allLangs[0]
                                      : `${allLangs.length} ${t("genForm.languages")}`;
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
                                <span className="text-sm">{t("genForm.otherLanguage")}</span>
                              </label>
                              {isOtherSelected && (
                                <Input
                                  placeholder={t("genForm.languageName")}
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
                          {t("genForm.selectGeoRequired")} <span className="text-destructive">*</span>
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
                                      : t("genForm.selectRegion")}
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
                                  <span className="text-xs">{t("genForm.other")}</span>
                                </label>
                                {isOtherGeoSelected && (
                                  <Input
                                    placeholder={t("genForm.enterCustomGeo")}
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
                        <span className="text-sm font-medium">{t("genForm.vipModeTitle")}</span>
                        <Badge variant="outline" className="text-amber-600 border-amber-500/50">+${teamPricing?.vipExtraPrice || 2}{t("genForm.perSite")}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Try to detect topic from description
                          const promptLower = prompt.toLowerCase().trim();
                          let detectedTopic = "";
                          
                          // Match topic keywords from description
                          for (const topic of randomVipTopics) {
                            const topicWords = topic.toLowerCase().split(/\s+/);
                            if (topicWords.some(word => promptLower.includes(word))) {
                              detectedTopic = topic;
                              break;
                            }
                          }
                          
                          // Also check for common keywords in description
                          const topicKeywordMap: Record<string, string> = {
                            // News & Media
                            "news": "News Portal", "новост": "News Portal", "headline": "News Portal", "журнал": "News Portal", 
                            "article": "News Portal", "press": "News Portal", "media": "News Portal", "broadcast": "News Portal",
                            // E-commerce
                            "shop": "E-commerce", "store": "E-commerce", "ecommerce": "E-commerce", "e-commerce": "E-commerce",
                            "магазин": "E-commerce", "buy": "E-commerce", "sell": "E-commerce", "product": "E-commerce",
                            // Education
                            "education": "Education", "learn": "Education", "course": "Education", "school": "Education",
                            "university": "Education", "training": "Education", "tutorial": "Education",
                            // Healthcare
                            "health": "Healthcare", "medical": "Healthcare", "doctor": "Healthcare", "hospital": "Healthcare",
                            "clinic": "Healthcare", "patient": "Healthcare",
                            // Fashion
                            "fashion": "Fashion", "clothing": "Fashion", "style": "Fashion", "wear": "Fashion", "boutique": "Fashion",
                            // Sports
                            "sport": "Sports", "athlete": "Sports", "team": "Sports", "football": "Sports", "basketball": "Sports",
                            // Music
                            "music": "Music", "song": "Music", "album": "Music", "concert": "Music", "artist": "Music",
                            // Art
                            "art": "Art Gallery", "gallery": "Art Gallery", "painting": "Art Gallery", "exhibition": "Art Gallery",
                            // Crypto
                            "crypto": "Crypto", "bitcoin": "Crypto", "blockchain": "Crypto", "nft": "Crypto", "defi": "Crypto",
                            // Marketing
                            "marketing": "Marketing Agency", "seo": "Marketing Agency", "advertising": "Marketing Agency", "brand": "Marketing Agency",
                            // Original topics
                            "game": "Video Games", "gaming": "Video Games", "gamer": "Video Games",
                            "law": "Law Services", "legal": "Law Services", "attorney": "Law Services", "lawyer": "Law Services",
                            "dental": "Dental Care", "dentist": "Dental Care", "teeth": "Dental Care",
                            "real estate": "Real Estate", "property": "Real Estate", "house": "Real Estate", "apartment": "Real Estate",
                            "pet": "Pet Grooming", "dog": "Pet Grooming", "cat": "Pet Grooming", "animal": "Pet Grooming",
                            "car": "Auto Repair", "auto": "Auto Repair", "mechanic": "Auto Repair", "vehicle": "Auto Repair",
                            "fitness": "Fitness Training", "gym": "Fitness Training", "workout": "Fitness Training",
                            "photo": "Photography", "photographer": "Photography", "camera": "Photography",
                            "renovation": "Home Renovation", "remodel": "Home Renovation", "interior": "Home Renovation",
                            "account": "Accounting", "tax": "Accounting", "bookkeep": "Accounting",
                            "travel": "Travel Agency", "vacation": "Travel Agency", "trip": "Travel Agency", "tour": "Travel Agency",
                            "coffee": "Coffee Shop", "cafe": "Coffee Shop", "espresso": "Coffee Shop",
                            "bakery": "Bakery", "bread": "Bakery", "cake": "Bakery", "pastry": "Bakery",
                            "flower": "Flower Delivery", "floral": "Flower Delivery", "bouquet": "Flower Delivery",
                            "software": "IT Consulting", "computer": "IT Consulting", "developer": "IT Consulting",
                            "wedding": "Wedding Planning", "bride": "Wedding Planning", "marry": "Wedding Planning",
                            "restaurant": "Restaurant", "food": "Restaurant", "dining": "Restaurant", "menu": "Restaurant",
                            "spa": "Spa & Wellness", "massage": "Spa & Wellness", "wellness": "Spa & Wellness", "relax": "Spa & Wellness",
                            "plumb": "Plumbing Services", "pipe": "Plumbing Services", "drain": "Plumbing Services",
                            "insurance": "Insurance Agency", "insur": "Insurance Agency", "policy": "Insurance Agency",
                            "hair": "Hair Salon", "salon": "Hair Salon", "stylist": "Hair Salon", "haircut": "Hair Salon",
                            "yoga": "Yoga Studio", "meditation": "Yoga Studio", "mindful": "Yoga Studio",
                            "dealer": "Car Dealership", "dealership": "Car Dealership",
                            "clean": "Cleaning Services", "maid": "Cleaning Services", "housekeep": "Cleaning Services"
                          };
                          
                          if (!detectedTopic) {
                            for (const [keyword, topic] of Object.entries(topicKeywordMap)) {
                              if (promptLower.includes(keyword)) {
                                detectedTopic = topic;
                                break;
                              }
                            }
                          }
                          
                          // IMPORTANT: If prompt exists but no standard topic was detected, 
                          // use the prompt itself as the topic instead of random
                          let topic = detectedTopic;
                          let usePromptAsTopic = false;
                          
                          if (!detectedTopic && promptLower.length > 0) {
                            // Use prompt as topic - capitalize first letter of each word
                            topic = prompt.trim().split(/\s+/).slice(0, 4).map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                            ).join(" ");
                            usePromptAsTopic = true;
                          } else if (!detectedTopic) {
                            // Only use random if prompt is empty
                            topic = randomVipTopics[Math.floor(Math.random() * randomVipTopics.length)];
                          }
                          
                          // Generate domain based on topic and first siteName if available
                          const siteBase = siteNames[0] 
                            ? siteNames[0].toLowerCase().replace(/[^a-z0-9]/g, '')
                            : topic.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15);
                          const randomNum = Math.floor(Math.random() * 900) + 100;
                          const domain = `${siteBase}${randomNum}.com`;
                          
                          // Get geo-specific data - use selected geo or custom geo
                          const effectiveGeo = isOtherGeoSelected && customGeo 
                            ? "default" // For custom geo, use default addresses but we'll customize
                            : (selectedGeo || "default");
                          
                          const addresses = randomVipAddressesByGeo[effectiveGeo] || randomVipAddressesByGeo["default"];
                          
                          let address = addresses[Math.floor(Math.random() * addresses.length)];
                          let phone = generateRealisticPhoneByGeo(effectiveGeo);
                          
                          // If custom geo is set, try to incorporate it into the address
                          if (isOtherGeoSelected && customGeo) {
                            const streetNum = Math.floor(Math.random() * 500) + 1;
                            const streets = ["Main Street", "Oak Avenue", "Business Boulevard", "Commerce Drive", "Central Road"];
                            const street = streets[Math.floor(Math.random() * streets.length)];
                            address = `${streetNum} ${street}, ${customGeo}`;
                          }
                          
                          // Get geo label for display
                          const geoLabel = isOtherGeoSelected && customGeo 
                            ? customGeo 
                            : (selectedGeo ? geoOptions.find(g => g.value === selectedGeo)?.label || selectedGeo : "");
                          
                          // Get language label for context
                          const langValue = selectedLanguages[0] || (isOtherSelected && customLanguage ? customLanguage : "");
                          const langLabel = langValue ? languages.find(l => l.value === langValue)?.label || langValue : "";
                          
                          // Generate keywords based on topic
                          let keywords: string;
                          if (usePromptAsTopic) {
                            // Generate keywords from the prompt description
                            const promptWords = prompt.trim().split(/[\s,;.]+/).filter(w => w.length > 2);
                            const relevantWords = promptWords.slice(0, 6);
                            keywords = relevantWords.length > 0 
                              ? `${relevantWords.join(", ")}, professional services, quality, expert`
                              : "professional services, quality, expert, trusted";
                          } else {
                            keywords = randomVipKeywordsByTopic[topic] || "professional services, quality, expert, trusted";
                          }
                          
                          // Get banned words for the detected/selected topic
                          const bannedWords = usePromptAsTopic 
                            ? defaultBannedWords 
                            : (randomVipBannedWordsByTopic[topic] || defaultBannedWords);
                          
                          // Build final topic with geo context
                          const finalTopic = topic + (geoLabel ? ` in ${geoLabel}` : "");
                          
                          // Only fill empty fields
                          if (!vipDomain.trim()) setVipDomain(domain);
                          if (!vipAddress.trim()) setVipAddress(address);
                          if (!vipPhone.trim()) setVipPhone(phone);
                          if (!vipTopic.trim()) setVipTopic(finalTopic);
                          if (!vipKeywords.trim()) setVipKeywords(keywords);
                          if (!vipBannedWords.trim()) setVipBannedWords(bannedWords);
                        }}
                        className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
                      >
                        <Shuffle className="h-3 w-3 mr-1" />
                        {t("genForm.randomize")}
                      </Button>
                    </div>
                  
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Domain - optional */}
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {t("genForm.domain")}
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
                          {t("genForm.address")} <span className="text-destructive">*</span>
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
                          {t("genForm.phone")} <span className="text-destructive">*</span>
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
                          {t("genForm.topicNiche")}
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
                        {t("genForm.keywords")}
                      </Label>
                      <Input
                        placeholder="keyword1, keyword2, keyword3..."
                        value={vipKeywords}
                        onChange={(e) => setVipKeywords(e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    
                    {/* Banned Words - optional, full width */}
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <X className="h-3 w-3 text-red-500" />
                        {t("genForm.bannedWords")}
                      </Label>
                      <Input
                        placeholder="crypto, free, miracle, profit..."
                        value={vipBannedWords}
                        onChange={(e) => setVipBannedWords(e.target.value)}
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
                            title: t("genForm.vipFieldsRequired"),
                            description: t("genForm.vipFieldsRequiredDesc"),
                            variant: "destructive",
                          });
                          return;
                        }
                        
                        if (!vipAddress || !vipPhone || !prompt.trim()) {
                          return;
                        }
                        
                        setIsGeneratingVip(true);
                        try {
                          // Use siteName from array or from current input field
                          const currentSiteName = siteNames[0] || currentSiteNameInput.trim() || 'mysite';
                          // Generate domain if empty
                          const effectiveDomain = vipDomain.trim() || `${currentSiteName.toLowerCase().replace(/[^a-z0-9]/g, '')}${Math.floor(Math.random() * 900) + 100}.com`;
                          const siteName = currentSiteName;
                          const geoValue = isOtherGeoSelected && customGeo ? customGeo : selectedGeo;
                          const langValue = selectedLanguages[0] || customLanguage || "en";
                          const langLabel = languages.find(l => l.value === langValue)?.label || langValue;
                          const geoLabel = geoOptions.find(g => g.value === geoValue)?.label || geoValue || "International";
                          
                          const { data, error } = await supabase.functions.invoke('generate-vip-prompt', {
                            body: {
                              domain: effectiveDomain,
                              siteName,
                              geo: geoLabel,
                              language: langLabel,
                              address: vipAddress,
                              phone: vipPhone,
                              topic: vipTopic || undefined,
                              description: prompt,
                              keywords: vipKeywords || undefined,
                              bannedWords: vipBannedWords || undefined,
                            }
                          });
                          
                          if (error) throw error;
                          
                          if (data?.vipPrompt) {
                            setVipPromptValue(data.vipPrompt);
                            toast({
                              title: t("genForm.vipPromptGeneratedTitle"),
                              description: t("genForm.vipPromptGeneratedDesc"),
                            });
                          }
                        } catch (error) {
                          console.error("VIP prompt error:", error);
                          toast({
                            title: t("common.error"),
                            description: t("genForm.vipPromptError"),
                            variant: "destructive",
                          });
                        } finally {
                          setIsGeneratingVip(false);
                        }
                      }}
                      disabled={isGeneratingVip || !vipAddress || !vipPhone || !prompt.trim() || (selectedLanguages.length === 0 && !isOtherSelected) || (!selectedGeo && !isOtherGeoSelected)}
                      className="w-full h-8 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                    >
                      {isGeneratingVip ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
                      {t("genForm.generateVipPrompt")}
                    </Button>
                    
                    {vipPromptValue && (
                      <div className="text-xs text-green-600 flex items-center gap-1 mt-2">
                        <Star className="h-3 w-3 fill-current" />
                        {t("genForm.vipPromptReady")}
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
            <div className={`grid grid-cols-1 gap-2 ${isVipMode || isBilingualMode ? 'sm:grid-cols-2' : 'sm:grid-cols-4'}`}>
              {/* Language Multi-Select Dropdown - hide in VIP mode and bilingual mode */}
              {!isVipMode && !isBilingualMode && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("genForm.language")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs">
                      <span className="truncate">
                        {allLanguages.length === 0 
                          ? t("genForm.selectLanguages")
                          : allLanguages.length === 1 
                            ? languages.find(l => l.value === allLanguages[0])?.label || allLanguages[0]
                            : `${allLanguages.length} ${t("genForm.languages")}`}
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
                        <span className="text-sm">{t("genForm.otherLanguage")}</span>
                      </label>
                      {isOtherSelected && (
                        <Input
                          placeholder={t("genForm.languageName")}
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
                <Label className="text-xs text-muted-foreground">{t("genForm.layout")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-8 text-xs">
                      <span className="truncate">
                        {allStyles.length === 0 
                          ? t("genForm.random")
                          : allStyles.length === 1 
                            ? LAYOUT_STYLES.find(s => s.id === allStyles[0])?.name || allStyles[0]
                            : `${allStyles.length} ${t("genForm.styles")}`}
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
                        <span className="text-sm">{t("genForm.otherStyle")}</span>
                      </label>
                      {isOtherStyleSelected && (
                        <Input
                          placeholder={t("genForm.styleName")}
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
                        {t("genForm.resetRandom")}
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Color Scheme Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("genForm.colorScheme")}</Label>
                <Select
                  value={selectedColorScheme}
                  onValueChange={(v) => setSelectedColorScheme(v as ColorScheme)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <Palette className="h-3.5 w-3.5 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_SCHEMES_UI.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        <div className="flex items-center gap-2">
                          <span>{scheme.name}</span>
                          {scheme.colors.length > 0 && (
                            <div className="flex gap-0.5">
                              {scheme.colors.map((color, i) => (
                                <div
                                  key={i}
                                  className="w-3 h-3 rounded-sm border border-border"
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Geo Select - hide in VIP mode */}
              {!isVipMode && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("generator.geo")}</Label>
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
                              : t("genForm.notSelected")}
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
                          <span className="text-xs">{t("genForm.other")}</span>
                        </label>
                        {isOtherGeoSelected && (
                          <Input
                            placeholder={t("genForm.enterCustomGeo")}
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

            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
              {/* AI Model Multi-Select */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("genForm.aiModel")}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between h-9 text-xs">
                      <span className="truncate">
                        {selectedAiModels.length === 0 
                          ? t("genForm.selectAiModel")
                          : selectedAiModels.length === 1 
                            ? (selectedAiModels[0] === "senior" ? "Senior" : "Junior")
                            : `${selectedAiModels.length} ${t("genForm.models")}`}
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
                <Label className="text-xs text-muted-foreground">{t("genForm.websiteType")}</Label>
                <Select 
                  value={selectedWebsiteTypes[0] || "html"} 
                  onValueChange={(value) => selectWebsiteType(value as WebsiteType)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={t("genForm.selectType")} />
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
                <Label className="text-xs text-muted-foreground">{t("genForm.photoSelection")}</Label>
                <Select 
                  value={selectedImageSources[0] || "basic"} 
                  onValueChange={(value) => selectImageSource(value as ImageSource)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={t("genForm.selectAiModel")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">
                      <div className="flex items-center gap-2">
                        <Image className="h-4 w-4 text-gray-500" />
                        <span>{t("genForm.basic")}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="ai">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-violet-500" />
                        <span>{t("genForm.aiSearch")} (+$2)</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bundle Images Toggle */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("genForm.imageBundling")}</Label>
                <div className="flex items-center justify-center gap-3 h-9 px-4 rounded-md border border-input bg-background/50">
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    !bundleImages ? "text-primary" : "text-muted-foreground"
                  )}>
                    🔗 URL
                  </span>
                  <Switch
                    id="bundleImages"
                    checked={bundleImages}
                    onCheckedChange={setBundleImages}
                    className="data-[state=unchecked]:bg-muted-foreground/30"
                  />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    bundleImages ? "text-primary" : "text-muted-foreground"
                  )}>
                    📦 ZIP
                  </span>
                </div>
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
                      title: t("genForm.fillFields"),
                      description: t("genForm.enterNameDescService"),
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
                      const result = await startGeneration(
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
                      if (!result.success) {
                        throw new Error(result.error || t("genForm.couldNotStart"));
                      }
                    }
                    toast({
                      title: t("genForm.generationStarted"),
                      description: `${t("genForm.generationsLaunched")} ${siteNames.length} ${t("genForm.generations")} ${seniorMode}${selectedAdminTeamId ? "" : ` — ${t("genForm.noTeamDebit")}`}`,
                    });
                    // Don't clear inputs — let users start another generation immediately
                  } catch (error) {
                    toast({
                      title: t("common.error"),
                      description: error instanceof Error ? error.message : t("genForm.couldNotStart"),
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
                    {t("genForm.sending")}
                  </>
                ) : (
                  <>
                    <Crown className="mr-1 h-3 w-3" />
                    {t("genForm.launch")} {seniorMode || "Senior"}
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
                  disabled={
                    siteNames.length === 0 || 
                    (promptMode === "theme" ? !selectedTopic : !prompt.trim()) || 
                    (isBilingualMode ? (!bilingualLang1 || !bilingualLang2) : getAllSelectedLanguages().length === 0) || 
                    selectedAiModels.length === 0 || 
                    selectedWebsiteTypes.length === 0 || 
                    selectedImageSources.length === 0 || 
                    (isAdmin ? exceedsCreditLimit : insufficientBalance) || 
                    (isAdmin && !selectedAdminTeamId)
                  }
                  className="h-9 text-sm"
                >
                  {isSubmitting ? (
                    isImproving ? (
                      <>
                        <Sparkles className="mr-1 h-3 w-3 animate-pulse" />
                        {t("genForm.improvingPrompt")}
                      </>
                    ) : (
                      <>
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        {t("genForm.generating")} {generationProgress.total > 0 && `${generationProgress.completed}/${generationProgress.total}`}
                      </>
                    )
                  ) : (
                    <>
                      {t("genForm.generate")} {totalGenerations > 1 ? `(${totalGenerations})` : ""}
                      {teamPricing && (
                        <span className="ml-1 text-xs opacity-80">
                          ${calculateTotalCost().toFixed(2)}
                        </span>
                      )}
                    </>
                  )}
                </Button>

                {/* Manual Request Button - only for non-admins */}
                {!isAdmin && (
                  <Button
                    variant="outline"
                    onClick={handleManualRequest}
                    disabled={siteNames.length === 0 || !prompt.trim() || isSubmitting}
                    className="h-9 text-sm border-purple-500/50 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                    title={t("generator.manualRequestDesc")}
                  >
                    <Hand className="mr-1 h-3 w-3" />
                    {t("generator.manualRequest")}
                  </Button>
                )}

                {/* Preset Management - same row */}
                <Input
                  placeholder={t("genForm.preset")}
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
                  title={t("generatorExtra.clearParams")}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Credit warnings - right side */}
                {insufficientBalance && teamPricing && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t("genForm.insufficientFunds")}: {t("genForm.fundsNeeded")} ${calculateTotalCost().toFixed(2)}, {t("genForm.fundsBalance")} ${teamPricing.balance.toFixed(2)}
                  </p>
                )}
                {isGeneratingOnCredit && teamPricing && !exceedsCreditLimit && (
                  <p className="text-xs text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t("genForm.creditGeneration")}: {t("genForm.fundsNeeded")} ${calculateTotalCost().toFixed(2)}, {t("genForm.fundsBalance")} ${teamPricing.balance.toFixed(2)} ({t("genForm.creditLimit")}: ${selectedTeamCreditLimit.toFixed(2)})
                  </p>
                )}
                {exceedsCreditLimit && teamPricing && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t("genForm.creditLimitExceeded")}: {t("genForm.balance")} ${teamPricing.balance.toFixed(2)}, {t("genForm.fundsNeeded")} ${calculateTotalCost().toFixed(2)}, {t("genForm.creditLimit")} ${selectedTeamCreditLimit.toFixed(2)}
                  </p>
                )}
              </div>
            </div>

            {/* Cost breakdown */}
            {teamPricing && totalGenerations > 0 && (
              <Collapsible open={showCostBreakdown} onOpenChange={setShowCostBreakdown}>
                <div className={`flex items-center justify-between text-xs border p-2 ${wouldExceedLimit ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
                  <span className={wouldExceedLimit ? 'text-destructive' : 'text-muted-foreground'}>
                    {siteNamesCount}×{allLanguages.length}×{styleCount}×{aiModelCount}×{websiteTypeCount}×{imageSourceCount} = <strong className={wouldExceedLimit ? 'text-destructive' : 'text-foreground'}>{totalGenerations}</strong> {t("genForm.sitesCount")} • <strong className="text-foreground">${calculateTotalCost().toFixed(2)}</strong>
                    {activeGenerationsCount > 0 && <span className="ml-2 opacity-70">({t("genForm.activeGenerations")}: {activeGenerationsCount}, {t("genForm.available")}: {availableSlots})</span>}
                    {wouldExceedLimit && ` (${t("genForm.limitExceeded")})`}
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
                          <TableHead className="text-xs py-2 h-auto">{t("genForm.breakdownTable.type")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto">{t("genForm.breakdownTable.model")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto">{t("genForm.breakdownTable.photos")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">{t("genForm.breakdownTable.base")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">+{t("genForm.breakdownTable.aiExtra")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">{t("genForm.breakdownTable.perSite")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">{t("genForm.breakdownTable.count")}</TableHead>
                          <TableHead className="text-xs py-2 h-auto text-right">{t("genForm.breakdownTable.subtotal")}</TableHead>
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
                                {item.imageSource === "ai" ? "AI" : t("genForm.basic")}
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
                          <TableCell colSpan={6} className="py-2 text-right text-xs">{t("genForm.breakdownTable.total")}:</TableCell>
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
                  <span>{t("genForm.generateProgress")}</span>
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

        {/* Active generations only - realtime updates */}
        <GenerationHistory 
          compactMode
          onUsePrompt={(name, desc) => {
            setSiteNames(name ? [name] : []);
            setCurrentSiteNameInput("");
            setPrompt(desc);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onAddOptimistic={handleAddOptimistic}
        />
        
        {/* Lazy-loaded history - manual load, 10 items at a time */}
        <LazyHistorySection 
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
              {t("genForm.orderConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {t("genForm.orderConfirmDesc").replace("{count}", String(totalGenerations))}
              </p>
              {teamPricing && (
                <p className="flex items-center gap-2 text-foreground bg-muted p-2 rounded">
                  <Wallet className="h-4 w-4" />
                  <span>{t("genForm.orderCost")}: <strong>${calculateTotalCost().toFixed(2)}</strong></span>
                  <span className="text-muted-foreground">|</span>
                  <span>{t("genForm.orderBalance")}: <strong>${teamPricing.balance.toFixed(2)}</strong></span>
                </p>
              )}
              <p className="text-amber-600 dark:text-amber-400">
                {t("genForm.orderIrreversible")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("genForm.orderNote")}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("genForm.orderCancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={executeGeneration}>
              {t("genForm.orderConfirm")} ${calculateTotalCost().toFixed(2)}
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
