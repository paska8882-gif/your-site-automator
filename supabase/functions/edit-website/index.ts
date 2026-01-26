import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeneratedFile {
  path: string;
  content: string;
}

// Optimized prompt - AI returns ONLY changed files
const EDIT_SYSTEM_PROMPT = `You are an expert website editor. Your job is to modify existing website files based on user requests.

CRITICAL RULES:
1. Make ONLY the specific change requested - NOTHING ELSE
2. DO NOT modify anything that wasn't explicitly asked to change
3. Keep ALL other content, styles, images, and structure EXACTLY as they are
4. Return ONLY the files you actually modified - NOT all files
5. If you need to change 1 file, return only that 1 file
6. DO NOT change images unless specifically asked
7. DO NOT change layout unless specifically asked

OUTPUT FORMAT (MANDATORY):
<!-- FILE: filename.ext -->
<complete file content here>

IMPORTANT:
- Return COMPLETE file contents for files you modify
- Do not use markdown code blocks
- Use ONLY the <!-- FILE: --> markers
- Only include files that have actual changes`;

// Model configurations with timeouts
const MODELS = {
  senior: [
    { name: "google/gemini-2.5-flash", timeout: 90000, gateway: "lovable" },
    { name: "google/gemini-2.5-flash-lite", timeout: 60000, gateway: "lovable" },
  ],
  junior: [
    { name: "gpt-4o", timeout: 90000, gateway: "openai" },
    { name: "gpt-4o-mini", timeout: 60000, gateway: "openai" },
  ],
};

