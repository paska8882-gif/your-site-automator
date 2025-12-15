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

export async function generateWebsite(
  prompt: string,
  language?: string
): Promise<GenerationResult> {
  const { data, error } = await supabase.functions.invoke<GenerationResult>(
    "generate-website",
    {
      body: { prompt, language },
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
