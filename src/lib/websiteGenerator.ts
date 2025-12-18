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
export type WebsiteType = "html" | "react";
export type SeniorMode = "codex" | "onepage" | "v0" | undefined;
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

export async function startGeneration(
  prompt: string,
  language?: string,
  aiModel: AiModel = "senior",
  websiteType: WebsiteType = "html",
  layoutStyle?: string,
  siteName?: string,
  seniorMode?: SeniorMode,
  imageSource: ImageSource = "basic",
  teamId?: string // Optional team ID for admin generation
): Promise<GenerationResult> {
  // Если выбран режим Codex для Senior AI - обращаемся к внешнему вебхуку
  if (aiModel === "senior" && seniorMode === "codex") {
    return startCodexGeneration(prompt, language, websiteType, layoutStyle, siteName, teamId);
  }

  const functionName = websiteType === "react" ? "generate-react-website" : "generate-website";

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: "Authentication required" };
    }

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt, language, aiModel, layoutStyle, siteName, seniorMode, imageSource, teamId }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
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
  overrideTeamId?: string
): Promise<GenerationResult> {
  let historyId: string | null = null;
  let salePrice = 0;
  let teamId: string | null = overrideTeamId || null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: "Authentication required" };
    }

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
    const { data: historyRecord, error: insertError } = await supabase
      .from("generation_history")
      .insert({
        user_id: session.user.id,
        team_id: teamId || null,
        prompt,
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
        Authorization: `Bearer ${session.access_token}`,
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
