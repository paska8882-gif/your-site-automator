import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ GEO NAME MAPPING (Ukrainian/Russian/localized → English) ============
const GEO_NAME_MAP: Record<string, string> = {
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
  "австралія": "Australia", "нова зеландія": "New Zealand",
  "великобритания": "UK", "болгария": "Bulgaria", "бельгия": "Belgium", "вьетнам": "Vietnam",
  "греция": "Greece", "дания": "Denmark", "эстония": "Estonia", "индонезия": "Indonesia",
  "индия": "India", "ирландия": "Ireland", "испания": "Spain", "италия": "Italy",
  "латвия": "Latvia", "литва": "Lithuania", "нидерланды": "Netherlands",
  "германия": "Germany", "оаэ": "UAE", "польша": "Poland", "португалия": "Portugal",
  "россия": "Russia", "румыния": "Romania", "словакия": "Slovakia", "словения": "Slovenia",
  "таиланд": "Thailand", "турция": "Turkey", "украина": "Ukraine", "венгрия": "Hungary",
  "финляндия": "Finland", "франция": "France", "хорватия": "Croatia", "чехия": "Czech Republic",
  "швеция": "Sweden", "япония": "Japan", "казахстан": "Kazakhstan",
  "австрия": "Austria", "швейцария": "Switzerland", "норвегия": "Norway",
  "австралия": "Australia", "новая зеландия": "New Zealand",
  "usa": "USA", "uk": "UK", "canada": "Canada", "germany": "Germany", "france": "France",
  "spain": "Spain", "italy": "Italy", "portugal": "Portugal", "poland": "Poland",
  "netherlands": "Netherlands", "belgium": "Belgium", "austria": "Austria",
  "switzerland": "Switzerland", "ireland": "Ireland", "sweden": "Sweden", "norway": "Norway",
  "denmark": "Denmark", "finland": "Finland", "australia": "Australia", "new zealand": "New Zealand",
  "japan": "Japan", "romania": "Romania", "czech republic": "Czech Republic", "hungary": "Hungary",
  "greece": "Greece", "turkey": "Turkey", "kazakhstan": "Kazakhstan",
  "bulgaria": "Bulgaria", "croatia": "Croatia", "slovakia": "Slovakia", "slovenia": "Slovenia",
  "estonia": "Estonia", "latvia": "Latvia", "lithuania": "Lithuania", "vietnam": "Vietnam",
  "indonesia": "Indonesia", "thailand": "Thailand", "russia": "Russia", "ukraine": "Ukraine",
  "india": "India", "uae": "UAE",
};

function normalizeGeoName(geo: string): string {
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
  "ru": "Russian", "tr": "Turkish",
  "ukrainian": "Ukrainian", "english": "English", "german": "German", "french": "French",
  "spanish": "Spanish", "italian": "Italian", "portuguese": "Portuguese", "polish": "Polish",
  "dutch": "Dutch", "romanian": "Romanian", "czech": "Czech", "slovak": "Slovak",
  "hungarian": "Hungarian", "russian": "Russian", "japanese": "Japanese",
  "українська": "Ukrainian", "англійська": "English", "німецька": "German", "французька": "French",
  "іспанська": "Spanish", "італійська": "Italian", "португальська": "Portuguese", "польська": "Polish",
  "нідерландська": "Dutch", "румунська": "Romanian", "чеська": "Czech", "словацька": "Slovak",
  "угорська": "Hungarian", "болгарська": "Bulgarian", "хорватська": "Croatian", "словенська": "Slovenian",
  "грецька": "Greek", "шведська": "Swedish", "данська": "Danish", "фінська": "Finnish",
  "норвезька": "Norwegian", "литовська": "Lithuanian", "латвійська": "Latvian", "естонська": "Estonian",
  "японська": "Japanese", "російська": "Russian", "турецька": "Turkish",
  "русский": "Russian", "английский": "English", "немецкий": "German", "французский": "French",
  "испанский": "Spanish", "итальянский": "Italian", "португальский": "Portuguese", "польский": "Polish",
};

