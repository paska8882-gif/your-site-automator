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
  
  const { data, error } = await supabase.functions.invoke<GenerationResult>(
    functionName,
    {
      body: { prompt, language, aiModel },
    }
  );

  if (error) {
    console.error("Edge function error:", error);
    return { success: false, error: error.message };
  }

  return data || { success: false, error: "No response from server" };
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
