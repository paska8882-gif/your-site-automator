import { supabase } from "@/integrations/supabase/client";
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
export type SeniorMode = "codex" | "onepage" | "v0";

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

// Генерация через внешний вебхук Codex (ожидает ZIP в ответе)
async function startCodexGeneration(
  prompt: string,
  language?: string,
  websiteType?: WebsiteType,
  layoutStyle?: string,
  siteName?: string
): Promise<GenerationResult> {
  const CODEX_WEBHOOK_URL = "https://tryred.app.n8n.cloud/webhook/964e523f-9fd0-4462-99fd-3c94bb6d37af";

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return { success: false, error: "Authentication required" };
    }

    const resp = await fetch(CODEX_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        language,
        websiteType,
        layoutStyle,
        siteName,
        userId: session.user.id,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { success: false, error: errText || `HTTP ${resp.status}` };
    }

    // Получаем ZIP-файл как blob
    const zipBlob = await resp.blob();
    
    // Распаковываем ZIP и извлекаем файлы
    const zip = await JSZip.loadAsync(zipBlob);
    const files: GeneratedFile[] = [];
    
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async("string");
        files.push({ path, content });
      }
    }

    return {
      success: true,
      files,
      totalFiles: files.length,
      fileList: files.map((f) => f.path),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
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
