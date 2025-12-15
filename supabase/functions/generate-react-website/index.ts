import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Ти — створатор промптів для багатосторінкових React сайтів. Твоя задача — проаналізувати запит і створити промпт для генерації професійного багатосторінкового React сайту.

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

**ФОРМАТ ВИВОДУ:**

Create a professional MULTI-PAGE React website for [Назва] with complete structure:

**LANGUAGE:** [Визначена мова з запиту за правилами]

**MULTI-PAGE STRUCTURE:**
[Перелічи ВСІ сторінки які потрібні]

**DESIGN:**
- Language: [Мова з запиту]
- Colors: [Кольори з запиту АБО професійна палітра]
- Style: [Стиль з запиту]
- **PREMIUM DESIGN: Modern, professional, excellent UX**`.trim();

const REACT_GENERATION_PROMPT = `CRITICAL: CREATE EXCEPTIONAL MULTI-PAGE REACT WEBSITE WITH 10X BETTER UI

**DESIGN PHILOSOPHY - 10X BETTER UI:**
- Start with FUNCTIONAL and BEAUTIFUL base UI - Every pixel must serve a purpose
- Always make 10X better UI than standard - Go beyond expectations
- Use advanced CSS patterns - CSS Grid, Flexbox, custom properties
- Think like a product designer - Focus on user experience first

**LAYOUT REQUIREMENTS:**
- Header and Footer as REUSABLE components used in App.js layout
- Active nav link highlight using React Router
- Cookie banner with Accept/Decline and localStorage persistence
- All pages share same header/footer structure

**VISUAL EXCELLENCE GUIDELINES:**
- Whitespace is king - Generous spacing (1.5x standard)
- Clean typography system - Hierarchy: H1 > H2 > H3 > Body > Small
- Strategic color use - 60% primary, 30% secondary, 10% accent
- Consistent spacing scale - 4px, 8px, 16px, 24px, 32px, 48px, 64px
- Smooth transitions - 300ms ease-in-out for interactions

**GLOBAL CSS (src/styles/global.css) MUST BE AT LEAST 250 LINES with:**
- Reset/normalize styles
- CSS variables in :root (colors, spacing, fonts)
- Header with sticky navigation
- Hero section with image overlay/background
- Card/grid layouts for services/features
- Image containers with proper sizing (object-fit: cover)
- Footer with multi-column layout
- Cookie banner styling (position: fixed; bottom: 0)
- Mobile responsive breakpoints
- Hover/focus states
- Form styling

**IMAGE STRATEGY - MANDATORY ON EVERY PAGE:**
Use picsum.photos with EXTERNAL URLs only:
- Hero background: style={{backgroundImage: 'url(https://picsum.photos/1920/1080?random=1)'}}
- Content image: <img src="https://picsum.photos/800/600?random=2" alt="..." loading="lazy" />
- Card image: <img src="https://picsum.photos/600/400?random=3" alt="..." loading="lazy" />
- Team photo: <img src="https://picsum.photos/400/400?random=4" alt="..." loading="lazy" />
Change ?random=N for each unique image (1,2,3,4...)

**REQUIRED CSS FOR IMAGES:**
.hero {
  position: relative;
  min-height: 80vh;
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.5);
}
.hero-content { position: relative; z-index: 1; color: white; text-align: center; }
img { max-width: 100%; height: auto; display: block; }
.card img { width: 100%; height: 200px; object-fit: cover; border-radius: 8px 8px 0 0; }

**MOBILE-FIRST BREAKPOINTS:**
@media (min-width: 768px) { /* Tablet */ }
@media (min-width: 1024px) { /* Desktop */ }
@media (min-width: 1280px) { /* Large */ }

**REQUIRED FILES:**
<!-- FILE: package.json -->
{
  "name": "react-website",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0",
    "react-scripts": "5.0.1"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}

<!-- FILE: public/index.html -->
[Complete HTML with meta tags, Open Graph]

<!-- FILE: src/index.js -->
[React entry point]

<!-- FILE: src/App.js -->
[React Router with Header/Footer layout wrapping all routes]

<!-- FILE: src/components/Header.js -->
[Reusable header with navigation, active link styling]

<!-- FILE: src/components/Footer.js -->
[Reusable footer]

<!-- FILE: src/components/CookieBanner.js -->
[Cookie consent with Accept/Decline]

<!-- FILE: src/pages/Home.js -->
[Hero with background image, feature cards with images]

<!-- FILE: src/pages/Services.js -->
[Service cards with images]

<!-- FILE: src/pages/About.js -->
[Team photos, company info with images]

<!-- FILE: src/pages/Contact.js -->
[Contact form, info section]

<!-- FILE: src/pages/Terms.js -->
<!-- FILE: src/pages/Privacy.js -->
<!-- FILE: src/pages/NotFound.js -->

<!-- FILE: src/styles/global.css -->
[Complete CSS 250+ lines with all styles including image handling]

<!-- FILE: netlify.toml -->
<!-- FILE: vercel.json -->
<!-- FILE: public/_redirects -->
<!-- FILE: public/robots.txt -->

Generate EXCEPTIONAL React website with 10X better UI, proper image styling, and outstanding user experience. All styles MUST render correctly, NO markdown code blocks, NO backticks.`;

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
  console.log(`Using ${isJunior ? "Junior AI (OpenAI GPT-4o)" : "Senior AI (Lovable AI)"} for React generation`);

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

  console.log("Generating React website for prompt:", prompt.substring(0, 100));

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
          content: `Створи детальний промпт для генерації React сайту на основі цього запиту:\n\n"${prompt}"\n\nМова контенту: ${language || "auto-detect"}`,
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
  console.log("Refined prompt generated, now generating React website...");

  // Step 2: React website generation
  const websiteRequestBody: Record<string, unknown> = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert React generator. Return ONLY file blocks using exact markers like: <!-- FILE: src/App.js -->. No explanations. No markdown.",
      },
      {
        role: "user",
        content: `${REACT_GENERATION_PROMPT}\n\n=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n=== LANGUAGE ===\n${language || "Detect from request"}\n\n=== ENHANCED DETAILS (KEEP FIDELITY TO ORIGINAL) ===\n${refinedPrompt}`,
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

  console.log("React website generated, parsing files...");
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

  console.log(`[BG] Starting background React generation for history ID: ${historyId}`);

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

      console.log(`[BG] React generation completed for ${historyId}: ${result.files.length} files`);
    } else {
      // Update with error
      await supabase
        .from("generation_history")
        .update({
          status: "failed",
          error_message: result.error || "Generation failed",
        })
        .eq("id", historyId);

      console.error(`[BG] React generation failed for ${historyId}: ${result.error}`);
    }
  } catch (error) {
    console.error(`[BG] Background React generation error for ${historyId}:`, error);
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