function normalizeLanguageName(lang: string): string {
  const cleaned = lang.trim().toLowerCase();
  return LANGUAGE_NAME_MAP[cleaned] || lang;
}

const TOPIC_CATEGORIES: Record<string, string[]> = {
  "Фінанси (Освіта)": ["Ведення бюджету", "Інвестування", "Робота з криптовалютами", "Фінансова грамотність", "Побудова бізнесу", "Краудфандинг", "Фінансовий аналітик", "Трейдинг", "Машинне навчання у фінансах"],
  "Здоров'я (Освіта)": ["Здоровий спосіб життя", "Правильне харчування", "Гімнастика", "Йога", "Вегетаріанство", "Кросфіт"],
  "Краса (Освіта)": ["Манікюр", "Візажист", "Стиліст", "Перукар"],
  "Вивчення іноземних мов": ["Англійська мова", "Польська мова", "Німецька мова", "Іспанська мова", "Французька мова", "Італійська мова", "Португальська мова", "Арабська мова", "Японська мова"],
  "Саморозвиток": ["Підвищення мотивації", "Медитація", "Особистісний ріст", "Психологія", "Коучинг", "Сімейні відносини", "Вивчення релігій", "Побудова командної роботи", "Астрологія", "Дейтинг", "Креативність"],
  "Кар'єрний ріст": ["Туроператор", "Маркетолог", "Дизайнер", "Менеджмент", "Журналістика", "Флорист", "Організатор свят", "Акторська майстерність", "Кіберспорт", "Туристичний гід", "Торгівля на маркетплейсах", "Еколог", "Юрист", "Ріелтор", "Соціальний працівник", "Стрімінг", "Нафта", "Газ", "Енергетика"],
  "Творчість": ["Письменництво", "Кулінарія", "Малювання", "Фотограф", "Музика", "Танці"],
  "IT (Освіта)": ["Розробка мобільних ігор", "Програмування", "Відеомонтаж", "Основи блокчейну", "Веб-дизайн", "Системний адміністратор", "SEO-спеціаліст", "Розробник AR/VR ігор", "3D-дизайн для ігор", "ШІ (штучний інтелект)", "Кібербезпека"],
  "Фінанси (Послуги)": ["Побудова бізнесу", "Управління бюджетом", "Фінансове консультування", "Фінансова підтримка", "Бухгалтерський облік", "Фінансовий аудит", "Автоматизація фінансових процесів", "ШІ-рішення для управління фінансами"],
  "Здоров'я (Послуги)": ["Йога", "Гімнастика", "Кросфіт", "Нутриціологія", "Здоров'я людей похилого віку", "Масаж та релаксація", "Антистрес-терапія"],
  "Саморозвиток (Послуги)": ["Лайф-коучинг", "Психологія", "Сімейне консультування", "Медитація", "Розвиток лідерства"],
  "Краса (Послуги)": ["Манікюр", "Візажист", "Стиліст", "Перукар"],
  "Професійні послуги": ["Туроператор", "Цифровий маркетинг", "Графічний дизайн", "Проектне управління", "Журналістика", "Флористика", "Івент-менеджмент", "Актор", "Торгівля на маркетплейсах", "Екологічне консультування", "Соціальна робота", "Перекладач", "Таргетована реклама", "Контент-менеджмент"],
  "Креативність (Послуги)": ["Копірайтер", "Кулінар", "Художник", "Фотограф", "Музикант"],
  "IT (Послуги)": ["Розробка мобільних додатків", "Програмування", "Відеомонтаж", "Веб-дизайн", "SEO", "Системне адміністрування", "AR/VR розробка", "3D-дизайн", "ШІ (штучний інтелект)", "Кібербезпека", "Розробка ігор", "Тестування ПЗ", "Блокчейн-розробка", "Розробка чат-ботів", "Управління базами даних"]
};

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
  "Romania": { code: "+40", area: ["21", "31", "264", "256"], format: (a, n) => `+40 ${a} ${n.slice(0,3)} ${n.slice(3,6)}` },
};

