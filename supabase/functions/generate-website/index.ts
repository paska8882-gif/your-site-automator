import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Ти — створатор промптів для багатосторінкових сайтів. Твоя задача — проаналізувати запит і створити промпт для генерації професійного багатосторінкового сайту.

**КРИТИЧНО ВАЖЛИВО: ВИЗНАЧЕННЯ МОВИ**
При визначенні мови керуйся наступними пріоритетами:
1. **Явне вказання в запиті** — якщо користувач явно вказав мову (наприклад, "Language: EN", "Мова: українська"), використовуй ВКАЗАНУ мову
2. **Мова контенту** — якщо мова явно не вказана, аналізуй мову представленого контенту
3. **За замовчуванням** — якщо мову неможливо визначити, використовуй англійську (EN)

**АНАЛІЗ ЗАПИТУ:**
1. **Визнач мову користувача** — використовуй правила пріоритету вище
2. **Визнач структуру сайту** — які сторінки потрібні користувачу
3. **Витягни ключову інформацію** — компанія, послуги, контакти, УТП
4. **Збережи мову і стиль** — точно як у запиті
5. **Визнач кількість сторінок** — скільки сторінок вказано або логічно потрібно

**СТВОРЕННЯ СТРУКТУРИ:**
- Якщо користувач вказав конкретні сторінки — використовуй ЇХ
- Якщо не вказав — запропонуй логічну структуру (Головна, Послуги, Контакти + кілька ключових)
- Зазвичай 5-7 сторінок для бізнес-сайту
- Включи всі додаткові сторінки (FAQ, Умови, Конфіденційність)

**ФОРМАТ ВИВОДУ:**

Create a professional MULTI-PAGE website for [Назва] with complete structure:

**LANGUAGE:** [Визначена мова з запиту за правилами]

**MULTI-PAGE STRUCTURE:**
[Перелічи ВСІ сторінки які потрібні]

**DESIGN:**
- Language: [Мова з запиту]
- Colors: [Кольори з запиту АБО професійна палітра]
- Style: [Стиль з запиту]
- **PREMIUM DESIGN: Modern, professional, excellent UX**

**TECHNICAL:**
- Semantic HTML5 with working navigation between pages
- CSS Grid/Flexbox, mobile-first responsive
- Consistent header/footer across ALL pages
- **FUNCTIONAL COOKIE BANNER with Accept/Decline buttons**
- All pages fully functional and complete
- Working images from picsum.photos`.trim();

const HTML_GENERATION_PROMPT = `You are an expert product designer and front-end developer.

GOAL: generate a premium, multi-page STATIC website (HTML/CSS + optional vanilla JS) that matches the user's request EXACTLY.

ABSOLUTE RULES:
- Output ONLY file blocks using EXACT markers: <!-- FILE: filename.ext -->
- NO markdown, NO backticks, NO explanations.
- Use ONLY static files (no React, no build tools, no npm).

REQUIRED FILES (must output ALL of these):
- <!-- FILE: index.html -->
- <!-- FILE: about.html -->
- <!-- FILE: services.html --> (or products.html if clearly more suitable)
- <!-- FILE: contact.html -->
- <!-- FILE: privacy.html -->
- <!-- FILE: terms.html -->
- <!-- FILE: 404.html -->
- <!-- FILE: styles.css --> (single shared stylesheet)
- <!-- FILE: robots.txt -->
- <!-- FILE: sitemap.xml -->
- <!-- FILE: script.js --> (include only if you add interactive behavior like mobile menu/cookie banner)

DESIGN & UX (10x quality):
- Consistent, identical header + footer across all pages (only active link state changes)
- Mobile-first responsive layout; perfect spacing and typography hierarchy
- Use CSS Grid/Flexbox and CSS variables (:root) for theming
- Smooth hover/focus transitions (≈300ms)
- Accessibility: labels, focus states, aria where needed

SEO (EVERY PAGE):
- Unique <title> under 60 chars with primary keyword
- <meta name="description"> under 160 chars
- <link rel="canonical" href="https://example.com/<page>" />
- Open Graph tags (og:title, og:description, og:type=website)
- Exactly ONE <h1> per page

**CRITICAL - IMAGES ARE MANDATORY:**
Every page MUST have real images using picsum.photos. This is NON-NEGOTIABLE.

