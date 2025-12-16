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
  seniorMode?: SeniorMode
): Promise<GenerationResult> {
  // Если выбран режим Codex для Senior AI - обращаемся к внешнему вебхуку
  if (aiModel === "senior" && seniorMode === "codex") {
    return startCodexGeneration(prompt, language, websiteType, layoutStyle, siteName);
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
      body: JSON.stringify({ prompt, language, aiModel, layoutStyle, siteName, seniorMode }),
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
  siteName?: string
): Promise<GenerationResult> {
  let historyId: string | null = null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: "Authentication required" };
    }

    // 1. Создаём запись в generation_history со статусом pending
    const { data: historyRecord, error: insertError } = await supabase
      .from("generation_history")
      .insert({
        user_id: session.user.id,
        prompt,
        language: language || "en",
        status: "pending",
        site_name: siteName,
        website_type: websiteType || "html",
        ai_model: "senior",
        specific_ai_model: "codex-external",
      })
      .select("id")
      .single();

    if (insertError || !historyRecord) {
      console.error("Failed to create history record:", insertError);
      return { success: false, error: "Failed to create generation record" };
    }

    historyId = historyRecord.id;

    // 2. Обновляем статус на generating
    await supabase.from("generation_history").update({ status: "generating" }).eq("id", historyId);

    // 3. Вызываем Edge Function прокси (fire-and-forget)
    // n8n сам запишет результат в БД когда закончит
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/codex-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        prompt,
        language,
        websiteType,
        layoutStyle,
        siteName,
        userId: session.user.id,
        historyId, // передаём ID записи чтобы n8n мог обновить её
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      let finalMsg = "";
      try {
        const maybeJson = JSON.parse(errText);
        finalMsg = typeof maybeJson?.error === "string" ? maybeJson.error : errText;
      } catch {
        finalMsg = errText;
      }
      finalMsg = (finalMsg || `HTTP ${resp.status}`).trim().slice(0, 500);

      await supabase
        .from("generation_history")
        .update({ status: "failed", error_message: finalMsg })
        .eq("id", historyId);

      return { success: false, error: finalMsg, historyId };
    }

    // Успех — генерація запущена у фоні
    // n8n сам оновить запис в БД коли закінчить
    return {
      success: true,
      historyId,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";

    if (historyId) {
      try {
        await supabase
          .from("generation_history")
          .update({ status: "failed", error_message: msg })
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