async function callAIWithTimeout(
  model: { name: string; timeout: number; gateway: string },
  messages: { role: string; content: string }[],
  maxTokens: number
): Promise<{ content: string; modelUsed: string } | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), model.timeout);

  try {
    let response: Response;

    if (model.gateway === "lovable") {
      const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!lovableApiKey) throw new Error("LOVABLE_API_KEY not configured");

      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.name,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    } else {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) throw new Error("OPENAI_API_KEY not configured");

      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model.name,
          messages,
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Model ${model.name} error:`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`Model ${model.name} returned no content`);
      return null;
    }

    return { content, modelUsed: model.name };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    const err = error as Error;
    if (err.name === "AbortError") {
      console.warn(`Model ${model.name} timed out after ${model.timeout}ms`);
    } else {
      console.error(`Model ${model.name} error:`, error);
    }
    return null;
  }
}

async function callAIWithFallback(
  aiModel: "junior" | "senior",
  messages: { role: string; content: string }[],
  maxTokens: number
): Promise<{ content: string; modelUsed: string }> {
  const models = MODELS[aiModel];

  for (const model of models) {
    console.log(`Trying model: ${model.name}`);
    const result = await callAIWithTimeout(model, messages, maxTokens);
    if (result) {
      console.log(`Success with model: ${model.name}`);
      return result;
    }
  }

  throw new Error("All AI models failed or timed out");
}

// Determine which files are likely relevant based on the edit request
function selectRelevantFiles(
  files: GeneratedFile[],
  editRequest: string
): GeneratedFile[] {
  const request = editRequest.toLowerCase();
  const selected: GeneratedFile[] = [];
  const filesByPath = new Map(files.map((f) => [f.path.toLowerCase(), f]));

  // Always include index.html - it's the main file
  const indexHtml = files.find((f) => f.path.toLowerCase() === "index.html");
  if (indexHtml) selected.push(indexHtml);

  // Check for style-related keywords
  const styleKeywords = ["color", "колір", "стиль", "style", "css", "шрифт", "font", "background", "фон", "border", "margin", "padding", "розмір", "size"];
  const needsStyles = styleKeywords.some((kw) => request.includes(kw));
  if (needsStyles) {
    const cssFiles = files.filter((f) => 
      f.path.toLowerCase().includes("style") || 
      f.path.toLowerCase().endsWith(".css")
    );
    cssFiles.forEach((f) => {
      if (!selected.includes(f)) selected.push(f);
    });
  }

  // Check for script/JS keywords
  const jsKeywords = ["script", "js", "javascript", "функці", "function", "click", "клік", "button", "кнопк", "form", "форм", "slider", "carousel", "animation", "анімац"];
  const needsJs = jsKeywords.some((kw) => request.includes(kw));
  if (needsJs) {
    const jsFiles = files.filter((f) => 
      f.path.toLowerCase().endsWith(".js") ||
      f.path.toLowerCase().includes("script")
    );
    jsFiles.forEach((f) => {
      if (!selected.includes(f)) selected.push(f);
    });
  }

  // Check for page-specific keywords
  const pageKeywords: Record<string, string[]> = {
    "about": ["about", "про нас", "о нас"],
    "contact": ["contact", "контакт", "зв'язок", "связь"],
    "services": ["service", "послуг", "услуг"],
    "gallery": ["gallery", "галере", "фото", "photo"],
    "blog": ["blog", "блог", "news", "новин"],
    "faq": ["faq", "питан", "вопрос"],
    "terms": ["terms", "умови", "условия", "privacy", "приватн"],
  };

  for (const [pageName, keywords] of Object.entries(pageKeywords)) {
    if (keywords.some((kw) => request.includes(kw))) {
      const pageFile = files.find((f) => 
        f.path.toLowerCase().includes(pageName)
      );
      if (pageFile && !selected.includes(pageFile)) {
        selected.push(pageFile);
      }
    }
  }

  // If translation/i18n is mentioned
  const i18nKeywords = ["переклад", "перевод", "translation", "мов", "язык", "language", "i18n"];
  if (i18nKeywords.some((kw) => request.includes(kw))) {
    const i18nFiles = files.filter((f) => 
      f.path.toLowerCase().includes("i18n") || 
      f.path.toLowerCase().includes("translation")
    );
    i18nFiles.forEach((f) => {
      if (!selected.includes(f)) selected.push(f);
    });
  }

  // If header/footer/nav mentioned
  const layoutKeywords = ["header", "шапк", "footer", "підвал", "nav", "меню", "menu", "logo", "лого"];
  if (layoutKeywords.some((kw) => request.includes(kw))) {
    // For HTML sites, header/footer are usually in index.html (already included)
    // For component sites, might have separate files
    const layoutFiles = files.filter((f) => 
      f.path.toLowerCase().includes("header") || 
      f.path.toLowerCase().includes("footer") ||
      f.path.toLowerCase().includes("nav")
    );
    layoutFiles.forEach((f) => {
      if (!selected.includes(f)) selected.push(f);
    });
  }

  // If we selected too few files, include styles.css as a fallback
  if (selected.length < 2) {
    const stylesFile = files.find((f) => 
      f.path.toLowerCase() === "styles.css" || 
      f.path.toLowerCase() === "css/styles.css"
    );
    if (stylesFile && !selected.includes(stylesFile)) {
      selected.push(stylesFile);
    }
  }

  // Limit to 8 files max to keep context manageable
  return selected.slice(0, 8);
}

function parseFilesFromResponse(content: string): GeneratedFile[] {
  const fileMatches = content.matchAll(
    /<!--\s*FILE:\s*([^\s->]+)\s*-->([\s\S]*?)(?=<!--\s*FILE:|$)/gi
  );
  const parsedFiles: GeneratedFile[] = [];

  for (const match of fileMatches) {
    const path = match[1].trim();
    let fileContent = match[2].trim();

    // Clean up content
    fileContent = fileContent
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/\n?```$/gm, "")
      .trim();

    if (path && fileContent) {
      parsedFiles.push({ path, content: fileContent });
    }
  }

  return parsedFiles;
}

