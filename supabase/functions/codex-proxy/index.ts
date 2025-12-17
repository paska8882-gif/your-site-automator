import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as zip from "https://deno.land/x/zipjs@v2.7.32/index.js";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Model pricing (per 1M tokens)
const MODEL_PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gpt-5-2025-08-07": { input: 5.0, output: 15.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
};

const GENERATION_PROMPT = `Create a COMPLETE, PROFESSIONAL website with ALL necessary files.

CRITICAL REQUIREMENTS:
- Cookie banner on EVERY page (functional, shows until accepted)
- Include: terms.html, privacy.html, cookie-policy.html
- robots.txt and sitemap.xml in root directory
- "Scroll to top" button that resets scroll on navigation
- NO pricing, costs, or monetary amounts
- Proper lang attribute matching site language
- 5-8 content sections on index.html + header/footer
- Unique page paths (not generic names)
- Humanized, natural text content (avoid AI patterns)
- Full meta data for SEO
- Use exact domain/address/phone from client

TECHNICAL REQUIREMENTS:
- Semantic HTML5, modern CSS (Flexbox/Grid), vanilla JavaScript
- Fully responsive mobile-first design
- Accessible (ARIA labels), SEO optimized
- Cross-browser compatible

INCLUDE THESE FEATURES:
- Working contact form
- Mobile navigation menu  
- Image galleries
- Call-to-action buttons
- Social media links
- Footer with sitemap

**IMAGE HANDLING - CRITICAL RULES:**
- **DO NOT use specific Pexels URLs from examples**
- **USE ONLY generic placeholder services:**
  - https://picsum.photos/1200/800?random=1 (change number for each image)
  - https://placehold.co/1200x800/EFEFEF/AAA?text=Image+Description
  - https://via.placeholder.com/1200x800/EFEFEF/AAA?text=Business+Image
- **Image dimensions:** 1200x800 for hero, 800x600 for content
- **Alt text MUST describe business context** (not generic)
- **Each image gets unique random parameter**

CODING STANDARDS:
- Clean, maintainable code
- Proper file organization
- **Generic placeholder images only**
- No specific Pexels photo URLs

FORMAT:
<!-- FILE: filename -->
[complete file content]

Return ALL files with FULL, WORKING code.`;

interface GeneratedFile {
  path: string;
  content: string;
}

function parseFilesFromResponse(responseText: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  const filePattern = /<!-- FILE: ([^>]+) -->([\s\S]*?)(?=<!-- FILE: |$)/g;
  
  let match;
  while ((match = filePattern.exec(responseText)) !== null) {
    const fileName = match[1].trim();
    let fileContent = match[2].trim();
    
    if (fileContent && fileContent.length > 10) {
      files.push({
        path: fileName,
        content: fileContent
      });
      console.log(`✅ Found: ${fileName} (${fileContent.length} chars)`);
    }
  }
  
  console.log(`📁 Total files found: ${files.length}`);
  return files;
}

function calculateCost(usage: any, model: string): number {
  if (!usage) return 0;
  const inputTokens = usage.input_tokens ?? usage.prompt_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? usage.completion_tokens ?? 0;
  const price = MODEL_PRICE_PER_MILLION[model] ?? MODEL_PRICE_PER_MILLION["gpt-5-2025-08-07"];
  const costUSD =
    (inputTokens / 1000000) * price.input + (outputTokens / 1000000) * price.output;
  return Math.round(costUSD * 10000) / 10000;
}

