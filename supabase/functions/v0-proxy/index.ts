import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// System prompt for v0.dev generation
const V0_SYSTEM_INSTRUCTION = `Create fully functional website ready for Netlify deployment. MUST include: 
1. netlify.toml with correct build settings
2. next.config.mjs with output: 'export' and trailingSlash: true
3. All required legal pages (Privacy, Terms, FAQ)
4. Cookie consent banner on all pages
5. Pexels.com images only (NO Unsplash)
6. TypeScript + Tailwind CSS + Next.js 14+
7. Fully responsive and optimized for production`;

// Enhanced prompt with Netlify requirements
function buildFinalPrompt(prompt: string): string {
  return `${prompt}

CRITICAL NETLIFY DEPLOYMENT REQUIREMENTS (MUST INCLUDE):

1. MANDATORY FILES:
   • netlify.toml file at root with EXACT content:
     [build]
     command = "npm run build"
     publish = "out"
     
     [build.environment]
     NODE_VERSION = "20.9.0"
     
     [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200

   • next.config.mjs with EXACT configuration:
     output: 'export'
     trailingSlash: true
     distDir: 'out'
     images.unoptimized: true

   • package.json MUST include:
     "scripts": { "build": "next build" }
     "engines": { "node": ">=20.9.0" }

2. REQUIRED LEGAL PAGES (ALL must exist and work):
   • Privacy Policy page (/privacy) - full legal text
   • Terms of Service page (/terms) - complete terms
   • FAQ page (/faq) - relevant questions/answers
   • Cookie consent banner on EVERY page

3. IMAGE REQUIREMENTS:
   • Use ONLY Pexels.com images (NO Unsplash)
   • 2-3 relevant images per page matching content
   • Optimize for web (appropriate sizes)

4. TECHNICAL SPECIFICATIONS:
   • Next.js 14+ with static export
   • TypeScript for type safety
   • Tailwind CSS for styling
   • React 18+ components
   • Fully responsive design

5. SEO & METADATA:
   • Proper meta tags on all pages
   • Open Graph tags for social sharing
   • robots.txt and sitemap.xml
   • Canonical URLs

VERIFICATION CHECKLIST:
✓ netlify.toml exists and is correct
✓ next.config.mjs has output: 'export' and trailingSlash: true
✓ All pages work with trailing slashes
✓ No build errors in Next.js
✓ Site deploys successfully to Netlify`;
}