const GEO_ADDRESS_DATA: Record<string, { cities: { name: string; region: string; postal: string }[]; streets: string[] }> = {
  "Canada": { cities: [{ name: "Toronto", region: "ON", postal: "M5V" }, { name: "Vancouver", region: "BC", postal: "V6B" }, { name: "Montreal", region: "QC", postal: "H3B" }], streets: ["Bay Street", "King Street West", "Granville Street"] },
  "USA": { cities: [{ name: "New York", region: "NY", postal: "10001" }, { name: "Los Angeles", region: "CA", postal: "90001" }, { name: "Chicago", region: "IL", postal: "60601" }], streets: ["Broadway", "Main Street", "Oak Avenue"] },
  "UK": { cities: [{ name: "London", region: "England", postal: "EC1A" }, { name: "Manchester", region: "England", postal: "M1" }], streets: ["High Street", "Oxford Street", "King's Road"] },
  "Germany": { cities: [{ name: "Berlin", region: "Berlin", postal: "10115" }, { name: "Munich", region: "Bavaria", postal: "80331" }], streets: ["Hauptstraße", "Berliner Straße", "Bahnhofstraße"] },
  "France": { cities: [{ name: "Paris", region: "Île-de-France", postal: "75001" }, { name: "Lyon", region: "Auvergne-Rhône-Alpes", postal: "69001" }], streets: ["Rue de la Paix", "Avenue des Champs-Élysées"] },
  "Spain": { cities: [{ name: "Madrid", region: "Community of Madrid", postal: "28001" }, { name: "Barcelona", region: "Catalonia", postal: "08001" }], streets: ["Calle Mayor", "Gran Vía", "Paseo de la Castellana"] },
  "Italy": { cities: [{ name: "Rome", region: "Lazio", postal: "00100" }, { name: "Milan", region: "Lombardy", postal: "20121" }], streets: ["Via Roma", "Corso Vittorio Emanuele"] },
  "Portugal": { cities: [{ name: "Lisbon", region: "Lisbon", postal: "1100" }, { name: "Porto", region: "Porto", postal: "4000" }], streets: ["Avenida da Liberdade", "Rua Augusta"] },
  "Poland": { cities: [{ name: "Warsaw", region: "Masovian", postal: "00-001" }, { name: "Krakow", region: "Lesser Poland", postal: "30-001" }], streets: ["ul. Marszałkowska", "ul. Floriańska"] },
  "Netherlands": { cities: [{ name: "Amsterdam", region: "North Holland", postal: "1012" }, { name: "Rotterdam", region: "South Holland", postal: "3011" }], streets: ["Damrak", "Kalverstraat"] },
  "Australia": { cities: [{ name: "Sydney", region: "NSW", postal: "2000" }, { name: "Melbourne", region: "VIC", postal: "3000" }], streets: ["George Street", "Collins Street"] },
  "Romania": { cities: [{ name: "Bucharest", region: "Bucharest", postal: "010011" }, { name: "Cluj-Napoca", region: "Cluj", postal: "400001" }], streets: ["Calea Victoriei", "Bulevardul Unirii"] }
};