IMAGE REQUIREMENTS:
- Hero section: MUST have a large hero image (1200x600 or similar)
- Each page: minimum 2-3 images relevant to content
- Use these EXACT URL patterns:
  * Hero: <img src="https://picsum.photos/1200/600?random=1" alt="[descriptive text]" loading="lazy">
  * Content: <img src="https://picsum.photos/800/500?random=2" alt="[descriptive text]" loading="lazy">
  * Cards/Features: <img src="https://picsum.photos/400/300?random=3" alt="[descriptive text]" loading="lazy">
  * Team/People: <img src="https://picsum.photos/300/300?random=4" alt="[descriptive text]" loading="lazy">
  * Background sections: Use CSS with url('https://picsum.photos/1920/800?random=5')
- Change the ?random=N number for each unique image (1,2,3,4,5,6...)
- All images MUST have descriptive alt text
- All images MUST have loading="lazy"
- Style images with proper CSS (border-radius, object-fit: cover, shadows)

EXAMPLE HERO SECTION:
<section class="hero">
  <img src="https://picsum.photos/1920/800?random=hero" alt="Professional business services" class="hero-image">
  <div class="hero-content">
    <h1>Welcome to Our Company</h1>
    <p>Your tagline here</p>
  </div>
</section>

COOKIE BANNER:
- Include a functional cookie consent banner with Accept/Decline, styled to match the site.

SITEMAP/ROBOTS:
- sitemap.xml must list all pages with example.com URLs
- robots.txt should allow crawling and link to sitemap.xml

Return the COMPLETE website with ALL images now.`;


type GeneratedFile = { path: string; content: string };

type GenerationResult = {
  success: boolean;
  files?: GeneratedFile[];
  refinedPrompt?: string;
  totalFiles?: number;
  fileList?: string[];
  error?: string;
  rawResponse?: string;
};

const cleanFileContent = (content: string) => {
  let c = content.trim();
  c = c.replace(/^```[a-z0-9_-]*\s*\n/i, "");
  c = c.replace(/\n```\s*$/i, "");
  return c.trim();
};

const parseFilesFromModelText = (rawText: string) => {
  const normalizedText = rawText.replace(/\r\n/g, "\n");
  const filesMap = new Map<string, string>();

  const upsertFile = (path: string, content: string, source: string) => {
    const cleanPath = path.trim();
    const cleanContent = cleanFileContent(content);
    if (!cleanPath || cleanContent.length <= 10) return;
    filesMap.set(cleanPath, cleanContent);
    console.log(`✅ Found (${source}): ${cleanPath} (${cleanContent.length} chars)`);
  };

  const filePattern1 = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
  let match;
  while ((match = filePattern1.exec(normalizedText)) !== null) {
    upsertFile(match[1], match[2], "format1");
  }

  if (filesMap.size === 0) {
    console.log("Trying OpenAI markdown headings format...");

    const headers: { path: string; start: number; contentStart: number }[] = [];
    const headerRegex = /(^|\n)(?:###\s*(?:File:\s*)?(?:[A-Za-z]+\s*\()?\s*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\)?|\*\*([A-Za-z0-9_\-\/\.]+\.(?:css|html|js|jsx|json|xml|txt|toml|md))\*\*)/gi;

    while ((match = headerRegex.exec(normalizedText)) !== null) {
      const fileName = (match[2] || match[3] || "").trim();
      if (!fileName) continue;

      const afterHeader = match.index + match[0].length;
      const lineBreak = normalizedText.indexOf("\n", afterHeader);
      const contentStart = lineBreak === -1 ? normalizedText.length : lineBreak + 1;

      headers.push({ path: fileName, start: match.index, contentStart });
    }

    for (let i = 0; i < headers.length; i++) {
      const start = headers[i].contentStart;
      const end = headers[i + 1]?.start ?? normalizedText.length;
      const chunk = normalizedText.slice(start, end);
      upsertFile(headers[i].path, chunk, "format2");
    }
  }

  return Array.from(filesMap.entries()).map(([path, content]) => ({ path, content }));
};

async function runGeneration({
  prompt,
  language,
  aiModel,
}: {
  prompt: string;
  language?: string;
  aiModel: "junior" | "senior";
}): Promise<GenerationResult> {
  const isJunior = aiModel === "junior";
  console.log(`Using ${isJunior ? "Junior AI (OpenAI GPT-4o)" : "Senior AI (Lovable AI)"} for HTML generation`);

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

  if (isJunior && !OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY not configured");
    return { success: false, error: "OpenAI API key not configured for Junior AI" };
  }

  if (!isJunior && !LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY not configured");
    return { success: false, error: "Lovable AI not configured for Senior AI" };
  }

  console.log("Generating HTML website for prompt:", prompt.substring(0, 100));

  const apiUrl = isJunior
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const apiKey = isJunior ? OPENAI_API_KEY : LOVABLE_API_KEY;
  const refineModel = isJunior ? "gpt-4o-mini" : "google/gemini-2.5-flash";
  const generateModel = isJunior ? "gpt-4o" : "google/gemini-2.5-pro";

  // Step 1: refined prompt
  const agentResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: refineModel,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Створи детальний промпт для генерації статичного HTML/CSS сайту на основі цього запиту:\n\n"${prompt}"\n\nМова контенту: ${language || "auto-detect"}`,
        },
      ],
    }),
  });

  if (!agentResponse.ok) {
    const errorText = await agentResponse.text();
    console.error("Agent AI error:", agentResponse.status, errorText);

    if (agentResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later." };
    if (agentResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds." };

    return { success: false, error: "AI agent error" };
  }

  const agentData = await agentResponse.json();
  const refinedPrompt = agentData.choices?.[0]?.message?.content || prompt;
  console.log("Refined prompt generated, now generating HTML website...");

  // Step 2: Static HTML website generation
  const websiteRequestBody: Record<string, unknown> = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert HTML/CSS/JS generator. Return ONLY file blocks using exact markers like: <!-- FILE: index.html -->. No explanations. No markdown.",
      },
      {
        role: "user",
        content: `${HTML_GENERATION_PROMPT}\n\n=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n=== LANGUAGE ===\n${language || "Detect from request"}\n\n=== ENHANCED DETAILS (KEEP FIDELITY TO ORIGINAL) ===\n${refinedPrompt}`,
      },
    ],
  };

  if (isJunior) {
    websiteRequestBody.max_tokens = 16000;
  }

  const websiteResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(websiteRequestBody),
  });

  if (!websiteResponse.ok) {
    const errorText = await websiteResponse.text();
    console.error("Website generation error:", websiteResponse.status, errorText);

    if (websiteResponse.status === 429) return { success: false, error: "Rate limit exceeded. Please try again later." };
    if (websiteResponse.status === 402) return { success: false, error: "AI credits exhausted. Please add funds." };

    return { success: false, error: "Website generation failed" };
  }

  const websiteData = await websiteResponse.json();
  const rawText = websiteData.choices?.[0]?.message?.content || "";

  console.log("HTML website generated, parsing files...");
  console.log("Raw response length:", rawText.length);

  const files = parseFilesFromModelText(rawText);
  console.log(`📁 Total files parsed: ${files.length}`);

  if (files.length === 0) {
    console.error("No files parsed from response");
    return {
      success: false,
      error: "Failed to parse generated files",
      rawResponse: rawText.substring(0, 500),
    };
  }

  return {
    success: true,
    files,
    refinedPrompt,
    totalFiles: files.length,
    fileList: files.map((f) => f.path),
  };
}

