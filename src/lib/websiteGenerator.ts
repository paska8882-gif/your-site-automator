import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import JSZip from "jszip";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationResult {
  success: boolean;
  historyId?: string;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
}

export type AiModel = "junior" | "senior";
export type WebsiteType = "html" | "react" | "php";
export type SeniorMode = "codex" | "onepage" | "v0" | "reaktiv" | undefined;
export type ImageSource = "basic" | "ai";

// Layout styles available for selection (~30 styles with emojis)
export const LAYOUT_STYLES = [
  // Classic & Corporate
  { id: "classic", name: "🏛️ Класичний корпоративний" },
  { id: "corporate", name: "💼 Бізнес-серйозний" },
  { id: "professional", name: "👔 Професійний" },
  { id: "executive", name: "🎩 Елітний" },
  // Modern & Creative
  { id: "asymmetric", name: "🔀 Модерн асиметричний" },
  { id: "editorial", name: "📰 Журнальний" },
  { id: "bold", name: "💪 Сміливі блоки" },
  { id: "creative", name: "🎨 Креативний хаос" },
  { id: "artistic", name: "🖼️ Арт-галерея" },
  // Minimalist & Clean
  { id: "minimalist", name: "⬜ Мінімалізм" },
  { id: "zen", name: "🧘 Дзен-спокій" },
  { id: "clean", name: "✨ Чистий простір" },
  { id: "whitespace", name: "🌫️ Багато повітря" },
  // Dynamic & Interactive
  { id: "showcase", name: "🎬 Динамічна вітрина" },
  { id: "interactive", name: "🕹️ Інтерактивний" },
  { id: "animated", name: "🌊 Анімований" },
  { id: "parallax", name: "📱 Паралакс" },
  // Tech & Product
  { id: "saas", name: "🚀 SaaS продукт" },
  { id: "startup", name: "🦄 Стартап" },
  { id: "tech", name: "💻 Tech-сучасний" },
  { id: "app", name: "📲 Додаток-лендінг" },
  // Style-specific
  { id: "gradient", name: "🌈 Градієнтний" },
  { id: "brutalist", name: "🔲 Бруталізм" },
  { id: "glassmorphism", name: "🔮 Гласморфізм" },
  { id: "neomorphism", name: "🫧 Неоморфізм" },
  { id: "retro", name: "📺 Ретро 90-х" },
  // Portfolio & Showcase
  { id: "portfolio", name: "🎭 Креативне портфоліо" },
  { id: "agency", name: "🏢 Агентство" },
  { id: "studio", name: "🎥 Студія" },
  // E-commerce & Services
  { id: "ecommerce", name: "🛒 E-commerce" },
  { id: "services", name: "🛠️ Сервісна компанія" },
  { id: "restaurant", name: "🍽️ Ресторан/Кафе" },
  { id: "hotel", name: "🏨 Готель/Курорт" },
];

