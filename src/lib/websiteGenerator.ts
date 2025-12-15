import { supabase } from "@/integrations/supabase/client";
import JSZip from "jszip";

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationResult {
  success: boolean;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
}

export type AiModel = "junior" | "senior";
export type WebsiteType = "html" | "react";

export async function generateWebsite(
  prompt: string,
  language?: string,
  aiModel: AiModel = "senior",
  websiteType: WebsiteType = "html"
): Promise<GenerationResult> {
  const functionName = websiteType === "react" ? "generate-react-website" : "generate-website";
  
  // Use fetch with 10 minute timeout instead of supabase.functions.invoke
  // because the default fetch timeout is too short for AI generation
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ prompt, language, aiModel }),
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return data || { success: false, error: "No response from server" };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: "Request timed out after 10 minutes" };
    }
    console.error("Edge function error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function createZipFromFiles(
  files: GeneratedFile[]
): Promise<Blob> {
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

export async function saveToHistory(
  prompt: string,
  language: string,
  files: GeneratedFile[],
  userId: string
): Promise<void> {
  try {
    const zipBase64 = await createZipBase64(files);
    
    const { error } = await supabase.from("generation_history").insert({
      prompt,
      language,
      zip_data: zipBase64,
      user_id: userId,
    });

    if (error) {
      console.error("Error saving to history:", error);
    }
  } catch (error) {
    console.error("Error creating zip for history:", error);
  }
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
