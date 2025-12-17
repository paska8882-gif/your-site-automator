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

// Pricing for gpt-5-2025-08-07 (per 1M tokens)
const PRICE_PER_MILLION = {
  input: 5.00,
  output: 15.00
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

function calculateCost(usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number }) {
  if (!usage) return 0;
  
  const costUSD = 
    ((usage.input_tokens || 0) / 1000000) * PRICE_PER_MILLION.input +
    ((usage.output_tokens || 0) / 1000000) * PRICE_PER_MILLION.output;
  
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
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  
  console.log(`🚀 Starting Codex generation for: ${siteName}`);
  
  // Update status to generating
  await (supabase as any)
    .from("generation_history")
    .update({ status: "generating" })
    .eq("id", historyId);
  
  try {
    // Call OpenAI API with gpt-5-2025-08-07 (flagship model)
    console.log("📤 Calling OpenAI API with gpt-5-2025-08-07...");
    
    // Create AbortController for timeout (8 minutes)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("⏰ Fetch timeout triggered after 8 minutes");
      controller.abort();
    }, 8 * 60 * 1000);
    
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: "gpt-5-2025-08-07",
          messages: [
            {
              role: "system",
              content: GENERATION_PROMPT
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_completion_tokens: 100000
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
    
    console.log("📥 OpenAI responded with status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log("📥 OpenAI response received, usage:", JSON.stringify(data.usage));
    
    // Calculate cost
    const cost = calculateCost(data.usage);
    console.log(`💰 Generation cost: $${cost}`);
    
    // Extract response text from chat completions format
    const responseText = data.choices?.[0]?.message?.content || '';
    
    if (!responseText) {
      console.error("Empty response from OpenAI:", JSON.stringify(data));
      throw new Error("No text in OpenAI response");
    }
    
    console.log(`📝 Response length: ${responseText.length} chars`);
    
    // Parse files from response
    const files = parseFilesFromResponse(responseText);
    
    if (files.length === 0) {
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
        error_message: null
      })
      .eq("id", historyId);
    
    if (updateError) {
      console.error("Failed to update generation_history:", updateError);
      throw updateError;
    }
    
    console.log(`✅ Generation completed: ${files.length} files, cost: $${cost}`);
    
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
    const body = await req.json();
    const { historyId, prompt, language, siteName } = body;
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase credentials");
    }
    
    console.log("🎯 Starting Codex generation for:", siteName, "historyId:", historyId);

    // Run generation in background
    EdgeRuntime.waitUntil(
      runCodexGeneration(prompt, language, siteName, historyId, supabaseUrl, supabaseKey)
    );

    // Return immediately
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Generation started in background",
      historyId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Codex proxy error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