// Color schemes available for selection (matches Edge Functions) - 30 schemes
export const COLOR_SCHEMES_UI = [
  { id: "random", name: "🎲 Випадково", colors: [] },
  // Blues & Teals
  { id: "ocean", name: "🌊 Океан", colors: ["#0d4f8b", "#1a365d", "#3182ce"] },
  { id: "midnight", name: "🌙 Північ", colors: ["#1a1a2e", "#16213e", "#2563eb"] },
  { id: "teal", name: "🦢 Чирок", colors: ["#234e52", "#1d4044", "#319795"] },
  { id: "arctic", name: "❄️ Арктика", colors: ["#0c4a6e", "#075985", "#38bdf8"] },
  { id: "navy", name: "⚓ Морський", colors: ["#1e3a5f", "#0d2137", "#4a90d9"] },
  { id: "sky", name: "☁️ Небесний", colors: ["#0284c7", "#0369a1", "#7dd3fc"] },
  // Greens
  { id: "forest", name: "🌲 Ліс", colors: ["#276749", "#22543d", "#38a169"] },
  { id: "emerald", name: "💎 Смарагд", colors: ["#047857", "#065f46", "#10b981"] },
  { id: "sage", name: "🌿 Шавлія", colors: ["#3f6212", "#365314", "#84cc16"] },
  { id: "mint", name: "🍃 М'ята", colors: ["#059669", "#047857", "#34d399"] },
  { id: "olive", name: "🫒 Оливка", colors: ["#4d5527", "#3f4720", "#708238"] },
  // Reds & Oranges
  { id: "sunset", name: "🌅 Захід", colors: ["#c53030", "#9b2c2c", "#e53e3e"] },
  { id: "coral", name: "🪸 Корал", colors: ["#c05621", "#9c4221", "#dd6b20"] },
  { id: "crimson", name: "🔴 Кармін", colors: ["#991b1b", "#7f1d1d", "#dc2626"] },
  { id: "amber", name: "🔶 Бурштин", colors: ["#b45309", "#92400e", "#f59e0b"] },
  { id: "flame", name: "🔥 Полум'я", colors: ["#ea580c", "#c2410c", "#fb923c"] },
  // Purples & Pinks
  { id: "royal", name: "👑 Королівський", colors: ["#553c9a", "#44337a", "#805ad5"] },
  { id: "rose", name: "🌹 Роза", colors: ["#97266d", "#702459", "#d53f8c"] },
  { id: "lavender", name: "💜 Лаванда", colors: ["#7c3aed", "#6d28d9", "#a78bfa"] },
  { id: "fuchsia", name: "🪻 Фуксія", colors: ["#a21caf", "#86198f", "#e879f9"] },
  { id: "plum", name: "🍇 Слива", colors: ["#6b21a8", "#581c87", "#c084fc"] },
  { id: "mauve", name: "🌸 Мальва", colors: ["#9d4edd", "#7b2cbf", "#c77dff"] },
  // Neutrals & Earth Tones
  { id: "slate", name: "🌫️ Сланець", colors: ["#2d3748", "#1a202c", "#4a5568"] },
  { id: "charcoal", name: "🖤 Вугілля", colors: ["#1f2937", "#111827", "#374151"] },
  { id: "bronze", name: "🥉 Бронза", colors: ["#92400e", "#78350f", "#d97706"] },
  { id: "coffee", name: "☕ Кава", colors: ["#78350f", "#451a03", "#a16207"] },
  { id: "sand", name: "🏖️ Пісок", colors: ["#a8a29e", "#78716c", "#d6d3d1"] },
  { id: "terracotta", name: "🧱 Теракота", colors: ["#9a3412", "#7c2d12", "#ea580c"] },
  // Special & Unique
  { id: "gold", name: "🥇 Золото", colors: ["#b7791f", "#975a16", "#ecc94b"] },
  { id: "silver", name: "🥈 Срібло", colors: ["#64748b", "#475569", "#94a3b8"] },
  { id: "wine", name: "🍷 Вино", colors: ["#7f1d1d", "#450a0a", "#b91c1c"] },
  { id: "ocean_deep", name: "🐙 Глибина", colors: ["#0c4a6e", "#082f49", "#0369a1"] },
];

export type ColorScheme = typeof COLOR_SCHEMES_UI[number]["id"];

// Geo code to country name mapping
const GEO_NAMES: Record<string, string> = {
  uk: "United Kingdom",
  be: "Belgium",
  bg: "Bulgaria",
  ca: "Canada",
  cz: "Czech Republic",
  de: "Germany",
  es: "Spain",
  fr: "France",
  hu: "Hungary",
  ie: "Ireland",
  it: "Italy",
  pl: "Poland",
  pt: "Portugal",
  ro: "Romania",
  tr: "Turkey",
  nl: "Netherlands",
  ru: "Russia",
  jp: "Japan",
  ua: "Ukraine",
  hr: "Croatia",
  dk: "Denmark",
  ee: "Estonia",
  fi: "Finland",
  gr: "Greece",
  lv: "Latvia",
  lt: "Lithuania",
  sk: "Slovakia",
  si: "Slovenia",
  se: "Sweden",
  vn: "Vietnam",
  th: "Thailand",
  id: "Indonesia",
  in: "India",
  ae: "United Arab Emirates",
  us: "United States",
};

// Helper to append geo context to prompt
function appendGeoToPrompt(prompt: string, geo?: string): string {
  if (!geo || geo === "none" || !GEO_NAMES[geo]) {
    return prompt;
  }
  const countryName = GEO_NAMES[geo];
  return `${prompt}\n\n[TARGET COUNTRY: ${countryName}. The website is specifically designed for the ${countryName} market. Use local phone number formats, address formats, currency, and cultural preferences appropriate for ${countryName}.]`;
}