async function runV0Generation(
  supabase: SupabaseClient,
  historyId: string,
  prompt: string,
  V0_API_KEY: string
): Promise<void> {
  console.log(`[v0-proxy] Starting generation for historyId: ${historyId}`);
  
  try {
    const finalPrompt = buildFinalPrompt(prompt);
    
    // Step 1: Create a new chat on v0.dev
    console.log("[v0-proxy] Creating new chat on v0.dev...");
    const createResponse = await fetch("https://api.v0.dev/v1/chats", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${V0_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: finalPrompt,
        system: V0_SYSTEM_INSTRUCTION,
        responseMode: "sync",
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[v0-proxy] v0.dev create chat error:", createResponse.status, errorText);
      throw new Error(`v0.dev API error: ${createResponse.status} - ${errorText.slice(0, 200)}`);
    }

    const chatData = await createResponse.json();
    console.log("[v0-proxy] Chat created:", chatData.id);
    
    const chatId = chatData.id;
    const versionId = chatData.latestVersionId || chatData.latestVersion?.id;
    
    if (!chatId || !versionId) {
      throw new Error("Missing chatId or versionId from v0.dev response");
    }

    // Step 2: Download the generated ZIP file
    console.log("[v0-proxy] Downloading ZIP from v0.dev...");
    const downloadUrl = `https://api.v0.dev/v1/chats/${chatId}/versions/${versionId}/download?format=zip&includeDefaultFiles=true`;
    
    const downloadResponse = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${V0_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text();
      console.error("[v0-proxy] v0.dev download error:", downloadResponse.status, errorText);
      throw new Error(`v0.dev download error: ${downloadResponse.status}`);
    }

    const zipArrayBuffer = await downloadResponse.arrayBuffer();
    console.log("[v0-proxy] Downloaded ZIP size:", zipArrayBuffer.byteLength);

    // Step 3: Parse ZIP and extract files
    const zip = new JSZip();
    const zipContents = await zip.loadAsync(zipArrayBuffer);
    
    const files: { path: string; content: string }[] = [];
    
    for (const [path, file] of Object.entries(zipContents.files)) {
      if (!file.dir) {
        try {
          const content = await file.async("string");
          files.push({ path, content });
        } catch {
          // Binary file, skip
          console.log("[v0-proxy] Skipping binary file:", path);
        }
      }
    }
    
    console.log("[v0-proxy] Extracted files:", files.length);

    // Step 4: Create new ZIP with extracted files
    const outputZip = new JSZip();
    for (const f of files) {
      outputZip.file(f.path, f.content);
    }
    const zipBase64 = await outputZip.generateAsync({ type: "base64" });

    // Step 5: Update generation_history
    const { error: updateError } = await supabase
      .from("generation_history")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        zip_data: zipBase64,
        files_data: files,
        specific_ai_model: "v0-reaktiv",
      })
      .eq("id", historyId);

    if (updateError) {
      console.error("[v0-proxy] Failed to update history:", updateError);
      throw new Error("Failed to save generation result");
    }

    console.log("[v0-proxy] Generation completed successfully!");

    // Step 6: Send notification
    const { data: historyData } = await supabase
      .from("generation_history")
      .select("user_id, site_name")
      .eq("id", historyId)
      .single();

    if (historyData?.user_id) {
      await supabase.from("notifications").insert({
        user_id: historyData.user_id,
        type: "generation_complete",
        title: "Генерація завершена",
        message: `Сайт "${historyData.site_name || "Без назви"}" успішно згенеровано через Реактивний Михайло`,
        data: { historyId },
      });
    }

  } catch (error) {
    console.error("[v0-proxy] Generation error:", error);
    
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Update history with error
    await supabase
      .from("generation_history")
      .update({
        status: "failed",
        error_message: errorMessage.slice(0, 500),
      })
      .eq("id", historyId);

    // Refund balance
    const { data: historyData } = await supabase
      .from("generation_history")
      .select("team_id, sale_price, user_id")
      .eq("id", historyId)
      .single();

    if (historyData?.team_id && historyData?.sale_price) {
      const { data: team } = await supabase
        .from("teams")
        .select("balance")
        .eq("id", historyData.team_id)
        .single();

      if (team) {
        await supabase
          .from("teams")
          .update({ balance: (team.balance || 0) + historyData.sale_price })
          .eq("id", historyData.team_id);
        
        console.log("[v0-proxy] Refunded:", historyData.sale_price);
      }
    }

    // Send error notification
    if (historyData?.user_id) {
      await supabase.from("notifications").insert({
        user_id: historyData.user_id,
        type: "generation_error",
        title: "Помилка генерації",
        message: `Не вдалося згенерувати сайт: ${errorMessage.slice(0, 100)}`,
        data: { historyId },
      });
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const V0_API_KEY = Deno.env.get("V0_API_KEY");
    if (!V0_API_KEY) {
      console.error("[v0-proxy] V0_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "V0_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { historyId } = await req.json();
    
    if (!historyId) {
      return new Response(
        JSON.stringify({ error: "Missing historyId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[v0-proxy] Received request for historyId:", historyId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the history record exists and get prompt
    const { data: history, error: historyError } = await supabase
      .from("generation_history")
      .select("id, prompt, status")
      .eq("id", historyId)
      .single();

    if (historyError || !history) {
      console.error("[v0-proxy] History not found:", historyError);
      return new Response(
        JSON.stringify({ error: "Generation record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to generating
    await supabase
      .from("generation_history")
      .update({ status: "generating" })
      .eq("id", historyId);

    // Run generation in background
    EdgeRuntime.waitUntil(
      runV0Generation(supabase, historyId, history.prompt, V0_API_KEY)
    );

    return new Response(
      JSON.stringify({ success: true, message: "Generation started", historyId }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[v0-proxy] Request error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