async function runBackgroundGeneration(
  historyId: string,
  prompt: string,
  language: string | undefined,
  aiModel: "junior" | "senior"
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[BG] Starting background generation for history ID: ${historyId}`);

  try {
    // Update status to generating
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    const result = await runGeneration({ prompt, language, aiModel });

    if (result.success && result.files) {
      // Create zip base64
      const { default: JSZip } = await import("https://esm.sh/jszip@3.10.1");
      const zip = new JSZip();
      result.files.forEach((file) => zip.file(file.path, file.content));
      const zipBase64 = await zip.generateAsync({ type: "base64" });

      // Update with success
      await supabase
        .from("generation_history")
        .update({
          status: "completed",
          files_data: result.files,
          zip_data: zipBase64,
        })
        .eq("id", historyId);

      console.log(`[BG] Generation completed for ${historyId}: ${result.files.length} files`);
    } else {
      // Update with error
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
        })
        .eq("id", historyId);

      console.error(`[BG] Generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] Background generation error for ${historyId}:`, error);
    await supabase
      .from("generation_history")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", historyId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.warn("Request rejected: No authorization header");
      return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user from token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Authenticated request from user:", user.id);

    const { prompt, language, aiModel = "senior" } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create history entry immediately with pending status
    const { data: historyEntry, error: insertError } = await supabase
      .from("generation_history")
      .insert({
        prompt,
        language: language || "auto",
        user_id: user.id,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !historyEntry) {
      console.error("Failed to create history entry:", insertError);
      return new Response(JSON.stringify({ success: false, error: "Failed to start generation" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Created history entry:", historyEntry.id);

    // Start background generation using EdgeRuntime.waitUntil
    EdgeRuntime.waitUntil(
      runBackgroundGeneration(historyEntry.id, prompt, language, aiModel)
    );

    // Return immediately with the history entry ID
    return new Response(
      JSON.stringify({
        success: true,
        historyId: historyEntry.id,
        message: "Generation started in background",
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
