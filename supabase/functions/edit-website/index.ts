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

// Optimized prompt - AI returns ONLY specific changes as search/replace blocks
const EDIT_SYSTEM_PROMPT = `You are an expert website editor. Your job is to make PRECISE, TARGETED edits to existing website files.

CRITICAL: Use SEARCH/REPLACE blocks for efficiency - do NOT return entire files!

OUTPUT FORMAT (MANDATORY):
<<<<<<< SEARCH filename.ext
exact text to find (3-10 lines of context)
=======
replacement text
>>>>>>> REPLACE

RULES:
1. Make ONLY the specific change requested - NOTHING ELSE
2. Use SEARCH/REPLACE blocks - this is faster than returning full files
3. Include enough context in SEARCH to uniquely identify the location (usually 3-10 lines)
4. The SEARCH text must match EXACTLY what's in the file
5. You can have multiple SEARCH/REPLACE blocks for one file
6. If you need to add new content, use nearby existing lines as context
7. DO NOT change images, layout, or styles unless specifically asked

EXAMPLE - Changing a button color:
<<<<<<< SEARCH styles.css
.btn-primary {
  background-color: #3498db;
  color: white;
}
=======
.btn-primary {
  background-color: #e74c3c;
  color: white;
}
>>>>>>> REPLACE

EXAMPLE - Changing text:
<<<<<<< SEARCH index.html
<h1 class="hero-title">Welcome to Our Site</h1>
<p class="hero-subtitle">We build amazing things</p>
=======
<h1 class="hero-title">Welcome to My Portfolio</h1>
<p class="hero-subtitle">I create beautiful websites</p>
>>>>>>> REPLACE

IMPORTANT:
- Use SEARCH/REPLACE for small changes (1-20 lines)
- If changing 50%+ of a file, use <!-- FILE: filename.ext --> format with full content instead
- Be precise - wrong SEARCH text will fail to match`;