// Helper to get a valid access token.
// - Prefer current session token if it's not close to expiring
// - Otherwise attempt a refresh
// - If refresh fails, sign out and return null (do NOT fall back to an expired token)
async function getFreshAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    // If we have a session and the token is still valid for at least ~2 minutes, use it.
    // (expires_at is in seconds)
    const expiresAtMs = (session?.expires_at ?? 0) * 1000;
    const msLeft = expiresAtMs - Date.now();
    if (session?.access_token && msLeft > 120_000) {
      return session.access_token;
    }

    // Token is close to expiring or already expired - force refresh
    console.log("Token expired or expiring soon, refreshing...");
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    if (refreshError) {
      console.error("Failed to refresh session:", refreshError.message);
      // Sign out to clear invalid session state
      await supabase.auth.signOut();
      return null;
    }
    
    if (refreshData?.session?.access_token) {
      console.log("Token refreshed successfully");
      return refreshData.session.access_token;
    }

    // No valid session after refresh attempt - sign out
    await supabase.auth.signOut();
    return null;
  } catch (error) {
    console.error("Error getting fresh token:", error);
    await supabase.auth.signOut();
    return null;
  }
}

type MaintenanceModeRow = {
  enabled?: boolean;
  message?: string | null;
  support_link?: string | null;
  generation_disabled?: boolean;
  generation_message?: string | null;
};

type GenerationBlockInfo = {
  blocked: boolean;
  message: string;
  supportLink: string | null;
};

let generationBlockCache: { at: number; info: GenerationBlockInfo } | null = null;
const GENERATION_BLOCK_CACHE_MS = 5_000;

async function getGenerationBlockInfo(): Promise<GenerationBlockInfo> {
  const now = Date.now();
  if (generationBlockCache && now - generationBlockCache.at < GENERATION_BLOCK_CACHE_MS) {
    return generationBlockCache.info;
  }

  try {
    const { data, error } = await supabase
      .from("maintenance_mode")
      .select("enabled, message, support_link, generation_disabled, generation_message")
      .eq("id", "global")
      .maybeSingle();

    if (error || !data) {
      const info = { blocked: false, message: "", supportLink: null };
      generationBlockCache = { at: now, info };
      return info;
    }

    const row = data as MaintenanceModeRow;
    const blocked = !!row.enabled || !!row.generation_disabled;
    const message = row.enabled
      ? (row.message || row.generation_message || "Ведуться технічні роботи. Спробуйте пізніше.")
      : (row.generation_message || row.message || "Ведеться технічне обслуговування. Генерація тимчасово недоступна.");

    const info = {
      blocked,
      message,
      supportLink: row.support_link || null,
    };
    generationBlockCache = { at: now, info };
    return info;
  } catch {
    const info = { blocked: false, message: "", supportLink: null };
    generationBlockCache = { at: now, info };
    return info;
  }
}

// Quick healthcheck to verify edge functions are reachable before starting generation
export async function checkBackendHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/healthcheck`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      return { ok: false, error: `Backend returned ${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "Backend functions are unreachable. Try again in a minute." };
  }
}