async function createZipBase64(files: GeneratedFile[]): Promise<string> {
  const blobWriter = new zip.BlobWriter("application/zip");
  const zipWriter = new zip.ZipWriter(blobWriter);
  
  for (const file of files) {
    await zipWriter.add(file.path, new zip.TextReader(file.content));
  }
  
  const zipBlob = await zipWriter.close();
  const arrayBuffer = await zipBlob.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

async function runCodexGeneration(
  prompt: string,
  language: string,
  siteName: string,
  historyId: string,
  supabaseUrl: string,
  supabaseKey: string
) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";

  if (!openaiApiKey && !lovableApiKey) {
    throw new Error("No AI API key configured");
  }
  
  console.log(`🚀 Starting Codex generation for: ${siteName}`);
  
  // Update status to generating
  await (supabase as any)
    .from("generation_history")
    .update({ status: "generating" })
    .eq("id", historyId);
  
  try {
    // Prefer OpenAI if available; if OpenAI quota is exhausted, fallback to Lovable AI gateway
    const openAiModels = openaiApiKey ? ["gpt-4o", "gpt-5-2025-08-07"] : [];

    let responseText = "";
    let cost = 1; // keep existing baseline cost unless we can calculate precisely
    let usedModel = "";
    let lastError = "";
    let openAiQuotaExceeded = false;

    for (const model of openAiModels) {
      console.log(`📤 Calling OpenAI API with ${model}...`);

      // Create AbortController for timeout (5 minutes per attempt)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Fetch timeout triggered after 5 minutes for ${model}`);
        controller.abort();
      }, 5 * 60 * 1000);

      let response: Response;
      try {
        const requestBody: any = {
          model,
          messages: [
            { role: "system", content: GENERATION_PROMPT },
            { role: "user", content: prompt },
          ],
        };

        // Different token params for different models
        if (model.includes("gpt-5")) {
          requestBody.max_completion_tokens = 50000;
        } else {
          requestBody.max_tokens = 16000;
          requestBody.temperature = 0.7;
        }

        response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
      } catch (fetchErr) {
        lastError = `OpenAI fetch failed for ${model}: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`;
        console.error(`❌ ${lastError}`);
        continue;
      } finally {
        clearTimeout(timeoutId);
      }

      console.log(`📥 ${model} responded with status:`, response.status);

      if (!response.ok) {
        const errorText = await response.text();
        lastError = `OpenAI API error for ${model}: ${response.status} ${errorText}`;
        console.error(lastError);

        if (response.status === 429 && errorText.includes("insufficient_quota")) {
          openAiQuotaExceeded = true;
          break;
        }

        continue;
      }

      const data = await response.json();
      console.log(`📥 ${model} response received, usage:`, JSON.stringify(data.usage));
      console.log(`📥 finish_reason:`, data.choices?.[0]?.finish_reason);

      // Check finish_reason - if "length", model ran out of tokens
      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        lastError = `OpenAI ${model} hit token limit (finish_reason: length)`;
        console.warn(`⚠️ ${lastError}`);
        continue;
      }

      // Extract response text
      responseText = data.choices?.[0]?.message?.content || "";

      if (!responseText || responseText.length < 100) {
        lastError = `OpenAI ${model} returned empty/short content`;
        console.error(`❌ ${lastError}`);
        continue;
      }

      // Calculate cost for OpenAI models (token-based)
      cost = calculateCost(data.usage, model);

      usedModel = model;
      console.log(`✅ Got valid response from ${model}, length: ${responseText.length} chars, cost: $${cost}`);
      break;
    }

    // Fallback: Lovable AI gateway (works even when OpenAI quota is exceeded)
    if (!responseText && lovableApiKey && (openAiQuotaExceeded || !openaiApiKey)) {
      const gatewayModel = "google/gemini-2.5-flash";
      console.log(`📤 Calling Lovable AI gateway with ${gatewayModel}...`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`⏰ Fetch timeout triggered after 5 minutes for Lovable gateway ${gatewayModel}`);
        controller.abort();
      }, 5 * 60 * 1000);

      try {
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: gatewayModel,
            messages: [
              { role: "system", content: GENERATION_PROMPT },
              { role: "user", content: prompt },
            ],
            stream: false,
          }),
          signal: controller.signal,
        });

        console.log(`📥 Lovable gateway responded with status:`, resp.status);

        if (!resp.ok) {
          const t = await resp.text();
          lastError = `Lovable gateway error: ${resp.status} ${t}`;
          console.error(lastError);
        } else {
          const data = await resp.json();
          responseText = data.choices?.[0]?.message?.content || "";

          if (!responseText || responseText.length < 100) {
            lastError = "Lovable gateway returned empty/short content";
            console.error(`❌ ${lastError}`);
            responseText = "";
          } else {
            usedModel = gatewayModel;
            console.log(`✅ Got valid response from Lovable gateway, length: ${responseText.length} chars`);
          }
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (!responseText) {
      throw new Error(lastError || "All models failed to generate content");
    }

    console.log(`📝 Response length: ${responseText.length} chars from ${usedModel}`);

    
    // Parse files from response
    const files = parseFilesFromResponse(responseText);
    
    if (files.length === 0) {
      console.error("No files parsed. Response preview:", responseText.substring(0, 500));
      throw new Error("No files parsed from response");
    }
    
    // Create ZIP
    console.log("📦 Creating ZIP archive...");
    const zipBase64 = await createZipBase64(files);
    
    // Update generation_history with results
    const { error: updateError } = await (supabase as any)
      .from("generation_history")
      .update({
        status: "completed",
        files_data: files,
        zip_data: zipBase64,
        generation_cost: cost,
        error_message: null,
        specific_ai_model: usedModel
      })
      .eq("id", historyId);
    
    if (updateError) {
      console.error("Failed to update generation_history:", updateError);
      throw updateError;
    }
    
    console.log(`✅ Generation completed: ${files.length} files, cost: $${cost}, model: ${usedModel}`);
    
    // Get user info for notification
    const { data: historyData } = await (supabase as any)
      .from("generation_history")
      .select("user_id, site_name")
      .eq("id", historyId)
      .single();
    
    if (historyData?.user_id) {
      await (supabase as any).from("notifications").insert({
        user_id: historyData.user_id,
        title: "Генерація завершена",
        message: `Сайт "${historyData.site_name || siteName}" успішно згенеровано (${files.length} файлів)`,
        type: "generation_complete",
        data: { historyId, filesCount: files.length }
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("❌ Generation failed:", errorMessage);
    
    // Update with error
    await (supabase as any)
      .from("generation_history")
      .update({
        status: "failed",
        error_message: errorMessage
      })
      .eq("id", historyId);
    
    // Get user_id and refund balance
    const { data: historyData } = await (supabase as any)
      .from("generation_history")
      .select("user_id, sale_price, site_name")
      .eq("id", historyId)
      .single();
    
    if (historyData?.user_id && historyData?.sale_price) {
      // Get user's team
      const { data: teamMember } = await (supabase as any)
        .from("team_members")
        .select("team_id")
        .eq("user_id", historyData.user_id)
        .eq("status", "approved")
        .single();
      
      if (teamMember?.team_id) {
        // Refund the balance
        const { data: team } = await (supabase as any)
          .from("teams")
          .select("balance")
          .eq("id", teamMember.team_id)
          .single();
        
        if (team) {
          await (supabase as any)
            .from("teams")
            .update({ balance: team.balance + historyData.sale_price })
            .eq("id", teamMember.team_id);
          
          // Reset sale_price to indicate refund
          await (supabase as any)
            .from("generation_history")
            .update({ sale_price: 0 })
            .eq("id", historyId);
        }
      }
      
      // Send failure notification
      await (supabase as any).from("notifications").insert({
        user_id: historyData.user_id,
        title: "Помилка генерації",
        message: `Не вдалося згенерувати сайт "${historyData.site_name}". Кошти повернено.`,
        type: "generation_failed",
        data: { historyId, error: errorMessage }
      });
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { historyId } = body;

    if (!historyId || typeof historyId !== "string") {
      return new Response(JSON.stringify({ error: "Missing historyId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing backend credentials");
    }

    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // Read the generation record under RLS (so users can't запускать чужие historyId)
    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: history, error: historyErr } = await (authed as any)
      .from("generation_history")
      .select("prompt, language, site_name")
      .eq("id", historyId)
      .single();

    if (historyErr || !history?.prompt) {
      const msg = historyErr?.message || "Generation not found";
      return new Response(JSON.stringify({ error: msg }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    const prompt: string = history.prompt;
    const language: string = history.language || "en";
    const siteName: string = history.site_name || "Website";

    console.log("🎯 Queuing Codex generation for:", siteName, "historyId:", historyId);

    // Run in background (do NOT block the HTTP request)
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          await runCodexGeneration(prompt, language, siteName, historyId, supabaseUrl, serviceRoleKey);
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown error";
          console.error("❌ Background generation crashed:", msg);

          const supabase = createClient(supabaseUrl, serviceRoleKey);
          await (supabase as any)
            .from("generation_history")
            .update({ status: "failed", error_message: msg, sale_price: 0 })
            .eq("id", historyId);
        }
      })()
    );

    return new Response(JSON.stringify({ success: true, historyId, message: "Generation started" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Codex proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