const NICHE_TO_INDUSTRY: Record<string, { industry: string; palette: { name: string; hex: string }[]; jsonLd: string; tone: string[] }> = {
  // Finance
  "Ведення бюджету": { industry: "Financial Education", palette: [{ name: "Midnight Navy", hex: "#1a365d" }, { name: "Gold Accent", hex: "#d69e2e" }, { name: "Silver", hex: "#a0aec0" }], jsonLd: "EducationalOrganization", tone: ["Strategic", "Practical", "Trustworthy", "Expert"] },
  "Інвестування": { industry: "Investment Education", palette: [{ name: "Wealth Green", hex: "#166534" }, { name: "Gold", hex: "#ca8a04" }, { name: "Charcoal", hex: "#374151" }], jsonLd: "EducationalOrganization", tone: ["Strategic", "Analytical", "Professional", "Growth-Focused"] },
  "Фінансова грамотність": { industry: "Financial Literacy", palette: [{ name: "Trust Blue", hex: "#1e40af" }, { name: "Warm Orange", hex: "#ea580c" }, { name: "Light Gray", hex: "#f3f4f6" }], jsonLd: "EducationalOrganization", tone: ["Empowering", "Accessible", "Practical", "Supportive"] },
  "Трейдинг": { industry: "Trading Education", palette: [{ name: "Market Green", hex: "#15803d" }, { name: "Alert Red", hex: "#dc2626" }, { name: "Dark", hex: "#1f2937" }], jsonLd: "EducationalOrganization", tone: ["Dynamic", "Analytical", "Real-time", "Expert"] },
  
  // Health
  "Здоровий спосіб життя": { industry: "Wellness", palette: [{ name: "Healing Green", hex: "#2d8f5e" }, { name: "Calm Teal", hex: "#0d9488" }, { name: "Pure White", hex: "#f0fdf4" }], jsonLd: "HealthAndBeautyBusiness", tone: ["Holistic", "Natural", "Balanced", "Energizing"] },
  "Правильне харчування": { industry: "Nutrition", palette: [{ name: "Fresh Green", hex: "#22c55e" }, { name: "Warm Orange", hex: "#f97316" }, { name: "Cream", hex: "#fef3c7" }], jsonLd: "HealthAndBeautyBusiness", tone: ["Fresh", "Scientific", "Balanced", "Nourishing"] },
  "Йога": { industry: "Yoga & Wellness", palette: [{ name: "Zen Purple", hex: "#7c3aed" }, { name: "Calm Teal", hex: "#14b8a6" }, { name: "Soft Beige", hex: "#fef3e2" }], jsonLd: "SportsActivityLocation", tone: ["Peaceful", "Mindful", "Transformative", "Harmonious"] },
  "Кросфіт": { industry: "CrossFit Training", palette: [{ name: "Power Red", hex: "#dc2626" }, { name: "Steel Gray", hex: "#4b5563" }, { name: "Black", hex: "#171717" }], jsonLd: "SportsActivityLocation", tone: ["Intense", "Powerful", "Community-Driven", "Results-Focused"] },
  
  // Beauty
  "Манікюр": { industry: "Nail Art & Care", palette: [{ name: "Blush Pink", hex: "#ec4899" }, { name: "Rose Gold", hex: "#f472b6" }, { name: "Cream", hex: "#fdf2f8" }], jsonLd: "BeautySalon", tone: ["Elegant", "Trendy", "Meticulous", "Creative"] },
  "Візажист": { industry: "Makeup Artistry", palette: [{ name: "Glam Red", hex: "#e11d48" }, { name: "Nude Beige", hex: "#d4a574" }, { name: "Soft Pink", hex: "#fce7f3" }], jsonLd: "BeautySalon", tone: ["Glamorous", "Artistic", "Transformative", "Professional"] },
  "Стиліст": { industry: "Personal Styling", palette: [{ name: "Chic Black", hex: "#18181b" }, { name: "Gold", hex: "#eab308" }, { name: "Off-White", hex: "#fafaf9" }], jsonLd: "ProfessionalService", tone: ["Sophisticated", "Trendsetting", "Personalized", "Confident"] },
  
  // Languages
  "Англійська мова": { industry: "English Education", palette: [{ name: "British Blue", hex: "#1d4ed8" }, { name: "Academic Red", hex: "#b91c1c" }, { name: "Clean White", hex: "#f8fafc" }], jsonLd: "EducationalOrganization", tone: ["Academic", "Engaging", "Practical", "Global"] },
  "Німецька мова": { industry: "German Education", palette: [{ name: "German Black", hex: "#1f2937" }, { name: "Red", hex: "#dc2626" }, { name: "Gold", hex: "#fbbf24" }], jsonLd: "EducationalOrganization", tone: ["Precise", "Structured", "Cultural", "Immersive"] },
  
  // IT
  "Програмування": { industry: "Programming Education", palette: [{ name: "Code Blue", hex: "#0ea5e9" }, { name: "Terminal Green", hex: "#22c55e" }, { name: "Dark", hex: "#0f172a" }], jsonLd: "EducationalOrganization", tone: ["Technical", "Innovative", "Practical", "Career-Focused"] },
  "Веб-дизайн": { industry: "Web Design", palette: [{ name: "Creative Purple", hex: "#8b5cf6" }, { name: "Pink", hex: "#ec4899" }, { name: "Light", hex: "#f8fafc" }], jsonLd: "ProfessionalService", tone: ["Creative", "Modern", "User-Centric", "Innovative"] },
  "SEO": { industry: "SEO Services", palette: [{ name: "Growth Green", hex: "#10b981" }, { name: "Data Blue", hex: "#3b82f6" }, { name: "White", hex: "#ffffff" }], jsonLd: "ProfessionalService", tone: ["Data-Driven", "Strategic", "Results-Oriented", "Technical"] },
  "Кібербезпека": { industry: "Cybersecurity", palette: [{ name: "Secure Blue", hex: "#1e3a8a" }, { name: "Alert Green", hex: "#16a34a" }, { name: "Dark", hex: "#111827" }], jsonLd: "ITService", tone: ["Protective", "Expert", "Vigilant", "Trustworthy"] },
  
  // Default
  "Default": { industry: "Professional Services", palette: [{ name: "Professional Blue", hex: "#3b82f6" }, { name: "Neutral Gray", hex: "#6b7280" }, { name: "Clean White", hex: "#f9fafb" }], jsonLd: "LocalBusiness", tone: ["Professional", "Trustworthy", "Modern", "Reliable"] }
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
  }
  
  return `${street} ${number}, ${city.postal} ${city.name}`;
}