export async function startGeneration(
  prompt: string,
  language?: string,
  aiModel: AiModel = "senior",
  websiteType: WebsiteType = "html",
  layoutStyle?: string,
  siteName?: string,
  seniorMode?: SeniorMode,
  imageSource: ImageSource = "basic",
  teamId?: string, // Optional team ID for admin generation
  improvedPrompt?: string, // AI-improved prompt (commercial secret)
  geo?: string, // Target country/region for the website
  vipPrompt?: string, // VIP detailed prompt (+$2)
  exactPhone?: string, // Optional exact phone to enforce
  bilingualLanguages?: string[], // Optional array of 2 languages for bilingual site (+$3)
  bundleImages: boolean = true, // Whether to bundle images into ZIP (slower) or keep as URLs (faster)
  colorScheme?: ColorScheme // Optional color scheme (if 'random' or undefined, use random selection)
): Promise<GenerationResult> {
  const maintenance = await getGenerationBlockInfo();
  if (maintenance.blocked) {
    return { success: false, error: maintenance.message };
  }

  // Pre-flight healthcheck: verify backend is reachable before creating a job
  const health = await checkBackendHealth();
  if (!health.ok) {
    return { success: false, error: `Сервер генерації недоступний. ${health.error || "Спробуйте через хвилину."}` };
  }

  // IMPORTANT: seniorMode (codex/reaktiv) only applies to React websites
  // HTML and PHP websites always use their dedicated generation functions
  
  // Если выбран режим Codex для Senior AI и тип сайта React - обращаемся к внешнему вебхуку
  if (aiModel === "senior" && seniorMode === "codex" && websiteType === "react") {
    return startCodexGeneration(prompt, language, websiteType, layoutStyle, siteName, teamId, geo);
  }

  // Если выбран режим Реактивний Михайло и тип сайта React - используем v0.dev API
  if (aiModel === "senior" && seniorMode === "reaktiv" && websiteType === "react") {
    return startV0Generation(prompt, language, websiteType, layoutStyle, siteName, teamId, geo);
  }

  // For HTML/PHP or React without special senior mode - use appropriate function
  const functionName = websiteType === "react" 
    ? "generate-react-website" 
    : websiteType === "php" 
      ? "generate-php-website" 
      : "generate-website";

  // Determine which prompt to use for generation
  // Priority: vipPrompt > improvedPrompt > original prompt
  let promptForGeneration = vipPrompt || improvedPrompt || prompt;

  // If user provided exact phone / site name, embed them as structured lines so the backend can enforce them
  if (siteName?.trim() && !/^(?:Name|SITE_NAME)\s*:/mi.test(promptForGeneration)) {
    promptForGeneration += `\nName: ${siteName.trim()}`;
  }
  if (exactPhone?.trim() && !/^(?:Phone|PHONE)\s*:/mi.test(promptForGeneration)) {
    promptForGeneration += `\nPhone: ${exactPhone.trim()}`;
  }

  const makeRequest = async (accessToken: string) => {
    // Set a long timeout for generation (10 minutes) to prevent premature connection close
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes
    
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          prompt: promptForGeneration,
          originalPrompt: prompt,
          improvedPrompt: improvedPrompt || null,
          vipPrompt: vipPrompt || null,
          language, aiModel, layoutStyle, siteName, seniorMode, imageSource, teamId, geo,
          bilingualLanguages: bilingualLanguages || null, // Pass bilingual languages for bilingual sites
          bundleImages, // Whether to download images into ZIP
          colorScheme: colorScheme && colorScheme !== 'random' ? colorScheme : null // Pass color scheme if not random
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  try {
    // Always try to get a fresh token first to avoid expired token issues
    const accessToken = await getFreshAccessToken();

    // IMPORTANT: Do NOT fall back to a potentially expired session token.
    // If refresh fails, force the UI to re-authenticate.
    if (!accessToken) {
      return { success: false, error: "Сесія закінчилась. Будь ласка, увійдіть знову." };
    }

    let resp = await makeRequest(accessToken);

    // If 401 error, try to refresh token again and retry once
    if (resp.status === 401) {
      console.log("Got 401, attempting to refresh token...");
      const freshToken = await getFreshAccessToken();
      
      if (freshToken && freshToken !== accessToken) {
        console.log("Token refreshed, retrying request...");
        resp = await makeRequest(freshToken);
      } else {
        return { success: false, error: "Сесія закінчилась. Будь ласка, увійдіть знову." };
      }
    }

    if (!resp.ok) {
      // Check for specific auth errors after retry
      if (resp.status === 401) {
        return { success: false, error: "Сесія закінчилась. Будь ласка, увійдіть знову." };
      }

      const errText = await resp.text().catch(() => "");
      let errorMessage = errText || `HTTP ${resp.status}`;
      
      // Prefer structured backend error payloads: { error, message }
      if (errText) {
        try {
          const parsed = JSON.parse(errText);
          if (typeof parsed?.message === "string" && parsed.message.trim()) {
            errorMessage = parsed.message;
          } else if (typeof parsed?.error === "string" && parsed.error.trim()) {
            errorMessage = parsed.error;
          }
        } catch {
          // keep text as-is
        }
      }

      return { success: false, error: errorMessage };
    }

    const data = await resp.json();
    return data;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    // Detect network-level failures (function unreachable / deploy failed)
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("abort")) {
      return { success: false, error: "Функція генерації недоступна (можливо, йде деплой). Спробуйте через 1-2 хвилини." };
    }
    return { success: false, error: msg };
  }
}

