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

type SseEvent =
  | { type: "status"; stage: string }
  | { type: "result"; result: GenerationResult }
  | { type: "error"; error: string; result?: GenerationResult };

async function parseSSE(resp: Response): Promise<GenerationResult> {
  if (!resp.body) return { success: false, error: "No response body" };

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let lastResult: GenerationResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":")) continue; // keepalive/comment
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        return lastResult || { success: false, error: "Stream ended without result" };
      }

      try {
        const evt = JSON.parse(jsonStr) as SseEvent;
        if (evt.type === "result") lastResult = evt.result;
        if (evt.type === "error") return { success: false, error: evt.error };
      } catch {
        // partial JSON split across chunks: re-buffer
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  return lastResult || { success: false, error: "Stream ended without result" };
}

export async function generateWebsite(
  prompt: string,
  language?: string,
  aiModel: AiModel = "senior",
  websiteType: WebsiteType = "html"
): Promise<GenerationResult> {
  const functionName = websiteType === "react" ? "generate-react-website" : "generate-website";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minutes

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      clearTimeout(timeoutId);
      return { success: false, error: "Authentication required" };
    }

    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ prompt, language, aiModel }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { success: false, error: errText || `HTTP ${resp.status}` };
    }

    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      return await parseSSE(resp);
    }

    const data = (await resp.json().catch(() => null)) as GenerationResult | null;
    return data || { success: false, error: "No response from server" };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Request timed out after 10 minutes" };
    }
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
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