function getNicheData(niche: string) {
  return NICHE_TO_INDUSTRY[niche] || NICHE_TO_INDUSTRY["Default"];
}

function generateDomainFromNiche(niche: string): string {
  const words = niche.toLowerCase().replace(/[^a-zа-яіїє0-9\s]/gi, '').split(/\s+/);
  const prefixes = ["pro", "elite", "master", "academy", "hub", "studio", "expert", "prime", "smart", "quick"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const base = words.slice(0, 2).join('');
  return `${prefix}${base}.com`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic, siteName, geo, phone, language, batchIndex, batchTotal } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!topic || topic.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Topic is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isBatch = batchIndex && batchTotal && batchTotal > 1;
    
    console.log("Generating structured brief for topic:", topic);
    console.log("Site name:", siteName || "auto-generate");
    console.log("Geo:", geo || "USA");
    console.log("Language:", language || "auto-detect");
    if (isBatch) {
      console.log(`Batch generation: ${batchIndex}/${batchTotal}`);
    }

    // Normalize geo and language
    const normalizedGeo = geo ? normalizeGeoName(geo) : "USA";
    const normalizedLanguage = language ? normalizeLanguageName(language) : "English";

    // Get niche-specific data
    const nicheData = getNicheData(topic);
    const generatedPhone = phone || generatePhoneByGeo(normalizedGeo);
    const generatedAddress = generateAddressByGeo(normalizedGeo);
    const suggestedDomain = generateDomainFromNiche(topic);
    const paletteString = nicheData.palette.map(c => `${c.name} (${c.hex})`).join(", ");
    
    // Add batch uniqueness instruction
    const batchInstruction = isBatch 
      ? `\n\nIMPORTANT: This is generation ${batchIndex} of ${batchTotal} in a batch. Create a COMPLETELY UNIQUE and DIFFERENT version:
- Invent a DIFFERENT company name (not similar to others)
- Use a DIFFERENT tagline and messaging angle
- Change the visual direction - pick DIFFERENT colors from the niche palette options
- Vary the business positioning and unique value proposition
- Make it feel like a completely independent brand in the same niche`
      : "";

    const systemPrompt = `You are an expert website brief writer. Create a STRUCTURED, COMPACT website brief for the given niche.

⚠️ LANGUAGE — ABSOLUTE PRIORITY ⚠️
The ENTIRE brief MUST be written in ${normalizedLanguage}. ALL text — company overview, taglines, audience descriptions, section names, keywords — MUST be in ${normalizedLanguage}. This is NON-NEGOTIABLE. Do NOT write in English unless the language IS English. The Language field must say: ${normalizedLanguage}.

OUTPUT FORMAT (follow EXACTLY):

${suggestedDomain} (${nicheData.industry})

Company Name: [Creative Business Name - make it memorable and relevant]
Geo: ${normalizedGeo}
Language: ${normalizedLanguage}
Industry: ${nicheData.industry}
Core Theme: [One compelling sentence about what makes this business unique]

1. Company Overview
[2-3 sentences describing the business, its specialization, target market, and unique value proposition]

2. Tone & Editorial Identity
Tone: ${nicheData.tone.join(", ")}
Audience: [Describe the specific target audience in detail]
Principles: [4-5 core business principles that guide this company]

3. Website Architecture
index.html: Hero "[Create a catchy tagline]"; Services Overview; Why Choose Us; Success Stories; Newsletter CTA
services.html: Hero; [Service 1 with details]; [Service 2 with details]; [Service 3 with details]; Pricing/Packages
about.html: Hero; Our Story; Team/Expertise; Achievements & Certifications; Values
resources.html: Hero; Blog/Articles; Free Resources; FAQ; Testimonials
contact.html: Hero; Contact Form; Location: ${generatedAddress}; Phone: ${generatedPhone}; Working Hours

4. Visual Direction
Palette: ${paletteString}
Imagery: [List 4-5 specific types of images relevant to this niche]

5. Technical & SEO
SEO: [List 4 relevant SEO keywords in quotes]
JSON-LD: ${nicheData.jsonLd}

6. Keywords & Restrictions
Keywords: [List 8-12 industry-specific keywords]
Restrictions: Do not use: gratuit, miracle, free, profit, money, price, guarantee, 100%, crypto, health claims, get rich

RULES:
- Create a UNIQUE, MEMORABLE company name
- Keep the brief under 400 words total
- Be specific to the "${topic}" niche
- Use the exact phone and address provided
- The address MUST be in ${normalizedGeo}
- The tagline must be catchy and memorable
- ALL content MUST be in ${normalizedLanguage}${batchInstruction}`;

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
          { role: "user", content: `Create a complete structured website brief for this niche: "${topic}"${siteName ? `\nBusiness name: ${siteName}` : ''}\n\nREMINDER: Write ALL content in ${normalizedLanguage}. Language = ${normalizedLanguage}. Geo = ${normalizedGeo}.${isBatch ? `\n\nThis is variant ${batchIndex} of ${batchTotal} - make it completely unique and different!` : ''}` },
        ],
        max_tokens: 2000,
        temperature: isBatch ? 0.9 : 0.7, // Higher temperature for batch to ensure variety
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
          JSON.stringify({ error: "Недостатньо кредитів Lovable AI. Зверніться до адміністратора." }),
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

    const generatedPrompt = data.choices?.[0]?.message?.content;

    if (!generatedPrompt) {
      console.error("No content in AI response:", JSON.stringify(data).substring(0, 500));
      throw new Error("AI не повернув результат. Спробуйте ще раз.");
    }

    console.log("Structured brief generated successfully, length:", generatedPrompt.length);

    return new Response(
      JSON.stringify({ 
        generatedPrompt: String(generatedPrompt).trim(),
        categories: TOPIC_CATEGORIES 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error generating theme prompt:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
