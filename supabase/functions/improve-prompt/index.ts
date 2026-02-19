import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ GEO NAME MAPPING (Ukrainian/localized → English) ============
const GEO_NAME_MAP: Record<string, string> = {
  // Ukrainian names
  "великобританія": "UK", "болгарія": "Bulgaria", "бельгія": "Belgium", "в'єтнам": "Vietnam",
  "греція": "Greece", "данія": "Denmark", "естонія": "Estonia", "індонезія": "Indonesia",
  "індія": "India", "ірландія": "Ireland", "іспанія": "Spain", "італія": "Italy",
  "канада": "Canada", "латвія": "Latvia", "литва": "Lithuania", "нідерланди": "Netherlands",
  "німеччина": "Germany", "оае": "UAE", "польща": "Poland", "португалія": "Portugal",
  "росія": "Russia", "румунія": "Romania", "словаччина": "Slovakia", "словенія": "Slovenia",
  "сша": "USA", "таїланд": "Thailand", "туреччина": "Turkey", "україна": "Ukraine",
  "угорщина": "Hungary", "фінляндія": "Finland", "франція": "France", "хорватія": "Croatia",
  "чехія": "Czech Republic", "швеція": "Sweden", "японія": "Japan", "казахстан": "Kazakhstan",
  "австрія": "Austria", "швейцарія": "Switzerland", "норвегія": "Norway",
  "австралія": "Australia", "нова зеландія": "New Zealand", "бразилія": "Brazil",
  "мексика": "Mexico", "аргентина": "Argentina", "чилі": "Chile", "сінгапур": "Singapore",
  "гонконг": "Hong Kong", "південна корея": "South Korea", "саудівська аравія": "Saudi Arabia",
  "південна африка": "South Africa", "ізраїль": "Israel",
  // Russian names
  "великобритания": "UK", "болгария": "Bulgaria", "бельгия": "Belgium", "вьетнам": "Vietnam",
  "греция": "Greece", "дания": "Denmark", "эстония": "Estonia", "индонезия": "Indonesia",
  "индия": "India", "ирландия": "Ireland", "испания": "Spain", "италия": "Italy",
  "канада": "Canada", "латвия": "Latvia", "литва": "Lithuania", "нидерланды": "Netherlands",
  "германия": "Germany", "оаэ": "UAE", "польша": "Poland", "португалия": "Portugal",
  "россия": "Russia", "румыния": "Romania", "словакия": "Slovakia", "словения": "Slovenia",
  "таиланд": "Thailand", "турция": "Turkey", "украина": "Ukraine", "венгрия": "Hungary",
  "финляндия": "Finland", "франция": "France", "хорватия": "Croatia", "чехия": "Czech Republic",
  "швеция": "Sweden", "япония": "Japan", "казахстан": "Kazakhstan",
  "австрия": "Austria", "швейцария": "Switzerland", "норвегия": "Norway",
  "австралия": "Australia", "новая зеландия": "New Zealand", "бразилия": "Brazil",
  "мексика": "Mexico", "аргентина": "Argentina", "чили": "Chile", "сингапур": "Singapore",
  "гонконг": "Hong Kong", "южная корея": "South Korea", "саудовская аравия": "Saudi Arabia",
  "южная африка": "South Africa", "израиль": "Israel",
  // English names (passthrough)
  "usa": "USA", "uk": "UK", "canada": "Canada", "germany": "Germany", "france": "France",
  "spain": "Spain", "italy": "Italy", "portugal": "Portugal", "poland": "Poland",
  "netherlands": "Netherlands", "belgium": "Belgium", "austria": "Austria",
  "switzerland": "Switzerland", "ireland": "Ireland", "sweden": "Sweden", "norway": "Norway",
  "denmark": "Denmark", "finland": "Finland", "australia": "Australia", "new zealand": "New Zealand",
  "japan": "Japan", "south korea": "South Korea", "singapore": "Singapore", "hong kong": "Hong Kong",
  "brazil": "Brazil", "mexico": "Mexico", "argentina": "Argentina", "chile": "Chile",
  "india": "India", "uae": "UAE", "saudi arabia": "Saudi Arabia", "south africa": "South Africa",
  "romania": "Romania", "czech republic": "Czech Republic", "hungary": "Hungary",
  "greece": "Greece", "turkey": "Turkey", "israel": "Israel", "kazakhstan": "Kazakhstan",
  "bulgaria": "Bulgaria", "croatia": "Croatia", "slovakia": "Slovakia", "slovenia": "Slovenia",
  "estonia": "Estonia", "latvia": "Latvia", "lithuania": "Lithuania", "vietnam": "Vietnam",
  "indonesia": "Indonesia", "thailand": "Thailand", "russia": "Russia", "ukraine": "Ukraine",
};

function normalizeGeoName(geo: string): string {
  // Strip emoji flags and trim
  const cleaned = geo.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '').trim().toLowerCase();
  return GEO_NAME_MAP[cleaned] || geo;
}

