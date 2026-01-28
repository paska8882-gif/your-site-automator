// Languages with flags for filter display
export const LANGUAGES_MAP: Record<string, string> = {
  uk: "🇺🇦 Українська",
  en: "🇬🇧 English",
  de: "🇩🇪 Deutsch",
  fr: "🇫🇷 Français",
  es: "🇪🇸 Español",
  it: "🇮🇹 Italiano",
  pl: "🇵🇱 Polski",
  pt: "🇵🇹 Português",
  nl: "🇳🇱 Nederlands",
  cs: "🇨🇿 Čeština",
  sk: "🇸🇰 Slovenčina",
  hu: "🇭🇺 Magyar",
  ro: "🇷🇴 Română",
  bg: "🇧🇬 Български",
  el: "🇬🇷 Ελληνικά",
  sv: "🇸🇪 Svenska",
  da: "🇩🇰 Dansk",
  fi: "🇫🇮 Suomi",
  no: "🇳🇴 Norsk",
  hr: "🇭🇷 Hrvatski",
  sl: "🇸🇮 Slovenščina",
  lt: "🇱🇹 Lietuvių",
  lv: "🇱🇻 Latviešu",
  et: "🇪🇪 Eesti",
  kk: "🇰🇿 Қазақша",
  ja: "🇯🇵 日本語",
  ru: "🇷🇺 Русский",
  tr: "🇹🇷 Türkçe",
  vi: "🇻🇳 Tiếng Việt",
  th: "🇹🇭 ไทย",
  id: "🇮🇩 Bahasa Indonesia",
  hi: "🇮🇳 हिन्दी",
  ar: "🇸🇦 العربية",
};

// Layout styles with emojis for filter display
export const LAYOUT_STYLES_MAP: Record<string, string> = {
  classic: "🏛️ Класичний",
  corporate: "💼 Бізнес",
  professional: "👔 Професійний",
  executive: "🎩 Елітний",
  asymmetric: "🔀 Асиметричний",
  editorial: "📰 Журнальний",
  bold: "💪 Сміливий",
  creative: "🎨 Креативний",
  artistic: "🖼️ Арт-галерея",
  minimalist: "⬜ Мінімалізм",
  zen: "🧘 Дзен",
  clean: "✨ Чистий",
  whitespace: "🌫️ Повітряний",
  showcase: "🎬 Вітрина",
  interactive: "🕹️ Інтерактивний",
  animated: "🌊 Анімований",
  parallax: "📱 Паралакс",
  saas: "🚀 SaaS",
  startup: "🦄 Стартап",
  tech: "💻 Tech",
  app: "📲 Додаток",
  gradient: "🌈 Градієнт",
  brutalist: "🔲 Бруталізм",
  glassmorphism: "🔮 Гласморфізм",
  neomorphism: "🫧 Неоморфізм",
  retro: "📺 Ретро",
  portfolio: "🎭 Портфоліо",
  agency: "🏢 Агентство",
  studio: "🎥 Студія",
  ecommerce: "🛒 E-commerce",
  services: "🛠️ Сервіси",
  restaurant: "🍽️ Ресторан",
  hotel: "🏨 Готель",
};

// Color schemes with emojis for filter display
export const COLOR_SCHEMES_MAP: Record<string, { name: string; colors: string[] }> = {
  random: { name: "🎲 Випадково", colors: [] },
  ocean: { name: "🌊 Океан", colors: ["#0d4f8b", "#1a365d", "#3182ce"] },
  midnight: { name: "🌙 Північ", colors: ["#1a1a2e", "#16213e", "#2563eb"] },
  teal: { name: "🦢 Чирок", colors: ["#234e52", "#1d4044", "#319795"] },
  arctic: { name: "❄️ Арктика", colors: ["#0c4a6e", "#075985", "#38bdf8"] },
  navy: { name: "⚓ Морський", colors: ["#1e3a5f", "#0d2137", "#4a90d9"] },
  sky: { name: "☁️ Небесний", colors: ["#0284c7", "#0369a1", "#7dd3fc"] },
  forest: { name: "🌲 Ліс", colors: ["#276749", "#22543d", "#38a169"] },
  emerald: { name: "💎 Смарагд", colors: ["#047857", "#065f46", "#10b981"] },
  sage: { name: "🌿 Шавлія", colors: ["#3f6212", "#365314", "#84cc16"] },
  mint: { name: "🍃 М'ята", colors: ["#059669", "#047857", "#34d399"] },
  olive: { name: "🫒 Оливка", colors: ["#4d5527", "#3f4720", "#708238"] },
  sunset: { name: "🌅 Захід", colors: ["#c53030", "#9b2c2c", "#e53e3e"] },
  coral: { name: "🪸 Корал", colors: ["#c05621", "#9c4221", "#dd6b20"] },
  crimson: { name: "🔴 Кармін", colors: ["#991b1b", "#7f1d1d", "#dc2626"] },
  amber: { name: "🔶 Бурштин", colors: ["#b45309", "#92400e", "#f59e0b"] },
  flame: { name: "🔥 Полум'я", colors: ["#ea580c", "#c2410c", "#fb923c"] },
  royal: { name: "👑 Королівський", colors: ["#553c9a", "#44337a", "#805ad5"] },
  rose: { name: "🌹 Роза", colors: ["#97266d", "#702459", "#d53f8c"] },
  lavender: { name: "💜 Лаванда", colors: ["#7c3aed", "#6d28d9", "#a78bfa"] },
  fuchsia: { name: "🪻 Фуксія", colors: ["#a21caf", "#86198f", "#e879f9"] },
  plum: { name: "🍇 Слива", colors: ["#6b21a8", "#581c87", "#c084fc"] },
  mauve: { name: "🌸 Мальва", colors: ["#9d4edd", "#7b2cbf", "#c77dff"] },
  slate: { name: "🌫️ Сланець", colors: ["#2d3748", "#1a202c", "#4a5568"] },
  charcoal: { name: "🖤 Вугілля", colors: ["#1f2937", "#111827", "#374151"] },
  bronze: { name: "🥉 Бронза", colors: ["#92400e", "#78350f", "#d97706"] },
  coffee: { name: "☕ Кава", colors: ["#78350f", "#451a03", "#a16207"] },
  sand: { name: "🏖️ Пісок", colors: ["#a8a29e", "#78716c", "#d6d3d1"] },
  terracotta: { name: "🧱 Теракота", colors: ["#9a3412", "#7c2d12", "#ea580c"] },
  gold: { name: "🥇 Золото", colors: ["#b7791f", "#975a16", "#ecc94b"] },
  silver: { name: "🥈 Срібло", colors: ["#64748b", "#475569", "#94a3b8"] },
  wine: { name: "🍷 Вино", colors: ["#7f1d1d", "#450a0a", "#b91c1c"] },
  ocean_deep: { name: "🐙 Глибина", colors: ["#0c4a6e", "#082f49", "#0369a1"] },
};

// Helper functions to get display labels
export const getLanguageLabel = (code: string): string => {
  return LANGUAGES_MAP[code] || code.toUpperCase();
};

export const getLayoutStyleLabel = (id: string): string => {
  return LAYOUT_STYLES_MAP[id] || id;
};

export const getColorSchemeLabel = (id: string): string => {
  return COLOR_SCHEMES_MAP[id]?.name || id;
};

export const getColorSchemeColors = (id: string): string[] => {
  return COLOR_SCHEMES_MAP[id]?.colors || [];
};
