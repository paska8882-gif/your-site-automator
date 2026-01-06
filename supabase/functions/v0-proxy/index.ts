import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

// System prompt for v0.dev generation
const V0_SYSTEM_INSTRUCTION = `You are creating a STATIC Next.js website for Netlify deployment. 

CRITICAL: This MUST be a STATIC EXPORT site. No server-side features allowed.

MANDATORY next.config.mjs content:
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;

MANDATORY netlify.toml content:
[build]
command = "npm run build"
publish = "out"

Include: Privacy Policy, Terms of Service, FAQ pages, Cookie consent banner.
Use ONLY Pexels.com images. TypeScript + Tailwind CSS + Next.js 14+.`;

// Enhanced prompt with Netlify requirements
function buildFinalPrompt(prompt: string): string {
  return `${prompt}

CRITICAL STATIC EXPORT REQUIREMENTS FOR NETLIFY:

The site MUST be configured for static export. Follow these exact specifications:

1. next.config.mjs - USE THIS EXACT CONTENT:
\`\`\`javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
\`\`\`

2. netlify.toml - USE THIS EXACT CONTENT:
\`\`\`toml
[build]
command = "npm run build"
publish = "out"
\`\`\`

3. package.json scripts MUST include:
   "build": "next build"

4. DO NOT use:
   - getServerSideProps
   - API routes (/app/api or /pages/api)
   - Server components with 'use server'
   - Dynamic routes without generateStaticParams
   - next/headers or cookies()
   - Any server-only features

5. Required pages: /privacy, /terms, /faq
6. Cookie consent banner on all pages
7. Images: ONLY from Pexels.com
8. Responsive design with Tailwind CSS`;
}

// Correct configuration files to ensure Netlify deployment works
const CORRECT_NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
`;

const CORRECT_NETLIFY_TOML = `[build]
command = "npm run build"
publish = "out"
`;

// Function to fix generated files for Netlify compatibility
function fixFilesForNetlify(files: { path: string; content: string }[]): { path: string; content: string }[] {
  const fixedFiles = [...files];
  let hasNextConfig = false;
  let hasNetlifyToml = false;
  
  for (let i = 0; i < fixedFiles.length; i++) {
    const file = fixedFiles[i];
    
    // Fix next.config.mjs or next.config.js
    if (file.path === 'next.config.mjs' || file.path === 'next.config.js') {
      hasNextConfig = true;
      // Check if it has proper static export config
      if (!file.content.includes("output: 'export'") && !file.content.includes('output: "export"')) {
        console.log('[v0-proxy] Fixing next.config - adding static export');
        fixedFiles[i] = { path: 'next.config.mjs', content: CORRECT_NEXT_CONFIG };
      }
    }
    
    // Fix netlify.toml
    if (file.path === 'netlify.toml') {
      hasNetlifyToml = true;
      // Check if it has correct publish directory
      if (!file.content.includes('publish = "out"')) {
        console.log('[v0-proxy] Fixing netlify.toml - setting correct publish dir');
        fixedFiles[i] = { path: 'netlify.toml', content: CORRECT_NETLIFY_TOML };
      }
    }
    
    // Fix package.json to ensure correct build script
    if (file.path === 'package.json') {
      try {
        const pkg = JSON.parse(file.content);
        let modified = false;
        
        // Ensure build script exists
        if (!pkg.scripts) pkg.scripts = {};
        if (!pkg.scripts.build || pkg.scripts.build !== 'next build') {
          pkg.scripts.build = 'next build';
          modified = true;
        }
        
        if (modified) {
          console.log('[v0-proxy] Fixing package.json - updating build script');
          fixedFiles[i] = { path: 'package.json', content: JSON.stringify(pkg, null, 2) };
        }
      } catch (e) {
        console.log('[v0-proxy] Could not parse package.json:', e);
      }
    }
  }
  
  // Add missing required files
  if (!hasNextConfig) {
    console.log('[v0-proxy] Adding missing next.config.mjs');
    fixedFiles.push({ path: 'next.config.mjs', content: CORRECT_NEXT_CONFIG });
  }
  
  if (!hasNetlifyToml) {
    console.log('[v0-proxy] Adding missing netlify.toml');
    fixedFiles.push({ path: 'netlify.toml', content: CORRECT_NETLIFY_TOML });
  }
  
  return fixedFiles;
}

// Helper function for fetch with retry logic
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  delayMs: number = 2000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[v0-proxy] Fetch attempt ${attempt}/${maxRetries} for ${url.substring(0, 50)}...`);
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[v0-proxy] Attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        console.log(`[v0-proxy] Waiting ${delayMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error("All fetch attempts failed");
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
    
    // Step 1: Create a new chat on v0.dev with retry
    console.log("[v0-proxy] Creating new chat on v0.dev...");
    const createResponse = await fetchWithRetry(
      "https://api.v0.dev/v1/chats",
      {
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
      },
      3,
      2000
    );

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

    // Step 2: Download the generated ZIP file with retry
    console.log("[v0-proxy] Downloading ZIP from v0.dev...");
    const downloadUrl = `https://api.v0.dev/v1/chats/${chatId}/versions/${versionId}/download?format=zip&includeDefaultFiles=true`;
    
    const downloadResponse = await fetchWithRetry(
      downloadUrl,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${V0_API_KEY}`,
        "Content-Type": "application/json",
      },
    },
    3,
    2000
  );

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
    
    // Function to sanitize content - remove null characters that PostgreSQL can't store
    const sanitizeContent = (str: string): string => {
      return str.replace(/\u0000/g, '');
    };
    
    for (const [path, file] of Object.entries(zipContents.files)) {
      if (!file.dir) {
        try {
          const content = await file.async("string");
          // Sanitize content to remove null characters
          files.push({ path, content: sanitizeContent(content) });
        } catch {
          // Binary file, skip
          console.log("[v0-proxy] Skipping binary file:", path);
        }
      }
    }
    
    console.log("[v0-proxy] Extracted files:", files.length);

    // Step 4: Fix files for Netlify compatibility
    const fixedFiles = fixFilesForNetlify(files);
    console.log("[v0-proxy] Fixed files count:", fixedFiles.length);

    // Step 5: Create new ZIP with fixed files
    const outputZip = new JSZip();
    for (const f of fixedFiles) {
      outputZip.file(f.path, f.content);
    }
    const zipBase64 = await outputZip.generateAsync({ type: "base64" });

    // Step 6: Update generation_history
    const { error: updateError } = await supabase
      .from("generation_history")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        zip_data: zipBase64,
        files_data: fixedFiles,
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