// ============ LANGUAGE NAME MAPPING ============
const LANGUAGE_NAME_MAP: Record<string, string> = {
  "uk": "Ukrainian", "en": "English", "de": "German", "fr": "French", "es": "Spanish",
  "it": "Italian", "pt": "Portuguese", "pl": "Polish", "nl": "Dutch", "ro": "Romanian",
  "cs": "Czech", "sk": "Slovak", "hu": "Hungarian", "bg": "Bulgarian", "hr": "Croatian",
  "sl": "Slovenian", "el": "Greek", "sv": "Swedish", "da": "Danish", "fi": "Finnish",
  "no": "Norwegian", "lt": "Lithuanian", "lv": "Latvian", "et": "Estonian", "ja": "Japanese",
  "ko": "Korean", "zh": "Chinese", "ar": "Arabic", "hi": "Hindi", "th": "Thai",
  "vi": "Vietnamese", "id": "Indonesian", "tr": "Turkish", "ru": "Russian",
  // Full names passthrough
  "ukrainian": "Ukrainian", "english": "English", "german": "German", "french": "French",
  "spanish": "Spanish", "italian": "Italian", "portuguese": "Portuguese", "polish": "Polish",
  "dutch": "Dutch", "romanian": "Romanian", "czech": "Czech", "slovak": "Slovak",
  "hungarian": "Hungarian", "russian": "Russian", "japanese": "Japanese",
  // Ukrainian language names
  "українська": "Ukrainian", "англійська": "English", "німецька": "German", "французька": "French",
  "іспанська": "Spanish", "італійська": "Italian", "португальська": "Portuguese", "польська": "Polish",
  "нідерландська": "Dutch", "румунська": "Romanian", "чеська": "Czech", "словацька": "Slovak",
  "угорська": "Hungarian", "болгарська": "Bulgarian", "хорватська": "Croatian", "словенська": "Slovenian",
  "грецька": "Greek", "шведська": "Swedish", "данська": "Danish", "фінська": "Finnish",
  "норвезька": "Norwegian", "литовська": "Lithuanian", "латвійська": "Latvian", "естонська": "Estonian",
  "японська": "Japanese", "російська": "Russian", "турецька": "Turkish",
  // Russian language names
  "русский": "Russian", "английский": "English", "немецкий": "German", "французский": "French",
  "испанский": "Spanish", "итальянский": "Italian", "португальский": "Portuguese", "польский": "Polish",
};

function normalizeLanguageName(lang: string): string {
  const cleaned = lang.trim().toLowerCase();
  return LANGUAGE_NAME_MAP[cleaned] || lang;
}

// ============ GEO DATA HELPERS ============