// Генерация через внешний вебхук Codex (через прокси Edge Function)
async function startCodexGeneration(
  prompt: string,
  language?: string,
  websiteType?: WebsiteType,
  layoutStyle?: string,
  siteName?: string,
  overrideTeamId?: string,
  geo?: string
): Promise<GenerationResult> {
  let historyId: string | null = null;
  let salePrice = 0;
  let teamId: string | null = overrideTeamId || null;

  try {
    // Try to get fresh token first
    let accessToken = await getFreshAccessToken();
    
    if (!accessToken) {
      return { success: false, error: "Необхідна авторизація. Будь ласка, увійдіть знову." };
    }
    
    const { data: { session } } = await supabase.auth.getSession();

    // If no override teamId, get user's team from membership
    if (!teamId) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .single();

      if (membership?.team_id) {
        teamId = membership.team_id;
      }
    }

    if (teamId) {
      // Get team pricing
      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("external_price")
        .eq("team_id", teamId)
        .single();

      salePrice = pricing?.external_price ?? 7; // Default $7 for external

      // Get team balance and check credit limit
      const { data: team } = await supabase
        .from("teams")
        .select("balance, credit_limit")
        .eq("id", teamId)
        .single();

      if (team) {
        const currentBalance = team.balance || 0;
        const creditLimit = team.credit_limit || 0;
        const newBalance = currentBalance - salePrice;

        // Check if new balance would exceed credit limit
        if (newBalance < -creditLimit) {
          return { 
            success: false, 
            error: `Перевищено кредитний ліміт. Поточний баланс: $${currentBalance.toFixed(2)}, вартість: $${salePrice}, ліміт: $${creditLimit}. Поповніть баланс для продовження.` 
          };
        }

        await supabase.from("teams").update({ balance: newBalance }).eq("id", teamId);
      }
    }

    // 1. Create generation_history record with pending status AND team_id
    // Append geo context to prompt if provided
    const promptWithGeo = appendGeoToPrompt(prompt, geo);
    
    const { data: historyRecord, error: insertError } = await supabase
      .from("generation_history")
      .insert({
        user_id: session.user.id,
        team_id: teamId || null,
        prompt: promptWithGeo,
        language: language || "en",
        status: "pending",
        site_name: siteName,
        website_type: websiteType || "html",
        ai_model: "senior",
        specific_ai_model: "codex-external",
        generation_cost: 1, // Fixed cost $1 for external generations
        sale_price: salePrice,
        geo: geo || null,
      })
      .select("id")
      .single();

    if (insertError || !historyRecord) {
      console.error("Failed to create history record:", insertError);
      // Refund if we already deducted
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
        if (team) {
          await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
        }
      }
      return { success: false, error: "Failed to create generation record" };
    }

    historyId = historyRecord.id;

    // 2. Update status to generating
    await supabase.from("generation_history").update({ status: "generating" }).eq("id", historyId);

    // 3. Вызываем backend-функцию (fire-and-forget)
    // Чтобы было стабильнее (без CORS/Failed to fetch) — вызываем через supabase SDK и передаем только historyId.
    const { error: invokeError } = await supabase.functions.invoke("codex-proxy", {
      body: { historyId },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (invokeError) {
      const finalMsg = (invokeError.message || "Failed to start generation").trim().slice(0, 500);

      // Refund balance
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
        if (team) {
          await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
        }
      }

      await supabase
        .from("generation_history")
        .update({ status: "failed", error_message: finalMsg, sale_price: 0 })
        .eq("id", historyId);

      return { success: false, error: finalMsg, historyId };
    }

    // Success — generation started in background
    // codex-proxy will update the record when finished
    return {
      success: true,
      historyId,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    // Refund balance on error
    if (teamId && salePrice > 0) {
      try {
        const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
        if (team) {
          await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
        }
      } catch {
        // ignore refund error
      }
    }

    if (historyId) {
      try {
        await supabase
          .from("generation_history")
          .update({ status: "failed", error_message: msg, sale_price: 0 })
          .eq("id", historyId);
      } catch {
        // ignore
      }
      return { success: false, error: msg, historyId };
    }

    return { success: false, error: msg };
  }
}

