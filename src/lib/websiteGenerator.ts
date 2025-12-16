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
  siteName?: string
): Promise<GenerationResult> {
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
      body: JSON.stringify({ prompt, language, aiModel, layoutStyle, siteName }),
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