const GEO_PHONE_FORMATS: Record<string, { code: string; area: string[]; format: (area: string, num: string) => string }> = {
  "Canada": { code: "+1", area: ["416", "604", "514", "403", "613"], format: (a, n) => `+1 ${a}-${n.slice(0,3)}-${n.slice(3,7)}` },
  "USA": { code: "+1", area: ["212", "310", "312", "415", "305"], format: (a, n) => `+1 ${a}-${n.slice(0,3)}-${n.slice(3,7)}` },
  "UK": { code: "+44", area: ["20", "161", "141", "131", "117"], format: (a, n) => `+44 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Germany": { code: "+49", area: ["30", "89", "40", "69", "221"], format: (a, n) => `+49 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "France": { code: "+33", area: ["1", "4", "6", "9"], format: (a, n) => `+33 ${a} ${n.slice(0,2)} ${n.slice(2,4)} ${n.slice(4,6)} ${n.slice(6,8)}` },
  "Spain": { code: "+34", area: ["91", "93", "96", "95"], format: (a, n) => `+34 ${a} ${n.slice(0,3)} ${n.slice(3,6)}` },
  "Italy": { code: "+39", area: ["02", "06", "011", "055"], format: (a, n) => `+39 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Portugal": { code: "+351", area: ["21", "22", "91", "93"], format: (a, n) => `+351 ${a} ${n.slice(0,3)} ${n.slice(3,6)}` },
  "Poland": { code: "+48", area: ["22", "12", "71", "61"], format: (a, n) => `+48 ${a} ${n.slice(0,3)} ${n.slice(3,5)} ${n.slice(5,7)}` },
  "Netherlands": { code: "+31", area: ["20", "10", "70", "30"], format: (a, n) => `+31 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Belgium": { code: "+32", area: ["2", "3", "9", "4"], format: (a, n) => `+32 ${a} ${n.slice(0,3)} ${n.slice(3,5)} ${n.slice(5,7)}` },
  "Austria": { code: "+43", area: ["1", "662", "512", "316"], format: (a, n) => `+43 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Switzerland": { code: "+41", area: ["44", "22", "31", "61"], format: (a, n) => `+41 ${a} ${n.slice(0,3)} ${n.slice(3,5)} ${n.slice(5,7)}` },
  "Ireland": { code: "+353", area: ["1", "21", "61", "91"], format: (a, n) => `+353 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Sweden": { code: "+46", area: ["8", "31", "40", "90"], format: (a, n) => `+46 ${a} ${n.slice(0,3)} ${n.slice(3,5)} ${n.slice(5,7)}` },
  "Norway": { code: "+47", area: ["22", "55", "73"], format: (a, n) => `+47 ${a} ${n.slice(0,2)} ${n.slice(2,4)} ${n.slice(4,6)}` },
  "Denmark": { code: "+45", area: [""], format: (_, n) => `+45 ${n.slice(0,2)} ${n.slice(2,4)} ${n.slice(4,6)} ${n.slice(6,8)}` },
  "Finland": { code: "+358", area: ["9", "2", "3", "5"], format: (a, n) => `+358 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Australia": { code: "+61", area: ["2", "3", "7", "8"], format: (a, n) => `+61 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "New Zealand": { code: "+64", area: ["9", "4", "3", "7"], format: (a, n) => `+64 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Japan": { code: "+81", area: ["3", "6", "52", "11"], format: (a, n) => `+81 ${a}-${n.slice(0,4)}-${n.slice(4,8)}` },
  "South Korea": { code: "+82", area: ["2", "51", "53", "42"], format: (a, n) => `+82 ${a}-${n.slice(0,4)}-${n.slice(4,8)}` },
  "Singapore": { code: "+65", area: [""], format: (_, n) => `+65 ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Hong Kong": { code: "+852", area: [""], format: (_, n) => `+852 ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Brazil": { code: "+55", area: ["11", "21", "31", "41"], format: (a, n) => `+55 ${a} ${n.slice(0,5)}-${n.slice(5,9)}` },
  "Mexico": { code: "+52", area: ["55", "33", "81", "664"], format: (a, n) => `+52 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "Argentina": { code: "+54", area: ["11", "351", "261", "341"], format: (a, n) => `+54 ${a} ${n.slice(0,4)}-${n.slice(4,8)}` },
  "Chile": { code: "+56", area: ["2", "32", "41", "51"], format: (a, n) => `+56 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "India": { code: "+91", area: ["11", "22", "33", "80"], format: (a, n) => `+91 ${a} ${n.slice(0,4)} ${n.slice(4,8)}` },
  "UAE": { code: "+971", area: ["4", "2", "6", "7"], format: (a, n) => `+971 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Saudi Arabia": { code: "+966", area: ["11", "12", "13", "14"], format: (a, n) => `+966 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "South Africa": { code: "+27", area: ["11", "21", "31", "12"], format: (a, n) => `+27 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Romania": { code: "+40", area: ["21", "31", "264", "256"], format: (a, n) => `+40 ${a} ${n.slice(0,3)} ${n.slice(3,6)}` },
  "Czech Republic": { code: "+420", area: ["2", "5", "3", "4"], format: (a, n) => `+420 ${a}${n.slice(0,2)} ${n.slice(2,5)} ${n.slice(5,8)}` },
  "Hungary": { code: "+36", area: ["1", "20", "30", "70"], format: (a, n) => `+36 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Greece": { code: "+30", area: ["21", "231", "261", "251"], format: (a, n) => `+30 ${a} ${n.slice(0,3)} ${n.slice(3,7)}` },
  "Turkey": { code: "+90", area: ["212", "216", "312", "232"], format: (a, n) => `+90 ${a} ${n.slice(0,3)} ${n.slice(3,5)} ${n.slice(5,7)}` },
  "Israel": { code: "+972", area: ["2", "3", "4", "8"], format: (a, n) => `+972 ${a}-${n.slice(0,3)}-${n.slice(3,7)}` },
  "Kazakhstan": { code: "+7", area: ["701", "702", "705", "707", "747", "771", "775"], format: (a, n) => `+7 ${a} ${n.slice(0,3)} ${n.slice(3,5)} ${n.slice(5,7)}` },
};

const GEO_ADDRESS_DATA: Record<string, { cities: { name: string; region: string; postal: string }[]; streets: string[] }> = {
  "Canada": {
    cities: [
      { name: "Toronto", region: "ON", postal: "M5V" },
      { name: "Vancouver", region: "BC", postal: "V6B" },
      { name: "Montreal", region: "QC", postal: "H3B" },
      { name: "Calgary", region: "AB", postal: "T2P" }
    ],
    streets: ["Bay Street", "King Street West", "Granville Street", "Saint-Catherine Street", "Stephen Avenue"]
  },
  "USA": {
    cities: [
      { name: "New York", region: "NY", postal: "10001" },
      { name: "Los Angeles", region: "CA", postal: "90001" },
      { name: "Chicago", region: "IL", postal: "60601" },
      { name: "Miami", region: "FL", postal: "33101" }
    ],
    streets: ["Broadway", "Main Street", "Oak Avenue", "Sunset Boulevard", "Market Street"]
  },
  "UK": {
    cities: [
      { name: "London", region: "England", postal: "EC1A" },
      { name: "Manchester", region: "England", postal: "M1" },
      { name: "Birmingham", region: "England", postal: "B1" },
      { name: "Edinburgh", region: "Scotland", postal: "EH1" }
    ],
    streets: ["High Street", "Oxford Street", "King's Road", "Victoria Street", "Church Lane"]
  },
  "Germany": {
    cities: [
      { name: "Berlin", region: "Berlin", postal: "10115" },
      { name: "Munich", region: "Bavaria", postal: "80331" },
      { name: "Hamburg", region: "Hamburg", postal: "20095" },
      { name: "Frankfurt", region: "Hesse", postal: "60311" }
    ],
    streets: ["Hauptstraße", "Berliner Straße", "Bahnhofstraße", "Schillerstraße", "Goethestraße"]
  },
  "France": {
    cities: [
      { name: "Paris", region: "Île-de-France", postal: "75001" },
      { name: "Lyon", region: "Auvergne-Rhône-Alpes", postal: "69001" },
      { name: "Marseille", region: "Provence-Alpes-Côte d'Azur", postal: "13001" },
      { name: "Nice", region: "Provence-Alpes-Côte d'Azur", postal: "06000" }
    ],
    streets: ["Rue de la Paix", "Avenue des Champs-Élysées", "Boulevard Saint-Germain", "Rue du Commerce", "Avenue Victor Hugo"]
  },
  "Spain": {
    cities: [
      { name: "Madrid", region: "Community of Madrid", postal: "28001" },
      { name: "Barcelona", region: "Catalonia", postal: "08001" },
      { name: "Valencia", region: "Valencian Community", postal: "46001" },
      { name: "Seville", region: "Andalusia", postal: "41001" }
    ],
    streets: ["Calle Mayor", "Gran Vía", "Paseo de la Castellana", "Rambla de Catalunya", "Avenida de la Constitución"]
  },
  "Italy": {
    cities: [
      { name: "Rome", region: "Lazio", postal: "00100" },
      { name: "Milan", region: "Lombardy", postal: "20121" },
      { name: "Florence", region: "Tuscany", postal: "50121" },
      { name: "Venice", region: "Veneto", postal: "30121" }
    ],
    streets: ["Via Roma", "Corso Vittorio Emanuele", "Via Nazionale", "Via del Corso", "Piazza del Duomo"]
  },
  "Portugal": {
    cities: [
      { name: "Lisbon", region: "Lisbon", postal: "1100" },
      { name: "Porto", region: "Porto", postal: "4000" },
      { name: "Faro", region: "Algarve", postal: "8000" }
    ],
    streets: ["Avenida da Liberdade", "Rua Augusta", "Rua de Santa Catarina", "Praça do Comércio"]
  },
  "Poland": {
    cities: [
      { name: "Warsaw", region: "Masovian", postal: "00-001" },
      { name: "Krakow", region: "Lesser Poland", postal: "30-001" },
      { name: "Wroclaw", region: "Lower Silesian", postal: "50-001" }
    ],
    streets: ["ul. Marszałkowska", "ul. Floriańska", "ul. Świdnicka", "Al. Jerozolimskie"]
  },
  "Netherlands": {
    cities: [
      { name: "Amsterdam", region: "North Holland", postal: "1012" },
      { name: "Rotterdam", region: "South Holland", postal: "3011" },
      { name: "The Hague", region: "South Holland", postal: "2511" }
    ],
    streets: ["Damrak", "Kalverstraat", "Coolsingel", "Lange Voorhout"]
  },
  "Australia": {
    cities: [
      { name: "Sydney", region: "NSW", postal: "2000" },
      { name: "Melbourne", region: "VIC", postal: "3000" },
      { name: "Brisbane", region: "QLD", postal: "4000" }
    ],
    streets: ["George Street", "Collins Street", "Queen Street", "Pitt Street"]
  },
  "Romania": {
    cities: [
      { name: "Bucharest", region: "Bucharest", postal: "010011" },
      { name: "Cluj-Napoca", region: "Cluj", postal: "400001" },
      { name: "Timișoara", region: "Timiș", postal: "300001" }
    ],
    streets: ["Calea Victoriei", "Bulevardul Unirii", "Strada Lipscani", "Bulevardul Eroilor"]
  },
  "Israel": {
    cities: [
      { name: "Tel Aviv", region: "Tel Aviv District", postal: "6100000" },
      { name: "Jerusalem", region: "Jerusalem District", postal: "9100000" },
      { name: "Haifa", region: "Haifa District", postal: "3100000" },
      { name: "Beer Sheva", region: "Southern District", postal: "8400000" },
      { name: "Netanya", region: "Central District", postal: "4210000" },
      { name: "Herzliya", region: "Tel Aviv District", postal: "4610000" }
    ],
    streets: ["Herzl Street", "Rothschild Boulevard", "Ben Yehuda Street", "Dizengoff Street", "Allenby Street", "King George Street", "Ibn Gabirol Street", "HaYarkon Street"]
  },
  "Kazakhstan": {
    cities: [
      { name: "Almaty", region: "Almaty", postal: "050000" },
      { name: "Astana", region: "Astana", postal: "010000" },
      { name: "Shymkent", region: "Turkestan", postal: "160000" },
      { name: "Karaganda", region: "Karaganda", postal: "100000" }
    ],
    streets: ["Dostyk Avenue", "Abai Avenue", "Al-Farabi Avenue", "Tole Bi Street", "Nazarbayev Avenue", "Kabanbay Batyr Avenue"]
  }
};

const INDUSTRY_MAPPING: Record<string, { palette: { name: string; hex: string }[]; jsonLd: string; tone: string[] }> = {
  "IT": { palette: [{ name: "Deep Blue", hex: "#0d4f8b" }, { name: "Steel Gray", hex: "#4a5568" }, { name: "Tech Cyan", hex: "#0891b2" }], jsonLd: "ITService", tone: ["Technical", "Innovative", "Reliable", "Advanced"] },
  "Tech": { palette: [{ name: "Deep Blue", hex: "#0d4f8b" }, { name: "Steel Gray", hex: "#4a5568" }, { name: "Tech Cyan", hex: "#0891b2" }], jsonLd: "ITService", tone: ["Technical", "Innovative", "Reliable", "Advanced"] },
  "Software": { palette: [{ name: "Deep Blue", hex: "#0d4f8b" }, { name: "Steel Gray", hex: "#4a5568" }, { name: "Tech Cyan", hex: "#0891b2" }], jsonLd: "ITService", tone: ["Technical", "Innovative", "Reliable", "Advanced"] },
  "Health": { palette: [{ name: "Healing Green", hex: "#2d8f5e" }, { name: "Calm Teal", hex: "#0d9488" }, { name: "Pure White", hex: "#f0fdf4" }], jsonLd: "MedicalBusiness", tone: ["Caring", "Professional", "Trusted", "Compassionate"] },
  "Medical": { palette: [{ name: "Healing Green", hex: "#2d8f5e" }, { name: "Calm Teal", hex: "#0d9488" }, { name: "Pure White", hex: "#f0fdf4" }], jsonLd: "MedicalBusiness", tone: ["Caring", "Professional", "Trusted", "Compassionate"] },
  "Wellness": { palette: [{ name: "Healing Green", hex: "#2d8f5e" }, { name: "Calm Teal", hex: "#0d9488" }, { name: "Pure White", hex: "#f0fdf4" }], jsonLd: "HealthAndBeautyBusiness", tone: ["Holistic", "Balanced", "Natural", "Nurturing"] },
  "Finance": { palette: [{ name: "Midnight Navy", hex: "#1a365d" }, { name: "Gold Accent", hex: "#d69e2e" }, { name: "Silver", hex: "#a0aec0" }], jsonLd: "FinancialService", tone: ["Strategic", "Dependable", "Expert", "Trustworthy"] },
  "Banking": { palette: [{ name: "Midnight Navy", hex: "#1a365d" }, { name: "Gold Accent", hex: "#d69e2e" }, { name: "Silver", hex: "#a0aec0" }], jsonLd: "FinancialService", tone: ["Strategic", "Dependable", "Expert", "Trustworthy"] },
  "Beauty": { palette: [{ name: "Rose Pink", hex: "#e8507b" }, { name: "Soft Lavender", hex: "#d6bcfa" }, { name: "Cream", hex: "#fdf2f8" }], jsonLd: "BeautySalon", tone: ["Elegant", "Modern", "Luxurious", "Sophisticated"] },
  "Cosmetics": { palette: [{ name: "Rose Pink", hex: "#e8507b" }, { name: "Soft Lavender", hex: "#d6bcfa" }, { name: "Cream", hex: "#fdf2f8" }], jsonLd: "BeautySalon", tone: ["Elegant", "Modern", "Luxurious", "Sophisticated"] },
  "Legal": { palette: [{ name: "Corporate Blue", hex: "#234e70" }, { name: "Brass", hex: "#b7791f" }, { name: "Slate", hex: "#64748b" }], jsonLd: "LegalService", tone: ["Authoritative", "Trustworthy", "Professional", "Decisive"] },
  "Law": { palette: [{ name: "Corporate Blue", hex: "#234e70" }, { name: "Brass", hex: "#b7791f" }, { name: "Slate", hex: "#64748b" }], jsonLd: "LegalService", tone: ["Authoritative", "Trustworthy", "Professional", "Decisive"] },
  "Food": { palette: [{ name: "Warm Orange", hex: "#e67e22" }, { name: "Fresh Green", hex: "#22c55e" }, { name: "Cream", hex: "#fef3c7" }], jsonLd: "Restaurant", tone: ["Appetizing", "Welcoming", "Fresh", "Authentic"] },
  "Restaurant": { palette: [{ name: "Warm Orange", hex: "#e67e22" }, { name: "Fresh Green", hex: "#22c55e" }, { name: "Cream", hex: "#fef3c7" }], jsonLd: "Restaurant", tone: ["Appetizing", "Welcoming", "Fresh", "Authentic"] },
  "Education": { palette: [{ name: "Academic Blue", hex: "#2563eb" }, { name: "Warm Yellow", hex: "#f59e0b" }, { name: "Clean White", hex: "#f8fafc" }], jsonLd: "EducationalOrganization", tone: ["Inspiring", "Knowledgeable", "Supportive", "Progressive"] },
  "Learning": { palette: [{ name: "Academic Blue", hex: "#2563eb" }, { name: "Warm Yellow", hex: "#f59e0b" }, { name: "Clean White", hex: "#f8fafc" }], jsonLd: "EducationalOrganization", tone: ["Inspiring", "Knowledgeable", "Supportive", "Progressive"] },
  "Real Estate": { palette: [{ name: "Elegant Charcoal", hex: "#374151" }, { name: "Gold", hex: "#ca8a04" }, { name: "Warm Beige", hex: "#fef3c7" }], jsonLd: "RealEstateAgent", tone: ["Professional", "Trustworthy", "Sophisticated", "Reliable"] },
  "Property": { palette: [{ name: "Elegant Charcoal", hex: "#374151" }, { name: "Gold", hex: "#ca8a04" }, { name: "Warm Beige", hex: "#fef3c7" }], jsonLd: "RealEstateAgent", tone: ["Professional", "Trustworthy", "Sophisticated", "Reliable"] },
  "Travel": { palette: [{ name: "Sky Blue", hex: "#0ea5e9" }, { name: "Sunset Orange", hex: "#f97316" }, { name: "Sand", hex: "#fef3c7" }], jsonLd: "TravelAgency", tone: ["Adventurous", "Exciting", "Inspiring", "Welcoming"] },
  "Tourism": { palette: [{ name: "Sky Blue", hex: "#0ea5e9" }, { name: "Sunset Orange", hex: "#f97316" }, { name: "Sand", hex: "#fef3c7" }], jsonLd: "TravelAgency", tone: ["Adventurous", "Exciting", "Inspiring", "Welcoming"] },
  "Fitness": { palette: [{ name: "Energetic Red", hex: "#dc2626" }, { name: "Power Black", hex: "#171717" }, { name: "Steel", hex: "#a1a1aa" }], jsonLd: "SportsActivityLocation", tone: ["Energetic", "Motivating", "Strong", "Dynamic"] },
  "Gym": { palette: [{ name: "Energetic Red", hex: "#dc2626" }, { name: "Power Black", hex: "#171717" }, { name: "Steel", hex: "#a1a1aa" }], jsonLd: "SportsActivityLocation", tone: ["Energetic", "Motivating", "Strong", "Dynamic"] },
  "Sports": { palette: [{ name: "Energetic Red", hex: "#dc2626" }, { name: "Power Black", hex: "#171717" }, { name: "Steel", hex: "#a1a1aa" }], jsonLd: "SportsActivityLocation", tone: ["Energetic", "Motivating", "Strong", "Dynamic"] },
  "Marketing": { palette: [{ name: "Creative Purple", hex: "#7c3aed" }, { name: "Hot Pink", hex: "#ec4899" }, { name: "Light", hex: "#faf5ff" }], jsonLd: "ProfessionalService", tone: ["Creative", "Strategic", "Bold", "Results-Driven"] },
  "Advertising": { palette: [{ name: "Creative Purple", hex: "#7c3aed" }, { name: "Hot Pink", hex: "#ec4899" }, { name: "Light", hex: "#faf5ff" }], jsonLd: "ProfessionalService", tone: ["Creative", "Strategic", "Bold", "Results-Driven"] },
  "Construction": { palette: [{ name: "Safety Orange", hex: "#ea580c" }, { name: "Concrete Gray", hex: "#6b7280" }, { name: "Yellow", hex: "#facc15" }], jsonLd: "GeneralContractor", tone: ["Reliable", "Strong", "Professional", "Experienced"] },
  "Building": { palette: [{ name: "Safety Orange", hex: "#ea580c" }, { name: "Concrete Gray", hex: "#6b7280" }, { name: "Yellow", hex: "#facc15" }], jsonLd: "GeneralContractor", tone: ["Reliable", "Strong", "Professional", "Experienced"] },
  "Automotive": { palette: [{ name: "Racing Red", hex: "#b91c1c" }, { name: "Carbon Black", hex: "#18181b" }, { name: "Chrome", hex: "#d4d4d8" }], jsonLd: "AutoDealer", tone: ["Powerful", "Precision", "Quality", "Performance"] },
  "Cars": { palette: [{ name: "Racing Red", hex: "#b91c1c" }, { name: "Carbon Black", hex: "#18181b" }, { name: "Chrome", hex: "#d4d4d8" }], jsonLd: "AutoDealer", tone: ["Powerful", "Precision", "Quality", "Performance"] },
  "Maritime": { palette: [{ name: "Deep Sea Blue", hex: "#000080" }, { name: "Navigational White", hex: "#f8fafc" }, { name: "Compass Brass", hex: "#b7791f" }], jsonLd: "MarineService", tone: ["Strategic", "Nautical", "Dependable", "Advanced"] },
  "Shipping": { palette: [{ name: "Deep Sea Blue", hex: "#000080" }, { name: "Navigational White", hex: "#f8fafc" }, { name: "Compass Brass", hex: "#b7791f" }], jsonLd: "MarineService", tone: ["Strategic", "Nautical", "Dependable", "Advanced"] },
  "Logistics": { palette: [{ name: "Industrial Blue", hex: "#1e40af" }, { name: "Safety Orange", hex: "#ea580c" }, { name: "Steel", hex: "#71717a" }], jsonLd: "ProfessionalService", tone: ["Efficient", "Reliable", "Global", "Precise"] },
  "Default": { palette: [{ name: "Professional Blue", hex: "#3b82f6" }, { name: "Neutral Gray", hex: "#6b7280" }, { name: "Clean White", hex: "#f9fafb" }], jsonLd: "LocalBusiness", tone: ["Professional", "Trustworthy", "Modern", "Reliable"] }
// NOTE: Default palette is intentionally kept as reference only — improve-prompt must generate UNIQUE palette per industry
};

function generateRandomDigits(count: number): string {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 10)).join('');
}

function generatePhoneByGeo(geo: string): string {
  const geoData = GEO_PHONE_FORMATS[geo] || GEO_PHONE_FORMATS["USA"];
  const area = geoData.area[Math.floor(Math.random() * geoData.area.length)];
  const number = generateRandomDigits(8);
  return geoData.format(area, number);
}

function generateAddressByGeo(geo: string): string {
  const geoData = GEO_ADDRESS_DATA[geo] || GEO_ADDRESS_DATA["USA"];
  const city = geoData.cities[Math.floor(Math.random() * geoData.cities.length)];
  const street = geoData.streets[Math.floor(Math.random() * geoData.streets.length)];
  const number = Math.floor(Math.random() * 500) + 1;
  
  if (geo === "Canada") {
    return `${number} ${street}, ${city.name}, ${city.region} ${city.postal} ${generateRandomDigits(3)}`;
  } else if (geo === "USA") {
    return `${number} ${street}, ${city.name}, ${city.region} ${city.postal}`;
  } else if (geo === "UK") {
    return `${number} ${street}, ${city.name} ${city.postal} ${generateRandomDigits(1)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
  } else if (geo === "Germany" || geo === "France" || geo === "Spain" || geo === "Italy" || geo === "Portugal") {
    return `${street} ${number}, ${city.postal} ${city.name}`;
  } else if (geo === "Poland") {
    return `${street} ${number}, ${city.postal} ${city.name}`;
  } else if (geo === "Netherlands") {
    return `${street} ${number}, ${city.postal} ${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${city.name}`;
  } else if (geo === "Australia") {
    return `${number} ${street}, ${city.name} ${city.region} ${city.postal}`;
  } else if (geo === "Romania") {
    return `${street} ${number}, ${city.postal} ${city.name}`;
  } else if (geo === "Israel") {
    return `${street} ${number}, ${city.name} ${city.postal}, Israel`;
  } else if (geo === "Kazakhstan") {
    return `${street} ${number}, ${city.postal} ${city.name}, Kazakhstan`;
  }
  
  return `${number} ${street}, ${city.name}, ${city.region} ${city.postal}`;
}

function detectIndustry(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  const keywords: Record<string, string[]> = {
    "IT": ["it ", "software", "програмування", "programming", "web", "веб", "app", "digital", "tech", "code", "developer", "розробка"],
    "Health": ["health", "здоров", "медицин", "medical", "clinic", "клініка", "doctor", "лікар", "hospital", "wellness", "therapy", "терапі"],
    "Finance": ["фінанс", "finance", "bank", "банк", "investment", "інвест", "trading", "трейдинг", "accounting", "бухгалтер"],
    "Beauty": ["краса", "beauty", "salon", "салон", "cosmetic", "косметик", "spa", "massage", "манікюр", "manicure", "візаж", "makeup"],
    "Legal": ["юрид", "legal", "law", "адвокат", "lawyer", "attorney", "нотаріус", "notary", "право"],
    "Food": ["їжа", "food", "restaurant", "ресторан", "cafe", "кафе", "catering", "кейтерин", "cook", "кухар", "кулінар", "culinary"],
    "Education": ["освіта", "education", "course", "курс", "training", "тренінг", "school", "школа", "learn", "навчан"],
    "Real Estate": ["нерухом", "real estate", "property", "квартир", "apartment", "house", "будинок", "ріелтор", "realtor"],
    "Travel": ["travel", "подорож", "tourism", "туризм", "hotel", "готель", "vacation", "відпустка", "trip"],
    "Fitness": ["fitness", "фітнес", "gym", "спортзал", "sport", "спорт", "yoga", "йога", "workout", "тренуван"],
    "Marketing": ["marketing", "маркетин", "advertis", "реклам", "seo", "smm", "pr ", "branding", "бренд"],
    "Construction": ["будівн", "construct", "ремонт", "repair", "architect", "архітект", "design interior", "дизайн інтер"],
    "Automotive": ["auto", "авто", "car", "машин", "vehicle", "транспорт", "garage", "гараж"],
    "Maritime": ["maritime", "морськ", "ship", "корабел", "fleet", "флот", "naval", "навігац", "navigation"],
    "Logistics": ["logistics", "логіст", "transport", "транспорт", "delivery", "доставк", "shipping", "warehouse", "склад"]
  };
  
  for (const [industry, terms] of Object.entries(keywords)) {
    if (terms.some(term => promptLower.includes(term))) {
      return industry;
    }
  }
  return "Default";
}

function getIndustryData(industry: string) {
  return INDUSTRY_MAPPING[industry] || INDUSTRY_MAPPING["Default"];
}

// Normalize duplicate country code patterns
const normalizeDuplicateCountryCodes = (text: string) => {
  let out = text;
  out = out.replace(/\+(\d{1,3})[\s\-]*?(?:\(0\)[\s\-]*?)?\+[\s\-]*?\1\b/g, (_m, code) => `+${code}`);
  out = out.replace(/\+(\d{1,3})[\s\-]*?(?:\(0\)[\s\-]*?)?\b\1\b/g, (_m, code) => `+${code}`);
  out = out.replace(/\+(\d{1,3})\1(\d{6,})\b/g, (_m, code, rest) => `+${code}${rest}`);
  return out;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, geo, phone, language, siteName } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!prompt || prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Improving prompt:", prompt.substring(0, 100) + "...");
    console.log("Geo:", geo || "not specified", "Phone:", phone || "not specified", "Language:", language || "not specified");

    // Normalize geo name from Ukrainian/Russian to English
    const normalizedGeo = geo ? normalizeGeoName(geo) : "USA";
    
    // Normalize language
    const normalizedLanguage = language ? normalizeLanguageName(language) : null;

    // Detect industry and get data
    const industry = detectIndustry(prompt);
    const industryData = getIndustryData(industry);
    
    // Generate geo-based data
    const generatedPhone = phone || generatePhoneByGeo(normalizedGeo);
    const generatedAddress = generateAddressByGeo(normalizedGeo);
    const paletteString = industryData.palette.map(c => `${c.name} (${c.hex})`).join(", ");

    const languageInstruction = normalizedLanguage 
      ? `\n\n⚠️ LANGUAGE — ABSOLUTE PRIORITY ⚠️\nThe ENTIRE brief MUST be written in ${normalizedLanguage}. ALL text content — company name variations, taglines, descriptions, section names, audience descriptions — MUST be in ${normalizedLanguage}. This is NON-NEGOTIABLE. Do NOT use English unless the language IS English. The Language field must say: ${normalizedLanguage}.`
      : `\n\nWrite in the same language as the input prompt.`;

    // Use actual site name/domain if provided
    const domainInstruction = siteName 
      ? `\n\n⚠️ SITE NAME / DOMAIN — MANDATORY ⚠️\nThe domain in the header MUST be "${siteName}". The Company Name should be derived from or related to "${siteName}" — do NOT invent a completely unrelated name. If "${siteName}" looks like a domain (e.g. "mysite.com"), use it as-is. If it's just a name, create a matching .com domain from it. This is NON-NEGOTIABLE.`
      : '';

    const systemPrompt = `You are an expert website brief writer. Your task is to create a STRUCTURED, COMPACT website brief.${languageInstruction}${domainInstruction}

OUTPUT FORMAT (follow EXACTLY):

${siteName || "[creative-domain].com"} ([Industry Type])

Company Name: ${siteName ? `[Name based on "${siteName}"]` : "[Creative Business Name]"}
Geo: ${normalizedGeo}
Language: ${normalizedLanguage || "Auto-detect from prompt"}
Industry: [Industry Type]
Core Theme: [One sentence describing what the company does]

1. Company Overview
[2-3 sentences about what the company does, their specialization, and unique value proposition]

2. Tone & Editorial Identity
Tone: ${industryData.tone.join(", ")}
Audience: [Specific target audience - be detailed]
Principles: [4-5 core business principles]

3. Website Architecture
index.html: Hero "[Catchy tagline]"; [Section 1: specific name]; [Section 2: specific name]; [Section 3: specific name]; [CTA Section]
[service-page].html: [Hero]; [Section 1]; [Section 2]; [Section 3]
[about-page].html: [Hero]; [Team Section]; [History/Values]; [Achievements]
[resources-page].html: [Hero]; [Category 1]; [Category 2]; [Featured Items]
contact.html: Hero; Contact Form; Location: ${generatedAddress}; Phone: ${generatedPhone}; Working Hours

4. Visual Direction
Palette: ${paletteString}
Imagery: [4-5 specific image types relevant to this industry]

5. Technical & SEO
SEO: "[keyword1]", "[keyword2]", "[keyword3]", "[keyword4]"
JSON-LD: ${industryData.jsonLd}

6. Keywords & Restrictions
Keywords: [8-12 industry-specific keywords]
Restrictions: Do not use: gratuit, miracle, free, profit, money, price, guarantee, 100%, crypto, health claims

⚠️ TOPIC — ABSOLUTE PRIORITY ⚠️
The brief MUST be about the EXACT topic/niche described in the user prompt. Do NOT change, reinterpret, or substitute the topic. If the user says "cleaning" — the site is about cleaning. If the user says "dental care" — the site is about dental care. NEVER generate a brief about a different industry than what the user specified. This is NON-NEGOTIABLE.

⚠️ COLOR PALETTE — MANDATORY UNIQUENESS ⚠️
- DO NOT use #3b82f6 (generic blue) as the primary color — it is BANNED as a default
- Generate a UNIQUE palette that reflects the specific industry and brand personality
- Florists get warm pinks/greens, lawyers get dark navy/brass, restaurants get warm oranges, fitness gets energetic reds
- The palette provided above is industry-specific — USE IT as the base
- Never output the same generic blue-gray-white palette regardless of business type

CRITICAL RULES:
- PHONE NUMBER — COPY EXACTLY AS-IS, DO NOT MODIFY OR INVENT: ${generatedPhone}
- ADDRESS — COPY EXACTLY AS-IS, DO NOT MODIFY OR INVENT: ${generatedAddress}
- The phone MUST start with the country code for ${normalizedGeo}. NEVER use +1 for non-US/Canada countries.
- The address MUST be located in ${normalizedGeo} — do NOT use addresses from other countries
- Keep the entire brief under 400 words
- Use the provided HEX color codes EXACTLY as given
- Domain should be creative and memorable
- Each page must have 3-5 unique sections`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a structured website brief for this business:\n\n${prompt.trim()}\n\n⚠️ THE TOPIC IS: "${prompt.trim()}" — do NOT deviate from this topic under any circumstances.\n\nGeo: ${normalizedGeo}\nLanguage: ${normalizedLanguage || "Auto-detect from prompt"}${normalizedLanguage ? `\n\nREMINDER: Write ALL content in ${normalizedLanguage}. This is mandatory.` : ""}` },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    const responseText = await response.text();
    console.log("AI response length:", responseText.length, "chars");

    if (!response.ok) {
      console.error("AI gateway error:", response.status, responseText.substring(0, 500));

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Занадто багато запитів. Спробуйте пізніше." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Недостатньо кредитів Lovable AI. Зверніться до адміністратора для поповнення." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    if (!responseText || responseText.trim().length === 0) {
      console.error("Empty response from AI gateway");
      throw new Error("Порожня відповідь від AI. Спробуйте ще раз.");
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      throw new Error("Помилка парсингу відповіді AI. Спробуйте ще раз.");
    }

    const improvedPromptRaw = data.choices?.[0]?.message?.content;

    if (!improvedPromptRaw) {
      console.error("No content in AI response:", JSON.stringify(data).substring(0, 500));
      throw new Error("AI не повернув результат. Спробуйте ще раз.");
    }

    const improvedPrompt = normalizeDuplicateCountryCodes(String(improvedPromptRaw));

    console.log("Prompt improved successfully, length:", improvedPrompt.length);

    return new Response(
      JSON.stringify({ improvedPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error improving prompt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