// Генерация через v0.dev API (Реактивний Михайло)
async function startV0Generation(
  prompt: string,
  language?: string,
  websiteType?: WebsiteType,
  layoutStyle?: string,
  siteName?: string,
  overrideTeamId?: string,
  geo?: string
): Promise<GenerationResult> {
  let historyId: string | null = null;
  let salePrice = 0;
  let teamId: string | null = overrideTeamId || null;

  try {
    // Try to get fresh token first
    let accessToken = await getFreshAccessToken();
    
    if (!accessToken) {
      return { success: false, error: "Необхідна авторизація. Будь ласка, увійдіть знову." };
    }
    
    const { data: { session } } = await supabase.auth.getSession();

    // If no override teamId, get user's team from membership
    if (!teamId) {
      const { data: membership } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", session.user.id)
        .eq("status", "approved")
        .single();

      if (membership?.team_id) {
        teamId = membership.team_id;
      }
    }

    if (teamId) {
      // Get team pricing
      const { data: pricing } = await supabase
        .from("team_pricing")
        .select("external_price")
        .eq("team_id", teamId)
        .single();

      salePrice = pricing?.external_price ?? 7; // Default $7 for external

      // Get team balance and check credit limit
      const { data: team } = await supabase
        .from("teams")
        .select("balance, credit_limit")
        .eq("id", teamId)
        .single();

      if (team) {
        const currentBalance = team.balance || 0;
        const creditLimit = team.credit_limit || 0;
        const newBalance = currentBalance - salePrice;

        // Check if new balance would exceed credit limit
        if (newBalance < -creditLimit) {
          return { 
            success: false, 
            error: `Перевищено кредитний ліміт. Поточний баланс: $${currentBalance.toFixed(2)}, вартість: $${salePrice}, ліміт: $${creditLimit}. Поповніть баланс для продовження.` 
          };
        }

        await supabase.from("teams").update({ balance: newBalance }).eq("id", teamId);
      }
    }

    // 1. Create generation_history record with pending status AND team_id
    // Append geo context to prompt if provided
    const promptWithGeo = appendGeoToPrompt(prompt, geo);
    
    const { data: historyRecord, error: insertError } = await supabase
      .from("generation_history")
      .insert({
        user_id: session.user.id,
        team_id: teamId || null,
        prompt: promptWithGeo,
        language: language || "en",
        status: "pending",
        site_name: siteName,
        website_type: websiteType || "react", // v0.dev generates React
        ai_model: "senior",
        specific_ai_model: "v0-reaktiv",
        generation_cost: 1, // Fixed cost $1 for external generations
        sale_price: salePrice,
        geo: geo || null,
      })
      .select("id")
      .single();

    if (insertError || !historyRecord) {
      console.error("Failed to create history record:", insertError);
      // Refund if we already deducted
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
        if (team) {
          await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
        }
      }
      return { success: false, error: "Failed to create generation record" };
    }

    historyId = historyRecord.id;

    // 2. Update status to generating
    await supabase.from("generation_history").update({ status: "generating" }).eq("id", historyId);

    // 3. Вызываем backend-функцию v0-proxy (fire-and-forget)
    const { error: invokeError } = await supabase.functions.invoke("v0-proxy", {
      body: { historyId },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (invokeError) {
      const finalMsg = (invokeError.message || "Failed to start generation").trim().slice(0, 500);

      // Refund balance
      if (teamId && salePrice > 0) {
        const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
        if (team) {
          await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
        }
      }

      await supabase
        .from("generation_history")
        .update({ status: "failed", error_message: finalMsg, sale_price: 0 })
        .eq("id", historyId);

      return { success: false, error: finalMsg, historyId };
    }

    // Success — generation started in background
    // v0-proxy will update the record when finished
    return {
      success: true,
      historyId,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    // Refund balance on error
    if (teamId && salePrice > 0) {
      try {
        const { data: team } = await supabase.from("teams").select("balance").eq("id", teamId).single();
        if (team) {
          await supabase.from("teams").update({ balance: (team.balance || 0) + salePrice }).eq("id", teamId);
        }
      } catch {
        // ignore refund error
      }
    }

    if (historyId) {
      try {
        await supabase
          .from("generation_history")
          .update({ status: "failed", error_message: msg, sale_price: 0 })
          .eq("id", historyId);
      } catch {
        // ignore
      }
      return { success: false, error: msg, historyId };
    }

    return { success: false, error: msg };
  }
}

// Legacy function for backward compatibility
export async function generateWebsite(
  prompt: string,
  language?: string,
  aiModel: AiModel = "senior",
  websiteType: WebsiteType = "html",
  layoutStyle?: string
): Promise<GenerationResult> {
  return startGeneration(prompt, language, aiModel, websiteType, layoutStyle);
}

export async function createZipFromFiles(files: GeneratedFile[]): Promise<Blob> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  return await zip.generateAsync({ type: "blob" });
}

export async function createZipBase64(files: GeneratedFile[]): Promise<string> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  return await zip.generateAsync({ type: "base64" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