// Model configurations with timeouts
const MODELS = {
  senior: [
    { name: "google/gemini-2.5-pro", timeout: 120000, gateway: "lovable" },
    { name: "google/gemini-2.5-flash", timeout: 90000, gateway: "lovable" },
  ],
  junior: [
    { name: "google/gemini-2.5-flash", timeout: 90000, gateway: "lovable" },
    { name: "google/gemini-2.5-flash-lite", timeout: 60000, gateway: "lovable" },
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
          // Lower temperature = fewer "creative" unintended edits
          temperature: 0.2,
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
          temperature: 0.2,
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

  // If we selected too few files, include styles.css as a fallback ONLY for style requests.
  // For text-only edits, adding CSS increases context and encourages unintended changes.
  if (selected.length < 2 && needsStyles) {
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

interface SearchReplaceBlock {
  filename: string;
  search: string;
  replace: string;
}

// Clean AI response from markdown code blocks
function cleanAIResponse(content: string): string {
  // Remove wrapping ```html or ```css or ``` blocks
  let cleaned = content
    // remove any opening fences like ```html
    .replace(/```[a-zA-Z0-9_-]*\s*\n/g, "")
    // remove closing fences
    .replace(/\n```\s*/g, "\n")
    .trim();
  
  return cleaned;
}

// Parse SEARCH/REPLACE blocks from AI response
function parseSearchReplaceBlocks(content: string): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = [];
  
  // Clean markdown code blocks first
  const cleaned = cleanAIResponse(content);
  
  // Match: <<<<<<< SEARCH filename.ext ... ======= ... >>>>>>> REPLACE
  // More flexible regex to handle various whitespace
  const blockRegex = /<<<<<<<?[=\s]*SEARCH\s+([^\n]+)\n([\s\S]*?)\n=======[=]*\n([\s\S]*?)\n>>>>>>>[>]*\s*REPLACE/gi;
  
  let match;
  while ((match = blockRegex.exec(cleaned)) !== null) {
    const filename = match[1].trim();
    const search = match[2];
    const replace = match[3];
    
    if (filename && search !== undefined) {
      blocks.push({ filename, search, replace });
    }
  }
  
  // Try alternative format if no blocks found
  if (blocks.length === 0) {
    // Try simpler format: SEARCH filename ... REPLACE
    const altRegex = /SEARCH\s+([^\n]+)\n([\s\S]*?)\nREPLACE\n([\s\S]*?)(?=\nSEARCH|\n<<<|$)/gi;
    while ((match = altRegex.exec(cleaned)) !== null) {
      const filename = match[1].trim();
      const search = match[2].trim();
      const replace = match[3].trim();
      
      if (filename && search) {
        blocks.push({ filename, search, replace });
      }
    }
  }

  // Last-ditch: handle a truncated block where the model forgot/omitted the closing >>>>>>> REPLACE
  // We treat everything after ======= as the replacement until end of message.
  if (blocks.length === 0) {
    const truncatedRegex = /<<<<<<<?[=\s]*SEARCH\s+([^\n]+)\n([\s\S]*?)\n=======[=]*\n([\s\S]*)$/i;
    const m = cleaned.match(truncatedRegex);
    if (m) {
      const filename = m[1].trim();
      const search = m[2];
      const replace = m[3];
      if (filename && search) {
        blocks.push({ filename, search, replace });
      }
    }
  }
  
  return blocks;
}

// Parse full file replacements (legacy format)
function parseFullFileReplacements(content: string): GeneratedFile[] {
  const cleaned = cleanAIResponse(content);
  
  const fileMatches = cleaned.matchAll(
    /<!--\s*FILE:\s*([^\s->]+)\s*-->([\s\S]*?)(?=<!--\s*FILE:|<<<<<<|SEARCH\s|$)/gi
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

// Last resort: try to extract any HTML/CSS file content
function parseAnyFileContent(content: string, currentFiles: GeneratedFile[]): GeneratedFile[] {
  const cleaned = cleanAIResponse(content);
  
  // If response contains substantial HTML, try to figure out which file it belongs to
  if (cleaned.includes('<!DOCTYPE') || cleaned.includes('<html') || cleaned.includes('<head')) {
    // Looks like full HTML - probably index.html
    const htmlContent = cleaned.replace(/^[\s\S]*?(<!DOCTYPE|<html)/i, '$1').trim();
    if (htmlContent.length > 500) {
      return [{ path: 'index.html', content: htmlContent }];
    }
  }
  
  // Check if it looks like CSS
  if (cleaned.includes('{') && cleaned.includes('}') && 
      (cleaned.includes('.') || cleaned.includes('#') || cleaned.includes('@media'))) {
    const hasHtml = cleaned.includes('<') && cleaned.includes('>');
    if (!hasHtml && cleaned.length > 200) {
      // Find the CSS file in current files
      const cssFile = currentFiles.find(f => f.path.endsWith('.css'));
      if (cssFile) {
        return [{ path: cssFile.path, content: cleaned }];
      }
    }
  }
  
  return [];
}

// Apply search/replace blocks to original files
function applySearchReplaceBlocks(
  originalFiles: GeneratedFile[],
  blocks: SearchReplaceBlock[]
): { modifiedFiles: GeneratedFile[]; appliedCount: number; failedBlocks: string[] } {
  const fileMap = new Map<string, string>();
  originalFiles.forEach(f => fileMap.set(f.path, f.content));
  
  let appliedCount = 0;
  const failedBlocks: string[] = [];
  const modifiedPaths = new Set<string>();
  
  for (const block of blocks) {
    const originalContent = fileMap.get(block.filename);
    
    if (originalContent === undefined) {
      console.warn(`File not found for SEARCH/REPLACE: ${block.filename}`);
      failedBlocks.push(`File not found: ${block.filename}`);
      continue;
    }
    
    const searchCandidates: { label: string; search: string; replace: string; applyOnNormalized?: boolean }[] = [
      // 1) Exact (best-case)
      { label: "exact", search: block.search, replace: block.replace },
      // 2) Trim whole block (common)
      { label: "trim", search: block.search.trim(), replace: block.replace.trim() },
      // 3) Normalize per-line trailing whitespace (VERY common from LLMs)
      {
        label: "trimEndLines",
        search: block.search.split("\n").map((l) => l.trimEnd()).join("\n"),
        replace: block.replace.split("\n").map((l) => l.trimEnd()).join("\n"),
        applyOnNormalized: true,
      },
    ];

    let applied = false;
    for (const cand of searchCandidates) {
      if (!cand.search) continue;

      if (cand.applyOnNormalized) {
        const normalizedContent = originalContent
          .split("\n")
          .map((l) => l.trimEnd())
          .join("\n");

        if (normalizedContent.includes(cand.search)) {
          const newNormalized = normalizedContent.replace(cand.search, cand.replace);
          fileMap.set(block.filename, newNormalized);
          modifiedPaths.add(block.filename);
          appliedCount++;
          applied = true;
          console.log(`Applied SEARCH/REPLACE (${cand.label}) to ${block.filename}`);
          break;
        }
      } else {
        if (originalContent.includes(cand.search)) {
          const newContent = originalContent.replace(cand.search, cand.replace);
          fileMap.set(block.filename, newContent);
          modifiedPaths.add(block.filename);
          appliedCount++;
          applied = true;
          console.log(`Applied SEARCH/REPLACE (${cand.label}) to ${block.filename}`);
          break;
        }
      }
    }

    if (!applied) {
      console.warn(
        `SEARCH block not found in ${block.filename}. Search text: "${block.search.substring(0, 100)}..."`
      );
      failedBlocks.push(`Not found in ${block.filename}: "${block.search.substring(0, 50)}..."`);
    }
  }
  
  // Return only modified files
  const modifiedFiles: GeneratedFile[] = [];
  modifiedPaths.forEach(path => {
    modifiedFiles.push({ path, content: fileMap.get(path)! });
  });
  
  return { modifiedFiles, appliedCount, failedBlocks };
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
    const { generationId, editRequest, currentFiles, aiModel, websiteType, currentPage } = body;

    if (!generationId || !editRequest || !currentFiles || currentFiles.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Edit request for generation ${generationId}: ${editRequest}`);
    console.log(`AI Model: ${aiModel}, Website Type: ${websiteType}, Current Page: ${currentPage || "index.html"}`);
    console.log(`Total files: ${currentFiles.length}`);

    // Select only relevant files
    const relevantFiles = selectRelevantFiles(currentFiles, editRequest);
    console.log(`Selected ${relevantFiles.length} relevant files: ${relevantFiles.map((f: GeneratedFile) => f.path).join(", ")}`);

    // Build optimized context
    const filesContext = relevantFiles
      .map((f: GeneratedFile) => `<!-- FILE: ${f.path} -->\n${f.content}`)
      .join("\n\n");

    // Determine which page is active
    const activePage = currentPage || "index.html";
    
    const editPrompt = `WEBSITE FILES (${relevantFiles.length} relevant files):
${filesContext}

USER IS CURRENTLY VIEWING: ${activePage}
USER REQUEST: ${editRequest}

CRITICAL INSTRUCTIONS:
1. The user is looking at "${activePage}" - make changes TO THIS FILE primarily unless the request is about styles/scripts
2. Make REAL, VISIBLE changes that the user will see immediately
3. Use SEARCH/REPLACE blocks with EXACT text from the file
4. If changing text - find the exact text in the file and replace it
5. If changing colors/styles - edit the CSS file (styles.css)
6. Do NOT return empty or no-op changes
7. Include enough context (3-10 lines) in SEARCH to uniquely identify the location
8. The SEARCH text must match EXACTLY what's in the file (copy-paste accuracy)`;

    const messages = [
      { role: "system", content: EDIT_SYSTEM_PROMPT },
      { role: "user", content: editPrompt },
    ];

    // Use smaller max_tokens since we're using SEARCH/REPLACE
    const maxTokens = relevantFiles.length <= 3 ? 4000 : 8000;

    // Call AI with fallback
    const modelToUse = aiModel === "senior" ? "senior" : "junior";
    const { content, modelUsed } = await callAIWithFallback(modelToUse, messages, maxTokens);

    console.log(`AI response from ${modelUsed}, length: ${content.length}`);

    // First try to parse SEARCH/REPLACE blocks (new optimized format)
    const searchReplaceBlocks = parseSearchReplaceBlocks(content);
    console.log(`Found ${searchReplaceBlocks.length} SEARCH/REPLACE blocks`);
    
    let modifiedFiles: GeneratedFile[] = [];
    let editMethod = "unknown";
    
    if (searchReplaceBlocks.length > 0) {
      // Apply SEARCH/REPLACE blocks - fast and efficient!
      const { modifiedFiles: patchedFiles, appliedCount, failedBlocks } = 
        applySearchReplaceBlocks(currentFiles, searchReplaceBlocks);
      
      modifiedFiles = patchedFiles;
      editMethod = `SEARCH/REPLACE (${appliedCount} applied, ${failedBlocks.length} failed)`;
      
      if (failedBlocks.length > 0) {
        console.warn("Failed blocks:", failedBlocks);
      }
    }
    
    // Fallback: parse full file replacements (legacy format)
    if (modifiedFiles.length === 0) {
      const fullFileReplacements = parseFullFileReplacements(content);
      if (fullFileReplacements.length > 0) {
        modifiedFiles = fullFileReplacements;
        editMethod = `FULL_FILE (${fullFileReplacements.length} files)`;
        console.log(`Using full file replacement for: ${fullFileReplacements.map(f => f.path).join(", ")}`);
      }
    }
    
    // Last resort: try to parse any recognizable file content
    if (modifiedFiles.length === 0) {
      const anyFiles = parseAnyFileContent(content, currentFiles);
      if (anyFiles.length > 0) {
        modifiedFiles = anyFiles;
        editMethod = `FALLBACK_PARSE (${anyFiles.length} files)`;
        console.log(`Using fallback parsing for: ${anyFiles.map(f => f.path).join(", ")}`);
      }
    }
    
    console.log(`Edit method: ${editMethod}, Modified files: ${modifiedFiles.map(f => f.path).join(", ")}`);

    if (modifiedFiles.length === 0) {
      console.error("No files parsed from response. Content preview:", content.substring(0, 1000));
      throw new Error("AI не повернув змін у правильному форматі. Спробуйте ще раз або сформулюйте запит інакше.");
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
