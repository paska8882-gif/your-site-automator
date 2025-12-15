import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Ти — створатор промптів для **статичних HTML/CSS сайтів**.

Твоя задача — проаналізувати запит користувача і створити детальний промпт для генерації професійного **статичного** сайту (без React, без збірки, без npm).

**КРИТИЧНО ВАЖЛИВО: ВИЗНАЧЕННЯ МОВИ**
При визначенні мови керуйся наступними пріоритетами:
1. **Явне вказання в запиті** — якщо користувач явно вказав мову, використовуй ВКАЗАНУ мову
2. **Мова контенту** — якщо мова явно не вказана, аналізуй мову представленого контенту
3. **За замовчуванням** — якщо мову неможливо визначити, використовуй англійську (EN)

**ФОРМАТ ВИВОДУ:**
Створи структурований промпт з:
- сторінками (головна + 3–6 додаткових)
- секціями кожної сторінки
- тональністю/стилем дизайну
- SEO вимогами (title/description, один H1 на сторінку)
- контентом (тексти, CTA, списки)
- візуальними підказками (зображення лише через https URL)`.trim();

const HTML_GENERATION_PROMPT = `IMPORTANT: FOLLOW EXACT PROMPT STRUCTURE FOR STATIC HTML WEBSITE GENERATION

Create a COMPLETE, PROFESSIONAL **static** website using ONLY:
- HTML files (multi-page)
- a single shared CSS file (styles.css)
- optional vanilla JS (script.js)

**ABSOLUTE RULES:**
- DO NOT generate React, npm, package.json, src/, build tools, or frameworks.
- Return ONLY file blocks using exact markers: <!-- FILE: filename.ext -->
- No markdown backticks. No explanations.

**REQUIRED FILES (minimum):**
1) <!-- FILE: index.html -->
2) <!-- FILE: about.html -->
3) <!-- FILE: services.html --> (or products.html if more suitable)
4) <!-- FILE: contact.html -->
5) <!-- FILE: privacy.html -->
6) <!-- FILE: terms.html -->
7) <!-- FILE: 404.html -->
8) <!-- FILE: styles.css -->
9) <!-- FILE: script.js --> (optional, but include if you add interactive UI)
10) <!-- FILE: robots.txt -->
11) <!-- FILE: sitemap.xml -->

**SEO REQUIREMENTS (EVERY PAGE):**
- Unique <title> under 60 characters and includes primary keyword
- <meta name="description"> under 160 characters
- <link rel="canonical" href="https://example.com/<page>" /> (use example.com)
- Open Graph tags (og:title, og:description, og:type=website)
- Exactly ONE <h1> per page

**DESIGN & UX:**
- Mobile-first responsive layout
- Use semantic HTML: header/nav/main/section/article/footer
- Accessible: proper labels, focus states, aria for menu, good contrast
- Clean typography hierarchy and spacing
- Use CSS variables in :root for colors, spacing, radius, shadows
- Smooth hover/focus transitions

**IMAGES:**
- Use ONLY full https:// URLs (e.g., https://picsum.photos/1200/800?random=1)
- Add descriptive alt text

**NAVIGATION:**
- Consistent header navigation across all pages
- Active link highlight via body class or JS (simple)
- Footer with basic links (Terms/Privacy/Contact)

**SITEMAP/ROBOTS:**
- sitemap.xml must list all HTML pages with example.com URLs
- robots.txt should allow crawling and point to sitemap.xml

Generate beautiful, production-quality HTML/CSS/JS that matches the user's request EXACTLY.`;


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

  // Step 2: Static HTML website generation (include original prompt explicitly)
  const websiteRequestBody: any = {
    model: generateModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert HTML/CSS/JS generator. You MUST build a static multi-page website EXACTLY matching the user's original request.\n\nReturn ONLY file blocks using exact markers like: <!-- FILE: index.html -->.\nNo explanations, no markdown backticks.",
      },
      {
        role: "user",
        content: `=== USER'S ORIGINAL REQUEST (MUST FOLLOW EXACTLY) ===\n${prompt}\n\n=== LANGUAGE ===\n${language || "Detect from request"}\n\n=== TECHNICAL REQUIREMENTS ===\n${HTML_GENERATION_PROMPT}\n\n=== ENHANCED DETAILS ===\n${refinedPrompt}\n\nIMPORTANT: Implement the static site to match the user's original request above.`,
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

    console.log("Authenticated request received");

    const { prompt, language, aiModel = "senior" } = await req.json();

    if (!prompt) {
      return new Response(JSON.stringify({ success: false, error: "Prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const wantsSSE = (req.headers.get("accept") || "").includes("text/event-stream");

    if (!wantsSSE) {
      const result = await runGeneration({ prompt, language, aiModel });
      const status = result.success ? 200 : 500;
      return new Response(JSON.stringify(result), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;

        const send = (payload: unknown) => {
          if (closed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        const keepAlive = () => {
          if (closed) return;
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        };

        send({ type: "status", stage: "started" });

        const keepAliveId = setInterval(keepAlive, 15_000);

        (async () => {
          try {
            send({ type: "status", stage: "working" });
            const result = await runGeneration({ prompt, language, aiModel });
            if (result.success) {
              send({ type: "result", result });
            } else {
              send({ type: "error", error: result.error || "Generation failed", result });
            }
          } catch (e) {
            console.error("Error generating website:", e);
            const msg = e instanceof Error ? e.message : "Unknown error";
            send({ type: "error", error: msg });
          } finally {
            clearInterval(keepAliveId);
            if (!closed) {
              controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
              closed = true;
              controller.close();
            }
          }
        })();

        req.signal.addEventListener("abort", () => {
          try {
            clearInterval(keepAliveId);
          } catch {
            // ignore
          }
          try {
            closed = true;
            controller.close();
          } catch {
            // ignore
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error generating website:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
