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

// Layout styles available for selection
export const LAYOUT_STYLES = [
  { id: "classic", name: "Класичний корпоративний" },
  { id: "asymmetric", name: "Модерн асиметричний" },
  { id: "editorial", name: "Журнальний" },
  { id: "bold", name: "Сміливі блоки" },
  { id: "minimalist", name: "Мінімалізм" },
  { id: "showcase", name: "Динамічна вітрина" },
  { id: "gradient", name: "Градієнтний" },
  { id: "brutalist", name: "Бруталізм" },
  { id: "saas", name: "SaaS продукт" },
  { id: "portfolio", name: "Креативне портфоліо" },
];

// Geo code to country name mapping
const GEO_NAMES: Record<string, string> = {
  uk: "United Kingdom",
  be: "Belgium",
  bg: "Bulgaria",
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

// Helper to get fresh access token (refresh if needed)
async function getFreshAccessToken(): Promise<string | null> {
  // First try to refresh the session
  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
  
  if (!refreshError && refreshData?.session?.access_token) {
    return refreshData.session.access_token;
  }
  
  // If refresh fails, try getting current session
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
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
  geo?: string // Target country/region for the website
): Promise<GenerationResult> {
  // Если выбран режим Codex для Senior AI - обращаемся к внешнему вебхуку
  if (aiModel === "senior" && seniorMode === "codex") {
    return startCodexGeneration(prompt, language, websiteType, layoutStyle, siteName, teamId, geo);
  }

  // Если выбран режим Реактивний Михайло - используем v0.dev API
  if (aiModel === "senior" && seniorMode === "reaktiv") {
    return startV0Generation(prompt, language, websiteType, layoutStyle, siteName, teamId, geo);
  }

  const functionName = websiteType === "react" 
    ? "generate-react-website" 
    : websiteType === "php" 
      ? "generate-php-website" 
      : "generate-website";

  const makeRequest = async (accessToken: string) => {
    return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ 
        prompt: improvedPrompt || prompt,
        originalPrompt: prompt,
        improvedPrompt: improvedPrompt || null,
        language, aiModel, layoutStyle, siteName, seniorMode, imageSource, teamId, geo 
      }),
    });
  };

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: "Необхідна авторизація. Будь ласка, увійдіть знову." };
    }

    let resp = await makeRequest(session.access_token);

    // If 401 error, try to refresh token and retry once
    if (resp.status === 401) {
      console.log("Got 401, attempting to refresh token...");
      const freshToken = await getFreshAccessToken();
      
      if (freshToken) {
        console.log("Token refreshed, retrying request...");
        resp = await makeRequest(freshToken);
      } else {
        return { success: false, error: "Сесія закінчилась. Будь ласка, увійдіть знову." };
      }
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      
      // Check for specific auth errors after retry
      if (resp.status === 401) {
        return { success: false, error: "Сесія закінчилась. Будь ласка, увійдіть знову." };
      }
      
      return { success: false, error: errText || `HTTP ${resp.status}` };
    }

    const data = await resp.json();
    return data;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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