function mergeFiles(
  originalFiles: GeneratedFile[],
  modifiedFiles: GeneratedFile[]
): GeneratedFile[] {
  const result = new Map<string, GeneratedFile>();

  // Start with all original files
  for (const file of originalFiles) {
    result.set(file.path, file);
  }

  // Overlay modified files
  for (const file of modifiedFiles) {
    result.set(file.path, file);
  }

  return Array.from(result.values());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { generationId, editRequest, currentFiles, aiModel, websiteType } = body;

    if (!generationId || !editRequest || !currentFiles || currentFiles.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Edit request for generation ${generationId}: ${editRequest}`);
    console.log(`AI Model: ${aiModel}, Website Type: ${websiteType}`);
    console.log(`Total files: ${currentFiles.length}`);

    // Select only relevant files
    const relevantFiles = selectRelevantFiles(currentFiles, editRequest);
    console.log(`Selected ${relevantFiles.length} relevant files: ${relevantFiles.map((f: GeneratedFile) => f.path).join(", ")}`);

    // Build optimized context
    const filesContext = relevantFiles
      .map((f: GeneratedFile) => `<!-- FILE: ${f.path} -->\n${f.content}`)
      .join("\n\n");

    const editPrompt = `WEBSITE FILES (${relevantFiles.length} relevant files):
${filesContext}

USER REQUEST: ${editRequest}

INSTRUCTIONS:
- Return ONLY the files you need to modify
- If you only need to change index.html, return only index.html
- Include complete file content for each modified file
- Do NOT return files that don't need changes`;

    const messages = [
      { role: "system", content: EDIT_SYSTEM_PROMPT },
      { role: "user", content: editPrompt },
    ];

    // Use max_tokens based on context size
    const maxTokens = relevantFiles.length <= 3 ? 8000 : 16000;

    // Call AI with fallback
    const modelToUse = aiModel === "senior" ? "senior" : "junior";
    const { content, modelUsed } = await callAIWithFallback(modelToUse, messages, maxTokens);

    console.log(`AI response from ${modelUsed}, length: ${content.length}`);

    // Parse modified files
    const modifiedFiles = parseFilesFromResponse(content);
    console.log(`Parsed ${modifiedFiles.length} modified files: ${modifiedFiles.map((f) => f.path).join(", ")}`);

    if (modifiedFiles.length === 0) {
      console.error("No files parsed from response. Content preview:", content.substring(0, 500));
      throw new Error("Failed to parse edited files from AI response");
    }

    // Merge with original files
    const mergedFiles = mergeFiles(currentFiles, modifiedFiles);
    console.log(`Merged result: ${mergedFiles.length} total files`);

    // Determine what actually changed
    const currentByPath = new Map<string, string>(
      (currentFiles as GeneratedFile[]).map((f) => [f.path, f.content])
    );
    const changedPaths = modifiedFiles
      .filter((f) => currentByPath.get(f.path) !== f.content)
      .map((f) => f.path);

    // Create ZIP
    const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
    const zip = new JSZip();
    mergedFiles.forEach((file) => zip.file(file.path, file.content));
    const zipBase64 = await zip.generateAsync({ type: "base64" });

    // Update database
    const { error: updateError } = await supabase
      .from("generation_history")
      .update({
        files_data: mergedFiles,
        zip_data: zipBase64,
      })
      .eq("id", generationId)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Failed to save changes");
    }

    console.log(`Successfully updated generation ${generationId}. Changed: ${changedPaths.length}. Model: ${modelUsed}`);

    return new Response(
      JSON.stringify({
        success: true,
        files: mergedFiles,
        changedFiles: changedPaths,
        modelUsed,
        message:
          changedPaths.length === 0
            ? `Зміни не знайдено`
            : `Змінено ${changedPaths.length} файл(ів): ${changedPaths.join(", ")}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Edit error:", error);
    
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      if (error.message.includes("timed out") || error.message.includes("All AI models failed")) {
        errorMessage = "Час очікування вичерпано. Спробуйте ще раз або спростіть запит.";
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
